# Operación

## Poner a andar el entorno local

```bash
npm install
cd functions && npm install && cd ..
```

Tres terminales:

```bash
npm run emu      # emuladores: Auth 9099, Firestore 8080, Storage 9199, UI 4000
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
| `npm test` | la suite completa (2.208 tests en 97 archivos al 2026-09-02, contados en esta corrida) |
| `npm run test:watch` | idem en watch |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run emu` | emuladores, con import/export de estado en `.emulador/` |
| `npm run seed` | siembra `/opciones/*` en el emulador |
| `npm run admin:claim -- --todos` | claim `admin` a los usuarios del emulador |
| `npm run admin:claim:prod -- <uid\|email>` | claim `admin` en producción |
| `npm run opciones:aprobar -- --listar` | opciones pendientes de aprobar, en el emulador |
| `npm run opciones:aprobar:prod -- --listar` | idem, en producción |
| `./scripts/verificar-todo.sh` | el gate de antes de pushear: marcadores, typecheck, tests con emuladores, build contra el emulador y fuga de credenciales |
| `./scripts/build-contra-emulador.mjs` | el paso 4 del gate, corrible solo: siembra, buildea y afirma sobre el `dist/events.json` **y sobre el HTML de las páginas de detalle** que salieron (B-110) |
| `./scripts/emuladores-arriba.sh` | ¿hay emuladores escuchando, y en qué hosts? Es la decisión de los pasos 3 y 4 del gate, afuera para poder testearla (B-180) |
| `node scripts/project-id-emulador.mjs` | la **base de emulador de este checkout** (`agenda-literaria-<8 hex>`). Es de dónde salen el `projectId` de los tests y el del gate (B-219) |
| `./scripts/probar-concurrencia.sh` | corre dos suites de integración a la vez. Sin banderas tiene que dar verde; con `--misma-base` tiene que dar **rojo** — es la reproducción del flaky de B-219 |

### Cada checkout tiene su propia base en el emulador (B-219)

El emulador es de la **máquina**, no del checkout: escucha en `127.0.0.1:8080` y
le pega cualquier worktree. Como todo test de integración empieza por
`limpiarFirestore()` —que borra la base entera— dos corridas en paralelo se
vaciaban el fixture entre sí a mitad de un `it`, y el rojo salía en un archivo
que no tenía nada que ver con el cambio.

Desde B-219 los tests corren contra `agenda-literaria-<8 hex>`, derivado de la
**ruta del working-tree** (`scripts/project-id-emulador.mjs`). El emulador de
Firestore es multi-proyecto, así que el borrado, la carga de reglas y los
documentos quedan acotados a esa base. Lo que hay que saber para operar:

- **El `npm run dev` y el `npm run seed` no cambiaron**: siguen usando
  `agenda-literaria` (el de `.env.development`), o sea que los datos que uno
  carga a mano en el panel local ya no los borra ninguna corrida de tests. Eso
  es un efecto lateral bienvenido.
- **`npm test` no requiere nada**: el valor lo calcula `vitest.config.ts`. Para
  apuntar una corrida a otra base —por ejemplo la de dev, para mirarla en la UI
  del emulador— se exporta `PUBLIC_FIREBASE_PROJECT_ID`.
- **Lo que NO separa son los puertos.** Sigue habiendo una sola tanda de
  emuladores por máquina, y de ahí sale el problema conocido de abajo: una tanda
  puede quedar **a medias** (Firestore huérfano vivo, Auth muerto).
- **Reproducir el bug a pedido**: `./scripts/probar-concurrencia.sh --misma-base`.
  Sirve para verificar el arreglo y para mutarlo — si con la bandera da verde,
  la corrida sin la bandera no prueba nada.

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
| 4 | `./scripts/build-contra-emulador.mjs` con el emulador (el que ya está arriba, o uno efímero) | el build tiene que **leer Firestore de verdad**: siembra **cuatro** actividades —publicada, borrador, y las dos canceladas de B-110: una que estuvo publicada y una que nunca lo estuvo—, buildea, y afirma sobre los **dos** artefactos. Sobre el `dist/events.json`: la publicada está, la borrador y las dos canceladas no, y ningún campo recortado se coló (B-217). Sobre el **HTML**: la cancelada-que-estuvo-publicada tiene su página, con la franja, el `EventCancelled`, sin CTA y sin ningún campo privado (con `urlPublica: true` en el fixture); la que nunca se publicó y el borrador **no tienen archivo** (B-110, y de paso B-241) |
| 5 | `./scripts/verificar-bundle.sh dist` | el gate del §5.4 / trampa 4; va después del build porque sin `dist/` no verifica nada |

