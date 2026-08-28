#!/usr/bin/env bash
#
# Compara lo que `docs/02-infraestructura.md` AFIRMA contra lo que el proyecto ES.
#
#   ./scripts/relevar-infra.sh | ./scripts/comparar-infra.sh
#   ... | ./scripts/comparar-infra.sh <otro-documento>    # para los tests
#
# Lee el estado real de stdin, en líneas `clave=valor`:
#
#   funcion=syncCalendar ACTIVE
#   rol=deploy-ci roles/datastore.viewer
#   secreto=GITHUB_TOKEN
#
# Vive separado de `relevar-infra.sh` por el mismo motivo que `que-deployar.sh`
# vive afuera del YAML: **la decisión se puede probar.** Consultar gcloud necesita
# credenciales que un agente no debe tener; comparar dos listas de texto, no. Así
# que `tests/comparar-infra.test.ts` le pasa estados inventados y verifica qué
# divergencias encuentra, sin tocar el proyecto real.
#
# **Qué compara, y por qué solo eso** (B-123). Las tres cosas que mintieron de
# verdad el 2026-08-25: el estado de las Functions, los roles de `deploy-ci@` y la
# existencia de los secretos. El resto del inventario —APIs, cabeceras, regiones—
# se sigue mirando a ojo con los comandos del documento: automatizar la comparación
# de todo pedía parsear prosa, y un comparador que se equivoca al leer la doc es
# peor que ninguno.
#
# Sale con 0 si la doc dice la verdad, 1 si encontró divergencias, 2 si no pudo
# leer el documento. Falla hacia el lado de avisar.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

# El documento es un argumento —con el real por defecto— para que los tests le
# puedan pasar inventarios inventados. Es la misma razón por la que
# `que-deployar.sh` recibe la lista de archivos por stdin en vez de correr `git`.
DOC="${1:-docs/02-infraestructura.md}"
[ -f "$DOC" ] || { echo "no existe $DOC"; exit 2; }

REAL=$(cat)
DIVERGENCIAS=0

aviso() {
  DIVERGENCIAS=$((DIVERGENCIAS + 1))
  printf '  ✗ %s\n' "$1"
}

# ── Lo que el documento afirma ────────────────────────────────────
# Tabla de Cloud Functions: `| `nombre` | trigger | estado |`. Se toma por
# desplegada si la celda de estado empieza con ACTIVE; cualquier otra cosa
# ("escrita, sin desplegar") cuenta como no desplegada.
doc_funciones_activas() {
  sed -n '/^| `syncCalendar`/,/^$/p' "$DOC" |
    awk -F'|' 'NF>=4 { gsub(/[` ]/, "", $2); gsub(/^ +| +$/, "", $4);
                       if ($4 ~ /^ACTIVE/) print $2 }'
}

doc_funciones_todas() {
  sed -n '/^| `syncCalendar`/,/^$/p' "$DOC" |
    awk -F'|' 'NF>=4 { gsub(/[` ]/, "", $2); if ($2 != "") print $2 }'
}

