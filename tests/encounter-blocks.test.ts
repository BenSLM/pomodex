import { describe, expect, it } from 'vitest';
import { FakeClock } from '../src/core/clock';
import { mulberry32 } from '../src/core/rng';
import { applySessionRewards } from '../src/core/rewards/pipeline';
import { DEFAULT_REWARD_CONFIG } from '../src/core/rewards/config';
import { encountersForSession } from '../src/core/encounter';
import { buildDataset, type CreatureSpecies, type EvolutionEdge } from '../src/core/dataset';
import type { GameState, RewardConfig, SessionRecord } from '../src/core/types';

const species = (over: Partial<CreatureSpecies>): CreatureSpecies => ({
  id: 1, slug: 'specie', name: { es: 'Specie', en: 'Specie' }, types: ['normal'],
  captureRate: 200, baseHappiness: 70, hatchCounter: 20, growthRate: 'medium-fast',
  rarity: 'common', bst: 300, generation: 1, isBaby: false, flavor: {}, evolutionChainId: 1,
  sprites: { front: null, frontShiny: null, animated: null, animatedShiny: null }, cry: null,
  ...over,
});

const creatures = [
  species({ id: 1, name: { es: 'Común', en: 'Común' }, rarity: 'common' }),
  species({ id: 2, name: { es: 'Épico', en: 'Épico' }, rarity: 'epic', captureRate: 45, bst: 600 }),
  species({ id: 3, name: { es: 'Rara', en: 'Rara' }, rarity: 'rare', captureRate: 75, bst: 500 }),
];
const edges: EvolutionEdge[] = [];
const dataset = buildDataset(creatures, edges, {});

const NOW = 1_000_000;

function makeState(): GameState {
  return {
    profile: {
      id: 'me', trainerName: 'Test', createdAt: 0, coins: 0, totalFocusMinutes: 0, totalSessions: 0,
      companionId: 'c1', teamIds: ['c1'], currentRegion: 'kanto', schemaVersion: 1, pityCount: 0,
    },
    creatures: [
      { id: 'c1', speciesId: 1, level: 5, xp: 0, shiny: false, friendship: 70, caughtAt: 0, caughtWith: 'poke' },
    ],
    dex: [],
    inventory: {
      id: 'me',
      balls: { poke: 5, great: 0, ultra: 0, master: 0 },
      items: {
        potion: 0, revive: 0, streakShield: 0, incense: 0, lure: 0, berry: 0,
        fireStone: 0, waterStone: 0, thunderStone: 0, leafStone: 0, moonStone: 0,
        sunStone: 0, shinyStone: 0, duskStone: 0, dawnStone: 0, iceStone: 0, linkCable: 0,
      },
      incenseCharges: 0,
    },
    streak: { current: 0, best: 0, lastCreditedDay: null },
    pendingEvolutions: [],
    eggs: [],
    encounters: [],
  };
}

function session(plannedMin: number, over: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id: 's1', mode: 'pomodoro',
    plannedMs: plannedMin * 60_000, focusedMs: plannedMin * 60_000, overtimeMs: 0,
    startedAt: NOW, endedAt: NOW + plannedMin * 60_000,
    pauseCount: 0, distractionCount: 0, quality: 95, outcome: 'completed',
    ...over,
  };
}

const clock = new FakeClock(NOW + 150 * 60_000);
const deps = (seed = 42) => ({ rng: mulberry32(seed), clock, dataset, rolloverHour: 4 });

const run = (plannedMin: number, over: Partial<SessionRecord> = {}, state = makeState(), config = DEFAULT_REWARD_CONFIG, seed = 42) =>
  applySessionRewards(state, session(plannedMin, over), config, deps(seed));

