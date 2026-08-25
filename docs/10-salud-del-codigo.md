# Salud del código

Diagnóstico medido, no una lista de buenas intenciones. Todo número de acá salió
de contar el árbol real en el commit `13b9baa`, después de integrar las cuatro
fases del [plan de saneamiento](14-plan-de-saneamiento.md). **Se remidió todo**:
no hay ningún número heredado de la medición anterior sin volver a contarlo, que
es la única forma de que la comparación signifique algo.

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

| | Antes (`f1009be`) | Ahora (`13b9baa`) |
|---|---:|---:|
| Concentración en los 15 archivos más grandes | 52,7 % | **41,7 %** |
| Líneas de test por línea de código testeable | 0,81 | **1,14** |
| `ActividadFormulario.tsx` | 858 LOC, **el más grande** | 258 LOC, **el 15º** |
| Ciclos de import | 0 | 0 |

Y el cambio que no es un número: **el archivo más grande del repo dejó de ser
lógica.** Hoy es `src/lib/ayuda.ts` (789 LOC), que es el texto de la guía del
panel. El segundo es `analytics-eventos.ts` (641) y el sexto es `novedades.ts`
(453) — también texto. Que la cima de la lista sea copy en lugar de reglas de
negocio cambia lo que "el archivo más grande" significa como señal.

---

## 1. Los números

### 1.1 Tamaño

| Área | Archivos | LOC | Significativas |
|---|---:|---:|---:|
| `src/` | 81 | 12.403 | 8.583 |
| `functions/` | 8 | 2.000 | 938 |
| `scripts/` | 5 | 462 | 270 |
| **Código (total)** | **94** | **14.865** | **9.791** |
| `tests/` | 45 | 10.898 | 7.795 |

Relación tests / código testeable (`.ts`/`.js`/`.mjs`, 9.526 LOC): **1,14 líneas
de test por línea de código**. Cruzó el 1 a 1 durante el saneamiento, y no por
escribir tests de relleno: el salto vino de sacar lógica de los `.tsx` a módulos
puros, que es lo que la vuelve testeable sin montar React.

### 1.2 Concentración

Los quince archivos más grandes son el **41,7 %** del código (antes: 52,7 %).

| LOC | Archivo | Qué es |
|---:|---|---|
| 789 | `src/lib/ayuda.ts` | **texto** de la guía del panel |
| 641 | `src/lib/analytics-eventos.ts` | vocabulario de eventos + sanitizado |
| 516 | `functions/index.js` | los tres triggers y su I/O |
| 513 | `src/components/admin/CalendarioActividades.tsx` | vista calendario |
| 502 | `src/lib/calendarioPanel.ts` | grilla del mes, puro |
| 453 | `src/lib/novedades.ts` | **texto** del historial de cambios |
| 435 | `src/components/admin/AdminApp.tsx` | router del panel |
| 399 | `functions/calendario.js` | el evento y el diff, puro |
| 298 | `src/components/admin/taxonomias/TaxonomiasPanel.tsx` | administrar opciones |
| 298 | `src/lib/opciones.ts` | transacciones del §4.2 |
| 289 | `src/lib/filtrosActividades.ts` | orden y filtros, puro |
| 273 | `src/components/admin/ayuda/CentroAyuda.tsx` | capa de ayuda |
| 269 | `src/components/admin/ReporteFormulario.tsx` | reportar un bug |
| 262 | `src/components/admin/SesionesEditor.tsx` | filas de encuentros |
| 258 | `src/components/admin/ActividadFormulario.tsx` | **el ex-monolito** |

El archivo más grande es el 5,3 % del código. Antes era el 8,9 %.

### 1.3 El formulario, antes y después

Es el resultado que más se mide solo:

| | Antes | Ahora |
|---|---:|---:|
| `ActividadFormulario.tsx` | 858 LOC | 258 LOC |
| Módulos de dominio puros que salieron de él | 0 | 6 (`estadoInicial`, `cascadas`, `condicionales`, `etiquetas`, `guardar`, `chips`) |
| Componentes de sección | 0 | 10 |
| Su fan-out | 12 | 19 |

