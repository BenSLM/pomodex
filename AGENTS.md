# AGENTS.md

Código en TypeScript (Vite 6 + React 18 + Tailwind 4 + Dexie + Motion 14). Fases 0–2 del `ROADMAP.md` hechas (secciones tachadas con ✅); Fase 3 (gimnasios) es la siguiente. Pulido de Fases 0–2 en curso (ver `prompts.md`).

## Fuentes de verdad
- `SPECS.md` — especificación completa (v0.1). Si docs y código divergen, SPECS manda hasta que se decida lo contrario.
- `ROADMAP.md` — ruta por fases (0–6); cabecera con estado y secciones tachadas de fases terminadas.
- `README.md` — describe el proyecto **terminado**; los comandos ya existen: `npm run dev`, `build-dataset`, `npm test`, `npm run build`.
- `prompts.md` — secuencia de prompts de pulido (se pasan uno por uno, con commit por prompt). No lo importa el runtime.

## Comandos (verificación en este orden)
- `npx tsc -b` → limpio.
- `npm test` → vitest (`tests/**/*.test.{ts,tsx}`, jsdom, `tests/setup.ts`, fake-indexeddb para Dexie); 57 tests / 10 archivos.
- Test suelto: `npx vitest run tests/xp.test.ts` (con `npx vitest watch …` si se quiere watch).
- `npm run build` → `tsc -b && vite build`. No hay ESLint/Prettier configurados y no hay CI.
- `npm run build-dataset` solo si cambia el dataset: llama a PokeAPI (pausa ~100 ms + reintentos). El JSON ya está commiteado en `src/data/dataset/`; el dev normal no lo necesita.
- `npm run simulate` → simula el ritmo de progresión (`scripts/simulate-progression.ts`, tsx) reutilizando `src/core`; **si cambias el balance de XP, ejecútalo y actualiza los tests de hitos** (`tests/progression.test.ts`).

## Al implementar (de SPECS §2–§3, no obvious from filenames)
- `src/core/` es TypeScript puro: **no importa** React, Dexie ni `window`. `Clock` y `Rng` se inyectan (FakeClock y RNG con semilla en tests).
- Ninguna prueba depende de `Date.now()` real ni `Math.random()`.
- Todo número de balance vive en `RewardConfig` (`src/core/rewards/config.ts`, §8), nunca hardcodeado en la lógica de juego.
- El timer calcula tiempo por timestamps (`startedAt`/`pausedAccumulatedMs`), nunca acumulando `setInterval`.
- Determinismo del pipeline: `uid()` usa solo el RNG inyectado; el seed del encuentro es `mulberry32((startedAt ^ focusedMs) >>> 0)`.
- Curva de XP **única** (`n³`); `growth_rate` del dataset se ignora a propósito. `xpScale` por defecto 0.25. `xpForLevel` no floorea (y `rawXpForLevel` clampa ≥ 0) para que `levelFromXp(xpForLevel(n)) === n`; no "arreglarlo" redondeando.
- PokeAPI solo se usa en `scripts/build-dataset.ts` y para sprites/cries en runtime; nada de llamadas de red en pantallas.
- `CreatureProvider` (§4.3) **aún no existe**: la UI y `src/data/game.ts` leen el dataset JSON directo (`src/data/dataset/index.ts`); migrarlo antes de Fase 5.
- Terminología de UI: **"Pokémon"** (no "criatura"); géneros en español: "capturar un Pokémon", "Pokémon debilitado", "Los Pokémon evolucionados". Los flavor texts de `src/data/dataset/creatures.json` son oficiales: no traducir ni editar.

## Convenciones de UI
- Reusar `Btn`/`Select`/`Input` de `src/ui/components/motion.tsx` y `Modal` de `ui.tsx` (animaciones Motion) en vez de `<button>`/`<select>` nativos. Import de motion: `motion/react`. `MotionConfig reducedMotion="user"` envuelve la app en `src/App.tsx`.
- Navbar en `src/ui/components/Layout.tsx`: **arriba**, sticky bajo el logo; no hay bottom-bar. Píldora activa con `layoutId="nav-active"`.
- Monedas en UI: 💵 (no 🪙).

## Desviaciones ya tomadas de SPECS
- Incienso = 1 ítem = 5 cargas (`Inventory.incenseCharges`).
- Encuentros solo de Kanto (`profile.currentRegion`).
- **Categorías eliminadas** (Prompt 1): no hay tabla `categories`, ni `categoryId` en sesiones/metas, ni selector en Focus, ni afinidad por categoría. Migración Dexie `version(2).stores({ categories: null, sessions: 'id, startedAt, outcome' })`.
- **Curva de XP única** (Prompt 1): `rawXpForLevel(n) = n³`, sin `growth_rate` ni `xpScale` por especie; `growth_rate` del dataset se ignora.
- **Lanzamientos ilimitados** (Prompt 1): un fallo **no** elimina el encuentro ni gasta intentos extra; solo resta 1 ball. Se sale del encuentro con "Dejar ir" (confirmación) o cuando expira el TTL (`isEncounterExpired`). El nº de intentos es informativo (`Encounter.attempts`).
- **Recalibración de XP** (Prompt 2): `xpScale` 0.25, `freePausesPerSession` 1 (la primera pausa no resta calidad). `teamXpShare` se queda en 25 %: **no** hay bonus de recuperación (el equipo se pone al día con caramelos, Prompt 4).

## Reglas de documentación
Cualquier cambio de comportamiento debe reflejarse, en este orden, en:
1. `AGENTS.md` — invariantes, comandos, conteo de tests/archivos y desviaciones.
2. `SPECS.md` — la sección § afectada es la fuente de verdad; marcar lo reemplazado como "(reemplazado: …)", no borrar historial.
3. `ROADMAP.md` — tachar (`~~…~~` + ✅) lo hecho y anotar sustituciones.
4. `README.md` — solo lo visible para el usuario (features/comandos).
5. `tests/` — todo comportamiento nuevo con test unitario en paralelo (fórmulas de §7).

## Orden de trabajo
- Seguir `ROADMAP.md` en orden; Fase 3 (gimnasios) es la siguiente.
- Toda fórmula de §7 se implementa con tests unitarios en paralelo.
- Smoke de UI en `tests/app.test.tsx` (jsdom); Playwright queda para Fase 5.
- El pulido actual sigue `prompts.md` (un prompt por vez, verificando `tsc -b` → `npm test` → `npm run build`).
