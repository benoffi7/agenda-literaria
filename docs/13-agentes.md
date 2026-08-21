# Agentes y skills del repo

Automatización del flujo de trabajo de este proyecto, en `.claude/`. Son
definiciones locales: viajan con el repo y las usa cualquiera que lo abra con
Claude Code.

El número del documento no es casual: lo que estos agentes cuidan es, sobre
todo, el **§13 del [`CLAUDE.md`](../CLAUDE.md)** — la lista de trampas que ya
costaron tiempo.

---

## El criterio

Un agente que "revisa código" no aporta nada: eso ya lo hace Claude sin ayuda.
**Un agente vale la pena cuando encapsula conocimiento de este proyecto que, si
no está escrito, hay que volver a explicar cada vez.**

Y hay un segundo filtro, más importante: **un agente que repite lo que un test
ya verifica es peor que nada**, porque da falsa sensación de cobertura. Este
repo tiene una suite grande y muy específica (cada trampa del §13 tiene al menos
un test que la nombra), así que la mayor parte del trabajo fue decidir qué **no**
hacer. Está en [Qué se decidió no automatizar](#qué-se-decidió-no-automatizar).

Lo que queda para un agente es el hueco que un test no puede llenar: los tests
verifican los campos, los archivos y las salidas **que ya conocen**. Cuando el
cambio agrega un campo nuevo, una salida nueva o un trigger nuevo, no hay test
que lo mire — y ahí es donde este proyecto se lastima.

---

## Qué hay

| | Nombre | Tipo | Para qué |
|---|---|---|---|
| 🔒 | `auditor-privacidad` | agente (solo lectura) | Que nada privado llegue a las cuatro salidas públicas |
| 🪤 | `auditor-trampas` | agente (solo lectura) | Las trampas del §13 y los fallos que dejan el build en verde |
| 📚 | `auditor-documentacion` | agente (solo lectura) | Que la doc acompañe al cambio, y que no afirme cosas que dejaron de ser ciertas |
| ✅ | `cerrar-cambio` | skill | El procedimiento de cierre — doc, CHANGELOG, ayuda, novedades, backlog |
| 🧩 | `campo-nuevo` | skill | Agregar un campo al modelo de punta a punta |
| 🐞 | `al-backlog` | skill | Anotar un bug o una idea en el backlog, priorizado y con formato |
| 🚀 | `que-deployar` | skill de usuario (`/que-deployar`) | Qué deployar, con qué comandos y qué verificar después |

---

## Cómo se definen (formato verificado)

No se adivinó: se consultó la documentación de Claude Code y **se validó el
frontmatter con un parser de YAML** antes de commitear.

**Agentes** — un archivo por agente en `.claude/agents/<name>.md`:

```markdown
---
name: auditor-privacidad          # obligatorio, minúsculas y guiones, IGUAL al nombre del archivo
description: Audita que …         # obligatorio; es lo que Claude lee para elegirlo solo
tools: Read, Grep, Glob, Bash     # opcional; lista separada por comas. Si se omite, hereda TODAS
model: opus                       # opcional: sonnet | opus | haiku | inherit
---

El cuerpo es el system prompt del agente.
```

Cosas que importan y no son obvias:

- El agente **arranca limpio**: no ve la conversación de quien lo llamó ni el
  `CLAUDE.md` del proyecto. Todo lo que necesite saber va en su cuerpo, o le
  dice qué archivo leer. Por eso los tres auditores empiezan nombrando la
  fuente (`CLAUDE.md` §5, §13, `docs/05-patrones.md`) en lugar de copiarla: el
  índice va en el agente, la verdad queda en un solo lugar.
- Devuelve al padre **su último mensaje de texto**. De ahí que cada agente
  tenga una sección "Qué devolvés" con un formato fijo: un reporte que nadie
  puede accionar no sirve.
- `tools` es una **allowlist**. Los tres auditores no tienen `Write` ni `Edit`:
  no pueden modificar nada aunque se equivoquen o se lo pidan.
- **`Bash` no se puede recortar por comando desde el frontmatter** (eso se hace
  con `permissions` en `settings.json`). Los tres lo necesitan para `git diff`,
  así que la restricción está escrita en el cuerpo, en la sección "Qué NO
  hacés": nada de tests, builds, deploys, `gcloud`, `firebase`, ni leer `.env`.
  Si alguna vez se quiere hacer cumplir de verdad, va por `permissions`.
- **Un frontmatter mal escrito no carga y nadie se entera.** Pasó acá: las tres
  descripciones terminaban con `Es de solo lectura: reporta, no arregla.` y un
  `": "` dentro de un valor sin comillas hace que el YAML sea inválido → el
  archivo entero se ignora, sin error visible. Se detectó parseando el
  frontmatter con Ruby (`YAML.safe_load`) y se arregló sacando los dos puntos.
  **Al agregar o editar un agente, parsealo antes de confiar en él**, o
  verificalo con `/context` (aparece bajo los subagentes), `/doctor` y `/agents`.

Detalle chico con consecuencia real: `.claude/` no está en la lista negra de
`scripts/que-deployar.sh`, así que **un cambio a estas definiciones hoy hace
`hosting=true`** y republica el sitio. Es inofensivo (y es el lado barato del
error, por diseño: lo desconocido se deploya), pero sumar `^\.claude/` a
`NO_AFECTAN` es una línea en el script más su caso en
`tests/que-deployar.test.ts`, y eso queda fuera de este cambio porque toca
código.

**Skills** — una carpeta por skill, con `SKILL.md` adentro:
`.claude/skills/<name>/SKILL.md`. Un archivo suelto `.claude/skills/<name>.md`
**no se carga**. El frontmatter que usamos es `name` + `description`, más
`disable-model-invocation: true` en el que es solo para el usuario.

---

## Los agentes

### 🔒 `auditor-privacidad`

**Para qué.** El proyecto tiene **cuatro salidas públicas** y una sola regla
(§5.1), y cada salida la produce un archivo distinto: `toPublic.ts` para el
`events.json`, `calendario.js` para el evento de Calendar, `reportes.js` para el
issue de GitHub (el repo es público), `analytics-eventos.ts` para GA4 — la más
estricta, donde no sale contenido ni con permiso del dueño. El agente sabe qué
archivo produce cada una, qué nunca sale, y las excepciones que cuestan de
recordar (`online.urlPublica` vale para el JSON y el calendario pero **nunca**
para la analítica; el historial de versiones guarda el documento entero sin
proyectar a propósito).

**Cuándo se invoca.** Antes de cerrar cualquier cambio que toque una salida, el
modelo, el schema, las reglas o el bundle. Su `description` nombra los archivos
para que Claude lo elija solo.

**Qué agrega sobre los tests.** Los tests verifican los campos que conocen. Este
agente verifica tres cosas que ningún test puede: que un **campo nuevo** tenga
las cuatro celdas decididas, que la **forma** de la proyección siga siendo una
whitelist (un `...actividad` no filtra nada hoy y publica el campo de mañana), y
que exista un test que fije la decisión. No corre la suite: eso lo hace el CI.

**Qué NO hace.** No escribe, no arregla, no corre tests ni builds ni deploys, no
lee secretos (`.env`, la URL del ICS, el PAT), y no propone aflojar un test para
que pase un cambio.

**Qué devuelve.** Veredicto (`LIMPIO` / `HALLAZGOS: N`), la tabla de los campos
tocados contra las cuatro salidas, un bloque por hallazgo (severidad P0/P1/P2,
`archivo:línea`, qué se filtra, el arreglo mínimo, el `it(...)` que lo fijaría) y
qué verificó que estaba bien.

**Modelo: `opus`.** Es el único con el modelo caro, y a propósito: el costo de
un falso negativo acá es una credencial filtrada o un link de reunión público, y
las dos cosas son irreversibles.

### 🪤 `auditor-trampas`

**Para qué.** Las diez trampas del §13 más los patrones de
[`05-patrones.md`](05-patrones.md) que comparten una propiedad: **se rompen sin
que nada falle**. El cuerpo del agente es una tabla de trampa → dónde vive hoy →
qué test la nombra → **dónde ese test no mira**. Esa última columna es el aporte:
`tests/calendario.test.ts` cuida la guarda anti-loop de `syncCalendar`, pero
nada cuida a un trigger nuevo que escriba en su propia colección;
`tests/bundle-panel.test.ts` cuida cinco casos del corte del bundle, pero no el
tercer chunk (`ReportesPanel`) ni un import estático nuevo en `AdminApp` que
arrastre Firestore por la cadena de imports (B-117).

**Cuándo se invoca.** Antes de cerrar un cambio en `src/lib/`,
`src/components/admin/`, `functions/` o las reglas; y siempre que aparezca un
trigger de Firestore, un array editable, un campo de taxonomía, una conversión de
fechas o un import estático en el panel.

**Qué NO hace.** No duplica al `auditor-privacidad` (trampas 4 y 5 son de él, las
nombra y deriva) ni al `auditor-documentacion`. No reporta lo que un test ya
frena, salvo para decir "cubierto por `tests/x.test.ts`" — un hallazgo que el CI
ya bloquea es ruido y devalúa el resto del reporte. No propone refactors.

**Qué devuelve.** Además de los hallazgos, dos listas que son el punto:
**"cubierto por tests"** (para que nadie escriba un test que ya existe) y **"sin
red"** (las trampas que el cambio toca y que nadie verifica, con el `it(...)`
que habría que escribir).

