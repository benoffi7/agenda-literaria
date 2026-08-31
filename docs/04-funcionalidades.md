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

Cada fila dice además cuándo es su próximo encuentro y, **si la cargó la otra
cuenta, lo marca** (B-130). Lo propio no lleva marca: si todo lleva marca, la
marca deja de avisar. No se muestra un nombre porque `createdBy` es un uid y no
hay nombre que mostrar sin ir a buscarlo — con dos cuentas "otra cuenta" alcanza
para saber quién; con tres deja de alcanzar y ahí hay que guardar el mail
(B-179).

Acciones por fila: **Editar** como botón, y un menú "⋯" con **Duplicar**,
**Historial** y **Borrar**. Van en un menú porque tres botones en fila en 360px dan blancos
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
| `libro` (obra y su autor) | presentación, charla — y en cualquier actividad que ya lo tenga cargado (DEC-1, D-126) |
| `sede` | presencial, híbrido |
| `online` | virtual, híbrido |

Y dos cascadas que marcan casillas solas, porque casi siempre es así: **club de
lectura** prende «es un ciclo» y «tiene material»; **feria** prende «es un ciclo»
y nada más —una feria del libro dura varios días, así que es una actividad con N
encuentros (§2.2), uno por jornada, pero no tiene quien la dé (B-129)—. Las dos
se pueden destildar.

Desde el 2026-08-25 el formulario **no es un solo archivo**: son diez componentes
de sección más los módulos de dominio puros de `lib/formulario/` (`estadoInicial`,
`cascadas`, `condicionales`, `etiquetas`, `guardar`, `chips`, `autoria`,
`camposFaltantes`, `autoguardado`, `borradoresDelNavegador`), y lo que quedó en el
`.tsx` es el armado. El conteo de líneas vive en
[`10-salud-del-codigo.md`](10-salud-del-codigo.md) §1.3 y quedó viejo: es **B-201**.

Secciones: Qué es · Encuentros · Dónde · Quién · Arancel e inscripción ·
Material · Opcional · Difusión · Vista previa del evento. Las cuatro últimas son
acordeones colapsados, y desde B-184 cada sección tiene un ancla propia para que
el mensaje de campos faltantes pueda abrirla y llevar hasta el campo.

**Material** (§3.1) tiene siete formatos —libro o lectura, guía, contexto, sobre
el autor, newsletter, playlist, otro— y cuatro momentos de entrega: previo al
encuentro, al inscribirse, **durante el mes** y en el encuentro. «Durante el mes»
salió de cargar un club de lectura real (B-134) y dice algo del dominio: la
entrega no siempre es un instante, puede ser progresiva a lo largo del ciclo.

**Difusión → «Arrobar al publicar»** es una lista de chips: Enter o coma agrega,
Backspace borra la última, y se puede pegar una lista entera. Antes era un
`<input>` que hacía `join`/`split` en cada tecla, así que **la coma se borraba
sola en el momento de escribirla** y no había forma de cargar un segundo handle
(B-133). El espacio no separa, porque hay nombres con espacios. La misma cuenta
escrita distinto —`@CasaBrandon`, `casabrandon`— no entra dos veces, aunque se
guarda tal como se escribió: ver D-116 para por qué esto no es `TagsInput`.

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
- **Guardar borrador pide lo mínimo: título y dirección web.** Nada más. Todo lo
  demás —tipo, descripción, organizador, arancel, encuentros, sede— se exige
  **al publicar**, que es lo que sale al sitio y al calendario (B-183, D-120).
  Lo que sigue bloqueando en los dos niveles es lo que haría ilegible el
  documento: la fecha de cada encuentro cargado y su identificador interno
  (trampas 1 y 2).
- **La barra de abajo dice qué falta, y lleva hasta ahí.** Con pocos campos los
  nombra («Falta completar: Título, Arancel»); con muchos nombra las secciones
  con su cuenta («Dónde (2), Arancel e inscripción (1)»). Cada nombre es un
  botón: **abre la sección si estaba cerrada** y scrollea hasta el campo, que es
  lo que faltaba —un campo rechazado adentro de un acordeón colapsado no estaba
  en ninguna parte de la pantalla (B-184, D-121). Cuando el borrador se puede
  guardar pero le falta algo para publicar, la misma barra lo dice en gris: es
  aviso, no bloqueo.
