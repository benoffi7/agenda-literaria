# Patrones y convenciones

Cómo se escribe código en este proyecto. Si algo acá parece mejorable,
proponerlo antes de cambiarlo.

## Regla de proceso: la documentación se actualiza con el código

**Todo pedido de funcionalidad, arreglo o modificación de código termina con la
documentación actualizada.** No es opcional ni un paso posterior: es parte de
haber terminado.

En cada cambio, revisar qué corresponde tocar:

| Si el cambio… | Actualizar |
|---|---|
| agrega o modifica comportamiento visible | [`04-funcionalidades.md`](04-funcionalidades.md) |
| toca infra, IAM, APIs, regiones, cuentas | [`02-infraestructura.md`](02-infraestructura.md) |
| cambia colecciones o campos | [`03-modelo-de-datos.md`](03-modelo-de-datos.md) |
| implica una decisión o un desvío del `CLAUDE.md` | [`06-decisiones.md`](06-decisiones.md) |
| cambia qué es público o cómo se verifica | [`07-seguridad.md`](07-seguridad.md) |
| cambia cómo se corre o despliega | [`08-operacion.md`](08-operacion.md) |
| **cualquier cambio** | [`CHANGELOG.md`](CHANGELOG.md) |

**Todo reporte de posible bug va al [`BACKLOG.md`](BACKLOG.md), ordenado por
prioridad**, incluso si se arregla en el momento — en ese caso entra ya cerrado,
para que quede el rastro de qué se rompió y por qué.

## Idioma

Código, campos, comentarios y commits en **español** (§14). Es coherente con el
dominio: `sesiones`, `arancel`, `tallerista` son los términos que usa quien
carga las actividades.

Los tipos y funciones también: `formADocumento`, `construirDescripcion`,
`ordenarValores`.

## Comentarios

Explican **por qué**, no qué. Y cuando hay una trampa detrás, se nombra:

```ts
// Trampa 10 — el slug es inmutable después de publicar: si no, URLs rotas y
// SEO perdido.
const slugBloqueado = inicial?.estado === 'publicado';
```

Las referencias a secciones del `CLAUDE.md` (`§7.2`, `trampa 3`) se usan mucho a
propósito: cualquiera que lea el código puede ir a la fuente de la decisión.

## Lógica pura separada de la infraestructura

`functions/calendario.js` no importa Firebase ni googleapis. El diff es la parte
más frágil del sistema, y aislarlo permite testearlo sin emuladores y sin tocar
un calendario real.

Mismo criterio en `src/lib/`: `slugify`, `normalize`, `sesiones`, `toPublic` y
`schema` son puros. Los que hablan con Firestore (`actividades`, `opciones`)
están aparte.

**Al agregar lógica, preguntarse si necesita red.** Si no, va en un módulo puro.

## Comparar payloads, no listas de campos

La guarda anti-loop del sync **no** mantiene una lista de campos relevantes:
compara el evento que se le mandaría a Calendar antes y después.

```js
// mal — hay que acordarse de agregar cada campo nuevo
const CAMPOS = ['titulo', 'descripcion', 'sede'];
if (CAMPOS.some((f) => a[f] !== b[f])) actualizar();

// bien — no hay nada que mantener
if (JSON.stringify(construirEvento(a, s)) !== JSON.stringify(construirEvento(b, s))) actualizar();
```

Agregar un dato a la descripción sin agregarlo a la lista dejaba de propagar ese
cambio al calendario, **en silencio**. Con el payload no se puede olvidar.

Aplicable a cualquier lugar donde haya que decidir "¿cambió algo relevante?":
derivar lo relevante y comparar eso.

## Un campo nuevo se lee con el default que preserva lo anterior

Los documentos que ya están en producción no tienen el campo que se agrega hoy,
y los scripts de siembra son idempotentes: no los pisan. Entonces el default de
lectura no es una preferencia estética, decide si algo que funcionaba sigue
funcionando.

```ts
// bien — lo que ya estaba cargado se sigue comportando igual
export const estaAprobada = (v: ValorOpcion) => v.fijo || (v.aprobada ?? true);

// mal — el día del deploy desaparecen del desplegable las opciones que ya se usan
export const estaAprobada = (v: ValorOpcion) => v.fijo || v.aprobada === true;
```

Solo lo **nuevo** arranca con el comportamiento nuevo, porque solo lo nuevo se
escribe con el campo puesto. Y el tipo lo declara opcional (`aprobada?:`) para
que el compilador obligue a decidir el default en cada lectura.

Si además se quiere el campo explícito en los documentos viejos, va como
migración **opcional e idempotente** (`--backfill`), nunca como requisito para
que el código funcione: un restore o un proyecto nuevo traen de vuelta los
documentos sin el campo. Ver [D-26](06-decisiones.md).

