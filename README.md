# pomodex

> Pomodoro / flow timer gamificado. Eres un entrenador: tus sesiones de concentración entrenan a tus Pokémon.

**Focus Trainer** es una herramienta de productividad convertida en un pequeño juego: cada sesión de enfoque completada da XP a tu equipo, monedas, la posibilidad de capturar Pokémon y daño a los jefes de gimnasio. 100 % local, sin cuentas, sin backend, funciona offline.

---

## Características

### Timer (el núcleo)
- **Pomodoro clásico** (25/5, descanso largo tras 4 ciclos), **personalizado** por categoría y **flow** (el timer no se detiene: el overtime da bonus de rareza).
- Cálculo por timestamps, a prueba de segundo plano y recargas: la sesión activa se persiste y se reconcilia al reabrir.
- Calidad de sesión 0–100 (penaliza pausas y cambios de pestaña) que multiplica XP, daño y calidad de la ball obtenida.
- Título de la pestaña con el tiempo restante: `24:13 · Nombre del compañero`.

### Progresión
- **XP y niveles** con curvas clásicas por `growth_rate`, hasta nivel 100.
- **Compañero y equipo** (máx 6): amistad, reacciones del sprite, apodos.
- **Evoluciones** por nivel, piedra, amistad o regla especial (confirmables, con ramas tipo Eevee).
- **Huevos** que eclosionan con minutos de foco reales.
- **Rachas** con día lógico (rollover configurable) y escudos de racha.
- **Economía**: monedas, tienda (balls, pociones, piedras evolutivas, incienso...), inventario.

### Encuentros y colección
- Tras cada sesión completa: **encuentro** con pesos por rareza (common → mythical), pity timer a los 15 y shiny 1/100.
- **Captura** con fórmula de probabilidad real, 3 lanzamientos y animación de sacudidas.
- **Pokédex** con filtros por generación, tipo, rareza y estado (visto/capturado/shiny).
- Afinidad por categoría: estudiar atrae tipos psíquicos, programar atrae eléctricos, etc.

### Gimnasios, medallas y Liga
- 13 jefes por región (8 gimnasios + 4 Alto Mando + Campeón), con HP medido en **minutos de foco**.
- Daño influenciado por tipos del equipo, niveles y calidad de la sesión → conviene armar equipos variados.
- Regiones desbloqueables (Kanto → Paldea) con encuentro legendario al completar la Liga.
- **Gimnasios personalizados**: convierte tus metas reales en jefes con medalla propia.

### Sistemas opcionales
- **Misiones** diarias, semanales y de historia · **Logros** declarativos.
- **Expediciones** idle ligero (1–3 Pokémon, avanzan con foco real).
- **Nuzlocke** (abandonar debilita al compañero) y **Strict focus** (distracciones ×2).

### Personalización
- **Themes**: Classic, Ocean, Fire, Forest, Dark y Custom (editor con aviso de contraste).
- **UI Style**: Modern, Retro y Pixel — solo cambiando tokens CSS.
- Fondos, marcos y cosméticos desbloqueables · idioma español/inglés.

### Técnico
- **PWA instalable**, 100 % offline (Workbox + CacheFirst para sprites/cries).
- Notificaciones locales, audio con cries opcionales, respeto a `prefers-reduced-motion`.
- Export/import de todos los datos en JSON con validación Zod y migraciones versionadas.
- Motor de juego **puro y testeable** (`src/core/`): sin dependencias de React ni Dexie; `Clock` y `Rng` inyectados.

---

## Stack

| Área | Elección |
|---|---|
| Lenguaje | TypeScript (strict) |
| Build | Vite + `vite-plugin-pwa` |
| UI | React 18+ · Zustand · Tailwind CSS |
| Persistencia | IndexedDB (Dexie) · Zod |
| Datos | Snapshot de PokeAPI generado en build |
| Tests | Vitest + Testing Library + Playwright |

---

## Estructura

```
focus-trainer/
├─ scripts/
│  └─ build-dataset.ts       # snapshot desde PokeAPI → JSON
├─ src/
│  ├─ core/                  # timer, rewards, xp, capture, gyms... (TS puro)
│  ├─ data/                  # Dexie, repos, dataset, regions, export
│  ├─ app/                   # stores (Zustand), services, i18n
│  └─ ui/                    # components, pages, themes
├─ tests/
├─ SPECS.md                  # especificación completa
└─ ROADMAP.md                # ruta de trabajo por fases
```

---

## Pantallas

| Ruta | Pantalla |
|---|---|
| `/` | Focus: compañero, timer, progreso, datos del día |
| `/collection` | Pokédex con filtros y ficha detallada |
| `/team` | Equipo, compañero, evolución, liberar |
| `/regions` | Mapa de gimnasios, HP de jefes, medallas, Liga |
| `/quests` | Misiones y logros |
| `/shop` | Tienda e inventario |
| `/eggs` | Incubadora y expediciones |
| `/stats` | Heatmap, horas por categoría, racha |
| `/settings` | Timer, recompensas, temas, datos, modos |

---

## Desarrollo

```bash
npm install
npm run build-dataset   # genera los JSON del dataset (una vez)
npm run dev             # desarrollo
npm run build           # build de producción (PWA)
npm run test            # unit + componentes
npm run test:e2e        # Playwright (flujo del timer)
```

---

## Propiedad intelectual

Pokémon, sus sprites, cries y marcas son propiedad de Nintendo/Game Freak/The Pokémon Company. Este proyecto es **personal y privado**; todo pasa por `CreatureProvider`, de modo que puede sustituirse por Pokémon propios sin tocar el motor. Ver `SPECS.md` §16.
