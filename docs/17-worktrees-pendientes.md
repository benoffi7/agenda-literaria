# Worktrees pendientes

**Inventario de rescate, no documentación de arquitectura.** Dice qué quedó
adentro de los worktrees de `.claude/worktrees/` de las tandas de frentes en
paralelo, qué se rescató, qué se borró y qué queda esperando la decisión del
dueño. Cuando la tabla quede vacía, este archivo se borra.

Levantado el **2026-09-03**, sobre `main` en `d366f77`.

---

## 0. Por qué existe este archivo

El 2026-09-02 se lanzaron seis frentes en paralelo sobre 48 ítems del backlog y
hubo que frenarlos a mitad de camino. Cuatro tenían **cero commits** y entre 10
y 16 archivos sin commitear. Sumado a las tandas anteriores, quedaron **33
worktrees** en `.claude/worktrees/` y nadie sabía qué había adentro de cada uno.

El riesgo no era el disco: era que un `git worktree remove --force` de limpieza
se llevara puesto trabajo que nunca se había commiteado. Este archivo es el
inventario que había que tener antes de borrar nada.

**Lo que se encontró, en tres números:**

| | |
|---|---|
| Worktrees inventariados | **33** |
| Con commits que **no** están en `main` | **0** (antes del rescate) |
| Con trabajo sin commitear | **2** — uno real (rescatado), uno de ruido |

Que los 33 tuvieran `git log main..HEAD` vacío es el hallazgo tranquilizador:
**el contenido commiteado de todos ya estaba integrado en `main`**. Todo lo que
podía perderse eran esos dos árboles sucios.

---

## 1. El rescate

### `agent-afaf97df7fb65b51f` — 14 archivos, trabajo real

El frente de las **miniaturas de la cartelera y del detalle** (B-320/B-321).
Quedó con 14 archivos modificados sin commitear y sin un solo archivo de ruido.
Lo que había adentro no era un borrador a medio hacer: era la corrección
**D-210** completa, con sus tests y su cierre de doc.

En una línea: el diseño original de B-320/B-321 se apoyaba en que «un candidato
de `srcset` que da 404 degrada al `src`», y eso es **falso** — el candidato
elegido reemplaza al `src`. Con la subida de imágenes propias viva desde 1.5.0 y
la Function de B-220 sin desplegar, la primera imagen propia que alguien subiera
salía con el afiche roto. La corrección introduce
`urlDeMiniaturaSiExiste(url, miniaturasConocidas)` y `miniaturasConocidas()`
—una sola lectura de Storage por build, no un pedido de red por imagen—, más
`adminBucket()` en `src/lib/firebase-admin.ts` y el
`FIREBASE_STORAGE_EMULATOR_HOST` de `vitest.config.ts` sin el cual los tests le
hablaban a **Storage de producción de verdad** y nadie lo notaba.

**Commiteado en su propio worktree, en su propia rama, como `71f34d0`.** No se
mergeó a `main` y no se va a mergear desde acá: el veredicto lo toma el dueño.

**Lo que este rescate NO hizo:** no corrió la suite, no revisó el diseño y no
verificó los números. Solo preservó lo que había en disco antes de que un
`remove` se lo llevara. Cualquier integración arranca por correr `npm test` en
esa rama.

### `agent-a20c256c5f5ca29b9` — ruido, no se commiteó nada

Un solo cambio sin commitear: `D .tmp-msg.txt`, la baja de un archivo de
borrador de mensaje de commit. **No se commiteó**, por la regla de no commitear
ruido: el archivo es basura de sesión y su baja tiene que ir en un commit que
diga eso, no en uno de rescate. La baja se hizo aparte, en `main` — ver
[`10-salud-del-codigo.md`](10-salud-del-codigo.md).

Este worktree **no se borró** porque su árbol sigue sucio: `git worktree remove`
lo rechaza sin `--force`, y `--force` es exactamente lo que este inventario
existe para no tener que usar.

---

## 2. La tabla

Convenciones de la columna **veredicto**:

- **`mergeable`** — tiene algo que falta en `main`. No se toca.
- **`ya-está-en-main`** — su contenido commiteado ya está integrado
  (`git rev-list --count main..HEAD` da 0). Borrable, salvo que esté `locked` o
  el árbol esté sucio.
- **`en-uso`** — un frente está trabajando adentro **ahora mismo**. No se toca
  por ningún motivo.
- **`basura`** — vacío o superado. *(Ninguno cayó acá: los 33 tienen al menos un
  commit real, ya integrado.)*

| Worktree (`agent-…`) | Último commit | Sin commitear | Rescate | Fuera de `main` | 🔒 | Veredicto | Borrado |
|---|---|---|---|---|---|---|---|
| `a0446ba06477c1cbe` | `a61a2f3` B-266 a B-268: la medición del peso, el cierre de doc, y lo que encontraron los auditores | no | — | no | | ya-está-en-main | ✅ |
| `a13c2497de80902bd` | `413780d` B-221: sumar limpiarImagenesHuerfanas al registro de triggers descubiertos | no | — | no | 🔒 | ya-está-en-main | queda (locked) |
| `a1dd78c13e2261555` | `169726b` Cierre de doc del frente del calendario: B-161, B-163, B-125, B-162, B-13 | no | — | no | | ya-está-en-main | ✅ |
| `a2004b4596a629353` | `7cfe665` docs: D-254 documentado, B-481 anotado, números del §6bis re-medidos | no | — | no | | ya-está-en-main | ✅ |
| `a20c256c5f5ca29b9` | `f163e2b` doc: cierre de los nueve ítems de tests e infraestructura | **sí** (`D .tmp-msg.txt`, ruido) | no aplica | no | | ya-está-en-main | **queda (árbol sucio)** |
| `a21c601f8a9bf76e0` | `9701302` Cierre de documentación de B-113 y B-231, y la octava salida pública | no | — | no | 🔒 | ya-está-en-main | queda (locked) |
| `a34327b53e6cd3920` | `561345d` fix(reportes): el barrido de centinelas era ciego a los campos post-creación (B-580) | no | — | no | 🔒 | ya-está-en-main | queda (locked) |
| `a34c67ad4384c5b56` | `08b0c9e` B-273: cierre de documentación — D-153, y el drift que el cambio dejó al descubierto | no | — | no | | ya-está-en-main | ✅ |
| `a371a62c2de97e7e1` | `ccec0d4` B-220 a B-223: subir imágenes propias a Storage | no | — | no | 🔒 | ya-está-en-main | queda (locked) |
| `a412eeae6cafd7b53` | `dc95463` B-260: el panel había cambiado de tipografía sin que nadie lo decidiera | no | — | no | | ya-está-en-main | ✅ |
| `a4a4fec919d5b252a` | `fee46b9` Cierre de documentación de B-110, con los hallazgos del auditor-documentacion | no | — | no | | ya-está-en-main | ✅ |
| `a556d0928bb817af0` | `badbb16` B-238: la hoja de filtros del teléfono es una capa modal de verdad | no | — | no | | ya-está-en-main | ✅ |
| `a58e99845cc7417f5` | `6e0224c` B-501/B-502: el tablero pasa a pestañas, y aparece «El sitio público» | no | — | no | | ya-está-en-main | ✅ |
| `a695f4b7d58544de5` | `51fba45` B-230: llevarse la agenda al calendario propio | no | — | no | | ya-está-en-main | ✅ |
| `a69d8405c9324bb88` | `f37ed25` Renumerar sobre los identificadores libres | no | — | no | | ya-está-en-main | ✅ |
| `a6b5528e29c93ce00` | `5e5c1cc` doc: CHANGELOG de los 5 hallazgos del auditor-privacidad | no | — | no | | ya-está-en-main | ✅ |
| `a6e4661ba89520975` | `9cf2976` B-125: scripts/verificar-calendario.mjs lee Calendar de verdad (D-293) | no | — | no | | ya-está-en-main | ✅ |
| `a772193cbf625e130` | `d366f77` 1.8.0: motivo al fallar una imagen (B-590) y el eje de encuentros (B-99) | no | — | no | 🔒 | **en-uso** (frente del panel, 2026-09-03) | queda (locked + en uso) |
| `a84c8ca8333cc67f5` | `7725c51` B-224 y D-130: N modalidades por actividad, cada una con su lugar y su ventana | no | — | no | | ya-está-en-main | ✅ |
| `a869359132864915a` | `1929bb3` BACKLOG y CHANGELOG de los nueve ítems, más los cinco hallazgos del auditor de doc | no | — | no | | ya-está-en-main | ✅ |
| `a956a41b1d6c1b099` | `678f671` B-220, B-300 y B-266: las imágenes propias se optimizan al subirlas | no | — | no | | ya-está-en-main | ✅ |
| `aa651eeba7f29b23a` | `8831aef` Los tres hallazgos del auditor-documentacion sobre este barrido | no | — | no | | ya-está-en-main | ✅ |
| `aab548dd8b32bb9a3` | `f91c449` B-253: cierre de documentación, con los dos auditores incorporados | no | — | no | | ya-está-en-main | ✅ |
| `ab4ae79d1ff00979a` | `90ac12b` B-108 (en curso): los hubs de búsqueda, el código y sus tests | no | — | no | | ya-está-en-main | ✅ |
| `abdbec002b0ee0a99` | `0a508ab` B-232: la ayuda y el contacto del sitio público | no | — | no | | ya-está-en-main | ✅ |
| `acf29c2a4aa04cb8d` | `38c72c1` docs: la arquitectura de la analítica, reescrita alrededor del propósito | no | — | no | | ya-está-en-main | ✅ |
| `ad748060f27d960bf` | `93f49ad` B-109 (6/4): el cierre de documentación y los cinco hallazgos del auditor | no | — | no | | ya-está-en-main | ✅ |
| `ad79905dc1db09da5` | `245b52f` doc: corregir el drift que quedó de «mientras no exista UI (B-40)» | no | — | no | 🔒 | ya-está-en-main | queda (locked) |
| `ae6541a8e1191b03e` | `020f621` B-296 (5/5): el cierre de documentación, y B-296 cerrado | no | — | no | | ya-está-en-main | ✅ |
| `af17eaa04dc71d6ed` | `858f76d` B-247: lo que encontraron los auditores, y el cierre de documentación | no | — | no | | ya-está-en-main | ✅ |
| `af2aee53ab3b09d14` | `5cbb428` Los tres del auditor-documentacion: la corrección hecha en un lugar y no en su gemelo | no | — | no | | ya-está-en-main | ✅ |
| `afaf97df7fb65b51f` | `71f34d0` **Rescate** del frente de imágenes: D-210, el `srcset` que rompía la portada | **sí, 14 archivos** | **`71f34d0`** | **sí, 1 commit** | | **`mergeable`** | **queda (es el rescate)** |
| `aff8e13e7bc5924e1` | `a438c3d` docs: B-215 — reverificada la adopción de `tests/fixtures/`, el número creció | no | — | no | | ya-está-en-main | ✅ |

