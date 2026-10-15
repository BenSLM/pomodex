import type { Dataset } from './dataset';
import type { CandySize, OwnedCreature, Profile, RewardConfig } from './types';

/** §7.4 — no se pueden liberar: compañero, equipo, shiny, legendarios ni míticos. */
export function canRelease(creature: OwnedCreature, profile: Profile, dataset: Dataset): boolean {
  if (profile.companionId === creature.id) return false;
  if (profile.teamIds.includes(creature.id)) return false;
  if (creature.shiny) return false;
  const sp = dataset.byId.get(creature.speciesId);
  if (sp && (sp.rarity === 'legendary' || sp.rarity === 'mythical')) return false;
  return true;
}

/** §7.4 — caramelo que suelta un duplicado según la rareza de la especie. */
export function releaseCandyFor(speciesId: number, dataset: Dataset, config: RewardConfig): CandySize | null {
  const sp = dataset.byId.get(speciesId);
  if (!sp) return null;
  return config.releaseCandy[sp.rarity] ?? null;
}

export interface DuplicatePlan {
  /** Duplicados de la caja a liberar (nunca equipo/compañero/shiny/legendarios). */
  toRelease: OwnedCreature[];
  /** Caramelos totales que se obtendrán, agregados por tamaño. */
  candies: Partial<Record<CandySize, number>>;
}

/**
 * Conserva, por especie, el de mayor nivel (y cualquier shiny, que nunca se libera)
 * y libera el resto de la caja (no del equipo) (§7.4).
 */
export function duplicatePlan(
  creatures: OwnedCreature[],
  profile: Profile,
  dataset: Dataset,
  config: RewardConfig,
): DuplicatePlan {
  const bySpecies = new Map<number, OwnedCreature[]>();
  for (const c of creatures) {
    if (!canRelease(c, profile, dataset)) continue;
    const list = bySpecies.get(c.speciesId) ?? [];
    list.push(c);
    bySpecies.set(c.speciesId, list);
  }

  const toRelease: OwnedCreature[] = [];
  const candies: Partial<Record<CandySize, number>> = {};
  for (const list of bySpecies.values()) {
    if (list.length < 2) continue;
    const best = list.reduce((a, b) => (b.level > a.level ? b : a));
    for (const c of list) {
      if (c.id === best.id) continue;
      toRelease.push(c);
      const size = releaseCandyFor(c.speciesId, dataset, config);
      if (size) candies[size] = (candies[size] ?? 0) + 1;
    }
  }
  return { toRelease, candies };
}
