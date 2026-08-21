# Decisiones

Decisiones tomadas **durante la implementación**, que no están en el
`CLAUDE.md`. Incluye los desvíos del documento, con su motivo.

Las decisiones de arquitectura ya cerradas están en el §2 del
[`CLAUDE.md`](../CLAUDE.md) y no se revisitan sin pedido explícito.

---

## D-01 · Sin librería de formularios

**Decisión:** el formulario es estado controlado de React más zod en el submit.

**Alternativa descartada:** react-hook-form (llegó a estar instalada y se
quitó). Con campos anidados de tres niveles y componentes propios (taxonomías,
editor de sesiones) habría hecho falta un `Controller` en cada campo, sin ganar
nada sobre `useState` + validación al guardar.

---

## D-02 · Las etiquetas nuevas se persisten en el submit

**Decisión:** cuando alguien crea una opción con "Otro", el `upsertOpcion` corre
al guardar la actividad, no al tipear la etiqueta.

**Motivo:** abandonar el formulario a mitad de camino no debe dejar basura en la
taxonomía. El §4.3 se queja justamente de las opciones con `usos: 1` creadas por
error.

**Costo:** el componente tiene que devolver el label junto con el slug, y el
formulario acumularlos hasta el submit.

---

## D-03 · Las opciones base viven en un JSON

**Decisión:** `src/lib/opciones-base.json`, importado por `src/lib/opciones.ts`
y por los scripts de seed.

**Motivo:** los scripts corren en Node plano y no pueden importar TypeScript. La
alternativa era duplicar los valores.

---

## D-04 · La regla de lectura suma `|| esAdmin()`

**Desvío del §5.3.** El documento propone:

```js
allow read: if resource.data.estado == 'publicado';
```

**Lo implementado:**

```js
allow read: if esAdmin() || resource.data.estado == 'publicado';
```

**Motivo:** sin eso el panel no puede listar sus propios borradores, que es su
función principal.

**Nota sobre el emulador:** cuando la lectura se deniega, el emulador reporta
`evaluation error` en vez de `permission-denied`, porque en su primera pasada
`resource` todavía no está cargado. Es cosmético: las cuatro evaluaciones
deniegan igual. Se probó blindarlo con `resource != null` y con
`.get('estado','')` y no lo evita. En producción el mensaje es correcto.

---

## D-05 · `token.get('admin', false)` en vez de `token.admin`

**Motivo:** leer una clave ausente de un map en las reglas de Firestore es un
*evaluation error*, no `false`. Con el acceso directo, cualquier usuario sin el
claim hacía fallar la regla y el cliente recibía "evaluation error" en lugar de
un permission-denied limpio.

Lo encontró un test de integración.

---

## D-06 · La Function corre como la service account, sin key

**Desvío del §2.6.** El documento dice que la Function autentica con la *key* de
la service account.

**Lo implementado:** la Function corre **como** `calendar-sync@…` y toma el
token de las credenciales de su propio runtime (`GoogleAuth` sin credenciales
explícitas).

**Motivo:** mismo resultado y no queda ninguna key para guardar, rotar ni
filtrar. El setup del calendario es idéntico: compartirlo con el mail de la
service account dándole "Realizar cambios en los eventos".

**Costo:** hay que otorgar a mano `eventarc.eventReceiver`, `run.invoker` y
`artifactregistry.reader`, que la service account por defecto de Compute trae de
fábrica. Sin eso el deploy falla con `eventarc.events.receiveEvent denied`.

---

## D-07 · La guarda anti-loop compara payloads, no una lista de campos

**Desvío del §7.1.** El documento propone:

```js
const CAL_FIELDS = ['titulo','descripcion','estado','sede','modalidad','sesiones'];
const relevantChanged = (a, b) => CAL_FIELDS.some(f => JSON.stringify(a?.[f]) !== JSON.stringify(b?.[f]));
```

**Lo implementado:** se arma el evento que se le mandaría a Calendar antes y
después, y se comparan.

**Motivo:** al pasar la descripción del evento de 3 campos a ~20 (D-09), la
lista mantenida a mano se volvió una bomba de tiempo: agregar un dato a la
descripción sin agregarlo a la lista dejaba de propagar ese cambio al
calendario, en silencio.

La propiedad anti-loop se conserva y es más fuerte: `construirEvento` no lee
`calendarEventId`, así que la escritura del id de vuelta produce un payload
idéntico por construcción, no por acuerdo.

**Efecto lateral bueno:** editar la difusión interna o el link privado de la
reunión ya no dispara un update inútil de las N sesiones.

---

## D-08 · La config del SDK web va versionada

**Decisión:** `.env.production` y `.env.development` están en el repo con la
API key, el appId y el resto de la config de Firebase.

**Motivo:** no es secreta. Viaja en el bundle del cliente por diseño y la
seguridad la dan las reglas de Firestore (§5.3), no el secreto de esos valores.
Versionarla hace que el deploy no necesite configurar nada.

Lo que sigue fuera del repo es la service account key (§5.4) y el PAT de GitHub.
`functions/.env` también está versionado: solo tiene el id del calendario.

---

## D-09 · La descripción del evento lleva todo lo publicable

**Pedido del usuario:** "en la descripción del evento debe ir toda la info que
el usuario cargó en el formulario".

