import {
  AIModelDefinition,
  AgentProfile,
  AutomationWorkflow,
  CodeProject,
  Conversation,
  CustomWorkspaceConfig,
  KnowledgeDocument,
  Persona,
  PlanRecord,
  PromptTemplate,
  QuizSession,
  QuizSubject,
} from '../types/nova';

export const NOVA_MODELS: AIModelDefinition[] = [
  {
    id: 'gemini-nano-4',
    name: 'Gemini Nano 4 (On-Device)',
    provider: 'Chrome Built-in AI · Firebase AI Logic',
    location: 'on-device',
    availability: 'conditional',
    contextWindow: '4K tokens',
    capabilities: ['Offline Text', 'Zero-Cost Local', 'Privacy-First'],
    description: 'Executes locally in supported Chrome environments via Firebase AI Logic Hybrid Inference.',
  },
  {
    id: 'gemini-4-hydrogen',
    name: 'Gemini 4 Hydrogen',
    provider: 'Firebase AI Logic · Gemini API',
    location: 'cloud',
    availability: 'ready',
    contextWindow: '1M tokens',
    capabilities: ['Text', 'Images', 'Video', 'Structured JSON', 'Visual-to-Code'],
    description: 'Balanced multimodal cloud model for general reasoning, document synthesis, and visual coding.',
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash-Lite',
    provider: 'Gemini API',
    location: 'cloud',
    availability: 'ready',
    contextWindow: '1M tokens',
    capabilities: ['Low-Latency Text', 'Fast Edits', 'Quick Summaries'],
    description: 'Optimized for sub-second responses and high-throughput interactive tasks.',
  },
  {
    id: 'gemini-4-neon',
    name: 'Gemini 4 Neon',
    provider: 'Gemini API (Paid Key)',
    location: 'cloud',
    availability: 'requires_paid_key',
    contextWindow: '1M tokens',
    capabilities: ['Complex Coding', 'STEM', 'Advanced Multimodal'],
    description: 'Requires a billing-enabled paid Gemini API key in Settings > Secrets.',
  },
  {
    id: 'gemini-4-carbon',
    name: 'Gemini 4 Carbon',
    provider: 'Gemini API (Paid Key)',
    location: 'cloud',
    availability: 'requires_paid_key',
    contextWindow: '1M tokens',
    capabilities: ['Deep Thinking', 'Root-Cause Debugging', 'Architecture'],
    description: 'High-depth reasoning model requiring a billing-enabled paid Gemini API key.',
  },
  {
    id: 'custom-endpoint',
    name: 'Custom Model Endpoint',
    provider: 'BYO OpenAI-Compatible Adapter',
    location: 'custom',
    availability: 'unconfigured',
    contextWindow: 'Configurable',
    capabilities: ['Extension Boundary'],
    description: 'Future integration slot for self-hosted or enterprise inference endpoints.',
  },
];

export const BUILTIN_PERSONAS: Persona[] = [
  {
    id: 'general-assistant',
    name: 'General Assistant',
    role: 'All-Purpose Copilot',
    instructions: 'Provide clear, structured, and accurate assistance across writing, analysis, and problem-solving.',
    preferredModelId: 'gemini-4-hydrogen',
    responseStyle: 'balanced',
  },
  {
    id: 'research-assistant',
    name: 'Research Assistant',
    role: 'Evidence Synthesizer',
    instructions: 'Distinguish verified facts from assumptions, highlight methodology gaps, and structure findings with citations.',
    preferredModelId: 'gemini-4-hydrogen',
    responseStyle: 'detailed',
  },
  {
    id: 'programmer',
    name: 'Programmer',
    role: 'Systems & Frontend Engineer',
    instructions: 'Write clean, typed, idiomatic code with edge-case handling and concise architectural rationale.',
    preferredModelId: 'gemini-4-hydrogen',
    responseStyle: 'concise',
  },
  {
    id: 'teacher',
    name: 'Teacher',
    role: 'Concept Guide',
    instructions: 'Break complex topics into intuitive steps using concrete analogies and quick comprehension checks.',
    preferredModelId: 'gemini-nano-4',
    responseStyle: 'balanced',
  },
  {
    id: 'math-tutor',
    name: 'Mathematics Tutor',
    role: 'Step-by-Step Solver',
    instructions: 'Walk through derivations step by step, verify units and algebraic steps, and prompt the learner to check each step.',
    preferredModelId: 'gemini-4-hydrogen',
    responseStyle: 'detailed',
  },
  {
    id: 'writer',
    name: 'Writer',
    role: 'Editorial Strategist',
    instructions: 'Craft crisp, engaging prose with strong structure, active voice, and zero filler.',
    preferredModelId: 'gemini-3.1-flash-lite',
    responseStyle: 'balanced',
  },
  {
    id: 'business-analyst',
    name: 'Business Analyst',
    role: 'Decision & KPI Strategist',
    instructions: 'Frame trade-offs quantitatively, identify risks, and structure recommendations into actionable decisions.',
    preferredModelId: 'gemini-4-hydrogen',
    responseStyle: 'concise',
  },
  {
    id: 'creative-thinker',
    name: 'Creative Thinker',
    role: 'Divergent Ideator',
    instructions: 'Explore non-obvious angles, lateral connections, and memorable product concepts.',
    preferredModelId: 'gemini-4-hydrogen',
    responseStyle: 'balanced',
  },
  {
    id: 'study-assistant',
    name: 'Study Assistant',
    role: 'Active Recall Coach',
    instructions: 'Turn notes into active recall prompts, spaced-repetition schedules, and concise exam summaries.',
    preferredModelId: 'gemini-nano-4',
    responseStyle: 'concise',
  },
];

