#!/usr/bin/env bash
#
# Re-releva la infra del proyecto y la compara contra lo que
# `docs/02-infraestructura.md` afirma — B-123.
#
#   ./scripts/relevar-infra.sh          # releva y compara
#   ./scripts/relevar-infra.sh --crudo  # solo imprime el estado, sin comparar
#
# **Por qué existe.** El documento dice que fue relevado "con `gcloud` y `firebase`,
# no de memoria", y trae los comandos para repetirlo. Nadie los repetía. El
# `auditor-documentacion` puede ver que la doc se contradice consigo misma, pero no
# puede saber qué Functions están desplegadas: no tiene credenciales y no debe
# tenerlas (§5.4). El 2026-08-25 eso costó caro — la doc afirmaba que faltaba
# trabajo terminado hacía días, y B-20 parecía mucho más grande de lo que era.
#
# **El drift de la infra va casi siempre en la misma dirección**: alguien despliega
# algo y no vuelve al documento. Así que el error que este script atrapa es
# "la doc dice que falta algo que ya está", no al revés.
#
# La comparación vive en `comparar-infra.sh`, que no necesita credenciales y por eso
# tiene tests. Acá está solo lo que requiere red y ADC.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

PROYECTO='agenda-literaria'
REPO='benoffi7/agenda-literaria'
CRUDO=false
[ "${1:-}" = '--crudo' ] && CRUDO=true

falta() { command -v "$1" >/dev/null || { echo "hace falta $1 en el PATH" >&2; exit 2; }; }
falta gcloud

# Falla temprano y con un mensaje claro en vez de escupir errores de la API.
gcloud auth application-default print-access-token >/dev/null 2>&1 || {
  echo "gcloud no está autenticado: corré \`gcloud auth application-default login\`" >&2
  exit 2
}

estado() {
  gcloud functions list --project "$PROYECTO" --format='value(name,state)' 2>/dev/null |
    while read -r nombre est; do printf 'funcion=%s %s\n' "$nombre" "$est"; done

  for SA in deploy-ci calendar-sync; do
    gcloud projects get-iam-policy "$PROYECTO" \
      --flatten='bindings[].members' \
      --filter="bindings.members:${SA}@${PROYECTO}.iam.gserviceaccount.com" \
      --format='value(bindings.role)' 2>/dev/null |
      while read -r rol; do printf 'rol=%s %s\n' "$SA" "$rol"; done
  done

  gcloud secrets list --project "$PROYECTO" --format='value(name)' 2>/dev/null |
    while read -r s; do printf 'secreto=%s\n' "$s"; done

  # Los secrets de GitHub no viven en GCP. Sin `gh` o sin permiso, se saltea con
  # aviso en vez de inventar que no hay ninguno: "no pude ver" y "no existe" no son
  # lo mismo, y confundirlos es lo que haría que el comparador mienta.
  if command -v gh >/dev/null; then
    if SECRETS=$(gh secret list --repo "$REPO" --json name --jq '.[].name' 2>/dev/null); then
      printf '%s\n' "$SECRETS" | while read -r s; do
        [ -n "$s" ] && printf 'secreto_gh=%s\n' "$s"
      done
    else
      echo "aviso: \`gh secret list\` no pudo leer los secrets de $REPO (¿cuenta activa sin permiso?)" >&2
      echo "       probá: export GH_TOKEN=\$(gh auth token --user benoffi7)" >&2
      echo 'secreto_gh=?no-se-pudo-leer' 
    fi
  fi
}

if $CRUDO; then
  estado
  exit 0
fi

echo "Relevando $PROYECTO..."
echo
estado | ./scripts/comparar-infra.sh
