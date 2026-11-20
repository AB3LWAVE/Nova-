import { create } from 'zustand';
import {
  AgentActivityLog,
  AgentProfile,
  AutomationWorkflow,
  ChatMessage,
  CodeProject,
  Conversation,
  CustomWorkspaceConfig,
  HybridTelemetryEvent,
  KnowledgeDocument,
  LocalModelReadiness,
  NovaNotification,
  Persona,
  PlanRecord,
  PrivacyPreference,
  PromptTemplate,
  QuizSession,
  QuizSubject,
  RoutingMode,
  SyncQueueItem,
  WorkspaceTab,
} from '../types/nova';
import {
  BUILTIN_PERSONAS,
  INITIAL_SUBJECTS,
  SEED_AGENTS,
  SEED_AUTOMATIONS,
  SEED_CODE_PROJECTS,
  SEED_CONVERSATIONS,
  SEED_KNOWLEDGE_DOCS,
  SEED_PLANS,
  SEED_QUIZZES,
  SEED_TEMPLATES,
  SEED_WORKSPACES,
} from '../data/seedData';
import { idbGetState, idbSetState } from '../services/storage/indexedDb';

export interface ToastMessage {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  detail?: string;
}

export interface ConfirmModalState {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
}

export type ActiveOverlay =
  | null
  | 'monitor'
  | 'settings'
  | 'vault'
  | 'agents'
  | 'model_lab'
  | 'workspace_designer'
  | 'templates'
  | 'auth';

interface PersistedSlice {
  conversations: Conversation[];
  activeConversationId: string;
  customPersonas: Persona[];
  selectedModelId: string;
  selectedPersonaId: string;
  routingMode: RoutingMode;
  privacyPreference: PrivacyPreference;
  subjects: QuizSubject[];
  quizzes: QuizSession[];
  activeQuizId: string;
  codeProjects: CodeProject[];
  activeCodeProjectId: string;
  plans: PlanRecord[];
  activePlanId: string;
  knowledgeDocs: KnowledgeDocument[];
  agents: AgentProfile[];
  agentLogs: AgentActivityLog[];
  automations: AutomationWorkflow[];
  templates: PromptTemplate[];
  customWorkspaces: CustomWorkspaceConfig[];
  activeCustomWorkspaceId: string;
  syncQueue: SyncQueueItem[];
  telemetryEvents: HybridTelemetryEvent[];
  hackathonDemoMode: boolean;
  themeMode: 'dark' | 'light';
}

interface NovaStoreState extends PersistedSlice {
  activeTab: WorkspaceTab;
  leftSidebarOpen: boolean;
  rightSidebarOpen: boolean;
  focusMode: boolean;
  activeOverlay: ActiveOverlay;
  isOnline: boolean;
  localReadiness: LocalModelReadiness;
  localReadinessDetail: string;
  authUid: string | null;
  authEmail: string | null;
  authDisplayName: string | null;
  authPhotoUrl: string | null;
  hasWorkspaceToken: boolean;
  authLoading: boolean;
  hydrated: boolean;
  toasts: ToastMessage[];
  notifications: NovaNotification[];
  confirmModal: ConfirmModalState | null;

  hydrateFromStorage: () => Promise<void>;
  setActiveTab: (tab: WorkspaceTab) => void;
  setLeftSidebarOpen: (open: boolean) => void;
  setRightSidebarOpen: (open: boolean) => void;
  setFocusMode: (focus: boolean) => void;
  setActiveOverlay: (overlay: ActiveOverlay) => void;
  setIsOnline: (online: boolean) => void;
  setLocalReadiness: (readiness: LocalModelReadiness, detail: string) => void;
  setAuthUser: (
    user: { uid: string; email: string | null; displayName: string | null; photoURL: string | null } | null,
    hasWorkspaceToken: boolean
  ) => void;
  setAuthLoading: (loading: boolean) => void;
  setThemeMode: (mode: 'dark' | 'light') => void;
  setSelectedModelId: (id: string) => void;
  setSelectedPersonaId: (id: string) => void;
  setRoutingMode: (mode: RoutingMode) => void;
  setPrivacyPreference: (pref: PrivacyPreference) => void;
  setHackathonDemoMode: (enabled: boolean) => void;

