# Seguridad

Premisa del §5: **todo lo que sale al `events.json` o al calendario es público y
scrapeable.** El calendario es tan público como el JSON, así que las dos salidas
comparten las mismas reglas.

## Qué NUNCA sale

| Campo | Motivo | Dónde se filtra |
|---|---|---|
| `online.url` **con `urlPublica: false`** | el link de la reunión se manda al inscribirse; publicarlo habilita zoombombing (trampa 5). Es el default. | `toPublic.ts`, `calendario.js` |
| `difusion` | trabajo interno | ambos |
| `material.items[].url` con `publico: false` | solo tipo y título | ambos |
| `createdBy` / `updatedBy` | uids | ambos |
| `sesion.calendarEventId` | interno | `toPublic.ts` |
| `imagenes[].storagePath` | no lo emitimos: es el handle autoritativo y no hace falta en el sitio (B-167). **Ojo, no es un secreto:** para una imagen propia el path viaja URL-encodeado adentro de la URL de descarga, junto con un token permanente, así que es público por ese lado (B-206). Por eso la Function le pone un **nombre opaco** al archivo | `toPublic.ts` |

`libro` **sí** sale, título y autor, a las dos salidas públicas: es el dato central
de una presentación, del mismo orden que el título de la actividad, y entra también
al `searchText` para que buscar la obra encuentre la actividad (DEC-1, **D-126**). A
GA4 va solo `tiene_libro`, un booleano: el título es texto libre.

`inscripcion.completo` **sí** sale a las dos salidas públicas y **no** entra al
`searchText`. Y el canal de inscripción **sigue saliendo con el cupo completo**, por
decisión del dueño: siempre hay lista de espera, y esconderlo convierte una baja en un
lugar que se pierde (B-97, **D-127**).

`inscripcion.destino` **sí** sale: es el canal de inscripción. El §5.1 advierte
que un WhatsApp personal ahí queda expuesto a bots — conviene un número de
trabajo o un `wa.me` con mensaje precargado. El formulario lo dice en la ayuda
del campo.

## La vista previa del panel no es una tercera salida

La vista previa del evento (B-12) muestra el evento armado por
`construirEvento`, **la misma función que lo publica** (D-20). No puede mostrar
de más (haría creer que se publica algo que no se publica) ni de menos (genera
desconfianza): es el mismo texto.

`tests/vistaPreviaEvento.test.ts` lo fija para los tres casos sensibles: el link
privado de la reunión, la difusión interna y la URL del material privado.

Y de paso la vista previa **avisa** cuando el link de la reunión va a salir: es
el último lugar donde se puede notar antes de publicar.

## El borrador autoguardado tampoco es una salida (B-191, D-122)

El formulario se persiste solo en el navegador de quien está cargando. **Es la
única cosa que el panel guarda fuera de Firestore que es contenido**: todo lo
demás que vive en el navegador son marcas (qué novedad se leyó, qué acordeón se
abrió, qué versión se vio).

Por qué no es una salida nueva:

1. **No sale del dispositivo.** No hay red en el camino: se escribe y se lee del
   mismo navegador, con clave **por admin y por formulario** — la huella del uid
   (`lib/huella.ts`, nunca el uid en claro) más el id de la actividad, o `nueva` /
   `copia` cuando todavía no hay documento.
2. **No pasa por la analítica.** El vocabulario de eventos solo acepta enums y
   contadores (§9 de este documento y `docs/09-analitica.md`), y un descuido acá
   sería la primera vía de fuga de texto libre del panel. `tests/autoguardado.test.ts`
   lee el código de `lib/formulario/autoguardado.ts` y de `useAutoguardado.ts`
   —con los comentarios afuera— y falla si aparece un `import` de `analytics`, un
   `medir(` o cualquier cosa de Firestore.
3. **No cambia lo que es público.** Lo guardado es una copia de lo que ya está en
   la pantalla de un panel que pide sesión con permiso de admin; y el borrador
   que se llegue a guardar en Firestore queda con `estado` no publicado, que las
   reglas del §5.3 ya mantienen fuera de una lectura anónima.
