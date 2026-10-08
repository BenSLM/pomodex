import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { Btn } from './motion';
import type { Rarity, TypeId } from '../../core/types';

export function ProgressBar({ value, max, color, height = 12 }: { value: number; max: number; color?: string; height?: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div
      className="w-full overflow-hidden rounded-full border"
      style={{ height, background: 'var(--bg)', borderColor: 'var(--border)' }}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${pct}%`, background: color ?? 'var(--primary)' }}
      />
    </div>
  );
}

export function TypeBadge({ type }: { type: TypeId }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold text-white"
      style={{ background: `var(--type-${type})` }}
    >
      {type}
    </span>
  );
}

const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Común',
  uncommon: 'Poco común',
  rare: 'Rara',
  epic: 'Épica',
  legendary: 'Legendaria',
  mythical: 'Mítica',
};
const RARITY_COLOR: Record<Rarity, string> = {
  common: '#9ca3af',
  uncommon: '#4caf50',
  rare: '#3b82c4',
  epic: '#a040a0',
  legendary: '#f2c300',
  mythical: '#e85d9b',
};

export function RarityBadge({ rarity }: { rarity: Rarity }) {
  return (
    <span className="rounded px-2 py-0.5 text-xs font-bold text-white" style={{ background: RARITY_COLOR[rarity] }}>
      {RARITY_LABEL[rarity]}
    </span>
  );
}

export function Modal({
  title,
  children,
  onClose,
  wide,
}: {
  title: string;
  children: ReactNode;
  onClose?: () => void;
  wide?: boolean;
}) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
    >
      <motion.div
        className={`panel max-h-[90vh] w-full ${wide ? 'max-w-2xl' : 'max-w-md'} overflow-y-auto p-5`}
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 340, damping: 26 }}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          {onClose && (
            <Btn className="btn !min-h-0 !px-2 !py-1" onClick={onClose} aria-label="Cerrar">
              ✕
            </Btn>
          )}
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

export function Sprite({
  species,
  shiny,
  size = 96,
  animated = true,
}: {
  species: { sprites: { front: string | null; frontShiny: string | null; animated: string | null; animatedShiny: string | null }; name: { es: string } };
  shiny?: boolean;
  size?: number;
  animated?: boolean;
}) {
  const src = (animated
    ? shiny
      ? species.sprites.animatedShiny ?? species.sprites.frontShiny
      : species.sprites.animated ?? species.sprites.front
    : shiny
      ? species.sprites.frontShiny
      : species.sprites.front) as string | null;
  if (!src) return <div style={{ width: size, height: size }} aria-hidden />;
  return <img src={src} alt={species.name.es} className="sprite" width={size} height={size} loading="lazy" />;
}

export function StatRow({ label, value, max = 255 }: { label: string; value: number; max?: number }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-20 text-[var(--muted)]">{label}</span>
      <ProgressBar value={value} max={max} height={8} color="var(--secondary)" />
      <span className="tabular w-10 text-right">{value}</span>
    </div>
  );
}
