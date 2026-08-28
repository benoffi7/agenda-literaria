# Changelog

## 2026-08-28

### B-227 · El sitio público: el listado con filtros y la página de detalle

El primer frente del diseño de [`12-sitio-publico.md`](12-sitio-publico.md). Cierra
**B-105** y la mitad de **B-107**; el estado sección por sección quedó en una caja
arriba de ese documento, y lo que hace, en
[`04-funcionalidades.md`](04-funcionalidades.md).

**La home** imprime en HTML todas las actividades vigentes —eso es lo que ve Google
y lo que ve alguien sin JavaScript— y encima monta una island que hace **un solo
fetch** de `/events.json` y filtra, busca y ordena en memoria (§2.5). Cuando el
índice llega, la island saca del DOM la lista del build y monta la suya **con el
mismo componente**: un solo markup de tarjeta, y sin parpadeo porque el estado
inicial es el del build. Si el fetch falla, la lista del build se queda donde está:
nunca una pantalla vacía.

**La página de detalle** (`/actividad/{slug}`) es estática y con **cero
JavaScript**: es la que recibe el tráfico de Google y de Instagram. La ficha y el
botón arriba, con el verbo de la vía real; después la descripción, los encuentros
con su tema, quién lo da, el material y cada forma de cursar con su sede.

**Cuatro decisiones**, en [`06-decisiones.md`](06-decisiones.md):

- **D-133** — hay selector de orden, contra lo que decía el §6.1 del diseño. Aquel
  argumento evaluó precio y relevancia, que son los dos criterios que derivan del
  contenido; el que faltaba deriva de **cuándo se cargó**, y es la única forma de
  contestarle a quien vuelve. El default no cambia.
- **D-134** — `creadoEn` entra a la proyección pública para ese orden, y **con
  precisión de día**: publicar el instante exacto de cada carga dibuja la agenda de
  trabajo del dueño, que con un solo admin es un dato sobre una persona (mismo
  razonamiento que D-57 y D-27). `updatedAt` no sale.
- **D-135** — el link de la reunión **tampoco sale a la página de detalle**, ni con
  `urlPublica: true`. Más estricto que D-15, por lo mismo que D-129 lo sacó del
  índice y por una razón más fuerte: un HTML indexado no se despublica.
- **D-136** — la plantilla `.astro` **no recibe el documento**: recibe un
  view-model que `src/lib/detallePublico.ts` armó campo por campo. La frontera de
  privacidad es un tipo, no la disciplina de quien escribe la plantilla — y de paso
  es lo que hace que la página entre al barrido de centinelas, porque un `.astro`
  no se puede importar desde un test.

**Una salida pública nueva, la sexta**, con su lugar en el mapa de
[`07-seguridad.md`](07-seguridad.md) y en la ficha del `auditor-privacidad`
**escrito en el mismo cambio que la creó**. Es la lección de B-212 y de la salida 5
aplicada a tiempo: el agujero de aquellas no era de cobertura, era que el índice no
las nombraba.

**Una sola lectura de Firestore para los tres artefactos del build.** El
`where('estado','==','publicado')` del §5.3 se mudó del endpoint a
`src/lib/contenidoDelSitio.ts`: con tres consumidores, tenerlo tres veces son dos
copias que se pueden olvidar de actualizar, y la que se olvide publica los
borradores en HTML mientras el JSON sigue limpio. Es la clase de B-72.

**Lo que se comparte con el panel, y por qué.** «Cuál es el próximo encuentro» era
una función privada de `filtrosActividades.ts` con tres decisiones sutiles adentro
—se descarta por el fin y se devuelve el inicio, el fallback sin `fin`, los
cancelados no cuentan—. Ahora es `proximaVentana` en `lib/sesiones.ts`, y el panel
y el sitio la llaman con su formato (`Timestamp` uno, ISO el otro). Dos copias eran
el listado del panel y la tarjeta del sitio contestando distinto sobre la misma
actividad, sin que nada falle.

#### El bug que encontró el build, y no los tests — B-228

`export const getStaticPaths = caminosDeDetalle;` —el alias, que es lo que uno
escribe— rompía la generación entera: Astro llama a `getStaticPaths` con un objeto
propio (`{ paginate, rss }`), y ese objeto caía en el parámetro del reloj.
`ahora.getTime is not a function`, **cero páginas de detalle**, y los 1.600 tests en
verde. Lo encontró `scripts/build-contra-emulador.mjs`, o sea el §"Verificar contra
el sistema real" de [`05-patrones.md`](05-patrones.md) haciendo lo que promete. Se
arregló en dos capas —la plantilla envuelve, y la función ignora un `ahora` que no
sea `Date`— y las dos tienen su test.

Mirar el HTML que salió encontró además que el **tema** de un encuentro suelto no
aparecía en ningún lado: la página pública decía menos que el evento de Calendar del
mismo encuentro. Ahora el bloque de encuentros sale también con una sola fecha, si
tiene tema, lectura o está cancelada.

Y un tercero de la misma familia —cosas que el HTML del build muestra bien y que se
rompen **después** de hidratar—: el `id="listado"` al que apunta «Saltar al listado»
estaba puesto solo en el contenedor de la lista del build, que es justo el nodo que
la island **saca del DOM** al tomar el control. En el HTML se veía perfecto; en el
navegador, el link de salto mandaba a un div vacío. Ahora el `id` envuelve al
buscador y a la lista, y hay un test que afirma esa relación de anidado.

#### Lo que dijo el `auditor-privacidad`

Cinco hallazgos sobre la salida nueva, los cinco arreglados acá:

1. **El `url` del organizador entraba al JSON-LD sin pasar por `urlSegura`** (P1).
   El HTML ya caía a texto plano con una web inválida, pero el
   `<script type="application/ld+json">` publicaba el crudo — y `schema.ts` valida
   ese campo como texto, no como URL. Un `javascript:…` salía a la superficie que
   un bot cosecha primero.
2. **`creadoEn` publicaba el milisegundo exacto** de cada carga (P2) → recortado al
   día, ver D-134.
3. **La plantilla podía recuperar el documento entero** sin nombrar nada prohibido
   (P2): ya importaba de `contenidoDelSitio`, así que
   `const { actividades } = await contenidoDelSitio()` compilaba. El test pasó de
   lista negra a **lista blanca de imports**.
4. **Las etiquetas del detalle se resolvían con la lista filtrada por aprobación**
   (P2), y eso invierte D-30 —«se filtra lo elegible, nunca la lista con la que se
   resuelve»—: una actividad con una opción pendiente mostraba «Con Beca Parcial»
   desSlugeado. Ahora son dos mapas, con la asimetría explicada donde se usa.
5. **La salida 6 no estaba en el mapa de salidas** (P1) → agregada a
   `07-seguridad.md` y a la ficha del agente, que un test ata entre sí.

Y una clase de bug que pidió cerrar antes de que apareciera el tercer lado: la ruta
`/actividad/{slug}` se derivaba en dos lugares y el tercero ya estaba escrito en un
comentario de `textoRedes.ts`. Ahora hay `rutaDeDetalle` en
`src/lib/rutasPublicas.ts`, con un test que la ata al **directorio real de la
página** —que es el productor de verdad, porque Astro deriva el path del nombre del
archivo— y otro que prohíbe armarla a mano.

#### Lo que dijo el `auditor-documentacion`

Catorce puntos, y el que importa no es de prosa: **el skill `campo-nuevo`
preguntaba por cuatro salidas y son seis** (**B-235**). Le faltaban las dos de las
que no se puede volver — el posteo de Instagram (desde B-95) y la página indexada
(desde B-227)—, así que se podía seguir el procedimiento al pie de la letra y
filtrar un campo nuevo a cualquiera de las dos. Es el documento que de verdad se
ejecuta cuando alguien toca el modelo, y la ficha del `auditor-privacidad` ya había
tenido exactamente el mismo agujero un día antes (B-216).

El resto era **drift de «el sitio todavía no existe»**, repartido en siete lugares
que este cierre no había tocado: el `README.md` de la raíz, `01-arquitectura.md`
(la frase, el diagrama y el mapa del código, que no listaba ninguno de los archivos
nuevos), `09-analitica.md`, `11-ideas-de-producto.md`, `13-agentes.md` y dos ítems
del backlog (B-121 y B-122). Más el conteo de «cinco salidas» que quedó en el cuerpo
de dos documentos cuando sus tablas ya decían seis, y **B-27**, que estaba hecho
desde B-212 y nadie había marcado.

#### Lo que NO entra en este cambio

- **El sitio no está desplegado.** Sin dominio no hay `site`, y sin `site` no hay
  canonical, ni Open Graph, ni sitemap (**B-109**). Inventar una URL absoluta ahora
  es peor que no ponerla.
- **`novedades.ts` y `ayuda.ts` no se tocan**, y es deliberado: el panel no cambió,
  y los dos textos de la ayuda que dicen «el sitio todavía no está publicado» hoy
  **son ciertos**. Cambiarlos ahora convertiría una ayuda cierta en una que miente.
  Van con el deploy, y quedaron anotados en **B-233**.
- Abiertos en el camino: **B-229** (la hoja de filtros y el CTA fijo de móvil),
  **B-230** (el peso del runtime de React en la home, medido), **B-231** (la casilla
  dice «publicar el link en el sitio» y el sitio no lo publica), **B-232** (el
  fixture del gate de build es anterior a B-224).

#### El contraste, medido — y cuatro niveles de gris que no pasaban

El §10 del diseño dejaba una pregunta abierta: «el acento sobre papel hay que
medirlo antes de usarlo en texto chico». La respuesta es **5,63:1**, o sea que sí
se puede. Pero medirlo encontró lo que la pregunta no anticipaba: la primera
versión de este frente usaba `text-tinta/45`, `/50`, `/55` y `/60` para el texto
secundario, que sobre papel dan **2,86 · 3,30 · 3,84 · 4,49** — los cuatro por
debajo del 4,5 de AA, y el primero por debajo del 3 que pide hasta el texto grande.
Eran 35 usos en seis archivos.

El piso quedó en `tinta/65` (5,29) y lo sostiene `tests/contraste.test.ts`, que
calcula los ratios desde los tokens de `global.css` —no copiados, parseados— y
**además falla si algún componente del sitio escribe una clase por debajo del
piso**: la paleta puede estar perfecta y el componente siguiente bajarla igual, que
es justo lo que había pasado. Con su control negativo: un escalón más abajo del
piso tiene que **no** pasar, si no el número no significaría nada.

#### Números

1.665 tests en 70 archivos —eran 1.423—, todos verdes con los emuladores; 79 los
necesitan. La lógica pura vive en `src/lib/`, testeada aparte de los componentes:
`listadoPublico.ts` (58 casos), `detallePublico.ts` (51), `fechasPublicas.ts` (15),
`contraste.test.ts` (8).

## 1.5.0 — 2026-08-28

**Dos frentes en paralelo, integrados en una sola versión:** «Dónde» pasó a ser una
lista de formas de cursar (**B-224**) y las imágenes se pueden **subir** además de
pegar (**B-220** a **B-223**). Los dos cambian lo que se puede hacer al cargar una
actividad, y el segundo suma un producto nuevo de Firebase con sus reglas y su
emulador: `1.5.0` y no `1.4.1` porque un parche no describe ninguno de los dos.

> **Los dos frentes sellaron mal la versión al principio, y por el mismo motivo.**
> Cada worktree salió de un `main` anterior, así que cuando el trabajo estuvo listo
> el número que habían elegido ya estaba publicado. No es el error que D-117 vino a
> evitar —adivinar el número antes de tiempo— sino una puerta nueva al mismo lugar:
> adivinarlo **desde una base vieja**. Se corrigió al integrar.
>
> Del mismo origen salió el otro desorden de esta integración: los dos numeraron sus
> ítems de backlog sobre identificadores que ya estaban ocupados, y uno renumeró los
> suyos con un reemplazo global que se llevó puestas **trece referencias ajenas** a
> `B-208` y `D-128` —la corrida de seguridad del día anterior—. Se restauraron
> comparando línea por línea contra `main`. La lección para la próxima tanda en
> paralelo: **pushear antes de abrir los worktrees**, y renumerar con el diff a la
> vista, nunca con `sed` global.

### B-224 · «Dónde» es una lista: N formas de cursar, cada una con su lugar

Pedido del dueño: «Una actividad tiene N modalidades (mismo sistema que encuentro,
misma UI). Cada modalidad puede ser presencial, virtual o híbrida, como está ahora.
Solo hay que sumarle una fecha y hora de inicio y una fecha y hora de finalización.
Ambas son opcionales.» Y, preguntado por el alcance: «el formulario de modalidad se
mantiene tal cual + doble fecha… misma interfaz y funcionalidades» que los
encuentros.

`modalidad: 'presencial' | 'virtual' | 'hibrido'` + una `sede` + un `online` pasa a
`modalidades: [{ id, modalidad, inicio, fin, sede, online }]`. El razonamiento
completo está en **D-130**; lo que importa:

- **Cada fila lleva su lugar adentro.** Es lo que permite decir «los martes
  presencial en la librería, los jueves por Meet», que con una sede sola no se
  podía. El id se genera en el cliente (`mod_<uuid>`), nunca por índice (trampa 2).
- **Las fechas se guardan y no se publican.** Qué significan frente a
  `sesiones[].inicio/fin` es **decisión pendiente del dueño** («sobre las fechas,
  te lo consulto pero hacé el resto»), así que hasta que se resuelva no salen a
  ninguna de las cinco salidas del §5. Un campo que no sale no puede decir algo
  equivocado en el calendario de todos los suscriptos; agregarlo después es una
  línea, sacarlo de algo ya publicado no. Lo fija `tests/modalidades.test.ts`,
  buscando las fechas **por su valor** en las cinco.
- **Quedan tres campos derivados** —`modalidad`, `sede`, `online`— que escribe
  `formADocumento` en cada guardado, igual que `searchText`: hay salidas que solo
  admiten un valor (el `location` del evento, el `searchText` del §6, el filtro por
  barrio). `modalidad` es la **unión** de las filas y no «la primera», que
  dependería del orden del array — la trampa 2 en otra forma.
- **El filtro del panel busca por cualquiera de las filas.** Una actividad
  presencial y virtual aparece bajo los tres chips, porque las tres cosas son
  ciertas de ella.
- **Sin migración y sin lectura de compatibilidad**: no hay documentos sin el
  campo (decisión del dueño), así que solo queda un `?? []`. Hubo una
  `modalidadesDe` que sintetizaba una fila con id determinístico `mod_compat` —se
  escribió porque el `auditor-trampas` mostró que sin ella abrir y guardar le
  borraba la sede a un documento así— y **se sacó igual**: dos auditores le
  encontraron algo en una sesión (una rama de proyección pública sin barrido, y
  una fila fantasma con la lista vacía a propósito) sobre una función que existía
  para leer documentos que no existen. El arreglo más barato para una rama sin
  barrido es no tener la rama.
- **La lección de esa vuelta, que vale más que el arreglo:** la fila fantasma
  nació de que `modalidadResultante([])` devuelve `'presencial'` y no vacío. Un
  default razonable en un lugar volvió falsa la condición de otro, a distancia y
  sin que nada fallara.
- **`searchText` indexa la sede de todas las formas de cursar**, no solo la
  principal: con dos filas en dos barrios, buscar por el segundo tiene que
  encontrar la actividad.
- **El índice del listado lleva los valores, no las filas.** `eventsJson.ts` es la
  tercera proyección en serie y su celda quedó decidida: `modalidades: string[]`
  con la unión, para que el filtro del sitio encuentre una actividad
  presencial-y-virtual bajo los tres chips. Las sedes de cada fila son del detalle
  y las fechas no salen.
- **Restaurar del historial ya no ofrece los derivados sueltos.** `modalidad`,
  `sede`, `online` y `searchText` salieron de la lista: restaurar uno por separado
  deja el documento contradiciéndose hasta el próximo guardado, y en el medio eso
  sale al `events.json` y al evento. Restaurar `modalidades` recalcula los tres
  derivados en la misma escritura — B-207 con otro campo. Y el índice de búsqueda
  se arma sobre **el documento que va a quedar**, derivados incluidos: armándolo
  sobre el actual con el campo restaurado encima, el barrio **viejo** quedaba
  adentro al lado del nuevo y la actividad seguía apareciendo al buscar un barrio
  que ya no es suyo. Se corregía sola en la próxima edición completa, o sea nunca
  para quien la busca. Lo encontró el `auditor-trampas` en su segunda pasada.
- **La descripción del evento no cambió para una actividad de una sola modalidad**,
  y es deliberado: si cambiara, la primera edición de cada actividad publicada
  reescribiría sus N eventos en el calendario de todos los suscriptos sin que nada
  hubiera cambiado para ellos (el argumento de D-95).
- **La guarda de privacidad se mudó de lugar.** La poda de `autoguardado.ts` deja
  pasar los arrays a propósito «porque sus proyecciones públicas enumeran campo por
  campo»; al mudar `sede` adentro de `modalidades` esa frase dejaba de ser cierta.
  Ahora enumeran `formADocumento` (más fuerte: la clave de más no llega ni a
  Firestore) y `modalidadPublica`. Las dos con test, las dos verificadas por
  mutación.
- **`VERSION_BORRADOR` sube a 3**, y esta vez sí correspondía: un borrador de la
  forma anterior *parece bueno* y volvería como presencial, con la sede y el link
  perdidos.
- **El chasis de la lista se extrajo** (`campos/FilasEditor.tsx`) y lo usan los dos
  editores, el de modalidades y el de encuentros: agregar, duplicar y borrar **por
  id** viven una sola vez.

**Lo que encontraron los auditores, y no lo habría encontrado la suite.** Los tres
corrieron sobre el cambio antes de cerrarlo:

- `auditor-trampas` (2 hallazgos en dos pasadas): abrir y guardar un documento sin
  `modalidades` le borraba la sede en silencio —de ahí salió, y después se sacó,
  la lectura de compatibilidad—; y restaurar del historial dejaba el barrio viejo
  en el índice de búsqueda.
- `auditor-privacidad` (6 hallazgos, ninguno filtraba hoy): el barrido de
  centinelas nunca veía **más de una fila**, así que el caso que el cambio hace
  posible —el link tildado en la segunda y no en la primera— no estaba fijado por
  nada; `tests/calendario.test.ts` había pasado entero a la rama de respaldo sin
  que nadie lo notara; la sede **derivada** se publicaba con un spread mientras su
  hermana de la fila se enumeraba; y `formADocumento` y el historial escribían dos
  `searchText` distintos. Los cuatro arreglados, con su test.
- `auditor-documentacion` (3): la doc contaba que se había descartado el default
  de lectura, y para entonces el código ya lo tenía —con otro motivo—.

Abre **B-219**: `un anónimo lee lo publicado` falla salteado en la corrida completa
con los emuladores. Es anterior a este cambio —se reprodujo con el árbol limpio— y
apunta a estado compartido del emulador entre archivos de test.
> **Sellada `1.5.0`.** `1.5.0` y no `1.4.1` porque cambia lo que se puede hacer al
> cargar una actividad —subir un archivo— y porque entra un producto nuevo de
> Firebase, con sus reglas y su emulador; un parche no lo describe.
>
> El primer intento la selló `1.4.0` y quedó mal: el worktree salió de un `main`
> anterior, y para cuando el trabajo estuvo listo `1.4.0` ya estaba publicada con el
> `/events.json` adentro. **Sellar una novedad con un número ya usado rompe lo único
> que esa lista sirve para contestar** —«esto empezó con la versión en la que salió
> tal cosa»— y es el mismo error que D-117 vino a evitar, por una puerta nueva: no
> por adivinar el número antes de tiempo, sino por adivinarlo desde una base vieja.

### B-167 (segunda tajada) · Subir imágenes propias, no solo pegar un link

El dueño lo dijo así: «no estoy viendo lo de cargar imágenes, solo siguen las de
URL». Tenía razón — B-167 se hizo en dos tajadas y solo había salido la primera.
Ahora la galería acepta las dos formas que DEC-7c decidió que convivieran desde el
día uno. Razonamiento completo en **D-131**.

Entra un producto nuevo, y con él cuatro lugares donde equivocarse en silencio:

- **`storage.rules` (archivo nuevo).** Lectura pública bajo `imagenes/` —son
  imágenes que van a la tarjeta del sitio y a `og:image`—, escritura solo con el
  claim `admin`, y tipo y tamaño verificados **del lado del servidor**, que es la
  mitad de DEC-7b que el schema no puede dar: abajo del panel hay una consola con
  el SDK cargado. Lo verifica `tests/storage-reglas.integracion.test.ts`
  **subiendo de verdad** contra el emulador, con las reglas empujadas desde este
  checkout (la lección de los worktrees en paralelo: si no, se prueban las de otra
  rama). Verificado por mutación: sacando `tamanoAceptado()` de las reglas, el
  test se pone rojo.
  **Lo que las reglas NO pueden validar es el tope de 4 imágenes** —una regla de
  Storage no cuenta los objetos de un prefijo—, así que ese tope se queda en el
  schema y está escrito para que no se lea como olvido.
- **El emulador de Storage.** `firebase.json` lo declara, y el `--only` de los dos
  lugares que corren la suite pasó a `auth,firestore,storage`. El helper nuevo
  falla ruidosamente con `EXIGIR_EMULADOR=1`: sin eso, los tests de las reglas se
  saltearían **en silencio** con Firestore arriba y Storage abajo, que es
  exactamente lo que pasa si alguien se olvida de actualizar el `--only`.
- **`que-deployar.sh` emite una cuarta línea, `storage=`.** Es un target aparte
  (`firebase deploy --only storage`) y no entra en `--only firestore:rules`: sin la
  regla nueva, un cambio en `storage.rules` se deployaba **nunca**, que es el peor
  de los dos defaults. Y `storage.rules` entró a la lista **negra** de hosting por
  el mismo motivo que `firestore.rules` —es config del servidor y nadie la
  importa—, si no habría arrastrado un deploy de hosting cada vez.
- **El SDK de Storage en su propio módulo diferido**, `src/lib/subir-imagen.ts`.

**El corte del bundle necesitó dos chequeos y no uno, y eso es lo más interesante
que pasó acá.** Lo obvio era sumar `firebase/storage` a `SDK_PESADO`. Se hizo, y
después se intentó romperlo a propósito volviendo estático el `import()`: **el test
siguió verde**. El motivo es que el editor de la galería ya vive tres saltos abajo
de un componente diferido, así que el SDK no llegaba al chunk inicial — se pegaba
al chunk del **formulario**, que baja toda persona que abre una actividad y casi
ninguna sube una imagen. El chequeo que faltaba es «quién es dueño de Storage»:
nadie importa `subir-imagen` de forma estática, y alguien sí lo carga con
`import()`. Con eso, la misma mutación se pone roja.

#### Las dos preguntas de B-206, contestadas

**1 · Cómo se sirve una imagen propia.** Se eligió `getDownloadURL()` —la opción
barata— y no el rewrite de Hosting. Lo que cambió la cuenta es que **la promesa
estaba mal escrita**: el comentario de `toPublic.ts` decía que publicar
`storagePath` «dibuja la estructura del bucket», y la URL de descarga ya llevaba el
path adentro. Con un prefijo plano (`imagenes/`) y el nombre siendo el uuid de la
fila, no hay estructura que dibujar; y con lectura pública bajo ese prefijo, el
token permanente no protege nada que no estuviera abierto. `storagePath` sigue
afuera del `events.json`, pero por lo que sí es —el handle autoritativo del panel—
y no por un secreto que la URL desmiente. El comentario se reescribió: **una
afirmación de seguridad que miente es peor que no tenerla**, que es la lección de
B-195. El rewrite quedó en **B-222** con el motivo corregido: costo de egreso y
portabilidad, no privacidad.

Un detalle que decidió el diseño: **el path no se agrupa por actividad**, y no es
un descuido. Al subir todavía no hay actividad — una actividad nueva no tiene id
hasta que se guarda, así que `actividades/{id}/…` obligaría a guardar antes de
poder subir una imagen, justo al revés de cómo se carga una actividad.

**2 · Los dos dueños de `storagePath`, `ancho` y `alto`.** Implementado tal como
B-206 lo dejó escrito: `CAMPOS_DE_MAQUINA_IMAGEN` en `functions/historial.js` y
`formADocumento` **enumerando** las claves de cada imagen en vez de spreadear la
fila. Hoy el segundo escritor todavía no existe, así que las dos mitades son
preventivas — y se hicieron ahora porque es cuando son gratis; el día que llegue la
Function, el costo de haberse olvidado es una versión de historial y un rebuild del
sitio **por cada imagen optimizada**.

Un detalle que B-206 no anticipaba: los tres se copian con «si está» y no con
`?? null`. Firestore guardaría el `null` como valor presente y
`huboCambioDeContenido` no unifica ausente con `null` a propósito (D-41), así que
un `storagePath: null` en toda imagen externa produciría una versión y un rebuild
por guardado.

#### El EXIF se saca en el panel, aunque DEC-7d se lo dé a la Function

DEC-7d sigue en pie y la Function sigue haciendo falta: es la que **no se puede
saltear**, igual que las reglas frente al schema. Pero la Function es justamente lo
que esta tajada no trae, y entre una tajada y la otra hay imágenes propias
públicas. Una foto de celular lleva las coordenadas del lugar donde se sacó, y
muchos talleres pasan en la casa de alguien: eso no es una optimización pendiente,
es el dato personal de un tercero en el `events.json`, y una vez publicado no se
despublica. Así que el panel lo saca ahora y la Function lo va a sacar otra vez.

**Se saca sin recomprimir**, y esa parte es una decisión con tres motivos: dibujar
en un `canvas` pierde calidad sin que nadie lo pida; **haría que el tope de 3 MB de
DEC-7b deje de significar lo que se decidió que significara** —una foto de 8 MB
entraría recomprimida y el mensaje que empuja a recortar no aparecería nunca—; y no
se puede testear sin un navegador. Recorriendo los segmentos JPEG y los chunks PNG
a mano, la función es **pura** y el test verifica sobre los bytes de salida que el
bloque `Exif` no está y que el dato comprimido salió idéntico. Verificado por
mutación: sacando `0xE1` de la lista negra, el test se pone rojo.

Consecuencia asumida: **solo se pueden subir JPG y PNG.** WebP y AVIF se siguen
mostrando si son externas —las sirve su origen y no las tocamos, DEC-7d— pero no se
suben, porque sus contenedores también llevan EXIF/XMP. Vuelven con B-220.

#### La red que se puso antes de que hiciera falta

`tests/clases-de-bug.test.ts` promete en su cabecera que «un trigger nuevo entra
solo». **Para un trigger de Storage eso era falso:** el descubridor buscaba
`onDocument*` y `onSchedule` y nada más, así que un `onObjectFinalized` —el de
DEC-7d, el que escribe la miniatura en el mismo bucket que lo dispara, o sea la
trampa 3 con otra cara— habría entrado sin que nada le pidiera la guarda anti-loop.
Se agregaron las cuatro clases `onObject*`. Hoy no cambian ningún resultado, y ese
es el punto: es el único momento en que agregarlas es gratis.

#### Lo que cambió de paso, y por qué

**La casilla «las imágenes subidas al panel» del modal de duplicar dejó de
mostrarse.** B-199 la había dejado apagada con `aplica` escondiéndola, porque no
podía existir una imagen propia. Desde que puede, daría `true` y sería una casilla
que **no hace nada**: tildarla no copia el objeto de Storage. Lo que se ofrecía
como opción pasó a `SIEMPRE_AL_DUPLICAR`, que es donde viven los hechos no
negociables. Una casilla que miente es peor que una función que falta.

**El schema acepta `http://` contra `localhost`.** El emulador de Storage sirve por
`http://127.0.0.1:9199/…`, así que sin la excepción una imagen propia subida en
desarrollo no se podía publicar ni para probar el flujo — que es lo que el §10 pide
hacer contra emuladores. Lo que habilita en producción es una URL a `localhost`, o
sea una imagen rota en la vista previa del propio panel; `data:` y `javascript:`
siguen bloqueados por el mismo `if`, que era el motivo real de esa validación.

**Dos eventos nuevos de analítica**, `imagen-subida` e `imagen-rechazada` (con
`detalle` en un enum cerrado: `tamano`, `tipo` o `red`). El segundo es el único
termómetro del tope de 3 MB: si casi todos los rechazos son por tamaño, el número
está mal elegido y lo que hay que hacer es recomprimir del lado de la Function, no
explicar mejor.

#### Lo que falta, con ítem propio para que no se confunda con esto

**B-220** — la Function de DEC-7d: recompresión, miniatura y el segundo pase de
EXIF. Se partió a propósito, y el criterio es el del repo: preferimos subir
imágenes sin miniatura a no subir nada. Arrastra una dependencia binaria en
`functions/`, el emulador de Functions atado al de Storage, la guarda anti-loop y
una decisión que todavía no está tomada — **cómo encuentra la Function la actividad
que referencia la imagen**, si el path no lleva su id.

**B-221** — nadie borra los objetos huérfanos. Deliberado y escrito: un objeto de
más cuesta centavos y es invisible; un borrado automático no tiene papelera.

**B-222** — servirlas por dominio propio o rewrite de Hosting, por costo de egreso
y portabilidad de las URLs guardadas.

#### Lo que encontraron los auditores, y por qué vale contarlo

Los tres corrieron sobre el cambio terminado. Cuatro hallazgos reales, y los cuatro
son de la misma familia: **una capa que confía en lo que le dice otra**.

- **El tipo del archivo se creía, no se verificaba** (P0). El `type` de un `File` lo
  deriva el navegador de la **extensión**. Entonces un WebP —o un HEIC— renombrado
  `.jpg` pasaba `validarArchivo`; `sinMetadatos` no reconocía la firma y devolvía el
  archivo **tal cual**; y `storage.rules` lo aceptaba porque compara el
  `contentType` que manda ese mismo cliente. Las tres capas miraban el mismo dato
  y el navegador después lo renderizaba igual, porque para mostrar una imagen se
  mira la firma y no el nombre. Ahora se verifican los bytes antes de subir
  (`esDelTipoDeclarado`), que no puede rechazar un archivo bueno: un JPEG empieza
  siempre con `FF D8`.
- **«Desde SOS hasta el final son los datos comprimidos» era falso** (P1). Muchos
  celulares apendan cosas **después del EOI**: la imagen secundaria MPF de los
  Samsung es un JPEG entero **con su propio APP1 y su propio GPS**. Copiar «hasta el
  final» se la llevaba puesta. Ahora se corta en el EOI real (`finDelJpeg`),
  respetando el byte stuffing, los marcadores de reinicio y los segmentos de un
  JPEG progresivo.
- **Y la respuesta de fondo a los dos, que es la que va a envejecer bien:** un
  **barrido sobre la salida**. Antes de subir, se buscan las tres marcas de
  metadatos en los bytes que se van a subir y, si aparece alguna, la subida se
  corta. Es el §5 aplicado a una salida binaria: se afirma sobre el resultado en
  vez de sobre la lista de marcadores, así que un contenedor nuevo o un trailer
  que todavía no vimos cae igual, sin que nadie lo haya previsto.
- **`allow read` de Storage incluye `list`, y eso era una fuga viva** (P1). Con
  `read: if true` sobre `imagenes/`, un `listAll()` **anónimo devolvía el bucket
  entero** — comprobado contra el emulador, no deducido. Ahí el path opaco dejaba
  de comprar nada (no hace falta adivinar un uuid si te dan la lista) y adentro
  están también las fotos de las actividades en borrador. Va separado:
  `allow get: if true` y `allow list: if esAdmin()`, con su caso en el test.
  **Es la trampa 13 del §13**, que no existía.
- **Los tres motivos de rechazo no estaban en el vocabulario de `detalle`** (P2), así
  que llegaban a GA4 como `otro` y `imagen-rechazada` no era termómetro de nada. Es
  la clase de B-88 —productor y consumidor del mismo vocabulario declarados por
  separado— y falla en silencio. `MOTIVOS_IMAGEN` vive ahora en
  `analytics-eventos.ts` y `ImagenRechazada.causa` **importa** ese tipo.

Y dos comentarios que este mismo cambio volvió falsos y quedaron sin actualizar:
el de `storagePath` en `types/actividad.ts` —que repetía la frase que el cambio
declaró falsa— y el de `duplicar.ts`, que seguía diciendo «no hay forma de que
exista una propia». Los dos corregidos: **una afirmación de seguridad que miente es
peor que no tenerla**, y el tipo es la copia que más gente lee.