**El fan-out subió y eso es lo correcto.** 19 imports en 258 líneas es un
composer: el archivo dejó de *ser* el formulario y pasó a *armarlo*. La señal de
alarma sería fan-out alto con LOC alto, y es lo contrario de lo que pasó.

### 1.4 Acoplamiento

Fan-in, sobre 96 archivos de producción:

| Consumidores | Módulo | Fan-out |
|---:|---|---:|
| 36 | `src/types/actividad.ts` | **0** |
| 24 | `src/components/admin/campos/Campo.tsx` | **0** |
| 12 | `src/components/admin/campos/Seccion.tsx` | 1 |
| 9 | `src/lib/sesiones.ts` | 1 |
| 8 | `functions/calendario.js` | **0** |
| 8 | `src/components/admin/formulario/PropsSeccion.ts` | 1 |
| 8 | `src/lib/slugify.ts` | **0** |

**Los cuellos de botella siguen siendo hojas.** Los tres módulos más importados
tienen fan-out 0 o 1: son tipos, constantes y funciones puras que no dependen de
nada. Concentrar dependencias ahí es la forma correcta de concentrarlas. **No hay
ningún módulo con fan-in alto y fan-out alto** — no hay god object.

### 1.5 Ciclos

**Cero**, en 96 archivos. Se midió con DFS sobre el grafo completo, `import()`
diferidos incluidos. Cuatro frentes en paralelo sobre los mismos archivos y el
grafo no se enredó.

### 1.6 Prosa

| Área | Comentarios / LOC |
|---|---:|
| `functions/` | 44,0 % |
| `src/lib/` | 32,3 % |
| `src/lib/` sin `ayuda.ts` ni `novedades.ts` | **38,0 %** |
| `tests/` | 17,3 % |
| `src/components/` | 15,7 % |

El número de `src/lib/` **sube** al sacar los dos archivos de copy, porque esos
son texto de usuario y casi no llevan comentarios. O sea: el 38 % de la lógica de
`src/lib/` es prosa explicativa. Es mucho, y es deliberado —cada decisión no
obvia lleva su por qué al lado, que es lo que permitió retomar cuatro frentes
después de una pausa—, pero el punto de B-78 sigue en pie: parte de esa prosa es
historia que pertenece al `CHANGELOG` y no al archivo.

---

## 2. Los problemas reales

Los cuatro del diagnóstico anterior están **cerrados**:

| | Problema | Cómo cerró |
|---|---|---|
| 1 | `ActividadFormulario.tsx` mezclaba cinco responsabilidades, 227 LOC de reglas sin test | B-70/B-79 — 858 → 258 LOC, seis módulos puros con tests |
| 2 | La deduplicación del §4.2 estaba implementada dos veces y ya divergía | B-72 — `src/lib/taxonomia.ts`, con guardia de que la copia no vuelva a nacer |
| 3 | El vocabulario de etiquetas y enums copiado en cuatro lugares, tres sin guardia | B-75, B-76, B-132, B-134 — se importan, y hay un chequeo de clase |
| 4 | `functions/index.js` era el único sin el corte puro/trigger | B-77 — `historial`, `reportes`, `rebuild`, `sincronizacion` partidos en puro + trigger |

Lo que queda, en orden de lo que cuesta:

### Problema 1 · 34 componentes y 5.355 LOC de `.tsx` sin un solo test de componente

Es **el** hueco, y creció en importancia justamente porque los otros se
cerraron. La lógica de dominio salió de los `.tsx` (eso era el problema 1
anterior), así que lo que queda ahí es cableado: qué se muestra cuándo, qué
handler va en qué botón, qué se le pasa a qué hijo. Y eso hoy se verifica **leyendo
el fuente con expresiones regulares**.

Ese enfoque ya falló de tres maneras distintas en dos días, todas de la misma
familia —un chequeo que lee el fuente y cree haber encontrado lo que buscaba—:

1. el extractor de mapas no saltaba la anotación de tipo, así que un mapa anotado
   salía **vacío** y el error decía "el panel no sabe decir «previo»" sobre un
   mapa que lo dice;