- **El formulario se guarda solo en el navegador mientras se escribe**, y al
  abrirlo ofrece lo que haya quedado sin guardar, con la fecha y un botón para
  descartarlo. No toca la base: es del dispositivo donde se estaba cargando, se
  borra al guardar bien, **se borra al cerrar sesión** y vence al mes (B-191,
  D-122). Es por cuenta y por formulario: la carga nueva y una copia no comparten
  el suyo.
- **Recuperar un borrador no vuelve a tildar las casillas que publican un link.**
  Si el borrador tenía tildado «mostrar el link sin inscribirse» —de la reunión o
  de un material—, al recuperarlo queda destildado y el aviso lo dice. Un valor de
  hace tres semanas aplicado sobre lo de hoy no puede publicar un link solo
  (D-124, trampa 5).
- **Una actividad tiene una galería de imágenes, no una sola** (B-167): hasta
  cuatro, cada una con su epígrafe opcional y una marcada como portada, que es la
  que va a aparecer al compartir el link. El texto que leen un lector de pantalla y
  Google sale del **título de la actividad**, no del epígrafe (D-125).
- **Las imágenes entran de dos maneras, y conviven** (DEC-7c): pegando la dirección
  de una que está en otro sitio —se ve al momento de pegarla— o **subiendo un
  archivo propio**, que va a Firebase Storage. Para subir: JPG o PNG, hasta 3 MB,
  con el rechazo diciendo cuánto pesa el archivo y cuánto es el máximo. **Al subir
  se le quitan los metadatos**, y eso no es cosmético: una foto de celular lleva las
  coordenadas del lugar donde se sacó, y muchos talleres pasan en casas particulares
  (D-131). Lo que todavía no está es la recompresión y la miniatura del lado de la
  Function: es **B-220**, y hasta entonces una foto de 3 MB pesa 3 MB en la tarjeta.
- **Duplicar no copia las imágenes subidas al panel**, solo las que son un link a
  otro sitio: la copia y el original compartirían el mismo archivo, y borrar una le
  rompería las imágenes a la otra. Lo dice la letra chica del modal de duplicar.
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

### Editor de modalidades (B-224)

**«Dónde» es una lista, con la misma interfaz que los encuentros.** Cada fila es
una forma de cursar completa: el selector presencial / virtual / híbrido y, según
lo que se elija, la sede o los datos de la reunión — o los dos. Así una actividad
puede darse presencial en una librería **y** virtual por Meet, que con una sede
sola no se podía decir.

Cada fila lleva además **desde cuándo y hasta cuándo** rige, las dos opcionales.
Hoy esas fechas **se guardan y no se publican en ningún lado**: qué significan
frente a las fechas de los encuentros es una decisión pendiente del dueño (B-224),
y hasta que se resuelva no salen ni al sitio ni al calendario. El resto de la fila
—la modalidad y su lugar— sí sale como siempre.

Agregar, duplicar y borrar funcionan igual que en los encuentros: el chasis es el
mismo componente (`campos/FilasEditor.tsx`), extraído para que un arreglo en uno
no haya que acordarse de aplicarlo en el otro.

Lo que se publica cuando hay varias filas: el `events.json` lleva **la lista
entera**, el evento de Calendar nombra cada forma de cursar con su lugar, y el
filtro de modalidad del listado encuentra la actividad por **cualquiera** de
ellas. Los detalles y los tres campos derivados están en
[`03-modelo-de-datos.md`](03-modelo-de-datos.md) y en D-130.

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

El desplegable y el input de etiquetas usan **la misma** lógica (D-100): buscar
sin acentos ni mayúsculas y a mitad de palabra, reusar por slug, y mostrar a la
derecha de cada sugerencia cuántas veces se usó. La única diferencia visible es
que el desplegable, al entrar a "Otro", ya muestra las primeras opciones sin que
haya que escribir nada; el input de etiquetas no despliega nada hasta que se
escribe, para no tapar el formulario.

Una etiqueta nueva se guarda **presentable**: espacios de más colapsados y la
primera letra en mayúscula, sin tocar el resto (D-101). "narrativa" se guarda
"Narrativa"; "Villa Crespo" y "Club de lectura" quedan como se escribieron.

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

