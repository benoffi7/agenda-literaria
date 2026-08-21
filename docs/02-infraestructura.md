# Infraestructura — inventario

Estado real al 2026-08-21, relevado con `gcloud` y `firebase`, no de memoria.
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

Ambas en `southamerica-east1`, Node 22, `maxInstances: 5`.

| Función | Trigger | Estado |
|---|---|---|
| `syncCalendar` | `onDocumentWritten actividades/{id}` | ACTIVE |
| `rebuildPorOpciones` | `onDocumentWritten opciones/{campo}` | ACTIVE |
| `dispararRebuild` | `onSchedule every 5 minutes` | **escrita, sin desplegar** |

`dispararRebuild` no se desplegó porque todavía no existen el sitio público ni
el workflow de GitHub Actions que tendría que disparar: sería un schedule
corriendo cada 5 minutos para no hacer nada.

### Variables de entorno

En `functions/.env`, versionado:

| Variable | Secreta | Valor |
|---|---|---|
| `GOOGLE_CALENDAR_ID` | no | el id del calendario público |
| `GITHUB_TOKEN` | **sí** | falta — va a Secret Manager (§5.4) |
| `GITHUB_REPO` | no | falta — para el paso 5 |

## Service accounts

| Email | Para qué |
|---|---|
| `calendar-sync@…` | **identidad de las Functions.** Es la cuenta con la que se comparte el calendario. |
| `firebase-adminsdk-fbsvc@…` | default del Admin SDK, sin uso propio |
| `1038157194972-compute@…` | default de Compute, sin uso propio |
| `agenda-literaria@appspot…` | default de App Engine, sin uso propio |

### Roles de `calendar-sync@`

```
roles/datastore.user           escribir el calendarEventId de vuelta
roles/logging.logWriter        logs
roles/eventarc.eventReceiver   recibir el trigger de Firestore
roles/run.invoker              ser invocada como servicio de Cloud Run
roles/artifactregistry.reader  leer su propia imagen al arrancar
```

**Los últimos tres hay que otorgarlos a mano.** La service account por defecto
de Compute los trae de fábrica; una propia no. Es la causa de que el primer
deploy de Functions falle con `eventarc.events.receiveEvent denied`.

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
cloudbilling, billingbudgets                 budget alert
```

Hay muchas más habilitadas por defecto (BigQuery, Dataplex, etc.) que el
proyecto no usa. No molestan y desactivarlas no aporta.

## Dependencias del entorno local

| | |
|---|---|
| Node | 22 |
| **JDK 21+** | los emuladores lo exigen |
| `firebase-tools` | 15.9.1 |
| `gcloud` | autenticado, con ADC |

**Ojo con Java.** En la máquina de desarrollo el JDK por defecto es el 17 que
trae Android Studio, y los emuladores fallan con
`no longer supports Java version before 21`. El script `npm run emu` apunta a
`openjdk@21` de Homebrew sin tocar el `JAVA_HOME` global, para no romper
Android Studio.

Los scripts contra producción usan las **Application Default Credentials** de
gcloud, así que no hay ninguna service account key en disco.

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
