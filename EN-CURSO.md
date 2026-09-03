# En curso

**Archivo de coordinación, no documentación.** Dice qué se está haciendo **ahora
mismo** y cómo retomarlo o abandonarlo. La documentación de verdad vive en
[`docs/`](docs/README.md).

---

## Tanda del 2026-09-03 — nueve frentes, cuatro integrados

`main` está en **`bb7667c`**, pusheado, con el deploy en verde (run `33814525348`,
10m). El sitio y el panel publicados ya tienen el tríptico y la grilla.

**Suite: 2.786 tests en 124 archivos, `tsc` limpio, los cinco pasos del gate
mecánico en verde.**

### Ya en `main` y publicado

| Qué | Ticket |
|---|---|
| El tríptico «¿Qué hay ahora?» de la home | B-600, D-320 |
| El panel en grilla de tarjetas y ancho por vista | B-620, D-330 |
| Rescate de 33 worktrees, higiene de la raíz, drift de doc | — |
| Los auditores se disparan por los paths del diff | B-124, D-350 |
| El link de la actividad en el texto para redes | B-312 |
| Dos bugs del gate mecánico (lista vieja de B-99, detección de emuladores) | — |

### Ramas cerradas esperando merge

**El orden importa: primero el rescate, después imágenes.** Todas tienen su texto
de CHANGELOG/BACKLOG/decisiones listo para pegar en su archivo de `.estado/`.

| Rama (en `.claude/worktrees/`) | Commits | Qué trae | Ojo al integrar |
|---|---|---|---|
| `worktree-agent-aba3611dce018e0a3` | 12 | Salud: B-294, B-606, B-169, B-311, B-116, B-78, B-121, B-122, B-33 | Su arreglo del gate **choca con `c095618` de `main`**: quedarse con el de main —afirma en las dos direcciones— y montar encima sus pasos 9 y 10 |
| `worktree-agent-a435211a7fe919bfc` | 8 | Analítica: B-481 (fuentes propias), B-374/B-373, B-601 declarado | **No tiene B-600**: el enganche del evento del tríptico quedó como parche de 5 líneas en su `.estado` |
| `worktree-agent-a1e3f0ab2cf79ee12` | 6 | Tablero: cuatro repartos con torta/lista, ancho, y `ritmoDelCatalogo` calculado | **Ya trae la rama de analítica adentro** (un conflicto, resuelto). Su `anchoDelPanel.ts` es **incompatible con el de la rama del panel**: las dos hicieron B-621 |
| `worktree-agent-afbc2e618dff083ad` | 14 | Panel: B-91, B-45, B-175, B-622, B-621 (el ancho), B-62, B-29 | **El calendario ya está ancho**; falta repartir su grilla por dentro. B-100, B-30 y B-179 **no se implementaron a propósito**, con el motivo escrito |
| `worktree-agent-a3eed17892ac21287` | 4 | Ciclos: B-150, B-89, B-77 | Sus docs citan **D-361** y **B-630**, que viven en su `.estado`: sin pegarlos quedan dos enlaces colgados |
| `worktree-agent-a7a0d08692493079a` | 4 | **D-210 integrado y auditado**: el `srcset` ya no promete una miniatura sin confirmar | Base `d366f77`, así que conflicto seguro en `docs/06` y `docs/12`, que `main` movió. Su `.estado/rescate.md` tiene el texto de las filas 6 y 7 de `07-seguridad.md` + la ficha del auditor, que es **atómico** y ya lo probó en seco |
| `worktree-agent-afaf97df7fb65b51f` | 1 | El rescate crudo (`71f34d0`) | **Ya no hace falta**: lo integró la rama de arriba. Borrable |

### Frentes corriendo

**Ninguno. Los nueve cerraron.**

| Frente | Rama | Ítems |
|---|---|---|

Cada uno commitea por ítem y escribe una línea en su `.estado/<frente>.md` después
de cada commit. **Si hay que frenar: mirar `git log main..HEAD` de cada worktree
antes que `git status`.**

### Encolado, con motivo

