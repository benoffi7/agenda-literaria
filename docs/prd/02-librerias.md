# PRD 2 · Librerías — `/guia/librerias`, `/guia/librerias/sumar` y el panel

**Estado:** escrito el 2026-09-08, sin construir. Backlog: **B-831** (P1).
**Depende de:** **B-836** (escritura anónima), **B-834** (motor compartido),
**B-835** (la barra de navegación). Lo común a los cuatro PRDs está en
[`README.md`](README.md).

---

## 1 · Qué es

Un **directorio de librerías** en el sitio público, con tres puertas de entrada:

| Puerta | Quién entra | URL |
|---|---|---|
| El directorio | cualquiera | `/guia/librerias` |
| Formulario público | la librería, sin login | `/guia/librerias/sumar` |
| Formulario de admin | el dueño, logueado | el panel, vista `librerias` |

Campos pedidos por el dueño, textual: «Librerías / Foto / Dirección / Barrio /
Instagram / WhatsApp / No sé si poner si poner "promos bancarias" porque puede
cambiar».

Ese «no sé» tiene respuesta y está en el §6: es la decisión más importante de este
PRD y la que decide si el directorio envejece bien o mal.

## 2 · Por qué es el primero de los tres directorios

Es el más chico —siete campos y ningún concepto nuevo— y el que **valida el motor
compartido** con el menor riesgo. Y hay dos cosas que ya están construidas y le
sirven enteras:

1. **La taxonomía de barrios ya existe.** `/opciones/barrio` la usan las
   actividades desde el día uno, con su slugify, su `usos`, su pantalla de gestión
   y su viaje al `events.json` (§4.4). Una librería en Palermo usa **el mismo
   slug** que un taller en Palermo.
2. **Los hubs de barrio ya existen y están indexados.** `/barrio/[barrio]`
   (`src/pages/barrio/[barrio].astro`, B-108) es una página por barrio con las
   actividades de ahí. Con las librerías cargadas, esa página puede mostrar
   **«y estas son las librerías del barrio»** sin crear ninguna URL nueva.

El punto 2 es el que hace que este directorio valga más que la suma de sus fichas:
el SEO de un directorio suelto es pobre, pero «actividades **y** librerías de
Villa Crespo» es una página que sirve.

**El costo del punto 1**, que hay que decidir: el contador `usos` de
`/opciones/barrio` pasa a contar dos cosas distintas, y ese contador es el que
ordena el desplegable y el que detecta basura (§4.3). Un barrio con `usos: 1` deja
de significar «un taller» y pasa a significar «un taller o una librería». Es
aceptable, pero hay que escribirlo o en tres meses confunde.

## 3 · Modelo — `/librerias/{id}`

> **La colección no lleva `/guia/`.** El documento vive en `/librerias/{id}` y la
> página se sirve en `/guia/librerias/{slug}`. `/guia/` es una decisión de
> navegación y de SEO (`prd/README.md` § «Las decisiones del dueño»), no de modelo.

```ts
// src/types/libreria.ts  (nuevo)

export interface Libreria {
  nombre: string;                   // 2–80
  slug: string;                     // único, inmutable después de publicar — trampa 10
  descripcion: string | null;       // 0–1000 — qué tiene, qué la hace distinta

  imagenes: Imagen[];               // reusa `Imagen` de types/actividad.ts (D-125)

  direccion: string;                // 4–160, texto libre
  barrio: string;                   // slug de /opciones/barrio  ← el mismo que las actividades
  ciudad: string;                   // default 'Ciudad de Buenos Aires'
  geo: { lat: number; lng: number } | null;   // opcional, lo pone el admin

  instagram: string | null;         // handle sin @ — validado como en enlaces.ts
  whatsapp: string | null;          // ⚠️ se publica: el formulario tiene que decirlo
  web: string | null;
  mail: string | null;

  // ── promos bancarias — ver §6 ─────────────────────────────────────────────
  // NO va en la v1. Si se decide que sí (DEC-12):
  // promos: { texto: string; cargadoEn: TimestampLike } | null;

  // ── meta, igual que las otras tres entidades (README §1) ──────────────────
  estado: 'pendiente' | 'publicado' | 'rechazado';
  origen: 'formulario-publico' | 'panel';
  contactoDeQuienCargo: { via: 'mail' | 'whatsapp' | 'instagram'; valor: string } | null;  // INTERNO
  searchText: string;               // normalizado (§6 del CLAUDE.md)
  creadoEn: TimestampLike;
  revision: { porUid: string | null; en: TimestampLike | null; motivo: string | null };
}
```

