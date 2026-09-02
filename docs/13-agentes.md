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
| 🔒 | `auditor-privacidad` | agente (solo lectura) | Que nada privado llegue a las diez salidas públicas |
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

**Para qué.** El proyecto tiene **diez salidas públicas** y una sola regla
(§5.1), y cada una tiene su productor: `calendario.js` para el evento de Calendar,
`reportes.js` para el issue de GitHub (el repo es público), `analytics-eventos.ts`
para GA4 —la más estricta, donde no sale contenido ni con permiso del dueño—,
`textoRedes.ts` para el texto que se copia a redes, que es la más **irreversible**
de todas —un posteo pegado en Instagram ya está copiado— y, desde **B-227**,
`detallePublico.ts` para la **página de detalle y su JSON-LD**, que es HTML
indexado: la que un bot cosecha primero y la que se queda en Google.

Desde **B-113** hay una octava, `mesPublico.ts` para la **página de mes**
`/agenda/{aaaa-mm}`: no publica ni un campo que la primera no publique ya —es el
mismo índice reagrupado— pero es una página indexada más y una de sus tres frases
**interpola títulos de actividades** en la `meta description`, que es justo la
clase que este agente persigue. Está contada porque lo que decide si el agente
mira un archivo es que la tabla lo nombre, no que hoy filtre algo.

La primera —el `events.json` y el HTML del listado— es la excepción: desde B-106
son **tres archivos en serie**, y hay que auditar los tres. `toPublic.ts` decide
qué *puede* ser público, `eventsJson.ts` decide qué necesita el listado (que es
menos), y `contenidoDelSitio.ts` decide *qué documentos* se leen — el `where` del
§5.3, que se mudó ahí desde `events.json.ts` en B-227 porque ahora son tres los
consumidores del build. Desde **B-110** son **dos** `where` —`publicado` para todo
y `cancelado` solo para generar su página— más `estuvoPublicada`, que consulta
`/actividades/{id}/versiones`: es la única lectura del build que sale de la
colección `/actividades`, y la única forma en que un documento no publicado
produce HTML (**D-159**).
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
las celdas decididas, que la **forma** de la proyección siga siendo una
whitelist (un `...actividad` no filtra nada hoy y publica el campo de mañana), y
que exista un test que fije la decisión. No corre la suite: eso lo hace el CI.

**Qué NO hace.** No escribe, no arregla, no corre tests ni builds ni deploys, no
lee secretos (`.env`, la URL del ICS, el PAT), y no propone aflojar un test para
que pase un cambio.

