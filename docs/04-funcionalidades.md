# Funcionalidades

Lo que el sistema hace hoy. Lo que falta está en [`BACKLOG.md`](BACKLOG.md).

## Panel de admin — `/admin`

### Acceso

Login con Google. Sin el custom claim `admin` el panel muestra una pantalla de
"sin permisos" con el uid y el comando para otorgarlo.

Las reglas de Firestore rechazan la escritura del lado del servidor de todas
formas: la pantalla solo evita mostrar un panel inútil.

### Listado

Búsqueda por `searchText`, que ignora acentos y mayúsculas (§6) — la misma
normalización que va a usar el sitio público. Cada fila muestra tipo, cantidad de
encuentros, barrio y un badge de estado.

Acciones por fila: **Editar** como botón, y un menú "⋯" con **Duplicar** y
**Borrar**. Van en un menú porque tres botones en fila en 360px dan blancos
táctiles de ~100px y se erra el toque (D-19).

El menú implementa el patrón de menú de ARIA (B-14): se abre con ↓ o ↑ cayendo en
el primero o en el último ítem, se recorre con las flechas dando la vuelta, con
`Home`/`End` va a los extremos, y al cerrarse con `Escape` **devuelve el foco al
"⋯"** — sin eso había que re-tabular el listado entero para volver a la fila.

### Duplicar una actividad

Abre el formulario precargado con una copia del original, para editar y guardar
como actividad **nueva**. El caso es el ciclo del año anterior con otras fechas:
son 30+ campos que no hay que volver a cargar.

Lo que la copia **no** hereda:

| Qué | Por qué |
|---|---|
| los ids de sesión | son la llave del diff a Calendar (§7.2). Compartirlos haría que editar una actividad toque los eventos de la otra |
| `calendarEventId` | queda `null`: los eventos del original existen, los de la copia no |
| el slug | se propone `…-copia` y queda editable — es inmutable después de publicar (trampa 10) |
| el estado | arranca en `borrador`: duplicar no publica ni manda nada al calendario |
| `createdAt` / `createdBy` | son de la copia, no del original |
| los encuentros cancelados | vuelven a estar activos: una cancelación es una excepción del ciclo viejo |

**Las fechas se corren en semanas enteras** hacia adelante, hasta después del
último encuentro del original (y siempre en el futuro). Así se conservan el día
de semana, la hora, las duraciones y los huecos irregulares del ciclo, y solo
hay que ajustar las excepciones nuevas. También se corre el cierre de
inscripción. El detalle y las alternativas descartadas están en D-17.

El formulario avisa arriba que es una copia y nombra los tres campos a revisar
antes de publicar: título, slug y fechas.

### Formulario

30+ campos organizados en secciones, **condicional por tipo** (§11). Se elige el
tipo primero y el resto se adapta:

| Campo | Aparece en |
|---|---|
| `material` | club de lectura (abierto por defecto), o si se tilda |
| `tallerista` | taller |
| autor invitado | presentación, charla — el mismo campo, con otro label |
| `sede` | presencial, híbrido |
| `online` | virtual, híbrido |

Secciones: Qué es · Encuentros · Dónde · Quién · Arancel e inscripción ·
Material · Opcional · Difusión. Las tres últimas son acordeones colapsados.

**Comportamientos no obvios:**

- El **slug** se deriva del título y queda **bloqueado** una vez publicada la
  actividad: cambiarlo rompe la URL y el SEO (trampa 10).
- Elegir **club de lectura** activa "es ciclo" y "tiene material", porque es
  casi siempre así.
- `tipo` y `plataforma` **preseleccionan la primera opción**. `arancel` **no**:
  obliga a elegir, porque su default sería "Gratis" y un taller pago sin
  corregir se publicaría como gratuito (D-16). `barrio` y `tags` arrancan
  vacíos porque no tienen opciones base.
- El checkbox **"publicar el link de la reunión"** sí tiene efecto: con él
  tildado, la URL sale en el `events.json` y en la descripción del evento.
  Arranca destildado y advierte sobre el zoombombing (D-15).
