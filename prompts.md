# PROMPTS.md — Pulido de Fases 0–2 (para pasar a Opencode)

Pásalos **uno por uno, en orden**. Después de cada uno comprueba:

```
npx tsc -b      # limpio
npm test        # verde
npm run build   # OK
```

y haz un commit antes del siguiente. Así, si algo sale mal, sabes en qué prompt fue.

**Antes del Prompt 2:** exporta un backup JSON desde Ajustes. Al cambiar `xpScale`, los niveles de tus Pokémon actuales bajarán (el nivel se deriva de la XP total). Es esperado.

| # | Contenido | Por qué en ese orden |
|---|---|---|
| 1 | Bug de validez, quitar categorías, curva única, lanzamientos ilimitados, regla permanente de docs | Simplifica antes de calibrar |
| 2 | Recalibrar XP + simulación + tests de hitos + pausa gratis | Con una sola curva el balance es medible |
| 3 | Encuentros/balls/huevos por bloques de 30 min | Depende de los lanzamientos ilimitados y del balance |
| 4 | Caramelos, liberar duplicados, tienda | Depende de `xpScale` final |
| 5 | Elección de inicial + nivel coherente al capturar | Cambia el arranque y la captura |
| 6 | Tiempo estimado, próximo objetivo, evolución especial | UI sobre todo lo anterior |

---

## Prompt 1 — Bug de validez, limpieza y regla de documentación

```
Contexto: pomodex (ver AGENTS.md, SPECS.md, ROADMAP.md, README.md). Fases 0–2 hechas. Este prompt simplifica el juego antes de recalibrarlo. Trabaja por partes (A–E), con tests, y no avances si `npx tsc -b`, `npm test` y `npm run build` no están en verde.

## A) Posible bug: validez de sesión
Se sospecha que el código exige "calidad ≥ 90 %" para que una sesión sea válida. La regla correcta (SPECS §6.4) es:
- Válida si: outcome = completed Y focusedMs ≥ completionThreshold × plannedMs (en Flow: ≥ la meta) Y focusedMin ≥ minValidMinutes.
- La calidad NO decide la validez. Solo modula: multiplicador de XP/monedas (Perfecta ×1.25, Buena ×1.0, Floja ×0.8, desde RewardConfig), el tipo de ball gratis y el bonus de rareza.

Revisa resolveSession (src/data/game.ts), applySessionRewards (src/core/rewards/pipeline.ts) y el cálculo de calidad. PRIMERO escribe tests que lo comprueben:
1. Sesión con 100 % del tiempo y calidad 40 → válida, XP ×0.8, ball Poké, genera encuentro.
2. Sesión con 85 % del tiempo y calidad 100 → inválida.
3. Sesión justo en el umbral (90 %) → válida.
Si ya estaba correcto, deja los tests como regresión y dilo explícitamente en el resumen. Si no, corrígelo.

## B) Eliminar el concepto de categorías
La app es solo el timer. Elimina por completo:
- El tipo/tabla/seed de categorías, el selector en src/ui/pages/Focus.tsx y cualquier `categoryId` en SessionRecord, ActiveSession y Goal.
- La afinidad de tipos en rollEncounter. El pool pasa a ser "especies de la región actual (Kanto)" con las mismas reglas de rareza, pity e incienso.
- Textos de UI que mencionen categorías.
Migración: sube la versión de Dexie y elimina la tabla (`categories: null`). Los datos antiguos (sesiones, sesión activa, backups JSON importados) con `categoryId` deben seguir cargando: los esquemas Zod ignoran/descartan campos legacy. Añade un test de import con un backup antiguo que contenga categorías.

## C) Curva de XP única
- Todas las especies usan la curva "medium" de PokeAPI: XP total = n³ (× xpScale). No toques el dataset ni vuelvas a ejecutar build-dataset: ignora `growth_rate`.
- Simplifica src/core/xp.ts: elimina el parámetro de growth rate y las ramas/tablas erratic, fluctuating, slow, fast y medium-slow (si nada más las usa). Mantén el invariante `levelFromXp(xpForLevel(n)) === n` (sin floor, ver AGENTS.md) y adapta tests/xp.test.ts.
- Deja un comentario breve en xp.ts explicando que es una decisión de diseño (curva única), no una omisión.

## D) Lanzamientos ilimitados
- Un lanzamiento fallido NO hace que el Pokémon huya y NO limita los intentos. Cada lanzamiento consume 1 ball.
- El Pokémon se va solo si: (1) expira el TTL (`encounterTtlHours`, con Clock inyectado), o (2) el usuario pulsa "Dejar ir" (nuevo botón, con confirmación).
- Sin balls: no se puede lanzar; el encuentro queda pendiente y el modal muestra un aviso con acceso a la Tienda.
- Elimina `throwsPerEncounter` de RewardConfig y `throwsLeft` de Encounter (las filas antiguas con ese campo deben seguir cargando). Muestra "Intento n" en el EncounterModal; mantén la animación de sacudidas. La Master Ball sigue acertando siempre.
- Tests: N fallos seguidos no eliminan el encuentro; cada lanzamiento resta una ball; con 0 balls no se lanza; el TTL hace huir al Pokémon (FakeClock).

## E) Regla permanente de documentación
Añade en AGENTS.md una sección "Reglas de documentación" con este checklist, para que se aplique siempre:
"Al terminar cualquier cambio: (1) SPECS.md debe quedar idéntico al comportamiento del código (cita la sección editada). (2) ROADMAP.md: tacha lo implementado aunque estuviera planeado para una fase posterior, elimina duplicados en la fase original y actualiza la cabecera de Estado (fecha, nº de tests, bundle). (3) README.md: refleja el comportamiento actual (describe el proyecto terminado). (4) AGENTS.md: actualiza 'Desviaciones ya tomadas', conteo de tests/archivos y fase siguiente. (5) Termina con un resumen que liste qué documentos tocaste."

## Documentación de ESTE prompt (obligatorio)
Aplica el checklist de E. En concreto:
- SPECS: §5.1 (Category, Encounter, SessionRecord, Goal), §7.1 (tabla de curvas → curva única), §7.3 (afinidad de categoría fuera), §7.4 (lanzamientos ilimitados), §7.10 (eliminar o reemplazar por nota), §9.6/§9.7 (selector y "horas por categoría"), §8 (RewardConfig), §4.2 (growth_rate no se usa), §7.12/§7.13 (ejemplos con categorías), §15.
- ROADMAP: Fase 1 ("Categorías de tarea…", "3 lanzamientos"), Fase 2 ("tablas erratic/fluctuating"), Fase 4 ("horas por categoría"). Marca los cambios como "(reemplazado: …)" en vez de borrar historial.
- README: "personalizado por categoría", "Afinidad por categoría", "3 lanzamientos", "curvas clásicas por growth_rate".
- AGENTS: desviaciones nuevas (sin categorías, curva única, lanzamientos ilimitados), conteo de tests.

Al terminar, entrega un resumen: qué encontraste en el bug A (¿existía o no?), qué cambió, qué docs tocaste.
```

