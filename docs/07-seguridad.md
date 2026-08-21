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
| Handles de Instagram, webs, `imagenUrl` | |
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

## Historial

Las reglas contemplan `/actividades/{id}/versiones/{ts}` con escritura solo por
Admin SDK, pero **la Function del §12 no está escrita**: hoy pisar una
descripción larga la pierde. Está en el [backlog](BACKLOG.md).