- El **punto exacto en el mapa** (`sede.geo`) es opcional: se pega el link de
  Google Maps del lugar —o un par `lat, lng`— y con eso el link del evento
  apunta al punto en vez de hacer que Google adivine por la dirección (D-46).
  Se aplica al pegar, sin apretar nada. Los links cortos `maps.app.goo.gl` no
  traen coordenadas y el campo lo dice, con qué hacer para salir del paso. Un
  punto lejos de Argentina no bloquea: avisa. Se puede quitar y volver a
  "sin coordenadas". Para confirmar que se cargó bien: el campo muestra la
  coordenada con un link al mapa, y la **vista previa del evento** muestra la
  ubicación y el link de Maps tal como van a salir.
- **Guardar borrador** valida igual que publicar. Un borrador inválido no se
  guarda.
- **No se puede publicar con el slug propuesto para una copia** (`…-copia`).
  Guardarlo como borrador sí, porque la copia nace justamente con ese slug: el
  bloqueo es solo al publicar, porque ahí el slug queda fijo para siempre
  (trampa 10).
- Las etiquetas creadas con "Otro" se persisten **en el submit**, no al
  tipearlas: abandonar el formulario no debe dejar basura en la taxonomía.

### Editor de sesiones

Filas dinámicas: agregar, duplicar, borrar, ordenar por fecha. Cada fila con su
`id` uuid generado al crearse.

**"Generar N encuentros"** toma la fecha y duración del primer encuentro y crea N
filas cada X días. Reemplaza la lista actual y las fechas quedan **editables una
por una**: los ciclos siempre tienen excepciones (un feriado, una semana que se
corre).

Marcar un encuentro como cancelado lo borra del calendario público (§7.3) pero
lo conserva en el documento. **No renumera a los demás:** el número del evento
cuenta también los cancelados (D-95), así que el que decía "Encuentro 6 de 8"
sigue diciéndolo y su evento no se toca.

### Vista previa del evento de Calendar

Última sección del formulario, colapsada. Se elige un encuentro y se ve cómo va
a quedar su evento: **título**, **ubicación** y **descripción completa**.

Lo arma `construirEvento` de `functions/calendario.js`, la misma función que
publica el evento (D-20): lo que se ve es exactamente lo que va a ver la gente,
con las reglas de privacidad del §5.1 incluidas — el link de la reunión solo si
se tildó "publicar el link", la difusión interna nunca, la URL del material
privado tampoco.

Tres avisos, porque son las cosas que se pasan por alto:

- **El link de la reunión va a salir** (`urlPublica` tildado): aviso destacado,
  porque el calendario es público (D-15, trampa 5).
- **El link no sale:** nota al pie de que se envía a quienes se inscriban.
- **La actividad no está publicada, o el encuentro está cancelado:** ese evento
  hoy no existe en el calendario (§7.3); la vista previa muestra cómo quedaría.

Las etiquetas de taxonomía se resuelven con las opciones que el panel ya tiene
cargadas, incluidas las que se acaban de crear con "Otro" y todavía no están en
`/opciones/*` (se persisten en el submit, D-02).

Mientras haya un encuentro con la fecha incompleta la vista previa lo dice, en
lugar de mostrar un evento a medias.

### Taxonomías con autocompletado

El campo "Otro" es un input con autocompletado contra la lista existente. Si se
escribe "gor" y aparece "A la gorra", el 90% de los duplicados no llega a nacer
(§4.2). Si lo tipeado normaliza a un slug que ya existe, avisa que va a reusar
esa opción en lugar de crear una nueva.

### Aprobación de etiquetas nuevas (§4.3)

Hay dos cuentas cargando actividades, así que una etiqueta que inventa una no
aparece sola en el desplegable de la otra:

| Quién | Qué ve de una opción recién creada |
|---|---|
| quien la creó | la ve y la puede elegir, marcada **"(sin aprobar)"** |
| la otra cuenta | no la ve en el desplegable ni en las sugerencias |
| la otra cuenta, editando una actividad que ya la usa | ve su etiqueta con "(sin aprobar)" y el valor no se pierde |
| el sitio público y el calendario | la etiqueta se muestra normal (no el slug) |

Lo que **no** cambia: la actividad se guarda con ese slug sin ninguna fricción,
y la etiqueta se sigue resolviendo en todas las salidas (una opción pendiente en
el evento de Calendar dice "Con beca parcial", no "con-beca-parcial").

Si alguien tipea en "Otro" una etiqueta que ya existe como pendiente de la otra
cuenta, el formulario avisa y **reusa** ese slug: la deduplicación del §4.2 gana
sobre la visibilidad.

