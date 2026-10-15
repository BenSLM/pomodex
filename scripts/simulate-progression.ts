/**
 * Simulador de progresión (§7.1). Reutiliza el motor de `src/core` (nada duplicado)
 * para estimar el ritmo con una sola curva de XP (n³ × xpScale).
 *
 * Uso: npm run simulate -- [opciones]
 *   --session-min=60        minutos de foco por sesión (por defecto 60)
 *   --sessions-per-day=2    sesiones válidas por día (por defecto 2)
 *   --days=365              horizonte en días (por defecto 365)
 *   --quality-mix=20,60,20  % Perfecta,Buena,Floja (por defecto 20,60,20)
 *   --streak                aplicar el multiplicador de racha por días consecutivos
 *
 * Nota: la Fase 3 (gimnasios) aún no existe; para Kanto se asume 1 min de foco = 1 de daño.
 */
import { DEFAULT_REWARD_CONFIG } from '../src/core/rewards/config';
import { levelFromXp, sessionXp, xpForLevel } from '../src/core/xp';
import { effectiveQualityMult, PROGRESSION_MILESTONES } from '../src/core/progression';
import { captureChance } from '../src/core/capture';
import { SHOP_CATALOG, sessionCoins } from '../src/core/economy';
import { encountersForSession } from '../src/core/encounter';
import { ballForQuality } from '../src/core/quality';

const STARTER_LEVEL = 5;
const KANTO_DAMAGE_MINUTES =
  8 * 120 + 40 * ((8 * 7) / 2) + // gimnasios: Σ(120 + 40·(i−1)), i=1..8
  420 + 440 + 460 + 480 + // Alto Mando
  600; // Campeón

function arg(name: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
}
function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

const sessionMin = Number(arg('session-min') ?? 60);
const sessionsPerDay = Number(arg('sessions-per-day') ?? 2);
const days = Number(arg('days') ?? 365);
const qualityMix = (arg('quality-mix') ?? '20,60,20').split(',').map(Number);
const useStreak = flag('streak');

const config = DEFAULT_REWARD_CONFIG;
const xpScale = config.xpScale;

/** Reparto determinista de calidades: ciclo de 100 sesiones según el mix. */
function qualityCycle(): number[] {
  const [perfect = 0, good = 60, poor = 40] = qualityMix;
  const counts = { perfect, good, poor };
  const total = counts.perfect + counts.good + counts.poor || 100;
  const norm = {
    perfect: Math.round((counts.perfect / total) * 100),
    good: Math.round((counts.good / total) * 100),
    poor: Math.max(0, 100 - Math.round((counts.perfect / total) * 100) - Math.round((counts.good / total) * 100)),
  };
  const cycle = [
    ...Array(norm.perfect).fill(config.qualityMult.perfect),
    ...Array(norm.good).fill(config.qualityMult.good),
    ...Array(norm.poor).fill(config.qualityMult.poor),
  ];
  return cycle.length > 0 ? cycle : [config.qualityMult.good];
}

interface Milestone {
  level: number;
  sessions: number;
  hours: number;
  days: number;
  teamLevel: number;
}

function simulate() {
  const cycle = qualityCycle();
  const maxSessions = Math.max(days * sessionsPerDay, 1);
  const milestones = new Map<number, Milestone>();
  const reachedTeamLevelAt = new Map<number, number>();

  let companionXp = xpForLevel(STARTER_LEVEL, xpScale);
  let teamXp = xpForLevel(STARTER_LEVEL, xpScale);
  let focusedMinutes = 0;
  let kanto: { hours: number; sessions: number; days: number; level: number } | null = null;

  for (let i = 0; i < maxSessions; i++) {
    const day = Math.floor(i / sessionsPerDay) + 1;
    const streakDays = useStreak ? Math.min(day, 25) : 0;
    const xp = sessionXp({
      focusedMinutes: sessionMin,
      xpPerMinute: config.xpPerMinute,
      qualityMult: cycle[i % cycle.length],
      streakDays,
    });
    companionXp += xp;
    teamXp += Math.round(xp * config.teamXpShare);
    focusedMinutes += sessionMin;

    const level = levelFromXp(companionXp, xpScale);
    const teamLevel = levelFromXp(teamXp, xpScale);
    for (const m of PROGRESSION_MILESTONES) {
      if (!milestones.has(m) && level >= m) {
        reachedTeamLevelAt.set(m, teamLevel);
        milestones.set(m, {
          level: m,
          sessions: i + 1,
          hours: focusedMinutes / 60,
          days: day,
          teamLevel,
        });
      }
    }
    if (!kanto && focusedMinutes >= KANTO_DAMAGE_MINUTES) {
      kanto = { hours: focusedMinutes / 60, sessions: i + 1, days: day, level };
    }
    if (milestones.size === PROGRESSION_MILESTONES.length && kanto) break;
  }

  return { milestones, kanto, cycle };
}

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

