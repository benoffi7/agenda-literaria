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
#
# Con `--compartidos` no lee stdin: lista los archivos de `functions/` que el
# build alcanza (ver «Hosting» más abajo), uno por línea. Es lo que ata el test
# y lo que sirve para mirar a mano qué cree el script que es compartido.
#
# Lee el árbol del repo en el que vive (la carpeta padre de `scripts/`), no el
# directorio desde el que se lo llama. `QUE_DEPLOYAR_RAIZ` lo cambia: lo usan
# los tests para correrlo sobre un árbol sintético.
set -euo pipefail

RAIZ=${QUE_DEPLOYAR_RAIZ:-$(cd "$(dirname "$0")/.." && pwd)}

# ── Los archivos de functions/ que el build alcanza (B-1241) ──────
# El bundle y el sitio importan código de `functions/` de dos maneras: por los
# alias de `astro.config.mjs` (`@calendario` → `new URL('./functions/…')`) y
# por ruta relativa desde `src/` (`'../../functions/slugify.js'`). Hasta B-1241
# el script tenía cableados los cuatro de alias y se perdía los seis de ruta
# relativa: un cambio que tocara solo `functions/alta-de-opcion.js` deployaba
# la Function y no el panel, y los dos caminos del alta de una etiqueta
# quedaban con versiones distintas en producción sin que nada lo avisara.
#
# Así que la lista ya no se escribe: se DERIVA del árbol en cada corrida.
#
#   1. Semillas: todo literal de ruta relativa que termine en
#      `functions/<nombre>[.js|.mjs|.cjs]` en `src/` o en `astro.config.mjs`.
#      Se buscan literales entre comillas con `./` o `../` adelante, no
#      `import`s: así entran igual el `new URL(` partido en dos líneas del
#      alias y el `export * from`. Un comentario que cite una ruta así entre
#      comillas también entra — sobra, y sobrar es el error barato.
#   2. Clausura: todo `'./<nombre>.js'` que importen esos archivos, hasta que
#      no aparezca ninguno nuevo. `calendario.js` importa `geografia.js`, que
#      importa `slugify.js`: un cambio a `slugify.js` cambia el panel aunque
#      `src/` también lo importe directo, y mañana puede no hacerlo.
#   3. Si alguno importa un paquete (`from 'algo'`, no relativo ni `node:`),
#      `functions/package.json` y su lock también alcanzan al build: Vite lo
#      resuelve desde `functions/node_modules`. Hoy ninguno lo hace.
#
# Si `src/` no existe no hay de dónde derivar, y entonces TODO `functions/`
# cuenta para Hosting: falla hacia deployar, como el resto del script.
# Comilla simple, doble o invertida: un `import(\`../../functions/x.js\`)` es
# tan import como los otros.
COMILLA="['\"\`]"
LITERAL_A_FUNCTIONS="$COMILLA(\./|(\.\./)+)functions/[A-Za-z0-9_-]+(\.[cm]?js)?$COMILLA"
LITERAL_HERMANO="$COMILLA\./[A-Za-z0-9_-]+(\.[cm]?js)?$COMILLA"
# `import x from 'pkg'`, `} from 'pkg'`, `export … from 'pkg'` o `import 'pkg'`.
# El `from` es obligatorio salvo en el último: sin él, `export const A = 'caba'`
# pasaría por el import de un paquete llamado `caba`.
IMPORT_DE_PAQUETE="^[[:space:]]*((import|export|\})[^'\"=]*[[:space:]]from|import)[[:space:]]*['\"][^./'\"][^'\"]*['\"]"

# B-1970 — Pocos procesos, no uno por archivo. La primera versión abría un
# `$(archivo_de …)` y un `grep` por cada archivo compartido en cada vuelta de la
# clausura, y otro `grep` por archivo para los paquetes: con once compartidos,
# decenas de procesos y 0,2–0,35 s por llamada en macOS. Ahora resolver un
# nombre a su archivo no lanza nada —deja el resultado en `ARCHIVO` en vez de
# imprimirlo, así no hace falta un `$( … )`— y cada vuelta es UN `grep` sobre
# todos los archivos a la vez. Las decisiones no cambian: `grep -h` sobre N
# archivos da las mismas líneas que N `grep -h`, y todo pasa por `sort -u`.

