import { describe, expect, it } from 'vitest';
import { dayKey, updateStreak } from '../src/core/streak';
import { DEFAULT_REWARD_CONFIG } from '../src/core/rewards/config';

const cfg = DEFAULT_REWARD_CONFIG;

describe('rachas (§7.8)', () => {
  it('el día lógico cambia en dayRolloverHour', () => {
    const twoAm = new Date(2026, 4, 1, 2, 0, 0).getTime();
    const fiveAm = new Date(2026, 4, 1, 5, 0, 0).getTime();
    expect(dayKey(twoAm, 4)).toBe('2026-04-30');
    expect(dayKey(fiveAm, 4)).toBe('2026-05-01');
  });

  const base = { current: 0, best: 0, lastCreditedDay: null as string | null };

  it('primer día válido inicia la racha en 1', () => {
    const now = new Date(2026, 4, 1, 10, 0).getTime();
    const r = updateStreak({ streak: base, focusedMinutes: 30, now, config: cfg, rolloverHour: 4, shieldAvailable: false });
    expect(r.streak.current).toBe(1);
    expect(r.credited).toBe(true);
  });

  it('no acredita si no alcanza streakMinMinutes (25)', () => {
    const now = new Date(2026, 4, 1, 10, 0).getTime();
    const r = updateStreak({ streak: base, focusedMinutes: 20, now, config: cfg, rolloverHour: 4, shieldAvailable: false });
    expect(r.credited).toBe(false);
    expect(r.streak.current).toBe(0);
  });

  it('días consecutivos suman; el mismo día no duplica', () => {
    const d1 = new Date(2026, 4, 1, 10, 0).getTime();
    const d2 = new Date(2026, 4, 2, 10, 0).getTime();
    const r1 = updateStreak({ streak: base, focusedMinutes: 30, now: d1, config: cfg, rolloverHour: 4, shieldAvailable: false });
    const again = updateStreak({ streak: r1.streak, focusedMinutes: 30, now: d1 + 3_600_000, config: cfg, rolloverHour: 4, shieldAvailable: false });
    expect(again.credited).toBe(false);
    const r2 = updateStreak({ streak: r1.streak, focusedMinutes: 30, now: d2, config: cfg, rolloverHour: 4, shieldAvailable: false });
    expect(r2.streak.current).toBe(2);
    expect(r2.streak.best).toBe(2);
  });

  it('un hueco reinicia a 1, salvo escudo de racha', () => {
    const d1 = new Date(2026, 4, 1, 10, 0).getTime();
    const d2 = new Date(2026, 4, 2, 10, 0).getTime();
    const d5 = new Date(2026, 4, 5, 10, 0).getTime();
    const r1 = updateStreak({ streak: base, focusedMinutes: 30, now: d1, config: cfg, rolloverHour: 4, shieldAvailable: false });
    const r2 = updateStreak({ streak: r1.streak, focusedMinutes: 30, now: d2, config: cfg, rolloverHour: 4, shieldAvailable: false });

    const broken = updateStreak({ streak: r2.streak, focusedMinutes: 30, now: d5, config: cfg, rolloverHour: 4, shieldAvailable: false });
    expect(broken.streak.current).toBe(1);

    const shielded = updateStreak({ streak: r2.streak, focusedMinutes: 30, now: d5, config: cfg, rolloverHour: 4, shieldAvailable: true });
    expect(shielded.streak.current).toBe(3);
    expect(shielded.shieldUsed).toBe(true);
  });
});