4. **Recuperar no puede publicar lo que estaba privado.** El borrador vive hasta
   30 días, así que un valor de hace tres semanas se aplica sobre el documento de
   hoy. El caso concreto: se destilda «mostrar el link sin inscribirse», no se
   guarda, se recupera a los veinte días y se publica — y el link de la reunión
   sale a `events.json` y a la descripción del evento (trampa 5). **Seis campos no
   se aplican tal cual:** los `calendarEventId`, que los escribe el backend
   (familia de B-80); los dos flags de publicación, que vuelven a `false`; y
   `estado`, el `slug` bloqueado y `sesiones[].cancelada`, que salen del documento
   de hoy —un borrador que decía `publicado` re-publicaba una actividad retirada a
   propósito—. La lista y el porqué de cada uno están en **D-124**, en un solo
   lugar: se quedó corta dos veces por estar repartida. El aviso de recuperación
   avisa cuando hay flags en juego, porque la casilla puede estar en una sección
   cerrada donde nadie la ve.

Lo que sí hay que tener presente: **es contenido en un dispositivo compartido**.
Mientras la sesión está abierta, el borrador queda ahí hasta que se descarta, se
guarda o pasan 30 días.

**Las dos salidas borran de verdad**, y las dos hubo que arreglarlas el 2026-08-26:

- **«Descartar»**, el botón del aviso de recuperación, borra la clave. Hasta ese día
  solo escondía el aviso, así que el borrador seguía en el navegador y volvía a
  ofrecerse al reabrir la actividad: el botón que esta sección presenta como la
  salida a mano no descartaba nada.
- **El fin de la sesión** borra todos: `alCambiarDeSesion` en el observador de auth,
  más `borrarTodosLosBorradores` antes del `signOut` en los dos botones «Salir». Sin
  eso el contenido sobrevivía al logout, en claro y bajo una clave predecible.

Con precisión, porque la diferencia importa: lo segundo lo garantiza **la sesión**, y
no los dos botones. Hasta B-203 lo garantizaban los botones —los dos únicos caminos
que llaman a `logout()`— y una sesión que terminaba sin un click (token revocado,
cuenta deshabilitada, logout en otra pestaña) volvía al login dejando los borradores
donde estaban.

**La condición es la transición y no el valor**, y eso no es un detalle de
implementación: el primer aviso de `onAuthStateChanged` es `null` mientras se
restaura la sesión guardada, así que borrar en cualquier `null` se llevaría lo que
alguien está escribiendo al abrir el panel — peor que la exposición residual, y
justo lo que el autoguardado vino a evitar. Se compara el uid anterior con el
actual: `null → uid` no borra, `uid → mismo uid` (refresco de token) tampoco,
`uid → null` y `uid → otro uid` sí. Ese último es el que se escapa con el predicado
ingenuo: `onAuthStateChanged` no garantiza pasar por `null` al cambiar de cuenta.

**Dos cosas que quedan afuera, asumidas y dichas:**

- Si la sesión se corta con la pestaña cerrada no hay observador corriendo, y el
  aviso siguiente es el de apertura, sin uid anterior — indistinguible del arranque
  normal, así que no borra. Esos borradores viven hasta que alguien los descarta,
  los guarda, entra con otra cuenta en ese navegador, o pasan 30 días.
- El borrado es por prefijo, o sea **de los borradores de este navegador** y no «de
  los míos»: el fin de sesión de una cuenta se lleva también los de la otra. Es el
  lado prudente del error —borra de más, no de menos— y para este panel es lo
  deseable, pero no es lo que el nombre sugiere.

## El link de la reunión: default privado, publicable a pedido

`online.urlPublica` **se respeta** desde el 2026-08-21 (D-15), en el
`events.json` y en la descripción del evento de Calendar.

Es un desvío consciente del §5.2 y del §7.4, que descartan la URL sin
condición. Lo decidió el dueño: el modelo del §3.1 tiene el flag y el
formulario su casilla, así que ignorarlo era prometer algo que no pasaba.

Tres cosas se mantienen porque son las que hacen que el desvío sea aceptable:

1. **El default es `false`.** Publicar el link es una acción deliberada por
   actividad.
