import { describe, expect, it } from 'vitest';
import { applyCandy, candyPreview, candyXp, CANDY_ITEM } from '../src/core/candies';
import { DEFAULT_REWARD_CONFIG } from '../src/core/rewards/config';
import { canRelease, duplicatePlan, releaseCandyFor } from '../src/core/release';
import { xpForLevel } from '../src/core/xp';
import { buildDataset, type CreatureSpecies, type EvolutionEdge } from '../src/core/dataset';
import type { OwnedCreature, Profile, RewardConfig } from '../src/core/types';

const species = (over: Partial<CreatureSpecies>): CreatureSpecies => ({
  id: 1, slug: 'specie', name: { es: 'Specie', en: 'Specie' }, types: ['normal'],
  captureRate: 200, baseHappiness: 70, hatchCounter: 20, growthRate: 'medium-fast',
  rarity: 'common', bst: 300, generation: 1, isBaby: false, flavor: {}, evolutionChainId: 1,
  sprites: { front: null, frontShiny: null, animated: null, animatedShiny: null }, cry: null,
  ...over,
});
const creatures = [
  species({ id: 1, name: { es: 'Base', en: 'Base' }, rarity: 'common' }),
  species({ id: 2, name: { es: 'Evo', en: 'Evo' }, rarity: 'epic', captureRate: 45 }),
  species({ id: 9, name: { es: 'Leyenda', en: 'Legend' }, rarity: 'legendary', captureRate: 3 }),
];
const edges: EvolutionEdge[] = [{ chainId: 1, from: 1, to: 2, rule: { kind: 'level', level: 16 } }];
const dataset = buildDataset(creatures, edges, {});

const cfg = DEFAULT_REWARD_CONFIG;
const owned = (id: string, speciesId: number, level: number, over: Partial<OwnedCreature> = {}): OwnedCreature => ({
  id, speciesId, level, xp: xpForLevel(level, cfg.xpScale), shiny: false, friendship: 70, caughtAt: 0, caughtWith: 'poke', ...over,
});

const profile = (over: Partial<Profile> = {}): Profile => ({
  id: 'me', trainerName: 'T', createdAt: 0, coins: 0, totalFocusMinutes: 0, totalSessions: 0,
  companionId: 'c1', teamIds: ['c1', 'c2'], currentRegion: 'kanto', schemaVersion: 1, pityCount: 0, ...over,
});

describe('caramelos de XP (§7.1/§7.7)', () => {
  it('la XP reescala con xpScale (no se guarda el valor final)', () => {
    expect(candyXp('xs', cfg)).toBe(25); // 100 × 0.25
    expect(candyXp('s', cfg)).toBe(200); // 800 × 0.25
    expect(candyXp('m', cfg)).toBe(750);
    expect(candyXp('l', cfg)).toBe(2500);
    expect(candyXp('xl', cfg)).toBe(7500);

    const scaled: RewardConfig = { ...cfg, xpScale: 0.05 };
    expect(candyXp('s', scaled)).toBe(40); // 800 × 0.05
    expect(candyXp('m', scaled)).toBe(150);
  });

  it('applyCandy suma XP y recalcula el nivel', () => {
    const c = owned('x', 1, 10);
    const res = applyCandy(c, 's', cfg, 50);
    expect(res.xpGained).toBe(200);
    expect(res.creature.xp).toBe(c.xp + 200);
    expect(res.capped).toBe(false);
  });

  it('el tope es el nivel del compañero: recorta la XP sobrante', () => {
    const c = owned('x', 1, 1); // xp 0
    const cap = xpForLevel(5, cfg.xpScale); // 31.25
    const res = applyCandy(c, 'm', cfg, 5);
    expect(res.capped).toBe(true);
    expect(res.creature.xp).toBe(cap);
    expect(res.creature.level).toBe(5);
    expect(res.xpGained).toBe(cap);
  });

  it('candyPreview desactiva cuando ya está en el tope', () => {
    const atCap = owned('x', 1, 5, { xp: xpForLevel(5, cfg.xpScale) });
    expect(candyPreview(atCap, 's', cfg, 5).disabled).toBe(true);
    const below = owned('x', 1, 1);
    const p = candyPreview(below, 's', cfg, 50);
    expect(p.disabled).toBe(false);
    expect(p.label).toContain('+200 XP');
  });

  it('CANDY_ITEM mapea tamaños a ítems de inventario', () => {
    expect(CANDY_ITEM.xs).toBe('candyXS');
    expect(CANDY_ITEM.xl).toBe('candyXL');
  });
});

describe('liberar duplicados (§7.4)', () => {
  const state = (): OwnedCreature[] => [
    owned('c1', 1, 10), // compañero
    owned('c2', 1, 8), // equipo
    owned('c3', 1, 12), // caja, el mejor
    owned('c4', 1, 5), // caja, duplicado
    owned('c5', 1, 3, { shiny: true }), // shiny, nunca se libera
    owned('c6', 9, 50), // legendario, nunca se libera
    owned('c7', 2, 4), // épico, único → no se libera
  ];

  it('canRelease protege compañero, equipo, shiny y legendarios/míticos', () => {
    const p = profile();
    expect(canRelease(state()[0], p, dataset)).toBe(false); // compañero
    expect(canRelease(state()[1], p, dataset)).toBe(false); // equipo
    expect(canRelease(state()[2], p, dataset)).toBe(true);
    expect(canRelease(state()[4], p, dataset)).toBe(false); // shiny
    expect(canRelease(state()[5], p, dataset)).toBe(false); // legendario
  });

  it('releaseCandyFor devuelve el caramelo por rareza', () => {
    expect(releaseCandyFor(1, dataset, cfg)).toBe('xs'); // common
    expect(releaseCandyFor(2, dataset, cfg)).toBe('m'); // epic
    expect(releaseCandyFor(9, dataset, cfg)).toBe(cfg.releaseCandy.legendary);
  });

  it('duplicatePlan conserva el mejor y no toca equipo ni shinies', () => {
    const plan = duplicatePlan(state(), profile(), dataset, cfg);
    expect(plan.toRelease.map((c) => c.id)).toEqual(['c4']);
    expect(plan.candies).toMatchObject({ xs: 1 });
  });
});
