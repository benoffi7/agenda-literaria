#!/usr/bin/env bash
#
# Decide contra qué commit diffear un push a `main` — B-205.
#
# Vive en un script y no como un `if` inline en `push-main.yml` por el mismo
# motivo que `que-deployar.sh`: para poder probarlo. `tests/commit-base-deploy.test.ts`
# apunta `VERSION_JSON_URL` a un servidor de mentira y verifica la elección sin
# tocar el sitio real ni depender de qué haya publicado en este momento.
#
# El bug que arregla: `github.event.before` es el head del push ANTERIOR. Si
# esa corrida no llegó a deployar nada (falló al arrancar, se canceló, GitHub
# Actions tuvo un `major_outage`), el push siguiente diffea desde un commit que
# ya está en `main` pero nunca se publicó — y esos cambios quedan fuera del
# diff para siempre, sin ningún síntoma de este lado.
#
# La preferencia es lo que `/version.json` dice que está PUBLICADO de verdad
# (`INFO_VERSION.sha`, ver `scripts/version.mjs`): usarlo como base recupera
# solo el deploy que no ocurrió. Sin esa fuente disponible (el sitio no
# contesta, falta el campo `sha`, o ese commit no está en este historial), se
# cae al `before` del push — peor, pero mejor que no diffear nada.
#
# Salida, una sola línea — en mayúscula para poder `eval`uarla directo en el
# workflow como variable de shell:
#
#   ANTES=<sha-o-vacío>
#
# Variables de entorno:
#   VERSION_JSON_URL   default https://agendaleh.ar/version.json
#   EVENT_BEFORE       el `github.event.before` del push (puede venir vacío)
set -euo pipefail

URL="${VERSION_JSON_URL:-https://agendaleh.ar/version.json}"

ANTES=""
if RESPUESTA=$(curl -sf --max-time 10 "$URL" 2>/dev/null); then
  PUBLICADO=$(printf '%s' "$RESPUESTA" | jq -r '.sha // empty' 2>/dev/null || true)
  if [ -n "$PUBLICADO" ] && git cat-file -e "${PUBLICADO}^{commit}" 2>/dev/null; then
    ANTES="$PUBLICADO"
  fi
fi

if [ -z "$ANTES" ]; then
  ANTES="${EVENT_BEFORE:-}"
fi

printf 'ANTES=%s\n' "$ANTES"