2. **El formulario advierte** que un link de reunión público habilita
   zoombombing, en el propio checkbox.
3. **Sin URL cargada no se inventa el campo**, aunque el flag esté en true.

Si la actividad es un encuentro abierto sin inscripción, publicar el link tiene
sentido. Si tiene cupo, no: el link circula y el cupo deja de existir.

## Los reportes del panel salen a un repo público

El panel puede cargar bugs y sugerencias, y una Cloud Function los publica como
issue en `benoffi7/agenda-literaria`. Ese repo es **público** — verificado, no
asumido:

```bash
gh repo view benoffi7/agenda-literaria --json visibility   # → PUBLIC
```

Así que el issue es una tercera salida pública, junto con el `events.json` y el
calendario, y le aplican las mismas reglas.

| Qué | Sale al issue | Dónde queda |
|---|---|---|
| Título, descripción y pasos | sí, **filtrados** | completos en Firestore |
| Contexto técnico (navegador, ventana, ruta, zona horaria, versión) | sí | — |
| `reportadoPor.uid` / `reportadoPor.email` | **no** (D-32) | `/reportes/{id}` |
| Título y slug de la actividad referida | solo si está **publicada** (D-33) | `/reportes/{id}` |
| Id de la actividad referida | sí — es opaco | — |

El filtro (`redactar()` en `functions/reportes.js`) tapa **mails** y **links de
reunión** (zoom, meet, teams, jitsi, whereby, wa.me) en todo el texto libre. Es
la segunda defensa: la primera es que el formulario avisa, arriba de todo, que el
repo es público.

**Todo el texto libre incluye el título**, que es el `title` del issue y el
renglón que más se lee desde internet. Hasta el 2026-08-22 no pasaba por el
filtro: la tabla de arriba decía "filtrados" y valía para la descripción y los
pasos nada más (B-81 en [`BACKLOG.md`](BACKLOG.md) → Cerrados). Los tests que lo
sostienen están en `tests/costuras.test.ts`.

La decisión sobre la actividad la toma la Function leyendo el documento, no el
panel: si dependiera del cliente, un panel viejo o modificado podría publicar el
título de un borrador.

**El PAT de GitHub no está en el cliente.** Si el panel llamara a la API de
GitHub, el token viajaría en el bundle de `/admin` y cualquiera podría escribir
en el repo. Por eso el panel escribe en Firestore y el token vive en Secret
Manager, accesible solo desde la Function (§5.4).

### Reglas de `/reportes/{id}`

```js
match /reportes/{id} {
  allow read: if esAdmin();
  allow create: if esAdmin() && reporteValido();
  allow update: if esAdmin() && reintentoValido();   // solo error → pendiente
  allow delete: if false;
}
```

`reporteValido()` valida la **forma** del documento, no solo quién escribe:
conjunto exacto de campos, topes de largo (los mismos que el schema del
formulario), `reportadoPor.uid == request.auth.uid`, `creadoEn == request.time`,
y que nazca en `estado: 'pendiente'` con `intentos: 0` y `github: null`.

El motivo del último punto: el estado inicial es lo que decide si la Function
toma el reporte. Un documento que naciera "creado" quedaría muerto en Firestore
sin publicarse nunca, y uno que naciera con un `github` inventado apuntaría a un
issue ajeno.

`tests/reportes.integracion.test.ts` verifica cada uno de esos rechazos contra el
emulador, y `tests/reportes.test.ts` verifica que el issue armado a partir de un
reporte real no contenga el uid ni el mail.

### La única escritura del cliente sobre un reporte ya creado (B-31)

`reintentoValido()` habilita **una** transición: un reporte en `error` vuelve a
`pendiente` para que la Function lo tome de nuevo. Cinco condiciones, cada una
tapando una forma de hacer daño:

| Condición | Qué evita |
|---|---|
| `estado` previo es `error` | reintentar algo `enviando` o ya `creado` — así se crean dos issues del mismo reporte |
| `github` previo es `null` | lo mismo, en profundidad: si ya tiene número, no hay nada que reintentar |
| solo cambian `estado`, `intentos`, `error`, `actualizadoEn` | **editar el texto que va al repo público** por la puerta del reintento |
| `intentos == 0` | que el botón no haga nada: la Function ignora un reporte con los intentos agotados, que es el caso más común de un `error` |
| `actualizadoEn == request.time` | antedatar, igual que en la creación |

