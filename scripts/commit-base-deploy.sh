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
  # B-562 — `version.json` NO publica un campo `.sha` (`INFO_VERSION` es solo
  # `{version, generadoEn}`), así que la lectura de arriba siempre daba vacío y
  # B-205 caía al `before` del push: quedó inerte. El sha sí está, embebido en
  # `version` como `<x.y.z>+<sha>` (`componerVersion`, `scripts/version.mjs`).
  # Se extrae de ahí, y **solo** cuando es un build limpio: `+<7-40 hex>` y nada
  # después. Un build sucio (`+<sha>-sucio.<sello>`) o sin git (`+sin-git.<sello>`)
  # no termina en hex puro, así que no matchea y se cae al `before`, que es lo
  # correcto — de un build sucio no se puede confiar el sha como base.
  if [ -z "$PUBLICADO" ]; then
    VERSION=$(printf '%s' "$RESPUESTA" | jq -r '.version // empty' 2>/dev/null || true)
    PUBLICADO=$(printf '%s' "$VERSION" | sed -n 's/^[^+]*+\([0-9a-f]\{7,40\}\)$/\1/p')
  fi
  if [ -n "$PUBLICADO" ] && git cat-file -e "${PUBLICADO}^{commit}" 2>/dev/null; then
    ANTES="$PUBLICADO"
  fi
fi

if [ -z "$ANTES" ]; then
  ANTES="${EVENT_BEFORE:-}"
fi

printf 'ANTES=%s\n' "$ANTES"
