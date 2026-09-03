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

**Por qué ISO y no milisegundos:** antes de que existiera la pantalla de
historial (B-40), el historial se leía desde la consola de Firestore, donde el
id es todo lo que se ve de un documento — y el ancho fijo seguía importando
igual una vez que hubo pantalla, porque `listarVersiones` ordena por el id del
documento (D-43 en `src/lib/historial.ts`), no por un campo separado. Al ser de
ancho fijo, el orden lexicográfico de los ids es el orden cronológico — de eso
depende la poda de D-42 y el orden que ve la pantalla.

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

---

## D-190 · La cuenta del encuentro se comparte; la puerta de si se muestra, no

**Contexto (B-163).** El número del encuentro —"Encuentro 3 de 8"— sale en dos
pantallas: la descripción del evento público (`posicionEnCiclo`) y el "3 de 8"
de la vista calendario del panel (`encuentrosDe`, D-70). Cada lado **ordenaba
las sesiones y contaba por su cuenta.** Coincidían, pero porque los dos habían
llegado al mismo criterio, no porque fuera el mismo código: es la forma exacta
que D-71 y D-20 evitan, y es la que produjo B-84 — el día que uno cambió, el
panel dijo "6 de 8" y el evento "5 de 7" para el mismo encuentro, y no falló
nada.

**Decisión: se parte en dos, y solo una mitad se comparte.**

| | Qué es | Dónde vive |
|---|---|---|
| **La aritmética** | `{ indice, total }` por fecha, contando todas las sesiones (D-95) | `numeroDeEncuentro`, exportada de `@calendario`, y el panel la importa |
| **La puerta** | ¿el evento muestra el número? | `elEventoNumeraElCiclo`, exportada y con nombre: `esCiclo` tildado y ≥ 2 sesiones |

**Motivo de compartir la aritmética:** es un derivado del documento, tiene una
sola respuesta correcta, y la copia es indetectable — dos implementaciones que
hoy dan lo mismo no rompen ningún test de comportamiento el día que una cambia.
Por eso además de compartirla hay un chequeo **estructural** en
`tests/clases-de-bug.test.ts` que lee el fuente del panel: pide que importe
`numeroDeEncuentro` y prohíbe las dos formas de la copia vieja
(`total: ordenadas.length`, `indice: i + 1`). Es la tercera instancia de la
clase que ese archivo ya persigue.

**Motivo de NO unificar la puerta:** las dos pantallas muestran el número con
criterios distintos —el panel numera cualquier actividad de más de una sesión,
el evento solo un ciclo declarado— y **elegir uno es una decisión de producto,
no una cuenta duplicada.** Las dos salidas no cuestan lo mismo:

- *que el evento numere con más de una sesión aunque no sea ciclo:* cambia el
  texto de los eventos **ya publicados** de esas actividades. Es el argumento de
  D-95 y B-84 otra vez: a quien los tiene agendados se le reescribe el evento sin
  que nada haya cambiado para él;
- *que el panel deje de numerar sin `esCiclo`:* no toca nada publicado, pero
  devuelve el problema que la regla 1 de D-70 resuelve — varias filas con el mismo
  título se leen como varias actividades.

Queda en B-163, y ahora elegir es una línea en un solo lugar.

**Un cambio de comportamiento, chico y en un caso que el schema rechaza.** La
cuenta compartida mira el array **completo**; `encuentrosDe` descarta de la
**vista** las sesiones sin fecha usable para no dejar el calendario en blanco.
Antes esas sesiones tampoco entraban en el total y el panel decía "1 de 1"
mientras el evento de ese mismo encuentro decía "2 de 2". Ahora no se pintan pero
**cuentan**, que es lo que coincide con lo que la gente tiene agendado. Sesión sin
fechas es un documento que el schema rechaza en los dos niveles, así que solo se
llega editando Firestore a mano.

`numeroDeEncuentro` además tolera Timestamp, `Date`, número y string (el helper
`milisDe`, mismo criterio que `fecha` y que el `milis` de `rebuild.js`): el módulo
lo comparte el panel por `@calendario` y no puede suponer que del otro lado hay un
Timestamp de Firestore. La versión anterior contaba cualquier otra cosa como `0` y
la ponía primera.

**Alternativas descartadas:**

- *Unificar también la puerta, eligiendo la del evento.* Es tomar la decisión de
  producto de arriba por su lado técnico, y encima la barata para el código: el
  panel pierde el número y nadie decidió eso.
- *Guardar `indice`/`total` como campos de la sesión.* Estable ante cualquier
  edición, pero es un cambio de modelo (§3.1) que se propaga al formulario, al
  generador de encuentros y a la proyección pública, para algo que se resuelve
  derivándolo en un solo lugar. Es la misma alternativa que D-95 ya descartó.

---

## D-191 · Un evento que falta en Calendar se repone; un 404 al crear es un error

**Contexto (B-125).** El §2.1 dice que Calendar es un espejo de solo lectura y que
editarlo a mano no es un caso soportado: un cambio hecho allá se pierde en el
próximo sync, y eso es lo esperado. Lo que **no** era esperado es que un
**borrado** hecho a mano no se recuperara nunca.

El `catch` de `syncCalendar` tenía una sola condición: 404 o 410 **en un borrado**
limpiaba el id; todo lo demás era `logger.error`. Así que si alguien borraba a mano
el evento de un encuentro publicado, el documento se quedaba con su
`calendarEventId`, el diff seguía viendo un id y emitía `actualizar`, Calendar
contestaba 404 y eso caía en el `else`. **El id no se limpiaba, así que cada
edición siguiente repetía la misma operación imposible:** el encuentro
desaparecía del calendario público para siempre, y la vista calendario del panel
seguía diciendo "En el calendario" porque el id estaba ahí (D-71).

**Decisión:** el `catch` consume `decidirAnteFallo(op, code)` —pura, en
`functions/sincronizacion.js`— con tres salidas:

| Operación | 404 / 410 | Qué se hace |
|---|---|---|
| `borrar` | el evento ya no estaba | `limpiar-id`: es el resultado buscado, y se limpia el id colgado |
| `actualizar` | lo borraron a mano | **`recrear`**: `debeExistir` ya dijo que ese encuentro tiene que estar (§7.3) |
| `crear` | — | `registrar-error` |
| cualquiera | cualquier otro código | `registrar-error` |

**Por qué recrear y no solo limpiar el id.** Limpiar el id dejaría que la
**siguiente** escritura emita `crear`, o sea que el encuentro volvería una edición
más tarde. Recrear en el acto lo repone en la misma pasada y no depende de que
alguien vuelva a guardar. Pasa por `crearEvento`, así que hereda el id derivado y
el 409 de B-82: el evento vuelve con el id que le corresponde y el write-back lo
deja en el documento.

**Por qué un 404 al crear sigue siendo un error, y es la parte que importa de la
tabla.** Ahí "no está" no habla del evento: habla del **calendario**. Es un
`GOOGLE_CALENDAR_ID` equivocado, o un calendario que no está compartido con la
service account (D-06). Recrear en loop no lo arregla, y taparlo como aviso
esconde el único error que hay que mirar. Es el mismo criterio con el que el
límite de reintentos del rebuild distingue "falló" de "no está configurado"
(D-23).

**No cierra B-125.** La otra mitad del ítem es enterarse **sin editar nada**, y
eso pide leer la API de Calendar desde el panel o desde un script — que hoy no
tiene con qué autenticarse, porque la identidad es de la Function (D-06). Lo que
cambia es que el estado dejó de ser permanente: cualquier edición de la actividad
lo repara.

**No reescribe ningún evento ajeno:** repone el que faltaba y nada más. El
`actualizar` que disparó la reposición ya iba a ocurrir por el cambio que lo
originó.


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
que Firestore es la única fuente de verdad. Anotado en **B-125**.

> **Dos correcciones, del 2026-09-02.**
>
> La primera es de referencia: acá decía "anotado en B-127", que es otro ítem
> (las cinco suscripciones de `useLabelsTaxonomia`). El ítem de este límite
> siempre fue **B-125**.
>
> La segunda es del límite en sí, y es la que importa: **"hasta la próxima
> edición" era falso cuando se escribió.** El párrafo prometía que el estado se
> curaba solo al editar la actividad, y no se curaba: el `catch` de
> `syncCalendar` no limpiaba el id de un `actualizar` que fallaba, así que cada
> edición volvía a emitir la misma operación contra un evento inexistente y el
> encuentro quedaba fuera del calendario público **para siempre** (ver D-191).
> Desde ese arreglo la frase es cierta —el evento se recrea en la próxima
> escritura— así que el límite quedó reducido a lo que dice el título: el panel
> muestra lo que cree Firestore, y **sin editar nada** nadie se entera.
>
> Vale como patrón, porque es peor que un drift común: la doc no describía el
> comportamiento con optimismo, describía un comportamiento que **no existía**, y
> era justo la mitad tranquilizadora de un límite conocido. Un límite que se
> escribe junto con su consuelo es un lugar donde conviene verificar el consuelo.

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

> ⚠️ **El descarte de `arancel` se revirtió el 2026-09-01 — ver D-152.** Hoy los
> filtros son **seis**. El argumento de abajo no se borra ni se corrige: sigue
> siendo cierto para la pregunta que contestaba («nadie *busca* el taller
> arancelado»), y lo que cambió es que se pide contestar otra. D-152 dice cuál, qué
> se paga por revertir, y qué pasó con los otros tres descartes — el de `tags`
> caducó a medias y el de `destacado` entero (**B-274**).

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
hace recuperable el borrado y lo que B-89 sigue sin resolver: la pantalla de
restauración (B-40) ya existe, pero se abre desde la fila de una actividad viva
en el listado, y una actividad borrada no tiene fila. Borrarla en el mismo
trigger sería tirar justo lo que se acaba de guardar.

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
testing-library — que en ese momento no estaba instalada; desde B-08 sí, pero
angosta y para otro caso (el cableado de `MenuAcciones`), y esto sigue sin
necesitarla: es una pregunta pura. `tests/taxonomia.test.ts` cubre
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
B-81, el saneador va en la salida y no campo por campo. (Y desde **B-137** /
D-197 esa lección está aplicada también donde nació: `construirIssue` sanea el
`title` y el `body` ya armados, no los cinco campos de la entrada.)

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

> **Resuelto en B-177 (D-187, 2026-09-02): el párrafo de arriba ya no es cierto y
> se deja para que se lea contra su original.** El aviso se muestra en pantalla,
> arriba de la vista, y **nombra la etiqueta** que no quedó — para eso
> `etiquetasSinRegistrar` pasó de `boolean` a la lista de labels. Lo encontró el
> `auditor-documentacion`, y es el patrón de B-56: una decisión que describe el
> estado del mundo («hoy nadie lo muestra») envejece cuando el ítem que nombra se
> cierra, y nada falla.

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

**Decisión:** `src/lib/formulario/guardar.ts` recibe sus seis escrituras
(`slugDisponible`, `upsertOpcion`, `upsertOpciones`, `registrarUsos`,
`crearActividad`, `actualizarActividad`) como un objeto de puertos, con
`puertosFirestore` como default.

> Decía «cinco» y no listaba `registrarUsos`, que entró con B-168/B-86 el
> 2026-08-25. Corregido el 2026-09-02, lo encontró el `auditor-documentacion`.
> Que el número quedara viejo importa más de lo que parece: este documento es lo
> que se lee para saber **qué escrituras** hay que poder falsear al testear el
> orden, y un puerto que no figura es un puerto que un test nuevo no va a mockear.

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

**Lo que quedó pendiente y por qué no se hizo acá.** El bloque corto para la home
—`src/components/sitio/SuscribirseResumen.astro`, con el botón de Google y un enlace
a la página entera— quedó escrito y **sin cablear**: la home la construía otro
frente y este no la tocó. Era **B-231**, con el componente ya hecho para que fuera
una línea.

> **Cableado el 2026-09-01 — B-231.** `src/pages/index.astro` lo importa y lo
> renderiza abajo del listado, después de la tira de meses. La línea era una, pero
> el ítem tenía tres decisiones adentro y las tres están en la sección de la home
> de [`04-funcionalidades.md`](04-funcionalidades.md): fuera del contenedor que la
> island reemplaza —adentro lo vería solo quien tiene JavaScript apagado—, visible
> también con el listado vacío o filtrado a cero —que es cuando más sirve: la
> alternativa que se ofrece hoy es «volvé en unos días»— y a lo ancho de `main`,
> sin la sangría del riel, porque habla de la agenda entera y no del listado
> filtrado. `tests/suscribirse.test.ts` las fija, incluida la que frena la
> duplicación el día que otra página quiera el mismo bloque.
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
ahora son **seis** celdas y casi ninguna se deduce de las otras:

| Salida | ¿Sale `online.url` con `urlPublica: true`? | Por qué |
|---|---|---|
| 1a · `events.json` (proyección `toPublic`) | **sí** | D-15: el modelo tiene el flag y el formulario su casilla; ignorarlo era prometer algo que no pasaba |
| 1b · el **índice** del listado | **no** | D-129: la tarjeta no tiene botón «Unirse», y servirlo en lote en un solo GET es lo que hace barato el zoombombing |
| 1c · la **página de detalle** | **no** | **esta decisión** |
| 1d · el **JSON-LD** de esa página | **no** | §5.4 del diseño: «el HTML muestra lo que el dueño eligió; el JSON-LD no» |
| 2 · el evento de Calendar | **sí** | D-15, igual que 1a |
| 3, 4, 5 · issue, GA4, posteo | **no, nunca** | cada una por su motivo (ver `07-seguridad.md`) |
| 7 · la **cartelera** | **no** | la única que **sí** se deduce, y por construcción: proyecta el `DetallePublico` de 1c, que ya lo descartó. Agregada en B-265; lo fija el barrido de la salida 7, que corre también con `urlPublica: true` |

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

> ✅ **Las dos cosas se resolvieron el 2026-09-02.** «Qué parte del nombre va en la
> URL» es `agendaleh` —el dominio es `agendaleh.ar`— y con él se cerró B-109:
> `site`, canonical absoluto, Open Graph, sitemap, robots y `/pasadas`. Ver
> **D-165**.

## D-142 · La tarjeta pasa a grilla con portada, y cuando no hay imagen la portada se genera

**Contexto.** D-141 decidió la dirección —la estructura de Eventbrite con paleta
propia— y dejó anotado que «cuando no hay imagen, la portada se genera». Esto es esa
decisión bajada a la tarjeta, y **se desvía de dos párrafos del diseño de B-227** que
conviene dejar escritos porque siguen ahí:

> §4.2 de [`12-sitio-publico.md`](12-sitio-publico.md): «Sin imagen no hay hueco
> gris. La tarjeta sin `imagenUrl` no reserva la columna: el texto ocupa todo el
> ancho y el título sube un escalón de tamaño».
>
> §7.6: «No hay placeholder gris, ni ícono, ni iniciales. (…) La lista queda con dos
> ritmos de tarjeta, y está bien: es una lista de papel, no una grilla de Instagram».

**Eso era correcto y dejó de serlo, y el motivo es la grilla.** En una lista vertical
de una columna, una tarjeta horizontal sin la columna de la imagen se lee como otra
tarjeta: los dos ritmos conviven porque el ancho es el mismo y el ojo baja en línea
recta. En una grilla de tres columnas no hay dos ritmos posibles — las celdas tienen
el mismo alto —, así que la mitad sin portada queda como una fila de rectángulos
mochos. La alternativa que el §7.6 rechaza («ni ícono, ni iniciales») sigue
rechazada: **no se pone un placeholder, se pone una portada**.

**Qué la hace una portada y no un relleno.** Tres cosas, y las tres son
determinísticas a partir del tipo:

| Qué | Cómo | Por qué |
|---|---|---|
| el color de fondo | `colorDeTipo(slug)` | derivado del slug, no de una tabla: `tipo` es taxonomía autogestionada (§4) y una tabla de siete queda vieja el día que aparece el octavo, en silencio (D-141) |
| el cuerpo del título | `escalaDePortada`, cuatro escalones por largo | un título de una palabra y uno de doce no pueden ir al mismo cuerpo: con uno solo, el primero queda perdido en el medio del rectángulo y el segundo no entra |
| el motivo | `renglonesDePortada`, renglones de anchos derivados del **mismo tono** | le da carácter propio a cada tipo sin inventar un segundo color, y sembrarlo con `tonoDeTipo` evita una segunda derivación de «qué le toca a este slug» (clase de B-88) |

**Y el título aparece dos veces a propósito**: en la portada y en el `<h3>` del
cuerpo. No es una duplicación que se pasó por alto — es lo que hace un afiche, y un
afiche con el título es justamente lo que la tarjeta con foto también tendría. Para
lector de pantalla **no** se dice dos veces: el arte va `aria-hidden` y la foto con
`alt=""`, porque ninguno de los dos aporta nada que el texto de la tarjeta no diga
ya. Lo que sí queda **fuera** del arte es la píldora del tipo, que es información y
no decoración.

**La jerarquía del cuerpo es qué / cuándo / dónde / cuánto**, que es lo que alguien
decide mirando una tarjeta. La fecha sigue yendo primero y en Inter (§4.2), el
arancel se apoya al pie con `mt-auto` para que quede a la misma altura en toda la
fila —se compara de un barrido vertical—, y «a la gorra» se pinta con el acento
igual que «gratis»: es la mitad de los casos del circuito y no entra en el binario
gratis/pago (§4.1 del `CLAUDE.md`).

**Lo que dice la tarjeta no vive en el componente.** Está en `src/lib/tarjetaPublica.ts`,
puro y testeado, porque los componentes de React de este repo no tienen tests de
render (`docs/05-patrones.md`): una frase escrita adentro del `.tsx` no se verifica en
ninguna parte, y las frases en juego son del dominio —el verbo del ciclo cambia con el
reloj de quien mira, el orden entre «cerraron» y «cupo completo» decide si se invita a
una lista de espera que ya no existe—.

**Una columna en el teléfono sigue en pie.** El §8 dice «nada de grilla de dos
tarjetas en 375px» y eso no cambió: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`, con
un test que lo fija.

## D-143 · Los filtros de móvil: lo que se puede tener sin construir una capa modal

**Contexto.** El §8 del diseño pide una **hoja inferior** para los filtros en móvil.
**B-238** la dejó abierta con un argumento que sigue siendo bueno: una hoja es una
capa modal, y una capa modal mal hecha es peor que no tenerla —necesita trampa de
foco, `Escape`, cierre tocando el fondo, devolver el foco al abridor y `pushState`
para que el botón atrás del teléfono la cierre en vez de salir del sitio—.

**Decisión: no se construye la capa, se ataca el problema que la capa resolvía.** El
problema es medible y no necesita una hoja: cuántos píxeles hay entre el borde de
arriba y la primera tarjeta. Tres cambios, ninguno de los cuales puede salir mal:

1. **Arriba queda el buscador y una fila de botones**, nada más. «Cuándo» era un
   `select` con su etiqueta ocupando un tercio del ancho y se fue **adentro** del
   panel, que es donde viven los otros filtros y donde el contador del botón ya lo
   cuenta.
2. **El panel abierto está topeado a `65svh` con scroll propio** en el teléfono, así
   que el arranque de la grilla nunca queda fuera de la pantalla. `svh` y no `vh`:
   en un navegador móvil con barra retráctil, `vh` mide la pantalla sin la barra y el
   panel termina más alto que el hueco real.
3. **Cierra desde abajo con «Ver N actividades»** y el foco vuelve al botón que lo
   abrió. Es la parte de la hoja inferior que sí se puede tener sin ser modal: quien
   terminó de tocar chips está al final del panel, y volver arriba a buscar el botón
   es el paso que sobra.

**B-238 sigue abierto** y con su alcance recortado a lo que de verdad falta: la capa
modal y el CTA fijo del detalle.

**Y de paso, el chip elegido dejó de mentir.** B-227 lo pintaba `bg-acento/10
text-acento`, que sobre la superficie `hondo` da **4,38:1** contra un piso de 4,5 —y
se ve perfecto, que es el modo de falla de B-235 otra vez—. Ahora va lleno
(`bg-acento text-papel`, 5,59:1), que además es cómo se ve un control elegido en una
plataforma y no un link subrayado. El número lo verifica
`tests/listado-del-sitio.test.ts`, que es el chequeo que faltaba: el de B-235 barre
`src/pages` y `src/components/sitio`, mide solo `text-tinta/NN` y solo sobre `papel`,
y la grilla no cumple ninguna de las tres cosas.
---

## D-144 · La portada va arriba, y el §4.3 del diseño se desvía por una condición

**Contexto.** D-141 adoptó la **estructura** de Eventbrite, y esa estructura empieza
con la portada: imagen, después título y datos duros juntos. El §4.3 de
[`12-sitio-publico.md`](12-sitio-publico.md) decía lo contrario, y con un buen
argumento:

> **La imagen no es hero.** Un flyer vertical de Instagram como cabecera empuja la
> fecha fuera de la pantalla en un teléfono. Va en su lugar del flujo.

**El argumento sigue siendo cierto, y no se descarta: se le saca la premisa.** Lo que
empuja la fecha fuera de la pantalla no es que la imagen esté arriba — es que **su
alto lo decida la imagen**. Un flyer de 1080×1350 en una pantalla de 375px de ancho
mide 469px de alto y se come la mitad de un teléfono.

**Decisión: la portada va arriba con relación de aspecto fija** —`aspect-portada`, el
token `--aspect-portada` de B-249— y `object-cover`. El alto de la caja pasa a
depender del ancho de la pantalla y no del archivo que subió quien organiza, así que
un flyer vertical se recorta en vez de empujar. En 375px la portada mide 211px y la
ficha entra en la primera pantalla.

**La proporción sale del token y es la misma en todos los anchos, a propósito.** Es la
misma imagen que muestra la tarjeta del listado: dos recortes distintos hacen que la
foto que se veía bien en la grilla aparezca cortada al abrirla, y con la portada
generada —cuyo título va **dentro** del recorte— serían además dos tamaños de letra
para el mismo texto. Una portada más apaisada en escritorio era tentadora y se
descartó por eso: habría sido el mismo número escrito en dos componentes. Si algún día
se quiere, va como **segundo token** y no como una variante `sm:` acá.

| | Antes (§4.3) | Ahora (D-144) |
|---|---|---|
| Dónde | después de la ficha y del botón | arriba, antes del título |
| Alto | el de la imagen | el que decide `--aspect-portada` |
| Flyer vertical en 375px | 469px, la fecha se va de la pantalla | 211px, recortado |
| `loading` | `lazy` | `eager` + `fetchpriority="high"` |

El `loading` cambia con la posición y no es un detalle suelto: arriba, la portada es
el elemento más grande de la primera pantalla, y pedirla tarde retrasa justo lo que
mide un Largest Contentful Paint.

**La condición está atada, no confiada.** `tests/detalle-visual.test.ts` exige
`aspect-portada` y **prohíbe cualquier `aspect-[…]` escrito a mano**, que es la clase
y no la instancia. Una versión anterior del chequeo aceptaba cualquier proporción
—prefijada incluida—, así que dejar solo un `sm:aspect-…` lo pasaba con la caja sin
recortar **justo en el teléfono**, que es el único lugar donde el problema existe. Lo
enseñó una mutación; exigir el token lo cierra mejor, porque un token no tiene
variantes por breakpoint.

**Lo que no cambia:** sin imagen no hay hueco. El §7.6 sigue valiendo tal cual — la
página simplemente no tiene portada, y la ficha ya es lo primero. La portada generada
con el color del tipo (D-141, decisión 3) es de la **tarjeta del listado**, donde el
hueco rompe una grilla; en una página sola no hay grilla que romper. Lo que el detalle
sí toma de ahí es el **cintillo del tipo**: una barra fina y el nombre del tipo en
`colorDeTipo(slug)`, que es identidad por un dato que ya estaba.

## D-145 · El CTA fijo de móvil no lleva JavaScript, y es `fixed` y no `sticky`

**Contexto.** El §8 del diseño pedía «CTA fijo abajo en el detalle, con `pb-segura`,
**desde que el botón original sale de la pantalla**». B-238 no lo construyó y anotó
por qué: esa cláusula —«desde que sale de la pantalla»— obliga a medir el scroll, o
sea JavaScript, en la única página del sitio que tiene un presupuesto de **0 KB**.

**Decisión 1 — se cambia la regla, no la herramienta.** En el teléfono el botón del
flujo **no se pinta** (`hidden sm:block`) y la barra de abajo es el único CTA
(`sm:hidden`). Sin dos botones no hay «desde que el otro sale de la pantalla» que
calcular: hay uno y está siempre a mano. En `sm` y arriba, al revés — el botón del
flujo se ve sin scrollear y la barra sería una franja comiéndose pantalla sin motivo.

**Uno y solo uno por pantalla**, y eso no es estética: dos enlaces al mismo destino
hacen que quien escucha la página oiga el mismo botón dos veces.
`tests/detalle-visual.test.ts` cuenta las dos apariciones y exige que cada una esté
detrás de su corte.

**Decisión 2 — `fixed`, aunque `sticky` sea mejor.** `position: sticky` con `bottom-0`
al final del contenido habría sido más elegante: la barra se suelta sola al llegar al
final y el pie no necesita ningún aire extra. **No se puede usar acá:** `Base.astro`
le pone `overflow-x-hidden` al `body`, y un ancestro con `overflow` distinto de
`visible` **rompe `position: sticky`** — el elemento nunca se pega, sin error, sin
warning y sin que ningún test lo note.

Ese cruce quedó escrito como un invariante condicional y no como una prohibición:

```ts
expect(usaSticky && bodyRecorta).toBe(false);
```

Así, el día que el layout pase a `overflow-x: clip` —que recorta igual y **no** crea
contenedor de scroll—, el chequeo deja de oponerse solo y `sticky` vuelve a estar
disponible. Es lo que necesito de otro frente: `Base.astro` no es de este.

**Decisión 3 — el aire del pie va en el `<style>` de esta ruta, no en el pie.** Una
barra `fixed` tapa la última fila del pie al final del scroll, que es donde están
«Sugerir una actividad» y el Instagram. El arreglo es un `padding-bottom` en el
`body`, y va en un `<style is:global>` **de la página de detalle**: Astro empaqueta el
CSS por ruta, así que ninguna otra lo hereda. La alternativa —dárselo al pie, que es
de las cinco páginas— habría dejado 76px de aire permanente en las cuatro que no
tienen barra.

No va condicionado a que haya CTA, y el comentario lo dice: Astro extrae los `<style>`
en compilación y los sirve para la ruta entera, así que un `{hayCta && …}` daría la
impresión de no aplicarse cuando no hay botón y se aplicaría igual. Un poco de aire al
final de una página sin botón no se ve; un comentario que miente sí se paga.

**Las dos mitades solo sirven juntas** —la barra sin el aire tapa el pie, el aire sin
la barra es un hueco— así que el test las exige de a dos.

**Qué cierra y qué no.** Cierra la mitad «CTA fijo» de **B-238**. La otra mitad —la
hoja inferior de filtros de la home— **sigue abierta**, y por el motivo que B-238 ya
daba: es una capa modal, necesita trampa de foco, `Escape`, cierre tocando el fondo y
`pushState`, y nada de eso lo resuelve una regla de CSS.
## D-146 · Brutalismo editorial: la tercera dirección visual, y la que se aprobó

> ⚠️ **El punto 2 de «las tres cosas que el sistema mata de D-141» se revirtió el
> 2026-09-01 — ver D-150.** El color por tipo de actividad volvió, y con la misma
> banda de luminosidad y croma que se describe más abajo. Lo que cambió no es el
> argumento —una paleta *impuesta por el sistema* sigue sin poder tener ocho
> tintas— sino de quién es la paleta: ahora la administra el sitio desde Opciones.
> El resto de esta entrada, incluidos los otros dos puntos (la portada generada y
> la grilla que pasa a filas), **sigue vigente**.

**Contexto.** El dueño rechazó **dos** direcciones por genéricas. La segunda fue
D-141 —«la estructura de Eventbrite con paleta propia»— y su bajada a la tarjeta
(D-142), al detalle (D-144) y al CTA móvil (D-145). No se rechazó por estar mal
ejecutada: se rechazó porque *la estructura de Eventbrite es la estructura de una
plataforma*, y un sitio que se ve como una plataforma se ve como cualquier otra.

La tercera dirección la generó él en Stitch y está aprobada:
[`docs/referencias/sistema-visual.md`](referencias/sistema-visual.md) y
[`stitch-detalle.md`](referencias/stitch-detalle.md). **Se implementa, no se
rediseña.** Es un **programa impreso** —efímera cultural en risografía— y no una
plataforma: densidad antes que aire, reglas visibles antes que sombras, tintas
planas antes que degradados.

Esta entrada registra qué se implementó, **qué se le corrigió a la referencia**, y
las tres cosas que el sistema mata de la dirección anterior.

### Las tres reglas que atraviesan todo

| | |
|---|---|
| **Radio 0** | esquina viva en botones, campos y contenedores. El sistema admite 1–2px en el contenedor más externo «para imitar el redondeo de una hoja física», y **acá no hay dónde aplicarla**: el papel *es* el fondo del viewport, así que la hoja no tiene un borde exterior visible |
| **Estrictamente plano** | ninguna sombra, ningún desenfoque, ningún degradado. La profundidad sale de **superponer tintas** |
| **Tintas con nombre, no opacidades** | una opacidad es una trama de medio tono, que en una impresión a tintas planas no existe |

La tercera es la que más lejos llega, y no es estética. `text-tinta/60` da 4,49:1
contra un piso de 4,5 —cuatro centésimas que no se ven y se calculan— y es la
historia entera de B-235. Con tintas con nombre **no hay nada que calcular caso por
caso**: cada una tiene un contraste y está medido. Hoy el sitio tiene **cero**
atenuaciones de color.

### La paleta: tres tintas y dos reglas

Los valores salen del documento y están en `global.css` **en OKLCH**, porque los
chequeos de contraste parsean los tokens de ahí en vez de copiarlos — que es lo que
hace que aclarar una tinta ponga en rojo lo que dejó de alcanzar. La conversión es
exacta: cada token vuelve a su hex al redondear a 8 bits, y
`tests/sistema-visual.test.ts` lo verifica **contra la tabla del propio documento**,
así que el código y la referencia no pueden separarse en silencio.

| Token | Hex | Rol | Sobre papel |
|---|---|---|---|
| `papel` | `#fbf9f4` | el fondo. **Nunca blanco puro** | — |
| `crema` / `hondo` | `#f5f3ee` / `#e4e2dd` | las capas tonales que separan secciones | — |
| `tinta` | `#1b1c19` | el texto | 16,27:1 |
| `suave` | `#58413c` | texto secundario | 8,92:1 |
| `acento` | `#a7341c` | **la principal**: títulos, fechas, CTA | 6,33:1 |
| `azul` | `#4f6073` | lo funcional: categorías, rótulos | 6,14:1 |
| `super` | `#6c575a` | la superposición: cuerpo denso, reglas, **y el hover de toda tinta plena** | 6,34:1 |
| `borde` | `#8c716b` | **regla, nunca texto** | 4,26:1 |
| `regla` | `#e0bfb9` | regla decorativa; no llega ni al 3:1 de un borde | 1,62:1 |

