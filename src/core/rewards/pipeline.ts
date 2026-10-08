import type { Clock } from '../clock';
import type { Rng } from '../rng';
import type { Dataset } from '../dataset';
import { getSpecies } from '../dataset';
import type {
  BallId,
  Category,
  Egg,
  Encounter,
  GameState,
  OwnedCreature,
  PendingEvolution,
  RewardConfig,
  SessionRecord,
} from '../types';
import { isValidSession, qualityLabel, ballForQuality, type QualityLabel } from '../quality';
import { sessionXp, levelFromXp } from '../xp';
import { sessionCoins } from '../economy';
import { updateStreak } from '../streak';
import { rollEncounter } from '../encounter';
import { availableEvolutions } from '../evolution';

export interface RewardSummary {
  valid: boolean;
  quality: QualityLabel;
  xpCompanion: number;
  xpTeam: number;
  coins: number;
  levelUps: { creatureId: string; from: number; to: number }[];
  eggObtained: Egg | null;
  eggsHatched: { creatureId: string; speciesId: number }[];
  encounter: Encounter | null;
  streakDays: number;
  streakCredited: boolean;
  shieldUsed: boolean;
  ballEarned: BallId | null;
  evolutionCandidates: PendingEvolution[];
  focusMinutes: number;
}

export interface RewardDeps {
  rng: Rng;
  clock: Clock;
  dataset: Dataset;
  rolloverHour: number;
  categories: Category[];
}

const REGION_GENERATION: Record<string, number> = {
  kanto: 1, johto: 2, hoenn: 3, sinnoh: 4, unova: 5, kalos: 6, alola: 7, galar: 8, paldea: 9,
};
const RARE_PLUS = ['rare', 'epic', 'legendary', 'mythical'];

