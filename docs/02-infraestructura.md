# Infraestructura — inventario

Estado real al 2026-08-25, relevado con `gcloud` y `firebase`, no de memoria.
Para re-relevarlo, ver los comandos al final.

## Proyecto

| | |
|---|---|
| Project ID | `agenda-literaria` |
| Número | `1038157194972` |
| Plan | **Blaze** (facturación habilitada) |
| Cuenta de facturación | `019C0A-4613E2-EC4BDD` |
| Dueño | `benoffi11@gmail.com` |
| Consola | https://console.firebase.google.com/project/agenda-literaria |

El plan Blaze es obligatorio (§2.3): en Spark las Cloud Functions no hacen
llamadas de red salientes, ni siquiera a APIs de Google, así que el sync a
Calendar no funcionaría.

### Budget alert

USD 5/mes con avisos al 50%, 90% y 100%. Lo pide el §2.3 al pasar a Blaze.

Además hay una política de limpieza en Artifact Registry
(`southamerica-east1/gcf-artifacts`) que borra las imágenes de contenedor de más
de 1 día: sin eso las imágenes de cada deploy acumulan cargo de storage.

## Firestore

| | |
|---|---|
| Base | `(default)` |
| Modo | Native |
| Región | **`southamerica-east1`** (São Paulo) — regional |
| Free tier | sí |

**La región es irreversible** para la base `(default)`. Se eligió São Paulo por
cercanía a Argentina (~30 ms vs ~150 ms desde EEUU) y porque las Functions viven
en la misma región: cada operación del diff de Calendar es un round trip.

Reglas en `firestore.rules`, índices en `firestore.indexes.json`. Se despliegan
con `firebase deploy --only firestore:rules,firestore:indexes`.

## Authentication

| | |
|---|---|
| Proveedor | Google (habilitado) |
| Una cuenta por email | sí (`allowDuplicateEmails: false`) |
| Dominios autorizados | `agenda-literaria.firebaseapp.com`, `agenda-literaria.web.app` |

**Habilitar el proveedor Google requiere la consola.** Por API pide un
`client_id` que no existe hasta que el toggle de Firebase auto-crea el OAuth
client. No es automatizable con las credenciales del proyecto.

### Cuentas con claim `admin`

| Email | uid |
|---|---|
| `benoffi11@gmail.com` | `bNvcQmbUwdSduoSfA2Oa9hxYMQp2` |
| `librosdelatiahilda@gmail.com` | `JBnbwgf2VxgPWSMaWKTI5PlSwUu1` |

Las cuentas se crearon con el Admin SDK **antes** del primer login, para dejar
el claim listo. Como hay una cuenta por email, al entrar con Google Firebase
linkea el proveedor a la cuenta existente y conserva el uid, así que el claim
sobrevive.

Para agregar otro admin: `node scripts/preparar-produccion.mjs <email>`.

## Hosting

| | |
|---|---|
| Site | `agenda-literaria` |
| URL | https://agenda-literaria.web.app |
| Panel | https://agenda-literaria.web.app/admin |
| Origen | `dist/` (build de Astro) |

Rewrite de `/admin/**` a `/admin/index.html` para el router propio de la SPA.

**Cabeceras de cache declaradas en `firebase.json`** (D-38), no el default:

| Recurso | `Cache-Control` |
|---|---|
| `/_astro/**` (assets con hash) | `public, max-age=31536000, immutable` |
| `/version.json` | `no-store, max-age=0` |
| `**/*.html`, `/`, `/admin`, `/admin/**` | `no-cache` |

Es lo que hace que un panel abierto pueda actualizarse: con el HTML cacheado,
recargar vuelve a pedir los mismos assets viejos. Verificarlas después de cada
deploy con los `curl` de [`08-operacion.md`](08-operacion.md).

## Cloud Functions (v2)

Todas en `southamerica-east1`, Node 22, `maxInstances: 5` (`reporteAIssue`, 3).


