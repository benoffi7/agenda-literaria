# Roadmap de Agenda LEH — septiembre 2026

Relevamiento hecho el 2026-09-24 sobre `main` (commit `ff570ca`), en solo lectura.
Leí el `CLAUDE.md`, `docs/README.md`, las funcionalidades (04), el sitio público
(12), la analítica del panel y del sitio (09 y 16), la operación (08), las ideas de
producto (11), el BACKLOG vivo con sus decisiones pendientes y los ítems que
cito del de cerrados.

**Cómo leer los tamaños.** **S** = medio día a un día. **M** = dos a cinco días.
**L** = una semana o más, casi siempre porque suma una entidad nueva al modelo.

**Cómo leer las prioridades.** **Ahora** = lo próximo que haría. **Próximo** =
después de eso, o cuando se dé la condición que se indica. **Más adelante** = vale
la pena y todavía no es el momento.

**Las decisiones del dueño** van marcadas con 🟨 **Decisión**, con la pregunta ya
escrita y mi recomendación al lado.

---

## Antes que nada: dónde está el proyecto

El sistema está mucho más completo de lo que suele estar un proyecto de este
tamaño. Hoy existen:

- **El sitio**: listado con búsqueda y filtros, la página de cada actividad, la
  cartelera de afiches, las páginas por mes, por tipo, por barrio y por ciudad, lo
  gratis, lo online, el archivo de lo que ya pasó, «mis favoritos» sin cuenta, la
  Guía con cuatro directorios (librerías, suscripciones literarias, lugares y
  bibliotecas), el formulario público para proponer una actividad, la suscripción
  al calendario, el alta al correo y la página para anunciantes.
- **El panel**: carga con dos formas de formulario, duplicar, editor de encuentros
  y de «opciones para sumarse», vista de calendario, autoguardado, historial con
  restauración, dos roles (dueño y publicador por ciudad), bandeja de propuestas,
  bandejas de la Guía, taxonomías con aprobación, reportes de bugs, **texto listo
  para redes** (anuncio y recordatorio, ya con el link a la página), **borrador del
  correo semanal** y el **tablero «Estado del catálogo»** (catálogo y visitas).
- **Automatismos**: espejo en Google Calendar, publicación del sitio con demora
  controlada, aviso por mail cuando el sitio no se publica, chequeo diario de que
  lo publicado aparece de verdad, resumen diario de Google Analytics y Search
  Console, borrado programado de propuestas y fichas vencidas, optimización y
  limpieza de imágenes.

O sea que el roadmap no es «qué falta para que exista». Es **qué haría rendir más
lo que ya existe**, y dónde hay un riesgo que hoy nadie está mirando.

Los tres agujeros que más me llamaron la atención:

1. **No hay copia de seguridad de la base.** Firestore es la única fuente de
   verdad (§2.1) y no encontré ninguna exportación programada ni recuperación a un
   punto en el tiempo en la infraestructura documentada. El historial por
   actividad protege contra «pisé una descripción», no contra «se borró la
   colección».
2. **Una decisión aprobada se cayó del backlog.** Cancelar un encuentro sin que
   desaparezca del calendario (**B-98**) se aprobó el 2026-08-26 y **nunca se
   construyó**, pero el archivador lo mandó a los cerrados porque su título dice
   «✅ aprobado». Hoy no figura en ningún lugar de trabajo pendiente.
3. **Dos interruptores de Google Analytics hacen que el sitio diga más de lo que
   hace**: las interacciones con formularios siguen prendidas y ya mandan
   datos del alta al correo y de `/proponer` (**B-874**, P1), y nadie verificó
   Google Signals ni la personalización de anuncios (**B-773**), mientras
   `/anunciar` promete que no hay píxel ni red.

---

## Top 5 — lo que haría primero, y por qué

| # | Qué | Por qué primero | Tamaño |
|---|---|---|---|
| 1 | **Apagar los dos interruptores de Google Analytics que hoy filtran o hacen mentir al sitio** (B-874, B-773) | Es la única cosa de la lista que **está pasando ahora**, no que podría pasar: cada alta al correo y cada propuesta le avisan a Google, contra lo que el sitio promete. Son diez minutos de consola del dueño y cierran un P1 de privacidad. El §5 es ley | S (consola) |
| 2 | **Copia de seguridad automática de la base** | Todo el trabajo de carga de un año vive en un solo lugar sin respaldo. Es barato (centavos por mes), aburrido y es lo único de esta lista cuyo costo de no hacerlo es irrecuperable | M |
| 3 | **Cancelar un encuentro avisa en vez de borrar** (B-98) | Ya estaba decidido y aprobado por el dueño. Es el momento en que el calendario público vale más —el dato cambió después de que la gente lo agendó— y hoy el evento simplemente desaparece. Además hay que rescatarlo del archivo de cerrados | M |
| 4 | **«Compartir» y «Agendar este encuentro» en la página de cada actividad** | El tráfico real llega desde Instagram, cuyo navegador interno no tiene «compartir» cómodo; el diseño del sitio ya lo pedía y quedó sin hacer. Agendar un encuentro suelto es lo que quiere quien no se va a suscribir a la agenda entera. Cero JavaScript de terceros, cero datos | S |
| 5 | **«El lunes de difusión»: una sola pantalla con todo lo de la semana para salir a redes y al correo** | El panel ya arma el correo de la semana y el texto por actividad, pero en lugares distintos y de a una. Juntarlos —el correo, un posteo de «esta semana», y los recordatorios de mañana— convierte una hora de copiar y pegar en diez minutos, que es lo que hace que la difusión no se muera una semana ocupada | S–M |

