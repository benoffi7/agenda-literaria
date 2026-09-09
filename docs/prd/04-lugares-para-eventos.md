# PRD 4 · Lugares para eventos — `/guia/lugares`, `/guia/lugares/sumar` y el panel

**Estado:** escrito el 2026-09-08, sin construir. Backlog: **B-833** (P1).
**Depende de:** **B-836**, **B-834**, **B-835**, **B-837**. Lo común a los cuatro
PRDs está en [`README.md`](README.md).

---

## 1 · Qué es

Un **directorio de lugares donde hacer una actividad literaria**: el café que
presta el salón del fondo, la librería con una mesa larga, el centro cultural con
sillas y proyector.

| Puerta | URL |
|---|---|
| El directorio | `/guia/lugares` |
| Formulario público (sin login) | `/guia/lugares/sumar` |
| Formulario de admin | el panel, vista `lugares` |

Pedido del dueño, textual: «Lugares para eventos / Qué es el lugar: café,
librería, centro cultural (por ahí poner a completar) / Dirección / Capacidad /
Que incluye el lugar: atención (Café, consumición, etc) a los invitados, mesa para
varias personas, salón sólo con espacio y sillas. / Precio: no sé si todos cobran,
o le dicen que tienen que consumir».

Ese «(por ahí poner a completar)» **es exactamente el patrón §4 del `CLAUDE.md`**
—desplegable + «Otro» que se incorpora— que ya está implementado y resuelto para
cinco campos. Y el «no sé si todos cobran» es la mejor observación de los cuatro
pedidos: ver §5.

## 2 · Por qué este es el que más cierra el círculo

Los otros dos directorios son información al costado de la agenda. Este es
**el otro lado de la misma moneda**:

- Quien organiza un taller **necesita un lugar**. Hoy lo consigue preguntando en
  Instagram.
- El lugar que presta el salón **quiere que pasen cosas ahí**. Es su público.
- Y la actividad que sale de ese encuentro **entra a la agenda**, que es lo que el
  proyecto ya hace.

Hay dos cosas construidas que lo confirman:

1. **`/anunciar` le habla a este público exacto.** B-770 la describe así:
   «ofrecerle espacio a cafés, librerías y espacios culturales». O sea: la página
   comercial y `/guia/lugares/sumar` hablan con la **misma** gente, con dos propuestas
   distintas. Tienen que linkearse, y el texto de `/anunciar` hay que releerlo
   cuando esto exista (`src/lib/comercialDelSitio.ts` + su test).
2. **La sede de una actividad ya existe** en `modalidades[].sede`
   (D-130) y `src/lib/sedesRepetidas.ts` ya detecta sedes repetidas en el panel —
   o sea que el proyecto ya sabe que las sedes se repiten y ya hace algo con eso.
   **Ese archivo es el mejor punto de partida para cargar los primeros lugares:
   los que ya están en la base.**

## 3 · Modelo — `/lugares/{id}`

> **La colección no lleva `/guia/`**: el documento es `/lugares/{id}`, la página es
> `/guia/lugares/{slug}`. Igual que en los otros dos directorios.