| Función | Trigger | Estado |
|---|---|---|
| `syncCalendar` | `onDocumentWritten actividades/{id}` | ACTIVE — **hay que redesplegar** (B-80, B-82, B-83) |
| `rebuildPorOpciones` | `onDocumentWritten opciones/{campo}` | ACTIVE — **hay que redesplegar** (B-04, `timeoutSeconds: 300`) |
| `guardarVersion` | `onDocumentUpdated actividades/{id}` | ACTIVE |
| `guardarVersionAlBorrar` | `onDocumentDeleted actividades/{id}` | ACTIVE — desplegada a mano el 2026-08-25 |
| `dispararRebuild` | `onSchedule every 5 minutes` | ACTIVE — lazo del §8 verificado de punta a punta el 2026-08-25 |
| `reporteAIssue` | `onDocumentWritten reportes/{id}` | ACTIVE — 9 issues creados |

`rebuildPorOpciones` pasó a llevar `timeoutSeconds: 300` porque desde B-04 no
solo marca el rebuild: al renombrar una etiqueta reescribe los eventos de todas
las actividades publicadas, que son N round trips a Calendar (con un tope de 150
eventos por corrida). Las demás opciones las sigue heredando del
`setGlobalOptions` de `index.js`, donde está definida.

`guardarVersionAlBorrar` vive en el mismo archivo que `guardarVersion` y comparte
sus opciones, así que no necesita IAM nuevo: es una Function más en el mismo
deploy.

`guardarVersion` (§12, D-41) declara `region`, `maxInstances` y `serviceAccount`
**en su propio trigger** y no los hereda del `setGlobalOptions` de `index.js`:
vive en `functions/historial-trigger.js`, y los imports de ESM se evalúan antes
del cuerpo del importador, así que cuando se define, `setGlobalOptions` todavía
no corrió. Heredarlas la dejaría en `us-central1` con la SA por defecto.

Reusa `calendar-sync@` a propósito: es la única SA del proyecto que ya tiene los
roles que un trigger de Firestore v2 necesita y hay que otorgar a mano (ver
abajo). Una SA propia sin permiso de Calendar sería más prolijo —no necesita
tocar Calendar— pero es trabajo de IAM antes de poder desplegar.

**Relevado contra el proyecto el 2026-08-25** (`gcloud functions list`,
`gcloud secrets list`), porque los párrafos de abajo decían lo contrario y llevaban
días desactualizados. Lo que estaba mal, y en los dos casos hacia el mismo lado —la
doc creía que faltaba trabajo que ya estaba hecho:

- `guardarVersion`, `dispararRebuild` y `reporteAIssue` figuraban como "escritas,
  sin desplegar" y están **ACTIVE**. `reporteAIssue` lleva **nueve issues creados**
  desde el panel, que es la prueba más dura posible.
- El secreto `GITHUB_TOKEN` figuraba como "falta crearlo" y **existe desde el
  2026-08-21**, o sea desde antes de que se escribiera que faltaba.
- `guardarVersionAlBorrar` era la única de la tabla que la doc tenía bien… y se
  desplegó a mano ese mismo día, después de este relevo. **Las seis Functions del
  proyecto están ACTIVE**, por primera vez.

Consecuencia para B-20: **los cinco pasos están hechos** desde el 2026-08-25. Un
push a `main` publica el sitio y el panel solo. Lo que sigue sin funcionar es el
rebuild por editar una actividad, que estaba cortado por **B-188** y quedó
arreglado y verificado el mismo día.

Y una que apareció al relevarlo: `dispararRebuild` estaba **corriendo cada 5
minutos** mandando su `repository_dispatch` a un `deploy.yml` que **no arrancaba**
(B-188) — el lazo del §8 prendido de punta a punta menos en el último eslabón, y en
silencio, porque la Function no tiene forma de enterarse. **Arreglado y verificado el
2026-08-25**: mandando a mano el mismo `event_type: 'rebuild'` que manda la Function,
«Build y deploy del sitio» arrancó, imprimió el motivo del `client_payload` y publicó
`1.1.0+ad973b8`.

