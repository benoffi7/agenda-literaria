# Modelo de datos

La definición canónica está en el **§3 del [`CLAUDE.md`](../CLAUDE.md)** y su
traducción a TypeScript en [`src/types/actividad.ts`](../src/types/actividad.ts).
Este documento no la repite: explica cómo se usa y dónde están las trampas.

## Colecciones

| Ruta | Qué guarda | Quién escribe |
|---|---|---|
| `/actividades/{id}` | una actividad con sus N sesiones embebidas | panel (claim `admin`) y `syncCalendar` |
| `/actividades/{id}/versiones/{version}` | historial de versiones (§12) | `guardarVersion` y `guardarVersionAlBorrar` (Admin SDK) |
| `/opciones/{campo}` | taxonomías autogestionadas (§4) | panel y scripts |
| `/sistema/rebuild` | flag de rebuild pendiente y estado de los reintentos (§8) | `syncCalendar`, `rebuildPorOpciones`, `dispararRebuild` |
| `/reportes/{id}` | bugs y sugerencias cargados desde el panel | panel (crea) y `reporteAIssue` (mueve el estado) |

`{campo}` de opciones es uno de: `arancel`, `tipo`, `barrio`, `plataforma`,
`tags`.

### `/sistema/rebuild`

Documento único. No lo lee nadie más que la Function del schedule, pero es
donde hay que mirar cuando el sitio no se actualiza
([`08-operacion.md`](08-operacion.md)).

```
pendiente: boolean        // hay cambios sin publicar
motivo: string            // "actividad abc123" / "opciones/tags"
actualizado: Timestamp    // cuándo se marcó
disparado: Timestamp      // cuándo salió el último dispatch OK
intentos: number          // fallos CONSECUTIVOS del dispatch; 0 = todo bien
ultimoError: string|null  // el error del último fallo, recortado a 300 chars
ultimoIntento: Timestamp  // de acá sale el backoff exponencial
agotado: boolean          // se rindió: no reintenta hasta un cambio nuevo
```

Los cuatro últimos son de B-13. `intentos` se resetea con un disparo exitoso o
con un cambio nuevo (D-23): un cambio nuevo merece sus propios intentos, y es
lo que hace que el lazo se recupere solo cuando el problema de fondo se arregla.

`ultimoIntento` y `disparado` se escriben como `Date` y no con
`serverTimestamp()`: la lógica del backoff lee `ultimoIntento` de vuelta para
comparar, y el sentinel de servidor no se puede comparar con nada. `actualizado`
sí usa `serverTimestamp()` porque nadie lo lee para decidir.

## Las dos representaciones de una actividad

Hay dos formas del mismo dato y conviene no confundirlas:

| | `Actividad` | `ActividadForm` |
|---|---|---|
| Dónde vive | Firestore | estado del formulario |
| Fechas | `Timestamp` | `string` de `datetime-local` |
| Campos de auditoría | sí | no |
| Definida en | `types/actividad.ts` | `types/actividad.ts` |

La conversión es en [`src/lib/actividades.ts`](../src/lib/actividades.ts):

- `formADocumento(form, uid, esNuevo)` — form → Firestore
- `documentoAForm(actividad)` — Firestore → form

El ida y vuelta está testeado (`tests/actividades.integracion.test.ts`): no debe
perder datos, y en particular no debe perder los ids de sesión.

## Sesiones — la parte delicada

```
sesiones: [{
  id: 'ses_<uuid>',       // generado en el cliente, NUNCA por índice
  inicio: Timestamp,
  fin: Timestamp,         // la duración sale de acá
  tema: string | null,
  lectura: string | null,
  cancelada: boolean,
  calendarEventId: string | null
}]
```

**El `id` es la llave de todo el sync a Calendar.** Se genera con
`nuevaSesionId()` de [`src/lib/sesiones.ts`](../src/lib/sesiones.ts) al crear la
fila del formulario.