export const INITIAL_SUBJECTS: QuizSubject[] = [
  { id: 'subj-math', name: 'Mathematics', category: 'STEM' },
  { id: 'subj-phys', name: 'Physics', category: 'STEM' },
  { id: 'subj-chem', name: 'Chemistry', category: 'STEM' },
  { id: 'subj-bio', name: 'Biology', category: 'Life Sciences' },
  { id: 'subj-cs', name: 'Computer Science', category: 'Engineering' },
  { id: 'subj-eng', name: 'English', category: 'Humanities' },
  { id: 'subj-hist', name: 'History', category: 'Humanities' },
];

export const SEED_CONVERSATIONS: Conversation[] = [
  {
    id: 'conv-hybrid-demo',
    title: 'Hybrid AI Architecture Overview',
    folder: 'Hackathon',
    pinned: true,
    archived: false,
    modelId: 'gemini-4-hydrogen',
    personaId: 'general-assistant',
    createdAt: '2026-11-20T08:00:00.000Z',
    updatedAt: '2026-11-20T08:02:00.000Z',
    messages: [
      {
        id: 'msg-1',
        role: 'user',
        content: 'Explain how NOVA routes prompts between on-device Gemini Nano and Firebase AI Logic cloud models.',
        createdAt: '2026-11-20T08:00:00.000Z',
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content:
          'NOVA uses **Firebase AI Logic Hybrid Inference** (`InferenceMode`) paired with a transparent router:\n\n1. **Readiness Check**: Inspects Chrome Built-in AI (`LanguageModel` / `window.ai`) availability.\n2. **Policy & Complexity Gate**: Routes simple, privacy-sensitive text tasks on-device when Gemini Nano is ready, and routes multimodal, long-context, or fallback requests to Cloud Gemini (`gemini-4-hydrogen` / `gemini-3.1-flash-lite`).\n3. **Live Telemetry**: Every inference records the genuine `inferenceSource` (`on_device` vs `in_cloud`) and latency in the **Hybrid AI Monitor**.',
        createdAt: '2026-11-20T08:00:02.000Z',
        modelId: 'gemini-4-hydrogen',
        executionSource: 'in_cloud',
        latencyMs: 642,
        verificationStatus: 'none',
      },
    ],
  },
  {
    id: 'conv-cs-notes',
    title: 'Distributed Consensus Study Guide',
    folder: 'University CS',
    pinned: false,
    archived: false,
    modelId: 'gemini-3.1-flash-lite',
    personaId: 'study-assistant',
    createdAt: '2026-11-19T18:10:00.000Z',
    updatedAt: '2026-11-19T18:12:00.000Z',
    messages: [
      {
        id: 'msg-cs-1',
        role: 'user',
        content: 'Summarize the key difference between Raft leader election and Paxos.',
        createdAt: '2026-11-19T18:10:00.000Z',
      },
      {
        id: 'msg-cs-2',
        role: 'assistant',
        content:
          'Raft decomposes consensus into **leader election**, **log replication**, and **safety**, enforcing that only nodes with the most up-to-date log can win an election. Classic Multi-Paxos allows any proposer to compete and permits out-of-order log gaps that must be reconciled later.',
        createdAt: '2026-11-19T18:10:01.000Z',
        modelId: 'gemini-3.1-flash-lite',
        executionSource: 'in_cloud',
        latencyMs: 380,
        verificationStatus: 'none',
      },
    ],
  },
];

