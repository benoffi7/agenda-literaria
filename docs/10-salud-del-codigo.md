# Salud del código

Diagnóstico medido, no una lista de buenas intenciones. Todo número de acá salió
de contar el árbol real en el commit de la auditoría del **2026-08-27**, cuarenta
commits después de la medición anterior (`13b9baa`). **Se remidió todo**: no hay
ningún número heredado sin volver a contarlo, que es la única forma de que la
comparación signifique algo.

> ⚠️ **Los números de este documento son del 2026-08-27 y ya quedaron viejos.** Entre
> esa fecha y el 2026-08-31 entraron B-245/B-246 (identidad y paleta), B-249 y B-253
> (la forma del detalle, el chrome y las tres páginas de texto): tres archivos de test
> nuevos, un módulo nuevo (`src/components/sitio/estilos.ts`) y reescrituras grandes en
> cinco `.astro`. **No se tocó ningún número acá a propósito** — el documento vale
> porque cada cifra salió de contar, y estimarlas para que «queden actualizadas» es
> exactamente lo que lo haría inútil. Hay que remedir con la misma metodología, en una
> pasada propia.
>
> **La única excepción es el §1.3, remedido el 2026-09-02 (B-201)**, con el criterio
> del conteo escrito al lado. Se remidió solo porque era el único número que el
> backlog pedía recontar; el resto del documento sigue esperando esa pasada. Para
> calibrar cuánto quedó viejo el resto: el §1.1 dice **111** archivos de producción
> y hoy son **156**.

Metodología: `git ls-files` filtrado a `.ts`, `.tsx`, `.js`, `.mjs` y `.astro`.
"Significativas" excluye líneas en blanco y comentarios. El grafo de imports
resuelve `@/`, `@calendario`, `@historial` y los relativos, e incluye los
`import()` diferidos.