#### Lo que el rebase obligó a corregir, y lo que enseñó

Este frente salió de `1.3.0` y volvió cuando `main` ya estaba en `1.4.0`, cuatro
commits más adelante. Nada del código chocó —el `/events.json` de `1.4.0` deriva su
`imagenUrl` de `portadaDe(a.imagenes)`, así que las imágenes propias entran al índice
sin tocar nada—, pero **la numeración sí**: los cinco ítems que este frente había
abierto como B-208…B-212 ya estaban ocupados por otra cosa en `main`, incluida una
fuga P0. Se renumeraron a **B-220…B-223** y la decisión pasó de D-128 a **D-131**.

No es cosmético: un número reusado manda a quien lo sigue al ítem equivocado, y en
esta misma tanda eso ya había mandado una trampa del §13 a la entrada que no era.

Y uno de los cinco no había que renumerarlo sino **fusionarlo**: «los tests de
integración se pisan entre sí» ya existía en `main` como **B-219**, encontrado por
otro frente el mismo día y por otro camino. La evidencia de acá se sumó ahí y acota
la causa: **no hace falta un segundo worktree** —con `vitest` paralelizando archivos
dentro de una sola suite ya alcanza, dos corridas seguidas fallaron en tests
distintos—, y `--no-file-parallelism` pasa siempre. Eso descarta que el arreglo pueda
ser solo de coordinación entre working-trees.

**Y apareció un bicho del propio proceso, que es B-224 y ya mordió dos veces:**
`git stash` vive en `refs/stash`, que es del **repositorio** y no del working-tree.
`git worktree` aísla el índice, el `HEAD` y los archivos; el stash, no. Un
`git stash push` para poder rebasear, otro frente stasheando en el medio, y el `pop`
se trae el trabajo del otro. Acá se recuperó entero porque el conflicto hizo que git
**conservara** la entrada; el modo malo es el que aplica limpio, que borra la entrada
y deja los cambios del otro mezclados en un árbol ajeno sin rastro. Es la misma
familia que B-219: algo que uno supone aislado por worktree y es global del repo.

**Sin desplegar todavía:** `storage.rules` es un archivo nuevo y nunca se subió, así
que hasta que se corra `firebase deploy --only storage` el botón de subir falla con
un mensaje de red. Es el primer paso al publicar esta versión — ver
`08-operacion.md` § «Reglas de Storage», que además avisa de revisar que el bucket
exista.
## 2026-08-27 (después de 1.4.0)

Sin versión nueva: no cambia nada de lo que el panel o el sitio hacen. Es el gate
que no probaba lo que prometía, más las redes que faltaban alrededor de la salida
pública que `1.4.0` estrenó.

### B-217 · El paso 4 del gate pasaba en verde sin leer Firestore

`1.4.0` cerró con esta frase: «de paso, `verificar-todo.sh` apunta el build al
emulador (…) y hace que el gate local ejercite la lectura de verdad en vez del
camino vacío». **No la ejercitaba**, y lo encontró el `auditor-trampas`.

Dos motivos que se tapaban entre sí. El paso 3 tiene dos ramas: si hay un hub de
emuladores arriba lo reusa y queda vivo, y si no usa `emulators:exec`, que
**levanta y apaga** los emuladores alrededor de los tests — así que en esa rama, al
llegar al paso 4, no había nadie escuchando y el build moría a los **44 segundos**
con `14 UNAVAILABLE`. El gate corrido sin emulador previo fallaba siempre y por su
propia plomería, que es justo lo que el paso 3 había aprendido a no hacer (B-180),
reintroducido un paso más abajo. Y con el emulador vivo tampoco probaba nada: los
tests de integración del paso 3 llaman a `limpiarFirestore()`, así que el paso 4
llegaba a una base **vacía** —medido: `0` actividades— y el build leía cero y salía
en verde.

O sea: un chequeo agregado **para** garantizar «esto leyó Firestore» que pasaba
idéntico leyendo cero documentos. Es exactamente la trampa que el commit decía
prevenir (D-123), con el gate cayendo en ella.

La detección del hub ahora se hace **una vez** y la comparten los dos pasos —tenerla
escrita dos veces fue lo que dejó al paso 4 apuntando a un puerto que el paso 3
apagaba— y el paso 4 corre `scripts/build-contra-emulador.mjs`: siembra una
actividad publicada y una en borrador, buildea, y **afirma sobre el
`dist/events.json` que salió**. La publicada está, la borrador no, y ningún
centinela de los campos recortados sobrevivió. Los fixtures se borran en un
`finally`, porque el emulador de quien está trabajando puede tener datos
persistidos.

**Verificado por mutación**, que es lo único que distingue un chequeo de un
comentario: con el `where` apuntado a un estado inexistente falla nombrando las
cero actividades; sin el `where` falla nombrando la borrador; con
`destino: a.inscripcion.destino` en el índice falla nombrando el campo.

### B-218 · Las redes que faltaban alrededor de `/events.json`

Cuatro hallazgos del `auditor-privacidad` sobre `4d223c1`, verificados uno por uno
contra el árbol antes de acatarlos. **Ninguno era una fuga**: el recorte del
índice, la query y `cierraEn` estaban bien. Lo que faltaba era la red.

**Ningún test nombraba `src/pages/events.json.ts`.** Borrar el
`.where('estado','==','publicado')` dejaba la suite entera en verde y publicaba en
un solo GET el contenido de borradores, pendientes y canceladas. Lo cierra
`tests/events-json-endpoint.integracion.test.ts`, que siembra la publicada y las
tres no públicas y afirma sobre el JSON que el endpoint devuelve — de integración
y no de texto, porque un `grep` al fuente pasaría con la cláusula escrita mal. El
mismo archivo cubre las dos ramas de credenciales (D-123, B-189), que hasta hoy las
sostenía una frase de un mensaje de commit.

**La tabla de salidas nombraba un solo productor de la salida 1.** Desde B-106 son
tres en serie: `toPublic.ts` decide qué *puede* ser público, `eventsJson.ts` qué
necesita el listado, y `events.json.ts` *qué documentos* se leen. Es la forma de
B-216 un archivo más adentro — un cambio que tocara solo `eventsJson.ts` no
despertaba al auditor por nombre de archivo. Actualizadas las dos tablas y el
`description` del frontmatter, que es el disparador.

**La guarda de B-212 estaba cableada a un archivo.** `src/lib/eventsJson.ts` hereda
la posición exacta de `toPublic.ts` —proyección pura, sin consumidor cliente hoy,
con uno previsto en B-105— y ninguna de las tres redes lo veía: el barrido de
credenciales busca `from 'firebase-admin` y el import sería la puerta legítima, el
grafo de la island no lo alcanza, y `verificar-bundle.sh` lo vería en `dist/`, o sea
tarde. Ahora es un `describe.each` sobre los dos.

**Dos celdas sin decidir**, las dos con test nuevo: el link de la reunión con
`urlPublica: true` no entra al índice — que es **D-129**, y no era una decisión
tomada sino una consecuencia — y el `resumen` es un recorte de verdad, cosa que
`resumen: a.descripcion` habría roto sin poner nada en rojo.

Los tres tests nuevos se verificaron por mutación antes de darlos por buenos.

## 1.4.0 — 2026-08-27

**El sitio público arrancó: `/events.json` existe** (B-106), y con él cierran
B-111 y B-37. `1.4.0` y no `1.3.3` porque hay un artefacto público nuevo y un
campo nuevo en la proyección: un parche no lo describe.

Sin novedades en el panel: nada de esto se ve al cargar una actividad.

### B-106 · El índice que el listado va a filtrar en memoria

`src/pages/events.json.ts` lee Firestore con el Admin SDK en el build y
`src/lib/eventsJson.ts` arma el índice. Sale como archivo estático: el público hace
**un** fetch cacheado y **cero** lecturas de Firestore (§2.5), que es lo que hace
que la parte pública no cueste prácticamente nada.

**Es la tercera proyección en serie sobre el mismo documento**, y el detalle que
importa es que **recibe una `ActividadPublica`, no una `Actividad`**: así no puede
volver a decidir sobre `difusion` o `createdBy` — esa decisión ya está tomada un
eslabón antes. `toPublic` contesta «qué puede ser público»; esto contesta «qué
necesita el listado», que es menos. Dos preguntas distintas, dos lugares.

Lo que el índice **no** lleva y sí está en `toPublic`: `descripcion` (va un
`resumen` de ~160 caracteres cortado en palabra), `inscripcion.destino`,
`sede.direccion`, `sede.geo`, `sede.indicaciones`, `material`, `sesiones[].tema`,
`sesiones[].lectura` y `tallerista.bio`.

**El motivo número uno no es privacidad, y conviene decirlo bien:**
`inscripcion.destino` **es** público —sale en el HTML del detalle—. Lo que cambia es
que servirlo en el índice lo entrega **en lote y en un solo GET**, y esa diferencia
es la que decide si un bot lo cosecha. El §5.1 ya advertía sobre ese campo.

Tiene su propio barrido de centinelas, con **control negativo**: se exige que volcar
la `ActividadPublica` sin recortar —el atajo de una línea— falle nombrando
`inscripcion.destino`. Se agregó en el mismo cambio que la proyección y no después,
porque las dos vueltas anteriores enseñaron que la salida que nace fuera del barrido
se queda afuera.

**La guarda de credenciales, verificada en las dos ramas** (D-123, B-189). En CI sin
credenciales el build **falla**: probado, sale con estado 1 y **no emite el
archivo**. Esa es la mitad que importa — leer cero actividades no falla solo,
produce un `events.json` vacío y el deploy lo publica encima del sitio que sí tenía
datos, con el workflow en verde. Borrar el sitio de Google se recupera en semanas,
no en un rebuild. En local sigue con lista vacía y un aviso, para poder trabajar el
CSS sin emuladores.

De paso, `verificar-todo.sh` ahora apunta el build al emulador: los emuladores ya
eran requisito del paso 3, así que no agrega dependencia y hace que el gate local
ejercite la lectura de verdad en vez del camino vacío.

### B-111 · `abierta` se congela en el build, así que va la fecha

Era dependencia dura de la forma diseñada del índice. `toPublic` proyecta
`cierraEn` (el ISO de `cierra`) **además** del booleano, y el índice lleva la fecha:
quien consume la recalcula con **su** reloj. `abierta` se conserva —el arreglo era
«además del booleano», no «en lugar de»— porque un consumidor sin JavaScript no
puede recalcular nada.

**La lista de claves de `toPublic.test.ts` hizo su trabajo:** agregar el campo puso
la suite en rojo nombrando la clave nueva. Un campo nuevo en una proyección pública
tiene que ser una decisión, y esa lista es lo que lo garantiza.

### B-37 · La cabecera del índice

`no-cache` en `firebase.json`, y no un `max-age` corto: el archivo **no lleva hash
en el nombre** y cambia en cada rebuild, así que un `max-age` deja el índice más
viejo que el HTML que lo acompaña — y el síntoma es un listado que muestra una
actividad que la página de detalle ya no tiene. `no-cache` no significa «no
cachear»: significa revalidar, así que el CDN sigue sirviendo y paga un `304`.

### Lo que NO entró, con su motivo

- **El `?v=` con el que la island va a pedir el archivo.** No hay island todavía:
  es B-105.
- **`estado` en la proyección.** El ejemplo del diseño lo lista, pero hoy toda
  entrada del índice es `publicado` por construcción (§3.3), así que sería un campo
  provablemente constante. Lo necesita la franja CANCELADA del detalle, que es
  B-112 + B-110.

### Documentación

`04-funcionalidades.md` pasó de «Sitio público — no existe» a describir la pieza que
sí existe, con las tres cosas que hay que saber antes de consumir el índice.
`README.md` marca el paso 3 como arrancado. El BACKLOG cierra los tres ítems.
`10-salud-del-codigo.md` remedido: la concentración **bajó** un punto mientras el
código creció, que es la primera vez que la métrica se mueve para el lado bueno en
esta serie.

1390 tests.

## 1.3.2 — 2026-08-27

**Los tres P1 que abrió la auditoría de 1.3.1, cerrados.** Uno era un bug de
verdad; los otros dos eran huecos de red. Y los tres dejaron una lección sobre el
método de verificación del panel, que es lo que más vale de la entrada.

### B-210 · La trampa de foco estaba copiada en dos diálogos, y la copia se quedó sin el arreglo

`src/lib/foco.ts` compartía la **aritmética** del foco y dejaba el DOM en cada
componente, con el argumento —escrito en su docblock— de que ahí está el `ref`. Con
una capa era correcto. Con dos significó ~40 líneas copiadas verbatim, y las dos
copias divergieron justo en lo que importa: `DialogoDuplicar` guardaba el callback
en un `ref` con deps `[]` (arreglo deliberado y comentado) y `CentroAyuda` se quedó
con `[onCerrar]`, mientras `BotonAyuda` le pasa una flecha inline.

Cómo se veía: marcar las novedades como leídas cambia el estado de `BotonAyuda`, o
sea re-render, o sea función nueva, o sea el efecto se desmonta y se vuelve a
montar — devolviendo el foco al botón «Ayuda», robándoselo de vuelta a la caja y
haciendo parpadear el scroll en el medio.

Ahora el cableado está en `useCapaModal` y las dos capas lo usan. **La lección:
compartir la mitad fácil de escribir mal no alcanza si la otra mitad también lo
es.** La aritmética estaba compartida y el bug apareció igual, en el cableado.

**Y lo que costó más que el arreglo: los cuatro tests que se rompieron.** Buscaban
`e.key===Escape` y `alCancelar=useRef(onCancelar)` *dentro de* `DialogoDuplicar.tsx`,
así que **un refactor que mejora el código los puso en rojo**. Es la cuarta vez que
un chequeo que lee el fuente termina midiendo un archivo que ya no tiene lo que
busca. No se los repuntó al archivo nuevo —sería el mismo chequeo frágil con otra
ruta—: ahora afirman la propiedad de que ninguna capa tenga cableado propio, lo que
además cubre a la próxima capa que alguien escriba. Verificado por mutación en las
dos direcciones.

Ese segundo caso es el que conviene mirar: un test que se rompe cuando el código
mejora **cobra un impuesto a cada refactor**, y ese impuesto se paga en refactors
que no se hacen. Está escrito en `docs/10-salud-del-codigo.md` como el argumento
más fuerte que hay hoy para B-08.

### B-211 · El doble de `Timestamp` estaba definido trece veces, en cuatro formas, y dos mentían

A mano en once tests y exportado desde los dos fixtures, con formas distintas cada
uno. Dos de las cuatro devolvían `seconds: 0`, o sea «todo Timestamp es la época».
No rompía nada porque ningún código de producción lee `.seconds` —lee `.toDate()` y
`.toMillis()`—, pero el `Timestamp` real de Firestore sí lo expone: era una bomba
con fecha, no una simplificación. Es la trampa 1 del §13 dentro del fixture que
existe para atajarla.

Ahora hay uno, en `tests/fixtures/tiempo.ts`, devolviendo `TimestampLike` — el tipo
que el modelo declara y que las copias de dos campos no satisfacían.

**Lo que faltaba no era el fixture: era la guarda.** Esta es la clase que el repo
**ya había automatizado** (`fixtures/ciclo.ts` + `invariantes-de-ciclo.test.ts`,
después de aparecer cuatro veces) y volvió con otra cara: no era que el fixture no
ejercitara el caso, era que había trece y no se parecían entre sí. O sea **la
automatización se escribió y no se adoptó**, que es un modo de falla distinto y no
tenía red. La clase de B-211 busca la **forma** (`toDate` y `toMillis` juntos) y no
el nombre, así que también caza al que se llame `stamp` o `t`. La adopción de
`tests/fixtures/` pasó de 7 archivos sobre 59 a 16 sobre 60.

### B-212 · La proyección pública de `/opciones/*` no existía, y el barrido no la veía

El `events.json` lleva las opciones de taxonomía además de las actividades: sin
ellas no hay chips de filtro. El documento tiene siete campos y **dos** salen
(`slug` y `label`, §4.4); los otros cinco son de gestión, y uno —`huellaCreador`—
es un identificador estable de una persona.

Se escribió **antes de su consumidor** (B-106 no existe todavía) y ese es el punto:
el camino corto al implementarlo es volcar `valores` tal cual, una línea que se lee
razonable, y con eso entran `huellaCreador` y `usos` sin que nadie lo haya
decidido. Y nada lo detendría: `ValorOpcion` estaba en la lista de interfaces
AJENAS del barrido de B-196, o sea que **la única salida nueva ya planificada nacía
fuera de la red**. Ahora está anclada, con `opcionCentinela()` y tres centinelas
propios. Verificado por mutación: cambiar la proyección por `{ ...v }` dispara
«FUGA DE PRIVACIDAD … opcion.huellaCreador».

**Un error propio que vale anotar**, porque es la clase de B-72 apareciendo en el
acto de cerrar otro ítem: la primera versión filtraba las no aprobadas con
`v.aprobada !== false` en vez de reusar `estaAprobada`, que es
`v.fijo || (v.aprobada ?? true)`. Eso habría borrado de los filtros del sitio a una
opción **base** con `aprobada: false` — «Gratis», «A la gorra». Hay dos `it` que lo
fijan, y la regla se importa de `taxonomia` y no de `opciones`, que arrastra
Firebase a una proyección que corre en el build.

### Segunda vuelta: los cinco hallazgos del auditor sobre el propio cierre

Ninguno era una fuga, y **cuatro eran afirmaciones que este cambio había escrito.**
Van juntos porque cuentan una sola cosa: una regla explicada en un comentario o en
una tabla no es una regla, y el test que la ata puede tener el mismo bug que
pretende cerrar.

**El guard de B-216 no podía ver lo que B-212 le rompió.** `07-seguridad.md` pasó a
decir que la salida 1 la producen `toPublic` **y** `opcionesPublicas`, y la ficha del
agente se quedó con solo `toPublic` — igual que el problema que B-216 había cerrado
ocho horas antes, pero un nivel más adentro: el guard comparaba el primer path del
repo de cada fila, y las dos filas colapsaban a `src/lib/toPublic.ts`, iguales. El
índice envejeció y el test que lo ataba miraba el **archivo**, no qué de ese archivo
produce la salida.

Ahora compara las funciones, y es **direccional**: la ficha puede nombrar más detalle
que el documento (nombra `construirDescripcion`, `redactar`…), lo que no puede pasar
es que el documento nombre un productor que la ficha no conoce. La primera versión
comparaba conjuntos y saltaba con cuatro desalineaciones legítimas.

**Y la ficha decía otra cosa que B-212 volvió falsa:** «el creador de una opción va
como huella de 8 hex». Se leía como *«el creador sale como huella»*, que es lo
contrario de lo que se acababa de decidir. Que sea una huella y no un uid la hace
aceptable **en el documento**, no publicable.

**«Verificado por mutación» era a mano.** El BACKLOG y `13-agentes.md` afirmaban que
un spread en la proyección disparaba la fuga; eso se había probado a mano y ningún
test lo sostenía. Para la actividad ese control negativo existía (el caso `sinLibro`);
para las opciones no. Ahora está codificado, y exige que el barrido falle **nombrando**
`opcion.huellaCreador`: un barrido que se rompe con un mensaje genérico no sirve a las
2 de la mañana.

**Anclar `ValorOpcion` la metió en dos de las tres redes del fixture.** Entró al
chequeo de cobertura —sus siete campos tienen que estar en `opcionCentinela()`— pero
no al recorrido que exige que cada string sea rastreable, que solo recorría la
actividad. Un campo de texto nuevo en la taxonomía quedaba **obligado a declararse y
podía declararse con un valor inocente**: visible para el compilador, invisible para
todo barrido. Es una línea.

**El import que el docblock explica no lo fijaba nadie.** `toPublic` trae
`opcionesVisibles` de `@/lib/taxonomia`, que es puro, y no de `@/lib/opciones`, que la
re-exporta y además abre el cliente de Firestore. Está escrito con su por qué — y
hacer el cambio **typechequea y deja toda la suite en verde**, arrastrando
`firebase/firestore` al módulo de la proyección pública. El grafo de
`bundle-panel.test.ts` tampoco lo veía, porque `toPublic` todavía no tiene ningún
importador en `src/` (B-106). O sea: un archivo con una regla escrita, fuera de las
dos redes que existen. La guarda nueva recorre el cierre transitivo de sus imports y
nombra la cadena entera.

**Y la tabla de privacidad atribuía todo a `opcionesPublicas`, que no interviene en
dos de los tres caminos.** El documento de taxonomía llega a tres salidas por tres
implementaciones distintas de la misma decisión (`slug` y `label`, nada más):
`opcionesPublicas` para el `events.json`, `labelsDeOpciones` para el posteo y la vista
previa, y `cargarLabels` para el evento de Calendar de verdad. La tercera **no se
puede unificar**: `functions/` se despliega con su propio `package.json` y no importa
de `src/` (D-20). Quien mañana busque por qué `usos` no sale al evento iba a mirar
`opcionesPublicas`, que no participa de ese camino.

Para ese caso la política del repo ya estaba escrita en `10-salud-del-codigo.md` —«un
test que compare las listas, no un import imposible»— así que se aplicó: la clase de
B-212 en `clases-de-bug.test.ts` exige que los tres caminos lean exactamente `slug` y
`label`.

**Ese test salió mal la primera vez, y es el detalle que más vale de la entrada.**
Rastreaba los accesos a través de una variable llamada `v` (`v.usos`,
`v.huellaCreador`). Se probó metiendo un `sort((a, b) => b.usos - a.usos)` en
`labelsDeOpciones` y **siguió en verde**, porque la variable se llamaba `b`. Un
chequeo que depende del nombre que eligió quien escribió el código verifica la
convención de nombres, no el código. Ahora deriva del modelo qué campos están
prohibidos y busca el acceso sin importar la variable — verificado con las dos
mutaciones, la del `sort` y la de publicar la huella.

Nit de paso: `src/types/actividad.ts` mandaba a buscar `estaAprobada` en
`lib/opciones.ts`, y vive en `lib/taxonomia.ts`.

### Documentación

`07-seguridad.md` suma las dos filas de `/opciones/*` a «Qué NUNCA sale» y aclara
que la salida 1 son actividades **y** opciones. `03-modelo-de-datos.md` dice qué de
la taxonomía sale al JSON. `13-agentes.md` suma las tres redes nuevas.
`10-salud-del-codigo.md` remedido: el problema 2 cerró y el problema 1 tiene ahora
sus dos casos concretos del mismo día.

Sin novedades en el panel: B-210 arregla un parpadeo del foco, que es un defecto y
no una capacidad nueva — esa lista contesta «qué podés hacer ahora que antes no
podías» (D-117).

1369 tests.


## 1.3.1 — 2026-08-27

**Auditoría completa del repo: los tres auditores más una remedición de la salud
del código.** Salieron dos P0, los dos de privacidad y los dos arreglados acá.
`1.3.1` y no `1.4.0` porque no cambia nada de lo que se puede hacer con el panel —
pero sí lleva versión propia, y no entra bajo la de arriba, porque cambia las
reglas de Firestore que se despliegan a producción y eso tiene que ser rastreable
a un número.

**Ninguna entrada en `novedades.ts`**, y es a propósito: quien carga actividades
no ve ninguna diferencia. Esa lista no es un registro de trabajo (D-117).

### P0 · Un anónimo leía el documento crudo de toda actividad publicada — B-208, D-128

`firestore.rules` decía `allow read: if esAdmin() || resource.data.estado ==
'publicado'`, que es **lo que prescribe el §5.3 del `CLAUDE.md`**. Una query
anónima con el `where('estado','==','publicado')` devolvía los documentos enteros:
el link de la reunión con `urlPublica:false`, `difusion.notas` y `arrobar`, la URL
del material privado, los uids, el `calendarEventId` y el `storagePath`. La lista
completa del §5.1, salteando `toPublic`.

**Se reprodujo contra el emulador antes de tocar nada**, con las reglas de este
checkout cargadas por la API del emulador. Y era explotable en producción: el repo
es público, `.env.production` está versionado con el `projectId` y la API key, y
`push-main.yml` deploya las reglas tal cual.

El error de fondo, que es lo que vale de este cambio: **una regla de Firestore no
proyecta.** Es todo-o-nada por documento. La regla del §5.3 se leía como inofensiva
porque §2.4/§2.5 dicen que el público hace un fetch de `events.json` y cero
lecturas de Firestore — pero *permitir* una lectura y *necesitarla* son cosas
distintas, y toda la maquinaria de proyección estaba cuidando una puerta que tenía
otra abierta al lado. Agrava que `toPublic` todavía no tiene consumidor (B-106):
el 100 % de lo alcanzable desde afuera entraba por ahí.

Arreglo: `allow read: if esAdmin();`. La alternativa —partir el documento en una
subcolección `privado/`— queda escrita en D-128 para el día que haga falta lectura
en vivo desde el cliente.

**Y el detalle que más incomoda:** el test que fijaba esto se llamaba
`it('un anónimo lee lo publicado')` y estaba **en verde**. No estaba mal escrito:
fijaba fielmente lo que el §5.3 prescribía. Un test puede estar verde, ser
correcto respecto de su especificación, y estar certificando una fuga. Por eso el
reemplazo son tres `it` —rechazo por documento, rechazo por query, y un **control
positivo** (`el admin SÍ lee la publicada, con sus campos privados adentro`)—: sin
el tercero, los dos primeros darían verde sobre una colección vacía.

De paso, `tests/actividades.integracion.test.ts` era el único test de reglas que
**no** empujaba las reglas del checkout al emulador (`cargarReglas`), así que en un
worktree podía estar verificando el archivo de otra rama. Ahora las empuja.

El mapa de trampas se puso rojo solo para avisar que su sección «Sin red» había
quedado desactualizada, que es el comportamiento que B-119 compró.

**Cierra B-172**, la trampa 7 del §13 — pero en el segundo intento, y eso es lo
que más vale de esta entrada. Al arreglar la fuga se escribió una query anónima en
el test de reglas, se la vio pasar y se dio la trampa por cerrada. **Pasaba por el
motivo equivocado:** sin condición sobre `resource.data`, *toda* query anónima se
rechaza, con `where` y sin `where` — y lo que la trampa 7 describe es el
**contraste** entre las dos. Lo encontró el `auditor-trampas` revisando este mismo
cambio. Y `mapa-de-trampas.test.ts` no podía verlo: exige que algún archivo de
`tests/` contenga el string `trampa 7`, y eso lo satisface un comentario. El
chequeo verifica que exista una red, no que la red pruebe el mecanismo.

La red de verdad es el `describe('trampa 7 — el mecanismo, con una regla
condicionada')`, que carga **su propio ruleset** con la regla condicionada en un
projectId aparte y afirma las dos mitades —con el `where` devuelve el subconjunto,
sin el `where` se rechaza entera—, con control positivo y **verificado invirtiendo
la aserción**. Queda independiente de cuál sea la regla viva en `/actividades`, que
es exactamente lo que hace falta para el día que B-01 necesite lectura en vivo.

### P0 · El repo público publicaba los uids y los mails de las dos cuentas admin — B-209

`docs/02-infraestructura.md` tenía una tabla titulada «Cuentas con claim `admin`»
con mail → uid de las dos cuentas, mapeados uno contra otro. El §5.1 y D-57 dicen
que uid y mail de admin no salen ni crudos ni hasheados.

Lo peor no era la tabla: **los mismos dos valores eran `CENTINELAS.uid` y
`CENTINELAS.mailAdmin` en `tests/fixtures/formulario.ts`** — el dato que no puede
salir, en el archivo cuyo trabajo es verificar que no sale, y los dos únicos
centinelas de esa lista que no cumplían lo que su propio docblock promete
(«inventados y bien reconocibles»). Estaban además en
`tests/opciones-aprobacion.test.ts`, `tests/reportes.test.ts` y
`docs/09-analitica.md`.

**Es irreversible y conviene decirlo:** para cuando se detecta, ya está scrapeado.
El arreglo corta el sangrado, no lo revierte.

Los valores salieron de los cinco archivos. Los centinelas pasaron a
`CENTINELAuid…` / `centinela-admin@ejemplo.com`, con el uid conservando los 28
caracteres para que la forma real se siga ejercitando. El número de cuenta de
facturación salió de la misma tabla por el mismo motivo. Y
`scripts/preparar-produccion.mjs --listar` reemplaza a la tabla: la lista se saca
de Auth cuando se la necesita en vez de vivir versionada.

Red nueva: **`tests/sin-datos-personales.test.ts`**, que recorre `git ls-files`
buscando la forma de un uid de Firebase y casillas en proveedores de correo
gratuitos. Es **angosto a propósito y lo dice en el archivo**: un mail en dominio
propio (`hola@casabrandon.org`) puede ser un fixture inventado o el real de una
sede, y no se puede distinguir sin versionar la lista de dominios reales, que es
justo el dato que no queremos versionar. Esa mitad queda en el
`auditor-privacidad`. Un chequeo angosto que nunca da falsos positivos vale más
que uno ancho que se apaga con excepciones — la tabla que lo hizo nacer sobrevivió
meses en un archivo que nadie sospechaba.

### Verificación en producción: había comandos para la escritura anónima y ninguno para la lectura

`07-seguridad.md` § «Las reglas rechazan lo anónimo en producción» tenía dos
`curl` de **escritura**. Ahora tiene los dos de lectura —el `getDoc` y la
`runQuery` con el `where`, que era la que pasaba— y una advertencia sobre cómo
leer el resultado: un `permission-denied` y un «no encontré nada» se parecen si
solo se mira que no haya datos.

Y se agregó el mapa de **las cinco salidas** al encabezado del documento, con la
sexta que estuvo abierta hasta hoy. Faltaba `textoRedes.ts` (B-95), que es la más
irreversible de todas: un posteo pegado en Instagram ya está copiado. La tabla
campo por campo **no se copió**: vive en el docblock del módulo y se apunta a ella,
porque dos copias de una tabla de privacidad es el problema que D-20 evita en otro
lado y la que envejece siempre es la del documento.

### Documentación: 15 puntos de drift, que eran cinco causas

- **El rebuild automático ya está desplegado y tres lugares decían que no**
  (D-13, `04-funcionalidades.md` ×2). B-20 cerró el 2026-08-25.
- **La UI de taxonomías ya existe y tres lugares decían que solo había script**
  (D-29, `03-modelo-de-datos.md`, `08-operacion.md`). B-06/B-25 cerraron el
  2026-08-24.
- **`B-167` se reusó para la galería y quedaron tres citas apuntando al ítem
  equivocado.** La peor: `15-mapa-de-trampas.md` mandaba la trampa 7 a B-167 en
  vez de B-172. Las otras van a B-177, B-132 y B-175.
- **Un bloque mal pegado en el BACKLOG:** el párrafo `**Hecho (D-104)**` es el
  cierre de **B-79** y estaba pegado al final de **B-175**, que está abierta. Se
  leía como cerrada. Volvió a su lugar, con nota en los dos.
- **`B-137` tenía un `it.fails` vivo hacía tres días y no existía en `docs/`.**
  Abierto como P2. Es la regla de proceso del `CLAUDE.md` que no se cumplió.

### El auditor de privacidad no conocía su propia quinta salida — B-216

Consecuencia directa de haber arreglado las cinco salidas en `07-seguridad.md`
**sin espejarlo** en la ficha del agente: seguía listando cuatro y su
`description` no incluía `src/lib/textoRedes.ts`, que es lo que decide si Claude lo
invoca por nombre de archivo. Ningún test podía fallar —el módulo está bien
cubierto—; lo roto era la cadena de invocación.

Lo encontró el `auditor-documentacion` auditando este cambio. Vale registrar el
patrón: **la inconsistencia la creó a medias el arreglo, y la encontró otro auditor
del mismo trío.** Queda escrita la regla de que una salida nueva se toca en tres
lugares, y el tercero —la `description`— es el que decide si el agente se entera.

Más: `13-agentes.md` sumó las cuatro filas que le faltaban a la tabla de «qué se
decidió no automatizar» (`barrido-de-salidas-publicas`, `clases-de-bug`,
`mapa-de-trampas` y el nuevo `sin-datos-personales`), y la fila de las reglas dice
ahora cuánto cubría de verdad. `auditor-privacidad.md` tenía una celda pidiendo
trabajo que `barrido-de-salidas-publicas.test.ts` (B-196) ya hace: pasó a decir
«no lo reportes». Y `README.md` decía 460 tests y 21 de integración: son ~1.340 y
51, contados en esta corrida.

