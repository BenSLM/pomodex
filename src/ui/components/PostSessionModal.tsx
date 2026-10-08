import { Btn } from './motion';
import { Modal, RarityBadge, TypeBadge, Sprite } from './ui';
import type { UiRewardSummary } from '../../app/stores/timerStore';
import { dataset } from '../../data/dataset';

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
            {summary.ballEarned && <Row label="Ball recibida" value={summary.ballEarned.toUpperCase()} />}
            <Row label="Racha" value={`${summary.streakDays} días${summary.shieldUsed ? ' (escudo usado)' : ''}`} />
            {summary.eggObtained && <Row label="Huevo obtenido" value="🥚 ¡Apareció un huevo!" />}
            {summary.eggsHatched.length > 0 && <Row label="Huevos" value={`${summary.eggsHatched.length} eclosionaron`} />}
          </>
        )}
        {!summary.valid && <Row label="Motivo" value="Sesión demasiado corta o incompleta: sin recompensas" />}
        {summary.levelUps.length > 0 && (
          <Row label="Subidas de nivel" value={`${summary.levelUps.length} Pokémon subieron de nivel`} />
        )}
      </ul>
      <Btn className="btn btn-primary mt-4 w-full" onClick={onClose}>
        Continuar
      </Btn>
    </Modal>
  );
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
