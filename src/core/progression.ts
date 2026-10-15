import { xpForLevel } from './xp';

/** Niveles usados como referencia de ritmo (SPECS §7.1). */
export const PROGRESSION_MILESTONES = [16, 36, 50, 75, 100] as const;

export interface QualityMix {
  perfect: number;
  good: number;
  poor: number;
}

/** Multiplicador de calidad medio de un reparto Perfecta/Buena/Floja (se normaliza). */
export function effectiveQualityMult(
  mix: QualityMix,
  mult = { perfect: 1.25, good: 1, poor: 0.8 },
): number {
  const total = mix.perfect + mix.good + mix.poor;
  if (total <= 0) return mult.good;
  return (mix.perfect * mult.perfect + mix.good * mult.good + mix.poor * mult.poor) / total;
}

/**
 * Horas de foco para pasar del nivel `from` al `to`, sin depender de la duración
 * de sesión ni de racha (el multiplicador se pasa ya resuelto).
 */
export function focusHoursBetweenLevels(params: {
  from: number;
  to: number;
  xpPerMinute: number;
  qualityMult: number;
  xpScale: number;
}): number {
  const needed = xpForLevel(params.to, params.xpScale) - xpForLevel(params.from, params.xpScale);
  return needed / (params.xpPerMinute * params.qualityMult) / 60;
}
