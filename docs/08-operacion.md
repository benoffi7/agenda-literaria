# Operación

## Poner a andar el entorno local

```bash
npm install
cd functions && npm install && cd ..
```

Tres terminales:

```bash
npm run emu      # emuladores: Auth 9099, Firestore 8080, UI 4000
npm run seed     # siembra /opciones/* con las opciones base
npm run dev      # Astro en :4321 — el panel está en /admin
```

Para poder escribir hace falta el claim `admin`. Entrá una vez a `/admin` con el
popup del emulador y después:

```bash
npm run admin:claim -- --todos
```

Salí y volvé a entrar: el claim entra al token en el próximo login.

### Java

**Los emuladores exigen JDK 21+.** Si el default del sistema es otro (en la
máquina de desarrollo es el JDK 17 de Android Studio), el script `emu` ya apunta
a `openjdk@21` de Homebrew sin tocar el `JAVA_HOME` global.

Si no lo tenés: `brew install openjdk@21`. Si está en otra ruta, ajustar el
script `emu` en `package.json`.

Síntoma: `firebase-tools no longer supports Java version before 21`.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Astro en desarrollo, contra emuladores |
| `npm run build` | build estático a `dist/`, contra producción |
| `npm test` | los 365 tests |
| `npm run test:watch` | idem en watch |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run emu` | emuladores, con import/export de estado en `.emulador/` |
| `npm run seed` | siembra `/opciones/*` en el emulador |
| `npm run admin:claim -- --todos` | claim `admin` a los usuarios del emulador |
| `npm run admin:claim:prod -- <uid\|email>` | claim `admin` en producción |
| `npm run opciones:aprobar -- --listar` | opciones pendientes de aprobar, en el emulador |
| `npm run opciones:aprobar:prod -- --listar` | idem, en producción |

`admin:claim` apunta al emulador por defecto; `admin:claim:prod` es un script
aparte para que nadie le dé admin a una cuenta real creyendo estar en local.
`opciones:aprobar` sigue la misma convención, y además el script anuncia el
objetivo (EMULADOR o PRODUCCIÓN) antes de escribir.

## Aprobar una etiqueta nueva (§4.3)

Una opción creada con "Otro" funciona para quien la creó pero **no aparece en el
desplegable de la otra cuenta** hasta que se la apruebe. Nadie recibe un aviso
todavía, así que conviene revisar de vez en cuando:

```bash
# Qué hay pendiente
npm run opciones:aprobar:prod -- --listar

# Aprobar (el comando exacto lo imprime --listar)
npm run opciones:aprobar:prod -- arancel con-beca-parcial
```

Ensayarlo primero contra el emulador es gratis: `npm run opciones:aprobar --`
(mismo script, otro objetivo).

**Si una etiqueta es basura** —un typo con `usos: 1`— hoy no hay comando para
borrarla: no la apruebes y quedará invisible para las demás cuentas. Borrar
taxonomías es parte de la UI de administración que falta (B-06).

Hay un `--backfill` opcional que marca `aprobada: true` en los valores
anteriores al campo. No cambia comportamiento (la ausencia ya se lee como
aprobada, D-26): sirve para que el documento no se lea a medias.

```bash
npm run opciones:aprobar:prod -- --backfill
```

## Entornos

Vite carga `.env.production` en `build` y `.env.development` en `dev`. La
diferencia real es `PUBLIC_USE_EMULATORS`.

**No crear un `.env` sin sufijo:** se carga en los dos modos y pisa a los otros
dos. Está en el `.gitignore` a propósito.

## Deployar

### Sitio y panel

```bash
npm test && npm run build
firebase deploy --only hosting
```

Verificar después:

```bash
grep -rl "firebase-admin\|private_key" dist/ && echo "FUGA" || echo "limpio"
curl -sL -o /dev/null -w "%{http_code}\n" https://agenda-literaria.web.app/admin
```

### Qué versión está publicada

La versión se estampa en el build: `package.json` + SHA corto del commit
(D-36). Se ve en tres lugares:

```bash
# 1. Local, antes de deployar (lo mismo que va a quedar en dist/)
node -e "import('./scripts/version.mjs').then(m => console.log(m.infoVersion().version))"

# 2. Lo que quedó en el build
cat dist/version.json

# 3. Lo que está publicado, y con qué cabeceras se sirve
curl -s https://agenda-literaria.web.app/version.json
curl -sI https://agenda-literaria.web.app/version.json | grep -i cache-control
```

Un `+…-sucio.…` en la versión avisa que se buildeó con cambios sin commitear:
lo publicado no corresponde exactamente a ningún commit.

**Los paneles abiertos se enteran solos.** Al volver a la pestaña (o cada 15
minutos si está a la vista) el panel compara su versión contra `/version.json` y
recarga. Si alguien está a mitad de un formulario, en vez de recargar le muestra
un aviso para que guarde primero. No hay que avisarle a nadie después de un
deploy.

**Después de tocar las cabeceras de cache, verificarlas contra el sitio real** —
son la mitad del mecanismo (D-38):

```bash
for RUTA in / /admin /version.json; do
  echo -n "$RUTA -> "
  curl -sI "https://agenda-literaria.web.app$RUTA" | grep -i "^cache-control" || echo "(sin cabecera)"
done
# y un asset con hash, que tiene que decir immutable
curl -sI "https://agenda-literaria.web.app/_astro/$(ls dist/_astro | grep '\.js$' | head -1)" \
  | grep -i "^cache-control"
```

Esperado: `no-cache` en `/` y `/admin`, `no-store` en `/version.json`,
`max-age=31536000, immutable` en `/_astro/*`.

### Reglas de Firestore

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

**Las reglas de `/reportes/{id}` todavía no están desplegadas.** Hasta que se
desplieguen, el formulario de reportes del panel recibe *permission denied* al
guardar.

### Functions

```bash
firebase deploy --only functions:syncCalendar,functions:rebuildPorOpciones,functions:guardarVersion
```

**Desplegar solo esas tres.** `dispararRebuild` está escrita pero no se despliega
todavía (D-13): sería un schedule cada 5 minutos sin nada que disparar.

Un `firebase deploy --only functions` sin filtro la incluiría.

`guardarVersion` (el historial del §12) es nueva y **todavía no se desplegó**.
No necesita ninguna config nueva: corre como `calendar-sync@`, que ya tiene
`datastore.user` y los roles de Eventarc, y solo escribe en Firestore. Después
de desplegarla, la verificación es editar la descripción de una actividad de
prueba y confirmar en la consola que apareció **una** versión y no dos — la
segunda sería el write-back del sync, que es justo lo que la guarda evita
(D-41).

**Desplegar solo esas dos.** `dispararRebuild` está escrita pero no se despliega
todavía (D-13): le falta el PAT en Secret Manager, y sin eso sería un schedule
cada 5 minutos que no puede hacer nada.

Un `firebase deploy --only functions` sin filtro la incluiría.

### Reportes del panel → issues de GitHub (una sola vez)

Cinco pasos manuales, en este orden. Los tres primeros los hace el dueño de la
cuenta de GitHub y de GCP; ningún agente ni script debe crear el PAT.

**1. Crear el PAT.** Fine-grained token, en
https://github.com/settings/personal-access-tokens/new

- *Resource owner:* `benoffi7` · *Repository access:* solo
  `benoffi7/agenda-literaria`.
- *Permissions → Repository → Issues: **Read and write***. Nada más — con eso
  alcanza para crear issues, y si se filtra no da acceso al código.
- Vencimiento: el que sea, pero anotarlo. Cuando vence, la Function falla con
  401 y el reporte queda en estado `error` (no se pierde).

**2. Guardarlo en Secret Manager.** Nunca en `functions/.env` ni en el repo
(§5.4). El comando pide el valor por stdin, así que el token no queda en el
historial del shell:

```bash
gcloud services enable secretmanager.googleapis.com --project agenda-literaria

# Pegar el token, Enter, y Ctrl-D
gcloud secrets create GITHUB_TOKEN --replication-policy=automatic \
  --project agenda-literaria --data-file=-

# Para rotarlo más adelante: una versión nueva, sin borrar el secreto
# gcloud secrets versions add GITHUB_TOKEN --project agenda-literaria --data-file=-
```

**3. Dejar que la Function lo lea.** Corre como `calendar-sync@`, que por
defecto no tiene acceso al secreto:

```bash
gcloud secrets add-iam-policy-binding GITHUB_TOKEN \
  --project agenda-literaria \
  --member="serviceAccount:calendar-sync@agenda-literaria.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

**4. Desplegar reglas y Function.**

```bash
firebase deploy --only firestore:rules
firebase deploy --only functions:reporteAIssue
```

**5. Crear las etiquetas del issue** (opcional, para que queden con color):

```bash
gh label create reporte-panel --repo benoffi7/agenda-literaria \
  --color 5319e7 --description "Cargado desde el panel de /admin"
gh label create sugerencia --repo benoffi7/agenda-literaria \
  --color 0e8a16 --description "Idea o mejora pedida desde el panel"
# `bug` ya existe en todo repo de GitHub
```

Verificación de punta a punta: entrar a `/admin`, cargar un reporte de prueba, y
que en la lista "Últimos reportes" aparezca el número de issue en unos segundos.
Si queda en "no se pudo publicar", el motivo está en el propio documento y en los
logs:

```bash
gcloud functions logs read reporteAIssue --project agenda-literaria \
  --region southamerica-east1 --limit 20
```

### Reintentar un reporte que quedó en `error`

Pasa si el token venció, si le falta el permiso o si el repo está mal escrito. El
reporte **no se perdió**: está en Firestore y se reintenta poniéndolo otra vez en
`pendiente`, lo que vuelve a disparar la Function. El cliente no puede hacerlo
(las reglas se lo prohíben), así que va con el Admin SDK, **desde la raíz del
repo**:

```bash
node -e "
const {initializeApp, applicationDefault} = require('firebase-admin/app');
const {getFirestore} = require('firebase-admin/firestore');
initializeApp({credential: applicationDefault(), projectId: 'agenda-literaria'});
(async () => {
  const db = getFirestore();
  // 'enviando' entra también: es un reporte cuya invocación se cortó a mitad.
  const q = await db.collection('reportes')
    .where('estado','in',['error','enviando']).get();
  for (const d of q.docs) {
    await d.ref.update({ estado: 'pendiente', intentos: 0, error: null });
    console.log('reencolado', d.id, '|', d.data().titulo);
  }
})();
"
```

`intentos: 0` es necesario: con los tres intentos gastados la Function ignora el
documento a propósito (D-34).

Para desplegarla, primero los pasos manuales de "Activar el rebuild automático".


### Preparar un proyecto desde cero

Si hubiera que rearmar todo, el orden es:

```bash
# 1. APIs
gcloud services enable firestore.googleapis.com identitytoolkit.googleapis.com \
  calendar-json.googleapis.com cloudfunctions.googleapis.com run.googleapis.com \
  cloudbuild.googleapis.com eventarc.googleapis.com --project <PROYECTO>

# 2. Firestore — la región es IRREVERSIBLE
gcloud firestore databases create --location=southamerica-east1 \
  --type=firestore-native --project <PROYECTO>

# 3. Auth: inicializar y habilitar Google
#    El toggle de Google va por consola: la API pide un client_id que no existe
#    hasta que Firebase lo auto-crea ahí.

# 4. Service account de la Function
gcloud iam service-accounts create calendar-sync --project <PROYECTO>
for R in datastore.user logging.logWriter eventarc.eventReceiver \
         run.invoker artifactregistry.reader; do
  gcloud projects add-iam-policy-binding <PROYECTO> \
    --member="serviceAccount:calendar-sync@<PROYECTO>.iam.gserviceaccount.com" \
    --role="roles/$R" --condition=None
done

# 5. Compartir el calendario con calendar-sync@… con permiso de cambios

# 6. Reglas, opciones base, admins, y recién ahí el deploy
firebase deploy --only firestore:rules,firestore:indexes
node scripts/preparar-produccion.mjs <email>
npm run build && firebase deploy --only hosting
firebase deploy --only functions:syncCalendar,functions:rebuildPorOpciones,functions:guardarVersion

firebase deploy --only functions:syncCalendar,functions:rebuildPorOpciones

# 7. Rebuild automático: ver "Activar el rebuild automático" más abajo
#    (PAT en Secret Manager, service account de CI, secret de GitHub, y recién
#    ahí `firebase deploy --only functions:dispararRebuild`)

```

## Activar el rebuild automático (§8)

Todo el código está escrito: la Function (`dispararRebuild`), su lógica de
reintentos (`functions/rebuild.js`) y el workflow
(`.github/workflows/deploy.yml`). Lo que falta son **credenciales, y solo las
puede crear el dueño**: el PAT y la key de service account no pueden pasar por
un agente ni por el repo (§5.4).

Los cinco pasos, en orden.

### 1 · PAT de GitHub

Un token fine-grained en <https://github.com/settings/personal-access-tokens>:

- **Repository access:** solo `benoffi7/agenda-literaria`.
- **Permissions → Repository → Contents: Read and write.** Es el permiso que
  habilita el `repository_dispatch`; con menos, GitHub responde 403.
- **Expiration:** lo que se elija hay que anotarlo. Cuando venza, el dispatch
  empieza a fallar con `HTTP 401 Bad credentials` y eso queda en
  `sistema/rebuild.ultimoError`.

Con un token clásico, el scope equivalente es `repo` (o `public_repo` si el repo
es público).

### 2 · El PAT a Secret Manager

```bash
gcloud services enable secretmanager.googleapis.com --project agenda-literaria

# Pegar el PAT sin newline al final: un \n en el header Authorization lo rompe.
printf %s 'ghp_EL_TOKEN' | gcloud secrets create GITHUB_TOKEN \
  --data-file=- --replication-policy=automatic --project agenda-literaria

# La Function corre como calendar-sync@ (D-06), así que el acceso se le da a
# ella, y solo sobre este secreto.
gcloud secrets add-iam-policy-binding GITHUB_TOKEN \
  --member="serviceAccount:calendar-sync@agenda-literaria.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" --project agenda-literaria
```

Para rotarlo después: `gcloud secrets versions add GITHUB_TOKEN --data-file=-`.
La Function toma la versión nueva al reciclar la instancia; para forzarlo,
redeployarla.

### 3 · Service account para el workflow

El runner de GitHub no tiene ADC, así que necesita una key. Es la **única** key
del proyecto, y por eso la cuenta es aparte de `calendar-sync@` y solo puede
leer:

```bash
gcloud iam service-accounts create deploy-ci \
  --display-name="Deploy del sitio desde GitHub Actions" --project agenda-literaria

for R in datastore.viewer firebasehosting.admin; do
  gcloud projects add-iam-policy-binding agenda-literaria \
    --member="serviceAccount:deploy-ci@agenda-literaria.iam.gserviceaccount.com" \
    --role="roles/$R" --condition=None
done

# La key: se baja, se pega en GitHub y se borra del disco enseguida.
gcloud iam service-accounts keys create /tmp/deploy-ci.json \
  --iam-account=deploy-ci@agenda-literaria.iam.gserviceaccount.com \
  --project agenda-literaria
```

### 4 · La key como secret de GitHub

En **Settings → Secrets and variables → Actions → New repository secret** del
repo, con nombre exacto `FIREBASE_SERVICE_ACCOUNT` y el **contenido completo**
del JSON como valor. Con `gh` instalado:

```bash
gh secret set FIREBASE_SERVICE_ACCOUNT --repo benoffi7/agenda-literaria \
  < /tmp/deploy-ci.json
rm /tmp/deploy-ci.json    # no dejarla en el disco
```

**Probar el workflow antes de seguir:** Actions → "Build y deploy del sitio" →
Run workflow. Si termina verde, el deploy funciona y recién ahí conviene
desplegar la Function.

### 5 · Desplegar la Function

```bash
firebase deploy --only functions:dispararRebuild
```

Verificar que el schedule quedó armado y que el primer tick hace algo:

```bash
gcloud scheduler jobs list --location southamerica-east1 --project agenda-literaria
gcloud functions logs read dispararRebuild --project agenda-literaria \
  --region southamerica-east1 --limit 20
```

Mensaje esperado sin cambios pendientes: nada (el schedule sale en silencio).
Con un cambio pendiente: `rebuild disparado`.

## Diagnosticar

### Logs del sync

```bash
gcloud functions logs read syncCalendar --project agenda-literaria \
  --region southamerica-east1 --limit 30
```

Los mensajes útiles: `evento creado`, `evento actualizado`, `evento borrado`,
`sin cambios relevantes para Calendar`, `falló una operación de Calendar`.

### El sitio no se actualiza después de cargar una actividad

El estado del lazo del §8 está entero en un solo documento. Con las ADC de
gcloud, desde la raíz del repo:

```bash
node -e "
const {initializeApp, applicationDefault} = require('firebase-admin/app');
const {getFirestore} = require('firebase-admin/firestore');
initializeApp({credential: applicationDefault(), projectId: 'agenda-literaria'});
getFirestore().doc('sistema/rebuild').get().then(d => console.log(d.data()));
"
```

Cómo leerlo:

| Qué se ve | Qué significa |
|---|---|
| `pendiente: false` | no hay nada que rebuildear; el último disparo salió bien |
| `pendiente: true`, `intentos: 0` | recién marcado, el schedule todavía no tickeó (hasta 5 min) |
| `pendiente: true`, `intentos: 1-4` | está reintentando con backoff — mirar `ultimoError` |
| `agotado: true` | se rindió. `ultimoError` dice por qué. Se rearma solo con el próximo cambio, o a mano con el workflow |

Los logs del schedule:

```bash
gcloud functions logs read dispararRebuild --project agenda-literaria \
  --region southamerica-east1 --limit 30
```

Mensajes: `rebuild disparado`, `repository_dispatch falló, se reintenta`,
`el rebuild agotó los reintentos: el sitio quedó viejo`, `rebuild pendiente
pero sin GitHub configurado`.

Y del lado de GitHub, los runs del workflow:

```bash
gh run list --repo benoffi7/agenda-literaria --workflow deploy.yml --limit 5
```

**Para publicar ya, sin esperar:** Actions → "Build y deploy del sitio" → Run
workflow. Eso no toca el flag de Firestore, así que el próximo tick puede
disparar un build redundante; es inofensivo.

### Leer el calendario real

La API key de Firebase **no** sirve: tiene el método de Calendar bloqueado. Con
la URL privada del ICS (que no va al repo):

```bash
curl -s "$ICS_PRIVADO" | python3 -c "
import re,sys
raw = sys.stdin.read().replace('\r\n ','').replace('\n ','')
for b in re.findall(r'BEGIN:VEVENT(.*?)END:VEVENT', raw, re.S):
    m = re.search(r'^SUMMARY[^:]*:(.*)$', b, re.M)
    print(m.group(1) if m else '?')
"
```

### Inspeccionar Firestore en producción

Con las ADC de gcloud, sin bajar keys:

```bash
node -e "
const {initializeApp, applicationDefault} = require('firebase-admin/app');
const {getFirestore} = require('firebase-admin/firestore');
initializeApp({credential: applicationDefault(), projectId: 'agenda-literaria'});
(async () => {
  const q = await getFirestore().collection('actividades').get();
  q.forEach(d => console.log(d.id, '|', d.data().titulo, '|', d.data().estado));
})();
"
```

Correrlo **desde la raíz del repo**: necesita resolver `firebase-admin` de
`node_modules`.

## Problemas conocidos y su causa

| Síntoma | Causa | Solución |
|---|---|---|
| `no longer supports Java version before 21` | los emuladores necesitan JDK 21+ | usar `npm run emu`, que apunta a `openjdk@21` |
| `eventarc.events.receiveEvent denied` al deployar Functions | la service account propia no tiene los roles que la default de Compute trae de fábrica | otorgar `eventarc.eventReceiver`, `run.invoker`, `artifactregistry.reader` |
| `Permission denied while using the Eventarc Service Agent` | primer uso de Functions v2, permisos propagándose | esperar unos minutos y reintentar |
| `CONFIGURATION_NOT_FOUND` en la API de Auth | Firebase Auth nunca se inicializó | `POST identitytoolkit.googleapis.com/v2/projects/<p>/identityPlatform:initializeAuth` |
| 403 con `requires a quota project` en APIs de Google | ADC de usuario sin quota project | mandar el header `x-goog-user-project: agenda-literaria` |
| `evaluation error` en vez de `permission-denied` en el emulador | `resource` no está cargado en la primera pasada del evaluador | cosmético, ignorar (D-04) |
| El panel dice "sin permisos" con la cuenta correcta | el claim entra al token en el próximo login | salir y volver a entrar |
| Un `grep` sobre el ICS no encuentra algo que sí está | el formato ICS parte las líneas largas | desdoblar (`'\r\n '` → `''`) antes de buscar |
| El panel muestra "hay una versión nueva" y recargar no la trae | algo entre el navegador y Hosting está ignorando el `no-cache` del HTML | cerrar y reabrir la pestaña; si persiste, revisar las cabeceras con los `curl` de arriba |
| El panel se recarga solo en medio de la carga de una actividad | no debería: con cambios sin guardar solo avisa | es un bug — reportarlo con la versión que muestra el aviso |
| El formulario hace zoom en iPhone al enfocar un campo | un input con menos de 16px | ya resuelto en `global.css`; no bajar el tamaño de los campos en mobile |
| El reporte del panel queda en "no se pudo publicar" con 401 o 403 | el PAT venció o no tiene permiso de Issues sobre el repo | rotar el secreto y reencolar el reporte (arriba) |
| El reporte del panel da *permission denied* al guardar | faltan desplegar las reglas de `/reportes` | `firebase deploy --only firestore:rules` |
| `tests/reportes.integracion.test.ts` falla entero contra el emulador | el emulador se arrancó en otro checkout y sirve otras reglas | reiniciar `npm run emu` en este checkout |

| `sistema/rebuild.ultimoError` dice `HTTP 401 Bad credentials` | el PAT venció o se revocó | rotar el secreto (`gcloud secrets versions add GITHUB_TOKEN`); el contador se rearma con el próximo cambio |
| `ultimoError` dice `HTTP 404` | el PAT no ve el repo, o `GITHUB_REPO` está mal | revisar el repository access del token y `functions/.env` |
| `ultimoError` dice `HTTP 422` | el `event_type` no coincide con el `types:` del workflow, o el workflow no está en la branch por defecto | tienen que ser los dos `rebuild`, y `deploy.yml` tiene que estar mergeado a `main` |
| El log dice `rebuild pendiente pero sin GitHub configurado` | falta el secreto `GITHUB_TOKEN` o `GITHUB_REPO` | los pasos 1-2 de "Activar el rebuild automático" |
| El deploy del workflow falla con `Permission denied` sobre Hosting | a `deploy-ci@` le falta `roles/firebasehosting.admin` | otorgarlo (paso 3) |
| El build del workflow no encuentra actividades | falta el secret `FIREBASE_SERVICE_ACCOUNT`, o `deploy-ci@` no tiene `datastore.viewer` | pasos 3-4 |
| El schedule corre pero nunca dispara nada | `agotado: true` en `sistema/rebuild` | ver "El sitio no se actualiza…" |
| El deploy de `syncCalendar` se queja de que falta el secreto `GITHUB_TOKEN` | `dispararRebuild` lo declara con `defineSecret`, y según la versión de `firebase-tools` la validación puede correr sobre todo el codebase y no solo sobre la función filtrada | crear el secreto (paso 2 de "Activar el rebuild automático"); existe aunque la Function no esté desplegada |


## Costos

Plan Blaze con budget de USD 5/mes y avisos al 50, 90 y 100%.

Lo que consume: Firestore (free tier generoso), invocaciones de Functions (una
por escritura de actividad), y el storage de Artifact Registry para las imágenes
de las Functions — este último con política de borrado a 1 día.

`dispararRebuild` suma ~8.600 invocaciones por mes (una cada 5 minutos), que
entran holgadas en el free tier de 2 millones. Casi todas leen un documento y
salen. Del lado de GitHub, lo que se paga son minutos de Actions: el debounce
del §8 es justamente lo que hace que una sesión de edición sea un build y no
diez.

El sitio público no lee Firestore (§2.5), así que el tráfico de visitas no
genera costo de base de datos.
