# Changelog

## 2026-09-03 · el tablero pasa a pestañas — «El catálogo» y «El sitio público» — B-501, B-502

El dueño pidió tres cosas para el tablero «Estado del catálogo»: pestañas en
vez de una página larga, la mitad que falta (el sitio público, hoy sin medir)
y arreglar el aviso «ya pasó». Esta entrada cubre las dos primeras.

**Pestañas internas**, con el patrón WAI-ARIA de tabs (`tablist`/`tab`/
`tabpanel`, roving `tabIndex`, flechas que mueven el foco y activan la pestaña
en el mismo gesto, `Home`/`End`) — la navegación por teclado que `CentroAyuda`
todavía no tenía. «El catálogo» reorganiza lo que ya existía: los avisos
siguen arriba a todo lo ancho, pero «Lo que se publica» y «Qué hay cargado»
pasan a ir lado a lado desde pantallas grandes en vez de apiladas (D-271).

**«El sitio público»** es la mitad nueva del pedido — vistas, páginas más
vistas, clics en inscripción, filtros que dan cero — y **no trae un solo
número inventado**: esa lectura de Google Analytics es B-374 y todavía no
existe. La pestaña muestra la estructura de lo que va a aparecer, agrupada
igual que `docs/16-analitica-del-sitio.md` §2, con la fecha exacta desde la
que hay algo que medir (3 de septiembre de 2026) y qué falta para que deje de
estar vacía. Es un estado vacío deliberado, no un error (D-272).

Tests nuevos con DOM real: `tests/estadisticas-pestanias.render.test.tsx` —
qué panel se muestra al hacer click y al navegar con las flechas, y el roving
`tabIndex` —, con mutación probada.

## 2026-09-03 · el aviso «ya pasó» del tablero deja de sonar a fricción — B-500

El dueño lo marcó textual: «los eventos siguen publicados como archivos, no
entiendo el aviso». Tenía razón — que una actividad publicada siga publicada
después de pasar es el comportamiento correcto (se convierte en archivo,
`/pasadas`, §2.1 del `CLAUDE.md`), no algo roto. El título pasa de «Publicadas
a las que no les queda ningún encuentro» a «Terminaron y pasaron al archivo», y
el texto dice la única acción real: si es un ciclo que vuelve, cargar las
fechas nuevas; si fue una actividad única, no hay nada que hacer. También se
movió al final de la lista de avisos por gravedad — ya no es una fricción
urgente. **El filtro que decide qué actividad se señala no se tocó**: el
criterio ya era correcto (D-270).

## 2026-09-03 · la caja de suscripción de la home, despegada de «Mes por mes»

El bloque «Llevate la agenda a tu calendario» caía pegado a la última fila de la
tira «Explorá por». `SuscribirseResumen` no trae margen propio —se reusa en
`/suscribirse`, donde no lo quiere— así que la separación va en el sitio de uso,
con el mismo `mt-12 sm:mt-16` que `ExploraPor` ya usa sobre el listado (B-482).

Nota de producto, no de código: en «Mes por mes» aparece solo septiembre porque
es el único mes con **3 o más** actividades (§2.2, `MINIMO_DE_ACTIVIDADES`).
Octubre tiene 2 y noviembre 1, y por eso no generan página. Es la regla vigente,
no un dato faltante.

## 2026-09-03 · GA4 configurado en la consola: B-480 y B-372 cerrados

El dueño completó el paso manual que bloqueaba la analítica. En el flujo `G-9CFMHSSGRC`
del Enhanced Measurement quedaron apagados **«Búsquedas en el sitio»** (mandaba el texto
del buscador) y **«Clics salientes»** (mandaba el destino real del botón de inscripción),
más **los `page_view` por cambio de historial** —el buscador reescribe la URL con
`replaceState` en cada filtro, así que cada toque contaba una vista con `q` en la URL—, y
en «Ocultar datos» se agregó la clave **`q`** al borrado, que es la red que aguanta
cualquier camino futuro. Con esto **B-372 y B-480 quedan cerrados**; el tag mide en
producción con el próximo deploy. Queda abierto de la analítica solo B-373 (Search Console,
diferido por el dueño) y B-374 (espera un mes de datos).

## 2026-09-02 · la portada del detalle también pinta la miniatura — B-321

**La objeción que traía el ítem no se sostuvo, y por eso terminó siendo
mecánico.** B-321 decía que la miniatura de 480px podía verse «blanda» en la
portada del detalle en una pantalla retina, porque ahí la imagen es
`loading="eager"` (el LCP de la página) y no un afiche chico de una pared. La
razón para dudar era real, pero el mecanismo de selección de candidatos del
navegador ya la cubre: con dos candidatos en el `srcset` —la miniatura y el
original de 1600px, nunca solo la miniatura— el navegador compara la densidad
de cada uno contra el `devicePixelRatio` real del dispositivo. A 1× la
miniatura alcanza y se elige (downscale, se ve bien); a 2× o 3× su densidad
queda por debajo de lo que el dispositivo pide y el único candidato que la
alcanza es el original, así que el navegador cae ahí solo. La miniatura nunca
se estira: eso solo pasaría si el original no estuviera en la lista, y siempre
está. No hizo falta ninguna variante nueva (900px u otra intermedia) ni tocar
`functions/`.

`src/pages/actividad/[slug].astro` deriva `urlDeMiniatura(portada.url)` en el
frontmatter (cálculo de presentación, igual criterio que `estiloDeAfiche`, sin
agregar un campo a `DetallePublico` ni al barrido de salidas públicas) y el
`<img>` de la portada usa el mismo `srcsetDeMiniatura` que `cartelera.astro`
(B-320).

## 2026-09-02 · la cartelera por fin pinta la miniatura — B-266 resuelto del todo

**B-320.** `src/pages/cartelera.astro` pedía el original de cada flyer aunque la
Function de B-220 ya derivaba una miniatura de 480px, probada y sin consumidor
desde el 2026-09-02. Ahora el `<img>` de cada afiche lleva `srcset` con la
miniatura como candidato chico y el original —**siempre**— como `src` y como
candidato grande: una imagen subida antes de que la Function estuviera
desplegada no tiene miniatura todavía, y un `srcset` cuyo candidato no existe
degrada solo al `src` (un `src` apuntando a la miniatura degradaría a imagen
rota). Para las externas (DEC-7d no las toca) `urlMiniatura` es `null` y el
atributo sale ausente.

Medido sobre las 30 imágenes de producción: recorrer la pared entera pasa de
**3518,5 KB a 1032,4 KB (−71 %)**. Con esto, **B-266 queda resuelto del todo** —
era la única pieza que le faltaba desde que se cerró la Function.

**Y el `auditor-trampas` encontró un B-88 de paso:** el `480w` del descriptor
era un literal copiado a mano, sin nada que lo atara al `ANCHO_MINIATURA` real
de `functions/imagenes.js` — el que `sharp` usa para producir el archivo. Ahora
`src/lib/imagenes.ts` exporta su propio `ANCHO_MINIATURA` y `LADO_MAXIMO` (mismo
patrón que `CACHE_AL_SUBIR`/`CACHE_OPTIMIZADO`), atados a los de la Function por
`tests/imagenes-function.test.ts`.

**Y el `auditor-privacidad` encontró un segundo problema, real aunque no de
fuga:** el candidato grande del `srcset` era `afiche.url` crudo, interpolado en
el markup — una coma en esa URL (el schema no la prohíbe) partiría la lista de
candidatos. Se movió la composición a `srcsetDeMiniatura` en
`src/lib/imagenes.ts`, una función pura que blinda el caso y que ahora usan las
dos plantillas con imágenes (`cartelera.astro` y `[slug].astro`, ver B-321 más
abajo), probada por valor en `tests/imagenes.test.ts`.

**Y un tercer hallazgo, en la red y no en el código:** el `for` de
`tests/barrido-de-salidas-publicas.test.ts` que afirma «todo lo que la pared
publica ya lo publicaba el detalle» saltaba `urlMiniatura` en silencio —el
fixture de centinelas no es una URL real, así que el campo daba `null` y nunca
ejercitó la rama que importa—. Se saltea ahora **por nombre**, con un test
nuevo que sí usa una URL real y verifica que la miniatura es una derivación
pura del original, sin token.
## 2026-09-02 · segunda tanda de deuda de tests, doc e infra

### D-201 escrita — la cita huérfana de la analítica del sitio

`docs/16-analitica-del-sitio.md` citaba **D-201** dos veces sin que existiera: el
frente de analítica se cayó antes de escribirla. Se redactó con el argumento que
el propio documento ya traía —GA4 como la vara que un anunciante conoce— sin
agregar razones nuevas, y dejando explícito qué **no** decide (B-371 y B-376
siguen esperando al dueño).

### B-205 — un push que no deploya ya se repara solo en el siguiente

`decidir` (el primer job de `push-main.yml`) diffeaba contra
`github.event.before`, el head del push anterior. Si esa corrida no llegaba a
deployar nada —falló al arrancar, se canceló, un `major_outage` de GitHub
Actions como el del 2026-08-26—, el push siguiente diffeaba desde un commit
que ya estaba en `main` pero nunca se había publicado, y esos cambios
quedaban fuera del diff **para siempre**, sin ningún síntoma de este lado.

Ahora `decidir` prefiere lo que `/version.json` dice publicado de verdad
(`INFO_VERSION.sha`) y solo cae al `before` del push cuando esa fuente no
sirve. La decisión pasó a `scripts/commit-base-deploy.sh`, con
`tests/commit-base-deploy.test.ts` cubriendo las cinco formas en que la fuente
preferida puede fallar y el caso feliz, contra un servidor de mentira y
commits reales del propio checkout. Dos mutaciones probadas y restauradas:
deshacer la preferencia por lo publicado, y saltear la validación contra el
historial — las dos tiran rojo.

Actualizado `docs/08-operacion.md`: la fila de troubleshooting de
`startup_failure` y la nota sobre qué hace `workflow_dispatch` sin el checkbox
de "deployar todo".

### B-215 — reverificada la adopción de `tests/fixtures/`: el número creció, no bajó

Sin tocar código de test — el cambio ancho sigue sin ser seguro con cuatro
frentes corriendo en paralelo (B-236), que es la misma precondición que el
ítem ya pedía. Reverificado el estado real: `actividadCentinela` pasó de un
consumidor a cuatro (adopción orgánica, efecto lateral de otro trabajo), pero
los archivos que siguen construyendo su propia actividad de ciclo a mano son
más que los siete originales — al menos una docena. Documentado en
`docs/BACKLOG.md` para que la próxima medición no vuelva a partir de un
número de hace una semana.

### B-236 — `scripts/wip.sh`, la alternativa a `git stash` que no cruza worktrees

`git stash` vive en `refs/stash`, del repositorio y no del working-tree: con
varios frentes en paralelo, un `pop` puede traerse encima el trabajo de otro
worktree — pasó dos veces el 2026-08-27/28, la segunda sin conflicto (el modo
malo). `scripts/wip.sh guardar` deja el árbol limpio con un commit temporal
—por-worktree de verdad— y `restaurar` lo deshace, verificando antes que el
HEAD sea un commit del propio script.

`tests/wip.test.ts` corre contra un repo git temporal, con seis casos.
Mutado: sacar la verificación del mensaje en `restaurar`, y sacar el chequeo
de árbol limpio en `guardar` — las dos tiran rojo, restauradas después.