Si se usara el índice del array, borrar la sesión 3 renumera todo y el diff
creería que cambiaron cinco encuentros en vez de uno: borraría y recrearía
eventos que la gente ya tiene agendados, perdiendo sus recordatorios y
suscripciones (trampa 2). Hay tests específicos para esto en
`tests/calendario.test.ts`.

`calendarEventId` lo escribe la Function, no el panel. El formulario lo conserva
tal cual al editar, y desde B-80 la Function lo **repone** en cada
sincronización si el documento vino sin él (D-91): el panel emite el campo en
cada guardado y puede pisarlo con `null` si guardó desde un listado que se
refrescó antes del write-back.

**El id del evento de Calendar se deriva del id de sesión** (`ses_<uuid>` sin el
`_` ni los guiones, `idDeEvento` en
[`functions/sincronizacion.js`](../functions/sincronizacion.js)): así una
reentrega del evento de Firestore no puede crear un segundo evento (D-90). Los
eventos creados antes de eso conservan el id que les dio Google, y se siguen
encontrando por este campo — que es, y sigue siendo, la única referencia entre
una sesión y su evento.

**Al duplicar una actividad, los ids se rehacen y `calendarEventId` vuelve a
`null`** (`src/lib/duplicar.ts`). Dos actividades con los mismos ids de sesión
harían que editar una toque los eventos de la otra: el diff del §7.2 no tiene
forma de distinguirlas.

## Fechas

**Siempre `Timestamp`, nunca strings** (trampa 1). Y siempre `timeZone`
explícito hacia Calendar (`America/Argentina/Buenos_Aires`). Es el bug clásico
de eventos corridos tres horas.

En el formulario las fechas son strings de `datetime-local` en hora local del
navegador. La conversión de ida y vuelta está en `sesiones.ts`
(`aDatetimeLocal` / `deDatetimeLocal`) y testeada para que no corra la hora.

## `tipo` único + `tags` array no es redundante

Firestore permite un solo `array-contains-any` por query. Si todo fuera a
`tags`, no se podrían cruzar dos filtros de array (§3.2).

## Taxonomías (§4)

Un patrón genérico resuelve cinco campos: desplegable enumerado + casilla
"Otro" cuyo valor se incorpora al desplegable para usos futuros.

```
/opciones/arancel
  valores: [
    { slug: 'gratis',       label: 'Gratis',           orden: 1, fijo: true,  usos: 0, aprobada: true },
    { slug: 'a-la-gorra',   label: 'A la gorra',       orden: 2, fijo: true,  usos: 0, aprobada: true },
    { slug: 'beca-parcial', label: 'Con beca parcial', orden: 9, fijo: false, usos: 3, aprobada: true },
    { slug: 'bono-social',  label: 'Bono social',      orden: 99, fijo: false, usos: 1,
      aprobada: false, huellaCreador: '3f9a1c07' }
  ]
```

Un documento con array, no una subcolección: son pocas opciones y se leen todas
juntas para pintar el formulario en una sola lectura.

El `label` se guarda **presentable**: espacios colapsados y primera letra en
mayúscula, sin tocar el resto (D-101). El `slug` es la identidad y sale de
`slugify`; el `label` es lo que se ve.

**La actividad guarda solo el `slug`.** Renombrar el label no obliga a tocar
ningún documento de actividad — pero ver la advertencia sobre el calendario más
abajo.

### Normalización

Sin slugify, en tres meses hay "A la gorra", "a la gorra ", "A la Gorra" y
"Gorra" como cuatro opciones distintas (trampa 6).

`upsertOpcion` en [`src/lib/opciones.ts`](../src/lib/opciones.ts) resuelve el
slug **antes** de crear y reusa si ya existe. Va en transacción porque dos
guardados simultáneos con la misma etiqueta nueva se pisarían el array.

`tests/opciones.integracion.test.ts` prueba las cuatro variantes contra el
emulador y verifica que quede una sola opción.

### `fijo` y `usos`

- **`fijo: true`** protege las opciones base: no se borran ni renombran desde la
  UI. Son las que pueden estar cableadas en la lógica.
