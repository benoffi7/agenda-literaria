# Operación

## Poner a andar el entorno local

```bash
npm install
cd functions && npm install && cd ..
```

Tres terminales:

```bash
npm run emu      # emuladores: Auth 9099, Firestore 8080, Storage 9199, UI 4000
npm run seed     # siembra /opciones/* y el centinela del índice de slugs
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
| `npm test` | la suite completa. **El tamaño lo dice ella al terminar** (`Test Files` / `Tests`) y no se copia acá: el conteo escrito a mano quedó viejo cuatro veces en dos semanas — ver la nota de abajo |
| `npm run test:watch` | idem en watch |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run tablero` | el tablero del backlog en `http://127.0.0.1:4173` — mira y mueve los dos archivos del backlog sin abrirlos. Ver abajo |
| `npm run backlog:archivar` | se lleva de `docs/BACKLOG.md` a `docs/BACKLOG-cerrados.md` todo lo que quedó `✅ hecho` o `❌ descartado`, y devuelve al vivo lo archivado que se haya reabierto. Ver abajo |
| `npm run backlog:archivar:seco` | lo mismo, diciendo qué movería sin tocar nada |
| `npm run emu` | emuladores, con import/export de estado en `.emulador/` |
| `npm run seed` | siembra `/opciones/*` y el centinela `/slugs/_indice` en el emulador |
| `npm run admin:claim -- --todos` | claim `admin` a los usuarios del emulador |
| `npm run admin:claim:prod -- <uid\|email>` | claim `admin` en producción |
| `npm run admin:claim:prod -- --publicador <uid\|email>` | claim `publicador` (solo lo que él carga — B-888) |
| `npm run admin:claim:prod -- --publicador --ciudad "<ciudad>" <uid\|email>` | ídem, y además **ve en solo lectura** lo de esa ciudad (B-919) |
| `npm run ciudades:sembrar` | informa qué `ciudades` escribiría en el emulador (B-919, D-690) |
| `npm run ciudades:sembrar:prod` | informa qué escribiría en producción. `-- --aplicar --produccion` lo escribe |
| `npm run geografia:sembrar` | informa qué `provincia`/`barrio`/`ciudad` normalizaría en el emulador (B-950, D-710) |
| `npm run geografia:sembrar:prod` | informa qué escribiría en producción. `-- --aplicar --produccion` lo escribe. **Ojo: esta corrida reescribe los eventos de Calendar** |
| `npm run admin:claim:prod -- --quitar <uid\|email>` | le saca el rol a una cuenta |
| `npm run slugs:sembrar -- --aplicar` | siembra el índice de direcciones web en el emulador (B-888, D-660) |
| `npm run slugs:sembrar:prod` | informa qué sembraría en producción. `-- --aplicar --produccion` lo escribe; `--reparar` además borra las reservas huérfanas |
| `npm run opciones:aprobar -- --listar` | opciones pendientes de aprobar, en el emulador |
| `npm run opciones:aprobar:prod -- --listar` | idem, en producción |
| `npm run calendario:verificar` | B-125 — compara Firestore contra Calendar **de verdad** y reporta eventos borrados a mano y, desde B-631, los que existen pero dicen otra cosa que el código de hoy. `-- --reparar` recrea los borrados; `-- --reescribir` actualiza los desactualizados. Ver "Verificar contra Calendar de verdad (B-125)" más abajo |
| `npm run cors:verificar` | B-1321 — le pregunta **al bucket**, no a `cors.json`, si tiene aplicado el CORS: un `GET` con `Origin` por cada origen del archivo contra una imagen de `events.json`, más un control negativo. Solo lee. Ver «El CORS del bucket» más abajo |
| `./scripts/verificar-todo.sh` | el gate de antes de pushear: marcadores, typecheck, tests con emuladores, build contra el emulador y fuga de credenciales |
| `./scripts/build-contra-emulador.mjs` | el paso 4 del gate, corrible solo: siembra, buildea y afirma sobre el `dist/events.json`, sobre el HTML de las páginas de detalle (B-110) y —desde B-121— sobre **todos** los archivos publicables del `dist/`, barriéndoles los centinelas |
| `./scripts/emuladores-arriba.sh` | ¿hay emuladores escuchando, y en qué hosts? Es la decisión de los pasos 3 y 4 del gate, afuera para poder testearla (B-180) |
| `node scripts/project-id-emulador.mjs` | la **base de emulador de este checkout** (`agenda-literaria-<8 hex>`). Es de dónde salen el `projectId` de los tests y el del gate (B-219) |
| `./scripts/probar-concurrencia.sh` | corre dos suites de integración a la vez. Sin banderas tiene que dar verde; con `--misma-base` tiene que dar **rojo** — es la reproducción del flaky de B-219 |
| `node scripts/salud-del-codigo.mjs` | remide `docs/10-salud-del-codigo.md` (§1.1, §1.2, §1.4, §1.5, §1.6) e imprime las tablas en markdown listas para pegar. Con `--json`, para otro programa (B-311) |
| `node scripts/etiquetas-github.mjs` | crea o actualiza en GitHub las etiquetas que el panel le pone a sus issues, derivándolas de `functions/reportes.js`. Idempotente y con verificación. Con `--dry-run` no toca nada (B-33) |
| `node scripts/verificar-produccion.mjs` | **lee el sistema real** (B-116): escritura y lectura anónimas rechazadas con su control positivo, las cabeceras de cache contra lo que declara `firebase.json`, la versión publicada, y —con `GOOGLE_CALENDAR_ICS_PRIVADO` en el entorno— que el ICS no lleve el link de la reunión. Ver abajo |

> **El conteo de tests no se escribe a mano en ninguna parte, y es una decisión.**
> Estuvo escrito en `docs/README.md` y en la tabla de arriba, y las dos copias
> quedaron viejas —2.148, 2.006, 2.039, 2.173, 2.208 contra los 2.637 de hoy— con
> el agravante de que `README.md` llegó a tener el mismo párrafo **tres veces** con
> tres conteos distintos (B-296). Un número que hay que actualizar a mano en un
> documento envejece siempre, y mientras tanto miente con autoridad. Lo dice la
> suite al terminar; eso no puede quedar viejo. `tests/salud-del-codigo.test.ts`
> lo hace cumplir (B-662): falla si `README.md` o este documento vuelven a
> escribirlo. El `CHANGELOG`, el `BACKLOG` y `10-salud-del-codigo.md` quedan
> afuera a propósito — ahí un conteo fechado es el dato, no un descuido.

### El tablero del backlog

```bash
npm run tablero            # http://127.0.0.1:4173
npm run tablero -- 5050    # en otro puerto
```

Una web local —sin build, sin dependencias, sin base de datos— para mirar el
backlog como tablero: columnas por prioridad, por sección o por estado, buscador
sobre el título y el cuerpo, la ficha de cada ítem con su markdown renderizado, y
una pestaña con las ideas de [`11-ideas-de-producto.md`](11-ideas-de-producto.md).

**Lee los dos archivos del backlog** —`BACKLOG.md` y `BACKLOG-cerrados.md`— y
escribe en el que tenga el ítem, así que marcar hecho uno abierto toca el vivo y
una nota sobre uno archivado toca el otro. El alta solo ofrece las secciones del
vivo: un ítem nuevo nace abierto.

**El markdown sigue siendo la fuente de verdad.** El tablero no guarda nada
propio: lee los dos archivos en cada pedido y, cuando se cambia algo, reescribe
**la línea del encabezado** o inserta una cita. Las cuatro cosas que puede
escribir son la prioridad, el estado (`✅ hecho` / `❌ descartado` /
`🟠 empezado` / abierto), una
nota fechada debajo del encabezado, y un ítem nuevo al principio de su sección con
el próximo `B-` libre. **Nunca toca el cuerpo de un ítem**, que es lo que el skill
`al-backlog` pide: «no borres el texto, el rastro importa más que la prolijidad de
la lista». Todo lo que hace se ve en `git diff`.

**Tres guardas, y las tres por algo que ya pasó:**

- **Escucha solo en `127.0.0.1`.** El backlog es público, pero este proceso
  *escribe* en el repo.
- **Cada escritura lleva precondición.** Manda el encabezado que el tablero tenía
  en pantalla y el servidor lo busca en el disco; si no está, devuelve `409` y no
  escribe. El 2026-09-15 dos frentes numeraron `B-930` con minutos de diferencia
  (de ahí el hueco `B-941`–`B-949` anotado en la cabecera del backlog): esa es la
  carrera que esto corta. Por lo mismo, el id de un ítem nuevo se recalcula contra
  el disco justo antes de escribir, no cuando se abrió el formulario.
- **Escritura atómica** (temporal al lado + `rename`): un Ctrl-C en el medio deja
  el archivo entero.

**El estado se lee del archivo, con el vocabulario del archivo** (B-984). Son
cinco emojis —`✅` hecho, `❌` descartado, `⚠️` mirado y sin nada que
arreglar, `🟡` a medias, `🟠` empezado— y cuatro estados en la pantalla:
`hecho`, `descartado`, `empezado` (que junta `🟡` y `🟠`) y `abierto`, que es
no tener marcador. El separador de adelante puede ser `—` o `·`, y el marcador
puede ir **antes** del título (`### B-733 · ✅ hecho (fecha) — El url de cada
subEvent…`) o después: reconocer solo `— ✅` y `— 🟠` era lo que dejaba
**46 ítems cerrados listados entre lo que falta hacer**. Los dos estados cerrados
nacen apagados en el filtro, así que lo que se ve al abrir es lo que falta.

Cada ítem tiene URL propia: `http://127.0.0.1:4173/#B-950` abre esa ficha
directo, que es lo que se le pega a alguien en un mensaje.

La pantalla mira la fecha de los dos archivos cada cuatro segundos y se recarga
sola cuando cambian, así que se puede tener abierto mientras una sesión de Claude
escribe en el mismo backlog — que es exactamente lo que pasó al construirlo.

`scripts/tablero/parseo.mjs` es la parte pura (parseo y las cuatro reescrituras) y
la cubre `tests/tablero.test.ts` con las formas de encabezado que el archivo real
tiene hoy; `scripts/tablero/servidor.mjs` es HTTP y disco, y se probó a mano de
punta a punta.

### Archivar los cerrados del backlog

```bash
npm run backlog:archivar:seco   # qué se movería
npm run backlog:archivar        # moverlo
```

`docs/BACKLOG.md` es **lo que falta hacer**; el rastro de lo cerrado vive en
[`BACKLOG-cerrados.md`](BACKLOG-cerrados.md). Los separa este script, y por eso
es un script y no una edición a mano: el mes que viene hay otros cincuenta
cerrados, y una partición hecha a mano es una foto que envejece desde el minuto
siguiente. **Nada se borra** —el rastro importa más que la prolijidad de la
lista— y nada se reescribe: el movimiento es por rebanada de líneas, del
encabezado del ítem a la línea anterior al próximo, sin round-trip markdown →
objeto → markdown.

El 2026-09-17, cuando se partió por primera vez, eran **372 ítems cerrados de
433** y el 87% de las líneas: `BACKLOG.md` pasó de 19.334 a 2.597.

**Mueve en las dos direcciones.** Un ítem archivado que se reabre —desde el
tablero o a mano— vuelve al vivo, a su sección. Sin eso quedaría abierto adentro
del archivo de cerrados, que es la peor de las dos mentiras, y ninguna corrida
futura lo sacaría de ahí.

**Antes de escribir, verifica que no se haya perdido texto**: cada bloque movido
tiene que aparecer entero en una de las dos salidas, y si falta uno no escribe
nada. `tests/archivar-backlog.test.ts` prueba esa verificación con su control
negativo —un movimiento que se come una línea **tiene que** dar rojo—, más la
conservación contra el archivo real: mismos ítems, mismo cuerpo, mismo
encabezado, misma sección.

**Y verifica dónde queda cada ítem, no solo que esté** (B-1233). Si algún ítem
cambiara de sección entre la entrada y la salida, no escribe nada y dice cuál. Y
si algún ítem está **antes de la primera cabecera `## `** —la forma en que quedó
el archivo de cerrados en `b9265f3`, con la línea `## P0` perdida—, ni siquiera
corre: ese archivo ya está roto y hay que repararlo a mano primero.

**No reordena nada** (B-1146). Las secciones del archivo de cerrados quedan en
el orden en que están, y cada ítem movido va al final de la suya; una sección
que el archivo no tenía va al final. Archivar un ítem es un diff del tamaño de
ese ítem —medido: 37 líneas—, no las doce mil que daba antes, cuando la sección
del ítem movido subía adelante de todas. Ese diff irrevisable era lo que
empujaba a deshacerlo a mano, y deshacerlo a mano fue lo que rompió el archivo.

**Lo que el corte podía romper y no rompe:** el próximo `B-` libre. La mitad de
los ids usados vive en el archivo de cerrados, así que el tablero calcula
`proximoNumero` sobre **los dos** textos; mirar solo el vivo propondría un número
ya tomado, que es el choque de `B-930` del 2026-09-15. Lo que sigue sin cubrir es
un id **reservado por una tanda y nunca escrito** — no deja rastro en ningún
archivo (B-1051).

### Verificar contra el sistema real (B-116)

`docs/05-patrones.md` tiene la regla que ningún test cumple solo: los unitarios
prueban la **intención**; para lo que sale al mundo hay que **leer el resultado**.
Los comandos que la cumplen estaban escritos —acá y en `07-seguridad.md`— y se
corrían a mano, o sea cuando alguien se acordaba.

```bash
node scripts/verificar-produccion.mjs

# con el calendario, que necesita la URL privada del ICS
GOOGLE_CALENDAR_ICS_PRIVADO='https://…/private-…/basic.ics' \
  node scripts/verificar-produccion.mjs

# contra otro origen (por ejemplo el dominio de Firebase)
SITIO=https://agenda-literaria.web.app node scripts/verificar-produccion.mjs
```

Qué mira, y por qué cada uno:

| Chequeo | Qué atrapa |
|---|---|
| Escritura anónima a `/actividades` y `/opciones` | el §5.3: sin el claim `admin` no se escribe |
| **Lectura** anónima de `/actividades`, suelta y por query | **D-128 / B-208** — la regla vieja entregaba el documento entero de toda actividad publicada, salteando `toPublic`. Es la que hay que correr después de deployar reglas |
| Lectura de `/opciones/arancel` (**control positivo**) | sin él, todo el bloque pasa con una API key equivocada o sin red: cada sonda daría «rechazo» y se leería como «está todo cerrado» |
| `Cache-Control` de cada ruta literal de `firebase.json` | D-38 — son la mitad del mecanismo de actualización del panel |
| `/version.json` | qué quedó publicado, y si se buildeó con cambios sin commitear |
| El ICS del calendario | trampa 5 — el link de la reunión en un calendario público. **Desdobla las líneas antes de buscar**: el formato ICS parte las largas, y lo largo es justamente la URL |
| Los issues con `reporte-panel` | que no haya llegado la identidad de quien reportó a un repo público |

Tres cosas del diseño que conviene saber:

- **No es parte de ningún gate, a propósito.** Necesita red y producción; meterlo
  en `verificar-todo.sh` sería un gate que falla cuando se cae el wifi, que es lo
  que enseña a saltear un gate (B-180).
- **Un `—` es un chequeo saltado y no cuenta como verde.** Dice por qué no pudo.
- **No pide, no crea y no imprime ninguna credencial** (§5.4). La URL privada del
  ICS entra por el entorno y nunca sale por pantalla; la API key sale de
  `.env.production`, que está versionado porque la config del SDK web es pública
  por diseño. Por eso este chequeo lo corre el dueño y no un agente.

