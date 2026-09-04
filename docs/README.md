# Documentación — Agenda de actividades literarias

Punto de entrada para retomar el proyecto, sea humano o agente.

## Leer en este orden

| # | Documento | Para qué |
|---|---|---|
| — | [`../CLAUDE.md`](../CLAUDE.md) | **Primero y completo.** Decisiones de arquitectura ya cerradas. No revisitar sin pedido explícito. |
| 1 | [`01-arquitectura.md`](01-arquitectura.md) | Las piezas y cómo se conectan. Flujo de datos. |
| 2 | [`02-infraestructura.md`](02-infraestructura.md) | Inventario real de lo que existe en Firebase y GCP. |
| 3 | [`03-modelo-de-datos.md`](03-modelo-de-datos.md) | Colecciones, campos, taxonomías. |
| 4 | [`04-funcionalidades.md`](04-funcionalidades.md) | Qué hace el sistema hoy, pantalla por pantalla. |
| 5 | [`05-patrones.md`](05-patrones.md) | Convenciones a respetar al escribir código acá. |
| 6 | [`06-decisiones.md`](06-decisiones.md) | Decisiones tomadas durante la implementación, y los desvíos del `CLAUDE.md` con su motivo. |
| 7 | [`07-seguridad.md`](07-seguridad.md) | Qué es público y qué no. Cómo se verifica. |
| 8 | [`08-operacion.md`](08-operacion.md) | Correr local, deployar, diagnosticar. |
| 9 | [`09-analitica.md`](09-analitica.md) | Taxonomía de eventos del panel: qué se mide, con qué nombre, y qué no sale nunca. |
| 10 | [`10-salud-del-codigo.md`](10-salud-del-codigo.md) | Diagnóstico medido: tamaño, acoplamiento, duplicación. Qué conviene arreglar, qué está bien y qué no hay que tocar. |
| 11 | [`11-ideas-de-producto.md`](11-ideas-de-producto.md) | Propuestas de funcionalidad con su argumento en contra, y lo que se descartó a propósito. Se lee antes de decidir qué sigue. |
| 12 | [`12-sitio-publico.md`](12-sitio-publico.md) | Diseño del sitio público (B-01, cerrado): URLs, pantallas, SEO, filtros y casos borde, cada sección con su estado y sus desvíos. Los hubs (B-108) y el marcado de navegación (B-107) ya se construyeron; lo que queda son detalles menores. |
| 13 | [`13-agentes.md`](13-agentes.md) | Los agentes y skills de `.claude/`: qué automatizan, cuándo invocarlos, y qué se decidió **no** automatizar porque ya hay un test. |
| 14 | [`14-plan-de-saneamiento.md`](14-plan-de-saneamiento.md) | Cómo se ataca el backlog acumulado sin que los frentes se pisen. Se reparte por archivo, no por tema. |
| 15 | [`15-mapa-de-trampas.md`](15-mapa-de-trampas.md) | Las trampas del `CLAUDE.md` §13, con qué test fija cada una — y cuál quedó sin red. Se verifica solo. |
| 16 | [`16-analitica-del-sitio.md`](16-analitica-del-sitio.md) | Arquitectura de la analítica del **sitio público**, que hoy no mide nada: qué preguntas contestaría un tablero, de dónde saldría cada dato, las fricciones traducidas a algo medible, y las **dos decisiones del dueño** que lo bloquean. Lo único construido de acá es el tablero del catálogo. |
| 17 | [`17-worktrees-pendientes.md`](17-worktrees-pendientes.md) | **Temporal, se borra cuando quede vacío.** Inventario de rescate de los 33 worktrees de `.claude/worktrees/` que dejaron las tandas de frentes en paralelo: qué se rescató, qué se borró, y los comandos que esperan la confirmación del dueño. |
| — | [`CHANGELOG.md`](CHANGELOG.md) | Qué se hizo y cuándo. |
| — | [`BACKLOG.md`](BACKLOG.md) | Qué falta, priorizado, con el motivo de cada cosa. |

## Estado en una línea

Panel de carga funcionando en producción y sync a Google Calendar andando. El
sitio público —que es la razón de ser del proyecto— **está publicado en
`agendaleh.ar`** con su índice, el listado, la página de detalle, la cartelera de
flyers, las páginas de mes, el archivo de lo que pasó y las tres páginas de texto;
y desde **B-109** tiene `canonical`, Open Graph, `sitemap.xml` y `robots.txt`, así
que se puede indexar. Los hubs (**B-108**) y el marcado de navegación
(**B-107**) se cerraron el 2026-09-02. Lo que queda del sitio son las cinco
imágenes de Open Graph (**B-291**).

