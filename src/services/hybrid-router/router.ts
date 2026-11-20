import {
  LocalModelReadiness,
  PrivacyPreference,
  RoutingMode,
} from '../../types/nova';

export interface RouteDecisionInput {
  requestedModelId: string;
  routingMode: RoutingMode;
  privacyPreference: PrivacyPreference;
  localReadiness: LocalModelReadiness;
  isOnline: boolean;
  hasMultimodalAttachments: boolean;
  promptLength: number;
  requiresStructuredJson?: boolean;
}

export interface RouteDecisionOutput {
  target: 'on_device' | 'in_cloud' | 'blocked';
  effectiveModelId: string;
  reason: string;
  canFallbackToCloud: boolean;
}

export function decideInferenceRoute(input: RouteDecisionInput): RouteDecisionOutput {
  const {
    requestedModelId,
    routingMode,
    privacyPreference,
    localReadiness,
    isOnline,
    hasMultimodalAttachments,
    promptLength,
    requiresStructuredJson = false,
  } = input;

  const localReady = localReadiness === 'available';
  const localCapable = !hasMultimodalAttachments && !requiresStructuredJson && promptLength <= 3500;
  const fallbackCloudModel =
    requestedModelId === 'gemini-nano-4' || requestedModelId === 'custom-endpoint'
      ? 'gemini-4-hydrogen'
      : requestedModelId;

  // Strict privacy mode never sends prompts to the cloud
  if (privacyPreference === 'strict-local') {
    if (localReady && localCapable) {
      return {
        target: 'on_device',
        effectiveModelId: 'gemini-nano-4',
        reason: 'Strict local privacy preference active and on-device Gemini Nano is ready.',
        canFallbackToCloud: false,
      };
    }
    return {
      target: 'blocked',
      effectiveModelId: 'gemini-nano-4',
      reason: !localReady
        ? 'Strict local privacy prevents cloud fallback while Gemini Nano is unavailable on this browser.'
        : 'Strict local privacy blocks cloud execution for multimodal/long-context tasks.',
      canFallbackToCloud: false,
    };
  }

  // Offline handling: only execute if local model is genuinely ready and capable
  if (!isOnline) {
    if (localReady && localCapable) {
      return {
        target: 'on_device',
        effectiveModelId: 'gemini-nano-4',
        reason: 'Offline mode detected; executing locally via Chrome Gemini Nano.',
        canFallbackToCloud: false,
      };
    }
    return {
      target: 'blocked',
      effectiveModelId: requestedModelId,
      reason: 'Browser is offline and no compatible on-device Gemini Nano model is available.',
      canFallbackToCloud: false,
    };
  }

  // Explicit on-device model or local-first mode
  if (requestedModelId === 'gemini-nano-4' || routingMode === 'local-first' || privacyPreference === 'local-first') {
    if (localReady && localCapable) {
      return {
        target: 'on_device',
        effectiveModelId: 'gemini-nano-4',
        reason: 'Local-first policy selected and on-device Gemini Nano is ready for text inference.',
        canFallbackToCloud: true,
      };
    }
    const unavailableReason = !localReady
      ? `On-device Gemini Nano is ${localReadiness}; falling back to Firebase AI Logic cloud (${fallbackCloudModel}).`
      : 'Task requires multimodal or extended context beyond on-device capacity; routing to cloud.';
    return {
      target: 'in_cloud',
      effectiveModelId: fallbackCloudModel,
      reason: unavailableReason,
      canFallbackToCloud: false,
    };
  }

  // Cloud-first mode
  if (routingMode === 'cloud-first') {
    return {
      target: 'in_cloud',
      effectiveModelId: fallbackCloudModel,
      reason: `Cloud-first routing active; executing on ${fallbackCloudModel}.`,
      canFallbackToCloud: false,
    };
  }

  // Automatic hybrid mode: keep short simple text local when Gemini Nano is ready; otherwise cloud
  if (localReady && localCapable && promptLength <= 600) {
    return {
      target: 'on_device',
      effectiveModelId: 'gemini-nano-4',
      reason: 'Automatic hybrid router selected zero-latency on-device Gemini Nano for concise text prompt.',
      canFallbackToCloud: true,
    };
  }

  return {
    target: 'in_cloud',
    effectiveModelId: fallbackCloudModel,
    reason: localReady
      ? `Automatic hybrid router selected cloud ${fallbackCloudModel} for extended/structured task.`
      : `Automatic hybrid router selected cloud ${fallbackCloudModel} (on-device model ${localReadiness}).`,
    canFallbackToCloud: false,
  };
}
