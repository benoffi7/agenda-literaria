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

- **B-1235** — convertir en el panel de producción una propuesta con foto y
  confirmar que la actividad reabre con el flyer. Está en manos de la socia del
  dueño desde el 2026-09-25.
- **B-731** — esperar el resultado de la validación de «location» que se pidió en
  Search Console el 2026-09-25 (llega por mail). Nada que hacer hasta entonces.

## P0 — rompe algo o pierde datos

Sin ítems abiertos desde el 2026-09-23. Los ya arreglados, con su prosa, están
en [`BACKLOG-cerrados.md`](BACKLOG-cerrados.md) § «P0 — rompe algo o pierde datos».

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

### B-798 · 🟡 la emisión hecha (2026-09-09) — «Filtros que no encuentran nada» decía cuántas veces, no cuál filtro · P2

> ✅ **Hecha la mitad de emisión, y el diagnóstico del ítem estaba incompleto.**
>
> El ítem daba por sentado que el evento ya emitía el desglose y que el corte era
> solo de la Function. **No era así:** el `eje` salía de `ejeQueSobra`, que mira los
> **seis** rieles de chips, y el listado tiene **diez** filtros. Un cero causado por
> el texto del buscador, por el «Cuándo», por «abierta» o por «cursada» llegaba
> **sin ningún parámetro** — indistinguible de «ningún filtro solo explica el cero».
> O sea que hacer los pasos 1 y 2 y no éste habría dejado la pregunta sin contestar
> igual, con las dimensiones registradas y todo.
>
> Ahora `eje` cubre los diez, **sin reimplementar `ejeQueSobra`**: su respuesta
> manda —es la que pinta «Probá sin el filtro de…»— y los otros cuatro son la cola,
> así que la serie histórica de los seis no cambia ni un evento.
>
> **La mitad de privacidad es lo que hacía interesante al ítem, y quedó escrita:**
> `busqueda` es un eje —enum cerrado— y el texto tipeado no viaja. La garantía es
> **estructural**: `crudosDeFiltroSinResultados` saca el `slug` del mapa de los
> rieles y de ningún otro lado, y el buscador no escribe ahí. Y **el saneador solo
> no alcanzaba**: `FORMATO_SLUG` acepta `poesia` igual que `club-lectura`, y los
> cinco centinelas del barrido tienen todos mayúsculas, espacios, acentos o
> arrobas, así que pasar el texto tipeado **habría pasado, en verde**.
>
> **El frente corrió el `auditor-privacidad` sobre su propio diff y se cobró dos
> hallazgos.** El que importa: al mudar la garantía del saneador al llamador, la
> dejó **sin red en el lugar nuevo** —`medirSitio` recibe `Record<string, unknown>`,
> así que un payload escrito a mano compilaba, pasaba `tsc` y pasaba la suite
> entera—. Es la clase de B-81, y ahora hay un chequeo que lee el fuente del único
> emisor. El otro: «sale del mapa» **no es** «sale de la taxonomía» —`desdeQuery` no
> contrasta contra las opciones conocidas—, así que la frase se corrigió y la
> garantía quedó apoyada en el motivo correcto.
>
> Costo medido: **+88 B gzip** en todas las páginas y **+156 B** en el listado.
>
> **Siguen abiertos los otros dos tercios**, en el orden del ítem: registrar `eje` y
> `slug` como dimensiones en la consola de GA4 —**es lo que corre el reloj**, el
> registro no es retroactivo—, sumarlas a `DIMENSIONES_PERMITIDAS` de
> `functions/analitica.js` (decisión de privacidad, no cambio mecánico) y el
> desglose en la fila del panel.

**Lo preguntó el dueño el 2026-09-07 mirando la pantalla:** «no hay que expandir
eso para saber qué filtros?». Tenía razón, y la fila **prometía** lo que no podía
dar: decía «qué combinación de filtros deja la lista vacía, para saber qué etiqueta
conviene completar o retirar» y lo que muestra es **un número**.

