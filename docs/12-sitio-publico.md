# Sitio público — diseño

Diseño del paso 3 del [§10](../CLAUDE.md#10-orden-de-implementación): el sitio
que la gente encuentra en Google. Es el ítem **B-01** del
[backlog](BACKLOG.md), desarmado acá en piezas construibles
(**B-105** a **B-114**).

**Este documento es de diseño, no de implementación.** Hay decisiones tomadas, con
su motivo, para que quien lo construya no tenga que volver a decidir nada. Los
fragmentos de código son ilustrativos.

> ## Qué de todo esto ya está construido (B-227, 2026-08-28 · B-247, 2026-08-31)
>
> Salió el primer frente: **el listado con búsqueda, filtros y orden**, y **la
> página de detalle**. Lo que hace hoy está en
> [`04-funcionalidades.md`](04-funcionalidades.md); acá queda el diseño completo,
> que sigue siendo la referencia de lo que falta.
>
> | Sección | Estado |
> |---|---|
> | §3 los datos · §3.2 credenciales | ✅ — las tres salidas del build salen de **un solo lector**, `src/lib/contenidoDelSitio.ts`. Desde B-110 son **dos queries** —una por estado— y no la lectura única que dibuja el §3; ver el desvío 7 |
> | §4.1 home · §4.2 tarjeta | ✅ — la tarjeta se regrilló en B-247, con el desvío 5 de abajo (**D-142**) |
> | §4.3 detalle | ✅ — menos la barra fija de móvil y el botón «Compartir» |
> | §4.4 hubs — `/tipo/*`, `/barrio/*`, `/online`, `/gratis` | ✅ — **B-108**, cerrado el 2026-09-02. Un solo componente (`hubsPublicos.ts` + `CuerpoDeHub.astro`) para las cuatro clases, con `esIndexable` fijando que `noindex` y "fuera del sitemap" sean las dos mitades de la misma señal, y la tira «Explorá por» (`ExploraPor.astro`) como el único enlace interno que un hub tiene |
> | §2.2 y §4.4 — las **páginas de mes** `/agenda/{aaaa-mm}` | ✅ — **B-113**, con las cuatro condiciones del §2.2 y cuatro desvíos escritos en **D-155**. Sus **dos** entradas están desde **B-280** (2026-09-02): la tira de la home y el enlace «Más en septiembre» del detalle |
> | §4.5 pasadas, calendario, acerca, 404 | ✅ **completo desde el 2026-09-03** — `/suscribirse` es el «calendario» (**D-134**), `/pasadas` está construida (**B-109**, con dos desvíos en **D-167**), el rol de `/acerca` se repartió entre `/ayuda` y `/contacto` (**B-232**, **B-233**) y **`/404` entró con B-310**, con un desvío en **D-380**. Los nombres del §2 y del §4.5 se corrigieron contra las rutas reales el 2026-09-02 (**B-234**) |
> | *(fuera del diseño original)* `/cartelera` | ✅ — la pared de afiches, **B-265**. No estaba en este documento: nació de que el flyer es el medio de difusión del circuito y el sitio lo mostraba en un solo lugar. Ver **D-148** |
> | §5 SEO | 🟡 **casi** — `<title>`, `meta description`, JSON-LD `Event`, y desde **B-109** el `canonical` absoluto, el Open Graph, el `sitemap.xml` y el `robots.txt`. **Desde B-107 (2026-09-02)** también el `BreadcrumbList` del detalle y el `CollectionPage`/`ItemList` de la home y los cuatro hubs del §5.5, y **desde B-112 (2026-09-03)** el `lastmod` de cada actividad, recortado al día (D-138). Lo único que falta es lo que no depende del dominio: las cinco imágenes de `public/og/` (**B-291** — hoy el `og:image` es el flyer en el detalle y la marca en el resto) |
> | §6 filtros | ✅ — con los desvíos de abajo |
> | §7 casos incómodos | ✅ — §7.3 (canceladas) entró con **B-110**, con el desvío 7 de abajo; la mitad de §7.1 que vive en `/pasadas` y la ventana de 90 días del sitemap entraron con **B-109**. El §7.6 tiene el mismo desvío que el §4.2 (**D-142**) |
> | §8 mobile | ✅ — una columna, chips con scroll, 44px y `pb-segura`; el panel de filtros dejó de comerse la pantalla en B-247 (**D-143**) y desde **B-238** (2026-09-03) es una hoja modal de verdad; el **CTA fijo** del detalle se resolvió sin capa modal en **D-145** |
> | §10 accesibilidad | ✅ |
>
> **Los siete desvíos, todos con su decisión escrita:**
>
> 1. **Hay selector de orden**, y §6.1 decía que no — **D-137**.
> 2. **`online.url` no sale al detalle** ni con `urlPublica: true`, o sea más
>    estricto que lo que dice §4.3 — **D-139**.
> 3. ~~**El panel de filtros es un *disclosure* inline y no una hoja modal**
>    (§8). Un diálogo modal necesita trampa de foco, cierre con `Escape`, click
>    en el fondo y `pushState`; un disclosure no necesita nada de eso y no tiene
>    cómo salir mal. La hoja queda en **B-238**, para hacerla bien y de una
>    vez.~~ **Cerrado el 2026-09-03 — B-238.** Ya no es un desvío: el panel del
>    teléfono es una hoja modal, con las cuatro cosas que ese párrafo pedía.
> 4. **La island renderiza su propia lista** en vez de mostrar y ocultar las
>    tarjetas del HTML por `data-id` (§6.3). Se conserva todo lo que esa sección
>    perseguía —el HTML completo del build, sin-JS servido, sin parpadeo, **un
>    solo** markup de tarjeta— pero por otro camino: la island **saca del DOM** la
>    lista del build cuando tiene el índice y monta la suya con el mismo
>    componente React. Sin `<template>`, sin reordenar nodos a mano, y con el
>    filtrado testeado como lógica pura. El costo, dicho: el runtime de React
>    viaja a la home (**B-239**).
> 5. **Sin imagen, la tarjeta ya no deja el hueco: genera una portada** (§4.2,
>    §7.6). Los dos apartados decían que la tarjeta sin portada no reserva la
>    columna y que no hay placeholder — correcto para la tarjeta horizontal de una
>    columna, falso desde que hay grilla: con las celdas a la misma altura, la
>    mitad sin portada se ve rota y no distinta. Lo que **no** cambió es lo que esos
>    apartados rechazaban: no hay placeholder gris, ni ícono, ni iniciales, ni foto
>    de stock — hay una portada tipográfica sobre el color del tipo. **D-142**.
> 6. **El panel de filtros de móvil no era la hoja inferior** del §8 cuando se
>    escribió esto —quedó en **B-238**, cerrado el 2026-09-03— pero ya entonces
>    había dejado de comerse la pantalla: «Cuándo» se fue adentro, topea a
>    `65svh` con scroll propio, y cierra desde abajo con «Ver N actividades»
>    devolviendo el foco al abridor. Las tres cosas siguen valiendo tal cual:
>    B-238 construyó la capa modal **encima** de este trabajo, no en su lugar.
>    **D-143**.
> 7. **El lector hace dos queries y no una, y «estuvo publicada alguna vez» se
>    prueba por el historial** (§3, §7.3). El diagrama del §3 dibuja un
>    `where('estado','in',['publicado','cancelado'])`; el código lo evita a
>    propósito, porque un `in` convierte el estado en una lista y a una lista
>    alguien le agrega un elemento. Y la heurística que el §7.3 propone —que alguna
>    sesión conserve `calendarEventId`— **no sobrevive en producción**: el sync la
>    borra al cancelar. **D-159**.

Restricciones que **no** se revisitan acá: Astro estático (§2.3), el JSON lo
genera el build y no una Function (§2.4), la búsqueda y el filtrado son en
memoria del cliente sin Algolia (§2.5), y lo que no está en
[`toPublic.ts`](../src/lib/toPublic.ts) no existe para el sitio (§5). Donde el
diseño necesita un dato que hoy no se proyecta, está anotado en
[§11](#11-lo-que-falta-decidir) como cambio a decidir, no dado por hecho.

---

## 1. A quién le hablamos

El sitio no tiene un usuario, tiene tres recorridos, y **el más importante no
empieza en la home**.

### Recorrido A — cae del buscador en una página de detalle (el mayoritario)

Googlea `club de lectura online`, `taller de escritura villa crespo`,
`taller de poesía a la gorra` y aterriza en `/actividad/{slug}`. No sabe qué es
este sitio ni le importa. Tiene una sola pregunta, y tiene tres segundos:
**¿esto me sirve y todavía puedo entrar?**

Las cinco cosas que tienen que estar sin hacer scroll:

1. **Qué es** — título y tipo ("Taller de escritura").
2. **Cuándo** — la próxima fecha en palabras ("miércoles 24 de septiembre,
   19:00"), no un rango ISO.
3. **Dónde** — barrio y ciudad, o "Online por Zoom".
4. **Cuánto** — "Gratis" / "A la gorra" / "Arancelado".
5. **Cómo entro** — un botón, con el verbo de la vía real
   ("Escribir por WhatsApp", "Mandar un mail", "Anotarme en el formulario").

Recién después: la descripción larga, quién lo da, la lista de encuentros, el
material, cómo llegar.

**Lo que lo lleva al resto del sitio** no es un menú: es el pie de la propia
actividad, que responde la pregunta siguiente. Si le sirvió pero no puede ese
día, o si ya pasó, quiere *otra parecida*: tres bloques de "más de esto" —
mismo tipo, mismo barrio, mismo organizador — con links a las páginas hub. Ese
es el único mecanismo de descubrimiento que funciona cuando la entrada es
lateral.

### Recorrido B — viene de un link de Instagram

Toca el link de la bio o de una historia, en el navegador embebido de
Instagram, en un teléfono. Ya está medio convencido: vio el flyer. Necesita
**la fecha y el botón**, en la primera pantalla, con el pulgar. Y necesita que
la vista previa del link (`og:image`, `og:title`) no sea un rectángulo gris: eso
decide si el link se toca o no.

### Recorrido C — quiere ver qué hay

Entra a la home o vuelve. Quiere barrer: "qué hay este mes", "qué hay gratis",
"qué hay en mi barrio". Este es el único recorrido que usa los filtros, y es el
menos frecuente de los tres — razón por la que el listado no puede ser lo único
que exista.

---

## 2. Mapa de URLs

> ⚠️ **Corregido el 2026-09-02 contra las rutas reales — B-234.** Este mapa
> nombraba tres páginas que se construyeron con otro nombre o con otro reparto, y
> se le había caído una que nació después:
>
> | El diseño decía | La ruta real | Dónde está el motivo |
> |---|---|---|
> | `/calendario` | **`/suscribirse`** | **D-134** (B-230) |
> | `/acerca` | **`/ayuda`** + **`/contacto`** — el rol se repartió en dos | B-232, B-233 |
> | *(no estaba)* | **`/cartelera`**, la pared de afiches | **D-148** (B-265) |
> | `/404` | ~~**no existe todavía**~~ → **`/404.html`**, construida el 2026-09-03 | **B-310**, con **D-380** |
>
> La fuente de verdad de qué páginas hay es `src/pages/`, y la de qué se le ofrece
> al buscador es `RUTAS_FIJAS` (`src/lib/sitemap.ts`) — con un test que exige que
> toda página estática esté en esa lista **o** exceptuada con su motivo, así que la
> próxima no se puede olvidar (B-109).

**Trece patrones de ruta de página, todos estáticos: ocho construidos, los cuatro
hubs de B-108 y el `/404` de B-310.** Ninguno se genera si quedaría vacío — salvo
el `/404`, que no puede quedar vacío porque no depende de los datos.

| URL | Qué renderiza | De dónde salen los datos |
|---|---|---|
| `/` | Listado de las actividades vigentes, completo, en HTML. Island de filtros encima. | Build: `estado == 'publicado'`. La island: `events.json` |
| `/actividad/{slug}` | Detalle de una actividad. **Cero JavaScript.** | `getStaticPaths` sobre publicadas + canceladas-que-fueron-publicadas |
| `/tipo/{slug}` | Hub por tipo: talleres, clubes de lectura, etc. | Build, filtrando por `tipo`. Un hub por slug de `/opciones/tipo` con actividad vigente |
| `/barrio/{slug}` | Hub por barrio | Build, filtrando por `sede.barrio`. Un hub por slug de `/opciones/barrio` con actividad vigente |
| `/online` | Hub de lo que se hace a distancia (`virtual` + `hibrido`) | Build |
| `/gratis` | Hub de lo que no se paga (`gratis` + `a-la-gorra`) | Build |
| `/agenda/{aaaa-mm}` | Qué hay en un mes | Build. Solo meses vigentes con **3 o más** actividades |
| `/pasadas` | Archivo: lo que ya pasó, por mes, de lo más reciente a lo más viejo | Build |
| `/cartelera` | La pared de afiches: solo las actividades con flyer, la imagen entera | Build. **No estaba en este diseño** — D-148 |
| `/suscribirse` | Cómo suscribirse al Google Calendar público. **Era `/calendario`** — D-134 | Estático, escrito a mano (`src/lib/enlaces.ts` pone las direcciones) |
| `/ayuda` | Qué es esto, qué tipos de actividad hay, cómo se lee una ficha | Estático (`src/lib/ayudaDelSitio.ts`) |
| `/contacto` | El canal para proponer una actividad y qué conviene contar. **`/ayuda` + `/contacto` son el reparto de `/acerca`** | Estático (`src/lib/contactoDelSitio.ts`) |
| `/events.json` | El índice que la island filtra en memoria (§2.5) | Build (ver [§3](#3-los-datos)) |
| `/sitemap.xml` · `/robots.txt` | Para el buscador | Build (B-109) |
| `/404.html` | La dirección que no existe: buscador, la tira de hubs y el enlace al archivo. **Cero JavaScript.** Firebase la sirve como cuerpo de cualquier ruta que no encuentre (B-310) | Build. La tira sale de `exploracionDeLaHome`; las frases, de `src/lib/noEncontrado.ts` |

Sin cambios: `/admin` y `/admin/**` (panel, `noindex`), `/version.json`.

> ✅ **`/404` construida el 2026-09-03 — B-310.** Era la única fila tachada de esta
> tabla. Astro emite la página como `dist/404.html` en la raíz —su caso especial
> para 404 y 500, incluso con `build.format` en `directory`— que es exactamente
> el nombre que Firebase Hosting busca, así que no hizo falta ninguna `rewrite`.
> **Y eso vuelve al nombre del archivo el cableado entero:** renombrarlo apaga la
> página sin romper el build ni ningún test de contenido, así que
> `tests/no-encontrado.test.ts` lo verifica sobre `dist/`.
>
> Con esto el conteo de arriba pasó de **doce a trece**. Es el único patrón de la
> tabla que va con `noindex` y fuera del `sitemap.xml` (§5.1), y las dos mitades
> de esa señal están atadas: la excepción de `tests/sitemap.test.ts` lleva su
> motivo escrito, que es lo que ese test exige para dejar nacer una página fuera
> del sitemap.

### 2.1 Por qué cada hub es una URL y no un filtro

La regla que se aplicó: **una sección merece URL propia si alguien la teclea en
Google como frase y si el contenido resultante es distinto, no un subconjunto
arbitrario.**

- **`/tipo/{slug}`** — `taller de escritura`, `club de lectura` son *la* consulta
  del dominio, no un refinamiento de otra. Además `tipo` es taxonomía
  autogestionada (§4): los hubs se generan recorriendo `/opciones/tipo`, así que
  un tipo nuevo trae su hub solo, sin tocar código. El slug de la URL es el slug
  de la taxonomía (`/tipo/club-lectura`), no el label: el label se puede
  renombrar (§4.1) y una URL no (trampa 10).
- **`/barrio/{slug}`** — es la long tail que más importa: `taller de escritura
  villa crespo` es una consulta con intención altísima y competencia baja. Un
  filtro no puede ganarla porque no tiene título, ni `h1`, ni URL.
- **`/online`** — `club de lectura online` es la consulta que trae gente de todo
  el país, no solo de una ciudad. Es el hub con más alcance posible.
- **`/gratis`** — "qué hay gratis" es una intención propia y estable. Junta
  `gratis` y `a-la-gorra` a propósito: en el circuito literario "a la gorra" es
  la mitad de los casos (§4.1) y para quien busca cae del mismo lado. El texto
  de la página aclara la diferencia.
- **`/agenda/{aaaa-mm}`** — con reserva. Ver [2.2](#22-la-regla-de-las-tres).
- **`/pasadas`** — no es para el buscador: es para que **ninguna página de
  detalle quede huérfana**. Una actividad que pasó sale del listado y de los
  hubs; si nada la enlaza, su única entrada es el sitemap, y una página sin links
  internos vale casi nada. `/pasadas` le da un link permanente a cada una.

### 2.2 La regla de las tres

`/agenda/2026-09` es la más floja de las secciones: su contenido es un
subconjunto del de la home y su consulta (`agenda literaria septiembre`) es de
volumen bajo. Se incluye igual porque "qué hay este mes" es una forma real de
mirar la agenda, pero **acotada**:

- Solo se genera el mes en curso y los siguientes, nunca meses pasados.
- Solo si el mes tiene **3 o más** actividades. Con menos, la página sería un
  casi-duplicado de la home y no aporta: el link va a la home con el filtro de
  mes preaplicado (`/?mes=2026-09`).
- No va en la navegación. Se llega desde una tira "Próximos meses" al pie de la
  home y desde el detalle ("más en septiembre").
- Cuando el mes termina, el mes siguiente ya no lo genera. **La URL vieja no se
  rompe:** el build emite la página del mes pasado una última vez con un aviso
  "este mes ya pasó" y link a `/pasadas`, y sale del sitemap. Nunca un 404 sobre
  una URL que estuvo indexada.

> ⚠️ **Construida el 2026-09-01 (B-113), con cuatro desvíos — ver D-155 en
> [`06-decisiones.md`](06-decisiones.md).** Las cuatro condiciones de arriba se
> cumplen tal cual. Lo que cambió es cómo se bajan tres cosas que este documento
> da por construidas y todavía no lo están: el aviso del mes vencido manda a `/` y
> no a `/pasadas` (no existe — B-109, y queda anotado como **B-281**), «sale del
> sitemap» se implementó como `noindex` porque sitemap tampoco hay, y la tira de
> la home incluye el **mes en curso** además de los siguientes, para que su página
> no quede sin ningún link interno. El cuarto desvío es del §7.5 y está abajo.
>
> **Dos de esos tres se cerraron el 2026-09-02 con B-109:** el aviso del mes
> vencido manda a `/pasadas`, que ya existe (era **B-281**), y «sale del sitemap»
> es literal — el sitemap sale de `mesesEnlazables`, que deja afuera las vencidas.
> El `noindex` **se queda**: no era el sustituto, es la otra mitad. El sitemap dice
> qué se ofrece y el `noindex` dice qué no se indexa si alguien llega igual, y a
> una página vencida se llega con el link que ya tenía.

### 2.3 Lo que decidimos que **no** es URL

| Idea | Por qué queda como filtro y no como página |
|---|---|
| Modalidad presencial | No hay consulta "taller presencial": la intención presencial se expresa con el barrio o la ciudad, que ya tiene hub |
| Cada tipo de arancel (`/arancel/{slug}`) | `arancelado`, `beca-parcial`, `bono social` no son consultas. Solo "gratis" lo es |
| Tags / temas (`/tema/{slug}`) | Las etiquetas hoy están sin normalizar (**B-05**) y sin UI de administración (**B-06**): un typo se convertiría en una URL indexada para siempre. Depende de que eso se arregle primero |
| Organizador (`/organiza/{slug}`) | `organizador` es texto libre sin slug: dos cargas del mismo taller con "Casa Brandon" y "casa brandon " serían dos páginas. Necesita un cambio de modelo — ver [§11](#11-lo-que-falta-decidir) |
| Tallerista / autor | Igual que organizador, y además con datos personales de terceros: una página propia por persona es una decisión con más implicancias que un filtro |
| Ciudad | Hoy `sede.ciudad` es texto libre (no es taxonomía). Cuando lo sea, `/ciudad/{slug}` es el hub más valioso después de barrio |
| Búsqueda (`/buscar?q=`) | Un sitio estático no puede responder una consulta arbitraria en el servidor, y las páginas de resultados no se indexan de todas formas. La búsqueda vive en la home, en el cliente |

---

## 3. Los datos

Tres artefactos salen del build, con **un solo lector** de Firestore.

> ⚠️ **El `where('estado','in',[…])` del diagrama no es lo que se implementó, y es
> a propósito — B-110, D-159.** Son **dos queries**, una con `== 'publicado'` y
> otra con `== 'cancelado'`, y sus resultados van a dos campos distintos. Un `in`
> convierte el estado en una lista, y a una lista alguien le agrega un elemento; con
> dos `==` no hay lista que crecer, y lo peor que puede hacer un error en la
> segunda es no generar ninguna página de cancelada. Hay además una tercera
> lectura, **condicional y solo para las canceladas**, contra
> `/actividades/{id}/versiones` — ver el §7.3.

```
                    ┌──────────────────────────────────┐
   build de Astro   │ adminDb()                        │
   (Admin SDK)      │  .collection('actividades')      │
                    │  .where('estado','in',           │
                    │    ['publicado','cancelado'])    │
                    │ + /opciones/{tipo,barrio,arancel, │
                    │             tags,plataforma}     │
                    └───────────────┬──────────────────┘
                                    │  toPublic(a, id)   ← §5.2, la frontera
                    ┌───────────────┼──────────────────┐
                    ▼               ▼                  ▼
            dist/actividad/    dist/index.html    dist/events.json
              {slug}/          + hubs + agenda    (índice de la island)
            (HTML completo)    (HTML completo)
```

### 3.1 La frontera de privacidad es `toPublic`, y el listado recorta todavía más

`toPublic.ts` decide **qué puede ser público** (§5). El build, además, decide
**qué necesita el listado**, que es menos. Son dos filtros en serie, no uno.

`events.json` no lleva `descripcion`, ni `sede.direccion`, ni `sede.geo`, ni
`sede.indicaciones`, ni `inscripcion.destino`, ni `material`, ni
`sesiones[].tema`, ni `sesiones[].lectura`, ni `tallerista.bio`. Nada de eso se
usa para filtrar ni para pintar una tarjeta, y todo vive en el HTML de la página
de detalle, que es donde hace falta.

Dos ventajas, en este orden:

1. **Menos superficie scrapeable.** Hoy la proyección publica
   `inscripcion.destino` (un mail o un WhatsApp) y el §5.1 ya advierte que queda
   expuesto a bots. Sacarlo del JSON no lo esconde —está en el HTML— pero deja
   de servirlo en bandeja, en lote y en un solo GET.
2. **Peso.** El campo caro es `descripcion`, y `searchText` ya lo contiene
   normalizado (§6). Mandar los dos es mandar la descripción dos veces.

Forma de una entrada de `events.json` (ilustrativo):

```json
{
  "id": "abc123",
  "slug": "taller-de-cronica-en-boedo",
  "titulo": "Taller de crónica",
  "tipo": "taller",
  "resumen": "Ocho encuentros para escribir una crónica de barrio…",
  "imagenUrl": "https://…/flyer.jpg",
  "modalidad": "presencial",
  "modalidades": [{ "id": "mod_…", "modalidad": "presencial", "sede": { "…": "…" } }],
  "sede": { "nombre": "Casa Brandon", "barrio": "boedo", "ciudad": "CABA" },
  "arancel": { "tipo": "a-la-gorra" },
  "organizador": "Casa Brandon",
  "tallerista": "Ana Ruiz",
  "tags": ["cronica", "no-ficcion"],
  "destacado": false,
  "esCiclo": true,
  "estado": "publicado",
  "sesiones": [
    { "inicio": "2026-09-03T22:00:00.000Z", "fin": "2026-09-04T00:00:00.000Z", "cancelada": false }
  ],
  "inscripcion": { "requiere": true, "cupo": 12, "cierraEn": "2026-09-01T02:59:00.000Z" },
  "searchText": "taller de cronica ocho encuentros … casa brandon boedo ana ruiz"
}
```

Notas que importan:

- **`resumen`** son los primeros ~160 caracteres de `descripcion`, cortados en
  límite de palabra. Se calcula en el build; no es un campo nuevo del modelo.
  Sirve para la tarjeta y como `meta description` de la página de detalle.
- **`organizador` y `tallerista` son strings** en el JSON (solo el nombre): el
  Instagram y la bio son de la página de detalle.
- **`imagenUrl` en el índice es un derivado, no el campo del modelo** (B-223). El
  modelo no tiene un campo único de imagen desde **D-125**: tiene
  `imagenes: Imagen[]` con un flag `portada`. El índice lleva **una** URL porque
  el listado necesita una sola imagen, y la saca de la portada
  —`imagenUrl: portadaDe(a.imagenes)?.url ?? null`, `src/lib/eventsJson.ts`—
  conservando el nombre que este documento le había puesto. O sea que el nombre
  del campo del JSON es correcto y el del modelo ya no existe: donde este
  documento dice «imagen de la actividad», leer «la portada de su galería».
- **`cierraEn` en vez de `abierta`.** Ver [§11.2](#112-cambios-a-topublicts): el
  booleano `abierta` que hoy calcula `toPublic` se congela en el momento del
  build y miente hasta el rebuild siguiente.
- **`modalidad` es el derivado y `modalidades` es la lista** (B-224, D-130). El
  índice del listado puede quedarse con el derivado —el chip del filtro es uno
  solo— pero la **página de detalle necesita la lista**: es donde se dice «los
  martes presencial en la librería, los jueves por Meet». Las **fechas** de cada
  fila hoy no salen de `toPublic` (decisión pendiente del dueño en B-224), así que
  cuando se decida hay que revisar si el detalle las quiere.
- **`sesiones` viene ordenado por `inicio`.** El array del documento no garantiza
  orden (el formulario permite agregar filas en cualquier orden); ordenarlo es
  del build, una vez, y no de cada consumidor.
- **Las opciones viajan en el mismo archivo** (§4.4), con `slug` y `label`, para
  que los chips de filtro no tengan nada cableado. Y con `tono` cuando alguien le
  eligió color a esa categoría (**D-150**): el caso normal es que no esté, porque el
  color se deriva del slug con la misma función en el build y en el cliente.

```json
{
  "generadoEn": "2026-08-21T18:04:00.000Z",
  "version": "1.0.1+a1b2c3d",
  "opciones": {
    "tipo": [{ "slug": "taller", "label": "Taller" }],
    "barrio": [],
    "arancel": [],
    "tags": []
  },
  "actividades": []
}
```

`version` es la misma que estampa `scripts/version.mjs`, para poder mirar un
`events.json` en producción y saber de qué build salió.

### 3.2 Un build sin credenciales no puede publicar un sitio vacío

`hayCredenciales()` ya existe en `firebase-admin.ts`. La regla, que no cambió:

- **En CI (`process.env.CI`), sin credenciales el build falla.** Un deploy con
  cero actividades borra el sitio entero de Google, y se recupera en semanas.
- **En local, sin credenciales el build sigue** con lista vacía y un aviso en
  consola, para poder trabajar el CSS sin emuladores.

**Quién implementa cada mitad** (B-189, D-123, cerrado el 2026-08-26):

- Las dos cláusulas de arriba las decide **el lector de Firestore** —el que arme
  el `events.json`—, porque "seguir con lista vacía" es una respuesta que solo
  puede dar él: es su valor de retorno. Va a ser cuatro líneas al principio de
  esa función:

  ```ts
  if (!hayCredenciales()) {
    if (process.env.CI) throw new Error('build sin credenciales en CI');
    console.warn('build sin credenciales: 0 actividades');
    return [];
  }
  ```

- Y detrás hay una **red que ya está puesta**: `adminApp()` tira si no hay
  credenciales, así que un consumidor que se olvide del chequeo de arriba —el
  patrón que dejó esta guarda apagada un mes— se encuentra un error claro en vez
  de leer cero documentos en silencio. Es la puerta única a Firestore en build
  time (§5.4), así que no se puede esquivar por olvido.
  `tests/build-credenciales.test.ts` fija las dos cosas: que la puerta tire, y
  que nada más en `src/` importe el Admin SDK por su cuenta.

### 3.3 Estados y qué se genera con cada uno

| `estado` | ¿Entra a `events.json`? | ¿Tiene página de detalle? | ¿En el sitemap? |
|---|---|---|---|
| `publicado`, con sesiones futuras | sí | sí | sí |
| `publicado`, todo pasado | sí, marcado como pasada | sí | sí, hasta 90 días después de la última sesión |
| `cancelado`, **que estuvo publicada** | no | sí, marcada CANCELADA | sí, 30 días; después se saca |
| `cancelado`, que nunca se publicó | no | **no** | no |
| `borrador`, `pendiente` | no | no | no |

Que una actividad cancelada conserve su página es deliberado y es la decisión
menos obvia del documento: ver [§7.3](#73-una-actividad-cancelada).

---

## 4. Pantalla por pantalla

Lenguaje visual: el que ya existe en
[`global.css`](../src/styles/global.css) — papel (`--color-papel`), tinta
(`--color-tinta`), un solo acento (`--color-acento`), Lora para títulos, Inter
para el resto. Sin rediseño de marca, sin sombras, sin gradientes. Los bordes
son líneas de 1px en `--color-borde`. Las fechas y los datos duros van en Inter;
los títulos y el nombre de la actividad, en Lora.

### 4.1 Home — `/`

Orden de prioridad visual, de arriba abajo:

```
┌──────────────────────────────────────────────────────────┐
│ Agenda literaria            Talleres · Clubes · Online · │  ← cabecera fina,
│                             Gratis · Calendario          │    no fija
├──────────────────────────────────────────────────────────┤
│  Talleres, clubes de lectura y encuentros en Argentina   │  ← h1 en Lora, 2 líneas
│  38 actividades con fecha próxima                        │  ← el número, del build
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │ 🔍 Buscar por título, barrio, tallerista…          │  │  ← input, foco NO automático
│  └────────────────────────────────────────────────────┘  │
│  [Próximas ▾] [Todos los tipos ▾] [Cualquier lugar ▾]    │  ← 3 filtros primarios
│  Más filtros ▾                                           │
├──────────────────────────────────────────────────────────┤
│  DESTACADAS  (solo si hay; máximo 3, en una tira)        │
├──────────────────────────────────────────────────────────┤
│  SEPTIEMBRE                                              │  ← separador de mes,
│  ┌───────┬────────────────────────────────────────────┐  │    en versalitas
│  │ imagen│ mié 3 · 19:00           TALLER · A la gorra│  │
│  │  o    │ Taller de crónica                          │  │  ← título en Lora
│  │ nada  │ Casa Brandon · Boedo, CABA                 │  │
│  │       │ Ciclo de 8 encuentros · hasta el 22 de oct │  │
│  └───────┴────────────────────────────────────────────┘  │
│  … (todas las actividades vigentes, sin paginar)         │
├──────────────────────────────────────────────────────────┤
│  EXPLORÁ POR                                             │  ← links reales a los hubs:
│  Talleres · Clubes de lectura · Encuentros · …           │    navegación sin JS y
│  Boedo · Villa Crespo · Almagro · …                      │    linkeo interno para SEO
│  Online · Gratis · Septiembre · Octubre                  │
├──────────────────────────────────────────────────────────┤
│  ¿Organizás algo? · Suscribite al calendario · Acerca     │
└──────────────────────────────────────────────────────────┘
```

Decisiones de esta pantalla:

- **La lista se renderiza completa en el HTML del build**, sin paginar y sin
  "ver más". Con cientos de actividades el documento pesa poco y es lo mejor
  posible para el buscador y para JavaScript apagado. Si algún día son miles, el
  corte es por tiempo (los próximos 6 meses en la home, el resto en las páginas
  de mes), nunca un "cargar más" que esconda contenido del indexador.
- **Agrupado por mes**, con un separador. Una lista plana de 38 fechas no se
  lee; el mes da estructura sin costar un control.
- **El buscador no roba el foco al cargar.** En móvil abriría el teclado y
  taparía la lista.
- **`destacado` no reordena la lista.** Va en una tira aparte arriba, de a 3.
  Meter destacadas dentro del listado cronológico rompe lo único que el listado
  promete: orden por fecha. La actividad destacada aparece **dos veces** (en la
  tira y en su mes), y está bien: son dos lecturas distintas.
- **"Explorá por" no es decorativo.** Es la navegación sin JavaScript, y es el
  linkeo interno que hace que los hubs existan para Google.

### 4.2 Tarjeta del listado

> ⚠️ **Y quedó viejo otra vez el mismo día — ver D-146.** La tarjeta ya no es una
> tarjeta: es una **fila** (`FilaDeActividad.tsx`) sobre una grilla de 12 columnas,
> **sin imagen en ningún caso** — ni foto real ni portada generada. Se retiraron
> `Tarjeta.tsx` y `PortadaDeTarjeta.tsx`. **El color derivado por tipo volvió el
> 2026-09-01 con D-150**, pero no ahí: hoy lo pinta `estiloDeTipo`/`colorDeTipo`
> (`src/lib/listadoPublico.ts`, `src/lib/identidad.ts`) por `style` en la cajita de
> la categoría, y es elegible desde Opciones.
> Lo que **sigue valiendo** es el contenido: el orden de los datos, la entrada
> entera como un solo link, el arancel con acento solo cuando no se paga, y nada
> de «quedan 3 lugares». Los dos avisos quedan apilados a propósito, para que cada
> desvío se lea contra el original que corrigió.

> ⚠️ **Este apartado quedó viejo el 2026-08-31 — ver D-142** en
> [`06-decisiones.md`](06-decisiones.md). La tarjeta es **vertical, con portada
> arriba**, dentro de una grilla de una, dos o tres columnas, y **cuando no hay
> imagen la portada se genera** en vez de no reservar la columna. Se deja escrito como
> estaba para que el desvío de D-142 se lea contra su original: lo que sigue vale
> —el orden de los datos, la tarjeta entera como link, el arancel con acento solo
> cuando no se paga, nada de «quedan 3 lugares»— salvo lo que dice de la imagen.

Es el componente que más se repite; lo que muestra está elegido, en este orden:

```
┌───────────┬──────────────────────────────────────────────┐
│           │ mié 24 sep · 19:00            TALLER · GRATIS│  ← fecha primero,
│  imagen   │ Taller de crónica de barrio                  │    después el qué
│  (16:9,   │ Casa Brandon · Boedo, CABA                   │
│  lazy)    │ Ciclo de 8 encuentros · empezó el 3 de sep   │  ← solo si es ciclo
│           │ Inscripción abierta · cupo 12                │  ← solo si aporta
└───────────┴──────────────────────────────────────────────┘
```

- **La fecha va arriba y en Inter**, no el título. Es el dato que decide.
- Toda la tarjeta es un link (`<a>` envolviendo el `<article>`), sin botones
  internos: en móvil un botón dentro de un link es un blanco ambiguo.
- **Sin imagen no hay hueco gris.** La tarjeta sin portada —o sea con
  `imagenes: []`, que es la forma que tiene «no hay imagen» desde **D-125**; el
  campo único `imagenUrl` ya no existe (**B-167**, **B-223**)— no reserva la
  columna: el texto ocupa todo el ancho y el título sube un escalón de tamaño.
  Es una tarjeta distinta, no una tarjeta rota. Ver
  [§7.6](#76-una-actividad-sin-imagen), y el desvío 5 de la caja de estado: hoy
  esa tarjeta **genera** una portada tipográfica (D-142).
- El badge de arancel solo se pinta con el acento cuando es `gratis` o
  `a-la-gorra`; el resto va en gris. Es el único color de la lista.
- Nada de "quedan 3 lugares": no sabemos cuántas inscripciones hay. `cupo` es el
  cupo total y se dice así.

### 4.3 Detalle — `/actividad/{slug}`

> ⚠️ **La portada del diagrama y las dos primeras viñetas de abajo se desviaron — ver
> D-144 y D-147 en [`06-decisiones.md`](06-decisiones.md).** Desde B-253 (2026-08-31)
> la portada va **arriba**, y no después de la ficha. El motivo original —un flyer
> vertical empuja la fecha fuera de la pantalla— **sigue siendo válido**; lo que
> cambió es cómo se resuelve.
>
> **Y la primera respuesta estuvo mal, corregida el 2026-09-01 (B-263, D-147):** se
> resolvió con relación de aspecto fija (`--aspect-portada`, 16/9) y `object-cover`,
> y como los flyers reales son verticales eso recortaba el **51 %** de la imagen —o
> sea el título y la fecha, que en un flyer están escritos adentro—. Lo que hacía
> falta era topear el **alto**, no fijar la proporción. Hoy la imagen se muestra
> entera, con su propia proporción y el alto acotado. El diagrama y las viñetas
> quedan como estaban, para que las dos decisiones se lean contra su original.
>
> **Y una tercera vuelta, el 2026-09-02 (B-296, D-168):** arriba va **una sola**
> imagen —la portada—, y las demás que la actividad tenga (hasta cuatro, DEC-7b)
> salen en una tira **al final** del contenido, entre «Cómo llegar» y «Organiza».
> Hasta ese día no salían a ninguna parte del sitio.

La pantalla más importante del sitio, y la que **no lleva JavaScript**: es HTML
y CSS. Cero islands, cero `events.json`, cero hidratación.

```
┌──────────────────────────────────────────────────────────┐
│ ← Agenda literaria                                       │
├──────────────────────────────────────────────────────────┤
│ [ aviso de estado, solo si aplica: CANCELADA / YA PASÓ ] │  ← franja, no se puede
├──────────────────────────────────────────────────────────┤    perder de vista
│ TALLER                                                   │
│ Taller de crónica de barrio                              │  ← h1, Lora
│                                                          │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ 📅  miércoles 24 de septiembre, 19:00 a 21:00        │ │  ← "la ficha":
│ │ 📍  Casa Brandon · Aráoz 32, Boedo, CABA             │ │    los 4 datos que
│ │ 💰  A la gorra · incluye el material                 │ │    decidís mirando
│ │ 🎟  Inscripción abierta hasta el 22 de septiembre    │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                          │
│ [  Escribir por WhatsApp  ]                              │  ← CTA único, verbo real
│                                                          │
│ (imagen, si hay — acá, no arriba)                        │
│                                                          │
│ Descripción larga, tal como la cargó el organizador,     │
│ respetando los saltos de línea.                          │
│                                                          │
│ LOS 8 ENCUENTROS                                         │  ← solo si esCiclo
│  1 · mié 3 sep 19:00 — La ciudad como texto      (pasó)  │
│  2 · mié 10 sep 19:00 — Escuchar                 (pasó)  │
│  3 · mié 17 sep 19:00 — Cancelado          ~~tachado~~   │
│  4 · mié 24 sep 19:00 — El personaje real     ← próximo  │
│  …                                                       │
│                                                          │
│ QUIÉN LO DA                                              │
│  Ana Ruiz — bio breve · @anaruiz                         │
│                                                          │
│ MATERIAL                                                 │  ← solo si material.tiene
│  · La guía de lectura (se manda al inscribirte)          │
│  · Crónica de Boedo → link  (los que son públicos)       │
│                                                          │
│ CÓMO LLEGAR                                              │  ← solo si presencial
│  Aráoz 32 · "timbre del fondo" · [ver en el mapa]        │
│                                                          │
│ ORGANIZA                                                 │
│  Casa Brandon · @casabrandon · casabrandon.com           │
├──────────────────────────────────────────────────────────┤
│ MÁS DE ESTO                                              │  ← la salida al resto
│  Otros talleres → /tipo/taller                           │    del sitio
│  Otras actividades en Boedo → /barrio/boedo              │
│  Toda la agenda → /                                      │
├──────────────────────────────────────────────────────────┤
│ [ Escribir por WhatsApp ]   (barra fija en móvil)        │
└──────────────────────────────────────────────────────────┘
```

Decisiones de esta pantalla:

- ~~**"La ficha" antes de todo lo lindo.** La imagen del flyer va después de la
  ficha y del botón.~~ **Desviado por D-144:** la portada va arriba. Sin imagen la
  ficha sigue siendo lo primero y no queda ningún hueco, que era la otra mitad del
  argumento.
- ~~**La imagen no es hero.**~~ **Desviado por D-144 y corregido por D-147**, y el
  motivo original es el que se conserva: un flyer vertical **sí** empujaría la fecha
  fuera de la pantalla si su alto lo decidiera el archivo. Lo que acota el alto es un
  tope (`max-h`), **no** una proporción fija: con `--aspect-portada` y `object-cover`
  el flyer se recortaba y perdía justamente los datos que trae escritos. Los
  `width`/`height` siguen puestos, y ahora también los tienen las imágenes externas
  (el panel las mide).
- **Las demás imágenes van al final, y no pegadas a la portada** (**B-296**,
  **D-168**). Grilla de dos columnas —tres cuando son tres—, cada una con su propia
  proporción y sin recortar, diferidas con `loading="lazy"`. La posición es parte de
  la optimización y no una preferencia: `lazy` solo sirve si están de verdad abajo
  del pliegue. **Con una sola imagen la sección no existe** —ni encabezado, ni
  hueco—, y eso es el 87 % de las actividades que tienen alguna (26 de 30, medido el
  2026-09-02). El texto alternativo de las secundarias queda **vacío a propósito**:
  DEC-7a lo deriva del título de la actividad, y repetirlo en tres imágenes es peor
  que no decir nada, así que la cuenta se dice una vez en el encabezado («Dos
  imágenes más») y el epígrafe, cuando está cargado, es el `figcaption` de su imagen
  y lo único que la describe. Sin lightbox: no agrega ninguna parada de tabulación.
- **Un solo CTA, con el verbo de la vía.** `inscripcion.via` dice el verbo:
  `whatsapp` → "Escribir por WhatsApp" a un `wa.me` con mensaje precargado
  ("Hola, quiero anotarme en Taller de crónica"); `mail` → `mailto:` con asunto
  precargado; `dm` → el perfil de Instagram; `formulario` → "Anotarme". Con
  `requiere: false` no hay botón: dice "Entrada libre, no hace falta anotarse".
- **El link de la reunión no está.** Ni acá ni en el JSON ni en el JSON-LD, salvo
  el caso explícito de `urlPublica` (D-15), y aun así **nunca en el JSON-LD**
  (ver [§5.4](#54-el-caso-online)).
- **La descripción se respeta como se cargó** (`white-space: pre-line`). Es texto
  plano de un `<textarea>`: sin markdown, sin autolinkeo — ver
  [§11.1](#111-decisiones-del-dueño).
- **La lista de encuentros muestra los que ya pasaron**, atenuados. Borrarlos
  haría parecer que el ciclo es más corto, y ver que van cuatro encuentros es
  parte de decidir si te subís.

### 4.4 Hubs — `/tipo/*`, `/barrio/*`, `/online`, `/gratis`, `/agenda/*`

Un solo componente de página con tres variables: título, párrafo de contexto y
el subconjunto ya filtrado.

```
┌──────────────────────────────────────────────────────────┐
│ ← Agenda literaria                                       │
│ Talleres de escritura                                    │  ← h1 = el nombre del hub
│ 12 talleres con fecha próxima en Argentina.              │  ← 1-2 frases escritas,
│ Se actualiza cuando entra una actividad nueva.           │    no autogeneradas del todo
│                                                          │
│ [Todos los tipos: Taller ×]  🔍 buscar dentro            │  ← el filtro del hub
│                                                          │    aparece como chip
│ … el mismo listado agrupado por mes, las mismas tarjetas  │
│                                                          │
│ EXPLORÁ POR  → los otros hubs                            │
└──────────────────────────────────────────────────────────┘
```

- **El hub es el filtro hecho página.** La misma island se monta con el filtro
  preaplicado y visible como chip; sacar el chip **navega a `/`**, no hace
  desaparecer el título de la página.
- Un párrafo de contexto por hub, con algo de texto real (no "12 resultados"):
  es lo que diferencia la página del filtro para el buscador y para una persona.
  Los hubs de barrio pueden tener el párrafo autogenerado con el nombre del
  barrio; los cinco de tipo y los dos temáticos van escritos a mano.
- Un hub que se queda sin actividades vigentes **no se borra**: se genera con el
  aviso "Ahora no hay talleres con fecha próxima" y links a los demás hubs y al
  archivo. Un 404 sobre una URL indexada es peor que una página honesta y vacía.

### 4.5 `/pasadas`, `/suscribirse`, `/ayuda` + `/contacto`, `/404`

> **Los nombres de esta sección son los del diseño y tres cambiaron — B-234.** El
> reparto real está en la caja del [§2](#2-mapa-de-urls); cada bullet de abajo
> lleva el suyo.

- **`/pasadas`** — mismas tarjetas, atenuadas, agrupadas por mes de más reciente
  a más antiguo, sin filtros salvo la búsqueda. Cabecera honesta: "Lo que ya
  pasó. Muchas de estas actividades se repiten: si te interesa una, seguí a quien
  la organiza."

  > ✅ **Construida el 2026-09-02 (B-109), con dos desvíos — ver D-167.** La
  > cabecera es esa, palabra por palabra, y el orden es el de acá. Lo que cambió:
  > **no está atenuada** —el sistema visual de D-146 prohíbe las opacidades
  > (B-235) y la fila ya distingue una pasada por la tinta del bloque de fecha,
  > que va en `super` y no en el terracota de lo que se puede hacer— y **no tiene
  > buscador**: la island filtra el índice de lo vigente, así que enseñarle un
  > modo nuevo es un cambio de la island y no de esta página (**B-292**). Mientras
  > tanto la página enlaza la búsqueda de la agenda.
  >
  > Y ganó una razón de ser que este documento no le daba: la entrada del sitemap
  > de una pasada **vence a los 90 días** (§7.1), así que a partir de ahí ésta es
  > la única página que la enlaza. Sin ella, cada actividad que pasa se queda sin
  > un solo link interno tres meses después.
- **`/calendario`** — tres botones: agregar a Google Calendar, suscribirse por
  iCal, y cómo hacerlo desde el teléfono. **Solo la URL pública del calendario**
  (la que se arma con `GOOGLE_CALENDAR_ID`); la URL `private-…` del ICS es un
  secreto y no aparece nunca (§5.4).

  > **Construida el 2026-08-28 como `/suscribirse`, no como `/calendario`** — B-230,
  > el motivo del nombre está en **D-134**. Lo demás se cumplió y creció: son cuatro
  > caminos y no tres (Google, `webcal:` para iPhone y Mac, la dirección del `.ics`
  > para Outlook y Thunderbird, y abrir el calendario sin suscribirse), más una
  > sección de lo que el calendario **no** hace. Lo de «solo la URL pública» dejó de
  > depender de acordarse: las direcciones salen de `src/lib/enlaces.ts` (B-228) y hay
  > un test que falla si alguna aparece escrita en el markup de la página.
- **`/acerca`** — qué es, quién lo mantiene, cómo se carga una actividad, y el
  canal para proponer una. Es la página que le da a un buscador y a una persona
  con quién está tratando. Necesita un canal de contacto — ver
  [§11.1](#111-decisiones-del-dueño).

  > **Construida el 2026-08-28 como dos páginas y no una** — B-232 y B-233. El
  > rol se partió por lo que cada mitad contesta: **`/ayuda`** es «qué es esto y
  > cómo se lee» (qué tipos de actividad hay, qué significa cada dato de una
  > ficha, cómo funciona el calendario) y **`/contacto`** es «cómo propongo una»,
  > con la lista de qué conviene contar. Partirlas es lo que dejó a cada una con
  > un `<title>` y una `meta description` que dicen algo distinto —una sola página
  > con los dos temas no puede— y lo que hizo que el pie deje de mandar a un
  > `mailto:` crudo que se salteaba esa lista (B-233).
  >
  > El canal de contacto que este bullet pedía **se decidió**: es el que
  > `/contacto` publica. Lo que sigue afuera es la página de identidad
  > institucional —quién lo mantiene, el `Organization` del §5.5— que no tiene
  > ítem propio porque nadie la pidió.
- **`/404`** — buscador, los hubs, y "quizá la actividad que buscás ya pasó:
  mirá el archivo".

  > ~~❌ **No se construyó, y no tiene ítem.**~~ **Construida el 2026-09-03 —
  > B-310, con un desvío en D-380.** Están las tres cosas que este bullet pide:
  > el buscador, la tira de hubs y el enlace al archivo. Lo que quedó dicho, y es
  > el desvío:
  >
  > **El buscador es un `<form method="get">` a la home, no la island.** El §6.2
  > ya define que la búsqueda vive en la query string de la home (`/?q=…`), así
  > que un formulario GET con `name="q"` manda exactamente ahí: es *la misma*
  > búsqueda, no una segunda implementación, y la página sale del build sin un
  > byte de JavaScript. Montar `Buscador` acá habría traído la home entera —su
  > listado completo, su riel de filtros y el fetch del `events.json`— a la
  > página de error. El nombre del parámetro sale de una constante y hay un test
  > que lo mete por `aQuery` y lo saca por `desdeQuery`: renombrarlo de un solo
  > lado rompe eso en vez de publicar un formulario que no filtra nada.
  >
  > **Con JavaScript apagado el formulario llega a la agenda completa** y no
  > aplica el texto, porque el filtrado es del cliente (§2.5). Es una degradación
  > honesta —se llega a algo— y no un enlace roto.
  >
  > El motivo por el que tardó sigue valiendo tal cual y explica por qué es P3:
  > mientras el slug sea inmutable (trampa 10) ninguna URL nuestra se rompe sola,
  > así que este 404 lo ven sobre todo los bots y quien tipea mal una dirección.
  > Lo que gana la página es el caso que B-310 nombra: **el link viejo de
  > Instagram hacia algo que se renombró antes de la regla**, y el destino de esos
  > es el archivo.
  >
  > Es la **salida pública 13**, y la más chica del repo: cuatro frases escritas a
  > mano en `src/lib/noEncontrado.ts` y ningún dato de ninguna actividad. Como en
  > `/pasadas`, la función que las arma **recibe** los únicos datos que la página
  > ve —los grupos de la tira— y no los usa, así que el barrido de centinelas
  > corre con la lista de permitidos **vacía**.

---

## 5. SEO

Es requisito, no adorno (§2.3). Tres capas: etiquetas, datos estructurados, y
que el contenido esté en el HTML (que es lo que garantiza el SSG).

### 5.1 Etiquetas por tipo de página

En todas: `<html lang="es">` (ya está en `Base.astro`), `canonical` absoluto,
Open Graph completo, `twitter:card = summary_large_image`.

> ✅ **Construido el 2026-09-02 (B-109), con dos precisiones y una carencia.** El
> `canonical` absoluto y el Open Graph los pone `Base.astro` **para todas las
> páginas de una sola vez**, con `urlAbsoluta` (`lib/rutasPublicas.ts`): con una
> prop por página, la que se olvidara de pasarla se publicaría sin canónica y
> nada fallaría. Las dos precisiones: la canónica lleva **barra final** porque es
> la forma que contesta 200 en Firebase (`/x` da un 301 a `/x/`), y `twitter:card`
> es `summary_large_image` **solo cuando hay imagen** —la tarjeta grande sin
> imagen se dibuja como un rectángulo vacío—. La carencia son las cinco imágenes
> de `public/og/`, que siguen sin existir: hoy solo la página de detalle manda
> `og:image`, con el flyer de la actividad. Es **B-291**.
>
> **Y desde el 2026-09-02 la barra final no es solo de la canónica** (B-293,
> **D-180**): los `href` internos del sitio salen por `rutaCanonica` igual que
> ella, así que hay una sola forma de cada ruta y ningún click paga el 301.

| Página | `<title>` | `meta description` | `canonical` |
|---|---|---|---|
| `/` | `Agenda de actividades literarias en Argentina` | `Talleres de escritura, clubes de lectura, encuentros y presentaciones. 38 actividades con fecha próxima.` | `/` — **siempre sin query string** |
| `/actividad/{slug}` | `{titulo} · {Tipo} en {barrio o "online"} — Agenda literaria` | `resumen` (los ~160 caracteres de la descripción). Si está vacía: `{Tipo} · {fecha} · {sede o plataforma} · {arancel}` | la propia |
| `/tipo/{slug}` | `{Label en plural} en Argentina — Agenda literaria` | `{N} {label} con fecha próxima: {tres títulos}.` | la propia |
| `/barrio/{slug}` | `Actividades literarias en {Barrio} — Agenda literaria` | `Talleres, clubes de lectura y encuentros en {Barrio}. {N} con fecha próxima.` | la propia |
| `/online` | `Talleres y clubes de lectura online — Agenda literaria` | escrita a mano | la propia |
| `/gratis` | `Actividades literarias gratis y a la gorra — Agenda literaria` | escrita a mano | la propia |
| `/agenda/{aaaa-mm}` | `Qué hay en {mes} de {año} — Agenda literaria` | `{N} actividades literarias en {mes}: {tres títulos}.` | la propia |
| `/pasadas` | `Actividades que ya pasaron — Agenda literaria` | escrita a mano | la propia |
| `/cartelera` | `Cartelera de actividades literarias · {NOMBRE}` | armada con la cuenta de afiches | la propia |
| `/suscribirse` | `Suscribirse al calendario — {NOMBRE}` | escrita a mano | la propia |
| `/ayuda` | `Ayuda — {NOMBRE}` | escrita a mano | la propia |
| `/contacto` | `Contacto — {NOMBRE}` | escrita a mano | la propia |
| `/404` | `No encontramos esa página · {NOMBRE}` | — | la propia · **`noindex`** |

> **Las cuatro filas del medio se agregaron el 2026-09-02 (B-234)**: son páginas
> reales que este documento no tenía —dos porque nacieron con otro nombre, una
> porque no estaba diseñada—, y el `<title>` de cada una es el que emite hoy, no
> el que este documento hubiera propuesto. `{NOMBRE}` sale de
> `src/lib/identidad.ts`, que es la única vez que el nombre del sitio se escribe
> (un test lo exige). ~~La fila de `/404` queda tachada: la página no se
> construyó.~~ **Destachada el 2026-09-03 — B-310**, con dos precisiones sobre lo
> que esa fila decía:
>
> - **el `<title>` lleva el nombre del sitio**, como las otras doce. La fila lo
>   omitía, y omitirlo es lo único que este documento no puede pedir: hay un test
>   que exige que toda página se titule con `NOMBRE` (B-245, D-141), justamente
>   porque una página sin identidad en la pestaña es cómo se llegó a que el sitio
>   se llamara «Agenda literaria»;
> - **la canónica se emite**, y la fila decía «—». No es un olvido: `Base.astro`
>   la arma para **todas** las páginas de una sola vez (B-109) precisamente para
>   que ninguna se publique sin ella, y abrirle una excepción a una página sería
>   devolverle a cada plantilla la posibilidad de olvidarse. En esta página es
>   inerte: Firebase la sirve con estado **404** y con `noindex, nofollow`, o sea
>   que no hay nada que canonizar. Está en **D-380**.

Reglas:

- **El título de la actividad va primero en el `<title>`.** Google recorta a
  ~60 caracteres y lo que importa es el nombre, no la marca.
- **El barrio entra en el `<title>` de la actividad.** Es la palabra que hace
  match con `taller de escritura villa crespo`.
- **La home canoniza a `/` sin query.** Los filtros escriben en la query string
  (`/?tipo=taller&barrio=boedo`), y sin canonical fijo Google indexaría
  combinaciones infinitas del mismo contenido, compitiendo con los hubs que sí
  queremos posicionar.
- **`og:image`**: la **portada** de la galería cuando hay —`portadaDe(a.imagenes)`
  (`src/lib/imagenes.ts`), la que lleva el flag `portada`, no la primera cargada
  (B-268). Cuando no, una imagen estática de
  1200×630 en papel y tinta con el nombre del sitio, distinta por tipo de
  actividad (cinco archivos en `public/og/`). Sin generación de imágenes en el
  build: es complejidad grande para una ganancia chica, y una imagen tipográfica
  sobria es coherente con el resto.
- **`noindex`** solo en `/admin` (ya está) y `/404`. Las actividades pasadas
  **no** llevan `noindex`: son la prueba de que el ciclo existe y de que se
  repite, y suelen ser la primera cosa que la gente encuentra buscando el nombre
  de un taller.

### 5.2 Datos estructurados: `Event` de schema.org

Es el tipo que encaja: **[`Event`](https://schema.org/Event)**, con JSON-LD en
`<script type="application/ld+json">`. Es el que hace que el resultado de Google
muestre **fecha y lugar** debajo del título en vez de solo texto, y el que
alimenta el carrusel de eventos.

Google pide, para el resultado enriquecido de evento:

| Campo | ¿Obligatorio? | ¿Lo tenemos hoy? |
|---|---|---|
| `name` | **sí** | sí — `titulo` |
| `startDate` (con offset o timezone) | **sí** | sí — `sesiones[].inicio` |
| `location` | **sí** (presencial) | sí — `sede` |
| `location` como `VirtualLocation` con `url` | **sí** (online) | **no exactamente** — ver [5.4](#54-el-caso-online) |
| `endDate` | recomendado | sí — `sesiones[].fin` |
| `description` | recomendado | sí |
| `image` | recomendado | a veces — la **portada** de `imagenes` (`portadaDe`) |
| `eventAttendanceMode` | recomendado | sí — `modalidad`, el derivado de B-224 |
| `eventStatus` | recomendado | **parcialmente** — falta `estado` en la proyección |
| `organizer` | recomendado | sí |
| `performer` | recomendado | sí — `tallerista` |
| `offers` (`price`, `priceCurrency`, `url`, `availability`, `validFrom`) | recomendado | **no el precio**: `arancel.tipo` es un slug, no un monto |
| `url` | recomendado | sí — la canónica |

Subtipo por `tipo`, porque schema.org tiene los dos que hacen falta:

| `tipo` | `@type` |
|---|---|
| `taller`, `club-lectura` | `EducationEvent` |
| `presentacion`, `charla`, `encuentro` | `LiteraryEvent` |
| un tipo nuevo de la taxonomía | `Event` (el genérico, seguro) |

### 5.3 Un encuentro suelto vs. un ciclo

**Una actividad de una sola sesión** → un `Event`.

**Un ciclo** → un `EventSeries` con `subEvent`, uno por sesión. Es la traducción
literal del §2.2: una actividad, N encuentros. La alternativa (N `Event` sueltos
en la misma página) le diría a Google que hay ocho eventos distintos y compite
consigo mismo.

```json
{
  "@context": "https://schema.org",
  "@type": "EventSeries",
  "name": "Taller de crónica de barrio",
  "url": "https://…/actividad/taller-de-cronica-en-boedo",
  "startDate": "2026-09-03T19:00:00-03:00",
  "endDate": "2026-10-22T21:00:00-03:00",
  "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
  "eventStatus": "https://schema.org/EventScheduled",
  "location": {
    "@type": "Place",
    "name": "Casa Brandon",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "Aráoz 32",
      "addressLocality": "CABA",
      "addressCountry": "AR"
    },
    "geo": { "@type": "GeoCoordinates", "latitude": -34.6, "longitude": -58.42 }
  },
  "organizer": { "@type": "Organization", "name": "Casa Brandon", "url": "https://casabrandon.com" },
  "performer": { "@type": "Person", "name": "Ana Ruiz" },
  "offers": {
    "@type": "Offer",
    "url": "https://…/actividad/taller-de-cronica-en-boedo",
    "availability": "https://schema.org/InStock",
    "category": "A la gorra"
  },
  "subEvent": [
    {
      "@type": "EducationEvent",
      "name": "Taller de crónica de barrio — La ciudad como texto",
      "startDate": "2026-09-03T19:00:00-03:00",
      "endDate": "2026-09-03T21:00:00-03:00",
      "eventStatus": "https://schema.org/EventScheduled",
      "url": "https://…/actividad/taller-de-cronica-en-boedo#ses_9f2a"
    },
    {
      "@type": "EducationEvent",
      "name": "Taller de crónica de barrio — Escuchar",
      "startDate": "2026-09-17T19:00:00-03:00",
      "endDate": "2026-09-17T21:00:00-03:00",
      "eventStatus": "https://schema.org/EventCancelled"
    }
  ]
}
```

Reglas del armado, todas verificables:

1. **Las fechas se emiten con offset de Buenos Aires (`-03:00`)**, no en `Z`.
   `toPublic` serializa a ISO en UTC (`toISOString()`); el build convierte con
   `Intl` y `timeZone: 'America/Argentina/Buenos_Aires'`. Es la trampa 1 otra
   vez: un `19:00` publicado como `22:00Z` está bien, pero un consumidor que lo
   muestre sin convertir dice "22:00" y la gente llega tarde. Emitir el offset
   explícito saca la ambigüedad.
2. **`eventStatus`** sale del cruce de `estado` y `sesiones[].cancelada`:
   actividad `cancelado` → `EventCancelled` en la serie **y** en todos los
   subeventos; sesión `cancelada` → `EventCancelled` solo en ese subevento.
   **Las fechas se conservan** en un evento cancelado: Google pide que el
   `startDate` original siga ahí, si no no puede tacharlo en el resultado.
3. **`offers`**: con `arancel.tipo == 'gratis'` se emite
   `price: "0", priceCurrency: "ARS"`. Con cualquier otro valor **no se emite
   precio**: un `0` en un taller arancelado es un dato falso publicado en un
   formato que las máquinas creen. Se emite `url`, `availability` y `category`
   con el label. Para tener precio real hace falta un campo de monto — **B-114**.
4. **`availability`**: `InStock` si la inscripción está abierta y hay sesiones por
   venir. `SoldOut` no se usa nunca: no sabemos cuántos se anotaron. Cuando la
   inscripción cerró, no se emite `offers`.
5. **`performer` solo si hay `tallerista`.** No inventar el organizador como
   performer.
6. **Nada de `aggregateRating`, `review`, ni `Offer` sin respaldo.** Marcar datos
   que la página no muestra es lo que hace que Google deje de confiar en el sitio
   entero.

### 5.4 El caso online

Google pide, para un evento online, `location` de tipo `VirtualLocation` con
`url`. Nosotros **no publicamos el link de la reunión** (§5.1, trampa 5).

**Decisión: `VirtualLocation.url` es siempre la URL canónica de la actividad**,
que es donde efectivamente se consigue el acceso. Y **nunca `online.url`, ni
siquiera con `urlPublica: true`** (D-15): que el dueño decida mostrar el link en
la página no es lo mismo que servirlo en JSON-LD, que es un formato hecho para
que lo lean máquinas y el primero en ser cosechado por un bot. El HTML muestra
lo que el dueño eligió; el JSON-LD no.

Híbrido → `eventAttendanceMode: MixedEventAttendanceMode` y `location` como
array de `[Place, VirtualLocation]`.

Con **varias formas de cursar** (B-224) el `location` array sale natural: una
entrada por fila, con su `Place` o su `VirtualLocation`. El `eventAttendanceMode`
sigue siendo uno solo y es el derivado — que para una actividad presencial y
virtual ya da `hibrido`, o sea `Mixed`, que es lo correcto.

### 5.5 Los otros datos estructurados

| Página | Además de `Event` |
|---|---|
| `/actividad/{slug}` | `BreadcrumbList`: Agenda → {Tipo} → {título} |
| Home y hubs | `CollectionPage` con `ItemList` de `ListItem { position, url, name }`, en el orden en que se ven. Ayuda a que Google entienda que la página es un listado y siga los links |
| ~~`/acerca`~~ | `Organization` con `name`, `url`, `logo`, `sameAs` (Instagram). **`/acerca` no existe** (B-234): el rol se repartió entre `/ayuda` y `/contacto`, y ninguna de las dos emite `Organization` todavía. Si se agrega, va en `/contacto`, que es la que dice con quién estás tratando |

No se usa `WebSite` + `SearchAction`: Google retiró el sitelinks searchbox y hoy
no hace nada.

> ✅ **Construidas las dos filas de arriba el 2026-09-02 (B-107).** Una sola
> función por caso, compartida entre las cinco páginas que la necesitan —
> `migasDeDetalle` (`detallePublico.ts`) y `coleccionSchema` (`hubsPublicos.ts`),
> que arma la home y los cuatro hubs con la misma llamada— por el mismo motivo
> por el que este documento entero insiste en eso: escrita cinco veces sería la
> clase de bug de B-88 el día que una de las cinco quede afuera de un cambio.
>
> **Un caso que el diseño no anticipaba:** el segundo nivel del `BreadcrumbList`
> (el hub de tipo) no siempre existe. Un hub de `/tipo/{slug}` se emite si
> **alguna actividad publicada** usó ese tipo alguna vez (B-108), y una
> cancelada no entra a esa cuenta (D-159) — así que la miga de una cancelada
> cuyo tipo nadie más usa se resuelve con **dos** niveles (Agenda → título) y no
> tres, para no enlazar un `/tipo/{slug}` que el build nunca generó. Lo decide
> el lector (`contenidoDelSitio.ts`, campo `tipoTieneHub`), no la plantilla —
> D-140 de siempre—, con el mismo default `false` («no publiques un link que
> puede no existir») que ya usaban `cancelada` y `mesesConPagina`. Verificado
> contra un build real con el emulador.

### 5.6 `sitemap.xml` y `robots.txt`

```
sitemap.xml   →  /  ·  hubs (tipo, barrio, online, gratis)  ·  meses vigentes
                 ·  /pasadas  ·  /cartelera  ·  /suscribirse
                 ·  /ayuda  ·  /contacto
                 ·  cada /actividad/{slug} con <lastmod>

                 (los nombres corregidos contra las rutas reales — B-234;
                  la lista de verdad es RUTAS_FIJAS en src/lib/sitemap.ts,
                  y los hubs entran cuando existan — B-108)

robots.txt    →  User-agent: *
                 Disallow: /admin
                 Sitemap: https://{dominio}/sitemap.xml
```

- **`lastmod` sale de `updatedAt`**, que hoy **no está en la proyección**. Sin
  ese dato la única opción honesta es omitir `lastmod` (mejor que poner la fecha
  del build en todas las páginas: eso le enseña a Google que nuestras fechas
  mienten). Ver [§11.2](#112-cambios-a-topublicts).
- Se generan a mano en el build (dos endpoints estáticos), no con
  `@astrojs/sitemap`: las reglas de qué entra y qué no (90 días para pasadas, 30
  para canceladas, meses con 3 o más) son nuestras y no se expresan en la
  configuración del integrador.
- ~~**Todo esto necesita `site` en `astro.config.mjs`**, que hoy no está~~ —
  **`site` existe desde B-109** (D-165): sale de `SITIO`, la única aparición del
  dominio en el repo, y la config lo **importa** en vez de copiarlo.

> ✅ **Construido el 2026-09-02 (B-109).** Lo que salió distinto de este bloque,
> y todo con motivo:
>
> - **el `robots.txt` es un endpoint y no un archivo en `public/`**: su línea
>   `Sitemap:` lleva el dominio, y el dominio se escribe una sola vez;
> - **las URLs llevan barra final** (`rutaCanonica`), que es la forma que contesta
>   200 en Firebase — una entrada que apunta a un 301 es una URL menos rastreada;
> - **los hubs todavía no están en el sitemap** porque todavía no existen (B-108);
>   la lista de páginas fijas es explícita y un test exige que cada página del
>   sitio esté en ella **o** exceptuada con su motivo, así que la que nazca no
>   entra sola ni se olvida;
>
> ✅ **Y desde B-108 (2026-09-02) sí están.** Los dos temáticos entraron a
> `RUTAS_FIJAS` —son secciones fijas del sitio, como `/pasadas`— y los de tipo y
> barrio entran por su propia regla dinámica (`hubsOfrecidos`), la misma idea que
> ya usaban las actividades y los meses: se ofrecen los que tienen algo vigente, y
> el resto sale con `noindex` en vez de faltar del sitemap. `tests/sitemap.test.ts`
> fija que las dos señales no puedan separarse.
> - **la ventana de las canceladas se mide con `updatedAt` leído del documento
>   crudo**, que el lector pasa **al lado** de la proyección (`canceladasEditadasEn`):
>   es un predicado —decide si la URL entra— y no un dato de salida, así que
>   `updatedAt` sigue sin salir a ninguna salida. El razonamiento está en **D-166**;
> - `lastmod` **se omite**, tal cual lo dice este bloque, y el test lo fija para
>   que agregarlo con la fecha del build sea una decisión y no un descuido.
>
> ✅ **Y desde B-112 (2026-09-03), para las actividades, ya no se omite.**
> `lastmodDelSitemap` (`lib/sitemap.ts`) arma `{ ruta: AAAA-MM-DD }` a partir de
> `publicadasEditadasEn` — el mismo patrón que `canceladasEditadasEn`, un dato
> que viaja al lado de la proyección y no adentro de `toPublic` — y solo lo
> emite para una ruta que `rutasDelSitemap` ya ofrece: dos derivaciones de la
> misma selección no pueden discreparse. Los hubs, los meses y el resto de
> `RUTAS_FIJAS` siguen sin `lastmod`, tal como decía este bloque: no tienen una
> fecha de edición propia que declarar.

---

## 6. Filtros

Un solo `fetch` de `events.json` y todo en memoria del cliente (§2.5).

### 6.1 Cuáles, en orden de importancia

| # | Filtro | Control | Combina |
|---|---|---|---|
| 1 | **Búsqueda de texto** | input | Contra `searchText`, con `normalize()` (§6). Se parte la consulta en palabras y se exige que **todas** aparezcan (AND), como substring. `"cronica boedo"` encuentra la crónica de Boedo |
| 2 | **Cuándo** | select | `Próximas` (default) · `Este mes` · `Próximos 3 meses` · `Un mes puntual` · `Incluir las que ya pasaron` |
| 3 | **Tipo** | chips multi | OR entre los elegidos |
| 4 | **Dónde** | select + chips | `Presencial` (incluye híbrido) · `Online` (incluye híbrido) · y con presencial, chips de barrio (OR) |
| 5 | **Arancel** | chips multi | OR. `Gratis` y `A la gorra` primero, siempre |
| 6 | **Inscripción abierta** | toggle | Descarta lo que ya cerró |
| 7 | **Tipo de cursada** | toggle | `Solo ciclos` / `Solo encuentros únicos` |
| 8 | **Temas** (`tags`) | chips multi, en "más filtros" | OR |

**AND entre grupos, OR dentro de cada grupo.** "Taller o club de lectura, en
Boedo o Almagro, gratis" es la combinación que la gente espera y es la única que
no sorprende.

- Los chips salen de `opciones.*` del JSON (§4.4) **intersectados con lo que hay
  en el resultado actual**: un chip que da cero no se muestra. Cada chip lleva su
  número ("Taller 12").
- `Presencial` incluye `hibrido` y `Online` incluye `hibrido`, a propósito: una
  actividad híbrida sirve a los dos, y esconderla de ambos filtros es el peor
  resultado posible.
- El orden del listado es siempre por próxima sesión ascendente. **No hay
  selector de orden**: no hay un segundo orden que alguien pida (¿por precio? no
  hay precio; ¿por relevancia? es una lista de 40 cosas).
- Un contador vivo arriba ("12 de 38"), y un `aria-live="polite"` que anuncia el
  cambio para quien usa lector de pantalla.
- Cero resultados no es una pantalla vacía: dice qué filtro sacar primero
  ("probá sin el filtro de barrio") y ofrece el link al hub más cercano.

### 6.2 Estado en la URL

Los filtros se serializan a la query string y se escriben con
`history.replaceState` (no `pushState`: veinte toques de chip no son veinte
entradas del historial; solo abrir y cerrar el panel en móvil sí lo es).

```
/?q=cronica&tipo=taller,club-lectura&barrio=boedo&arancel=gratis,a-la-gorra&cuando=mes-2026-09
```

Sirve para compartir un filtro por WhatsApp, que es cómo circula esto. Y la home
canoniza a `/` sin query para que esas URLs no compitan en el índice
([§5.1](#51-etiquetas-por-tipo-de-página)).

### 6.3 Con JavaScript apagado — el listado híbrido

El §2.3 pide SSG por SEO y el §2.5 pide filtrado en el cliente. Las dos cosas
conviven así:

> **El HTML es la verdad; `events.json` es el índice.**

1. El build renderiza en HTML **todas** las tarjetas vigentes, cada una con sus
   datos de filtrado en atributos (`data-tipo`, `data-barrio`, `data-arancel`,
   `data-inicio`, `data-ciclo`, `data-id`).
2. Sin JavaScript: se ve la lista completa, ordenada y agrupada por mes; los
   filtros no se pintan; y "Explorá por" —links reales a los hubs— es la
   navegación. **Nada del contenido depende de JS.** Google también ve esto.
3. Con JavaScript: la island monta los controles y, en `requestIdleCallback`,
   baja `events.json`. El filtrado **muestra y oculta las tarjetas que ya están
   en el DOM** por `data-id`; el JSON sirve para la búsqueda de texto (que
   necesita `searchText`, que no se imprime en el HTML), para los contadores de
   los chips y para el orden.
4. Lo único que la island **renderiza** son las tarjetas que no están en el HTML:
   las actividades pasadas, cuando el usuario pide incluirlas. Para eso hay un
   `<template>` en la página con el markup de la tarjeta, que la island clona.
   **Una sola definición del markup de la tarjeta**, en el componente Astro; no
   hay una versión React que se desincronice.

Esto también resuelve el peor defecto del patrón "island que re-renderiza todo":
que la lista parpadee y se reemplace a sí misma después de hidratar.

Si el `fetch` falla (offline, CDN caída), los controles quedan deshabilitados con
un aviso chico y la lista completa sigue ahí. Nunca una pantalla vacía.

### 6.4 Fechas en el cliente

Todo lo que se formatea, en el build y en la island, con
`Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })`.
Las fechas del JSON son ISO en UTC; un teléfono con el reloj en Madrid tiene que
ver la hora de Buenos Aires, porque la actividad pasa en Buenos Aires. Es la
trampa 1 aplicada al frontend.

---

## 7. Los casos incómodos

| Caso | Qué se hace |
|---|---|
| Ya pasó | Sale del listado, conserva la página, cambia el CTA. [7.1](#71-una-actividad-que-ya-pasó) |
| Ciclo empezado al que todavía se puede entrar | Se muestra como vigente, con la próxima fecha y el aviso "ya empezó". [7.2](#72-un-ciclo-en-curso) |
| Actividad cancelada | La página sobrevive, marcada, con `EventCancelled`. [7.3](#73-una-actividad-cancelada) |
| Una sesión cancelada de ocho | Tachada en la lista, fuera del cálculo de "próximo". [7.4](#74-una-sesión-cancelada-de-ocho) |
| Ciclo de 8 encuentros en el listado | Una tarjeta, nunca ocho. [7.5](#75-un-ciclo-en-un-listado) |
| Sin imagen | Tarjeta tipográfica, no un rectángulo gris. [7.6](#76-una-actividad-sin-imagen) |
| Todo lo demás | [7.7](#77-el-resto-de-la-lista) |

### 7.1 Una actividad que ya pasó

"Pasó" = **todas** sus sesiones no canceladas terminaron.

- Sale del listado por defecto, de los hubs y de las páginas de mes.
- **Conserva su página, indefinidamente.** Está linkeada de Instagram, de un
  mail, de un grupo de WhatsApp, y está en el índice de Google (trampa 10).
- La página cambia: franja "Esta actividad ya pasó", el CTA de inscripción
  **desaparece** y en su lugar van "Ver otros talleres", "Seguí a Casa Brandon"
  y "Toda la agenda". El bloque de encuentros muestra todas las fechas
  atenuadas.
- **Desde B-253 esa franja es una sola y sirve para los cuatro estados** —cancelada,
  ya pasó, inscripción cerrada, cupo completo— con una prioridad entre ellos decidida
  en el view-model (`detalle.aviso`), del más irreversible al menos. Los cuatro pueden
  valer a la vez, y apilarlos es la forma de que no se lea ninguno. El cupo completo
  avisa pero **no** cierra el canal (D-127).
- **El CTA se decide por fecha, no por `inscripcion.abierta`.** `abierta` solo
  mira `cierra`: una actividad sin fecha de cierre queda `abierta: true` para
  siempre y mostraría "Anotate" en un taller de hace un año.
- Sale del sitemap 90 días después de la última sesión. Sin `noindex`: sigue
  siendo la mejor respuesta a quien busca ese taller por nombre.
- Aparece en `/pasadas` para siempre.

> ✅ **Las dos cosas, construidas el 2026-09-02 (B-109).** Y son una sola: la
> entrada del sitemap vence a los 90 días, así que a partir de ese día `/pasadas`
> es el **único** link interno que le queda a esa página. La ventana se mide desde
> `hasta` —la última sesión no cancelada— y una actividad **sin ninguna fecha
> usable entra igual**: no hay reloj contra el que medirla y excluirla sería
> decidir que es vieja sin ningún dato que lo diga.

### 7.2 Un ciclo en curso

Un club de lectura que arrancó el 3 y va hasta el 22 de octubre, al que todavía
se puede entrar.

- **Es vigente**: tiene sesiones futuras. Ordena por su **próxima** sesión.
- La tarjeta dice: `Ciclo de 8 encuentros · empezó el 3 de sep · próximo mié 24`.
  Decir solo "empieza el 3 de septiembre" en octubre es información falsa.
- El aviso "**Ya empezó — se puede entrar**" se muestra cuando quedan sesiones
  **y** la inscripción está abierta. Eso último es lo más cerca que estamos del
  dato real: hoy no hay un campo que diga "acepta incorporaciones tardías", y
  `inscripcion.cierra` posterior a la primera sesión es exactamente la forma en
  que el dueño lo expresa hoy. Un campo explícito sería mejor —
  [§11.1](#111-decisiones-del-dueño).
- El `EventSeries` mantiene `startDate` en la fecha original de arranque y los
  `subEvent` pasados con su fecha. No se reescribe la historia para que parezca
  que empieza ahora.

### 7.3 Una actividad cancelada

Es el caso que más se puede hacer mal, y la decisión menos obvia del documento.

El camino ingenuo: el build pide `estado == 'publicado'`, la cancelada no
aparece, su página no se genera, y la URL que estuvo tres semanas en Instagram y
en Google **devuelve 404**. La persona que pregunta "¿se hace o no se hace?"
recibe "no existe", que es la peor respuesta posible: da a entender que el
problema es suyo.

**Decisión: el build también trae `estado == 'cancelado'` y genera su página**,
si esa actividad **estuvo publicada alguna vez**.

- La página se genera con la franja `CANCELADA` arriba, sin CTA de inscripción,
  con el texto y las fechas intactos, y `eventStatus: EventCancelled` en el
  JSON-LD (que es justo lo que Google pide: página que sigue viva, evento marcado
  como cancelado; un 404 no le comunica nada).
- **No entra a `events.json`** ni al listado ni a los hubs ni a `/pasadas`: no es
  algo a lo que se pueda ir. Solo existe para quien tiene el link.
- Sale del sitemap 30 días después de cancelarse.

  > ✅ **Construido el 2026-09-02 (B-109), con el criterio de la fecha escrito en
  > D-166.** «Cuándo se canceló» no es un dato del modelo, así que la ventana se
  > mide con **`updatedAt`**: cualquier edición posterior corre el reloj hacia
  > adelante, o sea que la URL se queda un poco más de tiempo — el lado inofensivo
  > del error. El dato lo lee el lector del documento crudo y viaja **al lado** de
  > la proyección, como predicado: no se emite en ninguna parte, y por eso
  > `updatedAt` sigue sin salir a ninguna salida.
- **"Estuvo publicada alguna vez"** no es un dato del modelo. Dos salidas:
  agregar `publicadaAlgunaVez: boolean` (explícito, correcto) o, mientras no
  exista, usar la heurística de que **alguna sesión tenga `calendarEventId`**: el
  sync solo crea eventos de Calendar para actividades publicadas (§7.3 del
  `CLAUDE.md`), así que su presencia prueba que estuvo publicada. La heurística
  la puede leer el build (trabaja sobre el documento crudo, antes de proyectar) y
  alcanza para arrancar; el campo explícito es lo que hay que decidir.

  > ⚠️ **La heurística de este punto NO sobrevive en producción — B-110, D-159.**
  > El razonamiento es correcto y el dato se borra solo: al pasar a `cancelado`,
  > `syncCalendar` borra los N eventos y **escribe `calendarEventId: null` de
  > vuelta en cada sesión** (`reponerIds`, B-80). Para cuando el build lee el
  > documento, la prueba que este punto pedía ya la borró el propio sync — con esa
  > heurística sola, B-110 no habría generado ni una página.
  >
  > Lo que sí sobrevive es el **historial** (§12 del `CLAUDE.md`): cancelar es un
  > cambio de contenido, así que `guardarVersion` deja una versión cuyo
  > `documento.estado` es `'publicado'`, y una actividad que nunca lo estuvo no
  > puede tener ninguna. `estuvoPublicada` (`contenidoDelSitio.ts`) prueba primero
  > el `calendarEventId` —es gratis y a veces alcanza— y si no, consulta la
  > existencia de esa versión con `.limit(1).select()`, sin traer ningún campo.
  > El campo explícito sigue siendo lo correcto y queda en **B-285**.
- Una actividad que nace y muere en `cancelado` no genera nada. Nunca estuvo
  pública y publicarla ahora sería filtrar un borrador.

### 7.4 Una sesión cancelada de ocho

- En la lista de encuentros: tachada, con la palabra "Cancelado" y sin link.
- **Fuera del cálculo de "próximo encuentro"** y de "ya pasó": ocho sesiones con
  la última cancelada tienen siete fechas reales.
- `subEvent` con `eventStatus: EventCancelled`, con su fecha original.
- El evento de Calendar ya se borra (§7.3 del `CLAUDE.md`): el sitio y el
  calendario dicen lo mismo por caminos distintos.
- La tarjeta del listado **no** menciona sesiones canceladas. Es ruido para
  decidir; está en el detalle.

### 7.5 Un ciclo en un listado

Una actividad, una tarjeta (§2.2). Sin excepciones y en todas las vistas.

- La **clave de orden** de un ciclo es su próxima sesión no cancelada. Si no hay,
  la última que hubo (y entonces está en `/pasadas`).
- La tarjeta agrega una línea: `Ciclo de 8 encuentros · 3 sep – 22 oct`.
- **En una página de mes**, un ciclo que cruza dos meses aparece en los dos, y en
  cada uno muestra *las fechas de ese mes*: `/agenda/2026-09` dice "4 encuentros
  en septiembre, del 3 al 24". Es la misma tarjeta con el subtítulo recalculado,
  no una tarjeta distinta.

  > ⚠️ **Construido en B-113 y con el total adelante — D-155.** La frase quedó
  > «Ciclo de 8 encuentros · 4 en septiembre, del 3 al 24»: el literal de arriba
  > pierde cuántos encuentros tiene el ciclo, que es el dato con el que alguien
  > decide si se anota. Lo que sí se cumple entero es la mitad importante — la
  > misma fila, el subtítulo recalculado, y las fechas, el bloque de fecha y el
  > orden de la página salen del **recorte al mes** y no del ciclo entero.
- En el filtro por mes desde la home, igual: un ciclo matchea el mes si alguna
  sesión cae ahí.
- `esCiclo: true` con una sola sesión: se confía en el flag (el dueño puede estar
  cargando el primer encuentro de un ciclo que sigue) pero se escribe "1
  encuentro", no "Ciclo de 1 encuentro".
- `esCiclo: false` con tres sesiones: se muestran las tres fechas sin llamarlo
  ciclo. El flag manda para el vocabulario; los datos, para las fechas.

### 7.6 Una actividad sin imagen

> ⚠️ **Y se volvió a dar vuelta el mismo día — ver D-146.** Hoy **el listado no
> tiene imagen bajo ninguna forma**: ni foto real ni portada generada. O sea que la
> viñeta original vuelve a ser cierta en su conclusión —no hay hueco que llenar—
> pero por otro motivo: no es que la tarjeta sin imagen se adapte, es que **ninguna
> entrada del listado lleva imagen**, y eso es una decisión de forma («el listado es
> puramente tipográfico»), no una respuesta a que falte la portada. La foto **sí**
> sigue en la página de detalle —entera desde D-147, ya no recortada— y desde B-265
> también en `/cartelera`, que es una página **de** imágenes: ahí una actividad sin
> imagen simplemente no aparece.

> ⚠️ **La primera viñeta se revirtió el 2026-08-31 — ver D-142.** Hoy la tarjeta sin
> imagen **sí** tiene portada: generada, con el título sobre el color del tipo. El
> argumento de abajo era correcto para la tarjeta horizontal de una columna, donde
> los dos ritmos conviven; en una grilla las celdas tienen el mismo alto y la mitad
> sin portada queda mocha. Lo que **no** cambió es lo que la viñeta rechazaba: no hay
> placeholder gris, ni ícono, ni iniciales, ni foto de stock.

**El caso es `imagenes: []`, la lista vacía — no `imagenUrl: null`.** El campo
único que este documento diseñaba lo reemplazó `imagenes: Imagen[]` con un flag
`portada` en la primera tajada de **B-167** (**D-125**), y sigue en el tipo solo
como `@deprecated` para leer los documentos viejos: nada nuevo lo escribe. La
lista vacía es frecuente y no es un error.

- **La tarjeta no reserva el espacio de la imagen.** No hay placeholder gris, ni
  ícono, ni iniciales: el texto usa todo el ancho y el título sube un tamaño. La
  lista queda con dos ritmos de tarjeta, y está bien: es una lista de papel, no
  una grilla de Instagram.
- La página de detalle simplemente no tiene imagen. La ficha ya es lo primero,
  así que no queda ningún hueco.
- **`og:image`**: la imagen estática por tipo (§5.1). Es el único lugar donde la
  ausencia de imagen realmente dolía —un link sin preview en Instagram no se
  toca— y se resuelve con cinco archivos.
- Nunca una foto de stock: prometer una foto que no es de la actividad es peor
  que no tener foto.

### 7.7 El resto de la lista

| Caso | Qué se hace |
|---|---|
| Una sesión está pasando **ahora** | "Está pasando ahora" en el detalle. Es cosmético y solo se puede calcular en el cliente: el HTML del build lo diría mal a los cinco minutos. La island lo pinta; sin JS no aparece |
| Inscripción cerrada, actividad futura | Se muestra, con "Las inscripciones cerraron" en vez del CTA, y la fecha de cierre. Sigue sirviendo saber que existe (y que el año que viene se repite). Sin `offers` en el JSON-LD |
| `requiere: false` | No hay botón. "Entrada libre, no hace falta anotarse" |
| Sin `cupo` | No se dice nada. No se inventa "cupos limitados" |
| Descripción de 4000 caracteres | Completa en el detalle, con ancho de lectura (~70 caracteres por línea). En la tarjeta, el `resumen` |
| Descripción de 20 caracteres | La `meta description` cae al formato armado (`{Tipo} · {fecha} · {lugar} · {arancel}`), que es más útil que una frase trunca |
| Descripción con un link pegado | Hoy queda como texto plano, no clickeable. Ver [§11.1](#111-decisiones-del-dueño) |
| Sesiones desordenadas en el array | El build ordena por `inicio`. Nadie más lo asume |
| Actividad publicada **sin** sesiones | No se genera nada y el build lo avisa por consola con el slug: es un dato incompleto, no un caso de diseño |
| `sede: null` en una presencial | Se muestra "Lugar a confirmar" y **no se emite `Event`**: Google pide `location` obligatorio, y un `Place` inventado es peor que no tener datos estructurados |
| `sede.geo` sin cargar | El link "ver en el mapa" se arma con el texto de la dirección, como ya hace `construirLinkMapa` |
| Barrio cargado en minúscula ("boedo") | El hub se titula con el label de `/opciones/barrio` tal como está. Es **B-05**: mientras las etiquetas no se normalicen, el `h1` de `/barrio/boedo` va a decir "boedo". El sitio no lo capitaliza por su cuenta: eso taparía el problema en un solo lugar y dejaría el calendario público diciendo otra cosa |
| Dos actividades con títulos casi iguales | Nada especial: el slug es único e inmutable (trampa 10) |
| El mail de inscripción cosechado por bots | El §5.1 ya lo advierte. El diseño lo saca de `events.json` ([§3.1](#31-la-frontera-de-privacidad-es-topublic-y-el-listado-recorta-todavía-más)), lo que reduce el lote pero no lo esconde. La recomendación operativa sigue siendo la del §5.1: dirección de trabajo, no personal |

---

## 8. Mobile

Es el caso por defecto, no la adaptación: la mayoría entra del teléfono desde un
link de Instagram, dentro de un navegador embebido.

- **Una columna siempre.** Nada de grilla de dos tarjetas en 375px.
- **El panel de filtros es una hoja inferior.** *(Hecho — **B-238**, 2026-09-03;
  la base sobre la que se construyó, y por qué, está en **D-143**.)* En la home,
  en móvil, se ve el buscador y un botón `Filtros (2)` con la cantidad activa; el
  resto de los controles viven en una hoja que sube desde abajo, con `pb-segura`
  para la barra de gestos y un botón "Ver N actividades" que la cierra. Abrir la
  hoja **sí** hace `pushState`: el botón atrás del teléfono la cierra en vez de
  sacar a la persona del sitio, con `Escape` y el click en el fondo por el mismo
  camino (`useCapaModal`, compartido con las dos capas del panel desde este
  mismo ítem — `src/lib/capaModal.ts`).
- **Chips en una fila con scroll horizontal** y desvanecido al borde. Nunca cuatro
  filas de chips comiéndose la pantalla.
- **CTA fijo abajo en el detalle**, con `pb-segura`. Es el único elemento fijo del
  sitio. ~~desde que el botón original sale de la pantalla~~ — esa cláusula obliga a
  medir el scroll, o sea JavaScript en la única página con presupuesto de 0 KB, y
  **D-145** cambió la regla en vez de la herramienta: en el teléfono el botón del flujo
  no se pinta y la barra es el único CTA, así que no hay nada que medir. Es `fixed` y
  no `sticky` porque el `overflow-x-hidden` del `body` rompe `sticky` en silencio.
- Blancos táctiles de `var(--spacing-touch)` (44px), que ya está definido; los
  `input` a 16px en pantallas chicas, que ya está resuelto en `global.css` (iOS
  hace zoom por debajo de eso y no vuelve).
- **Nada depende de `:hover`.** Todo estado tiene su forma visible sin puntero.
- Las imágenes con `loading="lazy"`, `decoding="async"` y `width`/`height`
  declarados: sin eso la lista salta mientras carga y se toca la tarjeta
  equivocada.
- Fechas cortas en móvil (`mié 24 sep · 19:00`) y largas de `sm` en adelante.
- El navegador embebido de Instagram no tiene barra de direcciones ni "compartir"
  cómodo: en el detalle va un botón "Compartir" que usa `navigator.share` si
  existe y copia el link si no.
- Presupuesto: **la página de detalle, 0 KB de JavaScript**. La home, solo la
  island de filtros.

---

## 9. Rendimiento y cache

| Recurso | `Cache-Control` | Por qué |
|---|---|---|
| `/_astro/**` | `max-age=31536000, immutable` | ya está: llevan hash |
| HTML | `no-cache` | ya está: revalida en cada visita, así un rebuild se ve |
| `/events.json` | `no-cache` | **cierra B-37.** No lleva hash en el nombre y cambia en cada rebuild. Un `max-age` corto haría que la lista del JSON contradiga al HTML |
| `/og/*.png` | `max-age=31536000, immutable` | archivos fijos del repo |

La island pide `/events.json?v={VERSION_APP}` — la misma versión que estampa el
build. Con `no-cache` no hace falta para el CDN, pero blinda contra un
intermediario mal configurado que sirva el JSON del build anterior contra el HTML
del nuevo, que es la única forma de que el sitio se contradiga consigo mismo.

Otras reglas:

- Fuentes: ya vienen de Google Fonts con `preconnect` y `display=swap` en
  `Base.astro`. No vale la pena self-hostear todavía.
- **Hay dos clases de imagen y no una, y el consejo de abajo vale solo para una.**
  Desde la segunda tajada de **B-167** una `Imagen` puede ser **propia** —subida
  desde el panel, con `storagePath`, `ancho` y `alto`— o **externa** (Instagram,
  Drive, un link que pegó quien organiza), y se distinguen por `origen`.
  - La **externa** es la que este bloque describía: no se optimiza en el build
    porque no la controlamos, y se le pone `referrerpolicy` más un `onerror` que
    la esconde, porque una imagen rota es peor que ninguna. Y **puede caerse
    mañana** sin que nos enteremos, que es el riesgo que el §7.6 nombraba para
    todas las imágenes y hoy es de la mitad de los casos.
  - La **propia** vive en nuestro Storage, así que no se cae sola, y **trae sus
    medidas**: `ancho` y `alto` son exactamente lo que hace falta para reservar
    el hueco con `aspect-ratio` y que la página no salte al cargar. **Ojo con
    dónde entra eso:** hoy `src/lib/eventsJson.ts` recorta el índice a
    `imagenUrl: portadaDe(a.imagenes)?.url ?? null` —conserva el nombre del
    diseño a propósito, ver su docblock— y **no lleva las medidas**. No está
    roto; pero el día que una tarjeta las quiera, el campo tiene que entrar al
    índice, y eso es agrandar una salida pública: pasa por el fixture de
    centinelas como cualquier otro campo nuevo. Y **la recompresión sigue sin
    existir** (B-220, DEC-7d), así que hoy se sirve el original: es B-266 y
    B-300.
- La home no bloquea nada esperando `events.json`: el HTML ya está completo.

---

## 10. Accesibilidad

Lo mínimo que no se negocia, y que además es lo que el buscador lee:

- Un solo `h1` por página, y jerarquía sin saltos.
- Link "Saltar al listado" como primer elemento enfocable.
- La tarjeta es un `<a>` con nombre accesible completo (título + fecha + lugar),
  no "leer más".
- `<time datetime="…">` en toda fecha.
- Los chips son `<button aria-pressed>`, no `div`s con `onclick`.
- El contador de resultados en un `aria-live="polite"`.
- La hoja de filtros de móvil cierra con `Escape`, con el botón y tocando el
  fondo, y **atrapa el foco**. Es la deuda que quedó abierta en **B-14** y
  **B-64** en el panel; en el sitio público se hace bien de entrada, y ese
  componente puede después resolver las dos.
- Foco visible en todo lo enfocable, con el acento.
- Contraste: **medido en B-227**, y la respuesta a la pregunta abierta es que el
  acento se puede usar en texto chico.

  **Los números de abajo se remidieron el 2026-08-31**, después de que D-141 tocara la
  paleta —el acento se profundizó a terracota— y B-253 sumara superficies. Los de
  B-227 (16,59 / 5,63 / 5,29 / 4,49) eran de la paleta anterior y quedaron viejos sin
  que nada lo dijera: son la clase de dato que hay que recalcular junto con el token,
  no copiar. La columna nueva es la que importa, porque el sitio ya no tiene un solo
  fondo.

  > ⚠️ **Esta tabla es de la paleta de D-141 y quedó vieja el 2026-08-31 — ver
  > D-146.** `acento-hondo` ya no existe y los tres tokens que quedan cambiaron de
  > valor. **`colorDeTipo` sí volvió**, el 2026-09-01 y con la misma banda de
  > luminosidad y croma — pero elegible desde Opciones (**D-150**), y sus números de
  > hoy salen de `tests/color-de-tipo.test.ts`: el peor de los 360 da **5,90:1**
  > sobre la más oscura de las **tres** superficies, no las dos de esta tabla. Los números de abajo son los de aquella paleta y se
  > dejan escritos para que el cambio se lea contra su original. **La tabla vigente
  > está en D-146**, y la calculan `tests/contraste-de-superficies.test.ts` y
  > `tests/sistema-visual.test.ts` sobre los tokens de `global.css` — que es lo que
  > hace que no haya que mantener una tabla a mano en dos lugares.
  >
  > El número que conviene recordar de la paleta nueva: **`azul` da 6,14:1 sobre el
  > papel y 4,99:1 sobre `hondo`**, así que el margen que sobra arriba casi no
  > existe abajo — y eso solo se ve midiendo contra las tres superficies.

  | | Sobre `papel` | Sobre `hondo` (la más oscura) | Veredicto |
  |---|---|---|---|
  | `tinta` | **16,35:1** | **14,73:1** | AAA de sobra |
  | `acento` | **5,59:1** | **5,04:1** | AA ✅ (no AAA) |
  | `acento-hondo` | **8,55:1** | **7,71:1** | AAA en texto grande |
  | `colorDeTipo`, el peor de los 360 tonos | **7,21:1** | **6,50:1** | AA ✅ (número de aquella paleta; hoy ver D-150) |
  | `papel` sobre `acento` (el botón) | **5,59:1** | — | AA ✅ |

  **Lo que sí falla es la rampa de opacidad**, que era el riesgo de verdad y no el
  acento. Sobre papel, `tinta/65` da 5,26 y pasa; `tinta/60` da 4,47 y queda justo
  abajo. **Sobre `hondo` el margen es menor todavía**: `tinta/65` da 5,04 y `tinta/61`
  ya da 4,38 —o sea que hay un rango que pasa sobre papel y no sobre una tarjeta— y
  ése es exactamente el hueco que `tests/contraste-de-superficies.test.ts` (B-256)
  cerró. `tinta/55` da 3,84 y `tinta/45` da 2,86, que no pasa ni para texto grande.
  La primera versión del sitio usaba las cuatro. **El piso es `tinta/65`** y lo
  verifica un test (`tests/contraste-del-sitio.test.ts` — `contraste.test.ts` es la
  matemática pura, otra cosa), que calcula los ratios y además
  falla si aparece una clase de texto por debajo del piso — porque esto es
  exactamente la clase de cosa que se afirma en una doc y se rompe en el componente
  siguiente.
- `prefers-reduced-motion` ya está respetado en `global.css`.

---

## 11. Lo que falta decidir

### 11.1 Decisiones del dueño

| # | Decisión | Por qué bloquea |
|---|---|---|
| 1 | ~~**El dominio final.**~~ **Resuelta el 2026-09-02: `https://agendaleh.ar`** (D-165). Se registró un dominio propio y también responde `agendaleh.com.ar`, que va a redirigir con un 301 en cuanto el dueño lo configure en la consola; `agenda-literaria.web.app` sigue sirviendo el mismo HTML para siempre, y el `canonical` absoluto es lo que evita que eso sea contenido duplicado. Con esto se cerró **B-109**: `site`, canonical, Open Graph, sitemap, robots y `/pasadas` | ✅ |
| 2 | ~~**Canal de contacto público.**~~ **Resuelta**: es lo que publica `/contacto` (**B-232**, **B-233**), con la lista de qué conviene contar — que es lo que el `mailto:` crudo del pie se salteaba. El bullet del §4.5 pedía «un canal» y hoy existe | ✅ |
| 3 | ~~**Nombre del sitio y una línea de qué es.**~~ **Resuelta: «Agenda LEH»** (**B-245**, D-141). Vive en `src/lib/identidad.ts` (`NOMBRE`, `BAJADA`) y es la única vez que se escribe: un test falla si alguna página lo pega literal. Antes el sitio se presentaba con su categoría —«Agenda literaria»—, que es lo contrario de tener nombre | ✅ |
| 4 | ~~**¿Se mide el sitio público?**~~ **Resuelta: sí, con un banner de consentimiento** (B-372/B-376, D-201, D-250, D-251). GA4 con `gtag.js` directo, condicionado a que la persona acepte — si rechaza, no se carga el tag y no se manda nada. El clic en el CTA de inscripción es uno de los dos eventos propios (B-375). Arquitectura completa en [`16-analitica-del-sitio.md`](16-analitica-del-sitio.md) | ✅ |
| 5 | **¿Un campo "acepta incorporaciones tardías"?** | Hoy "se puede entrar a un ciclo empezado" se deduce de `inscripcion.cierra` ([7.2](#72-un-ciclo-en-curso)). Un booleano lo diría sin ambigüedad |
| 6 | **¿La descripción admite formato?** | Hoy es texto plano: un link pegado no es clickeable y no hay negritas ni listas. Opciones: dejarlo así, autolinkear las URLs (barato, y hay que escapar bien), o markdown acotado (cambia el formulario, la vista previa y el evento de Calendar) |
| 7 | **¿Cuánto vive una actividad pasada en el índice?** | La propuesta es para siempre, con 90 días en el sitemap ([7.1](#71-una-actividad-que-ya-pasó)). La alternativa es `noindex` al año, para que el sitio no crezca en páginas muertas |
| 8 | **Páginas por organizador.** | Es la sección con más potencial que quedó afuera, y necesita un slug de organizador — o sea, decidir si el organizador pasa a ser una entidad del modelo y no un texto por actividad |

### 11.2 Cambios a `toPublic.ts`

Lo que el diseño necesita y hoy no se proyecta. Ninguno agrega datos privados:
son datos que ya se muestran en público por otros caminos.

| # | Campo | Para qué | Prioridad |
|---|---|---|---|
| 1 | **`inscripcion.cierraEn`** (ISO de `cierra`) | Dos cosas. Una: la página quiere decir "las inscripciones cierran el 22 de septiembre", que es lo que hace que alguien escriba hoy. Dos, y más grave: **`abierta` se calcula con `Date.now()` del build** y se congela. Una inscripción que cerró a la mañana sigue diciendo "abierta" hasta el rebuild siguiente, y con el rebuild automático todavía pendiente (**B-20**) eso puede ser días. Con la fecha, el HTML dice la verdad y el cliente la recalcula. **Es un bug, no una mejora** → **B-111** | alta |
| 2 | **`estado`** (`'publicado' \| 'cancelado'`) | Para pintar la franja CANCELADA y emitir `eventStatus`. Hoy la proyección no lo lleva, así que el HTML no puede distinguirlo | alta |
| 3 | ~~**`actualizadoEn`** (ISO de `updatedAt`)~~ — **hecho el 2026-09-03, la mitad del `lastmod`** (B-112). `lastmodDelSitemap` la arma desde `publicadasEditadasEn`, que sigue viajando **al lado** de la proyección y no adentro de `toPublic` — el mismo patrón que `canceladasEditadasEn` (D-166). La otra mitad, "actualizado el …" en el detalle, quedó afuera a propósito: es una decisión de contenido visible y no de plomería, y no la resolvía este ítem | `lastmod` del sitemap, con la fecha recortada al día (D-138) | hecha |
| 4 | ~~**`publicadaAlgunaVez`** (o la heurística de `calendarEventId`)~~ — **resuelto por ahora sin campo nuevo** (B-110, D-159): se prueba por el historial. El campo explícito queda en **B-285** | Que una cancelada no se convierta en 404, sin publicar un borrador ([7.3](#73-una-actividad-cancelada)). Es un campo del **modelo**, no solo de la proyección | media |
| 5 | **`arancel.monto` + `moneda`** | `offers.price` del JSON-LD, que es lo que hace que Google muestre el precio en el resultado. Campo del modelo → **B-114** | baja |
| 6 | **`sede.provincia`** | `addressRegion` del `PostalAddress`. Se puede omitir sin romper el resultado enriquecido | baja |
| 7 | **`resumen` / copete escrito a mano** | Hoy se corta la descripción a 160 caracteres para la `meta description`. Una frase escrita a propósito rinde bastante más en el clic desde el buscador | baja |
| 8 | **`organizador.slug`** | Solo si se hacen páginas por organizador (decisión 8) | — |

### 11.3 Cosas que este diseño **quita** del JSON

No hace falta decidirlas, pero conviene que estén dichas: `events.json`
**no** lleva `descripcion`, `inscripcion.destino`, `sede.direccion`, `sede.geo`,
`sede.indicaciones`, `modalidades` (el índice se queda con el derivado
`modalidad`), `material`, `tallerista.bio`, `sesiones[].tema` ni
`sesiones[].lectura`. Todo eso sigue siendo público en el HTML de la página de
detalle, que es donde se usa. `toPublic.ts` **no cambia** por esto: el recorte lo
hace el build al armar el índice del listado
([§3.1](#31-la-frontera-de-privacidad-es-topublic-y-el-listado-recorta-todavía-más)).

---

## 12. Qué queda afuera de la primera versión

Y por qué. Todo esto está pensado y descartado a propósito, no olvidado.

| Afuera | Motivo |
|---|---|
| **Páginas por organizador y por tallerista** | Es lo más valioso que falta —"todo lo de Casa Brandon" es una consulta real— pero necesita que el organizador sea una entidad con slug, no un texto por actividad. Con texto libre serían páginas duplicadas por cada variante de tipeo. Necesita decisión de modelo primero |
| **Páginas por tema (`tags`)** | Depende de **B-05** (etiquetas sin normalizar) y **B-06** (sin UI de administración). Un typo cargado una vez se convertiría en una URL indexada que después hay que sostener |
| **Páginas por ciudad** | El hub más valioso después de barrio, pero `sede.ciudad` todavía no es taxonomía: hoy sería "CABA", "Caba", "Capital Federal" y "Buenos Aires" como cuatro ciudades |
| **RSS / ICS por hub** | "Suscribirme a los talleres de Boedo" es lindo y es barato de generar, pero el Google Calendar público ya cubre la necesidad de suscripción, y sumar dos formatos más de la misma agenda multiplica lo que puede quedar desincronizado |
| **Mapa con todas las sedes** | `sede.geo` ya está en el modelo y tentaría, pero un mapa es una librería de ~50 KB, tiles de terceros y una API que puede ser paga. El caso real —"cómo llego a esta actividad"— lo resuelve el link a Google Maps que ya existe |
| **Guardar favoritos / recordatorios** | Necesita estado del usuario. El proyecto no tiene usuarios públicos y no quiere tenerlos; el recordatorio lo da el Google Calendar |
| **Compartir con imagen generada por actividad** | Un renderer de imágenes en el build (satori y compañía) por una ganancia que las cinco imágenes por tipo cubren en un 80% |
| **Paginación / scroll infinito** | Con el volumen actual, la lista completa en HTML es mejor para todo: SEO, sin-JS, y buscar con Ctrl+F. Cuando haga falta, el corte es temporal (6 meses en la home) y no un botón que esconda contenido |
| **Selector de orden** | No hay un segundo criterio que alguien pida ([§6.1](#61-cuáles-en-orden-de-importancia)) |
| **Modo oscuro** | El lenguaje visual es papel y tinta. Un papel oscuro es otra decisión de marca, y no es de este documento |
| **Traducción / hreflang** | Un solo idioma y un solo país |

**«Analítica del sitio público» ya no va en esta lista.** Era la decisión 4 de
[§11.1](#111-decisiones-del-dueño), y esa nota decía «arrancar sin una sola
cookie es un buen lugar donde estar» — describía un estado de espera, no algo
descartado a propósito, y la decisión 4 ya se resolvió: hay banner de
consentimiento y GA4 mide con el permiso de quien visita
([`16-analitica-del-sitio.md`](16-analitica-del-sitio.md)).

---

## 13. Los pedazos, en orden

Los ítems están en el [backlog](BACKLOG.md), **B-105** a **B-114**. El orden en
que conviene construirlos:

1. ~~**B-109** — `site` en la config, `robots.txt`, `sitemap.xml`.~~ **Hecho el
   2026-09-02** (D-165, D-166, D-167), y salió **último** en vez de primero: la
   decisión del dominio tardó, y el resto del sitio se construyó sin URLs
   absolutas a propósito —cada lugar que las necesitaba dejó escrito que faltaban,
   con su ítem— en vez de inventar un dominio que después habría que mudar.
2. **B-106** — la lectura de Firestore en build time y `events.json`.
3. **B-105** — el detalle (`/actividad/{slug}`) y después la home. El detalle
   primero: es el que recibe el tráfico y no lleva JavaScript.
4. **B-107** — meta, Open Graph y JSON-LD. Va pegado a B-105: una página de
   detalle sin `Event` no sirve para lo que existe el proyecto.
5. **B-111** y **B-112** — los campos que faltan en la proyección. Antes de los
   hubs, porque el detalle ya los necesita para no mentir.
6. ~~**B-110** — las canceladas.~~ **Hecho el 2026-09-01** (D-159).
7. ~~**B-108** — los hubs.~~ **Hecho el 2026-09-02.**
8. **B-113**, **B-114** — meses y precio, cuando el resto esté en pie.
