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

---

## P2 — mejoras reales

### B-03 · Historial de versiones (§12)

Un `onDocumentUpdated` que escriba el `before` completo en
`/actividades/{id}/versiones/{timestamp}`. El §12 dice que son 5 líneas.

Las reglas ya contemplan la subcolección. **Hoy pisar una descripción larga la
pierde**, y el §12 avisa que tarde o temprano pasa.

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

No hay testing-library instalada. La lógica pura está muy cubierta (256 tests),
pero el render y la interacción del formulario se verificaron a mano.

Vale al menos para `TaxonomiaSelect` (el bug del placeholder que se veía como
opción elegida habría salido en un test de render), para el editor de sesiones y
para el `MenuAcciones` del listado (cierre por click afuera y por `Escape`) y
para `VistaPreviaEvento`: su adaptador está testeado, pero que el aviso del
link público se muestre —y que la descripción tenga su propio scroll— se
verificó a mano.

### B-09 · El bundle del panel pesa 576 KB

Es el SDK de Firebase. Queda aislado en `/admin` y la home carga 8 KB, así que
no afecta al público ni al SEO. Se podría bajar con imports más finos o carga
diferida de Firestore, pero no es urgente.

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

## P3 — cuando sobre tiempo

### B-10 · `aprobada` en las opciones (§4.3)

Para cuando cargue gente además del dueño: las opciones nuevas funcionan pero no
aparecen en el desplegable de los demás hasta ser validadas.

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

## Cerrados

Se dejan para que quede el rastro de qué se rompió.

| Qué | Causa | Dónde |
|---|---|---|
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

