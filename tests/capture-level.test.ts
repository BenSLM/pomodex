import { describe, expect, it } from 'vitest';
import { minCaptureLevel, wildCaptureLevel } from '../src/core/capture-level';
import { buildDataset, type CreatureSpecies, type EvolutionEdge } from '../src/core/dataset';
import { dataset } from '../src/data/dataset';
import { mulberry32 } from '../src/core/rng';

const species = (id: number, over: Partial<CreatureSpecies> = {}): CreatureSpecies => ({
  id, slug: `s${id}`, name: { es: `S${id}`, en: `S${id}` }, types: ['normal'],
  captureRate: 200, baseHappiness: 70, hatchCounter: 20, growthRate: 'medium-fast',
  rarity: 'common', bst: 300, generation: 1, isBaby: false, flavor: {}, evolutionChainId: 1,
  sprites: { front: null, frontShiny: null, animated: null, animatedShiny: null }, cry: null,
  ...over,
});

describe('minCaptureLevel (§7.4)', () => {
  it('las especies base no tienen mínimo', () => {
    expect(minCaptureLevel(1, dataset)).toBe(0); // Bulbasaur
    expect(minCaptureLevel(4, dataset)).toBe(0); // Charmander
    expect(minCaptureLevel(7, dataset)).toBe(0); // Squirtle
    expect(minCaptureLevel(147, dataset)).toBe(0); // Dratini
  });

  it('las evoluciones por nivel usan el nivel de la evolución', () => {
    expect(minCaptureLevel(5, dataset)).toBe(16); // Charmeleon
    expect(minCaptureLevel(6, dataset)).toBe(36); // Charizard
    expect(minCaptureLevel(148, dataset)).toBe(30); // Dragonair
    expect(minCaptureLevel(149, dataset)).toBe(55); // Dragonite
  });

  it('las evoluciones por piedra/amistad/especial usan el fallback (36)', () => {
    expect(minCaptureLevel(26, dataset)).toBe(36); // Raichu (piedra trueno)
  });

  it('nunca es menor que el mínimo de su preevolución', () => {
    const creatures = [species(1), species(2), species(3)];
    const edges: EvolutionEdge[] = [
      { chainId: 1, from: 1, to: 2, rule: { kind: 'level', level: 40 } },
      { chainId: 1, from: 2, to: 3, rule: { kind: 'special', fallbackLevel: 10 } },
    ];
    const ds = buildDataset(creatures, edges, {});
    expect(minCaptureLevel(2, ds)).toBe(40);
    expect(minCaptureLevel(3, ds)).toBe(40); // max(fallback 10, preevolución 40)
  });

  it('todo destino de una evolución por nivel tiene mínimo ≥ ese nivel', () => {
    for (const e of dataset.evolutionEdges) {
      if (e.rule.kind !== 'level') continue;
      expect(minCaptureLevel(e.to, dataset)).toBeGreaterThanOrEqual(e.rule.level);
    }
  });
});

describe('wildCaptureLevel (§7.4)', () => {
  it('nivel base aleatorio en wildLevelRange', () => {
    expect(wildCaptureLevel({ id: 4, rarity: 'common' }, [3, 10], 50, dataset, () => 0)).toBe(3);
    expect(wildCaptureLevel({ id: 4, rarity: 'common' }, [3, 10], 50, dataset, () => 7)).toBe(10);
  });

  it('eleva al mínimo de la especie', () => {
    expect(wildCaptureLevel({ id: 149, rarity: 'rare' }, [3, 10], 50, dataset, () => 0)).toBe(55);
  });

  it('legendarios y míticos entran a legendaryCaptureLevel', () => {
    expect(wildCaptureLevel({ id: 150, rarity: 'legendary' }, [3, 10], 50, dataset, () => 0)).toBe(50);
    expect(wildCaptureLevel({ id: 151, rarity: 'mythical' }, [3, 10], 50, dataset, () => 0)).toBe(50);
  });

  it('es determinista con el RNG inyectado', () => {
    const run = (seed: number) => {
      const rng = mulberry32(seed);
      return wildCaptureLevel({ id: 1, rarity: 'common' }, [3, 10], 50, dataset, (lo, hi) => rng.int(lo, hi));
    };
    expect(run(123)).toBe(run(123));
  });
});
