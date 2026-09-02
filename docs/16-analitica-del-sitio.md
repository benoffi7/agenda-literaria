# Analítica del sitio público — arquitectura

| | |
|---|---|
| Qué es esto | **Un documento de arquitectura, no una descripción de lo que existe.** Casi nada de lo que describe está construido, y eso es deliberado: el pedido era un tablero y la primera mitad del trabajo es decidir qué se mide |
| Alcance | el **sitio público** (`agendaleh.ar`). La analítica del **panel** ya existe, está documentada en [`09-analitica.md`](09-analitica.md) y **este documento no la cambia** |
| Qué sí se implementó | el tablero del [§7](#7--el-primer-tramo-el-que-se-implementó): **«Estado del catálogo»**, en el panel. No mide a ningún visitante |
| Qué está bloqueado | **dos decisiones del dueño** ([§6](#6--las-dos-decisiones-del-dueño)) — **B-370** y **B-371** |
| La regla que manda | a GA4 **no sale contenido, nunca** ([`07-seguridad.md`](07-seguridad.md#analítica-del-panel), salida 4). Todo lo de acá se lee contra esa regla |

---

## 1 · El hecho que reordena el pedido

El pedido fue «una opción en el panel para ver estadísticas del sitio, con los
eventos más vistos, secciones, pulsaciones y fricciones a detectar». Suena a
tablero, o sea a la mitad de atrás de la cadena. La mitad de adelante no existe:

> **El sitio público no mide nada.** Cero eventos, cero cookies, cero
> JavaScript de telemetría. No hay datos que mostrar.

Verificado el 2026-09-02, en el sitio de producción y en el árbol de trabajo:

| Qué se miró | Cómo | Resultado |
|---|---|---|
| El HTML de una página de detalle real | `curl https://agendaleh.ar/actividad/taller-de-cuento-luciano-lamberti/` | **un** `<script>`, y es `type="application/ld+json"` — el JSON-LD del §5 del diseño. Es **datos, no código**: el navegador no lo ejecuta. 18.341 bytes de HTML, **cero bytes de JavaScript** |
| Cookies de esa misma respuesta | cabeceras de la misma petición | **ningún `Set-Cookie`** |
| La home | ídem | dos `<script>` inline, y son el runtime de hidratación de la island `Buscador` (`client:load`), la única del sitio público |
| `/cartelera`, `/ayuda`, `/pasadas` | build local | **cero** `<script>` |
| Cualquier rastro de un medidor | `grep` de `gtag`, `googletagmanager`, `google-analytics`, `analytics`, `measurement` sobre `src/layouts/`, `src/pages/`, `src/components/publico/` y `src/components/sitio/` | **cero coincidencias** |
| El único `import` de `firebase/analytics` del repo | `src/lib/analytics.ts` | es **dinámico** y vive del lado del panel; `analiticaHabilitada()` exige `PUBLIC_FIREBASE_MEASUREMENT_ID`, y quien lo lee es `/admin` |

**Una corrección al encargo, para que quede escrita:** la página de detalle no
tiene «tres `<script>`, el JSON-LD y el runtime de la island». Tiene **uno**, el
JSON-LD, y **no tiene island** — el `grep` de directivas `client:` del proyecto
devuelve exactamente dos usos, `admin.astro` y `index.astro`. Importa porque
cambia el tamaño de la decisión B: no es «agregar un poco más de JS a una página
que ya trae algo», es **estrenar** JavaScript en la página que recibe el tráfico.

De ahí sale la forma de este frente: primero la arquitectura escrita, después el
único tramo que se puede construir hoy sin pedirle permiso a nadie.

---

## 2 · Las preguntas primero, y no los eventos

Un tablero armado desde los eventos disponibles termina mostrando lo que es
fácil de medir. Así que la lista empieza por las preguntas, **en el idioma del
dueño**, ordenadas por lo que se hace con la respuesta y no por lo que cuesta
contestarlas.

La última columna es la que importa: **cuatro de las diez se contestan hoy, sin
medir a nadie.**

| # | La pregunta | Qué se hace con la respuesta | De dónde sale | ¿Hoy? |
|---|---|---|---|---|
| 1 | **¿Qué actividad se mira más?** | qué se destaca, qué se repite el año que viene, a qué organizador conviene volver a buscar | una visita por página, con la página identificada | ❌ y es la que choca con la regla — [§5.1](#51-el-page_view-automático-es-la-trampa) |
| 2 | **¿Cuántos llegan a escribirle al organizador?** | **el único número que dice si el sitio sirve.** Sin esto, «el sitio anda» significa «carga rápido» | un clic en el botón de inscripción | ❌ decisión A |
| 3 | **¿Qué filtro usa la gente?** | qué ejes quedan y cuáles se retiran; qué taxonomías del §4 vale la pena curar | la island de filtros, que **ya corre en el navegador** | ❌ decisión A, pero es la más barata de todas |
| 4 | **¿Por dónde entra la gente?** (buscador, Instagram, un link pegado, directo) | dónde publicar y qué esfuerzo rinde | el `referrer` de la primera visita | ❌ decisión A |
| 5 | **¿Cuánta gente entra?** | el denominador de todo lo demás, y el termómetro de si el proyecto crece | ídem | ❌ decisión A |
| 6 | **¿Se mira en el celular o en la computadora?** | dónde se prueba antes de publicar. En el panel esta pregunta ya se contesta y **es la mitad del análisis** ([`09-analitica.md`](09-analitica.md)) | ancho de viewport, como en el panel | ❌ decisión A |
| 7 | **¿Google nos está encontrando?** ¿con qué búsquedas? | si el trabajo de SEO de B-109 rindió. Es la razón de ser del sitio: «si la gente no encuentra los talleres en Google, el sitio no sirve» (§2.3 del `CLAUDE.md`) | **Search Console** — [§3.2](#32-search-console-la-fuente-que-nadie-cuenta) | 🟡 **no necesita medir a nadie ni una línea de JS**, solo conectar el dominio → **B-373** |
| 8 | **¿Qué se está ofreciendo hoy, y en qué estado está?** | el trabajo del día: qué falta publicar, qué quedó a medias | el propio catálogo de Firestore | ✅ **implementado** |
| 9 | **¿Hay algo publicado que no se pueda usar?** | lo que hace que alguien escriba y no le contesten: inscripción cerrada, actividad que ya pasó | el catálogo + el reloj | ✅ **implementado** |
| 10 | **¿Lo que publicamos está completo?** (flyer, etiquetas, descripción) | lo que decide si una actividad aparece en la cartelera, en los filtros y con imagen en un link compartido | el catálogo | ✅ **implementado** |

### 2.1 · Lo que esta lista deja afuera a propósito

- **«Secciones» y «pulsaciones»**, tal cual estaban en el pedido. Son categorías
  de herramienta, no preguntas: «pulsaciones» sin decir de qué es un número que
  nadie va a mirar dos veces. Se convirtieron en la 2 y la 3, que sí tienen una
  decisión atada.
- **Mapas de calor y grabación de sesión.** Son la forma más invasiva de medir
  —reconstruyen lo que una persona hizo en la pantalla— y con este volumen no
  dirían nada. No entran.
- **Tiempo en página y scroll.** Con una página que carga en un HTML de 18 KB y
  sin JS, medirlos exige exactamente el JS que la decisión B pone en duda, y lo
  que se aprende es difuso: nadie va a cambiar una actividad porque el scroll
  promedio fue del 60 %.

---

## 3 · De dónde sale cada dato — seis fuentes, con su costo real

| # | Fuente | Qué preguntas contesta | Qué cuesta | Qué le pasa a la privacidad |
|---|---|---|---|---|
| A | **El propio catálogo** (Firestore, leído en vivo desde el panel) | 8, 9, 10 | nada nuevo: el panel ya lee `/actividades` en cada vista | **nada**: son datos del dueño sobre su propio trabajo. Ningún tercero involucrado |
| B | **Search Console** | 7 | conectar el dominio y mirar una consola. Cero código | **nada del lado del visitante**: los datos los junta Google del lado del buscador, no del sitio. Sin cookies, sin JS |
| C | **Los logs de Firebase Hosting** | 1, 4, 5 (en teoría) | ver [§3.3](#33-los-logs-de-hosting-no-son-la-salida-barata) | **peor que GA4**: lo que se exportaría son IPs y user agents, guardados por nosotros |
| D | **GA4 + su Data API** | 1 a 6 | ver [§5](#5--leer-ga4-desde-el-panel-lo-que-cuesta-de-verdad) | cookie propia, datos a un tercero, y el `page_view` automático manda el slug ([§5.1](#51-el-page_view-automático-es-la-trampa)) |
| E | **Medición propia sin cookies** | 2, 3, 5, 6 (no la 1 sin decidir la 4) | una Function nueva, un contador en Firestore, y el sitio deja de ser estático puro | **la mejor de las que miden**: ningún tercero, ninguna cookie, y qué se guarda lo elegimos nosotros |
| F | **No medir** | ninguna de 1 a 6 | nada | ninguna |

### 3.1 · A · El catálogo es la fuente que ya está pagada

Es la que el pedido no nombraba y la que rinde primero. El panel **ya** lee las
46 actividades en vivo para pintar el listado; agrupar esa misma lectura por
estado, por tipo, por arancel y por completitud no cuesta ni una lectura más de
Firestore, no toca el sitio y no involucra a nadie de afuera.

Y no es un premio consuelo: tres de las diez preguntas —las 8, 9 y 10— son las
únicas de la lista que se traducen **directamente en trabajo del día siguiente**.
«Qué actividad se mira más» es interesante; «hay tres publicadas con la
inscripción cerrada» es una tarea.

Lo que **no** puede dar: nada sobre quién visita. El catálogo dice qué se
ofrece, no qué se mira.

### 3.2 · B · Search Console, la fuente que nadie cuenta

Contesta la pregunta 7, que es la que justifica el proyecto, y **es la única
fuente de la tabla que no le agrega nada al sitio**: ni un byte de JavaScript, ni
una cookie, ni un dato a nadie. Los datos los tiene Google del lado del
buscador —qué se buscó, qué posición tuvimos, cuántos clics— y se leen en su
consola.

Es también la única que confirma que el trabajo de B-109 (canonical, Open Graph,
`sitemap.xml`, `robots.txt`) funcionó: sin ella, «el sitemap está bien» es una
creencia. **Y es lo primero que conviene hacer**, decisiones aparte: no depende de
ninguna → **B-373**.

Lo que no da: nada de lo que pasa **dentro** del sitio. Sabés que alguien entró
desde Google a `/actividad/x`; no sabés si escribió al organizador.

### 3.3 · C · Los logs de Hosting no son la salida barata

Parece la opción elegante: contar visitas del lado del servidor, sin JavaScript
ni cookies. En la práctica, y esto **hay que verificarlo en la consola antes de
apoyarse en el párrafo**, Firebase Hosting no ofrece logs de petición por URL
listos para leer: lo que la consola muestra es uso agregado (ancho de banda,
transferencia), y para tener la línea por petición hay que habilitar una
exportación —a Cloud Logging o a BigQuery—.

Y ahí está el problema, que es el opuesto del esperado: **lo que se exportaría
tiene más datos personales que GA4, y pasaríamos a ser nosotros quienes los
guardan.** Una línea de log de servidor trae la IP y el user agent. Con GA4, al
menos, la responsabilidad de la retención es de Google y hay un panel donde
apagarla; con un export propio, la IP de cada visitante queda en un proyecto de
GCP nuestro, con la retención por defecto, y el §5 del `CLAUDE.md` deja de caber
en una tabla.

Sumado a que no contesta la pregunta 2 —un clic no genera una petición—, la
fuente C se descarta.

### 3.4 · E · La medición propia sin cookies, que es la alternativa real

Si la respuesta a la decisión A es «sí, algo hay que medir», ésta es la forma que
menos cuesta en privacidad, y conviene que esté escrita porque es la que nadie
propone:

- Una Cloud Function `onRequest` mínima (`contar`) que recibe un `POST` con un
  cuerpo de vocabulario cerrado —el mismo criterio de `analytics-eventos.ts`— e
  incrementa un contador en `/metricas/{aaaa-mm-dd}` con `FieldValue.increment`.
- **No guarda IP, ni user agent, ni referrer crudo, ni un identificador de
  visitante.** No hay cookie, no hay `localStorage`, no hay sesión: por
  construcción no se puede reconstruir el recorrido de una persona, y eso es
  exactamente lo que se está comprando.
- Lo que se pierde con eso, dicho: **no hay «visitantes únicos»**, solo eventos
  contados. Y sin sesión no hay embudo: se sabe cuántas veces se abrió una
  actividad y cuántas veces se apretó el botón de inscripción, pero no que **la
  misma** persona hizo las dos cosas. Para las preguntas 2, 3 y 5 alcanza; la 1
  necesita además decidir la 4.
- El panel lee `/metricas/*` con las reglas que ya tiene: **una lectura de
  Firestore, sin una API de terceros, sin una cuenta de servicio nueva, sin una
  superficie HTTP para leer.** Comparar esto con el [§5](#5--leer-ga4-desde-el-panel-lo-que-cuesta-de-verdad) es la mitad del
  argumento.
- Lo que cuesta: el sitio deja de ser HTML puro en la página que se decida
  instrumentar (decisión B), la Function es una superficie de escritura anónima
  que hay que acotar (App Check, o un tope por día y por documento; un bot puede
  inflar el contador y el peor caso es un número mentiroso, no una fuga), y
  aparece una colección nueva que el §5 tiene que nombrar.

---

## 4 · Las «fricciones a detectar», traducidas

La parte más interesante del pedido y la más vaga. Traducida, una fricción es
**una situación concreta, detectable, en la que el sitio le hace perder algo a
alguien**. Lista corta y defendible; no un catálogo.

| # | La fricción | Cómo se detecta | Qué se hace con eso | ¿Hoy? |
|---|---|---|---|---|
| 1 | **Una actividad publicada a la que ya no se puede entrar** — la inscripción cerró, o está marcada como completa, y todavía tiene encuentros por venir | catálogo + reloj | cambiar el estado, correr la fecha de cierre, o avisar en la descripción | ✅ |
| 2 | **Una actividad que ya pasó y sigue en `publicado`** | catálogo + reloj | pasarla a un estado que refleje que terminó (es lo que B-101 discute) | ✅ |
| 3 | **Una actividad publicada sin flyer** | catálogo | conseguir el flyer: sin él no entra a la cartelera y el link compartido va con la marca genérica. Al 2026-09-01 eran **2 de 42** con imagen | ✅ |
| 4 | **Una actividad publicada sin etiquetas** | catálogo | ponerle etiquetas: sin ellas es invisible al eje de etiquetas de los filtros del sitio, o sea que existe pero no se encuentra filtrando | ✅ |
| 5 | **Una actividad publicada con descripción demasiado corta** | catálogo | escribir dos frases más: la `meta description` sale de ahí, y es la que decide el clic desde Google | ✅ |
| 6 | **Algo que quedó a medio publicar** — en `borrador` o `pendiente` sin tocarse hace más de 30 días | catálogo + reloj | publicarlo o descartarlo. Es trabajo hecho que no está rindiendo | ✅ |
| 7 | **Un filtro que se aplica y deja cero resultados** | la island de filtros, midiendo la combinación que quedó vacía | retirar el eje, o cargar lo que falta. Un eje que da cero seguido es un eje que estorba | ❌ decisión A → **B-375** |
| 8 | **Una actividad que se abre mucho y no genera ni un mensaje** | visitas por página + clics en el botón de inscripción | revisar la descripción, el precio o la forma de anotarse de **esa** actividad | ❌ decisiones A y B |

### 4.1 · Las dos que hay que leer con cuidado

**La 8 no es una fricción por sí sola.** «Alguien abre una actividad y se va sin
escribir» es lo que hace la mayoría de la gente en cualquier sitio, y en uno de
agenda cultural mirar qué hay es un uso legítimo y completo. El número por sí
mismo no dice nada. Lo que dice algo es la **comparación entre actividades**: si
nueve talleres convierten parecido y uno no, la explicación está en ese uno. Un
tablero que muestre la tasa suelta va a provocar decisiones equivocadas, así que
si esto se construye, se construye como comparación o no se construye.

**La 7 tiene una mitad que no necesita medir a nadie.** «Qué combinación de
filtros deja cero» es en parte derivable del catálogo: los ejes se arman de las
opciones presentes en los datos y ya existe el criterio de no ofrecer un valor
que ninguna actividad usa (`opcionesPresentes`, y su motivo escrito: «ofrecer un
barrio que ninguna actividad usa es ofrecer un filtro que siempre devuelve
cero»). Lo que **no** se deriva es qué combinación **eligió una persona**, que es
la mitad valiosa: un cruce vacío que nadie intentó no es un problema.

### 4.2 · El límite que ninguna de las ocho esquiva

**Con el tráfico que este sitio tiene, la mayoría de las métricas de fricción no
va a alcanzar significancia.** Es el mismo aviso que
[`09-analitica.md`](09-analitica.md) ya se hace sobre el panel —«un ranking con 40
eventos ya dice algo; una tasa de abandono con 6 no»—, y acá pesa más: son 46
actividades y el dominio se conectó hace días.

Eso no es un argumento contra medir. Es un argumento contra **empezar** por lo
que hay que medir: un tablero de visitas que muestre «3» durante dos meses se
deja de abrir, y el que lo abandonó es el mismo que después no va a creerle
cuando el número signifique algo. Las seis primeras filas de la tabla, en
cambio, dicen algo con 46 actividades y dicen algo con 4.

---

## 5 · Leer GA4 desde el panel: lo que cuesta de verdad

El pedido asume que el tablero vive en el panel. Con GA4 como fuente, eso tiene
un costo que conviene medir **antes** de proponerlo, porque no es «una llamada
más».

### 5.1 · El `page_view` automático es la trampa

Es el hallazgo más importante de este documento, y es el que decide la decisión A.

La forma corriente de instalar GA4 es pegar el snippet de `gtag.js`. Ese snippet
manda, **solo**, un `page_view` con `page_location`: la URL completa. En este
sitio, la URL completa de la página que interesa es
`https://agendaleh.ar/actividad/taller-de-cuento-luciano-lamberti/`.

Ese slug **se deriva del título de la actividad**. O sea:

> **Poner el snippet de GA4 en el sitio manda el título de cada actividad a un
> tercero, sin que nadie escriba un `medir()`.**

Es exactamente lo que la salida 4 del §5 prohíbe, y es peor que un descuido de
código: la garantía de `analytics-eventos.ts` —«un `medir()` mal escrito produce
un payload vacío, no una fuga»— **no cubre este caso**, porque el evento no pasa
por `construirEvento`. Lo manda la librería del tercero, con configuración por
defecto, antes de que nuestro código exista.

Y hay un agravante de forma: el sitio público no importa `src/lib/analytics.ts`
ni ninguna de sus garantías. La proyección que hace que la analítica del panel
sea segura es un módulo que este sitio no usa. Si se mide el sitio, esa
proyección hay que **construirla de nuevo del lado público**, con sus propios
tests de centinelas — no se hereda.

Lo que se puede hacer, si la decisión A sale por GA4: apagar el `page_view`
automático (`send_page_view: false`) y mandar solo eventos propios, con un
identificador **opaco** en lugar del slug —el id del documento de Firestore, que
es una cadena aleatoria— y armar el nombre del lado del panel, cruzando contra
Firestore. GA4 vería «se abrió `a7Kd…` 14 veces»; el título nunca sale. Es
honesto decir el otro lado: ese id es un puntero re-identificable **por quien
tenga el mapeo**, y el mapeo es público (el sitio publica slug y título). Así que
no filtra nada que el sitio no publique ya — pero deja de ser cierto que «a GA4
no sale nada que identifique una actividad». Eso es una decisión del dueño, no
una conclusión técnica.

### 5.2 · Lo que cuesta la lectura, pieza por pieza

| Pieza | Por qué hace falta | Costo |
|---|---|---|
| **La Data API de GA4** | GA4 **no se puede consultar desde el navegador**: la API pide credenciales de servidor y no acepta una API key. Y el §5.4 es tajante — `firebase-admin` y cualquier key de cuenta de servicio nunca al bundle del cliente | habilitar `analyticsdata.googleapis.com` |
| **Una Cloud Function nueva** | es el único lugar del proyecto que puede tener credenciales de servidor | +1 Function que hoy no existe, con su región, su despliegue y su presupuesto |
| **Una cuenta de servicio con acceso a la propiedad** | la Function tiene que estar autorizada a leer `G-9CFMHSSGRC` | +1 identidad, y un paso manual en la consola de GA4 (agregar la cuenta como lectora de la propiedad) que solo el dueño puede hacer |
| **Autorizar la Function** | un endpoint que devuelve las métricas del sitio no puede ser anónimo | `onCall` con verificación del claim `admin`, o `onRequest` verificando el ID token. Es la misma superficie que `/reportes` ya tuvo que cuidar |
| **Caché** | la Data API tiene cuotas por propiedad y por día, y un tablero que se abre y se recarga las consume | un documento de caché en Firestore o memoria de la instancia, con su invalidación |
| **Tests** | **GA4 no tiene emulador.** El camino de lectura solo se puede testear contra un doble | los tests dicen que el nuestro parsea bien lo que **suponemos** que devuelve la API, no que la API devuelva eso. Es la clase de test que da verde el día que el contrato cambia |
| **La latencia** | los informes de GA4 tardan **24 a 48 horas** ([`09-analitica.md`](09-analitica.md)) | un tablero recién construido muestra vacío dos días y parece roto. Hay que decirlo en la pantalla |

### 5.3 · Y la pregunta que hay que hacerse antes

**¿El panel necesita ser un cliente de GA4?** GA4 ya tiene una interfaz para
mirar GA4, gratis, sin construir nada, y con exploraciones que el tablero no va a
igualar. Lo que el panel puede dar y GA4 no es lo que GA4 no sabe: **el
catálogo** — qué se ofrece, en qué estado, qué le falta. Cruzar las dos cosas en
una pantalla es valioso; construir una segunda ventana peor a los datos que ya
se pueden ver en la primera, no.

La recomendación de este documento es esa: si algún día se mide, el tablero del
panel muestra **el catálogo** y las **dos o tres métricas de la lista** que
importan de verdad —visitas por actividad y clics en el botón de inscripción—, y
el resto se mira en GA4 o en Search Console. La Data API entra por esas dos o
tres métricas o no entra (**B-374**).

---

## 6 · Las dos decisiones del dueño

Ninguna de las dos la puede tomar un agente. Están redactadas para contestarse.

### Decisión A · ¿Se mide a quien visita el sitio? — B-370

**Por qué es una decisión y no una tarea.** Todo lo que el proyecto mide hoy es
sobre **el propio dueño** usando su propio panel: dos personas conocidas, avisadas
([`09-analitica.md`](09-analitica.md) § «Aviso al otro admin»), sobre su propio
trabajo. Medir a quien visita el sitio es otra cosa: son terceros que no
aceptaron nada, y aparecen el consentimiento, qué se recolecta, cuánto se
guarda y quién lo guarda.

**El antecedente pesa.** La misma pregunta ya se decidió una vez, en otra
ventana: **B-102** («¿el sistema guarda algo de quien se inscribe?») se cerró en
**no**, con este razonamiento: «hoy el sistema no guarda ni un dato personal de un
tercero, y por eso el §5 cabe en una tabla». Medir visitantes no guarda nombres,
así que no es el mismo caso — pero es el mismo eje, y conviene decidirlo con la
misma conciencia.

| | Opción | Qué se gana | Qué cuesta |
|---|---|---|---|
| **A1** | **No medir visitantes.** Search Console (B-373) + el tablero del catálogo | el sitio sigue sin poner una sola cookie y sin mandarle nada a nadie. Cero trabajo nuevo. Se sabe cómo nos encuentra Google | no se sabe qué se mira dentro del sitio, ni si alguien aprieta el botón de inscripción. La pregunta 2 queda sin contestar |
| **A2** | **GA4 con el snippet tal cual** | es media hora de trabajo y contesta las preguntas 1 a 6 | **el slug de cada actividad sale a GA4 en el `page_view` automático** ([§5.1](#51-el-page_view-automático-es-la-trampa)) — o sea el título, derivado, a un tercero. Primera cookie del sitio. Y hay que resolver el consentimiento |
| **A3** | **GA4 con `page_view` apagado y eventos propios con id opaco** | contesta las 1 a 6 sin que un título salga | hay que construir la proyección del lado público, con sus tests de centinelas, porque la del panel no se hereda. Sigue habiendo cookie y sigue habiendo un tercero. El id opaco es re-identificable con un mapeo que es público |
| **A4** | **Medición propia sin cookies** ([§3.4](#34--e--la-medición-propia-sin-cookies-que-es-la-alternativa-real)) | ningún tercero, ninguna cookie, y qué se guarda lo elegimos nosotros. El panel lo lee con una lectura de Firestore | una Function nueva con escritura anónima que hay que acotar, una colección nueva en el §5, y **no hay visitantes únicos ni embudos**: solo eventos contados |

**Recomendación.** **A1 ahora**, y **A4** el día que la pregunta 2 importe de
verdad. Motivo: la única métrica del sitio que cambiaría una decisión es el clic
en el botón de inscripción, y no hace falta GA4 para contar clics. Empezar por
GA4 es pagar una cookie, un tercero y la proyección nueva por seis preguntas de
las cuales cinco son «lindo saberlo».

**Lo que hace falta para contestar:** elegir A1, A2, A3 o A4. Si es A2 o A3, hace
falta además decidir el consentimiento (cartel, o no) — y eso es una pantalla
nueva en un sitio que hoy no tiene ninguna.

### Decisión B · ¿La página de detalle deja de tener cero JavaScript? — B-371

**Por qué es una decisión y no un detalle.** La página de detalle es la que
recibe el tráfico —es la que Google indexa y la que se pega en Instagram— y hoy
son **18 KB de HTML y cero bytes de JavaScript**, verificado en producción. Que
cargue instantáneamente en un celular con mala señal no es un accidente: es
`toPublic` → `detalleDeActividad` → una plantilla que solo acomoda (**D-140**), y
está declarado como virtud.

**Qué se pierde exactamente si se le agrega medición del lado del cliente:**

| Qué se rompe | Cuánto |
|---|---|
| **«Cero JavaScript» deja de ser cierto** | y es una frase que hoy se puede decir sin asterisco. El snippet de GA4 son ~90 KB de JS de terceros; un contador propio, unos cientos de bytes |
| **Una petición más a un tercero** | con su resolución DNS y su conexión, en la página que se abre desde un celular en la calle |
| **La primera cookie del sitio** | solo en A2 y A3. En A4 no hay cookie |
| **Un ad blocker cambia el resultado** | una parte del tráfico no se va a medir, y no una parte al azar: justo la más técnica. Cualquier número va a estar por debajo del real, y no hay forma de saber cuánto |
| **La superficie de auditoría crece** | hoy `tests/pagina-de-detalle.test.ts` puede afirmar que la plantilla no tiene más que su view-model. Con un script adentro, hay que auditar también qué manda ese script |

**Las alternativas que no rompen nada, para que la decisión no sea binaria:**

| | Alternativa | Contesta | Qué respeta |
|---|---|---|---|
| **B1** | **No medir la página de detalle.** Medir solo la home, que ya tiene una island | 3, 4, 5, 6 | el detalle sigue sin JS. **Se pierde la 1 y la 2**, que son las dos que importan |
| **B2** | **Medir solo el clic**, con un `<a>` que pase por un redirector nuestro en lugar de un script | 2 | cero JS. A cambio, el link de inscripción deja de ser directo: un salto más, y si el redirector se cae, el botón se cae |
| **B3** | **Un script propio mínimo**, `defer`, sin dependencias, que manda un `fetch` a la Function de A4 | 1, 2 | unos cientos de bytes, ningún tercero, ninguna cookie. Es el punto medio real |
| **B4** | **El snippet de GA4** | 1 a 6 | nada de lo de arriba |

**Recomendación.** **B1 mientras la decisión A sea A1** (no hay nada que medir),
y **B3** si se elige A4. B2 es ingenioso y no lo recomiendo: mete un punto de
falla en el único botón que el sitio necesita que funcione.

---

## 7 · El primer tramo, el que se implementó

**«Estado del catálogo»**, una vista nueva del panel. El criterio de por qué es
éste y no otro está en **D-200**.

Es el único tramo del documento que se puede construir hoy y que es claramente
seguro:

- **no mide a ningún visitante** — no existe el visitante en este tramo;
- **no toca el sitio público** — ni un byte, ni un `<script>`, ni una cookie;
- **no manda nada a ningún tercero** — nada sale del navegador del dueño;
- **no cuesta una lectura de Firestore de más** — es la misma lectura de
  `/actividades` que el listado ya hace, agrupada de otra manera;
- **y contesta las preguntas 8, 9 y 10 y seis de las ocho fricciones**, que son
  las que se convierten en trabajo del día siguiente.

### 7.1 · Qué muestra

Tres bloques, en este orden, que es el de lo que hay que hacer primero:

1. **Los avisos** — las seis fricciones detectables del [§4](#4--las-fricciones-a-detectar-traducidas), cada una con las
   actividades que la disparan y un link para abrirlas. Es lo primero porque es
   lo accionable. Si no hay ninguno, lo dice.
2. **El reparto** — cuántas actividades hay por estado, por tipo, por arancel y
   por forma de cursar; cuántos ciclos y cuántas sueltas; cuántos encuentros
   por venir y cuántos en los próximos 30 días.
3. **Lo que se publica, completo o no** — de las publicadas: cuántas con flyer,
   cuántas con etiquetas, cuántas con descripción suficiente. Es el termómetro
   de B-264 («2 de 42 con imagen») **medido exactamente**, y no estimado desde un
   cruce de GA4.

### 7.2 · Dónde vive

| Pieza | Archivo | Qué es |
|---|---|---|
| El cálculo | `src/lib/estadoDelCatalogo.ts` | **puro**. Recibe `ActividadConId[]` y un reloj, devuelve el estado. No sabe de React, ni de Firestore, ni de pantallas |
| La pantalla | `src/components/admin/EstadisticasPanel.tsx` | lee `/actividades` en vivo, como las otras vistas del panel, y acomoda |
| Los gráficos | el mismo componente | **barras de CSS**, sin ninguna dependencia nueva. Cada barra lleva su número escrito al lado: el gráfico ayuda, no informa solo |
| La entrada | `src/components/admin/AdminApp.tsx` | una vista más del router propio, **diferida** por `import()` como las otras cinco (el corte de bundle de B-09 / B-117) |
| Los tests | `tests/estado-del-catalogo.test.ts` | el módulo puro, caso por caso, más un barrido de que la vista no manda nada a la analítica que no sea su enum |

### 7.3 · Lo que este tablero deliberadamente no hace

- **No tiene serie temporal.** Es una foto de hoy, no una tendencia: para decir
  «hace un mes había 3 sin flyer y hoy hay 12» hay que guardar la foto, y eso es
  una colección nueva → **B-377**.
- **No calcula del lado del servidor.** Agrupa 46 documentos en el navegador, que
  es instantáneo. Con unos miles conviene un agregado → **B-376**.
- **No manda nada a GA4** más allá de un valor de enum que dice que la pantalla se
  abrió (`funcion_usada` con `funcion: estadisticas-abrir`). Ese evento existe
  para contestar la única pregunta que decide si vale construir la otra mitad:
  **¿alguien abre el tablero?** Si nadie lo abre, la Function de la Data API no
  vale lo que cuesta.

---

## 8 · Lo que queda escrito y no hecho

Con su número de backlog, para que este documento no sea el final del rastro.

| Ítem | Qué es | Bloqueado por |
|---|---|---|
| **B-370** | Decisión A: ¿se mide a quien visita el sitio? | el dueño |
| **B-371** | Decisión B: ¿la página de detalle deja de tener cero JavaScript? | el dueño |
| **B-372** | El clic en el botón de inscripción — la única métrica del sitio que cambiaría una decisión | B-370 y B-371 |
| **B-373** | **Search Console**: conectar el dominio y leerlo. No mide a nadie, no pone cookies, no necesita ninguna decisión | nada. Es lo que conviene hacer primero |
| **B-374** | La Function que lee la Data API de GA4 desde el panel | B-370, y solo si sale A2 o A3 |
| **B-375** | Medir los filtros del sitio: cuál se usa y qué combinación deja cero | B-370 |
| **B-376** | El tablero del catálogo agrupa en el navegador; con miles de actividades conviene un agregado | volumen |
| **B-377** | El tablero es una foto y no una serie: guardar la foto para poder ver la tendencia | — |

---

## Ver también

- [`09-analitica.md`](09-analitica.md) — la analítica del **panel**: ocho eventos,
  su vocabulario y la garantía de que no sale contenido. Es el estándar que
  cualquier medición nueva tiene que cumplir.
- [`07-seguridad.md`](07-seguridad.md#analítica-del-panel) — la salida 4 y cómo se
  verifica.
- [`12-sitio-publico.md`](12-sitio-publico.md) §11.1 — la decisión 4 del dueño,
  que es la decisión A de acá con menos letra.
- [`06-decisiones.md`](06-decisiones.md) — **D-200** (por qué el tablero arranca
  por el catálogo) y **D-201** (por qué «poner gtag» no es la opción barata).
