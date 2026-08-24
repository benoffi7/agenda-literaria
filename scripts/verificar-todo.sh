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
EXIGIR_EMULADOR=1 npx firebase emulators:exec --only auth,firestore \
  --project agenda-literaria 'npm test' \
  || fallo 'la suite no pasa con los emuladores arriba'

# ── 4 · Build ─────────────────────────────────────────────────────
paso 'Build del sitio y del panel'
npm run build || fallo 'el build no pasa'

# ── 5 · Que la credencial no se filtró ────────────────────────────
# El gate del §5.4 / trampa 4, el mismo script que corre en los dos workflows.
# Va después del build a propósito: sin `dist/` no verifica nada.
paso 'Fuga de credenciales en dist/ (§5.4, trampa 4)'
./scripts/verificar-bundle.sh dist || fallo 'el bundle tiene rastros del Admin SDK'

printf '\n\033[32m✓ los cinco pasos mecánicos pasaron.\033[0m\n'
printf 'Lo que esto NO vio: privacidad de un campo nuevo, trampas del §13 en\n'
printf 'código nuevo, y si la doc acompaña al cambio. Eso es criterio, y va por\n'
printf 'el skill `antes-de-pushear` (lanza los tres auditores en paralelo).\n'
