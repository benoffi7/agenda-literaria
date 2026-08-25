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
| `npm test` | los 460 tests |
| `npm run test:watch` | idem en watch |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run emu` | emuladores, con import/export de estado en `.emulador/` |
| `npm run seed` | siembra `/opciones/*` en el emulador |
| `npm run admin:claim -- --todos` | claim `admin` a los usuarios del emulador |
| `npm run admin:claim:prod -- <uid\|email>` | claim `admin` en producción |
| `npm run opciones:aprobar -- --listar` | opciones pendientes de aprobar, en el emulador |
| `npm run opciones:aprobar:prod -- --listar` | idem, en producción |
| `./scripts/verificar-todo.sh` | el gate de antes de pushear: marcadores, typecheck, tests con emuladores, build y fuga de credenciales |

`admin:claim` apunta al emulador por defecto; `admin:claim:prod` es un script
aparte para que nadie le dé admin a una cuenta real creyendo estar en local.
`opciones:aprobar` sigue la misma convención, y además el script anuncia el
objetivo (EMULADOR o PRODUCCIÓN) antes de escribir.

## El gate de antes de pushear

Cinco pasos mecánicos, en un script para poder correrlos a mano, y un hook que
solo los llama. La separación es la misma lección de `que-deployar.sh`: un `if`
adentro de un hook es igual de imposible de probar que un `if` adentro de un
YAML.

```bash
./scripts/verificar-todo.sh
```

| # | Paso | Por qué está |
|---|---|---|
| 1 | marcadores de conflicto (`sin-marcadores-de-conflicto.test.ts`) | es el más barato y ya se commitearon dos veces |
| 2 | `astro sync` + `tsc --noEmit` | sin `astro sync` el typecheck da doce errores que no son del cambio |
| 3 | `npm test` con los emuladores arriba y `EXIGIR_EMULADOR=1` | sin eso los tests de integración se saltean **en silencio** y las reglas se pushean sin probar |
| 4 | `npm run build` | |
| 5 | `./scripts/verificar-bundle.sh dist` | el gate del §5.4 / trampa 4; va después del build porque sin `dist/` no verifica nada |

### Activarlo (hay que hacerlo una vez por clon)

Los hooks viven en `.git/hooks/`, que **no se versiona**. El directorio
`githooks/` sí, así que se enchufa apuntando git ahí:

```bash
git config core.hooksPath githooks
```

Es config del clon (no viaja con el repo) y alcanza a todos los worktrees,
porque la config vive en el directorio común de git. Para desenchufarlo,
`git config --unset core.hooksPath`.

### Saltearlo a propósito

```bash
SALTEAR_PRE_PUSH=1 git push
git push --no-verify
```

Las dos formas quedan en el historial del shell, que es la idea: que saltear sea
una decisión y no un olvido. El hook además avisa en amarillo qué **no** se
verificó.

### Lo que el gate no puede ver

Privacidad de un campo nuevo, trampas del §13 en código nuevo, y si la doc
acompaña al cambio. Eso necesita criterio y va por el skill
`antes-de-pushear`, que lanza los tres auditores en paralelo: un hook de git no
puede invocar un modelo. Ver [`13-agentes.md`](13-agentes.md).

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

## Deploy automático desde main

Un push a `main` deploya lo que haga falta y nada más
(`.github/workflows/push-main.yml`).

**El gate son los tests.** Si `tsc`, la suite o el build fallan, no se deploya
nada. La suite corre **con los emuladores** (`EXIGIR_EMULADOR=1`), así que un
cambio a `firestore.rules` se prueba antes de publicarse; sin ese flag los 33
tests de integración se saltearían en silencio y "verde" no distinguiría entre
*las reglas pasaron* y *las reglas no se probaron*.

**Qué se deploya** lo decide `scripts/que-deployar.sh`, testeado en
`tests/que-deployar.test.ts`:

| | Criterio |
|---|---|
| Reglas e índices | cambió `firestore.rules` o `firestore.indexes.json` |
| Functions | cambió algo en `functions/` o `firebase.json` |
| Hosting | **lista negra**: se deploya salvo que todo lo que cambió sea provablemente incapaz de afectar el bundle |

La lista negra del hosting es a propósito. El bundle del panel depende de cosas
fuera de `src/` —hoy `functions/calendario.js` por el alias `@calendario`— y una
lista blanca de rutas se pierde ese caso **en silencio**: el build queda verde y
producción se queda con el panel viejo. Con lista negra, un archivo nuevo y
desconocido cae del lado de deployar, que es el error barato.

**Orden:** reglas → hosting → functions. Las reglas primero porque si el panel
nuevo escribe campos que las reglas viejas rechazan, el orden inverso deja una
ventana de escrituras fallidas.

**El tag** lo crea el workflow cuando cambia `version` en `package.json`, no en
cada commit: aparece cuando una persona decidió que eso es una versión. Es
idempotente.

Para deployar todo sin mirar el diff: Actions → «Deploy desde main» → Run
workflow → *Deployar todo*.

### Publicar una versión

Subir `version` en `package.json` es lo que convierte un push en una release, y
arrastra dos cosas que no son automáticas:

1. **Las novedades sin publicar tienen que apuntar a la versión que se está
   publicando** (D-117), no al número que había cuando se escribieron. Es el
   único uso del campo `version` de `src/lib/novedades.ts` —correlacionar un
   síntoma con una release— y un valor equivocado ahí es peor que ninguno.
   Qué revisar: las entradas de `novedades.ts` que estén arriba de la última
   publicada.

   ```bash
   # Qué versión está en producción, y con qué commit se armó
   curl -s https://agenda-literaria.web.app/version.json
   # Qué novedades tiene ese commit (las de más arriba son las que no salieron)
   git show <sha>:src/lib/novedades.ts | grep "id: "
   ```

2. **Que las novedades existan.** Un cambio que se nota al usar el panel y no
   entró a `novedades.ts` no se lo cuenta nadie a la otra persona que carga
   actividades: el CHANGELOG es para quien programa. Es la fila de la tabla del
   §"cerrar un cambio" que más se saltea.

### Deploy a mano

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

**Las reglas de `/reportes/{id}` ya están desplegadas.** Se sabe sin mirar la
consola: `reporteAIssue` lleva nueve issues creados desde el panel, y eso solo es
posible si el formulario pudo escribir en esa colección.

### Functions

```bash
firebase deploy --only functions:syncCalendar,functions:rebuildPorOpciones
```

**Las seis Functions están desplegadas y ACTIVE** desde el 2026-08-25 (la última,
`guardarVersionAlBorrar`, a mano ese día). Un `firebase deploy --only functions` sin
filtro las incluye a las seis y hoy no rompe nada: ninguna depende de un secreto que
falte.

**Lo que sí queda pendiente es redesplegar esas dos.** `syncCalendar` y
`rebuildPorOpciones` cambiaron el 2026-08-24 (B-80, B-82, B-83, B-04) y las que
corren en producción son las viejas: hasta que se redesplieguen, `syncCalendar`
puede duplicar un evento y `rebuildPorOpciones` sigue sin publicar `destacado`. La
verificación después del deploy está más abajo, en "Verificar el sync después de
redesplegar".

**El deploy de Functions es a mano, por diseño y no por falta de trabajo**
(§"Roles de `deploy-ci@`" de [`02-infraestructura.md`](02-infraestructura.md)): la
única key del proyecto no tiene los roles para desplegarlas, y darlos sería casi
ejecución arbitraria. Lo mismo vale para las reglas desde el 2026-08-25 (D-119).

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
`pendiente`, lo que vuelve a disparar la Function.

**Desde el panel (B-31), que es el camino normal:** en "Bugs y sugerencias", cada
reporte que dice "no se pudo publicar" tiene un botón **Reintentar**. Escribe
`estado: 'pendiente'`, `intentos: 0` y `error: null`, que es exactamente lo que
hacía el comando de abajo. La lista se actualiza sola. Antes de tocarlo conviene
haber arreglado la causa —el token, el permiso, el repo— o va a volver a fallar.

**Con el Admin SDK**, que sigue haciendo falta para dos cosas que el panel no
puede: reintentar en bloque, y destrabar un reporte que quedó en `enviando`
porque la invocación se cortó a mitad (ese estado el panel no lo toca, para no
competir con una Function que puede seguir en vuelo). Va **desde la raíz del
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
firebase deploy --only functions

# 7. Rebuild automático: ver "Activar el rebuild automático" más abajo
#    (PAT en Secret Manager, service account de CI, secret de GitHub, y recién
#    ahí `firebase deploy --only functions:dispararRebuild`)

```

## Activar el rebuild automático (§8)

**Los cinco pasos ya se hicieron, el 2026-08-25 (B-20), y el lazo se verificó de
punta a punta.** Esta sección queda como runbook para rearmarlo en un proyecto
nuevo, para rotar el PAT, o para recrear `deploy-ci@`.

El código es la Function (`dispararRebuild`), su lógica de reintentos
(`functions/rebuild.js`) y el workflow (`.github/workflows/deploy.yml`). Lo que
pedía trabajo del dueño eran las **credenciales**: el PAT y la key de service
account no pueden pasar por un agente ni por el repo (§5.4).

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
# `gh` tiene dos cuentas logueadas y la activa (gonza-benoffi-modo) NO tiene
# permiso sobre este repo: sin esta línea, el comando corta con
# «HTTP 403: You must have repository read permissions».
export GH_TOKEN=$(gh auth token --user benoffi7)

gh secret set FIREBASE_SERVICE_ACCOUNT --repo benoffi7/agenda-literaria \
  < /tmp/deploy-ci.json
rm /tmp/deploy-ci.json    # no dejarla en el disco
gh secret list --repo benoffi7/agenda-literaria   # que aparezca, sin ver el valor
```

**Probar el workflow antes de seguir:** Actions → **«Deploy desde main»** → Run
workflow. **No** «Build y deploy del sitio»: ese es `deploy.yml`, que hoy **no
arranca**… ya no: era B-188 y se arregló. Pero sigue sin servir para probar el
secret, porque el que publica en un push es «Deploy desde main».

Y sabé de antemano qué vas a ver: la corrida **va a quedar roja** y eso no significa
que el secret esté mal. Un `workflow_dispatch` siempre intenta los tres deploys (ver
abajo), y con los dos roles mínimos los de reglas y Functions no tienen permiso. Lo
que hay que leer es el error de cada job, no el color de la corrida.

#### Medido el 2026-08-25, con el secret ya puesto

La primera corrida con credencial (*Deployar todo*) dio esto, y conviene leerlo
antes de otorgar nada:

| Job | Resultado |
|---|---|
| Qué deployar · Tests y typecheck | ✅ |
| Reglas e índices | ❌ `403 Permission denied to get service [firestore.googleapis.com]` |
| Cloud Functions | ❌ `Missing permissions … iam.serviceAccounts.ActAs on agenda-literaria@appspot.gserviceaccount.com` |
| Sitio y panel | ⏭️ **salteado** |
| Tag de versión | ⏭️ salteado |

**El salteo de Hosting es lo que hay que entender, y no es un bug:** su `if` pide
`needs.firestore.result != 'failure'`, o sea que **un job de reglas que falla
bloquea el deploy del sitio**, sea porque las reglas son inválidas o —como acá—
porque a la credencial le falta un permiso. Es el "reglas primero" del §orden
llevado hasta el final, y está bien que sea así.

**Pero eso NO significa que un push no publique.** Los tres jobs los decide
`que-deployar.sh`, y en un push normal las reglas no cambian:

```bash
$ printf 'src/lib/novedades.ts\n' | ./scripts/que-deployar.sh
hosting=true   functions=false   firestore=false     # firestore SALTEADO, no failure → Hosting corre
$ printf 'firestore.rules\n'      | ./scripts/que-deployar.sh
hosting=false  functions=false   firestore=true      # y acá Hosting no se toca
```

O sea: **con los dos roles, un push de código publica el panel y el sitio.** Lo que
no funciona es deployar reglas, deployar Functions, y *Deployar todo* — que
arrastra a Hosting por el `if`. Ojo con esto último: `workflow_dispatch` **siempre**
cae en "deployar todo", con o sin el checkbox, porque sin `github.event.before` el
script no puede diffear y falla hacia el lado de deployar. Así que el botón *Run
workflow* no sirve para probar solo Hosting mientras las reglas no tengan permiso.

#### Publicado desde CI, y por qué el job de reglas volvió a quedar rojo

Con `serviceUsageConsumer` + `firebaserules.admin` + `datastore.indexAdmin`, la
corrida siguiente publicó:

| Job | Resultado |
|---|---|
| Qué deployar · Tests y typecheck | ✅ |
| Reglas e índices | ✅ |
| **Sitio y panel** | ✅ **publicó `1.1.0+675d9e5`** |
| Cloud Functions | ❌ `iam.serviceAccounts.ActAs` (esperado — B-194) |
| Tag de versión | ⏭️ salteado por el rojo de Functions |

O sea: **un push a `main` publica solo.** Verificado a la salida:

```bash
curl -s https://agenda-literaria.web.app/version.json   # 1.1.0+675d9e5
curl -sI https://agenda-literaria.web.app/version.json | grep -i cache-control
curl -sL -o /dev/null -w '%{http_code}\n' https://agenda-literaria.web.app/admin
```

**Y unas horas después los dos roles de reglas se revirtieron** (D-119): el auditor
de privacidad mostró que `firebaserules.admin` convertía una key filtrada en "puede
hacer legible todo Firestore", porque las reglas del §5.3 son lo único que mantiene
fuera de una lectura anónima los borradores, `difusion` y los uids. Así que hoy el
estado final es:

| Cambia | Qué pasa |
|---|---|
| solo `src/` | ✅ **publica solo**, que es el caso normal |
| solo docs | ✅ verde sin deployar nada |
| `firestore.rules` o `firestore.indexes.json` | ❌ el job corta con `Permission denied` — reglas a mano |
| algo de `functions/` | ❌ el job corta con `iam.serviceAccounts.ActAs` — Functions a mano |
| **reglas + `src/` en el mismo push** | ❌ y **el panel no se publica**: el `if` de Hosting pide `needs.firestore.result != 'failure'` |

Las tres últimas filas son **B-194**, con las salidas escritas. La última es la que
más incomoda: el `if` existe para que el panel nuevo no salga antes que las reglas
que necesita, y con las reglas a mano ese orden pasó a ser responsabilidad de quien
deploya, no del workflow.

El de Functions es otra cosa y **conviene no otorgarlo**: pide
`roles/iam.serviceAccountUser` sobre `agenda-literaria@appspot.gserviceaccount.com`
más `cloudfunctions.developer`, `run.admin`, `eventarc.developer`,
`artifactregistry.writer` y `cloudbuild.builds.editor`. Poder actuar como una
identidad privilegiada y desplegar código que corre con ella es, junta, casi
ejecución arbitraria en el proyecto — y esto es **la única key que existe**. El
deploy de Functions es de a una y a mano, con el runbook de más arriba, que es como
se hizo siempre.

**Con los dos roles de `deploy-ci@` alcanza para publicar el sitio y el panel, y
nada más.** `push-main.yml` tiene además un job que despliega las reglas de
Firestore y otro que despliega las Functions, y los dos usan este mismo secret con
`npx firebase deploy`. El detalle de qué falla, con qué error y qué rol pide cada
uno está medido abajo. La regla al otorgar es agregar **de a uno leyendo el error**
y no la lista completa de entrada: cada rol de más es alcance que tiene la única
key del proyecto.

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

## Alerta de rebuild agotado (B-21)

El único log del proyecto que amerita despertar a alguien. Cuando el
`repository_dispatch` falla cinco veces con backoff (5, 10, 20, 40 min — D-23),
`dispararRebuild` se rinde y **no vuelve a intentar hasta que haya un cambio
nuevo**: el sitio público queda viejo y nadie se entera. Eso es lo que esta alerta
avisa.

**El lado del código ya está** (`functions/index.js`, al agotarse los intentos):

```js
logger.error('el rebuild agotó los reintentos: el sitio quedó viejo', {
  alerta: 'rebuild-agotado',
  intentos: fallo.intentos,
  error: fallo.ultimoError,
  motivo: estado.motivo,
});
```

El campo `alerta` existe **para que el filtro no dependa del texto del mensaje**: un
filtro sobre la frase se rompe en silencio el día que alguien la reescribe, y una
alerta que dejó de disparar no se nota nunca. El filtro apunta al campo.

### 1 · Mirar una entrada real antes de fijar el filtro

Este paso no se saltea. Las Functions v2 corren sobre Cloud Run, así que en Logging
aparecen como `cloud_run_revision` y **no** como `cloud_function`, y el nombre del
servicio va en `resource.labels.service_name`. Conviene confirmarlo con una entrada
de verdad en lugar de copiar el filtro de acá:

```bash
# Cualquier log reciente de la Function, con su resource.type y sus labels
gcloud logging read \
  'resource.labels.service_name="dispararrebuild"' \
  --project agenda-literaria --limit 1 --format=json \
  | python3 -c 'import json,sys; e=json.load(sys.stdin)[0]; print(e["resource"]["type"], e["resource"]["labels"])'
```

Ojo con dos cosas que se ven ahí: el `service_name` va en **minúsculas**
(`dispararrebuild`), y si el proyecto todavía tiene Functions de 1ª generación el
`resource.type` puede variar entre una y otra.

Para forzar una entrada de prueba sin esperar una caída real, se puede poner el
documento en estado agotado a mano — el mismo camino del §"Reintentar un reporte que
quedó en `error`", pero sobre `sistema/rebuild`:

```bash
FIRESTORE_EMULATOR_HOST= node -e "
  const { initializeApp } = require('firebase-admin/app');
  const { getFirestore } = require('firebase-admin/firestore');
  initializeApp({ projectId: 'agenda-literaria' });
  getFirestore().doc('sistema/rebuild').set(
    { pendiente: true, intentos: 5, agotado: true, ultimoError: 'prueba de alerta' },
    { merge: true },
  ).then(() => console.log('listo: el próximo tick loguea el error'));
"
```

**Dejarlo así rompe el rebuild hasta el próximo cambio de contenido**, que es
justamente lo que la alerta avisa; después del ensayo, bajar `agotado` e `intentos`.

### 2 · Crear la alerta

Consola → **Logging → Log-based Metrics**, o directamente
**Monitoring → Alerting → Create Policy → Log-based alert**. El filtro, ajustado con
lo que devolvió el paso 1:

```
resource.type="cloud_run_revision"
resource.labels.service_name="dispararrebuild"
severity=ERROR
jsonPayload.alerta="rebuild-agotado"
```

`jsonPayload.alerta` es la condición que importa; las otras tres acotan el ruido. Si
el paso 1 mostró otro `resource.type`, **dejar solo las dos últimas líneas**: el
campo `alerta` no lo emite nada más en el proyecto, así que alcanza para no tener
falsos positivos.

Configuración sugerida:

| | |
|---|---|
| Condición | *Any log entry matches* — no hace falta umbral: una sola vez ya es la noticia |
| Auto-close | 1 día, el mínimo. La alerta no se "resuelve" sola: el rebuild solo se rearma con un cambio nuevo |
| Canal | mail del dueño. Un canal nuevo se crea en **Monitoring → Alerting → Notification channels** |
| Nombre | `rebuild agotado — el sitio público quedó viejo` |

**El canal lo elige el dueño y es el único paso que no se puede escribir acá**
(§5.4): crear un canal de notificación con un mail o un teléfono es dato personal y
configuración de consola.

### 3 · Qué hacer cuando llegue

La alerta dice que el sitio quedó viejo, no qué se rompió. El diagnóstico es el
§"El sitio no se actualiza después de cargar una actividad" más abajo, y el motivo
concreto está en el documento:

```bash
gcloud firestore documents get 'sistema/rebuild' --project agenda-literaria
```

`ultimoError` suele ser una de tres: el PAT venció (401), el repo cambió de nombre
(404), o el workflow no arrancó — que es lo que fue **B-188** y no da error del lado
de la Function, porque el `repository_dispatch` devuelve 204 igual.

El rearme es automático con el próximo cambio de contenido (`CAMPOS_REARME`, D-23);
para forzarlo sin editar una actividad, bajar `agotado` e `intentos` a mano con el
snippet del paso 1.

## Diagnosticar

### Logs del sync

```bash
gcloud functions logs read syncCalendar --project agenda-literaria \
  --region southamerica-east1 --limit 30
```

Los mensajes útiles: `evento creado`, `evento actualizado`, `evento borrado`,
`sin cambios relevantes para Calendar`, `falló una operación de Calendar`, y
desde B-82 `el evento ya existía con el id derivado: se actualizó` (una
reentrega, o un encuentro que volvió a publicarse: no es un error).

### Verificar el sync después de redesplegar (B-80, B-82, B-83, B-04)

Cuatro pruebas sobre una actividad de prueba publicada, en este orden. Las tres
primeras se miran en el calendario real (ver "Leer el calendario real"):

1. **B-83** · tildar "Destacar en la portada" y guardar. No tiene que aparecer
   ninguna operación de Calendar en los logs, y `sistema/rebuild.pendiente` tiene
   que quedar en `true` con `motivo: "actividad <id>"`. Antes no se marcaba.
2. **B-80** · publicar, esperar el write-back, y sin recargar el panel editar el
   título desde el listado dos veces seguidas. En el calendario tiene que haber
   **un** evento, no dos, y el documento tiene que conservar su
   `calendarEventId` después de cada guardado.
3. **B-82** · el id del evento de una sesión nueva tiene que ser el id de sesión
   sin el `_` ni los guiones (`ses_3f2a…` → `ses3f2a…`), visible en
   `calendarEventId`. Los eventos viejos conservan el id de Google: eso es lo
   esperado, no hay que migrar nada.
4. **B-04** · renombrar una etiqueta de taxonomía usada por una actividad
   publicada (por ejemplo el barrio) y confirmar en los logs de
   `rebuildPorOpciones` el mensaje `eventos re-sincronizados por un cambio de
   etiqueta`, con la descripción del evento ya actualizada. Guardar el formulario
   sin renombrar nada tiene que loguear `sin etiquetas renombradas`: el `usos + 1`
   de cada guardado **no** re-sincroniza.

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
pero sin GitHub configurado`, `llegó otro cambio durante el dispatch: queda
pendiente para el próximo tick` (B-85: el flag **no** se baja, porque el build
que arrancó no incluye ese cambio).

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
| El reporte del panel da *permission denied* al guardar | las reglas de `/reportes` no están desplegadas — deberían estarlo, ver arriba | `firebase deploy --only firestore:rules` |
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