- **B-181 completo** (decidido por el dueño). Espera a que aterricen ciclos y
  panel: toca `sesiones.ts`, `calendario.js`, el schema y el formulario, que son
  sus archivos. Es lo primero que va cuando cierren.
- **B-301 y B-285** — tanda de modelo, por lo mismo.
- **B-291** (generar las imágenes de OG en el build) — con el frente de imágenes,
  detrás del rescate.
- **B-214 + B-607** (Astro 6/7 y `npm audit`) — después de la tanda, contra un
  árbol quieto. Los dos tocan el `package-lock.json`.
- **Imágenes**: B-324, B-560, B-222, B-275 — después del rescate.

### Lo que espera al dueño

- **Reverificar el 301** de `agendaleh.com.ar`: a las 18:40 todavía daba 200.
- **Los pasos de consola de la analítica** (GA4 Data API y Search Console):
  runbook completo en `docs/16-analitica-del-sitio.md` §9.4.
- **Desplegar dos Functions programadas** que están escritas y sin desplegar:
  `limpiarImagenesHuerfanas` y `limpiarVersionesHuerfanas`.
- **B-162 y B-160** están diagnosticados y **bloqueados en una decisión suya**:
  ¿el evento dice «Encuentro 3 de 8» o «Encuentro 3»? El frente encontró que
  **dejaron de estar acoplados**: B-162 tiene ahora una salida propia (B-631) que
  no depende de esa decisión.
- **La cuenta activa de `gh` quedó en `benoffi7`** (el switch de vuelta no corrió
  porque el push falló en el medio). Volver con
  `gh auth switch --user gonza-benoffi-modo`.

### Deuda que dejó esta tanda y ningún frente pudo aplicar

- `docs/10-salud-del-codigo.md` describe un `functions/index.js` que ya no existe
  (B-77 lo dejó en ~35 líneas).
- `docs/13-agentes.md` no tiene los chequeos nuevos de la red de contención.
- La tercera pasada del `auditor-privacidad` sobre B-312 quedó pendiente: se
  commiteó con `SALTEAR_AUDITORES=1` porque lo aplicado eran las correcciones de
  las dos pasadas anteriores.

### Los `.estado/` están rescatados

Los siete archivos de estado de los worktrees se copiaron a `.estado/` del árbol
principal — **3.365 líneas de texto listo para pegar** en CHANGELOG, BACKLOG y
decisiones. Vivían solo adentro de cada worktree y `.estado/` es gitignored, así
que borrar un worktree los perdía.

**DEC-6 tiene una corrección:** el handle **no** va en `identidad.ts`. Ya está
centralizado en `src/lib/enlaces.ts:41` desde B-228, que es el módulo creado para
eso; lo que falta es que `textoRedes.ts` y el `sameAs` del `Organization` importen
de ahí en vez de tener su copia.

### Lo que hace difícil el merge, y hay que saber antes de empezar

**Los worktrees se ramifican de `origin/main`, no del `main` local.** Los nueve
frentes nacieron en `d366f77`, o sea **sin el tríptico y sin la grilla del panel**.
Ya se probó: mergear la rama del panel da **diez archivos en conflicto, tres de
ellos `add/add`** —`anchoDelPanel.ts`, `tarjetaDelPanel.ts` y su test, que existen
en `main` con otro contenido—. No es un trámite: es una sesión de merge.

Y hay un choque de diseño, no solo de texto: **B-621 lo hicieron dos ramas** (la
del panel y la del tablero) con versiones **incompatibles** de `anchoDelPanel.ts`.
Hay que elegir una y portar lo de la otra, no fusionar líneas.

**Sugerencia de orden**, de menos a más conflictivo: ciclos (toca `functions/`,
que nadie más tocó) → rescate → salud → tablero → panel. El tablero ya trae
analítica adentro, así que esa rama no se mergea aparte.

## Cómo se retoma

1. Leer esta tabla y `git log --oneline origin/main..main`.
2. Mergear las ramas cerradas **en el orden de la tabla**, pegando el `.estado/`
   de cada una en CHANGELOG, BACKLOG y `06-decisiones.md` en el mismo commit.
3. Recién ahí despachar B-181, que es el más grande y necesita esos archivos
   quietos.
