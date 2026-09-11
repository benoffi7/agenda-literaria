#!/usr/bin/env bash
#
# El gate del artefacto: qué NO puede estar en `dist/`, y qué SÍ tiene que estar.
#
#   ./scripts/verificar-bundle.sh [directorio]   (por defecto: dist)
#
# ── Las cuatro secciones ──────────────────────────────────────────────────
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
# 3. **Que el HTML construido esté limpio** (B-873): ningún comentario de
#    plantilla emitido como texto (B-261) y ningún host de tercero contactado
#    antes del consentimiento (D-254, B-481). Son dos chequeos que ya existían
#    —como tests que leían `dist/`— y que por eso mismo no corrían en CI ni una
#    vez. La sección 3 cuenta la medición; el resumen es que este script es el
#    único lugar del pipeline donde `dist/` existe.
#
# 4. **Que lo que TIENE que estar en el artefacto esté** (B-880): la página que
#    Firebase sirve como 404 y las clases de la grilla que Tailwind tiene que
#    haber emitido a la hoja. Son otros dos chequeos que vivían como tests que
#    leían `dist/` —o sea B-873 otra vez, y el de la grilla peor: no se salteaba,
#    se reportaba **PASSED** habiendo mirado cero bytes—. La sección 4 cuenta la
#    medición.
#
#    Son cuatro y no dos, pero la simetría es la misma: qué no puede estar (1 y 3)
#    y qué tiene que estar (2 y 4).
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
# **Y el párrafo de arriba era, además, un hallazgo sin levantar.** Se escribió
# describiendo con precisión a esos dos tests y nadie fue a mirarlos: seguían
# prometiendo en su docblock la cobertura que este párrafo les negaba. Es B-873,
# y por eso los dos barridos son ahora la sección 3 de este archivo.
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

# ══════════════════════════════════════════════════════════════════════════
# 3 · El HTML construido: comentarios de plantilla (B-261) y terceros antes
#     del consentimiento (D-254 / B-481) — B-873
# ══════════════════════════════════════════════════════════════════════════
#
# **Estos dos barridos vivían en `tests/sin-comentarios-en-el-html.test.ts` y
# `tests/terceros-antes-del-consentimiento.test.ts`, y ahí no corrían en CI ni
# una vez.** Es B-873, y es exactamente lo que la sección «Por qué acá y no en
# un test que lea `dist/`» de esta misma cabecera venía advirtiendo desde B-868:
# los dos se salteaban con `it.skipIf(html.length === 0)` y los dos afirmaban en
# su docblock «en CI el build siempre corre, así que ahí no se saltea nunca».
#
# Medido el 2026-09-11 parseando los dos workflows, que es lo que lo vuelve un
# hecho y no una lectura:
#
#   deploy.yml    · job `deploy`    · `Tests` es el paso 4 y `Build` el paso 5
#   push-main.yml · job `verificar` · corre `npm test` y no buildea nunca
#                 · job `hosting`   · buildea, en OTRO runner
#
# En los dos, `dist/` no existe cuando vitest mira. Reproducido moviendo el
# `dist/` local: la corrida sale **verde, con 5 de 7 casos salteados y estado
# 0**. Un `skipIf` que se saltea en silencio es peor que no tener el chequeo,
# porque la red de contención lo cuenta como cobertura.
#
# Acá sí muerde, y por el mismo motivo que la mitad 2: este es el paso que los
# dos workflows corren inmediatamente DESPUÉS del build, sobre el **mismo**
# `dist/` que el paso siguiente sube a Hosting. Se verifica el artefacto que se
# publica, no uno parecido construido en otro job y con otros datos.
#
# **La guarda de "no verificó nada" va adentro**, y es la lección de B-873
# convertida en aserto: un `dist/` sin una sola página HTML no es un barrido
# limpio, es un barrido que no miró. Falla, igual que la guarda del `.js` de
# arriba.
#
# El barrido lo hace `node` y no `grep`: hay que sacar `<script>`, `<style>` y
# los comentarios HTML **antes** de buscar, y eso es un reemplazo no codicioso
# multilínea que `sed` no sabe hacer. `node` está garantizado en los tres
# lugares donde este script corre (los dos workflows hacen `setup-node` antes, y
# `verificar-todo.sh` es de este mismo proyecto).
#
# Lo prueba `tests/sin-comentarios-en-el-html.test.ts` y
# `tests/terceros-antes-del-consentimiento.test.ts`, que ahora manejan **este
# script** sobre `dist/` sintéticos —igual que `tests/que-deployar.test.ts` con
# su script— en vez de mirar un `dist/` que puede no estar. Así no hay un solo
# `skipIf` en el camino y los casos corren en `npm test` como cualquier otro.

