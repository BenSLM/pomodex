import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../src/App';
import { db } from '../src/data/db';

describe('smoke: flujo del timer (E2E ligero)', () => {
  it('arranca, inicia una sesión, la termina y muestra el resumen', async () => {
    render(<App />);

    // arranque con datos sembrados
    const start = await screen.findByRole('button', { name: /Empezar/ });
    expect(await screen.findByText('HOY')).toBeInTheDocument();

    // iniciar → persiste ActiveSession en Dexie
    await userEvent.click(start);
    const pauseBtn = await screen.findByRole('button', { name: /Pausar/ });
    expect(await db.activeSession.count()).toBe(1);

    // pausar/reanudar
    await userEvent.click(pauseBtn);
    await screen.findByRole('button', { name: /Reanudar/ });
    await userEvent.click(screen.getByRole('button', { name: /Reanudar/ }));
    await screen.findByRole('button', { name: /Pausar/ });

    // terminar antes de tiempo → sesión abandonada → resumen
    await userEvent.click(screen.getByRole('button', { name: /Terminar/ }));
    await screen.findByText('Sesión finalizada');

    await waitFor(async () => {
      expect(await db.activeSession.count()).toBe(0);
      expect(await db.sessions.count()).toBe(1);
    });
  });
});
