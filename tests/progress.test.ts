import { describe, expect, it } from 'vitest';
import {
  focusHistoryDays,
  focusMinutesForXp,
  formatFocusDuration,
  nextEvolutionEta,
  nextGoals,
  nextLevelEta,
  streakMultiplier,
  type GoalContext,
} from '../src/core/progress';
import { buildDataset, type CreatureSpecies, type EvolutionEdge } from '../src/core/dataset';
import { dataset } from '../src/data/dataset';
import { DEFAULT_REWARD_CONFIG } from '../src/core/rewards/config';
import { xpForLevel } from '../src/core/xp';
import type { GameState, OwnedCreature } from '../src/core/types';

const cfg = DEFAULT_REWARD_CONFIG;

const species = (id: number, over: Partial<CreatureSpecies> = {}): CreatureSpecies => ({
  id, slug: `s${id}`, name: { es: `S${id}`, en: `S${id}` }, types: ['normal'],
  captureRate: 200, baseHappiness: 70, hatchCounter: 20, growthRate: 'medium-fast',
  rarity: 'common', bst: 300, generation: 1, isBaby: false, flavor: {}, evolutionChainId: 1,
  sprites: { front: null, frontShiny: null, animated: null, animatedShiny: null }, cry: null,
  ...over,
});
const edges: EvolutionEdge[] = [{ chainId: 1, from: 1, to: 2, rule: { kind: 'level', level: 16 } }];
const ds = buildDataset([species(1), species(2), species(3, { generation: 2 })], edges, {});

const owned = (id: string, speciesId: number, level: number, over: Partial<OwnedCreature> = {}): OwnedCreature => ({
  id, speciesId, level, xp: xpForLevel(level, cfg.xpScale), shiny: false, friendship: 70, caughtAt: 0, caughtWith: 'poke', ...over,
});

const state = (over: Partial<GameState> = {}): GameState => ({
  profile: {
    id: 'me', trainerName: 'T', createdAt: 0, coins: 0, totalFocusMinutes: 0, totalSessions: 0,
    companionId: 'c1', teamIds: ['c1'], currentRegion: 'kanto', schemaVersion: 1, pityCount: 0,
  },
  creatures: [owned('c1', 1, 10)],
  dex: [],
  inventory: { id: 'me', balls: { poke: 0, great: 0, ultra: 0, master: 0 }, items: {} as never },
  streak: { current: 0, best: 0, lastCreditedDay: null },
  pendingEvolutions: [],
  eggs: [],
  encounters: [],
  ...over,
});

const ctx = (over: Partial<GameState> = {}, cfgOv: Partial<GoalContext> = {}): GoalContext => ({
  state: state(over),
  dataset: ds,
  config: cfg,
  streakDays: 0,
  historyDays: 0,
  ...cfgOv,
});

describe('estimación de tiempo de foco (§9.7)', () => {
  it('minutos = XP restante / (xpPerMinute × calidad × racha)', () => {
    expect(focusMinutesForXp(380, cfg)).toBeCloseTo(38);
    expect(focusMinutesForXp(380, cfg, { streakDays: 25 })).toBeCloseTo(380 / 15);
    expect(focusMinutesForXp(0, cfg)).toBe(0);
  });

  it('streakMultiplier sube 2 %/día con tope 1.5', () => {
    expect(streakMultiplier(0)).toBe(1);
    expect(streakMultiplier(25)).toBeCloseTo(1.5);
    expect(streakMultiplier(1000)).toBe(1.5);
  });

  it('nextLevelEta calcula XP restante y tiempo', () => {
    const c = owned('c1', 1, 15); // xp 843.75
    const eta = nextLevelEta(c, cfg, 0);
    expect(eta.level).toBe(16);
    expect(eta.remainingXp).toBeCloseTo(xpForLevel(16, cfg.xpScale) - xpForLevel(15, cfg.xpScale));
    expect(eta.minutes).toBeCloseTo(eta.remainingXp / 10);
  });

  it('formatFocusDuration: minutos, horas y días', () => {
    expect(formatFocusDuration(0)).toBe('~0 min');
    expect(formatFocusDuration(38)).toBe('~38 min');
    expect(formatFocusDuration(90)).toBe('~90 min');
    expect(formatFocusDuration(120)).toBe('~2 h');
    expect(formatFocusDuration(2880)).toBe('~48 h');
    expect(formatFocusDuration(2880, true)).toBe('~2 días a tu ritmo');
    expect(formatFocusDuration(3000, true)).toBe('~2 días a tu ritmo');
    expect(formatFocusDuration(6000)).toBe('~100 h'); // sin historial, se queda en horas
  });

  it('focusHistoryDays cuenta días lógicos distintos', () => {
    const day = 24 * 3_600_000;
    const base = new Date('2026-01-10T12:00:00').getTime();
    expect(focusHistoryDays([{ startedAt: base }, { startedAt: base + 1000 }, { startedAt: base + day }], 4)).toBe(2);
  });
});

