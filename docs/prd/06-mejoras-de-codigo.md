# PRD 6 · Mejoras de código — monolitos, velocidad y tokens

**Estado:** escrito el 2026-09-25, sin construir. Sin ítems de backlog todavía:
las propuestas se anotan en [`../BACKLOG.md`](../BACKLOG.md) cuando el dueño
conteste el § 7.
**Pedido del dueño, textual:** «hacé una auditoría de monolito, modularización, y
un PRD de mejoras de código, velocidad y ahorro de tokens».
**Medido sobre** `7e7ed8b`, en la máquina del dueño (12 núcleos, 24 GB).

Este PRD **no es una reescritura**. Todo lo que propone se hace por tajadas
chicas, con la red de tests que ya existe, y respeta el § 2 del `CLAUDE.md` y la
tabla «Qué no hay que tocar» de [`../10-salud-del-codigo.md`](../10-salud-del-codigo.md) § 4.

Cada hallazgo dice si es **medido** (salió de un comando, y el comando está
escrito) o **leído** (salió de leer el fuente o un log).

---

## 1 · Qué es

Tres cosas que cuestan todos los días y que nadie pidió medir juntas:

| Costo | Quién lo paga | Cuánto, hoy |
|---|---|---|
| **Esperar la suite** | cada frente, varias veces por tanda | **138 s** por corrida, y el pre-push corre la suite **dos veces** |
| **Leer para arrancar** | cada agente, en cada sesión | **~21 mil tokens** antes de la primera pregunta, y **~56 mil** con la lectura que pide un encargo típico |
| **Monolitos** | quien toca la Guía, el build del gate o la retención | la misma forma escrita cuatro veces en la Guía, un `try` de 1.500 líneas en el gate |

## 2 · El problema, con números

### 2.1 · Monolitos

| Archivo | LOC | Qué mezcla | Fuente |
|---|---:|---|---|
| `src/lib/ayuda.ts` | 2.632 | copy del panel. **No se toca**: 10 § 4 | medido |
| `src/lib/contenidoDelSitio.ts` | 2.292 | la lectura de build de **todo**: actividades, mes, hubs, sitemap, pasadas **y** los cinco directorios (`indiceDe…`, `vistaDe…`, `caminosDe…` repetido por librerías, bibliotecas, suscripciones, lugares y efemérides). 46 exports, 34 consumidores, 27 imports | medido |
| `src/lib/detallePublico.ts` | 2.076 | la ficha de actividad, el JSON-LD y las migas. 62 % comentario | medido |
| `scripts/build-contra-emulador.mjs` | 1.890 | **un solo `try`** de la línea 377 a la 1.874 con **87** llamadas a `fallo(…)`: siembra, build y los chequeos sobre `dist/` en secuencia. Y una trampa armada: `fallo()` pone `process.exitCode = 1`, pero el script termina con `process.exit(salida)`, que la pisa. Por eso **70** de las 87 llamadas llevan un `salida = 1` escrito a mano en la línea siguiente (las otras 17 pasan por `ctx.fallo`, que lo hace solo). Hoy están todas bien; un `fallo()` nuevo sin su `salida = 1` imprime el rojo y sale con 0, y ningún test lo mira | medido + leído |
| `functions/retencion.js` | 1.493 | tres ciclos de vida (propuestas, flyers, fichas de la Guía) en un archivo, **y con I/O adentro**: `propuestasVencibles(db…)`, `borrarPropuesta(db, bucket…)`, `borrarFicha(db…)`. El patrón de 05 pide lo puro de un lado y el efecto en el `-trigger` | leído |
| `src/components/admin/AdminApp.tsx` | 1.263 | shell del panel + router de 11 pantallas diferidas, 22 hooks | medido |
| `src/components/admin/EstadisticasPanel.tsx` | 1.242 | un solo export | medido |
| `src/components/admin/PropuestasPanel.tsx` | 1.102 | bandeja + conversión, 18 hooks | medido |
| `src/components/admin/ActividadFormulario.tsx` | 979 | **está bien**: 472 significativas contra la alarma de 550, fan-out 37 contra 45 (10 § 1.3) | medido |

En total, **23** archivos de `src/` pasan las 800 líneas y **18** de `tests/`
pasan las 1.000 (medido, `wc -l`).

