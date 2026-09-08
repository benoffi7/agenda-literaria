# PRD 3 · Suscripciones literarias — `/suscripciones`, `/suscripciones/sumar` y el panel

**Estado:** escrito el 2026-09-08, sin construir. Backlog: **B-832** (P1).
**Depende de:** **B-836**, **B-834**, **B-835**, y **B-837** (el dato que
envejece). Lo común a los cuatro PRDs está en [`README.md`](README.md).

---

## 1 · Qué es

Un **directorio de suscripciones literarias**: las cajas y clubes por abono que
mandan libros, o dan acceso a encuentros, o las dos cosas. Tres puertas, como los
otros dos directorios:

| Puerta | URL |
|---|---|
| El directorio | `/suscripciones` |
| Formulario público (sin login) | `/suscripciones/sumar` |
| Formulario de admin | el panel, vista `suscripciones` |

Pedido del dueño, textual: «Suscripciones literarias / Creo que todos son
mensuales (pero podría de otra manera??) / Qué incluye? / Si envían libros: tiene
temática? Son de editoriales independiente? / Extras: incluye algo más? Regalos,
descuentos, otros / Precio (opcional)».

Las dos preguntas que el dueño se hace en el pedido —«¿podría de otra manera?» y
el «(opcional)» del precio— son las dos decisiones de este PRD, y las dos tienen
respuesta acá: **§4.1** y **§6**.

## 2 · El problema de nombre, que hay que resolver antes de escribir la primera línea

**El sitio ya tiene una sección llamada «Suscribirse»**, y no es esto: es
`/suscribirse`, la página que explica cómo suscribirse **al calendario público**
(B-230, `src/lib/suscripcion.ts`, `tests/suscribirse.test.ts`). Está indexada,
está en el sitemap, está en la barra y su slug es inmutable (trampa 10).

Si se agrega `/suscripciones` al lado, la barra de navegación dice **«Suscribirse»
y «Suscripciones»**, que son dos cosas sin relación. Es una confusión garantizada,
y encima entre dos páginas que compiten por la misma consulta en Google.

Tres salidas, con su costo:

| Opción | Qué cuesta | Veredicto |
|---|---|---|
| **A. Renombrar la etiqueta de la barra de `/suscribirse` a «Calendario»** — la URL no cambia | Una línea en `ENLACES` (`Encabezado.astro:110`) y su test. La URL sigue siendo `/suscribirse`, así que no rompe nada indexado | ✅ **Recomendada.** Además la etiqueta mejora: «Calendario» dice qué es la página; «Suscribirse» no dice a qué |
| **B. Llamar al directorio `/cajas-literarias`** | Nadie busca «caja literaria» tanto como «suscripción literaria»; se pierde la consulta | ❌ |
| **C. Dejar las dos como están** | La confusión, y dos páginas peleando por la misma búsqueda | ❌ |

Con la opción A, la barra queda coherente: **Calendario** es el espejo en Google
Calendar, **Suscripciones** es el directorio.

## 3 · Modelo — `/suscripciones/{id}`

