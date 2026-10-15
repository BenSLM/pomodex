import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Btn } from './motion';
import { Sprite } from './ui';
import { dataset } from '../../data/dataset';
import { playCry } from '../../app/services/audio';
import type { OwnedCreature } from '../../core/types';

/**
 * §7.5 — momento de evolución a pantalla completa: sprite actual → destello → sprite nuevo.
 * Con `prefers-reduced-motion` cae a un crossfade simple. Confirma/cancela explícitos.
 */
export function EvolutionModal({
  creature,
  toSpeciesId,
  onConfirm,
  onCancel,
}: {
  creature: OwnedCreature;
  toSpeciesId: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const from = dataset.byId.get(creature.speciesId);
  const to = dataset.byId.get(toSpeciesId);
  const reduce = useReducedMotion() ?? false;
  const [revealed, setRevealed] = useState(reduce);

  useEffect(() => {
    if (reduce) {
      setRevealed(true);
      void playCry(toSpeciesId);
      return;
    }
    const t = setTimeout(() => {
      setRevealed(true);
      void playCry(toSpeciesId);
    }, 900);
    return () => clearTimeout(t);
  }, [reduce, toSpeciesId]);

  if (!from || !to) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/75 p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Evolución a ${to.name.es}`}
    >
      <motion.div
        className="mb-4 text-center text-white"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduce ? 0 : 0.3 }}
      >
        <div className="text-sm opacity-80">{creature.nickname ?? from.name.es}</div>
        <div className="text-3xl font-bold">¡{to.name.es}!</div>
      </motion.div>

      <div className="relative flex h-52 w-52 items-center justify-center">
        <motion.div
          key={revealed ? 'to' : 'from'}
          initial={reduce ? { opacity: 1 } : { opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: reduce ? 0 : 0.45 }}
        >
          <Sprite species={revealed ? to : from} shiny={creature.shiny} size={170} />
        </motion.div>
        {!revealed && !reduce && (
          <motion.div
            className="pointer-events-none absolute inset-0 rounded-full bg-white"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.9, 0] }}
            transition={{ duration: 0.9 }}
          />
        )}
      </div>

      <div className="mt-6 flex gap-3">
        <Btn className="btn btn-primary" onClick={onConfirm}>
          Confirmar
        </Btn>
        <Btn className="btn" onClick={onCancel}>
          Cancelar
        </Btn>
      </div>
    </div>
  );
}
