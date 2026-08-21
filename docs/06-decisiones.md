# Decisiones

Decisiones tomadas **durante la implementación**, que no están en el
`CLAUDE.md`. Incluye los desvíos del documento, con su motivo.

Las decisiones de arquitectura ya cerradas están en el §2 del
[`CLAUDE.md`](../CLAUDE.md) y no se revisitan sin pedido explícito.

---

## D-01 · Sin librería de formularios

**Decisión:** el formulario es estado controlado de React más zod en el submit.

**Alternativa descartada:** react-hook-form (llegó a estar instalada y se
quitó). Con campos anidados de tres niveles y componentes propios (taxonomías,
editor de sesiones) habría hecho falta un `Controller` en cada campo, sin ganar
nada sobre `useState` + validación al guardar.

---

## D-02 · Las etiquetas nuevas se persisten en el submit

**Decisión:** cuando alguien crea una opción con "Otro", el `upsertOpcion` corre
al guardar la actividad, no al tipear la etiqueta.

**Motivo:** abandonar el formulario a mitad de camino no debe dejar basura en la
taxonomía. El §4.3 se queja justamente de las opciones con `usos: 1` creadas por
error.

**Costo:** el componente tiene que devolver el label junto con el slug, y el
formulario acumularlos hasta el submit.

---

## D-03 · Las opciones base viven en un JSON

**Decisión:** `src/lib/opciones-base.json`, importado por `src/lib/opciones.ts`
y por los scripts de seed.

**Motivo:** los scripts corren en Node plano y no pueden importar TypeScript. La
alternativa era duplicar los valores.

---

## D-04 · La regla de lectura suma `|| esAdmin()`

**Desvío del §5.3.** El documento propone:

```js
allow read: if resource.data.estado == 'publicado';
```

**Lo implementado:**

```js
allow read: if esAdmin() || resource.data.estado == 'publicado';
```

**Motivo:** sin eso el panel no puede listar sus propios borradores, que es su
función principal.

**Nota sobre el emulador:** cuando la lectura se deniega, el emulador reporta
`evaluation error` en vez de `permission-denied`, porque en su primera pasada
`resource` todavía no está cargado. Es cosmético: las cuatro evaluaciones
deniegan igual. Se probó blindarlo con `resource != null` y con
`.get('estado','')` y no lo evita. En producción el mensaje es correcto.

---

## D-05 · `token.get('admin', false)` en vez de `token.admin`

**Motivo:** leer una clave ausente de un map en las reglas de Firestore es un
*evaluation error*, no `false`. Con el acceso directo, cualquier usuario sin el
claim hacía fallar la regla y el cliente recibía "evaluation error" en lugar de
un permission-denied limpio.

Lo encontró un test de integración.

---

## D-06 · La Function corre como la service account, sin key

**Desvío del §2.6.** El documento dice que la Function autentica con la *key* de
la service account.

**Lo implementado:** la Function corre **como** `calendar-sync@…` y toma el
token de las credenciales de su propio runtime (`GoogleAuth` sin credenciales
explícitas).

**Motivo:** mismo resultado y no queda ninguna key para guardar, rotar ni
filtrar. El setup del calendario es idéntico: compartirlo con el mail de la
service account dándole "Realizar cambios en los eventos".

**Costo:** hay que otorgar a mano `eventarc.eventReceiver`, `run.invoker` y
`artifactregistry.reader`, que la service account por defecto de Compute trae de
fábrica. Sin eso el deploy falla con `eventarc.events.receiveEvent denied`.

---

## D-07 · La guarda anti-loop compara payloads, no una lista de campos

**Desvío del §7.1.** El documento propone:

```js
const CAL_FIELDS = ['titulo','descripcion','estado','sede','modalidad','sesiones'];
const relevantChanged = (a, b) => CAL_FIELDS.some(f => JSON.stringify(a?.[f]) !== JSON.stringify(b?.[f]));
```

**Lo implementado:** se arma el evento que se le mandaría a Calendar antes y
después, y se comparan.

**Motivo:** al pasar la descripción del evento de 3 campos a ~20 (D-09), la
lista mantenida a mano se volvió una bomba de tiempo: agregar un dato a la
descripción sin agregarlo a la lista dejaba de propagar ese cambio al
calendario, en silencio.

