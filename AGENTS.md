# AGENTS.md

Código en TypeScript (Vite + React 18 + Tailwind 4 + Dexie). Fases 0–2 del `ROADMAP.md` implementadas y verdes (tsc, 38 tests, build). Fases 3–6 pendientes.

## Fuentes de verdad
- `SPECS.md` — especificación completa (v0.1). Si docs y código divergen, SPECS manda hasta que se decida lo contrario.
- `ROADMAP.md` — ruta por fases (0–6) con estado actualizado en su cabecera.
- `README.md` — describe el proyecto **terminado**; los comandos ya existen: `npm run dev`, `build-dataset`, `npm test`, `npm run build`.

## Al implementar (de SPECS §2–§3, no obvious from filenames)
- `src/core/` es TypeScript puro: **no importa** React, Dexie ni `window`. `Clock` y `Rng` se inyectan (FakeClock y RNG con semilla para tests).
- Ninguna prueba depende de `Date.now()` real ni `Math.random()`.
- Todo número de balance vive en `RewardConfig` (§8), nunca hardcodeado en la lógica de juego.
- El timer calcula tiempo por timestamps (`startedAt`/`pausedAccumulatedMs`), nunca acumulando `setInterval`.
- PokeAPI solo se usa en `scripts/build-dataset.ts` y para sprites/cries en runtime; nada de llamadas en pantallas.
- Terminología neutra en UI ("Criatura", "Entrenador"). `CreatureProvider` (§4.3) **aún no existe**: la UI y `src/data/game.ts` leen el dataset JSON directamente (`src/data/dataset/index.ts`); migrarlo antes de Fase 5.

## Convenciones del repo
- Verificación: `npx tsc -b` limpio, `npm test` (vitest, jsdom, `tests/setup.ts`, fake-indexeddb para Dexie), `npm run build`.
- Tests de fórmulas en `tests/*.test.ts`; smoke de UI en `tests/app.test.tsx` (Playwright pendiente, Fase 5).
- Desviaciones ya tomadas de SPECS: Incienso = 1 ítem = 5 cargas; encuentros solo Kanto por `profile.currentRegion`.

## Orden de trabajo
- Seguir las fases de `ROADMAP.md` en orden; Fase 3 (gimnasios) es la siguiente.
- Toda fórmula de §7 se implementa con tests unitarios en paralelo.