---

## Prompt 2 — Recalibración de XP, simulación y tests de ritmo

```
Contexto: AGENTS.md, SPECS §7.1, RewardConfig (src/core/rewards/config.ts). Hay una sola curva de XP (n³). Perfil de uso real del usuario: sesiones de 60 min. Objetivo: que el progreso se sienta largo y satisfactorio, y que cualquier cambio de balance futuro que rompa el ritmo lo detecten los tests.

## Cambios de balance (todos en RewardConfig, nunca hardcodeados)
- `xpScale`: 0.05 → 0.25. `xpPerMinute` se queda en 10.
- `teamXpShare` se queda en 0.25. NO añadas bonus de recuperación (el equipo se pone al día con caramelos, Prompt 4).
- Nueva opción `freePausesPerSession` (por defecto 1): las pausas gratis no restan calidad; a partir de la segunda restan lo habitual (−10, máx −30). Las distracciones no cambian.
- Revisa los presets casual/normal/hardcore para que sigan coherentes con el nuevo xpScale.

## Script de simulación
Crea `scripts/simulate-progression.ts` (usa el mismo runner que build-dataset) y un npm script `simulate`. Debe reutilizar las funciones de src/core (nada duplicado) y aceptar argumentos:
`--session-min=60 --sessions-per-day=2 --days=365 --quality-mix=20,60,20 --streak`
(quality-mix = % de sesiones Perfecta/Buena/Floja).
Salida en tabla, para un Pokémon partiendo de nivel 5:
- Horas de foco, nº de sesiones y días hasta los niveles 16, 36, 50, 75 y 100.
- Con el mismo ritmo: nivel que alcanzaría un Pokémon del equipo que recibe `teamXpShare`.
- Horas de foco necesarias para completar Kanto (13 jefes: 8 gimnasios con HP 120+40·(i−1), Alto Mando 420/440/460/480, Campeón 600 = 4 480 min) y nivel del compañero en ese momento (es un dato informativo; la Fase 3 aún no existe).

## Tests de ritmo (tests/progression.test.ts)
Con calidad Buena (×1.0) y sin racha, partiendo de nivel 5, en horas de foco (no dependen de la duración de sesión):
- Nv. 16: 1–3 h · Nv. 36: 18–22 h · Nv. 50: 50–54 h · Nv. 100: 410–425 h.
Con quality-mix 20/60/20 el resultado debe quedar dentro de ±5 % de lo anterior. Usa FakeClock y Rng con semilla; ninguna dependencia de Date.now() ni Math.random(). Si en el futuro alguien cambia el balance, estos tests deben fallar con un mensaje claro ("el hito Nv.36 pasó de X h a Y h").

## Datos existentes
No migres XP. Al bajar los niveles de los Pokémon ya guardados, asegúrate de que: no hay errores, `pendingEvolutions` se recalcula sin duplicados y un Pokémon ya evolucionado que quede por debajo del nivel de su evolución no se "des-evoluciona" ni muestra errores.

## Documentación (obligatorio, aplica el checklist de AGENTS.md)
- SPECS §7.1: nuevos valores (xpScale 0.25, tabla de hitos con 10 XP/min), referencia de ritmo; §8: RewardConfig con `freePausesPerSession`; §6.5: pausa gratis.
- ROADMAP: cabecera de Estado (fecha, tests, resultado del script) y una nota en Fase 2 sobre la recalibración.
- README: mención de la pausa gratis y del script `npm run simulate` en "Desarrollo".
- AGENTS: comando `npm run simulate`, la regla "si cambias el balance, ejecuta simulate y actualiza los tests de hitos", y la desviación (teamXpShare se queda en 25 %; sin bonus de recuperación).

Entrega al final la tabla que imprime el script con el perfil 60 min × 2 sesiones/día y con 60 min × 1 sesión/día.
```