```ts
// src/types/lugar.ts  (nuevo)

export interface Lugar {
  nombre: string;                   // 2–80
  slug: string;                     // único, inmutable después de publicar
  descripcion: string | null;       // 0–1500

  imagenes: Imagen[];               // reusa `Imagen` (D-125)

  tipo: string;                     // slug de /opciones/tipo-lugar — el «a completar» del pedido

  // ── dónde ─────────────────────────────────────────────────────────────────
  direccion: string | null;         // ⚠️ puede NO publicarse — §6
  barrio: string;                   // slug de /opciones/barrio  ← el mismo de siempre
  ciudad: string;
  geo: { lat: number; lng: number } | null;   // ⚠️ mismo cuidado que la dirección
  direccionPublica: boolean;        // ← el flag del §6; default `false` para casas

  // ── capacidad ─────────────────────────────────────────────────────────────
  capacidad: number | null;         // «hasta N personas»
  capacidadNotas: string | null;    // 'sentados 20, de pie 35'

  // ── qué incluye ───────────────────────────────────────────────────────────
  incluye: string[];                // slugs de /opciones/incluye-lugar
  incluyeOtro: string | null;

  // ── la condición, que no es un precio (§5) ────────────────────────────────
  condicion: string;                // slug de /opciones/condicion-de-uso
  precio: { monto: number; porUnidad: string; cargadoEn: TimestampLike } | null;  // B-837
  condicionNotas: string | null;    // 'mínimo de consumición $8000 por persona'

  // ── contacto ──────────────────────────────────────────────────────────────
  instagram: string | null;
  whatsapp: string | null;          // se publica; el formulario lo dice
  mail: string | null;
  web: string | null;

  // ── meta ──────────────────────────────────────────────────────────────────
  estado: 'pendiente' | 'publicado' | 'rechazado';
  origen: 'formulario-publico' | 'panel';
  contactoDeQuienCargo: { via: 'mail' | 'whatsapp' | 'instagram'; valor: string } | null;  // INTERNO
  searchText: string;
  creadoEn: TimestampLike;
  revision: { porUid: string | null; en: TimestampLike | null; motivo: string | null };
}
```

## 4 · Las tres taxonomías nuevas, con sus opciones base

Las tres arrancan con sus valores `fijo: true` cargados —o sea, en
`src/lib/opciones-base.json`, que ya existe— para que el desplegable no nazca
vacío. Y el «Otro» del formulario **público** no crea opciones (PRD 1 §4.2): es
texto libre que el admin promueve o descarta.

### `/opciones/tipo-lugar`

`cafe` · `libreria` · `centro-cultural` · `bar` · `biblioteca` · `casa` ·
`coworking` · `aula` · `club` · `galeria` · `al-aire-libre`

Los tres primeros son los que nombró el dueño. `casa` está en la lista **porque es
el caso que dispara la regla del §6**, no porque haga falta llenar la lista.

### `/opciones/incluye-lugar`

Traducción directa de lo que el dueño escribió, más lo que se pregunta siempre:

`consumicion-incluida` · `atencion-a-los-invitados` · `mesa-larga` ·
`salon-con-sillas` · `proyector` · `sonido-y-microfono` · `wifi` · `pizarron` ·
`cocina` · `patio` · `accesible-en-silla-de-ruedas` · `bano-accesible` ·
`se-puede-vender-libros`

Los últimos tres no estaban en el pedido y valen: la accesibilidad es lo que
decide si una actividad se puede hacer ahí, y **poder vender libros** es la
pregunta que hace cualquiera que presenta uno.

### `/opciones/condicion-de-uso` — ver §5

`gratis` · `con-consumicion` · `alquiler-por-hora` · `alquiler-por-evento` ·
`a-convenir` · `porcentaje-de-la-recaudacion` · `canje-por-difusion`

## 5 · «No sé si todos cobran, o le dicen que tienen que consumir»

**Esta duda del dueño es el hallazgo del PRD**, y la respuesta es que **el precio
no es un número: es una forma de arreglo.** Un café que te presta el salón si cada
persona consume no está cobrando cero ni cobrando un precio — está proponiendo otra
cosa, y no entra en un campo numérico.

Y este proyecto **ya resolvió exactamente este problema una vez**. El §4.1 del
`CLAUDE.md`, sobre el arancel de una actividad:

> `'a-la-gorra'` es opción de primera clase, no un caso raro: en el circuito
> literario es la mitad de los casos y no entra en el binario gratis/pago.

**`con-consumicion` es el `a-la-gorra` de los lugares.** Misma estructura,
misma solución:

```
condicion: slug de taxonomía   ← cómo es el arreglo
precio:    número + fecha, opcional, solo si el arreglo tiene un número
notas:     texto libre         ← 'mínimo $8000 por persona', 'dos horas'
```

Es literalmente la forma de `arancel: { tipo, notas }` (§3.1), con el `precio`
agregado y con fecha porque envejece (B-837). Reusar esa forma no es prolijidad:
es que el formulario, el chip del listado y el filtro se comportan como los del
arancel, que ya están construidos y probados (`src/lib/arancel.ts`,
`src/lib/chip.ts`).

**Y el filtro que la gente quiere no es «hasta $X»**: es «¿tengo que pagar algo?».
Tres opciones —**sin costo** (`gratis`, `canje-por-difusion`), **consumiendo**
(`con-consumicion`), **pagando** (los tres de alquiler y `a-convenir`)— y listo.
Eso funciona igual de bien con un precio de hace tres meses, que es la propiedad
que hay que buscar en todo dato que envejece (B-837).

## 6 · La dirección de una casa, que es el problema serio de este PRD

**Este es el único de los cuatro PRDs que puede publicar la dirección de la casa de
una persona.** «Casa» / «PH con patio» / «mi living» son lugares reales de este
circuito —los talleres de escritura pasan en casas— y la diferencia con un café es
total: la dirección de un local comercial es pública por definición; la de una casa
es el dato con el que se llega a la puerta de alguien.

Y hay dos agravantes propios de este formulario:

1. **Lo carga cualquiera, sin login.** Nada garantiza que quien cargó la casa sea
   quien vive ahí. Se puede publicar la dirección de la casa de un tercero.
2. **`geo` la pone en un mapa**, o sea que el «más o menos por Villa Crespo» deja
   de ser más o menos.

**La regla, y no es negociable:**

| | Local comercial (café, librería, centro cultural, …) | Casa / domicilio particular |
|---|---|---|
| Dirección | se publica | **no se publica**: solo el barrio |
| `geo` / mapa | se publica | **no** |
| Contacto | se publica | se publica (es cómo se pide la dirección) |

Cómo se implementa, en orden de importancia:

- **`direccionPublica: boolean`, y para `tipo: 'casa'` arranca en `false`** — el
  default lo decide el tipo, no el usuario. Un default que hay que apagar a mano es
  el que se olvida.
- **La proyección pública mira ese flag.** Es la misma forma que ya existe y está
  probada: `online.urlPublica` decide si el link de la reunión sale
  (`linkDeReunionQueSale`, `toPublic.ts:478`, DEC-3) y `material.items[].publico`
  decide si sale la URL (`urlDeMaterialQueSale`). **Tercera instancia de la misma
  clase**, o sea que hay que extraerla o atarla con el mismo test que ata las otras
  dos —y esa clase ya tiene su barrido en `tests/clases-de-bug.test.ts`.
- **B-819 es la advertencia exacta:** «restaurar puede volver a publicar un link
  que estaba apagado — y el flag es un par». Un flag de privacidad más un dato
  privado **es un par**, y el historial los tiene que restaurar juntos o no
  restaurar ninguno. `flagsDePublicacionRestaurables` (`src/lib/historial.ts`) ya
  existe y hay que sumarle este caso el mismo día en que el campo nace.
- **El formulario público lo dice antes del input:** «Si es una casa, no publicamos
  la dirección: quien te escriba te la va a pedir».
- **Y el JSON-LD de una casa no lleva `address`.** Es el lugar donde el dato se
  filtra sin que nadie lo vea, porque nadie lee el JSON-LD al revisar una ficha.

## 7 · El listado y la ficha

### `/guia/lugares`

JSON propio, filtrado en memoria. Filtros, en orden de utilidad real:

1. **Capacidad** — «somos 20» es la primera pregunta. En **rangos**
   (hasta 10 · 10-25 · 25-50 · más de 50), no un input numérico: los rangos
   toleran que la capacidad esté aproximada, un input no.
