/**
 * Genera el dataset estático de la app a partir de PokeAPI:
 *   src/data/dataset/creatures.json
 *   src/data/dataset/types.json
 *   src/data/dataset/evolutions.json
 *
 * Uso: npm run build-dataset [-- --limit=50] [-- --out=<dir>]
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const API = 'https://pokeapi.co/api/v2';
const OUT_DIR = resolve(process.argv.find((a) => a.startsWith('--out='))?.slice(6) ?? 'src/data/dataset');
const LIMIT = Number(process.argv.find((a) => a.startsWith('--limit='))?.slice(8) ?? Infinity);
const CONCURRENCY = 8;
const PAUSE_MS = 100;

type GrowthRateApi =
  | 'slow'
  | 'medium'
  | 'fast'
  | 'medium-slow'
  | 'slow-then-very-fast'
  | 'fast-then-very-slow';

const GROWTH_MAP: Record<GrowthRateApi, string> = {
  slow: 'slow',
  medium: 'medium-fast',
  fast: 'fast',
  'medium-slow': 'medium-slow',
  'slow-then-very-fast': 'fluctuating',
  'fast-then-very-slow': 'erratic',
};

const TYPES = [
  'normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison',
  'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy',
];

interface EvolutionRuleJson {
  kind: 'level' | 'item' | 'friendship' | 'special';
  level?: number;
  min?: number;
  itemId?: string;
}

interface SpeciesJson {
  id: number;
  slug: string;
  name: { es: string; en: string };
  types: string[];
  captureRate: number;
  baseHappiness: number;
  hatchCounter: number;
  growthRate: string;
  rarity: string;
  bst: number;
  generation: number;
  isBaby: boolean;
  flavor: { es?: string; en?: string };
  evolutionChainId: number;
  sprites: { front: string | null; frontShiny: string | null; animated: string | null; animatedShiny: string | null };
  cry: string | null;
}

let inflight = 0;
const queue: (() => Promise<void>)[] = [];

async function fetchJson(url: string): Promise<any> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      await new Promise((r) => setTimeout(r, PAUSE_MS));
      return await res.json();
    } catch (err) {
      if (attempt >= 4) throw err;
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
    }
  }
}

async function mapLimit<T, R>(items: T[], fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, worker));
  return results;
}
void inflight;
void queue;

function cleanFlavor(text: string): string {
  return text.replace(/\f|\n|\r/g, ' ').replace(/\s+/g, ' ').trim();
}

function deriveRarity(isMythical: boolean, isLegendary: boolean, captureRate: number, bst: number): string {
  if (isMythical) return 'mythical';
  if (isLegendary) return 'legendary';
  if (bst >= 580 || captureRate <= 45) return 'epic';
  if (captureRate <= 119) return 'rare';
  if (captureRate <= 189) return 'uncommon';
  return 'common';
}

function normalizeEvolution(details: any[]): EvolutionRuleJson {
  for (const d of details) {
    if (d.min_level != null) return { kind: 'level', level: d.min_level };
    if (d.item) return { kind: 'item', itemId: d.item.name };
    if (d.min_happiness != null) return { kind: 'friendship', min: d.min_happiness };
  }
  return { kind: 'special', level: 36 };
}

async function main() {
  console.log('Consultando PokeAPI…');
  const [speciesList, typeList] = await Promise.all([
    fetchJson(`${API}/pokemon-species?limit=100000`),
    Promise.all(TYPES.map((t) => fetchJson(`${API}/type/${t}`))),
  ]);

  const speciesUrls: string[] = speciesList.results.map((r: any) => r.url).slice(0, LIMIT);
  console.log(`Especies: ${speciesUrls.length}`);

  const species = await mapLimit(speciesUrls, (url) => fetchJson(url));
  console.log('Detalle de especies listo');

  const pokemon = await mapLimit(species, (s) => fetchJson(`${API}/pokemon/${s.id}`));
  console.log('Detalle de pokemon listo');

  const chainUrls = [...new Set(species.map((s: any) => s.evolution_chain.url))] as string[];
  const chains = await mapLimit(chainUrls, (url) => fetchJson(url));
  console.log(`Cadenas de evolución: ${chains.length}`);

  // creatures.json
  const creatures: SpeciesJson[] = species.map((s: any, i: number) => {
    const p = pokemon[i];
    const names: Record<string, string> = {};
    for (const n of s.names ?? []) names[n.language.name] = n.name;
    const flavors: Record<string, string> = {};
    for (const f of s.flavor_text_entries ?? []) {
      if ((f.language.name === 'es' || f.language.name === 'en') && !flavors[f.language.name])
        flavors[f.language.name] = cleanFlavor(f.flavor_text);
    }
    const bw = p.sprites.versions?.['generation-v']?.['black-white']?.animated;
    return {
      id: s.id,
      slug: s.name,
      name: { es: names.es ?? s.name, en: names.en ?? s.name },
      types: p.types.map((t: any) => t.type.name).filter((t: string) => TYPES.includes(t)),
      captureRate: s.capture_rate,
      baseHappiness: s.base_happiness ?? 70,
      hatchCounter: s.hatch_counter ?? 20,
      growthRate: GROWTH_MAP[s.growth_rate.name as GrowthRateApi] ?? 'medium-fast',
      rarity: deriveRarity(s.is_mythical, s.is_legendary, s.capture_rate, bst(p.stats)),
      bst: bst(p.stats),
      generation: Number(s.generation.name.replace(/\D/g, '')),
      isBaby: s.is_baby,
      flavor: { es: flavors.es, en: flavors.en },
      evolutionChainId: Number(s.evolution_chain.url.split('/').filter(Boolean).pop()),
      sprites: {
        front: p.sprites.front_default,
        frontShiny: p.sprites.front_shiny,
        animated: bw?.front_default ?? null,
        animatedShiny: bw?.front_shiny ?? null,
      },
      cry: p.cries?.latest ?? null,
    };
  });

  // types.json (matriz 18x18: efectividad de atacante contra defensor)
  const matrix: Record<string, Record<string, number>> = {};
  typeList.forEach((t: any, i: number) => {
    const atk = TYPES[i];
    matrix[atk] = {};
    for (const def of TYPES) matrix[atk][def] = 1;
    const set = (list: any[], v: number) => {
      for (const x of list) if (TYPES.includes(x.name)) matrix[atk][x.name] = v;
    };
    set(t.damage_relations.no_damage_from ?? [], 0);
    set(t.damage_relations.double_damage_from ?? [], 2);
    set(t.damage_relations.half_damage_from ?? [], 0.5);
  });

  // evolutions.json: aristas {from, to, rule}
  const evolutionEdges: { chainId: number; from: number; to: number; rule: EvolutionRuleJson }[] = [];
  for (const chain of chains) {
    const walk = (node: any) => {
      for (const e of node.evolves_to ?? []) {
        evolutionEdges.push({
          chainId: Number(chain.id),
          from: Number(node.species.url.split('/').filter(Boolean).pop()),
          to: Number(e.species.url.split('/').filter(Boolean).pop()),
          rule: normalizeEvolution(e.evolution_details ?? []),
        });
        walk(e);
      }
    };
    walk(chain.chain);
  }

  await mkdir(OUT_DIR, { recursive: true });
  await Promise.all([
    writeFile(resolve(OUT_DIR, 'creatures.json'), JSON.stringify(creatures)),
    writeFile(resolve(OUT_DIR, 'types.json'), JSON.stringify(matrix)),
    writeFile(resolve(OUT_DIR, 'evolutions.json'), JSON.stringify(evolutionEdges)),
  ]);
  console.log(`Dataset escrito en ${OUT_DIR} (${creatures.length} especies, ${evolutionEdges.length} evoluciones)`);
}

function bst(stats: any[]): number {
  return stats.reduce((sum: number, s: any) => sum + s.base_stat, 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