DIR_A_BARRER="$DIR" RAIZ_DEL_REPO="$RAIZ" node --input-type=module - <<'BARRIDO' || exit 1
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = process.env.DIR_A_BARRER;

/**
 * La lista blanca de hosts de tercero, y **está vacía a propósito** — D-254,
 * B-481.
 *
 * Cuando esto se escribió tenía las dos de tipografía (`fonts.googleapis.com`,
 * `fonts.gstatic.com`); B-481 las sacó al autoalojar las tres familias en
 * `/fuentes/`. Que siga existiendo como lista en vez de borrada es el punto:
 * agregar un tercero es agregarle una entrada acá **con el motivo escrito**, y
 * eso se lee en una review. Un `preconnect` puesto de paso, no.
 */
const PERMITIDOS = new Map([
  // ['fonts.gstatic.com', 'ejemplo: por qué este host es aceptable'],
]);

const bajo = (dir, ext, acumulado = []) => {
  let entradas;
  try {
    entradas = readdirSync(dir, { withFileTypes: true });
  } catch {
    return acumulado;
  }
  for (const e of entradas) {
    const ruta = join(dir, e.name);
    if (e.isDirectory()) bajo(ruta, ext, acumulado);
    else if (e.name.endsWith(ext)) acumulado.push(ruta);
  }
  return acumulado;
};

const relativo = (f) => f.slice(DIR.length + 1);

const error = (titulo, lineas) => {
  console.log(`::error::${titulo}`);
  for (const l of lineas) console.log(`  ${l}`);
  process.exit(1);
};

const html = bajo(DIR, '.html');
const css = bajo(DIR, '.css');

// ── 3.0 · Que haya algo que barrer — la guarda de B-873 ───────────────────
// Sin esto el barrido pasa con `dist/` vacío y el gate reporta verde habiendo
// mirado cero páginas, que es literalmente el bug que lo trajo hasta acá.
if (html.length === 0) {
  error(`${DIR}/ no tiene ninguna página HTML — el barrido no verificó nada (B-873)`, [
    'El build no produjo páginas, o se apuntó el gate al directorio equivocado.',
    'Un barrido sin nada que barrer no es un barrido limpio.',
  ]);
}
if (css.length === 0) {
  error(`${DIR}/ no tiene ninguna hoja de estilos — el barrido no verificó nada (B-873)`, [
    'El build siempre emite al menos la hoja del layout. Si no está, o el build',
    'quedó a medias o este directorio no es el artefacto.',
  ]);
}

// ── 3.1 · Ningún comentario de plantilla emitido como texto — B-261 ───────
// Un `{/* … */}` puesto entre `</head>` y `<body>` NO lo elimina Astro: se
// emite crudo al documento. Pasó, y estuvo publicado dentro de la home. Astro
// los borra donde parsea una expresión —adentro de un elemento— y los deja
// pasar donde no, así que un chequeo sobre el fuente tendría que replicar su
// parser. Se mira la salida, que es la única que sabe la verdad.
//
// Se saca lo que va adentro de `<script>` y `<style>`, donde `/* */` es
// legítimo, y los comentarios HTML de verdad, que son otra cosa.
const sinCodigo = (h) =>
  h
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