  // Conversations
  setActiveConversationId: (id: string) => void;
  createConversation: (initialTitle?: string) => Conversation;
  updateConversation: (id: string, patch: Partial<Conversation>) => void;
  deleteConversation: (id: string) => void;
  appendMessage: (convId: string, msg: ChatMessage) => void;
  updateMessage: (convId: string, msgId: string, patch: Partial<ChatMessage>) => void;
  branchConversation: (convId: string, upToMessageId: string) => void;
  clearAllConversations: () => void;

  // Personas
  saveCustomPersona: (persona: Persona) => void;
  deleteCustomPersona: (id: string) => void;

  // Quiz
  addSubject: (name: string, category: string) => void;
  updateSubject: (id: string, name: string, category: string) => void;
  deleteSubject: (id: string) => void;
  saveQuizSession: (quiz: QuizSession) => void;
  setActiveQuizId: (id: string) => void;
  deleteQuizSession: (id: string) => void;

  // Code
  saveCodeProject: (project: CodeProject) => void;
  setActiveCodeProjectId: (id: string) => void;
  deleteCodeProject: (id: string) => void;

  // Plan
  savePlan: (plan: PlanRecord) => void;
  setActivePlanId: (id: string) => void;
  deletePlan: (id: string) => void;

  // Knowledge, Agents, Automations, Templates, Workspaces
  addKnowledgeDoc: (doc: KnowledgeDocument) => void;
  deleteKnowledgeDoc: (id: string) => void;
  addAgent: (agent: AgentProfile) => void;
  addAgentLog: (log: AgentActivityLog) => void;
  updateAgentLogStatus: (id: string, status: 'approved' | 'rejected') => void;
  toggleAutomation: (id: string) => void;
  updateAutomationRun: (id: string, status: 'success' | 'error', log: string) => void;
  saveTemplate: (tpl: PromptTemplate) => void;
  deleteTemplate: (id: string) => void;
  saveCustomWorkspace: (ws: CustomWorkspaceConfig) => void;
  deleteCustomWorkspace: (id: string) => void;
  setActiveCustomWorkspaceId: (id: string) => void;

  // Telemetry, Sync, Notifications, Toasts, Confirm
  addTelemetryEvent: (ev: HybridTelemetryEvent) => void;
  enqueueSync: (item: Omit<SyncQueueItem, 'id' | 'createdAt' | 'retryCount'>) => void;
  markSynced: (id: string) => void;
  incrementSyncRetry: (id: string) => void;
  pushToast: (toast: Omit<ToastMessage, 'id'>) => void;
  dismissToast: (id: string) => void;
  addNotification: (title: string, detail: string) => void;
  markAllNotificationsRead: () => void;
  openConfirm: (modal: Omit<ConfirmModalState, 'open'>) => void;
  closeConfirm: () => void;
}

const STORAGE_KEY = 'nova_workspace_persisted_v1';

function persistState(state: NovaStoreState) {
  const slice: PersistedSlice = {
    conversations: state.conversations,
    activeConversationId: state.activeConversationId,
    customPersonas: state.customPersonas,
    selectedModelId: state.selectedModelId,
    selectedPersonaId: state.selectedPersonaId,
    routingMode: state.routingMode,
    privacyPreference: state.privacyPreference,
    subjects: state.subjects,
    quizzes: state.quizzes,
    activeQuizId: state.activeQuizId,
    codeProjects: state.codeProjects,
    activeCodeProjectId: state.activeCodeProjectId,
    plans: state.plans,
    activePlanId: state.activePlanId,
    knowledgeDocs: state.knowledgeDocs,
    agents: state.agents,
    agentLogs: state.agentLogs,
    automations: state.automations,
    templates: state.templates,
    customWorkspaces: state.customWorkspaces,
    activeCustomWorkspaceId: state.activeCustomWorkspaceId,
    syncQueue: state.syncQueue,
    telemetryEvents: state.telemetryEvents.slice(0, 50),
    hackathonDemoMode: state.hackathonDemoMode,
    themeMode: state.themeMode,
  };
  void idbSetState(STORAGE_KEY, slice);
}

