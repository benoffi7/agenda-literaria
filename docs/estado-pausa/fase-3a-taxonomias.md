# Estado de pausa — Fase 3A · Taxonomías

**Frente:** Fase 3A del [plan de saneamiento](../14-plan-de-saneamiento.md) —
taxonomías autogestionadas (§4 del `CLAUDE.md`).
**Branch / worktree:** `worktree-agent-a078571e0a846a53d`, en
`.claude/worktrees/agent-a078571e0a846a53d`.
**Última actualización:** 2026-08-24.

## ¿Hay algo roto?

No. `npx tsc --noEmit` limpio y `npx vitest run` en verde (683 tests, 1 skip)
al momento de escribir esto.

> Si `tsc` tira decenas de `Property 'env' does not exist on type 'ImportMeta'`
> en `analytics.ts` / `firebase-client.ts` / `version.ts`, **no es de este
> frente**: falta correr `npx astro sync` una vez en el worktree para que
> existan los tipos de Astro. Después queda limpio.

## Archivos de este frente

Propiedad exclusiva: `src/lib/opciones.ts`, `src/lib/taxonomia.ts` (nuevo),
`src/components/admin/campos/TaxonomiaSelect.tsx`,
`src/components/admin/campos/TagsInput.tsx`,
`src/components/admin/useOpciones.ts`,
`src/components/admin/taxonomias/**` (nuevo, B-06) y sus tests.

**No tocar** (frentes en paralelo): `ActividadFormulario.tsx` (fase 2),
`ListaActividades.tsx` / `AdminApp.tsx` / `ReportesPanel.tsx` / centro de ayuda
(3B), `functions/**` (cerrado), `docs/14-plan-de-saneamiento.md` (lo integra el
coordinador).

## Ítem por ítem

| Ítem | Estado |
|---|---|
| **B-72** · la dedup del §4.2 estaba dos veces | **parcial, commiteado.** El módulo puro existe (`src/lib/taxonomia.ts`) con `sugerenciasPara`, `resolverEtiqueta`, `pistaDeOpcion`, `etiquetaConEstado`, `etiquetaPresentable` + los tres predicados mudados de `opciones.ts`. **Falta que los dos componentes lo usen** y falta `tests/taxonomia.test.ts`. |
| **B-86** · `usos` solo cuenta creaciones | **la mitad que me toca, commiteada.** `registrarUsos(campo, slugs)` en `opciones.ts`, una transacción por campo, ignora slugs que no existen, dedupe interno. **El cableado va en `guardar()` de `ActividadFormulario.tsx`, que NO es de este frente** → anotado como dependencia (ver abajo). |
| **B-05** · etiquetas sin normalizar en público | **hecho, commiteado.** `etiquetaPresentable` (trim + colapsar espacios + primera letra en mayúscula) aplicada en `upsertOpcion`. Lo que ya está cargado mal (`narrativa`) se arregla renombrando desde la pantalla de B-06. |
| **B-06** · UI para administrar taxonomías | **no empezado.** Las escrituras ya están: `renombrarOpcion`, `borrarOpcion`, `aprobarOpcion` en `opciones.ts`, con la guarda de `fijo` (§4.3) centralizada en `editarValor`. Falta el componente. |
| **B-25** · aprobar desde el panel | **no empezado** (la escritura `aprobarOpcion` ya está). Depende de B-06. |
| **B-26** · avisar que hay algo para aprobar | **no empezado.** Depende de B-06 y del header, que es de 3B. |
| **B-73** · los tags no se miden | **no empezado.** Sale con B-72, cuando los puntos de medición queden compartidos. |
| **B-131** · las opciones nuevas nacen aprobadas | **hecho, commiteado** (no estaba en la tabla del plan; es de este archivo y estaba decidido por el dueño el 2026-08-24). Ver abajo. |

Commiteado hasta ahora: `3edbb94`.

## Dónde quedé exactamente

En `src/lib/taxonomia.ts` está todo lo que hace falta y **nadie lo llama
todavía**: `TaxonomiaSelect.tsx` y `TagsInput.tsx` siguen con sus dos copias del
filtro de sugerencias y de la resolución por slug. Eso es el corazón de B-72.

### Siguiente acción concreta

1. En `src/components/admin/campos/TaxonomiaSelect.tsx`, reemplazar el `useMemo`
   de `sugerencias` por
   `sugerenciasPara(texto, elegibles, { mostrarConTextoVacio: true })`, y el par
   `slugTipeado` / `coincidencia` por `resolverEtiqueta(texto, valores)`. Usar
   `pistaDeOpcion(v)` en el `<span>` de la derecha de cada sugerencia y
   `etiquetaConEstado(v)` en los `<option>`. Importar de `@/lib/taxonomia`.
