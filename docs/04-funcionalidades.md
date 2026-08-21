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
encuentros, barrio y un badge de estado. Editar y borrar por fila.

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
- **Guardar borrador** valida igual que publicar. Un borrador inválido no se
  guarda.
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
lo conserva en el documento.

### Taxonomías con autocompletado

El campo "Otro" es un input con autocompletado contra la lista existente. Si se
escribe "gor" y aparece "A la gorra", el 90% de los duplicados no llega a nacer
(§4.2). Si lo tipeado normaliza a un slug que ya existe, avisa que va a reusar
esa opción en lugar de crear una nueva.

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

**El repo es público, así que el issue también.** El formulario lo dice, el issue
**no** lleva el mail ni el uid de quien reportó (D-32), el texto libre pasa por un
filtro que tapa mails y links de reunión (D-33), y el título de la actividad
referida se copia solo si ya está publicada. El detalle sin recortar y quién lo
cargó quedan en Firestore.

**Limitación:** las respuestas del dueño se leen en GitHub. El panel todavía no
las trae de vuelta (B-30), y tanto el formulario como la lista lo aclaran.

## Sync a Google Calendar

Automático: cualquier escritura en `/actividades/{id}` dispara `syncCalendar`.

| Qué pasa en el panel | Qué pasa en el calendario |
|---|---|
| Se publica una actividad | un evento por sesión no cancelada |
| Se corre la fecha de un encuentro | se actualiza **solo** ese evento |
| Se cambia la sede o el título | se actualizan **todos** los eventos del ciclo |
| Se borra un encuentro | se borra **solo** su evento |
| Se cancela un encuentro | se borra su evento |
| Pasa a borrador, pendiente o cancelado | se borran todos sus eventos |
| Se borra la actividad | se borran todos sus eventos |
| Se vuelve a publicar | se crean de nuevo |

### Qué lleva el evento

**Título:** el de la actividad, más el tema del encuentro si tiene.

**Ubicación:** sede, calle, barrio, ciudad y país, para que Google pueda
geolocalizar. Mandar solo la calle no alcanza.

**Descripción:** todo lo cargado en el formulario que sea publicable —
posición en el ciclo, descripción, tema y lectura del encuentro, modalidad,
sede con "cómo llegar" y link a Google Maps, plataforma, arancel con notas,
inscripción con vía, cupo y cierre, material, organizador, tallerista con bio,
y tags.

**Lo que nunca lleva** (§5.1): la difusión interna, la URL del material privado,
los uids. El link de la reunión solo si se tildó "publicar el link" en esa
actividad. Ver [`07-seguridad.md`](07-seguridad.md).

## Trigger de rebuild — parcial

`syncCalendar` y `rebuildPorOpciones` escriben `sistema/rebuild.pendiente = true`.

`dispararRebuild` (el schedule que haría el `repository_dispatch` a GitHub cada
5 minutos, con debounce) **está escrito pero sin desplegar**: falta el sitio
público y el workflow de Actions.

## Sitio público — no existe

`src/pages/index.astro` es un placeholder. Falta todo el paso 3: listado con
filtros, `events.json`, páginas de detalle por slug.

`toPublic.ts` (la proyección) y `normalize.ts` (la búsqueda) ya están escritos y
testeados, así que la base está.

## Historial de versiones — no existe

El §12 pide un `onDocumentUpdated` que escriba el `before` completo en
`/actividades/{id}/versiones/{timestamp}`. Las reglas ya contemplan esa
subcolección, pero la Function no está escrita.
