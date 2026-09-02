#!/usr/bin/env bash
#
# Reproduce a pedido el flaky de B-219: dos corridas concurrentes de la suite de
# integración contra el mismo emulador.
#
#   ./scripts/probar-concurrencia.sh                # dos bases distintas → verde
#   ./scripts/probar-concurrencia.sh --misma-base   # una sola base → rojo
#   ./scripts/probar-concurrencia.sh --rondas 5
#
# ── Por qué esto existe y está versionado ────────────────────────────────────
# B-219 juntó **cinco observaciones independientes**, de tres worktrees y dos
# días, de tests de integración que fallaban una de cada N corridas. Ninguna se
# pudo reproducir a voluntad, y eso fue lo que lo dejó abierto una semana: un
# rojo que no se reproduce enseña a re-correr en vez de mirar, y un arreglo que
# no se puede probar no se sabe si arregló.
#
# Este script cierra las dos mitades. Con `--misma-base` la falla aparece **6 de
# 6 veces** (2 a 10 tests rojos por corrida, distintos cada vez, con los mensajes
# de siempre: «el fixture dejó de tener…», «No existe(n) en `opciones/arancel`»).
# Sin la bandera —o sea con el `projectId` por checkout— las mismas seis corridas
# dan verde.
#
# Sirve para tres cosas: verificar el arreglo, **mutarlo** (la bandera apaga el
# aislamiento y la suite tiene que volver a romperse; si no se rompe, el arreglo
# no era lo que sostenía nada), y volver a mirar el bug de frente el día que
# aparezca una sexta observación.
#
# ── Lo que hay que tener a mano ──────────────────────────────────────────────
# Los emuladores arriba (`npm run emu`). Se le habla al mismo, que es el punto:
# lo que se particiona es el `projectId`, no el puerto (ver
# `scripts/project-id-emulador.mjs`).
set -u

MISMA_BASE=0
RONDAS=3
while [ $# -gt 0 ]; do
  case "$1" in
    --misma-base) MISMA_BASE=1; shift ;;
    --rondas) RONDAS="$2"; shift 2 ;;
    *) printf 'opción desconocida: %s\n' "$1" >&2; exit 2 ;;
  esac
done

cd "$(git rev-parse --show-toplevel)"

# La base de este checkout, y una segunda que hace de "el otro worktree". Con
# `--misma-base` las dos son la misma, que es el estado anterior a B-219.
A=$(node scripts/project-id-emulador.mjs)
if [ "$MISMA_BASE" = 1 ]; then
  B="$A"
  printf 'Modo --misma-base: las dos corridas comparten %s (se espera ROJO).\n\n' "$A"
else
  B="${A}-vecino-simulado"
  printf 'Dos bases: %s y %s (se espera VERDE).\n\n' "$A" "$B"
fi

# Los archivos que tocan el emulador. `storage-reglas` queda afuera a propósito:
# las reglas de Storage no se pueden particionar por proyecto (el
# `/internal/setRules` del emulador es global — ver `tests/emulador.ts`), así que
# incluirlo mediría un residual conocido y no el aislamiento de Firestore.
ARCHIVOS='tests/actividades.integracion.test.ts
tests/opciones.integracion.test.ts
tests/reportes.integracion.test.ts
tests/reportes-reintento.integracion.test.ts
tests/sitio-publico.integracion.test.ts
tests/events-json-endpoint.integracion.test.ts
tests/emulador-aislado.test.ts'

TMP=$(mktemp -d)
FALLARON=0

for i in $(seq 1 "$RONDAS"); do
  PUBLIC_FIREBASE_PROJECT_ID="$A" EXIGIR_EMULADOR=1 \
    npx vitest run --no-file-parallelism $ARCHIVOS >"$TMP/a-$i.log" 2>&1 &
  PA=$!
  PUBLIC_FIREBASE_PROJECT_ID="$B" EXIGIR_EMULADOR=1 \
    npx vitest run --no-file-parallelism $ARCHIVOS >"$TMP/b-$i.log" 2>&1 &
  PB=$!
  wait $PA; RA=$?
  wait $PB; RB=$?
  ROJOS_A=$(grep -c '×' "$TMP/a-$i.log" || true)
  ROJOS_B=$(grep -c '×' "$TMP/b-$i.log" || true)
  printf 'ronda %s → A: salida=%s rojos=%s | B: salida=%s rojos=%s\n' \
    "$i" "$RA" "$ROJOS_A" "$RB" "$ROJOS_B"
  if [ "$RA" != 0 ] || [ "$RB" != 0 ]; then
    FALLARON=$((FALLARON + 1))
    # Los logs de una ronda roja se conservan: son lo único que dice QUÉ se pisó.
    printf '  (logs en %s/a-%s.log y %s/b-%s.log)\n' "$TMP" "$i" "$TMP" "$i"
  fi
done

printf '\n%s de %s rondas con al menos una corrida en rojo.\n' "$FALLARON" "$RONDAS"
printf 'Logs de esta tanda: %s\n' "$TMP"

if [ "$MISMA_BASE" = 1 ]; then
  # Con la base compartida, VERDE es el resultado sospechoso: quiere decir que no
  # se logró reproducir, y entonces la corrida sin la bandera no prueba nada.
  if [ "$FALLARON" = 0 ]; then
    printf 'No se reprodujo con la base compartida: la prueba no concluye nada.\n'
    exit 1
  fi
  printf 'Reproducido. El aislamiento por projectId es lo que sostiene el verde.\n'
else
  [ "$FALLARON" = 0 ] || exit 1
  printf 'Dos checkouts concurrentes no se pisan.\n'
fi