2. cruzaba saltos de línea, así que una **mención** del nombre en un comentario
   enganchaba con el `= {` del mapa siguiente y se leía el mapa equivocado;
3. B-79 movió los mapas de archivo y el chequeo se quedó midiendo un archivo que
   ya no los tiene — verde para su `it`, y su `it.fails` vecino fallando **por el
   motivo equivocado**, que es el punto ciego de B-171.

Ninguna de las tres habría existido con un test que monta el componente. **Es
B-08**, y el plan lo dejó para después de la fase 2 a propósito: escribir tests
contra el `.tsx` de 858 líneas era escribirlos dos veces. Ese motivo ya no aplica.

### Problema 2 · `npx tsc --noEmit` sale en rojo en cualquier checkout limpio

Doce errores de `ImportMeta` porque falta `.astro/types.d.ts`, que no está
versionado. **En `main` sale limpio** —el directorio está generado de hace
rato— y ahí está el filo: los doce aparecen exactamente donde el comando decide
algo, que es un worktree recién creado, un clone fresco y el CI.

Es **B-173**, y es P3 por su daño directo (ninguno) y no por su daño real: el
comando de verificación que corren todos los frentes está en rojo permanente, así
que un error nuevo de verdad se esconde entre los doce. Se arregla con un `astro
sync` antes del `tsc`.

### Problema 3 · De las diez trampas del §13, la 7 no tiene ningún test

`docs/15-mapa-de-trampas.md` mapea cada trampa a su test y **calcula del repo**
las que quedaron descubiertas. La 4 (`firebase-admin` al cliente, la de peor
consecuencia) se cubrió durante la fase 4. Queda la **7**: una query pública sin
`where('estado','==','publicado')` hace que Firestore rechace la query entera.

El test de reglas cubre lecturas **por documento**; la trampa es sobre la forma
de la **query**, que es otra cosa. Es **B-172**, y su ventana de daño se abre
recién con el sitio público (B-01) — pero se abre ahí de golpe.

### Problema 4 · `functions/index.js`, 516 LOC, el último punto de concentración

Es el archivo de código más grande que no es copy. Tiene los tres triggers
(`syncCalendar`, `rebuildPorOpciones`, `dispararRebuild`) más su I/O: el cliente
de Calendar, `crearEvento`, el dispatch a GitHub con su timeout.

**No es el mismo problema que era.** B-77 le sacó todo lo que se podía volver
puro; lo que queda es I/O, y el I/O vive legítimamente en el archivo del trigger.
La pregunta abierta es si los tres triggers deberían ser tres archivos, y la
respuesta honesta es que hoy no duele: el `package.json` propio de `functions/`
hace que partirlo más agregue paths sin resolver nada. Se anota, no se hace.

### Problema 5 · Dos vocabularios para «modalidad»

El formulario dice «Híbrido» y el listado «Presencial y virtual» para el mismo
valor guardado. `ETIQUETA_ESTADO` se unificó —era idéntico palabra por palabra—
pero este no: elegir cuál gana es una decisión de copy, no un refactor. Es
**B-175**, y su `it.fails` está en rojo-esperado hasta que se decida.

---

## 3. Lo que está bien

Un diagnóstico que solo encuentra problemas no se puede calibrar.

1. **Cero ciclos de import** en 96 archivos, después de cuatro frentes en
   paralelo sobre los mismos directorios. Es lo primero que se suele romper.

2. **Los cuellos de botella son hojas.** Los tres módulos más importados (36, 24
   y 12 consumidores) tienen fan-out 0 o 1. No hay god object.

3. **El corte puro / infraestructura llegó a `functions/` entero.** Los seis
   módulos puros son 938 de 2.000 LOC y sostienen los tests más densos del repo.

4. **La duplicación más peligrosa está prevenida por construcción.**
   `functions/calendario.js` se comparte por el alias `@calendario` (D-20) en vez
   de copiarse, y el alias apunta a **un archivo** y no a `functions/*`
   justamente para no invitar a arrastrar `firebase-admin` al bundle. Durante el
   saneamiento se agregó `@historial` con el mismo criterio, y el des-slug del
   panel y el del evento público volvieron a ser la misma función (B-132).