**Se midió todo de nuevo, no se asumió.** Las mediciones del documento se
reprodujeron exactamente, y además se midió lo que el documento **no** cubría: cada
tinta sobre las **tres** superficies. Ahí aparece el número que importa —`azul` da
6,14 sobre el papel y **4,99 sobre `hondo`**—, o sea que el margen que sobra arriba
casi no existe abajo. Aclarar `azul` a L=0,55 lo deja en 3,74 sobre `hondo` y sigue
dando 4,60 sobre el papel: pasaría un chequeo que solo mire el papel. Por eso
`contraste-de-superficies.test.ts` mide contra las tres.

**`--color-acento-hondo` se borró.** El sistema dice que el hover de una tinta plena
es la de superposición, así que `super` hace ese trabajo. Una tinta menos que
mantener.

**Sobre `primary-container` y `tertiary-container`:** están medidos (4,55:1 con su
`on-*`, `#fffcff`, y **no** con el papel, que da 4,40 y no pasa) y **no se usaron**.
La referencia del detalle los pone en la franja de estado, la etiqueta del tipo y el
botón; acá esos tres van con `primary`, que da **6,33:1** en vez de 4,55. El motivo
es doble: la paleta es limitada por definición y sumar un cuarto terracota va en
contra, y un margen de cinco centésimas sobre el piso es una deuda —cualquier
retoque de ese tono lo tira abajo—. Es reversible en una línea si el dueño prefiere
el tono más claro.

### La tipografía: tres familias que pesan menos que las dos anteriores

**Adiós a Inter y a Lora**, que son el par por defecto de todo sitio hecho con IA y
eran la mitad de por qué esto se veía genérico.

| | antes | ahora |
|---|---|---|
| display | Lora 500;600 — 36,9 KB | **Bodoni Moda** 800 — 14,6 KB |
| títulos densos | (no había) | **Archivo Narrow** 400..700 — 18,3 KB |
| cuerpo | Inter 400;500;600 — 47,2 KB | **Public Sans** 400..700 — 26,0 KB |
| **total** | **84,2 KB** | **58,8 KB** (−30 %) |

Está **medido**, no estimado: son los woff2 del subset latin que Google sirve para
la URL exacta que emite el build. Se pasa de dos familias a tres y aun así baja,
porque Inter y Lora se bajaban como variables completos: pedir tres pesos de Inter
traía el rango entero.

Dos decisiones de peso, las dos con número:

- **El eje `opsz` de la Bodoni va fijado en 48.** Abierto cuesta 26,5 KB; fijado,
  14,6 KB. Y 48 es el punto óptico que corresponde: la Bodoni se usa entre 26px (la
  marca) y 72px (el mes).
- **No se carga la cursiva de Bodoni**, aunque `stitch-detalle.md` pide la lectura
  de un club en cursiva. Son **+17 KB** —el 29% del presupuesto— para una línea que
  aparece solo en las páginas de club de lectura y **nunca en la home**, que es la
  que recibe el tráfico. Va en Bodoni redonda y en terracota, que ya la separa del
  tema. Se revierte cambiando el `href` de la hoja de fuentes en `Base.astro`.

**`--font-serif` se borró y no se aliaseó**, y eso hay que saberlo: Tailwind trae el
suyo (`ui-serif, Georgia`), así que un `font-serif` que sobreviva de la dirección
anterior **no falla, no rompe el build y pinta Georgia** en el medio de una página
en Bodoni. Es el modo de falla más silencioso del rediseño y por eso está prohibido
por test.

### Las tres cosas que el sistema mata de D-141

**1 · La portada generada (D-142) se retira.** El listado es **puramente
tipográfico**: filas, sin foto, sin miniatura, sin portada generada. Una miniatura
de 64px de un rectángulo de color no dice nada y devuelve la textura de plataforma
que el rediseño existe para sacar. `PortadaDeTarjeta.tsx` se borró.

Se evaluaron las tres opciones. **Conservarla para la página de detalle** era la más
tentadora —no se borraba trabajo, y de hecho un bloque de tinta plena con el título
calado *es* el gesto central del sistema— y se descartó por una razón concreta: en
el detalle la portada queda **inmediatamente encima del `h1`**, así que sería el
título dicho dos veces, a dos cuerpos, en la misma pantalla. El detalle muestra la
foto cuando la hay y no muestra nada cuando no la hay, que es lo que la referencia
pide («sin foto obligatoria»).

**2 · El color derivado por tipo de actividad se retira.** D-141 daba un tono por
tipo, derivado del slug para que un tipo nuevo no cayera en un gris de descarte. El
razonamiento era bueno y la garantía estaba bien construida —contraste probado sobre
los 360 tonos posibles, no sobre los siete que existían—. Lo que cambió es la
premisa: la paleta ahora es **limitada, «como una impresión a tintas planas»**, y
siete u ocho tintas —una por categoría— es exactamente lo contrario. El sistema
además ya le asigna un lugar a la categoría: «azul tinta — texto funcional,
**categorías**».

Así que el tipo se escribe **todo en azul tinta** y lo que distingue un taller de un
club de lectura vuelve a ser la palabra. Se borraron `colorDeTipo`, `tonoDeTipo`,
`TIPOS_CON_TONO` y `contrasteSobreTipo` de `identidad.ts`, y con ellos
`escalaDePortada` y `renglonesDePortada`. **Lo que queda de D-141 es lo que valía de
fondo**: que el nombre del sitio viva en un módulo y se interpole.

**Cómo volver, si hiciera falta:** está entero en el historial
(`git show 41057d6 -- src/lib/identidad.ts src/components/publico/PortadaDeTarjeta.tsx`).

**3 · La grilla de tarjetas pasa a filas.** «Filas cronológicas en lugar de
tarjetas, separadas por una regla fina». A igual ancho entran tres veces más
actividades —la densidad que el sistema pide como principio— y **la página no pide
un solo byte de imagen**, que es la mejora de rendimiento más grande del rediseño y
salió de una decisión de diseño, no de una optimización.

### Lo que se le corrigió a la referencia, y por qué

| # | Qué traía | Cómo quedó |
|---|---|---|
| 1 | Material Symbols | **ningún icono, ninguna librería.** Un `laptop_mac` al lado de «virtual» devuelve el sitio a Google al instante. La flecha del desplegable es un triángulo de tres bordes; la X de la casilla, dos pseudo-elementos |
| 2 | la paleta Material 3 entera | solo las tintas que el documento nombra, mapeadas a los tokens del proyecto |
| 3 | el nombre del sitio y el mes, los dos a 72px | **gana el mes.** Si dos cosas son la más grande, ninguna lo es. La marca usa `marca` (26/32px), la misma Bodoni un escalón y medio abajo |
| 4 | cabecera fija de 72px | **fija solo de `sm` en adelante.** En 375px, 72px permanentes son el 12% de la única pantalla donde hay que decidir si un taller sirve. No se arregla achicándola |
| 5 | filtros como `<a href="#">` | **controles de verdad**: multi-selección, conteo por faceta y sincronización con la URL, todo conservado. Cambió la piel, no la función |
| 6 | bordes en `pt` | **px.** `0.5pt` se redondea a 0 o a 1 según el zoom y el `devicePixelRatio`: la misma regla aparece y desaparece. `1px` se ve igual en pantalla normal y en retina, y **siempre se ve** |
| 7 | «Privacidad», «Términos», «© 2024», «entrada libre» | **fuera.** Las dos páginas no existen; el año estaba mal **y no se reemplazó por el correcto** (nadie pidió una línea de copyright); y el arancel es taxonomía de `/opciones/*`, no un literal |
| 8 | la fecha entera en `label-caps` (11px) | el **bloque de fecha** lleva el día en un cuerpo propio de 28px y el resto en versalitas. En el resto del sistema `label-caps` es un *rótulo*; ahí sería *contenido*, y 11px queda por debajo del `body-sm` (12px) que el propio sistema fija como piso del contenido |
| 9 | el encuentro cancelado mostraba el tema del siguiente | cada fila usa **su** dato, y tolera que el cancelado **no tenga tema** |
| 10 | la ficha pegada con `top-24` | `top-encabezado`, del **mismo token** que da la altura de la cabecera. Un número suelto se desincroniza y no falla nada |

Las tres imágenes de relleno en `googleusercontent.com`, el `lang="en"`, el
«Suscribirse» duplicado, las clases fantasma, las `dark:` sin paleta oscura y el
`transition-all duration-0` no llegaron nunca al código.

### Lo que la referencia resolvió bien y se conserva tal cual

**El encuentro cancelado sigue visible y tachado** —baja de tinta, número y tema
tachados, y una regla que lo cruza entero— en vez de desaparecer o pintarse de rojo
de alarma. Es lo correcto: quien tenía anotado el miércoles 17 necesita **ver** que
esa fecha se movió. La regla que cruza va como pseudo-elemento, o sea decoración
pura: lo que *dice* que está cancelado es la palabra «Cancelado», que es texto.

**El material distingue con link de sin link por color y peso, sin un solo icono.**
Con link va en la tinta principal, subrayado y grueso; sin link, en gris y sin nada.
La diferencia entre «esto lo podés leer ahora» y «esto te llega al inscribirte» se
lee sin candaditos.

### Qué NO cambió, y es deliberado

- **La home imprime el listado completo en HTML desde el build** (SSG, sin JS) y la
  island lo reemplaza al hidratar. El SEO es requisito del proyecto (§2.3).
- **La página de detalle sigue sin una línea de JavaScript**: el único `<script>` es
  el JSON-LD.
- **La frontera de privacidad sigue siendo un tipo** (D-140): la plantilla recibe el
  view-model y nada más.
- **En el teléfono los filtros siguen siendo el disclosure de D-143**, con su tope
  de 65svh y el foco que vuelve al abridor. Los tres argumentos de D-143 valen en la
  pantalla chica; el riel los reemplaza **solo en escritorio**, donde hay una columna
  entera. **B-238 sigue abierta** por el mismo motivo de siempre.

---

## D-147 · Ninguna salida del sitio recorta una imagen — se retira `--aspect-portada`

**Contexto.** B-263. La página de detalle pintaba la portada con
`class="aspect-portada … object-cover"`, y `--aspect-portada` valía **16/9**. Los
flyers que de verdad se cargan son **verticales**: los dos que hay en producción
miden 720 × 826, o sea **0,87**. Con esa combinación se perdía el **51 %** de la
imagen, mitad arriba y mitad abajo.

**Y lo que se perdía no era margen.** Un flyer no es una foto: es **texto metido
adentro de un JPEG**. El título, la fecha, la sede y cómo anotarse están
tipografiados ahí. Recortar arriba y abajo se lleva exactamente los datos y deja
en pantalla la parte del medio, que suele ser la ilustración.

### Las cuatro salidas, y por qué la elegida

| Opción | Por qué no |
|---|---|
| un segundo token, para retrato | hay que **saber** que la imagen es retrato, y de una externa no se sabe. Y son dos números que mantener en vez de uno |
| `object-contain` sobre una caja de proporción fija | no recorta, pero deja el flyer vertical encogido entre dos bandas de papel **siempre**, no solo mientras carga |
| bajar el token a 3/4 | recorta menos y sigue recortando. Y rompe la foto apaisada del espacio, que es el otro uso real de la galería |
| **respetar la proporción de cada imagen, con tope de alto** | **la elegida** |

**La regla que se adopta es más fuerte que el número que reemplaza: ninguna
salida del sitio recorta una imagen.** No es «16/9 estaba mal y otro valor está
bien» — no hay proporción única que sirva a la vez para un flyer de historia, una
foto apaisada del espacio y la tapa de un libro. Cualquier caja fija con
`object-cover` recorta algo.

### Qué pasa con el motivo por el que existía el token (B-249)

B-249 creó `--aspect-portada` para que **la misma imagen no tuviera dos recortes
en dos lugares distintos**. Ese problema es real y no se descarta: se resuelve
mejor.

| | el token | lo que lo reemplaza |
|---|---|---|
| qué se comparte | un **número** | la **regla** (`claseAfiche` en `components/sitio/estilos.ts`) |
| qué impide | dos proporciones distintas | **recortar**, en cualquier página |
| qué **no** impedía | usarlo con `object-cover` en una página y `object-contain` en otra | — el `object-fit` viaja adentro de la clase |
| dónde se verifica | un aserto sobre la página de detalle | un barrido sobre **todos** los `.astro` del sitio (`tests/afiche.test.ts`) |

Con «nadie recorta», dos consumidores no pueden diferir en el recorte: no hay
recorte. Y el barrido cubre la página que se escriba el mes que viene, que el
aserto anterior —atado a un archivo— no cubría.

**No se declara un token de proporción nuevo**, y eso es parte de la decisión:
cualquier valor único vuelve a ser un recorte para alguna forma de imagen.

### El alto sí se topea, que era lo que D-144 necesitaba de verdad

El §4.3 del diseño no quería la imagen arriba porque «un flyer vertical de
Instagram como cabecera empuja la fecha fuera de la pantalla». D-144 le sacó la
premisa fijando la **proporción**; lo que en realidad hacía falta era topear el
**alto**. La diferencia importa: con proporción fija el flyer se ve cortado en
todas las pantallas; con tope de alto se ve entero en casi todas, y encogido
—nunca cortado— en las pocas donde no entra.

El tope es `max-h-[70svh]` y vive en `claseAfichePortada`, **no** en la clase
base. `svh` y no `vh` por lo mismo que el panel de filtros de D-143: con la barra
retráctil de un navegador móvil, `vh` mide de más.

**La cartelera no lleva el tope, a propósito.** Ahí no hay ficha que quede abajo:
el afiche *es* el contenido y la página se recorre scrolleando. Topear el alto en
una columna ancha dejaría el flyer flotando entre dos bandas de papel, que es
justo el aspecto que este cambio vino a sacar.

### No saber la forma de una imagen es un caso de primera clase

La proporción se reserva con `aspect-ratio` sacado de `ancho`/`alto` de **esa**
imagen (`lib/afiche.ts`). Una imagen **propia** los trae desde que se sube
(`subir-imagen.ts` los mide sobre los bytes). Una **externa** es una URL de otro
lado y DEC-7d decidió que el build no las descarga, así que su forma solo se
puede conocer en un navegador.

**Entonces el panel la mide.** La vista previa del editor ya carga la imagen;
`naturalWidth`/`naturalHeight` se leen de ahí sin pedir permiso de CORS —no son
datos de píxel— y se guardan en la fila. La medida viaja sola hasta la página
porque `formADocumento` ya copiaba `ancho` y `alto` «si están» (D-131 §2) y
`imagenPublica` ya los emitía.

**Se miden solo las filas que esta sesión escribió** —la recién agregada y
aquella a la que se le cambió la dirección— y no todas las que se ven. Medir al
cargar la vista previa de una fila **ya guardada** escribiría en el formulario
apenas se abre, y `useFormularioSucio` compara el estado contra el inicial: abrir
una actividad sin tocar nada diría «tenés cambios sin guardar» y dispararía el
autoguardado. Es la misma familia que la advertencia de D-125 sobre el id
determinístico.

Las filas viejas quedan sin medida hasta que alguien vuelva a tocarlas, y ahí
**no se reserva ninguna caja**. Es preferible a inventar una: sin `aspect-ratio`
el navegador usa la forma real al cargar y el costo es un salto de layout, una
vez; con una caja inventada el flyer queda encogido **para siempre**.

Y una medida corrupta —un `alto: 0` de un documento tocado a mano— se trata como
«no sé» y no como cero: `aspect-ratio: 720 / 0` es una caja de alto cero, o sea
la imagen desaparecida de la página con el build en verde.

---

## D-148 · La cartelera es una pared de afiches, y se arma desde el índice

**Contexto.** B-265. El flyer es el medio de difusión del circuito literario y el
sitio lo mostraba en un solo lugar —la cabecera de la página de cada actividad—,
al que solo llega quien ya decidió entrar. `/cartelera` le da un lugar propio:
todos los flyers, grandes, uno al lado del otro, cada uno enlazando a su
actividad.

Es además la otra mitad de B-264: el panel dice «sin imagen no entra en la
cartelera», y esa frase tiene que ser verdad.

### Una pared, no un carrusel

El pedido fue «en continuado», y dentro del sistema visual eso se lee como
**continuo porque no termina**, no porque se mueva. Nada de esta página avanza
solo, así que tampoco hay `prefers-reduced-motion` que respetar: no hay
movimiento que reducir. Un carrusel además **esconde** — con 30 flyers, 27
quedarían fuera de pantalla esperando que alguien toque una flecha.

### Columnas de CSS y no una grilla

Una grilla alinea filas, y con afiches de altos distintos cada fila deja huecos
debajo de los más bajos. Las columnas dejan que cada afiche mida lo que mide y
que el de abajo arranque donde terminó el anterior, que es literalmente cómo se
pega un afiche sobre una pared.

**Lo que se paga es el orden de lectura**: con columnas se lee de arriba hacia
abajo por columna y no de izquierda a derecha por fila. Se acepta porque la
lectura en orden cronológico es el trabajo de la **agenda**, que es la página de
al lado y está ordenada; acá cada afiche lleva su fecha escrita al pie.

### El número de columnas está atado a la cantidad

Hoy hay **dos** flyers. Con `columns-3` fijo, CSS reparte el alto y esos dos
quedan del ancho de un tercio de pantalla, cada uno en su columna y con la
tercera vacía: se ve como una plantilla a medio llenar, que es distinto de verse
poco. Con el tope atado a la cantidad (`columnasDeCartelera`: ≤2 → una columna
con tope de ancho, ≤5 → dos, más → tres) los dos de hoy salen grandes y uno abajo
del otro, y la pared se densifica sola a medida que se carguen.

**Con cero no se dibuja una grilla vacía.** Se dice qué es la página y se manda a
la agenda, que sí tiene contenido — el mismo criterio del §7.6 con el hueco de la
portada: no hay placeholder.

### Qué entra a la pared

- **Una imagen por actividad, la portada.** Una actividad puede tener cuatro y
  las otras tres suelen ser fotos del espacio: con las cuatro, la pared deja de
  ser una pared de flyers y pasa a ser un álbum. `portada` es justamente el flag
  de «esta es la que quiero que se vea al compartir» (D-125).
- **Solo lo que todavía va a pasar**, la misma regla que la home. Una pared de
  afiches de cosas que ya ocurrieron es un museo, y el clic lleva a una página
  que arranca con «esta actividad ya pasó».
- **Ordenado por fecha próxima, y con desempate por título.** Firestore no
  garantiza el orden de un `get()` de colección: sin desempate, dos actividades
  del mismo día pueden salir distinto en cada build y la página cambia sin que
  haya cambiado nada.

### De dónde salen los datos, y de dónde no

Del **mismo** `DetallePublico` que genera cada página de actividad, no de una
segunda proyección. Así la pared y la cabecera muestran la misma imagen por
construcción y no por coincidencia, que es la clase de B-88.

Y trae la consecuencia que importa para el §5: la frontera de privacidad ya es un
tipo (D-140) y ya está auditada, así que esta proyección solo puede **sacar**
campos. `storagePath` no está en `DetallePublico`, entonces tampoco puede estar
acá — se verificó además sobre el `dist/` construido.

**Nunca desde un listado de Storage**, y hay un test que lo prohíbe explícito. Es
la **trampa 13**: `allow list` está cerrado a propósito (`allow get: if true`,
`allow list: if esAdmin()`), y un `listAll()` traería también los flyers de las
actividades en borrador. La cartelera se arma desde el índice de lo publicado,
igual que el resto del sitio.

### El texto alternativo es `alt=""`, y eso **es** DEC-7a

DEC-7a decide **de dónde sale** el texto alternativo de una imagen —del título de
la actividad, no de un campo por imagen— y no que haya que decirlo dos veces. En
la cartelera el título está ahí abajo como texto, dentro del mismo enlace, así
que es el nombre accesible del enlace; repetirlo en el `alt` se escucharía dos
veces seguidas. D-142 ya había aplicado exactamente esto donde la imagen convive
con su título. En la página de detalle, donde la portada está sola arriba del
`h1`, el `alt` sigue siendo `Imagen de {título}`.

### Dónde entra en la navegación

**Segunda, pegada a «Agenda».** Son las dos formas de mirar lo mismo —la lista y
la pared— y quien entra por la agenda tiene que poder pasar a la otra sin buscar.
«Suscribirse», «Ayuda» y «Contacto» son de después de haber encontrado algo. El
orden está fijado en `tests/estilos-del-sitio.test.ts` porque es una decisión:
mover «Cartelera» al final la esconde detrás de tres enlaces de servicio.

---

## D-149 · El peso de la cartelera sin la Function de recompresión, con los números

**Contexto.** B-266. La cartelera es la **única** página del sitio que pide
imágenes: la home no pide ninguna desde D-146 y el detalle pide una. Así que el
presupuesto de bytes del sitio se decide ahí, y la Function que recomprime y
deriva miniaturas (**B-220**, DEC-7d) todavía no existe: hoy una imagen propia se
sirve **tal cual la subió quien organiza**, hasta 3 MB.

> **Corregido el 2026-09-02 (B-296, D-168):** el detalle pide **una si no tiene
> galería y hasta cuatro si la tiene**, no una fija. No cambia el diagnóstico de
> abajo —la cartelera sigue siendo la única página que muestra **muchas** imágenes
> a la vez, y el presupuesto por recorrido se decide ahí—, pero el peor caso **por
> página** ya no es la pared: es un detalle con cuatro imágenes. Los números de esa
> página están en D-168 §3, y el techo que se movió, en **B-300**. La premisa queda
> escrita como estaba para que D-168 se lea contra su original.

> **Cerrado del todo el 2026-09-02 (B-220, B-320).** La Function de B-220 derivó
> la miniatura que esta decisión pedía, y B-320 le puso el `srcset` que faltaba
> del lado de la plantilla. El «no se puede hacer sin B-220» de más abajo ya no
> aplica: recorrer la pared entera con las 30 imágenes de producción pasa de
> 3518,5 KB a 1032,4 KB (−71 %).

### Lo medido

Contra el emulador, con 42 actividades publicadas de la forma de las reales y
flyers de 720 × 826 como los dos que hay cargados:

| | 2 flyers (hoy) | 30 flyers |
|---|---|---|
| `dist/index.html` | 61,9 KB | 61,9 KB |
| `dist/events.json` | 59,2 KB | 63,2 KB |
| `dist/cartelera/index.html` | **8,2 KB** | **30,8 KB** |
| `<img>` en la pared | 2 (1 `eager`, 1 `lazy`) | 30 (1 `eager`, 29 `lazy`) |
| con la caja reservada | 2 de 2 | 30 de 30 |

El markup cuesta **~0,75 KB por afiche**, o sea nada. Lo que pesa son los
archivos, y ahí los números reales son 31 KB y 90 KB — **un solo flyer pesa más
que el HTML entero de la home**.

Para reproducirlo: sembrar N actividades publicadas con una imagen de 720 × 826 y
`ancho`/`alto` puestos, correr el build contra el emulador y medir `dist/`.

### El veredicto, en dos mitades

**Por pantalla se sostiene, y va a seguir sosteniéndose.** Con `loading="lazy"`
en todos menos el primero y la caja reservada por la medida de cada imagen, el
navegador baja lo que está cerca del viewport y nada más:

- en un teléfono de 390px, un afiche de 0,87 mide ~411px más ~90px de pie, así
  que entra ~1,5 en pantalla y se piden 2 o 3 → **180–270 KB**;
- en un escritorio de 1440px con tres columnas se ve una fila → **~270–360 KB**.

Eso **no crece** con el total: es lo mismo con 30 flyers que con 300.

**Por recorrido completo deja de sostenerse alrededor de los 20-25 flyers.**
Scrollear la pared entera con 30 flyers de 90 KB baja **2,6 MB**; con 42 serían
3,8 MB. Y el techo es peor que el promedio: el tope de subida son 3 MB por imagen
(DEC-7b), o sea que **un solo flyer sin recortar puede pesar más que toda la
pared medida acá**.

### Qué se hizo, y qué no se puede hacer sin B-220

Las tres palancas que existen sin variantes de imagen están puestas:
`loading="lazy"` salvo el primero, `width`/`height` más `aspect-ratio` para que
el diferido no haga saltar la página, y `decoding="async"`.

**`sizes` no está, y es a propósito: sin `srcset` no hace nada.** Un `sizes`
suelto es decoración que parece optimización. Lo que haría falta —servir la
imagen a 430px cuando la columna mide 430px— necesita **variantes**, y las
variantes son B-220.

**Conclusión: sin la Function esto se sostiene mientras la pared se recorra de a
pantallas, y no se sostiene para quien la recorra entera.** No se construye nada
más acá para taparlo: sería trabajo que se cae con 30 actividades. B-220 sube de
prioridad y el disparador queda escrito en B-266.

**Y B-220 no se implementa de paso.** Arrastra una dependencia binaria en
`functions/`, el write-back al documento y —sobre todo— la guarda anti-loop: un
`onObjectFinalized` que escribe la miniatura en el **mismo bucket** se dispara a
sí mismo, que es la trampa 3 con otra cara (trampa 12 del §13).
## D-150 · El color del tipo de actividad vuelve, y se elige desde Opciones — revierte el punto 2 de D-146

**Contexto.** D-141 le dio a cada tipo de actividad su propio tono, derivado del
slug para que un tipo creado desde «Otro» no cayera en un gris de descarte. D-146
lo retiró, y su argumento era bueno: la paleta del sistema visual es **limitada,
«como una impresión a tintas planas»**, y siete u ocho tintas —una por categoría—
es exactamente lo contrario. El tipo pasó a escribirse todo en azul tinta.

