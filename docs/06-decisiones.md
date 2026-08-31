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

## D-13 · `dispararRebuild` escrita pero sin desplegar — desplegada desde el 2026-08-25

**Motivo:** es un `onSchedule` cada 5 minutos y todavía no existen el sitio
público ni el workflow de Actions que tendría que disparar. Desplegarla sería
pagar por un schedule que no hace nada.

El flag `sistema/rebuild` **sí** se escribe, así que cuando exista el paso 5 ya
hay de dónde leer.

**Actualización (B-02):** el workflow ya existe y la Function está completa.
Sigue sin desplegarse, pero por otro motivo: le faltan credenciales que solo
puede crear el dueño (el PAT y la key de CI, §5.4). Los pasos están en
[`08-operacion.md`](08-operacion.md).

**Cierre (B-20, 2026-08-25).** Está desplegada, y el lazo se verificó **de punta a
punta** ese mismo día: un `repository_dispatch` a mano hizo correr «Build y deploy
del sitio» y publicó. Las seis Functions están `ACTIVE` — relevado con `gcloud`,
ver [`02-infraestructura.md`](02-infraestructura.md) — y
[`08-operacion.md`](08-operacion.md) pasó de ser la lista de lo que faltaba a ser
el runbook para rearmarlo en un proyecto nuevo o rotar el PAT.

El motivo original de esta decisión sigue siendo válido como razonamiento: no se
paga un schedule antes de que exista quien lo consuma. Lo que cambió es que ya
existe.

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
(`libro`, DEC-1) entra al historial solo, sin que nadie se acuerde de
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

## D-29 · La aprobación se hace por script, no por UI — superada por B-06/B-25

> **Superada el 2026-08-24.** La pantalla de administración de taxonomías se
> construyó (B-06 y B-25): `TaxonomiasPanel.tsx` tiene un botón **Aprobar** por
> fila pendiente —transaccional, y rechaza las `fijo`— y uno de **Borrar**. Ver
> [`04-funcionalidades.md`](04-funcionalidades.md). El script sigue sirviendo
> desde la terminal, pero ya no es el único camino, y el «costo aceptado» de más
> abajo dejó de aplicar: se puede aprobar desde el teléfono.
>
> Con D-104 (mismo día) las opciones nuevas además nacen aprobadas, así que la
> pantalla hoy importa sobre todo para lo que quedó pendiente de antes de esa
> decisión. El resto de la entrada queda como estaba: el razonamiento de por qué
> el desplegable de un formulario de carga era el lugar equivocado sigue siendo el
> motivo por el que la pantalla es una pantalla aparte.

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
  > **Esa última mitad caducó el 2026-08-28 (D-132).** La cuenta propia sigue
  > siendo lo correcto, pero ya no tiene dos roles de lectura: hoy puede desplegar
  > reglas y Functions. El radio real está en
  > [`07-seguridad.md`](07-seguridad.md) § "La key".

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

## D-111 · La actividad se escribe antes que las etiquetas nuevas

**Decisión:** en el guardado del formulario, primero se escribe la actividad y
recién después se registran en `/opciones/*` las etiquetas creadas con "Otro".
Era al revés (B-71).

**Motivo:** las dos escrituras pueden fallar por separado, y una de las dos no
se puede deshacer desde el panel: no hay UI para limpiar taxonomías (B-06). Con
el orden viejo, un guardado que fallaba —red, permisos, un slug que se tomó en
el medio— dejaba opciones colgadas en el desplegable de todo el mundo, que es
justo lo que D-02 quiso evitar. Invertido, el peor caso es que el slug quede
guardado sin estar registrado: el evento público lo resuelve con el des-slug de
D-11 ("Con Beca Parcial" en lugar de "Con beca parcial") y volver a tipear la
etiqueta la registra. **El modo de falla pasa de basura permanente en la
taxonomía a una capitalización distinta.**

**Y un fallo al registrar la etiqueta no vuelve fallido el guardado.** La
actividad ya está escrita; devolver error haría que el segundo intento choque
contra su propio slug (`slugDisponible` ya lo ve tomado) sobre algo que en
realidad se guardó bien. El caso de uso lo informa en su resultado
(`etiquetasSinRegistrar`) y hoy nadie lo muestra en pantalla — queda anotado
como **B-177** (decía «B-167» hasta el 2026-08-27; ese número se reasignó a la
galería de imágenes).

**Alternativa descartada:** las dos escrituras en una sola transacción. Son
documentos de colecciones distintas y `upsertOpcion` ya corre su propia
transacción por etiqueta (§4.2); envolver todo pedía rehacer esa función para un
caso cuyo daño ya quedó acotado.

**La guarda es de clase, no de instancia:** el chequeo de
`tests/clases-de-bug.test.ts` busca las dos escrituras por nombre en todo `src/`
y falla si la irreversible queda primero, así que cubre también el próximo flujo
que escriba en dos lugares. Por eso `guardar.ts` llama a sus puertos por nombre
desestructurado y no como `puertos.x(...)`: escondidos, la guarda pasaría sin
mirar nada.

---

## D-112 · La preselección del desplegable va en el estado inicial, no en un efecto

**Decisión:** el `tipo` de una actividad nueva viene ya preseleccionado desde
`formVacio()` (D-12 sigue valiendo: el desplegable muestra la primera opción).
El efecto `autoSeleccionarPrimera` del hijo se sigue usando en `plataforma`,
pero **no** en un campo que exista desde el montaje.

**Motivo:** el efecto de un hijo corre antes que los del padre, así que escribía
el estado del formulario después del primer render y los dos consumidores de
"¿cambió algo?" veían un cambio que nadie hizo (B-87): el aviso de versión nueva
no se auto-recargaba nunca —mostraba "Guardá lo que estás cargando" sobre un
formulario vacío— y el parámetro `sucio` de `formulario_abandonado` era siempre
1, o sea que dejaba de responder la única pregunta que justifica ese evento.

**Se puede resolver sin leer Firestore** porque `ordenarValores` pone las
opciones fijas antes que las creadas con "Otro" (§4.3): la primera elegible es
siempre la primera opción base, y eso se sabe desde `OPCIONES_BASE`. Un test ata
las dos derivaciones, para que reordenar el JSON no separe la preselección de lo
que muestra el desplegable.

`plataforma` se queda con el efecto a propósito: su bloque lo crea un cambio de
modalidad, o sea una acción de quien carga, y para entonces el formulario ya
está sucio de verdad.

---

## D-113 · Las escrituras del caso de uso de guardado entran como puertos

**Decisión:** `src/lib/formulario/guardar.ts` recibe sus cinco escrituras
(`slugDisponible`, `upsertOpcion`, `upsertOpciones`, `crearActividad`,
`actualizarActividad`) como un objeto de puertos, con `puertosFirestore` como
default.

**Motivo:** el bug que se estaba arreglando (B-71) **es un orden de
escrituras**, y un orden no se afirma mirando el resultado: hay que ver la
secuencia de llamadas. Con puertos falsos que anotan su nombre, el test afirma
"slug → actividad → etiquetas" y, sobre todo, "si la actividad no se pudo
escribir, no se creó ninguna opción" — sin emuladores, en milisegundos y sin
poder tocar datos de verdad.

**Alternativa descartada:** testearlo contra el emulador, como
`tests/actividades.integracion.test.ts`. Ese archivo verifica el ida y vuelta
del documento, que es su valor; para el orden habría que provocar un fallo de
permisos a mitad de camino, y además los tests de integración se saltean solos
cuando el emulador no está, así que la guarda desaparecería justo en la corrida
de CI.

Es el mismo criterio que `functions/rebuild.js` con el reloj
([`05-patrones.md`](05-patrones.md) → "El reloj también es infraestructura"): lo
que hace falta controlar para testear entra como parámetro con default.

---

## D-114 · Regenerar los encuentros conserva la identidad de la fila

**Decisión:** `generarSesiones` recibe la lista que reemplaza (`previas`) y la
fila que queda en cada posición hereda su `id` y su `calendarEventId`. Solo las
posiciones que no existían estrenan un id.

**Motivo (B-90):** el generador daba ocho ids nuevos, así que sobre un ciclo ya
publicado el diff del §7.2 no reconocía ningún encuentro y hacía ocho `borrar` y
ocho `crear`. Eso es exactamente lo que ese diff existe para evitar: "perdería
los recordatorios y las suscripciones de la gente". El caso real es banal —el
ciclo se corre una semana y se regeneran las fechas— y el cartel decía
"Reemplaza la lista actual", que nadie lee como "reemplaza el calendario".

Con el id heredado, correr el ciclo una semana son ocho `actualizar`: al
suscripto se le mueve la fecha del evento, que es lo que pasó de verdad.

**Se reusa por posición, no solo cuando la cantidad no cambia** (que era la
salida mínima que proponía el backlog): generar diez sobre ocho son ocho
actualizaciones y dos altas, y generar seis sobre ocho, seis actualizaciones y
dos bajas. Cuesta lo mismo y cubre los dos casos que más se usan.

**Esto no contradice la trampa 2** ("ids de sesión por índice, nunca"). El id no
se *deriva* del índice: se **hereda** de la fila que ocupaba esa posición, y las
filas nuevas siguen estrenando un uuid de cliente. La trampa habla de ids
calculados como `ses_${i}`, que cambian de dueño cuando se borra una fila del
medio; acá el generador reemplaza la lista entera de una, así que la posición es
la única correspondencia que existe entre lo viejo y lo nuevo.

**Lo que sigue borrando:** el tema y la lectura de cada fila. No es lo que B-90
pedía y en un club de lectura es trabajo tipeado a mano, así que quedó anotado
como **B-169**, ahora que conservar la fila lo vuelve barato.

**La guarda:** los tests de B-90 en `tests/costuras.test.ts` corren el generador
de verdad contra el `planificar` de verdad. Es el par lo que estaba roto —cada
pieza por separado hacía lo suyo bien—, así que la afirmación tiene que cruzar
las dos.

---

## D-115 · El formulario se parte por sección, y las secciones son presentación

**Decisión:** las nueve secciones del §11 y la barra de acciones viven en
`src/components/admin/formulario/`, una por archivo.
`ActividadFormulario.tsx` se queda con el estado, las cascadas, el guardado y
el orden de las secciones: pasó de 858 a ~230 líneas.

**Motivo (B-79):** era el segundo archivo más tocado del repo (9 de 41 commits)
y en este proyecto ya se commitearon marcadores de conflicto que sobrevivieron
dos commits (`tests/sin-marcadores-de-conflicto.test.ts`). Nueve `<Seccion>` en
un solo `return` significa que dos cambios cualesquiera del panel chocan en el
mismo archivo.

**Las secciones no deciden nada.** Reciben `form`, `set`, `errorDe` y `uid`, y
los condicionales del §11 ya resueltos. Por eso el cuerpo del JSX se movió
**verbatim**: las props se llaman igual que las variables que tenía adentro, así
que el diff del refactor no esconde ningún cambio de comportamiento.

**Y los condicionales del §11 se fueron a un módulo puro**
(`lib/formulario/condicionales.ts`), no a cada sección: `necesitaSede` decide a
la vez qué se muestra y qué exige el schema en su `superRefine`. Si esas dos
derivaciones se separan, el formulario esconde un campo que el guardado pide y
el error aparece sobre un campo que no está en pantalla. Un test las ata.

**El vocabulario de la UI** (`ETIQUETA_MODALIDAD`, `ETIQUETA_VIA`,
`ETIQUETA_ESTADO`) quedó en `formulario/etiquetasUI.ts` porque ahora lo comparten
varias secciones. **No se unificó con los `ETIQUETA_*` de
`functions/calendario.js`**: esos son prosa del evento público y unificarlos
haría que un cambio de copy del panel cambie lo que se publica. B-76 quiere
llevarlos a un `src/lib/etiquetas.ts` compartido con el listado; cuando salga,
son estos tres mapas los que se mudan.

**Costo medido:** la carga inicial de `/admin` pasó de **387.797 a 388.380
bytes** (+583 B, +0,15 %; gzip 106.934 → 107.127, +193 B), con los mismos 4
chunks. La suma de todos los chunks subió 3.418 B: es el envoltorio de diez
componentes nuevos. Se paga en superficie de conflicto y en poder tocar una
sección sin abrir las otras ocho (B-62 pedía exactamente eso).

**Dos tests leían `ActividadFormulario.tsx` como texto** y había que arreglarlos
en el mismo cambio, no después: `tests/ayuda.test.ts` (cada sección tiene su
capítulo) y `tests/opciones-orden.test.ts` (el arancel no se preselecciona).
Los dos leen ahora el directorio, y el segundo afirma primero que **encontró**
el campo: si no, un `not.toContain` sobre un string vacío pasa sin haber mirado
nada.

---

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

---

## D-109 · Toda salida del formulario pasa por una sola puerta

**Contexto (B-35):** el store de `formulario-sucio.ts` ya sabía que había cambios
pendientes —lo usaba el aviso de versión nueva para no recargar la pestaña por
atrás—, pero las salidas que dispara la propia persona no lo miraban. "Volver",
"Reportar algo", "Salir" y "Cancelar" descartaban los 30+ campos del §11 sin
preguntar, y cerrar la pestaña también.

**Decisión:** un único `salirDe(accion)` en `AdminApp` envuelve a las cuatro
salidas, y la regla de cuándo preguntar es una función pura
(`src/lib/salida-del-panel.ts`).

**Por qué envolver la acción y no chequear en cada `onClick`.** El chequeo
repetido cuatro veces es la misma lista duplicada que D-98 combate: el día que se
agregue una salida nueva —y este encabezado ya sumó tres botones en un mes— nadie
se acuerda del quinto chequeo, y el olvido no falla en ninguna parte. Con el
envoltorio, la forma de escribir un botón de salida **es** la que lleva el aviso.

**Por qué la vista entra en la decisión y no solo el store.** El store se apaga
en el cleanup del formulario, así que en régimen alcanzaría con él. Pero si
alguna vez queda encendido por un camino no previsto, la consecuencia sin el
chequeo de vista es que todos los botones del panel piden confirmación, incluso
en el listado, donde no hay nada que perder — y un aviso que aparece cuando no
hay nada en juego se aprende a ignorar, con lo cual también se ignora el que sí
importa.