**Desde el 2026-08-24 esto está dormido:** por decisión del dueño las opciones
nuevas **nacen aprobadas** (D-104), así que la tabla de arriba describe la
maquinaria —que sigue entera y probada— y no lo que pasa hoy. Lo único que puede
estar pendiente es lo que se creó antes de esa decisión. Volver a prenderla es un
`false` en `upsertOpcion`.

Aprobar es una tarea de mantenimiento, no de carga: se hace desde la pantalla de
taxonomías (abajo) o con `scripts/aprobar-opciones.mjs`
(ver [`08-operacion.md`](08-operacion.md)).

### Administración de taxonomías

Pantalla propia con las cinco listas —arancel, tipo, barrios, plataformas y
etiquetas— y, por cada opción, su etiqueta, su slug, cuántas veces se usó y si
está aprobada. Es donde el §4.3 se vuelve accionable (D-102):

| Acción | Qué hace | Sobre qué |
|---|---|---|
| **Renombrar** | corrige cómo se ve la etiqueta, **sin mover el slug** | las creadas con "Otro" |
| **Borrar** | la saca de las listas | las creadas con "Otro" |
| **Aprobar** | la hace visible para la otra cuenta | las que quedaron pendientes |

Las opciones **base** están marcadas y no tienen acciones: son las que puede
haber cableadas en la lógica (§4.3).

Dos avisos que la pantalla da porque son las consecuencias que no se adivinan:

- una opción creada con "Otro" y **casi sin usar** se marca "puede ser un typo",
  que es la señal de basura del §4.3;
- **borrar algo que está en uso** se confirma aparte, diciendo con qué texto van
  a quedar las actividades que la usan (el des-slug de D-11, calculado con la
  misma función que arma el evento público).

**Se abre con el botón «Opciones»** arriba del listado, que lleva al lado el
contador de opciones pendientes de aprobar (B-26).

Ese contador es un componente propio y **diferido**, y no una llamada al hook en
la cabecera, por una razón concreta: `usePendientesDeAprobacion` importa
Firestore, y la cabecera se renderiza en `AdminApp`, que está en el chunk inicial
—el que se baja para mostrar "Entrar con Google"—. Llamarlo desde ahí habría
arrastrado el SDK a ese chunk y deshecho el corte de B-09/D-51 **sin que nada
falle**: el panel seguiría funcionando, solo tardaría el doble en aparecer. Ese
error ya se cometió tres veces en este repo.

Y una advertencia que la guía repite porque se paga caro: **renombrar no arregla
un typo ya guardado.** La actividad guarda el slug, no el texto, así que
renombrar «Villa Crepso» a «Villa Crespo» deja las actividades apuntando al slug
viejo. Para eso hay que borrar la mala y volver a elegir la buena en cada
actividad.

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
geolocalizar. Mandar solo la calle no alcanza. Con varias formas de cursar es la
**sede principal** —la de la primera fila que tenga una—, porque el campo que
dibuja el mapa admite una sola dirección; las demás salen en la descripción.

**Mapa:** si la sede tiene coordenadas cargadas (`sede.geo`), el link de la
descripción apunta al punto exacto; si no, a la búsqueda por el texto de la
ubicación (D-10, D-46).

**Descripción:** todo lo cargado en el formulario que sea publicable —
posición en el ciclo ("Encuentro 3 de 8", contando también los encuentros
cancelados: D-95), descripción, tema y lectura del encuentro, **una entrada por
forma de cursar** con su modalidad y su lugar (sede con "cómo llegar" y link a
Google Maps, o plataforma), arancel con notas,
inscripción con vía, cupo y cierre, material, organizador, tallerista con bio,
y tags.

Cada línea de material es `- <título> (<formato>, <entrega>)`, y el formato
**`otro` no se nombra** (B-182): "Otro" no informa nada al lado del título, y es
el formato donde cae todo lo que no entra en los demás, así que la mitad de las
líneas decían lo mismo. La entrega sí queda: no está en el título. En el
desplegable del panel «Otro» sigue estando, que es otra cosa — ahí hay que poder
elegirlo.

