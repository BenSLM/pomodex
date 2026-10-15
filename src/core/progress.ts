import type { GameState, OwnedCreature, RewardConfig, SessionRecord } from './types';
import type { Dataset } from './dataset';
import { availableEvolutions } from './evolution';
import { dayKey } from './streak';
import { levelFromXp, MAX_LEVEL, xpForLevel } from './xp';

/** §7.1 — multiplicador de racha (`min(1 + 0.02 × días, 1.5)`). */
export function streakMultiplier(streakDays: number): number {
  return Math.min(1 + 0.02 * streakDays, 1.5);
}

/**
 * §9.7 — minutos de foco estimados para ganar `xpRemaining`.
 * Calidad asumida = Buena (×1.0) salvo que se indique otra (§7.1).
 */
export function focusMinutesForXp(
  xpRemaining: number,
  config: RewardConfig,
  opts: { streakDays?: number; qualityMult?: number } = {},
): number {
  const mult = (opts.qualityMult ?? config.qualityMult.good) * streakMultiplier(opts.streakDays ?? 0);
  const perMinute = config.xpPerMinute * mult;
  if (perMinute <= 0) return Number.POSITIVE_INFINITY;
  return Math.max(0, xpRemaining) / perMinute;
}

export interface LevelEta {
  level: number;
  remainingXp: number;
  minutes: number;
}

/** XP que falta para el siguiente nivel del Pokémon (0 si está al máximo). */
export function nextLevelEta(creature: OwnedCreature, config: RewardConfig, streakDays = 0): LevelEta {
  const level = levelFromXp(creature.xp, config.xpScale);
  const next = Math.min(MAX_LEVEL, level + 1);
  const remainingXp = Math.max(0, xpForLevel(next, config.xpScale) - creature.xp);
  return { level: next, remainingXp, minutes: focusMinutesForXp(remainingXp, config, { streakDays }) };
}

export interface EvolutionEta {
  toSpeciesId: number;
  /** Minutos estimados si la evolución es por nivel; null si es por piedra/amistad/especial. */
  minutes: number | null;
  /** Nivel requerido (solo evoluciones por nivel). */
  level: number | null;
  /** Descripción del requisito cuando no se puede estimar en tiempo. */
  requirement: string;
}

/** §7.5 — próxima evolución del Pokémon: por nivel da ETA; el resto, requisito en texto. */
export function nextEvolutionEta(
  creature: OwnedCreature,
  config: RewardConfig,
  dataset: Dataset,
  streakDays = 0,
): EvolutionEta | null {
  const edges = dataset.evolutionEdges.filter((e) => e.from === creature.speciesId && e.to !== creature.speciesId);
  if (edges.length === 0) return null;

  const levels = edges.filter((e) => e.rule.kind === 'level') as { to: number; rule: { kind: 'level'; level: number } }[];
  if (levels.length > 0) {
    const target = levels.reduce((a, b) => (b.rule.level < a.rule.level ? b : a));
    const remainingXp = Math.max(0, xpForLevel(target.rule.level, config.xpScale) - creature.xp);
    return {
      toSpeciesId: target.to,
      minutes: focusMinutesForXp(remainingXp, config, { streakDays }),
      level: target.rule.level,
      requirement: `Nv. ${target.rule.level}`,
    };
  }

  const edge = edges[0];
  const requirement =
    edge.rule.kind === 'friendship'
      ? `Amistad ${edge.rule.min}`
      : edge.rule.kind === 'special'
        ? `Especial (Nv. ${edge.rule.fallbackLevel})`
        : 'Piedra u objeto';
  return { toSpeciesId: edge.to, minutes: null, level: null, requirement };
}

/** §9.7 — formato legible: min hasta 90 min, horas hasta 48 h, luego días si hay historial. */
export function formatFocusDuration(minutes: number, hasHistory = false): string {
  if (!Number.isFinite(minutes)) return '~∞';
  const m = Math.max(0, Math.round(minutes));
  if (m <= 90) return `~${m} min`;
  const hours = minutes / 60;
  if (hours < 48) return `~${Math.round(hours)} h`;
  if (hasHistory) {
    const days = Math.round(hours / 24);
    return `~${days} día${days === 1 ? '' : 's'} a tu ritmo`;
  }
  return `~${Math.round(hours)} h`;
}

/** Días de foco distintos (con historial) según el día lógico (§7.8). */
export function focusHistoryDays(sessions: Pick<SessionRecord, 'startedAt'>[], rolloverHour: number): number {
  return new Set(sessions.map((s) => dayKey(s.startedAt, rolloverHour))).size;
}

