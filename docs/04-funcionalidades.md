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

**Mapa:** si la sede tiene coordenadas cargadas (`sede.geo`), el link de la
descripción apunta al punto exacto; si no, a la búsqueda por el texto de la
ubicación (D-10, D-46).

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