Borrar sigue prohibido: un reporte es el pedido de una persona y el panel no
tiene por qué poder hacerlo desaparecer.

`tests/reportes-reintento.integracion.test.ts` fija los siete casos contra el
emulador. Está en su propio archivo porque **carga en el emulador las reglas de
este checkout** antes de correr: el emulador sirve el `firestore.rules` del
directorio desde el que se lo arrancó, así que con varios worktrees a la vez un
test de reglas puede estar verificando el archivo de otra rama y dar verde sin
haber probado nada.

## Analítica del panel

El panel manda eventos a GA4 (ver [`09-analitica.md`](09-analitica.md)). Es una
tercera salida además del `events.json` y del calendario, y la más estricta de
las tres: **acá no sale contenido, nunca, ni con permiso del dueño.**

### Qué se manda

Solo datos derivados: enteros, booleanos, valores de vocabularios cerrados, y
**rutas de campo** del schema (`arancel.tipo`, `sesiones.N.fin`).

Se mide *que* un campo falló validación y *cuál* campo. Nunca *qué* se escribió.

### Qué NUNCA sale

| Qué | Nota |
|---|---|
| Cualquier valor de cualquier campo | títulos, descripciones, temas, lecturas, notas |
| `inscripcion.destino` | el mail o teléfono de inscripción **sí** va al JSON público, pero no a analítica: acá no aporta nada |
| `online.url` | ni siquiera con `urlPublica: true`. El desvío del D-15 aplica al JSON y al calendario, no a esto |
| `difusion` | trabajo interno |
| `material.items[].url` y `titulo` | |
| `sede.direccion`, `sede.nombre`, `indicaciones` | |
| Handles de Instagram, webs, `imagenes[].url` y `imagenes[].epigrafe` | |
| `createdBy` / `updatedBy`, el uid y el mail del usuario logueado | ni crudos ni hasheados |
| El mensaje de un error | `formADocumento` tira `Fecha inválida: "<lo tipeado>"`: el mensaje *es* contenido. Sale la etiqueta `fecha-invalida` |

### Cómo se garantiza

Es el mismo criterio del §5.2 y de `toPublic.ts`: **se manda una proyección
deliberada, no el objeto.** Acá la proyección es una whitelist en las dos
direcciones (`construirEvento`, en `src/lib/analytics-eventos.ts`):

1. Un **nombre de evento** no declarado no manda nada.
2. Un **parámetro** no declarado en ese evento se descarta.
3. Cada parámetro declarado tiene un sanitizador, y **no existe un sanitizador
   de texto libre**: entero, booleano, enum cerrado, ruta del schema, o lista de
   esos. Un string fuera de su vocabulario se reemplaza por `otro`.
4. El único que no sale de un enum ni del schema es `version`, y va contra un
   **formato verificado**: semver de tres números más, como máximo, un sufijo que
   arranca alfanumérico y sigue con `[0-9A-Za-z.-]` hasta 40 caracteres. No entra
   un espacio, ni un acento, ni `@ : / ?`, así que un título, un mail, un handle
   o un link no pueden pasar por ahí; lo que no matchea viaja como `otro`. El
   formato es exactamente el que produce `scripts/version.mjs`, y que los dos
   lados no se separen lo verifica `tests/version.test.ts` (B-88 · D-98).

La consecuencia es la propiedad que importa: **no depende de que cada punto de
medición se acuerde de filtrar.** Un `medir()` mal escrito que pase el
formulario entero produce un payload vacío, no una fuga.

El identificador que distingue a las dos personas es un valor **aleatorio**
generado en el navegador y guardado en `localStorage`, no el uid ni el mail, y
tampoco un hash de ellos: con dos admins conocidos, un hash del mail se
revierte probando dos entradas (D-57).

### Cómo verificar

`tests/analytics-privacidad.test.ts` es el equivalente, para la analítica, del
test que verifica que el link de Zoom no sale al calendario. No confía en la
intención del código: arma el payload y busca el dato adentro.

