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

`calendarEventId` lo escribe la Function, **y desde B-150 solo la Function**.

El panel sigue emitiendo el campo en cada guardado —tiene que emitirlo: la
escritura es un `updateDoc` que **reemplaza el array `sesiones` entero**, así que
una clave ausente adentro de cada elemento borraría el id de todas las sesiones y
la pasada siguiente del sync crearía N eventos duplicados— pero ya no emite el
valor del formulario: `actualizarActividad` **relee el documento** y
`fusionarSesiones` (`src/lib/actividades.ts`) repone los campos de máquina
emparejando por id de sesión. La lista de cuáles son se importa de `@historial`,
o sea la misma que usa el trigger del historial para decidir qué escribe la
máquina (§12, D-41): dos listas se separan sin que nada falle.

La red de abajo sigue puesta: la Function **repone** el id en cada
sincronización si el documento vino sin él (D-91, B-80). Antes de B-150 esa red
era lo único que había, y tapaba una ventana que duraba lo que tardara alguien en
guardar desde un listado refrescado antes del write-back — o sea minutos. Ahora
la ventana es la del `updateDoc` y la red cubre solo eso.

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

/opciones/tipo
  valores: [
    // `tono` solo en las que alguien pintó a mano: ausente es «derivado del slug».
    { slug: 'taller', label: 'Taller', orden: 1, fijo: true, usos: 11, aprobada: true, tono: 290 },
    { slug: 'charla', label: 'Charla', orden: 5, fijo: true, usos: 1,  aprobada: true }
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

### `tono` — el color de la categoría (D-150)

**Opcional, y ausente es el caso normal.** Es el **matiz** con el que el sitio
escribe la categoría, en grados de OKLCH: un entero de 0 a 359.

| | |
|---|---|
| Tipo | `number` opcional, entero de 0 a 359 |
| Ausente significa | **derivado del slug** (`tonoDeTipo` en `src/lib/identidad.ts`), no «sin color» |
| Quién lo escribe | el admin, desde la pantalla de Opciones (`pintarOpcion`) |
| Dónde aplica | **solo `/opciones/tipo`**: es la única lista que el sitio pinta, y `pintarOpcion` rechaza cualquier otro campo |
| Sale al `events.json` | **sí**, y solo si es elegible — ver abajo |

**Es un matiz, no un color, y esa es la decisión.** La luminosidad y el croma son
fijos para todos los tipos, así que lo único que se puede elegir es la posición en
la rueda. Eso es lo que permite **garantizar el contraste sobre los 360 valores
posibles** en vez de sobre los que alguien ya miró: el peor de los 360 da 5,90:1
sobre la más oscura de las tres superficies del sitio, contra un piso de 4,5
(`tests/color-de-tipo.test.ts`). Guardar el color entero volvería editable la
luminosidad y la garantía se perdería en el primer documento escrito a mano.

**Un valor fuera de rango, con decimales o de otro tipo se ignora al leer** y no
sale al `events.json`: `/opciones/*` se puede editar desde la consola de Firestore,
y un color ilegible no se puede colar por ninguno de los dos caminos. Todo el
razonamiento está en [D-150](06-decisiones.md).

**Se puede cambiar en una opción `fijo: true`**, y es el único campo que se puede:
los siete tipos que existen son base, así que la regla de arriba dejaría la pantalla
sin nada que configurar. Lo que `fijo` protege es la identidad —el slug, la
etiqueta—, y el matiz es presentación.

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

**Qué sale al `events.json`:** `slug`, `label` y —cuando está y es válido— `tono`
(§4.4). `orden`, `fijo`, `usos`, `aprobada` y `huellaCreador` **no** — la proyección
es `opcionesPublicas` en
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
- **`storagePath` nunca sale al público** (§5.1), pero **no porque sea secreto** —
  esa era la frase de la primera tajada y B-206 #1 demostró que era falsa: la URL
  de descarga lleva el path adentro, y esa URL sí se publica. Lo que se hizo en
  cambio fue volver el path **opaco**: `imagenes/img_<uuid>.jpg`, un prefijo plano
  y el nombre es el id de la fila. Queda afuera del JSON por lo que sí es —el
  handle autoritativo con el que el panel direcciona el objeto, que un consumidor
  del `events.json` no usa para nada—. Lo fija `tests/imagenes.test.ts`, y la
  decisión está en **D-131**.
- **`portada` es un flag y no una posición, y desde B-268 eso es cierto de
  verdad.** D-125 lo decidió así —«la imagen que uno quiere que aparezca al
  compartir el link no siempre es la primera que cargó»— pero la proyección de la
  página tiraba el flag y mostraba `imagenes[0]`, así que marcar la portada en el
  panel no cambiaba nada. `conPortada` sigue **sin mover la fila** (el orden del
  array es el orden de carga y es lo que respeta la galería); lo que cambió es que
  `detalleDeActividad` pone primera la marcada. Ver **B-268**.
- **`ancho` y `alto` ahora se llenan también en las externas** (B-263, D-147). Una
  imagen **propia** los traía desde que se sube —`subir-imagen.ts` los mide sobre
  los bytes—; una **externa** no los tenía nunca, porque el build no descarga las
  imágenes de afuera (DEC-7d). Desde el 2026-09-01 los mide el **panel**, en la
  vista previa del editor (`naturalWidth`/`naturalHeight`), y solo en las filas
  que esa sesión agregó o cuya dirección cambió: medir las ya guardadas
  ensuciaría el formulario apenas se abre. Sirven para reservar la caja de la
  imagen en el sitio, así que **una fila sin ellos funciona igual**, con un salto
  de layout al cargar. Los documentos anteriores no se migran.
- **`storagePath`, `ancho` y `alto` son campos de máquina** (B-206 #2). Los
  escribe la subida del panel. `formADocumento` **enumera** las claves de cada
  imagen en vez de spreadear la fila, y `functions/historial.js` los declara en
  `CAMPOS_DE_MAQUINA_IMAGEN`, para que no sea `calendarEventId` dentro de
  `sesiones` otra vez.
- **La Function de DEC-7d resultó no escribir ninguno de los tres** (B-220,
  **D-175**), y eso hay que leerlo al derecho: la protección de arriba se queda
  igual, pero **no está en uso**. La Function escribe la imagen optimizada
  **encima del original**, así que la `url`, el `storagePath` y la ruta de la
  miniatura siguen siendo válidos sin tocar el documento — es justamente lo que
  hizo viable a B-220, que estaba bloqueado en «cómo encuentro la actividad que
  referencia este objeto».

  **La consecuencia que no se adivina: `ancho` y `alto` pueden quedar viejos.** Si
  la Function reescala (solo si el lado mayor pasa de 1600 px, que hoy no le pasa a
  ninguna de las 30 de producción), el objeto queda más chico y el documento sigue
  diciendo la medida original. **No es un bug y no hay que "arreglarlo" escribiendo
  el documento**: los dos números se usan como **razón** —`proporcionDeAfiche`
  reserva la caja con `aspect-ratio`— y el reescalado conserva la proporción, así
  que `4032 / 3024` y `1600 / 1200` reservan exactamente la misma. Hay un test que
  fija que la proporción se conserva, porque de eso depende este párrafo entero.
  Si alguna vez hace falta el valor **absoluto** para algo, ahí sí hay que volver
  a mirar el write-back.

**Los documentos que ya están en producción no tienen `imagenes`.** Los lee
`imagenesDe()`, que convierte `imagenUrl` en una lista de un elemento marcada como
portada — **para siempre**, no con un script que escriba en producción. El id de
esa fila es el centinela fijo `img_legacy` y **no** un uuid nuevo: un uuid en cada
lectura hace que `huboCambioDeContenido` vea un cambio cada vez que se abre el
formulario, o sea el aviso de "cambios sin guardar" apareciendo solo y una versión
nueva en el historial por cada apertura.

`imagenUrl` sigue en el tipo, marcado `@deprecated`: los documentos viejos lo
tienen y el default lo lee. **Las escrituras nuevas no lo escriben.**

## `modalidades` — las formas de cursar, y los tres derivados (B-224)

Era `modalidad: 'presencial' | 'virtual' | 'hibrido'` con **una** `sede` y **un**
bloque `online` al lado. Es una lista:

```
modalidades: [{ id, modalidad, inicio, fin, sede, online }]
```

Cada fila es **una forma de cursar completa**, con su lugar adentro: el bloque
«Dónde» de siempre, repetido. Es lo que permite decir «los martes presencial en la
librería, los jueves por Meet», que con una sede sola no se podía. Lo pidió el
dueño así (D-130) y la UI es la misma que la de los encuentros: agregar, duplicar,
borrar, con el chasis compartido `campos/FilasEditor.tsx`.

Cuatro cosas que no se adivinan del tipo:

- **El `id` se genera en el cliente** (`nuevaModalidadId()`, `mod_<uuid>`), nunca
  por índice. Trampa 2, la misma de las sesiones y las imágenes.
- **`inicio` y `fin` son opcionales** (`Timestamp | null`) y **hoy no salen a
  ninguna salida pública**: qué significan frente a `sesiones[].inicio/fin` sigue
  sin decidir (B-224). Un campo que no sale no puede decir algo equivocado en el
  calendario de todos los suscriptos, y agregarlo después es barato.
- **`sede` y `online` de la fila se guardan solo si la modalidad los pide** (§11):
  una sede cargada en una fila que después pasó a virtual no viaja al documento.
  Lo decide `formADocumento`, no la pantalla, porque las cascadas del formulario
  no borran lo que alguien escribió.
- **`formADocumento` enumera los campos de la fila** en vez de copiarla con un
  spread. No es estilo: hasta B-224 a `sede` y `online` los cuidaba la poda de
  `autoguardado.ts`, y esa poda **deja pasar los arrays** a propósito. Al mudarlos
  adentro de `modalidades`, la enumeración pasó a ser la única red — y es más
  fuerte, porque la clave de más no llega ni siquiera a Firestore.

**Los tres derivados.** `modalidad`, `sede` y `online` siguen en el documento, y
no son una segunda fuente de verdad: los escribe `formADocumento` en cada
guardado, igual que `searchText`. Existen porque hay salidas que solo pueden decir
**una** cosa.

| Derivado | Cómo se calcula | Quién lo lee |
|---|---|---|
| `modalidad` | la **unión** de las filas: dos que difieren dan `hibrido` | el `events.json`, la analítica, el texto para redes |
| `sede` | la de la **primera fila que tenga una** | el `location` del evento (el que dibuja el mapa), el `searchText` del §6, el filtro por barrio |
| `online` | idem, con el bloque online | el texto para redes |

La unión y no «la primera» porque lo segundo depende del orden del array —la
trampa 2 en otra forma: reordenar las filas cambiaría lo que se publica—. `sede` y
`online` sí son «la primera», porque una dirección hay que elegirla y ese orden lo
decide quien carga y se ve en pantalla; si algún día importa distinguirla, la
respuesta es un flag explícito como el `portada` de la galería.

**El filtro del panel busca por cualquiera de las filas**, no solo por la
resultante: una actividad presencial y virtual aparece bajo los tres chips, porque
las tres cosas son ciertas de ella.

**El `searchText` del §6 indexa la sede de todas las filas**, no solo la derivada:
con dos barrios, buscar por el segundo tiene que encontrar la actividad. Es la
misma fuente que usa la restauración del historial, así que el mismo documento no
puede tener un índice distinto según por dónde se escribió.

**El historial no ofrece los derivados para restaurar sueltos.** `modalidad`,
`sede`, `online` y `searchText` salieron de la lista de campos restaurables:
restaurar uno por separado deja el documento contradiciéndose —una sede que
ninguna fila tiene— hasta el próximo guardado, y en el medio eso sale al
`events.json`. Restaurar `modalidades` recalcula los tres en la misma escritura.

**No hay migración ni lectura de compatibilidad**: no había nada en producción
cuando el campo entró (decisión del dueño, 2026-08-27), así que un documento sin
`modalidades` se lee como **cero filas** —`?? []`— y punto. Hubo una
`modalidadesDe` que sintetizaba una fila con los campos viejos, y se sacó: existía
para leer documentos que no existen, y era una rama más de las tres proyecciones
públicas sin ningún centinela que la recorriera. El razonamiento entero, con lo
que enseñó, está en D-130.

**El índice del listado (`eventsJson.ts`) lleva los valores, no las filas.** Es la
tercera proyección en serie: `modalidades: string[]` con la unión —lo único que el
filtro del sitio necesita— más la `modalidad` resultante para la tarjeta. La sede
de cada fila es del detalle, y las fechas de la ventana no salen a ninguna
salida.

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

`geo` es público: viaja en `events.json` dentro de la sede de cada forma de
cursar y de la sede derivada (§5.2). Es la misma información que ya publica el
evento de Calendar.

Desde B-224 `sede` vive **adentro de una fila de `modalidades`**: cada forma de
cursar tiene la suya, y la de primer nivel es la derivada.

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
resuelto?: boolean              // B-580 — ausente o `false` = abierto. Ortogonal a `estado`.
```

**El panel solo crea, con dos excepciones acotadas.** El ciclo de vida
(`estado`, `intentos`, `github`, `error`) lo mueve la Function `reporteAIssue`
con el Admin SDK; las reglas prohíben al cliente tocarlo, y validan la forma
del documento en la creación: sin eso un reporte podría nacer "creado" y no
publicarse nunca. Las dos escrituras que sí puede hacer el panel sobre un
reporte ya creado son B-31 (reintentar un envío en `error`) y B-580 (marcar o
reabrir `resuelto`) — cada una autorizada por su propia regla
(`reintentoValido`/`resueltoValido`), que acota qué campos puede tocar esa
escritura y nada más.

**`resuelto` es del panel, no de GitHub (D-310).** Lo marca un admin a mano
cuando el problema se solucionó; no hay sync que lo derive de que el issue se
cerró en GitHub — es la misma decisión que Google Calendar en el §2.1 del
`CLAUDE.md`, aplicada acá. La pantalla de Reportes muestra solo los reportes
sin `resuelto` por defecto, con un toggle para ver también los resueltos.

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

`camposCambiados` está para poder elegir qué versión abrir sin revisarlas de a
una — antes desde la consola de Firestore, y desde B-40 es lo mismo que usa la
pantalla de historial del panel para no mostrar las 20 versiones abiertas de
entrada.

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
| `modalidad` / `sede` / `online` | un escalar y dos objetos sueltos | **`modalidades: ModalidadFila[]`**, con `sede` y `online` adentro de cada fila; los tres de primer nivel siguen existiendo como **derivados** | Pedido del dueño (B-224, D-130): una actividad puede darse presencial en una librería y virtual por Meet, y con una sede sola eso no se puede decir. Los derivados quedan porque el `location` del evento, el `searchText` y el filtro por barrio solo admiten un valor. |
| `material.items[].entrega` | `previo \| al-inscribirse \| en-el-encuentro` | **cuatro**: + `durante-el-mes` | Pedido concreto del dueño (B-134), y dice algo del dominio: la entrega no siempre es un instante, puede ser progresiva a lo largo del ciclo. Encaja con el §2.2 — ocho encuentros con su lectura cada uno. |
| `material.items[]` | sin `id` | gana `id: string` (`mat_<uuid>`, generado en cliente) | B-342: el editor de filas dejó de operar por índice del array. No es la trampa 2 en sentido estricto —un ítem de material no sincroniza con Calendar— pero sigue la misma convención que `sesiones[].id`, `imagenes[].id` y `modalidades[].id`. Los documentos anteriores a B-342 se leen con un id determinístico por posición (`idItemMaterialMigrado`, mismo criterio que `ID_IMAGEN_MIGRADA` de D-125). |

`entrega` sigue siendo un **enum cerrado** a propósito, a diferencia de las cinco
taxonomías del §4: son momentos del ciclo de vida de la inscripción, no
vocabulario libre, y el §5.1 los usa para decidir qué se publica. Si
`material.items[].tipo` debería pasar a taxonomía abierta es una decisión
pendiente del dueño, anotada en B-134.