| Paso (§10 del `CLAUDE.md`) | Estado |
|---|---|
| 1. Modelo + reglas + emuladores | ✅ |
| 2. Panel de admin (React) | ✅ |
| 3. Sitio público (SSG) | ✅ **publicado en `agendaleh.ar`** — `/events.json`, el listado, el detalle, `/cartelera` (B-265), `/agenda/{mes}` (B-113), `/pasadas`, `/ayuda`, `/contacto`, `/suscribirse`, y el `canonical` + Open Graph + `sitemap.xml` + `robots.txt` de B-109. **B-01 se cerró el 2026-09-02**; los hubs (B-108, mejora de indexación y no parte del paso) se cerraron ese mismo día. Diseñado en [`12-sitio-publico.md`](12-sitio-publico.md) |
| 4. Sync a Google Calendar | ✅ |
| 5. Trigger de rebuild | 🟡 código y workflow listos; falta que el dueño cree el PAT y la key de CI (B-20 del backlog) |

El paso 4 se hizo antes del 3 porque el usuario lo pidió en ese orden. El
`CLAUDE.md` advierte que el sync va al final "cuando el modelo ya no se mueva":
si el modelo cambia al construir el sitio público, hay que revisar
`functions/calendario.js`.

## Antes de tocar nada

1. **Leer `../CLAUDE.md` completo.** Tiene decisiones cerradas y una lista de
   trampas conocidas (§13) que ya costaron tiempo. Si algo parece mejorable,
   proponerlo — no cambiar de enfoque por cuenta propia.
2. **Correr los tests.** `npm test` — la suite imprime al terminar cuántos son
   (`Test Files` / `Tests`), y por eso el número **no se escribe acá**: envejeció
   tres veces en una semana y mientras tanto mentía con autoridad (B-662, y el
   chequeo que lo impide está en `tests/salud-del-codigo.test.ts`). **107** de esos tests
   necesitan los emuladores corriendo (`npm run emu`, que desde B-167 levanta
   también **Storage**), repartidos en **9** archivos: siete se saltean enteros
   y dos parciales — de `events-json-endpoint.integracion.test.ts` se saltean 4
   de sus 6 porque las dos ramas de credenciales no necesitan emulador, y de
   `emulador-aislado.test.ts` 2 de sus 13 porque once chequean la configuración
   y no el emulador. Si no están, se saltean solos — **salvo con
   `EXIGIR_EMULADOR=1`**, que es como los corre el CI justamente para que no se
   salteen en silencio. El desglose archivo por archivo está en
   [`10-salud-del-codigo.md`](10-salud-del-codigo.md) § 6.1.
2. **Correr los tests.** `npm test`. **El tamaño de la suite lo dice ella al
   terminar** (`Test Files` / `Tests`) y no está escrito acá a propósito: el
   conteo a mano quedó viejo cinco veces en dos semanas, y en un merge este mismo
   paso llegó a estar **tres veces** con tres números distintos (B-296). Un
   número que hay que actualizar a mano miente con autoridad hasta que alguien lo
   nota. `tests/salud-del-codigo.test.ts` lo hace cumplir (B-662).

   Lo que sí conviene saber, porque no se ve en la salida: los archivos
   `*.integracion.test.ts` necesitan los emuladores corriendo (`npm run emu`, que
   desde B-167 levanta también **Storage**), y si no están **se saltean solos** —
   salvo con `EXIGIR_EMULADOR=1`, que es como los corre el CI justamente para que
   no se salteen en silencio. Dos archivos más se saltean sin un `dist/`
   construido, y esos los cubre el paso 4 del gate.
3. **Nunca desarrollar el sync contra el calendario real.** Ver §10 del
   `CLAUDE.md`: un bug en el diff crea o borra eventos de verdad.
4. **Antes de cerrar un cambio, pasar los auditores** de
   [`13-agentes.md`](13-agentes.md) — privacidad, trampas y documentación — y
   cerrarlo con el skill `cerrar-cambio`. Corren además de los tests, sobre lo
   que la suite no puede ver.