**El paso 4 se arregló el 2026-08-27 (B-217).** Nació apuntando
`FIRESTORE_EMULATOR_HOST` al emulador y diciendo que con eso el build «ejercita
la lectura real». No la ejercitaba: con el paso 3 en su rama de `emulators:exec`
no quedaba nadie escuchando —el build moría a los 44 segundos con `14
UNAVAILABLE`, o sea que el gate corrido sin emulador previo **fallaba siempre y
por su propia plomería**—, y con el emulador vivo los tests de integración del
paso 3 lo habían dejado vacío, así que leía cero actividades y salía en verde. El
chequeo agregado *para* garantizar «esto leyó Firestore» pasaba idéntico sin leer
nada. Ahora la detección del hub se hace **una vez** y la comparten los pasos 3 y
4, y el paso 4 afirma sobre el archivo que produjo.

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

**Si una etiqueta es basura** —un typo con `usos: 1`— se borra desde la pantalla
de administración de taxonomías del panel (B-06/B-25, botón «Borrar»), no desde
este script. Las `fijo: true` no se pueden borrar ni renombrar, por diseño (§4.3).
La alternativa sin borrar sigue valiendo: no aprobarla la deja invisible para las
demás cuentas.

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

## El dominio (B-109, D-165)

**El canónico es `https://agendaleh.ar`.** Lo decidió el dueño y es la única
aparición del dominio en el repo: `SITIO`, en `src/lib/rutasPublicas.ts`. De ahí
salen `site` de `astro.config.mjs`, el `canonical` y el Open Graph de cada
página, las URLs del JSON-LD y el `sitemap.xml`. **No copiarlo a ningún otro
lado** — `tests/canonico.test.ts` falla si aparece escrito en cualquier archivo
de `src/`, y el gate del emulador falla si el robots, el sitemap y la canónica no
coinciden en un solo origen.

### Los tres nombres que responden hoy

Verificado el 2026-09-02:

| Hostname | Qué hace | Qué debería hacer |
|---|---|---|
| `https://agendaleh.ar` | 200, sirve el sitio | **es el canónico** — nada que cambiar |
| `https://agendaleh.com.ar` | 200, **el mismo contenido** | un **301** al canónico ← falta, ver abajo |
| `https://agenda-literaria.web.app` | 200, **el mismo contenido** | queda así: Firebase **no lo apaga**, y el `canonical` absoluto que sirve es lo que le dice a Google que la buena es la otra |
| `www.` de los dos | no configurado | decidir: o se agrega y redirige, o se deja sin configurar |

Tres nombres sirviendo lo mismo es contenido duplicado, y por eso el `canonical`
es **absoluto**: uno relativo se resuelve contra el host que lo sirvió, así que en
el espejo diría que la página buena es la del espejo. Con el canonical absoluto,
el espejo puede seguir respondiendo para siempre sin costo de posicionamiento.

### Lo que falta, y lo hace el dueño en la consola

**No se puede hacer desde el repo**: los dominios de Hosting se configuran en la
consola de Firebase, no en `firebase.json`.

1. **El 301 de `agendaleh.com.ar` al canónico.**
   Consola → **Hosting** → la fila de `agendaleh.com.ar` → **⋮** → *Ver
   configuración* (o *Editar*). Ahí la consola ofrece la casilla
   **«Redireccionar este dominio a otro»** / *Redirect this domain to another
   domain*: hay que tildarla y elegir `agendaleh.ar`, con el tipo de redirección
   **permanente (301)**.
   Si esa fila no ofrece la casilla —pasa cuando el dominio se agregó como sitio
   y no como redirección—, la salida es borrar la entrada de `agendaleh.com.ar` y
   volver a agregarla con **Agregar dominio personalizado → «Redireccionar a un
   dominio existente»**. La verificación del dominio no se pierde: el TXT sigue
   en la zona.
   **Verificar después:** `curl -sI https://agendaleh.com.ar/ | head -3` tiene
   que decir `301` y `location: https://agendaleh.ar/`.

