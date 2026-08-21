---
name: cerrar-cambio
description: Cierra un cambio de este repo como manda la regla de proceso — actualiza la documentación, el CHANGELOG, la ayuda y las novedades del panel, y el BACKLOG — en el mismo cambio y antes de commitear. Invocalo cuando una funcionalidad, un arreglo o una modificación de código está lista y hay que dejarla terminada, o cuando el usuario diga "cerralo", "terminá", "actualizá la doc" o "/cerrar-cambio".
---

# Cerrar un cambio

En este repo un cambio de código **no está terminado hasta que la documentación
lo refleja** (`docs/05-patrones.md`). Este es el procedimiento, en orden. Son
pasos fijos: seguilos, no improvises otro camino.

Es un procedimiento, no una auditoría: **escribís los archivos**. Si lo que
querés es que alguien revise si falta algo sin tocar nada, el que corresponde es
el agente `auditor-documentacion`.

## 0 · Mirar el cambio

```bash
git status --short
git diff --stat
git diff
```

Si el cambio ya está commiteado en la rama, `git log --oneline main..HEAD` y
`git diff main...HEAD`.

## 1 · Decidir qué toca actualizar

Recorré la tabla completa, una fila a la vez, y decidí **con motivo**. No
saltees ninguna: lo que se saltea siempre es la misma (`novedades.ts`).

| Si el cambio… | Actualizar |
|---|---|
| agrega o modifica comportamiento visible | `docs/04-funcionalidades.md` |
| toca infra, IAM, APIs, regiones, cuentas, secretos | `docs/02-infraestructura.md` |
| cambia colecciones o campos | `docs/03-modelo-de-datos.md` |
| implica una decisión o un desvío del `CLAUDE.md` | `docs/06-decisiones.md` |
| cambia qué es público o cómo se verifica | `docs/07-seguridad.md` |
| cambia cómo se corre o se despliega | `docs/08-operacion.md` |
| cambia qué se mide o con qué nombre | `docs/09-analitica.md` |
| **se nota al usar el panel** | `src/lib/novedades.ts` |
| **cambia algo que no se adivina mirando la pantalla** | `src/lib/ayuda.ts` |
| **cualquier cambio** | `docs/CHANGELOG.md` |
| es un bug, incluso ya arreglado | `docs/BACKLOG.md` |

## 2 · CHANGELOG

Lo más nuevo arriba. Título de una línea que diga **qué cambió**, y cuando
importa, **por qué** — el "por qué" largo va a `06-decisiones.md` y se cita.
Si el cambio va con una versión nueva de `package.json`, el encabezado es
`## <version> — AAAA-MM-DD`; si no, entra bajo la fecha.

Nombrá los `B-xx` y `D-xx` involucrados: es lo que permite reconstruir después
por qué algo es como es.

## 3 · Decisiones (`06-decisiones.md`), solo si hubo una

Una `D-xx` nueva con el número **siguiente libre** (mirá el archivo, no asumas).
Va cuando se eligió entre alternativas, o cuando el cambio **se desvía del
`CLAUDE.md`** — en ese caso el desvío se escribe explícito, con qué se mantiene
para que sea aceptable (el patrón está en D-15).

## 4 · Novedades del panel (`src/lib/novedades.ts`)

Solo **si el cambio se nota al usar el panel**. Una entrada arriba del array:

- `id`: nuevo, estable, en kebab-case. **No se reusa ni se renombra**: es la
  marca de "hasta acá leí" guardada en el navegador de cada persona.
- `fecha`: `AAAA-MM-DD`. `version` si se sabe.
- `titulo`: qué podés hacer ahora que antes no podías, en una línea.
- `detalle`: dos o tres frases. Si no entra, es ayuda y no novedad.
- `donde`: dónde está en el panel.

Sin `§`, sin nombres de archivo, sin nombres de campo, sin jerga: le habla a
quien organiza actividades literarias.

**No entra** un refactor, un test, una cabecera de cache, un cambio de bundle ni
nada que no cambie qué puede hacer quien carga. Esa lista no es un registro de
trabajo: si se llena de entradas inútiles, se deja de leer.

## 5 · Ayuda del panel (`src/lib/ayuda.ts`)

Solo si el cambio **agrega o modifica algo que no se adivina** mirando la
pantalla: algo que queda fijo, algo que se publica o deja de publicarse, algo
que borra o crea eventos.

- Sección nueva en el formulario → **capítulo nuevo obligatorio**, con
  `seccionFormulario` igual al título literal de la sección.
  `tests/ayuda.test.ts` falla si falta, y **la respuesta no es aflojar el test**.
- Comportamiento irreversible nuevo → revisá si corresponde un aviso arriba, o
  un punto con `cuidado: true`.
- La ayuda **corta de un campo puntual no va acá**: va en la prop `ayuda` de
  `Campo`, al lado del campo.
- Si el cambio contradice un texto que ya está, corregilo. Una ayuda que miente
  es peor que no tener ayuda.

## 6 · BACKLOG

- **Todo bug que apareció en el camino entra**, incluso si se arregló en el
  momento: en ese caso va a **Cerrados**, con qué se rompió, la causa y dónde
  (commit, `D-xx`).
- Si el cambio **cierra** un ítem, marcalo `— ✅ hecho (AAAA-MM-DD)` y dejá el
  texto: el rastro importa. No borres ítems.
- Si el cambio **deja algo pendiente**, abrilo con su prioridad (**P0** rompe o
  pierde datos · **P1** bloquea el objetivo · **P2** mejora real · **P3** cuando
  sobre tiempo) y con el motivo de por qué vale la pena, no solo qué falta.
- Numeración: el siguiente `B-xx` libre. Miralo, no lo adivines.

## 7 · Verificación final

```bash
npm run typecheck
npm test
```

`npm test` corre todo; los de integración se saltean solos si los emuladores no
están (`npm run emu` en otra terminal para que corran de verdad). Los tests
`ayuda`, `novedades` y `sin-marcadores-de-conflicto` son los que fallan si este
procedimiento se hizo mal.

**No toques el conteo de tests que aparece en la doc** salvo que lo hayas
contado de verdad en esta corrida.

## 8 · Cerrar

Resumí en tres o cuatro líneas: qué se tocó de doc, qué entradas se agregaron a
`novedades`/`ayuda`, qué ítems del backlog se abrieron o cerraron. Recién ahí el
cambio está listo para commitear, con mensaje en **español**.

Antes de commitear, conviene pasar los auditores: `auditor-privacidad` si el
cambio toca una salida pública, `auditor-trampas` si toca `src/lib/`,
`src/components/admin/`, `functions/` o las reglas.
