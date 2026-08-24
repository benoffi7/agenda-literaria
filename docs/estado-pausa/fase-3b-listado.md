> ## ⚠️ Leé esto primero: el frente no cerró solo
>
> **La máquina se durmió** a mitad de la respuesta del agente. Lo que sigue lo
> escribió él **antes**, así que describe el estado hasta ahí y no menciona lo
> último.
>
> **Branch:** `worktree-agent-a896145367cd860c8` · 8 commits.
>
> El último commit es un **rescate que hizo el orquestador**, no el agente:
> `WIP: rescate — el agente murió montando B-40 en el router`. Contiene todo lo
> que había sin commitear, incluidos dos archivos que no estaban trackeados y se
> habrían perdido: `src/components/admin/HistorialActividad.tsx` (la vista de
> versiones, B-40) y `src/lib/historial.ts`.
>
> **Ese commit NO está verificado.** Y tocó `astro.config.mjs`, `tsconfig.json` y
> `vitest.config.ts` —seguramente un alias nuevo—, así que **si el alias quedó a
> medias, el typecheck y los tests fallan por eso antes que por el código**. Es
> lo primero a mirar:
>
> ```
> npx astro sync && npx tsc --noEmit
> EXIGIR_EMULADOR=1 npx vitest run
> npx vitest run tests/bundle-panel.test.ts
> ```
>
> Ese último no es opcional: la vista nueva tiene que entrar **lazy**, y un
> import estático deshace el corte de B-09/D-51 sin que nada falle.
>
> Lo último que dijo el agente fue "typechecks limpios, ahora lo cableo al router
> (lazy) y al menú del listado", así que el componente estaría bien y el cableado
> a medio hacer.
>
> **Nota de coordinación:** dice al final que la pantalla de taxonomías de 3A no
> existía en `main` al arrancar. Ya existe: 3A se mergeó. Montarla es **B-170**, y
> es de este frente porque vive en `AdminApp.tsx`.

# Estado de pausa — Fase 3B · Listado y panel

**Frente:** Fase 3B del [plan de saneamiento](../14-plan-de-saneamiento.md) —
listado, router del panel, reportes y centro de ayuda.
**Branch / worktree:** `worktree-agent-a896145367cd860c8`
(`.claude/worktrees/agent-a896145367cd860c8`), sobre `main`.
**Última actualización:** 2026-08-24.

## ⚠️ Nada roto

`npx tsc --noEmit` (después de `npx astro sync`) y `npx vitest run` pasan en el
último commit. **Ojo con el typecheck:** sin `astro sync` da doce errores de
`import.meta.env` que no son del cambio — está documentado en
[`08-operacion.md`](../08-operacion.md) paso 2.

## Estado ítem por ítem

| Ítem | Estado |
|---|---|
| **B-76** · estado en slug crudo | ✅ **cerrado y commiteado.** El síntoma ya venía arreglado por la vista calendario (el listado usa `ETIQUETA_ESTADO`). Lo que se agregó es la guardia de clase: `tests/etiquetas-de-ui.test.ts` |
| **B-96** · "esta semana" | ✅ **verificado, ya estaba cerrado** por D-73 (el listado ordena por próximo encuentro). No se agregó código: un bloque más sería una segunda pantalla contestando la misma pregunta (D-71). El residual real sigue abierto en B-126 |
| **B-35** · salir con cambios sin guardar | ✅ **cerrado y commiteado.** `salirDe()` en `AdminApp` envuelve las cuatro salidas + `beforeunload`. Regla pura en `src/lib/salida-del-panel.ts`. D-100 |
| **B-14** · menú sin flechas | ✅ **cerrado y commiteado.** Patrón de menú ARIA completo en `MenuAcciones`, con `src/lib/foco.ts` |
| **B-64** · pendientes del centro de ayuda | ✅ **cerrado y commiteado.** Foco atrapado en la capa + versión de cada novedad. El punto del medio no era trabajo pendiente sino el costo aceptado en D-63 |
| **B-31** · reintentar un reporte en `error` | ✅ **cerrado y commiteado.** Botón en `ReportesPanel` + `reintentoValido()` en `firestore.rules` + 7 tests contra el emulador. D-101 |
| **B-40** · UI de versiones | 🟡 **en curso, es lo único que falta.** Ver abajo |
| **B-62** · ayuda contextual por sección | ⬜ **fuera de esta corrida a propósito**: depende de que la fase 2 parta el formulario por secciones |

## Dónde quedé exactamente

Arrancando **B-40**, que es lo único que queda del frente. Todavía no hay código
escrito de ese ítem.

## Siguiente acción concreta

1. Escribir `src/lib/historial.ts`: lectura de `actividades/{id}/versiones`
   (ordenada por id descendente, que es cronológico por `idDeVersion`) más la
   lógica **pura** del diff y de la restauración por campo. `db` se pide a
   `@/lib/firestore-client`.
2. Escribir `src/components/admin/HistorialActividad.tsx`: lista de versiones con
   fecha y `camposCambiados`, y "restaurar este campo" por campo.
3. En `AdminApp.tsx`: sumar la vista `{ tipo: 'historial'; actividad }` al type
   `Vista` y cargarla con el helper `diferido()` que ya está en el archivo —
   **nunca** con `import` estático (B-09/D-51).
