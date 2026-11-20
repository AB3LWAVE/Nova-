import { InferenceMode } from 'firebase/ai';
import {
  AttachmentItem,
  ExecutionSource,
  HybridTelemetryEvent,
  LocalModelReadiness,
  PrivacyPreference,
  RoutingMode,
  WorkspaceTab,
} from '../../types/nova';
import { decideInferenceRoute } from '../hybrid-router/router';
import { runFirebaseHybridInference } from './firebaseAiService';

export interface ExecutePromptParams {
  workspace: WorkspaceTab | 'lab' | 'vault' | 'agents' | 'designer';
  prompt: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  systemInstruction?: string;
  requestedModelId: string;
  routingMode: RoutingMode;
  privacyPreference: PrivacyPreference;
  localReadiness: LocalModelReadiness;
  isOnline: boolean;
  attachments?: AttachmentItem[];
  onTelemetry: (event: HybridTelemetryEvent) => void;
  onStreamChunk?: (partialText: string) => void;
  abortSignal?: AbortSignal;
}

export interface ExecutePromptResult {
  text: string;
  modelId: string;
  executionSource: ExecutionSource;
  latencyMs: number;
  routingReason: string;
}

export async function executeHybridPrompt(params: ExecutePromptParams): Promise<ExecutePromptResult> {
  const startedAt = performance.now();
  const hasMultimodal = Boolean(
    params.attachments?.some((a) => a.mimeType.startsWith('image/') || a.mimeType.startsWith('video/'))
  );

  const decision = decideInferenceRoute({
    requestedModelId: params.requestedModelId,
    routingMode: params.routingMode,
    privacyPreference: params.privacyPreference,
    localReadiness: params.localReadiness,
    isOnline: params.isOnline,
    hasMultimodalAttachments: hasMultimodal,
    promptLength: params.prompt.length,
  });

  if (decision.target === 'blocked') {
    const latencyMs = Math.round(performance.now() - startedAt);
    params.onTelemetry({
      id: `tel-${Date.now()}`,
      timestamp: new Date().toISOString(),
      workspace: params.workspace,
      requestedModelId: params.requestedModelId,
      routingMode: params.routingMode,
      decision: 'on_device',
      actualSource: 'blocked_offline',
      reason: decision.reason,
      latencyMs,
      fallbackTriggered: false,
      status: 'error',
      errorMessage: decision.reason,
    });
    throw new Error(decision.reason);
  }

  // Attempt Firebase AI Logic Hybrid On-Device execution if routed on_device
  if (decision.target === 'on_device') {
    try {
      const mode = decision.canFallbackToCloud
        ? InferenceMode.PREFER_ON_DEVICE
        : InferenceMode.ONLY_ON_DEVICE;
      const res = await runFirebaseHybridInference({
        prompt: params.prompt,
        systemInstruction: params.systemInstruction,
        mode,
      });
      const latencyMs = Math.round(performance.now() - startedAt);
      const actualSource: ExecutionSource =
        res.inferenceSource === 'on_device' ? 'on_device' : 'hybrid_fallback';

      params.onTelemetry({
        id: `tel-${Date.now()}`,
        timestamp: new Date().toISOString(),
        workspace: params.workspace,
        requestedModelId: params.requestedModelId,
        routingMode: params.routingMode,
        decision: 'on_device',
        actualSource,
        reason:
          actualSource === 'on_device'
            ? decision.reason
            : 'Firebase AI Logic fell back to cloud inference after local attempt.',
        latencyMs,
        fallbackTriggered: actualSource !== 'on_device',
        status: 'success',
      });

      return {
        text: res.text,
        modelId: actualSource === 'on_device' ? 'gemini-nano-4' : 'gemini-4-hydrogen',
        executionSource: actualSource,
        latencyMs,
        routingReason: decision.reason,
      };
    } catch (localErr) {
      if (!decision.canFallbackToCloud || !params.isOnline) {
        const latencyMs = Math.round(performance.now() - startedAt);
        const msg = localErr instanceof Error ? localErr.message : 'On-device inference failed.';
        params.onTelemetry({
          id: `tel-${Date.now()}`,
          timestamp: new Date().toISOString(),
          workspace: params.workspace,
          requestedModelId: params.requestedModelId,
          routingMode: params.routingMode,
          decision: 'on_device',
          actualSource: 'blocked_offline',
          reason: msg,
          latencyMs,
          fallbackTriggered: false,
          status: 'error',
          errorMessage: msg,
        });
        throw new Error(msg);
      }
      // Fall through to server-side @google/genai cloud fallback
    }
  }

  // Cloud execution via server-side @google/genai endpoint
  const fallbackTriggered =
    params.requestedModelId === 'gemini-nano-4' ||
    (params.routingMode === 'local-first' && decision.target === 'in_cloud');

  try {
    const cloudAttachments = (params.attachments || [])
      .filter((a) => a.base64Data)
      .map((a) => ({ mimeType: a.mimeType, data: a.base64Data!, name: a.name }));

    const textAttachmentsContext = (params.attachments || [])
      .filter((a) => a.textPreview)
      .map((a) => `\n[Attached Document: ${a.name}]\n${a.textPreview}`)
      .join('\n');

    const fullPrompt = textAttachmentsContext
      ? `${params.prompt}\n${textAttachmentsContext}`
      : params.prompt;

    const useStream = Boolean(params.onStreamChunk) && cloudAttachments.length === 0;
    const response = await fetch('/api/gemini/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: params.abortSignal,
      body: JSON.stringify({
        prompt: fullPrompt,
        history: params.history || [],
        systemInstruction: params.systemInstruction,
        model: decision.effectiveModelId,
        attachments: cloudAttachments,
        stream: useStream,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({ error: 'Cloud Gemini request failed.' }));
      throw new Error(errData.error || `HTTP ${response.status}`);
    }

    let finalText = '';
    if (useStream && response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = JSON.parse(line.slice(6));
          if (payload.error) throw new Error(payload.error);
          if (payload.text) {
            finalText += payload.text;
            params.onStreamChunk?.(finalText);
          }
        }
      }
    } else {
      const data = await response.json();
      finalText = data.text || '';
    }

    const latencyMs = Math.round(performance.now() - startedAt);
    const actualSource: ExecutionSource = fallbackTriggered ? 'hybrid_fallback' : 'in_cloud';

    params.onTelemetry({
      id: `tel-${Date.now()}`,
      timestamp: new Date().toISOString(),
      workspace: params.workspace,
      requestedModelId: params.requestedModelId,
      routingMode: params.routingMode,
      decision: 'in_cloud',
      actualSource,
      reason: decision.reason,
      latencyMs,
      fallbackTriggered,
      status: 'success',
    });

    return {
      text: finalText,
      modelId: decision.effectiveModelId,
      executionSource: actualSource,
      latencyMs,
      routingReason: decision.reason,
    };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - startedAt);
    const msg = err instanceof Error ? err.message : 'Cloud Gemini request failed.';
    params.onTelemetry({
      id: `tel-${Date.now()}`,
      timestamp: new Date().toISOString(),
      workspace: params.workspace,
      requestedModelId: params.requestedModelId,
      routingMode: params.routingMode,
      decision: 'in_cloud',
      actualSource: 'in_cloud',
      reason: decision.reason,
      latencyMs,
      fallbackTriggered,
      status: 'error',
      errorMessage: msg,
    });
    throw err;
  }
}
