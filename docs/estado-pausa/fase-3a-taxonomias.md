# Estado de pausa — Fase 3A · Taxonomías

**Frente:** Fase 3A del [plan de saneamiento](../14-plan-de-saneamiento.md) —
taxonomías autogestionadas (§4 del `CLAUDE.md`).
**Branch / worktree:** `worktree-agent-a078571e0a846a53d`, en
`.claude/worktrees/agent-a078571e0a846a53d`.
**Última actualización:** 2026-08-24.

## ¿Hay algo roto?

No. `npx tsc --noEmit` limpio, `npx vitest run` en verde (710 tests, 1 skip),
`npm run build` OK y `./scripts/verificar-bundle.sh dist` limpio.

Dos avisos, ninguno bloqueante:

> Si `tsc` tira decenas de `Property 'env' does not exist on type 'ImportMeta'`
> en `analytics.ts` / `firebase-client.ts` / `version.ts`, **no es de este
> frente**: falta correr `npx astro sync` una vez en el worktree para que
> existan los tipos de Astro. Después queda limpio.

> Los tres tests de `tests/opciones.integracion.test.ts` que ejecutan
> `scripts/aprobar-opciones.mjs` fallaron **una vez** en una corrida completa y
> pasaron solos y en las dos corridas siguientes. Flaky, no roto; anotado como
> **B-169**. Se ve corriendo `npx vitest run` varias veces seguidas.

## Archivos de este frente

Propiedad exclusiva: `src/lib/opciones.ts`, `src/lib/taxonomia.ts` (nuevo),
`src/components/admin/campos/TaxonomiaSelect.tsx`,
`src/components/admin/campos/TagsInput.tsx`,
`src/components/admin/useOpciones.ts`,
`src/components/admin/taxonomias/TaxonomiasPanel.tsx` (nuevo) y sus tests
(`tests/taxonomia.test.ts` nuevo, `tests/opciones*.test.ts`).

**No se tocó** (frentes en paralelo): `ActividadFormulario.tsx` (fase 2),
`ListaActividades.tsx` / `AdminApp.tsx` / `ReportesPanel.tsx` / el centro de
ayuda (3B), `functions/**`, `docs/14-plan-de-saneamiento.md`,
`src/lib/novedades.ts` y `src/lib/ayuda.ts` (ver B-170).

## Ítem por ítem

| Ítem | Estado |
|---|---|
| **B-72** · la dedup del §4.2 estaba dos veces | **cerrado.** `src/lib/taxonomia.ts` + los dos componentes llamándolo + `tests/taxonomia.test.ts` (27 tests, con guardia anti-recaída). D-100. |
| **B-86** · `usos` solo cuenta creaciones | **parcial, a propósito.** `registrarUsos` hecha y testeada (D-103); el cableado es una línea en `guardar()`, de otro frente → **B-168**. |
| **B-05** · etiquetas sin normalizar en público | **cerrado.** `etiquetaPresentable` en `upsertOpcion` (D-101). |
| **B-06** · UI para administrar taxonomías | **cerrado en código, SIN MONTAR** → **B-170**. D-102. |
| **B-25** · aprobar desde el panel | **cerrado** (botón en la pantalla, `aprobarOpcion` transaccional). Sin montar, igual que B-06. |
| **B-26** · avisar que hay algo para aprobar | **cerrado a medias**: el contador está en la pantalla y `usePendientesDeAprobacion()` queda listo para la cabecera, que es de 3B → B-170. |
| **B-73** · los tags no se miden | **cerrado.** D-105. |
| **B-131** · las opciones nuevas nacen aprobadas | **cerrado.** D-104. No estaba en la tabla del plan; es de este archivo y estaba decidido por el dueño. |

Commits: `3edbb94` (lib), `c1ee948` (B-72 + B-73), `1208e6f` (pantalla + doc), y
este.

## Lo que queda, en orden

1. **B-170 — montar la pantalla** (frente 3B, `AdminApp.tsx`). Todo lo que hay
   que hacer está escrito en el ítem del backlog: tipo `Vista`, `lazy(...)`
   **diferido** (un import estático deshace el corte del bundle B-09/D-51),
   botón en la cabecera, contador con `usePendientesDeAprobacion()`. Y con eso,
   la entrada en `src/lib/novedades.ts` y el capítulo en `src/lib/ayuda.ts`, que
   no se escribieron antes porque anunciar una pantalla que no se puede abrir es
   peor que no anunciarla. **Mientras no se monte, el componente ni siquiera
   entra al build** (no lo referencia nadie).
2. **B-168 — cablear `registrarUsos`** (frente fase 2, dentro de B-70/B-71). El
   orden exacto está en el ítem: actividad → `upsertOpcion` de las nuevas →
   `registrarUsos` con las elegidas **menos** las recién creadas.
3. **B-169 — el flaky**, cuando moleste.

## Decisiones nuevas

`D-100` a `D-105` en [`06-decisiones.md`](../06-decisiones.md): el módulo puro y
por qué los widgets no se unifican; la etiqueta presentable vs. el slug; las tres
reglas de la pantalla; `registrarUsos`; el default de aprobación dormido; y qué
se mide de los tags y qué no.

## Lo que descubrí y conviene saber

- **B-86 no se podía cerrar desde acá.** El backlog lo describe como "una línea
  en `guardar()`" y lo es, pero esa línea vive en un archivo de otro frente.
- **B-131 cambia qué significan B-25 y B-26.** Con las opciones naciendo
  aprobadas no hay nada pendiente que aprobar: la pantalla y el contador se
  construyeron igual —la decisión del dueño es explícitamente "dejar la
  maquinaria dormida, no borrarla"— pero hoy solo alcanzan a lo que quedó
  pendiente antes de la decisión.
- **Voltear el default rompió 4 tests de integración** que fabricaban la
  pendiente con `upsertOpcion`. Se los adaptó con `volverPendiente()`, que la
  pone pendiente a mano: la maquinaria sigue probada de punta a punta con el
  script real, que es lo que B-131 pedía conservar.
- **El bundle no se movió**: la carga inicial de `/admin` sigue en los mismos dos
  chunks (`client` + `AdminApp`, ~380 kB), porque nada nuevo se importa de forma
  estática y la pantalla todavía no se referencia.
- **B-28 y B-29 siguen siendo decisiones del dueño** y no se tocaron. B-29 queda
  sin efecto práctico mientras B-131 esté vigente.
- **B-129 (el tipo «feria» como opción base) no se tocó**: es de
  `opciones-base.json` pero arrastra reglas condicionales del formulario, que es
  de otro frente.

## Verificación

```bash
npx tsc --noEmit
npx vitest run
npm run build && ./scripts/verificar-bundle.sh dist
npx vitest run tests/bundle-panel.test.ts   # la alarma barata del corte B-09
```
