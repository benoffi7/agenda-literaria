# PRD 1 · Propuestas de organizadores — `/proponer` y la bandeja

**Estado:** escrito el 2026-09-08, sin construir. Backlog: **B-830** (P1).
**Depende de:** **B-836** (defensa de la escritura anónima) y **B-834** (el motor
compartido). Lo común a los cuatro PRDs está en [`README.md`](README.md) y no se
repite acá.

---

## 1 · Qué es

Un **formulario público, sin login, con datos muy básicos**, para que el
organizador de una actividad la cargue él mismo; y una **bandeja en el panel**
donde eso llega para validar, completar y publicar.

Pedido del dueño, textual: «Un formulario online sin login pero con datos muy muy
basicos para que los organizadores puedan cargar y que entre a nuestra bandeja de
eventos como para validar/completar y hacer publico».

Dos piezas y un solo camino:

```
organizador (sin login)  →  /proponer  →  /propuestas/{id}  estado: 'nueva'
                                                  ↓
                                    bandeja del panel (solo admin)
                                                  ↓
                     «convertir en actividad»  →  el formulario que ya existe,
                                                  prellenado
                                                  ↓
                              se publica como cualquier otra actividad
```

**Lo que hace valioso a este PRD**, y lo separa de los otros tres: es el único que
**no agrega un modelo nuevo al sitio**. Una propuesta no se publica: se convierte
en una actividad, y de ahí en adelante todo el sistema que ya existe —el schema, la
proyección, el sync a Calendar, el rebuild, la página de detalle— sigue igual.
La superficie pública que agrega es **una página con un formulario**, no un
catálogo.

## 2 · El problema, como pasa hoy

Hoy hay exactamente dos caminos para que una actividad de otra persona entre a la
agenda, y los dos terminan en el teclado del dueño:

1. **El mail de `/contacto`.** `MOTIVOS_DE_CONTACTO.sugerencia`
   (`src/lib/enlaces.ts`) abre un `mailto:` con asunto «Sugerencia de actividad» y
   el texto de ayuda «Contanos qué actividad falta: quién la da, cuándo y dónde».
   O sea: **el formulario ya existe, y es un mail redactado a mano**. Llega en
   prosa, sin fechas parseables, casi siempre incompleto, y hay que repreguntar.
2. **Que el dueño lo vea en Instagram** y lo cargue de cero.

En los dos casos **los 30+ campos del formulario los tipea el dueño**. Y el dato
existe: lo tiene la persona que organiza, que además es la que sabe si el taller
se corrió una semana.

El formulario público no elimina el trabajo de validar —no debería, ver §9— pero
convierte «transcribir un mail» en «revisar y completar», que es otra tarea.

### Y hay un tercer camino que hoy no existe y debería: el DM

**`/contacto` ofrece solo mail.** `BLOQUES_DE_CONTACTO`
(`src/lib/contactoDelSitio.ts`) se arma recorriendo `MOTIVOS_DE_CONTACTO` y los
dos motivos son `mailto:`. El Instagram del proyecto —`agenda.leh`, en
`enlaces.ts` desde el 2026-09-07— está en el chrome del sitio, **no como canal de
contacto**.

Y en este circuito **el canal real es el DM**: es lo que dice el propio
`11-ideas-de-producto.md` sobre la difusión («el canal de difusión real de este
circuito es Instagram, no Google»). Alguien que quiere avisar de un taller abre
Instagram, no el cliente de mail.

Así que: **`/contacto` suma Instagram como canal** (pedido del dueño el
2026-09-08, **B-839**), y el campo de contacto de la propuesta acepta
`instagram` como `via` —los tres son mail, WhatsApp o Instagram— porque quien
propone va a querer que le contesten por donde escribe.

**Y `/contacto` no se va a ningún lado: DEC-10 se contestó «queda también».** Los
dos caminos conviven —el `mailto:` para quien quiere escribir en prosa, `/proponer`
para quien quiere cargar—, con `/contacto` linkeando a `/proponer`. Es lo contrario
de lo que este PRD recomendaba (§ 11), y el motivo del dueño le gana al mío: un
formulario de once campos es una puerta más angosta que una casilla de mail, y la
propuesta que no entra por el formulario tiene que poder entrar igual. Lo que había
que evitar —que la mitad llegue por el peor camino— se ataca con la redacción, no
cerrando la puerta: el bloque de «Sugerir una actividad» ahora empieza mandando a
`/proponer`.

