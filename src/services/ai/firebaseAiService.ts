import {
  getGenerativeModel,
  InferenceMode,
  InferenceSource,
} from 'firebase/ai';
import { firebaseAi } from '../firebase/client';
import { LocalModelReadiness, RoutingMode } from '../../types/nova';

interface ChromeLanguageModelAPI {
  availability?: () => Promise<'available' | 'downloadable' | 'downloading' | 'unavailable'>;
  capabilities?: () => Promise<{ available: 'readily' | 'after-download' | 'no' }>;
}

declare global {
  interface Window {
    ai?: {
      languageModel?: ChromeLanguageModelAPI;
    };
  }
  // W3C / Chrome Prompt API global
  var LanguageModel: ChromeLanguageModelAPI | undefined;
}

export async function detectLocalModelReadiness(): Promise<{
  readiness: LocalModelReadiness;
  detail: string;
}> {
  if (typeof window === 'undefined') {
    return { readiness: 'unavailable', detail: 'Non-browser environment' };
  }

  try {
    const promptApi = globalThis.LanguageModel || window.ai?.languageModel;
    if (!promptApi) {
      return {
        readiness: 'unavailable',
        detail: 'Chrome Built-in AI (Prompt API / Gemini Nano) not exposed in this browser runtime.',
      };
    }

    if (typeof promptApi.availability === 'function') {
      const status = await promptApi.availability();
      if (status === 'available') {
        return { readiness: 'available', detail: 'Chrome Gemini Nano ready for local on-device inference.' };
      }
      if (status === 'downloadable' || status === 'downloading') {
        return { readiness: status, detail: `Gemini Nano model status: ${status}.` };
      }
      return { readiness: 'unavailable', detail: 'Gemini Nano hardware/browser check returned unavailable.' };
    }

    if (typeof promptApi.capabilities === 'function') {
      const caps = await promptApi.capabilities();
      if (caps.available === 'readily') {
        return { readiness: 'available', detail: 'Chrome Gemini Nano ready (legacy capabilities API).' };
      }
      if (caps.available === 'after-download') {
        return { readiness: 'downloadable', detail: 'Gemini Nano available after model download.' };
      }
      return { readiness: 'unavailable', detail: 'Gemini Nano unavailable on this device.' };
    }

    return { readiness: 'unavailable', detail: 'Prompt API present without availability check.' };
  } catch (err) {
    return {
      readiness: 'unavailable',
      detail: err instanceof Error ? err.message : 'Unable to probe local Gemini Nano model.',
    };
  }
}

export function mapRoutingModeToInferenceMode(routingMode: RoutingMode): InferenceMode {
  switch (routingMode) {
    case 'local-first':
      return InferenceMode.PREFER_ON_DEVICE;
    case 'cloud-first':
      return InferenceMode.PREFER_IN_CLOUD;
    case 'automatic':
    default:
      return InferenceMode.PREFER_ON_DEVICE;
  }
}

export async function runFirebaseHybridInference(params: {
  prompt: string;
  systemInstruction?: string;
  mode: InferenceMode;
  cloudFallbackModel?: string;
}): Promise<{
  text: string;
  inferenceSource: 'on_device' | 'in_cloud';
}> {
  const model = getGenerativeModel(firebaseAi, {
    mode: params.mode,
    inCloudParams: {
      model: params.cloudFallbackModel || 'gemini-2.5-flash',
      systemInstruction: params.systemInstruction,
    },
  });

  const result = await model.generateContent(params.prompt);
  const text = result.response.text();
  const source =
    result.response.inferenceSource === InferenceSource.ON_DEVICE ? 'on_device' : 'in_cloud';

  return {
    text,
    inferenceSource: source,
  };
}
