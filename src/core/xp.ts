import type { GrowthRate } from './types';

/** XP total bruta para alcanzar el nivel n (n ≥ 1), sin escala. */
export function rawXpForLevel(rate: GrowthRate, n: number): number {
  const c = Math.floor;
  const clamp = (v: number) => Math.max(0, v);
  switch (rate) {
    case 'fast':
      return clamp(c((4 * n ** 3) / 5));
    case 'medium-fast':
      return n ** 3;
    case 'medium':
      return n ** 3;
    case 'medium-slow':
      return clamp(c((6 * n ** 3) / 5 - 15 * n ** 2 + 100 * n - 140));
    case 'slow':
      return clamp(c((5 * n ** 3) / 4));
    case 'erratic':
      if (n < 50) return clamp(c((n ** 3 * (100 - n)) / 50));
      if (n < 68) return clamp(c((n ** 3 * (150 - n)) / 100));
      if (n < 98) return clamp(c((n ** 3 * c((1911 - 10 * n) / 3)) / 500));
      return clamp(c((n ** 3 * (160 - n)) / 100));
    case 'fluctuating':
      if (n < 15) return clamp(c((n ** 3 * (c((n + 1) / 3) + 24)) / 50));
      if (n < 36) return clamp(c((n ** 3 * (n + 14)) / 50));
      return clamp(c((n ** 3 * (c(n / 2) + 32)) / 50));
  }
}

/** XP total para el nivel n ya aplicando XP_SCALE (§7.1). */
export function xpForLevel(rate: GrowthRate, n: number, xpScale = 0.05): number {
  if (n <= 1) return 0;
  return Math.max(0, rawXpForLevel(rate, n) * xpScale);
}

export const MAX_LEVEL = 100;

/** Nivel derivado de la XP total (la XP es la fuente de verdad). */
export function levelFromXp(rate: GrowthRate, xp: number, xpScale = 0.05): number {
  let level = 1;
  while (level < MAX_LEVEL && xpForLevel(rate, level + 1, xpScale) <= xp) level++;
  return level;
}

/** XP de sesión: minutos × xpPerMinute × qualityMult × streakMult (§7.1). */
export function sessionXp(params: {
  focusedMinutes: number;
  xpPerMinute: number;
  qualityMult: number;
  streakDays: number;
}): number {
  const streakMult = Math.min(1 + 0.02 * params.streakDays, 1.5);
  return Math.round(params.focusedMinutes * params.xpPerMinute * params.qualityMult * streakMult);
}
