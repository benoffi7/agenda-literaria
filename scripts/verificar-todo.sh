#!/usr/bin/env bash
#
# El gate mecánico de antes de pushear: todo lo que un script puede decidir sin
# criterio. Lo que necesita criterio (los tres auditores) va por el skill
# `antes-de-pushear`, porque un hook de git no puede invocar un modelo.
#
#   ./scripts/verificar-todo.sh
#
# Vive en un script y no dentro del hook por la misma razón que
# `que-deployar.sh` no vive dentro del workflow: así se puede correr a mano
# antes de pushear, y no hay dos copias de la decisión — el hook
# (`githooks/pre-push`) solo lo llama.
#
# **Falla cerrado.** Cualquier paso que falle corta acá con estado ≠ 0. Para
# saltearlo a propósito, es en el push:
#
#   SALTEAR_PRE_PUSH=1 git push        # deja el rastro en el shell
#   git push --no-verify               # ídem, más corto
#
# Tarda unos minutos: los tests corren con los emuladores arriba, y eso es el
# punto (ver el paso 3).
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

PASO=0
paso() {
  PASO=$((PASO + 1))
  printf '\n\033[1m[%d/5] %s\033[0m\n' "$PASO" "$1"
}

fallo() {
  printf '\n\033[31m✗ falló: %s\033[0m\n' "$1"
  printf 'El push no salió. Si es a propósito: SALTEAR_PRE_PUSH=1 git push\n'
  exit 1
}

# ── 1 · Marcadores de conflicto ───────────────────────────────────
# Primero porque es el más barato y el que ya se commiteó dos veces: si el
# árbol tiene marcadores, no vale la pena esperar el build para enterarse.
paso 'Marcadores de conflicto de git'
npx vitest run tests/sin-marcadores-de-conflicto.test.ts \
  || fallo 'hay marcadores de conflicto en archivos versionados'

# ── 2 · Tipos ─────────────────────────────────────────────────────
# `astro sync` antes de `tsc`: sin los tipos generados, `import.meta.env` no
# existe y el typecheck da doce errores que no son del cambio.
paso 'Typecheck (astro sync + tsc --noEmit)'
npx astro sync >/dev/null || fallo 'astro sync'
npx tsc --noEmit || fallo 'el typecheck no pasa'

# ── 3 · Tests, con los emuladores arriba ──────────────────────────
# `EXIGIR_EMULADOR=1` hace que los tests de integración FALLEN en vez de
# saltearse. Sin eso, `npm test` sin emuladores da verde salteando 43 tests en
# silencio, y las reglas de Firestore se pushean sin que nadie las haya
# probado. "Verde" tiene que distinguir entre "las reglas pasaron" y "las
# reglas no se probaron".
paso 'Tests con emuladores (EXIGIR_EMULADOR=1)'
# El emulador necesita Java. Se respeta el JAVA_HOME del entorno si ya está;
# si no, se prueba el de Homebrew, que es el que usa `npm run emu`.
if [ -z "${JAVA_HOME:-}" ] && [ -d '/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home' ]; then
  export JAVA_HOME='/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home'
fi
# Si los emuladores YA están arriba —`npm run emu` en otra terminal, que es como
# se trabaja— `emulators:exec` intenta arrancar los suyos, encuentra los puertos
# tomados y corta con "port taken". El gate fallaba entonces por el motivo
# equivocado: los emuladores estaban, la suite pasaba, y el push no salía.
#
# Un gate que falla por su propia plomería enseña a saltearlo, y ahí deja de ser
# un gate. Así que se detecta el hub del emulador y, si contesta, se usa el que
# está en vez de levantar otro.
#
# La detección se hace UNA vez y la contestan los pasos 3 y 4: los dos necesitan
# lo mismo, y tenerla escrita dos veces fue justamente lo que dejó al paso 4
# apuntando a un puerto que el paso 3 había apagado.
EMU_HUB="${FIREBASE_EMULATOR_HUB:-127.0.0.1:4400}"
HOST_FIRESTORE="${FIRESTORE_EMULATOR_HOST:-127.0.0.1:8080}"
if curl -sf --max-time 2 "http://${EMU_HUB}/emulators" >/dev/null 2>&1; then
  EMU_ARRIBA=1
else
  EMU_ARRIBA=0
fi

if [ "$EMU_ARRIBA" = 1 ]; then
  printf '  (emuladores ya arriba en %s: se usan esos)\n' "$EMU_HUB"
  FIRESTORE_EMULATOR_HOST="$HOST_FIRESTORE" \
    FIREBASE_AUTH_EMULATOR_HOST="${FIREBASE_AUTH_EMULATOR_HOST:-127.0.0.1:9099}" \
    FIREBASE_STORAGE_EMULATOR_HOST="${FIREBASE_STORAGE_EMULATOR_HOST:-127.0.0.1:9199}" \
    EXIGIR_EMULADOR=1 npm test \
    || fallo 'la suite no pasa con los emuladores arriba'
else
  EXIGIR_EMULADOR=1 npx firebase emulators:exec --only auth,firestore,storage \
    --project agenda-literaria 'npm test' \
    || fallo 'la suite no pasa con los emuladores arriba'
fi

# ── 4 · Build, leyendo Firestore de verdad ────────────────────────
# Desde que el build arma el `events.json` leyendo Firestore (B-106), un build
# sin credenciales produce el archivo con lista vacía y un aviso (D-123): no
# falla —es el camino local deliberado— pero tampoco ejercita la lectura, que es
# lo que corre en CI.
#
# La primera versión de este paso solo exportaba `FIRESTORE_EMULATOR_HOST` y
# decía que con eso alcanzaba. No alcanzaba (B-217): con el paso 3 en su rama de
# `emulators:exec` no había nadie escuchando, y con el emulador vivo los tests de
# integración lo habían dejado vacío — el build leía cero actividades y salía en
# verde. El gate agregado *para* garantizar «esto leyó Firestore» pasaba idéntico
# sin leer nada.
#
# Así que el paso siembra, buildea y **afirma sobre el archivo que salió**. El
# detalle está en el script; acá solo se decide contra qué emulador corre, con la
# misma detección del paso 3: el que ya está arriba, o uno efímero.
paso 'Build del sitio y del panel, leyendo Firestore de verdad'
if [ "$EMU_ARRIBA" = 1 ]; then
  FIRESTORE_EMULATOR_HOST="$HOST_FIRESTORE" \
    ./scripts/build-contra-emulador.mjs || fallo 'el build no pasa o no leyó Firestore'
else
  npx firebase emulators:exec --only firestore --project agenda-literaria \
    './scripts/build-contra-emulador.mjs' || fallo 'el build no pasa o no leyó Firestore'
fi

# ── 5 · Que la credencial no se filtró ────────────────────────────
# El gate del §5.4 / trampa 4, el mismo script que corre en los dos workflows.
# Va después del build a propósito: sin `dist/` no verifica nada.
paso 'Fuga de credenciales en dist/ (§5.4, trampa 4)'
./scripts/verificar-bundle.sh dist || fallo 'el bundle tiene rastros del Admin SDK'

printf '\n\033[32m✓ los cinco pasos mecánicos pasaron.\033[0m\n'
printf 'Lo que esto NO vio: privacidad de un campo nuevo, trampas del §13 en\n'
printf 'código nuevo, y si la doc acompaña al cambio. Eso es criterio, y va por\n'
printf 'el skill `antes-de-pushear` (lanza los tres auditores en paralelo).\n'