function printTable(milestones: Map<number, Milestone>) {
  const rows = [['Nivel', 'Horas de foco', 'Sesiones', 'Días', 'Nivel del equipo']];
  for (const m of PROGRESSION_MILESTONES) {
    const hit = milestones.get(m);
    rows.push(
      hit
        ? [
            `${m}`,
            hit.hours.toFixed(1),
            `${hit.sessions}`,
            `${hit.days}`,
            `${hit.teamLevel}`,
          ]
        : [`${m}`, '—', '—', '—', '—'],
    );
  }
  const widths = rows[0].map((_, c) => Math.max(...rows.map((r) => r[c].length)) + 2);
  for (const r of rows) console.log(r.map((cell, c) => pad(cell, widths[c])).join(''));
}

const BALL_PRICE: Record<string, number> = Object.fromEntries(
  SHOP_CATALOG.filter((s) => s.kind === 'ball').map((s) => [s.id, s.price]),
);

const RARITY_SAMPLES: { label: string; captureRate: number }[] = [
  { label: 'Común', captureRate: 255 },
  { label: 'Poco común', captureRate: 160 },
  { label: 'Rara', captureRate: 75 },
  { label: 'Épica', captureRate: 45 },
  { label: 'Legendaria', captureRate: 3 },
];

/** §7.4 — balls esperadas por captura (geométrica 1/p) y su coste en 💵. */
function expectedBalls(captureRate: number, ball: 'poke' | 'great' | 'ultra'): number {
  return 1 / captureChance(captureRate, ball);
}

function printBallEconomy() {
  console.log('\nEconomía de balls (§7.4) — balls esperadas por captura (1/p) y coste en 💵');
  const rows = [['Rareza', 'Poké', 'coste', 'Great', 'coste', 'Ultra', 'coste']];
  for (const s of RARITY_SAMPLES) {
    rows.push([
      s.label,
      expectedBalls(s.captureRate, 'poke').toFixed(1),
      `${Math.round(expectedBalls(s.captureRate, 'poke') * BALL_PRICE.poke)}`,
      expectedBalls(s.captureRate, 'great').toFixed(1),
      `${Math.round(expectedBalls(s.captureRate, 'great') * BALL_PRICE.great)}`,
      expectedBalls(s.captureRate, 'ultra').toFixed(1),
      `${Math.round(expectedBalls(s.captureRate, 'ultra') * BALL_PRICE.ultra)}`,
    ]);
  }
  const widths = rows[0].map((_, c) => Math.max(...rows.map((r) => r[c].length)) + 2);
  for (const r of rows) console.log(r.map((cell, c) => pad(cell, widths[c])).join(''));

  const legendary = 3;
  const coinsPerSession = sessionCoins(sessionMin, config.qualityMult.good, config);
  const freePerSession = encountersForSession(sessionMin, config);
  const freeBall = ballForQuality(70); // calidad Buena → ball gratis
  const pokeBalls = expectedBalls(legendary, 'poke');
  const pokeCost = Math.round(pokeBalls * BALL_PRICE.poke);
  const coinsSessions = coinsPerSession > 0 ? Math.ceil(pokeCost / coinsPerSession) : Infinity;
  const greatFree = expectedBalls(legendary, 'great');
  const freeSessions = freePerSession > 0 ? Math.ceil(greatFree / freePerSession) : Infinity;
  console.log(
    `\nLegendaria (captureRate ${legendary}): Poké ≈ ${pokeBalls.toFixed(1)} balls (≈ ${pokeCost} 💵) → ` +
      `${coinsSessions} sesiones de ${sessionMin} min (${coinsPerSession} 💵/sesión).`,
  );
  console.log(
    `Con balls gratis (${freePerSession}/sesión, ${freeBall.toUpperCase()} por calidad Buena): ` +
      `≈ ${greatFree.toFixed(1)} balls → ${freeSessions} sesiones.`,
  );
  if (pokeBalls > 15) {
    console.warn(
      `\n⚠️  Una legendaria cuesta ≈ ${pokeBalls.toFixed(1)} balls con Poké Ball (> 15): revisa el balance antes de tocar la fórmula.`,
    );
  }
}

const { milestones, kanto, cycle } = simulate();
console.log('\nSimulación de progresión (§7.1)');
console.log(
  `Perfil: ${sessionMin} min × ${sessionsPerDay} sesión(es)/día · días=${days} · ` +
    `calidades=${qualityMix.join('/')} · racha=${useStreak ? 'sí' : 'no'} · ` +
    `xpScale=${xpScale} · xp/min=${config.xpPerMinute}`,
);
console.log(`Multiplicador medio de calidad: ${effectiveQualityMult({ perfect: qualityMix[0] ?? 0, good: qualityMix[1] ?? 0, poor: qualityMix[2] ?? 0 }).toFixed(3)} (ciclo de ${cycle.length})`);
console.log(`Nivel inicial: ${STARTER_LEVEL}\n`);
printTable(milestones);
if (kanto) {
  console.log(
    `\nKanto (${KANTO_DAMAGE_MINUTES} min de daño): ${kanto.hours.toFixed(1)} h de foco · ` +
      `${kanto.sessions} sesiones · ${kanto.days} días · compañero Nv. ${kanto.level}`,
  );
} else {
  console.log('\nKanto: no alcanzado dentro del horizonte.');
}

printBallEconomy();
