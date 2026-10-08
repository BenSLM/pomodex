export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythical';

export type TypeId =
  | 'normal' | 'fire' | 'water' | 'electric' | 'grass' | 'ice'
  | 'fighting' | 'poison' | 'ground' | 'flying' | 'psychic' | 'bug'
  | 'rock' | 'ghost' | 'dragon' | 'dark' | 'steel' | 'fairy';

export type GrowthRate =
  | 'fast' | 'medium-fast' | 'medium' | 'medium-slow' | 'slow' | 'erratic' | 'fluctuating';

export type RegionId =
  | 'kanto' | 'johto' | 'hoenn' | 'sinnoh' | 'unova' | 'kalos' | 'alola' | 'galar' | 'paldea';

export type BallId = 'poke' | 'great' | 'ultra' | 'master';

export type ItemId =
  | 'potion' | 'revive' | 'streakShield' | 'incense' | 'berry'
  | 'fireStone' | 'waterStone' | 'thunderStone' | 'leafStone' | 'moonStone' | 'sunStone' | 'shinyStone' | 'duskStone' | 'dawnStone' | 'iceStone' | 'linkCable';

export type SessionMode = 'pomodoro' | 'flow';

export interface Profile {
  id: 'me';
  trainerName: string;
  createdAt: number;
  coins: number;
  totalFocusMinutes: number;
  totalSessions: number;
  companionId: string | null;
  teamIds: string[];
  currentRegion: RegionId;
  schemaVersion: number;
  pityCount: number;
}

export interface OwnedCreature {
  id: string;
  speciesId: number;
  nickname?: string;
  level: number;
  xp: number;
  shiny: boolean;
  friendship: number;
  caughtAt: number;
  caughtWith: BallId;
  categoryId?: string;
  faintedUntil?: number;
  onExpeditionId?: string;
}

export interface DexEntry {
  speciesId: number;
  seen: boolean;
  caught: boolean;
  shinyCaught: boolean;
  firstSeenAt?: number;
  firstCaughtAt?: number;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  affinityTypes: TypeId[];
}

export interface SessionRecord {
  id: string;
  categoryId: string;
  goalId?: string;
  mode: SessionMode;
  plannedMs: number;
  focusedMs: number;
  overtimeMs: number;
  startedAt: number;
  endedAt: number;
  pauseCount: number;
  distractionCount: number;
  quality: number;
  outcome: 'completed' | 'abandoned';
  xp?: number;
  coins?: number;
  note?: string;
}

export interface ActiveSession {
  id: string;
  state: 'focusing' | 'paused' | 'break';
  categoryId: string;
  goalId?: string;
  mode: SessionMode;
  plannedMs: number;
  startedAt: number;
  pausedAt?: number;
  pausedAccumulatedMs: number;
  pauseCount: number;
  distractionCount: number;
}

export interface Egg {
  id: string;
  speciesId: number;
  requiredMinutes: number;
  progressMinutes: number;
  obtainedFrom: 'drop' | 'quest' | 'streak' | 'shop' | 'achievement';
}

export interface Encounter {
  id: string;
  speciesId: number;
  shiny: boolean;
  level: number;
  throwsLeft: number;
  expiresAt: number;
}

export interface Inventory {
  id: string;
  balls: Record<BallId, number>;
  items: Record<ItemId, number>;
  /** cargas restantes de incienso (1 ítem = 5 encuentros con rareza +, §7.3) */
  incenseCharges?: number;
}

export interface StreakState {
  current: number;
  best: number;
  lastCreditedDay: string | null;
}

export interface PendingEvolution {
  creatureId: string;
  options: { toSpeciesId: number }[];
}

export interface Goal {
  id: string;
  name: string;
  categoryId?: string;
  targetMinutes: number;
  progressMinutes: number;
  rewardBadge?: string;
  completedAt?: number;
}

export interface GymProgress {
  region: RegionId;
  bossId: string;
  damageMinutes: number;
  defeatedAt?: number;
}

export interface Expedition {
  id: string;
  creatureIds: string[];
  tier: 1 | 2 | 3;
  requiredFocusMinutes: number;
  progressMinutes: number;
  startedAt: number;
  claimed: boolean;
}

export interface QuestInstance {
  id: string;
  templateId: string;
  period: 'daily' | 'weekly' | 'story';
  progress: number;
  target: number;
  resetAt?: number;
  claimed: boolean;
}

export interface Settings {
  id: 'me';
  locale: 'es' | 'en';
  timer: TimerSettings;
  theme: ThemeSettings;
  rewards: RewardConfig;
  modes: { nuzlocke: boolean; strictFocus: boolean; flowTimer: boolean };
  notifications: { enabled: boolean; sound: boolean };
  dayRolloverHour: number;
}

export interface TimerSettings {
  focusMin: number;
  breakMin: number;
  longBreakMin: number;
  cyclesBeforeLong: number;
}

export interface ThemeSettings {
  theme: 'classic' | 'ocean' | 'fire' | 'forest' | 'dark' | 'custom';
  uiStyle: 'modern' | 'retro' | 'pixel';
  custom: { primary: string; accent: string; bg: string; surface: string };
}

export interface RewardConfig {
  preset: 'casual' | 'normal' | 'hardcore' | 'custom';
  xpPerMinute: number;
  xpScale: number;
  teamXpShare: number;
  coinsPer25min: number;
  minValidMinutes: number;
  completionThreshold: number;
  abandonCreditRatio: number;
  shinyRate: number;
  encounterChance: number;
  encounterTtlHours: number;
  throwsPerEncounter: number;
  eggDropChance: number;
  pityThreshold: number;
  regionPace: number;
  streakMinMinutes: number;
  qualityMult: { perfect: number; good: number; poor: number };
  rarityWeights: Record<Rarity, number>;
}

export interface GameState {
  profile: Profile;
  creatures: OwnedCreature[];
  dex: DexEntry[];
  inventory: Inventory;
  streak: StreakState;
  pendingEvolutions: PendingEvolution[];
  eggs: Egg[];
}