- **`usos`** ordena el desplegable por frecuencia real, mejor que alfabético, y
  sirve para detectar basura: una opción con `usos: 1` creada hace meses es casi
  seguro un typo colgado.

El orden lo calcula `ordenarValores`: primero las fijas por su `orden`, después
las creadas con "Otro" por uso descendente. **Ese orden decide cuál opción
preselecciona el formulario**, así que está fijado con tests en
`tests/opciones-orden.test.ts`.

### `aprobada` y `huellaCreador`

Desde que hay **dos cuentas con claim `admin`** cargando actividades, una
etiqueta nueva no puede aparecer sola en el desplegable de la otra persona
(§4.3). El patrón es uno solo para los cinco campos:

| Campo | Tipo | Qué significa |
|---|---|---|
| `aprobada` | `boolean` opcional | ¿entra al desplegable de todos? Lo creado con "Otro" nace en `true` desde el 2026-08-24 (D-104); antes nacía en `false` |
| `huellaCreador` | `string` opcional | quién la creó, **como huella del uid, no como uid** |

Tres reglas, todas en `src/lib/opciones.ts`:

0. **Lo nuevo nace aprobado** (D-104), así que hoy el único `aprobada: false`
   que se puede encontrar en producción es de antes de esa decisión. La
   maquinaria se conserva entera para el día que se vuelva a prender.
1. **`fijo: true` implica aprobada.** Las base lo están por definición.
2. **El campo ausente cuenta como aprobada** (`estaAprobada`). Los documentos
   que ya están en producción se escribieron antes de que existiera el campo, y
   `preparar-produccion.mjs` no los pisa: si la ausencia contara como
   "pendiente", opciones que hoy se usan desaparecerían del desplegable y el
   formulario mostraría el slug crudo de una actividad que ya estaba bien
   cargada. Ver [D-26](06-decisiones.md).
3. **Filtrar lo elegible no es filtrar lo resolvible.** `opcionesVisibles` decide
   qué se puede *elegir*; la etiqueta de un slug pendiente se sigue *mostrando*
   (en el formulario y en la descripción del evento), porque la actividad lo
   guardó legítimamente y el calendario es público. Ver [D-30](06-decisiones.md).

`huellaCreador` es una huella FNV-1a de 8 hex (`src/lib/huella.ts`) y no el uid:
este documento es de **lectura pública** (§5.3) y el §5.1 dice que los uids no
salen al público. La visibilidad solo necesita comparar igualdad. Ver
[D-27](06-decisiones.md) y [`07-seguridad.md`](07-seguridad.md).

**Qué sale al `events.json`:** solo `slug` y `label` (§4.4). `orden`, `fijo`, `usos`,
`aprobada` y `huellaCreador` **no** — la proyección es `opcionesPublicas` en
`src/lib/toPublic.ts`, con la tabla de por qué cada uno se queda adentro en
[`07-seguridad.md`](07-seguridad.md). Está escrita desde antes de que exista el
`events.json` (B-212), para que el default no lo decida un spread.

Aprobar es una escritura más del documento, así que la autoridad es el claim
`admin` (D-28). Se hace desde la pantalla de administración de taxonomías del
panel (B-06/B-25, botón «Aprobar») o con `scripts/aprobar-opciones.mjs` — ver
[`08-operacion.md`](08-operacion.md). D-29, que decía que no había UI, quedó
superada el 2026-08-24.

### Advertencia: las etiquetas se ven en público

La descripción de los eventos de Calendar muestra la **etiqueta**, no el slug.
Dos consecuencias:

1. Un tag creado como "narrativa" (minúscula) aparece así en el calendario
   público. Hoy no hay normalización de mayúsculas ni UI para editar etiquetas
   — está en el [backlog](BACKLOG.md).
