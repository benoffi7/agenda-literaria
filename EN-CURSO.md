# En curso

**Archivo de coordinación, no documentación.** Dice qué se está haciendo **ahora
mismo** y cómo retomarlo o abandonarlo. La documentación de verdad vive en
[`docs/`](docs/README.md).

## Nada en curso

La tanda del 2026-09-03 al 2026-09-07 cerró: **once frentes, todos integrados a
`main`**. Ningún agente corriendo, ninguna rama esperando, ningún worktree con
trabajo sin commitear.

`npm test` en **3.248** casos y 146 archivos, `tsc` limpio, los cinco pasos del
gate mecánico en verde, `npm audit --omit=dev` en **cero**, y Astro en **7.3.1**.

Si este archivo tiene contenido y nadie está trabajando, está mintiendo — y ahora
mismo dice la verdad.

**Lo que quedó abierto vive donde corresponde**, en
[`docs/BACKLOG.md`](docs/BACKLOG.md), priorizado. Tres cosas de esta tanda que
conviene no perder de vista, y que están anotadas allá:

1. **B-621 a medias**: el calendario y el tablero ya usan todo el ancho, pero
   **repartir la grilla del mes por dentro** —el trabajo real— no se hizo.
2. **B-720 y la tanda de modelo entraron por rescate**: los dos frentes murieron
   por el límite de sesión y su trabajo se commiteó a mano. Pasan la suite entera,
   pero **sus auditorías quedaron a medio aplicar**; el detalle está en
   `.estado/galeria.md` y `.estado/modelo.md`.
3. **La medición de sedes de B-100 quedó sin consumidor**: el tablero se reescribió
   en paralelo y se perdió el enganche. Hay un test que **fija ese estado**, así
   que el día que se reponga se cae y hay que acordarse de las dos aserciones que
   se retiraron.

**Y lo que espera una mano del dueño**, que ningún agente puede hacer: reverificar
el 301 de `agendaleh.com.ar`, los pasos de consola de GA4 y Search Console
(`docs/16-analitica-del-sitio.md` §9.4), desplegar las dos Functions programadas
que están escritas y sin desplegar, y decidir si el evento de un ciclo dice
«Encuentro 3 de 8» o «Encuentro 3» — lo único que bloquea B-160 y B-162.

## Cómo se coordinó, para la próxima

Lo que hizo que once frentes en paralelo no se pisaran: **propiedad exclusiva de
archivos** en cada brief, **rangos de numeración reservados** por frente, y
**commits atómicos** con una línea en `.estado/<frente>.md` después de cada uno.

Y las dos lecciones nuevas, las dos aprendidas a los golpes:

- **Los worktrees nacen de `origin/main`, no del `main` local.** Todos los frentes
  de esta tanda arrancaron en `d366f77` y el primer merge dio diez conflictos, tres
  `add/add` sobre archivos que ya existían. **Pushear antes de despachar.**
- **Resolver un conflicto quedándose con «los dos lados» rompe el código**, aunque
  el diff se vea razonable: se comió un `/*` de apertura en `sitemap.ts`, un `{/*`
  en `PieDePagina.astro` —que emitió el comentario como texto en las seis páginas—
  y partió en dos la unión de tipos de `Encabezado.astro`. Los tres los destapó el
  build, no la suite.