**Los tests más grandes son registros**, no un tema:

| Test | Líneas | Casos | `describe` de primer nivel |
|---|---:|---:|---:|
| `tests/barrido-de-salidas-publicas.test.ts` | 4.178 | 104 | 21 |
| `tests/clases-de-bug.test.ts` | 3.728 | 132 | 18 |
| `tests/detallePublico.test.ts` | 2.856 | 154 | — |
| `tests/calendario.test.ts` | 2.633 | 160 | — |

Medido. Un agente que tiene que sumar **una** salida o **una** clase lee el
archivo entero: 50 mil tokens el primero, 47 mil el segundo.

### 2.2 · Modularización

- **Ciclos: cero estáticos y uno diferido, declarado** (medido,
  `node scripts/salud-del-codigo.mjs`). Coincide con 10 § 1.5. Nada que hacer.
- **`src/` ↔ `functions/`: resuelto.** Lo que comparten vive en `functions/` y
  `src/lib/` lo reexporta con una fachada de una línea (`geografia.mjs`,
  `slugify.mjs`, `huella.ts`). Lo único raro es que `slugify` tiene **dos**
  fachadas encadenadas (`slugify.ts` → `slugify.mjs` → `functions/slugify.js`)
  (leído).
- **Duplicación: 4,2 % global, casi toda en la Guía** (medido: ventanas de 8
  líneas significativas repetidas en otro archivo, sin comentarios ni imports).

  | Familia | Archivos | Líneas repetidas en cada uno |
  |---|---|---:|
  | Formularios de admin (`Libreria/Biblioteca/Lugar/SuscripcionFormulario.tsx`) | 4 | 103–109 |
  | Fichas públicas (`src/pages/guia/*/[slug].astro`) | 4 | 42–43 |
  | Buscadores públicos (`BuscadorDe*.tsx`) | 4 | 43–55 |
  | Altas públicas (`Sumar*.tsx`) | 4 | 38–55 |
  | Schemas (`libreria-schema.ts` ↔ `biblioteca-schema.ts`) | 2 | 59 |

  La mayor fuera de la Guía es `functions/directorios.js` ↔ `contenidoDelSitio.ts`
  (65 líneas): **es deliberada**, porque `functions/` no puede importar de `src/`
  (D-20), y la ata `tests/directorios-rebuild.test.ts` (leído). No se toca.
- **Límite cliente/servidor: sano.** `firebase-admin` lo importan 3 archivos de
  `src/lib/`, el SDK de cliente 22, y los dos lados los vigilan
  `tests/panel-fuera-del-sitio.test.ts` y `scripts/verificar-bundle.sh` (medido).

### 2.3 · Velocidad

| Qué | Hoy | Fuente |
|---|---:|---|
| `npx vitest run` sin emuladores | **138 s** de reloj: 282 archivos, 7.210 casos (550 salteados) | medido, dos corridas (138 s y 148 s) |
| — de eso, tests | 60 s | medido (`Duration` de vitest) |
| — de eso, recolectar + entorno + preparar | 44 s | medido |
| La misma suite **con archivos en paralelo** (sin los de integración) | **32 s** | medido, con `--fileParallelism` |
| `tests/que-deployar.test.ts` solo | **16,5 s**, el 24 % del tiempo de tests: 48 casos que lanzan `scripts/que-deployar.sh`, y cada llamada barre `src/` entero con `grep -r` | medido + leído |
| Los 38 tests de render (jsdom) | 15 s | medido |
| `astro sync` + `tsc --noEmit` | 7 s | medido |
| Paso 5 del gate (build contra el emulador) | 10 s, de los que el `astro build` son 5 | medido |
| Paso 6 del gate (`verificar-bundle.sh`) | 1 s | medido |
| **Pre-push entero** (`scripts/verificar-todo.sh`) | **≈ 5 min**, y ~90 % es correr la suite dos veces: paso 3 con emuladores ≈ 155 s, paso 4 con `TZ=Asia/Tokyo` ≈ 130–150 s | pasos 5 y 6 medidos; 3 y 4 leídos de los logs de gates anteriores |