export const SEED_QUIZZES: QuizSession[] = [
  {
    id: 'quiz-seed-1',
    title: 'Algorithms & Complexity Check',
    subject: 'Computer Science',
    quizType: 'multiple_choice',
    difficulty: 'intermediate',
    timeLimitMinutes: 10,
    includeExplanations: true,
    includeAnswerKey: true,
    status: 'draft',
    score: null,
    createdAt: '2026-11-20T07:30:00.000Z',
    questions: [
      {
        id: 'q1',
        type: 'multiple_choice',
        prompt: 'What is the worst-case time complexity of binary search on a sorted array of n elements?',
        options: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'],
        correctAnswer: 'O(log n)',
        explanation: 'Each comparison halves the remaining search interval, requiring at most log2(n) + 1 comparisons.',
      },
      {
        id: 'q2',
        type: 'multiple_choice',
        prompt: 'Which data structure provides amortized O(1) lookup by key?',
        options: ['Binary Search Tree', 'Linked List', 'Hash Table', 'Min-Heap'],
        correctAnswer: 'Hash Table',
        explanation: 'A well-sized hash table maps keys directly to bucket indices in expected constant time.',
      },
      {
        id: 'q3',
        type: 'true_false',
        prompt: 'Breadth-First Search (BFS) guarantees the shortest path in an unweighted graph.',
        options: ['True', 'False'],
        correctAnswer: 'True',
        explanation: 'BFS explores vertices in non-decreasing order of edge distance from the source.',
      },
    ],
    userAnswers: {},
  },
];