Es chico y no depende de este PRD: `enlaces.ts` ya tiene el handle y la URL se
deriva de ahí (nada de escribirla a mano — es la regla del módulo). Lo que hay
que cuidar es que **`BLOQUES_DE_CONTACTO` deja de ser homogéneo**: hoy todos los
bloques tienen `asunto`, y un DM no tiene asunto. O el tipo gana una variante, o
el bloque de Instagram lleva `asunto: null` y la página no lo muestra. La segunda
es más barata y no rompe `tests/contacto-del-sitio.test.ts`, que verifica que cada
bloque salga de `MOTIVOS_DE_CONTACTO`.

## 3 · Alcance

### Los campos, como los pidió el dueño

Esta es la lista textual del pedido, con lo que cada uno significa en el modelo:

| # | Campo del formulario | En `/propuestas` | A dónde va al convertir |
|---|---|---|---|
| 1 | **Título del evento** | `titulo: string` (6–120) | `titulo` |
| 2 | **Descripción** | `descripcion: string` (15–4000) | `descripcion` |
| 3 | **Fecha o fechas** | `fechas: [{ dia, desde, hasta }]` | `sesiones[]` — un `ses_<uuid>` por fila, generado **al convertir** |
| 4 | **Horario** | `desde` / `hasta` de cada fila (`hh:mm`) | `sesiones[].inicio` / `.fin` |
| 5 | **Presencial / virtual** | `modalidad: 'presencial' \| 'virtual' \| 'las-dos'` | `modalidades[]` (D-130) |
| 6 | **Dirección** (si es presencial) | `lugar: { nombre, direccion, barrio }` | `modalidades[].sede` |
| 7 | **Organizador** | `organizador: { nombre, instagram }` | `organizador` |
| 8 | **Arancel** | `arancel: { tipo, notas }` — `tipo` **solo entre los `fijo: true`** | `arancel` |
| 9 | **¿Necesita inscripción? ¿Cómo es?** | `inscripcion: { requiere, comoDice }` | `inscripcion.{requiere, via, destino}` |
| 10 | **¿Qué incluye?** (material de lectura, libro, merienda…) | `incluye: string[]` + `incluyeOtro: string` | `incluye` (campo **nuevo** del modelo — ver §5) |
| 11 | **Foto: archivo o URL** | `imagen: { url } \| { storagePath }` — **las dos, DEC-11** | `imagenes[]` (B-167), promoviendo el objeto de `propuestas/` a `imagenes/` |
| — | **Contacto de quien propone** | `contacto: { via, valor }` — mail, WhatsApp o Instagram; **interno, nunca público** | nada: se queda en la propuesta |

Los cuatro campos de `meta`, que el formulario **no** muestra:
`estado`, `creadoEn`, `origen`, `revision`.

### Lo que queda afuera de la v1, a propósito

- **Ciclos con tema y lectura por encuentro.** El formulario acepta N fechas, no
  «Cap. 1-4» por fecha. Un ciclo con temas se propone y el dueño lo completa: es
  el caso donde validar-y-completar gana igual.
- **Comisiones** (D-530, `comisiones[]`). Mismo motivo: son cuatro horarios
  paralelos y explicarlo en un formulario público cuesta más de lo que ahorra.
- **Editar la propuesta después de mandarla.** Quien propone no vuelve a entrar
  (no hay cuentas — B-28). Si se equivocó, manda otra o escribe a `/contacto`.
- **Avisarle que se publicó.** Requiere mandar mail desde el sistema, que hoy no
  existe (no hay proveedor de mail). Queda como idea, no como alcance.
- **Estado público de la propuesta** («tu propuesta está en revisión»). Sería una
  URL con un token, o sea otra superficie pública. No.

## 4 · Modelo — `/propuestas/{id}`