**Lo que nunca lleva** (§5.1): la difusión interna, la URL del material privado,
los uids. El link de la reunión solo si se tildó "publicar el link" en esa
actividad. Ver [`07-seguridad.md`](07-seguridad.md).

## Trigger de rebuild

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

**Desplegado y verificado de punta a punta desde el 2026-08-25 (B-20).** El PAT de
GitHub en Secret Manager y el secret de deploy ya están creados, y el lazo se
probó disparando un `repository_dispatch` a mano: corrió el workflow y publicó.
[`08-operacion.md`](08-operacion.md) es ahora el runbook para rearmarlo en un
proyecto nuevo o para rotar el PAT, no la lista de lo que falta.

## Sitio público — el listado y el detalle

Construido en **B-227**, el primer frente del diseño de
[`12-sitio-publico.md`](12-sitio-publico.md). **Todavía no está desplegado:** el
dominio no está elegido, así que no hay `site` en la config y por lo tanto no hay
canonical, ni Open Graph, ni sitemap (**B-109**); y el rebuild automático sigue
esperando el PAT (**B-20**).

### La home — `/`

El build imprime en HTML **todas** las actividades vigentes, con su tarjeta,
agrupadas por mes y ordenadas por próxima fecha. Eso es lo que ve Google y lo que
ve alguien con JavaScript apagado.

Desde **B-247** (D-141, D-142) es una **grilla**: una columna en el teléfono, dos en
tablet, tres en escritorio. Una sola columna en 375px no se negocia (§8 del diseño):
la mayoría entra desde un link de Instagram, en un navegador embebido.

**La tarjeta.** Arriba una portada de 16:9 con la píldora del tipo en su color; abajo,
en este orden, la fecha, el título, el ciclo, el lugar, el aviso de inscripción y —al
pie, apoyado con `mt-auto` para que quede a la misma altura en toda la fila— el
arancel y cómo se cursa. Es el orden en que se decide: qué es, cuándo, dónde y cuánto
sale.

Lo que la tarjeta tiene que decir bien es del dominio, y sale de
`src/lib/tarjetaPublica.ts`, que es puro y testeado:

| Caso | Qué dice |
|---|---|
| un ciclo | «Ciclo de 4 encuentros · empieza el 9 de septiembre», y el verbo cambia con el reloj de quien mira: «empezó» si ya arrancó, «terminó» si pasó |
| «a la gorra» | con el acento y con peso, igual que «gratis». Es la mitad de los casos del circuito y no entra en el binario gratis/pago (§4.1 del `CLAUDE.md`) |
| inscripción cerrada | «Las inscripciones cerraron», calculado con el reloj de quien mira y no con el del build (B-111) |
| cupo completo | «Cupo completo · consultá por lista de espera» — pero **después** de «cerraron»: con la inscripción cerrada, la lista de espera no va a ningún lado |
| cómo se cursa | de `modalidades[]` y no del escalar (B-224): una presencial que además es online dice «y online» |
| destacada | una píldora en la portada |

**Cuando no hay imagen, la portada se genera** — D-142. El título sobre el color del
tipo, con el cuerpo elegido según el largo y un motivo de renglones derivado del mismo
tono. No es un placeholder y no hay foto de stock: `imagenUrl` es opcional y en este
circuito muchas actividades no van a tener foto, así que la grilla tiene que verse
entera igual. Para lector de pantalla la portada es decorativa —el arte va
`aria-hidden`, la foto con `alt=""`— porque no aporta nada que el texto de la tarjeta
no diga ya; la píldora del tipo, que sí es información, queda fuera del arte.

Encima va una island de React (`client:load`) que hace **un solo fetch** de
`/events.json` y filtra, busca y ordena **en memoria** (§2.5). Cuando el índice
llega, la island **saca del DOM la lista del build** y renderiza la suya con el
mismo componente `Tarjeta` — una sola definición del markup, y como el estado
inicial es el del build, no hay parpadeo. Si el fetch falla, la lista del build se
queda donde está, los controles quedan deshabilitados y hay un aviso chico: nunca
una pantalla vacía.