**Lo que el `beforeunload` no puede hacer:** el navegador muestra su propio
cartel y no acepta texto. Por eso el `confirm()` de las cuatro salidas
controladas vale la pena aparte: es el único lugar donde se puede decir *qué* se
pierde.

**De paso**, "← Volver" pasó a respetar `volverA` igual que "Cancelar": eran dos
salidas del mismo formulario con dos criterios, y volver por el encabezado desde
el calendario perdía el mes que se estaba mirando.

---

## D-110 · El reintento de un reporte es una escritura acotada, no un `onCall`

**Contexto (B-31):** un reporte que la Function no pudo publicar queda en `error`,
visible en el panel y sin nada que hacerle. Reintentar era abrir una terminal con
el Admin SDK, o sea una máquina con Node y credenciales — desde el teléfono,
imposible.

**Decisión:** un botón "Reintentar" en la pantalla de reportes que escribe
`estado: 'pendiente'`, `intentos: 0` y `error: null`, habilitado por una regla
(`reintentoValido`) que permite exactamente esa transición y ninguna otra.

**Por qué no una función `onCall`.** El disparador de la publicación **ya** es una
escritura en el documento: `estadoTrasFallo` reintenta poniendo el estado en
`pendiente`, y esa misma escritura vuelve a disparar el trigger. El botón hace lo
que el sistema ya hace solo. Un `onCall` habría sido un segundo camino al mismo
efecto, con su endpoint, su chequeo del claim reimplementado a mano —que las
reglas ya hacen (§5.3)— y su propia forma de fallar. Es la duplicación de
`docs/05-patrones.md`: dos derivaciones de la misma idea que se separan sin que
nada falle.

**`intentos: 0` no es un detalle de implementación.** `decidirAccion` ignora un
reporte con los `MAX_INTENTOS` gastados, que es el caso más común de un `error`
(falló tres veces por un token vencido). Mover solo el estado habría dado un botón
que escribe el documento y no produce nada — el peor resultado posible, porque se
ve como si hubiera funcionado.

**Qué NO habilita la regla, y por qué cada una importa:**

| Prohibido | Si se permitiera |
|---|---|
| cambiar el texto del reporte | el documento que se revisó al crearlo deja de ser el que se publica en un repo **público** |
| reintentar en `enviando` | la Function lo tomó hace un segundo: es la carrera que crea el issue duplicado |
| reintentar con `github` puesto | dos issues para el mismo reporte |
| borrar | un reporte es el pedido de una persona; el panel no tiene por qué poder hacerlo desaparecer |

El estado `enviando` queda deliberadamente afuera del panel aunque también se
destrabe poniéndolo en `pendiente`: ahí sí puede haber una invocación en vuelo, y
esa operación se queda en el runbook con el Admin SDK
([`08-operacion.md`](08-operacion.md)).

## D-116 · Una lista de texto libre no se edita con el widget de una taxonomía

**Contexto.** B-133: el campo «arrobar al publicar» era un `<input>` de una línea
que hacía `join(', ')` para mostrar y `split(',')` en cada tecla para guardar. Al
tipear la coma, el `split` producía un elemento vacío, el `filter(Boolean)` lo
descartaba y el `join` volvía a pintar el valor sin la coma: **la coma se borraba
sola en el momento de escribirla**, así que no había forma de cargar un segundo
handle. Enter tampoco servía — es un input dentro del `<form>`, así que intentaba
guardar la actividad.

El backlog proponía reusar `TagsInput`, que ya resuelve exactamente esa
interacción: chips, Enter para confirmar, Backspace para borrar el último.

**Decisión.** Se reusa el **patrón**, no el componente. `TagsInput` está atado a
la taxonomía `tags`: slugifica lo que se escribe y lo persiste en
`/opciones/tags` (§4.2). Los handles de arrobar no son una taxonomía —son trabajo
interno del §3.2, no salen nunca al público (§5.1) y nadie va a filtrar por
ellos—, así que reusarlo habría metido `@casabrandon` en el desplegable de
etiquetas de todas las actividades, y con `usos` contándolo. Queda `ChipsInput`
sobre un módulo puro (`src/lib/formulario/chips.ts`).

**Por qué importa más de lo que parece.** "Ya existe un componente que se ve
así" es la forma más fácil de acoplar dos cosas que no tienen nada que ver, y el
acoplamiento no se nota hasta que el desplegable de etiquetas está lleno de
handles de Instagram y hay que limpiarlo a mano actividad por actividad. El bug
de fondo de B-133 era **modelar una lista como string**; cambiarla por la lista
equivocada lo hubiera reemplazado por uno más caro de deshacer.

**Consecuencia.** Hay dos widgets de chips. Comparten el patrón y no el código, y
eso está bien: si mañana la taxonomía cambia cómo persiste, «arrobar» no tiene
por qué enterarse. Lo que **sí** se comparte es la lógica pura de separar,
deduplicar y quitar, que es donde estaba el bug.

## D-117 · Un número de versión que ya salió no se reusa para lo que no salió

**Contexto.** Desde B-64 cada novedad del panel se ancla a la versión en la que
sale, para que un reporte pueda decir "esto empezó a pasar con la versión en la
que salió tal cosa". El problema apareció al ir a publicar: `package.json` decía
`1.0.1`, y **`1.0.1` ya estaba en producción** —el panel servía
`1.0.1+538bef7`, desplegado el 2026-08-21— mientras siete novedades escritas
después decían `version: '1.0.1'` porque en el momento de escribirlas era el
número vigente. Otras seis, de las mismas semanas, no decían nada.

Trece entradas, entonces, apuntaban a una versión que no las contenía o a
ninguna.

**Decisión.** Se sube a `1.1.0` y se re-sellan las trece: las siete que decían
`1.0.1` sin haber salido, y las seis que no tenían número. Se deja intacta la
única que sí salió en `1.0.1` (`version-en-el-pie`, que es justamente el commit
que la estampó) y las cuatro de `1.0.0`.

`1.1.0` y no `1.0.2` porque entre el commit desplegado y este hay dos pantallas
nuevas —la vista calendario y la de taxonomías—, filtros y orden en el listado, y
un tipo de actividad más. Un parche no describe eso.

**Por qué no se dejó como estaba.** El campo `version` existe para una sola cosa:
correlacionar un síntoma con una release. Un valor equivocado ahí es peor que un
valor ausente — ausente hace que quien diagnostica busque en otro lado, y
equivocado lo manda a leer el diff de una versión que no tocó ese código. Y el
error no se detecta después: nada puede verificar que `1.0.1` era mentira una vez
que 1.0.1 quedó atrás.

**Consecuencia, y la regla que queda.** El número se escribe cuando se escribe la
novedad, así que el desfasaje puede volver a pasar: la regla es que **publicar una
versión incluye revisar que las novedades sin publicar apunten a la que se está
publicando**, y no al número que había cuando se escribieron. `id` y `fecha` no se
tocan nunca —el `id` es la marca de "hasta acá leí" en el navegador de cada
persona—; `version` sí, mientras la entrada no haya salido.

## D-118 · La trampa 11 entra al §13, aunque no sea de dominio

**Contexto.** B-188: `deploy.yml` estuvo desde el primer día registrado en GitHub
**sin ningún trigger**, porque un `: ` dentro de un escalar sin comillas invalidaba
el YAML entero. El lazo del §8 quedaba cortado en el último eslabón y **nada de
este lado lo decía**: la Function veía su `repository_dispatch` devolver 204, la
suite pasaba, el typecheck pasaba, y lo único visible era una corrida sin jobs en
la pestaña Actions.

**Decisión.** Se agrega como **trampa 11** al §13 del `CLAUDE.md`, con su fila en
[`15-mapa-de-trampas.md`](15-mapa-de-trampas.md) y su test.