```ts
// src/types/suscripcion-literaria.ts  (nuevo — ojo con el nombre: `suscripcion.ts`
// ya existe en src/lib/ y es la página del calendario)

export interface SuscripcionLiteraria {
  nombre: string;                   // 2–80
  slug: string;                     // único, inmutable después de publicar
  descripcion: string;              // 15–2000 — qué es y para quién

  imagenes: Imagen[];               // reusa `Imagen` (D-125)

  // ── quién la ofrece ───────────────────────────────────────────────────────
  ofrecidaPor: {
    nombre: string;
    tipo: string;                   // slug de /opciones/tipo-oferente: libreria | editorial | club | persona
    instagram: string | null;
    libreriaSlug: string | null;    // ← si es una librería del PRD 2, se linkean
  };

  // ── cada cuánto (§4.1) ────────────────────────────────────────────────────
  periodicidad: string;             // slug de /opciones/periodicidad: mensual (default) | bimestral | trimestral | anual | unica
  compromisoMinimo: string | null;  // 'sin-compromiso' | '3-meses' | … o null si no dice

  // ── qué incluye ───────────────────────────────────────────────────────────
  incluye: string[];                // slugs de /opciones/incluye-suscripcion
  incluyeOtro: string | null;       // texto libre; el admin decide si se promueve

  // ── si envía libros ───────────────────────────────────────────────────────
  envio: {
    manda: boolean;
    cuantos: number | null;         // libros por entrega
    tematica: string | null;        // texto libre: 'poesía argentina', 'novela negra'
    editoriales: string | null;     // slug de /opciones/perfil-editorial: independientes | mixto | grandes | no-dice
    sorpresa: boolean | null;       // ¿se sabe qué libro llega, o es sorpresa?
  };

  // ── extras ────────────────────────────────────────────────────────────────
  extras: string[];                 // slugs de /opciones/extras-suscripcion: regalos | descuentos-en-local | encuentros | club-online | …
  extrasOtro: string | null;

  // ── precio, que envejece (§6 y B-837) ─────────────────────────────────────
  precio: {
    monto: number;                  // ARS
    porPeriodo: string;             // el slug de periodicidad al que corresponde
    cargadoEn: TimestampLike;       // ← se MUESTRA en la ficha, siempre
  } | null;

  // ── dónde llega ───────────────────────────────────────────────────────────
  alcance: string[];                // slugs de /opciones/alcance-envio: caba | amba | todo-el-pais | retiro-en-local | digital

  // ── contacto y compra ─────────────────────────────────────────────────────
  linkDeSuscripcion: string | null; // ⚠️ link a un tercero — §7
  instagram: string | null;
  whatsapp: string | null;          // se publica; el formulario lo dice
  mail: string | null;

  // ── meta, igual que las otras tres entidades ──────────────────────────────
  estado: 'pendiente' | 'publicado' | 'rechazado';
  origen: 'formulario-publico' | 'panel';
  contactoDeQuienCargo: { via: 'mail' | 'whatsapp' | 'instagram'; valor: string } | null;  // INTERNO
  searchText: string;
  creadoEn: TimestampLike;
  revision: { porUid: string | null; en: TimestampLike | null; motivo: string | null };
}
```

### 3.1 · Es el modelo más complicado de los cuatro, y conviene saber por qué

Los otros tres describen **una cosa que existe en un lugar**: un evento, un local,
un salón. Una suscripción describe **una promesa a futuro**: qué te va a llegar,
cada cuánto, y por cuánto. Eso trae tres cosas que los otros no tienen:

1. **Campos condicionales de verdad** (`envio.*` solo si `envio.manda`), que es el
   patrón del §11 del `CLAUDE.md` —el formulario muestra lo que aplica— ya
   implementado en `PestaniasFormulario.tsx` y las `Seccion*`.
2. **Dos vocabularios abiertos en el mismo documento**: `incluye` y `extras`. Y son
   distintos: «un libro por mes» es lo que incluye; «10% de descuento en el local»
   es un extra. Mezclarlos hace un desplegable de 30 opciones inservible.
3. **Un precio**, que es el único dato numérico y vivo de los cuatro PRDs.

## 4 · Las dos preguntas del dueño

### 4.1 · «Creo que todos son mensuales (pero podría de otra manera??)»

**Sí, podría, y conviene modelarlo ahora.** No por completitud: porque el costo de
los dos caminos es asimétrico.

- **Modelarlo hoy** cuesta un campo con taxonomía, que es mecanismo ya construido
  (`TaxonomiaSelect`, `upsertOpcion`, la pantalla de gestión), y **un default
  `mensual`** que hace que el formulario se vea igual de simple: quien carga no
  toca nada y sale mensual.
- **No modelarlo** y descubrir en tres meses que hay una caja trimestral cuesta un
  `/campo-nuevo` completo —seis salidas—, **más migrar los documentos existentes**,
  más el sitio publicando «mensual» sobre algo que no lo es. Y eso último ya pasó
  en este repo con el campo único de imagen: `imagenUrl` está `@deprecated` y se
  sigue leyendo con un default porque los documentos viejos lo tienen (D-125).

Y no es hipotético: en el mercado hay cajas **trimestrales** (el formato clásico de
las book boxes) y clubes **anuales** con pago único. «Todos son mensuales» es
verdad de la muestra que el dueño tiene hoy.

**Recomendación:** `periodicidad` como taxonomía con cinco `fijo: true` —`mensual`
(default), `bimestral`, `trimestral`, `anual`, `unica`— y el formulario
preseleccionando `mensual`.

> **Un cuidado, que este repo ya aprendió con el arancel (DEC-2):** preseleccionar
> un valor hace que nadie lo mire. Con el arancel se decidió **obligar a elegir**
> justamente por eso. Acá la preselección es defendible —«mensual» es cierto en la
> enorme mayoría, y el campo no cambia el precio de nada— pero si aparecen
> suscripciones mal cargadas como mensuales, la respuesta es la de DEC-2: sacar el
> default y obligar a elegir.

### 4.2 · «Si envían libros: tiene temática? Son de editoriales independientes?»