---

## Prompt 3 — Encuentros, balls y huevos por bloques de tiempo

```
Contexto: AGENTS.md, SPECS §7.3/§7.4/§7.6, pipeline (src/core/rewards/pipeline.ts), rollEncounter. Hoy cada sesión válida da 1 encuentro, 1 ball y 1 tirada de huevo sin importar su duración. Con sesiones de 60 min eso penaliza el foco largo. Hazlo por bloques de tiempo.

## Reglas (todo en RewardConfig)
- `encounterBlockMinutes` = 30, `maxEncountersPerSession` = 3.
- nº de encuentros = clamp(floor(focusedMin / encounterBlockMinutes), 1, maxEncountersPerSession). Ej.: 25 min → 1, 60 min → 2, 90+ min → 3. Respeta `encounterChance` (se aplica por encuentro) y el mínimo `minValidMinutes`.
- Ball gratis: una por encuentro generado, con el tipo según calidad (Floja → Poké, Buena → Great, Perfecta → Ultra).
- Huevo: una tirada de `eggDropChance` por bloque (mismo nº que los encuentros), respetando el máximo de 3 huevos.
- Cada encuentro se genera de forma determinista: sigue usando solo el RNG inyectado (nada de Math.random), sin romper la regla del seed del encuentro de AGENTS.md. El pity timer cuenta por encuentro, no por sesión. El bonus de overtime de Flow y el incienso siguen funcionando: el incienso gasta 1 carga por encuentro y SIGUE siendo solo un modificador de rareza (no añade encuentros).
- `maxPendingEncounters` = 8: si se supera, el más antiguo huye. Cola de encuentros: al resolver uno en el EncounterModal se abre el siguiente; el PostSessionModal indica "N Pokémon salvajes te esperan".
- Opcional (impleméntalo al final y mantenlo separado en un commit/bloque claro): ítem "Señuelo" en la tienda (💵 250): +1 encuentro en la siguiente sesión válida (se consume al terminar; máx. +1 por sesión; no supera maxEncountersPerSession + 1).

## Economía de balls (comprobación)
Añade a scripts/simulate-progression.ts (del Prompt 2) una sección que imprima las balls esperadas por captura y su coste en 💵 según rareza, con Poké/Great/Ultra, usando la fórmula actual de captureChance, y cuántas sesiones de 60 min de monedas+balls gratis hacen falta para capturar un legendario. Si un legendario cuesta más de ~15 balls en esperanza con Poké Ball, avísame con los números en vez de cambiar la fórmula tú solo.

## Tests
- 25/60/90/150 min → 1/2/3/3 encuentros; Flow con overtime sigue el tope.
- Mismo seed → mismos encuentros (determinismo); el pity cuenta por encuentro.
- Balls gratis y tiradas de huevo por bloque; el máximo de 3 huevos se respeta.
- Cola de encuentros: orden, expiración y tope de pendientes.

## Documentación (obligatorio, aplica el checklist de AGENTS.md)
- SPECS §3.3 (pipeline), §7.3 (encuentros por bloques y cola), §7.4 (balls gratis), §7.6 (huevo por bloque), §7.7 (Señuelo si lo implementas), §8 (nuevas opciones de RewardConfig).
- ROADMAP: cabecera de Estado y nota en Fase 1/Fase 4 (huevos) de lo que se adelantó.
- README: sección "Encuentros y colección" (varios encuentros por sesión larga).
- AGENTS: desviaciones nuevas y conteo de tests.
```

