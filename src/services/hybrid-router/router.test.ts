import test from 'node:test';
import assert from 'node:assert/strict';
import { decideInferenceRoute } from './router';

test('routes concise text on-device when local Gemini Nano is available in automatic mode', () => {
  const decision = decideInferenceRoute({
    requestedModelId: 'gemini-4-hydrogen',
    routingMode: 'automatic',
    privacyPreference: 'standard',
    localReadiness: 'available',
    isOnline: true,
    hasMultimodalAttachments: false,
    promptLength: 120,
  });
  assert.equal(decision.target, 'on_device');
  assert.equal(decision.effectiveModelId, 'gemini-nano-4');
  assert.equal(decision.canFallbackToCloud, true);
});

test('falls back to cloud when local model is unavailable', () => {
  const decision = decideInferenceRoute({
    requestedModelId: 'gemini-nano-4',
    routingMode: 'local-first',
    privacyPreference: 'local-first',
    localReadiness: 'unavailable',
    isOnline: true,
    hasMultimodalAttachments: false,
    promptLength: 80,
  });
  assert.equal(decision.target, 'in_cloud');
  assert.equal(decision.effectiveModelId, 'gemini-4-hydrogen');
});

test('routes multimodal requests to cloud even when local model is ready', () => {
  const decision = decideInferenceRoute({
    requestedModelId: 'gemini-nano-4',
    routingMode: 'local-first',
    privacyPreference: 'standard',
    localReadiness: 'available',
    isOnline: true,
    hasMultimodalAttachments: true,
    promptLength: 50,
  });
  assert.equal(decision.target, 'in_cloud');
  assert.equal(decision.effectiveModelId, 'gemini-4-hydrogen');
});

test('blocks execution when strict-local privacy is active and local model is unavailable', () => {
  const decision = decideInferenceRoute({
    requestedModelId: 'gemini-4-hydrogen',
    routingMode: 'automatic',
    privacyPreference: 'strict-local',
    localReadiness: 'unavailable',
    isOnline: true,
    hasMultimodalAttachments: false,
    promptLength: 40,
  });
  assert.equal(decision.target, 'blocked');
});

test('allows offline execution only when local Gemini Nano is genuinely available', () => {
  const offlineReady = decideInferenceRoute({
    requestedModelId: 'gemini-4-hydrogen',
    routingMode: 'automatic',
    privacyPreference: 'standard',
    localReadiness: 'available',
    isOnline: false,
    hasMultimodalAttachments: false,
    promptLength: 50,
  });
  assert.equal(offlineReady.target, 'on_device');

  const offlineUnavailable = decideInferenceRoute({
    requestedModelId: 'gemini-4-hydrogen',
    routingMode: 'automatic',
    privacyPreference: 'standard',
    localReadiness: 'unavailable',
    isOnline: false,
    hasMultimodalAttachments: false,
    promptLength: 50,
  });
  assert.equal(offlineUnavailable.target, 'blocked');
});
