# Inventario de archivos — los cuatro PRDs, archivo por archivo

**Para qué es este documento:** para que la sesión de código no arranque
explorando. Cada fila dice **qué archivo**, **qué le pasa** y **de dónde se copia
el patrón**. Relevado el 2026-09-08 contra el árbol real del repo en `744f732`.

Si un archivo de acá no existe o cambió de nombre, este documento envejeció —
verificarlo antes de confiar, que es la regla del `docs/README.md`.

---

## 0 · Cómo leerlo

- **Crear** = archivo nuevo. La columna «se copia de» no es decorativa: en este
  repo casi todo lo nuevo tiene un hermano ya construido y probado, y arrancar de
  ahí es más rápido y sale más parecido al resto.
- **Tocar** = archivo existente que hay que modificar. Si un cambio de estos se
  olvida, la columna «qué se rompe» dice si algo lo agarra o si pasa en silencio.
- **⚠️ en silencio** = ningún test, ningún build y ninguna auditoría lo detectan.
  Son los que hay que hacer primero, no últimos.

---

## 1 · Lo que se crea

### 1.1 · Tipos y schemas

| Archivo | Qué es | PRD | Se copia de |
|---|---|---|---|
| `src/types/propuesta.ts` | `Propuesta`, `ESTADOS_PROPUESTA` | 1 | `src/types/reporte.ts` — mismo tamaño, mismo tipo de ciclo de vida, mismos topes documentados |
| `src/types/libreria.ts` | `Libreria` | 2 | `src/types/actividad.ts` (la parte de `sede` e `Imagen`) |
| `src/types/suscripcion-literaria.ts` | `SuscripcionLiteraria` | 3 | idem. **Ojo con el nombre**: `src/lib/suscripcion.ts` ya existe y es la página del calendario |
| `src/types/lugar.ts` | `Lugar` | 4 | idem |
| `src/lib/propuesta-schema.ts` | zod del formulario público de propuestas | 1 | `src/lib/reporte-schema.ts` — es el mismo caso: schema chico, `formAReporte`, `reporteVacio` |
| `src/lib/libreria-schema.ts` | zod | 2 | `src/lib/schema.ts` (la parte de `actividadFormSchema`, no el archivo entero) |
| `src/lib/suscripcion-literaria-schema.ts` | zod | 3 | idem |
| `src/lib/lugar-schema.ts` | zod | 4 | idem |

**Los topes de largo se dicen en tres lugares y tienen que ser el mismo número**
(`firestore.rules`, el schema de zod, el `maxLength` del input). Está resuelto y
atado: `TOPE_TITULO_REPORTE` en `src/types/reporte.ts` + el test «los tres topes de
120 son el mismo límite» de `tests/clases-de-bug.test.ts` (B-364). **Copiar ese
patrón, no reinventarlo**: la regla de Firestore no puede importar TypeScript, así
que el único modo de atarla es un test que lea el archivo.

### 1.2 · Lógica de dominio

| Archivo | Qué es | PRD | Se copia de |
|---|---|---|---|
| `src/lib/propuestas.ts` | `propuestaAFormulario()` — la conversión a `ActividadFormValues`, **pura** | 1 | nada; es nuevo. Lo que sí se reusa: `sesiones.ts` para los `ses_<uuid>` y la aritmética de fechas |
| `src/lib/directorios.ts` | **el motor compartido** (B-834): estados, transiciones, qué puede editar un admin, derivación de slug, el `estado`→visibilidad | 2/3/4 | la parte de `actividades.ts` que no es de actividad |
| `src/lib/librerias.ts` | lectura en build + proyección pública | 2 | `src/lib/actividades.ts` + `src/lib/toPublic.ts` |
| `src/lib/suscripcionesLiterarias.ts` | idem | 3 | idem |
| `src/lib/lugares.ts` | idem | 4 | idem |
| `src/lib/datoConFecha.ts` | **B-837** — `DatoConFecha<T>`, el formateo «cargado el 12/09» y la regla de que no se muestra el valor sin la fecha | 2/3/4 | `src/lib/fechasPublicas.ts` para el formateo |
| `src/lib/fichaPublica.ts` | las frases de la tarjeta de un directorio (qué dice el chip, el lugar, la condición) | 2/3/4 | `src/lib/tarjetaPublica.ts`, que hace exactamente esto para la fila de una actividad |

