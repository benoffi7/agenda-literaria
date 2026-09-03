# Analítica del sitio público — arquitectura

| | |
|---|---|
| Qué es esto | Un documento de arquitectura que ya se implementó en la mayor parte. Sigue empezando por las preguntas y no por los eventos porque esa disciplina es la que evitó medir lo fácil en vez de lo que importa |
| Alcance | el **sitio público** (`agendaleh.ar`). La analítica del **panel** ya existe y está en [`09-analitica.md`](09-analitica.md) |
| Para qué se mide | **dos cosas distintas, con requisitos distintos** ([§2](#2--dos-mitades-y-no-una)): números para **vender publicidad**, y números para **mejorar el sitio** |
| Decidido | **GA4 va en el sitio público** (D-201). El dueño contestó las tres preguntas que faltaban: **B-376 → C3**, un banner con aceptar/rechazar (D-250); **B-371 → aceptado**, el costo de JavaScript de la página de detalle con el número del §6 a la vista (D-251); **B-373 → diferido a propósito**, ver [§11](#11--el-orden-en-que-conviene-hacerlo) |
| Construido | el tablero de [§8](#8--el-primer-tramo-el-que-se-implementó), con pestañas («El catálogo» / «El sitio público», B-501/B-502) — **y** el banner + el tag + los dos eventos propios de [§7](#7--el-consentimiento-implementado-b-376) — [§6bis](#6bis--lo-que-se-agregó-de-verdad-medido) tiene los bytes reales |
| **Lo que falta antes de que mida en producción** | Nada de configuración: **B-480 resuelto el 2026-09-03** (ver [§7.4](#74--lo-que-el-código-no-puede-tapar-b-480)). Falta solo el deploy del código, que sale con el próximo push |
| La regla que sigue rigiendo | a GA4 **no sale contenido del panel, nunca** ([`07-seguridad.md`](07-seguridad.md#analítica-del-panel), salida 4). La salida nueva —el sitio público, salida 12— tiene su propio alcance, escrito en [§5](#5--la-regla-de-que-no-sale-contenido-y-qué-le-hace-el-sitio-público) |

---

## 1 · El hecho que reordena el pedido

El pedido fue «una opción en el panel para ver estadísticas del sitio, con los
eventos más vistos, secciones, pulsaciones y fricciones a detectar». Suena a
tablero, o sea a la mitad de atrás de la cadena. La mitad de adelante no existe:

> **El sitio público no mide nada.** Cero eventos, cero cookies, cero
> JavaScript de telemetría. Hoy no hay datos que mostrar.

Verificado el 2026-09-02, en producción y en el árbol de trabajo:

| Qué se miró | Cómo | Resultado |
|---|---|---|
| El HTML de una página de detalle real | `curl https://agendaleh.ar/actividad/taller-de-cuento-luciano-lamberti/` | **un** `<script>`, y es `type="application/ld+json"` — el JSON-LD del §5 del diseño. Es **datos, no código**: el navegador no lo ejecuta. **18.341 bytes de HTML, cero bytes de JavaScript** |
| Cookies de esa misma respuesta | cabeceras de la misma petición | **ningún `Set-Cookie`** |
| La home | ídem | dos `<script>` inline, y son el runtime de hidratación de la island `Buscador` (`client:load`), la única del sitio público |
| `/cartelera`, `/ayuda`, `/pasadas` | build local | **cero** `<script>` |
| Cualquier rastro de un medidor | `grep` de `gtag`, `googletagmanager`, `google-analytics`, `analytics`, `measurement` sobre `src/layouts/`, `src/pages/`, `src/components/publico/` y `src/components/sitio/` | **cero coincidencias** |
| El único `import` de `firebase/analytics` del repo | `src/lib/analytics.ts` | es **dinámico** y vive del lado del panel; `analiticaHabilitada()` exige `PUBLIC_FIREBASE_MEASUREMENT_ID`, y quien lo lee es `/admin` |

**Una corrección al encargo, para que quede escrita:** la página de detalle no
tiene «tres `<script>`, el JSON-LD y el runtime de la island». Tiene **uno**, el
JSON-LD, y **no tiene island** — el `grep` de directivas `client:` del proyecto
devuelve exactamente dos usos, `admin.astro` e `index.astro`. Importa porque
cambia el tamaño de la decisión de [§6](#6--el-costo-en-la-página-de-detalle-medido):
no es «agregar un poco más de JS a una página que ya trae algo», es **estrenar**
JavaScript en la página que recibe el tráfico.

De ahí la forma de este trabajo: primero la arquitectura escrita, y como único
tramo construido el que se puede usar esta semana sin pedirle permiso a nadie —
porque **un tablero de GA4 el día uno muestra cero**, y hay que dejarlo juntar
historia.

---

## 2 · Dos mitades, y no una

El propósito lo puso el dueño: *«tener números para ofrecer publicidad más
tarde. Además de mejora continua en el sitio y tener visibilidad de lo que se
usa, cómo, lo que falla y margen de mejora.»*

Son **dos productos distintos** que salen de la misma instalación, y confundirlos
es la forma más rápida de construir mal:

| | **a · Los números para vender** | **b · Los números para mejorar** |
|---|---|---|
| Quién los lee | un anunciante, en un mail | el dueño, decidiendo qué tocar |
| Qué necesita | **credibilidad**, no riqueza | **precisión sobre un punto concreto** |
| Cuáles son | sesiones, usuarios, vistas de página, páginas más vistas, geografía, dispositivo, sistema operativo | fricciones: filtros que no encuentran nada, quién llega a escribirle al organizador, dónde se abandona |
| De dónde salen | **GA4 los da solos**, sin un solo evento personalizado | **eventos propios**, diseñados uno por uno |
| Cuánto trabajo es | instalar el tag | el diseño de una taxonomía, como la del panel |
| Cuándo sirven | cuando haya historia: un mes mínimo | desde el primer dato con volumen |
| La regla de contenido | **no la necesita**: un anunciante quiere cuántas visitas hubo, no qué actividad se miró | **rige entera** ([§5](#5--la-regla-de-que-no-sale-contenido-y-qué-le-hace-el-sitio-público)) |

**La consecuencia práctica más importante:** la mitad **a** —la que motiva el
pedido— **no requiere diseñar nada**. Se instala el tag y a los treinta días hay
un número que se puede poner en un mail. Todo el trabajo de diseño de este
documento es para la mitad **b**.

**Y la segunda consecuencia, que es la que ahorra plata:** la mitad **a** se
puede leer en GA4, gratis, sin construir un tablero. Lo que el panel tiene que
mostrar de la mitad **a** es el resumen que uno pega en un mail —cuatro números y
su período—, no una réplica peor de GA4 ([§9.3](#93-qué-muestra-el-panel-de-la-mitad-vendible-y-con-qué-período)).

---

## 3 · Las preguntas primero, y no los eventos

Un tablero armado desde los eventos disponibles termina mostrando lo que es
fácil de medir. Así que la lista empieza por las preguntas, **en el idioma del
dueño**, y cada una dice a qué mitad pertenece y quién la contesta.

| # | La pregunta | Mitad | Qué se hace con la respuesta | Quién la contesta | ¿Hoy? |
|---|---|---|---|---|---|
| 1 | **¿Cuánta gente entra?** | a | **el número que se vende.** «El sitio tiene X visitas al mes» | GA4, solo | 🟡 al instalar el tag → **B-372** |
| 2 | **¿Qué páginas se miran más?** | a | qué se destaca, y qué se le ofrece a un anunciante como lugar caro | GA4, solo — pero ver [§5](#5--la-regla-de-que-no-sale-contenido-y-qué-le-hace-el-sitio-público) | 🟡 B-372 |
| 3 | **¿De dónde es la gente, con qué aparato y qué sistema entra?** | a | lo que un anunciante pregunta segundo, después del volumen | GA4, solo | 🟡 B-372 |
| 4 | **¿Por dónde entra la gente?** (buscador, Instagram, un link pegado, directo) | a y b | dónde publicar; y qué canal se le puede prometer a un anunciante | GA4, solo | 🟡 B-372 |
| 5 | **¿Cuántos llegan a escribirle al organizador?** | b | **el único número que dice si el sitio sirve.** Sin esto, «el sitio anda» significa «carga rápido» | un **evento propio** | ❌ → **B-375** |
| 6 | **¿Qué filtro usa la gente, y cuál deja cero resultados?** | b | qué ejes quedan y cuáles se retiran; qué taxonomías del §4 vale la pena curar | un **evento propio**, en la island de filtros que **ya corre en el navegador** | ❌ → **B-375** |
| 7 | **¿Google nos está encontrando?** ¿con qué búsquedas? | a y b | si el trabajo de SEO de B-109 rindió. Es la razón de ser del sitio (§2.3 del `CLAUDE.md`) | **Search Console**, que no es GA4 | 🟡 **no necesita ni JS ni cookies**, solo conectar el dominio → **B-373** |
| 8 | **¿Qué se está ofreciendo hoy, y en qué estado está?** | b | el trabajo del día: qué falta publicar, qué quedó a medias | el propio catálogo | ✅ **implementado** |
| 9 | **¿Hay algo publicado que no se pueda usar?** | b | lo que hace que alguien escriba y no le contesten | el catálogo + el reloj | ✅ **implementado** |
| 10 | **¿Lo que publicamos está completo?** (imagen, etiquetas, descripción) | b | lo que decide si una actividad aparece en la cartelera, en los filtros y con imagen en un link compartido | el catálogo | ✅ **implementado** |

### 3.1 · Lo que esta lista deja afuera a propósito

- **«Secciones» y «pulsaciones»**, tal cual estaban en el pedido. Son categorías
  de herramienta, no preguntas: «pulsaciones» sin decir de qué es un número que
  nadie va a mirar dos veces. Se convirtieron en la 5 y la 6, que sí tienen una
  decisión atada.
- **Mapas de calor y grabación de sesión.** Son la forma más invasiva de medir
  —reconstruyen lo que una persona hizo en la pantalla—, no las da GA4, y con
  este volumen no dirían nada. No entran.
- **Tiempo en página y scroll.** GA4 los trae en parte solos (`engagement_time`),
  así que si vienen, vienen; pero no se diseña nada alrededor. Nadie va a cambiar
  una actividad porque el scroll promedio fue del 60 %.

---

## 4 · Las «fricciones a detectar», traducidas

La parte más interesante del pedido y la más vaga, y toda de la mitad **b**.
Traducida, una fricción es **una situación concreta, detectable, en la que el
sitio le hace perder algo a alguien**. Lista corta y defendible; no un catálogo.

| # | La fricción | Cómo se detecta | Qué se hace con eso | ¿Hoy? |
|---|---|---|---|---|
| 1 | **Una actividad publicada a la que ya no se puede entrar** — la inscripción cerró y todavía tiene encuentros por venir | catálogo + reloj | cambiar el estado, correr la fecha de cierre, o avisarlo en la descripción | ✅ |
| 2 | ~~Una actividad que ya pasó y sigue en `publicado`~~ — **descartada como aviso, D-273**: no es una fricción (es el archivo funcionando, §2.1, `/pasadas`), la lista crecería sin techo y para casi nada hay acción. Lo cubre la cobertura acotada «cuántas tienen fecha futura», no un aviso | catálogo + reloj | nada como aviso; la excepción (un ciclo que vuelve) no se puede aislar hoy | ❌ sacada |
| 3 | **Una actividad publicada sin imagen** | catálogo | conseguir el flyer: sin él no entra a la cartelera y el link compartido va con la marca genérica. Al 2026-09-01 eran **2 de 42** | ✅ |
| 4 | **Una actividad publicada sin etiquetas** | catálogo | ponerle etiquetas: sin ellas existe en el sitio pero no se encuentra filtrando | ✅ |
| 5 | **Una actividad publicada con descripción demasiado corta** | catálogo | escribir dos frases más: la `meta description` sale de ahí, y es la que decide el clic | ✅ |
| 6 | **Algo que quedó a medio publicar** — en `borrador` o `pendiente` sin tocarse hace más de 30 días | catálogo + reloj | publicarlo o descartarlo. Es trabajo hecho que no rinde | ✅ |
| 7 | **Un filtro que se aplica y deja cero resultados** | un evento propio en la island de filtros, con la combinación que quedó vacía | retirar el eje, o cargar lo que falta. Un eje que da cero seguido es un eje que estorba | ❌ **B-375** |
| 8 | **Una actividad que se abre mucho y no genera ni un mensaje** | vistas de página (GA4) + clic en el botón de inscripción (evento propio) | revisar la descripción, el precio o la forma de anotarse de **esa** actividad | ❌ **B-375** |

### 4.1 · Las dos que hay que leer con cuidado

**La 8 no es una fricción por sí sola.** «Alguien abre una actividad y se va sin
escribir» es lo que hace la mayoría de la gente en cualquier sitio, y en uno de
agenda cultural mirar qué hay es un uso legítimo y completo. El número suelto no
dice nada. Lo que dice algo es la **comparación entre actividades**: si nueve
talleres convierten parecido y uno no, la explicación está en ese uno. Un tablero
que muestre la tasa suelta va a provocar decisiones equivocadas, así que si esto
se construye, se construye como comparación o no se construye.

**La 7 tiene una mitad que no necesita medir a nadie.** «Qué combinación de
filtros deja cero» es en parte derivable del catálogo: los ejes se arman de las
opciones presentes en los datos y ya existe el criterio de no ofrecer un valor
que ninguna actividad usa (`opcionesPresentes`, con su motivo escrito: «ofrecer
un barrio que ninguna actividad usa es ofrecer un filtro que siempre devuelve
cero»). Lo que **no** se deriva es qué combinación **eligió una persona**, que es
la mitad valiosa: un cruce vacío que nadie intentó no es un problema.

### 4.2 · El límite que ninguna de las ocho esquiva

**Con el tráfico que este sitio tiene, la mayoría de las métricas de fricción no
va a alcanzar significancia por un buen rato.** Es el mismo aviso que
[`09-analitica.md`](09-analitica.md) ya se hace sobre el panel —«un ranking con
40 eventos ya dice algo; una tasa de abandono con 6 no»—, y acá pesa más: son 46
actividades y el dominio se conectó hace días.

Eso no es un argumento contra medir, y menos ahora que la mitad **a** tiene un
propósito comercial: **el volumen es justamente lo que hay que juntar**, y para
eso el tag tiene que estar puesto cuanto antes, porque GA4 **no mide
retroactivamente**. Es un argumento sobre el **orden**: el tag primero para que
junte historia, el tablero de fricciones después, y mientras tanto lo que se mira
es el catálogo.

---

## 5 · La regla de que no sale contenido, y qué le hace el sitio público

Este es el punto más delicado del documento, y no se resuelve suponiendo.

### 5.1 · El `page_view` automático manda la URL, y la URL lleva el título

La forma corriente de instalar GA4 es pegar el snippet de `gtag.js`. Ese snippet
manda, **solo y sin que nadie escriba un `medir()`**, un `page_view` con
`page_location`: la URL completa. En este sitio, la URL de la página que interesa
es `https://agendaleh.ar/actividad/taller-de-cuento-luciano-lamberti/`, y ese
slug **se deriva del título de la actividad**.

O sea: **instalar GA4 en el sitio manda a un tercero el título de cada actividad
visitada, derivado, por diseño de la herramienta.** Y la garantía que hace segura
la analítica del panel —«un `medir()` mal escrito produce un payload vacío, no
una fuga»— **no cubre este caso**, porque el evento no pasa por
`construirEvento`: lo arma la librería del tercero antes de que nuestro código
exista.

### 5.2 · Por qué eso igual está bien, dicho con precisión

La regla del §5 protege lo que **no está publicado**: los borradores, el link de
la reunión, `difusion`, los uids, el `storagePath`. La analítica del panel es
estrictísima porque su fuente es **el formulario**, que contiene todo eso.

En el sitio público la fuente es distinta: **es HTML ya publicado e indexado.**
El slug de una actividad publicada ya está en el `sitemap.xml` que le ofrecemos a
Google (salida 9), en el índice de Google, en la barra del navegador y en el link
que alguien pega en Instagram. Mandarlo a GA4 no publica nada que el sitio no
publique ya.

**Así que la regla no se rompe: se le pone alcance.** Y el alcance hay que
escribirlo, porque «no sale contenido nunca, ni con permiso del dueño» tal cual
está redactado hoy en [`07-seguridad.md`](07-seguridad.md#analítica-del-panel)
no distingue las dos fuentes:

| | Regla |
|---|---|
| **Salida 4 · la analítica del panel** | **sin cambios.** No sale contenido, nunca. Su fuente es el formulario y el formulario tiene lo no publicado |
| **Salida nueva · la analítica del sitio público** | sale **lo que la página ya publica**: su ruta y su título de `<head>`. **Nada más, y nada de un documento que no esté publicado** |

### 5.3 · El invariante nuevo que esto crea, y que hay que testear

Y acá está lo que de verdad hay que cuidar de acá en adelante:

> **Con GA4 instalado, la URL y el `<title>` de cada página pasan a ser
> telemetría automática.** Lo que hoy es «un dato que se ve en la barra del
> navegador» mañana es «un dato que se manda a un tercero, sin que nadie lo
> escriba».

Las tres consecuencias, en orden de probabilidad:

1. **Ninguna página del sitio puede llevar datos privados en su URL.** Hoy no
   los lleva: las rutas son `/`, `/cartelera`, `/agenda/{aaaa-mm}`,
   `/actividad/{slug}`, `/pasadas`, `/ayuda`, `/contacto`, `/suscribirse` y
   `/admin`. Y `/admin` es la que hay que mirar: es `noIndex`, pero **el tag no
   se instala ahí** —el panel ya tiene su propia propiedad y su propia
   proyección—, y hay que dejarlo escrito para que nadie lo agregue «para tener
   todo junto».
2. **Ningún parámetro de query puede llevar contenido.** La island de filtros
   escribe la selección en la query (`aQuery` / `desdeQuery` en
   `listadoPublico.ts`) — hoy son slugs de taxonomía y el texto de búsqueda. **El
   texto de búsqueda es lo que una persona tipeó**, así que si algún día viaja en
   la URL y GA4 está instalado, lo que se escribió en el buscador de un sitio de
   actividades literarias se convierte en telemetría. Hay que verificar qué
   escribe hoy `aQuery` y, si escribe el texto, **excluirlo del `page_location`
   que se manda** o sacarlo de la query.
3. **El `<title>` viaja igual que la URL** (`page_title`), y lo arma
   `Base.astro`. Es el mismo dato que la salida 6 ya publica, así que no agrega
   nada — pero cuando aparezca una página nueva, el `<head>` es parte de lo que
   se le manda a Google Analytics y no solo de lo que se le muestra a la gente.

Eso es un chequeo, no un párrafo: forma parte de **B-372**, y se verifica del
mismo modo que el resto de las salidas — con un barrido de centinelas sobre lo
que se manda, no confiando en la intención del código.

### 5.4 · Lo que la mitad **b** no puede hacer

Los **eventos propios** de la mitad **b** (B-375) van con la regla completa del
panel: **vocabulario cerrado, sin sanitizador de texto libre.** Concretamente:

- el clic en el botón de inscripción manda **la vía** (`mail`, `whatsapp`, `dm`,
  `formulario`) y **no el destino**: el destino es un mail o un teléfono;
- el filtro que dejó cero manda **el eje y el slug** (`tipo=taller`,
  `barrio=villa-crespo`), que son vocabulario cerrado del §4, y **nunca el texto
  del buscador**;
- nada manda un id de actividad **además** de la ruta que el `page_view` ya lleva:
  duplicarlo no agrega una respuesta y agrega una superficie.

Y hay una consecuencia de diseño que conviene tener escrita: **la proyección que
hace segura la analítica del panel no se hereda.** `analytics-eventos.ts` vive del
lado del panel y el sitio público no lo importa. Si se mide el sitio, esa
proyección hay que construirla de nuevo del lado público, con sus propios tests
de centinelas. Es trabajo, y es el trabajo que hace que la mitad **b** sea segura.

---

## 6 · El costo en la página de detalle, medido

Es la página que recibe el tráfico —la que Google indexa y la que se pega en
Instagram— y hoy son **18.341 bytes de HTML y cero bytes de JavaScript**,
verificado en producción. Eso no es un accidente: es `toPublic` →
`detalleDeActividad` → una plantilla que solo acomoda (**D-140**), y está
declarado como virtud.

### 6.1 · Los números, no una estimación

Medido el 2026-09-02 contra el tag de la propiedad real:

```bash
curl -H 'Accept-Encoding: gzip' 'https://www.googletagmanager.com/gtag/js?id=G-9CFMHSSGRC'
```

| Qué | Cuánto |
|---|---|
| `gtag.js`, **transferido** (gzip) | **155.578 bytes** |
| `gtag.js`, descomprimido (lo que el navegador parsea y ejecuta) | **444.757 bytes** |
| El HTML entero de la página de detalle hoy | 18.341 bytes |
| **La proporción** | el tag es **8,5 veces la página** en bytes transferidos, y **24 veces** en bytes a parsear |
| Su `cache-control` | `private, max-age=900` — **15 minutos** |
| Hosts nuevos que aparecen | `www.googletagmanager.com` (el script) y `*.google-analytics.com` (el beacon `/g/collect`) |
| Cookies que pone | `_ga` y `_ga_<contenedor>`, **de primera parte** (las pone el script, no Google desde otro dominio) |

**El `max-age=900` es el dato que más cambia la cuenta y el que nadie mira:** el
tag **no se amortiza**. Alguien que vuelve mañana lo baja de nuevo. Con una
cache de un año, 152 KB serían un costo de la primera visita; con quince
minutos, son el costo de **casi cada** visita.

### 6.2 · Cómo se paga menos, y qué cuesta cada forma

| | Forma | Qué ahorra | Qué cuesta |
|---|---|---|---|
| **1** | **El snippet estándar `async`** (lo que recomienda Google) | nada de bytes; sí evita bloquear el render | es la línea base. **Los números salen enteros y creíbles**, que es el requisito de la mitad **a** |
| **2** | **Cargarlo diferido**, con `requestIdleCallback`, como el panel hace con `firebase/analytics` (**D-58**) | los bytes se piden después del primer render: la página se ve igual de rápido | **rompe justo la métrica que se vende.** Quien entra y se va en dos segundos no queda contado, y esa gente existe. Se undercuenta el número que va al mail del anunciante, y no se sabe cuánto |
| **3** | **Solo `page_view`, sin la librería entera** | no existe: `gtag.js` es un bundle, no un menú. Se puede apagar el `page_view` automático, pero eso no baja un byte | — |
| **4** | **El Measurement Protocol**, mandando los hits desde el servidor | cero JavaScript en la página | **no aplica a un sitio estático.** No hay servidor: habría que poner una Function y un beacon del lado del cliente para llamarla, o sea JavaScript igual. Y sin un `client_id` real, GA4 degrada usuarios y sesiones — que son **los dos números que se venden** |
| **5** | **Google Tag Manager en vez de `gtag.js`** | nada. Agrega una capa de ~100 KB más para no hacer nada que no hagamos con el tag directo | **es el error caro y es el más fácil de cometer**, porque «GTM» suena a lo profesional. No entra |
| **6** | **El tag solo en la home, no en el detalle** | el detalle sigue sin JS | mata la pregunta 2 —qué páginas se miran—, que es una de las que se venden |

### 6.3 · La recomendación, con el número

**Aceptar el costo: el snippet estándar `async`, en todas las páginas públicas
—el detalle incluido— y no en `/admin`.**

Son 152 KB transferidos en una página de 18 KB, y no hay forma de bajarlos sin
dañar exactamente el número que motiva el pedido. Las formas 2 y 6 ahorran bytes
pagando con credibilidad, y la credibilidad es el requisito de la mitad **a**:
un número que subestima no se puede defender frente a un anunciante, y peor,
**no se sabe por cuánto** subestima.

Lo que sí se puede hacer sin pagar nada:

- **`gtag.js` directo, nunca GTM** (forma 5): ahorra ~100 KB por no perder nada.
- **No instalarlo en `/admin`.** El panel ya mide, con su propia proyección, y
  ahí el `page_view` automático **sí** sería una fuga de las de verdad.
- **`async` de verdad**, sin `defer` y sin ponerlo antes del contenido: no cambia
  los bytes pero saca el tag del camino del primer render.
- ~~**Un `preconnect` a `www.googletagmanager.com`** en el `<head>`: no ahorra
  bytes, ahorra el ida y vuelta de DNS + TLS en el celular en la calle, que es
  donde se nota.~~ **Retractado — D-254.** Este documento lo recomendaba antes
  de construirse, y era un error: en un sitio estático el `<head>` es el mismo
  para todo el mundo, así que un `preconnect` acá no se puede condicionar al
  consentimiento — y un `preconnect` sin condicionar abre TCP y completa el
  handshake TLS con Google **para quien todavía no decidió, y también para
  quien rechaza**. Se implementó, el coordinador lo encontró antes de
  pushear, y se sacó. Ver [§7.4bis](#74bis--el-preconnect-que-se-sacó-d-254).
- **Volver a medir después de instalarlo**, y anotar el número. Si el tag pasa a
  300 KB en un año, la decisión se toma de nuevo con el número nuevo, no con este.

**El dueño aceptó ese costo** sabiendo lo que se pierde: la frase «esta página no
ejecuta una línea de JavaScript» deja de ser cierta, y un ad blocker pasa a
alterar el resultado —una parte del tráfico no se va a medir, y no una parte al
azar, sino la más técnica—. Escrito como **D-251** en `06-decisiones.md`.

---

## 6bis · Lo que se agregó de verdad, medido

**El número de arriba (152 KB de `gtag.js`) seguía siendo una proyección hasta
que se construyó B-376 y B-375: había que medir también lo que este frente
mismo agregó**, porque el banner y los dos eventos propios no son gratis.
Medido contra un build real (`scripts/build-contra-emulador.mjs`), comparando
el HTML de la página de detalle antes y después del cambio, byte por byte —y
**re-medido después de D-254**, que sacó el `preconnect` a
`googletagmanager.com`: los números de abajo son los de después, no los que se
publicaron primero:

| Qué | Antes | Después | Diferencia |
|---|---|---|---|
| HTML de la página, sin comprimir | 17.040 B | 18.631 B | **+1.591 B** |
| HTML de la página, gzip | 4.279 B | 4.719 B | **+440 B** |
| `<script>` propios (sin contar el JSON-LD) | 0 | 2 | — |

La diferencia de HTML es casi entera el **markup del banner** —la caja, los dos
botones, el control «Cookies»—, que aparece en **todas** las páginas porque vive
en `Base.astro`; el resto son las dos etiquetas `<script type="module" src="...">`.
**No hay ningún `<link rel="preconnect">` a `googletagmanager.com`** — hubo uno
sin condicionar al consentimiento, D-254 lo sacó, y
`tests/terceros-antes-del-consentimiento.test.ts` (§7.4bis) es la red para que
no vuelva.

Y el JavaScript, en bytes **transferidos** (gzip, que es lo que importa en la
red — sin cambios por D-254, que solo tocó HTML):

| Chunk | Qué es | Raw | Gzip |
|---|---|---|---|
| `_slug_....js` | el clic de inscripción (una página) | 249 B | 274 B |
| `AvisoDeCookies....js` | el banner (todas las páginas, vía `Base.astro`) | 524 B | 357 B |
| `medicionSitio....js` | el transporte compartido — acá vive `analyticsSitio.ts` entero, inlineado: **no** arrastra `listadoPublico.ts` ni su motor de filtrado (D-252) | 2.190 B | 1.173 B |
| `actividad....js` | las constantes del modelo (`VIAS_INSCRIPCION`) | 371 B | 271 B |
| **Total** | | **3.334 B** | **2.075 B** |

**Y la cuenta que importa, la que compara con el §6.1:** para quien **rechaza**
o no decidió, el costo de este frente es nada más que esto —**2.515 B gzip**
(440 B de HTML + 2.075 B de JS)—, porque `gtag.js` nunca se descarga (§7.3) **y
no hay ninguna conexión de red a un tercero mientras tanto** (D-254, §7.4bis).
Antes de D-254 esta frase era falsa: el `preconnect` abría una conexión a
Google en el load, la persona hubiera rechazado o no. Para quien **acepta**, se
suma el número entero del §6.1: 152 KB de `gtag.js` más los ~2,5 KB de acá,
contra una página que ahora pesa 18,6 KB sin comprimir. La proporción del §6.1
(«8,5 veces la página») sube apenas, a **8,6 veces** en bytes transferidos — el
banner y los eventos propios no son lo que pesa acá, `gtag.js` sigue siendo el
número que manda.

**Lo que no se cuenta en esta tabla:** `gtag.js` mismo (152 KB), que es el
mismo número del §6.1 y no cambió. Y lo que el propio `gtag.js` manda por su
cuenta una vez cargado —el Enhanced Measurement del §7.4—, que no es JavaScript
de este repo y no tiene un byte que medir acá: es tráfico que sale igual,
apagado o no el ítem de código.

---

## 7 · El consentimiento, implementado (B-376)

> **Esto no es asesoramiento legal.** Es una descripción de qué hace la
> herramienta, qué se ve en la práctica y qué costaría cada camino. Si el dueño
> quiere certeza jurídica, la pregunta es para un abogado y no para este
> documento.

### 7.1 · Qué implica GA4 con cookies, concretamente

- Pone **`_ga` y `_ga_<contenedor>`**, cookies de primera parte con un
  identificador **aleatorio** generado en el navegador. No llevan nombre, ni mail,
  ni nada que la persona haya escrito.
- Manda a Google, en cada `page_view`: la URL, el `<title>`, el referrer, el
  idioma, la resolución, y **la IP**, que Google usa para la geografía y que —según
  su documentación— no almacena. Eso último es una promesa de la herramienta, no
  algo que podamos verificar de este lado; conviene decirlo así.
- Google actúa como **procesador** de esos datos por cuenta nuestra.
- **Lo que no pasa:** el sitio no tiene formularios, no tiene login público y no
  guarda ni un dato personal de un tercero — eso lo ratificó **B-102** y sigue
  siendo cierto después de instalar GA4. Lo que cambia es que hay un tercero
  contando visitas, no que empecemos a guardar gente.

### 7.2 · Qué hace la práctica en Argentina

El marco local es la **Ley 25.326** de protección de datos personales, que es
anterior a esta discusión y **no tiene un mandato de consentimiento previo para
cookies** del estilo del que impuso Europa. Lo que se ve en la práctica en sitios
argentinos, de más barato a más caro:

| | Camino | Qué es | Qué cuesta |
|---|---|---|---|
| **C1** | **Nada.** El tag, sin aviso | lo que hacen la mayoría de los sitios chicos del país | cero trabajo. Y es el camino que ningún visitante puede consultar: no hay dónde leer qué se mide |
| **C2** | **Una página de privacidad**, linkeada del pie | una página de texto —como `/ayuda` y `/contacto`, que ya existen y no proyectan ningún documento— que dice qué se mide, con qué, qué cookies se ponen y cómo se rechaza (el ajuste del navegador, o la extensión de opt-out de Google) | **una página nueva y una línea en el pie.** Cero JavaScript, cero cookies, y **la única de las tres que se puede escribir esta semana** |
| **C3** | **Un banner de consentimiento** | el cartel que pide aceptar antes de medir | una pieza de UI **en todas las páginas**, JavaScript en el detalle —lo que la decisión de §6 justamente pone en duda—, una preferencia guardada, el tag condicionado a ella, y **la métrica que se vende cae por lo que rechace la gente**. Si algún día hace falta, GA4 tiene «modo de consentimiento» y se puede agregar después sin rehacer nada |

**La recomendación era C2. El dueño eligió C3** — un banner con «aceptar» o
«rechazar», el patrón estándar de los sitios hoy. Está en `docs/06-decisiones.md`
como **D-250**, con las palabras que importan: **el número que se vende baja por
lo que rechace la gente**, y eso está aceptado a propósito, no es un costo que se
descubra después.

### 7.3 · Lo que «rechazar» significa de verdad, y por qué no es Consent Mode v2

El patrón que casi cualquier tutorial de 2026 recomienda es **Consent Mode v2**:
cargar `gtag.js` siempre, con `analytics_storage: 'denied'` por defecto, y
actualizar el consentimiento cuando la persona decide. **Acá no se implementó
así**, porque en modo denegado GA4 **igual manda pings sin cookies** — el botón
«Rechazar» mentiría.

Lo que se construyó en cambio: **si la persona rechaza, no se manda nada y no se
carga el tag.** Tres reglas que se sostienen con el mismo mecanismo:

1. **Hasta que decide, no se mide.** No hay un tercer estado «mientras tanto, sin
   cookies»: `debeCargarGA`/`debeMostrarBanner` (`src/lib/analyticsSitio.ts`) solo
   conocen `'sin-decidir'`, `'aceptado'` y `'rechazado'`, y el tag nunca se carga
   en el primero.
2. **La preferencia se guarda en el navegador de cada uno, nunca en Firestore.**
   Una sola clave de `localStorage` — no hay nada que guardar del lado nuestro, y
   el §4 de `07-seguridad.md` es explícito en que del público no se guarda nada.
3. **Se puede revisar y cambiar después.** El botón «Cookies» que el banner deja
   siempre disponible una vez decidido reabre el mismo banner — un banner sin
   forma de revisar la decisión es peor que no tenerlo.

Los dos botones —«Aceptar» y «Rechazar»— son dos bloques del **mismo tamaño y el
mismo peso**, uno macizo en `acento` y el otro con borde de `tinta`: nunca un
botón contra un link de texto, que es el dark pattern más común de este tipo de
banner.

Construido en `src/components/sitio/AvisoDeCookies.astro` (el banner, sin
framework ni island: es JavaScript liso, como `SuscribirseCamino.astro`),
`src/lib/analyticsSitio.ts` (puro: el estado del consentimiento y el vocabulario
de los eventos propios) y `src/lib/medicionSitio.ts` (el transporte: carga
`gtag.js` solo con `'aceptado'`). Tests en `tests/analyticsSitio.test.ts` y
`tests/medicionSitio.test.ts`, con la guarda central —«con `'rechazado'` no se
mide, sea cual sea el resto del entorno»— probada por mutación.

### 7.4 · Lo que el código no puede tapar (B-480)

> **Resuelto el 2026-09-03.** El dueño apagó «Búsquedas en el sitio» y «Clics salientes», desactivó los `page_view` basados en el historial de navegación —el caso del buscador que reescribe la URL con `replaceState`— y agregó la clave **`q`** al borrado de «Ocultar datos». Lo que sigue describe por qué hacía falta.

**Recortar el `page_location` y el `page_referrer` no alcanza.** El
`auditor-privacidad` encontró, sobre este mismo cambio, que una vez que
`gtag.js` carga, su **Enhanced Measurement** —prendido por default en toda
propiedad nueva— manda tres cosas que ningún saneador de este repo ve:

| Qué manda solo | El dato que se escapa |
|---|---|
| **«Búsquedas en el sitio»** | lee `?q=...` (`aQuery`, `listadoPublico.ts`) y lo manda como `search_term` — el mismo texto del buscador que el §5.3 ya identificaba como el riesgo, por una puerta que el recorte de `page_location` no tapa |
| **«Cambios de página según el historial»** | la island de filtros llama a `replaceState` en cada tecla; esto dispara un `page_view` nuevo por cada una, leyendo la URL **real** en el momento |
| **«Clics salientes»** | manda el `link_url` completo de un link a otro dominio — el botón de inscripción linkea a `wa.me/<teléfono>` o a `instagram.com/<handle>`, el **destino** que `via` existe para no mandar |

**No hay un parámetro de código que las apague.** Es un ajuste del flujo de
datos en la consola de GA4 (Administrar → Flujos de datos → el flujo → Enhanced
measurement), la misma clase de paso manual que `docs/09-analitica.md` ya pide
para el panel. Acá es **bloqueante**: instalar el tag sin apagar «Búsquedas en el
sitio» y «Clics salientes» filtra aunque todo el código esté bien.

Anotado como **B-480** en el `BACKLOG`, con el detalle completo en **D-253**
(`06-decisiones.md`) y en la salida 12 de `07-seguridad.md`. Bloquea el cierre
real de B-372 aunque el código y el enganche en `Base.astro` ya estén hechos.

### 7.4bis · El `preconnect` que se sacó (D-254)

**El §6.3 de este mismo documento recomendaba un `preconnect` a
`www.googletagmanager.com`, y era un error.** Se implementó (con `conChrome`,
para no ofrecerlo en `/admin`) y el coordinador lo encontró antes de
pushear, leyendo `dist/index.html` de un build real.

Un `preconnect` **no es una pista pasiva**: el navegador resuelve DNS, abre TCP
y completa el handshake TLS con SNI para el host **en el load** — no manda la
URL ni cookies, pero sí le dice al borde de Google que este navegador, desde
esta IP, entró al sitio. Eso pasaba **antes** de que la persona tocara el
banner, y también para quien **rechaza**: contradice la promesa central de
D-250 («hasta que la persona decide, no se mide») y es exactamente lo primero
que busca una auditoría de banner de cookies.

**Y no había forma de condicionarlo.** En un sitio estático el HTML del
`<head>` es el mismo para todo el mundo — la decisión de consentimiento vive en
el `localStorage` de cada visitante, y el build no sabe cuál es. El arreglo fue
sacarlo, no condicionarlo: lo que se pierde son unos milisegundos de DNS/TLS en
la primera carga del tag **de quien ya aceptó**, que es barato al lado de lo
que costaba.

**La red que faltaba, ahora existe:**
`tests/terceros-antes-del-consentimiento.test.ts` lee el HTML construido (no el
fuente — necesitaría reimplementar el parser de Astro) y falla si aparece un
`<link>` de conexión (`preconnect`/`dns-prefetch`/`prefetch`/`preload`/
`stylesheet`), un `<script src>` o un `<iframe src>` apuntando a un host que no
esté en una lista blanca explícita, con motivo. Hoy esa lista tiene dos
entradas — `fonts.googleapis.com` y `fonts.gstatic.com`, las tipografías del
sistema visual (B-260), anteriores a todo esto — y **no** tiene
`googletagmanager.com`: si vuelve, el test lo dice, con el archivo y el host
exactos. Mutación probada: se repuso el `preconnect` a mano, el test pasó a
rojo nombrándolo, se sacó de nuevo.

**Y una idea que quedó anotada, no resuelta:** las tipografías son, hoy, la
misma clase de conexión a un tercero en el load que este ítem acaba de sacar
—solo que decidida antes y sin la lupa del consentimiento encima—.
Autoalojarlas la eliminaría del todo. Es una decisión de otro día, pero con un
banner ya construido conviene tenerla escrita: **B-481** en el `BACKLOG`.

---

## 8 · El primer tramo, el que se implementó

**«Estado del catálogo»**, una vista nueva del panel. El criterio de por qué es
éste y no otro está en **D-200**.

Sigue siendo lo primero incluso con GA4 decidido, y el motivo es de calendario:
**GA4 no mide retroactivamente**, así que su tablero muestra cero el primer día y
poco el primer mes. El catálogo, en cambio, sirve desde que se abre.

Es además el único tramo claramente seguro:

- **no mide a ningún visitante** — no existe el visitante en este tramo;
- **no toca el sitio público** — ni un byte, ni un `<script>`, ni una cookie;
- **no manda nada a ningún tercero** — nada sale del navegador del dueño;
- **no cuesta una lectura de Firestore de más** — es la misma lectura de
  `/actividades` que el listado ya hace, agrupada de otra manera;
- **contesta las preguntas 8, 9 y 10 y cinco de las ocho fricciones** (la de «ya
  pasó» se sacó, D-273), que son las que se convierten en trabajo del día siguiente.

### 8.0 · Dos pestañas, no una página larga (B-501)

El tablero era una sola página apilada: avisos, cobertura y conteos, uno debajo
del otro. Con la mitad nueva de abajo (§8.1bis) apilar una tercera cosa la
volvía un scroll interminable, así que pasó a **pestañas internas** — es un
island `client:only`, sobra JavaScript para esto y no hace falta navegación:

| Pestaña | Qué tiene | Mide a alguien que visita el sitio |
|---|---|---|
| **El catálogo** | lo que ya existía, reorganizado: los avisos siguen arriba a todo lo ancho, pero «Lo que se publica» y «Qué hay cargado» pasan a ir lado a lado desde `lg` en vez de apiladas | no |
| **El sitio público** | el andamiaje de §8.1bis: la estructura de lo que va a mostrar cuando B-374 exista, sin un número inventado | todavía no mide nadie — el tablero tampoco |

Pestañas de verdad, con el patrón «tabs, automatic activation» de WAI-ARIA APG:
`role="tablist"`/`"tab"`/`"tabpanel"`, roving `tabIndex` (solo la pestaña
activa entra en el orden de `Tab`), y las flechas mueven el foco **y** activan
la pestaña en el mismo gesto — `Home`/`End` van a los extremos. Es el mismo
patrón que `CentroAyuda` ya usaba para Guía/Novedades, con la navegación por
teclado que a `CentroAyuda` le faltaba.

**No dispara un evento nuevo por cambiar de pestaña.** El §8.3 ya dice por qué
`estadisticas-abrir` es el único evento de esta pantalla — «un entero y nada
más» — y sigue siendo cierto: cuál pestaña mira alguien no cambia la respuesta
a «¿vale construir B-374?», así que agregar telemetría acá sería medir por
medir.

### 8.1 · Qué muestra la pestaña «El catálogo»

Tres bloques, en el orden de lo que hay que hacer primero:

1. **Los avisos** — las cinco fricciones detectables del [§4](#4--las-fricciones-a-detectar-traducidas), cada una con las
   actividades que la disparan y un click para abrirlas. Van primero porque son
   lo accionable. Si no hay ninguno, lo dice. **No hay un aviso de «ya pasó»
   (D-273):** se probó —reencuadrado y todo (D-270)— y se sacó, porque listaba el
   archivo entero, que sólo crece y para casi nada pide acción. Lo que sí queda es
   la cobertura acotada «cuántas publicadas tienen fecha futura» (punto 2), que
   dice lo mismo sin ser una lista que envejece.
2. **Lo que se publica, completo o no** — de las publicadas: cuántas con imagen,
   cuántas con etiquetas, cuántas con descripción suficiente, cuántas con
   encuentros por venir. Es el termómetro de B-264 («2 de 42 con imagen») **medido
   exacto**, y no estimado desde un cruce de GA4.
3. **Qué hay cargado** — el reparto por estado, tipo, arancel y forma de cursar,
   más ciclos, sueltas y encuentros.

### 8.1bis · Qué muestra la pestaña «El sitio público» — el andamiaje, no los datos (B-502)

El pedido original quería vistas, páginas más vistas, secciones, clics y
fricciones **en el panel**. Esa lectura es **B-374**, no está construida, y no
lo va a estar hasta que haya un mes de datos (GA4 no mide retroactivo, §9.2).
Mostrar cero o inventar un número habría sido peor que no construir nada: la
pestaña existe para dejar la estructura escrita y honesta, no para simular que
ya mide.

Lo que hay hoy, agrupado igual que el [§2](#2--dos-mitades-y-no-una) de este
documento:

- **Una franja fija** con tres cosas: que esto todavía no tiene un solo número,
  y es a propósito; la fecha exacta desde la que hay algo que medir (**el 3 de
  septiembre de 2026** — antes de esa fecha el sitio no medía nada, y GA4 no
  reconstruye ese vacío); y qué falta en concreto para que deje de estar vacío
  (un mes de datos + la Function de B-374).
- **«Para ofrecer a un anunciante»** — las cuatro filas de la mitad **a**:
  visitas y personas, vistas de página, las páginas más vistas (agrupado como
  «qué secciones se usan más» — inicio, cartelera, agenda por mes, detalle,
  archivo — que es la misma pregunta 2 del §3, no una nueva), y de dónde entra
  la gente. Cada fila con su «sin datos aún».
- **«Para mejorar el sitio»** — las dos filas de la mitad **b**, y la única
  diferencia real con la anterior: `clic_inscripcion` y `filtro_sin_resultados`
  **ya están instalados** (B-375) y van a empezar a juntar volumen apenas el
  tag mida en producción. Lo que falta para verlas acá es la misma Function,
  no escribirlas de nuevo.

**Lo que se decidió no hacer, para que quede escrito:** no se agregó «tiempo en
página» ni «scroll» (el §3.1 ya los excluyó del diseño), y «secciones» no es
una fila propia — es la misma pregunta que «páginas más vistas», agrupada, para
no inventar una categoría nueva donde el documento de arquitectura ya la había
retirado a propósito.

### 8.2 · Dónde vive

| Pieza | Archivo | Qué es |
|---|---|---|
| El cálculo | `src/lib/estadoDelCatalogo.ts` | **puro**. Recibe `ActividadConId[]` y un reloj, devuelve el estado. No sabe de React, ni de Firestore, ni de pantallas |
| La pantalla, las pestañas y el andamiaje de «El sitio público» | `src/components/admin/EstadisticasPanel.tsx` | lee `/actividades` en vivo, como las otras vistas del panel, y acomoda las dos pestañas |
| Los gráficos | el mismo componente | **barras de CSS**, sin ninguna dependencia nueva. Cada barra lleva su número escrito al lado: el gráfico ayuda a comparar, no informa solo — de ahí que vaya `aria-hidden` |
| La entrada | `src/components/admin/AdminApp.tsx` | una vista más del router propio, **diferida** por `import()` como las otras cinco (el corte de bundle de B-09 / B-117) |
| Los tests del cálculo | `tests/estado-del-catalogo.test.ts` | el módulo puro caso por caso, con los bordes de cada umbral, más el barrido de que nada de lo que la pantalla ve llega a la analítica |
| Los tests de las pestañas | `tests/estadisticas-pestanias.render.test.tsx` | renderizado real (jsdom): qué panel se ve al hacer click y al navegar con las flechas, y el roving `tabIndex` — cableado que un test del fuente no puede verificar sin arriesgar un falso verde |

### 8.3 · Dos cosas que no hace, y una que sí

- **No tiene serie temporal.** Es una foto de hoy, no una tendencia: para decir
  «hace un mes había 3 sin imagen y hoy hay 12» hay que guardar la foto → **B-378**.
- **No calcula del lado del servidor.** Agrupa 46 documentos en el navegador, que
  es instantáneo. Con unos miles conviene un agregado → **B-379**.
- **Sí manda un evento**, y uno solo: `funcion_usada` con
  `funcion: estadisticas-abrir` y, como `valor`, cuántas actividades tenía el
  catálogo. Contesta la única pregunta que decide si vale construir la mitad que
  lee GA4: **¿alguien abre el tablero?** Si nadie lo abre, la Function de la Data
  API (**B-374**) no vale lo que cuesta.

---

## 9 · Leer GA4 desde el panel: lo que cuesta de verdad

El pedido asume que el tablero vive en el panel. Con GA4 como fuente eso tiene un
costo que conviene medir **antes** de construirlo, porque no es «una llamada más».

### 9.1 · Las piezas, una por una

| Pieza | Por qué hace falta | Costo |
|---|---|---|
| **La Data API de GA4** | GA4 **no se puede consultar desde el navegador**: la API pide credenciales de servidor y no acepta una API key. Y el §5.4 es tajante — `firebase-admin` y cualquier key de cuenta de servicio, nunca al bundle del cliente | habilitar `analyticsdata.googleapis.com` |
| **Una Cloud Function nueva** | es el único lugar del proyecto que puede tener credenciales de servidor | +1 Function que hoy no existe, con su región, su despliegue y su presupuesto |
| **Una cuenta de servicio con acceso a la propiedad** | la Function tiene que estar autorizada a leer `G-9CFMHSSGRC` | +1 identidad, y un paso manual en la consola de GA4 que solo el dueño puede hacer |
| **Autorizar la Function** | un endpoint que devuelve las métricas del sitio no puede ser anónimo | `onCall` con verificación del claim `admin`, o `onRequest` verificando el ID token. Es la misma superficie que `/reportes` ya tuvo que cuidar |
| **Caché** | la Data API tiene cuotas por propiedad y por día, y un tablero que se abre y se recarga las consume | un documento de caché en Firestore o memoria de la instancia, con su invalidación |
| **Tests** | **GA4 no tiene emulador.** El camino de lectura solo se puede testear contra un doble | los tests dicen que el nuestro parsea bien lo que **suponemos** que devuelve la API, no que la API devuelva eso. Es la clase de test que da verde el día que el contrato cambia |
| **La latencia** | los informes de GA4 tardan **24 a 48 horas** ([`09-analitica.md`](09-analitica.md)) | un tablero recién construido muestra vacío dos días y parece roto. Hay que decirlo en la pantalla |

### 9.2 · Y la pregunta que hay que hacerse antes

**¿El panel necesita ser un cliente de GA4?** GA4 ya tiene una interfaz para
mirar GA4, gratis, sin construir nada, y con exploraciones que un tablero casero
no va a igualar. Lo que el panel puede dar y GA4 no es lo que GA4 no sabe: **el
catálogo**.

La recomendación es entonces la mínima que sirve: el panel muestra **el catálogo**
(hecho) más **el resumen vendible** (§9.3) — cuatro números y su período, que es
lo que uno copia a un mail—, y todo el análisis fino se mira en GA4 o en Search
Console. La Data API entra **por ese resumen y por nada más**, y solo si
`estadisticas-abrir` dice que el tablero se usa.

### 9.3 · Qué muestra el panel de la mitad vendible, y con qué período

Un anunciante pregunta el volumen primero y **siempre con un período**. Un número
sin período no se puede usar, así que el tablero muestra exactamente esto:

| Qué | Período | Por qué ése |
|---|---|---|
| **Visitas** (sesiones) y **personas** (usuarios activos) | **últimos 28 días**, con el **cambio contra los 28 anteriores** | 28 y no «este mes»: son cuatro semanas exactas, así que no mezcla meses de 30 y 31 días ni cambia el peso de los fines de semana. Y es el número que se cotiza mensual |
| **Vistas de página** | ídem | el otro número que se cotiza, y el que dice si la gente mira más de una actividad por visita |
| **Las 10 páginas más vistas** | ídem | de la mitad **a** es lo que se le ofrece a un anunciante como lugar caro; de la mitad **b**, la lista de qué se mira |
| **De dónde entran** (buscador / redes / directo) y **con qué aparato** | ídem | lo que se pregunta segundo |
| **Desde cuándo hay datos** | la fecha del primer dato | **es la línea que hace creíble a las demás.** «12.000 visitas» sin decir que la medición arrancó hace seis semanas es un número que se cae en la primera pregunta |

Y una línea que el tablero tiene que decir siempre, porque es la que evita el
error más caro: **de dónde sale cada número.** El que sale de GA4 se puede
defender; el que sale del catálogo, no es comparable con el de nadie. Mezclarlos
en la misma grilla sin decir cuál es cuál es cómo un número propio termina en un
mail presentado como si fuera de Google.

---

## 10 · Lo que el propósito comercial abre y nadie nombró

**Vender publicidad significa poner un anuncio en el sitio.** Eso es una **salida
pública nueva**, y hoy el sitio no tiene **un solo script de afuera** — verificado
en el §1. No se resuelve acá; se anota, porque va a llegar, y llega con una
superficie que este documento entero se ocupó de mantener chica.

Lo que habría que decidir cuando toque (**B-377**):

| Qué | Por qué importa |
|---|---|
| **Dónde va el inventario** | en el listado, entre las filas; en la cartelera; en el detalle. Cada lugar es una salida distinta de las diez del §5, y la del detalle es la que está indexada |
| **Vendido por nosotros, o por una red** | son dos mundos. **Vendido por nosotros** es una imagen y un link cargados como una actividad más: **cero scripts de terceros**, cero cookies, y el conteo lo hace el mismo evento propio de la mitad **b**. **Una red** (AdSense y compañía) es un script de un tercero que trae los suyos, cookies de seguimiento, y **contenido que no controlamos en una página nuestra** |
| **Qué le pasa al §5** | una red de anuncios recibe la URL de la página donde se muestra, igual que GA4 — pero además puede poner sus propias cookies y su propio identificador. Es una fila nueva en la tabla de salidas, y la más difícil de auditar de todas, porque lo que se manda lo decide el script del tercero |
| **Qué le pasa al peso** | el §6 acaba de medir 152 KB por el tag de GA4 en una página de 18 KB. Una red de anuncios pesa **más** que eso, y en la misma página |
| **Qué le pasa al sitio** | «efímera cultural en risografía» (D-146) con un banner de una red arriba deja de ser eso. Es una decisión de identidad y no solo técnica |

**Lo que este documento recomienda dejar anotado como preferencia:** si se vende
publicidad, **vendida por nosotros y servida por nosotros** — una imagen, un link,
cargados por el panel como se carga una actividad. Es la única forma que no le
agrega un script de tercero al sitio, y la que deja el conteo del lado nuestro,
donde ya vamos a tener los eventos.

---

## 11 · El orden en que conviene hacerlo

Porque el orden acá no es cosmético: GA4 no mide retroactivamente, así que **cada
semana sin el tag es una semana de historia que no se recupera**.

| # | Qué | Por qué en ese lugar |
|---|---|---|
| 1 | **El tablero del catálogo** | ✅ hecho. Sirve desde hoy y no espera nada |
| 2 | **Search Console** (**B-373**) | no necesita ninguna decisión, no pone cookies, no agrega JS, y contesta la pregunta que justifica el proyecto. **Diferido a propósito, no descartado**: el dueño lo deja para el final de todo. El motivo por el que igual conviene no demorarlo mucho es de calendario y sigue vigente — Search Console no muestra histórico anterior a la conexión, así que cada día sin conectarlo es un día que no se recupera |
| 3 | **El banner y el consentimiento** (**B-376**, camino C3) | ✅ construido — es la pieza que hace que el tag esté informado desde el primer día en que mide de verdad |
| 4 | **El tag de GA4** (**B-372**) | ✅ código y enganche en `Base.astro` hechos, incluido el chequeo del [§5.3](#53-el-invariante-nuevo-que-esto-crea-y-que-hay-que-testear) y el de `page_referrer` (D-253). **⛔ Bloqueado por B-480** antes de medir en producción — ver [§7.4](#74--lo-que-el-código-no-puede-tapar-b-480) |
| 5 | **Los eventos propios** (**B-375**) | ✅ construidos: el clic en el botón de inscripción y el filtro que deja cero. Inertes hasta que B-480 se resuelva, igual que el resto de B-372 |
| 6 | **El resumen vendible en el panel** (**B-374**) | recién cuando haya un mes de datos y `estadisticas-abrir` diga que el tablero se abre |

---

## 12 · El backlog de este frente

| Ítem | Qué es | Estado |
|---|---|---|
| **B-370** | **Analítica del sitio público** — el ítem paraguas, y este documento | 🟡 el tablero del catálogo y el banner/tag/eventos están; falta B-373, B-374 y B-480 |
| **B-371** | Decisión del dueño: aceptar el costo de JavaScript en la página de detalle, con el número del [§6](#6--el-costo-en-la-página-de-detalle-medido) | ✅ resuelto — **aceptado** (D-251) |
| **B-372** | **Instalar el tag de GA4** en las páginas públicas — la mitad vendible entera, sin un evento propio. Incluye el chequeo del §5.3 y el de `page_referrer` (D-253) | 🟡 código y enganche en `Base.astro` hechos — **⛔ bloqueado por B-480** para medir en producción |
| **B-373** | **Search Console**: conectar el dominio y leerlo | 🟡 **conectado el 2026-09-03** — el histórico ya acumula; queda la lectura al panel, que va con la tanda de datos (B-374) |
| **B-374** | La Function que lee la Data API de GA4 para el resumen vendible del panel | ⛔ depende de B-372 (con B-480 resuelto) y de un mes de datos |
| **B-375** | Los **eventos propios** de la mitad de mejora: el clic en el botón de inscripción y el filtro que deja cero | ✅ construidos — inertes hasta que B-372/B-480 midan de verdad |
| **B-376** | El **aviso de privacidad** y el consentimiento — decisión del dueño entre C1, C2 y C3 | ✅ resuelto — **C3** (D-250), banner construido |
| **B-377** | El **inventario publicitario**: una salida pública nueva. Anotado, no resuelto | 🔵 futuro |
| **B-378** | El tablero del catálogo es una foto y no una serie: guardar la foto para ver la tendencia | 🔵 futuro |
| **B-379** | El tablero agrupa en el navegador; con miles de actividades conviene un agregado | 🔵 futuro |
| **B-480** | **Bloqueante para B-372:** apagar «Búsquedas en el sitio» y «Clics salientes» (Enhanced Measurement) en la consola de GA4 — ningún código de este repo los tapa (D-253, §7.4) | ⛔ acción manual del dueño |
| **B-481** | Las tipografías (`fonts.googleapis.com`/`fonts.gstatic.com`) son una conexión a un tercero en el load, la misma clase que D-254 sacó para GA4 — autoalojarlas la eliminaría | 🔵 futuro, anotado por D-254 |
| **B-500** | El aviso «ya-paso»: reencuadrado (D-270) y después sacado del todo (D-273), porque la lista crece sin techo y no pide acción para casi nada | ✅ hecho (2026-09-03) |
| **B-501** | El tablero pasa a pestañas internas — «El catálogo» / «El sitio público» (D-271) | ✅ hecho (2026-09-03) |
| **B-502** | La pestaña «El sitio público»: el andamiaje honesto de lo que B-374 va a mostrar, sin datos inventados (D-272) | ✅ hecho (2026-09-03) |
| **B-601** | **El tríptico «¿Qué hay ahora?» de la home no se mide** (B-600, D-320). Un clic en una fila del tríptico y uno en una fila del listado llevan al mismo lugar, así que hoy son indistinguibles: no se puede contestar si la sección se usa, cuál de los tres paneles, ni si el «+N más» —que a propósito no linkea— frustra. El evento tendría que viajar con el panel (`hoy`/`manana`/`finde`) y la posición de la fila, **nunca con el slug ni el título** | 🔵 futuro, anotado al construirlo |

---

## Ver también

- [`09-analitica.md`](09-analitica.md) — la analítica del **panel**: ocho eventos,
  su vocabulario y la garantía de que no sale contenido. Es el estándar que la
  mitad **b** tiene que cumplir.
- [`07-seguridad.md`](07-seguridad.md#analítica-del-panel) — la salida 4 y cómo se
  verifica; el alcance nuevo del [§5.2](#52-por-qué-eso-igual-está-bien-dicho-con-precisión);
  y la **salida 12**, la analítica del sitio público, con la advertencia de
  Enhanced Measurement que este documento cita en el [§7.4](#74--lo-que-el-código-no-puede-tapar-b-480).
- [`12-sitio-publico.md`](12-sitio-publico.md) §11.1 — la decisión 4 del dueño,
  que es la que se contestó acá.
- [`06-decisiones.md`](06-decisiones.md) — **D-200** (por qué el tablero arranca
  por el catálogo), **D-201** (GA4 en el sitio público, con su costo medido y el
  alcance de la regla de contenido), **D-250** (el banner es C3, y qué significa
  «rechazar» de verdad), **D-251** (el costo de JS aceptado, con el número),
  **D-252/D-253** (las decisiones técnicas de B-372/B-375, y lo que Enhanced
  Measurement de GA4 no deja tapar desde el código) y **D-254** (por qué el
  `preconnect` a GA4 se sacó en vez de condicionarlo, y la red que lo cubre).