### Lo que se reusa tal cual, y no es poco

| Pieza | De dónde |
|---|---|
| `Imagen`, con `portada`, `epigrafe`, `storagePath`, `ancho`, `alto` | `src/types/actividad.ts` (D-125) |
| La subida, el recorte y la Function de optimización | `subir-imagen.ts`, `imagenes.ts`, `functions/imagenes-optimizar.js` (B-167, B-220) |
| `slugify` y la unicidad del slug | `src/lib/slugify.ts` + el patrón de `slugDisponible` (B-820) |
| `normalize` para `searchText` | `src/lib/normalize.ts` (§6) |
| El desplegable de barrio con autocompletado | `TaxonomiaSelect.tsx` + `useOpciones.ts` |
| `Campo`, `Seccion`, `FilasEditor` | `src/components/admin/campos/` |
| El buscador en memoria del listado | `src/components/publico/Buscador.tsx` (§2.5) |

**Un `whatsapp` que se publica es una decisión, no un campo.** El §5.1 del
`CLAUDE.md` advierte que un WhatsApp personal publicado queda expuesto a bots, y
recomienda un número de trabajo. Acá el número **es** de trabajo —es una librería—
pero el formulario público lo tiene que decir arriba del input, con esas palabras:
**«este número se publica en el sitio»**. Sin eso, alguien pone su celular
personal sin darse cuenta.

## 4 · La ficha pública y el listado

### `/guia/librerias` — el listado

Mismo criterio que la agenda (§2.5): **un solo fetch de un JSON estático y
filtrado en memoria**. Un `librerias.json` propio, o la misma proyección dentro de
`events.json`? **Propio.** Motivo: `events.json` lo baja **toda** persona que abre
la agenda, y hoy pesa lo que pesa; sumarle un catálogo que el 90% no va a mirar le
cobra el peso a la mayoría. Es la misma lógica con la que el panel se corta del
bundle público (§9).

Filtros: **barrio** y **búsqueda por texto**. Nada más en la v1 — con 40 librerías
un filtro de más es ruido.

### `/guia/librerias/{slug}` — la ficha

SSG con `getStaticPaths`, como `actividad/[slug].astro`. Contenido: nombre, todas
las imágenes (el criterio de B-296: la galería entera, no solo la portada),
dirección con el barrio linkeado al hub, los contactos, y **las actividades de la
agenda que pasan ahí** — que es el enganche que hace útil a la ficha.

Ese último punto tiene un detalle de implementación que conviene ver antes de
programar: hoy la sede de una actividad es **texto libre** dentro de
`modalidades[].sede.nombre`, no una referencia. Cruzar «esta librería» con «las
actividades acá» exige o normalizar por nombre (frágil) o un campo `libreriaId`
opcional en la modalidad (limpio, y es un `/campo-nuevo`). `src/lib/sedesRepetidas.ts`
ya existe y hace algo parecido para el panel: es el lugar donde mirar.

**Recomendación:** la v1 **no** cruza. El cruce es B-831b, después de que haya
librerías cargadas y se vea si los nombres coinciden solos.

### JSON-LD — donde está el SEO

Una ficha de librería sin marcado estructurado es una página más; con `BookStore`
entra al panel local de Google. Es lo que `src/lib/schema.ts` ya hace para
`Event`, con otro tipo:

```jsonc
{
  "@type": "BookStore",              // subtipo de LocalBusiness
  "name": "…",
  "address": { "@type": "PostalAddress", "streetAddress": "…", "addressLocality": "…" },
  "geo": { "@type": "GeoCoordinates", … },   // si está
  "sameAs": ["https://instagram.com/…"],
  "image": ["…"],
  "url": "https://agendaleh.ar/guia/librerias/…/"
}
```