const sucias = [];
for (const f of html) {
  const cuerpo = sinCodigo(readFileSync(f, 'utf8'));
  for (const m of cuerpo.matchAll(/\/\*|\*\//g)) {
    const ctx = cuerpo.slice(Math.max(0, m.index - 40), m.index + 60).replace(/\s+/g, ' ');
    sucias.push(`${relativo(f)} — …${ctx}…`);
  }
}
if (sucias.length > 0) {
  error('un comentario de plantilla se emitió como texto al HTML (B-261)', [
    ...sucias.slice(0, 6),
    ...(sucias.length > 6 ? [`(y ${sucias.length - 6} más)`] : []),
    'Astro solo elimina los comentarios donde parsea una expresión. Movelo al',
    'frontmatter, que es código y nunca se emite.',
  ]);
}

// ── 3.2 · Ningún host de tercero en el HTML — D-254 ───────────────────────
// Los hosts absolutos de las etiquetas que hacen una conexión propia en el
// load: `<link>` de precarga/hoja, `<script src>` e `<iframe src>`.
//
// Deliberadamente NO mira `<img>`: una actividad puede traer un flyer de
// Instagram (D-131), ese host varía por documento, ya es una salida pública
// decidida y auditada en `07-seguridad.md`, y no tiene nada que ver con el
// consentimiento de analítica. Lo que se cuida acá es la **infraestructura
// fija** que sale igual en todas las páginas porque viene de un layout.
const hostDe = (url) => {
  if (!/^https?:\/\//i.test(url)) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
};

const hostsDeInfraestructura = (h) => {
  const hallazgos = [];
  for (const m of h.matchAll(/<link\b[^>]*>/gi)) {
    const etiqueta = m[0];
    const rel = /\brel=["']?([\w -]+)["']?/i.exec(etiqueta)?.[1]?.toLowerCase() ?? '';
    if (!/(^|\s)(preconnect|dns-prefetch|prefetch|preload|stylesheet)(\s|$)/.test(rel)) continue;
    const href = /\bhref=["']([^"']+)["']/i.exec(etiqueta)?.[1];
    const host = href ? hostDe(href) : null;
    if (host) hallazgos.push({ etiqueta, host });
  }
  for (const m of h.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) {
    const host = hostDe(m[1]);
    if (host) hallazgos.push({ etiqueta: m[0], host });
  }
  for (const m of h.matchAll(/<iframe\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) {
    const host = hostDe(m[1]);
    if (host) hallazgos.push({ etiqueta: m[0], host });
  }
  return hallazgos;
};

const terceros = [];
for (const f of html) {
  for (const h of hostsDeInfraestructura(readFileSync(f, 'utf8'))) {
    if (!PERMITIDOS.has(h.host)) {
      terceros.push(`${relativo(f)} — ${h.host} — ${h.etiqueta.slice(0, 120)}`);
    }
  }
}
if (terceros.length > 0) {
  error('un host de tercero aparece en el HTML sin pasar por el consentimiento (D-254)', [
    ...terceros.slice(0, 6),
    ...(terceros.length > 6 ? [`(y ${terceros.length - 6} más)`] : []),
    'Un `preconnect` no es una pista pasiva: el navegador resuelve DNS, abre TCP y',
    'completa el handshake TLS en el load, también para quien RECHAZA. En un sitio',
    'estático el HTML es el mismo para todos, así que condicionarlo no se puede.',
    'Si es legítimo (tipografía, CDN propio), agregalo a PERMITIDOS con el motivo',
    'escrito, en este script; si es analítica, tiene que inyectarse por JavaScript',
    'condicionado al consentimiento — ver src/lib/medicionSitio.ts.',
  ]);
}

// ── 3.3 · Ni en las hojas construidas — B-481 ─────────────────────────────
// Lo que el barrido del HTML no ve, y es por donde volverían de verdad: un
// `@import url('https://fonts.googleapis.com/…')` o un `src: url('https://
// fonts.gstatic.com/…')` dentro de una `@font-face` salen a la red igual que un
// `<link>` y no aparecen en ninguna etiqueta del documento.
const enHojas = [];
for (const f of css) {
  const contenido = readFileSync(f, 'utf8');
  for (const m of contenido.matchAll(/url\(\s*['"]?(https?:\/\/[^'")\s]+)/gi)) {
    enHojas.push(`${relativo(f)} — ${m[1]}`);
  }
  for (const m of contenido.matchAll(/@import\s+(?:url\()?\s*['"]?(https?:\/\/[^'")\s]+)/gi)) {
    enHojas.push(`${relativo(f)} — @import ${m[1]}`);
  }
}
if (enHojas.length > 0) {
  error('una hoja de estilos construida sale a un host de tercero (B-481, D-254)', [
    ...enHojas.slice(0, 6),
    'Las fuentes van en `public/fuentes/` y se declaran con `@font-face` apuntando',
    'a `/fuentes/…`. Cualquier otro tercero es una conexión en el load y no puede',
    'condicionarse al consentimiento.',
  ]);
}

// El recuento no es decorativo: es la respuesta, en el log de Actions, a la
// pregunta que B-873 dejó sin contestar durante meses — ¿esto verificó algo?
console.log(
  `${DIR}/ barrido: ${html.length} páginas y ${css.length} ` +
    `${css.length === 1 ? 'hoja' : 'hojas'}, sin comentarios ` +
    'de plantilla emitidos (B-261) y sin hosts de tercero (D-254)',
);

// ══════════════════════════════════════════════════════════════════════════
// 4 · Lo que TIENE que estar en el artefacto — B-880
// ══════════════════════════════════════════════════════════════════════════
//
// Las secciones 1 y 3 preguntan qué NO puede estar; ésta y la 2, qué SÍ. Son dos
// chequeos que vivían como tests que leían `dist/`, o sea la misma clase que
// B-873, y que llegaron acá por el mismo camino. Uno de los dos es peor:
//
//   tests/no-encontrado.test.ts · `it.skipIf(!hayBuild)` sobre `dist/404.html`
//                               · era el ÚLTIMO skip de la suite entera
//   tests/ahoraPublico.test.ts  · `if (hojas === '') return;` sobre `dist/_astro`
//                               · sin `skipIf`: el caso se reportaba PASSED
//
// Medido el 2026-09-11 moviendo el `dist/` y corriendo los dos archivos: el
// primero sale `1 skipped`, el segundo sale `✓ … 0ms` — verde, contado como
// aprobado, habiendo leído cero bytes. El segundo es peor justamente por eso: un
// salteado al menos aparece en el recuento.
//
// Lo que cada uno prometía, y que ahora se exige acá sobre el artefacto que se
// sube:
//
//  · **La 404.** Firebase Hosting sirve `404.html` de la raíz del directorio
//    publicado. Renombrar `404.astro` no rompe el build, ni el typecheck, ni
//    ningún test de contenido: simplemente se vuelve al 404 de Firebase y la
//    página queda publicada en una URL que nadie visita.
//  · **Las clases de la grilla.** Tailwind genera las utilidades leyendo el
//    fuente. Un mapa de literales que igual no ve —por vivir fuera de su
//    `content`, o por una clase escrita mal— tiene exactamente el mismo aspecto
//    en el fuente y el mismo bug en pantalla: el tríptico se queda en una
//    columna y nada falla.
//
// **Lo que se le exige al artefacto sale del fuente y no está escrito acá.** Es
// el patrón de la sección 2 con `.env.production`: lo que se verifica es el par
// declaración/artefacto —«lo que el proyecto dice que va» contra «lo que el
// build produjo»—, y una copia escrita en este script se queda vieja el día que
// la constante cambie, dejando el gate verde sobre el valor de antes.

const RAIZ = process.env.RAIZ_DEL_REPO;

/**
 * Un valor declarado en el fuente. Si no se puede leer o el patrón no matchea,
 * es ROJO: es la lección de B-873 aplicada a la extracción misma — un chequeo
 * que se quedó sin qué verificar no pasa, avisa.
 */
const declarado = (archivo, re, que) => {
  let texto = '';
  try {
    texto = readFileSync(join(RAIZ, archivo), 'utf8');
  } catch {
    error(`no se pudo leer ${archivo}, de donde sale ${que} (B-880)`, [
      'Este gate deriva del fuente lo que le exige al artefacto. Sin el fuente no',
      'hay nada que exigir, y un chequeo que no puede correr no pasa: falla.',
    ]);
  }
  const m = re.exec(texto);
  if (!m) {
    error(`${archivo} ya no declara ${que} en la forma que este gate lee (B-880)`, [
      `Buscado: ${re}`,
      'La constante se movió o cambió de forma. Actualizá el patrón: dejarlo sin',
      'matchear sería el chequeo verde sobre cero bytes que trajo esto hasta acá.',
    ]);
  }
  return m[1];
};

// ── 4.1 · La página que Firebase sirve como 404 — B-310 ───────────────────
const NO_ENCONTRADO = 'src/lib/noEncontrado.ts';
const TITULO_404 = declarado(
  NO_ENCONTRADO,
  /export const TITULO_NO_ENCONTRADO\s*=\s*'([^']+)'/,
  'el título de la página de error',
);
const CLAVE_BUSQUEDA = declarado(
  NO_ENCONTRADO,
  /export const CLAVE_BUSQUEDA\s*=\s*'([^']+)'/,
  'el parámetro de la búsqueda',
);
const RUTA_PASADAS = declarado(
  'src/lib/rutasPublicas.ts',
  /export const RUTA_PASADAS\s*=\s*rutaCanonica\('([^']+)'\)/,
  'la ruta del archivo',
);

let html404 = '';
try {
  html404 = readFileSync(join(DIR, '404.html'), 'utf8');
} catch {
  error(`${DIR}/404.html no existe — Firebase no tiene qué servir en un 404 (B-310, B-880)`, [
    'Firebase Hosting usa `404.html` de la raíz del directorio publicado, así que',
    'ese nombre no es un detalle: es el cableado entero. Astro lo emite como archivo',
    'suelto incluso con `build.format` en `directory` (su caso especial para 404 y',
    '500). Si no está, la página cambió de nombre o dejó de emitirse — y renombrar',
    '`404.astro` deja el build, el typecheck y todos los tests de contenido verdes.',
  ]);
}

const falta404 = [];
if (!html404.includes(TITULO_404)) {
  falta404.push(`no dice «${TITULO_404}»: es un 404, pero no ÉSTE`);
}
if (!/<meta[^>]*name="robots"[^>]*content="[^"]*noindex/i.test(html404)) {
  falta404.push('no lleva `noindex` — §5.1 la deja fuera del índice');
}
if (!/<form\b[^>]*method="get"/i.test(html404)) {
  falta404.push('no tiene el formulario de búsqueda por GET — §4.5');
}
if (!new RegExp(`<input\\b[^>]*name="${CLAVE_BUSQUEDA}"`, 'i').test(html404)) {
  falta404.push(
    `el campo de búsqueda no manda \`${CLAVE_BUSQUEDA}\`, que es lo que la home lee (§6.2)`,
  );
}
if (!new RegExp(`href="${RUTA_PASADAS}/?"`).test(html404)) {
  falta404.push(`no enlaza \`${RUTA_PASADAS}\`, que es el destino de un link viejo (§4.5)`);
}
if (falta404.length > 0) {
  error(`${DIR}/404.html existe pero no es la página de error del sitio (B-310, B-880)`, [
    ...falta404,
    'Las tres cosas que se rompen sin que nada se vea son el nombre del archivo, el',
    'parámetro de la búsqueda y el enlace al archivo. Ver src/pages/404.astro.',
  ]);
}

// ── 4.2 · Las clases de la grilla llegaron a la hoja — B-600 ──────────────
const ESTILOS = 'src/components/sitio/estilos.ts';
const mapa = (nombre, que) =>
  declarado(ESTILOS, new RegExp(`export const ${nombre}[^=]*=\\s*\\{([^}]*)\\}`), que);

const utilidades = [
  ...new Set(
    (mapa('CLASES_DEL_TRIPTICO', 'el mapa de la grilla del tríptico').match(/'[^']*'/g) ?? [])
      .flatMap((s) => s.slice(1, -1).split(/\s+/))
      .filter(Boolean),
  ),
];
if (utilidades.length < 3) {
  error('el mapa de la grilla del tríptico dejó de tener clases que verificar (B-880)', [
    `Extraídas: ${utilidades.length}. Con el mapa vacío este chequeo pasa solo, que`,
    'es la forma de mentir que lo trajo hasta acá.',
  ]);
}

/*
 * **El marcador, que es la mitad que hace que lo de arriba signifique algo.**
 * Las utilidades del tríptico las escriben también otros archivos
 * —`lg:grid-cols-2` está en `EstadisticasPanel.tsx` y `lg:grid-cols-3` en
 * `FiltrosActividades.tsx`—, así que el bucle de abajo pasaría verde aunque
 * `components/sitio/estilos.ts` quedara FUERA del scan de Tailwind, que es justo
 * el modo de falla que esto cubre. Lo que prueba que el archivo se escanea es
 * una clase que **solo él** escribe: la de dos columnas de la pared.
 *
 * Que esa clase siga siendo exclusiva de ese archivo lo verifica
 * `tests/ahoraPublico.test.ts` con un grep al repo entero. Eso es sobre el
 * fuente y no necesita artefacto, así que se queda allá: acá va solo la mitad
 * que necesita el `dist/`.
 */
const MARCADOR = /^\s*2\s*:\s*'([^']+)'/m.exec(
  mapa('CLASES_DE_PARED', 'el mapa de las columnas de la pared'),
)?.[1];
if (!MARCADOR) {
  error('el mapa de las columnas de la pared ya no declara la clave 2 (B-880)', [
    'De ahí sale el marcador que prueba que `components/sitio/estilos.ts` entra al',
    'scan de Tailwind. Sin marcador, el chequeo de las utilidades no afirma nada.',
  ]);
}

const hojas = css.map((f) => readFileSync(f, 'utf8')).join('\n');
const selectorDe = (clase) => `.${clase.replace(/:/g, '\\:')}`;

/*
 * Se busca el **selector** (`.lg\:grid-cols-2`) y no la subcadena, y además
 * **hasta el borde**. Las dos mitades hacen falta:
 *
 *  · sin el punto, `grid-cols-2` a secas lo satisface `CLASES_DE_GALERIA`, que
 *    usa la misma utilidad sin el `lg:`;
 *  · sin el borde, `.grid` lo satisface `.grid-cols-1`, que empieza igual — o
 *    sea que una utilidad que Tailwind NO emitió pasaría por ser prefijo de
 *    otra que sí. Lo destapó la mutación por clase de `tests/ahoraPublico.test.ts`.
 */
const enLaHoja = (clase) =>
  new RegExp(`${selectorDe(clase).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`).test(hojas);

const sinEmitir = utilidades.filter((c) => !enLaHoja(c));
if (sinEmitir.length > 0) {
  error('una clase de la grilla del tríptico no llegó al CSS construido (B-600, B-880)', [
    ...sinEmitir.map((c) => `${c} — falta el selector ${selectorDe(c)}`),
    'Tailwind genera las utilidades leyendo el fuente: o la clase está escrita mal,',
    'o el archivo que la declara quedó fuera de su `content`. En pantalla el tríptico',
    'se queda en una columna, el build sale verde y no lo dice nadie.',
  ]);
}

if (!enLaHoja(MARCADOR)) {
  error(`ninguna clase exclusiva de ${ESTILOS} llegó al CSS construido (B-600, B-880)`, [
    `Falta el selector ${selectorDe(MARCADOR)}.`,
    'El archivo quedó fuera del scan de Tailwind. Las utilidades sueltas de arriba',
    'pueden estar igual —las escriben otros archivos—, así que sin este marcador el',
    'chequeo anterior pasaría verde con la grilla rota.',
  ]);
}

console.log(
  `${DIR}/ con lo que tiene que estar: 404.html es la página de error (B-310) y las ` +
    `${utilidades.length} utilidades de la grilla están en la hoja, con el marcador ` +
    `${MARCADOR} que prueba el scan de Tailwind (B-600)`,
);
BARRIDO
