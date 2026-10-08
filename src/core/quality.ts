import type { RewardConfig } from './types';

export interface QualityInput {
  pauseCount: number;
  distractionCount: number;
  strictFocus: boolean;
}

/** §6.5 — empieza en 100: −10/pausa (máx −30), −5/distracción (máx −30, ×2 si strictFocus). */
export function computeQuality(input: QualityInput): number {
  const pausePenalty = Math.min(30, input.pauseCount * 10);
  const perDistraction = input.strictFocus ? 10 : 5;
  const distractionPenalty = Math.min(30, input.distractionCount * perDistraction);
  return Math.max(0, 100 - pausePenalty - distractionPenalty);
}

export type QualityLabel = 'perfect' | 'good' | 'poor';

export function qualityLabel(quality: number): QualityLabel {
  if (quality >= 90) return 'perfect';
  if (quality >= 60) return 'good';
  return 'poor';
}

export function qualityMultiplier(quality: number, config: RewardConfig): number {
  const label = qualityLabel(quality);
  return config.qualityMult[label];
}

/** §6.4 — ¿la sesión vale para recompensas/racha? */
export function isValidSession(focusedMs: number, plannedMs: number, mode: 'pomodoro' | 'flow', config: RewardConfig): boolean {
  const minMs = config.minValidMinutes * 60_000;
  if (focusedMs < minMs) return false;
  if (mode === 'flow') return focusedMs >= minMs;
  return focusedMs >= plannedMs * config.completionThreshold;
}

export function ballForQuality(quality: number): 'poke' | 'great' | 'ultra' {
  const label = qualityLabel(quality);
  return label === 'perfect' ? 'ultra' : label === 'good' ? 'great' : 'poke';
}