> **`toPublic` por entidad, no genérico.** La proyección es una **whitelist**
> (§5.2 del `CLAUDE.md`) y ahí está toda la seguridad de esto: un `pick` con la
> lista escrita a mano. Un `toPublic` genérico que proyecte «todo menos lo
> prohibido» invierte el default y el primer campo nuevo sale solo. **No hacerlo.**

### 1.3 · Páginas del sitio público

| Archivo | Qué es | PRD | Se copia de |
|---|---|---|---|
| `src/pages/proponer.astro` | el formulario público de propuestas | 1 | `src/pages/contacto.astro` (chrome + texto desde un `lib`) |
| **`src/pages/guia/index.astro`** | **el índice de la Guía** — la pestaña nueva lleva acá, y sin esta página `/guia/librerias` es una URL cuyo padre no existe | 2 | `src/pages/index.astro` (la parte de la tira de hubs) + `src/components/sitio/ExploraPor.astro` |
| `src/pages/guia/librerias/index.astro` | el listado | 2 | `src/pages/cartelera.astro` |
| `src/pages/guia/librerias/[slug].astro` | la ficha, SSG | 2 | `src/pages/actividad/[slug].astro` |
| `src/pages/guia/librerias/sumar.astro` | formulario público | 2 | `proponer.astro` |
| `src/pages/guia/suscripciones/{index,[slug],sumar}.astro` | idem | 3 | idem |
| `src/pages/guia/lugares/{index,[slug],sumar}.astro` | idem | 4 | idem |
| `src/pages/librerias.json.ts` | el JSON del listado | 2 | `src/pages/events.json.ts` |
| `src/pages/suscripciones.json.ts` | idem | 3 | idem |
| `src/pages/lugares.json.ts` | idem | 4 | idem |

> **Las URLs llevan `/guia/`; las colecciones y los JSON no.** El documento vive en
> `/librerias/{id}` y el endpoint es `/librerias.json` —un artefacto, no una página
> navegable—; lo que va bajo `/guia/` son las páginas. Decidido el 2026-09-08
> (`prd/README.md` § «Las decisiones del dueño»). Si mañana el JSON también se mueve,
> es un cambio de `rutasPublicas.ts` y del `fetch` del island, no del modelo.

**Los formularios públicos son islands de React** (`client:only`), como el panel:
son formularios con estado y validación. Y ahí hay un cuidado propio de este repo:
**`tests/bundle-panel.test.ts` verifica que el bundle pesado del panel no se cuele
al sitio público** (§9). Un formulario público que importe de
`src/components/admin/` arrastra el panel entero a una página pública. **Los
componentes compartidos van a `src/components/campos/`, no a `admin/`.**

### 1.4 · Componentes

| Archivo | Qué es | PRD | Se copia de |
|---|---|---|---|
| `src/components/publico/FormularioPublico.tsx` | el envoltorio: honeypot, tiempo mínimo, App Check, estado de envío, pantalla de gracias | 1/2/3/4 | `src/components/admin/ReporteFormulario.tsx` |
| `src/components/publico/FichaDeDirectorio.tsx` | la tarjeta del listado | 2/3/4 | `src/components/publico/FilaDeActividad.tsx` |
| `src/components/publico/BuscadorDeDirectorio.tsx` | filtros en memoria | 2/3/4 | `src/components/publico/Buscador.tsx` |
| `src/components/admin/PropuestasPanel.tsx` | la bandeja | 1 | `src/components/admin/ReportesPanel.tsx` |
| `src/components/admin/DirectorioPanel.tsx` | lista + alta + edición de las tres entidades | 2/3/4 | `src/components/admin/ListaActividades.tsx` + `TaxonomiasPanel.tsx` |
| `src/components/admin/useDirectorio.ts` | el hook de datos | 2/3/4 | `src/components/admin/useActividades.ts` |

**Mover a compartido** (hoy viven en `admin/` y los va a necesitar el sitio):
`campos/Campo.tsx`, `campos/Seccion.tsx`, `campos/TaxonomiaSelect.tsx`,
`campos/ChipsInput.tsx`. Es un movimiento de archivos con actualización de imports,
y conviene hacerlo **en su propio commit**, antes de todo lo demás.

> ⚠️ **Y arreglar B-827 al moverlos, no después.** El `label` de `Campo` lleva un
> `htmlFor` **opcional** y once usos no lo pasan, así que un lector de pantalla no
> anuncia el nombre del campo. Hoy eso afecta al panel, que usan cuatro personas.
> Moverlo al sitio público sin arreglarlo lo convierte en un problema de
> accesibilidad de una página pública.