# El archivo de functions/ que corresponde a un nombre sin extensión, o vacío,
# en `ARCHIVO`.
ARCHIVO=
archivo_de() {
  local ext
  ARCHIVO=
  for ext in js mjs cjs; do
    if [ -f "$RAIZ/functions/$1.$ext" ]; then ARCHIVO="functions/$1.$ext"; return 0; fi
  done
  return 0
}

# Los archivos que existen de una lista de nombres sin extensión (uno por
# línea), como rutas relativas a `RAIZ`, una por línea, en `ARCHIVOS`.
ARCHIVOS=
archivos_de() {
  local nombre
  ARCHIVOS=
  while IFS= read -r nombre; do
    [ -n "$nombre" ] || continue
    archivo_de "$nombre"
    [ -n "$ARCHIVO" ] || continue
    ARCHIVOS="$ARCHIVOS$ARCHIVO
"
  done <<EOF
$1
EOF
}

# `grep -h <args…>` en UNA llamada sobre los archivos que existen de una lista
# de rutas relativas a `RAIZ` (una por línea, en `$1`); nada si no existe
# ninguno. Sin arrays —`"${a[@]}"` vacío revienta con `set -u` en el bash 3.2
# de macOS—, así que las rutas se pasan partidas por salto de línea y sin
# globbing: `RAIZ` puede tener espacios, y las rutas de functions/ no tienen
# ni espacios ni saltos (`[A-Za-z0-9_-]+`).
grep_en() {
  local lista=$1 archivo rutas= ifs_de_antes=$IFS
  shift
  while IFS= read -r archivo; do
    [ -n "$archivo" ] && [ -f "$RAIZ/$archivo" ] || continue
    rutas="$rutas$RAIZ/$archivo
"
  done <<EOF
$lista
EOF
  [ -n "$rutas" ] || return 0
  set -f
  IFS='
'
  # shellcheck disable=SC2086
  grep -h "$@" $rutas 2>/dev/null || true
  IFS=$ifs_de_antes
  set +f
}

compartidos() {
  local actual siguiente hermanos nombre
  actual=$(
    {
      grep -rhoE "$LITERAL_A_FUNCTIONS" "$RAIZ/src" 2>/dev/null || true
      grep -hoE "$LITERAL_A_FUNCTIONS" "$RAIZ/astro.config.mjs" 2>/dev/null || true
    } | sed -E "s/^$COMILLA(\.\/|(\.\.\/)+)functions\///; s/$COMILLA\$//; s/\.[cm]?js\$//" | sort -u
  )
  while :; do
    archivos_de "$actual"
    hermanos=$(grep_en "$ARCHIVOS" -oE "$LITERAL_HERMANO" | sed -E "s/^$COMILLA\.\///; s/$COMILLA\$//; s/\.[cm]?js\$//")
    siguiente=$(printf '%s\n%s\n' "$actual" "$hermanos" | grep -v '^$' | sort -u || true)
    [ "$siguiente" = "$actual" ] && break
    actual=$siguiente
  done
  while IFS= read -r nombre; do
    [ -n "$nombre" ] || continue
    archivo_de "$nombre"
    # Uno citado que no existe se lista igual con `.js`: si alguien lo crea
    # en este mismo cambio, tiene que contar.
    printf '%s\n' "${ARCHIVO:-functions/$nombre.js}"
  done <<EOF
$actual
EOF
}

if [ "${1:-}" = "--compartidos" ]; then
  compartidos
  exit 0
