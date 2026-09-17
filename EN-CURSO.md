# En curso

**Archivo de coordinación, no documentación.** Dice qué se está haciendo **ahora
mismo** y cómo retomarlo o abandonarlo. La documentación de verdad vive en
[`docs/`](docs/README.md).

## Tanda del 2026-09-17: seis frentes de infra y tests — cerrada e integrada

**Terminada el mismo día. Se deja escrita porque de acá salen tres cosas para la
próxima**, no porque quede trabajo. Lo que está abierto vive en
[`docs/BACKLOG.md`](docs/BACKLOG.md): **B-1030** (la asimetría de `storage.rules`
con el claim, que es lo único con filo), **B-1010** y **B-1050**.

Seis frentes en worktrees (`.claude/worktrees/<frente>`, ramas `frente/*`) sobre
ocho ítems de la red de contención: B-964, B-892, B-877, B-878, B-875, B-916,
B-895 y B-925. En paralelo, la sesión del dueño trabajó los formularios de la
Guía en el árbol principal. Todo integrado por merge y pusheado; la suite en el
principal quedó en **5381/5381**.

**Lo que funcionó, y ya venía escrito de la tanda del 2026-09-09:** propiedad
exclusiva de archivos por frente, rangos de ids reservados, commits atómicos con
una línea en `.estado/<frente>.md`, y **nadie toca `docs/CHANGELOG.md` ni
`docs/BACKLOG.md`** — los frentes devuelven el texto y lo integra quien orquesta.
Cero conflictos de merge en seis ramas.

Y tres cosas nuevas, las tres aprendidas acá:

- **Una sola tanda de emuladores para todos los worktrees alcanza** —cada uno le
  habla con su `projectId` derivado de la ruta (B-219)—, pero **corriendo
  integración a la vez aparecen rojos fantasma**. Tres frentes reportaron los
  mismos 4 tests rojos en `rol-publicador.integracion.test.ts` y uno estaba por
  abrirle un ítem; en el árbol principal, con todo integrado, pasan. Un rojo de
  integración visto desde un worktree no es un hallazgo hasta revalidarlo solo.
- **Dos frentes en paralelo pueden crear el bug que el otro está cerrando.**
  Mientras uno migraba los ~30 barridos que enumeran con `git ls-files` a secas
  (B-964), otro escribió una guarda nueva con `git ls-files` a secas. **La guarda
  de B-964 lo agarró en el merge**, que es donde tenía que agarrarlo. Un frente
  que cierra una clase tiene que dejar la guarda, no solo migrar las instancias:
  es lo único que alcanza a lo que se escribe en paralelo.
- **Un archivo intocable para un frente deja un sobrante, y el que integra lo
  cierra.** B-892 arregló trece de catorce líneas; la catorceava estaba en un
  archivo del frente de B-925. Llegó a tener número reservado (B-1020) y se
  aplicó al integrar los dos, antes de escribirse. Lo mismo con B-1000. Conviene
  mirar los «archivos ajenos que no toqué» de cada informe antes de escribir el
  backlog: la mitad se cierra sola al juntar las ramas.

**Y una del árbol compartido, que no es de esta tanda pero se pagó en ella:** un
`git add -A` en el principal se llevó 21 archivos bajo un mensaje que nombraba
uno solo (`601442b`). `EN-CURSO.md` decía quién era dueño de qué y no se leyó.
Este archivo solo sirve si se lee **al arrancar**, no al terminar.

## Tanda del 2026-09-09: la tajada 1 de `/proponer`, y frentes en paralelo sobre el BACKLOG

**Este archivo dice que si tiene contenido y nadie trabaja está mintiendo. El
2026-09-09 estuvo mintiendo del otro lado:** decía «nada en curso» con cuatro
frentes escribiendo el árbol, y con tres cifras caducadas —la suite, `npm audit`
en cero— que la remedición de **B-849** salió a buscar. La que sí seguía siendo
cierta era Astro en 7.3.1. Lo encontró el propio frente de B-849 y por eso se
reescribe acá: un archivo de coordinación que se olvida de la coordinación en
curso es el peor de los dos errores, porque el que llega no tiene forma de saber
qué se está tocando.

**Qué pasó, en una línea:** se ejecutó el §5 de `docs/prd/05-inventario-de-archivos.md`
—la tajada 0 y la tajada 1 de `/proponer`, un commit por paso— y en paralelo se
largaron frentes sobre ítems abiertos del BACKLOG, con **commits atómicos y
propiedad exclusiva de archivos** como única regla de coordinación: los frentes no
commitean y nunca tocan `docs/CHANGELOG.md` ni `docs/BACKLOG.md` — devuelven el
texto y lo integra quien orquesta.

**La tajada 1 está completa salvo el anuncio.** Lo que falta es del dueño y está
en **B-836a**: publicar App Check, verificar dominios, verificar que las peticiones
lleguen firmadas y recién entonces *enforcing*. Hasta que eso pase, el `allow
create` de `/propuestas` y el de `propuestas/` en Storage **siguen con
`esAdmin() &&`** y se abren **los dos juntos**, no de a uno.

Las cifras de esta tanda no se escriben acá: el §1 de
[`docs/10-salud-del-codigo.md`](docs/10-salud-del-codigo.md) las tiene remedidas y
con el comando que produjo cada una.

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