```bash
npx vitest run tests/analytics-privacidad.test.ts
```

Qué verifica:

- Un formulario con **centinelas** en cada campo de texto —incluidos el link de
  la reunión, la difusión interna, la URL del material privado, el uid y el mail
  del admin— metido como parámetros de **cada** evento declarado: ningún
  centinela aparece en ningún payload.
- Un centinela en **cada parámetro declarado de cada evento**, uno por uno. Es la
  garantía estructural: si mañana alguien agrega un parámetro que acepte texto
  libre, el test falla sin que haya que acordarse de escribirle un caso.
- Que ningún valor de parámetro sea un objeto o un array (un valor anidado podría
  esconder contenido), y que todo string esté en un vocabulario cerrado.
- Que los issues **reales** de zod sobre un formulario roto produzcan rutas de
  campo reconocidas, y no valores.
- Que con los emuladores prendidos la analítica esté apagada.

Sobre el sistema real, lo que corresponde es el DebugView de GA4: mirar evento
por evento lo que llega y confirmar que no hay un parámetro de más. Está en
[`09-analitica.md`](09-analitica.md).


## Autorización

### Reglas de Firestore

```js
function esAdmin() {
  return request.auth != null && request.auth.token.get('admin', false) == true;
}

match /actividades/{id} {
  allow read:  if esAdmin() || resource.data.estado == 'publicado';
  allow write: if esAdmin();
  match /versiones/{version} {
    allow read:  if esAdmin();
    allow write: if false;      // solo el Admin SDK
  }
}
match /opciones/{campo} {
  allow read:  if true;         // los chips de filtro del §4.4
  allow write: if esAdmin();
}
match /sistema/{doc} {
  allow read:  if esAdmin();
  allow write: if false;        // solo el Admin SDK
}
```

Dos detalles que costaron encontrar:

- **`token.get('admin', false)`, no `token.admin`.** Leer una clave ausente de un
  map es un *evaluation error*, no `false`.
- **El `|| esAdmin()` en la lectura** es un agregado sobre el §5.3: sin él el
  panel no puede listar sus propios borradores.

**Advertencia del §5.3:** la condición sobre `resource.data` obliga a que toda
query pública incluya `where('estado','==','publicado')`, si no Firestore
rechaza la query entera (trampa 7). Con el JSON estático casi no afecta, pero
tenerlo presente si se agrega alguna lectura en vivo.

### Aprobar taxonomías (§4.3)

`/opciones/{campo}` es de **lectura pública** y de escritura solo con claim
`admin`. Aprobar una opción (`aprobada: true`) es una escritura más de ese
documento, así que **cualquiera de las cuentas con el claim puede aprobar**
(D-28). No hay una regla más fina porque las reglas no pueden comparar el array
`valores` elemento por elemento contra el anterior: no hay forma de verificar
"esta escritura solo cambió `aprobada`". Está anotado en las propias reglas.

Dos consecuencias que importan acá:

- **El creador se guarda como huella, no como uid** (D-27). El documento es
  público y el §5.1 dice que los uids no salen al público. `huellaCreador` es una
  huella de 8 hex del uid: sirve para comparar igualdad y no dice nada de nadie.
  Un test de integración verifica que el uid no aparezca en el documento.
- **La aprobación no esconde etiquetas ya en uso** (D-30). Filtra lo que se puede
  *elegir*, no lo que se puede *mostrar*: si una actividad usa una opción
  pendiente, el evento público sigue diciendo "Con beca parcial" y no
  "con-beca-parcial".

Al `events.json` van **solo las aprobadas** — `opcionesVisibles(valores)` sin
uid: el sitio público no publica vocabulario sin validar.

```bash
# Qué hay pendiente de aprobar en producción
node scripts/aprobar-opciones.mjs --listar
```

### Custom claim `admin`

Se setea una vez con el Admin SDK. El panel solo lo lee para decidir qué
mostrar; la autorización real la hacen las reglas.

```bash
# Emulador
npm run admin:claim -- --todos

# Producción
node scripts/preparar-produccion.mjs <email>
```

El claim entra al token en el próximo login.