**Por qué, si las otras diez son de dominio.** Las diez trampas del §13 son errores
de modelo o de datos —timestamps, ids, loops, slugs—; ésta es de un archivo de
configuración. Lo que las hace la misma cosa no es el tema sino **la forma de
fallar**: un error que deja todo en verde y solo se nota del otro lado. Ese es el
criterio con el que el §13 se escribió ("verificar cada uno antes de dar por cerrada
una feature"), y el que hace que valga la pena una lista en lugar de confiar en la
memoria.

Y hay una razón mecánica: `tests/mapa-de-trampas.test.ts` **lee la lista del §13** y
exige que cada trampa tenga fila y que cada test nombre la suya. Dejarla afuera del
§13 la habría dejado también afuera de esa maquinaria — con lo que el chequeo nuevo
podría desaparecer en un refactor sin que nada se ponga rojo, que es el problema que
B-119 vino a resolver.

**Consecuencia.** El §13 pasa a ser "errores que fallan en silencio", no "errores
del modelo de datos". Si más adelante aparece un tercer grupo, conviene subtitular
la sección antes de que la lista mezcle cosas que no se revisan en el mismo momento.

## D-119 · La única key del proyecto no puede cambiar qué es legible

> **Revertida el 2026-08-28 — ver D-132.** La cuenta volvió a tener los roles que
> esta decisión quita: `firebaserules.admin`, `datastore.indexAdmin` y los de
> Functions. **El razonamiento de abajo no se refutó** —se decidió pagarlo, porque
> el rojo permanente que esta decisión dejaba había hecho que una publicación
> fallara en silencio—, así que se lee contra su original.

**Contexto.** El 2026-08-25, para que el job de reglas de `push-main.yml` dejara de
fallar, se le agregaron a `deploy-ci@` los roles `firebaserules.admin` y
`datastore.indexAdmin`. Un rato después el auditor de privacidad encontró que
`07-seguridad.md` seguía afirmando lo de siempre —*"si se filtrara, el daño se limita
a leer datos que ya son públicos y a desplegar el sitio — no a modificar la base"*—
y que eso **había dejado de ser cierto**.

**Decisión.** Se revierten los dos roles. Las reglas y los índices se despliegan a
mano, igual que las Functions y por el mismo argumento.

**El razonamiento, que es el que hay que volver a hacer si alguien propone
agregarlos de nuevo.** Las reglas del §5.3 son lo **único** que mantiene fuera de
una lectura anónima los borradores, `difusion`, `online.url` y los uids. Con
`firebaserules.admin`, una key filtrada dejaba de poder "leer lo que ya es público"
y pasaba a poder **hacer legible todo Firestore**. Y es peor que el caso de las
Functions con el que se comparó: los roles de Functions habilitan un deploy, éste
cambia la visibilidad de datos que **ya están guardados**.

`serviceusage.serviceUsageConsumer` se queda. Lo único que habilita es preguntar si
una API está habilitada, que es lo que cualquier comando de `firebase` hace antes de
empezar; sin él el job cortaba con un 403 que no tenía nada que ver con el deploy.

**La contra, asumida y anotada.** Un push que toque `firestore.rules` deja la
corrida roja, y si toca las reglas **y** `src/` en el mismo push, el panel tampoco se
publica: el `if` del job de Hosting pide `needs.firestore.result != 'failure'`. Ese
`if` existe para que el panel nuevo no salga antes que las reglas que necesita — y
con las reglas a mano, ese orden pasó a ser responsabilidad de quien deploya en lugar
del workflow. Es **B-194**, con las salidas escritas.

**Y una consecuencia de proceso.** El drift entre `02-infraestructura.md` (que se
actualizó) y `07-seguridad.md` (que no) es cómo una afirmación de seguridad estuvo
mintiendo una hora. Las dos listas quedaron atadas por
`tests/roles-deploy-ci.test.ts`, que además falla si aparece cualquier rol de
escritura que no sea el de Hosting: la próxima vez que el radio de la key cambie, el
test obliga a reescribir la afirmación en el mismo commit.

## D-120 · Dos niveles de validación sobre un solo schema, y la línea es «publicado»

**Contexto.** Reporte del dueño usando el panel (2026-08-25): *"No me deja GUARDAR
BORRADOR si no completo todo. Tiene que ser más flexible el guardar borrador"*.
`actividadFormSchema` validaba lo mismo para un borrador que para algo publicado, así
que un borrador —que por definición es lo que **todavía no** está completo— exigía
título, descripción, un encuentro, arancel, sede y dirección. Con B-35 avisando al
salir con cambios sin guardar, quien cargaba quedaba encerrado entre un aviso que
decía "vas a perder el trabajo" y un guardado que no lo aceptaba.

**Decisión.** Dos niveles **sobre el mismo schema**, no dos schemas: las reglas de
completitud pasan a correr dentro de un `superRefine` condicionado a
`estado === 'publicado'`.

**Por qué un schema y no dos.** El patrón ya estaba en el archivo aplicado a una
regla sola —el slug `…-copia`, que solo se bloquea al publicar (trampa 10)—, así que
los `superRefine` no cambiaron de contenido: cambiaron de condición. Dos schemas
paralelos se desincronizan en el primer campo nuevo, y el que se olvida de actualizar
es siempre el de publicar, que es el que importa.

**Por qué la línea es `publicado` y no «borrador vs. el resto».** Publicado es
exactamente lo que sale: el sitio filtra por ese estado y el §7.3 borra de Calendar
los eventos de todo lo que no lo tiene. `pendiente` y `cancelado` se guardan con el
nivel corto a propósito — el bloqueo llega al intentar publicar, que es cuando puede
salir algo a medias.

**Lo que sigue bloqueando en los dos niveles**, y no es completitud: el `id` de cada
sesión (trampa 2), que sus fechas se puedan convertir a `Timestamp` (trampa 1), el
formato del slug y el rango de las coordenadas. Un borrador con eso roto no es un
borrador incompleto, es un documento ilegible: `formADocumento` tira
`Fecha inválida` antes de escribir.

**La contra, cubierta por D-121.** Si el borrador valida con menos, el bloqueo
aparecería recién al final. Por eso la barra muestra siempre lo que va a faltar para
publicar, en gris: aviso, no bloqueo.

## D-121 · El mensaje de la barra nombra campos o secciones, y lleva hasta ahí

**Contexto.** Reporte del dueño (2026-08-25): *"cuando no se pueda guardar y diga que
faltan campos, siempre especificarlos"*. La barra decía «3 campos para revisar». Era
una decisión escrita —listar rutas de campo tapaba media pantalla en mobile y el
detalle está en rojo al lado de cada campo— y el reporte la dio por equivocada.

**Decisión.** El mensaje nombra los campos cuando son pocos (hasta tres) y las
secciones con su cuenta cuando son muchos, y cada nombre es un botón que abre la
sección y scrollea hasta el primer campo rechazado.

**El dato que la decisión original no tuvo en cuenta**, y que es el que la vuelve
equivocada: **cuatro de las nueve secciones arrancan colapsadas**. Un campo rechazado
adentro de un acordeón cerrado no está en ninguna parte de la pantalla —el contador
decía tres y se veían cero—, así que no era un resumen apretado: era un mensaje que
no se podía accionar. Nombrar secciones con su cuenta resuelve además lo que motivó
la decisión original: es más corto que tres rutas de campo.

**Dónde vive.** El diccionario de nombres y secciones es data
(`lib/formulario/camposFaltantes.ts`), no JSX, para poder testearlo. La cadena que lo
mantiene honesto es de tres eslabones: el schema de zod deriva el vocabulario de
rutas (`tests/analytics-campos.test.ts`) y ese vocabulario exige un nombre para cada
ruta (`tests/campos-faltantes.test.ts`). Un campo nuevo sin nombre falla en el test,
no en producción con un mensaje que dice «1 campo» y no dice cuál. Los títulos y los
ids de sección viven como literales en los `.tsx` y el test los compara: si alguien
renombra una sección, el mensaje mandaría a una sección que no existe.

**Cómo se encuentra "el primer campo".** El campo rechazado se marca en el DOM
(`data-campo-con-error`) y se busca con `querySelector`, que devuelve el primero **en
orden de documento**. Nadie mantiene un orden a mano, y el orden del formulario es el
único que le sirve a quien lo está recorriendo.

## D-122 · El autoguardado vive en el navegador, no en Firestore

**Contexto.** Un reporte desde el panel (issue #6, Android, `1.0.1+538bef7`): *"Se
podrá guardar algo como borrador o auto guardado, como en word? Porque reporté algo y
todo lo que escribí se borró"*. El accidente concreto ya estaba cerrado —B-35 avisa
antes de descartar el formulario, publicado en `1.1.0`—, pero un aviso evita el
accidente y no recupera el trabajo.

**Decisión.** El formulario se persiste en `localStorage`, con clave por admin y por
formulario, y al abrir se **ofrece** lo recuperado.

> **La forma de la clave y lo que pasa al recuperar los corrige D-124.** Esta
> decisión decía "clave por actividad, más una para la actividad nueva", y esa
> clave compartida entre la carga nueva y la copia era un bug; y la guarda de
> `calendarEventId` que se describe abajo era **la mitad** de la que hacía falta.
> Lo que sigue vale, salvo esos dos puntos.

**Por qué no Firestore.** Es lo que hace que esto sea chico: no hay reglas nuevas, ni
campos nuevos, ni un trigger que dispare el sync a Calendar, ni una escritura por
tecla que cueste plata. Y el borrador a medias tampoco tendría por qué existir en la
base: no es una actividad, es lo que alguien está escribiendo.

**Las tres cosas que no se podían hacer mal:**

1. **Recuperar en silencio es peor que no recuperar.** Si al abrir aparece texto que
   no está guardado, sin decir de dónde salió, la próxima duda es "¿esto lo guardé o
   no?". El aviso dice que es de este dispositivo, de cuándo es, y que no llegó a la
   agenda; y se puede descartar.
2. **Lo guardado es contenido**, a diferencia de todo lo demás que el panel persiste
   en el navegador (qué novedad se leyó, qué acordeón se abrió). No puede filtrarse a
   la analítica, que solo acepta enums y contadores (§9): el módulo y el hook no
   importan nada de `analytics` y `tests/autoguardado.test.ts` lo verifica leyendo el
   código, con los comentarios afuera.
3. **Limpiar al guardar bien**, o el borrador viejo reaparece encima de la versión
   buena la próxima vez que se abra la actividad.

**Lo que se descarta y se borra al leerlo:** un JSON ilegible, uno de otra
`VERSION_BORRADOR` —un borrador viejo aplicado sobre un formulario nuevo parece
bueno, que es lo peligroso— y uno de más de 30 días. Se borra en el mismo paso: si
quedara, reaparecería en cada apertura sin que nadie pueda hacer nada con él.

**Nunca rompe el formulario.** `localStorage` **tira** —no devuelve `null`— en modo
privado, con la cuota llena y en un iframe con cookies bloqueadas, así que el acceso
entero va en try/catch y el autoguardado que no pudo guardar no interrumpe el tecleo.

**La guarda que no era obvia: `calendarEventId`.** Es el único campo del formulario
que **escribe el backend** (el write-back del §7.1), y el autoguardado
institucionaliza los formularios viejos: hasta 30 días. Un borrador guardado antes
del write-back lo tiene en `null`, y aplicarlo tal cual persistiría ese `null`; el
sync de ese guardado todavía usa el id del snapshot anterior
(`previa?.calendarEventId ?? …`) así que **no se nota**, y la edición siguiente ve
una sesión conocida sin evento y crea un segundo evento para el mismo encuentro. Es
el mecanismo de B-80 con un día de demora. Por eso lo recuperado pasa por
`conIdsDeCalendarioDe`, que cruza por id de sesión —estable y del cliente, trampa 2—
y le devuelve a cada fila el id de calendario que hoy tiene en el documento. Queda
anotado en `15-mapa-de-trampas.md` como vía nueva de una clase conocida.

**Lo que esta guarda no vio, y es la lección que dejó:** el razonamiento era
correcto —hay campos donde un valor de hace 30 días tiene consecuencias— y el error
fue creer que `calendarEventId` era el único. Los otros dos son los flags de
publicación, y eso es **D-124**.

**Orden con D-120.** B-183 iba primero por diseño: es más barato, cierra el agujero
de raíz y baja mucho la urgencia de esto. Los tres ítems eran una sola historia
contada en tres pedazos —no podés guardar, no sabés por qué, y si te vas lo perdés—.

## D-123 · La guarda de credenciales va en la puerta, no en el paso del workflow

**Contexto.** B-189: `hayCredenciales()` estaba escrita en `firebase-admin.ts`
desde el principio y **no la llamaba nadie**. Hoy no rompe —ninguna página lee
Firestore en el build todavía—, y por eso pasó un mes desapercibida. Rompe con
B-106: un build sin credenciales que arma el `events.json` no falla, produce cero
actividades, y el deploy lo publica encima del sitio que sí tenía datos. En verde
y sin log.

**Decisión.** El chequeo va adentro de `adminApp()`, la única puerta a Firestore en
build time.

**Por qué no en el paso de build de los workflows**, que era la otra opción escrita
en el ítem: cubre menos. `1.1.0` se desplegó a mano
(`npm run build && firebase deploy`), que es exactamente el camino que ningún `if`
de un YAML mira. En la puerta, en cambio, la guarda **no se puede no llamar**:
cualquier lectura de Firestore en el build pasa por ahí porque `firebase-admin` no
se importa desde ningún otro lado (§5.4), y eso lo fija un test que recorre `src/`.

**Por qué no alcanzaba con la regla del §3.2 de `12-sitio-publico.md`.** Esa regla
—falla en CI, en local sigue con lista vacía y un aviso— **no cambió**, y sigue
siendo del lector de Firestore: "seguir con lista vacía" es un valor de retorno, y
la puerta no puede devolver eso. Lo que se agrega es la red de atrás. Las dos
capas responden a preguntas distintas: la del lector es *qué hacer sin datos*, la
de la puerta es *que nadie lea sin credenciales sin enterarse*. Y la de la puerta
existe justamente porque la del lector es la que se olvida — es el patrón que dejó
esta guarda apagada: alguien escribe la guarda pensando en el consumidor que
todavía no existe, y el consumidor nace sin llamarla.

**La contra, asumida.** Un build en una máquina de Google con credenciales del
metadata server —que `applicationDefault()` encuentra sin ninguna variable— queda
bloqueado hasta exportar una de las tres. Es el lado prudente del error: hoy el
build corre en Actions con el secret y a mano en una máquina de trabajo, y en los
dos casos hay variable. El camino local sin credenciales de producción es el
emulador, que `hayCredenciales()` acepta y que el §10 pide igual para desarrollar.

**Se verificó reintroduciendo el bug:** sacando la llamada de `adminApp()` y
dejando la función exportada —o sea el estado exacto de B-189—, tres tests de
`tests/build-credenciales.test.ts` se ponen rojos.

---

## D-124 · Lo que se recupera de un borrador no es lo que se guardó

**Contexto.** B-191 dejó el autoguardado andando, y los tres auditores del cierre
encontraron que la guarda que traía era **la mitad** de la que hacía falta.
`conIdsDeCalendarioDe` reconciliaba un campo, `calendarEventId`, con un
razonamiento correcto: el borrador vive hasta 30 días, así que un valor viejo se
aplica sobre el documento de hoy y hay campos donde eso tiene consecuencias. El
error no era el razonamiento: era creer que ese campo era el único.

**Decisión.** Lo recuperado pasa por **cuatro** saneadores —uno en la lectura y
tres en la recuperación— antes de entrar al formulario:

1. **Los `calendarEventId` son del documento de hoy** (`conIdsDeCalendarioDe`). Lo
   escribe el backend; aplicar el de hace un mes crea un segundo evento para el
   mismo encuentro en la edición siguiente. Es la familia de B-80.
2. **Los flags de publicación vuelven a privado** (`sinFlagsDePublicacion`).
   `online.urlPublica` y `material.items[].publico` son los dos que deciden si el
   link de la reunión y las URLs del material salen a `events.json` y a la
   descripción del evento. Se destilda una casilla, no se guarda, se recupera a los
   veinte días, se publica — y el link sale. Es la trampa 5 por una puerta nueva.
3. **Solo entran las claves que el formulario conoce** (`podarConMolde`, en la
   **lectura**, no en la recuperación: es el único de los cuatro que corre al leer
   de `localStorage`). La guarda
   de forma mira dos campos de ~30, y aguas abajo `formADocumento` copia `sede`,
   `online`, `organizador` y `tallerista` tal cual, y `toPublic` proyecta los tres
   primeros **enteros**: una clave de más en el borrador termina en `events.json`.
   Hoy no filtra nada, porque nadie escribe esa clave; entra por la regla de
   "publica solo el campo que se agregue mañana" (§5.2).

**Por qué los flags vuelven a `false` y no se preservan.** La asimetría es total:
una casilla destildada se vuelve a tildar en dos segundos, y un link publicado no
se despublica de donde ya lo copiaron. Es además el default que `toPublic` ya
declara — publicar un link es una acción deliberada por actividad, no el
comportamiento por omisión (D-15).

**El agravante que lo hacía silencioso**, y que es la razón de que el aviso lo
diga: `SeccionMaterial` decide si abre según `form.material.tiene`, y `Seccion` lee
`abiertaPorDefecto` **solo al montar**. Un flag que llega con el borrador —después
del montaje— quedaba en una sección cerrada, o sea en ninguna parte de la pantalla.
Es el mismo agujero que documenta B-184 para los errores, aplicado a un flag de
publicación.

**La clave del borrador es por admin y por formulario.** Dos cosas que faltaban:

- **Por admin**, con la huella de `lib/huella.ts` y no el uid en claro. El §5.1
  marca como interno buena parte de lo que el formulario contiene (`difusion`,
  `inscripcion.destino`, `online.url`), y con dos cuentas en la misma máquina —la
  premisa de D-57— una clave sin dueño le ofrecía a B el borrador sin guardar de A.
- **Distinguiendo la carga nueva de la copia.** Las dos nacen sin id, así que
  compartían la clave `nueva`. El comentario que lo justificaba —"las dos se
  guardan creando un documento"— razona sobre la **escritura**, y lo que se ofrece
  es **contenido**: un borrador de "nueva" interrumpido se ofrecía dentro de un
  duplicado y, aceptado, publicaba una actividad distinta de la que se quiso
  duplicar. El discriminador ya estaba una línea más abajo, en la medición.

**Lo que se decidió dejar pasar, y queda dicho para que no vuelva a preguntarse.**
La tercera pasada del auditor encontró un séptimo caso y dos campos borderline, y
los tres se quedan del lado del borrador a propósito:

- **La membresía de filas de `sesiones`.** Un encuentro que hoy existe en el
  documento y no en el borrador desaparece al recuperar, y el diff del §7.2 le
  borra el evento a quien esté suscripto. Es la simétrica de `cancelada`, con el
  signo invertido, y no se protege por una razón: la sección **Encuentros no está
  colapsada**, así que la fila que falta se ve antes de guardar — al contrario de
  la casilla de material, que fue todo el argumento del punto 2. Y borrar una fila
  dentro del borrador es trabajo legítimo que restaurarla desharía.
- **`destacado`** y **`inscripcion.cierra`**. El segundo es el menos obvio: de él
  sale `inscripcion.abierta` en la proyección, así que un `cierra` vacío de hace
  tres semanas **reabre** una inscripción cerrada. Los dos son reversibles con un
  click y ninguno toca el calendario, así que quedan afuera — pero quedan
  **nombrados**, que es lo que faltó las dos veces que la lista se quedó corta.

**Y cerrar sesión se lleva los borradores.** Sin eso, el contenido sobrevivía al
logout hasta 30 días. La frase que `07-seguridad.md` ya afirmaba —"es el mismo
alcance que la sesión del panel en ese navegador"— era falsa como estaba
implementado, y de las dos salidas posibles se eligió **cumplir la promesa** en vez
de bajarla a la prosa.

**Por qué hay un módulo nuevo, `borradoresDelNavegador.ts`.** El borrado lo
necesita `AdminApp`, que vive en el chunk inicial del panel; `autoguardado.ts`
importa el molde del formulario y con él `lib/opciones`. Importarlo desde `AdminApp`
se habría llevado todo eso a la carga inicial y habría deshecho el corte de
B-09/D-51 — que ya se rompió tres veces sin que nada fallara. El módulo nuevo no
importa nada, y `autoguardado.ts` re-exporta lo suyo para que sus consumidores no
cambien.

**Y la lista se quedó corta otra vez.** Con los flags arreglados, la re-auditoría
encontró tres campos más con la misma propiedad, y el precedente estaba en el
repo: `duplicar.ts` —el otro lugar donde se aplica un formulario viejo— ya había
contestado esta pregunta con una línea y un comentario, `estado: 'borrador'`,
«duplicar no publica». Recuperar aplicaba `estado` crudo, así que un borrador de
hace veinte días que decía `publicado` **re-publicaba** una actividad retirada a
propósito: vuelve a `events.json` y la Function le recrea los N eventos. Es el
§7.3 al revés. Con `slug` es la trampa 10 —el input está bloqueado al publicar,
pero el borrador pisaba el campo sin mirar ese flag— y con `sesiones[].cancelada`
es recrearle el evento a todo el que esté suscripto.

Los tres salen ahora del documento de hoy (`conLoQueEsDelDocumento`), y **la lista
vive en un solo lugar**: se quedó corta dos veces porque estaba repartida entre dos
funciones. La regla, escrita: *recuperar un borrador no cambia el estado de
publicación; publicar y despublicar se eligen mirando la pantalla*. La contra
asumida es `cancelada`: si la cancelación se hizo dentro del borrador, hay que
volver a tildarla — una casilla contra un evento que reaparece en el calendario de
otros.

**El molde de la poda estaba mal, y borraba `tallerista.bio`.** Escrito a mano, le
puso a `tallerista` la forma de `organizador` —que tiene `web` y no `bio`, porque
son dos tipos distintos—, así que la poda que existe para no *publicar* una clave
de más **perdía** el texto más largo sobre una persona, en la función que existe
para no perder texto. Es la clase de B-88 otra vez: el productor de la forma
(`cascadas`) y el consumidor (el molde) derivando por separado. Ahora el molde sale
de las mismas fábricas, y para eso `personaVacia()` salió de `cascadas.ts` a
`estadoInicial.ts`, donde ya viven `sedeVacia()` y `onlineVacio()`.

De paso, dos cosas que el molde destapó: **el molde da la forma, no los defaults**
—tiene `sede.geo` con forma de coordenada para poder podar adentro, y usarlo como
default metería un `{lat: 0, lng: 0}`, el golfo de Guinea, en una sede sin bloque—,
y **podar no puede dejar el formulario incompleto**: la guarda de forma mira dos
campos de ~30, así que un borrador sin `material` la pasa y el primer consumidor
que haga `f.material.items.some(...)` se lleva puesta la isla del panel. Lo que
falta se completa desde `formVacio()`.

**Se verificó reintroduciendo cada bug**, uno por uno: sin `sinFlagsDePublicacion`
en el formulario caen dos tests, con la clave compartida entre nueva y copia cae
uno, y sin la poda caen dos. La primera corrida de esa verificación **no falló**, y
eso destapó un cuarto problema: el test que afirmaba la guarda de B-80 decía
`toContain('conIdsDeCalendarioDe')`, y esa cadena **la satisface el import**. O sea
que verificaba que el nombre estuviera importado, no que se llamara. Ahora los dos
tests afirman la composición con los espacios colapsados, y se verificó que caen.

Y esa clase se repitió **en el test escrito para arreglarla**: el que fija el
borrado al cerrar sesión decía `toContain('borrarTodosLosBorradores')`, que lo
satisface el import de `AdminApp.tsx`. Es la señal de que la forma del aserto es
más fácil de equivocar que el código que verifica, y por eso quedó anotada en
`13-agentes.md` y no solo arreglada acá. Hay dos asertos vivos con la misma forma
en `tests/foco.test.ts`, que son **B-202**.

---

## D-125 · La galería: una lista, un epígrafe opcional, y el texto alternativo del título

**Contexto.** B-167, con las cuatro decisiones de DEC-7 tomadas por el dueño el
2026-08-26. El modelo pasa de un campo a una lista, y eso tenía que entrar
**antes** del sitio público: B-107 necesita exactamente una imagen para Open
Graph, así que si la galería llegaba después había que rehacer la tarjeta, el
detalle, la proyección y el `events.json`.

**La que más pesa, y no es cosmética: el epígrafe no es el texto alternativo.**
Se pidió "descripción opcional", que es un **epígrafe**: se muestra debajo de la
foto y puede no estar. El **texto alternativo** es otra cosa —lo que leen un
lector de pantalla y Google— y no debería ser opcional. Las tres salidas posibles
eran dos campos, un campo obligatorio que sirva para las dos cosas, o un campo
opcional con el alternativo derivado. **Se eligió la tercera:** el epígrafe es
opcional y el texto alternativo sale del **título de la actividad**.

Por qué, y la contra asumida: un campo obligatorio por imagen en un panel de una
persona produce "foto" como texto alternativo, que es peor que un título
descriptivo ("Taller de crónica urbana en Casa Brandon"). La contra real es que
las cuatro imágenes de una actividad comparten el mismo alternativo, que para un
lector de pantalla es repetición. Se acepta: la alternativa medía peor.

**`portada` es un flag explícito y no "la primera".** La imagen que uno quiere que
aparezca al compartir el link no siempre es la primera que cargó, y reordenar
necesita su propio gesto —arrastrar— que es más trabajo de formulario que un
botón. El schema valida **exactamente una** en los dos niveles de D-120: dos
portadas hacen que B-107 emita una imagen distinta según el orden de lectura, que
es la clase de bug que no falla, miente.

**El default de lectura, para siempre, y con id determinístico.** Lo segundo es lo
que casi fue un bug: la regla del repo es que los ids se generan en el cliente
(trampa 2), pero un default de **lectura** que genera un uuid produce un id
distinto en cada lectura, y entonces `huboCambioDeContenido` ve un cambio cada vez
que se abre el formulario. El centinela `img_legacy` además dice, a quien lo mire,
que esa fila viene de un documento anterior a la galería.

**Duplicar hereda las externas y no las propias.** Una externa es una URL de otro
lado: copiarla no cuesta nada. Una propia vive en nuestro Storage, y si la copia
compartiera el `storagePath`, borrar una le rompería las imágenes a la otra — la
clase de B-71 con estado compartido. Es la respuesta conservadora **hasta B-199**,
el modal que va a dejar elegir qué se duplica; ahí se decide si las propias se
copian como objetos.

**Lo que esta decisión NO resolvió**, y está dicho para que no parezca olvido:
subir archivos propios. El modelo ya lo soportaba (`origen: 'propia'`,
`storagePath`) y faltaba la mitad de infraestructura — `storage.rules`, el target
de deploy que `que-deployar.sh` no conocía, la Function que quita el EXIF y deriva
la miniatura, y el SDK de Storage en su propio módulo lazy. Fue a su propia tajada
porque cada uno de esos cuatro es un lugar donde equivocarse en silencio.

**Y dos cosas que la auditoría de esta tajada dejó decididas a medias**, las dos
sin efecto entonces y las dos reales el día que hubiera propias: la URL pública de
una imagen propia **contiene** el `storagePath` URL-encodeado más un token
permanente, así que ocultar el campo no lograba lo que decía el comentario de
`toPublic.ts`; y `storagePath`/`ancho`/`alto` iban a tener dos escritores —la
Function y el spread de `formADocumento`—, que es `calendarEventId` dentro de
`sesiones` otra vez. Las dos eran **B-206**, y las dos se resolvieron en la segunda
tajada: ver **D-128**.

---

## D-126 · El libro presentado es un campo propio de dos textos, y es público

**Contexto.** DEC-1, decidido por el dueño el 2026-08-21 e implementado el
2026-08-26: campo propio —no dentro de la descripción— con el título de la obra y el
autor de la obra si difiere del invitado, para poder filtrar y mostrarlo aparte.

**Campo propio y no un párrafo.** Dentro de la descripción el dato existe para quien
lee y no existe para nada más: no se puede mostrar aparte, no se puede filtrar, y no
se puede buscar sin buscar en todo el texto. La contra es un campo más en un
formulario de 30+, y se paga con el condicional del §11: aparece en presentación y
charla, los dos tipos en los que la persona al frente es «autor o autora invitada».

**Dos textos y no uno.** `titulo` identifica la obra; `autor` se llena **solo cuando
difiere del invitado** —una traducción, una antología, un autor que no viene—. En una
presentación normal el autor es quien viene, ya cargado en `tallerista`, y la
descripción del evento no lo repite. Sin título no hay libro: se escribe `null`,
igual que un `tallerista` sin nombre.

**La tabla del paso 0, que es lo que no se puede deshacer:**

| Salida | ¿Sale? | Motivo |
|---|---|---|
| `events.json` | **sí** (`titulo`, `autor`, enumerados) | información de la actividad, del orden del título |
| Evento de Calendar | **sí**, en la descripción | «presentación de tal libro» es el dato central del evento |
| Issue de GitHub | **no** | el reporte es sobre el panel; de la actividad salen título y slug |
| GA4 | **no** el contenido; sí `tiene_libro` y las rutas de campo | no hay sanitizador de texto libre y no se agrega uno |
| `searchText` (→ `events.json`) | **sí** | encontrar la presentación buscando la obra era la mitad del pedido |

Esa quinta fila no está en el paso 0 del skill y **debería**: es una salida pública
por la puerta de atrás, porque el `searchText` viaja entero al `events.json`.

**Entra al evento por `construirDescripcion`**, adentro de `construirEvento`, así que
corregir el título de la obra propaga a las N sesiones del ciclo sin ningún caso
especial (trampa 9, D-07). Armado por fuera dejaría de propagarse en silencio. La
vista previa del panel se actualiza sola por `@calendario` (D-20).

**El default de lectura es determinístico, y es la lección de D-125 aplicada.**
`libroVacio()` es la única fábrica de la forma: la usan el formulario nuevo, la
lectura de todo documento anterior a DEC-1 y —por venir dentro de `formVacio()`— el
molde con el que el autoguardado poda lo recuperado. Un default no determinístico
haría que `huboCambioDeContenido` vea un cambio en cada apertura del formulario: una
versión al historial por cada vez que alguien **mira** una actividad.

**`VERSION_BORRADOR` no subió, y esa es la diferencia con D-125.** La guarda de B-88
se puso roja —correcto, la forma del formulario cambió— y la respuesta fue agregar las
dos rutas y **no** subir la versión: `libro` es **aditivo**. Un borrador anterior no
trae la clave, la poda no la copia y la mezcla la completa con `libroVacio()`, o sea
el mismo resultado que un formulario abierto hoy sin cargar el campo. Subirla tiraría
a la basura todo borrador en curso en el navegador de cada admin a cambio de nada. La
guarda existe para hacer pensar, no para subir el número.

**El bloque se muestra en cualquier actividad que ya lo tenga cargado**, no solo en
los dos tipos que lo piden. `formADocumento` conserva el libro al cambiar de tipo
—las cascadas agregan y no sacan— y `duplicar` lo hereda, mientras las dos salidas
públicas no miran el `tipo`: sin esa segunda mitad, una presentación pasada a taller
seguía publicando «Libro: …» sin pantalla desde donde verlo ni borrarlo. La
alternativa —condicionar la proyección por tipo— es peor: esconde en la salida algo
que el documento sigue teniendo.

**No se exige para publicar.** Igual que el bloque de autor invitado: una presentación
ya publicada no puede volverse inguardable por un campo que se agregó hoy, y el §11
dice qué se **pide**, no qué se prohíbe publicar sin.

**Lo que esta decisión NO resuelve:** filtrar por libro en el sitio público. El dato
ya viaja y es buscable por `searchText`; un chip de filtro por obra tiene sentido
recién cuando haya varias presentaciones del mismo libro.

---

## D-127 · «Se llenó» es un booleano, se prende desde el listado, y no esconde el canal

**Contexto.** B-97, decidido por el dueño el 2026-08-26 e implementado el mismo día.
Después de publicar no había forma de decir nada: el taller se llenaba, la gente
seguía mandando DM, y el sitio y el calendario seguían mostrando «cupo: 12» porque
`inscripcion.cupo` se carga una vez y no se vuelve a mirar.

**Un booleano y no un contador de lugares.** Un contador queda viejo con **cada**
inscripción y no solo con la última, y un número viejo es peor que ninguno porque
parece información fresca. `inscripcion.completo` se prende cuando no entra nadie más
y se apaga si se libera un lugar. Es además la salida que **B-102** ya nombraba para
resolver el conteo sin guardar un dato de ningún tercero: el sistema sigue sin saber
quién se anotó, y el §5 sigue cabiendo en una tabla.

**El canal de inscripción NO se esconde.** `via` y `destino` siguen saliendo con el
cupo completo, en el `events.json` y en la descripción del evento, con el cartel **al
lado** y no en su lugar. Siempre hay lista de espera y las bajas existen: esconder el
canal convierte una baja en un lugar que se pierde. Para el organizador, un DM de más
cuesta menos que un lugar vacío. En el evento la línea lleva el paréntesis que explica
por qué el contacto sigue ahí —«se puede escribir igual: puede liberarse un lugar»—:
sin él, un cupo completo con un mail al lado se lee como un error.

**Se prende desde el menú «⋯» del listado, no desde el formulario**, y esa es la mitad
del valor. Es el dato que cambia *después* de publicar, cuando ya no se está cargando
nada: abrir 30+ campos desde el teléfono para tocar una casilla no se hace, y lo que
no se hace no informa a nadie. `marcarCupoCompleto` escribe **solo esa clave**, con
ruta punteada, así que un toque no puede pisar el destino ni el cierre que el
documento tenga en ese momento.

**La tabla del paso 0, que es lo que no se puede deshacer:**

| Salida | ¿Sale? | Motivo |
|---|---|---|
| `events.json` | **sí** (`completo`, enumerado) | es el punto del campo: sin esto el sitio sigue diciendo «cupo: 12» cuando ya no entra nadie |
| Evento de Calendar | **sí**, en la descripción | es la única salida que le llega **sola** a quien ya guardó la fecha |
| Issue de GitHub | **no** | el reporte es sobre el panel; de la actividad salen título y slug |
| GA4 | **no** hay contenido posible: va `cupo_completo` (booleano), la ruta `inscripcion.completo` y la función `actividad-cupo-completo` | un booleano no lleva texto libre |
| `searchText` (→ `events.json`) | **no** | nadie busca «completo», y el `searchText` viaja entero al `events.json` en cada visita |

Esa quinta fila la agregó D-126 y sigue haciendo falta: es una salida pública por la
puerta de atrás. Acá la respuesta es la contraria a la del libro, y por eso vale
escribirla.

**Entra al evento por `construirDescripcion`**, adentro de `construirEvento`, así que
prenderlo actualiza los N eventos del ciclo sin ningún caso especial (trampa 9, D-07).
Es el riesgo que el ítem marcaba para mirar de verdad, y está fijado con un test que
exige **ocho `actualizar` y cero `borrar`**: borrar y recrear le perdería a la gente
sus recordatorios. Apagarlo propaga igual. Y hay un test que pide que la línea aparezca
**una sola vez** en el evento: armarla *también* por fuera no rompe la propagación
—sigue entrando al payload— pero deja la línea dos veces en el calendario público, y
ningún test de propagación se da cuenta. La vista previa del panel se actualiza sola
por `@calendario` (D-20).

**El default de lectura es `false` y es determinístico**, la lección de D-125 y D-126
aplicada: un default derivado (comparar el cupo contra algo, mirar la hora) haría que
`huboCambioDeContenido` vea un cambio en cada apertura del formulario, o sea una
versión al historial por cada vez que alguien **mira** una actividad. La primera
edición de una actividad anterior a B-97 sí registra `inscripcion` como cambiado —el
documento cambió de verdad— y es **una sola vez por actividad**, no una por apertura.

**Tiene un solo dueño, y no es el formulario.** `inscripcion` se escribe **por
subcampos punteados** al guardar, y `completo` queda afuera (`payloadDeActualizacion`).
Sin eso el campo tenía dos escritores adentro de un objeto de contenido —el perfil
exacto de `calendarEventId` dentro de `sesiones`, o sea la clase de B-80— y un
formulario abierto desde antes de marcarlo apagaba el cartel del sitio y de los N
eventos en su próximo guardado, sin que nadie lo pida. El otro camino era el borrador
local, que vive hasta 30 días: `completo` entró a la lista de D-124, que con esto se
quedó corta por **tercera** vez.

**`VERSION_BORRADOR` no subió.** La guarda de B-88 se puso roja —correcto, la forma del
formulario cambió— y la respuesta fue agregar la ruta y no subir el número:
`inscripcion.completo` es **aditivo**, y un borrador anterior no trae la clave, la poda
no la copia y la mezcla la completa con el `false` de `formVacio()`, que es lo mismo que
muestra un formulario abierto hoy. No hay una forma nueva que haga que lo viejo
*parezca* bueno, que es el criterio del bump (y lo que sí pasaba con B-167).

**La copia no lo hereda.** Mismo criterio que `cancelada` en las sesiones: que la
edición anterior se haya llenado es un hecho de esa edición, no una propiedad del ciclo
nuevo, que todavía no tiene una sola inscripción.

**Lo que se publica se ve desde el panel.** El cartel está en la fila del listado y la
sección «Arancel e inscripción» muestra un **aviso** cuando está marcada —un aviso y no
una casilla: con una casilla habría dos lugares donde prenderlo y ninguno sería el
bueno—. Es la segunda mitad de lo que D-126 aprendió con el libro heredado por un
taller: algo que sale al sitio y al calendario no puede quedar sin pantalla desde donde
verlo y sacarlo.

**Lo que esta decisión NO resuelve:** el cartel en el sitio público. Es B-01, y el dato
ya viaja en el `events.json` esperándolo.

---

## D-128 · Solo el admin lee `/actividades` — desvío del §5.3

**Contexto.** Lo encontró el `auditor-privacidad` en el barrido del 2026-08-27, y se
reprodujo contra el emulador antes de tocar nada. El §5.3 del `CLAUDE.md` prescribe:

```js
match /actividades/{id} {
  allow read:  if resource.data.estado == 'publicado';
  allow write: if request.auth.token.admin == true;
}
```

Esa regla es coherente con el resto del diseño —§2.4 y §2.5 dicen que el público hace
**un** fetch de `events.json` y **cero** lecturas de Firestore—, así que se leía como
inofensiva: nadie del lado público la iba a usar. El problema es que **una regla de
Firestore no proyecta**. Es todo-o-nada por documento: autoriza entregar el documento,
no una vista de él.

**Lo que pasaba.** Con la API key web —pública por diseño, en el bundle de `/admin` y
versionada en `.env.production` de un repo **público**— una query anónima con el
`where('estado','==','publicado')` devolvía los documentos enteros. La query estaba
permitida porque cada documento devuelto cumple la condición. Volvía la lista completa
del §5.1:

| Campo | §5.1 dice |
|---|---|
| `online.url` con `urlPublica:false` | el link de la reunión no se publica nunca (trampa 5) |
| `difusion.notas`, `difusion.arrobar` | trabajo interno |
| `material.items[].url` con `publico:false` | solo título y tipo, sin URL |
| `createdBy` / `updatedBy` | uids |
| `sesiones[].calendarEventId` | dato de máquina |
| `imagenes[].storagePath` | dibuja el bucket |

O sea: `toPublic`, `construirDescripcion`, el barrido de centinelas de B-196 y la tabla
de las cuatro salidas cuidaban una puerta que tenía otra abierta al lado. Y agrava que
`toPublic` **todavía no tiene consumidor** (B-106 abierto, no hay `events.json` en
`dist/`): el 100 % de lo que se alcanzaba desde afuera entraba por acá y no por la
proyección.

**Decisión:** `allow read: if esAdmin();`.

**Por qué no rompe nada.** El panel siempre está logueado. El sitio público (B-01) sirve
el `events.json` que produce el build con el Admin SDK, que no pasa por reglas. No hay
ninguna lectura anónima en el repo hoy.

**Alternativa descartada: partir el documento.** Mover los campos privados a una
subcolección `privado/{doc}` con `allow read: if esAdmin()` conservaría la lectura en
vivo de lo publicado. Se descartó **por ahora** porque nada la necesita: agregaría una
lectura más por actividad y una escritura transaccional en el panel para sostener una
capacidad que no se usa. **Es el camino correcto el día que haga falta lectura en vivo
desde el cliente** — lo que no hay que hacer es volver a la regla de arriba.

**Lo que se aprendió, y es lo que vale de esta entrada.** El `it` que fijaba el
comportamiento se llamaba `it('un anónimo lee lo publicado')` y estaba **en verde**. No
estaba mal escrito: fijaba fielmente lo que el §5.3 prescribía. Un test puede estar
verde, ser correcto respecto de su especificación, y estar certificando una fuga —
porque lo que estaba mal era la especificación. Por eso el reemplazo tiene control
positivo (`el admin SÍ lee la publicada, con sus campos privados adentro`): sin él, los
dos `it` de rechazo darían verde sobre una colección vacía.

De paso **cierra B-172**: escribir la consulta de colección en el test de reglas era
exactamente la red que le faltaba a la trampa 7 del §13. Ver
[`15-mapa-de-trampas.md`](15-mapa-de-trampas.md).

**El §5.3 del `CLAUDE.md` queda con un puntero a esta entrada**, para que el próximo que
lo lea completo —como pide el encabezado— no restaure la regla de buena fe.

## D-129 · El índice no lleva el link de la reunión ni con `urlPublica: true`

**Contexto.** D-15 es un desvío consciente del §5.2: el modelo tiene el flag
`online.urlPublica` y el formulario su casilla, así que ignorarlo era prometer
algo que no pasaba. Con el flag prendido, el link **sale** — a la salida 1
(`events.json` y las páginas) y a la 2 (el evento de Calendar). A la 3, la 4 y la
5 no llega nunca, con flag o sin flag.

B-106 partió la salida 1 en dos artefactos: el **índice** (`/events.json`) y el
**detalle** (el HTML de cada actividad). El flag de D-15 no decía nada sobre esa
partición, porque cuando se escribió no existía.

**Qué se decidió.** El link entra al **detalle** y no al índice. `entradaDeIndice`
ya lo dejaba afuera —toma `online.plataforma` y nada más—, pero eso era una
consecuencia y no una decisión: nadie la había tomado y nada la sostenía.

**Por qué.** Es el mismo argumento que decide el recorte de `inscripcion.destino`
y no es privacidad estricta: el link **es** público cuando el dueño prende el
flag. Lo que cambia es que el índice lo entregaría **en lote y en un solo GET**,
mientras que en el detalle hay que crawlear una página por actividad. Esa
diferencia es la que decide si alguien lo cosecha, y con el link de una reunión
el costo de que alguien lo coseche es zoombombing (trampa 5), que es
irreversible mientras dura el encuentro.

Y del otro lado no se pierde nada: el listado no lo usa. La tarjeta no tiene
botón «Unirse» — eso es del detalle, que es donde alguien decide anotarse.

**Cómo se sostiene.** Dos tests que se pusieron rojos con la mutación antes de
darse por buenos: uno en `tests/eventsJson.test.ts` con control positivo (del
otro lado de la frontera el link **sí** está, o el test estaría celebrando que se
perdió un campo) y el caso `urlPublica: true` del barrido del índice en
`tests/barrido-de-salidas-publicas.test.ts`, cuya lista de permitidos va **sin**
`online.url` y eso es la afirmación. Además, el fixture del gate mecánico
(`scripts/build-contra-emulador.mjs`) usa `urlPublica: true` a propósito: es el
único caso que prueba que el índice lo saca por decisión propia y no de rebote.

**Lo encontró el `auditor-privacidad`**, y la forma del hallazgo se repite: las
otras dos salidas que consumen el flag tenían su caso `urlPublica: true` en el
barrido y el índice era la única de las tres sin él. Una celda de la matriz sin
decidir se resuelve sola hacia el lado seguro **hasta que alguien escribe la
línea que la resuelve para el otro** — que acá iba a ser cuando B-105 pinte la
tarjeta.

---

## D-130 · Las modalidades son una lista con su lugar adentro, y las fechas todavía no salen

**B-224.** Pedido del dueño, textual: «Una actividad tiene N modalidades (mismo
sistema que encuentro, misma UI). Cada modalidad puede ser presencial, virtual o
híbrida, como está ahora. Solo hay que sumarle una fecha y hora de inicio y una
fecha y hora de finalización. Ambas son opcionales.»

**`sede` y `online` se mudaron adentro de la fila**, y eso lo decidió él cuando se
le preguntó: «el formulario de modalidad se mantiene tal cual + doble fecha. Y
sobre eso es tener N modalidades así como N encuentros. Misma interfaz y
funcionalidades». O sea que la fila no es solo un enum con dos fechas: es el
bloque «Dónde» entero, repetido. Es lo que permite decir «los martes presencial en
la librería, los jueves por Meet», que con una sede sola no se podía.

**Quedan tres campos derivados en el documento: `modalidad`, `sede` y `online`.**
No son una segunda fuente de verdad: los escribe `formADocumento` en cada
guardado, igual que `searchText`, y existen porque hay salidas que **solo pueden
decir una cosa** — el campo `location` del evento, que es el que dibuja el mapa;
el `searchText` del §6; el filtro por barrio; la analítica. `modalidad` es la
**unión** de las filas (dos que difieren dan `hibrido`) y no «la primera»: lo
segundo depende del orden del array, que es la trampa 2 en otra forma —reordenar
las filas cambiaría lo que publica el `events.json`—. `sede` y `online` sí son «la
primera fila que tenga una», porque una dirección sola hay que elegirla y el orden
de las filas lo decide quien carga y se ve en pantalla; si algún día importa
distinguirla, la respuesta es un flag explícito como el `portada` de D-125.

**El filtro del panel busca por *cualquiera* de las formas de cursar.** Una
actividad con una fila presencial y otra virtual aparece bajo «Presencial», bajo
«Virtual» **y** bajo «Presencial y virtual», porque las tres cosas son ciertas de
ella. Filtrar solo por la resultante la escondería de los dos filtros que la
describen mejor.

**Las fechas de la ventana no salen a ninguna salida pública, y es a propósito.**
El dueño dejó abierto qué significan frente a `sesiones[].inicio/fin` («sobre las
fechas, te lo consulto pero hacé el resto»), así que se guardan y no se publican:
un campo que no sale no puede decir algo equivocado en el calendario de todos los
suscriptos, y agregarlo después es barato — sacarlo de algo ya publicado, no. La
celda tiene su test, que las busca **por su valor** en las cinco salidas
(`tests/modalidades.test.ts`).

**No hay migración, y esa fue la otra respuesta del dueño**: «no te preocupes por
hoy, no hay nada en producción». No hay backfill ni script: nada se escribe para
convertir nada.

**Y tampoco hay lectura de compatibilidad — pero la hubo, y sacarla fue la
decisión.** Vale contarlo entero porque el camino enseña más que el resultado.

El `auditor-trampas` mostró que con `?? []` a secas, abrir en el panel un
documento que solo tuviera los campos viejos y guardarlo —aunque fuera para
cambiar el título— derivaba `sede: null` y `online: null` sin que nada tirara
error: la ubicación desaparecía del sitio y del calendario semanas después. El
arreglo fue una `modalidadesDe` compartida por `@calendario` que sintetizaba una
fila con id determinístico `mod_compat`, copiando `imagenesDe()` (D-125).

Después le llegaron dos hallazgos más, de dos auditores distintos: el de
privacidad, que es una **rama de proyección pública que ningún centinela
recorre**; y el de trampas otra vez, que **fabrica una fila fantasma** cuando la
lista está vacía a propósito —un borrador al que le borraron todas las
modalidades— porque `modalidadResultante([])` devuelve `'presencial'` y hace
falsa la condición de al lado.

Dos hallazgos en una sesión sobre una función que existe **para leer documentos
que no existen**. Se borró. De las dos salidas posibles para una rama de
proyección sin barrido —escribirle el barrido o no tener la rama—, la segunda es
más barata: una celda que no existe no hay que decidirla en cada una de las cinco
salidas, ni mantenerle un fixture. Lo que queda es `?? []` donde el campo puede
faltar, y `tests/calendario.test.ts` fija la consecuencia: un documento sin la
lista no explota, no inventa una fila y **no dice dónde**.

**La lección, que vale más que el arreglo:** el bug de la fila fantasma nació de
que `modalidadResultante([])` devuelve `'presencial'` y no vacío. Un default
razonable en un lugar volvió falsa la condición de otro, a distancia y sin que
nada fallara. Es la familia del §13 aunque no esté en la lista: dos piezas
correctas por separado que se contradicen en el medio.

**La descripción del evento no cambió para una actividad de una sola modalidad, y
es deliberado.** Si el texto cambiara, el diff del §7.2 vería un evento distinto y
la primera edición de cada actividad publicada reescribiría sus N eventos en el
calendario de todos los suscriptos sin que nada hubiera cambiado para ellos. Es el
argumento de D-95, aplicado a un cambio de modelo.

**La guarda que protegía a `sede` y `online` se mudó.** La poda de
`autoguardado.ts` deja pasar los arrays a propósito, porque «sus proyecciones
públicas enumeran campo por campo»; al mudar la sede adentro de `modalidades`, esa
frase dejaba de ser cierta. Ahora la cuida `formADocumento`, que **enumera** los
campos de la fila en vez de copiarla con un spread — más fuerte que la poda,
porque la clave de más no llega ni siquiera a Firestore. Y `toPublic` enumera
también la sede de la fila. Las dos tienen su test y las dos se verificaron por
mutación.

**`VERSION_BORRADOR` subió a 3, y esta vez sí correspondía.** Es el caso de B-167 y
no el de `libro` o `inscripcion.completo`: un borrador de la forma anterior tiene
`titulo` y `sesiones`, así que **parece bueno**, y la mezcla lo completaría con la
fila presencial vacía de `formVacio()` — un taller virtual recuperado volvería como
presencial, con la sede y el link perdidos y sin que nada avise.

**El chasis de la lista se extrajo en vez de copiarse** (`campos/FilasEditor.tsx`),
y lo usan el editor de modalidades y el de encuentros: dos listas con el cableado
copiado terminan con el arreglo aplicado en una sola, que es una clase que este repo
ya pagó. Lo que queda en
cada editor es lo propio de su dominio (el generador de N encuentros, los saltos de
fecha, el selector de modalidad); un chasis que intente cubrir eso deja de serlo.

**Dos cosas más que arrastró, y las dos son de la misma clase que un derivado.**
El `searchText` indexa la sede de **todas** las filas y no solo la principal: con
dos barrios, buscar por el segundo tenía que encontrar la actividad. Y el
historial dejó de ofrecer `modalidad`, `sede`, `online` y `searchText` para
restaurar sueltos —restaurar un derivado por separado deja el documento
contradiciéndose hasta el próximo guardado, y en el medio eso sale al
`events.json`—; restaurar `modalidades` recalcula los tres derivados en la misma
escritura, que es B-207 con otro campo.

**Lo que esta decisión NO resuelve:** qué significan las fechas de una modalidad
(sigue en B-224 como decisión pendiente del dueño), y si una «opción para sumarte»
de DEC-8 lleva su propia modalidad — ahí los dos ejes se multiplicarían.
## D-131 · Subir una imagen propia: path opaco, metadatos afuera antes de subir, y la miniatura para después

**Contexto.** Segunda tajada de B-167, 2026-08-27. La primera dejó la galería
aceptando **URLs de afuera**; el dueño la usó y avisó que «no estoy viendo lo de
cargar imágenes». Tenía razón: DEC-7c decidió que conviven externas y propias desde
el día uno, y las propias no existían. Esta tajada las trae, y contesta las dos
preguntas que **B-206** había dejado escritas y sin implementar.

### 1 · Cómo se sirve una imagen propia (B-206 #1)

**Decisión: `getDownloadURL()`, la opción barata — pero con dos condiciones que la
vuelven honesta en vez de resignada.**

B-206 planteaba dos caminos: un rewrite de Hosting o dominio propio (el path deja de
verse y el egreso pasa por el CDN), o `getDownloadURL()` asumiendo que path y token
son públicos **y escribiéndolo como tal**. Decía además que la primera era «la única
que cumple la promesa» del comentario de `toPublic.ts`.

Lo que cambia la cuenta es que la promesa estaba mal escrita. El comentario decía que
publicar `storagePath` «dibuja la estructura del bucket y deja probar objetos por
nombre». Con las dos condiciones de abajo no hay estructura que dibujar ni nada que
ganar probando:

1. **El path es opaco y plano.** Un solo prefijo, `imagenes/`, y el nombre del objeto
   es el id de la fila de la galería — un uuid que ya se generaba en el cliente por la
   trampa 2. `imagenes/img_0e2a-4b1f.jpg` no dice nada de la actividad, del título ni
   de la fecha. Y **no se agrupa por actividad**, que era lo intuitivo, por una razón
   dura: al subir todavía no hay actividad. Una actividad nueva no tiene id hasta que
   se guarda, y un path `actividades/{id}/…` obligaría a guardar antes de poder subir
   una imagen — justo al revés de cómo se carga una actividad.
2. **Bajo ese prefijo la lectura es pública en `storage.rules`.** El token permanente
   de `getDownloadURL()` deja de ser lo que protege el objeto, así que un token
   «filtrado» no abre nada que no estuviera abierto. Es coherente con lo que la imagen
   es: la portada que va a `og:image`.

Con eso, `storagePath` **sigue sin salir al `events.json`**, pero por lo que sí es —el
handle autoritativo con el que el panel y la Function direccionan el objeto, y que un
consumidor del JSON no usa para nada— y no por una confidencialidad que la URL
desmentía. El comentario de `toPublic.ts` se reescribió: una afirmación de seguridad
que miente es peor que no tenerla, porque se usa para decidir (la lección de B-195).

**El rewrite de Hosting queda en el BACKLOG**, y con el motivo corregido: lo que compra
es **costo y portabilidad** —egreso por el CDN, poder mudar de bucket sin reescribir las
URLs ya guardadas— no privacidad.

### 2 · Dos dueños para `storagePath`, `ancho` y `alto` (B-206 #2)

**Se implementó el arreglo tal como B-206 lo dejó escrito**, sin cambiarlo:
`CAMPOS_DE_MAQUINA_IMAGEN = ['storagePath','ancho','alto']` en
`functions/historial.js`, y `formADocumento` **enumerando** las claves de cada imagen
en vez de spreadear la fila — igual que ya hacía con
`calendarEventId: s.calendarEventId ?? null`.

Hoy el segundo escritor todavía no existe (los tres los escribe la subida del panel),
así que las dos mitades son preventivas. Se hicieron igual, y ahora, por lo mismo que
se agregaron las clases `onObject*` al descubridor de triggers: es el único momento en
que el cambio es gratis, y el día que la Function llegue el costo de haberse olvidado
es **una versión de historial y un rebuild del sitio por cada imagen optimizada**.

Un detalle que no se adivina: los tres se copian con «si está», no con `?? null`.
Firestore guardaría el `null` como valor presente, y `huboCambioDeContenido` **no
unifica ausente con `null` a propósito** (D-41), así que escribir `storagePath: null`
en toda imagen externa produciría una diferencia de contenido contra cualquier
documento anterior — o sea, una versión y un rebuild por guardado.

### 3 · Los metadatos se sacan en el panel, además de en la Function

**Es un agregado a DEC-7d, no un reemplazo.** DEC-7d le da a la Function el EXIF, la
recompresión y la miniatura. La Function sigue haciendo falta y por el motivo de
siempre: es la que **no se puede saltear**, igual que `storage.rules` frente al schema.

Pero la Function es justamente lo que esta tajada **no** trae (ver abajo), y entre una
tajada y la otra hay imágenes propias públicas. Una foto sacada con un celular lleva
las coordenadas GPS del lugar donde se sacó, y muchos talleres pasan en la casa de
alguien: publicar eso no es una optimización pendiente, es el dato personal de un
tercero en el `events.json`, y una vez publicado no se despublica. Así que el panel lo
saca ahora y la Function lo va a sacar otra vez después. Defensa en profundidad, que es
el mismo patrón que DEC-7b ya había elegido para el tamaño.

**Se saca sin recomprimir**, y esa parte sí es una decisión. La otra forma —dibujar en
un `canvas` y volver a exportar— también borra el EXIF, y se descartó por tres motivos:
pierde calidad sin que nadie lo pida; **hace que el tope de 3 MB de DEC-7b deje de
significar lo que se decidió que significara** (una foto de 8 MB entraría recomprimida
y el mensaje que empuja a recortar no aparecería nunca); y no se puede testear sin un
navegador. Recorriendo los segmentos JPEG y los chunks PNG a mano, en cambio, la
función es pura y el test verifica **sobre los bytes de salida** que el bloque `Exif`
no está y que el dato comprimido salió idéntico.

**Y la primera versión de esto tenía dos agujeros, los dos de la misma familia: una
capa confiando en lo que le decía otra.** Los encontró el `auditor-privacidad` y vale
dejarlos escritos porque el arreglo de fondo es el que hay que repetir.

*Uno.* **El tipo del archivo se creía.** El `type` de un `File` lo deriva el navegador
de la **extensión**, así que un WebP —o un HEIC— renombrado `.jpg` pasaba
`validarArchivo`, hacía que `sinMetadatos` no reconociera la firma y devolviera el
archivo **tal cual**, y engañaba también a `storage.rules`, que compara el
`contentType` que manda ese mismo cliente. Tres capas mirando el mismo dato, y el
navegador después lo renderiza igual porque para mostrar una imagen se mira la firma y
no el nombre. Se verifica la firma antes de subir (`esDelTipoDeclarado`); no puede
rechazar un archivo bueno, porque un JPEG empieza siempre con `FF D8`.

*Dos.* **«Desde SOS hasta el final son los datos comprimidos» era falso.** Muchos
celulares apendan cosas **después del EOI**: la imagen secundaria MPF de los Samsung es
un JPEG entero **con su propio APP1 y su propio GPS**; también están el MP4 de una
motion photo y el trailer `SEFH`. Copiar «hasta el final» se los llevaba puestos, o sea
exactamente lo que el módulo existe para sacar. Ahora se corta en el EOI real
(`finDelJpeg`), respetando las tres cosas que impiden buscar `FF D9` a lo bruto: el
byte stuffing, los marcadores de reinicio y los segmentos que un JPEG progresivo
intercala entre scans.

*Y el arreglo que vale más que los dos:* **un barrido sobre la salida**. Antes de
`uploadBytes` se buscan las tres marcas de metadatos en los bytes que se van a subir y,
si aparece alguna, la subida se corta con un mensaje que dice qué hacer. Es el §5
aplicado a una salida binaria: se afirma sobre el **resultado** en vez de sobre la
lista de marcadores, así que un contenedor nuevo o un trailer que todavía no vimos cae
igual, sin que nadie lo haya previsto. Falla cerrado a propósito — una foto que hoy no
se puede subir es un problema de una tarde; una foto con las coordenadas de una casa
particular en el `events.json` no se despublica.

**Consecuencia: solo se pueden subir JPG y PNG.** WebP y AVIF se siguen mostrando —una
externa la sirve su origen y no la tocamos, DEC-7d— pero no se suben, porque sus
contenedores también llevan EXIF/XMP y no hay quien se lo saque todavía. Ningún celular
saca fotos en esos formatos, así que la contra es chica y la alternativa era publicar
coordenadas. Vuelven a entrar con la Function, que recomprime todo.

### 4 · Qué NO trae esta tajada, y por qué se partió

**No trae la Function de DEC-7d**: ni la recompresión, ni la miniatura, ni el segundo
pase de EXIF. Queda en el BACKLOG con su diseño.

Se partió porque las dos mitades juntas eran demasiado para un cambio: la Function
arrastra una dependencia nativa de procesamiento de imágenes en `functions/`, el
emulador de Functions atado al de Storage, el write-back al documento y la guarda
anti-loop —escribir la miniatura en el mismo bucket re-dispara el trigger, que es la
trampa 3 con otra cara—. Y el criterio del repo es preferir **subir imágenes sin
miniatura a no subir nada**.

Lo que sí se hizo, para que la mitad que falta no pueda entrar sin su guarda:
`tests/clases-de-bug.test.ts` descubría los triggers del fuente buscando `onDocument*`
y `onSchedule`, **y nada más**. Un `onObjectFinalized` no habría entrado solo, o sea
que la promesa de la cabecera de ese archivo —«un trigger nuevo entra solo»— era falsa
justamente para el trigger más peligroso que le falta al proyecto. Se agregaron las
cuatro clases `onObject*` al descubridor. Hoy no cambian ningún resultado, y ese es el
punto: es el único momento en que agregarlas es gratis.

### 5 · Lo que se decidió en el camino

**La casilla «las imágenes subidas al panel» del modal de duplicar dejó de mostrarse.**
B-199 la había dejado apagada y con `aplica` escondiéndola, porque no podía existir una
imagen propia. Desde que puede, `aplica` daría `true` y sería una casilla que **no hace
nada**: tildarla no copia el objeto de Storage. Lo que se ofrecía como opción pasó a
`SIEMPRE_AL_DUPLICAR`, que es donde viven los hechos no negociables del duplicado. Una
casilla que miente es peor que una función que falta.

**`allow read` de Storage incluye `list`, y eso era una fuga viva.** Es la **trampa 13**
del §13, que no existía hasta este cambio. La primera versión de las reglas decía
`allow read: if true` bajo `imagenes/`, con el razonamiento de arriba: son imágenes
públicas, no hay nada que esconder. Lo que no se vio es que `read` son **dos**
operaciones, y que la segunda desarma el punto 1 de esta misma decisión: con un
`listAll(ref(storage, 'imagenes'))` **anónimo** se obtenía el bucket entero. Un path
opaco no compra nada si te dan la lista de paths — y adentro están también las fotos de
las actividades que todavía están en borrador. Ahora van separadas
(`allow get: if true`, `allow list: if esAdmin()`), con su caso en el test de
integración. **Se encontró ejecutándolo contra el emulador, no leyendo la regla**, que
es la diferencia entre el test de integración y una revisión.

**El schema acepta `http://` contra `localhost`.** El emulador de Storage sirve por
`http://127.0.0.1:9199/…`, así que sin la excepción una imagen propia subida en
desarrollo no se puede publicar ni para probar el flujo — que es exactamente lo que el
§10 pide hacer contra emuladores. Lo que la excepción habilita en producción es una URL
a `localhost`, o sea una imagen rota en la vista previa del propio panel; `data:` y
`javascript:` siguen bloqueados por el mismo `if`, que era el motivo real de esa
validación.

**No se borra nada de Storage, ni al quitar la fila ni al fallar a mitad de camino.**
Un objeto huérfano cuesta centavos y es invisible; un borrado automático no tiene
papelera de la que sacarlo, y hoy no hay ningún conteo de referencias que diga si ese
archivo lo usa otra actividad. La limpieza queda en el BACKLOG con su criterio
(**B-221**).

**Y esa decisión desactiva sola el sexto campo que B-206 le sumaba a D-124.** El ítem
advertía que un borrador de `localStorage` vive 30 días y que `sinFlagsDePublicacion`
no toca `imagenes`, así que podía volver con un `storagePath` a un objeto ya borrado.
Con «no se borra nada», ese objeto **sigue estando**: el borrador recuperado apunta a
una imagen que existe y se ve. No hizo falta agregar `imagenes` a la poda, y tampoco
subir `VERSION_BORRADOR` —la forma del formulario no cambió, `imagenes` ya estaba— que
es el criterio de D-127: se bumpea cuando hay una forma nueva que hace que lo viejo
*parezca* bueno, no cuando cambia lo que se puede escribir adentro. **Si algún día
B-221 empieza a borrar, esto se reabre**, y queda dicho en ese ítem.

---

## D-132 · La key de CI pasa a poder desplegar todo — se revierte D-119

**Contexto.** D-119, del 2026-08-25, dejó a `deploy-ci@` con tres roles de lectura y
Hosting, y asumió por escrito la contra: dos de los seis jobs de `push-main.yml`
—«Reglas e índices» y «Cloud Functions»— **no podían terminar bien nunca**. Se
anotó como B-194 y se dio por aceptado.

En tres días la contra se cobró lo suyo. El 2026-08-28 se publicó `1.5.0` y el sitio
seguía mostrando `1.4.0`: el job de reglas cortó con 403, el de Hosting tiene
`needs.firestore.result != 'failure'`, y el deploy no ocurrió. **No hubo ninguna
señal de que faltara publicar** —la corrida estaba roja "como siempre"—, así que el
rojo permanente había dejado de significar algo. Lo encontró el dueño mirando la web,
que es el peor lugar donde encontrarlo.

**Decisión.** Se le otorgan a `deploy-ci@` los roles que faltaban para que los seis
jobs terminen bien: reglas, índices, Functions (con su Cloud Run, su Cloud Build, su
Artifact Registry y su Cloud Scheduler) y `iam.serviceAccountUser` sobre las tres
cuentas de runtime. La lista completa está en
[`02-infraestructura.md`](02-infraestructura.md) § "Roles de `deploy-ci@`".

**Lo que esto cuesta, sin suavizar.** Todo lo que D-119 dijo sigue siendo cierto: con
`firebaserules.admin`, una key filtrada **hace legible todo Firestore** —borradores,
`difusion`, `online.url`, uids— porque las reglas del §5.3 son lo único que los
mantiene afuera. Y con `cloudfunctions.developer` + `run.admin` +
`iam.serviceAccountUser` puede desplegar código que corre como `calendar-sync@`. El
argumento de D-119 no se refutó: **se decidió pagarlo**, y la decisión es del dueño
del proyecto.

**Por qué se paga.** Los dos lados del intercambio no son "seguridad contra
comodidad", que sería una mala razón:

| | Con D-119 | Con D-132 |
|---|---|---|
| Radio de la key filtrada | leer lo público, publicar el sitio | reescribir reglas, desplegar código |
| Reglas en producción | las que alguien recordó desplegar a mano | las del repo, en cada push |
| Un push que toca reglas y panel | no publica el panel | publica los dos, en orden |
| Una corrida roja | el estado normal | algo pasó |

Las filas 2 y 4 son las que dan vuelta el balance. Con las reglas a mano, **lo que
protege a Firestore es que alguien se acuerde**, y ya falló una vez: el P0 de B-208
—`/actividades` legible por un anónimo— vivió en producción hasta que un auditor lo
encontró, con la regla correcta ya escrita en el repo. Un rojo que significa algo y
unas reglas que se publican solas cubren un riesgo que ocurre seguido; el radio de la
key cubre uno que requiere que la key se filtre.

**Lo que se hace en consecuencia, y no es opcional.**

- La afirmación de `07-seguridad.md` § "La key" se reescribió en el **mismo** cambio.
  Es lo que D-119 dejó atado y es la mitad del valor de esta decisión: la vez
  anterior el radio cambió y el documento no, y estuvo mintiendo una hora.
- `tests/roles-deploy-ci.test.ts` cambió de propiedad. Ya no exige "ningún rol de
  escritura" —sería exigir que D-132 no exista—, sino algo que sigue teniendo
  sentido: **mientras haya un rol de escritura declarado, el documento de seguridad
  no puede afirmar que el daño se limita a leer.** Las dos listas se siguen atando.
- El runbook de rotación de [`08-operacion.md`](08-operacion.md) pasa a tener un paso
  nuevo y ordenado segundo: **redesplegar `firestore.rules` y `storage.rules` desde
  el repo**. Antes rotar alcanzaba; ahora, hasta que eso se haga, no se sabe qué
  reglas están publicadas.

**Lo que sigue sin tener.** No se otorgó `secretmanager.secretAccessor` (ve los
metadatos, no las versiones), ni escritura de datos en Firestore, ni nada de IAM. No
es una cuenta de owner: es la que hace falta para que el workflow que ya existe
termine.

**Lo que reabriría esto.** Si el proyecto suma gente con acceso al repo, el secret
deja de tener un solo lector y el balance cambia: ahí corresponde volver a D-119 y
partir la key en dos —una de lectura para el build, otra con permiso de deploy y
`environment` con aprobación—. Está anotado como **B-225**.

## D-133 · El texto de «Suscribirse» es data testeada, y ninguna dirección se escribe en el markup

**Contexto.** B-230, 2026-08-28. `/suscribirse` es una página estática de texto: lo
natural era escribirla en el markup, como `index.astro`. Se hizo al revés — el
contenido vive en `src/lib/suscripcion.ts` y la página lo recorre — y conviene dejar
por qué, porque la alternativa era más corta.

**Qué se decidió.**

1. **El contenido va como data**, en registros tipados (`Record<IdCamino, Camino>`,
   `Record<IdAdvertencia, Advertencia>`) más una lista de orden.
2. **Ninguna URL se escribe en la página ni en sus componentes.** Todas salen de
   `src/lib/enlaces.ts` (B-228), y el test barre el markup buscando cualquier
   esquema escrito a mano.
3. **Las promesas que la página hace sobre el calendario se verifican contra la
   función que construye el evento** — el mismo módulo que consume la Cloud
   Function (`functions/calendario.js`), no una copia.

**Por qué.** Esta página no falla rompiéndose: falla dejando un camino a medias, y
todas esas formas de fallar dejan el build en verde.

| Cómo falla de verdad | Qué lo frena |
|---|---|
| se agrega un quinto camino y la página no lo muestra | el tipo obliga a que tenga contenido; la lista de orden y el test obligan a que se muestre |
| un camino queda con el botón y sin los pasos | el test exige pasos en cada uno, y en el de copiar y pegar exige que nombre dónde se pega |
| alguien pega en el markup la variante `private-` del `.ics`, que **da acceso de lectura al calendario entero** | el barrido de markup falla ante cualquier dirección escrita, y el del contenido exige que cada una sea exactamente una de las que `enlaces.ts` produce |
| el enlace `webcal:` deja de avisarle a quien no ve la pantalla que se va a abrir otra aplicación | el aviso es un campo obligatorio del tipo, y el test exige que la única acción que no es `https:` lo nombre |
| el comportamiento del calendario cambia y la página sigue prometiendo lo de antes | los cuatro tests contra `construirEvento`/`planificar` |

La última fila es la que más pesa y es la lección de **B-63**, la misma por la que
cada aviso de `src/lib/ayuda.ts` nombra el test que lo sostiene: un chequeo puede
verificar que el texto **esté**, nunca que sea **cierto**. Acá pesa más todavía,
porque este texto lo lee gente de afuera del proyecto y decide con él si espera el
link de una reunión o si se presenta a un encuentro. Se verificó reintroduciendo el
bug en las dos direcciones: sacándole la guarda de `urlPublica` al evento y dejando
en pie el evento de un encuentro cancelado. Las dos ponen la página en rojo.

**Un detalle del camino de Outlook que vale escribir.** Ese camino **no** lleva un
botón que abra la dirección del `.ics`: abrirla en el navegador **descarga un
archivo**, y ese archivo es exactamente lo que los pasos de ese mismo camino piden no
usar —importarlo copia las fechas de hoy y no vuelve a mirar nunca más—. Un botón ahí
deja el error a un toque de distancia del consejo que dice evitarlo. Va la dirección
escrita, con botón de copiar que **aparece solo si el navegador tiene portapapeles**
(sale del HTML oculto y lo muestra el script), porque un botón que no hace nada es
peor que ninguno y el texto se puede seleccionar igual.

**Lo que esto costó y se aceptó.** Un módulo y tres componentes para una página de
texto. Es más de lo que pide el tamaño de la página y menos de lo que cuesta el
primer camino que se publique sin instrucciones.

**Un hallazgo del camino, que cambió el texto.** El primer borrador decía que el
evento **nunca** trae el link de la reunión, citando el §7.4. Es falso desde D-15:
con `urlPublica: true` el link sale en la descripción, por decisión explícita del
dueño. La página dice «casi nunca» y explica el caso — y el test lo fija en las dos
direcciones, así que el día que se saque esa posibilidad, se pone en rojo y la
página puede volver a prometer «nunca».

---

## D-134 · La página es `/suscribirse` y no `/calendario`, y el bloque de la home queda escrito sin cablear

**Contexto.** B-230, 2026-08-28. [`12-sitio-publico.md`](12-sitio-publico.md) §4.5
diseñó esta página como **`/calendario`**. El encabezado del sitio (B-229, escrito
antes que las páginas justamente para que los tres frentes en paralelo no se
pisaran) ya enlaza **`/suscribirse`**, y el pie también.

**Qué se decidió.** Vale `/suscribirse`, y se anota el desvío en vez de renombrar.

**Por qué.**

- **El enlace ya publicado manda.** Cambiarlo obligaba a tocar `Encabezado.astro` y
  `PieDePagina.astro`, que tienen un solo dueño a propósito, y a hacerlo desde un
  frente que corre en paralelo con otros dos.
- **Nombra la acción y no la cosa.** «Calendario» es lo que hay del otro lado;
  «suscribirse» es lo que la persona va a hacer, y es el único de los dos que
  distingue esta página de la que solo muestra el calendario — que es, además, uno
  de los cuatro caminos de adentro.
- **El slug de una página pública es caro de mover** (trampa 10): mejor decidirlo
  antes de que se indexe, que es ahora.

**Lo que queda pendiente y por qué no se hizo acá.** El bloque corto para la home
—`src/components/sitio/SuscribirseResumen.astro`, con el botón de Google y un enlace
a la página entera— está escrito y **no está cableado**: la home la construye otro
frente y este no la toca. Queda como **B-231**, con el componente ya hecho para que
sea una línea.
## D-135 · La ayuda y el contacto del sitio son datos derivados, no párrafos en la página

**Contexto.** `/ayuda` y `/contacto` (B-232) son las dos primeras páginas del sitio
público que son **texto y nada más**: no leen `events.json`, no tienen island, no
tocan Firestore. El camino corto era escribir los párrafos adentro del `.astro` y
listo — son dos páginas estáticas.

**Decisión.** El contenido vive en dos módulos (`src/lib/ayudaDelSitio.ts`,
`src/lib/contactoDelSitio.ts`) y la página solo lo recorre. Y lo que se puede
derivar, se deriva: el glosario de tipos y el de aranceles salen de
`opciones-base.json`, los motivos de contacto salen de `MOTIVOS_DE_CONTACTO`, y las
rutas a las que la ayuda linkea las verifica el test contra las que declara
`Encabezado.astro`.

**Por qué, y no es una preferencia de estilo.** Un texto en el marcado no se puede
verificar, y acá hay tres cosas que verificar que no se ven mirando la página:

| Riesgo | Qué lo frena |
|---|---|
| Se saca la respuesta que dice por qué el link de la reunión no se publica | la lista `OBLIGATORIAS` del test, con el motivo de cada una |
| Se agrega una categoría base y la ayuda sigue enumerando las de antes | el glosario se deriva de `opciones-base.json`: el test nombra la que falta explicar |
| Un ejemplo bien intencionado publica un link de reunión de verdad | el barrido de centinelas sobre todos los textos |

La segunda ya ocurrió dos veces en el modelo antes de que estas páginas existieran:
`feria` (B-129) y `libreria-a-la-calle` entraron como opción base después del
`CLAUDE.md`, y una lista de cinco tipos escrita a mano en la ayuda habría quedado
vieja **sin que nada fallara**. Es la clase que `05-patrones.md` llama «verificar la
clase, no la instancia»: la lista se deriva del código y lo nuevo entra solo.

**Lo que esto cuesta.** Una indirección para leer el texto: quien quiera cambiar una
frase la busca en el módulo y no en la página. Se acepta porque es exactamente el
mismo trato que ya tiene la guía del panel (`src/lib/ayuda.ts`) y por el mismo
motivo.

**Lo que NO se hizo, a propósito:** unificar los dos módulos con `src/lib/ayuda.ts`.
Comparten la forma —texto como data, testeado— y no comparten nada más: uno le habla
a quien carga actividades desde adentro del panel y el otro a quien busca un taller
desde Google. Unificarlos obligaría a que un cambio de tono en uno pase por el otro.

## D-136 · La ayuda se muestra entera, no en un acordeón

**Contexto.** 20 preguntas en una página. El reflejo es un acordeón: se ve
corto, prolijo y moderno.

**Decisión.** Todo abierto, con encabezados jerárquicos, un índice arriba y un ancla
estable por pregunta (`/ayuda#a-la-gorra`).

**Por qué.** El uso principal de una página de ayuda **no es leerla entera**: es
mandarle a alguien el link de una respuesta puntual, o caer en ella desde una
búsqueda. Las dos cosas se rompen o se degradan con un acordeón — se aterriza sobre
un título plegado — y encima hay que adivinar en cuál de los cinco grupos está la
respuesta antes de poder buscarla. Con todo abierto, el buscador del navegador
encuentra cualquier palabra y el ancla lleva al texto ya visible.

**El argumento en contra, que es real:** en un teléfono la página es larga. Se
compensa con el índice de cinco grupos arriba, que es un salto y no una lista de
20. Si algún día las preguntas se duplican, lo que corresponde es partir la
página por tema, no plegarla.

**Consecuencia de accesibilidad, y es la mitad del motivo:** sin acordeón no hay nada
que abrir, así que no hay estado, ni JavaScript, ni un patrón de `aria-expanded` que
implementar mal. La página funciona igual con JavaScript apagado, que es lo que el
§2.3 pide del sitio público.
---

## D-137 · El listado público **sí** tiene selector de orden — desvío del §6.1 del diseño

`docs/12-sitio-publico.md` §6.1 cierra la lista de filtros con una línea tajante:
«**No hay selector de orden**: no hay un segundo orden que alguien pida (¿por
precio? no hay precio; ¿por relevancia? es una lista de 40 cosas)».

El sitio construido en **B-227** tiene tres órdenes. El desvío es a pedido del
dueño, y el argumento del diseño resulta incompleto por un motivo concreto: las
dos alternativas que evaluó —precio y relevancia— son las dos que **derivan del
contenido**, y la que falta deriva de **cuándo se cargó**.

| Orden | Qué pregunta contesta | Por qué el orden cronológico no puede |
|---|---|---|
| `proxima` (**default**) | «¿qué se viene?» | — |
| `nuevas` | «¿qué se sumó desde la última vez que miré?» | una actividad cargada hoy para diciembre queda **al fondo** de la lista cronológica: es la más nueva y la última que se ve |
| `titulo` | «¿dónde estaba aquella que vi?» | volver a encontrar algo visto no tiene nada que ver con su fecha |

El recorrido C del §1 —«el que vuelve»— es exactamente el que usa los filtros, y
`nuevas` es la única forma de contestarle. Con 40 actividades el orden
cronológico ya no alcanza para eso.

**Lo que se conserva para que el desvío sea barato:**

1. **El default sigue siendo `proxima`.** El HTML que imprime el build, lo que ve
   Google y lo que ve alguien sin JavaScript no cambian: el selector es del
   cliente y arranca en el orden de siempre.
2. **La agrupación por mes se apaga con los otros dos órdenes.** Un separador
   «Septiembre» encima de una lista alfabética miente, y mentir con una etiqueta
   es peor que no tenerla. Lo decide quien llama a `agruparPorMes`, no la
   función — así se testea por separado.
3. **El orden viaja en la URL** (`?orden=nuevas`) como los filtros, y la home
   sigue canonizando a `/` sin query.

`nuevas` es la que obligó a agregar un campo a la proyección pública: ver
**D-138**.

## D-138 · `creadoEn` es público — la fecha de alta, no la de edición

Para ordenar por «Recién agregadas» hace falta un dato que hasta B-227 no salía:
cuándo se cargó la actividad. Se agrega `creadoEn` a `toPublic` y al índice, **como
`AAAA-MM-DD`**.

**Por qué es publicable.** Lo que el §5.1 mantiene afuera del creador es su
**identidad**: `createdBy`/`updatedBy` son uids, y hasta la `huellaCreador` de una
opción de taxonomía queda afuera aunque no sea un uid (D-27). *Qué día* se cargó
algo que ya es público no dice nada de nadie: no identifica, no correlaciona y no
se puede revertir a una persona. El §11.2 del diseño del sitio ya contemplaba
publicar `updatedAt` con el mismo criterio, para el `lastmod` del sitemap.

**Por qué el día y no el instante, que es la parte que se decidió mal primero.**
La versión original publicaba el ISO completo, y el `auditor-privacidad` lo marcó:
con **un solo admin**, un `events.json` con `"creadoEn":"2026-08-27T03:14:52.881Z"`
en cada actividad **no es una fecha, es la agenda de trabajo de una persona
identificada** — a qué hora carga, qué noches, en qué tandas. Es exactamente el
razonamiento por el que D-57 rechaza el hash del mail («con dos admins conocidos,
un hash se revierte probando dos entradas») y por el que D-27 saca `huellaCreador`
de la salida: el dato no nombra a nadie, pero con un universo de una persona la
desanonimización es gratis.

Y el único consumidor no necesitaba nada de eso: ordenar por día alcanza, y dos
actividades cargadas el mismo día desempatan por título. Vale anotar la forma del
error, porque es la que se repite: **la decisión no era «¿sale este campo?» sino
«¿con cuánta precisión sale?»**, y la primera se contestó con cuidado mientras la
segunda no se contestó nunca. La regla de siempre —se publica lo que el sitio
necesita, no lo que el documento tiene— aplica también a la precisión.

**Por qué `updatedAt` NO sale, y esto es la mitad que importa.** Son dos datos
distintos con dos consumidores distintos:

| | Qué dice | Quién lo pide |
|---|---|---|
| `creadoEn` | cuándo entró al sitio | el orden «Recién agregadas» (D-137) |
| `updatedAt` | cuándo se tocó por última vez | el `lastmod` del sitemap (§11.2 #3), que **todavía no existe** |

Publicar el segundo «porque ya que estamos» convertiría cada corrección de un
typo en «actualizado hoy», que es ruido presentado como información fresca. Y
sería publicar un campo sin consumidor, que es exactamente lo que la whitelist de
`toPublic` existe para evitar. Cuando el sitemap lo necesite va a ser una línea,
con su propia decisión.

**El default de lectura.** `aIsoSeguro` devuelve `''` con cualquier cosa que no
sea una fecha usable, y no es paranoia: un documento **recién armado por
`formADocumento`** tiene el *sentinel* de `serverTimestamp()` en `createdAt`, que
no tiene `toDate()` porque el `Timestamp` recién existe cuando el servidor lo
resuelve al escribir. Sin ese default, `toPublic` tiraba sobre un documento que el
panel produce todo el tiempo — lo agarró `tests/modalidades.test.ts` en la primera
corrida. Vacío ordena al fondo de «Recién agregadas», que es lo mismo que pasaba
antes de que el orden existiera (D-26).

Como el valor es una fecha, **el barrido de centinelas no lo puede ver** —un
`Timestamp` no lleva un centinela adentro, igual que las fechas de las modalidades
de B-224—, así que el campo tiene casos nombrados en `tests/toPublic.test.ts` y en
`tests/eventsJson.test.ts`, en las dos direcciones: que `creadoEn` salga (con el
día y sin la hora) y que la fecha de edición no. Y una celda más, que también
estaba resuelta por omisión: **la página de detalle no publica ninguna de las dos**
—no las necesita— y eso lo afirma `tests/detallePublico.test.ts` buscando los dos
valores del fixture en la salida.

## D-139 · El link de la reunión tampoco sale a la página de detalle

**Es más estricto que D-15**, y conviene tener el mapa completo de una vez porque
ahora son cinco celdas y ninguna se deduce de las otras:

| Salida | ¿Sale `online.url` con `urlPublica: true`? | Por qué |
|---|---|---|
| 1a · `events.json` (proyección `toPublic`) | **sí** | D-15: el modelo tiene el flag y el formulario su casilla; ignorarlo era prometer algo que no pasaba |
| 1b · el **índice** del listado | **no** | D-129: la tarjeta no tiene botón «Unirse», y servirlo en lote en un solo GET es lo que hace barato el zoombombing |
| 1c · la **página de detalle** | **no** | **esta decisión** |
| 1d · el **JSON-LD** de esa página | **no** | §5.4 del diseño: «el HTML muestra lo que el dueño eligió; el JSON-LD no» |
| 2 · el evento de Calendar | **sí** | D-15, igual que 1a |
| 3, 4, 5 · issue, GA4, posteo | **no, nunca** | cada una por su motivo (ver `07-seguridad.md`) |

El argumento de D-129 para el índice era «en lote y en un solo GET». Acá es otro y
es más fuerte: **la página de detalle es la superficie que Google indexa**. Un
link de reunión en un HTML indexado no se despublica —queda en el índice, en la
caché y en cualquier scraper que haya pasado— y el link se manda al inscribirse,
que es para lo que está el botón que la página ya tiene arriba.

**La contra, dicha:** el dueño tildó una casilla que dice «publicar el link en el
sitio» y el sitio no lo publica. Es una inconsistencia entre lo que la casilla
promete y lo que pasa, y se elige a propósito el lado del que se puede volver:
mostrar el link mañana es una línea; sacarlo de Google no. Si el dueño lo quiere a
la vista, la conversación es sobre el texto de la casilla —que hoy nombra «el
sitio»— y no sobre agregar un `?.url` sin ruido. Queda anotado en **B-240**.

## D-140 · La plantilla no recibe el documento: recibe un view-model

La página de detalle (`src/pages/actividad/[slug].astro`) es la primera salida
pública que es una **página** y no un archivo de datos, y eso rompe dos cosas que
las otras cuatro daban por sentadas:

1. **Un `.astro` no se puede importar desde vitest.** No hay forma de renderizarlo
   en un test, así que el barrido de centinelas —que necesita un valor sobre el
   cual afirmar— no tenía dónde agarrarse.
2. **Una plantilla interpola.** Si tiene el documento en la mano, publicar un
   campo de más es un `{a.online.url}` que se lee bien y que nada frena.

La decisión: **la frontera de privacidad es un tipo, no la disciplina de quien
escribe la plantilla.** `src/lib/detallePublico.ts` decide, campo por campo, qué
muestra la página, y `getStaticPaths` le pasa **solo** ese `DetallePublico`. La
plantilla no tiene la `ActividadPublica` ni el documento: no puede publicar
`online.url` porque no lo tiene.

Lo que eso compra, y que ninguna otra forma daba:

| | Cómo |
|---|---|
| la salida es barrible | `tests/barrido-de-salidas-publicas.test.ts` corre sobre el view-model, con control negativo |
| la plantilla no se escapa | `tests/pagina-de-detalle.test.ts` lee el `.astro` y falla si aparece una segunda prop o el nombre de un campo privado |
| el `where` del §5.3 es testeable | `getStaticPaths` delega en `caminosDeDetalle` (`lib/contenidoDelSitio.ts`), que sí se importa desde un test de integración |

Es la cuarta proyección en serie sobre el mismo documento —`toPublic` →
`entradaDeIndice` → `opcionesPublicas` → **`detalleDeActividad`**— y como el
índice, recorta una `ActividadPublica` y no una `Actividad`: no puede publicar
algo que la frontera ya descartó, porque no lo recibe.

**El costo, dicho:** hay un tipo más que mantener, y un campo nuevo que la página
quiera mostrar hay que agregarlo en dos lugares (la proyección y la plantilla). Es
el mismo costo que `toPublic` ya paga por enumerar en vez de hacer `pick`, y por
el mismo motivo: se paga cuando se agrega algo, no cuando se filtra algo.

---

## D-141 · El sitio se llama Agenda LEH, y el color del tipo se deriva del slug

**Contexto.** El dueño lo dijo así: «el nuestro no tiene identidad ni nada», pidiendo
que el sitio se parezca a Eventbrite. La causa no era del todo estética. El nombre
estaba **decidido desde el 2026-08-27** —«Agenda LEH — Leer, Escribir, Hacer», DEC-6,
elegido justamente para desbloquear el dominio y los metadatos— y **no se había usado
en ninguna parte**: ocho lugares del sitio repetían «Agenda literaria», que es la
categoría del sitio y no su nombre. Un sitio que se presenta con su categoría no
puede tener identidad; el diseño encima de eso no la iba a dar.

**Decisión 1 — el nombre vive en un módulo y se interpola.** `src/lib/identidad.ts`
exporta `NOMBRE`, `BAJADA`, `NOMBRE_COMPLETO` y `QUE_ES`. Ocho literales sueltos son
ocho lugares donde el nombre puede quedar viejo, y ya habían quedado viejos los ocho
a la vez. `tests/identidad.test.ts` exige que toda página se titule con el nombre.

En la home el nombre va **al final** del título y las palabras que se buscan
adelante: quien tipea «taller de escritura buenos aires» no conoce el nombre todavía,
y en un resultado de Google el título se corta por la derecha.

**Decisión 2 — la dirección visual es la estructura de Eventbrite con paleta
propia.** Se adoptan sus patrones —grilla de tarjetas con portada, chips de
categoría, jerarquía fuerte, CTA fijo en móvil— y **no** su temperatura. El papel
cálido y la tinta azulada eran una decisión, no un descuido: lo que faltaba era
jerarquía y densidad, no saturación. La paleta se amplía con tres niveles de
superficie (`papel`, `crema`, `hondo`) para poder apilar una tarjeta sobre el fondo
**sin sombras**, que es lo que da el aire de plataforma genérica.

**Decisión 3 — cuando no hay imagen, la portada se genera**, con el título sobre un
color derivado del tipo. Es lo que evita el hueco gris: en este circuito muchas
actividades no van a tener foto, y una grilla con la mitad de los huecos vacíos se ve
rota. La alternativa —exigir imagen para publicar— se descartó: agrega fricción a
quien carga y frena publicaciones.

**Y el color del tipo se deriva del slug, no se elige de una tabla.** Acá está el
razonamiento que importa, porque es el que no se ve. `tipo` es una **taxonomía
autogestionada** (§4 del `CLAUDE.md`): quien carga puede crear un tipo nuevo desde la
casilla «Otro». Una tabla de siete colores escritos a mano queda vieja **el mismo
día** que alguien agregue el octavo, y el modo de falla es silencioso — el tipo nuevo
cae en un gris de descarte, sus tarjetas se ven roídas, y nada falla.

Entonces: los siete de hoy tienen tono asignado —para que «taller» sea siempre el
mismo color y la gente lo aprenda— y cualquier otro **deriva su tono del slug**, de
forma determinística y empujado para no caer a menos de 18° de un tono ya asignado.

**La luminosidad y el croma son fijos para todos los tipos**, y eso no es estética:
es lo que permite **garantizar el contraste de una sola vez**. Como varía solo el
matiz, el test no verifica los siete tipos de hoy —eso dejaría la garantía en «los
que ya vimos»— sino **los 360 tonos posibles**. El peor de los 360 da 7,21:1 contra
un piso de 4,5. O sea: la portada de un tipo que alguien invente el año que viene
está garantizada legible, y si algún día alguien aclara la banda, el test lo dice.

**Lo que esto NO decide.** El dominio sigue sin registrar, así que no hay `site`, ni
canonical, ni Open Graph, ni sitemap: es B-109 y sigue abierto. DEC-6 pedía además
decidir **qué parte del nombre va en la URL**, y sigue pendiente.