describe('encuentros por bloques de tiempo (§7.3)', () => {
  it('encountersForSession: 25→1, 60→2, 90→3, 150→3 (tope)', () => {
    expect(encountersForSession(25, DEFAULT_REWARD_CONFIG)).toBe(1);
    expect(encountersForSession(60, DEFAULT_REWARD_CONFIG)).toBe(2);
    expect(encountersForSession(90, DEFAULT_REWARD_CONFIG)).toBe(3);
    expect(encountersForSession(150, DEFAULT_REWARD_CONFIG)).toBe(3);
  });

  it('25/60/90/150 min → 1/2/3/3 encuentros', () => {
    expect(run(25).summary.encounters).toHaveLength(1);
    expect(run(60).summary.encounters).toHaveLength(2);
    expect(run(90).summary.encounters).toHaveLength(3);
    expect(run(150).summary.encounters).toHaveLength(3);
  });

  it('Flow con overtime usa el foco total pero respeta el tope', () => {
    const { summary } = run(60, { mode: 'flow', focusedMs: 150 * 60_000, overtimeMs: 90 * 60_000 });
    expect(summary.encounters).toHaveLength(3);
  });

  it('mismo seed → mismos encuentros (determinismo)', () => {
    const a = run(90, {}, makeState(), DEFAULT_REWARD_CONFIG, 7);
    const b = run(90, {}, makeState(), DEFAULT_REWARD_CONFIG, 7);
    expect(a.summary.encounters).toEqual(b.summary.encounters);
  });

  it('una ball gratis por encuentro generado, según calidad', () => {
    expect(run(90, { quality: 95 }).summary.ballsEarned).toEqual(['ultra', 'ultra', 'ultra']);
    expect(run(90, { quality: 70 }).summary.ballsEarned).toEqual(['great', 'great', 'great']);
    expect(run(25, { quality: 30 }).summary.ballsEarned).toEqual(['poke']);
  });

  it('el pity timer cuenta por encuentro, no por sesión', () => {
    const cfg: RewardConfig = {
      ...DEFAULT_REWARD_CONFIG,
      pityThreshold: 1,
      rarityWeights: { common: 1000, uncommon: 0, rare: 0, epic: 0.0001, legendary: 0, mythical: 0 },
    };
    const { summary } = run(60, {}, makeState(), cfg, 3); // 2 encuentros
    expect(summary.encounters).toHaveLength(2);
    // el 2º es seguro rare+ por el pity acumulado en el 1º
    expect(summary.encounters[1].speciesId).toBe(2);
  });

  it('el incienso gasta como mucho 1 carga por encuentro', () => {
    const state = makeState();
    state.inventory.incenseCharges = 3;
    const { state: next } = run(90, {}, state); // 3 encuentros
    expect(next.inventory.incenseCharges).toBe(0);
  });

  it('una tirada de huevo por bloque, con máximo de 3 en incubadora', () => {
    const cfg = { ...DEFAULT_REWARD_CONFIG, eggDropChance: 1 };
    const { summary, state } = run(150, {}, makeState(), cfg); // 3 bloques
    expect(summary.eggsObtained).toHaveLength(3);
    expect(state.eggs).toHaveLength(3);

    const state2 = makeState();
    state2.eggs = [
      { id: 'e1', speciesId: 1, requiredMinutes: 100, progressMinutes: 0, obtainedFrom: 'drop' },
      { id: 'e2', speciesId: 1, requiredMinutes: 100, progressMinutes: 0, obtainedFrom: 'drop' },
    ];
    const { state: after } = run(150, {}, state2, cfg);
    expect(after.eggs).toHaveLength(3); // solo cabe 1 más
  });

  it('el Señuelo añade 1 encuentro (máx. maxEncountersPerSession + 1) y se consume', () => {
    const state = makeState();
    state.inventory.items.lure = 1;
    const { summary, state: next } = run(25, {}, state); // base 1 + señuelo = 2
    expect(summary.lureUsed).toBe(true);
    expect(summary.encounters).toHaveLength(2);
    expect(next.inventory.items.lure).toBe(0);

    const state2 = makeState();
    state2.inventory.items.lure = 1;
    const { summary: s2 } = run(90, {}, state2); // base 3 + señuelo → tope 4
    expect(s2.encounters).toHaveLength(4);
  });

  it('tope de pendientes: el más antiguo huye (por expiresAt)', () => {
    const state = makeState();
    state.encounters = Array.from({ length: 8 }, (_, i) => ({
      id: `old-${i}`, speciesId: 1, shiny: false, level: 5, attempts: 0,
      expiresAt: clock.now() + 1_000 + i, // vigentes, pero más antiguos que los nuevos
    }));
    const { summary, state: next } = run(60, {}, state); // 2 nuevos → 10 > 8
    expect(summary.encounters).toHaveLength(2);
    expect(summary.fledEncounters).toBe(2);
    expect(next.encounters).toHaveLength(8);
    expect(next.encounters.some((e) => e.id === 'old-0')).toBe(false);
    expect(next.encounters.some((e) => e.id === 'old-1')).toBe(false);
  });

  it('descarta encuentros caducados al cargar el estado', () => {
    const state = makeState();
    state.encounters = [
      { id: 'expired', speciesId: 1, shiny: false, level: 5, attempts: 0, expiresAt: NOW - 1 },
    ];
    const { state: next } = run(25, {}, state);
    expect(next.encounters.some((e) => e.id === 'expired')).toBe(false);
  });
});
