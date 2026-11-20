import React, { useMemo, useState } from 'react';
import {
  Activity,
  Bell,
  BookOpen,
  Bot,
  CalendarCheck,
  Code2,
  Columns2,
  FileCode2,
  GraduationCap,
  LayoutGrid,
  Maximize2,
  MessageSquare,
  Minimize2,
  PanelLeft,
  PanelRight,
  Search,
  Settings,
  Sparkles,
  User,
  WifiOff,
  X,
} from 'lucide-react';
import { useNovaStore } from '../stores/useNovaStore';
import { WorkspaceTab } from '../types/nova';

interface NovaShellProps {
  children: React.ReactNode;
}

const PRIMARY_TABS: Array<{
  id: WorkspaceTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'quiz', label: 'Quiz', icon: GraduationCap },
  { id: 'code', label: 'Code', icon: Code2 },
  { id: 'plan', label: 'Plan', icon: CalendarCheck },
];

export const NovaShell: React.FC<NovaShellProps> = ({ children }) => {
  const {
    activeTab,
    setActiveTab,
    leftSidebarOpen,
    setLeftSidebarOpen,
    rightSidebarOpen,
    setRightSidebarOpen,
    focusMode,
    setFocusMode,
    setActiveOverlay,
    isOnline,
    localReadiness,
    routingMode,
    syncQueue,
    notifications,
    markAllNotificationsRead,
    authUid,
    authDisplayName,
    authEmail,
    conversations,
    setActiveConversationId,
    quizzes,
    setActiveQuizId,
    codeProjects,
    setActiveCodeProjectId,
    plans,
    setActivePlanId,
    knowledgeDocs,
    themeMode,
  } = useNovaStore();

  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [globalQuery, setGlobalQuery] = useState('');

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const searchResults = useMemo(() => {
    const q = globalQuery.trim().toLowerCase();
    if (!q) return [];
    const results: Array<{
      id: string;
      kind: 'Chat' | 'Quiz' | 'Code' | 'Plan' | 'Vault';
      title: string;
      subtitle: string;
      onOpen: () => void;
    }> = [];

    conversations.forEach((c) => {
      if (
        c.title.toLowerCase().includes(q) ||
        c.messages.some((m) => m.content.toLowerCase().includes(q))
      ) {
        results.push({
          id: `sr-conv-${c.id}`,
          kind: 'Chat',
          title: c.title,
          subtitle: `${c.messages.length} messages · ${c.folder}`,
          onOpen: () => {
            setActiveConversationId(c.id);
            setActiveTab('chat');
            setShowSearchModal(false);
          },
        });
      }
    });

    quizzes.forEach((qz) => {
      if (qz.title.toLowerCase().includes(q) || qz.subject.toLowerCase().includes(q)) {
        results.push({
          id: `sr-quiz-${qz.id}`,
          kind: 'Quiz',
          title: qz.title,
          subtitle: `${qz.subject} · ${qz.questions.length} questions`,
          onOpen: () => {
            setActiveQuizId(qz.id);
            setActiveTab('quiz');
            setShowSearchModal(false);
          },
        });
      }
    });

    codeProjects.forEach((cp) => {
      if (cp.name.toLowerCase().includes(q) || cp.language.toLowerCase().includes(q)) {
        results.push({
          id: `sr-code-${cp.id}`,
          kind: 'Code',
          title: cp.name,
          subtitle: `${cp.files.length} files · ${cp.language}`,
          onOpen: () => {
            setActiveCodeProjectId(cp.id);
            setActiveTab('code');
            setShowSearchModal(false);
          },
        });
      }
    });

    plans.forEach((pl) => {
      if (pl.title.toLowerCase().includes(q) || pl.goal.toLowerCase().includes(q)) {
        results.push({
          id: `sr-plan-${pl.id}`,
          kind: 'Plan',
          title: pl.title,
          subtitle: `${pl.horizon} · ${pl.tasks.length} tasks`,
          onOpen: () => {
            setActivePlanId(pl.id);
            setActiveTab('plan');
            setShowSearchModal(false);
          },
        });
      }
    });

    knowledgeDocs.forEach((kd) => {
      if (kd.title.toLowerCase().includes(q) || kd.content.toLowerCase().includes(q)) {
        results.push({
          id: `sr-doc-${kd.id}`,
          kind: 'Vault',
          title: kd.title,
          subtitle: kd.collectionName,
          onOpen: () => {
            setShowSearchModal(false);
            setActiveOverlay('vault');
          },
        });
      }
    });

    return results.slice(0, 12);
  }, [
    globalQuery,
    conversations,
    quizzes,
    codeProjects,
    plans,
    knowledgeDocs,
    setActiveConversationId,
    setActiveQuizId,
    setActiveCodeProjectId,
    setActivePlanId,
    setActiveTab,
    setActiveOverlay,
  ]);

  return (
    <div
      className={`h-screen w-screen flex flex-col overflow-hidden ${
        themeMode === 'dark' ? 'bg-[#070B14] text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}
    >
      {/* Offline Banner */}
      {!isOnline && (
        <div
          role="status"
          className="bg-amber-950/90 border-b border-amber-500/40 px-4 py-1.5 text-xs text-amber-200 flex items-center justify-center gap-2"
        >
          <WifiOff className="h-3.5 w-3.5 shrink-0" />
          <span>
            Offline Mode — local IndexedDB persistence active ({syncQueue.length} queued for sync). On-device Nano:{' '}
            {localReadiness}.
          </span>
        </div>
      )}

      {/* TOP APPLICATION BAR */}
      <header className="h-14 shrink-0 border-b border-slate-800/80 bg-[#0B101D] px-3 sm:px-4 flex items-center justify-between gap-2 z-30">
        {/* Left: Brand Identity + Sidebar Toggle */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}
            aria-label="Toggle left contextual panel"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors"
          >
            <PanelLeft className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-2 select-none">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-400 text-white shadow-sm">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-sm font-bold tracking-tight text-slate-100">NOVA</span>
              <span className="hidden md:inline text-[11px] font-medium text-cyan-400">AI Workspace</span>
            </div>
          </div>
        </div>

        {/* Center: Primary 4 Workspace Tabs on >= sm */}
        <nav
          aria-label="Primary Workspaces"
          className="hidden sm:flex items-center gap-1 rounded-xl border border-slate-800/90 bg-[#070B14] p-1"
        >
          {PRIMARY_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-all ${
                  active
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right: Hybrid AI Status, Smart Search, Tools, Notifications, Account, Settings (separate!) */}
        <div className="flex items-center gap-1.5 shrink-0 relative">
          <button
            type="button"
            onClick={() => setActiveOverlay('monitor')}
            aria-label="Open Hybrid AI Monitor"
            className="hidden md:inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-[#070B14] px-2.5 py-1.5 text-xs text-slate-200 hover:border-cyan-500/60 transition-colors whitespace-nowrap shrink-0"
          >
            <Activity className="h-3.5 w-3.5 text-cyan-400" />
            <span className="capitalize">{routingMode}</span>
            <span className="text-slate-500" aria-hidden="true">·</span>
            <span className={localReadiness === 'available' ? 'text-emerald-400' : 'text-amber-400'}>
              {localReadiness === 'available' ? 'Nano' : 'Cloud'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setShowSearchModal(true)}
            aria-label="Smart search across workspaces"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors"
          >
            <Search className="h-4 w-4" />
          </button>

          {/* Tools Menu (Knowledge Vault, Agents, Model Lab, Designer, Templates) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowToolsMenu((v) => !v)}
              aria-expanded={showToolsMenu}
              aria-label="Open NOVA productivity tools"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-[#070B14] px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 whitespace-nowrap"
            >
              <LayoutGrid className="h-3.5 w-3.5 text-indigo-400" />
              <span className="hidden lg:inline">Tools</span>
            </button>

            {showToolsMenu && (
              <div className="absolute right-0 mt-2 w-60 rounded-xl border border-slate-700 bg-[#0D1322] p-1.5 shadow-2xl z-50">
                {[
                  { id: 'monitor' as const, label: 'Hybrid AI Monitor & Demo', icon: Activity },
                  { id: 'vault' as const, label: 'Knowledge Vault & Docs', icon: BookOpen },
                  { id: 'agents' as const, label: 'Agents & Automations', icon: Bot },
                  { id: 'model_lab' as const, label: 'Model Lab Comparison', icon: Columns2 },
                  { id: 'workspace_designer' as const, label: 'AI Workspace Designer', icon: LayoutGrid },
                  { id: 'templates' as const, label: 'Prompt & Studio Templates', icon: FileCode2 },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveOverlay(item.id);
                        setShowToolsMenu(false);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 text-left"
                    >
                      <Icon className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Focus Mode */}
          <button
            type="button"
            onClick={() => setFocusMode(!focusMode)}
            aria-label={focusMode ? 'Exit focus mode' : 'Enter focus mode'}
            className="hidden sm:inline-flex rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors"
          >
            {focusMode ? <Minimize2 className="h-4 w-4 text-cyan-400" /> : <Maximize2 className="h-4 w-4" />}
          </button>

          {/* Notifications */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowNotifications((v) => !v);
                markAllNotificationsRead();
              }}
              aria-label="Open notifications"
              className="relative rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-cyan-400" />
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-72 rounded-xl border border-slate-700 bg-[#0D1322] p-3 shadow-2xl z-50 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
                  <span>Notifications</span>
                  <button
                    type="button"
                    onClick={() => setShowNotifications(false)}
                    aria-label="Close notifications"
                    className="text-slate-400 hover:text-slate-200"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="max-h-56 overflow-y-auto space-y-2">
                  {notifications.map((n) => (
                    <div key={n.id} className="rounded-lg bg-[#070B14] p-2.5 text-xs">
                      <div className="font-medium text-slate-100">{n.title}</div>
                      <div className="mt-0.5 text-[11px] text-slate-400">{n.detail}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Account Menu Button */}
          <button
            type="button"
            onClick={() => setActiveOverlay('auth')}
            aria-label={authUid ? `Account ${authDisplayName || authEmail}` : 'Sign in with Google'}
            className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-[#070B14] px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-800 whitespace-nowrap"
          >
            <User className="h-3.5 w-3.5 text-indigo-400" />
            <span className="max-w-[90px] truncate">
              {authUid ? authDisplayName?.split(' ')[0] || 'Account' : 'Sign In'}
            </span>
          </button>

          {/* Dedicated Settings Button (explicitly separate from Chat History per sketch) */}
          <button
            type="button"
            onClick={() => setActiveOverlay('settings')}
            aria-label="Open Workspace Settings"
            className="rounded-lg border border-slate-800 bg-[#070B14] p-1.5 text-slate-300 hover:border-indigo-500/60 hover:text-white transition-colors"
          >
            <Settings className="h-4 w-4" />
          </button>

          {/* Right Panel Toggle */}
          <button
            type="button"
            onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
            aria-label="Toggle right history panel"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors"
          >
            <PanelRight className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Mobile Primary Workspace Tabs (<640px) — unclipped, full-width 4-column bar */}
      <nav
        aria-label="Mobile Workspaces"
        className="sm:hidden shrink-0 grid grid-cols-4 gap-1 border-b border-slate-800/80 bg-[#0B101D] px-2 py-1.5 z-20"
      >
        {PRIMARY_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-semibold transition-colors ${
                active
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* MAIN WORKSPACE CONTENT */}
      <main className="flex-1 min-h-0 flex overflow-hidden relative">{children}</main>

      {/* SMART SEARCH MODAL */}
      {showSearchModal && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/75 backdrop-blur-sm pt-20 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Smart Search"
        >
          <div className="w-full max-w-xl rounded-2xl border border-slate-700 bg-[#0B101D] p-4 shadow-2xl space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2.5">
              <Search className="h-4 w-4 text-cyan-400 shrink-0" />
              <input
                autoFocus
                type="text"
                value={globalQuery}
                onChange={(e) => setGlobalQuery(e.target.value)}
                placeholder="Search chats, quizzes, code projects, plans, and Knowledge Vault..."
                aria-label="Global workspace search query"
                className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowSearchModal(false)}
                aria-label="Close smart search"
                className="rounded p-1 text-slate-400 hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto space-y-1.5">
              {!globalQuery.trim() ? (
                <p className="py-6 text-center text-xs text-slate-500">
                  Type a keyword to jump directly to any conversation, quiz, code project, plan, or document.
                </p>
              ) : searchResults.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-500">No matching workspace items found.</p>
              ) : (
                searchResults.map((res) => (
                  <button
                    key={res.id}
                    type="button"
                    onClick={res.onOpen}
                    className="w-full flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-[#070B14] px-3 py-2.5 text-left hover:border-indigo-500/60"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-100 truncate">{res.title}</div>
                      <div className="text-[11px] text-slate-400 truncate">{res.subtitle}</div>
                    </div>
                    <span className="text-[11px] font-medium text-cyan-400 shrink-0">
                      {res.kind}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