El dueño pide el color de vuelta, y con una diferencia que es la que cambia la
decisión: **quiere poder elegirlo desde la sección de opciones del panel.**

### Qué cambia respecto de D-146, y qué no

D-146 no decía «el color por tipo está mal»: decía que **una paleta impuesta por
el sistema** no puede tener ocho tintas. Eso sigue siendo cierto. Lo que cambia es
de quién es la paleta: ya no la fija el sistema visual, la administra el sitio,
igual que administra las etiquetas y los barrios. Un color por categoría elegido
por quien publica es una decisión editorial del programa, no una ampliación de la
paleta del sistema — y el sistema le asigna a la categoría un lugar propio («azul
tinta — texto funcional, **categorías**»), que es el que ahora se puede pintar.

**Lo que se paga, y hay que decirlo:** la home deja de tener tres tintas y pasa a
tener tres más una por tipo presente. Es la contradicción con la «paleta limitada»,
y es deliberada. Se acota con dos cosas: el color aparece **solo en la cajita de la
categoría** (no en el bloque de fecha, no en el título, no en el arancel) y todos
los tonos comparten luminosidad y croma, así que la página se sigue leyendo de una
pieza — varía el matiz, no el peso.

### Las tres decisiones

**1 · Se deriva del slug; lo elegido es la excepción.** `tipo` es una taxonomía
autogestionada (§4 del `CLAUDE.md`): quien carga puede crear un tipo nuevo desde la
casilla «Otro» y ese tipo aparece solo en los filtros. Si el color se asignara
**solo** a mano, el tipo nuevo nacería sin color y **nadie se enteraría** — el modo
de falla es silencioso, que es el mismo argumento con el que D-141 rechazó la tabla
de siete. Así que `tonoDeTipo(slug, elegido)` resuelve en tres escalones: lo elegido
si es elegible, el tono de arranque del tipo si lo tiene, y el derivado del slug si
no. El campo guardado (`tono`, en `/opciones/tipo`) es la excepción, no la regla.

La tabla `TONOS_DE_TIPO` de los siete tipos de hoy sobrevive como **default**, no
como fuente de verdad: existe para que los que están desde el día uno arranquen con
colores elegidos y no con siete matices repartidos por una función de hash. Puede
quedarse corta —un tipo que no esté deriva el suyo— pero no puede envejecer
nombrando tipos que ya no existen, y eso lo fija un test contra `opciones-base.json`.

**2 · El contraste no depende del gusto de quien elige.** Esta es la parte que hace
posible todo lo demás.

La derivación de D-141 fijaba la **luminosidad y el croma** y variaba **solo el
matiz**, y por eso podía garantizar los 360 tonos posibles de una vez. Un selector
de color libre destruye esa garantía: el espacio pasa de 360 valores a millones, y
la promesa se degrada a «los que alguien ya miró». Alguien elige un amarillo, el
nombre de la categoría queda ilegible, y **no falla nada**.

Así que **el selector ofrece la banda**: lo que se elige es el matiz, no el color.
`L = 0,42` y `C = 0,105` para todos, y el panel muestra doce matices con nombre —
Terracota, Ocre, Petróleo, Azul tinta, Ciruela…—. Con eso, *cualquier cosa que se
pueda elegir* pasa AA, y no hay error que explicar después.

Medido, no supuesto: `tests/color-de-tipo.test.ts` recorre **los 360** contra las
**tres** superficies del sitio (`papel`, `crema`, `hondo` — el hover de la fila es
`crema`, y medir solo contra el papel da un número optimista, que es la lección de
B-256). El peor de los 360 da **5,90:1** contra un piso de 4,5.

Y hay tres guardas más, porque la banda sola es una promesa sobre el presente:

| Guarda | Qué ataja | Dónde |
|---|---|---|
| `revisarTono` al guardar | que aflojar la banda pase en silencio: si mañana se sube la `L` para que los colores se vean más vivos, el guardado empieza a rechazar lo que dejó de alcanzar, con **el ratio y el piso** en el mensaje | `identidad.ts`, llamada desde `pintarOpcion` |
| `esTonoElegible` al leer | un `tono: 999` o un `tono: 12.5` escritos a mano en la consola de Firestore: se ignoran y se cae al derivado, que sí está garantizado | `tonoDeTipo` |
| el mismo filtro al proyectar | que un valor así llegue al `events.json` | `opcionPublica` |

El piso de `revisarTono` es un **parámetro con default** —el patrón de los límites
de `functions/rebuild.js`— y no por elegancia: con la banda de hoy la guarda **no se
puede disparar**, así que un test que no pueda subir el piso no la verifica, y
sacarle el `throw` quedaría en verde. Es exactamente lo que pasó con su default,
que se escapó a la primera pasada de mutación y terminó afirmado sobre el fuente.

**3 · Dónde se ve.** Un ajuste que no se ve en ninguna parte es una pantalla de
configuración que no configura nada. El color vuelve a **la cajita del tipo en cada
fila del listado público** —texto y borde, el mismo color en los dos, porque el
chequeo lo mide como texto (4,5:1) que es más exigente que el 3:1 de un borde— y se
muestra además en la pantalla de Opciones, al lado de cada tipo, que es donde se
elige.

Va por `style` inline y no por clase de Tailwind, y eso no es descuido: Tailwind
solo genera las clases que **ve escritas en el fuente**, así que una clase por tipo
dejaría sin color al tipo que alguien cree mañana — el mismo modo de falla
silencioso que la decisión 1 evita.

**Lo que queda afuera, con su motivo:**

| Dónde | Por qué no |
|---|---|
| la etiqueta del tipo en la cabecera del **detalle** | es la otra candidata obvia y **corresponde**; no se hizo porque `[slug].astro` y `detallePublico.ts` los está tocando otro frente en paralelo. Queda como **B-273**, y no es una omisión inofensiva: la ficha del detalle sigue pintando el tipo en `bg-azul` con un comentario que dice «es la misma que abre cada fila del listado», y esta decisión lo volvió falso. Quien navegue del listado al detalle ve la cajita saltar de color. Lo encontró el `auditor-trampas` |
| los chips del eje «Tipo de actividad» en los filtros | son controles, y su estado activo ya es `bg-acento` con el texto calado. Pintarlos de doce colores pelea con lo que el control tiene que comunicar, que es si está puesto o no |
| el bloque de fecha, el título, el arancel | el color dice «de qué categoría es esto». Extenderlo al resto de la fila lo convierte en decoración y devuelve la textura de plataforma que D-146 vino a sacar |

### Y el color de una opción base sí se puede cambiar

Los siete tipos de `/opciones/tipo` son `fijo: true`, así que la guarda del §4.3
—«las base no se editan desde la UI»— dejaría la pantalla sin nada que configurar:
no se podría elegir el color de **ninguno de los tipos que existen**. `pintarOpcion`
la saltea con una llave explícita (`tocaFijas`) y es la **única** operación que la
tiene: renombrar y borrar la siguen respetando, con un test de integración que lo
fija.

El razonamiento: lo que `fijo` protege de una opción base es su **identidad** —el
slug que puede estar cableado en la lógica, la etiqueta con la que se la reconoce—.
El matiz no es identidad, es presentación, y es justo lo que se pidió poder cambiar.

### Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| **Selector de color libre**, validando el contraste al guardar | Es la que el pedido admitía explícitamente, y funciona: se mide con `contraste.ts` y no se deja guardar lo que no pasa. Pero deja a alguien eligiendo un amarillo, viéndolo bien en el selector, y recibiendo un rechazo con un número — cuando el problema se puede **no tener**. La banda convierte «avisar del error» en «que el error no exista». La validación quedó igual, abajo, para el día que la banda se afloje |
| **Solo elección manual**, sin derivar | El tipo nuevo nace sin color y nadie se entera (§4). Es el modo de falla silencioso que D-141 ya había identificado |
| **Guardar el color entero** (`oklch(...)` o un hex) en la taxonomía | Publica en el dato lo que hoy es una función, y con eso la luminosidad se vuelve editable: la garantía de los 360 se pierde en el primer documento escrito a mano. Guardando el matiz, la banda vive en el código y el dato solo tiene la dimensión que se puede elegir |
| **Volver a la portada generada de D-142** | No se pidió, y D-146 la retiró con su propio argumento, que sigue en pie: el listado es puramente tipográfico y no pide un byte de imagen |

---

## D-151 · El arancel sube al segundo eje del sitio, y lo que no se paga va primero

**Contexto.** El pedido fue «revisar filtros para que estén los eventos gratis
(tanto web como admin)». En la web **ya estaban**: corrido contra el `events.json`
de producción con la misma función que usa la island (`chipsDe`), el eje «Arancel»
devuelve `Gratis (8)`, `A la gorra (1)` y `Arancelado (32)`. No faltaba código.

Lo que faltaba era encontrarlo, y por dos motivos que se suman.

**1 · El eje estaba tercero, detrás de «Cómo se cursa».** Eso partía el grupo de
«dónde» al medio —modalidad, precio, barrio, ciudad— cuando las tres primeras
contestan la misma pregunta y el precio no. Y en el teléfono los ejes viven detrás
del disclosure de D-143, topeado a **65svh** con scroll propio: arriba del arancel
había el select de «Cuándo» más **ocho filas de 44px** (los seis tipos y las dos
modalidades que hay en producción), así que su rótulo caía cerca de los **520px**,
por debajo del corte del panel en una pantalla de 390px. El filtro estaba y
funcionaba; había que scrollear adentro del panel para llegar. Es la forma que
tiene una funcionalidad de no existir.

**2 · Dentro del eje, «Gratis» era el segundo chip.** Los chips se ordenan por
cantidad, y en producción hay 33 arancelados contra 8 gratis: el chip que alguien
viene a buscar quedaba tapado por el que más aparece. El **§6.1 del diseño ya decía
«`Gratis` y `A la gorra` primero, siempre»** y la implementación no lo había bajado
— o sea que esto no es una idea nueva, es una línea del diseño que faltaba.

**Decisión.** `arancel` pasa al **segundo** puesto de `EJES` (después de «Tipo»,
antes del grupo de lugar), y dentro del eje los chips se ordenan **primero por si se
paga o no** y después por cantidad, como siempre. Lo decide `esSinCosto`, la misma
función con la que la fila del listado pinta el arancel con el acento: dos listas de
«lo que no se paga» son dos maneras de que una se olvide de «a la gorra», que es la
mitad de los casos del circuito (§4.1).

Con eso, en producción el eje queda `Gratis (8) · A la gorra (1) · Arancelado (32)`
y su rótulo entra sin scroll en el panel del teléfono.

**Desvío del §6.1 del diseño**, que lo ponía **quinto** «en orden de importancia»,
detrás de «Dónde». Se desvía por lo de arriba: en la lista del diseño «Dónde» es un
solo filtro y en la implementación son tres ejes, así que respetar el orden
literalmente empuja el precio ocho filas abajo. Lo que el diseño quería —que el
precio importe— se cumple mejor subiéndolo.

**Lo que el reordenamiento no cambia:** los parámetros de la URL son con nombre y no
posicionales, así que un filtro compartido por WhatsApp hace meses sigue dando lo
mismo. `ejeQueSobra` sí cambia de resultado en un empate —recorre `EJES` al revés—
y eso es una sugerencia, no un filtro.

**`SIN_COSTO` se muda a `src/lib/arancel.ts`.** Nació en `tarjetaPublica.ts`, donde
lo usaba una sola cosa; ahora lo usan tres, y no puede vivir en ninguna de ellas
porque `tarjetaPublica` importa de `listadoPublico`, que importa de
`filtrosActividades`. Un módulo puro sin dependencias, como `slugify` y `normalize`.

---

## D-152 · El panel gana el filtro de arancel — se revierte D-74

**Contexto.** D-74 eligió cinco filtros para el listado del panel y **descartó
`arancel` a propósito**, con este argumento:

> «Es un atributo de publicación, no una forma de recordar una actividad: nadie
> busca "el taller arancelado". Y su riesgo real —publicar un taller pago como
> gratuito (D-16)— se previene en el formulario, que es donde se carga, no en el
> listado.»

El dueño pide el filtro. **Eso solo no refuta el argumento**, así que —como en
D-119 → D-132— lo que corresponde no es borrar la decisión vieja sino decidir
pagarla y escribir por qué.

### El argumento de D-74 sigue siendo cierto, para la pregunta que contestaba

«Nadie busca el taller arancelado» es verdad **como búsqueda**: para volver a
encontrar una actividad que ya se vio, el arancel no es el dato con el que se la
recuerda — se la recuerda por el título, el tallerista o el barrio, que es lo que el
buscador de texto ya cubre. Ese filtro no se agrega porque D-74 se haya equivocado.

### Lo que cambió, que es la pregunta

La que se pide contestar no es «¿cuál era?» sino **«¿qué tengo publicado que sea
gratis?»**. Es de **repaso**, no de búsqueda: se hace sobre el listado entero y no
sobre una actividad, y aparece cuando alguien quiere saber si la agenda tiene
suficiente oferta sin costo, o revisar que las ocho gratis estén bien cargadas antes
de difundirlas. Esa pregunta **el buscador de texto no la puede contestar**: el
arancel no está en el `searchText` (§6, que lleva título, descripción, sede, barrio,
organizador y tallerista), y aunque estuviera, tipear «gratis» traería también las
que lo digan en la descripción.

Y hay un dato objetivo que D-74 no podía tener: **razonaba en parte sobre que «el
sitio público todavía no existe»** (lo dice en la fila de `destacado`). Hoy existe, y
el arancel es un **eje de filtro del sitio** desde B-227, y el segundo desde D-151.
Cuando el público filtra por algo, quien publica necesita poder mirar su listado por
lo mismo: si no, revisa una lista distinta de la que la gente ve.

### Qué se paga

Un desplegable más en un panel que ya tenía cinco, en una pantalla que D-74 dejó
colapsada justamente porque en 360px cinco desplegables abiertos empujan el listado
abajo del pliegue. Se acota igual que el barrio: **el filtro solo aparece si alguna
actividad tiene arancel cargado**, y sigue todo detrás del botón «Filtros» con su
contador — que ahora puede llegar a seis.

### Detalles

Va **pegado a «Tipo»** y antes de modalidad, por lo mismo que en el sitio (D-151), y
ordena con el **mismo comparador** (`primeroSinCosto`): lo que no se paga arriba. El
desempate adentro de cada grupo sí difiere y a propósito — el sitio por cantidad de
actividades, el panel alfabético como sus otros cuatro desplegables. Lo que no puede
pasar es que «Arancelado» quede arriba de «Gratis» en una pantalla y abajo en la
otra: es la misma lista mirada por dos personas que hablan entre ellas.

El filtro compara con el default de lectura puesto (`a.arancel?.tipo ?? ''`): una
actividad vieja sin el objeto cargado queda afuera de cualquier valor concreto, que
es lo correcto, y no rompe el listado entero.

### Los otros tres descartes de D-74

| Filtro | ¿Caducó el motivo? |
|---|---|
| `tags` | **A medias, y se anota** (B-274). D-74 lo descartó porque «hoy nadie cura esa lista: sin normalización de etiquetas ni UI de administración (B-05, B-06) el desplegable sería un catálogo de variantes de lo mismo. Cuando exista B-06, se reconsidera». **B-05 y B-06 existen desde hace semanas**, así que la condición que el propio D-74 puso se cumplió. Lo que sigue en pie es la otra mitad: es multivaluado y necesita un control de selección múltiple, que ninguno de los seis desplegables actuales tiene. No se agrega ahora porque no se pidió |
| `destacado` | **Sí caducó, y se anota** (B-274). Era «un booleano que hoy no consume nadie: el sitio público todavía no existe». Hoy existe y la fila del listado pinta «Destacada», así que el booleano lo consume alguien. No se agrega ahora porque no se pidió, y porque con pocas destacadas un filtro booleano compra menos que un orden |
| quién la cargó | **No.** El motivo era que el dato es un identificador de usuario y no un nombre, y que el §5.1 los mantiene fuera de todo lo que se muestre. Las dos cosas siguen igual |

---

## D-153 · El color del tipo también pinta la ficha del detalle, y ese es otro par de contraste

**Contexto.** D-150 le devolvió el color a la cajita de la categoría, pero solo en el
listado. La ficha de `/actividad/{slug}` seguía en `bg-azul` fijo, con un comentario
al lado que decía «es la misma que abre cada fila del listado: quien viene del
listado reconoce la pieza». D-150 volvió falsa esa frase el mismo día: quien navegaba
del listado al detalle **veía la cajita saltar de color**, que es exactamente lo
contrario de reconocer la pieza. Lo encontró el `auditor-trampas` al cerrar B-270 y
quedó anotado como **B-273**; la propia D-150 lo dejó escrito en su tabla de «lo que
queda afuera», con la advertencia de que no era una omisión inofensiva.

No se hizo ahí porque `[slug].astro` y `detallePublico.ts` los estaba tocando otro
frente en paralelo (las imágenes), y tocar los mismos archivos desde dos lados es
cómo se pierde trabajo.

### El color llega resuelto, porque la plantilla no puede resolverlo

`DetallePublico` gana `tipoColor: string` — el `oklch(...)` ya calculado con
`colorDeTipo`, **la misma función que usa la fila**. No es una comodidad: la página
de detalle recibe el view-model y nada más (D-140), así que no tiene las opciones en
la mano y no puede saber qué matiz se eligió. Derivarlo en la plantilla habría
significado darle acceso a la taxonomía, que es justo lo que D-140 cerró.

Va por `style` inline y no por clase de Tailwind, por lo mismo que en la fila:
Tailwind solo genera lo que **ve escrito en el fuente**, y una clase por tipo dejaría
sin color al tipo que alguien cree mañana desde «Otro».

### `tonosDelSitio()` es el único lugar del build que arma el mapa

La home lo derivaba por su cuenta (`tonosDeTipo(indice.opciones)`) y el detalle
habría necesitado el suyo. Dos derivaciones del mismo valor son dos maneras de que
una quede vieja —la clase de B-88— y acá el síntoma sería precisamente el bug que
esta decisión arregla, así que el mapa se arma **una vez**, en
`contenidoDelSitio.ts`, y lo consumen las dos pantallas.

**Sale del índice, o sea de las opciones ya filtradas por aprobación**, y esa es la
asimetría opuesta a `etiquetasDelDetalle` (D-30). Las dos mitades tienen su motivo y
conviene tenerlas juntas:

| | Qué lista | Por qué |
|---|---|---|
| la **etiqueta** del detalle | sin filtrar | D-30 — resolver no es ofrecer: una actividad publicada puede tener guardada una opción todavía pendiente, y su página tiene que poder decir «Con beca parcial» |
| el **color** del detalle | filtrada | B-273 — tiene que coincidir con el del listado, y el listado solo puede usar la filtrada: es la que viaja en el `events.json` y la que la island vuelve a leer al hidratar. Con la lista sin filtrar, un tipo pendiente pintaría el matiz elegido en el detalle y el derivado en la fila — el salto de color de vuelta, ahora **solo para los tipos pendientes**, o sea invisible |

Lo pidió el `auditor-privacidad` y quedó atado con un test de integración: un
`opciones/tipo` con un tipo pendiente que tiene matiz elegido, y la afirmación de que
el detalle pinta el derivado y **lo mismo** que la fila.

### El cuarto parámetro de `detalleDeActividad` es obligatorio, no opcional

`tonos` podría haber tenido un default `{}` y no lo tiene. Un default deja al detalle
derivando del slug mientras el listado usa lo elegido: el mismo bug, en silencio, y
**solo para los tipos que alguien pintó a mano** desde Opciones — o sea invisible
hasta que se usa la pantalla que existe para eso. Obligándolo, un llamador que se
olvide no compila.

### El par de contraste no es el mismo, y hay que medirlo aparte

Esta es la parte que no era obvia. En la fila, la cajita es **el color como texto y
borde sobre el papel**; en la cabecera del detalle es **tinta plena con el papel
calado encima**. Son dos pares distintos, y el sistema visual los tabula por separado
(`docs/referencias/sistema-visual.md`, «Y el texto calado sobre las tintas»)
justamente porque un color puede pasar en uno y no en el otro. La garantía de D-150
—los 360 matices contra las tres superficies— cubre el primero y no dice nada del
segundo.

`contrasteCaladoDelTono` (`identidad.ts`) mide el segundo, y `color-de-tipo.test.ts`
lo recorre sobre **los mismos 360** y no sobre los siete tipos de hoy: el matiz de un
tipo nuevo lo decide un slug que todavía no existe.

| Dirección | Dónde | El peor de los 360 |
|---|---|---|
| el color **como texto**, contra las tres superficies | la cajita del listado | **5,90:1** |
| el **papel calado** encima del color | la cabecera del detalle | **7,27:1** (tono 191) |

Contra un piso de 4,5. Y contra el `azul` fijo que había antes, que calado daba
**6,14:1**: el cambio no gasta contraste, lo gana.

**`revisarTono` sigue midiendo solo la dirección de texto, y no es un olvido.**
`contrasteDelTono` es el **mínimo** contra las tres superficies y `papel` es una de
las tres, así que el calado —que es el contraste contra `papel` a secas— nunca puede
dar menos. Una guarda que sumara este par rechazaría exactamente lo mismo con dos
mensajes distintos. Lo que sí se puede romper es la premisa —que el papel esté entre
las superficies del mínimo— y eso es lo que el test fija.

### La red que faltaba

**No existía ningún test que comparara el color del tipo entre las dos pantallas.**
Es la clase de B-88 —dos derivaciones del mismo valor separándose— con las dos
mitades a la vista, y por eso el bug pasó por dos cierres sin que nada fallara. Ahora
hay tres cosas:

- el caso cruzado en `color-de-tipo.test.ts`, que compara **los dos valores
  producidos** y no las dos funciones (es lo que sigue siendo cierto el día que
  alguna cambie de forma);
- el describe del calado sobre los 360;
- el guard de markup en `detalle-visual.test.ts`, gemelo del que ya tenía el listado:
  una clase de fondo sobreviviente le gana al `style` inline, y el resultado es la
  cabecera pintada de un color que no es el de su categoría.

`tono` pasa a llegar a **dos** salidas —el `events.json` y, como color ya resuelto,
la página de detalle— y el registro de caminos de una opción pasa de cuatro a cinco.
El quinto (`tonosDeTipo`) **no lee el documento**: recibe `OpcionPublica[]`, o sea la
salida de `opcionesPublicas`, así que estructuralmente no puede alcanzar
`huellaCreador`, `usos` ni `aprobada`. Es la misma herencia que hace segura a la
salida 7.

### Lo que se miró y no era el mismo bug

**El rótulo de la cartelera** (`{tipo} · {cuándo}`, en `azul`) es la otra pieza
pública que nombra la categoría, y **se deja como está**. No es la misma pieza: no es
una cajita, es una línea compuesta donde el tipo comparte renglón con la fecha, y
pintarla de la categoría pintaría también la fecha — que es exactamente lo que D-150
dejó afuera («extenderlo al resto lo convierte en decoración»). Queda anotado como
**B-275**, en P3, para que la decisión no se vuelva a discutir desde cero.

### Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| **Dejarlo en azul y arreglar solo el comentario** | Era la salida barata y B-273 la contemplaba explícitamente. Se descarta porque la tabla de D-150 ya había marcado el detalle como «la otra candidata obvia, y **corresponde**»: el problema no era el comentario, era que la pieza se comportaba distinto en dos pantallas |
| **Pasar el matiz (`tipoTono: number`) en vez del color** | Obliga a la plantilla a llamar a `colorDeTipo`, o sea a conocer la banda. Una segunda derivación del mismo color, que es la clase que este cambio cierra |
| **`tonos` con default `{}`** | Ver arriba: reproduce el bug en silencio y solo para los tipos pintados a mano |
| **Usar la lista sin filtrar, por simetría con `etiquetasDelDetalle`** | Ver la tabla de la asimetría: la simetría cómoda es el bug |
## D-158 · Se corrige la casilla, no el comportamiento: el link de la reunión sale al calendario

**B-240**, y es la conversación que D-139 dejó abierta con nombre y apellido: «la
casilla dice *publicar el link en el sitio* y el sitio no lo publica». El ítem
ofrecía dos salidas —cambiar el texto, o publicar el link en el detalle y aceptar
el riesgo—. **Se elige cambiar el texto.**

### El argumento de D-139 es asimétrico, y por eso gana

Las dos salidas parecen simétricas —«que la casilla diga la verdad» vs. «que el
sitio cumpla lo que la casilla dice»— y no lo son:

| | ¿Se puede volver atrás? |
|---|---|
| link en la **descripción del evento** de Calendar | **sí**: se destilda la casilla, el sync reescribe el evento y el link deja de estar. Quien lo copió lo tiene, pero no queda publicado en ningún lado |
| link en la **página de detalle** | **no**: es un HTML que Google indexa. Queda en el índice, en la caché de Google, en archive.org y en cualquier scrapeo que haya pasado. Sacarlo del repo no lo saca de ahí |

Publicar un link de reunión en una página indexable es **irreversible de una forma
en que ponerlo en el evento no lo es**. Entre una inconsistencia de texto —que se
arregla escribiendo— y una publicación que no se puede deshacer, se elige la que
tiene vuelta. Es el mismo criterio con el que D-139 se decidió; acá solo se lo
lleva hasta su consecuencia en la UI.

### A dónde sale de verdad, que es lo que el texto tiene que decir

**A un solo lugar: la descripción del evento de Google Calendar**
(`functions/calendario.js`, `Link: <url>`). Es donde lo ve quien está suscripto al
calendario público, y es la única salida que la casilla gobierna.

Y acá el ítem B-240 —y la primera versión de esta decisión— decían de más. Lo
encontró el `auditor-privacidad`: el ítem afirma que «el link va al `events.json`
y a la descripción del evento», y **al `events.json` no va**. La confusión está en
que D-139 tiene dos filas distintas:

| | ¿Lleva el link con `urlPublica: true`? | Qué es |
|---|---|---|
| 1a · la **proyección** `toPublic` | **sí** (D-15) | un valor en memoria del build |
| 1b · el **índice**, que es el `events.json` que se sube | **no** (D-129) | el archivo público |

`entradaDeIndice` emite `online: { plataforma }` y nada más, así que el link muere
en la proyección y nunca llega a un artefacto. Lo fija el gate del build:
`scripts/build-contra-emulador.mjs` siembra `urlPublica: true` con un centinela y
falla si aparece en `dist/events.json`.

Por eso el texto de la casilla dice «es el único lugar a donde sale» y no menciona
ningún archivo de datos. Prometer una salida que no existe es peor que un texto
vago: el arreglo natural de quien note la discrepancia es *hacer que el código
coincida con el texto*, agregándole la `url` al índice — y eso es la trampa 5
servida en lote, que es exactamente lo que D-129 cerró.

La página de detalle **no** (D-139), el índice del listado **no** (D-129), el
posteo para redes **no**, la analítica **no**, el issue de GitHub **no**. La tabla
completa de las siete salidas está en D-139.

### El texto nuevo

| Dónde | Antes | Ahora |
|---|---|---|
| la casilla (`ModalidadesEditor.tsx`) | «Publicar el link en el sitio.» | «Publicar el link en el evento del calendario, que es donde lo ve quien está suscripto.» + «Es el único lugar a donde sale. En la página de la actividad **no** aparece, ni tildado: una página que Google indexa no se despublica.» |
| el aviso al lado | zoombombing, y se queda | igual, sin tocar: sigue siendo lo que hay que saber antes de tildarla |
| la ayuda del panel (`ayuda.ts`, `link-reunion`) | «Solo sale al sitio y al evento del calendario si tildás…» | «sale en el evento del calendario público —donde lo ve quien está suscripto— y en ningún otro lado», con el porqué de que la página quede afuera |
| el campo faltante (`camposFaltantes.ts`) | «Publicar el link en el sitio» | «Publicar el link en el calendario» — es el nombre con el que hay que ir a buscarla |
| el campo «Link del encuentro» | «No se publica: se manda al inscribirse.» | «**Por defecto** no se publica: se manda al inscribirse.» — era falso con la casilla tildada |

### Lo que NO cambia, y es la mitad importante

