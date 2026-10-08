import { Btn } from './motion';
import { useState } from 'react';
import { Modal, RarityBadge, Sprite, TypeBadge } from './ui';
import { dataset } from '../../data/dataset';
import { throwBall } from '../../data/actions';
import { captureChance, BALL_MULTIPLIER } from '../../core/capture';
import type { BallId } from '../../core/types';
import type { Encounter } from '../../core/types';
import { db } from '../../data/db';
import { useLiveQuery } from 'dexie-react-hooks';

const BALLS: BallId[] = ['poke', 'great', 'ultra', 'master'];

export function EncounterModal({ encounter, onClose }: { encounter: Encounter; onClose: () => void }) {
  const [state, setState] = useState<'throwing' | 'caught' | 'fled' | 'idle'>('idle');
  const [message, setMessage] = useState('');
  const [shakes, setShakes] = useState(0);
  const [ball, setBall] = useState<BallId>('poke');
  const inventory = useLiveQuery(() => db.inventory.get('me'), []);
  const species = dataset.byId.get(encounter.speciesId);
  if (!species) return null;

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
      } else if (encounter.throwsLeft - 1 <= 0) {
        setState('fled');
        setMessage('El Pokémon huyó…');
      } else {
        setState('idle');
        setShakes(0);
        setMessage('');
      }
    }, 900);
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
        <p className="text-sm text-[var(--muted)]">Nivel {encounter.level} · Lanzamientos: {encounter.throwsLeft}</p>

        <div className="flex justify-center gap-1 text-xl" aria-live="polite">
          {state === 'throwing' && <span>{'●'.repeat(Math.max(1, shakes))}</span>}
          {state === 'caught' && <span style={{ color: 'var(--success)' }}>✓</span>}
        </div>
        {message && <p className="text-sm font-bold">{message}</p>}
      </div>

      {state !== 'caught' && state !== 'fled' && (
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
          <Btn className="btn btn-primary mt-3 w-full" onClick={doThrow} disabled={state === 'throwing'}>
            ¡Lanzar!
          </Btn>
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
