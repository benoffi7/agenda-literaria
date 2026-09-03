#!/usr/bin/env bash
#
# Decide qué hay que deployar a partir de la lista de archivos que cambiaron.
# Lee la lista por stdin (una ruta por línea) y escribe cuatro líneas:
#
#   hosting=true|false
#   functions=true|false
#   firestore=true|false
#   storage=true|false
#
# Vive en un script y no dentro del workflow para poder testearlo:
# `tests/que-deployar.test.ts` le pasa listas de archivos y verifica la
# decisión. Un `if` en YAML no se puede probar hasta que ya deployó mal.
#
#   git diff --name-only A B | ./scripts/que-deployar.sh
set -euo pipefail

CAMBIOS=$(cat)

if [ -z "$CAMBIOS" ]; then
  printf 'hosting=false\nfunctions=false\nfirestore=false\nstorage=false\n'
  exit 0
fi

# ── Functions y reglas: lista blanca ──────────────────────────────
# Se puede porque son autocontenidos: `functions/` no importa nada de `src/`, y
# las reglas y los índices son archivos sueltos. Acá una lista blanca no puede
# quedarse corta.
FUNCTIONS=false
FIRESTORE=false
STORAGE=false
# `firebase.json` define la config de las Functions además de las cabeceras.
printf '%s\n' "$CAMBIOS" | grep -qE '^functions/|^firebase\.json$' && FUNCTIONS=true
printf '%s\n' "$CAMBIOS" | grep -qE '^firestore\.(rules|indexes\.json)$' && FIRESTORE=true
# B-167 — `storage.rules` es su propio target (`firebase deploy --only storage`),
# no entra en `--only firestore:rules`. Sin esta línea, un cambio de reglas de
# Storage se deploya **nunca** y el default silencioso es el peor de los dos:
# quedaría el bucket con las reglas viejas y nada lo diría.
#
# `firebase.json` también lo arrastra, igual que a las Functions: es donde está
# declarado qué archivo son las reglas de Storage.
printf '%s\n' "$CAMBIOS" | grep -qE '^storage\.rules$|^firebase\.json$' && STORAGE=true

# ── Hosting: lista NEGRA, a propósito ─────────────────────────────
# El bundle del panel depende de cosas que están fuera de `src/`: hoy
# `functions/calendario.js` entra por el alias `@calendario`, y mañana puede ser
# otra. Una lista blanca de rutas se pierde ese caso EN SILENCIO — el build
# sigue verde y producción queda con el panel viejo.
#
# Así que se invierte: hosting se deploya SIEMPRE salvo que todo lo que cambió
# sea provablemente incapaz de afectarlo. Un archivo nuevo y desconocido cae del
# lado de deployar, que es el error barato.
# `firestore.*` y `.firebaserc` son config del servidor: no los importa nadie,
# así que no pueden entrar al bundle. Tienen su propia decisión más arriba.
# `storage.rules` entra en la lista negra por el mismo motivo que
# `firestore.rules`: es config del servidor, no lo importa nadie, así que no
# puede entrar al bundle — y tiene su propia decisión más arriba. Sin esta
# línea caería en "archivo desconocido" y arrastraría un deploy de hosting de
# más, que es inofensivo pero mentiroso.
NO_AFECTAN='^docs/|^tests/|^\.github/|\.md$|^\.gitignore$|^firestore\.(rules|indexes\.json)$|^storage\.rules$|^\.firebaserc$|^scripts/(seed-emulador|preparar-produccion|set-admin-claim|aprobar-opciones|optimizar-imagenes|que-deployar|verificar-bundle|verificar-calendario)\.(mjs|sh)$'

RELEVANTES=$(
  printf '%s\n' "$CAMBIOS" \
    | grep -vE "$NO_AFECTAN" \
    | awk '!/^functions\// || /^functions\/calendario\.js$/' \
    | grep -v '^$' || true
)

HOSTING=false
[ -n "$RELEVANTES" ] && HOSTING=true

printf 'hosting=%s\nfunctions=%s\nfirestore=%s\nstorage=%s\n' "$HOSTING" "$FUNCTIONS" "$FIRESTORE" "$STORAGE"
