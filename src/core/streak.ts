import type { RewardConfig, StreakState } from './types';

/** Clave de "día lógico": el día cambia en dayRolloverHour local (§7.8). */
export function dayKey(ts: number, rolloverHour: number): string {
  const d = new Date(ts - rolloverHour * 3_600_000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export interface StreakUpdate {
  streak: StreakState;
  credited: boolean;
  shieldUsed: boolean;
}

/** Acredita el día si hay foco suficiente. Escudo de racha evita el reinicio tras un hueco. */
export function updateStreak(params: {
  streak: StreakState;
  focusedMinutes: number;
  now: number;
  config: RewardConfig;
  rolloverHour: number;
  shieldAvailable: boolean;
}): StreakUpdate {
  const { streak, focusedMinutes, now, config, rolloverHour, shieldAvailable } = params;
  const today = dayKey(now, rolloverHour);
  if (streak.lastCreditedDay === today) return { streak, credited: false, shieldUsed: false };
  if (focusedMinutes < config.streakMinMinutes) return { streak, credited: false, shieldUsed: false };

  const yesterday = dayKey(now - 24 * 3_600_000, rolloverHour);
  const gap = streak.lastCreditedDay !== null && streak.lastCreditedDay !== yesterday;
  const shieldUsed = gap && shieldAvailable && streak.current > 0;
  const continues = !gap || shieldUsed;
  const current = streak.lastCreditedDay === null ? 1 : continues ? streak.current + 1 : 1;

  return {
    streak: { current, best: Math.max(streak.best, current), lastCreditedDay: today },
    credited: true,
    shieldUsed,
  };
}