`reporteAIssue` está desplegada y funcionando: el PAT existe en Secret Manager y
los reportes del panel llegan como issues con la etiqueta `reporte-panel`. Las opciones (región, service account, `secrets`) van
**explícitas en su propia definición** y no en el `setGlobalOptions()` de
`index.js` — en ESM el import corre antes y las opciones globales llegarían tarde
(D-35).


### Variables de entorno y secretos


En `functions/.env`, versionado (nada de esto es secreto):

| Variable | Valor |
|---|---|
| `GOOGLE_CALENDAR_ID` | el id del calendario público |
| `GITHUB_REPO` | `benoffi7/agenda-literaria` |

### Secretos (Secret Manager)

| Secreto | Lo usa | Estado |
|---|---|---|
| `GITHUB_TOKEN` | `reporteAIssue` (issues de reportes) y `dispararRebuild` (§8) | **existe** desde el 2026-08-21 |

El PAT nunca va a `functions/.env` ni al repo (§5.4). El valor se resuelve en
runtime con `defineSecret(...).value()`, así que tampoco queda en el artefacto
del deploy. Los comandos para crearlo y dar el permiso están en
[`08-operacion.md`](08-operacion.md).

`defineSecret` es lo que monta el secreto en el runtime de la Function: leerlo
de `process.env` sin declararlo daba `undefined` en producción. La service
account de la Function necesita `roles/secretmanager.secretAccessor` sobre ese
secreto, y la API `secretmanager.googleapis.com` habilitada.

### Secrets de GitHub Actions

| Secret | Para qué | Estado |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | JSON de la key con que el workflow lee Firestore en build time (§2.4) y despliega Hosting | **existe** desde el 2026-08-25 |

Es la única key de service account del proyecto, y existe porque un runner de
GitHub no tiene ADC. Nunca va al repo (§5.4): vive en los secrets de GitHub y
solo se materializa en la memoria del runner.

**Fue el único bloqueante para que un push publique algo**, y ya está resuelto. El
primer push del repo pasó el gate entero y murió con `Error: Input required and not
supplied: firebaseServiceAccount`; con el secret cargado, la corrida del 2026-08-25
18:04 publicó `1.1.0+675d9e5` desde CI. El deploy a mano
(§"Deploy a mano" de [`08-operacion.md`](08-operacion.md)) queda como salida de
emergencia, no como el camino normal.


## Service accounts

| Email | Para qué |
|---|---|
| `calendar-sync@…` | **identidad de las Functions.** Es la cuenta con la que se comparte el calendario. La usan también `guardarVersion` y `guardarVersionAlBorrar`, que no tocan Calendar. |
| `deploy-ci@…` | Identidad del workflow de Actions: leer Firestore en build time, desplegar Hosting y las reglas. Creada el 2026-08-25; **la única key del proyecto** es la suya, y vive solo en los secrets de GitHub. |

| `firebase-adminsdk-fbsvc@…` | default del Admin SDK, sin uso propio |
| `1038157194972-compute@…` | default de Compute, sin uso propio |
| `agenda-literaria@appspot…` | default de App Engine, sin uso propio |

### Roles de `calendar-sync@`

```
roles/datastore.user           escribir el calendarEventId de vuelta y las versiones (§12)
roles/logging.logWriter        logs
roles/eventarc.eventReceiver   recibir el trigger de Firestore
roles/run.invoker              ser invocada como servicio de Cloud Run
roles/artifactregistry.reader  leer su propia imagen al arrancar
```

**Los últimos tres hay que otorgarlos a mano.** La service account por defecto
de Compute los trae de fábrica; una propia no. Es la causa de que el primer
deploy de Functions falle con `eventarc.events.receiveEvent denied`.