### 1.5 · Functions

| Archivo | Qué es | PRD | Se copia de |
|---|---|---|---|
| `functions/directorios.js` | puro: qué cambios ameritan rebuild | 2/3/4 | `functions/rebuild.js` |
| `functions/directorios-trigger.js` | `onDocumentWritten` sobre las tres colecciones | 2/3/4 | `functions/opciones-trigger.js` — es literalmente el mismo caso (§4.4: «el rebuild debe dispararse también cuando cambia `/opciones/*`») |
| `functions/retencion.js` + `functions/retencion-trigger.js` | `onSchedule` que a los **30 días** (**DEC-13**) borra la propuesta rechazada **y su imagen**. El puro decide qué caducó; el trigger borra documento y objeto | 1 | `functions/limpieza-versiones.js` + `versiones-limpieza-trigger.js`, y `functions/limpieza-imagenes.js` para el lado del bucket |
| `functions/propuestas.js` + su trigger | el borrado **al rechazar**, que es otro momento: no espera al barrido | 1 | `functions/limpieza-imagenes.js` |

**`functions/` no puede importar de `src/`** (D-20): la lista de colecciones y los
plazos se escriben del lado de la Function y se atan con un test, como se hizo con
`cargarLabels`.

### 1.6 · Reglas

| Archivo | Qué cambia |
|---|---|
| `firestore.rules` | cuatro `match` nuevos + cuatro funciones de validación. **Es el archivo más delicado de todo el trabajo**: es donde vive la primera escritura anónima del proyecto |
| `storage.rules` | **en alcance, DEC-11 se contestó «puede subir imagen»**: prefijo `propuestas/` con `write` anónimo acotado (1 archivo, 3 MB, tipos de imagen), **`get` y `list` en `false`** (trampa 13), y el límite dicho también en el schema porque el cliente se saltea |
| `firestore.indexes.json` | probablemente nada: las lecturas del build son `where('estado','==','publicado')` sin orden compuesto |

---

## 2 · Lo que se toca

### 2.1 · Rutas, navegación y SEO — el circuito que no perdona un olvido

| Archivo | Qué cambia | Qué se rompe si se olvida |
|---|---|---|
| `src/lib/rutasPublicas.ts` | **primero esto**: `RUTA_GUIA`, `RUTA_LIBRERIAS` (= `/guia/librerias/`), `RUTA_SUSCRIPCIONES`, `RUTA_LUGARES`, `RUTA_PROPONER`, los `PREFIJO_*` de cada ficha y sus constructores, **todos por `rutaCanonica`**. El `/guia/` se escribe **una vez acá** y no en cada página | Un `href` a mano cuesta un 301 por click y deja dos textos de la misma URL (era B-293, y B-330 lo cerró) |
| `src/components/sitio/Encabezado.astro` | **una** entrada en `ENLACES` —«Guía»— + un valor en el tipo `Seccion`. **Una, no tres y no cuatro**: los tres directorios viven bajo `/guia/` y `/proponer` no es pestaña. Hoy hay siete y el propio archivo lo dice en un comentario («Quedan siete pestañas. Si en algún momento no entran…»); **con esto son 8**, y eso es lo que desinfló B-835 | `tests/chrome-del-sitio.test.ts` exige encabezado y pie en toda página del sitio |
| `src/components/sitio/PieDePagina.astro` | los mismos destinos | — |
| `src/layouts/Base.astro` | el union de `seccion` gana tres valores | El chrome sale apagado (su default es `'ninguna'`, a propósito, por `/admin`) |
| `src/lib/sitemap.ts` | `RUTAS_FIJAS` gana **`/guia/`**, `/guia/librerias/`, `/guia/suscripciones/`, `/guia/lugares/` y `/proponer/`; y `rutasDelSitemap`, las fichas | ⚠️ **en silencio**: las páginas existen y Google no las ve. `tests/sitemap.test.ts` cubre la forma, no la completitud |
| `src/pages/sitemap.xml.ts` | pasarle las fichas nuevas | idem |
| `src/pages/robots.txt.ts` | nada, salvo que se decida no indexar algún formulario | — |
| `src/lib/schema.ts` | `BookStore`, `Place`, `Product`/`Offer` | ⚠️ en silencio: el SEO del directorio es el marcado |
| `src/lib/hubsPublicos.ts` | si las librerías entran a los hubs de barrio (PRD 2 §2) | — |
| `src/pages/barrio/[barrio].astro` | idem | — |
| `astro.config.mjs` | nada esperado (el `site` sale de `rutasPublicas.ts`) | — |