# Roles de `deploy-ci@`: el bloque de código de su sección, y solo ese. El texto de
# alrededor razona sobre roles que la cuenta NO tiene —los que se evaluaron y se
# descartaron— y contarlos como vigentes sería leer al revés (D-119, D-132).
doc_roles_deploy_ci() {
  awk '/^### Roles de `deploy-ci@`/ { dentro = 1 }
       dentro && /^```/ { bloque++; next }
       dentro && bloque == 1 { print $1 }
       dentro && bloque == 2 { exit }' "$DOC" | grep -E '^roles/' || true
}

# Los secretos, por sección: `### Secretos (Secret Manager)` y `### Secrets de
# GitHub Actions` tienen tablas de la misma forma, así que hay que acotar el rango o
# `FIREBASE_SERVICE_ACCOUNT` —que vive en GitHub, no en Secret Manager— aparece
# donde no va.
doc_secretos_en() {
  awk -v ini="$1" '
    $0 ~ ini { dentro = 1; next }
    dentro && /^#{2,3} / { exit }
    dentro { print }' "$DOC" |
    awk -F'|' '/^\| `[A-Z_]+` \|/ && $4 ~ /existe/ { gsub(/[` ]/, "", $2); print $2 }'
}

real() { printf '%s\n' "$REAL" | awk -v k="$1" -F'=' '$1 == k { print $2 }'; }

# ── Functions ─────────────────────────────────────────────────────
echo 'Cloud Functions'
REAL_ACTIVAS=$(real funcion | awk '$2 == "ACTIVE" { print $1 }' | sort)
DOC_ACTIVAS=$(doc_funciones_activas | sort)
DOC_TODAS=$(doc_funciones_todas | sort)

for f in $DOC_ACTIVAS; do
  printf '%s\n' "$REAL_ACTIVAS" | grep -qx "$f" ||
    aviso "la doc dice que \`$f\` está ACTIVE y el proyecto no la tiene desplegada"
done
for f in $REAL_ACTIVAS; do
  printf '%s\n' "$DOC_ACTIVAS" | grep -qx "$f" && continue
  if printf '%s\n' "$DOC_TODAS" | grep -qx "$f"; then
    aviso "\`$f\` está ACTIVE y la doc la muestra como no desplegada"
  else
    aviso "\`$f\` está desplegada y no figura en la tabla del documento"
  fi
done

# ── Roles de deploy-ci@ ───────────────────────────────────────────
echo 'Roles de deploy-ci@'
REAL_ROLES=$(real rol | awk '$1 == "deploy-ci" { print $2 }' | sort)
DOC_ROLES=$(doc_roles_deploy_ci | sort)
for r in $DOC_ROLES; do
  printf '%s\n' "$REAL_ROLES" | grep -qx "$r" ||
    aviso "la doc declara \`$r\` y la cuenta no lo tiene"
done
for r in $REAL_ROLES; do
  printf '%s\n' "$DOC_ROLES" | grep -qx "$r" ||
    aviso "la cuenta tiene \`$r\` y la doc no lo declara — revisá también 07-seguridad.md (§5.4)"
done

# ── Secretos ──────────────────────────────────────────────────────
echo 'Secret Manager'
REAL_SECRETOS=$(real secreto | sort -u)
for s in $(doc_secretos_en '^### Secretos \(Secret Manager\)' | sort -u); do
  printf '%s\n' "$REAL_SECRETOS" | grep -qx "$s" ||
    aviso "la doc dice que el secreto \`$s\` existe y no está en Secret Manager"
done

# ── Secrets de GitHub Actions ─────────────────────────────────────
# El que faltó todo el día 2026-08-25 y hacía fallar cada deploy. Se compara
# aparte porque no vive en GCP: lo lista `gh secret list`.
echo 'Secrets de GitHub Actions'
REAL_GH=$(real secreto_gh | sort -u)
# `?no-se-pudo-leer` es el centinela que manda `relevar-infra.sh` cuando `gh` no
# tiene permiso. **"No pude ver" no es "no existe":** tratarlos igual haría que este
# comparador reporte una divergencia inventada, que es peor que no comparar — la
# primera vez que grite en falso, se lo empieza a ignorar.
if printf '%s\n' "$REAL_GH" | grep -qx '?no-se-pudo-leer'; then
  echo '  · sin verificar: no se pudieron leer los secrets del repo'
else
  for s in $(doc_secretos_en '^### Secrets de GitHub Actions' | sort -u); do
    printf '%s\n' "$REAL_GH" | grep -qx "$s" ||
      aviso "la doc dice que el secret \`$s\` de GitHub existe y no está cargado"
  done
fi

# ── Cierre ────────────────────────────────────────────────────────
if [ "$DIVERGENCIAS" -eq 0 ]; then
  echo
  echo "✓ el inventario dice la verdad sobre Functions, roles y secretos."
  exit 0
fi

echo
echo "$DIVERGENCIAS divergencia(s). El documento es lo que hay que corregir:"
echo "  docs/02-infraestructura.md — y si cambió un rol, también docs/07-seguridad.md."
exit 1