**El que casi entra:** la analítica por actividad («cuáles se miran mucho y no
generan ningún mensaje»). Lo dejé en «próximo» solo por calendario: la medición
arrancó el 2026-09-03 y el primer mes completo se cumple el **3 de octubre**. Ese
día pasa al primer lugar del eje de analítica.

---

## Eje 1 · Sitio público

### 1.1 · Compartir y agendar desde la página de la actividad — **Ahora** · S

- **Qué gana quien visita:** con un toque manda el taller por WhatsApp a la amiga
  con la que va, y con otro se lo agenda en su calendario sin suscribirse a la
  agenda entera.
- **Qué ya existe:** el diseño del sitio lo pedía y quedó marcado como lo único
  que falta del detalle (§4.3, «menos la barra fija de móvil y el botón
  Compartir»). La página ya tiene el patrón de botón sin framework («copiar la
  dirección del calendario»).
- **Riesgo / costo:** chico. «Agendar» se arma como un link a la plantilla de
  evento de Google y un `.ics` de un solo evento generado en el build, **sin** el
  link de la reunión (trampa 5): la misma regla que el evento del calendario
  público. No suma terceros en la carga de la página.
- **Nota técnica:** `src/pages/actividad/[slug].astro`; el cuerpo del evento
  debería salir de la misma construcción que ya usa el calendario (`functions/calendario.js`)
  para no tener una tercera derivación. Pasa por el `auditor-privacidad`
  (salida pública nueva).

### 1.2 · Los links pegados en la descripción se pueden tocar (B-980) — **Ahora** · S

- **Qué gana quien visita:** el Instagram o el formulario que el organizador pegó
  en la descripción deja de ser texto muerto que hay que copiar a mano.
- **Qué ya existe:** decidido por el dueño el 2026-09-16 (D-723) y especificado
  entero en el BACKLOG, incluidas las tres cosas que pueden salir mal.
- **Riesgo / costo:** es la primera vez que el sitio convierte en HTML un texto que
  escribió gente de afuera (`/proponer` y la Guía): el orden «escapar primero,
  linkear después» es innegociable y lleva `nofollow`. Solo en la página de
  detalle; ni al calendario ni al marcado para Google.

### 1.3 · Encuentro cancelado visible en la página y en el calendario (B-98) — **Ahora** · M

Ver el eje 5 (control de datos) para el detalle: es a la vez una mejora del sitio
y del espejo en Calendar. En el sitio, la página del ciclo muestra el encuentro
tachado con su motivo («se pasa al jueves 3») en vez de un hueco.

### 1.4 · Efemérides literarias (B-959) — **Próximo** · L · 🟨 Decisión

- **Qué gana quien visita:** una razón para volver aunque no esté buscando un
  taller («hoy nació Cortázar»), y el sitio gana contenido indexable que hoy no
  tiene.
- **Qué ya existe:** el ítem está diseñado (colección propia, día y mes sin año,
  el sitio las trae todas y el navegador elige la del día: cero publicaciones
  extra). El dueño fijó que va **después de los P1**.
- **Riesgo / costo:** es una entidad nueva: modelo, pantalla del panel, proyección
  pública y páginas. No toca el calendario (a propósito).
- 🟨 **Decisión pendiente, ya escrita en el BACKLOG:** *¿Dónde se ven las
  efemérides: un renglón en la home, en la página de cada mes, en una sección
  propia `/efemerides` con página por efeméride, o varias?* **Recomiendo: sección
  propia con página por efeméride + un renglón en la home.** La sección es la que
  suma al objetivo (Google); el renglón es el que hace que alguien la vea.

### 1.5 · Páginas por organizador — «todo lo de Casa Brandon» — **Próximo** · L

- **Qué gana quien visita:** seguir a un espacio o a una tallerista que le gustó y
  ver todo lo que hace, pasado y futuro. Para el organizador, una página propia
  para linkear desde su bio.
- **Qué ya existe:** decidido cómo se hace (D-723, decisión 8): el organizador se
  vuelve una taxonomía como ya pasó con la ciudad, con autocompletado y sin
  duplicados por tipeo. El §12 del diseño la llama «lo más valioso que falta». El
  dueño la puso **detrás de efemérides y bibliotecas** (bibliotecas ya está).
- **Riesgo / costo:** migrar el texto libre actual a opciones (hay 74 cuentas de
  Instagram distintas en la base al 2026-09-07); hay una herramienta de
  reubicación que ya se usó para barrios y que se niega a adivinar, que es lo
  correcto.
- **Nota técnica:** patrón de D-710 (`src/lib/geografia.mjs`,
  `scripts/sembrar-geografia.mjs`) y de los hubs (`src/lib/hubsPublicos.ts`).

### 1.6 · Avisar en el sitio cuando una actividad arranca «esta semana» con lugar — **Más adelante** · S

- **Qué gana quien visita:** en la tarjeta, «Empieza el jueves · quedan lugares»
  empuja a escribir hoy y no el domingo.
- **Qué ya existe:** el estado «completo» (B-97), el cierre de inscripción y el
  tríptico «¿Qué hay ahora?» de la home.
- **Riesgo / costo:** el sitio es estático: un «esta semana» impreso en el HTML
  envejece. Tiene que decidirlo el navegador (como el tríptico) o no hacerse.