2. **El `www`.** Hoy `www.agendaleh.ar` y `www.agendaleh.com.ar` **no están
   configurados**, o sea que no responden. Son dos caminos y los dos válidos:
   - **dejarlo así** —nadie tipea `www` desde un teléfono, y un hostname que no
     existe no puede duplicar contenido—, o
   - **agregarlo redirigiendo**: Hosting → *Agregar dominio personalizado* →
     `www.agendaleh.ar` → «Redireccionar a un dominio existente» → `agendaleh.ar`.
     Es un CNAME más en la zona y el mismo 301 del punto 1.

   Lo que **no** hay que hacer es agregarlo como sitio: sería un cuarto nombre
   sirviendo el mismo contenido.

3. **Search Console.** Con el sitemap publicado, el paso que lo activa es
   registrar la propiedad de `agendaleh.ar` y mandarle
   `https://agendaleh.ar/sitemap.xml`. Hasta que eso pase, el sitemap existe y
   nadie lo lee: Google lo encuentra solo por la línea `Sitemap:` del
   `robots.txt`, que es más lento.

### Las dos trampas del dominio, que fallan tarde

Las dos son de **falla diferida**: el día que se hacen mal no se rompe nada, y el
sitio se cae semanas después.

- **El TXT de verificación es permanente, no un paso.** Firebase pide un registro
  `TXT` en la zona para verificar la propiedad, y **lo relee para renovar el
  certificado**. Si alguien lo borra «porque ya verificó», ese día no pasa nada:
  el certificado vigente sigue sirviendo. **~90 días después** deja de renovarse y
  el sitio empieza a dar error de certificado, que para un visitante es
  indistinguible de un sitio caído. El TXT se queda donde está para siempre.

- **La renovación de NIC.ar no es automática.** Un `.ar` no se renueva solo ni
  con tarjeta guardada: hay que pagarlo a mano en nic.ar. Hay **45 días de
  gracia** después del vencimiento para recuperarlo sin perder el nombre, pero
  **desde el día 31 la delegación se apaga**: los DNS dejan de responder y el
  sitio se cae aunque el dominio siga siendo del dueño. O sea que el margen real
  es de 30 días, no de 45. Conviene un recordatorio en el calendario **un mes
  antes** del vencimiento, no el día.

### Verificar el dominio a mano

```bash
# el canónico responde y sirve el sitio
curl -sI https://agendaleh.ar/ | head -3

# el espejo de Firebase sigue respondiendo, y su HTML apunta al canónico
curl -s https://agenda-literaria.web.app/ | grep -o '<link rel="canonical"[^>]*>'

# el sitemap y el robots
curl -s https://agendaleh.ar/robots.txt
curl -s https://agendaleh.ar/sitemap.xml | grep -c '<loc>'

# y la forma que contesta 200: Firebase agrega la barra final con un 301
curl -sI https://agendaleh.ar/cartelera | head -2   # 301 → /cartelera/
curl -sI https://agendaleh.ar/cartelera/ | head -2  # 200
```

Ese último par es el motivo de que la canónica y el sitemap lleven **barra
final** (`rutaCanonica`): una canónica que apunta a una redirección es un aviso
en Search Console, y una entrada de sitemap que redirige es una URL menos
rastreada.

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
   curl -s https://agendaleh.ar/version.json
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
curl -sL -o /dev/null -w "%{http_code}\n" https://agendaleh.ar/admin
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
curl -s https://agendaleh.ar/version.json
curl -sI https://agendaleh.ar/version.json | grep -i cache-control
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
  curl -sI "https://agendaleh.ar$RUTA" | grep -i "^cache-control" || echo "(sin cabecera)"
done
# y un asset con hash, que tiene que decir immutable
curl -sI "https://agendaleh.ar/_astro/$(ls dist/_astro | grep '\.js$' | head -1)" \
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

### Reglas de Storage (B-167, segunda tajada)

```bash
firebase deploy --only storage
```

**Es su propio target y no entra en `--only firestore:rules`.** `que-deployar.sh`
lo decide aparte (línea `storage=`) y el job «Reglas e índices» de
`push-main.yml` arma el `--only` con lo que haya cambiado. **Desde el 2026-08-28
ese job termina bien** y despliega las reglas de Storage junto con las de
Firestore: `deploy-ci@` tiene `firebaserules.admin` (D-132). Correrlo a mano
sigue sirviendo para publicar una regla sin esperar un push.

