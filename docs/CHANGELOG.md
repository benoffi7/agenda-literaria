# Changelog

Todo cambio de código entra acá. Lo más nuevo arriba.

Formato: qué cambió, y cuando importa, **por qué**. Las decisiones de fondo
están en [`06-decisiones.md`](06-decisiones.md); acá va el registro.

---

## 2026-08-21

### Duplicar una actividad entera · B-11

**Pedido:** un ciclo nuevo suele ser el del año anterior con otras fechas, y
cargarlo de cero son 30+ campos.

En el listado, cada fila tiene ahora un menú "⋯" con "Duplicar", que abre el
formulario precargado con una copia para editar y guardar como actividad nueva.
"Borrar" se mudó a ese mismo menú (D-19).

La lógica de la copia es pura y vive en `src/lib/duplicar.ts`, aparte de
Firestore: acá un bug corrompe los eventos de calendario del **original**. Lo
que la copia no hereda:

- **Los ids de sesión.** Se generan de nuevo con `nuevaSesionId()`. Dos
  actividades compartiendo ids de sesión rompen el diff del §7.2: es la llave
  con la que la Function decide qué evento crear, actualizar o borrar.
- **`calendarEventId`**, que queda en `null` en todas las sesiones. Los eventos
  del original existen en el calendario; los de la copia no. Heredarlos haría
  que editar la copia modifique o borre eventos del original.
- **El slug**, que se propone como `slug-original-copia` y sigue editable
  (D-18).
- **El estado**: la copia arranca en `borrador`, así que no manda nada al
  calendario hasta que el usuario la revise y publique (§7.3).
- **`createdAt`/`createdBy`**, que son de la copia: se guarda por el camino de
  creación, no por el de edición.
- **La cancelación de un encuentro**, que es una excepción del ciclo original
  ("ese martes no hubo"), no una propiedad del ciclo nuevo.

**Las fechas se corren en semanas enteras** hacia adelante, conservando el día
de semana, la hora, las duraciones y los huecos irregulares del ciclo (D-17).
Se corre también el cierre de inscripción, que si no dejaba la copia con la
inscripción cerrada.

El formulario avisa arriba que es una copia y nombra los tres campos a revisar
antes de publicar: título, slug y fechas.

**Tests:** 21 nuevos. Los cuatro invariantes que importan (ids nuevos,
`calendarEventId` en `null`, estado borrador, slug distinto) están cubiertos
como lógica pura y otra vez de punta a punta contra el emulador, verificando que
el documento del original quede intacto.

### `arancel` vuelve a obligar a elegir

D-12 había dejado un riesgo abierto: al preseleccionar la primera opción en
todos los campos con opciones base, `arancel` arrancaba en "Gratis". Un taller
pago que nadie corrige se publicaba como gratuito, en el sitio y en el
calendario público.

Decisión del usuario (D-16): `arancel` es la excepción y obliga a elegir. `tipo`
y `plataforma` siguen preseleccionando, porque ahí equivocarse se ve y se
corrige.

Hay un test que verifica que el atributo no vuelva a aparecer en ese campo — lee
el fuente, que es poco ortodoxo, pero es la forma de que un copy-paste
distraído entre campos vecinos no revierta la decisión en silencio.

### El checkbox "publicar el link de la reunión" ahora hace algo

El modelo del §3.1 tiene `online.urlPublica` y el formulario su casilla, pero la
proyección pública y la descripción del evento descartaban la URL sin mirar el
flag: el formulario prometía algo que no pasaba.

Decisión del usuario: **respetarlo** (D-15). Es un desvío del §5.2 y del §7.4,
que lo descartan sin condición.

Lo que se mantiene y hace aceptable el desvío: el default sigue en `false`, el
formulario advierte sobre el zoombombing en el propio checkbox, y sin URL
cargada no se inventa el campo aunque el flag esté en true.

También se cerraron dos decisiones sin trabajo asociado: la home se deja
indexable con el placeholder, y los eventos de prueba los borra el usuario.

### Documentación del proyecto

Carpeta `docs/` con arquitectura, inventario de infraestructura, modelo de
datos, funcionalidades, patrones, decisiones, seguridad y operación. Más este
changelog y el [backlog](BACKLOG.md).

Se incorporó como regla de proceso que **cada pedido de funcionalidad, arreglo o
modificación de código termina con la documentación actualizada**, y que **todo
reporte de posible bug va al backlog ordenado por prioridad**. Está en
[`05-patrones.md`](05-patrones.md) para que la herede cualquiera que retome el
proyecto.

### La descripción del evento lleva todo lo publicable · `90edc8a`

**Pedido:** que el evento de Calendar tenga toda la info del formulario, y que
la dirección sirva para Google Maps.

Antes el evento llevaba solo título, descripción y la calle. Ahora lleva
modalidad, sede con "cómo llegar" y link al mapa, plataforma, arancel con notas,
inscripción con vía/cupo/cierre, material, organizador, tallerista con bio, tags
y la posición en el ciclo ("Encuentro 3 de 8", numerada por fecha y no por
posición en el array).

Sigue afuera lo que prohíben el §5.1 y el §7.4: el link de la reunión, la
difusión interna, la URL del material privado y los uids.

**Bug arreglado:** la ubicación mandaba solo `sede.direccion` ("Drago 236"), sin
ciudad ni país. Google no tenía con qué desambiguar y el evento quedaba sin mapa
o con el mapa en otra ciudad. Ahora se arma con sede, calle, barrio, ciudad y
país, sin repetir un valor cargado en dos campos.