### Lo que **no** propongo para el sitio, porque ya se descartó con motivo

| Idea | Por qué no | Dónde |
|---|---|---|
| Buscador externo (Algolia, Typesense) | Prematuro; la búsqueda en memoria anda hasta miles de actividades | CLAUDE.md §2.5 |
| Mapa con todas las sedes | Librería pesada, tiles de terceros, API que puede ser paga; el link a Google Maps ya resuelve «cómo llego» | 12-sitio-publico §12 |
| RSS o calendario por hub | El calendario público ya cubre la suscripción; más formatos, más cosas que se desincronizan | 12-sitio-publico §12 |
| Imágenes de Open Graph por tipo | Descartado el 2026-09-07 | B-291 |
| Modo oscuro | Es una decisión de marca, no técnica | 12-sitio-publico §12 |
| Campo «acepta incorporaciones tardías» | Ya se deduce del cierre de inscripción | D-723 |

---

## Eje 2 · Panel de admin

### 2.1 · Un aviso por mail cuando entra una propuesta o una ficha de la Guía — **Ahora** · M

- **Qué gana quien carga:** no tiene que acordarse de abrir la bandeja; la
  propuesta de un organizador se contesta el mismo día y no a la semana, que es
  cuando deja de servir.
- **Qué ya existe:** la bandeja con su contador en el panel, y el proyecto ya manda
  mails de aviso (deploy fallido, B-1140) con una casilla propia.
- **Riesgo / costo:** el mail al dueño **no** debe llevar el contacto de quien
  propone ni el texto: solo «entró una propuesta nueva: *título*», con el link a la
  bandeja. Hoy el mail sale desde GitHub Actions; para esto hace falta una
  Function con la contraseña de aplicación en Secret Manager (§5.4).
- 🟨 **Decisión:** *¿Querés un mail por cada propuesta, o un resumen diario a las 9
  con todo lo que entró?* **Recomiendo el resumen diario**: con el alta pública
  abierta en cuatro formularios, uno por cada envío se vuelve ruido, y el diario
  puede sumar también lo del punto 5.3 (datos para revisar).
- **Nota técnica:** `functions/propuestas-trigger.js`, `functions/directorios-trigger.js`;
  el criterio de qué sale es el de `functions/reportes.js` (`redactar()`).

### 2.2 · Las actividades que ya pasaron, fuera del medio (B-101) — **Ahora** · S

- **Qué gana quien carga:** el listado deja de mezclar el taller de marzo con el de
  la semana que viene.
- **Qué ya existe:** la mitad del sitio está hecha (`/pasadas`); lo que queda de
  B-101 es justo el panel. El «pasada» ya se deriva de la última fecha.
- **Riesgo / costo:** ninguno de datos. Es un filtro («Por venir / Pasadas /
  Todas», con «Por venir» de entrada).
- 🟨 **Decisión (menor):** *¿Pestaña o filtro?* **Recomiendo filtro** con «Por
  venir» por defecto: el listado ya tiene su barra de filtros y una pestaña más
  compite con «Calendario».

### 2.3 · Pedir en el formulario lo que Google echa de menos (mitad abierta de B-813) — **Próximo** · S

- **Qué gana quien carga:** el formulario le avisa, sin obligarlo, «si tiene web el
  organizador, Google la muestra»; y el resultado de búsqueda sale más completo.
- **Qué ya existe:** el tablero ya mide esas proporciones y marca la web que no
  enlaza.
- **Riesgo / costo:** tentación de volver obligatorios los campos: ya se decidió
  dos veces que no (D-440).

### 2.4 · El aviso de «revisá el precio» en las cuatro bandejas de la Guía (B-1410, B-1411) — **Próximo** · S

- **Qué gana quien carga:** ver de un vistazo «3 precios para revisar» en vez de
  descubrirlo ficha por ficha; y que un precio de hace un año no siga publicado.
- **Qué ya existe:** el aviso y el botón «Lo revisé» en suscripciones y lugares
  (B-913, de hoy). Falta bibliotecas y el contador.

### 2.5 · Qué pasa con la segunda publicadora (B-920, B-921) — **Más adelante** · S–M · 🟨 Decisión

- **Qué gana:** que sumar publicadoras en otras ciudades no abra la puerta a leer
  borradores ajenos con el link de la reunión adentro.
- **Qué ya existe:** el rol publicador con su ciudad, y el recorte ya escrito y
  medido a medias. El propio ítem dice que vuelve «cuando entre la segunda».
- 🟨 **Decisión:** *Cuando entre la segunda publicadora, ¿de las actividades ajenas
  de su ciudad debe ver solo las publicadas?* **Recomiendo sí**, y hacerlo **antes**
  de darle la cuenta, no después. Y la segunda pregunta del ítem: *¿una publicadora
  puede cargar fuera de su ciudad?* **Recomiendo que sí pueda, pero que el panel
  se lo diga** («esta actividad va a quedar fuera de tu ciudad»): cerrar la puerta
  obliga a decidir qué hacer con lo ya cargado.

### Lo que no propongo para el panel

- **Prellenar sede y organizador desde lo último cargado** — descartado el
  2026-09-07 (B-100). El tablero mide si las sedes se repiten y hoy no alcanza;
  «Duplicar» ya resuelve el caso real.
- **Un rol «curador» con aprobación** — volvió y se resolvió con el publicador
  (B-893).

