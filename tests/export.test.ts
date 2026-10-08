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
    expect(parsed.tables.categories.length).toBeGreaterThan(0);

    const previous = await importBackup(parsed);
    expect(previous.tables.profile.id).toBe('me');
    const again = await exportBackup();
    expect(again.tables.profile.schemaVersion).toBe(parsed.tables.profile.schemaVersion);
    expect((await db.categories.count())).toBe(parsed.tables.categories.length);
  });

  it('rechaza backups corruptos', async () => {
    await ensureSeeded();
    expect(() => validateBackup({ format: 'otra-cosa' })).toThrow();
    expect(() => validateBackup(null)).toThrow();
  });
});