Cuando se despliegue `reporteAIssue` hay que sumarle
`roles/secretmanager.secretAccessor` sobre el secreto `GITHUB_TOKEN`: la Function
corre con esta misma identidad (se reusa a propósito — una service account nueva
necesitaría otra vez los tres roles que la default de Compute trae de fábrica,
que es lo que ya hizo fallar dos deploys — D-06, D-35).

Al desplegar `dispararRebuild` hay que sumarle
`roles/secretmanager.secretAccessor` **sobre el secreto `GITHUB_TOKEN`**, no
sobre el proyecto entero: es el único secreto que la Function necesita leer.

### Roles de `deploy-ci@`

```
roles/datastore.viewer                     leer Firestore en build time (§2.4)
roles/firebasehosting.admin                desplegar el sitio y el panel
roles/serviceusage.serviceUsageConsumer    el chequeo de "¿está la API habilitada?"
```

**Tuvo dos roles más durante una hora, y se los quitamos el mismo día.** Para
habilitar el job de reglas se agregaron `firebaserules.admin` y
`datastore.indexAdmin`; el auditor de privacidad señaló lo que eso implicaba y se
revirtió. El razonamiento, porque es el que hay que volver a hacer si alguien
propone agregarlos de nuevo (D-119):

**Las reglas del §5.3 son lo único que mantiene fuera de una lectura anónima los
borradores, `difusion`, `online.url` y los uids.** Con `firebaserules.admin`, una
key filtrada dejaba de poder "leer lo que ya es público" y pasaba a poder **hacer
legible todo Firestore**. Es el mismo argumento con el que esta cuenta no tiene los
roles de Functions, aplicado a los datos en vez de al cómputo — y era peor, porque
los roles de Functions solo habilitan un deploy y éste cambia la visibilidad de lo
que ya está guardado.

`serviceUsageConsumer` se queda: lo único que habilita es preguntar si una API está
habilitada. Sin él, cualquier comando de `firebase` corta con
`403 Permission denied to get service [firestore.googleapis.com]` antes de intentar
nada.

Deliberadamente **no** tiene escritura de ningún tipo: ni de datos, ni de reglas, ni
de Functions. Si la key se filtrara, el daño se limita a leer datos que ya son
públicos y a publicar el sitio.

**Por qué no tiene los roles de Functions:**
el job «Cloud Functions» de `push-main.yml` falla con
`iam.serviceAccounts.ActAs on agenda-literaria@appspot.gserviceaccount.com`, y
habilitarlo pide ese `roles/iam.serviceAccountUser` más `cloudfunctions.developer`,
`run.admin`, `eventarc.developer`, `artifactregistry.writer` y
`cloudbuild.builds.editor`. Poder actuar como una identidad privilegiada **y**
desplegar código que corre con ella es, junto, casi ejecución arbitraria en el
proyecto — y ésta es la **única key que existe**. El argumento por el que esta
cuenta es aparte de `calendar-sync@` se cae si se le agrega eso. Las Functions se
despliegan de a una y a mano, con el runbook de
[`08-operacion.md`](08-operacion.md), que es como se hizo siempre. **Y las reglas
igual, por la misma razón** (arriba).

La contra asumida, que es de las dos decisiones juntas: **el job de reglas y el de
Functions no pueden terminar bien nunca.** Todo push que toque `firestore.rules`,
`firestore.indexes.json` o `functions/` deja la corrida roja, y con ella se saltea el
job del tag de versión. Peor: el `if` del job de Hosting pide
`needs.firestore.result != 'failure'`, así que **un push que toque las reglas y el
panel a la vez no publica el panel**. Eso es **B-194**, con las salidas escritas.

Otorgados y verificados el 2026-08-25 — exactamente esos tres y nada más:

```bash
gcloud projects get-iam-policy agenda-literaria --flatten="bindings[].members" \
  --filter="bindings.members:deploy-ci@agenda-literaria.iam.gserviceaccount.com" \
  --format="value(bindings.role)"
```