---

## Eje 3 · Analítica

El punto de partida: la mitad de la analítica **ya está construida** (GA4 con
consentimiento, tres eventos propios, Search Console, el resumen diario al
panel). Lo que falta es **historia**, y el primer mes completo se cumple el
**3 de octubre**. Casi todo lo de acá es convertir datos que ya llegan en
respuestas.

### 3.1 · Cerrar los dos interruptores de consola (B-874, B-773) — **Ahora** · S

- **Qué gana quien visita:** que el sitio haga lo que dice. Hoy el alta al correo
  y `/proponer` le avisan a Google que ese navegador usó el formulario y a dónde lo
  mandó (no el contenido). Y `/anunciar` afirma que no hay red ni píxel sin que
  nadie haya mirado si Google Signals está apagado.
- **Qué ya existe:** los dos pasos están escritos con la ruta exacta de la
  consola.
- **Riesgo / costo:** ninguno. Es configuración: ningún test lo puede sostener, así
  que hay que **anotar la fecha** en que se miró.
- **Nota técnica:** pasos en `docs/08-operacion.md` y `docs/16-analitica-del-sitio.md` §9.4.

### 3.2 · «Qué actividades se miran y no generan mensajes» — **Próximo (3 de octubre)** · M

- **Qué gana quien carga:** saber cuál taller tiene un problema —la descripción, el
  precio o cómo anotarse— comparándolo con los demás, en vez de adivinar.
- **Qué ya existe:** el clic en «inscribirse» ya se mide desde el 2026-09-03 y las
  vistas por página ya llegan al resumen diario. Cruzarlos por página **no
  necesita ninguna dimensión nueva**: la que hace falta (la página) ya está en la
  lista blanca.
- **Riesgo / costo:** con el tráfico actual una tasa suelta engaña. El diseño ya
  lo advierte (fricción 8): **se muestra como comparación entre actividades o no se
  muestra**, y con un piso de vistas por debajo del cual no se opina.
- **Nota técnica:** `functions/analitica.js` (pedido nuevo con `eventName` ×
  `pagePath`), pestaña «El sitio público» de `EstadisticasPanel.tsx`.

### 3.3 · Un número real para `/anunciar` (B-771) — **Próximo (3 de octubre)** · S

- **Qué gana:** un café o una librería que pregunta «¿cuánta gente lo ve?» recibe
  un número verdadero y con fecha.
- **Qué ya existe:** la página, y un test que hoy prohíbe cifras de audiencia a
  propósito, hasta que haya un mes de datos.
- **Riesgo / costo:** un número horneado en una página estática envejece; tiene
  que llevar su mes («en septiembre de 2026…») y revisarse.

### 3.4 · Dibujar «el ritmo» del catálogo (B-1081) — **Ahora** · S · 🟨 Decisión

- **Qué gana quien carga:** ver qué semanas de las próximas ocho están vacías y qué
  noche está saturada — la pregunta que un listado no contesta nunca. Sirve para
  decidir qué salir a buscar.
- **Qué ya existe:** el cálculo está hecho y testeado desde hace semanas; ninguna
  pantalla lo usa.
- 🟨 **Decisión, ya planteada en el BACKLOG:** *¿Lo dibujamos o lo borramos?*
  **Recomiendo dibujarlo**, como tercera pestaña del tablero o bloque al final de
  «El catálogo»: es barato y es la única vista de oferta futura que tiene el panel.

### 3.5 · El tablero guarda una foto por mes (B-378) — **Próximo** · S–M

- **Qué gana el dueño:** ver la tendencia («en septiembre publicamos 40, en octubre
  55; las gratis pasaron del 30 al 45 %»), que es lo que un anunciante o un
  aliado pregunta y lo que dice si el proyecto crece.
- **Qué ya existe:** el cálculo del tablero, y el patrón de Function programada que
  escribe en el área de sistema (el resumen de GA4 lo hace igual).
- **Riesgo / costo:** cero datos personales: son conteos. Guardar desde ya; la foto
  que no se sacó no se recupera.

### 3.6 · Qué filtro deja la lista vacía, con nombre (B-798) — **Próximo** · S · 🟨 Decisión

- **Qué gana quien carga:** saber que la gente busca «talleres gratis en Caballito»
  y no hay, que es exactamente lo que conviene salir a buscar.
- **Qué ya existe:** el evento ya manda qué eje y qué opción; falta registrarlo en
  la consola (no es retroactivo: cada día que pasa se pierde) y permitirlo en el
  resumen.
- 🟨 **Decisión:** *¿Aceptás sumar «eje del filtro» y «opción elegida» a la lista
  de lo que el panel le pide a GA4?* **Recomiendo sí**: son slugs de taxonomías
  públicas, nunca el texto tipeado, y el saneador ya lo garantiza.

### 3.7 · Medir el banner de ciudad (B-963) — **Próximo** · S

Lo primero que va a preguntar quien tiene su banner es si le sirve. Un cuarto
evento propio con la ciudad como único dato.

### 3.8 · De dónde vino la gente: Instagram, el correo o Google — **Próximo** · S · 🟨 Decisión

- **Qué gana el dueño:** saber si el correo o un posteo trajeron gente, que es la
  única forma de saber si conviene seguir haciéndolos.
- **Qué ya existe:** GA4 ya agrupa por canal; pero el sitio **corta toda la query**
  de la URL antes de mandarla (para que nunca viaje lo que alguien tipeó en el
  buscador), y con eso también se cortan las etiquetas de campaña que pegan
  Mailchimp o un link de la bio. El correo llega como «directo».
