# Arquitectura

## Las tres piezas

1. **Panel de admin** — SPA React en `/admin`, escribe a Firestore.
2. **Sitio público** — Astro estático (SSG). Listado con búsqueda y filtros, y
   página de detalle por actividad (**B-227**). **Todavía no está desplegado:**
   falta elegir el dominio (B-109), y con él el canonical y el sitemap.
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
              │  Function    │  │  (paso 3, B-227) │
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

El bundle pesado queda aislado en esa ruta: la home carga ~8 kB y `/admin` es el
único que paga el SDK de Firebase. Verificable en `dist/_astro/` después de un
build.

Dentro de `/admin`, el bundle está partido en dos por el login (B-09, D-51):

| Cuándo se baja | Qué | Peso |
|---|---|---|
| Al entrar a `/admin` | React + `firebase/app` + `firebase/auth` + `AdminApp` | ~353 kB · gzip ~95 kB |
| Recién después del login | Firestore + `ListaActividades` | ~323 kB · gzip ~83 kB |
| Al abrir el formulario | `ActividadFormulario` + zod + vista previa | ~93 kB · gzip ~25 kB |

La pantalla de login pesa la mitad que antes (~750 kB) porque **no baja
Firestore**: `db()` vive en `src/lib/firestore-client.ts`, aparte de
`firebase-client.ts`. El corte depende del grafo de imports, así que lo cuida
`tests/bundle-panel.test.ts`.

## Por qué el JSON público lo genera el build

No hay una Function que genere `events.json` (§2.4). Astro lo produce en build
time leyendo Firestore con el Admin SDK, junto con las páginas de detalle en
HTML.

Consecuencia: **una actividad nueva no existe en el sitio hasta que se
rebuildea.** De ahí el mecanismo de rebuild del §8, con ~2-7 minutos de
latencia.

### El lazo del rebuild (§8)

```
  syncCalendar / rebuildPorOpciones
            │ escriben sistema/rebuild.pendiente = true
            ▼
     sistema/rebuild  ◄────────────────┐
            │                          │ baja el flag, resetea intentos
            │ cada 5 min               │
            ▼                          │
     dispararRebuild ──────────────────┘
            │ repository_dispatch (event_type: rebuild)
            ▼
  .github/workflows/deploy.yml
     npm ci → npm test → npm run build → Firebase Hosting
```

**El debounce está en el schedule, no en la Function de sync.** Cinco ediciones
seguidas marcan el mismo flag cinco veces y disparan un solo build.

Si el `repository_dispatch` falla, el flag queda en `true` y el schedule
reintenta con backoff exponencial hasta cinco veces; después se rinde y deja el
error en el documento (`functions/rebuild.js`). Un cambio nuevo rearma los
intentos, así que el lazo se recupera solo cuando el problema se resuelve.

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
    huella.ts               huella del uid que crea una opción (§4.3, D-27)
    normalize.ts            searchText y búsqueda sin acentos (§6)
    sesiones.ts             ids uuid, generador de N encuentros (§11)
    duplicar.ts             copia de una actividad: ids nuevos, fechas corridas
    schema.ts               validación del form con zod, condicionales del §11
    actividades.ts          CRUD y conversión form ⇄ documento
    opciones.ts             taxonomías autogestionadas (§4)
    opciones-base.json      opciones fijas, compartidas con los scripts
    toPublic.ts             proyección pública (§5.2)
    eventsJson.ts           el índice de /events.json — recorta la ActividadPublica
    vistaPreviaEvento.ts    form → evento de Calendar, reusando @calendario
    coordenadas.ts          parseo de links de Google Maps a lat/lng
    version.ts              versión del bundle y decisión de recargar
    formulario-sucio.ts     ¿hay cambios sin guardar? store de módulo
    firebase-client.ts      app y auth del panel — sin Firestore (B-09)
    firestore-client.ts     db() del panel, aparte para no cargarlo en el login
    firebase-admin.ts       SOLO build time (§5.4)
    enlaces.ts              destinos externos: calendario, IG, contacto (B-228)
    contraste.ts            matemática de contraste WCAG, para el guard (B-235)
    ayudaDelSitio.ts        el contenido de /ayuda, como datos (B-232)
    contactoDelSitio.ts     el contenido de /contacto, derivado de enlaces (B-232)
    suscripcion.ts          los caminos de /suscribirse, como datos (B-230)
    contenidoDelSitio.ts    SOLO build time — el ÚNICO lector de Firestore del
                            sitio: el where del §5.3, y una lectura para los
                            tres artefactos (B-227)
    listadoPublico.ts       filtros, orden y búsqueda del listado — puro
    detallePublico.ts       qué muestra la página de detalle, y su JSON-LD —
                            puro, y es la frontera de privacidad de esa salida
    fechasPublicas.ts       las fechas del sitio, siempre con timeZone (trampa 1)
    rutasPublicas.ts        /actividad/{slug} escrito una sola vez
  components/admin/         el panel entero
  components/sitio/         el chrome del sitio público y sus piezas (B-229)
  components/publico/       el sitio: FilaDeActividad, ListaDeActividades, EjeDeFiltro
                            y Buscador (la única island del sitio)
  layouts/Base.astro        head, fuentes, viewport, y el chrome — apagado por
                            defecto, porque /admin no lo lleva (B-229)
  pages/
    admin.astro             island client:only
    version.json.ts         /version.json — qué versión está publicada
    events.json.ts          /events.json — serializa lo que lee contenidoDelSitio
    index.astro             la home: listado en HTML + island de filtros (B-227)
    actividad/[slug].astro  el detalle, SSG y con CERO JavaScript. No ve el
                            documento: recibe un view-model (D-140)
    ayuda.astro             /ayuda — texto, sin JS ni Firestore (B-232)
    contacto.astro          /contacto — dos mailto con asunto propio (B-232)
    suscribirse.astro       /suscribirse — llevarse la agenda (B-230)
