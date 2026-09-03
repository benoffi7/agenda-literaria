# Salud del código

Diagnóstico medido, no una lista de buenas intenciones. Todo número de acá salió
de contar el árbol real. **Se remidió todo el 2026-09-03** (B-311) sobre
`4f51092`: no hay ningún número heredado sin volver a contarlo, que es la única
forma de que la comparación signifique algo.

> ✅ **Y desde esta pasada, recontar es un comando.** `node scripts/salud-del-codigo.mjs`
> imprime el §1.1, el §1.2, el §1.4, el §1.5 y el §1.6 en markdown, listos para
> pegar; con `--json`, para otro programa. La metodología de abajo **es la del
> script**, no una descripción de al lado que puede separarse: `tests/salud-del-codigo.test.ts`
> verifica que el documento y la herramienta declaren el mismo criterio.
>
> El motivo por el que hacía falta: entre el 2026-08-27 y el 2026-09-03 el §1.1
> declaraba **111** archivos de producción mientras el árbol tenía **180**. No fue
> desidia — el documento prohíbe estimar, y remedir a mano son un par de horas, así
> que en la práctica no se remedía. **Lo caro nunca fue el juicio; era contar.**
>
> **Lo que el script NO hace, a propósito:** no escribe este documento y no
> decide nada. Qué significa que una cifra se movió, qué entra en «lo que está
> bien» y qué problema abrió o cerró sigue siendo trabajo de quien remide. Y **no
> hay ningún test que compare estas cifras contra el árbol**: se moverían con cada
> commit de cualquier otro frente, y un chequeo que se pone rojo por trabajo ajeno
> es el que enseña a saltearse los chequeos (B-180). Lo que sí está atado es lo
> discreto — los ciclos, los archivos que las tablas nombran, y que el criterio no
> se separe de la herramienta.

Metodología, que es la que aplica `scripts/salud-del-codigo.mjs`:

- **Corpus:** `git ls-files` filtrado a `.ts`, `.tsx`, `.js`, `.mjs` y `.astro`.
- **Áreas:** `src/`, `functions/` y `scripts/` son producción; `tests/` va aparte
  y no suma al total.
- **LOC:** líneas del archivo, como `wc -l`.
- **Significativas:** sin líneas en blanco y sin líneas de comentario. Una línea
  con código *y* comentario al final cuenta como significativa: lo que se mide es
  cuánta línea es **solo** prosa.
- **Grafo de imports:** resuelve `@/`, los alias a `functions/` que declara
  `astro.config.mjs` —hoy `@calendario`, `@historial` y `@png-chunks-seguros`, y
  se leen de ahí en vez de listarse— y los relativos; incluye los `import()`
  diferidos. `node_modules` queda afuera, `react` incluido.
- **Fan-in:** consumidores **de producción**; `tests/` no cuenta.
- **Ciclos:** DFS sobre el grafo completo.

> ⚠️ **Las cifras de 2026-08-27 se midieron a mano y su criterio no está escrito.**
> Donde una columna «antes» difiere de la de hoy por poco, parte de la diferencia
> puede ser de criterio y no del árbol. De esta pasada en adelante el criterio es
> el del script, así que las comparaciones futuras sí son limpias. Es el mismo
> argumento que B-201 puso para el §1.3 y la razón por la que este documento
> prefiere un número viejo a uno estimado: el viejo, al menos, se sabe viejo.

