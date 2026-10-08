import type { BallId, ItemId, RewardConfig } from './types';
import type { QualityLabel } from './quality';

/** §7.7 — monedas por sesión. */
export function sessionCoins(focusedMinutes: number, qualityMult: number, config: RewardConfig): number {
  return Math.round((focusedMinutes / 25) * config.coinsPer25min * qualityMult);
}

export interface ShopItem {
  id: BallId | ItemId;
  kind: 'ball' | 'item';
  price: number;
  name: { es: string; en: string };
}

export const SHOP_CATALOG: ShopItem[] = [
  { id: 'poke', kind: 'ball', price: 20, name: { es: 'Poké Ball', en: 'Poké Ball' } },
  { id: 'great', kind: 'ball', price: 50, name: { es: 'Great Ball', en: 'Great Ball' } },
  { id: 'ultra', kind: 'ball', price: 120, name: { es: 'Ultra Ball', en: 'Ultra Ball' } },
  { id: 'potion', kind: 'item', price: 40, name: { es: 'Poción', en: 'Potion' } },
  { id: 'revive', kind: 'item', price: 120, name: { es: 'Revivir', en: 'Revive' } },
  { id: 'streakShield', kind: 'item', price: 150, name: { es: 'Escudo de racha', en: 'Streak shield' } },
  { id: 'incense', kind: 'item', price: 200, name: { es: 'Incienso', en: 'Incense' } },
  { id: 'berry', kind: 'item', price: 15, name: { es: 'Baya', en: 'Berry' } },
  { id: 'fireStone', kind: 'item', price: 300, name: { es: 'Piedra Fuego', en: 'Fire Stone' } },
  { id: 'waterStone', kind: 'item', price: 300, name: { es: 'Piedra Agua', en: 'Water Stone' } },
  { id: 'thunderStone', kind: 'item', price: 300, name: { es: 'Piedra Trueno', en: 'Thunder Stone' } },
  { id: 'leafStone', kind: 'item', price: 300, name: { es: 'Piedra Hoja', en: 'Leaf Stone' } },
  { id: 'moonStone', kind: 'item', price: 300, name: { es: 'Piedra Luna', en: 'Moon Stone' } },
  { id: 'sunStone', kind: 'item', price: 300, name: { es: 'Piedra Sol', en: 'Sun Stone' } },
  { id: 'shinyStone', kind: 'item', price: 300, name: { es: 'Piedra Brillo', en: 'Shiny Stone' } },
  { id: 'duskStone', kind: 'item', price: 300, name: { es: 'Piedra Noche', en: 'Dusk Stone' } },
  { id: 'dawnStone', kind: 'item', price: 300, name: { es: 'Piedra Alba', en: 'Dawn Stone' } },
  { id: 'iceStone', kind: 'item', price: 300, name: { es: 'Piedra Hielo', en: 'Ice Stone' } },
  { id: 'linkCable', kind: 'item', price: 300, name: { es: 'Cable de enlace', en: 'Link Cable' } },
];

export const BALL_NAMES: Record<BallId, { es: string; en: string }> = {
  poke: { es: 'Poké Ball', en: 'Poké Ball' },
  great: { es: 'Great Ball', en: 'Great Ball' },
  ultra: { es: 'Ultra Ball', en: 'Ultra Ball' },
  master: { es: 'Master Ball', en: 'Master Ball' },
};

export function qualityBallLabel(q: QualityLabel): string {
  return q === 'perfect' ? 'ultra' : q === 'good' ? 'great' : 'poke';
}