functions/
  calendario.js             diff y armado del evento — lógica pura
                            COMPARTIDA: el panel la importa como @calendario
  rebuild.js                backoff y corte por intentos — lógica pura (§8)
  historial.js              cuándo se guarda una versión (§12) — lógica pura
  historial-trigger.js      el onDocumentUpdated del historial
  reportes.js               armado del issue de GitHub — lógica pura
  reportes-trigger.js       la Function que crea el issue
  index.js                  triggers de Firestore y schedule del rebuild
.github/workflows/
  deploy.yml                build + deploy que dispara el rebuild (§8)
scripts/
  version.mjs               versión del build: package.json + SHA de git
  seed-emulador.mjs         siembra /opciones/* en el emulador
  preparar-produccion.mjs   siembra /opciones/* y da el claim admin
  set-admin-claim.mjs       claim admin, con atajo --todos para el emulador
  aprobar-opciones.mjs      aprueba opciones de taxonomía pendientes (§4.3)
tests/                      la suite; el conteo vive en docs/README.md, que es
                            donde se mide
firestore.rules             reglas del §5.3
```

## Una sola fuente de verdad para el evento de Calendar

`functions/calendario.js` no es solo de la Function: el panel lo importa con el
alias **`@calendario`** para la vista previa del evento (D-20).

```
                    functions/calendario.js
                    (JS puro, sin Firebase)
                       ╱                ╲
        functions/index.js          src/lib/vistaPreviaEvento.ts
        (sync a Calendar)           (vista previa del panel)
```

El alias está declarado en los tres lugares que resuelven módulos:
`astro.config.mjs` (Vite), `tsconfig.json` (TypeScript) y `vitest.config.ts`
(los tests). Apunta a **ese archivo**, no a `functions/*`: un comodín invitaría
a importar `functions/index.js` desde el cliente y eso arrastra
`firebase-admin` al bundle (trampa 4).

**Por qué importa:** la descripción del evento aplica las reglas de privacidad
del §5.1. Una copia de esa lógica en el panel se desactualizaría y la vista
previa mostraría de menos o de más. Al ser la misma función, no puede pasar.

## Frontera crítica: `firebase-admin` nunca al cliente

`src/lib/firebase-admin.ts` solo puede importarse desde frontmatter de `.astro`,
`getStaticPaths` o scripts de build (§5.4). Si se cuela en un componente
cliente, **la service account key termina en el bundle** (trampa 4).

Tres defensas:

1. El módulo tira error si detecta `window`.
2. `astro.config.mjs` lo marca como `ssr.external`.
3. Después de cada build se verifica que no aparezca en `dist/` — ver
   [`07-seguridad.md`](07-seguridad.md).
