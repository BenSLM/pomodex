import { describe, expect, it } from 'vitest';
import { FakeClock } from '../src/core/clock';
import { mulberry32 } from '../src/core/rng';
import { applySessionRewards } from '../src/core/rewards/pipeline';
import { DEFAULT_REWARD_CONFIG } from '../src/core/rewards/config';
import { buildDataset, type CreatureSpecies, type EvolutionEdge } from '../src/core/dataset';
import type { Category, GameState, SessionRecord } from '../src/core/types';

const species = (over: Partial<CreatureSpecies>): CreatureSpecies => ({
  id: 1,
  slug: 'specie',
  name: { es: 'Specie', en: 'Specie' },
  types: ['psychic'],
  captureRate: 200,
  baseHappiness: 70,
  hatchCounter: 20,
  growthRate: 'medium-fast',
  rarity: 'common',
  bst: 300,
  generation: 1,
  isBaby: false,
  flavor: {},
  evolutionChainId: 1,
  sprites: { front: null, frontShiny: null, animated: null, animatedShiny: null },
  cry: null,
  ...over,
});

const creatures = [
  species({ id: 1, name: { es: 'Base', en: 'Base' } }),
  species({ id: 2, name: { es: 'Evo', en: 'Evo' }, captureRate: 45, rarity: 'rare', bst: 500 }),
  species({ id: 3, name: { es: 'Común', en: 'Común' }, types: ['normal'] }),
];
const edges: EvolutionEdge[] = [{ chainId: 1, from: 1, to: 2, rule: { kind: 'level', level: 16 } }];
const dataset = buildDataset(creatures, edges, {});

const categories: Category[] = [
  { id: 'study', name: 'Estudiar', icon: '📚', color: '#fff', affinityTypes: ['psychic'] },
];

function makeState(): GameState {
  return {
    profile: {
      id: 'me', trainerName: 'Test', createdAt: 0, coins: 0, totalFocusMinutes: 0, totalSessions: 0,
      companionId: 'c1', teamIds: ['c1', 'c2'], currentRegion: 'kanto', schemaVersion: 1, pityCount: 0,
    },
    creatures: [
      { id: 'c1', speciesId: 1, level: 15, xp: 200, shiny: false, friendship: 70, caughtAt: 0, caughtWith: 'poke' },
      { id: 'c2', speciesId: 3, level: 10, xp: 0, shiny: false, friendship: 70, caughtAt: 0, caughtWith: 'poke' },
    ],
    dex: [],
    inventory: { id: 'me', balls: { poke: 5, great: 0, ultra: 0, master: 0 }, items: { potion: 1, streakShield: 1, incense: 0, berry: 0, revive: 0, fireStone: 0, waterStone: 0, thunderStone: 0, leafStone: 0, moonStone: 0, sunStone: 0, shinyStone: 0, duskStone: 0, dawnStone: 0, iceStone: 0, linkCable: 0 } },
    streak: { current: 0, best: 0, lastCreditedDay: null },
    pendingEvolutions: [],
    eggs: [],
  };
}

const session = (over: Partial<SessionRecord> = {}): SessionRecord => ({
  id: 's1', categoryId: 'study', mode: 'pomodoro',
  plannedMs: 25 * 60_000, focusedMs: 25 * 60_000, overtimeMs: 0,
  startedAt: 1_000_000, endedAt: 1_000_000 + 25 * 60_000,
  pauseCount: 0, distractionCount: 0, quality: 95, outcome: 'completed',
  ...over,
});

const clock = new FakeClock(1_000_000 + 25 * 60_000);
const deps = (seed = 42) => ({ rng: mulberry32(seed), clock, dataset, rolloverHour: 4, categories });

