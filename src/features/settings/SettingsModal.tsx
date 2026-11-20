import React, { useEffect, useState } from 'react';
import {
  CloudUpload,
  Download,
  LogOut,
  Moon,
  Settings,
  Shield,
  Smartphone,
  Sun,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import { useNovaStore } from '../../stores/useNovaStore';
import { GoogleSignInButton } from '../../components/GoogleSignInButton';
import {
  saveUserProfileToFirestore,
  signInWithGoogleWorkspace,
  signOutUser,
} from '../../services/firebase/client';
import { flushSyncQueue } from '../../services/synchronization/syncManager';
import { PrivacyPreference, RoutingMode } from '../../types/nova';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const SettingsModal: React.FC = () => {
  const {
    activeOverlay,
    setActiveOverlay,
    routingMode,
    setRoutingMode,
    privacyPreference,
    setPrivacyPreference,
    hackathonDemoMode,
    setHackathonDemoMode,
    themeMode,
    setThemeMode,
    syncQueue,
    markSynced,
    incrementSyncRetry,
    authUid,
    authEmail,
    authDisplayName,
    hasWorkspaceToken,
    setAuthUser,
    conversations,
    quizzes,
    codeProjects,
    plans,
    clearAllConversations,
    pushToast,
    openConfirm,
  } = useNovaStore();

  const [signingIn, setSigningIn] = useState(false);
  const [syncingNow, setSyncingNow] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (activeOverlay !== 'settings' && activeOverlay !== 'auth') return null;

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    try {
      const res = await signInWithGoogleWorkspace();
      setAuthUser(
        {
          uid: res.user.uid,
          email: res.user.email,
          displayName: res.user.displayName,
          photoURL: res.user.photoURL,
        },
        Boolean(res.accessToken)
      );
      await saveUserProfileToFirestore(res.user, {
        routingMode,
        privacyPreference,
      });
      pushToast({
        type: 'success',
        title: 'Signed in with Google',
        detail: res.accessToken
          ? 'Firebase Auth & Google Workspace APIs (Docs, Sheets, Slides, Calendar) connected.'
          : 'Firebase Auth connected.',
      });
    } catch (err) {
      pushToast({
        type: 'error',
        title: 'Sign-In Cancelled or Failed',
        detail: err instanceof Error ? err.message : 'Unable to complete Google Sign-In.',
      });
    } finally {
      setSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    await signOutUser();
    setAuthUser(null, false);
    pushToast({ type: 'info', title: 'Signed out' });
  };

  const handleFlushQueue = async () => {
    setSyncingNow(true);
    try {
      const res = await flushSyncQueue(syncQueue, markSynced, incrementSyncRetry);
      pushToast({
        type: 'info',
        title: 'Sync Pass Finished',
        detail: `${res.syncedCount} item(s) synced, ${res.remainingCount} remaining.`,
      });
    } finally {
      setSyncingNow(false);
    }
  };

  const handleExportAllData = () => {
    const bundle = {
      exportedAt: new Date().toISOString(),
      conversations,
      quizzes,
      codeProjects,
      plans,
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nova-workspace-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    pushToast({ type: 'success', title: 'Workspace Backup Downloaded' });
  };

  const handleInstallPwa = async () => {
    if (!installPrompt) {
      pushToast({
        type: 'info',
        title: 'PWA Ready',
        detail: 'Use your browser menu ("Install app" / "Add to Home Screen") to install NOVA.',
      });
      return;
    }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
    >
      <div className="w-full max-w-2xl max-h-[88vh] flex flex-col rounded-2xl border border-slate-700/80 bg-[#0B101D] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Settings className="h-5 w-5 text-cyan-400" />
            <div>
              <h2 id="settings-modal-title" className="text-base font-semibold text-slate-100">
                NOVA Settings, Privacy &amp; Account
              </h2>
              <p className="text-xs text-slate-400">
                Dedicated workspace settings (kept separate from Chat History)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveOverlay(null)}
            aria-label="Close settings"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-[#070B14]">
          {/* Account & Google Workspace OAuth */}
          <div className="rounded-xl border border-slate-800 bg-[#0D1322] p-4 space-y-3">
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-cyan-400" />
              <h3 className="text-sm font-semibold text-slate-100">
                Firebase Account &amp; Google Workspace
              </h3>
            </div>
            {authUid ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-slate-100">
                    {authDisplayName || authEmail}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {authEmail} · Workspace OAuth:{' '}
                    {hasWorkspaceToken ? 'Active (Docs, Sheets, Slides, Calendar)' : 'Re-sign in for Workspace export'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {!hasWorkspaceToken && (
                    <GoogleSignInButton
                      onClick={handleGoogleSignIn}
                      loading={signingIn}
                      label="Grant Workspace Scopes"
                    />
                  )}
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-400 max-w-sm">
                  Sign in with Google to sync workspaces with Firestore and export directly to Google Docs, Sheets, Slides, and Calendar.
                </p>
                <GoogleSignInButton onClick={handleGoogleSignIn} loading={signingIn} />
              </div>
            )}
          </div>

          {/* Hybrid AI Routing & Privacy */}
          <div className="rounded-xl border border-slate-800 bg-[#0D1322] p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-indigo-400" />
              <h3 className="text-sm font-semibold text-slate-100">Hybrid AI &amp; Privacy Controls</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="settings-routing"
                  className="block text-xs text-slate-400 mb-1"
                >
                  Default Routing Mode
                </label>
                <select
                  id="settings-routing"
                  value={routingMode}
                  onChange={(e) => setRoutingMode(e.target.value as RoutingMode)}
                  className="w-full rounded-lg border border-slate-700 bg-[#070B14] px-3 py-2 text-xs text-slate-100"
                >
                  <option value="automatic">Automatic (Smart Hybrid)</option>
                  <option value="local-first">Local-First (Prefer Gemini Nano)</option>
                  <option value="cloud-first">Cloud-First (Firebase AI Logic Cloud)</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="settings-privacy"
                  className="block text-xs text-slate-400 mb-1"
                >
                  Privacy Policy
                </label>
                <select
                  id="settings-privacy"
                  value={privacyPreference}
                  onChange={(e) => setPrivacyPreference(e.target.value as PrivacyPreference)}
                  className="w-full rounded-lg border border-slate-700 bg-[#070B14] px-3 py-2 text-xs text-slate-100"
                >
                  <option value="standard">Standard Hybrid</option>
                  <option value="local-first">Local-First Privacy</option>
                  <option value="strict-local">Strict-Local (Block Cloud Fallback)</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hackathonDemoMode}
                  onChange={(e) => setHackathonDemoMode(e.target.checked)}
                  className="accent-cyan-400"
                />
                <span>Enable Hackathon Demonstration Mode in Hybrid AI Monitor</span>
              </label>

              <button
                type="button"
                onClick={() => setThemeMode(themeMode === 'dark' ? 'light' : 'dark')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
              >
                {themeMode === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                <span>Theme: {themeMode === 'dark' ? 'Dark' : 'Light'}</span>
              </button>
            </div>
          </div>

          {/* Offline Sync Queue & PWA Install */}
          <div className="rounded-xl border border-slate-800 bg-[#0D1322] p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-100">
                  Offline-First IndexedDB &amp; PWA
                </h3>
                <p className="text-xs text-slate-400 tabular-nums">
                  Pending sync items: {syncQueue.length}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleFlushQueue}
                  disabled={syncingNow || syncQueue.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-40"
                >
                  <CloudUpload className="h-3.5 w-3.5 text-cyan-400" />
                  <span>{syncingNow ? 'Syncing...' : 'Sync Now'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleInstallPwa}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
                >
                  <Smartphone className="h-3.5 w-3.5" />
                  <span>Install PWA</span>
                </button>
              </div>
            </div>
          </div>

          {/* Data Export & Danger Zone */}
          <div className="rounded-xl border border-slate-800 bg-[#0D1322] p-4 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleExportAllData}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800"
            >
              <Download className="h-3.5 w-3.5 text-cyan-400" />
              <span>Export All Workspace JSON</span>
            </button>

            <button
              type="button"
              onClick={() =>
                openConfirm({
                  title: 'Clear All Conversations?',
                  description:
                    'This removes all local chat conversations from IndexedDB. Saved plans, quizzes, and code projects remain untouched.',
                  confirmLabel: 'Clear Conversations',
                  destructive: true,
                  onConfirm: () => {
                    clearAllConversations();
                    pushToast({ type: 'info', title: 'Chat history cleared' });
                  },
                })
              }
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/40 px-3 py-2 text-xs text-rose-300 hover:bg-rose-500/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Clear Chat History</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