Las opciones base (`fijo: true`) están aprobadas por definición, y **las que ya
estaban cargadas antes de que existiera el campo siguen visibles** (D-26).

Aprobar es una tarea de mantenimiento, no de carga: se hace con
`scripts/aprobar-opciones.mjs` (ver [`08-operacion.md`](08-operacion.md)). No hay
UI en el panel todavía (D-29).

### Mobile y tablet

El formulario es usable en teléfono:

- Campos a 16px hasta `sm`. **iOS Safari hace zoom sobre la página** al enfocar
  un input de menos de 16px y después no vuelve solo.
- `viewport-fit=cover` con `env(safe-area-inset-*)` en la barra fija de
  acciones, que si no queda debajo de la barra de gestos del iPhone.
- Blancos táctiles de 44px, solo cuando el puntero es grueso (`pointer: coarse`).
- Lo que no cabe en 360px pasa a columna.
- Teclados por campo: numérico en cupo, de URL en los links, sin autocapitalizar
  ni autocorregir en slug, handles y URLs.

### La versión está siempre a la vista

Al pie de las tres pantallas del panel —login, "sin permisos" y el panel mismo—
está la versión que está corriendo. Si hay una publicada distinta, lo dice y
ofrece un botón para actualizar; si el panel ya se va a recargar solo, no ofrece
el botón, porque viviría un segundo.

Si no se pudo leer `/version.json` dice **"no se pudo verificar"** en lugar de
insinuar que está al día: el caso en que ese dato importa es justamente cuando
algo falla.

Para qué sirve tenerla siempre visible: es el dato que hace accionable un
reporte. El formulario de reportes ya la manda solo, pero cuando el problema se
cuenta por WhatsApp o de palabra, tiene que poder leerse de algún lado.

### Versión y actualización automática

El panel sabe qué versión está corriendo y detecta cuando la publicada es otra.

- La versión se estampa en el build: `0.1.0+a1b2c3d` (versión del
  `package.json` + SHA corto del commit). Viaja dentro del bundle, así que
  identifica al JS que está corriendo en esa pestaña.
- `/version.json` dice cuál es la publicada. Se sirve sin cachear.
- El panel lo consulta al abrirse, **al volver a la pestaña** y cada 15 minutos
  si está a la vista, con un piso de un chequeo por minuto.

Qué hace cuando no coinciden:

| Situación | Qué pasa |
|---|---|
| No hay un formulario a medio cargar | recarga sola, sin preguntar |
| El formulario tiene cambios sin guardar | **no recarga**: aviso fijo arriba, sin botón de cerrar, que pide guardar primero |
| Se guarda el formulario con el aviso puesto | ya no hay nada que perder → recarga sola |
| Ya recargó por esa versión y sigue sin coincidir | avisa que recargar no alcanzó, en vez de entrar en loop de recargas |

El aviso muestra las dos versiones (`corriendo → publicada`): es lo que hay que
copiar en un reporte de bug.

Recargar mientras alguien completa los 30+ campos le borra varios minutos de
trabajo, y eso es peor que tener el JS viejo. De ahí que el único caso en que el
panel no decide solo sea ese.

### Ayuda y novedades del panel

Botón **"Ayuda"** en el encabezado, visible en todas las pantallas. Abre una
capa —no una vista del router (D-61)— con dos pestañas: **Guía** y
**Novedades**. Al ser una capa, se puede consultar desde el formulario sin
desmontarlo y sin perder lo cargado.

En mobile ocupa la pantalla completa con su propio scroll y su safe-area; desde
`sm` es un cuadro centrado. Cierra con "Cerrar", con `Escape` y con un click en
el fondo. Mientras está abierta, el `body` no scrollea.

Con teclado, la capa **cicla el Tab sobre sus propios controles** y al cerrarse
devuelve el foco a lo que estaba enfocado antes de abrirla (B-64). Antes se salía
con Tab hacia el formulario de atrás, que sigue montado y tapado.

**Guía** — el contenido vive en [`src/lib/ayuda.ts`](../src/lib/ayuda.ts) como
data tipada, no repartido en JSX (D-62):

- Arriba y sin colapsar, los **seis avisos de lo que no se puede deshacer**: la
  dirección web que queda fija al publicar, el link de la reunión que solo se
  publica si se tilda la casilla, lo que es interno y nunca sale, cancelar un
  encuentro, pasar a borrador (borra todos los eventos) y el calendario como
  espejo de solo lectura.
