import { db } from './db';
import { getSettings } from './game';
import { dataset } from './dataset';
import type { BallId, CandySize, ItemId, OwnedCreature, PendingEvolution, Settings } from '../core/types';
import { captureChance, shakesFor } from '../core/capture';
import { applyEvolution, availableEvolutions, canEvolveWithItem } from '../core/evolution';
import { isEncounterExpired } from '../core/encounter';
import { mulberry32, type Rng } from '../core/rng';
import { SystemClock, type Clock } from '../core/clock';
import { createOwnedCreature } from '../core/rewards/pipeline';
import { xpForLevel } from '../core/xp';
import { dailyLimitFor, SHOP_CATALOG } from '../core/economy';
import { dayKey } from '../core/streak';
import { applyCandy, CANDY_ITEM, type CandyResult } from '../core/candies';
import { canRelease, duplicatePlan, releaseCandyFor, type DuplicatePlan } from '../core/release';

export interface CatchResult {
  success: boolean;
  shakes: number;
  creatureId?: string;
  /** true si el encuentro había expirado y el Pokémon huyó sin gastar ball. */
  fled?: boolean;
}

export interface ThrowDeps {
  clock: Clock;
  rng: Rng;
}

export async function throwBall(
  encounterId: string,
  ball: BallId,
  deps: Partial<ThrowDeps> = {},
): Promise<CatchResult> {
  const clock = deps.clock ?? new SystemClock();
  const now = clock.now();
  const encounter = await db.encounters.get(encounterId);
  if (!encounter) throw new Error('Encuentro no encontrado');
  if (isEncounterExpired(encounter, now)) {
    await db.encounters.delete(encounterId);
    return { success: false, shakes: 0, fled: true };
  }
  const species = dataset.byId.get(encounter.speciesId);
  if (!species) throw new Error('Especie desconocida');
  const inv = await db.inventory.get('me');
  if (!inv || (inv.balls[ball] ?? 0) <= 0) throw new Error('No tienes esa ball');

  const attempts = encounter.attempts ?? 0;
  const rng = deps.rng ?? mulberry32((encounter.id.length * 2654435761 + attempts * 97 + now) >>> 0);
  const p = captureChance(species.captureRate, ball);
  const success = ball === 'master' ? true : rng.chance(p);
  const shakes = shakesFor(p);

  inv.balls[ball] -= 1;
  await db.inventory.put(inv);

  if (success) {
    const settings = await getSettings();
    const creature = createOwnedCreature({
      speciesId: encounter.speciesId,
      now,
      ball,
      rng,
      shiny: encounter.shiny,
      dataset,
      level: encounter.level,
      xp: xpForLevel(encounter.level, settings.rewards.xpScale),
    });
    await db.creatures.add(creature);
    const existing = await db.dex.get(encounter.speciesId);
    await db.dex.put({
      speciesId: encounter.speciesId,
      seen: true,
      caught: true,
      shinyCaught: encounter.shiny || existing?.shinyCaught || false,
      firstSeenAt: existing?.firstSeenAt,
      firstCaughtAt: existing?.firstCaughtAt ?? now,
    });
    await db.encounters.delete(encounterId);
    return { success: true, shakes, creatureId: creature.id };
  }

  // Fallo: el Pokémon no huye y los intentos son ilimitados; solo cuenta el gasto de ball.
  await db.encounters.update(encounterId, { attempts: attempts + 1 });
  return { success: false, shakes };
}

/** §7.4 — el usuario deja ir al Pokémon (con confirmación en la UI). */
export async function releaseEncounter(encounterId: string): Promise<void> {
  await db.encounters.delete(encounterId);
}

/** §7.4 — elimina los encuentros caducados (el Pokémon "huye" por TTL). */
export async function pruneExpiredEncounters(now: number): Promise<number> {
  const all = await db.encounters.toArray();
  const expired = all.filter((e) => isEncounterExpired(e, now));
  if (expired.length > 0) await db.encounters.bulkDelete(expired.map((e) => e.id));
  return expired.length;
}

export async function buyItem(id: BallId | ItemId, deps: { clock?: Clock } = {}): Promise<void> {
  const item = SHOP_CATALOG.find((s) => s.id === id);
  if (!item) throw new Error('Ítem no disponible');
  const inv = await db.inventory.get('me');
  const profile = await db.profile.get('me');
  if (!inv || !profile) throw new Error('Sin datos');
  if (profile.coins < item.price) throw new Error('Monedas insuficientes');

  const clock = deps.clock ?? new SystemClock();
  const settings = await getSettings();
  const today = dayKey(clock.now(), settings.dayRolloverHour);
  const limit = dailyLimitFor(item.id, settings.rewards);

  await db.transaction('rw', [db.inventory, db.profile], async () => {
    const p = await db.profile.get('me');
    const i = await db.inventory.get('me');
    if (!p || !i) return;
    if (p.coins < item.price) throw new Error('Monedas insuficientes');
    const daily = i.shopDaily?.day === today ? i.shopDaily : { day: today, counts: {} };
    const key = item.id as ItemId;
    if (limit != null && i.shopDaily?.day === today && (i.shopDaily.counts[key] ?? 0) >= limit) {
      throw new Error('Límite diario alcanzado');
    }
    p.coins -= item.price;
    if (item.kind === 'ball') i.balls[item.id as BallId] += 1;
    else i.items[key] = (i.items[key] ?? 0) + 1;
    if (limit != null) {
      daily.counts[key] = (daily.counts[key] ?? 0) + 1;
      i.shopDaily = daily;
    }
    await db.profile.put(p);
    await db.inventory.put(i);
  });
}

