# En curso

**Archivo de coordinación, no documentación.** Dice qué se está haciendo **ahora
mismo** y cómo retomarlo o abandonarlo. La documentación de verdad vive en
[`docs/`](docs/README.md).

## Tanda del 2026-09-22 — integrada salvo un frente, y **sin pushear**

> # ⚠️ LO PRIMERO AL RETOMAR: hay 58 commits sin pushear
>
> **Todo el trabajo de esta tanda existe solo en el disco de esta máquina.** Siete
> ramas mergeadas, dos decisiones del dueño, veintiún ítems escritos y dos
> decisiones nuevas. Nada de eso está en `origin`.
>
> El push necesita `gh auth switch --user benoffi7`: la cuenta activa suele ser la
> del trabajo y da **403**, y en ese caso el hook de `pre-push` **ni siquiera
> corre**, así que un 403 no dice nada del estado del árbol. El switch es global
> —mientras dure, cualquier sesión abierta en un repo de Modo ve la cuenta
> personal—, por eso lo autoriza el dueño y no se hace solo.
>
> **Dato medido el 2026-09-22, y es el argumento:** producción sirve
> `1.10.0+1acad60` con `main` **49 commits por encima**. Lo encontró el chequeo que
> nació ese mismo día (B-1121) — o sea que la primera cosa que hizo la red nueva
> fue destapar exactamente lo que B-205 describía.

### Qué entró

Siete ramas mergeadas, **cero conflictos**: `frente/emulador` y `frente/produccion`
(de una sesión hermana que trabajó en el árbol principal en paralelo) y los cinco
frentes de la tanda — `decisiones-2`, `instagram`, `analitica-doc`,
`calendario-ig`, `form-ig`. `tsc` limpio. Los barridos estructurales en verde:
ítems huérfanos, decisiones huérfanas, `agentes-y-skills`, `novedades`, anclas
internas de `docs/` en cero.

Cerrados: **B-1082, B-1085, B-1111, B-1112, B-1121, B-1142, B-1144, B-1145,
B-1147, B-1183**. Decisiones nuevas: **D-763**, **D-767**, **D-771**.

### Qué NO entró, y por qué

**`frente/estados` queda viva con 2 commits** (`e5dec4e`, `5e5a0cb`, B-1170 — el
barrido que compara el estado que un documento afirma de un ítem contra el
backlog). **No se mergeó a propósito:** no pasó sus auditores y no tiene escrito su
texto de BACKLOG ni de CHANGELOG. Entrar a `main` a medias sin su documentación
rompe la regla de proceso justo en el commit que cierra la jornada, y mañana nadie
sabría si ese barrido está terminado. En la rama es inequívoco.

**La suite completa no se corrió.** Es lo segundo a hacer al retomar, después del
push. **No se arrancó a propósito**: una corrida cortada a la mitad no dice nada y
deja el emulador colgado, que es el arrastre que costó B-1112.

### Para correr la suite, dos cosas que cuestan una tarde si no se saben

- **`npm run emu` no arranca en esta máquina**: el 5000 lo tiene `ControlCenter`
  (el receptor de AirPlay de macOS), no otro emulador. Va con
  `--only auth,firestore,storage`. Es **B-1200**.
- **Un emulador levantado desde OTRO checkout hace fallar en el acto todos los
  tests de integración**, desde `b8a5068`, y los casos quedan `skipped`. Si aparece
  esa cascada **no es que los frentes rompieron algo**: es que el emulador y el
  checkout no son el mismo. Levantar y correr desde el árbol principal.

### Lo que esta tanda enseñó, y es lo que conviene leer

**Tres de los cinco ítems cerraron corrigiendo el ítem que los abrió.** B-1142
daba por visible algo que no lo era —el panel ya mostraba el handle—; B-1145
afirmaba en su título un costo que no existe —la guarda compara dos recálculos con
el mismo código, no contra lo guardado—; y B-1147 estimaba un factor de cuatro que
era de casi seis. **Las tres afirmaciones se habían hecho leyendo el código
correcto y sacando la conclusión equivocada sobre el sistema.** Quedó como
**B-1162**: un hallazgo que afirma «esto se ve» tiene que decir si se reprodujo o
si se dedujo leyendo.

**Y el mismo día, dos veces, un chequeo verde no verificaba nada** — la red
cross-lenguaje de B-1121, escrita mal dos veces seguidas y delatada las dos por la
mutación y no por la inspección. Eso es **D-771**, que es a D-750 lo que «qué
mutar» es a «hay que mutar».

**Dos errores de quien integró, los dos agarrados antes de commitear y los dos de
la misma familia:** un barrido de anclas que borraba los `_` cuando GitHub los
conserva —llegó a «arreglar» dos enlaces que funcionaban— y una nota de rangos
reservados que escribía los extremos como `B-1150`/`B-1199`, que el barrido de
huérfanos leyó como **citas**: la nota que existe para no perder ids generó cinco
huérfanos y puso el chequeo en rojo.

### Lo que quedó abierto y vale más

- **B-1160** (P2, pero es el más filoso): `handleInstagram('casa#brandon')` devuelve
  `casa` — una cuenta real de otra persona. En un posteo la arroba **menciona**:
  linkea y notifica. Y no se queda en la salida, **se guarda así en el documento**.
  Hoy lo tapan dos puertas locales (D-763 en el calendario, D-767 en el formulario)
  y el saneador sigue igual.
- **B-1180**: bajar `src/lib/handle-instagram.mjs` a fachada de una línea. El parche
  está escrito y verificado.
- **B-1182** y **B-1161** en 🟡: las tres tablas del índice de salidas ya nombran a
  los productores que faltaban; falta la red que impide que se vuelvan a desfasar.

### Cómo se coordinó

Las mismas reglas de las dos tandas anteriores, y volvieron a funcionar: propiedad
exclusiva de archivos, rangos de ids reservados, commits atómicos, y **nadie toca
`docs/CHANGELOG.md`, `docs/BACKLOG.md` ni este archivo** — los frentes devuelven el
texto y lo integra quien orquesta. Estado compartido vivo en
`/tmp/agenda-literaria-frentes.md`, fuera del repo.

**Y una nueva, de esta máquina y no del repo:** ningún frente corre `npm test`
entero. Varias suites de vitest a la vez agotan la memoria y el sistema mata
procesos de fondo sin avisar; cada frente corre solo sus archivos y la suite
completa va una vez, al integrar.

**Al frenar no se perdió nada, y eso no fue suerte:** los seis worktrees estaban
limpios y los dos commits del único frente sin mergear estaban commiteados. Es lo
contrario del 2026-09-02, y lo que lo produjo fue exigir commits atómicos en el
brief de cada frente.

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
