import { describe, expect, it } from 'vitest';
import { availableEvolutions, applyEvolution, canEvolveWithItem } from '../src/core/evolution';
import { buildDataset, type CreatureSpecies } from '../src/core/dataset';
import type { OwnedCreature } from '../src/core/types';

const baseSpecies = (id: number, over: Partial<CreatureSpecies> = {}): CreatureSpecies => ({
  id,
  slug: `sp${id}`,
  name: { es: `Esp${id}`, en: `Sp${id}` },
  types: ['normal'],
  captureRate: 100,
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

const dataset = buildDataset(
  [baseSpecies(1), baseSpecies(2), baseSpecies(3), baseSpecies(4)],
  [
    { chainId: 1, from: 1, to: 2, rule: { kind: 'level', level: 16 } },
    { chainId: 2, from: 3, to: 4, rule: { kind: 'item', itemId: 'fireStone' } },
  ],
  {},
);

const creature = (over: Partial<OwnedCreature> = {}): OwnedCreature => ({
  id: 'c1', speciesId: 1, level: 10, xp: 0, shiny: false, friendship: 70,
  caughtAt: 0, caughtWith: 'poke', ...over,
});

describe('evoluciones (§7.5)', () => {
  it('regla por nivel: disponible al alcanzar el nivel', () => {
    expect(availableEvolutions(dataset, creature({ level: 15 }))).toBeNull();
    const evo = availableEvolutions(dataset, creature({ level: 16 }));
    expect(evo?.options).toEqual([{ toSpeciesId: 2 }]);
  });

  it('regla por amistad', () => {
    const ds = buildDataset(
      [baseSpecies(1), baseSpecies(2)],
      [{ chainId: 1, from: 1, to: 2, rule: { kind: 'friendship', min: 220 } }],
      {},
    );
    expect(availableEvolutions(ds, creature({ friendship: 219 }))).toBeNull();
    expect(availableEvolutions(ds, creature({ friendship: 220 }))).not.toBeNull();
  });

  it('al evolucionar se conservan nivel, XP, amistad, shiny y apodo', () => {
    const c = creature({ level: 20, xp: 400, shiny: true, friendship: 200, nickname: 'Chico' });
    const evo = applyEvolution(c, 2);
    expect(evo).toMatchObject({ speciesId: 2, level: 20, xp: 400, shiny: true, friendship: 200, nickname: 'Chico' });
  });

  it('evolución por piedra: requiere el ítem correcto', () => {
    expect(canEvolveWithItem(dataset, creature({ speciesId: 3 }), 'fireStone')).toBe(4);
    expect(canEvolveWithItem(dataset, creature({ speciesId: 3 }), 'waterStone')).toBeNull();
    expect(canEvolveWithItem(dataset, creature({ speciesId: 1 }), 'fireStone')).toBeNull();
  });
});