const REGION_INFO: Record<string, { generation: number; name: string }> = {
  kanto: { generation: 1, name: 'Kanto' },
  johto: { generation: 2, name: 'Johto' },
  hoenn: { generation: 3, name: 'Hoenn' },
  sinnoh: { generation: 4, name: 'Sinnoh' },
  unova: { generation: 5, name: 'Unova' },
  kalos: { generation: 6, name: 'Kalos' },
  alola: { generation: 7, name: 'Alola' },
  galar: { generation: 8, name: 'Galar' },
  paldea: { generation: 9, name: 'Paldea' },
};

export interface NextGoal {
  id: string;
  label: string;
}

export interface GoalContext {
  state: GameState;
  dataset: Dataset;
  config: RewardConfig;
  streakDays: number;
  historyDays: number;
}

export type GoalProvider = (ctx: GoalContext) => NextGoal[];

/** 1 — evolución pendiente de confirmar o lista para evolucionar (§7.5). */
export const evolutionGoalProvider: GoalProvider = ({ state, dataset }) => {
  if (state.pendingEvolutions.length > 0) {
    const c = state.creatures.find((x) => x.id === state.pendingEvolutions[0].creatureId);
    const sp = c && dataset.byId.get(c.speciesId);
    return [{ id: 'evolution-confirm', label: `Tienes una evolución lista: ${sp?.name.es ?? 'tu Pokémon'}` }];
  }
  for (const c of state.creatures) {
    if (!availableEvolutions(dataset, c)) continue;
    const sp = dataset.byId.get(c.speciesId);
    return [{ id: `evolution-ready-${c.id}`, label: `${sp?.name.es ?? 'Tu Pokémon'} puede evolucionar` }];
  }
  return [];
};

/** 2 — siguiente evolución (por nivel) o nivel del compañero, con tiempo estimado. */
export const companionGoalProvider: GoalProvider = ({ state, dataset, config, streakDays, historyDays }) => {
  const c = state.creatures.find((x) => x.id === state.profile.companionId);
  if (!c) return [];
  const hasHistory = historyDays >= 3;
  const evo = nextEvolutionEta(c, config, dataset, streakDays);
  if (evo && evo.minutes != null) {
    const target = dataset.byId.get(evo.toSpeciesId);
    return [
      { id: 'companion-evolution', label: `Evoluciona a ${target?.name.es ?? 'su forma final'} en ${formatFocusDuration(evo.minutes, hasHistory)} de foco` },
    ];
  }
  const lvl = nextLevelEta(c, config, streakDays);
  if (lvl.level >= MAX_LEVEL) return [];
  const sp = dataset.byId.get(c.speciesId);
  return [
    { id: 'companion-level', label: `${c.nickname ?? sp?.name.es ?? 'El compañero'} sube a Nv. ${lvl.level} en ${formatFocusDuration(lvl.minutes, hasHistory)} de foco` },
  ];
};

/** 3 — progreso de la Pokédex de la región actual. */
export const pokedexGoalProvider: GoalProvider = ({ state, dataset }) => {
  const info = REGION_INFO[state.profile.currentRegion] ?? REGION_INFO.kanto;
  const caught = new Set(state.dex.filter((d) => d.caught).map((d) => d.speciesId));
  const pool = dataset.creatures.filter((c) => c.generation <= info.generation);
  const caughtCount = pool.filter((c) => caught.has(c.id)).length;
  return [{ id: 'pokedex', label: `Pokédex de ${info.name}: ${caughtCount}/${pool.length}` }];
};

const STREAK_MILESTONES = [7, 14, 30, 60, 100];

/** 4 — siguiente hito de racha (§7.8). */
export const streakGoalProvider: GoalProvider = ({ streakDays }) => {
  const next = STREAK_MILESTONES.find((m) => m > streakDays);
  if (next == null) return [];
  return [{ id: 'streak', label: `Racha: faltan ${next - streakDays} día(s) para el hito de ${next}` }];
};

export const DEFAULT_GOAL_PROVIDERS: GoalProvider[] = [
  evolutionGoalProvider,
  companionGoalProvider,
  pokedexGoalProvider,
  streakGoalProvider,
];

/** §9.7 — hasta `max` objetivos, en orden de prioridad; extensible vía `providers` (Fase 3 añadirá el jefe). */
export function nextGoals(ctx: GoalContext, providers: GoalProvider[] = DEFAULT_GOAL_PROVIDERS, max = 3): NextGoal[] {
  const out: NextGoal[] = [];
  for (const provider of providers) {
    for (const goal of provider(ctx)) {
      if (out.length >= max) return out;
      out.push(goal);
    }
  }
  return out;
}
