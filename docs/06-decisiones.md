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

## D-41 · El historial guarda por contenido editable, no por escritura

**Contexto.** El §12 pide un `onDocumentUpdated` que escriba el `before` en
`/actividades/{id}/versiones/{timestamp}` y dice que son 5 líneas. Escritas de
corrido, esas 5 líneas generan versiones de basura: el trigger se dispara con
**toda** escritura, y `syncCalendar` escribe `calendarEventId` de vuelta en
`sesiones` después de sincronizar. Cada publicación dejaría dos versiones (el
cambio real y el write-back), y editar ocho veces seguidas mientras el sync
corre, muchas más.

**Decisión:** se guarda una versión cuando cambió el **contenido editable** del
documento, definido como el documento *menos lo que escribe la máquina*:

```js
const CAMPOS_DE_MAQUINA = ['updatedAt', 'updatedBy'];
const CAMPOS_DE_MAQUINA_SESION = ['calendarEventId'];
```

Es el mismo criterio de D-07 —derivar lo relevante y comparar eso, en vez de
mantener una lista de campos— aplicado en la dirección contraria, y la dirección
es la decisión:

| | Falla si te olvidás de un campo nuevo |
|---|---|
| Lista **blanca** de campos recuperables | pisar ese campo **no** guarda versión → **pérdida de datos, en silencio** |
| Lista **negra** de campos de máquina | una versión **de más** → un documento de basura, visible y acotado por D-42 |

De los dos errores posibles, el segundo es barato. Así un campo nuevo del modelo
(`libroPresentado`, DEC-1) entra al historial solo, sin que nadie se acuerde de
nada.

**Por qué la propiedad se sostiene y no es un acuerdo entre dos listas:** el
write-back de `syncCalendar` toca *únicamente* `calendarEventId`, así que
produce un contenido editable idéntico **por construcción**. Igual que en D-07,
no hay forma de romperlo por olvido.

La comparación se hace sobre una forma canónica (claves ordenadas, `Timestamp`
normalizado a milisegundos) porque `JSON.stringify` respeta el orden de
inserción y nada garantiza que dos lecturas de Firestore entreguen los campos en
el mismo orden.

**Efecto lateral bueno:** guardar el formulario sin cambiar nada —que igual
escribe `updatedAt`/`updatedBy`— no deja una versión idéntica a la anterior.

**Diferencia deliberada con el sync:** `difusion` y `online.url` no alteran el
evento de Calendar y no disparan nada allá (D-07), pero **sí** guardan versión
acá. Son texto que tipeó una persona: pisarlos tiene que ser recuperable.

---

## D-42 · Retención por cantidad, no por antigüedad

**Decisión:** se conservan las últimas **20 versiones** por actividad
(`MAX_VERSIONES`). La poda corre en el mismo trigger que escribe la versión.

**Por qué acotarlo:** una actividad muy editada acumula copias del documento
entero. No es un problema de costo —20 copias de unos pocos KB es storage
irrelevante— pero crecer sin límite era una decisión implícita, y esas son las
que después sorprenden.

**Por qué por cantidad y no un TTL:** por antigüedad falla justo en el caso de
uso. El escenario real es "pisé la descripción hace meses y recién ahora me doy
cuenta": un ciclo cargado en marzo, editado una vez y revisado en diciembre
habría perdido su única versión útil con cualquier TTL razonable. Por cantidad
el crecimiento queda acotado **y** siempre quedan las N más nuevas, que son las
que se piden de vuelta, incluido el caso de las ocho ediciones seguidas.

**Costo de la poda:** se leen solo los ids (`select()` sin campos), o sea
`MAX_VERSIONES + 1` lecturas por edición. Despreciable al lado de las llamadas a
Calendar que la misma edición ya dispara.

Depende de que el id ordene cronológicamente, que es lo que garantiza D-43.

---

## D-43 · El id de la versión no es solo el timestamp

**Desvío del §12**, que propone `/versiones/{timestamp}`.

**El agujero:** dos escrituras en el mismo milisegundo colisionan y la segunda
**pisa** a la primera. Perder una versión es exactamente lo que esta feature
viene a evitar, así que no se puede dejar al azar del reloj.

**Lo implementado:** `{instante ISO-8601}_{id del evento}` — por ejemplo
`2026-08-21T18-00-00-123Z_abc123`. Dos propiedades salen de ahí:

- **Único:** dos disparos simultáneos son dos eventos distintos, así que no se
  pisan aunque caigan en el mismo milisegundo.
- **Idempotente:** Cloud Functions v2 entrega *al menos* una vez. Un reintento
  del mismo evento tiene el mismo instante y el mismo id, así que reescribe la
  misma versión en lugar de duplicarla. Por eso el instante sale de `event.time`
  y no de `Date.now()`.

**Por qué ISO y no milisegundos:** mientras no exista UI (B-40) el historial se
lee desde la consola de Firestore, donde el id es todo lo que se ve de un
documento. Y al ser de ancho fijo, el orden lexicográfico de los ids es el orden
cronológico — de eso depende la poda de D-42.

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
   **Actualización (B-85):** el disparo exitoso resetea el contador siempre,
   pero baja `pendiente` solo si la marca `actualizado` del documento sigue
   siendo la que el tick leyó. Si cambió, alguien marcó un rebuild nuevo durante
   los hasta 15 s del `fetch` y ese cambio no entró al build que arrancó: el
   flag queda arriba y el próximo tick dispara otro.
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

## D-61 · La ayuda es una capa, no una pantalla del panel

**Decisión** (B-60): el botón "Ayuda" del encabezado abre una capa sobre lo que
esté en pantalla. No es una vista del router propio (`lista` / `nueva` /
`editar` / `duplicar`).

**Motivo:** el momento en que se consulta la ayuda es *mientras* se carga una
actividad. Una vista nueva desmonta `ActividadFormulario`, y con él los 30+
campos cargados a mano: la ayuda tendría el peor precio posible justo cuando más
se necesita. Con una capa, consultarla cuesta cero.

**Por qué va en el encabezado y no dentro de cada pantalla:** es el único lugar
que se ve en todas, y así el formulario no necesita saber que la ayuda existe
—cosa nada menor con varias manos tocando ese archivo al mismo tiempo—. El
contexto (listado o formulario) es lo único que se pasa, y solo decide qué
capítulo aparece desplegado.

**Alternativas descartadas:**

- *Un "?" por sección del formulario.* Es lo que mejor apunta, pero obliga a
  tocar las nueve secciones del formulario. Queda como [B-60](BACKLOG.md) con el
  mecanismo listo: cada capítulo ya declara a qué sección corresponde.
- *Un tour guiado al primer ingreso.* Se ignora, se saltea, y hay que
  mantenerlo alineado con el layout además de con la funcionalidad.
- *Un documento aparte (Drive, Notion).* Es lo que ya no funciona: nadie abre
  otra pestaña para cargar un taller, y un documento afuera del repo se
  desactualiza sin que nada lo note.

---

## D-62 · El contenido de la ayuda es data tipada y testeada

**Decisión:** el texto vive en `src/lib/ayuda.ts` como arrays de objetos
(`AVISOS`, `CAPITULOS`), y los componentes solo lo pintan.

**Motivo:** el riesgo real de una ayuda no es que quede fea, es que **mienta**.
Con el contenido como data se puede verificar:

- `tests/ayuda.test.ts` lee `ActividadFormulario.tsx` y falla si hay una sección
  del formulario sin capítulo. Es el mismo recurso poco ortodoxo de
  `tests/opciones-orden.test.ts` (leer el fuente), y por el mismo motivo: fija
  algo que de otro modo se pierde en silencio.
- Verifica que los seis avisos irreversibles sigan explicados, con un mínimo de
  largo para que no se puedan vaciar.
- Verifica el **tono**: el texto no puede contener `§`, "trampa", nombres de
  archivo, ni nombres de campo (`slug`, `urlPublica`, `searchText`). Sin eso, la
  jerga del resto de la documentación se filtra sola.

**Costo:** el texto entra al bundle del panel — unos 19 KB de contenido entre
la guía y las novedades, bastante menos comprimido. Queda aislado en `/admin`,
que ya carga el SDK de Firebase, así que no afecta al sitio público ni al SEO
(ver B-09).

