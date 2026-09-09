import { useSyncExternalStore } from 'react';

import { flags } from '@/lib/flags';
import {
  getQualityTier,
  isQualityDebugRequested,
  qualityBudget,
  subscribeQualityTier,
  type QualityBudget,
  type QualityTier,
} from '@/lib/quality';

// The island SSRs with the richest tree. Hydration keeps that markup, then the
// first client render swaps in the detected tier without a mismatch.
const serverTier = (): QualityTier => 'high';

export function useQualityTier(): QualityTier {
  return useSyncExternalStore(subscribeQualityTier, getQualityTier, serverTier);
}

export function useQualityBudget(): QualityBudget {
  return qualityBudget(useQualityTier());
}

// The query string is a client-only fact that never changes for the life of
// the page, so it is read through the store contract instead of an effect:
// the hydration render agrees with the server, the next one has the answer.
const neverChanges = () => () => {};
const debugSnapshot = () => flags.qualityDebug || isQualityDebugRequested();
const debugOnServer = (): boolean => flags.qualityDebug;

/** Whether the corner tier readout should be mounted. */
export function useQualityDebug(): boolean {
  return useSyncExternalStore(neverChanges, debugSnapshot, debugOnServer);
}
