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
# Se pregunta por el **hub** y no por Firestore a propósito: el hub es el que
# `emulators:exec` va a querer para sí, así que es la respuesta a la pregunta que
# de verdad se está haciendo ("¿puedo levantar los míos?"). Un Firestore vivo con
# el hub caído todavía haría fallar el `exec`.
set -euo pipefail

HUB="${FIREBASE_EMULATOR_HUB:-127.0.0.1:4400}"

# `curl -sf` falla con cualquier status ≥ 400, así que un hub que contesta un
# error de servidor cuenta como "no está": es lo prudente — preferimos levantar
# unos propios antes que correr la suite contra algo que no sabemos qué es.
if curl -sf --max-time 2 "http://${HUB}/emulators" >/dev/null 2>&1; then
  ARRIBA=true
else
  ARRIBA=false
fi

printf 'arriba=%s\n' "$ARRIBA"
printf 'hub=%s\n' "$HUB"
printf 'firestore=%s\n' "${FIRESTORE_EMULATOR_HOST:-127.0.0.1:8080}"
printf 'auth=%s\n' "${FIREBASE_AUTH_EMULATOR_HOST:-127.0.0.1:9099}"
printf 'storage=%s\n' "${FIREBASE_STORAGE_EMULATOR_HOST:-127.0.0.1:9199}"
