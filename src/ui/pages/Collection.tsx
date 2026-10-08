import { Btn, Select } from '../components/motion';
import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db';
import { dataset } from '../../data/dataset';
import { Modal, RarityBadge, Sprite, TypeBadge, StatRow } from '../components/ui';
import type { Rarity, TypeId } from '../../core/types';

const TYPES: TypeId[] = [
  'normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison',
  'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy',
];
const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythical'];

export function CollectionPage() {
  const dex = useLiveQuery(() => db.dex.toArray(), []);
  const creatures = useLiveQuery(() => db.creatures.toArray(), []);
  const [status, setStatus] = useState<'seen' | 'caught' | 'all'>('seen');
  const [type, setType] = useState<TypeId | 'all'>('all');
  const [rarity, setRarity] = useState<Rarity | 'all'>('all');
  const [selected, setSelected] = useState<number | null>(null);

  const dexMap = useMemo(() => new Map((dex ?? []).map((d) => [d.speciesId, d])), [dex]);

  const list = useMemo(() => {
    let rows = dataset.creatures;
    if (status === 'seen') rows = rows.filter((c) => dexMap.get(c.id)?.seen || dexMap.get(c.id)?.caught);
    if (status === 'caught') rows = rows.filter((c) => dexMap.get(c.id)?.caught);
    if (type !== 'all') rows = rows.filter((c) => c.types.includes(type));
    if (rarity !== 'all') rows = rows.filter((c) => c.rarity === rarity);
    return rows;
  }, [status, type, rarity, dexMap]);

  const caughtCount = (dex ?? []).filter((d) => d.caught).length;

  const selectedSpecies = selected != null ? dataset.byId.get(selected) : null;
  const owned = selected != null ? (creatures ?? []).filter((c) => c.speciesId === selected) : [];

  return (
    <div className="space-y-4">
      <div className="panel p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-bold">Pokédex</h1>
          <span className="text-sm text-[var(--muted)]">
            {caughtCount}/{dataset.creatures.length} capturados
          </span>
          <div className="ml-auto flex flex-wrap gap-2 text-sm">
            <Select className="btn !py-1" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
              <option value="seen">Vistos</option>
              <option value="caught">Capturados</option>
              <option value="all">Todas</option>
            </Select>
            <Select className="btn !py-1" value={type} onChange={(e) => setType(e.target.value as TypeId | 'all')}>
              <option value="all">Todos los tipos</option>
              {TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Select>
            <Select className="btn !py-1" value={rarity} onChange={(e) => setRarity(e.target.value as Rarity | 'all')}>
              <option value="all">Toda rareza</option>
              {RARITIES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-7">
        {list.map((c) => {
          const entry = dexMap.get(c.id);
          const isCaught = entry?.caught;
          return (
            <Btn
              key={c.id}
              className="panel flex flex-col items-center p-2 text-center"
              style={{ opacity: entry?.seen || entry?.caught ? 1 : 0.45 }}
              onClick={() => setSelected(c.id)}
            >
              <Sprite species={c} size={56} animated={false} />
              <span className="mt-1 w-full truncate text-xs font-bold">{c.name.es}</span>
              <span className="tabular text-[10px] text-[var(--muted)]">
                #{String(c.id).padStart(3, '0')} {isCaught ? '✓' : ''}
              </span>
            </Btn>
          );
        })}
        {list.length === 0 && (
          <p className="col-span-full py-8 text-center text-sm text-[var(--muted)]">
            Sin resultados. Completa sesiones para encontrar Pokémon.
          </p>
        )}
      </div>

      {selectedSpecies && (
        <Modal title={`#${String(selectedSpecies.id).padStart(3, '0')} ${selectedSpecies.name.es}`} onClose={() => setSelected(null)} wide>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex flex-col items-center gap-2">
              <Sprite species={selectedSpecies} size={160} />
              <div className="flex gap-1">
                {selectedSpecies.types.map((t) => (
                  <TypeBadge key={t} type={t} />
                ))}
              </div>
              <RarityBadge rarity={selectedSpecies.rarity} />
            </div>
            <div className="flex-1 space-y-2 text-sm">
              <p className="text-[var(--muted)]">
                {selectedSpecies.flavor.es ?? selectedSpecies.flavor.en ?? 'Sin descripción.'}
              </p>
              <StatRow label="PS" value={Math.round(selectedSpecies.bst / 3)} />
              <StatRow label="BST" value={selectedSpecies.bst} max={720} />
              <p>Captura base: {selectedSpecies.captureRate} · Gen {selectedSpecies.generation}</p>
              <p>
                Estado:{' '}
                {dexMap.get(selectedSpecies.id)?.caught
                  ? `Capturado ×${owned.length}`
                  : dexMap.get(selectedSpecies.id)?.seen
                    ? 'Vista'
                    : 'Desconocido'}
              </p>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