`tests/verificar-produccion.test.ts` cubre lo que decide —la derivación de las
cabeceras, que un rechazo se distinga de una respuesta vacía, y el desdoblado del
ICS— sin tocar la red.

### Remedir la salud del código (B-311)

`docs/10-salud-del-codigo.md` vale porque cada cifra salió de contar el árbol
real, y su encabezado prohíbe estimarlas. El costo de esa regla era que remedir a
mano son un par de horas, así que **no se remedía**: llegó a declarar 111 archivos
de producción con 180 en el árbol.

```bash
node scripts/salud-del-codigo.mjs          # las tablas, en markdown
node scripts/salud-del-codigo.mjs --json   # lo mismo, para otro programa
```

Tres cosas que conviene tener claras antes de correrlo:

- **No escribe el documento y no decide nada.** Imprime las cifras; qué significa
  que una se movió, qué entra en «lo que está bien» y qué problema abrió o cerró
  sigue siendo trabajo de quien remide. Lo caro de ese documento nunca fue contar.
- **No hay ningún test que compare esas cifras contra el árbol**, a propósito: se
  mueven con cada commit de cualquier frente, y un chequeo que se pone rojo por
  trabajo ajeno es el que enseña a saltearse los chequeos (B-180).
- **Lo que sí está atado** vive en `tests/salud-del-codigo.test.ts`: cero ciclos
  de import, que los archivos que las tablas nombran existan, y que el criterio
  escrito en el documento sea el mismo que el script aplica.

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
aparte para que nadie le dé admin a una cuenta real creyendo estar en local, y
**desde B-810 anuncia el objetivo (EMULADOR o PRODUCCIÓN) antes de escribir** —
hasta entonces era el único de los siete que deciden entre los dos entornos que no
lo hacía, justo el que reparte permisos—. `opciones:aprobar` sigue la misma
convención y ya lo anunciaba.

### Dar permiso a una cuenta (producción)

**El orden importa y es al revés del intuitivo: primero se entra, después se da
el permiso.** El claim se escribe sobre un usuario que tiene que existir, y con
Google el usuario **nace en el primer login**, no antes.

1. **Que la persona entre una vez** a `/admin` con esa cuenta de Google. Va a ver
   la pantalla de «sin permisos», y eso es lo esperado: alcanza para que Firebase
   Auth cree el usuario.
2. **Dar el claim**, con credenciales de producción en el entorno:

   ```bash
   npm run admin:claim:prod -- agendaleh@gmail.com
   ```

   El script anuncia el objetivo (PRODUCCIÓN) antes de escribir — **desde B-810,
   porque hasta entonces era el único de los siete que no lo hacía y esta misma
   línea ya lo prometía**. Y si no encuentra la cuenta, el error dice las dos
   causas posibles con el comando correcto listo para copiar: el comando
   equivocado (`admin:claim` va al **emulador**) o el paso 1 sin hacer.
3. **Que vuelva a entrar.** El claim viaja en el token, así que la sesión que ya
   estaba abierta **no lo tiene**: hay que cerrar sesión y volver a entrar (o
   esperar a que el token se renueve, hasta una hora).

**Los dos roles, y cómo se cambia de uno a otro** (B-888):

```bash
npm run admin:claim:prod -- <email>                  # admin: ve y toca todo
npm run admin:claim:prod -- --publicador <email>     # publicador: solo lo que él carga
npm run admin:claim:prod -- --publicador --ciudad "Mar del Plata" <email>
                                                     # ídem + ve (solo lee) lo de esa ciudad
npm run admin:claim:prod -- --quitar <email>         # le saca el rol
```

**`--ciudad` es el alcance por ciudad de B-919.** El script la slugifica con el
`slugify` del proyecto —el mismo con el que el panel escribe `ciudades` en cada
actividad—, así que se escribe como se escribe: `"Mar del Plata"`, `"mar del
plata"` y `"MAR DEL PLATA"` producen el mismo claim. Solo tiene sentido con
`--publicador` (un admin ve todo el catálogo) y el script rechaza el comando si
se pasa con otro rol, en vez de ignorarla.

> ⚠️ **Antes de dar un claim con `--ciudad`, correr el backfill de `ciudades`**
> (más abajo). Sin él, la cuenta ve **solo lo suyo**: los documentos que ya están
> en producción no tienen el campo y la regla los deja afuera.

Los tres pasos de arriba son los mismos para cualquiera de los tres comandos, y
el script anuncia **también el rol** antes de escribir, por el mismo motivo que
anuncia el objetivo: `--publicador` es un flag de una palabra en medio de un
comando largo, y equivocarse en silencio es darle el panel entero a quien tenía
que ver solo lo suyo.

**No hace falta «sacar» el rol anterior antes de dar el nuevo.**
`setCustomUserClaims` reemplaza el objeto de claims **entero**, así que pasar a
publicador saca el `admin` en la misma llamada. Y si de todas formas una cuenta
quedara con los dos claims —tocando la consola a mano—, las reglas la tratan como
publicador: ver `07-seguridad.md` § «El orden de las guardas».

Y un cuidado que no es del script: **el login por popup solo funciona en un
dominio autorizado**. Ver «Los dominios autorizados de Auth», más abajo.

### Los dominios autorizados de Auth

**El síntoma**: el panel **carga** en `agendaleh.ar` y en `agendaleh.com.ar` pero
el login no pasa — se abre la ventana de Google y no vuelve nada. Reportado por el
dueño el 2026-09-07.

**La causa**: `loginConGoogle` usa `signInWithPopup`, que abre el handler en el
`authDomain` del proyecto (`agenda-literaria.firebaseapp.com`) y ése **valida el
origen que lo abrió** contra la lista de dominios autorizados de Firebase Auth. Un
dominio propio **no está en esa lista por default**: `agenda-literaria.web.app` y
`agenda-literaria.firebaseapp.com` sí, los dos `agendaleh` no. El SDK falla con
`auth/unauthorized-domain`.

**El arreglo, que es de consola y no de código**: Firebase → **Authentication** →
**Settings** → **Authorized domains** → *Add domain*, y agregar los dos:
`agendaleh.ar` y `agendaleh.com.ar`. No hay que redeployar nada; el cambio es
inmediato.

**Verificar**: entrar a `https://agendaleh.ar/admin` y apretar «Entrar con
Google». Antes de este arreglo la pantalla decía «Este dominio todavía no está
habilitado para entrar»; después, abre el popup y vuelve con la sesión.

**Y por qué no se veía** (B-790): el botón hacía `void loginConGoogle()`, o sea
que **descartaba la promesa y con ella el error**. El popup fallaba y la pantalla
quedaba igual — de ahí el «carga pero no entra». Es la misma clase de B-590, donde
el `code` del SDK se ignoraba y el mensaje mentía sobre la causa. Ahora el motivo
se muestra, con el código a la vista cuando no se reconoce.

**El caso que no se arregla del lado de quien entra** —éste, y el acceso con
Google deshabilitado— **no ofrece «probar de nuevo»**: reintentar no va a
funcionar nunca y solo retrasa el aviso.

## El gate de antes de pushear

Seis pasos mecánicos, en un script para poder correrlos a mano, y un hook que
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
| 4 | `./scripts/build-contra-emulador.mjs` con el emulador (el que ya está arriba, o uno efímero) | el build tiene que **leer Firestore de verdad**: siembra **cuatro** actividades —publicada, borrador, y las dos canceladas de B-110: una que estuvo publicada y una que nunca lo estuvo—, buildea, y afirma sobre los **dos** artefactos. Sobre el `dist/events.json`: la publicada está, la borrador y las dos canceladas no, y ningún campo recortado se coló (B-217). Sobre el **HTML**: la cancelada-que-estuvo-publicada tiene su página, con la franja, el `EventCancelled`, sin CTA y sin ningún campo privado (con `urlPublica: true` en el fixture); la que nunca se publicó y el borrador **no tienen archivo** (B-110, y de paso B-241). Desde B-181 el fixture también trae una **opción para sumarse**, y el paso afirma que su etiqueta llega al índice **y** que la página pinta su encabezado y el título «Elegí tu opción»: el agrupado vive en un `.astro` y es lo único que puede mirarlo (D-140) |
| 5 | `./scripts/verificar-bundle.sh dist` | el gate del artefacto, en sus **dos** mitades; va después del build porque sin `dist/` no verifica nada. La primera es la de siempre (§5.4 / trampa 4): que no haya rastros del Admin SDK. La segunda la agregó **B-868**: que App Check **esté** — la clave de sitio de `.env.production` en el bundle, viajando a `activarAppCheck` con `usarEmuladores` en falso, y el proveedor de Enterprise. Faltaba lo simétrico: un bundle sin clave, con la config de emuladores o con el proveedor cambiado salía verde por la suite y por el gate, y con el enforcement de Firestore puesto (2026-09-10) eso es **el panel y `/proponer` sin poder escribir** |

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
acompaña al cambio. Eso necesita criterio y va por el skill `/audit`, que lanza
los auditores que correspondan al alcance, en paralelo: un hook de git no puede
invocar un modelo. Ver [`13-agentes.md`](13-agentes.md).

**Y el gate no verifica que hayas auditado.** Hasta el 2026-09-08 sí: su séptimo
paso exigía los tres sellados sobre el contenido que se iba a publicar. Se
eliminó con **D-560**, así que hoy los seis pasos pueden pasar en verde sin que
nadie haya corrido un auditor. Correr `/audit` antes de pushear sigue siendo lo
que conviene; lo que ya no hay es nada que te lo recuerde.

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

## Sembrar el índice de direcciones web (B-888, D-660)

**Es un paso del despliegue, no una prolijidad, y va ANTES de habilitarle el
panel a nadie con el rol `publicador`.**

`/slugs/{slug}` es lo que le permite al panel verificar que una dirección web no
esté tomada sin barrer el catálogo — que con la regla de B-888 se le rechaza
entero a una cuenta acotada (trampa 7). Las actividades que **ya existen** no
tienen reserva, así que hasta que esto corra sus direcciones se leerían como
libres: eso es la trampa 10 (dos actividades peleando la misma URL).

Por eso el script deja el centinela `/slugs/_indice` y el panel **se niega a
guardar** mientras no está, con el mensaje «no se pudo verificar la dirección
web». Si alguien reporta eso, la respuesta es este script.

```bash
# 1. Ver qué haría, sin escribir (contra producción)
npm run slugs:sembrar:prod

# 2. Sembrarlo
npm run slugs:sembrar:prod -- --aplicar --produccion
```

Ensayarlo primero contra el emulador es gratis: `npm run slugs:sembrar --`
(mismo script, otro objetivo). Como todo script que escribe, **sin `--aplicar`
solo informa**, y `--aplicar` fuera del emulador exige `--produccion` explícito.

**Es idempotente, y en una sola pasada.** Escribe la reserva que falta **y la que
apunta a otra actividad**; con `--reparar` borra además las huérfanas —las de un
nombre que ninguna actividad usa—:

```bash
npm run slugs:sembrar:prod -- --aplicar --produccion --reparar
```

## Sembrar `ciudades` en las actividades (B-919, D-690)

**Es un paso del despliegue, no una prolijidad, y va ANTES de darle a nadie un
claim con `--ciudad`.**

`ciudades` es el derivado —los slugs de las ciudades de `modalidades[].sede`— con
el que la regla contesta el alcance por ciudad del rol `publicador`. Lo escribe
`formADocumento` en cada guardado, o sea que **lo nuevo nace con el campo puesto**;
las actividades que **ya existen** no lo tienen, y el default de la regla
(`.get('ciudades', [])`) las deja afuera.

**O sea: hasta que esto corra, la publicadora no ve nada de su ciudad.** Solo lo
suyo — el comportamiento anterior a B-919. Falla cerrada, que es la dirección
correcta, pero si alguien reporta «no me aparece nada de Mar del Plata», la
respuesta es este script.

```bash
# 1. Ver qué haría, sin escribir (contra producción)
npm run ciudades:sembrar:prod

# 2. Escribirlo
npm run ciudades:sembrar:prod -- --aplicar --produccion
```

Ensayarlo primero contra el emulador es gratis: `npm run ciudades:sembrar --`
(mismo script, otro objetivo). Como todo script que escribe, **sin `--aplicar`
solo informa**, y `--aplicar` fuera del emulador exige `--produccion` explícito.

**Es idempotente**: recalcula y escribe **solo las que difieren**, así que la
segunda corrida no escribe nada. No borra: no hay caso de «ciudad huérfana»,
porque el campo entero se deriva del documento en el que vive.

**Lo que la corrida dispara, dicho antes:** una versión del §12 por actividad
tocada (`ciudades` es un derivado del contenido, como `searchText`, así que entra
a la foto), **ningún** cambio en Calendar (no entra al payload del evento) y un
rebuild del sitio, que el debounce del §8 colapsa en uno solo.

El informe marca aparte cuántas quedan con `[]` — las virtuales y las que tienen
la ciudad sin cargar. **No es un error**: esas no son de ninguna ciudad y no las ve
ningún publicador por ciudad. Es el caso que alguien va a venir a preguntar.

## Sembrar una taxonomía NUEVA en producción (B-973 — ✅ con red)

**Agregar un campo a `CAMPOS_TAXONOMIA` y a `opciones-base.json` no lo siembra en
producción.** El vocabulario nuevo llega al código y no a la base: un desplegable
vacío, y si el campo es obligatorio, **un formulario que no se puede guardar**.

Desde B-973 hay dos piezas, y conviene entender qué hace cada una.

### 1 · El chequeo, que avisa

```bash
npm run taxonomias:verificar     # lee producción; falla si falta alguna
```

Compara `CAMPOS_TAXONOMIA` —leído del **fuente**, que es la lista autoritativa—
contra los documentos `/opciones/*` que hay en la base, y **falla listando los que
faltan**. Es de solo lectura: no siembra.

Corre solo en cada deploy, como **primer paso del job `hosting`** de
`push-main.yml`, antes del build. Va antes y no después porque el build **no
falla** ante un vocabulario faltante: `contenidoDelSitio.ts` hace
`snap.data()?.valores ?? []` y publica los chips vacíos sin decir nada.

> **Es el único chequeo del pipeline que mira producción**, y por eso es el único
> que puede ver esto. Los seis pasos de `verificar-todo.sh`, el build real y la
> suite entera corren contra el **emulador**, que `seed-emulador.mjs` siembra
> desde el mismo `opciones-base.json`: ahí la taxonomía nueva siempre existe. La
> asimetría entre los dos entornos es el punto ciego, y solo se ve mirando
> producción. Por lo mismo el script **aborta si detecta `FIRESTORE_EMULATOR_HOST`**:
> ahí daría verde siempre, y un chequeo que no puede fallar es peor que ninguno.

### 2 · La siembra, que arregla

```bash
npm run opciones:sembrar:prod    # = preparar-produccion.mjs --solo-opciones
```

Crea **solo los documentos que no existen**. Es idempotente a propósito: no pisa
las opciones que alguien creó con «Otro». El flag `--solo-opciones` existe porque
sembrar y dar el claim `admin` empezaron juntos —se preparaba el proyecto una
sola vez— y dejaron de estarlo: hoy la siembra se repite cada vez que el código
declara una taxonomía nueva, y exigir un mail para eso obligaba a re-setear un
claim que ya estaba puesto.

**El rebuild se dispara solo**: escribir en `/opciones/*` prende el flag del §8
(`rebuildPorOpciones`), así que los chips del sitio aparecen en la corrida
siguiente sin hacer nada más. Esa mitad ya estaba cubierta (trampa 8).

### Por qué el chequeo no siembra solo