- **Riesgo / costo:** hay que dejar pasar **solo** esas dos o tres etiquetas de
  campaña con valores cerrados, nunca la query entera.
- 🟨 **Decisión:** *¿Dejamos pasar a GA4 las etiquetas de campaña (`utm_source`,
  `utm_medium`) con valores de una lista cerrada, y las agregamos al texto de redes
  y al correo?* **Recomiendo sí, con lista cerrada** («instagram», «correo»,
  «bio»). No son datos de una persona, y sin esto la pregunta 4 del tablero no se
  puede contestar para los dos canales propios.
- **Nota técnica:** `ubicacionSinQuery` en `src/lib/medicionSitio.ts`/`analyticsSitio.ts`
  y D-802; pasa por el `auditor-privacidad`.

### 3.9 · Un resumen mensual para cada organizador — **Más adelante** · M · 🟨 Decisión

- **Qué gana:** el organizador recibe «tu taller tuvo 180 visitas y 12 personas
  tocaron *inscribirme*». Es la mejor forma de que quiera cargar en la agenda (o
  proponer por `/proponer`) y el primer paso de algo vendible.
- **Riesgo / costo:** con números chicos se lee mal; y es un dato que sale del
  proyecto a un tercero. No es personal (son agregados), pero tiene que ir con la
  misma honestidad que el tablero.
- 🟨 **Decisión:** *¿Queremos ofrecerle números a los organizadores?* **Recomiendo
  esperar a tener tres meses de datos** y empezar a mano con los cinco que más
  cargan, antes de automatizar nada.

### Lo que no propongo en analítica

- **Mapas de calor y grabación de sesión** — la forma más invasiva de medir, y con
  este volumen no diría nada (16 §3.1).
- **Traer las estadísticas de Mailchimp al panel** — pide una credencial de
  Mailchimp, que D-800 descartó a propósito. Se miran en Mailchimp.

---

## Eje 4 · Redes y newsletter

Lo que hay: el texto para redes (anuncio del ciclo y recordatorio del próximo
encuentro, con arrobas y link), el borrador del correo de los próximos siete días
listo para pegar en Mailchimp, y el alta al correo andando desde el 2026-09-23.
Nada manda nada solo, y eso es una decisión (D-800): **se automatiza el bloque de
datos, la voz sigue siendo de quien escribe**. Todo lo de acá la respeta salvo lo
que va marcado como decisión.

### 4.1 · «El lunes de difusión»: una pantalla para toda la semana — **Ahora** · S–M

- **Qué gana quien carga:** abre una sola pantalla el lunes y tiene, en orden: el
  correo de la semana, **un texto para un posteo de «esta semana en la agenda»**, y
  la lista de recordatorios para cada día (qué encuentro es mañana, con su texto ya
  armado). Hoy eso son tres lugares y varias actividades abiertas de a una.
- **Qué ya existe:** el correo semanal ya agrupa los siete días; el texto por
  actividad ya existe en sus dos variantes. Falta la variante semanal y juntarlos.
- **Riesgo / costo:** el texto semanal tiene que salir **del índice publicado**,
  como el correo, y no de la base: lo que se anuncia es lo que el sitio muestra
  (D-801). El posteo es la salida más irreversible del sistema (07-seguridad).
- **Nota técnica:** `src/lib/boletinSemanal.ts`, `src/lib/textoRedes.ts`,
  `BoletinPanel.tsx`, `TextoRedes.tsx`.

### 4.2 · El correo arranca por las destacadas — **Ahora** · S

- **Qué gana quien lee el correo:** arriba, las dos o tres que el equipo
  recomienda; abajo, el resto por día. Un correo con curaduría se abre; una lista,
  menos.
- **Qué ya existe:** el campo «destacado» existe en cada actividad y ya viaja en el
  índice público; el correo hoy no lo usa.
- **Riesgo / costo:** ninguno.

### 4.3 · La imagen para la historia y el posteo, lista para bajar — **Próximo** · M · 🟨 Decisión

- **Qué gana quien carga:** una imagen cuadrada y una vertical con el flyer, la
  fecha y «agendaleh.ar», armadas en el navegador del panel y listas para subir.
  Es lo que hoy se hace en Canva, a mano, por cada actividad.
- **Qué ya existe:** el flyer de cada actividad con sus medidas, y la regla de que
  **ninguna salida recorta una imagen** (un flyer es texto adentro de un JPEG).
- **Riesgo / costo:** se descartó «imagen generada por actividad» **para Open
  Graph**, porque pedía un renderizador en el build (12-sitio-publico §12). Esto es
  distinto: se arma en el navegador de quien carga y no se publica sola. Aun así
  es diseño gráfico, y una plantilla fea hace más daño que no tenerla.
- 🟨 **Decisión:** *¿Querés una plantilla de imagen para redes con la identidad de
  la agenda, o preferís seguir usando el flyer del organizador tal cual?*
  **Recomiendo probar una sola plantilla**, «esta semana en la agenda» (una
  imagen con 5-7 títulos y días), y no una por actividad: el flyer del organizador
  ya es la imagen de cada una, y la semanal es la que hoy no existe.

### 4.4 · Invitar al correo en los lugares donde alguien ya mostró interés — **Próximo** · S

