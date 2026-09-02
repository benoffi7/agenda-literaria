# Infraestructura — inventario

Estado real al 2026-08-25, relevado con `gcloud` y `firebase`, no de memoria.
Para re-relevarlo, ver los comandos al final.

## Proyecto

| | |
|---|---|
| Project ID | `agenda-literaria` |
| Número | `1038157194972` |
| Plan | **Blaze** (facturación habilitada) |
| Cuenta de facturación | en la consola de Facturación — no se versiona |
| Dueño | la cuenta admin principal — ver `--listar` más abajo |
| Consola | https://console.firebase.google.com/project/agenda-literaria |

El número de cuenta de facturación y el mail del dueño salieron de esta tabla
por el mismo motivo que los uids de más abajo: el repo es público (§5.1, D-57).
El Project ID y el número de proyecto se quedan — son públicos por diseño, van
en el bundle del panel.

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

## Cloud Storage

| | |
|---|---|
| Bucket | `agenda-literaria.firebasestorage.app` (el default del proyecto) |
| Declarado en | `PUBLIC_FIREBASE_STORAGE_BUCKET`, en los tres `.env.*` |
| Reglas | `storage.rules` — **desplegadas y funcionando** (ver abajo) |
| Prefijos en uso | `imagenes/img_<uuid>.{jpg,png}` (la galería de B-167) y `miniaturas/img_<uuid>.jpg` (B-220, D-175) |

**Lo único que hay ahí son las imágenes propias de la galería** (B-167, DEC-7c):
las que se suben desde el panel, en oposición a las externas, que son una URL de
otro sitio y no pasan por acá.

**El bucket estaba en la config del SDK desde el primer día y nunca se usó.** Antes
de desplegar las reglas hay que confirmar que exista de verdad: si el proyecto
nunca inicializó Storage, se hace una vez desde la consola de Firebase, que ahí
pide la región (conviene `southamerica-east1`, al lado de Firestore y las
Functions — las imágenes las sirve el CDN, pero el egreso interregional no).

Se despliegan con `firebase deploy --only storage`, que es un target **aparte** de
`firestore:rules`. `scripts/que-deployar.sh` lo decide en su propia línea; ver
`08-operacion.md` § «Reglas de Storage».

**Están desplegadas — verificado contra producción el 2026-09-02**, y la doc
decía lo contrario. Las dos mitades se comprobaron sin credenciales, porque las dos
son observables desde afuera:

- un objeto de `imagenes/` responde **200** a un `GET` anónimo, así que
  `allow get: if true` está activo;
- `GET /v0/b/<bucket>/o?prefix=imagenes/` anónimo responde **403**, así que
  `allow list: if esAdmin()` también. La trampa 13 está cerrada en producción y
  no solo en el emulador.

**Y un dato que cambia cómo hay que leer las URLs de descarga:** el mismo objeto
responde 200 **con** su token, **sin** token y con un token inventado. O sea que
el `?token=` de `getDownloadURL()` **no protege nada** mientras la regla sea
pública — lo que autoriza es la regla. Es lo que B-206 #1 ya había decidido
(«el token deja de ser lo que protege el objeto»), ahora medido; y es lo que
permite que el sitio **derive** la URL de la miniatura sin conocer su token
(D-175).

**Lo que estas reglas hacen** (DEC-7b): lectura pública bajo `imagenes/` —son
imágenes que van al sitio y a `og:image`—, escritura solo con el claim `admin`, y
un tope de 3 MB y de tipo (`image/jpeg`, `image/png`) verificado del lado del
servidor porque el cliente se puede saltear. Lo que **no** pueden hacer es contar
las imágenes de una actividad: ese tope vive en el schema.

**`miniaturas/` es su hermano, no su hijo** (B-220, D-175): `allow get: if true`,
`allow list: if esAdmin()` y `allow write: if false` — ahí escribe solo la
Function, con el Admin SDK, que pasa por encima de las reglas. Anidarlo bajo
`imagenes/` habría obligado a escribir `{ruta=**}`, y ése es el patrón con el que
la trampa 13 se reabre.

## Authentication

| | |
|---|---|
| Proveedor | Google (habilitado) |
| Una cuenta por email | sí (`allowDuplicateEmails: false`) |
| Dominios autorizados | `agenda-literaria.firebaseapp.com`, `agenda-literaria.web.app`. **Ojo:** el panel se entra por `agendaleh.ar/admin`, y el login de Auth funciona porque Firebase agrega solo el dominio propio al agregarlo en Hosting; si algún día un login falla con `auth/unauthorized-domain`, es acá donde se agrega |