**Dónde se corta el dato.** El evento sí lleva el eje y el slug elegidos
(`filtro_sin_resultados`, `analyticsSitio.ts`), pero la Function le pide a GA4
`eventName` + `eventCount` y nada más (`functions/analitica.js`), así que al panel
llega la cuenta y no el desglose. La promesa ya se corrigió: la fila dice ahora lo
que muestra.

**Traer el desglose son tres cosas, y la primera es la que corre el reloj:**

1. **Registrar `eje` y `slug` como dimensiones personalizadas de evento en la
   consola de GA4.** Un parámetro de evento **no se puede consultar** por la Data
   API hasta que está registrado como dimensión personalizada, y **el registro no
   es retroactivo**: los datos empiezan a acumularse desde que se registra. O sea
   que **registrarlo hoy es lo único que hace posible verlo el mes que viene** —
   y por eso conviene hacerlo aunque el resto quede para después.
2. **Sumar la dimensión a `DIMENSIONES_PERMITIDAS`** (`functions/analitica.js`), y
   eso es **una decisión de privacidad, no un cambio mecánico**: esa lista blanca
   existe con su docblock escrito para que no entren `pageLocation` —que llevaría
   `?q=<lo que alguien tipeó>`— ni `city`, `region`, `userAgeBracket` o
   `userGender`. `customEvent:eje` y `customEvent:slug` son agregados sin persona
   y el slug ya es público, así que el caso es defendible; lo que no se puede es
   agregarlo sin pasar por ahí. `tests/analitica-del-sitio.test.ts` compara el
   conjunto exacto de dimensiones contra esa lista, así que el test lo va a pedir.
3. **El desglose en el panel**: la fila pasa a poder expandirse y mostrar los
   ejes con más ceros. Es lo más chico de los tres.

