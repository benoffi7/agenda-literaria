#!/usr/bin/env bash
#
# El gate del artefacto: qué NO puede estar en `dist/`, y qué SÍ tiene que estar.
#
#   ./scripts/verificar-bundle.sh [directorio]   (por defecto: dist)
#
# ── Las dos mitades ───────────────────────────────────────────────────────
# 1. **Que no esté el Admin SDK** (§5.4 / trampa 4): si `firebase-admin` se cuela
#    en un componente cliente, la service account key termina en el bundle
#    público. Es la mitad original, y la única que había.
# 2. **Que esté App Check** (B-868): la mitad simétrica, y faltaba. Un bundle al
#    que le sacaron `PUBLIC_RECAPTCHA_SITE_KEY`, o que quedó con la config de
#    emuladores, o al que le cambiaron el proveedor de reCAPTCHA, se ve idéntico
#    desde la suite (`tests/appcheck.test.ts` mira el fuente) y desde la mitad 1
#    (solo busca el Admin SDK). Deploy verde, y **el panel y `/proponer` dejan de
#    poder escribir**: sin token válido las reglas ni se evalúan y la consola
#    muestra cero peticiones verificadas, sin ninguna pista de por qué.
#
#    Desde el 2026-09-10 17:42 UTC eso no es hipotético: `firestore.googleapis.com`
#    quedó en **ENFORCED**. La mitad 2 es la diferencia entre un deploy y una caída.
#
# ── Por qué acá y no en un test que lea `dist/` ───────────────────────────
# El repo tiene tests que leen el artefacto (`sin-comentarios-en-el-html`,
# `terceros-antes-del-consentimiento`) y eran el precedente natural. **No sirven
# para esto**, y el motivo es el orden del pipeline: en `deploy.yml` los tests
# corren ANTES del build, y en `push-main.yml` corren en OTRO job —otro runner—
# que nunca buildea. En los dos casos `dist/` no existe cuando vitest mira, así
# que un test así se saltea en silencio exactamente donde tendría que morder.
# Este script es el paso que los dos workflows corren inmediatamente DESPUÉS del
# build, y el paso 5 de `verificar-todo.sh`, después del paso 4.
#
# Vive en un script y no dentro de un workflow porque lo usan dos workflows y
# porque conviene poder correrlo local antes de pushear. Duplicarlo en YAML era
# garantizar que una de las dos copias se quedara vieja.
#
# Falla cerrado: publicar la key es irreversible, y deployar un panel que no
# puede escribir se arregla tarde y a ciegas. Ante la duda no se deploya.
set -euo pipefail

DIR="${1:-dist}"
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"

if [ ! -d "$DIR" ]; then
  echo "::error::no existe $DIR — ¿corriste el build?"
  exit 1
fi

# ══════════════════════════════════════════════════════════════════════════
# 1 · Lo que no puede estar: el Admin SDK (§5.4, trampa 4)
# ══════════════════════════════════════════════════════════════════════════

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

# ══════════════════════════════════════════════════════════════════════════
# 2 · Lo que TIENE que estar: App Check — B-868
# ══════════════════════════════════════════════════════════════════════════
#
# Los tres hechos se midieron a mano sobre el bundle de producción el
# 2026-09-10 (con `curl` y `grep`, que es justamente la señal de que faltaba
# esta guarda) y se reprodujeron sobre el `dist/` que produce `npm run build`.
# Lo que hay abajo es cada uno convertido en aserto.
#
# **La clave de sitio es pública por diseño** —viaja en el bundle porque el
# navegador la necesita para pedir el desafío, ver `src/lib/appcheck.ts`—, así
# que buscarla en el artefacto no expone nada. Aun así los mensajes de error la
# imprimen recortada: los logs de Actions de un repo público los lee cualquiera
# y no hace falta dejarla escrita dos veces.

ENV_PROD="$RAIZ/.env.production"

