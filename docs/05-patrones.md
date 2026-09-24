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
| auditar un cambio — antes de pushear, o cuando quieras | `/audit` |
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

## Regla de proceso: el árbol principal es compartido y no tiene aislamiento

**Escrita el 2026-09-17, después de que costara una hora de trabajo frenado.** Ese
día hubo hasta ocho sesiones sobre este repo —una en el árbol principal y seis
frentes en worktrees— y las **cuatro** cosas que salieron mal son la misma:
**nada separa tu trabajo del de al lado en `/`.** La cuarta se agregó más tarde ese
mismo día, y es la que menos se ve.

### 1 · Stageá por nombre. Nunca `git add -A`, `git add .` ni `commit -a`

El commit `601442b`, cuyo mensaje dice `feat(B-983): publicar una ficha de la
Guía…`, tiene **21 archivos y 712 inserciones**. Se llevó `scripts/tablero/`
entero y `tests/tablero.test.ts` —113 líneas de un archivo nuevo— que eran de
**B-984**, un ítem que no tiene nada que ver. No se perdió nada y la suite estaba
verde; lo que se perdió es que el historial diga la verdad. Arriba de ese commit
ya había merges, así que no se arregla sin reescribir historia: quedó una nota en
`f8d2459`.

El procedimiento es `git status --short`, mirar la lista, y `git add` archivo por
archivo.

### 2 · Leé [`EN-CURSO.md`](../EN-CURSO.md) antes de tocar el árbol principal

Y es la mitad que hace falta para que la primera sirva. Ese día `EN-CURSO.md`
estaba **commiteado**, decía quién era dueño de qué archivo y qué rangos de ids
estaban reservados, y no se leyó. Stagear por nombre sin saber cuáles son tuyos te
deja igual: la lista de `git status` no dice de quién es cada línea.

Si vas a trabajar sobre `/`, ese archivo se lee primero y se actualiza al empezar.

### 3 · El gate de `pre-push` verifica el **working tree**, no el commit

`./scripts/verificar-todo.sh` corre sobre lo que hay en el disco. Con dos sesiones
en el mismo árbol, **el trabajo a medio hacer de una frena el push de la otra
aunque sus commits no se toquen**: ese día dos commits de puro `.md` estuvieron
una hora sin poder salir por errores de typecheck de código ajeno, dos veces
seguidas y de dos sesiones distintas.

No es un bug del gate —verificar el árbol es lo que atrapa el archivo sin
`git add`, que es la mitad de B-964— sino la consecuencia de compartir el árbol.
**La salida barata: si ya hay alguien escribiendo en `/`, el segundo trabaja en un
worktree** (`.claude/worktrees/<frente>`, con su rama y su `projectId` de emulador
derivado de la ruta, B-219).

### 4 · Crear una rama en `/` se la impone a todas las sesiones de ese directorio

`git checkout -b` **no es una acción local**: mueve el `HEAD` del working tree, y el
working tree es uno solo. Ese mismo día una sesión creó `frente/emulador-decision`
en `/` para escribir una decisión, y a partir de ahí **el árbol principal entero
quedó parado en esa rama**: los commits que la otra sesión siguió haciendo —sobre un
ítem distinto— cayeron en la rama ajena, sin que ninguna de las dos lo viera.

Es la misma falta de aislamiento de las tres de arriba, con **la cara más difícil de
notar: es la única que no deja rastro en `git status`**. Las otras tres se ven —un
stage de más, un archivo ajeno, un typecheck rojo de código que no es tuyo—; ésta no
se ve desde ningún lado, porque las dos vistas se leen igual: cada sesión ve una
rama y ninguna tiene forma de saber que no la eligió. Se supo porque una se lo dijo
a la otra, no porque algo lo mostrara.

**No hizo daño, y la suerte tuvo dos mitades:** que el contenido de las dos fuera
complementario, y que la rama entrara en **fast-forward**. Con un solo commit
divergente de cualquiera de las dos, la integración habría sido un merge con
conflictos entre dos trabajos que nunca se declararon ajenos — y ahí el «no hizo
daño» se termina.