export const useNovaStore = create<NovaStoreState>((set, get) => ({
  activeTab: 'chat',
  leftSidebarOpen: true,
  rightSidebarOpen: true,
  focusMode: false,
  activeOverlay: null,
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  localReadiness: 'checking',
  localReadinessDetail: 'Inspecting browser support for on-device Gemini Nano...',
  authUid: null,
  authEmail: null,
  authDisplayName: null,
  authPhotoUrl: null,
  hasWorkspaceToken: false,
  authLoading: true,
  hydrated: false,
  toasts: [],
  notifications: [
    {
      id: 'notif-1',
      title: 'Hybrid AI Ready',
      detail: 'Firebase AI Logic Hybrid Inference and server-side Gemini endpoints initialized.',
      timestamp: '2026-11-20T08:00:00.000Z',
      read: false,
    },
  ],
  confirmModal: null,

  conversations: SEED_CONVERSATIONS,
  activeConversationId: SEED_CONVERSATIONS[0].id,
  customPersonas: [],
  selectedModelId: 'gemini-4-hydrogen',
  selectedPersonaId: BUILTIN_PERSONAS[0].id,
  routingMode: 'automatic',
  privacyPreference: 'standard',
  subjects: INITIAL_SUBJECTS,
  quizzes: SEED_QUIZZES,
  activeQuizId: SEED_QUIZZES[0].id,
  codeProjects: SEED_CODE_PROJECTS,
  activeCodeProjectId: SEED_CODE_PROJECTS[0].id,
  plans: SEED_PLANS,
  activePlanId: SEED_PLANS[0].id,
  knowledgeDocs: SEED_KNOWLEDGE_DOCS,
  agents: SEED_AGENTS,
  agentLogs: [],
  automations: SEED_AUTOMATIONS,
  templates: SEED_TEMPLATES,
  customWorkspaces: SEED_WORKSPACES,
  activeCustomWorkspaceId: SEED_WORKSPACES[0].id,
  syncQueue: [],
  telemetryEvents: [
    {
      id: 'tel-seed-1',
      timestamp: '2026-11-20T08:00:02.000Z',
      workspace: 'chat',
      requestedModelId: 'gemini-4-hydrogen',
      routingMode: 'automatic',
      decision: 'in_cloud',
      actualSource: 'in_cloud',
      reason: 'Seed telemetry event from Firebase AI Logic cloud baseline.',
      latencyMs: 642,
      fallbackTriggered: false,
      status: 'success',
    },
  ],
  hackathonDemoMode: true,
  themeMode: 'dark',

  hydrateFromStorage: async () => {
    const saved = await idbGetState<Partial<PersistedSlice>>(STORAGE_KEY);
    if (saved) {
      set((state) => ({
        ...state,
        ...saved,
        hydrated: true,
      }));
    } else {
      set({ hydrated: true });
    }
  },

  setActiveTab: (tab) => set({ activeTab: tab }),
  setLeftSidebarOpen: (open) => set({ leftSidebarOpen: open }),
  setRightSidebarOpen: (open) => set({ rightSidebarOpen: open }),
  setFocusMode: (focus) =>
    set((state) => ({
      focusMode: focus,
      leftSidebarOpen: focus ? false : state.leftSidebarOpen,
      rightSidebarOpen: focus ? false : state.rightSidebarOpen,
    })),
  setActiveOverlay: (overlay) => set({ activeOverlay: overlay }),
  setIsOnline: (online) => set({ isOnline: online }),
  setLocalReadiness: (readiness, detail) =>
    set({ localReadiness: readiness, localReadinessDetail: detail }),
  setAuthUser: (user, hasWorkspaceToken) =>
    set({
      authUid: user?.uid ?? null,
      authEmail: user?.email ?? null,
      authDisplayName: user?.displayName ?? null,
      authPhotoUrl: user?.photoURL ?? null,
      hasWorkspaceToken,
      authLoading: false,
    }),
  setAuthLoading: (loading) => set({ authLoading: loading }),
  setThemeMode: (mode) => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', mode === 'dark');
    }
    set({ themeMode: mode });
    persistState(get());
  },
  setSelectedModelId: (id) => {
    set({ selectedModelId: id });
    persistState(get());
  },
  setSelectedPersonaId: (id) => {
    set({ selectedPersonaId: id });
    persistState(get());
  },
  setRoutingMode: (mode) => {
    set({ routingMode: mode });
    persistState(get());
  },
  setPrivacyPreference: (pref) => {
    set({ privacyPreference: pref });
    persistState(get());
  },
  setHackathonDemoMode: (enabled) => {
    set({ hackathonDemoMode: enabled });
    persistState(get());
  },

  setActiveConversationId: (id) => {
    set({ activeConversationId: id });
    persistState(get());
  },

  createConversation: (initialTitle = 'New Hybrid Session') => {
    const state = get();
    const now = new Date().toISOString();
    const conv: Conversation = {
      id: `conv-${Date.now()}`,
      title: initialTitle,
      folder: 'General',
      pinned: false,
      archived: false,
      modelId: state.selectedModelId,
      personaId: state.selectedPersonaId,
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    set({
      conversations: [conv, ...state.conversations],
      activeConversationId: conv.id,
    });
    persistState(get());
    return conv;
  },

  updateConversation: (id, patch) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === id ? { ...c, ...patch, updatedAt: new Date().toISOString() } : c
      ),
    }));
    persistState(get());
  },

  deleteConversation: (id) => {
    set((state) => {
      const remaining = state.conversations.filter((c) => c.id !== id);
      const nextActive =
        state.activeConversationId === id ? remaining[0]?.id || '' : state.activeConversationId;
      return {
        conversations: remaining,
        activeConversationId: nextActive,
      };
    });
    persistState(get());
  },

  appendMessage: (convId, msg) => {
    set((state) => ({
      conversations: state.conversations.map((c) => {
        if (c.id !== convId) return c;
        const shouldRetitle = c.messages.length === 0 && msg.role === 'user';
        return {
          ...c,
          title: shouldRetitle ? msg.content.slice(0, 48).trim() || c.title : c.title,
          messages: [...c.messages, msg],
          updatedAt: new Date().toISOString(),
        };
      }),
    }));
    const updatedConv = get().conversations.find((c) => c.id === convId);
    if (updatedConv) {
      get().enqueueSync({
        entityType: 'conversation',
        entityId: updatedConv.id,
        action: 'upsert',
        payload: updatedConv,
      });
    }
    persistState(get());
  },

  updateMessage: (convId, msgId, patch) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === convId
          ? {
              ...c,
              messages: c.messages.map((m) => (m.id === msgId ? { ...m, ...patch } : m)),
              updatedAt: new Date().toISOString(),
            }
          : c
      ),
    }));
    persistState(get());
  },

  branchConversation: (convId, upToMessageId) => {
    const source = get().conversations.find((c) => c.id === convId);
    if (!source) return;
    const idx = source.messages.findIndex((m) => m.id === upToMessageId);
    const sliced = idx >= 0 ? source.messages.slice(0, idx + 1) : source.messages;
    const now = new Date().toISOString();
    const branched: Conversation = {
      ...source,
      id: `conv-branch-${Date.now()}`,
      title: `${source.title} (Branch)`,
      pinned: false,
      branchedFromId: source.id,
      messages: sliced,
      createdAt: now,
      updatedAt: now,
    };
    set((state) => ({
      conversations: [branched, ...state.conversations],
      activeConversationId: branched.id,
    }));
    persistState(get());
    get().pushToast({ type: 'success', title: 'Conversation Branched', detail: branched.title });
  },

  clearAllConversations: () => {
    const fresh: Conversation = {
      id: `conv-${Date.now()}`,
      title: 'Fresh NOVA Session',
      folder: 'General',
      pinned: false,
      archived: false,
      modelId: get().selectedModelId,
      personaId: get().selectedPersonaId,
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    set({ conversations: [fresh], activeConversationId: fresh.id });
    persistState(get());
  },

  saveCustomPersona: (persona) => {
    set((state) => {
      const exists = state.customPersonas.some((p) => p.id === persona.id);
      const customPersonas = exists
        ? state.customPersonas.map((p) => (p.id === persona.id ? persona : p))
        : [{ ...persona, isCustom: true }, ...state.customPersonas];
      return { customPersonas, selectedPersonaId: persona.id };
    });
    persistState(get());
  },

  deleteCustomPersona: (id) => {
    set((state) => ({
      customPersonas: state.customPersonas.filter((p) => p.id !== id),
      selectedPersonaId:
        state.selectedPersonaId === id ? BUILTIN_PERSONAS[0].id : state.selectedPersonaId,
    }));
    persistState(get());
  },

  addSubject: (name, category) => {
    const subj: QuizSubject = { id: `subj-${Date.now()}`, name, category };
    set((state) => ({ subjects: [...state.subjects, subj] }));
    persistState(get());
  },

  updateSubject: (id, name, category) => {
    set((state) => ({
      subjects: state.subjects.map((s) => (s.id === id ? { ...s, name, category } : s)),
    }));
    persistState(get());
  },

  deleteSubject: (id) => {
    set((state) => ({ subjects: state.subjects.filter((s) => s.id !== id) }));
    persistState(get());
  },

  saveQuizSession: (quiz) => {
    set((state) => {
      const exists = state.quizzes.some((q) => q.id === quiz.id);
      const quizzes = exists
        ? state.quizzes.map((q) => (q.id === quiz.id ? quiz : q))
        : [quiz, ...state.quizzes];
      return { quizzes, activeQuizId: quiz.id };
    });
    persistState(get());
  },

  setActiveQuizId: (id) => {
    set({ activeQuizId: id });
    persistState(get());
  },

  deleteQuizSession: (id) => {
    set((state) => {
      const quizzes = state.quizzes.filter((q) => q.id !== id);
      return {
        quizzes,
        activeQuizId: state.activeQuizId === id ? quizzes[0]?.id || '' : state.activeQuizId,
      };
    });
    persistState(get());
  },

  saveCodeProject: (project) => {
    set((state) => {
      const exists = state.codeProjects.some((p) => p.id === project.id);
      const codeProjects = exists
        ? state.codeProjects.map((p) => (p.id === project.id ? project : p))
        : [project, ...state.codeProjects];
      return { codeProjects, activeCodeProjectId: project.id };
    });
    persistState(get());
  },

  setActiveCodeProjectId: (id) => {
    set({ activeCodeProjectId: id });
    persistState(get());
  },

  deleteCodeProject: (id) => {
    set((state) => {
      const codeProjects = state.codeProjects.filter((p) => p.id !== id);
      return {
        codeProjects,
        activeCodeProjectId:
          state.activeCodeProjectId === id ? codeProjects[0]?.id || '' : state.activeCodeProjectId,
      };
    });
    persistState(get());
  },

  savePlan: (plan) => {
    set((state) => {
      const exists = state.plans.some((p) => p.id === plan.id);
      const plans = exists ? state.plans.map((p) => (p.id === plan.id ? plan : p)) : [plan, ...state.plans];
      return { plans, activePlanId: plan.id };
    });
    persistState(get());
  },

  setActivePlanId: (id) => {
    set({ activePlanId: id });
    persistState(get());
  },

  deletePlan: (id) => {
    set((state) => {
      const plans = state.plans.filter((p) => p.id !== id);
      return {
        plans,
        activePlanId: state.activePlanId === id ? plans[0]?.id || '' : state.activePlanId,
      };
    });
    persistState(get());
  },

  addKnowledgeDoc: (doc) => {
    set((state) => ({ knowledgeDocs: [doc, ...state.knowledgeDocs] }));
    persistState(get());
  },

  deleteKnowledgeDoc: (id) => {
    set((state) => ({ knowledgeDocs: state.knowledgeDocs.filter((d) => d.id !== id) }));
    persistState(get());
  },

  addAgent: (agent) => {
    set((state) => ({ agents: [agent, ...state.agents] }));
    persistState(get());
  },

  addAgentLog: (log) => {
    set((state) => ({ agentLogs: [log, ...state.agentLogs].slice(0, 40) }));
    persistState(get());
  },

  updateAgentLogStatus: (id, status) => {
    set((state) => ({
      agentLogs: state.agentLogs.map((l) => (l.id === id ? { ...l, approvalStatus: status } : l)),
    }));
    persistState(get());
  },

  toggleAutomation: (id) => {
    set((state) => ({
      automations: state.automations.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a)),
    }));
    persistState(get());
  },

  updateAutomationRun: (id, status, log) => {
    set((state) => ({
      automations: state.automations.map((a) =>
        a.id === id
          ? { ...a, lastRunAt: new Date().toISOString(), lastStatus: status, lastLog: log }
          : a
      ),
    }));
    persistState(get());
  },

  saveTemplate: (tpl) => {
    set((state) => {
      const exists = state.templates.some((t) => t.id === tpl.id);
      return {
        templates: exists
          ? state.templates.map((t) => (t.id === tpl.id ? tpl : t))
          : [tpl, ...state.templates],
      };
    });
    persistState(get());
  },

  deleteTemplate: (id) => {
    set((state) => ({ templates: state.templates.filter((t) => t.id !== id) }));
    persistState(get());
  },

  saveCustomWorkspace: (ws) => {
    set((state) => {
      const base = ws.isDefault
        ? state.customWorkspaces.map((w) => ({ ...w, isDefault: false }))
        : state.customWorkspaces;
      const exists = base.some((w) => w.id === ws.id);
      const customWorkspaces = exists ? base.map((w) => (w.id === ws.id ? ws : w)) : [ws, ...base];
      return { customWorkspaces, activeCustomWorkspaceId: ws.id };
    });
    persistState(get());
  },

  deleteCustomWorkspace: (id) => {
    set((state) => {
      const customWorkspaces = state.customWorkspaces.filter((w) => w.id !== id);
      return {
        customWorkspaces,
        activeCustomWorkspaceId:
          state.activeCustomWorkspaceId === id
            ? customWorkspaces[0]?.id || ''
            : state.activeCustomWorkspaceId,
      };
    });
    persistState(get());
  },

  setActiveCustomWorkspaceId: (id) => {
    set({ activeCustomWorkspaceId: id });
    persistState(get());
  },

  addTelemetryEvent: (ev) => {
    set((state) => ({ telemetryEvents: [ev, ...state.telemetryEvents].slice(0, 60) }));
    persistState(get());
  },

  enqueueSync: (item) => {
    const newItem: SyncQueueItem = {
      ...item,
      id: `sync-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toISOString(),
      retryCount: 0,
    };
    set((state) => ({
      syncQueue: [
        ...state.syncQueue.filter((q) => !(q.entityId === item.entityId && q.entityType === item.entityType)),
        newItem,
      ],
    }));
    persistState(get());
  },

  markSynced: (id) => {
    set((state) => ({
      syncQueue: state.syncQueue.filter((q) => q.id !== id),
    }));
    persistState(get());
  },

  incrementSyncRetry: (id) => {
    set((state) => ({
      syncQueue: state.syncQueue.map((q) =>
        q.id === id ? { ...q, retryCount: q.retryCount + 1 } : q
      ),
    }));
    persistState(get());
  },

  pushToast: (toast) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
    setTimeout(() => {
      get().dismissToast(id);
    }, 4500);
  },

  dismissToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  addNotification: (title, detail) =>
    set((state) => ({
      notifications: [
        {
          id: `notif-${Date.now()}`,
          title,
          detail,
          timestamp: new Date().toISOString(),
          read: false,
        },
        ...state.notifications,
      ].slice(0, 20),
    })),

  markAllNotificationsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    })),

  openConfirm: (modal) => set({ confirmModal: { ...modal, open: true } }),
  closeConfirm: () => set({ confirmModal: null }),
}));