# ── 2.1 · La declaración: `.env.production` tiene la clave ────────────────
# Se lee del `.env` y no se escribe acá porque el par declaración/artefacto es
# lo que se está verificando: «lo que el proyecto dice que va» contra «lo que
# el build produjo». Y porque el modo de falla que B-868 describe empieza acá —
# un merge o una limpieza de «variables que no se usan» que se lleva la línea.
#
# `astro build` corre siempre en modo producción, así que éste es el archivo que
# alimentó el bundle, tanto en los dos workflows como en `verificar-todo.sh`.
CLAVE=$(sed -n 's/^PUBLIC_RECAPTCHA_SITE_KEY=[[:space:]]*//p' "$ENV_PROD" 2>/dev/null \
  | head -1 | tr -d '\r' || true)

if [ -z "$CLAVE" ]; then
  echo "::error::.env.production no declara PUBLIC_RECAPTCHA_SITE_KEY (B-868)"
  echo "  Sin clave de sitio, App Check no se activa: \`motivoParaNoActivar\` devuelve"
  echo "  'sin-clave' y el panel sale a producción sin token. Con el enforcement de"
  echo "  Firestore puesto (desde el 2026-09-10), eso es el panel sin poder escribir."
  exit 1
fi

# ── 2.2 · La clave llegó al artefacto ─────────────────────────────────────
if ! grep -rqF --include='*.js' "$CLAVE" "$DIR" 2>/dev/null; then
  echo "::error::la clave de sitio de .env.production no está en ningún .js de $DIR/ (B-868)"
  echo "  Buscada: ${CLAVE:0:8}… — el build no la inlineó."
  echo "  Suele ser que se rompió el cableado (\`import.meta.env.PUBLIC_RECAPTCHA_SITE_KEY\`"
  echo "  en src/lib/firebase-client.ts), que la variable perdió el prefijo PUBLIC_ —sin él"
  echo "  Vite no la expone al cliente—, o que el build corrió con otro entorno encima."
  exit 1
fi

# ── 2.3 · Y viaja a `activarAppCheck`, con `usarEmuladores: false` ────────
# El aserto es sobre el **objeto literal** que se le pasa a `activarAppCheck`, y
# no sobre la cadena suelta: que la clave esté en algún lado del bundle no dice
# que alguien la use. Minificado se pierde el nombre de la función (`Ar(…)`) pero
# no las claves del objeto —ningún minificador renombra propiedades de un
# literal—, así que el literal es el borde estable:
#
#   {hayNavegador:typeof window<`u`,usarEmuladores:!1,claveDeSitio:`6Ldn…`}
#
# Se acepta `!1` y `false` (según minifique o no) y el orden de las propiedades
# no importa: se extrae el literal entero y se pregunta por su contenido.
#
# **Y se sigue la indirección**, que no es un lujo: se probó, y el bundler NO
# inlinea una constante de un solo uso. Hoistear la clave a un `const` de módulo
# —un refactor inocuo— deja el literal como `claveDeSitio:ms` y un aserto que
# solo mirara la cadena se pondría rojo por nada, que es la otra forma de que un
# chequeo deje de servir. Así que si el valor es un identificador, se busca su
# asignación en el bundle.
COMILLA='[`"'"'"']'
LIMITE='(^|[^A-Za-z0-9_$])'

LITERALES=$(grep -rhoE --include='*.js' '\{[^{}]*claveDeSitio[[:space:]]*:[^{}]*\}' "$DIR" 2>/dev/null || true)

LLAMADA=''
while IFS= read -r L; do
  [ -n "$L" ] || continue
  VALOR=$(printf '%s' "$L" | sed -n 's/.*claveDeSitio[[:space:]]*:[[:space:]]*\([^,}]*\).*/\1/p')
  # a) la clave escrita ahí mismo
  case "$VALOR" in *"$CLAVE"*) LLAMADA="$L"; break ;; esac
  # b) un identificador al que el bundle le asigna la clave
  if printf '%s' "$VALOR" | grep -qE '^[A-Za-z_$][A-Za-z0-9_$]*$' \
    && grep -rqE --include='*.js' "$LIMITE$VALOR=$COMILLA$CLAVE$COMILLA" "$DIR" 2>/dev/null; then
    LLAMADA="$L"
    break
  fi
