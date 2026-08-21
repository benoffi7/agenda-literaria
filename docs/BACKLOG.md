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

## P0 — rompe algo o pierde datos

Los dos salieron de revisar las costuras del merge del 2026-08-21: cada feature
está testeada por dentro, el par no. Los tests que los demuestran están en
[`tests/costuras.test.ts`](../tests/costuras.test.ts), marcados `it.fails` para
no romper el CI: fallan el día en que alguien los arregle, que es cuando hay que
venir a borrar el `.fails`.

### B-80 · Guardar desde el listado pisa el `calendarEventId` y la edición siguiente duplica el evento

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

### B-82 · `syncCalendar` no es idempotente: una reentrega duplica el evento

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

~~B-02 · Trigger de rebuild~~ → [cerrado](#cerrados), con pasos manuales
pendientes del dueño (ver arriba).

### B-83 · El rebuild del sitio cuelga del sync a Calendar

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

## P2 — mejoras reales

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

### B-84 · Cancelar un encuentro de un ciclo renumera y reescribe los otros siete

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

### B-85 · El debounce del rebuild se come el cambio que llega mientras dispara

`dispararRebuild` lee `sistema/rebuild`, habla con GitHub (hasta 15 s de
timeout) y después escribe `registrarExito`, que baja `pendiente` sin comparar
contra lo que hay en el documento. Una actividad guardada en esa ventana marca su
rebuild y el tick se lo lleva: el build que arrancó no la incluye y ya nadie va a
pedir otro. El sitio queda viejo hasta la próxima edición ajena.

Es poco probable (una ventana de segundos cada cinco minutos) y el daño es
acotado, pero el arreglo también: `registrarExito` en una transacción que solo
baje `pendiente` si `actualizado` sigue siendo el que se leyó, o un token de
generación en el documento.

Test en [`tests/costuras.test.ts`](../tests/costuras.test.ts).

### B-86 · `usos` solo cuenta creaciones, así que el orden por frecuencia no funciona

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

### B-87 · El formulario nace sucio, así que el aviso de versión nunca se recarga solo

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

### B-90 · "Generar N encuentros" sobre un ciclo publicado borra y recrea los ocho eventos

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

## P3 — cuando sobre tiempo

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

### B-88 · La analítica no reconoce la versión de un build de árbol sucio

`scripts/version.mjs` produce tres formas: `1.0.1+5e2cb50`,
`1.0.1+5e2cb50-sucio.20260821-2124` y `1.0.1+sin-git.20260821-2124`. El
sanitizador `FORMATO_VERSION` de `analytics-eventos.ts` solo acepta la primera:
el sufijo de las otras dos lleva guiones y pasa de 20 caracteres, así que el
parámetro viaja como `otro`.

O sea que en cualquier build que no salga de un árbol limpio —y con
`registrarVersion(VERSION_APP)` ya enchufado, eso es todo lo que se prueba a
mano— los eventos pierden justo el dato que existe para atribuir un pico a un
deploy. Producción se buildea limpio, así que el impacto real es sobre los datos
de desarrollo, que igual no se miden (`PUBLIC_USE_EMULATORS`). Queda acá y no más
arriba por eso.

El arreglo es ampliar el sanitizador a las formas que el build produce de verdad
(el guion y el largo del sello), no abrirlo: el punto del formato cerrado sigue
siendo que `version` no pueda ser una puerta de texto libre.

Tests en [`tests/costuras.test.ts`](../tests/costuras.test.ts), con una guarda
para que se enteren si `version.mjs` cambia de formato.

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

### B-92 · B-56 quedó desactualizado en este mismo archivo

B-56 dice que nadie llama a `registrarVersion(VERSION_APP)`; el merge lo enchufó
en `AdminApp` (efecto de montaje, al lado de `medirPanelAbierto`). La entrada
sigue pidiendo una línea que ya está escrita. Vale borrarla — y de paso es lo que
destapa B-88, que hasta ese merge no tenía efecto.

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
| **B-81** · El título de un reporte salía sin redactar al issue de GitHub, que es público: un mail o un link de reunión escrito ahí quedaba a la vista | `construirIssue` pasaba `descripcion` y `pasos` por `redactar()` y el `titulo` no, que es el renglón más visible. El formulario del panel promete en pantalla que el panel los tapa | `functions/reportes.js`, `tests/costuras.test.ts` |
| **B-13** · Un `repository_dispatch` fallido reintentaba cada 5 minutos para siempre, sin límite ni registro | el fallo no dejaba rastro fuera de un log: ni contador, ni error persistido, ni forma de saber que el sitio estaba viejo | `functions/rebuild.js`, D-23 |

| Riesgo: `arancel` preseleccionado en "Gratis" podía publicar un taller pago como gratuito | la preselección se aplicó a todos los campos con opciones base, sin distinguir el costo de equivocarse | D-16 |

