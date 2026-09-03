---
name: campo-nuevo
description: Agrega un campo al modelo de una actividad de punta a punta, en el orden correcto y sin dejar ningún lugar sin tocar — tipo, schema de zod, conversión form ⇄ documento, formulario, proyección pública, evento de Calendar, analítica, ayuda, doc y tests. Invocalo cuando se pida agregar, quitar o cambiar un campo de /actividades, de /opciones o del formulario del panel (por ejemplo el "libro presentado" de DEC-1), o cuando el usuario diga "/campo-nuevo".
---

# Agregar un campo al modelo

Un campo del modelo toca doce lugares. Los que se olvidan siempre son los mismos
tres: **la proyección pública**, **el default de lectura** y **la ayuda**. Los
tres fallan sin que nada se ponga en rojo, y uno de ellos publica datos.

La definición canónica del modelo es el **§3 del `CLAUDE.md`**; su traducción a
TypeScript, `src/types/actividad.ts`. `docs/03-modelo-de-datos.md` explica cómo
se usa.

## 0 · Antes de escribir una línea: cuatro decisiones

Escribilas y **confirmalas con el usuario** antes de tocar código. Son las que
no se pueden deshacer después.

1. **¿Es público?** Resolvé las **doce** salidas, una por una:

   | # | Salida | Quién la produce |
   |---|---|---|
   | 1 | `events.json` y el HTML del listado | `src/lib/toPublic.ts`, `src/lib/eventsJson.ts`, para lo que la **tarjeta dice** `src/lib/tarjetaPublica.ts`, y para el `CollectionPage`/`ItemList` de la home `src/lib/hubsPublicos.ts` (`coleccionSchema`, B-107) |
   | 2 | el evento de Calendar | `functions/calendario.js` |
   | 3 | el issue de GitHub | `functions/reportes.js` |
   | 4 | GA4 (panel) | `src/lib/analytics-eventos.ts` |
   | 5 | el texto para copiar a redes | `src/lib/textoRedes.ts` |
   | 6 | la página de detalle y su JSON-LD | `src/lib/detallePublico.ts` (incluido `migasDeDetalle`, el `BreadcrumbList`, B-107), y `src/lib/afiche.ts` para el texto de la tira de imágenes (B-296) |
   | 7 | la cartelera `/cartelera` | `src/lib/cartelera.ts`, `src/lib/imagenes.ts` (`urlDeMiniatura`, B-220) |
   | 8 | la página de mes `/agenda/{aaaa-mm}` | `src/lib/mesPublico.ts` |
   | 9 | el `sitemap.xml` y el `robots.txt` | `src/lib/sitemap.ts` |
   | 10 | el archivo `/pasadas` | `src/lib/pasadasPublicas.ts` |
   | 11 | los hubs `/tipo/{slug}`, `/barrio/{slug}`, `/gratis`, `/online` | `src/lib/hubsPublicos.ts` (B-108), incluido `coleccionSchema` (B-107) |
   | 12 | GA4 (sitio público) | `src/lib/analyticsSitio.ts` (B-372/B-375) |

   "No decidí" no es una opción: el default de agregarlo al `pick` es publicar
   (§5.1). El mapa autoritativo, con el motivo de cada celda, está en
   `docs/07-seguridad.md`.

   > **Esta lista decía cuatro hasta el 2026-08-28**, y le faltaban las dos más
   > irreversibles: el **posteo** (desde B-95) y la **página indexada** (desde
   > B-227). O sea que se podía seguir este skill al pie de la letra y publicar un
   > campo nuevo en Instagram o en Google sin que nada lo frenara — que es
   > exactamente la clase de bug que el skill existe para evitar. Lo encontró el
   > `auditor-documentacion` (**B-244**). Si agregás una salida, **se agrega acá en
   > el mismo cambio**.
   >
   > Pasó de siete a **once** con B-265, B-113, B-109 y B-108, y a **doce** con
   > B-372/B-375. Todas las veces las ató el
   > mismo test (`tests/agentes-y-skills.test.ts`), que compara los números de las
   > tres tablas: la de `docs/07-seguridad.md`, la de la ficha del
   > `auditor-privacidad` y ésta.
