import type { BallId } from './types';

export const BALL_MULTIPLIER: Record<BallId, number> = {
  poke: 1.0,
  great: 1.5,
  ultra: 2.0,
  master: 100,
};

/** §7.4 — base = 0.10 + 0.80 × (captureRate / 255); p = min(0.98, base × ballMult). */
export function captureChance(captureRate: number, ball: BallId): number {
  const base = 0.1 + 0.8 * (captureRate / 255);
  return Math.min(0.98, base * BALL_MULTIPLIER[ball]);
}

/** Animación de sacudidas: 1–3 según la probabilidad. */
export function shakesFor(p: number): number {
  if (p >= 0.8) return 3;
  if (p >= 0.45) return 2;
  return 1;
}
