import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/data/db';
import { ensureSeeded } from '../src/data/game';
import { buyItem, giveCandy, releaseCreature, releaseDuplicates } from '../src/data/actions';
import { dataset } from '../src/data/dataset';
import { FakeClock } from '../src/core/clock';
import { xpForLevel } from '../src/core/xp';
import { CANDY_ITEM } from '../src/core/candies';
import { DEFAULT_REWARD_CONFIG } from '../src/core/rewards/config';
import type { OwnedCreature } from '../src/core/types';

const cfg = DEFAULT_REWARD_CONFIG;

const owned = (id: string, speciesId: number, level: number, over: Partial<OwnedCreature> = {}): OwnedCreature => ({
  id, speciesId, level, xp: xpForLevel(level, cfg.xpScale), shiny: false, friendship: 70, caughtAt: 0, caughtWith: 'poke', ...over,
});

async function setup(creatures: OwnedCreature[], companionId: string | null, teamIds: string[], items: Record<string, number> = {}) {
  await db.creatures.bulkAdd(creatures);
  await db.profile.update('me', { companionId, teamIds, coins: 10_000 });
  const inv = (await db.inventory.get('me'))!;
  await db.inventory.put({ ...inv, items: { ...inv.items, ...items } });
}

beforeEach(async () => {
  await db.delete();
  await db.open();
  await ensureSeeded();
});

describe('tienda: límite diario (§7.7)', () => {
  it('respeta el límite diario y se reinicia al cambiar el día lógico', async () => {
    await db.profile.update('me', { coins: 10_000 });
    const day1 = new FakeClock(new Date('2026-01-10T12:00:00').getTime());
    for (let i = 0; i < 5; i++) await buyItem('candyXS', { clock: day1 });
    await expect(buyItem('candyXS', { clock: day1 })).rejects.toThrow(/Límite diario/);

    const day2 = new FakeClock(day1.now() + 24 * 3_600_000);
    await buyItem('candyXS', { clock: day2 });
    expect((await db.inventory.get('me'))!.items.candyXS).toBe(6);
  });

  it('las balls no tienen límite diario', async () => {
    await db.profile.update('me', { coins: 10_000 });
    const clock = new FakeClock(1_000_000);
    const before = (await db.inventory.get('me'))!.balls.poke;
    for (let i = 0; i < 8; i++) await buyItem('poke', { clock });
    expect((await db.inventory.get('me'))!.balls.poke).toBe(before + 8);
  });
});

describe('dar caramelo (§7.7)', () => {
  it('no se puede dar al compañero', async () => {
    await setup([owned('c1', 1, 20)], 'c1', ['c1'], { candyS: 1 });
    await expect(giveCandy('c1', 's')).rejects.toThrow(/compañero/);
  });

  it('suma XP, consume el caramelo y recalcula el nivel', async () => {
    await setup([owned('c1', 4, 20), owned('c2', 1, 10)], 'c1', ['c1'], { candyS: 1 });
    const res = await giveCandy('c2', 's');
    expect(res.xpGained).toBe(200);
    expect((await db.creatures.get('c2'))!.xp).toBe(xpForLevel(10, cfg.xpScale) + 200);
    expect((await db.inventory.get('me'))!.items.candyS).toBe(0);
  });

  it('recorta al nivel del compañero y avisa con capped', async () => {
    await setup([owned('c1', 4, 5), owned('c2', 1, 1, { xp: 0 })], 'c1', ['c1'], { candyS: 1 });
    const res = await giveCandy('c2', 's');
    expect(res.capped).toBe(true);
    expect(res.creature.xp).toBe(xpForLevel(5, cfg.xpScale));
  });

  it('crea la evolución pendiente al subir por caramelo (misma función que el pipeline)', async () => {
    await setup([owned('c1', 4, 20), owned('c2', 1, 15, { xp: xpForLevel(15, cfg.xpScale) })], 'c1', ['c1'], { candyS: 1 });
    await giveCandy('c2', 's'); // 843.75 + 200 → nivel 16 → Bulbasaur→Ivysaur
    const meta = await db.meta.get('pendingEvolutions');
    const list = (meta?.value as { creatureId: string }[] | undefined) ?? [];
    expect(list.some((p) => p.creatureId === 'c2')).toBe(true);
  });
});

describe('liberar Pokémon y duplicados (§7.4)', () => {
  it('liberar da el caramelo de la rareza y borra al Pokémon', async () => {
    await setup([owned('c1', 4, 20), owned('c2', 1, 10)], 'c1', ['c1']);
    const size = cfg.releaseCandy[dataset.byId.get(1)!.rarity];
    await releaseCreature('c2');
    expect(await db.creatures.get('c2')).toBeUndefined();
    expect((await db.inventory.get('me'))!.items[CANDY_ITEM[size]]).toBe(1);
  });

  it('no permite liberar al compañero ni al equipo', async () => {
    await setup([owned('c1', 4, 20), owned('c2', 1, 10)], 'c1', ['c1', 'c2']);
    await expect(releaseCreature('c1')).rejects.toThrow(/liberar/);
    await expect(releaseCreature('c2')).rejects.toThrow(/liberar/);
  });

  it('liberar duplicados conserva el mejor y no toca equipo ni shinies', async () => {
    await setup(
      [owned('c1', 1, 10), owned('c2', 1, 8), owned('c3', 1, 12), owned('c4', 1, 5), owned('c5', 1, 3, { shiny: true })],
      'c1',
      ['c1', 'c2'],
    );
    const plan = await releaseDuplicates();
    expect(plan.toRelease.map((c) => c.id)).toEqual(['c4']);
    expect(await db.creatures.get('c3')).toBeTruthy(); // el mejor se queda
    expect(await db.creatures.get('c4')).toBeUndefined();
    expect(await db.creatures.get('c5')).toBeTruthy(); // shiny intacto
    expect(await db.creatures.get('c2')).toBeTruthy(); // equipo intacto
  });
});
