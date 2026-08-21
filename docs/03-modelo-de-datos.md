# Modelo de datos

La definición canónica está en el **§3 del [`CLAUDE.md`](../CLAUDE.md)** y su
traducción a TypeScript en [`src/types/actividad.ts`](../src/types/actividad.ts).
Este documento no la repite: explica cómo se usa y dónde están las trampas.

## Colecciones

| Ruta | Qué guarda | Quién escribe |
|---|---|---|
| `/actividades/{id}` | una actividad con sus N sesiones embebidas | panel (claim `admin`) y `syncCalendar` |
| `/actividades/{id}/versiones/{ts}` | historial (§12) | **nadie todavía** — no implementado |
| `/opciones/{campo}` | taxonomías autogestionadas (§4) | panel y scripts |
| `/sistema/rebuild` | flag de rebuild pendiente y estado de los reintentos (§8) | `syncCalendar`, `rebuildPorOpciones`, `dispararRebuild` |

`{campo}` de opciones es uno de: `arancel`, `tipo`, `barrio`, `plataforma`,
`tags`.

### `/sistema/rebuild`

Documento único. No lo lee nadie más que la Function del schedule, pero es
donde hay que mirar cuando el sitio no se actualiza
([`08-operacion.md`](08-operacion.md)).

```
pendiente: boolean        // hay cambios sin publicar
motivo: string            // "actividad abc123" / "opciones/tags"
actualizado: Timestamp    // cuándo se marcó
disparado: Timestamp      // cuándo salió el último dispatch OK
intentos: number          // fallos CONSECUTIVOS del dispatch; 0 = todo bien
ultimoError: string|null  // el error del último fallo, recortado a 300 chars
ultimoIntento: Timestamp  // de acá sale el backoff exponencial
agotado: boolean          // se rindió: no reintenta hasta un cambio nuevo
```

Los cuatro últimos son de B-13. `intentos` se resetea con un disparo exitoso o
con un cambio nuevo (D-23): un cambio nuevo merece sus propios intentos, y es
lo que hace que el lazo se recupere solo cuando el problema de fondo se arregla.

`ultimoIntento` y `disparado` se escriben como `Date` y no con
`serverTimestamp()`: la lógica del backoff lee `ultimoIntento` de vuelta para
comparar, y el sentinel de servidor no se puede comparar con nada. `actualizado`
sí usa `serverTimestamp()` porque nadie lo lee para decidir.

## Las dos representaciones de una actividad

Hay dos formas del mismo dato y conviene no confundirlas:

| | `Actividad` | `ActividadForm` |
|---|---|---|
| Dónde vive | Firestore | estado del formulario |
| Fechas | `Timestamp` | `string` de `datetime-local` |
| Campos de auditoría | sí | no |
| Definida en | `types/actividad.ts` | `types/actividad.ts` |

La conversión es en [`src/lib/actividades.ts`](../src/lib/actividades.ts):

- `formADocumento(form, uid, esNuevo)` — form → Firestore
- `documentoAForm(actividad)` — Firestore → form

El ida y vuelta está testeado (`tests/actividades.integracion.test.ts`): no debe
perder datos, y en particular no debe perder los ids de sesión.

## Sesiones — la parte delicada

```
sesiones: [{
  id: 'ses_<uuid>',       // generado en el cliente, NUNCA por índice
  inicio: Timestamp,
  fin: Timestamp,         // la duración sale de acá
  tema: string | null,
  lectura: string | null,
  cancelada: boolean,
  calendarEventId: string | null
}]
```

**El `id` es la llave de todo el sync a Calendar.** Se genera con
`nuevaSesionId()` de [`src/lib/sesiones.ts`](../src/lib/sesiones.ts) al crear la
fila del formulario.

Si se usara el índice del array, borrar la sesión 3 renumera todo y el diff
creería que cambiaron cinco encuentros en vez de uno: borraría y recrearía
eventos que la gente ya tiene agendados, perdiendo sus recordatorios y
suscripciones (trampa 2). Hay tests específicos para esto en
`tests/calendario.test.ts`.

`calendarEventId` lo escribe la Function, no el panel. El formulario lo conserva
tal cual al editar.

