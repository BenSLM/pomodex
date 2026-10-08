import { db } from './db';
import { DEFAULT_CATEGORIES, defaultInventory, defaultProfile, defaultSettings, defaultStreak } from './defaults';
import type { Category, GameState, Settings, StreakState, PendingEvolution } from '../core/types';
import type { ActiveSession, SessionRecord } from '../core/types';
import { finishSession } from '../core/timer/machine';
import { applySessionRewards, type RewardSummary } from '../core/rewards/pipeline';
import { SystemClock } from '../core/clock';
import { mulberry32 } from '../core/rng';
import { dataset } from './dataset';

export async function ensureSeeded(): Promise<void> {
  const now = Date.now();
  if (!(await db.profile.get('me'))) await db.profile.put(defaultProfile(now));
  if (!(await db.inventory.get('me'))) await db.inventory.put(defaultInventory());
  if (!(await db.settings.get('me'))) await db.settings.put(defaultSettings());
  if ((await db.categories.count()) === 0) await db.categories.bulkAdd(DEFAULT_CATEGORIES);
  if (!(await db.meta.get('streak'))) await db.meta.put({ key: 'streak', value: defaultStreak() });
}

export async function getSettings(): Promise<Settings> {
  return (await db.settings.get('me')) ?? defaultSettings();
}

export async function getCategories(): Promise<Category[]> {
  const list = await db.categories.toArray();
  return list.length > 0 ? list : DEFAULT_CATEGORIES;
}

export async function loadGameState(): Promise<GameState> {
  const profile = (await db.profile.get('me')) ?? defaultProfile(Date.now());
  const inventory = (await db.inventory.get('me')) ?? defaultInventory();
  const creatures = await db.creatures.toArray();
  const dex = await db.dex.toArray();
  const eggs = await db.eggs.toArray();
  const streak = ((await db.meta.get('streak'))?.value as StreakState | undefined) ?? defaultStreak();
  const pendingEvolutions =
    ((await db.meta.get('pendingEvolutions'))?.value as PendingEvolution[] | undefined) ?? [];
  return { profile, inventory, creatures, dex, eggs, streak, pendingEvolutions };
}

async function saveGameState(state: GameState): Promise<void> {
  await db.profile.put(state.profile);
  await db.inventory.put(state.inventory);
  await db.creatures.bulkPut(state.creatures);
  await db.dex.bulkPut(state.dex);
  await db.meta.put({ key: 'streak', value: state.streak });
  await db.meta.put({ key: 'pendingEvolutions', value: state.pendingEvolutions });
  await db.eggs.clear();
  if (state.eggs.length > 0) await db.eggs.bulkPut(state.eggs);
}

/** §3.3 — todo el resultado de la sesión se persiste en una sola transacción. */
export async function resolveSession(
  active: ActiveSession,
  recordOverride?: SessionRecord,
): Promise<{ record: SessionRecord; summary: RewardSummary }> {
  const [settings, categories] = await Promise.all([getSettings(), getCategories()]);
  const state = await loadGameState();
  const clock = new SystemClock();
  const record =
    recordOverride ??
    finishSession(active, clock.now(), settings.rewards, {
      strictFocus: settings.modes.strictFocus,
    });

  const { state: next, summary } = applySessionRewards(state, record, settings.rewards, {
    rng: mulberry32((record.startedAt ^ (record.focusedMs | 0)) >>> 0),
    clock,
    dataset,
    rolloverHour: settings.dayRolloverHour,
    categories,
  });
  const fullRecord: SessionRecord = { ...record, xp: summary.xpCompanion, coins: summary.coins };

  await db.transaction(
    'rw',
    [db.profile, db.inventory, db.creatures, db.dex, db.meta, db.eggs, db.encounters, db.sessions, db.activeSession],
    async () => {
      await saveGameState(next);
      if (summary.encounter) await db.encounters.add(summary.encounter);
      await db.sessions.add(fullRecord);
      await db.activeSession.clear();
      await db.profile.update('me', {
        totalFocusMinutes: state.profile.totalFocusMinutes + Math.round(record.focusedMs / 60_000),
        totalSessions: state.profile.totalSessions + 1,
      });
    },
  );

  return { record: fullRecord, summary };
}

export async function saveActiveSession(session: ActiveSession): Promise<void> {
  await db.activeSession.put(session);
}

export async function clearActiveSession(): Promise<void> {
  await db.activeSession.clear();
}
