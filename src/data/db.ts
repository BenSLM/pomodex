import Dexie, { type Table } from 'dexie';
import type {
  ActiveSession,
  Category,
  DexEntry,
  Egg,
  Encounter,
  Expedition,
  Goal,
  GymProgress,
  Inventory,
  OwnedCreature,
  Profile,
  QuestInstance,
  SessionRecord,
  Settings,
} from '../core/types';

export interface MetaRow {
  key: string;
  value: unknown;
}

export class FocusDb extends Dexie {
  profile!: Table<Profile, string>;
  creatures!: Table<OwnedCreature, string>;
  dex!: Table<DexEntry, number>;
  sessions!: Table<SessionRecord, string>;
  activeSession!: Table<ActiveSession, string>;
  categories!: Table<Category, string>;
  eggs!: Table<Egg, string>;
  encounters!: Table<Encounter, string>;
  inventory!: Table<Inventory, string>;
  gymProgress!: Table<GymProgress, string>;
  goals!: Table<Goal, string>;
  expeditions!: Table<Expedition, string>;
  quests!: Table<QuestInstance, string>;
  achievements!: Table<{ id: string; unlockedAt: number }, string>;
  settings!: Table<Settings, string>;
  meta!: Table<MetaRow, string>;

  constructor() {
    super('focus-trainer');
    this.version(1).stores({
      profile: 'id',
      creatures: 'id, speciesId, caughtAt',
      dex: 'speciesId',
      sessions: 'id, startedAt, categoryId, outcome',
      activeSession: 'id',
      categories: 'id',
      eggs: 'id',
      encounters: 'id',
      inventory: 'id',
      gymProgress: '[region+bossId]',
      goals: 'id',
      expeditions: 'id',
      quests: 'id, period',
      achievements: 'id',
      settings: 'id',
      meta: 'key',
    });
  }
}

export const db = new FocusDb();