`online.url` **sigue sin salir a la página de detalle**, ni con `urlPublica: true`.
El barrido de centinelas lo fija con su propio caso («con `urlPublica: true` el
link de la reunión TAMPOCO sale al detalle»), que además es ahora uno de los
`atadoA` del punto de la guía: si mañana alguien publica el link en el detalle, el
test se pone rojo y la guía que promete lo contrario se rompe en el mismo commit.

### Si el dueño prefiere la otra salida

La conversación queda abierta y el lugar es este documento, no un `?.url` agregado
sin ruido. Lo que hay que saber para decidirla es lo de la tabla de arriba: el
costo de publicar el link en el detalle no se paga el día que se publica, se paga
para siempre.


---

## D-159 · La heurística del §7.3 no sobrevive en producción: «estuvo publicada» se prueba por el historial

**B-110.** Una actividad cancelada conserva su página **solo si estuvo publicada
alguna vez** — una que nace y muere en `cancelado` nunca fue pública, y publicarla
ahora es filtrar un borrador por otra puerta. Eso no es un dato del modelo, y el
§7.3 del diseño proponía inferirlo: *«alguna sesión tenga `calendarEventId`: el
sync solo crea eventos de Calendar para actividades publicadas, así que su
presencia prueba que estuvo publicada»*.

### El razonamiento es correcto y el dato se borra solo

Al pasar a `cancelado`, `debeExistir` da `false` para todas las sesiones, el sync
borra los N eventos y —esto es lo que el §7.3 no tuvo en cuenta— **escribe
`calendarEventId: null` de vuelta en cada sesión**. Es `reponerIds`, y no es un
detalle de implementación: es lo que B-80 arregló, para que una edición hecha
sobre un snapshot viejo no cree un segundo evento.

Para cuando el build lee el documento, la prueba que el §7.3 pedía la borró el
propio sync. **Con esa heurística sola, B-110 no habría generado ni una página en
producción** — habría pasado todos sus tests y no habría hecho nada, que es la
peor forma de cerrar un ítem.

### Lo que sí sobrevive

`guardarVersion` (§12) guarda el documento **anterior** a cada edición de
contenido en `/actividades/{id}/versiones/{version}`. Cancelar es un cambio de
contenido —`estado` no está en `CAMPOS_DE_MAQUINA` (D-41)—, así que deja una
versión cuyo `documento.estado` es `'publicado'`. Y una actividad que nunca lo
estuvo no puede tener ninguna: es el mismo tipo de rastro que el §7.3 buscaba, en
el único lugar donde nada lo borra.

### Cómo queda `estuvoPublicada`

```
1 · ¿alguna sesión conserva su `calendarEventId`?   → sí: estuvo publicada
    (la heurística del §7.3, primera porque es gratis y a veces alcanza —
     un sync que no llegó a correr, un borrado que falló)
2 · ¿hay una versión con `documento.estado == 'publicado'`?
    `.limit(1).select()` — pregunta de existencia
```

**No se lee un solo campo de las versiones**, y eso importa: una versión es el
documento **entero** de aquel momento —`difusion`, `online.url`, uids,
`storagePath`— y nada de eso tiene por qué entrar al proceso que genera un HTML
indexado. El `.select()` sin argumentos devuelve documentos con id y nada más, y
el valor de retorno de la función es un booleano. `tests/pagina-de-detalle.test.ts`
lo fija sobre el fuente, porque es una propiedad de la **forma**: sin el
`.select()` la función devuelve exactamente lo mismo y la suite entera queda
verde.

### Lo que se paga, dicho

| | |
|---|---|
| una query por cancelada | son un puñado de documentos, y solo las canceladas la pagan. Las publicadas no leen nada nuevo |
| el build toca la subcolección `/versiones` | es el caso que `07-seguridad.md` tenía anotado como «lo que sí hay que no hacer», con la condición que pedía cumplida: la lectura queda afuera de todo lo que se proyecta |
| la retención de D-42 | 20 versiones por actividad. Editar una **cancelada** 20 veces empuja la versión publicada afuera y la página vuelve a dar 404. **Falla cerrado**, que es el lado correcto del error |
| el campo explícito sigue faltando | `publicadaAlgunaVez: boolean` es lo correcto y era la decisión 4 del §11.1 del diseño. Queda en **B-285**, y no bloqueaba: sin él, esto funciona hoy y para los documentos que ya existen — que es lo que un campo nuevo **no** puede hacer |

Esa última fila es la que decidió el orden. Un `publicadaAlgunaVez` escrito por el
panel solo sirve **hacia adelante**: una actividad ya cancelada en producción no
lo tiene, y seguiría dando 404 hasta que alguien la vuelva a guardar. El historial
funciona retroactivamente, que es donde está el problema que B-110 vino a
resolver.

### Y el estado no se proyecta

`DetallePublico` gana un `cancelada: boolean` que llega **como argumento** de
`detalleDeActividad`, no adentro de `ActividadPublica`. Es lo contrario de lo que
B-112 anticipaba —«`estado` en la proyección pública, lo necesita B-110»— y es
mejor: el único que sabe de qué query salió cada documento es el lector, `toPublic`
no gana un campo, y el `events.json` no puede publicar un estado por accidente.
B-112 se queda con `actualizadoEn`, que sigue haciendo falta para el `lastmod`.
## D-155 · Las páginas de mes se desvían del §2.2 y el §7.5 en cuatro puntos

**Contexto.** B-113, 2026-09-01. El §2.2 de [`12-sitio-publico.md`](12-sitio-publico.md)
diseñó `/agenda/{aaaa-mm}` con condiciones precisas, y las cuatro se
implementaron tal cual: solo meses vigentes, solo con **3 o más** actividades,
fuera de la navegación, y la URL que no se rompe cuando el mes termina.

Lo que sigue son los cuatro puntos donde el diseño **describe el estado final**
—dominio elegido, sitemap armado, `/pasadas` construida— y B-113 se escribió
antes de esas tres cosas. Van juntos y no en cuatro entradas justamente por eso:
tienen una sola causa, y separados alguien resuelve el primero sin darse cuenta
de que el segundo se destraba con lo mismo.

> ✅ **Y se destrabaron con lo mismo, al día siguiente: B-109 (2026-09-02).** Los
> puntos 1 y 2 de abajo dicen «`/pasadas` todavía no existe» y «no hay sitemap
> todavía», y las dos cosas existen. Lo que pasó con cada uno:
>
> - **el punto 1 se cerró como estaba previsto** —una línea en
>   `DESTINO_DEL_MES_VENCIDO`— y es **B-281**, hecho el 2026-09-02;
> - **el punto 2 quedó como este texto anticipaba**: las dos cosas conviven. La
>   vencida no entra al sitemap (`mesesEnlazables`, no `mesesDelSitio`) **y**
>   sigue emitiéndose con `noindex` para que su URL no se rompa.
>
> Los puntos 3 y 4 no dependían del dominio y siguen valiendo tal cual. Esta
> entrada no se reescribe: la predicción y su cumplimiento valen más juntos.

**1 · El aviso del mes vencido manda a `/`, no a `/pasadas`.**
`/pasadas` es parte de **B-109** y todavía no existe. Enlazarla sería poner un 404
en la única salida que ofrece la página vencida, que es peor que el problema que
esa página resuelve. El destino vive en una constante —`DESTINO_DEL_MES_VENCIDO`,
`src/lib/mesPublico.ts`— y no escrito en la plantilla, así que el día que
`/pasadas` exista el cambio es una línea; y `tests/mesPublico.test.ts` verifica
que apunte a **una ruta que el sitio sirve de verdad**, o sea que falla si alguien
la apunta a `/pasadas` antes de construirla. Queda anotado como **B-281**.

**2 · «Sale del sitemap» se implementó como `noindex`.**
No hay sitemap todavía (B-109): no hay de dónde sacar la página. El gesto
equivalente que sí existe hoy es dejar de ofrecérsela al buscador sin dejar de
responderle a quien tenga el link — que es exactamente lo que el §2.2 quiere. El
día que el sitemap exista, las dos cosas conviven: la vencida no entra al sitemap
**y** sigue con `noindex`.

**3 · La tira de la home incluye el mes en curso, no solo «los siguientes».**
El §2.2 la llama «Próximos meses». Si el mes en curso quedara afuera, su página
—que el build genera igual, porque el §2.2 lo pide— no tendría **ningún** link
interno: una página estática que solo enlaza el sitemap vale casi nada para un
buscador, y es el mismo argumento con el que el propio §2.1 justifica la
existencia de `/pasadas`. Se prefiere que la tira no se llame como el diseño la
llamó antes que dejar una página huérfana.

**4 · El subtítulo del ciclo a caballo no repite el literal del §7.5.**
El diseño da el ejemplo «4 encuentros en septiembre, del 3 al 24». Un ciclo de
ocho mostrando solo esa frase en la página de septiembre **pierde el total**, y
para quien está decidiendo si se anota a un ciclo, cuántos encuentros son es el
dato. La frase quedó «Ciclo de 8 encuentros · 4 en septiembre, del 3 al 24»: la
cabeza es el total —la misma que dice la home— y la cola es el recorte al mes.
Cuando todas las fechas caen en ese mes no se repite el número, porque «Ciclo de
4 encuentros · 4 en septiembre» hace dudar de si son cuatro u ocho. Lo decide
`cicloDelMes` (`src/lib/tarjetaPublica.ts`), que es puro y está testeado.

**Y una decisión de forma que no es un desvío, pero explica el resto.** Lo que
hace que las tres frases del mes hablen del mes no es un parámetro más en cada
una: es `recorteDelMes`, que devuelve **la misma entrada con solo las sesiones de
ese mes**. Recortando la entrada, todo lo que deriva de las sesiones —el bloque de
fecha, «ya empezó», el orden de la página— habla del mes sin que ninguna frase
tenga que enterarse. Lo único que viaja aparte es el total de encuentros, que es
justo el dato que el recorte no puede perder (punto 4).
---

## D-165 · El canónico es `agendaleh.ar`, y el dominio se escribe una sola vez

**La decisión del dueño, y la que desbloqueó la cadena entera** (B-109, DEC-6).

### Qué se decidió

**`https://agendaleh.ar`** es el canónico. El dominio se registró junto con
`agendaleh.com.ar`, y `agenda-literaria.web.app` —el nombre que Firebase le da a
todo proyecto— sigue existiendo. O sea que el 2026-09-02, medido con `curl`, había
**tres hostnames sirviendo contenido idéntico**, sin canonical y sin redirección:
contenido duplicado de manual.

Se arregló ahora porque era gratis: **todavía no había nada indexado** (no existían
ni `robots.txt` ni sitemap). Mudar un canónico después de indexar cuesta meses de
posicionamiento; antes de indexar no cuesta nada.

### Las tres cosas que hacen que la decisión se sostenga

**1 · Una sola constante.** `SITIO`, en `src/lib/rutasPublicas.ts`, es la única
aparición del dominio en todo el repo. De ella salen `site` de `astro.config.mjs`
—que la **importa**, no la copia—, el `canonical`, el `og:url`, las URLs del
JSON-LD y el `sitemap.xml`.

Son **cuatro** consumidores, y las cuatro copias fallan en silencio: un canonical
viejo hace que Google indexe otro dominio, un `og:url` viejo manda a otra parte el
link pegado en Instagram, un sitemap viejo ofrece URLs que no responden, un JSON-LD
viejo apunta el resultado enriquecido a otro sitio. Ninguna se ve mirando la
página. Es la clase de B-88 con cuatro consumidores, y por eso `tests/canonico.test.ts`
falla si el dominio aparece escrito en cualquier archivo de `src/` que no sea el
que lo define.

**2 · El canonical es absoluto.** Es lo que hace que los otros dos nombres puedan
seguir respondiendo sin costo: `agenda-literaria.web.app` **no se apaga nunca**
—Firebase no lo permite— y sirve este mismo HTML. Un canonical relativo se
resuelve contra el host que lo sirvió, así que en el espejo diría que la página
buena es la del espejo, que es exactamente el contenido duplicado que esto viene a
cerrar. Con el absoluto, los tres nombres le dicen a Google lo mismo: la buena es
`agendaleh.ar`.

**3 · Con barra final, salvo los archivos.** Medido contra producción:
`curl -I https://agendaleh.ar/cartelera` devuelve **301** a `/cartelera/`, que es
el comportamiento por defecto de Firebase Hosting con las páginas que Astro emite
como `carpeta/index.html`. Una canónica que apunta a una redirección es un aviso
en Search Console («la URL canónica alternativa es una redirección») y una entrada
de sitemap que redirige es una URL menos rastreada. Así que `rutaCanonica` agrega
la barra — y **no** la agrega cuando la ruta es un archivo de la raíz
(`/sitemap.xml`, `/robots.txt`, `/events.json`, `/version.json`), donde una barra
final es un 404.

Que los `href` internos del sitio sigan sin barra —y por lo tanto coman un 301 al
navegar— es una deuda chica y anotada: **B-293**.

> ✅ **Cerrada el 2026-09-02 — D-180.** Los `href` internos van hoy por
> `rutaCanonica` igual que la canónica, así que hay **una sola forma** de la ruta y
> un solo lugar donde darla vuelta. Se eligió eso antes que `"trailingSlash": false`
> en `firebase.json`, y el motivo está abajo.

### Lo que no se decidió acá

El **301 de `agendaleh.com.ar`** y el `www` se configuran en la consola de
Firebase, no en el repo: son acción del dueño y están escritos paso por paso en
[`08-operacion.md`](08-operacion.md) § «El dominio», junto con las dos trampas de
falla diferida que la investigación del dominio encontró (el TXT de verificación
es permanente; la renovación de NIC.ar no es automática y la delegación se apaga
el día 31).

---

## D-166 · El sitemap se genera a mano, y `updatedAt` viaja al lado de la proyección

**Decisión:** `sitemap.xml` y `robots.txt` son **endpoints propios**
(`src/lib/sitemap.ts` decide, `src/pages/sitemap.xml.ts` y
`src/pages/robots.txt.ts` serializan), no `@astrojs/sitemap`.

### Por qué no el integrador

No es por evitar una dependencia —aunque también: agregar una es una decisión que
este cambio no necesitaba tomar—. Es que el integrador arma el sitemap **de lo que
hay en `dist/`**, y lo que hay en `dist/` incluye, a propósito, todo lo que **no**
tiene que estar en el sitemap:

| En `dist/` | En el sitemap |
|---|---|
| la página de la actividad de hace dos años | no (90 días desde su última fecha) |
| la página de la cancelada de marzo | no (30 días desde su última edición) |
| la página del mes vencido | no (se emite con `noindex` para que su URL no se rompa) |
| `/admin` | no |

Son **dos preguntas distintas** —«¿esta URL responde?» y «¿le pido a Google que la
rastree?»— y confundirlas es lo que llena el índice de páginas muertas. Las reglas
de qué entra son del §5.6 del diseño y no se expresan en la configuración de un
integrador.

### La fecha de las canceladas: `updatedAt`, y como predicado

El §7.3 dice «30 días **desde que se canceló**», y *cuándo se canceló* no es un
dato del modelo (igual que «estuvo publicada alguna vez», B-285). Las tres opciones
las había razonado el propio ítem B-109:

| Fecha | Sirve | Problema |
|---|---|---|
| `updatedAt` | es la edición que la canceló, si nadie la tocó después | cualquier corrección posterior corre el reloj; y **no está en la proyección** |
| la versión de `/versiones` cuya edición cambió `estado` | es la fecha exacta | una lectura más por cancelada, y la retención de D-42 la puede podar |
| `publicadaAlgunaVez` + un `canceladaEn` | exacto y barato de leer | dos campos nuevos |

**Se eligió `updatedAt`**, con su error dicho: correr el reloj hacia adelante deja
la URL un poco más de tiempo en el sitemap, que es el lado inofensivo del error.

Y la parte que importa: **no se agregó a la proyección.** `toPublic` deja
`updatedAt` afuera a propósito —publicar una fecha de modificación convierte cada
corrección de un typo en «actualizado hoy»— y `07-seguridad.md` promete que no sale
a ninguna salida. Así que el dato lo lee **el lector** (`contenidoDelSitio.ts`),
que es el único que ve el documento crudo, y viaja **al lado** de la proyección en
un mapa `slug → ISO` (`canceladasEditadasEn`). Es el mismo patrón con el que B-110
resolvió la bandera `cancelada`: lo decide quien tiene el dato, y se pasa como
argumento en vez de agregarle un campo a la frontera de privacidad.

Lo que hace que esto **no** agrande la superficie pública es que la fecha es un
**predicado y no un dato de salida**: decide si la URL entra al sitemap y no se
emite en ninguna parte. El sitemap va **sin `lastmod`** —estampar la fecha del
build en las N entradas le enseña a Google que nuestras fechas mienten, y a partir
de ahí deja de mirarlas—, así que `updatedAt` sigue sin salir. El `lastmod` de
verdad necesita **B-112**, y el test lo fija para que agregarlo sea una decisión.

### Y `robots.txt` es un endpoint por la misma razón que todo lo demás

Un archivo en `public/robots.txt` habría sido la segunda copia del dominio: su
línea `Sitemap:` lleva la URL absoluta. La que quede vieja el día que el dominio
cambie apunta el sitemap a un host que no responde, sin que nada falle de este
lado.

Sobre `/admin` hay una sutileza que conviene tener escrita: **el `Disallow` no
reemplaza al `noindex` de la página**. Un `Disallow` impide el rastreo, y por eso
mismo impide *leer* el `noindex`, así que Google puede listar una URL bloqueada si
alguien la enlaza («indexada aunque bloqueada»). Se acepta porque `/admin` no está
enlazada desde ninguna página pública y lo que se gana es que ningún rastreador
baje el bundle del panel; si algún día apareciera indexada, la respuesta es
**sacar el `Disallow`** y dejar el `noindex`, no agregar nada.

---

## D-167 · `/pasadas` sin atenuar y sin buscador — dos desvíos del §4.5

**Decisión:** la página del archivo se construyó con las filas **iguales** a las
del listado y **sin** buscador, contra las dos cosas que el §4.5 pedía («mismas
tarjetas, atenuadas… sin filtros salvo la búsqueda»).

**1 · Sin atenuar, porque el sistema visual lo prohíbe.** El §4.5 se escribió
antes del rediseño de D-146, cuyo tercer principio es «tintas con nombre, no
opacidades: una opacidad es una trama de medio tono, y además es por donde se cae
el contraste» (B-235). Atenuar cuarenta filas sería bajarle el contraste a la
página entera.

Y no hace falta: la fila **ya** distingue una pasada, con la herramienta que el
sistema sí da. El bloque de fecha va en `super` y no en terracota —«el terracota
es la tinta de lo que se puede hacer, y un bloque terracota en algo que ya pasó
promete una acción que no existe»— y dice «Pasó» en vez de la fecha. La distinción
está, sin tocar el contraste de nadie.

**2 · Sin buscador, porque es un cambio de la island.** La búsqueda del sitio es
la island de la home, que filtra `vigentesDelIndice` — o sea el índice de lo
**vigente**, que por definición no incluye una pasada. Enseñarle un modo nuevo es
un cambio de la island y de su contrato con el `events.json`, no de esta página.
Queda como **B-292**; mientras tanto la página enlaza la búsqueda de la agenda,
que es lo que sí existe.

**Lo que sí se cumplió del §4.5, palabra por palabra:** la cabecera («Lo que ya
pasó. Muchas de estas actividades se repiten: si te interesa una, seguí a quien la
organiza»), la agrupación por mes y el orden de más reciente a más antiguo.

**Y una razón de ser que el diseño no le daba.** El §2.1 justifica `/pasadas`
porque «ninguna página de detalle puede quedar huérfana». Con B-109 eso se volvió
literal y medible: la entrada del sitemap de una pasada **vence a los 90 días**,
así que a partir de ese día esta página es el **único** link interno que la
apunta. Por eso se enlaza desde el pie de todas las páginas y no desde una sexta
pestaña del encabezado: alcanza un link permanente, y una pestaña le daría a un
archivo el mismo peso que a la agenda.

El invariante que lo sostiene está en un test: **la home y `/pasadas` parten en
dos el conjunto de las publicadas** — ninguna en las dos, ninguna en ninguna.

---

## D-168 · Las secundarias del detalle son decorativas, y la cuenta se dice una vez en el encabezado

**Contexto.** B-296. La página de detalle hacía `detalle.imagenes[0]` y pintaba
**una sola** imagen. No era un olvido: se decidió así al escribir la página, con
el argumento de que «la actividad tiene una portada opcional» (la corrección 1 de
[`referencias/stitch-detalle.md`](referencias/stitch-detalle.md), que sacaba una
grilla de tres fotos de relleno). Lo que cambió es el dato: hay galerías cargadas
y esas imágenes **no se veían en ninguna salida del sitio**.

**Medido contra producción el 2026-09-02**, leyendo Firestore, 46 publicadas:

| Imágenes | Actividades |
|---|---|
| 0 | 16 |
| 1 | **26** |
| 2 | 3 |
| 3 | 1 |

Las 30 imágenes son **todas propias** (Firebase Storage); no hay ni una externa.

**Eso decide la forma antes que cualquier consideración estética: el caso normal
es una sola imagen.** Una galería que se ve bien con tres y rara con una está mal
resuelta, porque con una es el 87 % de las páginas que tienen imagen. De ahí la
primera decisión, que es la que ningún markup deja ver: **con una sola imagen la
sección no existe en el HTML** — ni el encabezado, ni un hueco, ni una segunda
copia de la portada. La página de las 26 es la de antes.

### 1 · El texto alternativo, que es el problema real

DEC-7a (**D-125**) decidió que hay **un solo campo opcional** por imagen —el
epígrafe— y que el texto alternativo sale del **título de la actividad**. Fue una
decisión de accesibilidad tomada a propósito, con su contra asumida por escrito:
«las cuatro imágenes de una actividad comparten el mismo alternativo, que para un
lector de pantalla es repetición».

Con una imagen eso funciona y es lo correcto: «Imagen de *Usted está aquí*»
describe el afiche mejor que el «foto» que produce un campo obligatorio en un
panel de una persona. **Con tres, el mismo alt tres veces es peor que no
tenerlo**: se anuncia lo mismo tres veces seguidas y no se distingue ninguna de
las tres.

B-296 dejó las cuatro salidas escritas. La elegida y por qué las otras no:

| Salida | Por qué no |
|---|---|
| el epígrafe, cuando está, es el alt | **es el que menos hace de los cuatro, y eso está medido**: de las 4 imágenes secundarias que hay en producción, **ninguna** tiene epígrafe cargado. O sea que hoy describiría cero imágenes y dejaría igual el caso «sin epígrafe», que hay que decidir de todas formas. Y donde sí hubiera epígrafe, ponerlo en el `alt` **además** del `figcaption` lo hace anunciar dos veces |
| enumerar: «Imagen 2 de 3 de *X*» | dice la misma frase tres veces para transmitir un dato —cuántas hay— que se dice una sola vez. Y describe la **estructura de la página**, no la imagen: no hay nada ahí que sirva para decidir si ir al taller |
| un campo de texto alternativo por imagen | es lo correcto en abstracto y **reabre DEC-7a**, que lo descartó explícitamente. No es una decisión de implementación: es del dueño. Queda anotada en **B-301** |
| **las secundarias son decorativas (`alt=""`), y la cuenta va en el encabezado** | **la elegida** |

**La decisión, en tres reglas:**

1. **La portada conserva su alt del título.** Es una sola, es el afiche, y es la
   que alimenta el `og:image`. DEC-7a no se toca donde funciona.
2. **Las secundarias van con `alt=""`.** Es lo que declara «decorativa», y es
   honesto: la información con la que se decide ir —qué, cuándo, dónde, cómo
   anotarse— está en el texto de la página, y de esas fotos no tenemos nada que
   decir que no sea el título que la portada ya dijo.
3. **Lo que se calla en el `alt` lo dice el `<h2>`, una vez y en prosa:** «Dos
   imágenes más» (`rotuloDeGaleria`, en `lib/afiche.ts`).

**La tercera es la que hace aceptables a las otras dos**, y es lo que separa esta
decisión de «no poner alt y listo». Sin encabezado, `alt=""` en todas deja el
grupo entero fuera del árbol de accesibilidad: quien escucha la página no se
entera de que hay más imágenes, y no puede ni saber que no se está perdiendo
nada. Con el encabezado se entera, se entera **una vez**, y se entera en una
frase escrita por una persona en vez de un contador. Es la salida de enumerar,
subida un nivel: del `alt` de cada imagen al nombre del grupo.

Y el número va en palabras —«Una», «Dos», «Tres»— porque es un encabezado de
sección al lado de «Material» y «Quién lo da». El texto vive en `lib/` y está
testeado, por lo mismo que el de «Suscribirse» (**D-133**): un rótulo escrito en
la plantilla no tiene forma de probar que diga «Una imagen más» y no «1 imágenes
más».

**El epígrafe es el `figcaption` de su imagen y nunca el `alt`.** Cada secundaria
es su propia `<figure>`, así que el pie queda atado a la imagen que describe y no
suelto debajo de la fila; y como el `figcaption` ya lo lee un lector de pantalla,
copiarlo al `alt` solo agrega una repetición. Encima el `figcaption` lo ve **todo
el mundo**, que es más de lo que consigue un `alt`.

**Lo que esta decisión renuncia, dicho explícito:** una foto secundaria con
contenido —la fachada del lugar, la tapa del libro— no se describe. Es la contra
de la salida elegida, y es lo que el dueño tiene que mirar (B-301).

### 2 · La forma: al final del contenido, en grilla, y sin recortar

**Va al final de la columna de contenido, antes del colofón «Organiza», y no
debajo de la portada.** Tres razones que apuntan al mismo lugar:

1. **La pregunta de la página se contesta arriba.** El recorrido mayoritario cae
   desde Google o Instagram y pregunta «¿esto me sirve y todavía puedo entrar?»
   (§1 del diseño). Una tira de fotos entre la portada y la descripción empuja la
   respuesta hacia abajo justo en el teléfono, donde la portada ya puede medir
   70svh.
2. **`loading="lazy"` solo sirve si de verdad están abajo.** No es una promesa: es
   una pista que el navegador atiende según la distancia al viewport. Pegadas a la
   portada entran en la primera pantalla de un escritorio y se piden igual. **La
   posición es parte de la optimización, no una preferencia de diseño**, y por eso
   hay un test que la fija.
3. **Son de apoyo, y el orden lo dice.** El afiche es la portada; las secundarias
   reales son fotos del espacio o de ediciones anteriores. Arriba las ascendería a
   algo que no son.

**Grilla de dos columnas, tres en `sm` cuando son tres** (`CLASES_DE_GALERIA` en
`components/sitio/estilos.ts`, con el tope en `columnasDeGaleria`). Dos cosas que
se pueden discutir mirando esas dos piezas:

- **Con una sola secundaria son dos columnas y no una**, o sea media columna de
  ancho. A ancho completo la página tendría dos imágenes protagonistas y ninguna
  portada. Y una sola secundaria es el caso frecuente: 3 de las 4 actividades con
  galería tienen exactamente dos imágenes.
- **Grilla acá y columnas de CSS en la cartelera** (**D-148**), y no es
  inconsistencia. Allá una fila de afiches de altos distintos deja huecos debajo
  de los más bajos, y las columnas lo resuelven; acá la fila tiene dos o tres
  elementos y **una sola línea**, así que no hay «debajo» que rellenar, y la
  grilla da lo que las columnas no dan: cada celda mide lo mismo de ancho, o sea
  que dos imágenes de formas distintas salen a la misma escala en vez de una
  grande y una chica según cómo CSS reparta el alto.

**Ninguna se recorta, y esa era la parte difícil** (**D-147**). Tres imágenes de
proporciones distintas sin recortar y sin que la página quede a los saltos se
resuelve con lo que ya estaba: `claseAfiche` trae `object-contain` y cada imagen
reserva **su** caja con `estiloDeAfiche(imagen)` desde su `ancho`/`alto`. Las tres
imágenes de «Usted está aquí» son cuadrada (1024 × 1024), apaisada (1408 × 768) y
apaisada chica (548 × 364) — el caso que rompe una caja fija, y el que el gate
mecánico siembra.