### 2.2 · El build

| Archivo | Qué cambia | Qué se rompe si se olvida |
|---|---|---|
| `src/lib/contenidoDelSitio.ts` | lee las tres colecciones nuevas con su `where('estado','==','publicado')`, y expone `caminosDeLibreria`, `caminosDeLugar`, … | ⚠️ Sin el `where`, se publica lo pendiente. **Es el agujero más caro de los cuatro PRDs** |
| `src/lib/toPublic.ts` | **no se toca** para las tres entidades (cada una tiene su proyección). Sí si `incluye` entra a la actividad | El campo nuevo no sale — que es el default correcto |
| `src/lib/firebase-admin.ts` | nada | — |

### 2.3 · El campo `incluye` de la actividad (PRD 1 §5)

Esto es un **`/campo-nuevo` completo** y el skill ya recorre las seis salidas. Los
archivos que toca, para que se vea el tamaño: `src/types/actividad.ts`,
`src/lib/schema.ts`, `src/lib/formulario/*`, `src/components/admin/formulario/SeccionQueEs.tsx`,
`src/lib/toPublic.ts`, `src/lib/eventsJson.ts`, `src/lib/detallePublico.ts`,
`src/lib/tarjetaPublica.ts`, `functions/calendario.js` (¿va al evento? — **no**),
`src/lib/analytics-eventos.ts`, `src/lib/ayuda.ts`, `docs/03-modelo-de-datos.md`.

**Invocar el skill, no hacerlo a mano.** Para eso existe.

### 2.4 · Taxonomías

| Archivo | Qué cambia |
|---|---|
| `src/types/actividad.ts` | `CAMPOS_TAXONOMIA` (hoy `['arancel','tipo','barrio','plataforma','tags']`) gana: `incluye-actividad`, `tipo-libreria`, `periodicidad`, `perfil-editorial`, `incluye-suscripcion`, `extras-suscripcion`, `alcance-envio`, `tipo-oferente`, `tipo-lugar`, `incluye-lugar`, `condicion-de-uso` |
| `src/lib/opciones-base.json` | las opciones `fijo: true` de cada uno |
| `src/lib/opciones.ts` | nada estructural: todo se deriva de `CampoTaxonomia` |
| `scripts/seed-emulador.mjs` | **nada** — recorre `opciones-base.json` solo. Verificado |
| `src/components/admin/taxonomias/TaxonomiasPanel.tsx` | revisar que once campos más entren en la pantalla |
| `functions/etiquetas.js` | la carga de labels de la Function, que no puede importar de `src/` (D-20) |

> **Once vocabularios nuevos de golpe es mucho.** Vale preguntarse cuáles se
> pueden empezar como texto libre. Mi recomendación: `tematica` (PRD 3) queda
> libre; el resto son ejes de filtro y necesitan slug.

### 2.5 · Panel

| Archivo | Qué cambia | Qué se rompe si se olvida |
|---|---|---|
| `src/components/admin/AdminApp.tsx` | cuatro vistas nuevas en el `Vista` y en la cadena de ternarios (`:463-490`), más sus botones y badges | — |
| `src/lib/anchoDelPanel.ts` | si las vistas nuevas van a todo ancho (`VISTAS_A_TODO_ANCHO`, `ocupaTodoElAncho`). **Ojo con el vecino**: `src/lib/vistaDelPanel.ts` se llama parecido y es otra cosa —la preferencia PC/celular del formulario, B-814— y no va acá | `tests/ancho-del-panel.test.ts` |
| `src/lib/salida-del-panel.ts` | el aviso de salir con el formulario sucio: `VISTAS_CON_FORMULARIO` y `tieneFormulario` para las vistas nuevas | `tests/salida-del-panel.test.ts` |
| `src/lib/ayuda.ts` | `CAPITULOS` + `CAPITULO_POR_CONTEXTO` para las pantallas nuevas | ⚠️ El `?` de la sección apunta a un capítulo que no existe (era B-795) |
| `src/lib/novedades.ts` | una `Novedad` por tajada — es lo que le avisa al dueño que la pantalla nueva existe | ⚠️ en silencio |
| `src/lib/analytics-eventos.ts` | `FUNCIONES`, `SECCIONES`, `CAMPOS_TAXONOMIA_MEDIBLES` | `tests/analytics-campos.test.ts` y `analytics-eventos.test.ts` fallan si el vocabulario no está |
| `src/lib/estadoDelCatalogo.ts`, `src/lib/resumenDelSitio.ts` | si el tablero cuenta las entidades nuevas | — |

