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
| toca qué se mide o con qué nombre | [`09-analitica.md`](09-analitica.md) |
| **se nota al usar el panel** | [`src/lib/novedades.ts`](../src/lib/novedades.ts) — ver abajo |
| **cambia un comportamiento que no se ve** | [`src/lib/ayuda.ts`](../src/lib/ayuda.ts) — ver abajo |
| **cualquier cambio** | [`CHANGELOG.md`](CHANGELOG.md) |

**Todo reporte de posible bug va al [`BACKLOG.md`](BACKLOG.md), ordenado por
prioridad**, incluso si se arregla en el momento — en ese caso entra ya cerrado,
para que quede el rastro de qué se rompió y por qué.

## Regla de proceso: la ayuda del panel se actualiza con la funcionalidad

El panel lo usan **dos** personas: quien pidió cada cosa y sabe por qué es como
es, y quien no participó de ninguna de esas decisiones. La segunda se entera de
lo nuevo solo si alguien se lo cuenta — o si está escrito adentro del panel. Hay
dos archivos para eso, y son parte de "haber terminado" igual que el changelog:

| Archivo | Qué es | Cuándo se toca |
|---|---|---|
| [`src/lib/novedades.ts`](../src/lib/novedades.ts) | "Qué podés hacer ahora que antes no podías", en el idioma de quien carga actividades | cuando el cambio **se nota al usar el panel**. Una entrada arriba del array: id nuevo, fecha, título, dos frases y dónde está. 30 segundos |
| [`src/lib/ayuda.ts`](../src/lib/ayuda.ts) | La guía: el *para qué* de cada sección y los comportamientos que no se ven | cuando el cambio **agrega o modifica algo que no se adivina** mirando la pantalla: algo que queda fijo, algo que se publica o deja de publicarse, algo que borra o crea eventos |

**No** va a `novedades.ts` lo que no cambia nada para quien carga (un refactor,
una cabecera de cache, un test). Esa lista no es un registro de trabajo: si se
llena de entradas que no le sirven a nadie, se deja de leer y el mecanismo
muere.

**La ayuda corta de un campo puntual no va en `ayuda.ts`**: va en la prop
`ayuda` de `Campo`, al lado del campo, que es donde se lee. `ayuda.ts` es para
lo que no cabe ahí.

Dos tests sostienen la regla, y son a propósito incómodos de saltear:

- `tests/ayuda.test.ts` lee `ActividadFormulario.tsx` y **falla si el
  formulario tiene una sección sin capítulo en la guía**. Agregar una sección
  nueva obliga a escribir su ayuda en el mismo cambio. Si falla, la respuesta no
  es aflojar el test.
- El mismo archivo verifica que los seis avisos irreversibles sigan explicados
  (la dirección web que se congela al publicar, el link de la reunión, lo
  interno, cancelar un encuentro, pasar a borrador, el calendario como espejo) y
  que el texto no tenga jerga: sin `§`, sin nombres de archivo, sin nombres de
  campo.

## Regla de proceso: si hay un skill, se usa

**Siempre que exista un skill para lo que hay que hacer, se invoca el skill.**
No se rehace el procedimiento a mano "porque esta vez es corto".

El motivo no es ahorrar tipeo: **un skill es el procedimiento acordado.** Cuando
alguien lo hace a mano en paralelo, no queda una versión y una copia — quedan
dos versiones, y la que se ejecuta a mano no tiene forma de enterarse cuando la
otra cambia. Es exactamente el mecanismo por el que el corte del bundle se
deshace en silencio, por el que `desSlug` estuvo duplicado en el panel y en el
evento (H2), y por el que la analítica dejó de reconocer las versiones que el
build produce (B-88): **dos derivaciones de la misma idea se separan sin que
nada falle.**

Los pasos que se saltean al hacerlo a mano son siempre los mismos tres, y son
los que el skill existe para que no se salteen: la entrada de `novedades.ts`, el
default de lectura del campo nuevo, y el ítem del backlog del bug que apareció
en el camino.

| Si estás por… | Invocá |
|---|---|
| cerrar un cambio (doc, CHANGELOG, ayuda, novedades, backlog) | `cerrar-cambio` |
| agregar un campo al modelo | `campo-nuevo` |
| anotar un bug o una idea | `al-backlog` |
| pushear o abrir un PR | `antes-de-pushear` |
| automatizar algo que ya se hizo dos veces | `automatizar` |
| decidir qué deployar | `/que-deployar` |