## `firebase-admin` nunca al cliente

Si se cuela en un componente cliente, **la service account key termina en el
bundle** (trampa 4, §5.4). Tres defensas:

1. `src/lib/firebase-admin.ts` tira error si detecta `window`.
2. `astro.config.mjs` lo marca como `ssr.external`.
3. Se verifica sobre el build.

## Secretos

| Qué | Dónde va | Dónde NO |
|---|---|---|
| Service account key | ninguna parte: se usan las ADC de gcloud y la identidad del runtime | disco, repo |
| PAT de GitHub (reportes y §8) | Secret Manager, como `GITHUB_TOKEN` | `functions/.env`, repo, bundle del panel |
| Nombre del repo (`GITHUB_REPO`) | `functions/.env`, versionado — no es secreto | — |

| Service account key | ninguna parte en local: se usan las ADC de gcloud y la identidad del runtime | disco, repo |
| Key de `deploy-ci@` | secret `FIREBASE_SERVICE_ACCOUNT` de GitHub Actions | disco, repo |
| PAT de GitHub (§8) | Secret Manager, atado a la Function con `defineSecret` | `functions/.env`, repo |

| URL privada del ICS | `.env` local si hace falta | repo |
| Config del SDK web | versionada, no es secreta | — |

La URL privada del ICS (`.../private-.../basic.ics`) da acceso de lectura al
calendario entero a quien la tenga. Si aparece en un historial de comandos o un
chat, conviene rotarla desde la configuración del calendario.

**La key de `deploy-ci@` es la única key del proyecto**, y existe porque un
runner de GitHub no tiene ADC. Por eso la cuenta es aparte de `calendar-sync@` y
tiene lo mínimo: `roles/datastore.viewer` (leer, no escribir),
`roles/firebasehosting.admin` y `roles/serviceusage.serviceUsageConsumer`
(preguntar si una API está habilitada, que es lo que cualquier comando de
`firebase` hace antes de empezar). Los nombres van completos, con el prefijo, para
que el test que ata los dos documentos los pueda leer. Si se filtrara, el
daño se limita a leer datos que ya son públicos y a desplegar el sitio — **no a
modificar la base ni a cambiar qué es legible**.

Esa última mitad **dejó de ser cierta durante una hora** el 2026-08-25, y vale
escribir por qué: para habilitar el deploy de reglas por CI se le agregó
`firebaserules.admin`, y las reglas del §5.3 son lo único que mantiene fuera de una
lectura anónima los borradores, `difusion`, `online.url` y los uids. Con ese rol,
una key filtrada pasaba de "leer lo que ya es público" a **hacer legible todo
Firestore**. Se revirtió el mismo día (D-119) y las reglas se despliegan a mano.

**La lista de roles de esta sección y la de
[`02-infraestructura.md`](02-infraestructura.md) § "Roles de `deploy-ci@`" tienen
que decir lo mismo**, y lo verifica `tests/roles-deploy-ci.test.ts`: el drift entre
las dos es cómo esta afirmación quedó mintiendo una hora, y una afirmación de
seguridad que miente es peor que no tenerla.

## Cómo verificar — comandos

### El build no filtró el Admin SDK

```bash
npm run build
grep -rl "firebase-admin\|private_key\|service_account" dist/ && echo "FUGA" || echo "limpio"
```

El mismo chequeo corre como **paso bloqueante** del workflow de deploy
(`.github/workflows/deploy.yml`): si encuentra algo, el job falla y no se
publica nada. Falla cerrado a propósito — publicar la key es irreversible.

### Las reglas rechazan lo anónimo en producción

```bash
K=$(grep PUBLIC_FIREBASE_API_KEY .env.production | cut -d= -f2)
BASE="https://firestore.googleapis.com/v1/projects/agenda-literaria/databases/(default)/documents"

# Debe devolver "Missing or insufficient permissions"
curl -s -X POST "$BASE/actividades?key=$K" -H "Content-Type: application/json" \
  -d '{"fields":{"titulo":{"stringValue":"x"},"estado":{"stringValue":"publicado"}}}'

# Idem
curl -s -X PATCH "$BASE/opciones/arancel?key=$K" -H "Content-Type: application/json" \
  -d '{"fields":{"valores":{"arrayValue":{"values":[]}}}}'

# Esta SÍ debe funcionar: los chips de filtro la necesitan (§4.4)
curl -s "$BASE/opciones/arancel?key=$K"
```

