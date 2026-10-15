import { describe, expect, it } from 'vitest';
import { levelFromXp, rawXpForLevel, sessionXp, xpForLevel } from '../src/core/xp';

describe('curva de experiencia única (§7.1)', () => {
  it('curva medium: XP total bruta = n³', () => {
    expect(rawXpForLevel(50)).toBe(125_000);
    expect(rawXpForLevel(100)).toBe(1_000_000);
    expect(rawXpForLevel(1)).toBe(1);
  });

  it('xpScale por defecto (0.25): nivel 50 = 31 250 XP, nivel 100 = 250 000 XP', () => {
    expect(xpForLevel(50)).toBe(31_250);
    expect(xpForLevel(100)).toBe(250_000);
    expect(xpForLevel(1)).toBe(0);
  });

  it('levelFromXp(xpForLevel(n)) === n (sin floor, roundtrip exacto)', () => {
    for (const n of [1, 2, 10, 50, 99, 100]) {
      expect(levelFromXp(xpForLevel(n))).toBe(n);
    }
  });

  it('respeta un xpScale distinto', () => {
    expect(xpForLevel(50, 0.05)).toBe(6_250);
    expect(levelFromXp(6_250, 0.05)).toBe(50);
  });

  it('la curva es estrictamente creciente (niveles 1-100)', () => {
    let prev = -1;
    for (let n = 1; n <= 100; n++) {
      const v = xpForLevel(n, 0.25);
      expect(v).toBeGreaterThan(prev);
      prev = v;
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
