import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/data/db';
import { ensureSeeded } from '../src/data/game';
import { pruneExpiredEncounters, releaseEncounter, throwBall } from '../src/data/actions';
import { isEncounterExpired } from '../src/core/encounter';
import { FakeClock } from '../src/core/clock';
import type { Rng } from '../src/core/rng';
import type { Encounter } from '../src/core/types';

const failing: Rng = { next: () => 0.999, int: () => 0, chance: () => false };
const succeeding: Rng = { next: () => 0, int: () => 0, chance: () => true };

const enc = (over: Partial<Encounter> = {}): Encounter => ({
  id: 'e1',
  speciesId: 1,
  shiny: false,
  level: 5,
  attempts: 0,
  expiresAt: 10_000_000,
  ...over,
});

beforeEach(async () => {
  await db.delete();
  await db.open();
  await ensureSeeded();
});

describe('lanzamientos ilimitados (§7.4)', () => {
  it('isEncounterExpired: caduca a partir de expiresAt', () => {
    expect(isEncounterExpired({ expiresAt: 100 }, 99)).toBe(false);
    expect(isEncounterExpired({ expiresAt: 100 }, 100)).toBe(true);
    expect(isEncounterExpired({ expiresAt: 100 }, 101)).toBe(true);
  });

  it('N fallos seguidos no eliminan el encuentro y cada lanzamiento resta una ball', async () => {
    await db.encounters.add(enc());
    const start = (await db.inventory.get('me'))!.balls.poke;
    for (let i = 0; i < 5; i++) {
      const r = await throwBall('e1', 'poke', { clock: new FakeClock(1_000), rng: failing });
      expect(r.success).toBe(false);
    }
    const after = await db.encounters.get('e1');
    expect(after).toBeTruthy();
    expect(after!.attempts).toBe(5);
    expect((await db.inventory.get('me'))!.balls.poke).toBe(start - 5);
  });

  it('con 0 balls no se puede lanzar y el encuentro queda pendiente', async () => {
    await db.encounters.add(enc());
    const inv = (await db.inventory.get('me'))!;
    await db.inventory.put({ ...inv, balls: { ...inv.balls, poke: 0 } });
    await expect(throwBall('e1', 'poke', { clock: new FakeClock(1_000), rng: failing })).rejects.toThrow();
    expect(await db.encounters.get('e1')).toBeTruthy();
  });

  it('el TTL hace huir al Pokémon sin gastar ball', async () => {
    await db.encounters.add(enc({ expiresAt: 500 }));
    const start = (await db.inventory.get('me'))!.balls.poke;
    const r = await throwBall('e1', 'poke', { clock: new FakeClock(600), rng: succeeding });
    expect(r.fled).toBe(true);
    expect(r.success).toBe(false);
    expect(await db.encounters.get('e1')).toBeUndefined();
    expect((await db.inventory.get('me'))!.balls.poke).toBe(start);
  });

  it('la Master Ball acierta siempre y registra al Pokémon capturado', async () => {
    await db.encounters.add(enc());
    const inv = (await db.inventory.get('me'))!;
    await db.inventory.put({ ...inv, balls: { ...inv.balls, master: 1 } });
    const r = await throwBall('e1', 'master', { clock: new FakeClock(1_000), rng: failing });
    expect(r.success).toBe(true);
    expect(r.creatureId).toBeTruthy();
    expect(await db.encounters.get('e1')).toBeUndefined();
    expect(await db.creatures.count()).toBe(1);
    // Prompt 5: capturar ya NO auto-asigna compañero (se elige el inicial aparte)
    expect((await db.profile.get('me'))!.companionId).toBeNull();
  });

  it('releaseEncounter elimina el encuentro (Dejar ir)', async () => {
    await db.encounters.add(enc());
    await releaseEncounter('e1');
    expect(await db.encounters.get('e1')).toBeUndefined();
  });

  it('pruneExpiredEncounters borra los caducados y conserva los vigentes', async () => {
    await db.encounters.bulkAdd([enc({ id: 'old', expiresAt: 100 }), enc({ id: 'new', expiresAt: 10_000 })]);
    const removed = await pruneExpiredEncounters(500);
    expect(removed).toBe(1);
    expect(await db.encounters.get('old')).toBeUndefined();
    expect(await db.encounters.get('new')).toBeTruthy();
  });
});