---

## D-63 · Las novedades viven en el repo, no en Firestore

**Decisión:** `src/lib/novedades.ts` se despliega con el build. No hay una
colección de novedades editable desde el panel ni desde la consola.

**Motivo — el mantenimiento decide el diseño.** La pregunta no es dónde es más
flexible, es quién lo va a mantener al día dentro de dos meses:

| | En el repo | En Firestore |
|---|---|---|
| Cuándo se escribe | en el mismo commit que la funcionalidad | después del deploy, a mano |
| Quién revisa que esté | la review del cambio, y la regla de proceso | nadie |
| Qué hace falta construir | nada | reglas, tests de integración y una pantalla de edición |
| Si nadie lo escribe | se nota en el diff | no se nota nunca |

Y el argumento que cierra: **una novedad existe porque se publicó código**. No
hay caso en que haga falta anunciar algo sin haber desplegado nada, así que
"editable sin deploy" no compra nada real. La evidencia está en el propio
proyecto: [B-06](BACKLOG.md) pide desde el principio una pantalla para
administrar taxonomías y nunca se construyó. Una pantalla para editar novedades
habría corrido la misma suerte, y con ella la lista entera.

**Costo aceptado:** no se puede corregir una errata ni avisar de una caída sin
desplegar. Queda anotado como [B-62](BACKLOG.md); si algún día hace falta un
aviso urgente, es otra cosa y se resuelve aparte.

---

## D-64 · Lo no leído se marca con un id en el navegador, y el aviso es un número

**Decisión:** se guarda el id de la última novedad vista en el navegador de cada
persona; las posteriores son "sin leer" y el botón "Ayuda" muestra su cantidad.

**Por qué el id y no la fecha:** varias novedades comparten fecha (salen el
mismo día) y una fecha no distingue entre ellas. El orden del array es el orden
real, así que "hasta acá leí" es una posición, y la posición se nombra con un id
estable. De ahí la regla de no reusar ni renombrar ids.

**Los dos casos de borde, y hacia dónde se falla:**

- **Sin marca guardada** (primera vez, navegador nuevo, datos borrados) → todo
  cuenta como nuevo. Es deliberado: la primera vez, el número es la invitación a
  leer la lista completa.
- **Marca que ya no está en la lista** (alguien borró una entrada vieja) → no se
  avisa de nada. Se falla hacia el silencio: un aviso falso que aparece siempre
  se aprende a ignorar, y ahí el mecanismo entero deja de servir.

**Por qué no algo compartido entre dispositivos:** guardarlo en Firestore por
usuario haría que el teléfono y la computadora lleven la misma cuenta, a cambio
de una escritura, unas reglas y un documento por persona. Para "¿vi esta lista?"
no vale: leerla dos veces no molesta a nadie.

**Cómo se avisa, y cómo no:** un número al lado de la palabra "Ayuda". Sin
ventana que se abra sola, sin cartel que haya que cerrar, sin punto rojo
parpadeando. Quien está cargando una actividad a las once de la noche no quiere
enterarse de una mejora: quiere guardar. El número espera, y se apaga al abrir
la pestaña de novedades una vez. El único aviso que interrumpe en este panel
sigue siendo el de versión nueva (D-37), y ese interrumpe porque si no se pierde
trabajo.

---

## D-65 · Guía y novedades comparten un botón, con dos pestañas

**Decisión:** una sola entrada en el encabezado, con pestañas "Guía" y
"Novedades". Si hay novedades sin leer, abre en Novedades; si no, en la guía.

**Motivo:** el encabezado tiene que seguir entrando en 360px al lado de
"Volver", "Salir" y el mail de la cuenta. Dos botones más ahí es una fila que se
parte en tres líneas. Y las dos cosas se consultan en el mismo momento —"¿cómo
era esto?" y "¿qué cambió?"—, así que separarlas no ayuda a encontrarlas.

**Costo:** la pestaña que abre depende del estado de lectura, o sea que la misma
acción no siempre muestra lo mismo. Es lo que se quiere: si hay algo sin leer, es
la razón por la que la persona hizo clic.

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

## D-56 · La analítica manda una proyección, no el objeto

**Decisión:** los eventos de analítica del panel pasan por una whitelist en las
dos direcciones: un nombre de evento no declarado no manda nada, y un parámetro
no declarado en ese evento se descarta. Cada parámetro tiene un sanitizador, y
**no existe un sanitizador de texto libre**: entero, booleano, enum cerrado,
ruta de campo del schema, o lista de esos.

**Motivo:** es el criterio del §5.2 y de `toPublic.ts` —se manda una proyección
deliberada, no el objeto— pero llevado un paso más allá, porque el destino es un
tercero. La diferencia práctica es de dónde viene la garantía: con filtros en
cada punto de medición, la privacidad depende de que quince llamadas se acuerden
de filtrar; con la whitelist, un `medir()` que pase el formulario entero produce
un payload vacío.

**Alternativa descartada:** sanitizar en cada `medir()`. Se descartó por lo de
arriba, y porque el mismo argumento del D-07 aplica: lo que se mantiene a mano
se desactualiza en silencio, y acá el silencio es una fuga.

**Costo:** medir un dato nuevo obliga a declararlo y a elegirle un vocabulario.
Es la intención.

---

## D-57 · El perfil es un identificador aleatorio, no el uid ni un hash del mail

**Decisión:** para distinguir a las dos personas que cargan, se usa un valor
aleatorio generado en el navegador y guardado en `localStorage`.

**Alternativas descartadas:**

- **El uid o el mail.** Son exactamente lo que el §5.1 mantiene fuera de toda
  salida.
- **Un hash del mail.** Parece la opción prudente y no lo es: el conjunto de
  admins es de dos personas conocidas, así que el hash se revierte probando dos
  entradas. Sería el mail con otro nombre.
- **Solo el `client_id` de GA4.** Alcanzaría, pero es una cookie propia de GA y
  no se puede leer ni razonar sobre ella desde el código.

**Costo:** el identificador se pierde si se limpia el navegador, y una misma
persona en dos aparatos cuenta como dos. Aceptable: lo único que se necesita es
separar "una persona se trabó diez veces" de "diez personas se trabaron una
vez".

---

## D-58 · El SDK de analítica se carga diferido, y su ausencia no rompe nada

**Decisión:** `firebase/analytics` entra por un `import()` dinámico disparado con
`requestIdleCallback`, y todo `medir()` está envuelto en un `try/catch`.

**Motivo:** el bundle del panel ya pesa ~570 KB (B-09) y hay trabajo en curso
para bajarlo; sumarle el SDK al chunk inicial sería trabajar en contra. Medido:
el SDK queda en un chunk propio de 34.5 KB (7.3 KB gzip) que no lleva
`modulepreload` y solo se descarga cuando el navegador está libre.

Y un ad blocker que bloquee ese `import()` no puede tirar el formulario: los
eventos previos a la carga se encolan (máximo 30), y si el SDK nunca llega la
cola se descarta.

**Costo:** un evento disparado al cerrar la pestaña se pierde si el SDK todavía
no cargó ([B-57](BACKLOG.md)). El camino que importa —"Cancelar" / "Volver"— no
sale de la página, así que se mide igual.

---

## D-59 · Ocho eventos con nombres estables, y uno por campo inválido

**Decisión:** la taxonomía tiene ocho eventos
([`09-analitica.md`](09-analitica.md)), no uno por interacción. Las funciones del
panel van todas en `funcion_usada` con un enum cerrado.

**Motivo:** cincuenta eventos sueltos no se analizan; diez bien elegidos sí. Un
test fija el tope en diez, para que el número once sea una decisión y no un
descuido, y otro verifica que la lista de nombres implementados sea exactamente
la documentada — si se agrega uno sin documentarlo, falla.

**La excepción es `campo_invalido`**, que se dispara una vez **por campo** además
del `validacion_fallida` que resume el intento. Es redundante a propósito: GA4 no
sabe desarmar una lista concatenada, y sin un evento por campo no se puede
rankear qué campo traba a la gente, que es la pregunta que motivó todo esto.