---

## Prompt 4 — Caramelos de XP, liberar duplicados y tienda

```
Contexto: AGENTS.md, SPECS §7.7 (economía), §7.11 (expediciones), el inventario existente y la pantalla Team/Shop. Los caramelos de XP estaban previstos en la Fase 4 (liberar duplicados y expediciones); se adelantan ahora la parte de liberar duplicados y tienda. Convenciones: UI en español con "Pokémon"; monedas 💵; reutiliza Btn/Select/Input/Modal; todo el balance en RewardConfig.

## Ítems
Cinco ítems de inventario (sigue la convención de ItemId existente): XS, S, M, L, XL. En RewardConfig guarda solo el valor base de los juegos oficiales: { xs: 100, s: 800, m: 3000, l: 10000, xl: 30000 }. La XP real = base × xpScale (con xpScale 0.25: 25 / 200 / 750 / 2 500 / 7 500). No guardes los valores finales: deben reescalarse solos si cambia xpScale.

## Dar caramelo (pantalla Equipo y ficha del Pokémon)
- Botón "Dar caramelo" que abre un selector de tamaño con vista previa ("+200 XP → Nv. 21 → Nv. 22").
- Reglas: no se puede dar al compañero; el Pokémon objetivo no puede superar el nivel del compañero (la XP se recorta al tope, el caramelo se consume, y la vista previa lo avisa); si ya está en el tope, el botón se desactiva con explicación.
- Se puede dar a cualquier Pokémon poseído que no sea el compañero (incluidos los de la caja).
- Subir de nivel por caramelo recalcula nivel y candidatos a evolución con la misma función que el pipeline (sin duplicar lógica).

## Liberar duplicados
- Acción "Liberar" en la ficha, con confirmación. No se pueden liberar: el compañero, Pokémon del equipo, shiny, legendarios ni míticos.
- Recompensa en caramelos por rareza (RewardConfig): common → 1 XS, uncommon → 1 S, rare → 1 S, epic → 1 M.
- Botón "Liberar duplicados" que, por cada especie, conserva el de mayor nivel (y cualquier shiny, que nunca se libera) y libera el resto de la caja (no del equipo), mostrando antes un resumen con el total de caramelos que se ganarán.
- Actualiza el DexEntry si hace falta (liberar nunca quita "capturado").

## Tienda
Precios en 💵 y límite de compra por día lógico (usa la misma función de día lógico/dayRolloverHour que las rachas; el contador diario se persiste y se reinicia solo): XS 15 (máx. 5/día), S 60 (máx. 3/día), M 200 (máx. 1/día), L 650 (máx. 1/día). XL no se vende (solo recompensas futuras). La tienda muestra "+X XP" calculado desde config.

## Persistencia
Nuevos ítems en inventario y contador de compras diarias con migración Dexie (versión nueva) y esquema Zod actualizados; los backups antiguos deben importarse sin errores.

## Tests
- Valores de caramelo reescalan con xpScale.
- Tope del nivel del compañero (recorte, botón desactivado, no válido para el compañero).
- Evolución disponible tras subir por caramelo.
- Reglas de liberación (qué no se puede liberar) y recompensas por rareza; "Liberar duplicados" conserva el mejor y no toca equipo ni shinies.
- Límite diario de compra y su reinicio con FakeClock.

## Documentación (obligatorio, aplica el checklist de AGENTS.md)
- SPECS §7.7 (tabla de tienda con caramelos y límites), §7.1 (tabla de caramelos escalados), §7.4 (duplicados/liberar), §7.11 y §7.12 si mencionan caramelos de XP, §5.1 (Inventory), §8.
- ROADMAP: tacha en Fase 4 lo que se adelantó (caramelos por liberar duplicados) y deja anotado lo que sigue pendiente (caramelos de expediciones).
- README: "Economía" y "Progresión" con caramelos y liberar duplicados.
- AGENTS: desviaciones nuevas y conteo de tests.
```

