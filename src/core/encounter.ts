import type { Dataset, CreatureSpecies } from './dataset';
import type { Rarity, RewardConfig, TypeId } from './types';
import type { Rng } from './rng';

export interface EncounterRollDeps {
  rng: Rng;
  config: RewardConfig;
  maxGeneration: number;
  affinityTypes: TypeId[];
  perfect: boolean;
  flowOvertimeMin: number;
  incenseActive: boolean;
  pityCount: number;
}

const RARE_PLUS: Rarity[] = ['rare', 'epic', 'legendary', 'mythical'];

/** §7.3 — pool: región (generación) + afinidad de categoría + evolucionados solo si rareza ≥ rare. */
export function encounterPool(dataset: Dataset, deps: EncounterRollDeps): CreatureSpecies[] {
  const isEvolved = (id: number) => dataset.evolutionEdges.some((e) => e.to === id);
  const general = dataset.creatures.filter(
    (c) =>
      c.generation <= deps.maxGeneration &&
      (c.isBaby || !isEvolved(c.id) || RARE_PLUS.includes(c.rarity)),
  );
  if (deps.affinityTypes.length === 0) return general;
  const affinity = general.filter((c) => c.types.some((t) => deps.affinityTypes.includes(t)));
  return deps.rng.chance(0.6) && affinity.length > 0 ? affinity : general;
}

/** §7.3 — pesos con modificadores + pity timer. */
export function rollEncounter(dataset: Dataset, deps: EncounterRollDeps): { speciesId: number; shiny: boolean } {
  const pool = encounterPool(dataset, deps);
  const weights = pool.map((c) => {
    let w = deps.config.rarityWeights[c.rarity];
    if (RARE_PLUS.includes(c.rarity)) {
      if (deps.perfect) w *= 1.5;
      if (deps.flowOvertimeMin > 0) {
        const steps = Math.min(Math.floor(deps.flowOvertimeMin / 10), 10);
        w *= Math.min(Math.pow(1.15, steps), 2);
      }
      if (deps.incenseActive) w *= 2;
    }
    return w;
  });

  let chosen = weightedPick(pool, weights, deps.rng);
  if (deps.pityCount >= deps.config.pityThreshold && !RARE_PLUS.includes(chosen.rarity)) {
    const rarePool = pool.filter((c) => RARE_PLUS.includes(c.rarity));
    if (rarePool.length > 0) {
      chosen = weightedPick(rarePool, rarePool.map((c) => deps.config.rarityWeights[c.rarity]), deps.rng);
    }
  }

  return { speciesId: chosen.id, shiny: deps.rng.chance(deps.config.shinyRate) };
}

function weightedPick(pool: CreatureSpecies[], weights: number[], rng: Rng): CreatureSpecies {
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rng.next() * total;
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}
