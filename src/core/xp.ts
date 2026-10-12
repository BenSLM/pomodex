/**
 * Decisión de diseño: el juego usa una única curva de XP (la "medium" de PokeAPI:
 * XP total = n³) y se ignora a propósito el `growth_rate` del dataset. No es una
 * omisión, es una simplificación deliberada del balance (ver SPECS §7.1 / ROADMAP).
 */
export const MAX_LEVEL = 100;

/** XP total bruta para alcanzar el nivel n (n ≥ 1), sin escala: n³. */
export function rawXpForLevel(n: number): number {
  return Math.max(0, n ** 3);
}

/** XP total para el nivel n ya aplicando XP_SCALE (§7.1). Sin floor (invariante de roundtrip). */
export function xpForLevel(n: number, xpScale = 0.05): number {
  if (n <= 1) return 0;
  return Math.max(0, rawXpForLevel(n) * xpScale);
}

/** Nivel derivado de la XP total (la XP es la fuente de verdad). */
export function levelFromXp(xp: number, xpScale = 0.05): number {
  let level = 1;
  while (level < MAX_LEVEL && xpForLevel(level + 1, xpScale) <= xp) level++;
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
