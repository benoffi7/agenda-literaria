#!/usr/bin/env bash
#
# Gate del §5.4 / trampa 4: si `firebase-admin` se cuela en un componente
# cliente, la service account key termina en el bundle público.
#
# Vive en un script y no dentro de un workflow porque lo usan dos workflows y
# porque conviene poder correrlo local antes de pushear. Duplicarlo en YAML era
# garantizar que una de las dos copias se quedara vieja.
#
#   ./scripts/verificar-bundle.sh [directorio]   (por defecto: dist)
#
# Falla cerrado: publicar la key es irreversible, así que ante la duda no se
# deploya.
set -euo pipefail

DIR="${1:-dist}"

if [ ! -d "$DIR" ]; then
  echo "::error::no existe $DIR — ¿corriste el build?"
  exit 1
fi

PATRON='firebase-admin|private_key|service_account|BEGIN PRIVATE KEY'

if ARCHIVOS=$(grep -rlE "$PATRON" "$DIR" 2>/dev/null) && [ -n "$ARCHIVOS" ]; then
  echo "::error::fuga de credenciales en $DIR/ (§5.4, trampa 4)"
  echo "$ARCHIVOS" | sed 's/^/  /'
  exit 1
fi

# Que el build no esté vacío: un `dist/` sin JS pasaría el grep sin problema y
# el chequeo no habría verificado nada.
if [ -z "$(find "$DIR" -name '*.js' -print -quit)" ]; then
  echo "::error::$DIR/ no tiene ningún .js — el build no produjo nada"
  exit 1
fi

echo "$DIR/ limpio: sin rastros del Admin SDK"
