import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { ensureSeeded } from '../src/data/game';
import { backupSchema, exportBackup, importBackup, validateBackup } from '../src/data/export';
import { db } from '../src/data/db';

describe('export/import (§12)', () => {
  it('el backup exportado valida con el schema Zod y es reimportable', async () => {
    await ensureSeeded();
    const backup = await exportBackup();
    expect(() => backupSchema.parse(backup)).not.toThrow();

    const parsed = validateBackup(JSON.parse(JSON.stringify(backup)));
    expect(parsed.format).toBe('focus-trainer-backup');
    expect(parsed.tables.profile.id).toBe('me');

    const previous = await importBackup(parsed);
    expect(previous.tables.profile.id).toBe('me');
    const again = await exportBackup();
    expect(again.tables.profile.schemaVersion).toBe(parsed.tables.profile.schemaVersion);
  });

  it('un backup antiguo con categorías/categoryId/throwsLeft sigue importándose (legacy se descarta)', async () => {
    await ensureSeeded();
    const current = JSON.parse(JSON.stringify(await exportBackup())) as {
      format: string;
      schemaVersion: number;
      exportedAt: number;
      tables: Record<string, unknown>;
    };
    const legacy = {
      ...current,
      schemaVersion: 1,
      tables: {
        ...current.tables,
        categories: [{ id: 'study', name: 'Estudiar', icon: '📚', color: '#fff', affinityTypes: ['psychic'] }],
        sessions: [
          {
            id: 's-old', categoryId: 'study', mode: 'pomodoro', plannedMs: 1_500_000, focusedMs: 1_500_000,
            overtimeMs: 0, startedAt: 1, endedAt: 2, pauseCount: 0, distractionCount: 0, quality: 95,
            outcome: 'completed', xp: 10, coins: 5,
          },
        ],
        activeSession: {
          id: 'a-old', state: 'focusing', categoryId: 'study', mode: 'pomodoro', plannedMs: 1_500_000,
          startedAt: 1, pausedAccumulatedMs: 0, pauseCount: 0, distractionCount: 0,
        },
        creatures: [
          {
            id: 'c-old', speciesId: 1, level: 5, xp: 0, shiny: false, friendship: 70, caughtAt: 1,
            caughtWith: 'poke', categoryId: 'study',
          },
        ],
        encounters: [{ id: 'enc-old', speciesId: 1, shiny: false, level: 5, throwsLeft: 3, expiresAt: 999 }],
        goals: [{ id: 'g-old', name: 'Meta', categoryId: 'study', targetMinutes: 60, progressMinutes: 0 }],
      },
    };

    const parsed = validateBackup(legacy);
    const tables = parsed.tables as unknown as Record<string, unknown>;
    expect(tables.categories).toBeUndefined();
    expect((parsed.tables.sessions[0] as { categoryId?: string }).categoryId).toBeUndefined();
    expect((parsed.tables.encounters[0] as { throwsLeft?: number }).throwsLeft).toBeUndefined();

    await importBackup(parsed);
    expect(await db.sessions.count()).toBe(1);
    expect((await db.sessions.toArray())[0].id).toBe('s-old');
  });

  it('rechaza backups corruptos', async () => {
    await ensureSeeded();
    expect(() => validateBackup({ format: 'otra-cosa' })).toThrow();
    expect(() => validateBackup(null)).toThrow();
  });
});