| Control | Qué hace |
|---|---|
| **Buscar** | contra `searchText`, con el `normalize` del §6: acentos y mayúsculas dan igual. Dos palabras se exigen **las dos** |
| **Cuándo** | Próximas (default) · Este mes · Próximos 3 meses · cada mes con actividad |
| **Filtros** (colapsados, con el número de puestos al lado) | tipo, cómo se cursa, arancel, barrio, ciudad y temas; más «solo con inscripción abierta» y «solo ciclos / solo encuentros únicos» |
| **Ordenar por** | Próximas primero (default) · Recién agregadas · Título (**D-137**) |

Los chips **no tienen nada cableado**: salen de `opciones.*` del propio
`events.json` (§4.4), con el número de actividades de cada uno, y el que daría cero
no se muestra. AND entre grupos, OR adentro de cada grupo.

Todo lo puesto viaja en la **query string**
(`/?q=cronica&tipo=taller&barrio=boedo`), para poder compartir un filtro por
WhatsApp y para que volver desde una página de detalle recupere lo que estaba
filtrado.

Cuando no queda nada, la pantalla vacía **dice qué filtro sacar** — y el que ofrece
lo probó primero: sugerir «sacá el barrio» cuando sacarlo tampoco alcanza es peor
que no sugerir nada.

**En el teléfono los controles no se comen la pantalla** (D-143): arriba quedan el
buscador y una fila con «Filtros (N)» y el orden; «Cuándo» vive adentro del panel; el
panel abierto está topeado a `65svh` con scroll propio y cierra desde abajo con «Ver N
actividades», devolviendo el foco al botón que lo abrió. La **hoja inferior** del §8
sigue siendo **B-238**: es una capa modal y no se construye a medias.

**Accesibilidad:** link «Saltar al listado» como primer elemento enfocable, un solo
`h1`, los meses como `h2`, los chips como `<button aria-pressed>` dentro de
`fieldset`/`legend` y navegables con las flechas (la misma aritmética de `foco.ts`
que usa el panel), el contador de resultados en un `aria-live="polite"`, foco
visible en todo, blancos táctiles de 44px y `prefers-reduced-motion` respetado.
`tests/tarjeta-del-listado.test.ts` fija lo que se puede leer del markup —que ningún
`div` lleve `onClick`, que nadie apague el anillo de foco, que la portada no aporte
nombre accesible— además del contraste.

### El detalle — `/actividad/{slug}`

Una página estática por actividad publicada, **con cero JavaScript**. Es la que
recibe el tráfico: la mayoría cae acá desde Google o desde un link de Instagram, y
tiene una sola pregunta — ¿esto me sirve y todavía puedo entrar?

**Arriba va la portada**, si hay imagen, con la relación de aspecto de
`--aspect-portada` —la misma que la tarjeta del listado (B-249)— y no la del archivo
que subió quien organiza: así un flyer vertical de Instagram se recorta en vez de
empujar la fecha fuera de la pantalla. Es un desvío del §4.3 del diseño, que la ponía
después de la ficha; el motivo de aquella decisión sigue valiendo y se resuelve de
otra forma (**D-144**). Sin imagen no hay hueco: la ficha es lo primero.

Antes que nada, si corresponde, **un solo aviso**: se canceló, ya pasó, la inscripción
cerró o el cupo está completo. Los cuatro pueden valer a la vez y mostrarlos apilados
es la forma de que no se lea ninguno, así que la prioridad —del más irreversible al
menos— la decide el view-model y no una plantilla encadenando condiciones. Cerró un
bug: una actividad con **todos** los encuentros cancelados decía «ya pasó» (**B-254**).

Después va «la ficha» —cuándo, dónde, cuánto, cómo me anoto— y el botón, con el
verbo de la vía real: «Escribir por WhatsApp» a un `wa.me` con mensaje precargado,
«Mandar un mail» a un `mailto:` con asunto, «Escribir por Instagram», «Anotarme en
el formulario». Si el destino no sirve para esa vía no hay botón y el canal se
muestra como texto: un botón que no lleva a ningún lado es peor que ninguno. Sin
inscripción dice «Entrada libre». Con la actividad pasada tampoco hay botón — **el
CTA se decide por fecha y no por `abierta`**, que sin fecha de cierre queda en true
para siempre y mostraría «Anotate» en un taller de hace un año.