- Después, un **capítulo por sección del formulario** (con el mismo título) más
  cuatro que no son secciones: el recorrido de una actividad hasta la gente, el
  listado, las listas que crecen con "Otro", el aviso de versión nueva, las
  novedades y la carga desde el teléfono. Cada capítulo dice **para qué** sirve
  la sección y lista los comportamientos que no se ven; los puntos marcados como
  "cuidado" llevan una barra de acento.
- El capítulo que aparece desplegado depende de desde dónde se abrió: del
  listado abre "El listado de actividades"; del formulario, "Cómo llega una
  actividad a la gente".

**No duplica la ayuda de campo.** Los textos cortos de un campo puntual siguen
en la prop `ayuda` de `Campo`, al lado del campo. La guía es el *para qué* y lo
que no se ve.

**Novedades** — [`src/lib/novedades.ts`](../src/lib/novedades.ts), en el repo y
desplegado con el build (D-63). Es el changelog traducido a "qué podés hacer
ahora que antes no podías": lo más nuevo arriba, con la fecha, dos frases y
dónde está en el panel. No es `CHANGELOG.md`, que es técnico y no le sirve a
quien carga actividades.

Lo no leído se marca por navegador (D-64): se guarda el id de la última novedad
vista y el botón "Ayuda" muestra un número con las posteriores. Sin marca
guardada (primera vez, navegador nuevo) **todo cuenta como nuevo**, que es la
invitación a leer la lista completa. Con una marca que ya no existe en la lista,
no avisa nada: preferimos perder un aviso antes que gritar novedades ya leídas.

El aviso es solo ese número. No hay ventana que se abra sola ni cartel que haya
que cerrar: se apaga al abrir la pestaña de novedades una vez. Si el navegador
no permite guardar datos (ventana privada), el número reaparece en la próxima
visita y nada se rompe.

**Quién lo mantiene:** la regla de proceso está en
[`05-patrones.md`](05-patrones.md) — un cambio que se nota al usar el panel
entra en `novedades.ts`, y un comportamiento que no se adivina entra en
`ayuda.ts`, en el mismo commit. `tests/ayuda.test.ts` falla si el formulario
tiene una sección sin capítulo, así que una sección nueva no puede quedar sin
ayuda.

### Reportar bugs y sugerencias

Botón "Reportar algo" en el encabezado del panel. El formulario pide:

| Campo | Detalle |
|---|---|
| Tipo | "Algo no funciona" o "Se me ocurre algo". Ordena el resto del formulario |
| En una línea | el título del issue |
| Qué pasó / la idea | el cuerpo |
| Cómo se repite | opcional, solo en un bug |
| Cuánto molesta | solo en un bug: me bloquea / molesta / es un detalle |
| Dónde estabas | se pregunta, no se deduce: el problema suele pasar en la pantalla anterior |
| Actividad | opcional, para referenciar una actividad concreta |

Además se manda solo, sin preguntar: navegador, tamaño de ventana, ruta, **zona
horaria** (sin la zona un bug de fechas no se diagnostica — trampa 1) y la
**versión del bundle** que estaba corriendo (`VERSION_APP`, `0.1.0+<sha>` más la
fecha del build): con ese string el dueño rebuildea el código exacto contra el
que se reportó, y si el árbol estaba sucio al buildear la versión lo dice.

**Qué pasa después.** El panel escribe en `/reportes/{id}` y la Cloud Function
`reporteAIssue` crea un issue en `benoffi7/agenda-literaria` con el PAT en
Secret Manager: el token nunca está en el panel (§5.4). El número de issue vuelve
al documento y aparece en la lista "Últimos reportes" un segundo después, sin
recargar.

Estados que muestra la lista: *guardado, creando el issue…* → *en GitHub* (con
link al issue) o *no se pudo publicar* (con el motivo). El reporte queda guardado
en Firestore pase lo que pase con GitHub (D-31).

**Reintentar (B-31).** Un reporte en *no se pudo publicar* tiene un botón
**Reintentar**: lo vuelve a poner en cola y la Function lo toma de nuevo, con los
intentos a cero. La lista se mueve sola de un estado al otro. Conviene arreglar
antes la causa —token vencido, permiso, repo mal escrito— o vuelve a fallar.
Solo aparece en ese estado: en cualquier otro el reporte está en cola, en vuelo o
ya publicado, y "reintentar" significaría un segundo issue del mismo reporte
(D-101).