### 📚 `auditor-documentacion`

**Para qué.** Dos cosas que se saltean solas. Una es la **regla de proceso**: un
cambio no está terminado hasta que la doc lo refleja, y el agente tiene la tabla
completa de qué archivo corresponde a qué tipo de cambio, incluidas las dos
reglas finas que se olvidan (`novedades.ts` **no** lleva refactors ni cambios de
bundle; la ayuda corta de un campo va en la prop `ayuda` de `Campo`, no en
`ayuda.ts`). La otra es el **drift**: la doc que afirma algo que ya no es cierto,
los ítems del backlog ya resueltos, los bloques duplicados de merges mal
resueltos, y los avisos de la guía del panel que describen un comportamiento que
cambió. Eso es exactamente el hueco de B-63, y no lo puede cubrir un test.

**Sirve, y hay prueba.** En la primera corrida sobre este repo encontró que
**B-56 dice que nadie llama a `registrarVersion(VERSION_APP)`, y hoy se llama**
en `src/components/admin/AdminApp.tsx`. Quedó anotado como B-118: no se tocó
B-56 porque el ítem no es de este bloque de trabajo.

**Cuándo se invoca.** Antes de commitear o de abrir un PR, cuando alguien dice
"listo", y cada tanto sobre el repo entero como barrido de mejora continua.

