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

const serverTier = (): QualityTier => 'high';

export function useQualityTier(): QualityTier {
  return useSyncExternalStore(subscribeQualityTier, getQualityTier, serverTier);
}

export function useQualityBudget(): QualityBudget {
  return qualityBudget(useQualityTier());
}

const neverChanges = () => () => {};
const debugSnapshot = () => flags.qualityDebug || isQualityDebugRequested();
const debugOnServer = (): boolean => flags.qualityDebug;

export function useQualityDebug(): boolean {
  return useSyncExternalStore(neverChanges, debugSnapshot, debugOnServer);
}