Dos aclaraciones para que la regla no se vuelva absurda:

- **Si el skill está mal, se arregla el skill** — en el mismo cambio. Lo que no
  se hace es esquivarlo esta vez y dejarlo mal para la próxima.
- **Un skill no reemplaza a los tests ni a los auditores**: corre además. Y a la
  inversa, un skill que reimplementa lo que un script ya decide es la misma
  duplicación al revés: `que-deployar` **usa** `scripts/que-deployar.sh`, no
  copia la decisión.

El inventario completo, con qué automatiza cada uno y qué se decidió **no**
automatizar, está en [`13-agentes.md`](13-agentes.md).

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

Mismo criterio en `src/lib/`: `slugify`, `normalize`, `sesiones`, `duplicar`,
`toPublic` y `schema` son puros. Los que hablan con Firestore (`actividades`,
`opciones`) están aparte.

`duplicar.ts` es el ejemplo más claro de por qué: un bug ahí corrompe los
eventos de calendario de la actividad **original**, y siendo puro se cubre con
veinte tests que corren en milisegundos y sin emuladores.

**Al agregar lógica, preguntarse si necesita red.** Si no, va en un módulo puro.

### El reloj también es infraestructura

`functions/rebuild.js` decide cuándo reintentar un rebuild fallido (backoff
exponencial, corte a los N intentos). No llama a `Date.now()`: el "ahora" entra
como parámetro.

```js
// mal — para testear el cuarto reintento hay que esperar 75 minutos
export const decidirDisparo = (estado) => { const ahora = Date.now(); … };

// bien — el test simula 24 horas de ticks en 3 ms
export const decidirDisparo = (estado, ahora) => { … };
```

Los límites (`MAX_INTENTOS`, `ESPERA_BASE_MS`) también son parámetros con
default, así que un test puede bajar el máximo a 2 sin reescribir nada.

Mismo criterio para los timestamps que la lógica **lee de vuelta**:
`ultimoIntento` y `disparado` se escriben como `Date` desde el módulo puro, no
con `serverTimestamp()` — el sentinel del servidor no se puede comparar con
nada, y mezclar dos relojes en el mismo cálculo es cómo se cuelan los errores
de skew. `actualizado`, que nadie lee para decidir, sigue con
`serverTimestamp()`.

Ese aislamiento también permitió **reusar** `functions/calendario.js` desde el
panel para la vista previa del evento, con el alias `@calendario` (D-20): la
vista previa no reimplementa la descripción, importa la misma función que
publica el evento. Cuando dos lugares tienen que mostrar lo mismo —y más si
lo que está en juego son las reglas de privacidad del §5.1— el patrón es
compartir el módulo, no copiar la lógica.


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

El historial de versiones (§12) es el segundo uso del patrón, y muestra que hay
que elegir la **dirección** de lo que se enumera. Ahí lo derivado es el
*contenido editable* —el documento menos lo que escribe la máquina— y lo que se
enumera a mano es la lista de campos de máquina, no la de campos importantes:

| | Si te olvidás de un campo nuevo |
|---|---|
| lista de campos **importantes** | el cambio no se registra → **pérdida de datos, en silencio** |
| lista de campos **de máquina** | se registra de más → un documento de basura, visible |

Cuando el costo de los dos errores no es simétrico, la lista va del lado en que
olvidarse sale barato (D-41).


## Validación en el submit, no por campo

El formulario es estado controlado de React y se valida con zod al guardar
(`src/lib/schema.ts`). No hay librería de formularios: con campos anidados y
componentes propios (taxonomías, sesiones) habría hecho falta un `Controller`
en todos lados sin ganar nada.

Los condicionales del §11 van en `superRefine`, no en el tipo:

```ts
.superRefine((v, ctx) => {
  v.modalidades.forEach((m, i) => {
    if (filaPideSede(m.modalidad) && !m.sede?.nombre) {
      ctx.addIssue({
        path: ['modalidades', i, 'sede', 'nombre'],
        message: 'Una modalidad presencial necesita sede',
      });
    }
  });
})
```

