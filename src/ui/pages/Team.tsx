import { Btn } from '../components/motion';
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db';
import { dataset } from '../../data/dataset';
import { Modal, ProgressBar, Sprite, TypeBadge } from '../components/ui';
import { levelFromXp, xpForLevel } from '../../core/xp';
import {
  addToTeam,
  confirmEvolution,
  dismissEvolution,
  evolveWithItem,
  feedBerry,
  releaseCreature,
  removeFromTeam,
  setCompanion,
} from '../../data/actions';
import type { ItemId, OwnedCreature, PendingEvolution } from '../../core/types';

const STONES: { id: ItemId; label: string }[] = [
  { id: 'fireStone', label: 'Piedra Fuego' },
  { id: 'waterStone', label: 'Piedra Agua' },
  { id: 'thunderStone', label: 'Piedra Trueno' },
  { id: 'leafStone', label: 'Piedra Hoja' },
  { id: 'moonStone', label: 'Piedra Luna' },
  { id: 'sunStone', label: 'Piedra Sol' },
  { id: 'shinyStone', label: 'Piedra Brillo' },
  { id: 'duskStone', label: 'Piedra Noche' },
  { id: 'dawnStone', label: 'Piedra Alba' },
  { id: 'iceStone', label: 'Piedra Hielo' },
  { id: 'linkCable', label: 'Cable de enlace' },
];

