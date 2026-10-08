import type { GrowthRate, Rarity, TypeId } from './types';

export interface CreatureSpecies {
  id: number;
  slug: string;
  name: { es: string; en: string };
  types: TypeId[];
  captureRate: number;
  baseHappiness: number;
  hatchCounter: number;
  growthRate: GrowthRate;
  rarity: Rarity;
  bst: number;
  generation: number;
  isBaby: boolean;
  flavor: { es?: string; en?: string };
  evolutionChainId: number;
  sprites: { front: string | null; frontShiny: string | null; animated: string | null; animatedShiny: string | null };
  cry: string | null;
}

export interface EvolutionEdge {
  chainId: number;
  from: number;
  to: number;
  rule: EvolutionRule;
}

export type EvolutionRule =
  | { kind: 'level'; level: number }
  | { kind: 'item'; itemId: string }
  | { kind: 'friendship'; min: number }
  | { kind: 'special'; fallbackLevel: number };

export type TypeMatrix = Record<string, Record<string, number>>;

export interface Dataset {
  creatures: CreatureSpecies[];
  byId: Map<number, CreatureSpecies>;
  evolutionEdges: EvolutionEdge[];
  typeMatrix: TypeMatrix;
}

export function buildDataset(
  creatures: CreatureSpecies[],
  evolutionEdges: EvolutionEdge[],
  typeMatrix: TypeMatrix,
): Dataset {
  return {
    creatures,
    byId: new Map(creatures.map((c) => [c.id, c])),
    evolutionEdges,
    typeMatrix,
  };
}

export function evolvesFrom(dataset: Dataset, speciesId: number): EvolutionEdge[] {
  return dataset.evolutionEdges.filter((e) => e.from === speciesId);
}

export function getSpecies(dataset: Dataset, id: number): CreatureSpecies {
  const s = dataset.byId.get(id);
  if (!s) throw new Error(`Especies desconocida: ${id}`);
  return s;
}