### El issue no filtró la identidad de quien reportó

Los tests lo cubren, pero cuando haya issues reales conviene mirarlos:

```bash
gh issue list --repo benoffi7/agenda-literaria --label reporte-panel \
  --json number,title,body |
  grep -Ei "@gmail|@hotmail|zoom\.us|meet\.google|wa\.me" && echo "FUGA" || echo "limpio"
```

### El calendario real no filtró nada

Leer el ICS y buscar lo que no debe estar. La URL privada **no** se pega acá:
va en una variable de entorno.

```bash
curl -s "$ICS_PRIVADO" -o /tmp/cal.ics
python3 - <<'PY'
import pathlib
# El formato ICS parte las líneas largas: hay que desdoblarlas antes de buscar,
# o un grep directo da falsos negativos.
raw = pathlib.Path('/tmp/cal.ics').read_text(errors='replace')
plano = raw.replace('\r\n ', '').replace('\n ', '')
for t in ['zoom.us', 'meet.google.com', 'us02web']:
    print(('  FUGA: ' if t in plano else '  ok  : ') + t)
PY
```

### Las reglas y el diff, en los tests

```bash
npm run emu      # en otra terminal
npm test
```

`tests/actividades.integracion.test.ts` verifica contra el emulador que sin claim
no se escribe, que un anónimo lee lo publicado pero no un borrador, y que la
proyección no filtra. `tests/calendario.test.ts` verifica lo mismo para el
evento.

## Historial de versiones

`guardarVersion` escribe el documento anterior completo en
`/actividades/{id}/versiones/{version}` cada vez que una edición pisa contenido
cargado por una persona (§12, D-41).

**Guarda el documento entero, sin proyectar** — incluidos `difusion` y
`online.url`, que son internos. Eso es deliberado: el §12 pide el `before`
completo, y proyectarlo sería guardar un historial del que justamente no se
puede recuperar lo que uno quiere recuperar.

Es aceptable porque **la audiencia de la subcolección es exactamente la misma
que la del documento padre**, y no hay camino desde ahí a una salida pública:

| | |
|---|---|
| Quién puede leerla | solo un admin — `allow read: if esAdmin()` |
| Quién puede escribirla | nadie desde el cliente — `allow write: if false`, solo el Admin SDK |
| ¿Llega al `events.json`? | **no.** El build lee la colección `/actividades`, y una query de colección **no** trae subcolecciones. `toPublic.ts` nunca la ve. |
| ¿Llega a Google Calendar? | **no.** `calendario.js` recibe el documento de la actividad, no sus versiones. |

O sea: un admin que lee una versión ya podía leer los mismos campos en el
documento padre, incluidos los borradores (D-04). La subcolección no amplía a
nadie lo que puede ver.

**Lo que sí hay que no hacer:** si algún día el build necesita recorrer
subcolecciones (`getCollections()`, `collectionGroup('versiones')`), pasaría a
tener en mano documentos con `difusion` y `online.url` de todas las actividades.
Cualquier lectura nueva ahí tiene que quedar afuera de lo que se proyecta al
JSON.

Las reglas ya contemplaban esta subcolección desde antes de que existiera la
Function, así que no hubo que cambiarlas.

### Verificar que las versiones no son públicas

```bash
K=$(grep PUBLIC_FIREBASE_API_KEY .env.production | cut -d= -f2)
BASE="https://firestore.googleapis.com/v1/projects/agenda-literaria/databases/(default)/documents"

# Debe devolver "Missing or insufficient permissions" incluso si la actividad
# está publicada: la regla de lectura del padre no cascadea a la subcolección.
curl -s "$BASE/actividades/<id>/versiones?key=$K"
```

Y sobre el JSON, una vez que exista el sitio público (B-01):

```bash
npm run build
grep -rl "difusion\|versiones" dist/events.json && echo "FUGA" || echo "limpio"
```