```ts
// src/types/propuesta.ts  (nuevo)

export const ESTADOS_PROPUESTA = ['nueva', 'en-revision', 'aceptada', 'rechazada'] as const;

export interface Propuesta {
  titulo: string;                    // 6–120
  descripcion: string;               // 15–4000
  fechas: {                          // 1–12 filas
    dia: string;                     // 'aaaa-mm-dd'  ← string, NO Timestamp (§4.1)
    desde: string;                   // 'hh:mm'
    hasta: string | null;            // 'hh:mm' — si falta, lo completa el admin
  }[];
  modalidad: 'presencial' | 'virtual' | 'las-dos';
  lugar: { nombre: string; direccion: string; barrio: string } | null;
  organizador: { nombre: string; instagram: string | null };
  arancel: { tipo: 'gratis' | 'a-la-gorra' | 'arancelado'; notas: string | null };
  inscripcion: { requiere: boolean; comoDice: string | null };
  incluye: string[];                 // slugs YA existentes en /opciones/incluye-actividad
  incluyeOtro: string | null;        // texto libre — NO crea opción (§4.2)
  imagen: { url: string } | { storagePath: string } | null;

  // ── interno, no sale nunca ────────────────────────────────────────────────
  contacto: { via: 'mail' | 'whatsapp' | 'instagram'; valor: string };
  estado: (typeof ESTADOS_PROPUESTA)[number];
  creadoEn: TimestampLike;           // request.time — el cliente no puede antedatar
  origen: 'formulario-publico' | 'panel';
  revision: {
    porUid: string | null;           // quién la tocó
    en: TimestampLike | null;
    actividadId: string | null;      // la actividad que salió de acá
    motivo: string | null;           // por qué se rechazó — interno
  };
}
```

### 4.1 · Por qué las fechas son strings y no `Timestamp`

Va contra el §3.2 del `CLAUDE.md` («Guardar `Timestamp`, nunca strings de
fecha») **a propósito, y solo acá**, porque una propuesta no es una actividad:

- Un `Timestamp` armado en el navegador de quien propone lleva **su** zona
  horaria. Es literalmente la trampa 1 del §13, con el agravante de que el cliente
  es anónimo y no podemos suponer nada de su reloj.
- La conversión a `Timestamp` con `America/Argentina/Buenos_Aires` explícito pasa a
  ocurrir **una sola vez y del lado del admin**, al convertir, que es donde el
  proyecto ya la hace bien.
- `'aaaa-mm-dd'` + `'hh:mm'` es validable en la regla de Firestore con un `matches`,
  y un `Timestamp` no se valida en una regla más que por tipo.

Esta decisión hay que dejarla escrita en `06-decisiones.md` cuando se construya,
porque es un desvío de una regla del `CLAUDE.md` y sin el motivo al lado parece un
olvido.

### 4.2 · Por qué un anónimo no puede crear una opción de taxonomía

El §4 del `CLAUDE.md` dice que el campo «Otro» **incorpora el valor al
desplegable**. Eso vale para el panel, donde escribe una de las cuatro cuentas de
confianza. En un formulario público es otra cosa: es dejar que cualquiera escriba
en `/opciones/*`, que es una colección **con `allow read: if true`** y que **viaja
al `events.json`** (§4.4). O sea: se publicaría en el sitio lo que un anónimo
tipeó, sin que nadie lo mire.

Así que:

- el desplegable del formulario público muestra **solo opciones que ya existen**;
- «Otro» es **texto libre que se guarda en la propuesta** (`incluyeOtro`), no una
  opción;
- **el admin decide** si eso merece entrar a la taxonomía, y entonces sí corre por
  `upsertOpcion` con su slugify (trampa 6) y su `usos`.

Lo mismo con `arancel.tipo`: el formulario público ofrece **los tres `fijo: true`**
y nada más. `'beca-parcial'` y las que vengan se eligen desde el panel.

### 4.3 · Reglas de Firestore

Calcado de `reporteValido()` (`firestore.rules:88`), que ya resuelve la forma:
lista cerrada de claves, topes de tamaño, enums acotados con `in [...]`, `estado`
forzado y `creadoEn == request.time`. Las diferencias son tres:

```js
match /propuestas/{id} {
  // La bandeja la miran los admin, como /reportes.
  allow read:   if esAdmin();
  // ⚠️ LA PRIMERA ESCRITURA ANÓNIMA DEL PROYECTO.
  allow create: if propuestaValida();          // + App Check (B-836)
  allow update: if esAdmin() && revisionValida();
  allow delete: if false;                      // borra la Function de retención
}
```

1. **`create` sin `esAdmin()`** — es el punto del PRD, y es la línea que hay que
   revisar dos veces. Todo lo que la defiende está en `propuestaValida()` y en
   App Check.
2. **`estado == 'nueva'` y `revision` todo en `null`** los fuerza la regla. Si esto
   lo decide el cliente, un `curl` marca su propia propuesta como aceptada.
