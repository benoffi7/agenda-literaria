# Salud del código

Diagnóstico medido del estado del código, no una lista de buenas intenciones.
Todo número de acá salió de contar el árbol real en el commit `f1009be`, no de
estimar. Los scripts de medición fueron descartables (`/tmp`) y las cuentas se
pueden reproducir con `wc -l` y el grafo de imports.

**Contexto que explica la forma del código:** once features se integraron en un
día, escritas por agentes distintos en paralelo sobre nueve ramas. Eso deja
costuras concretas y medibles. Este documento las nombra.

**Qué NO es este documento:** no propone cambiar ninguna decisión del
[`CLAUDE.md`](../CLAUDE.md). El panel es un monolito en `/admin` por decisión
(§2.3) y Firestore es la única fuente de verdad (§2.1). Eso no se discute acá.
Ver [Qué no hay que tocar](#qué-no-hay-que-tocar).

---

## 1. Los números

### 1.1 Tamaño

Se cuentan archivos `.ts`, `.tsx`, `.js`, `.mjs` y `.astro`. Quedan afuera los
lockfiles, los dos scripts de shell y el CSS.

| Área | Archivos | LOC | Líneas significativas |
|---|---:|---:|---:|
| `src/` | 50 | 7.778 | 5.752 |
| `functions/` | 7 | 1.502 | 772 |
| `scripts/` | 5 | 410 | 257 |
| **Código (total)** | **62** | **9.690** | **6.781** |
| `tests/` | 28 | 5.069 | 4.067 |

Relación tests / código testeable (`.ts`/`.js`/`.mjs`, 6.234 LOC): **0,81 líneas
de test por línea de código**.

### 1.2 Concentración

Los quince archivos más grandes concentran el **52,7 %** del código.

| # | Archivo | LOC | % del total | Acumulado |
|---:|---|---:|---:|---:|
| 1 | `src/components/admin/ActividadFormulario.tsx` | 858 | 8,9 % | 8,9 % |
| 2 | `src/lib/ayuda.ts` | 616 | 6,4 % | 15,2 % |
| 3 | `src/lib/analytics-eventos.ts` | 600 | 6,2 % | 21,4 % |
| 4 | `functions/calendario.js` | 363 | 3,7 % | 25,1 % |
| 5 | `functions/index.js` | 327 | 3,4 % | 28,5 % |
| 6 | `src/lib/novedades.ts` | 300 | 3,1 % | 31,6 % |
| 7 | `src/components/admin/ReporteFormulario.tsx` | 269 | 2,8 % | 34,4 % |
| 8 | `src/components/admin/AdminApp.tsx` | 253 | 2,6 % | 37,0 % |
| 9 | `src/components/admin/SesionesEditor.tsx` | 250 | 2,6 % | 39,6 % |
| 10 | `src/components/admin/campos/TaxonomiaSelect.tsx` | 239 | 2,5 % | 42,1 % |
| 11 | `src/components/admin/ayuda/CentroAyuda.tsx` | 234 | 2,4 % | 44,5 % |
| 12 | `src/types/actividad.ts` | 213 | 2,2 % | 46,7 % |
| 13 | `src/lib/schema.ts` | 196 | 2,0 % | 48,7 % |
| 14 | `src/lib/duplicar.ts` | 194 | 2,0 % | 50,7 % |
| 15 | `functions/historial.js` | 193 | 2,0 % | 52,7 % |

Sobre `src/` solamente, `ActividadFormulario.tsx` es el **11,0 %**.

**Lectura:** la curva no es patológica. Un monolito de verdad tendría un archivo
con el 30-40 %. Acá el más grande es el 8,9 % y hace falta llegar al décimo para
pasar el 40 % acumulado. Dos de los tres primeros (`ayuda.ts`, `novedades.ts`)
son **prosa**, no lógica: 916 LOC de texto editorial tipado.

### 1.3 Lógica dentro de componentes React

El repo no tiene testing-library (documentado en
[`05-patrones.md`](05-patrones.md) → Tests, y en el backlog como B-08). Todo lo
que vive en un `.tsx` es, por construcción, inalcanzable para un test. Corte
mecánico: imports / lógica antes del `return (` / JSX desde el `return (`.

| Archivo | LOC | Imports | Lógica | JSX |
|---|---:|---:|---:|---:|
| `ActividadFormulario.tsx` | 859 | 29 | **227** | 603 |
| `TaxonomiaSelect.tsx` | 240 | 12 | **103** | 125 |
| `AdminApp.tsx` | 254 | 25 | **93** | 136 |
| `ReporteFormulario.tsx` | 270 | 15 | 84 | 171 |
| `CentroAyuda.tsx` | 235 | 11 | 74 | 150 |
| `ListaActividades.tsx` | 153 | 12 | 61 | 80 |
| `SesionesEditor.tsx` | 251 | 19 | 58 | 174 |
| `TagsInput.tsx` | 129 | 6 | 57 | 66 |
| `CoordenadasSede.tsx` | 147 | 8 | 55 | 84 |
| resto (9 archivos) | 866 | 41 | 331 | 494 |
| **Total `.tsx`** | **3.404** | **178** | **1.143** | **2.083** |

**1.143 LOC de lógica sin alcance de test** — el 11,8 % del código del proyecto.
De esas, 227 (el 20 %) están en un solo archivo.

Esta es la métrica que más importa del documento. No es "hay archivos grandes";
es "hay reglas de negocio que ningún test puede ver".

### 1.4 Acoplamiento — fan-in

Cuántos módulos importan a cada uno. `prod` excluye los `tests/`.

| Módulo | fan-in | fan-in prod | fan-out | LOC |
|---|---:|---:|---:|---:|
| `src/types/actividad.ts` | 28 | 19 | **0** | 213 |
| `src/components/admin/campos/Campo.tsx` | 12 | 12 | **0** | 79 |
| `src/lib/sesiones.ts` | 10 | 6 | 1 | 114 |
| `src/lib/analytics.ts` | 7 | 6 | 2 | 190 |
| `src/lib/opciones.ts` | 7 | 4 | 5 | 186 |
| `src/lib/slugify.ts` | 7 | 6 | **0** | 13 |
| `src/lib/version.ts` | 7 | 6 | **0** | 138 |
| `src/lib/firebase-client.ts` | 6 | 3 | 0 | 69 |
| `src/lib/firestore-client.ts` | 6 | 3 | 1 | 34 |
| `src/lib/actividades.ts` | 5 | 4 | 5 | 193 |
| `functions/calendario.js` | 3 | 2 | **0** | 363 |

**Lectura, y es buena noticia:** los cuellos de botella reales
(`types/actividad.ts` con 19 consumidores de producción, `Campo.tsx` con 12) son
**hojas con fan-out 0**. Cambiarlos toca muchos archivos, pero ellos no
dependen de nada, así que un cambio ahí no puede arrastrar efectos por
transitividad. Eso es exactamente la forma sana de un cuello de botella:
constantes y tipos arriba, nada colgando abajo. No hay un "god object" con
fan-in alto *y* fan-out alto.

### 1.5 Acoplamiento — fan-out

| Módulo | fan-out | LOC |
|---|---:|---:|
| `src/components/admin/ActividadFormulario.tsx` | **17** | 858 |
| `src/components/admin/AdminApp.tsx` | 11 | 253 |
| `src/components/admin/ListaActividades.tsx` | 7 | 152 |
| `src/components/admin/ReporteFormulario.tsx` | 7 | 269 |
| `src/components/admin/campos/TaxonomiaSelect.tsx` | 7 | 239 |
| `src/lib/actividades.ts` | 5 | 193 |
| `src/lib/opciones.ts` | 5 | 186 |
| `functions/index.js` | 4 | 327 |

`ActividadFormulario.tsx` importa 17 módulos internos, sobre 44 alcanzables
desde `AdminApp.tsx`: **el 39 % del grafo del panel entra por un archivo**.
Su fan-in es 1.

**Lectura:** el riesgo de `ActividadFormulario` no es blast radius hacia
afuera —nadie depende de él salvo `AdminApp`—, es que es el **sumidero** donde
converge todo. No rompe a los demás: los demás lo obligan a cambiar. Eso se
traduce en superficie de conflicto, no en propagación de bugs.

### 1.6 Salud del grafo

| Métrica | Valor |
|---|---|
| Ciclos de import (62 archivos de producción) | **0** |
| Profundidad del árbol desde `AdminApp.tsx` | 8 |
| Módulos alcanzables desde `AdminApp.tsx` | 44 |
| Imports sin resolver (paths roto) | 0 |
| Módulos `.ts`/`.js` sin ningún test que los importe | 14 de 41 (1.477 LOC, 23,7 %) |

Los 14 sin test son, casi todos, capa de infraestructura donde el test unitario
no aporta: los cinco `scripts/*.mjs`, los dos trigger-wrappers de `functions/`,
los cuatro hooks de React, `firebase-admin.ts` y `version.json.ts`. La excepción
que sí importa es **`functions/index.js` (327 LOC)** — ver problema 4.

### 1.7 Superficie de conflicto (41 commits de historia)

| Archivo de código | Commits que lo tocaron | % |
|---|---:|---:|
| `src/components/admin/AdminApp.tsx` | 10 | 24 % |
| `src/components/admin/ActividadFormulario.tsx` | 9 | 22 % |
| `functions/index.js` | 6 | 15 % |
| `src/components/admin/campos/TaxonomiaSelect.tsx` | 5 | 12 % |
| `src/components/admin/ListaActividades.tsx` | 4 | 10 % |
| `functions/calendario.js` | 4 | 10 % |

Esto no es teórico: `tests/sin-marcadores-de-conflicto.test.ts` existe porque se
commitearon marcadores de conflicto de git y **sobrevivieron dos commits**. El
comentario del test lo dice: "con nueve ramas integrándose sobre los mismos
archivos, resolver conflictos a ojo no alcanza".

### 1.8 Cohesión de `src/lib/`

23 archivos, 3.647 LOC, plano. Agrupados por responsabilidad real:

| Grupo | Módulos | LOC | % de `src/lib/` |
|---|---|---:|---:|
| **Contenido editorial** | `ayuda.ts`, `novedades.ts` (el array `NOVEDADES`), `opciones-base.json` | 937 | 25,7 % |
| **Dominio puro** | `sesiones`, `duplicar`, `coordenadas`, `toPublic`, `vistaPreviaEvento`, `normalize`, `huella`, `slugify` | 848 | 23,3 % |
| **Analítica** | `analytics-eventos`, `analytics` | 790 | 21,7 % |
| **Acceso a datos** | `actividades`, `opciones`, `reportes`, `firebase-client`, `firebase-admin`, `firestore-client` | 619 | 17,0 % |
| **Validación** | `schema`, `reporte-schema` | 282 | 7,7 % |
| **Estado de plataforma** | `version`, `formulario-sucio` | 171 | 4,7 % |

**Veredicto: está bien plano, con una excepción.** El grupo más grande son 8
archivos; ningún grupo justifica un directorio propio, y la separación que sí
importa —puro vs. lo que habla con Firestore, la regla de
[`05-patrones.md`](05-patrones.md)— ya está respetada archivo por archivo. Meter
`lib/dominio/`, `lib/datos/`, `lib/analitica/` agregaría tres niveles de path a
cambio de nada: el grafo hoy tiene profundidad 8 y cero ciclos, o sea que la
lista plana no está confundiendo a nadie.

La excepción es el **25,7 % que es prosa**. `ayuda.ts` (616 LOC de guía) y las
175 líneas del array `NOVEDADES` son contenido editorial que se edita cuando
cambia la funcionalidad, no cuando cambia la lógica, y hoy están al lado de un
`slugify.ts` de 13 líneas. Eso es lo único que pide moverse (B-78, P3 — el costo
de tenerlo así es cosmético).

---

## 2. Los problemas reales

Ordenados por lo que cuestan si no se arreglan. **Ninguno es P0 ni P1:** nada
está roto y nada de esto bloquea el sitio público (B-01), que sigue siendo lo
único P1 del proyecto.

### Problema 1 · `ActividadFormulario.tsx` mezcla cinco responsabilidades, y 227 LOC de reglas de negocio quedan sin test

**Qué es.** 858 líneas con cinco cosas distintas adentro:

| Bloque | Líneas | Qué es | Dónde debería vivir |
|---|---|---|---|
| `formVacio()` | 49-69 | El documento por defecto del §3.1 | `src/lib/` (puro, testeable) |
| `ETIQUETA_MODALIDAD` / `_VIA` / `_ESTADO` | 71-78 | Vocabulario de etiquetas de UI | `src/lib/etiquetas.ts` (compartido — ver problema 3) |
| `cambiarTitulo` / `cambiarTipo` / `cambiarModalidad` | 134-176 | **Reglas de dominio del §11 y §2.2** | `src/lib/` (puro, testeable) |
| `labelsPendientes` | 188-198 | Buffer de etiquetas sin persistir (D-02) | `src/lib/` (puro, testeable) |
| `guardar()` | 200-256 | **El caso de uso completo de guardado** | `src/lib/` (integración con emulador) |
| JSX, 9 `<Seccion>` | 257-858 | Render | Componentes por sección |

**Qué se rompe por tenerlo así.**

1. **Reglas de negocio invisibles para los tests.** `cambiarTipo` codifica "un
   club de lectura es un ciclo y tiene material" (§2.2, §11) y `cambiarModalidad`
   codifica "virtual ⇒ `sede = null`, presencial ⇒ `online = null`". Son
   decisiones del modelo de datos, con consecuencias en lo que se publica, y
   ningún test las puede ejecutar. Si un cambio futuro invierte uno de esos
   condicionales, el `npm test` pasa entero.
2. **`guardar()` encadena cuatro efectos y el orden importa.** Persiste las
   etiquetas nuevas en `/opciones/*` (líneas 237 y 240) **antes** de escribir la
   actividad (líneas 244-245). Si la escritura falla, las opciones ya se
   crearon: quedan huérfanas en la taxonomía. Es una versión parcial de
   exactamente lo que D-02 quiso evitar ("abandonar el formulario no debería
   dejar basura en la taxonomía"), y hoy no hay test que lo note ni UI para
   limpiarlo (B-06). → **B-71**.
3. **Superficie de conflicto.** 9 de 41 commits (22 %). Es el segundo archivo
   más tocado del repo y el más grande, en un proyecto donde ya se commitearon
   marcadores de conflicto.

**Qué costaría arreglarlo.** Es refactor mecánico, sin cambio de comportamiento:

- Extraer `formVacio` + las tres cascadas + `labelsPendientes` a un módulo puro
  (~90 LOC). Test unitario directo, sin emuladores, en el mismo estilo que
  `tests/duplicar.test.ts`.
- Extraer `guardar()` a un módulo de caso de uso (~60 LOC) que reciba las
  dependencias. Se cubre con el emulador, como `tests/actividades.integracion.test.ts`.
- El JSX se parte aparte y después (B-79), porque es lo que menos riesgo tiene y
  lo que más conflictos genera: conviene hacerlo cuando no haya ramas abiertas.

Resultado esperado: el archivo baja a ~250 LOC y ~150 LOC pasan a ser
testeables. Medio día para los dos primeros puntos.

### Problema 2 · La deduplicación §4.2 del cliente está implementada dos veces, y ya divergieron

**Qué es.** `TaxonomiaSelect.tsx` (240 LOC) y `TagsInput.tsx` (129 LOC) resuelven
el mismo problema del §4 con dos implementaciones separadas de tres reglas:

| Regla | `TaxonomiaSelect` | `TagsInput` |
|---|---|---|
| Filtro de sugerencias | `normalize(q)` + `includes`, tope **8**, con texto vacío muestra las **primeras 8** | `normalize(q)` + `includes`, tope **6**, con texto vacío muestra **nada** |
| Dedupe por slug (§4.2) | `slugTipeado` + `valores.find(...)` → avisa *"Ya existe como «X» — se va a reusar esa"* | `slugify(texto)` + `valores.find(...)` → **reusa en silencio** |
| Badge "sin aprobar" | JSX propio | JSX propio, idéntico |
| Analítica | `medirFuncion('taxonomia-otro' \| 'nueva' \| 'reusada' \| 'sugerencia')` | **ninguna** |

**Qué se rompe por tenerlo así.**

1. **§4.2 es "crítico" en el `CLAUDE.md`** ("sin esto, en tres meses hay cuatro
   variantes de 'a la gorra'"). La transacción de `src/lib/opciones.ts` sí está
   testeada contra el emulador; la mitad del cliente —la que evita que el 90 %
   de los duplicados nazca— tiene dos copias, ambas en `.tsx`, ambas sin test.
2. **La divergencia ya es observable.** `taxonomia-nueva` /
   `taxonomia-reusada` / `taxonomia-sugerencia` declaran `'tags'` como valor
   válido de `detalle` (`CAMPOS_TAXONOMIA_MEDIBLES` en
   `analytics-eventos.ts:134`), pero `TagsInput` no llama a `medirFuncion`
   nunca: **ese valor no puede aparecer en GA4**. El campo con más volumen
   esperado es el único invisible en la analítica de taxonomías. → **B-73**.
3. Y el aviso de reuso: en `arancel` el usuario ve "ya existe, se va a reusar";
   en `tags` no ve nada. Misma regla, dos experiencias.

**Qué costaría arreglarlo.** Extraer las dos reglas puras
(`sugerenciasPara(texto, elegibles, tope)` y `resolverEtiqueta(texto, valores)`)
a un módulo de ~40 LOC con sus tests, y que los dos componentes las llamen.
~2 horas. **Los componentes no se unifican**: un `<select>` con "Otro" y un input
de chips son widgets distintos, y fusionarlos sería peor.

### Problema 3 · El vocabulario de etiquetas y de enums está copiado en cuatro lugares, tres sin guardia

**Qué es.** Dos cosas distintas que comparten causa.

*(a) Enums del modelo, copiados en `analytics-eventos.ts`:*

| Original (`src/types/actividad.ts`) | Copia (`src/lib/analytics-eventos.ts`) | ¿Guardia? |
|---|---|---|
| `ESTADOS` (línea 26) | `ESTADOS_DESTINO` (línea 45) | no |
| `MODALIDADES` (línea 23) | `MODALIDADES_MEDIBLES` (línea 47) | no |
| `CAMPOS_TAXONOMIA` (línea 212) | `CAMPOS_TAXONOMIA_MEDIBLES` (línea 134) | no |

`analytics-eventos.ts` **ya importa `@/types/actividad`** (línea 2), y ese módulo
tiene fan-out 0: importar las tres constantes cuesta cero bytes de bundle.
No hay motivo técnico para la copia.

*(b) Etiquetas de UI, fragmentadas:*

- `ActividadFormulario.tsx:71-78` — `ETIQUETA_MODALIDAD`, `ETIQUETA_VIA`, `ETIQUETA_ESTADO`.
- `ListaActividades.tsx:124` — renderiza `{a.estado}` **en crudo**: el listado
  dice "borrador" donde el formulario dice "Borrador". → **B-76**.
- `functions/calendario.js:52-79` — cuatro mapas más, pero con prosa para el
  público ("por DM de Instagram", "Presencial y virtual"). **Esto no es
  duplicación:** es otro vocabulario para otra audiencia. No unificar.

**Qué se rompe por tenerlo así.** Agregar un sexto `tipo` o un quinto `estado`
—los dos campos con taxonomía autogestionada del §4— hace que la analítica lo
mande como `'otro'` en silencio. Es **el mismo modo de falla que D-60 documenta
y previene** con un test, una góndola más allá. El costo es el que dice D-60:
"un campo nuevo se reporta como `otro` justo cuando alguien está buscando por
qué la gente se traba en él. En silencio, otra vez."

**Qué costaría arreglarlo.** Seis líneas: importar los tres enums en vez de
copiarlos (**B-75**). Si por algún motivo se quieren dejar separados, el patrón
correcto ya existe en el repo: un test que los derive, como
`tests/analytics-campos.test.ts` hace con `CAMPOS_VALIDABLES`. Para las
etiquetas, un `src/lib/etiquetas.ts` de ~20 LOC que usen el formulario y el
listado (**B-76**).

### Problema 4 · `functions/index.js` es el único archivo de `functions/` que no recibió el corte puro/trigger

**Qué es.** 327 LOC con seis responsabilidades: init de `db`, auth de Google
Calendar, carga de labels, marcado de rebuild, dos triggers (`syncCalendar`,
`rebuildPorOpciones`), el schedule `dispararRebuild` y un cliente HTTP de GitHub
(`dispararDispatch`, líneas 239-263).

El resto de `functions/` **sí** tiene el corte que
[`05-patrones.md`](05-patrones.md) prescribe: `calendario.js`, `rebuild.js`,
`historial.js` y `reportes.js` son puros y concentran cuatro de los cinco
archivos de test más grandes; `historial-trigger.js` y `reportes-trigger.js` son
los wrappers. `index.js` quedó afuera del patrón, y es el archivo de 327 LOC
**sin ningún test**.

**Qué se rompe por tenerlo así.** El cliente de GitHub se duplicó. Cuando
`reportes-trigger.js` necesitó hablar con la API, copió las cinco cabeceras
(`index.js:242-247` ≡ `reportes-trigger.js:66-71`) **pero no el timeout**:

- `index.js:230` define `TIMEOUT_DISPATCH_MS` con el comentario *"Sin esto un
  socket colgado se come el tick entero"*, y lo usa con `AbortSignal.timeout`.
- `reportes-trigger.js` no tiene ningún `AbortSignal` (0 ocurrencias). Su
  `crearIssue` puede colgarse indefinidamente.

Eso es la duplicación cobrándose: el conocimiento estaba escrito, en una sola de
las dos copias. → **B-74** (el timeout, que es un bug latente real) y **B-77**
(el corte, que es higiene).

**Qué costaría arreglarlo.** El timeout son 2 líneas. El corte —extraer
`functions/github.js` puro con `fetch` inyectable, y mover `syncCalendar` a
`calendario-trigger.js`— es medio día y sigue un patrón que el repo ya usa cinco
veces, así que no hay diseño nuevo que discutir.

---

## 3. Lo que está bien

Un diagnóstico que solo encuentra problemas no se puede calibrar. Esto es lo que
la medición encontró sano, y no por casualidad.

1. **Cero ciclos de import** en 62 archivos de producción, profundidad 8. En un
   proyecto integrado en un día por agentes en paralelo, esto es lo primero que
   se suele romper. No se rompió.

2. **Los cuellos de botella son hojas.** Los dos módulos con más fan-in
   (`types/actividad.ts`, 19 consumidores; `Campo.tsx`, 12) tienen fan-out **0**.
   Concentrar dependencias en constantes y tipos que no dependen de nada es la
   forma correcta de concentrarlas. No hay ningún módulo con fan-in alto y
   fan-out alto — no hay god object.

3. **El corte puro / infraestructura se cumplió donde más importa.** Los cuatro
   módulos puros de `functions/` (`calendario`, `rebuild`, `historial`,
   `reportes`) son 877 de las 1.502 LOC de `functions/` —el 58 %— y sostienen
   los tests más densos del repo. En total, el 76 % del código testeable tiene
   al menos un test que lo importa.

4. **La duplicación más peligrosa fue prevenida activamente, no solo
   documentada.** `functions/calendario.js` se comparte con el panel por el alias
   `@calendario` (D-20) en vez de copiarse, y el alias apunta a **un archivo** y
   no a `functions/*` justamente para no invitar a arrastrar `firebase-admin` al
   bundle. La lógica que aplica las reglas de privacidad del §5.1 tiene una sola
   copia por construcción.

5. **La duplicación deliberada está documentada Y con guardia ejecutable.**
   `CAMPOS_VALIDABLES` es una constante a mano por un motivo medido (importar
   zod metía 68 kB en el chunk inicial, deshaciendo B-09), la decisión está en
   D-60, y `tests/analytics-campos.test.ts` la deriva del schema y falla
   diciendo qué sobra y qué falta. Ese es el estándar; los tres casos del
   problema 3 son los que no lo alcanzan.

6. **La granularidad de `src/components/admin/campos/` funciona.** `Campo.tsx`
   (79 LOC) resuelve label + error + ayuda para 12 consumidores, y `Seccion.tsx`
   (77 LOC) se auto-instrumenta reportando el slug de su propio título. Los
   componentes chicos y muy reusados son chicos y muy reusados.

7. **El proceso aprendió de sus propios accidentes.**
   `tests/sin-marcadores-de-conflicto.test.ts` nació de marcadores commiteados
   que sobrevivieron dos commits. En vez de "hay que mirar mejor", quedó un test.

8. **La proporción de tests es alta y bien dirigida.** 5.069 LOC de test contra
   6.234 de código testeable, y los tests más grandes están sobre los módulos
   más frágiles (`calendario`, `historial`, `reportes`, `duplicar`) — no sobre
   los más fáciles.

---

## 4. Qué no hay que tocar

Estas cosas parecen problemas si se las mira solo con métricas. No lo son.

| Cosa | Por qué se deja | Referencia |
|---|---|---|
| **El panel como monolito en `/admin`** | Decisión cerrada: un repo, un Hosting target, un deploy. El bundle pesado ya está aislado en esa ruta (D-51). No partir el panel en su propia app ni en servicios. | `CLAUDE.md` §2.3 |
| **Firestore como única fuente de verdad** | Decisión cerrada. Nada de sync bidireccional con Calendar. | `CLAUDE.md` §2.1 |
| **`CAMPOS_VALIDABLES` como constante a mano** | Derivarla en runtime metía zod (68 kB) en el chunk inicial. La garantía vive en un test que la deriva del schema. Si algo hay que hacer es **extender** este patrón a los tres enums del problema 3, no quitarlo. | D-60, B-09 |
| **La copia de `CAMPOS_TAXONOMIA` en `functions/index.js:84`** | `functions/` se despliega con su propio `package.json` y no puede importar hacia arriba; D-20 evaluó y descartó mover el módulo. Si molesta, la respuesta es un test que compare las dos listas, no un import imposible. | D-20 |
| **Los mapas `ETIQUETA_*` de `functions/calendario.js`** | Son prosa para el evento público ("Presencial y virtual"), no etiquetas de UI. Unificarlos con los del formulario haría que un cambio de copy del panel cambie lo que se publica en el calendario. | §5.1 |
| **`TaxonomiaSelect` y `TagsInput` como componentes separados** | Un desplegable con "Otro" y un input de chips son widgets distintos. Se comparte la lógica (problema 2), no el markup. | §4 |
| **`toPublic.ts` y `firebase-admin.ts` con fan-in de producción 0** | No es código muerto: son las piezas del sitio público, que es el paso 3 del §10 y todavía no existe. `toPublic.ts` ya tiene sus tests. | B-01 |
| **`src/lib/` plano** | 23 archivos donde el grupo más grande son 8, cero ciclos, profundidad 8. Submódulos agregarían paths sin resolver nada. Lo único que se mueve es la prosa (B-78). | §1.8 |
| **La ausencia de tests de componentes como tal** | Ya está reportada (B-08) y la decisión de verificar la UI a mano está documentada. Lo que este documento agrega no es "instalen testing-library", es **sacar la lógica de dominio del `.tsx`** para que no dependa de eso. | B-08 |
| **Algolia / Typesense, microservicios, librería de formularios, state manager** | Evaluados y descartados. Son dos personas cargando actividades literarias. | §2.5, D-01 |

---

## 5. Resumen en una línea

El código no es monolítico: es **plano con un archivo hipertrofiado**. El
problema medible no es el tamaño (el archivo más grande es el 8,9 %), es que
**1.143 LOC de lógica de dominio viven donde ningún test llega**, y 227 de esas
están en `ActividadFormulario.tsx` junto al caso de uso de guardado. Todo lo
demás son costuras de la integración en paralelo: tres copias sin guardia de
enums que ya se sabe cómo guardar (D-60), una regla crítica del §4.2
implementada dos veces, y un timeout que no se copió junto con las cabeceras.

Ítems de trabajo: **B-70 a B-79** en [`BACKLOG.md`](BACKLOG.md). Ninguno es P0
ni P1 — nada está roto y nada de esto bloquea el sitio público.