2. Renombrar una etiqueta **sí** actualiza los eventos ya creados desde B-04:
   `rebuildPorOpciones` compara las etiquetas de antes con las de después y, si
   alguna cambió, reescribe los eventos de las actividades publicadas que la
   usan (D-93). Antes solo marcaba el rebuild del sitio y el calendario quedaba
   con el texto anterior hasta la próxima edición de la actividad. El tope es de
   150 eventos por corrida: lo que sobre se pone al día con la próxima edición.

## `inscripcion.completo` — «se llenó» (B-97)

Un **booleano**, no un contador de lugares: un contador queda viejo con cada
inscripción y no solo con la última, y un número viejo es peor que ninguno porque
parece fresco. Se prende cuando no entra nadie más y se apaga si se libera un lugar.

**Quién lo escribe es la parte que importa:** solo el menú «⋯» del listado, con ruta
punteada (`marcarCupoCompleto`). El formulario **no** lo escribe — `inscripcion` se
guarda por subcampos y `completo` queda afuera (`payloadDeActualizacion`)— porque con
dos escritores adentro de un objeto de contenido pasa lo de `calendarEventId` dentro
de `sesiones`: un formulario abierto desde antes de marcarlo apagaba el cartel en su
próximo guardado. Y por lo mismo entró a la lista de D-124, para que un borrador de
hace veinte días no lo pise.

Default de lectura `false`, determinístico. **No entra al `searchText`**: nadie busca
«completo» y ese campo viaja entero al `events.json`. Ver **D-127**.

## `libro` — la obra que se presenta (DEC-1)

`libro: { titulo, autor } | null`. El §11 lo listaba para presentaciones y charlas
desde el principio y el §3.1 no lo tenía: hasta el 2026-08-26 se cargaba el autor en
`tallerista` y el título de la obra quedaba enterrado en la descripción, donde nada
lo puede leer.

Tres cosas que no se adivinan del tipo:

- **`autor` se llena solo cuando difiere del invitado.** En una presentación normal
  el autor es quien viene, ya cargado en `tallerista`, y la descripción del evento no
  lo repite. Se usa para una traducción, una antología, o un autor que no viene.
- **Sin título no hay libro:** el panel escribe `null`, igual que un `tallerista` sin
  nombre, y la proyección no inventa el campo (D-15).
- **Entra al `searchText`** (§6), título y autor. Encontrar la presentación buscando
  la obra era la mitad del pedido, y es lo que hace que el campo valga más que un
  párrafo en la descripción.

El default de lectura es `libroVacio()`, **una sola fábrica** para el formulario
nuevo, la lectura de todo documento anterior y el molde con el que el autoguardado
poda lo recuperado. Es determinístico a propósito: la lección de D-125. Ver **D-126**.

## `imagenes` — la galería, y el campo que reemplaza (B-167)

Era `imagenUrl: string | null`. Es `imagenes: Imagen[]`, con
`{ id, url, epigrafe, origen, storagePath?, ancho?, alto?, portada }`.

Tres cosas que no se adivinan del tipo:

- **El `id` se genera en el cliente al crear la fila** (`nuevaImagenId()`,
  `img_<uuid>`), nunca por índice. Es la trampa 2, la misma que costó el diff de
  sesiones: borrar la segunda imagen renumera todo y cualquier cosa que compare
  por posición cree que cambiaron todas.
- **`epigrafe` es un pie de foto, no el texto alternativo.** El alternativo —lo
  que leen un lector de pantalla y Google— sale del **título de la actividad**.
  Es una decisión de accesibilidad tomada a propósito (D-125): pedir un campo por
  imagen produce "foto" como texto alternativo, que es peor que un título
  descriptivo.
- **`storagePath` nunca sale al público** (§5.1): es la ruta interna del bucket y
  publicarla dibuja su estructura. Lo fija `tests/imagenes.test.ts`.