**La salida es la que ya está en la regla 3:** si hace falta una rama, va en un
worktree. Y si por lo que sea hay que crearla en `/`, se avisa antes y se vuelve a
`main` al integrar, que es lo único que devuelve el directorio a las demás.

### Por qué esto vive acá y no en `.estado/BRIEF-COMUN.md`

Porque **`.estado/` está en el `.gitignore`**. Todo lo que se escribió ahí ese día
—incluido el brief con estas mismas reglas— vive en una sola máquina y no está
versionado. Perder justamente la memoria de por qué no se usa `git add -A` sería
el mejor ejemplo de lo que ella advierte.

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

**Y si la decisión vive en un lugar imposible de probar** —un `onClick`, un
script de shell, el cableado de un componente—, se saca: la regla va a un módulo
puro y el lugar original queda con **una sola puerta** que la llama. Es
[D-109](06-decisiones.md#d-109--toda-salida-del-formulario-pasa-por-una-sola-puerta):
`salida-del-panel.ts` decide cuándo preguntar antes de salir del formulario y
`AdminApp` tiene un único `salirDe(accion)`, así que una salida nueva no puede
olvidarse del aviso. Del lado de los scripts es
[D-196](06-decisiones.md#d-196--la-decisión-de-plomería-del-gate-sale-del-gate):
`que-deployar.sh` y `emuladores-arriba.sh` salieron del YAML y del gate porque
una decisión que no se puede probar se prueba al pushear. La mitad que chequea que esa forma no se rompa —recorrer el
grafo de imports real en vez de comparar una lista de nombres— es
[D-106](06-decisiones.md#d-106--un-chequeo-estructural-pregunta-por-el-grafo-no-por-un-archivo).
Las dos se citaron durante un tiempo como «D-100», que es otra cosa (la mitad
cliente del §4.2); ver B-1123.

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

## Un control compartido **recibe**, no importa

Un componente que van a usar dos aplicaciones distintas —el panel y el sitio
público— no puede importar lo que solo una de las dos tiene. No es una regla de
capas: lo que se importa **viaja**, y con él viaja lo que ese módulo importe.

```tsx
// mal — el control se trae la medición, y con ella su cadena entera
import { medirFuncion } from '@/lib/analytics';
import { useOpciones } from '@/components/admin/useOpciones';

// bien — las recibe, y quien no las tenga no pasa nada
interface Props { onMedir?: (f: Funcion, d?: string) => void; valores: ValorOpcion[] }
```

**El costo de equivocarse no es de organización.** `campos/TagsInput` importaba
esas dos líneas, y la cadena real era
`@/lib/analytics → firebase-client → appcheck → firebase/app-check` más
`useOpciones → lib/opciones → firestore-client → firebase/firestore`. O sea que un
formulario público a un `import` de distancia **medía sin consentimiento** —la
analítica del panel no tiene ese portón, nunca lo necesitó— y bajaba dos terceros
de Google antes del banner, además del SDK pesado que el corte de B-09 mantiene
afuera. Ninguna de las redes que existían lo veía: una mira el chunk del panel y
la otra busca `<script src>` absolutos en el HTML. **B-841**.

La forma que quedó: el control genérico en `components/campos/`, y una capa fina
—`components/admin/campos-del-panel.tsx`— que le ata lo del panel y **conserva la
API que los usos tenían**, así el corte no obliga a tocar quince archivos. Lo
sostiene `tests/panel-fuera-del-sitio.test.ts` desde los dos lados: ninguna página
salvo `/admin` alcanza la plomería, y ningún archivo de `campos/` la importa.

Y un detalle que se escapa: **el predicado puro también hay que traerlo de donde
es puro.** `estaAprobada` se importaba de `lib/opciones`, que arrastra Firestore,
cuando ya vivía en `lib/taxonomia` y `opciones` solo lo reexporta. Sin eso el
corte queda a medias.

## Un dato que envejece se proyecta con su fecha, y en un solo string

El valor y «cuándo se cargó» son un par, y un par que se proyecta en dos campos
se separa: la primera pantalla lo pinta bien y la cuarta —o la tarjeta angosta,
donde no entra la fecha— pinta el valor solo. Así que la proyección pública de un
`DatoConFecha<T>` es **la frase ya armada**, un único string:

```ts
// bien — no hay forma de mostrar uno sin el otro
fraseConFecha(sus.precio, (n) => `$${n.toLocaleString('es-AR')} por mes`);
// → '$18.000 por mes · cargado el 24 de septiembre de 2026'

// mal — dos campos, y la regla pasa a depender de que cada consumidor se acuerde
{ precio: sus.precio.valor, precioCargadoEn: sus.precio.cargadoEn }
```

Y de arriba se cae la otra mitad gratis: no hay número, así que **no hay nada que
filtrar, ordenar ni meter en un `Offer`** —comparar dos precios afirma que son
comparables, y no lo son si uno tiene una semana y otro cuatro meses—. Es la
misma forma que `Campo` con su `htmlFor` requerido (B-827) o los ids de cliente:
la garantía la da el tipo, no la disciplina.

**El valor sin fecha usable no se muestra**, no al revés: `fraseConFecha`
devuelve vacío. Y el dato huérfano no se esconde, `pideRevision` lo manda al
panel. `src/lib/datoConFecha.ts`, B-837, [D-570](06-decisiones.md).

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

**Qué no:** casi ningún componente de React tiene tests de render — la
verificación de la UI sigue siendo manual y contra producción. **Desde B-08 hay
una excepción angosta y a propósito**: `@testing-library/react`,
`@testing-library/dom`, `@testing-library/user-event` y `jsdom` están
instalados, pero **solo** para el cableado real de DOM que un test que lee el
fuente no puede verificar sin arriesgarse a un falso verde (B-202 fue
exactamente eso) — el primero fue `tests/menu-acciones.render.test.tsx` y al
2026-09-18 son **26** (`ls tests/*.render.test.tsx`, remedido con B-889: decía
«veintidós» al 2026-09-14 y ya eran 26 — es el **quinto** remedido de este
número, y la cuarta vez que se queda viejo solo, lo cual a esta altura dice que el
número no tiene que estar escrito acá: el comando de al lado es el dato, igual que
en `10-salud-del-codigo.md` § B-662). Que hayan nacido veinticinco más sin que nadie ampliara la política es
la señal de que el criterio está bien puesto: se usan donde el cableado de DOM **es**
la pregunta, y no se derramaron al resto. Viven en
`*.render.test.tsx` y `vitest.config.ts` monta jsdom nada más que para ese
patrón (`environmentMatchGlobs`); el resto de la suite sigue en `node`. No es
la puerta abierta a testear cualquier componente: el análisis de B-08 mostró
que la mayoría de lo que parece pedir render en realidad es una pregunta pura
(se testea sin DOM) o algo que jsdom no puede medir (el scroll no existe sin
layout real).

### Un rechazo esperado no es cualquier rechazo

Un test de reglas afirma *esta operación tiene que ser rechazada*, y la forma
barata de verificarlo —`rejects.toThrow()`— la satisface también un emulador que
se cayó. Por eso los helpers de este repo miran el `code`: `permission-denied` es
«la regla denegó» y `unavailable` es «no se pudo preguntar».

**Falta una segunda pregunta, y es la que B-1130 agregó:** `permission-denied`
también es lo que llega cuando la regla **explotó antes de contestar**. Un error
de evaluación deniega igual, así que un caso negativo puede estar midiendo que la
regla se caiga en vez de la cláusula que nombra.

La distinción está en la traza del `message`, y es más fina de lo que parece: un
`evaluation error` **no** alcanza para condenar. El emulador evalúa dos veces un
documento que lleva un sentinel (`serverTimestamp()`, `increment()`), y la
primera pasada lo ve sin resolver; también evalúa el `allow update` de un
`setDoc` sobre un documento que todavía no existe. Las dos cosas fallan sin que
haya nada roto. Lo que separa el ruido del problema es si **alguna** evaluación
de esa puerta terminó en `false`.

Nada de eso se escribe a mano en cada caso: va en
`tests/fixtures/rechazos-del-emulador.ts`, con `denegada()` para el caso normal y
`denegadaOReglaQueTira()` para la excepción —una regla que a propósito se apoya
en el error de evaluación, como la geo de los directorios, que no lleva
`is number`—. La excepción es una **función con otro nombre** y no una opción del
helper, justamente para que se lea en el diff.

**La lección de método, que es lo que vale para el próximo caso: medir antes de
arreglar, y medir con mutación.** El primer helper de B-1130 puso 197 casos en
rojo y la conclusión obvia era que estaban todos mal. Mutar la regla —sacarle la
cláusula que el caso decía probar— mostró lo contrario: el documento pasaba a
escribirse, o sea que el caso sí la protegía. Sin esa medición se habrían
«arreglado» 195 tests que estaban bien, y el arreglo habría tapado los seis que
no.

Esa lección quedó escrita como decisión: **D-750** en
[`06-decisiones.md`](06-decisiones.md), con sus otros dos casos.

**Y el `rejects.toThrow()` pelado ya no depende de que alguien se acuerde**
(B-1132). `tests/rechazos-sin-copia.test.ts` tiene dos guardas: una contra
escribir otra vez el helper, y otra contra afirmar un rechazo de Firestore con
`toThrow()` sin argumento —que es **más débil** que la regex que B-1130
eliminó, porque ni siquiera exige `permission-denied`—.

Lo que distingue un caso de reglas de los usos legítimos de esa forma es **qué
operación se espera**, y sale de los `import … from 'firebase/firestore'` del
propio archivo: el test del emulador de Storage no importa ninguna, y el que
espera `upsertOpcion()` está esperando código del panel. Con eso el barrido no
necesita **ninguna** excepción escrita a mano, que era la condición — una lista
de excepciones es una guarda que parece canónica sin serlo (B-1113).

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
- Después de aplicar el CORS del bucket (o de cambiar de dominio), pedir una
  imagen de `events.json` con `Origin` y confirmar que vuelve
  `Access-Control-Allow-Origin`: `npm run cors:verificar` (B-1321). El emulador
  no aplica CORS, así que ningún test lo puede ver.

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
ser un **tipo** (D-140).

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

Tailwind 4 con tokens en `src/styles/global.css`.

**El sitio público sigue el sistema visual de
[`docs/referencias/sistema-visual.md`](referencias/sistema-visual.md)** —
«brutalismo editorial», aprobado por el dueño y bajado en
[D-146](06-decisiones.md). Tres reglas que valen para todo lo que se escriba, y
que tienen test (`tests/sistema-visual.test.ts`):

| Regla | Qué significa al escribir |
|---|---|
| **Radio 0** | ningún `rounded-*`. Botones, campos y contenedores van con esquina viva |
| **Estrictamente plano** | ningún `shadow-*`, ningún `blur`, ningún degradado. Lo que separa una superficie de otra es una **regla** o una **capa tonal** |
| **Tintas con nombre, no opacidades** | nada de `text-tinta/70`. Hay una tinta para cada trabajo y cada una tiene su contraste medido |

Las tintas son `papel` / `crema` / `hondo` (superficies), `tinta` y `suave`
(texto), y las tres del sistema: `acento` (terracota, la principal), `azul` (lo
funcional y las categorías) y `super` (la superposición: cuerpo denso, reglas, y
**el hover de toda tinta plena**). `borde` y `regla` son **para reglas, nunca para
texto** — dan 4,26:1 y 1,62:1, y el piso es 4,5.

Tres familias: **Fraunces** (`font-display`, el marcador de mes y el título del
detalle), **Archivo Narrow** (`font-titulo`, títulos, versalitas **y la marca**) y
**Public Sans** (`font-sans`, el cuerpo). Las dos correcciones sobre la referencia
aprobada —Fraunces en vez de Bodoni Moda (B-262) y la marca en la tipografía del
título (pedido del dueño, 2026-09-07)— están anotadas en
`docs/referencias/sistema-visual.md`, arriba de la tabla. La escala está en `global.css` como utilidades —`display-lg`,
`headline-md`, `label-caps`, `body-md`…— y **se usan esas, no tamaños sueltos**.

> **`font-serif` no existe más.** El token se borró, pero Tailwind trae el suyo
> (`ui-serif, Georgia`): un `font-serif` que sobreviva **no falla y pinta
> Georgia**. Está prohibido por test.

El espaciado se apoya en la **grilla de base de 4px**. La escala de Tailwind ya es
de 4px por unidad, así que `p-4` y `gap-2` caen solos; lo que no entra son los
valores arbitrarios (`p-[13px]`).

Las clases compartidas del **sitio público** están en
[`components/sitio/estilos.ts`](../src/components/sitio/estilos.ts): `foco`,
`claseEnlace`, `claseBotonPrimario`, `claseBloque`, `claseRotulo`,
`claseBloqueFecha`… **No escribir clases de botón ni el anillo de foco sueltos.**

Las del **panel** están en
[`campos/Campo.tsx`](../src/components/campos/Campo.tsx) —el archivo salió de
`components/admin/` en B-827, pero las clases siguen siendo las del panel—:
`claseInput`, `claseBotonPrimario`, `claseBotonSecundario`, `claseBotonTinta`,
`claseBotonFila`, `claseBotonMenu`. El panel es una herramienta interna y **no
sigue el sistema visual del sitio**: tiene su propio criterio y su propio
centralizador. Sus títulos usan `font-serif`, que es **su** token —Georgia, una
face del sistema— y no el de ninguna de las tres familias del sitio.

**El piso del panel: `text-tinta/65`** (B-1630). A diferencia del sitio, el panel
**sí** atenúa con opacidades, pero no por debajo de WCAG AA (4,5:1). Se mide
contra su superficie clara más oscura —el blanco de las tarjetas, el papel del
fondo y los tokens que use como fondo pleno; hoy es `crema`—, y ahí `/60` da 4,35
y `/65` da 5,10. Ojo con medir solo contra el blanco: `/60` pasa sobre la tarjeta
(4,51) y no sobre el papel de al lado (4,43). Lo verifica
`tests/contraste-del-panel.test.ts`, que barre `components/admin/` y
`components/campos/` con `lib/contraste.ts`, igual que
`contraste-de-superficies.test.ts` barre el sitio. Si algo tiene que quedar más
bajo a propósito, va en la lista `EXCEPCIONES` del test **con su porqué**; el
texto de un control deshabilitado (`disabled:`) está exento por WCAG 1.4.3. El test
mide también sobre los **tintes** del panel (`bg-acento/5`, `bg-amber-100`,
`bg-black/5`…), compuestos sobre la base más oscura, con los colores de Tailwind
leídos de la paleta instalada; hoy el peor es `bg-acento/15`. Y **una fila que ya no
rige no se apaga con `opacity`** —se multiplica con la tinta de adentro—: va con
`claseFilaApagada` de `campos/Campo.tsx`, y el test frena un `opacity-NN` suelto
(D-1105). Desde B-1830 mide también la tinta con nombre sobre el tinte de un ancestro: el
barrido recorre el árbol JSX de cada archivo, y `contraste-del-arbol.render.test.tsx`
monta los avisos de color y compone sobre el DOM (D-1125). Lo que no ve: el tinte
que pone otro componente fuera de los avisos (B-1870).

> Los dos comparten **una sola hoja de fuentes** (`Base.astro`), así que bajar una
> familia solo para el panel se lo cobra a las cinco páginas públicas. Es el motivo
> por el que el serif del panel es una face del sistema y no una webfont.

`--spacing-touch` (44px) es el mínimo de un blanco táctil y se aplica con
`min-h-touch`.

### Dos trampas de Tailwind que este repo ya pagó

Las dos las encontró **mirar el HTML y el CSS construidos**, no un test, y las dos
dejan el build en verde:

1. **Dos utilidades del mismo tipo en un elemento no las resuelve el orden del
   atributo**, sino el orden en que Tailwind las emitió en la hoja. Una clase
   compartida con `bg-acento` adentro más un `bg-super` del llamador es una
   apuesta. La clase compartida trae **la forma**; la tinta la pone quien la usa,
   una sola.
2. **Una utilidad propia (`@utility`) no puede llamarse como una que Tailwind
   genera desde un token del tema.** `--spacing-riel` hace que exista un `ps-riel`
   generado; declarar otro `ps-riel` propio produce dos declaraciones y gana la
   que se emita última.

## Mobile primero en los layouts

El default es la columna; las filas se habilitan desde `sm`:

```tsx
<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
```

Y todo contenedor de grilla lleva `min-w-0` para que un texto largo no desborde.
