import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db';

const NAV = [
  { to: '/', label: 'Focus', icon: '⏱' },
  { to: '/collection', label: 'Colección', icon: '📖' },
  { to: '/team', label: 'Equipo', icon: '⚔' },
  { to: '/shop', label: 'Tienda', icon: '🛒' },
  { to: '/settings', label: 'Ajustes', icon: '⚙' },
];

const navItem = {
  hidden: { opacity: 0, y: -12 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 380, damping: 26 } },
};

export function Layout() {
  const profile = useLiveQuery(() => db.profile.get('me'), []);
  const streak = useLiveQuery(() => db.meta.get('streak'), []);
  const location = useLocation();

  return (
    <div className="mx-auto flex min-h-full max-w-5xl flex-col px-3 pb-8">
      <div className="sticky top-0 z-40 -mx-3 border-b bg-[var(--surface)] px-3 pt-3 shadow-sm">
        <header className="flex flex-wrap items-center gap-3 pb-2">
          <motion.h1
            className="text-xl font-bold"
            style={{ color: 'var(--primary)' }}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 22 }}
          >
            🎯 Focus Trainer
          </motion.h1>
          <div className="ml-auto flex items-center gap-3 text-sm font-semibold">
            <span title="Racha">🔥 {((streak?.value as { current: number })?.current ?? 0)}</span>
            <motion.span
              key={profile?.coins ?? 0}
              title="Monedas"
              initial={{ scale: 1.35 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 420, damping: 18 }}
            >
              💵 {profile?.coins ?? 0}
            </motion.span>
          </div>
        </header>

        <motion.nav
          className="flex gap-1 overflow-x-auto pb-2 sm:gap-2"
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
        >
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `relative flex min-h-[40px] items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-bold ${
                  isActive ? 'text-[var(--primary)]' : 'text-[var(--muted)]'
                }`
              }
            >
              {({ isActive }) => (
                <motion.span
                  className="relative flex items-center gap-1.5"
                  variants={navItem}
                  whileHover={{ scale: 1.07 }}
                  whileTap={{ scale: 0.93 }}
                >
                  {isActive && (
                    <motion.span
                      layoutId="nav-active"
                      className="absolute -inset-x-2.5 -inset-y-1.5 rounded-full"
                      style={{ background: 'var(--primary)', opacity: 0.15 }}
                      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    />
                  )}
                  <span aria-hidden className="relative">
                    {item.icon}
                  </span>
                  <span className="relative">{item.label}</span>
                </motion.span>
              )}
            </NavLink>
          ))}
        </motion.nav>
      </div>

      <main className="flex-1 py-4">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, ease: 'easeOut' }}
        >
          <Outlet />
        </motion.div>
      </main>
    </div>
  );
}
