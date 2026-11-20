import React, { useState } from 'react';
import { Eye, EyeOff, LayoutGrid, RefreshCw, Sparkles, Star, Trash2, X } from 'lucide-react';
import { useNovaStore } from '../../stores/useNovaStore';
import { CustomWorkspaceConfig, WorkspaceTab, WorkspaceWidget } from '../../types/nova';

export const WorkspaceDesignerModal: React.FC = () => {
  const {
    activeOverlay,
    setActiveOverlay,
    customWorkspaces,
    activeCustomWorkspaceId,
    setActiveCustomWorkspaceId,
    saveCustomWorkspace,
    deleteCustomWorkspace,
    setActiveTab,
    pushToast,
  } = useNovaStore();

  const [aiDescription, setAiDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const activeWs =
    customWorkspaces.find((w) => w.id === activeCustomWorkspaceId) || customWorkspaces[0];

  if (activeOverlay !== 'workspace_designer') return null;

  const handleGenerateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiDescription.trim()) return;
    setIsGenerating(true);
    try {
      const res = await fetch('/api/gemini/workspace-layout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: aiDescription.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to design workspace.');

      const validTabs: WorkspaceTab[] = ['chat', 'quiz', 'code', 'plan'];
      const primaryTab: WorkspaceTab = validTabs.includes(data.primaryTab)
        ? data.primaryTab
        : 'chat';

      const created: CustomWorkspaceConfig = {
        id: `ws-${Date.now()}`,
        name: data.name || 'Custom AI Workspace',
        description: data.description || aiDescription.trim(),
        primaryTab,
        isDefault: false,
        updatedAt: new Date().toISOString(),
        widgets: (data.widgets || []).map((w: WorkspaceWidget, idx: number) => ({
          id: w.id || `w-${idx}`,
          type: w.type || 'chat',
          title: w.title || `Panel ${idx + 1}`,
          zone: (['left', 'center', 'right'].includes(w.zone) ? w.zone : 'center') as
            | 'left'
            | 'center'
            | 'right',
          visible: w.visible ?? true,
          widthPct: Number(w.widthPct) || 33,
        })),
      };

      saveCustomWorkspace(created);
      setAiDescription('');
      pushToast({
        type: 'success',
        title: 'AI Workspace Generated',
        detail: created.name,
      });
    } catch (err) {
      pushToast({
        type: 'error',
        title: 'Designer Error',
        detail: err instanceof Error ? err.message : 'Unable to generate layout.',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const updateWidget = (widgetId: string, patch: Partial<WorkspaceWidget>) => {
    if (!activeWs) return;
    saveCustomWorkspace({
      ...activeWs,
      updatedAt: new Date().toISOString(),
      widgets: activeWs.widgets.map((w) => (w.id === widgetId ? { ...w, ...patch } : w)),
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ws-designer-title"
    >
      <div className="w-full max-w-4xl max-h-[88vh] flex flex-col rounded-2xl border border-slate-700/80 bg-[#0B101D] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <LayoutGrid className="h-5 w-5 text-cyan-400" />
            <div>
              <h2 id="ws-designer-title" className="text-base font-semibold text-slate-100">
                Custom &amp; AI Workspace Designer
              </h2>
              <p className="text-xs text-slate-400">
                Generate modular workspace layouts from natural language or customize panel zones
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveOverlay(null)}
            aria-label="Close Workspace Designer"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-[#070B14]">
          {/* Natural Language AI Generator */}
          <form
            onSubmit={handleGenerateWorkspace}
            className="rounded-xl border border-slate-800 bg-[#0D1322] p-4 space-y-2.5"
          >
            <label
              htmlFor="ai-workspace-prompt"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-400"
            >
              AI Workspace Generator
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                id="ai-workspace-prompt"
                type="text"
                value={aiDescription}
                onChange={(e) => setAiDescription(e.target.value)}
                placeholder="e.g. Research studio with Knowledge Vault on left, Chat center, and Hybrid Monitor right"
                className="flex-1 rounded-lg border border-slate-700 bg-[#070B14] px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={isGenerating || !aiDescription.trim()}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 whitespace-nowrap"
              >
                {isGenerating ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                <span>{isGenerating ? 'Designing...' : 'Generate Layout'}</span>
              </button>
            </div>
          </form>

          {/* Saved Custom Workspaces */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Saved Configurations
              </h3>
              {customWorkspaces.map((ws) => (
                <div
                  key={ws.id}
                  className={`rounded-xl border p-3 transition-colors ${
                    ws.id === activeWs?.id
                      ? 'border-indigo-500/70 bg-indigo-500/12'
                      : 'border-slate-800 bg-[#0D1322]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveCustomWorkspaceId(ws.id)}
                      className="text-left text-xs font-semibold text-slate-100 truncate flex-1"
                    >
                      {ws.name}
                    </button>
                    {ws.isDefault && <Star className="h-3.5 w-3.5 text-amber-400 shrink-0" />}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400 line-clamp-2">{ws.description}</p>
                  <div className="mt-2 flex items-center justify-between text-[11px]">
                    <button
                      type="button"
                      onClick={() => {
                        saveCustomWorkspace({ ...ws, isDefault: true });
                        setActiveTab(ws.primaryTab);
                        setActiveOverlay(null);
                      }}
                      className="text-cyan-400 hover:text-cyan-300"
                    >
                      Apply &amp; Open
                    </button>
                    {customWorkspaces.length > 1 && (
                      <button
                        type="button"
                        onClick={() => deleteCustomWorkspace(ws.id)}
                        aria-label={`Delete workspace ${ws.name}`}
                        className="text-slate-500 hover:text-rose-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Widget Layout Editor */}
            {activeWs && (
              <div className="md:col-span-2 rounded-xl border border-slate-800 bg-[#0D1322] p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <input
                    type="text"
                    aria-label="Workspace configuration name"
                    value={activeWs.name}
                    onChange={(e) => saveCustomWorkspace({ ...activeWs, name: e.target.value })}
                    className="rounded-lg border border-slate-700 bg-[#070B14] px-2.5 py-1 text-sm font-semibold text-slate-100"
                  />
                  <select
                    aria-label="Primary workspace tab"
                    value={activeWs.primaryTab}
                    onChange={(e) =>
                      saveCustomWorkspace({
                        ...activeWs,
                        primaryTab: e.target.value as WorkspaceTab,
                      })
                    }
                    className="rounded-lg border border-slate-700 bg-[#070B14] px-2.5 py-1 text-xs text-slate-200"
                  >
                    <option value="chat">Primary: Chat</option>
                    <option value="quiz">Primary: Quiz</option>
                    <option value="code">Primary: Code</option>
                    <option value="plan">Primary: Plan</option>
                  </select>
                </div>

                <div className="space-y-2">
                  {activeWs.widgets.map((w) => (
                    <div
                      key={w.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-[#070B14] p-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-slate-100">{w.title}</div>
                        <div className="text-[11px] text-slate-400">Type: {w.type}</div>
                      </div>
                      <select
                        aria-label={`Zone for ${w.title}`}
                        value={w.zone}
                        onChange={(e) =>
                          updateWidget(w.id, {
                            zone: e.target.value as 'left' | 'center' | 'right',
                          })
                        }
                        className="rounded border border-slate-700 bg-[#0D1322] px-2 py-1 text-xs text-slate-200"
                      >
                        <option value="left">Left Zone</option>
                        <option value="center">Center Zone</option>
                        <option value="right">Right Zone</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => updateWidget(w.id, { visible: !w.visible })}
                        aria-label={`Toggle visibility of ${w.title}`}
                        className="rounded border border-slate-700 p-1.5 text-slate-300 hover:bg-slate-800"
                      >
                        {w.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5 text-slate-500" />}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