### 2.6 · Sitio: ayuda, contacto y textos

| Archivo | Qué cambia | Qué se rompe si se olvida |
|---|---|---|
| `src/lib/enlaces.ts` | **B-839**: Instagram como canal de contacto. Y **`sugerencia` se queda** (DEC-10: «`/contacto` queda también»): el `mailto:` sigue, con su `ayuda` reescrita para mandar primero a `/proponer` | `tests/enlaces.test.ts` barre las URLs |
| `src/lib/contactoDelSitio.ts` | el bloque de Instagram. **`BLOQUES_DE_CONTACTO` deja de ser homogéneo**: un DM no tiene `asunto` | `tests/contacto-del-sitio.test.ts` exige que cada bloque salga de `MOTIVOS_DE_CONTACTO` |
| `src/lib/ayudaDelSitio.ts` | `GRUPOS_DE_AYUDA` y `PREGUNTAS_DE_AYUDA`: cómo propongo, qué pasa después, qué se guarda | ⚠️ **B-785 es el precedente**, y su mitad cerrada es la que enseña: la ayuda de una página nueva se olvida con la misma facilidad con la que se olvidó `/apoyar`. Ahí ya está corregido —lo que sigue abierto de B-785 es el `Organization` del §5.5, no la ayuda—; acá hay que hacerlo desde el día uno |
| `src/lib/comercialDelSitio.ts` | `/anunciar` le habla al mismo público que `/guia/lugares/sumar` (PRD 4 § 2) | `tests/comercial-del-sitio.test.ts` prohíbe cifras de audiencia |
| `src/lib/noEncontrado.ts` | el 404 sugiere secciones; hay tres más | — |
| `src/lib/identidad.ts` | color por tipo de entidad, si los directorios usan la misma paleta | `tests/contraste-del-sitio.test.ts` |

### 2.7 · Analítica del sitio

| Archivo | Qué cambia |
|---|---|
| `src/lib/analyticsSitio.ts`, `src/lib/medicionSitio.ts` | el evento de «propuesta enviada» y las vistas de directorio — **sin contenido del formulario** |
| `src/components/sitio/AvisoDeCookies.astro` | nada, pero **el consentimiento se aplica igual**: `tests/terceros-antes-del-consentimiento.test.ts` |
| `docs/16-analitica-del-sitio.md` | las preguntas nuevas que el tablero contestaría |

---

## 3 · Los tests que hay que hacer crecer

Estos **ya existen** y son los que convierten «me acordé» en «no se puede
olvidar». La columna de la derecha es lo que hay que agregarle a cada uno.

