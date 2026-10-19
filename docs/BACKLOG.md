# Backlog

**Esto es lo que falta hacer.** El rastro de lo ya cerrado —lo hecho y lo
descartado, con su prosa entera— vive en
[`BACKLOG-cerrados.md`](BACKLOG-cerrados.md), y se mueve solo:
`node scripts/archivar-backlog.mjs` se lleva de acá todo lo que quedó
`✅ hecho` o `❌ descartado`. El 2026-09-17 eran 372 de 433 ítems y el 87% de las
líneas, así que lo pendiente estaba enterrado adentro del rastro.

**Un `B-` que este archivo cite y no tenga**, está en el de cerrados: los ítems
se citan por id desde la prosa de otros —hay 96 así— y el corte no los reescribió
uno por uno, porque el id es la dirección y sigue siendo única entre los dos
archivos. Si no aparece acá, buscalo allá.

**Todo reporte de posible bug entra acá**, incluso si se arregla en el momento:
en ese caso se carga y se marca `✅ hecho` en la misma tanda, y la próxima
corrida del archivador lo manda al otro archivo. Lo que se arregló sin ítem va a
la tabla de [Cerrados](BACKLOG-cerrados.md#cerrados), que también está allá.
**Nada se borra**: el rastro importa más que la prolijidad de la lista.

Prioridades: **P0** rompe algo o pierde datos · **P1** bloquea el objetivo del
proyecto · **P2** mejora real · **P3** cuando sobre tiempo.

> **Los números no se reciclan.** El próximo
> `B-` libre se calcula sobre **los dos archivos** —la mitad de los ids usados
> está en el de cerrados—, así que el tablero (`npm run tablero`) lo dice bien.
> Un id **reservado por una tanda y nunca escrito** lo lee el tablero de la
> sección `## Rangos` del archivo de coordinación de la tanda (B-1051, D-981).

> **Los huecos de numeración y los rangos que reservaron las tandas** están
> explicados al final de [`BACKLOG-cerrados.md`](BACKLOG-cerrados.md), en «Huecos de
> numeración». Se movieron ahí en la limpieza del 2026-09-25: son rastro, no trabajo.

---

## Decisiones pendientes del usuario

**No hay ninguna decisión del dueño pendiente.** Las ya resueltas, con sus tablas
(DEC-1 a DEC-15, B-28, B-29, B-102, B-124), están en
[`BACKLOG-cerrados.md`](BACKLOG-cerrados.md) § «Decisiones pendientes del usuario».

## Pendiente de acción manual del dueño

- **B-2167** — revisar once pares de actividades publicadas que parecen duplicadas:
  el filtro «Posibles duplicados» del listado los muestra juntos. Dejar una de cada
  par que sea la misma.
- **B-2166** — corregir la sede con un barrio «Rosario» sobrante en Rosario (la ciudad
  ya lo dice): desde el 2026-09-28 el aviso «Publicadas con un lugar que no cierra» del
  tablero la señala. En la actividad, «Dónde» → abajo de «Ciudad» aparece «Barrio» con
  el botón **«Quitar el barrio»** (hasta B-2173 ese campo no se veía fuera de CABA);
  quitarlo y guardar.
- **B-2168** — corregir en el panel los dos destinos de inscripción que el script no
  pudo decidir solo: «buscando» en *Club Pino presenta: Al margen de los libros*, y un
  @usuario y un mail juntos en *Buenos Aires desde los ojos de Roberto Arlt*. El resto
  ya se corrigió el 2026-09-29.
- **B-1235** — convertir en el panel de producción una propuesta con foto y
  confirmar que la actividad reabre con el flyer. Está en manos de la socia del
  dueño desde el 2026-09-25.
- **B-731** — esperar el resultado de la validación de «location» que se pidió en
  Search Console el 2026-09-25 (llega por mail). Nada que hacer hasta entonces.

## P0 — rompe algo o pierde datos

## P1 — bloquean el objetivo del proyecto

### B-1235 · La imagen de una propuesta no queda en la actividad al promoverla · P1 — 🟡 arreglado y verificado por partes, falta una conversión real (2026-09-24)

> 🟡 **Causa encontrada y verificada contra el bucket de producción (2026-09-23).** No era la cadena de guardado: era el **CORS**. La respuesta con los bytes (`alt=media`) no manda `Access-Control-Allow-Origin` para ningún origen, así que el `fetch` de `promoverImagenDePropuesta` falla en el navegador («Failed to fetch»); en el emulador anda porque no aplica el CORS del bucket, y en la bandeja la foto «se ve» porque un `<img>` no lo necesita. **Hecho** (`de19dc2`, `d245919`): `cors.json` en la raíz (solo GET/HEAD desde los cuatro orígenes del sitio), y una alerta visible arriba del formulario cuando la foto no entra, con la causa y qué hacer (`avisoDeImagenNoPromovida`, `Conversion.imagenNoPromovida`). **Falta:** B-1235a, y probar una conversión real. Se cierra cuando una propuesta con foto se convierta y la actividad reabra con el flyer.

> 🟡 **Las dos mitades verificadas por separado (2026-09-24), y por qué eso
> todavía no es el cierre.** B-1235a quedó hecho, así que ahora se puede medir:
>
> - **El permiso del navegador, contra producción.** `curl -H 'Origin:
>   https://agendaleh.ar'` sobre una imagen del `events.json` responde
>   `access-control-allow-origin: https://agendaleh.ar`; con un origen ajeno **no
>   manda el header**. O sea que el `fetch` que fallaba ahora está autorizado, y
>   el bucket no quedó abierto a cualquiera.
> - **La cadena, contra los emuladores.** `tests/propuesta-a-actividad.integracion.test.ts`
>   escribe un flyer en `propuestas/` como lo deja la callable, lo promueve con el
>   **SDK de cliente**, guarda la actividad, la **relee** —el gesto con el que
>   apareció el bug— y acepta la propuesta: la galería vuelve con la imagen y su
>   `portada`, el original se borra y la copia queda.
>
> **Falta la conversión real en el panel de producción**, que es la única que
> junta las dos mitades: navegador de verdad, bucket de verdad y una propuesta con
> foto de verdad. Se cierra ahí.

**Por qué la suite podía estar verde con esto roto, que es lo que hay que no
repetir.** Ningún test ejecutaba `promoverImagenDePropuesta`: el del panel la
mockea, el del borrado del original va por el Admin SDK, y el resto de la cadena
es puro. Entre el mock y el Admin SDK quedaba justo la función que fallaba. Y no
era por falta de ganas: `vitest.config.ts` no definía
`PUBLIC_FIREBASE_STORAGE_BUCKET`, así que cualquier test que intentara ese camino
moría con `storage/no-default-bucket` **antes** de tocar el emulador. Esa clave ya
está, y con ella el archivo de integración nuevo.

**El reporte:** «cuando una propuesta con imagen se promueve a actividad, el
usuario pulsó usar imagen pero no la tomó». Apretó «Sí, usarla», la imagen se veía
en el formulario, y al reabrir la actividad **el campo «Flyer e imágenes» está
vacío**.

**Lo que se descartó en la sesión del 2026-09-23, con la cadena corrida de punta a
punta y todo en verde.** Queda escrito porque es la mitad del trabajo y sin esto
la próxima sesión lo repite:

- `PropuestasPanel.convertir` promueve y manda la imagen en `copia.imagenes`, con
  `portada: true` — ya cubierto por `tests/propuestas-panel.render.test.tsx`;
- `ActividadFormulario` montado con esa `copia` llega a `guardarActividad` con la
  imagen puesta (montado de verdad, no leyendo el fuente);
- `guardarActividad` la pasa a `crearActividad` y el schema no la rechaza;
- `formADocumento` la escribe, con y sin `ancho`/`alto`;
- `documentoAForm`/`imagenesDe` la leen de vuelta;
- ninguna Function escribe `imagenes` de `/actividades`: el trigger de aceptación
  borra el **original** en `propuestas/` y verifica antes la copia (B-863), y el
  barrido de huérfanas tiene 72 horas de gracia.

**O sea que falta evidencia de runtime**, que es lo único que la sesión no pudo
conseguir: si `promoverImagenDePropuesta` falló de verdad —`getDownloadURL`, el
`fetch` del objeto, el re-saneado del cliente sobre un archivo que el servidor ya
saneó— la conversión **sigue igual** y el motivo va a un aviso arriba del
formulario («La imagen que mandaron no se pudo traer (…). La actividad se abre sin
ella»). Ese aviso es hoy un párrafo entre otros y puede pasar desapercibido, que
es justo lo que haría que el modo de falla se lea como «no la tomó».

**Próximo paso:** reproducir contra los emuladores con la consola abierta y mirar
(a) si el aviso aparece y con qué causa, y (b) qué tiene `imagenes` en el
documento recién creado. Según qué conteste, el arreglo es el fallo de Storage o
—si el documento sí la tiene— la lectura al reabrir. **Y en cualquiera de los dos
casos entra además hacer el fallo imposible de ignorar:** hoy, si la promoción no
sale, lo que queda es una actividad sin flyer y un original huérfano que nadie
barre (`propuestas/` no lo recorre `limpiarImagenesHuerfanas`).

## P2 — mejoras reales

### B-2218 · Un fallo persistente de Calendar no se reemite solo · P2 (sale de B-2186, 2026-10-19)

Desde B-2186 lo pasajero se reintenta y lo que igual falla manda un mail, pero
reparar sigue siendo a mano: `planificar` solo emite si el evento calculado cambió,
así que guardar la actividad no reenvía un `update` que falló. **Arreglo:** guardar
por sesión un hash del último evento que Calendar aceptó y planificar contra eso, no
contra `before` (resuelve también el desorden de B-2194); o un barrido diario con
`reconciliacion.js` que compare contenido y no solo existencia. También: que una
sesión con fecha ilegible se saltee y no frene a las demás (hoy avisa y no manda
ninguna).

### B-2220 · Un schedule que deja de correr no avisa · P3 (sale de B-2195, 2026-10-19)

`barrido-fallo` avisa si un barrido falla **corriendo**; si el job de Cloud
Scheduler queda pausado o se borra, o la Function crashea antes del cuerpo, no hay
log que filtrar. **Arreglo:** que cada schedule escriba un latido en
`sistema/latidos.<nombre>` y que `verificarFrescuraDelSitio` avise si alguno tiene
más de 48 h; más una segunda política de GCP sobre `severity>=ERROR` en los
servicios de Cloud Run (es configuración de consola, no del repo).

### B-2191 · `events.json` lleva todo el histórico y crece sin tope · P2 (auditoría 2026-10-19)

Producción, 2026-10-18: 1.080.883 B (168 KB gzip), 519 actividades, 382 ya
terminadas (534 KB del array). `imagenUrl` ocupa 94 KB y no tiene lector
(`eventsJson.ts:385`); el `JSON.stringify(…, null, 2)` suma 278 KB sin comprimir.
La home lo baja en cada visita y `/pasadas` lo baja entero aunque ya trae las 382
filas en el HTML. **Arreglo:** partir en vigentes + `pasadas.json`, sacar
`imagenUrl`, emitir minificado, y que `/pasadas` haga el fetch al usar el
buscador. Actualizar el barrido de salidas y el gate post-build.

### B-2194 · Dos guardados seguidos procesados fuera de orden dejan Calendar con el contenido anterior · P2 (auditoría 2026-10-19)

El evento se arma con `event.data.after` de cada invocación, y Firestore no
garantiza orden. **Arreglo:** releer el documento al ejecutar y comparar contra un
hash del último evento enviado por sesión (el mismo campo de B-2186).

### B-2196 · Hosting no manda ningún header de seguridad · P2 (auditoría 2026-10-19)

`firebase.json` solo declara `Cache-Control`. Faltan `X-Frame-Options` /
`frame-ancestors` (cualquiera puede enmarcar `/proponer`, los `/sumar` o
`/admin`), `X-Content-Type-Options`, `Referrer-Policy` global y una CSP.
**Arreglo:** bloque `"source": "**"` con los tres primeros y la CSP en
`Report-Only` primero (GA y reCAPTCHA obligan a enumerar dominios).

### B-2197 · Una Action de terceros en un tag móvil recibe la key de deploy · P2 (auditoría 2026-10-19)

`FirebaseExtended/action-hosting-deploy@v0` en `push-main.yml:264` y
`deploy.yml`, con `secrets.FIREBASE_SERVICE_ACCOUNT` (lee todo Firestore, D-132).
**Arreglo:** fijar por SHA esa y `checkout`/`setup-node`/`setup-java`, o
reemplazarla por `npx firebase deploy --only hosting`.

### B-2198 · Ni los `.astro` ni el JS de `functions/` pasan por un type checker · P2 (auditoría 2026-10-19)

`tsc --noEmit` no lee `.astro` (48 archivos, 8.369 LOC, incluido el frontmatter
que importa `firebase-admin`), y `astro check` no anda: falta `@astrojs/check`.
`functions/` (65 archivos, ~15.000 LOC, el sync a Calendar) y los 46 `.mjs` de
`scripts/` no tienen `checkJs`. **Arreglo:** instalar `@astrojs/check` y sumarlo a
CI; un `functions/jsconfig.json` con `checkJs`, adoptado de a poco con
`// @ts-check` empezando por `calendario.js`, `sincronizacion.js` y
`calendario-trigger.js`.

### B-2199 · El foco de los campos de formulario no llega a 3:1 · P2 (auditoría 2026-10-19)

`claseInput` (`src/components/campos/Campo.tsx:105`) hace `focus:outline-none` y
deja solo el cambio de borde (1,49:1) y un anillo al 15 % (1,27:1). Lo usan
`/proponer`, los cuatro `/sumar` y todo el panel. **Arreglo:**
`focus-visible:outline-2 outline-acento outline-offset-1`, y sumarlo al chequeo de
`lib/contraste.ts`.

### B-2200 · `/proponer` repite ids y no tiene encabezado, pie ni GA · P2 (auditoría 2026-10-19)

`FormularioPublico.tsx` (370, 441, 471, 504, 587) repite en el `<div>` el `id` que
`Campo comoGrupo` ya puso en el rótulo: `prop-modalidad`, `prop-arancel`,
`prop-inscripcion`, `prop-via` salen dos veces y el `aria-labelledby` es ambiguo.
Además `seccion="ninguna"` (`proponer.astro:75`) apaga encabezado, pie, «saltar
al contenido» y el aviso de cookies: quien llega desde Google no puede navegar, y
la página de conversión no se mide. Quedó así de cuando no estaba anunciada; no
hay D. **Arreglo:** ids `${htmlFor}-rotulo` y una red que barra ids repetidos en
`dist/`; darle a `/proponer` el chrome como a `/anunciar`.

### B-2201 · El logo del encabezado es un PNG de 91 KB mostrado a 40 px · P2 (auditoría 2026-10-19)

`Encabezado.astro:271` usa `marca-512.png` (90.944 B) en todas las páginas: pesa
más que las tres fuentes precargadas juntas. **Arreglo:** una versión de ~80 px
con `srcset` 1x/2x (o SVG) por `astro:assets`, con hash e inmutable.

### B-2202 · El buscador de la home recalcula todo en cada tecla · P2 (auditoría 2026-10-19)

`Buscador.tsx:617` va directo a `setFiltros`; `chipsDe` (`:760`) corre
`filtrarPublico` entero por eje sin memo; `estadoDe` corre dentro del comparador
del `sort` (`listadoPublico.ts:573`) y parsea cada ISO 3-4 veces;
`fechasPublicas.ts:26` crea un `Intl.DateTimeFormat` por llamada (~1000 por
render). Se traba en un Android de gama media. **Arreglo:** `estadoDe`
precalculado por `(indice, ahora)`, chips memoizados, `useDeferredValue` para `q`,
formatters cacheados.

### B-2203 · El panel relee la colección entera de `/actividades` cada vez que se vuelve al listado · P2 (auditoría 2026-10-19)

`useActividades.ts` hace `getDocs` completo sin caché, y `ListaActividades` /
`CalendarioActividades` se desmontan al cambiar de vista: ~550 lecturas por
vuelta, más de 11.000 en una sesión de 20 ediciones. El badge de propuestas
(`bandejaDePropuestas.ts:516`) cuenta leyendo hasta 50 documentos en vivo.
**Arreglo:** caché de módulo por `rol|uid|ciudad` invalidada por `version` (como
`useContactoDeOrganizador`) o un `onSnapshot` compartido; `getCountFromServer`
para el badge.

### B-2204 · `optimizarImagen` no tiene guarda de reentrega y recomprime un JPEG ya optimizado · P2 (auditoría 2026-10-19)

`imagenes-trigger.js:84` decide con los metadatos del evento: si el evento del
upload llega dos veces, la segunda descarga el objeto ya optimizado y lo vuelve a
codificar con pérdida. **Arreglo:** leer `getMetadata()` del objeto antes de
descargar y salir si tiene `MARCA_OPTIMIZADA`, o fijar el `generation`.

### B-2205 · Un reporte que queda en `enviando` no tiene salida · P2 (auditoría 2026-10-19)

`reportes-trigger.js:114` y `reportes.js:143`: si el contenedor muere entre la
transacción y el `update` final, el reporte queda en `enviando` y nadie lo
retoma (se pierde, o el issue existe y el panel nunca muestra el número).
**Arreglo:** `actualizadoEn` y tratar `enviando` de más de ~5 min como
`pendiente`.

### B-2206 · Cada arranque en frío de las 25 Functions carga `googleapis` entero · P2 (auditoría 2026-10-19)

`index.js` importa todos los triggers, y `calendario-api.js:16` y
`analitica-trigger.js:42` importan `googleapis` (114 MB en disco, +58 MB de heap
medido en local). Lo pagan también las callables y `dispararRebuild`.
**Arreglo:** `@googleapis/calendar`, `@googleapis/analyticsdata` y
`@googleapis/searchconsole`; una sola `google-auth-library` (hoy conviven la 9 y
la 10); `import()` perezoso de `sharp`.

### B-2208 · Dependencias mayores atrasadas · P2 (auditoría 2026-10-19)

Raíz: `firebase` 11→13, `vitest` 3→5, `@astrojs/react` 6→7, `zod` 3→4,
`typescript` 5.9→7, `firebase-admin` 13→14; patches de `astro` (7.3.8) y `react`
(19.3). `functions/`: `firebase-functions` 6→7, `googleapis` 144→186,
`google-auth-library` 9→11. La raíz tiene `google-auth-library` en
`dependencies` y solo la usa un script. Sin Dependabot. `npm audit fix` resuelve
sin breaking `devalue`, `undici`, `http-cache-semantics`, `source-map-js` y
`smol-toml`. La foto de `10-salud` §6.2 es del 2026-09-09. **Arreglo:** un ítem
por salto, empezando por los patches y `firebase-functions` + `googleapis` contra
el emulador.

### B-770 a B-773 · La sección comercial `/anunciar` · P2

> ⚠️ **Este bloque estaba dentro de un bloque de código, y con él B-780 a B-786.**
> Dos ` ``` ` de sobra —restos de un texto pegado desde `.estado/comercial.md` con
> sus propias marcas— envolvían primero las tres filas de acá y después **siete
> ítems enteros**, que se renderizaban como código plano: sin tablas, sin negritas
> y sin links. Arreglado el 2026-09-07, junto con la misma cicatriz en
> `06-decisiones.md` (D-460 y D-461). Es el patrón de «merge mal resuelto» que ya
> tenía ítem propio en **B-294** y que ningún chequeo cuenta.

| # | Qué | Estado |
|---|---|---|
| **B-770** | **La sección comercial `/anunciar`**: ofrecerle espacio a cafés, librerías y espacios culturales, con el mail como única acción. Sin planes, sin precios y sin un número de audiencia inventado | ✅ hecho (2026-09-04) — D-450, `src/lib/comercialDelSitio.ts` + `src/pages/anunciar.astro`. Entra al sitemap y al pie; **B-377 sigue intacto** |
| **B-771** | ~~Revisar `/anunciar` cuando haya datos de audiencia.~~ **✅ Hecho el 2026-10-06 (roadmap 3.3)**: «Cuánta gente lo ve» con la audiencia del último mes cerrado, que guarda la analítica diaria en `sistema/audiencia-del-mes` y el build proyecta. El chequeo de `tests/comercial-del-sitio.test.ts` sigue prohibiendo cifras en lo escrito a mano: la única cifra la arma `bloqueDeAudiencia` con el dato | ✅ |
| **B-772** | **La fila de `/anunciar` en el índice de salidas públicas** | ✅ **hecho (2026-09-07)** — el dueño decidió numerarlas. Son **seis** filas y no cinco (`/suscribirse`, `/ayuda`, `/contacto`, `/404`, `/apoyar` y `/anunciar` → **13 a 18**), en las tres tablas atadas, más el `PALABRAS` del test y la prosa de los tres documentos. Cerró **B-654** de paso. Ver el ítem propio abajo |
| **B-773** | **Los settings de propiedad de GA4 que nadie verificó** — ver abajo, tiene cuerpo propio desde el 2026-09-07 | ✅ hecho (2026-09-25) — Signals y datos de usuarios apagados; la personalización de anuncios pasó de 307 a 0 regiones |

#### B-773 · Los settings de propiedad de GA4 que nadie verificó · P2 · ✅ hecho (2026-09-25)

**✅ Hecho (2026-09-25)**, con capturas del dueño de Administrar → Recogida de
datos. **Google Signals** estaba desactivado, y también la recogida de datos
proporcionados por los usuarios y la de ubicación y dispositivo granulares. Lo que
estaba prendido era la **personalización de anuncios**, en las 307 regiones: el
default de fábrica. No tenía efecto porque no hay cuenta de Ads vinculada y
Signals está apagado, pero bastaba con que alguien la vinculara. El dueño la dejó
en **0 de 307**. Anotado en `16-analitica-del-sitio.md` §9.4.

**Estaba citado en tres lugares y no tenía cuerpo.** Lo nombran la ficha del
`auditor-privacidad` (fila 12), `docs/13-agentes.md` y el texto de `/anunciar`, y
hasta hoy no había ítem que dijera qué es — o sea que las tres citas mandaban a un
número.

**Qué es.** B-480 cerró en la consola de GA4 las cuatro cosas del «Enhanced
Measurement» que mandaban eventos por su cuenta —búsquedas en el sitio, clics
salientes, `page_view` por cambio de historial, y el borrado de la clave `q`—.
**Lo que no se tocó son los settings de propiedad**, que son otra pantalla y otra
decisión:

- **personalización de anuncios** (`Google signals` / `Ad personalization`), que
  habilita audiencias y remarketing;
- **Google Signals**, que cruza la medición con la sesión de Google de quien mira
  y agrega datos demográficos.

**Por qué importa, y no es hipotético.** El texto de `/anunciar` afirma que «no hay
un anuncio, ni una red, ni un píxel», y el docblock de `comercialDelSitio.ts` ya
dejó escrito que la frase se redactó **evitando decir «no hacemos remarketing»**
justamente porque eso afirmaría un ajuste de consola que este repo no controla. O
sea: la página está escrita para no mentir sobre esto, y lo que falta es
**confirmar el estado real**.

**Y no hay ningún test que lo sostenga, ni puede haberlo**: es configuración de una
consola, no código. Es la misma clase que B-480 —cerrado y sin red— y por eso la
ficha del auditor ahora lo dice con esas palabras: si alguien lo reactiva, ningún
rojo lo dice.

**Qué habría que hacer**, y es de consola, no de repo:

1. En GA4 → Administrar → Configuración de datos → **Recopilación de datos**:
   confirmar que **Google Signals** está desactivado.
2. En Administrar → **Configuración de la propiedad**: confirmar que la
   personalización de anuncios no está habilitada para la propiedad.
3. Escribir el estado encontrado en `docs/16-analitica-del-sitio.md` §9.4, al lado
   de los otros pasos de consola, **con la fecha** — que es lo único que puede
   hacer de red acá: dejar por escrito qué se vio y cuándo.

Si alguno de los dos está activado, es una decisión: apagarlo (y entonces el texto
de `/anunciar` puede afirmar más) o dejarlo (y entonces hay que revisar que ninguna
página afirme lo contrario — el barrido de `tests/promesas-sobre-datos.test.ts`
mira las promesas sobre medición, no sobre publicidad).

---

### B-370 a B-379, B-480 y B-481 · La analítica del sitio público · P2

**Los diez ítems que salieron de la arquitectura de la analítica
([`16-analitica-del-sitio.md`](16-analitica-del-sitio.md), D-201), más dos que
salieron de auditar la implementación — uno antes de pushear.** El dueño ya
contestó las tres preguntas que bloqueaban este frente — **B-376 → C3**
(banner con aceptar/rechazar), **B-371 → aceptado** (el costo de JS de la
página de detalle) y **B-373 → diferido a propósito, para el final de todo**.
El §12 de `16-analitica-del-sitio.md` tiene el detalle completo de cada uno.

| Ítem | Qué es | Estado |
|---|---|---|
| **B-370** | El ítem paraguas y el documento de arquitectura | ✅ el tablero (con pestañas, B-500/B-501), el banner, el tag, los eventos, B-480, **y desde el 2026-09-03 B-373 y B-374** (`bcba7c6`: la Function diaria que lee GA4 y Search Console). Quedan en futuro B-377 y B-379. *Corregido el 2026-10-06: esta fila decía que faltaban B-373 y B-374 un mes después de construidos* |
| **B-371** | **Decisión del dueño:** aceptar el costo de JavaScript en la página de detalle, que hoy tiene cero | ✅ resuelto — **aceptado** (D-251), con el número medido en el §6bis del documento |
| **B-372** | Instalar el tag de GA4 en las páginas públicas — la mitad vendible entera | ✅ hecho (2026-09-03) — código, enganche en `Base.astro` y **B-480 resuelto** en la consola. En el camino se encontró y corrigió un `preconnect` a `googletagmanager.com` sin condicionar al consentimiento (D-254), con un test que lee el `dist/` y frena cualquier tercero previo al consentimiento; B-481 anota lo que ese hallazgo dejó pendiente |
| **B-373** | Search Console: conectar el dominio y leerlo | ✅ **conectado el 2026-09-03 por el dueño, y leído al panel el mismo día** (`bcba7c6`, `traerAnaliticaDelSitio`: «¿Google nos encuentra?» en la pestaña «El sitio público») |
| **B-374** | La Function que lee la Data API de GA4 para el resumen del panel | ✅ hecho el 2026-09-03 (`bcba7c6`); con un mes de datos ya alimenta la 3.2 y la 3.3 del roadmap (2026-10-06) |
| **B-375** | Los eventos propios: el clic en inscripción y el filtro que deja cero | ✅ construidos (`clic_inscripcion`, `filtro_sin_resultados`) y **ya miden**, con B-372/B-480 cerrados |
| **B-376** | **Decisión del dueño:** el aviso de privacidad y el consentimiento, entre las tres opciones del §7 | ✅ resuelto — **C3** (D-250), banner construido en `src/components/sitio/AvisoDeCookies.astro` |
| **B-377** | El inventario publicitario: una salida pública nueva. Anotado, no resuelto | 🔵 futuro |
| **B-378** | El tablero del catálogo es una foto y no una serie | ✅ hecho (2026-09-28) — la **guarda**: `/fotosDelCatalogo/{AAAA-MM}` con los conteos de `estadoDelCatalogo`, la saca el panel de un admin la primera vez que carga el catálogo en el mes (`src/lib/fotoDelCatalogo.ts`, `03-modelo-de-datos.md`). Dibujar la serie es **B-2164** |
| **B-379** | El tablero agrupa en el navegador; con miles de actividades conviene un agregado | 🔵 futuro |
| **B-480** | — ✅ hecho (2026-09-03). El dueño apagó en la consola de GA4 (flujo `G-9CFMHSSGRC`, Enhanced Measurement) **«Búsquedas en el sitio»** y **«Clics salientes»**, y —al configurarlo— dos cosas más que aparecieron: **desactivó los `page_view` basados en el historial de navegación** (el buscador reescribe la URL con `replaceState` en cada filtro, así que sin esto cada toque contaba una vista con el texto de `q` en la URL), y en **Ocultar datos** activó el borrado de la clave de consulta **`q`** —el parámetro donde viaja el texto del buscador—, que es la red durable: GA4 lo borra al recibirlo pase por donde pase. Con esto B-372 queda cerrado. | ✅ hecho (2026-09-03) |
| **B-481** | **Las tipografías (`fonts.googleapis.com`/`fonts.gstatic.com`) son, hoy, una conexión a un tercero en el load** — el mismo `preconnect` que D-254 sacó para GA4, pero decidido antes de que hubiera un banner y sin la lupa del consentimiento encima. Autoalojarlas (servir los `.woff2` desde el propio dominio) la eliminaría del todo. No es privacidad en el mismo sentido que B-480 —una tipografía no manda datos de la persona—, es la misma clase de dato de red (que este navegador entró al sitio) que ya se decidió aceptar para las fuentes, y conviene tenerlo escrito ahora que el tema está sobre la mesa | ✅ **hecho (2026-09-03)** — autoalojadas en `public/fuentes/`, servidas con `@font-face` desde `src/styles/global.css` y precargadas en `Base.astro`. **Cero terceros en el load** y un pedido menos; el `preconnect` a `fonts.googleapis.com` ya no está. La decisión es **D-340**. Lo encontró `npm run backlog:contradicciones` (B-1170, B-1220): el documento lo decía bien y este registro no |
| **B-500** | El aviso «ya-paso»: el dueño no entendía por qué el tablero marcaba como problema algo que es el archivo funcionando bien | ✅ hecho (2026-09-03) — primero reencuadrado (D-270), después **sacado del todo** (D-273): el dueño señaló que la lista crece sin techo y no pide ninguna acción para casi nada. Queda la cobertura acotada «cuántas tienen fecha futura», no la lista |
| **B-501** | El tablero pasa a pestañas internas — «El catálogo» y «El sitio público» — para que entre sin scroll infinito | ✅ hecho (2026-09-03) — `EstadisticasPanel.tsx`, D-271 |
| **B-502** | La pestaña «El sitio público»: el andamiaje honesto de lo que B-374 va a mostrar, sin un solo número inventado | ✅ hecho (2026-09-03) — estado vacío deliberado, con la fecha de arranque de la medición (3 de septiembre de 2026) y qué falta para que deje de estar vacío. D-272 |

### B-2168 · Los links rotos eran inscripciones «por formulario» con un @usuario · P3 — quedan dos a mano

B-2165 leyó los 14 links rotos del 2026-09-28 como webs de organizador mal cargadas.
Mirado contra la base, solo 3 webs estaban mal (un mail personal, un texto con un link
de Passline adentro y «Enlace en la descripción»); **los 14 rotos venían del destino de
la inscripción**: 36 actividades con vía «formulario» y un `@usuario` de Instagram de
destino, que `urlSegura` convertía en `https://usuario/`. Las tres «con forma de
dominio» que B-2165 daba por imposibles de detectar llevaban la arroba adelante
(`@sol.reviews`, `@savetheday.leer`, `@preferiaria.estar.leyendo`): `new URL` la
descarta como un usuario vacío. **Arreglado en el sitio:** `urlSegura` rechaza un texto
que empieza con `@` (test en `tests/detallePublico.test.ts`). **Falta el dato:**
`scripts/corregir-contactos-mal-cargados.mjs` lo corrigió: el dueño lo corrió en
producción el 2026-09-29 (39 actividades escritas) y `links:revisar` dio después
**cero rotos** en 508 páginas. Quedan los dos destinos que el script lista para
corregir a mano. Hueco que queda: el aviso «web que no enlaza» del tablero mira solo
`organizador.web` y no el destino de una inscripción por formulario, así que este caso
no aparecía en el tablero. Se cierra cuando se corrijan esos dos.

### B-2178 · Organizadores que el slug no junta, y valores que no son organizadores · P2 — unión aplicada y relleno sin sembrar (2026-09-29); quedan los grupos dudosos

**Hecho (2026-09-29): el script de unión.** `npm run organizadores:unir:prod`
(`scripts/unir-organizadores.mjs`) lee la tabla `scripts/datos/organizadores-a-unir.local.json`
y a cada actividad de un origen le escribe `organizador.nombre` (la etiqueta del
destino en `/opciones/organizador`, o su variante más escrita), `organizador.slug` y
el `searchText`. Sin `--aplicar` informa; `--aplicar` fuera del emulador pide
`--produccion` y además `confirmada: true` en la tabla. Deja una versión del §12 por
actividad, un rebuild y, en las publicadas cuyo nombre cambia, **un update de
Calendar por sesión**: la descripción del evento lleva «Organiza: {nombre}».

**La tabla no se versiona** (lo cobró el `auditor-privacidad`): se arma con los
nombres de todas las actividades, borradores incluidos, y muchos organizadores son
personas; el repo es público. La real es `scripts/datos/organizadores-a-unir.local.json`,
que git ignora y quedó armada como propuesta en la máquina del dueño (14 uniones,
2 grupos que no se unen porque son actividades conjuntas, 6 por completar y 3 dudas
de grafía). En el repo queda `organizadores-a-unir.ejemplo.json`, con nombres
inventados. **Nombres reales de organizadores no van a ningún archivo del repo**
(este ítem incluido): un borrador no es público.

**Aplicado el 2026-09-29:** la tabla confirmada por el dueño (21 uniones) reescribió
32 actividades en producción, 31 publicadas, con sus eventos de Calendar. Quedaron
afuera a propósito los grupos dudosos (la nota de la tabla local los nombra).

**Para que no vuelva a juntarse (2026-10-06):** el tablero tiene el aviso
«Publicadas con un organizador que no es un organizador» (`organizadorDeRelleno`): el
relleno, una cuenta, el barrio o la ciudad, o caracteres raros, al día siguiente de
cargarlos.

**Segunda tanda, aplicada el 2026-09-30:** dos uniones más confirmadas por el dueño
(2 actividades); tres grupos decididos como distintos y dos que el dueño está
averiguando. La nota de la tabla local los nombra. Las dos opciones de origen que
quedaban en `/opciones/organizador` se borraron el mismo día, después de revisar las
477 actividades y ver que ninguna las usaba: el `usos: 1` que les quedó era el
contador viejo, porque la unión no lo descuenta.

**Falta (lo de antes, ya resuelto salvo el relleno):** que el dueño corra el informe contra producción, complete y corrija la
tabla, ponga `confirmada: true` y lo aplique (fuera de hora, por Calendar). Después
de cada tanda, borrar las opciones de los orígenes que queden en la lista (el
informe las nombra; las de las dos primeras tandas ya están borradas). Y los valores de relleno de abajo, que el script no toca: **no se sembraron** (`--excluir`, 2026-09-29), así que no tienen página; sus actividades siguen con el nombre de relleno hasta que alguien las corrija, y guardarlas lo vuelve a dar de alta (B-2179).

La corrida en seco de `vocabulario:prod -- --campo=organizador` del 2026-09-29 (457
actividades, **267 organizadores**) muestra lo que ese número ya anunciaba en
B-2172: el slug junta las variantes de tipeo, pero no los nombres distintos de la
misma casa. Con las páginas ya construidas (B-2172 paso 4), **cada uno es una
página pública aparte** en cuanto se siembre la lista, así que hay que decidirlo
antes de sembrar.

**Unos 20 grupos parecen la misma casa** con dos o tres nombres —la sucursal, la
fundación y el museo, la casa con y sin «Libros», un typo que el slug no junta—, y
**unos 10 valores no son un organizador**: texto de relleno («A conf», 6
actividades, casi seguro un «a confirmar»; «Buscando»), lugares, un nombre cortado,
uno con un `|` al final y una cuenta de Instagram en lugar de un nombre. La lista
con los nombres es la de la corrida en seco, que no se versiona.

**Cómo se arregla, y por qué no alcanza con la lista.** Renombrar o borrar la opción
no toca las actividades: su slug sale de su propio nombre (D-26), así que la página
aparte seguiría existiendo. Juntar dos organizadores es **reescribir el
`organizador` de esas actividades** al mismo nombre. O a mano desde el panel —son
unas 60 actividades—, o con un script que tome una tabla `slug → slug` decidida por
el dueño (con la guarda de producción de los demás y versión del §12 por cada
documento). **El paso 4 no distingue el relleno**: quien está aprobado y tiene una
publicada tiene página. La defensa es borrar la opción desde el panel (ayuda de
Opciones) o corregir antes la actividad, no un filtro de código. Un
`/organiza/a-conf` indexado es peor que no tener la página.

### B-2170 · El resumen diario lee con la key que más puede · P3

El resumen de la bandeja (roadmap 2.1) lee `/propuestas` y las fichas con
`FIREBASE_SERVICE_ACCOUNT`, que es `deploy-ci@`: además de leer, despliega reglas,
Hosting y Functions (02-infraestructura § Roles). Se eligió así para no crear una
credencial nueva, y la key vive en el `env` de un solo paso. Lo señaló el
`auditor-privacidad`: una **cuenta aparte con solo `datastore.viewer`** achicaría lo
que expone un job diario y desatendido. Costo: una service account más, su key en un
secret de Actions y una fila en 02-infraestructura. Decidirlo si el resumen crece o
si aparece otro job programado con la misma key.

### B-2167 · Once pares de actividades publicadas que parecen duplicadas · P2 — pendiente del dueño

> **2026-10-06 — el filtro puede mostrar más pares desde la 2.7**: la regla suma «el
> mismo organizador, el mismo día, a la misma hora», que no necesita títulos
> parecidos. Al revisar los once, mirá también los nuevos que aparezcan.

El aviso de posibles duplicados (roadmap 5.4), medido contra el `events.json`
publicado del 2026-09-28, encontró 11 pares que se parecen el mismo día. La mayoría
parecen la misma actividad cargada dos veces —«Festival argentino de historieta» y
«…de la Historieta», los dos «Borges salvaje», «El buen mal» en el mismo lugar y hora,
las dos «Lectura silenciosa», las dos «Gran Barata de libros», «El misterio del
cuento» con y sin «Octubre»— y una es la misma cargada una vez por modalidad
(«Alto viaje», presencial y virtual), que desde B-224 es **una** actividad con dos
filas de «Dónde». Otros pueden ser distintos a propósito (FILBA y un evento de FILBA).
**Qué hacer:** en el listado, Filtros → «Posibles duplicados» → «Solo las que se
parecen a otra» los muestra todos juntos (y el aviso aparece también al abrir
cualquiera de las dos). Si son la misma, dejar una y cancelar o borrar la otra. Se
cierra cuando el filtro no muestre ninguno que sea de verdad el mismo.

### B-2166 · Una sede con el barrio «Rosario» sobrante en Rosario · P3 — pendiente del dueño

Lo encontró el aviso nuevo «Publicadas con un lugar que no cierra» (roadmap 5.3) la
primera vez que se midió contra el `events.json` publicado, el 2026-09-28: es la única
actividad con fecha por venir que marca. Es el caso que B-1124 ya había nombrado
(«Lectura y análisis de Mariana Pineda»): el barrio repite la ciudad, y como
`piezasDeLugar` muestra un barrio cargado fuera de CABA, la ficha dice el lugar dos
veces. Se corrige en el panel con «Quitar el barrio», que aparece en «Dónde» desde
B-2173 (antes el formulario no mostraba el barrio fuera de CABA y no había qué tocar). Se
cierra cuando el aviso deje de marcarla.

### B-2164 · Dibujar la serie de fotos del tablero · P3 — vigilado hasta que haya tres fotos

Desde el 2026-09-28 el panel guarda una foto por mes del catálogo (B-378). Con
una sola foto no hay tendencia que mostrar; con tres (**enero de 2027**, si el
panel se abre en octubre, noviembre y diciembre) vale dibujar «publicadas por
mes» y «% gratis por mes» en la pestaña «El catálogo». Al dibujarla, decir el día
de `tomadaEn` si alguna foto se sacó tarde en el mes, y tener en cuenta
`version` si cambió la forma.

## P3 — cuando sobre tiempo

### B-2209 · El panel interpreta los `datetime-local` en la zona del navegador · P3 (auditoría 2026-10-19)

`aDatetimeLocal`/`deDatetimeLocal` (`src/lib/sesiones.ts:25`) usan los getters
locales de `Date`: desde un navegador fuera de ART se guardan instantes corridos,
y un día sin hora (B-2175) puede caer en el día anterior. Ninguna config de
vitest fija `TZ`. Hoy no pasa (un solo operador en Argentina). **Arreglo:** offset
fijo `-03:00`, y como mínimo `TZ` distinta de ART en `vitest.config.ts`.

### B-2210 · El slug de una actividad solo es inmutable por el formulario · P3 (auditoría 2026-10-19)

`firestore.rules` congela el slug de las cuatro fichas de la Guía, pero no el de
`/actividades`: la consola, un script o una restauración pueden cambiarlo
(trampa 10). **Arreglo:** `!publicadaAlgunaVez(previo) || d.slug == previo.slug`
con un test de reglas.

### B-2211 · El aviso «volvió a publicar» hace figurar como canceladas corridas que publicaron · P3 (auditoría 2026-10-19)

`deploy.yml:340`: `avisar-recuperado` corre en otro runner bajo
`cancel-in-progress`. El 2026-10-05, las corridas 37365196921 y 37368874735
publicaron bien y figuran `cancelled`; la 37369391156 venció esperando runner y
no mandó mail (`failure()` es falso para un job cancelado). **Arreglo:** pasar el
chequeo a un paso final del job `deploy` o a un `workflow_run`.

### B-2212 · Costos escritos que ya no valen: Scheduler y lecturas diarias · P3 (auditoría 2026-10-19)

Son 7 jobs de Cloud Scheduler y 3 son gratis: ~USD 0,40/mes, el 8 % del
presupuesto, y no está en `08-operacion.md` § Costos. `frescura-trigger.js:106`
calcula sobre ~100 publicadas (hoy ~451: ~21.600 lecturas/día), y con
`limpiarImagenesHuerfanas` y el panel ya se anda cerca de las 50.000 gratis. Una
opción nueva relee todas las publicadas (`mismasEtiquetas`), aunque ese recorrido
hoy repara de rebote el evento de la actividad que la creó. **Arreglo:** juntar
los barridos diarios en una función de mantenimiento; corregir las cuentas; que
la frescura compare primero `generadoEn` contra `despacho.cubreHasta`.

### B-2213 · Índices sobrantes, sin exenciones, y `/reportes` sin retención · P3 (auditoría 2026-10-19)

`firestore.indexes.json:7` (`estado` + `updatedAt desc`) es del listado anónimo
que D-128 sacó. `fieldOverrides` vacío: cada versión indexa el documento entero,
y en `actividades` se indexan `descripcion` y `searchText`. `/reportes` tiene
`delete: if false` y guarda `reportadoPor.email` sin retención.

### B-2214 · CSS del panel en el sitio público, una lib del panel en el bundle del Buscador, `indiceDelSitio()` sin memo · P3 (auditoría 2026-10-19)

168 de 769 selectores de `Base.*.css` son solo del panel (~12 KB sin comprimir).
`listadoPublico.ts:34` y `tarjetaPublica.ts:44` importan `ETIQUETA_MODALIDAD` de
`filtrosActividades` (3 KB gzip de más). `indiceDelSitio()`
(`contenidoDelSitio.ts:976`) no está memoizada aunque `agenda/[mes].astro:19`
diga que sí. `events.json` va `no-cache` aunque la URL lleva `?v=`: se podría
publicar `/indice/<version>.json` inmutable.

### B-2215 · Sin linter, y exports muertos que tsc no ve · P3 (auditoría 2026-10-19)

Sin `noUnusedLocals`/`noUnusedParameters`. Hay 16 exports sin ningún uso (entre
ellos `tieneClaimAdmin`, `TOPE_INSTAGRAM_LUGAR`, `TOPE_INSTAGRAM_SUSCRIPCION`,
`AA_GRANDE`, `DICHO_DEL_MOTIVO`). **Arreglo:** prender esos dos flags y evaluar
`knip`.

### B-2216 · Doc desactualizada que encontró la auditoría · P3 (auditoría 2026-10-19)

`07-seguridad.md:1583,1792` dice «cuatro escrituras anónimas» y son cinco (falta
`/bibliotecas`); la tabla de tests salteados de `10-salud` §6.1 es del
2026-09-09 (hoy son 31 archivos con `skipIf`); el `<title>` del detalle
(`detallePublico.ts:1703`) no sigue la forma de `12-sitio-publico.md:1301` y deja
el barrido después del corte de ~60 caracteres.

### B-2217 · Higiene menor de seguridad · P3 (auditoría 2026-10-19)

Cinco `firebase-export-*` vacíos en la raíz y el patrón no está en `.gitignore`
(un export con datos podría subirse con `git add -A`).
`flyer-de-propuesta-trigger.js:67`: `consumeAppCheckToken: false` permite reusar
un token una hora desde un script; consumirlo en esa callable no pesa.
`cors.json` y `ORIGENES_PERMITIDOS` no listan los mismos dominios. El
`events.update` del trigger (`calendario-trigger.js:262`) no manda
`status: 'confirmed'`, que según `crearEvento` es lo que resucita un evento
borrado: medir contra la API real.

### B-2176 · «Algunos etiquetados menos»: averiguar qué pidió la publicadora · P3

En el mismo mensaje que pidió B-2175 (2026-09-29) agregó «y algunos etiquetados
menos», sin más. Revisado: **nada del panel exige etiquetar ni arrobar a nadie**
para guardar o publicar (el schema no tiene ninguna regla sobre `tags` ni sobre
`difusion.arrobar`). Lo que sí pasa solo es que el texto para redes suma al pie,
además de «Arrobar al publicar», **la cuenta de Instagram del organizador y la del
tallerista** (`handlesDe` en `src/lib/textoRedes.ts`), y hoy no hay forma de
sacarlas del posteo sin borrar el campo. Si el pedido es ése —no arrobar a una
cuenta que no contesta—, es decisión de producto. Se cierra preguntándole qué
quiso decir.

### B-731 · Confirmar en la consola que los avisos bajaron, después del próximo rastreo · P3

**Lo único que queda del lado del dueño, y es mirar, no arreglar.** Después del
próximo deploy y del rastreo siguiente:

1. **Inspección de URL** sobre una página de **ciclo** —cualquiera de las 17 con
   más de un encuentro; `feria-del-libro-malvinas-argentinas` es la más grande,
   con 11— y confirmar que en la pestaña de datos estructurados cada `subEvent`
   ahora trae `description`, `location` y `organizer`.
2. En el informe «Eventos», que `description` y `organizer` **desaparezcan** de
   la tabla de avisos, y que `offers` baje a las actividades ya pasadas.
3. Los conteos de `performer`, `image`, `price`, `priceCurrency`, `validFrom` y
   `organizer.url` **van a subir**, y está bien: el informe cubría 18 de 68
   páginas y va a cubrir las 68. No es una regresión, es el rastreo llegando.

**«Falta el campo "location"» (B-734, 2026-10-13):** después del deploy, abrir ese
aviso en el informe «Eventos» y apretar **«Validar corrección»**. Los dos items eran
los encuentros de `club-de-lectura-alma-lectora-mdp-octubre`, que ahora llevan cada
uno su sede.

**Cargar el `sitemap.xml` en Search Console si todavía no está** (lo pide B-373):
es lo que hace que las 50 páginas que Google no había visto entren rápido.

#### La lectura del 2026-09-25 (informe actualizado al 23/9) — el arreglo está en vivo, falta que Google relea

**Válidas 209, no válidas 31**, y las 31 son las mismas que ya se esperaba: `location`,
`description` y `organizer` valen **31 las tres**, o sea el markup anterior a B-730
en páginas que Google todavía no volvió a leer. La **prueba en tiempo real** de
`/actividad/feria-del-libro-malvinas-argentinas/` da **11 eventos válidos**, que
son los 11 `subEvent` de la feria: el punto 1 de arriba está cumplido. Esa URL no
estaba indexada («Google no reconoce esta URL», «No se ha detectado ningún sitemap
de referencia»). El sitemap **sí** estaba enviado, desde el 2026-09-03, pero como
`http://agendaleh.ar/sitemap.xml`: estado Correcto, última lectura el 24/9, 457
páginas descubiertas. Ese día el dueño pidió la indexación, pidió la validación de
`location` y envió también la versión `https://`, que es la canónica.
Los avisos de `organizer.url` (182), `performer` (157), `price`/`priceCurrency`
(87), `image` (76) y `offers` (56) son datos no cargados (B-813), no código. Se
cierra cuando la validación de `location` termine en «Superada». **Validación
iniciada el 2026-09-25**, con las 31 pendientes. Se comprobó en el sitio publicado
que los dos ejemplos que da Google (`taller-sillas-tres-sillas`, rastreada el 7/9,
y `libros-encontrados`, el 4/9) ya traen `location` en todos sus `subEvent`.

#### La lectura del 2026-09-08 (informe actualizado al 6/9) — el rastreo todavía no llegó

El dueño pasó la pantalla del informe «Eventos». Así está:

| | Elementos |
|---|---|
| **No válidas** — `Falta el campo "location"` (crítico) | **44** |
| **Válidas** | **24** |

Y los nueve avisos: `performer` 65, `image` 49, `offers` 44, `description` 44,
`organizer` 44, `validFrom` (en `offers`) 24, `url` (en `organizer`) 24,
`priceCurrency` 20, `price` 20.

**El punto 2 de arriba todavía no se puede dar por cumplido, y los números dicen
por qué:** `location`, `description`, `organizer` y `offers` valen **44 los
cuatro**. Ese 44 es exactamente el conjunto que B-730 arregló —los `subEvent` que
eran cáscaras de `name` + fechas, sin ninguno de los cuatro campos— así que lo
que se está mirando es el markup **anterior** al arreglo. B-730 se implementó el
2026-09-04 y el informe está actualizado al 6/9 con el rastreo a mitad de camino
(las barras arrancan el 31/8), o sea que Google todavía no volvió a leer esas
páginas. Las 44 no válidas son el pasado del sitio, no su estado.

**Lo que hay que hacer con esto: nada todavía, y no pedir la validación aún.**
Pedirla antes de que el rastreo termine la hace fallar y el informe queda con la
marca de «validación fallida» encima. El orden es: esperar el rastreo → confirmar
por Inspección de URL que una página de ciclo ya trae los cuatro campos en cada
`subEvent` → recién ahí pedir la validación de `location`.

**De los nueve avisos, ocho no son código.** Se separan en tres grupos y solo uno
tiene arreglo en el repo:

- **Es el markup viejo** (van a caer con el rastreo): `description`, `organizer`,
  `offers`, los tres en 44.
- **Falta el dato, no el campo** — el código ya los emite cuando están cargados,
  y no están: `performer` 65 (actividades sin tallerista), `image` 49 (sin
  imagen), `url` en `organizer` 24 (organizador sin web), `price` y
  `priceCurrency` 20 (arancelado sin `arancel.monto`, que es el campo que B-114
  acaba de agregar). Inventarlos sería afirmar algo falso, que es la regla del
  §7; lo que sí se puede hacer es que el panel avise **antes de publicar** qué se
  va a perder — **B-813**.
- **No se emite nunca**: `validFrom` en `offers`, 24 — **B-812**.

## Vigilado — sin trabajo hasta que se cumpla su condición

**Estos no son pendientes.** Son decisiones ya tomadas o limitaciones aceptadas que
llevan escrita la condición que las reabriría. Los juntó acá el triage del
2026-09-24 para que no se lean como trabajo en la lista de prioridades: si la
condición se cumple, el ítem vuelve a su P.

### B-846 · La URL de descarga de un flyer privado es una capability, y eso no es «nadie puede leerlo» · P3

**Lo descubrió `tests/storage-reglas.integracion.test.ts` fallando**, escribiendo
el paso 8 de B-830: el caso afirmaba que sin sesión no se podía leer el objeto de
`propuestas/` «ni con la URL en la mano», y era falso.

`allow get: if esAdmin()` cierra el acceso **por ruta**: sin sesión, pedir la URL
de descarga es un permission-denied aunque se sepa el path exacto. Pero la URL que
`getDownloadURL()` **ya acuñó** sirve el objeto sin volver a evaluar las reglas —
es el mismo mecanismo que hace pública una imagen de `imagenes/`, donde es
deliberado (B-206 #1). O sea que el flyer de una propuesta es privado **mientras
su URL no salga del panel**.

**Por qué es P3 y no más:** la URL solo se acuña adentro del panel, con una sesión
de admin; el objeto se borra al rechazar o a los 30 días; y para que el token se
filtre tiene que salir del navegador del admin (una captura de devtools, un link
pegado en un chat). No hay ningún camino automático.

**Qué costaría cerrarlo:** no acuñar tokens nunca — bajar los bytes con `getBlob`,
que manda el `Authorization` en el header y no deja una URL portadora. Cuesta
**configurar CORS en el bucket** para el origen del panel (un `gsutil cors set`,
que es un paso de consola que hoy no existe en `08-operacion.md`) y cambiar el
visor y la promoción. Vale la pena el día que la bandeja tenga volumen, o antes si
aparece un segundo lugar que muestre objetos privados.

Está afirmado en las **dos** direcciones en el test, así que el día que se cierre,
el caso se pone rojo y hay que venir a decidirlo en vez de descubrirlo con una
imagen rota.

> **2026-09-16 — este ítem dejó de ser solo una fuga chica: es el primer escalón
> de otra cosa** (**D-722**, al cerrar **B-872**). Mientras las imágenes públicas
> se sirvan por URL de descarga, `firebasestorage` no se puede poner en
> `ENFORCED` sin apagar el sitio, así que **B-846 + B-222 son la precondición de
> exigir App Check en Storage**, no un arreglo paralelo. Eso no lo sube de P3 —no
> hay nada urgente colgando— pero sí cambia con qué se agenda: el día que se toque
> uno, se tocan los tres juntos, y recién ahí la medición de B-872 vale la pena.

> **A «Vigilado» el 2026-09-24 (triage):** diferido a propósito por el propio ítem, que dice cuándo vuelve.

### B-222 · Servir las imágenes propias por un dominio propio o un rewrite de Hosting · P3

**El motivo NO es privacidad** — eso quedó resuelto en B-206 #1 con el path opaco y la
lectura pública (D-131 §1). Lo que compra este cambio es otra cosa, y por eso bajó a P3:

- **Costo de egreso.** Hoy cada imagen se sirve desde `firebasestorage.googleapis.com`
  y paga egreso de GCS por descarga. Detrás del CDN de Hosting, la mayoría de las
  descargas las contesta el borde.
- **Portabilidad.** La `url` que se guarda en el documento **incluye el bucket y un
  token**: mudar de bucket, o revocar un token, invalida todas las URLs ya guardadas y
  hay que reescribir documentos. Con una URL propia (`/img/<id>.jpg`) el documento
  guarda algo estable y el mapeo vive en un solo lugar.

Firebase Hosting **no** tiene rewrite directo a un bucket de GCS: hay que poner una
Cloud Function o un Cloud Run que haga de proxy, y eso agrega cold start al camino de
una imagen. Conviene hacerlo junto con B-220, que ya va a tocar esa zona.

> **A «Vigilado» el 2026-09-24 (triage):** diferido a propósito por el propio ítem, que dice cuándo vuelve.

### B-786 · P3 — el `Referer` a Cafecito, y cuándo habría que volver a decidirlo

El enlace sale con el `Referer` por defecto
(`strict-origin-when-cross-origin`), así que a Cafecito le llega
`https://agendaleh.ar` — el origen, sin ruta ni query. No identifica a nadie, y no
se puso `noreferrer` a propósito: borraría la única señal de que el aporte vino del
sitio, y eso es información que nos interesa perder por nada.

Queda anotado por dos motivos. Uno: es la primera vez que el sitio manda un
`Referer` a un tercero **por una acción de la persona**, y el criterio con el que se
decidió que está bien tiene que estar escrito antes de que haya un segundo caso.
Dos: **si algún día el enlace sale desde otra página** —una tira en el pie de la
página de detalle, por ejemplo— el `Referer` pasa a decir **qué actividad** estaba
mirando, y ahí sí hay algo que decidir.

---

### B-225 · Partir la key de CI en dos el día que el secret tenga más de un lector · P2

D-132 le dio a `deploy-ci@` los roles para desplegar reglas y Functions, y aceptó
por escrito lo que eso significa: una key filtrada **hace legible todo Firestore** y
puede desplegar código que corre como `calendar-sync@`. La decisión se apoya en un
hecho del proyecto de hoy: **el secret tiene un solo lector**, el dueño del repo.

**El disparador de este ítem es que eso deje de ser cierto.** Un colaborador con
push a `main`, un fork con Actions habilitado, un runner de terceros: cualquiera de
los tres multiplica los lugares desde donde esa key se puede usar, y ahí el balance
de la tabla de D-132 se da vuelta.

**Lo que hay que hacer cuando pase**, que es lo que B-194 ya proponía como forma
menos mala y no se hizo:

- **`build-ci@`** — `datastore.viewer` + `serviceusage.serviceUsageConsumer`. Es la
  que usa el build de Astro para leer Firestore. Sin permiso de deploy de nada.
- **`deploy-ci@`** — el resto de los roles, y su key **detrás de un `environment` de
  GitHub con required reviewers**, para que desplegar reglas o Functions pida una
  aprobación humana en vez de ser un efecto de cualquier push.

El costo es un secret más y un `environment` que configurar; el beneficio es que el
job que solo lee no cargue el alcance del que publica.

**Mientras tanto, lo que sí está**: la rotación documentada en
[`08-operacion.md`](08-operacion.md), con el paso de redesplegar las reglas desde el
repo ordenado segundo, y `tests/roles-deploy-ci.test.ts`, que impide que el
documento de seguridad vuelva a decir que el daño se limita a leer.

> **2026-09-03 — verificado, el disparador todavía no ocurrió.** Contra la API
> de GitHub, con la cuenta dueña del repo (`gh api repos/benoffi7/agenda-literaria/…`):
> **un solo colaborador** (`benoffi7`, admin), **cero forks**, **cero
> colaboradores externos** (`?affiliation=outside`), **un solo secret de
> Actions** (`FIREBASE_SERVICE_ACCOUNT`) y **cero `environments`** configurados.
> El secret sigue teniendo un solo lector, así que la condición que dispara
> este ítem sigue sin cumplirse — no se implementó el split de `build-ci@` /
> `deploy-ci@` porque hacerlo ahora sería resolver un problema que todavía no
> existe, en contra de lo que el ítem mismo pide ("el día que pase"). Queda
> escrito para que la próxima vez que se agregue un colaborador con push, se
> habilite un fork con Actions, o se sume un runner de terceros, sea la señal
> de volver a este ítem.

---

### B-366 · Las reglas de Storage no se pueden particionar por proyecto · P3

Residual conocido de B-219, anotado en el docblock de `cargarReglasStorage`.

A diferencia de Firestore —que tiene
`/emulator/v1/projects/{p}:securityRules`— el emulador de Storage expone
`/internal/setRules`, que es **global**: la última carga gana para todos los
proyectos. Así que el aislamiento por `projectId` no llega hasta ahí.

**Hoy no muerde**, y vale decir por qué para no sobreestimarlo: los objetos van con
nombre único por caso (`img_test-<base36>-<n>`), nadie barre el bucket, y dos
checkouts empujando el mismo `storage.rules` cargan lo mismo. Muerde el día que dos
worktrees corran a la vez **con `storage.rules` distinto** — o sea, cuando alguien
esté cambiando esas reglas, que es justo cuando el test importa.

No hay arreglo dentro del emulador: sería un puerto de Storage por checkout, que es
la candidata que D-195 descartó. Si esto llega a molestar de verdad, el camino más
corto es un lock de archivo alrededor de `storage-reglas.integracion.test.ts`
—serializa un solo archivo, no la suite.

## Agentes y automatización del flujo (B-115 a B-124)

Lo que quedó pendiente al definir los agentes y skills de `.claude/`. El qué hay
y por qué está en [`13-agentes.md`](13-agentes.md). La prioridad va en cada ítem.
