import Dexie, { type Table } from 'dexie';
import type {
  ActiveSession,
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
    // v2 — se elimina el concepto de categorías (la app es solo el timer).
    this.version(2).stores({
      categories: null,
      sessions: 'id, startedAt, outcome',
    });
    // v3 — caramelos en el inventario y contador de compras diarias (Prompt 4).
    this.version(3).stores({
      inventory: 'id',
    });
  }
}

export const db = new FocusDb();
