import type { Dataset } from './dataset';

/** §7.5 — nivel de reserva para evoluciones por piedra/amistad/especial. */
export const EVOLUTION_FALLBACK_LEVEL = 36;

/**
 * §7.4 — nivel mínimo al que puede aparecer una especie salvaje.
 *
 * Derivado de `evolutions.json`: el nivel de la evolución que la produce (por nivel);
 * las reglas por piedra/amistad/especial usan el `fallbackLevel` de §7.5. Nunca es
 * menor que el mínimo de su preevolución. Las especies base (sin preevolución) no
 * tienen mínimo (0). Función pura, con memo por llamada.
 */
export function minCaptureLevel(
  speciesId: number,
  dataset: Dataset,
  fallbackLevel = EVOLUTION_FALLBACK_LEVEL,
): number {
  const memo = new Map<number, number>();

  const compute = (id: number): number => {
    const cached = memo.get(id);
    if (cached != null) return cached;
    memo.set(id, 0); // guarda anti-ciclos
    const incoming = dataset.evolutionEdges.filter((e) => e.to === id && e.from !== id);
    if (incoming.length === 0) return 0;

    let best = Infinity;
    for (const edge of incoming) {
      const rule = edge.rule;
      const own =
        rule.kind === 'level'
          ? rule.level
          : rule.kind === 'special'
            ? rule.fallbackLevel
            : fallbackLevel; // item / friendship
      const value = Math.max(own, compute(edge.from));
      if (value < best) best = value;
    }
    memo.set(id, best);
    return best;
  };

  return compute(speciesId);
}

/**
 * §7.4 — nivel final de un salvaje: base aleatoria en `wildLevelRange`, elevado al
 * mínimo de la especie; legendarios/míticos entran a `legendaryCaptureLevel`.
 */
export function wildCaptureLevel(
  species: { id: number; rarity: string },
  wildLevelRange: [number, number],
  legendaryCaptureLevel: number,
  dataset: Dataset,
  int: (minInclusive: number, maxExclusive: number) => number,
  fallbackLevel = EVOLUTION_FALLBACK_LEVEL,
): number {
  if (species.rarity === 'legendary' || species.rarity === 'mythical') return legendaryCaptureLevel;
  const [min, max] = wildLevelRange;
  const base = min + int(0, Math.max(1, max - min + 1));
  return Math.max(base, minCaptureLevel(species.id, dataset, fallbackLevel));
}