**Al duplicar una actividad, los ids se rehacen y `calendarEventId` vuelve a
`null`** (`src/lib/duplicar.ts`). Dos actividades con los mismos ids de sesión
harían que editar una toque los eventos de la otra: el diff del §7.2 no tiene
forma de distinguirlas.

## Fechas

**Siempre `Timestamp`, nunca strings** (trampa 1). Y siempre `timeZone`
explícito hacia Calendar (`America/Argentina/Buenos_Aires`). Es el bug clásico
de eventos corridos tres horas.

En el formulario las fechas son strings de `datetime-local` en hora local del
navegador. La conversión de ida y vuelta está en `sesiones.ts`
(`aDatetimeLocal` / `deDatetimeLocal`) y testeada para que no corra la hora.

## `tipo` único + `tags` array no es redundante

Firestore permite un solo `array-contains-any` por query. Si todo fuera a
`tags`, no se podrían cruzar dos filtros de array (§3.2).

## Taxonomías (§4)

Un patrón genérico resuelve cinco campos: desplegable enumerado + casilla
"Otro" cuyo valor se incorpora al desplegable para usos futuros.

```
/opciones/arancel
  valores: [
    { slug: 'gratis',       label: 'Gratis',           orden: 1, fijo: true,  usos: 0 },
    { slug: 'a-la-gorra',   label: 'A la gorra',       orden: 2, fijo: true,  usos: 0 },
    { slug: 'beca-parcial', label: 'Con beca parcial', orden: 9, fijo: false, usos: 3 }
  ]
```

Un documento con array, no una subcolección: son pocas opciones y se leen todas
juntas para pintar el formulario en una sola lectura.

**La actividad guarda solo el `slug`.** Renombrar el label no obliga a tocar
ningún documento de actividad — pero ver la advertencia sobre el calendario más
abajo.

### Normalización

Sin slugify, en tres meses hay "A la gorra", "a la gorra ", "A la Gorra" y
"Gorra" como cuatro opciones distintas (trampa 6).

`upsertOpcion` en [`src/lib/opciones.ts`](../src/lib/opciones.ts) resuelve el
slug **antes** de crear y reusa si ya existe. Va en transacción porque dos
guardados simultáneos con la misma etiqueta nueva se pisarían el array.

`tests/opciones.integracion.test.ts` prueba las cuatro variantes contra el
emulador y verifica que quede una sola opción.

### `fijo` y `usos`

- **`fijo: true`** protege las opciones base: no se borran ni renombran desde la
  UI. Son las que pueden estar cableadas en la lógica.
- **`usos`** ordena el desplegable por frecuencia real, mejor que alfabético, y
  sirve para detectar basura: una opción con `usos: 1` creada hace meses es casi
  seguro un typo colgado.

El orden lo calcula `ordenarValores`: primero las fijas por su `orden`, después
las creadas con "Otro" por uso descendente. **Ese orden decide cuál opción
preselecciona el formulario**, así que está fijado con tests en
`tests/opciones-orden.test.ts`.

### Advertencia: las etiquetas se ven en público

La descripción de los eventos de Calendar muestra la **etiqueta**, no el slug.
Dos consecuencias:

1. Un tag creado como "narrativa" (minúscula) aparece así en el calendario
   público. Hoy no hay normalización de mayúsculas ni UI para editar etiquetas
   — está en el [backlog](BACKLOG.md).
2. Renombrar una etiqueta **no** actualiza los eventos ya creados. El evento
   queda con el texto anterior hasta la próxima edición de la actividad.
   `rebuildPorOpciones` solo marca el rebuild del sitio, no re-sincroniza el
   calendario.

## Campos que faltan

**`libro presentado`.** El §11 lo lista como campo de presentaciones y charlas,
pero el §3.1 no lo tiene en el modelo. Hoy en esos tipos se carga solo el autor,
vía `tallerista`. Decisión pendiente del usuario: campo propio o dentro de la
descripción.

**`sede.geo`.** Existe en el modelo y la Function lo usa para armar un link de
mapa exacto si está presente, pero **el formulario no lo captura**, así que
siempre es `null` y el mapa se resuelve por dirección.

**`aprobada` en las opciones.** El §4.3 lo menciona para cuando cargue gente
además del dueño. No está implementado.
