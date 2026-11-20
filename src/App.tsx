import { useEffect } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ConfirmDialog } from './components/ConfirmDialog';
import { ToastContainer } from './components/ToastContainer';
import { NovaShell } from './layouts/NovaShell';
import { ChatWorkspace } from './workspaces/chat/ChatWorkspace';
import { QuizWorkspace } from './workspaces/quiz/QuizWorkspace';
import { CodeWorkspace } from './workspaces/code/CodeWorkspace';
import { PlanWorkspace } from './workspaces/plan/PlanWorkspace';
import { HybridMonitorModal } from './features/hybrid-ai/HybridMonitorModal';
import { KnowledgeVaultModal } from './features/knowledge/KnowledgeVaultModal';
import { AgentsAndAutomationsModal } from './features/agents/AgentsAndAutomationsModal';
import { WorkspaceDesignerModal } from './features/workspace-designer/WorkspaceDesignerModal';
import { SettingsModal } from './features/settings/SettingsModal';
import { useNovaStore } from './stores/useNovaStore';
import {
  fetchNovaRemoteFlags,
  getWorkspaceAccessToken,
  initOptionalAppCheck,
  subscribeToAuth,
  testFirestoreConnection,
} from './services/firebase/client';
import { detectLocalModelReadiness } from './services/ai/firebaseAiService';
import { flushSyncQueue } from './services/synchronization/syncManager';

export default function App() {
  const activeTab = useNovaStore((s) => s.activeTab);
  const setActiveTab = useNovaStore((s) => s.setActiveTab);
  const hydrateFromStorage = useNovaStore((s) => s.hydrateFromStorage);
  const setLocalReadiness = useNovaStore((s) => s.setLocalReadiness);
  const setIsOnline = useNovaStore((s) => s.setIsOnline);
  const setAuthUser = useNovaStore((s) => s.setAuthUser);
  const setLeftSidebarOpen = useNovaStore((s) => s.setLeftSidebarOpen);
  const setRightSidebarOpen = useNovaStore((s) => s.setRightSidebarOpen);

  useEffect(() => {
    void hydrateFromStorage();
    initOptionalAppCheck();
    void fetchNovaRemoteFlags();
    void testFirestoreConnection();

    // Collapse contextual sidebars cleanly on mobile/tablet viewports
    const syncResponsiveDrawers = () => {
      if (typeof window !== 'undefined' && window.innerWidth < 1024) {
        setLeftSidebarOpen(false);
        setRightSidebarOpen(false);
      }
    };
    syncResponsiveDrawers();
    window.addEventListener('resize', syncResponsiveDrawers);

    // Optional URL query parameter support (?tab=code or ?autostart=1)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam === 'chat' || tabParam === 'quiz' || tabParam === 'code' || tabParam === 'plan') {
        setActiveTab(tabParam);
      }
    }

    // Probe Chrome Built-in AI / Gemini Nano readiness
    void detectLocalModelReadiness().then((res) => {
      setLocalReadiness(res.readiness, res.detail);
    });

    // Subscribe to Firebase Auth
    const unsubAuth = subscribeToAuth((user, hasToken) => {
      setAuthUser(
        user
          ? {
              uid: user.uid,
              email: user.email,
              displayName: user.displayName,
              photoURL: user.photoURL,
            }
          : null,
        hasToken || Boolean(getWorkspaceAccessToken())
      );
      if (user) {
        const st = useNovaStore.getState();
        if (st.syncQueue.length > 0) {
          void flushSyncQueue(st.syncQueue, st.markSynced, st.incrementSyncRetry);
        }
      }
    });

    const handleOnline = () => {
      setIsOnline(true);
      const st = useNovaStore.getState();
      if (st.syncQueue.length > 0) {
        void flushSyncQueue(st.syncQueue, st.markSynced, st.incrementSyncRetry).then((res) => {
          if (res.syncedCount > 0) {
            st.pushToast({
              type: 'success',
              title: 'Offline Changes Synced',
              detail: `${res.syncedCount} queued item(s) synced cleanly.`,
            });
          }
        });
      }
    };
    const handleOffline = () => {
      setIsOnline(false);
      useNovaStore.getState().pushToast({
        type: 'warning',
        title: 'Offline Mode Active',
        detail: 'Changes are stored in IndexedDB and queued for cloud sync.',
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Register service worker via vite-plugin-pwa when supported
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      import('virtual:pwa-register')
        .then(({ registerSW }) => {
          registerSW({ immediate: true });
        })
        .catch(() => {
          // Dev middleware or unsupported runtime
        });
    }

    return () => {
      unsubAuth();
      window.removeEventListener('resize', syncResponsiveDrawers);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [
    hydrateFromStorage,
    setLocalReadiness,
    setIsOnline,
    setAuthUser,
    setLeftSidebarOpen,
    setRightSidebarOpen,
    setActiveTab,
  ]);

  return (
    <ErrorBoundary>
      <NovaShell>
        {activeTab === 'chat' && <ChatWorkspace />}
        {activeTab === 'quiz' && <QuizWorkspace />}
        {activeTab === 'code' && <CodeWorkspace />}
        {activeTab === 'plan' && <PlanWorkspace />}
      </NovaShell>

      <HybridMonitorModal />
      <KnowledgeVaultModal />
      <AgentsAndAutomationsModal />
      <WorkspaceDesignerModal />
      <SettingsModal />
      <ConfirmDialog />
      <ToastContainer />
    </ErrorBoundary>
  );
}
