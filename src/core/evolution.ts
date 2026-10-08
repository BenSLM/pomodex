import type { Dataset } from './dataset';
import type { OwnedCreature, PendingEvolution } from './types';

/** Reglas disponibles para un Pokémon según nivel/amistad (§7.5). */
export function availableEvolutions(dataset: Dataset, creature: OwnedCreature): PendingEvolution | null {
  const options = dataset.evolutionEdges
    .filter((e) => e.from === creature.speciesId && e.to !== creature.speciesId)
    .filter((e) => {
      const r = e.rule;
      if (r.kind === 'level') return creature.level >= r.level;
      if (r.kind === 'friendship') return creature.friendship >= r.min;
      return false; // item y special: manuales desde la UI
    })
    .map((e) => ({ toSpeciesId: e.to }));
  return options.length > 0 ? { creatureId: creature.id, options } : null;
}

/** Evolución confirmada: conserva nivel, XP, amistad, shiny y apodo. */
export function applyEvolution(creature: OwnedCreature, toSpeciesId: number): OwnedCreature {
  return { ...creature, speciesId: toSpeciesId };
}

/** Reglas por objeto (piedras) y "special" (fallback). */
export function canEvolveWithItem(dataset: Dataset, creature: OwnedCreature, itemId: string): number | null {
  const edge = dataset.evolutionEdges.find(
    (e) => e.from === creature.speciesId && ((e.rule.kind === 'item' && e.rule.itemId === itemId) || e.rule.kind === 'special'),
  );
  if (!edge) return null;
  if (edge.rule.kind === 'special' && creature.level < edge.rule.fallbackLevel) return null;
  return edge.to;
}
