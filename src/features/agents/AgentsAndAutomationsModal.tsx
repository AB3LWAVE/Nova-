import React, { useState } from 'react';
import {
  Bot,
  Check,
  Columns2,
  FileCode2,
  Play,
  Plus,
  Sparkles,
  Trash2,
  Workflow,
  X,
} from 'lucide-react';
import { NOVA_MODELS } from '../../data/seedData';
import { useNovaStore } from '../../stores/useNovaStore';
import { executeHybridPrompt } from '../../services/ai/novaAiEngine';
import { MarkdownRenderer } from '../../components/MarkdownRenderer';
import { PromptTemplate } from '../../types/nova';

export const AgentsAndAutomationsModal: React.FC = () => {
  const {
    activeOverlay,
    setActiveOverlay,
    agents,
    addAgent,
    agentLogs,
    addAgentLog,
    updateAgentLogStatus,
    automations,
    toggleAutomation,
    updateAutomationRun,
    templates,
    saveTemplate,
    deleteTemplate,
    routingMode,
    privacyPreference,
    localReadiness,
    isOnline,
    addTelemetryEvent,
    pushToast,
    setActiveTab,
    createConversation,
    appendMessage,
  } = useNovaStore();

  // Multi-Agent state
  const [agentTask, setAgentTask] = useState('');
  const [selectedAgentId, setSelectedAgentId] = useState(agents[0]?.id || '');
  const [isRunningAgent, setIsRunningAgent] = useState(false);
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentRole, setNewAgentRole] = useState('');
  const [newAgentInst, setNewAgentInst] = useState('');
  const [newAgentApproval, setNewAgentApproval] = useState(true);

  // Model Lab comparison state
  const [labPrompt, setLabPrompt] = useState(
    'Summarize the key privacy vs latency trade-offs between on-device Gemini Nano and Cloud Gemini.'
  );
  const [modelA, setModelA] = useState('gemini-4-hydrogen');
  const [modelB, setModelB] = useState('gemini-3.1-flash-lite');
  const [outputA, setOutputA] = useState<{ text: string; ms: number; source: string } | null>(null);
  const [outputB, setOutputB] = useState<{ text: string; ms: number; source: string } | null>(null);
  const [isComparing, setIsComparing] = useState(false);

  // Template creation state
  const [tplTitle, setTplTitle] = useState('');
  const [tplCategory, setTplCategory] = useState<PromptTemplate['category']>('prompt');
  const [tplContent, setTplContent] = useState('');

  if (
    activeOverlay !== 'agents' &&
    activeOverlay !== 'model_lab' &&
    activeOverlay !== 'templates'
  ) {
    return null;
  }

  const handleRunAgent = async () => {
    const agent = agents.find((a) => a.id === selectedAgentId) || agents[0];
    if (!agent || !agentTask.trim()) return;
    setIsRunningAgent(true);
    try {
      const res = await executeHybridPrompt({
        workspace: 'agents',
        prompt: agentTask.trim(),
        systemInstruction: `Agent: ${agent.name} (${agent.role}). Instructions: ${agent.instructions}`,
        requestedModelId: agent.preferredModelId,
        routingMode,
        privacyPreference,
        localReadiness,
        isOnline,
        onTelemetry: addTelemetryEvent,
      });
      addAgentLog({
        id: `alog-${Date.now()}`,
        agentId: agent.id,
        agentName: agent.name,
        task: agentTask.trim(),
        output: res.text,
        approvalStatus: agent.requiresApproval ? 'pending_approval' : 'approved',
        timestamp: new Date().toISOString(),
      });
      setAgentTask('');
      pushToast({
        type: agent.requiresApproval ? 'info' : 'success',
        title: `${agent.name} Completed Task`,
        detail: agent.requiresApproval ? 'Awaiting human approval.' : 'Executed cleanly.',
      });
    } catch (err) {
      pushToast({
        type: 'error',
        title: 'Agent Execution Error',
        detail: err instanceof Error ? err.message : 'Unable to execute agent.',
      });
    } finally {
      setIsRunningAgent(false);
    }
  };

  const handleCreateAgent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAgentName.trim() || !newAgentInst.trim()) return;
    const id = `agent-${Date.now()}`;
    addAgent({
      id,
      name: newAgentName.trim(),
      role: newAgentRole.trim() || 'Specialist Agent',
      instructions: newAgentInst.trim(),
      preferredModelId: 'gemini-4-hydrogen',
      requiresApproval: newAgentApproval,
    });
    setSelectedAgentId(id);
    setNewAgentName('');
    setNewAgentRole('');
    setNewAgentInst('');
    pushToast({ type: 'success', title: 'Agent Profile Created' });
  };

  const handleRunAutomation = async (autoId: string, name: string, action: string) => {
    try {
      const res = await executeHybridPrompt({
        workspace: 'agents',
        prompt: `Simulate automation workflow "${name}" and summarize the concrete output for action: ${action}`,
        requestedModelId: 'gemini-3.1-flash-lite',
        routingMode,
        privacyPreference,
        localReadiness,
        isOnline,
        onTelemetry: addTelemetryEvent,
      });
      updateAutomationRun(autoId, 'success', res.text.slice(0, 220));
      pushToast({ type: 'success', title: `Automation Run: ${name}` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Workflow failed';
      updateAutomationRun(autoId, 'error', msg);
      pushToast({ type: 'error', title: 'Automation Failed', detail: msg });
    }
  };

  const handleCompareModels = async () => {
    if (!labPrompt.trim()) return;
    setIsComparing(true);
    setOutputA(null);
    setOutputB(null);
    const runOne = async (modelId: string) => {
      try {
        const res = await executeHybridPrompt({
          workspace: 'lab',
          prompt: labPrompt.trim(),
          requestedModelId: modelId,
          routingMode: modelId === 'gemini-nano-4' ? 'local-first' : 'cloud-first',
          privacyPreference,
          localReadiness,
          isOnline,
          onTelemetry: addTelemetryEvent,
        });
        return { text: res.text, ms: res.latencyMs, source: res.executionSource };
      } catch (err) {
        return {
          text: err instanceof Error ? err.message : 'Execution failed.',
          ms: 0,
          source: 'error',
        };
      }
    };
    const [resA, resB] = await Promise.all([runOne(modelA), runOne(modelB)]);
    setOutputA(resA);
    setOutputB(resB);
    setIsComparing(false);
  };

  const handleCreateTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tplTitle.trim() || !tplContent.trim()) return;
    saveTemplate({
      id: `tpl-${Date.now()}`,
      category: tplCategory,
      title: tplTitle.trim(),
      content: tplContent.trim(),
    });
    setTplTitle('');
    setTplContent('');
    pushToast({ type: 'success', title: 'Template Saved' });
  };

  const handleUseTemplateInChat = (tpl: PromptTemplate) => {
    const conv = createConversation(tpl.title);
    appendMessage(conv.id, {
      id: `msg-tpl-${Date.now()}`,
      role: 'user',
      content: tpl.content,
      createdAt: new Date().toISOString(),
    });
    setActiveOverlay(null);
    setActiveTab('chat');
    pushToast({ type: 'info', title: 'Template Loaded into Chat', detail: tpl.title });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tools-modal-title"
    >
      <div className="w-full max-w-5xl max-h-[88vh] flex flex-col rounded-2xl border border-slate-700/80 bg-[#0B101D] shadow-2xl overflow-hidden">
        {/* Header with switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveOverlay('agents')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${
                activeOverlay === 'agents'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Bot className="h-3.5 w-3.5" />
              <span>Agents &amp; Automations</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveOverlay('model_lab')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${
                activeOverlay === 'model_lab'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Columns2 className="h-3.5 w-3.5" />
              <span>Model Lab</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveOverlay('templates')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${
                activeOverlay === 'templates'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <FileCode2 className="h-3.5 w-3.5" />
              <span>Templates</span>
            </button>
          </div>
          <h2 id="tools-modal-title" className="sr-only">
            NOVA Agents, Model Lab, and Templates
          </h2>
          <button
            type="button"
            onClick={() => setActiveOverlay(null)}
            aria-label="Close modal"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 bg-[#070B14]">
          {activeOverlay === 'agents' && (
            <div className="space-y-6">
              {/* Multi-Agent Orchestration */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-800 bg-[#0D1322] p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-slate-100">Run Specialist Agent</h3>
                  <select
                    aria-label="Select specialist agent"
                    value={selectedAgentId}
                    onChange={(e) => setSelectedAgentId(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-[#070B14] px-3 py-2 text-xs text-slate-100"
                  >
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} — {a.role} {a.requiresApproval ? '(Requires Approval)' : ''}
                      </option>
                    ))}
                  </select>
                  <textarea
                    rows={3}
                    value={agentTask}
                    onChange={(e) => setAgentTask(e.target.value)}
                    placeholder="Assign a multi-step analysis, audit, or planning task..."
                    className="w-full rounded-lg border border-slate-700 bg-[#070B14] p-2.5 text-xs text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={handleRunAgent}
                    disabled={isRunningAgent || !agentTask.trim()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                  >
                    <Play className="h-3.5 w-3.5" />
                    <span>{isRunningAgent ? 'Running Agent...' : 'Execute Agent Task'}</span>
                  </button>
                </div>

                <form
                  onSubmit={handleCreateAgent}
                  className="rounded-xl border border-slate-800 bg-[#0D1322] p-4 space-y-2.5"
                >
                  <h3 className="text-sm font-semibold text-slate-100">Create Custom Agent</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      required
                      value={newAgentName}
                      onChange={(e) => setNewAgentName(e.target.value)}
                      placeholder="Agent name"
                      className="rounded-lg border border-slate-700 bg-[#070B14] px-2.5 py-1.5 text-xs text-slate-100"
                    />
                    <input
                      type="text"
                      value={newAgentRole}
                      onChange={(e) => setNewAgentRole(e.target.value)}
                      placeholder="Role"
                      className="rounded-lg border border-slate-700 bg-[#070B14] px-2.5 py-1.5 text-xs text-slate-100"
                    />
                  </div>
                  <textarea
                    required
                    rows={2}
                    value={newAgentInst}
                    onChange={(e) => setNewAgentInst(e.target.value)}
                    placeholder="Agent instructions..."
                    className="w-full rounded-lg border border-slate-700 bg-[#070B14] p-2 text-xs text-slate-100"
                  />
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs text-slate-300">
                      <input
                        type="checkbox"
                        checked={newAgentApproval}
                        onChange={(e) => setNewAgentApproval(e.target.checked)}
                        className="accent-indigo-500"
                      />
                      Require human approval
                    </label>
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1 rounded-lg border border-indigo-500/60 bg-indigo-500/15 px-3 py-1.5 text-xs font-medium text-indigo-200 hover:bg-indigo-500/25"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Save Agent</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Agent Activity & Approval Queue */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Agent Activity &amp; Approval Checkpoints
                </h3>
                {agentLogs.length === 0 ? (
                  <p className="text-xs text-slate-500">No agent runs recorded yet.</p>
                ) : (
                  agentLogs.map((log) => (
                    <div
                      key={log.id}
                      className="rounded-xl border border-slate-800 bg-[#0D1322] p-3.5 space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs font-semibold text-slate-100">
                          {log.agentName} · <span className="text-slate-400 font-normal">{log.task}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[11px] font-medium capitalize ${
                              log.approvalStatus === 'approved'
                                ? 'text-emerald-400'
                                : log.approvalStatus === 'rejected'
                                ? 'text-rose-400'
                                : 'text-amber-400'
                            }`}
                          >
                            {log.approvalStatus.replace('_', ' ')}
                          </span>
                          {log.approvalStatus === 'pending_approval' && (
                            <>
                              <button
                                type="button"
                                onClick={() => updateAgentLogStatus(log.id, 'approved')}
                                className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2 py-0.5 text-[11px] text-white"
                              >
                                <Check className="h-3 w-3" />
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => updateAgentLogStatus(log.id, 'rejected')}
                                className="rounded border border-rose-500/50 px-2 py-0.5 text-[11px] text-rose-300"
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      <MarkdownRenderer content={log.output} />
                    </div>
                  ))
                )}
              </div>

              {/* Automations */}
              <div className="space-y-2.5 border-t border-slate-800 pt-4">
                <div className="flex items-center gap-2">
                  <Workflow className="h-4 w-4 text-cyan-400" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Trigger-Action Automations
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {automations.map((auto) => (
                    <div
                      key={auto.id}
                      className="rounded-xl border border-slate-800 bg-[#0D1322] p-3.5 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-100">{auto.name}</span>
                        <input
                          type="checkbox"
                          checked={auto.enabled}
                          onChange={() => toggleAutomation(auto.id)}
                          aria-label={`Toggle ${auto.name}`}
                          className="accent-cyan-400"
                        />
                      </div>
                      <p className="text-[11px] text-slate-400">Trigger: {auto.trigger}</p>
                      <p className="text-[11px] text-slate-300">Action: {auto.action}</p>
                      {auto.lastLog && (
                        <p className="rounded bg-[#070B14] p-2 text-[11px] text-cyan-300">
                          {auto.lastLog}
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRunAutomation(auto.id, auto.name, auto.action)}
                        className="rounded-lg border border-slate-700 px-2.5 py-1 text-[11px] text-slate-200 hover:bg-slate-800"
                      >
                        Test Run Now
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeOverlay === 'model_lab' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-800 bg-[#0D1322] p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="lab-model-a"
                      className="block text-xs font-medium text-slate-400 mb-1"
                    >
                      Model A
                    </label>
                    <select
                      id="lab-model-a"
                      value={modelA}
                      onChange={(e) => setModelA(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-[#070B14] px-3 py-1.5 text-xs text-slate-100"
                    >
                      {NOVA_MODELS.filter((m) => m.availability !== 'unconfigured').map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="lab-model-b"
                      className="block text-xs font-medium text-slate-400 mb-1"
                    >
                      Model B
                    </label>
                    <select
                      id="lab-model-b"
                      value={modelB}
                      onChange={(e) => setModelB(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-[#070B14] px-3 py-1.5 text-xs text-slate-100"
                    >
                      {NOVA_MODELS.filter((m) => m.availability !== 'unconfigured').map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <textarea
                  rows={3}
                  value={labPrompt}
                  onChange={(e) => setLabPrompt(e.target.value)}
                  aria-label="Model comparison prompt"
                  className="w-full rounded-lg border border-slate-700 bg-[#070B14] p-3 text-xs text-slate-100"
                />
                <button
                  type="button"
                  onClick={handleCompareModels}
                  disabled={isComparing}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>{isComparing ? 'Benchmarking...' : 'Compare Side-by-Side'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { label: modelA, out: outputA },
                  { label: modelB, out: outputB },
                ].map((side, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-slate-800 bg-[#0D1322] p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
                      <span className="font-semibold text-slate-100">{side.label}</span>
                      {side.out && (
                        <span className="font-mono text-[11px] text-cyan-400 tabular-nums">
                          {side.out.source} · {side.out.ms}ms
                        </span>
                      )}
                    </div>
                    {side.out ? (
                      <MarkdownRenderer content={side.out.text} />
                    ) : (
                      <p className="text-xs text-slate-500">Run comparison to inspect output.</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeOverlay === 'templates' && (
            <div className="space-y-4">
              <form
                onSubmit={handleCreateTemplate}
                className="rounded-xl border border-slate-800 bg-[#0D1322] p-4 space-y-3"
              >
                <h3 className="text-sm font-semibold text-slate-100">Create Reusable Template</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    required
                    value={tplTitle}
                    onChange={(e) => setTplTitle(e.target.value)}
                    placeholder="Template title"
                    className="sm:col-span-2 rounded-lg border border-slate-700 bg-[#070B14] px-3 py-1.5 text-xs text-slate-100"
                  />
                  <select
                    value={tplCategory}
                    onChange={(e) => setTplCategory(e.target.value as PromptTemplate['category'])}
                    className="rounded-lg border border-slate-700 bg-[#070B14] px-2.5 py-1.5 text-xs text-slate-100"
                  >
                    <option value="prompt">Prompt</option>
                    <option value="quiz">Quiz</option>
                    <option value="code">Code</option>
                    <option value="plan">Plan</option>
                  </select>
                </div>
                <textarea
                  required
                  rows={2}
                  value={tplContent}
                  onChange={(e) => setTplContent(e.target.value)}
                  placeholder="Reusable template prompt text..."
                  className="w-full rounded-lg border border-slate-700 bg-[#070B14] p-2.5 text-xs text-slate-100"
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Save Template</span>
                </button>
              </form>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {templates.map((tpl) => (
                  <div
                    key={tpl.id}
                    className="rounded-xl border border-slate-800 bg-[#0D1322] p-3.5 flex flex-col justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-100">{tpl.title}</span>
                        <span className="text-[11px] uppercase text-cyan-400">{tpl.category}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">{tpl.content}</p>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/70">
                      <button
                        type="button"
                        onClick={() => handleUseTemplateInChat(tpl)}
                        className="text-xs text-indigo-300 hover:text-indigo-200"
                      >
                        Open in Chat
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteTemplate(tpl.id)}
                        aria-label={`Delete template ${tpl.title}`}
                        className="p-1 text-slate-500 hover:text-rose-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
