import { z } from 'zod';
import { db } from './db';
import { defaultSettings } from './defaults';
import type { ActiveSession, Category, DexEntry, Egg, Encounter, Goal, Inventory, Profile, QuestInstance, SessionRecord, Settings, StreakState, PendingEvolution } from '../core/types';

const rarity = z.enum(['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythical']);
const typeId = z.enum([
  'normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison',
  'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy',
]);
const ballId = z.enum(['poke', 'great', 'ultra', 'master']);
const itemId = z.enum([
  'potion', 'revive', 'streakShield', 'incense', 'berry',
  'fireStone', 'waterStone', 'thunderStone', 'leafStone', 'moonStone', 'sunStone', 'shinyStone', 'duskStone', 'dawnStone', 'iceStone', 'linkCable',
]);

const profileSchema = z.object({
  id: z.literal('me'),
  trainerName: z.string(),
  createdAt: z.number(),
  coins: z.number(),
  totalFocusMinutes: z.number(),
  totalSessions: z.number(),
  companionId: z.string().nullable(),
  teamIds: z.array(z.string()),
  currentRegion: z.string(),
  schemaVersion: z.number(),
  pityCount: z.number().default(0),
});

const ownedCreatureSchema = z.object({
  id: z.string(),
  speciesId: z.number(),
  nickname: z.string().optional(),
  level: z.number(),
  xp: z.number(),
  shiny: z.boolean(),
  friendship: z.number(),
  caughtAt: z.number(),
  caughtWith: ballId,
  categoryId: z.string().optional(),
  faintedUntil: z.number().optional(),
  onExpeditionId: z.string().optional(),
});

const dexEntrySchema = z.object({
  speciesId: z.number(),
  seen: z.boolean(),
  caught: z.boolean(),
  shinyCaught: z.boolean(),
  firstSeenAt: z.number().optional(),
  firstCaughtAt: z.number().optional(),
});

const qualityMultSchema = z.object({ perfect: z.number(), good: z.number(), poor: z.number() });

const rewardConfigSchema = z.object({
  preset: z.enum(['casual', 'normal', 'hardcore', 'custom']),
  xpPerMinute: z.number(),
  xpScale: z.number(),
  teamXpShare: z.number(),
  coinsPer25min: z.number(),
  minValidMinutes: z.number(),
  completionThreshold: z.number(),
  abandonCreditRatio: z.number(),
  shinyRate: z.number(),
  encounterChance: z.number(),
  encounterTtlHours: z.number(),
  throwsPerEncounter: z.number(),
  eggDropChance: z.number(),
  pityThreshold: z.number(),
  regionPace: z.number(),
  streakMinMinutes: z.number(),
  qualityMult: qualityMultSchema,
  rarityWeights: z.record(rarity, z.number()),
});

const settingsSchema = z.object({
  id: z.literal('me'),
  locale: z.enum(['es', 'en']),
  timer: z.object({
    focusMin: z.number(),
    breakMin: z.number(),
    longBreakMin: z.number(),
    cyclesBeforeLong: z.number(),
  }),
  theme: z.object({
    theme: z.enum(['classic', 'ocean', 'fire', 'forest', 'dark', 'custom']),
    uiStyle: z.enum(['modern', 'retro', 'pixel']),
    custom: z.object({ primary: z.string(), accent: z.string(), bg: z.string(), surface: z.string() }),
  }),
  rewards: rewardConfigSchema,
  modes: z.object({ nuzlocke: z.boolean(), strictFocus: z.boolean(), flowTimer: z.boolean() }),
  notifications: z.object({ enabled: z.boolean(), sound: z.boolean() }),
  dayRolloverHour: z.number(),
});

const sessionRecordSchema = z.object({
  id: z.string(),
  categoryId: z.string(),
  goalId: z.string().optional(),
  mode: z.enum(['pomodoro', 'flow']),
  plannedMs: z.number(),
  focusedMs: z.number(),
  overtimeMs: z.number().default(0),
  startedAt: z.number(),
  endedAt: z.number(),
  pauseCount: z.number(),
  distractionCount: z.number(),
  quality: z.number(),
  outcome: z.enum(['completed', 'abandoned']),
  xp: z.number().default(0),
  coins: z.number().default(0),
  note: z.string().optional(),
});

const activeSessionSchema = z.object({
  id: z.string(),
  state: z.enum(['focusing', 'paused', 'break']),
  categoryId: z.string(),
  goalId: z.string().optional(),
  mode: z.enum(['pomodoro', 'flow']),
  plannedMs: z.number(),
  startedAt: z.number(),
  pausedAt: z.number().optional(),
  pausedAccumulatedMs: z.number(),
  pauseCount: z.number(),
  distractionCount: z.number(),
});

const categorySchema = z.object({
  id: z.string(),
  name: z.string(),
  icon: z.string(),
  color: z.string(),
  affinityTypes: z.array(typeId),
});

const eggSchema = z.object({
  id: z.string(),
  speciesId: z.number(),
  requiredMinutes: z.number(),
  progressMinutes: z.number(),
  obtainedFrom: z.enum(['drop', 'quest', 'streak', 'shop', 'achievement']),
});

