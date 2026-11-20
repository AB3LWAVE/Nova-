import 'dotenv/config';
import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { requireAuth, AuthRequest } from './src/middleware/auth.ts';
import { isSqlConfigured } from './src/db/index.ts';
import { getOrCreateUser } from './src/db/users.ts';
import {
  deleteUserConversation,
  listUserCodeProjects,
  listUserConversations,
  listUserPlans,
  listUserQuizzes,
  listUserWorkspaces,
  recordUsageTelemetry,
  upsertCodeProject,
  upsertConversation,
  upsertPlan,
  upsertQuiz,
  upsertWorkspace,
} from './src/db/repository.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);

function getGenAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY is not configured in environment secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function resolveAllowedModel(requestedModel?: string): string {
  switch (requestedModel) {
    case 'gemini-3.1-flash-lite':
      return 'gemini-3.1-flash-lite';
    case 'gemini-4-hydrogen':
      return 'gemini-4-hydrogen';
    case 'gemini-4-neon':
    case 'gemini-4-carbon':
      return requestedModel;
    default:
      return 'gemini-4-hydrogen';
  }
}

function extractErrorStatus(err: unknown): { status: number; message: string } {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes('API_KEY_INVALID') || message.includes('PERMISSION_DENIED') || message.includes('403')) {
    return { status: 403, message: 'Gemini API permission denied. Check your GEMINI_API_KEY in Settings > Secrets.' };
  }
  if (message.includes('RESOURCE_EXHAUSTED') || message.includes('429')) {
    return { status: 429, message: 'Gemini API quota exceeded or paid tier required for the selected model.' };
  }
  if (message.includes('NOT_FOUND') || message.includes('404')) {
    return { status: 404, message: 'Requested Gemini model was not found or is unsupported.' };
  }
  return { status: 500, message };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  // Health & capability endpoint
  app.get('/api/health', (_req: Request, res: Response) => {
    const hasGemini = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY');
    res.json({
      ok: true,
      geminiConfigured: hasGemini,
      sqlConfigured: isSqlConfigured(),
      timestamp: new Date().toISOString(),
    });
  });

  // ---------------------------------------------------------------------------
  // Server-Side @google/genai Endpoints
  // ---------------------------------------------------------------------------

  // 1. Chat & Multimodal (Image / Video / Text) with optional SSE streaming
  app.post('/api/gemini/chat', async (req: Request, res: Response) => {
    try {
      const {
        prompt,
        history = [],
        systemInstruction,
        model = 'gemini-4-hydrogen',
        attachments = [],
        stream = false,
      } = req.body as {
        prompt: string;
        history?: Array<{ role: 'user' | 'assistant'; content: string }>;
        systemInstruction?: string;
        model?: string;
        attachments?: Array<{ mimeType: string; data: string; name?: string }>;
        stream?: boolean;
      };

      if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ error: 'Prompt text is required.' });
      }

      const ai = getGenAI();
      const targetModel = resolveAllowedModel(model);
      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

      for (const att of attachments) {
        if (att.data && att.mimeType) {
          parts.push({
            inlineData: {
              mimeType: att.mimeType,
              data: att.data,
            },
          });
        }
      }

      const contextTranscript =
        history.length > 0
          ? `Previous conversation context:\n${history
              .slice(-8)
              .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
              .join('\n')}\n\nCurrent User Request:\n`
          : '';

      parts.push({ text: `${contextTranscript}${prompt}` });

      if (stream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const responseStream = await ai.models.generateContentStream({
          model: targetModel,
          contents: { parts },
          config: systemInstruction ? { systemInstruction } : undefined,
        });

        for await (const chunk of responseStream) {
          if (chunk.text) {
            res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
          }
        }
        res.write(`data: ${JSON.stringify({ done: true, model: targetModel })}\n\n`);
        res.end();
        return;
      }

      const response = await ai.models.generateContent({
        model: targetModel,
        contents: { parts },
        config: systemInstruction ? { systemInstruction } : undefined,
      });

      res.json({
        text: response.text ?? '',
        model: targetModel,
        inferenceSource: 'in_cloud',
      });
    } catch (err) {
      const { status, message } = extractErrorStatus(err);
      if (!res.headersSent) {
        res.status(status).json({ error: message });
      } else {
        res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
        res.end();
      }
    }
  });

  // 2. Structured Quiz Generation
  app.post('/api/gemini/quiz', async (req: Request, res: Response) => {
    try {
      const {
        subject,
        topicPrompt,
        quizType = 'multiple_choice',
        difficulty = 'intermediate',
        count = 5,
        choiceCount = 4,
        includeExplanations = true,
        model = 'gemini-4-hydrogen',
      } = req.body as {
        subject: string;
        topicPrompt: string;
        quizType?: string;
        difficulty?: string;
        count?: number;
        choiceCount?: number;
        includeExplanations?: boolean;
        model?: string;
      };

      const ai = getGenAI();
      const targetModel = resolveAllowedModel(model);
      const boundedCount = Math.min(Math.max(Number(count) || 5, 1), 20);

      const prompt = `Create a ${difficulty} difficulty quiz for subject "${subject}".
Topic / Instructions: ${topicPrompt || subject}
Question type: ${quizType}
Number of questions: ${boundedCount}
Number of choices for multiple-choice items: ${choiceCount}
Include explanations: ${includeExplanations ? 'yes' : 'no'}.
For true_false questions, provide ["True", "False"] as options. For short_answer, fill_blank, or essay questions, provide an empty options array and a clear model correctAnswer.`;

      const response = await ai.models.generateContent({
        model: targetModel,
        contents: prompt,
        config: {
          systemInstruction: 'You are an expert educational assessment designer. Output strictly valid JSON matching the requested schema.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    type: { type: Type.STRING },
                    prompt: { type: Type.STRING },
                    options: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    correctAnswer: { type: Type.STRING },
                    explanation: { type: Type.STRING },
                  },
                  required: ['id', 'type', 'prompt', 'options', 'correctAnswer', 'explanation'],
                },
              },
            },
            required: ['title', 'questions'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json({ ...parsed, model: targetModel, inferenceSource: 'in_cloud' });
    } catch (err) {
      const { status, message } = extractErrorStatus(err);
      res.status(status).json({ error: message });
    }
  });

  // 3. Code Studio & Visual-to-Code (Multimodal Sketch/Screenshot -> Code)
  app.post('/api/gemini/code', async (req: Request, res: Response) => {
    try {
      const {
        action = 'generate',
        prompt,
        code = '',
        language = 'html',
        targetLanguage,
        imageBase64,
        imageMimeType = 'image/png',
        model = 'gemini-4-hydrogen',
      } = req.body as {
        action?: string;
        prompt: string;
        code?: string;
        language?: string;
        targetLanguage?: string;
        imageBase64?: string;
        imageMimeType?: string;
        model?: string;
      };

      const ai = getGenAI();
      const targetModel = resolveAllowedModel(model);

      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
      if (imageBase64) {
        parts.push({
          inlineData: {
            mimeType: imageMimeType,
            data: imageBase64,
          },
        });
      }

      const instructionMap: Record<string, string> = {
        visual_to_code: `Analyze the provided wireframe sketch or UI screenshot carefully and translate it into clean, responsive, semantic ${language} code (if HTML, return a complete single-file HTML document with clean CSS; if React, return a clean React component). User notes: ${prompt}`,
        generate: `Generate clean, production-ready ${language} code for: ${prompt}`,
        explain: `Explain the following ${language} code clearly, highlighting architecture, edge cases, and complexity:\n\n${code}\n\nFocus: ${prompt}`,
        debug: `Identify and fix any bugs or runtime issues in this ${language} code. Return the corrected code and a concise explanation:\n\n${code}\n\nIssue: ${prompt}`,
        refactor: `Refactor this ${language} code for clarity, modularity, and maintainability:\n\n${code}\n\nGuidance: ${prompt}`,
        optimize: `Optimize performance and memory usage of this ${language} code:\n\n${code}\n\nGuidance: ${prompt}`,
        translate: `Translate this ${language} code into ${targetLanguage || 'TypeScript'}:\n\n${code}\n\nNotes: ${prompt}`,
        docs: `Generate comprehensive JSDoc/docstring documentation and usage examples for:\n\n${code}`,
        tests: `Write thorough unit tests for this ${language} code:\n\n${code}\n\nNotes: ${prompt}`,
        review: `Perform a senior code review on this ${language} code covering correctness, security, and edge cases:\n\n${code}`,
      };

      parts.push({ text: instructionMap[action] || instructionMap.generate });

      const response = await ai.models.generateContent({
        model: targetModel,
        contents: { parts },
        config: {
          systemInstruction:
            'You are a senior software architect. Respond with JSON containing "summary" (concise explanation) and "code" (the full runnable/usable code without markdown fences) and "language".',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              code: { type: Type.STRING },
              language: { type: Type.STRING },
            },
            required: ['summary', 'code', 'language'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json({ ...parsed, model: targetModel, inferenceSource: 'in_cloud' });
    } catch (err) {
      const { status, message } = extractErrorStatus(err);
      res.status(status).json({ error: message });
    }
  });

  // 4. Structured Plan Generation
  app.post('/api/gemini/plan', async (req: Request, res: Response) => {
    try {
      const {
        goal,
        horizon = 'weekly',
        action = 'generate',
        existingTasks = [],
        model = 'gemini-4-hydrogen',
      } = req.body as {
        goal: string;
        horizon?: string;
        action?: string;
        existingTasks?: Array<{ title: string; status: string; priority: string }>;
        model?: string;
      };

      const ai = getGenAI();
      const targetModel = resolveAllowedModel(model);

      const prompt = `Action: ${action}
Planning Horizon: ${horizon}
Goal / Context: ${goal}
${existingTasks.length > 0 ? `Existing tasks:\n${JSON.stringify(existingTasks)}` : ''}
Generate an actionable, realistic structured plan with tasks, priorities (low|medium|high|urgent), statuses (todo|in_progress|done), estimatedMinutes, dueDate (YYYY-MM-DD starting from 2026-11-20), milestone labels, and dependencies.`;

      const response = await ai.models.generateContent({
        model: targetModel,
        contents: prompt,
        config: {
          systemInstruction: 'You are an expert productivity and project planner. Output structured JSON matching the schema.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              summary: { type: Type.STRING },
              tasks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    title: { type: Type.STRING },
                    notes: { type: Type.STRING },
                    priority: { type: Type.STRING },
                    status: { type: Type.STRING },
                    estimatedMinutes: { type: Type.INTEGER },
                    dueDate: { type: Type.STRING },
                    milestone: { type: Type.STRING },
                    dependsOn: { type: Type.STRING },
                  },
                  required: ['id', 'title', 'priority', 'status', 'estimatedMinutes', 'dueDate', 'milestone'],
                },
              },
            },
            required: ['title', 'summary', 'tasks'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json({ ...parsed, model: targetModel, inferenceSource: 'in_cloud' });
    } catch (err) {
      const { status, message } = extractErrorStatus(err);
      res.status(status).json({ error: message });
    }
  });

  // 5. Audio Transcription (gemini-3.5-transcribe)
  app.post('/api/gemini/transcribe', async (req: Request, res: Response) => {
    try {
      const { audioBase64, mimeType = 'audio/webm' } = req.body as {
        audioBase64: string;
        mimeType?: string;
      };
      if (!audioBase64) {
        return res.status(400).json({ error: 'Audio payload is required.' });
      }
      const ai = getGenAI();
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: {
          parts: [
            { inlineData: { mimeType, data: audioBase64 } },
            { text: 'Transcribe this audio accurately without adding commentary.' },
          ],
        },
      });
      res.json({ text: (response.text ?? '').trim(), model: 'gemini-3.5-transcribe' });
    } catch (err) {
      const { status, message } = extractErrorStatus(err);
      res.status(status).json({ error: message });
    }
  });

  // 6. Text-to-Speech (gemini-3.8-flash-lite-tts)
  app.post('/api/gemini/tts', async (req: Request, res: Response) => {
    try {
      const { text, voiceName = 'Kore' } = req.body as { text: string; voiceName?: string };
      if (!text) {
        return res.status(400).json({ error: 'Text is required for speech synthesis.' });
      }
      const ai = getGenAI();
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [{ text: text.slice(0, 2000) }],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        return res.status(502).json({ error: 'Speech synthesis returned empty audio.' });
      }
      res.json({ audioBase64: base64Audio, mimeType: 'audio/wav', model: 'gemini-3.8-flash-lite-tts' });
    } catch (err) {
      const { status, message } = extractErrorStatus(err);
      res.status(status).json({ error: message });
    }
  });

  // 7. Response Verification against provided evidence / Knowledge Vault sources
  app.post('/api/gemini/verify', async (req: Request, res: Response) => {
    try {
      const { responseText, sources = [] } = req.body as {
        responseText: string;
        sources?: Array<{ title: string; excerpt: string }>;
      };
      if (!responseText) {
        return res.status(400).json({ error: 'Response text is required.' });
      }
      const ai = getGenAI();
      const prompt = `Extract the key factual claims from the assistant response below and evaluate each claim ONLY against the provided Knowledge Vault evidence excerpts.
IMPORTANT: Never mark a claim "verified" unless the provided evidence explicitly supports it. If no supporting evidence is provided, mark it "needs_review" and state clearly what evidence is missing.

Assistant Response:
${responseText}

Provided Evidence Sources:
${sources.length > 0 ? sources.map((s, idx) => `[${idx + 1}] ${s.title}: ${s.excerpt}`).join('\n') : 'None provided.'}`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              overallStatus: { type: Type.STRING },
              limitations: { type: Type.STRING },
              claims: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    claim: { type: Type.STRING },
                    status: { type: Type.STRING },
                    evidenceCitation: { type: Type.STRING },
                    suggestedCorrection: { type: Type.STRING },
                  },
                  required: ['claim', 'status', 'evidenceCitation'],
                },
              },
            },
            required: ['overallStatus', 'limitations', 'claims'],
          },
        },
      });
      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json(parsed);
    } catch (err) {
      const { status, message } = extractErrorStatus(err);
      res.status(status).json({ error: message });
    }
  });

  // 8. AI Workspace Generator
  app.post('/api/gemini/workspace-layout', async (req: Request, res: Response) => {
    try {
      const { description } = req.body as { description: string };
      if (!description) {
        return res.status(400).json({ error: 'Workspace description is required.' });
      }
      const ai = getGenAI();
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Design a custom NOVA AI Workspace configuration for this user request: "${description}".
Choose widgets from allowed types: ["chat", "quiz", "code", "plan", "knowledge", "hybrid_monitor", "notes", "visual_to_code"].
Assign each widget to a zone ("left", "center", "right") and span (1 or 2).`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              description: { type: Type.STRING },
              primaryTab: { type: Type.STRING },
              widgets: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    type: { type: Type.STRING },
                    title: { type: Type.STRING },
                    zone: { type: Type.STRING },
                    visible: { type: Type.BOOLEAN },
                    widthPct: { type: Type.INTEGER },
                  },
                  required: ['id', 'type', 'title', 'zone', 'visible', 'widthPct'],
                },
              },
            },
            required: ['name', 'description', 'primaryTab', 'widgets'],
          },
        },
      });
      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json(parsed);
    } catch (err) {
      const { status, message } = extractErrorStatus(err);
      res.status(status).json({ error: message });
    }
  });

  // ---------------------------------------------------------------------------
  // Protected Cloud SQL (PostgreSQL + Drizzle) Endpoints
  // ---------------------------------------------------------------------------

  app.get('/api/sql/sync', requireAuth, async (req: AuthRequest, res: Response) => {
    if (!isSqlConfigured()) {
      return res.json({ sqlActive: false, conversations: [], quizzes: [], codeProjects: [], plans: [], workspaces: [] });
    }
    try {
      const uid = req.user!.uid;
      await getOrCreateUser(uid, req.user!.email || `${uid}@nova.local`, req.user!.name, req.user!.picture);
      const [convos, quizRows, codeRows, planRows, wsRows] = await Promise.all([
        listUserConversations(uid),
        listUserQuizzes(uid),
        listUserCodeProjects(uid),
        listUserPlans(uid),
        listUserWorkspaces(uid),
      ]);
      res.json({
        sqlActive: true,
        conversations: convos,
        quizzes: quizRows,
        codeProjects: codeRows,
        plans: planRows,
        workspaces: wsRows,
      });
    } catch (err) {
      console.error('SQL sync read failed:', err);
      res.status(503).json({ sqlActive: false, error: 'Cloud SQL database unavailable; using local and Firestore cache.' });
    }
  });

  app.post('/api/sql/conversations', requireAuth, async (req: AuthRequest, res: Response) => {
    if (!isSqlConfigured()) return res.json({ sqlActive: false, saved: false });
    try {
      const uid = req.user!.uid;
      await getOrCreateUser(uid, req.user!.email || `${uid}@nova.local`, req.user!.name, req.user!.picture);
      const row = await upsertConversation(uid, req.body);
      res.json({ sqlActive: true, saved: true, row });
    } catch (err) {
      res.status(503).json({ sqlActive: false, error: err instanceof Error ? err.message : 'Failed to save to Cloud SQL' });
    }
  });

  app.delete('/api/sql/conversations/:id', requireAuth, async (req: AuthRequest, res: Response) => {
    if (!isSqlConfigured()) return res.json({ sqlActive: false, deleted: false });
    try {
      await deleteUserConversation(req.user!.uid, String(req.params.id));
      res.json({ sqlActive: true, deleted: true });
    } catch (err) {
      res.status(503).json({ sqlActive: false, error: err instanceof Error ? err.message : 'Failed to delete in Cloud SQL' });
    }
  });

  app.post('/api/sql/quizzes', requireAuth, async (req: AuthRequest, res: Response) => {
    if (!isSqlConfigured()) return res.json({ sqlActive: false, saved: false });
    try {
      const uid = req.user!.uid;
      await getOrCreateUser(uid, req.user!.email || `${uid}@nova.local`, req.user!.name, req.user!.picture);
      const row = await upsertQuiz(uid, req.body);
      res.json({ sqlActive: true, saved: true, row });
    } catch (err) {
      res.status(503).json({ sqlActive: false, error: err instanceof Error ? err.message : 'Failed to save quiz' });
    }
  });

  app.post('/api/sql/code-projects', requireAuth, async (req: AuthRequest, res: Response) => {
    if (!isSqlConfigured()) return res.json({ sqlActive: false, saved: false });
    try {
      const uid = req.user!.uid;
      await getOrCreateUser(uid, req.user!.email || `${uid}@nova.local`, req.user!.name, req.user!.picture);
      const row = await upsertCodeProject(uid, req.body);
      res.json({ sqlActive: true, saved: true, row });
    } catch (err) {
      res.status(503).json({ sqlActive: false, error: err instanceof Error ? err.message : 'Failed to save code project' });
    }
  });

  app.post('/api/sql/plans', requireAuth, async (req: AuthRequest, res: Response) => {
    if (!isSqlConfigured()) return res.json({ sqlActive: false, saved: false });
    try {
      const uid = req.user!.uid;
      await getOrCreateUser(uid, req.user!.email || `${uid}@nova.local`, req.user!.name, req.user!.picture);
      const row = await upsertPlan(uid, req.body);
      res.json({ sqlActive: true, saved: true, row });
    } catch (err) {
      res.status(503).json({ sqlActive: false, error: err instanceof Error ? err.message : 'Failed to save plan' });
    }
  });

  app.post('/api/sql/workspaces', requireAuth, async (req: AuthRequest, res: Response) => {
    if (!isSqlConfigured()) return res.json({ sqlActive: false, saved: false });
    try {
      const uid = req.user!.uid;
      await getOrCreateUser(uid, req.user!.email || `${uid}@nova.local`, req.user!.name, req.user!.picture);
      const row = await upsertWorkspace(uid, req.body);
      res.json({ sqlActive: true, saved: true, row });
    } catch (err) {
      res.status(503).json({ sqlActive: false, error: err instanceof Error ? err.message : 'Failed to save workspace' });
    }
  });

  app.post('/api/sql/telemetry', requireAuth, async (req: AuthRequest, res: Response) => {
    if (!isSqlConfigured()) return res.json({ sqlActive: false, logged: false });
    try {
      const row = await recordUsageTelemetry(req.user!.uid, req.body);
      res.json({ sqlActive: true, logged: true, row });
    } catch (err) {
      res.status(503).json({ sqlActive: false, error: err instanceof Error ? err.message : 'Failed to log telemetry' });
    }
  });

  // ---------------------------------------------------------------------------
  // Vite Middleware (Dev) or Static Assets (Prod)
  // ---------------------------------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`NOVA AI Workspace server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start NOVA server:', err);
  process.exit(1);
});
