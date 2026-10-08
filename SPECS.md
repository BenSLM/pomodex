# SPECS.md — Focus Trainer (nombre provisional)

> Pomodoro / flow timer gamificado. Eres un entrenador: tus sesiones de concentración entrenan a tus criaturas.
> Proyecto personal, 100 % local (sin backend). Versión del documento: 0.1

---

## Índice

1. [Visión y alcance](#1-visión-y-alcance)
2. [Decisiones técnicas (stack)](#2-decisiones-técnicas-stack)
3. [Arquitectura](#3-arquitectura)
4. [Fuente de datos de criaturas (PokeAPI + abstracción)](#4-fuente-de-datos-de-criaturas)
5. [Modelo de datos](#5-modelo-de-datos)
6. [Motor del timer](#6-motor-del-timer)
7. [Sistemas de juego](#7-sistemas-de-juego)
8. [Configuración de recompensas](#8-configuración-de-recompensas)
9. [UI / UX](#9-ui--ux)
10. [Personalización y temas](#10-personalización-y-temas)
11. [PWA, notificaciones y audio](#11-pwa-notificaciones-y-audio)
12. [Persistencia, export/import y migraciones](#12-persistencia-exportimport-y-migraciones)
13. [Accesibilidad, i18n y rendimiento](#13-accesibilidad-i18n-y-rendimiento)
14. [Testing](#14-testing)
15. [Roadmap por fases](#15-roadmap-por-fases)
16. [Propiedad intelectual](#16-propiedad-intelectual)
17. [Preguntas abiertas](#17-preguntas-abiertas)

---

## 1. Visión y alcance

### 1.1 Concepto
Cada sesión de enfoque completada es una "ruta explorada": da XP a tus criaturas, monedas, la posibilidad de capturar una criatura nueva y daño a los jefes (líderes de gimnasio). La productividad real es el motor del juego; el juego nunca debe estorbar al timer.

### 1.2 Objetivos
- Timer fiable (Pomodoro clásico, personalizado y flow) como núcleo.
- Progresión a largo plazo: colección, niveles, evoluciones, huevos, rarezas, shinies.
- Metas con peso: gimnasios, medallas, Liga y regiones, ligados opcionalmente a metas reales del usuario.
- Muy personalizable: temas, estilo de UI, compañero, fondos, reglas de recompensa.
- Funciona offline, sin cuentas, con datos exportables.

### 1.3 No objetivos (por ahora)
- Multijugador, ranking online, cuentas, sincronización en la nube.
- Combates por turnos (el "combate" es acumular minutos de foco).
- Monetización o publicación (ver §16).

### 1.4 Principios de diseño
1. **El timer manda.** Ninguna mecánica puede retrasar o romper una sesión en curso.
2. **Recompensa por enfocarse, no por abrir la app.** Nada de XP por tiempo de pantalla.
3. **Reglas transparentes y configurables.** Todo número de balance vive en configuración, no hardcodeado.
4. **Motor puro y testeable.** La lógica de juego no depende de React ni del DOM.

---

## 2. Decisiones técnicas (stack)

| Área | Elección | Motivo |
|---|---|---|
| Lenguaje | TypeScript (strict) | Modelo de datos grande, evita errores de estado |
| Build | Vite | Rápido, soporte PWA |
| UI | React 18+ | Ecosistema, hooks para Dexie |
| Estado de UI | Zustand | Simple, sin boilerplate |
| Persistencia | IndexedDB vía **Dexie** + `dexie-react-hooks` | Estructurado, consultas, más capacidad que localStorage |
| Validación | **Zod** | Validar import/export y datasets |
| Estilos | Tailwind CSS + **CSS variables** como design tokens | Temas dinámicos sin recompilar |
| Animación | CSS + Framer Motion (opcional) | Respeto a `prefers-reduced-motion` |
| PWA | `vite-plugin-pwa` (Workbox) | Offline + instalable |
| Fechas | `date-fns` | Rachas, día lógico |
| Tests | Vitest + Testing Library + Playwright (E2E del timer) | Ver §14 |
| Lint/format | ESLint + Prettier | — |
| Desktop (futuro) | Tauri | Opcional, sin cambios de código grandes |

> Alternativa válida: Svelte/Vue. El motor (`/core`) es independiente del framework, así que cambiar la capa de UI no afecta la lógica.

---

## 3. Arquitectura

### 3.1 Capas

```
┌──────────────────────────────────────────────┐
│ UI (React): pages, components, themes        │
├──────────────────────────────────────────────┤
│ App layer: stores (Zustand), hooks, services │
├──────────────────────────────────────────────┤
│ Core (TS puro): timer, rewards, capture,     │
│ xp, evolution, gyms, quests, rng             │
├──────────────────────────────────────────────┤
│ Data: Dexie repos, CreatureProvider, export  │
└──────────────────────────────────────────────┘
```

Regla: `core/` **no importa** React, Dexie ni `window`. Recibe estado y configuración, devuelve estado nuevo + resumen de recompensas. El tiempo (`Clock`) y la aleatoriedad (`Rng`) se inyectan.

### 3.2 Estructura de carpetas

```
focus-trainer/
├─ public/
│  └─ icons/                 # iconos PWA
├─ scripts/
│  └─ build-dataset.ts       # genera snapshot desde PokeAPI (ver §4)
├─ src/
│  ├─ core/
│  │  ├─ clock.ts            # interface Clock + SystemClock + FakeClock
│  │  ├─ rng.ts              # PRNG con semilla (mulberry32)
│  │  ├─ timer/              # máquina de estados del timer
│  │  ├─ rewards/            # pipeline de recompensas
│  │  ├─ capture.ts
│  │  ├─ xp.ts
│  │  ├─ evolution.ts
│  │  ├─ eggs.ts
│  │  ├─ gyms.ts
│  │  ├─ quests.ts
│  │  ├─ achievements.ts
│  │  ├─ economy.ts
│  │  ├─ streak.ts
│  │  └─ types.ts            # tipos de dominio
│  ├─ data/
│  │  ├─ db.ts               # esquema Dexie
│  │  ├─ repos/              # acceso a tablas
│  │  ├─ providers/
│  │  │  ├─ CreatureProvider.ts
│  │  │  ├─ PokeApiProvider.ts
│  │  │  └─ OwnCreaturesProvider.ts
│  │  ├─ dataset/            # JSON generados (creatures, types, evolutions)
│  │  ├─ regions/            # kanto.json, johto.json ... (gimnasios a mano)
│  │  └─ export.ts           # export/import + Zod schemas
│  ├─ app/
│  │  ├─ stores/             # timerStore, settingsStore, uiStore
│  │  ├─ services/           # notifications, audio, visibility
│  │  └─ i18n/               # es.json, en.json
│  ├─ ui/
│  │  ├─ components/         # Button, Panel, ProgressBar, TypeBadge...
│  │  ├─ pages/              # Focus, Collection, Team, Regions, Quests, Shop, Stats, Settings
│  │  └─ themes/             # tokens.css, themes/*.css, styles/*.css
│  ├─ main.tsx
│  └─ sw.ts
├─ tests/
├─ SPECS.md
└─ package.json
```

### 3.3 Flujo de eventos (pipeline de recompensas)

Cuando una sesión termina se genera un `SessionRecord` y se ejecuta un pipeline **determinista y ordenado**:

```
SessionRecord
  → 1. validar sesión (mínimos, calidad)
  → 2. XP a compañero y equipo
  → 3. monedas
  → 4. daño al jefe activo (gimnasio)
  → 5. progreso de huevos
  → 6. racha del día
  → 7. misiones
  → 8. logros
  → 9. generar encuentro (si aplica)
  → RewardSummary (se muestra en un modal post-sesión)
```

Firma de referencia:

```ts
function applySessionRewards(
  state: GameState,
  session: SessionRecord,
  config: RewardConfig,
  deps: { rng: Rng; clock: Clock; dataset: Dataset }
): { state: GameState; summary: RewardSummary };
```

El resultado se persiste en **una sola transacción de Dexie** para no dejar el guardado a medias.

---

## 4. Fuente de datos de criaturas

### 4.1 Problema
- PokeAPI **no incluye** datos de líderes de gimnasio, Alto Mando ni medallas. Eso se define a mano (§7.9).
- Llamar a la API en cada pantalla es lento y poco respetuoso con el servicio.
- Más adelante podrías querer criaturas propias (§16).

### 4.2 Estrategia: snapshot en build + abstracción

1. **`scripts/build-dataset.ts`** descarga una vez desde PokeAPI y genera JSON compactos en `src/data/dataset/`:
   - `creatures.json`: especies con los campos mínimos (abajo).
   - `types.json`: matriz de efectividad 18×18.
   - `evolutions.json`: cadenas normalizadas.
2. En runtime solo se descargan **sprites y cries** (lazy), y el Service Worker los cachea.
3. La app consume todo mediante una interfaz `CreatureProvider`, así se puede cambiar por criaturas propias sin tocar el resto.

Campos a extraer por especie:

| Campo | Endpoint | Uso |
|---|---|---|
| `id`, `name`, `names.es` | `pokemon-species` | Identidad y nombre en español |
| `capture_rate` | `pokemon-species` | Probabilidad de captura |
| `base_happiness` | `pokemon-species` | Amistad inicial |
| `hatch_counter` | `pokemon-species` | Duración de huevo |
| `growth_rate.name` | `pokemon-species` | Curva de XP |
| `is_legendary`, `is_mythical`, `is_baby` | `pokemon-species` | Rareza |
| `flavor_text_entries` (es/en) | `pokemon-species` | Descripción en Pokédex |
| `generation` | `pokemon-species` | Región/pool |
| `evolution_chain.url` | `pokemon-species` | Evoluciones |
| `types[]` | `pokemon` | Tipos, afinidad, daño a jefes |
| `stats[]` → BST | `pokemon` | Rareza "épica" (pseudo-legendarios) |
| `base_experience` | `pokemon` | Ajuste fino de XP (opcional) |
| `sprites` (URLs) | `pokemon` | Imagen normal/shiny/animada |
| `cries.latest` | `pokemon` | Audio |

> Nota: los sprites **animados** de PokeAPI solo existen hasta la generación 5 (`versions['generation-v']['black-white'].animated`). Para el resto se usa el sprite estático o el artwork oficial. El compañero animado puede resolverse con animación CSS (rebote, parpadeo) sobre el sprite estático.

### 4.3 Interfaz

```ts
interface CreatureProvider {
  getAll(): Promise<CreatureSpecies[]>;
  getById(id: number): Promise<CreatureSpecies>;
  getSpriteUrl(id: number, opts: { shiny?: boolean; animated?: boolean }): string;
  getCryUrl(id: number): string | null;
}

interface CreatureSpecies {
  id: number;
  slug: string;
  name: { es: string; en: string };
  types: TypeId[];                 // 1 o 2
  captureRate: number;             // 3–255
  baseHappiness: number;
  hatchCounter: number;
  growthRate: GrowthRate;
  rarity: Rarity;                  // derivada, ver §7.3
  bst: number;
  generation: number;
  flavor: { es?: string; en?: string };
  evolutionChainId: number;
}
```

### 4.4 Reglas de uso de PokeAPI
- Usar solo en `scripts/` (build) y para sprites/cries en runtime.
- Cachear con Cache Storage (estrategia `CacheFirst`, expiración larga).
- Pausa de ~100 ms entre llamadas en el script y reintentos con backoff.

---

## 5. Modelo de datos

### 5.1 Entidades (TypeScript)

```ts
type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythical';
type TypeId = 'normal'|'fire'|'water'|'electric'|'grass'|'ice'|'fighting'|'poison'|
              'ground'|'flying'|'psychic'|'bug'|'rock'|'ghost'|'dragon'|'dark'|'steel'|'fairy';
type GrowthRate = 'fast'|'medium-fast'|'medium'|'medium-slow'|'slow'|'erratic'|'fluctuating';

interface Profile {
  id: 'me';
  trainerName: string;
  createdAt: number;           // epoch ms
  coins: number;
  totalFocusMinutes: number;
  totalSessions: number;
  companionId: string | null;  // OwnedCreature.id
  teamIds: string[];           // máx 6
  currentRegion: RegionId;
  schemaVersion: number;
}

interface OwnedCreature {
  id: string;                  // uuid
  speciesId: number;
  nickname?: string;
  level: number;               // 1–100
  xp: number;                  // XP total acumulada
  shiny: boolean;
  friendship: number;          // 0–255
  caughtAt: number;
  caughtWith: BallId;
  categoryId?: string;         // categoría donde se capturó
  faintedUntil?: number;       // modo Nuzlocke
  onExpeditionId?: string;
}

interface DexEntry {
  speciesId: number;
  seen: boolean;
  caught: boolean;
  shinyCaught: boolean;
  firstSeenAt?: number;
  firstCaughtAt?: number;
}

interface Category {            // categoría de tarea definida por el usuario
  id: string;
  name: string;
  icon: string;
  color: string;
  affinityTypes: TypeId[];      // tipos que atrae
}

interface SessionRecord {
  id: string;
  categoryId: string;
  goalId?: string;
  mode: 'pomodoro' | 'flow';
  plannedMs: number;
  focusedMs: number;            // tiempo efectivo (sin pausas)
  startedAt: number;
  endedAt: number;
  pauseCount: number;
  distractionCount: number;
  quality: number;              // 0–100
  outcome: 'completed' | 'abandoned';
  note?: string;
}

interface ActiveSession {       // sesión en curso (persistida para sobrevivir recargas)
  id: string;
  state: 'focusing' | 'paused' | 'break';
  categoryId: string;
  goalId?: string;
  mode: 'pomodoro' | 'flow';
  plannedMs: number;
  startedAt: number;
  pausedAt?: number;
  pausedAccumulatedMs: number;
  pauseCount: number;
  distractionCount: number;
}

interface Egg {
  id: string;
  speciesId: number;            // oculta al usuario hasta eclosionar
  requiredMinutes: number;
  progressMinutes: number;
  obtainedFrom: 'drop' | 'quest' | 'streak' | 'shop' | 'achievement';
}

interface Encounter {            // encuentro pendiente tras una sesión
  id: string;
  speciesId: number;
  shiny: boolean;
  level: number;
  throwsLeft: number;           // por defecto 3
  expiresAt: number;            // desaparece si no se resuelve (config)
}

interface Inventory {
  balls: Record<BallId, number>;
  items: Record<ItemId, number>; // potion, revive, incense, streakShield, stones...
}

interface GymProgress {
  region: RegionId;
  bossId: string;
  damageMinutes: number;         // minutos de "daño" acumulados
  defeatedAt?: number;
}

interface Goal {                 // meta real vinculable a un gimnasio personalizado
  id: string;
  name: string;
  categoryId?: string;
  targetMinutes: number;
  progressMinutes: number;
  rewardBadge?: string;
  completedAt?: number;
}

interface Expedition {
  id: string;
  creatureIds: string[];
  tier: 1 | 2 | 3;
  requiredFocusMinutes: number;
  progressMinutes: number;
  startedAt: number;
  claimed: boolean;
}

interface QuestInstance {
  id: string;
  templateId: string;
  period: 'daily' | 'weekly' | 'story';
  progress: number;
  target: number;
  resetAt?: number;
  claimed: boolean;
}

interface Settings {
  locale: 'es' | 'en';
  timer: TimerSettings;
  theme: ThemeSettings;
  rewards: RewardConfig;          // ver §8
  modes: { nuzlocke: boolean; strictFocus: boolean; flowTimer: boolean };
  notifications: { enabled: boolean; sound: boolean };
  dayRolloverHour: number;        // 0–23, por defecto 4
}
```

### 5.2 Esquema Dexie

```ts
db.version(1).stores({
  profile:      'id',
  creatures:    'id, speciesId, caughtAt',
  dex:          'speciesId',
  sessions:     'id, startedAt, categoryId, outcome',
  activeSession:'id',
  categories:   'id',
  eggs:         'id',
  encounters:   'id',
  inventory:    'id',
  gymProgress:  '[region+bossId]',
  goals:        'id',
  expeditions:  'id',
  quests:       'id, period',
  achievements: 'id',
  settings:     'id',
  meta:         'key'
});
```

### 5.3 Reglas de integridad
- Máximo 1 `ActiveSession` a la vez.
- Máximo 6 criaturas en `teamIds` y el compañero debe estar en el equipo.
- Una criatura en expedición no puede ser compañera.
- XP total es la fuente de verdad; el nivel se **deriva** de la XP (y se cachea).

---

## 6. Motor del timer

### 6.1 Máquina de estados

```
idle ──start──▶ focusing ◀──resume── paused
                  │  ▲                 ▲
                  │  └──────pause──────┘
                  ├──complete──▶ completed ──▶ break ──▶ idle
                  └──abandon───▶ abandoned ──▶ idle
```

### 6.2 Cálculo del tiempo (a prueba de segundo plano)
- **Nunca** contar con `setInterval` acumulando segundos.
- Guardar `startedAt`, `pausedAccumulatedMs`, `pausedAt`.
- `elapsed = (pausedAt ?? now) - startedAt - pausedAccumulatedMs`.
- `setInterval`/`requestAnimationFrame` solo sirve para **repintar**; la verdad es el cálculo anterior.
- La sesión activa se guarda en IndexedDB en cada transición. Al recargar, se reconstruye y, si ya pasó `plannedMs`, se completa automáticamente con `endedAt = startedAt + pausedAcc + plannedMs`.
- Título de la pestaña: `24:13 · Nombre del compañero`.

### 6.3 Modos
| Modo | Comportamiento |
|---|---|
| Pomodoro | 25/5, descanso largo de 15 tras 4 ciclos. Todo configurable (10–120 min foco). |
| Personalizado | Preset guardado por categoría. |
| Flow | Al llegar a la meta el timer **no se detiene**; sigue en "overtime" hasta que el usuario termine. El tiempo extra suma un bonus de rareza (§7.3). |

### 6.4 Validez de una sesión
- `completed`: `focusedMs ≥ 90 %` de `plannedMs` (o en flow, ≥ meta).
- `abandoned`: el usuario pulsa Abandonar, o cierra con menos del 90 %.
- Sesión menor a `minValidMinutes` (por defecto 10) no da encuentro ni cuenta para racha.
- Opcional: crédito parcial por abandono (`abandonCreditRatio`, por defecto 0).

### 6.5 Calidad de sesión (0–100)
Empieza en 100:
- −10 por pausa (máx −30).
- −5 por distracción (pérdida de foco de pestaña > 10 s, detectada con Page Visibility API), máx −30.
- Con `strictFocus` activado, las distracciones restan el doble.

| Calidad | Etiqueta | Efecto |
|---|---|---|
| ≥ 90 | Perfecta | Ball superior + bonus XP |
| 60–89 | Buena | Estándar |
| < 60 | Floja | Sin bonus |

### 6.6 Descansos
Durante el descanso se muestra el **panel de descanso** con acciones: resolver encuentro, dar una baya al compañero (+amistad), ver huevos, revisar el equipo. El descanso es opcional y se puede saltar.

---

## 7. Sistemas de juego

> Todas las cifras son valores por defecto de `RewardConfig` (§8) y se pueden cambiar.

### 7.1 Experiencia y niveles

- XP por sesión: `xp = focusedMinutes × xpPerMinute × qualityMult × streakMult`
  - `xpPerMinute = 10`
  - `qualityMult`: Perfecta 1.25, Buena 1.0, Floja 0.8
  - `streakMult = min(1 + 0.02 × streakDays, 1.5)`
- Reparto: compañero 100 %, resto del equipo 25 %.
- Curva por `growth_rate` (fórmulas clásicas, `n` = nivel), multiplicadas por `XP_SCALE = 0.05` para que 100 niveles sean alcanzables:

| Growth rate | XP total para nivel n (antes de escala) |
|---|---|
| fast | 4n³ / 5 |
| medium-fast | n³ |
| medium-slow | 6n³/5 − 15n² + 100n − 140 |
| slow | 5n³ / 4 |
| erratic / fluctuating | Tablas por tramos (implementar según referencia de PokeAPI/Bulbapedia) |

- Referencia de ritmo: nivel 50 ≈ 6 250 XP (~25 sesiones de 25 min). Nivel 100 ≈ 50 000 XP (~80–90 h de foco para una criatura `medium-fast`).
- Nivel máximo 100. Opcional futuro: "estrellas de maestría" tras el 100.

### 7.2 Compañero y amistad
- Compañero = criatura activa en pantalla principal.
- Amistad +1 por cada día en que fue compañero y hubo ≥ 1 sesión válida; +3 por baya; −5 si abandonas con ella como compañera.
- Reacciones del sprite: alegre (completar), triste (abandonar), dormida (inactividad > 24 h), celebrando (subida de nivel/evolución).

### 7.3 Rareza y encuentros

**Derivación de rareza** (calculada en el script de dataset):

| Rareza | Regla |
|---|---|
| mythical | `is_mythical` |
| legendary | `is_legendary` |
| epic | no legendaria y (`bst ≥ 580` o `captureRate ≤ 45`) |
| rare | `captureRate` 46–119 |
| uncommon | `captureRate` 120–189 |
| common | `captureRate ≥ 190` |

**Pesos base de encuentro** (tras sesión completada):

| Rareza | Peso |
|---|---|
| common | 55 |
| uncommon | 28 |
| rare | 12 |
| epic | 4.5 |
| legendary | 0.4 |
| mythical | 0.1 |

Modificadores:
- Sesión Perfecta: pesos de `rare+` × 1.5.
- Flow: por cada 10 min de overtime, pesos de `rare+` × 1.15 (máx × 2).
- Incienso: +100 % a `rare+` durante 5 encuentros.
- **Pity timer:** si pasan 15 encuentros sin un `rare+`, el siguiente garantiza uno.
- **Legendarios/míticos**: además de la tirada, se desbloquean como **encuentros especiales** garantizados al derrotar la Liga de una región o ciertos logros (el pool de la región define cuáles).

**Pool de especies:**
1. Se filtra por regiones desbloqueadas (generaciones ≤ región actual; configurable).
2. **Afinidad de categoría:** 60 % de las tiradas salen del pool de tipos de la categoría de la sesión; 40 % del pool general.
3. Las criaturas ya evolucionadas no aparecen salvajes salvo rareza ≥ `rare` (configurable). Las etapas bebé sí.

**Shiny:** `shinyRate = 1/100` por defecto (configurable). Se garantiza un shiny al alcanzar una racha de 30 días (una vez por hito).

**Encuentro pendiente:** si el usuario no lo resuelve, expira en `encounterTtlHours` (por defecto 24 h) y la criatura "huye" (se marca como vista).

### 7.4 Captura

Poké Balls y multiplicadores:

| Ball | Mult. | Cómo se obtiene |
|---|---|---|
| Poké Ball | 1.0 | Tienda / sesión Floja |
| Great Ball | 1.5 | Tienda / sesión Buena |
| Ultra Ball | 2.0 | Tienda / sesión Perfecta |
| Master Ball | ∞ (100 %) | Solo logros/recompensas únicas |

Una sesión completada da 1 ball según calidad (Floja → Poké, Buena → Great, Perfecta → Ultra) además de las compradas.

Probabilidad por lanzamiento:

```
base = 0.10 + 0.80 × (captureRate / 255)
p    = min(0.98, base × ballMult)
```

Ejemplos con Poké Ball: común (255) 90 %; rara (75) ~34 %; legendaria (3) ~11 %. Con Ultra Ball suben a 98 %, ~68 % y ~22 %.

- 3 lanzamientos por encuentro (configurable). Si fallan todos, huye.
- Se muestra animación de sacudidas (1–3) según `p` para dar sensación de cercanía.
- Captura exitosa → se crea `OwnedCreature` (nivel inicial = aleatorio 3–10, o por región), `DexEntry.caught = true`.
- Duplicados: se aceptan (para equipo/expediciones). Opción de "liberar" a cambio de monedas/caramelos (+ XP al compañero).

### 7.5 Evoluciones

Normalizar `evolution_details` de PokeAPI a reglas simples:

```ts
type EvolutionRule =
  | { kind: 'level'; level: number }
  | { kind: 'item'; itemId: ItemId }            // piedras
  | { kind: 'friendship'; min: number }
  | { kind: 'special'; fallbackLevel: number }; // trade, ubicación, hora, movimiento...
```

- `level` → evoluciona al alcanzar el nivel.
- `item` → requiere piedra (se compra o se obtiene con rachas/misiones).
- `friendship` → amistad ≥ 220.
- `trade`, `location`, `time-of-day`, `known-move`, etc. → **simplificado** a `special` con `fallbackLevel` (por defecto nivel 36 o un objeto "Núcleo evolutivo").
- Ramificadas (Eevee, Tyrogue): el usuario elige entre opciones disponibles; cada rama indica su requisito.
- La evolución es **confirmable**: aparece aviso y el usuario decide (se puede cancelar).
- Al evolucionar se conservan nivel, XP, amistad, shiny y apodo.

### 7.6 Huevos

- Fuentes: drop aleatorio (10 % por sesión), misiones, hitos de racha, tienda.
- `requiredMinutes = hatchCounter × 5` (ej.: `hatchCounter 20` → 100 min ≈ 4 pomodoros; `120` → 600 min).
- Solo avanzan con minutos de foco válido.
- Máximo 3 huevos en incubadora.
- Especie del huevo: tirada al **obtener** el huevo (guardada pero oculta), con pesos sesgados a especies "bebé" y raras.

### 7.7 Economía

Monedas por sesión: `coins = round(focusedMinutes / 25 × 10 × qualityMult)`.

Tienda (precios por defecto):

| Ítem | Precio | Efecto |
|---|---|---|
| Poké Ball | 20 | Ball estándar |
| Great Ball | 50 | ×1.5 |
| Ultra Ball | 120 | ×2.0 |
| Poción | 40 | Recupera una criatura debilitada (modo Nuzlocke) |
| Revivir | 120 | Revive instantáneamente |
| Escudo de racha | 150 | Protege la racha un día perdido (máx 2) |
| Incienso | 200 | Más rareza por 5 encuentros |
| Baya | 15 | +amistad al compañero |
| Piedra evolutiva | 300 | Para evoluciones por objeto |
| Huevo | 250 | Huevo aleatorio |
| Cosméticos | variable | Temas, fondos, marcos (§10) |

### 7.8 Rachas
- Un día cuenta si hay ≥ `streakMinMinutes` (por defecto 25) de foco válido.
- El "día" cambia a las `dayRolloverHour` (por defecto 04:00 local).
- Perder un día reinicia la racha, salvo que haya Escudo de racha (se consume).
- Hitos: 7, 14, 30, 60, 100 días → recompensas (huevo, shiny garantizado a los 30, ítems).

### 7.9 Gimnasios, medallas, Liga y regiones

**Datos:** `src/data/regions/<region>.json` (escritos a mano, PokeAPI no los trae).

```ts
interface Region {
  id: RegionId;                // 'kanto' | 'johto' | 'hoenn' | 'sinnoh' | 'unova' | 'kalos' | 'alola' | 'galar' | 'paldea'
  name: string;
  generation: number;
  unlockRequires?: RegionId;   // región previa completada
  bosses: Boss[];              // 8 gimnasios + 4 Alto Mando + 1 Campeón = 13
}

interface Boss {
  id: string;
  kind: 'gym' | 'elite4' | 'champion';
  order: number;
  name: string;
  badge?: string;
  types: TypeId[];             // tipo(s) principal(es)
  hpMinutes: number;
  recommendedLevel: number;
  sprite?: string;             // propio, ver §16
  rewards: { coins: number; items?: Record<ItemId, number>; specialEncounter?: number };
}
```

**9 hitos por región:** 8 medallas + Trofeo de la Liga (completar Alto Mando + Campeón).

**HP del jefe (minutos de foco):** gimnasio *i* = `120 + 40 × (i − 1)` (120 → 400). Alto Mando = 420, 440, 460, 480. Campeón = 600. Total por región ≈ 4 480 min (~75 h). Multiplicador global `regionPace` para ajustar.

**Daño por minuto de foco:**

```
damagePerMin = typeMult × levelFactor × qualityMult
typeMult    = clamp( mejor efectividad de tipo entre el equipo vs tipos del jefe , 0.5 , 2.0 )
levelFactor = clamp( nivelMedioEquipo / recommendedLevel , 0.6 , 1.2 )
qualityMult = Perfecta 1.2 · Buena 1.0 · Floja 0.8
```

- La efectividad de cada criatura = producto de la matriz de tipos de sus tipos atacantes contra los tipos del jefe (jefe dual: se multiplican).
- El equipo "juega" con el mejor atacante, así conviene armar equipos variados.
- El daño se aplica **al terminar la sesión**; el progreso persiste entre días.
- Solo hay un jefe activo a la vez (el siguiente en orden), pero se puede cambiar de jefe disponible sin perder progreso.
- Derrotar al jefe: medalla, monedas, ítems, pantalla de victoria.
- Región completa → desbloquea la siguiente + encuentro especial (legendario) + pool ampliado.

**Gimnasios personalizados (metas reales):**
- El usuario crea un `Goal` ("Terminar módulo 3 del curso", 600 min, categoría Estudio).
- Se renderiza como un gimnasio propio con tipo elegido, medalla personalizada y HP = `targetMinutes`.
- Las sesiones etiquetadas con la meta le restan HP.

### 7.10 Categorías de tarea → tipos

Categorías por defecto (editables):

| Categoría | Tipos que atrae |
|---|---|
| Estudiar | psychic, normal |
| Programar | electric, steel |
| Ejercicio | fighting, fire |
| Leer | fairy, normal |
| Escribir / crear | fairy, ghost |
| Trabajo profundo | dragon, dark |
| Idiomas | flying, water |
| Hogar / otros | grass, ground |

Efectos: filtro de encuentros (§7.3) y estadísticas por categoría ("tu colección refleja en qué inviertes tu tiempo").

### 7.11 Expediciones (idle ligero)

- El usuario envía 1–3 criaturas a explorar. Tiers: 1 (60 min), 2 (180 min), 3 (480 min) de **foco real**.
- Avanzan con minutos de foco válido (no con tiempo de pared), para no premiar la ausencia (configurable: `expeditionsUseWallClock`).
- Recompensas: monedas, caramelos de XP, bayas, piedras (tier 3), huevo (probabilidad baja).
- Criaturas en expedición no cuentan como equipo ni compañero.

### 7.12 Misiones

Plantillas diarias (3 al azar) y semanales (2):

- "Completa 3 pomodoros" · "Enfoca 90 minutos en Estudio" · "Captura una criatura tipo Agua".
- Semanales: "5 días con al menos una sesión" · "Eclosiona un huevo".
- Historia: ligadas a regiones ("Derrota al primer líder").

Se definen en JSON declarativo:

```ts
interface QuestTemplate {
  id: string;
  period: 'daily' | 'weekly' | 'story';
  metric: 'sessions' | 'focusMinutes' | 'captures' | 'captureType' | 'hatch' | 'streakDays';
  filter?: { categoryId?: string; type?: TypeId };
  target: number;
  reward: { coins?: number; items?: Record<string, number>; egg?: boolean };
}
```

### 7.13 Logros
Declarativos, evaluados al final del pipeline. Ejemplos: 10/50/100/500 h totales, 7/30/100 días de racha, completar Pokédex de una generación, primer shiny, capturar un legendario, derrotar las 9 hitos de una región, sesiones perfectas × 20.

### 7.14 Modos opcionales
- **Nuzlocke:** abandonar una sesión debilita al compañero durante `faintDays` (por defecto 2). Una criatura debilitada no gana XP ni aporta daño. Se cura con Revivir/Poción o esperando.
- **Strict focus:** distracciones penalizan el doble y cambiar de pestaña > 30 s abandona la sesión.
- **Sin penalizaciones (casual):** abandonar no tiene consecuencias.

---

## 8. Configuración de recompensas

Todos los valores de balance viven en un único objeto con presets.

```ts
interface RewardConfig {
  preset: 'casual' | 'normal' | 'hardcore' | 'custom';
  xpPerMinute: number;            // 10
  xpScale: number;                // 0.05
  teamXpShare: number;            // 0.25
  coinsPer25min: number;          // 10
  minValidMinutes: number;        // 10
  completionThreshold: number;    // 0.9
  abandonCreditRatio: number;     // 0
  shinyRate: number;              // 0.01
  encounterChance: number;        // 1.0 (por sesión completada)
  encounterTtlHours: number;      // 24
  throwsPerEncounter: number;     // 3
  eggDropChance: number;          // 0.10
  pityThreshold: number;          // 15
  regionPace: number;             // 1.0
  streakMinMinutes: number;       // 25
  qualityMult: { perfect: number; good: number; poor: number };
  rarityWeights: Record<Rarity, number>;
}
```

| Preset | Diferencias |
|---|---|
| casual | Sin penalización por abandono, `regionPace` 0.7, `shinyRate` 1/50 |
| normal | Valores por defecto |
| hardcore | Nuzlocke ON, `regionPace` 1.5, `shinyRate` 1/400, `throwsPerEncounter` 2 |

La pantalla de ajustes permite editar cada valor con descripción, y botón "restablecer". Cambiar el preset **no** reescribe el historial.

---

## 9. UI / UX

### 9.1 Dirección visual
- Inspiración: Pokémon moderno + RPG/HUD, **sin copiar** interfaz, sprites ni branding oficial.
- Debe sentirse como una **herramienta de productividad convertida en un pequeño juego**.
- Base neutra; colores fuertes solo como acentos y estados.

### 9.2 Paleta base (design tokens)

| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#F5F5F0` | Fondo de página |
| `--surface` | `#FFFFFF` | Paneles |
| `--primary` | `#3C5AA6` | Acciones principales |
| `--secondary` | `#2A75BB` | Acciones secundarias, enlaces |
| `--accent` | `#FFCB05` | Resaltados, recompensas |
| `--accent-dark` | `#C7A008` | Bordes/estado sobre amarillo |
| `--text` | `#242424` | Texto principal |
| `--muted` | `#6B7280` | Texto secundario |
| `--border` | `#D8D8D8` | Bordes |
| `--success` | `#2E9E5B` | Éxito (propuesto) |
| `--danger` | `#D64545` | Error/abandono (propuesto) |

Notas de contraste (verificar con una herramienta WCAG antes de fijar):
- Texto sobre `--accent` (amarillo) debe ser **oscuro** (`--text`), nunca blanco.
- `--muted` sobre `--bg` está cerca del límite AA; usarlo solo para texto secundario ≥ 14 px.
- Modo oscuro: tema adicional propuesto (§10), no incluido en la paleta original.

### 9.3 Colores por tipo

Usados en categorías, insignias de tipo, fondos de tarjetas y estados. Siempre acompañados de **icono + texto**.

| Tipo | Color sugerido |
|---|---|
| Fire | `#E4572E` |
| Water | `#3B82C4` |
| Grass | `#4CAF50` |
| Electric | `#F2C300` |
| Psychic | `#E85D9B` |
| Ghost | `#6B4E9B` |
| Dragon | `#4A5BC7` |
| Fairy | `#F4A6C8` |
| (resto) | Definir los 18 tipos en `tokens.css` como `--type-<id>` |

### 9.4 Tipografía

| Rol | Fuente |
|---|---|
| Headings | **Fredoka** Bold |
| UI / cuerpo | **Nunito** |
| Timer y números | **JetBrains Mono** (`font-variant-numeric: tabular-nums`) |
| Estilo Pixel (opcional) | *Press Start 2P* o *Silkscreen* en títulos |

Autoalojar las fuentes (no depender de CDN) para que funcione offline.

### 9.5 Reglas de componentes
- Paneles claramente separados, **borde visible** (1–2 px), radio moderado (`--radius: 12px`).
- Sombra ligera (`0 2px 0 rgba(0,0,0,.08)` o similar) para profundidad.
- Botones con estados `hover`, `active/pressed` (desplazamiento 1–2 px), `focus-visible` y `disabled` claros.
- Evitar glassmorphism excesivo, neón y gradientes fuertes.
- Iconos + texto siempre; no depender solo del color para transmitir estado.
- Componentes base: `Button`, `Panel`, `ProgressBar` (XP/HP/sesión), `TypeBadge`, `RarityBadge`, `StatBar`, `Modal`, `Tabs`, `Tooltip`, `CreatureCard`, `Toast`.

### 9.6 Pantallas

| Ruta | Pantalla | Contenido clave |
|---|---|---|
| `/` | **Focus (principal)** | Compañero, nivel + XP, timer, progreso, acciones, datos del día |
| `/collection` | Pokédex/Colección | Grid con filtros (generación, tipo, rareza, capturados/vistos), ficha detallada |
| `/team` | Equipo | 6 slots, compañero, apodos, evolución, liberar |
| `/regions` | Mapa / Gimnasios | Región actual, jefes, barra de HP, medallas, Liga |
| `/quests` | Misiones y logros | Diarias, semanales, historia, logros |
| `/shop` | Tienda e inventario | Compra, uso de ítems, cosméticos |
| `/eggs` | Huevos y expediciones | Incubadora, expediciones activas |
| `/stats` | Estadísticas | Heatmap estilo GitHub, horas por categoría, racha, gráficos |
| `/settings` | Ajustes | Timer, recompensas, temas, datos (export/import), modos |

### 9.7 Pantalla principal (Focus) — estructura

```
┌───────────────────────────────────────────────────────────┐
│ ▣ Focus Trainer      🔥 Racha 12   🪙 340   🎒   ⚙         │
├──────────────────────────────┬────────────────────────────┤
│                              │  HOY                       │
│        [ Compañero ]         │  XP       +420             │
│       Nv. 24 · Pikachu*      │  Sesiones  4               │
│   XP ▓▓▓▓▓▓▓░░░  1 820/2 400 │  Enfoque   1 h 40 min      │
│                              │  ───────────────────────   │
│          24:13               │  Jefe activo: Brock        │
│  Sesión  ▓▓▓▓▓▓░░░░ 3/4      │  HP ▓▓▓▓▓░░░░ 62/120 min   │
│                              │  ───────────────────────   │
│  Categoría: [Estudiar ▾]     │  Misiones                  │
│  [ ▶ Start ] [ ⏸ Pause ] [ ■ Finish ] │ ✓ 3 pomodoros 2/3  │
└──────────────────────────────┴────────────────────────────┘
```
*Imagen de ejemplo; el sprite real depende del provider.*

Elementos obligatorios: criatura protagonista, nivel + barra XP, timer grande, progreso de sesión, acciones Start/Pause/Finish, datos del día (XP, sesiones, tiempo enfocado).

### 9.8 Flujo post-sesión
1. Modal **Resumen de recompensas** (XP, monedas, daño, huevo, misión, racha) con animación breve y botón "Continuar".
2. Si hay encuentro: pantalla de **Encuentro** (criatura, rareza, selector de ball, lanzar).
3. Si hay evolución disponible: aviso confirmable.
4. Inicio del descanso (con botón "Saltar descanso").

### 9.9 Estados y feedback
- Estados vacíos con ilustración y siguiente acción clara ("Aún no tienes huevos").
- Toasts para eventos menores, modales solo para decisiones/hitos.
- Animaciones cortas (< 400 ms) y desactivables.

### 9.10 Responsive
- Mobile first (≥ 360 px): layout de una columna, barra de navegación inferior.
- Desktop (≥ 1024 px): dos columnas en Focus, navegación lateral.
- Objetivos táctiles ≥ 44 px.

### 9.11 Atajos de teclado (desktop)
`Espacio` start/pausa · `Esc` abandonar (con confirmación) · `1–9` cambiar de pantalla · `?` ayuda.

---

## 10. Personalización y temas

La personalización es **parte central**. Todo se implementa con CSS variables sobre `<html data-theme="…" data-ui="…">`.

### 10.1 Themes
| Theme | Acentos |
|---|---|
| Classic | Azul/amarillo (paleta base) |
| Ocean | Azules/turquesas |
| Fire | Rojos/naranjas |
| Forest | Verdes/tierra |
| Dark (propuesto) | Fondo oscuro, mismos acentos |
| Custom | El usuario edita colores clave (primary, accent, bg, surface) con color picker; se guarda en `Settings.theme.custom` |

Validación: el editor de tema Custom muestra un aviso si el contraste texto/fondo baja de 4.5:1.

### 10.2 UI Style

| Estilo | Radio | Bordes | Fuente títulos | Extras |
|---|---|---|---|---|
| Modern | 12 px | 1 px | Fredoka | Sombras suaves |
| Retro | 6 px | 2 px | Fredoka | Bordes marcados, sombras duras |
| Pixel | 0 | 3 px | Pixel font | `image-rendering: pixelated`, esquinas escalonadas, sin sombras blandas |

Se implementan cambiando tokens (`--radius`, `--border-width`, `--font-heading`, `--shadow`), no duplicando componentes.

### 10.3 Otros ajustes
- Compañero elegible entre las criaturas del equipo.
- Fondos (patrones y escenas por región) desbloqueables con monedas/logros.
- Marcos de tarjeta y estilos de barra de progreso desbloqueables.
- Sistema de recompensas configurable (§8).
- Idioma: español / inglés.

---

## 11. PWA, notificaciones y audio

### 11.1 PWA
- Manifest con nombre, iconos (192/512, maskable), `display: standalone`, colores del tema.
- Service Worker (Workbox): precache del app shell + dataset; `CacheFirst` para sprites/cries; actualización con aviso "Nueva versión disponible".
- Funciona 100 % offline una vez cargada.

### 11.2 Notificaciones (limitación importante)
- La `Notification API` permite avisar al terminar la sesión **mientras la app/pestaña siga abierta**, aunque esté en segundo plano.
- **Sin backend no se puede enviar push con la app completamente cerrada.** El navegador no garantiza ejecutar temporizadores locales cuando se cierra.
- Mitigaciones: instalar como PWA y mantenerla abierta; sonido de fin de sesión; título de pestaña con el tiempo; al reabrir, reconciliar el estado con timestamps (§6.2) y mostrar "Tu sesión terminó hace X min".
- Si algún día se quiere push real: añadir un backend mínimo (Web Push + VAPID) o app de escritorio con Tauri.
- Mobile: los navegadores pueden estrangular pestañas en segundo plano; el cálculo por timestamps evita perder tiempo, pero la alarma puede retrasarse.

### 11.3 Audio
- Efectos: inicio, fin, captura, subida de nivel, evolución. Cries opcionales.
- Volumen global + mute; respetar que los navegadores bloquean audio hasta la primera interacción.

### 11.4 Page Visibility
- Escuchar `visibilitychange` durante `focusing`; acumular pérdida de foco; si supera 10 s cuenta como distracción (§6.5).
- Configurable y desactivable ("no penalizar").

---

## 12. Persistencia, export/import y migraciones

- Fuente de verdad: IndexedDB (Dexie). Ajustes ligeros pueden duplicarse en `localStorage` solo para arranque rápido (tema, idioma).
- **Export:** botón que genera `focus-trainer-backup-YYYY-MM-DD.json` con todas las tablas + `schemaVersion` + `exportedAt`.
- **Import:** valida con Zod; muestra resumen (n.º criaturas, sesiones, nivel) y pide confirmación antes de sobrescribir; crea backup automático previo.
- **Migraciones:** `schemaVersion` en `profile`; funciones `migrate_vN_to_vN+1` puras y testeadas; Dexie `version()` para cambios de esquema.
- **Backup automático** opcional: recordatorio semanal para exportar.
- Posible futuro: guardado en archivo con la File System Access API.
- Solicitar almacenamiento persistente (`navigator.storage.persist()`) para evitar que el navegador borre los datos.

---

## 13. Accesibilidad, i18n y rendimiento

### Accesibilidad
- Contraste AA mínimo; no depender solo del color (iconos + texto).
- Navegación completa con teclado y `:focus-visible` marcado.
- Timer: `role="timer"`; **no** anunciar cada segundo en `aria-live`; anunciar inicio, pausa, minutos restantes cada 5 min y fin.
- `prefers-reduced-motion`: desactivar animaciones no esenciales.
- Alt text en sprites (nombre de la criatura).

### i18n
- Textos en `es.json`/`en.json` (`i18next` o implementación ligera). Nombres y descripciones de criaturas vienen del dataset.
- Formato de fechas/números según `locale`.

### Rendimiento (objetivos)
- First Contentful Paint < 1.5 s en equipo medio; JS inicial < 250 kB gzip.
- Dataset (~1 000+ especies) < 500 kB gzip; cargar por demanda si crece.
- Pokédex con virtualización de lista/grid (> 200 elementos) y sprites `loading="lazy"`.
- Sin trabajo pesado en el hilo principal durante el timer.

---

## 14. Testing

| Nivel | Qué cubre | Herramienta |
|---|---|---|
| Unit (core) | Fórmulas de XP, captura, daño, rareza, rachas, pipeline de recompensas, evoluciones | Vitest |
| Determinismo | Misma semilla de RNG → mismo resultado | Vitest + `Rng` con semilla |
| Tiempo | Pausas, reanudar, recarga a mitad de sesión, cambio de día | `FakeClock` |
| Migraciones | Datos v1 → vN | Vitest |
| Import/export | Round-trip y validación Zod | Vitest |
| Componentes | Timer UI, modales, tema | Testing Library |
| E2E | Flujo completo: iniciar → completar → encuentro → captura | Playwright |

Reglas: toda fórmula de §7 tiene test con casos límite; ninguna prueba depende de `Date.now()` real ni de `Math.random()`.

---

## 15. Roadmap por fases

Cada fase termina con algo usable.

### Fase 0 — Cimientos
- Proyecto Vite + TS + Tailwind + tokens CSS + fuentes autoalojadas.
- `Clock`, `Rng`, esquema Dexie, `scripts/build-dataset.ts` y dataset generado.
- **Hecho cuando:** `npm run build-dataset` genera los JSON y la app arranca con un tema.

### Fase 1 — MVP (timer + encuentro + captura)
- Timer con máquina de estados y persistencia de sesión activa.
- Categorías, calidad de sesión, encuentro tras sesión, captura, colección básica.
- Pantalla Focus + resumen post-sesión + export/import JSON.
- **Hecho cuando:** puedes completar una sesión, capturar una criatura y verla en la Pokédex tras recargar.

### Fase 2 — Progresión
- XP, niveles (curvas por `growth_rate`), compañero, equipo.
- Evoluciones, monedas, tienda, inventario, rachas.
- **Hecho cuando:** una criatura sube de nivel y evoluciona con las reglas de §7.5.

### Fase 3 — Gimnasios y regiones
- Datos de Kanto (13 jefes), matriz de tipos, daño por foco, medallas, Liga.
- Mapa de regiones, desbloqueo de la siguiente, encuentro especial.
- Gimnasios personalizados (metas).
- **Hecho cuando:** completas un gimnasio y se desbloquea el siguiente jefe.

### Fase 4 — Profundidad
- Huevos, expediciones, misiones, logros, shiny/pity, modos Nuzlocke/Strict.
- Estadísticas con heatmap y gráficos por categoría.
- **Hecho cuando:** todas las mecánicas de §7 están implementadas.

### Fase 5 — Personalización y pulido
- Themes (incl. Custom), UI Style Modern/Retro/Pixel, fondos y cosméticos.
- PWA completa, audio, accesibilidad, i18n, atajos.
- Resto de regiones (Johto → Paldea).
- **Hecho cuando:** instalable, offline y con 4+ temas y 3 estilos.

### Fase 6 — Opcional
- Criaturas y arte propios (§16), Tauri, backend para push/sync, modo multijugador.

---

## 16. Propiedad intelectual

- Pokémon, sus nombres, sprites, cries y la marca son propiedad de Nintendo/Game Freak/The Pokémon Company. PokeAPI es un servicio comunitario de datos, **no** otorga licencia sobre esos activos.
- Para uso **personal y privado** es razonable. Para publicar, compartir o monetizar hay riesgo legal.
- Por eso el proyecto se diseña para **desacoplarse**:
  - Todo pasa por `CreatureProvider` (§4.3).
  - Se puede añadir `OwnCreaturesProvider` con criaturas, tipos, nombres y sprites propios ("inspirados en", no copias) sin cambiar el motor.
  - La UI usa terminología neutra donde sea posible ("Criatura", "Entrenador", "Cápsula") y el branding propio (nombre, logo, iconos) no copia la imagen oficial.
- Fuentes (Fredoka, Nunito, JetBrains Mono, etc.) tienen licencias abiertas (SIL OFL); incluir sus licencias en el repositorio.
- Esto no es asesoría legal; consultar a un profesional si se planea publicar.

---

## 17. Preguntas abiertas

1. **Alcance de PokeAPI vs criaturas propias:** ¿empezar con PokeAPI para prototipar y migrar luego, o crear el sistema de criaturas propias desde el inicio?
2. **Generaciones por región:** ¿se desbloquean especies por generación al avanzar de región, o todo desde el inicio?
3. **Penalización por abandono:** ¿qué nivel de dureza por defecto (casual / normal / Nuzlocke)?
4. **Expediciones:** ¿con minutos de foco o con tiempo real?
5. **Equipo y daño:** ¿el "mejor atacante del equipo" es suficiente, o prefieres que el daño sea la suma de todo el equipo?
6. **Sync entre dispositivos:** ¿suficiente con export/import manual, o se quiere backend a futuro?
7. **Dispositivo principal:** ¿desktop, móvil o ambos? Condiciona la prioridad de PWA y notificaciones.
8. **Nombre y branding** del proyecto.