**Antes de desplegar, revisar que el bucket exista.** Si el proyecto nunca usó
Storage, hay que inicializarlo una vez desde la consola de Firebase (elige la
región; conviene `southamerica-east1`, al lado de Firestore y de las Functions).
`firebase deploy --only storage` contra un proyecto sin bucket falla con un error
que no dice eso.

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

**El deploy de Functions fue a mano por necesidad hasta el 2026-08-28.**
`deploy-ci@` no tenía los roles para desplegarlas (D-119) y darlos era casi
ejecución arbitraria; **D-132** los otorgó, y hoy el job «Cloud Functions» de
`push-main.yml` las despliega solo cuando cambia `functions/`. Lo mismo vale para
las reglas. El comando de arriba sigue sirviendo para desplegar sin esperar un push
y para el **primer** deploy de una función nueva, que además necesita los roles de
`calendar-sync@` del principio de esta sección — ésos la CI no los toca.

### `optimizarImagen` — la Function de imágenes (B-220, D-175)

Es el **primer trigger de Storage** del proyecto y el primero con una dependencia
binaria (`sharp`), así que su primer deploy no es como los otros.

```bash
firebase deploy --only functions:optimizarImagen
```

#### Permisos que necesita `optimizarImagen`, y los otorga el dueño

**No se pueden otorgar desde el repo ni desde la CI** (`deploy-ci@` no tiene
`resourcemanager.projects.setIamPolicy`, y darle eso sería casi ejecución
arbitraria — el mismo argumento de D-119). Son tres cosas, y **hasta que estén,
el trigger falla o no se crea**:

**1 · `calendar-sync@` tiene que poder leer y escribir el bucket.**

La Function corre como `calendar-sync@` (D-06, se reusa a propósito: una service
account nueva necesitaría otra vez los tres roles que la default de Compute trae
de fábrica, y eso ya hizo fallar dos deploys). Sus roles actuales
—`datastore.user`, `logging.logWriter`, `eventarc.eventReceiver`, `run.invoker`,
`artifactregistry.reader`— **no incluyen ninguno de Storage**, así que hoy no
puede ni bajar la imagen que la disparó.

```bash
# Sobre el bucket y no sobre el proyecto: es el único que necesita tocar.
gcloud storage buckets add-iam-policy-binding gs://agenda-literaria.firebasestorage.app \
  --member=serviceAccount:calendar-sync@agenda-literaria.iam.gserviceaccount.com \
  --role=roles/storage.objectUser
```

**`objectUser` y no `objectAdmin`, y la diferencia importa** — lo corrigió el
`auditor-privacidad`, y la primera versión de esta sección tenía el motivo al
revés. `objectUser` ya incluye `storage.objects.create`, `.delete`, `.get`,
`.list` y **`.update`**, o sea que alcanza para el `save()` encima del original y
para el `setMetadata()`. Lo único que `objectAdmin` agrega es
`getIamPolicy`/`setIamPolicy` sobre los objetos: el canal de permisos **por
objeto**, que **no pasa por `storage.rules`** y que por lo tanto no lo audita nada
de este repo. Es la facultad de hacer público o privado un objeto por afuera de
todo lo que miramos, y la Function no la usa nunca.

Ninguno de los dos incluye `storage.buckets.*`: no puede borrar el bucket ni
cambiar sus reglas.

**Y una consecuencia de IAM que conviene tener al lado de la trampa 13:**
cualquier rol de lectura de objetos concede `storage.objects.list`, así que
`calendar-sync@` va a poder enumerar el bucket por la **API de GCS**. Eso no abre
el agujero de la trampa 13 —que es sobre el canal de reglas, el que ve un anónimo
con el SDK web— pero sí significa que `allow list: if esAdmin()` protege **un
canal y no el bucket**, y que ahora hay un principal más del otro lado.

**2 · El service agent de Cloud Storage tiene que poder publicar en Pub/Sub.**

Es el requisito que sorprende, porque no es de *nuestra* service account: los
triggers de Storage v2 llegan por Eventarc, y Eventarc los recibe de una
notificación de Pub/Sub que publica el **service agent de GCS**. Sin este
binding, el deploy falla con un error que no dice esto.

