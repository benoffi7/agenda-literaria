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
| PAT de GitHub (§8) | Secret Manager | `functions/.env`, repo |
| URL privada del ICS | `.env` local si hace falta | repo |
| Config del SDK web | versionada, no es secreta | — |

La URL privada del ICS (`.../private-.../basic.ics`) da acceso de lectura al
calendario entero a quien la tenga. Si aparece en un historial de comandos o un
chat, conviene rotarla desde la configuración del calendario.

## Cómo verificar — comandos

### El build no filtró el Admin SDK

```bash
npm run build
grep -rl "firebase-admin\|private_key\|service_account" dist/ && echo "FUGA" || echo "limpio"
```

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
