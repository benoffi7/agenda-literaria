#!/usr/bin/env bash
#
# ¿La suite ya pasó para este commit en `push-main.yml`? — M-14 del PRD 6,
# decisión D del dueño.
#
# `deploy.yml` corre en cada rebuild por contenido (§8), o sea cada vez que
# alguien toca una actividad, y hasta acá repetía `npm test` entero aunque el
# commit fuera el mismo que ya había pasado el job «Tests y typecheck» de
# `push-main.yml`: ~2,5 minutos de Actions por edición. Los tests no leen la base
# de producción, así que sobre el mismo commit dan lo mismo; lo que sí depende
# del contenido está en «Que toda taxonomía declarada exista en la base» y en
# «Verificar el artefacto», que siguen corriendo siempre.
#
# ── Falla CERRADA, que es la condición de la decisión ──────────────────────
# Solo dice `saltear=true` si puede **confirmar** las tres cosas:
#
#   1. hay una corrida de `push-main.yml` cuyo `head_sha` es exactamente este;
#   2. en esa corrida el job «Tests y typecheck» terminó en `success` (no
#      `skipped`, no en curso, no cancelado);
#   3. todas las respuestas se pudieron leer.
#
# Cualquier otra cosa —sin token, la API no contesta, JSON que no parsea, la
# corrida todavía en curso, el job renombrado— es `saltear=false` y la suite
# corre. Un error de este script nunca puede terminar en «se deployó sin tests».
# Por eso además **siempre sale con 0**: un rojo acá cortaría el deploy, que es
# fallar hacia el lado de no publicar por un motivo que no es de los datos.
#
# Vive en un script y no como un `if` en el YAML por lo mismo que
# `que-deployar.sh` y `commit-base-deploy.sh`: para poder probarlo.
# `tests/suite-verde-del-commit.test.ts` le pone un `gh` de mentira adelante en
# el PATH y recorre los casos, incluido cada modo de fallar.
#
# El nombre del job lo ata el mismo test contra `push-main.yml`: si alguien lo
# renombra allá, esto dejaría de encontrarlo — que falla cerrado, pero pagaría
# la suite en cada rebuild sin que nadie se entere.
#
# Salida (para `$GITHUB_OUTPUT`), dos líneas:
#
#   saltear=true|false
#   motivo=<por qué, en una línea>
#
# Variables de entorno:
#   GH_REPO   dueño/repo
#   SHA       el commit que este deploy va a buildear (`github.sha`)
#   GH_TOKEN  lo lee `gh`; hace falta `actions: read`
set -uo pipefail

JOB_DE_LA_SUITE='Tests y typecheck'
WORKFLOW='push-main.yml'

decidir() {
  printf 'saltear=%s\nmotivo=%s\n' "$1" "$2"
  exit 0
}

[ -n "${GH_REPO:-}" ] || decidir false 'falta GH_REPO'
# Un sha completo y nada más: es lo único que se interpola en la URL.
printf '%s' "${SHA:-}" | grep -Eq '^[0-9a-f]{40}$' || decidir false 'SHA no es un commit completo'

CORRIDAS=$(gh api "repos/$GH_REPO/actions/workflows/$WORKFLOW/runs?head_sha=$SHA&per_page=20" 2>/dev/null) \
  || decidir false "no se pudieron leer las corridas de $WORKFLOW"

IDS=$(printf '%s' "$CORRIDAS" | jq -r --arg sha "$SHA" \
  '.workflow_runs[] | select(.head_sha == $sha) | .id' 2>/dev/null) \
  || decidir false "la respuesta de las corridas no se pudo leer"

[ -n "$IDS" ] || decidir false "no hay ninguna corrida de $WORKFLOW para $SHA"

for ID in $IDS; do
  printf '%s' "$ID" | grep -Eq '^[0-9]+$' || continue
  JOBS=$(gh api "repos/$GH_REPO/actions/runs/$ID/jobs?per_page=100" 2>/dev/null) || continue
  CONCLUSION=$(printf '%s' "$JOBS" | jq -r --arg job "$JOB_DE_LA_SUITE" \
    '[.jobs[] | select(.name == $job) | .conclusion][0] // ""' 2>/dev/null) || continue
  if [ "$CONCLUSION" = 'success' ]; then
    decidir true "«$JOB_DE_LA_SUITE» pasó en la corrida $ID de $WORKFLOW para este mismo commit"
  fi
done

decidir false "ninguna corrida de $WORKFLOW para $SHA tiene «$JOB_DE_LA_SUITE» en verde"
