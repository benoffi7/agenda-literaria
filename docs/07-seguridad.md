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
  allow update, delete: if false;      // el ciclo de vida es de la Function
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
tiene lo mínimo: `datastore.viewer` (leer, no escribir) y
`firebasehosting.admin`. Si se filtrara, el daño se limita a leer datos que ya
son públicos y a desplegar el sitio — no a modificar la base.

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

## Historial

Las reglas contemplan `/actividades/{id}/versiones/{ts}` con escritura solo por
Admin SDK, pero **la Function del §12 no está escrita**: hoy pisar una
descripción larga la pierde. Está en el [backlog](BACKLOG.md).