Las dos son campos, y las dos son **el filtro que la gente quiere**: alguien que
busca una suscripción busca «poesía» o «independientes», no «mensual».

- **`tematica` es texto libre**, no taxonomía. «Novela negra latinoamericana
  contemporánea» no entra en un desplegable, y forzarlo produce las cuatro
  variantes de lo mismo que la trampa 6 describe. El texto libre entra a
  `searchText`, y ahí el buscador en memoria lo encuentra igual (§2.5).
- **`editoriales` sí es taxonomía cerrada**: `independientes` | `mixto` |
  `grandes` | `no-dice`. Es un eje de filtro, y en este circuito
  «independientes» es el que más importa. `no-dice` existe a propósito: es lo que
  va a llegar en la mitad de las cargas, y sin ese valor alguien va a marcar
  `mixto` para poder guardar.

## 5 · El listado y la ficha

### `/suscripciones`

JSON propio (`suscripciones.json`), filtrado en memoria (§2.5). Los filtros que
valen, en orden:

1. **¿Manda libros?** — parte el catálogo en dos mundos.
2. **Editoriales** — `independientes` es la consulta del circuito.
3. **Alcance** — si no llega a tu ciudad, el resto no importa.
4. **Periodicidad** — el menos útil, va último.

**Sin filtro de precio y sin orden por precio.** Ver §6: filtrar por un dato que
puede tener tres meses es prometer que está al día.

### `/suscripciones/{slug}`

Nombre, imágenes, quién la ofrece (y si es una librería del PRD 2, **linkeada a su
ficha** — el `libreriaSlug`), qué incluye, qué manda, extras, alcance, el precio
con su fecha, y la acción: el link de suscripción o el contacto.

### JSON-LD

`Product` con una `Offer`, que es lo que corresponde. **Con una excepción
deliberada: el precio no va al marcado.** Motivo: Google **muestra** el precio del
`Offer` en el resultado de búsqueda, y un precio de tres meses en un país con esta
inflación se publica equivocado en el lugar de más visibilidad y con la
credibilidad de un dato estructurado. En la página va, con su fecha al lado, donde
la persona lo lee en contexto.

Es la misma clase de decisión que B-780 —`/apoyar` publicaba un usuario de cobro
que nadie había registrado, y era P0— y que el texto de `/anunciar`, redactado para
**no afirmar** lo que el repo no controla (B-773).

## 6 · El precio, y el patrón «dato que envejece» (B-837)

El dueño escribió «Precio (opcional)», y el paréntesis es la parte importante:
sabe que no siempre va a estar. El problema real es peor que la ausencia: es
**cuando está y ya no es cierto**.

Este PRD y el de librerías (§6, las promos bancarias) tienen **el mismo problema**,
y por eso la propuesta es **un solo mecanismo compartido** —eso es **B-837**—:

```ts
export interface DatoConFecha<T> { valor: T; cargadoEn: TimestampLike; }
```

Y tres reglas que valen para los dos casos:

1. **La fecha se muestra siempre que se muestra el dato.** «$18.000 por mes ·
   cargado el 12/09». No hay forma de mostrar uno sin el otro, y eso lo sostiene un
   test, no la disciplina.
2. **Nunca entra a un filtro, a un orden ni a un `Offer`.** Filtrar por precio
   afirma que los precios son comparables entre sí, y no lo son si uno tiene una
   semana y otro cuatro meses.
3. **El panel avisa a los 60 días.** Mismo patrón del badge de pendientes que ya
   existe (`PendientesBadge.tsx`): un número al lado de la vista, no un mail.

El costo de esto es un componente y un helper. El costo de no hacerlo es publicar
precios equivocados con cara de ciertos, que es lo que este repo ya corrigió tres
veces en su propia documentación.

## 7 · El link a un tercero, que es el riesgo propio de este PRD

`linkDeSuscripcion` apunta a la página de cobro de otra persona: Mercado Pago,
Tienda Nube, un formulario. Eso trae cuatro cosas que ninguno de los otros tres
PRDs tiene:

1. **No puede parecer que el proyecto lo respalda.** Una ficha que dice «Suscribite»
   con un botón grande es un endoso. La acción tiene que decir a dónde va:
   «Suscribite en la página de <nombre>». Es la lección de B-780/B-781.
2. **`rel="noopener noreferrer"` y `target="_blank"`.** Sin `noopener` la página de
   destino puede tocar la nuestra; y el `noreferrer` es lo que evita mandarle
   nuestro dominio de referencia, que es la discusión abierta de **B-786** (el
   `Referer` a Cafecito). Conviene resolverla igual para los dos.