| Test | Qué le falta con estos PRDs |
|---|---|
| `tests/barrido-de-salidas-publicas.test.ts` | **el más importante.** Anclar `LibreriaPublica`, `SuscripcionPublica`, `LugarPublico` con sus centinelas, y el control negativo codificado (meter el spread y exigir que falle nombrando el campo) — la forma de B-212 |
| `tests/sin-datos-personales.test.ts` | las cuatro colecciones nuevas y el `contactoDeQuienCargo` |
| `tests/promesas-sobre-datos.test.ts` | `/proponer` y los tres `sumar`: ninguna página puede prometer que no se guarda nada |
| `tests/clases-de-bug.test.ts` | (a) los topes dichos en tres lugares, por entidad; (b) **la tercera instancia del par flag+dato** (`direccionPublica`, PRD 4 §6) junto a `urlPublica` y `material.publico`; (c) los ids de array únicos (B-816 sigue abierto) |
| `tests/canonico.test.ts` | las páginas nuevas con su barra final |
| `tests/sitemap.test.ts` | las rutas fijas nuevas |
| `tests/chrome-del-sitio.test.ts` | las páginas nuevas llevan encabezado y pie |
| `tests/historial-restaurar.test.ts` | `flagsDePublicacionRestaurables` con el caso de `direccionPublica` (B-819) |
| `tests/mapa-de-trampas.test.ts` + `docs/15-mapa-de-trampas.md` | la trampa 13 aplicada al prefijo nuevo de Storage |
| `tests/red-de-contencion.test.ts` + `docs/13-agentes.md` | la tabla de «qué se decidió no automatizar» crece |
| `tests/agentes-y-skills.test.ts` | si nace un skill o un auditor nuevo, **hay que documentarlo o la suite queda roja** (B-826) |
| `tests/bundle-panel.test.ts` | que los formularios públicos no arrastren el panel |
| `tests/salud-del-codigo.test.ts` | cero ciclos de import, y `docs/10-salud-del-codigo.md` sin apuntar al vacío |
| `tests/emulador.ts` + los `*.integracion.test.ts` | **un archivo de integración por colección nueva**: `propuestas.integracion.test.ts`, `librerias.integracion.test.ts`, … Es donde se prueba la escritura anónima de verdad. `tests/reportes.integracion.test.ts` es el molde |
| `scripts/build-contra-emulador.mjs` | el gate del build tiene que sembrar las colecciones nuevas (es lo que B-804 dejó anotado para el arancel) |
| `tests/storage-reglas.integracion.test.ts` | **el prefijo `propuestas/` con DEC-11**: que un anónimo pueda escribir uno de 3 MB y no dos, que no pueda `get` ni `list`, y que no pueda escribir en `imagenes/` |
| `tests/miniaturas-storage.integracion.test.ts` | que el trigger de optimización **no** toque `propuestas/` (trampa 12) |
| `tests/limpieza-imagenes.test.ts` | el barrido como red del borrado nuevo, no como su mecanismo |

**Nuevos, uno por tema:** `propuestas.test.ts` (la conversión pura),
`directorios.test.ts` (el motor), `dato-con-fecha.test.ts` (B-837),
`escritura-anonima.integracion.test.ts` (lo que un anónimo **no** puede hacer, que
es el test que más vale de todos).

---

## 4 · La doc que hay que actualizar

Regla de proceso del repo: **un cambio no está terminado hasta que la
documentación lo refleja** (§ del `CLAUDE.md`, y `docs/05-patrones.md`). El skill
`/cerrar-cambio` lo hace; esto es la lista de lo que va a tocar.

| Documento | Qué le entra |
|---|---|
| `CLAUDE.md` | **§5.3 cambia de forma**: deja de ser cierto que sin el claim `admin` no hay escritura. Y una trampa nueva en el §13: «un formulario público es un endpoint de escritura» |
| `docs/03-modelo-de-datos.md` | las cuatro colecciones y los once vocabularios |
| `docs/04-funcionalidades.md` | las pantallas nuevas del panel y del sitio |
| `docs/07-seguridad.md` | **lo más largo**: las salidas públicas nuevas (hoy 18, en tres tablas atadas), las dos clases de contacto, y la primera escritura anónima |
| `docs/12-sitio-publico.md` | las tres secciones nuevas, sus URLs y su SEO |
| `docs/06-decisiones.md` | una entrada por decisión: las fechas como string (PRD 1 §4.1), el precio fuera del JSON-LD (PRD 3 §5), la dirección de una casa (PRD 4 §6), el nombre de la barra (PRD 3 §2) |
| `docs/13-agentes.md` | los paths que despiertan al `auditor-privacidad` y al `auditor-trampas` |
| `docs/15-mapa-de-trampas.md` | la trampa nueva con su test |
| `docs/09-analitica.md` y `docs/16-analitica-del-sitio.md` | los eventos nuevos |
| `docs/BACKLOG.md` y `docs/CHANGELOG.md` | siempre |
| `docs/02-infraestructura.md` | **App Check** es infra nueva: qué se habilitó, con qué proveedor, y qué pasa si se cae |

---

## 5 · Orden de trabajo, por commit

Cada línea es un commit que deja la suite verde. Es lo que hizo que once frentes
en paralelo no se pisaran (`EN-CURSO.md`): **commits atómicos y propiedad
exclusiva de archivos**.