La propiedad anti-loop se conserva y es más fuerte: `construirEvento` no lee
`calendarEventId`, así que la escritura del id de vuelta produce un payload
idéntico por construcción, no por acuerdo.

**Efecto lateral bueno:** editar la difusión interna o el link privado de la
reunión ya no dispara un update inútil de las N sesiones.

---

## D-08 · La config del SDK web va versionada

**Decisión:** `.env.production` y `.env.development` están en el repo con la
API key, el appId y el resto de la config de Firebase.

**Motivo:** no es secreta. Viaja en el bundle del cliente por diseño y la
seguridad la dan las reglas de Firestore (§5.3), no el secreto de esos valores.
Versionarla hace que el deploy no necesite configurar nada.

Lo que sigue fuera del repo es la service account key (§5.4) y el PAT de GitHub.
`functions/.env` también está versionado: solo tiene el id del calendario.

---

## D-09 · La descripción del evento lleva todo lo publicable

**Pedido del usuario:** "en la descripción del evento debe ir toda la info que
el usuario cargó en el formulario".

**Lo implementado:** todo lo del formulario **excepto** lo que el §5.1 y el §7.4
prohíben, porque el calendario es tan público y scrapeable como el
`events.json`: el link de la reunión, la difusión interna, la URL del material
privado y los uids.

Ver [`07-seguridad.md`](07-seguridad.md) para la lista y cómo se verifica.

---

## D-10 · La ubicación se arma completa, con link a Maps

**Pedido del usuario:** "cargar la dirección puede ser con Google Maps así el
evento queda bien cargado".

**Era además un bug:** se mandaba solo `sede.direccion` ("Drago 236"), sin
ciudad ni país. Google no tenía con qué desambiguar y el evento quedaba sin mapa
o con el mapa en otra ciudad.

**Lo implementado:** `location` con sede, calle, barrio, ciudad y país, sin
repetir un valor cargado en dos campos. Más un link de Google Maps en la
descripción, que usa las coordenadas si `sede.geo` está presente.

`sede.geo` existe en el modelo pero el formulario no lo captura, así que hoy
siempre resuelve por dirección.

---

## D-11 · Los slugs se resuelven a etiqueta, con des-slug de respaldo

**Motivo:** la actividad guarda solo el slug (§4.1), así que sin resolver la
descripción del evento diría "a-la-gorra". La Function lee `/opciones/*` con
caché por instancia.

Si un slug no está registrado, se des-sluguea: `"parque-chas"` → `"Parque
Chas"`. El calendario es público y mostrar el slug crudo se ve roto.

El barrio se resuelve **también** dentro de la ubicación: mandarle
"villa-crespo" a Google geolocaliza peor que "Villa Crespo".

**Limitación conocida:** renombrar una etiqueta no actualiza los eventos ya
creados. Está en el [backlog](BACKLOG.md).

---

## D-12 · Los desplegables preseleccionan la primera opción