```bash
SA=$(gcloud storage service-agent --project=agenda-literaria)
gcloud projects add-iam-policy-binding agenda-literaria \
  --member="serviceAccount:${SA}" --role=roles/pubsub.publisher \
  --condition=None
```

Es **una sola vez por proyecto**, no por Function.

**El `--condition=None` no es decorativo y sin él el comando se queda esperando.**
La política de *este* proyecto ya tiene algún binding con condición, así que
`gcloud` se niega a adivinar y abre un prompt interactivo pidiendo cuál aplicar
—lo pisó el dueño el 2026-09-03 al otorgarlo—. Y la respuesta correcta es
siempre «ninguna»: el service agent publica la notificación **cada vez** que se
sube una imagen, así que una condición de tiempo o de recurso dejaría el trigger
fallando en silencio justo cuando no aplique, y el síntoma sería «el trigger no
se dispara». El comando del punto 1 no pregunta porque va sobre el bucket, cuya
política no tiene condiciones.

**3 · Las APIs de Eventarc y Pub/Sub, si no estaban.**

```bash
gcloud services enable eventarc.googleapis.com pubsub.googleapis.com \
  --project agenda-literaria
```

`eventarc` ya está habilitada por los triggers de Firestore; `pubsub` conviene
confirmarla.

#### Después del deploy: el barrido de las que ya estaban

`onObjectFinalized` corre cuando un objeto **se escribe**, así que las 30
imágenes que ya están en el bucket no pasaron por el pipeline: no tienen
miniatura y siguen pesando lo que pesaban. Es lo que arregla el barrido, y es
**el paso que cierra B-300 en producción**.

```bash
# 1 · Ver qué haría (no escribe nada). El default es este.
node scripts/optimizar-imagenes.mjs

# 2 · Aplicarlo.
node scripts/optimizar-imagenes.mjs --aplicar

# 3 · Un minuto después, volver a correr el paso 1: si algún objeto sigue
#     apareciendo en la lista, la Function no está desplegada, no tiene los
#     permisos de arriba, o falló. Los logs lo dicen.
node scripts/optimizar-imagenes.mjs
```

El script **no reimplementa el pipeline**: reescribe los mismos bytes y deja que
la Function haga el trabajo. Una segunda copia de `sharp` produciría objetos
distintos el día que una de las dos cambie —media galería optimizada de una
manera y media de otra—, y este camino además **verifica el deploy de verdad**.
Es idempotente: lo que ya tiene `customMetadata.optimizada` se saltea.

Ensayarlo contra el emulador antes (`FIREBASE_STORAGE_EMULATOR_HOST` seteado
apunta ahí; sin eso apunta a producción, y lo anuncia antes de escribir).

#### Verificar que anduvo

```bash
# Los logs de una imagen optimizada dicen antes, después y qué formato salió.
gcloud functions logs read optimizarImagen --region southamerica-east1 --limit 20

# Y el resultado se mira sin credenciales, porque la imagen es pública:
#   Content-Length tiene que haber bajado, y Cache-Control decir immutable.
curl -sI 'https://firebasestorage.googleapis.com/v0/b/agenda-literaria.firebasestorage.app/o/imagenes%2F<id>.png?alt=media' \
  | grep -iE 'content-type|content-length|cache-control'
```

En los logs, `"motivo":"ya-optimizada"` y `"motivo":"fuera-del-prefijo"` en
`DEBUG` **son lo esperado**: son las dos guardas anti-recursión cortando. Aparecen
dos o tres veces por imagen subida. Lo que **no** es esperado es que crezcan sin
parar — eso sería el lazo, y no hay tope de plataforma que lo pare (D-175).

#### Probar el trigger con los emuladores

El `npm run emu` de siempre arranca `--only auth,firestore,storage`: **sin el
emulador de Functions no hay trigger que probar.** Y hacen falta dos cosas más:

```bash
# 1 · `functions/` necesita su propio node_modules: `sharp` no se hereda del
#     root, igual que en el deploy. Es una compilación nativa, tarda.
cd functions && npm install && cd ..

# 2 · El emulador de Functions tiene que estar en el `--only`.
JAVA_HOME="/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home" \
  npx firebase emulators:start --only auth,firestore,storage,functions
```

**El emulador de Functions cachea el módulo cargado**: al cambiar
`functions/imagenes.js` hay que **reiniciarlo**, o se sigue ejecutando el código
viejo. Es cómo se pierde media hora creyendo que una mutación no hace nada.