2. **¿Es un dato libre o una taxonomía?** Si es un valor de un conjunto que va a
   crecer, va como `/opciones/{campo}` con el patrón del §4 (slugify + upsert
   transaccional + aprobación), no como string libre.
3. **¿Entra al evento de Calendar?** Si sí, entra a la **descripción** vía
   `construirDescripcion`, y por lo tanto al payload que compara la guarda
   anti-loop: el cambio se propaga solo a las N sesiones del ciclo (D-07). Si lo
   armás fuera de `construirEvento`, deja de propagarse en silencio (trampa 9).
4. **¿Qué pasa con los documentos que ya están en producción?** No tienen el
   campo. El default de lectura tiene que **preservar el comportamiento
   anterior** (`v.campo ?? <lo de antes>`, D-26), y el tipo lo declara opcional
   para que el compilador obligue a decidirlo en cada lectura. Un backfill, si
   hace falta, va como migración **opcional e idempotente**, nunca como
   requisito.

## 1 · Tipo

`src/types/actividad.ts`: agregalo a `Actividad` y, si se carga desde el
formulario, a `ActividadForm`. Las fechas son `Timestamp` en Firestore y
`string` de `datetime-local` en el form: **nunca strings de fecha en Firestore**
(trampa 1).

## 2 · Schema

`src/lib/schema.ts`. La validación es **en el submit, no por campo**. Si el
campo es obligatorio solo en algunos casos, la condición va en `superRefine`
(como los condicionales del §11), no en el tipo, y el mensaje se muestra al lado
del campo por `path.join('.')`.

## 3 · Conversión

`src/lib/actividades.ts`: `formADocumento` y `documentoAForm`. El ida y vuelta
no debe perder nada — hay test de integración que lo verifica, y en particular
que no se pierdan los ids de sesión.

## 4 · Formulario

`src/components/admin/`. Con el §11 en la mano:

- Va en la sección que le corresponde, y **condicional por tipo/modalidad** si
  no aplica siempre.
- Controles con las clases de `campos/Campo.tsx` (`claseInput`,
  `claseBotonPrimario`, …). **No escribas clases de botón sueltas.**
- Mobile: 16px hasta `sm` (menos hace zoom en iOS y no vuelve), blanco táctil de
  44px (`min-h-touch`), `min-w-0` en los contenedores, columna por default y
  fila desde `sm`, y el teclado que corresponda (`inputMode`, `autoCapitalize`).
- Si el campo tiene una trampa detrás, la ayuda corta va en la prop `ayuda` del
  `Campo`.
- Si es una taxonomía, usá el input con autocompletado: si lo tipeado normaliza a
  un slug que ya existe, avisa y **reusa** (§4.2). Las etiquetas nuevas se
  persisten **en el submit**, no al tipearlas.

## 5 · Proyecciones públicas

Según la decisión 1, y son **cuatro archivos en cadena**, no uno. Todas son
**whitelist**: se enumera lo que sale, nunca un spread. Si el campo sale
condicionado por un flag, el flag manda y sin dato no se inventa el campo (D-15).