- **Qué gana:** más suscriptores sin pedirle nada más a nadie. Hoy el alta vive en
  `/suscribirse`; tiene sentido una línea al pie del detalle de una actividad y en
  «mis favoritos» («¿querés que te llegue lo de cada semana?»).
- **Riesgo / costo:** un formulario más que postea a Mailchimp: tiene que ser el
  mismo formulario sin JavaScript de terceros, con la misma promesa escrita. Ojo
  con el punto 3.1 (el interruptor de formularios de GA4) **antes** de sumar
  lugares.

### 4.5 · El correo sale solo cada semana (envío automático desde un feed) — **Más adelante** · M · 🟨 Decisión

- **Qué gana:** la semana más ocupada, el correo sale igual.
- **Cómo:** Mailchimp puede mandar solo un correo armado desde un feed público de
  «los próximos siete días» del sitio, **sin** darle al proyecto ninguna
  credencial de Mailchimp (la razón de D-800 sigue en pie).
- **Riesgo / costo:** se pierde la curaduría semanal, que D-800 defiende como la
  parte que vale. Y un feed es un formato público más (el RSS por hub se descartó
  por eso, aunque por otro motivo).
- 🟨 **Decisión:** *¿Preferís que el correo salga solo aunque sin curaduría, o
  seguir pegándolo a mano?* **Recomiendo seguir a mano con 4.1 y 4.2**, y revisarlo
  si en dos meses hay semanas que no salieron. Si se hace, que sea «sale solo si
  nadie lo mandó antes del jueves», no el reemplazo.

### 4.6 · Un correo por ciudad — **Más adelante** · M · 🟨 Decisión

- **Qué gana quien lee:** la persona de Mar del Plata no recibe los talleres de
  Palermo.
- **Riesgo / costo:** pedir la ciudad en el alta es **un dato más de una persona
  que sale a Mailchimp** (§5 y 07-seguridad). Tiene sentido cuando haya volumen
  fuera de CABA.
- 🟨 **Decisión:** *¿Segmentamos el correo por ciudad?* **Recomiendo no todavía**:
  esperar a que haya al menos dos ciudades con semana propia de actividades.

### Lo que no propongo en redes

- **Publicar en Instagram automáticamente** (API de Meta). Pide cuenta comercial,
  una app revisada por Meta, un token que vence y una Function con una credencial
  más. Y el texto es la salida más irreversible del sistema: un error se publica
  sin nadie en el medio. El trabajo caro no es apretar «publicar», es el bloque de
  datos, y ése ya está automatizado.

---

## Eje 5 · Control y calidad de datos

### 5.1 · Copia de seguridad automática de la base — **Ahora** · M · 🟨 Decisión

- **Qué gana:** que un error, un script mal corrido o una cuenta comprometida no
  se lleven un año de carga. Hoy la base es la única fuente de verdad (el
  calendario es espejo y el sitio se reconstruye desde ella), y no encontré ningún
  respaldo documentado.
- **Qué ya existe:** el proyecto está en plan Blaze con alerta de presupuesto; el
  historial por actividad cubre la edición pisada, no el borrado masivo.
- **Riesgo / costo:** centavos por mes de almacenamiento. El respaldo tiene
  **datos personales** (el contacto de quien propone, los mails de las cuentas),
  así que tiene que ser privado, con vencimiento, y respetar las retenciones de
  30 días que ya se prometieron: un respaldo eterno haría mentir a esa promesa.
- 🟨 **Decisión:** *¿Activamos un respaldo diario de la base, guardado 30 días?*
  **Recomiendo sí, con 30 días de vida** —coincide con la retención de propuestas
  y no rompe lo prometido— y probar una restauración en el emulador una vez.
- **Nota técnica:** exportación programada de Firestore a un bucket con regla de
  borrado a 30 días, o la recuperación a un punto en el tiempo de Firestore; en
  los dos casos, paso de consola del dueño + una entrada en `02-infraestructura.md`
  y `07-seguridad.md`.

### 5.2 · Cancelar un encuentro avisa en vez de borrar (B-98) — **Ahora** · M

- **Qué gana quien visita:** quien tenía el jueves agendado ve «CANCELADO — se pasa
  al jueves 3» en su calendario, en vez de que el evento desaparezca en silencio y
  vaya igual.
- **Qué ya existe:** aprobado por el dueño el 2026-08-26, con el motivo incluido.
  El comportamiento vive en dos piezas que ya tienen tests, y la vista previa del
  panel las reusa: el panel lo muestra sin trabajo de pantalla. La cancelación ya
  se mide (B-58).
- **Riesgo / costo:** toca la parte más frágil (el espejo en Calendar): **solo con
  emuladores**, nunca contra el calendario real. Cambia el §7.3 del `CLAUDE.md`
  (se anota como desvío en decisiones) y el aviso de ayuda del panel, que un test
  obliga a reescribir en el mismo cambio.
- ⚠️ **Además:** el ítem está en el archivo de cerrados porque dice «✅ aprobado».
  Hay que devolverlo al BACKLOG vivo (ver 6.1).
- **Nota técnica:** `debeExistir` y `construirEvento` en `functions/calendario.js`,
  `SesionesEditor.tsx`, aviso `cancelar-encuentro` de `src/lib/ayuda.ts`.

### 5.3 · «Datos para revisar»: la geografía que no cierra — **Ahora** · S

- **Qué gana quien carga:** el tablero le dice «2 actividades tienen un barrio de
  CABA con una ciudad de provincia» con el link a cada una, en vez de que se
  encuentre mirando el sitio.
