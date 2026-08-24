# Estado de pausa — Fase 4 · la red de contención

**Branch / worktree:** `worktree-agent-a771d078b00738a68`
(`.claude/worktrees/agent-a771d078b00738a68`), sobre `main`.

**Nada fue pusheado ni deployado.** El hook de pre-push **no** se activó
(`core.hooksPath` es decisión del dueño).

> ⚠️ **Estado al momento de escribir esto:** todavía no hay ningún ítem cerrado.
> Lo único firme es el **diagnóstico de B-166**, que está abajo y es correcto
> (verificado con una sonda). Este archivo se actualiza en cada commit.

## Verificación

```
npx tsc --noEmit
EXIGIR_EMULADOR=1 npx vitest run
```

## Ítems

| Ítem | Estado |
|---|---|
| B-166 · rehacer el detector de triggers blindados | en curso |
| B-117 · `bundle-panel.test.ts` sin el tercer chunk | pendiente |
| B-50 · corte del bundle después de analytics | pendiente |
| B-119 · mapa trampa → test → archivo | pendiente |
| B-34 · nada limita cuántos reportes se cargan | pendiente |
| B-115 · ¿lo cierra el skill `antes-de-pushear`? | pendiente |
| B-08, B-78 | **fuera de esta corrida** a propósito (ver el plan) |

## B-166 — el diagnóstico, que es lo que vale si me cortan acá

`tests/clases-de-bug.test.ts` tiene apagado
`it.skip('hay triggers con efecto duplicable y hay al menos dos ya blindados')`.
**Mientras siga apagado, un trigger nuevo sin guarda de reentrega entra sin que
nada lo frene** — el agujero por el que pasó B-82.

La causa es más grande de lo que decía el `it.skip`. Son **dos** detectores
roídos por el mismo refactor (B-77 movió efecto y guarda a helpers):

1. **`tieneEfectoDuplicable`** busca el efecto en el cuerpo del trigger.
   `guardarVersion` y `guardarVersionAlBorrar` ya no escriben ahí: llaman al
   helper `guardar` de `functions/historial-trigger.js`, que es el que hace
   `versiones.doc(version).set(...)`. Los dos triggers pasaron a contarse como
   **sin efecto**, y por eso `blindados.length >= 2` no se cumple.
2. **`tieneGuardaDeReentrega`** busca la guarda en el cuerpo del trigger.
   `syncCalendar` **ya está blindado** (B-82 cerrado: `crearEvento` elige el id
   del evento con `idDeEvento(op.id)` y un `insert` repetido da 409), pero
   `idDeEvento(` vive en el helper `crearEvento`, no en el trigger. El detector
   lo sigue dando por desguarnecido → `it.fails('B-82: ningún trigger...')`
   sigue "pasando" porque falla. **Es una falsa alarma: la clase está cerrada.**

Sonda que lo demuestra:

```
cuerpo de guardarVersion: ¿.set(?   false   ← el efecto se fue a `guardar`
cuerpo de syncCalendar:   ¿idDeX(?  false   ← la guarda se fue a `crearEvento`
```

**El arreglo: que el detector siga la llamada.** Armar la traza del trigger
expandiendo cada llamada a una función declarada en `functions/**` (del mismo
archivo o importada), y clasificar en el orden en que ocurre:

- `T` = `runTransaction(` (reclamo de estado antes del efecto)
- `E` = efecto que crea algo nuevo: `fetch(`, `.insert(`/`.add(`/`.create(`, y
  `.doc(<expresión>).set(` — **no** `.update(`/`.delete(`/`.patch(`, que
  direccionan una identidad que ya existe, ni `.doc('literal').set(`, que
  escribe siempre en la misma dirección (por eso `marcarRebuild` no es efecto
  duplicable, y `rebuildPorOpciones` deja de ser un falso positivo).

Con eso: duplicables = `syncCalendar`, `reporteAIssue`, `guardarVersion`,
`guardarVersionAlBorrar`; blindados = los cuatro; `sinGuarda` = vacío →
**el `it.fails` de B-82 hay que promoverlo a `it`** (regla 2 del plan).

## Siguiente acción concreta

1. En `tests/clases-de-bug.test.ts`, reemplazar `tieneEfectoDuplicable` y
   `tieneGuardaDeReentrega` por la traza que sigue la llamada (arriba), sacarle
   el `.skip` al test de blindados y el `.fails` al de B-82.
2. Agregar tests **sintéticos del detector** con un resolver falso (cuerpos
   inventados): que `.update(` no sea efecto, que `.doc('literal').set(` no lo
   sea, que `.doc(v).set(` sí, y que **un efecto que solo vive en un helper se
   detecte** — ese último es la regresión de B-166 y sin él el arreglo se vuelve
   a apagar solo.
3. Recién después: B-117, B-50, B-119, B-34, B-115.

## El mapa trampa → test → archivo (B-119)

Sin empezar. Las diez trampas están en `CLAUDE.md` §13.

## Anotado en el BACKLOG sobre código ajeno

Nada todavía.

## Decisiones nuevas (D-xx)

Ninguna todavía.