**Y la celda no lleva el `max-h-[70svh]` de `claseAfichePortada`**, a propósito:
en una celda que mide la mitad o un tercio de la columna, el ancho ya limita el
alto. El tope además dejaría una foto vertical encogida entre dos bandas de papel,
que es el aspecto que B-263 vino a sacar.

### 3 · El peso, con los números, y el techo que se movió

La Function que recomprime (**B-220**, DEC-7d) no existe, así que una imagen
propia se sirve **tal cual la subió quien organiza**. Medido el 2026-09-02 con el
`Content-Length` real de las 30 portadas de producción: mediana **92,6 KB**, p90
**124,2 KB**, máximo **1091,5 KB**.

Las cuatro páginas que ganan imágenes, con los bytes exactos:

| Actividad | Portada | Secundarias | Total | Delta |
|---|---|---|---|---|
| 2do Festival Literario San Isidro | 106,8 KB | 107,5 KB | 214,3 KB | +107,5 KB |
| Desayuno epistolar | 60,9 KB | 51,0 KB | 111,9 KB | +51,0 KB |
| Taller de cuento (Lamberti) | 34,0 KB | 96,8 KB | 130,8 KB | +96,8 KB |
| **Usted está aquí** | **1091,5 KB** | 1808,5 + 326,7 KB | **3226,7 KB** | **+2135,2 KB** |

El markup no cuesta nada: medido sobre `dist/`, dos secundarias agregan **867 B**
en crudo y **165 B gzippeados**, o sea ~83 B por imagen. Es el mismo orden que
D-149 midió para la cartelera.

**El veredicto, en tres mitades.**

**Las 42 páginas que no ganan imágenes no cambian un byte**, y son la enorme
mayoría: 16 sin imagen y 26 con una.

**Tres de las cuatro se sostienen sin discusión.** +51 a +108 KB, por debajo de la
mediana de una sola portada, diferidas y al final de la página.

**La cuarta no se sostiene — y no se sostiene ya hoy, sin galería.** «Usted está
aquí» tiene una portada de **1,07 MB**, que es **11,8 veces** la mediana del
sitio, y una secundaria de **1,77 MB**, que es el 59 % del tope de 3 MB de DEC-7b.
La galería no crea ese problema: lo hace visible, y le agrega 2,1 MB que se bajan
solo si alguien scrollea hasta el final. **Lo que arregla esa página es B-220**, y
mientras no exista, volver a subir esas dos imágenes recomprimidas — un JPEG de
1408 × 768 no tiene por qué pesar 1,77 MB.

**Lo que sí se movió es el techo, y hay que decirlo:** con una sola imagen
servida, el peor caso legal de una página de detalle era **3 MB** (el tope de
DEC-7b). Con la galería son cuatro imágenes de 3 MB, o sea **12 MB**. Está
mitigado —`lazy`, al final, con la caja reservada— pero el techo es el techo, y es
el argumento más fuerte que tiene B-220 para subir de prioridad. Queda escrito en
**B-300**.

**`sizes` sigue sin estar, y por lo mismo que en D-149:** sin `srcset` no hace
nada, y las variantes son B-220. Un `sizes` suelto es decoración que parece
optimización — y acá se notaría más, porque servir una imagen de 1080 de ancho en
una celda de 105px es exactamente el desperdicio que las variantes arreglarían.

### 4 · Sin JavaScript, y sin una parada de tabulación más

**No hay lightbox.** La página de detalle tiene un presupuesto de **0 KB de
JavaScript** (§4.3 del diseño) y un visor modal accesible —foco atrapado, cierre
con Escape, foco devuelto al disparador— es bastante más de lo que este ítem
pedía. Sin él, la tira **no agrega ni una parada al orden de tabulación**: no hay
enlaces, no hay `tabindex`, no hay island. Se recorre con el scroll, como el resto
de la página.

Y un enlace al JPEG suelto habría sido peor que nada: con `alt=""` el enlace se
anuncia **sin nombre**, y saca a quien lo sigue del sitio a un archivo sin
navegación.

No hay ningún par de contraste nuevo: el `<h2>` es `text-tinta` sobre papel
(16,27:1) y el `figcaption` es `text-super` (6,34:1), los dos ya medidos en el
sistema visual, y el barrido de `tests/contraste-del-sitio.test.ts` cubre el
markup nuevo solo.

### 5 · Qué queda atado, y dónde

| Lo que se rompe sin que se note | Qué lo frena |
|---|---|
| una secundaria heredando el `alt` del título | `tests/galeria-del-detalle.test.ts` + paso 8d del gate mecánico |
| el epígrafe promovido a `alt` | el mismo test, **y solo ahí**: con los datos de hoy el epígrafe está vacío, así que la mutación es invisible en el HTML construido |
| un `loading="eager"` en una secundaria | el test + paso 8c del gate |
| la tira subiendo a la primera pantalla | el aserto de posición del test |
| la portada dejando de ser la primera | `tests/cartelera.test.ts` (B-268), el test nuevo, y el paso 8b del gate — cuyo fixture pone la portada **segunda** a propósito |
| la página de una sola imagen cambiando | el paso 8h del gate, sobre el HTML de verdad |
| tres proporciones saliendo con una sola caja | el paso 8e, que exige las tres `aspect-ratio` distintas |
| un `object-cover` en cualquier salida | el barrido de `tests/afiche.test.ts` (D-147), que ya cubría esto |
| un campo interno de la imagen colándose por la salida nueva (`id`, `origen`, `storagePath`) | el paso 8g: el barrido de centinelas sobre el HTML de la página **con** galería. **Faltaba**, y lo encontró el `auditor-privacidad`: el barrido de HTML que ya existía corría sobre la cancelada, que tiene una sola imagen y por lo tanto no genera la sección |
| la tira armándose con un `listAll()` del bucket (trampa 13) | el aserto que `/cartelera` ya tenía, ahora también sobre el detalle. El detalle **pasó a ser** una página de varias imágenes, así que heredó la trampa propia de esa clase |

Las 18 mutaciones con las que se validaron esos asertos están en el CHANGELOG del
2026-09-02.


---

## D-170 · Cuándo se cierra un ítem paraguas, y cuándo se descarta uno que espera al dueño

**Contexto.** El barrido de backlog del 2026-09-02. El backlog tenía 76 ítems
abiertos y doce en la sección P1, y varios ya estaban hechos: los números habían
dejado de significar algo. Al recorrerlos aparecieron dos preguntas que no eran
sobre ningún ítem en particular y que van a volver cada vez que se haga un
barrido, así que se contestan una vez acá.

La regla de fondo, de la que salen las dos: **un ítem cerrado en falso es peor
que uno abierto.** El abierto se revisa; el cerrado no lo mira nadie nunca más.
Por eso nada se cierra sin reproducirlo contra el código, y por eso las dos
respuestas de abajo son restrictivas.

### 1 · Un ítem paraguas se cierra cuando su promesa está cumplida, no cuando no le quedan hijos

**El caso.** **B-01** era «Sitio público (paso 3 del §10)» y su cuerpo decía «lo
construible son **B-105 a B-114**». De esos, B-108 (los hubs), B-112 y B-114
siguen abiertos, y B-107 quedó a medias. La pregunta es si un paraguas con
hijos abiertos se puede cerrar.

**Se cierra.** El criterio es que **el paso 3 del §10 del `CLAUDE.md` pedía que
el sitio público exista, se indexe y se use**, y eso se puede verificar: ocho
salidas indexables, dominio propio, canónica absoluta, sitemap y robots. Los
hijos que quedan son mejoras de indexación y de peso, cada uno con su número y
su prioridad — ninguno hace que el sitio no exista.

**Y la razón por la que no se deja abierto «hasta que no quede ninguno»:** un
paraguas que sobrevive a todos sus hijos deja de ser un ítem y pasa a ser una
categoría. Nadie lo puede tomar —no hay nada que hacer que no esté en otro
número— y sin embargo cuenta como trabajo pendiente, y en la sección P1 cuenta
como trabajo que bloquea el objetivo del proyecto. Eso es exactamente lo que
hacía que la lista mintiera.

**Las dos condiciones, para que esto no sea una licencia:**

1. **La promesa del paraguas tiene que ser verificable y estar verificada** — no
   «el sitio está bastante bien», sino un build verde y los artefactos leídos.
2. **Cada cosa que queda tiene que tener número propio antes de cerrar.** Si al
   cerrar el paraguas algo queda sin ítem, lo que se hizo no fue cerrar: fue
   perder el pendiente. En B-01 eso obligó a crear **B-310**, porque la página
   `/404` estaba diseñada y no tenía ítem.

### 2 · Un ítem que espera una decisión que nadie pidió se descarta, no se deja abierto

**El caso.** **B-275** — el rótulo de `/cartelera` nombra la categoría en azul
fijo y no en el color de su tipo. El ítem estaba bien escrito: se había mirado
al cerrar B-273, tenía los tres argumentos de por qué no entró y terminaba con
«qué haría falta para cerrarlo: que el dueño decida si la pared también tiene
que identificar la categoría por color».

**Se descarta.** La distinción que decide es **si hay una afirmación falsa que
corregir**. En B-273 la había: la ficha del detalle pintaba el tipo en azul fijo
**y su comentario decía que era el mismo color que el listado**. Eso es un bug de
verdad —el código y su propia documentación discrepaban— y se arregla sin
preguntarle a nadie. En B-275 no hay nada falso: hay una propuesta de diseño
nueva, coherente con el sistema visual como está, cuyo único camino a ejecución
es un pedido que no existe.

**Y lo que hace que descartarlo no pierda nada** —que es la condición—: **el
texto no se borra**. Queda el razonamiento y queda el camino corto por si el
pedido llega (una cajita como la del listado en vez de teñir la línea entera,
medida con `contrasteCaladoDelTono` o `contrasteDelTono`, sin nada nuevo que
medir). Reabrirlo es gratis y arranca con el trabajo ya hecho, que era el
propósito de haberlo anotado. Lo que se recupera al cerrarlo es que deje de
contarse como trabajo.

**El límite, dicho:** esto **no** aplica a un ítem que espera una decisión que
el dueño ya pidió o que bloquea algo. Esos son las `DEC-*` de la cabecera del
backlog y la sección «Pendiente de acción manual del dueño», y siguen abiertos
justamente porque hay alguien esperando del otro lado.

### 3 · Y una tercera, más chica: un número viejo se remide o se marca como no medido

**El caso.** **B-201** — el §1.3 de [`10-salud-del-codigo.md`](10-salud-del-codigo.md)
citaba cifras del 2026-08-27. El ítem ya traía el criterio y conviene dejarlo
escrito como regla: **ponerle un número estimado es peor que dejarlo viejo,
porque el viejo al menos se sabe viejo.**

De ahí las dos únicas salidas legítimas: **remedirlo con el criterio del conteo
escrito al lado** —que es lo que se hizo, y por eso el §1.3 ahora define sus tres
cifras arriba de la tabla— o **marcar el bloque como no medido**. La segunda es
la que aplica al resto de ese documento, que tiene el aviso en el encabezado y su
propio ítem (**B-311**).

Y el corolario que salió de remedirlo: **el «puesto en la lista» es la peor de
las tres cifras para seguir un archivo.** `ActividadFormulario.tsx` cayó de 14º a
28º sin que nadie lo tocara —catorce archivos le pasaron por arriba, seis de
ellos nacidos con el sitio público— así que baja cuando el repo crece y sube
cuando el repo se encoge, sin decir nada del archivo. Se mira junto a LOC y
fan-out, que son las que dependen de él.
## D-185 · El aviso de «lo que falta para publicar» no se debouncea, y la medición dice por qué

**B-198.** El aviso de B-183 es un `useMemo` sobre `form`, y `setForm` devuelve un
objeto nuevo en cada tecleo: **cada tecla dispara un `safeParse` de zod sobre el
formulario entero**. El ítem lo dejó sin optimizar a propósito, con dos frases: que
era "del mismo orden que el `JSON.stringify` que ya corre en cada tecla" y que "en
un teléfono viejo con un ciclo de 20 encuentros es lo primero que se notaría". Y
pedía **medir antes de tocar**.

### Lo medido

| Encuentros | `faltaParaPublicar` | `JSON.stringify` del mismo form |
|---|---|---|
| 1 | 0,107 ms | 0,001 ms |
| 8 | 0,107 ms | 0,007 ms |
| 20 | 0,123 ms | 0,012 ms |
| 50 | 0,205 ms | 0,025 ms |

**Las dos frases del ítem eran falsas, y en direcciones opuestas.**

1. **No es del mismo orden que el `stringify`: es ~10× más caro.** La premisa con
   la que el ítem se tranquilizaba no se sostiene.
2. **Y el escenario que temía no existe.** Con **un** encuentro ya cuesta
   0,107 ms: lo que se paga es el costo fijo del schema, no el ciclo. Cincuenta
   encuentros lo duplican, no lo multiplican por cincuenta. El "ciclo de 20
   encuentros" no es el caso malo — es indistinguible del caso chico.

### La decisión

**No se debouncea.** Con 0,2 ms en el peor caso medido, un dispositivo diez veces
más lento sigue en ~2 ms: una octava parte de un frame de 16 ms. Un debounce
compraría eso a cambio de un número mágico y de una ventana en la que el aviso
dice algo que ya no es cierto — y el aviso existe para que no se publique algo
incompleto, así que una ventana de mentira es justo lo que no puede tener.

También se descartó `useDeferredValue`, que era la versión sin número mágico: no
hay nada que diferir cuando el trabajo no llega a un frame, y agrega un render de
baja prioridad por tecla que hay que entender para leer el componente.

### Qué queda atado

`tests/costo-por-tecla.test.ts`, con **dos** asertos y un techo deliberadamente
grosero (20 ms, dos órdenes de magnitud arriba de lo medido):

- que un ciclo de 20 encuentros se valide muy por debajo de un frame;
- que **el costo no escale con la cantidad de encuentros**, que es el hallazgo que
  decide todo esto. Si un día una regla nueva comparara cada encuentro con todos
  los demás, el escenario que el ítem temía volvería a ser real y esto lo diría.

El techo no es un objetivo de performance: es el piso de lo absurdo. Un techo
ajustado a lo medido sería un test que falla en una máquina cargada, y **un test
que falla por su propia plomería enseña a saltearlo** — la lección del gate de
`verificar-todo.sh`. Lo que tiene que detectar es que alguien meta red, `crypto` o
una regla cuadrática en el camino del tecleo.

---

## D-186 · El motivo del fallo lo produce el parseo, no la pantalla — y el denominador se mide

**B-55.** El vocabulario de `coordenadas-pegar` / `coordenadas-fallo` estaba
declarado en `analytics-eventos.ts` desde antes y `CoordenadasSede` se mergeó
después, así que los dos eventos **nunca se emitieron**: sus cruces vacíos en GA4
se leían como "nadie pega coordenadas". El ítem prometía "una línea por rama". Son
tres decisiones.

**1 · `coordenadas-pegar` es el denominador, no "se pegó un link bueno".** Cuenta
cada intento de resolver lo que hay en el campo, salga o no. Sin eso la pregunta
que el ítem quiere contestar —"si el 80 % de los fallos es un link corto, hay que
resolverlos"— no tiene con qué compararse: cuatro fallos son muchos sobre cinco
intentos y ninguno sobre cuatrocientos.

**2 · Un intento no se cuenta dos veces.** Hay **cuatro** disparadores sobre el
mismo texto —pegar, Enter, el botón "Usar" y salir del campo— y uno encadena con
otro: pegar aplica y **deja el texto puesto**, así que el blur lo vuelve a
aplicar. Sin guarda, un solo link corto pegado llega como dos o tres fallos, y el
sesgo no es parejo: **infla justo el modo de fallo más frecuente**, que es el que
decide B-45. La guarda es un `useRef` con lo último medido, y se limpia al
resolver bien (el campo queda vacío, así que el próximo intento es uno nuevo).

**3 · El `motivo` lo devuelve `parsearCoordenadas`, no el componente.** Es la
lección de B-88, la misma por la que `MOTIVOS_IMAGEN` vive con el vocabulario y no
en el subidor: el productor y el consumidor tienen que ser el mismo. La
alternativa —que el componente deduzca el motivo del texto del mensaje— es la
variante silenciosa del bug: el día que se mejore una redacción el evento empieza
a llegar como otra cosa, nada falla, y el número que decide B-45 queda mal para
siempre.

### `coord-coma-decimal` era vocabulario sin rama

Los cuatro valores de `FALLOS_COORDENADAS` estaban declarados, y **ninguna ruta
del código producía `coord-coma-decimal`**. Un `detalle` declarado que nadie emite
es peor que uno que falta: su cruce vacío en GA4 se lee como "eso no pasa nunca".

Ahora existe la rama. Un par con coma decimal ("-34,5989, -58,4392" — lo que copia
una máquina configurada en español) **se sigue rechazando**, porque es
genuinamente ambiguo: podrían ser dos números o cuatro, y equivocarse manda el
evento al otro lado del planeta. Lo que cambió es que se nombra: antes caía en «no
parece un link de Google Maps ni un par de coordenadas», que es **falso** —el par
está, con el separador de otro idioma— y no dice qué corregir.

El regex exige la coma **pegada a un dígito en los dos números**, y eso es lo que
lo mantiene disjunto del par: para que `RE_PAR` matchee el string entero la única
coma posible es la del separador, así que un string que matcheara los dos
necesitaría dos comas-con-dígito y una sola coma a la vez. El orden entre los dos
regex es defensivo, no la garantía — la garantía es el regex, y el test la fija con
la mutación puesta: escrito más flojo (`-?\d{1,3},\s*-?\d{1,3}`, que es la primera
versión que a uno se le ocurre) se come «-34, -58», un par legítimo.

---

## D-187 · El aviso de la etiqueta sin registrar vive en el chasis del panel, y nombra la etiqueta

**B-177.** Con el orden de escritura de D-111 son **dos** escrituras: primero la
actividad, después la etiqueta nueva en `/opciones/*`. La segunda puede fallar
sola, y ese modo de falla se eligió a propósito (al revés se perdía la actividad
entera, B-71). Lo que faltaba: `guardarActividad` devolvía `etiquetasSinRegistrar`
y **nadie lo miraba**, así que un guardado con la etiqueta perdida se veía
exactamente igual que uno perfecto.

**1 · Dice cuál, no que hubo alguna.** El resultado pasó de `boolean` a la lista de
labels. Con un booleano el aviso solo puede decir "alguna etiqueta nueva no se
registró", y eso no es accionable: hay cinco campos con taxonomía y el arreglo es
volver a tipear **esa**. Se descuenta cada alta que sale bien, así que con dos
etiquetas nuevas y la segunda fallando el aviso nombra la segunda y no las dos —
mandar a re-tipear una que ya quedó es trabajo inventado.

**2 · `registrarUsos` salió del `catch` compartido, y eso cambia lo que el flag
significa.** Antes compartía el `try` con las altas, así que un fallo al **contar
el uso** se reportaba como "la etiqueta no se registró". Es mentira: la etiqueta
está, lo que no se contó es el uso. Con el aviso en pantalla eso mandaría a
arreglar algo que no está roto. Un fallo al contar **no se reporta**: lo único que
se pierde es una posición en el orden del desplegable, y avisar de eso gasta la
atención que el aviso necesita para lo que sí importa.

**3 · El aviso vive en `AdminApp`, no en el formulario.** Al guardar, el formulario
se desmonta. El ítem nombraba dos salidas —una franja en el listado o quedarse en
el formulario con el aviso— y la segunda es peor: la actividad **ya está escrita**,
así que un formulario que se queda abierto invita a un segundo guardado que choca
contra su propio slug. Y la franja va **afuera de la vista**, no adentro del
listado, porque del formulario se puede volver al listado o al calendario según de
dónde se entró; adentro del listado, editar desde el calendario se comería el
aviso.

Se limpia al abrir **cualquiera** de las cuatro entradas a un formulario (nueva,
editar desde el listado, editar desde el calendario, duplicar): un aviso del
guardado anterior colgado arriba de una carga nueva se lee como si fuera de esta,
y manda a arreglar la etiqueta de otra actividad.

**Por qué recién ahora vale la pena.** El ítem decía "vale poco por sí solo; vale
más el día que exista la UI de taxonomías (B-06), que es donde la etiqueta faltante
se arregla en un clic". Ese día llegó con B-170, así que el aviso tiene a dónde
mandar y no es solo una mala noticia.

### Qué queda atado, y la clase

`tests/senales-del-guardado.test.ts` no verifica la instancia: **deriva del fuente
los campos de la variante `estado: 'ok'`** de `ResultadoGuardado` y exige que la
pantalla consuma cada uno. La clase de B-177 no es "este booleano": es *un campo
del resultado que nadie mira*, y una señal nueva que la pantalla ignore falla acá.
Se verificó con la mutación: agregar un `usosSinContar` al resultado y no
consumirlo pone el test en rojo nombrándolo.

**Una mutación sobrevivió a la primera versión del test**, y vale escribirla: el
aserto de "cada entrada a un formulario limpia el aviso" miraba una ventana de 200
caracteres antes del `setVista`, y los handlers están pegados, así que la ventana
se comía la limpieza **del handler de al lado**. Sacar la limpieza de «duplicar»
pasaba en verde. El corte ahora es por el cuerpo del handler (`=> {` más cercano
hacia atrás).
---

> **Hueco de numeración: D-169 a D-194 están reservados.**
> El backlog de septiembre se reparte **entre worktrees en paralelo**, y a cada
> frente se le asigna un rango de números para que dos no escriban la misma
> `D-xx` sobre la misma línea. Los que faltan no se perdieron ni se descartaron:
> los está usando otro frente, o quedaron sin usar cuando su tanda cerró con
> menos decisiones que números asignados.
>
> Se anota porque la ausencia de una `D-xx` intermedia se lee como «acá había
> algo y se borró», que es justo la sospecha que `docs/BACKLOG.md` ya tuvo que
> desactivar con su propia nota de hueco (B-297 a B-299).

## D-195 · Una base de emulador por checkout, no un puerto por checkout

**El problema.** El emulador de Firestore es estado compartido de la **máquina**,
no del checkout: escucha en `127.0.0.1:8080` y le pega cualquier working-tree.
`src/lib/firestore-client.ts` tiene el host escrito
(`connectFirestoreEmulator(_db, '127.0.0.1', 8080)`) y `vitest.config.ts` caía al
`?? '127.0.0.1:8080'` cuando la variable no venía exportada. Como **todo** archivo
de integración empieza por `limpiarFirestore()` —un `DELETE` sobre la base
entera— dos corridas concurrentes se vaciaban el fixture entre sí a mitad de un
`it`.

Cinco observaciones independientes de eso, de tres worktrees y dos días, están en
B-219. Lo que las hacía caras no era la falla sino que **no se reproducía**: un
rojo que aparece una de cada N corridas enseña a re-correr en vez de mirar.

**Lo primero fue dejar de adivinar.** `scripts/probar-concurrencia.sh` corre dos
suites de integración a la vez y reproduce la falla **6 de 6 veces** con
`--misma-base` (2 a 10 tests rojos por corrida, distintos cada vez, con los
mensajes de siempre: «el fixture dejó de tener "taller" como base», «No existe(n)
en `opciones/arancel`»). Recién con eso el arreglo pasó a ser verificable — y
mutable, que es la mitad que faltaba.

### Las dos candidatas

| | Un **puerto** de emulador por worktree | Un **`projectId`** por worktree |
|---|---|---|
| Qué hay que tocar | el host del emulador tiene que volverse configurable en **código de producción** (`firestore-client.ts`, `firebase-client.ts`), más coordinar cuatro puertos por checkout (auth, firestore, storage, hub) y un `firebase.json` por checkout | nada de producción: la API REST del emulador ya está parametrizada por proyecto en las tres operaciones que importan — el borrado, la carga de reglas y los documentos |
| Costo en recursos | una JVM por worktree (el emulador de Firestore son ~300 MB) | una |
| Qué aísla | bases **y** puertos | bases |
| Riesgo | cambiar el panel para arreglar los tests | ninguno visible |

**Lo decidido: el `projectId`.** Es más barato, no toca producción, y el argumento
de fondo es que el problema es de **datos compartidos**, no de puertos
compartidos: dos suites pueden convivir en un puerto sin molestarse si no se
tocan los documentos.

**La objeción que B-219 anotaba era falsa, y se verificó en vez de suponerse.**
Decía «choca con `singleProjectMode: true` de `firebase.json`, que habría que
apagar». No choca: con el emulador levantado por el checkout principal (o sea con
`--single_project_mode true` en su línea de comandos) se cargaron reglas para dos
projectIds inventados, se escribió un documento en cada uno, se borró **uno**
entero y el documento del otro siguió ahí — 200 contra 404. El modo de proyecto
único **avisa; no aísla ni impide**. Eso quedó fijado en
`tests/emulador-aislado.test.ts` en vez de escrito en un comentario, porque es la
premisa de la que depende todo el resto.

### La huella sale de la ruta, y no de un azar

Tiene que ser **estable entre corridas del mismo checkout**: el emulador persiste
con `--export-on-exit`, así que un projectId nuevo por corrida dejaría una base
huérfana por vez. Y tiene que ser **distinta entre checkouts sin que nadie
configure nada**, porque el modo de falla apareció en worktrees creados al vuelo.
La ruta absoluta del working-tree cumple las dos: es lo único que distingue a dos
checkouts del mismo repo.

`agenda-literaria-<8 hex de sha256 de la ruta>` — 25 caracteres, dentro de los 30
que acepta un project id de Firebase.

### Un solo lugar deriva el valor

Tres tipos de consumidor lo necesitan: `vitest.config.ts` (por import), el gate en
bash (por CLI) y los scripts que un test ejecuta (por entorno). Los tres lo toman
de `scripts/project-id-emulador.mjs`. Que cada uno lo derive por su cuenta es la
clase de B-88, y acá el síntoma sería del peor tipo: el paso 4 del gate sembrando
en una base y el paso 3 borrando otra. La normalización de la barra final del path
existe justamente por eso — `new URL('..', …)` termina en `/` y
`git rev-parse --show-toplevel` no.

### Qué NO resuelve, dicho explícito

- **No separa los puertos.** Sigue habiendo una tanda de emuladores por máquina, y
  de ahí salió **B-365**: una tanda puede quedar **a medias** —el hijo de Firestore
  huérfano y vivo, Auth muerto con su padre— y eso el `projectId` no lo toca.
- **`fileParallelism: false` se queda.** Particiona por *checkout*, no por
  archivo, así que los archivos de una corrida siguen compartiendo base. Los dos
  mecanismos cubren mitades distintas y sacar cualquiera reabre la suya: es lo que
  dicen la segunda y la cuarta observación de B-219.
- **Las reglas de Storage no se pueden particionar**: el `/internal/setRules` del
  emulador de Storage es global y no tiene endpoint por proyecto. Hoy no muerde
  —los objetos van con nombre único y nadie barre el bucket— y muerde el día que
  dos worktrees corran con `storage.rules` distinto.

### El efecto lateral bienvenido

`npm run dev` y `npm run seed` siguen en `agenda-literaria` (el de
`.env.development`), así que **los datos que uno carga a mano en el panel local ya
no los borra ninguna corrida de tests**. Antes cada `npm test` vaciaba la base de
desarrollo del dueño.

---

## D-196 · La decisión de plomería del gate sale del gate

El paso 3 de `verificar-todo.sh` decide entre usar los emuladores que ya están y
levantar unos efímeros. Era un `if` en bash sin ningún test, y desde B-217 decide
**dos** ramas y no una (la comparten los pasos 3 y 4).

**Lo decidido:** sacarla a `scripts/emuladores-arriba.sh`, por el mismo argumento
que sacó `que-deployar.sh` del YAML — una decisión que no se puede probar se
prueba en producción, y acá «producción» es el momento de pushear. El modo de
falla es el que ya se vio: con los emuladores arriba, `emulators:exec` corta con
«port taken» y el gate falla **por su propia plomería**, lo cual enseña a
saltearlo, y ahí deja de ser un gate.

Se prueba con un servidor HTTP de dos líneas apuntado por
`FIREBASE_EMULATOR_HUB`, así que las tres respuestas quedan ejercitadas sin
arrancar ningún Java. Que el 503 **no** cuente como «arriba» es una decisión y no
un accidente de `curl -sf`: correr la suite contra algo que contesta un error en
`/emulators` es correrla contra un proceso que no sabemos qué es, y levantar unos
propios falla ruidoso en vez de silencioso.

