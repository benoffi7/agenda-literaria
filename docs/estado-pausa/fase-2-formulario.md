> ## ⚠️ Leé esto primero: el frente no cerró solo
>
> El agente **murió por watchdog** (600 s sin progreso) mientras escribía el
> cierre documental. Lo que sigue lo escribió él **antes** de morir, así que
> describe el estado hasta ahí y no menciona lo último.
>
> **Branch:** `worktree-agent-a541ee3dce3fc09b0` · 4 commits.
>
> El último commit es un **rescate que hizo el orquestador**, no el agente:
> `WIP: rescate — el agente murió a mitad del cierre de B-70 y B-79`. Contiene
> todo lo que había sin commitear, incluidos dos archivos que no estaban
> trackeados y se habrían perdido: `src/components/admin/formulario/` (el JSX
> partido por sección, B-79) y `src/lib/formulario/condicionales.ts`.
>
> **Ese commit NO está verificado** y puede estar a mitad de un cambio. Lo
> primero al retomar:
>
> ```
> npx astro sync && npx tsc --noEmit
> EXIGIR_EMULADOR=1 npx vitest run
> ```
>
> Lo último que dijo el agente fue "ahora el backlog y el changelog para B-79 y
> B-70", así que el código estaría hecho y lo que falta es el cierre documental.
> Verificá antes de creerlo.

# Estado de pausa — Fase 2 · el formulario

**Frente:** fase 2 del [plan de saneamiento](../14-plan-de-saneamiento.md) —
dueño exclusivo de `src/components/admin/ActividadFormulario.tsx` y de los
módulos de dominio que salen de él.

**Branch / worktree:** `worktree-agent-a541ee3dce3fc09b0` en
`.claude/worktrees/agent-a541ee3dce3fc09b0` (arrancó de `main` en `12569a4`).

**Ítems del frente, en el orden que fija el plan:** B-70 (primero) → B-71, B-87,
B-90 (con B-70) → B-79 (último).

---

## ⚠️ Estado ahora mismo

Nada roto: `npx tsc --noEmit` y `npx vitest run` pasan (680 tests). El
formulario **todavía no usa** los módulos nuevos, así que el repo está en un
punto intermedio consistente: hay código nuevo sin conectar y ninguna
duplicación activa (las funciones viejas siguen siendo las que corren).

```bash
npx astro sync && npx tsc --noEmit   # astro sync es necesario: sin .astro/types.d.ts
npx vitest run                        # tsc reporta 12 errores falsos de import.meta.env
```

**Baseline del bundle**, medido en este worktree antes de tocar nada (para
comparar al terminar): carga inicial de `/admin` = **387.797 B** en 4 chunks
(gzip de los 4 concatenados: 106.934 B); suma de todos los chunks: 898.576 B.
Se mide siguiendo el cierre estático de imports desde el `component-url` del
`astro-island` de `dist/admin/index.html`.

---

## Cerrado y commiteado

| Ítem | Estado |
|---|---|
| B-70 | **en curso** — creados `src/lib/formulario/estadoInicial.ts` y `cascadas.ts`; falta `etiquetas.ts`, `guardar.ts`, los tests y conectar el `.tsx` |
| B-87 | **en curso** — el arreglo está escrito dentro de `formVacio()` (`estadoInicial.ts`), pero no surte efecto hasta que el `.tsx` lo use y se saque `autoSeleccionarPrimera` del campo `tipo` |
| B-71 | no empezado (va en `guardar.ts`) |
| B-90 | no empezado |
| B-79 | no empezado |

---

## Dónde quedé exactamente

Terminados y typecheckeados, **sin usar todavía por nadie**:

- `src/lib/formulario/estadoInicial.ts` — `formVacio()`, `sedeVacia()`,
  `onlineVacio()`, `primeraOpcionBase(campo)`. Copia fiel de lo que hoy hace
  `ActividadFormulario.tsx:48-68`, **más el arreglo de B-87**: `tipo` nace
  preseleccionado con `primeraOpcionBase('tipo')` (= `'taller'`) en lugar de
  esperar el efecto del hijo.
- `src/lib/formulario/cascadas.ts` — `cambiarTitulo(f, titulo, slugBloqueado)`,
  `cambiarTipo(f, tipo)`, `cambiarModalidad(f, modalidad)`. Copia fiel de
  `ActividadFormulario.tsx:132-176`.

## Siguiente acción concreta (en imperativo, en orden)

1. Crear `src/lib/formulario/etiquetas.ts` con las dos piezas que hoy están en
   `ActividadFormulario.tsx`: `recordarLabel(prev, campo, label?)` (líneas
   124-129, el buffer de etiquetas de D-02) y `labelsPendientesDe(labelsNuevos,
   tagsNuevos)` (líneas 188-198, el mapa `LabelsTaxonomia` que consume la vista
   previa).