3. **`update` acotado a `estado` + `revision`**, con el mismo patrón de
   `reintentoValido()`/`resueltoValido()`: un admin no puede editar el **contenido**
   de una propuesta. Si hay que corregir el título, se corrige en la actividad que
   sale de ella — así la propuesta queda como prueba de qué se pidió.

Y el techo que la regla tiene que poner, porque el cliente se saltea:
`fechas.size() <= 12`, `incluye.size() <= 12`, cada string con su `size()`, y
`d.keys().hasOnly([...])` para que un campo de más no entre.

## 5 · El campo `incluye`, que es nuevo en el modelo

«¿Qué incluye el evento? (Material de lectura, libro, merienda, etc)» **no tiene
lugar hoy**. Lo más cerca es `material` (§3.1), que es otra cosa: links de lectura
con `entrega` y `publico`, pensado para el club de lectura. «Merienda» no entra ahí.

Es un campo del **modelo de actividad**, no solo de la propuesta: si se muestra en
la ficha pública tiene que existir en `/actividades`. Y es exactamente el patrón
§4 —vocabulario abierto que crece— así que va como **taxonomía autogestionada**
`/opciones/incluye-actividad`, con opciones base `fijo: true`:

`material-de-lectura` · `libro` · `merienda` · `cafe` · `certificado` ·
`grabacion` · `material-impreso`

**Agregarlo es el skill `/campo-nuevo`**, que existe justamente para esto y
recorre las seis salidas. No es trabajo de este PRD hacerlo a mano: es invocarlo.

Y ojo con el orden: **`incluye` conviene construirlo antes que el formulario
público**, porque el formulario lo necesita para mostrar el desplegable. Es la
primera tajada de B-830.

## 6 · La bandeja, en el panel

El precedente está construido y es casi el mismo: **`/reportes`**. Tiene
`ReportesPanel.tsx`, su vista en el router de `AdminApp.tsx`
(`vista.tipo === 'reportes'`), su badge, su ciclo de vida movido por una Function y
sus tres tests de integración contra el emulador.

La bandeja de propuestas es eso, con una acción más:

| Elemento | De dónde se copia |
|---|---|
| Vista `{ tipo: 'propuestas' }` en el router | `AdminApp.tsx:463-490`, la cadena de ternarios |
| Botón + badge de pendientes | `PendientesBadge.tsx` (taxonomías) y el botón de `reportes` (`AdminApp.tsx:528`) |
| Lista con filtro por estado | `ReportesPanel.tsx` |
| **Acción «convertir en actividad»** | no existe: es lo nuevo |

**«Convertir» es una función pura**, y ahí está el test que importa:

```ts
// src/lib/propuestas.ts  (nuevo)
export const propuestaAFormulario = (p: Propuesta): ActividadFormValues => …
```

Toma la propuesta y devuelve los valores del formulario que ya existe
(`ActividadFormValues`, `src/lib/schema.ts:795`). El admin cae en
`ActividadFormulario` **prellenado y en modo borrador**, corrige lo que haga
falta, y guarda por el camino de siempre. Cero código de publicación nuevo.

Tres cosas que esa función tiene que hacer bien, y son las tres testeables:

1. **Generar los `ses_<uuid>` en el cliente** al armar `sesiones[]` — trampa 2. La
   propuesta no los trae y no debe traerlos.
2. **Convertir `'aaaa-mm-dd' + 'hh:mm'` a `Timestamp` con la zona explícita** —
   trampa 1. Un test con una fecha en el cambio de horario de verano no está de más.
3. **No inventar un slug.** El slug lo arma el formulario como siempre, y es
   inmutable después de publicar (trampa 10).

Al guardar la actividad, la propuesta pasa a `aceptada` con `revision.actividadId`.
Eso lo puede hacer el panel (un `update` acotado) o una Function; **el panel
alcanza** y evita una Function más.

## 7 · Privacidad — lo que este PRD guarda y hoy no se guarda

**Una propuesta contiene el mail o el WhatsApp de una persona que no está
logueada.** Hoy el sistema no guarda ni un dato personal de un tercero: eso es
`B-102`, decidido y escrito. Este PRD lo rompe **a propósito y en un solo campo**,
porque sin forma de repreguntar la bandeja no sirve: la mitad de las propuestas van
a llegar sin la hora de fin o sin el barrio.

Lo que eso obliga:

| # | Qué | Dónde |
|---|---|---|
| 1 | `contacto` **no entra a ninguna proyección**. La whitelist de `toPublic.ts` no lo menciona, y no hay `toPublic` de propuestas: **una propuesta no tiene salida pública, ni una** | `toPublic.ts` no se toca |
| 2 | Fila propia en la tabla de «Nunca al JSON» (§5.1) y en `07-seguridad.md` | doc |
| 3 | El barrido de datos personales tiene que **conocer la colección nueva** | `tests/sin-datos-personales.test.ts` |
| 4 | El `auditor-privacidad` tiene que **despertarse** con los archivos nuevos (su ficha lista los paths que lo disparan) | `docs/13-agentes.md` + la ficha del agente |
| 5 | **Retención: 30 días** (**DEC-13**, contestada). Una propuesta rechazada se borra —**documento e imagen**— con una Function `onSchedule`, como las tres que ya hay | `functions/` |
| 6 | La página `/proponer` **dice lo que hace con el dato**, con esas palabras: para qué se usa, quién lo ve, cuánto se guarda | `src/lib/…` + `tests/promesas-sobre-datos.test.ts` |

El punto 6 no es un detalle de redacción: `tests/promesas-sobre-datos.test.ts`
barre las promesas que el sitio hace sobre los datos, y hoy el sitio puede afirmar
cosas fuertes porque no guarda nada. **Con este PRD deja de poder.** Si la página
de contacto o la de ayuda dicen «no guardamos datos», hay que corregirlas en el
mismo cambio, o el sitio miente.

## 8 · Seguridad — la puerta que se abre

Ver [`README.md`](README.md) §2 para las cinco capas. Lo específico de este
formulario:

- **La foto es el punto más caro, y va: DEC-11 se contestó «puede subir imagen».**
  Así que la v1 abre `write` a Storage para un anónimo, con todo lo que eso
  arrastra: prefijo `propuestas/` con **`get` y `list` en `false`** (trampa 13),
  **1 archivo de 3 MB** (el mismo límite de DEC-7b, dicho en el schema **y** en
  `storage.rules` porque el cliente se saltea), App Check, y promoción a
  `imagenes/` al aceptar — que es copiar entre prefijos del mismo bucket y por lo
  tanto **trampa 12**: el trigger de optimización tiene que ignorar `propuestas/`,
  o se dispara a sí mismo.

  **Y el borrado es parte del ciclo, no una limpieza**: «si el evento lo
  descartamos se tiene que borrar». Rechazar borra el objeto en el mismo paso, y la
  retención de 30 días borra documento e imagen juntos. El barrido de huérfanos de
  B-221 (`functions/limpieza-imagenes.js`) queda como **red**, no como mecanismo —
  si es lo único que borra, hay una imagen de alguien viva hasta que el barrido
  corra.
- **Rate limit real no lo da Firestore.** App Check + honeypot frenan lo
  automático; el humano insistente no. La red que queda es la bandeja: si aparecen
  50 propuestas de la misma IP, el admin las borra. Para eso el barrido programado
  y un contador por día en `/sistema/*` para que el tablero lo muestre.
- **`/proponer` es indexable y eso se quiere** (un organizador la busca en Google),
  así que entra a `sitemap.xml`, con su `canonical` y su Open Graph. No es una
  página oculta.

## 9 · El contra

**Puede empeorar el trabajo en vez de mejorarlo.** Una propuesta incompleta y
optimista —«taller de escritura, sábados, a la gorra»— cuesta más de revisar que
un mail bien escrito, porque parece cargada y no lo está. Y el formulario invita a
mandar cualquier cosa: es lo que pasa con todo formulario público.

Lo que hace que valga igual:

1. **El estado inicial es `nueva`, no `borrador de actividad`.** Nada aparece en el
   sitio, así que el peor caso es una bandeja con basura, no un sitio con basura.
2. **El formulario pide poco.** Once campos, no treinta. Una propuesta completa es
   plausible en tres minutos, y eso es lo que decide si alguien la manda.
3. **La conversión es un prellenado, no un import.** El dueño sigue viendo el
   formulario completo antes de publicar, así que la validación no se saltea.

El riesgo que **no** tiene mitigación y hay que aceptar: la bandeja es un lugar más
para mirar. Si nadie la mira, las propuestas mueren ahí y es peor que el mail,
porque el mail al menos molesta en la casilla. La mitigación posible es el badge con
el número de pendientes en el panel, que es lo que ya hace `/reportes`.