**En el teléfono ese es el único CTA de la pantalla, y está siempre a mano**: de `sm`
para abajo el botón del flujo no se pinta y el mismo enlace vive en una barra fija
abajo, **sin una línea de JavaScript** (**D-145**, que cierra la mitad «CTA fijo» de
B-238). Uno y solo uno por pantalla: dos enlaces al mismo lugar hacen que quien
escucha la página oiga el mismo botón dos veces.

Después: la descripción completa respetando los saltos de línea, la lista de
encuentros con su tema y su lectura —los pasados atenuados, los cancelados tachados,
el próximo marcado, y el título **sin repetir la cuenta** que la ficha ya dio
(**B-258**)—, quién lo da con su bio, el material, cada forma de cursar con su sede y
su link al mapa, y quién organiza.

**SEO:** `<title>` con el título de la actividad primero y el barrio adentro, `meta
description` con el resumen, y datos estructurados de `schema.org` — un `Event`
para una fecha suelta y un `EventSeries` con un `subEvent` por encuentro para un
ciclo, con las fechas en offset de Buenos Aires y los cancelados marcados sin
perder su fecha original. Con `arancel: gratis` se emite `price: "0"`; con
cualquier otro **no se emite precio**, porque el arancel es un slug y no un monto.

**Lo que la página NO muestra**, y es decisión y no olvido: el link de la reunión,
ni siquiera con «publicar el link en el sitio» tildado (**D-139**).

### `/events.json`

El índice que la island filtra (B-106). El build lo arma leyendo Firestore con el
Admin SDK y sale como archivo estático.

Desde B-227 los tres artefactos del build —el índice, el HTML de la home y cada
página de detalle— salen de **una sola lectura**, en
`src/lib/contenidoDelSitio.ts`. Ahí vive también el
`where('estado','==','publicado')` del §5.3, que antes estaba en el endpoint: con
tres consumidores, tenerlo tres veces era tener dos copias que se pueden olvidar de
actualizar. **Un borrador no entra al índice ni genera página.**

Tres cosas del índice que conviene saber antes de consumirlo:

- **Recorta más que `toPublic`.** No lleva `descripcion` (va un `resumen` de ~160
  caracteres), ni `inscripcion.destino`, ni la dirección o las indicaciones de la
  sede, ni el material, ni el tema y la lectura de cada encuentro, ni la bio del
  tallerista. Todo eso vive en el HTML del detalle. El motivo principal no es el
  peso: es que servir el mail de inscripción en el índice lo entrega **en lote y en
  un solo GET**.
- **Lleva `cierraEn` y no `abierta`** (B-111): el booleano se calcula con el reloj
  del build y se congela hasta el rebuild siguiente.
- **Las opciones de taxonomía viajan en el mismo archivo** (§4.4), así que los chips
  de filtro no tienen nada cableado.
- **Y desde B-227 lleva `creadoEn`**, la fecha de alta con precisión de día: es la
  clave del orden «Recién agregadas» y lo único que se agregó a la frontera de
  privacidad (**D-138**). La hora no sale, y `updatedAt` tampoco.

`toPublic.ts` (la frontera de privacidad) y `normalize.ts` (la búsqueda) ya estaban
escritos y testeados: eso es lo que hizo que esta pieza fuera corta.

### `/ayuda` y `/contacto` — las dos páginas de texto (B-232)

Las primeras dos páginas del sitio público terminadas. No leen `events.json` ni
Firestore: son texto, y por eso pudieron escribirse antes que el listado.

**`/ayuda`** le habla a **quien busca una actividad**, no a quien la carga — la guía
del panel es otra cosa y vive adentro del panel. 20 preguntas en cinco
grupos, todas abiertas, con un ancla estable cada una (`/ayuda#a-la-gorra`) para
poder mandar el link de una respuesta suelta. Contesta, entre otras: que esto **no
es una plataforma de inscripción**, qué es cada tipo de actividad, qué quiere decir
«a la gorra», por qué un ciclo es una tarjeta y no ocho, y **por qué el link de la
reunión no está publicado** (§5.1, trampa 5).

**`/contacto`** son dos `mailto:` con el asunto ya puesto, que es lo que permite
separar una sugerencia de un error en la bandeja sin abrirlos. Cada motivo dice qué
conviene contar, y la página cierra con qué pasa después: lo lee una persona y puede
demorar.