Sería un job desatendido escribiendo en producción, que es otra decisión; y **lo
que falta no siempre es sembrar** — un campo puede estar mal escrito, y sembrarlo
crearía el documento equivocado en vez de mostrar el error. El chequeo dice qué
falta y con qué comando se arregla; la escritura la decide una persona.

> **Pasó de verdad con B-950**, y por eso está escrito. El deploy salió verde —los
> seis pasos del gate, el build real contra el emulador, la suite entera— y producción
> quedó con `/opciones/provincia` **inexistente** y la provincia **obligatoria** en
> el schema: el desplegable sin opciones y el formulario inguardable.
>
> Y al escribir el chequeo apareció que **no eran dos sino doce**: los diez
> vocabularios de las guías (`tipo-lugar`, `incluye-lugar`, `condicion-de-uso`,
> `periodicidad`, `tipo-oferente`, `perfil-editorial`, `incluye-suscripcion`,
> `extras-suscripcion`, `alcance-envio`, `incluye-actividad`) tampoco existían en
> producción, desde que se crearon. Nadie lo había notado porque el **panel** cae
> de vuelta a `opciones-base.json` cuando el documento falta (`leerOpciones`), así
> que ahí se veían bien; el **build** no tiene ese fallback, así que los que
> estaban vacíos eran los chips del sitio y los desplegables de `/guia/*/sumar`.
> Los dos caminos leen el mismo vocabulario y solo uno tenía red.

## Sembrar la geografía de las sedes (B-950, D-710)

**A diferencia del de arriba, este NO es un paso del despliegue.**
`geografiaNormalizada` es el default de lectura y es idempotente, y se aplica en
los cuatro lugares que leen o escriben el documento sin pasar por el formulario
(`toPublic.ts`, `filtrosActividades.ts`, `formADocumento` y
`payloadDeRestauracion`). O sea que un documento sin migrar **se ve y se filtra
bien sin correr nada**.

Lo que este script hace es dejar el **documento** en la forma nueva: la provincia
puesta y la ciudad como slug. Con eso, el historial deja de guardar versiones con
dos formas mezcladas, `searchText` y `ciudades[]` se reescriben derivados de la
forma nueva, y quien mire el documento en la consola de Firebase ve lo mismo que
el sitio.

```bash
npm run geografia:sembrar                                   # informa, en el emulador
npm run geografia:sembrar:prod                              # informa qué escribiría en producción
npm run geografia:sembrar:prod -- --aplicar --produccion    # lo escribe
```

**No adivina la provincia de una ciudad que no sea CABA.** La deduce solo cuando
la ciudad es CABA —que cubre casi todo el catálogo, porque el default del
formulario era `'CABA'` cableado—. Para «Mar del Plata» la provincia la sabe una
persona: una tabla ciudad→provincia sería inventar el dato, y el primer error se
publicaría en el `addressLocality` del JSON-LD. **El script las lista una por
una** al terminar, y se completan reeditando la actividad desde el panel. Hasta
entonces esas sedes no aparecen bajo ningún filtro de lugar del sitio.

> ⚠️ **Esta corrida reescribe los eventos de Calendar, y la de `ciudades` no.**
> `sesiones` no cambia, pero `modalidades` y `sede` son campos que la guarda del
> §7.1 mira, y la dirección del evento lleva la ciudad. Es lo correcto —antes
> decía la ciudad tipeada, ahora la etiqueta— pero es **una llamada a la API de
> Calendar por sesión**. Correrlo una vez, fuera de hora.

Lo demás es igual que el de `ciudades`: sin `--aplicar` solo informa, `--aplicar`
fuera del emulador exige `--produccion`, es idempotente (la segunda corrida no
escribe nada), y deja una versión del §12 por actividad tocada más un rebuild que
el debounce colapsa en uno solo.

Una reserva queda huérfana cuando la actividad que la usaba ya no existe. Pasa en
un caso conocido y acotado: si un admin le cambió la dirección web a la actividad
de un publicador, la reserva queda a nombre del admin y el publicador no la puede
soltar al borrar. Es la dirección en la que el índice falla —un nombre que no se
puede reusar, nunca dos actividades con la misma URL— y este flag la barre.

> **Y ojo con separar «borrar» de «escribir».** La primera versión del script
> mandaba la reserva **desfasada** (la que apunta a otra actividad) a la lista de
> borrar y no a la de escribir: `--reparar` la borraba, nadie la reponía, y la
> pasada dejaba a esa actividad **sin reserva** — el estado que el script existe
> para arreglar. Lo encontró correrlo de verdad contra el emulador, no un test.

Si el script avisa `⚠️ «x» lo usan dos actividades`, eso **ya estaba** en el
catálogo y hay que resolverlo a mano antes de publicar las dos: el índice se queda
con la primera.

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
| Hosting | **lista negra**: se deploya salvo que todo lo que cambió sea provablemente incapaz de afectar el bundle. De `functions/`, cuenta lo que el build importa, derivado del árbol (B-1241) |

La lista negra del hosting es a propósito. El bundle del panel depende de cosas
fuera de `src/` —hoy `functions/calendario.js` por el alias `@calendario`— y una
lista blanca de rutas se pierde ese caso **en silencio**: el build queda verde y
producción se queda con el panel viejo. Con lista negra, un archivo nuevo y
desconocido cae del lado de deployar, que es el error barato.

**Qué de `functions/` arrastra Hosting no se enumera: se deriva del árbol
(B-1241).** Hasta B-1241 el script tenía escritos a mano los cuatro archivos con
alias y se perdía los seis que `src/` importa por ruta relativa: un cambio que
tocara solo `functions/alta-de-opcion.js` deployaba la Function y no el panel, y
los dos caminos del alta de una etiqueta quedaban con versiones distintas en
producción. Ahora, en cada corrida:

1. junta todo literal de ruta relativa que termine en `functions/<archivo>` en
   `src/` y en `astro.config.mjs` —así entran los alias (`new URL('./functions/…')`,
   aunque esté partido en dos líneas) y los imports de `src/lib/*`
   (`'../../functions/slugify.js'`), con cualquiera de las tres comillas;
2. le suma lo que esos archivos importan adentro de `functions/` (`'./geografia.js'`),
   hasta que no aparezca nada nuevo;
3. si alguno importa un paquete (no relativo ni `node:`), suma
   `functions/package.json` y su lock, porque Vite lo resolvería desde
   `functions/node_modules`. Hoy ninguno lo hace.

Si no encuentra `src/`, todo `functions/` cuenta para Hosting. Un comentario que
cite una ruta así entre comillas también entra: sobrar es un deploy de más.
`index.js`, los `*-trigger.js` y el resto de lo que solo usa la Function siguen
sin arrastrar Hosting.

Para ver qué cree el script que es compartido:

```bash
$ ./scripts/que-deployar.sh --compartidos
functions/alta-de-opcion.js
functions/calendario.js
…                                  # diez a la fecha de B-1241
```

`tests/que-deployar.test.ts` compara esa lista contra un recorrido
**independiente** de los imports de `src/` (especificadores de `import`/`from`/
`new URL(` resueltos con `path`, no el `grep` del script): si aparece un import
hacia `functions/` que el script no ve, se pone rojo antes de que un cambio a
ese archivo deploye solo la Function. Los casos de clausura, alias partido,
comillas invertidas y paquete corren sobre árboles sintéticos, con
`QUE_DEPLOYAR_RAIZ` apuntando a un directorio temporal. El script lee el árbol
de la carpeta donde vive, no del directorio desde el que se lo llama.

**Orden:** reglas → hosting → functions. Las reglas primero porque si el panel
nuevo escribe campos que las reglas viejas rechazan, el orden inverso deja una
ventana de escrituras fallidas.

**Los tags son dos y los crea el workflow** — D-510, pedido del dueño el
2026-09-07 («cada push que hacemos tiene que generar un tag y version»):

| Tag | Cuándo | Para qué |
|---|---|---|
| `v1.9.0+a1b2c3d` | **cada push que deploya**. Liviano | Es exactamente la cadena que el panel muestra y que un reporte de bug copia: `git show v1.9.0+a1b2c3d` para pararse en lo que esa persona estaba usando |
| `v1.9.0` | cuando `version` de `package.json` cambia. Anotado | Leer el historial: `git tag --list 'v*.*.*'` los da **sin** los de deploy, porque esos llevan `+` |

Los dos son idempotentes: un re-run del mismo commit no falla por el tag que ya
existe. Y la cadena la compone `scripts/version.mjs` y no el YAML (D-98), con un
test que lo exige — armada a mano, el tag y el panel se separarían en el primer
cambio de formato.

**Ojo con lo que ya funcionaba:** la *versión* del panel cambia en cada push desde
siempre (`1.9.0+<sha>`), y es de eso que depende la detección de «pestaña vieja».
Lo que faltaba era el tag.

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

### El CORS del bucket (B-1235a, B-1321)

**Es un paso de consola y no viaja con ningún deploy.** `cors.json`, en la raíz,
declara que el bucket de imágenes deja **leer** sus bytes con JavaScript desde los
cuatro orígenes del sitio (`GET` y `HEAD`, nada más). Pero un archivo en el repo
no configura nada: lo que manda es la config aplicada al bucket, y esa se aplica
a mano.

**Qué hace, y por qué hace falta.** Sin CORS, la respuesta con los bytes
(`alt=media`) no trae `Access-Control-Allow-Origin`, y el `fetch` con el que
`promoverImagenDePropuesta` baja la foto de una propuesta para subirla a
`imagenes/` falla en el navegador con «Failed to fetch»: la propuesta se
convierte **sin su flyer** (B-1235). No abre nada nuevo: esos bytes ya los lee
cualquiera con la URL — un `<img>` no necesita CORS, y por eso en la bandeja la
foto se ve. Solo habilita que **el JavaScript del sitio** los lea.

Desde la raíz del repo, con una cuenta que pueda editar el bucket:

```bash
gcloud storage buckets update gs://agenda-literaria.firebasestorage.app \
  --cors-file=cors.json

# lo que quedó aplicado
gcloud storage buckets describe gs://agenda-literaria.firebasestorage.app \
  --format="default(cors_config)"
```

**Se aplicó el 2026-09-23** (lo hizo el dueño: el modo automático no deja a un
agente cambiar la config de un recurso compartido).

**Cuándo hay que reaplicarlo:**

- **cambió `cors.json`** — un origen nuevo no existe hasta que se aplica;
- **cambió o se sumó un dominio** del sitio: primero va a `cors.json`, después
  se aplica. Es la misma lista que los dominios autorizados de Auth
  (§ «Los dominios autorizados de Auth»), y se desincroniza igual;
- **hay un bucket nuevo** — otro proyecto, o uno recreado desde cero (§
  «Preparar un proyecto desde cero»): el CORS es del bucket y no se hereda;
- **alguien lo tocó desde la consola**, que es lo que el chequeo de abajo
  detecta.

**Cómo se verifica.** Nada de lo que corre solo lo puede ver: el emulador no
aplica el CORS del bucket, así que la suite y el gate andan igual con o sin él, y
el test de `cors.json` mira el archivo. Hay que preguntarle al bucket:

```bash
npm run cors:verificar

# contra otro origen del sitio, para tomar la imagen de su events.json
SITIO=https://agenda-literaria.web.app npm run cors:verificar
```

`scripts/cors-del-bucket.mjs` baja `events.json` del sitio publicado, toma la
primera imagen servida por el bucket de `.env.production` y hace un `GET` con
`Origin:` por **cada** origen de `cors.json` —se derivan del archivo, así que uno
nuevo se verifica solo—, exigiendo que vuelva `Access-Control-Allow-Origin` con
ese origen. Suma un **control negativo**: desde un origen `.invalid` que el
archivo no declara, la cabecera **no** tiene que venir; si viene, el bucket tiene
otra configuración (un `*`, o una escrita a mano) y `cors.json` dejó de
describirlo. Solo lee, y sin credenciales: la imagen es pública. Sin red o sin
imágenes del bucket en `events.json` informa `— saltado`, que no es verde.

A mano es lo mismo con `curl`, con cualquier imagen de `events.json`:

```bash
curl -s -o /dev/null -D - -H 'Origin: https://agendaleh.ar' \
  'https://firebasestorage.googleapis.com/v0/b/agenda-literaria.firebasestorage.app/o/imagenes%2F<id>.png?alt=media' \
  | grep -i access-control-allow-origin
# access-control-allow-origin: https://agendaleh.ar
```

**No está enganchado a ningún workflow, y es una decisión.** Pega contra
producción y contra el CDN de Storage: en `deploy.yml` sería un paso que frena la
publicación de todo lo cargado por algo que el build no cambia, y que se pone
rojo cuando falla la red — el gate que enseña a saltear los gates (B-180). Es la
misma razón que deja afuera a `verificar-produccion.mjs`, y la opuesta a la que
mete a `taxonomias-en-produccion.mjs`, que usa la credencial del build y no puede
fallar por algo que el build no necesite. Además el CORS no se rompe con un
deploy: se rompe en la consola, y un chequeo por deploy tampoco lo vería a
tiempo. Se corre **después de aplicarlo**, al cambiar de dominio, y cuando una
conversión de propuesta con foto termine sin flyer. Tests del chequeo:
`tests/cors-del-bucket.test.ts`, sin red.

### Functions