**Qué NO hace.** **No escribe la doc**: devuelve el checklist y el texto
propuesto listo para pegar, y quien lo invocó decide. Es deliberado — doc
autogenerada que nadie leyó es cómo empieza el drift. No cuenta ni actualiza el
número de tests. No reescribe por estilo: si el texto dice la verdad, se deja.

**Qué devuelve.** Veredicto (`CERRADO` / `FALTA: N`), el checklist línea por
línea con `✅ / ⬜ / — no aplica` **y el motivo**, el texto propuesto para cada
`⬜` con el formato del archivo de destino, y el drift con `archivo:línea` + qué
afirma + qué dice el código.

---

## Los skills, y por qué no son agentes

El criterio que se aplicó:

| Si el trabajo es… | Va como |
|---|---|
| auditar y producir un reporte, sin tocar nada | **agente** (solo lectura, arranca limpio, se puede correr en paralelo) |
| un procedimiento reproducible que **modifica archivos** siguiendo pasos fijos | **skill** (corre en la conversación, con el usuario presente para aprobar) |
| un atajo que el usuario tipea para una verificación puntual | **skill con `disable-model-invocation: true`**, que es como se ve un `/comando` propio |

Un agente para escribir la doc habría sido peor: arranca sin contexto de la
conversación (justo lo que hace falta para redactar el CHANGELOG de lo que se
acaba de hacer) y necesitaría `Write` sobre `docs/` y `src/lib/`.

### ✅ `cerrar-cambio`

El procedimiento de cierre completo, en orden: mirar el diff → decidir qué toca
de la tabla → CHANGELOG → `D-xx` si hubo decisión → `novedades.ts` si se nota al
usar el panel → `ayuda.ts` si cambia algo que no se ve → BACKLOG → typecheck y
tests → resumen. Es un skill porque **escribe**, y porque el "por qué" del
cambio está en la conversación que lo produjo.

Cierra el par con `auditor-documentacion`: el skill lo hace, el agente verifica
que se haya hecho (y sirve también para revisar una rama ajena).

### 🧩 `campo-nuevo`

Un campo del modelo toca once lugares — tipo, schema, conversión, formulario,
proyección pública, evento de Calendar, duplicar, analítica, reglas, tests, doc —
y los que se olvidan son siempre los mismos tres: la proyección, el default de
lectura de los documentos que ya están en producción, y la ayuda. El skill
arranca obligando a decidir las cuatro salidas **antes** de escribir código, que
es la parte que no se puede deshacer. DEC-1 (el libro presentado) es su primer
caso pendiente.

### 🐞 `al-backlog`