**Lo implementado:** todo lo del formulario **excepto** lo que el §5.1 y el §7.4
prohíben, porque el calendario es tan público y scrapeable como el
`events.json`: el link de la reunión, la difusión interna, la URL del material
privado y los uids.

Ver [`07-seguridad.md`](07-seguridad.md) para la lista y cómo se verifica.

---

## D-10 · La ubicación se arma completa, con link a Maps

**Pedido del usuario:** "cargar la dirección puede ser con Google Maps así el
evento queda bien cargado".

**Era además un bug:** se mandaba solo `sede.direccion` ("Drago 236"), sin
ciudad ni país. Google no tenía con qué desambiguar y el evento quedaba sin mapa
o con el mapa en otra ciudad.

**Lo implementado:** `location` con sede, calle, barrio, ciudad y país, sin
repetir un valor cargado en dos campos. Más un link de Google Maps en la
descripción, que usa las coordenadas si `sede.geo` está presente.

`sede.geo` ya se captura en el formulario (D-46): si está cargado, el link
apunta al punto exacto; si no, sigue resolviendo por dirección.

---

## D-11 · Los slugs se resuelven a etiqueta, con des-slug de respaldo

**Motivo:** la actividad guarda solo el slug (§4.1), así que sin resolver la
descripción del evento diría "a-la-gorra". La Function lee `/opciones/*` con
caché por instancia.

Si un slug no está registrado, se des-sluguea: `"parque-chas"` → `"Parque
Chas"`. El calendario es público y mostrar el slug crudo se ve roto.

El barrio se resuelve **también** dentro de la ubicación: mandarle
"villa-crespo" a Google geolocaliza peor que "Villa Crespo".

**Limitación conocida:** renombrar una etiqueta no actualiza los eventos ya
creados. Está en el [backlog](BACKLOG.md).

---

## D-12 · Los desplegables preseleccionan la primera opción