4. En `ListaActividades.tsx`: agregar "Historial" a las acciones del
   `MenuAcciones` de cada fila, con un `onHistorial` nuevo en `Props`.
5. Verificar `npx vitest run tests/bundle-panel.test.ts` y agregar ahí la guarda
   de que la vista nueva entra diferida.

**Las tres trampas de B-40, que ya están razonadas:**

- El documento de versión guarda `sesiones` **con `calendarEventId` adentro**.
  Restaurarlo tal cual reinyecta ids de evento viejos y duplica eventos en el
  calendario público (clase de B-80). Hay que conservar el `calendarEventId`
  **actual** de cada sesión, emparejando por `id` de sesión.
- No restaurar `slug` de una actividad publicada (trampa 10: URLs rotas).
- Restaurar es una escritura más, así que dispara `guardarVersion` y deja versión
  de lo restaurado. Eso es **correcto** —deshacer un "deshacer" tiene que ser
  posible— pero conviene verlo en emuladores antes de creerlo.

## `AdminApp.tsx` y el corte del bundle (B-09 / D-51)

**Ya lo toqué, y el corte sigue en pie.** Lo que cambió del router: (a) un
`salirDe(accion)` que envuelve las cuatro salidas del formulario, (b) un
`destinoDeVolver()` para que "← Volver" respete `volverA`, (c) un `useEffect` con
`beforeunload`, (d) se limpió un docblock duplicado por un merge viejo. **No se
agregó ninguna vista ni ningún import estático nuevo pesado**: los dos imports
nuevos son `@/lib/formulario-sucio` y `@/lib/salida-del-panel`, los dos módulos
puros sin Firestore. `npx vitest run tests/bundle-panel.test.ts` pasa (6/6).

La regla para lo que falta: cualquier vista nueva
—B-40 es una— entra con `import()` diferido usando el helper `diferido()` que ya
está en el archivo, **nunca** con `import` estático, y `db` se pide siempre a
`@/lib/firestore-client` y jamás a `@/lib/firebase-client`.

Verificación: `npx vitest run tests/bundle-panel.test.ts`. Al terminar, además
`npm run build` y `./scripts/verificar-bundle.sh dist`.

Chunk inicial de referencia, del último build documentado en el CHANGELOG:
**386.303 bytes** (107.590 gzip), 4 chunks. Si se mueve mucho más que unos
cientos de bytes sin motivo, algo volvió al chunk del login.

## Lo que descubrí y no estaba en la doc

- **B-76 y B-96 ya estaban resueltos en `main`** cuando arranqué, por el frente
  de la vista calendario. El backlog tenía B-76 sin marcar. Ya quedó marcado.
- **La causa de B-76 sigue viva y ya divergió.** `ActividadFormulario.tsx:71-78`
  mantiene sus propios `ETIQUETA_ESTADO`, `ETIQUETA_MODALIDAD` y `ETIQUETA_VIA`;
  para `modalidad: 'hibrido'` el formulario dice **"Híbrido"** y el desplegable de
  filtros dice **"Presencial y virtual"**. Anotado como **B-167** con su
  `it.fails` en `tests/etiquetas-de-ui.test.ts`. **Es dependencia de la fase 2**:
  el arreglo (`src/lib/etiquetas.ts`) toca el formulario.
- **`AdminApp.tsx` tiene un docblock duplicado** (líneas ~90-96, dos veces "SPA
  del panel…" con el primer `/**` sin cerrar). Es un merge desprolijo que
  compila. Limpiarlo cuando se toque el archivo.
- **El botón "← Volver" del encabezado ignoraba `volverA`** — arreglado con B-35
  y anotado en la tabla de Cerrados del backlog.
- **El emulador sirve las reglas del directorio desde el que se lo arrancó**, no
  las del checkout donde corren los tests. Estaba corriendo desde el checkout
  principal, así que la regla nueva de B-31 no existía para mis tests: habrían
  dado verde sin probar nada. Se resolvió con `cargarReglas()` en
  `tests/emulador.ts`, que empuja el archivo local por la API del emulador. Los
  otros tres archivos de integración siguen sin usarlo: **B-168**.
  **Efecto compartido a tener en cuenta:** `cargarReglas` cambia las reglas del
  emulador para todos los tests que corran contra él. Si otro frente corre su
  suite en paralelo, la última carga gana.
- **Para B-40, la trampa que hay que respetar**: el documento de versión guarda
  `sesiones` **con `calendarEventId` adentro**. Restaurar `sesiones` tal cual
  reinyecta ids de evento viejos y duplica eventos en el calendario público — es
  exactamente la clase de B-80. Hay que conservar el `calendarEventId` **actual**
  de cada sesión por su `id` y restaurar solo el contenido editable. Y no
  restaurar `slug` de una actividad publicada (trampa 10).

## Fronteras que respeté

No toqué `ActividadFormulario.tsx`, `src/lib/opciones.ts`,
`campos/TaxonomiaSelect.tsx`, `campos/TagsInput.tsx`, `useOpciones.ts`,
`functions/**` ni `docs/14-plan-de-saneamiento.md`. El componente de
administración de taxonomías del frente 3A **no existía** en `main` al arrancar,
así que no hay nada que montar en el router todavía.