## 10 · Criterios de aceptación

1. Un anónimo puede crear un documento en `/propuestas` desde `/proponer` **y no
   puede hacer nada más**: no puede leer, no puede editar, no puede borrar, y no
   puede escribir en ninguna otra colección. Verificado contra el emulador.
2. Un `create` con `estado: 'aceptada'`, con un campo de más, con 200 fechas, o con
   `creadoEn` antedatado **es rechazado por la regla**, no por el cliente.
3. Un anónimo **no** puede crear una opción en `/opciones/*` por ningún camino.
4. La propuesta **no aparece** en `events.json`, ni en el HTML de ninguna página, ni
   en el sitemap. El barrido de salidas públicas lo afirma.
5. `contacto` no aparece en ninguna salida pública ni en ningún log.
6. «Convertir en actividad» prellena el formulario, genera un `ses_<uuid>` por
   fecha, y las horas quedan en `America/Argentina/Buenos_Aires`. Con un test sobre
   el cambio de horario.
7. Publicar la actividad que salió de una propuesta dispara el sync a Calendar y el
   rebuild **por el camino que ya existe**, sin código nuevo.
8. La propuesta aceptada queda con `revision.actividadId` apuntando a la actividad.
9. `/proponer` declara qué se guarda, quién lo ve y por cuánto tiempo, y ninguna
   otra página del sitio afirma lo contrario.
10. Una propuesta rechazada desaparece **a los 30 días** sin que nadie la borre a
    mano, **y su imagen con ella**. Verificado contra el emulador de Storage.
11. **Rechazar una propuesta borra su imagen en el mismo paso**, sin esperar al
    barrido. Un documento borrado con su objeto vivo, o al revés, es un caso de
    test y no una posibilidad teórica.
12. El trigger de optimización de imágenes **ignora el prefijo `propuestas/`**, así
    que promover una imagen aceptada no se dispara a sí mismo (trampa 12).
13. `propuestas/` no acepta `get` ni `list`, ni siquiera con la URL exacta del
    objeto (trampa 13).

## 11 · Decisiones del dueño — **las tres contestadas el 2026-09-08**

Lo que sigue es lo acordado, no una propuesta. La segunda columna deja la pregunta
original, porque la respuesta se entiende mejor contra ella.

| # | Qué se preguntó | Respuesta | Contra lo que este PRD recomendaba |
|---|---|---|---|
| **DEC-10** | ¿El formulario reemplaza el `mailto:` de «Sugerir una actividad»? | **No: `/contacto` queda también** | ⚠️ **Al revés.** El PRD proponía reemplazarlo. Conviven, con `/contacto` mandando a `/proponer` — ver § 2 |
| **DEC-11** | ¿Se puede subir el archivo, o solo pegar una URL? | **Puede subir imagen**, y **si se descarta se borra** | ⚠️ **Al revés.** El PRD proponía solo URL en la v1. `storage.rules` entra al alcance ya, con la trampa 12 y la 13 adentro — ver § 8 |
| **DEC-13** | ¿Cuántos días se guarda una rechazada? | **30 días** | ✅ Igual, y precisado: se borra **documento e imagen** |
| — | ¿`/contacto` suma Instagram como canal? | **Sí** (**B-839**) | ✅ El handle ya está en `enlaces.ts` — ver § 2 |
| — | ¿Cuántas fechas acepta el formulario? | **12**, sin objeción | ✅ Un ciclo más largo conviene cargarlo desde el panel |

**Las dos que salieron al revés salieron mejor que mi recomendación.** DEC-10
porque una casilla de mail es una puerta más ancha que un formulario de once
campos, y la propuesta que no entra por uno tiene que poder entrar por la otra.
DEC-11 porque pedirle a un organizador que hostee su propio flyer para poder pegar
una URL es pedirle que resuelva un problema nuestro — y el que no pueda, no manda
la foto.

**Lo que cuesta DEC-11, dicho una vez para que no sorprenda:** `storage.rules` y
el borrado dejan de ser una segunda tajada y entran a la primera. Son la regla del
prefijo, el límite dicho en dos lugares, la guarda de la trampa 12 en el trigger
que ya existe, el borrado al rechazar, el borrado a los 30 días y cuatro criterios
de aceptación más (§ 10, del 10 al 13). No cambia el diseño de nada; agranda la
tajada 1.