**Pedido del usuario**, a partir de un bug real: los placeholders de los
desplegables eran textos de ejemplo ("Gratis, a la gorra…", "Taller, club de
lectura…") que se renderizaban como el primer `<option>`, con valor `""`. El
campo se veía **idéntico a uno ya elegido** y al guardar saltaba "Elegí el
arancel" sobre un formulario que parecía completo.

**Lo implementado:** los placeholders se leen como instrucción ("Elegí el
arancel…"), y `arancel`, `tipo` y `plataforma` preseleccionan la primera opción.
`barrio` y `tags` no, porque no tienen opciones base.

**Corregido el 2026-08-21 (D-16):** `arancel` quedó fuera de la preselección.
El texto de abajo describe el estado anterior.

**Riesgo que se corrigió:** `arancel` arrancaba en "Gratis". Si se carga un taller pago y
no se cambia, se publica como gratuito. `tests/opciones-orden.test.ts` fija cuál
es el default de cada campo para que un reordenamiento no lo cambie en silencio.
El usuario está avisado.

---

## D-13 · `dispararRebuild` escrita pero sin desplegar

**Motivo:** es un `onSchedule` cada 5 minutos y todavía no existen el sitio
público ni el workflow de Actions que tendría que disparar. Desplegarla sería
pagar por un schedule que no hace nada.

El flag `sistema/rebuild` **sí** se escribe, así que cuando exista el paso 5 ya
hay de dónde leer.

**Actualización (B-02):** el workflow ya existe y la Function está completa.
Sigue sin desplegarse, pero por otro motivo: le faltan credenciales que solo
puede crear el dueño (el PAT y la key de CI, §5.4). Los pasos están en
[`08-operacion.md`](08-operacion.md).

---

## D-14 · La documentación se actualiza con cada cambio

**Pedido del usuario.** Está en [`05-patrones.md`](05-patrones.md) como regla de
proceso, con la tabla de qué documento toca según el tipo de cambio, y la regla
de que todo reporte de posible bug va al [`BACKLOG.md`](BACKLOG.md) ordenado por
prioridad.

---

## D-16 · `arancel` no se preselecciona

**Decisión del usuario** (2026-08-21), revisando el riesgo que D-12 había
dejado abierto: **arancel obliga a elegir**.

`tipo` y `plataforma` siguen preseleccionando la primera opción, porque ahí
equivocarse es barato — una categoría o una plataforma mal puesta se ve y se
corrige. En `arancel` el default era "Gratis": un taller pago que nadie corrige
se publica como gratuito, en el sitio **y** en el calendario público, y la gente
llega esperando no pagar. Un clic más por actividad vale menos que eso.

`tests/opciones-orden.test.ts` verifica que el atributo
`autoSeleccionarPrimera` **no** esté en el campo de arancel. Es un test que lee
el fuente, poco ortodoxo, pero es la forma de fijar una decisión de producto que
de otro modo se revierte con un copy-paste distraído entre campos vecinos.

---

## D-15 · `urlPublica` se respeta

**Decisión del usuario** (2026-08-21), sobre la pregunta de si el checkbox
"publicar el link de la reunión" debía respetarse o quitarse: **respetarlo**.

**Desvío del §5.2 y del §7.4**, que descartan la URL de la reunión sin
condición. El motivo del desvío es que el modelo del §3.1 tiene el flag
`urlPublica` y el formulario su casilla: ignorarlo era prometer algo que no
pasaba.

**Lo que se mantiene**, y es lo que hace aceptable el desvío: el default sigue
en `false`, el formulario advierte sobre el zoombombing en el propio checkbox, y
sin URL cargada no se inventa el campo aunque el flag esté en true.

Aplica en las dos salidas: `toPublic.ts` y la descripción del evento.

---

## D-31 · Los reportes van por trigger de Firestore, no por `onCall`

**Decisión:** el panel escribe `/reportes/{id}` y un `onDocumentWritten` crea el
issue en GitHub.

**Alternativa descartada:** una función `onCall` que reciba el reporte y llame a
GitHub en la misma request.

**Motivo:** el reporte no se puede perder. Con `onCall`, mientras dura la
llamada el reporte solo existe en la memoria de la Function: si la API de GitHub
está caída o el token venció, la llamada falla y lo que escribió la persona se
va con ella. Con el trigger, la escritura **es** el reporte —queda guardado
antes de que GitHub entre en juego— y el issue es un efecto posterior,
reintentable, cuyo resultado se ve en el propio documento.

Además la autorización ya la hacen las reglas con `esAdmin()` (§5.3), sin
reimplementar el chequeo del claim, y el panel se entera del número de issue
escuchando el documento.

**Costo:** el número de issue no aparece en el mismo click. Llega un segundo
después por `onSnapshot`, y hasta entonces la lista dice "creando el issue…".

---

## D-32 · El issue no dice quién reportó

**Decisión:** el issue lleva el id del documento (`reportes/{id}`) y nada más
sobre la persona. El uid y el mail quedan en Firestore.

**Motivo:** el repo `benoffi7/agenda-literaria` es **público** (verificado con
`gh repo view --json visibility`), así que el issue es público. Publicar el mail
de quien carga actividades lo expone a bots, y el §5.1 ya prohíbe los uids en
las salidas públicas.

La trazabilidad que pedía el pedido —quién lo cargó, cuándo, y el número de
issue— está completa en el documento, que solo leen los admins. Con dos cuentas
cargando, mirar el documento cuesta un click.

---

## D-33 · El texto libre se filtra antes de publicarlo

**Decisión:** `redactar()` tapa mails y links de reunión en todo lo que sale al
issue, y el título de la actividad referida se copia **solo si está publicada**.

**Motivo:** el issue es público. Alguien que explica un problema pega lo que
tiene a mano: "no me deja mandar el link https://zoom.us/j/… a
hola@taller.org". Eso es exactamente la trampa 5 y el §5.1.

Detalles que hacen que sirva:

- El texto **completo** queda en Firestore: no se pierde nada, solo se recorta
  lo que se publica.
- La decisión sobre la actividad la toma la Function leyendo el documento, no el
  panel: así no depende de lo que mande el cliente.
- El formulario avisa que el repo es público, para que el filtro sea la segunda
  defensa y no la primera.

---

## D-34 · Los reintentos se cuentan en el documento, no en la plataforma

**Decisión:** el estado del reporte (`pendiente` → `enviando` → `creado` |
`error`) más `intentos`. Un fallo transitorio vuelve el estado a `pendiente`, y
esa misma escritura vuelve a disparar el trigger, hasta 3 intentos.

**Alternativa descartada:** `retry: true` en el trigger, que reentrega el evento
con backoff durante días.

**Motivo:** hace falta distinguir lo transitorio (5xx, 429, error de red) de lo
que es configuración (401, 403, 404: token vencido, sin permiso, repo mal
escrito). Reintentar un 401 durante siete días no arregla nada y no se ve en
ninguna parte. Con el estado en el documento, el fallo aparece en el panel con
su motivo, y el intento queda acotado.

La transacción que toma el reporte cumple dos funciones: es la guarda anti-loop
(la escritura de vuelta del número de issue dispara el trigger otra vez, y ahí
no hay nada que hacer — §7.1, trampa 3) y evita el issue duplicado cuando
Firestore entrega el mismo evento dos veces, que es su garantía real ("al menos
una vez").

---

## D-35 · El trigger de reportes lleva sus opciones explícitas

**Decisión:** `reporteAIssue` declara región, `maxInstances`, service account y
`secrets` en su propia definición, en vez de heredar el `setGlobalOptions()` de
`functions/index.js`.

**Motivo:** no es preferencia de estilo. En ESM los imports se ejecutan antes
que el cuerpo del módulo que importa, así que cuando `reportes-trigger.js`
define la Function el `setGlobalOptions()` de `index.js` **todavía no corrió**:
el endpoint quedaría sin región ni service account. Con las opciones explícitas
el orden deja de importar.

Efecto lateral bienvenido: `index.js` solo suma la línea del export, así que dos
personas (o dos agentes) tocando Functions en paralelo no chocan.

**Se reusa la service account `calendar-sync@`** en lugar de crear una propia:
una nueva necesitaría a mano los tres roles que la default de Compute trae de
fábrica (D-06) y es el error que ya hizo fallar dos deploys. El precio es que
esa identidad suma el acceso al secreto del PAT.

## D-26 · `aprobada` ausente cuenta como aprobada

**Contexto:** el §4.3 pide `aprobada: boolean` ahora que hay dos cuentas con
claim `admin` cargando. Los documentos de `/opciones/*` que ya están en
producción **no tienen el campo**, y `preparar-produccion.mjs` es idempotente:
no los pisa.

**Decisión:** `estaAprobada(v) = v.fijo || (v.aprobada ?? true)`. La ausencia se
lee como aprobada.

**Motivo:** el otro default hace desaparecer opciones que hoy se usan. Una
actividad publicada que guarda `sede.barrio = 'villa-crespo'` quedaría, al
editarla, con un desplegable que no ofrece su propio valor y mostrando el slug
crudo; y los chips del sitio público perderían filtros que ya funcionaban. El
campo nuevo tiene que ser invisible para lo que ya estaba: **solo lo nuevo nace
pendiente, porque solo lo nuevo se escribe con el campo puesto.**

**Alternativa descartada:** una migración que marque `aprobada: true` en todo lo
existente y después leer el campo como obligatorio. Deja el código dependiendo
de que la migración haya corrido — y si mañana aparece un documento viejo (un
restore, un proyecto nuevo sembrado con un JSON anterior) vuelve el problema.
El default seguro no necesita que nada haya corrido antes. La migración existe
igual, como comodidad y no como requisito:
`node scripts/aprobar-opciones.mjs --backfill`.

---

## D-27 · El creador se guarda como huella, no como uid

**Decisión:** `huellaCreador` es una huella FNV-1a de 32 bits del uid
(8 caracteres hex), no el uid.

**Motivo:** `/opciones/{campo}` es de **lectura pública** (§5.3, y hay un test
que lo verifica) y el §5.1 es explícito en que los uids no salen al público.
Guardar el uid ahí lo publicaría para cualquiera con la API key del cliente.
Lo único que necesita la visibilidad es una comparación de igualdad ("¿esta
opción la creé yo?"), y para eso alcanza un pseudónimo opaco.

**Por qué FNV-1a y no SHA-256:** `crypto.subtle` es asincrónico en el navegador
y obligaría a un estado de carga en cada desplegable, y a partir la
implementación entre `crypto.subtle` y `node:crypto`. La función no protege un
secreto, distingue personas. Con dos o tres cuentas la colisión es del orden de
1 en mil millones y su peor consecuencia es ver una opción pendiente de más.

**Costo:** la huella no es reversible, así que el script no puede decir *quién*
creó una opción. El rastro está en la actividad que la usa (`createdBy`), que es
admin-only.

**Si el dueño prefiere el uid** (más simple, resoluble a un mail con el Admin
SDK), es cambiar una línea; o cerrar la lectura pública de `/opciones/*`, que
hoy nadie usa porque el sitio público lee `events.json` y no Firestore (§2.5).
Eso último toca el §5.3, así que no se hizo por cuenta propia.

---

## D-28 · Aprobar es una escritura más: la autoridad es el claim `admin`

**Decisión:** cualquiera de las cuentas con claim `admin` puede aprobar. No se
agregó un claim nuevo ni una noción de "dueño" en el código.

**Motivo:** las reglas de Firestore **no pueden verificar** una autoridad más
fina. `valores` llega como un array de maps y no hay forma de compararlo
elemento por elemento contra el anterior para detectar "esta escritura cambió
`aprobada`". Una regla que no puede verificar lo que promete es peor que no
tenerla, y las dos cuentas ya pueden escribir cualquier actividad y crear
cualquier opción: la frontera que agrega valor real es "alguien lo validó
deliberadamente", no "cuál de los dos lo validó".

**Si hiciera falta separar quien carga de quien valida** (más gente cargando),
el camino es un claim aparte (`curador`) y mover la aprobación a un documento o
campo propio, que sí es verificable desde las reglas. Está anotado en el
[backlog](BACKLOG.md) como decisión del dueño.

---

## D-29 · La aprobación se hace por script, no por UI

**Decisión:** `scripts/aprobar-opciones.mjs` (`--listar`, aprobar por
`campo`+`slug`, `--backfill`). El panel **no** tiene pantalla de aprobación.

**Motivo:** la pantalla natural para esto es la administración de taxonomías que
pide el §4.3 (editar, borrar, ver `usos`), que no existe y está en el backlog
como B-06. Meter un botón de aprobar en el desplegable de un formulario de carga
es el lugar equivocado: no es una acción de carga.

**Lo que sí se hizo en la UI**, porque sin eso la feature es incomprensible para
quien la usa: las opciones propias sin aprobar se muestran marcadas
"(sin aprobar)" en el desplegable, en las sugerencias del autocompletado y en
los chips de tags. Quien creó la etiqueta entiende por qué la otra cuenta no la
ve.

**Costo aceptado:** aprobar necesita una máquina con Node y `gcloud`, no se
puede desde el teléfono. Anotado en el backlog.

El script corre contra el emulador si `FIRESTORE_EMULATOR_HOST` está seteado y
contra producción si no, y **anuncia el objetivo antes de escribir**. Los tests
de integración lo ejecutan de verdad contra el emulador (no reimplementan su
lógica), que es el patrón de "verificar contra el sistema real" de
[`05-patrones.md`](05-patrones.md).

---

## D-30 · La aprobación filtra lo elegible, nunca la resolución de etiquetas

**Decisión:** `aprobada` decide qué opciones se pueden **elegir**. Resolver un
slug a su etiqueta usa **siempre la lista completa**, aprobadas y pendientes.

**Motivo:** una actividad puede estar usando legítimamente una opción pendiente
—la creó la otra cuenta y guardó bien— y el evento de Calendar es público. Si el
resolvedor filtrara, la descripción diría "con-beca-parcial" en lugar de "Con
beca parcial" (D-11) y el formulario mostraría el slug crudo al editar.

Donde vive esto:

- `useOpciones` devuelve **dos** listas: `valores` (todas, para resolver) y
  `elegibles` (lo que esta cuenta puede elegir). Cualquier consumidor nuevo que
  necesite etiquetas —una vista previa, un badge— usa `valores`.
- `cargarLabels` en `functions/index.js` no filtra, y hay un comentario que
  explica por qué para que nadie lo "arregle".
- El autocompletado de "Otro" busca coincidencia de slug en la lista completa:
  si la etiqueta ya existe como pendiente de otra persona hay que **reusarla**,
  no crear un duplicado. La deduplicación del §4.2 gana; es crítica.

**Lo único que se genera sin usuario, y por eso solo con aprobadas, es el
`events.json`** (§4.4): el sitio público no debe publicar vocabulario sin
validar. `opcionesVisibles(valores)` sin uid devuelve exactamente eso.

## D-36 · La versión es `package.json` + SHA del commit, no un timestamp

**Decisión:** la versión que estampa el build es `0.1.0+a1b2c3d` — el `version`
del `package.json` más el SHA corto de git (`scripts/version.mjs`).

**Motivo:** tiene que ser reproducible (mismo commit → misma versión, así se
puede volver a buildear lo que alguien reportó) y legible por una persona (el
dueño necesita saber qué versión reporta un bug, y del otro lado alcanza un
`show` de ese SHA para ver el código exacto).

**Alternativa descartada: el timestamp del build como identidad.** El sitio se
rebuildea cada vez que cambia una actividad en Firestore (§8) y en todos esos
builds el JS del panel es idéntico. Con el timestamp como versión, el panel se
habría recargado solo varias veces por día sin ningún motivo.

Los dos casos sin commit del que colgarse **sí** llevan sello de tiempo, porque
ahí no hay identidad estable posible: árbol sucio (`+a1b2c3d-sucio.20260821-2129`)
y clone sin `.git` (`+sin-git.…`). El sufijo `sucio` además avisa que lo
publicado no corresponde exactamente a ningún commit.

**Consecuencia asumida:** dos builds del mismo commit son la misma versión. Si
se despliega dos veces el mismo código, el panel no se recarga — y está bien,
porque el JS es el mismo.

---

## D-37 · El panel se recarga solo, salvo con el formulario a medio cargar

**Decisión:** cuando la versión publicada no coincide con la que está corriendo,
el panel hace `location.reload()` sin preguntar. La única excepción es el
formulario con cambios sin guardar: ahí **avisa y espera**.

**Motivo:** el formulario son 30+ campos y varios minutos de trabajo (§11).
Recargar en el medio lo borra, y eso es peor que tener el JS viejo. Al revés,
preguntar siempre convierte una mejora invisible en una molestia diaria.

Al guardar, el formulario se desmonta, deja de haber algo que perder y la
recarga ocurre sola: el aviso se resuelve sin que nadie tenga que hacer clic en
nada.

**Cómo se sabe si el formulario está sucio:** un store de módulo de diez líneas
(`src/lib/formulario-sucio.ts`) que el formulario actualiza comparando el JSON
de su estado contra el inicial (`useFormularioSucio`, un `useEffect`).
Descartadas: pasar el dato por props (obligaba a cablear `AdminApp` → vista →
formulario) y un contexto de React (envolver el árbol entero para un booleano).
El formulario toca **una línea**.

**Protección anti-loop:** `location.reload()` **no puede** saltear el cache — no
existe forma de forzar un hard refresh desde JS. Si después de recargar la
versión sigue sin coincidir (algún intermediario ignorando las cabeceras), el
panel no recarga de nuevo: avisa y pide intervención a mano. La marca de "ya
recargué por esta versión" va en `sessionStorage`, que es exactamente lo que
sobrevive a un reload y muere con la pestaña.

---

## D-38 · Cabeceras de cache explícitas en `firebase.json`

**Decisión:** `firebase.json` declara el cache de Hosting en vez de dejar el
default.

| Recurso | Cabecera | Por qué |
|---|---|---|
| `/_astro/**` | `public, max-age=31536000, immutable` | el nombre lleva hash de contenido: si cambia el contenido cambia la URL, así que cachear un año es gratis y es lo que hace rápida la recarga |
| `/version.json` | `no-store, max-age=0` | es el recurso que dice qué hay publicado; cacheado no sirve para nada |
| `**/*.html`, `/`, `/admin`, `/admin/**` | `no-cache` | el HTML es el que referencia los assets nuevos |

**Motivo:** sin esto la detección de versión no sirve. El default de Hosting
cachea el HTML, y con el HTML cacheado recargar vuelve a pedir los mismos assets
viejos: el panel detecta que hay versión nueva, recarga, y sigue corriendo la
vieja. Las cabeceras son la mitad del mecanismo, no un detalle de performance.

`no-cache` no es "no cachear": el navegador guarda la copia pero **revalida**
antes de usarla, así que un deploy nuevo se detecta en el primer pedido y una
recarga sin cambios sigue costando un 304. Es el punto justo para el HTML.

Las rutas de la SPA (`/admin`, `/admin/**`) van explícitas porque los globs de
Hosting matchean la **URL pedida**, no el archivo que se sirve después del
rewrite: `**/*.html` no matchea un pedido a `/admin`.

## D-46 · Las coordenadas se pegan desde Google Maps, sin geocoding

**Problema:** `sede.geo` estaba en el modelo y la Function ya lo usaba (D-10),
pero el formulario no lo pedía, así que era siempre `null`. Resolver por texto
alcanza para una dirección de ciudad normal y falla justo en lo que abunda en el
circuito literario: la librería sin numeración clara, el centro cultural dentro
de un predio, la casa en un pasaje.

**Alternativa descartada: la API de Geocoding de Google.** Cuesta plata, pide
otra key y el proyecto tiene un budget de USD 5/mes (§2.3). Un mapa embebido
para elegir el punto tampoco: es otra key y otro script en el bundle del panel,
que ya pesa 570 KB.

**Lo implementado:** un campo donde se pega el link de Google Maps del lugar —
lo que la persona ya tiene abierto cuando carga la actividad — o un par
`lat, lng`. El parseo es una función pura (`src/lib/coordenadas.ts`), la UI un
control chico (`CoordenadasSede.tsx`).

**Los links cortos (`maps.app.goo.gl`) no se soportan y se dicen así.** Son un
redirect y seguirlo desde el navegador lo bloquea CORS. Antes que resolverlos
con una Function (otro endpoint, otro deploy, para un caso que se arregla
abriendo el link), el mensaje explica qué hacer.

**Cómo se verifica que el punto sea el correcto:** el propio campo muestra la
coordenada cargada con un link al mapa —armado igual que el de la Function, no
uno parecido—, y la vista previa del evento del formulario
(`VistaPreviaEvento.tsx`) muestra la ubicación y el link de Maps tal como van a
salir. Pegar el link y mirar la vista previa es el ciclo completo, sin publicar.

**El rango se valida; la geografía solo avisa.** Una latitud de 200 no existe y
se rechaza. Un punto fuera de Argentina es legal —puede haber una actividad en
Montevideo— así que se guarda con un aviso: el caso normal es un typo o un
lat/lng al revés, y ahí el aviso lo dice explícitamente.

## D-21 · El PAT va por `defineSecret`, no por `process.env`

**Decisión:** `dispararRebuild` declara el secreto con
`defineSecret('GITHUB_TOKEN')` y lo pide con `.value()`.

**Motivo:** el código anterior leía `process.env.GITHUB_TOKEN` sin declararlo.
En Cloud Functions v2 eso da `undefined` en producción, porque nadie monta el
secreto en el runtime si la Function no lo pide. La única forma de que
funcionara habría sido poner el PAT en `functions/.env`, que está versionado —
exactamente lo que el §5.4 prohíbe.

Como efecto lateral, el deploy falla si el secreto no existe. Es preferible a un
schedule que corre cada 5 minutos loguéandose como "sin GitHub configurado".

---

## D-22 · Un solo workflow, disparado por evento y a mano — no por push

**Decisión:** `.github/workflows/deploy.yml` responde a `repository_dispatch`
(`types: [rebuild]`) y a `workflow_dispatch`. **No** corre con el push a `main`.

**Motivo:** el disparador del §8 es un cambio de **datos**, no de código, y es
el caso frecuente. Para un cambio de código está el botón "Run workflow", que
además obliga a mirar el resultado en vez de descubrir un deploy roto por
accidente. Si más adelante molesta, agregar `on: push` es una línea.

**Lo que sí tiene el workflow, y es deliberado:**

- **`npm test` antes del build.** Un test roto no debe publicarse. Los de
  integración se saltean solos sin emuladores.
- **El grep de `dist/` como gate del deploy.** Es el mismo chequeo que ya
  documentaba el §5.4, ahora bloqueante: publicar la service account key es
  irreversible, así que falla cerrado.
- **`concurrency` con `cancel-in-progress: true`.** Si llega un dispatch nuevo
  mientras corre un build, el viejo se cancela: el nuevo lee los mismos datos y
  más frescos.
- **Una service account propia (`deploy-ci@`) con `datastore.viewer` +
  `firebasehosting.admin`,** no la de las Functions. El workflow solo lee
  Firestore; si la key se filtrara, el daño se limita a datos ya públicos.

---

## D-23 · El backoff del rebuild se rinde, y se rearma con el próximo cambio

**Decisión (B-13):** ante un `repository_dispatch` fallido, el schedule
reintenta con backoff exponencial (5, 10, 20, 40 min) hasta cinco veces, deja
`intentos`/`ultimoError`/`agotado` en `sistema/rebuild`, loguea `error` al
agotarse, y **no** vuelve a intentar hasta que haya un cambio nuevo.

**El problema que resuelve:** con el PAT vencido, reintentar cada 5 minutos son
~288 llamadas por día que fallan todas, y ningún registro de que el sitio está
viejo salvo un log perdido.

**La pregunta difícil era cómo se vuelve a la normalidad.** Dos caminos, y hacen
falta los dos:

1. **Un disparo exitoso** resetea el contador. Es el camino normal.
2. **Un cambio nuevo rearma los intentos** (`CAMPOS_REARME` en `marcarRebuild`).
   Sin esto, agotarse sería un estado terminal que hay que destrabar a mano
   editando Firestore.

Con eso el presupuesto de reintentos es **por cambio**, no global: aunque el
problema persista, cada edición gasta a lo sumo cinco llamadas, no infinitas. Y
cuando el problema se arregla, la siguiente edición publica sin intervención.

**Costo aceptado:** si el PAT vence y nadie mira, el sitio se queda viejo en
silencio después del `error` inicial. La alternativa (un mail por tick) es la
que genera el ruido que hace que nadie mire nada. El estado vive en
`sistema/rebuild`, que es un solo documento y contesta "¿está roto el rebuild?"
de un vistazo.

**Lo que no se hizo:** una alerta de verdad (log-based alert de GCP sobre el
mensaje `el rebuild agotó los reintentos`, o un mail). Es configuración de
consola, no código, y queda a criterio del dueño.

## D-20 · La lógica del evento se comparte por alias, no se duplica

**Contexto:** la vista previa del panel (B-12) tiene que mostrar la descripción
del evento tal como va a salir. Esa descripción la arma `construirDescripcion`
en `functions/calendario.js`, que corre en la Cloud Function.

**Decisión:** el panel **importa** esa función. `functions/calendario.js` se
expone al código de `src/` con el alias `@calendario`, declarado en los tres
lugares que resuelven módulos: `astro.config.mjs` (Vite), `tsconfig.json`
(TypeScript) y `vitest.config.ts` (los tests).

**Motivo:** si la vista previa armara su propio texto, las dos versiones se
separarían en el primer cambio y la vista previa mentiría. Una vista previa que
miente es peor que no tenerla, y acá el costo es concreto: la descripción
respeta las reglas de privacidad del §5.1, así que una copia desactualizada
podría mostrar de menos (genera desconfianza) o de más (hace creer que se
publica algo que no se publica). Con una sola fuente de verdad eso sale gratis.

**Por qué funciona:** `functions/calendario.js` es JS puro, sin dependencias de
Firebase ni de red. Está separado así desde el sync (D-07) justamente para poder
testearlo sin emuladores; reusarlo desde el panel es la misma propiedad.

**Alternativas descartadas:**

- *Mover el módulo a `src/lib/` e importarlo desde `functions/`.* La Function se
  despliega con su propio `package.json` y su propio directorio: `functions/` no
  puede importar hacia arriba sin un paso de copiado o build.
- *Un alias con comodín (`@funciones/*` → `functions/*`).* Invitaría a importar
  `functions/index.js` desde un componente cliente, y eso arrastra
  `firebase-admin` al bundle (trampa 4, §5.4). El alias apunta a un solo
  archivo, el que se sabe puro.

**Costo:** `functions/calendario.js` pasó a ser código compartido y entra al
bundle del panel (~6 KB). Cambiarlo ahora afecta dos consumidores, no uno: el
sync y la vista previa. Es la contrapartida buscada — que no se puedan separar.

`debeExistir` (§7.3) también se exportó, para que el aviso de "esto todavía no
está en el calendario" use el criterio del sync y no una copia.

## D-17 · La copia corre las fechas en semanas enteras

**Decisión** (B-11): al duplicar una actividad, la copia conserva la estructura
interna del ciclo intacta —los mismos huecos entre encuentros, las mismas
duraciones— y mueve el bloque completo en **semanas enteras** hacia adelante. El
piso es el más tardío entre hoy y el último encuentro del original.

**Alternativas descartadas:**

- **Las mismas fechas.** Un ciclo del año anterior con las fechas del año
  anterior no sirve, y publicar la copia sin mirar crearía eventos vencidos en el
  calendario.
- **Fechas vacías.** Obliga a cargar ocho fechas de cero, que es justo el trabajo
  que duplicar viene a evitar. Además el formulario abre con ocho errores de
  validación.
- **Correr un año exacto.** Mueve un martes a un miércoles. Los ciclos literarios
  son "los martes a las 19"; el día de semana es parte del dato.

**Por qué el piso es el último encuentro y no solo hoy:** duplicar un ciclo en
curso significa "la próxima edición", y esa arranca cuando la actual termina.
Con un solo criterio quedan bien los dos casos (ciclo viejo y ciclo en curso), y
el desplazamiento mínimo es de una semana: una copia sentada exactamente sobre
las fechas del original no le sirve a nadie.

**Se corre también `inscripcion.cierra`.** Si quedaba en el valor viejo, la
proyección pública calculaba `abierta: false` y la copia salía con la
inscripción cerrada.

**La suma es por componentes locales** (`setDate`), no `+ n * 86400000`: sumar
milisegundos corre el horario del encuentro si en el medio hay un cambio de
horario de verano. Argentina hoy no lo tiene, pero el navegador que carga puede
estar en otro huso.

**Lo que queda a cargo del usuario:** las excepciones del ciclo nuevo (un
feriado, una semana que se corre). Las fechas quedan editables una por una, igual
que las del generador de encuentros del §11.

---

## D-18 · La copia se marca en el título y en el slug

**Decisión** (B-11): la copia arranca como «Título del original (copia)» con
slug `slug-original-copia`, y `-copia-2`, `-copia-3`… si ese slug ya está tomado.
Ambos son propuestas editables.

**Motivo del sufijo en el título:** en el listado, dos filas con el mismo título
son indistinguibles, y la copia es un borrador que hay que revisar. Además el
slug se sigue derivando del título mientras la actividad no esté publicada, así
que en cuanto el usuario pone el título real ("Club 2027") el slug lo acompaña y
el `-copia` desaparece solo.

**El sufijo no se encadena:** duplicar una copia no da "Taller (copia) (copia)"
ni `taller-copia-copia`.

**Riesgo aceptado:** publicar sin revisar deja un "(copia)" a la vista y una URL
`…-copia` que después queda fija (trampa 10). Se mitiga con el aviso arriba del
formulario, que nombra los tres campos a revisar, y con que la copia sea siempre
borrador.

**La unicidad se propone en memoria, se verifica en Firestore.** El listado ya
tiene todos los slugs cargados, así que alcanza para proponer uno libre sin una
lectura extra; `slugDisponible` en el submit sigue siendo la guarda real.

---

## D-19 · Duplicar y borrar van en un menú de acciones

**Decisión** (B-11): cada fila del listado tiene "Editar" como botón y un menú
"⋯" con "Duplicar" y "Borrar".

**Motivo:** el listado es tarjeta en mobile y fila desde `sm`. Tres botones en
fila en 360px dan blancos de ~100px y se erra el toque; el mínimo del proyecto es
44px. De paso, "Borrar" deja de estar pegado a "Editar" y pasa a requerir un
toque deliberado.

**Costo:** un componente propio (`MenuAcciones`) con cierre por click afuera y
por `Escape`. El panel no tiene librería de UI y no se agregó ninguna.


---

## D-51 · El bundle del panel se corta en el login, no con `manualChunks`

**Decisión** (B-09): la carga inicial de `/admin` baja de ~750 kB a ~353 kB
(gzip 200 → 95) cortando el grafo de imports en dos lugares, sin tocar
`astro.config.mjs` ni agregar dependencias:

1. **`db()` se mudó a `src/lib/firestore-client.ts`.** `firebase-client.ts` es el
   módulo que carga la pantalla de login; mientras importaba `firebase/firestore`
   para `getFirestore` y `connectFirestoreEmulator`, el SDK entero entraba al
   chunk inicial. Ahora ese módulo es solo `firebase/app` + `firebase/auth`.
2. **`AdminApp` carga `ListaActividades` y `ActividadFormulario` con `import()`.**
   Mover `db()` sola no alcanzaba: `actividades.ts` y `opciones.ts` importan
   `firebase/firestore` de forma estática por su cuenta, así que Firestore sigue
   entrando a cualquier chunk que las alcance. Diferir las dos vistas que las
   usan es lo que efectivamente lo saca del arranque.

**Motivo del orden:** hacer solo (1) no cambia nada medible, y hacer solo (2)
deja Firestore en el chunk del login por culpa de `getFirestore`. Las dos juntas
son las que mueven el número, y son cuatro líneas de import más un módulo nuevo.

**Alternativa descartada: `build.rollupOptions.output.manualChunks`.** Parte los
archivos pero no cambia lo que el navegador necesita para el primer render: lo
que se importa de forma estática se baja igual. Además `astro.config.mjs` es el
archivo que sostiene la guarda de `firebase-admin` (§5.4) y el alias
`@calendario` (D-20); no vale meterle configuración de chunks para algo que se
resuelve en los imports.

**Alternativa descartada: `db()` async con `await import('firebase/firestore')`.**
Habría contagiado `await` a `refOpciones`, a `observarOpciones` —que devuelve la
función de desuscripción de forma sincrónica— y de ahí a `useOpciones` y a los
componentes. Mucho más código tocado para el mismo resultado.

**Costo:** la suma de todos los chunks sube ~2 kB (+0,3%) por partirlos, y
después del login hay un salto de red extra que se ve como un "Cargando…" de un
frame. A cambio, la pantalla de login —lo único que se ve con mala señal— pesa
la mitad.

**Trampa nueva:** el corte no está en la configuración, está en el grafo de
imports, así que un `import` estático de más lo deshace **con el build en verde**.
Dos reglas, con tests en `tests/bundle-panel.test.ts` que fallan si se rompen:
`db` se importa de `@/lib/firestore-client` y nunca de `firebase-client`, y
`AdminApp` no importa las dos vistas de forma estática.

**El `Suspense` va adentro del helper `diferido()`** y no en los puntos de uso
del JSX, así el cambio en `AdminApp.tsx` queda contenido en el bloque de
imports.


---

## Decidido, sin trabajo pendiente

| Tema | Resolución |
|---|---|
| Home indexable con el placeholder | se deja así (usuario, 2026-08-21) |
| Eventos de prueba en el calendario | los borra el usuario (2026-08-21) |

## Pendiente de decidir

| Tema | Quién decide |
|---|---|
| `libro presentado`: campo propio o dentro de la descripción | usuario |
| Si `arancel` debe seguir preseleccionando "Gratis" | usuario |
| Si hace falta un claim `curador` aparte del `admin` para aprobar taxonomías (D-28) | dueño |
| Si las opciones que crea el dueño deberían nacer aprobadas (hoy nacen pendientes todas) | dueño |
| Si una etiqueta que una segunda cuenta reusa debería aprobarse sola | dueño |
