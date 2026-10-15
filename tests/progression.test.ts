import { describe, expect, it } from 'vitest';
import { effectiveQualityMult, focusHoursBetweenLevels } from '../src/core/progression';
import { DEFAULT_REWARD_CONFIG } from '../src/core/rewards/config';

const cfg = DEFAULT_REWARD_CONFIG;
const STARTER = 5;

/** Horas de foco para alcanzar `level` desde nivel 5 con calidad Buena y sin racha. */
function hoursTo(level: number, qualityMult = 1): number {
  return focusHoursBetweenLevels({
    from: STARTER,
    to: level,
    xpPerMinute: cfg.xpPerMinute,
    qualityMult,
    xpScale: cfg.xpScale,
  });
}

const BANDS: Record<number, [number, number]> = {
  16: [1, 3],
  36: [18, 22],
  50: [50, 54],
  100: [410, 425],
};

describe('ritmo de progresión (§7.1)', () => {
  it('xpScale = 0.25 y la curva n³ dan los hitos esperados', () => {
    expect(cfg.xpScale).toBe(0.25);
    for (const [levelStr, [min, max]] of Object.entries(BANDS)) {
      const level = Number(levelStr);
      const h = hoursTo(level);
      expect(
        h,
        `el hito Nv.${level} pasó de ${min}–${max} h a ${h.toFixed(1)} h (revisa xpScale/xpPerMinute)`,
      ).toBeGreaterThanOrEqual(min);
      expect(
        h,
        `el hito Nv.${level} pasó de ${min}–${max} h a ${h.toFixed(1)} h (revisa xpScale/xpPerMinute)`,
      ).toBeLessThanOrEqual(max);
    }
  });

  it('con quality-mix 20/60/20 los hitos quedan dentro de ±5 %', () => {
    const mult = effectiveQualityMult({ perfect: 20, good: 60, poor: 20 });
    expect(mult).toBeCloseTo(1.01, 3);
    for (const levelStr of Object.keys(BANDS)) {
      const level = Number(levelStr);
      const base = hoursTo(level, 1);
      const mixed = hoursTo(level, mult);
      expect(Math.abs(mixed - base) / base, `Nv.${level}: ${mixed.toFixed(1)} h vs ${base.toFixed(1)} h`).toBeLessThanOrEqual(0.05);
    }
  });
});
