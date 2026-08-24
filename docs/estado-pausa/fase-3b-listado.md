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
| **B-35** · salir con cambios sin guardar | 🟡 **a medias.** `src/lib/salida-del-panel.ts` está escrito, compila y está commiteado, **pero todavía no lo usa nadie**. Falta cablearlo en `AdminApp.tsx` |
| **B-14** · menú sin flechas | ⬜ sin empezar |
| **B-64** · pendientes del centro de ayuda | ⬜ sin empezar |
| **B-31** · reintentar un reporte en `error` | ⬜ sin empezar |
| **B-40** · UI de versiones | ⬜ sin empezar |
| **B-62** · ayuda contextual por sección | ⬜ **fuera de esta corrida a propósito**: depende de que la fase 2 parta el formulario por secciones |

## Dónde quedé exactamente

En `src/lib/salida-del-panel.ts` — módulo nuevo, puro, terminado: exporta
`VISTAS_CON_FORMULARIO`, `tieneFormulario`, `AVISO_CAMBIOS_SIN_GUARDAR` y
`debeConfirmarSalida(tipoDeVista, hayCambiosSinGuardar)`. Le falta **consumidor y
test**.

## Siguiente acción concreta

1. En `src/components/admin/AdminApp.tsx`, importar `debeConfirmarSalida` y
   `AVISO_CAMBIOS_SIN_GUARDAR` de `@/lib/salida-del-panel` y
   `hayCambiosSinGuardar` de `@/lib/formulario-sucio`. Definir dentro de
   `AdminApp`:

   ```tsx
   const salirDe = (accion: () => void) => {
     if (debeConfirmarSalida(vista.tipo, hayCambiosSinGuardar()) &&
         !confirm(AVISO_CAMBIOS_SIN_GUARDAR)) return;
     accion();
   };
   ```

   y envolver con `salirDe(...)` los **cinco** botones del encabezado que hoy
   abandonan el formulario sin preguntar: "← Volver" (línea ~209), "Calendario"
   (~218), "Reportar algo" (~227), "Salir" (~247) y el `onCancelar` que se le
   pasa a `ActividadFormulario` (~301). `onGuardado` **no** se envuelve.
2. Agregar en el mismo componente un `useEffect` con `beforeunload` que llame a
   `e.preventDefault()` y setee `e.returnValue = ''` cuando
   `hayCambiosSinGuardar()`. Sin el `returnValue` Chrome lo ignora.
3. Escribir `tests/salida-del-panel.test.ts` sobre el módulo puro (las tres
   vistas con formulario piden confirmación, las otras no, y con el store limpio
   nunca).
4. Cerrar B-35 con el skill `cerrar-cambio`: entra en `novedades.ts` (se nota al
   usar el panel) y en el CHANGELOG.

Después seguir con B-14 → B-64 → B-31 → B-40, en ese orden (de más chico a más
grande, para que lo grande no se lleve puesto lo chico).

## `AdminApp.tsx` y el corte del bundle (B-09 / D-51)

**Todavía no lo toqué.** En cuanto se toque, la regla es: cualquier vista nueva
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
- **El botón "← Volver" del encabezado ignora `volverA`**: editar desde el
  calendario y volver por el encabezado manda al listado, mientras que "Cancelar"
  dentro del formulario respeta el calendario. Arreglarlo junto con B-35, que es
  el ítem de las salidas.
- **Para B-31 hay que tocar `firestore.rules`**, que hoy tiene
  `allow update, delete: if false` en `/reportes/{id}`. El reintento necesita
  además resetear `intentos` a `0`, no solo `estado` a `'pendiente'`:
  `decidirAccion` de `functions/reportes.js` ignora un reporte con
  `intentos >= MAX_INTENTOS`. Los emuladores estaban levantados, así que la regla
  se puede verificar en `tests/reportes.integracion.test.ts`.
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