---

## D-60 · El vocabulario de campos se deriva del schema, no se mantiene a mano

**Decisión:** las rutas de campo válidas para `campo_invalido` se derivan
recorriendo `actividadFormSchema` al cargar el módulo, colapsando los índices de
array a `N` (`sesiones.3.fin` → `sesiones.N.fin`).

**Motivo:** es el mismo argumento del D-07. Una lista escrita al lado del schema
se desactualiza, y acá desactualizarse significa que un campo nuevo que falla
validación se reporta como `otro` justo cuando alguien está buscando por qué la
gente se traba en él. En silencio, otra vez.

**Costo:** el recorrido usa las estructuras internas de zod (`_def.typeName`,
`shape`, `innerType`). Es la parte más frágil de la instrumentación, y por eso
hay un test que verifica que el vocabulario derivado contenga rutas concretas y
que tenga un tamaño plausible: si una actualización de zod rompe el recorrido, el
test falla en vez de dejar todo en `otro`.

**Enmienda (B-09):** el recorrido dejó de correr en el navegador. Importar
`@/lib/schema` desde el módulo de analítica arrastraba zod al chunk inicial del
panel —68 kB que el corte de B-09 había sacado—, así que hoy `CAMPOS_VALIDABLES`
es una constante y **el recorrido vive en `tests/analytics-campos.test.ts`**, que
lo deriva del schema y falla diciendo qué sobra y qué falta. La decisión de fondo
no cambió: la lista no se mantiene a mano, se verifica contra el schema. Lo que
cambió es dónde corre la verificación. Es el patrón que D-98 generaliza.


---

## D-70 · Dos lentes sobre lo mismo: el listado enumera actividades, el calendario enumera encuentros

**Contexto:** el pedido fue "una vista calendario donde lo importante es el
estado de la publicación". El listado muestra **una tarjeta por actividad** — el
§2.2 es explícito: un club de ocho encuentros es una actividad, no ocho. Un
calendario muestra **días**, así que ese mismo club aparece ocho veces. Las dos
formas son correctas y hay que decidir cómo se relacionan.

**Decisión:** son **dos lentes sobre los mismos documentos**, con ejes distintos
y un solo lugar donde se edita.

| | Listado | Calendario |
|---|---|---|
| Qué enumera | actividades | encuentros |
| Para qué | encontrar y editar | ver qué está publicado y cuándo |
| Unidad de la fila | la actividad | la sesión |
| Qué abre al tocar | la actividad | **la actividad** |

Tres reglas sostienen que no se lea como duplicación:

1. **Cada encuentro dice qué lugar ocupa en su actividad** ("Encuentro 3 de 8").
   Sin eso, ocho renglones con el mismo título se leen como ocho actividades.
2. **El resumen del mes cuenta las dos cosas**: "12 encuentros de 3 actividades".
3. **La unidad de edición no cambia:** tocar un encuentro abre la actividad
   completa. No hay ninguna escritura desde el calendario — sigue siendo una sola
   escritura por actividad, como pide el §2.2.

**Alternativas descartadas:**

- *Que el calendario muestre una entrada por actividad, en su primera fecha.* Es
  el listado con otra forma: no responde "qué hay el jueves", que es la única
  razón de mirar un calendario.
- *Colapsar el ciclo en su rango ("del 3/9 al 22/10") ocupando una barra.* Pierde
  exactamente el dato que el estado de publicación necesita: cada encuentro tiene
  su propio evento y puede estar publicado o no **por separado** (uno cancelado,
  uno cuyo evento falló). Una barra no puede tener siete estados.
- *Convertir las sesiones en documentos propios para que el calendario los
  consulte.* Es revisitar el §2.2, que es una decisión cerrada.

---

## D-71 · El estado de publicación se deriva, y `debeExistir` no se reimplementa

**Contexto:** "estado de la publicación" no es el campo `estado`. La pregunta que
se contesta mirando un calendario es *¿esto ya lo ve la gente?*, y eso depende de
tres datos a la vez: `actividad.estado`, `sesion.cancelada` y si la sesión tiene
`calendarEventId` — o sea si el evento **existe** en el calendario público.

**Decisión:** `estadoPublicacion` (en `src/lib/calendarioPanel.ts`) cruza
`debeExistir(actividad, sesion)` —**importada de `@calendario`**, la misma
función que usa el sync para decidir— con la existencia de `calendarEventId`:

| debería existir | existe | estado |
|---|---|---|
| sí | sí | `en-calendario` |
| sí | **no** | `falta-en-calendario` |
| no | **sí** | `sobra-en-calendario` |
| no | no | el motivo: `encuentro-cancelado`, `borrador`, `pendiente` o `cancelado` |

**Motivo de no copiar la regla:** es el mismo de D-20. Si el panel reimplementara
el §7.3, el día que cambie la condición del sync el panel mostraría un estado y
el calendario público tendría otro — y esta vista existe precisamente para
detectar esa clase de divergencia. Reimplementarla sería construir el detector
con el mismo defecto que busca.

**Lo que aparece gracias al cruce, y hoy no muestra ninguna pantalla:**

- `falta-en-calendario` — la actividad dice "publicado", el encuentro no está
  cancelado, y en el calendario no hay nada: la Function no corrió o falló. Antes
  de esto nadie se enteraba nunca; el panel no tenía forma de saberlo y el
  calendario tampoco grita.
- `sobra-en-calendario` — el espejo: pasó a borrador o se canceló, y el evento
  sigue ahí. La gente puede seguir viendo algo que ya no debería estar.

`calendarEventId` es fiable en las dos direcciones porque `syncCalendar` lo
escribe al crear el evento y lo vuelve a `null` al borrarlo, incluso cuando
Calendar responde que el evento ya no existía.

**Límite conocido:** el id dice qué cree Firestore, no qué tiene Google. Un
evento borrado a mano en Calendar (§2.1: el calendario es un espejo) sigue
figurando como `en-calendario` hasta la próxima edición. Verificar contra la API
sería una lectura de red por sesión en una pantalla de solo lectura, y contradice
que Firestore es la única fuente de verdad. Anotado en B-127.

**Segundo límite, deliberado:** `sobra-en-calendario` es transitorio durante los
segundos que tarda el sync después de guardar. El aviso lo dice en lugar de
esconderlo: preferimos un falso positivo que se va solo antes que ocultar el caso
real, que es el que nadie ve.

---

## D-72 · En el teléfono no hay grilla de mes

**Contexto:** una grilla de 7 columnas en 360px da celdas de ~45px. No entra la
hora, mucho menos el título, y los blancos táctiles quedan en la mitad de los
44px del proyecto.

**Decisión:** la grilla de mes se renderiza **solo desde `sm`**
(`hidden sm:block`), y abajo de ese ancho se ve siempre la **agenda**: los días
que tienen algo, uno abajo del otro, con el encabezado del día y una fila por
encuentro de 44px de alto. Los días vacíos no se dibujan.

Desde `sm` aparece el conmutador "Mes / Agenda" y la grilla es el default.

**Por qué el corte es por CSS y no por una medición en JavaScript:** así no hay
un estado que pueda quedar en "mes" en una pantalla donde el mes no se lee — por
ejemplo al girar el teléfono o angostar la ventana. Si el modo es "mes", abajo de
`sm` la agenda sigue estando y la grilla simplemente no se muestra.

**Lo que se pierde:** en el teléfono no se ve la forma del mes (qué semanas están
cargadas y cuáles vacías). Es aceptable: en un teléfono lo que se consulta es
"qué se viene", y para eso la agenda es mejor que la grilla incluso donde la
grilla cabría.

---

## D-73 · El listado ordena por lo que se viene, no por lo que se tocó

**Contexto (B-96):** el listado ordenaba por `updatedAt desc`, así que arriba
estaba lo último editado. Con dos personas cargando, un borrador cuyo primer
encuentro es en cuatro días quedaba al fondo — y pasada la fecha no tiene
arreglo.

**Decisión:** el orden por defecto es **próximo encuentro ascendente**. Lo que no
tiene nada por venir va al final, ordenado por última modificación. "Última
modificación" sigue disponible como opción explícita, junto con "título A-Z".

