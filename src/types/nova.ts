export type WorkspaceTab = 'chat' | 'quiz' | 'code' | 'plan';

export type RoutingMode = 'automatic' | 'local-first' | 'cloud-first';
export type PrivacyPreference = 'standard' | 'local-first' | 'strict-local';
export type LocalModelReadiness = 'available' | 'downloadable' | 'downloading' | 'unavailable' | 'checking';
export type ExecutionSource = 'on_device' | 'in_cloud' | 'hybrid_fallback' | 'blocked_offline';

export interface AIModelDefinition {
  id: string;
  name: string;
  provider: string;
  location: 'on-device' | 'cloud' | 'custom';
  availability: 'ready' | 'conditional' | 'requires_paid_key' | 'unconfigured';
  contextWindow: string;
  capabilities: string[];
  description: string;
}

export interface Persona {
  id: string;
  name: string;
  role: string;
  instructions: string;
  preferredModelId?: string;
  responseStyle: 'concise' | 'balanced' | 'detailed';
  isCustom?: boolean;
}

export type VerificationStatus = 'verified' | 'needs_review' | 'corrected' | 'pending' | 'none';

export interface ClaimVerification {
  claim: string;
  status: VerificationStatus;
  evidenceCitation: string;
  suggestedCorrection?: string;
}

export interface AttachmentItem {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  base64Data?: string;
  textPreview?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  modelId?: string;
  executionSource?: ExecutionSource;
  latencyMs?: number;
  feedback?: 'up' | 'down' | null;
  attachments?: AttachmentItem[];
  verificationStatus?: VerificationStatus;
  claims?: ClaimVerification[];
  verificationNote?: string;
}

export interface Conversation {
  id: string;
  title: string;
  folder: string;
  pinned: boolean;
  archived: boolean;
  modelId: string;
  personaId: string;
  messages: ChatMessage[];
  branchedFromId?: string;
  createdAt: string;
  updatedAt: string;
}

export type QuizType =
  | 'multiple_choice'
  | 'true_false'
  | 'short_answer'
  | 'fill_blank'
  | 'mixed'
  | 'essay';

export type QuizDifficulty = 'beginner' | 'intermediate' | 'advanced' | 'expert';

export interface QuizSubject {
  id: string;
  name: string;
  category: string;
}

export interface QuizQuestion {
  id: string;
  type: string;
  prompt: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export interface QuizSession {
  id: string;
  title: string;
  subject: string;
  quizType: QuizType;
  difficulty: QuizDifficulty;
  timeLimitMinutes: number;
  includeExplanations: boolean;
  includeAnswerKey: boolean;
  questions: QuizQuestion[];
  userAnswers: Record<string, string>;
  score: number | null;
  status: 'draft' | 'in_progress' | 'paused' | 'completed';
  createdAt: string;
}

export interface CodeFile {
  id: string;
  name: string;
  language: string;
  content: string;
}

export interface CodeProject {
  id: string;
  name: string;
  language: string;
  files: CodeFile[];
  activeFileId: string;
  sourceSketchDataUrl?: string | null;
  lastSummary?: string;
  updatedAt: string;
}

export type PlanHorizon = 'daily' | 'weekly' | 'monthly' | 'project' | 'study';
export type PlanViewMode = 'list' | 'kanban' | 'calendar' | 'timeline' | 'agenda';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'todo' | 'in_progress' | 'done';

export interface PlanTask {
  id: string;
  title: string;
  notes?: string;
  priority: TaskPriority;
  status: TaskStatus;
  estimatedMinutes: number;
  dueDate: string;
  milestone: string;
  dependsOn?: string;
}

export interface PlanRecord {
  id: string;
  title: string;
  horizon: PlanHorizon;
  goal: string;
  summary: string;
  tasks: PlanTask[];
  updatedAt: string;
}

export interface HybridTelemetryEvent {
  id: string;
  timestamp: string;
  workspace: WorkspaceTab | 'lab' | 'vault' | 'agents' | 'designer';
  requestedModelId: string;
  routingMode: RoutingMode;
  decision: 'on_device' | 'in_cloud';
  actualSource: ExecutionSource;
  reason: string;
  latencyMs: number;
  fallbackTriggered: boolean;
  status: 'success' | 'error';
  errorMessage?: string;
}

export interface KnowledgeDocument {
  id: string;
  collectionName: string;
  title: string;
  mimeType: string;
  content: string;
  summary?: string;
  tags: string[];
  createdAt: string;
}

export interface AgentProfile {
  id: string;
  name: string;
  role: string;
  instructions: string;
  preferredModelId: string;
  requiresApproval: boolean;
}

export interface AgentActivityLog {
  id: string;
  agentId: string;
  agentName: string;
  task: string;
  output: string;
  approvalStatus: 'pending_approval' | 'approved' | 'rejected';
  timestamp: string;
}

export interface AutomationWorkflow {
  id: string;
  name: string;
  trigger: string;
  action: string;
  enabled: boolean;
  lastRunAt?: string;
  lastStatus?: 'success' | 'error' | 'idle';
  lastLog?: string;
}

export interface WorkspaceWidget {
  id: string;
  type: 'chat' | 'quiz' | 'code' | 'plan' | 'knowledge' | 'hybrid_monitor' | 'notes' | 'visual_to_code';
  title: string;
  zone: 'left' | 'center' | 'right';
  visible: boolean;
  widthPct: number;
}

export interface CustomWorkspaceConfig {
  id: string;
  name: string;
  description: string;
  primaryTab: WorkspaceTab;
  isDefault: boolean;
  widgets: WorkspaceWidget[];
  updatedAt: string;
}

export interface PromptTemplate {
  id: string;
  category: 'prompt' | 'quiz' | 'code' | 'plan';
  title: string;
  content: string;
}

export interface NovaNotification {
  id: string;
  title: string;
  detail: string;
  timestamp: string;
  read: boolean;
}

export interface SyncQueueItem {
  id: string;
  entityType: 'conversation' | 'quiz' | 'codeProject' | 'plan' | 'workspace';
  entityId: string;
  action: 'upsert' | 'delete';
  payload: unknown;
  createdAt: string;
  retryCount: number;
  conflict?: boolean;
}