---

## Prompt 5 — Elección de inicial y nivel coherente al capturar

```
Contexto: AGENTS.md, SPECS §7.3/§7.4/§7.5, src/data/actions.ts (throwBall; hoy el primer capturado pasa a compañero y equipo automáticamente), evoluciones normalizadas en src/data/dataset (evolutions.json). UI en español ("Pokémon").

## A) Elección de inicial
- Si el perfil no tiene ningún Pokémon, la primera pantalla es una pantalla de bienvenida: elegir entre Bulbasaur, Charmander y Squirtle (ids en RewardConfig o constante de datos: [1, 4, 7]; nivel inicial `starterLevel` = 5), con sprite, tipos, flavor text oficial (sin editar) y apodo opcional.
- El elegido entra como compañero y equipo, DexEntry capturado, caughtWith = Poké Ball. Reutiliza la ruta de creación de OwnedCreature (no dupliques lógica).
- Elimina la auto-asignación del primer capturado como compañero. Mantén un fallback: si alguien importa un backup sin compañero, se le pide elegir uno entre los que tenga.
- Pide confirmación antes de fijar el inicial.

## B) Nivel coherente al capturar
Hoy los salvajes entran con nivel bajo aleatorio. Reglas nuevas:
- Nivel base = aleatorio en `wildLevelRange` (por defecto [3, 10]) con el RNG inyectado.
- Nivel mínimo por especie `minCaptureLevel(speciesId)`: derivado de evolutions.json, = nivel de la evolución que produce esa especie (por nivel); si es por piedra/amistad/especial, el `fallbackLevel` de §7.5; y nunca menor que el mínimo de su preevolución. Ej.: Dragonite ≥ 55, Raichu según su regla, etapa 1 = sin mínimo.
- Nivel final = max(nivel base, minCaptureLevel).
- Legendarios y míticos entran a `legendaryCaptureLevel` fijo = 50 (RewardConfig).
- La XP inicial del Pokémon capturado = xpForLevel(nivel final).
- Calcula minCaptureLevel en una función pura de src/core (con tests) a partir de datos ya cargados; no hagas llamadas de red ni vuelvas a ejecutar build-dataset.

## Tests
- minCaptureLevel de ejemplos conocidos (Charmander sin mínimo, Charmeleon ≥ 16, Charizard ≥ 36, Dragonite ≥ 55, evolución por piedra usa fallback).
- Nunca se captura una especie evolucionada por debajo de su mínimo; legendarios a 50.
- Determinismo con RNG con semilla.
- Flujo de bienvenida: sin Pokémon → pantalla de elección; tras elegir, no vuelve a aparecer (actualiza tests/app.test.tsx).

## Documentación (obligatorio, aplica el checklist de AGENTS.md)
- SPECS: §7.2 (compañero inicial), §7.3/§7.4 (nivel al capturar), §5.1 si cambia algún tipo, §8 (nuevas opciones), §9.6 (pantalla de bienvenida).
- ROADMAP: nota de estado y lo que se adelantó.
- README: "Progresión" (elección de inicial) y "Encuentros" (nivel coherente).
- AGENTS: desviaciones y conteo de tests.
```