export function TeamPage() {
  const profile = useLiveQuery(() => db.profile.get('me'), []);
  const creatures = useLiveQuery(() => db.creatures.toArray(), []);
  const eggs = useLiveQuery(() => db.eggs.toArray(), []);
  const inventory = useLiveQuery(() => db.inventory.get('me'), []);
  const settings = useLiveQuery(() => db.settings.get('me'), []);
  const pendingMeta = useLiveQuery(() => db.meta.get('pendingEvolutions'), []);
  const pending = (pendingMeta?.value as PendingEvolution[] | undefined) ?? [];
  const [detail, setDetail] = useState<OwnedCreature | null>(null);

  const team = (profile?.teamIds ?? []).map((id) => (creatures ?? []).find((c) => c.id === id)).filter(Boolean) as OwnedCreature[];
  const ownedList = (creatures ?? []).filter((c) => !(profile?.teamIds ?? []).includes(c.id));

  const xpInfo = (c: OwnedCreature) => {
    const species = dataset.byId.get(c.speciesId);
    if (!species) return { level: c.level, value: 0, max: 1 };
    const scale = settings?.rewards.xpScale ?? 0.05;
    const level = levelFromXp(species.growthRate, c.xp, scale);
    const base = xpForLevel(species.growthRate, level, scale);
    const next = xpForLevel(species.growthRate, level + 1, scale);
    return { level, value: c.xp - base, max: Math.max(1, next - base) };
  };

  return (
    <div className="space-y-4">
      <div className="panel p-4">
        <h1 className="mb-3 text-lg font-bold">Equipo</h1>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => {
            const c = team[i];
            if (!c) return <div key={i} className="panel flex min-h-[140px] items-center justify-center text-xs text-[var(--muted)]">Vacío</div>;
            const info = xpInfo(c);
            const species = dataset.byId.get(c.speciesId);
            return (
              <Btn key={c.id} className="panel p-3 text-center" onClick={() => setDetail(c)}>
                <Sprite species={species!} shiny={c.shiny} size={72} />
                <div className="truncate text-sm font-bold">
                  {c.nickname ?? species?.name.es}
                  {c.shiny && ' ✦'}
                  {profile?.companionId === c.id && ' ⭐'}
                </div>
                <div className="tabular text-xs text-[var(--muted)]">Nv. {info.level}</div>
                <ProgressBar value={info.value} max={info.max} color="var(--accent)" height={8} />
              </Btn>
            );
          })}
        </div>
        <div className="mt-3 flex gap-2 text-sm">
          <Btn className="btn flex-1" onClick={() => void feedBerry()} disabled={(inventory?.items.berry ?? 0) <= 0}>
            🍓 Dar baya al compañero ({inventory?.items.berry ?? 0})
          </Btn>
        </div>
      </div>

      {pending.length > 0 && (
        <div className="panel border-2 p-4" style={{ borderColor: 'var(--accent-dark)' }}>
          <h2 className="mb-2 text-lg font-bold">Evoluciones</h2>
          {pending.map((p) => {
            const creature = (creatures ?? []).find((c) => c.id === p.creatureId);
            if (!creature) return null;
            const current = dataset.byId.get(creature.speciesId);
            return (
              <div key={p.creatureId} className="mb-3 flex flex-wrap items-center gap-3">
                <Sprite species={current!} shiny={creature.shiny} size={64} />
                <span className="font-bold">{current?.name.es}</span>
                <span aria-hidden>→</span>
                {p.options.map((o) => {
                  const target = dataset.byId.get(o.toSpeciesId);
                  if (!target) return null;
                  return (
                    <div key={o.toSpeciesId} className="flex items-center gap-2">
                      <Sprite species={target} shiny={creature.shiny} size={64} />
                      <Btn className="btn btn-primary" onClick={() => void confirmEvolution(creature.id, o.toSpeciesId)}>
                        Evolucionar a {target.name.es}
                      </Btn>
                    </div>
                  );
                })}
                <Btn className="btn" onClick={() => void dismissEvolution(creature.id)}>
                  Más tarde
                </Btn>
              </div>
            );
          })}
        </div>
      )}

      {ownedList.length > 0 && (
        <div className="panel p-4">
          <h2 className="mb-2 font-bold">Otros Pokémon ({ownedList.length})</h2>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {ownedList.map((c) => {
              const species = dataset.byId.get(c.speciesId);
              if (!species) return null;
              return (
                <Btn key={c.id} className="panel p-2 text-center" onClick={() => setDetail(c)}>
                  <Sprite species={species} shiny={c.shiny} size={56} animated={false} />
                  <div className="truncate text-xs font-bold">{species.name.es}</div>
                  <div className="tabular text-[10px] text-[var(--muted)]">Nv. {xpInfo(c).level}</div>
                </Btn>
              );
            })}
          </div>
        </div>
      )}

      {(eggs?.length ?? 0) > 0 && (
        <div className="panel p-4 text-sm">
          <h2 className="mb-2 font-bold">Incubadora ({eggs!.length}/3)</h2>
          {eggs!.map((e) => (
            <div key={e.id} className="mb-2">
              <div className="flex justify-between text-xs">
                <span>🥚 Huevo</span>
                <span className="tabular">
                  {Math.floor(e.progressMinutes)}/{e.requiredMinutes} min
                </span>
              </div>
              <ProgressBar value={e.progressMinutes} max={e.requiredMinutes} height={8} color="var(--success)" />
            </div>
          ))}
        </div>
      )}

      {detail && (
        <CreatureDetail
          creature={detail}
          isTeam={team.some((t) => t.id === detail.id)}
          isCompanion={profile?.companionId === detail.id}
          teamFull={team.length >= 6}
          stones={inventory?.items ?? {}}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}

function CreatureDetail(props: {
  creature: OwnedCreature;
  isTeam: boolean;
  isCompanion: boolean;
  teamFull: boolean;
  stones: Partial<Record<ItemId, number>>;
  onClose: () => void;
}) {
  const { creature, isTeam, isCompanion, teamFull, stones, onClose } = props;
  const species = dataset.byId.get(creature.speciesId);
  if (!species) return null;
  const info = {
    level: creature.level,
  };

  return (
    <Modal title={creature.nickname ?? species.name.es} onClose={onClose}>
      <div className="flex flex-col items-center gap-2">
        <Sprite species={species} shiny={creature.shiny} size={140} />
        <div className="flex gap-1">
          {species.types.map((t) => (
            <TypeBadge key={t} type={t} />
          ))}
        </div>
        <p className="tabular text-sm">
          Nv. {info.level} · XP {creature.xp} · Amistad {creature.friendship}/255
        </p>
        <p className="text-xs text-[var(--muted)]">{species.flavor.es}</p>
      </div>

      <div className="mt-4 flex flex-col gap-2 text-sm">
        {!isCompanion && (
          <Btn className="btn btn-primary" onClick={() => { void setCompanion(creature.id); onClose(); }}>
            Hacer compañero ⭐
          </Btn>
        )}
        {!isTeam && !teamFull && (
          <Btn className="btn" onClick={() => { void addToTeam(creature.id); onClose(); }}>
            Añadir al equipo
          </Btn>
        )}
        {isTeam && !isCompanion && (
          <Btn className="btn" onClick={() => { void removeFromTeam(creature.id); onClose(); }}>
            Quitar del equipo
          </Btn>
        )}
        <div className="flex flex-wrap gap-2">
          {STONES.filter((s) => (stones[s.id] ?? 0) > 0).map((s) => (
            <Btn
              key={s.id}
              className="btn"
              onClick={() => void evolveWithItem(creature.id, s.id).then((ok) => ok && onClose())}
            >
              Usar {s.label}
            </Btn>
          ))}
        </div>
        <Btn
          className="btn btn-danger"
          onClick={() => {
            if (confirm(`¿Liberar a ${species.name.es}? (+15 💵)`)) {
              void releaseCreature(creature.id);
              onClose();
            }
          }}
        >
          Liberar (+15 💵)
        </Btn>
      </div>
    </Modal>
  );
}