## Filtrar lo elegible no es filtrar lo mostrable

Cuando una lista sirve para dos cosas —elegir un valor y resolver el valor ya
guardado— hay que devolver las dos, con nombres que no se confundan:

```ts
const { valores, elegibles } = useOpciones(campo, uid);
// valores   → todas: para resolver la etiqueta de un slug ya guardado
// elegibles → lo que esta cuenta puede elegir ahora
```

Filtrar de más se ve enseguida en producción: la actividad guardó legítimamente
un slug que la lista filtrada no tiene, y la UI muestra `"con-beca-parcial"` en
lugar de `"Con beca parcial"` — o peor, en una salida pública como el evento de
Calendar. Ver [D-30](06-decisiones.md).

## Validación en el submit, no por campo

El formulario es estado controlado de React y se valida con zod al guardar
(`src/lib/schema.ts`). No hay librería de formularios: con campos anidados y
componentes propios (taxonomías, sesiones) habría hecho falta un `Controller`
en todos lados sin ganar nada.

Los condicionales del §11 van en `superRefine`, no en el tipo:

```ts
.superRefine((v, ctx) => {
  const necesitaSede = v.modalidad === 'presencial' || v.modalidad === 'hibrido';
  if (necesitaSede && !v.sede?.nombre) {
    ctx.addIssue({ path: ['sede', 'nombre'], message: 'Una actividad presencial necesita sede' });
  }
})
```

Los errores se mapean por `path.join('.')` y se muestran al lado de su campo.

## Ids generados en el cliente, nunca por índice

Cualquier array editable cuyos elementos se sincronicen con un sistema externo
necesita ids estables generados al crear el elemento:

```ts
export const nuevaSesionId = (): string => `ses_${crypto.randomUUID()}`;
```

El schema lo verifica (`/^ses_/`), así que un id armado a mano falla la
validación.

## Idempotencia en los scripts

`preparar-produccion.mjs` no pisa las opciones que ya existen: chequea antes.
Un script contra producción tiene que poder correrse dos veces.

Y tiene guardas de entorno en las dos direcciones:

- `seed-emulador.mjs` **aborta** si el host no es local.
- `preparar-produccion.mjs` **aborta** si detecta variables de emulador.

## Tests

Vitest. `npm test` corre todo; los de integración se saltean solos si los
emuladores no están (`describe.skipIf`).

**Qué se testea:**

- Cada trampa del §13 tiene al menos un test que la nombra.
- La lógica pura, exhaustivamente — es barata de testear.
- Contra el emulador: lo que solo se puede verificar de verdad ahí (la
  transacción de deduplicación, las reglas de Firestore, el ida y vuelta del
  documento).
- **Lo que fija una decisión implícita.** `tests/opciones-orden.test.ts` existe
  porque el orden del array decide qué opción preselecciona el formulario: sin
  ese test, reordenar el JSON cambia el default en silencio.

**Qué no:** los componentes de React no tienen tests de render. No hay
testing-library instalada. La verificación de la UI fue manual y contra
producción.

Los nombres de los tests describen el comportamiento en español, con la
referencia a la sección:

```ts
it('borrar la sesión del medio toca solo su evento', () => { … });
describe('planificar — guarda anti-loop (§7.1, trampa 3)', () => { … });
```

## Verificar contra el sistema real, no contra lo que se cree que se mandó

Los tests unitarios prueban la intención. Para lo que sale al mundo hay que leer
el resultado:

- Después de un build, `grep` sobre `dist/` para confirmar que
  `firebase-admin` no se filtró.
- Después de un deploy del sync, leer el **ICS del calendario** y verificar que
  el link de Zoom no está.
- Después de deployar reglas, intentar la escritura anónima con `curl` y
  confirmar que la rechaza.

Los comandos están en [`07-seguridad.md`](07-seguridad.md) y
[`08-operacion.md`](08-operacion.md).

## Estilo de UI

Tailwind 4 con tokens en `src/styles/global.css`. Paleta de papel y tinta
(`--color-papel`, `--color-tinta`, `--color-borde`, `--color-acento`) acorde al
dominio literario. Serif (Lora) para títulos, sans (Inter) para el resto.

Las clases de controles están centralizadas en
[`campos/Campo.tsx`](../src/components/admin/campos/Campo.tsx): `claseInput`,
`claseBotonPrimario`, `claseBotonSecundario`, `claseBotonTinta`,
`claseBotonFila`. **No escribir clases de botón sueltas** — si hace falta una
variante, agregarla ahí.

`--spacing-touch` (44px) es el mínimo de un blanco táctil y se aplica con
`min-h-touch`.

## Mobile primero en los layouts

El default es la columna; las filas se habilitan desde `sm`:

```tsx
<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
```

Y todo contenedor de grilla lleva `min-w-0` para que un texto largo no desborde.