---

## Prompt 6 — Progreso en tiempo, próximo objetivo y evolución especial

```
Contexto: AGENTS.md, SPECS §9, pantalla Focus, PostSessionModal, tarjeta del compañero, flujo de evolución (confirmEvolution/dismissEvolution). Convenciones: Btn/Select/Input/Modal de src/ui/components, import de Motion desde `motion/react`, `MotionConfig reducedMotion="user"` ya envuelve la app, monedas 💵.

## A) Progreso expresado en tiempo de foco
Funciones puras en src/core (con tests) que, dado XP restante, RewardConfig y contexto (multiplicador de racha actual, calidad media asumida = Buena ×1.0), devuelvan minutos de foco estimados. Mostrar:
- Tarjeta del compañero: "Siguiente nivel en ~38 min de foco".
- Si hay evolución por nivel: "Evoluciona a Charizard en ~8 h de foco". Si es por piedra/amistad/especial: muestra el requisito en texto en vez de una estimación.
- PostSessionModal: tras la sesión, lo mismo para el compañero junto a las subidas de nivel.
Formato legible: minutos hasta 90 min, horas hasta 48 h, luego días de foco ("~3 días a tu ritmo" solo si hay historial de ≥ 3 días; si no, solo horas). Siempre con "~". Estas cifras son del compañero, no del equipo.

## B) Próximo objetivo visible
Panel en la pantalla Focus, función pura `nextGoals(state)` en src/core con tests, que devuelve hasta 3 objetivos priorizados:
1. Evolución disponible o lista para confirmar.
2. Siguiente evolución o nivel del compañero (con tiempo estimado).
3. Progreso de Pokédex ("Kanto 12/151").
4. Siguiente hito de racha (7/14/30/60/100) con días restantes.
Cuando exista la Fase 3 se añadirá el jefe activo; deja el sistema extensible (lista de proveedores de objetivos), sin implementar nada de gimnasios.

## C) Evolución como momento especial
- Pantalla/modal de evolución a pantalla completa: fondo atenuado, sprite actual → silueta/destello blanco → sprite nuevo, con el apodo y el nombre nuevo. Animación con Motion; con reduced motion, un simple crossfade.
- Reproduce el grito (`cries.latest` de la especie nueva, carga lazy). Si no existe un servicio de audio, crea `src/app/services/audio.ts` mínimo con `playCry(speciesId)` que respete un ajuste `soundEnabled` (por defecto true, desactivable en Ajustes) y falle en silencio si el navegador bloquea el audio.
- Confirmar y cancelar siguen siendo opciones explícitas. Asegura (y testea) que el apodo, nivel, XP, amistad y shiny se conservan tras evolucionar.
- Sin cambios en las reglas de evolución.

## Tests
- Estimaciones de tiempo (formatos, caso sin evolución por nivel, XP restante 0).
- nextGoals: prioridad y extensibilidad.
- Evolución conserva apodo/estado; el flujo no rompe con reduced motion (smoke en jsdom).

## Documentación (obligatorio, aplica el checklist de AGENTS.md)
- SPECS: §9.7 (layout de Focus con panel de objetivos y estimaciones), §9.8 (flujo post-sesión), §7.5 (momento de evolución), §11.3 (audio: se adelanta el mínimo de cries).
- ROADMAP: marca en Fase 5 lo que se adelantó del audio (solo cries/ajuste) y deja pendientes efectos de sonido y notificaciones.
- README: "Progresión" y "Técnico".
- AGENTS: desviaciones nuevas, el servicio de audio y conteo de tests.

Al terminar, entrega un resumen con capturas descritas (o un listado) de cada pantalla modificada y los docs actualizados.
```

---

## Notas para ti (no las pegues)

- **Orden y commits:** un commit por prompt. Si un prompt falla a medias, revierte solo ese.
- **Si el Prompt 1 encuentra que el bug de validez no existía**, mejor: te quedan los tests de regresión.
- **El Señuelo del Prompt 3 es opcional.** Si no lo quieres, borra la viñeta.
- **Tras el Prompt 6** el siguiente paso natural es la Fase 3 (gimnasios). Con 1 solo tipo de curva, el cálculo de `levelFactor` y de HP de jefes ya será predecible con el script `simulate`.