/** §7.7 — da un caramelo a un Pokémon (nunca al compañero; tope = nivel del compañero). */
export async function giveCandy(creatureId: string, size: CandySize): Promise<CandyResult> {
  const settings = await getSettings();
  const profile = await db.profile.get('me');
  const inv = await db.inventory.get('me');
  if (!profile || !inv) throw new Error('Sin datos');
  if (profile.companionId === creatureId) throw new Error('No puedes dar caramelos al compañero');
  const item = CANDY_ITEM[size];
  if ((inv.items[item] ?? 0) <= 0) throw new Error('No tienes ese caramelo');
  const creature = await db.creatures.get(creatureId);
  if (!creature) throw new Error('Pokémon no encontrado');
  const companion = profile.companionId ? await db.creatures.get(profile.companionId) : undefined;
  const companionLevel = companion?.level ?? 1;
  const result = applyCandy(creature, size, settings.rewards, companionLevel);
  if (result.xpGained <= 0) throw new Error('Ya está al nivel del compañero');

  await db.transaction('rw', [db.creatures, db.inventory, db.meta], async () => {
    await db.creatures.put(result.creature);
    const i = await db.inventory.get('me');
    if (i) {
      i.items[item] = (i.items[item] ?? 0) - 1;
      await db.inventory.put(i);
    }
    const evo = availableEvolutions(dataset, result.creature);
    if (evo) {
      const meta = await db.meta.get('pendingEvolutions');
      const list = (meta?.value as PendingEvolution[] | undefined) ?? [];
      const next = list.some((p) => p.creatureId === creatureId)
        ? list.map((p) => (p.creatureId === creatureId ? evo : p))
        : [...list, evo];
      await db.meta.put({ key: 'pendingEvolutions', value: next });
    }
  });
  return result;
}

export async function feedBerry(): Promise<void> {
  const profile = await db.profile.get('me');
  const inv = await db.inventory.get('me');
  if (!profile?.companionId || !inv) throw new Error('Sin compañero o sin bayas');
  if ((inv.items.berry ?? 0) <= 0) throw new Error('No tienes bayas');
  const creature = await db.creatures.get(profile.companionId);
  if (!creature) return;
  inv.items.berry -= 1;
  await db.inventory.put(inv);
  await db.creatures.put({ ...creature, friendship: Math.min(255, creature.friendship + 3) });
}

export async function useIncense(): Promise<void> {
  const inv = await db.inventory.get('me');
  if (!inv || (inv.items.incense ?? 0) <= 0) throw new Error('No tienes incienso');
  inv.items.incense -= 1;
  inv.incenseCharges = (inv.incenseCharges ?? 0) + 5;
  await db.inventory.put(inv);
}

/** §7.2 — elige el inicial (Bulbasaur/Charmander/Squirtle) y lo fija como compañero y equipo. */
export async function chooseStarter(
  speciesId: number,
  opts: { nickname?: string; clock?: Clock; rng?: Rng } = {},
): Promise<OwnedCreature> {
  const settings = await getSettings();
  if (!settings.rewards.starterSpeciesIds.includes(speciesId)) {
    throw new Error('Esa especie no es un inicial válido');
  }
  if ((await db.creatures.count()) > 0) throw new Error('Ya tienes Pokémon');
  const clock = opts.clock ?? new SystemClock();
  const now = clock.now();
  const rng = opts.rng ?? mulberry32((now ^ speciesId) >>> 0);
  const level = settings.rewards.starterLevel;
  const creature = createOwnedCreature({
    speciesId,
    now,
    ball: 'poke',
    rng,
    shiny: false,
    dataset,
    level,
    xp: xpForLevel(level, settings.rewards.xpScale),
  });
  if (opts.nickname?.trim()) creature.nickname = opts.nickname.trim();

  await db.transaction('rw', [db.creatures, db.dex, db.profile], async () => {
    await db.creatures.add(creature);
    const existing = await db.dex.get(speciesId);
    await db.dex.put({
      speciesId,
      seen: true,
      caught: true,
      shinyCaught: false,
      firstSeenAt: existing?.firstSeenAt ?? now,
      firstCaughtAt: existing?.firstCaughtAt ?? now,
    });
    await db.profile.update('me', { companionId: creature.id, teamIds: [creature.id] });
  });
  return creature;
}

