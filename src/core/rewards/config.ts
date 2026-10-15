import type { RewardConfig } from '../types';

export const DEFAULT_REWARD_CONFIG: RewardConfig = {
  preset: 'normal',
  xpPerMinute: 10,
  xpScale: 0.25,
  teamXpShare: 0.25,
  coinsPer25min: 10,
  minValidMinutes: 10,
  completionThreshold: 0.9,
  abandonCreditRatio: 0,
  freePausesPerSession: 1,
  shinyRate: 0.01,
  encounterChance: 1.0,
  encounterTtlHours: 24,
  encounterBlockMinutes: 30,
  maxEncountersPerSession: 3,
  maxPendingEncounters: 8,
  starterSpeciesIds: [1, 4, 7],
  starterLevel: 5,
  wildLevelRange: [3, 10],
  legendaryCaptureLevel: 50,
  eggDropChance: 0.1,
  pityThreshold: 15,
  regionPace: 1.0,
  streakMinMinutes: 25,
  candyXp: { xs: 100, s: 800, m: 3000, l: 10000, xl: 30000 },
  releaseCandy: { common: 'xs', uncommon: 's', rare: 's', epic: 'm', legendary: 'xs', mythical: 'xs' },
  shopDailyLimits: { candyXS: 5, candyS: 3, candyM: 1, candyL: 1 },
  qualityMult: { perfect: 1.25, good: 1.0, poor: 0.8 },
  rarityWeights: { common: 55, uncommon: 28, rare: 12, epic: 4.5, legendary: 0.4, mythical: 0.1 },
};

export function presetConfig(preset: RewardConfig['preset']): RewardConfig {
  switch (preset) {
    case 'casual':
      return {
        ...DEFAULT_REWARD_CONFIG,
        preset,
        abandonCreditRatio: 1,
        regionPace: 0.7,
        shinyRate: 1 / 50,
        freePausesPerSession: 2,
      };
    case 'hardcore':
      return {
        ...DEFAULT_REWARD_CONFIG,
        preset,
        abandonCreditRatio: 0,
        regionPace: 1.5,
        shinyRate: 1 / 400,
        freePausesPerSession: 0,
      };
    case 'normal':
      return { ...DEFAULT_REWARD_CONFIG };
    default:
      return { ...DEFAULT_REWARD_CONFIG, preset: 'custom' };
  }
}
