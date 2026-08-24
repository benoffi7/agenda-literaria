# Estado de pausa — Fase 4 · la red de contención

**Branch / worktree:** `worktree-agent-a771d078b00738a68`
(`.claude/worktrees/agent-a771d078b00738a68`), sobre `main`.

**Nada quedó roto ni a medias.** Todo está commiteado y verde. No se pusheó ni se
deployó nada, y el hook de pre-push **no** se activó (`core.hooksPath` es decisión
del dueño; el comando está documentado en el skill `antes-de-pushear`).

## Verificación

```
npx tsc --noEmit                  # 12 errores PREEXISTENTES de ImportMeta (B-169), ninguno mío
EXIGIR_EMULADOR=1 npx vitest run  # 34 archivos, todo verde, 0 skips
```

Los doce errores de `tsc` son de `src/lib/{analytics,firebase-client,version}.ts`
y son ruido conocido (faltan los tipos de `astro sync`). Están anotados como
B-169 justamente porque hacen que el comando de verificación salga siempre en
rojo y un error nuevo se esconda entre ellos.

## Ítems

| Ítem | Estado |
|---|---|
| **B-166 de la consigna = B-168 en el BACKLOG** · el detector apagado | ✅ **cerrado — volvió a `it`** |
| B-117 · `bundle-panel.test.ts` no cubre el tercer chunk | ✅ cerrado |
| B-50 · corte del bundle después de analytics | ✅ cerrado |
| B-119 · mapa trampa → test → archivo | ✅ cerrado |
| B-115 · ¿lo cierra el skill `antes-de-pushear`? | ✅ **sí** — marcado cerrado con su causa |
| B-34 · nada limita cuántos reportes se cargan | ⬜ **no hecho**, analizado y anotado (ver abajo) |
| Trampa 4 del §13 (`firebase-admin` al cliente) | ✅ cubierta — no tenía **ningún** test |
| B-08, B-78 | fuera de esta corrida a propósito (ver el plan) |

> **Numeración:** la consigna llamó "B-166" al detector apagado, pero ese número
> ya estaba tomado en el BACKLOG (la versión sin estampar). Se renumeró a
> **B-168**, y el ítem lo dice en su primera línea.

## B-166 / B-168 — el estado, que es lo que más importa

**El detector volvió a `it`. No queda ningún `it.skip` en
`tests/clases-de-bug.test.ts`.** El agujero por el que pasó B-82 está tapado: un
trigger nuevo con efecto duplicable y sin guarda de reentrega hace fallar el CI.

La causa era más grande de lo que decía el `it.skip`. B-77 mudó a helpers las dos
cosas que el detector buscaba en el cuerpo del trigger:

1. `guardarVersion` y `guardarVersionAlBorrar` dejaron de contar como triggers
   **con efecto** (su `.set()` se mudó a `guardar()`), así que no había dos
   blindados que contar y el test hubo que apagarlo;
2. `syncCalendar`, que **ya estaba blindado** (B-82 cerrado: `idDeEvento` dentro
   de `crearEvento`), seguía contándose como **desguarnecido**. O sea que el
   `it.fails` de B-82 seguía fallando mucho después de que el bug estaba
   arreglado, y nadie lo notó porque un `it.fails` que falla se ve exactamente
   como tiene que verse. **Un detector ciego también miente sobre lo que sigue
   roto.** Ese `it.fails` ahora es `it` y pasa.

Cómo quedó: el detector arma la **traza** del trigger expandiendo cada llamada a
una función declarada en `functions/**` (del mismo archivo o importada) y
clasifica en orden — `T` = `runTransaction(`, `E` = efecto que puede crear algo
nuevo. Se afinó qué es un efecto duplicable: crear algo cuya identidad elige el
receptor (`fetch`, `.insert`, `.add`, `.create`) o escribir en una dirección
**calculada** (`.doc(<expresión>).set`) sí; direccionar una identidad que ya
existe (`.update`, `.delete`) o escribir siempre en la misma dirección
(`.doc('literal').set`, o sea `marcarRebuild`) no. Sin esa distinción el detector
pedía guardas donde no hacían falta. Todo está en D-102.

Y se agregó lo que faltaba la primera vez: **nueve tests del propio detector**
contra cuerpos sintéticos con un resolver falso, incluida la regresión exacta
(un efecto que solo vive en un helper), más los controles positivo y negativo
sobre el repo real.

## El mapa trampa → test → archivo (B-119)

Está completo y verificado en [`../15-mapa-de-trampas.md`](../15-mapa-de-trampas.md).
`tests/mapa-de-trampas.test.ts` lo contrasta con el repo en cada corrida: lee la
lista de trampas del §13 del `CLAUDE.md` (no la copia), exige que cada test
citado **nombre** su trampa, y **calcula del repo** cuáles no tienen ninguno para
compararlo con lo que el documento declara, en las dos direcciones.