| Si el campo va a… | Tocá |
|---|---|
| la salida 1 | `src/lib/toPublic.ts` — qué *puede* ser público |
| …y además lo necesita el **listado** (filtrar, ordenar, pintar la tarjeta) | `src/lib/eventsJson.ts` — el índice recorta más que `toPublic` a propósito |
| …y la **tarjeta** lo tiene que decir | `src/lib/tarjetaPublica.ts` — que esté en el índice no lo pone en la tarjeta. Ahí se decide la frase, y ahí se testea; el componente solo acomoda, y qué campos de la entrada puede tocar directo es una lista cerrada en `tests/listado-del-sitio.test.ts` |
| la salida 6 | `src/lib/detallePublico.ts` — la página de detalle **no ve el documento**, solo este view-model (D-140), así que un campo que no se agregue acá no aparece aunque esté en `toPublic` |
| la salida 5 | `src/lib/textoRedes.ts` — el `Pick` de `ActividadParaRedes` |
| la salida 8 | nada: la página de mes recibe `EntradaDeIndice[]`, así que hereda lo que decidas en la salida 1. Lo único que se decide acá es si el campo tiene que entrar en alguna de las tres frases de `src/lib/mesPublico.ts` — y si entra, se suma al barrido de esa salida |
| la salida 9 | **nada, y conviene saber por qué**: el sitemap publica rutas, no campos, así que ningún campo del modelo puede entrar ahí. Lo único que se decide en esa salida es *qué páginas* se ofrecen — y eso cambia si el campo nuevo hace nacer una página nueva |
| la salida 10 | nada: `/pasadas` recibe `EntradaDeIndice[]` y hereda la salida 1, como la 8. Sus frases no interpolan ningún dato de actividad, y si alguna empieza a hacerlo hay que agregarle barrido de centinelas |

**El barrido te va a decir si te olvidaste de decidir**: `tests/barrido-de-salidas-publicas.test.ts`
exige que el fixture tenga el campo nuevo y falla en las **dos** direcciones —si
sale sin estar permitido y si está permitido y no sale—. Cuando falle, la
respuesta no es agregarlo a la lista de excepciones sin pensar: es contestar la
celda.

## 6 · Evento de Calendar

`functions/calendario.js` — `construirDescripcion` y, si corresponde,
`construirUbicacion`. Es **lógica pura y compartida**: la importa la Function y
también el panel por el alias `@calendario` para la vista previa (D-20). Por eso
mismo la vista previa se actualiza sola; no la reimplementes.

## 7 · Duplicar

`src/lib/duplicar.ts`. ¿La copia hereda este campo? Los ids de sesión y
`calendarEventId` no se heredan nunca; el slug y el estado tampoco. Si el campo
es específico de una edición del ciclo (como los encuentros cancelados),
decidilo explícitamente.

## 8 · Analítica

`src/lib/analytics-eventos.ts`, solo si aporta. **No sale contenido**: entero,
booleano, enum cerrado o ruta del schema. No existe sanitizador de texto libre y
no se agrega uno. Si el campo es validable, el vocabulario de campos se deriva
del schema (D-60), así que revisá que la ruta nueva quede reconocida. Si tocás la
taxonomía, `docs/09-analitica.md` se actualiza en el mismo cambio.

## 9 · Reglas de Firestore

`firestore.rules`. Las de `/actividades` validan quién escribe, no la forma. Pero
si el campo entra a `/reportes/{id}`, ahí sí hay validación de forma: conjunto
exacto de campos y topes de largo, y agregar un campo sin tocarla hace que la
escritura sea rechazada.

## 10 · Tests

Con el criterio de `docs/05-patrones.md`: la lógica pura, exhaustivamente y sin
emuladores; contra el emulador, solo lo que solo ahí se puede verificar. Como
mínimo:

- schema: el caso válido y el inválido, con los condicionales del §11;
- ida y vuelta form ⇄ documento sin pérdida;
- **la decisión de privacidad del paso 0**, con un test que la nombre
  (`it('… (§5.1, trampa 5)')`) — si el campo no es público, un test que verifique
  que **no** aparece en la salida;
- si entra al evento, que el cambio del campo propague a las N sesiones.

Nombres en español, describiendo el comportamiento, con la referencia a la
sección o la trampa.

## 11 · Cerrar

Invocá el skill `cerrar-cambio`: `docs/03-modelo-de-datos.md` (campo nuevo),
`docs/04-funcionalidades.md` (si se ve), `docs/07-seguridad.md` (si cambia qué
es público), CHANGELOG, y `ayuda.ts`/`novedades.ts` según corresponda.

Y pasá el `auditor-privacidad`: un campo nuevo es exactamente su caso.
