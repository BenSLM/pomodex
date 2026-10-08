import { create } from 'zustand';
import type { ActiveSession, RewardConfig, SessionMode, TimerSettings } from '../../core/types';
import {
  autoCompleteTime,
  breakDurationMs,
  elapsedMs,
  finishSession,
  isDone,
  pause as pauseMachine,
  resume as resumeMachine,
  startSession,
} from '../../core/timer/machine';
import type { RewardSummary } from '../../core/rewards/pipeline';
import { getSettings, resolveSession, saveActiveSession } from '../../data/game';
import { db } from '../../data/db';

export type UiRewardSummary = RewardSummary & { finishedAgoMs?: number };

interface TimerState {
  active: ActiveSession | null;
  cycleCount: number;
  breakEndsAt: number | null;
  summary: UiRewardSummary | null;
  bootstrapped: boolean;
  init: () => Promise<void>;
  start: (categoryId: string, mode: SessionMode) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  finish: () => Promise<void>;
  abandon: () => Promise<void>;
  skipBreak: () => void;
  markDistraction: () => Promise<void>;
  dismissSummary: () => void;
}

export const useTimerStore = create<TimerState>((set, get) => ({
  active: null,
  cycleCount: 0,
  breakEndsAt: null,
  summary: null,
  bootstrapped: false,

  init: async () => {
    if (get().bootstrapped) return;
    const stored = await db.activeSession.toCollection().first();
    if (!stored) {
      set({ bootstrapped: true });
      return;
    }
    const now = Date.now();
    const settings = await getSettings();
    const done = stored.state === 'focusing' && stored.mode !== 'flow' && elapsedMs(stored, now) >= stored.plannedMs;
    if (done) {
      // §6.2 — al recargar se completa con endedAt = startedAt + pausedAcc + plannedMs
      const record = finishSession(stored, autoCompleteTime(stored), settings.rewards, {
        strictFocus: settings.modes.strictFocus,
      });
      const { summary } = await resolveSession(stored, record);
      set({
        active: null,
        bootstrapped: true,
        summary: { ...summary, finishedAgoMs: now - record.endedAt },
      });
      return;
    }
    set({ active: stored, bootstrapped: true });
  },

  start: async (categoryId, mode) => {
    const settings = await getSettings();
    const active = startSession({
      categoryId,
      mode,
      timer: settings.timer,
      now: Date.now(),
      id: `s-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,
    });
    await saveActiveSession(active);
    set({ active, summary: null, breakEndsAt: null });
  },

  pause: async () => {
    const { active } = get();
    if (!active) return;
    const next = pauseMachine(active, Date.now());
    await saveActiveSession(next);
    set({ active: next });
  },

  resume: async () => {
    const { active } = get();
    if (!active) return;
    const next = resumeMachine(active, Date.now());
    await saveActiveSession(next);
    set({ active: next });
  },

  finish: async () => {
    const { active, cycleCount } = get();
    if (!active) return;
    const settings = await getSettings();
    const now = Date.now();
    const auto = active.mode !== 'flow' && isDone(active, now);
    const record = finishSession(active, auto ? autoCompleteTime(active) : now, settings.rewards, {
      strictFocus: settings.modes.strictFocus,
    });
    const { summary } = await resolveSession(active, record);
    const isBreakWorthy = record.outcome === 'completed' && record.mode === 'pomodoro';
    const newCycles = isBreakWorthy ? cycleCount + 1 : 0;
    set({
      active: null,
      cycleCount: newCycles,
      breakEndsAt: isBreakWorthy ? now + breakDurationMs(newCycles, settings.timer) : null,
      summary,
    });
  },

  abandon: async () => {
    const { active } = get();
    if (!active) return;
    const settings = await getSettings();
    const record = finishSession(active, Date.now(), settings.rewards, {
      strictFocus: settings.modes.strictFocus,
      outcome: 'abandoned',
    });
    const { summary } = await resolveSession(active, record);
    set({ active: null, breakEndsAt: null, summary });
  },

  skipBreak: () => set({ breakEndsAt: null }),

  markDistraction: async () => {
    const { active } = get();
    if (!active || active.state !== 'focusing') return;
    const next = { ...active, distractionCount: active.distractionCount + 1 };
    await saveActiveSession(next);
    set({ active: next });
  },

  dismissSummary: () => set({ summary: null }),
}));

export function elapsedOf(active: ActiveSession | null, now: number): number {
  return active ? elapsedMs(active, now) : 0;
}

export type { RewardConfig, TimerSettings };
