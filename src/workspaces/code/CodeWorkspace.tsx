import React, { useEffect, useMemo, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import {
  Check,
  Code2,
  Copy,
  Download,
  Eraser,
  Eye,
  FilePlus,
  History,
  Paintbrush,
  Play,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { NOVA_MODELS } from '../../data/seedData';
import { useNovaStore } from '../../stores/useNovaStore';
import { CodeFile, CodeProject } from '../../types/nova';
import { sanitizePreviewHtml } from '../../utils/workspaceLogic';

type CodeAction =
  | 'generate'
  | 'explain'
  | 'debug'
  | 'refactor'
  | 'optimize'
  | 'translate'
  | 'docs'
  | 'tests'
  | 'review';

const CODE_ACTIONS: Array<{ id: CodeAction; label: string }> = [
  { id: 'generate', label: 'Generate' },
  { id: 'explain', label: 'Explain' },
  { id: 'debug', label: 'Debug' },
  { id: 'refactor', label: 'Refactor' },
  { id: 'optimize', label: 'Optimize' },
  { id: 'translate', label: 'Translate' },
  { id: 'docs', label: 'Write Docs' },
  { id: 'tests', label: 'Write Tests' },
  { id: 'review', label: 'Code Review' },
];

const SUPPORTED_LANGUAGES = [
  { id: 'html', label: 'HTML / CSS / JS', ext: 'html' },
  { id: 'typescript', label: 'TypeScript', ext: 'ts' },
  { id: 'javascript', label: 'JavaScript', ext: 'js' },
  { id: 'python', label: 'Python', ext: 'py' },
  { id: 'css', label: 'CSS', ext: 'css' },
  { id: 'json', label: 'JSON', ext: 'json' },
];

export const CodeWorkspace: React.FC = () => {
  const {
    selectedModelId,
    setSelectedModelId,
    codeProjects,
    activeCodeProjectId,
    setActiveCodeProjectId,
    saveCodeProject,
    deleteCodeProject,
    leftSidebarOpen,
    rightSidebarOpen,
    localReadiness,
    routingMode,
    addTelemetryEvent,
    pushToast,
    openConfirm,
  } = useNovaStore();

  const activeProject = useMemo(
    () => codeProjects.find((p) => p.id === activeCodeProjectId) || codeProjects[0],
    [codeProjects, activeCodeProjectId]
  );

  const activeFile = useMemo(
    () =>
      activeProject?.files.find((f) => f.id === activeProject.activeFileId) ||
      activeProject?.files[0],
    [activeProject]
  );

  const [selectedAction, setSelectedAction] = useState<CodeAction>('generate');
  const [targetLanguage, setTargetLanguage] = useState('typescript');
  const [promptInput, setPromptInput] = useState('');
  const [centerMode, setCenterMode] = useState<'split' | 'editor' | 'preview'>('split');
  const [editorTheme, setEditorTheme] = useState<'vs-dark' | 'light'>('vs-dark');
  const [isRunningAi, setIsRunningAi] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [showNewFileInput, setShowNewFileInput] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [historySearch, setHistorySearch] = useState('');

  // Visual-to-Code Mini Paint Canvas & Upload (matching NOVA sketch right top box)
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sketchUploadRef = useRef<HTMLInputElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushColor, setBrushColor] = useState('#38BDF8');
  const [brushSize, setBrushSize] = useState(3);
  const [sketchTarget, setSketchTarget] = useState<'html' | 'react'>('html');
  const [sketchNotes, setSketchNotes] = useState('');
  const [uploadedSketchBase64, setUploadedSketchBase64] = useState<string | null>(null);
  const [uploadedSketchMime, setUploadedSketchMime] = useState<string>('image/png');
  const [isConvertingSketch, setIsConvertingSketch] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#070B14';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Subtle wireframe grid guide
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
    ctx.lineWidth = 1;
    for (let x = 24; x < canvas.width; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 24; y < canvas.height; y += 24) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
  }, []);

  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    canvas.setPointerCapture(e.pointerId);
    const { x, y } = getCanvasCoords(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = brushColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    setIsDrawing(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const { x, y } = getCanvasCoords(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handlePointerUp = () => {
    setIsDrawing(false);
  };

  const handleClearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.fillStyle = '#070B14';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
    ctx.lineWidth = 1;
    for (let x = 24; x < canvas.width; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 24; y < canvas.height; y += 24) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
    setUploadedSketchBase64(null);
  };

  const handleSketchUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const base64 = dataUrl.split(',')[1] || '';
      setUploadedSketchBase64(base64);
      setUploadedSketchMime(file.type || 'image/png');
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) {
        const img = new Image();
        img.onload = () => {
          ctx.fillStyle = '#070B14';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
          const w = img.width * scale;
          const h = img.height * scale;
          ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
        };
        img.src = dataUrl;
      }
      pushToast({ type: 'info', title: 'Screenshot Loaded', detail: file.name });
    };
    reader.readAsDataURL(file);
  };

  const updateActiveFileContent = (content: string) => {
    if (!activeProject || !activeFile) return;
    saveCodeProject({
      ...activeProject,
      updatedAt: new Date().toISOString(),
      files: activeProject.files.map((f) => (f.id === activeFile.id ? { ...f, content } : f)),
    });
  };

  const handleCreateProject = () => {
    const id = `code-${Date.now()}`;
    const fileId = `file-${Date.now()}`;
    const proj: CodeProject = {
      id,
      name: `Project ${codeProjects.length + 1}`,
      language: 'html',
      activeFileId: fileId,
      updatedAt: new Date().toISOString(),
      lastSummary: 'Blank HTML + CSS starter workspace.',
      files: [
        {
          id: fileId,
          name: 'index.html',
          language: 'html',
          content: `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8" />\n  <style>body { font-family: system-ui; background: #070b14; color: #f8fafc; padding: 32px; }</style>\n</head>\n<body>\n  <h1>New NOVA Code Project</h1>\n  <p>Edit code or prompt Gemini to build UI components.</p>\n</body>\n</html>`,
        },
      ],
    };
    saveCodeProject(proj);
    setActiveCodeProjectId(id);
  };

  const handleAddFile = () => {
    if (!activeProject || !newFileName.trim()) return;
    const name = newFileName.trim();
    const ext = name.split('.').pop()?.toLowerCase() || 'ts';
    const langMap: Record<string, string> = {
      html: 'html',
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      py: 'python',
      css: 'css',
      json: 'json',
    };
    const file: CodeFile = {
      id: `file-${Date.now()}`,
      name,
      language: langMap[ext] || 'typescript',
      content: `// ${name}\n`,
    };
    saveCodeProject({
      ...activeProject,
      activeFileId: file.id,
      updatedAt: new Date().toISOString(),
      files: [...activeProject.files, file],
    });
    setNewFileName('');
    setShowNewFileInput(false);
  };

  const handleRunCodeAi = async () => {
    if (!activeProject || !activeFile) return;
    const text = promptInput.trim() || `${selectedAction} ${activeFile.name}`;
    setIsRunningAi(true);
    const startedAt = performance.now();
    try {
      const modelToUse = selectedModelId === 'gemini-nano-4' ? 'gemini-4-hydrogen' : selectedModelId;
      const res = await fetch('/api/gemini/code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: selectedAction,
          prompt: text,
          code: activeFile.content,
          language: activeFile.language,
          targetLanguage,
          model: modelToUse,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Code AI request failed.');

      const nextCode = typeof data.code === 'string' && data.code.trim() ? data.code : activeFile.content;
      const nextLang = data.language || activeFile.language;

      saveCodeProject({
        ...activeProject,
        language: nextLang,
        lastSummary: data.summary || `${selectedAction} completed.`,
        updatedAt: new Date().toISOString(),
        files: activeProject.files.map((f) =>
          f.id === activeFile.id ? { ...f, content: nextCode, language: nextLang } : f
        ),
      });

      addTelemetryEvent({
        id: `tel-${Date.now()}`,
        timestamp: new Date().toISOString(),
        workspace: 'code',
        requestedModelId: selectedModelId,
        routingMode,
        decision: 'in_cloud',
        actualSource: selectedModelId === 'gemini-nano-4' ? 'hybrid_fallback' : 'in_cloud',
        reason: `Code Studio (${selectedAction}) processed via ${modelToUse}.`,
        latencyMs: Math.round(performance.now() - startedAt),
        fallbackTriggered: selectedModelId === 'gemini-nano-4',
        status: 'success',
      });

      setPromptInput('');
      pushToast({
        type: 'success',
        title: 'Code Updated',
        detail: data.summary || `${selectedAction} applied cleanly.`,
      });
    } catch (err) {
      pushToast({
        type: 'error',
        title: 'Code AI Error',
        detail: err instanceof Error ? err.message : 'Unable to execute code request.',
      });
    } finally {
      setIsRunningAi(false);
    }
  };

  const handleConvertVisualToCode = async () => {
    const canvas = canvasRef.current;
    if (!canvas && !uploadedSketchBase64) return;
    setIsConvertingSketch(true);
    const startedAt = performance.now();
    try {
      const dataUrl = canvas ? canvas.toDataURL('image/png') : '';
      const imageBase64 = uploadedSketchBase64 || dataUrl.split(',')[1];
      const imageMimeType = uploadedSketchBase64 ? uploadedSketchMime : 'image/png';
      const targetLangLabel =
        sketchTarget === 'html'
          ? 'html (complete single-file HTML5 + modern CSS + clean vanilla JS)'
          : 'typescript (React + Tailwind CSS component)';

      const res = await fetch('/api/gemini/code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'visual_to_code',
          prompt:
            sketchNotes.trim() ||
            `Convert this wireframe sketch into clean, responsive ${targetLangLabel}.`,
          language: sketchTarget === 'html' ? 'html' : 'typescript',
          imageBase64,
          imageMimeType,
          model: selectedModelId === 'gemini-nano-4' ? 'gemini-4-hydrogen' : selectedModelId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Visual-to-Code failed.');

      const generatedFileId = `file-v2c-${Date.now()}`;
      const newFile: CodeFile = {
        id: generatedFileId,
        name: sketchTarget === 'html' ? 'sketch-preview.html' : 'SketchComponent.tsx',
        language: sketchTarget === 'html' ? 'html' : 'typescript',
        content: data.code || '<!-- Empty generated output -->',
      };

      const projectName = `Visual Sketch ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      const created: CodeProject = {
        id: `code-v2c-${Date.now()}`,
        name: projectName,
        language: newFile.language,
        activeFileId: generatedFileId,
        sourceSketchDataUrl: dataUrl || undefined,
        lastSummary: data.summary || 'Generated from Visual-to-Code sketch.',
        updatedAt: new Date().toISOString(),
        files: [newFile],
      };

      saveCodeProject(created);
      setActiveCodeProjectId(created.id);
      if (sketchTarget === 'html') {
        setCenterMode('split');
      }

      addTelemetryEvent({
        id: `tel-${Date.now()}`,
        timestamp: new Date().toISOString(),
        workspace: 'code',
        requestedModelId: selectedModelId,
        routingMode,
        decision: 'in_cloud',
        actualSource: 'in_cloud',
        reason: 'Multimodal Visual-to-Code sketch translation routed to Cloud Gemini.',
        latencyMs: Math.round(performance.now() - startedAt),
        fallbackTriggered: selectedModelId === 'gemini-nano-4',
        status: 'success',
      });

      pushToast({
        type: 'success',
        title: 'Visual-to-Code Generated',
        detail: data.summary || 'Generated code from your wireframe sketch.',
      });
    } catch (err) {
      pushToast({
        type: 'error',
        title: 'Visual-to-Code Error',
        detail: err instanceof Error ? err.message : 'Unable to convert sketch.',
      });
    } finally {
      setIsConvertingSketch(false);
    }
  };

  const handleDownloadCode = () => {
    if (!activeFile) return;
    const blob = new Blob([activeFile.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeFile.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const previewHtmlDocument = useMemo(() => {
    if (!activeFile) return '';
    if (activeFile.language === 'html' || activeFile.name.endsWith('.html')) {
      return sanitizePreviewHtml(activeFile.content);
    }
    const escaped = activeFile.content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return `<!DOCTYPE html><html><body style="background:#070B14;color:#E2E8F0;font-family:ui-monospace,monospace;padding:16px;font-size:12px;">
      <div style="color:#38BDF8;margin-bottom:8px;">Source Preview (${activeFile.name} · ${activeFile.language})</div>
      <pre style="white-space:pre-wrap;line-height:1.5;">${escaped}</pre>
    </body></html>`;
  }, [activeFile]);

  const filteredProjects = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    return codeProjects.filter(
      (p) => !q || p.name.toLowerCase().includes(q) || (p.lastSummary || '').toLowerCase().includes(q)
    );
  }, [codeProjects, historySearch]);

  return (
    <div className="flex h-full min-h-0 flex-1 overflow-hidden">
      {/* LEFT PANEL: Models + AI Code Actions (per sketch) */}
      {leftSidebarOpen && (
        <aside
          aria-label="Code Models and Actions"
          className="w-72 max-w-[85vw] shrink-0 border-r border-slate-800/80 bg-[#0B101D] flex flex-col min-h-0 overflow-hidden max-lg:absolute max-lg:inset-y-0 max-lg:left-0 max-lg:z-40 max-lg:shadow-2xl"
        >
          <div className="border-b border-slate-800/80 p-3.5 max-h-[50%] overflow-y-auto">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              AI Models
            </h2>
            <div className="space-y-1.5">
              {NOVA_MODELS.map((model) => {
                const selected = model.id === selectedModelId;
                const isLocal = model.location === 'on-device';
                const statusLabel = isLocal
                  ? localReadiness === 'available'
                    ? 'Local Ready'
                    : localReadiness === 'downloadable'
                    ? 'Downloadable'
                    : 'Local: Off'
                  : model.availability === 'ready'
                  ? 'Cloud Ready'
                  : model.availability === 'requires_paid_key'
                  ? 'Paid Key Req.'
                  : 'Extension Slot';

                return (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => setSelectedModelId(model.id)}
                    className={`w-full text-left rounded-lg px-2.5 py-1.5 border transition-colors ${
                      selected
                        ? 'border-indigo-500/70 bg-indigo-500/12 text-slate-100'
                        : 'border-slate-800/70 bg-slate-900/40 text-slate-300 hover:border-slate-700 hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium truncate">{model.name}</span>
                      <span className="text-[10px] shrink-0 text-cyan-400">{statusLabel}</span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-400 truncate">
                      {model.provider} · {model.contextWindow}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-4">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                AI Code Action
              </h2>
              <div className="grid grid-cols-2 gap-1.5">
                {CODE_ACTIONS.map((act) => (
                  <button
                    key={act.id}
                    type="button"
                    onClick={() => setSelectedAction(act.id)}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-medium border text-left transition-colors ${
                      selectedAction === act.id
                        ? 'border-cyan-500/70 bg-cyan-500/15 text-cyan-200'
                        : 'border-slate-800 bg-slate-900/40 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    {act.label}
                  </button>
                ))}
              </div>
            </div>

            {selectedAction === 'translate' && (
              <div>
                <label
                  htmlFor="translate-target-lang"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Target Language
                </label>
                <select
                  id="translate-target-lang"
                  value={targetLanguage}
                  onChange={(e) => setTargetLanguage(e.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-[#070B14] px-2.5 py-1.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
                >
                  {SUPPORTED_LANGUAGES.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Project Files
                </h2>
                <button
                  type="button"
                  onClick={() => setShowNewFileInput((v) => !v)}
                  aria-label="Add new file to project"
                  className="inline-flex items-center gap-1 text-xs text-indigo-300 hover:text-indigo-200"
                >
                  <FilePlus className="h-3.5 w-3.5" />
                  <span>Add</span>
                </button>
              </div>

              {showNewFileInput && (
                <div className="mb-2 flex gap-1.5">
                  <input
                    type="text"
                    value={newFileName}
                    onChange={(e) => setNewFileName(e.target.value)}
                    placeholder="e.g. App.tsx"
                    aria-label="New file name"
                    className="flex-1 min-w-0 rounded-md border border-slate-700 bg-[#070B14] px-2 py-1 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddFile}
                    className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-500"
                  >
                    Create
                  </button>
                </div>
              )}

              <div className="space-y-1">
                {activeProject?.files.map((file) => (
                  <button
                    key={file.id}
                    type="button"
                    onClick={() =>
                      saveCodeProject({
                        ...activeProject,
                        activeFileId: file.id,
                      })
                    }
                    className={`w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                      file.id === activeFile?.id
                        ? 'bg-indigo-500/15 text-indigo-200 border border-indigo-500/50'
                        : 'text-slate-300 hover:bg-slate-800/60 border border-transparent'
                    }`}
                  >
                    <span className="truncate font-mono">{file.name}</span>
                    <span className="text-[10px] text-slate-500 uppercase">{file.language}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* CENTRAL WORKSPACE: Code Editor + Sandboxed Live Preview + Bottom Prompt Bar */}
      <section className="flex-1 min-w-0 flex flex-col bg-[#070B14] min-h-0">
        {/* Top Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 px-4 py-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <Code2 className="h-4 w-4 text-cyan-400 shrink-0" />
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-slate-100 truncate">
                {activeProject?.name || 'Code Studio'}
              </h1>
              <p className="text-[11px] text-slate-400 truncate">
                {activeFile?.name} · {activeProject?.lastSummary || 'Monaco Editor + Sandboxed Preview'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <div className="inline-flex rounded-lg border border-slate-800 bg-[#0B101D] p-0.5">
              {(['split', 'editor', 'preview'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setCenterMode(mode)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                    centerMode === mode
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setEditorTheme((t) => (t === 'vs-dark' ? 'light' : 'vs-dark'))}
              className="rounded-lg border border-slate-800 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800 whitespace-nowrap"
            >
              {editorTheme === 'vs-dark' ? 'Dark IDE' : 'Light IDE'}
            </button>

            <button
              type="button"
              onClick={() => {
                if (!activeFile) return;
                navigator.clipboard.writeText(activeFile.content);
                setCopiedCode(true);
                setTimeout(() => setCopiedCode(false), 1800);
              }}
              aria-label="Copy active file code"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-800 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
            >
              {copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{copiedCode ? 'Copied' : 'Copy'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadCode}
              aria-label="Download active file"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-800 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Download</span>
            </button>

            <button
              type="button"
              onClick={handleCreateProject}
              className="inline-flex items-center gap-1 rounded-lg bg-indigo-600/90 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New</span>
            </button>
          </div>
        </div>

        {/* Editor & Preview Split Surface */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
          {centerMode !== 'preview' && activeFile && (
            <div
              className={`${
                centerMode === 'split' ? 'h-1/2 lg:h-full lg:w-1/2 border-b lg:border-b-0 lg:border-r border-slate-800' : 'h-full w-full'
              } min-h-0 flex flex-col`}
            >
              <div className="flex items-center justify-between bg-[#0B101D] px-3 py-1.5 border-b border-slate-800/70 text-[11px] text-slate-400">
                <span className="font-mono">{activeFile.name}</span>
                <span className="tabular-nums">{activeFile.content.split('\n').length} lines</span>
              </div>
              <div className="flex-1 min-h-0">
                <Editor
                  height="100%"
                  language={activeFile.language === 'html' ? 'html' : activeFile.language}
                  theme={editorTheme}
                  value={activeFile.content}
                  onChange={(value) => updateActiveFileContent(value ?? '')}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 13,
                    fontFamily: 'JetBrains Mono, monospace',
                    wordWrap: 'on',
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    padding: { top: 12 },
                  }}
                />
              </div>
            </div>
          )}

          {centerMode !== 'editor' && (
            <div
              className={`${
                centerMode === 'split' ? 'h-1/2 lg:h-full lg:w-1/2' : 'h-full w-full'
              } min-h-0 flex flex-col bg-[#070B14]`}
            >
              <div className="flex items-center justify-between bg-[#0B101D] px-3 py-1.5 border-b border-slate-800/70 text-[11px] text-slate-400">
                <div className="flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5 text-cyan-400" />
                  <span>Sandboxed Live Preview</span>
                </div>
                <span className="text-slate-500">sandbox=&quot;allow-scripts&quot;</span>
              </div>
              <iframe
                title="NOVA Code Live Preview"
                sandbox="allow-scripts"
                srcDoc={previewHtmlDocument}
                className="flex-1 w-full bg-[#070B14] border-0"
              />
            </div>
          )}
        </div>

        {/* Bottom Prompt Bar (matching "+" + input bar in sketch) */}
        <div className="border-t border-slate-800/80 bg-[#0B101D] p-3">
          <div className="flex items-center gap-2 rounded-xl border border-slate-700/80 bg-[#070B14] p-2 focus-within:border-indigo-500">
            <button
              type="button"
              onClick={() =>
                setPromptInput(
                  'Refactor into responsive semantic HTML/CSS with accessible keyboard focus states.'
                )
              }
              aria-label="Insert code prompt template"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" />
            </button>
            <input
              type="text"
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isRunningAi) {
                  e.preventDefault();
                  void handleRunCodeAi();
                }
              }}
              placeholder={`Describe how to ${selectedAction} ${activeFile?.name || 'code'}...`}
              aria-label="Code AI instruction prompt"
              className="flex-1 bg-transparent px-2 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleRunCodeAi}
              disabled={isRunningAi}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 whitespace-nowrap"
            >
              {isRunningAi ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              <span>{isRunningAi ? 'Running...' : `Run ${selectedAction}`}</span>
            </button>
          </div>
        </div>
      </section>

      {/* RIGHT PANEL: Visual-to-Code (Mini Paint + Screenshot) + Code History */}
      {rightSidebarOpen && (
        <aside
          aria-label="Visual-to-Code and Code History"
          className="w-80 max-w-[88vw] shrink-0 border-l border-slate-800/80 bg-[#0B101D] flex flex-col min-h-0 overflow-hidden max-lg:absolute max-lg:inset-y-0 max-lg:right-0 max-lg:z-40 max-lg:shadow-2xl"
        >
          {/* Top Half: Visual-to-Code Studio (per sketch) */}
          <div className="border-b border-slate-800/80 p-3.5 space-y-2.5 overflow-y-auto max-h-[60%]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Paintbrush className="h-3.5 w-3.5 text-cyan-400" />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Visual-to-Code
                </h2>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => sketchUploadRef.current?.click()}
                  aria-label="Upload UI screenshot"
                  className="rounded-md border border-slate-800 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800 inline-flex items-center gap-1"
                >
                  <Upload className="h-3 w-3" />
                  <span>Image</span>
                </button>
                <button
                  type="button"
                  onClick={handleClearCanvas}
                  aria-label="Clear sketch canvas"
                  className="rounded-md border border-slate-800 p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                >
                  <Eraser className="h-3.5 w-3.5" />
                </button>
              </div>
              <input
                ref={sketchUploadRef}
                type="file"
                accept="image/*"
                onChange={handleSketchUpload}
                className="hidden"
              />
            </div>

            <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
              <div className="flex items-center gap-1.5">
                {['#38BDF8', '#818CF8', '#34D399', '#F8FAFC'].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setBrushColor(c)}
                    aria-label={`Select brush color ${c}`}
                    className={`h-4 w-4 rounded-full border ${
                      brushColor === c ? 'border-white scale-110' : 'border-slate-700'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <label htmlFor="brush-size" className="text-[11px]">
                  Size
                </label>
                <input
                  id="brush-size"
                  type="range"
                  min={1}
                  max={8}
                  value={brushSize}
                  onChange={(e) => setBrushSize(Number(e.target.value))}
                  className="w-16 accent-cyan-400"
                />
              </div>
            </div>

            <div className="rounded-lg border border-slate-700/80 overflow-hidden bg-[#070B14]">
              <canvas
                ref={canvasRef}
                data-testid="visual-to-code-canvas"
                width={280}
                height={180}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                className="w-full h-44 cursor-crosshair touch-none block"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                aria-label="Visual-to-Code target framework"
                value={sketchTarget}
                onChange={(e) => setSketchTarget(e.target.value as 'html' | 'react')}
                className="rounded-lg border border-slate-800 bg-[#070B14] px-2 py-1.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
              >
                <option value="html">HTML + CSS</option>
                <option value="react">React + Tailwind</option>
              </select>
              <input
                type="text"
                value={sketchNotes}
                onChange={(e) => setSketchNotes(e.target.value)}
                placeholder="Notes (e.g. dark dashboard)"
                aria-label="Visual-to-Code annotations"
                className="flex-1 min-w-0 rounded-lg border border-slate-800 bg-[#070B14] px-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={handleConvertVisualToCode}
              disabled={isConvertingSketch}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-2 text-xs font-semibold text-white hover:bg-cyan-500 disabled:opacity-50 transition-colors"
            >
              {isConvertingSketch ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              <span>{isConvertingSketch ? 'Converting Sketch...' : 'Generate Code from Sketch'}</span>
            </button>
          </div>

          {/* Bottom Half: Code Project History */}
          <div className="flex-1 min-h-0 flex flex-col p-3.5 overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <History className="h-3.5 w-3.5 text-slate-400" />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Code History
                </h2>
              </div>
              <span className="text-[11px] text-slate-500 tabular-nums">{codeProjects.length}</span>
            </div>

            <input
              type="text"
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              placeholder="Filter saved projects..."
              aria-label="Filter code projects"
              className="mb-2 w-full rounded-lg border border-slate-800 bg-[#070B14] px-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
            />

            <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5">
              {filteredProjects.map((proj) => {
                const isActive = proj.id === activeProject?.id;
                return (
                  <div
                    key={proj.id}
                    className={`group flex items-center justify-between gap-2 rounded-lg border p-2.5 transition-colors ${
                      isActive
                        ? 'border-indigo-500/60 bg-indigo-500/12'
                        : 'border-slate-800/70 bg-slate-900/40 hover:border-slate-700'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveCodeProjectId(proj.id)}
                      className="flex-1 min-w-0 text-left"
                    >
                      <div className="text-xs font-medium text-slate-100 truncate">{proj.name}</div>
                      <div className="mt-0.5 text-[11px] text-slate-400 truncate">
                        {proj.files.length} file{proj.files.length === 1 ? '' : 's'} · {proj.language}
                      </div>
                    </button>
                    {codeProjects.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          openConfirm({
                            title: `Delete "${proj.name}"?`,
                            description: 'This saved code project will be permanently removed.',
                            confirmLabel: 'Delete Project',
                            destructive: true,
                            onConfirm: () => deleteCodeProject(proj.id),
                          })
                        }
                        aria-label={`Delete project ${proj.name}`}
                        className="p-1 text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      )}
    </div>
  );
};