**Cambio de fondo (D-07):** la guarda anti-loop pasó de una lista de campos
mantenida a mano a comparar el payload del evento antes y después. Al pasar la
descripción de 3 campos a ~20, esa lista era una bomba de tiempo: agregar un
dato sin agregarlo a la lista dejaba de propagar ese cambio, en silencio.

Los slugs de taxonomía se resuelven a su etiqueta contra `/opciones/*`, con
des-slug de respaldo (`"parque-chas"` → `"Parque Chas"`) porque el calendario es
público y el slug crudo se ve roto.

Verificado leyendo el ICS del calendario real. 60 tests sobre el módulo.

### Sync a Google Calendar · `af88f84`

Paso 4 del §10. Functions v2 en `southamerica-east1`, al lado de Firestore.

`functions/calendario.js` no importa Firebase ni googleapis: el diff es la parte
frágil del sistema y aislarlo permite testearlo sin emuladores ni tocar un
calendario real.

Las tres trampas del §13 que viven acá: la guarda anti-loop (§7.1), el diff por
id de sesión y nunca por índice (§7.2), y la propagación de un cambio de sede a
las N sesiones del ciclo (trampa 9).

**Desvío (D-06):** la Function corre **como** `calendar-sync@` en vez de
autenticar con una key. No queda ninguna key para guardar ni rotar. Costo: hay
que otorgar a mano tres roles que la service account por defecto trae de fábrica
— por eso el primer deploy falló dos veces.

Verificado contra producción: crea un evento por sesión, la guarda anti-loop
corta la recursión en la segunda pasada (4 ejecuciones, 2 eventos), un cambio de
sede actualiza los dos encuentros, y despublicar los borra y limpia los ids.

Infra: Blaze habilitado, budget de USD 5/mes con avisos al 50/90/100%, política
de limpieza de imágenes a 1 día, service account `calendar-sync@` con sus cinco
roles, Calendar API habilitada.

### Formulario mobile y arreglo de los desplegables · `2fab7ef`

**Bug reportado:** al guardar aparecía "Elegí el arancel" sobre un formulario que
parecía completo.

**Causa:** el placeholder se renderizaba como el primer `<option>`, que vale
`""`, y los textos eran ejemplos ("Gratis, a la gorra…", "Taller, club de
lectura…"). El campo se veía idéntico a uno ya elegido. Pasaba en los cuatro
desplegables, no solo en arancel.

**Arreglo:** los placeholders se leen como instrucción, y `arancel`, `tipo` y
`plataforma` preseleccionan la primera opción (D-12). `tests/opciones-orden.test.ts`
fija cuál es el default de cada campo para que un reordenamiento no lo cambie en
silencio.

**Mobile y tablet:**

- Campos a 16px hasta `sm`. **iOS Safari hace zoom** sobre la página al enfocar
  un input de menos de 16px y después no vuelve solo.
- `viewport-fit=cover` con `env(safe-area-inset-*)` en la barra fija, que en un
  iPhone quedaba debajo de la barra de gestos.
- Blancos táctiles de 44px, solo cuando el puntero es grueso.
- Lo que no cabe en 360px pasa a columna.
- El resumen de errores de la barra fija se reduce a un contador: cuatro rutas de
  campo tapaban media pantalla.
- Teclados por campo, y sin autocapitalizar en slug, handles y URLs.
- El encabezado del acordeón pasó a `<button>`: se abre con teclado y lo anuncia
  el lector de pantalla.

### Deploy del panel a Firebase Hosting · `384ac32`

Firestore creado en `southamerica-east1` (**región irreversible**), reglas e
índices desplegados, panel publicado en https://agenda-literaria.web.app/admin
con `noindex`.

La config del SDK web quedó versionada en `.env.production` (D-08): no es
secreta, viaja en el bundle por diseño, y así el deploy no configura nada.

`scripts/preparar-produccion.mjs` siembra `/opciones/*` de forma idempotente y
deja el claim `admin` en las cuentas que cargan. Usa las ADC de gcloud, sin
bajar ninguna key.

Verificado en producción: la escritura anónima a `/actividades` y a `/opciones`
se rechaza, y la lectura de `/opciones` funciona sin auth porque la necesitan
los chips de filtro del §4.4.

### Modelo, reglas, emuladores y panel de carga · `9a45c86`

Pasos 1 y 2 del §10. Modelo del §3 en TypeScript, reglas del §5.3, emuladores, y
el formulario completo del §11: condicional por tipo, editor de sesiones con ids
uuid, taxonomías autogestionadas con autocompletado, y material.

Decisiones: sin librería de formularios (D-01), las etiquetas de "Otro" se
persisten en el submit (D-02), las opciones base en un JSON compartido con los
scripts (D-03), la regla de lectura suma `|| esAdmin()` (D-04).

**Bug encontrado por un test:** las reglas usaban `request.auth.token.admin`.
Leer una clave ausente de un map en las reglas es un *evaluation error*, no
`false`, así que cualquier usuario sin el claim hacía fallar la regla (D-05).

Cobertura de las trampas del §13: ids de sesión por uuid, `Timestamp` y no
strings, slugify de taxonomías, y la proyección pública que no filtra el link de
la reunión, la difusión ni los uids.
