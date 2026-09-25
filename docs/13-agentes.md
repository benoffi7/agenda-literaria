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
hacer. Está en [Qué se decidió no automatizar](13-agentes-no-automatizado.md).

Lo que queda para un agente es el hueco que un test no puede llenar: los tests
verifican los campos, los archivos y las salidas **que ya conocen**. Cuando el
cambio agrega un campo nuevo, una salida nueva o un trigger nuevo, no hay test
que lo mire — y ahí es donde este proyecto se lastima.

---

## Qué hay

| | Nombre | Tipo | Para qué |
|---|---|---|---|
| 🔒 | `auditor-privacidad` | agente (solo lectura) | Que nada privado llegue a las treinta y dos salidas públicas |
| 🪤 | `auditor-trampas` | agente (solo lectura) | Las trampas del §13 y los fallos que dejan el build en verde |
| 📚 | `auditor-documentacion` | agente (solo lectura) | Que la doc acompañe al cambio, y que no afirme cosas que dejaron de ser ciertas |
| ✅ | `cerrar-cambio` | skill | El procedimiento de cierre — doc, CHANGELOG, ayuda, novedades, backlog |
| 🧩 | `campo-nuevo` | skill | Agregar un campo al modelo de punta a punta |
| 🐞 | `al-backlog` | skill | Anotar un bug o una idea en el backlog, priorizado y con formato |
| 🚀 | `que-deployar` | skill de usuario (`/que-deployar`) | Qué deployar, con qué comandos y qué verificar después |
| 🛡️ | `audit` | skill (`/audit`) | El único camino a los tres auditores: elige alcance, los lanza en paralelo y junta los hallazgos — ver [Cuándo corren, y cuánto cuesta](#cuándo-corren-y-cuánto-cuesta) |

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

Detalle chico con consecuencia real, **cerrado el 2026-09-03 (B-215)**: `.claude/`
no estaba en la lista negra de `scripts/que-deployar.sh`, así que un cambio a
estas definiciones hacía `hosting=true` y republicaba el sitio. Las que terminan
en `.md` ya caían por la regla de las extensiones; lo que caía en «archivo
desconocido» era el `settings.json` —donde viven los hooks, o sea el archivo que
más se toca— y `githooks/pre-push`, que no tiene extensión. Hoy los dos prefijos
están en `NO_AFECTAN`, con sus casos en `tests/que-deployar.test.ts`.

Y con una atadura, porque una lista negra falla al revés que una blanca —no se
queda corta, se pasa de larga, y excluir algo que sí afecta al bundle deja
producción con código viejo y el workflow en verde—: un caso **deriva del árbol**
que ningún archivo de `src/` ni `astro.config.mjs` referencie `.claude/` ni
`githooks/`. El día que alguien aliasee algo de ahí, la exclusión pasa a ser falsa
y el test lo dice antes de que un cambio deje de deployar. Es la misma forma que
el caso de B-88 para los alias a `functions/`.

**Skills** — una carpeta por skill, con `SKILL.md` adentro:
`.claude/skills/<name>/SKILL.md`. Un archivo suelto `.claude/skills/<name>.md`
**no se carga**. El frontmatter que usamos es `name` + `description`, más
`disable-model-invocation: true` en el que es solo para el usuario.

---

## Los agentes

### 🔒 `auditor-privacidad`

**Para qué.** El proyecto tiene **treinta y dos salidas públicas** y una sola regla
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
mira un archivo es que lo nombre la tabla de `07-seguridad.md` —y, atada a ella,
la lista de disparadores de su ficha—, no que hoy filtre algo.

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
La fila 1 de la tabla de salidas —entonces la copia de la ficha, hoy la de
`07-seguridad.md`— nombraba solo el primero hasta el 2026-08-27 (B-218), que es
la forma de B-216 un archivo más adentro: con la tabla vieja, un cambio que tocara
solo `eventsJson.ts` no despertaba a este agente por nombre de archivo.

**Y hay una clase con su propio riesgo** — B-782. `/ayuda`, `/contacto`,
`/suscribirse`, `/404`, `/apoyar` y `/anunciar` no proyectan ningún documento: son
texto escrito a mano, sin campo que se pueda colar por un spread, así que no hay
proyección que auditar. B-782 decidió no numerarlas —una fila más agregaría, por
cada campo nuevo del modelo, una celda cuya respuesta es siempre «no sale»
(D-320)—, y el dueño lo dio vuelta el 2026-09-07: **sí se numeran**, son las filas
13 a 18 de `07-seguridad.md`, por la promesa y no por la proyección.

Lo que sí tienen es **la promesa**: texto libre en HTML indexado que afirma cosas
sobre tratamiento de datos, y que puede **nacer falso**. `/apoyar` salió diciendo
«no se guarda quién entró» con el banner de Google Analytics en la misma pantalla,
y `/ayuda` decía «no guarda tus datos». La red es
`tests/promesas-sobre-datos.test.ts` (B-781): archivos por glob, detección por
fórmula, y una negación pasa solo si está condicionada o acotada. Lo que le queda
al agente es lo que el test no puede — si una frase nueva es **verdad** dada la
salida 12 y dado lo que la consola de GA4 tiene activado.

El agente sabe qué archivo produce cada una, qué nunca sale, y las excepciones que
cuestan de recordar (`online.urlPublica` vale para el JSON y el calendario pero
**nunca** para la analítica ni para el posteo; el historial de versiones guarda el
documento entero sin proyectar a propósito).

> **La quinta salida faltaba en la ficha del agente hasta el 2026-08-27**, y el
> agujero era del peor tipo: `textoRedes.ts` está bien cubierto por sus tests, así
> que ningún test fallaba — lo que faltaba era que **el índice del agente la
> nombrara**, y su `description` no incluía el archivo, así que un cambio que
> interpolara un campo nuevo en el posteo no lo invocaba. Lo encontró el
> `auditor-documentacion` auditando el cambio que arregló en `07-seguridad.md`
> las **cinco** que había entonces, y se olvidó de espejarlo acá. La moraleja de
> entonces era que una salida nueva iba en **tres** lugares (el documento de
> seguridad, el cuerpo del agente y su `description`), y que el tercero decidía si
> el agente se enteraba. **Desde M-8 (D-1206, D-1207) los tres son otros:** la
> tabla de `07-seguridad.md`, la del skill `campo-nuevo` y la lista «Los archivos
> que te despiertan» del cuerpo de la ficha, que ya no tiene tabla propia; los ata
> `tests/agentes-y-skills.test.ts`, y la lista es la que decide si `/audit` lo
> llama.
>
> (Esa frase dice «las cinco que había entonces» y no pega el número a la
> palabra «salidas» a propósito: hay un chequeo que compara **toda** mención de
> este archivo a un número de salidas contra la cuenta de hoy, y una nota
> histórica no tiene que ponerlo en rojo. Es el `it` de B-124 en
> `tests/agentes-y-skills.test.ts`.)

**Cuándo se invoca.** Antes de cerrar cualquier cambio que toque una salida, el
modelo, el schema, las reglas o el bundle. Los archivos que lo despiertan están en
el bloque «Los archivos que te despiertan» del cuerpo de su ficha y no en el
`description` (decisión B del PRD 6): ahí iban al prompt de cada sesión, y el
disparo ya lo decide `/audit` (D-560). **Su tabla de salidas no es suya:** la lee
de `07-seguridad.md` (M-8), que es la única copia.

**Qué agrega sobre los tests.** Los tests verifican los campos que conocen. Este
agente verifica tres cosas que ningún test puede: que un **campo nuevo** tenga
las celdas decididas, que la **forma** de la proyección siga siendo una
whitelist (un `...actividad` no filtra nada hoy y publica el campo de mañana), y
que exista un test que fije la decisión. No corre la suite: eso lo hace el CI.

**Qué NO hace.** No escribe, no arregla, no corre tests ni builds ni deploys, no
lee secretos (`.env`, la URL del ICS, el PAT), y no propone aflojar un test para
que pase un cambio.

**Qué devuelve.** Veredicto (`LIMPIO` / `HALLAZGOS: N`), la tabla de los campos
tocados contra las treinta y dos salidas, un bloque por hallazgo (severidad P0/P1/P2,
`archivo:línea`, qué se filtra, el arreglo mínimo, el `it(...)` que lo fijaría) y
qué verificó que estaba bien.

**Modelo: `opus`.** Es el único con el modelo caro, y a propósito: el costo de
un falso negativo acá es una credencial filtrada o un link de reunión público, y
las dos cosas son irreversibles.

### 🪤 `auditor-trampas`

**Para qué.** Las trece trampas del §13 más los patrones de
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

**Y la lista «sin red» tiene su contracara, que es D-750.** Cuando alguien
escribe la red que el agente pidió, lo que decide si esa red sirve son tres
reglas —medir cuántos casos anteriores habrían pasado igual, mutar **todos** los
sujetos y no uno, y desconfiar del recorte «hasta el final del archivo»—. Se
escribieron porque el 2026-09-17 aparecieron **dos** chequeos en verde que no
verificaban lo que su nombre afirmaba, y en uno de los dos la medición dio
**cuatro de cinco sujetos pasando la mutación**. Un control laxo con forma de red
es peor que ninguno: el agente que lo lea va a reportarlo como «cubierto».

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

> **Su alcance sobre los duplicados de merge se recortó (B-606).** La ficha decía
> que ningún test atrapaba esa clase, y desde B-367/B-660 sí atrapa una parte:
> `red-de-contencion.test.ts` cubre, **solo en este archivo**, las filas
> fusionadas de la tabla de abajo, las primeras celdas repetidas, los nombres de
> test que ya no existen y las líneas de prosa pegadas. La ficha del agente ahora
> lo dice y le pide no reportarlo. **Lo que le queda es lo que no es forma:** el
> mismo drift en cualquier otro documento, y —acá— dos filas que se contradicen
> entre sí, que ninguna regla mecánica distingue de dos filas que dicen cosas
> distintas sobre temas distintos. Elegir cuál texto queda fue el trabajo de
> criterio de B-294, y sigue siendo suyo.

**Sirve, y hay prueba.** En la primera corrida sobre este repo encontró que
**B-56 dice que nadie llama a `registrarVersion(VERSION_APP)`, y hoy se llama**
en `src/components/admin/AdminApp.tsx`. Quedó anotado como B-118: no se tocó
B-56 porque el ítem no es de este bloque de trabajo.

**Y tiene un barrido que no hace a ojo** (B-124, ampliado a todo el repo en
**B-1147**): `node scripts/decisiones-referenciadas.mjs` lista las referencias
`D-nnn` que **el repo entero cita** —código incluido, no solo `docs/`— y que
**no tienen entrada** en `06-decisiones.md`. Vale la pena porque ese enlace roto
no se ve roto — `06-decisiones.md#d-350` abre el documento igual, sin ancla y sin
error, así que la decisión se lee como que existe. Y porque **citada desde un
docblock es el caso caro**: el comentario explica el porqué de una línea y manda a
buscar una decisión que nadie escribió. Antes miraba 27 archivos y ahora 679; el
informe separa las citas de código de las de prosa.

**Y desde B-1170 son tres barridos, no dos, y el tercero contesta otra pregunta.**
`node scripts/estados-referenciados.mjs` (`npm run backlog:contradicciones`) no mira
si un id **existe** —eso lo hacen los otros dos— sino si lo que la cita **afirma** de
él sigue siendo cierto. Una fila `| **B-nnn** | … | ⛔ acción manual del dueño |` pasa
los dos barridos viejos con todo bien: el id es válido, la entrada existe. Lo único
falso es el estado, que es el único dato de esa fila que alguien usa para decidir
algo. Compara las dos formas de **registro paralelo** —una fila con columna de
estado, y la frase «bloqueado por» seguida de un id— contra los dos backlogs,
**binario** (cerrado contra no cerrado) y en las dos direcciones por separado. Informa
como los otros dos, y lo que frena es `tests/estados-referenciados.test.ts`, que
congela la deuda de hoy y deja que la lista solo baje. La decisión de método es
**D-775**.

**Y desde B-1171 hay un cuarto, que mira la tercera parte del vocabulario: las
anclas.** `node scripts/anclas-referenciadas.mjs` (`npm run docs:anclas`) resuelve
cada `](#…)` y `](archivo.md#…)` de `docs/` y del `CLAUDE.md` contra los
encabezados del documento de destino, con el slug de GitHub. Un ancla rota es la
rotura más silenciosa de un documento largo —la página carga y el salto no va a
ninguna parte— y en este repo tiene causa estructural: el `·` de los encabezados
deja **dos** guiones (`### 5.3 · Algo` es `#53--algo`), y renombrar un encabezado
deja colgado a quien lo citaba. **Ojo con el `_`:** GitHub lo conserva, y el
barrido a mano que abrió el ítem lo borraba y «arregló» dos enlaces que
funcionaban. Informa como los otros; lo que frena es
`tests/anclas-referenciadas.test.ts`, con la deuda congelada en **cero**.

**Y uno que no busca roturas sino que da por dónde entrar: el índice de
`06-decisiones.md`** (M-7 del PRD 6). El registro pesa ~205 mil tokens y no se
puede leer entero; `node scripts/indice-de-decisiones.mjs`
(`npm run decisiones:indice`) escribe
[`06-decisiones-indice.md`](06-decisiones-indice.md), una línea por decisión
con su id, su título y su ancla. El ancla la saca del mismo `encabezadosDe` que
usa el barrido de anclas, así que los dos no pueden derivarla distinto. Lo que
frena es `tests/indice-de-decisiones.test.ts`: el archivo commiteado tiene que
ser lo que el script produce hoy, así que quien agrega o renombra una decisión
regenera el índice en el mismo cambio.

**No es un test bloqueante, y el motivo es la forma de trabajo de este repo:**
citar una decisión antes de escribirla es legítimo y frecuente, porque los
frentes en paralelo documentan su cambio en una rama y la entrada de
`06-decisiones.md` la escribe otro. Un test así estaría rojo **mientras la tanda
está abierta** —rojo por razones que no son el cambio de quien lo corre, o sea
B-180— y se aprendería a saltear. El juicio de si una huérfana es una tanda en
vuelo o una entrada que nadie escribió nunca es exactamente lo que un agente
puede dar y un test no. Lo que sí tiene tests es la mitad que decide
(`tests/decisiones-referenciadas.test.ts`), y `--estricto` existe para correrlo
sobre `main` ya integrado.

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
arranca obligando a decidir las treinta y dos salidas **antes** de escribir código, que
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

### 🛡️ `audit`

**El único camino a los tres auditores, y corre solo cuando alguien lo pide.**
Elige el alcance, lanza en paralelo los que corresponden, junta los hallazgos en
una tabla y dice qué frena y qué se anota.

Acepta qué auditar y sobre qué: `/audit` solo (elige alcance y auditores),
`/audit privacidad`, `/audit todo`, `/audit HEAD~3`, `/audit src/lib/toPublic.ts`.
Un pedido explícito gana sobre el mecanismo — si se nombra un auditor que no
corresponde al alcance, corre igual y el reporte lo dice.

La parte que importa sigue siendo el corte: un hook de git **no puede invocar un
modelo**, así que lo mecánico (marcadores de conflicto, typecheck, tests con
emuladores, build, fuga de credenciales) vive en `githooks/pre-push` →
`scripts/verificar-todo.sh`, y lo que necesita criterio (¿este campo nuevo es
publicable?, ¿el código nuevo cae en una trampa del §13?, ¿la doc acompañó?) vive
acá. El skill **no** re-verifica lo mecánico: corre el script y lee el resultado,
porque un modelo reimplementando lo que un script ya decide es una segunda copia
que se va a quedar vieja.

Cierra B-115: hasta acá nada invocaba a los auditores juntos, así que existían
pero solo corrían si alguien se acordaba de los tres.

**Se llamaba `antes-de-pushear` y era obligatorio; desde D-560 es `/audit` y es a
pedido.** El nombre viejo describía un momento del flujo —antes del push— y eso
dejó de ser cierto: hoy sirve igual para revisar algo a mitad de camino, para
auditar un alcance explícito, o para preguntar por un solo auditor. El racional
del cambio está en **D-560**; la contra asumida está escrita ahí y también acá,
porque es la que importa: **nada te va a recordar que corras esto.**

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

### Todo hallazgo dice si es medido o leído (B-1162, D-1045)

Los tres auditores etiquetan cada hallazgo como **`medido`** (existe una
reproducción, y la nombran: un test existente, un artefacto ya construido, una
medición con fecha) o **`leído`** (lo dedujeron leyendo el código). Uno `leído` no
sale con la prioridad que afirma el efecto: va con la de riesgo y dice qué medición
lo subiría. Como no corren la suite, la mayoría de sus hallazgos van a ser `leído`,
y está bien: lo que se pide es que lo digan. El motivo son B-1142 y B-1145, dos
ítems de una misma lista que afirmaban que algo se veía y, medidos, no era cierto.
`tests/agentes-y-skills.test.ts` exige la sección en toda ficha `auditor-*`.

## Cuándo corren, y cuánto cuesta

**Contestado por el dueño el 2026-09-08: a pedido, con `/audit`.** Es la
tercera respuesta a la misma pregunta y revisa las dos anteriores — el intermedio
del 2026-09-03 (privacidad automático por diff, los otros dos antes del PR) y el
«siempre los tres, y el gate lo exige» del 2026-09-07 (B-124). El racional
completo está en **D-560**; acá va el estado de hoy y qué se sacó.

| Auditor | Cuándo | Quién lo dispara | Modelo | Costo de una corrida |
|---|---|---|---|---|
| 🔒 `auditor-privacidad` | cuando alguien lo pide | el skill `/audit` | **`opus`** | el caro — es el único con el modelo caro y es a propósito |
| 🪤 `auditor-trampas` | cuando alguien lo pide | el skill `/audit` | `sonnet` | barato |
| 📚 `auditor-documentacion` | cuando alguien lo pide | el skill `/audit` | `sonnet` | barato |

La columna «cuándo» dice lo mismo tres veces, y eso **es** la decisión: no hay
momento del flujo en que alguno corra solo.

Lo que `/audit` sí sigue derivando del mecanismo es **cuáles** corren para un
alcance dado: `scripts/auditores-que-corresponden.mjs` recibe las rutas por
stdin y contesta. Así que «a pedido» decide *si* se audita, y el script decide
*qué* — pedir `/audit` sobre una tanda que solo toca `docs/` no gasta el de
`opus`.

**La lista de archivos que disparan a cada auditor no está escrita en el
script.** Se **deriva de la ficha de cada agente** —del `description`, y del bloque
entre `<!-- disparadores:inicio -->` y `<!-- disparadores:fin -->` cuando la ficha
lo tiene, que hoy es solo la del `auditor-privacidad`—. Copiarla habría
creado un tercer lugar que envejece sin que nada falle — la clase de B-88, y lo
mismo que B-216 vino a cerrar para la cuenta de salidas. Consecuencia buscada:
**una salida nueva se suma a la ficha y entra sola al selector de auditores.**

El `auditor-documentacion` es la excepción declarada: corresponde siempre, y eso
no se puede derivar de ninguna lista porque su disparador es el cambio y no el
archivo. Está escrito como tal en el script, con el motivo al lado.

### Qué se eliminó, y qué se llevó puesto

Lo que había hasta el 2026-09-08, y ya no está:

| Pieza | Qué hacía |
|---|---|
| `.claude/settings.json`, hook `Stop` | Avisaba al terminar el turno si el diff tocaba una salida sin auditar |
| `.claude/settings.json`, hook `PreToolUse`/`Bash` | **Frenaba** el `git commit` con el mismo mensaje |
| `.claude/settings.json`, hook `PostToolUse`/`Task` | **Sellaba** la huella de lo auditado |
| `scripts/verificar-todo.sh`, paso 7 | Exigía los tres sellos para dejar pushear |
| `scripts/hook-auditores.mjs` | La plomería de los cuatro: git, el sello, los códigos de salida |
| `scripts/comando-de-commit.mjs` | Decidía qué cuenta como un `git commit` (solo lo necesitaba el hook del commit) |
| `<git-dir>/auditores.json` | El sello: dos huellas por auditor, `auditado` y `empuje` |
| `SALTEAR_AUDITORES=1` | La salida explícita, que sin gate no tiene sentido |

**Lo que sobrevivió, y por qué:**

- **`scripts/auditores-que-corresponden.mjs`** — es la decisión pura de qué
  auditor corresponde a qué archivos, se testea sin git y sin estado
  (`tests/auditores-que-corresponden.test.ts`), y ahora es lo que `/audit` usa
  para elegir. Era la mitad buena del mecanismo.
- **`scripts/sin-comentarios.mjs`** — era la mitad pura de la huella (B-794) y se
  quedó porque tiene un uso propio: los tests que afirman **sobre el fuente**
  necesitan distinguir lo que el código hace de lo que un comentario dice que
  hace. Se renombró al renombrar lo que hace; se llamaba
  `huella-de-auditoria.mjs`, y un archivo con el nombre de un mecanismo que ya no
  existe es el drift que este repo persigue en la doc.
- **Los tres agentes**, intactos. Lo que se sacó es *quién los llama*, no lo que
  saben mirar.

**Y con el sello se fue B-794 entero.** Ese arreglo existía porque el sello
volvía a pedir la auditoría cuando uno aplicaba los hallazgos del auditor —los
hallazgos aterrizan como un docblock **en el archivo auditado**—, así que se
hasheaba el código sin comentarios. Sin sello no hay nada que invalidar: el
problema desapareció con su causa. Vale dejarlo escrito porque el razonamiento
sigue siendo bueno y puede volver a hacer falta el día que algo vuelva a querer
recordar «esto ya se revisó».

### El modo de falla que este cambio acepta

Las cuatro reglas anti-B-180 del hook ya no aplican —no hay hook—, pero la
lección sí, y ahora se paga del otro lado.

**Antes el riesgo era un gate rojo por su propia plomería**, que es lo que enseña
a saltearlo: un `git` que no está, un JSON ilegible, un modo mal escrito. Se
manejaba haciendo que cualquier excepción saliera con 0 — preferir dejar pasar un
cambio sin auditar antes que ponerse rojo por sí mismo.

**Ahora el riesgo es el olvido, y no tiene mitigación técnica.** Está asumido y
escrito acá y en `/audit`: si el cambio toca una salida pública y nadie invoca el
skill, no hay red. La opción «a pedido» estaba en el ítem original de B-124 con
el argumento «cero costo, **se olvida**», así que esto no se elige por
desconocer la contra.

Lo que queda para revisar la decisión con números, si alguna vez se quiere: en el
cierre de la `1.2.0` los tres auditores encontraron dieciséis bugs en tres
pasadas, **dos de ellos P1 de privacidad**; cerrando B-818 encontraron once en
dos rondas; cerrando B-814, cinco ítems de backlog y tres de doc. Lo que hay que
mirar no es cuántos encuentran cuando corren —eso ya se sabe—, sino **cuántas
veces se los invoca** ahora que nada los llama.

---

## Qué se decidió no automatizar

El registro de lo que se pensó como agente y **no** se escribió —porque un test
ya lo verifica, o porque un agente no es la herramienta— está en su propio
archivo: [`13-agentes-no-automatizado.md`](13-agentes-no-automatizado.md). Es
lo primero que hay que mirar antes de proponer un chequeo nuevo, y lo que los
tres auditores consultan para no reportar lo que un test ya frena. Salió de acá
porque era el 75 % del peso de este documento y se consulta, no se lee de
corrido.

---

## Cómo se usan juntos

El flujo de un cambio típico:

```
pedido → (campo-nuevo, si toca el modelo) → implementar
       → cerrar-cambio (doc, CHANGELOG, ayuda, novedades, backlog)
       → /audit ─┬→ auditor-privacidad     ─┐ los que corresponden
                 ├→ auditor-trampas         │ al alcance, en paralelo,
                 └→ auditor-documentacion  ─┘ son de solo lectura
       → /que-deployar → commit y push
```

Los tres auditores no se pisan: cada uno deriva al otro cuando algo no es suyo.
Y ninguno reemplaza a `npm test` — corren **además**, sobre lo que la suite no
puede ver.

**La flecha de `/audit` es la única que llega a un auditor, y sale de una decisión
humana** (D-560). Antes el de privacidad se despertaba solo cuando el diff tocaba
una salida, y el gate de push exigía los tres; eso se eliminó entero. Cuál de los
tres corre para un alcance dado lo sigue decidiendo el mecanismo —una tanda que
solo toca `docs/` no gasta el de `opus`—, pero **que se audite o no lo decide
quien trabaja**, y nada se lo recuerda. Qué se sacó, qué sobrevivió y la contra
asumida están en
[Cuándo corren, y cuánto cuesta](#cuándo-corren-y-cuánto-cuesta).

Lo que queda abierto de este bloque está en el [`BACKLOG.md`](BACKLOG.md),
B-115 a B-124.

## El cierre de una tanda en paralelo

Una tanda en paralelo —frentes en worktrees, coordinados desde
`/tmp/agenda-literaria-frentes.md`— no se da por cerrada hasta que
`node scripts/cerrar-tanda.mjs` sale con 0. Se corre **en el árbol principal,
con todo integrado y antes de pushear**:

```
node scripts/cerrar-tanda.mjs                     # la tanda en curso
node scripts/cerrar-tanda.mjs /tmp/otra-tanda.md  # otra
node scripts/cerrar-tanda.mjs --desde <commit>    # otra base: varias tandas juntas
```

**Por qué existe.** Lo que se perdía al cerrar una tanda estaba escrito, pero
fuera del repo, y pasarlo dependía de que quien integra se acordara:

- **B-1090.** Un frente acuña `D-nnn` o `B-nnn` en un commit o en un comentario,
  y el texto de la entrada queda en su informe. Seis decisiones se quedaron así
  hasta B-910, y dos más hasta B-1082.
- **B-1125.** El protocolo de `.estado/<frente>.md` distingue lo hecho (`✅`) de
  lo que quedó abierto (`⏸`) y de las preguntas al orquestador (`❓`), y
  `.estado/` está en el `.gitignore`. Un `npm audit fix` y un helper compartido
  de credenciales se perdieron ahí.

`.estado/` **se queda ignorado**: son archivos de coordinación de una sola tanda,
y versionarlos ensuciaría el repo sin arreglar nada. Lo que cambió es que el
cierre los lee solo.

**Qué mira.** La base sale de la línea ``Base: `main` @ `…` `` del archivo de la
tanda (si no está, pide `--desde`; no inventa una), y de ahí:

1. **Ids sin entrada.** Los `B-` y `D-` citados en los mensajes de commit de
   `base..HEAD` y en las líneas que agrega el diff, contra `BACKLOG.md`,
   `BACKLOG-cerrados.md` y `06-decisiones.md`. Lo escrito se lee con las mismas
   funciones que `items-referenciados.mjs` y `decisiones-referenciadas.mjs`. Uno
   del rango que la tanda reservó (sección `## Rangos`, D-981) sale marcado: casi
   seguro es el texto de un informe que no se pegó.
2. **Pendientes.** Las líneas de `.estado/*.md` —el del árbol principal, que desde
   un worktree se encuentra al lado del `.git` común— y del propio archivo de la
   tanda cuyo **último** marcador es `⏸` o `❓` (la regla de D-980). Por defecto,
   solo los archivos de `.estado/` tocados desde la base; `--todo-el-estado` los
   mira todos.

**Lo que no frena, y por qué.** Un id que **ya se citaba sin entrada en la base**
es deuda vieja: la congelan los tests de los barridos gemelos, y aparece acá
cuando la tanda mueve texto —el archivador pasa ítems de un backlog al otro y cada
línea movida es una línea agregada—. Se informa aparte. Una declaración de rango
(«del 1200 al 1219», escrita con ids y una `a`) es una reserva y no se cuenta. Y
un pendiente que dice «anotado como B-nnn», con ese ítem escrito, ya tiene rastro
versionado.

**Por qué no es un test.** Por el mismo motivo que los barridos gemelos: mientras
la tanda está abierta sus ids se citan antes de escribirse, y un aserto así
estaría rojo por razones ajenas a quien corre la suite (B-180). Lo que tiene tests
es la mitad que decide: `tests/cerrar-tanda.test.ts`.

**Qué se hace con lo que encuentra.** Cada huérfano va a su archivo antes de
cerrar —el texto está en el informe del frente—. Cada pendiente sale como ítem
del backlog o como una línea del cierre. Ninguno se deja en `.estado/`.