**Los documentos que ya están en producción no tienen `imagenes`.** Los lee
`imagenesDe()`, que convierte `imagenUrl` en una lista de un elemento marcada como
portada — **para siempre**, no con un script que escriba en producción. El id de
esa fila es el centinela fijo `img_legacy` y **no** un uuid nuevo: un uuid en cada
lectura hace que `huboCambioDeContenido` vea un cambio cada vez que se abre el
formulario, o sea el aviso de "cambios sin guardar" apareciendo solo y una versión
nueva en el historial por cada apertura.

`imagenUrl` sigue en el tipo, marcado `@deprecated`: los documentos viejos lo
tienen y el default lo lee. **Las escrituras nuevas no lo escriben.**

## `sede.geo` — el punto exacto

```
sede: { nombre, direccion, barrio, ciudad, indicaciones, geo }
geo: { lat: number, lng: number } | null
```

Opcional y por defecto `null`. **El formulario lo captura** pegando el link de
Google Maps del lugar o un par `lat, lng` (D-46): el parseo está en
[`src/lib/coordenadas.ts`](../src/lib/coordenadas.ts), puro y testeado en
`tests/coordenadas.test.ts`.

Con `geo` cargado, `construirLinkMapa` de `functions/calendario.js` arma el link
del evento con las coordenadas; sin él, con el texto de la ubicación. Vale la
pena cargarlo donde la dirección no alcanza: una librería sin numeración clara,
un centro cultural dentro de un predio, una casa en un pasaje.

El rango lo validan las dos puntas —el parseo al pegar y `schema.ts` al
guardar—, porque un lat/lng invertido manda el evento al otro lado del mundo.
Que el punto caiga lejos de Argentina **no** bloquea: solo avisa.

`geo` es público: viaja en `events.json` dentro de `sede` (§5.2). Es la misma
información que ya publica el evento de Calendar.

## `/reportes/{id}` — bugs y sugerencias del panel

No está en el §3 del `CLAUDE.md`: es una colección nueva. El tipo canónico está
en [`src/types/reporte.ts`](../src/types/reporte.ts).

```
tipo: 'bug' | 'sugerencia'
titulo: string                  // 6..120, el título del issue
descripcion: string             // 15..4000
pasos: string | null            // cómo reproducirlo — solo en un bug
severidad: 'me-bloquea' | 'molesta' | 'menor' | null
actividad: { id, titulo } | null        // actividad referida
contexto: {
  versionPanel,                 // VERSION_APP del bundle que corría + fecha del build
  navegador, ventana, zonaHoraria, url,
  pantalla: 'listado' | 'nueva-actividad' | 'editar-actividad' | 'encuentros' | 'otra'
}
reportadoPor: { uid, email }    // NUNCA sale al issue (§5.1)
estado: 'pendiente' | 'enviando' | 'creado' | 'error'
intentos: number                // tope 3 (D-34)
github: { numero, url, creadoEn } | null
error: string | null
creadoEn, actualizadoEn: Timestamp
```

**El panel solo crea.** El ciclo de vida (`estado`, `intentos`, `github`,
`error`) lo mueve la Function `reporteAIssue` con el Admin SDK; las reglas
prohíben al cliente cualquier `update`, y validan la forma del documento en la
creación: sin eso un reporte podría nacer "creado" y no publicarse nunca.

**Los topes de largo están en tres lugares** —el schema de zod, las reglas y el
issue— y son los mismos a propósito: el issue es público y un reporte de 40 KB
no se revisa.

Qué sale al issue y qué no está en [`07-seguridad.md`](07-seguridad.md).

## Historial de versiones (§12)

Cada edición que pisa contenido cargado por una persona deja el documento
anterior en una subcolección:

```
/actividades/{id}/versiones/{version}
  guardadoEn: Timestamp        // el instante de la edición que pisó estos datos
  actualizadoPor: string|null  // uid de quien la hizo
  camposCambiados: string[]    // ['descripcion', 'titulo'] — qué pisó esa edición
  borrado: boolean             // true si la escribió el borrado de la actividad (B-41)
  documento: { … }             // el `before` COMPLETO, con sus Timestamp nativos
```