const encounterSchema = z.object({
  id: z.string(),
  speciesId: z.number(),
  shiny: z.boolean(),
  level: z.number(),
  throwsLeft: z.number(),
  expiresAt: z.number(),
});

const inventorySchema = z.object({
  id: z.string(),
  balls: z.record(ballId, z.number()),
  items: z.record(itemId, z.number()),
  incenseCharges: z.number().optional(),
});

const goalSchema = z.object({
  id: z.string(),
  name: z.string(),
  categoryId: z.string().optional(),
  targetMinutes: z.number(),
  progressMinutes: z.number(),
  rewardBadge: z.string().optional(),
  completedAt: z.number().optional(),
});

const questSchema = z.object({
  id: z.string(),
  templateId: z.string(),
  period: z.enum(['daily', 'weekly', 'story']),
  progress: z.number(),
  target: z.number(),
  resetAt: z.number().optional(),
  claimed: z.boolean(),
});

const streakSchema = z.object({ current: z.number(), best: z.number(), lastCreditedDay: z.string().nullable() });
const pendingEvolutionsSchema = z.array(
  z.object({ creatureId: z.string(), options: z.array(z.object({ toSpeciesId: z.number() })) }),
);

export const backupSchema = z.object({
  format: z.literal('focus-trainer-backup'),
  schemaVersion: z.number(),
  exportedAt: z.number(),
  tables: z.object({
    profile: profileSchema,
    creatures: z.array(ownedCreatureSchema),
    dex: z.array(dexEntrySchema),
    sessions: z.array(sessionRecordSchema),
    activeSession: activeSessionSchema.nullable(),
    categories: z.array(categorySchema),
    eggs: z.array(eggSchema),
    encounters: z.array(encounterSchema),
    inventory: inventorySchema,
    goals: z.array(goalSchema),
    quests: z.array(questSchema),
    settings: settingsSchema,
    streak: streakSchema,
    pendingEvolutions: pendingEvolutionsSchema,
  }),
});

export type Backup = z.infer<typeof backupSchema>;

export async function exportBackup(): Promise<Backup> {
  const [profile, creatures, dex, sessions, active, categories, eggs, encounters, inventory, goals, quests, settings] =
    await Promise.all([
      db.profile.get('me'),
      db.creatures.toArray(),
      db.dex.toArray(),
      db.sessions.toArray(),
      db.activeSession.toCollection().first(),
      db.categories.toArray(),
      db.eggs.toArray(),
      db.encounters.toArray(),
      db.inventory.get('me'),
      db.goals.toArray(),
      db.quests.toArray(),
      db.settings.get('me'),
    ]);
  if (!profile) throw new Error('No hay perfil todavía');
  const streak = ((await db.meta.get('streak'))?.value as StreakState | undefined) ?? { current: 0, best: 0, lastCreditedDay: null };
  const pendingEvolutions = ((await db.meta.get('pendingEvolutions'))?.value as PendingEvolution[] | undefined) ?? [];

  return {
    format: 'focus-trainer-backup',
    schemaVersion: profile.schemaVersion,
    exportedAt: Date.now(),
    tables: {
      profile,
      creatures,
      dex,
      sessions: sessions.map((s) => ({ ...s, xp: s.xp ?? 0, coins: s.coins ?? 0 })),
      activeSession: active ?? null,
      categories,
      eggs,
      encounters,
      inventory: inventory ?? { id: 'me', balls: {}, items: {} },
      goals: goals as Goal[],
      quests: quests as QuestInstance[],
      settings: settings ?? defaultSettings(),
      streak,
      pendingEvolutions,
    },
  };
}

export function validateBackup(raw: unknown): Backup {
  return backupSchema.parse(raw);
}

/** Importa un backup validado, sobrescribiendo todo. Devuelve el backup anterior. */
export async function importBackup(backup: Backup): Promise<Backup> {
  const previous = await exportBackup();
  const t = backup.tables;
  await db.transaction(
    'rw',
    [db.profile, db.creatures, db.dex, db.sessions, db.activeSession, db.categories, db.eggs, db.encounters, db.inventory, db.goals, db.quests, db.settings, db.meta],
    async () => {
      await db.profile.put(t.profile as Profile);
      await db.creatures.bulkPut(t.creatures as never[]);
      await db.dex.bulkPut(t.dex as DexEntry[]);
      await db.sessions.bulkPut(t.sessions as SessionRecord[]);
      await db.activeSession.clear();
      if (t.activeSession) await db.activeSession.put(t.activeSession as ActiveSession);
      await db.categories.bulkPut(t.categories as Category[]);
      await db.eggs.clear();
      await db.eggs.bulkPut(t.eggs as Egg[]);
      await db.encounters.bulkPut(t.encounters as Encounter[]);
      await db.inventory.put(t.inventory as Inventory);
      await db.goals.clear();
      await db.goals.bulkPut(t.goals as Goal[]);
      await db.quests.clear();
      await db.quests.bulkPut(t.quests as QuestInstance[]);
      await db.settings.put(t.settings as Settings);
      await db.meta.put({ key: 'streak', value: t.streak });
      await db.meta.put({ key: 'pendingEvolutions', value: t.pendingEvolutions });
    },
  );
  return previous;
}

export function backupFilename(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `focus-trainer-backup-${y}-${m}-${d}.json`;
}
