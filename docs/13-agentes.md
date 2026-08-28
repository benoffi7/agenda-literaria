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
| 🔒 | `auditor-privacidad` | agente (solo lectura) | Que nada privado llegue a las cinco salidas públicas |
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

**Para qué.** El proyecto tiene **cinco salidas públicas** y una sola regla
(§5.1), y cada una tiene su productor: `calendario.js` para el evento de Calendar,
`reportes.js` para el issue de GitHub (el repo es público), `analytics-eventos.ts`
para GA4 —la más estricta, donde no sale contenido ni con permiso del dueño— y
`textoRedes.ts` para el texto que se copia a redes, que es la más **irreversible**
de todas: un posteo pegado en Instagram ya está copiado.

La primera —el `events.json` y las páginas— es la excepción: desde B-106 son
**tres archivos en serie**, y hay que auditar los tres. `toPublic.ts` decide qué
*puede* ser público, `eventsJson.ts` decide qué necesita el listado (que es
menos), y `events.json.ts` decide *qué documentos* se leen — el `where` del §5.3.
La fila 1 de la tabla nombraba solo el primero hasta el 2026-08-27 (B-218), que es
la forma de B-216 un archivo más adentro: con la tabla vieja, un cambio que tocara
solo `eventsJson.ts` no despertaba a este agente por nombre de archivo.

El agente sabe qué archivo produce cada una, qué nunca sale, y las excepciones que
cuestan de recordar (`online.urlPublica` vale para el JSON y el calendario pero
**nunca** para la analítica ni para el posteo; el historial de versiones guarda el
documento entero sin proyectar a propósito).

> **La quinta salida faltaba en la ficha del agente hasta el 2026-08-27**, y el
> agujero era del peor tipo: `textoRedes.ts` está bien cubierto por sus tests, así
> que ningún test fallaba — lo que faltaba era que **el índice del agente la
> nombrara**, y su `description` no incluía el archivo, así que un cambio que
> interpolara un campo nuevo en el posteo no lo invocaba. Lo encontró el
> `auditor-documentacion` auditando el cambio que arregló las cinco salidas en
> `07-seguridad.md` y se olvidó de espejarlo acá. Moraleja para la próxima salida
> nueva: son **tres** lugares (el documento de seguridad, el cuerpo del agente y
> su `description`), y el tercero es el que decide si el agente se entera.

**Cuándo se invoca.** Antes de cerrar cualquier cambio que toque una salida, el
modelo, el schema, las reglas o el bundle. Su `description` nombra los archivos
para que Claude lo elija solo.

**Qué agrega sobre los tests.** Los tests verifican los campos que conocen. Este
agente verifica tres cosas que ningún test puede: que un **campo nuevo** tenga
las cinco celdas decididas, que la **forma** de la proyección siga siendo una
whitelist (un `...actividad` no filtra nada hoy y publica el campo de mañana), y
que exista un test que fije la decisión. No corre la suite: eso lo hace el CI.

**Qué NO hace.** No escribe, no arregla, no corre tests ni builds ni deploys, no
lee secretos (`.env`, la URL del ICS, el PAT), y no propone aflojar un test para
que pase un cambio.

**Qué devuelve.** Veredicto (`LIMPIO` / `HALLAZGOS: N`), la tabla de los campos
tocados contra las cinco salidas, un bloque por hallazgo (severidad P0/P1/P2,
`archivo:línea`, qué se filtra, el arreglo mínimo, el `it(...)` que lo fijaría) y
qué verificó que estaba bien.

**Modelo: `opus`.** Es el único con el modelo caro, y a propósito: el costo de
un falso negativo acá es una credencial filtrada o un link de reunión público, y
las dos cosas son irreversibles.

### 🪤 `auditor-trampas`

**Para qué.** Las once trampas del §13 más los patrones de
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
arranca obligando a decidir las cinco salidas **antes** de escribir código, que
es la parte que no se puede deshacer. DEC-1 (el libro presentado) fue su primer
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

### 🛡️ `antes-de-pushear`

El pedido era que los auditores **prevengan antes de pushear** y que se lancen
todos. Este skill lanza los tres en paralelo, junta los hallazgos y decide si el
push sale.

La parte que importa es el corte: un hook de git **no puede invocar un modelo**,
así que lo mecánico (marcadores de conflicto, typecheck, tests con emuladores,
build, fuga de credenciales) vive en `githooks/pre-push` →
`scripts/verificar-todo.sh`, y lo que necesita criterio (¿este campo nuevo es
publicable?, ¿el código nuevo cae en una trampa del §13?, ¿la doc acompañó?)
vive acá. El skill **no** re-verifica lo mecánico: corre el script y lee el
resultado, porque un modelo reimplementando lo que un script ya decide es una
segunda copia que se va a quedar vieja.

