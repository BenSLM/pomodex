import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/data/db';
import { ensureSeeded } from '../src/data/game';
import { chooseStarter, throwBall } from '../src/data/actions';
import { FakeClock } from '../src/core/clock';
import { mulberry32 } from '../src/core/rng';
import { xpForLevel } from '../src/core/xp';
import { DEFAULT_REWARD_CONFIG } from '../src/core/rewards/config';
import type { Encounter } from '../src/core/types';

const cfg = DEFAULT_REWARD_CONFIG;

beforeEach(async () => {
  await db.delete();
  await db.open();
  await ensureSeeded();
});

describe('elección de inicial (§7.2)', () => {
  it('crea el inicial como compañero y equipo, con Dex y nivel/xp correctos', async () => {
    const c = await chooseStarter(1, { clock: new FakeClock(1000), rng: mulberry32(1) });
    expect(c.speciesId).toBe(1);
    expect(c.level).toBe(cfg.starterLevel);
    expect(c.xp).toBe(xpForLevel(cfg.starterLevel, cfg.xpScale));

    const profile = (await db.profile.get('me'))!;
    expect(profile.companionId).toBe(c.id);
    expect(profile.teamIds).toEqual([c.id]);

    const dex = await db.dex.get(1);
    expect(dex).toMatchObject({ seen: true, caught: true });
  });

  it('acepta un apodo opcional', async () => {
    const c = await chooseStarter(4, { nickname: 'Chispa', clock: new FakeClock(1000), rng: mulberry32(1) });
    expect(c.nickname).toBe('Chispa');
    expect((await db.creatures.get(c.id))!.nickname).toBe('Chispa');
  });

  it('rechaza especies que no son inicial', async () => {
    await expect(chooseStarter(25, { clock: new FakeClock(1), rng: mulberry32(1) })).rejects.toThrow(/inicial/);
  });

  it('no permite elegir dos veces', async () => {
    await chooseStarter(1, { clock: new FakeClock(1), rng: mulberry32(1) });
    await expect(chooseStarter(7, { clock: new FakeClock(2), rng: mulberry32(2) })).rejects.toThrow(/Ya tienes/);
  });
});

describe('nivel coherente al capturar (§7.4)', () => {
  it('capturar no auto-asigna compañero', async () => {
    const enc: Encounter = { id: 'e1', speciesId: 1, shiny: false, level: 5, attempts: 0, expiresAt: 10_000_000 };
    await db.encounters.add(enc);
    const inv = (await db.inventory.get('me'))!;
    await db.inventory.put({ ...inv, balls: { ...inv.balls, master: 1 } });
    await throwBall('e1', 'master', { clock: new FakeClock(1000), rng: mulberry32(1) });
    expect((await db.profile.get('me'))!.companionId).toBeNull();
  });

  it('el capturado recibe la XP correspondiente a su nivel', async () => {
    const enc: Encounter = { id: 'e1', speciesId: 1, shiny: false, level: 8, attempts: 0, expiresAt: 10_000_000 };
    await db.encounters.add(enc);
    const inv = (await db.inventory.get('me'))!;
    await db.inventory.put({ ...inv, balls: { ...inv.balls, master: 1 } });
    const r = await throwBall('e1', 'master', { clock: new FakeClock(1000), rng: mulberry32(1) });
    const creature = (await db.creatures.get(r.creatureId!))!;
    expect(creature.level).toBe(8);
    expect(creature.xp).toBe(xpForLevel(8, cfg.xpScale));
  });
});
