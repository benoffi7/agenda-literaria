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

### B-21 · Alerta de rebuild agotado (opcional)

Cuando el rebuild se rinde después de cinco intentos, loguea
`el rebuild agotó los reintentos` con nivel `error` y deja el motivo en
`sistema/rebuild`. Convertir eso en un aviso real es una log-based alert de GCP
sobre ese mensaje: configuración de consola, no código. Queda a criterio del
dueño (D-23).

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

---

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

### B-31 · Un reporte en `error` no se puede reintentar desde el panel

Si la creación del issue falla por configuración (token vencido, permiso, repo
mal escrito), el reporte queda guardado en estado `error` y visible en el panel,
pero no hay botón para reintentar: las reglas prohíben que el cliente toque el
documento (el ciclo de vida es de la Function). Hoy se reintenta a mano con el
Admin SDK — el comando está en [`08-operacion.md`](08-operacion.md).

Opciones: una acción del panel que escriba solo `estado: 'pendiente'` con una
regla que permita ese único cambio, o una función `onCall` de reintento.

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

### B-41 · Borrar una actividad no guarda versión y no hay nada que recuperar

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

### B-04 · Renombrar una etiqueta no actualiza los eventos ya creados

La descripción del evento muestra la etiqueta, no el slug (D-11). Si se renombra
"A la gorra", los eventos existentes siguen diciendo lo anterior hasta la
próxima edición de la actividad.

`rebuildPorOpciones` solo marca el rebuild del sitio. Opciones: re-sincronizar
las actividades publicadas cuando cambia `/opciones/*`, o aceptarlo y
documentarlo (ya está documentado).

### B-05 · Las etiquetas de taxonomía se ven en público sin normalizar

Un tag creado como "narrativa" (minúscula) aparece así en el calendario público
y va a aparecer en los filtros del sitio. Ya pasó: `/opciones/tags` tiene
`narrativa="narrativa"`.

Opciones: capitalizar la primera letra al crear, o una UI para editar etiquetas
(el §4.3 dice que las creadas con "Otro" son editables y borrables — esa UI no
existe).

### B-06 · No hay UI para administrar taxonomías

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

### B-50 · Verificar el corte del bundle después de mergear analytics

`firebase/analytics` se agregó en paralelo, también de forma diferida. Los dos
cambios apuntan al mismo número, así que después del merge conviene un
`npm run build` y confirmar que el SDK de analytics **no** aparece en el chunk
inicial de `/admin` (el que la island carga como `component-url`). Si aparece,
alcanza con que el módulo que lo inicializa no sea alcanzable de forma estática
desde `AdminApp` (D-51).

### B-35 · Salir del panel con cambios sin guardar no avisa

El store de `formulario-sucio.ts` ya sabe que hay cambios pendientes, y el aviso
de versión nueva lo usa. Pero cerrar la pestaña, volver a la lista o tocar
"Cancelar" sigue descartando el formulario sin preguntar.

Con el dato ya disponible es un `beforeunload` y una confirmación en el botón de
volver. Queda fuera de este cambio porque toca el flujo del formulario, no el de
versiones.

### B-36 · La versión no distingue dos builds sucios del mismo commit

`+a1b2c3d-sucio.20260821-2129` lleva sello de tiempo, así que dos builds sucios
distintos sí se ven distintos. Lo que no se puede saber es **qué** cambió: el
sufijo dice "esto no es ningún commit" y nada más.

Es aceptable porque producción se buildea de un árbol limpio. Si alguna vez se
deploya desde un árbol sucio en serio, la salida es un hash del diff.

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

### B-56 · Enchufar `registrarVersion(VERSION_APP)`

`src/lib/version.ts` se mergeó después, así que el setter existe
(`registrarVersion` en `src/lib/analytics.ts`) pero nadie lo llama: hoy los
eventos viajan sin el parámetro `version`.

Es **una línea** en `AdminApp` (o en `admin.astro`):
`registrarVersion(VERSION_APP)`. Sin eso, un pico de errores de validación no se
puede atribuir a un deploy, que es la mitad de la utilidad de medirlos.

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

### B-96 · "Esta semana" arriba del listado

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

### B-70 · Sacar la lógica de dominio de `ActividadFormulario.tsx`

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

### B-71 · Un guardado que falla deja opciones de taxonomía huérfanas

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

### B-72 · La deduplicación §4.2 del cliente está implementada dos veces

`TaxonomiaSelect.tsx` y `TagsInput.tsx` resuelven el mismo problema del §4 con
dos implementaciones separadas, y ya divergieron:

| Regla | `TaxonomiaSelect` | `TagsInput` |
|---|---|---|
| Filtro de sugerencias | tope 8, con texto vacío muestra las primeras 8 | tope 6, con texto vacío muestra nada |
| Dedupe por slug | avisa "Ya existe como «X» — se va a reusar esa" | reusa en silencio |
| Badge "sin aprobar" | JSX propio | JSX propio, idéntico |

El §4.2 está marcado **crítico** en el `CLAUDE.md`. La transacción de
`src/lib/opciones.ts` sí está testeada contra el emulador; la mitad del cliente
—la que evita que el 90 % de los duplicados nazca— tiene dos copias, ambas en
`.tsx`, ninguna con test.

Arreglo: extraer `sugerenciasPara(texto, elegibles, tope)` y
`resolverEtiqueta(texto, valores)` a un módulo puro de ~40 LOC con sus tests, y
que los dos componentes las llamen. **Los componentes no se unifican**: un
`<select>` con "Otro" y un input de chips son widgets distintos.

### B-73 · Los tags no se miden

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

### B-74 · `crearIssue` no tiene timeout y puede colgar el trigger de reportes

`functions/index.js:230` define `TIMEOUT_DISPATCH_MS` con el comentario "Sin esto
un socket colgado se come el tick entero", y lo usa con `AbortSignal.timeout` en
`dispararDispatch`.

`functions/reportes-trigger.js` copió las cinco cabeceras de esa llamada
(líneas 66-71 ≡ `index.js:242-247`) **pero no el timeout**: no tiene ningún
`AbortSignal`. Un socket colgado contra la API de GitHub deja la invocación
corriendo hasta el timeout de la plataforma.

Son dos líneas. Y es el ejemplo de por qué B-77 vale: el conocimiento estaba
escrito, en una sola de las dos copias.

### B-75 · Tres enums del modelo están copiados en `analytics-eventos.ts` sin guardia

| Original (`src/types/actividad.ts`) | Copia (`src/lib/analytics-eventos.ts`) |
|---|---|
| `ESTADOS` (línea 26) | `ESTADOS_DESTINO` (línea 45) |
| `MODALIDADES` (línea 23) | `MODALIDADES_MEDIBLES` (línea 47) |
| `CAMPOS_TAXONOMIA` (línea 212) | `CAMPOS_TAXONOMIA_MEDIBLES` (línea 134) |

`analytics-eventos.ts` **ya importa `@/types/actividad`** (línea 2) y ese módulo
no importa nada, así que traer las tres constantes cuesta cero bytes de bundle:
el argumento de D-60 (importar zod metía 68 kB en el chunk inicial) no aplica acá.

Sin guardia, agregar un sexto `tipo` o un quinto `estado` hace que la analítica
lo mande como `'otro'` en silencio — exactamente el modo de falla que D-60
describe y previene, una góndola más allá.

Arreglo: seis líneas, importar en vez de copiar. Si por algún motivo se quieren
dejar separados, el patrón correcto ya existe: un test que las derive, como
`tests/analytics-campos.test.ts` hace con `CAMPOS_VALIDABLES`.

### B-76 · El listado muestra el estado en slug crudo

`ListaActividades.tsx:124` renderiza `{a.estado}`, así que la píldora dice
"borrador" y "publicado" en minúscula, mientras el formulario dice "Borrador" y
"Publicado" (`ETIQUETA_ESTADO`, `ActividadFormulario.tsx:73-78`). Es la misma
actividad en dos pantallas con dos escrituras.

Pasa porque el vocabulario de etiquetas es local al formulario. Un
`src/lib/etiquetas.ts` de ~20 LOC con los tres mapas (`estado`, `modalidad`,
`via`) que usen el formulario y el listado lo cierra.

**No incluir los mapas `ETIQUETA_*` de `functions/calendario.js`**: esos son
prosa para el evento público ("Presencial y virtual", "por DM de Instagram"), no
etiquetas de UI. Unificarlos haría que un cambio de copy del panel cambie lo que
se publica en el calendario.


## P3 — cuando sobre tiempo

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

### B-10 · `aprobada` en las opciones (§4.3)

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

### B-14 · El menú de acciones del listado no se navega con flechas

`MenuAcciones` cierra con `Escape` y con un click afuera, y sus ítems son
`<button role="menuitem">` alcanzables con Tab, pero no implementa el patrón
completo de menú ARIA (flechas arriba/abajo, foco que vuelve al disparador al
cerrar). Con dos ítems alcanza; si el menú crece, conviene completarlo.

### B-25 · Aprobar taxonomías desde el panel

