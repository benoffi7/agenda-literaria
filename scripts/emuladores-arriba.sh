#!/usr/bin/env bash
#
# ¿Hay emuladores de Firebase ya escuchando, y en qué hosts?
#
# Escribe cinco líneas `clave=valor`:
#
#   arriba=true|false
#   hub=127.0.0.1:4400
#   firestore=127.0.0.1:8080
#   auth=127.0.0.1:9099
#   storage=127.0.0.1:9199
#
# Vive en un script y no dentro de `verificar-todo.sh` por el mismo motivo que
# `que-deployar.sh` no vive dentro del workflow (B-180): es una decisión con dos
# ramas y "producción" para ella es el momento de pushear, o sea el peor momento
# para descubrir que elige mal. Acá se le puede apuntar `FIREBASE_EMULATOR_HUB`
# a un servidor HTTP de dos líneas y verificar las dos ramas —
# `tests/emuladores-arriba.test.ts`.
#
# Por qué la decisión importa: si los emuladores YA están arriba —`npm run emu`
# en otra terminal, que es como se trabaja— `emulators:exec` intenta levantar los
# suyos, encuentra los puertos tomados y corta con "port taken". El gate fallaba
# entonces por su propia plomería: los emuladores estaban, la suite pasaba, y el
# push no salía. Un gate que falla así enseña a saltearlo, y ahí deja de ser un
# gate.
#
# Se preguntaba **solo por el hub**, y el motivo escrito era: "el hub es el que
# `emulators:exec` va a querer para sí, así que es la respuesta a la pregunta que
# de verdad se está haciendo (¿puedo levantar los míos?). Un Firestore vivo con el
# hub caído todavía haría fallar el `exec`".
#
# ── Por qué esa conclusión se dio vuelta (2026-09-03) ──────────────────────
# La premisa es cierta y la conclusión era la contraria. Si hay emuladores
# escuchando en los puertos pero **sin hub** —un `emulators:exec` de otro
# checkout, que levanta los tres y no deja hub en 4400—, la respuesta vieja daba
# `arriba=false`, el gate intentaba `exec`, chocaba de puertos y moría con "port
# taken". O sea que en ese estado el gate **no podía pasar de ninguna manera**:
# ni reusando (porque decía que no había) ni levantando (porque sí había).
#
# Justamente el caso que el docblock de arriba usa como argumento —"un Firestore
# vivo con el hub caído haría fallar el exec"— es la razón para **reusar**, no
# para intentar levantar: si el `exec` va a fallar, lo que no hay que hacer es
# el `exec`.
#
# Pasó de verdad al pushear la tanda del 2026-09-03, con los emuladores de otro
# frente arriba, y es el modo de falla de B-180 en su forma más pura: el gate
# falló por su propia plomería, la suite estaba verde, y la salida cómoda era
# `SALTEAR_PRE_PUSH=1`.
#
# Reusar la instancia de otro checkout es seguro por B-219: cada checkout tiene
# su propia base dentro del emulador (`project-id-emulador.mjs`), así que no se
# pisan los datos.
set -euo pipefail

HUB="${FIREBASE_EMULATOR_HUB:-127.0.0.1:4400}"
FIRESTORE="${FIRESTORE_EMULATOR_HOST:-127.0.0.1:8080}"
AUTH="${FIREBASE_AUTH_EMULATOR_HOST:-127.0.0.1:9099}"
STORAGE="${FIREBASE_STORAGE_EMULATOR_HOST:-127.0.0.1:9199}"

# `curl` **sin `-f`**: lo que se pregunta es "¿hay alguien escuchando?", no
# "¿contesta 200?". El emulador de Storage devuelve 501 a un GET pelado en la
# raíz, y eso es una respuesta perfectamente válida a esta pregunta. Con `-f`
# —que falla con cualquier status ≥ 400— Storage contaría como caído siempre.
puerto_vivo() {
  curl -s -o /dev/null --max-time 2 "http://$1/" 2>/dev/null
}

# El hub primero, que es una sola pregunta y la respuesta más completa; los tres
# puertos como respaldo, que es lo que el gate de verdad usa.
if curl -sf --max-time 2 "http://${HUB}/emulators" >/dev/null 2>&1; then
  ARRIBA=true
elif puerto_vivo "$FIRESTORE" && puerto_vivo "$AUTH" && puerto_vivo "$STORAGE"; then
  ARRIBA=true
else
  ARRIBA=false
fi

printf 'arriba=%s\n' "$ARRIBA"
printf 'hub=%s\n' "$HUB"
printf 'firestore=%s\n' "$FIRESTORE"
printf 'auth=%s\n' "$AUTH"
printf 'storage=%s\n' "$STORAGE"