Y se pregunta por el **hub** y no por Firestore: el hub es lo que
`emulators:exec` va a querer para sí, o sea la respuesta a la pregunta que de
verdad se está haciendo («¿puedo levantar los míos?»).

---

## D-197 · El saneador del issue va sobre la salida armada, no sobre la entrada

`construirIssue` aplicaba `redactar()` campo por campo, en cinco lugares sobre la
**entrada**. B-81 fue una instancia de eso —el `title` era el único de los tres
textos libres que no pasaba por el filtro, o sea el renglón más visible de un
issue en un repo público—, se arregló con una línea, y la clase quedó abierta.

**Lo decidido:** un único punto de paso, sobre el `title` y el `body` ya
construidos. Cuatro valores se colaban crudos (el id del reporte,
`actividad.slug`, `reporte.actividad.id` y `severidad`); ninguno filtraba nada
—son ids y enums acotados por `reporteValido()`— pero el punto es que la próxima
interpolación no tiene por qué serlo.

**Lo que se paga, y por qué se acepta:** el saneador deja de trimear cada celda
del cuadro de contexto. Ese `.trim()` se mudó a `bloque()`, donde corresponde
—normalizar el formato y tapar lo que no puede salir son dos responsabilidades— y
lo que queda sin cubrir es escapar un `|` dentro de una celda, que hoy no es
alcanzable: los seis valores los arma `contextoTecnico` de
`navigator`/`window`/`Intl`/`location.pathname`. Cuando el contexto gane una celda
de texto libre, lo que hay que hacer es **escapar ahí**, no volver a `redactar`
por celda.

### Tres cosas que el `auditor-privacidad` encontró sobre este cambio

1. **El barrido no barría los campos privados del reporte** (B-361): el fixture
   tenía 8 de las 13 claves de `reporteValido()`, y las que faltaban eran las que
   el §5.1 prohíbe publicar. La lista de claves ahora se **lee de
   `firestore.rules`**.
2. **Y el centinela no alcanzaba para esos campos.** El centinela del archivo es
   un link de zoom, o sea justo lo que el saneador tapa: un campo que se cuela y
   se sanea deja el barrido en verde igual que uno que no se cuela, y los dos
   hechos se confunden. Se comprobó por mutación — interpolar el mail del
   reportante **sobrevive** a un aserto contra el mail del fixture. El barrido
   nuevo usa un centinela que el saneador deja pasar.
3. **El orden sanear→recortar no lo fijaba ningún test** (B-362), y el recorte es
   alcanzable porque `redactar` **expande**: «link de reunión oculto» son 24
   caracteres contra los 12 de un `http://wa.me`.

**Y el límite del punto de paso único, anotado como B-363:** `desSlug()` corre
**aguas arriba** del filtro y le mete un espacio al medio del patrón, así que
`https://mi-org.zoom.us/j/x` sobrevive legible. Con una transformación en el
medio, la garantía sigue dependiendo de quién agregue la interpolación — que es
exactamente lo que este punto de paso venía a resolver.

---

## D-198 · Los `.env` versionados se verifican por lista blanca de claves, no de archivos

Versionar `.env.development`, `.env.production` y `functions/.env` es una
excepción deliberada y bien argumentada (la config del SDK web es pública por
diseño). Lo que no tenía era gate: la única defensa era la memoria, y es la puerta
que publica de la forma más irreversible que hay.

**Lo decidido:** un test que **descubre** los archivos con `git ls-files` y valida
las claves por lista blanca (`^PUBLIC_`, más tres excepciones nombradas) más las
**formas** de los valores. Dos elecciones de diseño que importan:

- **Descubrir en vez de listar.** Eran **cuatro** archivos y el ítem decía tres.
  El que faltaba en la cuenta es `.env.example`, y es el que más importa: es el
  único que **nombra** `FIREBASE_SERVICE_ACCOUNT`,
  `GOOGLE_APPLICATION_CREDENTIALS` y `GOOGLE_CALENDAR_ICS_PRIVADO`, con el `=`
  puesto y el valor vacío. El camino más corto a la fuga no es agregar una clave:
  es **rellenar una que ya está esperando** para probar algo local. Un archivo con
  la lista escrita a mano habría repetido el error que este mismo ítem cometió.
- **`AIza…` no entra en los patrones de secreto.** La API key del SDK web tiene
  esa forma y es el valor que este proyecto versiona a propósito. Un gate que
  grita por el caso legítimo enseña a apagarlo.

**Nunca imprime un valor.** Los mensajes nombran archivo, clave y qué patrón
matcheó: un test que falla mostrando el secreto lo copia al log de CI, que también
es público.

La tercera excepción la encontró el gate en su primera corrida
(`FIRESTORE_EMULATOR_HOST=127.0.0.1:8080` en `.env.example`): una dirección de
loopback, que no identifica ni autoriza nada. Entró a la lista con su motivo
escrito, que es la forma en que esa lista tiene que crecer.

---

## D-199 · «Sin versión estampada» es un valor del vocabulario, no la bolsa de `otro`

`VERSION_APP` vale `'desconocida'` cuando el build no estampó nada (dev server,
tests), y el sanitizador de analítica lo mandaba como `'otro'` — el mismo valor
con el que reporta «este formato no lo reconozco».

**Lo decidido:** un valor propio. Después de B-88 el segundo caso no debería
ocurrir nunca, así que un `version: otro` con volumen **es una alarma** —el
productor estrenó una forma que el consumidor no acepta— y compartiendo valor esa
alarma no se podía distinguir del ruido de dev. Era lo único útil que este
parámetro podía decir.

Es un bug de **datos**, no de código, y su costo es exactamente ése: nada se
rompe, y la única señal que el parámetro sabe dar queda inservible.

**Se importa de `src/lib/version.ts` en vez de escribir el literal.** Que el
consumidor derive por su cuenta un valor del productor es la clase de B-88, y este
parámetro ya la tenía del lado del formato: si la analítica escribiera
`'desconocida'` por su cuenta, el día que el productor cambie el texto los eventos
empezarían a viajar como `'otro'` sin que nada se ponga rojo.

---

## D-200 · Los nombres de los meses se comparten; el argumento para duplicarlos no se sostiene

`calendarioPanel.ts` tenía los doce nombres con un comentario que justificaba la
copia: «duplicados a propósito respecto de `novedades.ts`: ahí son contenido de
una lista de novedades y acá son la navegación del calendario; atar los dos
módulos por una constante de texto no compra nada».

**El argumento es razonable y es falso**, y vale escribir por qué en vez de
borrarlo: los doce nombres **no son de ninguno de los dos dominios**. Son un hecho
del castellano. Atar dos módulos por una constante de dominio los acopla —si
mañana el calendario quiere «Ene» y las novedades «enero», la constante
compartida estorba—; atarlos por el nombre de un mes no, porque no hay ninguna
versión del futuro en la que agosto se llame distinto en una pantalla y no en la
otra. Si hace falta otra forma, es un **formateo** sobre esta lista, no otra
lista.

Y lo que sí puede pasar con dos copias es que **una se arregle**: un acento
corregido en un archivo y no en el otro, con las dos pantallas a un clic de
distancia. Es la divergencia de B-175 —«Híbrido» en el formulario y «Presencial y
virtual» en los filtros—, que también nació de dos mapas separados a propósito.

`nombreDeMes` devuelve `null` y no cadena vacía para un número que no es un mes, y
eso es load-bearing: los tres llamadores usan ese `null` para caer en la clave
cruda (`'2026-13'`), y una cadena vacía se colaría al HTML como un hueco
silencioso — «de 2026» sin mes.
---

## D-175 · La Function que optimiza las imágenes propias: la salida va **encima del original**

Cierra **B-220** (DEC-7d), y con él **B-300** y **B-266**. La numeración salta a
175 por reserva de números entre frentes en paralelo.

### El problema, con los dos disparadores medidos

DEC-7d dejó explícitamente para después la mitad de la galería que optimiza las
imágenes propias. Los dos disparadores escritos sonaron, y los dos están medidos
contra producción el 2026-09-02:

- **B-300** — el peor caso de **una página de detalle**. Con la galería el techo
  legal pasó de 3 MB a 12 MB, y ya había una página real de **3226,7 KB**.
- **B-266** — el costo de **recorrer la cartelera entera**. Se cae alrededor de
  los 20-25 flyers y hoy hay 29 con imagen; las 30 imágenes cargadas pesan
  **3518,5 KB** en total.

### Lo que la medición dijo, y no era lo que el ítem suponía

Se bajaron las 30 imágenes propias de producción y se corrió el pipeline sobre
cada una. Dos resultados cambiaron el diseño:

**1 · Recomprimir los JPEG no sirve para nada.** 29 de las 30 son JPEG
exportados de Instagram y ya están en su punto: el total pasa de 3518,5 KB a
3134 KB, o sea **−11 %**, y casi todo ese 11 % es la única que no es JPEG.
Imagen por imagen el ahorro va de 0 a 5 KB, y **en dos casos el resultado pesa
más** que el original (92,6 → 92,7 KB y 100,9 → 101,1 KB). Recomprimirlos es
perder calidad a cambio de nada.

**2 · El peor caso del sitio es un PNG, y eso es todo el problema.** La imagen
de 1091,5 KB —11,8 veces la mediana de 92,6 KB— es un **PNG** de 1024 × 1024. Y
la página de 3226,7 KB de B-300 son **tres PNG**. Reencodeados a JPEG:

| | antes | después |
|---|---|---|
| PNG 1024 × 1024 (la portada) | 1091,5 KB | **34,0 KB** |
| PNG 1408 × 768 | 1808,5 KB | 118,5 KB |
| PNG 548 × 364 | 326,7 KB | 31,7 KB |
| **la página entera** | **3226,7 KB** | **184,3 KB** |

**17,5 veces más liviana.** Dejarlos en PNG optimizado da 403,5 KB en vez de
184,3: la palanca no es la compresión, es el **formato**.

De ahí las dos reglas de `convieneReemplazar` y `formatoDeSalida`:

- **un PNG opaco sale JPEG**, siempre;
- **un JPEG se reemplaza solo si ahorra más del 5 %** (`AHORRO_MINIMO`), o si
  trae metadatos — ver más abajo;
- **un PNG con transparencia real se queda en PNG.** `isOpaque` y no `hasAlpha`:
  los tres PNG de producción declaran canal alfa y los tres son completamente
  opacos, así que aplanarlos sobre blanco no cambia un píxel. Uno con
  transparencia de verdad, aplanado, aparecería con un recuadro blanco sobre el
  fondo de la página — y el sitio tiene tema claro y oscuro, así que no hay color
  de fondo correcto que elegir.

### La decisión de fondo: se escribe **encima del original**

B-220 daba por **bloqueante** el write-back al documento: la Function tendría que
escribir `storagePath`/`ancho`/`alto` en la fila de la galería, y no puede
**encontrar** la actividad porque el path del objeto no lleva su id — y no lo
lleva por una razón dura (al subir todavía no hay actividad, D-131 §1). El ítem
proponía dos salidas caras: una query `array-contains` sobre un subcampo, que
Firestore no sabe hacer, o un documento puente que el panel escriba.

**Sobreescribir el original disuelve el problema en lugar de resolverlo.**

- La `url` guardada en el documento sigue siendo válida y ahora apunta a los
  bytes buenos: **no hay nada que escribir**.
- **Todas las salidas se benefician sin tocar una plantilla.** La página de
  detalle, la cartelera y `og:image` piden la misma URL de siempre. Es lo que
  permite cerrar B-300 sin un `srcset`, que era la única palanca que quedaba
  (D-149: `sizes` sin `srcset` es decoración).
- `ancho`/`alto` siguen siendo verdad **como razón**, que es lo único para lo que
  se usan (`proporcionDeAfiche` reserva la caja): `4032 / 3024` y `1600 / 1200`
  reservan la misma. Los absolutos pueden quedar viejos —anotado en
  `03-modelo-de-datos.md`— y no hay salida que dependa de ellos. Hay un test que
  fija que el reescalado conserva la proporción, porque de eso depende todo el
  párrafo.

**Verificado de punta a punta contra los emuladores:** subida la portada de
1091,5 KB, la URL de descarga que quedaría en el documento —con su token—
responde **200** y devuelve los 34,0 KB con `Content-Type: image/jpeg`.

Dos consecuencias que no se adivinan:

