import { Btn } from './motion';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Modal, RarityBadge, Sprite, TypeBadge } from './ui';
import { dataset } from '../../data/dataset';
import { releaseEncounter, throwBall } from '../../data/actions';
import { captureChance, BALL_MULTIPLIER } from '../../core/capture';
import type { BallId, Encounter } from '../../core/types';
import { db } from '../../data/db';
import { useLiveQuery } from 'dexie-react-hooks';

const BALLS: BallId[] = ['poke', 'great', 'ultra', 'master'];

export function EncounterModal({ encounter, onClose }: { encounter: Encounter; onClose: () => void }) {
  const [state, setState] = useState<'throwing' | 'caught' | 'fled' | 'idle'>('idle');
  const [message, setMessage] = useState('');
  const [shakes, setShakes] = useState(0);
  const [ball, setBall] = useState<BallId>('poke');
  const [attempts, setAttempts] = useState(encounter.attempts ?? 0);
  const [confirmRelease, setConfirmRelease] = useState(false);
  const inventory = useLiveQuery(() => db.inventory.get('me'), []);
  const species = dataset.byId.get(encounter.speciesId);
  if (!species) return null;

  const totalBalls = inventory ? BALLS.reduce((sum, b) => sum + (inventory.balls[b] ?? 0), 0) : 0;

  const doThrow = async () => {
    if (!inventory || (inventory.balls[ball] ?? 0) <= 0) return;
    setState('throwing');
    setMessage(`Lanzando ${ball.toUpperCase()} Ball…`);
    const result = await throwBall(encounter.id, ball);
    setShakes(result.shakes);
    setTimeout(() => {
      if (result.success) {
        setState('caught');
        setMessage('¡Capturado!');
      } else if (result.fled) {
        setState('fled');
        setMessage('El Pokémon huyó…');
      } else {
        setState('idle');
        setShakes(0);
        setAttempts((n) => n + 1);
        setMessage('¡Casi! El Pokémon sigue ahí. Inténtalo otra vez.');
      }
    }, 900);
  };

  const doRelease = async () => {
    await releaseEncounter(encounter.id);
    onClose();
  };

  return (
    <Modal title="¡Encuentro!" onClose={onClose}>
      <div className="flex flex-col items-center gap-2">
        <Sprite species={species} shiny={encounter.shiny} size={128} />
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold">
            {species.name.es}
            {encounter.shiny && <span title="Shiny"> ✦</span>}
          </span>
          <RarityBadge rarity={species.rarity} />
        </div>
        <div className="flex gap-1">
          {species.types.map((t) => (
            <TypeBadge key={t} type={t} />
          ))}
        </div>
        <p className="text-sm text-[var(--muted)]">Nivel {encounter.level} · Intento {attempts + 1}</p>

        <div className="flex justify-center gap-1 text-xl" aria-live="polite">
          {state === 'throwing' && <span>{'●'.repeat(Math.max(1, shakes))}</span>}
          {state === 'caught' && <span style={{ color: 'var(--success)' }}>✓</span>}
        </div>
        {message && <p className="text-sm font-bold">{message}</p>}
      </div>

      {state !== 'caught' && state !== 'fled' && (
        <>
          {totalBalls === 0 ? (
            <div className="panel mt-4 p-3 text-sm" style={{ borderColor: 'var(--accent-dark)' }}>
              <p className="font-bold">No tienes balls.</p>
              <p className="text-[var(--muted)]">El encuentro seguirá esperando: compra balls para poder lanzar.</p>
              <Link className="btn btn-accent mt-2 block text-center" to="/shop" onClick={onClose}>
                Ir a la Tienda
              </Link>
            </div>
          ) : (
            <>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {BALLS.map((b) => {
                  const count = inventory?.balls[b] ?? 0;
                  const p = captureChance(species.captureRate, b);
                  return (
                    <Btn
                      key={b}
                      className={`btn ${ball === b ? 'btn-accent' : ''}`}
                      disabled={count <= 0}
                      onClick={() => setBall(b)}
                    >
                      <div>{b.toUpperCase()} Ball ×{count}</div>
                      <div className="text-xs font-normal">{(p * 100).toFixed(0)}% · ×{BALL_MULTIPLIER[b]}</div>
                    </Btn>
                  );
                })}
              </div>
              <Btn className="btn btn-primary mt-3 w-full" onClick={doThrow} disabled={state === 'throwing' || (inventory?.balls[ball] ?? 0) <= 0}>
                ¡Lanzar!
              </Btn>
            </>
          )}

          {confirmRelease ? (
            <div className="panel mt-3 p-3 text-sm">
              ¿Dejar ir a {species.name.es}? No podrás recuperarlo.
              <div className="mt-2 flex gap-2">
                <Btn className="btn btn-danger flex-1" onClick={() => void doRelease()}>
                  Sí, dejarlo ir
                </Btn>
                <Btn className="btn flex-1" onClick={() => setConfirmRelease(false)}>
                  Cancelar
                </Btn>
              </div>
            </div>
          ) : (
            <Btn className="btn mt-3 w-full" onClick={() => setConfirmRelease(true)} disabled={state === 'throwing'}>
              Dejar ir
            </Btn>
          )}
        </>
      )}
      {(state === 'fled' || state === 'caught') && (
        <Btn className="btn mt-3 w-full" onClick={onClose}>
          {state === 'caught' ? 'Ver mi equipo' : 'Cerrar'}
        </Btn>
      )}
    </Modal>
  );
}