done <<LITERALES_FIN
$LITERALES
LITERALES_FIN

if [ -z "$LLAMADA" ]; then
  echo "::error::la clave está en $DIR/ pero no viaja a \`activarAppCheck\` (B-868)"
  echo "  No hay ningún objeto literal con \`claveDeSitio\` que la lleve, ni directo ni"
  echo "  por una variable que el bundle inicialice con ella."
  echo "  Cambió el cableado de src/lib/firebase-client.ts: la clave se lee pero no se pasa."
  exit 1
fi

VISIBLE=$(printf '%s' "$LLAMADA" | sed "s|$CLAVE|${CLAVE:0:8}…|")

if ! printf '%s' "$LLAMADA" | grep -qE 'usarEmuladores:[[:space:]]*(!1|false)'; then
  echo "::error::el build de producción quedó con la configuración de emuladores (B-868)"
  echo "  $VISIBLE"
  echo "  Con \`usarEmuladores\` verdadero, \`motivoParaNoActivar\` devuelve 'emuladores' y"
  echo "  App Check no se activa. Revisá PUBLIC_USE_EMULATORS en .env.production y en el"
  echo "  entorno desde el que corriste el build."
  exit 1
fi

# ── 2.4 · El proveedor es el de Enterprise ────────────────────────────────
# **Por qué NO se mira `recaptcha/enterprise.js`.** Era el aserto obvio —y el que
# B-868 pedía— y no verifica nada. Medido sobre dos builds reales el 2026-09-10:
#
#   cadena en dist/            con ReCaptchaEnterpriseProvider   con ReCaptchaV3Provider
#   recaptcha/enterprise.js               sí                              sí
#   recaptcha/api.js                      sí                              sí
#
# Las dos las trae el **SDK de Auth**, que tiene su propio reCAPTCHA para sus
# flujos y lleva la tabla de los dos scripts en un solo objeto
# (`{recaptchaV2Script: …/api.js, recaptchaEnterpriseScript: …/enterprise.js}`).
# O sea que la trampa anotada en B-868 era más ancha de lo que decía: no es solo
# que `api.js` presente no pruebe que el proveedor esté mal — es que
# `enterprise.js` presente tampoco prueba que esté bien. Un aserto sobre esa
# cadena solo puede pasar.
#
# Lo que sí discrimina es el **endpoint de canje de App Check**: el proveedor en
# su forma operativa, la petición que el navegador hace de verdad. El bundler lo
# resuelve a uno solo, y va en los dos sentidos:
#
#   exchangeRecaptchaEnterpriseToken      sí                              no
#   exchangeRecaptchaV3Token              no                              sí
#
# Por eso se afirman los dos: el presente y el ausente. Con solo el primero, un
# bundle que llevara los dos proveedores pasaría.
if ! grep -rqF --include='*.js' 'exchangeRecaptchaEnterpriseToken' "$DIR" 2>/dev/null; then
  echo "::error::el bundle no usa el proveedor de reCAPTCHA Enterprise (B-868)"
  echo "  Falta el endpoint de canje \`exchangeRecaptchaEnterpriseToken\` en $DIR/."
  echo "  La clave del proyecto es Enterprise (score-based): con otro proveedor el token"
  echo "  se rechaza, y eso no se ve hasta que el enforcement está activo — o sea ahora."
  exit 1
fi

if grep -rqF --include='*.js' 'exchangeRecaptchaV3Token' "$DIR" 2>/dev/null; then
  echo "::error::el bundle canjea el token por el endpoint de reCAPTCHA v3 clásico (B-868)"
  echo "  \`exchangeRecaptchaV3Token\` está en $DIR/: alguien usa \`ReCaptchaV3Provider\`,"
  echo "  sea en lugar del de Enterprise o como fallback al lado. No son intercambiables:"
  echo "  cada uno valida contra un servicio distinto — ver src/lib/appcheck.ts."
  exit 1
fi

echo "$DIR/ limpio: sin rastros del Admin SDK"
echo "$DIR/ con App Check: clave ${CLAVE:0:8}… en el bundle, sin emuladores, proveedor Enterprise"
