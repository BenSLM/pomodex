import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EvolutionModal } from '../src/ui/components/EvolutionModal';
import { db } from '../src/data/db';
import { ensureSeeded } from '../src/data/game';
import { confirmEvolution } from '../src/data/actions';
import type { OwnedCreature, PendingEvolution } from '../src/core/types';

const creature: OwnedCreature = {
  id: 'c1', speciesId: 4, level: 20, xp: 1000, shiny: true,
  friendship: 200, caughtAt: 0, caughtWith: 'poke', nickname: 'Chispa',
};

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches, media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {},
    dispatchEvent: () => false,
  }));
}

beforeEach(async () => {
  await db.delete();
  await db.open();
  await ensureSeeded();
  stubMatchMedia(false);
});

afterEach(() => vi.unstubAllGlobals());

describe('EvolutionModal (§7.5)', () => {
  it('confirma y cancela son opciones explícitas', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<EvolutionModal creature={creature} toSpeciesId={5} onConfirm={onConfirm} onCancel={onCancel} />);

    expect(await screen.findByRole('dialog', { name: /Charmeleon/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('no rompe con reduced motion (crossfade sin destello)', async () => {
    stubMatchMedia(true);
    render(<EvolutionModal creature={creature} toSpeciesId={5} onConfirm={() => {}} onCancel={() => {}} />);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeInTheDocument();
  });
});

describe('confirmEvolution conserva el estado (§7.5)', () => {
  it('mantiene apodo, nivel, XP, amistad y shiny, y limpia la pendiente', async () => {
    await db.creatures.put(creature);
    const pending: PendingEvolution[] = [{ creatureId: 'c1', options: [{ toSpeciesId: 5 }] }];
    await db.meta.put({ key: 'pendingEvolutions', value: pending });

    await confirmEvolution('c1', 5);

    const after = (await db.creatures.get('c1'))!;
    expect(after.speciesId).toBe(5);
    expect(after).toMatchObject({ nickname: 'Chispa', level: 20, xp: 1000, friendship: 200, shiny: true });
    const meta = await db.meta.get('pendingEvolutions');
    expect((meta!.value as PendingEvolution[]).length).toBe(0);
  });
});