La regla dice que **todo** reporte de bug entra al backlog, incluso si se arregla
en el momento. Este skill sí es invocable por el modelo, a propósito: es la forma
de que la regla se cumpla sin que alguien tenga que acordarse. Sabe la escala de
prioridades, las cuatro secciones (incluida "pendiente de acción manual del
dueño", para lo que necesita credenciales que un agente no debe crear), el
formato de la tabla de Cerrados —donde la columna que sirve es la causa, no el
síntoma— y qué **no** copiar al backlog, que está versionado en un repo público.

### 🚀 `que-deployar`

Atajo de usuario (`/que-deployar`). No deploya: imprime la decisión de
`scripts/que-deployar.sh` con el motivo de la lista negra del hosting, los
comandos en el orden que importa (reglas → hosting → functions) y las
verificaciones de después. Existe por una razón concreta: **`firebase deploy
--only functions` sin filtro despliega `dispararRebuild` y `reporteAIssue`, que
no deben desplegarse todavía** porque les falta el PAT (B-20, D-13). Es
conocimiento que hoy vive en dos párrafos de
[`08-operacion.md`](08-operacion.md) y que se paga caro olvidando.

---

## Qué se decidió no automatizar

### Porque ya hay un test, y duplicarlo daría falsa cobertura

| Lo que se pensó como agente | Quién ya lo verifica |
|---|---|
| Que el link de la reunión y la difusión no salgan al JSON, al calendario, al issue ni a la analítica | `toPublic.test.ts`, `calendario.test.ts`, `reportes.test.ts`, `vistaPreviaEvento.test.ts` y `analytics-privacidad.test.ts` — este último mete **centinelas en cada parámetro de cada evento**, uno por uno, así que un parámetro nuevo que acepte texto libre falla sin que nadie escriba el caso |
| El corte del bundle del panel (`db` de `firestore-client`, no de `firebase-client`) | `bundle-panel.test.ts`, cinco casos sobre el grafo de imports. El agente **no** lo re-verifica: solo mira lo que ese test no ve (la cadena de imports y el tercer chunk) |
| La guarda anti-loop y el diff por id de sesión | `calendario.test.ts` (`planificar` — guarda anti-loop, diff por id, cambio global, y "el payload propaga los campos nuevos") |
| slugify y la deduplicación de taxonomías | `slugify.test.ts` y `opciones.integracion.test.ts` contra el emulador |
| Que las reglas rechacen lo anónimo y lo que no es admin | `actividades.integracion.test.ts` y `reportes.integracion.test.ts`, con `EXIGIR_EMULADOR=1` en CI para que no se salteen en silencio |
| Qué deployar según lo que cambió | `que-deployar.test.ts`. El skill **usa** el script, no reimplementa la decisión |
| Que el formulario no tenga una sección sin capítulo en la guía | `ayuda.test.ts` |
| Marcadores de conflicto de git en archivos versionados | `sin-marcadores-de-conflicto.test.ts` |
| Que la credencial no se filtre al `dist/` | `scripts/verificar-bundle.sh`, gate bloqueante de los dos workflows |

### Porque un agente no es la herramienta

- **Verificar el sistema real** (leer el ICS del calendario, las cabeceras de
  cache, intentar la escritura anónima). Son comandos de
  [`07-seguridad.md`](07-seguridad.md) y [`08-operacion.md`](08-operacion.md)
  que necesitan red y secretos que un agente no debe tener en la mano. Queda como
  B-116.
- **Crear credenciales** (PAT, key de service account, toggles de consola). Lo
  prohíbe el §5.4 y lo dice el backlog: es trabajo del dueño.
- **Re-relevar el inventario de infra** (§ `02-infraestructura.md`): necesita
  `gcloud` autenticado. B-123.
- **Un auditor del sitio público** (SEO, indexabilidad, accesibilidad): no se
  puede escribir contra algo que todavía no existe (B-01). B-122.
- **Un agente de code review genérico**: es exactamente lo que Claude hace sin
  ayuda. No agrega conocimiento del proyecto.

---

## Cómo se usan juntos

El flujo de un cambio típico:

```
pedido → (campo-nuevo, si toca el modelo) → implementar
       → auditor-trampas        ─┐
       → auditor-privacidad     ─┤ en paralelo, son de solo lectura
       → auditor-documentacion  ─┘
       → cerrar-cambio (doc, CHANGELOG, ayuda, novedades, backlog)
       → /que-deployar → commit y push
```

Los tres auditores no se pisan: cada uno deriva al otro cuando algo no es suyo.
Y ninguno reemplaza a `npm test` — corren **además**, sobre lo que la suite no
puede ver.

Lo que falta para que esto se sostenga solo (hoy hay que invocarlos a mano) está
en el [`BACKLOG.md`](BACKLOG.md), B-115 a B-124.