2. **Condición** — las tres del §5.
3. **Barrio** — reusa `/opciones/barrio`.
4. **Qué incluye** — multi, y el que más ayuda con proyector/accesibilidad.
5. **Tipo de lugar** — último; suena importante y filtra poco.

### `/guia/lugares/{slug}`

Nombre, imágenes, tipo, barrio (linkeado al hub), dirección **si corresponde**,
capacidad, qué incluye, la condición con sus notas, contacto. Y —cuando exista el
cruce con las actividades (PRD 2 §4)— «acá pasaron estas actividades», que es la
prueba social que hace útil a la ficha.

### JSON-LD

`Place` (o `EventVenue`) con `maximumAttendeeCapacity`, `amenityFeature` para lo
que incluye, y `address` **solo si `direccionPublica`**. Sin `priceRange`: la
condición no es un rango de precios.

## 8 · Criterios de aceptación

1. Un anónimo carga un lugar en `pendiente` y no puede publicarlo. Emulador.
2. Un lugar `pendiente` no aparece en ninguna salida pública.
3. **Un lugar con `tipo: 'casa'` no publica dirección ni `geo` por default**, y
   ese default no lo puede cambiar el formulario público. Con test.
4. **`direccionPublica` y `direccion` se restauran juntos desde el historial, o no
   se restauran** (B-819). Con test, en las dos direcciones.
5. `direccion` ausente de la ficha implica ausente del JSON-LD. Con test — es el
   camino que se filtra sin que nadie lo note.
6. `contactoDeQuienCargo` no sale nunca. Centinela en el barrido.
7. La condición se muestra siempre; el precio, si está, **siempre con su fecha**.
8. No hay filtro «hasta $X». El filtro de costo son las tres clases del §5.
9. Las tres taxonomías nuevas arrancan con sus `fijo: true` y un anónimo no puede
   agregar valores.
10. `/guia/lugares` y cada ficha con `canonical`, OG y sitemap; publicar dispara el
    rebuild.
11. `/anunciar` y `/guia/lugares/sumar` se linkean, y el texto de `/anunciar` sigue
    siendo cierto (su test ya prohíbe cifras de audiencia inventadas).

## 9 · El contra

**Puede convertirse en una inmobiliaria de salones, que no es lo que el proyecto
es.** Un directorio de lugares con precios y capacidades se parece más a un
marketplace que a una agenda literaria, y el sitio ya empujó dos veces en esa
dirección (`/anunciar`, `/apoyar`). Si `/guia/lugares` es la sección más visitada, el
proyecto cambió de tema sin que nadie lo decida.

La mitigación es de producto, no de código: **el lugar se presenta por lo que
permite hacer, no por lo que cuesta.** Que la ficha muestre «acá pasaron estas
tres actividades» antes que el precio, y que el filtro de costo sea de tres clases
y no un slider, empujan para ese lado.

Segundo contra, más chico: **la capacidad es un dato que quien carga no sabe.**
«¿Cuántas personas entran?» tiene respuestas distintas si están sentadas, de pie,
o con mesa. De ahí `capacidadNotas`, y de ahí que el filtro sea por rangos.

## 10 · Decisiones del dueño

| # | Qué | Recomendación |
|---|---|---|
| — | ¿La dirección de una casa se publica? | **No.** Solo el barrio, y el default lo decide el tipo de lugar (§6) |
| — | ¿El precio se publica? | **Con su fecha, y sin filtro numérico** (§5, B-837) |
| — | ¿Se cargan los lugares que ya están en la base como sede? | **Sí, y es la mejor forma de arrancar**: `src/lib/sedesRepetidas.ts` ya sabe cuáles son. Pero hay que **pedirles permiso**: que una sede figure en una actividad no autoriza a publicarla como lugar que se alquila |
| — | ¿`/anunciar` cambia de texto cuando esto exista? | **Sí** — hoy le habla al mismo público con otra propuesta |