Nueva regla en `docs/14-plan-de-saneamiento.md` (punto 7 de "Regla para
cualquiera que ejecute una fase") que nombra el mecanismo y el helper.

### B-08 — el dueño aprobó el camino angosto: testing-library, solo para MenuAcciones

Instalados `@testing-library/react`, `@testing-library/dom`,
`@testing-library/user-event` y `jsdom`, con `environmentMatchGlobs` en
`vitest.config.ts` acotado a `tests/**/*.render.test.tsx` — el resto de la
suite sigue en `environment: 'node'`.

Se hizo el único caso que el relevamiento de B-08 identificó como genuino:
`tests/menu-acciones.render.test.tsx`, contra `MenuAcciones` renderizado de
verdad (no leyendo el fuente con regex, que es lo que hacía
`tests/foco.test.ts` hasta ahora). Cubre cierre por clic afuera —con control
negativo—, cierre por `Escape` con el foco devuelto al "⋯", y abrir con ↓
enfocando el primer ítem.

Mutadas las cuatro aserciones contra el componente real, una por una: sacar
el `focus()` de vuelta, comentar el listener de clic afuera, invertir la
condición de "adentro/afuera", e ignorar la tecla al abrir. Las cuatro dieron
rojo, restauradas después. De paso se corrigió el propio test: la primera
versión de "Escape devuelve el foco" pasaba con la mutación adentro porque el
foco nunca se había movido del disparador — se agregó un paso que lo mueve a
un ítem primero.

Los otros tres candidatos del relevamiento quedan sin tocar, como correspondía:
son preguntas puras o algo que jsdom no puede medir (el scroll sin layout
real). Actualizados `docs/05-patrones.md`, `docs/10-salud-del-codigo.md` y
`docs/06-decisiones.md` donde afirmaban que testing-library no estaba
instalada.

### B-345 — cinco citas de D-100 que eran D-111, encontrada una tercera al buscarlas

`docs/BACKLOG.md` (cuerpos de B-72 y B-177) seguía citando D-100 para «primero
la actividad, después las etiquetas nuevas», que es D-111 — D-100 es otra cosa
(`taxonomia.ts`). Corregidas las dos, y de paso apareció una tercera en
`docs/CHANGELOG.md`: la propia entrada que anunciaba haber corregido las tres
apariciones nuevas del cruce («D-187, `04-funcionalidades.md` y este
CHANGELOG: los tres corregidos») no había tocado la de este mismo archivo.
Verificado que D-187 y `04-funcionalidades.md` sí decían D-111.

Dejadas sin tocar, a propósito, las citas correctas de D-100 (su tema real) y
dos citas de un tercer patrón sin D-número propio (B-50, B-35) que no encajan
en ninguno de los dos casos de este ítem — inventarles un número habría sido
el mismo error al revés.

### B-354 — «las once trampas del §13», corregido y ahora con red

`docs/13-agentes.md:178` decía «las once trampas» cuando el §13 tiene trece
desde que se sumaron la 12 y la 13. Corregido a «trece», y agregado el
chequeo que faltaba (copiando el patrón de B-216 en
`tests/agentes-y-skills.test.ts`): `tests/mapa-de-trampas.test.ts` compara «N
trampas» en la prosa contra `TRAMPAS_DEL_CLAUDE_MD.length`, que ya se leía del
§13 para otra cosa.

Mutado: volver a escribir «las once trampas» tira rojo el caso nuevo,
restaurado después.

### B-364 — los tres 120 del título de un reporte pasan a ser un solo límite

`firestore.rules`, `reporte-schema.ts` y el `maxLength` de
`ReporteFormulario.tsx` decían 120 cada uno por su cuenta. Nació
`TOPE_TITULO_REPORTE` (`src/types/reporte.ts`) y los dos primeros lo importan;
`firestore.rules` no puede (es otro runtime), así que ese lado lo ata
`tests/clases-de-bug.test.ts` leyendo el número de la regla con una regexp y
comparándolo contra la constante. El `.slice(0, 200)` de `functions/reportes.js`
y el límite de 256 de GitHub quedan sin atar a propósito: son otra cosa.

Tocado al mínimo `src/components/admin/ReporteFormulario.tsx` (un import y un
valor) — archivo de otro frente, un solo `maxLength` cambiado.

Mutado en dos direcciones: subir el número de las reglas sin tocar el resto, y
volver a escribir `120` a mano en el schema. Las dos tiran rojo, restauradas
después.

### B-352 — el helper de sesiones de `calendario.test.ts` ya no describe un estado imposible

`sesionesSemanales` asignaba `calendarEventId: evt_<i>` incluso a las
sesiones que un caso marca `cancelada: true`, algo que el sistema no puede
tener asentado (al borrar el evento, `syncCalendar` repone `null`). Ahora
pone `null` por default en ese caso, con `{ enTransicion: true }` para el
único momento real en que conservarlo vivo es correcto — recién cancelada, un
instante antes de que el sync corra. El fixture de B-162 perdió el
`calendarEventId: null` que había que pasarle a mano.

Mutado: volver al comportamiento viejo tira rojo cuatro tests de la describe
de B-162 (la guarda emitiendo un `borrar` de más al reusar el fixture como
las dos puntas de un diff). Restaurado después. De paso se verificó, en vez
de suponerse, que el único test de transición existente no depende del valor
puntual — `planificar()` resuelve el id desde `antes` primero — así que se
dejó `enTransicion: true` igual, por precisión del fixture y no porque algún
aserto lo necesite hoy.

### B-363 — `contexto.pantalla` deja de ser el único enum sin acotar en `reporteValido()`

`desSlug()` (`functions/reportes.js`) reemplaza `-` por espacios en
`contexto.pantalla` y `severidad` ANTES de que el saneador vea el texto, y eso
le desafina el patrón de `LINK_REUNION` — un link de reunión con guion en el
dominio sobreviviría legible. `severidad` ya estaba acotada por valor en las
reglas; `contexto.pantalla` no. Ahora `reporteValido()` (`firestore.rules`)
exige que valga una de las cinco pantallas reales, con `.get('pantalla',
'listado')` porque `contexto` no fuerza esa clave con `hasAll`.

`tests/reportes.integracion.test.ts` suma los dos casos contra el emulador:
el propio ejemplo del ítem rechazado, y las cinco pantallas reales aceptadas.
Mutado: sacar la línea nueva de las reglas tira roja la primera prueba.
Actualizado `docs/07-seguridad.md`.

### B-367 cerrado como duplicado de B-294, con el chequeo que faltaba — y B-460

B-367 describía exactamente el bug que B-294 ya había arreglado horas antes
(commit `c9dec65`, mismo día): filas fusionadas con `||` y triplicadas en la
tabla «no automatizar» de `docs/13-agentes.md`. Verificado de nuevo antes de
cerrar: hoy la sección no tiene `||`, ninguna fila sin `|` inicial, y ninguna
celda de la primera columna repetida. Se agregó `tests/red-de-contencion.test.ts`
con las tres reglas que B-367 proponía y B-294 había dejado sin escribir,
mutado contra la fusión real de B-294 y contra una fila duplicada — las dos
tiran rojo.

**Y de paso, B-460**: el párrafo de cierre de B-293 (la decisión D-180) había
migrado al medio del bloque de B-294 en `docs/BACKLOG.md` — la misma clase de
daño de merge que B-367 describía, pero en el archivo que registra los bugs,
no en el que B-367 auditaba. Corregido: el párrafo vuelve a su lugar, sin
tocar el resto de ninguno de los dos bloques.

### B-344 cerrado — ya estaba resuelto, verificado y no solo leído

El guard de Auth para los tests de integración (`emuladorAuthVivo()`) ya existía
como efecto lateral del arreglo de B-365, y los cuatro archivos que lo
necesitaban ya lo usaban. Se verificó apagando el emulador de Auth a mano
(puerto muerto con Firestore arriba): el guard combinado da `false` y los cuatro
`describe.skipIf` saltean en vez de fallar rojo. Se cerró en el backlog con esa
evidencia.
## 2026-09-03 · el `preconnect` a GA4 se sacó antes de pushear (D-254)

**El coordinador encontró, antes de pushear el merge, que `Base.astro` mandaba
un `<link rel="preconnect" href="https://www.googletagmanager.com">` sin
ninguna condición de consentimiento** — solo `conChrome`, para no ofrecerlo en
`/admin`. Un `preconnect` no es una pista pasiva: abre DNS + TCP + el handshake
TLS con Google **en el load**, para quien todavía no decidió y también para
quien **rechaza**. Contradecía la promesa central de D-250 («hasta que la
persona decide, no se mide») desde el primer render.

**El arreglo fue sacarlo, no condicionarlo**: en un sitio estático el `<head>`
es el mismo HTML para todo el mundo, y la decisión de consentimiento vive en el
`localStorage` de cada visitante — no existe un `preconnect` condicional acá.
Detalle completo en **D-254** (`06-decisiones.md`).

**Y la red que faltaba**: `tests/terceros-antes-del-consentimiento.test.ts` lee
el `dist/` construido (mismo patrón que `tests/sin-comentarios-en-el-html.test.ts`)
y falla si aparece un host de tercero en un `<link>` de conexión, un
`<script src>` o un `<iframe src>` que no esté en una lista blanca explícita
con motivo — hoy solo `fonts.googleapis.com`/`fonts.gstatic.com` (tipografías,
B-260, anteriores a esto). Mutación probada: se repuso el `preconnect` a mano,
el test cayó nombrando el host y el archivo exacto, se sacó de nuevo.

**Números del §6bis re-medidos**: sin el `preconnect`, la página de detalle
agrega 1.591 B de HTML (antes 1.653 B) y sigue en 2.075 B gzip de JS — el total
para quien rechaza pasa a ser **2.515 B gzip, y ahora sí ninguna conexión de
red hasta que decide**.

**Anotado, no resuelto**: las tipografías son hoy la misma clase de conexión a
un tercero en el load que este ítem sacó para GA4, solo que decidida antes y
sin la lupa del consentimiento encima — autoalojarlas la eliminaría. **B-481**
en el `BACKLOG`.

## 2026-09-02 · el banner de cookies, el tag de GA4 y los dos eventos propios del sitio público (B-371, B-372, B-375, B-376)

**El dueño contestó las tres preguntas que bloqueaban `16-analitica-del-sitio.md`.**
B-376 → un banner con «aceptar» o «rechazar» (C3, D-250); B-371 → aceptar el
costo de JavaScript de la página de detalle, con el número a la vista (D-251);
B-373 (Search Console) → diferido a propósito para el final, no ahora.

**Construido, en piezas separadas:**

- `src/lib/analyticsSitio.ts` (puro, testeado) y `src/lib/medicionSitio.ts` (el
  transporte): el estado del consentimiento, el vocabulario de los dos eventos
  propios (`clic_inscripcion`, `filtro_sin_resultados`) y la carga de `gtag.js`
  **solo** cuando el consentimiento es `'aceptado'` — nunca «mientras tanto, sin
  cookies» (no se implementó Consent Mode v2 con default denegado; ver D-250).
- `src/components/sitio/AvisoDeCookies.astro`: el banner, sin framework ni
  island — JavaScript liso, como ya hacía `SuscribirseCamino.astro`. Dos
  botones del mismo tamaño y el mismo peso, y un control «Cookies» para revisar
  la decisión después.
- El clic de inscripción manda la **vía** (mail/whatsapp/dm/formulario) y nunca
  el destino: se agregó `via` a `AccionDeInscripcion` (`detallePublico.ts`) para
  no tener que derivarlo del `href` en el cliente.
- El filtro que deja cero manda el **eje** que `ejeQueSobra` ya identifica (la
  misma señal que la pantalla muestra) y el `slug`, nunca el texto del
  buscador — instrumentado en `Buscador.tsx` con una firma que evita medir la
  misma combinación en cada tecla.
- El enganche en `src/layouts/Base.astro` (un commit chico y aislado, al
  final): el banner va con la misma condición que el resto del chrome del
  sitio (`conChrome`), así que nunca aparece ni carga nada en `/admin`.

**El costo medido, byte por byte, contra un build real** (no una estimación;
números re-medidos después de D-254, ver más abajo): la página de detalle pasó
de 17.040 a 18.631 bytes de HTML (+1.591 B, sobre todo el markup del banner,
que sale en todas las páginas). El JavaScript propio —el banner, el clic de
inscripción y el transporte compartido, sin arrastrar el motor de filtrado—
son **2.075 bytes transferidos (gzip)**. Para quien rechaza o no decidió, ese
es **todo** el costo —**2.515 B gzip entre HTML y JS**, y **ninguna conexión
de red a un tercero** (recién cierto desde D-254)—: `gtag.js` (152 KB gzip, el
número ya aceptado en D-251) nunca se descarga. Para quien acepta, se suma ese
número entero; la proporción del §6.1 del diseño («8,5 veces la página») sube a
8,6. Detalle completo en el §6bis de `docs/16-analitica-del-sitio.md`.

**Lo que encontró el `auditor-privacidad`, y no es cosmético (D-253, B-480):**
recortar el `page_location` no alcanzaba — el `page_referrer` también podía
llevar el texto del buscador, y se corrigió. Pero lo que el código **no puede**
tapar es el Enhanced Measurement de GA4, prendido por default: manda «Búsquedas
en el sitio» (el texto tipeado), «Clics salientes» (el destino real del botón
de inscripción) y un `page_view` por cada cambio de historial de la island de
filtros — ninguno de los tres pasa por el saneador de este repo. Hace falta un
paso manual del dueño en la consola de GA4 (apagar esos dos ajustes) antes de
que el tag mida en producción sin filtrar de más. Anotado como **B-480**,
bloqueando el cierre real de B-372 aunque el código ya esté hecho.

**Salida 12.** El sitio público es, desde este cambio, una salida pública más
(GA4). Se agregó a las tres tablas que tienen que coincidir —`07-seguridad.md`,
la ficha del `auditor-privacidad` y el skill `campo-nuevo`— y lo verificó
`tests/agentes-y-skills.test.ts` sin ningún ajuste al test.
## 2026-09-03 · los cinco hallazgos del `auditor-privacidad` sobre la tanda de ayer

Corrido después de cerrar B-340/341/342/343/185/190/200 (ver más abajo). Cinco
hallazgos, dos P1 y tres P2, los cinco reales y los cinco arreglados con
mutación a mano.

**P1 — `tarjetaPublica.ts` se había quedado afuera de B-190.** `lugarDeTarjeta`
seguía publicando «Online por A confirmar» —el texto exacto que el análisis de
B-190 marcó como el problema— en el listado, la página de mes, `/pasadas` y los
hubs: cuatro salidas indexadas que la lista de consumidores corregidos nunca
nombró. Corregido con el mismo criterio que `dondeCorto` (mirar el slug, no el
label).

**P1 — el cuarto par de prefijo de id quedó sin su guarda.**
`tests/clases-de-bug.test.ts` tiene un chequeo de clase que enumera, productor
y validador, cada lista del modelo con ids de cliente (`ses_`, `img_`, `mod_`).
`mat_` (B-342, `lib/material.ts`) nació sin entrar a esa lista — el hueco que
el propio docblock del test anticipaba palabra por palabra. Agregado.

**P2 — `'a-confirmar'` no tenía dueño.** El slug se comparaba a mano en tres
archivos (`detallePublico.ts`, `textoRedes.ts`, y el `tarjetaPublica.ts` de
arriba), la misma clase B-88 —un productor sin declarar, consumidores que
derivan por separado— que es la causa raíz del hallazgo P1. Ahora
`SLUG_PLATAFORMA_A_CONFIRMAR` vive en `lib/modalidades.ts`, con un test que
falla si alguien vuelve a copiarlo.

**P2 — `anterior` viajaba entero.** `ActividadFormulario` pasaba `inicial` —el
documento crudo, con `online.url`, `difusion`, `createdBy`/`updatedBy`— como
`anterior` a `guardarActividad` (B-340). El tipo declarado en `guardar.ts` no
impide que esos campos viajen, solo que se lean hoy; un `console.error` de
debug o mandar el objeto entero a la medición de un fallo los publicaría. Ahora
se proyectan los cuatro campos que `usosAContar` necesita en el propio call
site.

**P2 — `elegidosDe` sin el `?? []` defensivo del resto de los lectores.** Un
`anterior` sin `modalidades` o `tags` tiraba un `TypeError` que el `catch`
silencioso de `guardar.ts` traga — `usos` dejaba de contarse para las cinco
taxonomías, no solo la que faltaba, sin ningún síntoma en pantalla. Agregado,
mismo criterio que `actividades.ts` y `toPublic.ts`.

El auditor confirmó además, de forma independiente, la hipótesis del cierre de
ayer: `ItemMaterial.id` no sale a ninguna de las doce salidas públicas.

## 2026-09-02 · los cuatro ítems que quedaron abiertos de la tanda anterior, y B-340/342

**Continúa el barrido de ítems chicos del panel** (ver más abajo, «cinco ítems
chicos del panel»): los cuatro que esa tanda dejó sin cerrar —dos bloqueados a
propósito, dos con recomendación pendiente de confirmar— más B-340 y B-342, que
esa misma tanda había descubierto y anotado.

### B-340 · `usos` cuenta actividades, no guardados

`registrarUsos` sumaba 1 por guardado: editar (o re-guardar borrador, B-183) la
misma actividad varias veces inflaba `usos` de su tipo, arancel, barrio y
etiquetas, y con eso el §4.3 no podía ni ordenar por frecuencia real ni
distinguir un `usos: 1` de typo colgado de uno de re-guardados. `usosAContar`
gana un cuarto argumento, `anterior` —el `inicial` que el formulario ya carga
al abrirse, sin lectura extra a Firestore— y descuenta lo que ya estaba ahí,
además de lo recién creado con "Otro" (B-168). D-230 tiene el razonamiento
completo, incluido por qué alcanza sin tocar `actualizarActividad`.

### B-341 y B-343 · la galería y los encuentros tampoco pintaban su propio error

La misma clase que B-197 (material), en los otros dos editores de filas que
quedaron anotados ese día. `GaleriaEditor` declaraba una prop `error` que
`SeccionQueEs` nunca pasaba —código muerto—; `SesionesEditor` recibía solo el
error de la lista. Los dos pasan a recibir `errorDe` completo: `GaleriaEditor`
pinta el de la lista y el de cada fila (`imagenes.N.url`, la única ruta de una
imagen que el schema puede rechazar aparte de `id`/`origen`/`storagePath`, que
son de máquina); `SesionesEditor` pasa Inicio y Fin a `Campo` y lee
`sesiones.N.inicio`/`fin`. La derivación paralela de "fin antes del inicio"
(`resumirSesion`, más rica: dice el día de la semana) se conserva a propósito.

### B-342 · el material al chasis `FilasEditor`, con id de cliente

`MaterialEditor` era el único editor de filas que no usaba `FilasEditor` (B-224)
y editaba por índice. Ahora usa el chasis compartido (gana Duplicar, contador y
estado vacío) e `ItemMaterial` tiene `id` de cliente (`mat_<uuid>`,
`lib/material.ts`) — no es la trampa 2 en sentido estricto (un ítem de material
no sincroniza con Calendar) pero sí su prima chica: `key={i}` movía el foco al
borrar una fila. Los documentos anteriores a este cambio se leen con un id
determinístico por posición (mismo criterio que `ID_IMAGEN_MIGRADA`, D-125), y
duplicar una actividad regenera los ids del material igual que ya hacía con las
modalidades. Campo nuevo → skill `campo-nuevo`: las doce salidas públicas, una
por una — el `id` no sale en ninguna (`toPublic.ts` ya era whitelist sin él),
confirmado con una mutación en `itemPublico` que el barrido de centinelas
agarra nombrando `material.id`. Fila nueva en el «Qué NUNCA sale» de
`07-seguridad.md`.

### B-185 · «DM al Instagram»

Las dos líneas del mismo valor guardado, en un solo commit:
`etiquetasUI.ts` (panel) y `functions/calendario.js` (evento público). La tanda
anterior lo había dejado abierto creyendo que `functions/` estaba vedado para
el frente del panel; no lo está — solo `functions/imagenes*.js` lo es.

### B-190 · la plataforma «a confirmar», con sus tres consumidores

La tanda anterior había dejado la entrada de taxonomía sin implementar porque
el label solo («A confirmar») ensuciaba el JSON-LD del detalle
(`VirtualLocation { name: "A confirmar" }`, una plataforma inventada en datos
estructurados). D-231: la detección pasa a mirar el **slug**, no el label, y
con eso `dondeCorto` dice "Online, plataforma a confirmar", el JSON-LD omite
`name`, y `textoRedes.ts` cae al genérico "Encuentro virtual".
`functions/calendario.js` ya leía bien y no se tocó.

### B-200 · las fechas se validan con el mismo parser que las convierte

Medido antes de decidir nada: `sesionSchema` ya rechazaba una fecha corrupta
(con el mensaje equivocado); el agujero real estaba en `modalidadFilaSchema`
—cuyo corto circuito para las dos fechas opcionales dejaba pasar una ventana
con una sola punta corrupta— y en `inscripcion.cierra`, sin ninguna guarda de
forma. D-232 tiene el detalle completo.

### Documentación

`BACKLOG.md` (los siete ítems cerrados, con el cierre real escrito contra el
análisis previo); **D-230**, **D-231** y **D-232** en `06-decisiones.md`; y
**tres** entradas nuevas en `novedades.ts` —la plataforma «a confirmar»
(B-190), que Duplicar y el contador de material (B-342), y el error en la fila
de la galería y los encuentros (B-341/B-343)—, porque las tres cambian algo que
se nota **usando** el panel. B-340 y B-200 no entran: son correcciones internas
—conteo de `usos`, mensajes de error en un caso borde que el navegador no deja
producir escribiendo normalmente— que no cambian qué puede hacer quien carga
una actividad. B-185 tampoco: es copy de una línea, no una capacidad nueva.

Sin entrada en `ayuda.ts`: nada de lo cerrado hoy es un comportamiento que haga
falta explicar aparte del propio campo — la opción «A confirmar» se explica
sola en el desplegable, y el resto son mensajes de error que ya se leen donde
aparecen.

## 2026-09-02 · tres frentes integrados, y el choque que solo se ve al integrar

**Y los cuatro hubs de búsqueda entraron al índice de salidas públicas como la
salida 11** (B-108). No estaban en ninguna de las tres listas: ni en la ficha del
`auditor-privacidad`, ni en `07-seguridad.md`, ni en el skill `campo-nuevo` —
así que el auditor no se disparaba al tocarlos y el barrido de centinelas no los
recorría. **La suite estaba verde igual**, porque el índice solo se compara
consigo mismo: es el hueco de índice del 2026-08-27 por cuarta vez. Se cerró con
el `describe` que faltaba, y ahí apareció lo que valía la pena escribir: las
frases y la URL de un hub se barren **por separado**, porque en el título tiene
que estar la etiqueta y en la ruta el slug (trampa 10). En un solo barrido, el
slug pasaba por permitido en el título nada más porque está en la URL.

**Se juntan en `main` la analítica del sitio (B-370 a B-379, D-200, D-201), las
imágenes que se optimizan solas (B-220, B-300, B-266, D-175) y la deuda de tests
e infra (B-219 y nueve más).** Cada uno venía verde en su worktree.

**Y aun así el merge encontró un bug que ninguno de los dos podía ver** (**B-368**).
El frente de analítica agregó una entrada al formulario desde su tablero nuevo; el
de B-177 es dueño del aviso de «esta etiqueta no quedó registrada». La entrada
nueva no limpiaba el aviso, así que quedaba pegado en pantalla sobre una actividad
ajena. **Lo agarró un test que recorre las entradas que encuentra en el fuente en
vez de una lista escrita a mano** — la entrada nueva entró sola al barrido. Es el
argumento concreto para esa forma de escribir guards.

**Los diez ítems de la analítica no estaban en el backlog**, solo citados por
número en su documento de arquitectura: se registraron al integrar. El primero es
**B-373** (Search Console) y es de calendario, no de prioridad — no hay histórico
anterior a la conexión, así que cada día sin conectarlo es un día perdido.

## 2026-09-02 · el backlog vuelve a significar algo: seis cierres, un descarte y nueve afirmaciones falsas

**Barrido de backlog y de drift de documentación. Cero cambios en `src/` y en
`functions/`** — el único fuente que se tocó es prosa: dos avisos en el
`CLAUDE.md`.

El problema era de aritmética: **86 ítems abiertos, doce de ellos en la sección
P1, y varios ya estaban hechos.** Un ítem cerrado en falso es peor que uno
abierto —el abierto se revisa, el cerrado no— así que la regla del barrido fue
una sola: **nada se cierra sin reproducirlo contra el código**, y lo que no está
hecho se corrige y se deja abierto.

> El 86 está contado, y vale decir cómo, porque el número con el que arrancó el
> frente era **76** y no cerraba —lo marcó el `auditor-documentacion`—:
> `git show main:docs/BACKLOG.md | grep '^### ' | grep -v '✅\|❌\|~~'` da
> **86** sobre 211 ítems en total. La cifra de la sección P1 sí cerraba exacta.
> Queda escrito para que la próxima vez que alguien diga «hay N abiertos» se
> pueda recontar con una línea.

### Lo que se cerró, y con qué evidencia

| Ítem | Evidencia |
|---|---|
| **B-01** · Sitio público (paso 3) ✅ | **ocho salidas indexables** en `src/pages/`, `npm run build` verde, `dist/sitemap.xml` con las seis rutas fijas bajo `https://agendaleh.ar/`, `dist/robots.txt` bloqueando solo `/admin`, y el único `noIndex` fijo del sitio en `/admin` |
| **B-223** · `12-sitio-publico.md` contra `imagenUrl` ✅ | los seis lugares del ítem, más dos que no contaba |
| **B-234** · el mapa de URLs con nombres viejos ✅ | corregido contra `src/pages/`, que es lo que se publica |
| **B-201** · el conteo del §1.3 ✅ | remedido: **376 LOC, fan-out 26, 28º**, con el criterio del conteo escrito al lado |
| **B-294** · la tabla «no automatizar» ✅ | 14 filas → 11, **cero `||`** en el archivo |
| **B-173** · `tsc` con doce errores de `ImportMeta` ✅ | reproducido y arreglado: sin `astro sync` salen los doce, con `astro sync` antes sale **exit 0** |
| **B-275** · el rótulo de la cartelera en azul ❌ | descartado: la conclusión era «no se toca» y estaba escrita desde B-273 |

Y uno que **no** se cerró, que es la mitad del trabajo: **B-107** se
reverificó línea por línea y de las nueve cosas que enumeraba **falta una sola
suya** —el `BreadcrumbList` del detalle, más el `CollectionPage`/`ItemList` que
va con los hubs—. Comprobado con un `grep` sobre `src/`: cero apariciones. Las
cinco imágenes de Open Graph que el ítem también pedía son **B-291** y no de
acá. Con eso **baja de P1 a P2**, y el motivo importa: era P1 porque «una página
de detalle sin datos estructurados no sirve para lo que existe el proyecto», y
esa mitad está. Lo que queda mejora cómo Google entiende la **navegación**, no
si la página entra al índice.

### El drift: nueve afirmaciones que el trabajo de estos días volvió falsas

Es lo que más valor tuvo de todo el frente, porque son las que hacen que alguien
escriba código contra algo que no existe.

**Las dos peores estaban en lo primero que se lee.** `docs/01-arquitectura.md`
decía del sitio público **«todavía no está desplegado: falta elegir el
dominio»**, y el `README.md` daba el paso 3 como **«🟡 la mitad… falta
desplegarlo»**. Está publicado en `agendaleh.ar` desde B-109.

**La tercera es la que nadie miraba:** `docs/11-ideas-de-producto.md` tiene
cuatro propuestas y **tres están construidas** (B-95, B-96, B-97), y el
documento se leía como si ninguna existiera. Ahora cada una lleva su estado y el
argumento original queda entero, porque es el valor del archivo. De ahí salió
además un ítem nuevo: el texto para redes no lleva el link **porque «falta el
dominio»**, y el dominio existe — es **B-312**, y lo único que queda es que el
dueño diga sí.

**Y la que estaba en el peor lugar posible:** el `CLAUDE.md` §3.1 y §5.2 seguían
modelando la imagen como un campo único `imagenUrl`, cuando el modelo es
`imagenes: Imagen[]` con un flag `portada` desde D-125 y está en producción hace
días. Se siguió el precedente de **D-128** en ese mismo archivo: **el bloque
original no se toca** —para que la decisión se lea contra él— y arriba va el
aviso con el «no lo restaures» y el motivo. El §5.2 se llevó de paso el otro
campo que dejó de ser lo que dice: `sede` sigue existiendo pero es un
**derivado**, y la lista real es `modalidades[]` (D-130).

Las otras: `14-plan-de-saneamiento.md` («el sitio público va aparte y después» ya
pasó), `07-seguridad.md` (un comando «una vez que exista el sitio público»),
`04-funcionalidades.md` (dos usos de `imagenUrl`, y el detalle ya no muestra una
sola imagen) y la entrada **D-155** de `06-decisiones.md`, cuyos puntos 1 y 2
decían «`/pasadas` todavía no existe» y «no hay sitemap todavía» — **se
destrabaron al día siguiente con B-109, tal como la entrada predecía**, así que
no se reescribió: se anotó. La predicción y su cumplimiento valen más juntos.

### Tres ítems nuevos, y el criterio con el que se cerró

**B-310** (la página `/404`, diseñada y sin existir — no tenía ítem, así que era
un pendiente que solo vivía en un documento de diseño), **B-311** (remedir
`10-salud-del-codigo.md` completo: el §1.1 declara 111 archivos de producción y
hoy son 156) y **B-312**, el link del texto para redes.

El criterio de cierre está en **D-170**, porque las dos preguntas que este
barrido tuvo que contestar van a volver: **cuándo se cierra un ítem paraguas** si
le quedan hijos abiertos, y **cuándo un ítem que espera una decisión que nadie
pidió se descarta** en vez de quedarse esperando.

**La cuenta, que era el objetivo:** de los doce ítems de la sección P1 quedan
**seis** que son P1 de verdad —B-266, B-108, B-205, B-236, B-300 y B-220—, más
B-295 y B-121 fuera de la sección. Los otros seis eran dos cierres (B-01 y
B-223), una baja de prioridad (B-107) y tres que ya tenían marca P2 o P3 y
seguían viviendo ahí.

Verificado antes de commitear: `astro sync` + `npm run typecheck` + la suite
completa (**2.173 tests en 93 archivos, todos en verde**, con los de emuladores
incluidos) + `npm run build`.
## 2026-09-02 · el frente del calendario y los ciclos

Siete ítems del backlog mirados de una vez, sobre la parte más frágil del
sistema. **Cuatro cerrados o medio cerrados, tres abiertos con motivo.** El hilo
que los une es el argumento de D-95: cambiar cómo se arma el texto del evento
reescribe los N eventos de todas las actividades publicadas, y a quien los tiene
agendados se le mueve el evento sin que nada haya cambiado para él. Cada ítem de
abajo dice si lo hace o no.

**Nada de lo que entró reescribe un evento ya publicado.** El único
`actualizar` nuevo es la reposición de un evento que **ya no existía**.

### B-161 · la tabla que mide cuántos eventos reescribe cada edición

La red, y va primero a propósito. Los cinco tests de «el payload propaga los
campos nuevos» corren sobre una sola sesión: verifican *que* un campo propaga,
no *a cuántos*. El ítem los había dejado así con motivo, y pidió releerlo con el
mismo ojo cada vez que se toque el diff.

La tabla nueva mide, sobre el ciclo canónico de ocho con **todos** los campos
cargados, el costo de 25 ediciones en `crear`/`actualizar`/`borrar`. Ese número
es el argumento de D-95 hecho aserto: un `actualizar` de más no rompe ningún test
que solo pregunte «¿propagó?», y es justamente el daño que costó caro en B-84.
Tres chequeos más sobre la misma tabla: ninguna edición borra y recrea el mismo
encuentro (§7.2, trampa 2), todo evento lleva su `timeZone` (trampa 1), y dar
vuelta el array de sesiones **no es un cambio** — que es lo único que un diff por
índice no puede decir.

### B-163 · la cuenta del encuentro se hace una sola vez — D-190

El «Encuentro 3 de 8» del evento y el «3 de 8» de la vista calendario del panel
se calculaban cada uno por su cuenta. Coincidían, pero porque los dos habían
llegado al mismo criterio, no porque fuera el mismo código: es la forma que D-71
y D-20 evitan, y es la que produjo B-84.

La aritmética pasa a `numeroDeEncuentro`, exportada de `@calendario`, y el panel
la importa. La **puerta** —si el evento muestra el número— sale a
`elEventoNumeraElCiclo`, exportada y con nombre. **No cambia ningún texto
publicado.** La mitad de producto de B-163 queda abierta: elegir qué criterio
gana es una decisión del dueño, y una de las dos salidas reescribe eventos ya
publicados. Ahora elegir es una línea en un solo lugar.

Un cambio de comportamiento chico, en un caso que el schema rechaza: una sesión
sin fecha usable no se pinta en el calendario del panel pero **cuenta** para el
total, que es lo que dice el evento que la gente tiene agendado. Antes el panel
decía «1 de 1» y el evento «2 de 2».

### B-125 · un evento borrado a mano vuelve, en vez de perderse para siempre — D-191

**Apareció un bug peor que el reportado.** El ítem decía que la vista calendario
miente cuando alguien borra un evento a mano. Lo que nadie había mirado es qué
pasaba después: el documento se quedaba con su `calendarEventId`, el diff seguía
emitiendo `actualizar`, Calendar contestaba 404, y eso caía en el `else` de «falló
una operación» — el id no se limpiaba, así que **cada edición siguiente repetía la
misma operación imposible.** El encuentro desaparecía del calendario público para
siempre.

El `catch` de `syncCalendar` ahora consume `decidirAnteFallo`, pura y con su tabla
testeada: un `borrar` que no encuentra su evento limpia el id (como antes), un
`actualizar` que no lo encuentra lo **recrea** —`debeExistir` ya dijo que ese
encuentro tiene que estar—, y un 404 al **crear** sigue siendo error, porque ahí
«no está» habla del calendario y no del evento (D-06).

**No cierra B-125:** enterarse *sin editar nada* pide leer la API de Calendar, y
la identidad es de la Function. Lo que cambia es que el estado dejó de ser
permanente.

### B-162 · queda medida la suposición que sostiene la guarda anti-loop

Sin cambio de comportamiento, y el motivo está escrito: el arreglo de verdad pide
una decisión que no es técnica. Lo que faltaba era que el mecanismo estuviera
dicho.

La guarda del §7.1 compara el payload de antes contra el de después (D-07), que es
lo que la hace imposible de romper por olvido. Su precio es una suposición que en
ningún lado estaba: **que lo que Calendar tiene es lo que este código habría
escrito.** Los dos lados se calculan con el código de hoy, así que un cambio en
*cómo se arma* la descripción es invisible para ella. Un ciclo con un encuentro
cancelado publicado antes de D-95 sigue diciendo «de 7» y volver a guardarlo no
emite nada. Seis tests fijan la cadena entera.

**Y hay un camino gratis, que conviene tener anotado:** el día que se acepte la
salida de B-160 —sacar el total de la descripción—, ese cambio de texto reescribe
los N eventos de todo ciclo publicado, y de paso les corrige el número viejo. Los
dos ítems se cierran juntos o ninguno.

### B-350 · la conversión de fechas de functions, en un solo lugar

Hallazgo del `auditor-trampas` sobre el commit de B-163, y la misma clase que ese
commit acababa de arreglar: al compartir la aritmética se introdujo `milisDe`,
letra por letra la `milis` que `rebuild.js` ya tenía. Queda una sola, en
`calendario.js`, y **no** en un módulo nuevo: `scripts/que-deployar.sh` trata
`calendario.js` como caso especial porque entra al bundle del panel, y un
`functions/tiempo.js` importado desde ahí caería del lado de «no afecta a
hosting» y dejaría el panel viejo en silencio.

### B-13 · ya estaba hecho, y el BACKLOG no lo decía — B-351

`dispararRebuild` reintenta con backoff exponencial desde D-23, con sus tests. Lo
que había era un encabezado `### B-13` en el BACKLOG con el **cuerpo de B-12**
debajo, más la línea tachada de B-13 al final del bloque: un merge que dejó dos
ítems pisados. Corregido.

### B-353 · D-71 prometía una recuperación que no existía

Cerrando B-125 apareció que el «Límite conocido» de D-71 decía que un evento
borrado a mano «sigue figurando como `en-calendario` **hasta la próxima
edición**». Eso era falso cuando se escribió: no se curaba en la próxima edición
ni en ninguna. Y de paso citaba B-127, que es otro ítem.

**Vale como patrón:** no es doc optimista, es doc que describe un comportamiento
que no existe, en la mitad tranquilizadora de un límite que el propio autor
estaba admitiendo. Un límite conocido se escribe casi siempre con su consuelo al
lado, y el consuelo es lo que nadie vuelve a verificar porque el párrafo ya suena
honesto. **Ante un "límite conocido", el aserto a chequear es el consuelo.**

### Lo que encontró el `auditor-documentacion` · B-354

Dos cosas, ninguna del código. La que importa como patrón: **«las once trampas
del §13» quedó viejo y nadie lo verifica.** Son trece desde las trampas 12 y 13.
`tests/mapa-de-trampas.test.ts` compara la lista del §13 con las filas de la tabla
y con las que no tienen red —eso sí falla— pero **el número escrito en una oración
no es ninguna de las dos cosas**, así que cada trampa nueva deja atrás un conteo
que sigue leyéndose como cierto. Corregido en `15-mapa-de-trampas.md`; el de
`13-agentes.md` queda en B-354, que es de otro frente.

La otra: el encabezado de B-125 dice `P2` y el cuerpo nuevo afirmaba que «la
prioridad real bajó». Se reescribió como propuesta —la baja a P3 es del dueño, no
de quien cierra la mitad del ítem— en vez de cambiar el rótulo por cuenta propia.

### Lo que queda abierto, y por qué

| Ítem | Por qué no se cerró |
|---|---|
| **B-160** · el largo del ciclo cambia y reescribe los otros N | Es por diseño (D-95) y el propio ítem dice «se decide con uso real, no antes». Lo que sí cambió es que **el costo está medido** (B-161), así que la decisión tiene un número |
| **B-162** · el resync de los que ya están publicados | Pide leer Calendar (B-125) o un forzado del dueño. Se cura gratis con B-160 |
| **B-125** · detectar sin editar nada | Pide una identidad contra la API de Calendar que el panel no tiene (D-06) |
| **B-163** · qué criterio de numeración gana | Decisión de producto: una de las dos salidas reescribe eventos publicados |
| **B-150** · el panel sigue siendo dueño de `calendarEventId` | Toca el archivo más disputado del repo. **Y el ítem ofrecía una salida que no sirve**: `formADocumento` no puede *dejar de emitir* el campo, porque `updateDoc` reemplaza el array `sesiones` entero y eso borraría **todos** los ids — la próxima pasada crearía un evento nuevo por encuentro. Es el mismo argumento que el comentario de `completo` (B-97) dos bloques más abajo. Queda la otra: releer y fusionar por id de sesión antes de escribir |
## 2026-09-02 · cinco ítems chicos del panel: los errores que no se veían, y una medición que dijo que no

Cinco de los nueve ítems chicos del panel. Los cuatro que no entraron, y por qué,
al final — ninguno por falta de tiempo.

### B-197 · el error de una fila de material se ve al lado del campo

`MaterialEditor` recibía un solo `error` —el de la lista— así que el rechazo de una
fila puntual solo se leía en la barra de abajo («Título del material»): con dos
filas cargadas y una sin título, el mensaje **no decía cuál de las dos**. Era la
única familia de campos del formulario que no mostraba su propio error.

Ahora recibe `errorDe`, la misma prop que `ModalidadesEditor`, y cada campo lee el
suyo con `ruta()` — el índice en el medio, como lo emite el `path` del
`superRefine`. Armada distinto, el error existe en el mapa y **no se pinta nunca**,
sin que nada falle: `errorDe` de una clave que no existe devuelve `undefined`.

Los cuatro campos pasaron a usar `Campo`, y eso no es prolijidad: `Campo` es quien
marca `data-campo-con-error`, y sin eso el scroll de un guardado fallido (B-184)
seguía cayendo en la línea de la lista o en el principio de la sección. El error se
veía y seguía sin llevar a ningún lado.

**El test destapó el campo que se habría saltado.** `tests/errores-de-fila.test.ts`
deriva los sufijos de `CAMPOS_VALIDABLES` en lugar de listarlos, y así apareció
`material.items.N.publico` —la casilla, que no usa `Campo` porque su etiqueta va al
lado y no arriba—: una ruta que el schema puede rechazar y que no tenía dónde
mostrarse. Pinta su error a mano. Escrita a mano, la lista habría sido «título y
url» y ese cuarto no aparecía.

**Cinco mutaciones, las cinco mueren:** volver a pasar el error de la lista, armar
la ruta con el índice al final, sacarle el `errorDe` a un campo, sacar el error de
la lista, y renombrar el label de «Título».

**La clase sigue viva en otros dos editores**, y quedó anotada en lugar de tocar
archivos de otros frentes: **B-341** (la galería, donde la prop `error` existe y
**nadie la pasa**, o sea que la línea que la pinta es código muerto) y **B-343**
(los encuentros, donde el caso caro ya está cubierto por una derivación paralela).
El chasis de filas también: **B-342**.

### B-198 · medido el aviso por tecla, y no se debouncea

El ítem pedía **medir antes de optimizar**. Medido (D-185):

| Encuentros | `faltaParaPublicar` | `JSON.stringify` del mismo form |
|---|---|---|
| 1 | 0,107 ms | 0,001 ms |
| 8 | 0,107 ms | 0,007 ms |
| 20 | 0,123 ms | 0,012 ms |
| 50 | 0,205 ms | 0,025 ms |

**Las dos frases del ítem eran falsas, y en direcciones opuestas.** No es «del
mismo orden que el `JSON.stringify`»: es ~10× más caro. Y da igual, porque el costo
es **fijo del schema y no escala con los encuentros** —con uno ya cuesta 0,107 ms—,
así que el «ciclo de 20 encuentros en un teléfono viejo» que el ítem temía es
indistinguible del caso chico. A diez veces más lento sigue siendo una octava parte
de un frame.

Así que no se debouncea, y tampoco entró `useDeferredValue`: no hay nada que
diferir cuando el trabajo no llega a un frame, y las dos opciones compran una
ventana en la que el aviso dice algo que ya no es cierto — justo lo que un aviso de
«esto no se puede publicar» no puede tener.

Lo que queda es la medición, en `tests/costo-por-tecla.test.ts`, con **dos**
asertos: el costo por tecla y **que no escale con los encuentros**, que es el
hallazgo que decide todo. El techo es de dos órdenes de magnitud a propósito: no es
un objetivo de performance, es el piso de lo absurdo — detecta que alguien meta
red, `crypto` o una regla cuadrática en el camino del tecleo, no un 20 % de
variación de máquina. Un techo ajustado sería un test que falla en una máquina
cargada, y **un test que falla por su propia plomería enseña a saltearlo**. Tres
mutaciones, las tres mueren: la regla cuadrática, un trabajo fijo de 25 ms, y
`faltaParaPublicar` devolviendo `[]` — que hace pasar los dos asertos de costo y lo
mata el control positivo.

### B-55 · el pegado de coordenadas se mide, y la coma decimal tiene nombre

El vocabulario estaba declarado desde antes y `CoordenadasSede` se mergeó después,
así que los dos eventos **nunca se emitieron**: sus cruces vacíos en GA4 se leían
como «nadie pega coordenadas». El ítem prometía «una línea por rama». Son tres
decisiones (D-186):

1. **`coordenadas-pegar` es el denominador**, no «se pegó un link bueno». Cuatro
   fallos son muchos sobre cinco intentos y ninguno sobre cuatrocientos.
2. **Un intento no se cuenta dos veces.** Hay cuatro disparadores sobre el mismo
   texto —pegar, Enter, «Usar» y salir del campo— y pegar **deja el texto puesto**,
   así que el blur lo vuelve a aplicar. Sin guarda, un link corto pegado llegaba
   como dos o tres fallos, y el sesgo no es parejo: **infla justo
   `coord-link-corto`**, que es el número que decide B-45. Era el modo de falla más
   caro que esta instrumentación podía tener — habría contestado «sí, resolvelos»
   con datos inventados.
3. **El `motivo` lo devuelve `parsearCoordenadas`, no el componente** (lección de
   B-88 y de `MOTIVOS_IMAGEN`): deducirlo del texto del mensaje se rompe solo con la
   próxima corrección de redacción, y en silencio.

**`coord-coma-decimal` era vocabulario sin rama.** Los cuatro valores estaban
declarados y ninguna ruta del código producía ese: su cruce vacío se leía como «eso
no pasa nunca». Ahora existe la rama. Un par con coma decimal —«-34,5989,
-58,4392», lo que copia una máquina configurada en español— **se sigue rechazando**,
porque es genuinamente ambiguo (podrían ser dos números o cuatro, y equivocarse
manda el evento al otro lado del planeta), pero con nombre propio y un mensaje que
dice qué corregir. Antes caía en «no parece un link de Google Maps ni un par de
coordenadas», que es **falso**: el par está, con el separador de otro idioma.

Un test que se escribió mal y se corrigió: el aserto del orden entre los dos regex
decía proteger que «-34, -58» siguiera leyéndose como par, y la mutación que
invierte el orden **pasó** — los dos regex son disjuntos por construcción, así que
el orden es defensivo y no la garantía. El aserto quedó, con lo que sí protege
escrito: un regex más flojo se come ese par. Siete mutaciones en total, las siete
mueren.

### B-177 · el aviso de la etiqueta que se guardó y no quedó registrada

Con el orden de escritura de D-111 son dos escrituras: la actividad primero, la
etiqueta nueva después. La segunda puede fallar sola —y ese modo de falla se eligió
a propósito, porque al revés se perdía la actividad entera (B-71)— pero
`guardarActividad` devolvía `etiquetasSinRegistrar` y **nadie lo miraba**: un
guardado con la etiqueta perdida se veía exactamente igual que uno perfecto.

Tres decisiones (D-187):

- **Dice cuál.** El resultado pasó de `boolean` a la lista de labels: con un
  booleano el aviso solo puede decir «alguna etiqueta nueva no se registró», y con
  cinco campos de taxonomía eso no es accionable. Se descuenta cada alta que sale
  bien, así que con dos etiquetas y la segunda fallando nombra la segunda — mandar a
  re-tipear una que ya quedó es trabajo inventado.
- **`registrarUsos` salió del `catch` compartido, y eso cambia lo que el flag
  significa.** Un fallo al **contar el uso** se reportaba como «la etiqueta no se
  registró», que es mentira: la etiqueta está. Con el aviso en pantalla habría
  mandado a arreglar algo que no está roto. Ahora tiene su propio `try` y su fallo
  no se reporta: lo único que se pierde es una posición en el orden del desplegable.
- **El aviso vive en `AdminApp`, no en el formulario**, que se desmonta al guardar,
  y **afuera de la vista**, porque del formulario se vuelve al listado o al
  calendario según de dónde se entró. Se limpia en las cuatro entradas a un
  formulario: un aviso viejo arriba de una carga nueva manda a arreglar la etiqueta
  de otra actividad.

Vale ahora y no antes porque la pantalla de «Opciones» existe (B-06 / B-170): el
aviso tiene a dónde mandar y no es solo una mala noticia.

`tests/senales-del-guardado.test.ts` verifica la **clase**: deriva del fuente los
campos de la variante `estado: 'ok'` y exige que la pantalla consuma cada uno.
Agregar un campo al resultado y no consumirlo lo pone en rojo nombrándolo. **Una de
las seis mutaciones sobrevivió a la primera versión del test** y vale escribirlo: el
aserto de «cada entrada limpia el aviso» miraba una ventana de 200 caracteres antes
del `setVista`, y los handlers están pegados, así que la ventana se comía la
limpieza **del handler de al lado** — sacar la limpieza de «duplicar» pasaba en
verde. El corte ahora es por el cuerpo del handler.

### B-86 · estaba cerrado desde el 2026-08-25 y la entrada decía «parcial»

Lo cerró B-168, que lo dice en su propio texto. Verificado leyendo el código:
`usosAContar` arma los slugs por campo, `guardarActividad` los pasa a
`registrarUsos` después del alta de opciones, y `ordenarValores` ordena las
no-fijas por `usos`. Con tests en los dos lados.

**Y verificarlo destapó un ítem nuevo: B-340.** `registrarUsos` suma **1 por
guardado**, así que `usos` mide *veces guardado* y no *cuántas actividades usan la
opción*. Eso rompe los dos trabajos que el §4.3 le da, y el segundo en la dirección
que lo esconde: un typo creado y re-guardado cuatro veces tiene `usos: 5` y **deja
de parecer basura**, que es justo el caso que el número existe para encontrar.

### Los tres hallazgos de los auditores

**`auditor-trampas` (P2) — un bug que introduje y que no habría fallado nunca.**
`etiquetasSinRegistrar` juntaba los labels en un `Set<string>`, así que un arancel
«Nuevo» y un barrio «Nuevo» —lo que pasa cuando alguien duda y escribe lo mismo en
dos campos— eran **una** entrada: si el alta del primero salía bien y la del segundo
fallaba, el éxito del primero borraba la entrada compartida y **el fallo del segundo
desaparecía**. El aviso decía que todo salió bien y quedaba una taxonomía sin
registrar que nadie sabía que había que volver a tipear. La clave pasa a ser el par
`campo\0label`; lo que se **muestra** se sigue deduplicando por label. Y el auditor
señaló por qué mis tests no lo agarraban: el fixture usaba labels distintos entre
campos.

**`auditor-privacidad` (P2) — la red del campo de coordenadas barría lo que no
importa.** El aserto «nunca manda lo pegado» miraba `entrada|texto|pegado` y dejaba
afuera los dos candidatos más a mano: `r.error` —hermano de `r.motivo` en el mismo
`if (!r.ok)`, y dos de sus ramas **interpolan la coordenada de la persona**— y
`geo`/`lat`/`lng`. Un `medirFuncion('coordenadas-fallo', r.error)` lo pasaba sin
chistar. No filtraba igual (el sanitizador de `detalle` lo habría convertido en
`otro`), pero la red decía verificar el criterio en el productor y no lo hacía.

**`auditor-privacidad` (nota) — un cambio de comportamiento sin test.** Separar
`registrarUsos` en su propio `try` hizo que ahora corra aunque un alta haya
fallado; antes el throw lo salteaba. Es lo que se quiere —las otras etiquetas sí
están y su uso tiene que contarse, y sobre la que falló es un no-op por D-103— pero
nada lo fijaba.

Los tres arreglados, con cinco mutaciones más. Y el auditor de trampas confirmó lo
que había que confirmar: el orden de escritura de B-71/D-111 sigue intacto y el
chequeo de clase lo sigue viendo; el import nuevo de `analytics-eventos` dentro de
`coordenadas.ts` no arrastra Firebase al chunk del panel; y el `key={i}` de las
filas de material **no** es una instancia nueva de la trampa 2 —el array no
sincroniza con Calendar— que es justo el razonamiento que quedó escrito en B-342.

### Y los cinco del `auditor-documentacion`

Los cuatro primeros son de trazabilidad, y **dos los causó este mismo cambio**:

1. **D-111 quedó afirmando algo que este cambio volvió falso.** Decía «el caso de
   uso lo informa en su resultado (`etiquetasSinRegistrar`) y **hoy nadie lo
   muestra en pantalla** — queda anotado como B-177». B-177 se cerró acá. Es el
   patrón de B-56 exacto: una decisión que describe el estado del mundo envejece
   cuando el ítem que nombra se cierra, y **nada falla**. Corregida con la nota, y
   el párrafo original se deja para que se lea contra él.
2. **La cita del orden de escritura es D-111, no D-100.** D-100 es «la mitad
   cliente del §4.2 vive en un módulo puro» y no habla de orden de escrituras.
   Este cambio repetía una cita ya cruzada y la propagaba a tres lugares nuevos
   (D-187, `04-funcionalidades.md` y este CHANGELOG): los tres corregidos. Las
   heredadas quedan como **B-345**, y ahí queda escrito cuáles citas de D-100
   **sí** están bien, para que corregirlas no se pase de largo.
3. **D-113 decía «cinco escrituras» y hoy son seis**: le faltaba `registrarUsos`,
   que entró con B-168 el 2026-08-25. Preexistente, y justo el puerto cuyo
   `try/catch` este cambio movió. Importa más que un número: ese documento es lo
   que se lee para saber qué hay que poder falsear al testear el orden, y un
   puerto que no figura es uno que un test nuevo no va a mockear.
4. **Un merge mal resuelto en el BACKLOG, preexistente.** `### B-12` (la vista
   previa del evento) estaba **sin cuerpo**, y su cuerpo colgaba debajo del
   encabezado de `### B-13` (los reintentos del rebuild), que es otro tema.
   `tests/sin-marcadores-de-conflicto.test.ts` no lo agarra porque no hay
   marcadores de git, solo texto en el lugar equivocado. Movido a su lugar.

**El quinto queda sin hacer, a propósito:** el conteo de tests de
`docs/README.md` («2.173 tests en 93 archivos») y de `docs/08-operacion.md`
(«2.006 en 88 al 2026-09-01») quedó viejo. Contado en esta corrida son **96
archivos y 2.213 tests**, pero hay cinco frentes más agregando tests en paralelo,
así que cualquier número que se escriba hoy va a estar mal a la tarde **y va a
chocar en el merge**. El número se pone una vez, después de juntar los frentes,
corriendo la suite entera.

### Los cuatro que no entraron

- **B-185** (el copy de «DM al Instagram») — el ítem dice literal que «el arreglo
  son las dos líneas, o ninguna», y una de las dos vive en `functions/calendario.js`,
  que es de otro frente. Cambiar sola la del panel **crea** la divergencia B-76 con
  el build en verde, que es exactamente lo que el ítem prohíbe. Al buscarlas
  apareció además que son dos y no cuatro: los otros dos mapas con la vía `dm` no
  dicen «de Instagram» y no entran.
- **B-190** (la plataforma «a confirmar») — «una entrada, cero código» no sobrevive
  al contacto con los consumidores. El ítem revisó uno de cuatro. Con la entrada
  puesta, el detalle diría «Online por A confirmar» y el **JSON-LD** emitiría un
  `VirtualLocation { name: "A confirmar" }`, o sea una plataforma inventada en los
  datos estructurados que indexa Google. No hay label que funcione en los cuatro a
  la vez: hace falta código en `detallePublico.ts` y en `functions/`, los dos de
  otros frentes. El razonamiento del ítem sigue en pie; lo que falta es
  secuenciarlo.
- **B-45** (los links cortos de Maps) — la resolución desde el cliente no es una
  opción caedible: es una que **no funciona**. En `cors` el `fetch` tira antes de
  ver el redirect, con `redirect: 'manual'` el `Location` no se puede leer, y en
  `no-cors` la respuesta es opaca. La única salida es la Function, y su costo es más
  que «otro endpoint»: es un fetcher de URLs arbitrarias, o sea superficie de SSRF.
  Y ahora hay con qué decidirlo, porque B-55 cerró el mismo día: el criterio del
  propio ítem pasó de hipótesis a consulta a GA4.
- **B-100** (prellenar la sede) — el criterio que el ítem se puso no se cumple:
  nadie midió si las sedes se repiten. Y una corrección: el ítem dice que «el
  vocabulario del §9 puede contestarlo», y no puede — `sede.nombre` es texto libre,
  no una taxonomía, así que ningún evento lo lleva ni debe. Lo que sí está medido es
  `actividad-duplicar` (el competidor que el ítem nombra) y, desde B-168,
  `barrio.usos`. Si algún día se hace, va **explícito** —un botón «copiar de la
  última»— porque prellenar sin que nadie revise publica la sede de otra actividad.

### Documentación

`04-funcionalidades.md`; **D-185**, **D-186** y **D-187** en `06-decisiones.md`;
`09-analitica.md` (los tres puntos de la instrumentación y por qué
`coord-coma-decimal` era vocabulario sin rama); **tres** entradas en `novedades.ts`
—los errores del material en la fila, el aviso de la opción que no quedó, y las
coordenadas con coma— y **un punto** en `ayuda.ts`, en «Las listas que crecen
solas», atado a dos tests: que son dos escrituras y que la segunda puede fallar
sola es lo único de los cinco que no se adivina mirando la pantalla.

Sin entrada en `02`, `03`, `07` y `08`: no se toca infra, ni colecciones ni campos,
ni qué es público —el `detalle` de la analítica sigue siendo un enum cerrado de
etiquetas de causa, y nada de lo pegado en el campo de coordenadas viaja—, ni cómo
se corre o se despliega.

**Seis ítems nuevos**, todos encontrados haciendo o auditando esto: **B-340** (`usos`
cuenta guardados y no actividades), **B-341** (la galería y su prop `error` muerta),
**B-344** (nadie sondea el emulador de Auth) en P2; **B-342** (las filas de material
fuera del chasis), **B-343** (los errores por fila de los encuentros) y **B-345**
(las citas heredadas a D-100) en P3.
## 2026-09-02 · la deuda de tests y de infraestructura de desarrollo

Nueve cambios que no se ven en el sitio y hacen que lo demás sea confiable. El
primero es el que más vale.

### Una base de emulador por checkout — B-219, B-276, B-169, B-174 (D-195)

**El flaky que mordió cinco veces en dos días, cerrado, y la reproducción
versionada.** Los tests de integración fallaban una de cada N corridas, con cinco
observaciones independientes desde tres worktrees y ninguna reproducible a
voluntad. La causa es que el emulador es estado compartido de la **máquina** y no
del checkout: escucha en `127.0.0.1:8080`, le pega cualquier working-tree, y todo
archivo de integración empieza por `limpiarFirestore()`, que borra la base
entera. Dos corridas concurrentes se vaciaban el fixture entre sí a mitad de un
`it`.

**Lo primero no fue el arreglo: fue dejar de adivinar.**
`scripts/probar-concurrencia.sh` corre dos suites de integración a la vez y con
`--misma-base` reproduce la falla **6 de 6 veces** (2 a 10 tests rojos por
corrida, distintos cada vez, con los mensajes exactos de las cinco
observaciones). Sin la bandera, las mismas seis corridas dan verde. Un arreglo que
no se puede mutar no se sabe si arregló, y eso es lo que dejó este ítem abierto
una semana.

El arreglo es un `projectId` por working-tree, derivado de la ruta del checkout.
Se eligió sobre la otra candidata —un puerto por worktree— porque el puerto
obliga a hacer configurable el host del emulador en **código de producción**
(`firestore-client.ts` y `firebase-client.ts` lo tienen escrito) y a coordinar
cuatro puertos por checkout; el `projectId` no toca nada de producción, porque la
API REST del emulador ya está parametrizada por proyecto en las tres operaciones
que importan.

**La objeción que el ítem anotaba era falsa, y se verificó en vez de suponerse.**
Decía «choca con `singleProjectMode: true`». No choca: con el emulador levantado
con `--single_project_mode true` se cargaron reglas para dos projectIds
inventados, se escribió en cada uno, se borró **uno** entero y el otro siguió ahí
—200 contra 404—. El modo de proyecto único **avisa; no aísla ni impide**. Eso
quedó fijado en `tests/emulador-aislado.test.ts`, no escrito en un comentario:
es la premisa de la que depende todo el resto.

**Y probando el arreglo apareció el mismo bug un nivel más abajo.** Dos tests
tenían un proyecto **auxiliar** con nombre literal —`'trampa-7-mecanismo'`, que ya
estaba en el repo, y el vecino del test nuevo—. Las bases principales quedaban
separadas y las auxiliares no, así que dos corridas concurrentes se pisaban igual.
Se resolvió con `proyectoAparte()`, y hay un aserto que recorre las URLs de la API
del emulador en todo `tests/` y exige que **cualquier** projectId derive de
`PROJECT_ID`.

De arrastre quedaron cerrados **B-276** (la misma familia) y **B-169** (los tres
tests que ejecutan `aprobar-opciones.mjs` de verdad: el script resolvía el
proyecto por su cuenta, ahora se le pasa por el entorno).

Y **B-174**, que dejó de ser una mejora para volverse obligatorio: una base nueva
arranca **sin reglas**, así que los cuatro archivos que faltaban ahora empujan el
`firestore.rules` de su propio checkout. Eso también desactivó la advertencia con
la que ese ítem terminaba —«corriendo dos suites en paralelo, la última que carga
gana»—, y está verificado contra el emulador: se cargan reglas cerradas en la base
propia y las del vecino siguen abiertas.

**Lo que NO resuelve, dicho explícito.** No separa los **puertos** (de ahí salió
B-365), `fileParallelism: false` se queda porque particiona por checkout y no por
archivo, y las reglas de **Storage** no se pueden particionar (B-366).

**Efecto lateral bienvenido:** `npm run dev` y `npm run seed` siguen en
`agenda-literaria`, así que los datos que uno carga a mano en el panel local ya no
los borra ninguna corrida de tests.

### Una tanda de emuladores a medias — B-365

Salió probando lo anterior, y es una cara nueva de la quinta observación de
B-219: el emulador no solo aparece y desaparece — puede aparecer **a medias**.

Otro worktree levantó su tanda y el proceso padre de la primera murió: su hijo de
Firestore quedó **huérfano y escuchando** en el 8080, mientras el hub y Auth se
fueron con el padre. `emuladorVivo()` le pregunta solo a Firestore, así que dijo
«está arriba», los cuatro archivos que hacen login corrieron, y lo que se vio
fueron cinco `beforeAll` en rojo con un `ECONNREFUSED 127.0.0.1:9099` desde el
fondo del SDK, sin una palabra sobre qué emulador faltaba.

`emuladorAuthVivo()` va aparte por el mismo motivo que `emuladorStorageVivo()`,
que ya existía con el argumento escrito: «son dos emuladores distintos y el modo
de falla que importa es el asimétrico». Auth tenía la misma exposición y no tenía
la guarda.

### La decisión de plomería del gate sale del gate — B-180 (D-196)

El paso 3 de `verificar-todo.sh` decide entre usar los emuladores que están y
levantar unos efímeros, y era un `if` en bash sin test que desde B-217 decide
**dos** ramas. Salió a `scripts/emuladores-arriba.sh`, por el mismo argumento que
sacó `que-deployar.sh` del YAML: una decisión que no se puede probar se prueba en
producción, y acá «producción» es el momento de pushear — donde el modo de falla
es un gate que corta por su propia plomería, lo cual enseña a saltearlo.

Se prueba con un servidor HTTP de dos líneas apuntado por
`FIREBASE_EMULATOR_HUB`. Dos detalles que valen: hay un aserto de que el gate
**consuma** el script y no tenga su propia copia —extraer la decisión y dejar la
copia adentro es peor que no extraerla—, y el caso del 503 es el que hace que el
`-f` de `curl -sf` signifique algo (sin él, cambiarlo por `curl -s` pasa los otros
dos tests).

**Y ojo con `execFileSync` en un test así**, que costó un rato: el servidor de
mentira vive en el mismo proceso, así que una llamada sincrónica bloquea el event
loop, el servidor no llega a contestar y el caso «arriba» da `false`. El test
mediría el bloqueo y no la decisión.

### Un gate para los `.env` versionados — B-213 (D-198)

Versionar algunos `.env` es una excepción deliberada y bien argumentada, pero la
única defensa era la memoria, y es la puerta que publica de la forma más
irreversible que hay: un commit a un repo público. Todas las otras puertas del
proyecto ya tenían gate automático; ésta no.

`tests/env-versionados.test.ts` exige que toda clave sea `PUBLIC_*`, una excepción
nombrada o esté vacía, y que ningún **valor** tenga forma de secreto. **Nunca
imprime un valor**: un test que falla mostrando el secreto lo copia al log de CI,
que también es público.

**Dos cosas que salieron de escribirlo.** El ítem decía «los tres `.env`
versionados» y **son cuatro**: el que faltaba en la cuenta es `.env.example`, y es
el que más importa, porque es el único que **nombra** las tres claves secretas del
proyecto con el `=` puesto y el valor vacío — el camino corto a la fuga no es
agregar una clave, es rellenar una que ya está esperando. Por eso el gate
descubre los archivos con `git ls-files` en vez de listarlos: un quinto entra
solo, que es exactamente lo que le pasó al cuarto. Y `AIza…` **no** está en los
patrones de secreto a propósito: es la forma de la API key del SDK web, que se
versiona deliberadamente, y un gate que grita por el caso legítimo enseña a
apagarlo.

Verificado a mano antes de tocar nada: los cuatro archivos solo tienen `PUBLIC_*`
más `GOOGLE_CALENDAR_ID`, `GITHUB_REPO` y `FIRESTORE_EMULATOR_HOST`. No había nada
que no debiera estar versionado.

### El saneador del issue va en un punto de paso obligado — B-137 (D-197)

`construirIssue` aplicaba `redactar()` campo por campo, en cinco lugares sobre la
entrada. B-81 fue una instancia de eso y se arregló con una línea; la clase quedó
abierta. Ahora se sanea una vez sobre el `title` y el `body` ya armados.

**El `auditor-privacidad` encontró tres cosas sobre el propio arreglo**, y la
segunda es la que más enseña:

1. **El barrido no barría los campos privados del reporte** (B-361): el fixture
   tenía 8 de las 13 claves de `reporteValido()`, y las que faltaban eran las que
   el §5.1 prohíbe publicar. La lista ahora se **lee de `firestore.rules`**.
2. **El centinela no alcanzaba para esos campos.** Es un link de zoom, o sea justo
   lo que el saneador tapa, así que un campo que se cuela y se sanea deja el
   barrido en verde igual que uno que no se cuela: los dos hechos se confunden.
   **Se comprobó por mutación** — interpolar el mail del reportante en el
   encabezado **sobrevive** a un aserto contra el mail del fixture. Hay un segundo
   barrido con un centinela que el saneador deja pasar.
3. **El orden sanear→recortar no lo fijaba ningún test** (B-362), y el recorte es
   alcanzable porque `redactar` no acorta, **expande**: «link de reunión oculto»
   son 24 caracteres contra los 12 de un `http://wa.me`. Con el orden invertido,
   un título al tope publicaría medio link de reunión, legible.

Además **B-360**: dos asertos de `reportes.test.ts` que no podían fallar, porque
comparaban contra un literal que no está en ningún fixture. Y el arreglo obvio
—usar el mail real del fixture— **tampoco sirve**, por el motivo del punto 2.
Ahora preguntan por la forma.

Quedan abiertos **B-363** (el límite real del punto de paso único: `desSlug` corre
aguas arriba y le mete un espacio al medio del patrón) y **B-364**.

### Tres copias que dejaron de ser copias — B-165, B-215 (D-200), B-166 (D-199)

- **`FORMATO_VERSION`** se importa en el test de privacidad en vez de copiarse
  (B-165). B-88 había ampliado el formato real sin tocar esa copia, así que el
  predicado de admisibilidad era más angosto que el del código.
- **Los doce nombres de los meses** salieron a `src/lib/meses.ts` (B-215 parcial).
  La copia tenía un comentario que la justificaba y el argumento no se sostiene:
  los nombres no son de ninguno de los dos dominios, son un hecho del castellano.
  Queda escrito por qué, en vez de borrado.
- **`'desconocida'`** es un valor propio del vocabulario de analítica y ya no cae
  en la bolsa de `'otro'` (B-166). Después de B-88 un `version: otro` con volumen
  **es una alarma**, y compartiendo valor no se podía distinguir del ruido de dev:
  era lo único útil que ese parámetro podía decir.

**Y las dos guardas nuevas enseñaron algo que vale para todas las de su clase:**
el primer intento usó `git grep`, y está mal. `git grep` solo mira el índice, así
que un archivo nuevo **todavía sin agregar** —el estado exacto de una copia recién
escrita— es invisible, y la guarda daba verde justo en el momento en que tenía que
hablar. Van con `grep -r` sobre el disco.

### Un aserto que verificaba el `import` — B-202

`tests/foco.test.ts` pedía que `indiceDeTecla` **apareciera** en
`MenuAcciones.tsx`, y eso lo satisfacía el import de la línea 3: borrar la llamada
dejaba el test verde mientras el `it` prometía «navega con teclas». Ahora verifica
que se llame y que el resultado se use.

Lo que a propósito **no** se hizo: apretar el aserto a la línea exacta de hoy. Eso
volvería a ser un test de ortografía —renombrar la variable local lo rompería sin
que el comportamiento cambie— y un test que se rompe por un renombre está mal
escrito, no es el código el que está mal.

De las dos instancias que el ítem nombraba quedaba una: la segunda ya no existe
desde el refactor de B-210.

### Cómo se verificó

- **Dos corridas concurrentes**, tres rondas: verde en las seis. Contra **6 de 6
  rojas** con `--misma-base`, que es la mutación del arreglo.
- **La suite completa tres veces**: 2.208 tests en 97 archivos, idéntico en las
  tres (2.206 más los 2 de Storage, que se saltean si ese emulador no está), **con cinco frentes más trabajando contra el mismo emulador** — que es la
  condición exacta que disparaba el bug.
- **Once mutaciones**, una por guarda nueva, y todas mueren: reintroducir un
  `redactar` por campo, sacarlo de la salida, interpolar el mail del reportante,
  invertir el orden sanear/recortar, quitar una clave del fixture del reporte,
  cargar un secreto en `.env.example`, borrar la llamada a `indiceDeTecla`, quitar
  el caso de `'desconocida'`, reintroducir una copia de `FORMATO_VERSION`, agregar
  una segunda lista de meses, y —la más importante— apagar el aislamiento del
  emulador. La única que **sobrevivió** está anotada arriba, y es la que cambió el
  diseño del test: comparar contra el mail del fixture no verifica nada porque el
  saneador lo tapa.
- `npm run build` verde.

**Lo que no se hizo, y por qué.** De **B-215** quedan abiertas dos de las tres
duplicaciones: el `useEffect` de carga toca `src/components/`, que era de otro
frente, y la adopción de `tests/fixtures/` es un cambio ancho sobre archivos que
varios frentes estaban tocando a la vez. De **B-08** (sin tests de componentes) no
se hizo nada de código: agregar una librería de render es una decisión de
arquitectura y una dependencia nueva, así que va con argumento y a decisión del
dueño — está en el ítem del BACKLOG.
## 2026-09-02 · la Function que optimiza las imágenes propias (B-220, DEC-7d)

Cierra **B-220**, y con él **B-300** y **B-266**. El porqué completo está en
**D-175**; acá lo que cambió y los números.

**La página más pesada del sitio pasó de 3226,7 KB a 184,3 KB** —17,5 veces más
liviana— **sin tocar una sola plantilla**, y recorrer `/cartelera` entera pasa de
3518,5 KB a 1032,4 KB (−71 %). Los dos medidos contra las 30 imágenes de
producción, antes y después, corriendo el pipeline sobre los bytes reales.

**La medición cambió el diseño dos veces**, y las dos vale tenerlas anotadas:

- **Recomprimir los JPEG no servía para nada.** 29 de las 30 imágenes son JPEG
  exportados de Instagram: el total baja un 11 %, casi todo aportado por la única
  que no es JPEG, y **en dos casos el resultado pesa más** que el original. De ahí
  `AHORRO_MINIMO`: un JPEG se reemplaza solo si ahorra más del 5 %. Recomprimir
  todo habría sido perder calidad a cambio de nada.
- **El peor caso del sitio era un PNG.** La imagen de 1091,5 KB —11,8 veces la
  mediana— es un PNG de 1024 × 1024, y las **tres** de la página de 3226,7 KB
  también. B-300 decía «un JPEG de 1408 × 768 no tiene por qué pesar 1,77 MB»: no
  era un JPEG. La palanca no era la compresión, era el **formato**: 1091,5 → 34,0
  KB pasándolo a JPEG, contra 752,6 KB dejándolo en PNG optimizado.

**La salida se escribe encima del original**, y eso disuelve el write-back que
B-220 daba por bloqueante: la `url` del documento sigue valiendo, así que no hay
nada que escribir y no hace falta ni la query `array-contains` que Firestore no
sabe hacer ni el documento puente. `ancho`/`alto` siguen siendo verdad como
**razón**, que es lo único para lo que se usan.

### La guarda anti-recursión, que era lo único que no se podía arreglar después

Es la **trampa 12** (la 3 con otra cara). DEC-7d pedía elegir una de las dos formas
conocidas; van **las dos**, y cada una tapa un agujero que la otra no puede:
`customMetadata` es obligatoria porque con la derivada en la **misma dirección** que
el disparador una guarda por prefijo es imposible, y la del prefijo cubre el objeto
que aparezca en otro prefijo **sin** marca.

**Storage no corta la recursión** como Firestore corta la suya a las ~20 (§7.1), y
eso se midió contra el emulador desde una subida de 2,6 KB:

| | ejecuciones del trigger |
|---|---|
| con la guarda | **3**, y para |
| sin la guarda por marca | **4**, y para — pero **no** por ninguna guarda |
| sin la guarda y con `convieneReemplazar` en `true` | **5077 en 40 s, y subiendo** |

**El del medio es un hallazgo, no un detalle.** Hoy hay un **freno accidental**: la
segunda pasada recomprime un JPEG que ya está en su punto fijo, no conviene
reemplazar, y se escribe con `setMetadata` — que dispara
`onObjectMetadataUpdated` y no `onObjectFinalized`. Eso no es una guarda: es la
casualidad de que recomprimir sea una contracción y que el umbral sea mayor que
cero. Por eso la simulación del test modela el **peor** caso y no el
comportamiento amable de hoy, y por eso afirma **qué guarda cortó cada vuelta** en
vez de solo que el lazo terminó.

**14 mutaciones probadas, las 14 mueren** (dos de ellas corridas también contra la
regla de clase, que es otro test): las dos guardas por separado, el `return` de
corte, el corte por metadatos, el umbral de ahorro, el aplanado de un PNG
transparente, el `.rotate()`, `keepMetadata()`, la extensión de la miniatura, el
cache inmutable al subir, anidar `miniaturas/` bajo `imagenes/`, `allow read` en vez
de `get`+`list`, abrirle el `write` al admin y la marca subible desde el cliente.

Y **dos falsos positivos del detector nuevo**, encontrados mutándolo, que son la
lección de B-171 otra vez: `guardaPorMarca` daba `true` con la guarda ya sacada
porque la Function también **escribe** la marca, y `guardaPorPrefijo` daba `true`
por `idDeObjeto`, que compara el prefijo para parsear un nombre y no para ignorar un
objeto.

### Los auditores encontraron un P0 y dos P1, y ahí estuvo la mitad del valor

Tres de los cuatro son cosas que ningún test de este repo podía ver. Detalle
completo en D-175 § auditoría.

- **P0 · la guarda era escribible desde el cliente.** El `customMetadata` lo elige
  quien sube, y `storage.rules` no lo validaba: un `uploadBytes` con
  `customMetadata: { optimizada: '1' }` desde la consola salteaba el trigger
  **entero** y dejaba el JPEG público con su GPS. La capa que este frente presenta
  como «la que no se puede saltear» se salteaba desde la misma consola que motiva
  su existencia. Es la tercera defensa del párrafo de DEC-7b, al lado del tamaño y
  del tipo.
- **P1 · `sharp` no reporta todos los metadatos**, y la rama que **no** recomprime
  los dejaba pasar **para siempre**: sin ver el bloque, el criterio cae al ahorro,
  un JPEG ya comprimido no ahorra, los bytes no se tocan… y se les escribe la
  marca igual, así que el objeto quedaba exento del trigger y del barrido. Un
  archivo que nunca se saneó, marcado como saneado. Lo cierra
  `estructuraConocida`: si no podemos dar cuenta de todos los bytes, se
  recomprime. **Costo medido: cero imágenes más** de las 30 que ya están.
- **Y buscándolo apareció un bloque de 13,6 KB ya publicado.** La portada de
  «Usted está aquí» trae un chunk PNG `caBX` con las **credenciales de contenido
  C2PA**: un manifiesto **firmado por Google LLC** con la herramienta que generó
  la imagen, un certificado y un `urn:c2pa:` que identifica esa copia. Lo dejaron
  pasar las **dos** capas del panel. Tapado en las dos (`caBX` a la lista,
  `jumdc2pa` y `urn:c2pa:` a los centinelas), con el caso real como test. La
  lección es sobre la **forma** de la lista y quedó como **B-323**.
- **P1 · `.rotate()` transpone**, y «conserva la proporción» no lo cubría. Hoy las
  dos medidas coinciden, pero por el orden de `subirImagen` y no por casualidad:
  el panel saca el EXIF antes de medir y antes de subir. La propiedad pasó de
  accidental a afirmada, con dos `it` que cruzan los dos lados. **Y de paso quedó
  al descubierto un bug anterior**: el panel saca la orientación sin rotar los
  píxeles, así que una foto tomada de costado **se publica de costado** — es
  **B-324**.
- Tres correcciones más: `roles/storage.objectAdmin` bajó a `objectUser` (lo único
  que agregaba era el IAM **por objeto**, el canal que `storage.rules` no audita),
  `escribeEnElBucket` dejó de contar un `bucket.file(...).download()` como una
  escritura, y `src/lib/imagenes.ts` entró al índice de productores de la salida 7
  — no estaba, así que un cambio a `urlDeMiniatura` **no disparaba la auditoría**.

### Lo demás

- **`sharp` declarada en `functions/package.json`.** Ya estaba en el árbol como
  dependencia opcional de Astro —así que pasa por el `npm audit` del proyecto—
  pero heredarla del root no alcanza: `functions/` tiene su propio
  `node_modules` en el deploy. Es la primera dependencia binaria del proyecto y
  cambia el tiempo de deploy de las Functions.
- **`miniaturas/` es hermano de `imagenes/`, no hijo**, y el motivo estaba escrito
  de antemano en el test de integración de `storage.rules`: «el día que alguien
  escriba `{ruta=**}` —el que va a hacer falta si mañana hay
  `imagenes/miniaturas/`— la lectura sigue andando, todo lo demás sigue verde, y
  esto se abre sin que nada avise». Se le hizo caso. `allow get: if true`,
  `allow list: if esAdmin()` y `allow write: if false` — ni un admin escribe ahí.
- **El `Cache-Control` de la subida se acortó a 5 minutos** y el `immutable` de un
  año lo pone la Function al terminar: el original vive unos segundos antes de ser
  reemplazado, y marcarlo `immutable` en esa ventana sería pedirle al CDN que se
  quede un año con los bytes que están por reemplazarse.
- **WebP y AVIF no volvieron a `TIPOS_SUBIBLES`**, contra lo que B-220 decía: el
  objeto es público desde el instante en que se sube y la Function corre unos
  segundos después. Vuelven con una zona de subida privada, **B-322**.
- **`scripts/optimizar-imagenes.mjs`** para las 30 que ya están en el bucket.
  Reescribe los mismos bytes y deja que la Function haga el trabajo: una segunda
  copia de `sharp` produciría objetos distintos el día que una de las dos cambie.
  El default es no escribir, es idempotente, y sirve para verificar el deploy.
- **B-221 no se resolvió, y quedó dicho por qué**: no es aceptable estrenar un
  trigger que **borra** objetos en el mismo cambio que estrena uno que **reescribe
  todos** los objetos de ese bucket. Lo que sí quedó anotado es que este cambio
  duplica la cantidad de objetos y que el barrido tiene que conocer los dos
  prefijos — con la ruta derivada, sin índice nuevo.
- **Doc:** D-175 (la decisión completa, con la medición y la auditoría), los
  permisos que necesita el dueño y el barrido en `08-operacion.md`, el prefijo
  nuevo y la corrección de «reglas sin desplegar» en `02-infraestructura.md`
  —**están desplegadas**, verificado contra producción—, las dos capas del EXIF y
  el dato del token en `07-seguridad.md`, la nota de `ancho`/`alto` en
  `03-modelo-de-datos.md`, el comportamiento en `04-funcionalidades.md`, la fila 12
  del mapa de trampas, una entrada de ayuda, una de novedades, y B-320 a B-325.

**Verificado de punta a punta contra los emuladores** (Storage + Functions, en
puertos aparte para no pisar la suite de otro frente), subiendo dos imágenes reales
de producción: el PNG de 1091,5 KB quedó en 34,0 KB con `contentType: image/jpeg`,
el JPEG de 101,9 KB no se tocó, las dos miniaturas se escribieron, **la URL vieja
con su token sigue devolviendo 200** con los bytes nuevos, y el trigger corrió 5
veces en total — 2 optimizando y 3 cortando — sin que el bucket creciera.
## 2026-09-02 · «Más en septiembre» en la página de detalle

**B-280.** El §2.2 del diseño pide dos entradas a `/agenda/{aaaa-mm}`: la tira al
pie de la home —que B-113 construyó— y un enlace desde el detalle. La segunda
faltaba, y no era simetría: quien cae en una página de detalle desde Google o
desde Instagram no tenía **ninguna** forma de ver qué más hay ese mes sin volver a
la home y filtrar. Y del lado del buscador, un segundo link interno hacia la
página de mes es lo que la hace valer algo.

**Dónde vive la decisión, que es lo que el ítem no preveía.** El ítem decía «el
enlace solo se puede pintar si el mes pasó el corte de tres», y eso la plantilla
no lo puede evaluar: `mesesEnlazables` recorre el índice entero y la página de
detalle no lo ve (D-140). El atajo que uno escribe —`rutaDeMes(detalle.proxima.iso.slice(0, 7))`—
compila, se lee bien y arma una URL válida; lo que no puede saber es si esa página
se generó, porque depende de **cuántas otras** actividades caen en ese mes. El
resultado sería un 404 servido desde la página que más tráfico recibe, y recién el
mes que tenga dos actividades.

Así que el mes viaja en el view-model: `DetallePublico.mes` es
`{ clave, nombre } | null` y lo decide el lector, con el mapa de meses enlazables
que ya calcula una vez para todo el build. Es el mismo patrón con el que B-110
resolvió `cancelada` y B-109 la fecha de las canceladas: **lo decide quien tiene
el dato**. El default del argumento es `{}` —no enlazar nada—, que es el lado
correcto del error.

Dos detalles del cómo:

- **Cuál mes, cuando hay dos.** El de la **próxima** fecha en pie. Un ciclo del 3
  de septiembre al 22 de octubre cae en las dos páginas de mes (§7.5); el enlace
  contesta «qué más hay cuando voy a esto», no «en qué meses ocurre el ciclo». Se
  corre a octubre solo cuando septiembre pasa, sin ninguna regla más.
- **El nombre sale del mapa**, no de un segundo `nombreDeMes`. Con dos
  derivaciones el enlace podría decir «Septiembre» y la página «Septiembre de
  2026» — la clase de B-88 en su versión más chica, y la que nadie mira porque las
  dos frases se leen bien por separado.

**Verificado sobre HTML construido** contra el emulador, con datos sembrados a
propósito (13 actividades: 5 en septiembre, 4 en octubre, 2 en noviembre, 2
pasadas). Los cuatro casos: septiembre enlaza `/agenda/2026-09/`, noviembre —dos
actividades, sin página— no enlaza nada, una pasada tampoco, y el ciclo enlaza
septiembre. Siete casos con mutación en `tests/detallePublico.test.ts` y uno en
`tests/pagina-de-detalle.test.ts`, que prohíbe el atajo de derivar la clave del
mes en la plantilla.

## 2026-09-02 · una sola forma de la ruta, la que contesta 200

**B-293, con [D-180](06-decisiones.md).** Firebase responde `/cartelera` con un
**301** a `/cartelera/` —medido contra producción el 2026-09-02, porque Astro emite
una carpeta con `index.html` por página—. La canónica y el sitemap ya salían **con**
la barra desde D-165; los `href` del propio sitio seguían sin ella y pagaban un
viaje de ida y vuelta por click.

**De las dos salidas posibles se eligió la segunda**, la que no toca producción:
agregarle la barra a los `href` en vez de poner `"trailingSlash": false` en
`firebase.json`. El motivo está en D-180, y lo que importa del cómo es que ahora
**hay una sola forma de la ruta y la produce `rutaCanonica`**:

| | Antes | Ahora |
|---|---|---|
| la canónica y el sitemap | `/cartelera/` | igual |
| el `href` del encabezado, del pie, de la ayuda | `/cartelera` → 301 | `/cartelera/` |
| dónde se escribe | un literal por plantilla | `RUTA_CARTELERA` en `src/lib/rutasPublicas.ts` |

`rutasPublicas.ts` gana las seis constantes de las páginas fijas
(`RUTA_AGENDA`, `RUTA_CARTELERA`, `RUTA_SUSCRIBIRSE`, `RUTA_AYUDA`,
`RUTA_CONTACTO`, `RUTA_PASADAS`) más las dos de los hubs temáticos y los
constructores `rutaDeTipo` / `rutaDeBarrio` que **B-330** va a necesitar — así el
frente de los hubs no puede introducir una segunda forma. Y las constantes están
definidas **pasándolas por `rutaCanonica`**, o sea que no hay forma de escribir acá
la variante que redirige.

Dejaron de tener literales el encabezado, el pie, `SuscribirseResumen`,
`ayudaDelSitio.ts` y `contactoDelSitio.ts` —los dos últimos eran los que faltaban
en el relevamiento del ítem, que solo nombraba el markup—.

**El chequeo nuevo** (`tests/canonico.test.ts`): un barrido de **todo `src/`** que
falla si algún archivo escribe un `href` interno que no está en la forma canónica.
Lo que se permite no es una lista de este test —la raíz, las anclas, los archivos
de la raíz como `/marca.svg`— sino lo que `rutaCanonica` ya decide: lo que se
compara es `ruta === rutaCanonica(ruta)`.

**Y el barrido nació con un agujero que encontró la mutación, no la revisión.** La
primera versión miraba solo `href="/…"` —el atributo de un `.astro`— sobre
`src/pages`, `src/components` y `src/layouts`. Al probar la mutación que su propio
comentario prometía (volver a poner `href: '/cartelera'` en `ENLACES` del
encabezado) **pasó en verde**: el bug vivía en la forma `href: '/…'`, la de una
lista de enlaces en JavaScript, que era justo la que el regex no leía. Y el alcance
por carpeta dejaba afuera `src/lib/`, donde estaban ocho de los nueve literales.
Hoy son cuatro formas (`href="…"`, `href: '…'`, `href: "…"`, `href={'…'}`) sobre
`src/` entero, con un control positivo que cuenta cuántos `href` vio: si los cuatro
regex dejaran de matchear, el barrido volvería a pasar sin haber mirado ninguno,
que es exactamente lo que estuvo haciendo.

Las tres mutaciones quedaron probadas: el literal en `ENLACES`, el literal en
`ayudaDelSitio.ts` y `export const RUTA_CARTELERA = '/cartelera'` escrito a mano.
Verificado además sobre el HTML construido: los `href` internos de
`dist/index.html` salen todos con la barra (`/ayuda/`, `/cartelera/`, `/contacto/`,
`/pasadas/`, `/suscribirse/`), y los dos archivos de la raíz sin ella.
## 2026-09-02 · fuera la entrada de /contacto

**Dos párrafos que le explicaban al visitante las decisiones de diseño del sitio.**
Decían que no hay formulario porque no hay nada del otro lado que lo reciba, y que
el asunto viene puesto a propósito y conviene dejarlo. El dueño los sacó, textual:
«quedó muy IA».

Tiene razón, y vale nombrar el patrón porque va a volver a aparecer: **el texto
justificaba el sitio ante quien lo usa.** A nadie que entra a una página de
contacto le interesa por qué no hay un formulario — quiere escribir. Lo que
ocupaba ese lugar ya lo dicen los dos botones, que se llaman por lo que hacen.

**Y se sacó el test que lo verificaba**, no solo el texto. Había un aserto que
pedía que la entrada mencionara «formulario», con el motivo escrito: «es la
pregunta que se hace quien busca un campo de texto y no lo encuentra». Sin el
texto, ese aserto no puede ser cierto, y dejarlo apuntando a otra cosa habría sido
peor que borrarlo. Lo que se pierde queda dicho: quien busque un campo de texto ya
no encuentra una explicación, encuentra dos botones.
## 2026-09-02 · las imágenes que la actividad tenía y la página no mostraba

**B-296.** `src/pages/actividad/[slug].astro` hacía `detalle.imagenes[0]` y pintaba
esa sola, así que las actividades con dos o tres imágenes cargadas tenían imágenes
que **no aparecían en ninguna salida del sitio**. Lo reportó el dueño como «tiene
imágenes pero no se ven»; el síntoma inmediato era otro —el build tenía siete
minutos menos que la edición— pero al investigarlo apareció esto.

**Medido contra producción, leyendo Firestore:** 46 publicadas — 16 sin imagen, 26
con una, 3 con dos y 1 con tres. Las 30 imágenes son **todas propias**, ninguna
externa. **Eso decidió la forma**: el caso normal es una sola imagen, así que **con
una sola la sección nueva no existe en el HTML** y esa página es la de antes. Es el
87 % de las que tienen imagen, y el gate mecánico lo verifica sobre el archivo de
verdad.

Las secundarias van al final de la columna de contenido, antes del colofón
«Organiza»: grilla de dos columnas —tres en `sm` cuando son tres—, cada una con su
propia proporción y sin recortar (D-147), `loading="lazy"`, `decoding="async"` y la
caja reservada con `width`/`height` más el `aspect-ratio` de esa imagen. **La
posición es parte de la optimización y no una preferencia de diseño**: `lazy` es una
pista que el navegador atiende según la distancia al viewport, y pegadas a la
portada se piden igual. La portada no cambia: sigue arriba, sigue siendo el
`og:image` y sigue siendo la única que muestra la cartelera.

### La decisión de accesibilidad es D-168, y era el problema real

DEC-7a (D-125) deriva el texto alternativo del **título de la actividad**, a
propósito. Con una imagen funciona; **con tres, el mismo alt tres veces es peor que
no tenerlo** — se anuncia lo mismo tres veces y no se distingue ninguna. De las
cuatro salidas que B-296 dejó planteadas:

- **las secundarias van con `alt=""`** —decorativas—, y la portada conserva el suyo;
- **lo que eso callaría lo dice el `<h2>` una sola vez y en prosa:** «Dos imágenes
  más» (`rotuloDeGaleria`). Es la salida de *enumerar* subida un nivel: del `alt` de
  cada imagen al nombre del grupo, así que se dice una vez en vez de tres y no suena
  a contador;
- **el epígrafe es el `figcaption` de su imagen y nunca el `alt`**: con el mismo
  texto en los dos lugares se anunciaría dos veces, y encima el `figcaption` lo ve
  todo el mundo.

Lo que descartó la salida «el epígrafe es el alt» no fue el argumento sino el dato:
**ninguna de las 4 secundarias de producción tiene epígrafe cargado**, así que habría
descrito cero imágenes. **No se reabre DEC-7a** — no hay ningún campo nuevo. Lo que
la salida elegida renuncia está escrito: una foto con contenido propio no se
describe. Eso es **B-301**, y es decisión del dueño.

**Sin lightbox**, y por eso la tira no agrega ni una parada al orden de tabulación:
la página tiene un presupuesto de 0 KB de JavaScript y un visor modal accesible es
mucho más de lo que este ítem pedía.

### El peso, con los números

Sin la Function de recompresión (B-220, DEC-7d) una imagen propia se sirve tal cual
la subieron. `Content-Length` real de las 30: mediana **92,6 KB**, p90 **124,2 KB**,
máximo **1091,5 KB**. Las cuatro páginas con galería suman 214,3 / 111,9 / 130,8 y
**3226,7 KB**. El markup no cuesta nada: **+165 B gzippeados** por dos secundarias,
medido sobre `dist/`.

Tres de las cuatro se sostienen sin discusión y las otras 42 páginas no cambian un
byte. **La cuarta no se sostiene, y no se sostenía ya antes de la galería:** «Usted
está aquí» tiene una portada de 1,07 MB —11,8 veces la mediana— y una secundaria de
1,77 MB, que es el 59 % del tope de 3 MB. Y **el techo se movió**: con una imagen
servida el peor caso legal de una página de detalle era 3 MB, y con cuatro son 12
MB. Eso es **B-300**, que es el segundo disparador de B-220 y el primero que mueve
el costo de *una página* en vez de un recorrido.

### La red

`tests/galeria-del-detalle.test.ts` — 27 casos, en las dos mitades de D-140: qué
decide el view-model sobre las funciones de verdad, y qué escribe la plantilla
leyendo el `.astro`. Y `scripts/build-contra-emulador.mjs` gana una quinta actividad
sembrada —tres imágenes de proporciones distintas, con la portada **segunda** en el
array a propósito— y ocho pasos sobre el HTML construido, que es lo único que puede
ver tres medidas atravesando una plantilla que vitest no renderiza.

### Mutaciones

18 aplicadas, 18 detectadas. Las cuatro que importan: **la portada dejando de ser
la primera** (sacar el reordenamiento de `imagenesDeDetalle` — la cabecera muestra la
foto del patio *y* el flyer baja a la tira con `alt=""`, que es B-268 con una segunda
cara peor); **una secundaria heredando el `alt` de la portada**; **el `eager` en una
secundaria** (idéntico en pantalla, 1,07 MB → 3,15 MB en la primera carga); y **el
caso de una sola imagen** (`slice(0)` la pinta dos veces, con un `<h2>` que dice «Una
imagen más» sobre la misma imagen — y en el gate mecánico eso pone en rojo cinco de
los ocho pasos).

Las otras catorce: el epígrafe promovido a `alt` —invisible en el HTML de hoy porque
el epígrafe está vacío, así que **solo** la ve un aserto sobre el fuente—,
`fetchpriority` en una secundaria, la caja sin reservar, el `referrerpolicy` borrado,
el tope de alto de la portada aplicado a una celda, la imagen envuelta en un enlace
al JPEG, el `<h2>` sin la cuenta, la grilla escrita a mano en la plantilla,
`columnasDeGaleria` sin tope o siempre en 1, `rotuloDeGaleria` siempre en plural o
sin fallback, la grilla sin `items-start` y el `object-cover`.

### Lo que encontraron los auditores

**Privacidad, cuatro hallazgos, uno P1.** El fixture nuevo sembraba `storagePath` en
las tres imágenes «para que el barrido cubra la salida nueva» y **el barrido no
estaba**: el único barrido de centinelas sobre HTML corría sobre la cancelada, que
tiene una sola imagen y por lo tanto no genera la sección. Se agregó, sobre la página
con galería **y** sobre la publicada, que tampoco se barría. Los otros tres: el
centinela del epígrafe estaba en la imagen que el `events.json` ignora, así que ese
aserto pasaba sin probar nada; la trampa 13 tenía red en la cartelera y no acá, y el
detalle **pasó a ser** una página de varias imágenes; y `src/lib/afiche.ts` produce
ahora texto de la salida 6 y no estaba en ninguna de las tres tablas de productores.

**Documentación:** el checklist completo, más dos drift reales. `D-149` y `B-266`
decían «el detalle pide una», premisa que sostiene su argumento y que dejó de ser
cierta; las dos quedan corregidas sin reescribir el original. Y `docs/README.md`
tenía el paso 2 de «Antes de tocar nada» **tres veces**, con tres conteos distintos:
se colapsó a uno, con el conteo de esta corrida (2.175 tests en 93 archivos). La
misma cicatriz en `13-agentes.md` sigue siendo **B-294** — ahí hay que *elegir* cuál
texto queda en cada fila, y eso es criterio, no merge.
## 2026-09-02 · el dominio propio y la marca

**`https://agendaleh.ar` es el sitio.** B-109, que estaba bloqueado esperando el
dominio y desbloquea la cadena de indexación: `site`, canónica absoluta, Open
Graph, `robots.txt`, `sitemap.xml` y `/pasadas`. El dueño registró **las dos
zonas** —`.ar` y `.com.ar`— y eligió `.ar` como canónica.

Vale anotar por qué la canónica urgía: **tres hostnames servían contenido
idéntico** —las dos zonas más `agenda-literaria.web.app`, que Firebase no apaga
nunca— sin canónica y sin redirección. Contenido duplicado de manual. Se resolvió
antes de que hubiera algo indexado, que es cuando sale gratis.

**Y la marca — B-295.** El logo salió de un generador como tres PNG de 1024×1024,
y **ninguno era usable tal cual**: entre 707 KB y 1,5 MB, sin transparencia y con
la textura de papel pegada. Un favicon que se baja entero para verse a 16 píxeles,
y con un fondo de un blanco distinto del `papel` del sitio.

**La sigla se trazó a SVG.** Es geometría pura: una descomposición del bitmap en
rectángulos alineados al eje dio doce, y doce cubren el **99,9%** de la tinta.
Descartando tres astillas de antialiasing quedan **nueve**. La traza se verificó
**rasterizándola contra el original**: 99,69% de coincidencia, 41 píxeles de más y
1023 de menos sobre 339.037.

De 707 KB a **2,6 KB**, y nítida a cualquier tamaño. Y no es casualidad que
aguante: todo cae en una retícula donde el trazo mide 82 y los brazos 102 sobre una
caja de 820 — el trazo es exactamente el **10% del alto**, que es lo que le da
1,3px de trazo y 1,3px de hueco a 16 píxeles. La pieza con bajada, medida igual,
cae a 0,2px de trazo a 32px: por eso una es el favicon y la otra el encabezado.

**El logotipo del encabezado no va como imagen.** El desfasaje de dos tintas se
compone con `text-shadow` sobre el texto que ya está en Fraunces: cero bytes,
nítido a cualquier cuerpo, y el desplazamiento en `em` escala con el tamaño. Las
dos tintas van **para lados opuestos con una sola cantidad**, que es la corrección
que costó dos vueltas de logo — un desfasaje donde cada tinta se corre para donde
quiere deja de leerse como imprenta y pasa a ser decoración. Se apaga en
`forced-colors`.

**La imagen para compartir se cuantizó a los tokens del sitio**, no a los colores
que el generador dibujó, y se aplanó la tarjeta redondeada, que contradecía el
radio 0 del sistema. De 1.528 KB a **13 KB** con cuatro colores. Y con ella el
`og:image` pasa a tener respaldo: **se cambió el criterio de B-109 porque cambió el
hecho** — antes no había imagen que ofrecer y un `og:image` roto era peor que
ninguno; ahora hay una.

De paso, un typo propio: al cambiar la tipografía se había reemplazado media
palabra y un comentario del encabezado decía «la misma **disploni**».

**2.145 tests.**
## 2026-09-02 · el sitio tiene dominio: canonical, Open Graph, sitemap.xml, robots.txt y /pasadas

**B-109, [D-165](06-decisiones.md), [D-166](06-decisiones.md),
[D-167](06-decisiones.md).** El dueño eligió el dominio —**`agendaleh.ar`**— y con
eso se cerró el ítem que bloqueaba la cadena desde que el sitio existe. Estaba
esperando desde el 2026-08-27 (DEC-6).

**El dominio se escribe una sola vez.** `SITIO`, en `src/lib/rutasPublicas.ts`, y
`astro.config.mjs` lo **importa** para su `site`. De esa constante salen los
cuatro consumidores que necesitan URL absoluta —el `canonical`, el `og:url`, el
`<loc>` del sitemap y el `url` del JSON-LD— y las cuatro copias fallan en
silencio: un canonical viejo hace que Google indexe otro dominio, un `og:url`
viejo manda a otra parte el link pegado en Instagram. `tests/canonico.test.ts`
barre **todo** `src/` y falla si el dominio aparece escrito en cualquier archivo
que no sea el que lo define.

**El canonical es absoluto, y eso es la mitad del cambio.** Los tres hostnames que
responden hoy —`agendaleh.ar`, `agendaleh.com.ar` y `agenda-literaria.web.app`—
sirven contenido **idéntico**, y el último no se apaga nunca porque Firebase no lo
permite. Un canonical relativo se resuelve contra el host que lo sirvió, así que
en el espejo diría que la página buena es la del espejo. Con el absoluto, los tres
le dicen a Google lo mismo. Se arregló ahora porque **todavía no había nada
indexado**: mudar un canónico después cuesta meses de posicionamiento.

**Con barra final**, que salió de medir y no de suponer: `curl -I
https://agendaleh.ar/cartelera` devuelve un **301** a `/cartelera/`. Una canónica
que apunta a una redirección es un aviso en Search Console y una entrada de
sitemap que redirige es una URL menos rastreada.

**El sitemap y el `robots.txt` se generan a mano**, no con `@astrojs/sitemap`: las
reglas de qué entra son propias —90 días para las pasadas desde su última fecha,
30 para las canceladas desde su última edición, meses con 3 o más y sin la del mes
vencido— y el integrador armaría el sitemap **de lo que hay en `dist/`**, que es
justo donde están, a propósito, todas las páginas que no tienen que estar en el
sitemap. Salir del sitemap no es dejar de existir: las tres siguen respondiendo.

**`updatedAt` se resolvió sin agregarlo a la proyección.** La ventana de 30 días
necesita saber cuándo se canceló algo, que no es un dato del modelo. Lo lee **el
lector** del documento crudo y viaja **al lado** de la proyección
(`canceladasEditadasEn`), igual que la bandera `cancelada` de B-110 — y es un
**predicado**: decide si la URL entra y no se emite en ninguna parte. El sitemap
va sin `lastmod`, así que `updatedAt` sigue sin salir a ninguna salida (D-166).

**`/pasadas`** es la otra pieza, y no es una sección más: es la que hace que
ninguna página de detalle quede huérfana. Con la entrada del sitemap venciendo a
los 90 días, a partir de ese día es el **único** link interno que le queda a una
actividad que pasó. Se llega desde el pie de todas las páginas, y **cierra B-281**
de paso: el aviso de un mes vencido ahora manda ahí y no a la home. Dos desvíos
del §4.5, los dos en D-167: sin atenuar (el sistema visual prohíbe las opacidades)
y sin buscador propio (**B-292**).

**Un bug que ya estaba en producción, encontrado en el camino (B-290):** la fila
de una actividad que ya pasó decía «Inscripción abierta» si no tenía fecha de
cierre cargada — el modo de falla que el §7.1 nombra con esas palabras, y que la
página de detalle ya evitaba decidiendo el CTA por fecha. Se veía en la página de
un mes vencido y con el filtro «Cuándo» en un mes que pasó; `/pasadas`, que es
cuarenta filas pasadas, lo puso a la vista. `avisoDeTarjeta` no dice nada cuando
la actividad terminó.

**Dos salidas públicas nuevas** —la 9 (`sitemap.xml` + `robots.txt`) y la 10
(`/pasadas`)— entraron a las tres tablas que las atan y al barrido de centinelas
**en el mismo cambio que las creó**. Y el parseo que compara esas tres tablas se
podía acortar sin fallar: leía `(\d)`, así que la fila `| 10 |` no matcheaba, el
barrido cortaba en la 9 y las tres seguían coincidiendo entre sí sin cubrirla.

**Catorce mutaciones probadas, todas rojas** — las seis que pedía el ítem y ocho
más. **Tres guardas pasaron en verde con la mutación puesta**, que es el hallazgo
más útil del barrido: el `noindex` del panel se verificaba con un `toContain` sobre
el archivo entero y su propio comentario lo nombraba; el `url` del
`VirtualLocation` (§5.4) no lo miraba nadie porque el detalle por defecto es
presencial y no emite ese lugar; y el parseo de la tabla de salidas. Las tres se
arreglaron.

**El gate del emulador mira los archivos que se suben** (paso 7 de
`scripts/build-contra-emulador.mjs`): que el sitemap ofrezca la publicada y la
cancelada reciente con URL absoluta y barra final, sin el borrador, sin `/admin` y
sin `lastmod`; que el `robots.txt` bloquee el panel; y —el que más cubre— que el
robots, el sitemap y la canónica de la página **coincidan en un solo origen**. El
dominio no se escribe en el script: se afirma que las tres salidas concuerdan, así
que si alguna lo copia a mano, discrepan.

**Y el `auditor-privacidad` encontró cinco cosas sobre este mismo cambio**, todas
arregladas acá: la decisión de B-112 estaba pre-escrita al revés (un `lastmod` con
el ISO completo publica el instante de cada edición, que con un solo admin es su
agenda de trabajo — D-138; queda decidido que sale recortado al día), la prosa de
su propia ficha seguía diciendo «las ocho salidas» mientras su tabla decía diez
(ahora hay un test que compara las dos), la fila 9 no nombraba a los dos que
deciden qué página se ofrece (`mesesEnlazables` y `estadoDe`), la barra final
dependía de dos cosas que el repo no ataba (`cleanUrls`/`trailingSlash` de
`firebase.json` y el `build.format` de Astro: agregar `cleanUrls: true` invertiría
la redirección y convertiría **toda** canónica en un puntero a un 301), y el
`og:image` prometía «absoluta o nada» sin que nada lo verificara — ahora se
absolutiza sola, que es lo que **B-291** va a necesitar.

**La ayuda del panel dejó de mentir el día que dejó de ser cierta**, que es lo que
B-242 pedía: dos textos decían que el sitio no estaba publicado. Y entró la
novedad que ese ítem reservaba, con lo único que le importa a quien carga: que el
link se puede pegar en Instagram y sale con el flyer.

**Lo que queda afuera, a propósito:** las cinco imágenes de Open Graph por tipo
(**B-291**), el `lastmod` (**B-112**), el buscador de `/pasadas` (**B-292**), que
los `href` internos dejen de pagar el 301 (**B-293**) y los hubs (**B-108**), que
cuando existan entran a `RUTAS_FIJAS` porque el test de la lista lo va a pedir. Y
**del lado del dueño**, en la consola de Firebase: el 301 de `agendaleh.com.ar`,
la decisión sobre el `www` y el alta en Search Console — **B-295**, con el paso a
paso en [`08-operacion.md`](08-operacion.md) § «El dominio», donde quedaron
escritas además las dos trampas de falla diferida del dominio (el TXT de
verificación es permanente; la renovación de NIC.ar no es automática y la
delegación se apaga el día 31).
## 2026-09-01 · la ficha del detalle deja el azul fijo y lleva el color de su categoría

**B-273, [D-153](06-decisiones.md).** Cierra la mitad que D-150 había dejado afuera
a propósito. La cajita del tipo en `/actividad/{slug}` iba en `bg-azul` fijo, con un
comentario al lado que afirmaba «es la misma que abre cada fila del listado» — y
desde B-270 eso era falso: **quien navegaba del listado al detalle veía la cajita
saltar de color**, que es lo contrario de reconocer la pieza. Lo había encontrado el
`auditor-trampas` al cerrar B-270.

El color llega **ya resuelto** en el view-model (`DetallePublico.tipoColor`) y sale
de `colorDeTipo`, la misma función que pinta la fila: la plantilla no ve las opciones
(D-140), así que no puede derivarlo ni equivocarse de lista. Va por `style` y no por
clase, por lo mismo que en el listado.

**`tonosDelSitio()` es ahora el único lugar del build que arma el mapa de matices**,
y lo usan la home y el detalle — dos derivaciones habrían sido dos maneras de que el
color se separe otra vez, que es la clase de B-88 y el bug mismo. Sale de las
opciones **filtradas por aprobación**, la asimetría opuesta a `etiquetasDelDetalle`
(D-30) y con su motivo: la etiqueta se resuelve sin filtrar porque una actividad
puede tener guardada una opción pendiente, pero el color tiene que coincidir con el
del listado, que solo puede usar la filtrada. El cuarto parámetro de
`detalleDeActividad` es **obligatorio** y no tiene default: un `{}` habría
reproducido el bug en silencio, solo para los tipos pintados a mano.

**Y el par de contraste no es el mismo.** En la fila la cajita es el color **como
texto** sobre el papel; en la cabecera es tinta plena con el **papel calado encima**.
Son dos mediciones distintas y la garantía de D-150 —los 360 matices contra las tres
superficies— solo cubría la primera. `contrasteCaladoDelTono` mide la segunda sobre
los mismos 360: el peor es el tono 191 con **7,27:1** contra un piso de 4,5 — mejor
que los 5,90:1 de la dirección de texto y mejor que el 6,14:1 del `azul` que había,
así que el cambio no gasta contraste, lo gana.

**No existía ningún test que comparara el color entre las dos pantallas**, y por eso
el bug pasó por dos cierres sin que nada fallara. Ahora sí: el cruce en
`color-de-tipo.test.ts` compara **los dos valores producidos**, el describe del
calado recorre los 360, y `detalle-visual.test.ts` guarda que ninguna clase de fondo
sobreviva al lado del `style` inline. Nueve mutaciones probadas.

**Cuatro hallazgos del `auditor-privacidad`**, los cuatro cerrados: la elección de la
lista filtrada no la fijaba ningún test (va un caso de integración con un tipo
pendiente de aprobar), el registro de caminos de una opción pasó de cuatro a cinco
—el quinto no lee el documento, recibe la lista ya proyectada—, la home no tenía
lista blanca de imports del lector, y un comentario del barrido sobredeclaraba lo que
su fixture cubre.

**Abierto en el camino:** B-275 (el rótulo de la cartelera, que se miró y **no** es el
mismo bug) y B-276 (los tests de integración que barren Firestore entero son
sensibles al orden).
## 2026-09-01 · una actividad cancelada conserva su página, y el gate del build por fin la mira

**B-110**, [D-159](06-decisiones.md). El camino ingenuo —`estado == 'publicado'`—
hacía que cancelar una actividad que ya estaba publicada la borrara del sitio: la
URL que estuvo tres semanas en Instagram y en Google empezaba a dar **404**, que es
la peor respuesta posible a «¿se hace o no se hace?» — da a entender que el
problema es de quien pregunta. Y `ayudaDelSitio.ts` ya le prometía a quien lee el
sitio que eso no pasaba.

Ahora el build también trae `estado == 'cancelado'` y, si esa actividad **estuvo
publicada alguna vez**, genera su página con la franja «Esta actividad se canceló»
—arriba de todos los otros avisos, incluido el de B-254—, sin CTA ni canal de
inscripción, con las **fechas intactas** y `eventStatus: EventCancelled` en el
JSON-LD, sin `offers`. No entra al `events.json`, ni al listado, ni a la cartelera.

**El lector se amplió sin abrir la puerta a los borradores, y esa es la parte que
importa.** La query de las publicadas no se tocó: las canceladas entran por una
**segunda** query con su propio `==`, en vez de pasar la primera a
`where('estado','in',[…])`. Un `in` convierte el estado en una lista, y a una lista
alguien le agrega un elemento; con dos `==` no hay lista que crecer y lo peor que
puede hacer un error en la query nueva es no generar ninguna página de cancelada.
Los resultados tampoco se mezclan —`ContenidoDelSitio` gana un campo `canceladas`
aparte—, así que el índice, los chips, el listado y la cartelera **no las reciben**
y no pueden publicarlas aunque se olviden de filtrar.

**Y apareció la parte que el diseño no había puesto a prueba.** «Estuvo publicada»
no es un campo del modelo, y el §7.3 proponía inferirlo de que alguna sesión
conserve `calendarEventId`. El razonamiento es correcto y el dato **se borra
solo**: al cancelar, `syncCalendar` borra los N eventos y escribe
`calendarEventId: null` de vuelta en cada sesión (`reponerIds`, B-80). Con esa
heurística sola, B-110 habría pasado todos sus tests y no habría generado ni una
página en producción. Lo que sí sobrevive es el **historial**: cancelar es un
cambio de contenido, así que queda una versión con `documento.estado: 'publicado'`,
y una actividad que nunca lo estuvo no puede tener ninguna. Se consulta su
existencia con `.limit(1).select()` —id y ningún campo: una versión es el documento
entero de aquel momento—. Falla cerrado en los dos bordes.

`estado` **no** se proyecta, a diferencia de lo que B-112 anticipaba: la bandera
llega como argumento de `detalleDeActividad`, así que `toPublic` no gana un campo y
el `events.json` no puede publicar un estado por accidente. De paso salieron de la
plantilla las dos últimas reglas que vivían ahí como `&&` —`mostrarCanal` y el
texto de la fila «Inscripción»—, que con la actividad cancelada decía «Abierta
hasta el 22 de septiembre» debajo de la franja que dice que se canceló.

**El gate del build mira ahora el HTML** y no solo el `events.json`, porque el modo
de falla de este ítem es un archivo que se genera o no se genera —y eso ningún
unitario puede verlo: `caminosDeDetalle` devuelve rutas, Astro escribe los
archivos—. Siembra cuatro actividades y afirma que la cancelada que estuvo
publicada tiene su página con la franja, el `EventCancelled`, sin CTA y sin ningún
campo privado (con `urlPublica: true` en el fixture, el peor caso combinado), y que
la que nunca se publicó no tiene archivo.

**De paso B-241**, porque B-110 lo necesitaba: el fixture del gate era anterior a
B-224 y traía solo `modalidad`/`sede`/`online` de primer nivel, que son los
derivados. Sin el array `modalidades` no hay `location`, sin `location` no hay
JSON-LD, y sin JSON-LD no había sobre qué afirmar el `EventCancelled`.

Lo abierto: **B-285**, el `publicadaAlgunaVez` explícito.

## 2026-09-01 · la casilla del link de la reunión dice a dónde sale

**B-240**, [D-158](06-decisiones.md). La casilla del formulario decía «Publicar el
link en el sitio» y el sitio **no** lo publica: [D-139](06-decisiones.md) dejó
`online.url` afuera de la página de detalle, así que la casilla prometía una
pantalla que nunca lo muestra.

El ítem ofrecía dos salidas y se elige la del texto, porque **el argumento de
D-139 es asimétrico**: un evento de Calendar se reescribe al destildar la casilla,
y un HTML indexado por Google no se despublica —queda en la caché, en archive.org
y en cualquier scrapeo—. Publicar un link de reunión en una página indexable es
irreversible de una forma en que ponerlo en el evento no lo es.

A dónde sale de verdad con `urlPublica: true`: **solo a la descripción del evento
de Calendar**, que es donde lo ve quien está suscripto. El ítem decía «al
`events.json` y al evento», y al `events.json` no va —lo marcó el
`auditor-privacidad`—: `toPublic` emite la URL (D-15) y `entradaDeIndice` la
descarta (D-129), así que muere en la proyección. Se corrigieron los cuatro
textos: la casilla, la ayuda corta del campo «Link del encuentro» («**por
defecto** no se publica»), el punto `link-reunion` de la guía del panel y la
etiqueta del aviso de campo faltante. **El comportamiento no cambió**, y el barrido de centinelas que lo
fija es ahora uno de los `atadoA` de la guía: si mañana el link sale al detalle, el
test se pone rojo y el texto que promete lo contrario se rompe en el mismo commit.
## 2026-09-01 · qué hay este mes, y la home ofrece suscribirse

Dos ítems independientes que salieron juntos y terminan en el mismo lugar: **el
pie de la home**. B-113 y B-231.

**1 · Las páginas de mes, `/agenda/{aaaa-mm}`** — B-113,
[D-155](06-decisiones.md). «Qué hay este mes» es una forma real de mirar la
agenda, y el §2.2 del diseño ya la había acotado. Las cuatro condiciones viven en
`src/lib/mesPublico.ts`, que es puro y recibe el reloj por parámetro: solo el mes
en curso y los siguientes, solo con **3 o más** actividades, fuera de la
navegación, y cuando el mes termina se emite **una última vez** con aviso, salida
y `noindex` en vez de devolver 404 sobre una URL que estuvo indexada.

El corte de tres no es un número redondo: con una o dos actividades la página es
un casi-duplicado de la home **compitiendo en Google con la página de detalle de
cada una**, así que resta. Y el horizonte hacia adelante sale de los datos y no de
un número de meses —un ciclo cargado para marzo del año que viene tiene su
página—.

**Cero lecturas nuevas de Firestore.** Todo sale del `indiceDelSitio()`
memoizado, que ya arman la home y el `events.json`: el §3 del diseño dice «tres
artefactos con una sola lectura» y las páginas de mes son un cuarto que no cambia
el número. Quién entra en cada mes lo decide `filtrarPublico` con `cuando` puesto
en la clave, o sea **el mismo filtro «Cuándo» de la home**, así que
`/agenda/2026-09` y `/?cuando=2026-09` no pueden contestar distinto.

**El ciclo que cruza dos meses** es la mitad difícil, y se resolvió recortando la
**entrada** y no cada frase: `recorteDelMes` devuelve la misma actividad con solo
las sesiones de ese mes, así que el bloque de fecha, «ya empezó» y el orden de la
página hablan del mes sin que ninguna frase tenga que enterarse. Lo único que
viaja aparte es el total de encuentros, porque «Ciclo de 4 encuentros» en
septiembre cuando son ocho no es un recorte: es información falsa sobre lo que
alguien está por decidir. La frase quedó «Ciclo de 8 encuentros · 4 en septiembre,
del 3 al 24».

Dos extracciones que el cambio pidió y no inventó: `MarcadorDeMes` sale de
`ListaDeActividades` —la página de mes pinta el mismo marcador— y `mesDesplazado`
sale a `fechasPublicas.ts`, donde `mesesDesde` lo reusa: la aritmética de meses
estaba escrita a mano y la página vencida la necesitaba **hacia atrás**, donde la
versión vieja se corría de mes.

Queda afuera el enlace desde el detalle («más en septiembre» del §2.2): **B-280**,
porque `[slug].astro` lo estaba tocando otro frente. Y el aviso del mes vencido
tendrá que apuntar a `/pasadas` cuando exista: **B-281**.

**2 · La home ofrece suscribirse** — B-231, y cierra [D-134](06-decisiones.md).
`SuscribirseResumen` estaba escrito desde B-230 y sin cablear. Va abajo del
listado, que es donde la decisión se toma, con tres detalles que tienen aserto:
fuera del contenedor que la island reemplaza al hidratar, visible **también** con
el listado vacío o filtrado a cero —que es cuando más sirve—, y a lo ancho de
`main` porque habla de la agenda entera.

**Y una salida pública nueva, que el `auditor-privacidad` contó antes del commit**
— B-282. La página de mes no publica ni un campo que el `events.json` no publique
ya, pero es una **página indexada más** y no estaba en ninguno de los tres índices
de salidas (`07-seguridad.md`, la ficha del agente, el skill `campo-nuevo`): un
cambio futuro a `mesPublico.ts` no habría despertado al auditor por nombre de
archivo. Es el agujero de la salida 5 del 2026-08-27, repetido — de índice, no de
cobertura. Ahora son **ocho** en los tres lugares, con `tests/agentes-y-skills.test.ts`
atándolos. El mismo auditor pidió el barrido de centinelas de la salida nueva —una
de sus frases interpola títulos de actividades, y `e.searchText` en lugar de
`e.titulo` estaba a un carácter—, que la plantilla dejara de importar el lector del
índice (D-140) y que su lista de campos permitidos fuera blanca y no negra.

Cada guarda se probó cambiando el código: 22 mutaciones, todas mueren. Dos
sobrevivieron en la primera vuelta y obligaron a arreglar **los tests**, no el
código — el orden se probaba con un fixture donde las dos formas de ordenar daban
lo mismo, y el cableado de `cicloDelMes` no lo miraba nadie.
## 2026-09-01 · los flyers: dejan de recortarse, dejan de estar escondidos, y tienen pared propia

Tres cambios que son uno solo, y arrancan de un número: **42 actividades
publicadas, 2 con imagen**. No falta materia prima —en el circuito literario
porteño el flyer *es* el medio de difusión— faltaba que llegara a la base y que
el sitio hiciera algo con él. B-263, B-264, B-265, B-266.

**1 · La portada dejaba afuera el 51 % del flyer** — B-263, [D-147](06-decisiones.md).
El detalle la pintaba con `object-cover` sobre `--aspect-portada`, que valía
16/9; los dos flyers reales son verticales (720 × 826, o sea 0,87). Y lo que se
recortaba no era margen: **un flyer es texto metido adentro de un JPEG** —título,
fecha, cómo anotarse—, así que el recorte se llevaba justo los datos.

El token **se retira y no se reemplaza por otro número**: cualquier proporción
única recorta alguna forma de imagen. Lo reemplaza `claseAfiche`, que comparte la
**regla** en vez del valor —*ninguna salida del sitio recorta*— con un barrido
sobre todos los `.astro` del sitio, no sobre un archivo. Es más fuerte que lo que
había: el token no impedía usarlo con `object-cover` en una página y
`object-contain` en otra, que es como la divergencia de B-249 volvería.

Lo que D-144 necesitaba no era fijar la proporción sino **topear el alto**, y eso
es lo que ahora hace `max-h-[70svh]`, solo en la variante del detalle. La
proporción sale de `ancho`/`alto` de cada imagen. Para que las externas también
la tengan, **el panel las mide en la vista previa** —solo las filas que la sesión
tocó, porque medir las ya guardadas ensuciaría el formulario apenas se abre—.

**2 · El flyer deja de estar escondido en el panel** — B-264.
Vivía en «Opcional»: un acordeón **cerrado por defecto**, llamado literalmente
así, y la única frase que lo acompañaba tranquilizaba («se ve igual de bien») en
vez de decir qué se pierde. Ahora está en «Qué es», la primera sección y la que
no colapsa; la barra de abajo gana un tercer nivel que dice **qué se pierde** y
no qué falta; y el listado marca «Sin flyer» solo en las publicadas que no lo
tienen —la misma regla que la marca de autoría de B-130: si todo lleva marca, no
avisa nada—.

**Sin traba, y hay un test que lo fija.** Bloquear la publicación por una imagen
frena que se carguen actividades, que es peor que una actividad sin flyer. La
mutación que agrega esa exigencia al schema pone el test en rojo.

Y `guardado_ok` manda ahora `imagenes` como entero: cruzado con `estado`, es lo
único que va a decir si esto funcionó. Sin la métrica, el cambio se hace a
ciegas.

**3 · `/cartelera`, la pared de afiches** — B-265, [D-148](06-decisiones.md).
Todos los flyers de lo que está por pasar, grandes, uno al lado del otro, cada
uno enlazando a su actividad. Es la mitad que hace que valga la pena cargarlos y
la que vuelve verdadera la promesa que el panel escribe.

Una **pared**, no un carrusel: «en continuado» es que no termina, no que se
mueva. Nada avanza solo, así que no hay animación que reducir. Columnas de CSS y
no una grilla, porque una grilla alinea filas y con afiches de altos distintos
cada fila deja huecos. El número de columnas está **atado a la cantidad**: con
los dos de hoy sale una sola columna con tope de ancho —dos afiches grandes, uno
abajo del otro— y la pared se densifica sola. Con cero no se dibuja una grilla
vacía.

Se arma desde el **mismo** `DetallePublico` que genera cada página de detalle, así
que la pared y la cabecera muestran la misma imagen por construcción. **Nunca
desde un listado de Storage** —es la trampa 13 y hay un test que lo prohíbe—.

**4 · El peso, medido** — B-266, [D-149](06-decisiones.md).
La cartelera es la única página del sitio que pide imágenes: la home no pide
ninguna (D-146) y el detalle pide una.

| | 2 flyers (hoy) | 30 flyers |
|---|---|---|
| `dist/cartelera/index.html` | 8,2 KB | 30,8 KB |
| `<img>` | 2 (1 `eager`) | 30 (1 `eager`, 29 `lazy`) |
| bytes de imagen al entrar | ~120 KB | **~180–360 KB** |
| bytes al recorrerla entera | ~120 KB | **~2,6 MB** |

**Por pantalla se sostiene y va a seguir sosteniéndose** —`lazy` hace que el
costo de entrada no crezca con el total—; **por recorrido completo deja de
sostenerse alrededor de los 20-25 flyers**. `sizes` no se puso: sin `srcset` no
hace nada, y las variantes son **B-220**, que sube de prioridad con el disparador
escrito.

**Y un bug preexistente que este cambio iba a propagar** — B-268. La página de
detalle tiraba el flag `portada` y mostraba `imagenes[0]`, o sea la primera
cargada: marcar el flyer como portada con el radio del panel no cambiaba nada, ni
ahí ni —a partir de ahora— en la cartelera. No fallaba nada y fallaba
**coherente**, las dos pantallas mostrando la misma imagen equivocada. Lo encontró
el `auditor-trampas`; se arregló en la proyección, así que todo consumidor del
view-model hereda la respuesta correcta.

**Tres textos del panel que describían pantallas que ya no existen** — B-267,
cerrado. La ayuda decía que subir archivos «todavía no está» (existe desde
D-131), el editor tranquilizaba con «la tarjeta del sitio no reserva un hueco
gris» (el listado no tiene portadas desde D-146) y un punto de la guía tenía una
frase duplicada a medias, arrastre de un merge.

## 2026-09-01 · el color del tipo de actividad y los eventos gratis en los filtros

Dos pedidos del dueño, independientes entre sí.

### El color del tipo se elige desde Opciones — B-270, D-150

Recupera lo que **D-146** había retirado de **D-141**, con la mitad que faltaba: el
color ya no lo impone el sistema visual, **lo administra el sitio**. D-146 no decía
que el color por tipo estuviera mal; decía que una paleta *impuesta por el sistema*
no puede tener ocho tintas, y eso sigue en pie. Lo que se paga —la home pasa de tres
tintas a tres más una por tipo presente— está escrito en D-150, y se acota: el color
aparece solo en la cajita de la categoría, y todos los tonos comparten luminosidad y
croma.

Las tres cosas que había que resolver bien:

**Se deriva del slug y lo elegido es la excepción.** `tipo` es taxonomía
autogestionada: si el color se asignara solo a mano, el tipo creado desde «Otro»
nacería sin color y **nadie se enteraría**. `tonoDeTipo` resuelve en tres escalones —
lo elegido, el tono de arranque, el derivado— y el campo guardado (`tono`, en
`/opciones/tipo`) es la excepción.

**El contraste no depende de quién elige.** El selector ofrece la **banda**, no un
color: luminosidad y croma fijos, doce matices con nombre. Así el espacio de colores
tiene una dimensión y se puede recorrer entero — `tests/color-de-tipo.test.ts` mide
**los 360** contra las **tres** superficies del sitio, y el peor da **5,90:1** contra
un piso de 4,5. Un selector libre habría degradado la garantía a «los que alguien ya
miró».

Tres guardas más, porque la banda es una promesa sobre el presente: `revisarTono` al
guardar (con el ratio y el piso en el mensaje), `esTonoElegible` al leer, y el mismo
filtro al proyectar al `events.json`. El piso de `revisarTono` es un **parámetro con
default** —el patrón de los límites de `rebuild.js`— porque con la banda de hoy la
guarda no se puede disparar, y un test que no pueda subir el piso no la verifica.

**Dónde se ve:** la cajita de la categoría de cada fila del listado público, y la
muestra de la pantalla de Opciones. Va por `style` y no por clase, porque Tailwind
solo genera lo que ve escrito y una clase por tipo dejaría sin color al tipo que
alguien cree mañana.

Y `pintarOpcion` es **la única operación que puede tocar una opción base**: los siete
tipos son `fijo: true`, así que la regla del §4.3 dejaría la pantalla sin nada que
configurar. Lo que `fijo` protege es la identidad, y el matiz es presentación.

### Los eventos gratis en los filtros — B-271, B-272, D-151, D-152

**En la web el filtro ya funcionaba.** Corrido contra el `events.json` de producción
con la misma función que usa la island, el eje «Arancel» devolvía `Gratis (8)`,
`A la gorra (1)` y `Arancelado (32)`. No faltaba código: faltaba **encontrarlo**.

El eje estaba tercero, detrás de «Cómo se cursa» —lo que partía el grupo de «dónde»
al medio y, en el teléfono, lo dejaba abajo del corte del panel de 65svh— y adentro
«Gratis» era el segundo chip, porque los chips se ordenan por cantidad y hay 33
arancelados. **El §6.1 del diseño ya pedía «Gratis y A la gorra primero, siempre»** y
la implementación no lo había bajado. Ahora el eje es el segundo y lo que no se paga
va arriba, decidido por `esSinCosto` — la misma función con la que la fila pinta el
arancel con el acento.

En el panel **no era un bug: era revertir D-74**, que lo había descartado a propósito
(«nadie busca el taller arancelado»). Escrito como el patrón de D-119 → D-132: ese
argumento sigue siendo cierto para la pregunta que contestaba, y la que se pide ahora
es otra —«¿qué tengo publicado que sea gratis?»— que el buscador de texto no puede
contestar porque el arancel no está en el `searchText`. Más el dato objetivo: D-74
razonaba en parte sobre que el sitio público no existía.

Los otros tres descartes de D-74 se revisaron uno por uno y **dos motivos ya
caducaron** (`tags` a medias, `destacado` entero). No se agregan —no se pidieron— pero
quedan en **B-274**: un descarte no puede sobrevivir a su razón sin que nadie lo note.

### Lo que encontraron los auditores

- **`auditor-privacidad`, H1 (P1):** los lectores de un `ValorOpcion` crudo **eran
  tres y son cuatro** — el de la página de detalle no estaba en la clase de B-212 y
  era el único sin nada que nombrara qué podía leer. Se agregó, y la lista pasa a ser
  **por camino**: `tono` es público *de una sola salida*, y una lista compartida
  habría abierto los cuatro de golpe por un campo que necesita uno.
- **`auditor-privacidad`, H3:** `TONOS_DE_TIPO['constructor']` devolvía la función
  `Object` heredada del prototipo — no es nullish, así que el `??` no la atajaba.
  Pasa a `Object.hasOwn`.
- **`auditor-privacidad`, H4:** se podía elegir el color de cualquier taxonomía, y
  `opcionPublica` lo publicaría: el matiz de un barrio en el `events.json` es un dato
  que ninguna salida consume. La guarda va del lado del que escribe.
- **`auditor-trampas` (P1, no arreglado):** la ficha del detalle sigue pintando el
  tipo en azul fijo, con un comentario que dice «es la misma que abre cada fila del
  listado» y que este cambio volvió falso — quien navegue del listado al detalle ve
  la cajita saltar de color. No se tocó porque esos archivos los está tocando otro
  frente; queda como **B-273**.

### Mutaciones

**Treinta y cuatro, todas atrapadas** — pero una recién después de escribirle el
test que le faltaba: bajar el piso por defecto de `revisarTono` de 4,5 a 3 **no
rompía nada**, porque con la banda de hoy ningún matiz baja de 5,90 y el cambio no
altera ninguna llamada posible. Es el mismo agujero que el parámetro `piso` vino a
tapar, un nivel más arriba. Se cerró afirmando el default **sobre el fuente**, con
el motivo de por qué ese caso no se puede ejecutar escrito al lado.

Las otras treinta y tres, por grupo: nueve sobre la banda y la derivación (subir la
`L`, romper la copia de las superficies, aflojar `esTonoElegible` de tres maneras,
confiar en el tono guardado, meter un matiz de otra banda en el selector, escribir
la `L` a mano en el color, poner un tipo inexistente en la tabla); cinco sobre lo
que se publica y lo que se pinta (el `tono` sin validar, el `tono` siempre, el borde
de otro color, el filtro del consumidor, la cajita volviendo a `text-azul`); cuatro
sobre el guardado (saltear el chequeo, no poder tocar una base, guardar `null` en vez
de borrar la clave, dejar `tocaFijas` abierto por default); cuatro sobre el mensaje y
el piso; cuatro sobre los filtros del sitio (el eje al tercer puesto, el orden por
cantidad, el desempate, sacar «a la gorra»); cinco sobre el filtro del panel; y dos
sobre los arreglos de los auditores.

Una de las cuatro del sitio **también se escapó al principio**, y no por el test sino
por el fixture: los dos «Gratis» entraban antes que «A la gorra», así que perder el
desempate por cantidad daba igual el orden correcto por casualidad. Se arregló dando
vuelta el orden de llegada, con el motivo anotado al lado del array.
## 2026-09-01 · la display pasa a Fraunces

**El dueño rechazó la Bodoni** —«no me cierra la fuente que tiene "Agenda LEH", el
mes y el título del evento»— y eligió **Fraunces** entre siete alternativas
puestas en la pantalla real del sitio. B-262.

Vale anotar el método, porque es lo que destrabó una decisión que venía trabada
desde dos rechazos: en vez de describir tipografías con palabras, se armó un
**espécimen navegable** con la marca, el marcador de mes y títulos reales de
producción, y una maqueta del sitio que cambia de fuente al tocar cada candidata.
La tipografía no se juzga leyendo su descripción.

**Es un solo token.** `--font-display` gobierna las tres cosas que el dueño nombró
—la marca del encabezado, el marcador de mes y el título de cada actividad— y nada
más: las etiquetas siguen en Archivo Narrow y el cuerpo en Public Sans.

**El eje `opsz` va fijado en 72**, con el mismo criterio con el que la Bodoni
estaba fijada en 48: es el punto óptico del rango de uso real, que va de 30px la
marca a 72px el mes. Abierto, Fraunces cuesta **31,1 KB** contra los **17,7 KB**
de la instancia fija.

| | antes | ahora |
|---|---|---|
| display | Bodoni Moda 800 `opsz` 48 — 8,2 KB | Fraunces 900 `opsz` 72 — 17,7 KB |
| total de fuentes | 58,8 KB | **62,0 KB** |

**Se remidieron los argumentos en vez de arrastrarlos.** El más caro era el de la
cursiva: la página de detalle no pone la lectura de un club en itálica porque es
un archivo aparte, y ese número era «17 KB con Bodoni». Con Fraunces la itálica
cuesta **21,8 KB** —más que la redonda—, así que la conclusión no cambia pero el
número sí, y quedó corregido donde estaba escrito. Lo mismo con las dieciocho
menciones a «Bodoni» repartidas por el código: las que nombraban a la display
pasan a decir «la display», las que razonaban sobre una propiedad de la Bodoni se
reescribieron, y las cuatro que quedan son referencias históricas a propósito.

`tests/sistema-visual.test.ts` ató las tres cosas: qué familia declara el token,
qué familias pide la hoja de fuentes —ninguna de más— y que el eje óptico siga
fijado. Los tres asertos fallaron al cambiar la fuente, que es exactamente para lo
que estaban.

## 2026-08-31 · desplegado, y una nota mía que quedó publicada

**El rediseño está en producción**: `1.5.0+c377029`, con las 23 actividades reales.
Los seis jobs de `push-main.yml` terminaron bien y el sitio se publicó solo.

**Y verificando el HTML de producción apareció B-261: un párrafo de notas internas
estaba publicado dentro de la home.** Un `{/* … */}` puesto entre `</head>` y
`<body>` **no lo elimina Astro** — solo elimina los comentarios donde parsea una
expresión, o sea adentro de un elemento. Éste se emitió como **texto crudo** al
documento y se sirvió a todo el que entrara.

Nada lo dijo: build verde, typecheck verde, ningún test leía el HTML construido, y
a simple vista no se nota porque el navegador reubica ese texto. Se encontró
leyendo el HTML servido, no el fuente.

La nota se movió al frontmatter, que es código y nunca se emite. Y queda
`tests/sin-comentarios-en-el-html.test.ts`, que **lee el `dist/`** —la única fuente
que sabe la verdad, porque saber si Astro elimina un comentario o no exigiría
replicar su parser— y exige que no haya delimitadores sueltos fuera de `<script>` y
`<style>`. Se muta reponiendo el error original y falla.

## 2026-08-31 · brutalismo editorial: el sitio público cambia de sistema visual

**B-260, D-146.** La dirección de D-141 —«la estructura de Eventbrite con paleta
propia»— quedó **completa** con B-247 y B-253, y el dueño la rechazó al verla
terminada. Es el segundo rechazo, y el motivo no era la paleta: *la estructura de
Eventbrite es la estructura de una plataforma*, y un sitio que se ve como una
plataforma se ve como cualquier otra.

La referencia nueva —`docs/referencias/sistema-visual.md` y `stitch-detalle.md`, un
**programa impreso** en risografía— se aprobó **antes** de escribir una línea, y el
contraste se midió antes de implementar. Se implementa, no se rediseña.

**Tres reglas nuevas que atraviesan todo el sitio:** radio 0, estrictamente plano
(sin sombras, sin desenfoques, sin degradados), y **tintas con nombre en vez de
opacidades**. La tercera es la que más lejos llega y no es estética: hoy el sitio
tiene **cero** atenuaciones de color, y eso cierra de raíz la clase de B-235 —
`text-tinta/60` da 4,49:1 contra un piso de 4,5, cuatro centésimas que no se ven y
se calculan. Sin opacidades no hay nada que calcular caso por caso.

**Tipografía: tres familias que pesan menos que las dos anteriores.** Bodoni Moda +
Archivo Narrow + Public Sans reemplazan a Lora + Inter, y bajan de **84,2 KB a
58,8 KB** (−30 %). Está medido sobre los woff2 del subset latin que Google sirve
para la URL exacta que emite el build, no estimado. Baja aun sumando una familia
porque Inter y Lora se bajaban como variables completos. El eje óptico de la Bodoni
va **fijado en 48**: abierto cuesta 26,5 KB en vez de 14,6 KB.

> **`--font-serif` se borró y no se aliaseó.** Tailwind trae el suyo (`ui-serif,
> Georgia`), así que un `font-serif` que sobreviva del rediseño anterior **no falla,
> no rompe el build y pinta Georgia**. Es el modo de falla más silencioso del
> cambio, y está prohibido por test.

**El listado pasa de grilla de tarjetas a filas, sin ninguna imagen.** Se retiran
`Tarjeta.tsx`, `PortadaDeTarjeta.tsx` y `GrupoDeChips.tsx`; los reemplazan
`FilaDeActividad.tsx` y `EjeDeFiltro.tsx`, con el marcador de mes en Bodoni de 72px
y los filtros en un riel izquierdo con el aspecto del índice de un libro. **La
página no pide un solo byte de imagen** — la mejora de rendimiento más grande del
rediseño, y salió de una decisión de diseño, no de una optimización.

Con la portada generada se va también **el color derivado por tipo** de
`identidad.ts`: la paleta es limitada por definición y siete u ocho tintas —una por
categoría— es lo contrario. El tipo se escribe todo en azul tinta, que es lo que el
sistema le asigna. Lo que queda de D-141 es lo que valía de fondo: que el nombre del
sitio viva en un módulo.

**En el teléfono los filtros no cambian**: sigue el disclosure de D-143 con su tope
de 65svh y el foco que vuelve al abridor. El riel los reemplaza **solo en
escritorio**. **B-238 sigue abierta**, con el mismo alcance.

**La página de detalle se rehízo** sobre `stitch-detalle.md`: franja de estado en
tinta plena, ficha técnica pegajosa con el CTA adentro, y los dos casos difíciles
que la referencia resolvió bien y se conservan tal cual — el **encuentro cancelado
sigue visible y tachado** (quien tenía anotada esa fecha necesita *ver* que se
movió), y el **material distingue con link de sin link por color y peso, sin un solo
icono**.

**Se le corrigieron diez cosas a la referencia**, todas con motivo en D-146. Las que
importan: ningún icono de Material Symbols, el nombre del sitio deja de competir con
el mes por ser lo más grande, la cabecera fija **solo de `sm` en adelante** (72px
permanentes son el 12% de la pantalla de un teléfono), bordes en px y no en pt, y
fuera «Privacidad», «Términos», el «© 2024» —que **no** se reemplazó por el año
correcto: nadie pidió una línea de copyright— y «entrada libre» como si fuera un
arancel.

### Dos bugs que ningún test veía, encontrados leyendo el HTML y el CSS construidos

Los dos tienen la misma forma: **algo que gana por orden de emisión de CSS y no por
lo que dice el markup.** Ninguno lo ve el compilador, el build ni una captura.

**El bloque de fecha de un encuentro cancelado tenía dos fondos.** `claseBloqueFecha`
traía `bg-acento` y el llamador le sumaba `bg-super` encima; cuál gana lo decide el
orden en que Tailwind emitió las dos utilidades. Hoy ganaba la correcta **por
casualidad**. Un bump de Tailwind y el encuentro cancelado se pinta terracota, que
es la tinta de «esto todavía se puede hacer».

**`ps-riel` le pisaba el nombre a una utilidad que Tailwind ya generaba sola** desde
`--spacing-riel`, y perdía: la regla salía con las dos declaraciones y ganaba la de
Tailwind, sin el medianil. La lista que imprime el build quedaba **corrida 40px**
respecto de la columna de contenido — visible solo antes de que hidrate la island, o
para siempre si el JavaScript no carga, que son los dos momentos que nadie mira.
Pasa a llamarse `sangria-de-riel`.

Las dos con guarda nueva y mutación probada.

### El panel cambió de tipografía sin que nadie lo decidiera, y ahora está decidido

**El único efecto de este cambio fuera del sitio público.** El panel usa
`font-serif` en 17 lugares y **compartía Lora con el sitio**; al sacar a Lora, el
token quedó sin definir. Ahí está la trampa: Tailwind trae su propio `font-serif`,
así que el panel **no falló, no rompió el build y pasó a un serif de sistema** sin
que nadie lo eligiera. Lo levantó el `auditor-documentacion` al preguntar si el
panel compartía tipografía con el sitio.

No se vuelve a bajar Lora: la hoja de fuentes es una sola y la comparten las cinco
páginas públicas, así que 36,9 KB por los títulos de una herramienta interna que
usan dos personas los pagaría el sitio entero. **Georgia se queda, pero declarada**
—cero bytes, está en todas las máquinas, y es un serif de texto, que es lo que el
panel quería de Lora—. El cuerpo del panel pasa de Inter a Public Sans por el mismo
camino, y las dos son grotescas neutras.

Lo que cambia con la declaración: deja de ser el default de Tailwind y pasa a ser
una línea que se puede leer y cambiar. Hay guarda con mutación probada — borrar el
token deja el panel viéndose **exactamente igual** y el test en rojo.

### La red

`tests/sistema-visual.test.ts`, nuevo: barre **todo** el markup del sitio y **ata
cada token de `global.css` al hex exacto de la referencia aprobada**, en las dos
direcciones — si alguien retoca una tinta o cambia el documento, el otro lado lo
dice. `tests/tarjeta-del-listado.test.ts` pasa a `tests/listado-del-sitio.test.ts`,
rehecho para la fila.

**28 mutaciones probadas una por una, las 28 atrapadas.**

Los cuatro hallazgos del `auditor-privacidad` entraron en el mismo cambio, y ninguno
filtraba un dato: eran de índice y de verificación. El que más valía: **ocho
referencias muertas** al test renombrado, repartidas entre `docs/`, `.claude/agents/`
y `.claude/skills/`. No se había perdido cobertura, se había perdido el índice — que
es justo el modo de falla que el índice existe para frenar. Cerrado con una guarda:
`agentes-y-skills.test.ts` verificaba que existieran los **productores** de la tabla
de salidas y no los **tests**; ahora verifica los dos.

**1.881 tests en 83 archivos**, contados en esta corrida.

## 2026-08-31 · el sitio con identidad, integrado

**Las cinco páginas comparten un lenguaje visual.** El listado con portadas y
tarjetas (**B-247**) y el detalle, el chrome y las páginas de texto (**B-253**),
escritos en paralelo sobre la identidad de D-141. Cada frente tiene su entrada
abajo; acá va lo que apareció **al juntarlos**.

**Un XSS real en una página indexada, heredado de B-227.** `JSON.stringify` no
escapa `<`, así que un título con `</script>` adentro **cerraba el bloque de
JSON-LD** y lo que seguía era HTML ejecutable. Lo encontró el auditor de privacidad
del frente del detalle. Se verificó **atacándolo**: se sembró una actividad cuyo
título, descripción, sede, dirección, tema y organizador eran todos
`</script><img src=x onerror=…>`, se construyó el sitio y se leyó el HTML — el
bloque queda con `\u003c`, el JSON sigue parseando, y en la página hay **un solo
`<script>`**. El `<img>` crudo que queda en la `meta description` **no es
explotable**: vive dentro de un atributo entrecomillado y Astro escapa las
comillas, así que no hay forma de salir.

**`--aspect-portada`, para que la misma imagen no tenga dos recortes** — B-249. Lo
pidió el frente de la tarjeta al cerrar, antes de que el del detalle eligiera la
suya. No es cosmético: con la **portada generada**, el título va *dentro* del
recorte, así que dos proporciones son dos tamaños de letra para el mismo texto.

**`overflow-x-hidden` → `overflow-x-clip`** — B-259. `hidden` **crea un contenedor
de scroll**, y eso deshabilita `position: sticky` adentro sin error ni advertencia:
el elemento nunca se pega. Le costó al frente del detalle un `fixed` con relleno al
pie. `clip` recorta igual sin crear el contenedor. El test que lo cubría estaba
escrito como **invariante condicional** —«no vuelve a ser sticky *mientras* el body
recorte con hidden»— así que se destrabó solo al cambiarlo, que es exactamente para
lo que sirve escribirlo así.

**El anillo de foco estaba seis veces a mano, y centralizarlo dejó los controles sin
foco.** La sustitución metió `${foco}` adentro de `'…'` y de `className="…"`, que
**no interpolan**: la clase sale literal al HTML, Tailwind no genera nada y el
control se queda sin anillo — con el build **y** el typecheck en verde. Se vio
mirando el HTML construido, no un test; y la primera verificación dio **verde en
falso** porque `grep '${foco}'` no matchea con BSD grep. Cerrado con dos cosas: el
chequeo del anillo ahora acepta el import además del literal —castigar la
deduplicación empuja a copiar— y hay un guard nuevo que exige que **toda
interpolación del anillo viva en un template literal**. Las dos mutaciones fallan.

**1.849 tests en 82 archivos**, contados en esta corrida.

## 2026-08-31 · la tarjeta y la grilla del listado

La bajada de **D-141** a la pieza que más se repite del sitio. La lista vertical de
tarjetas horizontales pasa a **grilla** —una columna en el teléfono, dos en tablet,
tres en escritorio— y cada tarjeta arranca con una **portada** de 16:9. B-247.

**Cuando no hay imagen, la portada se genera** — D-142. Es la pieza nueva, y no es un
placeholder: es el título sobre el color del tipo, con el cuerpo elegido según el
largo (un título de una palabra y uno de doce no pueden ir al mismo tamaño) y un
motivo de renglones cuyos anchos salen del **mismo tono** que el color. Sembrar el
motivo con `tonoDeTipo` en vez de con un hash propio es lo que evita una segunda
derivación de «qué le toca a este slug», que es la clase de B-88.

Esto **se desvía del §4.2 y del §7.6 de `12-sitio-publico.md`**, que decían «sin
imagen no hay hueco gris, la tarjeta no reserva la columna». Era correcto para la
tarjeta horizontal y deja de serlo en una grilla: en una lista de una columna los dos
ritmos conviven, en una grilla de tres la mitad sin portada queda como una fila de
rectángulos mochos. El desvío, con el motivo, está en D-142.

**El título aparece en la portada y en el `<h3>`, a propósito** — es lo que hace un
afiche. Para lector de pantalla no se dice dos veces: el arte va `aria-hidden` y la
foto con `alt=""`, porque ninguno aporta nada que el texto de la tarjeta no diga ya.
La píldora del tipo queda **fuera** del arte: eso es información, no decoración.

**La jerarquía del cuerpo es qué / cuándo / dónde / cuánto.** El arancel se apoya al
pie con `mt-auto`, así que queda a la misma altura en toda la fila y se compara de un
barrido vertical; y **«a la gorra» se pinta con el acento igual que «gratis»**, que es
el §4.1 del `CLAUDE.md`: es la mitad de los casos del circuito y no entra en el
binario gratis/pago. El ciclo dice «Ciclo de 4 encuentros · empieza el 9 de
septiembre» y el verbo cambia con el reloj de quien mira, no con el del build.

**Lo que dice la tarjeta se fue del componente a `src/lib/tarjetaPublica.ts`**, puro y
con 42 tests. Los componentes de React de este repo no tienen tests de render
(`05-patrones.md`), así que una frase escrita adentro del `.tsx` no se verifica en
ninguna parte — y las frases en juego son del dominio: el orden entre «cerraron» y
«cupo completo» decide si se invita a una lista de espera que ya no existe.

**Los filtros de móvil dejan de comerse la pantalla sin construir una capa modal** —
D-143. «Cuándo» se fue adentro del panel, el panel abierto está topeado a `65svh` con
scroll propio, y cierra desde abajo con «Ver N actividades» devolviendo el foco al
botón que lo abrió. **B-238** sigue abierto, con el alcance recortado a lo que de
verdad falta: la hoja modal y el CTA fijo del detalle.

**Un chequeo de contraste nuevo, porque el de B-235 no llega hasta acá** —
`tests/listado-del-sitio.test.ts`. Aquél barre `src/pages` y `src/components/sitio`,
mide solo `text-tinta/NN` y solo sobre `papel`; la grilla no cumple ninguna de las
tres: vive en `src/components/publico`, la tarjeta es `crema` y los chips son `hondo`
—donde el mismo `/65` pasa de 5,26:1 a 5,04:1—, y la portada pinta texto encima de un
color que no es un token sino un `oklch` derivado del slug. El chequeo nuevo tiene una
**regla de clase** (la única atenuación permitida es la de la tinta, medida contra la
superficie más oscura) y una **lista de los pares que el arte declara**, cada uno con
la clase que tiene que seguir estando en su archivo para que la lista no envejezca
dando cobertura de mentira.

Lo primero que encontró: **el chip elegido daba 4,38:1**. `bg-acento/10 text-acento`
sobre `hondo`, con el piso en 4,5. Ahora va lleno (`bg-acento text-papel`, 5,59:1),
que además es como se ve un control elegido en una plataforma.

**Y el motivo de la portada salía con todos los renglones iguales** — B-248, cerrado
en el camino. Lo encontró **mirar el HTML del build contra el emulador**, no un test:
el motivo se calculaba con `(semilla * (i + 7)) % 50` y los tonos asignados son
redondos, así que un tono múltiplo de 50 —«club de lectura» es 250— daba resto cero
para todos los renglones y la portada dibujaba tres barras idénticas. El test miraba
que el último fuera el más corto, y tres iguales le pasaban por al lado. Es la tercera
vez que el artefacto de verdad encuentra lo que la suite no podía ver (B-227, B-237).

**Lo que dijeron los auditores.** El `auditor-privacidad` encontró que
`formasDeCursar` **reescribía** tres reglas que ya viven en `lib/modalidades.ts`
—`filaPideSede`, `filaPideOnline`, `modalidadResultante`—, que es el productor del
array que el índice lleva: idénticas hoy, divergentes el día que aparezca un cuarto
valor de modalidad, y el modo de falla es que el chip desaparece y el lugar cae a
«Lugar a confirmar» con la sede cargada. Ahora se importan, y un test recorre
`MODALIDADES` —el dominio del productor— para que ninguna quede sin clasificar.
También señaló que el docblock prometía un componente «dumb» que no lo era: la
tarjeta sigue recibiendo la `EntradaDeIndice` entera, así que hoy hay una **lista
cerrada** de qué campos puede leer directo, verificada — sin ella nada impedía
imprimir `searchText`, que es la descripción entera. Y que el índice de salidas de
`07-seguridad.md` no nombraba al productor nuevo: agregado ahí, en la ficha del
auditor y en el skill `campo-nuevo`, que es lo que hace que un cambio futuro a
`tarjetaPublica.ts` dispare la auditoría por nombre de archivo.

El `auditor-documentacion` pidió el bloque de estado de `12-sitio-publico.md` con la
convención que ese archivo ya tiene —los desvíos numerados y la tabla por sección— y
encontró **drift previo**: `13-agentes.md` y dos entradas del backlog atribuían el
barrido de contraste del sitio a `contraste.test.ts`, que es solo la matemática. El
barrido es `contraste-del-sitio.test.ts`. Corregido en las cuatro ubicaciones.

**Peso:** `client.js` —el runtime de React que mide **B-239**— no se movió: 186.619 B
/ 58.540 B gzip. La island `Buscador` pasó de 16.458 B / 5.925 B gzip a 20.272 B /
7.435 B gzip, +1,5 KB gzip por la portada y los controles nuevos. Sin dependencias
nuevas: la lupa del buscador es un SVG inline de doce bytes.
## 2026-08-31 · el detalle, el chrome y las páginas de texto toman la forma decidida

D-141 decidió el nombre, la paleta y la dirección; **B-253** es donde se aplican. Este
frente es la página de detalle, el encabezado, el pie y las tres páginas de texto
(`/ayuda`, `/contacto`, `/suscribirse`). La home y el listado son de otro frente.

**Estructura de Eventbrite, temperatura propia**, que es lo que D-141 pedía: portada
arriba, título y datos duros juntos, un CTA que no se puede perder, y todo apilado con
**superficie y borde** —`papel`, `crema`, `hondo`— sin una sola sombra. Las sombras
son justo lo que da el aire de plataforma genérica.

**El sitio tiene un solo lugar para sus clases compartidas**, igual que el panel ya
tenía `campos/Campo.tsx`: `src/components/sitio/estilos.ts`. El anillo de foco estaba
copiado **doce veces** y la clase del enlace acentuado cinco, y eso no es una
duplicación estética — la copia que se escriba con un typo el mes que viene deja
**un** control sin foco visible, y eso no lo ve nadie que use el mouse, no lo dice el
compilador y no lo dice ningún chequeo de contraste. `estilos-del-sitio.test.ts`
(**B-257**) lo sostiene con las dos mitades: que nadie lo escriba a mano, y que todo
archivo con un enlace o un botón lo importe — porque «no lo escribe a mano» también lo
cumple una página sin foco en ninguna parte.

**La portada va arriba, con relación de aspecto fija** — **D-144**, desvío del §4.3
del diseño. El argumento de aquella decisión —«un flyer vertical de Instagram empuja
la fecha fuera de la pantalla»— sigue siendo cierto, y lo que se le saca es la
premisa: lo que empuja no es que la imagen esté arriba, es que **su alto lo decida la
imagen**. La proporción sale de `--aspect-portada` (B-249) y no se escribe acá: es la
misma imagen que la tarjeta del listado, y dos recortes distintos hacen que la foto
que se veía bien en la grilla aparezca cortada al abrirla.

**El CTA fijo de móvil, sin una línea de JavaScript** — **D-145**, que cierra la mitad
«CTA fijo» de **B-238**. El §8 lo pedía «desde que el botón original sale de la
pantalla», y esa cláusula obliga a medir el scroll en la única página con presupuesto
de 0 KB. Se cambió la regla y no la herramienta: en el teléfono el botón del flujo
**no se pinta** y la barra de abajo es el único CTA, así que no hay nada que medir.
Es `fixed` y no `sticky` porque `Base.astro` le pone `overflow-x-hidden` al `body`, y
un ancestro con overflow recortado **rompe `sticky` en silencio** — el test deja ese
cruce escrito como invariante condicional, para que el día que el layout use
`overflow-x: clip` la opción vuelva a estar disponible sola. La hoja de filtros de la
home sigue abierta y sin cambios: ésa sí es una capa modal.

**El contraste se mide sobre las tres superficies y no solo sobre `papel`** —
**B-256**. El chequeo que había lo decía en su propio docblock («no puede ver texto
sobre un fondo que no sea papel»), y era cierto mientras el sitio tuviera un fondo.
Con `crema`, `hondo` y los tintes de acento el número viejo es **optimista**:
`text-tinta/61` da 4,62 sobre papel —pasa— y 4,38 sobre la más oscura —no pasa—, y el
test viejo seguía verde. Las superficies ahora se **derivan** de `global.css` y del
markup, así que una nueva y más oscura entra sola al cálculo. De paso quedaron
remedidos los ratios del §10 del diseño, que eran de la paleta anterior a D-141.

**Tres cosas que arregló mirar el HTML del build**, y ninguna la podía ver un test
unitario — es el §«verificar contra el sistema real» de `05-patrones.md` otra vez:

- **B-254** — una actividad con **todos** sus encuentros cancelados decía «Esta
  actividad ya pasó». Sin ninguna sesión en pie no hay próxima, así que `yaPaso` da
  `true` por el mismo camino que una actividad terminada. Es falso y de la peor
  manera: quien pregunta «¿se hace?» se va creyendo que llegó tarde a algo que no se
  hizo, con la fecha del mes que viene escrita más abajo. Ahora el aviso de arriba es
  **una prioridad entre cuatro estados**, decidida en el view-model y no encadenada
  con `&&` en la plantilla.
- **B-258** — la página daba **dos cuentas distintas de los mismos encuentros en la
  misma pantalla**: «Ciclo de 4 encuentros» en la ficha y «Los 5 encuentros» en el
  título de abajo. Las dos están bien —una cuenta los que quedan en pie, la otra
  numera sobre todos porque el número es la identidad del encuentro (D-95)— y ninguna
  se puede cambiar. Sobraba decirlo dos veces.
- La sección «Cómo se cursa» se pintaba **vacía** cuando la actividad no tiene
  `modalidades`: un encabezado que promete algo y no entrega nada.

**Y dos que encontró el `auditor-privacidad`**, las dos de red que faltaba y ninguna
de fuga:

- **El JSON-LD podía cerrar su propio `<script>`.** `JSON.stringify` escapa las
  comillas y **no** el `<`, así que un `titulo`, una `sede.nombre` o un `tema` con
  `</script>` adentro dejaba HTML ejecutable en una página pública e indexada. Los
  tres son texto libre de un formulario. Venía de B-227.
- **El barrido de centinelas ejercitaba una de las cuatro ramas del aviso**, y justo
  no la que interpola un valor: el fixture caía siempre en `completo`. Ahora barre las
  cuatro, con un control positivo que exige que sean cuatro tonos distintos.

Mutaciones probadas, todas en rojo: `todoCancelado` en `false`, la guarda del caso sin
fechas, el orden de prioridad del aviso invertido, `esProximo` ignorando `cancelada`,
el `hidden` sacado del botón de escritorio, la barra sin su aire para el pie, la barra
vuelta `sticky`, la proporción escrita a mano en vez del token, un `<script>` suelto,
el anillo de foco a mano, el nombre del sitio literal, `text-tinta/61` —que pasa el
chequeo viejo y no el nuevo—, la banda de color de tipo aclarada, y el título de
encuentros con el número puesto.

La mutación de la portada encontró además un aserto flojo **del test que se estaba
escribiendo**: aceptaba el `sm:aspect-…` solo, o sea que pasaba justo en el teléfono,
que es el único caso donde el flyer vertical es un problema.

**Lo que esto no resuelve:** una actividad `estado: 'cancelado'` sigue sin página —es
**B-110**, de antes— y hasta que se cierre, la ayuda del sitio le promete a quien lee
algo que todavía no pasa. Queda anotado ahí.
## 2026-08-31 · el sitio tiene nombre y paleta

**«el nuestro no tiene identidad ni nada»**, dijo el dueño pidiendo que el sitio se
parezca a Eventbrite. La causa no era del todo estética, y vale escribirla: el nombre
estaba **decidido desde el 2026-08-27** —«Agenda LEH — Leer, Escribir, Hacer»,
DEC-6— y **no se había usado en ninguna parte**. Ocho lugares del sitio repetían
«Agenda literaria», que es su categoría y no su nombre. Un sitio que se presenta con
su categoría no puede tener identidad, y ningún rediseño encima de eso la iba a dar.

**El nombre vive en `src/lib/identidad.ts` y se interpola** — B-245, D-141. Ocho
literales sueltos son ocho lugares donde el nombre queda viejo, y habían quedado
viejos los ocho a la vez. `tests/identidad.test.ts` exige que toda página se titule
con el nombre, y que la bajada siga **desarrollando la sigla**: si alguien cambia una
de las dos y no la otra, «LEH» queda como una sigla muda y el test lo dice.

En la home el nombre va **al final** del título: quien busca «taller de escritura
buenos aires» todavía no conoce el sitio, y en un resultado de Google el título se
corta por la derecha.

**La paleta suma tres niveles de superficie** —`papel`, `crema`, `hondo`— para poder
apilar una tarjeta sobre el fondo **sin sombras**, que es justo lo que da el aire de
plataforma genérica. El acento se profundiza a terracota. Sigue siendo papel y tinta
a propósito: se adopta la **estructura** de Eventbrite, no su temperatura. Lo que
faltaba era jerarquía y densidad, no saturación.

**El color del tipo se deriva del slug, y ahí está lo que no se ve.** `tipo` es una
taxonomía autogestionada (§4): quien carga puede crear un tipo nuevo desde «Otro».
Una tabla de siete colores a mano queda vieja **el mismo día** que aparezca el
octavo, y falla en silencio — el tipo nuevo cae en un gris de descarte, sus tarjetas
se ven roídas, y el build queda verde. Así que los siete de hoy tienen tono asignado
—para que «taller» sea siempre el mismo color y se aprenda— y cualquier otro deriva
el suyo del slug, determinístico y empujado para no caer a menos de 18° de un tono ya
tomado.

**La luminosidad y el croma son fijos para todos**, y eso no es estética: es lo que
permite garantizar el contraste **de una sola vez**. Por eso el test no verifica los
siete tipos de hoy —eso dejaría la garantía en «los que ya vimos»— sino **los 360
tonos posibles**. El peor da 7,21:1 contra un piso de 4,5. La portada de un tipo que
alguien invente el año que viene está garantizada legible, y si alguna vez se aclara
la banda, el test lo dice antes.

**La casilla de contacto era la equivocada** — B-246. La dirección versionada el
2026-08-28 no era la del proyecto y estuvo tres días publicada en un repo público. Se
sacó del árbol en vez de habilitarse: una casilla ajena no se conserva como registro.
`sin-datos-personales.test.ts` sirvió **dos veces** acá — frenó la casilla al
versionarla, y volvió a fallar sobre el rastro que quedaba en el CHANGELOG cuando se
cambió solo el módulo. Que la excepción sea **una dirección** y no un dominio es lo
que hizo posibles las dos: con `@gmail.com` permitido, ninguna habría dicho nada.

Mutaciones probadas, las seis fallan: la banda aclarada (portadas ilegibles), la
bajada que deja de desarrollar la sigla, dos tipos compartiendo tono, un tipo nuevo
cayendo sobre uno asignado, el nombre volviendo a ser la categoría, y una página
titulándose sin el nombre.

**Lo que esto no resuelve:** el dominio sigue sin registrar, así que no hay
canonical, ni Open Graph, ni sitemap (B-109). Y DEC-6 pedía decidir qué parte del
nombre va en la URL.

## 2026-08-28 (después de 1.5.0) · el sitio público, integrado

**Las cuatro páginas conviven.** `/` con listado, búsqueda, filtros y orden;
`/actividad/{slug}`; `/ayuda`; `/contacto`; `/suscribirse`. Tres frentes en paralelo,
cada uno documentado en su propia entrada. Acá va lo que costó **juntarlos**, que es
la parte que no se ve en ningún frente.

**El frente del listado numeró sobre identificadores que se ocuparon mientras
corría.** Salió de `cac918f` —antes de que existieran los rangos— y usó
`B-228`..`B-235` y `D-133`..`D-136`, los doce tomados en el ínterin. Renumerados a
`B-237`..`B-244` y `D-137`..`D-140`: **102 referencias**.

El renombre se hizo **dentro de su worktree, antes del merge**, y esa es la parte
que importa. Ahí adentro se verificó que la base no tenía ninguno de esos números,
así que toda ocurrencia era suya y el reemplazo global era seguro. Hacerlo después
del merge —cuando conviven los dos juegos— es exactamente el error que esa mañana se
llevó puestas trece referencias ajenas.

**Dos páginas traían su propio encabezado y su propio pie**, porque se escribieron
antes de que existiera el chrome de B-229. Sin arreglarlo quedaban dos barras, dos
pies y **dos landmarks `banner`**; en el detalle, además, **dos `id="contenido"`** —el
del layout y el de su `<main>`—, con lo que su propio «Saltar al contenido» iba al
equivocado. Se quedaron con el chrome del layout. Lo que sí sobrevivió es lo que el
menú no reemplaza: el «Saltar al listado» de la home, que saltea también los seis
ejes de filtros, y el «Ver todas las actividades» del detalle, al que se llega desde
un buscador tanto como desde el listado.

**Dos frentes escribieron un test de contraste con el mismo nombre**, sin verse. Se
conservó la estructura de uno —la matemática en `src/lib/contraste.ts`, anclada
contra los valores de la norma en vez de contra sí misma, y el barrido calculando
por instancia en vez de con un piso fijo— y se le portó lo que el otro medía y éste
no: **el acento sobre papel, y el papel sobre acento**, que es el botón de
inscripción. La fórmula de WCAG es simétrica, pero cuál de los dos es el fondo decide
la mezcla en cuanto hay una opacidad.

**El guard del chrome encontró la página nueva**, que es para lo que se escribió:
`actividad/[slug].astro` entró sin declarar sección y el test lo frenó antes del
merge.

**Verificado de punta a punta contra el emulador**, no solo con la suite:
`EXIGIR_EMULADOR=1` da **1.741 de 1.741**, el gate de build genera la página de
detalle **solo de la publicada**, y un barrido propio sembró una actividad con
centinelas únicos en todo lo que el §5.1 prohíbe y buscó los veinte en el `dist/`
entero: **cero fugas**, con el control negativo de que los doce que sí tienen que
salir aparecen. El título de un material con `publico: false` sale y su URL no, que
es lo que el §5.1 pide.

## 2026-08-28 (después de 1.5.0) · la integración de los tres frentes del sitio

**El sitio público tiene tres páginas** — `/ayuda`, `/contacto` (**B-232**) y
`/suscribirse` (**B-230**) —, escritas en paralelo por dos frentes sobre el contrato
compartido de B-228 y el chrome de B-229. Los detalles de cada una están en sus
propias entradas, abajo. Acá va lo que apareció **al juntarlas**, que es lo que un
frente solo no podía ver.

**El contraste era peor de lo que decía el ítem que lo abrió — B-235.** Un frente lo
encontró en sus páginas (`text-tinta/60` da 4,49:1 contra un piso de 4,5) y abrió el
ítem describiendo dos lugares. Al extender el chequeo a todo el sitio aparecieron
**cuatro**: los otros dos son marcadores de listas de pasos numerados en
`/suscribirse`, con `/45` (2,86:1), escritos **el mismo día por el otro frente**
mientras el ítem se abría. Los números de una lista ordenada son contenido — si no
se leen, no se sabe cuál es el paso 3.

Lo que enseñó, y por eso el chequeo es nuevo y no una nota: **la regla no se sostiene
con atención.** Tres frentes en paralelo la rompieron dos veces en una tarde, y uno
era el que la estaba documentando.

`tests/contraste-del-sitio.test.ts` **lee los tokens de `global.css` y calcula**, en
vez de fijar un piso de opacidad a mano. Un «nunca menos de /65» sería cierto para
esta paleta y mentira para la siguiente, en silencio; leyendo los tokens, aclarar la
tinta pone en rojo las opacidades que dejaron de alcanzar. La matemática vive en
`src/lib/contraste.ts` y se ancla contra los valores de la norma —21:1 y 1:1— y no
contra sí misma.

**El pie mandaba a un `mailto:` crudo — B-233.** Estaba bien cuando `/contacto` no
existía. Ahora esa página dice qué conviene contar, y un mail que se saltea la lista
llega sin fecha o sin lugar: un ida y vuelta que la página evita.

**Un número de backlog duplicado, arrastrado de la integración de `1.5.0` — B-236.**
El ítem del `git stash` compartido entre worktrees se había quedado con **B-224**,
que es «N modalidades» y tiene **137 referencias** en el código. Renumerado a B-236
cambiando **dos líneas identificadas a mano**: un reemplazo global habría roto las
137, que es exactamente el error que costó una hora esa mañana.

**Quinta observación sobre B-219**, y cierra el argumento: un frente vio el mismo
archivo **fallar en una corrida y saltearse en la siguiente**, sin tocar el código —
otro worktree levantó los emuladores en el medio. Las cuatro anteriores describían el
emulador como estado compartido que **se corrompe**; ésta agrega que también es
estado que **aparece y desaparece**, y eso rompe la premisa del salteo automático: la
misma suite reporta cobertura distinta en dos corridas seguidas.

**Doc puesta al día con números contados en esta corrida**, no arrastrados:
`docs/README.md` decía 1.403 tests en 61 archivos y son **1.574 en 71**;
`docs/01-arquitectura.md` seguía llamando placeholder a la home y no tenía ninguna de
las páginas ni carpetas nuevas. Y las decisiones quedaron en orden: los dos frentes
escribieron en paralelo, así que entraron como D-135, D-136, D-133, D-134.

## 2026-08-28 (después de 1.5.0) · las páginas de ayuda y contacto

**`/ayuda` y `/contacto`, las dos primeras páginas terminadas del sitio público —
B-232.** No leen `events.json` ni Firestore: son texto, y por eso se pudieron
escribir en paralelo con el listado.

`/ayuda` le habla a **quien busca una actividad**, no a quien la carga: 20
preguntas en cinco grupos, todas abiertas y con ancla propia. Contesta que esto **no
es una plataforma de inscripción**, qué es cada tipo, qué quiere decir «a la gorra»
(§4.1), por qué un ciclo es una tarjeta y no ocho (§2.2), y por qué el link de la
reunión no está publicado (§5.1, trampa 5).

`/contacto` son dos `mailto:` con el asunto ya puesto —lo que permite separar una
sugerencia de un error en la bandeja sin abrirlos—, con qué conviene contar en cada
caso y qué pasa después. La dirección y los asuntos salen de `enlaces.ts` (B-228) y
el test falla si aparece un `mailto:` escrito a mano en el marcado.

**El contenido es data, no marcado** (`src/lib/ayudaDelSitio.ts`,
`src/lib/contactoDelSitio.ts`), y lo que se puede derivar se deriva: el glosario de
tipos y el de aranceles salen de `opciones-base.json`, y los motivos de contacto de
`MOTIVOS_DE_CONTACTO`. El día que entre una categoría base nueva —ya pasó dos veces,
con «Feria» (B-129) y con «Librería a la calle»— la ayuda queda incompleta y el test
la nombra, en vez de quedar enumerando cinco tipos mientras el sitio muestra siete.
Ver **D-135**.

**Todo abierto, sin acordeón y sin JavaScript** (**D-136**): el uso principal de una
página de ayuda es mandar el link de una respuesta suelta o caer en ella desde una
búsqueda, y las dos cosas se degradan cuando se aterriza sobre un título plegado.

**Contraste medido, no estimado.** Las dos páginas nacieron con `text-tinta/60` en
cuatro lugares, que sobre esta paleta da **4,49:1** contra el piso de 4,5:1 de AA.
Se ve perfectamente bien —ese es todo el problema— así que se subió a `/70` (6,3:1)
y quedó como chequeo que prohíbe el rango entero en vez de criterio que hay que
recordar. La home tiene lo mismo y es de otro frente: **B-235**.

Trece mutaciones probadas, todas rojas: borrar una pregunta obligatoria, sacar la
explicación de un tipo base, dejar de diferenciar «a la gorra» de gratis, linkear a
una sección que no existe, meter un link de Zoom de ejemplo, meter jerga, repetir un
ancla, pegar una pregunta en el marcado, escribir el `mailto:` a mano, sacarle el
«dónde» a la sugerencia, sacarle el «en qué página» al reporte de error, agregar un
motivo de contacto sin su lista y bajar el contraste de un texto a `/60`.

Abiertos en el camino: **B-233** (el pie manda a un `mailto:` crudo en vez de a
`/contacto`, que es donde está la lista de qué contar), **B-234** (el mapa de URLs de
`12-sitio-publico.md` quedó viejo: diseñaba `/acerca` y `/calendario`, el sitio tiene
`/ayuda`, `/contacto` y `/suscribirse`) y **B-235** (la home atenúa texto por debajo
de AA).

## 2026-08-28 (después de 1.5.0) · llevarse la agenda al calendario propio

**`/suscribirse` — la página que explica cómo suscribirse al calendario (B-230).**
El Google Calendar del proyecto es un espejo de solo lectura de lo que se carga en el
panel: un evento por encuentro, y quien se suscribe recibe los cambios sin hacer
nada. Esa es la diferencia entre anotarse las fechas a mano y que las fechas te
sigan, y es lo que la página existe para dejar claro.

Cuatro caminos con sus pasos: **Google Calendar**, **iPhone/iPad/Mac** por `webcal:`
—que abre la aplicación Calendario en vez de descargar un archivo que hay que ir a
buscar a Archivos, y que copia las fechas una vez en lugar de suscribirse—, **Outlook
y Thunderbird** con la dirección a la vista y botón de copiar, y **solo mirarlo** para
quien no lo quiere en su calendario. Más lo que el calendario **no** hace, y cierra
con Instagram.

**Ninguna dirección se escribe en el markup**: salen todas de `enlaces.ts` (B-228).
No es prolijidad — Google publica dos direcciones del mismo calendario y la que lleva
`private-` le da acceso de lectura al calendario entero a quien la tenga. Ahora hay
una página que muestra una dirección de calendario en pantalla, que es el lugar más
probable donde alguien pegue la equivocada, así que el test barre el markup y exige
que cada dirección sea **exactamente una** de las que `enlaces.ts` produce.

**El texto es data testeada y no markup** (`src/lib/suscripcion.ts`, **D-133**): esta
página no falla rompiéndose, falla dejando un camino a medias —un botón sin los pasos
al lado, un quinto camino que nadie muestra— y todas esas formas dejan el build en
verde.

**Lo que encontró escribirla, y es lo que más importa del cambio:** el primer
borrador decía que el evento **nunca** trae el link de la reunión, citando el §7.4.
Es falso desde **D-15** — con `urlPublica: true` el link sale, por decisión del
dueño. La página dice «casi nunca» y explica el caso, y las tres promesas que hace
sobre el calendario se verifican ahora **contra `construirEvento`/`planificar`**, no
contra el texto: es la lección de B-63 (un chequeo puede verificar que el texto esté,
nunca que sea cierto), y acá pesa más porque esto lo lee gente de afuera que decide
con eso si esperar un link o si presentarse a un encuentro.

**La página es `/suscribirse` y no `/calendario`** como diseñaba
`12-sitio-publico.md`: el encabezado ya publicaba ese enlace y el slug de una página
pública es caro de mover (trampa 10). **D-134**.

Diecinueve mutaciones probadas, las diecinueve fallan: URL escrita a mano, la
variante privada del ICS, un camino sin ningún paso, el camino de copiar y pegar sin
decir dónde se pega, un camino fuera del orden, una acción sin aviso para el lector
de pantalla, `webcal:` anunciado como pestaña nueva, la clave del registro separada
de su id, la advertencia de cancelación suavizada, jerga en el texto, la página
declarando otra sección, una URL pegada en el markup, la página eligiendo un camino a
mano, el botón de copiar visible sin poder copiar, un `aria-label` que pisa el texto
del botón, la dirección que se copia ofrecida además como enlace, el componente
volviendo a poner ese botón, y —sobre `functions/calendario.js`— publicar el link de
la reunión siempre y dejar en pie el evento de un encuentro cancelado.

Queda escrito y **sin cablear** el bloque corto para la home
(`SuscribirseResumen.astro`): la home tiene otro dueño. Es **B-231**.

Doc: `04-funcionalidades.md`, `06-decisiones.md` (**D-133**, **D-134**),
`07-seguridad.md` (la página publica la dirección del calendario, y cuál),
`12-sitio-publico.md` (el desvío de `/calendario`), `BACKLOG.md` (B-231 abierto, el
«nunca» corregido en Cerrados).
## 2026-08-28 (después de 1.5.0) · el chrome compartido del sitio público

**Encabezado y pie del sitio, con un solo dueño — B-229.** Navegación entre las
cuatro secciones, salto al contenido, y un pie que sale entero de `enlaces.ts`
(B-228). Lo escribe el orquestador y no un frente, por la misma razón que el
contrato: es el archivo donde tres agentes en paralelo se pisan seguro.

**`Base.astro` trae el chrome apagado por defecto** (`seccion="ninguna"`), porque
`/admin` es una SPA con su propia navegación y dos barras compitiendo por el mismo
lugar es peor que ninguna. Eso deja una trampa: **el default correcto para el panel
es el default equivocado para el sitio**, y olvidarse de `seccion` no rompe nada —
build verde, página que se ve bien sola, y quien entre no tiene cómo volver.

Por eso va con `tests/chrome-del-sitio.test.ts`, que exige que toda página que use
`Base` declare su sección, con las excepciones en una lista explícita y con motivo.
Encontró una al escribirlo: la home. Tres mutaciones probadas —sacarle la sección a
la home, dejar una excepción apuntando a un archivo que no existe, y el control
positivo del barrido— y las tres fallan.

## 2026-08-28 (después de 1.5.0) · el contrato compartido del sitio público

**`src/lib/enlaces.ts` — los destinos externos del sitio, en un solo lugar (B-228).**
El calendario público al que la gente se suscribe, la cuenta de Instagram y la
casilla de contacto. Se escribe **antes** que las páginas que lo usan y a propósito:
la home, la ayuda y el contacto lo necesitan los tres, y son tres frentes en
paralelo — sin un contrato previo, cada uno derivaba lo suyo y al integrar había que
elegir cuál de las tres versiones era la buena. Es la lección de la integración de
`1.5.0`, aplicada antes en vez de después.

Todo se deriva de `CALENDARIO_ID`, que es el único dato crudo: el `cid` de Google es
ese ID en base64, y la URL del ICS es el mismo ID adentro de otro path. Pegar el
base64 a mano habría dejado en el repo un string que nadie puede leer para verificar
a qué calendario apunta.

**La trampa que el módulo evita**, y es la razón de que sea un módulo: Google publica
dos ICS para el mismo calendario, `.../public/basic.ics` y
`.../private-<token>/basic.ics`. El segundo **da acceso de lectura al calendario
entero a quien lo tenga** y no se revoca sin rotarlo (`07-seguridad.md`). Están a un
path de distancia. `tests/enlaces.test.ts` falla si cualquiera de las siete URLs que
el módulo produce contiene `private-`.

**El chequeo de datos personales frenó el mail de contacto antes de dejarlo pasar**,
que es exactamente para lo que está: la casilla es un gmail y
`tests/sin-datos-personales.test.ts` la rechazó al versionarla. Se agregó como
excepción **con su motivo** —es la casilla que el proyecto publica, no la de una
persona— y se verificó que la escotilla es angosta: cualquier otro `@gmail.com`
versionado sigue rompiendo el test.

> **La dirección de este párrafo no era la del proyecto**, y por eso no figura acá.
> El 2026-08-31, revisando la identidad, el dueño corrigió cuál era; la equivocada
> había estado publicada tres días en un repo público. Se sacó del texto en vez de
> habilitarla: la excepción del test es **una dirección** y no un dominio,
> precisamente para que cambiarla obligue a pasar por ahí, y una casilla ajena en un
> repo público no se conserva como registro.

Mutaciones probadas, las cinco fallan: ICS privado, `cid` apuntando a otro
calendario, la zona horaria caída, los dos motivos de contacto compartiendo asunto,
y `webcal:` quedándose en `https:`.

## 2026-08-28 (después de 1.5.0) · solo infraestructura y documentación

**La key de CI pasó a poder desplegar todo, y la documentación dice qué cuesta eso
— D-132, que revierte D-119.**

El disparador fue la publicación de `1.5.0`: el job «Reglas e índices» cortó con
403, el `if` del job de Hosting pide `needs.firestore.result != 'failure'`, y **la
web siguió mostrando `1.4.0` sin que nada lo dijera**. La corrida estaba roja como
todos los días desde D-119, así que el rojo había dejado de significar algo. Eso era
la consecuencia 1 de **B-194**, escrita tres días antes como predicción.

`deploy-ci@` pasó de 3 roles a 12 más `iam.serviceAccountUser` sobre las tres
cuentas de runtime, otorgados de a un 403 por vez. **Los seis jobs de
`push-main.yml` terminan bien**: reglas, índices, sitio, panel, Functions y tag.

**Lo que se pagó, escrito sin suavizar** — es la mitad del trabajo de este cambio,
porque la vez anterior el radio de la key cambió y el documento no, y estuvo
mintiendo una hora:

| Documento | Qué dice ahora |
|---|---|
| `07-seguridad.md` § "La key" | la lista completa, y que la key **puede hacer legible todo Firestore** y desplegar código que corre como `calendar-sync@` |
| `02-infraestructura.md` § "Roles" | tabla de qué puede y qué no, y que **nada en CI la contiene** |
| `08-operacion.md` | el paso 3 crea la cuenta con los 12 roles, y hay un runbook nuevo de **qué hacer si la key se filtra** |
| `06-decisiones.md` | **D-132**, con la tabla del intercambio y qué lo reabriría |

`tests/roles-deploy-ci.test.ts` **cambió de propiedad, no se aflojó**. Exigía que no
hubiera ningún rol de escritura: eso era D-119 escrita como test, y sostenerlo sería
exigir que la decisión del dueño no exista. Ahora exige lo que de verdad protegía —
**mientras la lista declare un rol de escritura, `07-seguridad.md` no puede afirmar
que el daño se limita a leer**— más el control negativo de que la sección sí diga
qué puede hacer la key. Las cuatro mutaciones (devolver la frase falsa, sacar un rol
de una de las dos listas, borrar el párrafo del radio, agregar un rol solo al
inventario) se probaron y las cuatro fallan.

**El comparador de infraestructura no sabía mirar el rol más importante — B-226.**
`relevar-infra.sh` consultaba solo los bindings **del proyecto**, y
`iam.serviceAccountUser` se otorga sobre **cada cuenta de runtime**: reportaba que
la doc mentía cuando la que no miraba era él. Se arregló en este mismo cambio,
porque un chequeo que da un falso positivo por corrida es un chequeo que se aprende
a ignorar. Con el arreglo, `./scripts/relevar-infra.sh` confirma contra GCP que el
inventario de los 13 roles dice la verdad.

**El auditor de documentación encontró seis puntos más**, incluido uno que era el
error de D-119 otra vez y adentro del mismo archivo: `08-operacion.md` afirmaba en
la línea 327 que las Functions se despliegan a mano por falta de permisos, y 270
líneas más abajo que desde D-132 el job las despliega solo. También quedó el aviso
hacia adelante en la entrada de D-119, la fila de `13-agentes.md` con la mitad del
test que faltaba, y una frase que decía que la cita vieja estaba «tachada» cuando no
lo estaba.

**Cerrado: B-194.** Se fue por la tercera de sus tres salidas, que no era la que el
ítem recomendaba; por qué se movió el balance está en el ítem y en D-132.
**Abierto: B-225** (P2) — partir la key en dos, `build-ci@` de solo lectura y
`deploy-ci@` detrás de un `environment` con aprobación, el día que el secret tenga
más de un lector. Es la mitigación que B-194 proponía y que no se hizo.
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

- **D-137** — hay selector de orden, contra lo que decía el §6.1 del diseño. Aquel
  argumento evaluó precio y relevancia, que son los dos criterios que derivan del
  contenido; el que faltaba deriva de **cuándo se cargó**, y es la única forma de
  contestarle a quien vuelve. El default no cambia.
- **D-138** — `creadoEn` entra a la proyección pública para ese orden, y **con
  precisión de día**: publicar el instante exacto de cada carga dibuja la agenda de
  trabajo del dueño, que con un solo admin es un dato sobre una persona (mismo
  razonamiento que D-57 y D-27). `updatedAt` no sale.
- **D-139** — el link de la reunión **tampoco sale a la página de detalle**, ni con
  `urlPublica: true`. Más estricto que D-15, por lo mismo que D-129 lo sacó del
  índice y por una razón más fuerte: un HTML indexado no se despublica.
- **D-140** — la plantilla `.astro` **no recibe el documento**: recibe un
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

#### El bug que encontró el build, y no los tests — B-237

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
   día, ver D-138.
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
preguntaba por cuatro salidas y son seis** (**B-244**). Le faltaban las dos de las
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
  Van con el deploy, y quedaron anotados en **B-242**.
- Abiertos en el camino: **B-238** (la hoja de filtros y el CTA fijo de móvil),
  **B-239** (el peso del runtime de React en la home, medido), **B-240** (la casilla
  dice «publicar el link en el sitio» y el sitio no lo publica), **B-241** (el
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

**Y apareció un bicho del propio proceso, que es B-236 y ya mordió dos veces:**
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