Los errores se mapean por `path.join('.')` y se muestran al lado de su campo. **El
`path` lleva el índice de la fila** cuando el campo vive en una lista
(`modalidades.1.sede.nombre`, `sesiones.3.fin`): sin él, el mensaje manda a mirar
el bloque equivocado. `camposFaltantes.ts` los colapsa a `N` para nombrar el campo
y no la fila.

**La condición que usa el schema tiene que ser la misma que decide si el campo se
muestra** (`filaPideSede` / `filaPideOnline` de `src/lib/modalidades.ts`). Si se
separan, el formulario esconde un campo que el schema exige y el guardado falla
por algo que no está en pantalla.

## Estado compartido fuera del árbol: store de módulo

Cuando dos partes del panel que no se conocen necesitan compartir un dato
chico, va un módulo con una variable y suscriptores, no un contexto de React.

```ts
// src/lib/formulario-sucio.ts
let sucio = false;
const oyentes = new Set<() => void>();

export const hayCambiosSinGuardar = () => sucio;
export const marcarCambiosSinGuardar = (v: boolean) => { … };
export const observarCambiosSinGuardar = (o: () => void) => { … };
```

El aviso de versión nueva necesita saber si el formulario tiene cambios sin
guardar, y vive fuera de su árbol. Con props había que cablear `AdminApp` →
vista → formulario; con contexto, envolver el árbol entero para un booleano.
Así el formulario **toca una línea** (`useFormularioSucio(form)`) y nada en el
medio se enteró.

Aplica a estado de UI de una sola pestaña que no se persiste. Si el dato tiene
que sobrevivir a la pestaña o viajar a Firestore, no es esto.

## Lo que el build sabe y el cliente no: variables `PUBLIC_*`

La versión de la app la calcula un script de build (`scripts/version.mjs`) y
`astro.config.mjs` la deja en `process.env.PUBLIC_VERSION_APP`. Desde ahí la
leen por igual el bundle del cliente y el endpoint que genera
`/version.json`, con `import.meta.env` — el mismo mecanismo que ya usa la config
del SDK web.

Dos fuentes para el mismo dato es lo que hay que evitar: si el bundle dijera una
versión y `/version.json` otra, el panel se recargaría en loop.

## Ids generados en el cliente, nunca por índice

Cualquier array editable cuyos elementos se sincronicen con un sistema externo
necesita ids estables generados al crear el elemento:

```ts
export const nuevaSesionId = (): string => `ses_${crypto.randomUUID()}`;
```

El schema lo verifica (`/^ses_/`), así que un id armado a mano falla la
validación.

## `db` se importa de `firestore-client`, nunca de `firebase-client`

El panel corta su bundle en el login (B-09, D-51): `firebase-client.ts` tiene la
app y el auth, `firestore-client.ts` tiene `db()`. Importar `db` del primero
—o re-exportarlo desde ahí— vuelve a atar el SDK de Firestore al chunk que se
baja para mostrar el botón "Entrar con Google", y **el build sigue en verde**.

```ts
import { auth } from '@/lib/firebase-client';    // login, claim admin
import { db } from '@/lib/firestore-client';      // todo lo que lee o escribe
```

Por la misma razón, `AdminApp` carga `ListaActividades` y `ActividadFormulario`
con `import()` y no con `import` estático. `tests/bundle-panel.test.ts` falla si
alguna de las dos reglas se rompe.

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

### Verificar la clase, no la instancia

Un test que verifica una instancia protege esa instancia. `costuras.test.ts`
demuestra que `calendarEventId` se pisa; nada impedía que el mes siguiente se
pisara otro campo por el mismo camino. Cuando el bug tiene una **forma**
—"un campo que escribe el backend viaja por el formulario", "un trigger decide
desde el payload y no desde el estado"— el test se escribe sobre la forma:

```ts
// mal — protege un campo
expect(guardar().sesiones[0].calendarEventId).not.toBeNull();

// bien — protege la categoría, y el campo nuevo entra solo
for (const campo of CAMPOS_DE_MAQUINA_SESION) { … }
```

Tres propiedades que hacen que un chequeo de clase valga:

1. **La lista se deriva del código**, no se mantiene a mano: los campos salen de
   `functions/historial.js`, los triggers se descubren del fuente, las formas de
   versión se sacan de `scripts/version.mjs`. Lo nuevo entra sin que nadie se
   acuerde. Cuando la lista **no** se puede derivar (`EFECTOS_INCONDICIONALES`),
   extenderla es trabajo de los auditores — ver [`13-agentes.md`](13-agentes.md).