/** §3.3 — pipeline determinista y ordenado. Devuelve estado nuevo + resumen. */
export function applySessionRewards(
  state: GameState,
  session: SessionRecord,
  config: RewardConfig,
  deps: RewardDeps,
): { state: GameState; summary: RewardSummary } {
  const now = deps.clock.now();
  const label = qualityLabel(session.quality);
  const valid =
    session.outcome === 'completed' &&
    isValidSession(session.focusedMs, session.plannedMs, session.mode, config);
  const abandonedPartial = session.outcome === 'abandoned' && config.abandonCreditRatio > 0;
  const creditedMinutes = valid
    ? session.focusedMs / 60_000
    : abandonedPartial
      ? (session.focusedMs / 60_000) * config.abandonCreditRatio
      : 0;
  const credited = creditedMinutes > 0;

  let profile = { ...state.profile };
  let creatures: OwnedCreature[] = state.creatures.map((c) => ({ ...c }));
  let dex = state.dex.map((d) => ({ ...d }));
  let inventory = cloneInventory(state.inventory);
  let streak = { ...state.streak };
  let pendingEvolutions: PendingEvolution[] = state.pendingEvolutions.map((p) => ({ ...p, options: [...p.options] }));
  let eggs: Egg[] = state.eggs.map((e) => ({ ...e }));
  let encounter: Encounter | null = null;
  let pityCount = profile.pityCount;

  const category = deps.categories.find((c) => c.id === session.categoryId);
  const summary: RewardSummary = {
    valid,
    quality: label,
    xpCompanion: 0,
    xpTeam: 0,
    coins: 0,
    levelUps: [],
    eggObtained: null,
    eggsHatched: [],
    encounter: null,
    streakDays: state.streak.current,
    streakCredited: false,
    shieldUsed: false,
    ballEarned: null,
    evolutionCandidates: [],
    focusMinutes: Math.round(creditedMinutes),
  };

  // 2. XP a compañero y equipo
  if (credited) {
    const xp = sessionXp({
      focusedMinutes: creditedMinutes,
      xpPerMinute: config.xpPerMinute,
      qualityMult: config.qualityMult[label],
      streakDays: streak.current,
    });
    summary.xpCompanion = xp;
    summary.xpTeam = Math.round(xp * config.teamXpShare);

    const teamSet = new Set(profile.teamIds.filter((id) => id !== profile.companionId));
    creatures = creatures.map((c) => {
      if (c.id === profile.companionId) return { ...c, xp: c.xp + xp };
      if (teamSet.has(c.id)) return { ...c, xp: c.xp + summary.xpTeam };
      return c;
    });

    // 3. niveles derivados de la XP
    creatures = creatures.map((c) => {
      const species = getSpecies(deps.dataset, c.speciesId);
      const newLevel = levelFromXp(species.growthRate, c.xp, config.xpScale);
      return newLevel === c.level ? c : { ...c, level: newLevel };
    });
    for (const c of creatures) {
      const prev = state.creatures.find((x) => x.id === c.id);
      if (prev && prev.level !== c.level) summary.levelUps.push({ creatureId: c.id, from: prev.level, to: c.level });
    }

    // candidatas a evolución (confirmables, §7.5)
    for (const c of creatures) {
      const evo = availableEvolutions(deps.dataset, c);
      if (evo && !pendingEvolutions.some((p) => p.creatureId === c.id)) pendingEvolutions.push(evo);
    }
    summary.evolutionCandidates = pendingEvolutions.filter((p) => creatures.some((c) => c.id === p.creatureId));
  }

  // 4. monedas
  if (credited) {
    summary.coins = sessionCoins(creditedMinutes, config.qualityMult[label], config);
    profile = { ...profile, coins: profile.coins + summary.coins };
  }

  // 5. huevos (solo minutos de foco válido)
  if (credited) {
    const remaining: Egg[] = [];
    for (const egg of eggs) {
      const progress = egg.progressMinutes + creditedMinutes;
      if (progress >= egg.requiredMinutes) {
        const hatched = createOwnedCreature({
          speciesId: egg.speciesId,
          now,
          ball: 'poke',
          rng: deps.rng,
          shiny: deps.rng.chance(config.shinyRate),
          dataset: deps.dataset,
        });
        creatures.push(hatched);
        dex = markDex(dex, egg.speciesId, { caught: true, firstCaughtAt: now });
        summary.eggsHatched.push({ creatureId: hatched.id, speciesId: egg.speciesId });
      } else {
        remaining.push({ ...egg, progressMinutes: progress });
      }
    }
    eggs = remaining;
    if (valid && eggs.length < 3 && deps.rng.chance(config.eggDropChance)) {
      const species = rollEggSpecies(deps, config);
      const egg: Egg = {
        id: uid(deps.rng),
        speciesId: species.id,
        requiredMinutes: species.hatchCounter * 5,
        progressMinutes: 0,
        obtainedFrom: 'drop',
      };
      eggs.push(egg);
      summary.eggObtained = egg;
    }
  }

  // 6. racha + amistad
  if (credited) {
    const shieldCount = inventory.items.streakShield ?? 0;
    const update = updateStreak({
      streak,
      focusedMinutes: creditedMinutes,
      now,
      config,
      rolloverHour: deps.rolloverHour,
      shieldAvailable: shieldCount > 0,
    });
    if (update.shieldUsed) inventory.items.streakShield -= 1;
    streak = update.streak;
    summary.streakCredited = update.credited;
    summary.shieldUsed = update.shieldUsed;
    summary.streakDays = streak.current;

    if (update.credited && profile.companionId) {
      const cid = profile.companionId;
      creatures = creatures.map((c) =>
        c.id === cid ? { ...c, friendship: Math.min(255, c.friendship + 1) } : c,
      );
    }
  }

  // 7-8. misiones y logros → Fase 4

  // 9. encuentro
  if (valid && deps.rng.chance(config.encounterChance)) {
    const roll = rollEncounter(deps.dataset, {
      rng: deps.rng,
      config,
      maxGeneration: REGION_GENERATION[profile.currentRegion] ?? 1,
      affinityTypes: category?.affinityTypes ?? [],
      perfect: label === 'perfect',
      flowOvertimeMin: session.overtimeMs / 60_000,
      incenseActive: (inventory.incenseCharges ?? 0) > 0,
      pityCount,
    });
    if ((inventory.incenseCharges ?? 0) > 0) inventory.incenseCharges = (inventory.incenseCharges ?? 0) - 1;
    const species = getSpecies(deps.dataset, roll.speciesId);
    pityCount = RARE_PLUS.includes(species.rarity) ? 0 : pityCount + 1;
    encounter = {
      id: uid(deps.rng),
      speciesId: roll.speciesId,
      shiny: roll.shiny,
      level: 3 + deps.rng.int(0, 8),
      throwsLeft: config.throwsPerEncounter,
      expiresAt: now + config.encounterTtlHours * 3_600_000,
    };
    dex = markDex(dex, roll.speciesId, { seen: true, firstSeenAt: now });
    summary.encounter = encounter;
  }

  // ball por calidad (sesión completada)
  if (valid) {
    const ball = ballForQuality(session.quality);
    inventory.balls[ball] += 1;
    summary.ballEarned = ball;
  }

  profile = { ...profile, pityCount };

  return {
    state: { profile, creatures, dex, inventory, streak, pendingEvolutions, eggs },
    summary,
  };
}

