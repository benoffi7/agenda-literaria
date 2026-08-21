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
| — | [`CHANGELOG.md`](CHANGELOG.md) | Qué se hizo y cuándo. |
| — | [`BACKLOG.md`](BACKLOG.md) | Qué falta, priorizado, con el motivo de cada cosa. |

## Estado en una línea

Panel de carga funcionando en producción y sync a Google Calendar andando.
Falta el sitio público, que es la razón de ser del proyecto.

| Paso (§10 del `CLAUDE.md`) | Estado |
|---|---|
| 1. Modelo + reglas + emuladores | ✅ |
| 2. Panel de admin (React) | ✅ |
| 3. Sitio público (SSG) | ⬜ **lo próximo** |
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
2. **Correr los tests.** `npm test` — 365 tests. 21 necesitan los emuladores
   corriendo (`npm run emu`); si no están, se saltean solos.
3. **Nunca desarrollar el sync contra el calendario real.** Ver §10 del
   `CLAUDE.md`: un bug en el diff crea o borra eventos de verdad.
