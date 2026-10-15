import { db } from '../../data/db';
import { dataset } from '../../data/dataset';

/**
 * §11.3 — reproduce el grito de una especie (carga lazy, una sola vez por llamada).
 * Respeta el ajuste de sonido (`notifications.sound`, por defecto true) y falla en
 * silencio si el navegador bloquea el audio o no hay red.
 */
export async function playCry(speciesId: number): Promise<void> {
  try {
    const settings = await db.settings.get('me');
    if (settings && settings.notifications.sound === false) return;
    const url = dataset.byId.get(speciesId)?.cry;
    if (!url) return;
    if (typeof Audio === 'undefined') return;
    const audio = new Audio(url);
    audio.volume = 0.6;
    await audio.play();
  } catch {
    // autoplay bloqueado o recurso no disponible: sin sonido
  }
}

/** true si el sonido está activado (por defecto sí). */
export async function isSoundEnabled(): Promise<boolean> {
  const settings = await db.settings.get('me');
  return settings?.notifications.sound !== false;
}
