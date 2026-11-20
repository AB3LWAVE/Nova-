import React, { useState } from 'react';
import {
  Activity,
  Cpu,
  Globe,
  Play,
  RefreshCw,
  Shield,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { useNovaStore } from '../../stores/useNovaStore';
import { executeHybridPrompt } from '../../services/ai/novaAiEngine';
import { detectLocalModelReadiness } from '../../services/ai/firebaseAiService';
import { PrivacyPreference, RoutingMode } from '../../types/nova';

interface DemoScenario {
  id: string;
  title: string;
  description: string;
  requestedModelId: string;
  routingMode: RoutingMode;
  privacyPreference: PrivacyPreference;
  simulateOffline?: boolean;
  prompt: string;
}

const HACKATHON_SCENARIOS: DemoScenario[] = [
  {
    id: 'demo-local-attempt',
    title: '1. On-Device Execution Attempt',
    description: 'Attempts Chrome Gemini Nano execution first via InferenceMode.PREFER_ON_DEVICE.',
    requestedModelId: 'gemini-nano-4',
    routingMode: 'local-first',
    privacyPreference: 'local-first',
    prompt: 'Write a 2-sentence definition of edge-first AI inference.',
  },
  {
    id: 'demo-cloud-inference',
    title: '2. Cloud Gemini Inference',
    description: 'Routes directly to Cloud Gemini 4 Hydrogen for high-context synthesis.',
    requestedModelId: 'gemini-4-hydrogen',
    routingMode: 'cloud-first',
    privacyPreference: 'standard',
    prompt: 'List 3 advantages of Hybrid AI combining local Nano and Cloud Gemini models.',
  },
  {
    id: 'demo-fallback',
    title: '3. Local Unavailable -> Cloud Fallback',
    description: 'Demonstrates automatic fallback when Gemini Nano is unavailable or prompt is complex.',
    requestedModelId: 'gemini-nano-4',
    routingMode: 'automatic',
    privacyPreference: 'standard',
    prompt: 'Summarize how IndexedDB offline queueing reconciles changes when connectivity returns.',
  },
  {
    id: 'demo-strict-privacy',
    title: '4. Strict-Local Privacy Gate',
    description: 'Enforces strict-local policy: executes locally if ready, otherwise blocks cloud leakage.',
    requestedModelId: 'gemini-nano-4',
    routingMode: 'local-first',
    privacyPreference: 'strict-local',
    prompt: 'Process sensitive local note without sending data to cloud.',
  },
  {
    id: 'demo-offline-check',
    title: '5. Offline Resilience Check',
    description: 'Simulates offline browser state to verify honest offline blocking vs local capability.',
    requestedModelId: 'gemini-4-hydrogen',
    routingMode: 'automatic',
    privacyPreference: 'standard',
    simulateOffline: true,
    prompt: 'Test offline inference behavior.',
  },
  {
    id: 'demo-fast-lite',
    title: '6. Low-Latency Flash-Lite Cloud',
    description: 'Executes rapid summary using Gemini 3.1 Flash-Lite and logs exact latency.',
    requestedModelId: 'gemini-3.1-flash-lite',
    routingMode: 'cloud-first',
    privacyPreference: 'standard',
    prompt: 'Give a one-line summary of Firebase AI Logic Hybrid Inference.',
  },
];

export const HybridMonitorModal: React.FC = () => {
  const {
    activeOverlay,
    setActiveOverlay,
    routingMode,
    setRoutingMode,
    privacyPreference,
    setPrivacyPreference,
    localReadiness,
    localReadinessDetail,
    setLocalReadiness,
    isOnline,
    selectedModelId,
    telemetryEvents,
    addTelemetryEvent,
    pushToast,
  } = useNovaStore();

  const [runningScenarioId, setRunningScenarioId] = useState<string | null>(null);
  const [lastOutput, setLastOutput] = useState<string>('');
  const [checkingLocal, setCheckingLocal] = useState(false);

  if (activeOverlay !== 'monitor') return null;

  const handleRefreshLocalCheck = async () => {
    setCheckingLocal(true);
    const res = await detectLocalModelReadiness();
    setLocalReadiness(res.readiness, res.detail);
    setCheckingLocal(false);
    pushToast({
      type: 'info',
      title: `Local Gemini Nano: ${res.readiness}`,
      detail: res.detail,
    });
  };

  const handleRunScenario = async (scenario: DemoScenario) => {
    setRunningScenarioId(scenario.id);
    setLastOutput('');
    try {
      const effectiveOnline = scenario.simulateOffline ? false : isOnline;
      const result = await executeHybridPrompt({
        workspace: 'chat',
        prompt: scenario.prompt,
        requestedModelId: scenario.requestedModelId,
        routingMode: scenario.routingMode,
        privacyPreference: scenario.privacyPreference,
        localReadiness,
        isOnline: effectiveOnline,
        onTelemetry: addTelemetryEvent,
      });
      setLastOutput(
        `[${result.executionSource}] (${result.modelId} · ${result.latencyMs}ms)\n${result.text}`
      );
      pushToast({
        type: 'success',
        title: 'Demo Scenario Completed',
        detail: `Source: ${result.executionSource} (${result.latencyMs}ms)`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Scenario blocked or failed.';
      setLastOutput(`Blocked / Honest Error: ${msg}`);
      pushToast({
        type: 'warning',
        title: 'Policy Enforced / Fallback Blocked',
        detail: msg,
      });
    } finally {
      setRunningScenarioId(null);
    }
  };

  const onDeviceCount = telemetryEvents.filter((e) => e.actualSource === 'on_device').length;
  const fallbackCount = telemetryEvents.filter((e) => e.fallbackTriggered).length;
  const avgLatency =
    telemetryEvents.length > 0
      ? Math.round(
          telemetryEvents.reduce((acc, e) => acc + e.latencyMs, 0) / telemetryEvents.length
        )
      : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="hybrid-monitor-title"
    >
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-700/80 bg-[#0B101D] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div className="flex items-center gap-3">
            <Activity className="h-5 w-5 text-cyan-400" />
            <div>
              <h2 id="hybrid-monitor-title" className="text-base font-semibold text-slate-100">
                Hybrid AI Monitor &amp; Hackathon Demo
              </h2>
              <p className="text-xs text-slate-400">
                Live Firebase AI Logic routing visibility, Chrome Gemini Nano readiness, and policy controls
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveOverlay(null)}
            aria-label="Close Hybrid AI Monitor"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Live Telemetry Summary Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl border border-slate-800 bg-[#070B14] p-3.5">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>On-Device (Nano)</span>
                <Cpu className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-sm font-semibold capitalize text-slate-100">
                  {localReadiness}
                </span>
                <button
                  type="button"
                  onClick={handleRefreshLocalCheck}
                  disabled={checkingLocal}
                  className="text-[11px] text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1"
                >
                  <RefreshCw className={`h-3 w-3 ${checkingLocal ? 'animate-spin' : ''}`} />
                  <span>Probe</span>
                </button>
              </div>
              <p className="mt-1 text-[11px] text-slate-500 line-clamp-2">{localReadinessDetail}</p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#070B14] p-3.5">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Cloud Gemini</span>
                {isOnline ? (
                  <Wifi className="h-4 w-4 text-cyan-400" />
                ) : (
                  <WifiOff className="h-4 w-4 text-rose-400" />
                )}
              </div>
              <div className="mt-1.5 text-sm font-semibold text-slate-100">
                {isOnline ? 'Connected' : 'Offline'}
              </div>
              <p className="mt-1 text-[11px] text-slate-500 truncate">
                Active selection: {selectedModelId}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#070B14] p-3.5">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Inference Split</span>
                <Globe className="h-4 w-4 text-indigo-400" />
              </div>
              <div className="mt-1.5 text-sm font-semibold text-slate-100 tabular-nums">
                {onDeviceCount} local · {fallbackCount} fallback
              </div>
              <p className="mt-1 text-[11px] text-slate-500 tabular-nums">
                {telemetryEvents.length} total logged events
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#070B14] p-3.5">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Average Latency</span>
                <Shield className="h-4 w-4 text-amber-400" />
              </div>
              <div className="mt-1.5 text-sm font-semibold text-slate-100 tabular-nums">
                {avgLatency} ms
              </div>
              <p className="mt-1 text-[11px] text-slate-500 capitalize">
                Policy: {privacyPreference}
              </p>
            </div>
          </div>

          {/* Interactive Policy Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-xl border border-slate-800 bg-[#070B14] p-4">
            <div>
              <label
                htmlFor="monitor-routing-mode"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2"
              >
                Routing Policy
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['automatic', 'local-first', 'cloud-first'] as RoutingMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setRoutingMode(mode)}
                    className={`rounded-lg px-2.5 py-2 text-xs font-medium capitalize border transition-colors ${
                      routingMode === mode
                        ? 'border-indigo-500 bg-indigo-500/20 text-indigo-200'
                        : 'border-slate-800 bg-[#0B101D] text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label
                htmlFor="monitor-privacy-pref"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2"
              >
                Privacy Preference
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['standard', 'local-first', 'strict-local'] as PrivacyPreference[]).map((pref) => (
                  <button
                    key={pref}
                    type="button"
                    onClick={() => setPrivacyPreference(pref)}
                    className={`rounded-lg px-2.5 py-2 text-xs font-medium capitalize border transition-colors ${
                      privacyPreference === pref
                        ? 'border-cyan-500 bg-cyan-500/20 text-cyan-200'
                        : 'border-slate-800 bg-[#0B101D] text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    {pref}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Hackathon Demo Mode Scenarios */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2.5">
              Repeatable Hackathon Demo Scenarios
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {HACKATHON_SCENARIOS.map((sc) => (
                <div
                  key={sc.id}
                  className="rounded-xl border border-slate-800 bg-[#070B14] p-3 flex flex-col justify-between gap-2.5"
                >
                  <div>
                    <div className="text-xs font-semibold text-slate-100">{sc.title}</div>
                    <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">
                      {sc.description}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRunScenario(sc)}
                    disabled={runningScenarioId !== null}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-indigo-500/50 bg-indigo-500/15 px-3 py-1.5 text-xs font-medium text-indigo-200 hover:bg-indigo-500/25 disabled:opacity-50"
                  >
                    <Play className="h-3 w-3" />
                    <span>
                      {runningScenarioId === sc.id ? 'Executing...' : 'Run Scenario'}
                    </span>
                  </button>
                </div>
              ))}
            </div>

            {lastOutput && (
              <div className="mt-3 rounded-xl border border-cyan-500/40 bg-[#070B14] p-3.5 text-xs text-slate-200 whitespace-pre-wrap font-mono">
                {lastOutput}
              </div>
            )}
          </div>

          {/* Telemetry Log */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Recent Inference Telemetry
            </h3>
            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#070B14]">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-800 text-[11px] text-slate-400">
                  <tr>
                    <th className="px-3 py-2">Workspace</th>
                    <th className="px-3 py-2">Requested Model</th>
                    <th className="px-3 py-2">Source</th>
                    <th className="px-3 py-2">Latency</th>
                    <th className="px-3 py-2">Decision Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {telemetryEvents.slice(0, 12).map((ev) => (
                    <tr key={ev.id} className="text-slate-300">
                      <td className="px-3 py-2 capitalize">{ev.workspace}</td>
                      <td className="px-3 py-2 font-mono text-[11px]">{ev.requestedModelId}</td>
                      <td className="px-3 py-2">
                        <span
                          className={
                            ev.actualSource === 'on_device'
                              ? 'text-emerald-400'
                              : ev.actualSource === 'hybrid_fallback'
                              ? 'text-amber-400'
                              : ev.actualSource === 'blocked_offline'
                              ? 'text-rose-400'
                              : 'text-cyan-400'
                          }
                        >
                          {ev.actualSource}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono tabular-nums">{ev.latencyMs}ms</td>
                      <td className="px-3 py-2 text-slate-400 max-w-xs truncate">{ev.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
