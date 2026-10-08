import type { ActiveSession, RewardConfig, SessionMode, SessionRecord, TimerSettings } from '../types';
import { computeQuality, qualityLabel, isValidSession } from '../quality';

export function plannedMsFor(_mode: SessionMode, timer: TimerSettings): number {
  return timer.focusMin * 60_000;
}

export function startSession(params: {
  categoryId: string;
  mode: SessionMode;
  timer: TimerSettings;
  now: number;
  id: string;
  goalId?: string;
}): ActiveSession {
  return {
    id: params.id,
    state: 'focusing',
    categoryId: params.categoryId,
    goalId: params.goalId,
    mode: params.mode,
    plannedMs: plannedMsFor(params.mode, params.timer),
    startedAt: params.now,
    pausedAccumulatedMs: 0,
    pauseCount: 0,
    distractionCount: 0,
  };
}

/** §6.2 — elapsed = (pausedAt ?? now) - startedAt - pausedAccumulatedMs. */
export function elapsedMs(session: ActiveSession, now: number): number {
  const end = session.pausedAt ?? now;
  return Math.max(0, end - session.startedAt - session.pausedAccumulatedMs);
}

export function overtimeMs(session: ActiveSession, now: number): number {
  return Math.max(0, elapsedMs(session, now) - session.plannedMs);
}

export function pause(session: ActiveSession, now: number): ActiveSession {
  if (session.state !== 'focusing') return session;
  return { ...session, state: 'paused', pausedAt: now, pauseCount: session.pauseCount + 1 };
}

export function resume(session: ActiveSession, now: number): ActiveSession {
  if (session.state !== 'paused' || session.pausedAt == null) return session;
  const pausedAt = session.pausedAt;
  const rest: ActiveSession = { ...session };
  delete rest.pausedAt;
  return {
    ...rest,
    state: 'focusing',
    pausedAccumulatedMs: session.pausedAccumulatedMs + (now - pausedAt),
  };
}

export function markDistraction(session: ActiveSession): ActiveSession {
  return { ...session, distractionCount: session.distractionCount + 1 };
}

/** Fin de sesión: devuelve el SessionRecord según §6.2/§6.4. */
export function finishSession(
  session: ActiveSession,
  endedAt: number,
  config: RewardConfig,
  opts: { strictFocus: boolean; outcome?: SessionRecord['outcome'] },
): SessionRecord {
  const elapsed = elapsedMs(session, endedAt);
  const overtime = Math.max(0, elapsed - session.plannedMs);
  const focusedMs = session.mode === 'flow' ? elapsed : Math.min(elapsed, session.plannedMs);
  const quality = computeQuality({
    pauseCount: session.pauseCount,
    distractionCount: session.distractionCount,
    strictFocus: opts.strictFocus,
  });
  const ratio = session.plannedMs > 0 ? focusedMs / session.plannedMs : 1;
  const outcome: SessionRecord['outcome'] =
    opts.outcome ?? (ratio >= config.completionThreshold ? 'completed' : 'abandoned');
  return {
    id: session.id,
    categoryId: session.categoryId,
    goalId: session.goalId,
    mode: session.mode,
    plannedMs: session.plannedMs,
    focusedMs,
    overtimeMs: session.mode === 'flow' ? overtime : 0,
    startedAt: session.startedAt,
    endedAt,
    pauseCount: session.pauseCount,
    distractionCount: session.distractionCount,
    quality,
    outcome,
  };
}

/** Fin por auto-completado (recarga/backgr.): endedAt = startedAt + pausedAcc + plannedMs (§6.2). */
export function autoCompleteTime(session: ActiveSession): number {
  return session.startedAt + session.pausedAccumulatedMs + session.plannedMs;
}

export function isDone(session: ActiveSession, now: number): boolean {
  return session.state === 'focusing' && elapsedMs(session, now) >= session.plannedMs;
}

export function sessionLabel(record: SessionRecord): string {
  return qualityLabel(record.quality);
}

export function sessionValid(record: SessionRecord, config: RewardConfig): boolean {
  return isValidSession(record.focusedMs, record.plannedMs, record.mode, config);
}

/** Siguiente duración de descanso según ciclo (§6.3). */
export function breakDurationMs(cycleCount: number, timer: TimerSettings): number {
  const long = timer.cyclesBeforeLong > 0 && cycleCount % timer.cyclesBeforeLong === 0;
  return (long ? timer.longBreakMin : timer.breakMin) * 60_000;
}