2. **No se puede satisfacer sin arreglar nada.** Un chequeo con una lista de
   excepciones que va a crecer da falsa cobertura y es peor que no tenerlo.
3. **El chequeo dice qué lo haría pasar**, en un comentario. Si el arreglo
   elegido es más barato que eso, el `it.fails` sigue fallando y eso también es
   información: la clase quedó abierta.

Los invariantes de una entidad del dominio se afirman sobre una **familia** de
fixtures, no sobre uno: `tests/fixtures/ciclo.ts` incluye a propósito el
fixture de una sola sesión que dejó pasar B-84, para que un invariante que solo
vale ahí no pueda pasar por verdadero.

`it.fails` es la marca de una clase todavía viva: mantiene el CI verde y **falla
el día en que alguien la arregla**, que es cuando hay que venir a promoverlo.

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

**Y esto no es una formalidad: en B-227 fue el build de verdad el que encontró el
único bug de la tanda.** `scripts/build-contra-emulador.mjs` falló con
`ahora.getTime is not a function` y **cero páginas de detalle generadas**, con los
1.600 tests en verde: Astro llama a `getStaticPaths` con un argumento propio
(`{ paginate, rss }`) y el alias `export const getStaticPaths = caminosDeDetalle`
lo dejaba caer en el primer parámetro de la función. Ningún test unitario podía
verlo, porque todos la llaman bien. Mirar el HTML que salió encontró además una
segunda cosa: el tema de un encuentro suelto no aparecía en la página, así que la
página pública decía **menos** que el evento de Calendar del mismo encuentro.

## Una plantilla no recibe el documento: recibe un view-model

Cuando una salida pública es una **página** y no un archivo de datos, la frontera
de privacidad no puede ser la disciplina de quien escribe el `.astro`: tiene que
ser un **tipo** (D-136).

```astro
---
// mal — la plantilla tiene todo en la mano y publicar de más es un `{}`
export const getStaticPaths = async () => (await leer()).map((a) => ({ props: { a } }));
---
<p>{a.online.url}</p>   <!-- compila, se ve bien, y es la trampa 5 -->
```

```astro
---
// bien — recibe lo que `detalleDeActividad` decidió, campo por campo, y nada más
export const getStaticPaths = () => caminosDeDetalle();
interface Props { detalle: DetallePublico }
---
```

Dos cosas se ganan, y la segunda es la que no se ve venir:

1. **La plantilla no puede publicar lo que no tiene.**
2. **La salida se vuelve testeable.** Un `.astro` no se puede importar desde
   vitest, así que sin el view-model no hay ningún valor sobre el cual correr el
   barrido de centinelas. Con él, la página entra al barrido como cualquier otra
   salida.

La otra mitad —que la plantilla no reciba nada más— se afirma leyendo el archivo
(`tests/pagina-de-detalle.test.ts`), y se afirma **por lista blanca**: qué importa
del lector, no una lista negra de nombres prohibidos. La diferencia la encontró el
`auditor-privacidad`: el atajo más corto no era ninguno de los cuatro nombres
prohibidos, era `const { actividades } = await contenidoDelSitio()` con el import
que la plantilla ya tenía.

## Estilo de UI

Tailwind 4 con tokens en `src/styles/global.css`. Paleta de papel y tinta
(`--color-papel`, `--color-tinta`, `--color-borde`, `--color-acento`) acorde al
dominio literario. Serif (Lora) para títulos, sans (Inter) para el resto.

Las clases de controles están centralizadas en
[`campos/Campo.tsx`](../src/components/admin/campos/Campo.tsx): `claseInput`,
`claseBotonPrimario`, `claseBotonSecundario`, `claseBotonTinta`,
`claseBotonFila`, `claseBotonMenu`. **No escribir clases de botón sueltas** — si
hace falta una variante, agregarla ahí.

`--spacing-touch` (44px) es el mínimo de un blanco táctil y se aplica con
`min-h-touch`.

## Mobile primero en los layouts

El default es la columna; las filas se habilitan desde `sm`:

```tsx
<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
```

Y todo contenedor de grilla lleva `min-w-0` para que un texto largo no desborde.
