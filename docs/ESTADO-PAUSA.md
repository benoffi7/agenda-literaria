# Estado al pausar — 2026-08-24 (noche)

**Primera instrucción al retomar: leer este archivo, y después el archivo de cada
frente que siga abierto.** Este documento existe para no reconstruir el contexto;
**se borra cuando todos los frentes cierran.**

## `main`

**736 tests en verde, sin un solo `it.skip`**, typecheck y build limpios, `dist/` sin rastros del Admin
SDK. Un solo working-tree además de los worktrees de los agentes.

Nada pusheado: el repo remoto sigue vacío y el dueño lo quiere **privado antes
del primer push**.

**La fase 1 del [plan de saneamiento](14-plan-de-saneamiento.md) está cerrada e
integrada** — 1A, 1B y 1C. Los worktrees de esa fase se borraron con sus branches
después de verificar que no tenían nada sin commitear.

Lo último que se hizo en `main`, y que conviene saber antes de tocar los
chequeos estructurales: el refactor de B-77 partió `functions/index.js` en
módulos y dejó a los tests que **leen el fuente** midiendo el vacío (verdes, sin
probar nada). Está contado en el [CHANGELOG](CHANGELOG.md) de hoy. La moraleja
operativa: **un chequeo que enumera nombres se queda viejo solo**, y uno que
depende de dónde están las cosas hay que revisarlo cuando las cosas se mueven.

## Los cuatro frentes abiertos

Corren en paralelo, cada uno en su worktree, y **no comparten un solo archivo**
— es el criterio del plan: se reparte por archivo, no por tema. Cada uno dejó su
propio estado de pausa (archivos separados a propósito: cuatro frentes editando
un mismo documento son cuatro conflictos mañana, justo en el archivo que existe
para no perder tiempo).

| Frente | Ítems | Su estado de pausa |
|---|---|---|
| **Fase 2 · formulario** | B-70 primero, después B-71, B-87, B-90, y B-79 último | [`estado-pausa/fase-2-formulario.md`](estado-pausa/fase-2-formulario.md) |
| ~~**Fase 3A · taxonomías**~~ | ✅ **mergeada en `main`** — B-72, B-05, B-06, B-25, B-26, B-73, B-131. Su [estado de pausa](estado-pausa/fase-3a-taxonomias.md) queda como registro | — |
| **Fase 3B · listado y panel** | B-76, B-96, B-31, B-40, B-35, B-14, B-64 | [`estado-pausa/fase-3b-listado.md`](estado-pausa/fase-3b-listado.md) |
| ~~**Fase 4 · red de contención**~~ | ✅ **mergeada en `main`** — B-171, B-117, B-50, B-119, B-115. B-34 no entró (la forma del límite es una decisión). Su [estado de pausa](estado-pausa/fase-4-contencion.md) queda como registro | — |

Si falta alguno de esos archivos, ese frente se cortó antes de escribirlo: mirá
sus commits con `git log --oneline main..<su-branch>`.

**Dos ítems quedaron fuera de esta corrida a propósito**, y no por olvido: **B-62**
(ayuda contextual por sección) y **B-08** (tests de componentes) necesitan el
formulario ya partido, o sea la fase 2 terminada. **B-78** tampoco entró: cruza
los tres frentes.

**Una frontera anotada:** 3A construye la pantalla de administración de
taxonomías (B-06) pero el router vive en `AdminApp.tsx`, que es de 3B. El
componente queda autocontenido y **sin montar**, con la dependencia en el
backlog.

## Al retomar

1. **Leer el estado de pausa de cada frente antes de mergear nada.** Cada uno
   tiene su "siguiente acción concreta" en imperativo.
2. **Verificar cada rama por separado**: `npx tsc --noEmit`, `EXIGIR_EMULADOR=1
   npx vitest run`, `npm run build`, `./scripts/verificar-bundle.sh dist`. Los
   commits que empiecen con `WIP:` **no están verificados** y son lo primero a
   revisar.
3. **3A y 4 ya están mergeadas.** Del resto, **3B antes que 2**, porque la 2 mueve más código. La fase 4 toca `tests/` y
   `scripts/`, así que entra sin roce y deja los chequeos nuevos ya puestos para
   los otros tres. La fase 2 va última porque es la que mueve más código.
   Conflictos esperables: `docs/BACKLOG.md` y `docs/CHANGELOG.md`, y son
   aditivos.
4. **En markdown se puede resolver conservando los dos lados; en código NO.** Esa
   resolución automática ya rompió dos archivos en este repo: se comió el cierre
   de un `describe` (y vitest reportó 212 verdes habiendo colectado menos tests,
   así que el verde no lo detectó — lo agarró `tsc`) y partió literales de objeto
   en `src/lib/novedades.ts`.
5. **Los `it.fails` son el semáforo.** Un `it.fails` que **pasa** falla el CI a
   propósito: significa que el bug quedó arreglado y hay que promoverlo a `it`.
   Hoy `tests/costuras.test.ts` no tiene ninguno —los seis se promovieron— y en
   `tests/clases-de-bug.test.ts` quedan cinco vivos.
6. **Ya no hay tests apagados.** El detector de guardas volvió a `it` (B-171) y
   la suite no tiene un solo `it.skip`. Si aparece uno, tiene que traer su
   número de backlog al lado.
