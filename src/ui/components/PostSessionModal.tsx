import { useLiveQuery } from 'dexie-react-hooks';
import { Btn } from './motion';
import { Modal, RarityBadge, TypeBadge, Sprite } from './ui';
import type { UiRewardSummary } from '../../app/stores/timerStore';
import { dataset } from '../../data/dataset';
import { db } from '../../data/db';
import { MAX_LEVEL } from '../../core/xp';
import { focusHistoryDays, formatFocusDuration, nextEvolutionEta, nextLevelEta } from '../../core/progress';

export function PostSessionModal({ summary, onClose }: { summary: UiRewardSummary; onClose: () => void }) {
  const qualityLabel = summary.quality === 'perfect' ? 'Perfecta' : summary.quality === 'good' ? 'Buena' : 'Floja';
  return (
    <Modal title={summary.valid ? '¡Sesión completada!' : 'Sesión finalizada'} onClose={onClose}>
      {summary.finishedAgoMs != null && summary.finishedAgoMs > 60_000 && (
        <p className="mb-3 text-sm text-[var(--muted)]">
          Tu sesión terminó hace {Math.round(summary.finishedAgoMs / 60_000)} min.
        </p>
      )}
      <ul className="space-y-1 text-sm">
        <Row label="Calidad" value={`${qualityLabel} (${Math.round(100)}%)`} />
        {summary.valid && (
          <>
            <Row label="Tiempo de foco" value={`${summary.focusMinutes} min`} />
            <Row label="XP compañero" value={`+${summary.xpCompanion}`} />
            {summary.xpTeam > 0 && <Row label="XP equipo" value={`+${summary.xpTeam}`} />}
            <Row label="Monedas" value={`+${summary.coins} 💵`} />
            {summary.ballsEarned.length > 0 && <Row label="Balls recibidas" value={formatBalls(summary.ballsEarned)} />}
            {summary.lureUsed && <Row label="Señuelo" value="usado (+1 encuentro)" />}
            <Row label="Racha" value={`${summary.streakDays} días${summary.shieldUsed ? ' (escudo usado)' : ''}`} />
            {summary.eggsObtained.length > 0 && <Row label="Huevos obtenidos" value={`🥚 ×${summary.eggsObtained.length}`} />}
            {summary.eggsHatched.length > 0 && <Row label="Huevos" value={`${summary.eggsHatched.length} eclosionaron`} />}
            {summary.encounters.length > 0 && (
              <Row label="Pokémon salvajes" value={`${summary.encounters.length} te esperan`} />
            )}
          </>
        )}
        {!summary.valid && <Row label="Motivo" value="Sesión demasiado corta o incompleta: sin recompensas" />}
        {summary.levelUps.length > 0 && (
          <Row label="Subidas de nivel" value={`${summary.levelUps.length} Pokémon subieron de nivel`} />
        )}
        <CompanionEtaRow />
      </ul>
      <Btn className="btn btn-primary mt-4 w-full" onClick={onClose}>
        Continuar
      </Btn>
    </Modal>
  );
}

/** §9.8 — estimación del compañero tras la sesión (calidad Buena, racha actual). */
function CompanionEtaRow() {
  const profile = useLiveQuery(() => db.profile.get('me'), []);
  const creature = useLiveQuery(
    () => (profile?.companionId ? db.creatures.get(profile.companionId) : undefined),
    [profile?.companionId],
  );
  const settings = useLiveQuery(() => db.settings.get('me'), []);
  const streak = useLiveQuery(() => db.meta.get('streak'), []);
  const sessions = useLiveQuery(() => db.sessions.toArray(), []);
  if (!creature || !settings) return null;
  const streakDays = (streak?.value as { current: number } | undefined)?.current ?? 0;
  const hasHistory = focusHistoryDays(sessions ?? [], settings.dayRolloverHour) >= 3;
  const evo = nextEvolutionEta(creature, settings.rewards, dataset, streakDays);
  let text: string | null = null;
  if (evo) {
    if (evo.minutes != null) {
      const target = dataset.byId.get(evo.toSpeciesId);
      text = `Evoluciona a ${target?.name.es ?? 'su forma final'} en ${formatFocusDuration(evo.minutes, hasHistory)} de foco`;
    } else {
      text = `Evoluciona con ${evo.requirement}`;
    }
  } else {
    const lvl = nextLevelEta(creature, settings.rewards, streakDays);
    if (lvl.level < MAX_LEVEL) text = `Siguiente nivel en ${formatFocusDuration(lvl.minutes, hasHistory)} de foco`;
  }
  if (!text) return null;
  return <Row label="Compañero" value={text} />;
}

function formatBalls(balls: string[]): string {
  const counts = new Map<string, number>();
  for (const b of balls) counts.set(b, (counts.get(b) ?? 0) + 1);
  return [...counts.entries()].map(([b, n]) => `${b.toUpperCase()} Ball${n > 1 ? ` ×${n}` : ''}`).join(' · ');
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex justify-between gap-3 border-b border-dashed pb-1 last:border-0" style={{ borderColor: 'var(--border)' }}>
      <span className="text-[var(--muted)]">{label}</span>
      <span className="font-bold">{value}</span>
    </li>
  );
}

export { Modal, RarityBadge, TypeBadge, Sprite };
export function speciesOf(id: number) {
  return dataset.byId.get(id);
}
