import { useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './data/db';
import { ensureSeeded } from './data/game';
import { useTimerStore } from './app/stores/timerStore';
import { Layout } from './ui/components/Layout';
import { FocusPage } from './ui/pages/Focus';
import { CollectionPage } from './ui/pages/Collection';
import { TeamPage } from './ui/pages/Team';
import { ShopPage } from './ui/pages/Shop';
import { SettingsPage } from './ui/pages/Settings';

export function App() {
  const bootstrapped = useTimerStore((s) => s.bootstrapped);
  const settings = useLiveQuery(() => db.settings.get('me'), []);

  useEffect(() => {
    void ensureSeeded().then(() => useTimerStore.getState().init());
  }, []);

  useEffect(() => {
    if (!settings) return;
    document.documentElement.dataset.theme = settings.theme.theme;
    document.documentElement.dataset.ui = settings.theme.uiStyle;
    document.documentElement.lang = settings.locale;
    if (settings.theme.theme === 'custom') {
      const c = settings.theme.custom;
      const el = document.documentElement;
      el.style.setProperty('--primary', c.primary);
      el.style.setProperty('--accent', c.accent);
      el.style.setProperty('--bg', c.bg);
      el.style.setProperty('--surface', c.surface);
    }
  }, [settings]);

  if (!bootstrapped) {
    return <div className="flex h-full items-center justify-center text-[var(--muted)]">Cargando…</div>;
  }

  return (
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<FocusPage />} />
            <Route path="/collection" element={<CollectionPage />} />
            <Route path="/team" element={<TeamPage />} />
            <Route path="/shop" element={<ShopPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </MotionConfig>
  );
}