**Un falso positivo, anotado porque el auditor se equivocó y conviene saberlo:**
el `auditor-privacidad` reportó que el `motivo` del `repository_dispatch` no tenía
ninguna red. Sí la tiene, y más fuerte que la que proponía —
`tests/costuras.test.ts` § «el motivo del rebuild es opaco» exige que ninguna
interpolación acceda a una propiedad, que es una propiedad y no una whitelist, y
tiene su control positivo. No se abrió ítem.

### `docs/10-salud-del-codigo.md`, remedido de cero

Estaba medido en `13b9baa`, cuarenta commits atrás. Los números se volvieron a
contar todos. El titular: **la forma aguantó un 36 % de crecimiento del código sin
moverse** — concentración del top-15 en 41,5 % (era 41,7), cero ciclos en 108
archivos, fan-in concentrado en hojas con fan-out 0, y el ratio de tests subió de
1,14 a 1,41.

Lo que empeoró es lo mismo de antes y más grande: **39 componentes y 7.045 LOC de
`.tsx` sin un solo test de componente** (eran 34 y 5.355), verificados leyendo el
fuente con expresiones regulares en 32 de los 59 archivos de test. Y ahora hay un
bug concreto que eso dejó pasar: B-210.

Se agregó una sección que el documento no tenía: **lo que ninguna de sus métricas
podía ver.** Los dos P0 de arriba pasaron por debajo de todas, con la suite en
verde. La salud de forma y la corrección son ejes independientes y este archivo
solo mide el primero.

### Backlog

Nuevos: **B-210** (la trampa de foco copiada, con una copia que se quedó sin el
arreglo — P1), **B-211** (el doble de `Timestamp` definido 13 veces en 4 formas,
dos de ellas mentirosas — P1), **B-212** (falta la proyección pública de
`/opciones/*`, y el barrido de B-196 no la ve — P1), **B-137** (P2), **B-213**
(los `.env` versionados sin gate — P2), **B-214** (Astro 5.x no tiene parche para
ocho avisos: hay que subir a 6/7 **antes** de B-01 — P2) y **B-215** (tres
duplicaciones chicas y la adopción de `tests/fixtures/` en 7 de 59 archivos — P2).

Cerrados: **B-208**, **B-209**, **B-172**, **B-216**.

### Segunda vuelta: lo que los auditores encontraron en el arreglo

Los tres corrieron **sobre este cambio**, no sobre el repo quieto, y de ahí salió
casi todo lo que sigue. Vale como calibración de para qué sirven.

**Las aserciones de rechazo eran más débiles de lo que parecían.** Los cuatro
`it` de lectura denegada usaban `rejects.toThrow()` pelado, que también lo satisface
un emulador caído: los tests de reglas podían pintar verde sin haber probado una
regla. Lo señaló el `auditor-privacidad`.

Su arreglo propuesto —apretar el mensaje a `/permission|insufficient/i`— **no
funciona**, y se comprobó: para una lectura denegada el emulador no devuelve
"Missing or insufficient permissions" (eso es de las escrituras) sino la traza de
evaluación (`false for 'get' @ L50`), o `Property estado is undefined on object`
cuando la regla no se puede evaluar. Los cuatro fallaban. Lo que sí sirve es el
**`code` de la `FirebaseError`**, que es `permission-denied` en todos esos casos y
`unavailable` si el emulador no está: eso separa "la regla denegó" de "no se pudo
preguntar". Es el helper `rechazadaPorPermisos`, y de paso corrigió el comentario
de `firestore.rules` que yo había escrito sobre este tema, que era impreciso.

**El control positivo cubría el `getDoc` y no el `getDocs`**, que es el camino por
donde iba la fuga: son dos permisos distintos (`get` y `list`). Si mañana alguien
rompe el `list` del admin, el rechazo anónimo seguiría en verde y el panel estaría
roto. Se agregó el positivo por query.

**El `--listar` que se agregó tenía un bug de parseo.** Buscaba el flag solo en
`argv[2]`, así que `node ... mail@x --listar` lo ignoraba en silencio, sembraba
`/opciones/*` **en producción** y terminaba en `createUser({email:'--listar'})`:
tiraba, pero después de haber escrito. Ahora se busca en todos los argumentos y
cualquier otro `-algo` aborta antes de tocar nada. Un flag mal puesto en un script
que escribe en producción tiene que fallar cerrado.

Y su garantía —«es solo consulta»— era del **orden de las líneas**, no del código:
mover el `if` treinta líneas abajo convertía la consulta en una escritura, y el
script aborta si detecta un emulador, así que sería siempre contra lo real. Es la
**clase de B-209**, con su `describe` en `clases-de-bug.test.ts`, de la misma forma
que la clase de B-71 (el efecto irreversible va último).

**Una afirmación falsa que escribí yo:** «es la única de las cinco salidas donde el
flag no alcanza», sobre `online.url` y el posteo. Falso — tampoco llega a la 3
(`actividadParaIssue` devuelve `{titulo, slug}`) ni a la 4 (va `url_publica` como
booleano). Como estaba escrito implicaba que en GA4 el flag sí alcanza, o sea lo
contrario de la regla más dura del proyecto. Corregido a «solo en las salidas 1 y
2», con el por qué de cada una de las otras tres.

**Y la cuenta de salidas quedó atada, para que no vuelva a divergir.** Es la clase
de B-88 aplicada a dos documentos: `docs/07-seguridad.md` y la ficha del agente
derivan la misma lista por separado. Ahora `tests/agentes-y-skills.test.ts` exige
que las dos tablas enumeren las mismas salidas, que cada archivo productor esté
nombrado en el `description` —el punto que decide si el agente se despierta— y que
exista. Verificado sacando `textoRedes.ts` del `description`: rompe.

**Rastros menores que quedaban.** La tabla de secretos de `07-seguridad.md` estaba
partida en tres por dos líneas en blanco, con dos filas duplicadas en redacciones
distintas y las últimas renderizando sin encabezado; unificada, más las dos filas
que faltaban (el id del calendario y la config del SDK web, que eran justo las dos
preguntas que alguien venía a buscar ahí). Un comentario de `08-operacion.md`
nombraba una cuenta de GitHub con sufijo de empleador: reemplazado por la
instrucción genérica. Y el mail de fixture `hola@casabrandon.org` —sede real,
casilla plausible— pasó a `.example` en los 14 lugares de `tests/`; las menciones
de `docs/` quedan porque son registro histórico.

**Lo que NO se hizo, con su motivo:** `--listar` sigue imprimiendo el uid además
del mail. El `auditor-privacidad` propuso reemplazarlo por una huella de 8 hex
porque el comando reconstruye en stdout el mapeo mail → uid que B-209 borró. Es un
punto justo, pero el uid es lo que hace falta para operar (`setCustomUserClaims`),
y el riesgo concreto —que alguien pegue esa salida en un archivo— ahora **rompe el
CI**: `sin-datos-personales.test.ts` lo detecta. La mitigación existe y es mejor
que empeorar el comando.

**Dos de los tres auditores encontraron algo en el arreglo del otro**, y conviene
que quede anotado como resultado del trío y no como anécdota: el de trampas
encontró que la trampa 7 se había dado por cerrada pasando por el motivo
equivocado, y el de documentación encontró la quinta salida sin espejar en la ficha
del agente. Los dos hallazgos son sobre el cambio, no sobre el código viejo. Un
auditor sirve más revisando un arreglo que revisando un repo quieto.

El falso positivo del `auditor-privacidad` (el `motivo` del rebuild) está anotado
más arriba, en la sección de documentación.

## 1.3.0 — 2026-08-27

**Once novedades del panel**, todas selladas `1.3.0` (D-117). Se escribieron en
borrador acá abajo a medida que salía cada cambio y se pasaron a `novedades.ts` en el
mismo commit que subió la versión: escribirlas antes obliga a adivinar el número, y
una entrada con la versión equivocada rompe lo único que esa lista sirve para
contestar — «esto empezó con la versión en la que salió tal cosa».

`1.3.0` y no `1.2.1` porque hay tres campos nuevos en el modelo (la galería, el libro
presentado y «se llenó»), dos secciones nuevas en el formulario y una función nueva en
el listado. Un parche no lo describe.