Cierra B-115: hasta ahora nada invocaba a los auditores juntos, así que existían
pero solo corrían si alguien se acordaba de los tres.

### 🔁 `automatizar`

La mejora continua, con una regla sola: **la segunda vez es la señal.** Busca lo
que ya se hizo a mano más de una vez —o el error que ya volvió con otra cara— y
elige la forma: test, script, hook, skill o auditor.

Lleva adentro los cinco casos que este repo ya pagó (la decisión de deploy que
vivía en un `if` del YAML, la búsqueda de `firebase-admin` duplicada en dos
workflows, los 43 tests que se salteaban en silencio, los marcadores de conflicto
commiteados dos veces, el fixture flojo que dejó pasar tres bugs). Están ahí como
**calibración**: sin ejemplos, "¿esto amerita automatizarse?" se contesta distinto
cada vez.

Es la respuesta a la regla de que un bug no puede volver a aparecer —no el bug,
**la idea del bug**—: cuando algo reaparece con otra cara, lo que falta no es el
arreglo, es el detector.

---

## Qué se decidió no automatizar

### Porque ya hay un test, y duplicarlo daría falsa cobertura

| Lo que se pensó como agente | Quién ya lo verifica |
|---|---|
| Que el link de la reunión y la difusión no salgan al JSON, al calendario, al issue ni a la analítica | `toPublic.test.ts`, `calendario.test.ts`, `reportes.test.ts`, `vistaPreviaEvento.test.ts` y `analytics-privacidad.test.ts` — este último mete **centinelas en cada parámetro de cada evento**, uno por uno, así que un parámetro nuevo que acepte texto libre falla sin que nadie escriba el caso |
| El corte del bundle del panel (`db` de `firestore-client`, no de `firebase-client`) | `bundle-panel.test.ts`, cinco casos sobre el grafo de imports. El agente **no** lo re-verifica: solo mira lo que ese test no ve (la cadena de imports y el tercer chunk) |
| La guarda anti-loop y el diff por id de sesión | `calendario.test.ts` (`planificar` — guarda anti-loop, diff por id, cambio global, y "el payload propaga los campos nuevos") |
| slugify y la deduplicación de taxonomías | `slugify.test.ts` y `opciones.integracion.test.ts` contra el emulador |
| Que las reglas rechacen lo anónimo y lo que no es admin | `actividades.integracion.test.ts` y `reportes.integracion.test.ts`, con `EXIGIR_EMULADOR=1` en CI para que no se salteen en silencio. **Esta fila decía menos de lo que parecía hasta el 2026-08-27:** los casos anónimos eran de **escritura**, y del lado de la lectura había un `it('un anónimo lee lo publicado')` en verde que estaba fijando una fuga (B-208, D-128). Hoy hay tres `it` de lectura —por documento, por query, y un control positivo— y el archivo empuja las reglas del checkout al emulador con `cargarReglas`, que antes no hacía |
| Que `storage.rules` rechace lo anónimo, lo que no es admin, el tipo, el tamaño de más, el nombre libre y el **listado** del prefijo | `storage-reglas.integracion.test.ts`, subiendo de verdad contra el emulador y con las reglas empujadas desde el checkout. Verificado por mutación: sacar `tamanoAceptado()` lo pone en rojo. El caso del `list` no es decorativo — con `allow read: if true` un `listAll()` anónimo devolvía el bucket entero, y así se encontró |
| Que ningún archivo versionado publique un uid de Firebase ni una casilla de correo personal | `sin-datos-personales.test.ts` (B-209). Es **angosto a propósito**: mira la forma de un uid y los proveedores de correo gratuitos. Un mail en dominio propio puede ser un fixture inventado o el real de una sede, y el test no puede distinguirlos sin versionar la lista de dominios reales — o sea, el dato que no queremos versionar. **Esa mitad sí es del `auditor-privacidad`** |
| Que ningún campo privado del modelo llegue al `events.json` ni al evento de Calendar cuando se agrega un campo nuevo | `barrido-de-salidas-publicas.test.ts` (B-196): inyecta centinelas y los busca en las dos salidas, en las dos direcciones, con un fixture que se autoexige actualizado campo por interfaz. **Le sacó trabajo al `auditor-privacidad`**, que ya no tiene que reportar la instancia — solo el campo nuevo que el fixture todavía no ancló |
| Que el `events.json` que se sube salga del `where('estado','==','publicado')` y no lleve los campos recortados | `events-json-endpoint.integracion.test.ts` (B-218) siembra una publicada y las tres que no son públicas —borrador, cancelada, pendiente— y afirma sobre el JSON que devuelve el endpoint. **De integración y no de texto a propósito:** un `grep` al fuente buscando la cláusula pasaría con la cláusula escrita mal (`'Publicado'`, `'!='`, el campo renombrado). Y `scripts/build-contra-emulador.mjs` (B-217) hace la misma afirmación sobre el `dist/events.json` de verdad, en el paso 4 del gate: entre el valor de retorno de `construirIndice` y el archivo que sube al Hosting están el `JSON.stringify` y la serialización del endpoint |
| Que un trigger nuevo con efecto duplicable nazca sin guarda, y las demás clases de bug del repo | `clases-de-bug.test.ts` (B-135). Descubre los triggers **del fuente** en vez de listarlos, así que un trigger nuevo entra al chequeo solo |
| Que las opciones de `/opciones/*` no publiquen la huella del creador ni los campos de gestión | `barrido-de-salidas-publicas.test.ts` (B-212): `ValorOpcion` dejó de estar en la lista de interfaces AJENAS y pasó a estar anclada, con centinelas propios. El control negativo está **codificado** (no verificado a mano): un `it` mete el spread y exige que el barrido falle nombrando `opcion.huellaCreador`. Y la clase de B-212 en `clases-de-bug.test.ts` ata los **tres** caminos que proyectan una opción —`opcionesPublicas`, `labelsDeOpciones` y el `cargarLabels` de la Function, que no puede importar de `src/` (D-20)— derivando del modelo qué campos están prohibidos |
| Que ninguna capa modal reimplemente el atrapar-el-Tab, el scroll y el foco | `foco.test.ts` (B-210). Afirma la **propiedad** (que la capa use `useCapaModal` y no tenga cableado propio), no el string de una implementación: la versión anterior buscaba `e.key==='Escape'` dentro de un `.tsx` y un refactor la ponía en rojo |
| Que nadie escriba un catorceavo doble de `Timestamp` | `clases-de-bug.test.ts` (B-211). Busca la **forma** —`toDate` y `toMillis` juntos— y no el nombre, así que también caza al que se llame `stamp` o `t`. Existe porque el fixture compartido ya se había escrito y **no se había adoptado**, que es un modo de falla que no tenía red |
| Que el mapa de trampas → test → archivo diga la verdad | `mapa-de-trampas.test.ts` (B-119). Lee la lista de trampas del propio `CLAUDE.md` §13 y **calcula del repo** cuáles quedaron sin red, en las dos direcciones. Es el motivo por el que el `auditor-trampas` ya no reconstruye esa tabla con `grep` |
| Qué deployar según lo que cambió | `que-deployar.test.ts`. El skill **usa** el script, no reimplementa la decisión |
| Que `firebase-admin` no se importe fuera de su propia puerta | `build-credenciales.test.ts`, que recorre todo `src/`. Se le sacó la línea al `auditor-privacidad` cuando ese test existió (`1.2.0`): el agente ahora mira solo lo que el barrido no ve — imports dinámicos y el `ssr.external` de la config |
| Que el borrador autoguardado no salga del navegador ni pase por la analítica | `autoguardado.test.ts`, que lee el código del módulo y del hook con los comentarios afuera. **Ojo con la forma del aserto:** buscar un nombre con `toContain` lo satisface el `import`, así que los dos que fijan los saneadores del punto de recuperación afirman la **llamada**, con los espacios colapsados (D-124) |
| Que el formulario no tenga una sección sin capítulo en la guía | `ayuda.test.ts` |
| Que la ayuda del **sitio público** no enumere tipos de actividad que el modelo ya cambió, y que no falte una de las preguntas que hay que contestar | `ayuda-del-sitio.test.ts` (B-232). El glosario se **deriva** de `opciones-base.json`, así que una categoría base nueva —`feria` (B-129) y `libreria-a-la-calle` ya entraron después del `CLAUDE.md`— sale nombrada en el error en vez de dejar una lista de cinco tipos mientras el sitio muestra siete. La lista de preguntas obligatorias va con el motivo de cada una: una página de ayuda se degrada por lo que le sacan. Incluye el barrido de centinelas (§5.1) sobre el texto libre, el piso de contraste AA, y **el conteo que la doc afirma**, que el `auditor-documentacion` encontró mintiendo en cinco lugares el día que se escribió |
| Que un motivo de contacto nuevo aparezca en la página pero sin decir qué conviene contar, y que ninguna página escriba el `mailto:` a mano | `contacto-del-sitio.test.ts` (B-232). Los bloques se derivan de `MOTIVOS_DE_CONTACTO` (B-228), así que un motivo nuevo se muestra solo —y su lista, que no se escribe sola, queda exigida. La guarda del `mailto:` es la clase B-72/B-88: una dirección pegada en el marcado anda igual de bien hoy y se rompe el día que la casilla cambie, en una sola de las páginas y sin que nada falle |
| Que una página pública pegue a mano la dirección del calendario —sobre todo la variante `private-`, que da acceso de lectura al calendario entero— en vez de importarla de `enlaces.ts` | `suscribirse.test.ts` (B-230). Son dos barridos y hacen falta los dos: uno sobre el **markup** de la página y sus componentes, que falla ante cualquier `https?`/`webcal://` escrito, y otro sobre el **contenido**, que exige que cada dirección sea exactamente una de las que produce `enlaces.ts`. `enlaces.test.ts` cubría solo al **productor**; esto cubre a los consumidores, y el patrón vale para toda página futura que enlace afuera |
| Que la página que explica el calendario siga diciendo la verdad sobre lo que el calendario hace | `suscribirse.test.ts` (B-230), cuatro `it` contra `construirEvento`/`planificar`: el link de la reunión con el valor de fábrica y con `urlPublica`, el encuentro cancelado que se borra, y los ocho eventos distintos de un ciclo. Es la lección de B-63 aplicada afuera del panel — un chequeo puede verificar que el texto **esté**, nunca que sea **cierto** || Marcadores de conflicto de git en archivos versionados | `sin-marcadores-de-conflicto.test.ts` |
| Que la credencial no se filtre al `dist/` | `scripts/verificar-bundle.sh`, gate bloqueante de los dos workflows. **Esta fila era falsa hasta el 2026-08-25:** `deploy.yml` tenía el `grep` copiado en YAML y la copia había perdido la guarda final —que `dist/` tenga al menos un `.js`—, así que un build vacío pasaba el gate habiendo verificado nada (B-195). Ahora los dos llaman al script, y `workflows.test.ts` exige que todo workflow que buildee lo haga |
| Que los workflows de Actions parseen y tengan los triggers que el §8 necesita | `workflows.test.ts` (trampa 11, B-188): parsea en modo estricto, exige `name` y al menos un trigger, y ata el `event_type` que manda la Function con el `repository_dispatch` del workflow. Mira `doc.errors` y no el objeto parseado, porque el parser se recupera del error y devolvería `name` y `on` sobre un archivo que en GitHub no funciona |
| Que ningún `run:` de un workflow interpole datos que no controlamos, y que el motivo del rebuild sea opaco | `workflows.test.ts` y `costuras.test.ts` (B-195). El segundo es una propiedad y no una lista: ninguna interpolación del motivo puede tener un punto, porque no hay forma de alcanzar un campo del documento sin un acceso a propiedad |
| Que `02-infraestructura.md` y `07-seguridad.md` declaren los mismos roles de `deploy-ci@`, y que `07-seguridad.md` **no** afirme que el daño se limita a leer mientras la lista tenga un rol de escritura | `roles-deploy-ci.test.ts` (B-195, D-119, D-132). El drift entre las dos listas es cómo una afirmación de seguridad estuvo mintiendo una hora. El segundo chequeo lo agregó D-132, que le devolvió a la cuenta los roles de escritura: lo que queda prohibido no es tenerlos, es tenerlos y seguir diciendo que no |

### Porque un agente no es la herramienta

- **Verificar el sistema real** (leer el ICS del calendario, las cabeceras de
  cache, intentar la escritura anónima). Son comandos de
  [`07-seguridad.md`](07-seguridad.md) y [`08-operacion.md`](08-operacion.md)
  que necesitan red y secretos que un agente no debe tener en la mano. Queda como
  B-116.
- **Crear credenciales** (PAT, key de service account, toggles de consola). Lo
  prohíbe el §5.4 y lo dice el backlog: es trabajo del dueño.
- **Re-relevar el inventario de infra** (§ `02-infraestructura.md`): necesita
  `gcloud` autenticado, así que no lo puede hacer un agente. **Pero sí un script**:
  `scripts/relevar-infra.sh` lo releva y lo compara contra el documento (B-123,
  cerrado el 2026-08-25). La mitad que decide —`comparar-infra.sh`— está separada y
  tiene tests, porque no necesita credenciales. Lo que queda del lado del dueño es
  correrlo.
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