**Por qué 138 s y no 32:** `vitest.config.ts` pone `fileParallelism: false`
**para toda la suite**, porque los 25 archivos `*.integracion.test.ts` comparten
el emulador. Los otros 257 no lo necesitan y pagan igual la fila india.

**Y no alcanza con prender el paralelo**: la corrida en paralelo dio **dos
fallas por carrera**. `tests/archivos-del-repo.test.ts`,
`tests/credenciales-del-emulador.test.ts` y `tests/rechazos-sin-copia.test.ts`
escriben archivos de mutación **adentro de `tests/fixtures/`**
(`.mutacion-b1060-tmp.ts`, `.mutacion-b964-sin-rastrear-tmp.txt`) mientras
`tests/mapa-de-trampas.test.ts` y `tests/estados-referenciados.test.ts` recorren
el árbol y los encuentran a medio borrar (`ENOENT`). En serie no pasa nunca;
es la precondición del paralelo (medido).

**En CI, el deploy repite la suite.** `.github/workflows/deploy.yml` corre
`npm test` entero en cada `repository_dispatch` —o sea, en cada rebuild por
contenido—, aunque el commit sea el mismo que ya pasó en `push-main.yml` (leído).
Son ~2,5 min de Actions por cada edición de una actividad.

**El bundle** (medido sobre el `dist/` del gate de hoy, gzip nivel 6, cierre de
imports estáticos):

| Página | JS al abrir | gzip |
|---|---:|---:|
| `/` (home, con el buscador) | 27 chunks, 257 KB | **88,5 KB** |
| `/actividad/{slug}` | 15 chunks, 206 KB | 67 KB |
| `/admin`, antes de loguearse | 21 chunks, 445 KB | **144 KB** |

En el chunk inicial del panel va **`novedades.ts` entero: 69 KB, 21 KB gzip**,
porque `BotonAyuda.tsx` lo importa estático para contar las no leídas. D-63
estimaba «unos 19 KB de contenido **entre la guía y las novedades**»; hoy solo
las novedades son 69 KB, y se descargan antes del login (medido). La guía
(`CentroAyuda`, 95 KB) sí es diferida.

### 2.4 · Tokens

**Lo que entra en cada sesión antes de la primera pregunta** (medido en bytes;
tokens ≈ bytes / 4):

| Qué | Bytes | ≈ tokens |
|---|---:|---:|
| `~/.claude/mwdd-agent.md`, el orquestador MDD, importado desde el `CLAUDE.md` global del dueño | 49.924 | **12.500** |
| `CLAUDE.md` del repo | 27.504 | 6.900 |
| Descripciones de los 3 agentes y 6 skills del repo (van al prompt de sistema) | 8.990 | 2.250 |
| — de eso, solo la del `auditor-privacidad` (lista ~150 rutas) | 4.686 | 1.170 |
| **Total** | **~86 KB** | **~21.600** |

**El MDD está desactivado en este repo** (la memoria del proyecto lo dice:
«No usar MDD en este repo»), y sin embargo sus 12.500 tokens se cargan en cada
sesión. Es el 58 % de lo fijo (leído + medido).

**Lo que suma un encargo típico** («leé CLAUDE.md, docs/README.md,
docs/05-patrones.md, docs/13-agentes.md»): **224 KB, ~56 mil tokens** (medido).
El grueso es uno:

| Documento | Bytes | ≈ tokens | Nota |
|---|---:|---:|---|
| `docs/13-agentes.md` | 147.785 | 37.000 | **~75 %** es una sola sección, «Qué se decidió no automatizar» (≈ 111 mil caracteres), que es un registro y no hace falta para trabajar |
| `docs/05-patrones.md` | 41.367 | 10.300 | se lee bien; no hay nada que sacar |
| `docs/README.md` | 7.655 | 1.900 | — |

**Los documentos que no se pueden leer enteros** (medido):

| Documento | Bytes | ≈ tokens | Índice |
|---|---:|---:|---|
| `docs/BACKLOG-cerrados.md` | 1.472.341 | 368.000 | no hace falta: se busca por id |
| `docs/CHANGELOG.md` | 1.026.603 | 257.000 | no hace falta |
| `docs/06-decisiones.md` | 818.884 | 205.000 | **no tiene**: 294 decisiones `## D-…` sin tabla de contenidos |
| `docs/07-seguridad.md` | 198.686 | 49.700 | — |
| `docs/08-operacion.md` | 188.911 | 47.200 | 186 títulos |
| `docs/10-salud-del-codigo.md` | 105.400 | 26.400 | — |