3. **Los links se validan al publicar, no solo al cargar.** B-817 dejó anotado
   exactamente este agujero para las imágenes: el esquema de la URL se validaba
   solo al publicar y una cancelada también tiene página. Un `linkDeSuscripcion`
   con `javascript:` o `http://` tiene que rebotar en el schema **y** en la regla.
4. **Un link muerto es una ficha que hace perder tiempo.** No propongo un checker
   automático en la v1 (es una Function con red saliente y una fuente de falsos
   positivos), pero sí que la ficha muestre `cargadoEn` como las otras cosas que
   envejecen.

## 8 · Privacidad y seguridad

Todo lo del [`README.md`](README.md) §2 y §4, más:

- **`contactoDeQuienCargo` es interno**; `instagram`, `whatsapp`, `mail`,
  `linkDeSuscripcion` son públicos y ese es el punto. Whitelist, centinelas y fila
  en `07-seguridad.md`.
- **Este documento tiene más campos internos y públicos mezclados que los otros
  tres**, así que es el que más necesita que la proyección sea explícita. Un
  `...pick(...)` con la lista escrita a mano, como `toPublic.ts` (§5.2).
- **Un anónimo no crea taxonomías** (PRD 1 §4.2). Acá pesa más porque este PRD
  agrega **cuatro** vocabularios (`periodicidad`, `perfil-editorial`,
  `incluye-suscripcion`, `extras-suscripcion`, `alcance-envio`, `tipo-oferente` —
  seis, en realidad). Todos con opciones base `fijo: true` cargadas de entrada.

## 9 · Criterios de aceptación

1. Un anónimo carga una suscripción en `pendiente` y no puede publicarla ni leer el
   catálogo crudo. Emulador.
2. Una suscripción `pendiente` no aparece en ninguna salida pública.
3. `contactoDeQuienCargo` no sale nunca. Centinela en el barrido.
4. **El precio nunca se muestra sin su fecha de carga.** Test que lo fija.
5. El precio **no** está en el `Offer` del JSON-LD, y hay un test que lo afirma con
   su motivo escrito al lado (si mañana alguien lo agrega, se cae y lee por qué).
6. No hay filtro ni orden por precio.
7. `linkDeSuscripcion` rechaza cualquier esquema que no sea `https:`, en el schema
   **y** en la regla de Firestore.
8. Todo link externo sale con `rel="noopener noreferrer"`.
9. La acción de la ficha nombra a quién le estás comprando.
10. `/suscripciones` y cada ficha tienen `canonical`, OG y sitemap; publicar o
    editar dispara el rebuild.
11. La barra de navegación no dice «Suscribirse» y «Suscripciones» a la vez (§2).
12. Los seis vocabularios nuevos arrancan con sus opciones base `fijo: true`, y
    un anónimo no puede agregar ninguna.

## 10 · El contra

**Es el directorio con menos oferta y más trabajo.** Suscripciones literarias
argentinas hay, digamos, quince. Un directorio de quince fichas con seis
vocabularios nuevos, un modelo condicional y un precio que envejece es la peor
relación esfuerzo/resultado de los cuatro PRDs.

Y hay un segundo contra que no es de código: **es el más cerca de vender**. Una
ficha con precio y botón de compra le cambia el tono al sitio, que hasta ahora
informa. `/anunciar` y `/apoyar` ya empujaron en esa dirección y por eso existen
`tests/comercial-del-sitio.test.ts` y `tests/promesas-sobre-datos.test.ts`. Vale
tenerlo presente al redactar los textos.

Lo que lo justifica igual: **es información que hoy no está junta en ningún lado**,
y es exactamente el tipo de cosa que alguien busca una vez y no encuentra. Con
quince fichas bien cargadas, es la mejor página de internet sobre el tema. Eso no
se puede decir del directorio de librerías.

## 11 · Decisiones del dueño

| # | Qué | Recomendación |
|---|---|---|
| — | ¿Cómo se resuelve el choque «Suscribirse» / «Suscripciones»? | **Opción A** del §2: la barra dice «Calendario» para `/suscribirse`, sin cambiar la URL |
| — | ¿`periodicidad` se modela o se asume mensual? | **Se modela**, con default `mensual` (§4.1) |
| **DEC-12** | El precio, ¿va con fecha visible o no va? | **Va con fecha visible**, fuera de filtros y fuera del JSON-LD (§6) |
| — | ¿Se resuelve B-786 (`Referer` a terceros) acá? | **Sí** — `noreferrer` para todos los links externos, y se cierra B-786 de paso |