- **Qué ya existe:** el tablero con sus avisos de un clic; y el caso concreto de
  B-1124: dos fichas siguen cruzadas hoy («Basura» y la feria FINDE), más nueve
  sedes que dejó un backfill.
- **Riesgo / costo:** ninguno; es una regla más del tablero, con la cascada de
  geografía que ya existe.
- **Nota técnica:** `src/lib/estadoDelCatalogo.ts`, `src/lib/geografia.mjs`.

### 5.4 · Posibles duplicados — **Próximo** · M

- **Qué gana quien carga:** al convertir una propuesta o al guardar, el panel avisa
  «se parece a *Club de lectura La Fonseca*, que ya está cargado el mismo día».
  Con cuatro formularios públicos abiertos, el mismo taller va a llegar dos veces.
- **Qué ya existe:** la búsqueda sin acentos del panel y el catálogo entero ya en
  memoria.
- **Riesgo / costo:** falsos positivos; tiene que ser un aviso que no frena, nunca
  un bloqueo.

### 5.5 · Revisar los links que se rompieron — **Próximo** · M

- **Qué gana quien visita:** que el formulario de inscripción, la web del
  organizador o el link del material de lectura no den error. Hoy nadie se entera
  hasta que alguien escribe.
- **Qué ya existe:** el tablero ya marca la web que ni siquiera es una dirección; y
  un chequeo nocturno de otro tipo (el de que lo publicado aparece) con su aviso.
- **Riesgo / costo:** son pedidos a sitios de terceros (Instagram contesta mal a
  robots, y eso da falsos positivos). Empezar como **script a pedido** con un
  informe local, y recién si sirve hacerlo programado. Nunca revisa links
  privados de la reunión.

### 5.6 · El chequeo de frescura también ve las ediciones (B-886) — **Más adelante** · S–M

Hoy el chequeo diario detecta una actividad publicada que no aparece, pero no una
edición (cambio de sede u horario) que no llegó al sitio. Es el mismo incidente
del 2026-09-11 con otra cara, y el ítem ya lo dice.

### 5.7 · Cerrar las dos fichas cruzadas de B-1124 — **Ahora** · S (dueño, en el panel)

Son dos ediciones: elegir el barrio correcto de «Basura» y decidir si la feria
FINDE es en Palermo o en Avellaneda. Se nombra acá porque es dato que hoy se
publica mal.

---

## Eje 6 · Lo que no entra en ninguno

### 6.1 · Que el backlog no pierda decisiones aprobadas — **Ahora** · S

- **El problema:** el archivador manda a «cerrados» todo lo que dice «✅», y
  «✅ aprobado» también lleva ✅. Así se fue B-98. Puede haber otros.
- **Qué hacer:** barrer el archivo de cerrados por «aprobado» y «pendiente de
  implementar», devolver lo que corresponda, y que el archivador no se lleve un ítem
  que diga «pendiente».
- **Nota técnica:** `scripts/archivar-backlog.mjs`, `docs/BACKLOG-cerrados.md`.

### 6.2 · Terminar los P1 en curso antes de abrir frentes nuevos — **Ahora**

El dueño ya fijó ese orden (B-959). Siguen abiertos: la imagen de una propuesta que
no queda al promoverla (B-1235, falta una conversión real), el «no hay internet»
que en realidad es App Check (B-930) y B-874. Nada de este roadmap debería pasarles
por encima.

### 6.3 · Publicidad vendida y servida por nosotros (B-377) — **Más adelante** · M · 🟨 Decisión

- **Qué gana:** ingresos sin romper la promesa del sitio. Ya existe `/anunciar`
  (solo un mail) y el banner de ciudad, que **no** es publicidad por decisión
  expresa.
- **Riesgo / costo:** una red de anuncios mete scripts y cookies de terceros en
  páginas indexadas, pesa más que todo el sitio y cambia la identidad. La
  alternativa es una imagen y un link cargados desde el panel, contados con los
  eventos propios.
- 🟨 **Decisión:** *Si se vende espacio, ¿lo vendemos y servimos nosotros o por una
  red?* **Recomiendo nosotros**, como ya deja anotado el documento de analítica
  (§10), y solo cuando 3.3 tenga el número del primer mes.

### 6.4 · Datos abiertos del circuito — **Más adelante** · S

El `events.json` ya es público y proyectado. Una página que diga «estos datos se
pueden usar, con esta licencia» invita a que otros (medios, bibliotecas, apps)
lo reusen y citen la agenda. Cuesta un texto y una licencia; el riesgo es que
alguien dependa de un formato que después se quiere cambiar.

### 6.5 · Un «cómo cargar bien» para las publicadoras nuevas — **Próximo** · S

Con el rol publicador y las ciudades nuevas, lo que hoy sabe el dueño (qué es una
buena descripción, por qué el flyer entero, qué hace «completo») tiene que estar
escrito en la ayuda del panel antes de la tercera cuenta, no después. La ayuda y
las novedades del panel ya existen como mecanismo.

---

## Resumen de todo, en una tabla