**Copias que se leen dos veces** (medido): la tabla de salidas públicas ocupa
**43 KB** (~10.800 tokens) de la ficha del `auditor-privacidad` y vuelve a estar
en `07-seguridad.md`. Las notas «el bloque de abajo queda como estaba escrito»
aparecen **26 veces** en 10 archivos; en el `CLAUDE.md` son 5 y, con sus
bloques, el **20 %** del archivo: el agente lee el bloque viejo **y** la
corrección.

**La prosa en el código** (medido, bytes de líneas de comentario):

| Área | Comentario | ≈ tokens de comentario | Referencias `B-`/`D-` en comentarios |
|---|---:|---:|---:|
| `src/` | **60 %** | 612.000 | 4.108 |
| `functions/` | **74 %** | 117.000 | 739 |
| `scripts/` | 55 % | 80.000 | 598 |
| `tests/` | 44 % | 650.000 | 3.640 |

**B-78 decidió que esto es deliberado y no se baja**, y 10 § 1.6 lo sostiene
con una lectura. Este PRD **no lo revisa**: lo que propone (§ 5, M-12) es para
la prosa **nueva**, y la decisión es del dueño (§ 7, decisión F). Lo que sí se
lee en el fuente es una clase que 10 § 1.6 no cubre: docblocks que cuentan
**la historia** del archivo («De dónde viene, porque el motivo original ya no
existe», al principio de `scripts/sin-comentarios.mjs`) y no el porqué vigente
(leído).

## 3 · Objetivos medibles

| # | Objetivo | Hoy | Meta | Cómo se mide |
|---|---|---:|---:|---|
| O-1 | Suite sin emuladores | 138 s | **≤ 45 s** | `npx vitest run`, reloj |
| O-2 | Pre-push entero | ≈ 5 min | **≤ 2 min** | `time ./scripts/verificar-todo.sh` |
| O-3 | Tokens fijos por sesión | ~21.600 | **≤ 9.000** | bytes de lo cargado ÷ 4 (§ 2.4) |
| O-4 | Encargo típico (los cuatro de arriba) | ~56.000 | **≤ 25.000** | ídem |
| O-5 | JS del panel antes del login | 144 KB gzip | **≤ 124 KB** | el cierre de imports de `admin/index.html` en `dist/` |
| O-6 | Duplicación de la Guía | 103–109 líneas por formulario | **≤ 40** | la misma medición de ventanas de 8 líneas |
| O-7 | Llamadas a `fallo()` del gate que dependen de un `salida = 1` escrito a mano | 70 de 87 | **1** (el de adentro de `fallo`) | `grep -c 'salida = 1' scripts/build-contra-emulador.mjs` |

Ninguno de estos números se ata a un test: se moverían con el trabajo de
cualquier otro frente, que es la objeción de B-180. Se remiden a mano al cerrar
cada tajada, como las cifras de 10.

## 4 · No-objetivos

- **Nada del § 2 del `CLAUDE.md`**: ni otro stack, ni Algolia/Typesense, ni sync
  bidireccional, ni RRULE, ni una Function que arme el JSON.
- **No partir `ayuda.ts` ni `novedades.ts`** (10 § 4). Lo que se propone con
  novedades es **cuándo se descarga**, no dónde vive.
- **No cambiar `src/lib/` plano** ni el panel como una sola isla en `/admin`
  (10 § 4).
- **No hacer un `toPublic` genérico** para la Guía. La proyección sigue siendo
  una whitelist **por entidad**; lo que se comparte es el esqueleto de la UI, no
  la lista de campos.
- **No borrar historia.** `BACKLOG-cerrados.md`, `CHANGELOG.md` y
  `06-decisiones.md` no se recortan: se les agrega por dónde entrar.
- **No bajar los comentarios existentes en masa** (B-78).
- **No sacar ningún chequeo de la red.** Partir un test es mover casos, no
  borrarlos: el conteo de casos antes y después tiene que ser el mismo.