**Habilitar el proveedor Google requiere la consola.** Por API pide un
`client_id` que no existe hasta que el toggle de Firebase auto-crea el OAuth
client. No es automatizable con las credenciales del proyecto.

### Cuentas con claim `admin`

**Son dos.** Los mails y los uids no se listan acá: este repo es público (§5.1,
D-57 — uid y mail de admin no salen ni crudos ni hasheados, y esta tabla los
publicaba mapeados uno contra otro, con el cartel de que son exactamente las
cuentas que pueden escribir todo). Para verlas:

```sh
node scripts/preparar-produccion.mjs --listar
```

o la consola de Firebase → Authentication. Un uid no es una credencial, pero es
la mitad del trabajo de un ataque dirigido, y publicarlo es irreversible.

Las cuentas se crearon con el Admin SDK **antes** del primer login, para dejar
el claim listo. Como hay una cuenta por email, al entrar con Google Firebase
linkea el proveedor a la cuenta existente y conserva el uid, así que el claim
sobrevive.

Para agregar otro admin: `node scripts/preparar-produccion.mjs <email>`.

## Hosting

| | |
|---|---|
| Site | `agenda-literaria` |
| **URL canónica** | **https://agendaleh.ar** — la decisión del dueño (**D-165**), y la única aparición del dominio en el repo: `SITIO`, en `src/lib/rutasPublicas.ts` |
| Alias | `https://agendaleh.com.ar` (sirve el mismo contenido; **falta el 301**, es acción del dueño — ver [`08-operacion.md`](08-operacion.md) § «El dominio») y `https://agenda-literaria.web.app`, el nombre de Firebase, que **no se apaga nunca** |
| Panel | https://agendaleh.ar/admin |
| Origen | `dist/` (build de Astro) |

**Los tres nombres sirven el mismo HTML**, y lo que evita que eso sea contenido
duplicado es el `canonical` **absoluto** que ese HTML lleva (B-109): apunta al
canónico incluso cuando lo sirve un alias. Un canonical relativo se resolvería
contra el host que lo sirvió y diría que la página buena es la del espejo.

**Firebase agrega la barra final con un 301**: `/cartelera` redirige a
`/cartelera/`. Por eso la canónica y el sitemap la llevan (`rutaCanonica`) —
apuntar a una redirección es un aviso en Search Console y una URL menos
rastreada. Que los `href` internos la paguen es una deuda chica: **B-293**.

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
| `optimizarImagen` | `onObjectFinalized` (bucket entero) | **escrita, sin desplegar** — B-220, D-175. Su primer deploy necesita IAM que el dueño tiene que otorgar: ver `08-operacion.md` § «Permisos que necesita `optimizarImagen`» |

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