`documento` es el documento entero y sin proyectar, a propósito: recuperar un
campo a mano es copiar y pegar. Incluye `difusion` y `online.url`, que son
internos — la subcolección solo la lee un admin y no hay camino al `events.json`.
Ver [`07-seguridad.md`](07-seguridad.md).

`camposCambiados` está para poder elegir qué versión abrir desde la consola de
Firestore sin revisarlas de a una, mientras no exista UI de restauración (B-40).

### Cuándo se guarda una versión — y cuándo no

Lo escribe `guardarVersion` (`onDocumentUpdated`), que **se dispara con toda
escritura del documento**. La versión se guarda solo si cambió el *contenido
editable*: el documento menos lo que escribe la máquina (`updatedAt`,
`updatedBy`, `sesiones[].calendarEventId`).

| Escritura | ¿Versión? |
|---|---|
| Se edita cualquier campo del formulario | **sí** |
| `syncCalendar` escribe `calendarEventId` de vuelta | no |
| Se guarda el formulario sin cambiar nada | no |
| Se **crea** una actividad (incluido duplicar) | no — no hay nada anterior que perder |
| Se **borra** la actividad entera | **sí**, desde B-41: la escribe `guardarVersionAlBorrar` (`onDocumentDeleted`) con `borrado: true` |

Sin la primera exclusión, cada publicación dejaría dos versiones: la del cambio
real y la del write-back de la Function. El criterio y su fundamento están en
D-41; la retención (20 por actividad) en D-42 y la forma del id en D-43.

**El id del documento no es solo el timestamp.** Es `{ISO-8601}_{id del evento}`:
dos escrituras en el mismo milisegundo colisionarían y la segunda pisaría a la
primera. Es de ancho fijo, así que el orden lexicográfico de los ids es el orden
cronológico — de eso depende la poda.


## Campos que faltan

**`aprobada` en las opciones.** Implementado (2026-08-21), y desde el 2026-08-25
**hay UI**: la pantalla de administración de taxonomías aprueba, renombra y
borra. Ver [`04-funcionalidades.md`](04-funcionalidades.md). El script sigue
existiendo pero ya no es el único camino.

## Desvíos respecto del §3.1 del `CLAUDE.md`

El §3.1 es la decisión cerrada del dueño y no se edita desde acá. Estos son los
puntos donde el modelo implementado ya no coincide, con su motivo:

| Campo | §3.1 dice | Hoy | Por qué |
|---|---|---|---|
| `tipo` | cinco valores (`taller`, `club-lectura`, `encuentro`, `presentacion`, `charla`) | **seis**: se agregó `feria` como opción base | El primer reporte real cargado desde el panel fue justamente eso: faltaba una **categoría del dominio**, no una función del software. En el circuito literario argentino una feria del libro no es un caso raro (B-129), el mismo argumento que el §4.1 usa con «a la gorra». |
| `material.items[].tipo` | `lectura \| guia \| contexto \| autor \| otro` | **siete**: + `newsletter`, `playlist` | Cargando un club de lectura real aparecieron formatos que no entraban en ninguno (B-134). **No** se agregó `libro`: `lectura` ya es eso, y tener los dos partiría los datos existentes en dos valores que después no se pueden volver a juntar. Se cambió la etiqueta a "Libro o lectura", que es reversible. |
| `material.items[].entrega` | `previo \| al-inscribirse \| en-el-encuentro` | **cuatro**: + `durante-el-mes` | Pedido concreto del dueño (B-134), y dice algo del dominio: la entrega no siempre es un instante, puede ser progresiva a lo largo del ciclo. Encaja con el §2.2 — ocho encuentros con su lectura cada uno. |

`entrega` sigue siendo un **enum cerrado** a propósito, a diferencia de las cinco
taxonomías del §4: son momentos del ciclo de vida de la inscripción, no
vocabulario libre, y el §5.1 los usa para decidir qué se publica. Si
`material.items[].tipo` debería pasar a taxonomía abierta es una decisión
pendiente del dueño, anotada en B-134.
