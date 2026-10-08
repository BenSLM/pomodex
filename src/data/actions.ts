import { db } from './db';
import { ensureSeeded, getSettings, loadGameState } from './game';
import { dataset } from './dataset';
import type { BallId, Category, ItemId, Settings, TypeId } from '../core/types';
import { captureChance } from '../core/capture';
import { applyEvolution, canEvolveWithItem } from '../core/evolution';
import { mulberry32 } from '../core/rng';
import { createOwnedCreature } from '../core/rewards/pipeline';
import { SHOP_CATALOG } from '../core/economy';

export interface CatchResult {
  success: boolean;
  shakes: number;
  creatureId?: string;
}

export async function throwBall(encounterId: string, ball: BallId): Promise<CatchResult> {
  const encounter = await db.encounters.get(encounterId);
  if (!encounter) throw new Error('Encuentro no encontrado');
  const species = dataset.byId.get(encounter.speciesId);
  if (!species) throw new Error('Especie desconocida');
  const inv = await db.inventory.get('me');
  if (!inv || inv.balls[ball] <= 0) throw new Error('No tienes esa ball');
  if (ball !== 'master' && inv.balls[ball] <= 0) throw new Error('No tienes esa ball');

  const p = captureChance(species.captureRate, ball);
  const rng = mulberry32((encounter.id.length * 2654435761 + encounter.throwsLeft * 97 + Date.now()) >>> 0);
  const success = ball === 'master' ? true : rng.chance(p);
  const shakes = p >= 0.8 ? 3 : p >= 0.45 ? 2 : 1;

  inv.balls[ball] -= 1;
  await db.inventory.put(inv);

  if (success) {
    const state = await loadGameState();
    const creature = createOwnedCreature({
      speciesId: encounter.speciesId,
      now: Date.now(),
      ball,
      rng,
      shiny: encounter.shiny,
      dataset,
      level: encounter.level,
    });
    await db.creatures.add(creature);
    const existing = await db.dex.get(encounter.speciesId);
    await db.dex.put({
      speciesId: encounter.speciesId,
      seen: true,
      caught: true,
      shinyCaught: encounter.shiny || existing?.shinyCaught || false,
      firstSeenAt: existing?.firstSeenAt,
      firstCaughtAt: existing?.firstCaughtAt ?? Date.now(),
    });
    await db.encounters.delete(encounterId);
    // primer Pokémon: convertirlo en compañero automáticamente
    if (!state.profile.companionId) {
      await db.profile.update('me', {
        companionId: creature.id,
        teamIds: [creature.id],
      });
    }
    return { success: true, shakes, creatureId: creature.id };
  }

  const throwsLeft = encounter.throwsLeft - 1;
  if (throwsLeft <= 0) {
    await db.encounters.delete(encounterId);
  } else {
    await db.encounters.update(encounterId, { throwsLeft });
  }
  return { success: false, shakes };
}

export async function buyItem(id: BallId | ItemId): Promise<void> {
  const item = SHOP_CATALOG.find((s) => s.id === id);
  if (!item) throw new Error('Ítem no disponible');
  const inv = await db.inventory.get('me');
  const profile = await db.profile.get('me');
  if (!inv || !profile) throw new Error('Sin datos');
  if (profile.coins < item.price) throw new Error('Monedas insuficientes');
  await db.transaction('rw', [db.inventory, db.profile], async () => {
    const p = await db.profile.get('me');
    const i = await db.inventory.get('me');
    if (!p || !i) return;
    p.coins -= item.price;
    if (item.kind === 'ball') i.balls[item.id as BallId] += 1;
    else i.items[item.id as ItemId] = (i.items[item.id as ItemId] ?? 0) + 1;
    await db.profile.put(p);
    await db.inventory.put(i);
  });
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

export async function releaseCreature(creatureId: string): Promise<void> {
  const profile = await db.profile.get('me');
  if (!profile) return;
  const creature = await db.creatures.get(creatureId);
  if (!creature) return;
  await db.transaction('rw', [db.creatures, db.profile], async () => {
    const p = await db.profile.get('me');
    if (!p) return;
    await db.creatures.delete(creatureId);
    await db.profile.put({
      ...p,
      coins: p.coins + 15,
      teamIds: p.teamIds.filter((id) => id !== creatureId),
      companionId: p.companionId === creatureId ? null : p.companionId,
    });
  });
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

export async function upsertCategory(cat: Category): Promise<void> {
  await ensureSeeded();
  await db.categories.put(cat);
}

export async function deleteCategory(id: string): Promise<void> {
  await db.categories.delete(id);
}

export function affinityTypesOf(category?: Category): TypeId[] {
  return category?.affinityTypes ?? [];
}