**El repo es público, así que el issue también.** El formulario lo dice, el issue
**no** lleva el mail ni el uid de quien reportó (D-32), el texto libre pasa por un
filtro que tapa mails y links de reunión (D-33), y el título de la actividad
referida se copia solo si ya está publicada. El detalle sin recortar y quién lo
cargó quedan en Firestore.

**Limitación:** las respuestas del dueño se leen en GitHub. El panel todavía no
las trae de vuelta (B-30), y tanto el formulario como la lista lo aclaran.

## Analítica del panel

El panel está instrumentado para encontrar **fricción**, no para contar visitas:
dónde se abandona una carga, qué campos fallan validación y con qué frecuencia,
cuánto tarda una carga completa, qué funciones se usan de verdad, y mobile
contra escritorio.

Son **ocho eventos** con nombres estables, documentados uno por uno en
[`09-analitica.md`](09-analitica.md) — ese documento es la referencia, porque el
valor de esto aparece meses después y nadie se acuerda qué medía cada nombre.

Lo que hay que saber sin abrirlo:

- **No sale contenido ni datos personales.** Ni títulos, ni descripciones, ni
  mails de inscripción, ni links de reunión, ni handles, ni direcciones, ni
  uids, ni el mail de quien está logueado. Se mide *que* un campo falló
  validación y *cuál* campo, nunca qué se escribió (ver
  [`07-seguridad.md`](07-seguridad.md)).
- **No se mide en desarrollo.** Con `PUBLIC_USE_EMULATORS=true` no sale nada, y
  los tests corren con ese flag.
- **Un fallo de analítica no rompe el panel.** El SDK entra por un `import()`
  diferido: si lo bloquea un ad blocker o falla la red, el formulario sigue
  funcionando igual.
- **Las dos personas se distinguen por un identificador aleatorio** del
  navegador, no por el uid ni por el mail.
- Los datos se ven en GA4, pero **hay que registrar los parámetros como
  dimensiones personalizadas** antes de que aparezcan en los informes, y los
  informes tardan 24-48 h. Los pasos están en
  [`09-analitica.md`](09-analitica.md).


## Sync a Google Calendar

Automático: cualquier escritura en `/actividades/{id}` dispara `syncCalendar`.

| Qué pasa en el panel | Qué pasa en el calendario |
|---|---|
| Se publica una actividad | un evento por sesión no cancelada |
| Se corre la fecha de un encuentro | se actualiza **solo** ese evento |
| Se cambia la sede o el título | se actualizan **todos** los eventos del ciclo |
| Se borra un encuentro | se borra su evento, y los demás se **actualizan**: el ciclo cambió de largo, así que el "de 8" de los otros pasó a ser falso (B-160) |
| Se cancela un encuentro | se borra su evento, y **ningún otro se toca** (B-84, D-95) |
| Pasa a borrador, pendiente o cancelado | se borran todos sus eventos |
| Se borra la actividad | se borran todos sus eventos |
| Se vuelve a publicar | se crean de nuevo |

### Qué lleva el evento

**Título:** el de la actividad, más el tema del encuentro si tiene.

**Ubicación:** sede, calle, barrio, ciudad y país, para que Google pueda
geolocalizar. Mandar solo la calle no alcanza.

**Mapa:** si la sede tiene coordenadas cargadas (`sede.geo`), el link de la
descripción apunta al punto exacto; si no, a la búsqueda por el texto de la
ubicación (D-10, D-46).

**Descripción:** todo lo cargado en el formulario que sea publicable —
posición en el ciclo ("Encuentro 3 de 8", contando también los encuentros
cancelados: D-95), descripción, tema y lectura del encuentro, modalidad,
sede con "cómo llegar" y link a Google Maps, plataforma, arancel con notas,
inscripción con vía, cupo y cierre, material, organizador, tallerista con bio,
y tags.

**Lo que nunca lleva** (§5.1): la difusión interna, la URL del material privado,
los uids. El link de la reunión solo si se tildó "publicar el link" en esa
actividad. Ver [`07-seguridad.md`](07-seguridad.md).

## Trigger de rebuild — completo en código, sin desplegar

Con SSG una actividad nueva no existe hasta que se rebuildea (§8). El lazo es:

