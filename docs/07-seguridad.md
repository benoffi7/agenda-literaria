# Seguridad

Premisa del §5: **todo lo que sale al `events.json` o al calendario es público y
scrapeable.** El calendario es tan público como el JSON, así que las dos salidas
comparten las mismas reglas.

**Son siete salidas, no dos.** Conviene tenerlas contadas antes de leer el resto,
porque la tabla de acá abajo habla de las dos primeras y es fácil auditar solo
esas. La **6** nació con B-227 y es la primera que es una *página* y no un
archivo de datos: por eso su proyección vive en un módulo aparte y la plantilla no
ve el documento (D-140). La **7** nació con B-265 y es la primera que **deriva de
otra salida** en vez de derivar del documento.

| # | Salida | Quién decide qué sale |
|---|---|---|
| 1 | `events.json` y el HTML del listado — **actividades y también las opciones de taxonomía** (§4.4) | **Tres archivos en serie:** `src/lib/toPublic.ts` (`toPublic`, `opcionesPublicas`) decide qué *puede* ser público; `src/lib/eventsJson.ts` (`entradaDeIndice`, `construirIndice`, `resumenDe`) decide qué necesita el listado, que es menos; `src/lib/contenidoDelSitio.ts` elige *qué documentos* se leen (el `where` del §5.3, mudado ahí en B-227 porque ahora son **tres** los consumidores) y `src/pages/events.json.ts` solo serializa. **La mitad HTML tiene un cuarto productor**, agregado en B-247: `src/lib/tarjetaPublica.ts` (`lugarDeTarjeta`, `avisoDeTarjeta`, `cicloDeTarjeta`, `arancelDeTarjeta`, `bloqueDeFecha`, `formasDeCursar`) decide **qué frases dice la fila** con los campos que el índice ya trae; los componentes de `src/components/publico/` **solo acomodan**, y qué campos de la entrada pueden tocar es una lista cerrada que verifica `tests/listado-del-sitio.test.ts` (la forma de D-140 donde el tipo no la puede dar) |
| 2 | El evento de Google Calendar | `functions/calendario.js` |
| 3 | El issue en el repo público de GitHub | `functions/reportes.js` |
| 4 | La analítica del panel (GA4) | `src/lib/analytics-eventos.ts` |
| 5 | El texto para copiar a redes | `src/lib/textoRedes.ts` |
| 6 | La **página de detalle** `/actividad/{slug}` y su **JSON-LD** — HTML indexado: es la que un bot cosecha primero y la que se queda en Google | `src/lib/detallePublico.ts` (`detalleDeActividad` arma el view-model, `datosEstructurados` el JSON-LD, `urlSegura` sanea todo href); `src/lib/contenidoDelSitio.ts` (`caminosDeDetalle` y el `where`). La plantilla **solo acomoda**: recibe el view-model y nada más (**D-140**) |
| 7 | La **cartelera** `/cartelera` — la pared de afiches, HTML indexado (B-265) | `src/lib/cartelera.ts` (`carteleraDeDetalles`), y **su entrada es la salida 6, no el documento**: proyecta `DetallePublico` y por construcción solo puede **sacar** campos, nunca agregar uno que aquella no haya decidido publicar. `src/lib/contenidoDelSitio.ts` (`carteleraDelSitio` y el `where`). La plantilla solo acomoda |