**Tajada 0 — el piso (no toca producto)**
1. Mover `campos/*` de `admin/` a `components/campos/` + arreglar **B-827** (el `htmlFor`).
2. `src/lib/datoConFecha.ts` + su test (**B-837**).
3. App Check **documentado** (**B-836**) + `escritura-anonima.integracion.test.ts`
   afirmando que **hoy** nadie puede escribir. Ese test es el control positivo de
   todo lo que viene. **Habilitarlo** no se puede desde el repo —registrar la app
   pide una clave de sitio de reCAPTCHA v3 desde la consola, mismo caso que el
   proveedor Google de Auth— así que quedó como acción manual del dueño,
   **B-836a**, con el orden de los dos interruptores escrito: exigir antes de que
   el cliente mande tokens deja al panel sin poder escribir.

**Tajada 1 — propuestas (B-830)**
4. `incluye` en la actividad, con `/campo-nuevo`.
5. `/propuestas`: tipo, schema, reglas, test de integración.
6. `src/lib/propuestas.ts` + su test (uuid, timezone, sin slug).
7. `PropuestasPanel` + «convertir en actividad».
8. **La imagen (DEC-11), en su propio commit y antes del formulario:** el prefijo
   `propuestas/` en `storage.rules` con `get`/`list` en `false`, la guarda del
   prefijo en el trigger de optimización (trampa 12), la promoción a `imagenes/` al
   aceptar, y el borrado al rechazar. Con su test contra el emulador de Storage —
   `tests/storage-reglas.integracion.test.ts` es el molde.
9. `/proponer` + `FormularioPublico`, ya con la subida enganchada.
10. `/contacto` con Instagram (**B-839**). **`sugerencia` se queda** (DEC-10) y su
    texto manda primero a `/proponer`.
11. Retención a 30 días (**DEC-13**), documento **e** imagen, + doc + CHANGELOG.

**Tajada 2 — el motor, la Guía y librerías (B-834 + B-835 + B-831)**
12. `src/lib/directorios.ts` + `DirectorioPanel` genérico.
13. **B-835, que ya es chico**: la pestaña «Guía» y `src/pages/guia/index.astro`.
    Va **antes** del paso 14, no después: `/guia/librerias` sin `/guia` es una URL
    cuyo padre no existe. La decisión que hacía grande a este ítem —la forma de la
    URL— está tomada (`/guia/*`, 2026-09-08), y con ella la barra gana **una**
    pestaña en vez de tres.
14. `/guia/librerias` de punta a punta: tipo, schema, reglas, panel, listado, ficha,
    JSON, sitemap, `BookStore`, rebuild.

**Tajada 3 — suscripciones (B-832)** · **Tajada 4 — lugares (B-833)**
Las dos calcadas de la 2, sin el paso 13 (la Guía ya existe) y **sumando una fila a
`/guia`** cada una. En lugares, `direccionPublica` y su par en el historial (B-819)
van **en el mismo commit** que el campo.

---

## 6 · Las nueve cosas que se rompen en silencio

Ninguna de estas pone el build en rojo. Son la checklist de antes de dar por
cerrada cada tajada, y las cinco primeras son las caras — las dos nuevas entraron
con DEC-11, que es lo que cuesta poder subir la imagen.

1. **Falta el `where('estado','==','publicado')`** en la lectura del build → se
   publica lo pendiente, incluido el contacto interno.
2. **El campo interno entra a la proyección** por un spread → dato privado
   publicado. Lo agarra el barrido **solo si la interfaz está anclada**.
3. **`direccionPublica` restaurado sin su dirección** (o al revés) → B-819 otra vez,
   con la dirección de la casa de alguien.
4. **La propuesta se borra y su imagen queda viva** (o al revés). Con DEC-11 el
   objeto es de una persona que lo subió para que lo vea **una**; el barrido de
   huérfanos de B-221 lo tapa recién cuando corre, y hasta entonces sigue ahí. El
   borrado va en el mismo paso que el rechazo, y el test mira **las dos** mitades.
5. **El trigger de optimización no ignora `propuestas/`** → se dispara a sí mismo
   al promover (trampa 12). No falla: cobra y duplica.
6. **El trigger de rebuild no cubre la colección nueva** → se publica una ficha y
   el sitio no la muestra (trampa 8).
7. **Las páginas nuevas no entran al sitemap** → existen y Google no las ve. Y con
   `/guia/` hay una más que es fácil de saltear: **`/guia/` misma**.
8. **`/proponer` promete lo que el sitio ya no cumple** → el sitio miente sobre
   datos, que es lo que B-780 costó como P0.
9. **El formulario público importa de `admin/`** → el bundle del panel viaja a una
   página pública, con la lección del §5.4 al lado.