**Qué NO es este documento:** no propone cambiar ninguna decisión del
[`CLAUDE.md`](../CLAUDE.md). El panel es un monolito en `/admin` por decisión
(§2.3) y Firestore es la única fuente de verdad (§2.1). Ver
[Qué no hay que tocar](#4-qué-no-hay-que-tocar).

---

## 0. Qué cambió, en dos números

| | `13b9baa` | 2026-08-27 | Hoy (2026-09-03) |
|---|---:|---:|---:|
| Concentración en los 15 archivos más grandes | 41,7 % | 40,6 % | **30,9 %** |
| El archivo más grande, sobre el total | — | 5,6 % | **3,3 %** |
| Líneas de test por línea de código testeable | 1,14 | 1,45 | **1,62** |
| Código de producción | 14.865 LOC | 20.611 LOC | **41.388 LOC** (+101 %) |
| Archivos de producción | — | 111 | **180** |
| Ciclos de import | 0 | 0 | **0** |

**El código se duplicó en siete días y la concentración cayó diez puntos.** Es la
misma conclusión que la medición anterior, en un régimen más violento: la forma no
se movió porque lo que entró entró con la forma que ya tenía el repo. La lectura
correcta de la caída **no** es que se partieron archivos grandes —`ayuda.ts` creció
de 1.153 a 1.354 LOC— sino que nacieron muchos archivos medianos, así que los
quince de arriba pesan menos sobre un denominador que se duplicó.

**Y por eso el porcentaje de concentración es, como el puesto del §1.3, una cifra
que se mueve sola.** Las tres que hay que seguir son las de la derecha de la
tabla: LOC de producción, ratio de tests y ciclos. Las dos primeras son
denominador y numerador de la salud que este documento sabe medir; la tercera es
la única que es una propiedad y no una foto — y es la única con test
(`tests/salud-del-codigo.test.ts`).

El ratio de tests subió de 1,45 a 1,62 mientras el código se duplicaba, que es el
número más difícil de sostener de los cuatro: quiere decir que los tests crecieron
más rápido que lo que verifican, dos mediciones seguidas.

Lo que **sí** empeoró está abajo y es todo del mismo tipo: el método de
verificación de los `.tsx`, que no se arregla creciendo prolijo.

---

## 1. Los números

### 1.1 Tamaño

| Área | Archivos | LOC | Significativas |
|---|---:|---:|---:|
| `src/` | 155 | 35.763 | 19.717 |
| `functions/` | 15 | 3.494 | 1.425 |
| `scripts/` | 10 | 2.131 | 1.268 |
| **Código (total)** | **180** | **41.388** | **22.410** |
| `tests/` | 125 | 45.096 | 27.315 |

`tests/` son 118 archivos de test más 6 de fixtures y el helper del emulador. La
suite corre **2.637 casos** (2.632 verdes, 5 salteados), y de los 118 archivos hay
2 que se saltean enteros sin un `dist/` construido.

Relación tests / código testeable (`.ts`/`.js`/`.mjs`, sin `.tsx` ni `.astro`:
27.890 LOC): **1,62 líneas de test por línea de código**, contra 1,45 y 1,14 en las
dos mediciones anteriores. Subió mientras el código se duplicaba.

### 1.2 Concentración

Los quince archivos más grandes son el **30,9 %** del código (antes: 40,6 % y
41,7 %). El más grande es el **3,3 %** (antes: 5,6 %).

| LOC | Archivo | Qué es |
|---:|---|---|
| 1.354 | `src/lib/ayuda.ts` | **texto** de la guía del panel |
| 1.307 | `src/lib/detallePublico.ts` | el view-model de la página de detalle (D-140) |
| 1.070 | `src/pages/actividad/[slug].astro` | la plantilla del detalle |
| 989 | `scripts/build-contra-emulador.mjs` | el gate de build (B-217) |
| 963 | `src/lib/contenidoDelSitio.ts` | qué documentos lee el build |
| 903 | `src/lib/novedades.ts` | **texto** del historial de cambios |
| 820 | `src/lib/analytics-eventos.ts` | vocabulario de eventos + sanitizado |
| 743 | `src/components/publico/Buscador.tsx` | la island de filtros |
| 742 | `src/lib/calendarioPanel.ts` | grilla del mes, puro |
| 740 | `src/components/admin/CalendarioActividades.tsx` | vista calendario |
| 723 | `src/lib/hubsPublicos.ts` | los hubs de indexación (B-108) |
| 701 | `src/lib/listadoPublico.ts` | el listado, puro |
| 593 | `src/components/admin/EstadisticasPanel.tsx` | el tablero del catálogo |
| 580 | `functions/calendario.js` | el evento y el diff, puro |
| 549 | `src/components/admin/AdminApp.tsx` | router del panel |

**Nueve de los quince nacieron con el sitio público o crecieron con él**, y ese es
todo el contenido de la caída del 40,6 % al 30,9 %: no se partió nada, se agregó
mucho. La cima sigue siendo copy (`ayuda.ts`, que creció otro 17 %), y el segundo
puesto lo tomó `detallePublico.ts`, que es la pieza que D-140 puso a propósito
entre Firestore y la plantilla — o sea que los dos archivos más grandes son, uno
texto de usuario y el otro una frontera de privacidad. Ninguno de los dos es la
clase de archivo grande que preocupa.

**El que sí mirar es `functions/index.js`**, que sigue creciendo (516 → 542 LOC) y
es el punto de concentración del Problema 3.

### 1.3 El formulario, cuatro mediciones después

Es el que más conviene seguir, porque es el que ya se hipertrofió una vez.

> ✅ **Esta sección se remidió el 2026-09-02 (B-201) y es la única del documento
> con números de hoy.** El resto sigue siendo del 2026-08-27, con el aviso del
> encabezado. Se remidió sola porque era el único número que el backlog pedía
> recontar, y porque el criterio del conteo cabe en tres líneas — que es la
> condición que B-201 ponía para no inventarlo:
>
> - **LOC:** líneas del archivo (`wc -l`), igual que el resto del documento. La
>   columna «significativas» del §1.1 es otra medida y no se usa acá.
> - **Fan-out:** módulos distintos que el archivo importa, contando solo los del
>   proyecto —`@/`, `@calendario`, `@historial` y los relativos— y no los paquetes
>   de `node_modules`. `react` queda afuera, como en el grafo del §1.4. No hay
>   ningún `import()` diferido en este archivo.
> - **Puesto:** su lugar en la lista de archivos de producción ordenada por LOC,
>   sobre el mismo corpus del §1.1 (`git ls-files` filtrado a `.ts`, `.tsx`,
>   `.js`, `.mjs` y `.astro`, sin `tests/`) — hoy **156** archivos.

| | Antes del saneamiento | `13b9baa` | 2026-08-27 | 2026-09-02 | Hoy (2026-09-03) |
|---|---:|---:|---:|---:|---:|
| `ActividadFormulario.tsx` | 858 LOC | 258 | 379 | 376 | **413** |
| Su fan-out | 12 | 19 | 25 | 26 | **24** |
| Su puesto en la lista | 1º | 15º | 14º | 28º | **28º** |

> **La columna de hoy la midió `scripts/salud-del-codigo.mjs`** (B-311), con el
> criterio de arriba ya escrito adentro. Las anteriores se contaron a mano, así
> que parte de la diferencia de fan-out (26 → 24) puede ser de criterio y no del
> archivo. **Lo que no es de criterio es el LOC:** +37 líneas en un día, contra
> −3 en los seis anteriores. El umbral escrito sigue siendo 550 con fan-out 30 y
> sigue lejos, pero es la primera medición en la que el archivo vuelve a subir
> con ganas — vale mirarlo en la próxima pasada antes que después.
>
> El puesto no se movió, y eso es coherente con lo que la propia sección dice de
> él: no significa nada por sí solo. Catorce archivos nuevos le pasaron por
> arriba en agosto y esta vez pasaron otros tantos, así que el archivo creció un
> 10 % y quedó en el mismo lugar.

**El número que se venía mirando dejó de subir, y el que se movió no dice lo que
parece.** El razonamiento de las mediciones anteriores sigue siendo correcto
—fan-out alto con LOC bajo es un composer, y la señal de alarma sería fan-out
alto **con LOC alto**—, y en seis días el archivo perdió 3 líneas y ganó un
import: 376 LOC con fan-out 26 sigue siendo un composer. El umbral escrito
entonces no se movió: 550 con fan-out 30 ya no lo sería.

**El salto de 14º a 28º no es que el formulario se encogiera, es que el sitio
público nació.** Catorce archivos le pasaron por arriba sin que él cambiara, y
se reparten en tres grupos:

- **Seis nacieron con el sitio**, todos el 2026-08-28 o después:
  `detallePublico.ts` (1.124), `actividad/[slug].astro` (945),
  `listadoPublico.ts` (701), `contenidoDelSitio.ts` (686), `Buscador.tsx` (514)
  y `ayudaDelSitio.ts` (413).
- **Uno nació el mismo día de la medición y no llegó a contarse:**
  `build-contra-emulador.mjs` (949), el gate de build. El §1.1 le da a
  `scripts/` **5 archivos y 515 LOC en total**, así que este archivo —que hoy
  solo él son 949— entró después de ese conteo.
- **Siete ya estaban y crecieron:** `toPublic.ts` (514, y era el ejemplo del §2
  de una proyección sin consumidor), `TaxonomiasPanel.tsx`, `actividades.ts`,
  `schema.ts`, `ListaActividades.tsx`, `imagenes-archivo.ts` y `opciones.ts`.

Es el recordatorio de por qué el puesto es la peor de las tres cifras para
seguir un archivo —depende enteramente de lo que hagan los demás, así que baja
sin que nadie toque el archivo y sube sin que nadie lo arregle— y por qué se
mira junto a las otras dos. Las que hay que seguir son LOC y fan-out.

### 1.4 Acoplamiento

Fan-in, contando solo consumidores de producción:

| Consumidores | Módulo | Fan-out |
|---:|---|---:|
| 44 | `src/types/actividad.ts` | **0** |
| 23 | `src/components/admin/campos/Campo.tsx` | **0** |
| 19 | `src/lib/identidad.ts` | 1 |
| 18 | `src/lib/sesiones.ts` | 1 |
| 16 | `src/lib/rutasPublicas.ts` | **0** |
| 15 | `functions/calendario.js` | **0** |
| 15 | `src/components/sitio/estilos.ts` | **0** |
| 13 | `src/components/admin/campos/Seccion.tsx` | 2 |
| 13 | `src/layouts/Base.astro` | 5 |
| 13 | `src/lib/imagenes.ts` | 1 |

**Los cuellos de botella siguen siendo hojas, y el sitio público nació con la
misma forma.** Es el hallazgo de esta medición en el eje de acoplamiento: los
cuatro módulos que entraron a la lista son los cuatro del sitio —`identidad.ts`,
`rutasPublicas.ts`, `estilos.ts` y `imagenes.ts`— y tres de ellos tienen fan-out
**0**. Nadie los diseñó mirando esta tabla; salieron así porque el patrón ya
estaba en el repo.

`src/layouts/Base.astro` es el único con fan-in alto y fan-out no trivial (13 in
/ 5 out), y es lo que un layout es: el lugar donde se juntan la hoja de fuentes,
la identidad, la analítica y el chrome. **Sigue sin haber ningún god object.**

`src/lib/actividades.ts`, que en la medición anterior era el único que se
acercaba, salió de los diez: no encogió, lo pasaron. Es la capa de acceso a
Firestore y su trabajo es depender de cosas.

### 1.5 Ciclos

**Cero**, en 180 archivos de producción. DFS sobre el grafo completo, `import()`
diferidos incluidos.

**Es el único número de este documento con test.** `tests/salud-del-codigo.test.ts`
corre el mismo DFS y falla si aparece un ciclo — y es el único que se puede atar
sin romper la regla de B-180, porque un ciclo no aparece por trabajo ajeno: lo
introduce el import que alguien acaba de escribir, y el rojo nombra la cadena
entera. Las cifras de tamaño y prosa, en cambio, se mueven con cada commit de
cualquiera, y ahí un chequeo sería el gate que falla por su propia plomería.

Se volvió a medir después de B-224, con tres módulos nuevos
(`lib/modalidades.ts`, `ModalidadesEditor.tsx`, `campos/FilasEditor.tsx`), y
sigue en **cero**. Hubo un ciclo a punto de nacer y está anotado en el fuente:
`modalidadVacia` necesita `sedeVacia`/`onlineVacio`, así que **vive en
`formulario/estadoInicial.ts` y no en `lib/modalidades.ts`** —que es el módulo del
que `estadoInicial` importa—. `cascadas.ts` la reexporta para que quien busca las
cascadas la encuentre donde espera.

### 1.6 Prosa

| Área | Comentarios / LOC | 2026-08-27 |
|---|---:|---:|
| `functions/` | **51,5 %** | 44,8 % |
| `src/lib/` sin `ayuda.ts` ni `novedades.ts` | **50,8 %** | 43,6 % |
| `src/lib/` | **46,3 %** | 37,1 % |
| `src/` | **39,0 %** | — |
| `scripts/` | **32,9 %** | 31,5 % |
| `tests/` | **30,4 %** | 20,2 % |
| `src/components/` | **25,9 %** | 19,3 % |

El número de `src/lib/` **sube** al sacar los dos archivos de copy, porque esos
son texto de usuario y casi no llevan comentarios: hoy **la mitad** de la lógica
de `src/lib/` es prosa explicativa, contra 43,6 % y 38,0 % en las dos mediciones
anteriores.

**Subieron las seis áreas, y la que más subió es `tests/` (20,2 % → 30,4 %).** Esa
es la que dice qué está pasando: los tests que este repo escribió en la última
semana son los de clase —los que explican qué bug los hizo nacer, qué mutación se
probó y qué los haría pasar— y ese docblock es la mitad del valor del chequeo. No
es prosa que sobre; es la que hace que un `it.fails` signifique algo dentro de
seis meses.

**Y este número no dice cuánta de esa prosa envejeció.** Para eso hay que leerla,
y el 2026-09-03 se leyó: los 11 archivos de mayor proporción de `src/lib/` más
otros nueve, buscando tres cosas —prosa que afirma algo que el código ya no hace,
prosa duplicada, y relato de tickets que dejó de explicar la forma actual.

**El resultado es el que sostiene la política, no el que la cuestiona:**

| Lo que se buscó | Lo que se encontró |
|---|---|
| Referencias muertas (archivos, funciones, tests que la prosa nombra y no existen) | **cero**, en un barrido mecánico sobre todo `src/lib/` |
| Relato de tickets que ya no explica la forma actual | **cero** que pase el filtro. Los cuatro candidatos evaluados trabajan — el de `identidad.ts` (D-141 → D-146 → D-150, el color que se fue y volvió) es el caso de libro: sin él, «la paleta es limitada» parece seguir vigente y alguien vuelve a sacar el color |
| Un bloque de comentario pegado dos veces, textual | **uno**, en `tarjetaPublica.ts`, del último commit |
| Premisas temporales congeladas | **cinco** — la clase más cara, y la única que vale arreglar |
| Contadores desincronizados entre archivos vecinos | **tres** |

**La clase que importa es la segunda, y no es «prosa de más».** Son comentarios
que sostienen una decisión **vigente** sobre un hecho que dejó de ser cierto:
«no hay testing-library y no se va a instalar» (la instaló B-08, el mismo ticket
que el comentario cita), «el `events.json` todavía no está escrito» (existe, y
consume esa misma función), «el sitio público está congelado y el dominio no está
elegido» (está publicado en `agendaleh.ar`), «el sitemap no lleva `lastmod`» (lo
lleva desde B-112, y lo dice el encabezado del mismo archivo). El daño no es el
volumen: es que **el lector descuenta una decisión buena por una premisa falsa**.

La lista completa, con `archivo:línea` y la corrección propuesta, está en el
reporte del frente. Ninguna se aplicó acá porque `src/**` tenía cuatro frentes
escribiendo.

**Conclusión de B-78, y no cambia:** el 46 % es deliberado y no hay que bajarlo.
Ver la fila de `ayuda.ts` y `novedades.ts` en «Qué no hay que tocar», que además
**contradice la propuesta del propio ítem** de mudar el contenido a una carpeta
aparte.

---

## 2. Los problemas reales

De los cinco del diagnóstico anterior, **tres cerraron**:

| | Problema | Cómo cerró |
|---|---|---|
| 2 | `npx tsc --noEmit` en rojo en cualquier checkout limpio | B-173 — `scripts/verificar-todo.sh` corre `astro sync` antes del `tsc`. Verificado: sale limpio |
| 3 | De las trampas del §13, la 7 sin ningún test | B-172 — cerrada, **en el segundo intento**: el primero daba verde por el motivo equivocado y lo cazó el `auditor-trampas`. Ver abajo |
| 5 | Dos vocabularios para «modalidad» | sigue abierto (B-175), pero su entrada de backlog tenía pegado por error el cierre de B-79 y **se leía como cerrada**. Corregido |

Y apareció uno que no era de forma sino de contenido, que es el que importa de
esta medición:

### Problema 0 · Lo que ninguna métrica de este documento podía ver

**`firestore.rules` entregaba el documento crudo de toda actividad publicada a
cualquiera** (B-208, D-128). Reproducido contra el emulador: volvían el link de la
reunión, la `difusion`, la URL del material privado, los uids, el
`calendarEventId` y el `storagePath` — la lista completa del §5.1, salteando
`toPublic`. Y era explotable en producción: el repo es público y
`.env.production` está versionado con el `projectId` y la API key.

Aparte, **`docs/02-infraestructura.md` publicaba los uids y los mails de las dos
cuentas admin** en un repo público, y los mismos dos valores estaban como
centinelas en `tests/fixtures/formulario.ts` — el dato que no puede salir, en el
archivo que verifica que no sale (B-209).

**Por qué está en este documento y no solo en el backlog:** los dos pasaron por
debajo de todo lo que este archivo mide. Cero ciclos, fan-in en hojas,
concentración estable, 1,45 de ratio de tests, y una fuga abierta. Ninguna
métrica de forma la iba a encontrar, y **el test que la fijaba estaba en verde** —
`it('un anónimo lee lo publicado')`, correcto respecto de su especificación,
certificando una fuga porque lo que estaba mal era la especificación.

La conclusión operativa no es "hay que medir más cosas": es que **la salud de
forma y la corrección son ejes independientes**, y este documento solo habla del
primero. Los auditores existen para el segundo, y esta vez encontraron lo que
1.390 tests no (la suite de entonces; hoy son 2.637 y el argumento no cambia —
son los mismos ejes).

### Problema 1 · 48 componentes y 9.962 LOC de `.tsx` con cuatro tests de render

**Seguía siendo el hueco de método, y creció otra vez: eran 34 archivos y 5.355
LOC, después 39 y 7.045, y hoy 48 y 9.962.**

> ⚠️ **La premisa de este problema cambió a medias — ver B-08 en
> [`BACKLOG.md`](BACKLOG.md), «camino propuesto, decisión del dueño».**
> `@testing-library/react`, `@testing-library/dom`, `@testing-library/user-event`
> y `jsdom` **sí están** en las dependencias desde entonces, y
> `vitest.config.ts` monta jsdom para un patrón (`*.render.test.tsx`,
> `environmentMatchGlobs`) — ya no es cierto que «no hay forma de que existan».
> Lo que **no** cambió es el alcance: el relevamiento de B-08 mostró que de los
> candidatos reales, la mayoría es una pregunta pura que no necesita DOM (y ya
> está cubierta) o algo que jsdom no puede medir (el scroll, sin layout real).
> El primer caso genuino fue `MenuAcciones` (cierre por clic afuera, por
> `Escape`, foco devuelto), con `tests/menu-acciones.render.test.tsx`.
>
> **Remedido el 2026-09-03 (B-311), y la excepción angosta creció sola a
> cuatro:** además de `menu-acciones`, hoy hay `historial-actividad`,
> `reportes-panel` y `estadisticas-pestanias`. Son 21 casos de render sobre 2.637
> de la suite. Que hayan nacido tres más sin que nadie ampliara la política es la
> señal de que el criterio de B-08 estaba bien puesto: se usan donde el cableado
> de DOM es la pregunta, y no se derramaron al resto. El denominador, en cambio,
> creció de 39 a 48 componentes y de 7.045 a 9.962 LOC — o sea que **el hueco se
> agrandó más rápido de lo que se cubre**, que es exactamente lo que este problema
> viene diciendo desde tres mediciones.

Antes de B-08, estaba confirmado que no había forma de que existieran render
tests: no había `@testing-library/*`, ni `jsdom`, ni `happy-dom` en las
dependencias, y `vitest.config.ts` fijaba `environment: 'node'` sin excepción.
Ese razonamiento —el texto que sigue— se escribió con esa restricción vigente.

Lo que hay en su lugar, medido: **73 de los 118 archivos de test usan
`readFileSync`** para verificar leyendo el fuente con expresiones regulares (eran
32 de 59). Más de la mitad de la suite, y la proporción no se movió: 54 % antes,
62 % hoy.

No todos esos 73 son el problema —leer el fuente es el enfoque **correcto** para
verificar el grafo de imports del bundle, que un workflow parsee, o que un mapa de
documentación diga la verdad—, pero sí lo es cada vez que la pregunta era "¿este
componente hace lo que corresponde?". Ese enfoque ya falló de tres maneras
distintas en dos días, todas de la misma familia —un chequeo que lee el fuente y
cree haber encontrado lo que buscaba—:

1. el extractor de mapas no saltaba la anotación de tipo, así que un mapa anotado
   salía **vacío** y el error decía "el panel no sabe decir «previo»" sobre un
   mapa que lo dice;
2. cruzaba saltos de línea, así que una **mención** del nombre en un comentario
   enganchaba con el `= {` del mapa siguiente y se leía el mapa equivocado;
3. B-79 movió los mapas de archivo y el chequeo se quedó midiendo un archivo que
   ya no los tiene — verde para su `it`, y su `it.fails` vecino fallando **por el
   motivo equivocado**, que es el punto ciego de B-171.

Ninguna de las tres habría existido con un test que monta el componente. **Es
B-08**, y el motivo por el que estaba postergado —escribir tests contra el `.tsx`
de 858 líneas era escribirlos dos veces— dejó de aplicar hace cuarenta commits.

**El costo de seguir postergándolo tiene dos casos concretos del mismo día**, y
son las dos caras del mismo método:

1. **Lo que no vio.** B-210: la trampa de foco estaba copiada verbatim en dos
   diálogos y una copia tenía un arreglo que la otra no. Un test de componente que
   abra la capa y tabule lo encuentra en tres líneas; leyendo el fuente con regex,
   no lo vio nadie por semanas.
2. **Lo que frenó de más.** Arreglar B-210 —mover el cableado a un hook, que es
   una mejora sin cambio de comportamiento— **puso cuatro `it` en rojo**, porque
   buscaban `e.key==='Escape'` y `alCancelar=useRef(onCancelar)` *dentro de un
   `.tsx` puntual*. Es la cuarta vez que un chequeo así mide un archivo que ya no
   tiene lo que busca.

El segundo es el que conviene mirar, porque es el más caro y el menos visible: un
test que se rompe cuando el código mejora **cobra un impuesto a cada refactor**, y
ese impuesto se paga en refactors que no se hacen. Los cuatro se reescribieron
como propiedad («ninguna capa tiene cableado propio») en vez de repuntarlos al
archivo nuevo, que habría sido el mismo chequeo frágil con otra ruta.

### Problema 2 · La automatización que se escribe y no se adopta — ✅ cerrado (B-211)

Cerró el mismo día que se midió, y la forma en que estaba mal es lo que vale
guardar.

`const ts = (iso) => ...` —el doble de `Timestamp`, o sea el corazón de la trampa
1 del §13— estaba definido **13 veces en 4 formas distintas**, y dos de esas
formas **mentían**: `seconds: 0` para cualquier fecha. Estaba duplicado incluso
**entre los dos fixtures**, con una forma distinta cada uno.

**Lo que hacía que fuera un problema y no una molestia:** era exactamente la
clase que hizo nacer `tests/fixtures/ciclo.ts` y `invariantes-de-ciclo.test.ts`
—«un fixture que no ejercita el caso central del dominio», que había aparecido
cuatro veces— y que el skill `automatizar` lleva adentro como calibración. La
clase volvió con otra cara: no era que el fixture no ejercitara el caso, era que
había trece fixtures y no se parecían entre sí.

**O sea: la automatización se había escrito y no se había adoptado.** Es un modo
de falla distinto del que se atajó, y **no tenía red** — cosa que se ve mejor
ahora que está cerrado: unificar sin dejar guarda habría dejado el mismo hueco,
porque escribir el catorceavo `ts()` cuesta cinco segundos, menos que buscar
dónde vive el bueno.

La red es la clase de B-211 en `clases-de-bug.test.ts`, y busca la **forma**
(`toDate` y `toMillis` juntos) en vez del nombre: así también caza al que se
llame `stamp` o `t`. La adopción de `tests/fixtures/` pasó de **7 archivos sobre
59** a **16 sobre 60**.

Lo que **sigue abierto** de este frente es la otra mitad, y es B-215: siete
archivos definen su propio builder de actividad con cuatro firmas distintas
mientras `actividadCentinela` existe y lo usa uno solo. La misma historia, sin el
agravante de que alguna copia mienta.

### Problema 3 · `functions/index.js`, 516 LOC, el último punto de concentración

Sin cambios desde la medición anterior, y el diagnóstico también: es el archivo
de código más grande que no es copy, B-77 ya le sacó todo lo que se podía volver
puro, y lo que queda es I/O, que vive legítimamente en el archivo del trigger. La
pregunta de si los tres triggers deberían ser tres archivos sigue teniendo la
misma respuesta honesta: hoy no duele, y el `package.json` propio de `functions/`
hace que partirlo más agregue paths sin resolver nada. Se anota, no se hace.

### Problema 4 · Dependencias sin camino de parche en la mayor instalada

`npm audit --omit=dev`: 2 altas en producción, ocho avisos de Astro (5.18.2) más
`sharp`. **Ninguno explotable hoy** —verificado feature por feature: no se usa
`define:vars`, `transition:*`, `server:defer`, spread props, slots con nombre ni
`set:html`, y `output: 'static'`—, pero **no hay parche en la 5.x**: todas las
versiones corregidas son ≥6. Es B-214, y lo que importa es el momento: la
recomendación era subir **antes** de B-01, «cuando el blast radius son tres
páginas», y **ese momento pasó** — el sitio público está publicado y son ocho
páginas más los cuatro endpoints. El ítem no cambia de prioridad por eso (sigue
sin nada explotable), pero la ventana barata se cerró. Lo que sí hay ahora y no
había entonces es la red para subir de mayor con confianza:
`scripts/build-contra-emulador.mjs` afirma sobre el HTML construido de verdad.

---

## 3. Lo que está bien

Un diagnóstico que solo encuentra problemas no se puede calibrar.

1. **Cero ciclos de import** en 180 archivos, después de duplicar el código. Y
   desde B-311 es el único número de acá que **no puede volver a envejecer**:
   `tests/salud-del-codigo.test.ts` corre el mismo DFS en cada corrida.

2. **Los cuellos de botella siguen siendo hojas**, y el sitio público nació con
   esa forma sin que nadie lo pidiera: los cuatro módulos que entraron al top-10
   de fan-in son suyos y tres tienen fan-out **0**.

3. **La forma resistió un crecimiento del 101 %.** Es el hallazgo principal de
   esta medición y es fácil de pasar por alto porque no es un número que sube: la
   concentración cayó del 40,6 % al 30,9 % y los ciclos siguen en cero mientras
   el denominador se duplicaba en siete días, con cinco frentes escribiendo en
   paralelo. **Eso último es lo que hace que valga la pena decirlo:** la forma
   aguantó no un crecimiento ordenado sino uno concurrente, que es el régimen en
   el que se rompe.

4. **La duplicación más peligrosa sigue prevenida por construcción.**
   `functions/calendario.js` se comparte por el alias `@calendario` (D-20) en vez
   de copiarse, y el alias apunta a **un archivo** y no a `functions/*`
   justamente para no invitar a arrastrar `firebase-admin` al bundle.

5. **El corte del bundle sigue en pie**, y su test mejoró: `bundle-panel.test.ts`
   ahora recorre el **grafo de imports** desde la entrada de la island en vez de
   una lista de nombres, con un control positivo (siguiendo los `import()`, el SDK
   sí aparece). Sin ese control, el verde no probaría nada.

6. **Los chequeos que se autoverifican funcionaron, y se los vio funcionar.** Al
   cerrar la trampa 7 en esta misma corrida, `mapa-de-trampas.test.ts` se puso
   **rojo solo** para avisar que `docs/15-mapa-de-trampas.md` seguía declarándola
   sin red. Un documento que rompe el CI cuando deja de ser cierto es la única
   clase de documento que no envejece.

7. **El proceso aprende de sus accidentes, y quedó escrito.**
   `tests/sin-marcadores-de-conflicto.test.ts` nació de marcadores commiteados que
   sobrevivieron dos commits. `tests/invariantes-de-ciclo.test.ts` nació de la
   misma clase apareciendo cuatro veces. `tests/sin-datos-personales.test.ts`
   nació de B-209. El skill `automatizar` lleva los casos adentro como
   calibración.

8. **El barrido de salidas públicas le sacó trabajo a un auditor**, que es la
   forma correcta de que crezca la red: `barrido-de-salidas-publicas.test.ts`
   (B-196) cubrió lo que la ficha del `auditor-privacidad` describía como "tu
   hueco", y esa celda pasó a decir "no lo reportes".

9. **Cero `TODO`/`FIXME`/`HACK`/`XXX`** en todo el código. Lo que está pendiente
   está en el backlog con prioridad, no marcado en un margen.

---

## 4. Qué no hay que tocar

Estas cosas parecen problemas si se las mira solo con métricas.

| Cosa | Por qué se deja | Referencia |
|---|---|---|
| **El panel como monolito en `/admin`** | Decisión cerrada: un repo, un Hosting target, un deploy. El bundle pesado ya está aislado (D-51). | `CLAUDE.md` §2.3 |
| **Firestore como única fuente de verdad** | Decisión cerrada. Nada de sync bidireccional. | `CLAUDE.md` §2.1 |
| **`ayuda.ts` y `novedades.ts` como los archivos más grandes** | Son **texto de usuario**, no lógica. Un archivo de copy grande no es deuda; partirlo agregaría paths para que la copy viva en cinco lugares. **Esto contradice la propuesta de B-78** de mudarlos a una carpeta de contenido aparte, y la contradicción se resolvió el 2026-09-03 a favor de esta fila: el propio ítem dice que es cosmético y que «no cambia comportamiento ni destraba nada», y a cambio movería dos archivos que la doc, los tests y dos reglas de proceso de `05-patrones.md` nombran por su ruta. **Y no bajaría el número que el ítem cita:** son copy y casi no llevan comentarios, así que sacarlos de `src/lib/` *sube* la proporción de prosa (§1.6 lo mide en las dos direcciones). Lo que sí valía de B-78 —leer la prosa y ver cuánta envejeció— se hizo, y está en el §1.6. | §1.2, §1.6, B-78 |
| **`CAMPOS_VALIDABLES` como constante a mano** | Derivarla en runtime metía zod (68 kB) en el chunk inicial. La garantía vive en un test que la deriva del schema. | D-60, D-98 |
| **La copia de `CAMPOS_TAXONOMIA` en `functions/index.js`** | `functions/` se despliega con su propio `package.json` y no puede importar hacia arriba. Si molesta, la respuesta es un test que compare las dos listas, no un import imposible. | D-20 |
| **`ETIQUETA_ENTREGA` duplicado entre panel y evento** | El panel capitaliza («Al inscribirse»), el evento va en minúscula a mitad de frase. Unificarlos haría que un cambio de copy del panel cambie lo que se publica. Lo que **sí** se unificó es `ETIQUETA_TIPO_MATERIAL`, que son sustantivos. | §5.1, B-134 |
| **`TaxonomiaSelect`, `TagsInput` y `ChipsInput` como tres componentes** | Tres widgets distintos. Se comparte la lógica pura, no el markup — y reusar el de taxonomía para «arrobar» habría metido handles de Instagram en `/opciones/tags`. **El barrido de duplicación de esta medición los marca: son un falso positivo conocido.** | D-116, B-215 |
| **~~`toPublic.ts` con fan-in de producción 0~~ — ya no aplica** | Era cierto hasta `1.4.0`: la medición lo marcaba y la respuesta era «es la pieza del sitio público, que todavía no existe». **B-106 lo estrenó**: hoy lo importan `src/lib/eventsJson.ts` y `src/pages/events.json.ts` en producción. Se deja la fila tachada y no borrada porque el falso positivo va a volver con cada proyección nueva que nazca antes que su consumidor — le pasó a `eventsJson.ts` en el mismo commit (B-218). | B-01, B-106, B-218 |
| **La tabla de privacidad del posteo, que vive en el docblock de `textoRedes.ts` y no en `07-seguridad.md`** | Es la autoritativa y se apunta a ella. Dos copias de una tabla de privacidad es el problema que D-20 evita en otro lado, y la copia que envejece siempre es la del documento. | §5.1 |
| **`src/lib/` plano** | Cero ciclos y los módulos más importados son hojas. La excepción es `src/lib/formulario/`, que existe porque los módulos que salieron del `.tsx` son un grupo con sentido. | §1.4 |
| **Algolia / Typesense, microservicios, librería de formularios, state manager** | Evaluados y descartados. Son dos personas cargando actividades literarias. | §2.5, D-01 |

---

## 5. Resumen en una línea

**La forma aguantó que el código se duplicara, y el problema que quedó no es de
forma.** La medición del 2026-08-27 encontró una fuga de privacidad abierta en
producción (B-208) que ninguna métrica de este documento podía ver y que un test
en verde estaba certificando — la lección es que la salud de forma y la corrección
son ejes independientes, y este archivo solo mide el primero.

**Y la remedición del 2026-09-03 (B-311) agregó una segunda lección, sobre el
documento y no sobre el código:** el eje que este archivo mide no se estaba
midiendo. Entre las dos pasadas el §1.1 declaró 111 archivos mientras el árbol
tenía 180, y no fue por descuido: el documento prohíbe estimar y contar a mano
son un par de horas. **Un diagnóstico que solo se puede producir a mano es un
diagnóstico que se produce una vez.** Por eso ahora hay
`scripts/salud-del-codigo.mjs`, y por eso lo único que se ató con un test es lo
discreto — atar las cifras habría puesto el gate en rojo por trabajo ajeno, que es
el modo de falla de B-180.

Del eje de forma, lo que queda es **el método, no la estructura**: 48 componentes
y 9.962 LOC de `.tsx` con cuatro archivos de render test encima (B-08). El
denominador creció más rápido que la cobertura, dos mediciones seguidas. Y hay
dos pruebas de lo que eso cuesta — **no vio** un bug que estaba a la vista (B-210)
y **frenó** el refactor que lo arregló, poniendo cuatro `it` en rojo por mejorar
el código.

Los tres P1 que esta medición abrió se cerraron el mismo día: B-210 (el cableado
de capa modal, ahora compartido), B-211 (los trece `ts()`, ahora uno con guarda) y
B-212 (la proyección de `/opciones/*`, escrita antes de su consumidor). Queda
chico y nombrado. Al 2026-09-02 se cerraron tres de esos seis: el saneador campo
por campo (**B-137** — hoy va en un punto de paso único sobre la salida armada,
D-197), los `.env` sin gate (**B-213** — `tests/env-versionados.test.ts`) y la
mitad de la duplicación menor (**B-215** — `MESES` unificado en
`src/lib/meses.ts`; siguen abiertos el `useEffect` de carga y la adopción de
`tests/fixtures/`). Quedan Astro sin parche en la 5.x (B-214), dos vocabularios
para «modalidad» (B-175) y la prosa que pertenece al CHANGELOG (B-78).

Nada de eso bloquea el sitio público. B-208 sí lo habría hecho, y ese es el
argumento para correr los auditores antes de construirlo y no después.