**Pedido del usuario**, a partir de un bug real: los placeholders de los
desplegables eran textos de ejemplo ("Gratis, a la gorra…", "Taller, club de
lectura…") que se renderizaban como el primer `<option>`, con valor `""`. El
campo se veía **idéntico a uno ya elegido** y al guardar saltaba "Elegí el
arancel" sobre un formulario que parecía completo.

**Lo implementado:** los placeholders se leen como instrucción ("Elegí el
arancel…"), y `arancel`, `tipo` y `plataforma` preseleccionan la primera opción.
`barrio` y `tags` no, porque no tienen opciones base.

**Corregido el 2026-08-21 (D-16):** `arancel` quedó fuera de la preselección.
El texto de abajo describe el estado anterior.

**Riesgo que se corrigió:** `arancel` arrancaba en "Gratis". Si se carga un taller pago y
no se cambia, se publica como gratuito. `tests/opciones-orden.test.ts` fija cuál
es el default de cada campo para que un reordenamiento no lo cambie en silencio.
El usuario está avisado.

---

## D-13 · `dispararRebuild` escrita pero sin desplegar

**Motivo:** es un `onSchedule` cada 5 minutos y todavía no existen el sitio
público ni el workflow de Actions que tendría que disparar. Desplegarla sería
pagar por un schedule que no hace nada.

El flag `sistema/rebuild` **sí** se escribe, así que cuando exista el paso 5 ya
hay de dónde leer.

---

## D-14 · La documentación se actualiza con cada cambio

**Pedido del usuario.** Está en [`05-patrones.md`](05-patrones.md) como regla de
proceso, con la tabla de qué documento toca según el tipo de cambio, y la regla
de que todo reporte de posible bug va al [`BACKLOG.md`](BACKLOG.md) ordenado por
prioridad.

---

## D-16 · `arancel` no se preselecciona

**Decisión del usuario** (2026-08-21), revisando el riesgo que D-12 había
dejado abierto: **arancel obliga a elegir**.

`tipo` y `plataforma` siguen preseleccionando la primera opción, porque ahí
equivocarse es barato — una categoría o una plataforma mal puesta se ve y se
corrige. En `arancel` el default era "Gratis": un taller pago que nadie corrige
se publica como gratuito, en el sitio **y** en el calendario público, y la gente
llega esperando no pagar. Un clic más por actividad vale menos que eso.

`tests/opciones-orden.test.ts` verifica que el atributo
`autoSeleccionarPrimera` **no** esté en el campo de arancel. Es un test que lee
el fuente, poco ortodoxo, pero es la forma de fijar una decisión de producto que
de otro modo se revierte con un copy-paste distraído entre campos vecinos.

---

## D-15 · `urlPublica` se respeta

**Decisión del usuario** (2026-08-21), sobre la pregunta de si el checkbox
"publicar el link de la reunión" debía respetarse o quitarse: **respetarlo**.

**Desvío del §5.2 y del §7.4**, que descartan la URL de la reunión sin
condición. El motivo del desvío es que el modelo del §3.1 tiene el flag
`urlPublica` y el formulario su casilla: ignorarlo era prometer algo que no
pasaba.

**Lo que se mantiene**, y es lo que hace aceptable el desvío: el default sigue
en `false`, el formulario advierte sobre el zoombombing en el propio checkbox, y
sin URL cargada no se inventa el campo aunque el flag esté en true.

Aplica en las dos salidas: `toPublic.ts` y la descripción del evento.

---

## D-20 · La lógica del evento se comparte por alias, no se duplica

**Contexto:** la vista previa del panel (B-12) tiene que mostrar la descripción
del evento tal como va a salir. Esa descripción la arma `construirDescripcion`
en `functions/calendario.js`, que corre en la Cloud Function.

**Decisión:** el panel **importa** esa función. `functions/calendario.js` se
expone al código de `src/` con el alias `@calendario`, declarado en los tres
lugares que resuelven módulos: `astro.config.mjs` (Vite), `tsconfig.json`
(TypeScript) y `vitest.config.ts` (los tests).

**Motivo:** si la vista previa armara su propio texto, las dos versiones se
separarían en el primer cambio y la vista previa mentiría. Una vista previa que
miente es peor que no tenerla, y acá el costo es concreto: la descripción
respeta las reglas de privacidad del §5.1, así que una copia desactualizada
podría mostrar de menos (genera desconfianza) o de más (hace creer que se
publica algo que no se publica). Con una sola fuente de verdad eso sale gratis.

**Por qué funciona:** `functions/calendario.js` es JS puro, sin dependencias de
Firebase ni de red. Está separado así desde el sync (D-07) justamente para poder
testearlo sin emuladores; reusarlo desde el panel es la misma propiedad.

**Alternativas descartadas:**

- *Mover el módulo a `src/lib/` e importarlo desde `functions/`.* La Function se
  despliega con su propio `package.json` y su propio directorio: `functions/` no
  puede importar hacia arriba sin un paso de copiado o build.
- *Un alias con comodín (`@funciones/*` → `functions/*`).* Invitaría a importar
  `functions/index.js` desde un componente cliente, y eso arrastra
  `firebase-admin` al bundle (trampa 4, §5.4). El alias apunta a un solo
  archivo, el que se sabe puro.

**Costo:** `functions/calendario.js` pasó a ser código compartido y entra al
bundle del panel (~6 KB). Cambiarlo ahora afecta dos consumidores, no uno: el
sync y la vista previa. Es la contrapartida buscada — que no se puedan separar.

`debeExistir` (§7.3) también se exportó, para que el aviso de "esto todavía no
está en el calendario" use el criterio del sync y no una copia.

## D-17 · La copia corre las fechas en semanas enteras

**Decisión** (B-11): al duplicar una actividad, la copia conserva la estructura
interna del ciclo intacta —los mismos huecos entre encuentros, las mismas
duraciones— y mueve el bloque completo en **semanas enteras** hacia adelante. El
piso es el más tardío entre hoy y el último encuentro del original.

**Alternativas descartadas:**

- **Las mismas fechas.** Un ciclo del año anterior con las fechas del año
  anterior no sirve, y publicar la copia sin mirar crearía eventos vencidos en el
  calendario.
- **Fechas vacías.** Obliga a cargar ocho fechas de cero, que es justo el trabajo
  que duplicar viene a evitar. Además el formulario abre con ocho errores de
  validación.
- **Correr un año exacto.** Mueve un martes a un miércoles. Los ciclos literarios
  son "los martes a las 19"; el día de semana es parte del dato.

**Por qué el piso es el último encuentro y no solo hoy:** duplicar un ciclo en
curso significa "la próxima edición", y esa arranca cuando la actual termina.
Con un solo criterio quedan bien los dos casos (ciclo viejo y ciclo en curso), y
el desplazamiento mínimo es de una semana: una copia sentada exactamente sobre
las fechas del original no le sirve a nadie.

**Se corre también `inscripcion.cierra`.** Si quedaba en el valor viejo, la
proyección pública calculaba `abierta: false` y la copia salía con la
inscripción cerrada.

**La suma es por componentes locales** (`setDate`), no `+ n * 86400000`: sumar
milisegundos corre el horario del encuentro si en el medio hay un cambio de
horario de verano. Argentina hoy no lo tiene, pero el navegador que carga puede
estar en otro huso.

**Lo que queda a cargo del usuario:** las excepciones del ciclo nuevo (un
feriado, una semana que se corre). Las fechas quedan editables una por una, igual
que las del generador de encuentros del §11.

---

## D-18 · La copia se marca en el título y en el slug

**Decisión** (B-11): la copia arranca como «Título del original (copia)» con
slug `slug-original-copia`, y `-copia-2`, `-copia-3`… si ese slug ya está tomado.
Ambos son propuestas editables.

**Motivo del sufijo en el título:** en el listado, dos filas con el mismo título
son indistinguibles, y la copia es un borrador que hay que revisar. Además el
slug se sigue derivando del título mientras la actividad no esté publicada, así
que en cuanto el usuario pone el título real ("Club 2027") el slug lo acompaña y
el `-copia` desaparece solo.

**El sufijo no se encadena:** duplicar una copia no da "Taller (copia) (copia)"
ni `taller-copia-copia`.

**Riesgo aceptado:** publicar sin revisar deja un "(copia)" a la vista y una URL
`…-copia` que después queda fija (trampa 10). Se mitiga con el aviso arriba del
formulario, que nombra los tres campos a revisar, y con que la copia sea siempre
borrador.

**La unicidad se propone en memoria, se verifica en Firestore.** El listado ya
tiene todos los slugs cargados, así que alcanza para proponer uno libre sin una
lectura extra; `slugDisponible` en el submit sigue siendo la guarda real.

---

## D-19 · Duplicar y borrar van en un menú de acciones

**Decisión** (B-11): cada fila del listado tiene "Editar" como botón y un menú
"⋯" con "Duplicar" y "Borrar".

**Motivo:** el listado es tarjeta en mobile y fila desde `sm`. Tres botones en
fila en 360px dan blancos de ~100px y se erra el toque; el mínimo del proyecto es
44px. De paso, "Borrar" deja de estar pegado a "Editar" y pasa a requerir un
toque deliberado.

**Costo:** un componente propio (`MenuAcciones`) con cierre por click afuera y
por `Escape`. El panel no tiene librería de UI y no se agregó ninguna.


---

## Decidido, sin trabajo pendiente

| Tema | Resolución |
|---|---|
| Home indexable con el placeholder | se deja así (usuario, 2026-08-21) |
| Eventos de prueba en el calendario | los borra el usuario (2026-08-21) |

## Pendiente de decidir

| Tema | Quién decide |
|---|---|
| `libro presentado`: campo propio o dentro de la descripción | usuario |
| Si `arancel` debe seguir preseleccionando "Gratis" | usuario |