| # | Trampa (§13) | Test que la fija |
|---|---|---|
| 1 | Timestamps sin timezone | `tests/calendario.test.ts`, `tests/calendarioPanel.test.ts` |
| 2 | Ids de sesión por índice | `tests/sesiones.test.ts`, `tests/duplicar.test.ts` |
| 3 | Loop de escritura en la Function | `tests/calendario.test.ts`, `tests/costuras.test.ts`, `tests/reportes.test.ts` |
| 4 | `firebase-admin` en bundle cliente | `tests/bundle-panel.test.ts` — **cubierta en esta corrida** |
| 5 | Link de la reunión en lo público | `tests/toPublic.test.ts`, `tests/calendario.test.ts` |
| 6 | Taxonomías sin slugify | `tests/slugify.test.ts` |
| 7 | Query pública sin `where('estado','==','publicado')` | **— DESCUBIERTA — B-167** |
| 8 | Rebuild al cambiar `/opciones/*` | `tests/costuras.test.ts`, `tests/clases-de-bug.test.ts` |
| 9 | Cambio de sede que no propaga a las N sesiones | `tests/calendario.test.ts` |
| 10 | Slug mutable | `tests/schema.test.ts` |

### Las que estaban descubiertas

- **Trampa 4** — era la única de las diez sin **ningún** test, y la de peor
  consecuencia (la key de la service account en un artefacto público, §5.4).
  **Cerrada en esta corrida** con el recorrido del grafo de imports.
- **Trampa 7 — sigue descubierta. Es el pendiente principal del frente.**
  `tests/actividades.integracion.test.ts` prueba las reglas **por documento**;
  la trampa habla de la forma de la **query**: con `allow read` condicionado a
  `resource.data`, una query de colección sin el `where` se rechaza **entera**.
  Casi no muerde mientras el público lea el `events.json` estático (§2.5), y
  muerde justo el día de B-01.

## Siguiente acción concreta

1. **B-167 (trampa 7).** En `tests/actividades.integracion.test.ts`, agregar dos
   `it` al `describe` de reglas: uno que haga
   `getDocs(collection(db(), 'actividades'))` sin loguearse y espere que
   **rechace** (`rejects.toThrow()`), y otro que haga la misma query con
   `where('estado','==','publicado')` y espere que devuelva solo la publicada.
   Nombrar `trampa 7` en el `describe` — `tests/mapa-de-trampas.test.ts` lo
   exige, y al pasar hay que sacar la fila "sin red" del mapa (el test falla
   hasta que las dos cosas coincidan, a propósito).
   **Ese archivo no es de la fase 4**, así que va cuando su dueño lo libere.
2. **B-34.** Decidir con el dueño el tope de reportes por autor y por día, y
   ponerlo en `decidirAccion` de `functions/reportes.js` (no en las reglas: el
   reporte tiene que guardarse igual, lo que se limita es el issue). Es fase 1.
3. **B-169.** Meter un `astro sync` antes del `tsc` en
   `scripts/verificar-todo.sh` y en el CI, cuando los cuatro frentes dejen de
   correrlo a la vez.
4. **B-08** (tests de componentes) recién cuando cierre la fase 2, como dice el
   plan.

## Anotado en el BACKLOG sobre código ajeno

- **B-167** · la trampa 7 del §13 no tiene ningún test · P2 — toca
  `tests/actividades.integracion.test.ts`.
- **B-169** · `npx tsc --noEmit` sale con doce errores de `ImportMeta` · P3 —
  toca `scripts/verificar-todo.sh` y el CI, que los cuatro frentes usan ahora.
- **B-34** · quedó abierto con las dos formas posibles del límite escritas y el
  motivo de no haberlo hecho — toca `functions/**` o `firestore.rules`.

Ninguno se arregló: son de otros frentes.

## Decisiones nuevas

- **D-100** · Un chequeo estructural pregunta por el grafo, no por un archivo —
  con su contracara obligatoria: el control positivo que impide el verde vacío.
- **D-101** · El mapa de trampas se verifica contra el repo, no se lee.
- **D-102** · Un detector estático sigue la llamada, y se testea con cuerpos
  sintéticos. `Extract Function` es el refactor más común que existe.

## Commits del frente

```
Fase 4: estado de pausa con el diagnostico de B-166
B-166: el detector de triggers blindados sigue la llamada, y vuelve a estar prendido
B-117 y B-50: el corte del bundle se cuida siguiendo el grafo, no una lista de nombres
Trampa 4 del CLAUDE.md: cubrir que firebase-admin no llegue al cliente
B-119: el mapa trampa -> test -> archivo, y se verifica solo
Documentar la fase 4: CHANGELOG, tres decisiones y el backlog al dia
```

## Archivos que tocó este frente

Solo los suyos, más los tres documentos compartidos:

- `tests/clases-de-bug.test.ts`, `tests/bundle-panel.test.ts` (reescrito),
  `tests/mapa-de-trampas.test.ts` (nuevo)
- `docs/15-mapa-de-trampas.md` (nuevo), `docs/README.md` (una línea del índice)
- `docs/CHANGELOG.md`, `docs/BACKLOG.md`, `docs/06-decisiones.md`

**No** se tocó `docs/14-plan-de-saneamiento.md`, ni `docs/ESTADO-PAUSA.md`, ni
ningún archivo de la fase 2, 3A o 3B, ni ningún test de esos módulos, ni
`functions/**`.