- **El objeto queda con extensión que no coincide con su contenido**:
  `imagenes/img_x.png` con bytes JPEG y `contentType: image/jpeg`. Es correcto por
  HTTP —el navegador obedece el `Content-Type`— y no rompe ninguna promesa: el
  nombre del objeto **nunca fue** una afirmación sobre el contenido, es el id
  opaco de la fila (B-206 #1). La alternativa era cambiar de path, y cambiar de
  path es exactamente el write-back que esto evita.
- **El `Cache-Control` de la subida tuvo que acortarse.** El original vive unos
  segundos antes de ser reemplazado, y marcarlo `immutable` en esa ventana sería
  pedirle al CDN y al navegador que se queden **un año** con los bytes que están
  por reemplazarse. Así que el panel sube con `CACHE_AL_SUBIR`
  (`max-age=300`) y la Function pone `CACHE_OPTIMIZADO` (un año, inmutable) al
  terminar. Modo de falla si la Function no está desplegada: las imágenes se
  cachean cinco minutos en vez de un año — más egreso de GCS, no una imagen
  rota, y visible en los logs.

### La guarda anti-recursión: **las dos**, y por qué no alcanza una

Es la **trampa 12** del §13, que es la 3 con otra cara. DEC-7d nombraba las dos
formas conocidas y pedía elegir una. Van las dos, y cada una tapa un agujero que
la otra no puede:

1. **`customMetadata` en el objeto derivado** (`MARCA_OPTIMIZADA`). Es la
   **obligatoria**, y es una consecuencia directa de la decisión de arriba: con
   la derivada en la **misma dirección** que el disparador, una guarda por
   prefijo es *estructuralmente imposible*. No hay prefijo que las distinga.
2. **Prefijo separado que el trigger ignora** (`miniaturas/`). Hace falta igual
   porque un trigger de Storage v2 **no se puede filtrar por prefijo en la
   declaración**: se suscribe al bucket entero, así que escribir la miniatura lo
   vuelve a disparar y el corte lo tiene que hacer el handler.

La marca se detecta **por presencia y no por valor**: comparar contra la versión
del pipeline haría que subirla reprocese el bucket entero… y que cada reproceso
se reprocese, que es el loop disfrazado de migración.

#### Storage **no** corta la recursión, y eso hay que tenerlo escrito

El §7.1 dice que Firestore corta a las ~20 iteraciones. **Storage no corta.**
Medido contra el emulador (Storage + Functions), a partir de **una** subida de
2,6 KB:

| | ejecuciones del trigger |
|---|---|
| con la guarda | **3**, y para |
| sin la guarda por marca | **4**, y para — pero **no** por ninguna guarda |
| sin la guarda y con `convieneReemplazar` en `true` | **5077 en 40 segundos, y subiendo** (~120/s) |

**El hallazgo del medio es el que importa.** Hoy existe un **segundo freno
accidental**: la segunda pasada recomprime un JPEG que ya está en su punto fijo,
`convieneReemplazar` dice que no conviene, y entonces se escribe con
`setMetadata` — que dispara `onObjectMetadataUpdated` y no `onObjectFinalized`.
Eso no es una guarda: es la casualidad de que recomprimir sea una contracción y
que el umbral de ahorro sea mayor que cero. El día que `AHORRO_MINIMO` baje a
cero, el freno desaparece sin que nada avise.

Y hay un **tercero**: `idDeObjeto` exige el prefijo de originales para poder
devolver un id, así que también corta. Solo manda cuando faltan las dos guardas a
la vez.

**Cuál guarda corta qué, dicho con precisión, porque la primera versión de D-175
lo decía mal y lo corrigió el `auditor-trampas`:** la miniatura de hoy la corta
**la marca**, no el prefijo, porque el trigger la escribe marcada igual que la
salida principal. Lo que el prefijo cubre es el objeto que aparezca en otro
prefijo **sin** marca — el prefijo que alguien invente mañana, o esa misma
miniatura el día que alguien escriba una derivada y se olvide de marcarla. Es la
guarda que **no depende de que nos acordemos de marcar lo que escribimos**, y por
eso no es redundante; tiene su propio caso afirmado en el test.

Por eso el test del lazo afirma **qué guarda cortó cada vuelta** y no solo que el
lazo terminó: con tres cortes encimados, el conteo de vueltas queda en verde
mientras sobreviva cualquiera. Es la clase de B-265, heredar un filtro «por
construcción» hasta que se deje de heredar.

#### La red

- `tests/imagenes-function.test.ts` **corre el lazo**: un bucket simulado encola
  los disparos que producen las escrituras del trigger. Los bytes bajan en cada
  pasada y siempre se reemplaza, **a propósito**: modela el peor caso y no el
  comportamiento amable de hoy. Sin la marca da `expected 200 to be 3`.
- `tests/clases-de-bug.test.ts` estrena `clase de la trampa 12`, que es una
  regla y no un caso: **todo trigger de Storage que escriba en el bucket tiene
  guarda, y la guarda domina las escrituras**. Hace falta aparte de la de B-82
  porque su noción de «efecto duplicable» son los verbos de creación de Firestore
  y de Calendar, y `bucket.file(x).save(...)` no es ninguno — escribir dos veces
  la misma dirección de Storage no produce un segundo objeto. **El daño de esta
  trampa no es un duplicado, es un lazo.**
- El descubridor de triggers **encontró la Function solo**, que era la promesa de
  D-131 §4: las cuatro clases `onObject*` se habían agregado a
  `CLASES_DE_TRIGGER` el 2026-08-28, antes de que existiera ninguna Function de
  Storage, «porque es el único momento en que el cambio es gratis». El `it` de
  «los seis triggers» se puso rojo el día que se escribió el archivo.

**Dos falsos positivos del detector nuevo, encontrados mutándolo**, y los dos
son la misma lección de B-171:

- `guardaPorMarca` con un `/MARCA_\w+/` suelto daba `true` con la guarda ya
  sacada, porque la Function también **escribe** la marca. Ahora pide la
  **lectura** (`metadatos[MARCA_…]`).
- `guardaPorPrefijo` daba `true` por `idDeObjeto`, que compara el prefijo para
  parsear un nombre y no para ignorar un objeto. Ahora pide que del mismo cuerpo
  salga un `'ignorar'`.

### Qué consume la miniatura, y dónde

**La cartelera**, y es la única candidata que se sostiene con números: es la
**única** página del sitio que pide muchas imágenes a la vez (la home no pide
ninguna desde D-146, el detalle pide entre una y cuatro). Con miniaturas de
**480 px**, recorrer las 30 de producción pasa de **3518,5 KB a 1032,4 KB
(−71 %)**.

480 y no 320 —que daba −84 %— porque la pared es de flyers y **un flyer es texto
metido adentro de un JPEG** (D-147): bajarle la resolución es bajarle la
legibilidad, no el peso de una foto. En el teléfono la columna mide ~343 px CSS.

**La URL de la miniatura se deriva, no se guarda.** `urlDeMiniatura` cambia el
prefijo del path que la URL de descarga lleva URL-encodeado adentro y fuerza
`.jpg`. Eso es lo que completa la decisión de no hacer write-back: ni el path ni
la existencia de la miniatura necesitan un campo en el documento. El token se
descarta porque **no autoriza nada**: verificado contra producción el
2026-09-02, el mismo objeto responde 200 con su token, **sin token** y con un
token inventado — lo que autoriza es `allow get: if true`.

`Afiche.urlMiniatura` está puesto y probado; **la plantilla todavía no lo
pinta**, porque `src/pages/cartelera.astro` es de otro frente. Falta un `srcset`
de una línea, con el original como `src` — que es lo único que degrada bien: un
`srcset` cuyo candidato no existe hace que el navegador caiga al `src`. Queda
como **B-320**.

### `sharp` y el prefijo nuevo

- **`sharp` ya estaba en el árbol** (dependencia opcional de Astro, 0.34.5 en
  `package-lock.json`, así que pasa por el `npm audit` del proyecto), pero
  **heredarla del root no alcanza**: `functions/` tiene su propio
  `package.json` y su propio `node_modules` en el deploy. Está declarada ahí. Es
  la primera dependencia binaria del proyecto y cambia el tiempo de deploy de
  las Functions.
- El pipeline **descarta todos los metadatos por defecto** —a `sharp` no hay que
  pedirle que saque el EXIF, hay que tener cuidado de no pedirle que lo deje— y
  pide explícito dos cosas: `.rotate()` sin argumentos, que aplica la orientación
  del EXIF **antes** de descartarlo (sin eso, sacar el EXIF de una foto sacada de
  costado la publica girada 90°), y `.keepIccProfile()`, que conserva el perfil
  de color: misma decisión que el panel toma con el marcador `0xE2`, porque
  descartarlo cambia los colores, y un perfil ICC no lleva ubicación ni autor.
- **El prefijo de la miniatura es `miniaturas/`, hermano de `imagenes/` y no
  hijo.** El motivo estaba escrito de antemano, en el propio test de integración
  de `storage.rules`: «el día que alguien escriba `{ruta=**}` —el patrón más
  natural, y el que va a hacer falta si mañana hay `imagenes/miniaturas/`— la
  lectura sigue andando, todo lo demás sigue verde, y esto se abre sin que nada
  avise». Se le hizo caso. Con el prefijo hermano, `match /imagenes/{archivo}`
  sigue siendo de un solo segmento y el `list` sigue cayendo en el `deny`.
- Sus reglas van **en el mismo cambio**: `allow get: if true`,
  `allow list: if esAdmin()` (trampa 13, y acá importa más que en `imagenes/`
  porque el nombre de la miniatura se **deriva** del del original, así que
  enumerar un prefijo es enumerar el otro), y `allow write: if false` — **ni un
  admin escribe ahí**. No es simetría: la dirección de una miniatura la
  **calcula** el sitio, y dejar escribir ahí sería dejar elegir qué se muestra en
  la cartelera sin pasar por ninguna validación de tipo ni de tamaño, y sin pasar
  por el pipeline que le saca los metadatos.

### El EXIF sigue saliendo dos veces, y sigue estando bien

D-131 §3 decidió que el panel saque los metadatos aunque DEC-7d ponga la Function
después, porque entre una tajada y la otra había imágenes propias públicas. Ahora
existen las dos capas, y las dos se quedan: el panel se puede saltear abriendo la
consola del navegador, la Function no. Es la misma defensa en profundidad que
DEC-7b eligió para el tamaño.

Y una decisión que **no** se tomó, aunque B-220 la listaba: **WebP y AVIF siguen
afuera de `TIPOS_SUBIBLES`.** El ítem decía que la Function los vuelve seguros, y
no del todo: el objeto es público desde el instante en que se sube
(`allow get: if true`) y la Function corre unos segundos después. En esa ventana
un WebP con GPS es una URL pública con las coordenadas de una casa particular.
Volverían a entrar recién con una zona de subida privada, que es otro frente
(**B-322**).

### `convieneReemplazar` reemplaza siempre que haya metadatos

El corte por ahorro es una optimización; el corte por metadatos es una garantía,
y manda sobre el otro. Un original con EXIF, XMP o IPTC se reemplaza **aunque no
ahorre un byte** — o aunque el resultado pese más. La mutación que saca ese
`return` deja la privacidad dependiendo del ahorro de bytes, y es una de las que
se probaron.

### Lo que encontraron los auditores, y era la mitad del valor de este cambio

Los dos corrieron sobre los tres commits, y entre los dos encontraron **un P0, dos
P1 y una corrección de este mismo documento**. Vale enumerarlo porque tres de los
cuatro son cosas que ningún test de este repo podía ver.

#### P0 · la guarda anti-recursión era **escribible desde el cliente**

`decidirOptimizacion` corta cuando el objeto ya trae `optimizada` en su
`customMetadata`… y ese mapa **lo elige quien sube**. `storage.rules` validaba
`contentType`, `size` y la forma del nombre, pero no los metadatos. Así que
alcanzaba una línea en la consola del navegador —

```js
uploadBytes(ref(storage, 'imagenes/img_x.jpg'), archivo, {
  contentType: 'image/jpeg',
  customMetadata: { optimizada: '1' },
});
```

— para que el trigger se salteara **entero** y el JPEG quedara público con su APP1
y su GPS adentro. La capa que este frente presenta como «la que no se puede
saltear» se salteaba desde la misma consola que motiva su existencia.

Es la **tercera defensa del mismo párrafo de DEC-7b**: el tamaño y el tipo se
verifican en las reglas porque el cliente se puede saltear, y la marca también.
Arreglado con una condición sobre `request.resource.metadata`, con su caso de
integración y su mutación. **No reabre el loop**: la Function escribe con el Admin
SDK, que pasa por encima de las reglas.

#### P1 · `sharp` no reporta todos los metadatos, y la rama que **no** recomprime los dejaba pasar — para siempre

`sharp.metadata()` informa `exif`, `xmp`, `iptc` y `comments`. **No informa** lo
que el docblock de `finDelJpeg` documenta como el motivo de existir de ese módulo:
lo que viene después del EOI real (la imagen secundaria MPF de los Samsung, que es
un JPEG completo **con su propio APP1 y su propio GPS**; el MP4 de una motion
photo; el trailer `SEFH`) y los APPn desconocidos (APP2 con índice MPF, APP4–APP12,
el thumbnail `JFXX` de APP0).

**Y era permanente, no un caso perdido.** Si el bloque no lo ve `metadata()`,
`convieneReemplazar` cae al criterio de ahorro; un JPEG ya comprimido no ahorra el
5 %, se toma la rama que **no toca los bytes**… y se le escribe la marca igual.
Como la guarda es por presencia de la marca, ese objeto quedaba **exento para
siempre** del trigger y del barrido: un archivo que nunca se saneó, marcado como
saneado.

Se cerró con `estructuraConocida`, que recorre el archivo y devuelve `false` si no
puede dar cuenta de **todos** los bytes; `conMetadatos` es ahora
`traeMetadatos(meta) || !estructuraConocida(...)`. La regla es «si no lo
entendemos, se recomprime», que es la misma elección de `quedanMetadatos` en el
panel. **Costo medido: cero** — de los 29 JPEG de producción, 28 traen solo APP0 y
uno además APP2 con el perfil ICC; ninguno tiene cola ni APPn desconocido, así que
no recomprime ni una imagen más de las que ya están.

#### Y buscando eso apareció un bloque de 13,6 KB **ya publicado** que ninguna capa veía

La portada de «Usted está aquí» —la misma imagen de 1091 KB de B-300— trae un chunk
PNG **`caBX`** de 13,6 KB: es la caja JUMBF de las **credenciales de contenido
C2PA**, y adentro hay un manifiesto **firmado por Google LLC** («Google C2PA Media
Services») con la herramienta que generó la imagen, un certificado y un `urn:c2pa:`
que identifica esa copia.

Lo dejaron pasar **las dos** capas del panel: `CHUNKS_A_TIRAR` no lo enumera y las
tres marcas de `quedanMetadatos` no lo describen. Estuvo público desde que se
subió.

Se tapó en los dos lados: `caBX` entra a `CHUNKS_A_TIRAR`, y `jumdc2pa` y
`urn:c2pa:` entran a `MARCAS_DE_METADATOS` —la estructura y el identificador, para
que el centinela sobreviva a que el perfil cambie de una a la otra—.

**Y la lección es sobre la forma de la lista, no sobre el chunk.**
`CHUNKS_A_TIRAR` es una lista **negra**: enumera lo que se tira y deja pasar todo
lo que no conoce. Para PNG eso está al revés de lo que hace falta, y los chunks
seguros **son enumerables** (los enumera `estructuraConocida`). Invertirla es
**B-323**; no se hizo acá para no tocar la subida del panel en el mismo commit que
estrena la Function.

> ⚠️ **B-323 ya invirtió la lista.** `CHUNKS_A_TIRAR` no existe más:
> `src/lib/imagenes-archivo.ts` importa `CHUNKS_PNG_SEGUROS` (lista blanca) del
> alias `@png-chunks-seguros`, que apunta al mismo archivo nuevo,
> `functions/png-chunks-seguros.js`, que `estructuraConocida` ya usaba. Es la
> misma lista de los catorce, ahora en un solo lugar y no en dos. El párrafo de
> arriba queda como estaba escrito, para que se lea contra el hallazgo original.

#### P1 · `.rotate()` transpone, y el argumento de «conserva la proporción» no lo cubría

El `auditor-trampas` lo vio y tiene razón en el fondo: `.rotate()` sin argumentos
**transpone** ancho y alto para orientación 5/6/7/8 (una foto sacada con el
teléfono de costado). Si el documento guardara la medida cruda y la Function
publicara la rotada, la proporción quedaría **invertida** —no vieja— y la caja que
el sitio reserva sería la contraria. El test de rotación probaba la Function sola y
el de proporción probaba una imagen ya derecha: nadie los cruzaba.

**Verificado, y hoy coinciden — pero por una razón que no estaba escrita.** No es
casualidad: es el orden de `subirImagen`. El panel saca el EXIF **antes** de medir
y antes de subir, así que la orientación ya no está cuando `dimensiones()` mide ni
cuando la Function abre el archivo, y `.rotate()` no encuentra nada que rotar.
Ahora hay dos `it` que lo fijan: uno cruza los dos lados con el mismo buffer, el
otro afirma que con el EXIF intacto la Function **sí** transpone. La propiedad pasó
de accidental a afirmada.

**Y de paso quedó al descubierto un bug anterior a este frente:** el panel saca la
orientación **sin rotar los píxeles**, así que una foto tomada de costado **se
publica de costado**. `.rotate()` en la Function la arreglaría, pero no llega a
verla nunca porque el tag ya no está. Es **B-324**, y no se arregla acá porque la
salida buena —que el panel conserve solo `Orientation` y tire todo lo demás—
implica emitir un bloque EXIF desde el panel, que es justo lo que `quedanMetadatos`
está puesto para rechazar.

#### Dos correcciones a los detectores, y una a este documento

- **`escribeEnElBucket` era sobre-inclusivo**: aceptaba `bucket.file(` a secas, y
  `bucket.file(nombre).download()` es una **lectura**. Un trigger de Storage futuro
  que solo leyera iba a recibir la exigencia de una guarda que no necesita. Es el
  error inverso a los otros dos falsos positivos de ese bloque —más seguro, igual
  de impreciso— y se apretó ahora, que es cuando es gratis.
- **`roles/storage.objectAdmin` era más de lo necesario, y el motivo escrito estaba
  al revés.** `objectUser` ya trae `.update`, así que alcanza para el `save()`
  encima del original y para el `setMetadata()`. Lo único que agrega `objectAdmin`
  es `getIamPolicy`/`setIamPolicy` **por objeto**: el canal de permisos que **no
  pasa por `storage.rules`** y que por lo tanto no audita nada de este repo.
  Corregido en `08-operacion.md`, junto con la consecuencia que conviene tener al
  lado de la trampa 13: cualquier rol de lectura concede `objects.list`, así que
  `allow list: if esAdmin()` protege **un canal y no el bucket**.
- **Cuál guarda corta qué estaba mal dicho acá y en el código.** La miniatura de hoy
  la corta **la marca**, no el prefijo, porque el trigger la escribe marcada. Ver
  arriba, en la sección de la guarda: la corrección está incorporada y tiene su
  propio `it` con una derivada **sin** marca, que es el caso para el que la guarda
  por prefijo existe.
- **Y un hueco de índice que no es de cobertura**: `src/lib/imagenes.ts` pasó a
  producir texto de la salida 7 (`urlDeMiniatura`) y no estaba nombrado en la fila 7
  de `07-seguridad.md`, ni en la ficha del `auditor-privacidad`, ni en el skill
  `campo-nuevo`. O sea que un cambio futuro a esa derivación **no dispararía la
  auditoría**. Agregado a los tres.
---

## D-180 · La barra final va en los `href`, no en la config del host

**Contexto.** B-293, cerrado el 2026-09-02. Medido contra producción:

```
curl -I https://agendaleh.ar/cartelera   → 301 → /cartelera/
curl -I https://agendaleh.ar/cartelera/  → 200
```

Es el comportamiento por defecto de Firebase Hosting con las páginas que Astro
emite como `carpeta/index.html`. D-165 ya lo había resuelto **para la mitad que
Google mira**: `rutaCanonica` agrega la barra, así que el `canonical`, el
`og:url`, el JSON-LD y el `<loc>` del sitemap salen con la forma que contesta 200
—una canónica que apunta a una redirección es un aviso en Search Console y una
entrada de sitemap que redirige es una URL menos rastreada—.

La otra mitad quedó anotada como deuda: los `href` del propio sitio iban **sin** la
barra y se comían un 301 por click. No rompe nada y no se ve —el navegador sigue la
redirección sin decir nada— y eso es justo lo que lo hacía crónico.

### Las dos salidas, y por qué se eligió la fea

El ítem las dejó escritas y decía, con razón, que **ninguna es obvia**:

| | Qué implica | Por qué no / por qué sí |
|---|---|---|
| `"trailingSlash": false` en `firebase.json` | Firebase sirve `/cartelera` directo y redirige `/cartelera/`. URLs más limpias a la vista | **Da vuelta la dirección del 301**, así que hay que invertir `rutaCanonica` en el mismo commit; y la mitad que decide es la **config del host**, que este repo no puede verificar sin deployar |
| la barra en los `href` | una línea en `rutasPublicas.ts` y un barrido de los literales del markup | URLs con barra a la vista, que es más feo. Pero es la que se puede **verificar acá**: `npm run build` y `grep href="/` sobre `dist/` |

**Se eligió la segunda**, y el argumento decisorio no es estético: es que la
primera pone la corrección de un lado de un par y la comprobación del otro. La
predicción de `rutaCanonica` la hace cierta la config de Firebase más el formato
de salida de Astro, y ninguno de los dos está en un test de este repo — por eso
`tests/canonico.test.ts` afirma que `cleanUrls`, `trailingSlash` y `build.format`
siguen sin tocarse, con el motivo escrito. Cambiar la config habría sido tocar
exactamente la mitad que ese test protege, para ganar URLs más lindas.

**Lo que no se puede hacer es tocar una sola de las dos mitades**, y sigue siendo
cierto en la dirección contraria: el día que alguien quiera `cleanUrls`, ese test
lo manda a dar vuelta `rutaCanonica` en el mismo commit, y ahora también todos los
`href` — que salen del mismo lugar, así que es una línea.

### Y la parte que vale más que el 301: una sola forma escrita

El síntoma era un salto por click. El problema de fondo era que **había dos textos
para la misma página** conviviendo en el repo: uno para enlazar y otro para
indexar, cada uno derivado por su lado. Es la clase de B-88 con el agravante de que
las dos formas *funcionan*.

Hoy hay una y la produce `rutaCanonica`. Las constantes de las páginas fijas están
definidas **pasándolas por ella**:

```ts
export const RUTA_CARTELERA = rutaCanonica('/cartelera');
```

No es un detalle de estilo: escrito `'/cartelera/'` a mano, el literal correcto de
hoy es el literal equivocado del día que la config cambie, y nada lo diría. Con
esta forma, dar vuelta la decisión es editar `rutaCanonica` y nada más.

Entraron en el mismo cambio los constructores que **B-330** iba a necesitar
(`rutaDeTipo`, `rutaDeBarrio`, `RUTA_ONLINE`, `RUTA_GRATIS`), para que el frente de
los hubs no pudiera introducir una segunda forma en cuatro patrones de URL nuevos.

### Lo que faltaba en el relevamiento del ítem

B-293 hablaba de «un barrido de los literales del markup». Los literales no estaban
solo en el markup: `src/lib/ayudaDelSitio.ts` tenía **siete** (`/contacto`,
`/suscribirse`, `/`) y `src/lib/contactoDelSitio.ts` uno (`/ayuda`), y esos textos
se renderizan en dos páginas públicas. Por eso el barrido nuevo mira `.astro` y
`.tsx`, y los dos módulos de texto pasaron a importar las constantes: un `href`
interno es una ruta del sitio, no un dato de la página que lo muestra.

## D-201 · GA4 va en el sitio público, porque es la vara que un anunciante conoce

Cierra la mitad de arquitectura de **B-370** que estaba abierta desde que se cayó
el frente de analítica: qué medidor usa el sitio público, hoy en cero — **cero
eventos, cero cookies, cero JavaScript de telemetría**, verificado en producción
el 2026-09-02 (`docs/16-analitica-del-sitio.md` §1). No es una opción entre
varias: es la que sigue de separar el pedido del dueño en sus dos mitades
(§2 del mismo documento).

**El pedido tiene dos productos distintos, y solo uno pide GA4.** *Vender
publicidad* necesita un número que un anunciante lea en un mail y le crea, no un
número rico. *Mejorar el sitio* necesita precisión sobre un punto concreto —qué
filtro deja cero, quién llega a escribirle al organizador— y eso son eventos
propios, diseñados uno por uno, GA4 o no.

**El motivo de la decisión es la mitad que vende.** Un anunciante no audita un
contador casero por más preciso que sea: no tiene cómo verificarlo, y "confiá en
mí" no es una moneda que se pueda ofrecer en un mail. GA4 es la moneda que ya
conoce — la puede pedir por su cuenta, la reconoce de otros sitios, y no hace
falta convencerlo de que el número es real. Un tablero propio, aunque muestre
exactamente lo mismo, no compra esa credibilidad: hay que ganarla desde cero con
cada anunciante, y GA4 ya viene con ella puesta. Por eso la mitad vendible **no
se diseña**: se instala el tag y a los treinta días hay un número (§2, §6.3).

**Lo que esta decisión no resuelve, y queda abierto a propósito:**

| No decide | Por qué | Dónde vive |
|---|---|---|
| Si el dueño acepta el costo de JavaScript en la página de detalle | Es plata del anunciante, pero el peso lo paga la visita: 152 KB en una página de 18 KB, sin caché útil (`max-age=900`) — §6 | **B-371**, decisión del dueño |
| El consentimiento | GA4 pone cookies de primera parte; qué aviso corresponde es una lectura legal, no técnica | **B-376**, decisión del dueño |

**B-372** (instalar el tag) depende de las dos. Esta decisión es la que las
desbloquea a ambas: sin ella no había ni siquiera qué preguntarle al dueño.

**La regla de que ningún contenido sale a una salida pública** (`07-seguridad.md`,
salida de analítica) sigue rigiendo entera para la mitad que mejora — los eventos
propios de **B-375** no van a mandar qué actividad se miró, igual que la
analítica del panel. La mitad que vende no la necesita: un anunciante pregunta
volumen, no cuál actividad, y GA4 sin un solo evento personalizado no puede
filtrar contenido porque no lo recibe.

**Alternativas para pagar menos, y por qué ninguna reemplaza al snippet estándar**
(medidas en §6.2, no supuestas): cargarlo diferido deshace la cuenta que se
vende — quien entra y se va en dos segundos deja de contarse, y no se sabe
cuánto; Google Tag Manager suma ~100 KB para no hacer nada que el tag directo no
haga; el Measurement Protocol server-side no aplica a un sitio estático y sin
`client_id` real degrada justo los dos números que se venden (usuarios y
sesiones); instalarlo solo en la home mata la pregunta de qué páginas se miran
más, que es una de las que se vende. La recomendación medida es el snippet
`async` estándar, `gtag.js` directo, en todas las páginas públicas salvo
`/admin` — pero instalarlo es B-372, no esta decisión.

Detalle completo, con los números y las preguntas que el tablero contestaría:
[`docs/16-analitica-del-sitio.md`](16-analitica-del-sitio.md).
---

## D-250 · B-376 — el banner es C3, y «rechazar» no manda ni un byte

**Contexto:** `docs/16-analitica-del-sitio.md` §7 dejaba tres caminos (C1 nada,
C2 una página de privacidad, C3 un banner) y recomendaba C2 por ser la que no
le cobra nada al número que se vende. **El dueño eligió C3** — un banner con
«aceptar» o «rechazar», el patrón que hoy es estándar.

**Decisión, en tres partes:**

1. **Sin Consent Mode v2 con default denegado.** El patrón «hoy estándar» que
   `gtag.js` documenta es cargar el tag siempre, con
   `analytics_storage: 'denied'` por defecto, y solo actualizar el consentimiento
   cuando la persona decide. **No se implementó así**, porque en modo denegado
   GA4 igual manda pings sin cookies — y eso hace que el botón «Rechazar»
   mienta: alguien que lo aprieta espera que no se mande nada, no que se mande
   igual sin una cookie. Acá **si rechaza, no se carga el tag**: no hay
   `gtag('consent', ...)`, hay «se instala o no se instala» (`debeCargarGA` /
   `debeMedirSitio`, `src/lib/analyticsSitio.ts`).
2. **Hasta que la persona decide, no se mide.** No hay un tercer estado
   «mientras tanto, sin cookies»: `debeMostrarBanner`/`debeCargarGA` solo
   conocen `'sin-decidir'`, `'aceptado'` y `'rechazado'`, y el tag **nunca**
   se carga en el primero.
3. **La preferencia se guarda en el navegador de cada uno, nunca en
   Firestore.** No hay nada que guardar del lado nuestro y no queremos
   empezar a tener datos de visitantes — el §4 de `07-seguridad.md` es
   explícito en que del público no se guarda nada. Vive en una sola clave de
   `localStorage` (`CLAVE_CONSENTIMIENTO`, `analyticsSitio.ts`) y se puede
   revisar y cambiar después con el control «Cookies» que el propio banner
   deja siempre disponible una vez decidido — un banner sin forma de revisar
   la decisión es peor que no tenerlo.

**Lo que se pierde, y hay que poder defenderlo:** el número que se le vende a
un anunciante **baja por lo que rechace la gente**. Es la consecuencia que el
§7 del diseño ya anticipaba al describir C3 («la métrica que se vende cae por
lo que rechace la gente») y que el dueño aceptó al elegirlo. Un número que
subestima se puede defender frente a un anunciante — uno que se infla con
tráfico no consentido, no.

**Costo de UI:** los dos botones —«Aceptar» y «Rechazar»— son dos bloques del
mismo tamaño, el mismo padding y el mismo peso de fuente (uno macizo en
`acento`, el otro con borde de `tinta`), nunca un botón contra un link de
texto: es la garantía explícita contra dark patterns que el pedido puso por
escrito.

---

## D-251 · B-371 — se acepta el costo de JavaScript en la página de detalle

**Decisión:** instalar el snippet de GA4 (`gtag.js`, forma 1 del §6.2 del
diseño) en **todas** las páginas públicas, la de detalle incluida, y nunca en
`/admin`.

**El número, tal como lo midió el §6.1 del diseño y como el dueño lo vio antes
de decidir:** `gtag.js` pesa **155.578 bytes transferidos** (gzip) contra los
**18.341 bytes** de HTML de la página de detalle — el tag es **8,5 veces la
página**, y con un `cache-control: private, max-age=900` (15 minutos) no se
amortiza: es un costo de casi cada visita, no solo de la primera.

**Motivo para aceptarlo igual, y no una de las formas más baratas del §6.2:**
las alternativas que ahorran bytes —cargarlo diferido, o solo en la home—
pagan con **credibilidad**, que es el requisito de la mitad que motiva el
pedido (vender publicidad con un número de GA4). Un número que subestima **no
se sabe por cuánto** subestima, y eso no se puede defender frente a un
anunciante. Se aceptó el costo entero a cambio de un número entero.

**Lo que sí se aplicó del §6.3 sin costo:** `gtag.js` directo y nunca Google
Tag Manager (ahorra ~100 KB por no perder nada), `async` de verdad, y nunca en
`/admin` — el panel ya mide con su propia proyección y ahí el `page_view`
automático sí sería una fuga.

**Falta medir de nuevo tras el deploy real** (el número de este documento sale
de pegarle al tag en producción desde `curl`, no del build de este repo): si
en un año el tag pesa distinto, la decisión se revisa con el número nuevo, no
con este.

---

## D-252 · B-372/B-375 — la analítica del sitio público no hereda la del panel

Tres decisiones de implementación, ninguna heredada de `analytics-eventos.ts`
(el panel): «la proyección que hace segura la analítica del panel no se
hereda», dice el §5.4 del diseño, y hay que construirla de nuevo con sus
propios tests.

1. **El `page_location` que se manda a GA4 recorta la query entera, no un
   parámetro a la vez** (`ubicacionSinQuery`, `analyticsSitio.ts`). El
   `page_view` automático de `gtag.js` manda la URL completa, y la island de
   filtros escribe el texto del buscador en la query (`?q=...`, `aQuery` de
   `listadoPublico.ts`): sin este recorte, lo que alguien tipeó en el
   buscador de un sitio de actividades literarias se habría convertido en
   telemetría hacia un tercero por el solo hecho de instalar el tag. Se
   recorta la query **entera** y no un parámetro con nombre, porque es más
   simple de auditar y no depende de acordarse de sumar un eje nuevo el día
   que se agregue uno a la query.
2. **El clic de inscripción manda la vía, nunca el destino** — `via` se
   agregó a `AccionDeInscripcion` (`detallePublico.ts`) para que la plantilla
   pueda poner un `data-via="mail"` sin tener que derivarlo del `href`
   (`mailto:`, `wa.me/`, `instagram.com/`, o una URL de formulario), que sí
   podría tentar a alguien a leer el destino real más adelante.
3. **El filtro sin resultados manda el eje que `ejeQueSobra` ya identifica,
   no todos los ejes activos.** Es la misma señal que la pantalla ya
   muestra («Probá sin el filtro de…»): el único eje que, sacado, deja de dar
   cero. Cuando ninguno lo explica solo, el evento se manda igual pero sin
   `eje` ni `slug` — sigue siendo una señal válida y no hace falta inventar
   un valor «combinado» fuera de vocabulario.

Y una guarda que no es nueva pero se repitió a propósito: **el `slug` de ese
evento pasa por un formato de slug** (`^[a-z0-9]+(-[a-z0-9]+)*$`), no por un
vocabulario cerrado enumerado a mano — un texto de buscador con mayúsculas,
acentos o espacios no matchea y se descarta entero, en vez de viajar.

---

## D-253 · B-372 — GA4 tiene un productor que este repo no controla, y hace falta un paso manual del dueño

El `auditor-privacidad` encontró, sobre el mismo cambio que instala el tag, que
recortar el `page_location` no alcanza: **GA4 manda cosas por su cuenta que
ningún código de acá puede pisar.**

**Lo que se arregló en código, y entra en el mismo cambio que D-252:**

1. **El `page_referrer` también se recorta**, no solo el `page_location`.
   Navegar de `/?q=...` a la página de detalle mandaba, sin este segundo
   recorte, la URL de origen **entera** como referrer del `page_view` de
   llegada — el mismo dato que el primer recorte ya sacaba, por una puerta
   distinta. `ubicacionSinQuery` se reusa para las dos.
2. **El shim de `gtag` usa `arguments`, no un array armado con rest params.**
   `dataLayer.push(arguments)` es el snippet exacto que documenta Google;
   `dataLayer.push([...args])` construye un array de otra forma, y el riesgo
   —no verificado contra el `gtag.js` real, pero gratis de evitar— es que la
   librería, una vez cargada, ignore en silencio las entradas que no
   reconoce como `arguments`. Igualar el snippet real no cuesta nada y saca
   la duda.

**Lo que NO se puede arreglar en código, y queda como acción manual
bloqueante (B-480):** una vez que `gtag.js` carga, su **Enhanced
Measurement** —prendido por default en toda propiedad nueva— manda tres
cosas que no pasan por `construirEventoSitio` ni por `ubicacionSinQuery`:

| Qué manda solo | El dato que se escapa |
|---|---|
| **«Búsquedas en el sitio»** | lee parámetros de query con nombres típicos —`q` entre ellos— y los manda como `search_term`. Es el texto del buscador (`aQuery`, `listadoPublico.ts`), la misma fuga que el §5.3 del diseño ya había señalado, por una puerta que ningún recorte de `page_location` tapa |
| **«Cambios de página según el historial del navegador»** | la island de filtros llama a `replaceState` en cada tecla; esta función de GA4 dispara un `page_view` nuevo por cada uno, leyendo la URL **en el momento** y no la recortada del `config` inicial |
| **«Clics salientes»** | manda el `link_url` completo de un link a otro dominio — el botón de inscripción linkea a `wa.me/<teléfono>` o a `instagram.com/<handle>`, exactamente el **destino** que `via` existe para no mandar |

**No hay un parámetro de `gtag('config', ...)` que las apague.** Son ajustes
del flujo de datos en la consola de GA4 (Administrar → Flujos de datos → el
flujo → Enhanced measurement), la misma clase de paso manual que
`docs/09-analitica.md` ya documenta para el panel («qué tiene que hacer el
dueño») — acá es **bloqueante**: instalar el tag sin apagar «Búsquedas en el
sitio» y «Clics salientes» manda de más aunque todo el código de este repo
esté bien. Documentado en `docs/07-seguridad.md` (salida 12) y anotado como
**B-480** en el `BACKLOG`, bloqueando el cierre real de B-372 aunque el
código y el enganche en `Base.astro` ya estén hechos.


---

## D-254 · Se saca el `preconnect` a GA4 en vez de condicionarlo

**Encontrado antes de pushear, no en producción.** `Base.astro` tenía
`<link rel="preconnect" href="https://www.googletagmanager.com">`, condicionado
solo a `conChrome` (para no ofrecerlo en `/admin`) — sin ninguna condición de
consentimiento. El coordinador lo encontró leyendo `dist/index.html` de un
build real, antes de pushear el merge.

**Por qué un `preconnect` sin condicionar rompe D-250.** No es una pista
pasiva: el navegador resuelve DNS, abre TCP y completa el handshake TLS con SNI
para el host **en el load**, antes de que exista cualquier script y sin que la
persona haya tocado el banner. No manda la URL ni cookies, pero sí le dice al
borde de Google que este navegador, desde esta IP, entró al sitio — y eso
pasaba también para quien **rechaza**. D-250 promete «hasta que la persona
decide, no se mide»; con el `preconnect` puesto, esa frase era falsa desde el
primer render.

**Decisión: sacarlo, no condicionarlo.** En un sitio estático el `<head>` es el
mismo HTML para todo el mundo — la decisión de consentimiento vive en el
`localStorage` de cada visitante, y `Base.astro` no la conoce cuando genera la
página. No existe un `preconnect` condicional acá. Ponerlo por JavaScript un
instante antes de inyectar el script del tag tampoco ahorra nada: el pedido del
script sale en el mismo tick que lo haría sin el `preconnect`.

**Costo de sacarlo:** unos milisegundos de DNS/TLS en la primera carga del tag,
y solo para quien **ya aceptó** — el único momento en que ese tiempo se
gastaba con sentido. Barato al lado de lo que costaba dejarlo.

**La red que faltaba:** `tests/terceros-antes-del-consentimiento.test.ts` lee
el HTML **construido** (no el fuente — reimplementaría el parser de Astro) y
exige que todo host de un `<link>` de conexión (`preconnect`/`dns-prefetch`/
`prefetch`/`preload`/`stylesheet`), un `<script src>` o un `<iframe src>`
absoluto esté en una lista blanca explícita, con el motivo escrito al lado de
cada host. Hoy la lista tiene dos entradas —`fonts.googleapis.com` y
`fonts.gstatic.com`, las tipografías del sistema visual (B-260), anteriores a
todo esto y sin tocar en este ítem— y no tiene `googletagmanager.com`.

**No mira `<img>` a propósito.** El host de la imagen de una actividad varía
por documento (un flyer puede vivir en Instagram) y es una salida pública ya
decidida y auditada en `07-seguridad.md`, sin relación con el consentimiento de
analítica. Lo que este chequeo cuida es la **infraestructura fija** que sale
igual en todas las páginas porque viene de un layout o componente compartido —
que es exactamente la clase de bug que causó esto.

**Mutación probada:** se repuso el `<link rel="preconnect">` a mano en
`Base.astro`, se corrió el build y el test pasó a rojo nombrando
`www.googletagmanager.com` y el archivo exacto en las doce páginas construidas
(incluida `/admin`, porque la mutación de prueba no llevaba `conChrome`). Se
sacó de nuevo y se confirmó que vuelve a pasar.

**Anotado también, no resuelto:** las tipografías son, hoy, la misma clase de
conexión a un tercero en el load que este ítem acaba de sacar — solo que
decidida antes y sin la lupa del consentimiento encima. Autoalojarlas la
eliminaría del todo. Es una decisión de otro día: **B-481** en el `BACKLOG`.

---

## D-273 · El aviso «ya-paso» se saca del todo (revierte D-270)

**Contexto.** D-270 reescribió el aviso «ya pasó y sigue publicada» para que no
sonara a fricción. El dueño, al verlo ya reformulado, marcó el problema de fondo,
que el reencuadre no tocaba: **«en un año será enorme, no sirve para nada»**.

**Tenía razón, y es estructural, no de texto.** El aviso listaba *toda* actividad
publicada sin fecha futura — o sea el archivo entero, que sólo crece. Reformular
el título no cambia que:

- para la **mayoría** (las actividades únicas) no hay ninguna acción posible;
- el **único** caso accionable —un ciclo que vuelve y necesita fechas nuevas— no
  se puede distinguir del resto con los datos que hay;
- el archivo **ya vive en `/pasadas`**, así que el tablero lo estaba duplicando
  como lista de pendientes.

Una lista que crece sin techo y que para casi todo no pide nada enseña a ignorar
el tablero — el costo que D-270 ya nombraba, sin sacar la conclusión.

**Decisión.** Se elimina la clase de aviso `ya-paso` (título, filtro y su lugar
en `CLASES_DE_AVISO`). **Se conserva la cobertura «cuántas publicadas tienen
fecha futura»** (`publicadas.conFuturo`): dice lo mismo —qué parte del catálogo
sigue vigente— pero como **número acotado**, no como lista que crece. Quedan cinco
avisos, los cinco accionables y de tamaño acotado.

**Qué se pierde, y por qué está bien.** El recordatorio de «este ciclo terminó,
¿le cargás fechas nuevas?». No se puede aislar ese caso hoy; si más adelante el
modelo distingue «ciclo recurrente» de «actividad única», se puede reponer
**acotado a eso**, que es lo que D-270 intentaba aproximar listando todo.

## D-270 · El aviso «ya-paso» se reencuadra: no es una fricción, es el archivo funcionando

> **Superada por D-273 (2026-09-03):** el aviso se sacó del todo. Esta entrada queda por el rastro del razonamiento.

**El dueño lo marcó textual: «los eventos siguen publicados como archivos, no
entiendo el aviso».** Tenía razón. El tablero «Estado del catálogo» (B-370,
D-200) traía un aviso, «Publicadas a las que no les queda ningún encuentro»,
con el texto «Ya pasaron y siguen figurando como publicadas» — al lado de
avisos que sí son fricciones reales a arreglar (la inscripción cerrada con
gente que todavía puede escribir, sin flyer, sin etiquetas). Pero que una
actividad publicada **siga publicada** después de pasar es exactamente el
comportamiento correcto: se convierte en archivo, su página de detalle sigue
viva, el slug es inmutable (§2.1 y §2.2 del `CLAUDE.md`, `/pasadas` es ese
archivo). El texto viejo describía una anomalía donde no hay ninguna.

**Dos caminos, y se eligió el (a):** reescribir el texto para que sea
informativo y no alarmante, o sacar el aviso de la lista de fricciones y
mostrarlo aparte como estado. Se descartó (b) — separar la sección — porque el
tablero no distingue hoy ninguna otra gravedad de forma estructural (los seis
avisos comparten la misma forma de tarjeta, ordenados por gravedad en una sola
lista); crear una sección nueva para uno solo habría sido más superficie para
un caso que el texto ya resuelve. Se aplicó (a): el título pasa a «Terminaron y
pasaron al archivo» y el «porque» explica la única acción real —«si alguna es
un ciclo que vuelve, cargale las fechas nuevas; si fue una actividad única, no
hay nada que hacer»— en vez de sonar a alarma.

**Y se movió al final de `CLASES_DE_AVISO`.** El orden de la lista es por
gravedad (comentario ya existente en el código), de lo que le hace perder algo
a alguien de afuera arriba, a lo que nos hace perder trabajo propio abajo. Un
aviso que la mayoría de las veces no pide ninguna acción no puede ir segundo,
al lado de «inscripción cerrada» que sí es urgente. Queda último, después de
`esperando`.

**Lo que NO se tocó: el filtro.** `publicadas.filter(a => (a.sesiones ?? []).length > 0 && !tieneFuturo(a, ahora))`
sigue exactamente igual — el criterio de qué actividad se señala es correcto,
lo que estaba mal era cómo se presentaba. Cerrado con `tests/estado-del-catalogo.test.ts`
(dos casos nuevos: la posición en `CLASES_DE_AVISO` y el texto del aviso, con
mutación probada — revertir el cambio los pone en rojo).

Ítem: **B-500**.

---

## D-271 · El tablero pasa a pestañas internas, con el patrón de teclado que a `CentroAyuda` le faltaba

**Por qué.** El dueño pidió que el tablero «Estado del catálogo» (B-370,
D-200) deje de ser una página larga, y con la mitad nueva de B-502 sumándose
abajo, apilar una tercera sección la volvía un scroll interminable de verdad.
`EstadisticasPanel.tsx` es un island `client:only`: sobra JavaScript para
pestañas reales, así que no hace falta ninguna navegación ni un cambio de
ruta — es estado de React, como ya lo es todo lo demás de la pantalla.

**Dos pestañas de primer nivel: «El catálogo» y «El sitio público».** No tres
ni cinco — son las dos mitades que el propio [`16-analitica-del-sitio.md`](16-analitica-del-sitio.md)
§2 ya distingue («los números para vender» y «los números para mejorar» son
la mitad de abajo; «lo que hay cargado» es la de arriba), así que la pestaña
no inventa una categoría nueva, refleja una que ya existía en el diseño.

**El patrón: WAI-ARIA APG, «tabs con activación automática».** `role="tablist"`
en el contenedor, `role="tab"` + `aria-selected` + `aria-controls` en cada
botón, `role="tabpanel"` + `aria-labelledby` en el contenido, y roving
`tabIndex` — solo el botón activo lleva `tabIndex=0`, los demás `-1`, así que
`Tab` entra una sola vez a la pestaña activa y no obliga a tabular por las dos.
Las flechas (`←`/`→`) mueven el foco **y** cambian la pestaña activa en el
mismo gesto, sin esperar un `Enter` después; `Home`/`End` van a los extremos.

**Por qué no reusar el patrón de `CentroAyuda` tal cual.** `CentroAyuda.tsx`
(Guía/Novedades del centro de ayuda) ya usa `role="tablist"`/`"tab"`/`"tabpanel"`
con la misma estética (`claseBotonTinta`/`claseBotonSecundario`), pero **solo
cablea el click** — sin flechas, sin roving `tabIndex` (los dos botones llevan
`tabIndex` implícito). Con dos pestañas y un mouse a mano nunca se notó. Este
tablero copia la forma visual y agrega la navegación por teclado completa: es
la pieza que faltaba, no una nueva. Queda anotado por si alguna vez conviene
extraer un hook común — hoy son dos usos, no tres, y extraer con dos instancias
suele producir la abstracción equivocada.

**Reorganización de «El catálogo», no solo el nombre de pestaña.** «Lo que se
publica» y «Qué hay cargado» pasan de estar apiladas a ir lado a lado desde
`lg` (`grid gap-8 lg:grid-cols-2`). Los avisos siguen arriba y a todo lo ancho
porque siguen siendo lo accionable — eso no cambia.

**Sin telemetría nueva.** `estadisticas-abrir` sigue siendo el único evento de
esta pantalla (§8.3 del documento): cuál pestaña mira alguien no cambia si vale
construir B-374, así que medir el cambio de pestaña sería medir por medir —
la misma disciplina de «diez eventos bien elegidos» de `09-analitica.md`.

**Verificado con DOM real**, no con el fuente: `tests/estadisticas-pestanias.render.test.tsx`
(qué panel se ve al hacer click, `ArrowRight`/`ArrowLeft` con wrap, y el roving
`tabIndex`), con mutación probada — se fijó el panel mostrado en «catálogo» sin
importar la pestaña activa, y dos tests pasaron a rojo señalando exactamente
eso.

Ítem: **B-501**.

---

## D-272 · La pestaña «El sitio público»: andamiaje honesto, ni un número inventado

**El problema que esta decisión resuelve.** El pedido quería vistas, páginas
más vistas, secciones, clics y fricciones **en el panel**. Esa lectura —la
Data API de GA4 vía una Cloud Function— es **B-374**, y no se puede construir
todavía: GA4 no mide retroactivo (§9.2 del documento) y hace falta al menos un
mes de datos desde que el tag mide de verdad. Construir la pestaña sin esos
datos deja dos caminos malos — no construir nada (el pedido de tres cosas queda
en dos) o mostrar números de relleno (mentirle al dueño en la única pantalla
que existe para no mentirle, justo la que el pedido original quería para
vender confianza a un anunciante). Se eligió un tercer camino: **construir la
estructura, con un estado vacío deliberado.**

**Qué tiene la pestaña, concretamente:**

1. Una franja fija que dice tres cosas sin adornos: que hoy no hay un solo
   número y es a propósito; la fecha exacta desde la que hay algo que medir
   —**el 3 de septiembre de 2026**, el día en que el tag de GA4 empieza a
   medir en producción (B-372, B-480 ya resuelto)—; y qué falta en concreto
   (un mes de datos + la Function de B-374), no un genérico «próximamente».
2. Dos grupos de filas, calcados de la tabla del [§2](16-analitica-del-sitio.md#2--dos-mitades-y-no-una)
   del documento de arquitectura: «Para ofrecer a un anunciante» (lo que GA4 da
   solo) y «Para mejorar el sitio» (los dos eventos propios, `clic_inscripcion`
   y `filtro_sin_resultados` — ya instalados por B-375, esperando volumen).
   Cada fila con su explicación en el idioma del dueño y un «sin datos aún», en
   vez de un número o un gráfico vacío que se puede confundir con un error.

**Lo que se decidió no inventar.** El pedido nombraba «secciones» como una
métrica propia. El documento de arquitectura ya la había retirado a propósito
en su §3.1 —«categoría de herramienta, no pregunta»— y la convirtió en la
pregunta 2 («¿qué páginas se miran más?»). Esta pestaña no la resucita como
fila aparte: la fila «Las páginas más vistas» aclara que agrupar por sección
(inicio, cartelera, agenda por mes, detalle, archivo) es la misma pregunta,
vista agrupada — una decisión de presentación cuando B-374 exista, no una
métrica nueva que este cambio esté prometiendo.

**Diseño visual: se mantuvo el lenguaje ya establecido del panel** (bordes
finos `border-borde`, sin sombras, densidad, la paleta `tinta`/`acento` que ya
usa el resto de `EstadisticasPanel.tsx`), en vez de importar el sistema
«Brutalismo editorial» de [`docs/referencias/sistema-visual.md`](referencias/sistema-visual.md)
tal cual —radio 0 en todo, tipografía Bodoni Moda/Archivo Narrow— porque ese
sistema está aprobado y aplicado para el **sitio público**, no para `/admin`,
y el resto del panel (`Campo.tsx`, `CentroAyuda.tsx`, y el propio tablero) usa
hoy bordes redondeados (`rounded-md`) de forma consistente. Mezclar dos
lenguajes visuales en una sola pantalla —uno filoso y otro redondeado— habría
sido peor que no aplicar ninguno de los dos a fondo. Lo nuevo de esta pestaña sí
sigue el espíritu que pide el sistema —sin sombras, sin degradados, reglas
finas, densidad— y no agrega radio nuevo donde antes no lo había. Si el panel
entero adopta el sistema visual del sitio alguna vez, es un cambio consciente
y parejo, no uno que empiece por una sola pestaña.

Ítem: **B-502**.
## D-230 · `usos` cuenta contra el documento anterior, no con una lectura extra

**Problema (B-340):** `registrarUsos` sumaba 1 por guardado, así que editar (o
re-guardar borrador, B-183) la misma actividad varias veces inflaba `usos` de su
tipo, arancel, barrio y etiquetas sin que nadie hubiera vuelto a elegir esa
opción. Rompe los dos trabajos del §4.3: ordenar por frecuencia real y detectar
un `usos: 1` como typo colgado.

**Las alternativas que el ítem dejaba abiertas:** una lectura extra a Firestore
antes de guardar, que `actualizarActividad` devuelva el `before` que la Function
de historial ya escribe, o descontar el uso viejo cuando una etiqueta se
reemplaza.

**Lo decidido:** ninguna lectura nueva. `ActividadFormulario` ya tiene `inicial`
—el documento tal como estaba cuando el formulario se abrió, cargado una sola
vez— y hasta ahora nadie lo usaba para esto. Se lo pasa a `guardarActividad`
como `anterior`, y `usosAContar(guardado, labelsNuevos, tagsNuevos, anterior)`
resta lo que ya estaba en `anterior` además de lo recién creado con "Otro"
(B-168): las dos restas conviven, no se reemplazan.

**Por qué alcanza sin tocar `actualizarActividad`:** el componente del
formulario se desmonta después de **cualquier** guardado (`AdminApp.tsx` vuelve
siempre a la vista anterior), así que dentro de una misma sesión de edición
`inicial` nunca queda desactualizado por un guardado propio — no hay reintentos
sobre la misma instancia que pudieran recontar un cambio ya contado. Reabrir la
actividad más tarde trae un `inicial` fresco de Firestore, que es exactamente
la comparación correcta.

**Consecuencia en una actividad nueva:** sin `anterior` (no hay documento previo)
se cuenta todo, igual que antes — no hay nada que restar.

## D-231 · La plataforma «a confirmar» se detecta por slug, nunca por label

**Problema (B-190):** con la opción base `a-confirmar` sola (`{slug:
'a-confirmar', label: 'A confirmar'}`), el detalle público y el texto para
redes leían el *label* igual que cualquier otra plataforma real — «Online por A
confirmar», `VirtualLocation { name: "A confirmar" }` en el JSON-LD— y eso
publica una plataforma que no existe, justo en el lugar que Google indexa
primero.

**Lo decidido:** `ModalidadDeDetalle.plataformaAConfirmar` (y su equivalente
inline en `textoRedes.ts`) se calcula comparando `online.plataforma` —el
**slug** guardado— contra `'a-confirmar'`, nunca comparando el label resuelto
contra el string `"A confirmar"`. El label es texto editable desde la pantalla
de Opciones (§4.3): si alguien lo renombra a «Por confirmar» o «TBD», una
detección por label deja de disparar y el sitio vuelve a publicar el nombre
inventado sin que nada avise. El slug es la identidad estable de la opción; el
label es cosmético.

**Consecuencia por consumidor**, tres, no cuatro (el cuarto, `functions/
calendario.js`, ya leía bien con «Plataforma: {label}»):

- `dondeCorto` (`detallePublico.ts`): "Online, plataforma a confirmar" en vez de
  "Online por {label}".
- El JSON-LD (`lugaresDe`, mismo archivo): el `VirtualLocation` sale **sin**
  `name` — no hay plataforma que nombrar, y `VirtualLocation` no exige el campo.
- `bloqueDonde` (`textoRedes.ts`): cae al genérico "Encuentro virtual", que ya
  existía para el caso sin plataforma.

## D-232 · Las fechas del formulario se validan con el mismo parser que las convierte, y `superRefine` en vez de `refine`

**Problema (B-200):** `sesionSchema` y `modalidadFilaSchema` comparaban fechas
con `new Date(a) > new Date(b)` sin verificar antes que fueran parseables.
Medido antes de decidir nada: en `sesionSchema` (las dos fechas obligatorias)
una fecha corrupta **ya** hacía fallar la comparación —cualquier comparación
contra `NaN` da `false`—, pero con el mensaje equivocado. El agujero de verdad
estaba en `modalidadFilaSchema`, donde las dos fechas son opcionales y el corto
circuito `!m.inicio || !m.fin || …` corta antes de comparar nada: una ventana
con una sola punta corrupta pasaba entero. Lo mismo en `inscripcion.cierra`, sin
ninguna guarda. Los dos casos llegaban intactos a `formADocumento`, que recién
ahí tiraba `Fecha inválida: "…"` — el crash real que B-200 reporta.

**Lo decidido:**

1. `fechaValida()` en `schema.ts` usa `deDatetimeLocal` de `lib/sesiones.ts` —el
   mismo parser que `formADocumento`— en vez de reimplementar el chequeo
   (B-72/B-75, D-20): antes solo `formADocumento` sabía distinguir una fecha
   corrupta de una válida, y se enteraba después de que el schema ya había dado
   el visto bueno.
2. Los dos `.refine` pasan a `.superRefine`, para poder emitir un mensaje
   distinto según cuál fecha falló («Fecha de inicio inválida» / «Fecha de fin
   inválida») en vez de agrupar todo bajo «tiene que terminar después de
   empezar», que es engañoso cuando el problema es que se tipeó cualquier cosa
   y no que el orden está invertido.
3. `inscripcion.cierra` gana su primera guarda de forma, en el `superRefine`
   incondicional del schema (el mismo donde ya viven las dos reglas de la
   galería que corren en los dos niveles, D-120): es forma, no completitud —
   una fecha corrupta haría ilegible el documento, no lo dejaría incompleto.

## D-292 · La vista calendario del panel usa la misma puerta que el evento público para numerar

**Contexto (B-163).** D-190 ya había unificado la **aritmética** del número de
encuentro (`numeroDeEncuentro`, compartida por `@calendario`) pero dejó la
**puerta** —¿se muestra el número?— sin decidir a propósito: el evento numera
solo si `esCiclo` está tildado (`elEventoNumeraElCiclo`), y la vista calendario
del panel (`encuentrosDe`) numeraba **cualquier** actividad de más de una
sesión. El schema prohíbe `esCiclo` con menos de dos sesiones pero no el
recíproco, así que tres encuentros sin tildar el ciclo eran un documento válido
donde el panel decía "Encuentro 2 de 3" y el evento público no decía nada — dos
criterios para lo mismo derivado, la forma que D-71 y D-20 existen para evitar.

**Decisión: la vista calendario del panel adopta `elEventoNumeraElCiclo`**, la
misma función que ya usa `construirDescripcion`, en vez de tener su propia
puerta. Se agrega `numeraElCiclo: boolean` a `Encuentro`
(`src/lib/calendarioPanel.ts`) y `CalendarioActividades.tsx` la usa para decidir
si pinta "Encuentro N de M" — la aritmética (`indice`/`total`) se sigue
calculando siempre, se muestre o no, así que no hay nada que recalcular el día
que se tilda `esCiclo`.

**Por qué esta de las dos salidas, y no "que el evento numere sin `esCiclo`".**
D-190 dejó escritas las dos, con su costo:

- *que el evento numere con más de una sesión aunque no sea ciclo* → le cambia
  el texto a los eventos **ya publicados** de esas actividades: a quien los
  tiene agendados se le reescribe el evento sin que nada haya cambiado para él.
  Es el argumento de D-95 y B-84 otra vez, y es exactamente lo que este cluster
  de decisiones (D-95, D-190, D-191) viene evitando en cada esquina.
- *que el panel deje de numerar sin `esCiclo`* → **no toca ningún evento
  publicado.** Es la que se eligió.

El costo que se acepta, a propósito: una actividad de más de una sesión sin
`esCiclo` tildado vuelve a mostrar sus filas sin número en la vista calendario
del panel — el problema que la regla 1 de D-70 existe para resolver ("varias
filas con el mismo título se leen como varias actividades"). Se acota porque en
la práctica el caso es de borde: el formulario tilda "es ciclo" solo como parte
de la cascada de "club de lectura" y "feria" (§11 del CLAUDE.md), así que casi
toda actividad de más de una sesión ya llega con `esCiclo` tildado. Si en el uso
real aparece seguido una actividad de varias sesiones deliberadamente sin
`esCiclo`, revisar esta decisión — pero no reescribiendo eventos ya publicados
sin que el dueño lo pida explícitamente.

**Es reversible en una línea:** `numeraElCiclo` es un campo derivado, no
guardado; volver al criterio anterior (`total > 1`) no requiere ninguna
migración de datos.

Tests: `tests/costuras.test.ts` (`sin esCiclo ni el panel ni el evento
numeran; con esCiclo, los dos`) fija la aritmética, la puerta compartida y que
el panel la respeta, los tres a la vez. `tests/calendarioPanel.test.ts` cubre
además el caso de una sola sesión con `esCiclo` tildado (el schema no prohíbe
el recíproco).

## D-293 · Leer Calendar de verdad es un script que impersona la service account, no un `onCall` del panel

**Contexto (B-125, la mitad que quedaba tras D-191).** D-191 ya resuelve el
caso en que una escritura genuina descubre un evento borrado a mano (un
`actualizar` que pega 404 se recrea). Lo que seguía sin cerrar es enterarse
**sin** esa escritura: la vista calendario sigue leyendo `calendarEventId` del
documento y asumiendo que eso es lo que Calendar tiene (D-71). Cerrarlo pide
preguntarle a la API, y la identidad para hacerlo es la de la Function
(`calendar-sync@…`, D-06) — el panel no tiene, ni debería tener, credenciales
propias contra Calendar.

**Decisión: un script (`scripts/verificar-calendario.mjs`), no un `onCall`
nuevo en `functions/`.** Las dos vías estaban sancionadas desde D-191 ("el
panel o un script"); se elige la segunda porque un `onCall` suma una superficie
de auth nueva —un endpoint HTTPS más para proteger, versionar y no romper— para
una tarea de mantenimiento ocasional que el dueño corre a mano, no algo que el
panel necesite en cada carga. El script:

1. Se autentica **impersonando** `calendar-sync@agenda-literaria.iam.gserviceaccount.com`
   desde las ADC de quien lo corre (`google-auth-library`, clase
   `Impersonated`), sin bajar ninguna key — mismo espíritu que D-06. Pide un
   permiso nuevo, de una sola vez: `roles/iam.serviceAccountTokenCreator` sobre
   esa service account, otorgado a la cuenta de quien lo va a correr. Runbook en
   `docs/08-operacion.md` § "Verificar contra Calendar de verdad (B-125)".
2. Llama a la API REST de Calendar con `fetch`, no con el paquete `googleapis`:
   el script usa un solo verbo de lectura (`events.get`) y ocasionalmente
   `insert` para reparar, y eso no justifica sumar el SDK completo (~150 MB de
   tipos generados) a las dependencias de la raíz del repo. `functions/` sí lo
   usa, porque ahí es una dependencia productiva con más superficie.
3. **Nunca toca un evento que Calendar confirma que existe.** Solo repara
   (recrea) los que Calendar confirma con 404/410 — los mismos códigos que
   `decidirAnteFallo` (D-191) — y dijo `desconocido` con cualquier otro código
   (403, timeout, cuota): afirmar un borrado sobre un error ambiguo generaría
   una reparación sobre una sospecha, y un evento duplicado es peor que no
   decir nada.
4. El default es de **solo lectura** (reporta, no escribe nada); reparar pide
   `--reparar` explícito.
5. La reparación reusa `construirEvento`, `idDeEvento` y `reponerIds` de
   `functions/calendario.js` y `functions/sincronizacion.js` — los mismos que
   usa el sync real — en vez de reimplementarlos: es la misma clase de bug que
   `milisDe` ya hizo una vez (B-350) y que `clases-de-bug.test.ts` persigue.

**El tope de 200 sesiones por corrida es real, con cursor — no una promesa
vacía.** Lo encontró el `auditor-trampas` (P1) en la primera versión: la query
no tenía orden ni cursor, así que "correr de nuevo" —lo que el mensaje y la
doc de operación prometían— repetía siempre las mismas primeras 200
candidatas. Una sesión borrada a mano más allá del tope no se detectaba
**nunca**, en cualquier despliegue con más actividades publicadas de las que
entran en una corrida — exactamente el escenario que B-125 existe para cubrir,
fallando en silencio. Arreglado: `sesionesAVerificar`
(`functions/reconciliacion.js`) corta por **actividad completa**, nunca a
mitad de una, y devuelve `siguienteCursor` — el id de la última actividad
procesada entera. La query de Firestore se ordena por
`FieldPath.documentId()` (mismo patrón que `historial-trigger.js`) y
`--desde <cursor>` la arranca después de ese punto con `startAfter`. El
mensaje de la corrida truncada imprime el comando exacto para seguir, en vez
de una promesa genérica.

**Por qué no se puede probar contra el emulador, y qué se hizo en su lugar.**
No existe un emulador de Calendar — el gate del §10 del CLAUDE.md ("nunca
desarrollar el sync contra el calendario real") no tiene cómo aplicarse acá tal
cual. La lógica de **decisión** (qué verificar, qué significa cada respuesta)
es pura y está en `functions/reconciliacion.js`, testeada sin red
(`tests/reconciliacion.test.ts`). La **orquestación** (Firestore + Calendar +
la reparación, `ejecutarVerificacion` en el script) se separó del `main` que
arma las credenciales reales, así que se testea con un `db` y un `cal` de
mentira (`tests/verificar-calendario.test.ts`) sin tocar ni el emulador ni el
calendario real — el mismo criterio con el que `functions/index.js` tampoco se
testea de forma directa, solo sus dependencias puras.

**Alternativa descartada: leer el ICS privado** (la vía que ya usa
`docs/08-operacion.md` § "Leer el calendario real" para diagnóstico manual).
No pide ningún permiso nuevo, pero Google actualiza los feeds ICS con demora
—horas, no al toque— y el `UID` de cada `VEVENT` no está documentado como
estable frente al `id` que devuelve la API: verificar contra un feed que puede
tardar en reflejar un borrado cambia qué tan rápido se detecta el problema, y
depender de un formato no garantizado por Google para decidir si se recrea un
evento es peor que pedir el permiso de impersonación una vez.

## D-310 · `resuelto` es un campo local del panel, no un espejo del cierre del issue en GitHub

**Problema (B-580):** la pantalla de Reportes mostraba todos los reportes que
se cargaron alguna vez, resueltos o no. El dueño quiere que refleje solo los
abiertos.

**La alternativa obvia era la sync GitHub→Firestore:** que cerrar el issue
marque el reporte solo, con un `onSchedule` que consulte los issues con la
etiqueta `reporte-panel` o un webhook hacia una función HTTP. Es exactamente lo
que **B-30** ya describía ("las respuestas del dueño no vuelven al panel") y el
dueño **acaba de descartar en esta misma tanda** ("dejamos como está") — con
webhook, además, hay que validar `X-Hub-Signature-256` con un secreto nuevo en
Secret Manager, más superficie para un caso de uso que no lo justifica.

**Decisión: un flag `resuelto: boolean` en `/reportes/{id}`, que marca un admin
a mano desde el panel.** Es el mismo criterio del §2.1 del `CLAUDE.md` para
Calendar, aplicado acá: Firestore es la única fuente de verdad, y sincronizar
de vuelta desde un sistema externo (Calendar allá, GitHub acá) es
desproporcionado para el caso de uso. Si el dueño cierra el issue en GitHub y
se olvida de tocar el panel, el reporte sigue en la lista de abiertos — es el
comportamiento esperado, igual que un evento editado a mano en Calendar se
pierde en el próximo sync.

**Por qué no vive en `functions/reportes.js`:** no hay ninguna Function nueva.
`marcarResuelto` (`src/lib/reportes.ts`) es un `updateDoc` directo desde el
cliente, autorizado por una regla nueva (`resueltoValido`, mismo patrón que
`reintentoValido` de B-31/D-101): acota la escritura a **solo** `resuelto` y
`actualizadoEn`, y exige el claim `admin`.

**El filtro por defecto de la pantalla es en memoria, no en la query.**
`resuelto` es opcional —los reportes de antes de B-580 no lo tienen— y
Firestore no matchea un documento sin el campo ni con `== false` ni con `!=`:
una query `where('resuelto','!=',true)` habría ocultado de la vista "abiertos"
a todo lo cargado antes de este cambio, que es lo contrario de lo pedido. Se
subió el `limit()` del `onSnapshot` de 10 a 50 y se filtra del lado del
cliente, para que el filtro no le coma cupo a los reportes abiertos cuando hay
varios resueltos entre los más nuevos.


## D-320 · El tercer panel del tríptico resta los días ya contados, salta de semana con otro rótulo, y su «+N más» no es un enlace

**Problema (B-600).** El tríptico «¿Qué hay ahora?» de la home son tres paneles
—**Hoy · Mañana · Este finde**— y los tres tienen que caber en una sola línea de
lectura, uno al lado del otro. Eso obliga a decidir dos cosas que con paneles
separados no harían falta: **qué días agarra el tercero** y **qué se hace con lo
que no entra en el tope de cuatro filas**.

### La resta: el finde es sábado y domingo **menos** lo que ya contaron los dos primeros

Un viernes, «Mañana» **es** el sábado. Con el finde definido como «sábado y
domingo de esta semana» a secas, el mismo encuentro sale en la segunda y en la
tercera columna del mismo tríptico, a diez centímetros de distancia. Eso se lee
como un error de software y no como dos lecturas del mismo dato.

**No es el caso de la actividad destacada del §4.1**, que aparece en la tira de
arriba y otra vez en su mes: ahí las dos apariciones están a media pantalla y
contestan preguntas distintas («lo que recomendamos» / «lo que hay en
septiembre»). Acá los tres paneles contestan **la misma** pregunta partida en
ventanas, y ventanas que se solapan no son ventanas.

Así que el tercero se queda con los días del finde que no estén ya en «Hoy» ni en
«Mañana». Un viernes es solo el domingo; un jueves son los dos.

### El salto de semana, y por qué cambia el rótulo

Cuando la resta deja la ventana **sin días** —hoy es sábado, o es domingo— hay
tres salidas posibles y dos son peores:

| Salida | Por qué no |
|---|---|
| Dibujar dos paneles | El tríptico deja de ser un tríptico un día y medio de cada siete, y la página cambia de forma sin que nadie la haya cambiado |
| Dejar el tercero vacío | «Este finde: no hay nada» **un sábado** es falso: el finde es hoy, y lo que hay está en el panel de al lado |
| **Saltar al finde siguiente** | Es lo que alguien quiere saber un domingo a la tarde, y es lo que se hizo |

Pero saltando, **el rótulo no puede seguir siendo «Este finde»**: un sábado, «este
finde» es hoy, y el panel estaría hablando de algo que falta una semana. Con la
fecha escrita al lado («sáb 26 sep y dom 27 sep») el desvío se vería, pero un
rótulo que hay que desmentir con la letra chica de al lado es un rótulo mal
elegido. Así que pasa a **«El finde que viene»**.

**Y un domingo usa ese mismo rótulo por una razón distinta**, que es la parte que
se equivoca sola si se implementa mirando el salto en vez del día de la semana: un
domingo **no hay salto** —el sábado que viene está a seis días y no se solapa con
nada— pero el finde de su propia semana se está terminando, así que tampoco es
«este». Los dos casos comparten rótulo y no comparten causa; por eso la condición
mira `dow === 0` además del salto.

### El «+N más» es texto, no un enlace

El tope es de cuatro filas por panel (un panel de doce filas deja de leerse de un
vistazo y empuja el listado abajo del pliegue en un teléfono — el argumento de
D-143 sobre los filtros). Lo que sobra se dice en palabras: «+2 más hoy».

**Y no linkea a ninguna parte, a propósito.** El [§2.3](12-sitio-publico.md#23-lo-que-decidimos-que-no-es-url)
decide qué es página y qué es filtro, y **el día no está en ninguna de las dos
listas**: no existe un «cronograma de hoy» al que mandar. Inventar acá un
`/dia/2026-09-15` sería decidir de paso una decena de URLs indexables nuevas —con
su título, su `meta description`, su canónica y su lugar en el sitemap— en el pie
de un panel, y contra la regla de las tres del [§2.2](12-sitio-publico.md#22-la-regla-de-las-tres):
un día suelto casi nunca tiene tres actividades.

Lo que sí hay es **el listado completo, en esta misma página y unos centímetros
más abajo**, ya agrupado por mes. Un enlace a otro lugar sería peor que el texto:
mandaría a buscar afuera lo que está debajo.

### Dónde vive

`src/lib/ahoraPublico.ts`, puro y testeado (`tests/ahoraPublico.test.ts`, con los
siete días de la semana table-driven). No vive en el componente por lo mismo que
`tarjetaPublica.ts`: los componentes de este repo no tienen tests de render
([`05-patrones.md`](05-patrones.md)), y lo que se decide acá es **aritmética de
calendario en una zona con offset**, que es la trampa 1 del §13 en su versión más
filosa.