**Alcanzan para Hosting y nada más.** Los jobs de reglas y de Functions de
`push-main.yml` usan el mismo secret y van a cortar con `Permission denied` el día
que cambien esos paths; los roles que piden, y por qué se agregan de a uno leyendo
el error en lugar de otorgarlos de entrada, están en
[`08-operacion.md`](08-operacion.md) § "La key como secret de GitHub".


## Google Calendar

| | |
|---|---|
| Calendar ID | `68e6037bad1570002e484be4a5a21b6dd052afadef1af6c4cb99946b0d2aaea3@group.calendar.google.com` |
| Compartido con | `calendar-sync@agenda-literaria.iam.gserviceaccount.com` |
| Permiso | Realizar cambios en los eventos |

La URL privada del ICS (`.../private-.../basic.ics`) **es un secreto**: quien la
tenga lee el calendario entero. No está en el repo y no debe estarlo. Sirve para
verificar el contenido real del calendario desde la línea de comandos.

La API key del proyecto **no** sirve para leer Calendar: las browser keys de
Firebase tienen ese método bloqueado.

## APIs habilitadas relevantes

```
firestore, identitytoolkit, securetoken      panel y auth
firebasehosting, firebaserules               sitio y reglas
cloudfunctions, run, eventarc, pubsub        Functions v2
cloudbuild, artifactregistry                 build de las Functions
cloudscheduler                               para dispararRebuild (paso 5)
calendar-json                                sync a Calendar
secretmanager                                el PAT de GitHub — habilitada (2026-08-21)
cloudbilling, billingbudgets                 budget alert
```

`secretmanager.googleapis.com` está habilitada desde el 2026-08-21, junto con la
creación del secreto `GITHUB_TOKEN`. Se sabe sin mirar la consola: `reporteAIssue`
lleva nueve issues creados, y sin la API y el secreto no podría crear ninguno.

Hay muchas más habilitadas por defecto (BigQuery, Dataplex, etc.) que el
proyecto no usa. No molestan y desactivarlas no aporta.

## Dependencias del entorno local

| | |
|---|---|
| Node | 22 |
| **JDK 21+** | los emuladores lo exigen |
| `firebase-tools` | **lo trae `npm ci`** (devDependency) — ya no hay que instalarlo a mano |
| `gcloud` | autenticado, con ADC |

**Ojo con Java.** En la máquina de desarrollo el JDK por defecto es el 17 que
trae Android Studio, y los emuladores fallan con
`no longer supports Java version before 21`. El script `npm run emu` apunta a
`openjdk@21` de Homebrew sin tocar el `JAVA_HOME` global, para no romper
Android Studio.

Los scripts contra producción usan las **Application Default Credentials** de
gcloud, así que no hay ninguna service account key en disco.

**`firebase-tools` pasó a ser una `devDependency`** y no un requisito del entorno
(B-187). Era global, y `npx firebase` en esta máquina resolvía ese global: los
workflows usan el mismo comando y en un runner sin instalación global cortaban con
`npm error could not determine executable to run`. Un requisito del entorno que
solo existe en una máquina es un requisito que CI descubre por su cuenta. Ahora el
gate de pre-push y los workflows corren el **mismo** binario, que es lo que hace
que "verde local" signifique algo.

## Re-relevar el inventario

```bash
gcloud services list --enabled --project agenda-literaria
gcloud iam service-accounts list --project agenda-literaria
gcloud functions list --project agenda-literaria
gcloud firestore databases list --project agenda-literaria
firebase hosting:sites:list --project agenda-literaria

# Roles de una service account
gcloud projects get-iam-policy agenda-literaria \
  --flatten="bindings[].members" \
  --filter="bindings.members:calendar-sync@agenda-literaria.iam.gserviceaccount.com" \
  --format="value(bindings.role)"
```

Las APIs de Identity Toolkit y Cloud Billing necesitan el header
`x-goog-user-project: agenda-literaria` cuando se las llama con ADC de usuario,
si no devuelven 403 por falta de quota project.
