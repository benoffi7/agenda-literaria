# Backlog

Ordenado por prioridad. **Todo reporte de posible bug entra acá**, incluso si se
arregla en el momento: en ese caso va directo a [Cerrados](#cerrados), para que
quede el rastro de qué se rompió y por qué.

Prioridades: **P0** rompe algo o pierde datos · **P1** bloquea el objetivo del
proyecto · **P2** mejora real · **P3** cuando sobre tiempo.

---

## Decisiones pendientes del usuario

Nada de esto se puede avanzar sin respuesta. Están primero porque bloquean
trabajo.

| # | Tema | Contexto |
|---|---|---|
| DEC-1 | ~~`libro presentado`~~ **resuelto: campo propio con obra + autor.** Pendiente de implementar. | El §11 lo lista para presentaciones y charlas, pero el §3.1 no lo tiene en el modelo. Decidido el 2026-08-21: campo propio con título de la obra y autor de la obra si difiere del invitado, para poder filtrar y mostrarlo aparte. |
| DEC-6 | **Las ocho decisiones que bloquean el sitio público.** Están listadas en el §11.1 de [`12-sitio-publico.md`](12-sitio-publico.md). | La primera —**el dominio final**— bloquea B-109 y con él todo lo demás: sin `site` no hay canonical, ni Open Graph, ni sitemap, y mudar el dominio después de indexar cuesta meses. Le siguen el canal de contacto público, el nombre del sitio y si el sitio público se mide. |
| DEC-7 | **La galería de imágenes (B-167): cuatro decisiones.** (a) ¿la descripción es *epígrafe* o *texto alternativo*? (b) ¿tamaño máximo y cuántas imágenes por actividad? (c) ¿se permite alojar propias desde el día uno, o arranca solo con URLs externas? (d) ¿las externas se descargan al build para poder optimizarlas? | (a) es la que más pesa y no es cosmética: un **epígrafe** es opcional y se muestra; un **texto alternativo** es lo que leen un lector de pantalla y Google, y no debería ser opcional. Se pidió "descripción opcional", que es un epígrafe — si además hace falta accesibilidad y SEO (B-107 los necesita), son **dos campos**, no uno. (c) parte el trabajo en dos entregas: solo URLs no necesita Storage, ni reglas nuevas, ni target de deploy, ni EXIF, y es la mitad del valor con un cuarto del riesgo. |
| DEC-8 | **Las N opciones para sumarse a un mismo ciclo (B-181): qué forma tienen.** ¿Nada de modelo y van en la descripción, una actividad por comisión atada por un campo nuevo, o un eje `opciones` con sus propias sesiones? | Bloquea B-181 y no se puede empezar sin la respuesta: los tres caminos tocan lugares distintos y el más fiel es el que llega al diff del §7.2 y a la numeración de D-95. Mientras no se decida, un club con cuatro horarios se carga como cuatro encuentros y el calendario público le manda los cuatro a cada suscripto. |

Resueltas el 2026-08-21:

| # | Tema | Resolución |
|---|---|---|
| DEC-3 | Checkbox "publicar el link de la reunión" | **respetarlo** → implementado (D-15) |
| DEC-4 | Home indexable con el placeholder | se deja así |
| DEC-5 | Eventos de prueba en el calendario | los borra el usuario |
| DEC-2 | `arancel` preseleccionaba "Gratis" | **obliga a elegir** → implementado (D-16) |

---

## Pendiente de acción manual del dueño

Código terminado, no se puede avanzar sin credenciales que un agente no debe
crear ni ver (§5.4).

### B-20 · Activar el rebuild automático (cierra B-02)

El workflow y la Function están escritos y testeados. Falta, en este orden
(comandos exactos en [`08-operacion.md`](08-operacion.md) → "Activar el rebuild
automático"):

1. Crear el PAT de GitHub (fine-grained, solo `benoffi7/agenda-literaria`,
   permiso **Contents: Read and write**).
2. Habilitar `secretmanager.googleapis.com` y crear el secreto `GITHUB_TOKEN`,
   dándole `secretAccessor` a `calendar-sync@`.
3. Crear la service account `deploy-ci@` con `datastore.viewer` +
   `firebasehosting.admin` y bajar su key.
4. Cargar esa key como secret `FIREBASE_SERVICE_ACCOUNT` en GitHub y borrarla
   del disco. Probar el workflow a mano (Run workflow).
5. `firebase deploy --only functions:dispararRebuild`.

Hasta que eso esté, una actividad nueva no aparece en el sitio hasta un build
manual. **El paso 5 no tiene sentido sin el 1 y el 2:** el schedule correría
cada 5 minutos loguéandose como "sin GitHub configurado".

### B-21 · Alerta de rebuild agotado (opcional) — código listo (2026-08-24), falta el click del dueño

Cuando el rebuild se rinde después de cinco intentos, loguea
`el rebuild agotó los reintentos` con nivel `error` y deja el motivo en
`sistema/rebuild`. Convertir eso en un aviso real es una log-based alert de GCP:
configuración de consola, no código, y queda a criterio del dueño (D-23).

**Lo que se hizo del lado del código (2026-08-24):** ese log lleva ahora el
campo `alerta: "rebuild-agotado"`, para que el filtro de la alerta apunte a un
campo estable y no al texto del mensaje —que se rompería en silencio el día que
alguien reescriba la frase—. El filtro exacto y los pasos de la consola están en
[`08-operacion.md`](08-operacion.md) § "Alerta de rebuild agotado".

**Lo que queda, y solo lo puede hacer el dueño:** crear la alerta en su proyecto
de GCP con un canal de notificación propio. Tiene sentido recién cuando
`dispararRebuild` esté desplegada (B-20).

---

## P0 — rompe algo o pierde datos

Los dos salieron de revisar las costuras del merge del 2026-08-21: cada feature
está testeada por dentro, el par no. Los tests que los demuestran están en
[`tests/costuras.test.ts`](../tests/costuras.test.ts). **Los dos están
arreglados (2026-08-24)** y sus tests ya no son `it.fails`: pasaron a `it` y
ahora son la guarda de que no vuelvan.

### B-80 · Guardar desde el listado pisa el `calendarEventId` y la edición siguiente duplica el evento — ✅ hecho (2026-08-24)

**Arreglado** del lado de la Function: el write-back repone el id en **toda**
operación del plan, no solo en `crear` y `borrar` (`reponerIds` en
`functions/sincronizacion.js`, D-91). La pasada que pisa el campo es la misma
que lo repara. La salida del lado del panel —que `actualizarActividad` relea y
fusione los ids, y el panel deje de ser dueño del campo— sigue valiendo y quedó
abierta como **B-150**.


**Qué se rompe.** Dos eventos en el calendario público para el mismo encuentro,
y el primero huérfano: nada del sistema lo referencia, así que nada lo va a
borrar nunca. Es el daño de la trampa 3 del §13 por una puerta distinta.

**Cómo se llega.** Es el camino normal, no una carrera exótica:

1. Se publica la actividad. `syncCalendar` crea el evento y **después** escribe
   `calendarEventId` en el documento (segundos, más si la Function arranca en
   frío).
2. `onGuardado` refresca el listado en ese mismo instante
   (`setVersion(v + 1)` → `listarActividades()`), así que el snapshot que queda
   en memoria es de **antes** del write-back: `calendarEventId: null`.
3. Se vuelve a tocar "Editar" en esa fila. `documentoAForm` copia el `null` al
   form y `formADocumento` lo escribe: el id se perdió. El guardado todavía
   actualiza el evento correcto —`planificar` lo saca del `before`—, así que no
   se nota nada.
4. La edición siguiente ya no tiene de dónde sacarlo: `planificar` emite
   `crear`. Segundo evento.

**Por qué no lo agarró nadie.** `syncCalendar` solo escribe ids de vuelta para
las ops `crear` y `borrar` (`idsNuevos` / `idsBorrados`); una `actualizar` no
repone el id que el panel borró. Y el panel es dueño de un campo que escribe la
Function: `formADocumento` lo emite en cada guardado.

**Salidas posibles**, en orden de prolijidad:

- que `actualizarActividad` relea el documento y fusione los `calendarEventId`
  por id de sesión antes de escribir (el panel deja de ser dueño del campo);
- o que `syncCalendar` reponga el id también en las ops `actualizar`, que tapa
  el síntoma pero deja la ventana abierta entre las dos escrituras;
- o que el listado escuche con `onSnapshot` en lugar de `getDocs`, que angosta
  la ventana sin cerrarla (el form se arma una vez, al montar).

### B-82 · `syncCalendar` no es idempotente: una reentrega duplica el evento — ✅ hecho (2026-08-24)

**Arreglado** con el id del evento elegido por el cliente y derivado del id de
sesión (`idDeEvento`, D-90): el `insert` repetido devuelve 409 y se resuelve
actualizando ese mismo evento. La idempotencia quedó en el sistema externo, sin
ningún registro nuevo que la Function tenga que mantener.

La entrega de eventos de Firestore es **al menos una vez**. `syncCalendar`
decide con el payload del evento (`before`/`after`) y no mira el estado actual
del documento, así que la reentrega de la escritura que publicó una actividad
vuelve a emitir `crear`: segundo evento en el calendario público, y el primero
huérfano.

Los otros dos triggers del proyecto sí se blindan, y es la comparación que
muestra el agujero:

- `guardarVersion` usa `idDeVersion(event.time, event.id)`: el reintento
  reescribe el mismo documento (D-43).
- `reporteAIssue` toma el reporte en una transacción y mira `estado`/`github`.
- `syncCalendar` no usa `event.id` en ninguna parte.

La guarda anti-loop del §7.1 no cubre esto: corta la recursión porque la
*segunda* escritura produce el mismo payload, pero una reentrega de la *misma*
escritura trae el mismo `before` y el mismo `after`.

El arreglo natural es el mismo del historial: llevar los ids de evento ya
aplicados por `event.id`, o relee el documento dentro de la transacción del
write-back y no crear si la sesión ya tiene un `calendarEventId`.

---

## P1 — bloquean el objetivo del proyecto

El proyecto existe para que la gente encuentre los talleres en Google (§2.3).
Hoy eso no pasa: no hay sitio público.

### B-01 · Sitio público (paso 3 del §10)

Lo que falta:

- `src/pages/index.astro` — listado con la island de filtros.
- `src/components/Filtros.tsx` — lee `events.json`, filtra en memoria (§2.5).
- `src/pages/actividad/[slug].astro` — detalle por SSG con `getStaticPaths`.
- Generación de `events.json` en build time con el Admin SDK, usando
  `toPublic.ts` y las opciones del §4.4.

Ya está hecho y testeado: la proyección (`toPublic.ts`), la normalización de
búsqueda (`normalize.ts`) y el acceso de build time (`firebase-admin.ts`).

**Ojo:** toda query pública necesita `where('estado','==','publicado')` o
Firestore rechaza la query entera (trampa 7).

**El diseño está hecho: [`12-sitio-publico.md`](12-sitio-publico.md).** URLs,
pantallas, SEO, filtros y casos borde, decididos con su motivo. B-01 queda como
el paraguas; lo construible son **B-105 a B-114**, en el orden del §13 de ese
documento.

### B-105 · El detalle y la home

`src/pages/actividad/[slug].astro` (SSG con `getStaticPaths`, **cero
JavaScript**) y `src/pages/index.astro` con `src/components/Filtros.tsx` como
island.

El detalle primero: es el que recibe el tráfico de Google y de Instagram, y es
el que no depende de nada más (§1 y §4.3 del diseño).

La home es un **listado híbrido** (§6.3): el build imprime en HTML todas las
tarjetas vigentes con sus `data-*` de filtrado, y la island muestra y oculta lo
que ya está en el DOM. Con JS apagado se ve la lista completa y "Explorá por"
—links a los hubs— es la navegación. El markup de la tarjeta se define **una
sola vez**, en el componente Astro, y la island clona un `<template>` para las
tarjetas que no están en el HTML (las pasadas).

**Ojo:** todas las fechas se formatean con
`Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })`,
en el build y en el cliente. El JSON las lleva en UTC (trampa 1).

### B-106 · `events.json` en build time

Lectura de Firestore con el Admin SDK, `toPublic.ts`, y el índice que la island
filtra en memoria (§2.4, §2.5). Incluye las opciones de `/opciones/*` en el
mismo archivo (§4.4) para que los chips no tengan nada cableado.

Tres cosas que no son obvias (§3 del diseño):

- **El JSON recorta más que `toPublic`**: no lleva `descripcion`,
  `inscripcion.destino`, `sede.direccion`, `sede.geo`, `sede.indicaciones`,
  `material`, `tallerista.bio`, `sesiones[].tema` ni `sesiones[].lectura`. Nada
  de eso se usa para filtrar, todo vive en el HTML del detalle, y sacar el mail
  de inscripción del JSON deja de servirlo en lote a los bots.
- **Sin credenciales, en CI el build falla** (`hayCredenciales()`). Un deploy
  con cero actividades borra el sitio de Google y se recupera en semanas. En
  local sigue con lista vacía.
- **Cabecera de cache `no-cache` para `/events.json`** → **cierra B-37**. La
  island lo pide con `?v={VERSION_APP}`.

### B-107 · Meta, Open Graph y JSON-LD

Va pegado a B-105: una página de detalle sin datos estructurados no sirve para
lo que existe el proyecto (§2.3).

- `title` / `description` / `canonical` por tipo de página (§5.1 del diseño). El
  título de la actividad primero, y el barrio adentro.
- Open Graph completo + `twitter:card`. Sin `imagenUrl`, cinco imágenes
  estáticas de 1200×630 en `public/og/`, una por tipo: un link sin preview en
  Instagram no se toca.
- **JSON-LD `Event`**: `EducationEvent` para taller y club de lectura,
  `LiteraryEvent` para encuentro, presentación y charla. Un ciclo es un
  `EventSeries` con un `subEvent` por sesión — una actividad, N encuentros
  (§2.2), no ocho eventos que compiten entre sí.
- **Fechas con offset `-03:00`**, no `Z`.
- **`offers` con precio solo si `arancel.tipo == 'gratis'`** (`0` / `ARS`). Un
  `0` en un taller arancelado es un dato falso en un formato que las máquinas
  creen.
- **El link de la reunión no va al JSON-LD nunca**, ni con `urlPublica: true`
  (D-15): `VirtualLocation.url` es la URL canónica de la actividad. El JSON-LD
  es lo primero que cosecha un bot (trampa 5).
- Además: `BreadcrumbList` en el detalle, `CollectionPage` + `ItemList` en la
  home y los hubs, `Organization` en `/acerca`.

### B-108 · Los hubs: `/tipo/*`, `/barrio/*`, `/online`, `/gratis`

Un solo componente de página con el subconjunto ya filtrado en HTML y la island
montada con el filtro preaplicado y visible como chip. Es lo que gana
`taller de escritura villa crespo` y `club de lectura online`: un filtro no
puede, porque no tiene URL ni `h1` (§2.1 del diseño).

Los de tipo y barrio se generan recorriendo `/opciones/{tipo,barrio}` — una
opción nueva trae su hub sola. El slug de la URL es el **slug** de la taxonomía,
nunca el label: el label se renombra (§4.1) y una URL no (trampa 10).

Un hub que se queda sin actividades vigentes **no se borra**: se genera vacío,
con aviso y links. Un 404 sobre una URL indexada es peor.

### B-109 · `site`, `robots.txt`, `sitemap.xml` y `/pasadas`

**Va primero de todo**, porque depende de la decisión del dominio (§11.1 del
diseño) y porque canonical, Open Graph y sitemap necesitan URLs absolutas.
`astro.config.mjs` hoy **no tiene `site`**.

El sitemap se genera a mano (endpoint estático), no con `@astrojs/sitemap`: las
reglas de qué entra —90 días para las pasadas, 30 para las canceladas, meses con
3 o más— son nuestras. `lastmod` necesita B-112; sin eso se omite, que es mejor
que estampar la fecha del build en todo.

`/pasadas` entra acá y no en B-108 porque su razón de ser es de indexación: sin
esa página, cada actividad que pasa se convierte en una página huérfana que solo
el sitemap enlaza.

### B-110 · Una actividad cancelada no puede devolver 404

Hoy el camino natural (`estado == 'publicado'`) hace que una actividad cancelada
pierda su página. La URL estuvo tres semanas en Instagram y en Google, y a quien
pregunta "¿se hace o no se hace?" el sitio le contesta "no existe".

Lo que hay que hacer (§7.3 del diseño): el build también trae
`estado == 'cancelado'`, genera la página con la franja `CANCELADA`, sin CTA, con
las fechas intactas y `eventStatus: EventCancelled` — que es exactamente lo que
Google pide. No entra al listado ni a `events.json`. Sale del sitemap a los 30
días.

**Solo si estuvo publicada alguna vez**, que hoy no es un dato del modelo. La
heurística disponible es que alguna sesión tenga `calendarEventId` (el sync solo
crea eventos de actividades publicadas), y el build la puede leer porque trabaja
sobre el documento crudo. Lo correcto es un `publicadaAlgunaVez: boolean` — es
una de las decisiones de §11.1.

### B-111 · `inscripcion.abierta` se congela en el build y miente

`toPublic` calcula `abierta` con `Date.now()` **del momento del build**. Una
inscripción que cerró a la mañana sigue diciendo "abierta" hasta el rebuild
siguiente, y con el rebuild automático todavía pendiente (**B-20**) eso puede
ser días. El sitio invita a anotarse en algo que ya cerró.

Arreglo: proyectar **`inscripcion.cierraEn`** (el ISO de `cierra`) además del
booleano. Con la fecha, el HTML puede decir "las inscripciones cierran el 22 de
septiembre" —que es lo que hace que alguien escriba hoy— y el cliente recalcula
si ya cerró. No expone nada nuevo: es una fecha que la página ya quiere mostrar.

Hoy no se nota porque no hay sitio público. Va antes de B-108 porque el detalle
ya lo necesita.

~~B-02 · Trigger de rebuild~~ → [cerrado](#cerrados), con pasos manuales
pendientes del dueño (ver arriba).

### B-83 · El rebuild del sitio cuelga del sync a Calendar — ✅ hecho (2026-08-24)

**Arreglado:** `marcarRebuild` pasó arriba de los dos cortes, con la condición
`huboCambioDeContenido(antes, despues)` — el mismo criterio del historial
(D-41), para que el write-back de la propia Function no pida un build por cada
sincronización (D-92).

`syncCalendar` marca `sistema/rebuild` en la **última** línea, después de dos
cortes tempranos: `if (ops.length === 0) return;` y `if (!CALENDAR_ID) return;`.
Consecuencia: un cambio que no altera el evento del calendario no pide rebuild y
el sitio público se queda con el dato viejo.

Los campos que salen al `events.json` (§5.2) y **no** entran al evento de
Calendar son `destacado`, `imagenUrl`, `searchText` y el `slug`. Así que tildar
"Destacar en la portada" o corregir la imagen de una actividad ya publicada no
se ve nunca en el sitio, hasta que alguien edite otra cosa. Es la trampa 8 del
§13 con otro disparador: ahí era olvidarse de `/opciones/*`, acá es que el
rebuild sea un efecto secundario del sync.

Segundo caso, el mismo agujero: sin `GOOGLE_CALENDAR_ID` configurado la Function
loguea el error y vuelve **antes** de marcar el rebuild, así que un proyecto sin
calendario no publica nada nunca.

El arreglo es mover `marcarRebuild` arriba de los dos cortes: el rebuild
corresponde porque la actividad cambió, no porque el calendario haya recibido
operaciones. Cuesta un build de más cuando el cambio es solo interno
(`difusion`), que al lado de esto es gratis — el debounce del §8 ya los junta.

Tests en [`tests/costuras.test.ts`](../tests/costuras.test.ts).

---

### B-167 · Galería de imágenes: una lista, con descripción, propias o de afuera

Pedido del dueño (2026-08-24): una actividad tiene una **lista** de imágenes,
cada una con descripción opcional; cada imagen puede ser una **URL de otro lado**
o un archivo que **subimos y alojamos nosotros**. Y **vista previa**, incluida en
el momento de pegar una URL.

Está en P1 y no en P2 por una razón de orden, no de urgencia: **el modelo pasa de
un campo a una lista**, y B-107 (Open Graph y JSON-LD) necesita exactamente una
imagen. Si la galería entra después del sitio público, se rehace la tarjeta, el
detalle, la proyección y el `events.json`. Entra antes de B-01, o se paga dos
veces.

#### El cambio de modelo, y la migración que no se ve

Hoy es `imagenUrl: string | null` y toca nueve archivos: `types/actividad.ts`,
`schema.ts`, `actividades.ts` (las dos conversiones), `toPublic.ts` (tipo y
proyección), `ActividadFormulario.tsx`, `analytics-eventos.ts` y un comentario de
`functions/index.js`.

Pasa a algo como `imagenes: [{ id, url, descripcion, origen: 'externa'|'propia',
storagePath?, ancho?, alto?, portada? }]`.

**Los ids se generan en el cliente, nunca por índice** — es la trampa 2 del §13,
la misma que costó el diff de sesiones: borrar la segunda imagen renumera todo y
cualquier cosa que compare por posición cree que cambiaron todas.

**El default de lectura es la parte que se olvida.** Los documentos que ya están
en producción tienen `imagenUrl` y no tienen `imagenes`. La lectura tiene que
convertir `imagenUrl` en una lista de un elemento marcada como portada, y hay que
decidir si se hace **al leer para siempre** (compatible, código que queda) o con
una **migración de una vez** (más limpio, pero es un script que escribe en
producción). Con el volumen actual la migración es de minutos.

#### Lo que aparece por primera vez: Firebase Storage

No hay Storage en el proyecto. `firebase.json` tiene `firestore` y `hosting`, y
nada más. Entra un producto nuevo, y con él:

- **`storage.rules`, que son un archivo aparte de `firestore.rules`.** Escritura
  solo con el claim `admin`, y ahí aplica D-05 tal cual: `request.auth.token.admin
  == true` es un **error de evaluación** cuando el claim no está, no `false`. Va
  `token.get('admin', false)`.
- **Un target de deploy que `scripts/que-deployar.sh` no conoce.** Hoy decide
  `hosting`, `functions` y `firestore`. Sin una regla nueva, un cambio en
  `storage.rules` se deploya nunca — y las reglas por defecto de Storage son
  abiertas o cerradas según cómo se cree el bucket, así que "nunca" es el peor de
  los dos casos. El script tiene 20 tests: la regla nueva va con los suyos.
- **`firebase/storage` en el bundle.** El corte de B-09/D-51 dejó la carga
  inicial de `/admin` en ~385 KB separando `firebase-client.ts` (app+auth) de
  `firestore-client.ts` (db). Meter el SDK de Storage en cualquiera de los dos lo
  deshace. Va en su propio módulo, cargado lazy junto con la sección de imágenes
  del formulario, y `tests/bundle-panel.test.ts` tiene que cubrirlo — importar
  desde el módulo equivocado ya deshizo este corte **tres veces** sin que nada
  fallara.
- **Validación del archivo, del lado de las reglas y no solo del cliente.** Tipo
  (`image/jpeg`, `png`, `webp`, `avif`) y tamaño máximo. **SVG no**: es un
  documento ejecutable, y si algún día se sirve por un rewrite de Hosting pasa a
  ser mismo origen que el panel.

#### EXIF: la privacidad que no está en el §5 y debería

Una foto de celular trae GPS. En este dominio eso es concreto: **muchos talleres
se dan en casas particulares**, y la lista es pública y scrapeable. Subir la foto
del living publica las coordenadas del living, aunque `sede.direccion` diga solo
el barrio.

Hay que **quitar el EXIF al subir**, y el lugar es del lado del servidor o en la
Function, no en el cliente (el cliente es lo que se puede saltear). Esto es una
fila nueva en la tabla del §5.1 de `CLAUDE.md` y en
[`07-seguridad.md`](07-seguridad.md).

#### La vista previa, que es la otra mitad del pedido

Pegar una URL y verla. Los casos que hay que resolver, porque son los que se
ven en la demo y no en el diseño:

- la URL no es una imagen (devuelve HTML) → mensaje, no un roto silencioso;
- la URL es `http://` y el panel es `https://` → contenido mixto, el navegador la
  bloquea y no se entiende por qué;
- la imagen tarda o no carga nunca → estado de carga y de error, con la URL
  igual guardable si el dueño insiste;
- el dominio de afuera puede caerse mañana → la vista previa es del momento de
  cargar, no una garantía. Vale detectar links muertos, pero como aviso.

**Y ojo con `astro:assets`.** El sitio público es SSG: una imagen remota no se
optimiza en build sin descargarla, y Astro exige declarar los dominios
permitidos (`image.domains` / `remotePatterns`) o el build se comporta distinto
de lo que se probó. Con URLs arbitrarias cargadas por un admin, la lista de
dominios no se puede enumerar de antemano — hay que decidir entre no optimizar
las externas, o descargarlas al build (que las convierte en propias por la
puerta de atrás).

#### Borrado y huérfanos

Quitar una imagen de la lista, o borrar la actividad, tiene que **borrar el
objeto de Storage**. Si no: archivos que nadie referencia, que siguen siendo
públicos y que se pagan.

Es exactamente la clase de **B-71** (un guardado que falla deja opciones
huérfanas en la taxonomía), y el orden correcto es el mismo que ahí: primero el
documento, después el archivo. Si falla el borrado del archivo queda basura
invisible; si falla al revés, el documento apunta a un archivo que no está.

Dos casos que lo complican y hay que resolver explícitamente:

- **Duplicar una actividad.** Si la copia comparte el `storagePath`, borrar una
  le rompe las imágenes a la otra. O se copian los objetos, o se cuentan las
  referencias.
- **Restaurar una versión (§12, B-40).** Una versión vieja referencia un archivo
  que quizá ya se borró. Restaurar tiene que decir qué imágenes no volvieron, en
  lugar de dejar la lista con agujeros.

#### El rebuild: esto ya fue un bug, con estos mismos campos

`functions/index.js` tiene el comentario: el rebuild del sitio colgaba del sync a
Calendar, así que **`destacado` e `imagenUrl` no llegaban nunca al sitio** —
porque no van al calendario y por lo tanto no había operaciones que lo
dispararan. Eso es **B-83**, ya arreglado.

Una galería es más de lo mismo y de manual: las imágenes no van a Google Calendar
(la API no tiene campo de imagen; el §7.4 arma solo `summary`, `description`,
`location` y las fechas). Así que hay que **verificar** que la lista entre por el
camino que B-83 dejó arreglado, y no asumirlo.

#### Los lugares que toca, para no descubrirlos de a uno

El criterio del skill `campo-nuevo` es que un campo del modelo toca once lugares
y los que se olvidan son siempre los mismos tres: **la proyección pública, el
default de lectura de los documentos que ya existen, y la ayuda**. Acá:

| Lugar | Qué |
|---|---|
| `types/actividad.ts` | la lista y el ítem |
| `schema.ts` | zod: URL válida, largo de la descripción, y **una sola portada** |
| `actividades.ts` | las dos conversiones, más el default de lectura de `imagenUrl` |
| `toPublic.ts` | §5.2 — qué campos de cada imagen se publican. `storagePath` **no** |
| `ActividadFormulario.tsx` | sección nueva: filas, orden, portada, subida, vista previa |
| `functions/` | borrado de objetos al borrar la actividad; quitar EXIF |
| `storage.rules` | archivo nuevo |
| `que-deployar.sh` | target nuevo + sus tests |
| `analytics-eventos.ts` | cuántas imágenes, propias vs externas — sin la URL |
| `ayuda.ts` / `novedades.ts` | se nota al usar el panel: va a los dos |
| `searchText` (§6) | decidir si la descripción entra. Recomendado **no**: infla el índice con texto que nadie busca |
| tests | la familia de fixtures del §2.2, con y sin imágenes, propias y externas |

#### Costo

Storage se paga por almacenamiento y por egreso, y una galería en un sitio
público indexado es egreso real. Hace falta al menos un tamaño derivado (una
miniatura para la tarjeta) en lugar de servir el original de 4 MB en un listado
de treinta actividades. Y el budget alert del §2.3 está puesto para Functions:
conviene revisarlo antes, no después de la factura.

### B-183 · «Guardar borrador» exige el formulario completo, así que no se puede guardar a medias

Reporte del dueño usando el panel (2026-08-25):

> No me deja GUARDAR BORRADOR si no completo todo. Tiene que ser más flexible el
> guardar borrador.

`actividadFormSchema` (`src/lib/schema.ts`) se valida **igual para borrador que
para publicado**: título, dirección web, descripción, un encuentro, el arancel
elegido, sede y dirección si es presencial, plataforma si es virtual, vía y
destino si requiere inscripción. La única regla que hoy distingue el estado es la
del slug `-copia`, que corre solo al publicar (trampa 10) — o sea que **el patrón
ya existe en el archivo**, aplicado a una regla sola.

**Por qué es P1 y no una molestia.** Un borrador es, por definición, lo que
todavía no está completo: es la mitad de la razón por la que el estado existe. Y
desde B-35 el panel avisa al salir con cambios sin guardar, así que el que carga
queda encerrado entre un aviso que le dice que va a perder el trabajo y un
guardado que no lo acepta. La salida es completar campos inventados o perder lo
cargado, y las dos terminan igual: la actividad no se carga, y la que no se carga
no se publica ni se indexa.

**La forma del arreglo.** Partir la validación en dos niveles sobre el mismo
schema, no en dos schemas:

- **Guardar borrador** — lo mínimo para que el documento exista y se pueda
  encontrar después en el listado: título no vacío, y el slug (que ya se genera
  solo desde el título mientras no esté publicado). Nada más.
- **Publicar** — todo lo de hoy, que es lo que hace que el sitio y el evento no
  publiquen algo a medias.

Los `superRefine` no cambian de contenido: cambian de condición, igual que la
regla del slug. Y los `sesiones`/`arancel`/`sede` obligatorios pasan a ser
obligatorios **al publicar**.

Dos cosas para no romper en el camino:

- **La barra de errores no debe mentir.** Hoy cuenta "campos a revisar" contra el
  schema único; si el borrador valida con menos, la barra tiene que seguir
  mostrando lo que va a faltar **para publicar**, o quien carga se va a
  encontrar el bloqueo recién al final. Que sea aviso, no bloqueo.
- **Lo que el modelo necesita para no corromperse sigue siendo obligatorio** en
  los dos niveles: los `id` de sesión (trampa 2) y que las fechas sean
  `Timestamp` (trampa 1). Eso no es "completar el formulario", es que el
  documento sea legible.

El sync a Calendar no se toca: ya borra los eventos de todo lo que no está
`publicado` (§7.3), así que un borrador más incompleto no llega a Calendar por
definición.
### B-184 · Cuando el guardado falla, la barra dice cuántos campos faltan pero no cuáles

Reporte del dueño usando el panel (2026-08-25):

> cuando no se pueda guardar y diga que faltan campos, siempre especificarlos

Hoy `BarraAcciones` muestra `«3 campos para revisar»` y nada más. Fue una
decisión escrita —listar las rutas de campo tapaba media pantalla en mobile, y el
detalle está en rojo al lado de cada campo— y **el reporte la da por equivocada**.
Con razón, y hay un motivo concreto que la decisión no tuvo en cuenta:

**las secciones «Material», «Opcional», «Difusión» y «Vista previa» arrancan
colapsadas.** Un campo rechazado adentro de un acordeón cerrado no se ve en
ninguna parte: el contador dice que hay tres, la pantalla muestra cero, y no hay
forma de saber dónde mirar salvo abrir todo y bajar. Eso no es un resumen
apretado, es un mensaje que no se puede accionar.

**La forma del arreglo**, que además resuelve lo que motivó la decisión original:

- Nombrar los campos, no las rutas del schema (`sede.direccion` → «Dirección»);
  ya hay vocabulario de UI para eso en `formulario/etiquetasUI.ts`.
- Con muchos, nombrar la **sección** y no cada campo: «Falta completar: Dónde
  (2), Arancel e inscripción (1)». Es corto en mobile y alcanza para saber a
  dónde ir.
- Que cada nombre **lleve al campo**: abrir la sección si está colapsada y
  scrollear hasta él. Es lo que cierra el agujero del acordeón.

Depende de **B-183**: mientras el borrador exija el formulario completo, el
mensaje va a listar campos que a quien está guardando a medias no le importan
todavía. Con los dos niveles de validación, el mensaje del borrador es la lista
corta y el de publicar es la larga. Se pueden hacer en cualquier orden, pero el
valor del mensaje bueno se cobra recién con B-183 hecho.

Ojo con el criterio de B-63: si se agrega el mensaje, el punto de la guía que hoy
dice «esa barra dice cuántos campos hay que revisar» queda mintiendo.

## P2 — mejoras reales

### B-112 · `estado` y `actualizadoEn` en la proyección pública

Dos campos que el sitio público necesita y `toPublic.ts` no lleva
([`12-sitio-publico.md`](12-sitio-publico.md) §11.2):

- **`estado`** (`'publicado' | 'cancelado'`) — sin esto el HTML no puede pintar
  la franja CANCELADA ni emitir `eventStatus`. Lo necesita B-110.
- **`actualizadoEn`** (ISO de `updatedAt`) — es el `lastmod` del sitemap y el
  "actualizado el …" del detalle. Sin él el sitemap va sin `lastmod`, que es
  mejor que estampar la fecha del build en todas las páginas: eso le enseña al
  buscador que nuestras fechas mienten.

Ninguno de los dos publica nada nuevo: son datos que la página ya muestra.

### B-113 · Páginas de mes — `/agenda/{aaaa-mm}`

"Qué hay este mes" es una forma real de mirar la agenda, pero la página es un
subconjunto de la home y la consulta es de volumen bajo. Por eso va acotada
(§2.2 del diseño): solo meses vigentes, solo con **3 o más** actividades, no en
la navegación, y cuando el mes termina la URL no se rompe —se emite una última
vez con aviso y link a `/pasadas`.

Un ciclo que cruza dos meses aparece en los dos, y en cada uno muestra las
fechas de ese mes. Es la misma tarjeta con el subtítulo recalculado.

### B-40 · UI para ver y restaurar versiones

### B-30 · Las respuestas del dueño no vuelven al panel

El reporte sale del panel y termina en un issue público, pero la conversación
sigue **solo en GitHub**: quien reportó ve el número de issue y el link, no la
respuesta. Si no tiene cuenta de GitHub a mano, se entera por otro canal.

Posible mejora: espejar los comentarios del issue de vuelta al documento
`/reportes/{id}` (un `onSchedule` que consulte los issues abiertos con la
etiqueta `reporte-panel`, o un webhook de GitHub hacia una función HTTP) y
mostrarlos en la pantalla de reportes. Con webhook hay que validar la firma
`X-Hub-Signature-256` con un secreto, que es otro secreto más en Secret Manager.

Mientras no exista, el formulario y la lista lo dicen con todas las letras.

### B-31 · Un reporte en `error` no se puede reintentar desde el panel — ✅ hecho (2026-08-24)

Si la creación del issue falla por configuración (token vencido, permiso, repo
mal escrito), el reporte queda guardado en estado `error` y visible en el panel,
pero no hay botón para reintentar: las reglas prohíben que el cliente toque el
documento (el ciclo de vida es de la Function). Hoy se reintenta a mano con el
Admin SDK — el comando está en [`08-operacion.md`](08-operacion.md).

Opciones: una acción del panel que escriba solo `estado: 'pendiente'` con una
regla que permita ese único cambio, o una función `onCall` de reintento.

**Cómo quedó: la primera opción, y no la `onCall`.** El disparador de la
publicación ya es una escritura en el documento —`estadoTrasFallo` reintenta
poniendo `estado: 'pendiente'` y eso vuelve a disparar el trigger—, así que el
botón hace lo mismo que la Function ya hace sola. Un `onCall` habría sido un
segundo camino, con su endpoint, su chequeo del claim a mano y su propia forma de
fallar, para el mismo efecto.

Un detalle que el ítem no decía y decide si el botón sirve: hay que resetear
**`intentos` a 0**, no solo el estado. `decidirAccion` ignora un reporte con los
tres intentos gastados, que es justamente el caso más común de un `error`.

La regla (`reintentoValido`) permite una sola transición y prohíbe explícitamente
tocar el texto —que es lo que va a un repo público—, reintentar algo `enviando` o
ya publicado, y borrar. Siete tests contra el emulador, en
`tests/reportes-reintento.integracion.test.ts`. Ver **D-101** y §7 de
[`07-seguridad.md`](07-seguridad.md).

### B-03 · Historial de versiones (§12)


El historial ya se guarda (B-03, §12), pero **no hay pantalla**: recuperar un
campo pisado es abrir la consola de Firestore, buscar la subcolección
`versiones` de la actividad, elegir un documento por su id (que es la fecha y
hora) y copiar el valor a mano al formulario.

**Sin UI el historial ya sirve, y por eso se cerró B-03 sin ella:** lo que no
tenía arreglo era que el dato *no existiera*. Ahora existe, y recuperarlo es
incómodo pero posible — y es una operación rara, que hace el dueño, no un
usuario. Cada versión guarda `camposCambiados`, así que se puede ver de un
pantallazo cuál abrir sin revisarlas de a una.

Lo que haría falta: una pestaña "Historial" en el formulario que liste las
versiones con fecha y qué campos pisó cada una, un diff contra el estado actual,
y un "restaurar este campo" (mejor que restaurar el documento entero: restaurar
todo pisaría cambios posteriores que sí se querían).

**Ojo al implementarlo:** restaurar es una escritura más al documento, así que
dispara `guardarVersion` y deja versión de lo restaurado. Eso es correcto —
deshacer un "deshacer" tiene que ser posible— pero conviene verificarlo.

### B-41 · Borrar una actividad no guarda versión y no hay nada que recuperar — ✅ hecho (2026-08-24)

**Arreglado** con la primera opción: `guardarVersionAlBorrar`
(`onDocumentDeleted`) guarda el documento completo con `borrado: true`, por el
mismo camino que el trigger de edición. El borrado lógico se descartó con motivo
(D-94). La subcolección sigue quedando huérfana, que es lo que ya reportaba
**B-89**: es el precio de que el borrado sea recuperable.

`guardarVersion` es un `onDocumentUpdated`, así que no se dispara al borrar
(§12: es lo que pide el documento). El panel borra por fila, sin papelera: se va
la actividad y con ella su subcolección de versiones queda huérfana e
inalcanzable desde la UI.

Es el único agujero de pérdida de datos que queda. Un borrado es más
deliberado que pisar un campo sin darse cuenta —hay que apretar borrar y
confirmar— así que es menos urgente, pero es irreversible.

Opciones: un `onDocumentDeleted` que guarde la última versión (queda huérfana
igual, hay que decidir dónde), o borrado lógico (`estado: 'borrado'` y filtrarlo
del listado), que además resolvería el "lo borré sin querer" sin tocar el
historial. Lo segundo es más trabajo y toca el listado y las reglas.

### B-04 · Renombrar una etiqueta no actualiza los eventos ya creados — ✅ hecho (2026-08-24)

**Arreglado** con la primera opción: `rebuildPorOpciones` re-sincroniza los
eventos de las actividades publicadas cuando cambia una etiqueta (D-93), con la
guarda de que subir `usos` no cuenta como renombre y con un tope de 150 eventos
por corrida.

La descripción del evento muestra la etiqueta, no el slug (D-11). Si se renombra
"A la gorra", los eventos existentes siguen diciendo lo anterior hasta la
próxima edición de la actividad.

`rebuildPorOpciones` solo marca el rebuild del sitio. Opciones: re-sincronizar
las actividades publicadas cuando cambia `/opciones/*`, o aceptarlo y
documentarlo (ya está documentado).

### B-05 · Las etiquetas de taxonomía se ven en público sin normalizar — ✅ hecho (2026-08-24)

**Arreglado** con la primera opción **y** la segunda: `upsertOpcion` guarda el
label con `etiquetaPresentable` —espacios colapsados y primera letra en
mayúscula, sin tocar el resto (D-101)— y lo que ya está cargado mal se corrige
renombrando desde la pantalla de B-06. Solo la primera letra: bajar el resto
rompería "Villa Crespo", subir cada palabra rompería "Club de lectura".


Un tag creado como "narrativa" (minúscula) aparece así en el calendario público
y va a aparecer en los filtros del sitio. Ya pasó: `/opciones/tags` tiene
`narrativa="narrativa"`.

Opciones: capitalizar la primera letra al crear, o una UI para editar etiquetas
(el §4.3 dice que las creadas con "Otro" son editables y borrables — esa UI no
existe).

### B-06 · No hay UI para administrar taxonomías — ✅ hecho (2026-08-24)

**Hecho:** `src/components/admin/taxonomias/TaxonomiasPanel.tsx` — las cinco
listas con `usos` y estado, y renombrar / borrar / aprobar por fila (D-102).
Renombrar no toca el slug (§4.1); borrar no toca las actividades, que siguen
mostrando el des-slug de D-11, y por eso se confirma aparte cuando la opción está
en uso. Las base no ofrecen acciones y la guarda vive en la transacción, no en la
UI.

**Falta montarla en el router del panel: B-170.** El componente es
autocontenido; la línea que falta es en `AdminApp.tsx`.


El §4.3 dice que las opciones creadas con "Otro" son editables y borrables, y que
`usos` sirve para detectar basura ("una opción con `usos: 1` creada hace meses es
casi seguro un typo colgado"). No hay pantalla para nada de eso.

### B-07 · ~~El formulario no captura `sede.geo`~~ · ✅ hecho

El formulario captura las coordenadas pegando el link de Google Maps del lugar
o un par `lat, lng` (D-46). Sin geocoding: es una API paga y el budget es de
USD 5/mes.

**Queda afuera a propósito** el link corto `maps.app.goo.gl` (redirect + CORS):
el campo lo detecta y explica cómo salir del paso. Anotado en B-45.

### B-08 · Sin tests de componentes

No hay testing-library instalada. La lógica pura está muy cubierta (460 tests),
pero el render y la interacción del formulario se verificaron a mano.

Vale al menos para `TaxonomiaSelect` (el bug del placeholder que se veía como
opción elegida habría salido en un test de render), para el editor de sesiones y
para el `MenuAcciones` del listado (cierre por click afuera y por `Escape`) y
para `VistaPreviaEvento`: su adaptador está testeado, pero que el aviso del
link público se muestre —y que la descripción tenga su propio scroll— se
verificó a mano.

### B-09 · El bundle del panel pesa 576 KB — ✅ hecho (2026-08-21)

La carga inicial de `/admin` bajó de **766 kB a 353 kB** (gzip 200 → 95): la
pantalla de login ya no baja el SDK de Firestore. `db()` se mudó a
`src/lib/firestore-client.ts` y `AdminApp` carga el listado y el formulario con
`import()` diferido. Ver [CHANGELOG](CHANGELOG.md) y D-51.

Quedó afuera, a propósito: imports más finos del SDK (el modular v11 ya
tree-shakea bien — el chunk de auth son 166 kB y no entra nada de Firestore) y
`manualChunks` en `astro.config.mjs` (no cambia lo que el navegador necesita
para el primer render).

### B-50 · Verificar el corte del bundle después de mergear analytics — ✅ hecho (2026-08-24)

Verificado, y de una forma que no hay que repetir: `tests/bundle-panel.test.ts`
recorre el grafo de imports desde la island y afirma que `firebase/analytics`
—igual que `firebase/firestore`— no es alcanzable siguiendo solo imports
estáticos. El único import del SDK de analytics del proyecto es el `import()`
dinámico de `src/lib/analytics.ts`.

Un test vale más que el `npm run build` de una vez que pedía el ítem: la
pregunta vuelve a hacerse sola en cada corrida. Ver B-117 y D-100.

### B-35 · Salir del panel con cambios sin guardar no avisa — ✅ hecho (2026-08-24)

El store de `formulario-sucio.ts` ya sabe que hay cambios pendientes, y el aviso
de versión nueva lo usa. Pero cerrar la pestaña, volver a la lista o tocar
"Cancelar" sigue descartando el formulario sin preguntar.

Con el dato ya disponible es un `beforeunload` y una confirmación en el botón de
volver. Queda fuera de este cambio porque toca el flujo del formulario, no el de
versiones.

**Cómo quedó.** El `beforeunload` para cerrar la pestaña, y un `confirm()` con
texto propio en las cuatro salidas que el panel sí controla: "← Volver",
"Reportar algo", "Salir" y el "Cancelar" del formulario. "Calendario" no lo
necesita porque solo se ofrece desde el listado.

La regla de cuándo preguntar salió a `src/lib/salida-del-panel.ts` (pura, con
test) y en `AdminApp` quedó un solo `salirDe(accion)` que envuelve a las cuatro:
una salida nueva se escribe con esa forma, así que no puede olvidarse del aviso.
Ver **D-100**.

### B-36 · La versión no distingue dos builds sucios del mismo commit — ❌ descartado (2026-08-24)

`+a1b2c3d-sucio.20260821-2129` lleva sello de tiempo, así que dos builds sucios
distintos ya se ven distintos. Lo que no se puede saber es **qué** cambió.

**Se descarta, con tres motivos:**

1. **Un hash del diff no contesta la pregunta.** Diría si dos builds sucios
   salieron del mismo árbol, no qué tenían de distinto. Para eso hace falta el
   diff, y quien buildeó sucio lo tiene en su disco.
2. **Producción no puede salir de un árbol sucio.** El job de deploy de
   `.github/workflows/push-main.yml` corta con `::error::` si la versión del
   build contiene `-sucio` o `sin-git`, así que el formato con sello de tiempo
   es dev-only por construcción. Un ítem que solo aplica a builds que nunca se
   publican no vale su costo.
3. **No es la línea que parece.** Un hash fiel tendría que cubrir también los
   archivos sin trackear (`git diff HEAD` no los ve, `status --porcelain` sí),
   o sea decidir qué entra al hash y mantener esa decisión.

Lo que sí tenía valor de esta zona ya se hizo: hasta **B-88** un build sucio
mandaba `version: otro` a la analítica, y ahora la versión sucia viaja entera y
con su sello. Distinguir dos builds sucios *entre sí* ya funciona; explicar en
qué se diferencian no es trabajo de una cadena de versión.

### B-37 · `/events.json` va a necesitar su propia cabecera de cache

Las cabeceras de `firebase.json` cubren el HTML, `/version.json` y
`dist/_astro/*`. El `events.json` del sitio público (B-01) todavía no existe:
cuando exista hay que decidir su cache — no lleva hash en el nombre y cambia en
cada rebuild, así que probablemente `no-cache` o un `max-age` corto.

### B-55 · Instrumentar el pegado de coordenadas de la sede

El vocabulario ya está: `funcion_usada` acepta `coordenadas-pegar` y
`coordenadas-fallo`, con `detalle` en `coord-link-corto`,
`coord-sin-coordenadas`, `coord-coma-decimal` y `coord-formato`
([`09-analitica.md`](09-analitica.md)). Falta **una línea por rama** en
`src/components/admin/CoordenadasSede.tsx`, que se mergeó después de escribir la
instrumentación.

Vale la pena porque decide el arreglo: si el 80% de los fallos es un link corto,
lo que hay que hacer es resolverlos, no explicar mejor el campo.

### B-56 · Enchufar `registrarVersion(VERSION_APP)` — ✅ hecho

Lo enchufó el merge del 2026-08-21: `src/components/admin/AdminApp.tsx` llama
`registrarVersion(VERSION_APP)` en el efecto de montaje, **antes** de
`medirPanelAbierto()`, así que el primer evento ya viaja con `version`.

Verificado al cerrar B-88, que es lo que esto destapó: hasta ese arreglo el
parámetro llegaba, pero como `otro` en cualquier build sucio. Lo único que queda
es confirmarlo en GA4 (DebugView), que es un paso de consola del dueño.

**B-92 y B-118 son la misma observación sobre esta entrada, duplicada**: las dos
decían que B-56 estaba desactualizado. Quedan cerradas con esto.

---

### B-62 · Ayuda contextual por sección del formulario

La guía (B-60) se abre desde el encabezado y muestra desplegado el capítulo de
la pantalla en la que estás, pero no hay un "?" al lado del título de cada
sección del formulario, que es donde más apuntaría: la duda aparece mirando
"Difusión", no pensando en abrir la ayuda.

El mecanismo ya está: cada capítulo declara a qué sección del formulario
corresponde (`seccionFormulario` en `src/lib/ayuda.ts`), así que falta un botón
en `Seccion` y pasarle el id en las nueve secciones. No se hizo de entrada para
no tocar `ActividadFormulario.tsx` en nueve lugares mientras varias manos lo
estaban editando (D-61).

### B-63 · Nada verifica que la guía siga diciendo la verdad

`tests/ayuda.test.ts` verifica que **exista** un capítulo por sección del
formulario, que los seis avisos irreversibles estén y que el texto no tenga
jerga. Lo que ningún test puede ver es que el texto siga siendo **cierto**: si
mañana cancelar un encuentro deja de borrar el evento, la guía va a seguir
diciendo que lo borra y nada va a fallar.

Hoy eso lo sostiene la regla de proceso de [`05-patrones.md`](05-patrones.md).
Opciones si alcanza para más: repasar la guía cada vez que se toca el sync o el
formulario (barato, se olvida), o atar cada aviso a un test de comportamiento
existente y nombrarlo en el aviso, para que borrar el test rompa el vínculo.

**Una ayuda que miente es peor que no tener ayuda**, así que si la lista de
avisos crece, este ítem sube de prioridad.

### B-95 · El texto para publicar en redes

`difusion.arrobar` es el único campo del §3.1 que se carga y **no se usa para
nada**: se guarda y ahí muere. Mientras tanto, cada actividad se vuelve a
escribir a mano en Instagram, con la hora y el arancel copiados de mirar el panel
en otra pestaña.

Una sección colapsada del formulario, del mismo tipo que la vista previa del
evento, con el texto listo para pegar y un botón de copiar: título, fechas,
modalidad y barrio, arancel con notas, cómo se inscribe, y al final los handles
de `arrobar` + `organizador.instagram` + `tallerista.instagram`, deduplicados.
Dos variantes: "anuncio" (el ciclo entero) y "recordatorio" (el próximo
encuentro, con su tema y su lectura).

**No toca el modelo, ni las reglas, ni las Functions, ni el sitio:** una función
pura (`src/lib/textoRedes.ts`) y un componente. El link de la reunión no va nunca
(§5.1); `arrobar` sí, que es su lugar.

Decisión del dueño: si el texto lleva el link a la página de la actividad
—hoy no existe—. Conviene decidirlo antes para no cambiar el formato después.
Razonamiento y contra en [`11-ideas-de-producto.md`](11-ideas-de-producto.md).

### B-96 · "Esta semana" arriba del listado — ✅ hecho (2026-08-24)

El listado está ordenado por última modificación, así que arriba está lo que
tocaste, no lo que se viene. Con dos personas cargando, nadie tiene el panorama:
el club de lectura es mañana y la lectura no se cargó, o la inscripción cierra
hoy y la actividad sigue en borrador.

Un bloque chico arriba del listado con tres cosas: encuentros de los próximos 7
días, inscripciones que cierran en los próximos 3, y **borradores cuyo primer
encuentro es en menos de una semana** —el olvido caro, porque después de la fecha
no tiene arreglo—.

El listado ya trae todas las actividades a memoria (`listarActividades`): es una
función pura sobre lo que ya está cargado, cero lecturas nuevas. **Que no se
dibuje cuando no tiene nada que decir**, así que estar visible ya es
información.

### B-97 · `inscripcion.completo` — poder decir que se llenó

Después de publicar no hay forma de decir nada. El taller se llenó, la gente
sigue mandando DM, y el sitio y el calendario siguen mostrando "cupo: 12" porque
`inscripcion.cupo` se carga una vez y no se vuelve a mirar.

Un booleano `inscripcion.completo` (**campo nuevo en `inscripcion` del §3.1**),
que se prende **desde el menú "⋯" del listado**, no desde el formulario: un toque
desde el teléfono, sin abrir 30+ campos. De ahí sale el cartel en el sitio (con
B-01), y la línea en la descripción del evento — así **quien ya estaba suscripto
al calendario se entera sin que nadie le avise**.

Toca: `types/actividad.ts`, `schema.ts`, `actividades.ts`, `toPublic.ts`,
`construirDescripcion` de `functions/calendario.js`, el menú del listado, y el
sitio cuando exista. Una línea o dos en cada uno.

**Ojo:** cambiar la descripción actualiza los N eventos del ciclo. Es lo
correcto y la guarda del §7.1 lo maneja (D-07), pero verlo en emuladores antes de
creerlo.

Conviene antes de B-01 para que el `events.json` nazca con el campo. Decisiones
del dueño: booleano o contador (recomendado el booleano: un contador se
desactualiza con cada inscripción, no solo con la última), y si "completo"
esconde el botón de inscripción en el sitio (recomendado que no: siempre hay
lista de espera).

### B-98 · Cancelar un encuentro sin que desaparezca en silencio

**Contradice el §7.3 del `CLAUDE.md` y la guía del panel.** Necesita decisión del
dueño antes de tocar nada.

Hoy `sesion.cancelada === true` **borra** el evento. Quien tenía ese jueves
agendado, con su recordatorio, ve el evento desaparecer sin ningún aviso. Es
justo el momento en que un calendario público vale más —es la única vez que el
dato cambió *después* de que la gente lo guardó— y el sistema elige no decirlo. Y
no hay dónde escribir por qué: "se pasa al jueves que viene" y "se cancela por
falta de inscriptos" se ven igual, como un hueco.

Propuesta: `sesion.motivoCancelacion: string | null`, y que un encuentro
cancelado **actualice** su evento en vez de borrarlo (`CANCELADO — ` en el título,
el motivo arriba de la descripción). Lo que no cambia: pasar la actividad a
borrador/pendiente/cancelada sigue borrando todo, y **borrar** el encuentro sigue
borrando su evento. La distinción es esa: cancelar es un anuncio, borrar es una
corrección.

Más barato de lo que parece: todo vive en `debeExistir` y `construirEvento`, dos
funciones puras ya exportadas y con tests, y la vista previa del panel las
importa (D-20), así que el panel lo muestra sin una línea de UI.

**No es solo código:** el aviso `cancelar-encuentro` de `src/lib/ayuda.ts` pasa a
mentir, y es uno de los seis avisos de lo que no se puede deshacer. Es
exactamente el escenario de **B-63** — se actualiza en el mismo commit o no se
hace.

Va después de B-01 (toca la parte más frágil, §7 y §10 avisan), pero **decidirlo
antes**: si el sitio nace sabiendo que una sesión cancelada tiene motivo, la
página de detalle lo muestra de entrada.

Segunda decisión, menor: si un evento cancelado se borra cuando su fecha ya pasó
o queda como registro (recomendado: queda).

### B-99 · El `events.json` necesita un eje de encuentros, no solo de actividades

Parte de **B-01**, anotado para que no se pierda al escribir el generador.

El modelo es centrado en la actividad y está bien (§2.2): un club de 8 encuentros
es una tarjeta. Pero la pregunta que se le hace a una agenda es "¿qué hay el
sábado?", que es centrada en el encuentro — y con tarjetas por actividad hay que
abrir todas para saberlo.

No hace falta cambiar el modelo: que el `events.json` lleve **también** un índice
plano de encuentros próximos (fecha, id de sesión, slug), derivado en build time,
para que la island ofrezca "este fin de semana" sin aplanar los ciclos en el
navegador en cada filtrado. Es barato al escribir el generador y caro después.

### B-70 · Sacar la lógica de dominio de `ActividadFormulario.tsx` — ✅ hecho (2026-08-24)

El archivo tiene 858 LOC, de las cuales **227 son lógica** y el resto JSX. Esas
227 incluyen reglas del modelo que ningún test puede ejecutar, porque están en un
`.tsx` y no hay testing-library (B-08):

| Bloque | Líneas | Qué codifica |
|---|---|---|
| `formVacio()` | 49-69 | el documento por defecto del §3.1 |
| `cambiarTipo` | 144-156 | "club de lectura ⇒ es ciclo y tiene material" (§2.2, §11) |
| `cambiarModalidad` | 158-176 | "virtual ⇒ `sede = null`", "presencial ⇒ `online = null`" |
| `labelsPendientes` | 188-198 | buffer de etiquetas sin persistir (D-02) |
| `guardar()` | 200-256 | el caso de uso completo de guardado |

Si un cambio futuro invierte uno de esos condicionales, `npm test` pasa entero.

Extraer las cascadas y `formVacio` a un módulo puro (~90 LOC) se testea como
`tests/duplicar.test.ts`, sin emuladores. `guardar()` a un módulo de caso de uso
(~60 LOC) se testea como `tests/actividades.integracion.test.ts`. Es refactor
mecánico, sin cambio de comportamiento: el archivo baja a ~250 LOC y ~150 pasan a
ser testeables. Medida completa en
[`10-salud-del-codigo.md`](10-salud-del-codigo.md).

**Hecho.** Quedaron cinco módulos en `src/lib/formulario/`: `estadoInicial.ts`
(`formVacio` y los sub-objetos que crean y destruyen las cascadas),
`cascadas.ts` (las tres del §11), `condicionales.ts` (qué partes del formulario
aplican, que además tienen que coincidir con lo que el schema exige),
`etiquetas.ts` (el buffer de D-02) y `guardar.ts` (el caso de uso, con las
escrituras como puertos — D-102). Los cubre
[`tests/formulario-dominio.test.ts`](../tests/formulario-dominio.test.ts).

Con la lógica afuera y el JSX partido (B-79), `ActividadFormulario.tsx` quedó en
~230 LOC. Dos bugs que vivían en esa lógica salieron en el mismo cambio: **B-71**
y **B-87**.

### B-71 · Un guardado que falla deja opciones de taxonomía huérfanas — ✅ hecho (2026-08-24)

`guardar()` persiste las etiquetas nuevas en `/opciones/*` (líneas 237 y 240)
**antes** de escribir la actividad (líneas 244-245). Si la escritura falla —red,
permisos, slug que se tomó entre el chequeo y el write— las opciones ya se
crearon y quedan colgadas en el desplegable.

Es una versión parcial de lo que D-02 quiso evitar ("abandonar el formulario no
debería dejar basura en la taxonomía"), y hoy no hay nada que lo note: ningún
test lo cubre y no hay UI para limpiar taxonomías (B-06). Se limpia a mano con
`npm run opciones:aprobar` mirando la lista, o no se limpia.

Arreglo: invertir el orden —escribir la actividad primero y las opciones
después— o mover las dos cosas a la misma transacción. Lo primero es más simple
y deja el caso peor en "la etiqueta no se registró para la próxima vez", que es
recuperable tipeándola otra vez. Sale con B-70, cuando `guardar()` deje de estar
dentro del componente.

### B-72 · La deduplicación §4.2 del cliente está implementada dos veces — ✅ hecho (2026-08-24)

**Arreglado** como decía el ítem: `src/lib/taxonomia.ts`, puro, con
`sugerenciasPara`, `resolverEtiqueta`, `pistaDeOpcion` y `etiquetaConEstado`, y
los dos componentes llamándolas (D-100). 27 tests en `tests/taxonomia.test.ts`,
incluida una guardia de que la copia no vuelva a nacer. Los componentes no se
unificaron, y las dos diferencias que quedan (tope y qué mostrar con el input
vacío) son ahora parámetros con motivo escrito.

**Resuelto así (D-100):** se invirtió el orden, en
`src/lib/formulario/guardar.ts` — el caso de uso que B-70 sacó del componente.
Verificado el modo de falla que queda: el evento público resuelve la etiqueta no
registrada con el des-slug de D-11, o sea "Con Beca Parcial" en lugar de "Con
beca parcial". Un fallo al registrar la etiqueta ya no vuelve fallido el
guardado (la actividad está escrita; reintentar chocaría contra su propio slug).
El `it.fails` de la clase en `tests/clases-de-bug.test.ts` quedó promovido a
`it`, y el orden se afirma además con puertos falsos en
`tests/formulario-dominio.test.ts`. Quedan abiertos **B-167** (nadie avisa en
pantalla que la etiqueta no se registró) y **B-168** (el desplegable muestra el
slug crudo de una etiqueta no registrada).

### B-73 · Los tags no se miden — ✅ hecho (2026-08-24)

**Arreglado:** `TagsInput` emite `taxonomia-nueva`, `taxonomia-reusada` y
`taxonomia-sugerencia` con `detalle: 'tags'`. `taxonomia-otro` **no** se emite y
no es un olvido: no hay modo "Otro" que abrir en un input de chips (D-105, y
queda escrito en `09-analitica.md` para que su ausencia no se lea como un bug).


`CAMPOS_TAXONOMIA_MEDIBLES` (`src/lib/analytics-eventos.ts:134`) declara `'tags'`
como valor válido de `detalle` para `taxonomia-otro`, `taxonomia-nueva`,
`taxonomia-reusada` y `taxonomia-sugerencia`. Pero `TagsInput.tsx` **no llama a
`medirFuncion` en ningún lado**: ese valor no puede aparecer en GA4.

O sea que el campo de taxonomía con más volumen esperado es el único invisible en
la analítica de taxonomías, y el vocabulario declara algo que el código no puede
producir. Cuatro llamadas a `medirFuncion`, en los mismos puntos donde
`TaxonomiaSelect` ya las tiene (líneas 104, 182, 208). Sale gratis junto con
B-72, que es cuando esos puntos quedan compartidos.

Distinto de B-58: eso es "dos interacciones sin medir por no tocar el JSX", esto
es un campo entero.

### B-74 · `crearIssue` no tiene timeout y puede colgar el trigger de reportes — ✅ hecho (2026-08-24)

**Arreglado:** las dos llamadas a GitHub abortan a los 15 s, y
`tests/reportes.test.ts` lo verifica en los dos archivos a la vez para que no se
pueda volver a perder en una copia.

`functions/index.js:230` define `TIMEOUT_DISPATCH_MS` con el comentario "Sin esto
un socket colgado se come el tick entero", y lo usa con `AbortSignal.timeout` en
`dispararDispatch`.

`functions/reportes-trigger.js` copió las cinco cabeceras de esa llamada
(líneas 66-71 ≡ `index.js:242-247`) **pero no el timeout**: no tiene ningún
`AbortSignal`. Un socket colgado contra la API de GitHub deja la invocación
corriendo hasta el timeout de la plataforma.

Son dos líneas. Y es el ejemplo de por qué B-77 vale: el conocimiento estaba
escrito, en una sola de las dos copias.

### B-75 · Tres enums del modelo están copiados en `analytics-eventos.ts` sin guardia — ✅ hecho (2026-08-24)

`ESTADOS_DESTINO`, `MODALIDADES_MEDIBLES` y `CAMPOS_TAXONOMIA_MEDIBLES` eran
copias literales de `ESTADOS`, `MODALIDADES` y `CAMPOS_TAXONOMIA` de
`src/types/actividad.ts`. Sin guardia, un quinto `estado` o un sexto campo con
taxonomía se reportaba como `'otro'` en silencio.

Ahora son **el mismo objeto**, y la guardia es la identidad: el test compara
referencias (`toBe`), así que volver a escribir la lista al lado del import falla
aunque los valores coincidan ese día. Un segundo test verifica que cada valor del
modelo llegue entero al payload, no solo al vocabulario.

**Verificado con el build**, que era la duda: `@/types/actividad` tiene fan-out 0,
así que zod (53.015 B, chunk `types.*`) sigue fuera de la carga inicial y sin
moverse. La carga inicial de `/admin` pasó de **386.088 a 386.291 bytes** (+203 B,
+0,05 %; gzip 107.490 → 107.597, +107 B), los mismos 4 chunks y ningún
`modulepreload` nuevo. La suma de **todos** los chunks bajó 101 bytes: los arrays
de literales dejaron de estar duplicados en el chunk de `duplicar`.

Ver [CHANGELOG](CHANGELOG.md) y **D-98**.

### B-76 · El listado muestra el estado en slug crudo — ✅ hecho (2026-08-24)

`ListaActividades.tsx:124` renderiza `{a.estado}`, así que la píldora dice
"borrador" y "publicado" en minúscula, mientras el formulario dice "Borrador" y
"Publicado" (`ETIQUETA_ESTADO`). Es la misma actividad en dos pantallas con dos
escrituras.

Pasa porque el vocabulario de etiquetas es local al formulario. Un
`src/lib/etiquetas.ts` de ~20 LOC con los tres mapas (`estado`, `modalidad`,
`via`) que usen el formulario y el listado lo cierra.

**Dónde están hoy:** B-79 los sacó del `.tsx` a
`src/components/admin/formulario/etiquetasUI.ts`, porque los comparten varias
secciones. Son esos tres los que hay que mudar a `src/lib/etiquetas.ts`; la
mudanza toca los archivos del formulario, así que conviene hacerla desde este
frente y no desde el del listado.

**No incluir los mapas `ETIQUETA_*` de `functions/calendario.js`**: esos son
prosa para el evento público ("Presencial y virtual", "por DM de Instagram"), no
etiquetas de UI. Unificarlos haría que un cambio de copy del panel cambie lo que
se publica en el calendario.


**Cómo quedó.** La píldora del listado usa `ETIQUETA_ESTADO`, que vive en
`src/lib/filtrosActividades.ts` desde la vista calendario: el síntoma —la misma
actividad escrita de dos maneras en dos pantallas— está cerrado, y
`tests/etiquetas-de-ui.test.ts` lo fija.

Lo que **no** se hizo: el `src/lib/etiquetas.ts` que propone el ítem. Los mapas
del formulario (`ETIQUETA_ESTADO`, `ETIQUETA_MODALIDAD`, `ETIQUETA_VIA`) siguen
siendo locales, así que la clase está viva y ya divergió una vez —"Híbrido"
contra "Presencial y virtual"—. Unificarlos toca `ActividadFormulario.tsx`, que
es de la fase 2: queda en **B-167**, con el `it.fails` que lo espera.

### B-84 · Cancelar un encuentro de un ciclo renumera y reescribe los otros siete — ✅ hecho (2026-08-24)

`posicionEnCiclo` numera sobre las sesiones **no canceladas**, así que cancelar
el tercero de ocho convierte al sexto en "Encuentro 5 de 7" en el calendario
público. Dos costos:

- **Renumera.** Quien ya tenía "Encuentro 6 de 8" agendado ve cómo se le
  renombra el evento, y el número deja de coincidir con la lectura asignada de
  esa fila del formulario.
- **Siete escrituras de más.** El §7.2 existe para reflejar los cambios sin
  tocar lo que no cambió, y una cancelación toca ocho eventos.

`calendario.test.ts` tiene "cancelar un encuentro borra solo el suyo" y pasa: su
fixture no es un ciclo. En un ciclo —el caso del §2.2, que es el motivo de que
las sesiones sean un array— el invariante no vale.

Lo que hay que decidir es qué significa el número. Lo más barato y lo que menos
sorprende: numerar sobre **todas** las sesiones (el sexto sigue siendo el sexto,
y el total sigue siendo ocho), y que el cancelado simplemente no tenga evento.

Test en [`tests/costuras.test.ts`](../tests/costuras.test.ts), con lo que hace
hoy escrito al lado para que el cambio se note.

### B-85 · El debounce del rebuild se come el cambio que llega mientras dispara — ✅ hecho (2026-08-24)

**Arreglado** con la primera de las dos opciones de abajo: `registrarExito`
compara la marca `actualizado` que el tick leyó contra la que hay al escribir, y
la escritura va en transacción (así la comparación no tiene su propia ventana).
Si la marca cambió, `pendiente` queda en `true` y el próximo tick dispara otro
build; los reintentos igual se resetean, porque el disparo salió bien.

**Resuelto así** (D-95): se numera sobre **todas** las sesiones, canceladas
incluidas. El número es la identidad del encuentro dentro del ciclo —qué lectura
le toca, qué fila del formulario es—, no un recuento en vivo de los que siguen en
pie; y es el criterio que el panel ya usaba para el "2 de 8" de la vista
calendario (D-70), que hasta ahora decía "6 de 8" mientras el evento público
decía "5 de 7". Cancelar toca ahora **un solo** evento. El total sigue diciendo
ocho y en la serie queda un hueco: es cómo un suscripto ve que ese día se
canceló.

El test de `calendario.test.ts` que pasaba con el invariante roto —"cancelar un
encuentro borra solo el suyo"— corre ahora sobre un ciclo de verdad, y hay un
test en `costuras.test.ts` que **ata** la numeración del panel con la del evento
publicado. Quedan abiertos **B-160** (el residual: agregar o borrar una fila sí
renumera, por diseño) y **B-161** (los fixtures que siguen sin ser un ciclo).

### B-86 · `usos` solo cuenta creaciones, así que el orden por frecuencia no funciona · parcial

**La operación está hecha (2026-08-24), el cableado no.** `registrarUsos(campo,
slugs)` en `src/lib/opciones.ts`: una transacción por campo, ignora los slugs que
no existen y no cuenta dos veces el mismo slug (D-103).

Llamarla es una línea en `guardar()`, que vive en `ActividadFormulario.tsx` —de
otro frente del plan de saneamiento—, así que quedó anotado como **B-168** con el
orden exacto para no contar doble.


El §4.3 le da dos trabajos a `usos`: ordenar el desplegable por frecuencia real
—"mejor que alfabético"— y detectar basura ("una opción con `usos: 1` creada
hace meses es casi seguro un typo colgado").

`upsertOpcion` sabe sumar el uso de una opción existente, pero el submit del
formulario solo lo llama para las etiquetas tipeadas en "Otro" (`labelsNuevos`,
`tagsNuevos`). Elegir una opción del desplegable no registra nada. Resultado:
todas las opciones creadas se quedan clavadas en `usos: 1` para siempre y las
base en `0`, así que `ordenarValores` ordena por etiqueta y la señal de basura no
distingue el typo del barrio que se usa todas las semanas.

Es una línea en `guardar()` —registrar el uso de los slugs elegidos, no solo de
los nuevos— más cuidado con no sumar dos veces cuando la etiqueta es nueva
(`upsertOpcion` ya la crea con `usos: 1`). Sin test: el camino pasa por el
submit del componente y no hay testing-library (B-08).

### B-87 · El formulario nace sucio, así que el aviso de versión nunca se recarga solo — ✅ hecho (2026-08-24)

`autoSeleccionarPrimera` en el desplegable de `tipo` preselecciona "Taller" desde
un efecto, y ese efecto es de un hijo: corre **antes** que los efectos de
`ActividadFormulario`. Los dos consumidores del estado inicial del formulario
toman su huella en el efecto del padre, o sea antes de ver la preselección:

- `useFormularioSucio` deja `sucio = true` en cuanto React procesa el `setForm`
  del hijo. Abrir "Nueva actividad" y no tocar nada ya cuenta como trabajo sin
  guardar: el aviso de versión nueva no se auto-recarga nunca y muestra el
  cartel "Guardá lo que estás cargando y después recargá: si recargás ahora, se
  pierde" sobre un formulario vacío.
- `useMedicionFormulario` compara la misma huella al cerrar, así que el
  parámetro `sucio` de `formulario_abandonado` es **siempre 1** y deja de
  responder la pregunta que documenta [`09-analitica.md`](09-analitica.md)
  ("¿había trabajo adentro, o se abrió el formulario y se salió?").

El arreglo es que la preselección no cuente como cambio: aplicarla al armar el
estado inicial (`formVacio()` con el primer valor de la taxonomía, que se conoce
desde `OPCIONES_BASE`) en lugar de con un efecto sobre el formulario ya montado.

**Sin test, y por eso está acá y no en P0/P1:** el mecanismo se leyó en el
código y el orden de los efectos es una garantía de React, pero verificarlo
necesita render, y no hay testing-library (B-08). Es la primera cosa que valdría
la pena verificar si se instala.

**Resuelto así (D-101):** la preselección se aplica en `formVacio()`
(`src/lib/formulario/estadoInicial.ts`) y el campo `tipo` dejó de pasar
`autoSeleccionarPrimera`. `plataforma` lo conserva: su bloque nace de un cambio
de modalidad, o sea de una acción de quien carga.

Sigue sin haber un test de render, pero la clase quedó cubierta desde dos
lados en `tests/formulario-dominio.test.ts`: uno afirma que `formVacio().tipo`
es la misma opción que mostraría el desplegable, y otro —de fuente— que ningún
campo que exista desde el montaje delegue su preselección a un efecto. Lo que
falta verificar con render es el síntoma (que el aviso de versión se
auto-recargue), no el mecanismo.

### B-90 · "Generar N encuentros" sobre un ciclo publicado borra y recrea los ocho eventos — ✅ hecho (2026-08-24)

El generador del §11 reemplaza la lista de sesiones, y `generarSesiones` da ids
nuevos. Sobre un ciclo ya publicado el diff no reconoce ningún encuentro: ocho
`borrar` y ocho `crear`. Es exactamente lo que el §7.2 dice que no hay que hacer
—"eso perdería los recordatorios y las suscripciones de la gente"— y el cartel
del formulario avisa "Reemplaza la lista actual", que no se lee como "reemplaza
también el calendario".

Salidas: reusar el id de la fila que ocupa la misma posición cuando la cantidad
no cambia, o al menos avisar en el cartel cuando alguna sesión ya tiene
`calendarEventId` ("esto borra N eventos del calendario y crea otros N").

Test en [`tests/costuras.test.ts`](../tests/costuras.test.ts).

**Resuelto así (D-103):** se reusa el id **y** el `calendarEventId` de la fila
de la misma posición, y no solo cuando la cantidad coincide: generar diez sobre
ocho son ocho actualizaciones y dos altas; seis sobre ocho, seis y dos bajas.
Correr un ciclo publicado una semana pasó de 8 `borrar` + 8 `crear` a 8
`actualizar`. El cartel dice ahora qué recalcula y qué borra, y aclara —solo
cuando hay encuentros ya publicados— que se mueven en lugar de recrearse. Los
tests corren el generador contra el `planificar` de verdad, porque lo que estaba
roto era el par. Queda abierto **B-169**.


### B-125 · Un evento borrado a mano en Calendar no se detecta · P2

La vista calendario compara el `calendarEventId` guardado contra lo que
**debería** existir, no contra lo que Google Calendar tiene de verdad. Si alguien
borra un evento a mano desde Calendar, el panel sigue diciendo "En el
calendario". Es coherente con el §2.1 —el calendario es un espejo y editarlo a
mano no es un caso soportado— pero la vista promete estado de publicación y en
ese caso miente.

Cerrarlo pide leer la API de Calendar desde el panel, que hoy no tiene forma de
autenticarse contra ella (la identidad es de la Function, D-06).

### B-126 · La vista calendario no avisa de inscripciones que cierran · P2

`inscripcion.cierra` no aparece en ninguna parte del calendario, y es una fecha
con la misma urgencia que un encuentro: pasada, la actividad sigue publicada
invitando a anotarse. Encaja natural como un marcador más en el día que
corresponde, con otro color.

### B-127 · `useLabelsTaxonomia` abre cinco suscripciones en la primera pantalla · P3

El hook abre un `observarOpciones` por campo (arancel, tipo, barrio, plataforma,
tags) y el listado —la primera pantalla del panel autenticado— solo usa dos.
Su propio docstring advierte que conviene montarlo "recién cuando hace falta".
No rompe nada y `OPCIONES_BASE` cubre el primer render, pero son cinco listeners
abiertos toda la sesión donde antes había cero.

### B-128 · `mesesConEncuentros` depende de recibir la lista ya ordenada · P3

`mesesConEncuentros` promete devolver los meses "del más viejo al más nuevo" y no
ordena: se apoya en que `encuentrosDe` ya ordenó por inicio. Hoy todos los
caminos del componente pasan por ahí, así que funciona. El día que alguien
alimente `mesInicial` con una lista armada de otra forma, la vista abre en un mes
arbitrario y nadie lo nota. Un `.sort()` lo cierra.

### B-160 · Agregar o borrar una fila de un ciclo publicado reescribe los otros N · P3

Residual de B-84, y por diseño (D-95): el número del evento es "Encuentro 3 de
8", así que cambiar el largo del ciclo hace falso el "de 8" de todos los demás y
el diff los actualiza. Son `actualizar`, nunca `borrar`+`crear`: los
recordatorios y las suscripciones sobreviven, pero el texto de los otros siete
eventos cambia por agregar un noveno encuentro.

A diferencia de la cancelación, acá el conjunto de encuentros cambió de verdad y
el número nuevo es el correcto, así que no está claro que haya algo que arreglar.
Si molesta en la práctica, la salida es **sacar el total** de la descripción
("Encuentro 3", sin "de 8"): agregar al final dejaría de tocar a nadie y el total
—que es el dato volátil— ya está en la descripción de la actividad. Se decide
con uso real, no antes.

Ojo con el orden: si la fila nueva se intercala **antes** de encuentros que ya
existen, esos sí cambian de número con cualquier variante. Eso es correcto.

### B-162 · Los ciclos ya publicados con un encuentro cancelado se quedan con el número viejo · P3

Consecuencia de D-95 en lo que ya está en el calendario. La guarda del §7.1
compara el payload de antes contra el de después **calculando los dos con el
código nuevo** (D-07), así que un ciclo que hoy tenga un encuentro cancelado no
genera ninguna operación al volver a guardarlo: los siete eventos siguen
diciendo "de 7" en el calendario de quien los tenga agendados, mientras el panel
y la vista previa muestran "de 8". La divergencia solo se ve desde afuera.

Se corrige sola en cuanto un cambio que **sí** salga al evento —título,
descripción, sede, tema, lectura— reescriba esos eventos. Para forzarlo hoy hay
que editar algo de eso a mano en las actividades afectadas, que son pocas y las
puede listar el dueño desde la vista calendario (los encuentros cancelados se ven
en gris).

Un resync de verdad —leer Calendar y reconciliar— es **B-125**, que necesita que
el panel o un script se pueda autenticar contra la API. Mientras eso no exista,
esto es texto viejo en eventos ya publicados: molesta, no rompe.

### B-163 · El panel numera encuentros que el evento no numera · P3

`encuentrosDe` (D-70) y la vista calendario muestran "Encuentro 2 de 3" en
**cualquier** actividad de más de una sesión, mientras `posicionEnCiclo` (D-95)
numera solo si `esCiclo` está tildado. El schema prohíbe `esCiclo` con menos de
dos sesiones pero no el recíproco, así que tres encuentros sin tildar el ciclo es
un documento válido: el panel numera y el evento público no dice nada.

Es anterior a B-84 y no está claro que sea un bug —el evento afirma "Encuentro 2
de 3" solo cuando el dueño declaró que es un ciclo, y eso es defendible—, pero
son dos criterios para lo mismo derivado, que es lo que D-71 y D-20 evitan. Las
dos salidas: que el evento numere cuando hay más de una sesión aunque no sea
ciclo, o que el panel deje de numerar sin `esCiclo`. Hay un test en
`costuras.test.ts` que fija el comportamiento actual, así que unificarlo se va a
notar.

### B-161 · Fixtures de `calendario.test.ts` que todavía no ejercitan el ciclo · P3

B-84 existió porque un test pasaba con el invariante roto: su fixture era una
actividad de dos sesiones sin `esCiclo`, así que la numeración del evento no
entraba en juego. Los bloques del diff (creación, anti-loop, diff por id, cambio
global, despublicar y cancelar) ya corren sobre un ciclo de ocho encuentros
semanales. Quedan con fixture de un solo encuentro, y a propósito:

- **`planificar` — el payload propaga los campos nuevos** (arancel, organizador,
  inscripción, "publicar el link", material): son cinco tests de una sola sesión
  que verifican *que un campo propaga*, no *a cuántos*. Sobre un ciclo pasarían a
  esperar ocho ops y el test diría menos.
- **`construirEvento` y `construirDescripcion`**: son de contenido —qué sale y
  qué nunca sale—, y ahí una sesión alcanza. La numeración del ciclo tiene sus
  propios tests.

Vale releerlo con el mismo ojo cada vez que se toque el diff: el patrón —"el
fixture no ejercita el caso central del §2.2"— es el que hay que cazar, no estos
casos puntuales.

### B-129 · «Feria» falta en los tipos de actividad — ✅ hecho (2026-08-25)

**Primer reporte real cargado desde el panel** —
[issue #4](https://github.com/benoffi7/agenda-literaria/issues/4), del dueño,
desde Android, versión `1.0.1+538bef7`:

> Falta FERIA en dónde describís: taller, curso, etc

**Se puede hacer hoy sin tocar código.** `tipo` es una taxonomía autogestionada
(§4) y el schema lo trata como slug abierto (`texto.min(1)`), no como enum
cerrado: alcanza con elegir «Otro…» en el desplegable y escribir «Feria». Eso ya
funciona.

**Decidido por el dueño (2026-08-24): va como opción base**, `fijo: true` en
`src/lib/opciones-base.json`. El argumento es el del §4.1 con «a la gorra»: en el
circuito literario argentino una feria del libro no es un caso raro, es una
categoría de primera clase. Las cinco de hoy salieron del §3.1, que no la
contempla, así que el §3.1 queda desactualizado y hay que anotar el desvío.

Tres cosas que arrastra, y son el trabajo real del ítem:

1. ~~Si se carga con «Otro», nace sin aprobar~~ — ya no aplica: como opción base
   nace aprobada, y además el dueño decidió que **todas** las opciones nuevas
   nazcan aprobadas (ver **B-131**).
2. **Un tipo nuevo no tiene reglas condicionales** (§11). El formulario decide
   con `cambiarTipo` qué mostrar y qué activar solo — «club de lectura» prende
   «es ciclo» y «tiene material», «taller» y «presentación» piden tallerista.
   «Feria» cae en el default: sin tallerista, sin material, sin ciclo. Hay que
   decidir qué le corresponde (¿una feria tiene varios días? probablemente sí, o
   sea ciclo).
3. **La guía del panel** lista los tipos y el capítulo tendría que nombrarla
   (`src/lib/ayuda.ts`), y el §3.1 del `CLAUDE.md` quedaría desactualizado — es
   una decisión del dueño si se corrige el documento o se anota el desvío.

**Hecho.** «Feria» es opción base (`fijo: true`, orden 6) y su regla del §11 es
**ciclo sí, material y tallerista no**: una feria del libro dura varios días, así
que es una actividad con N encuentros (§2.2), uno por jornada, y no tiene quien la
dé. Sin la cascada caía en el default y había que acordarse de tildar «es un
ciclo» a mano, que es el olvido que el §11 existe para evitar. Va con dos tests
—uno por la cascada, otro por el `fijo`, porque borrarla desde la pantalla de
taxonomías dejaría la regla apuntando a un tipo que no se puede elegir— y su
punto en la guía.

**El §3.1 del `CLAUDE.md` queda desactualizado**: lista cinco tipos y ahora son
seis. Se anota el desvío en lugar de editar el documento del dueño.

Y el reporte deja una lección de producto que vale más que el ítem: **la primera
cosa que faltó fue una categoría del dominio, no una función del software.**

### B-130 · El listado no dice quién cargó cada actividad — ✅ hecho (2026-08-25)

`createdBy` y `updatedBy` **se guardan en cada documento y no se muestran en
ninguna parte**: el panel los escribe (`formADocumento`) y nunca los lee. Con dos
personas cargando sobre la misma lista —no hay filtro por usuario, las dos ven
todo, borradores incluidos— la pregunta «¿esto lo cargaste vos?» no se puede
contestar mirando la pantalla.

El dato ya está, así que es mostrarlo: una línea en la fila del listado, y quizás
en el encabezado del formulario al editar algo ajeno.

**Hecho, y más chico de lo que el ítem proponía.** Los dos caminos que evaluaba
—guardar el mail en el documento, o cablear el mapa uid→nombre— eran más grandes
que la pregunta. Lo que se reportó fue *"los eventos que crea el otro admin
también me aparecen, ¿no?"*, o sea **¿esto lo cargué yo?**, y eso se contesta con
el uid que el panel ya tiene en la sesión: cero cambios de modelo, cero riesgo de
filtración.

La fila marca solo lo ajeno («La cargó otra cuenta»). Lo propio no lleva marca a
propósito: si todo lleva marca, la marca deja de avisar. Y un documento sin
`createdBy` —los anteriores a que se escribiera— queda como `desconocida` y
tampoco se marca, porque afirmar de más sobre datos viejos es peor que callarse.

**Con dos cuentas alcanza; con tres, no.** "Otra cuenta" identifica sola a la
otra persona mientras sean dos. Cuando aparezca la tercera hay que guardar el mail
—y ahí sí verificar que `toPublic` lo descarte, que es el punto 2 de arriba—.
`toPublic` construye el objeto público campo por campo, o sea **lista blanca**, así
que un campo nuevo queda afuera por construcción y no por acordarse; eso reduce el
riesgo pero no lo elimina, porque alguien podría agregarlo a la proyección.
Queda como **B-179**.

Dos cosas a resolver, y la segunda importa:

1. **`createdBy` es un uid**, no un nombre. Hay que resolverlo a algo legible.
   Las dos cuentas están en `docs/02-infraestructura.md`, pero cablearlas en el
   código es exactamente el tipo de cosa que queda vieja sin que nada falle. Lo
   razonable es leer el `displayName` o el mail de Auth, o guardar el mail en el
   documento al escribir — que es más simple y no necesita otra lectura.
2. **Es un uid, y el §5.1 dice que los uids no salen al público.** Mostrarlo en el
   panel está bien: solo lo ven los admins. Pero si algún día se guarda el mail
   en el documento, hay que verificar que `toPublic` lo siga descartando — hoy
   descarta `createdBy`/`updatedBy` por nombre, así que un campo nuevo con el
   mail **se filtraría al `events.json`**. Es la clase de bug B-81: el saneador
   aplicado campo por campo en vez de en un punto de paso obligado.

Salió de la conversación del 2026-08-24, verificando que las actividades del otro
admin sí aparecen en el panel de los dos.

### B-131 · Las opciones creadas con «Otro» nacen aprobadas · P2 — ✅ hecho (2026-08-24)

**Hecho tal como lo pedía el ítem** (D-104): `aprobada: true` con el motivo
escrito al lado, una guardia que fija el default leyendo el fuente
(`tests/opciones-aprobacion.test.ts`, que no necesita emulador), y los tests de
la aprobación conservados enteros — ahora fabrican la pendiente a mano
(`volverPendiente`) porque `upsertOpcion` ya no puede producirla.


**Decisión del dueño (2026-08-24):** una etiqueta nueva cargada con «Otro» tiene
que quedar disponible para las dos cuentas enseguida, sin pasar por aprobación.

El cambio en sí es de una línea: `aprobada: false` → `true` en el `upsertOpcion`
de `src/lib/opciones.ts` (línea 131), más los tests que fijan ese default.

**La consecuencia que hay que mirar antes de hacerlo:** con esto el mecanismo de
aprobación queda **inerte**. Nada nace pendiente, así que `estaAprobada`,
`opcionesVisibles`, `huellaCreador`, el script `aprobar-opciones.mjs` y el
indicador «(sin aprobar)» de la UI dejan de tener efecto, y estos tres ítems se
quedan sin sentido:

- **B-25** (aprobar desde el panel) y **B-26** (avisar que hay algo pendiente):
  no habría nada que aprobar ni de qué avisar.
- **B-28** (¿claim `curador`?) y **B-29** (¿auto-aprobar una etiqueta reusada?):
  las dos preguntas desaparecen.

**Decidido (2026-08-24): se voltea el default y la maquinaria queda dormida.** El
dueño la quiere disponible para cuando haya más admins y más tags, que es
exactamente el escenario que el §4.3 anticipa (*"si en el futuro carga gente
además del dueño"*). Prenderla de nuevo va a ser volver a poner `false`.

Lo que hay que hacer para que el código dormido no se lea como código muerto:

- **Un comentario en `upsertOpcion`, en el lugar del default**, que diga que está
  en `true` por decisión y no por descuido, y qué la revierte. Sin eso, el
  próximo que lea `aprobada: true` al lado de `estaAprobada` y `opcionesVisibles`
  va a suponer que alguien se olvidó de terminar algo.
- **Un test que fije el default**, del mismo tipo que
  `tests/opciones-orden.test.ts` con la preselección. La maquinaria dormida tiene
  dos formas de fallar en silencio, y las dos son de la clase que este repo ya
  aprendió a cubrir: que el default se vuelva a dar vuelta sin que nadie lo note,
  o que alguien "limpie" `estaAprobada`/`huellaCreador` como código sin uso y
  después no haya nada que prender.
- **Dejar los tests de la aprobación como están.** Siguen verificando la
  maquinaria, y son lo que garantiza que funcione el día que se prenda. No
  sacarlos por estar cubriendo un camino que hoy nadie recorre.

**Vale notar por qué la decisión es razonable:** el problema que el §4.3 quería
evitar era que el desplegable se llene de variantes de lo mismo, y eso ya lo
resuelve el §4.2 —slugify más el autocompletado contra lo existente— que ataja
los duplicados **antes** de que nazcan. La aprobación agregaba control de
vocabulario, no corrección. Con dos personas de confianza, la fricción no se
paga.

### B-132 · El desplegable muestra el slug crudo mientras la etiqueta no está registrada — ✅ hecho (2026-08-25)

Reportado por el dueño usando el panel (2026-08-24): *"cuando cargo barrios o
lugares los escribe con minúscula"*.

Confirmado en `src/components/admin/campos/TaxonomiaSelect.tsx:224`:

```tsx
{pendienteAjena ? `${pendienteAjena.label} (sin aprobar)` : `${value} (nueva)`}
```

`value` es el **slug**, no la etiqueta. Al escribir «Villa Crespo» en «Otro…», la
opción todavía no está en `/opciones/*` —se persiste en el submit, por D-02— así
que `esConocido` es `false` y el desplegable pinta `villa-crespo (nueva)`.

**Hay un segundo camino al mismo síntoma**, encontrado por el frente de la fase 2
y anotado acá en lugar de como ítem aparte —es el mismo bug, la misma línea y el
mismo arreglo—: reeditar una actividad **cuya etiqueta nunca llegó a
registrarse** (D-111) también cae en `esConocido === false`, y ahí se lee
`con-beca-parcial (nueva)`. O sea que no hace falta estar cargando algo nuevo
para verlo.

**Y el arreglo ya está a mano.** El evento público resuelve esto con el des-slug
de D-11, reusado en el panel como `legible` en `filtrosActividades.ts`, y 3A dejó
`etiquetaPresentable` en `src/lib/taxonomia.ts`. El panel es el único lugar que
todavía muestra el slug pelado, que es exactamente lo que D-11 describe como "se
ve roto".

**El dato no se pierde:** el componente ya recibe la etiqueta tipeada en
`confirmarTexto`, que llama `onChange(slugTipeado, texto.trim())`. Solo no se la
guarda para mostrarla. El arreglo es acordarse de esa etiqueta mientras la opción
está pendiente de persistir.

Afecta a los cinco campos de taxonomía, no solo a barrio.

### B-133 · No se pueden cargar varios handles en «arrobar» — ✅ hecho (2026-08-25)

Reportado por el dueño (2026-08-24): *"no me deja poner coma ni enter en arrobas
para publicar"*.

Confirmado en `src/components/admin/ActividadFormulario.tsx:772-778`. El campo es
un input de una línea que hace ida y vuelta en **cada tecla**:

```tsx
value={form.difusion.arrobar.join(', ')}
onChange={… e.target.value.split(',').map((s) => s.trim()).filter(Boolean) …}
```

Al tipear la coma, el `split` produce un elemento vacío, el `filter(Boolean)` lo
descarta y el `join(', ')` vuelve a pintar el valor **sin la coma**. O sea que la
coma se borra sola en el momento de escribirla, y por eso no hay forma de cargar
un segundo handle. Y Enter tampoco sirve: es un input de una línea dentro del
`<form>`, así que Enter **intenta guardar la actividad**.

El campo es una lista, así que la solución es tratarlo como lista y no como
string: el patrón ya existe en el repo, es `TagsInput` — chips, Enter para
confirmar, Backspace para borrar el último. Reusarlo es mejor que arreglar el
split, porque el bug de fondo es haber modelado una lista como texto.

**Arreglado, pero NO reusando `TagsInput`** (D-116). El patrón de interacción sí
se reusó; el componente no, porque está atado a la taxonomía `tags`: slugifica lo
que se escribe y lo persiste en `/opciones/tags` (§4.2). Los handles de arrobar
son trabajo interno del §3.2 —no salen al público (§5.1) y nadie va a filtrar por
ellos—, así que reusarlo habría metido `@casabrandon` en el desplegable de
etiquetas de **todas** las actividades. El bug de fondo era modelar una lista como
string, y la respuesta no es cambiarla por la lista equivocada.

Quedó `ChipsInput` sobre `src/lib/formulario/chips.ts`, que es puro y tiene 11
tests. Tres cosas que se decidieron ahí y no son obvias:

- **el espacio no separa**: hay nombres con espacios, y cortar por espacio
  partiría «Casa Brandon» a la mitad mientras se escribe — el mismo daño que
  hacía el bug original;
- **los duplicados se comparan ignorando mayúsculas y el arroba de adelante**,
  porque `@CasaBrandon`, `casabrandon` y `@casabrandon` son la misma cuenta y
  tenerlas tres veces es el error que se comete al volver sobre una actividad
  meses después;
- **se guarda lo que se escribió**, no una versión normalizada: forzar el arroba
  rompería los handles que no son de Instagram, y quitarlo perdería información
  que quien lo tipeó puso a propósito.

Y la ayuda del campo también estaba mal: decía «un handle por línea o separados
por coma» y ninguna de las dos funcionaba.

### B-134 · Los tipos y las entregas de material son enums cerrados — ✅ parcial (2026-08-25)

Reportado por el dueño (2026-08-24), cargando un club de lectura real: *"en
material adicional son varias cosas: libro, newsletters, guía, playlist… y son al
inscribirse pero otros durante el mes. Agregar «durante el mes» a la lista de
opciones"*.

Los dos campos son `z.enum` en `src/lib/schema.ts:62,65`, o sea **cerrados**, a
diferencia del `tipo` de la actividad que es taxonomía abierta (§4):

| Campo | Hoy | Falta |
|---|---|---|
| `TIPOS_MATERIAL` | `lectura`, `guia`, `contexto`, `autor`, `otro` | newsletter, playlist… y «libro», que hoy entra como `lectura` |
| `ENTREGAS_MATERIAL` | `previo`, `al-inscribirse`, `en-el-encuentro` | **«durante el mes»**, que es el pedido concreto |

**«Durante el mes» es lo interesante del reporte**, y no es solo una opción más:
dice que la entrega del material no es un instante sino que puede ser progresiva
a lo largo del ciclo. Encaja con el §2.2 —un club de lectura son ocho encuentros
con su lectura cada uno— y es exactamente el caso de uso que el §4.1 llama de
primera clase, como «a la gorra».

**Hecho lo pedido, pendiente la decisión de fondo.** Agregados: `durante-el-mes`
en las entregas —el pedido concreto—, más `newsletter` y `playlist` en los tipos.

**No se agregó `libro`, y no es un olvido.** El reporte lo nombra, pero `lectura`
ya es eso: el texto asignado. Tener los dos partiría los datos existentes en dos
valores que después no se pueden volver a juntar, porque nadie va a saber cuál
eligió cada uno. Se cambió la **etiqueta** a "Libro o lectura", que es reversible;
agregar el valor no lo es. Si el dueño prefiere el valor aparte, se hace — pero
esa es la decisión que hay que tomar a ojos abiertos.

**Y apareció la tercera instancia de la clase de B-76/B-132**: el desplegable de
tipo de material pintaba el valor crudo, así que decía "guia" y "autor" mientras
el evento público decía "Guía" y "Sobre el autor". Arreglado importando el mapa de
`@calendario` en lugar de copiarlo (D-20), y con un chequeo nuevo que afirma que
**todo** valor de los dos enums tiene etiqueta en las dos pantallas — verificado
contra un valor inventado para confirmar que lo detecta y que nombra cuál falta.
`entrega` mantiene dos mapas a propósito: el panel capitaliza, el evento va en
minúscula a mitad de frase.

**La decisión que queda, y es del dueño:** ¿`material.items[].tipo` pasa a ser
**taxonomía abierta** como el resto (§4)?
Abrirlo sale casi gratis —la implementación de `opciones.ts` ya resuelve cinco
campos con un solo patrón— y evita volver a tocar código la próxima vez que
aparezca un formato que nadie previó, que en tres reportes ya pasó una vez.
`entrega`, en cambio, conviene que siga cerrada: son momentos del ciclo de vida
de la inscripción, no vocabulario libre, y el §5.1 los usa para decidir qué se
publica.

Ojo con dos cosas al implementarlo: los dos enums tienen mapas de etiquetas en el
formulario **y** en `functions/calendario.js` —que son prosa para el público, y
el diagnóstico de salud dijo explícitamente que no hay que unificarlos (§B-70)—
así que un valor nuevo va en los dos lados, y si falta en uno se publica el valor
crudo. Y `docs/03-modelo-de-datos.md` más el §3.1 del `CLAUDE.md` quedan
desactualizados.

### B-170 · Montar la pantalla de taxonomías en el router del panel — ✅ hecho (2026-08-25)

`src/components/admin/taxonomias/TaxonomiasPanel.tsx` existe, funciona y **no se
puede abrir**: colgarla del router es editar `AdminApp.tsx`, que en la fase 3 del
plan de saneamiento es de otro frente. Mientras tanto B-06, B-25 y B-26 están
hechos y no se ven.

Lo que hay que hacer, todo en `AdminApp.tsx`:

- agregar `{ tipo: 'taxonomias' }` al tipo `Vista`;
- cargarla con `lazy(() => import('@/components/admin/taxonomias/TaxonomiasPanel'))`,
  **diferida como las otras cuatro vistas** — un import estático deshace el corte
  del bundle (B-09 / D-51) y el build sigue verde;
- un botón en la cabecera, al lado del de reportes;
- el contador de pendientes de B-26 en la cabecera, con
  `usePendientesDeAprobacion()` de `useOpciones.ts` (abre cinco suscripciones:
  va montado una sola vez).

Y con eso, lo que la regla de proceso pide y hoy sería mentira: la entrada en
`src/lib/novedades.ts` ("ahora podés corregir cómo se escribe una etiqueta y
borrar las que sobran") y el capítulo en `src/lib/ayuda.ts`. No se escribieron
antes a propósito: anunciar una pantalla que no se puede abrir es peor que no
anunciarla.

### B-168 · Contar el uso de las etiquetas elegidas al guardar — ✅ hecho (2026-08-25)

**Hecho.** `usosAContar` (puro, en `src/lib/formulario/etiquetas.ts`) arma los
slugs a contar por campo y `guardarActividad` los pasa a `registrarUsos` por
puerto (D-113), después del alta de opciones —`registrarUsos` no crea el
documento si no existe, así que contar antes de sembrar no contaría nada.

**El fixture del test tenía la clase B-135 otra vez.** El `entrada()` por defecto
dice que se tipeó «Con beca parcial» pero el form guarda `a-la-gorra`: en el panel
real no puede pasar, porque `recordarLabel` registra el label en el mismo cambio
que pone su slug en el form. Con ese fixture la resta no tiene nada que restar y
el chequeo pasaba **sin haber mirado el caso**. El test de la resta usa uno
coherente, y afirma además que los que ya existían sí se cuentan — sin eso
pasaría con la lista vacía.

Era la mitad que faltaba de **B-86**, que queda cerrado.

Es una línea en `guardar()` (`ActividadFormulario.tsx`, frente de la fase 2), y
el orden importa:

1. escribir la actividad (la inversión de B-71),
2. `upsertOpcion` de las etiquetas nuevas,
3. `registrarUsos(campo, slugs)` con los slugs elegidos **menos** los que se
   acaban de crear en el paso 2 — nacen con `usos: 1` y sumarlos otra vez los
   deja en 2.

Sale con B-70/B-71, cuando `guardar()` deje de vivir dentro del componente.

### B-179 · Con tres admins, «otra cuenta» deja de identificar a nadie · P2

B-130 marca lo ajeno con «La cargó otra cuenta», que alcanza porque hay **dos**
cuentas: no ser vos implica ser la otra persona. Con la tercera, la marca dice
que no fuiste vos y nada más.

Ahí hace falta el nombre, y el camino es guardar el mail en el documento al
escribir (más simple que resolver el uid contra Auth en cada fila). Dos cosas a
verificar en ese momento:

1. **el §5.1** — `toPublic` construye el objeto campo por campo, o sea lista
   blanca, así que un campo nuevo queda afuera **por construcción**. Eso reduce el
   riesgo pero no lo elimina: alguien puede agregarlo a la proyección sin pensar.
   Vale un test que afirme que ningún campo con `@` sale al `events.json`;
2. **el historial (§12)** — el mail entra en las versiones guardadas, así que
   borrar una cuenta no lo borra de ahí.

Sale junto con la maquinaria de aprobación que B-131 dejó dormida: las dos esperan
el mismo momento, que es cuando haya más de dos personas cargando.


### B-180 · La detección de emuladores de `verificar-todo.sh` no tiene test · P3

El paso 3 del gate ahora detecta si los emuladores ya están arriba y usa esos en
lugar de levantar otros (antes cortaba con "port taken" y **el gate fallaba por
su propia plomería**, que es lo que enseña a saltearlo). Esa decisión es un `if`
en bash y no tiene test, a diferencia de la de `que-deployar.sh`, que tiene 20.

Es el mismo argumento que llevó a extraer `que-deployar.sh` del YAML: una
decisión que no se puede probar se prueba en producción. Acá "producción" es el
momento de pushear, o sea el peor momento para descubrirla.

Lo testeable sin emuladores de verdad es la elección de rama: dado un hub que
contesta, usa `npm test` directo; dado uno que no, usa `emulators:exec`. Se puede
con un servidor HTTP de dos líneas y `FIREBASE_EMULATOR_HUB` apuntado ahí.

### B-181 · Un club puede ofrecer N opciones para sumarte, y el modelo solo sabe de N encuentros · P2

Reporte del dueño usando el panel de verdad (2026-08-25):

> un club de lectura puede darte 4 opciones para sumarte. Pero no son 4
> encuentros, sino opciones.

`sesiones` (§2.2, §3.1) es una **secuencia**: N filas son N encuentros que pasan
todos, y quien se anota va a todos. Un club que abre cuatro horarios del mismo
ciclo —martes 19, jueves 19, sábado 11, y uno virtual— tiene cuatro filas que son
**alternativas excluyentes**: cada persona va a una sola. Hoy no hay forma de
decir eso, y si se cargan como encuentros el panel y el sitio afirman algo falso:

- el calendario público publica los cuatro eventos y quien se suscribe se lleva
  los cuatro, tres de los cuales no son suyos (§7);
- el evento dice «Encuentro 2 de 4» (D-95), que sobre una alternativa no
  significa nada;
- «con algo por venir» y el orden por encuentro más próximo cuentan cuatro fechas
  donde hay una;
- si además el ciclo tiene encuentros reales, las dos dimensiones se multiplican
  y la lista de sesiones deja de ser legible.

**Por qué vale la pena:** es la primera forma del dominio que el modelo no puede
expresar. «Feria» (B-129) era un valor que faltaba en una taxonomía abierta y se
podía cargar con «Otro…» el mismo día; esto no tiene esa salida. Y es una forma
común en el circuito: los clubes con cupo chico abren varias comisiones del mismo
ciclo justamente porque no les entra la gente en una.

**La forma la decide el dueño (DEC-8).** Tres caminos con costos muy distintos:

1. **Nada de modelo:** se carga una fecha y las otras tres van en la descripción.
   Cero código y cero riesgo; nadie puede filtrar por «hay horario los sábados» y
   el calendario sigue publicando lo que se cargue.
2. **Una actividad por comisión**, atadas por un campo nuevo (`comisionDe` o
   parecido). Reusa todo lo que ya existe —sesiones, calendario, filtros— y
   cuesta N tarjetas casi iguales en el listado más mantenerlas en sincronía:
   cambió la sede → cuatro escrituras, que es exactamente lo que el §2.2 quiso
   evitar.
3. **Un eje nuevo en el documento** (`opciones: [{ id, etiqueta, sesiones }]`),
   que es lo que el reporte describe literalmente. El más fiel y el más caro:
   toca el schema, el formulario, la proyección pública, el diff del §7.2 —que
   hoy es una sola `Map` por id de sesión— y la numeración de D-95.

**Sube a P1 cuando salga el sitio público** (B-105 a B-114): hasta entonces el
daño es un calendario con eventos de más, y después es información equivocada
indexada en Google, que es el objetivo del proyecto.

### B-182 · El evento dice «(Otro, previo al encuentro)» en la mitad de las líneas de material — ✅ hecho (2026-08-25)

Reporte del dueño mirando un evento ya publicado de un club de lectura:

> - Libro virtual: Han cantado BINGO (Lectura, al inscribirse)
> - Durante el mes recibís 2 newsletters para profundizar en la lectura (Guía, al inscribirse)
> - Bonus track: material adicional (Otro, previo al encuentro)
> - Playlist inspirado en el universo del libro (Otro, previo al encuentro)
> - Acceso a un grupo de telegram para charlar sobre el libro (Otro, previo al encuentro)
>
> Puede sacarse el (otro…?

**Sí, y el reporte muestra por qué.** `otro` es el formato donde cae todo lo que
no entra en los demás, así que es el más usado: tres de las cinco líneas repiten
una palabra que no informa nada al lado del título —«Playlist inspirado en el
universo del libro **(Otro**…»— y encima empuja hacia abajo el dato que sí
importa, cuándo llega.

Arreglado en `functions/calendario.js`: con `tipo === 'otro'` la línea sale
`- <título> (<entrega>)`. **La entrega no se toca**, que es la mitad del ítem que
no está en el título. En el desplegable del panel «Otro» sigue siendo una opción:
ahí hay que poder elegirlo, y es otra pantalla con otro criterio (la misma razón
por la que `ETIQUETA_ENTREGA` no se comparte entre panel y evento — D-20).

Va con test en `tests/calendario.test.ts`, que es lo que evita que vuelva: el
patrón que lo restaura es tocar el `map` de material sin acordarse del caso.

Dos cosas que el reporte deja ver y **no** son este ítem:

- Ese evento se cargó con `Guía` para dos newsletters y `Otro` para una playlist,
  porque salió de la versión desplegada. Los formatos `newsletter` y `playlist`
  ya existen (B-134) y llegan con **1.1.0**.
- «Durante el mes recibís 2 newsletters» está escrito en el **título** del ítem
  porque cuando se cargó no existía la entrega `durante-el-mes`. Ahora existe, y
  la guía la nombra.

### B-185 · «DM de Instagram» debería decir «DM al Instagram» · P3

Reporte del dueño (2026-08-25): la vía de inscripción se lee mal. Es «DM **al**
Instagram», no «de».

Es copy, y está en **dos lugares con dos registros distintos**, que es lo que hay
que no romper:

| Dónde | Hoy | Qué es |
|---|---|---|
| `src/components/admin/formulario/etiquetasUI.ts` | `dm: 'DM de Instagram'` | opción de un desplegable del panel |
| `functions/calendario.js` | `dm: 'por DM de Instagram'` | prosa, cae a mitad de una frase del evento público |

No están unificados **a propósito** (D-20): unificarlos haría que un cambio de
copy del panel cambie lo que se publica. La contra es esta: cambiar uno y
olvidarse del otro es exactamente la clase de bug B-76 —el panel y el evento
diciendo cosas distintas del mismo valor guardado— y acá el build queda verde
igual. Así que el arreglo son las dos líneas, o ninguna.

El valor guardado es `dm` y no se toca: esto es la etiqueta, no la identidad.

Cuando se haga, hay que revisar si `tests/etiquetas-de-ui.test.ts` fija alguno de
los dos textos, y el comentario de `etiquetasUI.ts` que cita «por DM de
Instagram» como ejemplo de prosa.
### B-186 · El almanaque de la fecha se cierra solo si se tarda en elegir · P2

Reporte del dueño usando el panel (2026-08-25):

> el almanaque cuando «corrés» la fecha se suele cerrar si no pongo rápido la
> fecha, pero bueno, lo pongo manual

O sea: se abre el selector nativo de `<input type="datetime-local">`, se navega
entre meses, y **si la elección tarda, el almanaque se cierra solo**. La salida es
tipear la fecha a mano, que funciona pero es lo contrario de lo que el selector
existe para evitar — y un ciclo tiene ocho fechas, así que es la interacción más
repetida del formulario.

**Lo que se descartó leyendo el código** (los dos sospechosos obvios, los dos
inocentes):

- **No es un reordenamiento de filas.** `ordenarPorInicio` corre solo con el
  botón explícito, no en cada cambio, así que cambiar la fecha no mueve la fila
  de lugar.
- **No es un `key` por índice.** Las filas van con `key={s.id}` (trampa 2), así
  que React no reemplaza el nodo del input al re-renderizar.
- **El valor no se normaliza al escribirlo.** `editar(s.id, { inicio:
  e.target.value })` guarda el string crudo, así que React no le reescribe al
  input un valor distinto del que tiene.

**Tres candidatos, en orden de qué tan bien explican "si no pongo rápido":**

1. **El arranque diferido de la analítica.** `arrancar()` en `src/lib/analytics.ts`
   carga `firebase/analytics` con `requestIdleCallback(fn, { timeout: 4000 })`, o
   `setTimeout(fn, 2000)` donde no existe. O sea: **se dispara justo cuando la
   persona se queda quieta**, que es exactamente la condición que el reporte
   describe. Es un `import()` dinámico de un chunk grande más la inicialización
   del SDK. Prueba de un minuto y sin tocar código: es uno de los tres portones
   de `debeMedir`, así que un build con `PUBLIC_FIREBASE_MEASUREMENT_ID` vacío
   apaga la analítica entera — si con eso el almanaque no se cierra, es esto.
2. **Un cambio de layout debajo del selector abierto.** La barra de acciones es
   `fixed` abajo y su mensaje («N campos para revisar») aparece y desaparece según
   la validación; `AvisoVersionNueva` puede insertar una barra arriba. En Android
   un reflow de la página con el picker abierto lo descarta.
3. **Un `value` vacío de vuelta.** Un `datetime-local` incompleto reporta
   `value === ''`. Si en algún momento del recorrido del almanaque llega un
   `change` con `''`, se guarda `''`, React lo reescribe y el navegador limpia el
   campo y cierra. Se confirma o se descarta logueando `e.target.value` en cada
   `change` mientras se usa el selector.

**Lo que falta para arreglarlo es el dato del dispositivo**, que es justo lo que
un bug de fechas no se diagnostica sin él (trampa 1, en versión picker): navegador
y sistema. El reporte anterior del dueño (issue #4) vino de Android, así que
Chrome/Android es la primera hipótesis, y el selector nativo de `datetime-local`
se comporta distinto en cada plataforma.

**P2 y no P1** porque hay salida —tipear— y no se pierde ni se corrompe nada. Pero
es fricción en la acción más repetida del panel, y del tipo que hace que se cargue
menos.

Si al final resulta que es el selector nativo y no hay nada que apagar, la
alternativa es un selector propio, y eso es otro ítem: pesa en el bundle (B-09) y
hay que decidirlo, no descubrirlo.
### B-187 · `npx firebase` resolvía el global, así que el primer push de CI cortó al minuto — ✅ hecho (2026-08-25)

El primer push a GitHub disparó «Deploy desde main» y el job `verificar` murió en
el paso de los tests:

```
npm error could not determine executable to run
```

`firebase-tools` estaba **solo instalado global** (declarado como dependencia del
entorno local en [`02-infraestructura.md`](02-infraestructura.md), versión
15.9.1). Los workflows lo invocan con `npx firebase`, que en la máquina de
desarrollo encuentra el global y en un runner limpio no encuentra nada. Tres
lugares dependían de eso: `emulators:exec` del gate de CI, y los dos
`firebase deploy` de las reglas y de las Functions.

**Lo importante no es el error, es que el gate de pre-push no podía verlo.**
`scripts/verificar-todo.sh` corre el mismo `npx firebase` en la misma máquina que
tiene el global, así que da verde por el mismo motivo por el que CI da rojo. Es la
familia de B-180 y de `que-deployar.sh`: una condición que solo se evalúa en
producción se descubre en producción, y acá "producción" es el push.

**Arreglado** pasando `firebase-tools` a `devDependency` (`^15.28.1`, 17 MB) en
lugar de instalarlo en el workflow. Las dos opciones tapan el error; solo una tapa
la clase: con la dependencia declarada, `npm ci` la provee en los cuatro jobs y en
cualquier clone nuevo, y el gate local y CI corren **el mismo binario**. Un
`npm i -g` en el YAML habría dejado dos versiones que pueden separarse, que es la
forma en que este error vuelve con otra cara.

De paso, `npm run emu` usaba `firebase` pelado: también pasó a `npx firebase`, así
que un clone nuevo levanta los emuladores sin instalar nada.

Lo que **no** cubre este arreglo: el deploy sigue sin poder correr por los secrets
que faltan (ver «Pendiente de acción manual del dueño»). Este ítem es solo el gate.

## P3 — cuando sobre tiempo

### B-169 · Los tests de integración de aprobación fallaron una vez en una corrida completa · P3

Corriendo `npx vitest run` entero, tres tests de
`tests/opciones.integracion.test.ts` fallaron —«aprobar dos veces no rompe nada»,
«--listar muestra las pendientes y solo esas» y «--backfill hace explícito ese
default»— y el mismo archivo corrido solo pasó, y la corrida completa siguiente
también. O sea: **flaky, no roto**.

Los tres son los que ejecutan `scripts/aprobar-opciones.mjs` de verdad contra el
emulador (`execFileSync`), así que la sospecha es la interacción entre el script
—que abre su propia app de firebase-admin— y el estado que dejan los otros
archivos de integración. `fileParallelism: false` ya está puesto, así que no es
paralelismo de archivos.

Vale la pena porque un test que falla una de cada N corridas enseña a ignorar el
rojo, que es lo único peor que no tener el test. Primer paso: correr la suite en
loop unas cuantas veces para ver cada cuánto pasa y con qué vecino.

### B-114 · Precio real en los datos estructurados

`arancel.tipo` es un slug de taxonomía, no un monto, así que el `offers` del
JSON-LD puede decir "a la gorra" pero no un precio. Google muestra el precio en
el resultado enriquecido cuando lo tiene, y en un taller arancelado eso es
información que la gente quiere antes de escribir.

Hace falta un campo de monto en el modelo (`arancel.monto` + moneda, `ARS`),
opcional y solo para los tipos que lo tengan. Mientras no exista, la regla del
diseño (§5.3) es **no emitir precio salvo `gratis`**: un `0` en un taller pago es
un dato falso en un formato que las máquinas creen.

Es P3 porque `arancel.tipo` ya comunica lo esencial —y en la mitad de los casos
del circuito es "a la gorra", que no tiene precio que publicar.

### B-33 · Las etiquetas de GitHub hay que crearlas una vez

El issue se crea con `reporte-panel` y `bug`/`sugerencia`. GitHub crea las
etiquetas que no existan, pero sin color ni descripción. Crearlas a mano una vez
(los comandos están en [`08-operacion.md`](08-operacion.md)) deja la lista
prolija y filtrable.

### B-34 · Nada limita cuántos reportes se pueden cargar

Las reglas validan la forma del reporte y que quien lo carga sea admin, pero no
la frecuencia: cien reportes son cien issues y cien invocaciones. Con dos
cuentas de confianza no es un problema real; si alguna vez se le da el panel a
más gente, conviene un tope por autor y por día.

**Mirado en la fase 4 y dejado sin hacer, a propósito (2026-08-24).** El tope
vive en `firestore.rules`, que no es propiedad de este frente, y no hay ninguna
forma de escribir la red de contención antes que la regla: un test no puede
frenar un límite que no existe. Además la forma del límite es una decisión, no
una implementación — hay dos y no dan lo mismo:

- **por autor y por día**, contando con una query en la regla (`allow create if
  ...`): Firestore no puede contar documentos dentro de una regla, así que pide
  un contador escrito por el propio cliente (`/reportes-contador/{uid}-{fecha}`)
  y una regla que lo obligue a incrementarse de a uno. Es el patrón estándar y
  es feo pero funciona sin Function;
- **en la Function**, cortando en `decidirAccion` cuando el autor pasó el tope
  del día. No frena la escritura del reporte (que es lo que garantiza no
  perderlo, ver el encabezado de `reportes-trigger.js`), frena el **issue**, que
  es el efecto caro.

La segunda es más barata y más alineada con el diseño de reportes: el reporte se
guarda igual y lo que se limita es la salida a GitHub. Necesita decisión del
dueño sobre el tope. Toca `functions/**`, o sea la fase 1.

### B-10 · `aprobada` en las opciones (§4.3) — ✅ hecho (2026-08-21)


Las opciones creadas con "Otro" nacen pendientes: funcionan para quien las creó
y no aparecen en el desplegable de las demás cuentas hasta aprobarlas. Se aprueba
con `scripts/aprobar-opciones.mjs`. Decisiones: D-26 a D-30. Lo que quedó
abierto está en B-25 a B-29.

### B-11 · Duplicar una actividad entera — ✅ hecho (2026-08-21)

Menú "⋯" por fila en el listado, con "Duplicar", que abre el formulario
precargado con una copia. La copia rehace los ids de sesión, pone
`calendarEventId` en `null`, propone slug nuevo, arranca en borrador y corre las
fechas en semanas enteras.

Ver [CHANGELOG](CHANGELOG.md), D-17, D-18 y D-19. Lógica en
`src/lib/duplicar.ts`, tests en `tests/duplicar.test.ts`.

### B-12 · Vista previa de cómo queda el evento — ✅ hecho (2026-08-21)

### B-45 · Los links cortos de Maps (`maps.app.goo.gl`) no se pueden pegar

El campo de coordenadas (D-46) acepta el link largo y el par `lat, lng`, pero no
el link corto del botón "Compartir", que es justo el que ofrece la app de Maps
en el teléfono. Es un redirect y seguirlo desde el navegador lo bloquea CORS.

Hoy el campo lo detecta y explica que hay que abrirlo para copiar el link largo.
Si molesta seguido, la salida es una Function que siga el redirect y devuelva la
URL final — otro endpoint y otro deploy, así que no se hizo de entrada.

### B-13 · El schedule de `dispararRebuild` no reintenta con backoff

Sección colapsada al final del formulario: título, ubicación y descripción del
evento para el encuentro que se elija, armados con `construirEvento` de
`functions/calendario.js` —la misma función que publica el evento (D-20)—, así
que no puede divergir de lo que sale. Ver el
[changelog](CHANGELOG.md) y [`04-funcionalidades.md`](04-funcionalidades.md).


Quedó afuera, y no parece necesario: un botón para copiar la descripción, y
mostrar `start`/`end` (el formulario ya muestra las fechas al lado).

~~B-13 · El schedule de `dispararRebuild` no reintenta con backoff~~ →
[cerrado](#cerrados).

### B-14 · El menú de acciones del listado no se navega con flechas — ✅ hecho (2026-08-24)

`MenuAcciones` cierra con `Escape` y con un click afuera, y sus ítems son
`<button role="menuitem">` alcanzables con Tab, pero no implementa el patrón
completo de menú ARIA (flechas arriba/abajo, foco que vuelve al disparador al
cerrar). Con dos ítems alcanza; si el menú crece, conviene completarlo.

### B-25 · Aprobar taxonomías desde el panel — ✅ hecho (2026-08-24)

**Hecho** junto con B-06, como decía el ítem: botón "Aprobar" en la fila, sobre
`aprobarOpcion` (transaccional, rechaza las `fijo`). Ya no hace falta una máquina
con Node y `gcloud`.

**Ojo:** con B-131 nada nace pendiente, así que hoy esto solo alcanza a lo que
quedó pendiente antes de esa decisión (D-104). Es la maquinaria dormida, y se
deja lista a propósito.

**Cómo quedó, y por qué antes de que el menú creciera.** Se hizo junto con el
tercer punto de **B-64** (la capa de ayuda no atrapaba el foco) porque son la
misma clase vista en dos pantallas: un patrón de teclado a medio hacer. La
aritmética —dónde cae el foco al pasarse del último, qué tecla mueve a dónde—
salió a `src/lib/foco.ts`, pura y con tests; el DOM queda en cada componente.

El menú tiene ahora ↓/↑ con vuelta, `Home`/`End`, se abre con ↓ o ↑ cayendo en el
primero o el último, y **devuelve el foco al "⋯" al cerrarse con `Escape`** — sin
eso había que re-tabular el listado entero para volver a la fila donde se estaba,
que es lo que hacía inservible el `Escape`. La capa de ayuda cicla el Tab y
devuelve el foco a lo que estaba enfocado antes de abrirla.

Un bug que apareció escribiendo la cuenta: tratar "ninguno enfocado" como el
índice `-1` a secas hacía que ↑ cayera en el **penúltimo**. Con dos ítems —los
que el menú tiene hoy— el resultado parece razonable, así que habría entrado sin
que nadie lo viera.

### B-26 · Nadie se entera de que hay algo para aprobar — ✅ hecho (2026-08-24)

**Hecho a medias, y la mitad que falta es de otro frente.** La pantalla de
taxonomías muestra arriba cuántas etiquetas esperan aprobación, y
`usePendientesDeAprobacion()` (en `useOpciones.ts`) deja el número listo para la
**cabecera** del panel, que es lo que pedía el ítem — pero la cabecera vive en
`AdminApp.tsx`. Va con B-170.

Con B-131 el contador da 0 salvo por lo viejo (D-104).


Una etiqueta pendiente queda invisible para la otra cuenta y **no hay ningún
aviso**: si nadie corre `--listar`, la etiqueta puede quedar pendiente para
siempre y las dos personas terminan creando dos slugs para lo mismo (justo lo
que el §4.2 evita).

Mínimo útil: un contador de pendientes en la cabecera del panel. Cuadra con
B-25.

### B-27 · El `events.json` tiene que publicar solo las opciones aprobadas

Parte de **B-01** (el sitio público, que todavía no existe). El generador tiene
que armar `opciones.*` (§4.4) con `opcionesVisibles(valores)` **sin uid**, que
devuelve exactamente las aprobadas. Queda anotado acá para que no se pierda: si
se vuelca el array crudo, los chips de filtro del sitio muestran vocabulario sin
validar.

### B-28 · ¿Claim `curador` para aprobar? — decisión del dueño

Hoy cualquiera de las dos cuentas con claim `admin` puede aprobar (D-28), y las
opciones nuevas nacen pendientes **incluso las del dueño**, porque el código no
distingue dueño de admin.

Si el dueño quiere ser el único que valida, o que lo suyo nazca aprobado, hace
falta un claim aparte (`curador`) y mover la aprobación a un campo o documento
propio para que las reglas puedan verificarla — hoy no pueden, porque `valores`
es un array de maps y no se puede comparar elemento por elemento.

No se implementó por cuenta propia: cambia el modelo de permisos.

### B-29 · ¿Auto-aprobar una etiqueta que reusa una segunda cuenta? — decisión del dueño

Si la cuenta B tipea en "Otro" una etiqueta que ya existe como pendiente de la
cuenta A, hoy se reusa el slug (bien, §4.2) pero la opción **sigue pendiente**:
dos personas la usan y ninguna la ve en su desplegable.

Que dos cuentas distintas la usen es buena señal de que es vocabulario real, y
aprobarla ahí sería automático y barato. Contra: aprueba sin que nadie mire, y
alcanza con que la segunda persona repita el mismo typo.

### B-57 · El abandono por cierre de pestaña se pierde si el SDK no cargó

`formulario_abandonado` se dispara también en `pagehide`, pero el SDK de
analítica se carga diferido (D-58): si alguien abre el panel y cierra la pestaña
antes de que arranque, ese evento se encola y muere con la página.

El camino que importa —"Cancelar" / "← Volver"— no sale de la página y se mide
bien. Si el número de abandonos parece bajo, esta es la primera sospecha.
Arreglarlo bien pide `sendBeacon` contra el Measurement Protocol, que es bastante
más máquina de la que amerita.

### B-58 · Dos interacciones sin medir, por no tocar el JSX

Marcar un encuentro como **cancelado** y tildar **"publicar el link de la
reunión"** están en `onChange` inline dentro del JSX, y medirlas exigía
reacomodar el markup de componentes que otros cambios están tocando. Se dejaron
afuera a propósito.

`url_publica` se mide igual en `guardado_ok`, que es el dato que importa. La
cancelación de un encuentro no se mide en ninguna parte.

Tampoco está el **embudo fino** del formulario (qué campo se tocó último antes de
abandonar): eso pide instrumentar 30+ inputs o un `onFocus` a nivel del `<form>`,
y hoy `formulario_abandonado.faltantes` da la ubicación gruesa sin tocar nada.

### B-59 · La instrumentación suma 2.8 KB gzip al chunk del panel — ❌ descartado (2026-08-24)

El SDK de analítica está diferido y no toca el chunk inicial (D-58); la
proyección y la taxonomía sí. La propuesta era moverlas al lado diferido y dejar
que `medir()` encole los valores crudos.

**Medido primero** (cierre estático de imports de `/admin`, el build real contra
el mismo build con la instrumentación en no-ops):

| | raw | gzip |
|---|---|---|
| Carga inicial de `/admin` hoy | 386.303 B | 107.590 B |
| Sin ninguna instrumentación | 377.245 B | 104.464 B |
| Toda la instrumentación | 9.058 B | 3.126 B (2,9 %) |
| **Solo la taxonomía + la proyección** | **6.522 B** | **2.188 B (2,0 %)** |

O sea que el techo de lo que este ítem podía ganar es **2,14 kB gzip**: el 2,0 %
de la carga inicial comprimida, el 1,7 % de la cruda. (El número viejo, 2.8 KB,
medía toda la instrumentación, no la parte que se iba a mover.)

**Se descarta con ese número.** Hoy la proyección es un único portón sincrónico:
`medir()` proyecta **antes** de encolar, así que lo que espera en la cola —hasta
30 eventos si el SDK no cargó, o nunca carga porque un ad blocker lo bloquea— son
payloads ya sanitizados. Del otro lado, la cola guardaría los valores **crudos**:
contenido del formulario en memoria, y la propiedad que hace valer a los 11 tests
de `analytics-privacidad.test.ts` pasaría a depender de dos pasos en vez de uno.
2,14 kB gzip no paga eso, y si el bundle necesitara kilobytes hay 34,5 kB de SDK
y 186 kB de runtime de React antes en la fila. Ver **D-99**.


---

### B-60 · Ayuda dentro del panel — ✅ hecho (2026-08-21)

Botón "Ayuda" en el encabezado, que abre una capa con la guía: los seis avisos
de lo que no se puede deshacer y un capítulo por sección del formulario, más el
recorrido de una actividad, el listado, las listas que crecen y la carga desde
el teléfono. Contenido en `src/lib/ayuda.ts`, tests en `tests/ayuda.test.ts`.

Ver [CHANGELOG](CHANGELOG.md), D-61 y D-62. Lo que quedó afuera está en B-62 y
B-63.

### B-61 · Historial de novedades del panel — ✅ hecho (2026-08-21)

Pestaña "Novedades" en la misma capa, con "qué podés hacer ahora que antes no
podías" en el idioma de quien carga actividades. Contenido en
`src/lib/novedades.ts` (en el repo, se despliega con el build: D-63), lo no
leído se marca con el id de la última vista en el navegador (D-64), y el aviso
es un número en el botón.

Ver [CHANGELOG](CHANGELOG.md), D-63, D-64 y D-65. Limitaciones en B-64.

### B-64 · Pendientes chicos del centro de ayuda — ✅ hecho (2026-08-24)

Tres cosas conocidas, ninguna urgente. **Dos quedaron cerradas**; la del medio no
es trabajo pendiente sino un costo aceptado en D-63, así que el ítem cierra acá:

- ~~**Las novedades no se anclan a la versión del panel.**~~ ✅ hecho
  (2026-08-24). Mostrarla ya se mostraba; lo que faltaba era **de dónde sale**, y
  esa era la razón de que el campo quedara vacío: `VERSION_APP` incluye el
  `+<sha>` del build, que quien escribe la entrada no puede saber. La versión de
  una novedad es la de `package.json` —la release en la que entra—, y eso quedó
  escrito en el tipo, en el paso 4 del skill `cerrar-cambio` (que era el que
  decía "si se sabe" y por eso nunca se llenaba) y en dos tests: la forma, y que
  no retroceda al bajar por la lista.
- **No se puede corregir una errata ni avisar nada sin desplegar** — costo
  aceptado en D-63. Si algún día hace falta un aviso urgente (una caída), es
  otro problema y otra herramienta.
- ~~**La capa no atrapa el foco.**~~ ✅ hecho (2026-08-24), junto con B-14, que
  era la misma clase en otra pantalla: la capa cicla el Tab sobre sus propios
  controles y devuelve el foco a lo que estaba enfocado antes de abrirse. Ver
  `src/lib/foco.ts`.

### B-100 · Prellenar sede, organizador e inscripción desde lo ya cargado

Extender el patrón del §4 para que elegir "Casa Brandon" complete nombre,
dirección, barrio, ciudad, indicaciones y coordenadas; y lo mismo con el
organizador y su Instagram, y con el canal de inscripción.

**Está en P3 a propósito, y con una condición.** Compite con "Duplicar" (B-11),
que ya resuelve el caso repetitivo real de este circuito —el ciclo del año pasado
con otras fechas— y lo resuelve para los 30 campos, no para tres. Lo que quedaría
es "tres talleres distintos en la misma sede", que existe y es menos frecuente.

Costo escondido: el §4.1 guarda **solo el slug** para que renombrar no toque
documentos, y con una sede eso no sirve (si la sede se mudó, la actividad del año
pasado no debe cambiar de dirección). La actividad tendría que guardar una
**copia** del objeto — segunda fuente de verdad, y el problema de B-04
multiplicado.

Vale la pena **si los datos dicen que las sedes se repiten**, y hoy nadie lo
mide. El vocabulario del §9 puede contestarlo antes de escribir una línea.

### B-101 · Las actividades que ya pasaron no se archivan en ninguna parte

No hay estado para "terminó". Un taller de marzo sigue `publicado` con todas sus
sesiones en el pasado: se mezcla en el listado del panel (ordenado por última
modificación) y, cuando exista el sitio, hay que decidir si aparece.

No hace falta un estado nuevo: se deriva de la última sesión. Lo que hace falta es
decidir qué hacen con eso el listado del panel (¿una pestaña "pasadas"? ¿un
filtro?) y el sitio (¿no las lista pero conserva la página por SEO, que es
probablemente lo correcto?). Cuadra con B-96 y con B-01.

### B-102 · ¿El sistema guarda algo de quien se inscribe? — decisión del dueño

Recomendación: **no**, y queda anotado para que la pregunta no vuelva a aparecer
sin el razonamiento.

Hoy el sistema **no guarda ni un dato personal de un tercero**, y por eso el §5
cabe en una tabla y el §7 se verifica de un pantallazo. Una lista de inscriptos
mete nombres y teléfonos de gente que no usa el sistema, y a partir de ahí la
privacidad, la retención y el borrado pasan a ser responsabilidad del proyecto.

Los tres casos que la pedirían tienen salidas más baratas: el conteo lo resuelve
B-97 con un booleano; el aviso de cancelación lo resuelve B-98 por el calendario,
sin guardar nada de nadie; y la conversación ya vive en el DM, que es donde
además se contesta. Copiarla a mano al panel es trabajo nuevo, y una lista
copiada a mano queda incompleta el primer día ocupado.

Si algún día hace falta, el orden es al revés del intuitivo: primero el aviso
público (B-98), después el estado agregado (B-97), y la lista de personas solo si
eso no alcanzó. Detalle en
[`11-ideas-de-producto.md`](11-ideas-de-producto.md).

### B-77 · `functions/index.js` es el único archivo de `functions/` sin el corte puro/trigger

327 LOC con seis responsabilidades: init de `db`, auth de Calendar, carga de
labels, marcado de rebuild, dos triggers (`syncCalendar`, `rebuildPorOpciones`),
el schedule `dispararRebuild` y un cliente HTTP de GitHub (líneas 239-263).

El resto de `functions/` sí tiene el corte que
[`05-patrones.md`](05-patrones.md) prescribe: `calendario.js`, `rebuild.js`,
`historial.js` y `reportes.js` son puros (877 de las 1.502 LOC) y concentran los
tests más densos del repo; `historial-trigger.js` y `reportes-trigger.js` son los
wrappers. `index.js` quedó afuera, y es el archivo de 327 LOC **sin ningún test**.

Ya se cobró una: el cliente de GitHub se duplicó sin el timeout (B-74). Extraer
`functions/github.js` puro con `fetch` inyectable y mover `syncCalendar` a
`calendario-trigger.js` es medio día y no hay diseño nuevo que discutir — el
patrón se usa cinco veces en el mismo directorio.

**No mover la copia de `CAMPOS_TAXONOMIA` de la línea 84 a `src/`:** `functions/`
se despliega con su propio `package.json` y no puede importar hacia arriba
(D-20 lo evaluó y descartó). Si molesta, la respuesta es un test que compare las
dos listas.

### B-78 · El 26 % de `src/lib/` es prosa, no lógica

`ayuda.ts` (616 LOC de guía) y el array `NOVEDADES` (175 de las 300 LOC de
`novedades.ts`), más `opciones-base.json`, son 937 LOC de **contenido
editorial** conviviendo con un `slugify.ts` de 13 líneas. Se editan cuando cambia
la funcionalidad, no cuando cambia la lógica, y son los archivos #2 y #6 más
grandes del repo por eso.

Mover el contenido a `src/contenido/` y dejar en `novedades.ts` solo las cuatro
funciones (`novedadesNoLeidas`, `leerVisto`, `guardarVisto`, `fechaLegible`) hace
que el ranking de tamaño vuelva a hablar de código. Es cosmético: no cambia
comportamiento ni destraba nada, por eso es P3.

Que el contenido viva en el repo y no en Firestore es decisión cerrada (D-63) y
que sea data tipada y testeada también (D-62). Esto es solo dónde vive el
archivo.

### B-79 · Partir el JSX de `ActividadFormulario` en componentes por sección — ✅ hecho (2026-08-24)

Después de B-70 el archivo queda en ~630 LOC, todas de JSX: nueve `<Seccion>`
en un solo `return`.

| Sección | Líneas | Aprox. |
|---|---|---|
| Qué es | 286-363 | 78 |
| Encuentros | 364-385 | 22 |
| Dónde | 386-515 | 130 |
| Quién | 516-593 | 78 |
| Arancel e inscripción | 594-693 | 100 |
| Material / Opcional / Difusión / Vista previa | 694-858 | 165 |

Vale por la superficie de conflicto: es el segundo archivo más tocado del repo
(9 de 41 commits) y en este proyecto ya se commitearon marcadores de conflicto
que sobrevivieron dos commits
(`tests/sin-marcadores-de-conflicto.test.ts`). Conviene hacerlo cuando no haya
ramas abiertas, y habilita además B-62 (el "?" por sección, que hoy exige tocar
`ActividadFormulario.tsx` en nueve lugares).

### B-174 · Los tests de reglas verifican el `firestore.rules` del checkout equivocado · P2

El emulador sirve las reglas **del directorio desde el que se lo arrancó**, no las
del checkout donde corren los tests. Con un solo repo no se nota. Con varios
worktrees en paralelo —que es cómo se está trabajando este backlog— un test de
reglas puede estar verificando el archivo de otra rama y **dar verde sin haber
probado el cambio**. Es el modo de falla más caro que tiene un test de reglas:
dice "las reglas pasaron" cuando quiere decir "unas reglas pasaron".

Se descubrió haciendo B-31: el emulador estaba levantado desde el checkout
principal, así que la regla nueva no existía para los tests de la rama que la
agregaba. La salida ya está escrita —`cargarReglas()` en `tests/emulador.ts`
empuja el archivo local por la API del emulador— y la usa
`tests/reportes-reintento.integracion.test.ts`.

**Lo que falta** es que la usen los otros tres archivos de integración
(`reportes`, `actividades`, `opciones`), que hoy siguen dependiendo de dónde se
arrancó el emulador. Es una línea en cada `beforeAll`. Se dejó afuera de B-31 a
propósito: tocar los tres archivos a la vez pisa a los otros frentes, y el
`EXIGIR_EMULADOR=1` del CI ya arranca el emulador en el checkout correcto.

Ojo con el efecto compartido: `cargarReglas` cambia las reglas del emulador
**para todos** los tests que estén corriendo contra él. Con un solo checkout es
inocuo; corriendo dos suites en paralelo, la última que carga gana.

### B-175 · El formulario y el listado tienen cada uno su vocabulario de etiquetas · P3

Residual de **B-76**, y la parte que era la causa y no el síntoma. El listado ya
usa `ETIQUETA_ESTADO` de `src/lib/filtrosActividades.ts`, pero
`ActividadFormulario.tsx:71-78` mantiene sus tres mapas propios
(`ETIQUETA_ESTADO`, `ETIQUETA_MODALIDAD`, `ETIQUETA_VIA`).

Ya divergieron: para `modalidad: 'hibrido'` el formulario dice **"Híbrido"** y el
desplegable de filtros dice **"Presencial y virtual"**. Las dos pantallas están a
un clic de distancia y hablan del mismo valor guardado.

El arreglo es el `src/lib/etiquetas.ts` de ~20 LOC que proponía B-76 —con los
mapas de `estado`, `modalidad` y `via`— del que tiren las dos pantallas. **No se
hizo ahora porque toca `ActividadFormulario.tsx`**, que es de la fase 2 del
saneamiento. `tests/etiquetas-de-ui.test.ts` tiene el `it.fails` que se vuelve
`it` el día que se cierre.

Ojo con lo que **no** entra: los `ETIQUETA_*` de `functions/calendario.js` son
prosa del evento público, no etiquetas de UI (el motivo, en B-76).
**Hecho (D-104).** Diez archivos en `src/components/admin/formulario/`: las
nueve secciones, la barra de acciones, el tipo de props común y el vocabulario
de etiquetas de la UI. El JSX se movió verbatim —las props se llaman igual que
las variables que tenían adentro—, así que el diff no esconde ningún cambio de
comportamiento. `ActividadFormulario.tsx` quedó en ~230 LOC: estado, cascadas,
guardado y el orden de las secciones.

Costo: +583 B en la carga inicial de `/admin` (+0,15 %), mismos 4 chunks.

Dos tests que leían el `.tsx` como texto se arreglaron en el mismo cambio
(`ayuda` y `opciones-orden`): ahora leen el directorio, y el de `opciones-orden`
verifica primero que **encontró** el campo, porque un `not.toContain` sobre un
string vacío pasa sin haber mirado nada.

### B-165 · `analytics-privacidad.test.ts` tiene su propia copia de `FORMATO_VERSION` · P3

La tercera copia del formato de versión está en el test de privacidad
(`tests/analytics-privacidad.test.ts:60`), que la usa como predicado de
admisibilidad: un string que matchea el formato se acepta como valor de
parámetro. B-88 amplió el formato real y **no** tocó esa copia, así que hoy es
estrictamente más angosta que la del código.

**No es una fuga y no puede volverse una**: al ser más angosta, lo único que
puede hacer es rechazar un valor que el código sí acepta, o sea dar una falsa
alarma. Hoy ni eso, porque ningún caso del test mete una versión válida en el
payload. El arreglo es importar `FORMATO_VERSION` de `@/lib/analytics-eventos`,
que ya se exporta, y borrar la copia.

No se hizo junto con B-88 a propósito: ese cambio tenía que dejar los 11 tests de
privacidad en verde **sin tocarlos**, que es la única forma de que la garantía
signifique algo.

### B-166 · Un build sin versión estampada es indistinguible de un formato inválido · P3

`VERSION_APP` vale `'desconocida'` cuando no hay versión estampada (dev server,
tests), y el sanitizador lo manda como `'otro'` — el mismo valor que usa para "el
formato no lo reconozco". Después de B-88 el segundo caso no debería ocurrir
nunca, así que un `version: otro` con volumen es una alarma… que hoy se confunde
con el ruido de dev.

Es chico y es de datos, no de código: en dev no se mide (`PUBLIC_USE_EMULATORS`),
así que en producción no debería haber ninguno de los dos. Si algún día se quiere
usar `otro` como alarma, `'desconocida'` tiene que ser un valor propio del
vocabulario en vez de caer en la bolsa.

### B-172 · La trampa 7 del §13 no tiene ningún test · P2

Salió de armar el mapa de B-119, que la calcula en vez de suponerla: de las diez
trampas del §13, la 7 —query pública sin `where('estado','==','publicado')`— es
la única que quedó sin red.

`tests/actividades.integracion.test.ts` cubre las reglas **por documento** (un
anónimo lee lo publicado, no lee un borrador). La trampa habla de otra cosa: con
`allow read` condicionado a `resource.data`, una **query de colección** sin el
`where` se rechaza **entera** en lugar de devolver el subconjunto visible. Es un
modo de falla de la consulta, no del documento, y hoy no hay ninguna query de
colección en el test de reglas.

Casi no muerde mientras el público lea el `events.json` estático (§2.5). Muerde
el día de la primera lectura en vivo del sitio público (B-01), que es justo
cuando nadie se va a acordar del §5.3 — o sea, el peor momento posible.

Son dos `it` en el test de reglas: una `getDocs(collection(db,'actividades'))`
anónima que tiene que rechazarse, y la misma con el `where` que tiene que
devolver solo lo publicado. Toca un test que no es de la fase 4.

### B-171 · El detector de triggers blindados dejó de ver las guardas mudadas a helpers — ✅ hecho (2026-08-24)

> **Numeración:** en la consigna de la fase 4 este ítem se llamó "B-166", pero
> ese número ya estaba tomado por lo de la versión sin estampar. Es B-171.

El chequeo de la clase de B-82 en `tests/clases-de-bug.test.ts` estaba en
`it.skip`. Causa: después del refactor de B-77 el efecto y la guarda de los
triggers viven en helpers, y el detector los buscaba en el cuerpo del trigger.
Dos consecuencias, y la segunda no la había visto nadie:

1. `guardarVersion` y `guardarVersionAlBorrar` dejaron de contar como triggers
   con efecto (su `.set()` se mudó a `guardar()`), así que no había dos
   blindados que contar y el test hubo que apagarlo;
2. `syncCalendar`, que **ya estaba blindado** (B-82 cerrado: `idDeEvento` dentro
   de `crearEvento`), seguía contándose como desguarnecido, así que el
   `it.fails` de B-82 seguía fallando mucho después de que el bug estaba
   arreglado. **Un detector ciego no solo pierde regresiones: también miente
   sobre lo que sigue roto.**

Arreglado siguiendo la llamada (D-102) y con nueve tests del propio detector
contra cuerpos sintéticos, que es lo que faltaba la primera vez. El `it.skip`
volvió a `it` y el `it.fails` de B-82 pasó a `it`.

### B-173 · `npx tsc --noEmit` sale con doce errores de `ImportMeta` · P3

Verificación de la fase 4: `npx tsc --noEmit` termina con doce
`Property 'env' does not exist on type 'ImportMeta'` en `src/lib/analytics.ts`,
`src/lib/firebase-client.ts` y `src/lib/version.ts`. Es ruido conocido —faltan
los tipos que genera `astro sync` (`.astro/types.d.ts`, que no está versionado)—
y el código está bien.

Es P3 porque no rompe nada, y no es cosmético: **el comando de verificación que
usan todos los frentes sale siempre en rojo**, así que un error nuevo de verdad
se esconde entre los doce y nadie lo ve. Se arregla con un `astro sync` antes del
`tsc` en `scripts/verificar-todo.sh` y en el CI, o versionando el
`env.d.ts` con el `/// <reference types="astro/client" />`.

No entró en la fase 4 porque `scripts/verificar-todo.sh` lo corren los cuatro
frentes ahora mismo y tocarlo era pedir un conflicto en el archivo que todos
usan para verificar.

**Y no se descarta mirando `main`, donde sale limpio.** Sale limpio ahí porque
`.astro/` ya está generado en ese directorio de hace rato. Los doce errores
aparecen donde `.astro/` no existe todavía: un **worktree recién creado**, un
clone fresco y **el CI** — o sea, exactamente los tres lugares donde el comando
se corre para decidir algo. Un hallazgo que solo se reproduce en el entorno
limpio es más grave, no menos.
### B-176 · Regenerar los encuentros borra los temas y las lecturas cargados · P2

`generarSesiones` devuelve `tema: ''` y `lectura: ''` en todas las filas, así
que volver a generar las fechas de un club de lectura de ocho encuentros borra
las ocho lecturas asignadas — que es lo más caro de tipear de toda la actividad.
Pasaba desde siempre (el generador reemplazaba la lista entera) y por eso no es
una regresión, pero después de D-103 la fila **conserva su identidad**: el
encuentro 3 sigue siendo el encuentro 3, con su evento de calendario, y perder
su tema dejó de tener sentido.

Es una línea al lado de las dos que ya heredan `id` y `calendarEventId`. Lo que
hay que decidir antes es si conservar el tema es lo que espera quien aprieta el
botón: hoy el cartel dice explícitamente que los borra. Sale con la UI, no
suelto.

El caso que lo hace doler: el ciclo se corre una semana, se regeneran las fechas
y hay que volver a tipear ocho lecturas que no cambiaron.

### B-177 · Nadie avisa cuando una etiqueta nueva no se registró · P3

Con el orden de escritura de D-100, si la actividad se guarda pero falla el alta
de la etiqueta en `/opciones/*`, el guardado es un éxito y la etiqueta queda sin
registrar. Es el modo de falla que se eligió a propósito —es recuperable
tipeándola otra vez— pero hoy **no se ve**: `guardarActividad` devuelve
`etiquetasSinRegistrar: true` y el formulario no lo mira.

No hay dónde mostrarlo con lo que hay: al guardar, el formulario se desmonta y
la pantalla pasa al listado. Las salidas son una franja en el listado (archivo
del frente 3B) o quedarse en el formulario con el aviso. Vale poco por sí solo;
vale más el día que exista la UI de taxonomías (B-06), que es donde la etiqueta
faltante se arregla en un clic.

### B-150 · El panel sigue siendo dueño de `calendarEventId` · P3

B-80 se arregló del lado de la Function (D-91), que es el lado defensivo: el
write-back repone el id que el panel pisó. Lo que **no** cambió es de quién es
el campo: `formADocumento` sigue emitiendo `calendarEventId` en cada guardado,
así que sigue habiendo una ventana en la que el documento tiene `null` y una
sesión sin id.

Con el arreglo de la Function esa ventana ya no deja daño permanente, así que
esto es prolijidad, no un bug: que `actualizarActividad` relea el documento y
fusione los ids por id de sesión antes de escribir, o directamente que
`formADocumento` no emita el campo. Toca `src/lib/actividades.ts` y el
formulario, o sea el archivo más disputado del repo (fase 2 del plan de
saneamiento).


## Agentes y automatización del flujo (B-115 a B-124)

Lo que quedó pendiente al definir los agentes y skills de `.claude/`. El qué hay
y por qué está en [`13-agentes.md`](13-agentes.md). La prioridad va en cada ítem.

### B-115 · Nada invoca a los auditores solos — ✅ hecho (2026-08-24, por B-139)

**Ya estaba cerrado y nadie lo había marcado.** Lo cierra el skill
`.claude/skills/antes-de-pushear`, que entró con B-139: lanza los tres auditores
en paralelo en el momento en que hace falta —antes de un push o un PR—, junta
los hallazgos en una tabla y decide si el push sale. La mitad mecánica
(typecheck, tests con emuladores, build, fuga de credenciales) la corre
`githooks/pre-push` → `scripts/verificar-todo.sh`, porque un hook de git no
puede invocar un modelo.

De los dos caminos que proponía el ítem se tomó el primero (el gate local) y en
mejor forma: no es un hook que gasta una corrida en cada cierre, es un skill que
se dispara con la intención de pushear.

**Lo que queda, y es de otro ítem:** el skill se dispara cuando alguien dice
"pusheá"; un `git push` a secas solo pasa por el gate mecánico, y **el hook
todavía no está activado** (`core.hooksPath`, decisión del dueño — B-138). Si se
quiere que corran sí o sí, es el job de GitHub Actions sobre el PR, que es la
otra mitad de B-124. Si nadie se acuerda, no corren — que
es exactamente el problema que tienen las dos reglas de proceso de
[`05-patrones.md`](05-patrones.md) y que estos agentes venían a resolver.

Dos caminos, y no son excluyentes: un hook local en `settings.json` (correr el
auditor que corresponda al cerrar un cambio) o un job de GitHub Actions sobre el
PR. El hook es inmediato pero cuesta una corrida por cierre; el job de Actions es
más barato de ignorar. Decidirlo con B-124.

### B-116 · La verificación contra el sistema real no está automatizada · P2

[`07-seguridad.md`](07-seguridad.md) y [`08-operacion.md`](08-operacion.md)
tienen el bloque que importa de verdad: leer el ICS del calendario y buscar el
link de reunión, intentar la escritura anónima con `curl`, revisar las cabeceras
de cache, mirar qué versión quedó publicada. Los tests unitarios prueban la
intención; esto lee el resultado.

No se automatizó porque necesita red y secretos —la URL privada del ICS y la API
key de producción— y **un agente no debe tenerlos en la mano** (§5.4). La forma
razonable es un script en `scripts/` que lea las variables del entorno y lo corra
el dueño, con el skill `que-deployar` nombrándolo. Mientras no exista, los
comandos están en la doc y se corren a mano.

### B-117 · `tests/bundle-panel.test.ts` no cubre el tercer chunk — ✅ hecho (2026-08-24)

Hecho, y por la segunda mitad del ítem, que era la que valía. El test ya no
compara literales: recorre el cierre transitivo de imports desde la entrada de
la island (leída de `admin.astro`, no hardcodeada) y afirma dos propiedades —
el SDK pesado no se alcanza siguiendo solo imports estáticos, y lo que se carga
con `import()` no es alcanzable de forma estática—. El tercer chunk y el cuarto
(`ReportesPanel`, `CalendarioActividades`) entran solos, y el quinto también.

De paso cerró B-50 y cubrió la trampa 4 del §13, que era la única de las diez
sin ningún test (ver `docs/15-mapa-de-trampas.md`). Decisión: D-100.

El texto original del ítem, que sigue explicando por qué:

- `ReportesPanel` es el **tercer** componente que `AdminApp` carga con `import()`
  y no está en la lista: volverlo estático deshace el corte y el build queda
  verde;
- ningún test frena un import estático nuevo en `AdminApp`, `firebase-client`,
  `PieVersion`, `AvisoVersionNueva` o `ayuda/` que arrastre `firebase/firestore`
  **por la cadena** de imports, no directamente. Hoy eso se revisa a ojo.

Lo segundo es lo que vale: pide seguir el grafo, no comparar una lista de
literales. Relacionado con B-50.

### B-118 · B-56 quedó desactualizado · ✅ hecho (2026-08-24)

Hallazgo del `auditor-documentacion`. B-56 quedó corregido al cerrar B-88.
Confirmar en GA4 (DebugView) sigue siendo un paso de consola del dueño.

**B-92 dice exactamente lo mismo que este ítem**: el hallazgo se anotó dos veces
en la misma pasada. Los dos se cierran acá.

### B-119 · No hay un mapa trampa → test → archivo — ✅ hecho (2026-08-24)

Está en [`15-mapa-de-trampas.md`](15-mapa-de-trampas.md), y no se lee: se
verifica. `tests/mapa-de-trampas.test.ts` lee la lista de trampas del §13 del
`CLAUDE.md` (no la copia), comprueba que los archivos citados existan, que cada
test citado **nombre** su trampa, y —lo que vale— calcula del repo cuáles no
tienen ningún test y lo compara contra las que el documento declara sin red, en
las dos direcciones.

Resultado de la primera corrida: **dos trampas sin red**. La 4 se cerró en la
misma corrida (B-117); la 7 queda abierta como B-172. Decisión: D-101.

El texto original del ítem:

El `auditor-trampas` reconstruye en cada corrida, con `grep`, qué test nombra
cada trampa del §13. Funciona porque la convención se respeta (los `describe` y
los `it` citan `§7.1`, `trampa 3`), pero es frágil: si mañana un test cambia de
nombre, el agente reporta "sin red" sobre algo que sí está cubierto, o peor, lo
contrario.

Un archivo chico de mapeo —trampa, archivo donde vive, test que la fija— haría el
reporte determinístico y, de paso, un test podría verificar que las diez trampas
sigan teniendo dueño. Es la mitad de B-63 aplicada a las trampas.

### B-120 · Nada verifica que `13-agentes.md` liste los agentes que existen · P3

Un agente nuevo en `.claude/agents/` que no entre al documento es invisible: no
lo va a invocar nadie que lea la doc. Y al revés, un agente borrado deja una
sección que promete algo que no está.

Es el mismo patrón de `tests/ayuda.test.ts` (que falla si el formulario tiene una
sección sin capítulo) aplicado a otra lista, y se resuelve igual: un test que lea
el directorio y el documento. También podría validar el frontmatter, que es
justamente lo que rompió tres agentes en silencio la primera vez (ver
[`13-agentes.md`](13-agentes.md)).

### B-121 · Con el sitio público hay que sumar sus salidas al auditor · P1 (junto con B-01)

Hoy el `auditor-privacidad` audita `toPublic.ts` como **función**, porque el
`events.json` no se genera todavía. Cuando exista el sitio público (B-01) van a
aparecer dos salidas materializadas: el `events.json` y el HTML de las páginas de
detalle. Hay que sumar al agente la verificación sobre el artefacto —el `grep`
sobre `dist/` buscando `difusion`, la URL de la reunión y los uids— y decidir la
cabecera de cache del JSON (B-37).

Va con B-01: hacerlo antes es escribir contra algo que no existe.

### B-122 · Falta un auditor del sitio público · P2 (después de B-01)

El proyecto existe para que la gente encuentre los talleres en Google (§2.3), y
eso se rompe en silencio: un `getStaticPaths` que se saltea una actividad, un
`noindex` que quedó del placeholder, títulos duplicados, la home indexable con
contenido de prueba (DEC-4), datos estructurados que no validan, o el filtro en
memoria que necesita JS y deja el listado vacío para un crawler.

No se puede escribir todavía: `src/pages/index.astro` es un placeholder.

### B-123 · El inventario de infra no se re-releva solo · P3

[`02-infraestructura.md`](02-infraestructura.md) dice que fue relevado con
`gcloud` y `firebase`, "no de memoria", y trae los comandos para repetirlo. Nadie
lo repite. El `auditor-documentacion` puede detectar que la doc se contradice
consigo misma, pero **no** puede saber qué Functions están desplegadas de verdad
ni qué roles tiene una service account: no tiene credenciales y no debe tenerlas.

La forma sensata es un script que corra el dueño y que imprima el inventario en
el formato del documento, para diffear a ojo. Sin eso, el riesgo es el inverso al
habitual: la doc dice que algo falta cuando ya está hecho (ver B-118).

### B-124 · Decisión del dueño: ¿cuándo corren los auditores? · P3

Tres opciones, y la diferencia es plata y fricción:

- **A pedido** (hoy): cero costo, se olvida.
- **En cada cierre de cambio**, por hook: no se olvida, pero son tres corridas
  por cambio y una de ellas usa el modelo caro (`auditor-privacidad` corre en
  `opus` a propósito: un falso negativo ahí es una credencial filtrada o un link
  de reunión público).
- **Solo en el PR**, por Actions: costo acotado y queda escrito en el PR, pero
  llega después de haber commiteado.

Un intermedio razonable: `auditor-privacidad` siempre que el diff toque una de
las cuatro salidas, y los otros dos solo antes del PR. Requiere decidir el
disparador de B-115.

### B-88 · La analítica no reconoce la versión de un build de árbol sucio — ✅ hecho (2026-08-24)

`scripts/version.mjs` produce tres formas y `FORMATO_VERSION` aceptaba solo la
primera (el sufijo de las otras dos lleva guiones y pasa de 20 caracteres), así
que todo build que no saliera de un árbol limpio mandaba `version: otro` en
**todos** sus eventos.

**Lo que se arregló no es el regex, es la costura.** Ampliar el regex a mano
dejaba el mismo problema para el próximo formato que alguien invente — que es
exactamente cómo apareció este. Ahora:

- el productor tiene **un solo lugar** donde se arma la cadena (`componerVersion`,
  puro) y declara al lado su dominio completo de entradas (`ENTRADAS_DE_BUILD`);
- el consumidor sigue con su constante, porque importar el productor arrastraría
  `node:child_process` al bundle (el problema del D-60 con zod);
- **los ata un test**: `tests/version.test.ts` recorre `versionesPosibles()` y
  mete cada salida del productor en el sanitizador real del consumidor, más la
  versión que estampa el árbol de trabajo de quien corre los tests (git de
  verdad). Un formato nuevo del lado del build rompe ese test en vez de mandar
  `otro` a GA4.

El formato se amplió a lo que el build produce, no se abrió: semver más un sufijo
de `[0-9A-Za-z.-]` hasta 40 caracteres, sin espacios ni acentos ni `@ : / ?`.
Nueve entradas rechazadas quedaron fijadas en un test y los 11 de privacidad
siguen en verde sin tocarse.

Los dos `it.fails` de `tests/costuras.test.ts` quedaron promovidos a `it`, y el
grep sobre el fuente de `version.mjs` salió: lo reemplaza el lazo. Ver
[CHANGELOG](CHANGELOG.md) y **D-98**.

### B-89 · Borrar una actividad deja huérfana su subcolección `versiones`

`borrarActividad` es un `deleteDoc`, y Firestore no borra subcolecciones. Las
hasta 20 versiones de `/actividades/{id}/versiones/*` quedan para siempre, con
copias completas del documento (incluidos `online.url` y `difusion`) y sin
ninguna forma de llegar a ellas desde el panel.

No es una fuga: las reglas limitan la lectura al claim `admin` igual que antes
(`match /versiones/{version} { allow read: if esAdmin() }`). Es basura que crece
y datos internos que sobreviven a la decisión de borrar la actividad.

Lo barato es una Function `onDocumentDeleted` que borre la subcolección, del
mismo tamaño que la poda que ya existe en `historial-trigger.js`. Sin test: la
escritura de versiones es un trigger, así que verificarlo pide los emuladores con
Functions.

### B-91 · Un slug legítimo que termine en `-copia` no se puede publicar

`esSlugDeCopia` es `/-copia(?:-\d+)?$/` sobre el slug entero, y el schema lo usa
para bloquear la publicación. Un título que derive en algo como
`taller-de-copia` (o cualquier cosa que termine en esa palabra) queda imposible
de publicar, con un mensaje que habla de un sufijo que la persona no puso.

Es un borde angosto y el error es del lado seguro (bloquea, no publica una URL
rota), así que P3. Si molesta, la marca de copia puede ir en el estado y no en el
texto del slug.

### B-92 · B-56 quedó desactualizado en este mismo archivo — ✅ hecho (2026-08-24)

Duplicado de **B-118**: el mismo hallazgo anotado dos veces. B-56 quedó
corregido al cerrar B-88.


## Cerrados

Se dejan para que quede el rastro de qué se rompió.

| Qué | Causa | Dónde |
|---|---|---|

| Editar un encuentro desde la vista calendario y volver por el encabezado mandaba al listado y perdía el mes que se estaba mirando | el botón "← Volver" hacía `setVista({tipo:'lista'})` fijo, mientras el "Cancelar" del formulario ya respetaba `volverA`: dos salidas del mismo formulario con dos criterios | B-35, `AdminApp.tsx` |
| El listado y el calendario contestaban "¿ya pasó?" con campos distintos: un taller en curso desaparecía del listado a los minutos de empezar | `proximoEncuentro` filtraba por `inicio`, `yaPaso` por `fin`, y el fixture de los tests tenía `fin === inicio`, así que la diferencia era indetectable (patrón B-84) | auditoría del calendario, H1 |
| `desSlug` estaba copiado idéntico en el panel y en la descripción del evento | mejorar uno separaba los dos sin que nada fallara (D-20) | H2 |
| El calendario mostraba alarma roja después de cada publicación, diciendo que el sync había fallado | el texto afirmaba falla sobre algo en vuelo; el write-back del id tarda segundos | H3 |
| El aviso de encuentros pasados decía "ya no tiene arreglo" también para los que sobran en el calendario público | contaba junto `falta` y `sobra`, que piden lo opuesto | H4 |
| El orden de tres desplegables lo decidía el orden de llegada de los datos, y un test lo cementaba | `listarActividades()` no garantiza orden estable | H5 |
| La conversión `Timestamp` → `Date` estaba duplicada en dos módulos | es el corazón de la trampa 1; divergir habría hecho que el listado y el calendario discrepen sobre cuáles sesiones existen | H6 |
| Pisar una descripción larga la perdía para siempre | no había historial: el §12 estaba pendiente desde el principio (B-03) | D-41, D-42, D-43 |
| "Elegí el arancel" al guardar un formulario que parecía completo | el placeholder se renderizaba como el primer `<option>` con valor `""`, y el texto era un ejemplo ("Gratis, a la gorra…") que se veía idéntico a una opción elegida | `2fab7ef`, D-12 |
| El evento de Calendar quedaba sin mapa o con el mapa en otra ciudad | `location` mandaba solo `sede.direccion`, sin ciudad ni país | `90edc8a`, D-10 |
| iOS Safari hacía zoom al enfocar un campo y no volvía | inputs a 14px; iOS hace zoom por debajo de 16px | `2fab7ef` |
| La barra fija de acciones quedaba debajo de la barra de gestos del iPhone | faltaba `viewport-fit=cover` y `env(safe-area-inset-bottom)` | `2fab7ef` |
| Un usuario sin el claim hacía fallar la regla de Firestore | `request.auth.token.admin`: leer una clave ausente de un map es *evaluation error*, no `false` | `9a45c86`, D-05 |
| `createdAt`/`createdBy` se perdían al editar | `setDoc` con `merge:false` borraba los campos que el form no incluye | `9a45c86` |
| El primer deploy de Functions falló dos veces | la service account propia no tiene los roles que la default de Compute trae de fábrica | `af88f84`, D-06 |
| Riesgo: agregar un campo a la descripción del evento sin agregarlo a `CAL_FIELDS` dejaba de propagarlo, en silencio | lista de campos mantenida a mano | `90edc8a`, D-07 |
| Riesgo: un panel abierto días corriendo JS viejo — bugs ya arreglados que se vuelven a reportar, y bugs corregidos que se siguen usando | SPA estática sin versión ni cabeceras de cache: el HTML cacheado hacía que recargar volviera a pedir los mismos assets | D-36, D-37, D-38 |
| El checkbox "publicar el link de la reunión" no hacía nada | la proyección y el evento descartaban la URL sin mirar el flag | D-15 |
| **B-02** · No había quién atendiera el `repository_dispatch`: el paso 5 del §10 estaba a medias | faltaba el workflow de Actions y la config del repo. Queda pendiente **B-20** (credenciales del dueño) y el deploy de la Function | `.github/workflows/deploy.yml`, D-22 |
| **B-02** · `dispararRebuild` leía `process.env.GITHUB_TOKEN` sin declarar el secreto | en Functions v2 eso da `undefined` en producción: el PAT solo habría funcionado versionado en `functions/.env`, que es lo que el §5.4 prohíbe | D-21 |
| **B-81** · El título de un reporte salía sin redactar al issue de GitHub, que es público: un mail o un link de reunión escrito ahí quedaba a la vista | `construirIssue` pasaba `descripcion` y `pasos` por `redactar()` y el `titulo` no, que es el renglón más visible. El formulario del panel promete en pantalla que el panel los tapa | `functions/reportes.js`, `tests/costuras.test.ts` |
| **B-13** · Un `repository_dispatch` fallido reintentaba cada 5 minutos para siempre, sin límite ni registro | el fallo no dejaba rastro fuera de un log: ni contador, ni error persistido, ni forma de saber que el sitio estaba viejo | `functions/rebuild.js`, D-23 |

| Riesgo: `arancel` preseleccionado en "Gratis" podía publicar un taller pago como gratuito | la preselección se aplicó a todos los campos con opciones base, sin distinguir el costo de equivocarse | D-16 |