**Y lo que se gana es concreto**, que es el motivo por el que el ítem no es P3: la
pregunta que contesta es «qué etiqueta conviene cargar o retirar». Un `barrio` que
se filtra seguido y nunca tiene nada es una actividad que falta o una etiqueta que
sobra, y hoy eso no se puede saber.

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
| **B-771** | **Revisar `/anunciar` cuando haya datos de audiencia.** Hoy la página dice que no los tenemos, que es lo correcto: la medición arrancó el 2026-09-03. Con un mes de historia (**B-374**) se puede agregar un número real, y ahí hay que revisar el chequeo de `tests/comercial-del-sitio.test.ts` que hoy prohíbe las cifras de audiencia — con los números en la mano, no sacándolo porque molesta | 🟡 depende de B-374 |
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
| **B-370** | El ítem paraguas y el documento de arquitectura | 🟡 el tablero (con pestañas, B-500/B-501), el banner, el tag, los eventos y B-480 están; **falta B-373 y B-374** |
| **B-371** | **Decisión del dueño:** aceptar el costo de JavaScript en la página de detalle, que hoy tiene cero | ✅ resuelto — **aceptado** (D-251), con el número medido en el §6bis del documento |
| **B-372** | Instalar el tag de GA4 en las páginas públicas — la mitad vendible entera | ✅ hecho (2026-09-03) — código, enganche en `Base.astro` y **B-480 resuelto** en la consola. En el camino se encontró y corrigió un `preconnect` a `googletagmanager.com` sin condicionar al consentimiento (D-254), con un test que lee el `dist/` y frena cualquier tercero previo al consentimiento; B-481 anota lo que ese hallazgo dejó pendiente |
| **B-373** | Search Console: conectar el dominio y leerlo | 🟡 **conectado el 2026-09-03 por el dueño** — el histórico ya empezó a acumular, que era la parte sensible al calendario. **Queda la lectura al panel**: traer sus datos (qué búsquedas traen gente, qué páginas rankean) a una vista del tablero. Es código y depende de datos acumulados, igual que B-374, así que va con esa tanda. Conviene además cargar el `sitemap.xml` (ya existe, B-109) en Search Console para que Google descubra las páginas más rápido |
| **B-374** | La Function que lee la Data API de GA4 para el resumen del panel | ⛔ depende de un mes de datos (B-372 y B-480 ya están) |
| **B-375** | Los eventos propios: el clic en inscripción y el filtro que deja cero | ✅ construidos (`clic_inscripcion`, `filtro_sin_resultados`) y **ya miden**, con B-372/B-480 cerrados |
| **B-376** | **Decisión del dueño:** el aviso de privacidad y el consentimiento, entre las tres opciones del §7 | ✅ resuelto — **C3** (D-250), banner construido en `src/components/sitio/AvisoDeCookies.astro` |
| **B-377** | El inventario publicitario: una salida pública nueva. Anotado, no resuelto | 🔵 futuro |
| **B-378** | El tablero del catálogo es una foto y no una serie | 🔵 futuro |
| **B-379** | El tablero agrupa en el navegador; con miles de actividades conviene un agregado | 🔵 futuro |
| **B-480** | — ✅ hecho (2026-09-03). El dueño apagó en la consola de GA4 (flujo `G-9CFMHSSGRC`, Enhanced Measurement) **«Búsquedas en el sitio»** y **«Clics salientes»**, y —al configurarlo— dos cosas más que aparecieron: **desactivó los `page_view` basados en el historial de navegación** (el buscador reescribe la URL con `replaceState` en cada filtro, así que sin esto cada toque contaba una vista con el texto de `q` en la URL), y en **Ocultar datos** activó el borrado de la clave de consulta **`q`** —el parámetro donde viaja el texto del buscador—, que es la red durable: GA4 lo borra al recibirlo pase por donde pase. Con esto B-372 queda cerrado. | ✅ hecho (2026-09-03) |
| **B-481** | **Las tipografías (`fonts.googleapis.com`/`fonts.gstatic.com`) son, hoy, una conexión a un tercero en el load** — el mismo `preconnect` que D-254 sacó para GA4, pero decidido antes de que hubiera un banner y sin la lupa del consentimiento encima. Autoalojarlas (servir los `.woff2` desde el propio dominio) la eliminaría del todo. No es privacidad en el mismo sentido que B-480 —una tipografía no manda datos de la persona—, es la misma clase de dato de red (que este navegador entró al sitio) que ya se decidió aceptar para las fuentes, y conviene tenerlo escrito ahora que el tema está sobre la mesa | ✅ **hecho (2026-09-03)** — autoalojadas en `public/fuentes/`, servidas con `@font-face` desde `src/styles/global.css` y precargadas en `Base.astro`. **Cero terceros en el load** y un pedido menos; el `preconnect` a `fonts.googleapis.com` ya no está. La decisión es **D-340**. Lo encontró `npm run backlog:contradicciones` (B-1170, B-1220): el documento lo decía bien y este registro no |
| **B-500** | El aviso «ya-paso»: el dueño no entendía por qué el tablero marcaba como problema algo que es el archivo funcionando bien | ✅ hecho (2026-09-03) — primero reencuadrado (D-270), después **sacado del todo** (D-273): el dueño señaló que la lista crece sin techo y no pide ninguna acción para casi nada. Queda la cobertura acotada «cuántas tienen fecha futura», no la lista |
| **B-501** | El tablero pasa a pestañas internas — «El catálogo» y «El sitio público» — para que entre sin scroll infinito | ✅ hecho (2026-09-03) — `EstadisticasPanel.tsx`, D-271 |
| **B-502** | La pestaña «El sitio público»: el andamiaje honesto de lo que B-374 va a mostrar, sin un solo número inventado | ✅ hecho (2026-09-03) — estado vacío deliberado, con la fecha de arranque de la medición (3 de septiembre de 2026) y qué falta para que deje de estar vacío. D-272 |

## P3 — cuando sobre tiempo

### B-2041 · Un barrido de `clases/b-88` se pasa de los 5 s con la suite en paralelo · P4 — del cierre de la tanda del 2026-09-25