Si hay otra suite de emuladores corriendo (otro worktree), los puertos chocan:
copiar `firebase.json` con puertos alternativos y pasarlo con `-c`.

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

# Quién tiene el claim admin hoy (B-209 — la lista salió de la doc versionada,
# porque el repo es público). Es solo consulta: no siembra ni escribe nada.
node scripts/preparar-produccion.mjs --listar

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

El runner de GitHub no tiene ADC, así que necesita una key. Es la **única** key del
proyecto, y por eso la cuenta es aparte de `calendar-sync@`. Los roles son los de
**D-132**; el motivo de cada uno y lo que la key puede hacer si se filtra están en
[`02-infraestructura.md`](02-infraestructura.md) § "Roles de `deploy-ci@`" —
**leerlo antes de correr esto**, porque no es una cuenta de solo lectura.

```bash
SA=deploy-ci@agenda-literaria.iam.gserviceaccount.com

gcloud iam service-accounts create deploy-ci \
  --display-name="Deploy del sitio desde GitHub Actions" --project agenda-literaria

# A nivel proyecto.
for R in datastore.viewer firebasehosting.admin serviceusage.serviceUsageConsumer \
         firebaserules.admin datastore.indexAdmin firebase.developAdmin \
         secretmanager.viewer cloudfunctions.developer run.admin \
         cloudbuild.builds.editor artifactregistry.writer cloudscheduler.admin; do
  gcloud projects add-iam-policy-binding agenda-literaria \
    --member="serviceAccount:$SA" --role="roles/$R" --condition=None
done

# Y `actAs` sobre las tres identidades con las que corre el código desplegado.
for RUNTIME in calendar-sync@agenda-literaria.iam.gserviceaccount.com \
               agenda-literaria@appspot.gserviceaccount.com \
               1038157194972-compute@developer.gserviceaccount.com; do
  gcloud iam service-accounts add-iam-policy-binding "$RUNTIME" \
    --member="serviceAccount:$SA" --role="roles/iam.serviceAccountUser" \
    --project agenda-literaria
done

# La key: se baja, se pega en GitHub y se borra del disco enseguida.
gcloud iam service-accounts keys create /tmp/deploy-ci.json \
  --iam-account="$SA" --project agenda-literaria
```

**Esta lista se armó de a un 403 por vez**, no de entrada, y esa sigue siendo la
forma de agregarle uno nuevo: correr el job, leer qué permiso pide, otorgar ése.
Cada rol de más es alcance que tiene la única key del proyecto.

### 4 · La key como secret de GitHub

En **Settings → Secrets and variables → Actions → New repository secret** del
repo, con nombre exacto `FIREBASE_SERVICE_ACCOUNT` y el **contenido completo**
del JSON como valor. Con `gh` instalado:

```bash
# Si `gh` tiene más de una cuenta logueada, la activa puede no ser la dueña del
# repo: sin esta línea el comando corta con
# «HTTP 403: You must have repository read permissions».
# (`gh auth status` dice cuáles hay.)
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

Desde el 2026-08-28 (**D-132**) los seis jobs pueden terminar bien, así que **una
corrida verde es la señal de que el secret está bien** y una roja hay que mirarla.
No fue siempre así: hasta esa fecha `deploy-ci@` tenía tres roles y los jobs de
reglas y de Functions cortaban con `Permission denied` en toda corrida, con el
secret perfectamente bien puesto. Las dos tablas de abajo son de esa época y se
dejan porque son el registro de cómo se llegó acá.

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
arrastra a Hosting por el `if`. Ojo con esto último: con el checkbox tildado
*Deployar todo* siempre cae en "deployar todo" sin mirar nada más. **Sin el
checkbox**, desde **B-205** un `workflow_dispatch` ya no cae automáticamente en
"deployar todo" solo por no tener `github.event.before`: primero intenta
diffear contra lo que `/version.json` dice publicado, y recién si esa fuente
tampoco sirve (sitio caído, nunca deployado) cae al "deployar todo" de antes.
Así que el botón *Run workflow* sin el checkbox **sí** puede servir para
probar solo Hosting, si el sitio ya tiene algo publicado y las reglas no
cambiaron desde entonces.

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
fuera de una lectura anónima los borradores, `difusion` y los uids.

#### Y el 2026-08-28 se otorgaron todos — D-132

Tres días después la contra asumida se cobró lo suyo: la `1.5.0` se publicó, el job
de reglas cortó con 403, el `if` de Hosting salteó el deploy, y **la web siguió
mostrando `1.4.0` sin que nada lo dijera** — la corrida estaba roja "como siempre".
El razonamiento completo del cambio está en **D-132**; el estado de hoy:

| Cambia | Qué pasa |
|---|---|
| solo `src/` | ✅ publica el sitio y el panel |
| solo docs | ✅ verde sin deployar nada |
| `firestore.rules`, `storage.rules` o `firestore.indexes.json` | ✅ el job los despliega |
| algo de `functions/` | ✅ el job las despliega |
| reglas + `src/` en el mismo push | ✅ los dos, y en ese orden |
| sube `version` en `package.json` | ✅ el job del tag lo crea |

**Una corrida roja volvió a significar que algo anda mal**, que es la mitad del
valor del cambio y lo que se había perdido.

Lo que esto le costó a la key está escrito sin suavizar en
[`07-seguridad.md`](07-seguridad.md) § "La key" y en la tabla de radio de daño de
[`02-infraestructura.md`](02-infraestructura.md). En una línea: puede reescribir las
reglas y desplegar código que corre como `calendar-sync@`. **La regla al otorgar
sigue siendo agregar de a uno leyendo el error**, no la lista completa de entrada —
así se armó esta lista, un 403 por vez— y **cada rol nuevo obliga a releer esos dos
documentos en el mismo cambio**: `tests/roles-deploy-ci.test.ts` falla si no.

#### Si la key se filtra

El orden importa y **redesplegar las reglas va segundo, no último** (D-132). Hasta
que eso se haga, no se sabe qué reglas están publicadas: `firebaserules.admin`
alcanza para dejar `/actividades` legible por un anónimo, y desde afuera eso no se
distingue de un sitio sano.

```bash
SA=deploy-ci@agenda-literaria.iam.gserviceaccount.com

# 1 · Cortar la key vieja. Listar primero: la que se borra es la comprometida.
gcloud iam service-accounts keys list --iam-account="$SA" --project agenda-literaria
gcloud iam service-accounts keys delete KEY_ID --iam-account="$SA" --project agenda-literaria

# 2 · Volver a poner las reglas del repo, que son las buenas.
firebase deploy --only firestore:rules,storage --project agenda-literaria

# 3 · Key nueva al secret (pasos 3 y 4 de arriba).

# 4 · Recién ahora, mirar qué se tocó.
gcloud logging read \
  'protoPayload.authenticationInfo.principalEmail="'"$SA"'"' \
  --project agenda-literaria --freshness=7d --limit 100
