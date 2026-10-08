import { Btn, Select } from '../components/motion';
import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db';
import { useTimerStore } from '../../app/stores/timerStore';
import { elapsedMs, overtimeMs } from '../../core/timer/machine';
import { dayKey } from '../../core/streak';
import { levelFromXp, xpForLevel } from '../../core/xp';
import { dataset } from '../../data/dataset';
import { ProgressBar, Sprite } from '../components/ui';
import { PostSessionModal } from '../components/PostSessionModal';
import { EncounterModal } from '../components/EncounterModal';
import type { Encounter, SessionMode } from '../../core/types';

function fmt(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function FocusPage() {
  const { active, summary, breakEndsAt, cycleCount, start, pause, resume, finish, abandon, dismissSummary, markDistraction } =
    useTimerStore();
  const [now, setNow] = useState(Date.now());
  const [categoryId, setCategoryId] = useState(() => localStorage.getItem('pomodex.category') ?? 'study');
  const [mode, setMode] = useState<SessionMode>('pomodoro');
  const [encounter, setEncounter] = useState<Encounter | null>(null);
  const [confirmAbandon, setConfirmAbandon] = useState(false);

  const profile = useLiveQuery(() => db.profile.get('me'), []);
  const creature = useLiveQuery(() => (profile?.companionId ? db.creatures.get(profile.companionId) : undefined), [profile?.companionId]);
  const categories = useLiveQuery(() => db.categories.toArray(), []);
  const settings = useLiveQuery(() => db.settings.get('me'), []);
  const pendingEncounters = useLiveQuery(() => db.encounters.toArray(), []);
  const pendingEvolutions = useLiveQuery(() => db.meta.get('pendingEvolutions'), []);
  const streak = useLiveQuery(() => db.meta.get('streak'), []);
  const sessionsToday = useLiveQuery(async () => {
    const key = dayKey(Date.now(), settings?.dayRolloverHour ?? 4);
    const all = await db.sessions.toArray();
    return all.filter((s) => dayKey(s.startedAt, settings?.dayRolloverHour ?? 4) === key);
  }, [settings?.dayRolloverHour]);

  // Repintado: la verdad del tiempo vive en los timestamps (§6.2)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  // Page Visibility: >10 s oculto cuenta como distracción (§11.4)
  useEffect(() => {
    let hiddenAt: number | null = null;
    const onHidden = () => {
      hiddenAt = Date.now();
    };
    const onVisible = () => {
      if (hiddenAt && Date.now() - hiddenAt > 10_000) void markDistraction();
      hiddenAt = null;
    };
    document.addEventListener('visibilitychange', onHidden);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onHidden);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [markDistraction]);

  const elapsed = active ? elapsedMs(active, now) : 0;
  const overtime = active ? overtimeMs(active, now) : 0;
  const remaining = active ? active.plannedMs - elapsed : (settings?.timer.focusMin ?? 25) * 60_000;
  const progress = active ? Math.min(1, elapsed / active.plannedMs) : 0;

  useEffect(() => {
    if (active && active.state === 'focusing') {
      const species = creature ? dataset.byId.get(creature.speciesId) : null;
      document.title = `${fmt(active.mode === 'flow' ? elapsed : Math.max(0, remaining))} · ${species?.name.es ?? 'Focus'}`;
    } else {
      document.title = 'Focus Trainer';
    }
  }, [active, elapsed, remaining, creature]);

  const todayFocus = useMemo(() => sessionsToday?.reduce((a, s) => a + s.focusedMs, 0) ?? 0, [sessionsToday]);
  const todayXp = useMemo(() => sessionsToday?.reduce((a, s) => a + (s.xp ?? 0), 0) ?? 0, [sessionsToday]);

  const levelInfo = (() => {
    if (!creature) return null;
    const species = dataset.byId.get(creature.speciesId);
    if (!species) return null;
    const level = levelFromXp(species.growthRate, creature.xp, settings?.rewards.xpScale ?? 0.05);
    const base = xpForLevel(species.growthRate, level, settings?.rewards.xpScale ?? 0.05);
    const next = xpForLevel(species.growthRate, level + 1, settings?.rewards.xpScale ?? 0.05);
    return { species, level, value: creature.xp - base, max: Math.max(1, next - base) };
  })();

  const onCategoryChange = (id: string) => {
    setCategoryId(id);
    localStorage.setItem('pomodex.category', id);
  };

  return (
    <div className="grid gap-4 sm:grid-cols-[2fr,1fr]">
      <section className="panel flex flex-col items-center gap-4 p-5">
        {levelInfo ? (
          <>
            <Sprite species={levelInfo.species} shiny={creature?.shiny} size={140} />
            <div className="text-center">
              <div className="font-bold">
                {creature?.nickname ?? levelInfo.species.name.es}
                {creature?.shiny && ' ✦'} · Nv. {levelInfo.level}
              </div>
              <div className="mt-1 w-56">
                <ProgressBar value={levelInfo.value} max={levelInfo.max} color="var(--accent)" />
              </div>
              <div className="tabular mt-1 text-xs text-[var(--muted)]">
                {levelInfo.value}/{levelInfo.max} XP
              </div>
            </div>
          </>
        ) : (
          <div className="py-8 text-center text-sm text-[var(--muted)]">
            Captura un Pokémon para tener compañero.
          </div>
        )}

        <div
          className="tabular text-6xl font-bold"
          role="timer"
          aria-live="off"
          style={{ color: active && overtime > 0 ? 'var(--accent-dark)' : 'var(--text)' }}
        >
          {active ? (active.mode === 'flow' && overtime > 0 ? `+${fmt(overtime)}` : fmt(remaining)) : fmt(remaining)}
        </div>
        <div className="w-full">
          <ProgressBar value={active ? elapsed : 0} max={active?.plannedMs ?? 1} height={10} />
          <div className="mt-1 text-center text-xs text-[var(--muted)]">
            {active
              ? active.state === 'paused'
                ? 'En pausa'
                : `Sesión ${Math.min(4, (cycleCount % 4) + 1)}/4 · ${Math.round(progress * 100)}%`
              : 'Listo para empezar'}
          </div>
        </div>

        {!active ? (
          <div className="flex w-full flex-col gap-2">
            <div className="flex gap-2">
              <label className="flex-1 text-sm">
                Categoría
                <Select
                  className="btn mt-1 w-full"
                  value={categoryId}
                  onChange={(e) => onCategoryChange(e.target.value)}
                >
                  {(categories ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icon} {c.name}
                    </option>
                  ))}
                </Select>
              </label>
              {settings?.modes.flowTimer && (
                <label className="flex-1 text-sm">
                  Modo
                  <Select className="btn mt-1 w-full" value={mode} onChange={(e) => setMode(e.target.value as SessionMode)}>
                    <option value="pomodoro">Pomodoro</option>
                    <option value="flow">Flow</option>
                  </Select>
                </label>
              )}
            </div>
            <Btn className="btn btn-primary w-full text-lg" onClick={() => void start(categoryId, mode)}>
              ▶ Empezar
            </Btn>
          </div>
        ) : (
          <div className="flex w-full gap-2">
            {active.state === 'focusing' ? (
              <Btn className="btn flex-1" onClick={() => void pause()}>
                ⏸ Pausar
              </Btn>
            ) : (
              <Btn className="btn btn-primary flex-1" onClick={() => void resume()}>
                ▶ Reanudar
              </Btn>
            )}
            <Btn className="btn btn-accent flex-1" onClick={() => void finish()}>
              ■ Terminar
            </Btn>
            <Btn className="btn btn-danger" onClick={() => setConfirmAbandon(true)} aria-label="Abandonar">
              ✕
            </Btn>
          </div>
        )}

        {confirmAbandon && active && (
          <div className="panel w-full p-3 text-sm">
            ¿Abandonar la sesión? {settings?.rewards.abandonCreditRatio === 0 ? 'No ganarás recompensas.' : ''}
            <div className="mt-2 flex gap-2">
              <Btn className="btn btn-danger flex-1" onClick={() => { setConfirmAbandon(false); void abandon(); }}>
                Sí, abandonar
              </Btn>
              <Btn className="btn flex-1" onClick={() => setConfirmAbandon(false)}>
                Cancelar
              </Btn>
            </div>
          </div>
        )}
      </section>

      <aside className="flex flex-col gap-3">
        <div className="panel p-4 text-sm">
          <h2 className="mb-2 font-bold">HOY</h2>
          <Row label="XP" value={`+${todayXp}`} />
          <Row label="Sesiones" value={String(sessionsToday?.length ?? 0)} />
          <Row label="Enfoque" value={fmt(todayFocus).replace(':', ' h ')} />
          <Row label="Racha" value={`🔥 ${(streak?.value as { current: number } | undefined)?.current ?? 0} días`} />
        </div>

        {(pendingEncounters?.length ?? 0) > 0 && (
          <div className="panel border-2 p-4 text-sm" style={{ borderColor: 'var(--accent-dark)' }}>
            <h2 className="mb-2 font-bold">Encuentro pendiente</h2>
            {pendingEncounters!.map((e) => (
              <Btn key={e.id} className="btn btn-accent w-full" onClick={() => setEncounter(e)}>
                Ver Pokémon
              </Btn>
            ))}
          </div>
        )}

        {(pendingEvolutions?.value as { creatureId: string }[] | undefined)?.length ? (
          <div className="panel p-4 text-sm">
            <h2 className="mb-1 font-bold">Evoluciones disponibles</h2>
            <p className="text-[var(--muted)]">Revisa tu equipo para confirmar.</p>
          </div>
        ) : null}

        {breakEndsAt && (
          <div className="panel p-4 text-sm">
            <h2 className="mb-1 font-bold">¡Descanso!</h2>
            <div className="tabular text-2xl">{fmt(breakEndsAt - now)}</div>
            <Btn className="btn mt-2 w-full" onClick={() => useTimerStore.getState().skipBreak()}>
              Saltar descanso
            </Btn>
          </div>
        )}

        <div className="panel p-4 text-sm text-[var(--muted)]">
          Consejo: en modo <b>Flow</b> el tiempo extra suma bonus de rareza en tu próximo encuentro.
        </div>
      </aside>

      {summary && (
        <PostSessionModal
          summary={summary}
          onClose={() => {
            const enc = summary.encounter;
            dismissSummary();
            if (enc) setEncounter(enc);
          }}
        />
      )}
      {encounter && <EncounterModal encounter={encounter} onClose={() => setEncounter(null)} />}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-dashed py-1 last:border-0" style={{ borderColor: 'var(--border)' }}>
      <span className="text-[var(--muted)]">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}