describe('pipeline de recompensas (§3.3 / §7)', () => {
  it('sesión perfecta: XP, monedas, ball y racha', () => {
    const { summary, state } = applySessionRewards(makeState(), session(), DEFAULT_REWARD_CONFIG, deps());
    expect(summary.valid).toBe(true);
    expect(summary.quality).toBe('perfect');
    expect(summary.xpCompanion).toBe(313); // 250 × 1.25
    expect(summary.xpTeam).toBe(78); // 25% del compañero
    expect(summary.coins).toBe(13); // round(25/25×10×1.25)
    expect(summary.ballEarned).toBe('ultra');
    expect(summary.streakCredited).toBe(true);
    expect(state.streak.current).toBe(1);
    expect(state.profile.coins).toBe(13);
    expect(state.inventory.balls.ultra).toBe(1);
  });

  it('el XP sube de nivel y plantea evolución confirmable (§7.5)', () => {
    const { state, summary } = applySessionRewards(makeState(), session(), DEFAULT_REWARD_CONFIG, deps());
    const c1 = state.creatures.find((c) => c.id === 'c1')!;
    expect(c1.xp).toBe(513);
    expect(c1.level).toBeGreaterThan(15);
    expect(summary.levelUps[0]).toMatchObject({ creatureId: 'c1', from: 15 });
    expect(summary.evolutionCandidates[0]?.creatureId).toBe('c1');
    expect(summary.evolutionCandidates[0]?.options[0]?.toSpeciesId).toBe(2);
  });

  it('genera encuentro con la especie elegida por la semilla (determinismo)', () => {
    const a = applySessionRewards(makeState(), session(), DEFAULT_REWARD_CONFIG, deps(7));
    const b = applySessionRewards(makeState(), session(), DEFAULT_REWARD_CONFIG, deps(7));
    expect(a.summary.encounter).toEqual(b.summary.encounter);
    expect(a.summary.encounter).not.toBeNull();
    expect([1, 2, 3]).toContain(a.summary.encounter!.speciesId);
    // el encuentro marca la especie como vista
    expect(a.state.dex.find((d) => d.speciesId === a.summary.encounter!.speciesId)?.seen).toBe(true);
  });

  it('sesión inválida (<10 min) no da recompensas', () => {
    const { summary, state } = applySessionRewards(
      makeState(),
      session({ focusedMs: 5 * 60_000, outcome: 'abandoned' }),
      DEFAULT_REWARD_CONFIG,
      deps(),
    );
    expect(summary.valid).toBe(false);
    expect(summary.xpCompanion).toBe(0);
    expect(summary.coins).toBe(0);
    expect(state.profile.coins).toBe(0);
    expect(summary.encounter).toBeNull();
    expect(state.streak.current).toBe(0);
  });

  it('abandonCreditRatio = 0 no acredita nada por abandono', () => {
    const { summary } = applySessionRewards(
      makeState(),
      session({ focusedMs: 20 * 60_000, outcome: 'abandoned' }),
      DEFAULT_REWARD_CONFIG,
      deps(),
    );
    expect(summary.valid).toBe(false);
    expect(summary.xpCompanion).toBe(0);
  });

  it('drop de huevo según eggDropChance y progreso por minutos válidos', () => {
    const cfg = { ...DEFAULT_REWARD_CONFIG, eggDropChance: 1 };
    const state = makeState();
    state.eggs = [{ id: 'e1', speciesId: 3, requiredMinutes: 100, progressMinutes: 90, obtainedFrom: 'drop' }];
    const { state: next, summary } = applySessionRewards(state, session(), cfg, deps(3));
    expect(summary.eggsHatched).toHaveLength(1); // 90 + 25 ≥ 100
    expect(next.eggs).toHaveLength(1); // y cae uno nuevo
    expect(summary.eggObtained).not.toBeNull();
    expect(next.creatures.some((c) => c.speciesId === 3 && c.caughtWith === 'poke')).toBe(true);
  });

  it('el incienso consume una carga por encuentro', () => {
    const state = makeState();
    state.inventory.incenseCharges = 2;
    const { state: next } = applySessionRewards(state, session(), DEFAULT_REWARD_CONFIG, deps(5));
    expect(next.inventory.incenseCharges).toBe(1);
  });
});