Sin `openingHours`, porque no se piden horarios (§7) y un `openingHours` inventado
es peor que ninguno.

## 5 · Los dos formularios

**Son el mismo formulario con dos configuraciones**, y ese es el punto del motor
compartido (B-834): un formulario público que es un subconjunto del de admin, sin
los campos de gestión.

| Campo | Público | Admin |
|---|---|---|
| nombre, dirección, barrio, instagram, whatsapp, web, mail | ✅ | ✅ |
| descripción | ✅ | ✅ |
| foto | URL o archivo (**DEC-11**) | archivo, con el editor de galería que ya existe |
| geo | ❌ | ✅ (`CoordenadasSede.tsx` ya existe) |
| slug | ❌ (lo deriva el admin del nombre) | ✅ |
| estado, revisión | ❌ (forzado a `pendiente` por la regla) | ✅ |

El formulario público, además: honeypot, tiempo mínimo de tipeo, App Check, y una
pantalla de «gracias» que **no promete publicación** ni respuesta.

## 6 · Las promos bancarias — la decisión del §6

El dueño lo dudó en el pedido y la duda es la correcta: **«porque puede cambiar»**.

**Recomendación: no van en la v1.** Los tres motivos, en orden de peso:

1. **Un dato desactualizado es peor que ausente.** «30% con Banco Ciudad los
   martes» publicado tres meses después de que se cortó no es un dato viejo: es
   información equivocada, y la paga la librería con alguien que fue al local por
   eso. Es distinto de un horario viejo, que la persona verifica sola.
2. **Nadie las va a mantener.** Cuarenta librerías × promos que rotan por mes es
   una tarea de mantenimiento permanente que no tiene dueño. Y el proyecto ya
   tiene medido lo que pasa con los datos que hay que actualizar a mano: la doc
   del repo se llenó de números que «mentían con autoridad» hasta que se los sacó
   (B-662, B-296).
3. **Ya hay dónde está siempre al día**, y lo estamos linkeando: **el Instagram de
   la librería**. Es donde la promo se publica de verdad.

**Si el dueño decide que sí** (es su llamada — **DEC-12**), la forma que menos
daño hace:

- **un solo campo de texto libre**, no una estructura de banco/día/porcentaje
  (una estructura invita a completarla y a que se vea confiable);
- **con la fecha de carga visible en la ficha**: «Promos cargadas el 12/09». Es
  lo único que le deja a quien lee decidir si confía;
- **fuera de los filtros y del buscador.** Filtrar por «librerías con promo» es
  prometer que el dato está al día;
- **con un aviso en el panel** cuando pasan 60 días, que es el mismo patrón del
  badge de pendientes que ya existe;
- **y un test que fije que la fecha se muestra siempre** que hay promo. Es el
  patrón de `tests/promesas-sobre-datos.test.ts`: la promesa la sostiene un test,
  no la buena voluntad.

## 7 · Lo que el pedido no incluye y probablemente haga falta

No lo agrego al alcance —el dueño pidió siete campos— pero conviene verlo antes de
programar, porque agregarlos después es un `/campo-nuevo` cada uno:

| Campo | Por qué faltaría | Recomendación |
|---|---|---|
| **Horarios** | Es lo primero que alguien busca antes de ir a una librería | Texto libre opcional («Lun a sáb de 10 a 20»), no una estructura. Y **no** al JSON-LD (`openingHours` exige estructura correcta) |
| **Qué tipo de librería** | Nueva / usada / especializada / editorial con local: es el filtro que la gente quiere | Taxonomía `/opciones/tipo-libreria`, y es el único filtro que le agregaría al listado |
| **Si hace envíos** | Cambia si te sirve una librería de otro barrio | Booleano, barato |
| **Accesibilidad** | Escalón en la entrada, baño accesible | Entra a `incluye`-style; lo dejaría para cuando esté el de lugares (PRD 4), que lo necesita más |