export function createOwnedCreature(params: {
  speciesId: number;
  now: number;
  ball: BallId;
  rng: Rng;
  shiny: boolean;
  dataset: Dataset;
  categoryId?: string;
  level?: number;
}): OwnedCreature {
  const species = getSpecies(params.dataset, params.speciesId);
  return {
    id: uid(params.rng),
    speciesId: params.speciesId,
    level: params.level ?? 3 + params.rng.int(0, 8),
    xp: 0,
    shiny: params.shiny,
    friendship: species.baseHappiness,
    caughtAt: params.now,
    caughtWith: params.ball,
    categoryId: params.categoryId,
  };
}

function rollEggSpecies(deps: RewardDeps, config: RewardConfig) {
  const pool = deps.dataset.creatures.filter((c) => c.isBaby || c.rarity === 'rare' || c.rarity === 'epic');
  const weights = pool.map((c) => config.rarityWeights[c.rarity] * (c.isBaby ? 3 : 1));
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = deps.rng.next() * total;
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

function cloneInventory(inv: GameState['inventory']): GameState['inventory'] {
  return { id: inv.id, balls: { ...inv.balls }, items: { ...inv.items }, incenseCharges: inv.incenseCharges ?? 0 };
}

function markDex(
  dex: GameState['dex'],
  speciesId: number,
  patch: { seen?: boolean; caught?: boolean; shinyCaught?: boolean; firstSeenAt?: number; firstCaughtAt?: number },
): GameState['dex'] {
  const existing = dex.find((d) => d.speciesId === speciesId);
  if (!existing) {
    return [
      ...dex,
      {
        speciesId,
        seen: patch.seen ?? false,
        caught: patch.caught ?? false,
        shinyCaught: patch.shinyCaught ?? false,
        firstSeenAt: patch.firstSeenAt,
        firstCaughtAt: patch.firstCaughtAt,
      },
    ];
  }
  return dex.map((d) =>
    d.speciesId === speciesId
      ? {
          ...d,
          seen: d.seen || (patch.seen ?? false),
          caught: d.caught || (patch.caught ?? false),
          shinyCaught: d.shinyCaught || (patch.shinyCaught ?? false),
          firstSeenAt: d.firstSeenAt ?? patch.firstSeenAt,
          firstCaughtAt: d.firstCaughtAt ?? patch.firstCaughtAt,
        }
      : d,
  );
}

function uid(rng: Rng): string {
  const a = Math.floor(rng.next() * 1e9).toString(36);
  const b = Math.floor(rng.next() * 1e6).toString(36);
  return `id-${a}${b}`;
}