---

## 3. Qué se borró y qué no

Se borró con `git worktree remove` (**sin `--force`, nunca**) solo lo que
cumplía las tres condiciones a la vez: sin cambios sin commitear, sin commits
fuera de `main`, y no `locked`.

| | |
|---|---|
| Borrados | **25** |
| Quedan | **8** |

Los 8 que quedan, con el motivo:

| Worktree | Motivo de que quede |
|---|---|
| `agent-a772193cbf625e130` | **En uso ahora mismo** por el frente del panel de admin. Locked. |
| `agent-afaf97df7fb65b51f` | Tiene el commit de rescate `71f34d0`, que no está en `main`. Decide el dueño. |
| `agent-a20c256c5f5ca29b9` | Árbol sucio (`D .tmp-msg.txt`). `remove` lo rechaza sin `--force`. |
| `agent-a13c2497de80902bd` | `locked` |
| `agent-a21c601f8a9bf76e0` | `locked` |
| `agent-a34327b53e6cd3920` | `locked` |
| `agent-a371a62c2de97e7e1` | `locked` |
| `agent-ad79905dc1db09da5` | `locked` |

**Por qué no se desbloqueó ninguno.** Un `locked` es una declaración explícita
de «esto no se toca», y desde afuera no se puede distinguir el lock que puso un
frente que sigue vivo del que quedó colgado de una tanda que ya terminó.
Desbloquear y borrar es una operación de un solo sentido; dejarlo en la tabla no
cuesta nada.