Y una más que **estuvo abierta hasta el 2026-08-27**: la lectura directa de
Firestore por un anónimo, que no pasaba por ninguna de las proyecciones.
Cerrada con D-128 (ver [Reglas de Firestore](#reglas-de-firestore)). Está anotada
acá porque el modo de falla —una puerta que ninguna proyección atraviesa— es el
que hay que buscar al agregar una salida nueva.

**Y en la salida 7 esa puerta tiene nombre: `listAll()` sobre el bucket.** Armar
una pared de afiches listando `imagenes/` es más corto de escribir que armarla
desde el índice, no pasa por ninguna proyección, y traería también los flyers de
las actividades **en borrador**. Está cerrado en `storage.rules` desde D-131
(`allow get: if true`, `allow list: if esAdmin()` — la **trampa 13**) y además
`tests/cartelera.test.ts` falla si la página menciona `listAll`, `getStorage` o
`firebase/storage`. Las dos mitades: la regla que lo impide y el test que dice
que nadie lo intentó.

**Las páginas de texto del sitio no son una salida más, y conviene tenerlo
escrito** para que nadie las cuente ni las deje de mirar. `/ayuda` y `/contacto`
(B-232) no proyectan ningún documento: su contenido está escrito a mano en
`src/lib/ayudaDelSitio.ts` y `src/lib/contactoDelSitio.ts`. No hay campo que se pueda
colar por un spread, así que no hay proyección que auditar.

Lo que sí tienen es el riesgo propio del texto libre en una página pública: el
**ejemplo bien intencionado**. Una ayuda que explica por qué el link de la reunión no
se publica está a una frase de ilustrarlo con un link de reunión de verdad, que es la
trampa 5 entrando por la puerta que ninguna proyección cubre. Por eso los dos módulos
tienen barrido de centinelas en sus tests (`zoom.us/j`, `meet.google.com/`, `wa.me/`,
cualquier `http`) y el chequeo de que la casilla de contacto no está escrita en el
marcado de ninguna página — sale de `enlaces.ts` o no sale.

## Qué NUNCA sale

| Campo | Motivo | Dónde se filtra |
|---|---|---|
| `online.url` **con `urlPublica: false`** | el link de la reunión se manda al inscribirse; publicarlo habilita zoombombing (trampa 5). Es el default. **Y con `urlPublica: true` sale solo a las salidas 1 y 2** (D-15): al índice del listado no (D-129), y a la **página de detalle** ni a su **JSON-LD** tampoco (**D-139**), porque un HTML indexado no se despublica. El mapa completo de las cinco celdas está en D-139. | `toPublic.ts`, `calendario.js`, `eventsJson.ts`, `detallePublico.ts` |
| `updatedAt` | se publica **cuándo se cargó** (`createdAt` → `creadoEn`, y solo `AAAA-MM-DD`: **D-138**) y no cuándo se editó. Una fecha de modificación convierte cada typo corregido en «actualizado hoy»; cuando el sitemap la necesite (§11.2 del diseño) es su propia decisión | `toPublic.ts` |
| la **hora** de `createdAt` | el campo sale recortado al día: con **un solo admin**, el instante exacto de cada carga no es una fecha, es su agenda de trabajo — a qué hora carga y en qué tandas. Mismo razonamiento que D-57 y D-27: con un universo de una persona, el dato que «no nombra a nadie» igual la describe (D-138) | `toPublic.ts` |
| `difusion` | trabajo interno | ambos |
| `material.items[].url` con `publico: false` | solo tipo y título | ambos |
| `createdBy` / `updatedBy` | uids | ambos |
| `sesion.calendarEventId` | interno | `toPublic.ts` |
| `modalidades[].inicio` / `modalidades[].fin` | **decisión, no olvido**: qué significa la ventana de una modalidad frente a las fechas de los encuentros sigue sin resolver (B-224), así que se guarda y no se publica en ninguna de las siete salidas. Un campo que no sale no puede decir algo equivocado en el calendario de todos los suscriptos; agregarlo después es una línea | `toPublic.ts`, `calendario.js`, `textoRedes.ts`, `normalize.ts`, GA4 |
| **los metadatos del archivo** (EXIF/GPS, XMP, IPTC) | una foto de celular lleva las coordenadas del lugar donde se sacó, y muchos talleres pasan en casas particulares. Se sacan **antes** de subir, y lo que se sube se barre buscando las tres marcas: si alguna sobrevive, la subida se corta (D-131 §3) | `imagenes-archivo.ts` (`sinMetadatos`, `quedanMetadatos`) |
| `imagenes[].storagePath` | no lo emitimos: es el handle autoritativo y no hace falta en el sitio (B-167). **Ojo, no es un secreto:** para una imagen propia el path viaja URL-encodeado adentro de la URL de descarga, junto con un token permanente, así que es público por ese lado. Lo que lo vuelve inofensivo es que el **nombre es opaco** —`imagenes/img_<uuid>.jpg`, un solo prefijo plano y sin nada de la actividad— y que bajo ese prefijo `storage.rules` da lectura pública, así que el token no protege nada que no estuviera abierto (B-206 #1, **D-131**) | `toPublic.ts` |
| `ValorOpcion.huellaCreador` | **el que menos se ve venir.** D-27 lo hizo una huella de 8 hex y no un uid justamente porque `/opciones/*` es de lectura pública — pero «no es un uid» no es «es publicable»: sigue siendo un identificador estable de una persona, y §5.1 dice que del creador no sale nada (B-212) | los cuatro de abajo |
| `ValorOpcion.orden` / `fijo` / `usos` / `aprobada` | son de gestión del panel: `orden` es del desplegable, `fijo` dice si la UI puede borrarla, `aprobada` es estado de moderación, y `usos` publicado dibuja qué carga esta gente y con qué frecuencia | los cuatro de abajo |

**De `/opciones/{campo}` salen `slug`, `label` y —desde D-150— `tono`** (§4.4). La proyección
se escribió **antes** que su consumidor —B-212 antes que B-106— y eso era a
propósito: el camino corto al implementar el índice es volcar `valores` tal cual, y
con eso entran los cinco campos de arriba sin que nadie lo haya decidido. Escribir
la whitelist primero es lo que evita que la decisión la tome un spread.

**Y funcionó**: cuando B-106 y después B-227 llegaron a consumirla, los chips del
sitio salieron con `slug` y `label` porque no había otra cosa que consumir. El
tercer campo, `tono`, entró **decidido** —con su motivo escrito en D-150, su guarda
en el productor y su fila en el barrido de centinelas—, que es la diferencia entre
agregar un campo público y que se agregue solo.

**Ojo, y esto es lo que no se ve mirando un solo archivo: la misma decisión está
escrita en CUATRO lugares**, porque el documento de taxonomía llega a cuatro
salidas por cuatro caminos distintos.

| Camino | A qué salida | Qué puede leer | Por qué no se comparte |
|---|---|---|---|
| `opcionesPublicas` (`src/lib/toPublic.ts`) | 1 — `events.json` | `slug`, `label`, **`tono`** | emite objetos |
| `labelsDeOpciones` (`src/lib/vistaPreviaEvento.ts`) | 5 (el posteo) y la vista previa del evento | `slug`, `label` | emite un `Record<slug, label>`, que es otra forma |
| `cargarLabels` (`functions/index.js`) | 2 — el evento de Calendar de verdad | `slug`, `label` | `functions/` se despliega con su propio `package.json` y **no puede importar de `src/`** (D-20) |
| `etiquetasDelDetalle` (`src/lib/contenidoDelSitio.ts`) | 6 — la página de detalle y su JSON-LD | `slug`, `label` | corre en el build y arma otro `Record<slug, label>` |

**Eran tres y son cuatro desde B-270.** El de la salida 6 lo encontró el
`auditor-privacidad`: proyectaba bien, pero era el único de los cuatro sin nada que
nombrara qué podía leer — y es la salida que un bot cosecha primero.

Son cuatro copias de una decisión de privacidad, y la tercera **no se puede
unificar**: es el mismo caso que la copia de `CAMPOS_TAXONOMIA`, donde la respuesta
del repo es «un test que compare las listas, no un import imposible». Ese test
existe — `tests/clases-de-bug.test.ts`, clase de B-212 — y exige que cada camino lea
exactamente lo que su salida publica y nada más.

**`tono` es público, y de una sola salida** (D-150). Es el matiz de la categoría, un
entero de 0 a 359 elegido de una lista de doce colores; el sitio lo necesita porque
pinta la cajita del tipo y **no lee Firestore** (§2.5), así que sin publicarlo la
elección no llegaría a ninguna pantalla. No dice quién lo eligió ni cuándo. Que sea
público **para el `events.json`** no lo vuelve legible para los otros tres caminos:
ahí no tendría dónde ir, y leerlo sería el síntoma de que alguien está por
publicarlo en una salida que no lo pidió. Por eso la lista de arriba es **por
camino** y no una sola compartida — escribirla compartida habría abierto los cuatro
de golpe por un campo que necesita uno.

Dos guardas más del lado del que escribe, las dos del `auditor-privacidad`: solo
sale si `esTonoElegible` (un `999` escrito a mano en la consola de Firestore no
llega al archivo) y **solo se puede elegir para `tipo`**, que es la única lista que
el sitio pinta — el matiz de un barrio en el `events.json` sería un dato que ninguna
salida consume.

Quien mañana busque por qué `usos` no aparece en el evento de Calendar va a mirar
`opcionesPublicas`, que **no interviene en ese camino**. Por eso está la tabla.

Y las **no aprobadas no entran a los filtros** del sitio (§4.3). Se filtran con
`opcionesVisibles` sin `uid`, que es la regla ya existente y no una copia: el matiz
de D-30 sigue valiendo — se filtra lo *elegible*, nunca la lista con la que se
*resuelve* un slug a su etiqueta, porque una actividad publicada puede tener
guardada una opción pendiente y el sitio tiene que poder mostrar su nombre.

**Y en el sitio eso son dos mapas de etiquetas, no uno** (B-227). La primera
versión derivaba los dos del `events.json` —o sea, de la lista ya filtrada— y con
eso la página de detalle de una actividad con una opción pendiente mostraba «Con
Beca Parcial» desSlugeado en vez de «Con beca parcial»: exactamente el síntoma que
D-30 existe para evitar, y que el evento de Calendar no tiene porque
`cargarLabels` lee `/opciones/*` entero. Lo encontró el `auditor-privacidad`.

| Quién resuelve | Con qué lista | Por qué |
|---|---|---|
| los **chips** del filtro y las tarjetas (`etiquetasDelListado`) | filtrada | §4.3 — ofrecer un chip *es* publicar vocabulario sin validar. Y tiene que ser el mismo mapa que usa la island, o la tarjeta cambiaría de texto al hidratar |
| la **página de detalle** (`etiquetasDelDetalle`) | sin filtrar | D-30 — resolver no es ofrecer: acá se traduce un slug que esa actividad **ya tiene guardado**, igual que el evento de Calendar |

No publica vocabulario de más: la página muestra la etiqueta del slug que usa esa
actividad, no una lista de opciones elegibles.

`libro` **sí** sale, título y autor, a las dos salidas públicas: es el dato central
de una presentación, del mismo orden que el título de la actividad, y entra también
al `searchText` para que buscar la obra encuentre la actividad (DEC-1, **D-126**). A
GA4 va solo `tiene_libro`, un booleano: el título es texto libre.

`inscripcion.completo` **sí** sale a las dos salidas públicas y **no** entra al
`searchText`. Y el canal de inscripción **sigue saliendo con el cupo completo**, por
decisión del dueño: siempre hay lista de espera, y esconderlo convierte una baja en un
lugar que se pierde (B-97, **D-127**).

`modalidades` **sí** sale, **menos las fechas**: la lista entera con la modalidad
de cada fila y su lugar (B-224, **D-130**). Es lo que el sitio necesita para decir
«los martes presencial en Villa Crespo, los jueves por Meet». `modalidadPublica`
enumera la sede campo por campo en lugar de copiarla con un spread, y no es
cosmético: la sede viaja **adentro de un array**, y la poda de `autoguardado.ts`
deja pasar los arrays a propósito. La otra mitad de esa guarda es que
`formADocumento` también enumera, así que una clave de más no llega ni a Firestore.

Y en el **índice del listado** (`eventsJson.ts`, la tercera proyección) entran
solo los **valores** de `modalidades` —`presencial`, `virtual`, `hibrido`—, que es
lo que el filtro del sitio necesita: las sedes de cada fila quedan en el detalle y
la ventana no sale. Su celda está fijada en el barrido, con el caso que lo dice
por su nombre.

`inscripcion.destino` **sí** sale: es el canal de inscripción. El §5.1 advierte
que un WhatsApp personal ahí queda expuesto a bots — conviene un número de
trabajo o un `wa.me` con mensaje precargado. El formulario lo dice en la ayuda
del campo.

## El texto para redes SÍ es una salida, y es la más irreversible

**Este documento se molestaba en explicar que la vista previa no es una salida y
que el borrador autoguardado tampoco, y se olvidaba de la que sí lo es.** El
`auditor-privacidad` lo encontró el 2026-08-27 y el hallazgo es de mapa, no de
código: quien auditara con este archivo en la mano contaba cuatro salidas y hay
**cinco**.

`src/lib/textoRedes.ts` (B-95) arma el texto que se copia y se pega en Instagram.
Es la salida de la que **no se puede volver**: un `events.json` se rebuildea, un
evento de Calendar se edita, un issue se borra — un posteo ya está capturado.

El módulo es de los más cuidadosos del repo, y por eso no hay hallazgo de código:
`ActividadParaRedes` es un `Pick` explícito y no la actividad entera, y
`tests/textoRedes.test.ts` tiene barrido de centinelas más una guarda de forma
sobre ese `Pick`.

**La tabla campo por campo vive en el docblock de `src/lib/textoRedes.ts`, y esa
es la autoritativa** — diez filas, cada una con su motivo. No se copia acá a
propósito: dos copias de una tabla de privacidad es exactamente el problema que
D-20 evita en otro lado, y la copia que envejece siempre es la del documento.

Lo único que conviene tener escrito de este lado, porque es la regla que
sorprende:

**`online.url` no sale al posteo nunca, ni con `urlPublica: true`.** El desvío de
D-15 vale **solo para las salidas 1 y 2** —donde quien tilda la casilla ve un texto
que dice qué hace— y no se extiende a un posteo abierto.

Ojo con no leer eso como que el flag alcanza en las otras: a la **3** no llega
porque `actividadParaIssue` devuelve `{ titulo, slug }` y nada más, y a la **4** no
llega porque va `url_publica` como **booleano** — la salida más estricta, donde no
sale contenido ni con permiso del dueño. Las tres son "no, nunca"; lo que cambia es
por qué.

Y el que se lee al revés de lo que uno espera: **`difusion.arrobar` sí sale**, y
es su razón de existir — el campo se creó para este texto. Lo interno de
`difusion` es `notas`, que no sale.

## El bucket de Storage es una salida pública más (B-167, DEC-7)

Hasta acá el §5 tenía **siete** salidas: el `events.json`, el evento de Calendar,
el issue de GitHub, GA4, el texto para redes, la página de detalle y la cartelera.
El bucket es una **octava**, y es distinta de las otras siete en algo que conviene
tener presente: no pasa por `toPublic` ni por ninguna proyección, porque **no son
campos, son bytes**. Lo que se sube es lo que se publica.

(No entra a la tabla numerada de arriba porque esa tabla enumera *proyecciones*
—quién decide qué campo sale— y acá no hay ninguna: el objeto se sirve tal cual.
Lo que la gobierna son `storage.rules` y lo que el panel le saca al archivo antes
de subirlo.)

Dos consecuencias que están decididas, no heredadas:

- **Una imagen sube pública, y sube antes de que la actividad se publique.** Se
  puede cargar una imagen en una actividad en `borrador`, y desde ese instante
  cualquiera con la URL la puede pedir. `estado` no gobierna esta mitad del
  contenido. Es la contra de haber elegido subir **antes** de guardar —que a su
  vez es lo que hace que el path no pueda llevar el id de la actividad, D-131
  §1— y es aceptable porque la URL no es adivinable: el nombre es un uuid y
  **listar el prefijo está prohibido** (ver abajo).
- **Un objeto no se despublica.** Quitar la fila de la galería lo saca del
  documento, no del bucket, y hoy nada lo borra (B-221). Si alguna vez hay que
  bajar una imagen de verdad, hay que borrar el objeto a mano.

**`get` sí, `list` no**, y esa distinción es lo que sostiene todo el argumento de
B-206 #1. Si el prefijo se pudiera enumerar, la opacidad del path no compraría
nada —no hace falta adivinar un uuid si te dan la lista— y adentro están también
las fotos de los borradores. **No alcanza con no escribirlo:** `allow read`
incluye `get` **y** `list`, y con `read: if true` un `listAll()` anónimo devolvía
el bucket entero. Se comprobó contra el emulador, no se dedujo, y desde entonces
las reglas dicen `allow get: if true` y `allow list: if esAdmin()`, con su caso en
`tests/storage-reglas.integracion.test.ts`.

Y tres cosas más que hacen que no filtre nada de más:

- **`storage.rules` es la mitad que el schema no puede dar** (DEC-7b). El panel
  valida tipo y tamaño, y abajo del panel hay una consola de navegador con el SDK
  cargado: cualquiera con el claim `admin` podría llamar a `uploadBytes` con un
  archivo de 80 MB. Las reglas verifican **de nuevo** el tamaño (3 MB), el tipo
  (JPG o PNG) y la forma del nombre. Lo que **no** pueden verificar es el tope de
  4 imágenes por actividad: una regla de Storage evalúa una operación sobre un
  objeto y no puede contar los de un prefijo. Ese tope vive solo en el schema, y
  su peor caso es una actividad con cinco imágenes que el panel no deja guardar.
  Lo verifica `tests/storage-reglas.integracion.test.ts`, **subiendo de verdad**
  contra el emulador: las reglas son un lenguaje que evalúa un motor que no es el
  nuestro y no hay forma honesta de probarlas sin ejecutarlas.
- **El panel le saca los metadatos al archivo antes de subirlo**
  (`sinMetadatos`, en `src/lib/imagenes-archivo.ts`). Una foto de celular lleva
  las coordenadas GPS del lugar donde se sacó, y muchos talleres pasan en la casa
  de alguien: eso es un dato personal de un tercero, y una vez publicado no se
  puede despublicar. Se saca sin recomprimir —los píxeles salen byte por byte
  iguales— y se verifica **sobre los bytes de salida**, no confiando en la
  función. DEC-7d le da ese trabajo a la Function, y sigue siendo así: la Function
  es la que no se puede saltear, igual que las reglas frente al schema. Lo que se
  agregó acá es la primera capa, porque entre las dos tajadas hay imágenes propias
  públicas y el hueco no podía quedar abierto.
- **Solo JPG y PNG se pueden subir**, aunque la galería sepa mostrar también WebP
  y AVIF de otros sitios. Esos dos contenedores llevan EXIF/XMP y todavía no hay
  quien se lo saque: aceptarlos sería justamente publicar las coordenadas. Vuelven
  con la Function de DEC-7d, que recomprime todo.

## La vista previa del panel no es una tercera salida

La vista previa del evento (B-12) muestra el evento armado por
`construirEvento`, **la misma función que lo publica** (D-20). No puede mostrar
de más (haría creer que se publica algo que no se publica) ni de menos (genera
desconfianza): es el mismo texto.

`tests/vistaPreviaEvento.test.ts` lo fija para los tres casos sensibles: el link
privado de la reunión, la difusión interna y la URL del material privado.

Y de paso la vista previa **avisa** cuando el link de la reunión va a salir: es
el último lugar donde se puede notar antes de publicar. Desde B-224 el aviso mira
**todas** las formas de cursar y no la derivada: con dos filas virtuales, mirar
solo la primera dejaría sin avisar un link público cargado en la segunda.

## El borrador autoguardado tampoco es una salida (B-191, D-122)

El formulario se persiste solo en el navegador de quien está cargando. **Es la
única cosa que el panel guarda fuera de Firestore que es contenido**: todo lo
demás que vive en el navegador son marcas (qué novedad se leyó, qué acordeón se
abrió, qué versión se vio).

Por qué no es una salida nueva:

1. **No sale del dispositivo.** No hay red en el camino: se escribe y se lee del
   mismo navegador, con clave **por admin y por formulario** — la huella del uid
   (`lib/huella.ts`, nunca el uid en claro) más el id de la actividad, o `nueva` /
   `copia` cuando todavía no hay documento.
2. **No pasa por la analítica.** El vocabulario de eventos solo acepta enums y
   contadores (§9 de este documento y `docs/09-analitica.md`), y un descuido acá
   sería la primera vía de fuga de texto libre del panel. `tests/autoguardado.test.ts`
   lee el código de `lib/formulario/autoguardado.ts` y de `useAutoguardado.ts`
   —con los comentarios afuera— y falla si aparece un `import` de `analytics`, un
   `medir(` o cualquier cosa de Firestore.
3. **No cambia lo que es público.** Lo guardado es una copia de lo que ya está en
   la pantalla de un panel que pide sesión con permiso de admin; y el borrador
   que se llegue a guardar en Firestore queda con `estado` no publicado, que las
   reglas del §5.3 ya mantienen fuera de una lectura anónima.
4. **Recuperar no puede publicar lo que estaba privado.** El borrador vive hasta
   30 días, así que un valor de hace tres semanas se aplica sobre el documento de
   hoy. El caso concreto: se destilda «mostrar el link sin inscribirse», no se
   guarda, se recupera a los veinte días y se publica — y el link de la reunión
   sale a `events.json` y a la descripción del evento (trampa 5). **Seis campos no
   se aplican tal cual:** los `calendarEventId`, que los escribe el backend
   (familia de B-80); los dos flags de publicación, que vuelven a `false`; y
   `estado`, el `slug` bloqueado y `sesiones[].cancelada`, que salen del documento
   de hoy —un borrador que decía `publicado` re-publicaba una actividad retirada a
   propósito—. La lista y el porqué de cada uno están en **D-124**, en un solo
   lugar: se quedó corta dos veces por estar repartida. El aviso de recuperación
   avisa cuando hay flags en juego, porque la casilla puede estar en una sección
   cerrada donde nadie la ve.

Lo que sí hay que tener presente: **es contenido en un dispositivo compartido**.
Mientras la sesión está abierta, el borrador queda ahí hasta que se descarta, se
guarda o pasan 30 días.

**Las dos salidas borran de verdad**, y las dos hubo que arreglarlas el 2026-08-26:

- **«Descartar»**, el botón del aviso de recuperación, borra la clave. Hasta ese día
  solo escondía el aviso, así que el borrador seguía en el navegador y volvía a
  ofrecerse al reabrir la actividad: el botón que esta sección presenta como la
  salida a mano no descartaba nada.
- **El fin de la sesión** borra todos: `alCambiarDeSesion` en el observador de auth,
  más `borrarTodosLosBorradores` antes del `signOut` en los dos botones «Salir». Sin
  eso el contenido sobrevivía al logout, en claro y bajo una clave predecible.

Con precisión, porque la diferencia importa: lo segundo lo garantiza **la sesión**, y
no los dos botones. Hasta B-203 lo garantizaban los botones —los dos únicos caminos
que llaman a `logout()`— y una sesión que terminaba sin un click (token revocado,
cuenta deshabilitada, logout en otra pestaña) volvía al login dejando los borradores
donde estaban.

**La condición es la transición y no el valor**, y eso no es un detalle de
implementación: el primer aviso de `onAuthStateChanged` es `null` mientras se
restaura la sesión guardada, así que borrar en cualquier `null` se llevaría lo que
alguien está escribiendo al abrir el panel — peor que la exposición residual, y
justo lo que el autoguardado vino a evitar. Se compara el uid anterior con el
actual: `null → uid` no borra, `uid → mismo uid` (refresco de token) tampoco,
`uid → null` y `uid → otro uid` sí. Ese último es el que se escapa con el predicado
ingenuo: `onAuthStateChanged` no garantiza pasar por `null` al cambiar de cuenta.

**Dos cosas que quedan afuera, asumidas y dichas:**

- Si la sesión se corta con la pestaña cerrada no hay observador corriendo, y el
  aviso siguiente es el de apertura, sin uid anterior — indistinguible del arranque
  normal, así que no borra. Esos borradores viven hasta que alguien los descarta,
  los guarda, entra con otra cuenta en ese navegador, o pasan 30 días.
- El borrado es por prefijo, o sea **de los borradores de este navegador** y no «de
  los míos»: el fin de sesión de una cuenta se lleva también los de la otra. Es el
  lado prudente del error —borra de más, no de menos— y para este panel es lo
  deseable, pero no es lo que el nombre sugiere.

## El link de la reunión: default privado, publicable a pedido

`online.urlPublica` **se respeta** desde el 2026-08-21 (D-15), en el
`events.json` y en la descripción del evento de Calendar.

Es un desvío consciente del §5.2 y del §7.4, que descartan la URL sin
condición. Lo decidió el dueño: el modelo del §3.1 tiene el flag y el
formulario su casilla, así que ignorarlo era prometer algo que no pasaba.

Tres cosas se mantienen porque son las que hacen que el desvío sea aceptable:

1. **El default es `false`.** Publicar el link es una acción deliberada por
   actividad.
2. **El formulario advierte** que un link de reunión público habilita
   zoombombing, en el propio checkbox.
3. **Sin URL cargada no se inventa el campo**, aunque el flag esté en true.

Si la actividad es un encuentro abierto sin inscripción, publicar el link tiene
sentido. Si tiene cupo, no: el link circula y el cupo deja de existir.

**Y la casilla dice a dónde sale** (B-240, D-158). Decía «Publicar el link en el
sitio», y en la página de detalle el link **no** sale ni con el flag en true
(D-139): la casilla prometía una pantalla que nunca lo muestra. Se corrigió el
texto y no el comportamiento, porque el argumento de D-139 es asimétrico — un
evento de Calendar se reescribe al destildar, un HTML indexado no se despublica.

**Y la salida real es una sola: la descripción del evento de Calendar.** El ítem
B-240 decía «al `events.json` y al evento», y al `events.json` no va: `toPublic`
emite la URL (D-15) pero `entradaDeIndice` la descarta (D-129), así que el link
muere en la proyección y no llega a ningún archivo que el sitio publique — lo
fija el gate del build, que siembra `urlPublica: true` con un centinela y falla si
aparece en `dist/events.json`. La casilla, la guía y el aviso de campo faltante
dicen eso y nada más: prometer una salida que no existe invita al arreglo
equivocado, que sería agregarle la `url` al índice.

## La página «Suscribirse» publica la dirección del calendario — la pública

`/suscribirse` (B-230) imprime la dirección del `.ics` **a la vista**, para que se
pueda copiar y pegar en Outlook o en Thunderbird. Es correcto: esa dirección existe
para que la gente se suscriba y el calendario ya es público.

Lo que importa es **cuál** de las dos se imprime. Google publica dos direcciones del
mismo calendario:

```
.../ical/<id>/public/basic.ics              ← la que va
.../ical/<id>/private-<token>/basic.ics     ← nunca
```

La segunda **le da acceso de lectura al calendario entero a quien la tenga** y no se
revoca sin rotarla. Están a un path de distancia y se copian igual de fácil, y ahora
hay una página que muestra una dirección de calendario en pantalla: es el lugar más
probable donde alguien pegue la equivocada.

Tres redes, y ninguna es «acordarse»:

1. `src/lib/enlaces.ts` es el único lugar donde se arman, y **no sabe producir** la
   privada. `tests/enlaces.test.ts` falla si alguna de sus salidas contiene
   `private-`.
2. `tests/suscribirse.test.ts` exige que cada dirección de la página sea
   **exactamente una** de las que `enlaces.ts` produce. Una escrita a mano —aunque
   sea la buena— no pasa.
3. El mismo test barre el markup de la página y de sus componentes buscando
   cualquier `https://`, `http://` o `webcal://` escrito, y falla si encuentra uno.

Verificado sobre el HTML construido, no solo en los tests:

```bash
npm run build
grep -c 'private-' dist/suscribirse/index.html   # → 0
```

## Los reportes del panel salen a un repo público

El panel puede cargar bugs y sugerencias, y una Cloud Function los publica como
issue en `benoffi7/agenda-literaria`. Ese repo es **público** — verificado, no
asumido:

```bash
gh repo view benoffi7/agenda-literaria --json visibility   # → PUBLIC
```

Así que el issue es una tercera salida pública, junto con el `events.json` y el
calendario, y le aplican las mismas reglas.

| Qué | Sale al issue | Dónde queda |
|---|---|---|
| Título, descripción y pasos | sí, **filtrados** | completos en Firestore |
| Contexto técnico (navegador, ventana, ruta, zona horaria, versión) | sí | — |
| `reportadoPor.uid` / `reportadoPor.email` | **no** (D-32) | `/reportes/{id}` |
| Título y slug de la actividad referida | solo si está **publicada** (D-33) | `/reportes/{id}` |
| Id de la actividad referida | sí — es opaco | — |

El filtro (`redactar()` en `functions/reportes.js`) tapa **mails** y **links de
reunión** (zoom, meet, teams, jitsi, whereby, wa.me) en todo el texto libre. Es
la segunda defensa: la primera es que el formulario avisa, arriba de todo, que el
repo es público.

**Todo el texto libre incluye el título**, que es el `title` del issue y el
renglón que más se lee desde internet. Hasta el 2026-08-22 no pasaba por el
filtro: la tabla de arriba decía "filtrados" y valía para la descripción y los
pasos nada más (B-81 en [`BACKLOG.md`](BACKLOG.md) → Cerrados). Los tests que lo
sostienen están en `tests/costuras.test.ts`.

La decisión sobre la actividad la toma la Function leyendo el documento, no el
panel: si dependiera del cliente, un panel viejo o modificado podría publicar el
título de un borrador.

**El PAT de GitHub no está en el cliente.** Si el panel llamara a la API de
GitHub, el token viajaría en el bundle de `/admin` y cualquiera podría escribir
en el repo. Por eso el panel escribe en Firestore y el token vive en Secret
Manager, accesible solo desde la Function (§5.4).

### Reglas de `/reportes/{id}`

```js
match /reportes/{id} {
  allow read: if esAdmin();
  allow create: if esAdmin() && reporteValido();
  allow update: if esAdmin() && reintentoValido();   // solo error → pendiente
  allow delete: if false;
}
```

`reporteValido()` valida la **forma** del documento, no solo quién escribe:
conjunto exacto de campos, topes de largo (los mismos que el schema del
formulario), `reportadoPor.uid == request.auth.uid`, `creadoEn == request.time`,
y que nazca en `estado: 'pendiente'` con `intentos: 0` y `github: null`.

El motivo del último punto: el estado inicial es lo que decide si la Function
toma el reporte. Un documento que naciera "creado" quedaría muerto en Firestore
sin publicarse nunca, y uno que naciera con un `github` inventado apuntaría a un
issue ajeno.

`tests/reportes.integracion.test.ts` verifica cada uno de esos rechazos contra el
emulador, y `tests/reportes.test.ts` verifica que el issue armado a partir de un
reporte real no contenga el uid ni el mail.

### La única escritura del cliente sobre un reporte ya creado (B-31)

`reintentoValido()` habilita **una** transición: un reporte en `error` vuelve a
`pendiente` para que la Function lo tome de nuevo. Cinco condiciones, cada una
tapando una forma de hacer daño:

| Condición | Qué evita |
|---|---|
| `estado` previo es `error` | reintentar algo `enviando` o ya `creado` — así se crean dos issues del mismo reporte |
| `github` previo es `null` | lo mismo, en profundidad: si ya tiene número, no hay nada que reintentar |
| solo cambian `estado`, `intentos`, `error`, `actualizadoEn` | **editar el texto que va al repo público** por la puerta del reintento |
| `intentos == 0` | que el botón no haga nada: la Function ignora un reporte con los intentos agotados, que es el caso más común de un `error` |
| `actualizadoEn == request.time` | antedatar, igual que en la creación |

Borrar sigue prohibido: un reporte es el pedido de una persona y el panel no
tiene por qué poder hacerlo desaparecer.

`tests/reportes-reintento.integracion.test.ts` fija los siete casos contra el
emulador. Está en su propio archivo porque **carga en el emulador las reglas de
este checkout** antes de correr: el emulador sirve el `firestore.rules` del
directorio desde el que se lo arrancó, así que con varios worktrees a la vez un
test de reglas puede estar verificando el archivo de otra rama y dar verde sin
haber probado nada.

## Analítica del panel

El panel manda eventos a GA4 (ver [`09-analitica.md`](09-analitica.md)). Es una
tercera salida además del `events.json` y del calendario, y la más estricta de
las tres: **acá no sale contenido, nunca, ni con permiso del dueño.**

### Qué se manda

Solo datos derivados: enteros, booleanos, valores de vocabularios cerrados, y
**rutas de campo** del schema (`arancel.tipo`, `sesiones.N.fin`).

Se mide *que* un campo falló validación y *cuál* campo. Nunca *qué* se escribió.

### Qué NUNCA sale

| Qué | Nota |
|---|---|
| Cualquier valor de cualquier campo | títulos, descripciones, temas, lecturas, notas |
| `inscripcion.destino` | el mail o teléfono de inscripción **sí** va al JSON público, pero no a analítica: acá no aporta nada |
| `online.url` | ni siquiera con `urlPublica: true`. El desvío del D-15 aplica al JSON y al calendario, no a esto |
| `difusion` | trabajo interno |
| `material.items[].url` y `titulo` | |
| `sede.direccion`, `sede.nombre`, `indicaciones` | |
| Handles de Instagram, webs, `imagenes[].url` y `imagenes[].epigrafe` | |
| `createdBy` / `updatedBy`, el uid y el mail del usuario logueado | ni crudos ni hasheados |
| El mensaje de un error | `formADocumento` tira `Fecha inválida: "<lo tipeado>"`: el mensaje *es* contenido. Sale la etiqueta `fecha-invalida` |

### Cómo se garantiza

Es el mismo criterio del §5.2 y de `toPublic.ts`: **se manda una proyección
deliberada, no el objeto.** Acá la proyección es una whitelist en las dos
direcciones (`construirEvento`, en `src/lib/analytics-eventos.ts`):

1. Un **nombre de evento** no declarado no manda nada.
2. Un **parámetro** no declarado en ese evento se descarta.
3. Cada parámetro declarado tiene un sanitizador, y **no existe un sanitizador
   de texto libre**: entero, booleano, enum cerrado, ruta del schema, o lista de
   esos. Un string fuera de su vocabulario se reemplaza por `otro`.
4. El único que no sale de un enum ni del schema es `version`, y va contra un
   **formato verificado**: semver de tres números más, como máximo, un sufijo que
   arranca alfanumérico y sigue con `[0-9A-Za-z.-]` hasta 40 caracteres. No entra
   un espacio, ni un acento, ni `@ : / ?`, así que un título, un mail, un handle
   o un link no pueden pasar por ahí; lo que no matchea viaja como `otro`. El
   formato es exactamente el que produce `scripts/version.mjs`, y que los dos
   lados no se separen lo verifica `tests/version.test.ts` (B-88 · D-98).

La consecuencia es la propiedad que importa: **no depende de que cada punto de
medición se acuerde de filtrar.** Un `medir()` mal escrito que pase el
formulario entero produce un payload vacío, no una fuga.

El identificador que distingue a las dos personas es un valor **aleatorio**
generado en el navegador y guardado en `localStorage`, no el uid ni el mail, y
tampoco un hash de ellos: con dos admins conocidos, un hash del mail se
revierte probando dos entradas (D-57).

### Cómo verificar

`tests/analytics-privacidad.test.ts` es el equivalente, para la analítica, del
test que verifica que el link de Zoom no sale al calendario. No confía en la
intención del código: arma el payload y busca el dato adentro.

```bash
npx vitest run tests/analytics-privacidad.test.ts
```

Qué verifica:

- Un formulario con **centinelas** en cada campo de texto —incluidos el link de
  la reunión, la difusión interna, la URL del material privado, el uid y el mail
  del admin— metido como parámetros de **cada** evento declarado: ningún
  centinela aparece en ningún payload.
- Un centinela en **cada parámetro declarado de cada evento**, uno por uno. Es la
  garantía estructural: si mañana alguien agrega un parámetro que acepte texto
  libre, el test falla sin que haya que acordarse de escribirle un caso.
- Que ningún valor de parámetro sea un objeto o un array (un valor anidado podría
  esconder contenido), y que todo string esté en un vocabulario cerrado.
- Que los issues **reales** de zod sobre un formulario roto produzcan rutas de
  campo reconocidas, y no valores.
- Que con los emuladores prendidos la analítica esté apagada.

Sobre el sistema real, lo que corresponde es el DebugView de GA4: mirar evento
por evento lo que llega y confirmar que no hay un parámetro de más. Está en
[`09-analitica.md`](09-analitica.md).


## Autorización

### Reglas de Firestore

```js
function esAdmin() {
  return request.auth != null && request.auth.token.get('admin', false) == true;
}

match /actividades/{id} {
  allow read:  if esAdmin();    // D-128 — antes: || resource.data.estado == 'publicado'
  allow write: if esAdmin();
  match /versiones/{version} {
    allow read:  if esAdmin();
    allow write: if false;      // solo el Admin SDK
  }
}
match /opciones/{campo} {
  allow read:  if true;         // los chips de filtro del §4.4
  allow write: if esAdmin();
}
match /sistema/{doc} {
  allow read:  if esAdmin();
  allow write: if false;        // solo el Admin SDK
}
```

Tres detalles que costaron encontrar:

- **`token.get('admin', false)`, no `token.admin`.** Leer una clave ausente de un
  map es un *evaluation error*, no `false`.
- **La lectura de `/actividades` es solo del admin (D-128, B-208).** El §5.3 del
  `CLAUDE.md` prescribía `resource.data.estado == 'publicado'`, y eso filtraba:
  **una regla de Firestore no proyecta.** Es todo-o-nada por documento, así que
  autorizaba entregar el documento entero —con el link de la reunión, la
  `difusion`, los uids y el `storagePath`— y no la vista de `toPublic`. El §2.5
  dice que el público hace cero lecturas de Firestore, y por eso se leía como
  inofensiva; lo que faltaba notar es que *permitirla* y *necesitarla* son cosas
  distintas.
- **La regla del padre no cascadea a la subcolección.** `versiones` necesita su
  propio `allow read: if esAdmin()` — está más abajo, con su comando de
  verificación.

**Advertencia del §5.3, hoy inerte pero no derogada:** una condición sobre
`resource.data` obliga a que toda query pública incluya el `where`
correspondiente, si no Firestore rechaza la query **entera** en vez de devolver
el subconjunto visible (trampa 7).

Desde D-128 **ninguna** colección de este proyecto tiene una regla de lectura
condicionada por `resource.data` —`/actividades` es `esAdmin()` puro y
`/opciones/*` es `if true`—, así que hoy no hay query que se pueda romper así. La
advertencia queda porque el día que B-01 necesite lectura en vivo desde el
cliente, la forma que D-128 recomienda (una subcolección `privado/`) reintroduce
exactamente este mecanismo. El contraste está fijado en el `describe('trampa 7 —
el mecanismo, con una regla condicionada')` de
`tests/actividades.integracion.test.ts`, que carga su propio ruleset para probarlo
sin depender de cuál sea la regla viva.

### Aprobar taxonomías (§4.3)

`/opciones/{campo}` es de **lectura pública** y de escritura solo con claim
`admin`. Aprobar una opción (`aprobada: true`) es una escritura más de ese
documento, así que **cualquiera de las cuentas con el claim puede aprobar**
(D-28). No hay una regla más fina porque las reglas no pueden comparar el array
`valores` elemento por elemento contra el anterior: no hay forma de verificar
"esta escritura solo cambió `aprobada`". Está anotado en las propias reglas.

Dos consecuencias que importan acá:

- **El creador se guarda como huella, no como uid** (D-27). El documento es
  público y el §5.1 dice que los uids no salen al público. `huellaCreador` es una
  huella de 8 hex del uid: sirve para comparar igualdad y no dice nada de nadie.
  Un test de integración verifica que el uid no aparezca en el documento.
- **La aprobación no esconde etiquetas ya en uso** (D-30). Filtra lo que se puede
  *elegir*, no lo que se puede *mostrar*: si una actividad usa una opción
  pendiente, el evento público sigue diciendo "Con beca parcial" y no
  "con-beca-parcial".

Al `events.json` van **solo las aprobadas** — `opcionesVisibles(valores)` sin
uid: el sitio público no publica vocabulario sin validar.

```bash
# Qué hay pendiente de aprobar en producción
node scripts/aprobar-opciones.mjs --listar
```

### Custom claim `admin`

Se setea una vez con el Admin SDK. El panel solo lo lee para decidir qué
mostrar; la autorización real la hacen las reglas.

```bash
# Emulador
npm run admin:claim -- --todos

# Producción
node scripts/preparar-produccion.mjs <email>
```

El claim entra al token en el próximo login.

## `firebase-admin` nunca al cliente

Si se cuela en un componente cliente, **la service account key termina en el
bundle** (trampa 4, §5.4). Tres defensas:

1. `src/lib/firebase-admin.ts` tira error si detecta `window`.
2. `astro.config.mjs` lo marca como `ssr.external`.
3. Se verifica sobre el build.

## Secretos

| Qué | Dónde va | Dónde NO |
|---|---|---|
| Service account key | ninguna parte en local: se usan las ADC de gcloud y la identidad del runtime | disco, repo |
| Key de `deploy-ci@` | secret `FIREBASE_SERVICE_ACCOUNT` de GitHub Actions | disco, repo |
| PAT de GitHub (reportes y §8) | Secret Manager, atado a la Function con `defineSecret` | `functions/.env`, repo, bundle del panel |
| URL privada del ICS | `.env` local si hace falta | repo |
| Nombre del repo (`GITHUB_REPO`) | `functions/.env`, versionado — no es secreto | — |
| Id del calendario (`GOOGLE_CALENDAR_ID`) | `functions/.env`, versionado — **no es secreto**: es la dirección de suscripción de un calendario público, y publicarla es el punto del proyecto | — |
| Config del SDK web (`PUBLIC_*`) | `.env.development` / `.env.production`, versionadas — pública por diseño, va al bundle | — |

> La tabla estaba **partida en tres** por dos líneas en blanco, con `Service
> account key` y `PAT de GitHub` en dos redacciones distintas cada uno, así que
> las últimas filas renderizaban sin encabezado. Unificada el 2026-08-27, con las
> dos filas que faltaban: el id del calendario y la config del SDK web eran
> justamente las dos preguntas que alguien iba a venir a buscar acá y no
> encontraba (B-213).

La URL privada del ICS (`.../private-.../basic.ics`) da acceso de lectura al
calendario entero a quien la tenga. Si aparece en un historial de comandos o un
chat, conviene rotarla desde la configuración del calendario.

**La key de `deploy-ci@` es la única key del proyecto**, y existe porque un runner
de GitHub no tiene ADC. Por eso la cuenta es aparte de `calendar-sync@`. Lo que
tiene hoy:

```
roles/datastore.viewer                     leer Firestore en build time
roles/firebasehosting.admin                desplegar el sitio y el panel
roles/serviceusage.serviceUsageConsumer    preguntar si una API está habilitada
roles/firebaserules.admin                  desplegar firestore.rules y storage.rules
roles/datastore.indexAdmin                 desplegar firestore.indexes.json
roles/firebase.developAdmin                leer la config del proyecto
roles/secretmanager.viewer                 resolver los secrets que las Functions declaran
roles/cloudfunctions.developer             desplegar las Functions
roles/run.admin                            el Cloud Run que hay abajo de cada Function v2
roles/cloudbuild.builds.editor             el build que empaqueta la Function
roles/artifactregistry.writer              guardar la imagen de ese build
roles/cloudscheduler.admin                 el job de onSchedule del rebuild
roles/iam.serviceAccountUser               sobre las tres cuentas de runtime
```

**Esta key puede cambiar qué es legible, y hay que decirlo así.** Con
`firebaserules.admin` alcanza para reescribir `firestore.rules` y dejar
`/actividades` abierto a una lectura anónima — o sea, los borradores, `difusion`,
`online.url` y los uids. Con `cloudfunctions.developer` + `run.admin` +
`iam.serviceAccountUser` alcanza para desplegar código que corre como
`calendar-sync@`. **No** puede leer el contenido de un secret (`secretmanager.viewer`
ve los metadatos, no las versiones), **no** puede escribir datos en Firestore sin
antes reescribir las reglas, y **no** puede tocar IAM.

Hasta el 2026-08-28 tenía tres roles y esta sección decía lo contrario: *"el daño se
limita a leer datos que ya son públicos y a desplegar el sitio — no a modificar la
base ni a cambiar qué es legible"*. Eso **ya no es cierto**, y la frase quedó citada
acá a propósito en vez de borrada: quien la haya leído antes tiene que poder
encontrarla y ver que caducó. El cambio fue deliberado —**D-132**, que revierte D-119— para
que los seis jobs de `push-main.yml` puedan terminar bien; el costo es exactamente
el párrafo de arriba.

**Nada en CI contiene a esta key.** El workflow corre los tests de reglas antes de
desplegarlas, pero quien tenga la key no pasa por el workflow. La contención real es
que viva en un solo lugar —un secret de Actions— y el orden de rotación:
rotar → **redesplegar `firestore.rules` y `storage.rules` desde el repo** → recién
ahí investigar. Redesplegar las reglas va segundo y no último, porque mientras no se
haga no se sabe qué está publicado.

**La lista de roles de esta sección y la de
[`02-infraestructura.md`](02-infraestructura.md) § "Roles de `deploy-ci@`" tienen que
decir lo mismo**, y lo verifica `tests/roles-deploy-ci.test.ts`: el drift entre las
dos es cómo esta afirmación quedó mintiendo una hora el 2026-08-25, y una afirmación
de seguridad que miente es peor que no tenerla. Ese test hoy hace además lo
contrario de lo que hacía: en vez de exigir que no haya roles de escritura, exige
que **mientras los haya**, acá no reaparezca la frase de que el daño se limita a
leer.

## Cómo verificar — comandos

### El `events.json` que se sube es el que se cree (B-217)

```bash
npm run emu                              # en otra terminal
./scripts/build-contra-emulador.mjs      # o el paso 4 de verificar-todo.sh
```

Siembra dos actividades de centinelas —una publicada y una en borrador—, corre
el build y **afirma sobre `dist/events.json`**: que la publicada esté (o sea,
que el build leyó Firestore y no salió en verde con el índice vacío), que la
borrador no, y que ningún centinela de los campos que el índice recorta
sobrevivió al archivo.

Es la contraparte del barrido de `tests/barrido-de-salidas-publicas.test.ts`,
que corre sobre el **valor de retorno** de `construirIndice`. Entre ese valor y
el archivo que sube al Hosting están el `JSON.stringify` y la serialización del
endpoint, y esto mira el otro extremo. El endpoint en sí lo cubre además
`tests/events-json-endpoint.integracion.test.ts`, que corre en CI.

### El build no filtró el Admin SDK

```bash
npm run build
grep -rl "firebase-admin\|private_key\|service_account" dist/ && echo "FUGA" || echo "limpio"
```

El mismo chequeo corre como **paso bloqueante** del workflow de deploy
(`.github/workflows/deploy.yml`): si encuentra algo, el job falla y no se
publica nada. Falla cerrado a propósito — publicar la key es irreversible.

### Las reglas rechazan lo anónimo en producción

```bash
K=$(grep PUBLIC_FIREBASE_API_KEY .env.production | cut -d= -f2)
BASE="https://firestore.googleapis.com/v1/projects/agenda-literaria/databases/(default)/documents"

# Debe devolver "Missing or insufficient permissions"
curl -s -X POST "$BASE/actividades?key=$K" -H "Content-Type: application/json" \
  -d '{"fields":{"titulo":{"stringValue":"x"},"estado":{"stringValue":"publicado"}}}'

# Idem
curl -s -X PATCH "$BASE/opciones/arancel?key=$K" -H "Content-Type: application/json" \
  -d '{"fields":{"valores":{"arrayValue":{"values":[]}}}}'

# ── LECTURA (D-128, B-208) ────────────────────────────────────────
# Hasta el 2026-08-27 acá solo había escrituras, y del lado de la lectura la
# regla entregaba el documento ENTERO de toda actividad publicada. Estas dos
# son las que hay que correr después de deployar reglas.

# Debe devolver "Missing or insufficient permissions"
curl -s "$BASE/actividades?key=$K"

# Idem — la query con el where, que era la que pasaba y devolvía todo crudo
curl -s -X POST \
  "https://firestore.googleapis.com/v1/projects/agenda-literaria/databases/(default)/documents:runQuery?key=$K" \
  -H "Content-Type: application/json" \
  -d '{"structuredQuery":{"from":[{"collectionId":"actividades"}],
       "where":{"fieldFilter":{"field":{"fieldPath":"estado"},
       "op":"EQUAL","value":{"stringValue":"publicado"}}}}}'

# Esta SÍ debe funcionar: los chips de filtro la necesitan (§4.4)
curl -s "$BASE/opciones/arancel?key=$K"
```

**Ojo con leer el resultado de estas dos:** un `permission-denied` y un
"no encontré nada" se parecen si solo se mira que no haya datos. Si la primera
devuelve `{}` en vez del error, no significa que esté cerrada — significa que la
colección está vacía o que el `key` no era el de producción. El error tiene que
estar **nombrado** en la respuesta.

### El issue no filtró la identidad de quien reportó

Los tests lo cubren, pero cuando haya issues reales conviene mirarlos:

```bash
gh issue list --repo benoffi7/agenda-literaria --label reporte-panel \
  --json number,title,body |
  grep -Ei "@gmail|@hotmail|zoom\.us|meet\.google|wa\.me" && echo "FUGA" || echo "limpio"
```

### El calendario real no filtró nada

Leer el ICS y buscar lo que no debe estar. La URL privada **no** se pega acá:
va en una variable de entorno.

```bash
curl -s "$ICS_PRIVADO" -o /tmp/cal.ics
python3 - <<'PY'
import pathlib
# El formato ICS parte las líneas largas: hay que desdoblarlas antes de buscar,
# o un grep directo da falsos negativos.
raw = pathlib.Path('/tmp/cal.ics').read_text(errors='replace')
plano = raw.replace('\r\n ', '').replace('\n ', '')
for t in ['zoom.us', 'meet.google.com', 'us02web']:
    print(('  FUGA: ' if t in plano else '  ok  : ') + t)
PY
```

### Las reglas y el diff, en los tests

```bash
npm run emu      # en otra terminal
npm test
```

`tests/actividades.integracion.test.ts` verifica contra el emulador que sin claim
no se escribe, que un anónimo lee lo publicado pero no un borrador, y que la
proyección no filtra. `tests/calendario.test.ts` verifica lo mismo para el
evento.

## Historial de versiones

`guardarVersion` escribe el documento anterior completo en
`/actividades/{id}/versiones/{version}` cada vez que una edición pisa contenido
cargado por una persona (§12, D-41).

**Guarda el documento entero, sin proyectar** — incluidos `difusion` y
`online.url`, que son internos. Eso es deliberado: el §12 pide el `before`
completo, y proyectarlo sería guardar un historial del que justamente no se
puede recuperar lo que uno quiere recuperar.

Es aceptable porque **la audiencia de la subcolección es exactamente la misma
que la del documento padre**, y no hay camino desde ahí a una salida pública:

| | |
|---|---|
| Quién puede leerla | solo un admin — `allow read: if esAdmin()` |
| Quién puede escribirla | nadie desde el cliente — `allow write: if false`, solo el Admin SDK |
| ¿Llega al `events.json`? | **no.** El build lee la colección `/actividades`, y una query de colección **no** trae subcolecciones. `toPublic.ts` nunca la ve. |
| ¿Llega a Google Calendar? | **no.** `calendario.js` recibe el documento de la actividad, no sus versiones. |

O sea: un admin que lee una versión ya podía leer los mismos campos en el
documento padre, incluidos los borradores (D-04). La subcolección no amplía a
nadie lo que puede ver.

**Lo que sí hay que no hacer:** si algún día el build necesita recorrer
subcolecciones (`getCollections()`, `collectionGroup('versiones')`), pasaría a
tener en mano documentos con `difusion` y `online.url` de todas las actividades.
Cualquier lectura nueva ahí tiene que quedar afuera de lo que se proyecta al
JSON.

Las reglas ya contemplaban esta subcolección desde antes de que existiera la
Function, así que no hubo que cambiarlas.

### Verificar que las versiones no son públicas

```bash
K=$(grep PUBLIC_FIREBASE_API_KEY .env.production | cut -d= -f2)
BASE="https://firestore.googleapis.com/v1/projects/agenda-literaria/databases/(default)/documents"

# Debe devolver "Missing or insufficient permissions" incluso si la actividad
# está publicada: la regla de lectura del padre no cascadea a la subcolección.
curl -s "$BASE/actividades/<id>/versiones?key=$K"
```

Y sobre el JSON, una vez que exista el sitio público (B-01):

```bash
npm run build
grep -rl "difusion\|versiones" dist/events.json && echo "FUGA" || echo "limpio"
```
