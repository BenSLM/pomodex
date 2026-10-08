import { describe, expect, it } from 'vitest';
import { FakeClock } from '../src/core/clock';
import {
  autoCompleteTime,
  elapsedMs,
  finishSession,
  isDone,
  overtimeMs,
  pause,
  resume,
  startSession,
} from '../src/core/timer/machine';
import { DEFAULT_REWARD_CONFIG } from '../src/core/rewards/config';
import type { TimerSettings } from '../src/core/types';

const timer: TimerSettings = { focusMin: 25, breakMin: 5, longBreakMin: 15, cyclesBeforeLong: 4 };
const cfg = DEFAULT_REWARD_CONFIG;

function fresh(clock = new FakeClock(1_000_000)) {
  const s = startSession({ categoryId: 'study', mode: 'pomodoro', timer, now: clock.now(), id: 's1' });
  return { clock, s };
}

describe('máquina de estados del timer (§6)', () => {
  it('el tiempo se calcula por timestamps, nunca acumulando setInterval', () => {
    const { clock, s } = fresh();
    expect(elapsedMs(s, clock.now() + 60_000)).toBe(60_000);
    const p = pause(s, clock.now() + 60_000);
    // en pausa el tiempo no avanza
    expect(elapsedMs(p, clock.now() + 10 * 60_000)).toBe(60_000);
    const r = resume(p, clock.now() + 10 * 60_000);
    expect(elapsedMs(r, clock.now() + 11 * 60_000)).toBe(2 * 60_000);
    expect(r.pauseCount).toBe(1);
  });

  it('la sesión se completa al llegar a plannedMs', () => {
    const { clock, s } = fresh();
    const doneAt = clock.now() + 25 * 60_000;
    expect(isDone(s, doneAt)).toBe(true);
    expect(isDone(s, doneAt - 1_000)).toBe(false);
  });

  it('finishSession: completed al 90 %, abandoned por debajo', () => {
    const { clock, s } = fresh();
    const doneAt = clock.now() + 25 * 60_000;
    const ok = finishSession(s, doneAt, cfg, { strictFocus: false });
    expect(ok.outcome).toBe('completed');
    expect(ok.focusedMs).toBe(25 * 60_000);
    expect(ok.quality).toBe(100);

    const early = finishSession(s, clock.now() + 20 * 60_000, cfg, { strictFocus: false });
    expect(early.outcome).toBe('abandoned');
  });

  it('auto-complete usa startedAt + pausedAcc + planned (§6.2)', () => {
    const { clock, s } = fresh();
    const p = pause(s, clock.now() + 10 * 60_000);
    const r = resume(p, clock.now() + 12 * 60_000);
    expect(autoCompleteTime(r)).toBe(r.startedAt + 2 * 60_000 + 25 * 60_000);
  });

  it('el modo flow acumula overtime', () => {
    const s = startSession({ categoryId: 'study', mode: 'flow', timer, now: 0, id: 'f1' });
    expect(overtimeMs(s, 30 * 60_000)).toBe(5 * 60_000);
    const rec = finishSession(s, 30 * 60_000, cfg, { strictFocus: false });
    expect(rec.outcome).toBe('completed');
    expect(rec.focusedMs).toBe(30 * 60_000);
    expect(rec.overtimeMs).toBe(5 * 60_000);
  });

  it('las pausas restan calidad (−10 cada una, máx −30)', () => {
    const { clock, s } = fresh();
    let cur = s;
    for (let i = 0; i < 2; i++) {
      cur = pause(cur, clock.now() + (i + 1) * 1_000);
      cur = resume(cur, clock.now() + (i + 1) * 1_000 + 500);
    }
    const rec = finishSession(cur, clock.now() + 25 * 60_000, cfg, { strictFocus: false });
    expect(rec.quality).toBe(80);
  });
});
