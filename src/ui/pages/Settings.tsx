import { Btn, Select, Input } from '../components/motion';
import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db';
import { saveSettings } from '../../data/actions';
import { presetConfig } from '../../core/rewards/config';
import { backupFilename, exportBackup, importBackup, validateBackup } from '../../data/export';
import type { RewardConfig } from '../../core/types';

export function SettingsPage() {
  const settings = useLiveQuery(() => db.settings.get('me'), []);
  const profile = useLiveQuery(() => db.profile.get('me'), []);
  const [message, setMessage] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  if (!settings || !profile) return <p className="p-4 text-sm text-[var(--muted)]">Cargando…</p>;

  const patch = async (p: Partial<typeof settings>) => {
    await saveSettings(p);
  };

  const onExport = async () => {
    const backup = await exportBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = backupFilename();
    a.click();
    URL.revokeObjectURL(url);
    setMessage('Backup descargado.');
  };

  const onImport = async (file: File) => {
    try {
      const raw = JSON.parse(await file.text());
      const backup = validateBackup(raw);
      if (!confirm(`¿Importar backup de ${new Date(backup.exportedAt).toLocaleString()}? Se sobrescribirán los datos actuales.`)) return;
      const previous = await exportBackup();
      const blob = new Blob([JSON.stringify(previous, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = backupFilename(new Date(previous.exportedAt));
      a.click();
      URL.revokeObjectURL(url);
      await importBackup(backup);
      setMessage('Importación completada. Recarga la página.');
    } catch (e) {
      setMessage(`Error: ${(e as Error).message}`);
    }
  };

  const setPreset = async (preset: RewardConfig['preset']) => {
    await patch({ rewards: presetConfig(preset) });
  };

  const rewardFields: { key: keyof RewardConfig; label: string; step?: number }[] = [
    { key: 'xpPerMinute', label: 'XP por minuto' },
    { key: 'minValidMinutes', label: 'Minutos mínimos válidos' },
    { key: 'completionThreshold', label: 'Umbral de completado (0-1)', step: 0.05 },
    { key: 'shinyRate', label: 'Probabilidad shiny', step: 0.001 },
    { key: 'throwsPerEncounter', label: 'Lanzamientos por encuentro' },
    { key: 'streakMinMinutes', label: 'Minutos para racha' },
    { key: 'regionPace', label: 'Ritmo de regiones', step: 0.1 },
    { key: 'eggDropChance', label: 'Probabilidad de huevo', step: 0.01 },
  ];

  return (
    <div className="space-y-4">
      <section className="panel space-y-3 p-4 text-sm">
        <h1 className="text-lg font-bold">Ajustes</h1>
        <label className="block">
          Nombre de entrenador
          <Input
            className="btn mt-1 w-full"
            value={profile.trainerName}
            onChange={(e) => void db.profile.put({ ...profile, trainerName: e.target.value })}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label>
            Foco (min)
            <Input
              type="number"
              className="btn mt-1 w-full"
              value={settings.timer.focusMin}
              onChange={(e) => void patch({ timer: { ...settings.timer, focusMin: Number(e.target.value) } })}
            />
          </label>
          <label>
            Descanso (min)
            <Input
              type="number"
              className="btn mt-1 w-full"
              value={settings.timer.breakMin}
              onChange={(e) => void patch({ timer: { ...settings.timer, breakMin: Number(e.target.value) } })}
            />
          </label>
          <label>
            Descanso largo (min)
            <Input
              type="number"
              className="btn mt-1 w-full"
              value={settings.timer.longBreakMin}
              onChange={(e) => void patch({ timer: { ...settings.timer, longBreakMin: Number(e.target.value) } })}
            />
          </label>
          <label>
            Ciclos antes de largo
            <Input
              type="number"
              className="btn mt-1 w-full"
              value={settings.timer.cyclesBeforeLong}
              onChange={(e) => void patch({ timer: { ...settings.timer, cyclesBeforeLong: Number(e.target.value) } })}
            />
          </label>
        </div>
        <label className="block">
          Cambio de día (hora)
          <Input
            type="number"
            min={0}
            max={23}
            className="btn mt-1 w-full"
            value={settings.dayRolloverHour}
            onChange={(e) => void patch({ dayRolloverHour: Number(e.target.value) })}
          />
        </label>
      </section>

      <section className="panel space-y-3 p-4 text-sm">
        <h2 className="font-bold">Recompensas</h2>
        <label className="block">
          Preset
          <Select className="btn mt-1 w-full" value={settings.rewards.preset} onChange={(e) => void setPreset(e.target.value as RewardConfig['preset'])}>
            <option value="casual">Casual</option>
            <option value="normal">Normal</option>
            <option value="hardcore">Hardcore</option>
            <option value="custom">Personalizado</option>
          </Select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          {rewardFields.map((f) => (
            <label key={String(f.key)}>
              {f.label}
              <Input
                type="number"
                step={f.step ?? 1}
                className="btn mt-1 w-full"
                value={String(settings.rewards[f.key])}
                onChange={(e) =>
                  void patch({
                    rewards: { ...settings.rewards, [f.key]: Number(e.target.value), preset: 'custom' },
                  })
                }
              />
            </label>
          ))}
        </div>
        <label className="flex items-center gap-2">
          <Input
            type="checkbox"
            checked={settings.modes.strictFocus}
            onChange={(e) => void patch({ modes: { ...settings.modes, strictFocus: e.target.checked } })}
          />
          Strict focus (distracciones ×2)
        </label>
        <label className="flex items-center gap-2">
          <Input
            type="checkbox"
            checked={settings.modes.nuzlocke}
            onChange={(e) => void patch({ modes: { ...settings.modes, nuzlocke: e.target.checked } })}
          />
          Modo Nuzlocke (pendiente: Fase 4)
        </label>
        <label className="flex items-center gap-2">
          <Input
            type="checkbox"
            checked={settings.modes.flowTimer}
            onChange={(e) => void patch({ modes: { ...settings.modes, flowTimer: e.target.checked } })}
          />
          Habilitar modo Flow
        </label>
      </section>

      <section className="panel space-y-3 p-4 text-sm">
        <h2 className="font-bold">Apariencia</h2>
        <div className="grid grid-cols-2 gap-3">
          <label>
            Tema
            <Select
              className="btn mt-1 w-full"
              value={settings.theme.theme}
              onChange={(e) => void patch({ theme: { ...settings.theme, theme: e.target.value as typeof settings.theme.theme } })}
            >
              <option value="classic">Classic</option>
              <option value="ocean">Ocean</option>
              <option value="fire">Fire</option>
              <option value="forest">Forest</option>
              <option value="dark">Dark</option>
            </Select>
          </label>
          <label>
            Estilo UI
            <Select
              className="btn mt-1 w-full"
              value={settings.theme.uiStyle}
              onChange={(e) => void patch({ theme: { ...settings.theme, uiStyle: e.target.value as typeof settings.theme.uiStyle } })}
            >
              <option value="modern">Modern</option>
              <option value="retro">Retro</option>
              <option value="pixel">Pixel</option>
            </Select>
          </label>
        </div>
      </section>

      <section className="panel space-y-2 p-4 text-sm">
        <h2 className="font-bold">Datos</h2>
        <div className="flex flex-wrap gap-2">
          <Btn className="btn btn-primary" onClick={() => void onExport()}>
            Exportar backup
          </Btn>
          <Btn className="btn" onClick={() => fileRef.current?.click()}>
            Importar backup
          </Btn>
          <Input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onImport(f);
              e.target.value = '';
            }}
          />
        </div>
        {message && <p role="status">{message}</p>}
      </section>
    </div>
  );
}