```

Después de eso, verificar que la lectura anónima siga cerrada con el comando de
[`07-seguridad.md`](07-seguridad.md) § "Cómo verificar": es la comprobación que
demuestra que el paso 2 hizo efecto, y sale de B-208.

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

Desde B-125 hay dos más, los dos del mismo caso —un evento que ya no está en
Calendar (D-191)—:

- `el evento no estaba en Calendar: se recreó` (**warn**). Alguien lo borró a
  mano y el encuentro sigue publicado, así que el sync lo repuso. No es un error
  y no hay nada que hacer, pero **sí es la señal de que alguien está editando el
  calendario a mano**, que el §2.1 no soporta: si aparece seguido, conviene
  averiguar quién y por qué.
- `falló recrear un evento borrado a mano` (**error**). La reposición no salió.
  Ahí sí hay que mirar: lo más probable es el acceso al calendario (D-06).

`el evento ya no existía en Calendar` sigue siendo un warn normal: es un borrado
que llegó a un evento que ya no estaba.

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
5. **B-125** · borrar a mano, desde Google Calendar, el evento de **un** encuentro
   de un ciclo publicado, y después editar cualquier cosa de esa actividad en el
   panel. El evento tiene que **volver**, con el `calendarEventId` nuevo en el
   documento, y los logs tienen que decir `el evento no estaba en Calendar: se
   recreó` para esa sesión y nada raro para las otras siete. La pasada siguiente
   —la del write-back— no tiene que generar ninguna operación.

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
| Al subir una imagen desde el panel: «No se pudo subir la imagen» | `storage.rules` no está desplegado (o el bucket no existe todavía) | ver arriba, «Reglas de Storage» |
| `EXIGIR_EMULADOR=1 pero el emulador de Storage no responde` | los emuladores se arrancaron sin `storage` en el `--only` | `npm run emu` los levanta todos; si se usa `emulators:exec`, el `--only` tiene que decir `auth,firestore,storage` |
| Una imagen propia subida contra el emulador no deja publicar la actividad | no debería pasar: el schema acepta `http://127.0.0.1` justamente para eso (D-131) | si pasa, mirar `ESQUEMA_PERMITIDO` en `src/lib/schema.ts` |
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
| `tests/reportes.integracion.test.ts` falla entero contra el emulador | ~~el emulador se arrancó en otro checkout y sirve otras reglas~~ — **ya no puede ser eso** (B-174): los cuatro archivos de integración empujan el `firestore.rules` de su propio checkout con `cargarReglas()` | mirar la fila de abajo: lo más probable es una tanda de emuladores a medias |
| Varios `beforeAll` de integración en rojo con `connect ECONNREFUSED 127.0.0.1:9099` | **una tanda de emuladores a medias** (B-365): el proceso padre murió y dejó a su hijo de Firestore huérfano escuchando en el 8080, mientras Auth y el hub se fueron con él. Pasa cuando otro worktree levanta su propia tanda | `ps aux \| grep emulator` para ver los huérfanos, matarlos, y `npm run emu` de nuevo. Desde B-365 el mensaje lo dice: `EXIGIR_EMULADOR=1 pero el emulador de Auth no responde` |
| Un test de integración falla una de cada N corridas, con «el fixture dejó de tener…» o «No existe(n) en `opciones/arancel`» | otra corrida contra la **misma base** del emulador. No debería pasar desde B-219; si pasa, es que algo está usando `agenda-literaria` en vez de la base del checkout | `node scripts/project-id-emulador.mjs` para ver cuál es la propia, y `./scripts/probar-concurrencia.sh` para confirmar que el aislamiento está en pie |

| `sistema/rebuild.ultimoError` dice `HTTP 401 Bad credentials` | el PAT venció o se revocó | rotar el secreto (`gcloud secrets versions add GITHUB_TOKEN`); el contador se rearma con el próximo cambio |
| `ultimoError` dice `HTTP 404` | el PAT no ve el repo, o `GITHUB_REPO` está mal | revisar el repository access del token y `functions/.env` |
| `ultimoError` dice `HTTP 422` | el `event_type` no coincide con el `types:` del workflow, o el workflow no está en la branch por defecto | tienen que ser los dos `rebuild`, y `deploy.yml` tiene que estar mergeado a `main` |
| El log dice `rebuild pendiente pero sin GitHub configurado` | falta el secreto `GITHUB_TOKEN` o `GITHUB_REPO` | los pasos 1-2 de "Activar el rebuild automático" |
| El deploy del workflow falla con `Permission denied` sobre Hosting | a `deploy-ci@` le falta `roles/firebasehosting.admin` | otorgarlo (paso 3) |
| El build del workflow no encuentra actividades | falta el secret `FIREBASE_SERVICE_ACCOUNT`, o `deploy-ci@` no tiene `datastore.viewer` | pasos 3-4 |
| El schedule corre pero nunca dispara nada | `agotado: true` en `sistema/rebuild` | ver "El sitio no se actualiza…" |
| Un push a `main` no publicó nada y la corrida figura `startup_failure` en 0s sin jobs | casi siempre es GitHub, no el repo. **Chequear primero** `curl -s https://www.githubstatus.com/api/v2/summary.json`: el 2026-08-26 fue un `major_outage` de Actions. Dos workflows distintos fallando al arrancar sin cambios en `.github/` es afuera. Recién después mirar el YAML, `gh workflow list` y `gh api …/actions/permissions` | **no se puede reintentar** esa corrida, pero desde **B-205** el push siguiente **sí se repara solo**: `decidir` ya no diffea contra el commit ya subido, sino contra lo que `/version.json` dice publicado (`scripts/commit-base-deploy.sh`), así que los cambios que no llegaron a publicarse vuelven a entrar en el diff. Si igual urge no esperar al próximo push, republicar con `gh workflow run deploy.yml --ref main` (Hosting solo) y confirmar con `curl -s https://agendaleh.ar/version.json`, no con el color de la corrida |
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
