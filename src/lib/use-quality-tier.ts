import { useSyncExternalStore } from 'react';

import {
  getQualityTier,
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