7. **Corré la suite con `EXIGIR_EMULADOR=1`** para que los 33 tests de
   integración **fallen** en vez de saltearse en silencio. Los emuladores se
   cayeron cuatro veces en la sesión anterior por el harness, no por el
   proyecto.
8. **Verificá el corte del bundle** (`npx vitest run tests/bundle-panel.test.ts`).
   Importar `db` desde `firebase-client` en lugar de `firestore-client` deshace el
   corte de B-09/D-51 **en silencio**, y ese error ya apareció tres veces. Los
   tres frentes de `src/` tocaron imports del panel.

## Prohibido, hasta que el dueño diga

- **Deployar** (`firebase deploy`, mutaciones de `gcloud`).
- **Pushear.** El repo es público y el dueño lo quiere privado antes del primer
  push.
- **`git stash`**: se comparte entre worktrees y ya se comió trabajo de un agente.
- **Activar el hook de git** con `git config core.hooksPath`. El comando está
  documentado; correrlo es decisión del dueño.

## Pendiente de acción manual del dueño

- **Rotar el PAT de GitHub.** Se encontró un secret cuyo *nombre era el token* y
  se borró a pedido del dueño; borrar el secret **no revoca el token**.
- **Hacer el repo privado** antes del primer push.
- **B-20** — rehacer las credenciales de CI para el rebuild automático.
- **B-33** — crear las etiquetas del repo. **B-116**, **B-123**.

## Llegó mientras se trabajaba

**Feature nueva pedida hoy: [B-167] galería de imágenes** — una lista de imágenes
por actividad, con descripción opcional, cada una URL externa o alojada por
nosotros, más vista previa al pegar la URL. Anotada con las implicaciones
enumeradas: entra **Firebase Storage** (producto nuevo, `storage.rules` propio, y
un target de deploy que `scripts/que-deployar.sh` no conoce), el modelo pasa de un
campo a una lista con su migración, y aparecen dos riesgos que no estaban en el
§5: **EXIF con GPS** (muchos talleres se dan en casas particulares) y **SVG como
documento ejecutable**. Va en P1 por orden y no por urgencia: B-107 necesita
exactamente una imagen, así que si la galería entra después del sitio público, se
rehace el sitio público. **Bloqueada por DEC-7**, cuatro decisiones del dueño — la
que más pesa es si la descripción es *epígrafe* o *texto alternativo*, que no es
cosmético.

**[Issue #4](https://github.com/benoffi7/agenda-literaria/issues/4)** — el primer
reporte real cargado desde el panel: falta «Feria» en los tipos de actividad.
Anotado como **B-129**. Decisión tomada: va como opción base; falta decidir qué
reglas condicionales del §11 le corresponden (probablemente ciclo, porque una
feria suele ser de varios días).

**B-130** — el listado no dice quién cargó cada actividad. `createdBy` se guarda y
nunca se lee. Ojo con el punto 2 del ítem: si se resuelve guardando el mail en el
documento, `toPublic` lo tiene que descartar explícitamente o se filtra al
`events.json` (§5.1).

**B-131** — las opciones creadas con «Otro» **nacen aprobadas**, y la maquinaria de
aprobación **se deja dormida** para cuando haya más admins y más tags: voltear el
default, comentar por qué está así, y un test que lo fije, para que no se dé
vuelta solo ni alguien la borre por parecer código sin uso. B-25, B-26, B-28 y
B-29 quedan en espera de ese momento, no descartados.

**Los tres reportes del dueño usando el panel de verdad**, todos confirmados en el
código: **B-132** (el desplegable muestra el slug crudo, `villa-crespo (nueva)`),
**B-133** (el campo «arrobar» se come la coma, así que no se puede cargar un
segundo handle: está modelado como string y es una lista — la salida es reusar
`TagsInput`), **B-134** (los tipos y las entregas de material son enums cerrados;
el pedido concreto es agregar «durante el mes», con la decisión de fondo de si
`material.items[].tipo` pasa a taxonomía abierta como el resto). Los tres caen en
archivos que los frentes 2 y 3A están tocando ahora, así que **se resuelven
después de mergear**, no en paralelo.

## Lo que sigue cuando los frentes cierren

1. **B-170 · montar la pantalla de taxonomías en el router.** Está construida y
   funciona, pero no se puede abrir: `AdminApp.tsx` es del frente 3B. Va apenas
   3B esté mergeada, y con ella la novedad y el capítulo de ayuda, que 3A dejó
   sin escribir a propósito —anunciar una pantalla que no se puede abrir es
   mentir. **B-168** es su par: cablear `registrarUsos` en `guardar()`, que es del
   frente 2.
2. Los reportes de uso real: B-129, B-130, B-131, B-132, B-133, B-134.
3. **La actualización completa de la documentación**, que el dueño pidió
   explícitamente, incluida la reescritura de
   [`10-salud-del-codigo.md`](10-salud-del-codigo.md) con las mediciones
   **post-refactor** (las de hoy son de antes de las fases 2 y 3).
4. **Borrar este archivo y `docs/estado-pausa/`.** Dejarlos es documentación que
   miente.