describe('nextEvolutionEta (§7.5)', () => {
  it('evolución por nivel da ETA', () => {
    const c = owned('c1', 5, 20); // Charmeleon → Charizard (Nv. 36)
    const eta = nextEvolutionEta(c, cfg, dataset, 0);
    expect(eta).not.toBeNull();
    expect(eta!.toSpeciesId).toBe(6);
    expect(eta!.level).toBe(36);
    expect(eta!.minutes).not.toBeNull();
  });

  it('evolución por amistad devuelve el requisito, no tiempo', () => {
    const c = owned('c1', 172, 20); // Pichu → Pikachu (amistad 220)
    const eta = nextEvolutionEta(c, cfg, dataset, 0);
    expect(eta!.minutes).toBeNull();
    expect(eta!.requirement).toBe('Amistad 220');
  });

  it('sin preevolución evolutiva devuelve null', () => {
    expect(nextEvolutionEta(owned('c1', 1, 50), cfg, dataset, 0)?.toSpeciesId).toBe(2);
    expect(nextEvolutionEta(owned('c1', 151, 50), cfg, dataset, 0)).toBeNull();
  });
});

describe('nextGoals (§9.7)', () => {
  it('prioriza evolución → compañero → Pokédex → racha y recorta a 3', () => {
    const goals = nextGoals(ctx(), undefined, 3);
    expect(goals.map((g) => g.id)).toEqual(['companion-evolution', 'pokedex', 'streak']);
    expect(goals[1].label).toBe('Pokédex de Kanto: 0/2');
    expect(goals[2].label).toMatch(/faltan 7 día/);
  });

  it('una evolución pendiente es el primer objetivo', () => {
    const goals = nextGoals(
      ctx({
        creatures: [owned('c1', 1, 16)],
        pendingEvolutions: [{ creatureId: 'c1', options: [{ toSpeciesId: 2 }] }],
      }),
    );
    expect(goals[0].id).toBe('evolution-confirm');
  });

  it('detecta evolución lista aunque no esté en pendingEvolutions', () => {
    const goals = nextGoals(ctx({ creatures: [owned('c1', 1, 16)] }));
    expect(goals[0].id).toBe('evolution-ready-c1');
  });

  it('Pokédex refleja capturas de la región', () => {
    const goals = nextGoals(ctx({ dex: [{ speciesId: 1, seen: true, caught: true, shinyCaught: false }, { speciesId: 3, seen: true, caught: true, shinyCaught: false }] }));
    expect(goals.find((g) => g.id === 'pokedex')!.label).toBe('Pokédex de Kanto: 1/2');
  });

  it('es extensible con proveedores propios', () => {
    const goals = nextGoals(ctx(), [() => [{ id: 'custom', label: 'Objetivo propio' }]], 3);
    expect(goals).toEqual([{ id: 'custom', label: 'Objetivo propio' }]);
  });
});
