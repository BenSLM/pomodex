import { describe, expect, it } from 'vitest';
import { levelFromXp, rawXpForLevel, sessionXp, xpForLevel } from '../src/core/xp';
import type { GrowthRate } from '../src/core/types';

const RATES: GrowthRate[] = ['fast', 'medium-fast', 'medium-slow', 'slow', 'erratic', 'fluctuating'];

describe('curvas de experiencia (§7.1)', () => {
  it('totales canónicos al nivel 100 (antes de escala)', () => {
    expect(rawXpForLevel('fast', 100)).toBe(800_000);
    expect(rawXpForLevel('medium-fast', 100)).toBe(1_000_000);
    expect(rawXpForLevel('slow', 100)).toBe(1_250_000);
    expect(rawXpForLevel('erratic', 100)).toBe(600_000);
    expect(rawXpForLevel('fluctuating', 100)).toBe(1_640_000);
    expect(rawXpForLevel('medium-slow', 100)).toBe(1_059_860);
  });

  it('XP_SCALE = 0.05: nivel 50 medium-fast ≈ 6250 XP (referencia del SPECS)', () => {
    expect(xpForLevel('medium-fast', 50)).toBe(6_250);
    expect(xpForLevel('medium-fast', 100)).toBe(50_000);
  });

  it('levelFromXp recupera el nivel exacto en los límites', () => {
    for (const rate of RATES) {
      for (const n of [1, 2, 10, 50, 99, 100]) {
        expect(levelFromXp(rate, xpForLevel(rate, n))).toBe(n);
      }
    }
  });

  it('las curvas son estrictamente crecientes', () => {
    for (const rate of RATES) {
      let prev = -1;
      for (let n = 1; n <= 100; n++) {
        const v = rawXpForLevel(rate, n);
        expect(v).toBeGreaterThan(prev);
        prev = v;
      }
    }
  });

  it('sessionXp aplica qualityMult y limita streakMult a 1.5', () => {
    expect(sessionXp({ focusedMinutes: 25, xpPerMinute: 10, qualityMult: 1, streakDays: 0 })).toBe(250);
    expect(sessionXp({ focusedMinutes: 25, xpPerMinute: 10, qualityMult: 1.25, streakDays: 0 })).toBe(313);
    // streak 100 días → min(1+2, 1.5) = 1.5
    expect(sessionXp({ focusedMinutes: 25, xpPerMinute: 10, qualityMult: 1, streakDays: 100 })).toBe(375);
    // racha 25 → 1.5 también
    expect(sessionXp({ focusedMinutes: 25, xpPerMinute: 10, qualityMult: 1, streakDays: 25 })).toBe(375);
  });
});
