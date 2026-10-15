import type { CandySize, ItemId, OwnedCreature, RewardConfig } from './types';
import { levelFromXp, xpForLevel } from './xp';

export const CANDY_SIZES: CandySize[] = ['xs', 's', 'm', 'l', 'xl'];

export const CANDY_ITEM: Record<CandySize, ItemId> = {
  xs: 'candyXS',
  s: 'candyS',
  m: 'candyM',
  l: 'candyL',
  xl: 'candyXL',
};

export const CANDY_LABEL: Record<CandySize, string> = {
  xs: 'XS',
  s: 'S',
  m: 'M',
  l: 'L',
  xl: 'XL',
};

/** §7.1 — XP real de un caramelo = base (RewardConfig) × xpScale. Nunca se guarda el valor final. */
export function candyXp(size: CandySize, config: RewardConfig): number {
  return Math.round(config.candyXp[size] * config.xpScale);
}

export interface CandyResult {
  creature: OwnedCreature;
  /** XP realmente aplicada (puede recortarse por el tope del compañero). */
  xpGained: number;
  levelBefore: number;
  levelAfter: number;
  capped: boolean;
}

/** Tope de XP de un Pokémon: no puede superar el nivel del compañero (§7.7). */
export function candyXpCap(companionLevel: number, config: RewardConfig): number {
  return xpForLevel(companionLevel, config.xpScale);
}

/**
 * Aplica un caramelo: suma XP recortada al tope del compañero y recalcula el nivel.
 * Puro; la evolución derivada se recalcula con la misma función que el pipeline (§7.5).
 */
export function applyCandy(
  creature: OwnedCreature,
  size: CandySize,
  config: RewardConfig,
  companionLevel: number,
): CandyResult {
  const scale = config.xpScale;
  const cap = candyXpCap(companionLevel, config);
  const levelBefore = levelFromXp(creature.xp, scale);
  const raw = creature.xp + candyXp(size, config);
  const capped = raw > cap;
  const newXp = Math.min(raw, cap);
  const levelAfter = levelFromXp(newXp, scale);
  return {
    creature: { ...creature, xp: newXp, level: levelAfter },
    xpGained: Math.max(0, newXp - creature.xp),
    levelBefore,
    levelAfter,
    capped,
  };
}

/** previsualización: "+200 XP → Nv. 21 → Nv. 22" (§7.7). */
export function candyPreview(
  creature: OwnedCreature,
  size: CandySize,
  config: RewardConfig,
  companionLevel: number,
): { label: string; disabled: boolean; capped: boolean } {
  const cap = candyXpCap(companionLevel, config);
  const disabled = creature.xp >= cap;
  const { xpGained, levelBefore, levelAfter, capped } = applyCandy(creature, size, config, companionLevel);
  const label = disabled
    ? 'Ya está al nivel del compañero'
    : `+${xpGained} XP → Nv. ${levelBefore} → Nv. ${levelAfter}${capped ? ' (tope)' : ''}`;
  return { label, disabled, capped };
}