`tests/clases/b-88-consumidor-y-productor.test.ts` › «B-190 — el slug «a confirmar» no
se copia a mano» dio `5034ms` en `--project unidad`; solo tarda 2,3 s. No mide tiempo:
es un barrido del repo que con carga se acerca al límite. En manos del frente `tiempos`.

### B-2060 · `costo-por-tecla` › «el costo no escala con la cantidad de encuentros» falló una vez en paralelo · P4 — del frente `que-deployar` (2026-09-25)

Pasó 3/3 solo. Es un test de tiempos (B-198) y parece inestable con la carga del
paralelo de M-1. En manos del frente `tiempos`.

### B-2050 · Los otros derivados de `modalidades` no se verifican en el servidor · P3 — de B-1920 (2026-09-25)

`dentroDeSuCiudad()` mira `ciudades` y **la primera `sede`**, y B-1920 verifica solo
`ciudades`. Un documento armado a mano puede traer una `sede` que no es la de la primera
fila con sede; lo mismo vale para `modalidad`, `online` y `searchText`. `sede` además
sale al sitio, al `location` de Calendar y a la búsqueda. No es una fuga: es contenido
propio. Arreglo: un `derivadosDesalineados` que compare los cuatro con `sedePrincipal`,
`onlinePrincipal` y `modalidadResultante` (hoy en `src/lib/actividades.ts`, a mudar a
`functions/` como `ciudadesDe`). Corregir `sede` cambia salidas públicas y pide rebuild.

### B-2051 · El script de claims no tiene cómo leer el claim de una cuenta · P3 — de B-1920 (2026-09-25)

El runbook de `ciudades-no-coinciden` pide comparar la ciudad de la cuenta con
`derivadas`. La consola de Firebase no muestra custom claims, y `set-admin-claim.mjs`
solo escribe. Un `--ver <email>` que imprima rol y ciudad (solo lectura) cierra el paso 3
del runbook.

### B-2052 · Una fila con sede y la ciudad vacía no se detecta · P3 — del `auditor-privacidad` sobre B-1920 (2026-09-25)

Primera fila en la ciudad de la cuenta, segunda con una dirección de otra ciudad y
`ciudad: ''`: `ciudadesDe` da la misma lista, la regla pasa y B-1920 no avisa. Se
decidió no avisar siempre (D-1234) porque un admin puede cargar una sede sin ciudad
legítimamente. Si hace falta: avisar solo cuando `updatedBy` sea un publicador, lo que
exige leer su claim desde la Function.

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

### B-920 · ¿Qué debería ver el publicador de una actividad ajena de su ciudad? · P2

**Lo marcó el `auditor-privacidad` sobre B-919 y la decisión es del dueño.** Una
regla de Firestore es **todo-o-nada por documento**: el alcance por ciudad no
autoriza «la vista pública de las actividades de mi ciudad», autoriza **el
documento crudo**. O sea que de una actividad ajena de su ciudad, esa cuenta lee
también `online.url` con `urlPublica: false`, `difusion`, `inscripcion.destino`,
la URL del material privado, los uids y `imagenes[].storagePath`. Y **sin cláusula
de `estado`**, así que alcanza a los **borradores** ajenos, de los que no salió
nunca nada a ninguna parte.

**Se aceptó, con tres motivos**: el claim lo entrega el dueño de a una cuenta por
vez con un script; el alcance es estrictamente menor que el del `admin`, que ya lee
todo; y recortar por campo **no es expresable en una regla** (la alternativa es una
Function que proyecte en el camino de lectura del panel, que es lo que D-660
descartó). El panel además no se lo pone adelante: la ficha en solo lectura no
muestra «Difusión».

**Vuelve cuando entre la segunda publicadora**, que el propio pedido anticipa
(«puede ser que no sea la única»): ahí deja de ser una cuenta mirando y pasa a ser
N cuentas cruzadas.