```bash
firebase deploy --only functions:syncCalendar,functions:rebuildPorOpciones
# B-901 — el rebuild del primer directorio de la Guía, misma forma que el de
# `/opciones/*`. El push a `main` ya la cubre; esto es para desplegarla sola.
firebase deploy --only functions:rebuildPorLibrerias
# B-832 — y el del segundo directorio. Uno por colección: Firestore no matchea un
# comodín en el segmento de colección.
firebase deploy --only functions:rebuildPorSuscripciones
# B-833 — y el del tercero. Acá el rebuild es además lo que hace efectivo apagar
# `direccionPublica`: sin él, la dirección de una casa sigue publicada después de
# bajar la casilla (§ 6 del PRD 4).
firebase deploy --only functions:rebuildPorLugares
```

> **Este deploy NO reescribe eventos** (B-1145, D-763), a diferencia de
> `npm run geografia:sembrar:prod`. La guarda anti-loop compara **dos recálculos
> con el mismo código desplegado** —`construirEvento(antes)` contra
> `construirEvento(despues)`—, no el payload contra uno guardado, así que un
> cambio de formato en la descripción no produce **ninguna** operación hasta que
> el documento se escriba por otro motivo. El reverso es que tampoco corrige los
> eventos ya publicados, y eso está decidido: **B-1181**, descartado el
> 2026-09-22.

### Los tres vocabularios nuevos de los lugares (B-833)

Lo mismo que abajo, con `tipo-lugar`, `incluye-lugar` y `condicion-de-uso`. El
mismo comando (`node scripts/preparar-produccion.mjs <email>`) y el mismo modo de
falla si no se corre: la ficha se publica y muestra el slug crudo.

**Y acá hay una consecuencia que en los otros dos no había, y conviene tenerla
escrita:** `tipo-lugar` es el vocabulario del que sale el default de
`direccionPublica` (§ 6 del PRD 4). Sin el documento sembrado, el desplegable
nace vacío y quien cargue un lugar va a tener que tipear el tipo con «Otro» — con
lo cual `casa` puede quedar como `Casa` o como `casa-particular`, que **no** están
en `TIPOS_SIN_DIRECCION_PUBLICA` y por lo tanto se llevan el default permisivo. No
es una falla del código —la lista no puede prometer cubrir un tipo que alguien
invente, y está dicho en su docblock— pero sí es un motivo más para correr este
paso antes de cargar el primer lugar.

### Los seis vocabularios nuevos de las suscripciones (B-832)

**Un paso que no es un deploy y que hay que correr igual.** `periodicidad`,
`tipo-oferente`, `perfil-editorial`, `incluye-suscripcion`, `extras-suscripcion` y
`alcance-envio` son documentos de `/opciones/*`, y salen de
`src/lib/opciones-base.json` — que `preparar-produccion.mjs` recorre **entero** y
siembra de forma **idempotente**: no pisa lo que ya existe (§ «Idempotencia en los
scripts»).

```bash
node scripts/preparar-produccion.mjs <email>
```

**Si no se corre, no se rompe nada y eso es lo incómodo:** la ficha se publica
igual y muestra el **slug** crudo en vez de la etiqueta —«mensual» en lugar de
«Mensual», «no-dice» en lugar de «No lo dice»—, porque resolver una etiqueta cae
al slug cuando el documento de opciones no está (D-30). Se ve, pero se ve en el
sitio y no en ningún log.

**El estado y la cuenta viven en [`02-infraestructura.md`](02-infraestructura.md#cloud-functions-v2),
no acá** — ahí se relevan contra GCP, una por una. Esta línea decía «las ocho
Functions están desplegadas y ACTIVE» y **ya era falsa**: el relevamiento del
2026-09-03 que la respalda listaba ocho, y desde entonces se escribieron cinco más
(las cuatro de B-838/B-878/B-901 y `rebuildPorSuscripciones`, B-832). Es la misma
cicatriz que aquel documento ya tiene anotada, un archivo más abajo: **un número
repetido en dos lugares envejece en el que nadie mira**. Lo que sigue valiendo acá
es la operación y no el conteo: un `firebase deploy --only functions` sin filtro
las despliega **todas** y hoy no rompe nada, porque ninguna depende de un secreto
que falte.

> **Acá decía «lo que sí queda pendiente es redesplegar esas dos», y era falso.**
> El texto era del 2026-08-25: afirmaba que `syncCalendar` y `rebuildPorOpciones`
> corrían en producción en su versión vieja, con la consecuencia concreta de que
> `syncCalendar` podía duplicar un evento y `rebuildPorOpciones` no publicaba
> `destacado`. **D-132 lo resolvió tres días después** —le dio a `deploy-ci@` los
> roles para desplegar Functions desde CI— y desde entonces cada push que toca
> `functions/` las redespliega solas: hubo 16 de esos pushes. Nadie volvió a leer
> este párrafo, así que la advertencia siguió asustando durante nueve días sobre
> algo que ya estaba arreglado. Es el costo de escribir un pendiente sin dejar
> escrito cómo se verifica que dejó de serlo — por eso ahora el estado de arriba
> lleva el comando de relevamiento al lado.

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

#### Estado: desplegada y barrida el 2026-09-03

**`optimizarImagen` está viva en `southamerica-east1` desde el 2026-09-03**, con
los tres permisos otorgados por el dueño ese mismo día, y el barrido corrido
sobre el bucket entero.

| | |
|---|---|
| Objetos en `imagenes/` | **49** |
| Peso de los originales, antes | **7077,6 KB** |
| Peso de los originales, después | **4022,5 KB** (−43 %) |
| Ya optimizados en la segunda corrida en seco | **49 de 49**, 0 a reescribir |
| `Cache-Control` de lo que sale | `public, max-age=31536000, immutable` |

**El −43 % de los originales lo aportan los PNG, no los JPEG**, tal como D-175
había medido: el objeto de muestra que se verificó a mano —un JPEG de 75.285
bytes— salió del barrido **con el mismo peso**, porque no llegaba al
`AHORRO_MINIMO` del 5 %, y su miniatura quedó en 36.299 bytes.

**Y esto es lo que habilita el `srcset` de B-320, en ese orden y no al revés.**
Antes del barrido la miniatura de cada afiche daba **404** —verificado contra
producción— y un candidato de `srcset` que no existe **no degrada al `src`**: la
imagen queda rota. Con las 49 en su lugar, la salida tiene de dónde servir.

#### Después del deploy: el barrido de las que ya estaban

`onObjectFinalized` corre cuando un objeto **se escribe**, así que las 30
imágenes que ya están en el bucket no pasaron por el pipeline: no tienen
miniatura y siguen pesando lo que pesaban. Es lo que arregla el barrido, y es
**el paso que cierra B-300 en producción**.

```bash
# 1 · Ver qué haría (no escribe nada). El default es este.
node scripts/optimizar-imagenes.mjs

# 2 · Aplicarlo. En producción hace falta `--produccion` explícito (B-630): un
#     `--aplicar` sin `FIREBASE_STORAGE_EMULATOR_HOST` seteado reescribiría
#     TODOS los objetos del bucket con el `sharp` de esta máquina y no el de la
#     Function, y ese olvido pasa justo cuando se lo quiere probar «contra el
#     emulador primero». Sin el flag, aborta.
node scripts/optimizar-imagenes.mjs --aplicar --produccion

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

### `limpiarImagenesHuerfanas` — el barrido de huérfanas (B-221)

Nadie borraba las imágenes propias que quedaban huérfanas en Storage: la fila
salía de la galería, o la actividad se borraba, y el objeto se quedaba en el
bucket para siempre. Esta Function programada (`functions/imagenes-limpieza-trigger.js`)
lo resuelve: cada 24 horas cruza los `storagePath` que las actividades
referencian **hoy** —sin filtrar por `estado`: un borrador sigue siendo dueño
de su imagen— contra los objetos de primer nivel en `imagenes/` y
`miniaturas/`, y borra los que ya nadie referencia.

**Por qué esperó hasta ahora, y no es que no se supiera cómo.** B-221 estaba
bloqueado hasta que `optimizarImagen` (B-220) estuviera desplegada y su barrido
inicial hubiera corrido: mientras el reescritor de B-220 no había pasado por el
bucket, no había forma de distinguir «huérfano» de «original que todavía no se
optimizó». Con `optimizarImagen` viva y barrida desde el 2026-09-03 (ver más
arriba), la precondición ya está.

**La decisión de qué borrar es pura y vive en `functions/limpieza-imagenes.js`**
(`decidirLimpieza`) — el mismo corte que `imagenes.js`/`imagenes-trigger.js`:
lo que decide se puede probar sin tocar Storage ni Firestore. Está en
`tests/limpieza-imagenes.test.ts`, con cada guarda mutada y vista fallar.

**No es la trampa 12, y hay que poder decirlo con algo más que "confiá".** El
trigger que sí escucha el bucket (`optimizarImagen`) se dispara con
`onObjectFinalized` — creación o sobreescritura. Este barrido corre por
`onSchedule` (un reloj) y lo único que hace sobre el bucket es **borrar**, y
`delete()` no dispara `onObjectFinalized` — dispara `onObjectDeleted`, al que
nada de este proyecto está suscripto. Sin un segundo trigger escuchando el
borrado, no hay con qué encadenarse. El razonamiento completo está en el
docblock de `limpieza-imagenes.js`.

**Dos salvaguardas, además de eso:**

- **Margen de gracia de 72 horas** (`MARGEN_DE_GRACIA_MS`): un objeto que no
  esté referenciado pero se haya creado hace menos de 72 horas no se toca. Sin
  esto, subir una imagen y no llegar a guardar la actividad todavía —o
  guardarla mientras el barrido corre en el medio— la borraría.
- **Tope de 20 borrados por corrida** (`MAX_BORRADOS_POR_CORRIDA`), misma clase
  de salvaguarda que `MAX_EVENTOS_RESYNC` en `index.js` (B-04): un bug en la
  lectura de `/actividades` no puede vaciar el bucket entero de una sola
  pasada. Lo que sobra queda marcado en el log y se retoma en la corrida
  siguiente.

**IAM: no hace falta nada nuevo.** Corre con la misma `calendar-sync@` y los
mismos permisos de `optimizarImagen` (ver arriba): `roles/storage.objectUser`
ya incluye `storage.objects.delete`, así que no hay un cuarto paso de IAM que
otorgar.

**Probarlo antes de confiar en el reloj — nunca contra producción (§10 del
`CLAUDE.md`):**

```bash
# En seco: lista qué borraría, no borra nada. Es el default — funciona contra
# el emulador o contra producción, sin ninguna guarda extra: no escribe nada.
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199 \
  node scripts/limpiar-imagenes-huerfanas.mjs

# Aplicarlo de verdad, siempre contra el emulador primero:
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199 \
  node scripts/limpiar-imagenes-huerfanas.mjs --aplicar

# --aplicar en producción exige el flag de más, a propósito: sin
# FIREBASE_STORAGE_EMULATOR_HOST seteado, `--aplicar` solo aborta y no borra
# nada — es la guarda contra el olvido de exportar la variable (la encontró
# el auditor-trampas).
node scripts/limpiar-imagenes-huerfanas.mjs --aplicar --produccion
```

El script reusa la misma `decidirLimpieza` que la Function — no hay una
segunda copia de la decisión — y sirve además para correr el barrido a mano
sin esperar el próximo tick del reloj, o para verlo en seco contra producción
antes de confiar en que la corrida programada hizo lo esperado.

**Residual conocido, anotado para quien retome esto.** El barrido cruza contra
los `storagePath` de los documentos **en vivo** de `/actividades`, no contra
`/actividades/{id}/versiones/*` (§12). Restaurar una versión vieja que
referenciaba una imagen ya barrida restauraría una `url` rota. No se resolvió
acá — el ítem original de B-221 solo pedía cruzar contra las actividades — y
quedó anotado en el `BACKLOG.md` como **B-560**.

### `limpiarVersionesHuerfanas` — el barrido de versiones huérfanas (B-89)

`borrarActividad` es un `deleteDoc`, y Firestore **no borra subcolecciones**: las
hasta 20 versiones de `/actividades/{id}/versiones/*` (§12) quedaban para siempre
después de borrar la actividad, con copias completas del documento —`online.url`
y `difusion` incluidos— y sin ninguna forma de llegar a ellas desde el panel. No
era una fuga (las reglas limitan la lectura al claim `admin` igual que antes),
pero era basura que crece y datos internos que sobreviven a la decisión de borrar.

Esta Function programada (`functions/versiones-limpieza-trigger.js`) las purga
cada 24 horas.

**Por qué no es el `onDocumentDeleted` que B-89 proponía**, y esto es lo que hay
que entender antes de tocarlo: el borrado de una actividad **escribe** una versión
(`guardarVersionAlBorrar`, B-41), y esa versión es la única de la que se puede
recuperar la actividad entera. Un segundo trigger sobre el mismo borrado la
borraría —y encima en carrera con el primero, porque el orden entre dos triggers
del mismo evento no está definido—: el arreglo de B-89 habría dejado inerte al de
B-41. De ahí el reloj: el barrido tiene que correr *más tarde*, no en el momento.

**Cómo encuentra las huérfanas.** `listDocuments()` sobre `/actividades` devuelve
las referencias de la colección **incluidas las de documentos que no existen pero
tienen subcolecciones** —los "fantasmas" que deja un `deleteDoc`—, que es
justamente lo que ninguna query puede ver. La diferencia contra los ids que sí
existen son los huérfanos. Es una promesa de la API de Firestore y no del código
de este repo, así que está verificada contra el emulador en
`tests/limpieza-versiones.test.ts` y no se asume.

**La decisión de qué purgar es pura y vive en `functions/limpieza-versiones.js`**
(`decidirPurga`) — el mismo corte que `limpieza-imagenes.js`. Dos salvaguardas:

- **Margen de rescate de 30 días** (`MARGEN_DE_RESCATE_MS`), contado desde la
  versión **más nueva** de la subcolección — que para una actividad borrada es el
  instante del borrado. Es el tiempo que se le da al «la borré sin querer». Una
  versión con la fecha ilegible **bloquea** la purga de esa actividad: falla
  cerrado, porque lo que está en juego es la única copia de algo ya borrado.
- **Tope de 20 actividades por corrida** (`MAX_ACTIVIDADES_POR_CORRIDA`), misma
  clase de salvaguarda que `MAX_EVENTOS_RESYNC` (B-04): un bug en la lectura de
  qué actividades existen no puede borrar el historial de todas de una pasada. El
  corte es por actividad y no por documento a propósito — media subcolección
  huérfana es peor que la entera.

**No es la trampa 3 ni la 12.** Los dos triggers que escuchan actividades
(`syncCalendar`, `guardarVersion`) están suscriptos a `actividades/{id}`, no a su
subcolección, y un trigger de documento no se dispara con escrituras en
subcolecciones. Nada escucha `versiones/{version}`. Sin un trigger del otro lado,
no hay con qué encadenarse — y como el de imágenes, corre por reloj y solo borra.

**IAM: no hace falta nada nuevo.** Corre con `calendar-sync@` y solo necesita
`datastore.user`, que ya tiene (D-06). Es una Function más en el mismo deploy:

```bash
firebase deploy --only functions:limpiarVersionesHuerfanas
```

**Cómo verificar la primera corrida.** Con el script en seco (**B-630**, el
espejo del de imágenes) o por logs:

```bash
# En seco: lista qué purgaría con el motivo de cada caso, no borra nada. Es el
# default. Informa lo MISMO que haría la Function, incluido lo que dejaría para
# la corrida siguiente por el tope de 20 actividades.
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
  node scripts/limpiar-versiones-huerfanas.mjs

# Aplicarlo de verdad, siempre contra el emulador primero:
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
  node scripts/limpiar-versiones-huerfanas.mjs --aplicar

# --aplicar en producción exige el flag de más, a propósito: sin
# FIRESTORE_EMULATOR_HOST seteado, `--aplicar` solo aborta. Acá la guarda vale
# más que en el de imágenes: lo que se borra es la ÚNICA copia de una actividad
# que ya no existe (§12).
node scripts/limpiar-versiones-huerfanas.mjs --aplicar --produccion

# Y lo que la Function decidió, cuando ya corrió sola:
gcloud functions logs read limpiarVersionesHuerfanas \
  --region southamerica-east1 --project agenda-literaria --limit 50
```

El script reusa la misma `decidirPurga` que la Function —no hay una segunda copia
de la decisión, y `tests/guardas-de-los-scripts.test.ts` lo exige— así que mirarlo
en seco antes de confiar en la corrida programada prueba algo. Verificado a mano
contra el emulador el 2026-09-07: sembrada una huérfana de 40 días y otra de 5, el
script marca `[PURGAR] … huerfana-vencida` solo la primera, deja la otra en
`dentro-del-margen-de-rescate`, `--aplicar` borra sus dos versiones, la corrida
siguiente ya no la ve, y `--aplicar` sin el host del emulador aborta con código 1.

Un `barrido de versiones huérfanas: nada para purgar` con `motivos` lleno de
`dentro-del-margen-de-rescate` es el estado normal en el mes siguiente a un
borrado. Si aparece `sin-fecha-legible`, hay una versión con el `guardadoEn`
roto y conviene mirarla antes de que el margen deje de importar.

### La imagen de una propuesta (B-830 paso 8, DEC-11)

DEC-11 dice que quien propone **puede subir el flyer** —pedirle que lo hostee en
algún lado para poder pegar una URL es pedirle que resuelva un problema nuestro, y
el que no pueda no manda la foto— **y que si la propuesta se descarta, la imagen
se borra**. Eso es un objeto en el bucket cuyo ciclo de vida no lo decide una
persona sino el estado de su documento. Las cuatro piezas:

| Momento | Qué pasa | Dónde |
|---|---|---|
| **Sube** | a `propuestas/prop_<uuid>.jpg`, con el mismo tope de 3 MB y los mismos dos tipos que la galería, **por la callable** `subirFlyerDePropuesta`: exige App Check, sanea del lado del servidor y escribe con el Admin SDK. `storage.rules` tiene el `create` en `if false` para todo cliente desde B-896 | `functions/flyer-de-propuesta.js` + `-trigger.js` |
| **Se mira** | solo un admin, y solo por su ruta: `get: esAdmin()`, `list: false` | ídem |
| **Se acepta (1/2)** | el panel la baja y la vuelve a subir a `imagenes/` por `subirImagen`, y **no borra nada** | `src/lib/subir-imagen.ts` |
| **Se acepta (2/2)** | al guardarse la actividad, se verifica que la copia esté y recién ahí se borra el original (**B-863**) | `borrarImagenAlCerrar` |
| **Se rechaza** | se borra en el acto | `borrarImagenAlCerrar` |
| **Se aceptó sin copia y la foto llegó después** | al día siguiente, verificada la copia, se borra el original (**B-1370**) | `borrarPropuestasVencidas` |
| **Nadie decide** | a los 30 días se va con el documento | `borrarPropuestasVencidas` |

**Aceptar son dos filas y no una, y ése es todo el contenido de B-863.**
«Convertir» son dos momentos (D-600): al apretar el botón se promueve la copia y
se abre el formulario **sin escribir nada**, y recién cuando la actividad se
guarda la propuesta pasa a `aceptada`. Si el original se borrara en el primer
momento y el admin abandonara el formulario, la copia promovida —huérfana— se la
lleva `limpiarImagenesHuerfanas` a las 72 horas y la propuesta se queda **sin
flyer sin haber sido aceptada nunca**. El trigger acierta el momento por
construcción: la transición a `aceptada` **es** «la actividad ya se guardó».

Y el orden adentro del segundo momento también está decidido: **se verifica que
la copia exista —en el documento de la actividad y en el bucket— y recién después
se borra el original**. Si el borrado falla queda un duplicado, que es inofensivo;
al revés se pierde la foto de un tercero y no hay de dónde sacarla. Cuando la
verificación no pasa —la actividad se guardó sin ninguna imagen propia— el
original **se conserva** y sale un `warn` con `alerta: "flyer-de-propuesta-sin-borrar"`:
eso es **B-871**, porque la `aceptada` no vence y nadie más va a pasar por ahí.

**La callable no necesita IAM nuevo, y conviene que esté dicho para que no se
busque.** Corre como `calendar-sync@` (`CUENTA_DE_SERVICIO` de
`functions/despliegue.js`), y para escribir el objeto necesita
`storage.objects.create` sobre el bucket: es el mismo permiso que ya usa
`optimizarImagen`, y viene en el `roles/storage.objectUser` que se otorgó para
ella (§ «`optimizarImagen`», arriba). Tampoco hay que tocar la consola de App
Check: `enforceAppCheck: true` es por función y no depende del `ENFORCED` de
ningún servicio (ver `02-infraestructura.md` § App Check). B-908.

### Cuando suena `flyer-de-propuesta-sin-borrar`

Son **ocho** caminos, todos con el mismo estado del mundo —una propuesta
`aceptada` con su flyer original vivo en `propuestas/`, y ningún barrido que vaya
a pasar por ahí— y por eso comparten el campo `alerta`. Se distinguen por el
`resultado` (cuando el borrado se intentó) o por el `motivo` (cuando la decisión
ni siquiera llegó a intentarlo):

| `resultado` / `motivo` | Qué pasó | Qué hacer |
|---|---|---|
| `sin-copia` | la actividad se guardó sin ninguna imagen propia (la promoción falló y el panel avisó, o el admin sacó la fila) | decidir si la foto se usa. Si se usa, subirla a la actividad desde el panel: el original lo borra solo la corrida siguiente de `borrarPropuestasVencidas` (**B-1370**). Si no, borrar el objeto a mano |
| `copia-sin-objeto` | el documento nombra una copia que ya no está en el bucket (el formulario quedó abierto más de 72 horas y `limpiarImagenesHuerfanas` se la llevó) | volver a subir la foto a la actividad desde el panel; el original lo borra solo la corrida siguiente (**B-1370**) |
| `sin-actividad` | el `revision.actividadId` apunta a una actividad que no existe (se borró, o se marcó a mano con un id equivocado) | buscar la actividad que salió de la propuesta; si no hay, borrar el objeto a mano |
| `objeto-ajeno` | el `storagePath` no está bajo `propuestas/<un segmento>`. **No es un caso de operación: es un bug o un documento escrito a mano** | **no borrar nada** hasta saber a quién apunta ese path. La guarda existe justamente porque puede ser el flyer de una actividad publicada |
| `aceptada-sin-actividad` | la propuesta quedó `aceptada` sin `revision.actividadId` (se la marcó a mano) | ídem `sin-actividad` |
| `imagen-fuera-del-prefijo` | mismo desajuste que `objeto-ajeno`, detectado antes de intentar nada | **no borrar nada**, mismo motivo |
| `descartada` con un `error` | **B-926** — quien revisó eligió «No usarla» al convertir y el borrado del original falló. Es el único camino donde el borrado se intentó **sin** verificar copia, porque no hay ninguna: la decisión ya la tomó una persona mirando la foto | reintentar el borrado a mano. Acá **no hay nada que decidir**: la foto ya se descartó a propósito, así que el objeto sobra |
| `motivo de borrado desconocido` | **B-926** — el vocabulario de `motivo` creció y el trigger no conoce el valor nuevo, así que **no borró nada**. Hoy es inalcanzable: `decidirBorradoDeImagen` solo devuelve los tres literales que la cadena reconoce. Existe para que agregar un cuarto motivo y olvidarse de su rama sea un aviso y no un borrado silencioso | mirar qué `motivo` devolvió `decidirBorradoDeImagen` y agregarle su rama. Mientras tanto el original está vivo, que es el lado seguro |
| un `error` en vez de un `warn` | falló la lectura de la actividad o el `delete` | reintentar el borrado a mano; si se repite, mirar el IAM de `calendar-sync@` |

**Y «a mano» es literal, porque no hay botón**: `storage.rules` cierra el
`delete` de `propuestas/` para todo cliente, y `borrarPropuestasVencidas` no
alcanza a la aceptada. Se borra desde la consola de Storage, o con
`gsutil rm gs://<bucket>/propuestas/prop_<uuid>.jpg`. Que esto sea manual es
justamente **B-871**.

> **De dónde sacar el path, que no es el mismo lugar en los siete.** Los cuatro
> primeros son `resultado`, y ahí el log trae el campo `objeto` con el path
> exacto. Los tres que salen por `motivo` vienen de la rama que **decidió no
> hacer nada**: el log trae `propuesta` y `motivo`, y **no** `objeto` — porque
> en esos casos el path o no existe o es justamente el que no sabemos de
> quién es, y ponerlo en el log invitaría a copiarlo a un `gsutil rm`. Hay que
> abrir la propuesta por su id y mirar su `imagen.storagePath` antes de tocar
> nada.

**Para el backfill de lo que ya está aceptado antes de este deploy** —el trigger
actúa solo en la **transición**, así que una propuesta que ya estaba en
`aceptada` no lo despierta nunca—: `node scripts/borrar-propuestas-vencidas.mjs`
**sin `--aplicar`**, y mirar la segunda lista del informe, la de
§ «Flyers que no borra nadie» de más abajo.

> ⚠️ **Esto decía otra cosa y era falso** (corregido con **B-871**). Decía que
> el chequeo era mirar la primera lista del script y buscar «una línea
> `aceptada-no-vence` con un `propuestas/…` al lado». Esa línea **no puede
> aparecer nunca**: la query del barrido trae `ESTADOS_QUE_CADUCAN` y la
> `aceptada` queda afuera por definición, así que el chequeo documentado daba
> siempre «no hay ninguno» — verde sobre exactamente el caso que existía para
> encontrar. La lista nueva entra por el **bucket** y por eso sí lo ve.

> ⚠️ **Paso manual pendiente del renombre.** Hasta B-863 este trigger se llamaba
> `borrarImagenAlRechazar`. Si CI llegó a desplegarlo con ese nombre, la Function
> vieja **sigue desplegada** después del push: hay que borrarla a mano con
> `firebase functions:delete borrarImagenAlRechazar --region southamerica-east1`.
> Mientras tanto no rompe nada —las dos hacen el mismo borrado idempotente en el
> rechazo, y solo la nueva actúa en la aceptación—, pero es una Function fantasma
> cobrando invocaciones. Verificar con `firebase functions:list`.

### Flyers que no borra nadie (B-871)

`node scripts/borrar-propuestas-vencidas.mjs` **sin `--aplicar`** imprime, al
final, una segunda lista que no sale de la retención: **los objetos que hoy
existen bajo `propuestas/`**, cruzados contra los documentos que los nombran.

Es el «pasa alguien» que a esta foto le faltaba. El borrado del original de una
aceptada ocurre **una sola vez**, en la transición, y debajo no hay red: la
`aceptada` no vence y `limpiarImagenesHuerfanas` no recorre este prefijo. La
lista entra por el bucket y no por las transiciones, así que encuentra los siete
caminos por igual — incluido el séptimo, el que no emite ningún log porque la
propuesta ya estaba aceptada antes del deploy.

| Motivo | Qué es | Qué hacer |
|---|---|---|
| `aceptada-sin-plazo` | el flyer de una propuesta aceptada sigue vivo: el borrado no ocurrió, o la decisión correcta fue no borrarlo (`sin-copia`) | mirar el `warn` de esa propuesta en la tabla de arriba, que dice cuál de los seis caminos fue, y seguir su fila. **El script no lo borra** |
| `sin-propuesta` | ningún documento nombra ese objeto: un `/proponer` abandonado después de subir la foto, o la mitad que sobrevivió a un borrado cortado por la mitad | no hay a quién preguntarle ni desde dónde volver a encontrarlo. Borrarlo a mano es lo correcto una vez confirmado que no es reciente |
| `de-una-que-caduca` | lo nombra una `nueva`, `en-revision` o `rechazada`, **y esa propuesta se puede fechar** | **nada**: el barrido de retención va a pasar por ese documento y se lleva las dos mitades |
| `sin-fecha-legible` | lo nombra una propuesta de un estado que caduca, pero **sin ninguna fecha legible** con la que contar el plazo | el barrido **no la borra nunca** (falla cerrado, con el mismo motivo del otro lado), así que su flyer tampoco tiene quien lo borre. Hay que arreglarle la fecha al documento —`creadoEn`, o `revision.en` si está rechazada— y dejar que el barrido haga el resto |
| `recien-subido` | el **objeto** tiene menos de 72 h, o su fecha de creación no se pudo leer (nada que ver con `sin-fecha-legible`, que habla de la fecha del **documento**) | **nada**: `/proponer` sube el archivo al elegirlo y escribe el documento al enviar, así que lo normal es que todavía no tenga dueño. Falla cerrado, como los otros dos barridos |
| `fuera-del-alcance` | no está bajo `propuestas/<un segmento>` | **no tocar**. Es la misma guarda de `objeto-ajeno`: puede ser el flyer de una actividad publicada |

**La lista informa y no borra, tampoco con `--aplicar`.** Hay **un** caso que
desde B-1370 sí se borra solo, y no desde acá: la aceptada cuya actividad **ya
tiene** su copia viva (`con-copia-con-original` en
`scripts/flyeres-de-propuestas-aceptadas.mjs`) lo resuelve
`borrarPropuestasVencidas`, ver § «El original que sobra cuando la foto llega
después». Para el resto, lo que falta para automatizarlo es una decisión de
producto: qué pasa con la aceptada que conservó
su original **a propósito** (el caso `sin-copia`, donde no borrar es lo correcto
porque perder la foto no se deshace). Mientras esa respuesta no exista, un
barrido automático o borraría justo esa foto o tendría una excepción que no
alcanzaría nunca a ninguna de las otras.

Dos detalles de operación:

- **La lista de arriba puede venir recortada y ésta no.** La de la retención
  corta apenas junta las 50 del tope (B-865); ésta lee la colección entera. Así
  que un `sin-fecha-legible` puede aparecer acá sin su línea gemela arriba en la
  misma corrida — el dato es correcto igual, pero conviene saberlo antes de
  buscar el par que no está.
- **Corre con Firestore y Storage apuntando al mismo lado.** Si uno está en el
  emulador y el otro en producción, el script **no releva** y lo dice: cruzar los
  documentos de un lado con los objetos del otro daría todo como `sin-propuesta`,
  o sea un informe que inventa un problema enorme.
- **No está en el barrido diario, y es a propósito.** La lectura que necesita es
  la colección `/propuestas` entera —hay que saber si *alguien* nombra cada
  objeto—, que es justo lo que B-865 acaba de sacar del camino diario. Va a
  pedido, y pasa a ser automático el día que la decisión de arriba exista. (El
  barrido de B-1370 **sí** es diario porque entra al revés: lista `propuestas/`
  y busca solo los documentos que nombran esos objetos, así que su costo crece
  con los flyers vivos y no con el archivo histórico.)

### El original que sobra cuando la foto llega después (B-1370)

El caso de B-1322 tal como pasó dos veces en producción: la actividad se guardó
sin foto, la propuesta pasó a `aceptada` segundos después (`sin-copia`, original
conservado) y la foto se subió a mano minutos más tarde. El trigger decide una
sola vez, así que no volvía a mirar.

Desde B-1370 lo mira `borrarPropuestasVencidas` todos los días, después de la
retención y en su `finally` (corre aunque la retención no tenga nada que borrar,
y aunque falle). Hace cuatro cosas, en este orden:

1. lista los objetos de `propuestas/` y busca, de a 30 por `in`, los documentos
   que los nombran; se queda con los `aceptada`;
2. los clasifica con `clasificarAceptadas` —**la misma** función que imprime el
   script de B-1322, que ahora vive en `functions/propuestas.js`—;
3. para cada fila `con-copia-con-original` (y **solo** ésas), relee la propuesta
   y exige que siga `aceptada` con el mismo original, la misma actividad y sin
   `fotoDescartada`;
4. borra con `borrarOriginalAlAceptar`, que vuelve a verificar la copia en el
   documento y en el bucket (B-863) antes de tocar nada.

| Log | Qué es | Qué hacer |
|---|---|---|
| `original de una aceptada borrado: la actividad ya tiene su copia` | el caso feliz, con `propuesta` y `objeto` | nada |
| `original de una aceptada no borrado: cambió en el medio de la corrida` | entre la clasificación y el borrado la propuesta cambió (`cambio-la-propuesta`, `ya-no-esta`) o la verificación ya no encontró la copia (`sin-copia`, `copia-sin-objeto`) | nada: el original sigue vivo y la corrida de mañana lo vuelve a mirar |
| `no se pudo borrar el original de una aceptada con copia` | falló la lectura o el `delete` | nada si es aislado (mañana reintenta); si se repite, mirar el IAM de `calendar-sync@` |
| `originales de aceptadas: barrido terminado` | el resumen, con `borrados`, `fallidos`, `porTope` y `pendientes` (id → caso de los que **no** se borran solos) | si `pendientes` no está vacío, seguir la fila de su caso en el script de B-1322 |

**Sin `alerta`**, a diferencia de `flyer-de-propuesta-sin-borrar`: ese campo es
para los caminos que nadie más va a revisar, y éste se revisa solo cada 24 horas.
Tope de 50 borrados por corrida (`MAX_ORIGINALES_POR_CORRIDA`). Sin IAM nuevo:
es la misma Function, con el mismo `storage.objects.delete`. **Entra en vigor
con el deploy de Functions.**

**Por qué un barrido y no un trigger sobre `/actividades`** está en D-890: un
tercer `onDocumentWritten` sobre esa colección tendría que buscar en cada
escritura de cada actividad qué propuesta la originó —la actividad no lo
guarda—, y sería una pieza más a un write-back de distancia de la trampa 3. Un
día de demora sobre una foto que ya estaba duplicada no le cambia nada a nadie.

**Por qué se re-sube en vez de copiar del lado del servidor.** Copiar entre
prefijos solo lo puede hacer el Admin SDK, o sea una Function, y esa Function
tendría que **escribir la actividad** para agregarle la imagen: un segundo dueño
en `imagenes[]` (la clase de B-80) y un write-back que dispara los dos triggers
que ya escuchan `/actividades`. Re-subir desde el panel cuesta un viaje de ida y
vuelta de hasta 3 MB en la máquina del admin, no agrega ninguna pieza, y de paso
la foto **pasa por el pipeline que le saca los metadatos** — que importa más acá
que en cualquier otra subida, porque la mandó alguien de afuera.

**La trampa 12 no muerde, y conviene saber por qué:** `optimizarImagen` está
suscripto al **bucket entero**, así que la subida de una propuesta lo despierta;
lo corta el primer `if` de `decidirOptimizacion` (fuera del prefijo de
originales), que ya existía. La imagen **promovida** sí cae en `imagenes/` y se
optimiza, que es lo que se quiere: es una imagen de galería como cualquier otra.

**Y una consecuencia que la pantalla dice porque se descubre tarde:** reabrir una
propuesta cerrada —rechazada **o aceptada**, desde B-863— **no trae la foto de
vuelta**. El documento sigue nombrando su
`storagePath` y el objeto ya no está.

**Lo que un `get: esAdmin()` no cierra** está en `07-seguridad.md`: la URL de
descarga es una capability y sirve el objeto sin volver a evaluar las reglas
(**B-846**).

### `borrarFichasVencidas` — la retención de las tres guías (B-904, B-912, B-917)

Es DEC-13 sin contestar, tres veces. `contactoDeQuienCargo` es **el mismo dato**
que el `contacto` de una propuesta —el mail, el WhatsApp o el Instagram de alguien
que no está logueado— y hasta acá una ficha `rechazado` de `/librerias`,
`/suscripciones` o `/lugares` lo conservaba sin plazo: esas colecciones no tenían
ninguna Function. Lo único que había era `allow delete: if esAdmin()`, o sea el
borrado a mano, que depende de que alguien se acuerde — justo lo que B-838 decidió
no aceptar.

Y con los formularios públicos de `/guia/<x>/sumar` el campo pasa de opcional a
**obligatorio**: quien carga desde afuera no vuelve a entrar, así que sin contacto
no hay forma de repreguntar. Cada alta anónima trae el dato de un tercero, y la
excepción del borrado va **antes** que el dato.

| Estado | Qué pasa | Desde cuándo se cuenta |
|---|---|---|
| `rechazado` | a los **30 días** se va el documento | `revision.en`, o sea el rechazo |
| `pendiente` | a los **30 días** sin que nadie la toque, se va | el máximo entre `creadoEn` y `revision.en` |
| `publicado` | **no vence** | — |

**`publicado: null` es una decisión y no lo que sobró.** Una ficha publicada está
en el sitio: su contacto es lo que deja avisarle a la librería que su ficha existe,
corregirle un horario o darla de baja cuando cierra. Es el mismo argumento con el
que la propuesta `aceptada` no vence, y tiene su caso propio en los tests para que
nadie le ponga un número por simetría.

**Una Function para las tres, y la lista se deriva.** El bucle recorre
`COLECCIONES_DE_DIRECTORIO` (`functions/directorios.js`), que ya es quien declara
qué guías existen: **la cuarta entra sola**. El tope de borrados es **por
colección** —cada directorio tiene su propia bandeja— y una colección que falla no
deja sin barrer a las otras: el `try` abarca la lectura, no solo el borrado.

**Y no toca Storage, que es la diferencia con su vecina de abajo.** Una propuesta
guarda su flyer bajo `propuestas/`, un prefijo que `limpiarImagenesHuerfanas` no
barre, así que allá las dos mitades tienen que irse juntas. Una ficha de directorio
usa el **mismo** `GaleriaEditor` que una actividad, así que sus fotos viven en
`imagenes/` y las levanta ese barrido — **desde B-922, que es el cambio que lo hizo
cierto**: hasta entonces no las contaba como referencia y se las llevaba igual, a
las 72 horas y con la ficha publicada. Borrado el documento, la foto queda sin
dueño y se va sola con el margen de gracia.

Consecuencia práctica: acá **no existe el final `la-tocaron-tarde`**. La ficha que
un admin reabre en el último segundo se salva **entera**, porque no hay una segunda
mitad sin precondición. `delete({ lastUpdateTime })` cubre la ventana completa.

**⚠️ Cada corrida que borre algo deja el sitio marcado para rehacer, y no es un
bug.** Lo encontró el `auditor-trampas` al cerrar el cambio. A diferencia de
`/propuestas` —colección que ningún trigger escucha—, las tres de la Guía tienen
su `onDocumentWritten` de rebuild, y ése se dispara también en un `delete`;
`cambioAmeritaRebuild` devuelve `true` ante cualquier alta o baja sin mirar el
estado. O sea que borrar una ficha `rechazado` que **nunca estuvo publicada**
dispara un build completo sin que haya nada público que cambiar.

No es un loop —`marcarRebuild` escribe en `sistema/rebuild`, no en la ficha
borrada, así que no hay con qué encadenarse— y se acepta con el argumento que ya
está escrito en `functions/directorios.js`: un falso positivo cuesta un build, que
es el lado barato. Queda acá porque es lo que contesta «¿por qué se rehízo el
sitio de madrugada sin que nadie publicara nada?».

**El deploy lo hace CI**: el push a `main` ve el cambio en `functions/` y la
despliega sola. **No hay IAM nuevo**: necesita `datastore.user` y nada más — sin
Storage, ni siquiera usa el permiso de borrado de objetos. A mano, si hiciera
falta: `firebase deploy --only functions:borrarFichasVencidas`.

### `borrarPropuestasVencidas` — la retención de propuestas (B-838, DEC-13, B-844)

Una propuesta lleva **el mail o el WhatsApp de alguien que no está logueado**: el
primer dato personal de un tercero que el proyecto guarda, y el que B-102 daba por
inexistente. DEC-13 contestó cuánto se guarda una **rechazada**: 30 días, y se va
con su imagen.

**B-844 agregó el segundo plazo, que es el que cubre el caso peor.** Hasta
entonces las otras tres —`nueva`, `en-revision`, `aceptada`— no vencían nunca, o
sea que **la que nadie miró** conservaba el contacto para siempre y el único
borrado que existía dependía de que un admin apretara «rechazar»: justo lo que la
retención automática vino a no depender.

| Estado | Plazo | Contado desde |
|---|---|---|
| `rechazada` | 30 días (DEC-13) | `revision.en` — el rechazo |
| `nueva` | 30 días | la última señal de vida |
| `en-revision` | 30 días | la última señal de vida |
| `aceptada` | **no vence** el documento; la **foto original** sí se va (B-863) | — |

**Los 30 días de «sin tocar» los contestó el dueño el 2026-09-09** (la pregunta se
le hizo con una hipótesis de 90 escrita en el código). Lo que **no** contestó es
la `aceptada`: que no venza es un argumento propio, marcado como tal en el
docblock de `RETENCION_POR_ESTADO` y abierto a que lo revise.

> **Da el mismo número que la rechazada, y son dos constantes a propósito.** No
> es `MARGEN_SIN_TOCAR_MS = MARGEN_DE_RETENCION_MS`: eso las ataría y mover una
> movería la otra. Son **dos decisiones que hoy coinciden** —aquélla es el margen
> de un arrepentimiento, ésta es cuánto tarda una bandeja en dejar de mirarse— y
> nada obliga a que se muevan juntas. Mismo criterio que `MINIMO_DESCRIPCION`
> frente a `LARGO_RESUMEN` en `estadoDelCatalogo.ts`.
> `tests/retencion.test.ts` tiene el aserto que lo dice al revés —«hoy son
> iguales y eso no es una atadura»— y un guard sobre el fuente para que nadie las
> una por prolijidad.
>
> Los dos números viven en **`RETENCION_POR_ESTADO`** (`functions/retencion.js`),
> que es una tabla para que cambiarlos sea una línea: de ahí salen el plazo, los
> estados que la query trae (`ESTADOS_QUE_CADUCAN`) y lo que el script informa.
> El gemelo de la bandeja es `RETENCION_DIAS` en `src/lib/bandejaDePropuestas.ts`
> —hay que moverlo también— y `tests/bandeja-de-propuestas.test.ts` los cruza con
> una familia de fixtures, así que separarlos se pone rojo.

**Con 30 y 30, hoy hay un solo plazo y dos relojes**, y conviene decirlo porque
mueve dónde está la decisión: lo que distingue a una `rechazada` de una `nueva`
ya no es *cuánto* se guarda sino **desde cuándo se cuenta**.

**«La última señal de vida» y no `creadoEn`, y esa es la decisión de B-844.**
`revision.en` se escribe en **todo** movimiento de estado —«la estoy mirando» y
también **Reabrir**—, así que una propuesta que un admin miró la semana pasada y
dejó en `en-revision` no es lo mismo que una que nadie abrió nunca, aunque las dos
hayan llegado hace tres meses. El reloj es el **máximo** de `revision.en` y
`creadoEn`; sin ninguna de las dos legible, no se borra. El caso que lo decide no
es teórico: una rechazada que se **reabre** el día 100 vuelve a `nueva` con
`creadoEn` de hace más de 30 días, y con el reloj en `creadoEn` el barrido de esa
misma noche se llevaría lo que un admin acababa de rescatar a mano. **Con 30 días
esto dejó de ser un caso raro:** cualquier rechazada que llegue al final de su
propio plazo y se reabra cae exactamente ahí.

> ⚠️ **Y la consecuencia que 30 días vuelve real:** una propuesta puede caducar
> **antes de que nadie la haya abierto nunca**, si la bandeja pasó un mes sin
> mirarse. Con el reloj elegido eso es correcto —nadie la tocó, es literalmente
> el caso que el plazo cubre— y la mitigación es la bandeja: durante la última
> semana la ficha dice **cuántos días quedan**, no solo que va a caducar.

**Y `creadoEn` está en el `select` a propósito.** Un campo que la query no pide
vuelve `undefined`, así que se leería como «sin fecha legible» y **ninguna
`nueva` caducaría jamás**, en silencio. Lo fija
`tests/retencion.integracion.test.ts` («y `creadoEn` sí viaja»).

Esta Function programada (`functions/retencion-trigger.js`) las borra cada 24
horas. Corrió antes que el resto de la tajada por decisión del dueño (B-843 punto
1): **la excepción del borrado tiene que existir antes que el dato**, y hasta que
existió la única forma de honrar un «borrame» era un script con el Admin SDK que
nadie había escrito.

**Por qué no borra en el momento del rechazo.** Porque el rechazo no es el
borrado: los 30 días son el margen para el «lo rechacé sin querer» —la bandeja
ofrece **Reabrir**— y para que quien propuso pueda repreguntar. Es el mismo
argumento del margen de rescate de `limpiarVersionesHuerfanas`, con otro número.

**La decisión es pura y vive en `functions/retencion.js`** (`decidirRetencion`),
con tres salvaguardas:

- **El plazo de la rechazada se cuenta desde `revision.en`**, o sea desde el
  rechazo y no desde que llegó: una propuesta que estuvo dos meses en la bandeja y
  recién ayer se rechazó tiene sus treinta días completos. Y **no cae a
  `creadoEn`** si esa fecha no se puede leer: eso sería otro plazo, decidido por
  accidente.
- **Una fecha de revisión ilegible bloquea el borrado** (`sin-fecha-legible`):
  falla cerrado, porque una propuesta que se ve en la bandeja se puede volver a
  rechazar y una borrada no vuelve.
- **Tope de 50 por corrida** (`MAX_PROPUESTAS_POR_CORRIDA`), misma clase de
  salvaguarda que los otros dos barridos. Desde **B-865** ese tope acota además
  la **lectura**: la query va paginada de a 200 con cursor y deja de pedir
  páginas apenas junta las 50 candidatas del día. Lo que se acota es la memoria y
  —cuando hay trabajo— cuánto se lee; lo que **no** se acota es la búsqueda, y es
  a propósito: la query no lleva `orderBy` (pediría índice compuesto), así que un
  `limit()` a secas leería siempre las mismas primeras cincuenta por id y una
  vencida más adelante en la colección no se borraría **nunca**, en silencio. El
  residual está dicho: el día que no haya nada vencido, la búsqueda recorre la
  colección entera igual, porque ningún índice ordena por «cuándo vence» —el
  reloj sale del máximo entre dos campos y del estado—.

**El objeto se borra primero y el documento después**, y el orden importa: si
fallara el borrado del objeto con el documento ya borrado, la foto quedaría en el
bucket **sin nada que la nombre** —el barrido de huérfanas de B-221 solo recorre
`imagenes/` y `miniaturas/`—, así que nadie la volvería a encontrar. Con este
orden un fallo deja las dos mitades en pie y la corrida de mañana reintenta;
`ignoreNotFound` es lo que hace que ese reintento funcione.

### Y no borra a ciegas: la propuesta que tocan mientras el barrido corre (B-864)

El barrido decide al principio de la corrida y borra segundos después. Hasta
B-864 borraba **el id que había decidido, sin condición**, y eso choca de frente
con la promesa del párrafo de arriba: entre la lectura y el `delete()` un admin
puede apretar «la estoy mirando» sobre una vencida, **ver el plazo renovado en
Firestore y perder el documento igual**. B-844 ensanchó esa carrera de «solo las
rechazadas» a toda la bandeja pendiente, que es lo que la volvió cobrable.

Ahora la versión que la query vio (`updateTime`) viaja hasta el borrado y el
borrado la exige. **Son dos guardas y no una, porque son dos almacenes con
capacidades distintas:**

| | Guarda | Qué garantiza |
|---|---|---|
| Firestore | `delete({ lastUpdateTime })` | **Atómica**: el documento no se puede borrar si la versión cambió. No hay ventana |
| Storage | una **relectura** de metadata antes de tocar el objeto | Achica la ventana de la corrida entera a un round-trip. No hay precondición que ponerle a un `delete()` de Storage: al objeto solo se lo protege **no llegando hasta él** |

**El orden de B-838 no cambió** —el objeto sigue primero— y la guarda nueva va
**arriba de los dos**. Se evaluó invertir el orden cuando hay precondición (así
una precondición que falla no toca nada) y se descartó: eso vuelve catastrófico
el fallo **más probable**, un `delete` de Storage que falla por transitorio, que
dejaría la foto sin documento y sin corrida de mañana que la reintente.

La relectura usa `getAll(ref, { fieldMask: [] })` y **no un `ref.get()`**: trae
`exists` y `updateTime` con cero campos del documento, así que la guarda nueva no
deshace la garantía vieja de que el contacto del tercero no entra a la memoria de
la Function. Por lo mismo tampoco es una transacción: una transacción leería el
documento entero, y encima no puede abarcar el borrado de Storage. **Eso está
afirmado por valor contra el emulador y no solo sobre el fuente** —lo pidió el
`auditor-privacidad`, y la objeción es exacta: la garantía depende de que una
`DocumentMask` vacía signifique «ningún campo», o sea de una promesa del SDK, y
el día que un bump la cambie el contacto entraría a la memoria de la Function con
toda la suite en verde. Es la misma pareja de asertos que ya tenía el `select`.

**Los cuatro finales, que son los que aparecen en el log y en el informe del
script:**

| Final | Qué pasó | Dónde se ve |
|---|---|---|
| `borrada` | las dos mitades se fueron | `info` · `borrada:` |
| `la-tocaron` | la relectura vio otra versión. **No se tocó nada** | `info` · `intacta:` |
| `ya-no-esta` | el documento ya no estaba (otra corrida se lo llevó). El objeto se borra igual: sin documento que lo nombre es el huérfano que nadie encuentra después | `info` |
| `la-tocaron-tarde` | la tocaron en la ventana entre la relectura y el borrado: el documento se salvó, el objeto ya no estaba | **`warn`** · `intacta: … SIN su imagen` |

> **El código 9 de Firestore no distingue los dos últimos, y por eso el `catch`
> vuelve a preguntar.** `FAILED_PRECONDITION` es lo que devuelve
> `delete({ lastUpdateTime })` tanto cuando la versión cambió como cuando el
> documento **ya no existe** (verificado contra el emulador). Y el segundo caso
> es real, no teórico: el trigger corre por reloj y el script se corre a mano.
> Sin esa segunda relectura, dos corridas peleando por la misma propuesta
> dejaban un `warn` diciendo que una propuesta viva quedó con el flyer roto
> —sobre una propuesta que ya no existe—, y el operador iría a buscarla. Lo
> encontró el `auditor-trampas`.

**Los contadores del cierre son cuatro y no tres, y `sinImagen` va aparte de
`rescatadas`**: `la-tocaron-tarde` no es una propuesta intacta —el documento se
salvó y la foto no—, así que sumarla a `rescatadas` diría que se salvó entera y
no sumarla a nada dejaba a la corrida **sin contar la única foto de un tercero
que destruyó de forma sorprendente**. El informe del script hace el mismo corte,
a propósito: son dos implementaciones del mismo resumen. Lo encontraron los dos
auditores, cada uno por su lado.

> ⚠️ **La cuarta forma de perder la mitad del borrado, dicha de frente.** B-838
> nombró tres formas de terminar con la **foto viva y el documento muerto** y las
> cerró las tres. `la-tocaron-tarde` es la cuarta y va **al revés**: documento
> vivo, foto muerta. Cae del lado que B-838 eligió como «el menos malo» —se ve en
> la bandeja como un flyer roto, no es una foto de una persona que nadie puede
> volver a encontrar— pero cae sobre la peor propuesta posible: la que un admin
> acaba de rescatar. **No se puede cerrar** mientras Storage no tenga
> precondición; lo que se puede es medirla, y por eso el trigger la loguea como
> `warn` y el script la dice.

> ✅ **Convertir era la variante peor de este ítem, y la cerró B-866 (2026-09-24).**
> Abrir la conversión de una `nueva` la pasa a `en-revision`, que renueva
> `revision.en`: la precondición tiene una versión nueva contra la cual proteger y
> el barrido no se la lleva con el formulario abierto. Queda descubierta la
> `en-revision` o `rechazada` vieja que se convierte sin marca (**B-1460**).

**Y lo que borra está acotado al prefijo `propuestas/`.** No es higiene: esta
Function corre con el Admin SDK y **no pasa por `firestore.rules`**, así que el
`matches('^propuestas/…')` que valida la escritura no la protege. Un documento que
nombrara `imagenes/img_<uuid>.jpg` de una actividad publicada haría que borrar la
propuesta se llevara el flyer del sitio, en vivo.

**El barrido no lee el contacto.** La query usa
`select('estado','creadoEn','revision.en','imagen.storagePath')` y el mapeo arma
cinco claves a mano: el dato personal del tercero no entra a la memoria de la
Function ni puede terminar en un log por accidente. Los dos campos anidados van
por su path para que `revision.motivo` y `revision.porUid` tampoco viajen.

**IAM: no hace falta nada nuevo.** Corre con `calendar-sync@`, que ya tiene
`datastore.user` (D-06) y el `storage.objects.delete` que usa
`limpiarImagenesHuerfanas`.

```bash
firebase deploy --only functions:borrarPropuestasVencidas
```

**Cómo verificar la primera corrida.** Con el script en seco o por logs:

```bash
# En seco: lista qué borraría con el motivo de cada caso. Es el default, no borra.
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199   node scripts/borrar-propuestas-vencidas.mjs

# Aplicarlo de verdad, siempre contra el emulador primero:
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199   node scripts/borrar-propuestas-vencidas.mjs --aplicar

# En producción exige el flag de más. Y hay una segunda guarda que los otros
# barridos no necesitan: con Firestore en el emulador y Storage sin apuntar,
# el informe diría «EMULADOR» mientras las fotos que borra son las de verdad.
node scripts/borrar-propuestas-vencidas.mjs --aplicar --produccion

gcloud functions logs read borrarPropuestasVencidas \
  --region southamerica-east1 --project agenda-literaria --limit 50
```

El script reusa la misma `decidirRetencion` que la Function, así que mirarlo en
seco prueba algo. Verificado a mano contra el emulador el 2026-09-09: sembradas
una rechazada de 40 días **con imagen** y otra de 3, el script marca
`[BORRAR] … rechazada-vencida` solo la primera, deja la otra en
`dentro-del-plazo`, `--aplicar` borra el documento **y el objeto** (confirmado con
`file().exists()`), la corrida siguiente ya no la ve, y `--aplicar` con Storage
apuntando afuera del emulador aborta con código 1. **Esa verificación es de antes
de B-844 y cubre la rechazada.**

**El segundo plazo se verificó igual, contra el emulador, el 2026-09-09.**
Sembradas cinco propuestas —una `nueva` de 31 días, una `nueva` de 2, una
`en-revision` mirada ayer con `creadoEn` de hace 200 días, una `en-revision`
abandonada hace 120 y una `aceptada` de 400—, el informe trae **cuatro** (la
`aceptada` ni se consulta, que es el `in` derivado de la tabla) y marca
`[BORRAR]` solo dos: `sin-mirar-vencida` la de 31 días y `sin-avanzar-vencida` la
abandonada. **La mirada ayer queda en `dentro-del-plazo` pese a tener 200 días de
antigüedad**, que es la decisión del reloj funcionando. `--aplicar` borra esas
dos, la corrida siguiente ya no las ve.

**La precondición de B-864 se verificó igual, contra el emulador, y la carrera se
armó a mano.** Sembradas 41 vencidas con imagen, se corrió `--aplicar` mientras un
segundo proceso —un «admin mirando la bandeja»— esperaba a ver que el barrido
había empezado y apretaba «la estoy mirando» sobre la última de la lista. El
informe salió con **40 borradas y `intacta: z_carrera · la tocaron mientras corría
este script`**; después de la corrida el documento sigue vivo, en `en-revision`,
**con su contacto y con su imagen**, y la corrida siguiente ya no lo marca (el
plazo se le renovó). Con el `delete()` sin condición de antes, esa propuesta se
perdía entera. Sin el `getAll` previo se perdía la imagen, que es la mitad que el
orden de B-838 dejaba expuesta.

**Lo que este barrido NO borra, dicho para que no se lea como olvido:** la
propuesta `aceptada`. Es la decisión de B-844 y no lo que sobró: ahí el contacto
sirve —la actividad existe, está publicada y puede haber que repreguntar por
ella—, así que borrarlo no protege a nadie y deja al proyecto sin poder avisarle a
esa persona sobre su propia actividad. Para honrar un «borrame» sobre una aceptada
hay que rechazarla desde la bandeja (entra a la cola de 30 días) o correr el
script a mano.

**Y con el contacto se queda también la foto original, que es la mitad que la
decisión no cubrió** (lo señaló el `auditor-privacidad`). Al convertir se
promueve una **copia** a `imagenes/` y el objeto de `propuestas/` no se toca —«se
lo lleva el ciclo de la propuesta», dice el comentario del panel—, así que con
`aceptada: null` ese ciclo no llega nunca y la imagen queda sin plazo bajo un
prefijo que `limpiarImagenesHuerfanas` no barre. Anotado como **B-863**: lo
barato es borrar el original cuando la promoción sale bien, y es una decisión.

**Y la bandeja lo dice.** Desde B-844 la ficha muestra «Se borra en N días» / «Se
borra mañana» / «Se borra hoy» cuando falta menos que `AVISO_DE_CADUCIDAD_DIAS`
(**7**). Sin el aviso, un documento que se va solo desaparece de la bandeja sin
que nadie lo vea irse, y eso se lee como un bug de la pantalla.

**El criterio de la ventana está escrito para no redescubrirlo: un cuarto del
plazo, nunca más de un tercio, y nunca menos de una semana.** El techo es
**D-273** —un aviso prendido media vida es el cartel en cada ficha, no trabajo
pendiente—; el piso es que la ventana tiene que ser más larga que el hueco entre
dos visitas a la bandeja, o el aviso se pierde entero. Con 30 días de plazo eso
da siete: apagado el 77 % del tiempo, y en una bandeja que se atiende, siempre
—mover una propuesta de estado reinicia su reloj—. **El número anterior era 14 y
se había elegido contra el plazo de 90**; al bajar a 30 habría quedado prendido
casi la mitad de la vida de cada ficha sin que nada fallara, así que
`tests/bandeja-de-propuestas.test.ts` tiene ahora el aserto que lo fuerza.

### Las cuentas de Instagram de la base, para seguirlas

**Pedido del dueño.** `npm run instagrams` arma una página local con **todas** las
cuentas de Instagram que aparecen en la base, ordenadas por en cuántas actividades
salen, con el link a cada perfil y en qué rol aparece cada una.

```bash
npm run instagrams          # contra producción, solo lectura
open .estado/instagrams.html
```

Tres cosas que decide, y las tres tienen motivo:

- **Sale a `.estado/`, que está en el `.gitignore`, y no a `public/`.** La lista
  incluye `difusion.arrobar`, que el §5.1 marca como trabajo interno que **nunca
  sale al público**: un archivo en `public/` se publicaría con el próximo build.
  Por eso la página es local y no se sube a ningún lado.
- **Lee toda la colección, no solo lo publicado.** Un borrador ya tiene cargado a
  su organizador, y para seguir una cuenta no hace falta esperar a publicar.
- **Lo que no se puede leer como handle no se descarta en silencio**: va a una
  sección aparte con el valor crudo. En la primera corrida (2026-09-07, 122
  actividades, 74 cuentas) eso encontró dos datos mal cargados —un **nombre**
  («Festival Argentino de Historieta») y un **mail**— en el campo de Instagram.

El normalizador es una **copia** del del sitio (`handleInstagram`), porque un
`.mjs` no resuelve los alias `@/`: misma restricción que D-20 y misma red, un test
que corre las dos contra la misma batería y exige que contesten igual. Importa
más que la mayoría de las copias, porque lo que deciden es **a qué cuenta apunta
un link**.

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

**5. Crear las etiquetas del issue** — **es un script desde B-33**, ya no dos
comandos pegados a mano:

```bash
node scripts/etiquetas-github.mjs --dry-run   # qué haría, sin tocar nada
node scripts/etiquetas-github.mjs             # crea o actualiza, y verifica
```

Tres cosas que hacen que valga la pena que sea un script y no una línea del
runbook:

- **La lista no está escrita en ninguna parte.** El script corre
  `construirIssue` de `functions/reportes.js` —la misma función que corre en la
  Cloud Function— con cada `tipo` que `firestore.rules` permite, y junta lo que
  devuelve en `labels`. O sea que crea **las que el productor aplica**, no las que
  alguien creyó que aplica. La versión vieja de este paso era exactamente eso:
  dos comandos que nombraban `reporte-panel` y `sugerencia`, con un comentario
  diciendo que `bug` «ya existe en todo repo de GitHub» — y si mañana el
  productor agrega una tercera, ningún comando pegado la iba a crear.
- **Es idempotente.** `gh label create --force` crea si falta y actualiza color y
  descripción si existe, así que correrlo dos veces no falla ni duplica. Es lo que
  lo hace un paso repetible de un runbook y no una ceremonia de una sola vez.
- **No pide ni crea credenciales** (§5.4): usa la sesión de `gh` que ya está en
  la máquina. Y al terminar **lee de GitHub cómo quedaron**, para poder
  confirmarlo sin abrir el navegador.

Lo único a mano es el color y la descripción de cada etiqueta, que no se derivan
de ninguna parte. Si el productor empieza a aplicar una que no tiene color
elegido, el script **la crea igual** con el gris de default y avisa —una etiqueta
sin color es mejor que una que no existe—, y `tests/etiquetas-github.test.ts` se
pone rojo pidiendo que alguien decida cómo se ve.

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

# 6bis. El CORS del bucket de imágenes (B-1235a): sin él, convertir una
#       propuesta con foto la deja sin flyer. Ver "El CORS del bucket".
gcloud storage buckets update gs://<BUCKET> --cors-file=cors.json
npm run cors:verificar   # después del primer deploy, que publica events.json

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

## El correo semanal (B-847, B-1231)

**Activado el 2026-09-23.** La audience existe (`agendaleh`, centro `us14`),
`LISTA_DE_CORREO` (`src/lib/enlaces.ts`) tiene los cuatro valores y la sección de
`/suscribirse` se dibuja.

**Dos de los ajustes de abajo son de consola y ningún test los sostiene**, así
que esta sección sigue siendo el único lugar donde están escritos: si alguien los
cambia, el sitio pasa a mentir y nada se pone en rojo. Son el **doble opt-in** y
el interruptor de GA4 del tercer punto.

> **Estuvo construido y apagado dos semanas, y eso fue a propósito.** Con
> `LISTA_DE_CORREO` en `null` la sección no se dibujaba: no había formulario que
> posteara a ningún lado y no había ninguna promesa publicada. Es el orden de
> B-780 con el perfil de Cafecito, y acá el costo de saltearlo era peor — con un
> `u`/`id` inventados el formulario **postea igual**, contra un endpoint que o no
> existe o es de otra cuenta, y la dirección de una persona termina en la lista
> de un desconocido. Ningún test lo puede ver: que la lista sea la nuestra no se
> sabe sin salir a la red. Queda escrito porque es el orden que hay que repetir
> el día que la cuenta cambie.

Los pasos de la consola de Mailchimp, uno por uno, están en
[`02-infraestructura.md`](02-infraestructura.md) § «Mailchimp». Lo que hay que
tener presente al hacerlos:

- **El doble opt-in va prendido.** — ⬜ **sin verificar en la consola.** La
  página promete que llega un mail de confirmación y que sin confirmar no queda
  nadie anotado. Es una casilla de la configuración de la audience, **no** una
  línea de código, así que **no hay ningún test que lo sostenga** — misma clase
  que los ajustes de GA4 de B-480. Si se apaga, la página pasa a mentir y nada se
  pone en rojo, **y la promesa ya está publicada**: esto dejó de ser preventivo
  el 2026-09-23. Cuando se confirme, la casilla de acá pasa a `✅ verificado en la
  consola el AAAA-MM-DD`, que es el formato que usó B-480 y lo único que este
  repo puede registrar de un ajuste que no puede leer.
- **El seguimiento de aperturas y clics va prendido** (*Track opens* y *Track
  clicks* en cada campaña) — **D-802**. Es el default de Mailchimp y es lo que
  la promesa dice desde el 2026-09-23 en **tres** lugares: `donde-queda` de
  `/suscribirse` (`boletinDelSitio.ts`), la pregunta `suscribirme` de `/ayuda`
  (`ayudaDelSitio.ts`) y «Quién hace esto» de `/apoyar` (`apoyoDelSitio.ts`).
  Si algún día se apaga, hay que sacar la frase de los tres en el mismo cambio:
  una promesa que dice de más también es falsa.
- **Y hay un segundo ajuste de consola, que no es de Mailchimp sino de GA4:
  apagar «Interacciones con formularios».** Es el **cuarto** interruptor del
  Enhanced Measurement y el único que B-480 no apagó, porque hasta ahora el
  sitio público no tenía ningún formulario que hablara de datos. Con el alta al
  correo manda `form_start`/`form_submit` con `form_destination` —o sea que
  Google se entera de que este visitante mandó el formulario y a qué lista—; la
  dirección **no** viaja, GA4 no manda valores de campo. Se apaga en Administrar
  → Flujos de datos → el flujo → Enhanced measurement, **antes** de cargar
  `LISTA_DE_CORREO`, que es cuando el formulario empieza a dibujarse. Lo
  encontró el `auditor-privacidad` sobre este mismo cambio; el detalle está en
  [`16-analitica-del-sitio.md`](16-analitica-del-sitio.md) §7.4. Como el doble
  opt-in: **configuración y no código, sin test que lo sostenga**.
  ⬜ **Sin apagar, y VENCIDO desde el 2026-09-23**: la lista ya está cargada y el
  formulario ya se dibuja, así que cada alta manda el evento **ahora**. Es
  **B-874**, subido a P1 por eso mismo. Cuando se apague, esta casilla pasa a
  `✅ apagado el AAAA-MM-DD`.
- **El remitente es `agendaleh@gmail.com`** — ⬜ **sin verificar en la consola**,
  misma clase que el doble opt-in —, la casilla que el sitio ya usa
  (`CONTACTO`). La página lo dice con esa constante interpolada, no escrita a
  mano: esa cuenta ya cambió una vez (B-839).
- **La cadencia que la página promete es semanal con su excepción escrita** —«si
  una semana no hay nada que valga la pena, no sale»—. No es un piso: si el
  texto vuelve a «al menos una vez por semana», la primera semana floja lo
  vuelve falso, en HTML indexado.
- Después de cargar los cuatro valores hace falta **un rebuild** para que la
  sección aparezca; un cambio a `src/` no dispara el rebuild automático del §8,
  que mira Firestore. Sale con el push a `main` — que es como salió el
  2026-09-23.
- **El `<title>` y la `meta description` de `/suscribirse` se cambiaron con la
  lista** (B-1231), y hasta ese día hablaban solo del calendario a propósito:
  prometer un correo en HTML indexado mientras la sección no se dibujaba habría
  sido prometer algo que la página no ofrecía. Hoy nombran las dos cosas, y la
  fila de `/suscribirse` de la tabla de títulos de
  [`12-sitio-publico.md`](12-sitio-publico.md) dice el título nuevo.

Para verificar que quedó bien, sin mandar un alta de prueba a la lista real:

```bash
npx vitest run tests/boletin-del-sitio.test.ts
npm run build && grep -o 'list-manage.com[^"]*' dist/suscribirse/index.html
```

El `grep` tiene que devolver el host de **nuestra** cuenta y el `u`/`id` que
figuran en la consola. Si devuelve otra cosa, el formulario está apuntando a una
lista ajena.

### Qué hacer cuando lo anunciado se cae

**Un correo mandado no se corrige.** Es la diferencia práctica entre la salida 29
y todas las demás: el sitio y el calendario se rehacen solos cuando la actividad
cambia (§8, §7), pero lo que llegó a una casilla dice lo que decía para siempre.
Los dos cuerpos del correo lo avisan con una línea (`AVISO_DE_CAMBIOS`), y eso es
lo que hace honesto lo que sigue:

| Qué pasó | Qué hacer |
|---|---|
| La actividad se **canceló** | nada. La página sobrevive a la cancelación (**B-110**) y muestra la franja de cancelada, así que el link del correo lleva exactamente a la noticia. Es el caso que está bien por construcción |
| Cambió la **fecha**, la **sede** o el **horario** | nada en el correo viejo: el link lleva a la página, que ya dice lo nuevo. Si el cambio es grande y el encuentro es esta semana, va en el correo siguiente |
| Volvió a **borrador**, o se **borró** | el link del correo queda en 404 **permanente**, desde una casilla ajena. No hay forma de arreglarlo del lado de acá. Si era la actividad principal del envío, corresponde contarlo en el correo siguiente |

**No se manda una retractación.** Un segundo correo para corregir el primero
duplica los envíos de la semana —que es lo que la página promete que no pasa— y
llega a gente que no llegó a leer el primero. Lo que se cuenta, se cuenta en el
próximo.

**Y una vez que la lista exista, el correo se arma en el panel.** La vista
«Correo» (B-1230) produce el borrador de los siete días que vienen —asunto, vista
previa, cuerpo en HTML y cuerpo en texto plano— desde el `events.json` publicado.
Se copia y se pega en la campaña: no hay integración con la API de Mailchimp y no
la va a haber (**D-800**). Está descripto en
[`04-funcionalidades.md`](04-funcionalidades.md) § «El correo semanal».

## El aviso por mail de que el sitio no se publica (B-1140)

Cuando el deploy falla, llega un mail. Antes se abría un issue; el cambio es
decisión del dueño y el porqué está en **B-1140** — el issue hay que ir a
mirarlo.

### Los tres secrets

| Secret | Qué va |
|---|---|
| `MAIL_AVISOS_DESTINO` | la casilla que recibe el aviso |
| `MAIL_AVISOS_USUARIO` | la casilla **desde la que sale** el mail |
| `MAIL_AVISOS_PASSWORD` | una **contraseña de aplicación** de esa cuenta de Google |

**No es la contraseña normal de Gmail**: se genera en
`myaccount.google.com/apppasswords`, con la verificación en 2 pasos activada, y
son 16 caracteres que se muestran **una sola vez**. La casilla no puede ir
escrita en el repo —es público— y `tests/sin-datos-personales.test.ts` frena
cualquier `@gmail.com` versionado que no sea la del proyecto.

### ⚠️ `gh secret set` sin `--body` puede crear el secret VACÍO

Pasó al cargarlos, el 2026-09-21, y cuesta media hora si no está escrito:

```bash
gh secret set MAIL_AVISOS_PASSWORD        # espera el valor por stdin
```

Sin una terminal interactiva de verdad —lanzado desde una sesión de agente, un
script, un pipe— **no lee nada y crea el secret con el valor vacío, sin
quejarse**. Y después `gh secret list` lo muestra igual que uno cargado: con su
nombre y su fecha. El síntoma llega del otro lado y no se parece a la causa: el
job falla diciendo `falta MAIL_AVISOS_PASSWORD` **sobre un secret que existe**.

Las dos formas que sí funcionan:

- por la web (Settings → Secrets and variables → Actions), que es la más
  simple para una contraseña;
- o `gh secret set NOMBRE --body "…"`, con la contra de que queda en el
  historial del shell.

### Probar el aviso sin esperar a que algo se rompa

**Actions → «Build y deploy del sitio» → «Run workflow» → tildar «Mandar un mail
de prueba y NO publicar el sitio».** Con esa opción el deploy no corre: la
corrida existe solo para mandar el mail, tarda unos segundos y **se pone roja si
el mail no sale**.

Es la única excepción a la regla de que un aviso no agrega su propio rojo (punto
3 de B-883): los otros dos cuelgan de una corrida que venía a avisar de otra
cosa, y éste **es** la corrida — un verde que no manda nada sería la prueba
mintiendo.

El envío también se puede correr a mano, que es lo que sirve para probar contra
otro servidor:

```bash
MAIL_AVISOS_DESTINO=… MAIL_AVISOS_USUARIO=… MAIL_AVISOS_PASSWORD=… \
  ./scripts/mail-de-aviso.sh 'Prueba' 'Si esto llega, funciona.'
```

`MAIL_AVISOS_SMTP` cambia el servidor (default `smtps://smtp.gmail.com:465`), así
que mudarse de proveedor no toca ni el workflow ni el script.

**El primer mail suele caer en spam.** Marcarlo como «no es spam» una vez y
listo: si el aviso vive en spam, es como no tenerlo.

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
| `pendiente: false` | el último **disparo** salió bien. **No** significa que el sitio esté publicado: el flag se baja cuando GitHub acepta el dispatch, no cuando el build termina (**B-884**). Si hay un issue `deploy-roto` abierto, el sitio está atrasado |
| `despacho.cubreHasta` | qué tiene que contener, como mínimo, el sitio vivo: la marca del último cambio que el disparo cubría. Se compara contra el `generadoEn` del `events.json` publicado |
| `despacho.motivo` | qué edición disparó ese build. El `motivo` de arriba del documento es el de la **última marca**, que puede ser otro |
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

### Verificar contra Calendar de verdad (B-125, D-293)

La vista calendario del panel solo compara el `calendarEventId` guardado contra
lo que **debería** existir (`debeExistir`) — nunca contra lo que Calendar tiene
de verdad. Si alguien borra un evento a mano, la vista sigue diciendo "En el
calendario" hasta la próxima edición de esa actividad (D-71). Esto es lo que
cierra esa mitad de B-125: un script que le pregunta a la API.

**Setup, una sola vez.** Leer Calendar pide la identidad de la Function
(`calendar-sync@…`, D-06); el script la toma **impersonando** esa service
account desde tus propias credenciales, sin bajar ninguna key:

1. `gcloud auth application-default login` (si no lo hiciste ya para
   `aprobar-opciones.mjs` o `set-admin-claim.mjs`).
2. Alguien con permisos de IAM en el proyecto te da el rol
   `roles/iam.serviceAccountTokenCreator` sobre
   `calendar-sync@agenda-literaria.iam.gserviceaccount.com`:

   ```bash
   gcloud iam service-accounts add-iam-policy-binding \
     calendar-sync@agenda-literaria.iam.gserviceaccount.com \
     --member="user:<tu-mail>" \
     --role="roles/iam.serviceAccountTokenCreator"
   ```

**Correrlo:**

```bash
npm run calendario:verificar                 # reporta, no escribe nada
npm run calendario:verificar -- --reparar    # además recrea los borrados a mano
npm run calendario:verificar -- --reescribir # además actualiza los desactualizados (B-631)
```

Los dos flags son independientes y se pueden combinar. **Correr primero sin
ninguno** y leer el reporte: es el que dice qué haría cada uno.

Lee las actividades **publicadas** de Firestore (producción, con las ADC —
nunca hace falta bajar una key para esto) y le pregunta a Calendar, uno por
uno, si cada `calendarEventId` sigue existiendo. **La llamada a Calendar es
siempre contra el calendario real**, incluso si `FIRESTORE_EMULATOR_HOST` está
seteado para leer Firestore del emulador — no hay forma de simular Calendar, así
que mezclar un Firestore de mentira con un Calendar real no sirve para nada
salvo probar que el script no explota.

Qué hace con lo que encuentra:

| Resultado de Calendar | Qué significa | Qué hace el script |
|---|---|---|
| el evento existe y dice lo mismo que el código de hoy | todo en orden | nada |
| el evento existe y dice otra cosa (B-631) | quedó atrás: cambió *cómo se arma* el evento (B-162, D-95), o alguien lo editó a mano en Calendar | sin `--reescribir`: lo reporta como **desactualizado**, con los campos que difieren. Con `--reescribir`: lo **actualiza** (`events.update`) con lo que produce `construirEvento`. Sin write-back: el `calendarEventId` no cambia |
| 200 con `status: 'cancelled'` | borrado, todavía no purgado | igual que un 404 |
| 404 / 410 | lo borraron a mano | sin `--reparar`: lo reporta. Con `--reparar`: lo **recrea** (mismo criterio que `decidirAnteFallo`, D-191) y repone el `calendarEventId` nuevo en Firestore |
| cualquier otro código (403, timeout, cuota) | ambiguo — no dice nada del evento puntual | lo reporta aparte como "no se pudo verificar" y **no lo toca**, con `--reparar` o sin él |

Tope de 200 sesiones verificadas por corrida (`MAX_VERIFICACION_POR_CORRIDA` en
`functions/reconciliacion.js`): son llamadas de a una, y una cuenta con muchas
actividades publicadas se puede comer varios minutos. Si se truncó, el script
imprime el comando exacto para seguir:

```bash
npm run calendario:verificar -- --desde act_xyz   # sigue después de esa actividad
```

El corte es por **actividad completa**, nunca a mitad de una: el cursor es el
id de la última actividad que se terminó de verificar, la query se ordena por
id de documento (`FieldPath.documentId()`) y arranca después de ese cursor
(`startAfter`). Sin esto, correr el script de nuevo sin `--desde` repetía
siempre las mismas primeras 200 candidatas — una sesión borrada a mano más
allá del tope no se detectaba nunca, sin que nada lo dijera.

#### Desactualizados: qué se compara (B-631)

La guarda anti-loop del §7.1 no puede ver un evento que quedó atrás: compara
`construirEvento(antes)` contra `construirEvento(después)`, los dos con el código
desplegado hoy (D-07), así que un cambio en cómo se arma la descripción no emite
ninguna operación. Desde afuera sí se ve, y este script es el único que mira desde
afuera. No cuesta una llamada más: `events.get` ya devuelve el evento entero.

- **El evento esperado es el de la Function.** `construirEvento` de
  `functions/calendario.js` y las etiquetas de `cargarLabels`
  (`functions/etiquetas.js`), importados y no copiados. Hasta B-1520 el script
  tenía su propia lista de taxonomías y le faltaban `provincia` y `ciudad`.
- **Se compara solo lo que escribimos.** Las claves salen de lo que produce
  `construirEvento` —hoy `summary`, `description`, `location`, `start` y `end`—,
  no de una lista a mano: un campo nuevo del evento entra solo al chequeo. Lo que
  Calendar agrega por su cuenta (`etag`, `sequence`, `reminders`, `organizer`…) no
  cuenta.
- **Fechas por instante, zona tal cual (trampa 1).** Calendar devuelve
  `…T19:00:00-03:00` donde mandamos `…T22:00:00.000Z`: es el mismo momento y no
  sale como distinto. El `timeZone` sí tiene que decir
  `America/Argentina/Buenos_Aires`, y un evento corrido tres horas sale como
  desactualizado en `start` y `end`.
- **Vacío es vacío.** Calendar omite un campo vacío; `null`, `''` y ausente valen
  lo mismo, si no toda actividad sin sede saldría desactualizada.
- **Solo sobre lo que existe.** Un 403 o un timeout no se compara ni se reescribe:
  sería un `update` sobre una sospecha.

**Por qué `--reescribir` es un flag aparte de `--reparar`.** Recrear un evento
que no está repone algo que falta. Reescribir uno que está le cambia el título o
la descripción **a quien ya lo tiene agendado**, y es justo lo que D-95 evita
hacer en silencio: por eso lo decide el dueño viendo el reporte. Un `update`
también pisa lo que alguien haya editado a mano en Calendar, que es lo esperado
(§2.1: Calendar es un espejo). Con los dos flags, las reescrituras van después
de las recreaciones.

**Nada de esto se probó contra el calendario real.** Los tests
(`tests/verificar-calendario.test.ts`) usan un Calendar de mentira con cuerpos
como los devuelve `events.get` —offset `-03:00` incluido—; la primera corrida de
verdad es la del dueño, y conviene que sea sin flags.

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
| Al deployar Functions: `Unable to parse JSON: SyntaxError: Unexpected token '<', "<!DOCTYPE "...` seguido de `failed to update function …` | **No es un bug de parseo nuestro**, que es lo que el mensaje parece. Es la API de Cloud Functions devolviendo una **página HTML de error** —un 5xx de gateway— donde `firebase-tools` esperaba JSON. Es transitorio y **por función**: el resto del lote actualiza bien, y el job igual termina en rojo porque una sola falla lo tumba. Visto el 2026-09-16, con 17 de 18 en verde | **Reintentar el job**, no investigar el código: `gh run rerun <id> --failed`. Si vuelve a fallar la **misma** función dos veces seguidas, ahí sí es otra cosa — mirá las dos filas de permisos de arriba |
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