2. Crear `src/lib/formulario/guardar.ts` con el caso de uso completo que hoy es
   `guardar()` (`ActividadFormulario.tsx:200-256`), con las dependencias de
   Firestore inyectadas (`PuertosGuardado` con `slugDisponible`, `upsertOpcion`,
   `upsertOpciones`, `crearActividad`, `actualizarActividad`, y un
   `puertosFirestore` por default). Que devuelva un resultado
   (`invalido` | `slug-tomado` | `ok` | `error`) y que **no** haga analítica ni
   toque estado de React: eso queda en el componente.
3. **B-71 dentro de ese módulo:** escribir la actividad **antes** que las
   etiquetas nuevas (hoy es al revés, líneas 237-245). Si falla el
   `upsertOpcion`, el guardado igual es `ok`: la actividad ya está escrita y
   volver a reportar error haría que el segundo intento choque contra su propio
   slug. Devolver `etiquetasSinRegistrar: true` para que el test lo pueda
   afirmar.
4. Escribir `tests/formulario-*.test.ts` (puros, con puertos falsos) cubriendo:
   las tres cascadas, `formVacio().tipo === 'taller'`, y **el orden de B-71**
   (si la escritura de la actividad falla, no se creó ninguna opción).
5. Conectar `ActividadFormulario.tsx` a los cuatro módulos y **sacar
   `autoSeleccionarPrimera` del campo `tipo`** (línea 298) — dejarlo en
   `plataforma` (línea 475), ahí la preselección la dispara un cambio real de
   quien carga, no el montaje.
6. B-90: agregar `previas` a `generarSesiones` (`src/lib/sesiones.ts:74`) y
   reusar `id` y `calendarEventId` de la fila que ocupa la misma posición;
   pasarle `sesiones` desde `SesionesEditor.tsx:73`; corregir el cartel
   ("Reemplaza la lista actual"); **actualizar el test de B-90 en
   `tests/costuras.test.ts:472`**, que hoy afirma el comportamiento roto
   (8 `borrar` + 8 `crear`) y va a fallar cuando se arregle.
7. B-79 al final: partir el JSX en `src/components/admin/formulario/Seccion*.tsx`.

---

## Lo que descubrí y no está en la doc

1. **B-71 es como dice el plan, verificado en el código.** Con el orden
   invertido, el peor caso es que el slug quede sin registrar en `/opciones/*`.
   El evento público lo resuelve solo: `etiqueta()` de `functions/calendario.js`
   cae en `desSlug(slug)` (D-11), o sea "Con Beca Parcial" en lugar de "Con beca
   parcial". Confirmado que el modo de falla pasa de *basura permanente en la
   taxonomía* a *una capitalización distinta*.
2. **Residual de B-71 en un archivo que no es mío:** el desplegable del panel
   **sí** muestra el slug crudo para un slug no registrado —
   `TaxonomiaSelect.tsx:222-226` renderiza `` `${value} (nueva)` `` — así que al
   reeditar la actividad se vería "con-beca-parcial (nueva)". Ese archivo es del
   frente 3A: hay que anotarlo como ítem propio del backlog (usar `desSlug` /
   `legible` ahí), no arreglarlo desde acá.
3. **Por qué `primeraOpcionBase` puede resolverse sin Firestore:**
   `ordenarValores` pone las fijas antes que las creadas con "Otro" y ninguna
   opción nueva puede quedar primera, así que la primera elegible es siempre la
   primera opción base. Es lo que permite arreglar B-87 en el estado inicial en
   lugar de en un efecto.
4. **Dos tests leen `ActividadFormulario.tsx` como texto y B-79 los va a
   romper:** `tests/ayuda.test.ts:50` (busca los `titulo="…"` de las nueve
   secciones) y `tests/opciones-orden.test.ts:20` (busca el bloque
   `campo="arancel"`). Al partir el JSX hay que hacerlos leer el directorio de
   secciones. Cuidado con el falso verde del segundo: si no encuentra
   `campo="arancel"`, el `not.toContain` pasa igual.
5. `npx tsc --noEmit` no sirve en un worktree recién creado sin correr antes
   `npx astro sync`: sin `.astro/types.d.ts` tira 12 errores de
   `import.meta.env` que no son del cambio.
6. **`src/lib/sesiones.ts` y `src/components/admin/SesionesEditor.tsx` los tomé
   como parte de este frente** (B-90 vive ahí y ningún otro frente los reclama
   en el plan).