**Por qué la cola va por última modificación y no por su fecha vieja:** si las
pasadas se intercalaran cronológicamente, el fondo del listado sería un archivo
histórico y lo recién tocado —que es lo que alguien está editando ahora— quedaría
perdido en el medio.

**Los cancelados no cuentan como próximos:** un encuentro cancelado no va a
pasar, y si contara, un ciclo cancelado a mitad de camino aparecería arriba como
lo más urgente.

Cierra B-96 por otro camino que el que proponía el backlog (un bloque "esta
semana" arriba del listado): el orden resuelve el problema sin agregar una
sección que hay que mantener, y la vista calendario cubre el panorama. Lo que el
bloque hacía y esto no: avisar de las inscripciones que cierran en los próximos
días — queda anotado en B-128.

---

## D-74 · Cinco filtros, y cuatro descartados con su motivo

**Decisión:** el listado filtra por **estado, tipo, modalidad, barrio y fechas**
("con algo por venir" / "sin fechas por venir"), y todo se cruza con el buscador
de texto que ya existía. Los desplegables ofrecen **solo los valores que alguna
actividad usa**, y muestran la **etiqueta** de la taxonomía, nunca el valor
guardado (§4.1): un filtro que dice `villa-crespo` está roto a la vista.

Todo corre en memoria sobre lo que `listarActividades()` ya trajo: cero lecturas
nuevas, cero índices compuestos. Es el §2.5 aplicado al panel.

**Qué se descartó y por qué:**

| Filtro | Por qué no |
|---|---|
| `arancel` | Es un atributo de publicación, no una forma de recordar una actividad: nadie busca "el taller arancelado". Y su riesgo real —publicar un taller pago como gratuito (D-16)— se previene en el formulario, que es donde se carga, no en el listado |
| `tags` | Es multivaluado, así que necesita un control de selección múltiple, y hoy nadie cura esa lista: sin normalización de etiquetas ni UI de administración (B-05, B-06) el desplegable sería un catálogo de variantes de lo mismo. Cuando exista B-06, se reconsidera |
| `destacado` | Un booleano que hoy no consume nadie: el sitio público todavía no existe (B-01). Filtrar por él contesta una pregunta que nadie tiene |
| quién la cargó | Hay dos cuentas, pero el dato es un identificador de usuario y no un nombre: haría falta un mapa de personas que no existe, y el §5.1 mantiene esos identificadores fuera de todo lo que se muestre |
| estado de publicación (el del calendario) | Existe, pero **en la vista calendario**. Ponerlo también acá sería derivar lo mismo en dos pantallas con dos criterios que se pueden separar, que es justo lo que D-71 evita |

**Los filtros arrancan colapsados detrás de un botón con el número de filtros
puestos.** En 360px cinco desplegables abiertos empujan el listado abajo del
pliegue; y el número es lo que impide que un filtro olvidado se lea como un
listado vacío.

---

## D-98 · Toda lista duplicada lleva guardia, y la guardia más barata que alcance

**Contexto:** la analítica tenía cuatro vocabularios que se mantenían por
separado de su fuente. Tres eran copias literales de enums del modelo
(`ESTADOS`, `MODALIDADES`, `CAMPOS_TAXONOMIA` — B-75) y el cuarto era el formato
de la versión, que `scripts/version.mjs` **produce** y `analytics-eventos.ts`
**consume** (B-88). Los cuatro se habían separado o iban a separarse, y el modo
de falla es siempre el mismo: el valor nuevo viaja como `'otro'` **en silencio**,
justo cuando alguien está mirando los datos para entender algo.

**Decisión:** ninguna lista duplicada queda sin guardia, y la guardia se elige
por lo que el bundle permite:

| Caso | Guardia | Por qué esa |
|---|---|---|
| `ESTADOS`, `MODALIDADES`, `CAMPOS_TAXONOMIA` | **importar** el enum del modelo | `@/types/actividad` tiene fan-out 0: cuesta 203 bytes en la carga inicial de `/admin` (+0,05 %) y el chunk de zod no se movió. Si se puede importar, se importa |
| El formato de `version` | **un test que ata productor y consumidor** | No se puede importar: el productor usa `node:child_process` y el consumidor viaja al navegador. Es el caso del D-60 con zod |
| Las rutas de campo (`CAMPOS_VALIDABLES`) | test que las deriva del schema (D-60) | Idem: importar `@/lib/schema` metía 68 kB de zod en el chunk inicial |

**El import se prefiere al test** porque no hay nada que mantener: la guardia es
la identidad. El test de B-75 no compara valores, compara referencias (`toBe`):
si alguien vuelve a escribir la lista al lado del import, falla aunque los
valores coincidan ese día.

**Cómo se ata un formato que no se puede importar** (B-88, y el patrón para el
próximo):

1. El productor tiene **un solo lugar** donde se arma la cadena
   (`componerVersion`, puro) y declara al lado el **dominio completo de entradas**
   que un build puede tener (`ENTRADAS_DE_BUILD`: hay commit o no, el árbol está
   limpio o no).
2. `versionesPosibles()` recorre ese dominio y devuelve todo lo que el build
   puede llegar a estampar. No es una lista de ejemplos escrita a mano: sale de
   ejecutar el productor.
3. El test mete cada salida en el sanitizador **real** del consumidor y exige que
   viaje entera, y además hace lo mismo con la versión que estampa el árbol de
   trabajo de quien corre los tests (git de verdad: en CI limpio, en la máquina
   de quien trabaja casi siempre sucio, y las dos ramas tienen que pasar).

Una forma nueva inventada del lado del build rompe ese test en vez de mandar
`'otro'` a GA4.

**Alternativa descartada: arreglar el regex y listo.** Era una línea y dejaba el
mismo problema para el próximo formato que alguien invente — que es exactamente
cómo apareció este.

**Alternativa descartada: mover el formato a un módulo compartido.** Tendría que
ser importable desde un `.mjs` de build y desde el bundle del navegador a la vez.
Se puede, pero el módulo compartido más chico posible es una constante de una
línea, y para sostenerla habría que meter un archivo nuevo en `src/lib/` que el
script de build importe cruzando la frontera TS/Node. El test cuesta menos y
cubre más (verifica el productor **ejecutándolo**, no leyéndolo).

**Costo asumido:** el formato aceptado se amplió a `[-+][0-9A-Za-z][0-9A-Za-z.-]`
hasta 40 caracteres, para que entren `+5e2cb50-sucio.20260821-2124` y
`+sin-git.20260821-2124`. Sigue siendo cerrado: sin espacios, sin acentos, sin
`@ : / ?`, así que un título, un mail, un handle o un link no pueden pasar. Nueve
entradas rechazadas quedaron fijadas en un test, y los 11 tests de privacidad
siguen en verde sin tocarse.

---

## D-106 · Un chequeo estructural pregunta por el grafo, no por un archivo

**Decisión (B-117, B-50, trampa 4):** los tests que cuidan el corte del bundle y
la separación cliente/servidor recorren el **cierre transitivo de imports** desde
la entrada de la island, y afirman propiedades sobre lo alcanzable. No comparan
listas de nombres de archivos.

**El motivo, que es un patrón y no una preferencia.** La regla del §5.4 no es
"`AdminApp` no importa `firebase-admin`": es "**no se llega** a `firebase-admin`
desde el cliente". La del corte del bundle no es "estos dos componentes se cargan
con `import()`": es "lo que se difiere **no es alcanzable** de forma estática".
Las dos son preguntas sobre el grafo, y una lista de nombres las responde solo
para el repo del día que se escribió: `bundle-panel.test.ts` nombraba dos
componentes diferidos cuando ya había cuatro, y el modo de falla más probable
—un import nuevo tres saltos más abajo que arrastra el SDK por la cadena— no
tenía forma de aparecer en ninguna lista.

**La contracara, que es obligatoria:** un recorrido de grafo puede fallar
devolviendo poco, y entonces "no se alcanza X" pasa en verde porque no se alcanza
nada. Por eso cada chequeo de este tipo lleva su **control positivo**: se afirma
que siguiendo los `import()` el SDK **sí** aparece, que el grafo inicial tiene un
mínimo de archivos y que incluye `react`. Sin el control, la propiedad no se
puede creer.

Vale para lo que venga: la pregunta "¿esto llega hasta acá?" se contesta
recorriendo, y se acompaña de la pregunta "¿el recorrido sabría encontrarlo?".

## D-107 · El mapa de trampas se verifica contra el repo, no se lee

**Decisión (B-119):** `docs/15-mapa-de-trampas.md` es el mapa trampa → test →
archivo, y `tests/mapa-de-trampas.test.ts` lo contrasta con el repo en cada
corrida. La lista de trampas se **lee** del §13 del `CLAUDE.md` y la lista de
trampas descubiertas se **calcula** de los tests; el documento solo declara, y el
test compara las dos direcciones.

**Por qué no alcanzaba con escribir el documento.** El ítem pedía reemplazar un
`grep` frágil del `auditor-trampas` por algo determinístico. Un documento a mano
es determinístico y **peor**: el `grep` al menos mira el repo de hoy, y una tabla
sin verificar envejece en silencio justo en la dirección que importa (dice que
algo está cubierto cuando ya no lo está). Verificándolo, la tabla no puede
mentir en ninguno de los dos sentidos.

**Lo que esto convierte en regla:** el test que cubre una trampa la **nombra**
(`trampa N`) en su `describe` o en su cabecera. Era una costumbre que hacía
posible el `grep`; ahora es obligatoria y hay un test que la exige.

**Lo que el mapa no dice, y está anotado en el propio documento:** si la red es
*completa*. Verifica que exista un test que nombre la trampa, no que ese test
agote el modo de falla. La cobertura parcial se anota a mano en la sección
correspondiente.

## D-108 · Un detector estático sigue la llamada, y se testea con cuerpos sintéticos

**Decisión (B-171):** los chequeos que buscan un patrón en el código de las
Functions (efecto duplicable, guarda de reentrega) operan sobre la **traza** del
trigger —expandiendo las llamadas a funciones declaradas en `functions/**`, del
mismo archivo o importadas— y no sobre el texto del cuerpo del trigger.

**El motivo:** el refactor de B-77 movió a helpers exactamente las dos cosas que
el detector buscaba, y el detector se apagó. No fue mala suerte: **`Extract
Function` es el refactor más común que existe**, y cualquier chequeo que mire una
sola hoja del árbol va a quedar ciego la primera vez que alguien lo aplique. La
pregunta "¿este trigger produce un efecto duplicable?" no es sobre su texto, es
sobre lo que ejecuta.

**Y qué es un efecto duplicable, afinado en el camino.** Crear algo cuya
identidad elige el receptor (`fetch(`, `.insert(`, `.add(`, `.create(`) o
escribir en una **dirección calculada** (`.doc(<expresión>).set(`) puede
duplicar. Direccionar una identidad que ya existe (`.update(`, `.delete(`,
`.patch(`) o escribir siempre en la misma dirección (`.doc('literal').set(`, o
sea `marcarRebuild`) no puede: re-ejecutarlo no produce un segundo nada. Sin esa
distinción el detector pedía guardas de reentrega donde no hacían falta.

**La parte que faltaba la primera vez:** el detector **se testea**. Nueve tests
con cuerpos inventados y un resolver falso —incluida la regresión exacta de
B-171, un efecto que solo vive en un helper— más los controles positivos y
negativos sobre el repo real (hay al menos dos triggers con efecto duplicable,
y hay al menos uno **sin**). El detector es lo que decide si el chequeo mira algo
o da un verde vacío; hasta ahora nadie lo verificaba, y el síntoma fue un test
que hubo que apagar.

**El corolario que más duele:** un detector ciego no solo pierde regresiones.
También **miente sobre lo que sigue roto** — el `it.fails` de B-82 siguió
fallando meses después de que el bug estaba arreglado, y nadie lo notó porque un
`it.fails` que falla se ve exactamente como debe verse.

## D-99 · La proyección de analítica no se muda al lado diferido

**Decisión** (B-59, descartado): `construirEvento` y los vocabularios se quedan
en el chunk inicial del panel. No se mueven al lado diferido con `medir()`
encolando valores crudos.

**Lo medido** (2026-08-24, cierre estático de imports de `/admin`, comparando el
build real contra el mismo build con la instrumentación en no-ops):

| | raw | gzip |
|---|---|---|
| Carga inicial de `/admin` hoy | 386.303 B | 107.590 B |
| Sin ninguna instrumentación | 377.245 B | 104.464 B |
| Toda la instrumentación | 9.058 B | 3.126 B (2,9 %) |
| **Solo la taxonomía + la proyección** | **6.522 B** | **2.188 B (2,0 %)** |

Esa última fila es el techo de lo que B-59 podía ganar: **2,14 kB gzip**, el
2,0 % de la carga inicial comprimida y el 1,7 % de la cruda. El chunk del SDK
(34,5 kB / 7,3 kB gzip) ya está diferido y sin `modulepreload` (D-58), que era el
bulto de verdad.

**Motivo para no hacerlo:** hoy la proyección es **un único portón sincrónico**.
`medir()` proyecta antes de encolar, así que lo que espera en la cola —hasta 30
eventos, si el SDK todavía no cargó o nunca carga— son payloads ya sanitizados.
Con la proyección del otro lado, la cola guardaría **los valores crudos**: el
contenido del formulario viviría en memoria esperando a un SDK que un ad blocker
puede impedir que llegue, y la propiedad que hace valer a los 11 tests de
`analytics-privacidad.test.ts` —"un `medir()` mal escrito produce un payload
vacío, no una fuga"— pasaría a depender de dos pasos en vez de uno.

2,14 kB gzip no paga eso. Si algún día el bundle necesita esos kilobytes, hay
34,5 kB de SDK y 186 kB de runtime de React antes en la fila.

## D-90 · El id del evento de Calendar lo elige el cliente, derivado del id de sesión

**Decisión (B-82):** al crear un evento, `syncCalendar` manda el `id` en el
`requestBody` — `ses_<uuid>` sin el `_` ni los guiones, que es lo que
`idDeEvento` deriva del id de sesión. Un `insert` repetido devuelve **409** y se
resuelve con un `update` sobre ese mismo evento.

**El problema:** la entrega de eventos de Firestore es *al menos una vez*, y la
Function decide con el payload del evento (`before`/`after`), no con el estado
del documento. Una reentrega de la escritura que publicó una actividad trae el
mismo `before` y el mismo `after`, así que `planificar` vuelve a decir `crear`:
dos eventos para el mismo encuentro en el calendario **público**, y el primero
huérfano. La guarda anti-loop del §7.1 (D-07) no cubre esto: corta la
*recursión* —la segunda escritura produce el mismo payload— no la *reentrega*.

**Por qué esta salida y no un marcador en el documento.** La alternativa era
llevar en Firestore los `event.id` ya aplicados, como hace `guardarVersion` con
`idDeVersion(event.time, event.id)` (D-43). Funciona, pero deja la idempotencia
del lado equivocado: la Function tendría que **acordarse** de lo que hizo, con
un registro que hay que escribir, leer y podar, y que puede desincronizarse del
calendario real. Con el id derivado, la unicidad la garantiza el sistema donde
está el daño. No hay estado nuevo que mantener y la propiedad no se puede
romper por olvido, igual que en D-07.

**Lo que hubo que verificar, y no asumir:** Calendar acepta un id elegido por el
cliente solo en **base32hex** (`0-9a-v`, RFC 2938 §3.1.2) y de 5 a 1024
caracteres. `ses_` + un uuid sin guiones son 35 caracteres de `0-9a-f`, que es
un subconjunto. `tests/sincronizacion.test.ts` lo comprueba contra ids generados
por el mismo código del panel (`nuevaSesionId`), no contra un literal.

Y sacar los guiones es **inyectivo** porque están en posiciones fijas: dos
sesiones nunca comparten el id del evento. Si colisionaran, el 409 haría que dos
encuentros terminaran apuntando al mismo evento.

**Compatible hacia atrás:** los eventos que ya existen conservan el id que les
dio Google. El diff los sigue encontrando por el `calendarEventId` guardado;
esto solo decide el id de los que se crean de ahora en adelante.

**Efecto lateral bueno:** una sesión que pasó a borrador (se borró su evento) y
volvió a publicarse antes se recreaba con un id nuevo; ahora el `insert` da 409
—Calendar reserva el id de un evento borrado— y el `update` con
`status: 'confirmed'` **restaura el evento original**, con los recordatorios y
las suscripciones de la gente. Sin el 409 manejado, ese encuentro no habría
podido volver nunca al calendario.

**Costo aceptado:** si el id de sesión no tiene la forma documentada —el
respaldo de `nuevaSesionId` sin `crypto.randomUUID` usa base36, que tiene letras
fuera del alfabeto— `idDeEvento` devuelve `null`, el `insert` va sin id y lo
elige Google. Se pierde la idempotencia de esa sesión, nunca la sincronización.

---

## D-91 · El `calendarEventId` se repone en toda operación, y solo si cambió

**Decisión (B-80):** el write-back de `syncCalendar` escribe el id del evento
para **las tres** operaciones del plan —`crear`, `actualizar` y `borrar`— y no
solo para la primera y la última. `reponerIds` devuelve `null` si el documento
ya tiene los ids que corresponden, y en ese caso no se escribe nada.

**El problema:** el panel es dueño de un campo que escribe la Function.
`formADocumento` emite `calendarEventId` en cada guardado, y el listado se
refresca al guardar (`setVersion(v + 1)`), o sea **antes** de que llegue el
write-back. Guardar desde ese snapshot pisa el id con `null`. Ese guardado
todavía actualiza el evento correcto —`planificar` lo saca del `before`— así que
no se nota; la edición siguiente ya no tiene de dónde sacarlo y emite `crear`.

**Por qué del lado de la Function.** El backlog listaba tres salidas y la más
prolija era del lado del panel (que `actualizarActividad` relea y fusione los
ids antes de escribir, y el panel deje de ser dueño del campo). Se eligió la de
la Function porque es **defensiva**: no depende de que el cliente se porte bien,
y cubre también un guardado hecho por un script, por la consola de Firestore o
por una versión vieja del panel abierta en otra pestaña. La ventana entre las
dos escrituras sigue existiendo, pero ya no deja daño permanente: la pasada que
pisó el campo es la misma que lo repara.

La salida del panel sigue valiendo y quedó abierta como **B-150**: son
complementarias, no alternativas.

**Por qué `reponerIds` devuelve `null` cuando no hay cambios.** Sin eso, cada
`actualizar` escribiría el documento para dejarlo igual, y cada escritura es un
disparo más de esta misma Function (y de `guardarVersion`). Con la comparación,
el caso normal no escribe: solo escribe cuando de verdad hay un id para reponer
o para limpiar.

---

## D-92 · El rebuild se marca por contenido editable, no por operaciones de Calendar

**Decisión (B-83):** `syncCalendar` marca `sistema/rebuild` **al principio**,
antes de los cortes `if (ops.length === 0)` y `if (!CALENDAR_ID)`, y la
condición es `huboCambioDeContenido(antes, despues)` — la misma función que
decide si se guarda una versión del historial (D-41).

**El problema:** el rebuild era un *efecto secundario* del sync a Calendar.
`destacado`, `imagenUrl`, `searchText` y el `slug` salen al `events.json` (§5.2)
y no entran al evento del calendario, así que tildar "Destacar en la portada" de
una actividad publicada no generaba ninguna operación, no marcaba rebuild y no
llegaba nunca al sitio. Y sin `GOOGLE_CALENDAR_ID` configurado la Function
volvía antes de marcar: un proyecto sin calendario no publicaba nada, nunca.

**Por qué con guarda y no `marcarRebuild` arriba a secas.** Esta misma Function
escribe `calendarEventId` de vuelta en el documento, y esa escritura la vuelve a
disparar. Marcar sin condición pediría un build por cada sincronización, y no es
solo un build de más: `marcarRebuild` incluye `CAMPOS_REARME`, que rearma el
contador de reintentos (D-23), y volvería a subir `pendiente` justo después de
que un build arrancó — el mismo daño que B-85, provocado por nosotros.

**Por qué `huboCambioDeContenido` y no una lista de campos públicos.** Porque la
pregunta ya estaba resuelta en `historial.js`: el contenido editable es el
documento *menos lo que escribe la máquina*, o sea "todo lo que pudo tipear una
persona". Es una lista **negra** (D-41), así que un campo nuevo del modelo entra
solo: el error posible es un build de más, nunca un cambio que no se publica.
Una lista blanca de campos públicos fallaría en la dirección cara: agregar
un campo al `events.json` y olvidarse de sumarlo a la lista dejaría de publicar
ese dato, en silencio. Es el mismo razonamiento de D-07 y D-41, y reusar la
función es lo que impide que los dos criterios se separen.

**Costo aceptado:** un cambio puramente interno (`difusion`, el link privado de
la reunión) marca un rebuild que no cambia nada del sitio. Al lado de no
publicar `destacado` es gratis, y el debounce del §8 junta los seguidos.

---

## D-93 · Renombrar una etiqueta re-sincroniza los eventos publicados

**Decisión (B-04):** `rebuildPorOpciones` compara las etiquetas del `before` con
las del `after` y, si alguna cambió, reescribe los eventos de las actividades
publicadas que la usan. Con tope de 150 eventos por corrida y
`timeoutSeconds: 300`.

**El problema:** la descripción y la ubicación del evento muestran la
**etiqueta**, no el slug (D-11). La actividad guarda solo el slug (§4.1), que es
lo que permite renombrar sin tocar documentos — pero el evento de Calendar es una
copia ya materializada. Renombrar "A la gorra" arreglaba el sitio (que se
rebuildea) y dejaba el calendario diciendo lo anterior hasta la próxima edición
de cada actividad.

**Por qué no se resuelve con `planificar`.** El diff recibe **un** juego de
etiquetas y compara el evento de `antes` contra el de `despues`; con la actividad
igual a los dos lados no ve ninguna diferencia. Acá lo que cambió son las
etiquetas, así que `replanificarPorEtiquetas` construye el mismo evento con el
mapa viejo y con el nuevo y compara **eso**. Es el criterio de D-07 —comparar el
payload que se le mandaría a Calendar— aplicado al otro eje.

**La guarda que hace esto viable:** `/opciones/*` se escribe en **cada** guardado
del formulario, porque `upsertOpcion` sube `usos` (§4.2). Sin `mismasEtiquetas`,
cada guardado dispararía una re-sincronización completa del calendario. La
comparación es sobre el mapa `{slug: label}`, así que `usos` y el reordenamiento
de las opciones no cuentan como renombre. Una opción **nueva** sí cuenta como
cambio, y no hace daño: todavía no la usa ninguna actividad, así que no genera
ninguna operación.

**Costo aceptado:** el tope de 150 eventos. Con 20 actividades publicadas de 8
encuentros ya son 160 round trips a Calendar, y la Function tiene timeout. Si se
alcanza, se loguea `error` con cuántos quedaron: el sitio ya está al día y cada
actividad se pone al día sola con su próxima edición. Es un tope de seguridad
para que un renombre no deje la Function reintentando en loop.

---

## D-94 · Borrar una actividad guarda su última versión, y no es borrado lógico

**Decisión (B-41):** un `onDocumentDeleted` sobre `actividades/{id}` escribe el
documento completo en `/actividades/{id}/versiones/{version}` con
`borrado: true`, por el mismo camino que el trigger de edición (mismo id
idempotente, misma retención).

**El problema:** `guardarVersion` es un `onDocumentUpdated` (§12), así que no se
disparaba al borrar. El panel borra por fila y sin papelera: era el último
agujero de pérdida de datos, y el único irreversible.

**Por qué no borrado lógico.** `estado: 'borrado'` + filtrarlo del listado
también resolvería el "lo borré sin querer", y encima sin subcolección huérfana.
Se descartó por dos motivos: toca el listado, el formulario, las reglas y el enum
del modelo —o sea la fase 2 del plan de saneamiento, con el archivo más
disputado del repo— y sobre todo porque `estado` ya decide qué se publica (§7.3):
sumarle un valor mezcla "esto no se muestra" con "esto no existe". El trigger son
quince líneas, no cambia el modelo y guarda exactamente lo que se perdía.

**Lo que queda pendiente, y ya estaba (B-89):** la subcolección sobrevive al
documento padre, así que la versión del borrado queda huérfana — alcanzable por
path desde la consola de Firestore, invisible desde el panel. Es a la vez lo que
hace recuperable el borrado y lo que B-89 tiene que resolver cuando exista UI de
restauración (B-40). Borrarla en el mismo trigger sería tirar justo lo que se
acaba de guardar.

**Quién borró no se sabe:** el evento de borrado no trae uid, así que
`actualizadoPor` guarda el último que editó. Es lo más cerca que se puede estar
sin agregar un campo al modelo.

## D-95 · El número del encuentro cuenta también los cancelados

**Contexto (B-84).** La descripción del evento abre con "Club de lectura ·
Encuentro 3 de 8". `posicionEnCiclo` numeraba sobre las sesiones **no
canceladas**, así que cancelar el tercero de ocho convertía al sexto en
"Encuentro 5 de 7". Dos costos, y el segundo es el que importa:

- Siete `actualizar` a la API de Calendar por cancelar un encuentro, cuando el
  §7.2 existe para tocar solo lo que cambió.
- **El texto de siete eventos ya agendados cambiaba.** Quien anotó "Encuentro 6
  de 8" veía cómo se le renombraba el evento sin que nada hubiera cambiado para
  él, y el número dejaba de coincidir con la lectura asignada a esa fila del
  formulario. No se perdían los eventos —eran `actualizar`, no `borrar`+`crear`,
  así que los recordatorios y las suscripciones sobrevivían—, pero el daño de
  reescribir lo que la gente ya leyó es real.

**Decisión:** se numera sobre **todas** las sesiones del array, canceladas
incluidas. El cancelado no tiene evento (§7.3), así que en el calendario queda
un hueco en la serie.

**Motivo:** el número es la **identidad** del encuentro dentro del ciclo, no un
recuento en vivo de los que siguen en pie. Es lo que le sirve a quien lo tiene
agendado: le dice qué encuentro del ciclo es este, con qué lectura se
corresponde y qué fila del formulario le pidió el organizador. Una identidad que
cambia retroactivamente no es una identidad. El §2.2 le da sentido justamente
así: las sesiones son una lista explícita —y no un evento recurrente— porque
cada encuentro tiene su propio tema y su propia lectura.

Y es el criterio que el panel **ya** usaba para el "2 de 8" de la vista
calendario (`encuentrosDe`, D-70): antes de esto, el panel decía "6 de 8" y el
evento público "5 de 7" para el mismo encuentro. Dos criterios para lo mismo
derivado es exactamente lo que D-71 y D-20 evitan.

**El costo, asumido:** el total dice 8 cuando hay 7 encuentros que se van a
hacer, y quien mira el calendario cuenta 7 eventos. Es información, no un error
de conteo: el hueco en la serie es cómo un suscripto se entera de que ese día se
canceló. La alternativa lo borra de la historia y le renombra el resto.

**Alternativas descartadas:**

- *Numerar sobre las no canceladas con el total original ("Encuentro 5 de 8").*
  Mantiene el daño —la posición sigue renumerándose y sigue reescribiendo los
  otros siete— y encima vuelve incoherente el par: la posición contada de una
  manera y el total de otra. Sin la propiedad que se buscaba, con un texto peor.
- *Sacar la numeración de la descripción.* Es lo único en el evento que dice
  **cuál** de los encuentros del ciclo es este: sin eso, el evento del sexto es
  indistinguible del quinto salvo por la fecha, y el tema —que es opcional— deja
  de tener con qué anclarse. Además el panel lo muestra, así que la vista previa
  y el evento perderían información que la pantalla sí tiene. Tirar la
  funcionalidad para arreglar su caso borde.
- *Guardar el número como campo de la sesión.* Sería estable ante cualquier
  edición, pero es un cambio de modelo (§3.1) que se propaga al formulario, al
  generador de encuentros y a la proyección pública, para un problema que se
  resuelve derivándolo bien.

**Lo que sigue renumerando, por diseño:** **agregar o borrar una fila** de un
ciclo publicado cambia el largo del ciclo, así que el "de N" de los demás pasa a
ser falso y se actualizan (nunca se borran ni se recrean). Ahí el conjunto de
encuentros cambió de verdad; en una cancelación no. Queda anotado como **B-160**
por si el costo molesta en la práctica.


---

## D-100 · La mitad cliente del §4.2 vive en un módulo puro, y los widgets no se unifican

**Problema:** `TaxonomiaSelect` y `TagsInput` resolvían el mismo problema del
§4.2 —autocompletado contra lo existente y deduplicación por slug antes de
escribir— con **dos implementaciones separadas**, las dos en `.tsx`, ninguna con
test, y ya divergidas: distinto tope de sugerencias, distinto comportamiento con
el input vacío, y una avisaba "ya existe como «X»" mientras la otra reusaba en
silencio (B-72). El §4.2 está marcado **crítico** en el `CLAUDE.md` y esa mitad
es la que evita que el 90 % de los duplicados nazca.

**Lo decidido:** `src/lib/taxonomia.ts`, puro y sin Firestore, con
`sugerenciasPara`, `resolverEtiqueta`, `etiquetaPresentable`, `pistaDeOpcion` y
`etiquetaConEstado`, más los tres predicados que ya existían (`ordenarValores`,
`estaAprobada`, `opcionesVisibles`) mudados desde `opciones.ts` — que los
re-exporta, así ningún consumidor cambia de import y sigue siendo la única
puerta a `/opciones/*`.

**Los componentes NO se unifican.** Un `<select>` con "Otro" y un input de chips
son widgets distintos: unificarlos sería un componente con dos modos y ningún
uso claro. Lo que se comparte es lo que no puede divergir.

Las dos diferencias que quedan son ahora **parámetros con motivo escrito**, no
accidentes:

| | Desplegable | Chips de tags |
|---|---|---|
| tope de sugerencias | 8 | 8 (antes 6, sin razón) |
| con el input vacío | muestra las primeras 8 | no muestra nada |

Lo segundo no es un descuido: el modo "Otro" del desplegable se abre a propósito
y ver la lista orienta; el input de tags está siempre visible y una lista
desplegada sin que nadie escriba taparía el formulario.

**Por qué un módulo puro y no un hook:** se testea sin emulador y sin
testing-library, que no está instalada (B-08). `tests/taxonomia.test.ts` cubre
las cuatro variantes de "a la gorra" del §4.2, el autocompletado sin acentos, el
tope, la exclusión de lo ya elegido, y lleva una guardia de que la copia no
vuelva a nacer (D-98: la guardia más barata que alcance).

---

## D-101 · La etiqueta se guarda presentable; el slug es la identidad

**Problema:** un tag tipeado "narrativa" se guardaba así y se publicaba así —en
el calendario y en los chips de filtro del sitio (§4.4)— al lado de "Poesía" que
alguien escribió con mayúscula. La taxonomía se veía descuidada sin estar
duplicada (B-05). Ya había pasado: `/opciones/tags` tiene `narrativa="narrativa"`.

**Lo decidido:** `etiquetaPresentable` —trim, colapsar espacios internos y
**primera letra en mayúscula, nada más**— aplicada en `upsertOpcion`, que es el
punto de paso obligado de toda creación. No en cada componente: es la lección de
B-81, el saneador va en la salida y no campo por campo.

**Solo la primera letra**, y es la parte que importa:

- bajar el resto rompería "Villa Crespo", "Google Meet" o unas siglas;
- subir cada palabra rompería "Club de lectura" → "Club De Lectura".

`slugify` normaliza la **identidad**; esto normaliza lo que se **ve**. Son dos
funciones distintas sobre el mismo texto y por eso no se combinan.

**Lo que ya está cargado mal no se toca por migración**: se corrige renombrando
desde la pantalla de taxonomías (D-102), que es de una vez y a la vista. Una
migración que capitalice labels ajenos es más riesgo que valor para cuatro
etiquetas.

---

## D-102 · La pantalla de taxonomías renombra sin tocar el slug, y borra sin tocar las actividades

**Problema:** el §4.3 dice que las opciones creadas con "Otro" son editables y
borrables y que `usos` sirve para detectar basura, y nada de eso tenía dónde
pasar: había que abrir la consola de Firestore (B-06). Aprobar, además, pedía una
máquina con Node y `gcloud`, o sea que desde el teléfono no se podía (B-25).

**Lo decidido:** `src/components/admin/taxonomias/TaxonomiasPanel.tsx`, una
pantalla con las cinco taxonomías y tres acciones por fila —renombrar, borrar,
aprobar— sobre `renombrarOpcion` / `borrarOpcion` / `aprobarOpcion` de
`opciones.ts`. Las tres pasan por un solo `editarValor` transaccional, donde vive
la guarda de `fijo` del §4.3: una guarda copiada tres veces se olvida en la
cuarta.

Tres reglas, y las tres son decisiones:

1. **Renombrar no recalcula el slug.** Es exactamente el punto del §4.1 ("la
   actividad guarda solo el slug, así renombrar el label no obliga a tocar ningún
   documento"): arreglar "narrativa" → "Narrativa" no puede desconectar las
   actividades que ya la usan. Consecuencia aceptada: el slug puede quedar viejo
   respecto del label. Es lo mismo que ya pasa con cualquier renombre y no se ve
   en ninguna salida.
2. **Borrar no busca las actividades que la usan.** Serían cientos de documentos
   y esto corre en el navegador. La actividad que la tenga guardada sigue
   mostrando su etiqueta des-slugueada (D-11), que es el respaldo para el que se
   escribió. Por eso borrar algo con `usos > 0` se confirma aparte, y el aviso
   muestra el des-slug real importado de `@calendario` (D-20) en vez de una copia
   que podría mentir.
3. **Las opciones base no ofrecen ninguna acción.** No es solo esconder botones:
   `editarValor` las rechaza. Son las que pueden estar cableadas en la lógica (el
   badge verde de "Gratis").

**La señal de basura del §4.3 se muestra, no se calcula aparte:** una opción no
fija con `usos <= 1` se marca "casi sin usar, puede ser un typo". Es la lectura
literal del §4.3, y no borra nada sola.

La pantalla es **autocontenida** (no recibe nada del router) porque montarla es
editar `AdminApp.tsx`, que en el plan de saneamiento es de otro frente: queda
como **B-170**.

---

## D-103 · `usos` se cuenta al elegir, no solo al crear, y en una transacción por campo

**Problema:** el §4.3 le da dos trabajos a `usos` —ordenar el desplegable por
frecuencia real y delatar basura— y ninguno funcionaba: solo se contaba la
creación, así que todas las creadas quedaban clavadas en 1 y las base en 0
(B-86). `ordenarValores` terminaba ordenando por etiqueta y la señal de basura no
distinguía el typo del barrio que se usa todas las semanas.

**Lo decidido:** `registrarUsos(campo, slugs)` en `opciones.ts`, una transacción
por campo (no una por slug: en `tags` una actividad puede traer cinco).

Dos reglas que la hacen difícil de usar mal:

- **los slugs que no existen se ignoran.** Sin label no hay opción que crear, y
  crear una des-slugueada acá metería vocabulario que nadie tipeó;
- **un slug repetido en la misma llamada cuenta una vez.** Una actividad usa una
  etiqueta, no la usa N veces.

**Lo que queda pendiente y es de otro frente:** llamarla desde `guardar()`. El
orden correcto es actividad primero, después `upsertOpcion` de las etiquetas
nuevas, después `registrarUsos` con los slugs elegidos **menos** los que se
acaban de crear (nacen con `usos: 1`; sumarlos otra vez los deja en 2). Engancha
con la inversión de orden de B-71, así que sale en el frente del formulario
(**B-168**).

---

## D-104 · Las opciones nuevas nacen aprobadas, y la maquinaria queda dormida

**Decisión del dueño (2026-08-24), ejecutada acá.** Una etiqueta nueva cargada
con "Otro" queda disponible para las dos cuentas enseguida: `aprobada: true` en
`upsertOpcion` (B-131).

**El argumento:** el problema que el §4.3 quería evitar era que el desplegable se
llene de variantes de lo mismo, y eso lo resuelve el §4.2 —slugify más
autocompletado—, que ataja los duplicados **antes** de que nazcan. La aprobación
agregaba control de vocabulario, no corrección; con dos personas de confianza la
fricción no se paga.

**Lo que NO se hizo, y es la mitad de la decisión:** desarmar la maquinaria.
`estaAprobada`, `opcionesVisibles`, `huellaCreador`, `aprobarOpcion`, el
indicador "(sin aprobar)", el contador de pendientes y
`scripts/aprobar-opciones.mjs` quedan **enteros**. El §4.3 anticipa el escenario
("si en el futuro carga gente además del dueño") y volver a prenderla es poner
`false` en un lugar.

Para que el código dormido no se lea como código muerto:

- el default lleva **el motivo escrito al lado**, con el número de ítem;
- `tests/opciones-aprobacion.test.ts` **fija el default** leyendo el fuente —el
  camino real necesita el emulador y sus tests se saltean cuando no está
  corriendo, que es justo cuando un cambio de default pasaría inadvertido;
- los tests de la aprobación **se conservan**. Ya no pueden fabricar una
  pendiente llamando a `upsertOpcion`, así que la ponen pendiente a mano
  (`volverPendiente`) y siguen ejercitando la maquinaria de punta a punta con el
  script real. Es lo que garantiza que funcione el día que se prenda, y además
  cubre las opciones que quedaron pendientes en producción **antes** de esta
  decisión.

**Consecuencia sobre otros ítems:** B-25 (aprobar desde el panel) y B-26 (avisar
que hay pendientes) se construyeron igual —son la maquinaria— pero hoy operan
sobre un conjunto que solo tiene lo viejo. B-28 (¿claim `curador`?) y B-29
(¿auto-aprobar una etiqueta reusada?) quedan sin efecto práctico mientras esto
esté vigente; siguen siendo decisiones del dueño y no se tocaron.

---

## D-105 · Los tags se miden con los mismos eventos, menos el que no existe

**Problema:** `CAMPOS_TAXONOMIA_MEDIBLES` declaraba `'tags'` como valor válido de
`detalle` para los cuatro eventos de taxonomía, y `TagsInput` no llamaba a
`medirFuncion` en ningún lado (B-73): el campo con más volumen esperado era el
único invisible en GA4, y el vocabulario declaraba algo que el código no podía
producir.

**Lo decidido:** `TagsInput` emite `taxonomia-nueva`, `taxonomia-reusada` y
`taxonomia-sugerencia` con `detalle: 'tags'`, en los mismos puntos donde el
desplegable ya los tenía.

**`taxonomia-otro` no se emite para tags, a propósito.** No hay modo "Otro" que
abrir: el input de chips es siempre el de tipear. Emitirlo en cada tag tipeado
inflaría el evento que mide "cuánta gente sale del desplegable enumerado", que es
otra pregunta. Queda documentado en [`09-analitica.md`](09-analitica.md) para que
su ausencia no se lea como un bug.

Un tag que ya estaba puesto no se mide: no es una interacción con la taxonomía.

## Decidido, sin trabajo pendiente

| Tema | Resolución |
|---|---|
| Home indexable con el placeholder | se deja así (usuario, 2026-08-21) |
| Eventos de prueba en el calendario | los borra el usuario (2026-08-21) |
| Si las opciones nuevas deberían nacer aprobadas | sí, nacen aprobadas (dueño, 2026-08-24 — D-104) |

## Pendiente de decidir

| Tema | Quién decide |
|---|---|
| `libro presentado`: campo propio o dentro de la descripción | usuario |
| Si `arancel` debe seguir preseleccionando "Gratis" | usuario |
| Si hace falta un claim `curador` aparte del `admin` para aprobar taxonomías (D-28) | dueño |
| Si una etiqueta que una segunda cuenta reusa debería aprobarse sola | dueño |
