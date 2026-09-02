#!/usr/bin/env bash
#
# Alternativa a `git stash` para dejar el árbol de trabajo limpio a mitad de
# un rebase — B-236.
#
# `git stash` vive en `refs/stash`, que es del REPOSITORIO y no del
# working-tree: `git worktree` aísla el índice, el `HEAD` y los archivos, pero
# no el stash. Con varios worktrees trabajando en paralelo (como reparte
# `docs/14-plan-de-saneamiento.md`), un `git stash push` de un worktree corre
# la pila de **todos**, y un `git stash pop` del otro puede traerse el trabajo
# ajeno encima del propio. Pasó dos veces el 2026-08-27/28, y la segunda vez
# sin conflicto — el modo malo, donde el `pop` borra la entrada del stash y el
# trabajo ajeno queda mezclado en un árbol que no es el suyo, sin rastro.
#
# Un commit sí es por-worktree: vive en el HEAD de la rama de ESE checkout.
# "Guardar el desorden para poder rebasear" se resuelve con un commit
# temporal y un `reset --soft`, no con stash.
#
#   ./scripts/wip.sh guardar     # commitea todo (staged y no) como WIP
#   ...git rebase, git checkout, lo que haga falta con el árbol limpio...
#   ./scripts/wip.sh restaurar   # deshace ESE commit; los cambios vuelven al árbol
#
# `restaurar` no es un `git reset --soft HEAD~1` a ciegas: primero comprueba
# que el HEAD sea, de verdad, un commit de este script (por el mensaje). Si no
# lo es, se niega — la única forma segura de que "restaurar" no se coma un
# commit real de otra persona.
set -euo pipefail

MARCA='wip: guardado por scripts/wip.sh —'

uso() {
  echo "uso: $0 guardar | restaurar" >&2
  exit 2
}

guardar() {
  if git diff --quiet && git diff --cached --quiet; then
    echo 'no hay nada para guardar: el árbol ya está limpio' >&2
    exit 1
  fi
  git add -A
  git commit -q -m "${MARCA} $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo 'guardado en un commit temporal. Para volver: ./scripts/wip.sh restaurar'
}

restaurar() {
  local msg
  msg=$(git log -1 --format=%s 2>/dev/null || true)
  case "$msg" in
    "${MARCA}"*) ;;
    *)
      echo "el último commit no es un WIP de este script (\"$msg\"): no se toca" >&2
      exit 1
      ;;
  esac
  git reset --soft HEAD~1
  echo 'restaurado: el commit WIP se deshizo, los cambios siguen en el árbol'
}

case "${1:-}" in
  guardar) guardar ;;
  restaurar) restaurar ;;
  *) uso ;;
esac