Hoy aprobar (§4.3) necesita `scripts/aprobar-opciones.mjs`, o sea una máquina
con Node y `gcloud`: desde el teléfono no se puede. La pantalla natural es la
administración de taxonomías de **B-06** (editar, borrar, ver `usos`), que
tampoco existe — conviene hacer las dos juntas. Decisión: D-29.

Prioridad real: sube a P2 si el dueño empieza a cargar desde el teléfono.

### B-26 · Nadie se entera de que hay algo para aprobar

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

### B-59 · La instrumentación suma 2.8 KB gzip al chunk del panel

El SDK de analítica está diferido y no toca el chunk inicial (D-58), pero la
proyección y la taxonomía sí: +11.2 KB (2.8 KB gzip) sobre `AdminApp.js`.

Si el trabajo de bajar el bundle (B-09) necesita esos kilobytes, se puede mover
`construirEvento` y los vocabularios al lado diferido y dejar que `medir()`
encole los valores crudos. **No se hizo de entrada** porque parte la garantía de
privacidad en dos pasos: hoy la proyección es un único portón sincrónico, y eso
vale más que 2.8 KB.


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

### B-64 · Pendientes chicos del centro de ayuda

Tres cosas conocidas, ninguna urgente:

- **Las novedades no se anclan a la versión del panel.** `Novedad` ya tiene un
  campo `version` opcional y `src/lib/version.ts` expone `VERSION_APP`, así que
  atarlos es corto: estampar la versión al agregar la entrada y mostrarla al
  lado de la fecha. Sirve sobre todo para un reporte de bug ("con la versión en
  la que salió tal cosa"). Las entradas viejas no la tienen porque el versionado
  llegó después.
- **No se puede corregir una errata ni avisar nada sin desplegar** — costo
  aceptado en D-63. Si algún día hace falta un aviso urgente (una caída), es
  otro problema y otra herramienta.
- **La capa no atrapa el foco.** Cierra con `Escape`, con el botón y con un
  click en el fondo, y al abrirse el foco va al diálogo, pero con Tab se puede
  salir hacia el formulario de atrás. Es el mismo patrón incompleto que B-14.

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

### B-79 · Partir el JSX de `ActividadFormulario` en componentes por sección

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

## Agentes y automatización del flujo (B-115 a B-124)

Lo que quedó pendiente al definir los agentes y skills de `.claude/`. El qué hay
y por qué está en [`13-agentes.md`](13-agentes.md). La prioridad va en cada ítem.

### B-115 · Nada invoca a los auditores solos · P2

Los tres auditores (`auditor-privacidad`, `auditor-trampas`,
`auditor-documentacion`) hay que pedirlos. Si nadie se acuerda, no corren — que
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

### B-117 · `tests/bundle-panel.test.ts` no cubre el tercer chunk · P2

Hallazgo del `auditor-trampas` en su primera corrida. El test cuida cinco cosas
del corte del bundle (B-09, D-51), pero:

- `ReportesPanel` es el **tercer** componente que `AdminApp` carga con `import()`
  y no está en la lista: volverlo estático deshace el corte y el build queda
  verde;
- ningún test frena un import estático nuevo en `AdminApp`, `firebase-client`,
  `PieVersion`, `AvisoVersionNueva` o `ayuda/` que arrastre `firebase/firestore`
  **por la cadena** de imports, no directamente. Hoy eso se revisa a ojo.

Lo segundo es lo que vale: pide seguir el grafo, no comparar una lista de
literales. Relacionado con B-50.

### B-118 · B-56 quedó desactualizado · P3

Hallazgo del `auditor-documentacion`. B-56 dice que `registrarVersion` existe
pero que nadie lo llama, y hoy se llama en `src/components/admin/AdminApp.tsx`
(`registrarVersion(VERSION_APP)`), así que los eventos ya viajan con el parámetro
`version`. Falta confirmarlo en GA4 y cerrar el ítem.

No se tocó B-56 al encontrarlo porque no era parte del cambio que lo detectó: se
anota para que quede el rastro, que es la regla.

### B-119 · No hay un mapa trampa → test → archivo · P3

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


## Cerrados

Se dejan para que quede el rastro de qué se rompió.

| Qué | Causa | Dónde |
|---|---|---|
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
| **B-13** · Un `repository_dispatch` fallido reintentaba cada 5 minutos para siempre, sin límite ni registro | el fallo no dejaba rastro fuera de un log: ni contador, ni error persistido, ni forma de saber que el sitio estaba viejo | `functions/rebuild.js`, D-23 |

| Riesgo: `arancel` preseleccionado en "Gratis" podía publicar un taller pago como gratuito | la preselección se aplicó a todos los campos con opciones base, sin distinguir el costo de equivocarse | D-16 |