**Qué NO es este documento:** no propone cambiar ninguna decisión del
[`CLAUDE.md`](../CLAUDE.md). El panel es un monolito en `/admin` por decisión
(§2.3) y Firestore es la única fuente de verdad (§2.1). Ver
[Qué no hay que tocar](#4-qué-no-hay-que-tocar).

---

## 0. Qué cambió, en dos números

| | `13b9baa` | Hoy |
|---|---:|---:|
| Concentración en los 15 archivos más grandes | 41,7 % | **40,6 %** |
| Líneas de test por línea de código testeable | 1,14 | **1,45** |
| Código de producción | 14.865 LOC | **20.611 LOC** (+39 %) |
| Ciclos de import | 0 | **0** |

**El resultado no es que los números mejoraron: es que aguantaron.** El código
creció un 39 % en cuarenta y dos commits y la concentración BAJÓ un punto.
Cuando una métrica de forma se queda quieta mientras el denominador crece un
tercio, no es que nadie tocó nada — es que lo que se agregó entró con la forma que
ya tenía el repo. Eso es lo que el saneamiento estaba comprando.

Lo que **sí** empeoró está abajo y es todo del mismo tipo: el método de
verificación de los `.tsx`, que no se arregla creciendo prolijo.

---

## 1. Los números

### 1.1 Tamaño

| Área | Archivos | LOC | Significativas |
|---|---:|---:|---:|
| `src/` | 96 | 17.961 | 11.444 |
| `functions/` | 8 | 2.049 | 948 |
| `scripts/` | 5 | 515 | 296 |
| **Código (total)** | **111** | **20.611** | **12.735** |
| `tests/` | 66 | 19.751 | 13.413 |

`tests/` son 61 archivos de test más 5 de fixtures. La suite corre **1.390 tests**,
57 de ellos contra los emuladores.

Relación tests / código testeable (`.ts`/`.js`/`.mjs`, 13.579 LOC): **1,45 líneas
de test por línea de código**, contra 1,14 en la medición anterior. Se mantuvo
mientras el código crecía un 39 %, o sea que los tests crecieron más rápido que lo que
verifican.

### 1.2 Concentración

Los quince archivos más grandes son el **40,6 %** del código (antes: 41,7 %). El
más grande es el **5,6 %** (antes: 5,3 %).

| LOC | Archivo | Qué es |
|---:|---|---|
| 1.153 | `src/lib/ayuda.ts` | **texto** de la guía del panel |
| 730 | `src/components/admin/CalendarioActividades.tsx` | vista calendario |
| 725 | `src/lib/calendarioPanel.ts` | grilla del mes, puro |
| 692 | `src/lib/analytics-eventos.ts` | vocabulario de eventos + sanitizado |
| 671 | `src/lib/novedades.ts` | **texto** del historial de cambios |
| 516 | `functions/index.js` | los tres triggers y su I/O |
| 492 | `src/lib/textoRedes.ts` | el posteo para redes, puro |
| 481 | `src/components/admin/AdminApp.tsx` | router del panel |
| 464 | `src/components/admin/SesionesEditor.tsx` | filas de encuentros |
| 448 | `functions/calendario.js` | el evento y el diff, puro |
| 431 | `src/lib/formulario/autoguardado.ts` | el borrador del navegador |
| 429 | `src/lib/duplicar.ts` | duplicar una actividad |
| 380 | `src/types/actividad.ts` | el modelo |
| 379 | `src/components/admin/ActividadFormulario.tsx` | el composer del formulario |
| 367 | `src/components/admin/ListaActividades.tsx` | el listado |

Los dos primeros de la lista anterior siguen siendo **texto**, y sumaron el 46 %
de su tamaño (`ayuda.ts` pasó de 789 a 1.153). Que la cima siga siendo copy en
lugar de reglas de negocio es lo que hace que "el archivo más grande" no sea una
señal de alarma acá.

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

| | Antes del saneamiento | `13b9baa` | 2026-08-27 | Hoy (2026-09-02) |
|---|---:|---:|---:|---:|
| `ActividadFormulario.tsx` | 858 LOC | 258 | 379 | **376** |
| Su fan-out | 12 | 19 | 25 | **26** |
| Su puesto en la lista | 1º | 15º | 14º | **28º** |

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
| 43 | `src/types/actividad.ts` | **0** |
| 28 | `src/components/admin/campos/Campo.tsx` | **0** |
| 13 | `src/components/admin/campos/Seccion.tsx` | 2 |
| 12 | `src/lib/sesiones.ts` | 1 |
| 9 | `functions/calendario.js` | **0** |
| 9 | `src/lib/vistaPreviaEvento.ts` | 4 |
| 8 | `src/components/admin/formulario/PropsSeccion.ts` | 1 |
| 8 | `src/lib/actividades.ts` | 7 |
| 8 | `src/lib/slugify.ts` | **0** |

**Los cuellos de botella siguen siendo hojas**, y el patrón se mantuvo mientras
el fan-in del modelo subía de 36 a 43 consumidores: los dos módulos más
importados tienen fan-out **0**. Concentrar dependencias en tipos y funciones
puras que no dependen de nada es la forma correcta de concentrarlas. **No hay
ningún módulo con fan-in alto y fan-out alto** — no hay god object.

El único que se acerca es `src/lib/actividades.ts` (8 in / 7 out), y es
razonable: es la capa de acceso a Firestore, así que su trabajo es depender de
cosas.

### 1.5 Ciclos

**Cero**, en 111 archivos de producción. Se midió con DFS sobre el grafo completo,
`import()` diferidos incluidos.

Se volvió a medir después de B-224, con tres módulos nuevos
(`lib/modalidades.ts`, `ModalidadesEditor.tsx`, `campos/FilasEditor.tsx`), y
sigue en **cero**. Hubo un ciclo a punto de nacer y está anotado en el fuente:
`modalidadVacia` necesita `sedeVacia`/`onlineVacio`, así que **vive en
`formulario/estadoInicial.ts` y no en `lib/modalidades.ts`** —que es el módulo del
que `estadoInicial` importa—. `cascadas.ts` la reexporta para que quien busca las
cascadas la encuentre donde espera.

### 1.6 Prosa

| Área | Comentarios / LOC |
|---|---:|
| `functions/` | 44,8 % |
| `src/lib/` sin `ayuda.ts` ni `novedades.ts` | **43,6 %** |
| `src/lib/` | 37,1 % |
| `scripts/` | 31,5 % |
| `tests/` | 20,2 % |
| `src/components/` | 19,3 % |

El número de `src/lib/` **sube** al sacar los dos archivos de copy, porque esos
son texto de usuario y casi no llevan comentarios: el 43,6 % de la lógica de
`src/lib/` es prosa explicativa, contra 38,0 % en la medición anterior. Es mucho y
es deliberado —cada decisión no obvia lleva su por qué al lado—, pero la
observación de B-78 se agrandó junto con el número: parte de esa prosa es historia
que pertenece al `CHANGELOG` y no al archivo.

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
1.390 tests no.

### Problema 1 · 39 componentes y 7.045 LOC de `.tsx` sin un solo test de componente

Sigue siendo **el** hueco de método, y creció: eran 34 archivos y 5.355 LOC.

Confirmado que no hay forma de que existan: no hay `@testing-library/*`, ni
`jsdom`, ni `happy-dom` en las dependencias, y `vitest.config.ts` fija
`environment: 'node'`.

Lo que hay en su lugar, medido: **32 de los 59 archivos de test usan
`readFileSync`** para verificar leyendo el fuente con expresiones regulares. Más
de la mitad de la suite.

No todos esos 32 son el problema —leer el fuente es el enfoque **correcto** para
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

1. **Cero ciclos de import** en 111 archivos, después de cuarenta commits que
   agregaron un 36 % de código.

2. **Los cuellos de botella siguen siendo hojas**, y aguantaron el crecimiento:
   los dos módulos más importados (43 y 28 consumidores) tienen fan-out **0**.

3. **La forma resistió el crecimiento.** Es el hallazgo principal de esta
   medición y es fácil de pasar por alto porque no es un número que sube: la
   concentración se movió del 41,7 % al 40,6 % mientras el denominador crecía un
   tercio.

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
| **`ayuda.ts` y `novedades.ts` como los archivos más grandes** | Son **texto de usuario**, no lógica. Un archivo de copy grande no es deuda; partirlo agregaría paths para que la copy viva en cinco lugares. | §1.2 |
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

**La forma aguantó un 36 % de crecimiento sin moverse, y el problema que quedó no
es de forma.** Esta medición encontró una fuga de privacidad abierta en
producción (B-208) que ninguna métrica de este documento podía ver y que un test
en verde estaba certificando — la lección es que la salud de forma y la corrección
son ejes independientes, y este archivo solo mide el primero.

Del eje de forma, lo que queda es **el método, no la estructura**: 39 componentes
y 6.962 LOC de `.tsx` se verifican leyendo el fuente con expresiones regulares
(B-08). El mismo día dio las dos pruebas de lo que eso cuesta — **no vio** un bug
que estaba a la vista (B-210) y **frenó** el refactor que lo arregló, poniendo
cuatro `it` en rojo por mejorar el código.

Los tres P1 que esta medición abrió se cerraron el mismo día: B-210 (el cableado
de capa modal, ahora compartido), B-211 (los trece `ts()`, ahora uno con guarda) y
B-212 (la proyección de `/opciones/*`, escrita antes de su consumidor). Queda
chico y nombrado: la duplicación menor (B-215), Astro sin parche en la 5.x
(B-214), dos vocabularios para «modalidad» (B-175), el saneador campo por campo
(B-137), los `.env` sin gate (B-213) y la prosa que pertenece al CHANGELOG (B-78).

Nada de eso bloquea el sitio público. B-208 sí lo habría hecho, y ese es el
argumento para correr los auditores antes de construirlo y no después.