## 5 · Propuestas

Tamaño: **S** = una tarde, **M** = uno o dos días, **L** = más. Riesgo: qué se
rompe si sale mal.

### 5.1 · Ahora

| # | Qué | Tamaño | Riesgo | Cómo se mide |
|---|---|---|---|---|
| **M-1** | **La suite en dos proyectos.** `test.projects` en `vitest.config.ts`: `unidad` en paralelo, `integracion` (`*.integracion.test.ts`) en serie. Resuelve de paso el aviso de `environmentMatchGlobs` obsoleto, porque jsdom pasa a ser un proyecto más. **Antes**, los tres tests que escriben mutaciones en `tests/fixtures/` pasan a escribir en `os.tmpdir()` (o se les pasa la lista de archivos), que es lo que hoy rompe el paralelo | M | medio: un test que dependa del orden aparece como flaky. Se corre la suite 5 veces seguidas antes de dar por cerrado | O-1: 138 s → ≤ 45 s (medido 32 s sin integración) |
| **M-2** | **El paso 4 del gate corre solo el proyecto `unidad`.** Los de integración ya se saltean en ese paso (no hay emulador), así que no se pierde nada | S | bajo | O-2 |
| **M-3** | **`que-deployar.test.ts` en 3 s.** El script lee el grafo de `src/` una vez por llamada; el test puede armar un árbol chico en `QUE_DEPLOYAR_RAIZ` (B-1241 ya lo permite) en vez de barrer el repo real 48 veces | S | bajo: el test ya tiene casos sobre el árbol real, se deja uno | 16,5 s → ≤ 3 s |
| **M-4** | **Novedades fuera del chunk inicial del panel.** `BotonAyuda` solo necesita ids y fechas para contar las no leídas: un `NOVEDADES_IDS` chico al lado (derivado por un test que lo compara con `NOVEDADES`), y el texto se carga con `CentroAyuda`, que ya es diferido. Corregir el costo de D-63 | S | bajo | O-5: −21 KB gzip |
| **M-5** | **`13-agentes.md` sin su registro.** «Qué se decidió no automatizar» pasa a su propio archivo (`13-agentes-no-automatizado.md`), con un párrafo y el link en su lugar. Hay que mover las lecturas de 8 tests y 2 scripts que nombran el archivo | M | medio: un test que lee la sección del archivo viejo se pone rojo; eso es lo esperado y se arregla en el mismo cambio | O-4: 13-agentes de 37 mil a ~9 mil tokens |
| **M-6** | **El MDD no se carga en este repo.** Ver decisión A | S | nulo en el repo: es configuración del dueño | O-3: −12.500 tokens por sesión |

### 5.2 · Próximo