fi

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
# `functions/calendario.js`, `functions/historial.js` y
# `functions/png-chunks-seguros.js` entran por los alias `@calendario`,
# `@historial` y `@png-chunks-seguros` (astro.config.mjs), y mañana puede ser
# otro. Una lista blanca de rutas se pierde ese caso EN SILENCIO — el build
# sigue verde y producción queda con el panel viejo. Es la trampa que
# `docs/BACKLOG.md` (B-88, y el hallazgo del `auditor-privacidad` en B-323)
# dejó escrita: agregar un alias nuevo a un archivo de `functions/` sin sumarlo
# acá abajo dispara Functions pero no Hosting.
#
# B-1241 — y ese agujero tenía una segunda boca: el `awk` de acá abajo seguía
# siendo una lista BLANCA de los cuatro archivos con alias, y `src/` importa
# otros seis por ruta relativa. Desde B-1241 esa lista la da `compartidos()`
# (arriba), derivada del árbol: un archivo compartido nuevo queda cubierto sin
# que nadie se acuerde de sumarlo, y `tests/que-deployar.test.ts` compara la
# derivación contra un recorrido independiente de los imports de `src/`.
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
#
# B-215 — `^\.claude/` y `^githooks/` por el mismo motivo, y con la misma prueba:
# nada de `src/` importa desde ninguno de los dos, así que no pueden entrar al
# bundle. Son las definiciones de los agentes y skills (que se ejecutan en la
# máquina de quien programa, no en el sitio) y el hook de git. Las que terminan
# en `.md` ya caían por `\.md$`; lo que no caía es el `settings.json` de
# `.claude/` ni `githooks/pre-push`, que no tiene extensión.
#
# **Por qué ahora y no antes:** hasta B-124 `.claude/` era tres agentes y seis
# skills, todos `.md`. Con `settings.json` adentro —que se toca seguido, porque
# es donde viven los hooks— cada edición de la configuración de los agentes
# republicaba el sitio. `docs/13-agentes.md` lo tenía anotado como pendiente
# «porque toca código»; esto es ese cambio.
NO_AFECTAN='^docs/|^tests/|^\.github/|^\.claude/|^githooks/|\.md$|^\.gitignore$|^firestore\.(rules|indexes\.json)$|^storage\.rules$|^\.firebaserc$|^scripts/(seed-emulador|preparar-produccion|set-admin-claim|aprobar-opciones|optimizar-imagenes|que-deployar|verificar-bundle|verificar-calendario)\.(mjs|sh)$'

# Qué de `functions/` cuenta para Hosting: lo compartido (derivado), y si lo
# compartido importa paquetes, el `package.json` de `functions/` y su lock.
if [ -d "$RAIZ/src" ]; then
  COMPARTIDOS=$(compartidos)
  # Un solo `grep` sobre todos los compartidos (B-1970), no uno por archivo.
  PAQUETES=$(grep_en "$COMPARTIDOS" -E "$IMPORT_DE_PAQUETE" | { grep -vE "['\"]node:" || true; })
  FUNCTIONS_DEL_BUILD=$(
    printf '%s\n' "$COMPARTIDOS"
    if [ -n "$PAQUETES" ]; then printf 'functions/package.json\nfunctions/package-lock.json\n'; fi
  )
else
  FUNCTIONS_DEL_BUILD=$(printf '%s\n' "$CAMBIOS" | { grep '^functions/' || true; })
fi

# Sin `case` a propósito: el bash 3.2 de macOS no parsea un `patrón)` adentro
# de un `$( … )`. Y sin un `grep -qxF` por ruta (B-1970): «¿es una línea
# entera de la lista?» lo contesta el propio bash, con los dos lados entre
# saltos de línea y la parte variable entre comillas, que la vuelve literal.
NL='
'

RELEVANTES=$(
  printf '%s\n' "$CAMBIOS" \
    | { grep -vE "$NO_AFECTAN" || true; } \
    | while IFS= read -r ruta; do
        [ -n "$ruta" ] || continue
        if [ "${ruta#functions/}" = "$ruta" ] \
           || [[ "$NL$FUNCTIONS_DEL_BUILD$NL" == *"$NL$ruta$NL"* ]]; then
          printf '%s\n' "$ruta"
        fi
      done
)

HOSTING=false
[ -n "$RELEVANTES" ] && HOSTING=true

printf 'hosting=%s\nfunctions=%s\nfirestore=%s\nstorage=%s\n' "$HOSTING" "$FUNCTIONS" "$FIRESTORE" "$STORAGE"
