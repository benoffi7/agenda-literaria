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

`sede.geo` existe en el modelo pero el formulario no lo captura, así que hoy
siempre resuelve por dirección.

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

**Riesgo aceptado:** `arancel` arranca en "Gratis". Si se carga un taller pago y
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

---

## D-14 · La documentación se actualiza con cada cambio

**Pedido del usuario.** Está en [`05-patrones.md`](05-patrones.md) como regla de
proceso, con la tabla de qué documento toca según el tipo de cambio, y la regla
de que todo reporte de posible bug va al [`BACKLOG.md`](BACKLOG.md) ordenado por
prioridad.

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