5. **El corte del bundle aguantó cuatro frentes.** La carga inicial de `/admin`
   sigue en `client` 184 kB + `AdminApp` 196 kB, con los 312 kB de Firestore
   diferidos, y `tests/bundle-panel.test.ts` lo verifica recorriendo el cierre
   transitivo de imports desde la entrada de la island **con un control
   positivo**: siguiendo los `import()` el SDK sí aparece. Sin ese control, el
   verde no probaría nada. Se atajó una regresión real: el contador de pendientes
   de B-26 habría metido Firestore en el chunk del login.

6. **El semáforo de `it.fails` funcionó tres veces y falló una, y las dos cosas
   se aprendieron.** B-84 y B-88 pasaron solos al arreglarse y rompieron el CI
   para avisar, que es exactamente el diseño. Y el de B-82 siguió fallando mucho
   después de que el bug estaba arreglado, invisible porque un `it.fails` que
   falla se ve como corresponde: el detector se había roto, no el código. Hoy el
   detector tiene sus propios tests con cuerpos sintéticos (D-108).

7. **El proceso aprende de sus accidentes, y quedó escrito.**
   `tests/sin-marcadores-de-conflicto.test.ts` nació de marcadores commiteados
   que sobrevivieron dos commits. `tests/invariantes-de-ciclo.test.ts` +
   `fixtures/ciclo.ts` nacieron de que la misma clase —un fixture que no ejercita
   el caso central del dominio— apareció cuatro veces. El skill `automatizar`
   lleva los cinco casos adentro como calibración.

8. **La proporción de tests cruzó el 1 a 1 y está bien dirigida.** 10.898 LOC de
   test contra 9.526 de código testeable, con los tests más densos sobre los
   módulos más frágiles (`calendario`, `historial`, `reportes`, el formulario) y
   no sobre los más fáciles.

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
| **`ETIQUETA_ENTREGA` duplicado entre panel y evento** | El panel capitaliza («Al inscribirse»), el evento va en minúscula a mitad de frase («al inscribirse»). Unificarlos haría que un cambio de copy del panel cambie lo que se publica. Lo que **sí** se unificó es `ETIQUETA_TIPO_MATERIAL`, que son sustantivos. | §5.1, B-134 |
| **`TaxonomiaSelect`, `TagsInput` y `ChipsInput` como tres componentes** | Tres widgets distintos: desplegable con "Otro", chips sobre taxonomía, chips de texto libre. Se comparte la lógica pura, no el markup — y reusar el de taxonomía para «arrobar» habría metido handles de Instagram en `/opciones/tags`. | D-116 |
| **`toPublic.ts` con fan-in de producción 0** | No es código muerto: es la pieza del sitio público, que es el paso 3 del §10 y todavía no existe. Ya tiene sus tests. | B-01 |
| **`src/lib/` plano** | Cero ciclos y los módulos más importados son hojas. Submódulos agregarían paths sin resolver nada. La excepción es `src/lib/formulario/`, que existe porque los seis módulos que salieron del `.tsx` son un grupo con sentido. | §1.4 |
| **Algolia / Typesense, microservicios, librería de formularios, state manager** | Evaluados y descartados. Son dos personas cargando actividades literarias. | §2.5, D-01 |

---

## 5. Resumen en una línea

El código pasó de **plano con un archivo hipertrofiado** a **plano**, y el
problema que queda ya no es de forma sino de método: **34 componentes y 5.355 LOC
de `.tsx` se verifican leyendo el fuente con expresiones regulares**, y ese
enfoque falló de tres maneras distintas en dos días — siempre igual, un chequeo
que cree haber encontrado lo que buscaba. La lógica de dominio ya salió de los
`.tsx`, que era el motivo por el que B-08 estaba postergado; ese motivo ya no
existe.

Lo demás es chico y está nombrado: la trampa 7 sin red (B-172), el `tsc` en rojo
en cualquier checkout limpio (B-173), dos vocabularios para «modalidad» (B-175) y
la prosa que pertenece al CHANGELOG (B-78).

Nada de esto es P0 ni P1, y nada bloquea el sitio público.
