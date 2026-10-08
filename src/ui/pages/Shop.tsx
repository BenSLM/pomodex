import { Btn } from '../components/motion';
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db';
import { SHOP_CATALOG, BALL_NAMES } from '../../core/economy';
import { buyItem, useIncense } from '../../data/actions';
import type { BallId, ItemId } from '../../core/types';

const ITEM_DESC: Record<string, string> = {
  potion: 'Recupera un Pokémon debilitado',
  revive: 'Revive instantáneamente',
  streakShield: 'Protege la racha un día perdido (máx 2)',
  incense: '+100 % rareza por 5 encuentros (×5 cargas)',
  berry: '+3 amistad al compañero',
  fireStone: 'Evoluciona por objeto',
  waterStone: 'Evoluciona por objeto',
  thunderStone: 'Evoluciona por objeto',
  leafStone: 'Evoluciona por objeto',
  moonStone: 'Evoluciona por objeto',
  sunStone: 'Evoluciona por objeto',
  shinyStone: 'Evoluciona por objeto',
  duskStone: 'Evoluciona por objeto',
  dawnStone: 'Evoluciona por objeto',
  iceStone: 'Evoluciona por objeto',
  linkCable: 'Sustituye al intercambio (evolución especial)',
};

export function ShopPage() {
  const profile = useLiveQuery(() => db.profile.get('me'), []);
  const inventory = useLiveQuery(() => db.inventory.get('me'), []);
  const [error, setError] = useState('');

  const onBuy = async (id: BallId | ItemId) => {
    try {
      setError('');
      await buyItem(id);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="panel flex items-center gap-3 p-4">
        <h1 className="text-lg font-bold">Tienda</h1>
        <span className="ml-auto font-bold">💵 {profile?.coins ?? 0}</span>
      </div>
      {error && (
        <p className="panel p-3 text-sm font-bold" style={{ color: 'var(--danger)' }} role="alert">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {SHOP_CATALOG.map((item) => {
          const count =
            item.kind === 'ball'
              ? inventory?.balls[item.id as BallId] ?? 0
              : inventory?.items[item.id as ItemId] ?? 0;
          return (
            <div key={item.id} className="panel flex flex-col p-3 text-sm">
              <span className="font-bold">{item.name.es}</span>
              <span className="min-h-[32px] text-xs text-[var(--muted)]">
                {ITEM_DESC[item.id] ?? 'Mejora tu equipo'}
              </span>
              <span className="tabular my-1 text-xs">En inventario: {count}</span>
              <Btn
                className="btn btn-accent mt-auto w-full"
                onClick={() => void onBuy(item.id)}
                disabled={(profile?.coins ?? 0) < item.price}
              >
                Comprar · {item.price} 💵
              </Btn>
            </div>
          );
        })}
      </div>

      <div className="panel p-4 text-sm">
        <h2 className="mb-2 font-bold">Inventario</h2>
        <div className="flex flex-wrap gap-3">
          {Object.entries(inventory?.balls ?? {}).map(([k, v]) => (
            <span key={k}>
              {BALL_NAMES[k as BallId].es}: <b>{v}</b>
            </span>
          ))}
          <span>
            Incienso cargas: <b>{inventory?.incenseCharges ?? 0}</b>
          </span>
        </div>
        <Btn
          className="btn mt-3"
          onClick={() => void useIncense().catch((e) => setError((e as Error).message))}
          disabled={(inventory?.items.incense ?? 0) <= 0}
        >
          Activar incienso ({inventory?.items.incense ?? 0} en inventario)
        </Btn>
      </div>
    </div>
  );
}