export async function setCompanion(creatureId: string): Promise<void> {
  const profile = await db.profile.get('me');
  if (!profile) return;
  const team = profile.teamIds.includes(creatureId)
    ? profile.teamIds
    : [...profile.teamIds.filter((id) => id !== creatureId).slice(0, 5), creatureId];
  await db.profile.put({ ...profile, companionId: creatureId, teamIds: team.slice(0, 6) });
}

export async function addToTeam(creatureId: string): Promise<void> {
  const profile = await db.profile.get('me');
  if (!profile || profile.teamIds.includes(creatureId) || profile.teamIds.length >= 6) return;
  await db.profile.put({ ...profile, teamIds: [...profile.teamIds, creatureId] });
}

export async function removeFromTeam(creatureId: string): Promise<void> {
  const profile = await db.profile.get('me');
  if (!profile) return;
  await db.profile.put({
    ...profile,
    teamIds: profile.teamIds.filter((id) => id !== creatureId),
    companionId: profile.companionId === creatureId ? null : profile.companionId,
  });
}

/** §7.4 — libera un Pokémon por caramelos según su rareza. No permite liberar protegidos. */
export async function releaseCreature(creatureId: string): Promise<Partial<Record<ItemId, number>>> {
  const settings = await getSettings();
  const profile = await db.profile.get('me');
  const creature = await db.creatures.get(creatureId);
  if (!profile || !creature) return {};
  if (!canRelease(creature, profile, dataset)) throw new Error('No se puede liberar este Pokémon');
  const size = releaseCandyFor(creature.speciesId, dataset, settings.rewards);
  const item = size ? CANDY_ITEM[size] : null;
  await db.transaction('rw', [db.creatures, db.profile, db.inventory], async () => {
    const p = await db.profile.get('me');
    const i = await db.inventory.get('me');
    await db.creatures.delete(creatureId);
    if (p) {
      await db.profile.put({
        ...p,
        teamIds: p.teamIds.filter((id) => id !== creatureId),
        companionId: p.companionId === creatureId ? null : p.companionId,
      });
    }
    if (i && item) {
      i.items[item] = (i.items[item] ?? 0) + 1;
      await db.inventory.put(i);
    }
  });
  return item ? { [item]: 1 } : {};
}

/** §7.4 — libera duplicados de la caja conservando el mejor de cada especie (sin tocar equipo/shinies). */
export async function releaseDuplicates(): Promise<DuplicatePlan> {
  const settings = await getSettings();
  const profile = await db.profile.get('me');
  if (!profile) return { toRelease: [], candies: {} };
  const creatures = await db.creatures.toArray();
  const plan = duplicatePlan(creatures, profile, dataset, settings.rewards);
  if (plan.toRelease.length === 0) return plan;
  await db.transaction('rw', [db.creatures, db.inventory], async () => {
    await db.creatures.bulkDelete(plan.toRelease.map((c) => c.id));
    const i = await db.inventory.get('me');
    if (i) {
      for (const [size, n] of Object.entries(plan.candies)) {
        const item = CANDY_ITEM[size as CandySize];
        i.items[item] = (i.items[item] ?? 0) + (n ?? 0);
      }
      await db.inventory.put(i);
    }
  });
  return plan;
}

export async function confirmEvolution(creatureId: string, toSpeciesId: number): Promise<void> {
  const creature = await db.creatures.get(creatureId);
  if (!creature) return;
  await db.creatures.put(applyEvolution(creature, toSpeciesId));
  const meta = await db.meta.get('pendingEvolutions');
  const list = (meta?.value as { creatureId: string }[] | undefined) ?? [];
  await db.meta.put({ key: 'pendingEvolutions', value: list.filter((p) => p.creatureId !== creatureId) });
}

export async function dismissEvolution(creatureId: string): Promise<void> {
  const meta = await db.meta.get('pendingEvolutions');
  const list = (meta?.value as { creatureId: string }[] | undefined) ?? [];
  await db.meta.put({ key: 'pendingEvolutions', value: list.filter((p) => p.creatureId !== creatureId) });
}

export async function evolveWithItem(creatureId: string, itemId: ItemId): Promise<boolean> {
  const creature = await db.creatures.get(creatureId);
  const inv = await db.inventory.get('me');
  if (!creature || !inv || (inv.items[itemId] ?? 0) <= 0) return false;
  const to = canEvolveWithItem(dataset, creature, itemId);
  if (to == null) return false;
  inv.items[itemId] -= 1;
  await db.inventory.put(inv);
  await confirmEvolution(creatureId, to);
  return true;
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  const current = (await db.settings.get('me')) ?? (await getSettings());
  await db.settings.put({ ...current, ...patch });
}
