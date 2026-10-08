# ROADMAP.md — Ruta de trabajo (Focus Trainer)

> Derivado de `SPECS.md` v0.1. Cada fase termina con algo usable y verificable.

## Estado (2026-10-08)

| Fase | Estado | Notas |
|---|---|---|
| 0 — Cimientos | ✅ hecho | Tokens, fuentes, core (Clock/Rng/tipos), Dexie v1, `build-dataset` (1025 especies, 485 evoluciones). |
| 1 — MVP | ✅ hecho | Timer por timestamps, calidad, pipeline de recompensas, encuentro/captura, Focus + Collection, export/import Zod. E2E: smoke jsdom (`tests/app.test.tsx`); Playwright queda pendiente (Fase 5). |
| 2 — Progresión | ✅ hecho | XP/nivel/evolución, compañero y equipo, economía+tienda, rachas, pantallas Team/Shop/Settings. |
| 3–6 | ⬜ pendiente | Ver secciones de abajo. |

- Verificación actual: `npx tsc -b` limpio, `npm test` 38/38, `npm run build` OK (bundle ~288 kB gzip; code-splitting en Fase 5).
- Desviaciones menores: Incienso = 1 ítem = 5 cargas (`Inventory.incenseCharges`); solo región Kanto en encuentros.

---

## ~~Fase 0 — Cimientos~~ ✅
- ~~Inicializar proyecto Vite + React + TypeScript (strict) + Tailwind + ESLint/Prettier.~~
- ~~Crear design tokens (`tokens.css` con variables CSS) y autoalojar fuentes (Fredoka, Nunito, JetBrains Mono).~~
- ~~Implementar `core/clock.ts` (Clock, SystemClock, FakeClock) y `core/rng.ts` (mulberry32 con semilla).~~
- ~~Definir tipos de dominio (`core/types.ts`) y esquema Dexie v1 (`data/db.ts`).~~
- ~~Escribir `scripts/build-dataset.ts`: descarga de PokeAPI con pausa ~100 ms y reintentos con backoff.~~
- ~~Generar `creatures.json`, `types.json` (matriz 18×18) y `evolutions.json` en `src/data/dataset/`.~~
- ~~**Hecho cuando:** `npm run build-dataset` genera los JSON y la app arranca con el tema Classic.~~

## ~~Fase 1 — MVP (timer + encuentro + captura)~~ ✅
- ~~Máquina de estados del timer (idle/focusing/paused/completed/break/abandoned) cálculo por timestamps.~~
- ~~Persistencia de `ActiveSession` en Dexie y reconstrucción tras recarga.~~
- ~~Calidad de sesión (pausas, distracciones con Page Visibility API) y validación (≥ 90 %, `minValidMinutes`).~~
- ~~Categorías de tarea por defecto con tipos afines.~~
- ~~Pipeline de recompensas mínimo: XP, monedas, encuentro (§3.3 con firma `applySessionRewards`).~~
- ~~Sistema de rareza y tirada de encuentro (pesos, pity timer, pool por región/afinidad).~~
- ~~Captura: fórmula de probabilidad, 3 lanzamientos, balls, creación de `OwnedCreature` + `DexEntry`.~~
- ~~Pantalla Focus (layout de §9.7) + modal resumen post-sesión + pantalla de encuentro.~~
- ~~Pokédex/Colección básica con grid y filtros.~~
- ~~Export/import JSON con validación Zod y backup previo.~~
- ~~Tests: fórmulas de captura, calidad, pipeline; E2E Playwright de iniciar → completar → capturar.~~
- ~~**Hecho cuando:** completas una sesión, capturas un Pokémon y lo ves en la Pokédex tras recargar.~~

## ~~Fase 2 — Progresión~~ ✅
- ~~XP por sesión con multiplicadores de calidad y racha.~~
- ~~Curvas de nivel por `growth_rate` con `XP_SCALE = 0.05` (tablas erratic/fluctuating incluidas).~~
- ~~Compañero, equipo (máx 6) y amistad (reacciones del sprite).~~
- ~~Evoluciones: normalización de reglas (level/item/friendship/special), ramificadas, confirmación.~~
- ~~Economía: monedas, tienda (balls, pociones, piedras, etc.), inventario.~~
- ~~Rachas con `dayRolloverHour`, escudos e hitos (7/14/30/60/100).~~
- ~~Pantallas: Team, Shop, ajustes de recompensas (`RewardConfig` con presets).~~
- ~~**Hecho cuando:** un Pokémon sube de nivel y evoluciona según §7.5.~~

## Fase 3 — Gimnasios y regiones
- Datos a mano de Kanto (`src/data/regions/kanto.json`: 8 gimnasios + 4 Alto Mando + Campeón).
- Cálculo de daño por minuto de foco (typeMult × levelFactor × qualityMult).
- Progreso de jefe activo, medallas, pantalla de victoria y desbloqueo de jefes.
- Mapa de regiones, desbloqueo de la siguiente región + encuentro especial legendario.
- Gimnasios personalizados vinculados a `Goal` (metas reales).
- **Hecho cuando:** completas un gimnasio y se desbloquea el siguiente jefe.

## Fase 4 — Profundidad
- Huevos: drop, incubadora (máx 3), progreso por minutos de foco, especie oculta.
- Expediciones (tiers 1/2/3) con recompensas y regla de foco vs tiempo de pared.
- Misiones diarias/semanales/historia desde JSON declarativo + pantalla Quests.
- Logros declarativos evaluados al final del pipeline.
- Shiny (`shinyRate`), pity garantizado y shiny por racha de 30 días.
- Modos opcionales: Nuzlocke, Strict focus, casual.
- Estadísticas: heatmap, horas por categoría, gráficos.
- **Hecho cuando:** todas las mecánicas de §7 están implementadas y testeadas.

## Fase 5 — Personalización y pulido
- Themes: Classic, Ocean, Fire, Forest, Dark y Custom (editor con aviso de contraste 4.5:1).
- UI Style: Modern, Retro, Pixel (solo cambios de tokens).
- Fondos, marcos y cosméticos desbloqueables.
- PWA completa: manifest, Workbox, CacheFirst para sprites/cries, aviso de nueva versión.
- Audio (efectos + cries opcionales) y notificaciones locales.
- Accesibilidad: contraste AA, teclado, `role="timer"` con anuncios moderados, `prefers-reduced-motion`.
- i18n (es/en) y atajos de teclado.
- Responsive mobile-first + navegación inferior/lateral.
- Resto de regiones: Johto → Paldea.
- Virtualización de la Pokédex y sprites lazy.
- **Hecho cuando:** instalable, offline, 4+ temas y 3 estilos de UI.

## Fase 6 — Opcional (futuro)
- `OwnCreaturesProvider` con Pokémon y arte propios (§16).
- Empaquetado con Tauri para desktop.
- Backend mínimo para Web Push (VAPID) o sync.
- Multijugador / rankings.

---

## Dependencias críticas
- `build-dataset.ts` bloquea Fase 1 (necesita el dataset para encuentros/capturas).
- Motor puro (`core/`) debe mantenerse sin dependencias de React/Dexie en todas las fases.
- Todas las fórmulas de §7 se implementan con tests unitarios en paralelo a la funcionalidad.
- Regla: ninguna prueba depende de `Date.now()` real ni `Math.random()` (usar FakeClock y Rng con semilla).