| # | Qué | Tamaño | Riesgo | Cómo se mide |
|---|---|---|---|---|
| **M-7** | **Índice de `06-decisiones.md`**: una línea por decisión (id, título, ancla), generado por un script como `decisiones:huerfanas`, y un test que falle si el índice no coincide con los títulos. Mismo trato para `08-operacion.md` si el primero sirve | S | bajo | encontrar una D sin cargar 205 mil tokens |
| **M-8** | **La tabla de salidas en un solo lugar.** La ficha del `auditor-privacidad` la **lee** de `07-seguridad.md` en vez de copiarla. Ver decisión B, porque la descripción de la ficha también la usa `auditores-que-corresponden.mjs` | M | medio: el selector de auditores deriva de la ficha (13 § «Cuándo corren») | −43 KB de la ficha (~10.800 tokens por corrida del auditor, que es el de `opus`) |
| **M-9** | **`contenidoDelSitio.ts` en dos**: lo de actividades se queda; lo de la Guía pasa a `contenidoDeLaGuia.ts` con **un** `indice/vista/caminos` que recibe el `IdDirectorio`, en vez de cinco copias | M | medio: 34 consumidores; la fachada reexporta mientras se migran | −600 LOC aprox.; 46 exports → ~25 |
| **M-10** | **El esqueleto de la Guía, una vez.** Un `useFichaDeDirectorio` para los cuatro formularios de admin (estado, sucio, guardar, publicar, galería) y un `FichaDeGuia.astro` para las cuatro fichas públicas. Los campos y la whitelist siguen por entidad | L | medio: son cuatro pantallas con render tests; se hace de a una, empezando por librerías, que es la más chica | O-6 |
| **M-11** | **El gate del build con chequeos nombrados.** Primero lo chico, que va solo: `fallo()` pasa a marcar `salida = 1` él mismo y se borran los 70 `salida = 1` a mano (desarma la trampa del § 2.1). Después, `build-contra-emulador.mjs` queda en siembra + build + un runner, y los chequeos pasan a `scripts/gate-build/chequeos/*.mjs`, cada uno con su nombre y su archivo | S lo primero, M lo segundo | medio: es el gate; se valida corriéndolo con una mutación por chequeo movido, como ya se hace | O-7 |
| **M-12** | **Tests-registro partidos por entrada**: `tests/salidas/NN-nombre.test.ts` y `tests/clases/nombre.test.ts`, con el helper común en `tests/fixtures/`. Con M-1, además, corren en paralelo | M | bajo: se compara el conteo de casos antes y después | leer una salida: de 50 mil tokens a ~3 mil |
| **M-13** | **`functions/retencion.js` en tres** (propuestas, flyers, fichas), con las funciones que reciben `db` o `bucket` movidas al `-trigger` correspondiente, que es el corte de 05 | M | medio: es borrado de datos; los 71 casos de `tests/retencion.test.ts` son la red | cero `db`/`bucket` en los módulos puros |
| **M-14** | **El deploy por contenido no repite la suite** si el commit ya pasó `push-main.yml` en verde. Ver decisión D | S | medio: si la verificación del SHA falla abierta, se deploya sin tests. Tiene que fallar cerrada | −2,5 min de Actions por rebuild |

### 5.3 · Más adelante

| # | Qué | Tamaño | Riesgo | Cómo se mide |
|---|---|---|---|---|
| **M-15** | **Una regla para los comentarios nuevos**: el docblock dice el porqué **vigente** y cita la D; la historia («antes era así, después…») va a la D en `06-decisiones.md`. No se reescribe lo que hay. Ver decisión F | S de escribir, L de sostener | bajo | que el % de prosa de 10 § 1.6 deje de subir en la próxima remedición |
| **M-16** | **Un `CLAUDE.md` vigente**: cada nota «el bloque de abajo queda como estaba escrito» se funde con su bloque, y el original queda en la D que lo cambió (y en git). Ver decisión C | S | medio: el `CLAUDE.md` es del dueño | −20 % del archivo, ~1.400 tokens por sesión |
| **M-17** | **Partir `AdminApp`, `EstadisticasPanel` y `PropuestasPanel` cuando se los toque**, no antes: el router de pantallas en un módulo, cada pestaña del tablero en su archivo | M c/u | bajo | ninguno pasa las 800 LOC |
| **M-18** | `slugify` con **una** fachada, no dos | S | nulo | un salto menos |

## 6 · Orden recomendado

1. **M-1 + M-2 + M-3** juntos: son el mismo archivo de config y el mismo
   objetivo, y los tres bajan el pre-push de ≈ 5 min a ≈ 2.
2. **M-6 y M-4**: los dos son chicos y los dos se sienten en todas las sesiones.
3. **M-5, M-7, M-8**: ahorro de lectura, sin tocar código de producción.
4. **M-9 → M-10**: primero el lado del build, después la UI, siempre con
   librerías como primera entidad.
5. El resto, cuando el frente que toca ese archivo pase por ahí.

## 7 · Decisiones del dueño