### Los comandos que quedan pendientes de la confirmación del dueño

Los cinco `locked` que ya no tienen nada que perder (su contenido está en
`main`, el árbol está limpio). **Uno por línea, para ejecutar de a uno y
mirando:**

```
git worktree unlock .claude/worktrees/agent-a13c2497de80902bd && git worktree remove .claude/worktrees/agent-a13c2497de80902bd
git worktree unlock .claude/worktrees/agent-a21c601f8a9bf76e0 && git worktree remove .claude/worktrees/agent-a21c601f8a9bf76e0
git worktree unlock .claude/worktrees/agent-a34327b53e6cd3920 && git worktree remove .claude/worktrees/agent-a34327b53e6cd3920
git worktree unlock .claude/worktrees/agent-a371a62c2de97e7e1 && git worktree remove .claude/worktrees/agent-a371a62c2de97e7e1
git worktree unlock .claude/worktrees/agent-ad79905dc1db09da5 && git worktree remove .claude/worktrees/agent-ad79905dc1db09da5
```

El del árbol sucio, una vez que se acepte perder la baja de `.tmp-msg.txt` (que
ya se hizo en `main` por su cuenta):

```
git -C .claude/worktrees/agent-a20c256c5f5ca29b9 checkout -- .tmp-msg.txt && git worktree remove .claude/worktrees/agent-a20c256c5f5ca29b9
```

**El del rescate, solo después de decidir qué pasa con `71f34d0`.** Si se
integra, el camino es revisar la rama y mergearla; si se descarta, recién ahí:

```
git worktree remove --force .claude/worktrees/agent-afaf97df7fb65b51f && git branch -D worktree-agent-afaf97df7fb65b51f
```

**El del frente del panel (`a772193cbf625e130`) no está en ninguna lista a
propósito.** No se borra hasta que ese frente cierre.

Después de cualquiera de estos, `git worktree prune` saca los registros que
queden apuntando a directorios que ya no existen. Ya se corrió una vez al
cerrar este inventario.

### Las 25 ramas que quedaron sin worktree

`git worktree remove` borra el directorio, **no la rama**. Las 25 ramas
`worktree-agent-*` de los worktrees borrados siguen ahí, apuntando a commits que
ya están en `main`. No molestan, pero ensucian `git branch`.

Se borran de una, y **con `-d` minúscula a propósito**: git rechaza el borrado si
la rama tuviera algo sin mergear, así que el comando es su propia red. Si alguna
se resiste, es que este inventario se equivocó con ella — y ahí hay que mirar,
no forzar.

```
git branch --list 'worktree-agent-*' | tr -d ' ' | while read b; do git branch -d "$b"; done
```

Eso va a dejar en pie, correctamente, las 8 ramas de los worktrees que siguen
existiendo, más `worktree-agent-afaf97df7fb65b51f`, que tiene el rescate.

---

## 4. La lección, que es de proceso y no de git

Cuatro frentes con cero commits y hasta 16 archivos en disco no es un accidente
de git: es que **el commit atómico por tramo cerrado no estaba siendo una
obligación del frente**, sino algo que iba a pasar «al final». Cuando la tanda
se frena a mitad de camino, «al final» no llega.

Lo que sí funcionó, y hay que conservar: la **propiedad exclusiva de archivos**
por frente y los commits **por path explícito**. Ningún frente de la tanda pisó
una línea de otro. Lo que falló fue la frecuencia del commit, no el reparto.

Ver [`14-plan-de-saneamiento.md`](14-plan-de-saneamiento.md) para cómo se
reparte una tanda, y [`../EN-CURSO.md`](../EN-CURSO.md) para la de hoy.
