# En curso

**Archivo de coordinación, no documentación.** Dice qué se está haciendo **ahora
mismo** y cómo retomarlo o abandonarlo. La documentación de verdad vive en
[`docs/`](docs/README.md).

## Tanda del 2026-09-03 — tres frentes trabajando

**Sí hay trabajo en curso.** Hasta hace un rato este archivo decía «Nada en
curso» con tres agentes escribiendo, que es exactamente la forma en que se vuelve
inútil: si miente una vez, nadie lo vuelve a leer. La regla que ya estaba escrita
acá —«si este archivo tiene contenido y nadie está trabajando, está mintiendo»—
vale igual de fuerte al revés.

| Frente | Dónde trabaja | Propiedad exclusiva de archivos |
|---|---|---|
| **Sitio público** | working tree principal, `main` | `src/**`, `tests/**`, `docs/12-sitio-publico.md`, `docs/04-funcionalidades.md` |
| **Panel de admin** | worktree `.claude/worktrees/agent-a772193cbf625e130` (locked) | el panel, en su propio worktree |
| **Rescate, salud y cierre de doc** | working tree principal, `main` | `EN-CURSO.md`, `.estado/**`, `.gitignore`, `docs/README.md`, `docs/02-infraestructura.md`, `docs/08-operacion.md`, `docs/10-salud-del-codigo.md`, `docs/13-agentes.md`, `docs/14-plan-de-saneamiento.md`, `docs/17-worktrees-pendientes.md`, y cualquier archivo dentro de los otros worktrees |

**Dos frentes comparten el working tree principal.** Eso funciona por una sola
razón, y no es la suerte: los conjuntos de archivos no se cruzan y **cada commit
se hace por path explícito**. Ver «la regla que no se negocia», abajo.

### Compartido por los tres, no lo toca nadie por su cuenta

`docs/CHANGELOG.md`, `docs/BACKLOG.md`, `docs/06-decisiones.md`,
`firestore.rules`, `functions/**`, `package.json` y `package-lock.json`.

Lo que un frente quiera dejar en el CHANGELOG o el BACKLOG lo escribe en
`.estado/<frente>.md` **con el formato del archivo destino**, y el orquestador lo
pega. Es lo que evita tres agentes editando a la vez un archivo de 470 KB.

*(Por eso el `npm audit fix` de la vulnerabilidad de `uuid` —la única de las tres
de producción que se arregla sin romper nada— quedó anotado y no hecho: toca
`package-lock.json`. Ver [`docs/10-salud-del-codigo.md`](docs/10-salud-del-codigo.md)
§ 6.2.)*

### El estado de cada frente

En [`.estado/`](.estado/README.md), un archivo por frente. Vive fuera de git a
propósito: es coordinación, no historia. Una línea por tramo cerrado, con el hash
del commit.

---

## Cómo parar

**Se para solo: no hay nada que desarmar** — nadie pushea y nadie mergea. Lo
único que se puede perder es lo que no esté commiteado.

1. **Antes de cortar, que cada frente commitee lo que tenga.** El 2026-09-02 se
   frenó una tanda de seis y cuatro frentes tenían **cero commits** con hasta 16
   archivos en disco. El rescate de eso está en
   [`docs/17-worktrees-pendientes.md`](docs/17-worktrees-pendientes.md), y la
   lección es de proceso: el commit por tramo cerrado no puede ser algo que va a
   pasar «al final», porque cuando la tanda se frena, «al final» no llega.
2. **`git status` del working tree principal** dice qué quedó sin commitear y de
   quién es, cruzando contra la tabla de propiedad de arriba.
3. **Lo que quedó abierto va a `docs/BACKLOG.md`**, priorizado, con el motivo. La
   regla de proceso del [`CLAUDE.md`](CLAUDE.md) no se suspende porque la tanda
   se corte.

### La regla que no se negocia

**`git add <paths>` explícitos, NUNCA `git add -A`.**

Con dos frentes en el mismo working tree, un `add -A` se lleva puesto el trabajo
del otro dentro de un commit que dice otra cosa. Ya pasó el 2026-09-02: dos
frentes mezclados en dos commits, y hubo que rearmar la historia. No es una
preferencia de estilo — es la condición para que dos agentes compartan un árbol.

### Worktrees

De los 33 que había quedan **8**, cada uno con su motivo en
[`docs/17-worktrees-pendientes.md`](docs/17-worktrees-pendientes.md), junto con
los comandos de borrado que esperan la confirmación del dueño.

**Dos no se tocan por ningún motivo:** `agent-a772193cbf625e130` (el frente del
panel, trabajando ahora) y `agent-afaf97df7fb65b51f` (tiene el commit de rescate
`71f34d0`, que **no** está en `main`).

---

Lo que está abierto y **no** en curso vive donde corresponde: en
[`docs/BACKLOG.md`](docs/BACKLOG.md), priorizado.