1. `syncCalendar` y `rebuildPorOpciones` escriben
   `sistema/rebuild.pendiente = true` con el motivo. `syncCalendar` lo marca
   **antes** de hablar con Calendar y por haber cambiado el contenido editable
   de la actividad, no por haber generado operaciones de calendario (B-83,
   D-92): `destacado` e `imagenUrl` van al sitio y no al evento.
2. `dispararRebuild` (schedule cada 5 minutos) ve el flag y manda un
   `repository_dispatch` con `event_type: rebuild` a `benoffi7/agenda-literaria`.
3. `.github/workflows/deploy.yml` corre los tests, buildea el sitio y lo
   despliega a Firebase Hosting.
4. Con el dispatch aceptado, el flag baja a `false`.

**El debounce vive en el paso 2:** cinco ediciones seguidas marcan el mismo
documento cinco veces y disparan un solo build. Latencia resultante: ~2-7
minutos, más lo que tarde el workflow.

El workflow también corre a mano desde la pestaña Actions
(`workflow_dispatch`), que es la forma de probarlo y de republicar después de un
cambio de código: no se dispara con el push a `main`.

### Qué pasa si el dispatch falla

El flag queda en `true` y el schedule reintenta con backoff exponencial: a los
5, 10, 20 y 40 minutos del fallo anterior. A los 5 intentos (~75 minutos) se
rinde, para no golpear la API de GitHub cada 5 minutos indefinidamente.

Todo queda en `sistema/rebuild`:

| Campo | Qué dice |
|---|---|
| `intentos` | fallos consecutivos del dispatch |
| `ultimoError` | el error del último fallo (`HTTP 401 Bad credentials`, un timeout…) |
| `ultimoIntento` | cuándo se intentó por última vez — de acá sale el backoff |
| `agotado` | `true` si se agotaron los intentos y dejó de reintentar |

Al agotarse se loguea un `error` (una vez, no uno cada 5 minutos). El contador
se resetea de dos maneras: un disparo exitoso, o **un cambio nuevo** — editar
cualquier actividad rearma los intentos, así que el lazo se recupera solo
cuando el problema de fondo se resuelve.

**Falta desplegarlo.** No falta código: falta el PAT de GitHub en Secret
Manager y el secret de deploy en GitHub, que solo puede crear el dueño. Ver
[`08-operacion.md`](08-operacion.md).

## Sitio público — no existe

`src/pages/index.astro` es un placeholder. Falta todo el paso 3: listado con
filtros, `events.json`, páginas de detalle por slug.

`toPublic.ts` (la proyección) y `normalize.ts` (la búsqueda) ya están escritos y
testeados, así que la base está.

## Historial de versiones — sin UI todavía

Cada vez que una edición pisa algo que cargó una persona, `guardarVersion`
(`onDocumentUpdated`) deja el documento anterior en
`/actividades/{id}/versiones/{version}`. Antes de esto, **pisar una descripción
larga la perdía para siempre**.

| Qué pasa en el panel | Qué pasa en el historial |
|---|---|
| Se edita cualquier campo y se guarda | queda una versión con el documento anterior |
| Se guarda sin haber cambiado nada | nada: no se pisó nada |
| El sync escribe `calendarEventId` de vuelta | nada: no lo tipeó una persona |
| Se crea una actividad, o se duplica una | nada: no hay documento anterior |
| Se borra la actividad entera | queda una versión con `borrado: true` y el documento completo (B-41) |

Se conservan las **últimas 20 versiones** por actividad; al pasarse, se borra la
más vieja (D-42).

**No hay pantalla para verlas ni para restaurar.** Se recupera a mano desde la
consola de Firestore: se abre la subcolección `versiones` de la actividad, se
elige la versión —el id es la fecha y hora, y `camposCambiados` dice qué pisó esa
edición— y se copia el valor del campo desde `documento` de vuelta al
formulario. Es incómodo, pero el dato **existe**, que es lo que faltaba. La UI
está en el backlog (B-40).

**Borrar una actividad sí guarda versión** (B-41, D-94): `guardarVersionAlBorrar`
(`onDocumentDeleted`) escribe el documento completo con `borrado: true`, así que
una actividad borrada por error se puede volver a cargar copiando y pegando desde
la consola. **Limitación que queda:** el documento padre ya no existe, así que
esa subcolección es alcanzable por path pero invisible desde el panel — y la
actividad se recrea con otro id (B-89).