**Falta uno, y lo necesita `optimizarImagen`** (B-220, D-175): ningún rol de
Storage está en esa lista, así que hoy la Function no podría ni bajar la imagen
que la disparó. Hace falta `roles/storage.objectUser` **sobre el bucket** (no
sobre el proyecto; `objectAdmin` agregaría el IAM por objeto, que es un canal que
`storage.rules` no audita y que la Function no usa), más un binding de `roles/pubsub.publisher` para el service
agent de Cloud Storage —que es de Google y no nuestro, y es el requisito que
sorprende: los triggers de Storage v2 llegan por Eventarc y Eventarc los recibe
de una notificación de Pub/Sub—. Los comandos exactos están en
`08-operacion.md`; **los otorga el dueño**, porque `deploy-ci@` no tiene
`setIamPolicy` y darle eso sería casi ejecución arbitraria (D-119).

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
roles/firebaserules.admin                  desplegar firestore.rules y storage.rules
roles/datastore.indexAdmin                 desplegar firestore.indexes.json
roles/firebase.developAdmin                leer la config del proyecto (buckets, apps)
roles/secretmanager.viewer                 resolver los secrets que las Functions declaran
roles/cloudfunctions.developer             desplegar las Functions
roles/run.admin                            el servicio de Cloud Run que hay abajo de cada v2
roles/cloudbuild.builds.editor             el build que empaqueta el código de la Function
roles/artifactregistry.writer              guardar la imagen que ese build produce
roles/cloudscheduler.admin                 el job de onSchedule del rebuild (§8)
roles/iam.serviceAccountUser               actuar como las tres cuentas de runtime
```

Ese último es sobre **cuentas**, no sobre el proyecto: `calendar-sync@`,
`agenda-literaria@appspot` y `1038157194972-compute@developer`. Es lo que habilita
desplegar código que después corre con la identidad de esas cuentas.

**Esta lista era de tres roles hasta el 2026-08-28, y crecer así fue una decisión,
no un descuido.** Está en **D-132**, que revierte a D-119. El resumen: con tres
roles, dos de los seis jobs de `push-main.yml` no podían terminar bien nunca, y uno
de ellos bloqueaba la publicación del panel (era B-194). Se eligió pagar el radio de
la key a cambio de que el deploy sea una cosa sola y reproducible.

**Lo que la key puede hacer hoy si se filtra.** Conviene tenerlo escrito sin
suavizar, porque es lo que cambió:

| Puede | Cómo |
|---|---|
| Hacer legible todo Firestore | `firebaserules.admin` reescribe `firestore.rules` |
| Hacer legible todo Storage | el mismo rol cubre `storage.rules` |
| Desplegar código arbitrario | `cloudfunctions.developer` + `run.admin` + `iam.serviceAccountUser` |
| Correr ese código como `calendar-sync@` | `iam.serviceAccountUser` sobre esa cuenta |
| Reemplazar el sitio publicado | `firebasehosting.admin` |

No puede, todavía: **leer** el contenido de los secrets (`secretmanager.viewer` ve
los metadatos, no las versiones), **escribir** datos en Firestore directamente
(`datastore.viewer` es de lectura; para escribir tendría que reescribir las reglas
primero, que es la primera fila) ni tocar IAM.

**Nada en CI protege contra esto.** Los tests de reglas corren antes del deploy en
el workflow, pero quien tiene la key no pasa por el workflow. La única contención
real es que la key exista en un solo lugar —un secret de Actions del repo— y el
runbook de rotación de [`08-operacion.md`](08-operacion.md). Si se filtra, el orden
es: rotar la key, **redesplegar `firestore.rules` y `storage.rules` desde el repo**,
y recién después mirar qué se tocó.

Verificar la lista contra la realidad, que es de dónde salió esta tabla:

```bash
gcloud projects get-iam-policy agenda-literaria --flatten="bindings[].members" \
  --filter="bindings.members:deploy-ci@agenda-literaria.iam.gserviceaccount.com" \
  --format="value(bindings.role)"
```

**La lista de acá y la de [`07-seguridad.md`](07-seguridad.md) § "La key" tienen que
decir lo mismo**, y lo ata `tests/roles-deploy-ci.test.ts`. Ese test además exige
que, mientras haya un rol de escritura en la lista, el documento de seguridad **no**
afirme que el daño se limita a leer: es la afirmación que estuvo mintiendo una hora
el 2026-08-25, y el test existe para que no vuelva a poder.


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

**Un comando** (B-123):

```bash
./scripts/relevar-infra.sh
```

Consulta el proyecto y **compara contra lo que este documento afirma**, en lugar de
imprimir una lista para leer a ojo. Sale con 1 y nombra cada divergencia; con
`--crudo` imprime solo el estado. Compara tres cosas —el estado de las Functions, los
roles de `deploy-ci@` y la existencia de los secretos— porque son las tres que
mintieron el 2026-08-25. El resto se sigue mirando con los comandos de abajo:
automatizar la comparación de todo pedía parsear prosa, y un comparador que se
equivoca leyendo la doc es peor que ninguno.

La decisión vive en `scripts/comparar-infra.sh`, separada de la consulta, y tiene
nueve tests (`tests/comparar-infra.test.ts`): consultar `gcloud` necesita credenciales
que un agente no debe tener (§5.4), comparar dos listas de texto no. Es el mismo corte
que `que-deployar.sh`.

Para los secrets de GitHub hace falta la cuenta con permiso sobre el repo:

```bash
export GH_TOKEN=$(gh auth token --user benoffi7)
```

Sin eso, el script avisa y deja esa comparación **sin verificar** en lugar de
reportarla como faltante: "no pude ver" y "no existe" no son lo mismo, y la primera
vez que un chequeo grita en falso se lo empieza a ignorar.

### Los comandos, uno por uno

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