| # | Propuesta | Eje | Tamaño | Prioridad | Decisión del dueño |
|---|---|---|---|---|---|
| 3.1 | Interruptores de GA4 (B-874, B-773) | Analítica | S | **Ahora** | — (es cumplir lo prometido) |
| 5.1 | Copia de seguridad de la base | Datos | M | **Ahora** | 🟨 ¿Respaldo diario a 30 días? → sí |
| 5.2 | Encuentro cancelado avisa (B-98) | Datos / sitio | M | **Ahora** | ya aprobada |
| 1.1 | Compartir y agendar en el detalle | Sitio | S | **Ahora** | — |
| 4.1 | El lunes de difusión | Redes | S–M | **Ahora** | — |
| 4.2 | El correo arranca por las destacadas | Newsletter | S | **Ahora** | — |
| 1.2 | Links tocables en la descripción (B-980) | Sitio | S | **Ahora** | ya decidida |
| 2.1 | Aviso por mail de propuestas nuevas | Panel | M | **Ahora** | 🟨 ¿Uno por uno o diario? → diario |
| 2.2 | Pasadas fuera del listado (B-101) | Panel | S | **Ahora** | 🟨 ¿Pestaña o filtro? → filtro |
| 3.4 | Dibujar el ritmo del catálogo (B-1081) | Analítica | S | **Ahora** | 🟨 ¿Dibujar o borrar? → dibujar |
| 5.3 | Aviso de geografía que no cierra | Datos | S | **Ahora** | — |
| 5.7 | Las dos fichas cruzadas (B-1124) | Datos | S | **Ahora** | (edición del dueño) |
| 6.1 | Que el backlog no pierda aprobadas | Otros | S | **Ahora** | — |
| 3.2 | Vistas contra mensajes por actividad | Analítica | M | Próximo (3/10) | — |
| 3.3 | Número real en `/anunciar` (B-771) | Analítica | S | Próximo (3/10) | — |
| 3.5 | Foto mensual del tablero (B-378) | Analítica | S–M | Próximo | — |
| 3.6 | Qué filtro deja cero, con nombre (B-798) | Analítica | S | Próximo | 🟨 ¿Sumar las dos dimensiones? → sí |
| 3.7 | Medir el banner de ciudad (B-963) | Analítica | S | Próximo | — |
| 3.8 | Etiquetas de campaña | Analítica | S | Próximo | 🟨 ¿Dejarlas pasar con lista cerrada? → sí |
| 1.4 | Efemérides (B-959) | Sitio | L | Próximo | 🟨 ¿Dónde se ven? → sección propia + home |
| 1.5 | Páginas por organizador | Sitio | L | Próximo | ya decidido el cómo |
| 2.3 | El formulario pide lo que Google quiere (B-813) | Panel | S | Próximo | — |
| 2.4 | Aviso de precio en las cuatro bandejas (B-1410/1411) | Panel | S | Próximo | — |
| 4.3 | Imagen semanal para redes | Redes | M | Próximo | 🟨 ¿Plantilla propia? → una sola, semanal |
| 4.4 | Invitar al correo desde el detalle | Newsletter | S | Próximo | — |
| 5.4 | Posibles duplicados | Datos | M | Próximo | — |
| 5.5 | Links rotos | Datos | M | Próximo | — |
| 6.5 | Guía para publicadoras | Otros | S | Próximo | — |
| 1.6 | «Empieza esta semana» en la tarjeta | Sitio | S | Más adelante | — |
| 2.5 | Alcance de la segunda publicadora (B-920/921) | Panel | S–M | Más adelante | 🟨 ¿Solo publicadas? → sí, antes de darla |
| 3.9 | Resumen para organizadores | Analítica | M | Más adelante | 🟨 ¿Ofrecer números? → a los 3 meses |
| 4.5 | Correo automático desde un feed | Newsletter | M | Más adelante | 🟨 ¿Solo o a mano? → a mano |
| 4.6 | Correo por ciudad | Newsletter | M | Más adelante | 🟨 ¿Segmentar? → todavía no |
| 5.6 | Frescura ve ediciones (B-886) | Datos | S–M | Más adelante | — |
| 6.3 | Publicidad propia (B-377) | Otros | M | Más adelante | 🟨 ¿Nosotros o una red? → nosotros |
| 6.4 | Datos abiertos | Otros | S | Más adelante | — |

## Las decisiones del dueño, juntas

1. **¿Respaldo diario de la base, guardado 30 días?** → Sí.
2. **Aviso de propuestas nuevas: ¿uno por uno o resumen diario?** → Resumen diario a las 9.
3. **Las pasadas en el panel: ¿pestaña o filtro?** → Filtro, «Por venir» por defecto.
4. **El ritmo del catálogo: ¿dibujarlo o borrarlo?** → Dibujarlo.
5. **¿Sumar «eje» y «opción» del filtro vacío a lo que se le pide a GA4?** → Sí.
6. **¿Dejar pasar las etiquetas de campaña con lista cerrada?** → Sí.
7. **Efemérides: ¿dónde se ven?** → Sección propia con página por efeméride, más un renglón en la home.
8. **¿Plantilla de imagen propia para redes?** → Una sola, la de «esta semana».
9. **¿El correo sale solo desde un feed?** → No por ahora; revisar en dos meses.
10. **¿Correo por ciudad?** → Todavía no.
11. **Segunda publicadora: ¿solo ve publicadas ajenas? ¿puede cargar fuera de su ciudad?** → Sí a lo primero, antes de darle la cuenta; sí a lo segundo, con aviso.
12. **¿Números para los organizadores?** → A los tres meses, a mano con los cinco que más cargan.
13. **Publicidad: ¿propia o una red?** → Propia, y recién con el número del primer mes.
