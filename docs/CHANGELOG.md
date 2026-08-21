# Changelog

## 1.0.1 — 2026-08-22

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