2. En `src/components/admin/campos/TagsInput.tsx`, lo mismo con
   `sugerenciasPara(texto, elegibles, { excluir: value })` (sin
   `mostrarConTextoVacio`: el input está siempre visible y una lista desplegada
   sin texto tapa el formulario) y `resolverEtiqueta` en `confirmar()`.
3. Escribir `tests/taxonomia.test.ts`: dedupe por slug con las cuatro variantes
   de "a la gorra" del §4.2, autocompletado sin acentos ("poesia" encuentra
   "Poesía"), tope, `excluir`, `mostrarConTextoVacio`, `etiquetaPresentable`
   ("narrativa" → "Narrativa", "Villa  Crespo" → "Villa Crespo", y que NO baje
   el resto: "Google Meet" queda igual).
4. **B-73, en el mismo paso 2**: agregar en `TagsInput` las llamadas a
   `medirFuncion` que hoy solo tiene `TaxonomiaSelect` —
   `medirFuncion('taxonomia-nueva' | 'taxonomia-reusada', 'tags')` en
   `confirmar()` y `medirFuncion('taxonomia-sugerencia', 'tags')` al tocar una
   sugerencia. `'taxonomia-otro'` **no** aplica a tags: no hay modo "Otro" que
   abrir, el input es siempre el de tipear. Anotarlo en `docs/09-analitica.md`.
5. Después, B-06: crear
   `src/components/admin/taxonomias/TaxonomiasPanel.tsx` (ver abajo).

## B-06 — cómo montar la pantalla (importa)

Cuando el componente exista, va a quedar **creado y sin montar**: colgarlo del
router del panel es editar `src/components/admin/AdminApp.tsx`, que es del
frente 3B. Lo que hay que hacer ahí, cuando 3B lo tome (**B-167**, anotado en el
backlog):

- agregar `{ tipo: 'taxonomias' }` al tipo `Vista`,
- un `lazy(() => import('@/components/admin/taxonomias/TaxonomiasPanel'))`,
  diferido como las otras cuatro vistas (el corte del bundle de B-09/D-51: nada
  de esto se importa estático),
- un botón en la cabecera, al lado del de reportes,
- y el contador de pendientes de B-26 en la cabecera, con el hook que este
  frente deja listo en `useOpciones.ts`.

El componente tiene que quedar **autocontenido**: recibe el `uid` por prop y no
depende de nada del router.

## Lo que descubrí y no estaba en la doc

- **B-86 no es "una línea en `guardar()`" desde este frente.** El backlog lo
  describe como una línea, y lo es — pero la línea vive en un archivo de otro
  frente. Lo que se puede hacer acá es la operación (`registrarUsos`) y dejar el
  cableado anotado. El orden correcto en `guardar()` es: escribir la actividad →
  `upsertOpcion` de las etiquetas nuevas → `registrarUsos` con los slugs
  elegidos **menos** los que se acaban de crear (nacen con `usos: 1`; sumarlos
  otra vez los deja en 2). Eso engancha con la inversión de orden de B-71.
- **B-131 cambia qué significan B-25 y B-26.** Con las opciones naciendo
  aprobadas, no hay nada pendiente que aprobar ni de qué avisar: la pantalla y
  el contador se construyen igual —la decisión del dueño es explícitamente
  "dejar la maquinaria dormida, no borrarla"— pero hoy el contador va a mostrar
  0 salvo por las opciones que quedaron pendientes en producción antes de la
  decisión. Está dicho en el código y en los tests.
- **Voltear el default rompió 4 tests de integración de aprobación**, porque
  fabricaban la opción pendiente llamando a `upsertOpcion`. Se los adaptó con un
  helper `volverPendiente()` que la pone pendiente a mano: la maquinaria sigue
  probada de punta a punta con el script real, que es lo que B-131 pedía
  conservar.
- **`etiquetaPresentable` solo toca la primera letra.** Bajar el resto rompería
  "Villa Crespo" y "Google Meet"; subir cada palabra rompería "Club de lectura".
- **B-28 y B-29 siguen siendo decisiones del dueño** y no se tocaron. B-29
  (auto-aprobar una etiqueta que reusa la segunda cuenta) queda de hecho sin
  efecto mientras B-131 esté vigente.

## Verificación antes de cada commit

```bash
npx tsc --noEmit
npx vitest run
```

Y al cerrar el frente, además: `npm run build` y `./scripts/verificar-bundle.sh dist`
(el corte del bundle de B-09: `npx vitest run tests/bundle-panel.test.ts` es la
alarma barata).