**Qué devuelve.** Veredicto (`LIMPIO` / `HALLAZGOS: N`), la tabla de los campos
tocados contra las diez salidas, un bloque por hallazgo (severidad P0/P1/P2,
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
arranca obligando a decidir las diez salidas **antes** de escribir código, que
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
| Que ningún campo privado del modelo llegue al `events.json`, al evento de Calendar, **a la página de detalle ni a la cartelera** cuando se agrega un campo nuevo | `barrido-de-salidas-publicas.test.ts` (B-196, extendido en B-227 y B-265): inyecta centinelas y los busca en las **cinco** salidas que proyecta —el `events.json`, el índice, el evento, la página de detalle con su JSON-LD y la cartelera—, en las dos direcciones, con un fixture que se autoexige actualizado campo por interfaz. **Le sacó trabajo al `auditor-privacidad`**, que ya no tiene que reportar la instancia — solo el campo nuevo que el fixture todavía no ancló |
| Que ningún **markup del sitio** —`src/pages`, `src/components/sitio`— atenúe texto por debajo del piso de WCAG AA **sobre el papel** | `contraste-del-sitio.test.ts` (B-235). Los ratios salen de los tokens de `global.css` —parseados, no copiados, así cambiar la paleta se nota—, con control positivo para que una lista vacía no signifique «no leí nada». La matemática está aparte, en `contraste.test.ts` (B-243). **Desde B-260 el sitio no tiene ninguna atenuación** —el sistema es a tintas planas— así que el archivo cambió de trabajo: afirma que sigan siendo cero y **mide igual** la que aparezca. Dos redes sobre la misma clase: `sistema-visual.test.ts` dice «no la pongas» y ésta «si la ponés, tiene que dar» |
| Lo mismo para el **listado**, que aquél no lee | `listado-del-sitio.test.ts` (B-247, rehecho en **B-260**). Aquél barre `src/pages` y `src/components/sitio`; el listado vive en `src/components/publico/*.tsx` y se apoya en `crema` y `hondo`, más oscuras que el papel. Con D-146 la regla de clase se endureció: **no se atenúa nada** —el sistema es a tintas planas, así que una opacidad no debería existir— y las dos tintas de regla (`borde` 4,26:1, `regla` 1,62:1) no pueden ser texto. Conserva la lista de los pares que el arte declara, cada uno con la clase que tiene que **seguir estando** en su archivo para que no envejezca dando cobertura de mentira. Fija además que el listado **no tenga ninguna imagen** (la decisión de forma de D-146, que se deshace en una línea), la grilla de 12 columnas, el marcador de mes, y lo de siempre del markup: ningún `div` con `onClick`, nadie apagando el anillo de foco, y qué campos de la entrada puede tocar la fila — con los dos asertos que impiden esquivar esa lista desestructurando |
| Que la **página de detalle** pierda una de las tres cosas de su forma que se rompen sin que se note | `detalle-visual.test.ts` (B-238, B-253, D-145). El CTA de inscripción **duplicado en pantalla** —se escribe dos veces, cada una detrás de un corte, y sacarle el `hidden` a una deja las dos visibles y el mismo enlace leído dos veces—, la barra fija sin el aire que evita que tape el pie, y `position: sticky` volviendo a entrar cuando el `body` recorta el `overflow`, que **no se pega y no avisa**. Desde B-273 fija además la cajita del tipo: que no lleve ninguna tinta de fondo escrita —una clase sobreviviente le gana al `style` inline y devuelve el color fijo— y que el texto siga siendo `text-papel`, que es la mitad del par que `color-de-tipo.test.ts` mide |
| Que el sitio público se salga del **sistema visual** aprobado — radio, sombra, degradado, una tipografía vieja, una opacidad, dos tintas del mismo tipo sobre un elemento, o una utilidad propia que le pise el nombre a una de Tailwind | `sistema-visual.test.ts` (**B-260**, D-146). Barre **todo** el markup del sitio, no el que alguien se acordó de revisar, y **ata cada token de `global.css` al hex exacto de `docs/referencias/sistema-visual.md`** —ida y vuelta por OKLCH, y en las dos direcciones: el hex que el test afirma también tiene que estar escrito en el documento—. Son reglas que se rompen de a una sin que falle nada: un `rounded-lg` se ve bien solo, y un `font-serif` sobreviviente **pinta Georgia con el build en verde**, porque el token del proyecto se borró y Tailwind trae el suyo. Las dos guardas más finas salieron de **leer el HTML y el CSS construidos**, no de un test: dos utilidades del mismo tipo en un elemento las resuelve el orden de emisión de Tailwind y no el markup, y un `@utility` propio que se llame como uno generado desde un token pierde en silencio |
| Que ningún componente del sitio público use texto por debajo del piso de contraste de WCAG AA, **sobre cualquiera de sus superficies** | `contraste-del-sitio.test.ts` (B-235/B-243): calcula los ratios desde los tokens de `global.css` —parseados, no copiados, así cambiar la paleta se nota— y falla si algún archivo del sitio escribe una clase por debajo del piso, con control negativo para que el piso signifique algo. **Medía solo contra `papel`**, y con las tres superficies de D-141 eso da un número optimista: `text-tinta/61` pasa sobre papel (4,62) y no sobre la más oscura (4,38). `contraste-de-superficies.test.ts` (**B-256**) mide lo mismo contra las tres, **derivadas de la hoja de estilos** en vez de enumeradas, así que una superficie nueva y más oscura entra sola al cálculo. **Desde B-260 mide las cinco tintas del sistema** en vez de los 360 tonos por tipo, que se habían retirado con el color derivado del slug (D-146) — y ahí aparece el número que importa: `azul` da 6,14:1 sobre el papel y **4,99:1 sobre `hondo`**, o sea que el margen que sobra arriba casi no existe abajo. Tiene control negativo: las dos tintas de regla **tienen** que dar por debajo del piso, si no la aritmética no está midiendo. Es la clase, no la instancia: la paleta puede estar perfecta y el componente siguiente bajarla igual, que es justo lo que había pasado |
| Que el **color del tipo de actividad** —el único color del sitio que sale de un dato y no de la paleta— deje ilegible el nombre de la categoría | `color-de-tipo.test.ts` (**B-270**, D-150). Recupera el barrido de los **360 tonos** que D-146 había retirado, y lo mide contra las **tres** superficies en vez de contra el papel: el peor da 5,90:1 contra un piso de 4,5. Es la garantía que hace posible que alguien elija el color desde el panel sin poder equivocarse — y solo se puede dar porque la luminosidad y el croma son fijos, o sea que el espacio tiene **una** dimensión y se recorre entero. Cubre además las tres guardas que la sostienen el día que la banda se afloje (`revisarTono` al guardar, `esTonoElegible` al leer, el filtro al proyectar), que la tabla de tonos de arranque no nombre tipos que ya no existen, y que el build y el cliente deriven el color de **un solo lugar**. Dos casos se afirman sobre el fuente y no ejecutando, con el motivo escrito: con la banda de hoy no se pueden disparar, y un test que no puede activar una guarda no la verifica. **Desde B-273 (D-153) mide las dos direcciones de la misma tinta**: el color como texto sobre las superficies —la cajita del listado— y el **papel calado encima del color** —la cabecera del detalle—, que es otro par y da otro número (el peor de los 360, 7,27:1). Y ata las dos pantallas: el `tipoColor` del detalle y el `estiloDeTipo` del listado tienen que producir **el mismo valor**, con matiz elegido y sin él, que es la clase de B-88 y la que dejó pasar el bug |
| Que el sitio público vuelva a copiar el anillo de foco a mano, o escriba el nombre del sitio literal | `estilos-del-sitio.test.ts` (**B-257**). El anillo estaba copiado **doce veces** y la clase del enlace acentuado cinco: la copia que se escriba con un typo deja **un** control sin foco visible, y eso no lo ve nadie que use el mouse, no lo dice el compilador y no lo dice ningún chequeo de contraste. Ahora sale de `src/components/sitio/estilos.ts` y esto lo sostiene, **con las dos mitades**: que nadie lo escriba a mano, y que todo archivo con un enlace o un botón lo importe — porque «no lo escribe a mano» también lo cumple una página sin foco en ninguna parte. La segunda mitad barre `NOMBRE` y `BAJADA` literales (D-141). `src/components/publico/*` queda fuera de alcance **a propósito**: son componentes de React y esto barre markup `.astro`. `src/pages/index.astro` **entró al alcance en B-113**: la exclusión decía «es de otro frente» y dejó de serlo cuando la home empezó a importar `claseEnlace` para la tira de meses — una exclusión que ya no hace falta es una exclusión que tapa lo próximo que entre por ahí |
| Que una página del sitio público se titule con **su categoría** en vez de con el nombre del sitio | `identidad.test.ts` (**B-245**). Barre **todos** los `.astro` de `src/pages` —`/admin` incluido, que es la pestaña que el dueño tiene abierta todo el día— y exige que el `titulo` de cada uno lleve `NOMBRE`, literal o interpolado. Es el **complemento** de la fila de arriba y no la misma cosa: aquél barre que nadie lo escriba **a mano**, éste que nadie se **olvide** de ponerlo, y «no lo escribe a mano» también lo cumple una página que no lo pone en ninguna parte. Es la clase de error que hizo nacer el módulo —el sitio se presentaba como «Agenda literaria», que es su categoría— y no rompe nada: se ve bien, y el sitio queda sin identidad en la pestaña, en el historial y en Google, que son los tres lugares donde la gente lo vuelve a encontrar. La página cuyo título sale de otra parte **no se cuenta como falla**, con el motivo escrito: la cubre su propio test |
| Que el `events.json` que se sube salga del `where('estado','==','publicado')` y no lleve los campos recortados | `events-json-endpoint.integracion.test.ts` (B-218) siembra una publicada y las tres que no son públicas —borrador, cancelada, pendiente— y afirma sobre el JSON que devuelve el endpoint. **De integración y no de texto a propósito:** un `grep` al fuente buscando la cláusula pasaría con la cláusula escrita mal (`'Publicado'`, `'!='`, el campo renombrado). Y `scripts/build-contra-emulador.mjs` (B-217) hace la misma afirmación sobre el `dist/events.json` de verdad, en el paso 4 del gate: entre el valor de retorno de `construirIndice` y el archivo que sube al Hosting están el `JSON.stringify` y la serialización del endpoint. Desde **B-110** el gate afirma también sobre el **HTML** que salió —que la cancelada que estuvo publicada tenga su página con la franja, el `EventCancelled` y sin campos privados, y que la que nunca lo estuvo no tenga archivo—, que es la mitad que ningún unitario puede mirar: `caminosDeDetalle` devuelve rutas, Astro escribe los archivos |
| Que la **cartelera** publique algo que la página de detalle no publique, se arme listando el bucket, o muestre el afiche de algo que no se hace | `cartelera.test.ts` y el `describe` de la cartelera en `barrido-de-salidas-publicas.test.ts` (**B-265**). Desde **B-110** cubre además la actividad **cancelada**: la pared no la muestra, y la regla está escrita **dos veces a propósito** —el lector no se la pasa y `carteleraDeDetalles` la descarta igual—, porque «la pared no muestra canceladas» es una regla de la pared y si vive solo en el lector, el día que su default cambie el afiche sale sin que nada falle. El segundo filtro tiene su propio caso, con control positivo: sin él, borrarlo dejaba todo en verde (lo marcó el `auditor-privacidad`). La salida 7 **deriva de la 6**, así que la afirmación de fondo es de forma y no una lista: **todo string del afiche tiene que estar en el JSON del detalle**. Si alguien le pasa a la pared la `ActividadPublica` o el documento «para tener un dato que el view-model no trae», se pone rojo aunque el barrido de centinelas siga pasando. Y la trampa propia de una página de imágenes —armarla con un `listAll()` sobre `imagenes/`, que no pasa por ninguna proyección y trae los flyers de lo que está en borrador (trampa 13)— tiene su aserto explícito. Fija además **cuál** imagen se muestra (**B-268**): la que tiene el flag `portada`, no la primera cargada. La versión anterior afirmaba el comportamiento —`imagenes[0]`— en vez del invariante, y por eso el bug pasó por dos salidas sin que nada fallara |
| Que **alguna salida del sitio vuelva a recortar una imagen** | `afiche.test.ts` (**B-263**, D-147). Reemplaza al aserto que ataba la página de detalle al token `--aspect-portada`, y es más fuerte por dos motivos: barre **todos** los `.astro` del sitio en vez de un archivo —así la página que se escriba el mes que viene entra sola— y prohíbe la **operación** (`object-cover`, una proporción escrita a mano) en vez de exigir un número. Un número compartido no impedía que un consumidor lo usara con `cover` y otro con `contain`, que es como volvería la divergencia que B-249 quería frenar. Cubre además la lógica pura: una medida corrupta (`alto: 0`) tiene que dar «no sé» y no `aspect-ratio: 720 / 0`, que es la imagen desaparecida con el build en verde |
| Que la **tira de imágenes secundarias del detalle** vuelva a mostrar una sola, herede el `alt` del título, se pida `eager` o suba a la primera pantalla | `galeria-del-detalle.test.ts` (**B-296**, D-168), en las dos mitades de D-140: qué decide el view-model —cuál es la portada y cuáles las demás— sobre las funciones de verdad, y qué atributos escribe la plantilla leyendo el `.astro`, que vitest no renderiza. Los cuatro modos de falla son **silenciosos en la pantalla**: un `eager` de más se ve idéntico y lleva la página peor medida de 1,07 MB a 3,15 MB en la primera carga; un `alt` heredado se ve idéntico y le lee tres veces lo mismo a quien escucha la página. Y `scripts/build-contra-emulador.mjs` (pasos 8a-8h) afirma lo mismo sobre el **HTML de verdad** con tres imágenes de proporciones distintas —el caso que ningún unitario puede renderizar—, con la página de **una sola** imagen como control: la sección no puede aparecer ahí, y es el 87 % de las actividades que tienen imagen |
| Que el flyer se vuelva **obligatorio** para publicar | `flyer-en-el-panel.test.ts` (**B-264**). Es la fila rara de esta tabla: no frena un bug, frena una *mejora* que sería un error. Todo el cambio empuja a cargar el flyer y el empujón se convierte en traba con una línea —agregar `imagenes` a la validación de publicación de D-120—; bloquear la publicación por una imagen frena que se carguen actividades, que es peor que una actividad sin flyer. El mismo archivo fija que el editor no vuelva a «Opcional» y que la ayuda no vuelva a describir pantallas que ya no existen (B-267) |
| Que un trigger nuevo con efecto duplicable nazca sin guarda, y las demás clases de bug del repo | `clases-de-bug.test.ts` (B-135). Descubre los triggers **del fuente** en vez de listarlos, así que un trigger nuevo entra al chequeo solo |
| Que las opciones de `/opciones/*` no publiquen la huella del creador ni los campos de gestión | `barrido-de-salidas-publicas.test.ts` (B-212): `ValorOpcion` dejó de estar en la lista de interfaces AJENAS y pasó a estar anclada, con centinelas propios. El control negativo está **codificado** (no verificado a mano): un `it` mete el spread y exige que el barrido falle nombrando `opcion.huellaCreador`. Y la clase de B-212 en `clases-de-bug.test.ts` ata los **cuatro** caminos que proyectan una opción —`opcionesPublicas`, `labelsDeOpciones`, el `cargarLabels` de la Function (que no puede importar de `src/`, D-20) y `etiquetasDelDetalle` (`src/lib/contenidoDelSitio.ts`, sumado en **B-270**: alimenta la salida 6 y era el único sin nada que nombrara qué podía leer)— derivando del modelo qué campos están prohibidos. Desde D-150 la lista de lo permitido es **por camino** y no una sola: `tono` es público de **una sola salida**, y una lista compartida habría abierto los cuatro de golpe por un campo que necesita uno |
| Que ninguna capa modal reimplemente el atrapar-el-Tab, el scroll y el foco | `foco.test.ts` (B-210). Afirma la **propiedad** (que la capa use `useCapaModal` y no tenga cableado propio), no el string de una implementación: la versión anterior buscaba `e.key==='Escape'` dentro de un `.tsx` y un refactor la ponía en rojo |
| Que nadie escriba un catorceavo doble de `Timestamp` | `clases-de-bug.test.ts` (B-211). Busca la **forma** —`toDate` y `toMillis` juntos— y no el nombre, así que también caza al que se llame `stamp` o `t`. Existe porque el fixture compartido ya se había escrito y **no se había adoptado**, que es un modo de falla que no tenía red |
| Que el mapa de trampas → test → archivo diga la verdad | `mapa-de-trampas.test.ts` (B-119). Lee la lista de trampas del propio `CLAUDE.md` §13 y **calcula del repo** cuáles quedaron sin red, en las dos direcciones. Es el motivo por el que el `auditor-trampas` ya no reconstruye esa tabla con `grep` |
| Que el **dominio del sitio** vuelva a escribirse en más de un lugar, o que la canónica salga relativa | `canonico.test.ts` (**B-109**, D-165). Cuatro salidas necesitan la URL absoluta —el `canonical`, el `og:url`, el `<loc>` del sitemap y el `url` del JSON-LD— y las cuatro copias fallan en silencio: un canonical viejo hace que Google indexe otro dominio. Barre **todo `src/`** buscando el dominio y exige que solo lo escriba el archivo que lo define, que `astro.config.mjs` lo **importe** en vez de copiarlo, y que la canónica sea absoluta y salga del layout una sola vez —una relativa se resuelve contra el host que la sirvió, o sea que en el espejo de Firebase diría que la página buena es la del espejo—. Cubre además el par que el repo no controla: `cleanUrls` y `trailingSlash` de `firebase.json` y el `build.format` de Astro, que son los que hacen cierta la barra final que `rutaCanonica` predice |
| Que el **sitemap** ofrezca al buscador una página que no debería estar en Google | `sitemap.test.ts` (**B-109**, D-166). Es la salida donde el error caro es al revés del habitual: no filtrar de más, sino **ofrecer**. Los cinco modos de falla tienen su caso con la mutación anotada —la pasada de más de 90 días, la cancelada de más de 30, el mes con dos actividades, `/admin` colándose y la URL relativa—, más dos guardas de lista que son las que envejecen: **toda ruta fija tiene que tener una página en disco** (si no se le ofrece un 404 al buscador) y **toda página estática del sitio tiene que estar en la lista o exceptuada con su motivo**, así que la página que nazca no entra sola ni se olvida. Fija también que no se emita `lastmod` con la fecha del build y que el `robots.txt` no reemplace el `noindex` del panel |
| Que `/pasadas` deje una actividad publicada sin ninguna página que la enlace | `pasadas.test.ts` (**B-109**, D-167). El aserto que importa es un **invariante**: la home y `/pasadas` parten en dos el conjunto de las publicadas — ninguna en las dos, ninguna en ninguna. Una que quede afuera de las dos es una página huérfana, y desde B-109 eso es literal y medible: su entrada del sitemap vence a los 90 días, así que a partir de ese día no la enlaza nada. Cubre además el orden del archivo (de lo más reciente a lo más antiguo, que es lo que hace útil la cabecera) y que las canceladas no puedan entrar ni queriendo |
| Qué deployar según lo que cambió | `que-deployar.test.ts`. El skill **usa** el script, no reimplementa la decisión |
| Que **la decisión de plomería del propio gate** —usar los emuladores que están o levantar unos efímeros— elija mal | `emuladores-arriba.test.ts` (**B-180**). La decisión salió de `verificar-todo.sh` a `scripts/emuladores-arriba.sh` por el mismo argumento que sacó `que-deployar.sh` del YAML: una decisión que no se puede probar se prueba en producción, y acá «producción» es el momento de pushear. Se prueba con un **servidor HTTP de dos líneas** apuntado por `FIREBASE_EMULATOR_HUB`, así que las tres respuestas —contesta, no contesta, contesta 503— quedan ejercitadas sin arrancar ningún Java. El aserto que sostiene el resto es el último: que el gate **consuma** el script y no tenga su propia copia, porque extraer la decisión y dejar la copia adentro es peor que no extraerla. Ojo con `execFileSync` en un test así: el servidor de mentira vive en el mismo proceso, así que una llamada sincrónica bloquea el event loop y el caso «arriba» da `false` — el test mediría el bloqueo y no la decisión |
| Que dos checkouts corriendo tests **se vacíen la base del emulador** entre sí | `emulador-aislado.test.ts` (**B-219**, D-195) y `scripts/probar-concurrencia.sh`. Es la fila que más veces mordió del repo: cinco observaciones independientes, tres worktrees, dos días, y ninguna reproducible a voluntad. El test tiene las dos mitades: el **mecanismo** contra el emulador de verdad —sembrar en dos proyectos, borrar uno, y verificar que el otro sobrevivió, más lo mismo con la carga de reglas— y el **cableado**, que es el que impide que el arreglo se afloje solo: que ningún archivo de integración vuelva al literal `'agenda-literaria'`, que `vitest.config.ts` importe el valor en vez de derivarlo de nuevo, que el gate en bash lo lea del mismo lugar, y que **todo projectId que salga hacia el emulador derive de `PROJECT_ID`** —incluidos los proyectos auxiliares, que es la instancia que apareció probando el arreglo con dos corridas a la vez—. Y el script reproduce la falla a pedido: **6 de 6 rojo** con `--misma-base`, verde sin la bandera. Sirve para mutar el arreglo, no solo para verificarlo |
| Que un test de reglas verifique el `firestore.rules` **de otro checkout** | los cuatro archivos de integración empujan el archivo de al lado con `cargarReglas()` (**B-174**). Era el modo de falla más caro que puede tener un test de reglas —dice «las reglas pasaron» cuando quiere decir «unas reglas pasaron»— y dejó de ser una mejora para volverse **obligatorio**: con la base por checkout de B-219, una base nueva arranca **sin reglas**. `emulador-aislado.test.ts` lo verifica derivando la lista: todo archivo de integración que use el SDK de cliente tiene que cargarlas, así que el archivo que se escriba mañana entra solo |
| Que una tanda de emuladores **a medias** se lea como «está todo» | `emuladorAuthVivo()` en `tests/emulador.ts` (**B-365**). Va aparte de `emuladorVivo()` por el mismo motivo que `emuladorStorageVivo()`: el modo de falla que importa es el asimétrico. Y no es hipotético — pasó: otro worktree levantó su tanda, el padre de la primera murió, su hijo de Firestore quedó **huérfano escuchando** en el 8080 y Auth se fue con el padre. `emuladorVivo()` preguntaba solo por Firestore, dijo «está arriba», y lo que se vio fueron cinco `beforeAll` en rojo con un `ECONNREFUSED 127.0.0.1:9099` desde el fondo del SDK, sin una palabra sobre qué emulador faltaba. **Esto no lo arregla B-219**: el `projectId` separa las bases, no los puertos |
| Que un `.env` **versionado** se lleve un secreto al repo público | `env-versionados.test.ts` (**B-213**, D-198). Era la única puerta del proyecto sin gate, y la que publica de la forma más irreversible que hay. Descubre los archivos con `git ls-files` en vez de listarlos —**son cuatro y el ítem decía tres**, y el que faltaba es `.env.example`, justo el único que *nombra* las tres claves secretas con el `=` puesto y el valor vacío: el camino corto a la fuga no es agregar una clave, es rellenar una que ya está esperando—. Compara claves y formas, **nunca imprime un valor**: un test que falla mostrando el secreto lo copia al log de CI, que también es público. Y `AIza…` **no** está en los patrones a propósito: es la forma de la API key del SDK web, que este proyecto versiona deliberadamente, y un gate que grita por el caso legítimo enseña a apagarlo |
| Que la identidad de quien reporta llegue al issue público, y que el saneador vuelva a repartirse campo por campo | `clases-de-bug.test.ts` (**B-137**, D-197, con B-361 y B-362). Tres asertos que no se implican entre sí: un **centinela saneable** que verifica que el saneador corre, un **centinela que el saneador NO tapa** para `reportadoPor.uid`/`email` —que no los protege el filtro sino la enumeración del cuerpo, así que con un centinela saneable el test no distingue «no se cuela» de «se cuela y se tapa»—, y el **tope de dos aplicaciones** de `redactar` en el cuerpo de la función, que es el que impide volver al reparto. Más el orden sanear→recortar, que es alcanzable porque el saneador **expande**. Las claves del fixture se leen de `firestore.rules`, así que una clave nueva del reporte entra sola al barrido |
| Que un formato o un valor que produce un módulo se **vuelva a copiar** en su consumidor | `clases-de-bug.test.ts` para `FORMATO_VERSION` (**B-165**) y `meses.test.ts` para los nombres de los meses (**B-215**). Las dos cuentan declaraciones en el repo y exigen que haya una. **Ojo con `git grep` para esto**, que fue el primer intento y estaba mal: solo mira el índice, así que un archivo nuevo todavía sin agregar —el estado exacto de una copia recién escrita— es invisible, y el guarda daba verde justo en el momento en que tenía que hablar. Van con `grep -r` sobre el disco |
| Que `firebase-admin` no se importe fuera de su propia puerta | `build-credenciales.test.ts`, que recorre todo `src/`. Se le sacó la línea al `auditor-privacidad` cuando ese test existió (`1.2.0`): el agente ahora mira solo lo que el barrido no ve — imports dinámicos y el `ssr.external` de la config |
| Que el borrador autoguardado no salga del navegador ni pase por la analítica | `autoguardado.test.ts`, que lee el código del módulo y del hook con los comentarios afuera. **Ojo con la forma del aserto:** buscar un nombre con `toContain` lo satisface el `import`, así que los dos que fijan los saneadores del punto de recuperación afirman la **llamada**, con los espacios colapsados (D-124) |
| Que el formulario no tenga una sección sin capítulo en la guía | `ayuda.test.ts` |
| Que la ayuda del **sitio público** no enumere tipos de actividad que el modelo ya cambió, y que no falte una de las preguntas que hay que contestar | `ayuda-del-sitio.test.ts` (B-232). El glosario se **deriva** de `opciones-base.json`, así que una categoría base nueva —`feria` (B-129) y `libreria-a-la-calle` ya entraron después del `CLAUDE.md`— sale nombrada en el error en vez de dejar una lista de cinco tipos mientras el sitio muestra siete. La lista de preguntas obligatorias va con el motivo de cada una: una página de ayuda se degrada por lo que le sacan. Incluye el barrido de centinelas (§5.1) sobre el texto libre, el piso de contraste AA, y **el conteo que la doc afirma**, que el `auditor-documentacion` encontró mintiendo en cinco lugares el día que se escribió |
| Que un motivo de contacto nuevo aparezca en la página pero sin decir qué conviene contar, y que ninguna página escriba el `mailto:` a mano | `contacto-del-sitio.test.ts` (B-232). Los bloques se derivan de `MOTIVOS_DE_CONTACTO` (B-228), así que un motivo nuevo se muestra solo —y su lista, que no se escribe sola, queda exigida. La guarda del `mailto:` es la clase B-72/B-88: una dirección pegada en el marcado anda igual de bien hoy y se rompe el día que la casilla cambie, en una sola de las páginas y sin que nada falle |
| Que una página pública pegue a mano la dirección del calendario —sobre todo la variante `private-`, que da acceso de lectura al calendario entero— en vez de importarla de `enlaces.ts` | `suscribirse.test.ts` (B-230). Son dos barridos y hacen falta los dos: uno sobre el **markup** de la página y sus componentes, que falla ante cualquier `https?`/`webcal://` escrito, y otro sobre el **contenido**, que exige que cada dirección sea exactamente una de las que produce `enlaces.ts`. `enlaces.test.ts` cubría solo al **productor**; esto cubre a los consumidores, y el patrón vale para toda página futura que enlace afuera |
| Que la página que explica el calendario siga diciendo la verdad sobre lo que el calendario hace | `suscribirse.test.ts` (B-230), cuatro `it` contra `construirEvento`/`planificar`: el link de la reunión con el valor de fábrica y con `urlPublica`, el encuentro cancelado que se borra, y los ocho eventos distintos de un ciclo. Es la lección de B-63 aplicada afuera del panel — un chequeo puede verificar que el texto **esté**, nunca que sea **cierto** |
| Marcadores de conflicto de git en archivos versionados | `sin-marcadores-de-conflicto.test.ts` |
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
- **Un auditor del sitio público** (SEO, indexabilidad, accesibilidad): desde
  B-227 ya hay HTML de verdad contra el que escribirlo, así que el motivo viejo
  —«no existe»— caducó. **Y el segundo motivo también caducó el 2026-09-02:** el
  SEO absoluto existe (B-109), así que ya no hay nada que esperar. Lo que cambió
  es el alcance de lo que quedaría por auditar, porque tres tests nuevos se
  llevaron la parte mecánica —`canonico.test.ts` (que el dominio se escriba una
  vez y la canónica sea absoluta), `sitemap.test.ts` (qué se le ofrece al
  buscador) y `pasadas.test.ts` (que ninguna publicada quede huérfana)— más el
  paso 7 de `scripts/build-contra-emulador.mjs`, que verifica sobre los archivos
  de `dist/` que el robots, el sitemap y la canónica coincidan en un solo origen.
  Lo que sigue sin red y sería el trabajo del agente: la **accesibilidad** más
  allá del contraste (orden de encabezados, nombres accesibles, foco en un
  recorrido real) y la **calidad** del contenido indexable —que un `<title>` diga
  algo distinto en cada página, que la `meta description` no se corte a mitad de
  palabra—, que son juicios y no propiedades. Y una parte ya está automatizada y no le corresponde: el contraste lo
  calculan `tests/contraste-del-sitio.test.ts` (B-235) para el markup del sitio,
  `tests/listado-del-sitio.test.ts` (B-247, B-260) para el listado —que es donde
  hay texto encima de algo que no es el papel— y, sobre las tres superficies,
  `tests/contraste-de-superficies.test.ts` (B-243, B-256). Desde **B-260** se suma
  `tests/sistema-visual.test.ts`, que cubre el resto del sistema visual. B-122.
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