| # | Qué hay que decidir | Recomendación |
|---|---|---|
| **A** | ¿El MDD deja de cargarse en las sesiones de este repo? Hoy entra desde tu `~/.claude/CLAUDE.md` global y pesa 12.500 tokens por sesión, aunque acá está desactivado | **Sí.** Es el ahorro más grande del PRD y no toca el repo. Se hace en tu configuración de Claude Code, no en un commit |
| **B** | ¿La lista de ~150 rutas del `auditor-privacidad` sale de la `description`? Hoy va al prompt de cada sesión (1.170 tokens) y `auditores-que-corresponden.mjs` la lee de ahí | **Sí, a un bloque del cuerpo de la ficha**, que el script lea igual. La `description` queda en una frase con «salidas públicas» y los directorios clave. El riesgo es que Claude deje de despertarlo solo por nombre de archivo; con `/audit` a pedido (D-560) eso ya no es el mecanismo |
| **C** | ¿El `CLAUDE.md` pasa a decir lo vigente, con los originales en `06-decisiones.md` y en git? | **Sí**, para los cinco bloques con aviso. Si preferís conservar el original a la vista, la alternativa es moverlo a un apéndice al final del archivo, que ya ahorra lectura |
| **D** | ¿El deploy por contenido saltea la suite si el mismo commit ya pasó `push-main.yml`? | **Sí**, con la verificación del SHA fallando cerrada. Los tests no leen la base de producción; los chequeos que sí dependen del contenido están en «Verificar el artefacto» y siguen corriendo |
| **E** | ¿El paso de zona horaria (`TZ=Asia/Tokyo`) sigue en el pre-push? | **Sí, pero sobre el proyecto `unidad` y en paralelo** (M-2): baja de ~140 s a ~30 s y no pierde nada. Sacarlo del todo y dejarlo al CI (que corre en UTC, otra zona) también sería defendible, pero el pre-push es donde se ataja más barato |
| **F** | ¿Se adopta la regla de comentarios nuevos de M-15? | **Sí, solo hacia adelante.** B-78 sigue valiendo para lo que hay; lo que se propone es que la prosa nueva no cuente la historia que ya está en la D |

## 8 · El contra

- **Partir archivos cuesta lectura antes de ahorrarla.** Mientras dure la
  migración de M-9 o M-10 hay dos caminos para lo mismo. Por eso van de a una
  entidad y con fachada.
- **El paralelo va a destapar dependencias de orden** que hoy no se ven. Es
  bueno que aparezcan, pero la primera semana puede haber rojos que no son del
  cambio de nadie. M-1 incluye correr la suite cinco veces antes de cerrarlo.
- **Mover secciones de un documento rompe links.** `anclas-referenciadas` y
  `decisiones-referenciadas` lo agarran, así que el costo es arreglarlos en el
  mismo cambio, no descubrirlos después.

## 9 · Criterios de aceptación

1. `npx vitest run` termina en **≤ 45 s** en la máquina del dueño, con el mismo
   número de casos que antes, y pasa **cinco veces seguidas**.
2. `./scripts/verificar-todo.sh` termina en **≤ 2 min** con los emuladores
   bajados al arrancar.
3. Ningún test escribe dentro de `tests/` mientras corre.
4. El chunk inicial de `/admin` no incluye el texto de las novedades.
5. `docs/13-agentes.md` pesa **≤ 40 KB** y todos los tests que lo leían pasan.
6. Cada partición de un test conserva el conteo de casos (antes = después).
7. Ninguna propuesta cambió una salida pública: el barrido de salidas y el
   `auditor-privacidad` pasan sin cambios en su tabla.

## 10 · Cómo se remidió

Para que la próxima pasada compare contra lo mismo:

| Qué | Comando |
|---|---|
| Tamaño, concentración, ciclos, prosa por líneas | `node scripts/salud-del-codigo.mjs` |
| Suite y archivos lentos | `npx vitest run --reporter=json --outputFile=…` (tiempos por archivo = `endTime − startTime`) |
| Suite en paralelo | `npx vitest run --fileParallelism --exclude 'tests/**/*.integracion.test.ts'` |
| Tipos | `npx astro sync && npx tsc --noEmit` |
| Paso 5 y 6 del gate | `npx firebase emulators:exec --only firestore,storage … ./scripts/build-contra-emulador.mjs` y `./scripts/verificar-bundle.sh dist` |
| Bundle | cierre de imports estáticos desde los `<script>` de cada HTML de `dist/`, gzip nivel 6 |
| Duplicación | ventanas de 8 líneas significativas (sin comentarios, blancos ni imports) repetidas en otro archivo de `src/`, `functions/` o `scripts/` |
| Tokens | bytes ÷ 4 |

Los scripts de bundle, duplicación y prosa por bytes se escribieron para esta
pasada y no están en el repo. Si se va a remedir, conviene sumarlos a
`salud-del-codigo.mjs` en vez de reescribirlos.
