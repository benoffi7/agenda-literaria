# Estado al pausar — 2026-08-24

La fase 1 del [plan de saneamiento](14-plan-de-saneamiento.md) quedó a medias.
Este archivo existe para retomar sin reconstruir el contexto; **se borra al
retomar**.

## `main`

585 tests en verde, typecheck y build limpios, `dist/` sin rastros del Admin SDK.
Nada pusheado: el repo remoto sigue vacío y el dueño lo quiere privado antes del
primer push.

Última fase completa: **1B** (B-84 — la numeración del ciclo ya no renumera al
cancelar un encuentro).

## Trabajo detenido, preservado en ramas

Ninguna está mergeada. Cada una tiene sus commits más, si hacía falta, un `WIP:`
final que hice yo al detener al agente para no perder nada — **ese commit no
está verificado y puede estar a mitad de un cambio**.

| Rama | Frente | Dónde quedó |
|---|---|---|
| `worktree-agent-aadc8e0b94827a328` | **1A · Cloud Functions** | 4 commits + WIP. Estaba escribiendo el cierre (changelog, backlog, novedades) de B-04 y B-41 |
| `worktree-agent-a32198e8d3ecb560a` | **1C · analítica y versión** | 3 commits, árbol limpio. Estaba arrancando el procedimiento de cierre |
| `worktree-agent-ae82a8e9969cec025` | **prevención de clases de bug** | 4 commits + WIP. Estaba por actualizar los auditores, empezando por `auditor-trampas` |

## Al retomar

1. Verificar cada rama por separado antes de mergear: `npm test`, `npx tsc
   --noEmit`, `npm run build`. El commit `WIP:` es lo primero a revisar.
2. Mergear en orden **1A → 1C → prevención**: 1A toca `functions/**`, 1C toca
   `src/lib/analytics*`, y prevención toca `tests/` nuevos y `.claude/` — los
   conflictos esperables son solo en `docs/BACKLOG.md` y `docs/CHANGELOG.md`, y
   son aditivos.
3. **Los `it.fails` de `tests/costuras.test.ts` son el semáforo.** Quedan siete:
   B-80, B-82, B-83 (×2) y B-85 son de 1A; B-88 (×2) es de 1C. Un `it.fails` que
   pasa **falla el CI**, así que si al mergear alguno se pone en rojo, es que el
   bug quedó arreglado y hay que promoverlo a `it`.
4. Los emuladores se cayeron tres veces en la sesión anterior. Corré la suite con
   `EXIGIR_EMULADOR=1` para que los 33 tests de integración **fallen** en vez de
   saltearse en silencio.

## Lo que sigue después de la fase 1

Fases 2, 3 y 4 del plan, y al cierre la actualización completa de la
documentación. Pendiente de decisión del dueño: los ítems marcados como tales en
el [backlog](BACKLOG.md).
