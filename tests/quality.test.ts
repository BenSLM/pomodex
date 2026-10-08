import { describe, expect, it } from 'vitest';
import { captureChance, shakesFor } from '../src/core/capture';
import { computeQuality, isValidSession, qualityLabel } from '../src/core/quality';
import { DEFAULT_REWARD_CONFIG } from '../src/core/rewards/config';

describe('captura (§7.4)', () => {
  it('ejemplos del SPECS con Poké Ball', () => {
    expect(captureChance(255, 'poke')).toBeCloseTo(0.9, 5); // común 90 %
    expect(captureChance(75, 'poke')).toBeCloseTo(0.335, 3); // rara ~34 %
    expect(captureChance(3, 'poke')).toBeCloseTo(0.1094, 3); // legendaria ~11 %
  });
  it('Ultra Ball sube los valores y el tope es 0.98', () => {
    expect(captureChance(255, 'ultra')).toBe(0.98);
    expect(captureChance(75, 'ultra')).toBeCloseTo(0.67, 2);
    expect(captureChance(3, 'ultra')).toBeCloseTo(0.219, 3);
  });
  it('Master Ball captura siempre', () => {
    expect(captureChance(1, 'master')).toBe(0.98);
  });
  it('shakesFor da más sacudidas cuanto mayor es p', () => {
    expect(shakesFor(0.9)).toBe(3);
    expect(shakesFor(0.5)).toBe(2);
    expect(shakesFor(0.2)).toBe(1);
  });
});

describe('calidad y validez de sesión (§6.4-§6.5)', () => {
  it('penaliza pausas (−10, máx −30) y distracciones (−5, máx −30)', () => {
    expect(computeQuality({ pauseCount: 1, distractionCount: 0, strictFocus: false })).toBe(90);
    expect(computeQuality({ pauseCount: 5, distractionCount: 0, strictFocus: false })).toBe(70);
    expect(computeQuality({ pauseCount: 0, distractionCount: 6, strictFocus: false })).toBe(70);
    expect(computeQuality({ pauseCount: 0, distractionCount: 0, strictFocus: false })).toBe(100);
    expect(computeQuality({ pauseCount: 0, distractionCount: 0, strictFocus: false })).toBe(100);
  });
  it('strictFocus duplica el castigo de distracciones', () => {
    expect(computeQuality({ pauseCount: 0, distractionCount: 3, strictFocus: true })).toBe(70);
  });
  it('etiquetas: ≥90 Perfecta, 60-89 Buena, <60 Floja', () => {
    expect(qualityLabel(95)).toBe('perfect');
    expect(qualityLabel(90)).toBe('perfect');
    expect(qualityLabel(89)).toBe('good');
    expect(qualityLabel(60)).toBe('good');
    expect(qualityLabel(59)).toBe('poor');
  });
  it('sesión válida: ≥90 % de lo planeado y ≥10 min', () => {
    const cfg = DEFAULT_REWARD_CONFIG;
    const planned = 25 * 60_000;
    expect(isValidSession(planned * 0.95, planned, 'pomodoro', cfg)).toBe(true);
    expect(isValidSession(planned * 0.89, planned, 'pomodoro', cfg)).toBe(false);
    expect(isValidSession(5 * 60_000, 10 * 60_000, 'pomodoro', cfg)).toBe(false);
  });
});