La ruta de recorte ya está escrita y medida a medias: sumarle
`resource.data.get('estado','') == 'publicado'` al disyunto de la ciudad, más el
`where('estado','==','publicado')` correspondiente en la segunda query de
`listarActividades` — y **medirlo contra el emulador, no suponerlo** (trampa 7). El
testigo que hay que dar vuelta ya existe y **enumera lo que lee**: `it('lee un
BORRADOR ajeno de su ciudad, con su link de reunión y sus notas internas adentro')`
en `tests/rol-publicador.integracion.test.ts`.

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

### B-734 · Con más de una fila de modalidad, el `location` de cada `subEvent` afirma más de lo que sabe — 🟡 hecho a medias (2026-09-09) · P3

> ✅ **Hecho con la primera de las dos salidas: el `subEvent` deja de heredar
> `location` cuando hay más de una fila.** La raíz lo sigue publicando —el conjunto
> de lugares es de la actividad y es cierto—, así que el item vuelve al estado
> incompleto que B-730 arregló, que es el que «Google tolera heredando del padre»,
> y no a un encuentro sin lugar en ninguna parte.
>
> **La segunda salida no se puede hacer desde la página, y ése es el hallazgo.**
> Repartir los lugares de verdad necesita `modalidades[].inicio`/`fin` en el
> view-model, y hoy esos dos campos son una fila explícita del «Qué NUNCA sale»
> (B-224, **D-130**). Aunque se usaran solo dentro del build para casar fila con
> encuentro, subirlos a `ModalidadPublica` es una decisión de `toPublic` y no de
> esta salida. Es lo que hay que decidir el día que aparezca la primera actividad
> con dos filas.
>
> **Un detalle que el ítem no decía y que ahora tiene test: la cuenta es de filas,
> no de lugares.** Una fila **híbrida** produce un `Place` y un `VirtualLocation`,
> y de esa fecha las dos cosas son ciertas a la vez, así que conserva su
> `location`. Escribir la guarda sobre la cantidad de lugares —que es lo que uno
> escribe leyendo «con más de un lugar no se sabe»— rompe el ciclo híbrido, que sí
> es un caso real de hoy.
>
> **`eventAttendanceMode` no se tocó, y está argumentado en el código:** con filas
> mixtas dice «esto se cursa de las dos formas», que es una propiedad de la
> actividad; `location` nombra lugares concretos, que es la afirmación fina. Si el
> reparto de verdad llega, los dos se resuelven juntos.

**Lo derivó el `auditor-privacidad` auditando B-730, y lo clasificó como
honestidad de datos y no como privacidad — con razón: no hay fuga.**

Con `modalidades.length > 1` (B-224, «presencial los martes y por Meet los
jueves») la serie decía «esto ocurre en estos lugares» y cada `subEvent` pasa a
decir «*esta fecha* ocurre en todos ellos». `modalidadDeDetalle` no lleva el
`inicio`/`fin` de la fila al view-model, así que el JSON-LD **no puede** saber
qué encuentro va con qué lugar.

No dice más que la página, que tampoco los reparte, y el conjunto de lugares ya
era público y es el mismo. Pero es una afirmación más fina que el dato que la
respalda, o sea que roza la regla 6 del §5.3.

**Hoy es hipotético y por eso es P3:** de las 68 actividades publicadas,
**ninguna** tiene más de una fila (verificado sobre el `events.json` real). El
caveat quedó escrito en la regla 7 del §5.3 y en el docblock de
`datosEstructurados`, que es lo que hace que no se pierda.

**Las dos salidas, si el caso aparece:** omitir `location` en el `subEvent`
cuando hay más de una fila —vuelve a dejarlo incompleto, que es lo que B-730
arregló—, o llevar las fechas de la fila al view-model y repartir los lugares de
verdad. La segunda es la buena y es más grande que este ítem.

---

## Agentes y automatización del flujo (B-115 a B-124)

Lo que quedó pendiente al definir los agentes y skills de `.claude/`. El qué hay
y por qué está en [`13-agentes.md`](13-agentes.md). La prioridad va en cada ítem.
