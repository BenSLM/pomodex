import type { Inventory, Profile, RewardConfig, Settings, StreakState } from '../core/types';
import { DEFAULT_REWARD_CONFIG } from '../core/rewards/config';

export function defaultProfile(now: number): Profile {
  return {
    id: 'me',
    trainerName: 'Entrenador',
    createdAt: now,
    coins: 0,
    totalFocusMinutes: 0,
    totalSessions: 0,
    companionId: null,
    teamIds: [],
    currentRegion: 'kanto',
    schemaVersion: 1,
    pityCount: 0,
  };
}

export function defaultInventory(): Inventory {
  return {
    id: 'me',
    balls: { poke: 5, great: 0, ultra: 0, master: 0 },
    items: {
      potion: 0, revive: 0, streakShield: 0, incense: 0, lure: 0, berry: 0,
      fireStone: 0, waterStone: 0, thunderStone: 0, leafStone: 0, moonStone: 0,
      sunStone: 0, shinyStone: 0, duskStone: 0, dawnStone: 0, iceStone: 0, linkCable: 0,
    },
    incenseCharges: 0,
  };
}

export function defaultStreak(): StreakState {
  return { current: 0, best: 0, lastCreditedDay: null };
}

export function defaultSettings(): Settings {
  return {
    id: 'me',
    locale: 'es',
    timer: { focusMin: 25, breakMin: 5, longBreakMin: 15, cyclesBeforeLong: 4 },
    theme: {
      theme: 'classic',
      uiStyle: 'modern',
      custom: { primary: '#3C5AA6', accent: '#FFCB05', bg: '#F5F5F0', surface: '#FFFFFF' },
    },
    rewards: { ...DEFAULT_REWARD_CONFIG } satisfies RewardConfig,
    modes: { nuzlocke: false, strictFocus: false, flowTimer: true },
    notifications: { enabled: true, sound: true },
    dayRolloverHour: 4,
  };
}