export const SEED_CODE_PROJECTS: CodeProject[] = [
  {
    id: 'code-seed-1',
    name: 'Hybrid Status Widget',
    language: 'html',
    activeFileId: 'file-index',
    updatedAt: '2026-11-20T07:45:00.000Z',
    lastSummary: 'Responsive HTML + CSS card preview ready for Visual-to-Code iteration.',
    files: [
      {
        id: 'file-index',
        name: 'index.html',
        language: 'html',
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: #070b14;
      color: #f1f5f9;
      font-family: system-ui, sans-serif;
    }
    .panel {
      width: 340px;
      padding: 24px;
      border-radius: 16px;
      background: #0f172a;
      border: 1px solid rgba(99, 102, 241, 0.35);
    }
    .label {
      font-size: 12px;
      color: #38bdf8;
      letter-spacing: 0.04em;
    }
    h2 { margin: 8px 0 6px; font-size: 20px; }
    p { margin: 0 0 18px; color: #94a3b8; font-size: 14px; line-height: 1.5; }
    button {
      width: 100%;
      padding: 10px 14px;
      border: 0;
      border-radius: 10px;
      background: #6366f1;
      color: #fff;
      font-weight: 600;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div class="panel">
    <div class="label">HYBRID INFERENCE</div>
    <h2>NOVA Edge + Cloud</h2>
    <p>Sandboxed live preview rendered from Code Studio. Draw a UI in Visual-to-Code to regenerate this view.</p>
    <button onclick="document.querySelector('h2').textContent='Preview Verified'">Verify Preview</button>
  </div>
</body>
</html>`,
      },
      {
        id: 'file-router',
        name: 'router.ts',
        language: 'typescript',
        content: `export function chooseRoute(isOnline: boolean, localReady: boolean) {
  if (localReady) return 'on_device';
  return isOnline ? 'in_cloud' : 'offline_blocked';
}`,
      },
    ],
  },
];

export const SEED_PLANS: PlanRecord[] = [
  {
    id: 'plan-seed-1',
    title: 'Firebase #BuildHybridAI Hackathon Sprint',
    horizon: 'weekly',
    goal: 'Ship NOVA AI Workspace with working Firebase AI Logic Hybrid Inference, 4 Studios, and live demo script.',
    summary: 'Structured 4-milestone execution plan synced across Kanban, Timeline, and Calendar views.',
    updatedAt: '2026-11-20T07:50:00.000Z',
    tasks: [
      {
        id: 't1',
        title: 'Verify Gemini Nano on-device readiness & fallback telemetry',
        notes: 'Test Automatic, Local-first, and Cloud-first modes in Hybrid AI Monitor.',
        priority: 'urgent',
        status: 'done',
        estimatedMinutes: 45,
        dueDate: '2026-11-20',
        milestone: 'Hybrid Core',
      },
      {
        id: 't2',
        title: 'Run Computer Science practice quiz in Quiz Studio',
        notes: 'Use built-in calculator and scratchpad tools, then export score to Google Sheets.',
        priority: 'high',
        status: 'in_progress',
        estimatedMinutes: 30,
        dueDate: '2026-11-21',
        milestone: 'Quiz Studio',
        dependsOn: 't1',
      },
      {
        id: 't3',
        title: 'Sketch login layout in Visual-to-Code canvas',
        notes: 'Convert hand-drawn wireframe into responsive HTML and verify sandboxed preview.',
        priority: 'high',
        status: 'todo',
        estimatedMinutes: 40,
        dueDate: '2026-11-22',
        milestone: 'Code Studio',
      },
      {
        id: 't4',
        title: 'Schedule final hackathon walkthrough on Google Calendar',
        notes: 'Sync milestone deadline and create project slide outline.',
        priority: 'medium',
        status: 'todo',
        estimatedMinutes: 25,
        dueDate: '2026-11-23',
        milestone: 'Submission',
        dependsOn: 't3',
      },
    ],
  },
];

export const SEED_KNOWLEDGE_DOCS: KnowledgeDocument[] = [
  {
    id: 'doc-hybrid-spec',
    collectionName: 'Firebase AI Logic',
    title: 'Hybrid Inference Routing Specification',
    mimeType: 'text/markdown',
    tags: ['firebase', 'gemini-nano', 'hybrid'],
    createdAt: '2026-11-20T07:00:00.000Z',
    summary: 'Defines PREFER_ON_DEVICE, ONLY_ON_DEVICE, PREFER_IN_CLOUD, and ONLY_IN_CLOUD routing semantics.',
    content:
      'Firebase AI Logic supports hybrid inference on web using Chrome Built-in AI (Gemini Nano) as the on-device provider and Gemini Developer API models in the cloud. When InferenceMode.PREFER_ON_DEVICE is used, text requests execute locally if Gemini Nano is available and automatically fall back to cloud Gemini if the local model is unavailable or unsupported (e.g., multimodal image/video payloads).',
  },
  {
    id: 'doc-study-notes',
    collectionName: 'Computer Science',
    title: 'CAP Theorem & Consensus Notes',
    mimeType: 'text/plain',
    tags: ['distributed-systems', 'study'],
    createdAt: '2026-11-19T20:00:00.000Z',
    summary: 'Concise overview of Consistency, Availability, Partition Tolerance, and Raft safety guarantees.',
    content:
      'Under a network partition (P), a distributed data store must choose between linearizable Consistency (C) and 100% Availability (A). Raft ensures state machine safety by requiring leader election quorums to contain all committed log entries.',
  },
];

export const SEED_AGENTS: AgentProfile[] = [
  {
    id: 'agent-architect',
    name: 'Systems Architect',
    role: 'Decomposes requirements & evaluates trade-offs',
    instructions: 'Analyze technical constraints, propose modular boundaries, and flag security risks.',
    preferredModelId: 'gemini-4-hydrogen',
    requiresApproval: false,
  },
  {
    id: 'agent-verifier',
    name: 'Evidence Auditor',
    role: 'Checks factual claims against Knowledge Vault',
    instructions: 'Inspect claims strictly against source documents; mark unsupported claims for human review.',
    preferredModelId: 'gemini-3.1-flash-lite',
    requiresApproval: true,
  },
];

export const SEED_AUTOMATIONS: AutomationWorkflow[] = [
  {
    id: 'auto-1',
    name: 'Quiz Score -> Study Plan Adjustment',
    trigger: 'When a Quiz Studio session completes below 75%',
    action: 'Generate targeted remediation tasks in Plan Studio',
    enabled: true,
    lastStatus: 'idle',
  },
  {
    id: 'auto-2',
    name: 'Offline Queue -> Cloud Sync',
    trigger: 'When browser connectivity transitions from Offline to Online',
    action: 'Flush IndexedDB pending queue to Firestore and Cloud SQL',
    enabled: true,
    lastStatus: 'idle',
  },
];

export const SEED_TEMPLATES: PromptTemplate[] = [
  {
    id: 'tpl-1',
    category: 'prompt',
    title: 'Architecture Trade-off Analysis',
    content: 'Compare two architectural approaches for [topic] across latency, offline resilience, security, and maintainability.',
  },
  {
    id: 'tpl-2',
    category: 'quiz',
    title: 'University Exam Prep',
    content: 'Create conceptual and applied questions covering core definitions, edge cases, and real-world debugging.',
  },
  {
    id: 'tpl-3',
    category: 'code',
    title: 'Accessible React Component',
    content: 'Build a responsive, keyboard-accessible UI component with semantic HTML and clean CSS variables.',
  },
  {
    id: 'tpl-4',
    category: 'plan',
    title: '7-Day Sprint Schedule',
    content: 'Break down the objective into daily 45-minute deep work blocks with explicit milestones and dependencies.',
  },
];

export const SEED_WORKSPACES: CustomWorkspaceConfig[] = [
  {
    id: 'ws-default-nova',
    name: 'NOVA Standard Studio',
    description: 'Default 3-panel hybrid workspace across Chat, Quiz, Code, and Plan.',
    primaryTab: 'chat',
    isDefault: true,
    updatedAt: '2026-11-20T07:00:00.000Z',
    widgets: [
      { id: 'w1', type: 'chat', title: 'Hybrid Chat', zone: 'center', visible: true, widthPct: 55 },
      { id: 'w2', type: 'hybrid_monitor', title: 'Hybrid AI Monitor', zone: 'left', visible: true, widthPct: 22 },
      { id: 'w3', type: 'knowledge', title: 'Knowledge & History', zone: 'right', visible: true, widthPct: 23 },
    ],
  },
];
