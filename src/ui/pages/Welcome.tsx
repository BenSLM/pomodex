import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db';
import { dataset } from '../../data/dataset';
import { chooseStarter, setCompanion } from '../../data/actions';
import { Btn, Input } from '../components/motion';
import { Sprite, TypeBadge } from '../components/ui';
import { levelFromXp } from '../../core/xp';

/** §7.2/§9.6 — primer arranque: elegir entre Bulbasaur, Charmander y Squirtle. */
export function WelcomePage() {
  const settings = useLiveQuery(() => db.settings.get('me'), []);
  const [selected, setSelected] = useState<number | null>(null);
  const [nickname, setNickname] = useState('');
  const [busy, setBusy] = useState(false);

  const ids = settings?.rewards.starterSpeciesIds ?? [1, 4, 7];

  const confirm = async () => {
    if (selected == null || busy) return;
    setBusy(true);
    try {
      await chooseStarter(selected, { nickname });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-5">
      <header className="text-center">
        <h1 className="text-2xl font-bold">¡Bienvenido, entrenador!</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Elige tu primer compañero. Te acompañará en cada sesión de enfoque.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        {ids.map((id) => {
          const species = dataset.byId.get(id);
          if (!species) return null;
          const active = selected === id;
          return (
            <Btn
              key={id}
              className="panel flex flex-col items-center gap-2 p-4 text-center"
              style={active ? { borderColor: 'var(--primary)', borderWidth: 2 } : undefined}
              aria-pressed={active}
              onClick={() => setSelected(id)}
            >
              <Sprite species={species} size={96} />
              <div className="font-bold">{species.name.es}</div>
              <div className="flex gap-1">
                {species.types.map((t) => (
                  <TypeBadge key={t} type={t} />
                ))}
              </div>
              <p className="text-xs text-[var(--muted)]">{species.flavor.es}</p>
            </Btn>
          );
        })}
      </div>

      {selected != null && (
        <section className="panel space-y-3 p-4">
          <label className="block text-sm">
            Apodo (opcional)
            <Input
              className="btn mt-1 w-full"
              value={nickname}
              maxLength={12}
              placeholder="Por defecto, su nombre"
              onChange={(e) => setNickname(e.target.value)}
            />
          </label>
          <Btn className="btn btn-primary w-full" disabled={busy} onClick={() => void confirm()}>
            Confirmar compañero
          </Btn>
        </section>
      )}
    </div>
  );
}

/** §7.2 — fallback: backups sin compañero pero con Pokémon; hay que elegir uno. */
export function ChooseCompanionPage() {
  const creatures = useLiveQuery(() => db.creatures.toArray(), []);
  const settings = useLiveQuery(() => db.settings.get('me'), []);

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-5">
      <header className="text-center">
        <h1 className="text-2xl font-bold">Elige tu compañero</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Tu equipo necesita un Pokémon activo.</p>
      </header>
      <div className="grid gap-3 sm:grid-cols-3">
        {(creatures ?? []).map((c) => {
          const species = dataset.byId.get(c.speciesId);
          if (!species) return null;
          return (
            <div key={c.id} className="panel flex flex-col items-center gap-2 p-4 text-center">
              <Sprite species={species} shiny={c.shiny} size={80} />
              <div className="font-bold">
                {c.nickname ?? species.name.es}
                {c.shiny && ' ✦'}
              </div>
              <div className="text-xs text-[var(--muted)]">
                Nv. {levelFromXp(c.xp, settings?.rewards.xpScale ?? 0.25)}
              </div>
              <Btn className="btn btn-primary w-full" onClick={() => void setCompanion(c.id)}>
                Elegir
              </Btn>
            </div>
          );
        })}
      </div>
    </div>
  );
}
