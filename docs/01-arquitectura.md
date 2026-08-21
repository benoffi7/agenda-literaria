# Arquitectura

## Las tres piezas

1. **Panel de admin** — SPA React en `/admin`, escribe a Firestore.
2. **Sitio público** — Astro estático (SSG). **Todavía no existe.**
3. **Google Calendar público** — espejo de solo lectura.

## Flujo de datos

Es unidireccional. Firestore es la única fuente de verdad (§2.1).

```
                    ┌──────────────────┐
                    │  Panel /admin    │
                    │  React island    │
                    └────────┬─────────┘
                             │ escribe (reglas: claim admin)
                             ▼
                    ┌──────────────────┐
                    │    Firestore     │◄──── única fuente de verdad
                    │  southamerica-   │
                    │     east1        │
                    └────┬────────┬────┘
                         │        │
          onDocumentWritten       │ lectura en build time
                         │        │ (Admin SDK)
                         ▼        ▼
              ┌──────────────┐  ┌──────────────────┐
              │ syncCalendar │  │  build de Astro  │
              │  Function    │  │  (paso 3, falta) │
              └──────┬───────┘  └────────┬─────────┘
                     │                   │
                     ▼                   ▼
            ┌─────────────────┐  ┌──────────────────┐
            │ Google Calendar │  │  HTML + events   │
            │  (espejo r/o)   │  │  .json estáticos │
            └─────────────────┘  └──────────────────┘
```

**Si alguien edita un evento directo en Google Calendar, ese cambio se pierde en
el próximo sync.** Es el comportamiento esperado, no un bug (§2.1). No
implementar sincronización bidireccional.

## Por qué un solo proyecto Astro

El panel es una island `client:only="react"` en la ruta `/admin` del mismo
proyecto que el sitio público (§2.3). Un repo, un Hosting target, un deploy.

El bundle pesado queda aislado en esa ruta: `/admin` carga ~570 KB (el SDK de
Firebase) y la home carga ~8 KB. Verificable en `dist/_astro/` después de un
build.

## Por qué el JSON público lo genera el build

No hay una Function que genere `events.json` (§2.4). Astro lo produce en build
time leyendo Firestore con el Admin SDK, junto con las páginas de detalle en
HTML.

Consecuencia: **una actividad nueva no existe en el sitio hasta que se
rebuildea.** De ahí el mecanismo de rebuild del §8, con ~2-7 minutos de
latencia.

## Por qué la búsqueda es en memoria

Firestore no tiene full-text (§2.5). El sitio público hace **un solo fetch** de
`events.json` (cacheado en CDN) y filtra en memoria del cliente.

- Búsqueda instantánea, filtros combinados sin composite indexes.
- Cero lecturas de Firestore desde el público → costo prácticamente nulo.
- No integrar Algolia ni Typesense: es prematuro y funciona hasta varios miles
  de actividades.

## Actividad ≠ Encuentro

Un club de lectura de 8 encuentros es **una** actividad con **ocho** sesiones en
un array embebido (§2.2). No son 8 documentos.

- En el listado tiene que aparecer una sola tarjeta.
- "Cambió la sede" tiene que ser una sola escritura.
- **No usar RRULE ni eventos recurrentes de Calendar:** los ciclos literarios
  tienen fechas irregulares y cada encuentro su propio tema o lectura. Siempre
  lista explícita, un evento de Calendar por sesión.

## Mapa del código

```
src/
  types/actividad.ts        el modelo del §3 en TypeScript
  lib/
    slugify.ts              normalización de taxonomías (§4.2)
    normalize.ts            searchText y búsqueda sin acentos (§6)
    sesiones.ts             ids uuid, generador de N encuentros (§11)
    schema.ts               validación del form con zod, condicionales del §11
    actividades.ts          CRUD y conversión form ⇄ documento
    opciones.ts             taxonomías autogestionadas (§4)
    opciones-base.json      opciones fijas, compartidas con los scripts
    toPublic.ts             proyección pública (§5.2)
    firebase-client.ts      auth y Firestore del panel
    firebase-admin.ts       SOLO build time (§5.4)
  components/admin/         el panel entero
  layouts/Base.astro        head, fuentes, viewport
  pages/
    admin.astro             island client:only
    index.astro             placeholder del sitio público
functions/
  calendario.js             diff y armado del evento — lógica pura
  historial.js              cuándo se guarda una versión (§12) — lógica pura
  historial-trigger.js      el onDocumentUpdated del historial
  index.js                  triggers de Firestore y schedule del rebuild
scripts/
  seed-emulador.mjs         siembra /opciones/* en el emulador
  preparar-produccion.mjs   siembra /opciones/* y da el claim admin
  set-admin-claim.mjs       claim admin, con atajo --todos para el emulador
tests/                      134 tests
firestore.rules             reglas del §5.3
```

## Frontera crítica: `firebase-admin` nunca al cliente

`src/lib/firebase-admin.ts` solo puede importarse desde frontmatter de `.astro`,
`getStaticPaths` o scripts de build (§5.4). Si se cuela en un componente
cliente, **la service account key termina en el bundle** (trampa 4).

Tres defensas:

1. El módulo tira error si detecta `window`.
2. `astro.config.mjs` lo marca como `ssr.external`.
3. Después de cada build se verifica que no aparezca en `dist/` — ver
   [`07-seguridad.md`](07-seguridad.md).