## 8 · Privacidad y seguridad

Ver [`README.md`](README.md) §2 y §4. Lo específico:

- **Dos clases de contacto en el mismo documento**, y no tienen el mismo destino:
  `whatsapp` / `instagram` / `mail` / `web` **son públicos y ese es el punto**;
  `contactoDeQuienCargo` es **interno**, igual que el `contacto` de una propuesta
  (PRD 1 §7). Que convivan en un documento es exactamente la condición donde una
  proyección por spread filtra un campo: **la whitelist de la proyección no se
  negocia**, y el barrido de salidas públicas tiene que anclar la interfaz nueva
  con sus centinelas, como se hizo con `ValorOpcion` en B-212.
- **`geo` es un dato de ubicación pero de un local comercial**, no de una persona.
  Es público sin discusión, y ya hay precedente: la sede de una actividad lo tiene.
- **La imagen que sube un anónimo** es el caso de DEC-11 (README §2).
- **El slug es inmutable después de publicar** (trampa 10). Con una diferencia
  incómoda respecto de las actividades: dos librerías pueden llamarse parecido y
  la que llega segunda necesita un slug distinto. `slugDisponible` (B-820) ya
  resuelve la verificación; lo que hay que decidir es el sufijo, y `-palermo`
  es mejor que `-2`.

## 9 · Criterios de aceptación

1. Un anónimo puede crear una librería en estado `pendiente` desde
   `/guia/librerias/sumar` y **no puede publicarla**, ni leer el directorio crudo, ni
   tocar otra colección. Verificado contra el emulador.
2. Una librería `pendiente` **no aparece** en `/guia/librerias`, ni en su JSON, ni en el
   sitemap, ni en ninguna página. El barrido de salidas públicas lo afirma.
3. `contactoDeQuienCargo` no sale a ninguna salida pública. Anclado con centinela.
4. El formulario público **dice que el WhatsApp se publica** antes del input.
5. El barrio de una librería es un slug que ya existe en `/opciones/barrio`, y un
   anónimo **no** puede crear uno nuevo.
6. `/guia/librerias` y cada `/guia/librerias/{slug}` tienen `canonical`, Open Graph y entrada
   en `sitemap.xml`, con la barra final de B-330.
7. La ficha emite `BookStore` válido, y sin `openingHours` mientras no haya
   horarios.
8. Publicar, editar o despublicar una librería **dispara el rebuild** (trampa 8
   con otra cara: sin esto se publica una librería y el sitio no la muestra).
9. El slug es único y no se puede cambiar después de publicar.
10. El peso de `/guia/librerias` con 40 fichas y sus miniaturas se mide y se anota, con
    el criterio de B-300 (el techo de peso de una página).

## 10 · El contra

**Un directorio de librerías vacío es peor que no tenerlo.** Con seis fichas la
página parece abandonada, y `/guia` va a tener una fila que decepciona. Esto no lo arregla el código: se arregla cargando treinta librerías
antes de publicar la sección, y eso es trabajo del dueño.

Segundo: **es la primera sección del sitio que no habla de actividades**, y la
razón de ser del proyecto es que la gente encuentre los talleres (§2.3 del
`CLAUDE.md`). Un directorio de librerías compite por la atención de la home y por
el ancho de la barra. La mitigación es el §2: si las librerías aparecen dentro de
los hubs de barrio, refuerzan la agenda en vez de competirle.

## 11 · Decisiones del dueño

| # | Qué | Recomendación |
|---|---|---|
| **DEC-12** | ¿Van las promos bancarias? | **No en la v1.** Si van: texto libre + fecha visible + fuera de los filtros (§6) |
| — | ¿Se agrega «tipo de librería» al alcance? | **Sí** — es el único filtro que el listado va a necesitar, y agregarlo después es un `/campo-nuevo` |
| — | ¿Horarios? | Texto libre opcional, sin JSON-LD |
| — | ¿La ficha cruza con las actividades que pasan ahí? | **No en la v1** — necesita un `libreriaId` en la modalidad; ver §4 |