**El nombre del proyecto quedó decidido: «Agenda LEH — Leer, Escribir, Hacer»** (DEC-6
#3), que es lo que desbloquea el sitio público. Falta registrar el dominio.

### B-167 · La galería de imágenes: el modelo y el editor de URLs

**Primera de dos tajadas.** Esta cambia el modelo y el formulario; la que falta es
subir archivos propios, y está nombrada abajo con lo que le falta. Entra ahora y no
después del sitio público porque B-107 necesita exactamente una imagen para Open
Graph: si la galería llegaba después, había que rehacer la tarjeta, el detalle, la
proyección y el `events.json`.

`imagenUrl: string | null` pasa a `imagenes: Imagen[]`, con las cuatro decisiones
de DEC-7 tomadas por el dueño y el razonamiento en **D-125**. Lo que importa:

- **El epígrafe no es el texto alternativo.** Es opcional y se muestra debajo de la
  foto; el alternativo sale del **título de la actividad**. Decisión de
  accesibilidad tomada a propósito: un campo obligatorio por imagen en un panel de
  una persona produce «foto» como alternativo, que es peor que un título
  descriptivo. La contra asumida es que las cuatro imágenes comparten el mismo.
- **`portada` es un flag explícito**, no «la primera», y el schema valida
  exactamente una en los dos niveles de D-120: dos portadas hacen que B-107 emita
  una imagen distinta según el orden de lectura, que es la clase de bug que no
  falla, miente. Quitar la portada la reasigna a la que queda primera.
- **Los ids se generan en el cliente** (`img_<uuid>`), nunca por índice — trampa 2.
- **El default de lectura, para siempre**, y con **id determinístico**. Esto casi
  fue un bug: un uuid nuevo en cada lectura hace que `huboCambioDeContenido` vea un
  cambio cada vez que se abre el formulario, o sea el aviso de «cambios sin
  guardar» apareciendo solo y una versión nueva en el historial por cada apertura.
  El centinela `img_legacy` además dice que la fila viene de un documento anterior.
- **`storagePath` no sale al público** (§5.1): dibuja el bucket. Con test que lo
  nombra, verificado publicándolo a propósito.
- **Duplicar hereda las externas y no las propias**, hasta que exista el modal de
  B-199: compartir el `storagePath` haría que borrar una le rompa las imágenes a la
  otra, que es la clase de B-71 con estado compartido.

**Las tres guardas del repo se activaron solas, y es lo mejor que pasó acá.** El
vocabulario de la analítica derivado del schema (D-60) exigió las diez rutas
nuevas; el diccionario de nombres de B-184 exigió un nombre para cada una; y el
chequeo de `VERSION_BORRADOR` contra la forma del formulario —escrito ayer para la
clase de B-88— se puso rojo y obligó a subirla a **2**, que es exactamente su
razón de ser: un borrador con `imagenUrl` aplicado sobre un formulario con
`imagenes` **parece bueno**. Es la primera vez que esa red se ejerce de verdad.

Y el test del rebuild creció con el cambio, que este ítem pedía verificar y no
asumir: las imágenes no van a Google Calendar, así que no generan operaciones de
calendario y sin el arreglo de B-83 no llegarían nunca al sitio — exactamente lo
que pasaba con `destacado` e `imagenUrl`.

**Lo que falta para cerrar B-167**, con el motivo de por qué va aparte: subir
archivos propios necesita `storage.rules` (archivo nuevo), un target de deploy que
`que-deployar.sh` no conoce —y sin la regla nueva, un cambio de reglas de Storage
se deploya **nunca**, que es el peor de los dos defaults—, la Function que quita el
EXIF y deriva la miniatura (con la guarda anti-loop, porque escribir la miniatura
en el mismo bucket re-dispara la Function: es la trampa 3 con otra cara), y el SDK
de Storage en su propio módulo lazy. Cada uno es un lugar donde equivocarse en
silencio.

`novedades.ts` **no** se tocó a propósito: la novedad se escribe cuando la función
esté completa y tenga versión, no a mitad de camino. La ayuda sí, porque describe
lo que ya se puede hacer y lo que no se adivina mirando.

### B-204 · El generador de encuentros dice qué es cada campo

Reporte de un segundo admin cargando una feria: *"no entiendo porque hay 2
opciones, lo de cantidad y cantidad de días"*. Los campos decían **«Cantidad»** y
**«Cada (días)»**, y leídos uno al lado del otro parecen dos cantidades. La segunda
no es una cantidad de días: es el **salto** entre un encuentro y el siguiente.

No era cosmético. Con el default de 7, pedir 3 encuentros para una feria de tres
días seguidos genera **tres semanas**: fechas válidas, así que no falla nada, y eso
llega al calendario público. El error es silencioso.

Ahora dicen «Cuántos encuentros» y «Cada cuántos días», y el párrafo de abajo abre
con lo que faltaba: «**7 es una vez por semana**; para días seguidos —una feria de
tres jornadas— va 1». El default no se toca: semanal sigue siendo el caso común, y
lo que cambió es que ahora se entiende sin preguntar.

Queda fijado en `tests/etiquetas-de-ui.test.ts`, con las etiquetas viejas como
aserto negativo. Y ese test enseñó otra vez la lección de la semana: la primera
versión se puso **roja con el código correcto**, porque el comentario que explica el
cambio cita las etiquetas viejas y el aserto las encontraba en la prosa. Lee el
fuente sin comentarios, como los de `autoguardado.test.ts`.

El arreglo general sigue abierto y es **B-62**, enriquecido con este caso: un botón
de info por sección con qué hace, qué impacto tiene y un ejemplo. Este era el caso
particular, y se podía hacer solo.

### B-126 · La vista calendario avisa de las inscripciones que cierran

`inscripcion.cierra` no aparecía en ninguna pantalla, y es una fecha con la misma
urgencia que un encuentro: pasada, la actividad **sigue publicada invitando a
anotarse** con el mail o el WhatsApp a la vista. El listado ordena por próximo
encuentro, así que un cierre que vence mañana queda enterrado detrás de actividades
cuyo primer encuentro es en dos meses.

Ahora es **un marcador más en su día**, en otra familia de color y con borde punteado:
los verdes y ámbares de esa pantalla contestan *¿esto ya lo ve la gente?* y un cierre
contesta otra pregunta, así que no puede leerse como un estado de publicación más.

**Tipo aparte y no un `Encuentro` más.** Se parecen —día, hora, actividad— pero un
cierre no tiene `sesionId` ni `calendarEventId`, no sale al calendario público y no
participa del «2 de 8». Metido en `Encuentro[]` habría que acordarse de excluirlo en
cuatro lugares donde olvidarse no rompe nada visible y deja las cuentas mal.

**Tres filtros, y los tres son la diferencia entre un marcador y ruido:** solo
actividades `publicado` (la urgencia es «sigue invitando»), solo con
`inscripcion.requiere` —`formADocumento` guarda `cierra` sin preguntar por `requiere`,
así que una actividad que dejó de pedir inscripción arrastra la fecha vieja— y solo
con una fecha usable vía `instanteDeTimestamp`, la misma conversión de la trampa 1.

**Y `inscripcion.completo` (D-127) decide cuándo el aviso NO se enciende**, que es la
decisión más fina del cambio: un cierre vencido con cupo completo está exactamente
como debe estar. Contarlo como problema haría que el aviso se dispare en el caso más
común y **sano** de todos —el taller se llenó y por eso cerró— y un aviso que se
enciende siempre se apaga en la cabeza de quien lo mira, justo cuando aparece el que sí
importaba. Es la misma simetría de D-127: el cartel va al lado, no en lugar de.

`agendaDe` reemplaza a `agruparPorDia` en la vista porque **un día con un cierre y
ningún encuentro tiene que aparecer** — era el caso que más importa, la actividad de un
encuentro lejano cuya inscripción cierra la semana que viene. Y no hay umbral «cierra
pronto»: el calendario ya muestra la fecha, y el aviso se reserva para lo dañino.

### B-127 · Una suscripción por documento de `/opciones/*`, no una por hook

**El ítem hablaba de cinco listeners. Al medir son diez sobre cinco documentos:** la
primera pantalla monta el listado (`useLabelsTaxonomia`, cinco campos) **y** el
contador de la cabecera (`usePendientesDeAprobacion`, los mismos cinco). Con el
formulario abierto se repite.

Eso cambia el arreglo, y es el valor de haber medido antes de tocar. **Recortar el
listado a los dos campos que muestra no baja de cinco** mientras la cabecera esté ahí
—el contador mira los cinco por definición— y recortar apagaría el «en vivo» de los
campos recortados, que es la propiedad del §4.4 que no se puede perder. Así que se
comparte en vez de recortar: **10 → 5** en la primera pantalla, **hasta 20 → 5** con el
formulario abierto, cada oyente sigue recibiendo cada snapshot, y ningún llamador
cambió.

Tres detalles que no son adorno: se **repite el último snapshot** al que se suscribe
tarde —sin eso se queda en `OPCIONES_BASE` hasta un cambio que puede no llegar nunca,
mostrando el slug crudo de una etiqueta que la pantalla de al lado muestra bien—; el
refcount es un `Set` de cajas y **no un contador** (React llama las limpiezas de más en
desarrollo, y un contador cerraría el listener de alguien que sigue mirando) ni un
`Set` de funciones (dos hooks podrían pasar la misma referencia y contarían como uno);
y el observador entra por parámetro, así que se prueba sin emuladores.

**Queda abierto el paso de 5 → 1**, que pide escuchar la colección `opciones` completa
con un solo `onSnapshot`. El registro ya está listo para repartir desde un único
listener y no habría que tocar ningún componente. Se descartaron dos caminos y queda
escrito por qué: un parámetro `campos` para narrow (no baja de cinco, y un llamador
olvidado degrada **en silencio** a slugs crudos) y suscribir por lectura con un `Proxy`
(funciona hasta que alguien hace `{...labels}` y ahí vuelve a cinco sin que nada avise).

### B-128 · `mesesConEncuentros` ordena, ya no hereda el orden

Prometía «del más viejo al más nuevo» apoyándose en que quien la llama había ordenado:
cierto hoy, y no lo dice ninguna firma. Ahora ordena — las claves son `'AAAA-MM'`, así
que el orden lexicográfico **es** el cronológico.

**Y estaba la misma instancia en el lugar donde de verdad dolía**, que el ítem
describía sin ubicar: `problemasDePublicacion` armaba su lista de meses sin ordenar, y
`mesInicial` elige el primero prometiendo «el mes del primer problema por venir». Ahí
sí bastaba una lista de otra procedencia para que la vista **abriera en un mes
arbitrario**, sin que nada falle ni nadie se entere. `mesesConEncuentros` solo
alimentaba a una función que ya reordenaba defensivamente.

Los tests pasan la lista **al revés**, que es lo que devuelve cualquier camino que no
pase por la función que ordenaba: un `Map` recorrido por inserción, dos tramos
concatenados, un filtro que reordena.

### Colateral · B-136 · el fixture de duración cero, cerrado

El ratchet `DURACION_CERO_CONOCIDA` guardaba **un número de línea**
(`calendarioPanel.test.ts:44`), y los imports de B-126 lo corrieron a la 52: dejó un
test ajeno en rojo por drift, y tres frentes lo reportaron por separado. Se podía mover
el número —dos caracteres— pero eso deja el archivo con una mina: cualquier edición
arriba de esa línea vuelve a romper un test que no tiene nada que ver.

Se cerró el fondo: el default del helper son **dos horas de verdad** y la lista quedó
**vacía**, que es lo que el propio test pide («si alguien arregla una y no borra su
línea, la lista se convierte en amnistía»). Verifiqué que el detector sigue detectando
metiéndole un fixture flojo — y la primera verificación fue **inválida**, porque puse
`inicio` y `fin` en la misma línea y el detector los busca en líneas separadas. Otra
vez la misma lección: una rotura que no tiene la forma que el chequeo busca no prueba
nada.

### B-95 · El texto para publicar en redes

`difusion.arrobar` era **el único campo del §3.1 que se cargaba y no se usaba para
nada**: se guardaba y ahí moría, mientras cada actividad se volvía a escribir a mano
para publicarla. Ahora hay un texto listo para pegar, con botón de copiar, en dos
variantes: **anuncio** (el ciclo entero) y **recordatorio** (el próximo encuentro, con
su tema y su lectura). Una función pura y un componente: no toca el modelo, ni las
reglas, ni las Functions, ni el sitio.

- **El link a la página de la actividad no va.** Esa página no existe y el sitio está
  congelado (DEC-6), así que sería un link a la nada. Dónde iría está marcado en el
  código y es una línea.
- **El link de la reunión no sale nunca, ni con `urlPublica: true`.** El desvío de
  D-15 vale para el `events.json` y para el evento de Calendar; **un posteo se copia y
  no se despublica.** Fijado con un test que nombra la trampa 5 y con un barrido de
  centinelas que exige que ningún valor del formulario aparezca sin estar permitido por
  nombre — la única red que caza un campo nuevo que se cuele mañana.
- **Nada se reimplementó**, y esa es la mitad del trabajo: la regla de duplicados de
  handles es `agregarChips` (B-133), así que «@CasaBrandon» y «casabrandon» salen una
  sola vez conservando la forma con la que se escribió primero; la modalidad sale del
  mapa de `filtrosActividades` —ya son dos y el `it.fails` de `etiquetas-de-ui` los
  vigila, un tercero era el mismo bug otra vez—; el «Encuentro 3 de 8» es la numeración
  de D-95; y desde el formulario la conversión la hace `formADocumento`, así que el
  texto habla del documento que se va a guardar y no de la pantalla.
- Entran el libro (D-126) y «cupo completo» (D-127, **con el canal a la vista**, que es
  la simetría que ese ADR ya decidió). No entran las imágenes (D-125), el material, las
  indicaciones de la sede ni la descripción: la prosa es de quien publica, y
  automatizar el bloque de datos es lo que el ítem venía a ahorrar.
- **El cierre de inscripción no se imprime si ya pasó.** Es el único otro uso del
  reloj, y el motivo es que un posteo del 16 que dice «se inscribe hasta el 1» no es un
  dato viejo: es una **instrucción falsa**.

Dos hallazgos del propio agente que valen más que el ítem. Encontró que **dos guardas
suyas eran redundantes** —el `if` del bloque de handles vacío y el `filter(Boolean)`
al unir— porque al romper cada una por separado el test seguía verde y solo cayó
rompiendo las dos: lo dejó documentado en vez de quitar una. Y encontró que **el
detector de fixtures con duración cero no ve archivos sin trackear**: su helper tenía
la debilidad de B-135 (`fin = inicio`) y el chequeo no la veía porque recorre
`git ls-files`. Habría explotado en el primer commit.

La sección arranca **cerrada**, al revés que la vista previa de B-193, y no es
inconsistencia: esa se abrió porque alguien pidió por escrito una función que ya
existía y no encontraba, y ese reporte no existe acá. `recuerdaComo` hace que quien la
use la encuentre abierta la próxima vez.

### B-186 · Correr la fecha de un encuentro sin pelear con el almanaque

**El diagnóstico terminó afuera del repo: el almanaque es el selector nativo de
`<input type="datetime-local">` y nada nuestro corre mientras está abierto.** Los tres
candidatos del ítem caen leyendo el código, y el favorito —el arranque diferido de la
analítica— es inocente por **timing** y no por efecto: se agenda desde
`medirPanelAbierto()` al montar `AdminApp` y dispara **una sola vez y dentro de los
4 s**, así que no puede estar ahí minutos después con el picker abierto en la quinta
fila. El autoguardado de B-191 escribe en `localStorage` sin ningún `setState`, y el
chequeo de versión es cada 15 minutos con un `setPublicada` de la misma string, que
para React es un no-op. Lo cierra el navegador por sus reglas de descarte —blur,
scroll, cambio de viewport, un toque afuera— y el tiempo correlaciona porque cuantos
más meses hay que recorrer, más chances hay de que ocurra una.

**Entonces el arreglo no es un selector propio** —pesaría en el bundle (B-09) y
heredaría el mismo problema en otra forma— sino que **no haga falta abrirlo**:

- **Cuatro botones «Correr ±1 día / ±1 semana» por fila**, que es literalmente la
  operación que el reporte nombra («cuando *corrés* la fecha»). Mueven **inicio y fin
  juntos** y conservan `id`, `calendarEventId` y `cancelada`: mover una fecha no puede
  crear un segundo evento para el mismo encuentro (el diff del §7.2 cruza por `id`), y
  ±7 conserva el día de la semana, que es cómo se corren los ciclos de verdad.
- **El campo de inicio conserva la duración.** Antes, cambiar el inicio dejaba el fin
  donde estaba: dos campos que resolver, y en el medio el formulario quedaba con
  `fin <= inicio`, que es justo lo que el schema rechaza al guardar.
- **Un eco: «Cae jueves, 10 de septiembre, dura 2 h».** Es la mitad que hace que tipear
  no sea un castigo, porque **lo único que el almanaque daba y el tipeo no es ver en
  qué día de la semana cae**. Y de paso nombra el fin invertido, que hasta ahora
  aparecía recién al guardar.

Se mide con `encuentro-correr`, y no es adorno: toda la hipótesis del arreglo es que
esto reemplaza al almanaque, así que sin el evento el ítem quedaría cerrado por fe.

### B-193 · La vista previa del evento nace abierta, y se acuerda

No faltaba la función —existía desde B-12— faltaba **encontrarla**: última sección,
colapsada, y el reporte salió con `Pantalla: Otra` desde el listado, o sea de alguien
que no estaba en el formulario. `Seccion` recibe `recuerdaComo` y guarda en
`localStorage` si la dejaron abierta o cerrada; la vista previa arranca abierta.

**Las dos mitades hacen falta:** abrirla siempre castiga a quien ya la conoce y la
cerró a propósito. Y solo se recuerda el click, no el `pedidoDeApertura` de B-184: que
la barra abra una sección para mostrar un campo rechazado no es la preferencia de
nadie.

El argumento original del colapso —no abrir las cinco suscripciones a `/opciones/*`—
era menor de lo que parecía: cuatro de esos cinco documentos ya los suscriben los
desplegables de taxonomía de secciones abiertas, así que lo único que agrega es `tags`.
Falta la otra puerta que el ítem propone, la del menú «⋯» del listado, que es donde
estaba parada la persona que preguntó.

**Y dejó una frase de la guía en falso**, que corregí en el mismo cambio: «Las
secciones Material, Opcional, Difusión **y Vista previa del evento** arrancan
cerradas». Es exactamente la clase de B-63 —y justamente uno de los agujeros que B-63
declaró **sin cubrir**, porque es un punto de capítulo sin `atadoA`, no un aviso.

### B-199 · Duplicar pregunta qué copiar

«Duplicar» abre una capa con casillas antes de armar la copia. El default está
decidido y es **prendido lo que hoy se copia, apagado solo lo riesgoso**: nacen
apagadas la **difusión** —notas internas y handles de otra edición, que se arrastraban
sin que nadie los revise porque viven en un acordeón cerrado— y las **imágenes
propias**. El modal es para **desmarcar**: con todo apagado, «el mismo club, la
temporada que viene» costaría quince tildes y se dejaría de usar el botón.

**El default vive en `duplicar.ts` y no en la pantalla**, así que un llamador que no
pase nada obtiene el default seguro y no el «copiá todo» de antes. El slug, el estado,
los ids de sesión, `calendarEventId` y las cancelaciones **no son casillas**: no se
heredan y no son opcionales (trampas 2 y 10, §7.3). Se muestran como letra chica de
«siempre pasa esto», legibles **antes** de duplicar en vez de descubrirse en el
formulario.

Dos detalles que hacen que el modal no sea peaje: **solo se ofrecen las casillas que
la actividad tiene algo que copiar** —una fila para algo que no existe arruina el
vistazo—, y si no aplica ninguna **se duplica directo**. Y destildar cualquier casilla
deja una copia que el formulario acepta: la copia nace borrador, así que lo que falte
se reclama al publicar y no al abrir, que es el argumento con el que D-17 descartó las
fechas vacías.

La casilla de imágenes propias existe, arranca apagada y **no tiene código propio**:
hasta B-206 no hay forma de que exista una imagen propia, y la pregunta de si se copia
el objeto de Storage o se cuentan referencias (B-71) queda anotada en el tipo, sin
código especulativo. Un test verifica que tildarla y destildarla dan el mismo
resultado, y cita B-206.

**Y salieron dos cosas del foco que no estaban en el ítem.** `MenuAcciones` aprendió
`devuelveFoco`: la acción que abre una capa devuelve el foco al «⋯» **antes** de
disparar, porque el ítem del menú desaparece al elegirlo y el `activeElement` que la
capa memorizaría sería un nodo desmontado — el foco terminaba en el `body` al cerrar
(B-14). Y la capa engancha su efecto de teclado **una sola vez**, con `onCancelar` por
ref: con la función en las dependencias, un re-render del listado corría la limpieza,
devolvía el foco y lo re-capturaba, llevándoselo a la casilla que se estaba tildando.
**La misma fragilidad está latente en `CentroAyuda`** y quedó anotada.

La medición se movió al **confirmar**: antes se disparaba al hacer click en el ítem del
menú, o sea que contaba copias *pensadas* y no hechas. Y se agregó
`duplicar-desmarcar` con la cantidad de casillas destildadas, que contesta la pregunta
por la que el modal existe: **si nadie destilda nunca, el modal es un peaje** y hay que
volver al click directo.

### B-63 · Cada aviso de la guía nombra el test que lo sostiene

`tests/ayuda.test.ts` verificaba que el texto **esté**: un capítulo por sección del
formulario, los seis avisos irreversibles, sin jerga. Lo que ningún test podía ver es
que el texto siga siendo **cierto** — el día que cancelar un encuentro deje de sacarlo
del calendario, la guía sigue diciendo que lo saca y todo queda en verde. Y una ayuda
que miente es peor que no tener ayuda, porque la gente toma decisiones que no se
deshacen leyéndola.

De las dos salidas del ítem se tomó la segunda: cada aviso ata, en el campo nuevo
`atadoA`, los `it` de comportamiento que fijan lo que afirma. **27 vínculos**, y el
chequeo no es la cita: abre cada archivo y exige que el `it` exista **con ese nombre
exacto y escrito como llamada**, que entre en la corrida de `npm test` —los
`*.integracion.test.ts` quedan excluidos, porque se saltean solos sin emuladores— y
que no esté apagado ni invertido, **ni lo apague ninguno de sus `describe`**. Borrar,
renombrar o saltear el test que sostiene un aviso pone la guía en rojo nombrando qué
vínculo se cortó. El nombre del test no sale a la pantalla, y hay un chequeo de eso.

**El aserto lee el fuente con un walker y no con un `grep`**, porque las cuatro formas
de que un chequeo así crea haber encontrado algo ya pasaron todas en este repo esta
semana: el nombre suelto lo satisface el `import`; con los comentarios adentro lo
satisface la prosa; una comilla suelta dentro de un literal de regex desincroniza al
lector y le hace tragarse el `it` siguiente; y mirar el `it` sin su `describe` deja
pasar un `describe.skip`. Las cuatro verificadas rompiéndolas, con centinelas que
después se borraron.

**Y encontró una mentira, que valía más que el mecanismo.** El capítulo «Encuentros»
decía que «Generar N encuentros» *borra los temas y las lecturas*: era cierto hasta
**B-176**, que lo cambió el mismo día y le puso red al cartel de `SesionesEditor.tsx`
**pero no a la guía** — que decía la misma mentira, y en la misma dirección cara:
nadie aprieta el botón por miedo a perder algo que ya no se pierde. El capítulo de al
lado ya decía lo contrario, así que la guía se contradecía a sí misma.

El aviso de cancelar **no** mentía —`debeExistir` sigue borrando el evento del
encuentro cancelado, que es lo que su texto dice— pero era la única de las seis
cabeceras que no era cierta **leída sola**: «lo saca del calendario, pero no lo borra»
admite «el evento se queda marcado como cancelado», que es falso. Ahora dice
«**Cancelar un encuentro saca su evento del calendario y conserva el encuentro acá**».
Y cuando entre B-98 —aprobado hoy, sin implementar— el vínculo se corta solo y obliga
a reescribir el aviso en el mismo commit, que es lo que ese ítem pedía.

**El agujero se redujo, no se cerró, y se sabe cuánto queda.** Sin cubrir: que el `it`
atado afirme *lo del aviso* (que afirme algo lo sostiene el propio test; el resto es
review); las frases sin `it` —«si destildás la cancelación, el evento vuelve» no tiene
test de des-cancelar—; y los puntos de capítulo, donde `atadoA` es opcional.

### B-196 · Los tests de privacidad del `events.json` y del evento pasan de lista a propiedad

Las cuatro salidas públicas del §5.1 se verificaban de dos maneras, y dos estaban peor
cubiertas: el issue de GitHub y la analítica tenían **barrido por clase**, mientras el
`events.json` y el evento de Calendar tenían una **lista de campos conocidos** —
`zoom.us/j/secreto`, `coordinar con prensa`, `drive/privado`, `evt_secreto`,
`uid_abc`—. Eso cubre lo que se sabía el día que se escribieron, no la propiedad: **el
campo nuevo que nadie agregue a la lista se publica y nada se pone rojo**. Ya había
pasado dos veces esta semana en su variante barata: una celda de la tabla del paso 0
que no la fijaba nada porque el fixture no tenía el campo.

Ahora hay un fixture donde **cada string del documento es un centinela**, y la
afirmación es sobre la salida: sobreviven **exactamente** los permitidos. Se barren
tres salidas —el `events.json`, el evento en los **ocho** encuentros del ciclo, y el
`searchText`, que es pública por la puerta de atrás (quinta fila de D-126)— en cinco
casos, incluidos el documento anterior a B-167 y el desvío de `urlPublica: true`.

**El corazón del chequeo es la lista de lo que SÍ debe salir**, y por eso está
agrupada, nombrada y justificada una por una: nueve grupos para el JSON, ocho para el
evento, uno para el `searchText`. Una excepción sin motivo es una fuga aprobada por
cansancio, y un barrido con veinte de esas no verifica nada.

**La aserción va en las dos direcciones, y la segunda es la que faltaba:** que un
centinela permitido **no aparezca** también falla. Eso convierte cada fila de las
tablas de D-125, D-126 y D-127 en algo que se pone rojo — sacar el libro de la
proyección, o la línea del cupo del evento, se nota. Un barrido de una sola dirección
pasa con una salida vacía.

Tres redes para que el fixture no envejezca, que es lo que hace que un campo nuevo
entre solo: se compara contra **las interfaces de `src/types/actividad.ts`** y falla si
le falta un campo o si aparece una interfaz nueva sin anclar; todo string del fixture
tiene que ser un centinela o vocabulario cerrado, así un campo nuevo no puede entrar
con un valor inocente («Casa Brandon») y quedar fuera del barrido para siempre; y
ningún centinela puede ser substring de otro ni dejar de ser URL-safe — el evento pasa
la ubicación por `encodeURIComponent`, así que un centinela con espacios **esconderÍa**
una fuga por ese camino, y por eso la sede del fixture va sin coordenadas a propósito.

Verificado reintroduciendo la fuga en los dos lados, y lo verifiqué yo también por mi
cuenta: el barrido se pone rojo nombrando cuál centinela se escapó y a qué salida. La
demostración quedó **permanente** en tres meta-tests, para no depender de que alguien
repita el experimento.

`toPublic.test.ts` y `calendario.test.ts` conservan sus casos nombrados —ahí están las
**instancias**— con un comentario que avisa que al crecer el modelo no hay que
agregarle un `not.toContain` a esa lista: lo agarra el barrido.

**No apareció ninguna fuga.** Sí quedó a la vista que `sede`, `arancel`, `organizador`
y `tallerista` se proyectan **como objeto entero** (`toPublic.ts:151-157`), a
diferencia de `libro`, que está enumerado justamente para que «una clave que se agregue
mañana no salga sola». No hace falta cambiarlo: ahora, el día que pase, el barrido lo
dice — y esa es exactamente la diferencia entre una lista y una propiedad.

### B-97 · `inscripcion.completo`: poder decir que se llenó

Después de publicar no había forma de decir nada. Ahora hay un booleano
`inscripcion.completo` que se prende **desde el menú «⋯» del listado** —un toque desde
el teléfono, sin abrir 30+ campos— y de ahí sale la línea «Cupo completo» en la
descripción de los N eventos del ciclo: **quien ya estaba suscripto al calendario se
entera sin que nadie le avise**. El razonamiento completo, con la tabla de las cinco
salidas, está en **D-127**.

Las dos decisiones del dueño, que son las que un cambio razonable rompería:

- **Un booleano y no un contador de lugares.** Un contador queda viejo con cada
  inscripción y no solo con la última. Es además la salida que B-102 ya nombraba para
  resolver el conteo sin guardar un dato de ningún tercero.
- **El canal de inscripción no se esconde**: queda, con el cartel al lado. Siempre hay
  lista de espera y las bajas existen, así que esconder el canal convierte una baja en
  un lugar que se pierde. Sale con test en las dos salidas públicas.

Lo que importa del cómo:

- **Escribe solo `inscripcion.completo`, con ruta punteada.** Verificado contra el
  emulador: marcarlo no pisa el destino, el cupo ni el cierre. Un `updateDoc` con la
  clave sin puntear reemplaza el objeto entero, y desde el listado no hay formulario
  con el que reponer lo que se llevó.
- **Propaga a las N sesiones porque la línea se arma adentro de `construirDescripcion`**
  (trampa 9, D-07). El test exige ocho `actualizar` y **cero** `borrar`, y otro exige
  que la línea aparezca **una sola vez**: armarla también por fuera no rompe la
  propagación pero duplica la línea en el calendario público, y ningún test de
  propagación se da cuenta.
- **Default de lectura `false` y determinístico** (D-26, D-125): las actividades que ya
  están publicadas no cambian ni en pantalla ni en ninguna salida.
- **Tiene un solo dueño, y no es el formulario.** Esto salió de la auditoría y es la
  parte que más importa: `completo` tenía **dos escritores** adentro de un objeto de
  contenido —el perfil exacto de `calendarEventId` dentro de `sesiones`, la clase de
  B-80— por dos caminos distintos. Un formulario abierto desde antes de marcarlo
  apagaba el cartel en su próximo guardado; y un borrador local, que vive hasta 30
  días, hacía lo mismo o lo contrario. Ahora `inscripcion` se guarda **por subcampos
  punteados** con `completo` afuera, y el campo entró a la lista de D-124 — que con
  esto se quedó corta por **tercera** vez, y las tres con el mismo perfil: un campo
  que escribe otra pantalla y que manda a una salida pública.
- **No entra al `searchText`** (la quinta salida, la de D-126): nadie busca «completo»
  y ese campo viaja entero al `events.json` en cada visita. Con test que lo nombra.
- **No sale al issue de GitHub**; a GA4 va solo el booleano `cupo_completo`, la ruta
  `inscripcion.completo` y la función `actividad-cupo-completo`.
- **`VERSION_BORRADOR` no subió**: el campo es aditivo. La guarda de B-88 se puso roja y
  la respuesta correcta fue agregar la ruta, no el número.
- **La copia no lo hereda** (mismo criterio que `cancelada`).
- Y el cartel se ve en la fila del listado, más un aviso en «Arancel e inscripción»:
  lo que se publica tiene que poder verse y sacarse desde el panel.

Verificado rompiendo cada red: 24 roturas, las 24 caen (esconder el canal, sacar el
campo de la proyección, no escribirlo en el guardado, heredarlo al duplicar, armar la
línea afuera, armarla **dos veces**, filtrarlo al `searchText`, proyectar el reporte con
spread, dejar el menú de una sola dirección…). Y las dos del dueño único, que al
principio **no** caían: la lista de D-124 vive en un solo lugar, pero cada entrada
necesita su propio clavo. **1122 tests**, con emuladores.

### DEC-1 · El libro presentado: campo propio, con la obra y su autor

El §11 lo listaba para presentaciones y charlas desde el principio y el §3.1 no lo
tenía: hasta hoy se cargaba el autor en `tallerista` y el título de la obra quedaba
enterrado en la descripción, donde nada lo puede leer. Ahora es
`libro: { titulo, autor } | null`, con el autor cargado **solo si difiere del
invitado** — en una presentación normal el autor es quien viene, y repetirlo abajo en
«Invitado» sería decir dos veces la misma cosa. **D-126** tiene el razonamiento.

Las cuatro salidas del paso 0, decididas antes de escribir código: **sale** al
`events.json` y a la descripción del evento; **no sale** al issue de GitHub ni a GA4,
que solo lleva el booleano `tiene_libro`. Y **una quinta que el skill no lista y
debería**: entra al `searchText`, que viaja entero al `events.json`, y es lo que hace
que buscar «Pedro Páramo» encuentre la presentación. Eso era la mitad del pedido.

Dos cosas que el cambio dejó mejor de lo que estaban:

- **`VERSION_BORRADOR` no subió, y eso es la guarda funcionando bien.** Se puso roja
  —la forma del formulario cambió— y la respuesta correcta fue agregar las rutas sin
  subir el número: `libro` es aditivo, así que un borrador anterior sigue sirviendo.
  Subirla tiraría a la basura todo borrador en curso a cambio de nada. La guarda
  existe para hacer pensar, no para subir el número; con B-167 el bump **sí**
  correspondía porque ahí el borrador viejo *parecía* bueno.
- **El bloque se muestra en cualquier actividad que ya lo tenga cargado**, no solo en
  los dos tipos que lo piden. Lo encontró el auditor: las cascadas agregan y no
  sacan, `duplicar` hereda, y las dos salidas públicas no miran el `tipo` — así que
  una presentación pasada a taller seguía publicando «Libro: …» **sin pantalla desde
  donde verlo ni borrarlo**. Esconderlo en la salida habría sido peor: el documento
  lo seguiría teniendo.

### B-207 · `searchText` tenía dos listas de fuentes, y restaurar del historial publicaba la vieja

El P1 que salió de DEC-1. `historial.ts` tenía **su propia copia** de «de qué campos
sale el `searchText`» con cinco entradas, mientras `buildSearchText` consumía seis:
restaurar un libro viejo desde la pantalla de versiones escribía el campo y dejaba el
`searchText` con el título descartado — y ese `searchText` sale al `events.json`. El
documento diciendo una cosa y el índice público otra, y esa rama no tenía **ningún**
test.

**No se arregló agregando `'libro'` a la lista.** Eso deja el par vivo, y el par es el
bug: es la clase de B-88 y la de B-72 a la vez. Ahora hay **una sola lista**, al lado
de la función que la usa, y el historial la importa.

La red va en las dos direcciones y ninguna compara literales: uno mete un centinela
en cada campo de la lista y exige que llegue al `searchText` —si la lista nombra un
campo que la función ignora, restaurarlo recalcula al vacío—, y el otro lee la
función, extrae los campos que consume y exige que estén en la lista. Verificadas las
dos, cada una con el mensaje que nombra qué drifteó.

### B-203 · Cualquier fin de sesión se lleva los borradores, no solo el botón

`cerrarSesion()` cubría los dos botones «Salir», que son los dos únicos call sites
de `logout()`. `observarAuth` es `onAuthStateChanged` y avisa **sin ningún click**
—token revocado, cuenta deshabilitada, logout en otra pestaña—: ahí el panel volvía
al login y los borradores quedaban en el navegador, en claro y hasta 30 días, con
campos que el §5.1 marca como internos.

**El cuidado que tiene, y por lo que fue su propio ítem:** borrar en cualquier
`null` del observador se llevaría trabajo bueno en el `null` **transitorio**, el que
aparece mientras se restaura la sesión al abrir el panel. Perder lo que alguien está
escribiendo es peor que la exposición residual — es exactamente lo que B-191 vino a
evitar. Así que la condición es la **transición** y no el valor: se compara el uid
anterior con el actual. `null → uid` es el arranque y no borra; `uid → mismo uid` es
refresco de token y tampoco; `uid → null` y **`uid → otro uid`** sí — ese último es
el que el predicado ingenuo se comía, porque `onAuthStateChanged` no garantiza pasar
por `null` al cambiar de cuenta.

La regla devuelve si borró, y eso es lo que deja fijar el caso **y el borde** con
tests de comportamiento, sin montar el panel. Verificado con tres roturas.

Y de paso el §7 de `07-seguridad.md` dice dos cosas que antes no: si la sesión se
corta con la pestaña cerrada no hay observador que lo vea, y el borrado es por
prefijo — o sea de los borradores **de este navegador**, no «de los míos». Las dos
son contras asumidas, y ninguna estaba escrita.

### B-192 / DEC-9 · «Librería a la calle» es un tipo de fábrica

Dos reportes del panel del mismo día pedían lo mismo con tres nombres distintos
—«Venta especial», «Librería ABIERTA», «Librería a la calle»— y esa duda era la
señal de que el nombre era el trabajo. Se eligió **un solo slug**,
`libreria-a-la-calle`, porque un valor nuevo **no es reversible**: parte los datos
en dos que después nadie puede volver a juntar, que es la lección de B-134. El label
sí se puede cambiar.

Va con `fijo: true` y la cascada de «Feria», por el mismo motivo y con el mismo
ejemplo: salir a la vereda un sábado es un día, y una semana de la librería son
varias jornadas. No prende material ni tallerista.

**Y de paso la cascada dejó de ser una cadena de `||`.** Ya eran tres tipos, y una
cadena que crece es cómo un tipo nuevo termina con la mitad de la regla. Ahora es
`CICLOS_POR_TIPO`, con dos tests en **las dos direcciones**: que todo tipo del
registro prenda «es un ciclo», y que todo tipo del registro exista en
`opciones-base.json` con `fijo: true`. La segunda es la que faltaría si alguien
agrega un slug al registro y se olvida del JSON — la cascada quedaría nombrando un
tipo que no se puede elegir. Verificado rompiendo las dos por separado.

### B-176 · Regenerar las fechas ya no borra los temas ni las lecturas

`generarSesiones` devolvía `tema: ''` y `lectura: ''` en todas las filas, así que
correr un ciclo una semana borraba las ocho lecturas asignadas — lo más caro de
tipear de toda la actividad. Venía de cuando el generador reemplazaba la lista
entera; desde D-103 la fila conserva su identidad, así que perder su contenido dejó
de tener sentido. Ahora recalcula **solo las fechas**.

Salió con la UI, como el ítem pedía: el cartel decía «borra los temas y lecturas ya
cargados», y con el código conservándolos ese cartel pasaba a mentir en la dirección
más cara —nadie aprieta el botón por miedo a perder algo que ya no se pierde—.

**`cancelada` cambió de lado, y el ítem no lo nombraba.** Antes se pisaba a `false`
y había un test que lo afirmaba **sin decir por qué**. El razonamiento escrito que
justificaba limpiarla —«una cancelación es una excepción del ciclo viejo»— resultó
ser de `duplicarSesionParaCopia`, y ahí vale: la copia es una actividad nueva, sin
nada en el calendario de nadie. Regenerar pasa sobre una actividad que puede estar
**publicada**, así que destildarla recrea el evento en la agenda de todo el que esté
suscripto. Es la asimetría de D-124 otra vez, y las dos funciones son distintas: el
generador solo lo usa el editor.

Dos redes, las dos verificadas rompiéndolas: el comportamiento, y **el texto del
cartel** —que es la clase de B-63 aplicada al único cartel que describe una
operación destructiva—. Sin la segunda, el código y la pantalla podían separarse en
silencio: lo comprobé volviendo el texto viejo y todo seguía verde.

### Los auditores sobre esta tajada: un P0, y la celda que no tenía test

**P0 · restaurar «Imágenes» desde una versión anterior a B-167 escribía
`imagenes: null` en el documento en vivo.** Lo encontró el `auditor-trampas`, y es
**más general que la galería**: `camposCambiados` une las claves de los dos
documentos, así que **cualquier** campo agregado al modelo después de una versión
guardada aparecía como restaurable, y el `??` de `valorARestaurar` lo convertía en
`null`. `restaurarCampo` escribe con un `updateDoc` directo, o sea que **no pasa
por el schema** y nada lo frena.

La cadena completa, sin un solo error visible: el documento queda con
`imagenes: null` → `imagenesDe` lo ve falsy → cae al `imagenUrl` viejo → **la
galería entera se reemplaza por la imagen de antes de la migración** → y la
escritura marca rebuild, así que eso llega al sitio público **solo**. `imagenes` es
la instancia nueva; el mismo camino existía para todos los campos anteriores.

El arreglo es un filtro de una línea —un campo que no existía en esa versión no es
restaurable— y trajo de paso `tests/historial-restaurar.test.ts`: las tres
funciones de ese camino **no tenían ningún test**, y es el camino que escribe en
producción sin pasar por el schema.

**P1 · la celda «al calendario no va nada» no la fijaba ningún test.** El fixture
de `calendario.test.ts` no tenía imágenes, así que agregar `Foto: ${…}` a la
descripción del evento no habría roto nada. Ahora van con centinelas y el mensaje
del test dice **cuál** se escapó. Verificado inyectando la fuga — y la primera
verificación fue inválida (inyecté en una variable que no existe, así que la línea
nunca corría): un chequeo que no se puede ver fallar no está verificado.

Cinco más, todos del auditor de privacidad y todos arreglados: `esUrl` aceptaba
`data:` y `javascript:` —y esa URL va a `og:image`— así que al publicar ahora se
exige `https://`; la vista previa del panel le mandaba el `Referer` al host de la
imagen; la tabla de «qué nunca sale» no tenía la fila de `storagePath` y la de GA4
seguía nombrando `imagenUrl`; el comentario de `imagenes.ts` afirmaba una defensa
que no existe («se valida en las reglas» — `storage.rules` todavía no existe); y el
par nuevo de la clase B-88 quedó atado: cambiar `ID_IMAGEN_MIGRADA` dejaba
**inguardable toda actividad anterior a la galería** y ningún test lo miraba.

Dos quedaron como **B-206**, que bloquea la segunda tajada y no esta: la URL
pública de una imagen propia **contiene** el `storagePath` más un token permanente
—así que ocultar el campo no logra lo que el comentario dice—, y
`storagePath`/`ancho`/`alto` van a tener dos escritores, que es `calendarEventId`
dentro de `sesiones` otra vez.

Doc: `03-modelo-de-datos.md` (sección nueva), `04-funcionalidades.md`,
`06-decisiones.md` (**D-125**), `src/lib/ayuda.ts`.
`tests/imagenes.test.ts`, `tests/historial-restaurar.test.ts` y los que crecieron. **1024 tests.**

## 1.2.0 — 2026-08-26

Los tres ítems P1 del formulario que eran **una sola historia contada en tres
pedazos**: no podías guardar (B-183), no sabías por qué (B-184), y si te ibas lo
perdías (B-191). Se hicieron en ese orden a propósito: B-183 es el más barato,
cierra el agujero de raíz y baja mucho la urgencia del autoguardado.

`1.2.0` y no `1.1.1` porque cambia lo que el panel acepta y agrega
comportamiento nuevo; un parche no lo describe. Sale con el próximo push a
`main`, que desde B-20 publica solo.

### B-183 · «Guardar borrador» pide el título, y nada más

Reporte del dueño usando el panel: *"No me deja GUARDAR BORRADOR si no completo
todo"*. El schema validaba lo mismo para un borrador que para algo publicado, así
que el estado que existe para lo incompleto exigía el formulario completo. Con el
aviso de B-35 al salir con cambios sin guardar, la única salida honesta era
completar campos inventados o perder lo cargado.

Ahora son **dos niveles sobre el mismo schema** —no dos schemas— con la
condición `estado === 'publicado'`, que es exactamente lo que sale al sitio y a
Calendar. El patrón ya estaba en el archivo aplicado a una regla sola: el slug
`…-copia`, que solo se bloquea al publicar. Los `superRefine` no cambiaron de
contenido, cambiaron de condición. **D-120** tiene el porqué de la línea y de
por qué no son dos schemas.

Lo que sigue bloqueando en los dos niveles es lo que haría ilegible el
documento, no lo que lo haría incompleto: el `id` de cada sesión (trampa 2), que
las fechas se puedan convertir a `Timestamp` (trampa 1), el formato del slug y
el rango de las coordenadas.

### B-184 · La barra dice qué falta, y lleva hasta el campo

Reporte del dueño: *"cuando no se pueda guardar y diga que faltan campos,
siempre especificarlos"*. Decía «3 campos para revisar». Era una decisión escrita
—listar rutas de campo tapaba media pantalla en mobile— a la que le faltaba un
dato: **cuatro de las nueve secciones arrancan colapsadas**, así que el campo
rechazado podía no estar en ninguna parte de la pantalla. El contador decía tres
y se veían cero.

Ahora nombra los campos si son pocos («Falta completar: Título, Arancel») y las
secciones con su cuenta si son muchos («Dónde (2), Arancel e inscripción (1)»),
que además es más corto que tres rutas de campo. Cada nombre es un botón: abre la
sección si estaba cerrada y scrollea hasta el primer campo rechazado, que se
encuentra por orden de documento (`data-campo-con-error` + `querySelector`) sin
que nadie mantenga un orden a mano. **D-121**.

Y como ahora el borrador valida con menos, la misma barra muestra **en gris** lo
que va a faltar para publicar. Es la contra de D-120, cubierta: aviso, no
bloqueo, para que el muro no aparezca recién al final.

El diccionario de nombres y secciones es data (`lib/formulario/camposFaltantes.ts`)
y está atado al schema por una cadena de tres eslabones: zod deriva el
vocabulario de rutas (`tests/analytics-campos.test.ts`) y ese vocabulario exige
un nombre para cada ruta (`tests/campos-faltantes.test.ts`). Un campo nuevo sin
nombre falla en el test, no en producción con un mensaje que dice «1 campo» y no
dice cuál. Los títulos y los ids de sección se leen de los `.tsx`: si alguien
renombra una sección, el mensaje mandaría a una que no existe.

### B-191 · El formulario se guarda solo en el navegador

Del issue #6, desde el panel: *"Se podrá guardar algo como borrador o auto
guardado, como en word? Porque reporté algo y todo lo que escribí se borró"*. El
accidente concreto ya estaba cerrado —B-35, publicado en `1.1.0`— pero un aviso
evita el accidente y no recupera el trabajo.

Se persiste en `localStorage`, con clave por actividad, y al abrir se **ofrece**
lo recuperado con su fecha y un botón para descartarlo: recuperar en silencio es
peor que no recuperar, porque la duda que deja es "¿esto lo guardé o no?". No
toca Firestore, así que no hay reglas nuevas, ni modelo, ni una escritura por
tecla que cueste plata. Se limpia al guardar bien, se descarta lo ilegible, lo de
otra versión del formato y lo de más de 30 días, y nunca tira: `localStorage`
lanza excepción en modo privado y con la cuota llena, y un formulario no puede
romperse porque no se pudo autoguardar. **D-122**.

**La guarda que no era obvia.** `calendarEventId` es el único campo del
formulario que escribe el backend, y el autoguardado institucionaliza los
formularios viejos: hasta 30 días. Un borrador anterior al write-back lo tiene en
`null`, y aplicarlo tal cual lo persistiría; el sync de ese guardado todavía usa
el id del snapshot anterior, así que **no se nota**, y la edición siguiente crea
un segundo evento para el mismo encuentro. Es B-80 con un día de demora. Lo
recuperado pasa por `conIdsDeCalendarioDe`, que cruza por id de sesión y devuelve
los ids del documento de hoy. Anotado en `15-mapa-de-trampas.md`.

Lo guardado es **contenido**, a diferencia de todo lo demás que el panel
persiste en el navegador. `tests/autoguardado.test.ts` lee el código del módulo y
del hook —con los comentarios afuera, porque justamente hablan de la analítica
para explicar que no la tocan— y falla si aparece un `import` de `analytics`, un
`medir(` o cualquier cosa de Firestore. Queda escrito en `07-seguridad.md`, con
lo único que hay que tener presente: es contenido en un dispositivo, y en una
computadora compartida queda ahí hasta que se descarte, se guarde o venza.

### B-189 · la guarda de credenciales del build, cableada

`hayCredenciales()` estaba escrita en `firebase-admin.ts` y **no la llamaba
nadie**: era la guarda del consumidor que todavía no existe. Ahora la llama
`adminApp()`, que es la única puerta a Firestore en build time.

Va en la puerta y no en el paso de build de los dos workflows —la otra opción que
el ítem proponía— porque cubre más: `1.1.0` se desplegó a mano
(`npm run build && firebase deploy`), que es el camino que ningún `if` de un YAML
mira. Y en la puerta no se puede no llamar: `firebase-admin` no se importa desde
ningún otro lado (§5.4), y eso ahora lo fija un test que recorre `src/`.

La regla del §3.2 de `12-sitio-publico.md` —falla en CI, en local sigue con lista
vacía y un aviso— **no cambió**: sigue siendo del lector de Firestore, porque
"seguir con lista vacía" es un valor de retorno y la puerta no puede devolver eso.
Lo que se agrega es la red de atrás, para el consumidor que se olvide del chequeo.
Ese documento ahora dice qué mitad implementa cada uno. **D-123**.

`tests/build-credenciales.test.ts` (10 tests) fija las dos cosas —que la puerta
tire y que sea única— y se verificó reintroduciendo el bug: sacando la llamada y
dejando la función exportada, tres tests se ponen rojos.

### De paso, dos cosas que estaban escritas dos veces

- **El colapso de índices de una ruta** (`sesiones.3.fin` → `sesiones.N.fin`) lo
  necesitaban la analítica y el diccionario de nombres nuevo. Salió a
  `lib/rutaCampo.ts`: es la clase de regla de una línea que en este repo ya se
  escribió dos veces con dos comportamientos distintos (B-72, B-75).
- **`Intl` con la zona del proyecto** para mostrar fecha y hora cortas estaba
  embebido en `historial.ts` y lo necesitaba el aviso del autoguardado. Salió a
  `lib/sesiones.ts` como `fechaHoraCorta`, que es el hogar de las conversiones de
  fecha por el mismo argumento que `instanteDeTimestamp`.

### Lo que encontraron los auditores antes del push, y entró en la misma versión

Los tres auditores del cierre —privacidad, trampas y documentación— encontraron
**cinco bugs de B-191**, o sea de la función que se estaba por publicar. Los cinco
se arreglaron acá y no fueron al backlog: son de este cambio. **D-124** tiene el
razonamiento completo.

El P1 es el que importa. `conIdsDeCalendarioDe` reconciliaba `calendarEventId` con
un argumento correcto —el borrador vive hasta 30 días, así que un valor viejo se
aplica sobre el documento de hoy— y el error no era el argumento sino **creer que
ese campo era el único**. Los otros dos son los flags de publicación:
`online.urlPublica` y `material.items[].publico`, que deciden si el link de la
reunión y las URLs del material salen a `events.json` y a la descripción del
evento. Se destilda la casilla, no se guarda, se recupera a los veinte días, se
publica, y el link sale: la trampa 5 por una puerta nueva. Ahora vuelven a `false`,
que es el default que `toPublic` ya declaraba, y el aviso lo dice cuando había
alguna tildada — hace falta porque `Seccion` lee `abiertaPorDefecto` **solo al
montar**, así que un flag que llega con el borrador quedaba en una sección cerrada,
o sea en ninguna parte de la pantalla. Es el mismo agujero que documenta B-184 para
los errores.

Los otros cuatro: la clave del borrador no llevaba el uid (con dos admins en la
misma máquina, a B se le ofrecía el de A) y no se borraba al cerrar sesión; la
clave de «nueva» era la misma que la de «duplicar», así que un borrador
interrumpido se ofrecía dentro de un duplicado y publicaba una actividad distinta
de la que se quiso duplicar —el discriminador ya estaba una línea más abajo, en la
medición—; y la guarda de forma validaba 2 campos de ~30 mientras `toPublic`
proyecta `sede`, `organizador` y `tallerista` **enteros**, así que lo recuperado
ahora entra podado contra el molde del formulario.

**Y un quinto que apareció al verificar los otros cuatro, que es el más
transferible:** el test que fijaba la guarda de B-80 **no la fijaba**. Decía
`toContain('conIdsDeCalendarioDe')`, y esa cadena la satisface el `import`: se
borró la llamada y los 39 tests siguieron verdes. Vale para cualquier test que lea
un fuente buscando un nombre, y quedó anotado en `13-agentes.md`. Los dos tests de
saneadores afirman ahora la composición con los espacios colapsados —así el
formateador no los rompe— y se verificó que caen.

Aparece un módulo nuevo, `lib/formulario/borradoresDelNavegador.ts`, y la razón es
el corte del bundle: el borrado lo necesita `AdminApp`, que está en el chunk
inicial del panel, y `autoguardado.ts` importa el molde del formulario y con él
`lib/opciones`. Importarlo desde ahí habría deshecho el corte de B-09/D-51, que ya
se rompió tres veces sin que nada fallara. El módulo nuevo no importa nada.

**Se verificó reintroduciendo cada bug**, uno por uno: sin `sinFlagsDePublicacion`
caen dos tests, con la clave compartida cae uno, sin la poda caen dos.

### Y la segunda vuelta, que encontró cuatro más — dos de ellos míos

Con los cinco arreglados se volvió a pasar el auditor de privacidad sobre los
arreglos, porque el criterio del repo dice que en un P1 el falso negativo cuesta
más que el falso positivo. Encontró cuatro cosas, y **dos las había introducido el
arreglo anterior**:

- **P1 · la lista se quedó corta otra vez.** `estado`, el `slug` bloqueado y
  `sesiones[].cancelada` se seguían aplicando crudos desde un borrador de hasta 30
  días. El precedente estaba en el repo: `duplicar.ts` —el otro lugar donde se
  aplica un formulario viejo— ya lo había contestado con `estado: 'borrador'` y el
  comentario «duplicar no publica». Un borrador que decía `publicado`
  **re-publicaba** una actividad retirada a propósito, con la Function recreándole
  los N eventos; el `slug` cambiaba la URL de algo indexado (trampa 10); y un
  `cancelada: false` viejo le revivía el encuentro a todo el que estuviera
  suscripto. Los tres salen del documento de hoy, y ahora **la lista de los seis
  campos vive en un solo lugar** — se quedó corta dos veces porque estaba
  repartida.
- **P1 · el molde de la poda borraba `tallerista.bio`.** Escrito a mano, con la
  forma de `organizador` —que tiene `web` y no `bio`, porque son dos tipos
  distintos—. O sea que la poda escrita para no *publicar* una clave de más
  **perdía** el texto más largo sobre una persona, en la función que existe para no
  perder texto. Ahora sale de las mismas fábricas que las cascadas, y para eso
  `personaVacia()` se mudó a `estadoInicial.ts`, al lado de `sedeVacia()` y
  `onlineVacio()`.
- **P1 · el test que escribí para el borrado al cerrar sesión tenía el mismo
  agujero que acababa de encontrar:** `toContain('borrarTodosLosBorradores')`, que
  lo satisface el import. La clase apareció dos veces en el mismo cierre, la
  segunda en el test escrito para arreglarla — que es la señal de que la forma del
  aserto es más fácil de equivocar que el código que verifica. Por eso quedó en
  `13-agentes.md` como regla y no solo arreglada acá.
- Y dos de forma: el molde **da la forma, no los defaults** (usarlo de default
  metería un `{lat: 0, lng: 0}` —el golfo de Guinea— en una sede sin bloque), y
  **podar no puede dejar el formulario incompleto**, porque un borrador sin
  `material` pasa la guarda y el primer `f.material.items.some(...)` se lleva
  puesta la isla del panel.

Los cuatro nuevos también se verificaron reintroduciéndolos, y los cuatro caen. La
suite quedó en **986 tests**.

Quedaron abiertos dos que **no** se arreglaron acá, con el motivo escrito:
**B-203** (una sesión que termina sin un click —token revocado, logout en otra
pestaña— deja los borradores: el arreglo tiene que distinguir la transición a
`null` de un `null` transitorio, o se lleva trabajo bueno) y **B-202** (dos asertos
de `foco.test.ts` con la misma forma floja).

Quedaron abiertos tres ítems que **no** son de este cambio: **B-199** (el modal
para elegir qué se duplica, que el dueño pidió y que es más grande que esto),
**B-200** (la guarda de forma no valida que las fechas sean parseables —
preexistente, y falla visible, no dato corrupto) y **B-201** (el conteo de líneas
de `10-salud-del-codigo.md` §1.3, que hay que recontar con el criterio escrito al
lado en vez de inventarle un número).

### Y una tercera pasada, porque las dos primeras habían inyectado bugs

Con la tasa medida —cuatro hallazgos en la segunda ronda, dos de ellos
introducidos por los arreglos de la primera— una pasada más era barata al lado de
publicar un link privado. Encontró siete cosas. La severidad bajó, pero no a cero:

- **P1 · «Descartar» no descartaba.** El botón del aviso escondía el aviso y
  dejaba el borrador en el navegador, así que reabrir la actividad lo volvía a
  ofrecer — y `07-seguridad.md` afirmaba «queda ahí hasta que se descarta», que es
  justo la mitigación en la que se apoyaba B-203. Ahora borra la clave.
- **Completar la forma era de primer nivel**, así que un borrador con
  `material: {tiene: true}` y sin `items` conservaba la clave incompleta y el
  primer `f.material.items.some(...)` tiraba en el render, que es exactamente la
  falla que el arreglo anterior decía prevenir. Ahora la mezcla es profunda.
- **Y fabricaba `sede.ciudad: 'CABA'`**: una `sede` ausente se completaba con la
  fábrica, y `toPublic` proyecta `sede` entera. Era el mismo argumento del golfo de
  Guinea una capa más arriba, a mitad de camino. Los dos bloques que las cascadas
  crean y destruyen —`sede` y `tallerista`— se completan a `null`.
- **`sede.geo` era la última forma escrita a mano**, la misma configuración que
  borró `tallerista.bio`; y el test de rutas de B-88 **no podía verla**, porque con
  el `null` de `formVacio()` entraba como hoja. Salió `geoVacia()` a las fábricas y
  el test ahora enumera `sede.geo.lat` y `sede.geo.lng`.
- **Tres asertos más que no asertaban.** El par nuevo pasaba con una llamada
  muerta en cualquier parte del archivo, y uno dependía de la coma final del
  formateador. Pero el peor era estructural: los helpers leían el fuente **con los
  comentarios adentro**, y el bloque que está justo arriba de la llamada enumera
  los saneadores en prosa — o sea que un comentario podía satisfacer el aserto.
  Ahora pasan por un quita-comentarios, que ya existía 200 líneas más abajo en el
  mismo archivo.

Y el séptimo, que se decidió **no** arreglar y queda escrito en D-124: la
membresía de filas de `sesiones`. Un encuentro que hoy existe y no está en el
borrador desaparece al recuperar. Es la simétrica de `cancelada` y no se protege
porque la sección Encuentros **no está colapsada**, que era todo el argumento del
caso de material: la fila que falta se ve antes de guardar. De paso quedaron
nombrados `destacado` e `inscripcion.cierra` —de este último sale
`inscripcion.abierta`, así que un `cierra` vacío viejo **reabre** una inscripción
cerrada—, los dos reversibles con un click y afuera a propósito.

Los cinco arreglos se verificaron reintroduciéndolos. **58 tests** en
`autoguardado.test.ts`, 990 en total.

### Doc

`04-funcionalidades.md` (el punto que decía que el borrador valida igual que
publicar quedó al revés, «seis módulos de dominio puros» que ya son diez, y lo que
pasa al recuperar un borrador), `06-decisiones.md` (D-120 a D-124, con la nota que
D-124 le agrega a D-122 sobre lo que su guarda no vio), `07-seguridad.md` (sección
nueva, con la promesa de que el borrador no sobrevive a la sesión ahora cumplida por
código), `15-mapa-de-trampas.md` (la trampa 5 tiene una vía nueva, y la trampa 2 ya
tenía la suya), `13-agentes.md` y `.claude/agents/auditor-privacidad.md` (dos
chequeos que pasaron a estar cubiertos por tests, así que el auditor deja de
repetirlos), `src/lib/ayuda.ts` (el punto que describía la barra vieja mentía, y se
agregaron los comportamientos que no se adivinan mirando, incluida la casilla que
no vuelve tildada) y tres novedades en `src/lib/novedades.ts`, selladas `1.2.0`
como pide D-117.

## 1.1.0 — 2026-08-25

**Desplegada como `1.1.0+301091a`** el 2026-08-25, a mano
(`npm run build && firebase deploy --only hosting`): por CI todavía no se puede,
ver abajo. Es la primera release desde `1.0.1+538bef7`, que era lo que el panel
servía desde el 2026-08-21. Todo lo de los cuatro días siguientes —el formulario
partido en secciones, la vista calendario, la pantalla de taxonomías, el orden y
los filtros del listado, los dos P0 del sync a Calendar, «Feria»— no había
llegado a producción. Esta versión es eso.

`1.1.0` y no `1.0.2` por lo que hay adentro: dos pantallas nuevas, filtros y
orden en el listado, y un tipo de actividad más. Un parche no lo describe.

### Cuatro novedades que faltaban, y trece con la versión equivocada

Los cambios de los últimos días entraron al CHANGELOG pero **no** a
`src/lib/novedades.ts`, que es lo que la otra persona que carga actividades
efectivamente lee. Se agregaron las cuatro que se notan al usar el panel:

- **`etiquetas-nacen-aprobadas`** — la que más importaba, porque **corrige una
  novedad que ya se publicó**. `etiquetas-a-revisar` salió en `1.0.0` diciendo
  que una etiqueta nueva no le aparece a la otra cuenta hasta revisarla, y B-131
  volteó el default (D-104). Una novedad vieja que quedó mentirosa no se edita
  —el `id` es la marca de "hasta acá leí" y quien ya la leyó no vería la
  corrección—: se agrega una nueva que dice qué cambió.
- **`tipo-feria`** — B-129, con su cascada del §11.
- **`material-mas-formatos`** — B-134: `durante-el-mes`, `newsletter`,
  `playlist`, «Libro o lectura», y el `(Otro,` que se fue del evento (B-182).
- **`quien-cargo-cada-actividad`** — B-130, que además contesta la pregunta que
  lo originó ("los eventos del otro admin también me aparecen, ¿no?").

Y **trece entradas apuntaban a una versión que no las contenía**: siete decían
`1.0.1` —el número vigente cuando se escribieron, ya desplegado sin ellas— y seis
no decían nada. Se re-sellaron todas a `1.1.0`. El detalle y la regla que queda
—publicar una versión incluye revisar las novedades sin publicar— en **D-117**.

### B-182 · el evento ya no dice «(Otro, …)»

Mirando un club de lectura publicado, tres de cinco líneas de material decían
`(Otro, previo al encuentro)`: `otro` es el formato donde cae todo lo que no entra
en los demás, así que es el más usado, y «Otro» no informa nada al lado del
título. Ahora con `tipo === 'otro'` la línea sale `- <título> (<entrega>)`. La
entrega se conserva: es la mitad del ítem que no está en el título. En el
desplegable del panel «Otro» sigue estando — es otra pantalla con otro criterio,
el mismo motivo por el que `ETIQUETA_ENTREGA` no se comparte (D-20).

Va con test, porque el patrón que lo restaura es tocar el `map` de material sin
acordarse del caso.

De paso, la guía nombraba tres momentos de entrega y hay cuatro desde B-134:
`durante el mes` faltaba. Una ayuda que miente es peor que no tener ayuda.

### B-123 · el inventario de infra se releva con un comando, y compara

El ítem pedía "un script que imprima el inventario en el formato del documento, para
diffear a ojo". Quedó con una vuelta de tuerca: **compara**.
`./scripts/relevar-infra.sh` consulta el proyecto, sale con 1 y nombra cada
divergencia.

Lo que lo justificó fue el propio día: la doc decía que faltaba trabajo terminado
hacía días —tres Functions "sin desplegar" que estaban ACTIVE, un secreto "falta
crearlo" que existía desde el 21— y **B-20 parecía tener cinco pasos pendientes y
tenía uno**. Ese es el drift que este script atrapa, y va siempre en la misma
dirección: alguien despliega algo y no vuelve al documento.

**Está partido en dos, y ahí está lo que lo hace mantenible.** `relevar-infra.sh`
consulta `gcloud`/`gh` y no se puede testear; `comparar-infra.sh` recibe el estado
por stdin y el documento como argumento, así que **la mitad que decide tiene nueve
tests**, incluidos los dos casos reales del día. Mismo corte que `que-deployar.sh`,
mismo motivo: una decisión que no se puede probar se prueba en producción.

Compara tres cosas —Functions, roles de `deploy-ci@`, secretos— y no el inventario
entero, y eso está escrito en la cabecera para que no se lea como una omisión:
automatizar el resto pedía parsear prosa, y un comparador que se equivoca leyendo la
doc es peor que ninguno.

Dos detalles que valieron la pena. **El aviso del rol nombra el otro archivo:** si
`deploy-ci@` tiene un rol que la doc no declara, manda a mirar también
`07-seguridad.md`, porque el drift entre esos dos es cómo una afirmación de seguridad
quedó mintiendo una hora. Y **"no pude ver" no es "no existe":** sin permiso para
leer los secrets de GitHub, la comparación queda *sin verificar* en lugar de reportar
que falta. Eso lo escribí mal la primera vez, el script gritó en falso, y quedó con
test — la primera vez que un chequeo grita en falso se lo empieza a ignorar.

### El runbook de la alerta que B-21 daba por escrito

B-21 decía que "el filtro exacto y los pasos de la consola están en `08-operacion.md`
§ 'Alerta de rebuild agotado'", y esa sección **no existía**. La referencia era una
promesa, no una instrucción, justo en el único paso que solo puede dar el dueño.

Ahora está, con tres pasos y uno que no se saltea: **mirar una entrada real antes de
fijar el filtro.** Las Functions v2 corren sobre Cloud Run, así que en Logging
aparecen como `cloud_run_revision` y no como `cloud_function`, y el `service_name` va
en minúsculas — copiar un filtro de un runbook sin confirmarlo es cómo se arma una
alerta que nunca dispara, y una alerta que no dispara no se nota nunca. Va con el
snippet para forzar una entrada de prueba (poner `sistema/rebuild` en agotado a mano)
y el aviso de que dejarlo así rompe el rebuild hasta el próximo cambio.

El filtro apunta a `jsonPayload.alerta="rebuild-agotado"` y no al texto del mensaje,
que es para lo que se agregó ese campo: un filtro sobre la frase se rompe en silencio
el día que alguien la reescribe.

### Los tres auditores, y lo que encontraron sobre el deploy nuevo

Se corrieron al final del día, sobre el rango completo. **Trampas: limpio** — y de
paso verificó por su cuenta que el parser tolerante devuelve `name` y `on` sobre el
YAML roto, que es el argumento del test nuevo. **Privacidad: cuatro hallazgos, dos
P1.** **Documentación: catorce**, todos drift, ninguno trabajo sin documentar.

**Los dos P1 de privacidad son consecuencia de arreglar B-188** (B-195): hasta ese
momento `deploy.yml` no arrancaba nunca, así que sus problemas eran inertes.

**El motivo del rebuild se interpolaba en el cuerpo del script.** `${{ }}` dentro de
un `run:` se pega en el texto antes de que exista la shell, y `motivo` sale de
Firestore: un valor con `$(…)` ejecutaba lo que quisiera en el job que más abajo
recibe la única key del proyecto. Y aparte, **los logs de Actions de un repo público
los lee cualquiera**, así que el motivo es una salida pública más que el §5.1 no
enumera. Ahora entra por `env:`, con dos redes — y la segunda es la que me gustó:
**el motivo tiene que ser opaco, verificado como propiedad y no como lista.** Ningún
dato del documento se alcanza sin un acceso a propiedad, así que se exige que las
interpolaciones no tengan un punto: `${id}` pasa, `${despues.titulo}` no, sin
importar cómo se llame el campo. El cambio tentador era exactamente ése, y publicaría
el título de una actividad que puede estar en borrador.

**El gate de la trampa 4 estaba copiado en YAML, y la copia había divergido.**
`deploy.yml` tenía el `grep` inline en vez de llamar a `verificar-bundle.sh`, y le
faltaba la guarda final: que `dist/` tenga al menos un `.js`. **Un build vacío pasaba
el gate habiendo verificado nada** — lo que la cabecera del script advertía que
pasaría al duplicarlo, y exactamente el build de B-189. La fila de "qué se decidió no
automatizar" que decía "gate bloqueante de los dos workflows" era falsa desde que se
escribió.

### D-119 · la única key del proyecto no puede cambiar qué es legible

El auditor encontró que `07-seguridad.md` seguía afirmando *"si se filtrara, el daño
se limita a leer datos que ya son públicos — no a modificar la base"* después de que
le agregáramos `firebaserules.admin` esta misma tarde. **Y había dejado de ser
cierto:** las reglas del §5.3 son lo único que mantiene fuera de una lectura anónima
los borradores, `difusion`, `online.url` y los uids, así que una key filtrada pasaba
de "leer lo que ya es público" a **hacer legible todo Firestore**.

Se revirtieron los dos roles. Las reglas se despliegan a mano, igual que las
Functions y por el mismo argumento — y es peor que ése: los roles de Functions
habilitan un deploy, éste cambiaba la visibilidad de datos ya guardados.

La contra está asumida y sube **B-194 a P1**: con el job de reglas rojo, un push que
toque las reglas **y** `src/` no publica el panel, porque el `if` de Hosting pide
`needs.firestore.result != 'failure'`. Ese `if` existe por un motivo bueno, pero
ahora distingue mal entre "las reglas son inválidas" y "esta credencial no despliega
reglas, por diseño".

Y lo que hizo posible el drift quedó atado: `tests/roles-deploy-ci.test.ts` exige que
`02-infraestructura.md` y `07-seguridad.md` declaren los mismos roles, y falla si
aparece cualquier rol de escritura que no sea el de Hosting. **La próxima vez que el
radio de la key cambie, el test obliga a reescribir la afirmación en el mismo
commit.**

### Catorce correcciones de drift, y todas hacia el mismo lado

El auditor de documentación no encontró trabajo sin documentar —el CHANGELOG, el
backlog, las novedades, la ayuda y las decisiones del día estaban— sino **catorce
afirmaciones que ya no eran ciertas**, la mayoría de merges mal resueltos que venían
de antes:

- `02-infraestructura.md` tenía **cinco bloques duplicados**: la línea de
  `southamerica-east1` dos veces, un `### Variables de entorno` vacío seguido de
  `### Variables de entorno y secretos`, una tabla de "Secret Manager" que repetía
  dos valores que no son secretos, una fila suelta de `GITHUB_TOKEN` fuera de toda
  tabla, y dos filas de `calendar-sync@` con texto distinto.
- Un párrafo que decía que `dispararRebuild` "sigue sin desplegar" **dos líneas
  después** de decir que B-188 estaba arreglado, con la tabla del mismo archivo
  mostrándola ACTIVE.
- `08-operacion.md` decía "desplegar solo esas cuatro" y veinte líneas después "solo
  esas dos", con un párrafo que afirmaba que `guardarVersion` "todavía no se
  desplegó".
- Dos comandos de deploy distintos, uno detrás del otro, en el runbook de proyecto
  nuevo.
- "Las reglas de `/reportes` todavía no están desplegadas", contradicho por los nueve
  issues que `reporteAIssue` ya creó.
- "FALTA habilitar `secretmanager`", cuando el mismo archivo dice que el secreto
  existe desde el 21.
- `13-agentes.md` y el cuerpo de `auditor-trampas` seguían diciendo "diez trampas"
  después de que D-118 subiera a once — o sea que el agente iba a reportar como "sin
  red" algo que sí la tiene.

Todo corregido. **La lección no es la lista sino la dirección:** todo el drift de hoy
apuntó al mismo lado —la doc creía que faltaba trabajo ya hecho— y eso hizo que B-20
pareciera mucho más grande de lo que era. **B-123** (re-relevar el inventario solo)
está anotado como P3 y con la evidencia de hoy merece subir.

### El lazo del §8, verificado de punta a punta

Con B-188 arreglado se probó lo que nunca se había probado: mandar el **mismo**
`repository_dispatch` que manda `dispararRebuild` (`event_type: 'rebuild'`, con un
`motivo` en el `client_payload`). «Build y deploy del sitio» arrancó, imprimió
`Motivo: verificación de B-188` —la línea que estaba rota— y publicó
`1.1.0+ad973b8`.

Es la primera vez que el lazo del §8 se recorre completo: editar una actividad →
`dispararRebuild` → `repository_dispatch` → build → Hosting. Antes de hoy le
faltaban las credenciales, y con las credenciales le faltaba el último eslabón.

### B-188 · el workflow del rebuild estaba registrado sin triggers, por un `: `

`deploy.yml` tenía esta línea:

```yaml
run: echo "Motivo: ${{ github.event.client_payload.motivo || 'disparo manual' }}"
```

Un `: ` adentro de un escalar sin comillas hace que YAML lea un mapa anidado, así
que **el archivo entero era inválido** y GitHub lo registraba **sin ningún
trigger**. Estuvo así desde el primer día: el `repository_dispatch` de
`dispararRebuild` no disparaba nada, la Function veía su POST devolver 204, y lo
único visible era una corrida fallida sin jobs en cada push.

**Cómo se encontró, que es la parte reutilizable.** La UI no era necesaria y la API
no expone el error de arranque. Lo dijeron dos observaciones y un parser:

1. El `name` de la entidad del workflow era **el path** en lugar de "Build y deploy
   del sitio" → GitHub nunca leyó el `name:`.
2. `POST .../dispatches` contestó **422 "Workflow does not have 'workflow_dispatch'
   trigger"** sobre un archivo que lo declara en la línea 15 → la versión que
   GitHub tiene no tiene triggers.
3. `yaml` en modo estricto sobre los dos workflows: *Nested mappings are not allowed
   in compact mappings at line 38, column 14*.

Antes de eso se habían descartado los sospechosos obvios —tabs, BOM, CRLF, claves
duplicadas, caracteres invisibles— y todos estaban limpios: el problema no era el
archivo como bytes sino como gramática.

**La red.** `tests/workflows.test.ts` parsea todos los workflows en modo estricto,
exige `name` y al menos un trigger, y ata el `repository_dispatch` de `deploy.yml`
con el `event_type: 'rebuild'` que manda `functions/index.js` — dos archivos que
tienen que coincidir y que hoy no tenían nada que los uniera. Verificado
reintroduciendo el bug: falla y nombra línea y columna.

Un detalle del diseño del test que vale para el próximo: **mira `doc.errors`, no el
objeto parseado.** El parser de `yaml` se recupera del error y devuelve un objeto con
`name` y `on` adentro, así que un test que mirara el resultado habría dado verde
sobre un archivo que en GitHub no funciona. Un parser más tolerante que el consumidor
real da la respuesta equivocada.

Quedó como **trampa 11** del `CLAUDE.md` §13 (**D-118**). Es la primera del §13 que
no es de dominio, y la decisión está escrita: lo que las hace la misma cosa no es el
tema sino la forma de fallar — todo en verde, y el error solo visible del otro lado.
De paso entra a la maquinaria de B-119, que exige fila en el mapa y que el test
nombre su trampa.

### Un push a `main` ya publica solo

El deploy por CI quedó andando el 2026-08-25 18:04: la corrida publicó
`1.1.0+675d9e5` —reglas, índices, sitio y panel— y con eso **B-20 cierra sus cinco
pasos**. Publicar a mano queda como salida de emergencia, no como el camino normal.

Los roles se otorgaron **de a uno leyendo el error**, que era el plan: a los dos
iniciales se sumaron `serviceusage.serviceUsageConsumer` —el primer 403 no era del
deploy sino del chequeo de "¿está la API habilitada?"—, `firebaserules.admin` y
`datastore.indexAdmin`. Cinco en total, todavía **sin escritura de datos** y **sin
nada de Functions**.

**Lo que enseñó la primera corrida con credencial, y no había previsto:** Hosting se
salteó. Su `if` pide `needs.firestore.result != 'failure'`, así que **un job de
reglas que falla bloquea el deploy del sitio** — el "reglas primero" llevado hasta
el final. Está bien que sea así, pero significa que una corrida roja en reglas no es
"falta un permiso allá": es "no se publicó nada". Y de paso: `workflow_dispatch`
**siempre** deploya todo, con o sin el checkbox, porque sin `github.event.before` el
script no puede diffear y falla hacia el lado de deployar.

**Lo que queda rojo, a propósito:** el job de Functions. Habilitarlo pide
`iam.serviceAccountUser` sobre la SA de App Engine más `run.admin` y cuatro más —
poder actuar como una identidad privilegiada y desplegar código que corre con ella
es, junto, casi ejecución arbitraria, y ésta es la única key del proyecto. El
argumento por el que `deploy-ci@` es aparte de `calendar-sync@` se caía si se le
agregaba eso. La contra asumida tiene dos filos y quedó anotada como **B-194**:
toda corrida que toque `functions/` queda roja, y con el rojo se pierde el tag de
versión — que es el mismo push más seguido de lo que parece.

### `deploy-ci@` creada, y B-20 con un solo paso abierto

La service account del workflow existe desde hoy, con exactamente
`roles/datastore.viewer` + `roles/firebasehosting.admin` y **sin ninguna key**. Los
pasos que un agente puede dar están dados; el que falta es el único que no puede
(§5.4): bajar la key, cargarla como secret y borrarla del disco.

Precondiciones verificadas antes de tocar nada, porque son las que hacen fallar
esto a mitad de camino: el proyecto **no tiene organización** —así que no hay
`constraints/iam.disableServiceAccountKeyCreation` que bloquee crear la key—, la
cuenta de gcloud es `owner`, y las APIs de IAM, Hosting, Rules y Firestore están
habilitadas.

La lista de cinco pasos de B-20 quedó reescrita: **cuatro están hechos** y el
único abierto es el 4. Estaba mostrando como pendiente trabajo terminado hacía
días, que es lo que hacía parecer este ítem mucho más grande de lo que era.

### Dos defectos del runbook de `deploy-ci@`, antes de seguirlo

El único paso que falta de B-20 es crear la service account y su secret, y al
releer el runbook para dictarlo aparecieron dos cosas que lo hacían fallar:

- **El `gh secret set` documentado corta con 403.** Hay dos cuentas de `gh`
  logueadas y la activa (`gonza-benoffi-modo`) no tiene permiso sobre el repo. Es
  el mismo tropiezo que el primer push. Queda con el `export GH_TOKEN=$(gh auth
  token --user benoffi7)` adelante.
- **"Probar el workflow" apuntaba al workflow que no arranca.** Decía Actions →
  «Build y deploy del sitio», que es `deploy.yml` (B-188): probar con él no dice
  nada sobre el secret. Ahora dice «Deploy desde main» → *Deployar todo*.

Y una tercera que no era un defecto sino un alcance mal entendido: **los dos roles
de `deploy-ci@` alcanzan para el sitio y el panel, y nada más.** La lista se
escribió para `deploy.yml`, que solo buildea y publica Hosting; `push-main.yml`
tiene además un job de reglas y otro de Functions que usan el mismo secret con
`npx firebase deploy`. Mientras no cambien `firestore.rules` ni `functions/` esos
jobs se saltean solos; el día que cambien, cortan con `Permission denied` y la
corrida queda roja —y sin tag de versión—. Queda escrito qué roles pide cada uno,
con la indicación de **agregarlos de a uno leyendo el error** en vez de otorgar la
lista completa de entrada: cada rol de más es alcance que tiene la única key del
proyecto.

### Los nueve issues de GitHub, leídos y volcados al backlog

`reporteAIssue` viene creando issues desde el panel desde el 2026-08-21 y nadie los
había mirado. Nueve: tres de prueba, ya cerrados, y seis de uso real. Uno
(«Feria», #4) ya estaba cerrado como B-129. Los otros cinco eran cuatro pedidos
distintos:

- **B-190 · la plataforma es obligatoria y a veces no se sabe cuál es** (#5). "No
  quiero poner otro porque capaz es meet o zoom." El arreglo más barato no toca el
  schema: `online.plataforma` es taxonomía del §4, así que una opción base
  `a-confirmar` con `fijo: true` es **una entrada** en `opciones-base.json`. Es el
  argumento de «a la gorra» (§4.1): un estado real del dominio merece nombre
  propio. Hacerla opcional sería peor — un campo opcional no distingue "no hace
  falta" de "falta" (D-16).
- **B-191 · no hay autoguardado** (#6). "Reporté algo y todo lo que escribí se
  borró." El accidente concreto era **B-35** y ya está cerrado y publicado en
  1.1.0: ahora pregunta antes. Pero un aviso evita el accidente, no recupera el
  trabajo — y hoy se combina mal con B-183. Los tres ítems son **una historia en
  tres pedazos: no podés guardar (B-183), no sabés por qué (B-184), y si te vas lo
  perdés (B-191)**.
- **B-192 · una librería que sale a la calle no tiene tipo** (#8 y #9). Misma
  familia que «Feria», y como ahí se puede hacer hoy con «Otro…». **El nombre es el
  trabajo:** los dos reportes proponen tres etiquetas para lo mismo, y por B-134 un
  valor nuevo no es reversible mientras una etiqueta sí. Un solo slug, y el label
  se decide (**DEC-9**).
- **B-193 · la vista previa ya existía y quien la pidió no la encontró** (#7).
  B-12 salió el 2026-08-21 y el reporte es del 24 sobre esa misma versión. No falta
  la función: falta poder encontrarla — es la última sección del formulario, nace
  colapsada, y la persona estaba en el listado. Y el arreglo **no** es explicarlo
  mejor en la guía: la guía ya lo explica, que es justo el límite que B-63 señala.
  Es la primera evidencia medida de que la segunda persona no encuentra lo que se
  construye, y eso no lo dice ningún test.

### El inventario de infra decía que faltaba trabajo que ya estaba hecho

Al leer los issues quedó a la vista una contradicción: `02-infraestructura.md`
listaba `reporteAIssue` como "escrita, sin desplegar — falta el secreto", y los
nueve issues los creó esa Function. Relevado contra el proyecto
(`gcloud functions list`, `gcloud secrets list`):

| | La doc decía | Es |
|---|---|---|
| `guardarVersion` | escrita, sin desplegar | **ACTIVE** |
| `dispararRebuild` | escrita, sin desplegar | **ACTIVE**, corriendo cada 5 min |
| `reporteAIssue` | escrita, sin desplegar | **ACTIVE**, 9 issues |
| `GITHUB_TOKEN` (Secret Manager) | falta crearlo | **existe** desde el 2026-08-21 |
| `guardarVersionAlBorrar` | escrita, sin desplegar | correcto, sigue sin desplegar |

**El drift fue todo hacia el mismo lado:** la doc hacía creer que faltaba trabajo
ya hecho. Consecuencia concreta: de los cinco pasos de **B-20**, los pasos 1, 2 y 5
estaban hechos — falta **solo** la service account `deploy-ci@` y el secret de
GitHub.

Y una que apareció sola: **`dispararRebuild` está corriendo y su
`repository_dispatch` apunta a `deploy.yml`, que no arranca** (B-188, que por esto
sube a **P1**). El lazo del §8 está prendido de punta a punta menos en el último
eslabón, y en silencio — la Function no tiene forma de enterarse de que el workflow
no arrancó; para ella el dispatch salió bien.

### El primer push del repo, y lo que enseñó

GitHub estaba vacío: `1.1.0` es el primer push del historial. Las dos corridas
—una que cortó al minuto y otra que llegó hasta el deploy— dejaron tres cosas que
no estaban escritas, y ninguna era una previsión: son medidas.

**Publicar por CI está bloqueado por un solo secret.** «Deploy desde main» pasó el
gate completo —tests con emuladores, typecheck, build, chequeo de fuga— y murió en
`Error: Input required and not supplied: firebaseServiceAccount`. El repo tiene
cero secrets. Eso **invierte el orden de B-20**: el paso que desbloquea todo es la
service account `deploy-ci@` y su secret, no el PAT del rebuild, porque sin él
ningún cambio de código llega a producción por CI. Mientras tanto, publicar es a
mano.

**`hayCredenciales()` existe y no la llama nadie** (B-189, P1). Es la guarda de
`firebase-admin.ts` escrita para "¿tenemos con qué leer Firestore en este build?",
y `grep` no la encuentra en ningún otro lado. Hoy no rompe: ninguna página lee
Firestore todavía, así que el build sin credenciales es correcto y termina en
verde. Rompe con B-106 — ahí un build sin credenciales no va a fallar, va a
publicar `events.json` vacío encima del sitio que tenía datos, en verde y sin log.
Misma familia que el `EXIGIR_EMULADOR=1`: "verde" no puede significar a la vez "los
datos están" y "no había datos que leer".

**`deploy.yml` falla al arrancar en cada push** (B-188), y no debería ni correr: no
tiene trigger de `push`. El archivo es YAML válido —sin tabs, sin BOM, sin CRLF,
sin claves duplicadas— y GitHub no expone el motivo por API. Importa porque es el
workflow del lazo del §8: si no se puede procesar, el `repository_dispatch` de
`dispararRebuild` no va a disparar nada, y eso se descubriría recién al activar
B-20.

### B-187 · el primer push de CI cortó al minuto

`firebase-tools` estaba solo instalado global, y los workflows lo invocan con
`npx firebase`: en esta máquina encuentra el global, en un runner limpio corta con
`npm error could not determine executable to run`. Murieron el
`emulators:exec` del gate y los dos `firebase deploy`.

**Lo que importa no es el error, es que el gate de pre-push no podía verlo:**
`verificar-todo.sh` corre el mismo comando en la máquina que tiene el global, así
que da verde por el mismo motivo por el que CI da rojo. Misma familia que B-180 y
que `que-deployar.sh` — una condición que solo se evalúa en producción se descubre
en producción, y acá "producción" es el push.

Pasó a `devDependency` (17 MB) en lugar de un `npm i -g` en el YAML: las dos
opciones tapan el error, solo una tapa la clase. Con la dependencia declarada, el
gate local y los cuatro jobs corren **el mismo binario**. `npm run emu` también
pasó a `npx firebase`, así que un clone nuevo levanta los emuladores sin instalar
nada.

### Seis reportes de usar el panel de verdad, anotados

**B-181 · un club puede ofrecer N opciones para sumarte, no N encuentros.** Es la
primera forma del dominio que el modelo **no puede expresar**: `sesiones` es una
secuencia donde todas las filas pasan, y cuatro horarios alternativos del mismo
ciclo son excluyentes. Cargados como encuentros, el calendario le manda los cuatro
eventos a cada suscripto y el evento dice «Encuentro 2 de 4» sobre una
alternativa. Los tres caminos posibles cuestan cosas muy distintas, así que la
forma la decide el dueño: **DEC-8**.

**B-183 · «Guardar borrador» exige el formulario completo** (P1). El schema se
valida igual para borrador que para publicado, así que no se puede guardar a
medias — y desde B-35 el panel avisa al salir con cambios sin guardar, o sea que
quien carga queda entre un aviso que le dice que va a perder el trabajo y un
guardado que no lo acepta. El patrón del arreglo ya está en el archivo: la regla
del slug `-copia` corre solo al publicar.

**B-184 · el mensaje de error dice cuántos campos faltan, no cuáles** (P1). Fue
una decisión escrita —listar rutas de campo tapaba media pantalla en mobile— y el
reporte la da por equivocada, con un motivo que la decisión no tuvo en cuenta:
cuatro secciones arrancan colapsadas, así que un campo rechazado adentro de un
acordeón cerrado no se ve en ninguna parte. El contador dice tres, la pantalla
muestra cero.

**B-186 · el almanaque se cierra solo si se tarda en elegir la fecha** (P2). Leer
el código descartó los dos sospechosos obvios —no hay reordenamiento de filas ni
`key` por índice, y el valor no se normaliza al escribirlo— y dejó tres
candidatos. El primero explica el "si no pongo rápido" mejor que los otros dos: el
arranque de la analítica va en `requestIdleCallback(…, { timeout: 4000 })`, o sea
que **se dispara cuando la persona se queda quieta**. Se descarta o se confirma
con un build sin `PUBLIC_FIREBASE_MEASUREMENT_ID`, sin tocar código.

**B-185 · «DM de Instagram» → «DM al Instagram»** (P3). Copy, en dos lugares con
dos registros distintos que **no** están unificados a propósito (D-20). La contra
de esa decisión es esta: cambiar uno y olvidarse del otro es la clase de bug B-76
y el build queda verde igual, así que son las dos líneas o ninguna.

## 2026-08-25

### El gate de antes de pushear fallaba por su propia plomería

Correr `scripts/verificar-todo.sh` con los emuladores ya arriba —`npm run emu` en
otra terminal, que es como se trabaja— hacía que `emulators:exec` intentara
levantar los suyos, encontrara los puertos tomados y cortara con "port taken". O
sea: los emuladores estaban, la suite pasaba, y el gate decía que el push no
sale.

**Un gate que falla por su propia plomería enseña a saltearlo, y ahí deja de ser
un gate.** Ahora detecta el hub del emulador y, si contesta, usa el que está.

Queda anotado que ese `if` no tiene test (B-180), a diferencia de la decisión de
`que-deployar.sh`, que tiene 20: es el mismo argumento que llevó a sacarla del
YAML —una decisión que no se puede probar se prueba en producción— y acá
"producción" es el momento de pushear.

### El plan de saneamiento cerrado, y la documentación al día

Las cuatro fases integradas. [`10-salud-del-codigo.md`](10-salud-del-codigo.md)
se **remidió entero** —ningún número heredado sin volver a contarlo, que es la
única forma de que la comparación signifique algo— y quedó reescrito:

| | Antes | Ahora |
|---|---:|---:|
| Concentración en los 15 archivos más grandes | 52,7 % | **41,7 %** |
| Líneas de test por línea de código testeable | 0,81 | **1,14** |
| `ActividadFormulario.tsx` | 858 LOC, el más grande | 258 LOC, el 15º |
| Ciclos de import | 0 | 0 |

Y el cambio que no es un número: **el archivo más grande del repo dejó de ser
lógica.** Hoy es `ayuda.ts` (789 LOC), que es el texto de la guía. Que la cima de
la lista sea copy cambia lo que "el archivo más grande" significa como señal.

Los cuatro problemas del diagnóstico anterior están cerrados. El que queda es
otro, y creció en importancia porque los demás se cerraron: **34 componentes y
5.355 LOC de `.tsx` se verifican leyendo el fuente con expresiones regulares**, y
ese enfoque falló de tres maneras distintas en dos días. La lógica de dominio ya
salió de los `.tsx`, que era el motivo por el que B-08 estaba postergado.

**Lo que el reparto por archivo enseñó, y no estaba previsto:** frentes que no se
ven eligen el mismo número siguiente. Pasó en los cuatro merges —tres ítems y
tres decisiones en uno solo— y una vez fue peor que una colisión: dos frentes
descubrieron el mismo bug por caminos distintos y le pusieron números distintos.
**Dos números para un bug es peor que dos bugs con el mismo número**, porque uno
se cierra y el otro queda vivo describiendo algo ya arreglado. El chequeo son dos
comandos y quedó como regla del plan.

Borrados `ESTADO-PAUSA.md` y `docs/estado-pausa/`: existían para sobrevivir una
pausa, y dejarlos sería documentación que miente.


### Lo que faltaba del dominio: Feria, «durante el mes», y quién cargó qué

**B-129 · «Feria».** El primer reporte real cargado desde el panel no fue una
función del software: fue **una categoría del dominio que faltaba**. Ahora es
opción base con su regla del §11 — ciclo sí, material y tallerista no: una feria
del libro dura varios días, así que es una actividad con N encuentros (§2.2), uno
por jornada, y no tiene quien la dé. Sin la cascada caía en el default y había que
acordarse de tildar «es un ciclo» a mano, que es el olvido que el §11 evita.

Va con dos tests, y el segundo es el que no es obvio: que «Feria» sea `fijo`. La
cascada la nombra por slug, así que borrarla desde la pantalla de taxonomías
—que ahora existe— dejaría la regla apuntando a un tipo que no se puede elegir.

**B-134 · «durante el mes», y la tercera instancia de la misma clase.** Agregados
`durante-el-mes` en las entregas —el pedido concreto, y dice algo del dominio: la
entrega no siempre es un instante, puede ser progresiva a lo largo del ciclo— más
`newsletter` y `playlist` en los tipos.

**No se agregó `libro`**, que el reporte nombra: `lectura` ya es eso. Tener los
dos partiría los datos existentes en dos valores que después no se pueden volver a
juntar, porque nadie va a saber cuál eligió cada uno. Se cambió la **etiqueta** a
"Libro o lectura", que es reversible; agregar el valor no lo es.

Y en el camino apareció **la tercera instancia de B-76/B-132**: el desplegable de
tipo de material pintaba el valor crudo, así que decía "guia" y "autor" mientras el
evento público decía "Guía" y "Sobre el autor". El mapa se importa de
`@calendario` en lugar de copiarse (D-20), y el chequeo nuevo no protege la línea:
afirma que **todo** valor de los dos enums tiene etiqueta en las dos pantallas.
El patrón que produce la cuarta instancia es agregar un valor al enum y olvidarse
de un mapa, y ahí el desplegable muestra el slug sin que nada falle.

Ese chequeo destapó dos fallas del extractor de mapas que usaba, las dos de la
misma familia —un chequeo que lee el fuente y **cree** haber encontrado lo que
buscaba—: no saltaba la anotación de tipo (`const X: Record<…> = {`), así que el
mapa anotado salía vacío y el error decía "el panel no sabe decir «previo»" sobre
un mapa que lo dice; y cruzaba saltos de línea, así que una **mención** del nombre
en un comentario enganchaba con el `= {` del mapa siguiente y se leía el mapa
equivocado. Un chequeo que mide otra cosa es peor que uno que no mide nada,
porque el mensaje de error manda a buscar donde no está.

**B-130 · quién cargó cada actividad**, y salió más chico que lo que el ítem
proponía. Sus dos caminos —guardar el mail en el documento, o cablear el mapa
uid→nombre— eran más grandes que la pregunta. Lo reportado fue *"los eventos que
crea el otro admin también me aparecen, ¿no?"*, o sea **¿esto lo cargué yo?**, y
eso se contesta con el uid que el panel ya tiene en la sesión: cero cambios de
modelo, cero riesgo de filtrar un uid al público (§5.1).

La fila marca solo lo ajeno. Lo propio no lleva marca a propósito —si todo lleva
marca, la marca deja de avisar— y un documento sin `createdBy` queda sin marcar,
porque afirmar de más sobre datos viejos es peor que callarse. Con dos cuentas
"otra cuenta" identifica sola a la otra persona; con tres deja de alcanzar, y eso
es **B-179**, junto con la maquinaria de aprobación que B-131 dejó dormida: las dos
esperan el mismo momento.

### Los dos bugs que aparecieron usando el panel de verdad

**B-133 · el campo «arrobar» se comía la coma.** Era una lista modelada como
string: `join(', ')` para mostrar, `split(',')` en cada tecla para guardar. Al
tipear la coma, el `split` producía un elemento vacío, el `filter(Boolean)` lo
descartaba y el `join` volvía a pintar el valor sin la coma — **la coma se borraba
sola en el momento de escribirla**, así que no había forma de cargar un segundo
handle. Enter tampoco: es un input dentro del `<form>`, así que intentaba guardar
la actividad. Y la ayuda del campo decía «un handle por línea o separados por
coma», con las dos cosas rotas.

**No se arregló reusando `TagsInput`**, que era lo que proponía el backlog
(D-116). El patrón de interacción sí; el componente no, porque está atado a la
taxonomía `tags`: slugifica y persiste en `/opciones/tags`. Los handles son
trabajo interno del §3.2, así que reusarlo habría metido `@casabrandon` en el
desplegable de etiquetas de **todas** las actividades, con `usos` contándolo. El
bug de fondo era modelar una lista como string; cambiarla por la lista equivocada
lo hubiera reemplazado por uno más caro de deshacer.

Quedó `ChipsInput` sobre un módulo puro con 11 tests. Tres decisiones que no son
obvias: **el espacio no separa** (hay nombres con espacios, y cortar por espacio
partiría «Casa Brandon» a la mitad mientras se escribe — el mismo daño que hacía
el bug); los **duplicados se comparan ignorando mayúsculas y el arroba**, porque
`@CasaBrandon` y `casabrandon` son la misma cuenta y tenerlas dos veces es el
error que se comete al volver sobre una actividad meses después; y **se guarda lo
que se escribió**, no una versión normalizada.

**B-132 · el desplegable mostraba el slug pelado.** `villa-crespo (nueva)` en
lugar de «Villa Crespo». Se llegaba por dos caminos —cargar una etiqueta nueva, y
reabrir una actividad cuya etiqueta nunca se registró— y los dos salían de la
misma línea: `` `${value} (nueva)` ``, donde `value` es el slug.

Se resolvió con el **mismo** des-slug que usa la descripción del evento público,
importado de `@calendario` y no copiado (D-20). El panel era el único lugar que
todavía mostraba el slug pelado, que es exactamente lo que D-11 describe como "se
ve roto".

Y el chequeo que quedó no protege la línea, protege **la forma**: que ningún
componente del panel interpole un valor de taxonomía crudo en un texto visible.
El `(nueva)`, el `(sin aprobar)` y el que venga son la misma cosa, y el tercero lo
va a escribir alguien que no leyó ese archivo. Verificado contra el código viejo
para confirmar que lo detecta.

### Las dos mitades que ningún frente podía cerrar solo

Terminado el plan de saneamiento, quedaban dos ítems que existían **solo** porque
el trabajo se repartió por archivo: cada uno tenía su mitad hecha en un frente y
su mitad pendiente en otro. Es el costo previsible de ese reparto, y se paga
ahora, junto.

**B-170 · la pantalla de taxonomías ya se puede abrir.** 3A la construyó completa
y la dejó sin montar porque el router vive en `AdminApp.tsx`, de 3B. Ahora está en
la cabecera del listado, como «Opciones».

Con una trampa que valía la pena esquivar: el contador de pendientes de B-26
necesita `usePendientesDeAprobacion`, que importa Firestore. La cabecera se
renderiza en `AdminApp`, que está en **el chunk inicial** — el que se baja para
mostrar "Entrar con Google". Llamarlo desde ahí habría arrastrado el SDK a ese
chunk y deshecho el corte de B-09/D-51 **sin que nada falle**: el panel seguiría
funcionando, solo tardaría el doble en aparecer. Ese error ya se cometió tres
veces. Por eso el contador es un componente propio (`PendientesBadge`) envuelto en
`diferido()` y usado solo en la vista de lista, donde el listado ya bajó
Firestore. La carga inicial quedó igual: `client` en 184 kB.

Va con su capítulo de ayuda, y ahí hay algo que no es obvio y se paga caro: **
renombrar una opción no sirve para arreglar un typo ya guardado**. La actividad
guarda el slug, no el texto, así que renombrar «Villa Crepso» a «Villa Crespo»
deja las actividades apuntando al slug viejo. Para eso hay que borrar la mala y
volver a elegir. El capítulo lo dice con esas palabras.

**B-168 · el `usos` del §4.3 finalmente cuenta.** 3A escribió y testeó
`registrarUsos`, pero llamarla era una línea en `guardar()`, de la fase 2. La
resta es la parte con filo: las etiquetas recién creadas **no** se cuentan, porque
`upsertOpcion` ya las siembra con `usos: 1` y sumarlas otra vez las deja en 2 —
justo las opciones que el §4.3 quiere poder distinguir de la basura ("una opción
con `usos: 1` creada hace meses es casi seguro un typo colgado"). El síntoma de
equivocarse ahí es silencioso: números plausibles y un orden mal.

Y el fixture del test tenía **la clase B-135 por cuarta vez**: `entrada()` dice
que se tipeó «Con beca parcial» pero el form guarda `a-la-gorra`, combinación que
el panel real no puede producir —`recordarLabel` pone el slug en el mismo cambio
que registra el label—. Con ese fixture la resta no tiene nada que restar y el
chequeo pasaba sin haber mirado el caso. Cierra **B-86**.


## 2026-08-24

### La red de contención sobrevive a que le muevan el piso

Integrada la fase 1 completa. Lo que rompió no fue el código: fueron los
**chequeos estructurales**, que leen el fuente para verificar propiedades y por
eso dependen de dónde están las cosas. B-77 partió `functions/index.js` en
módulos y los dejó midiendo el vacío — verdes, sin probar nada.

**La extracción del cuerpo de un trigger buscaba `\n});`.** Con los triggers ya
partidos, ese patrón cortaba todos los cuerpos en la primera llamada anidada, así
que los chequeos veían fragmentos y reportaban hallazgos que no existían. Ahora
cuenta paréntesis balanceados. Y lo que el test adivinaba por regex —qué campos
escribe el sync— pasó a ser un export: `CAMPOS_QUE_ESCRIBE_EL_SYNC` en
`functions/sincronizacion.js`. Adivinarlo ya había fallado dos veces.

**Un chequeo que enumera nombres se queda viejo, y se edita sin pensar.** El de
triggers blindados listaba `['guardarVersion','reporteAIssue']`; B-41 agregó
`guardarVersionAlBorrar` y el test lo dio por regresión. La lista se reemplazó
por la propiedad —al menos dos blindados—, que es lo que el chequeo quiere
garantizar. Un test que hay que actualizar para que siga pasando se termina
actualizando en automático, y ahí se apagan los chequeos.

Uno quedó apagado a propósito (**B-171**): el detector de guardas dejó de
reconocer las de `guardarVersion` porque el refactor las mudó a un helper y él
las busca en el cuerpo del trigger. Está `it.skip`, no `it.fails`, porque un test
apagado tiene que verse apagado.

### B-84 cerrado: el semáforo disparó como estaba diseñado

Los tres `it.fails` de `tests/invariantes-de-ciclo.test.ts` empezaron a pasar
cuando 1B arregló la renumeración, y **un `it.fails` que pasa rompe el CI** —que
es toda la idea— así que vinieron a promoverse. El test que documentaba el
comportamiento viejo ("cancelar un encuentro emite una operación por encuentro
del ciclo") se invirtió en la propiedad buena: **el costo de cancelar no escala
con el tamaño del ciclo**. Se dejó separado del que verifica *cuál* es la
operación, porque un arreglo que emitiera un `actualizar` idempotente por hermano
pasaría aquel y volvería a reescribir los siete eventos restantes.

**Y el fixture tenía la misma clase de bug que el archivo persigue.** El cuarto
caso de `FAMILIA_DE_CICLOS` —un ciclo con el tercer encuentro ya cancelado— le
dejaba a esa sesión su `calendarEventId`. El sistema no puede tener ese estado
asentado: al borrar el evento, `syncCalendar` repone `null` en la sesión. El
fixture describía algo irreal y por eso `planificar` emitía un borrado de más en
cada escritura posterior. Es la cuarta aparición de B-135 —un fixture que no
reproduce el dominio— y esta vez adentro del archivo escrito para detectarla.

`docs/13-agentes.md` nombra `antes-de-pushear` y `automatizar`, que existían sin
estar documentados (lo detectó B-120, que es el test que verifica justamente eso).

### Taxonomías: una sola deduplicación, etiquetas presentables y pantalla para administrarlas

La fase 3A del plan de saneamiento, sobre el §4 del `CLAUDE.md`. Cierra **B-72**,
**B-05**, **B-06**, **B-25**, **B-26**, **B-73** y **B-131**, y deja **B-86**
hecho a medias a propósito (ver abajo).

**B-72 · la mitad crítica del §4.2 estaba escrita dos veces.** `TaxonomiaSelect`
y `TagsInput` tenían cada uno su filtro de sugerencias y su resolución por slug
—la parte que evita que el 90 % de los duplicados nazca— y ya habían divergido en
tres reglas. Ahora las dos llaman a `src/lib/taxonomia.ts`, puro y con 27 tests
(D-100). Los componentes **no** se unificaron: un `<select>` con "Otro" y un
input de chips son widgets distintos. Lo que se comparte es lo que no puede
divergir, y las dos diferencias que quedan son parámetros con motivo escrito.

**B-05 · las etiquetas se veían en público sin normalizar.** Un tag tipeado
"narrativa" se publicaba así, al lado de "Poesía". `upsertOpcion` guarda el label
con `etiquetaPresentable` —trim, espacios colapsados y **solo la primera letra en
mayúscula**, que es lo que no rompe "Villa Crespo" ni "Club de lectura" (D-101).
El slug, que es la identidad, no cambia.

**B-06, B-25 y B-26 · pantalla para administrar las taxonomías.** Las cinco
listas, con `usos` y estado a la vista, y tres acciones por fila: renombrar,
borrar y aprobar. Renombrar **no toca el slug** (§4.1), así que corregir cómo se
escribe una etiqueta no desconecta las actividades que ya la usan; borrar **no
toca las actividades**, que siguen mostrando el des-slug de D-11, y por eso
borrar algo con usos se confirma aparte mostrando exactamente cómo se va a ver.
Las opciones base no ofrecen ninguna acción, y la guarda no es la UI: está en la
transacción (D-102). Arriba, el contador de pendientes de B-26.

**La pantalla queda creada y sin montar**: colgarla del router es editar
`AdminApp.tsx`, que en esta fase es de otro frente. Anotado como **B-170**, con
la novedad y la ayuda del panel pendientes de ese mismo paso — hasta que se monte
no hay nada que anunciar.

**B-73 · los tags no se medían.** `CAMPOS_TAXONOMIA_MEDIBLES` declaraba `'tags'`
y `TagsInput` no llamaba a `medirFuncion` en ningún lado: el campo con más
volumen esperado era el único invisible en GA4. Ahora emite `taxonomia-nueva`,
`taxonomia-reusada` y `taxonomia-sugerencia`. `taxonomia-otro` no aplica: no hay
modo "Otro" que abrir (D-105).

**B-131 · las opciones nuevas nacen aprobadas.** Decisión del dueño. La
maquinaria de aprobación queda **dormida, no muerta**: sigue entera, con el
motivo escrito al lado del default, una guardia que lo fija y sus tests
ejercitándola con una opción puesta pendiente a mano (D-104).

**B-86 · `usos` solo contaba creaciones.** La operación está hecha
—`registrarUsos(campo, slugs)`, una transacción por campo, ignora lo que no
existe y no cuenta dos veces el mismo slug (D-103)— pero **el cableado no**:
llamarla es una línea en `guardar()`, que vive en `ActividadFormulario.tsx`, de
otro frente. Queda como **B-168**, con el orden exacto escrito para que no se
cuente doble.
### La red de contención: los chequeos estructurales dejan de mirar una sola hoja

Fase 4 del plan de saneamiento. Ningún bug arreglado acá: lo que se arregló es la
red, que en tres lugares distintos había dejado de agarrar por la misma razón —
**preguntaba por un archivo cuando la propiedad es sobre el grafo**. Cierra
**B-171** (el detector apagado), **B-117**, **B-50**, **B-119** y **B-115**, y
cubre la **trampa 4** del §13.

**B-171 · el detector de triggers blindados estaba apagado.** El chequeo de la
clase de B-82 —"todo trigger con efecto duplicable se blinda"— estaba en
`it.skip`. Después del refactor de B-77 el efecto y la guarda de los triggers
viven en helpers, y el detector los buscaba en el cuerpo del trigger:
`guardarVersion` y `guardarVersionAlBorrar` dejaron de contar como triggers con
efecto (su `.set()` se mudó a `guardar()`), así que no había dos blindados que
contar. Y algo peor que nadie había visto: `syncCalendar`, **ya blindado** desde
que B-82 cerró (`idDeEvento` dentro de `crearEvento`), seguía contándose como
desguarnecido, así que el `it.fails` de B-82 seguía fallando mucho después de que
el bug estaba arreglado. Un detector ciego no solo pierde regresiones: también
miente sobre lo que sigue roto, y un `it.fails` que falla se ve exactamente como
tiene que verse.

Ahora el detector **sigue la llamada**: arma la traza del trigger expandiendo
cada llamada a una función declarada en `functions/**` —del mismo archivo o
importada— y clasifica en orden lo que encuentra. De paso se afinó qué es un
efecto duplicable: crear algo cuya identidad elige el receptor o escribir en una
dirección **calculada** sí; direccionar una identidad que ya existe (`.update`,
`.delete`) o escribir siempre en la misma dirección (`marcarRebuild`) no. El
`it.skip` volvió a `it` y el `it.fails` de B-82 pasó a `it` (D-108).

Y va lo que faltaba la primera vez: **nueve tests del propio detector** contra
cuerpos sintéticos, incluida la regresión exacta de B-171, más un control
negativo sobre el repo real (tiene que haber al menos un trigger **sin** efecto
duplicable). El detector es lo que decide si el chequeo mira algo o da un verde
vacío.

**B-117 y B-50 · el corte del bundle se cuida siguiendo el grafo.**
`tests/bundle-panel.test.ts` comparaba literales y nombraba los dos componentes
diferidos que había ese día; ya eran cuatro, y volver estático `ReportesPanel` o
`CalendarioActividades` deshacía el corte con el test en verde. Ahora recorre el
cierre transitivo de imports desde la entrada de la island —que se lee de
`admin.astro`, no se hardcodea— y afirma dos propiedades: el SDK pesado no es
alcanzable siguiendo solo imports estáticos, y lo que se carga con `import()` no
es alcanzable de forma estática. El quinto componente diferido queda cubierto sin
tocar el archivo. **B-50** entra en la primera propiedad: `firebase/analytics`
sigue afuera del chunk inicial, y ahora hay un test que lo mantiene así en vez de
un `npm run build` de una vez (D-106).

**La trampa 4 del §13, que no tenía ningún test.** `firebase-admin` en el bundle
cliente —o sea la key de la service account en un artefacto público (§5.4)— era
la única de las diez trampas sin red, y la de peor consecuencia. La cubre el
mismo recorrido: la regla del §5.4 no es "este archivo no lo importa", es "no se
llega desde el cliente", y eso se contesta recorriendo. Se mira el grafo
completo, diferidos incluidos.

**B-119 · el mapa trampa → test → archivo, que se verifica solo.**
[`15-mapa-de-trampas.md`](15-mapa-de-trampas.md) dice dónde vive cada trampa del
§13 y qué test la fija, y `tests/mapa-de-trampas.test.ts` lo contrasta con el
repo: lee la lista de trampas del `CLAUDE.md` (no la copia), exige que cada test
citado **nombre** su trampa, y calcula del repo cuáles no tienen ninguno para
compararlo con lo que el documento declara, en las dos direcciones. Una trampa no
puede quedarse sin red en silencio, y el documento tampoco puede declarar sin red
algo ya cubierto (D-107). Quedó abierta la **trampa 7** (query pública sin el
`where`), anotada como B-172.

**B-115 · ya estaba cerrado y nadie lo había marcado.** Lo cierra el skill
`antes-de-pushear`, que entró con B-139: lanza los tres auditores en paralelo
antes de un push o un PR. Se marcó con su causa en vez de duplicar el trabajo.

Anotado y **no** hecho, porque toca archivos de otros frentes: **B-172** (la
trampa 7), **B-173** (`tsc --noEmit` sale siempre en rojo por doce errores de
`ImportMeta`, así que un error nuevo se esconde entre ellos) y **B-34** (el tope
de reportes vive en `firestore.rules` o en la Function, y la forma del límite es
una decisión).
### Fase 3B — el listado, el panel y el centro de ayuda

**B-14 y el tercer punto de B-64 · el teclado, en las dos pantallas a la vez.**
Eran dos ítems del backlog porque se vieron en dos lugares, pero es una clase: un
patrón de teclado a medio hacer —cierra con `Escape`, se alcanza con Tab, y nada
más— en el menú "⋯" del listado y en la capa del centro de ayuda. La aritmética
del foco salió a `src/lib/foco.ts` (pura, 15 tests) y el DOM quedó en cada
componente. El menú suma ↓/↑ con vuelta, `Home`/`End`, apertura con flecha y
**devuelve el foco al "⋯" al cerrar**; la capa cicla el Tab sobre sus propios
controles y devuelve el foco a lo que estaba enfocado antes de abrirla.

Escribiendo esa cuenta apareció un bug que habría entrado sin que nadie lo viera:
tratar "ninguno enfocado" como el índice `-1` a secas hace que ↑ caiga en el
**penúltimo**, y con dos ítems —los que el menú tiene hoy— el resultado parece
razonable.

**B-31 · un reporte que no se pudo publicar se reintenta desde el panel.** Si el
token venció o el repo estaba mal escrito, el reporte quedaba en `error` a la
vista y sin nada que hacerle: reintentar era abrir una terminal con el Admin SDK.
Ahora la fila tiene un botón **Reintentar**.

Se eligió una escritura acotada del cliente y **no** una función `onCall`: el
disparador de la publicación ya es una escritura en el documento —la Function
reintenta sola poniendo `estado: 'pendiente'`— así que el botón hace lo mismo que
el sistema ya hace, sin un segundo camino con su propio chequeo de claim y su
propia forma de fallar. La autorización la siguen haciendo las reglas (§5.3).

Lo que decide si el botón sirve, y que el backlog no decía: hay que resetear
**`intentos` a 0**. `decidirAccion` ignora un reporte con los tres intentos
gastados, que es el caso más común de un `error`, así que mover solo el estado
habría dejado un botón que escribe el documento y no pasa nada.

`reintentoValido()` permite **una** transición y prohíbe editar el texto que va al
repo público, reintentar algo en vuelo o ya publicado, y borrar. Ver **D-110**.

De paso salió un agujero de verificación que no era de este ítem: el emulador
sirve el `firestore.rules` **del directorio desde el que se lo arrancó**, así que
con varios worktrees en paralelo un test de reglas puede estar verificando el
archivo de otra rama y dar verde sin haber probado el cambio. Ahora hay un
`cargarReglas()` que empuja las de este checkout antes de correr, y los siete
tests de B-31 lo usan. Anotado para el resto en **B-174**.

**B-64 · las novedades ya dicen en qué versión salieron.** Mostrarlas ya se
mostraba: el campo existía, el componente lo pintaba, y estaba vacío. La causa no
era el olvido sino que **no estaba dicho de dónde sale**: `VERSION_APP` lleva el
`+<sha>` del build, que quien escribe la entrada no puede saber. La versión de una
novedad es la de `package.json` —la release en la que entra— y eso quedó escrito
en el tipo, en el paso 4 del skill `cerrar-cambio` (que decía "`version` si se
sabe", y por eso nunca se sabía) y en dos tests: la forma, y que no retroceda al
bajar por la lista. Con eso B-64 queda cerrado: su punto del medio —no poder
corregir una errata sin desplegar— no es trabajo pendiente sino el costo aceptado
en D-63.

**B-35 · irse del formulario ya no descarta en silencio.** Cuatro botones del
encabezado y el "Cancelar" del formulario abandonaban los 30+ campos del §11 sin
preguntar, y cerrar la pestaña también. Ahora hay un `confirm()` que dice qué se
pierde, más un `beforeunload` para el cierre de pestaña, y **una sola puerta**:
`salirDe(accion)` envuelve a las cuatro salidas en vez de repetir el chequeo en
cada `onClick`, que es la lista duplicada que D-98 combate. La regla de cuándo
preguntar es pura (`src/lib/salida-del-panel.ts`) y mira además la vista, no solo
el store: un aviso que aparece en el listado, donde no hay nada que perder, se
aprende a ignorar. Ver **D-109**.

Salió también un bug de acá: **"← Volver" del encabezado ignoraba `volverA`**, así
que editar un encuentro desde la vista calendario y volver por el encabezado
mandaba al listado y perdía el mes que se estaba mirando, mientras que "Cancelar"
sí lo respetaba. Dos salidas del mismo formulario con dos criterios.

**B-76 · el estado ya se lee igual en las dos pantallas.** El síntoma —el listado
decía "borrador" donde el formulario decía "Borrador"— venía cerrado con la vista
calendario, que subió `ETIQUETA_ESTADO` a `src/lib/filtrosActividades.ts`. Lo que
faltaba era la guardia: `tests/etiquetas-de-ui.test.ts` fija que el listado use el
mapa compartido y no el valor crudo, y compara el mapa del formulario contra el
compartido. Ese segundo chequeo **falla a propósito** (`it.fails`): el formulario
todavía tiene sus tres mapas locales y ya divergieron —"Híbrido" contra
"Presencial y virtual"—. Unificarlos toca `ActividadFormulario.tsx`, que es de la
fase 2, así que queda anotado en **B-175**.

**B-96 · ya estaba cerrado, por otro camino.** Lo resolvió D-73 (el listado ordena
por próximo encuentro, no por última modificación) en lugar del bloque "esta
semana" que proponía el backlog. Se verificó contra el código y no se agregó nada:
un bloque más sería la segunda pantalla que contesta la misma pregunta, que es lo
que D-71 evita. Lo único que el bloque hacía y el orden no —avisar de las
inscripciones que cierran— sigue abierto en **B-126**.

### El formulario, partido en nueve secciones

Cierra **B-79** y con él **B-70**. Las nueve `<Seccion>` del §11 y la barra de
acciones pasaron a `src/components/admin/formulario/`, una por archivo, y
`ActividadFormulario.tsx` quedó en ~230 LOC: estado, cascadas, guardado y el
orden de las secciones (**D-115**).

Vale por la superficie de conflicto: era el segundo archivo más tocado del repo
(9 de 41 commits) y acá ya se commitearon marcadores de conflicto que
sobrevivieron dos commits. También destraba B-62, el "?" por sección, que hoy
pedía tocar el mismo archivo en nueve lugares.

El JSX se movió **verbatim** —las props se llaman igual que las variables que
tenían adentro—, así que el diff no puede esconder un cambio de comportamiento.
Lo único que no era presentación se fue a un módulo puro:
`lib/formulario/condicionales.ts`, porque `necesitaSede` decide a la vez qué se
muestra y qué exige el schema, y si esas dos derivaciones se separan el
formulario esconde un campo que el guardado pide.

**Dos tests leían `ActividadFormulario.tsx` como texto** y se arreglaron en el
mismo cambio: `ayuda` (cada sección tiene su capítulo) y `opciones-orden` (el
arancel no se preselecciona). Los dos leen ahora el directorio de secciones, y
el segundo afirma primero que encontró el campo: un `not.toContain` sobre un
string vacío pasa sin haber mirado nada, que es la forma exacta en que este
refactor podría haberlos apagado en silencio.

**Costo medido, con el build:** la carga inicial de `/admin` pasó de **387.797 a
388.380 bytes** (+583 B, +0,15 %; gzip 106.934 → 107.127), los mismos 4 chunks y
ningún `modulepreload` nuevo. La suma de todos los chunks subió 3.418 B: es el
envoltorio de diez componentes nuevos.

### Regenerar los encuentros ya no borra y recrea los eventos del calendario

Cierra **B-90**. El generador del §11 daba ids nuevos a las ocho filas, así que
sobre un ciclo **ya publicado** el diff del §7.2 no reconocía ningún encuentro:
ocho `borrar` y ocho `crear` contra el calendario público, o sea "perder los
recordatorios y las suscripciones de la gente", que es literalmente lo que ese
diff existe para evitar. El caso que lo dispara es banal: el ciclo se corre una
semana y se regeneran las fechas.

Ahora `generarSesiones` recibe la lista que reemplaza y la fila de cada posición
hereda su `id` y su `calendarEventId` (**D-114**), así que ese mismo cambio son
ocho `actualizar`. Se reusa por posición aunque cambie la cantidad: diez sobre
ocho son ocho actualizaciones y dos altas; seis sobre ocho, seis y dos bajas.

No contradice la trampa 2: el id no se deriva del índice, se hereda de la fila
que ocupaba esa posición, y las filas nuevas siguen estrenando un uuid.

El cartel del generador decía "Reemplaza la lista actual", que no se lee como
"reemplaza el calendario": ahora dice qué recalcula y qué borra, y —solo cuando
hay encuentros ya publicados— que se mueven en lugar de recrearse. La guía del
panel se corrigió en el mismo lugar, y hay una novedad.

Los tests corren el generador de verdad contra el `planificar` de verdad: lo que
estaba roto era el par, no cada pieza. Abierto en el camino: **B-176**
(regenerar sigue borrando los temas y las lecturas, que ahora que la fila
conserva su identidad dejó de tener sentido).

### El formulario deja de ser el dueño de las reglas del modelo (fase 2)

La lógica de dominio de `ActividadFormulario.tsx` se mudó a módulos puros en
`src/lib/formulario/` y **de paso se arreglaron los dos bugs que vivían
adentro**. Cierra **B-71** y **B-87**; **B-70** avanza (falta B-79, el JSX).

Por qué el orden importa: esas reglas —"un club de lectura es un ciclo con
material", "una actividad virtual no tiene sede", el documento por defecto del
§3.1, el caso de uso de guardado— estaban en un `.tsx`, y como no hay
testing-library (B-08) **ningún test podía ejecutarlas**. Invertir uno de esos
condicionales dejaba `npm test` entero en verde. Ahora hay tests puros que
corren en milisegundos (`tests/formulario-dominio.test.ts`).

**B-71 · un guardado que fallaba dejaba etiquetas colgadas en el desplegable.**
Las opciones nuevas se creaban **antes** de escribir la actividad, así que un
fallo de red o de permisos dejaba basura permanente en una taxonomía que no
tiene UI de limpieza (B-06) — justo lo que D-02 quiso evitar. Invertido el orden
(**D-111**), el peor caso es que la etiqueta no quede registrada, y de eso ya
había red: el evento público la resuelve con el des-slug de D-11 ("Con Beca
Parcial" en lugar de "Con beca parcial"). Se pasó de perder datos a perder una
capitalización. Un fallo al registrar la etiqueta ya **no** vuelve fallido el
guardado: la actividad está escrita y reintentar chocaría contra su propio slug.

El orden se afirma con puertos falsos que anotan la secuencia de llamadas
(**D-113**), y el `it.fails` de la clase en `tests/clases-de-bug.test.ts` quedó
promovido a `it`: de acá en adelante, un flujo nuevo que escriba la taxonomía
antes que la actividad rompe el CI.

**B-87 · el formulario nacía sucio.** La preselección de "Taller" la hacía un
efecto del hijo, que corre antes que los del padre: el formulario quedaba "con
cambios sin guardar" sin que nadie tocara nada. Consecuencias visibles: el aviso
de versión nueva no se auto-recargaba nunca —mostraba "Guardá lo que estás
cargando" sobre un formulario vacío— y el parámetro `sucio` de
`formulario_abandonado` era siempre 1, así que la analítica no podía distinguir
"se abrió y se salió" de "había trabajo adentro". Ahora la preselección viene en
el estado inicial (**D-112**), que se puede resolver sin leer Firestore porque
ninguna opción creada con "Otro" puede quedar antes que una fija (§4.3).

Sin entrada en novedades: no hay nada nuevo que se pueda hacer en el panel, se
dejó de hacer algo mal.

Abiertos en el camino: **B-177**, que nadie avisa en pantalla cuando la etiqueta
no se registró. Y un segundo camino a **B-132**, que se anotó adentro de ese ítem
en lugar de como uno nuevo: reeditar una actividad cuya etiqueta nunca se
registró muestra el slug pelado igual que cargarla por primera vez. Mismo bug,
misma línea, mismo arreglo — dos números habrían sido peor que uno.

### Analítica, versión y enums: las cuatro listas duplicadas de la fase 1C

Cuatro vocabularios de la analítica se mantenían por separado de su fuente, y
todos fallaban igual: el valor nuevo viaja como `otro` **en silencio**, justo
cuando alguien está mirando los datos para entender algo. Cierra **B-75** y
**B-88**, y descarta **B-36** y **B-59** con el número medido.

**B-88 · la versión de un build sucio viajaba como `otro`.** `scripts/version.mjs`
estampa tres formas —`1.0.1+5e2cb50`, `1.0.1+5e2cb50-sucio.20260821-2124` y
`1.0.1+sin-git.20260821-2124`— y el sanitizador de la analítica aceptaba solo la
primera, porque el sufijo de las otras dos lleva guiones y pasa de 20 caracteres.
Con `registrarVersion(VERSION_APP)` ya enchufado en `AdminApp`, eso era todo lo
que se prueba a mano: los eventos perdían el único dato que existe para atribuir
un pico a un deploy.

Lo que se arregló **no es el regex**. Ampliarlo a mano dejaba el mismo problema
para el próximo formato que alguien invente, que es exactamente cómo apareció
este: el productor y el consumidor derivaban el formato por separado. Ahora hay
un solo lugar donde se arma la cadena (`componerVersion`, puro) con el dominio
completo de entradas de un build declarado al lado (`ENTRADAS_DE_BUILD`), y como
productor y consumidor no pueden compartir código —uno usa `node:child_process`,
el otro viaja al navegador— **los ata un test**: `tests/version.test.ts` recorre
`versionesPosibles()` y mete cada salida en el sanitizador real, más la versión
que estampa el árbol de trabajo de quien corre los tests. Es el patrón del D-60
con zod, aplicado a un formato en vez de a una lista (D-98). Los dos `it.fails`
de B-88 en `tests/costuras.test.ts` quedaron promovidos a `it`.

El formato se amplió a lo que el build produce, no se abrió: semver más un sufijo
de `[0-9A-Za-z.-]` hasta 40 caracteres, sin espacios, sin acentos y sin
`@ : / ?`. Un título, un mail, un handle o un link siguen sin poder pasar, con
nueve entradas rechazadas fijadas en un test.

**B-75 · tres enums del modelo copiados sin guardia.** `ESTADOS_DESTINO`,
`MODALIDADES_MEDIBLES` y `CAMPOS_TAXONOMIA_MEDIBLES` eran copias literales de
`ESTADOS`, `MODALIDADES` y `CAMPOS_TAXONOMIA`. Ahora son el mismo objeto, y la
guardia es la identidad: el test compara referencias, así que volver a escribir
la lista al lado del import falla aunque los valores coincidan ese día.

La duda era el bundle, y se verificó con el build: `@/types/actividad` tiene
fan-out 0, así que zod sigue fuera de la carga inicial y su chunk no se movió un
byte. La carga inicial de `/admin` (cierre estático de imports) pasó de **386.088
a 386.303 bytes** con los dos cambios juntos: **+215 B, +0,06 %**; gzip 107.490 →
107.590 (+100 B). Los mismos 4 chunks, ningún `modulepreload` nuevo, el SDK de
analítica sigue diferido. La suma de **todos** los chunks bajó 101 bytes: los
arrays de literales dejaron de estar duplicados en el chunk de `duplicar`.

**B-59 · descartado con el número.** La propuesta era mudar la proyección al lado
diferido. Medido contra el mismo build con la instrumentación en no-ops, toda la
instrumentación son 9.058 B (3.126 gzip) de la carga inicial y **la parte que se
iba a mover, 6.522 B (2.188 gzip)**: 2,0 % del payload comprimido. A cambio, la
cola de eventos previos al SDK pasaría a guardar valores **crudos** en vez de
payloads ya sanitizados, o sea contenido del formulario en memoria esperando a un
SDK que un ad blocker puede bloquear. 2,14 kB gzip no paga partir en dos el único
portón sincrónico que hace valer los 11 tests de privacidad (D-99).

**B-36 · descartado.** Un hash del diff no dice **qué** cambió entre dos builds
sucios, solo si son el mismo árbol — y el sello de tiempo ya los distingue.
Además el job de deploy corta si la versión sale `-sucio` o `sin-git`, así que
esas formas son dev-only por construcción.

De paso: **B-56**, **B-92** y **B-118** quedan cerrados (los dos últimos son el
mismo hallazgo anotado dos veces), y el D-60 quedó enmendado — decía que el
vocabulario de campos se deriva del schema "al cargar el módulo", y desde B-09 la
derivación vive en `tests/analytics-campos.test.ts`. Nuevos: **B-165** (la tercera
copia del formato de versión, en el test de privacidad, que no se tocó a
propósito) y **B-171**.

**`novedades.ts` no se toca.** Es "qué podés hacer ahora que antes no podías" en
el idioma de quien carga actividades (D-63), y nada de esto se nota usando el
panel: un enum importado en vez de copiado y una cadena de versión que ahora
llega entera a GA4 no cambian ni una pantalla ni un paso. Lo que cambió es la
calidad de los datos con los que se contestan las preguntas de
[`09-analitica.md`](09-analitica.md), y ese documento sí quedó actualizado.

### Renombrar una etiqueta llega al calendario, y borrar una actividad ya no la pierde

- **B-04** · el evento de Calendar muestra la etiqueta, no el slug (D-11), así
  que renombrar "A la gorra" arreglaba el sitio y dejaba el calendario diciendo
  lo anterior hasta la próxima edición de cada actividad. Ahora
  `rebuildPorOpciones` compara las etiquetas de antes con las de después y
  reescribe los eventos publicados que las usan (**D-93**). La guarda que hace
  esto viable es `mismasEtiquetas`: `/opciones/*` se escribe en **cada** guardado
  del formulario para subir `usos` (§4.2), y eso no es un renombre.
- **B-41** · `guardarVersion` es un `onDocumentUpdated`, así que borrar una
  actividad no dejaba nada que recuperar: era el último agujero de pérdida de
  datos, y el único irreversible. Ahora hay un `guardarVersionAlBorrar`
  (`onDocumentDeleted`) que guarda el documento completo con `borrado: true`, por
  el mismo camino que el trigger de edición — mismo id idempotente (D-43), misma
  retención (D-42). Se descartó el borrado lógico y está escrito por qué
  (**D-94**).

Hay que redesplegar `rebuildPorOpciones` (que además pasó a
`timeoutSeconds: 300`) y desplegar `guardarVersionAlBorrar` junto con
`guardarVersion`: los pasos y las verificaciones están en
[`08-operacion.md`](08-operacion.md).

### El tick del rebuild ya no se come un cambio, y el trigger de reportes no se cuelga

- **B-85** · `dispararRebuild` leía `sistema/rebuild`, hablaba con GitHub (hasta
  15 s) y después bajaba `pendiente` sin comparar. Una actividad guardada en esa
  ventana marcaba su rebuild y el tick se lo llevaba: el build que arrancó no la
  incluía y ya nadie iba a pedir otro. Ahora `registrarExito` recibe la marca
  `actualizado` que el tick leyó y la que hay al escribir, y si difieren deja
  `pendiente` en `true` (el disparo salió bien, así que los reintentos igual
  vuelven a cero). La escritura va en transacción para que la comparación no
  tenga su propia ventana.
- **B-74** · `crearIssue` en `reportes-trigger.js` había copiado las cinco
  cabeceras de la llamada de `index.js` **pero no el timeout** — y el comentario
  que explica por qué hace falta ("sin esto un socket colgado se come el tick
  entero") estaba en una sola de las dos copias. Ahora las dos abortan a los
  15 s, con un test que lo verifica en los dos archivos a la vez.

### Destacar una actividad ya llega al sitio: el rebuild dejó de colgar del sync

**B-83.** `syncCalendar` marcaba `sistema/rebuild` en la última línea, después
de `if (ops.length === 0) return;` y de `if (!CALENDAR_ID) return;`. O sea que
el rebuild era un efecto secundario del sync a Calendar, y los campos que van al
`events.json` pero **no** al evento —`destacado`, `imagenUrl`, `searchText`, el
`slug`— no llegaban nunca al sitio. Sin `GOOGLE_CALENDAR_ID` configurado, no se
publicaba nada.

Ahora se marca al principio, y la condición no es "hubo operaciones de
calendario" sino `huboCambioDeContenido(antes, despues)`: la misma función con
la que el historial decide si guardar una versión (D-41). Eso es lo que hace que
mover la marca arriba no sea a lo bruto — el write-back de `calendarEventId` de
la propia Function produce el mismo contenido editable por construcción, así que
no pide un build por cada sync ni rearma el contador de reintentos (**D-92**).

Los dos `it.fails` de B-83 pasaron a `it`, y se sumaron los casos que cierran la
guarda: el write-back, un guardado que no cambió nada y el borrado.

### Los dos P0 del sync a Calendar: ya no puede haber dos eventos para un encuentro

Los dos caminos que duplicaban un evento en el calendario **público** están
cerrados, y los dos del lado de la Function, que es el lado que no depende de
que el cliente se porte bien.

- **B-82** · `syncCalendar` decide con el payload del evento (`before`/`after`),
  y la entrega de eventos de Firestore es *al menos una vez*: una reentrega
  volvía a emitir `crear`. Ahora **el id del evento lo elige el cliente**,
  derivado del id de sesión (`idDeEvento`), así que el segundo `insert` choca
  con el primero y Calendar contesta 409 en vez de crear un evento nuevo. La
  idempotencia queda en el sistema externo y no en una cuenta que la Function
  tenga que llevar (**D-90**). El 409 se resuelve actualizando ese mismo evento,
  lo que además arregla un caso que antes no tenía salida: un encuentro que se
  despublicó y se volvió a publicar (Calendar reserva el id de un evento
  borrado).
- **B-80** · el write-back del sync reponía `calendarEventId` solo en las ops
  `crear` y `borrar`, así que un guardado hecho desde un listado refrescado
  *antes* del write-back dejaba el campo en `null` y la edición siguiente creaba
  un segundo evento. Ahora se repone en **toda** operación, y solo se escribe si
  algo cambió de verdad (`reponerIds`), así que el caso normal no gasta un
  disparo más de la Function (**D-91**).

La lógica pura del trigger que no es el diff vive en
`functions/sincronizacion.js` — `calendario.js` sigue siendo el diff y lo que
comparte el panel por `@calendario` (D-20).

Los dos `it.fails` de [`tests/costuras.test.ts`](../tests/costuras.test.ts)
pasaron a `it`, y `tests/sincronizacion.test.ts` verifica lo que no se puede
asumir: que los ids que genera el panel caen dentro del alfabeto base32hex que
exige Calendar, y que la derivación no colisiona.

### Cancelar un encuentro de un ciclo ya no renumera a los otros siete (B-84)

La descripción del evento abre con "Encuentro 3 de 8" y `posicionEnCiclo`
numeraba sobre las sesiones **no canceladas**: cancelar el tercero de ocho
convertía al sexto en "Encuentro 5 de 7". El diff emitía siete `actualizar` de
más y —lo que importa— el texto de siete eventos **ya agendados** cambiaba sin
que nada hubiera cambiado para su dueño. No se perdían: eran `actualizar` y no
`borrar`+`crear`, así que los recordatorios sobrevivían.

Ahora se numera sobre **todas** las sesiones, canceladas incluidas (**D-95**). El
número es la identidad del encuentro dentro del ciclo —qué lectura le toca, qué
fila del formulario es—, no un recuento en vivo de los que siguen en pie; el §2.2
le da ese sentido cuando dice que las sesiones son una lista explícita porque
cada encuentro tiene su tema. Y es el criterio que el panel **ya** usaba para el
"2 de 8" de la vista calendario (D-70): antes de esto el mismo encuentro era
"6 de 8" en una pantalla y "5 de 7" en el calendario de la gente. Cancelar toca
ahora un solo evento. La alternativa descartada —posición sobre las no canceladas
con el total original— y el porqué están en D-95.

**La mitad del trabajo fue el test.** "Cancelar un encuentro borra solo el suyo"
pasaba con el invariante roto porque su fixture no era un ciclo: dos sesiones,
sin `esCiclo`, y todas en el mismo instante, así que la numeración no entraba en
juego. Es el patrón de B-84 en su forma pura —un fixture que no ejercita el caso
central del dominio—, el mismo que hizo indetectable a H1 el 22. Los bloques del
diff corren ahora sobre un ciclo de ocho encuentros semanales con su evento cada
uno, los tests de borrar y agregar una fila dejan explícito que renumerar **ahí**
es por diseño (el ciclo cambió de largo) y que nunca es borrar y recrear, y hay
un test en `costuras.test.ts` que **ata** la numeración del panel con la del
evento publicado: separarlas otra vez pone algo en rojo. La vista previa se
compara contra el payload que se le manda a Calendar, no solo consigo misma
(D-20).

Abre **B-160** (agregar o borrar una fila sí renumera: residual asumido, con la
salida anotada por si molesta) y **B-161** (los fixtures que siguen siendo de un
solo encuentro, con el motivo de cada uno).

**En producción los eventos ya publicados no se corrigen solos, y volver a
guardar no alcanza.** El sync compara el payload de antes contra el de después
**calculando los dos con el código nuevo** (§7.1, D-07), así que un guardado que
no cambia nada del evento no genera ninguna operación: un ciclo que hoy tenga un
encuentro cancelado se queda con sus siete eventos diciendo "de 7" hasta que un
cambio que **sí** salga al evento —título, descripción, sede, tema, lectura— los
reescriba. Los ciclos sin cancelaciones producen exactamente la misma descripción
que antes. Anotado como **B-162**.


### Vista calendario del panel, y los ocho hallazgos de auditarla

La vista muestra los encuentros por día con su **estado de publicación** — no el
campo `estado`, sino la pregunta real: *¿esto ya lo ve la gente?*, que depende
del estado de la actividad, de si el encuentro está cancelado y de si su evento
existe de verdad en el calendario. Se deriva con `debeExistir` de `@calendario`,
la misma función que usa el sync (D-71), así que el panel y el calendario
público no pueden separarse. De ahí sale el caso que ninguna otra pantalla
mostraba: un encuentro que **debería** estar publicado y no tiene evento.

El listado suma ordenamiento y filtros, todo en memoria sobre lo que
`listarActividades()` ya trajo — cero lecturas nuevas (§2.5 aplicado al panel).
Cierra **B-96**.

El agente que escribió esto murió antes de commitear y antes de verificar nada;
el trabajo se rescató de su working tree. Auditarlo después encontró ocho
divergencias, ninguna P0 ni P1, y las seis concretas quedaron arregladas:

- **H1** · el listado descartaba encuentros por `inicio` y el calendario por
  `fin`, así que un taller de 19 a 21 desaparecía del listado a las 19:01 —
  justo durante las dos horas en que alguien podría abrirlo. El fixture de los
  tests tenía `fin === inicio`, o sea duración cero, así que la divergencia era
  **indetectable por construcción**: el patrón exacto de B-84. Ahora el fixture
  tiene duración real y hay un test que **ata los dos criterios**, así que
  separarlos otra vez pone algo en rojo.
- **H2** · `desSlug` estaba copiado idéntico en el panel y en la descripción del
  evento. Ahora se exporta de `@calendario` y se reusa (D-20).
- **H3** · el calendario mostraba alarma roja después de **cada** publicación,
  afirmando que el sync había fallado, cuando en realidad estaba en vuelo: el
  write-back del id tarda segundos. En dos semanas esa alarma no se lee más, y
  la vista existe para que se lea.
- **H4** · el aviso de encuentros pasados decía "ya no tiene arreglo" también
  para los que **sobran** en el calendario público, donde las dos afirmaciones
  son falsas y sí hay algo que hacer. Ahora se cuentan aparte.
- **H5** · el orden de tres desplegables lo decidía el orden de llegada de los
  datos, y un test lo cementaba. Los enums cerrados van por su declaración, las
  taxonomías abiertas alfabéticas, y hay un test de que el orden no cambia si
  los datos llegan al revés.
- **H6** · la conversión `Timestamp` → `Date` estaba duplicada en los dos
  módulos nuevos. Es el corazón de la trampa 1: divergir habría hecho que el
  listado y el calendario discrepen sobre **cuáles sesiones existen**, sin
  error. Ahora vive en `sesiones.ts`, que es el hogar de las conversiones.

Más dos detalles: la clase de botón suelta de la grilla pasó a
`claseEnlaceCelda` en el lugar centralizado, y el formulario vuelve al
calendario si se lo abrió desde ahí, en vez de mandar siempre al listado y
perder el mes que se estaba mirando.

Quedan abiertos **B-125** a **B-128** con los límites que la vista no cubre.


## Sin versión — 2026-08-21 · solo documentación

### Diseño del sitio público (B-01)

[`12-sitio-publico.md`](12-sitio-publico.md): mapa de URLs, cada pantalla con su
orden de prioridad visual, el SEO concreto (etiquetas y JSON-LD `Event` /
`EventSeries`), los filtros y cómo se combinan, los casos incómodos, y lo que
falta decidir. **No hay código todavía**: B-01 queda como paraguas y lo
construible es B-105 a B-114.

Tres hallazgos del diseño que valen aparte:

- **`inscripcion.abierta` se congela en el build** y va a decir "abierta" en algo
  que ya cerró (B-111).
- **Una actividad cancelada devolvería 404** en una URL que estuvo indexada y en
  Instagram (B-110).
- **`astro.config.mjs` no tiene `site`**, así que no hay URL absoluta para
  canonical, Open Graph ni sitemap (B-109) — y eso depende de decidir el dominio.

## Sin publicar

### Ideas de producto, con su argumento en contra

Documento nuevo: [`11-ideas-de-producto.md`](11-ideas-de-producto.md). Solo
documentación — no toca código.

Cuatro propuestas pensadas desde el circuito literario y no desde el software, y
**dos descartes con su motivo**: guardar datos de los inscriptos (rompe la única
garantía simple que tiene el proyecto: hoy no guarda datos personales de
terceros) y hacer reusables las sedes y organizadores (pierde contra "Duplicar",
que ya existe).

Anotadas en el backlog como B-95 a B-102. Las dos que menos cuestan usan datos
que ya están cargados: el texto para publicar en redes revive
`difusion.arrobar`, el único campo del §3.1 que se llena y no se usa para nada,
y "esta semana" se deriva de lo que el listado ya tiene en memoria.

## Sin etiquetar

### Diagnóstico medido de la salud del código

Nuevo [`10-salud-del-codigo.md`](10-salud-del-codigo.md): tamaño, concentración,
acoplamiento y duplicación contados sobre el árbol real, no estimados. Sin
cambios en `src/`, `functions/`, `tests/` ni `scripts/` — es solo diagnóstico.

Lo que cambió la forma de mirar el código: el problema no es que haya archivos
grandes (el más grande es el 8,9 % del total, y dos de los tres primeros son
prosa). Es que **1.143 LOC de lógica viven dentro de `.tsx`**, donde no hay
testing-library que las alcance (B-08), y 227 de esas están en
`ActividadFormulario.tsx` junto al caso de uso de guardado.

También quedó medido lo que está sano y conviene no romper: cero ciclos de
import en 62 archivos, y los dos módulos con más fan-in
(`types/actividad.ts` con 19 consumidores, `Campo.tsx` con 12) son hojas con
fan-out 0 — no hay god object.

Diez ítems nuevos en el [backlog](BACKLOG.md), **B-70 a B-79**, todos P2 o P3:
nada está roto y nada de esto bloquea el sitio público (B-01). Los dos con más
filo son B-74 (`crearIssue` copió las cabeceras del cliente de GitHub pero no el
timeout, y el comentario del original explica por qué importa) y B-73 (los tags
no se miden: el vocabulario de analítica declara un valor que el código no puede
producir).



## 1.0.1 — 2026-08-22

### Revisión de las costuras del merge: el título de un reporte ya no filtra mails

Once features se integraron el mismo día, escritas en paralelo. Cada una está
testeada por dentro; lo que nadie había probado es **el par**. Esta pasada buscó
ahí. Salieron trece cosas, en [`BACKLOG.md`](BACKLOG.md) como B-80 a B-92: ocho
con un test que las demuestra en
[`tests/costuras.test.ts`](../tests/costuras.test.ts), y cinco que no se pueden
testear sin render (B-08) o sin los emuladores con Functions, marcadas como
tales.

Se arregló una sola, porque era una línea y no admitía discusión (B-81):

**`construirIssue` no redactaba el título del reporte.** La descripción y los
pasos pasaban por `redactar()` —que tapa mails y links de reunión antes de
publicar— y el título no, que es el `title` del issue: el renglón más visible de
un repo público. Un "No le llega el mail a hola@casabrandon.org" escrito en el
campo "En una línea" salía tal cual, mientras el propio formulario prometía en
pantalla que "si se cuela alguno, el panel lo tapa antes de publicar" (§5.1,
trampa 5).

El resto quedó en el backlog con su test en `it.fails`, que es lo que mantiene el
CI verde y falla el día en que alguien los arregla. Los dos que más importan:

- **B-80 (P0).** El listado se refresca justo después de guardar, o sea antes de
  que `syncCalendar` escriba los `calendarEventId`. Editar desde ese snapshot los
  pisa con `null`, y la edición siguiente vuelve a **crear** el evento: dos
  eventos para el mismo encuentro en el calendario público, y el primero
  huérfano. Es el daño de la trampa 3 por una puerta que la guarda anti-loop no
  cubre — el panel es dueño de un campo que escribe la Function.
- **B-82 (P0).** `syncCalendar` decide con el payload del evento y no con el
  estado del documento, así que una reentrega (la entrega de Firestore es *al
  menos una vez*) duplica el evento. `guardarVersion` y `reporteAIssue` sí se
  blindan; este no.

Y uno que vale por lo que dice del método: **B-83**, el rebuild del sitio se
marca en la última línea de `syncCalendar`, después de dos `return` tempranos.
Un cambio que no altera el evento del calendario —`destacado`, `imagenUrl`— no
pide rebuild, así que no se ve nunca en el sitio. Es la trampa 8 otra vez, con
otro disparador: el rebuild no puede ser un efecto secundario del sync.

### La versión del panel está siempre visible al pie

Pedido del dueño. Al pie de las tres pantallas —login, "sin permisos" y el
panel— se ve la versión corriendo, y si hay una publicada distinta lo dice con
un botón para actualizar.

`useVersionPublicada` hace el fetch y el `reload()`, así que llamarlo desde el
pie **y** desde el aviso habrían sido dos chequeos en paralelo y, en el peor
caso, dos recargas. Ahora lo llama `AdminApp` una sola vez y reparte el estado
por props; `AvisoVersionNueva` dejó de llamarlo.

El pie no es fijo: va al final del contenido. Un tercer elemento fijo, con la
barra de acciones abajo y el aviso de versión arriba, dejaría el formulario de
un teléfono viendo tres franjas y una rendija.


## 1.0.0 — 2026-08-21

Primera versión etiquetada. Cierra los pasos 1, 2, 4 y 5 del orden de
implementación del §10: modelo y reglas, panel de carga, sync a Google Calendar
y trigger de rebuild. **Falta el paso 3, el sitio público**, que es la razón de
ser del proyecto.

Qué hay funcionando:

- **Panel de carga** en `/admin`, con el formulario completo del §11 —
  condicional por tipo, editor de sesiones, taxonomías autogestionadas,
  material— usable desde un teléfono.
- **Sync a Google Calendar** con el diff por id de sesión del §7.2, verificado
  contra el calendario real.
- **Duplicar** una actividad, **vista previa** del evento antes de publicar y
  **coordenadas** de la sede pegando un link de Maps.
- **Historial de versiones** de cada actividad (§12): pisar una descripción
  larga ya no la pierde.
- **Reportes** de bugs y sugerencias del panel a issues de GitHub.
- **Versionado del panel** con recarga al publicar una versión nueva, y
  **analítica** de fricciones sin mandar contenido a ningún tercero.
- **Ayuda dentro del panel** y lista de novedades para la segunda cuenta.
- **460 tests.** La carga inicial del panel bajó de 766 a 380 kB.

Lo que todavía no está desplegado y necesita trabajo manual del dueño está en
[`08-operacion.md`](08-operacion.md): el PAT de GitHub para `dispararRebuild` y
`reporteAIssue`, y el secret de deploy para GitHub Actions.


Todo cambio de código entra acá. Lo más nuevo arriba.

Formato: qué cambió, y cuando importa, **por qué**. Las decisiones de fondo
están en [`06-decisiones.md`](06-decisiones.md); acá va el registro.

---

## 2026-08-21

### Agentes y skills del repo, en `.claude/` · B-115 a B-124

Tres auditores de solo lectura (`auditor-privacidad`, `auditor-trampas`,
`auditor-documentacion`) y cuatro procedimientos como skills (`cerrar-cambio`,
`campo-nuevo`, `al-backlog`, `/que-deployar`). Qué hace cada uno, cuándo se
invoca y qué **no** hace está en [`13-agentes.md`](13-agentes.md), nuevo en el
índice.

**Por qué así:** el criterio fue no duplicar lo que ya verifica un test — un
agente que repite un test da falsa sensación de cobertura. Los tests de este repo
cubren los campos, los archivos y las salidas **que ya conocen**; lo que queda
sin red es el campo nuevo, la salida nueva y el trigger nuevo. El documento dice
explícitamente qué se decidió no automatizar y con qué test se cubre.

**Auditor y no skill** para lo que solo mira (arranca limpio, sin `Write`, se
puede correr en paralelo); **skill y no auditor** para lo que escribe archivos
siguiendo pasos fijos, porque necesita el contexto de la conversación que produjo
el cambio y la aprobación de quien está ahí.

Dos hallazgos reales de la primera corrida quedaron anotados en vez de
arreglados, porque no eran de este cambio: `ReportesPanel` es el tercer chunk
diferido del panel y ningún test lo cuida (B-117), y B-56 dice que nadie llama a
`registrarVersion` cuando `AdminApp` ya lo llama (B-118).

De paso, la lección del formato: las tres descripciones de los agentes tenían un
`": "` sin comillas, lo que hace inválido el YAML del frontmatter y **el archivo
entero se ignora sin ningún error visible**. Se detectó parseando el frontmatter
antes de commitear. Está escrito en el documento porque va a volver a pasar.

No va a `novedades.ts` ni a `ayuda.ts`: no cambia nada de lo que puede hacer
quien carga actividades en el panel.

### Ayuda dentro del panel y novedades para quien no participó de las decisiones · B-60, B-61

**Por qué:** el panel lo usan dos personas. Una pidió cada funcionalidad y sabe
por qué es como es; la otra no participó de ninguna de esas decisiones y hoy se
entera de lo nuevo solo si alguien se lo cuenta. Y el panel cambia seguido: en un
día entraron duplicar, la vista previa del evento, las coordenadas de la sede y
el aviso de versión nueva.

Botón **"Ayuda"** en el encabezado, en todas las pantallas. Abre una **capa** y
no una vista del router (D-61): la ayuda se consulta *mientras* se carga una
actividad, y navegar a otra pantalla desmontaría el formulario con sus 30+
campos cargados a mano. Dos pestañas, un solo botón, porque el encabezado tiene
que seguir entrando en 360px (D-65).

**Guía.** Arriba y sin colapsar, los seis avisos de lo que se hace mal una vez y
no se puede deshacer: la dirección web que queda fija al publicar, el link de la
reunión que solo se publica si se tilda la casilla (y lo que eso significa con
cupo), lo que es interno y nunca sale, cancelar un encuentro, pasar a borrador
—que borra todos los eventos— y el calendario como espejo que no se edita del
otro lado. Después, un capítulo por sección del formulario más el recorrido de
una actividad hasta la gente, el listado, las listas que crecen con "Otro", el
aviso de versión nueva y la carga desde el teléfono.

**No duplica la ayuda de campo**, que ya existe al lado de cada campo y es donde
sirve: la guía es el *para qué* y lo que no se ve. Y el tono no nombra archivos,
secciones del `CLAUDE.md` ni campos del modelo — hay un test que lo verifica.

**Novedades.** El mismo changelog contado como "qué podés hacer ahora que antes
no podías", con la fecha y dónde está en el panel. Vive en el repo y se despliega
con el build (D-63): una novedad existe *porque se publicó código*, así que
"editable sin deploy" no compra nada y sí costaría reglas, tests de integración y
una pantalla de edición que nadie iba a construir — como la de taxonomías que
B-06 pide desde el principio y sigue sin existir. Acá la entrada va en el mismo
commit que la funcionalidad y se revisa con el código.

**El aviso es un número al lado de "Ayuda"** (D-64). Sin ventana que se abra
sola, sin cartel que haya que cerrar: quien está cargando una actividad a las
once de la noche quiere guardar, no enterarse de una mejora. Se apaga al abrir la
pestaña una vez. La marca de "hasta acá leí" es el id de la última novedad vista,
guardado en el navegador; sin marca, todo cuenta como nuevo (la primera vez es la
invitación a leer la lista), y con una marca que ya no existe no avisa nada, que
es el lado prudente del error.

**Contenido como data, no como pantallas** (D-62), y por eso hay tests:
`tests/ayuda.test.ts` **lee `ActividadFormulario.tsx` y falla si el formulario
tiene una sección sin capítulo en la guía** —el mismo recurso de
`tests/opciones-orden.test.ts`—, verifica que los seis avisos sigan explicados y
que no se cuele jerga. `tests/novedades.test.ts` cubre el cálculo de lo no leído
con sus dos bordes, el navegador que no deja guardar datos, y que la fecha no
retroceda un día por interpretarse como medianoche UTC.

**Quién mantiene esto al día:** hay una regla de proceso nueva en
[`05-patrones.md`](05-patrones.md) — si el cambio se nota al usar el panel, entra
en `novedades.ts`; si agrega un comportamiento que no se adivina, entra en
`ayuda.ts`; en el mismo cambio que el código, no después. El test de secciones es
lo que hace que no se pueda saltear en silencio.

El formulario **no se tocó**: el único cambio en código existente son dos líneas
en `AdminApp.tsx` (el import y el botón del encabezado).

### Historial de versiones (B-03, §12)

**Hoy pisar una descripción larga la perdía para siempre**, y era lo más cercano
a pérdida de datos que tenía el sistema. Ahora cada edición que pisa contenido
cargado por una persona guarda el documento anterior en
`/actividades/{id}/versiones/{version}`.

La trampa que el §12 no menciona: `onDocumentUpdated` se dispara con **toda**
escritura, y `syncCalendar` escribe `calendarEventId` de vuelta en `sesiones`
después de sincronizar. Guardar en cada disparo generaría dos versiones por
publicación —el cambio real y el write-back de la Function— y muchas más si
alguien edita ocho veces seguidas mientras el sync corre.

Se resolvió con el mismo criterio que la guarda anti-loop del sync (D-07):
**derivar lo que importa y comparar eso**, en vez de mantener una lista de
campos. Acá lo derivado es el *contenido editable* —el documento sin lo que
escribe la máquina (`updatedAt`, `updatedBy`, `sesiones[].calendarEventId`)— y
el write-back produce un contenido editable idéntico por construcción (D-41).

Tres decisiones que estaban implícitas y quedaron explícitas:

- **Retención por cantidad, no por antigüedad** (D-42): se conservan las últimas
  20 versiones por actividad. Un TTL fallaría justo en el caso de uso real
  ("pisé la descripción hace meses y recién ahora me doy cuenta").
- **El id del documento no es solo el timestamp** (D-43): lleva además el id del
  evento. Dos escrituras en el mismo milisegundo colisionarían y la segunda
  pisaría a la primera — perder una versión es exactamente lo que esto viene a
  evitar. De paso, un reintento del mismo evento reescribe la misma versión en
  vez de duplicarla.
- **Se guarda el documento entero**, incluidos `difusion` y `online.url`. La
  subcolección solo la lee un admin (`firestore.rules`) y las subcolecciones no
  entran en una query de colección, así que no hay camino al `events.json`. Ver
  [`07-seguridad.md`](07-seguridad.md).

**Sin UI todavía**: el historial se recupera a mano desde la consola de
Firestore. Sirve igual —el dato existe, que es lo que faltaba— y cada versión
guarda `camposCambiados` para poder elegir cuál abrir. La UI de restauración
quedó en el backlog (B-40).

La lógica pura está en `functions/historial.js` (36 tests, sin emuladores) y el
trigger en `functions/historial-trigger.js`. De `functions/index.js` se toca una
sola línea: el export.

### Reportar bugs y sugerencias desde el panel, con issue en GitHub

**Pedido:** que la otra cuenta con claim `admin` pueda contar problemas e ideas
sin salir del panel, y que eso llegue a GitHub para poder contestarlo ahí.

Hay una pantalla nueva en `/admin` ("Reportar algo"): tipo (bug o sugerencia),
título, qué pasó, cómo se repite, cuánto molesta, en qué pantalla estaba y —si
aplica— la actividad involucrada. El panel captura además navegador, tamaño de
ventana, ruta, **zona horaria** (sin la zona, un bug de fechas no se diagnostica:
trampa 1) y la **versión del bundle** que estaba corriendo (`VERSION_APP`), que
es lo que permite rebuildear el código exacto del reporte.

**El token de GitHub no está en el cliente.** El panel escribe en
`/reportes/{id}` y una Cloud Function (`reporteAIssue`) crea el issue con el PAT
en Secret Manager. Si el panel llamara a la API de GitHub, el token viajaría en
el bundle de `/admin` y cualquiera podría escribir en el repo — el §5.4 lo
prohíbe.

Es un **trigger de Firestore y no un `onCall`** (D-31): así el reporte queda
guardado antes de que GitHub entre en juego y no se pierde si la API falla; el
número de issue vuelve al panel por `onSnapshot`.

**El repo es público**, así que el issue también (D-32, D-33): no lleva el uid
ni el mail de quien reportó —eso queda en Firestore, que solo leen los admins—,
el texto libre pasa por un filtro que tapa mails y links de reunión, y de la
actividad referida solo sale el título si ya está publicada.

Falta un paso manual del dueño antes de que funcione: crear el PAT, guardarlo en
Secret Manager, dar el permiso a la service account y desplegar la Function y
las reglas. Los comandos están en [`08-operacion.md`](08-operacion.md).

**Limitación conocida:** las respuestas del dueño en el issue no vuelven al
panel. Anotada como [B-30](BACKLOG.md).

### Las etiquetas nuevas esperan aprobación antes de entrar al desplegable de los demás

Ya hay **dos cuentas con claim `admin`** cargando actividades, así que el §4.3
dejó de ser hipotético: si una inventa "Bono social", esa etiqueta no puede
aparecerle sola en el desplegable a la otra. Se implementó `aprobada` en el
patrón de taxonomías — uno solo para los cinco campos (`arancel`, `tipo`,
`barrio`, `plataforma`, `tags`).

Qué pasa ahora con una opción creada con "Otro":

- **funciona sin fricción para quien la creó** — la actividad se guarda con ese
  slug y la opción le queda en el desplegable, marcada "(sin aprobar)" para que
  entienda por qué la otra cuenta no la ve;
- **no aparece** en el desplegable ni en las sugerencias de las demás cuentas
  hasta aprobarla;
- **se sigue mostrando como etiqueta en todas las salidas** — el evento público
  de Calendar dice "Bono social", no "bono-social" (D-30). La aprobación filtra
  lo *elegible*, nunca lo *resolvible*;
- si otra cuenta tipea la misma etiqueta, **se reusa el slug** en lugar de
  duplicar: la deduplicación del §4.2 gana sobre la visibilidad.

**Lo que no se rompe: las opciones que ya están en producción.** Esos documentos
no tienen el campo, y `preparar-produccion.mjs` no los pisa. La ausencia se lee
como **aprobada** (D-26): el default va hacia atrás, no hacia adelante. Si
contara como pendiente, un barrio ya usado desaparecería del desplegable y el
formulario mostraría el slug crudo al editar una actividad que estaba bien.

**El creador se guarda como huella del uid, no como uid** (D-27):
`/opciones/*` es de lectura pública (§5.3) y el §5.1 dice que los uids no salen
al público. Para decidir "¿esta opción la creé yo?" alcanza un pseudónimo opaco.

**Aprobar** es tarea de mantenimiento, no de carga: `scripts/aprobar-opciones.mjs`
(`--listar`, aprobar por campo+slug, `--backfill` opcional). Cualquier cuenta con
el claim puede aprobar, porque las reglas no pueden verificar una autoridad más
fina sobre un array de maps (D-28); la UI en el panel va con la administración de
taxonomías que falta (D-29, B-06).

Tests nuevos: el default de compatibilidad, la visibilidad cruzada entre las dos
cuentas, y el script corriendo de verdad contra el emulador (no una
reimplementación de su lógica). Item B-10 del backlog.

### La pantalla de login del panel ya no baja Firestore (B-09)

**Por qué:** el panel se usa desde el teléfono, a veces con mala conexión, y
había que bajar ~750 KB antes de ver el botón "Entrar con Google". La mitad de
eso era el SDK de Firestore, que recién hace falta **después** de entrar.

Dos cortes en el grafo de imports, sin dependencias nuevas y sin tocar
`astro.config.mjs`:

1. `db()` se mudó de `src/lib/firebase-client.ts` a
   **`src/lib/firestore-client.ts`**. `firebase-client` es el módulo que carga la
   pantalla de login: mientras importaba `firebase/firestore` para `getFirestore`,
   arrastraba el SDK entero al chunk inicial.
2. `AdminApp` carga `ListaActividades` y `ActividadFormulario` con `import()`
   diferido (D-51). Son los que importan Firestore, y nadie los ve sin loguearse
   ni sin el claim `admin`.

Medido con `npm run build`, en `dist/_astro/`:

| Chunk | Antes | Después |
|---|---|---|
| `client.*.js` (React) | 186,6 kB · gzip 58,4 | igual |
| `AdminApp.*.js` | **579,7 kB · gzip 141,6** | **166,1 kB · gzip 36,4** (+ shim de 94 B) |
| `actividades.*.js` (Firestore) | — | 317,7 kB · gzip 80,5 — **diferido** |
| `ActividadFormulario.*.js` | — | 92,6 kB · gzip 24,7 — **diferido** |
| `ListaActividades.*.js` | — | 5,3 kB · gzip 2,4 — **diferido** |
| `index.*.js` (home pública) | 7,8 kB · gzip 3,1 | igual |

**Carga inicial de `/admin`: 766,3 kB → 352,8 kB (−54%); gzip 200,0 → 94,9
(−53%).** La home pública no cambia. La suma de todos los chunks sube 2,0 kB
(+0,3%): es el costo de partirlos, y se paga solo después del login.

Guardas nuevas en `tests/bundle-panel.test.ts`: el corte vive en el grafo de
imports, así que un `import` estático de más lo deshace con el build en verde.
Los tests leen los fuentes como texto y fallan si `firebase-client` vuelve a
tocar Firestore o si `AdminApp` importa las dos vistas de forma estática.


### La app tiene versión, y el panel abierto se actualiza solo

El panel es una SPA estática: alguien puede tener `/admin` abierto durante días
con el JS de una versión anterior, reportar un bug ya arreglado o seguir usando
uno que ya se corrigió.

Ahora el build estampa una versión (`0.1.0+a1b2c3d` — `package.json` + SHA del
commit, D-36), la publica en `/version.json` sin cachear, y el panel la compara
al abrirse, al volver a la pestaña y cada 15 minutos.

Si no coincide y no hay nada en juego, recarga sola. Si el formulario tiene
cambios sin guardar **no recarga**: muestra un aviso fijo arriba, sin botón de
cerrar, y espera a que la persona guarde — son 30+ campos y varios minutos de
trabajo, perderlos es peor que tener el JS viejo (D-37). Al guardar, la recarga
ocurre sola.

Lo que hace que todo esto sirva son las cabeceras de cache, ahora explícitas en
`firebase.json` (D-38): el HTML y `/version.json` no se cachean, y
`dist/_astro/*` —que lleva hash en el nombre— se cachea un año como `immutable`.
Con el HTML cacheado, recargar volvía a pedir los mismos assets viejos y la
detección no servía para nada. `location.reload()` no puede saltear el cache; las
cabeceras son la otra mitad del mecanismo.

La versión se exporta desde `src/lib/version.ts` (`VERSION_APP`, `INFO_VERSION`)
para que la use quien la necesite — un reporte de bug, por ejemplo.

### El formulario captura el punto exacto de la sede (`sede.geo`) · B-07

`sede.geo` estaba en el modelo (§3.1) y `construirLinkMapa` ya lo usaba para que
el link del evento apunte al punto exacto, pero el formulario no lo pedía: era
siempre `null` y el mapa resolvía por el texto de la dirección. Alcanza para una
dirección de ciudad normal y falla en lo que abunda en el circuito literario —
una librería sin numeración clara, un centro cultural dentro de un predio, una
casa en un pasaje.

**Por qué se pega un link y no se geocodifica:** resolver la dirección a
coordenadas es una API paga con otra key, y el budget es de USD 5/mes (D-46). Lo
natural igual es que quien carga ya tenga el lugar abierto en Maps.

Lo que acepta el campo:

- el link largo de Maps: `/maps/place/…@lat,lng,17z/data=…!3d…!4d…` (usa el
  punto del lugar, no el centro de la cámara), `/maps/@lat,lng,z`, y los de
  búsqueda con `?q=` / `?query=` / `?ll=` / `?destination=`;
- un par `lat, lng` pegado directo, que es lo que copia el clic derecho de Maps.

**Los links cortos `maps.app.goo.gl` no** — son un redirect y seguirlo desde el
navegador lo bloquea CORS. Se detectan y el mensaje dice qué hacer, igual que
cualquier otra entrada que no se pueda parsear: el campo nunca falla en
silencio.

El rango se valida en las dos puntas (el parseo al pegar, `schema.ts` al
guardar): una latitud de 200 no existe. Que el punto caiga lejos de Argentina
**no** bloquea, avisa — y si invirtiendo lat/lng caería dentro del país, el
aviso lo dice, porque es el error real. La coordenada se puede quitar para
volver a `null`, y cuando hay una cargada se ve el valor y un link para
verificarla en el mapa.

Para verificar el punto sin publicar: el campo muestra la coordenada con un link
al mapa —el mismo que arma la Function, no uno parecido— y la vista previa del
evento muestra la ubicación y el link de Maps tal como van a salir.

El parseo es un módulo puro (`src/lib/coordenadas.ts`, 27 tests) y la UI un
control aparte (`CoordenadasSede.tsx`); en `ActividadFormulario.tsx` el cambio
son las dos líneas que lo insertan en la sección "Dónde".

### El rebuild del sitio ya tiene quién lo atienda · B-02

El §8 define un lazo cerrado: la Function marca `sistema/rebuild.pendiente`, un
schedule cada 5 minutos manda un `repository_dispatch` a GitHub, y Actions
buildea y publica. La mitad de GitHub no existía, así que `dispararRebuild`
estaba escrita pero sin desplegar (D-13).

**Lo nuevo:** `.github/workflows/deploy.yml`, que responde al
`repository_dispatch` (`types: [rebuild]`) y también corre a mano
(`workflow_dispatch`, la forma de probarlo). Corre los tests, buildea con la
credencial de CI como secret, verifica que `firebase-admin` no se filtró al
bundle, y despliega a Hosting. Cualquier paso que falle corta el deploy: es
mejor un sitio con los datos de ayer que uno publicado a medias.

**No corre con el push a `main`** a propósito (D-22): el disparador del §8 es un
cambio de datos, y para un cambio de código está el botón "Run workflow".

**Bug de fondo arreglado:** la Function leía `process.env.GITHUB_TOKEN` sin
declarar el secreto. En Functions v2 eso es `undefined` en producción — el PAT
solo habría funcionado versionado en `functions/.env`, que es exactamente lo que
el §5.4 prohíbe. Ahora va por `defineSecret` (D-21).

`GITHUB_REPO=benoffi7/agenda-literaria` quedó en `functions/.env` (no es
secreto), y el `client_payload` del dispatch lleva el motivo, así que el run de
Actions dice qué edición lo causó.

**Falta lo que solo puede hacer el dueño** (B-20 del backlog): crear el PAT y
guardarlo en Secret Manager, crear la service account de CI y cargar su key como
secret de GitHub, y recién ahí desplegar la Function. Pasos con comandos en
[`08-operacion.md`](08-operacion.md).

### El rebuild se rinde en vez de golpear cada 5 minutos para siempre · B-13

Si el `repository_dispatch` fallaba, el flag quedaba en `true` y el schedule
reintentaba cada 5 minutos indefinidamente: con un PAT vencido, ~288 llamadas
por día que fallan todas, y ningún rastro de que el sitio estaba viejo más allá
de un log perdido.

Ahora reintenta con **backoff exponencial** (5, 10, 20, 40 minutos) hasta cinco
veces, y deja el estado en `sistema/rebuild`: `intentos`, `ultimoError`,
`ultimoIntento`, `agotado`. Al agotarse loguea un `error` **una vez** — repetirlo
cada 5 minutos sería el ruido que el límite vino a evitar.

**La parte que importa es cómo se vuelve a la normalidad** (D-23). Dos caminos,
y hacen falta los dos: un disparo exitoso resetea el contador, y **un cambio
nuevo rearma los intentos**. Sin el segundo, agotarse sería un estado terminal
que hay que destrabar editando Firestore a mano. Con él, el presupuesto de
reintentos es por cambio y no global: aunque el problema persista, cada edición
gasta a lo sumo cinco llamadas, y cuando el problema se arregla la siguiente
edición publica sin que nadie intervenga.

La lógica (backoff, corte, reseteos) vive en `functions/rebuild.js`, sin Firebase
ni red ni reloj propio, con 20 tests que cubren la secuencia completa: 24 horas
de ticks con GitHub caído son 5 intentos, no 288.

### No se puede publicar con el slug de una copia

Duplicar una actividad propone un slug `…-copia` y lo deja editable. El riesgo
que quedaba: publicar sin corregirlo deja esa palabra en la URL **para
siempre**, porque el slug se vuelve inmutable al publicar (trampa 10) y
cambiarlo después pierde el SEO de esa página.

El schema ahora lo rechaza al publicar, no al guardar. La copia tiene que poder
existir como borrador con ese slug — es como nace.

El predicado vive en `src/lib/duplicar.ts` y lo importa el schema, para no
escribir la expresión regular dos veces. Un test verifica que
`copia-de-seguridad-taller` sí se puede publicar: la regla es sobre el sufijo,
no sobre la palabra.


### Vista previa del evento de Calendar en el panel (B-12)

**Por qué:** la descripción del evento lleva ~20 campos del formulario (D-09) y
la única forma de ver el resultado era publicar y mirar el calendario. El ciclo
publicar-corregir sobre un calendario público es exactamente lo que no conviene
hacer.

Sección nueva al final del formulario, colapsada: se elige el encuentro y se ve
el **título**, la **ubicación** y la **descripción completa** tal como van a
salir.

**Sin duplicar la lógica.** La vista previa importa `construirEvento` de
`functions/calendario.js`, la misma función que corre en la Cloud Function, a
través del alias `@calendario` (D-20). Si armara su propio texto, las dos
versiones se separarían en el primer cambio y la vista previa mentiría — y una
vista previa que miente es peor que no tenerla. De paso, las reglas de
privacidad del §5.1 salen gratis: el link de la reunión solo con `urlPublica`,
la difusión interna nunca, la URL del material privado tampoco.

Las dos adaptaciones que hacían falta viven en `src/lib/vistaPreviaEvento.ts`:

- **Fechas:** el formulario tiene strings de `datetime-local` y la descripción
  espera `Timestamp`. La conversión la hace `formADocumento`, la misma que corre
  al guardar, así que la vista previa ve el documento que se va a escribir.
- **Etiquetas:** la actividad guarda slugs (§4.1). El mapa `slug → etiqueta` se
  arma con las opciones que el panel ya tiene cargadas (`useLabelsTaxonomia`),
  incluidas las creadas con "Otro" que todavía no están en `/opciones/*` porque
  se persisten en el submit (D-02).

La vista previa también **señala** lo que se puede pasar por alto: si el link de
la reunión va a salir publicado, avisa en rojo; si la actividad no está
publicada o el encuentro está cancelado, aclara que hoy ese evento no existe en
el calendario (§7.3), usando el mismo `debeExistir` que el sync.

19 tests nuevos (158 en total), entre ellos que la vista previa no muestra el
link privado de la reunión, la difusión interna ni la URL del material privado.

### Analítica del panel: medir fricción, no visitas

**Pedido:** entender qué hace la gente al cargar una actividad y, sobre todo,
dónde se traba. El formulario tiene 30+ campos condicionales y los dos problemas
que ya aparecieron —el placeholder que se veía como una opción elegida (D-12) y
el zoom de iOS— nadie los vio hasta que el dueño se frustró y los reportó a
mano. La idea es encontrar el próximo antes de eso.

**Ocho eventos** con nombres estables, documentados uno por uno en
[`09-analitica.md`](09-analitica.md), que es la referencia y no una nota al pie:
el valor de esto aparece meses después, cuando alguien mira un gráfico y tiene
que saber qué significaba cada nombre.

Lo que responden, en orden de utilidad:

- `campo_invalido` — **qué campo falla validación y con qué frecuencia**, uno por
  campo para poder rankearlos. El schema ya devolvía los errores por `path`; el
  vocabulario de rutas se deriva del propio schema (D-60), así que un campo
  nuevo se mide solo.
- `formulario_abandonado` — **dónde se abandona una carga**: qué grupos de campos
  quedaron sin completar, cuánto tiempo pasó, si había trabajo adentro.
- `guardado_ok` — **cuánto tarda una carga completa**, y qué forma tiene lo que
  se carga (encuentros, modalidad, material, tags, si se publicó el link).
- `guardado_fallido` — guardados que fallan y por qué, con el motivo
  clasificado.
- `funcion_usada` — **qué funciones se usan de verdad**: el generador de N
  encuentros, "Otro" en las taxonomías, duplicar, los acordeones.
- `panel_abierto`, `formulario_abierto`, `validacion_fallida` — los
  denominadores.

Todos los eventos llevan `dispositivo` (mobile / tablet / escritorio) y `ancho`,
que es la mitad del análisis: el bug del zoom de iOS solo se ve comparando
mobile contra escritorio.

**Nada de esto lleva contenido, y no depende de acordarse de filtrar.** La
proyección (`src/lib/analytics-eventos.ts`) es una whitelist en las dos
direcciones: un evento no declarado no manda nada, un parámetro no declarado se
descarta, y **no existe un sanitizador de texto libre** — entero, booleano, enum
cerrado, o ruta de campo del schema. Un `medir()` que pase el formulario entero
produce un payload vacío, no una fuga (D-56). Es el mismo criterio del §5.2 y de
`toPublic.ts`, un paso más estricto porque el destino es un tercero.

`tests/analytics-privacidad.test.ts` lo verifica como se verifica el link de
Zoom en el calendario: llena un formulario con centinelas en cada campo de texto
—incluidos el link de la reunión, la difusión interna, el uid y el mail del
admin—, los mete como parámetros de cada evento declarado, y busca los
centinelas en el payload. Además prueba **cada parámetro de cada evento** uno por
uno, así que un parámetro futuro que acepte texto libre rompe el test sin que
haya que acordarse de escribirle un caso.

Las dos personas que cargan se distinguen por un identificador **aleatorio** del
navegador, no por el uid ni por un hash del mail: con dos admins conocidos, ese
hash se revierte probando dos entradas (D-57).

**No engorda el chunk inicial del panel más que su propio código.**
`firebase/analytics` entra por un `import()` dinámico disparado al idle: queda en
un chunk propio de 34.5 KB (7.3 KB gzip) sin `modulepreload`, que no se descarga
hasta que el panel está interactivo. La instrumentación en sí suma 11.2 KB
(2.8 KB gzip). El bundle del sitio público no cambió ni un byte (D-58).

**No se mide en desarrollo** (con `PUBLIC_USE_EMULATORS=true` no sale nada, y los
tests corren con ese flag) y **un fallo de analítica no rompe el panel**: si un
ad blocker bloquea el `import()`, la cola se descarta y el formulario sigue
igual.

En los componentes el cambio es mínimo: una llamada por punto de medición. Toda
la lógica vive en archivos nuevos (`analytics-eventos.ts`, `analytics.ts`,
`useMedicionFormulario.ts`).

**Lo que quedó sin medir**, para no refactorizar nada: el embudo campo por campo
(exigiría instrumentar 30+ inputs), y dos casillas que están en `onChange`
inline del JSX. Está en el backlog ([B-58](BACKLOG.md)).


### Duplicar una actividad entera · B-11

**Pedido:** un ciclo nuevo suele ser el del año anterior con otras fechas, y
cargarlo de cero son 30+ campos.

En el listado, cada fila tiene ahora un menú "⋯" con "Duplicar", que abre el
formulario precargado con una copia para editar y guardar como actividad nueva.
"Borrar" se mudó a ese mismo menú (D-19).

La lógica de la copia es pura y vive en `src/lib/duplicar.ts`, aparte de
Firestore: acá un bug corrompe los eventos de calendario del **original**. Lo
que la copia no hereda:

- **Los ids de sesión.** Se generan de nuevo con `nuevaSesionId()`. Dos
  actividades compartiendo ids de sesión rompen el diff del §7.2: es la llave
  con la que la Function decide qué evento crear, actualizar o borrar.
- **`calendarEventId`**, que queda en `null` en todas las sesiones. Los eventos
  del original existen en el calendario; los de la copia no. Heredarlos haría
  que editar la copia modifique o borre eventos del original.
- **El slug**, que se propone como `slug-original-copia` y sigue editable
  (D-18).
- **El estado**: la copia arranca en `borrador`, así que no manda nada al
  calendario hasta que el usuario la revise y publique (§7.3).
- **`createdAt`/`createdBy`**, que son de la copia: se guarda por el camino de
  creación, no por el de edición.
- **La cancelación de un encuentro**, que es una excepción del ciclo original
  ("ese martes no hubo"), no una propiedad del ciclo nuevo.

**Las fechas se corren en semanas enteras** hacia adelante, conservando el día
de semana, la hora, las duraciones y los huecos irregulares del ciclo (D-17).
Se corre también el cierre de inscripción, que si no dejaba la copia con la
inscripción cerrada.

El formulario avisa arriba que es una copia y nombra los tres campos a revisar
antes de publicar: título, slug y fechas.

**Tests:** 21 nuevos. Los cuatro invariantes que importan (ids nuevos,
`calendarEventId` en `null`, estado borrador, slug distinto) están cubiertos
como lógica pura y otra vez de punta a punta contra el emulador, verificando que
el documento del original quede intacto.


### `arancel` vuelve a obligar a elegir

D-12 había dejado un riesgo abierto: al preseleccionar la primera opción en
todos los campos con opciones base, `arancel` arrancaba en "Gratis". Un taller
pago que nadie corrige se publicaba como gratuito, en el sitio y en el
calendario público.

Decisión del usuario (D-16): `arancel` es la excepción y obliga a elegir. `tipo`
y `plataforma` siguen preseleccionando, porque ahí equivocarse se ve y se
corrige.

Hay un test que verifica que el atributo no vuelva a aparecer en ese campo — lee
el fuente, que es poco ortodoxo, pero es la forma de que un copy-paste
distraído entre campos vecinos no revierta la decisión en silencio.


### El checkbox "publicar el link de la reunión" ahora hace algo

El modelo del §3.1 tiene `online.urlPublica` y el formulario su casilla, pero la
proyección pública y la descripción del evento descartaban la URL sin mirar el
flag: el formulario prometía algo que no pasaba.

Decisión del usuario: **respetarlo** (D-15). Es un desvío del §5.2 y del §7.4,
que lo descartan sin condición.

Lo que se mantiene y hace aceptable el desvío: el default sigue en `false`, el
formulario advierte sobre el zoombombing en el propio checkbox, y sin URL
cargada no se inventa el campo aunque el flag esté en true.

También se cerraron dos decisiones sin trabajo asociado: la home se deja
indexable con el placeholder, y los eventos de prueba los borra el usuario.

### Documentación del proyecto

Carpeta `docs/` con arquitectura, inventario de infraestructura, modelo de
datos, funcionalidades, patrones, decisiones, seguridad y operación. Más este
changelog y el [backlog](BACKLOG.md).

Se incorporó como regla de proceso que **cada pedido de funcionalidad, arreglo o
modificación de código termina con la documentación actualizada**, y que **todo
reporte de posible bug va al backlog ordenado por prioridad**. Está en
[`05-patrones.md`](05-patrones.md) para que la herede cualquiera que retome el
proyecto.

### La descripción del evento lleva todo lo publicable · `90edc8a`

**Pedido:** que el evento de Calendar tenga toda la info del formulario, y que
la dirección sirva para Google Maps.

Antes el evento llevaba solo título, descripción y la calle. Ahora lleva
modalidad, sede con "cómo llegar" y link al mapa, plataforma, arancel con notas,
inscripción con vía/cupo/cierre, material, organizador, tallerista con bio, tags
y la posición en el ciclo ("Encuentro 3 de 8", numerada por fecha y no por
posición en el array).

Sigue afuera lo que prohíben el §5.1 y el §7.4: el link de la reunión, la
difusión interna, la URL del material privado y los uids.

**Bug arreglado:** la ubicación mandaba solo `sede.direccion` ("Drago 236"), sin
ciudad ni país. Google no tenía con qué desambiguar y el evento quedaba sin mapa
o con el mapa en otra ciudad. Ahora se arma con sede, calle, barrio, ciudad y
país, sin repetir un valor cargado en dos campos.

**Cambio de fondo (D-07):** la guarda anti-loop pasó de una lista de campos
mantenida a mano a comparar el payload del evento antes y después. Al pasar la
descripción de 3 campos a ~20, esa lista era una bomba de tiempo: agregar un
dato sin agregarlo a la lista dejaba de propagar ese cambio, en silencio.

Los slugs de taxonomía se resuelven a su etiqueta contra `/opciones/*`, con
des-slug de respaldo (`"parque-chas"` → `"Parque Chas"`) porque el calendario es
público y el slug crudo se ve roto.

Verificado leyendo el ICS del calendario real. 60 tests sobre el módulo.

### Sync a Google Calendar · `af88f84`

Paso 4 del §10. Functions v2 en `southamerica-east1`, al lado de Firestore.

`functions/calendario.js` no importa Firebase ni googleapis: el diff es la parte
frágil del sistema y aislarlo permite testearlo sin emuladores ni tocar un
calendario real.

Las tres trampas del §13 que viven acá: la guarda anti-loop (§7.1), el diff por
id de sesión y nunca por índice (§7.2), y la propagación de un cambio de sede a
las N sesiones del ciclo (trampa 9).

**Desvío (D-06):** la Function corre **como** `calendar-sync@` en vez de
autenticar con una key. No queda ninguna key para guardar ni rotar. Costo: hay
que otorgar a mano tres roles que la service account por defecto trae de fábrica
— por eso el primer deploy falló dos veces.

Verificado contra producción: crea un evento por sesión, la guarda anti-loop
corta la recursión en la segunda pasada (4 ejecuciones, 2 eventos), un cambio de
sede actualiza los dos encuentros, y despublicar los borra y limpia los ids.

Infra: Blaze habilitado, budget de USD 5/mes con avisos al 50/90/100%, política
de limpieza de imágenes a 1 día, service account `calendar-sync@` con sus cinco
roles, Calendar API habilitada.

### Formulario mobile y arreglo de los desplegables · `2fab7ef`

**Bug reportado:** al guardar aparecía "Elegí el arancel" sobre un formulario que
parecía completo.

**Causa:** el placeholder se renderizaba como el primer `<option>`, que vale
`""`, y los textos eran ejemplos ("Gratis, a la gorra…", "Taller, club de
lectura…"). El campo se veía idéntico a uno ya elegido. Pasaba en los cuatro
desplegables, no solo en arancel.

**Arreglo:** los placeholders se leen como instrucción, y `arancel`, `tipo` y
`plataforma` preseleccionan la primera opción (D-12). `tests/opciones-orden.test.ts`
fija cuál es el default de cada campo para que un reordenamiento no lo cambie en
silencio.

**Mobile y tablet:**

- Campos a 16px hasta `sm`. **iOS Safari hace zoom** sobre la página al enfocar
  un input de menos de 16px y después no vuelve solo.
- `viewport-fit=cover` con `env(safe-area-inset-*)` en la barra fija, que en un
  iPhone quedaba debajo de la barra de gestos.
- Blancos táctiles de 44px, solo cuando el puntero es grueso.
- Lo que no cabe en 360px pasa a columna.
- El resumen de errores de la barra fija se reduce a un contador: cuatro rutas de
  campo tapaban media pantalla.
- Teclados por campo, y sin autocapitalizar en slug, handles y URLs.
- El encabezado del acordeón pasó a `<button>`: se abre con teclado y lo anuncia
  el lector de pantalla.

### Deploy del panel a Firebase Hosting · `384ac32`

Firestore creado en `southamerica-east1` (**región irreversible**), reglas e
índices desplegados, panel publicado en https://agenda-literaria.web.app/admin
con `noindex`.

La config del SDK web quedó versionada en `.env.production` (D-08): no es
secreta, viaja en el bundle por diseño, y así el deploy no configura nada.

`scripts/preparar-produccion.mjs` siembra `/opciones/*` de forma idempotente y
deja el claim `admin` en las cuentas que cargan. Usa las ADC de gcloud, sin
bajar ninguna key.

Verificado en producción: la escritura anónima a `/actividades` y a `/opciones`
se rechaza, y la lectura de `/opciones` funciona sin auth porque la necesitan
los chips de filtro del §4.4.

### Modelo, reglas, emuladores y panel de carga · `9a45c86`

Pasos 1 y 2 del §10. Modelo del §3 en TypeScript, reglas del §5.3, emuladores, y
el formulario completo del §11: condicional por tipo, editor de sesiones con ids
uuid, taxonomías autogestionadas con autocompletado, y material.

Decisiones: sin librería de formularios (D-01), las etiquetas de "Otro" se
persisten en el submit (D-02), las opciones base en un JSON compartido con los
scripts (D-03), la regla de lectura suma `|| esAdmin()` (D-04).

**Bug encontrado por un test:** las reglas usaban `request.auth.token.admin`.
Leer una clave ausente de un map en las reglas es un *evaluation error*, no
`false`, así que cualquier usuario sin el claim hacía fallar la regla (D-05).

Cobertura de las trampas del §13: ids de sesión por uuid, `Timestamp` y no
strings, slugify de taxonomías, y la proyección pública que no filtra el link de
la reunión, la difusión ni los uids.
