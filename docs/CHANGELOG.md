# Changelog

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