Tres cosas que no se ven mirando las páginas:

- **El contenido es data, no marcado** (`src/lib/ayudaDelSitio.ts`,
  `src/lib/contactoDelSitio.ts`), y lo que se puede derivar se deriva: el glosario de
  tipos y el de aranceles salen de `opciones-base.json`, los motivos salen de
  `MOTIVOS_DE_CONTACTO`. Agregar una categoría base deja la ayuda incompleta y el
  test la nombra. Ver **D-135**.
- **Nada de `mailto:` escrito a mano.** La dirección y los asuntos salen de
  `enlaces.ts` (B-228); el test falla si aparecen en el marcado de una página.
- **Sin acordeón y sin JavaScript.** Ver **D-136**.
### `/suscribirse` — llevarse la agenda al calendario propio (B-230)

La segunda página del sitio público. Explica cómo suscribirse al Google Calendar
del proyecto, que es un **espejo de solo lectura** de lo que se carga en el panel
(§2.1): un evento por encuentro, y quien se suscribe recibe los cambios sin hacer
nada.

Cuatro caminos, cada uno con su botón y sus pasos:

| Camino | Adónde va | Por qué está |
|---|---|---|
| **Google Calendar** | el `cid` en base64 que arma `enlaces.ts` | es el calendario de quien usa Gmail o Android |
| **iPhone, iPad y Mac** | el mismo calendario con esquema `webcal:` | **abre la aplicación Calendario**; con un `.ics` común el teléfono descarga un archivo que hay que ir a buscar a Archivos, y eso copia las fechas una vez en lugar de suscribirse |
| **Outlook, Thunderbird y el resto** | la dirección pública del `.ics`, escrita y con botón de copiar | el paso que se falla es encontrar la opción que la acepta, así que los pasos nombran el menú de cada programa |
| **Solo mirarlo** | el calendario en la web de Google | mirar sin suscribirse es un caso real, y decirlo evita que alguien crea que se suscribió |

Y una sección de **lo que el calendario no hace**, que son las tres sorpresas que
se descubren tarde: no inscribe (cada actividad se anota por su canal), casi nunca
trae el link de la reunión —salvo que quien organiza haya elegido publicarlo, D-15—,
y una actividad cancelada **desaparece** del calendario en vez de quedar tachada.
Las tres se verifican contra `functions/calendario.js`, no solo contra el texto: si
el comportamiento cambia, el test de la página se pone en rojo (ver D-133).

Cierra con dónde seguir el proyecto: Instagram.

**Todo el texto vive en `src/lib/suscripcion.ts`** y ninguna dirección se escribe en
el markup: salen todas de `src/lib/enlaces.ts` (B-228). El motivo está en D-133.

Queda escrito y **sin cablear** `src/components/sitio/SuscribirseResumen.astro`, el
bloque corto para embeber en la home cuando el listado exista (**B-231**).
## Historial de versiones

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

**Hay pantalla** desde el 2026-08-25 (B-40): en el menú «⋯» de cada fila del
listado, «Historial». Muestra las versiones de esa actividad, qué campos pisó
cada edición y permite restaurar.

Se carga **diferida** (`import()`), no en el chunk inicial del panel: es la vista
menos usada —recuperar un campo pisado es una operación rara— así que es justo la
que no tiene por qué viajar en lo que se baja para mostrar "Entrar con Google"
(B-09, D-51).

La comparación entre una versión guardada y el documento actual usa **la misma
función** que decide qué se guarda, importada por el alias `@historial`. Duplicarla
habría creado dos ideas distintas de "qué campos escribe la máquina"
(`calendarEventId`, `updatedAt`), que es el acuerdo que D-41 evita mantener a
mano.

**Borrar una actividad sí guarda versión** (B-41, D-94): `guardarVersionAlBorrar`
(`onDocumentDeleted`) escribe el documento completo con `borrado: true`, así que
una actividad borrada por error se puede volver a cargar copiando y pegando desde
la consola. **Limitación que queda:** el documento padre ya no existe, así que
esa subcolección es alcanzable por path pero invisible desde el panel — y la
actividad se recrea con otro id (B-89).
