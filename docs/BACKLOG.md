# Backlog

Ordenado por prioridad. **Todo reporte de posible bug entra acá**, incluso si se
arregla en el momento: en ese caso va directo a [Cerrados](#cerrados), para que
quede el rastro de qué se rompió y por qué.

Prioridades: **P0** rompe algo o pierde datos · **P1** bloquea el objetivo del
proyecto · **P2** mejora real · **P3** cuando sobre tiempo.

---

## Decisiones pendientes del usuario

Nada de esto se puede avanzar sin respuesta. Están primero porque bloquean
trabajo.

| # | Tema | Contexto |
|---|---|---|
| DEC-1 | ~~`libro presentado`~~ **resuelto e implementado el 2026-08-26** (D-126). | El §11 lo lista para presentaciones y charlas, pero el §3.1 no lo tiene en el modelo. Decidido el 2026-08-21: campo propio con título de la obra y autor de la obra si difiere del invitado, para poder filtrar y mostrarlo aparte. |
| DEC-6 | **El nombre está: «Agenda LEH — Leer, Escribir, Hacer».** Falta **registrar el dominio**, y con eso arranca B-109. | Resuelto el 2026-08-27. Era el bloqueo de la cadena entera: sin nombre no hay dominio, sin dominio no hay `site`, y sin `site` no hay canonical, ni Open Graph, ni sitemap — o sea B-109 y con él **B-01 a B-114**. El acrónimo hace trabajo: «LEH» es corto para la marca y «Leer, Escribir, Hacer» funciona como la línea de qué es, que también hacía falta (va en `og:site_name`, en el `Organization` y en las cinco imágenes de OG). Y «Hacer» abre el paraguas más allá de talleres y clubes, que es donde entraron «Feria» y «Librería a la calle». **Lo que falta decidir es qué parte del nombre va en el dominio** —el completo es largo para una URL— y registrarlo antes de que se indexe nada. Sigue abierto además el handle de Instagram (#2, ya decidido el canal) y las decisiones #4 a #8 del §11.1 de [`12-sitio-publico.md`](12-sitio-publico.md), que ya no bloquean: el sitio se puede empezar. |

Resueltas el 2026-08-26:

| # | Tema | Resolución |
|---|---|---|
| DEC-7 | La galería de imágenes (B-167), cuatro decisiones — **implementado en dos tajadas, 2026-08-26 y 2026-08-28** (D-125 y D-131); lo único que falta de (d) es la Function, que es **B-220** | (a) **un solo campo opcional**, que es un epígrafe; el texto alternativo sale del título de la actividad — decisión de accesibilidad tomada a propósito, no un olvido. (b) **hasta 4 imágenes de 3 MB**, validado en el schema **y** en `storage.rules`, porque el cliente se puede saltear; el mensaje de rechazo tiene que decir el tamaño real y el máximo, que 3 MB es menos que una foto de celular sin recortar. (c) **conviven externas y propias** desde el día uno, así que entra Firebase Storage con todo lo que arrastra. (d) las **propias se optimizan** del lado de la Function (EXIF, recompresión, miniatura) y las **externas se sirven tal cual**, sin descargarlas al build. Ojo con la trampa que aparece acá y no está en el §13: una Function que escribe la miniatura en el mismo bucket **se dispara a sí misma** — es la trampa 3 con otra cara. |
| DEC-8 | Las N opciones para sumarse a un mismo ciclo (B-181) | **Eje nuevo `opciones: [{ id, etiqueta, sesiones }]`** — el más fiel y el más caro, que es lo que el reporte describe literalmente. Toca el schema, el formulario, la proyección, el diff del §7.2 y la numeración de D-95; los ids van generados en el cliente (trampa 2). Va **después de B-167 y antes de descongelar el sitio**: hoy el daño es un calendario con eventos de más, y después es información equivocada indexada en Google. |
| DEC-9 | Cómo se llama la librería que sale a la calle (B-192) — **implementado el 2026-08-26** | Slug **`libreria-a-la-calle`** — el más concreto de los tres propuestos, y por eso el que menos se va a estirar para significar otra cosa. El label es cambiable; el slug no (la lección de B-134). Va `fijo: true` con su test, y la cascada del §11 es la de «Feria»: prende `esCiclo` —una semana de la librería son varias jornadas— y no pide tallerista ni material. |
| B-28 | ¿Claim `curador` para aprobar? | **No, queda como está.** Con dos cuentas de confianza es maquinaria de permisos para un problema que todavía no existe, y mover la aprobación a un campo propio —que es lo que las reglas necesitarían— toca reglas, modelo y la pantalla de taxonomías. Vuelve cuando entre una tercera cuenta que no sea de confianza. |
| B-29 | ¿Auto-aprobar una etiqueta que reusa una segunda cuenta? | **Sí.** Y es más barato de lo que parecía: `ValorOpcion` ya tiene `huellaCreador`, así que comparar esa huella con la de quien guarda alcanza, dentro de la misma transacción del §4.2 que ya incrementa `usos`. Dos bordes: si `huellaCreador` está ausente (documentos viejos) **no** se auto-aprueba, porque no se puede saber de quién era; y queda por decidir si la etiqueta aprobada así **se marca** en la pantalla de taxonomías o desaparece de pendientes sin rastro — conviene marcarla, es lo que permite deshacer el typo que las dos personas escribieron igual. |
| B-102 | ¿El sistema guarda algo de quien se inscribe? | **No**, ratificando la recomendación que ya estaba escrita. Hoy el sistema no guarda ni un dato personal de un tercero, y por eso el §5 cabe en una tabla. Si algún día hace falta, el orden es al revés del intuitivo: primero el aviso público (B-98), después el estado agregado (B-97), y la lista de personas solo si eso no alcanzó. |
| B-124 | ¿Cuándo corren los auditores? | **A pedido**, como hoy. La mitigación es que `/antes-de-pushear` los lanza a los tres con un comando, así que "a pedido" no es "a mano". Y conviene usarlo: en el cierre de la `1.2.0` los tres auditores encontraron **dieciséis** bugs en tres pasadas, dos de ellos P1 de privacidad. |

Resueltas el 2026-08-21:

| # | Tema | Resolución |
|---|---|---|
| DEC-3 | Checkbox "publicar el link de la reunión" | **respetarlo** → implementado (D-15) |
| DEC-4 | Home indexable con el placeholder | se deja así |
| DEC-5 | Eventos de prueba en el calendario | los borra el usuario |
| DEC-2 | `arancel` preseleccionaba "Gratis" | **obliga a elegir** → implementado (D-16) |

---

## Pendiente de acción manual del dueño

Código terminado, no se puede avanzar sin credenciales que un agente no debe
crear ni ver (§5.4).

### B-20 · Activar el rebuild automático (cierra B-02) — ✅ hecho y verificado de punta a punta (2026-08-25)

Los cinco pasos que dependían del dueño, en el orden en que se hicieron (comandos
exactos en [`08-operacion.md`](08-operacion.md) → "Activar el rebuild automático"):

1. ~~Crear el PAT de GitHub~~ — **hecho** (existe desde el 2026-08-21).
2. ~~Habilitar `secretmanager.googleapis.com` y crear el secreto `GITHUB_TOKEN`,
   dándole `secretAccessor` a `calendar-sync@`~~ — **hecho** (2026-08-21).
3. ~~Crear la service account `deploy-ci@` con `datastore.viewer` +
   `firebasehosting.admin`~~ — **hecho el 2026-08-25**, con esos dos roles y sin
   ninguna key.
4. ~~Bajar la key de `deploy-ci@`, cargarla como secret
   `FIREBASE_SERVICE_ACCOUNT` en GitHub y borrarla del disco~~ — **hecho el
   2026-08-25**. La corrida de las 18:04 publicó `1.1.0+675d9e5` desde CI: reglas,
   índices, sitio y panel, todo verde.
5. ~~`firebase deploy --only functions:dispararRebuild`~~ — **hecho**: está
   ACTIVE, y su `repository_dispatch` ahora sí arranca el workflow (era **B-188**,
   arreglado el mismo día).

**Los cinco pasos están hechos y el lazo funciona.** Verificado el 2026-08-25
mandando el mismo `event_type: 'rebuild'` que manda la Function: «Build y deploy del
sitio» arrancó, imprimió el motivo del `client_payload` y publicó `1.1.0+ad973b8`.
Lo que faltaba después de las credenciales era un bug, **B-188**, arreglado el mismo
día.

Lo que **sí** quedó funcionando: **un push a `main` publica el sitio y el panel
solo**. Lo que no, y era una contra asumida: todo push que toque `functions/` deja
la corrida roja, porque `deploy-ci@` no tiene —a propósito— los roles para
desplegar Functions, y con la corrida roja se saltea también el job del tag de
versión. El razonamiento está en
[`02-infraestructura.md`](02-infraestructura.md) § "Roles de `deploy-ci@`".

> **Se levantó el 2026-08-28 (D-132, B-194).** Los seis jobs terminan bien; un
> push publica reglas, índices, sitio, panel, Functions y tag. Lo de arriba queda
> como el estado del 2026-08-25.

#### Lo que enseñó el camino, que valía más que los pasos

Todo esto se midió el 2026-08-25 activando el deploy, y ninguna era una previsión:

- **El inventario mentía, siempre hacia el mismo lado.** Los pasos 1, 2 y 5
  figuraban como pendientes y estaban hechos desde el 2026-08-21 (el PAT en Secret
  Manager, y `dispararRebuild`/`guardarVersion`/`reporteAIssue` **ACTIVE**). Este
  ítem parecía mucho más grande de lo que era porque la doc mostraba como pendiente
  trabajo terminado hacía días.
- **El paso 4 era el que desbloqueaba todo.** Sin `FIREBASE_SERVICE_ACCOUNT` no se
  publica ni el sitio ni el panel, o sea que **ningún** cambio de código llegaba a
  producción por CI — no solo el rebuild de datos, que es de lo que hablaba este
  ítem al escribirse.
- **Un job de reglas que falla bloquea el deploy del sitio.** El `if` del job de
  Hosting pide `needs.firestore.result != 'failure'`, así que la primera corrida con
  credencial salteó Hosting por un permiso que le faltaba al job de reglas. Es el
  "reglas primero" llevado hasta el final y está bien que sea así, pero conviene
  saberlo antes de leer una corrida roja.
- **`workflow_dispatch` siempre deploya todo**, con o sin el checkbox: sin
  `github.event.before` el script no puede diffear y falla hacia el lado de
  deployar. El botón *Run workflow* no sirve para probar solo Hosting.
- **El build pasa sin credencial, y hoy está bien que pase:** ninguna página lee
  Firestore todavía. Lo que eso destapó es para después — la guarda que avisaría,
  `hayCredenciales()`, **existía y no la llamaba nadie** (**B-189**, cerrado en
  `1.2.0`).

### B-21 · Alerta de rebuild agotado — código y runbook listos, falta el click del dueño

Cuando el rebuild se rinde después de cinco intentos, loguea
`el rebuild agotó los reintentos` con nivel `error` y deja el motivo en
`sistema/rebuild`. Convertir eso en un aviso real es una log-based alert de GCP:
configuración de consola, no código, y queda a criterio del dueño (D-23).

**Lo que se hizo del lado del código (2026-08-24):** ese log lleva ahora el
campo `alerta: "rebuild-agotado"`, para que el filtro de la alerta apunte a un
campo estable y no al texto del mensaje —que se rompería en silencio el día que
alguien reescriba la frase—. El filtro exacto y los pasos de la consola están en
[`08-operacion.md`](08-operacion.md) § "Alerta de rebuild agotado".

**Lo que queda, y solo lo puede hacer el dueño:** crear la alerta en su proyecto
de GCP con un canal de notificación propio. **Ya tiene sentido:** `dispararRebuild`
está desplegada, B-20 cerrado y el lazo verificado de punta a punta el 2026-08-25.

**Este ítem apuntaba a un runbook que no existía**, y eso se arregló el 2026-08-25:
decía que "el filtro exacto y los pasos de la consola están en `08-operacion.md`
§ 'Alerta de rebuild agotado'" y `grep -i alerta` sobre ese archivo no devolvía nada.
La referencia era una promesa, no una instrucción, justo en el único paso que solo
puede dar el dueño. **Ahora la sección existe**, con los tres pasos: mirar una entrada
real antes de fijar el filtro (las Functions v2 aparecen como `cloud_run_revision` y
no como `cloud_function`, y el `service_name` va en minúsculas), crear la alerta, y
qué hacer cuando llegue.

Lo único que queda es el click y el canal de notificación, que es dato personal y
configuración de consola (§5.4).

---

## P0 — rompe algo o pierde datos

**Todos arreglados.** Cuatro, en dos tandas y de dos clases distintas:

- **B-80 y B-82** (2026-08-24) salieron de revisar las costuras del merge del
  2026-08-21: cada feature estaba testeada por dentro, el par no. Los tests que
  los demuestran están en [`tests/costuras.test.ts`](../tests/costuras.test.ts) y
  ya no son `it.fails` — pasaron a `it` y ahora son la guarda de que no vuelvan.
- **B-208 y B-209** (2026-08-27) salieron de la auditoría de privacidad, y son de
  otra familia: no rompían nada visible ni perdían datos. **Publicaban.** Ninguno
  de los dos tenía forma de aparecer en un test que estuviera mirando lo que el
  código hace, porque los dos hacían exactamente lo que estaba escrito que
  hicieran — el problema estaba en lo que estaba escrito.

### B-80 · Guardar desde el listado pisa el `calendarEventId` y la edición siguiente duplica el evento — ✅ hecho (2026-08-24)

**Arreglado** del lado de la Function: el write-back repone el id en **toda**
operación del plan, no solo en `crear` y `borrar` (`reponerIds` en
`functions/sincronizacion.js`, D-91). La pasada que pisa el campo es la misma
que lo repara. La salida del lado del panel —que `actualizarActividad` relea y
fusione los ids, y el panel deje de ser dueño del campo— sigue valiendo y quedó
abierta como **B-150**.


**Qué se rompe.** Dos eventos en el calendario público para el mismo encuentro,
y el primero huérfano: nada del sistema lo referencia, así que nada lo va a
borrar nunca. Es el daño de la trampa 3 del §13 por una puerta distinta.

**Cómo se llega.** Es el camino normal, no una carrera exótica:

1. Se publica la actividad. `syncCalendar` crea el evento y **después** escribe
   `calendarEventId` en el documento (segundos, más si la Function arranca en
   frío).
2. `onGuardado` refresca el listado en ese mismo instante
   (`setVersion(v + 1)` → `listarActividades()`), así que el snapshot que queda
   en memoria es de **antes** del write-back: `calendarEventId: null`.
3. Se vuelve a tocar "Editar" en esa fila. `documentoAForm` copia el `null` al
   form y `formADocumento` lo escribe: el id se perdió. El guardado todavía
   actualiza el evento correcto —`planificar` lo saca del `before`—, así que no
   se nota nada.
4. La edición siguiente ya no tiene de dónde sacarlo: `planificar` emite
   `crear`. Segundo evento.

**Por qué no lo agarró nadie.** `syncCalendar` solo escribe ids de vuelta para
las ops `crear` y `borrar` (`idsNuevos` / `idsBorrados`); una `actualizar` no
repone el id que el panel borró. Y el panel es dueño de un campo que escribe la
Function: `formADocumento` lo emite en cada guardado.

**Salidas posibles**, en orden de prolijidad:

- que `actualizarActividad` relea el documento y fusione los `calendarEventId`
  por id de sesión antes de escribir (el panel deja de ser dueño del campo);
- o que `syncCalendar` reponga el id también en las ops `actualizar`, que tapa
  el síntoma pero deja la ventana abierta entre las dos escrituras;
- o que el listado escuche con `onSnapshot` en lugar de `getDocs`, que angosta
  la ventana sin cerrarla (el form se arma una vez, al montar).

### B-82 · `syncCalendar` no es idempotente: una reentrega duplica el evento — ✅ hecho (2026-08-24)

**Arreglado** con el id del evento elegido por el cliente y derivado del id de
sesión (`idDeEvento`, D-90): el `insert` repetido devuelve 409 y se resuelve
actualizando ese mismo evento. La idempotencia quedó en el sistema externo, sin
ningún registro nuevo que la Function tenga que mantener.

La entrega de eventos de Firestore es **al menos una vez**. `syncCalendar`
decide con el payload del evento (`before`/`after`) y no mira el estado actual
del documento, así que la reentrega de la escritura que publicó una actividad
vuelve a emitir `crear`: segundo evento en el calendario público, y el primero
huérfano.

Los otros dos triggers del proyecto sí se blindan, y es la comparación que
muestra el agujero:

- `guardarVersion` usa `idDeVersion(event.time, event.id)`: el reintento
  reescribe el mismo documento (D-43).
- `reporteAIssue` toma el reporte en una transacción y mira `estado`/`github`.
- `syncCalendar` no usa `event.id` en ninguna parte.

La guarda anti-loop del §7.1 no cubre esto: corta la recursión porque la
*segunda* escritura produce el mismo payload, pero una reentrega de la *misma*
escritura trae el mismo `before` y el mismo `after`.

El arreglo natural es el mismo del historial: llevar los ids de evento ya
aplicados por `event.id`, o relee el documento dentro de la transacción del
write-back y no crear si la sesión ya tiene un `calendarEventId`.

---

### B-208 · Un anónimo leía el documento crudo de toda actividad publicada — ✅ hecho (2026-08-27)

**Lo encontró el `auditor-privacidad` en el barrido del 2026-08-27 y se reprodujo
contra el emulador antes de tocar nada.** `firestore.rules` decía
`allow read: if esAdmin() || resource.data.estado == 'publicado'`, que es lo que
prescribe el §5.3 del `CLAUDE.md`. Una query anónima con el
`where('estado','==','publicado')` —permitida, porque cada documento devuelto
cumple la condición— entregaba los documentos **enteros**: `online.url` con
`urlPublica:false`, `difusion.notas` y `arrobar`, la URL del material con
`publico:false`, `createdBy`/`updatedBy`, `sesiones[].calendarEventId` y
`imagenes[].storagePath`. La lista completa del §5.1, salteando `toPublic`.

**Era explotable, no teórico.** El repo es público, `.env.production` está
versionado con `PUBLIC_FIREBASE_PROJECT_ID` y `PUBLIC_FIREBASE_API_KEY`, y
`push-main.yml` deploya las reglas tal cual. Clonar el repo alcanzaba.

**Por qué ninguna red lo vio.** Las cuatro salidas estaban auditadas y correctas.
Esto no era una salida: era una **quinta** puerta que ninguna proyección
atravesaba. Y el test que fijaba el comportamiento —`it('un anónimo lee lo
publicado')`— estaba **en verde y era correcto respecto de su especificación**.
Lo que estaba mal era la especificación. Agrava que `toPublic` todavía no tiene
consumidor (B-106): el 100 % de lo alcanzable desde afuera entraba por acá.

**Arreglo:** `allow read: if esAdmin();` — D-128, con la alternativa descartada
(partir el documento en una subcolección `privado/`) escrita para el día que haga
falta lectura en vivo.

**Red:** tres `it` en `tests/actividades.integracion.test.ts` — el rechazo por
documento, el rechazo por query, y un **control positivo** (`el admin SÍ lee la
publicada, con sus campos privados adentro`) sin el cual los dos rechazos darían
verde sobre una colección vacía. El fixture de la publicada lleva los campos del
§5.1 adentro a propósito: si alguien afloja la regla, el diff dice qué se
filtraba. De paso, este archivo era el único test de reglas que **no** empujaba
las reglas del checkout al emulador (`cargarReglas`), así que en un worktree podía
estar verificando el archivo de otra rama. Ahora las empuja.

**Cierra B-172** (la trampa 7 del §13 quedó cubierta como efecto).

### B-209 · El repo público publicaba los uids y los mails de las dos cuentas admin — ✅ hecho (2026-08-27)

`docs/02-infraestructura.md` tenía una tabla titulada «Cuentas con claim `admin`»
con mail → uid de las dos cuentas, mapeados uno contra otro. El repo es público.
El §5.1 y D-57 son explícitos: uid y mail de admin no salen ni crudos ni
hasheados.

**Lo peor no era la tabla.** Los mismos dos valores estaban como `CENTINELAS.uid`
y `CENTINELAS.mailAdmin` en `tests/fixtures/formulario.ts` — o sea, el dato que no
puede salir vivía en el archivo cuyo trabajo es verificar que no sale, y eran los
dos únicos centinelas de esa lista que no cumplían lo que su propio docblock
promete («inventados y bien reconocibles»). Estaban además en
`tests/opciones-aprobacion.test.ts`, y el mail del dueño en
`docs/02-infraestructura.md` y `docs/09-analitica.md`.

**Es irreversible**, y hay que decirlo: para cuando se detecta, ya está scrapeado
e indexado. Lo que el arreglo consigue es cortar el sangrado, no revertirlo. Un
uid no es una credencial, pero es la mitad del trabajo de un ataque dirigido.

**Arreglo:** los valores salieron de los cinco archivos; los centinelas pasaron a
`CENTINELAuid…` / `centinela-admin@ejemplo.com` (el uid conserva los 28
caracteres, así la forma real se sigue ejercitando); el número de cuenta de
facturación salió de la misma tabla por el mismo motivo; y
`scripts/preparar-produccion.mjs --listar` reemplaza a la tabla — la lista se saca
de Auth cuando se la necesita en vez de vivir versionada.

**Red:** `tests/sin-datos-personales.test.ts`, que recorre `git ls-files`
buscando la **forma** de un uid de Firebase (28 alfanuméricos con las tres clases
de carácter) y casillas en proveedores de correo personales. Es angosto a
propósito y lo dice: un mail en dominio propio (`hola@casabrandon.org`) puede ser
un fixture inventado o real, y este test no puede distinguirlos sin versionar la
lista de dominios reales, que es el dato que no queremos versionar. Esa mitad
queda en el `auditor-privacidad`. Un chequeo angosto que nunca da falsos
positivos vale más que uno ancho que se apaga con excepciones: la tabla que hizo
nacer este test sobrevivió meses en un archivo que nadie sospechaba.

---

## P1 — bloquean el objetivo del proyecto

El proyecto existe para que la gente encuentre los talleres en Google (§2.3). Hoy
eso todavía no pasa, pero por un motivo distinto que antes: **el sitio existe y no
está desplegado.** Falta elegir el dominio (B-109), sin el cual no hay canonical ni
sitemap, y falta el rebuild automático (B-20).

### B-227 · El listado con filtros y la página de detalle — ✅ hecho (2026-08-28)

El primer frente del sitio público: cierra **B-105**, la mitad de **B-107**, y
construye el listado del §6 del diseño entero. El detalle está en
[`04-funcionalidades.md`](04-funcionalidades.md) y el estado sección por sección,
en la caja de arriba de [`12-sitio-publico.md`](12-sitio-publico.md).

Lo que conviene tener anotado acá, que es lo que costó decidir:

- **Cuatro decisiones nuevas** — **D-137** (hay selector de orden, contra el §6.1),
  **D-138** (`creadoEn` es público, con precisión de día), **D-139** (el link de la
  reunión tampoco sale al detalle) y **D-140** (la plantilla recibe un view-model,
  no el documento).
- **Una salida pública nueva**, la sexta: la página de detalle y su JSON-LD.
  Entró al barrido de centinelas **en el mismo cambio que la creó**, que es la
  lección de B-212 y de la salida 5 aplicada a tiempo.
- **Dos bugs que ningún test podía ver** — **B-237** (lo encontró el build de
  verdad) y **B-243** (lo encontró calcular el contraste, que nadie había
  calculado).
- **Cinco hallazgos del `auditor-privacidad`**, todos arreglados: el `url` del
  organizador sin sanear en el JSON-LD, la hora exacta de carga en `creadoEn`, el
  import del lector que dejaba a la plantilla recuperar el documento, las
  etiquetas del detalle filtradas por aprobación (contra D-30) y la salida 6 sin
  nombrar en el mapa de salidas.
- **Abiertos en el camino:** B-238 (hoja de filtros y CTA fijo), B-239 (el peso de
  React en la home), B-240 (la casilla del link dice algo que el sitio no hace),
  B-241 (el fixture del gate de build es anterior a B-224), B-242 (la ayuda del
  panel, cuando el sitio se publique). Cerrados en el camino: B-237 y B-243.

### B-253 · El detalle, el chrome y las tres páginas de texto, con la forma de Eventbrite — ✅ hecho (2026-08-31)

Segundo frente del rediseño de **D-141**: el primero le dio nombre y paleta al sitio
(B-245); éste aplica la **estructura** —portada arriba, jerarquía fuerte, tarjetas
apiladas con superficie y borde y **ninguna sombra**— a la página de detalle, el
encabezado, el pie y `/ayuda`, `/contacto` y `/suscribirse`. La home y el listado son
de otro frente y no se tocaron.

- **Dos decisiones nuevas.** **D-144** (la portada va arriba, con la relación de
  aspecto de `--aspect-portada`; desvío del §4.3 del diseño) y **D-145** (el CTA fijo
  de móvil sin una línea de JavaScript, que cierra la mitad «CTA fijo» de **B-238**).
- **Un archivo nuevo**, `src/components/sitio/estilos.ts`, con el anillo de foco y las
  clases de botón: estaban copiados doce y cinco veces. Lo sostiene **B-257**.
- **El contraste pasa a medirse sobre las tres superficies** y no solo sobre `papel`
  (**B-256**), que con la paleta de D-141 daba un número optimista.
- **Tres cosas que arregló mirar el HTML del build**, ninguna visible para un test
  unitario: **B-254** (todo cancelado no es «ya pasó»), **B-258** (la página daba dos
  cuentas distintas de los mismos encuentros) y la sección «Cómo se cursa» que se
  pintaba vacía sin `modalidades`.
- **Dos cosas que encontró el `auditor-privacidad`**, las dos de red y ninguna de
  fuga: el JSON-LD podía cerrar su propio `<script>` con un título que trajera
  `</script>` (venía de B-227), y el barrido de centinelas ejercitaba **una** de las
  cuatro ramas del aviso — justo no la que interpola un valor.

**Lo que este frente necesita de otros archivos**, y no pudo tocar: `Base.astro` le
pone `overflow-x-hidden` al `body`, que es lo que obliga a que la barra sea `fixed` y
no `sticky` (ver D-145); y `src/pages/index.astro` con `src/components/publico/*`
quedan fuera del alcance del chequeo del anillo de foco hasta que se los migre.

**Sigue sin resolver, y no es nuevo:** una actividad `estado: 'cancelado'` no tiene
página. Es **B-110**.

### B-244 · `campo-nuevo` preguntaba por cuatro salidas, y son seis — ✅ hecho (2026-08-28)

El skill que se invoca **cada vez que se agrega un campo al modelo**
(`.claude/skills/campo-nuevo/SKILL.md`, decisión 1) nombraba `events.json`,
Calendar, el issue de GitHub y GA4. No nombraba `textoRedes.ts` —la salida 5,
desde **B-95**— ni `detallePublico.ts` —la 6, desde **B-227**—.

O sea que se podía seguir el procedimiento al pie de la letra y terminar
publicando un campo nuevo en el **posteo de Instagram** o en la **página que
Google indexa**, sin que nada lo frenara: es exactamente la clase de bug que el
skill existe para evitar, y las dos salidas que faltaban son las dos de las que no
se puede volver.

Lo encontró el `auditor-documentacion`. **La 5 llevaba tres años-persona de
distancia con su propia lección:** la ficha del `auditor-privacidad` había tenido
el mismo agujero, se arregló el 2026-08-27 (B-216) con un test que ata las dos
tablas… y nadie miró el skill, que es el documento que de verdad se ejecuta.

Arreglado con la tabla de las seis y una nota de por qué. El paso «Proyección
pública» también se reescribió: eran cuatro archivos en cadena y nombraba uno.

### B-01 · Sitio público (paso 3 del §10)

Lo que falta:

- ~~`src/pages/index.astro` — listado con la island de filtros.~~ ✅ B-227
- ~~La island que lee `events.json` y filtra en memoria (§2.5).~~ ✅ B-227
  (`src/components/publico/Buscador.tsx`)
- ~~`src/pages/actividad/[slug].astro` — detalle por SSG con `getStaticPaths`.~~
  ✅ B-227
- ~~Generación de `events.json` en build time con el Admin SDK.~~ ✅ B-106
- Los hubs (B-108), `/pasadas` y el SEO absoluto (B-109), las canceladas (B-110).

Ya está hecho y testeado: la proyección (`toPublic.ts`), la normalización de
búsqueda (`normalize.ts`) y el acceso de build time (`firebase-admin.ts`).

**Ojo:** toda query pública necesita `where('estado','==','publicado')` o
Firestore rechaza la query entera (trampa 7).

**El diseño está hecho: [`12-sitio-publico.md`](12-sitio-publico.md).** URLs,
pantallas, SEO, filtros y casos borde, decididos con su motivo. B-01 queda como
el paraguas; lo construible son **B-105 a B-114**, en el orden del §13 de ese
documento.

### B-105 · El detalle y la home — ✅ hecho (2026-08-28, en **B-227**)

Construido con dos desvíos del plan de abajo, los dos anotados en la caja de
estado de [`12-sitio-publico.md`](12-sitio-publico.md): el markup de la tarjeta se
define una sola vez en un **componente React** que Astro renderiza sin hidratar
(en vez de un componente Astro más un `<template>`), y la island **monta su propia
lista sacando la del build del DOM** en vez de mostrar y ocultar por `data-id`. Se
conservan las cuatro propiedades que el §6.3 perseguía —HTML completo del build,
sin-JS servido, sin parpadeo, un solo markup— y el filtrado queda como lógica pura
testeable (`src/lib/listadoPublico.ts`, 58 casos).

Lo que queda afuera y tiene su ítem: la hoja inferior de filtros y el CTA fijo de
móvil (**B-238**), el peso del runtime de React en la home (**B-239**).

El plan original, como estaba escrito:

`src/pages/actividad/[slug].astro` (SSG con `getStaticPaths`, **cero
JavaScript**) y `src/pages/index.astro` con `src/components/Filtros.tsx` como
island.

El detalle primero: es el que recibe el tráfico de Google y de Instagram, y es
el que no depende de nada más (§1 y §4.3 del diseño).

La home es un **listado híbrido** (§6.3): el build imprime en HTML todas las
tarjetas vigentes con sus `data-*` de filtrado, y la island muestra y oculta lo
que ya está en el DOM. Con JS apagado se ve la lista completa y "Explorá por"
—links a los hubs— es la navegación. El markup de la tarjeta se define **una
sola vez**, en el componente Astro, y la island clona un `<template>` para las
tarjetas que no están en el HTML (las pasadas).

**Ojo:** todas las fechas se formatean con
`Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })`,
en el build y en el cliente. El JSON las lleva en UTC (trampa 1).

### B-106 · `events.json` en build time — ✅ hecho (2026-08-27)

**Hecho.** `src/pages/events.json.ts` lee Firestore con el Admin SDK en el build y
`src/lib/eventsJson.ts` arma el índice. Las tres cosas que el ítem marcaba como no
obvias salieron como estaban diseñadas:

- **El recorte** (§3.1) es una proyección aparte y **recibe una `ActividadPublica`,
  no una `Actividad`**: así no puede volver a decidir sobre `difusion` o
  `createdBy` — esa decisión ya está tomada un eslabón antes. Tiene su propio
  barrido de centinelas, con control negativo que exige que la falta de recorte
  falle nombrando `inscripcion.destino`.
- **La guarda de credenciales** (D-123): en CI sin credenciales el build **falla**
  —probado: sale con estado 1 y no emite el archivo— y en local sigue con lista
  vacía y un aviso. Las dos ramas verificadas a mano.
- **La cabecera `no-cache`** en `firebase.json` → **cierra B-37**.

Y arrastró **B-111**, que era dependencia dura de la forma diseñada: el índice
lleva `cierraEn` y no el booleano `abierta`, que se congela en el build.

Lo que **no** entra y queda para el sitio: el `?v=` con el que la island va a pedir
el archivo (no hay island todavía, es B-105) y el `estado` en la proyección, que es
B-112 y lo necesita la franja CANCELADA del detalle, no el filtrado.


Lectura de Firestore con el Admin SDK, `toPublic.ts`, y el índice que la island
filtra en memoria (§2.4, §2.5). Incluye las opciones de `/opciones/*` en el
mismo archivo (§4.4) para que los chips no tengan nada cableado.

Tres cosas que no son obvias (§3 del diseño):

- **El JSON recorta más que `toPublic`**: no lleva `descripcion`,
  `inscripcion.destino`, `sede.direccion`, `sede.geo`, `sede.indicaciones`,
  `material`, `tallerista.bio`, `sesiones[].tema` ni `sesiones[].lectura`. Nada
  de eso se usa para filtrar, todo vive en el HTML del detalle, y sacar el mail
  de inscripción del JSON deja de servirlo en lote a los bots.
- **Sin credenciales, en CI el build falla** (`hayCredenciales()`). Un deploy
  con cero actividades borra el sitio de Google y se recupera en semanas. En
  local sigue con lista vacía.
- **Cabecera de cache `no-cache` para `/events.json`** → **cierra B-37**. La
  island lo pide con `?v={VERSION_APP}`.

### B-107 · Meta, Open Graph y JSON-LD — 🟡 **la mitad hecha** (2026-08-28, en B-227)

**Hecho:** `title` y `description` de la home y del detalle; el JSON-LD completo
—`EducationEvent`/`LiteraryEvent`/`Event`, `EventSeries` con `subEvent` por sesión,
fechas con offset, `offers` con precio solo si es gratis, `performer` solo si hay
tallerista, cancelados marcados con su fecha original— y **el link de la reunión
fuera del JSON-LD**, que ahora es más estricto de lo que decía este ítem: tampoco
va la URL canónica, porque no existe (ver abajo). Fijado en
`tests/detallePublico.test.ts` y en su `describe` del barrido de centinelas.

**Falta, y todo por el mismo motivo — `site` no existe hasta que haya dominio
(B-109):** `canonical`, Open Graph, `twitter:card`, las cinco imágenes de
`public/og/`, el `url` de `VirtualLocation` y de `offers`, el `BreadcrumbList` y
el `CollectionPage`/`ItemList`. Inventar una URL absoluta ahora es peor que no
ponerla: una canónica equivocada le dice a Google que la página buena es otra.

El plan original, como estaba escrito:

Va pegado a B-105: una página de detalle sin datos estructurados no sirve para
lo que existe el proyecto (§2.3).

- `title` / `description` / `canonical` por tipo de página (§5.1 del diseño). El
  título de la actividad primero, y el barrio adentro.
- Open Graph completo + `twitter:card`. Sin `imagenUrl`, cinco imágenes
  estáticas de 1200×630 en `public/og/`, una por tipo: un link sin preview en
  Instagram no se toca.
- **JSON-LD `Event`**: `EducationEvent` para taller y club de lectura,
  `LiteraryEvent` para encuentro, presentación y charla. Un ciclo es un
  `EventSeries` con un `subEvent` por sesión — una actividad, N encuentros
  (§2.2), no ocho eventos que compiten entre sí.
- **Fechas con offset `-03:00`**, no `Z`.
- **`offers` con precio solo si `arancel.tipo == 'gratis'`** (`0` / `ARS`). Un
  `0` en un taller arancelado es un dato falso en un formato que las máquinas
  creen.
- **El link de la reunión no va al JSON-LD nunca**, ni con `urlPublica: true`
  (D-15): `VirtualLocation.url` es la URL canónica de la actividad. El JSON-LD
  es lo primero que cosecha un bot (trampa 5).
- Además: `BreadcrumbList` en el detalle, `CollectionPage` + `ItemList` en la
  home y los hubs, `Organization` en `/acerca`.

### B-108 · Los hubs: `/tipo/*`, `/barrio/*`, `/online`, `/gratis`

Un solo componente de página con el subconjunto ya filtrado en HTML y la island
montada con el filtro preaplicado y visible como chip. Es lo que gana
`taller de escritura villa crespo` y `club de lectura online`: un filtro no
puede, porque no tiene URL ni `h1` (§2.1 del diseño).

Los de tipo y barrio se generan recorriendo `/opciones/{tipo,barrio}` — una
opción nueva trae su hub sola. El slug de la URL es el **slug** de la taxonomía,
nunca el label: el label se renombra (§4.1) y una URL no (trampa 10).

Un hub que se queda sin actividades vigentes **no se borra**: se genera vacío,
con aviso y links. Un 404 sobre una URL indexada es peor.

### B-109 · `site`, `robots.txt`, `sitemap.xml` y `/pasadas`

**Va primero de todo**, porque depende de la decisión del dominio (§11.1 del
diseño) y porque canonical, Open Graph y sitemap necesitan URLs absolutas.
`astro.config.mjs` hoy **no tiene `site`**.

El sitemap se genera a mano (endpoint estático), no con `@astrojs/sitemap`: las
reglas de qué entra —90 días para las pasadas, 30 para las canceladas, meses con
3 o más— son nuestras. `lastmod` necesita B-112; sin eso se omite, que es mejor
que estampar la fecha del build en todo.

`/pasadas` entra acá y no en B-108 porque su razón de ser es de indexación: sin
esa página, cada actividad que pasa se convierte en una página huérfana que solo
el sitemap enlaza.

### B-110 · Una actividad cancelada no puede devolver 404

Hoy el camino natural (`estado == 'publicado'`) hace que una actividad cancelada
pierda su página. La URL estuvo tres semanas en Instagram y en Google, y a quien
pregunta "¿se hace o no se hace?" el sitio le contesta "no existe".

Lo que hay que hacer (§7.3 del diseño): el build también trae
`estado == 'cancelado'`, genera la página con la franja `CANCELADA`, sin CTA, con
las fechas intactas y `eventStatus: EventCancelled` — que es exactamente lo que
Google pide. No entra al listado ni a `events.json`. Sale del sitemap a los 30
días.

**Sigue abierto después de B-253 (2026-08-31), y ahora hay una promesa esperándolo.**
El rediseño de la página de detalle le dio forma al aviso de arriba —los cuatro
estados con su prioridad, incluida la rama `cancelado`— pero el lector
(`contenidoDelSitio.ts`) sigue trayendo solo `estado == 'publicado'`, así que esa rama
solo se activa cuando **todos los encuentros** están cancelados y nunca cuando lo está
la actividad. Nada de este punto cambió.

Lo que sí cambió es que ahora se sabe que **`src/lib/ayudaDelSitio.ts` ya le promete
esto a quien lee el sitio**: «si se cancela la actividad entera, la página no
desaparece: queda con el aviso de que se canceló». Hoy devuelve 404. Lo encontró el
`auditor-privacidad` mirando B-253. Al cerrar este ítem hay que verificar ese texto —
o corregirlo antes, si esto se demora.

**Solo si estuvo publicada alguna vez**, que hoy no es un dato del modelo. La
heurística disponible es que alguna sesión tenga `calendarEventId` (el sync solo
crea eventos de actividades publicadas), y el build la puede leer porque trabaja
sobre el documento crudo. Lo correcto es un `publicadaAlgunaVez: boolean` — es
una de las decisiones de §11.1.

### B-111 · `inscripcion.abierta` se congela en el build y miente — ✅ hecho (2026-08-27)

**Hecho** como parte de B-106, porque era dependencia dura de la forma diseñada del
índice: `toPublic` proyecta `cierraEn` (el ISO de `cierra`) **además** del booleano,
y el `events.json` lleva la fecha. Quien consume la recalcula con **su** reloj.

`abierta` se conserva —el arreglo era «además del booleano», no «en lugar de»—
porque un consumidor sin JavaScript no puede recalcular nada.

**De paso, la lista de claves de `toPublic.test.ts` hizo su trabajo:** agregar la
clave puso la suite en rojo nombrándola, que es exactamente para lo que está esa
lista. Un campo nuevo en una proyección pública tiene que ser una decisión.


`toPublic` calcula `abierta` con `Date.now()` **del momento del build**. Una
inscripción que cerró a la mañana sigue diciendo "abierta" hasta el rebuild
siguiente. El rebuild automático ya corre solo (**B-20**, cerrado el 2026-08-25),
así que la ventana bajó de días a los ~2-7 minutos del debounce del §8 — pero
sigue siendo real, y no depende de que alguien edite: el `abierta: false` se
calcula **en el build**, así que sin un cambio que dispare rebuild nadie
recalcula nada y el sitio invita a anotarse en algo que ya cerró.

Arreglo: proyectar **`inscripcion.cierraEn`** (el ISO de `cierra`) además del
booleano. Con la fecha, el HTML puede decir "las inscripciones cierran el 22 de
septiembre" —que es lo que hace que alguien escriba hoy— y el cliente recalcula
si ya cerró. No expone nada nuevo: es una fecha que la página ya quiere mostrar.

Hoy no se nota porque no hay sitio público. Va antes de B-108 porque el detalle
ya lo necesita.

~~B-02 · Trigger de rebuild~~ → [cerrado](#cerrados), con pasos manuales
pendientes del dueño (ver arriba).

### B-83 · El rebuild del sitio cuelga del sync a Calendar — ✅ hecho (2026-08-24)

**Arreglado:** `marcarRebuild` pasó arriba de los dos cortes, con la condición
`huboCambioDeContenido(antes, despues)` — el mismo criterio del historial
(D-41), para que el write-back de la propia Function no pida un build por cada
sincronización (D-92).

`syncCalendar` marca `sistema/rebuild` en la **última** línea, después de dos
cortes tempranos: `if (ops.length === 0) return;` y `if (!CALENDAR_ID) return;`.
Consecuencia: un cambio que no altera el evento del calendario no pide rebuild y
el sitio público se queda con el dato viejo.

Los campos que salen al `events.json` (§5.2) y **no** entran al evento de
Calendar son `destacado`, `imagenUrl`, `searchText` y el `slug`. Así que tildar
"Destacar en la portada" o corregir la imagen de una actividad ya publicada no
se ve nunca en el sitio, hasta que alguien edite otra cosa. Es la trampa 8 del
§13 con otro disparador: ahí era olvidarse de `/opciones/*`, acá es que el
rebuild sea un efecto secundario del sync.

Segundo caso, el mismo agujero: sin `GOOGLE_CALENDAR_ID` configurado la Function
loguea el error y vuelve **antes** de marcar el rebuild, así que un proyecto sin
calendario no publica nada nunca.

El arreglo es mover `marcarRebuild` arriba de los dos cortes: el rebuild
corresponde porque la actividad cambió, no porque el calendario haya recibido
operaciones. Cuesta un build de más cuando el cambio es solo interno
(`difusion`), que al lado de esto es gratis — el debounce del §8 ya los junta.

Tests en [`tests/costuras.test.ts`](../tests/costuras.test.ts).

---

### B-167 · Galería de imágenes: una lista, con descripción, propias o de afuera — ✅ las dos tajadas hechas (2026-08-26 y 2026-08-27)

> **Estado al 2026-08-27.** La primera tajada (modelo + editor de URLs externas)
> salió en `1.3.0`. La segunda —**subir un archivo propio**, que es lo que el dueño
> reclamó con «no estoy viendo lo de cargar imágenes»— salió después: entra
> `storage.rules`, el emulador de Storage, la línea `storage=` de
> `que-deployar.sh`, y `src/lib/subir-imagen.ts` cargado con `import()`. Razonamiento
> en **D-131**; las dos preguntas que bloqueaban están resueltas en **B-206**.
>
> **Lo que sigue abierto**, y con ítem propio para que no se confunda con esto: la
> Function de DEC-7d —recompresión y miniatura— es **B-208**; la limpieza de objetos
> huérfanos es **B-209**; servirlas por dominio propio, **B-210**. Todo lo que este
> ítem describe abajo se hizo salvo esos tres, y las anotaciones de más abajo dicen
> cómo quedó cada punto.

Pedido del dueño (2026-08-24): una actividad tiene una **lista** de imágenes,
cada una con descripción opcional; cada imagen puede ser una **URL de otro lado**
o un archivo que **subimos y alojamos nosotros**. Y **vista previa**, incluida en
el momento de pegar una URL.

Está en P1 y no en P2 por una razón de orden, no de urgencia: **el modelo pasa de
un campo a una lista**, y B-107 (Open Graph y JSON-LD) necesita exactamente una
imagen. Si la galería entra después del sitio público, se rehace la tarjeta, el
detalle, la proyección y el `events.json`. Entra antes de B-01, o se paga dos
veces.

#### El cambio de modelo, y la migración que no se ve

Hoy es `imagenUrl: string | null` y toca nueve archivos: `types/actividad.ts`,
`schema.ts`, `actividades.ts` (las dos conversiones), `toPublic.ts` (tipo y
proyección), `ActividadFormulario.tsx`, `analytics-eventos.ts` y un comentario de
`functions/index.js`.

Pasa a algo como `imagenes: [{ id, url, descripcion, origen: 'externa'|'propia',
storagePath?, ancho?, alto?, portada? }]`.

**Los ids se generan en el cliente, nunca por índice** — es la trampa 2 del §13,
la misma que costó el diff de sesiones: borrar la segunda imagen renumera todo y
cualquier cosa que compare por posición cree que cambiaron todas.

**El default de lectura es la parte que se olvida.** Los documentos que ya están
en producción tienen `imagenUrl` y no tienen `imagenes`. La lectura tiene que
convertir `imagenUrl` en una lista de un elemento marcada como portada, y hay que
decidir si se hace **al leer para siempre** (compatible, código que queda) o con
una **migración de una vez** (más limpio, pero es un script que escribe en
producción). Con el volumen actual la migración es de minutos.

#### Lo que aparece por primera vez: Firebase Storage

No hay Storage en el proyecto. `firebase.json` tiene `firestore` y `hosting`, y
nada más. Entra un producto nuevo, y con él:

- **`storage.rules`, que son un archivo aparte de `firestore.rules`.** Escritura
  solo con el claim `admin`, y ahí aplica D-05 tal cual: `request.auth.token.admin
  == true` es un **error de evaluación** cuando el claim no está, no `false`. Va
  `token.get('admin', false)`.
- **Un target de deploy que `scripts/que-deployar.sh` no conoce.** Hoy decide
  `hosting`, `functions` y `firestore`. Sin una regla nueva, un cambio en
  `storage.rules` se deploya nunca — y las reglas por defecto de Storage son
  abiertas o cerradas según cómo se cree el bucket, así que "nunca" es el peor de
  los dos casos. El script tiene 20 tests: la regla nueva va con los suyos.
- **`firebase/storage` en el bundle.** El corte de B-09/D-51 dejó la carga
  inicial de `/admin` en ~385 KB separando `firebase-client.ts` (app+auth) de
  `firestore-client.ts` (db). Meter el SDK de Storage en cualquiera de los dos lo
  deshace. Va en su propio módulo, cargado lazy junto con la sección de imágenes
  del formulario, y `tests/bundle-panel.test.ts` tiene que cubrirlo — importar
  desde el módulo equivocado ya deshizo este corte **tres veces** sin que nada
  fallara.
- **Validación del archivo, del lado de las reglas y no solo del cliente.** Tipo
  (`image/jpeg`, `png`, `webp`, `avif`) y tamaño máximo. **SVG no**: es un
  documento ejecutable, y si algún día se sirve por un rewrite de Hosting pasa a
  ser mismo origen que el panel.

**Cómo quedó (2026-08-27).** Los cuatro puntos de arriba, uno por uno:

- `storage.rules` existe, con `token.get('admin', false)` como pedía D-05, y lo
  verifica `tests/storage-reglas.integracion.test.ts` **subiendo de verdad** contra
  el emulador — que además hubo que agregar (`firebase.json` y el `--only` de los
  dos lugares que corren la suite). Lo que las reglas **no** pueden validar es el
  tope de 4 imágenes: una regla de Storage no cuenta los objetos de un prefijo. Ese
  tope se queda en el schema, y está escrito para que no se lea como olvido.
- `que-deployar.sh` emite una cuarta línea, `storage=`, y `storage.rules` entró
  además a la lista **negra** de hosting por el mismo motivo que `firestore.rules`:
  es config del servidor y nadie la importa. El job «Reglas e índices» de
  `push-main.yml` arma el `--only` con lo que haya cambiado.
- El SDK vive solo en `src/lib/subir-imagen.ts`, cargado con `import()`. Se cubrió
  con **dos** chequeos y no uno, porque el obvio no alcanzaba: `firebase/storage`
  entró a `SDK_PESADO` (no puede llegar al chunk inicial) **y** hay un bloque nuevo
  «quién es dueño de Storage» que exige que nadie lo importe de forma estática. El
  segundo hace falta porque el editor de la galería ya está en un chunk diferido:
  volver estático ese `import()` no metería el SDK en el chunk inicial y el primer
  chequeo seguiría en verde — lo habría pegado al chunk del formulario, que baja
  todo el mundo. Verificado por mutación.
- Tipo y tamaño se validan en las reglas. **Los tipos que se pueden subir son menos
  que los que la galería muestra:** solo JPG y PNG, porque WebP y AVIF también
  llevan EXIF/XMP y todavía no hay quien se lo saque. Vuelven con B-208. SVG queda
  afuera igual que siempre.

#### EXIF: la privacidad que no está en el §5 y debería

Una foto de celular trae GPS. En este dominio eso es concreto: **muchos talleres
se dan en casas particulares**, y la lista es pública y scrapeable. Subir la foto
del living publica las coordenadas del living, aunque `sede.direccion` diga solo
el barrio.

Hay que **quitar el EXIF al subir**, y el lugar es del lado del servidor o en la
Function, no en el cliente (el cliente es lo que se puede saltear). Esto es una
fila nueva en la tabla del §5.1 de `CLAUDE.md` y en
[`07-seguridad.md`](07-seguridad.md).

**Cómo quedó (2026-08-27), y por qué se hizo en el cliente igual.** El argumento de
arriba sigue en pie y por eso la Function sigue en el plan (**B-208**): es la que no
se puede saltear. Pero la Function es justamente lo que la segunda tajada dejó
afuera, y **entre una tajada y la otra hay imágenes propias públicas**. Publicar las
coordenadas del living no es una optimización pendiente: es irreversible. Así que el
panel las saca ahora (`sinMetadatos`, en `src/lib/imagenes-archivo.ts`) y la Function
las va a sacar otra vez — defensa en profundidad, el mismo patrón que DEC-7b ya había
elegido para el tamaño.

Dos consecuencias que no se adivinan y están en D-131 §3:

- **Se saca sin recomprimir.** Recomprimir en un `canvas` también borraría el EXIF, y
  haría que el tope de 3 MB de DEC-7b deje de significar lo que se decidió: una foto
  de 8 MB entraría recomprimida y el mensaje que empuja a recortar no aparecería
  nunca. Recorriendo segmentos JPEG y chunks PNG a mano, la función es pura y el test
  verifica **sobre los bytes de salida** que el bloque `Exif` no está.
- **Por eso solo se suben JPG y PNG.** WebP y AVIF también llevan EXIF/XMP y no hay
  quien se lo saque todavía; se siguen mostrando si son externas, y vuelven a ser
  subibles con B-208.

La fila del §5.1 está puesta: `07-seguridad.md` § «Las imágenes propias, y qué se
sube al bucket».

#### La vista previa, que es la otra mitad del pedido

Pegar una URL y verla. Los casos que hay que resolver, porque son los que se
ven en la demo y no en el diseño:

- la URL no es una imagen (devuelve HTML) → mensaje, no un roto silencioso;
- la URL es `http://` y el panel es `https://` → contenido mixto, el navegador la
  bloquea y no se entiende por qué;
- la imagen tarda o no carga nunca → estado de carga y de error, con la URL
  igual guardable si el dueño insiste;
- el dominio de afuera puede caerse mañana → la vista previa es del momento de
  cargar, no una garantía. Vale detectar links muertos, pero como aviso.

**Y ojo con `astro:assets`.** El sitio público es SSG: una imagen remota no se
optimiza en build sin descargarla, y Astro exige declarar los dominios
permitidos (`image.domains` / `remotePatterns`) o el build se comporta distinto
de lo que se probó. Con URLs arbitrarias cargadas por un admin, la lista de
dominios no se puede enumerar de antemano — hay que decidir entre no optimizar
las externas, o descargarlas al build (que las convierte en propias por la
puerta de atrás).

#### Borrado y huérfanos

Quitar una imagen de la lista, o borrar la actividad, tiene que **borrar el
objeto de Storage**. Si no: archivos que nadie referencia, que siguen siendo
públicos y que se pagan.

Es exactamente la clase de **B-71** (un guardado que falla deja opciones
huérfanas en la taxonomía), y el orden correcto es el mismo que ahí: primero el
documento, después el archivo. Si falla el borrado del archivo queda basura
invisible; si falla al revés, el documento apunta a un archivo que no está.

Dos casos que lo complican y hay que resolver explícitamente:

- **Duplicar una actividad.** Si la copia comparte el `storagePath`, borrar una
  le rompe las imágenes a la otra. O se copian los objetos, o se cuentan las
  referencias.
- **Restaurar una versión (§12, B-40).** Una versión vieja referencia un archivo
  que quizá ya se borró. Restaurar tiene que decir qué imágenes no volvieron, en
  lugar de dejar la lista con agujeros.

#### El rebuild: esto ya fue un bug, con estos mismos campos

`functions/index.js` tiene el comentario: el rebuild del sitio colgaba del sync a
Calendar, así que **`destacado` e `imagenUrl` no llegaban nunca al sitio** —
porque no van al calendario y por lo tanto no había operaciones que lo
dispararan. Eso es **B-83**, ya arreglado.

Una galería es más de lo mismo y de manual: las imágenes no van a Google Calendar
(la API no tiene campo de imagen; el §7.4 arma solo `summary`, `description`,
`location` y las fechas). Así que hay que **verificar** que la lista entre por el
camino que B-83 dejó arreglado, y no asumirlo.

#### Los lugares que toca, para no descubrirlos de a uno

El criterio del skill `campo-nuevo` es que un campo del modelo toca once lugares
y los que se olvidan son siempre los mismos tres: **la proyección pública, el
default de lectura de los documentos que ya existen, y la ayuda**. Acá:

| Lugar | Qué |
|---|---|
| `types/actividad.ts` | la lista y el ítem |
| `schema.ts` | zod: URL válida, largo de la descripción, y **una sola portada** |
| `actividades.ts` | las dos conversiones, más el default de lectura de `imagenUrl` |
| `toPublic.ts` | §5.2 — qué campos de cada imagen se publican. `storagePath` **no** |
| `ActividadFormulario.tsx` | sección nueva: filas, orden, portada, subida, vista previa |
| `functions/` | borrado de objetos al borrar la actividad; quitar EXIF |
| `storage.rules` | archivo nuevo |
| `que-deployar.sh` | target nuevo + sus tests |
| `analytics-eventos.ts` | cuántas imágenes, propias vs externas — sin la URL |
| `ayuda.ts` / `novedades.ts` | se nota al usar el panel: va a los dos |
| `searchText` (§6) | decidir si la descripción entra. Recomendado **no**: infla el índice con texto que nadie busca |
| tests | la familia de fixtures del §2.2, con y sin imágenes, propias y externas |

#### Costo

Storage se paga por almacenamiento y por egreso, y una galería en un sitio
público indexado es egreso real. Hace falta al menos un tamaño derivado (una
miniatura para la tarjeta) en lugar de servir el original de 4 MB en un listado
de treinta actividades. Y el budget alert del §2.3 está puesto para Functions:
conviene revisarlo antes, no después de la factura.

### B-183 · «Guardar borrador» exige el formulario completo, así que no se puede guardar a medias — ✅ hecho (2026-08-26)

Reporte del dueño usando el panel (2026-08-25):

> No me deja GUARDAR BORRADOR si no completo todo. Tiene que ser más flexible el
> guardar borrador.

`actividadFormSchema` (`src/lib/schema.ts`) se valida **igual para borrador que
para publicado**: título, dirección web, descripción, un encuentro, el arancel
elegido, sede y dirección si es presencial, plataforma si es virtual, vía y
destino si requiere inscripción. La única regla que hoy distingue el estado es la
del slug `-copia`, que corre solo al publicar (trampa 10) — o sea que **el patrón
ya existe en el archivo**, aplicado a una regla sola.

**Por qué es P1 y no una molestia.** Un borrador es, por definición, lo que
todavía no está completo: es la mitad de la razón por la que el estado existe. Y
desde B-35 el panel avisa al salir con cambios sin guardar, así que el que carga
queda encerrado entre un aviso que le dice que va a perder el trabajo y un
guardado que no lo acepta. La salida es completar campos inventados o perder lo
cargado, y las dos terminan igual: la actividad no se carga, y la que no se carga
no se publica ni se indexa.

**La forma del arreglo.** Partir la validación en dos niveles sobre el mismo
schema, no en dos schemas:

- **Guardar borrador** — lo mínimo para que el documento exista y se pueda
  encontrar después en el listado: título no vacío, y el slug (que ya se genera
  solo desde el título mientras no esté publicado). Nada más.
- **Publicar** — todo lo de hoy, que es lo que hace que el sitio y el evento no
  publiquen algo a medias.

Los `superRefine` no cambian de contenido: cambian de condición, igual que la
regla del slug. Y los `sesiones`/`arancel`/`sede` obligatorios pasan a ser
obligatorios **al publicar**.

Dos cosas para no romper en el camino:

- **La barra de errores no debe mentir.** Hoy cuenta "campos a revisar" contra el
  schema único; si el borrador valida con menos, la barra tiene que seguir
  mostrando lo que va a faltar **para publicar**, o quien carga se va a
  encontrar el bloqueo recién al final. Que sea aviso, no bloqueo.
- **Lo que el modelo necesita para no corromperse sigue siendo obligatorio** en
  los dos niveles: los `id` de sesión (trampa 2) y que las fechas sean
  `Timestamp` (trampa 1). Eso no es "completar el formulario", es que el
  documento sea legible.

El sync a Calendar no se toca: ya borra los eventos de todo lo que no está
`publicado` (§7.3), así que un borrador más incompleto no llega a Calendar por
definición.

**Cómo quedó (2026-08-26, `1.2.0`).** Dos niveles sobre el mismo schema con la
condición `estado === 'publicado'`, como decía este ítem: los `superRefine`
cambiaron de condición, no de contenido. El borrador pide título y slug; en los
dos niveles siguen bloqueando el `id` de sesión, las fechas convertibles a
`Timestamp`, el formato del slug y el rango de las coordenadas. La barra no
miente: muestra en gris lo que va a faltar para publicar (`faltaParaPublicar`).
Ver **D-120**; los dos niveles están fijados en `tests/schema.test.ts`, con el
par "el mismo borrador a medias NO se puede publicar".

### B-184 · Cuando el guardado falla, la barra dice cuántos campos faltan pero no cuáles — ✅ hecho (2026-08-26)

Reporte del dueño usando el panel (2026-08-25):

> cuando no se pueda guardar y diga que faltan campos, siempre especificarlos

Hoy `BarraAcciones` muestra `«3 campos para revisar»` y nada más. Fue una
decisión escrita —listar las rutas de campo tapaba media pantalla en mobile, y el
detalle está en rojo al lado de cada campo— y **el reporte la da por equivocada**.
Con razón, y hay un motivo concreto que la decisión no tuvo en cuenta:

**las secciones «Material», «Opcional», «Difusión» y «Vista previa» arrancan
colapsadas.** Un campo rechazado adentro de un acordeón cerrado no se ve en
ninguna parte: el contador dice que hay tres, la pantalla muestra cero, y no hay
forma de saber dónde mirar salvo abrir todo y bajar. Eso no es un resumen
apretado, es un mensaje que no se puede accionar.

**La forma del arreglo**, que además resuelve lo que motivó la decisión original:

- Nombrar los campos, no las rutas del schema (`sede.direccion` → «Dirección»);
  ya hay vocabulario de UI para eso en `formulario/etiquetasUI.ts`.
- Con muchos, nombrar la **sección** y no cada campo: «Falta completar: Dónde
  (2), Arancel e inscripción (1)». Es corto en mobile y alcanza para saber a
  dónde ir.
- Que cada nombre **lleve al campo**: abrir la sección si está colapsada y
  scrollear hasta él. Es lo que cierra el agujero del acordeón.

Depende de **B-183**: mientras el borrador exija el formulario completo, el
mensaje va a listar campos que a quien está guardando a medias no le importan
todavía. Con los dos niveles de validación, el mensaje del borrador es la lista
corta y el de publicar es la larga. Se pueden hacer en cualquier orden, pero el
valor del mensaje bueno se cobra recién con B-183 hecho.

Ojo con el criterio de B-63: si se agrega el mensaje, el punto de la guía que hoy
dice «esa barra dice cuántos campos hay que revisar» queda mintiendo.

**Cómo quedó (2026-08-26, `1.2.0`).** Nombra los campos hasta tres y las
secciones con su cuenta a partir de cuatro; cada nombre abre la sección y
scrollea hasta el primer campo rechazado. El diccionario de nombres es data
(`lib/formulario/camposFaltantes.ts`), atado al schema por
`tests/campos-faltantes.test.ts`, que también lee los `.tsx` para que un
renombre de sección no deje el mensaje apuntando a una sección inexistente. La
advertencia de este ítem sobre B-63 se cumplió: el punto de la guía que describía
la barra vieja se reescribió en el mismo cambio. Ver **D-121**.

### B-189 · `hayCredenciales()` existe y no la llama nadie, así que el build va a publicar un sitio vacío — ✅ hecho (2026-08-26)

`src/lib/firebase-admin.ts` exporta:

```ts
/** ¿Tenemos con qué leer Firestore en este build? */
export const hayCredenciales = (): boolean => …
```

y `grep -rn hayCredenciales src/ scripts/` no la encuentra en ningún otro lado.
Es la guarda escrita para esta situación exacta, sin cablear.

**Hoy no rompe nada**, y por eso pasa desapercibida: ninguna página lee Firestore
en el build —el sitio público es el paso 3 del §10 y `index.astro` es un
placeholder—, así que un build sin credenciales es correcto. Se comprobó con el
primer push de CI (2026-08-25): `npm run build` sin `FIREBASE_SERVICE_ACCOUNT`
terminó en verde, como corresponde.

**Rompe con B-106.** El día que el build lea Firestore para armar `events.json` y
las páginas de detalle, un build sin credenciales no va a fallar: va a producir
cero actividades y un `events.json` vacío, y el deploy lo va a publicar encima del
sitio que sí tenía datos. Sin error, sin log, con el workflow en verde. Es la
misma familia que el `EXIGIR_EMULADOR=1` del §CI —"verde" no puede significar a la
vez "los datos están" y "no había datos que leer"— y que B-187: una condición que
solo se evalúa cuando ya deployó.

**El arreglo es una línea, y hay que hacerlo antes de B-106, no después.** El
lugar es el paso de build de los dos workflows, o el módulo que lea Firestore:

```ts
if (!hayCredenciales()) throw new Error('build sin credenciales: no se puede leer Firestore');
```

Con un test que lo ate, porque el patrón que lo apaga otra vez es exactamente el
que lo dejó apagado: alguien escribe la guarda pensando en el consumidor que
todavía no existe, y el consumidor nace sin llamarla.

Queda **P1** y no P2 aunque hoy no se note: cuando se note, el síntoma es el sitio
público vacío e indexado por Google, que es el objetivo del proyecto al revés.

**Cómo quedó (2026-08-26, `1.2.0`).** La llama `adminApp()`, la única puerta a
Firestore en build time, y no el paso de build de los workflows: `1.1.0` se
desplegó a mano, que es el camino que ningún `if` de un YAML mira. La regla del
§3.2 de `12-sitio-publico.md` no cambió —falla en CI, en local sigue con lista
vacía— porque es del lector de Firestore; esto es la red de atrás para el
consumidor que se olvide, que es el patrón que dejó la guarda apagada un mes. Ese
documento ahora dice qué mitad implementa cada uno.
`tests/build-credenciales.test.ts` fija que la puerta tire y que nada más en
`src/` importe el Admin SDK, y se verificó reintroduciendo el bug. Ver **D-123**.

### B-191 · No hay autoguardado, así que una interrupción se lleva todo lo escrito — ✅ hecho (2026-08-26)

[Issue #6](https://github.com/benoffi7/agenda-literaria/issues/6), del panel,
Android, versión `1.0.1+538bef7`:

> Se podrá guardar algo como borrador o auto guardado, como en word? Porque
> reporté algo y todo lo que escribí se borró:(

**El accidente concreto ya está cerrado**: tocar «Reportar algo» con el formulario
a medio llenar lo descartaba sin decir nada, y eso es **B-35**, arreglado el
2026-08-24 y publicado en 1.1.0 — ahora pregunta antes. Quien reportó esto todavía
no lo tenía.

**Lo que pidió no es eso, y sigue abierto.** Un aviso evita el accidente; no
recupera el trabajo. Y hoy se combina mal con **B-183**: si «Guardar borrador»
exige el formulario completo, la única respuesta honesta al aviso es "sí, perdelo".
Los tres ítems son una sola historia contada en tres pedazos: **no podés guardar
(B-183), no sabés por qué (B-184), y si te vas lo perdés (este)**.

**La forma, que es más chica de lo que parece:** persistir el borrador del
formulario en `localStorage`, con clave por actividad (más una para «nueva»), y al
abrir ofrecer lo recuperado con un botón para descartarlo. **No toca Firestore**,
así que no hay reglas nuevas, ni modelo, ni calendario, ni una escritura por tecla
que cueste plata. El estado ya está centralizado desde B-70, y `formulario-sucio.ts`
ya sabe cuándo hay algo que perder: son los dos ganchos que hacen falta.

Tres cosas para no equivocarse:

- **Lo guardado es contenido**, a diferencia de todo lo demás que el panel
  persiste. Nunca sale del navegador y no puede filtrarse a la analítica, que
  solo acepta enums y contadores (§9). Vale un test de eso.
- **Recuperar en silencio es peor que no recuperar.** Si al abrir una actividad
  aparece texto que no está en Firestore sin decir de dónde salió, la próxima
  duda es "¿esto lo guardé o no?". Tiene que decirlo y tiene que poder
  descartarse.
- **Limpiar al guardar bien**, o el borrador viejo va a reaparecer encima de la
  versión buena la próxima vez.

**Orden:** B-183 primero. Es más barato, cierra el agujero de raíz y baja mucho la
urgencia de esto.

**Cómo quedó (2026-08-26, `1.2.0`).** `localStorage` con clave por admin y por
formulario, debounce de 800 ms, y el aviso que ofrece lo recuperado con su fecha y
un botón para descartarlo. Las tres cosas que este ítem pedía no equivocar están
cubiertas y con test: no pasa por la analítica (se lee el código del módulo y del
hook, sin comentarios), no recupera en silencio, y se limpia al guardar bien. De
más: descarta lo ilegible, lo de otra `VERSION_BORRADOR` y lo de más de 30 días, y
no tira nunca —`localStorage` lanza excepción en modo privado—. Ver **D-122** y la
sección nueva de `07-seguridad.md`.

Y una que este ítem no anticipaba: un borrador de hasta 30 días es un formulario
viejo, así que recuperarlo pisaba `calendarEventId` —el único campo que escribe
el backend— y duplicaba el evento en la edición **siguiente**, que es la familia
de B-80. Lo recuperado pasa por `conIdsDeCalendarioDe`; queda anotado en
`15-mapa-de-trampas.md` como vía nueva de una clase conocida.

**Lo que encontraron los auditores antes del push, y se arregló en el mismo
cambio (`1.2.0`, D-124).** Los cuatro son de esta función, y el primero es la
misma clase que el párrafo de arriba con otro campo — o sea que el razonamiento
estaba bien y la lista estaba corta:

1. **P1 de privacidad — el borrador recuperado reactivaba los dos flags de
   publicación.** `online.urlPublica` y `material.items[].publico` deciden si el
   link de la reunión y las URLs del material salen a `events.json` y a la
   descripción del evento (trampa 5). Se destilda, no se guarda, se recupera a los
   veinte días, se publica, y sale. Vuelven a `false` (`sinFlagsDePublicacion`) y
   el aviso lo dice cuando había alguna tildada — necesario porque `Seccion` lee
   `abiertaPorDefecto` **solo al montar**, así que un flag que llega con el
   borrador quedaba en una sección cerrada.
2. **La clave no llevaba el uid y no se borraba al cerrar sesión.** Con dos admins
   en la misma máquina (D-57), a B se le ofrecía el borrador de A; y el contenido
   —parte de él interno por §5.1— sobrevivía al logout hasta 30 días, lo que
   además hacía falsa una frase que `07-seguridad.md` ya afirmaba. Ahora la clave
   lleva la huella del uid y `cerrarSesion()` borra todos.
3. **La clave de "nueva" era la misma que la de "duplicar".** Las dos nacen sin
   id. Un borrador de una carga nueva interrumpida se ofrecía dentro de un
   duplicado y, aceptado, publicaba una actividad distinta de la que se quiso
   duplicar. El discriminador ya existía una línea más abajo, en la medición.
4. **`pareceFormulario` valida 2 campos de ~30**, y aguas abajo `formADocumento`
   copia `sede`, `online`, `organizador` y `tallerista` tal cual y `toPublic`
   proyecta los tres primeros enteros: una clave de más terminaba en
   `events.json`. Lo recuperado entra podado contra el molde del formulario.

Y un quinto que apareció al verificar los otros cuatro: **el test que fijaba la
guarda de `calendarEventId` no la fijaba.** Decía
`toContain('conIdsDeCalendarioDe')`, y esa cadena la satisface el `import`: con la
llamada borrada seguía verde. Los dos tests de saneadores ahora afirman la
composición con los espacios colapsados, y se verificó que caen. Es la clase de
"chequeo que no chequea", y vale para cualquier test que lea un fuente buscando un
nombre.

### B-205 · Un push cuya corrida no arranca no se deploya nunca, y el push siguiente no lo repara · P1

Pasó el 2026-08-26 con el push de la `1.2.0` (`9fd50f3`): la corrida de
«Deploy desde main» terminó en **`startup_failure` a los 0 segundos**, sin ningún
job. Verificado que la causa no era del repo: el YAML parseaba (`workflows.test.ts`
en verde), el workflow estaba `active`, Actions habilitado con `allowed_actions:
all`, el repo público y no fork, el actor era el dueño, y el archivo **no se había
tocado** en el push. Con todo eso, la corrida no se puede reintentar
(`gh run rerun` → "This workflow run cannot be retried").

**La causa, confirmada:** GitHub Actions estaba en `major_outage`. El incidente se
abrió a las **15:11:58Z** y la corrida es de las **15:31:44Z**, o sea en el medio;
el republish a mano de `deploy.yml`, quince minutos después, falló igual y del
mismo modo. Se confirmó contra
`https://www.githubstatus.com/api/v2/summary.json`, que es el chequeo que conviene
hacer **primero** la próxima vez: dos workflows distintos fallando al arrancar, sin
cambios en `.github/`, es afuera y no adentro.

Que la causa sea de afuera es justamente lo que hace que este ítem valga: las
caídas de Actions van a volver a pasar, y lo que falla acá es la **recuperación**.

**El bug no es la falla transitoria: es que nada la repara y nada la nota.**
`decidir` diffea con `ANTES: ${{ github.event.before }}`, o sea el head del push
anterior. Entonces:

1. el push N no deploya (corrida fallida al arrancar, cancelada, o lo que sea);
2. el push N+1 diffea **desde el commit de N**, que ya está en `main`;
3. los cambios de N quedan fuera del diff **para siempre**, y el deploy los
   saltea sin decir nada.

En este caso concreto el push siguiente iba a ser de `docs/` solamente, así que
`que-deployar.sh` habría decidido "nada que deployar" y la `1.2.0` se quedaba en
`main` sin publicarse, con producción en `1.1.0+c84da0c` y **ningún síntoma**. Se
descubrió mirando `/version.json` a mano, no porque algo avisara.

Es la misma familia que B-188 —un deploy que no ocurre y no se nota de este
lado— y que la lección de B-20 sobre el job de reglas que bloquea Hosting. La
diferencia es que acá el estado queda **inconsistente hacia adelante**: no alcanza
con arreglar la causa, hay que republicar.

**Qué se hizo el 2026-08-26**, y es el workaround, no el arreglo: disparar
`deploy.yml` a mano (`gh workflow run deploy.yml --ref main`), que es el deploy de
datos y publica **Hosting solo** — sin tocar Functions ni reglas, que en este
cambio no se tocaron. Su `workflow_dispatch` está documentado para esto
("republicar después de un cambio de código"). Se prefirió a `push-main.yml` a
mano porque ése, sin `github.event.before`, deploya **todo**, y el job de
Functions termina rojo a propósito (los roles que `deploy-ci@` no tiene, D-119).

**Los dos arreglos posibles, y el segundo es el que vale:**

- **Diffear contra lo publicado y no contra el push anterior.** `/version.json`
  del sitio en vivo ya dice qué commit está publicado (`1.1.0+c84da0c`), así que
  `decidir` puede usar **ese** sha como base en lugar de `github.event.before`.
  Con eso, un deploy que no ocurrió se recupera solo en el push siguiente, que es
  exactamente la propiedad que falta. Es el arreglo de raíz y es chico.
- **Un chequeo que compare lo publicado con `main`**, del estilo de
  `relevar-infra.sh` (B-123): si `/version.json` no coincide con el head de
  `main`, avisar. Sin esto, la única red es que alguien mire.

Lo primero cierra el agujero; lo segundo lo hace visible cuando falle igual.
Conviene el primero, y el segundo si sobra tiempo.

### B-206 · Lo que había que decidir antes de la subida de imágenes propias — ✅ decidido (2026-08-26) e implementado (2026-08-27)

Las encontró el `auditor-privacidad` en el cierre de la primera tajada. **Hoy
ninguna filtra nada** —no hay imágenes propias porque no hay subida— y las dos se
vuelven reales el día que la haya. Van juntas porque bloquean el mismo trabajo.

**1 · La URL pública de una imagen propia contiene el `storagePath`.** Esto
desarma el argumento con el que se decidió no publicar el campo. La URL canónica
de Firebase Storage es
`…/v0/b/<bucket>/o/actividades%2F<id>%2Ftapa.jpg?alt=media&token=…`: el path va
URL-encodeado adentro, y el `token` es un bearer **permanente** hasta que se
revoca. Con `origen: 'propia'` publicado al lado, un scraper tiene bucket, path y
token.

No publicar `storagePath` sigue siendo correcto —es el handle autoritativo, y las
externas no tienen path— pero **no logra lo que el comentario de `toPublic.ts`
dice**. Hay que decidir cómo se sirve una propia: por un rewrite de Hosting o un
dominio propio (el path deja de ser visible, y de paso el egreso pasa por el CDN),
o con `getDownloadURL()` asumiendo que path y token son públicos y escribiéndolo
como tal. La primera es más trabajo y la única que cumple la promesa.

**2 · `storagePath`, `ancho` y `alto` van a tener dos dueños.** El plan es que los
escriba la Function al subir, pero `formADocumento` hoy copia la fila entera con un
spread. Serían dos escritores para un campo de máquina **adentro de un array de
contenido**, que es `calendarEventId` dentro de `sesiones` otra vez — la familia de
B-80, por una puerta nueva.

Las dos consecuencias concretas, ninguna de privacidad:

- `functions/historial.js` tiene `CAMPOS_DE_MAQUINA_SESION = ['calendarEventId']` y
  **no** tiene el equivalente para `imagenes`. Cuando la Function escriba de vuelta,
  `huboCambioDeContenido` va a ver un cambio de contenido: **una versión de
  historial y un rebuild del sitio por cada imagen optimizada**.
- El borrador de `localStorage` vive 30 días y `sinFlagsDePublicacion` no toca
  `imagenes`: un borrador viejo puede volver con un `storagePath` a un objeto que ya
  se borró. Es el sexto campo de la lista de D-124, que se quedó corta dos veces.

**El arreglo, cuando se haga:** `CAMPOS_DE_MAQUINA_IMAGEN = ['storagePath','ancho','alto']`
en `functions/historial.js`, y que `formADocumento` los **conserve explícitamente**
del documento de hoy en vez de spreadearlos del formulario — igual que ya hace con
`calendarEventId: s.calendarEventId ?? null`.

#### Cómo quedaron las dos (2026-08-27, con la subida) — razonamiento completo en **D-131**

**1 · Se eligió `getDownloadURL()`, la opción barata, con dos condiciones que la
vuelven honesta.** El ítem decía que el rewrite de Hosting era «la única que cumple
la promesa», y lo que cambió la cuenta es que **la promesa estaba mal escrita**: el
comentario de `toPublic.ts` decía que publicar el path «dibuja la estructura del
bucket». Con un prefijo plano (`imagenes/`) y el nombre del objeto siendo el uuid de
la fila, no hay estructura que dibujar; y con `allow read: if true` bajo ese prefijo,
el token permanente no protege nada que no estuviera abierto. `storagePath` sigue
afuera del `events.json`, pero por lo que sí es —el handle autoritativo, que un
consumidor del JSON no usa— y no por un secreto que la URL desmiente. El comentario
se reescribió; **una afirmación de seguridad que miente es peor que no tenerla**
(B-195). El rewrite quedó abierto abajo, con el motivo corregido: costo y
portabilidad, no privacidad.

**2 · Implementado tal cual estaba escrito**, sin cambiarle nada:
`CAMPOS_DE_MAQUINA_IMAGEN` en `functions/historial.js` y `formADocumento`
enumerando las claves de cada imagen. Hoy el segundo escritor no existe todavía —los
tres campos los escribe la subida del panel—, así que las dos mitades son
preventivas; se hicieron ahora porque es cuando son gratis. Lo cuida
`tests/clases-de-bug.test.ts`, que además verifica que **ninguna clave de más** entre
al documento (el camino del §5.2 por el que un borrador viejo mete algo inventado).

Un detalle que el ítem no anticipaba: los tres se copian con «si está» y **no** con
`?? null`. Firestore guardaría el `null` como valor presente y `huboCambioDeContenido`
no unifica ausente con `null` (D-41), así que un `storagePath: null` en cada imagen
externa produciría una versión de historial y un rebuild por guardado.

---

**Decidido el 2026-08-26. Tres respuestas, y la primera cambia la doc y no el código.**

**1 · Las propias se sirven con `getDownloadURL()`, y el path del bucket pasa a ser
público — escrito como tal.** Se eligió el camino sin infra: es lo que el SDK
devuelve y funciona hoy. La contra se asume y se anota donde se lee: para una imagen
propia, **el path y un token permanente son públicos**, porque viajan adentro de la
URL. Deja de ser cierto que «`storagePath` no sale»; lo que sigue siendo cierto es
que no lo publicamos nosotros en la proyección, y eso se mantiene —no hay motivo
para emitir el handle autoritativo— pero como prolijidad, no como defensa.

**La consecuencia que esto arrastra, y es la parte que no era obvia: si el path es
público, el nombre del archivo también lo es.** Un
`actividades/<id>/taller-en-casa-de-ana.jpg` cuenta algo que la actividad no cuenta,
y el id ya es público (va en el `events.json`). Así que **la Function renombra a algo
opaco** —el id de la fila más la extensión, `img_<uuid>.webp`— y nunca conserva el
nombre que traía el archivo. Va con test.

Si algún día molesta, la salida está escrita arriba: un rewrite de Hosting, que
además saca el egreso de Storage y lo pasa por el CDN.

**2 · El dueño de `storagePath`, `ancho` y `alto` es la Function.** El formulario los
**conserva** del documento de hoy en vez de spreadearlos, igual que ya hace con
`calendarEventId: s.calendarEventId ?? null`. Arrastra dos cosas que van en el mismo
cambio y no después:

- `CAMPOS_DE_MAQUINA_IMAGEN = ['storagePath','ancho','alto']` en
  `functions/historial.js`. Sin eso hay **una versión de historial y un rebuild del
  sitio por cada imagen optimizada**.
- Los tres campos entran a los saneadores del borrador recuperado (**D-124**), que es
  la lista que ya se quedó corta dos veces. Un borrador de hace tres semanas no puede
  devolver un `storagePath` a un objeto que se borró.

**3 · Se guarda el original saneado más una miniatura.** Dos objetos por imagen: el
original sin EXIF y recomprimido para la página de detalle, y una miniatura para la
tarjeta del listado. Es el mínimo que evita servir 3 MB en un listado de treinta
tarjetas, que es el egreso que se paga, y deja de dónde volver a generar otro tamaño
sin pedir la foto de nuevo. El almacenamiento duplicado es la parte barata.

**Y una que sale de la 3 y hay que hacer antes de la primera subida:** el budget
alert del §2.3 está puesto **solo para Functions**. Storage se paga por
almacenamiento y por egreso, y una galería en un sitio indexado es egreso real.
Conviene extenderlo antes, no después de la factura.

### B-236 · `git stash` es compartido entre worktrees, y ya se llevó puesto el trabajo de dos frentes · P1

**Pasó dos veces el 2026-08-27/28, en dos worktrees distintos**, y la segunda quedó
grabada en el propio `git stash list`: una entrada se llama literalmente
`recuperado: cambios de otro worktree (pop accidental de stash compartido)`.

**La causa, y es de git, no de nadie.** El stash vive en `refs/stash`, que es del
**repositorio**, no del working-tree. `git worktree` aísla el índice, el `HEAD` y
los archivos — **no el stash**. Entonces:

```
worktree A:  git stash push        # queda stash@{0} = A
worktree B:  git stash push        # ahora stash@{0} = B, y A pasó a stash@{1}
worktree A:  git stash pop         # ← se trae el trabajo de B a su árbol
```

En el caso real, un frente hizo `stash push` para poder rebasear, otro frente
stasheó en el medio, y el `pop` del primero trajo 1061 líneas del segundo —cuatro
archivos nuevos de una feature ajena— sobre su propio checkout, con conflictos.

**Por qué es P1 y no una curiosidad.** Se recupera, pero solo si uno se da cuenta:
`git stash pop` con conflictos **conserva la entrada**, así que el trabajo del otro
no se pierde. El modo malo es el que no da conflicto — ahí el `pop` **borra la
entrada** y los cambios del otro frente quedan mezclados en un árbol ajeno, sin
rastro en el stash y sin que nadie los esté buscando. Y el repo trabaja con varios
worktrees en paralelo a propósito (`docs/14-plan-de-saneamiento.md`), o sea que la
condición que lo dispara es el modo de trabajo normal, no un accidente.

**Es la misma familia que B-219** (dos worktrees compartiendo el emulador): algo que
uno supone aislado por worktree y es global del repositorio. Vale la pena buscar el
resto de esa familia — `refs/stash`, el emulador, y probablemente `.firebase/`.

**Cómo se sale, hoy y a mano.** Nunca `git stash pop` a secas desde un worktree:

```bash
git stash list                    # mirar el nombre: dice de qué worktree salió
git rev-parse 'stash@{N}'         # anotar el sha
git stash apply <sha>             # apply, no pop: no toca la pila
# …verificar que es lo tuyo…
git stash drop 'stash@{N}'        # recién ahí, y confirmando el sha otra vez
```

Los dos detalles que hacen la diferencia: **`apply` y no `pop`** (si te equivocaste,
la entrada del otro sigue ahí), y **por sha y no por índice** (los índices se corren
solos cuando otro worktree stashea).

**Las salidas de fondo, de menos a más:**

1. **No usar `stash` en un worktree.** Para rebasear con el árbol sucio alcanza con
   un commit temporal (`git commit -m wip` → `git rebase` → `git reset --soft HEAD~1`),
   y un commit **sí** es por-worktree. Es lo más barato y no necesita nada nuevo.
2. **Un helper `scripts/wip.sh`** que haga exactamente eso, para que no dependa de
   que cada uno se acuerde. Encaja con el criterio del skill `automatizar`: esto ya
   pasó dos veces.
3. **Un test no lo puede atajar** —es un gesto interactivo, no código versionado—
   pero **una línea en `docs/14-plan-de-saneamiento.md` sí**, que es donde se explica
   cómo conviven los frentes en paralelo. Hoy ese documento reparte archivos y no
   dice nada del stash.

**Y una consecuencia operativa mientras tanto:** si te encontrás un `git stash list`
con entradas de otros worktrees, **no las limpies**. Son el trabajo en curso de otro
frente, y borrar una es la única forma de que esto sí pierda datos.

### B-220 · La Function que optimiza las imágenes propias (DEC-7d) · P1

**Es la mitad que la segunda tajada de B-167 dejó afuera a propósito**, y el criterio
del corte fue el del repo: preferimos subir imágenes sin miniatura a no subir nada.
Hoy una imagen propia se sube **tal cual la eligió la persona**, sin recomprimir y sin
miniatura. Funciona, y las fotos de 3 MB pesan 3 MB en la tarjeta del listado.

Lo que falta, y por qué cada parte es cara:

- **Recomprimir y derivar la miniatura.** Necesita una librería de imágenes nativa en
  `functions/` (`sharp` o equivalente), que es la primera dependencia binaria del
  proyecto y cambia el tiempo de deploy de las Functions.
- **La guarda anti-loop, que es la trampa 3 con otra cara.** El trigger es
  `onObjectFinalized` sobre el mismo bucket en el que escribe la miniatura: sin guarda,
  se dispara a sí mismo. Las dos formas conocidas: escribir la derivada bajo un prefijo
  que el trigger ignore, o marcarla con `customMetadata` y cortar al leerla. La
  segunda es la que sobrevive a que alguien mueva el prefijo.
  **La red ya está puesta:** `tests/clases-de-bug.test.ts` descubre desde el 2026-08-27
  las clases `onObjectFinalized|onObjectDeleted|onObjectArchived|onObjectMetadataUpdated`,
  así que el trigger nuevo entra solo y va a pedir la guarda. Antes no: el descubridor
  solo conocía `onDocument*` y `onSchedule` (D-131 §4).
- **El write-back al documento.** La Function tiene que escribir `storagePath`, `ancho`
  y `alto` en la fila de la galería, y para eso tiene que **encontrar** la actividad
  que la referencia — que hoy no puede, porque el path no lleva el id de la actividad
  (y no lo lleva por una razón dura: al subir todavía no hay actividad, ver D-131 §1).
  La salida más barata es una query `where('imagenes', 'array-contains', …)`, que
  Firestore no sabe hacer sobre un subcampo; la otra es que el panel escriba un
  documento puente. **Esto hay que decidirlo antes de escribir código.**
  Lo que sí ya está resuelto es la mitad que le sigue: `CAMPOS_DE_MAQUINA_IMAGEN`
  (B-206 #2) evita que ese write-back deje una versión de historial y un rebuild del
  sitio por imagen.
- **Vuelven WebP y AVIF a `TIPOS_SUBIBLES`.** Hoy están afuera porque el panel no sabe
  sacarles los metadatos; la Function que recomprime todo los vuelve seguros. Es un
  cambio de una línea en `imagenes-archivo.ts` y una en `storage.rules`, con su test.

**Lo que NO hay que rehacer:** el EXIF ya se saca en el panel, sin recomprimir y
verificado sobre los bytes. La Function lo va a sacar otra vez, y eso está bien —es la
capa que no se puede saltear— pero el agujero no está abierto mientras tanto.

### B-221 · Nadie borra las imágenes propias que quedan huérfanas · P2

**Hoy no se borra nada de Storage: ni al quitar la fila de la galería, ni al borrar la
actividad, ni cuando una subida se abandona sin guardar.** Es deliberado y está
escrito en `subir-imagen.ts`: un objeto huérfano cuesta centavos y es invisible; un
borrado automático no tiene papelera de la que sacarlo, y hoy no hay ningún conteo de
referencias que diga si ese archivo lo usa otra actividad.

Se vuelve real cuando el bucket tenga volumen, y la pregunta a contestar es la misma
que B-199 movió y no resolvió: **quién es dueño del objeto**. Dos caminos:

- **Barrido periódico** (`onSchedule`): listar el prefijo `imagenes/`, cruzar contra
  los `storagePath` de todas las actividades, borrar lo que no referencia nadie con un
  margen de gracia de días —sin el margen se borra la imagen que alguien subió hace
  cinco minutos y todavía no guardó—. Es el más simple y no necesita estado nuevo.
- **Conteo de referencias**, que es la variante con estado compartido de B-71 y la que
  habilitaría copiar imágenes propias al duplicar (hoy la casilla del modal está
  escondida justamente porque no se puede, D-131 §5).

El barrido primero; el conteo solo si hace falta copiar.

### B-222 · Servir las imágenes propias por un dominio propio o un rewrite de Hosting · P3

**El motivo NO es privacidad** — eso quedó resuelto en B-206 #1 con el path opaco y la
lectura pública (D-131 §1). Lo que compra este cambio es otra cosa, y por eso bajó a P3:

- **Costo de egreso.** Hoy cada imagen se sirve desde `firebasestorage.googleapis.com`
  y paga egreso de GCS por descarga. Detrás del CDN de Hosting, la mayoría de las
  descargas las contesta el borde.
- **Portabilidad.** La `url` que se guarda en el documento **incluye el bucket y un
  token**: mudar de bucket, o revocar un token, invalida todas las URLs ya guardadas y
  hay que reescribir documentos. Con una URL propia (`/img/<id>.jpg`) el documento
  guarda algo estable y el mapeo vive en un solo lugar.

Firebase Hosting **no** tiene rewrite directo a un bucket de GCS: hay que poner una
Cloud Function o un Cloud Run que haga de proxy, y eso agrega cold start al camino de
una imagen. Conviene hacerlo junto con B-220, que ya va a tocar esa zona.

### B-223 · `12-sitio-publico.md` sigue diseñando contra `imagenUrl`, que ya no existe · P2

Lo encontró el `auditor-documentacion` en el cierre de la segunda tajada de B-167.
El diseño del sitio público modela la imagen como **un campo único**
(«la tarjeta sin `imagenUrl`…», «`imagenUrl: null` es frecuente…», `og:image`:
`imagenUrl` cuando hay) en al menos seis lugares: líneas 201, 381, 552, 579, 932 y
1017.

**El modelo real es `imagenes[]` con `portada` desde la primera tajada** (D-125),
que está en producción hace días. Y desde la segunda hay además imágenes
**propias**, con `storagePath`, `ancho` y `alto` — que es justo lo que la tarjeta
necesita para no saltar al cargar, y el documento no lo sabe.

**No bloquea nada hoy**: el sitio público todavía no se construye. El daño es
diferido y concreto: quien implemente B-01 va a leer ese documento y va a escribir
la tarjeta contra un campo que no existe, y el `getStaticPaths` contra una forma
que el `events.json` no tiene. Se arregla **antes** de empezar B-01, no después.

Lo que hay que actualizar, además de reemplazar el nombre del campo:

- El caso «sin imagen» (§7.6) pasa a ser «lista vacía», no `null`.
- `og:image` sale de la **portada** (`portadaDe()`), no de «la imagen».
- La tarjeta puede usar `ancho`/`alto` de una imagen propia para reservar el
  hueco; una externa no los tiene y ahí sigue sin poder reservarlo. **Ojo con
  dónde entra eso:** hoy `src/lib/eventsJson.ts` recorta el índice a
  `imagenUrl: portadaDe(a.imagenes)?.url ?? null` y **no lleva las medidas**. No
  está roto —el índice sigue funcionando igual con imágenes propias, y la
  proyección larga sí las publica—, pero si la tarjeta las va a usar, el campo
  tiene que entrar al índice, y eso es una salida pública: pasa por el fixture de
  centinelas como cualquier otra.
- El §7.6 dice que una imagen externa puede caerse mañana. Con las propias eso
  deja de valer para la mitad de los casos, y conviene decirlo.

### B-207 · `searchText` tenía dos listas de fuentes, y restaurar del historial publicaba la vieja — ✅ hecho (2026-08-26)

Lo encontró el `auditor-privacidad` sobre DEC-1, y es consecuencia directa de ese
cambio. `historial.ts` tenía **su propia copia** de «de qué campos sale el
`searchText`» (`CAMPOS_DE_BUSQUEDA`, cinco entradas) mientras `buildSearchText`
consumía seis. Al agregar el libro, restaurar un libro viejo desde la pantalla de
versiones **escribía el campo y dejaba el `searchText` con el título descartado** —
y ese `searchText` sale al `events.json`, o sea el documento diciendo una cosa y el
índice público de búsqueda diciendo otra. El camino estaba abierto: la pantalla ya
ofrecía restaurar «Libro presentado», y esa rama no tenía **ningún** test.

Es la clase de B-88 y la de B-72 a la vez: el productor y el consumidor de la misma
regla derivando por separado.

**Cómo quedó.** No se arregló agregando `'libro'` a la lista y un test que compare
las dos: eso deja el par vivo. **Ahora hay una sola lista** —
`CAMPOS_DE_SEARCH_TEXT` en `normalize.ts`, al lado de la función que la usa— y
`historial.ts` la importa.

La red va en las dos direcciones y ninguna compara literales: un test **de
comportamiento** que mete un centinela en cada campo de la lista y exige que
aparezca en el `searchText` (si la lista nombra un campo que la función ignora,
restaurarlo recalcula al vacío), y otro que lee la función —ocho líneas— extrae los
`a.<campo>` que consume y exige que estén todos en la lista (la dirección que
falló). Verificadas las dos: sacando `libro` de la lista y agregándole un campo
inventado, cada rotura cae con el mensaje que nombra qué drifteó.

### B-210 · La trampa de foco está copiada en dos diálogos y la copia se quedó con el bug — ✅ hecho (2026-08-27)

**Hecho.** El cableado salió a `src/components/admin/useCapaModal.ts` y las dos capas lo
usan. `CentroAyuda` recupera el `ref` del callback que solo `DialogoDuplicar` tenía, así
que leer las novedades ya no remonta el efecto ni le roba el foco.

**Y lo que costó más que el arreglo: los tests que se rompieron.** Cuatro `it` que leían
el fuente buscaban `e.key===Escape` o `alCancelar=useRef(onCancelar)` dentro de
`DialogoDuplicar.tsx`, así que **un refactor que mejora el código los puso en rojo**. Es
la tercera vez que pasa lo mismo (§10, problema 1). No se los repuntó al archivo nuevo
—sería el mismo chequeo frágil con otra ruta—: ahora afirman la **propiedad** de que
ninguna capa tenga cableado propio, lo que además cubre a la próxima capa que alguien
escriba. Verificado por mutación en las dos direcciones: reintroducir `alCerrar` en las
dependencias rompe, y escribir un `keydown` en una capa rompe.

`src/lib/foco.ts` comparte la **aritmética** del foco a propósito: su docblock
dice que la parte que toca el DOM «queda en cada componente, que es donde está el
`ref`». Esa decisión era razonable con un solo diálogo. Hoy hay dos, y el bloque
que toca el DOM —el `useEffect` con el handler de `keydown`, el ciclo de Tab, el
`overflow: hidden` del body, la devolución del foco al abridor— está copiado
verbatim en `DialogoDuplicar.tsx` y en `ayuda/CentroAyuda.tsx`. Son ~40 líneas
idénticas.

**Y ya divergieron, en el sentido que importa: una copia tiene el arreglo y la
otra no.** `DialogoDuplicar` guarda el callback en un `ref` y usa deps `[]`, con
un comentario que explica por qué —un `onCancelar` inline es una función nueva por
render, así que cualquier re-render con la capa abierta corre la limpieza,
devuelve el foco, lo re-captura y se lo lleva de vuelta a la caja—.
`CentroAyuda` quedó con `useEffect(..., [onCerrar])`, y `ayuda/BotonAyuda.tsx` le
pasa `onCerrar={() => setAbierto(false)}`, que es exactamente el caso inline que
el comentario del otro archivo describe.

**Cómo se ve:** `BotonAyuda` tiene estado propio (el contador de novedades sin
leer). Marcar las novedades como leídas lo re-renderiza → `onCerrar` es una
función nueva → el efecto de `CentroAyuda` se desmonta y se vuelve a montar →
devuelve el foco al botón «Ayuda» y se lo roba de nuevo hacia la caja, y el
scroll del body parpadea en el medio.

Arreglo: un `useCapaModal({ alCerrar, caja })` en `src/lib/` o en
`components/admin/`, con el `ref` del callback adentro, del que tiren los dos. El
test de `foco.test.ts` ya cubre la aritmética; lo que falta es que el cableado
tenga un solo dueño. **Es P1 y no P2 porque el arreglo ya está escrito en el
repo** — solo está en el archivo equivocado.

### B-211 · El doble de `Timestamp` está definido 13 veces en 4 formas, y dos mienten — ✅ hecho (2026-08-27)

**Hecho.** Uno solo, en `tests/fixtures/tiempo.ts`, devolviendo `TimestampLike` — el tipo
que el modelo declara y que las copias de dos campos no satisfacían. `seconds` y
`nanoseconds` salen de la fecha: las dos variantes que decían `seconds: 0` afirmaban que
todo Timestamp es la época.

**Lo que faltaba no era el fixture: era la guarda.** Esta es la clase que el repo ya
había automatizado (`fixtures/ciclo.ts` + `invariantes-de-ciclo.test.ts`, después de
aparecer cuatro veces) y volvió igual, porque **la automatización se escribió y no se
adoptó** — un modo de falla distinto del que se atajó, y sin red. La clase de B-211 en
`clases-de-bug.test.ts` busca la **forma** (`toDate` y `toMillis` juntos) y no el nombre,
así que también caza al que se llame `stamp` o `t`. Verificado reintroduciendo una copia:
falla nombrando el archivo.

`const ts = (iso) => ...` está escrito a mano en 11 archivos de `tests/` y
exportado dos veces más desde `tests/fixtures/` (`ciclo.ts` y `centinelas.ts`,
cada uno con una forma distinta). Cuatro variantes:

| Forma | Dónde |
|---|---|
| `{ toDate, toMillis }` | `reportes`, `calendario`, `sincronizacion`, `historial`, `costuras`, `fixtures/ciclo` |
| `{ toDate, toMillis, seconds: Math.floor(…), nanoseconds: 0 }` | `toPublic`, `libro-presentado`, `cupo-completo`, `fixtures/centinelas` |
| `{ toDate, toMillis, seconds: 0, nanoseconds: 0 }` | `calendarioPanel`, `filtrosActividades` |
| delega en `tsDe` | `textoRedes` |

**La tercera forma es un fixture que miente**: dice que todo `Timestamp` es la
época. Hoy no rompe porque ningún código de producción lee `.seconds` —lee
`.toDate()` y `.toMillis()`—, pero el `Timestamp` real de Firestore sí lo expone,
y el día que algo lo use esos dos archivos van a pasar con datos falsos. Es la
trampa 1 del §13 dentro del fixture que existe para atajarla.

**Es la misma clase que el repo ya automatizó** —«un fixture que no ejercita el
caso central del dominio»— y que hizo nacer `tests/fixtures/ciclo.ts` y
`invariantes-de-ciclo.test.ts`. Reapareció con otra cara: no es que el fixture no
ejercite el caso, es que hay trece fixtures y no se parecen entre sí.

Arreglo: **un** `ts()` exportado de `tests/fixtures/`, con la forma completa (la
segunda), y los otros doce borrados. Es mecánico y sin riesgo: los cuerpos son
compatibles hacia arriba. Lo que conviene decidir de paso es dónde vive — hoy
`ciclo.ts` y `centinelas.ts` se lo copian entre ellos, que es el mismo bug un
nivel más adentro.

### B-212 · La proyección pública de `/opciones/*` no existe, y el barrido no la ve — ✅ hecho (2026-08-27)

**Hecho.** `opcionPublica` y `opcionesPublicas` en `toPublic.ts`, con whitelist de dos
campos y sin spread, escritas **antes** de su consumidor (B-106) porque el punto era
llegar antes que el atajo.

`ValorOpcion` salió de la lista de interfaces AJENAS del barrido de B-196 y pasó a estar
anclada, con `opcionCentinela()` y tres rutas de centinela nuevas.

**El `auditor-privacidad` encontró cinco cosas sobre este mismo cierre, y las cinco
eran de índice y de red — ninguna una fuga.** Vale listarlas porque cuatro eran
afirmaciones que el cierre había escrito:

1. La ficha del agente seguía atribuyendo la salida 1 solo a `toPublic`, y el guard
   de B-216 **no podía verlo**: comparaba el primer path de cada fila y las dos
   colapsaban a `src/lib/toPublic.ts`. Es el modo de falla de B-216 un nivel más
   adentro — el índice envejeció y el test que lo ataba miraba el archivo, no qué de
   ese archivo produce la salida. El guard ahora compara las **funciones**, y es
   direccional: la ficha puede saber más que el documento, nunca menos.
2. Anclar `ValorOpcion` la metió en el chequeo de cobertura pero **no** en el
   recorrido que exige que cada string del fixture sea rastreable. Un campo de texto
   nuevo en la taxonomía quedaba obligado a declararse y podía entrar con un valor
   inocente: obligatorio de declarar, invisible para todo barrido.
3. «Verificado por mutación» era **a mano**. Ahora hay un `it` que mete el spread y
   exige que el barrido falle nombrando `opcion.huellaCreador` — el gemelo del
   control negativo que la actividad ya tenía para `libro`.
4. El docblock que explica por qué el import va a `@/lib/taxonomia` y no a
   `@/lib/opciones` **no lo fijaba nadie**: el atajo typechequeaba y dejaba toda la
   suite verde, arrastrando `firebase/firestore` al módulo de la proyección pública.
   Y el grafo de `bundle-panel.test.ts` tampoco lo veía, porque `toPublic` no tiene
   importador todavía (B-106). Hay guarda nueva, sobre el cierre transitivo de sus
   imports.
5. La tabla de `07-seguridad.md` atribuía todo a `opcionesPublicas`, que **no
   interviene en dos de los tres caminos**. Son tres —`opcionesPublicas`,
   `labelsDeOpciones` y el `cargarLabels` de la Function— y el tercero **no se puede
   unificar**: `functions/` no importa de `src/` (D-20). La política del repo para
   ese caso ya estaba escrita en `10-salud-del-codigo.md`: un test que compare las
   listas, no un import imposible. Es la clase de B-212 en `clases-de-bug.test.ts`.

**Y ese último test salió mal la primera vez**, que es el detalle que más vale:
rastreaba los accesos por una variable llamada `v`, así que meter un
`sort((a, b) => b.usos - a.usos)` pasaba en verde. Un chequeo que depende del nombre
que eligió quien escribió el código verifica la convención de nombres, no el código.
Ahora deriva del modelo qué campos están prohibidos y busca el **acceso** sin
importar de qué variable. Verificado con las dos mutaciones.

**Un error propio que vale anotar:** la primera versión filtraba las no aprobadas con
`v.aprobada !== false` en vez de reusar `estaAprobada`, que es
`v.fijo || (v.aprobada ?? true)`. Eso habría borrado de los filtros del sitio a una
opción **base** que tuviera `aprobada: false` — o sea «Gratis» y «A la gorra». Es la
clase de B-72 (la misma regla escrita dos veces) apareciendo en el acto de cerrar otro
ítem. Hay dos `it` que lo fijan.

`toPublic.ts` proyecta la actividad campo por campo, con whitelist y sin un solo
spread. Para `/opciones/*` no hay nada equivalente, y B-106 la va a necesitar: el
§4.4 dice que el `events.json` lleva `{ slug, label }`, pero el documento tiene
además `orden`, `fijo`, `usos`, `aprobada` y `huellaCreador`.

El default cuando se implemente B-106 es escribir `valores` tal cual —una línea, y
se ve razonable— y ahí `huellaCreador` (un pseudónimo derivado de un uid) y `usos`
entran al JSON público. **Nada lo detiene:** el barrido de centinelas de B-196
está anclado a las interfaces de una *actividad* (`ANCLAS`), y `ValorOpcion` /
`DocOpciones` están explícitamente en `AJENAS`. O sea: la única salida pública
nueva que ya está planificada nace fuera de la red.

Arreglo, hoy y aunque el consumidor no exista todavía —que es el punto—:
`export const opcionPublica = (v: ValorOpcion) => ({ slug: v.slug, label: v.label })`
en `toPublic.ts`, al lado de `imagenPublica` y `libroPublico`, que ya establecieron
el patrón; más su `it` y su ancla en el barrido. Escribir la whitelist antes que
el consumidor es lo que evita que la decisión la tome un spread.

---

### B-217 · El paso 4 del gate pasaba en verde sin leer Firestore — ✅ hecho (2026-08-27)

`1.4.0` agregó al paso 4 de `scripts/verificar-todo.sh` un
`FIRESTORE_EMULATOR_HOST` apuntado al emulador, con el comentario de que así el
build «ejercita la lectura real» ahora que `src/pages/events.json.ts` arma el
`events.json`. No la ejercitaba, por dos motivos que se tapaban entre sí:

1. **El paso 3 tiene dos ramas.** Si detecta un hub de emuladores arriba lo reusa
   y queda vivo; si no, usa `firebase emulators:exec`, que **levanta y apaga** los
   emuladores alrededor de los tests. En esa segunda rama, al llegar al paso 4 no
   había nadie escuchando: medido, el build se quedaba **44 segundos** y moría con
   `14 UNAVAILABLE`. O sea que el gate corrido sin un emulador previo **fallaba
   siempre y por su propia plomería** — exactamente lo que el paso 3 había
   aprendido a no hacer (B-180), reintroducido un paso más abajo.
2. **Y con el emulador vivo tampoco probaba nada.** Los tests de integración del
   paso 3 terminan llamando a `limpiarFirestore()`, así que el paso 4 llegaba a
   una base **vacía**. Medido en el emulador de la sesión: `0` actividades. El
   build leía cero, escribía un `events.json` sin ninguna, y salía en verde.

Las dos mitades juntas dan el peor resultado posible: un chequeo agregado **para**
garantizar «esto leyó Firestore» que pasa idéntico leyendo cero documentos. Es la
trampa que el propio commit decía prevenir — D-123 dice que leer cero actividades
no falla solo, produce un `events.json` vacío, y el deploy lo publica encima del
sitio que sí tenía datos.

**El arreglo.** La detección del hub se hace **una vez** y la comparten los pasos 3
y 4 (tenerla escrita dos veces fue lo que dejó al paso 4 apuntando a un puerto que
el paso 3 apagaba). El paso 4 corre `scripts/build-contra-emulador.mjs`, contra el
hub que ya está o contra uno efímero, y ese script siembra una actividad publicada
y una en borrador, buildea, y **afirma sobre el `dist/events.json` que salió**: la
publicada está, la borrador no, y ningún centinela de los campos recortados
sobrevivió. Los documentos sembrados se borran en un `finally`.

**Verificado por mutación**, que es lo único que distingue un chequeo de un
comentario: con el `where` apuntado a un estado inexistente el gate falla
nombrando las cero actividades; sin el `where` falla nombrando la borrador; con
`destino: a.inscripcion.destino` agregado al índice falla nombrando el campo.

No se testea el script del gate: no hay precedente de testear `verificar-todo.sh`
en este repo y B-180 (P3) sigue siendo el ítem que lo pide para el paso 3.

### B-218 · Las redes que faltaban alrededor de `/events.json` — ✅ hecho (2026-08-27)

Cuatro hallazgos del `auditor-privacidad` sobre `4d223c1`, los cuatro
verificados antes de acatarlos y los cuatro cerrados. **Ninguno era una fuga**:
el recorte del índice, la query y `cierraEn` estaban bien. Lo que faltaba era la
red que los sostenga.

1. **Ningún test nombraba `src/pages/events.json.ts`.** `tests/eventsJson.test.ts`
   prueba la librería y el barrido prueba la proyección: los dos entran a la
   cadena **después** de que el endpoint eligió qué documentos leer, así que
   ninguno miraba la query. Medido: borrar el `.where('estado','==','publicado')`
   dejaba la suite entera en verde. Cerrado con
   `tests/events-json-endpoint.integracion.test.ts`, que siembra una publicada y
   las tres no públicas —borrador, cancelada, pendiente— y afirma sobre el JSON
   que el endpoint devuelve. De integración y no de texto: un `grep` al fuente
   pasaría con la cláusula escrita mal. El mismo archivo cubre las dos ramas de
   credenciales (D-123, B-189), que hasta hoy las sostenía una frase de un mensaje
   de commit.
2. **La tabla de salidas nombraba un solo productor de la salida 1.**
   `docs/07-seguridad.md` y la ficha del agente decían `src/lib/toPublic.ts`;
   desde B-106 son **tres archivos en serie**. Es la forma de B-216 un archivo más
   adentro: un cambio futuro que tocara solo `src/lib/eventsJson.ts` no despertaba
   al auditor por nombre de archivo. Actualizadas las dos tablas y el
   `description` del frontmatter, que es el disparador.
3. **La guarda de B-212 estaba cableada a un archivo.**
   `tests/bundle-panel.test.ts` tenía `const PROYECCION = 'src/lib/toPublic.ts'`, y
   su docblock decía «`toPublic` no tiene hoy ningún importador en `src/`», frase
   que B-106 dejó falsa. `src/lib/eventsJson.ts` **hereda la posición exacta** —
   proyección pura, sin consumidor cliente hoy, con uno previsto en B-105 — y
   ninguna de las tres redes lo veía. Ahora es un `describe.each` sobre los dos.
4. **Dos celdas sin decidir.** El link de la reunión con `urlPublica: true` no
   tenía caso en el barrido del índice (ver **D-129**), y el `resumen` era un
   recorte solo por el nombre de la función: cambiar la línea a
   `resumen: a.descripcion` dejaba todo verde, porque el test de ausencia busca la
   clave `"descripcion"` —que sigue sin existir— y el barrido permite ese centinela
   justamente porque el resumen lo contiene.

Los tres tests nuevos se verificaron **por mutación**: se rompió la condición a
propósito y se confirmó el rojo antes de darlos por buenos.

Lo que el auditor reportó y **no** se acató: nada — los cuatro resultaron ciertos
contra el árbol.

## P2 — mejoras reales

### B-232 · `/ayuda` y `/contacto` — ✅ hecho (2026-08-28)

Las dos primeras páginas terminadas del sitio público. Son texto y nada más: no leen
`events.json` ni Firestore, así que se pudieron escribir en paralelo con el listado
sin depender de él.

**`/ayuda`** le habla a quien busca una actividad, no a quien la carga —la guía del
panel es otra cosa y vive adentro del panel—. 20 preguntas en cinco grupos,
todas abiertas y con ancla propia (`/ayuda#a-la-gorra`). Las que el encargo pedía
están fijadas en el test con el motivo de cada una: que esto **no es una plataforma
de inscripción**, qué es cada tipo, «a la gorra» (§4.1), el ciclo como una tarjeta y
no ocho (§2.2), el link de la reunión que no se publica (§5.1, trampa 5), y las
salidas a `/suscribirse` y `/contacto`.

**`/contacto`** son dos `mailto:` con el asunto ya puesto, con qué conviene contar en
cada caso y qué pasa después. Nada de dirección ni asunto escritos a mano: salen de
`enlaces.ts` (B-228).

**Lo que hace que esto no envejezca mal** (D-135): el glosario de tipos y el de
aranceles se **derivan** de `opciones-base.json`. Una lista de cinco tipos escrita a
mano en la ayuda ya habría quedado vieja dos veces —`feria` (B-129) y
`libreria-a-la-calle` entraron como opción base después del `CLAUDE.md`— y sin que
nada fallara. Hoy el test nombra la categoría que falta explicar.

Doce mutaciones probadas, todas rojas. Una fue instructiva y quedó anotada en el
test: la primera versión del chequeo «la sugerencia pide quién, cuándo y dónde»
usaba `d[oó]nde` y **la satisfacía «un link donde esté anunciada»**, que no dice nada
del lugar. Se apretó a la forma con tilde, que es la interrogativa.

### B-233 · El pie manda a un `mailto:` crudo y se saltea la lista de qué contar — ✅ hecho (2026-08-28)

`src/components/sitio/PieDePagina.astro` linkea «Sugerir una actividad» directo a
`urlDeContacto('sugerencia')`. Estaba bien cuando `/contacto` no existía; desde
B-232 la página tiene la lista de qué conviene contar —quién la da, cuándo, dónde,
un link donde esté anunciada— y **el mail que sale del pie no la vio**.

No es cosmético: cada sugerencia sin fecha o sin lugar es un ida y vuelta, y el ida y
vuelta es donde se pierden. El arreglo es una línea (`href="/contacto"`), pero el
archivo es del frente del chrome del sitio y no se toca desde otro (B-229).

Lo mismo aplica a cualquier otro lugar que en el futuro ofrezca «sugerir» sin pasar
por la página.

### B-234 · El mapa de URLs de `12-sitio-publico.md` diseñó páginas que se llaman de otra manera · P2

El §4.5 del diseño lista `/pasadas`, `/calendario`, `/acerca` y `/404`. El sitio que
se está construyendo tiene `/`, `/suscribirse`, `/ayuda` y `/contacto` —así lo
declara `Encabezado.astro`, que es lo que se publica—: `/calendario` pasó a llamarse
`/suscribirse`, y el rol de `/acerca` («qué es, quién lo mantiene, cómo se carga una
actividad, y el canal para proponer una») quedó repartido entre `/ayuda` y
`/contacto`.

Es la misma clase que **B-223**: el documento de diseño sigue describiendo un sitio
que no es el que se está haciendo, y quien lo lea para escribir la próxima página va
a diseñar contra los nombres viejos. Conviene arreglar los dos de una sola pasada,
por una sola persona, cuando las tres páginas estén integradas — hacerlo ahora desde
tres frentes en paralelo produce tres versiones del mismo párrafo.

### B-235 · La home atenúa texto por debajo del contraste AA — ✅ hecho (2026-08-28)

`src/pages/index.astro` usa `text-tinta/60` (línea 14) y `text-tinta/45` (línea 17).
Medido contra la paleta de `global.css` —papel `#fcfaf6`, tinta `#171b22`— eso da
**4,49:1** y **≈3,0:1**, con el piso de AA en 4,5:1 para texto normal. El primero
falla por un pelo y el segundo no está cerca.

Apareció el 2026-08-28 midiendo el contraste de `/ayuda` y `/contacto` (B-232), que
tenían el mismo `/60` en cuatro lugares por el mismo motivo: **se ve bien**, y ese es
todo el problema. Nadie lo nota mirando, así que se escribe sin pensar. En esas dos
páginas se subió a `/70` (6,3:1) y quedó fijado con un chequeo que prohíbe el rango
entero — `tests/ayuda-del-sitio.test.ts`, «ningún texto de las dos páginas cae por
debajo del contraste AA».

**Qué se hizo, y encontró más de lo que este ítem describía.** Al extender el
chequeo a todo el sitio aparecieron **cuatro** lugares, no dos: además de los de la
home, dos `marker:text-tinta/45` (2,86:1) en los marcadores de las listas de pasos
numerados de `/suscribirse` — escritos **el mismo día** por otro frente, mientras
éste se abría. Los marcadores de una lista ordenada son contenido: si no se leen, no
se sabe cuál es el paso 3. Los cuatro a `/70`.

**Y el chequeo cambió de forma, que es lo que vale.** No es un piso de opacidad
escrito a mano —«nunca menos de /65»—, porque eso sería cierto para esta paleta y
mentira para la siguiente sin que nadie se entere. `tests/contraste-del-sitio.test.ts`
**lee los tokens de `global.css`** y calcula: aclarar la tinta pone en rojo las
opacidades que dejaron de alcanzar, que es exactamente cuando hay que revisarlas. La
matemática vive en `src/lib/contraste.ts` y se ancla contra los valores de la norma
(21:1, 1:1) en vez de contra sí misma.

Lo que enseñó: **la regla no se sostiene con atención.** Tres frentes en paralelo la
rompieron dos veces en una tarde, y uno de ellos era el que la estaba documentando.


### B-237 · Astro le pasa un argumento a `getStaticPaths` y el alias rompía el build entero — ✅ hecho (2026-08-28)

**Qué se rompía.** `export const getStaticPaths = caminosDeDetalle;` — el alias,
que es lo que uno escribe. Astro llama a `getStaticPaths` con un objeto propio
(`{ paginate, rss }`), ese objeto caía en el primer parámetro de la función —el
reloj— y la generación moría con `ahora.getTime is not a function`: **cero páginas
de detalle**, con los 1.600 tests en verde.

**Cómo apareció.** No lo vio ningún test unitario, porque todos la llaman bien. Lo
encontró `scripts/build-contra-emulador.mjs`, o sea el build de verdad contra el
emulador — el §"Verificar contra el sistema real" de
[`05-patrones.md`](05-patrones.md) haciendo exactamente lo que promete, y el mejor
argumento que tiene ese párrafo hasta ahora.

**Arreglo, en dos capas.** La plantilla envuelve
(`getStaticPaths = () => caminosDeDetalle()`), y `caminosDeDetalle` **ignora un
`ahora` que no sea `Date`** — la segunda es la que sigue valiendo el día que
alguien vuelva al alias. Red: `tests/pagina-de-detalle.test.ts` prohíbe el alias, y
`tests/sitio-publico.integracion.test.ts` la llama **igual que Astro** y exige que
devuelva sus caminos.

### B-243 · El texto secundario del sitio no llegaba a AA — ✅ hecho (2026-08-28)

**Qué se rompía.** La primera versión de B-227 usaba `text-tinta/45`, `/50`, `/55`
y `/60` para todo el texto secundario —fechas, rótulos, contadores, el número de
cada chip, los encuentros pasados—. Sobre `--color-papel` esos cuatro dan **2,86 ·
3,30 · 3,84 · 4,49**: ninguno llega al 4,5 que pide WCAG AA para texto normal, y el
primero no llega ni al 3 del texto grande. 35 usos en seis archivos.

**Por qué no lo vio nadie.** El contraste no rompe ningún build, no tira ningún
error y en una pantalla buena se ve bien. La única forma de saberlo es calcularlo,
y el §10 del diseño pedía medir **el acento** —que sí pasa, 5,63— sin anticipar
que el riesgo real estaba en la rampa de opacidad.

**Arreglo.** Piso en `tinta/65` (5,29). Y `tests/contraste-del-sitio.test.ts`, que hace las
dos mitades: calcula los ratios desde los tokens de `global.css` (parseados, no
copiados, para que cambiar la paleta se note) y **falla si algún archivo del sitio
público escribe una clase por debajo del piso**. Con control negativo: un escalón
más abajo tiene que no pasar, o el piso no significaría nada.

**Lo que queda afuera a propósito:** el panel. Es otra audiencia —se usa con sesión
y en una pantalla elegida— y su rampa es anterior a esto; revisarla es su propio
ítem, no éste.

### B-238 · La hoja inferior de filtros de móvil · P2 — la mitad del CTA cerrada en D-145

El §8 del diseño pedía dos elementos fijos que B-227 no construyó, y los dos por el
mismo motivo: son **capas modales**, y una capa modal mal hecha es peor que no
tenerla — necesita trampa de foco, cierre con `Escape`, cierre tocando el fondo,
devolver el foco al abridor y `pushState` para que el botón atrás del teléfono la
cierre en vez de salir del sitio.

**El CTA del detalle ya no es uno de los dos** (D-145, 2026-08-31). Se resolvió sin
capa modal y sin JavaScript, cambiando la regla en vez de la herramienta: en el
teléfono el botón del flujo **no se pinta** y la barra de abajo es el único CTA, así
que no hay «desde que el otro sale de la pantalla» que calcular, ni foco que atrapar,
ni `Escape` que cerrar. Queda **solo la hoja de filtros**, que sí es una capa modal de
verdad.

Hoy el panel de filtros es un *disclosure* inline (`aria-expanded`/`aria-controls`)
que no necesita nada de eso y no tiene cómo salir mal.

Cuando se haga, **la aritmética ya existe**: `src/lib/foco.ts` tiene
`indiceDeTab`, `indiceDeTecla` e `indiceSiguiente`, escritos para el menú «⋯» y la
capa de ayuda del panel (B-14, B-64). El §10 del diseño dice que el sitio público
es el lugar donde ese componente se hace bien de entrada y que después puede
resolver los dos del panel.

### B-239 · La home baja el runtime de React por la island de filtros · P2

Medido en el build del 2026-08-28: `client.BlZe1zq3.js` son **186 KB (58 KB
gzip)**, más `Buscador` (16 KB / 5,8 KB gzip). El §8 del diseño fija el presupuesto
de la home en «solo la island de filtros» y no dice cuánto pesa esa island.

**La página de detalle no está afectada** —tiene cero JavaScript, y es la que
recibe el tráfico— así que esto es P2 y no P1.

Tres caminos, de menos a más trabajo:

1. **`preact/compat`** como alias de `react`/`react-dom` **solo para el sitio
   público**. Baja a ~10 KB gzip. El riesgo es el panel: comparte componentes con
   el sitio (hoy ninguno, pero `Tarjeta` podría), y el panel usa React 19.
2. **Reescribir la island sin framework.** La lógica ya es pura y está en
   `src/lib/listadoPublico.ts` con sus tests; lo que se reescribe es solo el
   render. Pero se pierde el «un solo markup de tarjeta», que es lo que el §6.3
   pide y lo que este frente logró.
3. **Dejarlo.** 58 KB gzip cacheados en CDN, en una página que no es la que recibe
   el tráfico.

Medir antes de elegir: con el sitio desplegado, cuánto tarda la home en un 3G
simulado.

### B-240 · La casilla dice «publicar el link en el sitio» y el sitio no lo publica · P2

**D-139** decidió que `online.url` no sale a la página de detalle ni con
`urlPublica: true`, más estricto que D-15. Correcto para el link —un HTML indexado
no se despublica— pero deja una inconsistencia visible: quien tilda la casilla
espera ver el link en el sitio, y no aparece.

Las dos salidas, y la conversación es del dueño:

- **Cambiar el texto de la casilla** para que diga a dónde sale de verdad (hoy el
  link va al `events.json` y a la descripción del evento de Calendar, que es donde
  lo ve quien está suscripto).
- **O publicarlo en el detalle** y aceptar el riesgo, que es el zoombombing de la
  trampa 5 sobre una página que Google indexa.

Mientras tanto la ayuda del panel dice «Solo sale al sitio y al evento del
calendario si tildás…», que **también hay que corregir** en la salida que se elija.

### B-241 · El fixture del gate de build es anterior a B-224, así que no ejercita el bloque «Dónde» · P2

`scripts/build-contra-emulador.mjs` siembra una actividad con `modalidad`, `sede` y
`online` de **primer nivel** y sin el array `modalidades`, que es la forma que el
modelo tenía antes de B-224. Consecuencia, medida el 2026-08-28: en el HTML que
genera el gate, la página de detalle **no pinta el bloque «Cómo se cursa» ni la
sede**, y `datosEstructurados` devuelve `null` porque no hay ningún `location`.

O sea: el gate que existe para mirar el artefacto de verdad no mira dos de sus
secciones, y los centinelas `gate.sede.direccion` y `gate.sede.indicaciones` no
aparecen en el HTML **por el fixture y no por la proyección**. Lo verifican igual
el barrido de centinelas y `tests/sitio-publico.integracion.test.ts` —que sí usa el
fixture con `modalidades`—, así que no hay hueco de cobertura; hay un gate que
comprueba menos de lo que parece.

Arreglo: darle `modalidades: [{ id, modalidad, inicio, fin, sede, online }]` al
fixture del script, con los mismos centinelas.

### B-242 · Cuando el sitio se publique hay que corregir la ayuda del panel · P2

Dos textos de `src/lib/ayuda.ts` dicen hoy la verdad y van a dejar de decirla el
día del deploy:

- «Hoy el sitio todavía no está publicado: se está construyendo. Por ahora lo que
  la gente ve de afuera es el calendario…»
- «En el sitio va a aparecer cuando el sitio esté publicado.»

**No se tocan ahora, a propósito:** el sitio está construido pero no desplegado
—falta el dominio (B-109) y el rebuild automático (B-20)—, así que cambiarlos hoy
convertiría una ayuda cierta en una que miente, que es peor. Va con el deploy, y
en el mismo cambio va la entrada de `src/lib/novedades.ts`: «tus actividades ahora
tienen su propia página pública» **sí** es una novedad para quien carga, pero solo
cuando sea cierta.
### B-224 · Una actividad tiene N modalidades, cada una con su lugar — ✅ hecho (2026-08-27), con una decisión abierta

Pedido del dueño (2026-08-27), textual:

> Una actividad tiene N modalidades (mismo sistema que encuentro, misma UI). Cada
> modalidad puede ser presencial, virtual o híbrida, como está ahora. Solo hay que
> sumarle una fecha y hora de inicio y una fecha y hora de finalización. Ambas son
> opcionales.

Hasta acá `modalidad` era **un escalar** a nivel actividad, con **una** `sede` y
**un** bloque `online` al lado. Ahora es una **lista de filas** con el patrón de
`sesiones` (§11): filas dinámicas, ids generados en el cliente (`mod_<uuid>`,
**nunca por índice** — trampa 2), agregar / duplicar / borrar, y las fechas como
`Timestamp` en Firestore y `datetime-local` en el formulario (trampa 1, con
`aDatetimeLocal` / `deDatetimeLocal` de `src/lib/sesiones.ts`, reusadas y no
reescritas). El razonamiento completo está en **D-130**.

#### 🔴 Lo que falta decidir, y es del dueño

**Qué significan las fechas de una modalidad frente a `sesiones[].inicio/fin`.**
Él mismo lo dejó abierto: «sobre las fechas, te lo consulto pero hacé el resto».
El campo está implementado —los dos `datetime-local` opcionales, guardados como
`Timestamp`— y mientras tanto se eligió lo conservador: **no salen a ninguna de
las cinco salidas públicas**. Ni al `events.json`, ni a la descripción del evento
de Calendar, ni al texto para redes, ni al `searchText`, ni a la analítica.

Un campo que no sale no puede decir algo equivocado en el calendario de todos los
suscriptos, y agregarlo después es una línea; sacarlo de algo ya publicado, no.
La celda está fijada por `tests/modalidades.test.ts`, que busca las fechas **por
su valor** en las cinco salidas. Si se decide publicarlas, hay una celda más que
resolver: el **índice del listado** (`eventsJson.ts`), que hoy no lleva ni
siquiera las filas — solo sus valores, para el filtro.

Las tres formas posibles, para cuando se decida:

| Opción | Qué implica |
|---|---|
| **Ventana descriptiva** («la cursada presencial va de marzo a junio») | Sale como texto en la descripción del evento y en el detalle del sitio. No crea eventos, no entra al orden por «próximo encuentro» ni al filtro «con algo por venir». Es lo más barato: una línea en `construirDescripcion` y otra en `toPublic`. |
| **Compite con los encuentros** | Habría dos ejes de fechas y `planificar` tendría que decidir cuál publica: es el §2.2 al revés y duplica eventos. |
| **Solo interna** (lo de hoy) | Se ve en el panel y en ningún lado más. |

#### Las otras tres decisiones, resueltas

| # | Pregunta | Resolución |
|---|---|---|
| 1 | ¿`sede` y `online` se mueven adentro de cada fila? | **Sí, decisión del dueño**: «el formulario de modalidad se mantiene tal cual + doble fecha. Y sobre eso es tener N modalidades así como N encuentros. Misma interfaz y funcionalidades». Cada fila es una forma de cursar con su lugar. Quedan `modalidad`, `sede` y `online` a nivel actividad como campos **derivados** que escribe `formADocumento` — ver la fila 3. |
| 2 | ¿Migración de los documentos que ya existen? | **No hace falta**, decisión del dueño: «no te preocupes por hoy, no hay nada en producción». No hay backfill, ni script, ni lectura de compatibilidad: solo un `?? []` donde el campo puede faltar. **Y esa fue la parte que costó decidir.** Hubo una `modalidadesDe` que sintetizaba una fila con el `modalidad`/`sede`/`online` de primer nivel, con id determinístico, copiando el patrón de `imagenesDe` (D-125): se escribió porque el `auditor-trampas` mostró que sin ella abrir y guardar un documento así le borraba la sede en silencio. Se sacó igual, y el argumento es el que vale: **existía para leer documentos que no existen**. Dos auditores le encontraron algo en una sola sesión —privacidad: es una rama de proyección pública que ningún centinela recorre; trampas: fabrica una fila fantasma cuando la lista está vacía a propósito— y el arreglo más barato para una rama sin barrido es no tener la rama. Una celda que no existe no hay que decidirla en cada una de las cinco salidas. |
| 3 | ¿Cuál modalidad manda donde solo se puede decir una? | **La unión** (`modalidadResultante`): dos filas que difieren dan `hibrido`. No «la primera», que dependería del orden del array —la trampa 2 en otra forma—. Y el **filtro del panel busca por cualquiera de las filas**, no solo por la resultante: una actividad presencial-y-virtual aparece bajo los tres chips, porque las tres cosas son ciertas de ella. `sede` y `online` sí son «la primera fila que tenga una», porque una dirección hay que elegirla; si algún día importa distinguirla, la respuesta es un flag explícito como el `portada` de D-125. |

#### Lo que este ítem NO hizo, y por qué

- **No crea eventos de Calendar por modalidad.** El §2.2 es explícito: un evento
  por sesión.
- **No cambia el texto para redes.** `ActividadParaRedes` es un `Pick` declarado a
  propósito, así que un campo nuevo del §3.1 no entra solo: `bloqueDonde` sigue
  leyendo el escalar derivado y un posteo dice hoy exactamente lo que decía ayer.
  Nombrar las N formas de cursar en la caption es una decisión de copy.
- **No unifica `ETIQUETA_MODALIDAD`** (eso es B-175, con su `it.fails`).
- **No migra `SesionesEditor` a otro comportamiento**: solo se le sacó el chasis
  compartido (`campos/FilasEditor.tsx`), que ahora usan los dos editores.

#### Se cruza con B-181 / DEC-8, y no lo reemplaza

DEC-8 resolvió un eje nuevo `opciones: [{ id, etiqueta, sesiones }]` para las
**alternativas excluyentes** de un ciclo («cuatro horarios, vas a uno»). Esto es
otro eje: **tramos** de la misma cursada, que conviven. Una fila de modalidad no
dice «elegí una», dice «de marzo a junio es presencial, en la librería». Si algún
día se implementa DEC-8, la pregunta que aparece es si una opción lleva su propia
modalidad — y ahí sí las dos listas se multiplican. Queda anotado, no resuelto.

### B-219 · Dos worktrees corriendo tests comparten el emulador y se pisan · P2

Apareció el 2026-08-27 cerrando B-217: una corrida de `npm test` dio **1 test en
rojo sobre 1403** y otra **2**, con el árbol y el comando idénticos, y las otras
trece de esa tanda dieron verde. Un rojo que no se reproduce es peor que uno que
sí: enseña a re-correr en vez de mirar.

**La correlación está medida, no supuesta:** las dos corridas rojas son
exactamente las dos que cayeron mientras había un `vitest` de **otro worktree**
corriendo (`ps` lo mostró en las dos; las trece verdes salieron con el otro
worktree quieto).

**La causa, verificada con `lsof` y `ps` en el momento:** había **dos** emuladores
arriba, uno por working-tree (`…/agenda-literaria` y
`…/.claude/worktrees/agent-…`), y **un `vitest` del otro worktree corriendo en
paralelo**. El segundo emulador no pudo tomar los puertos del primero, así que los
corrió: hub `4401` en vez de `4400`, storage `9199` en vez de `9099`. Pero
`vitest.config.ts` resuelve
`FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080'`
— o sea que **un `npm test` sin la variable exportada apunta al 8080 del otro
worktree**, no al suyo.

Y los tests de integración llaman a `limpiarFirestore()`, que borra la base
**entera**. Dos suites concurrentes contra el mismo Firestore se borran los
documentos entre sí a mitad de un `it`. El modo de falla es intermitente por
construcción y no dice nada sobre el cambio que uno está probando.

**Qué lo hace más caro ahora.** El paso 4 del gate (B-217) siembra dos actividades
y afirma sobre el `dist/events.json` que salió. Si el otro worktree corre
`limpiarFirestore()` entre la siembra y el build, el gate falla nombrando cero
actividades — o sea, **acusando exactamente el bug que vino a atajar**. Se vio en
la sesión en su forma benigna (el gate contó 2 publicadas donde siembra 1, por un
documento que un test había dejado; eso se arregló con un `afterAll`), pero la
forma mala es la otra.

Opciones, de menos a más invasiva:

1. **Que cada working-tree use su propio `projectId`.** El emulador de Firestore
   es multi-proyecto y `limpiarFirestore()` ya recibe el `projectId` como
   argumento, así que el borrado quedaría acotado. Choca con
   `"singleProjectMode": true` de `firebase.json`, que habría que apagar.
2. **Que `npm run emu` exporte los puertos que efectivamente tomó** y que
   `vitest.config.ts` falle en vez de caer al `?? '127.0.0.1:8080'`. El default
   silencioso es lo que hace que apuntarle al emulador de otro no se note.
3. **Un lock de archivo** alrededor de la suite de integración. Es lo más simple
   y lo más molesto: serializa dos worktrees que querían ir en paralelo.

No bloquea nada hoy: con un solo worktree trabajando no pasa. Se anota porque el
`docs/14-plan-de-saneamiento.md` reparte el backlog **entre worktrees en
paralelo**, que es justo la condición que lo dispara.

**Tercera observación independiente, desde el worktree de B-224** (2026-08-27), con
un dato que las otras dos no tienen: **se reprodujo con el árbol limpio**. El test
`un anónimo lee lo publicado` falló en la corrida completa con el cambio adentro, y
al hacer `git stash push -u` y correr la suite sobre `main` pelado **volvió a
fallar** una de dos veces; aislado, el archivo pasa siempre.

Vale anotar el método, no el hallazgo: ante un rojo intermitente el reflejo es
sospechar del cambio propio, y `git stash` + dos corridas lo descarta en dos
minutos. Es lo que evitó que este frente saliera a buscar un bug que no había.
**Confirmado por segunda vez, desde otro worktree, el 2026-08-27** (cierre de la
segunda tajada de B-167). Dos observaciones que acotan la causa más de lo que
estaba y que apuntan a la opción 1:

- **No hace falta un segundo worktree para que pase.** Con `vitest` corriendo
  **los archivos en paralelo dentro de una sola suite** ya alcanza: dos corridas
  seguidas dieron fallas **distintas** (`un anónimo lee lo publicado` una vez;
  `reusa la opción existente en lugar de duplicarla` la otra). O sea que los
  cuatro archivos de integración **se pisan entre sí**, no solo entre worktrees.
  Eso descarta que el arreglo pueda ser solo de coordinación entre working-trees.
- **`--no-file-parallelism` pasa siempre**, y es el bisturí que lo demuestra: 60
  archivos, 1369 tests, verde en todas las corridas. Sirve además como taponazo
  mientras se decide el arreglo de fondo.
- **Y no lo trajo el cambio que se estaba probando:** se reprodujo **sacando del
  run** el archivo de test que ese frente agregaba. Vale anotarlo porque el
  reflejo ante un rojo intermitente es sospechar de lo último que uno tocó.

Con esto, la **opción 1** (un `projectId` por working-tree) tampoco alcanza sola:
aísla worktrees pero no archivos. Lo que cubre los dos casos es un `projectId`
por **archivo de test** —el emulador es multi-proyecto y `limpiarFirestore()` ya
lo recibe como argumento—, o dejar de vaciar la base y que cada archivo borre
solo lo suyo.

**Cuarta observación, desde el worktree de B-232** (2026-08-28), y trae una cara
nueva: **`--no-file-parallelism` ya no alcanza.** La corrida completa con la bandera
puesta dio 3 tests rojos en `opciones.integracion.test.ts` («No existe(n) en
`opciones/arancel`: `con-beca-parcial`»), y el mismo archivo aislado pasó los 16.

Lo que eso agrega: la bandera serializa los archivos **de una corrida**, no las
corridas **de dos worktrees**. Con tres frentes trabajando a la vez —que es la
condición de hoy— la falla vuelve por el otro lado, y el síntoma engaña: parece un
script roto (`aprobar-opciones.mjs` cortando con un slug que no existe) y es la base
vaciada por el vecino en el medio del test. Sube la prioridad práctica del arreglo de
fondo: el taponazo que veníamos usando cubría la mitad del problema.

**Quinta observación, desde el worktree de B-230** (2026-08-28), y cierra el
argumento: **el mismo archivo falló en una corrida y se salteó en la siguiente.**
No cambió nada del código en el medio — otro worktree levantó los emuladores.

Las cuatro anteriores describían el emulador como *estado compartido que se
corrompe*; ésta agrega que también es **estado compartido que aparece y
desaparece**, y eso rompe la premisa del salteo automático. El diseño de hoy dice
«si no hay emulador, salteo»; con varios worktrees, «hay emulador» pasa a depender
de lo que esté haciendo el vecino, así que la misma suite reporta cobertura
distinta en dos corridas seguidas. `EXIGIR_EMULADOR=1` tapa la variante silenciosa
—que es para lo que existe— pero no la corrupción.

**Cinco observaciones independientes, tres worktrees, dos días.** Lo que las cinco
comparten está en **B-236**: algo que uno supone aislado por worktree y es global
del repositorio. El arreglo de fondo probablemente sea un puerto de emulador por
worktree, o un `projectId` por worktree sobre el mismo emulador.

### B-112 · `estado` y `actualizadoEn` en la proyección pública

Dos campos que el sitio público necesita y `toPublic.ts` no lleva
([`12-sitio-publico.md`](12-sitio-publico.md) §11.2):

- **`estado`** (`'publicado' | 'cancelado'`) — sin esto el HTML no puede pintar
  la franja CANCELADA ni emitir `eventStatus`. Lo necesita B-110.
- **`actualizadoEn`** (ISO de `updatedAt`) — es el `lastmod` del sitemap y el
  "actualizado el …" del detalle. Sin él el sitemap va sin `lastmod`, que es
  mejor que estampar la fecha del build en todas las páginas: eso le enseña al
  buscador que nuestras fechas mienten.

Ninguno de los dos publica nada nuevo: son datos que la página ya muestra.

### B-113 · Páginas de mes — `/agenda/{aaaa-mm}`

"Qué hay este mes" es una forma real de mirar la agenda, pero la página es un
subconjunto de la home y la consulta es de volumen bajo. Por eso va acotada
(§2.2 del diseño): solo meses vigentes, solo con **3 o más** actividades, no en
la navegación, y cuando el mes termina la URL no se rompe —se emite una última
vez con aviso y link a `/pasadas`.

Un ciclo que cruza dos meses aparece en los dos, y en cada uno muestra las
fechas de ese mes. Es la misma tarjeta con el subtítulo recalculado.

### B-40 · UI para ver y restaurar versiones

### B-30 · Las respuestas del dueño no vuelven al panel

El reporte sale del panel y termina en un issue público, pero la conversación
sigue **solo en GitHub**: quien reportó ve el número de issue y el link, no la
respuesta. Si no tiene cuenta de GitHub a mano, se entera por otro canal.

Posible mejora: espejar los comentarios del issue de vuelta al documento
`/reportes/{id}` (un `onSchedule` que consulte los issues abiertos con la
etiqueta `reporte-panel`, o un webhook de GitHub hacia una función HTTP) y
mostrarlos en la pantalla de reportes. Con webhook hay que validar la firma
`X-Hub-Signature-256` con un secreto, que es otro secreto más en Secret Manager.

Mientras no exista, el formulario y la lista lo dicen con todas las letras.

### B-31 · Un reporte en `error` no se puede reintentar desde el panel — ✅ hecho (2026-08-24)

Si la creación del issue falla por configuración (token vencido, permiso, repo
mal escrito), el reporte queda guardado en estado `error` y visible en el panel,
pero no hay botón para reintentar: las reglas prohíben que el cliente toque el
documento (el ciclo de vida es de la Function). Hoy se reintenta a mano con el
Admin SDK — el comando está en [`08-operacion.md`](08-operacion.md).

Opciones: una acción del panel que escriba solo `estado: 'pendiente'` con una
regla que permita ese único cambio, o una función `onCall` de reintento.

**Cómo quedó: la primera opción, y no la `onCall`.** El disparador de la
publicación ya es una escritura en el documento —`estadoTrasFallo` reintenta
poniendo `estado: 'pendiente'` y eso vuelve a disparar el trigger—, así que el
botón hace lo mismo que la Function ya hace sola. Un `onCall` habría sido un
segundo camino, con su endpoint, su chequeo del claim a mano y su propia forma de
fallar, para el mismo efecto.

Un detalle que el ítem no decía y decide si el botón sirve: hay que resetear
**`intentos` a 0**, no solo el estado. `decidirAccion` ignora un reporte con los
tres intentos gastados, que es justamente el caso más común de un `error`.

La regla (`reintentoValido`) permite una sola transición y prohíbe explícitamente
tocar el texto —que es lo que va a un repo público—, reintentar algo `enviando` o
ya publicado, y borrar. Siete tests contra el emulador, en
`tests/reportes-reintento.integracion.test.ts`. Ver **D-101** y §7 de
[`07-seguridad.md`](07-seguridad.md).

### B-03 · Historial de versiones (§12)


El historial ya se guarda (B-03, §12), pero **no hay pantalla**: recuperar un
campo pisado es abrir la consola de Firestore, buscar la subcolección
`versiones` de la actividad, elegir un documento por su id (que es la fecha y
hora) y copiar el valor a mano al formulario.

**Sin UI el historial ya sirve, y por eso se cerró B-03 sin ella:** lo que no
tenía arreglo era que el dato *no existiera*. Ahora existe, y recuperarlo es
incómodo pero posible — y es una operación rara, que hace el dueño, no un
usuario. Cada versión guarda `camposCambiados`, así que se puede ver de un
pantallazo cuál abrir sin revisarlas de a una.

Lo que haría falta: una pestaña "Historial" en el formulario que liste las
versiones con fecha y qué campos pisó cada una, un diff contra el estado actual,
y un "restaurar este campo" (mejor que restaurar el documento entero: restaurar
todo pisaría cambios posteriores que sí se querían).

**Ojo al implementarlo:** restaurar es una escritura más al documento, así que
dispara `guardarVersion` y deja versión de lo restaurado. Eso es correcto —
deshacer un "deshacer" tiene que ser posible— pero conviene verificarlo.

### B-41 · Borrar una actividad no guarda versión y no hay nada que recuperar — ✅ hecho (2026-08-24)

**Arreglado** con la primera opción: `guardarVersionAlBorrar`
(`onDocumentDeleted`) guarda el documento completo con `borrado: true`, por el
mismo camino que el trigger de edición. El borrado lógico se descartó con motivo
(D-94). La subcolección sigue quedando huérfana, que es lo que ya reportaba
**B-89**: es el precio de que el borrado sea recuperable.

`guardarVersion` es un `onDocumentUpdated`, así que no se dispara al borrar
(§12: es lo que pide el documento). El panel borra por fila, sin papelera: se va
la actividad y con ella su subcolección de versiones queda huérfana e
inalcanzable desde la UI.

Es el único agujero de pérdida de datos que queda. Un borrado es más
deliberado que pisar un campo sin darse cuenta —hay que apretar borrar y
confirmar— así que es menos urgente, pero es irreversible.

Opciones: un `onDocumentDeleted` que guarde la última versión (queda huérfana
igual, hay que decidir dónde), o borrado lógico (`estado: 'borrado'` y filtrarlo
del listado), que además resolvería el "lo borré sin querer" sin tocar el
historial. Lo segundo es más trabajo y toca el listado y las reglas.

### B-04 · Renombrar una etiqueta no actualiza los eventos ya creados — ✅ hecho (2026-08-24)

**Arreglado** con la primera opción: `rebuildPorOpciones` re-sincroniza los
eventos de las actividades publicadas cuando cambia una etiqueta (D-93), con la
guarda de que subir `usos` no cuenta como renombre y con un tope de 150 eventos
por corrida.

La descripción del evento muestra la etiqueta, no el slug (D-11). Si se renombra
"A la gorra", los eventos existentes siguen diciendo lo anterior hasta la
próxima edición de la actividad.

`rebuildPorOpciones` solo marca el rebuild del sitio. Opciones: re-sincronizar
las actividades publicadas cuando cambia `/opciones/*`, o aceptarlo y
documentarlo (ya está documentado).

### B-05 · Las etiquetas de taxonomía se ven en público sin normalizar — ✅ hecho (2026-08-24)

**Arreglado** con la primera opción **y** la segunda: `upsertOpcion` guarda el
label con `etiquetaPresentable` —espacios colapsados y primera letra en
mayúscula, sin tocar el resto (D-101)— y lo que ya está cargado mal se corrige
renombrando desde la pantalla de B-06. Solo la primera letra: bajar el resto
rompería "Villa Crespo", subir cada palabra rompería "Club de lectura".


Un tag creado como "narrativa" (minúscula) aparece así en el calendario público
y va a aparecer en los filtros del sitio. Ya pasó: `/opciones/tags` tiene
`narrativa="narrativa"`.

Opciones: capitalizar la primera letra al crear, o una UI para editar etiquetas
(el §4.3 dice que las creadas con "Otro" son editables y borrables — esa UI no
existe).

### B-06 · No hay UI para administrar taxonomías — ✅ hecho (2026-08-24)

**Hecho:** `src/components/admin/taxonomias/TaxonomiasPanel.tsx` — las cinco
listas con `usos` y estado, y renombrar / borrar / aprobar por fila (D-102).
Renombrar no toca el slug (§4.1); borrar no toca las actividades, que siguen
mostrando el des-slug de D-11, y por eso se confirma aparte cuando la opción está
en uso. Las base no ofrecen acciones y la guarda vive en la transacción, no en la
UI.

**Falta montarla en el router del panel: B-170.** El componente es
autocontenido; la línea que falta es en `AdminApp.tsx`.


El §4.3 dice que las opciones creadas con "Otro" son editables y borrables, y que
`usos` sirve para detectar basura ("una opción con `usos: 1` creada hace meses es
casi seguro un typo colgado"). No hay pantalla para nada de eso.

### B-07 · ~~El formulario no captura `sede.geo`~~ · ✅ hecho

El formulario captura las coordenadas pegando el link de Google Maps del lugar
o un par `lat, lng` (D-46). Sin geocoding: es una API paga y el budget es de
USD 5/mes.

**Queda afuera a propósito** el link corto `maps.app.goo.gl` (redirect + CORS):
el campo lo detecta y explica cómo salir del paso. Anotado en B-45.

### B-08 · Sin tests de componentes

No hay testing-library instalada. La lógica pura está muy cubierta (460 tests),
pero el render y la interacción del formulario se verificaron a mano.

Vale al menos para `TaxonomiaSelect` (el bug del placeholder que se veía como
opción elegida habría salido en un test de render), para el editor de sesiones y
para el `MenuAcciones` del listado (cierre por click afuera y por `Escape`) y
para `VistaPreviaEvento`: su adaptador está testeado, pero que el aviso del
link público se muestre —y que la descripción tenga su propio scroll— se
verificó a mano.

### B-09 · El bundle del panel pesa 576 KB — ✅ hecho (2026-08-21)

La carga inicial de `/admin` bajó de **766 kB a 353 kB** (gzip 200 → 95): la
pantalla de login ya no baja el SDK de Firestore. `db()` se mudó a
`src/lib/firestore-client.ts` y `AdminApp` carga el listado y el formulario con
`import()` diferido. Ver [CHANGELOG](CHANGELOG.md) y D-51.

Quedó afuera, a propósito: imports más finos del SDK (el modular v11 ya
tree-shakea bien — el chunk de auth son 166 kB y no entra nada de Firestore) y
`manualChunks` en `astro.config.mjs` (no cambia lo que el navegador necesita
para el primer render).

### B-50 · Verificar el corte del bundle después de mergear analytics — ✅ hecho (2026-08-24)

Verificado, y de una forma que no hay que repetir: `tests/bundle-panel.test.ts`
recorre el grafo de imports desde la island y afirma que `firebase/analytics`
—igual que `firebase/firestore`— no es alcanzable siguiendo solo imports
estáticos. El único import del SDK de analytics del proyecto es el `import()`
dinámico de `src/lib/analytics.ts`.

Un test vale más que el `npm run build` de una vez que pedía el ítem: la
pregunta vuelve a hacerse sola en cada corrida. Ver B-117 y D-100.

### B-35 · Salir del panel con cambios sin guardar no avisa — ✅ hecho (2026-08-24)

El store de `formulario-sucio.ts` ya sabe que hay cambios pendientes, y el aviso
de versión nueva lo usa. Pero cerrar la pestaña, volver a la lista o tocar
"Cancelar" sigue descartando el formulario sin preguntar.

Con el dato ya disponible es un `beforeunload` y una confirmación en el botón de
volver. Queda fuera de este cambio porque toca el flujo del formulario, no el de
versiones.

**Cómo quedó.** El `beforeunload` para cerrar la pestaña, y un `confirm()` con
texto propio en las cuatro salidas que el panel sí controla: "← Volver",
"Reportar algo", "Salir" y el "Cancelar" del formulario. "Calendario" no lo
necesita porque solo se ofrece desde el listado.

La regla de cuándo preguntar salió a `src/lib/salida-del-panel.ts` (pura, con
test) y en `AdminApp` quedó un solo `salirDe(accion)` que envuelve a las cuatro:
una salida nueva se escribe con esa forma, así que no puede olvidarse del aviso.
Ver **D-100**.

### B-36 · La versión no distingue dos builds sucios del mismo commit — ❌ descartado (2026-08-24)

`+a1b2c3d-sucio.20260821-2129` lleva sello de tiempo, así que dos builds sucios
distintos ya se ven distintos. Lo que no se puede saber es **qué** cambió.

**Se descarta, con tres motivos:**

1. **Un hash del diff no contesta la pregunta.** Diría si dos builds sucios
   salieron del mismo árbol, no qué tenían de distinto. Para eso hace falta el
   diff, y quien buildeó sucio lo tiene en su disco.
2. **Producción no puede salir de un árbol sucio.** El job de deploy de
   `.github/workflows/push-main.yml` corta con `::error::` si la versión del
   build contiene `-sucio` o `sin-git`, así que el formato con sello de tiempo
   es dev-only por construcción. Un ítem que solo aplica a builds que nunca se
   publican no vale su costo.
3. **No es la línea que parece.** Un hash fiel tendría que cubrir también los
   archivos sin trackear (`git diff HEAD` no los ve, `status --porcelain` sí),
   o sea decidir qué entra al hash y mantener esa decisión.

Lo que sí tenía valor de esta zona ya se hizo: hasta **B-88** un build sucio
mandaba `version: otro` a la analítica, y ahora la versión sucia viaja entera y
con su sello. Distinguir dos builds sucios *entre sí* ya funciona; explicar en
qué se diferencian no es trabajo de una cadena de versión.

### B-37 · `/events.json` va a necesitar su propia cabecera de cache — ✅ hecho (2026-08-27)

**Hecho** con B-106: `no-cache` en `firebase.json`. Se eligió eso y no un
`max-age` corto porque el archivo **no lleva hash en el nombre** y cambia en cada
rebuild: un `max-age` deja el índice más viejo que el HTML que lo acompaña, y el
síntoma es un listado que muestra una actividad que la página de detalle ya no
tiene (o al revés). `no-cache` no significa «no cachear»: significa revalidar, así
que el CDN sigue sirviendo el archivo y solo paga un `304`.


Las cabeceras de `firebase.json` cubren el HTML, `/version.json` y
`dist/_astro/*`. El `events.json` del sitio público (B-01) todavía no existe:
cuando exista hay que decidir su cache — no lleva hash en el nombre y cambia en
cada rebuild, así que probablemente `no-cache` o un `max-age` corto.

### B-55 · Instrumentar el pegado de coordenadas de la sede

El vocabulario ya está: `funcion_usada` acepta `coordenadas-pegar` y
`coordenadas-fallo`, con `detalle` en `coord-link-corto`,
`coord-sin-coordenadas`, `coord-coma-decimal` y `coord-formato`
([`09-analitica.md`](09-analitica.md)). Falta **una línea por rama** en
`src/components/admin/CoordenadasSede.tsx`, que se mergeó después de escribir la
instrumentación.

Vale la pena porque decide el arreglo: si el 80% de los fallos es un link corto,
lo que hay que hacer es resolverlos, no explicar mejor el campo.

### B-56 · Enchufar `registrarVersion(VERSION_APP)` — ✅ hecho

Lo enchufó el merge del 2026-08-21: `src/components/admin/AdminApp.tsx` llama
`registrarVersion(VERSION_APP)` en el efecto de montaje, **antes** de
`medirPanelAbierto()`, así que el primer evento ya viaja con `version`.

Verificado al cerrar B-88, que es lo que esto destapó: hasta ese arreglo el
parámetro llegaba, pero como `otro` en cualquier build sucio. Lo único que queda
es confirmarlo en GA4 (DebugView), que es un paso de consola del dueño.

**B-92 y B-118 son la misma observación sobre esta entrada, duplicada**: las dos
decían que B-56 estaba desactualizado. Quedan cerradas con esto.

---

### B-62 · Ayuda contextual por sección del formulario

La guía (B-60) se abre desde el encabezado y muestra desplegado el capítulo de
la pantalla en la que estás, pero no hay un "?" al lado del título de cada
sección del formulario, que es donde más apuntaría: la duda aparece mirando
"Difusión", no pensando en abrir la ayuda.

El mecanismo ya está: cada capítulo declara a qué sección del formulario
corresponde (`seccionFormulario` en `src/lib/ayuda.ts`), así que falta un botón
en `Seccion` y pasarle el id en las nueve secciones. No se hizo de entrada para
no tocar `ActividadFormulario.tsx` en nueve lugares mientras varias manos lo
estaban editando (D-61).

**Actualizado el 2026-08-26, con un caso real y una forma más precisa.** Un
segundo admin cargando una feria no entendió el generador de encuentros, y lo
dijo así:

> Y no entiendo porque hay 2 opciones : cuándo pongo N de encuentros. Lo de
> cantidad y cantidad de días. Lo estoy probando en una feria que generalmente
> son encuentros en varios días en mismos horarios... Tengo que crear los N de
> encuentro por cada día no?

Dos cosas que eso agrega al ítem:

1. **La forma que pidió el dueño no es abrir el capítulo de la guía, son tres
   partes:** qué hace la sección, **qué impacto tiene** —o sea qué sale al sitio
   y al calendario, que es lo que no se adivina— y **un ejemplo**. Es más que un
   `?` que scrollea a la ayuda: los capítulos de `ayuda.ts` hoy no están escritos
   con esa estructura, así que el ítem incluye reescribirlos o agregar un campo.
2. **El ejemplo es la parte que resuelve el caso**, y se nota en este reporte: la
   duda no era qué es un encuentro, era cómo se cargan tres jornadas de una feria.
   Un ejemplo por sección («una feria de tres días: Cantidad 3, Cada (días) 1»)
   contesta eso; una definición, no.

El disparador puntual —los dos campos del generador se leen como «cantidad» y
«cantidad de días»— es más barato que este ítem y va aparte, en **B-204**: si se
arregla la etiqueta, este caso concreto no vuelve a pasar aunque el modal no
exista todavía.

### B-63 · Nada verifica que la guía siga diciendo la verdad — ✅ hecho (2026-08-26)

`tests/ayuda.test.ts` verifica que **exista** un capítulo por sección del
formulario, que los seis avisos irreversibles estén y que el texto no tenga
jerga. Lo que ningún test puede ver es que el texto siga siendo **cierto**: si
mañana cancelar un encuentro deja de borrar el evento, la guía va a seguir
diciendo que lo borra y nada va a fallar.

Hoy eso lo sostiene la regla de proceso de [`05-patrones.md`](05-patrones.md).
Opciones si alcanza para más: repasar la guía cada vez que se toca el sync o el
formulario (barato, se olvida), o atar cada aviso a un test de comportamiento
existente y nombrarlo en el aviso, para que borrar el test rompa el vínculo.

**Una ayuda que miente es peor que no tener ayuda**, así que si la lista de
avisos crece, este ítem sube de prioridad.

**Cómo quedó (2026-08-26).** Se tomó la segunda salida: cada aviso ata en `atadoA`
los `it` de comportamiento que fijan lo que afirma. **27 vínculos**, y el chequeo no
es la cita — abre cada archivo y exige que el `it` exista con ese nombre exacto y
**escrito como llamada**, que entre en la corrida de `npm test` (los
`*.integracion.test.ts` quedan excluidos: se saltean solos sin emuladores) y que no
esté apagado ni invertido **ni lo apague ninguno de sus `describe`**.

**El aserto lee el fuente con un walker y no con un `grep`**, porque las cuatro formas
de que un chequeo así crea haber encontrado algo ya pasaron todas en este repo esta
semana: el nombre suelto lo satisface el `import`; con los comentarios adentro lo
satisface la prosa; una comilla suelta dentro de un literal de regex desincroniza al
lector y le hace tragarse el `it` siguiente; y mirar el `it` sin su `describe` deja
pasar un `describe.skip`. Las cuatro verificadas rompiéndolas.

**Y encontró una mentira, que vale más que el mecanismo.** El capítulo «Encuentros»
decía que «Generar N encuentros» **borra los temas y las lecturas**: era cierto hasta
**B-176**, del mismo día, que le puso red al cartel de `SesionesEditor.tsx` **y no a la
guía** — que decía la misma mentira y en la misma dirección cara: nadie aprieta el
botón por miedo a perder algo que ya no se pierde. El capítulo de al lado ya decía lo
contrario, o sea que la guía **se contradecía a sí misma**.

**El agujero se redujo, no se cerró, y se sabe cuánto queda:** que el `it` atado
afirme *lo del aviso* (que afirme algo lo sostiene el propio test; el resto es
review); las frases sin `it` —«si destildás la cancelación, el evento vuelve» no tiene
test de des-cancelar, y de «nada lee de vuelta del calendario» solo se pudo atar la
mitad que existe—; y los puntos de capítulo, donde `atadoA` es opcional. La extensión
natural, si el mecanismo prueba que sirve, es obligarlo en los puntos con
`cuidado: true`.

### B-95 · El texto para publicar en redes — ✅ hecho (2026-08-26)

`difusion.arrobar` es el único campo del §3.1 que se carga y **no se usa para
nada**: se guarda y ahí muere. Mientras tanto, cada actividad se vuelve a
escribir a mano en Instagram, con la hora y el arancel copiados de mirar el panel
en otra pestaña.

Una sección colapsada del formulario, del mismo tipo que la vista previa del
evento, con el texto listo para pegar y un botón de copiar: título, fechas,
modalidad y barrio, arancel con notas, cómo se inscribe, y al final los handles
de `arrobar` + `organizador.instagram` + `tallerista.instagram`, deduplicados.
Dos variantes: "anuncio" (el ciclo entero) y "recordatorio" (el próximo
encuentro, con su tema y su lectura).

**No toca el modelo, ni las reglas, ni las Functions, ni el sitio:** una función
pura (`src/lib/textoRedes.ts`) y un componente. El link de la reunión no va nunca
(§5.1); `arrobar` sí, que es su lugar.

Decisión del dueño: si el texto lleva el link a la página de la actividad
—hoy no existe—. Conviene decidirlo antes para no cambiar el formato después.
Razonamiento y contra en [`11-ideas-de-producto.md`](11-ideas-de-producto.md).

### B-96 · "Esta semana" arriba del listado — ✅ hecho (2026-08-24)

El listado está ordenado por última modificación, así que arriba está lo que
tocaste, no lo que se viene. Con dos personas cargando, nadie tiene el panorama:
el club de lectura es mañana y la lectura no se cargó, o la inscripción cierra
hoy y la actividad sigue en borrador.

Un bloque chico arriba del listado con tres cosas: encuentros de los próximos 7
días, inscripciones que cierran en los próximos 3, y **borradores cuyo primer
encuentro es en menos de una semana** —el olvido caro, porque después de la fecha
no tiene arreglo—.

El listado ya trae todas las actividades a memoria (`listarActividades`): es una
función pura sobre lo que ya está cargado, cero lecturas nuevas. **Que no se
dibuje cuando no tiene nada que decir**, así que estar visible ya es
información.

### B-97 · `inscripcion.completo` — poder decir que se llenó — ✅ hecho (2026-08-26)

Después de publicar no hay forma de decir nada. El taller se llenó, la gente
sigue mandando DM, y el sitio y el calendario siguen mostrando "cupo: 12" porque
`inscripcion.cupo` se carga una vez y no se vuelve a mirar.

Un booleano `inscripcion.completo` (**campo nuevo en `inscripcion` del §3.1**),
que se prende **desde el menú "⋯" del listado**, no desde el formulario: un toque
desde el teléfono, sin abrir 30+ campos. De ahí sale el cartel en el sitio (con
B-01), y la línea en la descripción del evento — así **quien ya estaba suscripto
al calendario se entera sin que nadie le avise**.

Toca: `types/actividad.ts`, `schema.ts`, `actividades.ts`, `toPublic.ts`,
`construirDescripcion` de `functions/calendario.js`, el menú del listado, y el
sitio cuando exista. Una línea o dos en cada uno.

**Ojo:** cambiar la descripción actualiza los N eventos del ciclo. Es lo
correcto y la guarda del §7.1 lo maneja (D-07), pero verlo en emuladores antes de
creerlo.

Conviene antes de B-01 para que el `events.json` nazca con el campo.

**Decidido el 2026-08-26, las dos:**

1. **Un booleano**, no un contador. Un contador de lugares queda viejo con **cada**
   inscripción y no solo con la última, y un número viejo es peor que ningún número
   porque parece información fresca. El booleano se prende cuando no entra nadie más
   y se apaga si se libera un lugar. Es además la salida que **B-102** ya nombra para
   resolver el conteo sin guardar un dato de nadie.
2. **El botón de inscripción se queda**, con el cartel «Cupo completo» al lado.
   Siempre hay lista de espera, y las bajas existen: esconder el canal convierte una
   baja en un lugar que se pierde. Para el organizador, un DM de más cuesta menos que
   un lugar vacío.

**Cómo quedó (2026-08-26, D-127).** Las dos decisiones implementadas tal cual, con
test en las dos salidas públicas. Se prende desde el menú «⋯» con ruta punteada, así
que un toque desde el teléfono no puede pisar el destino ni el cierre — verificado
contra el emulador. Propaga a los N eventos del ciclo porque la línea se arma adentro
de `construirDescripcion`: ocho `actualizar`, cero `borrar`, que es el riesgo que este
ítem pedía mirar de verdad y no asumir.

**Lo que la auditoría encontró y es lo que más valió del cambio: el campo tenía dos
dueños.** `completo` lo prende el listado, pero `formADocumento` reemplazaba el objeto
`inscripcion` entero, así que un formulario abierto desde antes de marcarlo **apagaba
el cartel** del sitio y de los N eventos en su próximo guardado. Y el borrador local
—que vive 30 días— hacía lo mismo o lo contrario. Es el perfil de `calendarEventId`
dentro de `sesiones`, o sea la clase de B-80, y se cerró por los dos lados: al guardar,
`inscripcion` va **por subcampos punteados** con `completo` afuera
(`payloadDeActualizacion`, función pura y testeable sin emuladores); al recuperar, el
campo entró a la lista de **D-124** — que con esto se quedó corta por **tercera** vez, y
las tres con el mismo perfil.

**Y una lección sobre la red:** las dos roturas del dueño único al principio **no
caían**. La lista de D-124 vive en un solo lugar a propósito, pero eso no alcanza —
cada entrada necesita su propio clavo, y las cuatro que tiene ahora lo tienen.

### B-98 · Cancelar un encuentro sin que desaparezca en silencio — ✅ aprobado (2026-08-26), pendiente de implementar

**Contradice el §7.3 del `CLAUDE.md` y la guía del panel**, y por eso necesitaba
decisión del dueño. **La dio el 2026-08-26: sí, y con el motivo de cancelación
incluido.**

Así que el §7.3 cambia, y eso hay que escribirlo como desvío explícito en
`docs/06-decisiones.md` cuando se implemente: el `CLAUDE.md` es la decisión cerrada
y no se edita desde acá, pero el desvío se anota con su motivo, como ya se hizo con
D-15.

**Y hay dos textos que van a quedar mintiendo el día que esto entre**, los dos hay
que corregir en el mismo cambio:

1. El aviso `cancelar-encuentro` de `src/lib/ayuda.ts` — que desde B-63 se llama
   «Cancelar un encuentro saca su evento del calendario y conserva el encuentro acá»
   y **dice la verdad hoy**. Con B-98 pasa a ser al revés. **Y no hace falta
   acordarse:** ese aviso está atado por `atadoA` a los `it` que fijan el
   comportamiento actual, así que implementar B-98 **pone el test de la guía en
   rojo** y obliga a reescribir el aviso en el mismo commit — que es literalmente lo
   que este ítem pedía.
2. El §7.3 del `CLAUDE.md`, que es la fuente.

**Por qué no entró a la tanda del 2026-08-26:** necesita `SesionesEditor.tsx` para el
campo del motivo (que otro frente estaba tocando) y cambia lo que sale al evento, así
que el barrido de centinelas de B-196 tiene que conocerlo. Va después de esos dos.

Hoy `sesion.cancelada === true` **borra** el evento. Quien tenía ese jueves
agendado, con su recordatorio, ve el evento desaparecer sin ningún aviso. Es
justo el momento en que un calendario público vale más —es la única vez que el
dato cambió *después* de que la gente lo guardó— y el sistema elige no decirlo. Y
no hay dónde escribir por qué: "se pasa al jueves que viene" y "se cancela por
falta de inscriptos" se ven igual, como un hueco.

Propuesta: `sesion.motivoCancelacion: string | null`, y que un encuentro
cancelado **actualice** su evento en vez de borrarlo (`CANCELADO — ` en el título,
el motivo arriba de la descripción). Lo que no cambia: pasar la actividad a
borrador/pendiente/cancelada sigue borrando todo, y **borrar** el encuentro sigue
borrando su evento. La distinción es esa: cancelar es un anuncio, borrar es una
corrección.

Más barato de lo que parece: todo vive en `debeExistir` y `construirEvento`, dos
funciones puras ya exportadas y con tests, y la vista previa del panel las
importa (D-20), así que el panel lo muestra sin una línea de UI.

**No es solo código:** el aviso `cancelar-encuentro` de `src/lib/ayuda.ts` pasa a
mentir, y es uno de los seis avisos de lo que no se puede deshacer. Es
exactamente el escenario de **B-63** — se actualiza en el mismo commit o no se
hace.

Va después de B-01 (toca la parte más frágil, §7 y §10 avisan), pero **decidirlo
antes**: si el sitio nace sabiendo que una sesión cancelada tiene motivo, la
página de detalle lo muestra de entrada.

Segunda decisión, menor: si un evento cancelado se borra cuando su fecha ya pasó
o queda como registro (recomendado: queda).

### B-99 · El `events.json` necesita un eje de encuentros, no solo de actividades

Parte de **B-01**, anotado para que no se pierda al escribir el generador.

El modelo es centrado en la actividad y está bien (§2.2): un club de 8 encuentros
es una tarjeta. Pero la pregunta que se le hace a una agenda es "¿qué hay el
sábado?", que es centrada en el encuentro — y con tarjetas por actividad hay que
abrir todas para saberlo.

No hace falta cambiar el modelo: que el `events.json` lleve **también** un índice
plano de encuentros próximos (fecha, id de sesión, slug), derivado en build time,
para que la island ofrezca "este fin de semana" sin aplanar los ciclos en el
navegador en cada filtrado. Es barato al escribir el generador y caro después.

### B-70 · Sacar la lógica de dominio de `ActividadFormulario.tsx` — ✅ hecho (2026-08-24)

El archivo tiene 858 LOC, de las cuales **227 son lógica** y el resto JSX. Esas
227 incluyen reglas del modelo que ningún test puede ejecutar, porque están en un
`.tsx` y no hay testing-library (B-08):

| Bloque | Líneas | Qué codifica |
|---|---|---|
| `formVacio()` | 49-69 | el documento por defecto del §3.1 |
| `cambiarTipo` | 144-156 | "club de lectura ⇒ es ciclo y tiene material" (§2.2, §11) |
| `cambiarModalidad` | 158-176 | "virtual ⇒ `sede = null`", "presencial ⇒ `online = null`" |
| `labelsPendientes` | 188-198 | buffer de etiquetas sin persistir (D-02) |
| `guardar()` | 200-256 | el caso de uso completo de guardado |

Si un cambio futuro invierte uno de esos condicionales, `npm test` pasa entero.

Extraer las cascadas y `formVacio` a un módulo puro (~90 LOC) se testea como
`tests/duplicar.test.ts`, sin emuladores. `guardar()` a un módulo de caso de uso
(~60 LOC) se testea como `tests/actividades.integracion.test.ts`. Es refactor
mecánico, sin cambio de comportamiento: el archivo baja a ~250 LOC y ~150 pasan a
ser testeables. Medida completa en
[`10-salud-del-codigo.md`](10-salud-del-codigo.md).

**Hecho.** Quedaron cinco módulos en `src/lib/formulario/`: `estadoInicial.ts`
(`formVacio` y los sub-objetos que crean y destruyen las cascadas),
`cascadas.ts` (las tres del §11), `condicionales.ts` (qué partes del formulario
aplican, que además tienen que coincidir con lo que el schema exige),
`etiquetas.ts` (el buffer de D-02) y `guardar.ts` (el caso de uso, con las
escrituras como puertos — D-102). Los cubre
[`tests/formulario-dominio.test.ts`](../tests/formulario-dominio.test.ts).

Con la lógica afuera y el JSX partido (B-79), `ActividadFormulario.tsx` quedó en
~230 LOC. Dos bugs que vivían en esa lógica salieron en el mismo cambio: **B-71**
y **B-87**.

### B-71 · Un guardado que falla deja opciones de taxonomía huérfanas — ✅ hecho (2026-08-24)

`guardar()` persiste las etiquetas nuevas en `/opciones/*` (líneas 237 y 240)
**antes** de escribir la actividad (líneas 244-245). Si la escritura falla —red,
permisos, slug que se tomó entre el chequeo y el write— las opciones ya se
crearon y quedan colgadas en el desplegable.

Es una versión parcial de lo que D-02 quiso evitar ("abandonar el formulario no
debería dejar basura en la taxonomía"), y hoy no hay nada que lo note: ningún
test lo cubre y no hay UI para limpiar taxonomías (B-06). Se limpia a mano con
`npm run opciones:aprobar` mirando la lista, o no se limpia.

Arreglo: invertir el orden —escribir la actividad primero y las opciones
después— o mover las dos cosas a la misma transacción. Lo primero es más simple
y deja el caso peor en "la etiqueta no se registró para la próxima vez", que es
recuperable tipeándola otra vez. Sale con B-70, cuando `guardar()` deje de estar
dentro del componente.

### B-72 · La deduplicación §4.2 del cliente está implementada dos veces — ✅ hecho (2026-08-24)

**Arreglado** como decía el ítem: `src/lib/taxonomia.ts`, puro, con
`sugerenciasPara`, `resolverEtiqueta`, `pistaDeOpcion` y `etiquetaConEstado`, y
los dos componentes llamándolas (D-100). 27 tests en `tests/taxonomia.test.ts`,
incluida una guardia de que la copia no vuelva a nacer. Los componentes no se
unificaron, y las dos diferencias que quedan (tope y qué mostrar con el input
vacío) son ahora parámetros con motivo escrito.

**Resuelto así (D-100):** se invirtió el orden, en
`src/lib/formulario/guardar.ts` — el caso de uso que B-70 sacó del componente.
Verificado el modo de falla que queda: el evento público resuelve la etiqueta no
registrada con el des-slug de D-11, o sea "Con Beca Parcial" en lugar de "Con
beca parcial". Un fallo al registrar la etiqueta ya no vuelve fallido el
guardado (la actividad está escrita; reintentar chocaría contra su propio slug).
El `it.fails` de la clase en `tests/clases-de-bug.test.ts` quedó promovido a
`it`, y el orden se afirma además con puertos falsos en
`tests/formulario-dominio.test.ts`. Queda abierto **B-177** (nadie avisa en
pantalla que la etiqueta no se registró); **B-132** (el desplegable mostraba el
slug crudo de una etiqueta no registrada) está ✅ hecho (2026-08-25).

> **Renumeración:** este párrafo decía «B-167» y «B-168». Los dos números se
> reasignaron después —`B-167` es la galería de imágenes (DEC-7)— y las citas
> quedaron apuntando al ítem equivocado hasta el 2026-08-27. Corregido a B-177 y
> B-132.

### B-73 · Los tags no se miden — ✅ hecho (2026-08-24)

**Arreglado:** `TagsInput` emite `taxonomia-nueva`, `taxonomia-reusada` y
`taxonomia-sugerencia` con `detalle: 'tags'`. `taxonomia-otro` **no** se emite y
no es un olvido: no hay modo "Otro" que abrir en un input de chips (D-105, y
queda escrito en `09-analitica.md` para que su ausencia no se lea como un bug).


`CAMPOS_TAXONOMIA_MEDIBLES` (`src/lib/analytics-eventos.ts:134`) declara `'tags'`
como valor válido de `detalle` para `taxonomia-otro`, `taxonomia-nueva`,
`taxonomia-reusada` y `taxonomia-sugerencia`. Pero `TagsInput.tsx` **no llama a
`medirFuncion` en ningún lado**: ese valor no puede aparecer en GA4.

O sea que el campo de taxonomía con más volumen esperado es el único invisible en
la analítica de taxonomías, y el vocabulario declara algo que el código no puede
producir. Cuatro llamadas a `medirFuncion`, en los mismos puntos donde
`TaxonomiaSelect` ya las tiene (líneas 104, 182, 208). Sale gratis junto con
B-72, que es cuando esos puntos quedan compartidos.

Distinto de B-58: eso es "dos interacciones sin medir por no tocar el JSX", esto
es un campo entero.

### B-74 · `crearIssue` no tiene timeout y puede colgar el trigger de reportes — ✅ hecho (2026-08-24)

**Arreglado:** las dos llamadas a GitHub abortan a los 15 s, y
`tests/reportes.test.ts` lo verifica en los dos archivos a la vez para que no se
pueda volver a perder en una copia.

`functions/index.js:230` define `TIMEOUT_DISPATCH_MS` con el comentario "Sin esto
un socket colgado se come el tick entero", y lo usa con `AbortSignal.timeout` en
`dispararDispatch`.

`functions/reportes-trigger.js` copió las cinco cabeceras de esa llamada
(líneas 66-71 ≡ `index.js:242-247`) **pero no el timeout**: no tiene ningún
`AbortSignal`. Un socket colgado contra la API de GitHub deja la invocación
corriendo hasta el timeout de la plataforma.

Son dos líneas. Y es el ejemplo de por qué B-77 vale: el conocimiento estaba
escrito, en una sola de las dos copias.

### B-75 · Tres enums del modelo están copiados en `analytics-eventos.ts` sin guardia — ✅ hecho (2026-08-24)

`ESTADOS_DESTINO`, `MODALIDADES_MEDIBLES` y `CAMPOS_TAXONOMIA_MEDIBLES` eran
copias literales de `ESTADOS`, `MODALIDADES` y `CAMPOS_TAXONOMIA` de
`src/types/actividad.ts`. Sin guardia, un quinto `estado` o un sexto campo con
taxonomía se reportaba como `'otro'` en silencio.

Ahora son **el mismo objeto**, y la guardia es la identidad: el test compara
referencias (`toBe`), así que volver a escribir la lista al lado del import falla
aunque los valores coincidan ese día. Un segundo test verifica que cada valor del
modelo llegue entero al payload, no solo al vocabulario.

**Verificado con el build**, que era la duda: `@/types/actividad` tiene fan-out 0,
así que zod (53.015 B, chunk `types.*`) sigue fuera de la carga inicial y sin
moverse. La carga inicial de `/admin` pasó de **386.088 a 386.291 bytes** (+203 B,
+0,05 %; gzip 107.490 → 107.597, +107 B), los mismos 4 chunks y ningún
`modulepreload` nuevo. La suma de **todos** los chunks bajó 101 bytes: los arrays
de literales dejaron de estar duplicados en el chunk de `duplicar`.

Ver [CHANGELOG](CHANGELOG.md) y **D-98**.

### B-76 · El listado muestra el estado en slug crudo — ✅ hecho (2026-08-24)

`ListaActividades.tsx:124` renderiza `{a.estado}`, así que la píldora dice
"borrador" y "publicado" en minúscula, mientras el formulario dice "Borrador" y
"Publicado" (`ETIQUETA_ESTADO`). Es la misma actividad en dos pantallas con dos
escrituras.

Pasa porque el vocabulario de etiquetas es local al formulario. Un
`src/lib/etiquetas.ts` de ~20 LOC con los tres mapas (`estado`, `modalidad`,
`via`) que usen el formulario y el listado lo cierra.

**Dónde están hoy:** B-79 los sacó del `.tsx` a
`src/components/admin/formulario/etiquetasUI.ts`, porque los comparten varias
secciones. Son esos tres los que hay que mudar a `src/lib/etiquetas.ts`; la
mudanza toca los archivos del formulario, así que conviene hacerla desde este
frente y no desde el del listado.

**No incluir los mapas `ETIQUETA_*` de `functions/calendario.js`**: esos son
prosa para el evento público ("Presencial y virtual", "por DM de Instagram"), no
etiquetas de UI. Unificarlos haría que un cambio de copy del panel cambie lo que
se publica en el calendario.


**Cómo quedó.** La píldora del listado usa `ETIQUETA_ESTADO`, que vive en
`src/lib/filtrosActividades.ts` desde la vista calendario: el síntoma —la misma
actividad escrita de dos maneras en dos pantallas— está cerrado, y
`tests/etiquetas-de-ui.test.ts` lo fija.

Lo que **no** se hizo: el `src/lib/etiquetas.ts` que propone el ítem. Los mapas
del formulario (`ETIQUETA_ESTADO`, `ETIQUETA_MODALIDAD`, `ETIQUETA_VIA`) siguen
siendo locales, así que la clase está viva y ya divergió una vez —"Híbrido"
contra "Presencial y virtual"—. Unificarlos toca `ActividadFormulario.tsx`, que
es de la fase 2: queda en **B-175**, con el `it.fails` que lo espera (decía
«B-167» hasta el 2026-08-27, número que después se reasignó a la galería).

### B-84 · Cancelar un encuentro de un ciclo renumera y reescribe los otros siete — ✅ hecho (2026-08-24)

`posicionEnCiclo` numera sobre las sesiones **no canceladas**, así que cancelar
el tercero de ocho convierte al sexto en "Encuentro 5 de 7" en el calendario
público. Dos costos:

- **Renumera.** Quien ya tenía "Encuentro 6 de 8" agendado ve cómo se le
  renombra el evento, y el número deja de coincidir con la lectura asignada de
  esa fila del formulario.
- **Siete escrituras de más.** El §7.2 existe para reflejar los cambios sin
  tocar lo que no cambió, y una cancelación toca ocho eventos.

`calendario.test.ts` tiene "cancelar un encuentro borra solo el suyo" y pasa: su
fixture no es un ciclo. En un ciclo —el caso del §2.2, que es el motivo de que
las sesiones sean un array— el invariante no vale.

Lo que hay que decidir es qué significa el número. Lo más barato y lo que menos
sorprende: numerar sobre **todas** las sesiones (el sexto sigue siendo el sexto,
y el total sigue siendo ocho), y que el cancelado simplemente no tenga evento.

Test en [`tests/costuras.test.ts`](../tests/costuras.test.ts), con lo que hace
hoy escrito al lado para que el cambio se note.

### B-85 · El debounce del rebuild se come el cambio que llega mientras dispara — ✅ hecho (2026-08-24)

**Arreglado** con la primera de las dos opciones de abajo: `registrarExito`
compara la marca `actualizado` que el tick leyó contra la que hay al escribir, y
la escritura va en transacción (así la comparación no tiene su propia ventana).
Si la marca cambió, `pendiente` queda en `true` y el próximo tick dispara otro
build; los reintentos igual se resetean, porque el disparo salió bien.

**Resuelto así** (D-95): se numera sobre **todas** las sesiones, canceladas
incluidas. El número es la identidad del encuentro dentro del ciclo —qué lectura
le toca, qué fila del formulario es—, no un recuento en vivo de los que siguen en
pie; y es el criterio que el panel ya usaba para el "2 de 8" de la vista
calendario (D-70), que hasta ahora decía "6 de 8" mientras el evento público
decía "5 de 7". Cancelar toca ahora **un solo** evento. El total sigue diciendo
ocho y en la serie queda un hueco: es cómo un suscripto ve que ese día se
canceló.

El test de `calendario.test.ts` que pasaba con el invariante roto —"cancelar un
encuentro borra solo el suyo"— corre ahora sobre un ciclo de verdad, y hay un
test en `costuras.test.ts` que **ata** la numeración del panel con la del evento
publicado. Quedan abiertos **B-160** (el residual: agregar o borrar una fila sí
renumera, por diseño) y **B-161** (los fixtures que siguen sin ser un ciclo).

### B-86 · `usos` solo cuenta creaciones, así que el orden por frecuencia no funciona · parcial

**La operación está hecha (2026-08-24), el cableado no.** `registrarUsos(campo,
slugs)` en `src/lib/opciones.ts`: una transacción por campo, ignora los slugs que
no existen y no cuenta dos veces el mismo slug (D-103).

Llamarla es una línea en `guardar()`, que vive en `ActividadFormulario.tsx` —de
otro frente del plan de saneamiento—, así que quedó anotado como **B-168** con el
orden exacto para no contar doble.


El §4.3 le da dos trabajos a `usos`: ordenar el desplegable por frecuencia real
—"mejor que alfabético"— y detectar basura ("una opción con `usos: 1` creada
hace meses es casi seguro un typo colgado").

`upsertOpcion` sabe sumar el uso de una opción existente, pero el submit del
formulario solo lo llama para las etiquetas tipeadas en "Otro" (`labelsNuevos`,
`tagsNuevos`). Elegir una opción del desplegable no registra nada. Resultado:
todas las opciones creadas se quedan clavadas en `usos: 1` para siempre y las
base en `0`, así que `ordenarValores` ordena por etiqueta y la señal de basura no
distingue el typo del barrio que se usa todas las semanas.

Es una línea en `guardar()` —registrar el uso de los slugs elegidos, no solo de
los nuevos— más cuidado con no sumar dos veces cuando la etiqueta es nueva
(`upsertOpcion` ya la crea con `usos: 1`). Sin test: el camino pasa por el
submit del componente y no hay testing-library (B-08).

### B-87 · El formulario nace sucio, así que el aviso de versión nunca se recarga solo — ✅ hecho (2026-08-24)

`autoSeleccionarPrimera` en el desplegable de `tipo` preselecciona "Taller" desde
un efecto, y ese efecto es de un hijo: corre **antes** que los efectos de
`ActividadFormulario`. Los dos consumidores del estado inicial del formulario
toman su huella en el efecto del padre, o sea antes de ver la preselección:

- `useFormularioSucio` deja `sucio = true` en cuanto React procesa el `setForm`
  del hijo. Abrir "Nueva actividad" y no tocar nada ya cuenta como trabajo sin
  guardar: el aviso de versión nueva no se auto-recarga nunca y muestra el
  cartel "Guardá lo que estás cargando y después recargá: si recargás ahora, se
  pierde" sobre un formulario vacío.
- `useMedicionFormulario` compara la misma huella al cerrar, así que el
  parámetro `sucio` de `formulario_abandonado` es **siempre 1** y deja de
  responder la pregunta que documenta [`09-analitica.md`](09-analitica.md)
  ("¿había trabajo adentro, o se abrió el formulario y se salió?").

El arreglo es que la preselección no cuente como cambio: aplicarla al armar el
estado inicial (`formVacio()` con el primer valor de la taxonomía, que se conoce
desde `OPCIONES_BASE`) en lugar de con un efecto sobre el formulario ya montado.

**Sin test, y por eso está acá y no en P0/P1:** el mecanismo se leyó en el
código y el orden de los efectos es una garantía de React, pero verificarlo
necesita render, y no hay testing-library (B-08). Es la primera cosa que valdría
la pena verificar si se instala.

**Resuelto así (D-101):** la preselección se aplica en `formVacio()`
(`src/lib/formulario/estadoInicial.ts`) y el campo `tipo` dejó de pasar
`autoSeleccionarPrimera`. `plataforma` lo conserva: su bloque nace de un cambio
de modalidad, o sea de una acción de quien carga.

Sigue sin haber un test de render, pero la clase quedó cubierta desde dos
lados en `tests/formulario-dominio.test.ts`: uno afirma que `formVacio().tipo`
es la misma opción que mostraría el desplegable, y otro —de fuente— que ningún
campo que exista desde el montaje delegue su preselección a un efecto. Lo que
falta verificar con render es el síntoma (que el aviso de versión se
auto-recargue), no el mecanismo.

### B-90 · "Generar N encuentros" sobre un ciclo publicado borra y recrea los ocho eventos — ✅ hecho (2026-08-24)

El generador del §11 reemplaza la lista de sesiones, y `generarSesiones` da ids
nuevos. Sobre un ciclo ya publicado el diff no reconoce ningún encuentro: ocho
`borrar` y ocho `crear`. Es exactamente lo que el §7.2 dice que no hay que hacer
—"eso perdería los recordatorios y las suscripciones de la gente"— y el cartel
del formulario avisa "Reemplaza la lista actual", que no se lee como "reemplaza
también el calendario".

Salidas: reusar el id de la fila que ocupa la misma posición cuando la cantidad
no cambia, o al menos avisar en el cartel cuando alguna sesión ya tiene
`calendarEventId` ("esto borra N eventos del calendario y crea otros N").

Test en [`tests/costuras.test.ts`](../tests/costuras.test.ts).

**Resuelto así (D-103):** se reusa el id **y** el `calendarEventId` de la fila
de la misma posición, y no solo cuando la cantidad coincide: generar diez sobre
ocho son ocho actualizaciones y dos altas; seis sobre ocho, seis y dos bajas.
Correr un ciclo publicado una semana pasó de 8 `borrar` + 8 `crear` a 8
`actualizar`. El cartel dice ahora qué recalcula y qué borra, y aclara —solo
cuando hay encuentros ya publicados— que se mueven en lugar de recrearse. Los
tests corren el generador contra el `planificar` de verdad, porque lo que estaba
roto era el par. Queda abierto **B-169**.


### B-125 · Un evento borrado a mano en Calendar no se detecta · P2

La vista calendario compara el `calendarEventId` guardado contra lo que
**debería** existir, no contra lo que Google Calendar tiene de verdad. Si alguien
borra un evento a mano desde Calendar, el panel sigue diciendo "En el
calendario". Es coherente con el §2.1 —el calendario es un espejo y editarlo a
mano no es un caso soportado— pero la vista promete estado de publicación y en
ese caso miente.

Cerrarlo pide leer la API de Calendar desde el panel, que hoy no tiene forma de
autenticarse contra ella (la identidad es de la Function, D-06).

### B-126 · La vista calendario no avisa de inscripciones que cierran — ✅ hecho (2026-08-26)

`inscripcion.cierra` no aparece en ninguna parte del calendario, y es una fecha
con la misma urgencia que un encuentro: pasada, la actividad sigue publicada
invitando a anotarse. Encaja natural como un marcador más en el día que
corresponde, con otro color.

### B-127 · `useLabelsTaxonomia` abre cinco suscripciones en la primera pantalla — ✅ parcial (2026-08-26): 10→5, falta 5→1

El hook abre un `observarOpciones` por campo (arancel, tipo, barrio, plataforma,
tags) y el listado —la primera pantalla del panel autenticado— solo usa dos.
Su propio docstring advierte que conviene montarlo "recién cuando hace falta".
No rompe nada y `OPCIONES_BASE` cubre el primer render, pero son cinco listeners
abiertos toda la sesión donde antes había cero.

### B-128 · `mesesConEncuentros` depende de recibir la lista ya ordenada — ✅ hecho (2026-08-26)

`mesesConEncuentros` promete devolver los meses "del más viejo al más nuevo" y no
ordena: se apoya en que `encuentrosDe` ya ordenó por inicio. Hoy todos los
caminos del componente pasan por ahí, así que funciona. El día que alguien
alimente `mesInicial` con una lista armada de otra forma, la vista abre en un mes
arbitrario y nadie lo nota. Un `.sort()` lo cierra.

### B-160 · Agregar o borrar una fila de un ciclo publicado reescribe los otros N · P3

Residual de B-84, y por diseño (D-95): el número del evento es "Encuentro 3 de
8", así que cambiar el largo del ciclo hace falso el "de 8" de todos los demás y
el diff los actualiza. Son `actualizar`, nunca `borrar`+`crear`: los
recordatorios y las suscripciones sobreviven, pero el texto de los otros siete
eventos cambia por agregar un noveno encuentro.

A diferencia de la cancelación, acá el conjunto de encuentros cambió de verdad y
el número nuevo es el correcto, así que no está claro que haya algo que arreglar.
Si molesta en la práctica, la salida es **sacar el total** de la descripción
("Encuentro 3", sin "de 8"): agregar al final dejaría de tocar a nadie y el total
—que es el dato volátil— ya está en la descripción de la actividad. Se decide
con uso real, no antes.

Ojo con el orden: si la fila nueva se intercala **antes** de encuentros que ya
existen, esos sí cambian de número con cualquier variante. Eso es correcto.

### B-162 · Los ciclos ya publicados con un encuentro cancelado se quedan con el número viejo · P3

Consecuencia de D-95 en lo que ya está en el calendario. La guarda del §7.1
compara el payload de antes contra el de después **calculando los dos con el
código nuevo** (D-07), así que un ciclo que hoy tenga un encuentro cancelado no
genera ninguna operación al volver a guardarlo: los siete eventos siguen
diciendo "de 7" en el calendario de quien los tenga agendados, mientras el panel
y la vista previa muestran "de 8". La divergencia solo se ve desde afuera.

Se corrige sola en cuanto un cambio que **sí** salga al evento —título,
descripción, sede, tema, lectura— reescriba esos eventos. Para forzarlo hoy hay
que editar algo de eso a mano en las actividades afectadas, que son pocas y las
puede listar el dueño desde la vista calendario (los encuentros cancelados se ven
en gris).

Un resync de verdad —leer Calendar y reconciliar— es **B-125**, que necesita que
el panel o un script se pueda autenticar contra la API. Mientras eso no exista,
esto es texto viejo en eventos ya publicados: molesta, no rompe.

### B-163 · El panel numera encuentros que el evento no numera · P3

`encuentrosDe` (D-70) y la vista calendario muestran "Encuentro 2 de 3" en
**cualquier** actividad de más de una sesión, mientras `posicionEnCiclo` (D-95)
numera solo si `esCiclo` está tildado. El schema prohíbe `esCiclo` con menos de
dos sesiones pero no el recíproco, así que tres encuentros sin tildar el ciclo es
un documento válido: el panel numera y el evento público no dice nada.

Es anterior a B-84 y no está claro que sea un bug —el evento afirma "Encuentro 2
de 3" solo cuando el dueño declaró que es un ciclo, y eso es defendible—, pero
son dos criterios para lo mismo derivado, que es lo que D-71 y D-20 evitan. Las
dos salidas: que el evento numere cuando hay más de una sesión aunque no sea
ciclo, o que el panel deje de numerar sin `esCiclo`. Hay un test en
`costuras.test.ts` que fija el comportamiento actual, así que unificarlo se va a
notar.

### B-161 · Fixtures de `calendario.test.ts` que todavía no ejercitan el ciclo · P3

B-84 existió porque un test pasaba con el invariante roto: su fixture era una
actividad de dos sesiones sin `esCiclo`, así que la numeración del evento no
entraba en juego. Los bloques del diff (creación, anti-loop, diff por id, cambio
global, despublicar y cancelar) ya corren sobre un ciclo de ocho encuentros
semanales. Quedan con fixture de un solo encuentro, y a propósito:

- **`planificar` — el payload propaga los campos nuevos** (arancel, organizador,
  inscripción, "publicar el link", material): son cinco tests de una sola sesión
  que verifican *que un campo propaga*, no *a cuántos*. Sobre un ciclo pasarían a
  esperar ocho ops y el test diría menos.
- **`construirEvento` y `construirDescripcion`**: son de contenido —qué sale y
  qué nunca sale—, y ahí una sesión alcanza. La numeración del ciclo tiene sus
  propios tests.

Vale releerlo con el mismo ojo cada vez que se toque el diff: el patrón —"el
fixture no ejercita el caso central del §2.2"— es el que hay que cazar, no estos
casos puntuales.

### B-129 · «Feria» falta en los tipos de actividad — ✅ hecho (2026-08-25)

**Primer reporte real cargado desde el panel** —
[issue #4](https://github.com/benoffi7/agenda-literaria/issues/4), del dueño,
desde Android, versión `1.0.1+538bef7`:

> Falta FERIA en dónde describís: taller, curso, etc

**Se puede hacer hoy sin tocar código.** `tipo` es una taxonomía autogestionada
(§4) y el schema lo trata como slug abierto (`texto.min(1)`), no como enum
cerrado: alcanza con elegir «Otro…» en el desplegable y escribir «Feria». Eso ya
funciona.

**Decidido por el dueño (2026-08-24): va como opción base**, `fijo: true` en
`src/lib/opciones-base.json`. El argumento es el del §4.1 con «a la gorra»: en el
circuito literario argentino una feria del libro no es un caso raro, es una
categoría de primera clase. Las cinco de hoy salieron del §3.1, que no la
contempla, así que el §3.1 queda desactualizado y hay que anotar el desvío.

Tres cosas que arrastra, y son el trabajo real del ítem:

1. ~~Si se carga con «Otro», nace sin aprobar~~ — ya no aplica: como opción base
   nace aprobada, y además el dueño decidió que **todas** las opciones nuevas
   nazcan aprobadas (ver **B-131**).
2. **Un tipo nuevo no tiene reglas condicionales** (§11). El formulario decide
   con `cambiarTipo` qué mostrar y qué activar solo — «club de lectura» prende
   «es ciclo» y «tiene material», «taller» y «presentación» piden tallerista.
   «Feria» cae en el default: sin tallerista, sin material, sin ciclo. Hay que
   decidir qué le corresponde (¿una feria tiene varios días? probablemente sí, o
   sea ciclo).
3. **La guía del panel** lista los tipos y el capítulo tendría que nombrarla
   (`src/lib/ayuda.ts`), y el §3.1 del `CLAUDE.md` quedaría desactualizado — es
   una decisión del dueño si se corrige el documento o se anota el desvío.

**Hecho.** «Feria» es opción base (`fijo: true`, orden 6) y su regla del §11 es
**ciclo sí, material y tallerista no**: una feria del libro dura varios días, así
que es una actividad con N encuentros (§2.2), uno por jornada, y no tiene quien la
dé. Sin la cascada caía en el default y había que acordarse de tildar «es un
ciclo» a mano, que es el olvido que el §11 existe para evitar. Va con dos tests
—uno por la cascada, otro por el `fijo`, porque borrarla desde la pantalla de
taxonomías dejaría la regla apuntando a un tipo que no se puede elegir— y su
punto en la guía.

**El §3.1 del `CLAUDE.md` queda desactualizado**: lista cinco tipos y ahora son
seis. Se anota el desvío en lugar de editar el documento del dueño.

Y el reporte deja una lección de producto que vale más que el ítem: **la primera
cosa que faltó fue una categoría del dominio, no una función del software.**

### B-130 · El listado no dice quién cargó cada actividad — ✅ hecho (2026-08-25)

`createdBy` y `updatedBy` **se guardan en cada documento y no se muestran en
ninguna parte**: el panel los escribe (`formADocumento`) y nunca los lee. Con dos
personas cargando sobre la misma lista —no hay filtro por usuario, las dos ven
todo, borradores incluidos— la pregunta «¿esto lo cargaste vos?» no se puede
contestar mirando la pantalla.

El dato ya está, así que es mostrarlo: una línea en la fila del listado, y quizás
en el encabezado del formulario al editar algo ajeno.

**Hecho, y más chico de lo que el ítem proponía.** Los dos caminos que evaluaba
—guardar el mail en el documento, o cablear el mapa uid→nombre— eran más grandes
que la pregunta. Lo que se reportó fue *"los eventos que crea el otro admin
también me aparecen, ¿no?"*, o sea **¿esto lo cargué yo?**, y eso se contesta con
el uid que el panel ya tiene en la sesión: cero cambios de modelo, cero riesgo de
filtración.

La fila marca solo lo ajeno («La cargó otra cuenta»). Lo propio no lleva marca a
propósito: si todo lleva marca, la marca deja de avisar. Y un documento sin
`createdBy` —los anteriores a que se escribiera— queda como `desconocida` y
tampoco se marca, porque afirmar de más sobre datos viejos es peor que callarse.

**Con dos cuentas alcanza; con tres, no.** "Otra cuenta" identifica sola a la
otra persona mientras sean dos. Cuando aparezca la tercera hay que guardar el mail
—y ahí sí verificar que `toPublic` lo descarte, que es el punto 2 de arriba—.
`toPublic` construye el objeto público campo por campo, o sea **lista blanca**, así
que un campo nuevo queda afuera por construcción y no por acordarse; eso reduce el
riesgo pero no lo elimina, porque alguien podría agregarlo a la proyección.
Queda como **B-179**.

Dos cosas a resolver, y la segunda importa:

1. **`createdBy` es un uid**, no un nombre. Hay que resolverlo a algo legible.
   Las dos cuentas están en `docs/02-infraestructura.md`, pero cablearlas en el
   código es exactamente el tipo de cosa que queda vieja sin que nada falle. Lo
   razonable es leer el `displayName` o el mail de Auth, o guardar el mail en el
   documento al escribir — que es más simple y no necesita otra lectura.
2. **Es un uid, y el §5.1 dice que los uids no salen al público.** Mostrarlo en el
   panel está bien: solo lo ven los admins. Pero si algún día se guarda el mail
   en el documento, hay que verificar que `toPublic` lo siga descartando — hoy
   descarta `createdBy`/`updatedBy` por nombre, así que un campo nuevo con el
   mail **se filtraría al `events.json`**. Es la clase de bug B-81: el saneador
   aplicado campo por campo en vez de en un punto de paso obligado.

Salió de la conversación del 2026-08-24, verificando que las actividades del otro
admin sí aparecen en el panel de los dos.

### B-131 · Las opciones creadas con «Otro» nacen aprobadas · P2 — ✅ hecho (2026-08-24)

**Hecho tal como lo pedía el ítem** (D-104): `aprobada: true` con el motivo
escrito al lado, una guardia que fija el default leyendo el fuente
(`tests/opciones-aprobacion.test.ts`, que no necesita emulador), y los tests de
la aprobación conservados enteros — ahora fabrican la pendiente a mano
(`volverPendiente`) porque `upsertOpcion` ya no puede producirla.


**Decisión del dueño (2026-08-24):** una etiqueta nueva cargada con «Otro» tiene
que quedar disponible para las dos cuentas enseguida, sin pasar por aprobación.

El cambio en sí es de una línea: `aprobada: false` → `true` en el `upsertOpcion`
de `src/lib/opciones.ts` (línea 131), más los tests que fijan ese default.

**La consecuencia que hay que mirar antes de hacerlo:** con esto el mecanismo de
aprobación queda **inerte**. Nada nace pendiente, así que `estaAprobada`,
`opcionesVisibles`, `huellaCreador`, el script `aprobar-opciones.mjs` y el
indicador «(sin aprobar)» de la UI dejan de tener efecto, y estos tres ítems se
quedan sin sentido:

- **B-25** (aprobar desde el panel) y **B-26** (avisar que hay algo pendiente):
  no habría nada que aprobar ni de qué avisar.
- **B-28** (¿claim `curador`?) y **B-29** (¿auto-aprobar una etiqueta reusada?):
  las dos preguntas desaparecen.

**Decidido (2026-08-24): se voltea el default y la maquinaria queda dormida.** El
dueño la quiere disponible para cuando haya más admins y más tags, que es
exactamente el escenario que el §4.3 anticipa (*"si en el futuro carga gente
además del dueño"*). Prenderla de nuevo va a ser volver a poner `false`.

Lo que hay que hacer para que el código dormido no se lea como código muerto:

- **Un comentario en `upsertOpcion`, en el lugar del default**, que diga que está
  en `true` por decisión y no por descuido, y qué la revierte. Sin eso, el
  próximo que lea `aprobada: true` al lado de `estaAprobada` y `opcionesVisibles`
  va a suponer que alguien se olvidó de terminar algo.
- **Un test que fije el default**, del mismo tipo que
  `tests/opciones-orden.test.ts` con la preselección. La maquinaria dormida tiene
  dos formas de fallar en silencio, y las dos son de la clase que este repo ya
  aprendió a cubrir: que el default se vuelva a dar vuelta sin que nadie lo note,
  o que alguien "limpie" `estaAprobada`/`huellaCreador` como código sin uso y
  después no haya nada que prender.
- **Dejar los tests de la aprobación como están.** Siguen verificando la
  maquinaria, y son lo que garantiza que funcione el día que se prenda. No
  sacarlos por estar cubriendo un camino que hoy nadie recorre.

**Vale notar por qué la decisión es razonable:** el problema que el §4.3 quería
evitar era que el desplegable se llene de variantes de lo mismo, y eso ya lo
resuelve el §4.2 —slugify más el autocompletado contra lo existente— que ataja
los duplicados **antes** de que nazcan. La aprobación agregaba control de
vocabulario, no corrección. Con dos personas de confianza, la fricción no se
paga.

### B-132 · El desplegable muestra el slug crudo mientras la etiqueta no está registrada — ✅ hecho (2026-08-25)

Reportado por el dueño usando el panel (2026-08-24): *"cuando cargo barrios o
lugares los escribe con minúscula"*.

Confirmado en `src/components/admin/campos/TaxonomiaSelect.tsx:224`:

```tsx
{pendienteAjena ? `${pendienteAjena.label} (sin aprobar)` : `${value} (nueva)`}
```

`value` es el **slug**, no la etiqueta. Al escribir «Villa Crespo» en «Otro…», la
opción todavía no está en `/opciones/*` —se persiste en el submit, por D-02— así
que `esConocido` es `false` y el desplegable pinta `villa-crespo (nueva)`.

**Hay un segundo camino al mismo síntoma**, encontrado por el frente de la fase 2
y anotado acá en lugar de como ítem aparte —es el mismo bug, la misma línea y el
mismo arreglo—: reeditar una actividad **cuya etiqueta nunca llegó a
registrarse** (D-111) también cae en `esConocido === false`, y ahí se lee
`con-beca-parcial (nueva)`. O sea que no hace falta estar cargando algo nuevo
para verlo.

**Y el arreglo ya está a mano.** El evento público resuelve esto con el des-slug
de D-11, reusado en el panel como `legible` en `filtrosActividades.ts`, y 3A dejó
`etiquetaPresentable` en `src/lib/taxonomia.ts`. El panel es el único lugar que
todavía muestra el slug pelado, que es exactamente lo que D-11 describe como "se
ve roto".

**El dato no se pierde:** el componente ya recibe la etiqueta tipeada en
`confirmarTexto`, que llama `onChange(slugTipeado, texto.trim())`. Solo no se la
guarda para mostrarla. El arreglo es acordarse de esa etiqueta mientras la opción
está pendiente de persistir.

Afecta a los cinco campos de taxonomía, no solo a barrio.

### B-133 · No se pueden cargar varios handles en «arrobar» — ✅ hecho (2026-08-25)

Reportado por el dueño (2026-08-24): *"no me deja poner coma ni enter en arrobas
para publicar"*.

Confirmado en `src/components/admin/ActividadFormulario.tsx:772-778`. El campo es
un input de una línea que hace ida y vuelta en **cada tecla**:

```tsx
value={form.difusion.arrobar.join(', ')}
onChange={… e.target.value.split(',').map((s) => s.trim()).filter(Boolean) …}
```

Al tipear la coma, el `split` produce un elemento vacío, el `filter(Boolean)` lo
descarta y el `join(', ')` vuelve a pintar el valor **sin la coma**. O sea que la
coma se borra sola en el momento de escribirla, y por eso no hay forma de cargar
un segundo handle. Y Enter tampoco sirve: es un input de una línea dentro del
`<form>`, así que Enter **intenta guardar la actividad**.

El campo es una lista, así que la solución es tratarlo como lista y no como
string: el patrón ya existe en el repo, es `TagsInput` — chips, Enter para
confirmar, Backspace para borrar el último. Reusarlo es mejor que arreglar el
split, porque el bug de fondo es haber modelado una lista como texto.

**Arreglado, pero NO reusando `TagsInput`** (D-116). El patrón de interacción sí
se reusó; el componente no, porque está atado a la taxonomía `tags`: slugifica lo
que se escribe y lo persiste en `/opciones/tags` (§4.2). Los handles de arrobar
son trabajo interno del §3.2 —no salen al público (§5.1) y nadie va a filtrar por
ellos—, así que reusarlo habría metido `@casabrandon` en el desplegable de
etiquetas de **todas** las actividades. El bug de fondo era modelar una lista como
string, y la respuesta no es cambiarla por la lista equivocada.

Quedó `ChipsInput` sobre `src/lib/formulario/chips.ts`, que es puro y tiene 11
tests. Tres cosas que se decidieron ahí y no son obvias:

- **el espacio no separa**: hay nombres con espacios, y cortar por espacio
  partiría «Casa Brandon» a la mitad mientras se escribe — el mismo daño que
  hacía el bug original;
- **los duplicados se comparan ignorando mayúsculas y el arroba de adelante**,
  porque `@CasaBrandon`, `casabrandon` y `@casabrandon` son la misma cuenta y
  tenerlas tres veces es el error que se comete al volver sobre una actividad
  meses después;
- **se guarda lo que se escribió**, no una versión normalizada: forzar el arroba
  rompería los handles que no son de Instagram, y quitarlo perdería información
  que quien lo tipeó puso a propósito.

Y la ayuda del campo también estaba mal: decía «un handle por línea o separados
por coma» y ninguna de las dos funcionaba.

### B-134 · Los tipos y las entregas de material son enums cerrados — ✅ parcial (2026-08-25)

Reportado por el dueño (2026-08-24), cargando un club de lectura real: *"en
material adicional son varias cosas: libro, newsletters, guía, playlist… y son al
inscribirse pero otros durante el mes. Agregar «durante el mes» a la lista de
opciones"*.

Los dos campos son `z.enum` en `src/lib/schema.ts:62,65`, o sea **cerrados**, a
diferencia del `tipo` de la actividad que es taxonomía abierta (§4):

| Campo | Hoy | Falta |
|---|---|---|
| `TIPOS_MATERIAL` | `lectura`, `guia`, `contexto`, `autor`, `otro` | newsletter, playlist… y «libro», que hoy entra como `lectura` |
| `ENTREGAS_MATERIAL` | `previo`, `al-inscribirse`, `en-el-encuentro` | **«durante el mes»**, que es el pedido concreto |

**«Durante el mes» es lo interesante del reporte**, y no es solo una opción más:
dice que la entrega del material no es un instante sino que puede ser progresiva
a lo largo del ciclo. Encaja con el §2.2 —un club de lectura son ocho encuentros
con su lectura cada uno— y es exactamente el caso de uso que el §4.1 llama de
primera clase, como «a la gorra».

**Hecho lo pedido, pendiente la decisión de fondo.** Agregados: `durante-el-mes`
en las entregas —el pedido concreto—, más `newsletter` y `playlist` en los tipos.

**No se agregó `libro`, y no es un olvido.** El reporte lo nombra, pero `lectura`
ya es eso: el texto asignado. Tener los dos partiría los datos existentes en dos
valores que después no se pueden volver a juntar, porque nadie va a saber cuál
eligió cada uno. Se cambió la **etiqueta** a "Libro o lectura", que es reversible;
agregar el valor no lo es. Si el dueño prefiere el valor aparte, se hace — pero
esa es la decisión que hay que tomar a ojos abiertos.

**Y apareció la tercera instancia de la clase de B-76/B-132**: el desplegable de
tipo de material pintaba el valor crudo, así que decía "guia" y "autor" mientras
el evento público decía "Guía" y "Sobre el autor". Arreglado importando el mapa de
`@calendario` en lugar de copiarlo (D-20), y con un chequeo nuevo que afirma que
**todo** valor de los dos enums tiene etiqueta en las dos pantallas — verificado
contra un valor inventado para confirmar que lo detecta y que nombra cuál falta.
`entrega` mantiene dos mapas a propósito: el panel capitaliza, el evento va en
minúscula a mitad de frase.

**La decisión que queda, y es del dueño:** ¿`material.items[].tipo` pasa a ser
**taxonomía abierta** como el resto (§4)?
Abrirlo sale casi gratis —la implementación de `opciones.ts` ya resuelve cinco
campos con un solo patrón— y evita volver a tocar código la próxima vez que
aparezca un formato que nadie previó, que en tres reportes ya pasó una vez.
`entrega`, en cambio, conviene que siga cerrada: son momentos del ciclo de vida
de la inscripción, no vocabulario libre, y el §5.1 los usa para decidir qué se
publica.

Ojo con dos cosas al implementarlo: los dos enums tienen mapas de etiquetas en el
formulario **y** en `functions/calendario.js` —que son prosa para el público, y
el diagnóstico de salud dijo explícitamente que no hay que unificarlos (§B-70)—
así que un valor nuevo va en los dos lados, y si falta en uno se publica el valor
crudo. Y `docs/03-modelo-de-datos.md` más el §3.1 del `CLAUDE.md` quedan
desactualizados.

### B-170 · Montar la pantalla de taxonomías en el router del panel — ✅ hecho (2026-08-25)

`src/components/admin/taxonomias/TaxonomiasPanel.tsx` existe, funciona y **no se
puede abrir**: colgarla del router es editar `AdminApp.tsx`, que en la fase 3 del
plan de saneamiento es de otro frente. Mientras tanto B-06, B-25 y B-26 están
hechos y no se ven.

Lo que hay que hacer, todo en `AdminApp.tsx`:

- agregar `{ tipo: 'taxonomias' }` al tipo `Vista`;
- cargarla con `lazy(() => import('@/components/admin/taxonomias/TaxonomiasPanel'))`,
  **diferida como las otras cuatro vistas** — un import estático deshace el corte
  del bundle (B-09 / D-51) y el build sigue verde;
- un botón en la cabecera, al lado del de reportes;
- el contador de pendientes de B-26 en la cabecera, con
  `usePendientesDeAprobacion()` de `useOpciones.ts` (abre cinco suscripciones:
  va montado una sola vez).

Y con eso, lo que la regla de proceso pide y hoy sería mentira: la entrada en
`src/lib/novedades.ts` ("ahora podés corregir cómo se escribe una etiqueta y
borrar las que sobran") y el capítulo en `src/lib/ayuda.ts`. No se escribieron
antes a propósito: anunciar una pantalla que no se puede abrir es peor que no
anunciarla.

### B-168 · Contar el uso de las etiquetas elegidas al guardar — ✅ hecho (2026-08-25)

**Hecho.** `usosAContar` (puro, en `src/lib/formulario/etiquetas.ts`) arma los
slugs a contar por campo y `guardarActividad` los pasa a `registrarUsos` por
puerto (D-113), después del alta de opciones —`registrarUsos` no crea el
documento si no existe, así que contar antes de sembrar no contaría nada.

**El fixture del test tenía la clase B-135 otra vez.** El `entrada()` por defecto
dice que se tipeó «Con beca parcial» pero el form guarda `a-la-gorra`: en el panel
real no puede pasar, porque `recordarLabel` registra el label en el mismo cambio
que pone su slug en el form. Con ese fixture la resta no tiene nada que restar y
el chequeo pasaba **sin haber mirado el caso**. El test de la resta usa uno
coherente, y afirma además que los que ya existían sí se cuentan — sin eso
pasaría con la lista vacía.

Era la mitad que faltaba de **B-86**, que queda cerrado.

Es una línea en `guardar()` (`ActividadFormulario.tsx`, frente de la fase 2), y
el orden importa:

1. escribir la actividad (la inversión de B-71),
2. `upsertOpcion` de las etiquetas nuevas,
3. `registrarUsos(campo, slugs)` con los slugs elegidos **menos** los que se
   acaban de crear en el paso 2 — nacen con `usos: 1` y sumarlos otra vez los
   deja en 2.

Sale con B-70/B-71, cuando `guardar()` deje de vivir dentro del componente.

### B-179 · Con tres admins, «otra cuenta» deja de identificar a nadie · P2

B-130 marca lo ajeno con «La cargó otra cuenta», que alcanza porque hay **dos**
cuentas: no ser vos implica ser la otra persona. Con la tercera, la marca dice
que no fuiste vos y nada más.

Ahí hace falta el nombre, y el camino es guardar el mail en el documento al
escribir (más simple que resolver el uid contra Auth en cada fila). Dos cosas a
verificar en ese momento:

1. **el §5.1** — `toPublic` construye el objeto campo por campo, o sea lista
   blanca, así que un campo nuevo queda afuera **por construcción**. Eso reduce el
   riesgo pero no lo elimina: alguien puede agregarlo a la proyección sin pensar.
   Vale un test que afirme que ningún campo con `@` sale al `events.json`;
2. **el historial (§12)** — el mail entra en las versiones guardadas, así que
   borrar una cuenta no lo borra de ahí.

Sale junto con la maquinaria de aprobación que B-131 dejó dormida: las dos esperan
el mismo momento, que es cuando haya más de dos personas cargando.


### B-180 · La detección de emuladores de `verificar-todo.sh` no tiene test · P3

El paso 3 del gate detecta si los emuladores ya están arriba y usa esos en
lugar de levantar otros (antes cortaba con "port taken" y **el gate fallaba por
su propia plomería**, que es lo que enseña a saltearlo). Esa decisión es un `if`
en bash y no tiene test, a diferencia de la de `que-deployar.sh`, que tiene 20.

Es el mismo argumento que llevó a extraer `que-deployar.sh` del YAML: una
decisión que no se puede probar se prueba en producción. Acá "producción" es el
momento de pushear, o sea el peor momento para descubrirla.

Lo testeable sin emuladores de verdad es la elección de rama: dado un hub que
contesta, usa `npm test` directo; dado uno que no, usa `emulators:exec`. Se puede
con un servidor HTTP de dos líneas y `FIREBASE_EMULATOR_HUB` apuntado ahí.

**Sube de valor con B-217 (2026-08-27):** la detección se factorizó y ahora la
comparten los pasos 3 **y** 4, así que ese `if` sin test decide dos ramas y no
una. Sigue en P3 —el modo de falla es ruidoso, no silencioso— pero el argumento
de arriba pesa el doble.

### B-181 · Un club puede ofrecer N opciones para sumarte, y el modelo solo sabe de N encuentros · P2

Reporte del dueño usando el panel de verdad (2026-08-25):

> un club de lectura puede darte 4 opciones para sumarte. Pero no son 4
> encuentros, sino opciones.

`sesiones` (§2.2, §3.1) es una **secuencia**: N filas son N encuentros que pasan
todos, y quien se anota va a todos. Un club que abre cuatro horarios del mismo
ciclo —martes 19, jueves 19, sábado 11, y uno virtual— tiene cuatro filas que son
**alternativas excluyentes**: cada persona va a una sola. Hoy no hay forma de
decir eso, y si se cargan como encuentros el panel y el sitio afirman algo falso:

- el calendario público publica los cuatro eventos y quien se suscribe se lleva
  los cuatro, tres de los cuales no son suyos (§7);
- el evento dice «Encuentro 2 de 4» (D-95), que sobre una alternativa no
  significa nada;
- «con algo por venir» y el orden por encuentro más próximo cuentan cuatro fechas
  donde hay una;
- si además el ciclo tiene encuentros reales, las dos dimensiones se multiplican
  y la lista de sesiones deja de ser legible.

**Por qué vale la pena:** es la primera forma del dominio que el modelo no puede
expresar. «Feria» (B-129) era un valor que faltaba en una taxonomía abierta y se
podía cargar con «Otro…» el mismo día; esto no tiene esa salida. Y es una forma
común en el circuito: los clubes con cupo chico abren varias comisiones del mismo
ciclo justamente porque no les entra la gente en una.

**La forma la decide el dueño (DEC-8).** Tres caminos con costos muy distintos:

1. **Nada de modelo:** se carga una fecha y las otras tres van en la descripción.
   Cero código y cero riesgo; nadie puede filtrar por «hay horario los sábados» y
   el calendario sigue publicando lo que se cargue.
2. **Una actividad por comisión**, atadas por un campo nuevo (`comisionDe` o
   parecido). Reusa todo lo que ya existe —sesiones, calendario, filtros— y
   cuesta N tarjetas casi iguales en el listado más mantenerlas en sincronía:
   cambió la sede → cuatro escrituras, que es exactamente lo que el §2.2 quiso
   evitar.
3. **Un eje nuevo en el documento** (`opciones: [{ id, etiqueta, sesiones }]`),
   que es lo que el reporte describe literalmente. El más fiel y el más caro:
   toca el schema, el formulario, la proyección pública, el diff del §7.2 —que
   hoy es una sola `Map` por id de sesión— y la numeración de D-95.

**Sube a P1 cuando salga el sitio público** (B-105 a B-114): hasta entonces el
daño es un calendario con eventos de más, y después es información equivocada
indexada en Google, que es el objetivo del proyecto.

### B-182 · El evento dice «(Otro, previo al encuentro)» en la mitad de las líneas de material — ✅ hecho (2026-08-25)

Reporte del dueño mirando un evento ya publicado de un club de lectura:

> - Libro virtual: Han cantado BINGO (Lectura, al inscribirse)
> - Durante el mes recibís 2 newsletters para profundizar en la lectura (Guía, al inscribirse)
> - Bonus track: material adicional (Otro, previo al encuentro)
> - Playlist inspirado en el universo del libro (Otro, previo al encuentro)
> - Acceso a un grupo de telegram para charlar sobre el libro (Otro, previo al encuentro)
>
> Puede sacarse el (otro…?

**Sí, y el reporte muestra por qué.** `otro` es el formato donde cae todo lo que
no entra en los demás, así que es el más usado: tres de las cinco líneas repiten
una palabra que no informa nada al lado del título —«Playlist inspirado en el
universo del libro **(Otro**…»— y encima empuja hacia abajo el dato que sí
importa, cuándo llega.

Arreglado en `functions/calendario.js`: con `tipo === 'otro'` la línea sale
`- <título> (<entrega>)`. **La entrega no se toca**, que es la mitad del ítem que
no está en el título. En el desplegable del panel «Otro» sigue siendo una opción:
ahí hay que poder elegirlo, y es otra pantalla con otro criterio (la misma razón
por la que `ETIQUETA_ENTREGA` no se comparte entre panel y evento — D-20).

Va con test en `tests/calendario.test.ts`, que es lo que evita que vuelva: el
patrón que lo restaura es tocar el `map` de material sin acordarse del caso.

Dos cosas que el reporte deja ver y **no** son este ítem:

- Ese evento se cargó con `Guía` para dos newsletters y `Otro` para una playlist,
  porque salió de la versión desplegada. Los formatos `newsletter` y `playlist`
  ya existen (B-134) y llegan con **1.1.0**.
- «Durante el mes recibís 2 newsletters» está escrito en el **título** del ítem
  porque cuando se cargó no existía la entrega `durante-el-mes`. Ahora existe, y
  la guía la nombra.

### B-185 · «DM de Instagram» debería decir «DM al Instagram» · P3

Reporte del dueño (2026-08-25): la vía de inscripción se lee mal. Es «DM **al**
Instagram», no «de».

Es copy, y está en **dos lugares con dos registros distintos**, que es lo que hay
que no romper:

| Dónde | Hoy | Qué es |
|---|---|---|
| `src/components/admin/formulario/etiquetasUI.ts` | `dm: 'DM de Instagram'` | opción de un desplegable del panel |
| `functions/calendario.js` | `dm: 'por DM de Instagram'` | prosa, cae a mitad de una frase del evento público |

No están unificados **a propósito** (D-20): unificarlos haría que un cambio de
copy del panel cambie lo que se publica. La contra es esta: cambiar uno y
olvidarse del otro es exactamente la clase de bug B-76 —el panel y el evento
diciendo cosas distintas del mismo valor guardado— y acá el build queda verde
igual. Así que el arreglo son las dos líneas, o ninguna.

El valor guardado es `dm` y no se toca: esto es la etiqueta, no la identidad.

Cuando se haga, hay que revisar si `tests/etiquetas-de-ui.test.ts` fija alguno de
los dos textos, y el comentario de `etiquetasUI.ts` que cita «por DM de
Instagram» como ejemplo de prosa.

### B-186 · El almanaque de la fecha se cierra solo si se tarda en elegir — ✅ hecho (2026-08-26)

Reporte del dueño usando el panel (2026-08-25):

> el almanaque cuando «corrés» la fecha se suele cerrar si no pongo rápido la
> fecha, pero bueno, lo pongo manual

O sea: se abre el selector nativo de `<input type="datetime-local">`, se navega
entre meses, y **si la elección tarda, el almanaque se cierra solo**. La salida es
tipear la fecha a mano, que funciona pero es lo contrario de lo que el selector
existe para evitar — y un ciclo tiene ocho fechas, así que es la interacción más
repetida del formulario.

**Lo que se descartó leyendo el código** (los dos sospechosos obvios, los dos
inocentes):

- **No es un reordenamiento de filas.** `ordenarPorInicio` corre solo con el
  botón explícito, no en cada cambio, así que cambiar la fecha no mueve la fila
  de lugar.
- **No es un `key` por índice.** Las filas van con `key={s.id}` (trampa 2), así
  que React no reemplaza el nodo del input al re-renderizar.
- **El valor no se normaliza al escribirlo.** `editar(s.id, { inicio:
  e.target.value })` guarda el string crudo, así que React no le reescribe al
  input un valor distinto del que tiene.

**Tres candidatos, en orden de qué tan bien explican "si no pongo rápido":**

1. **El arranque diferido de la analítica.** `arrancar()` en `src/lib/analytics.ts`
   carga `firebase/analytics` con `requestIdleCallback(fn, { timeout: 4000 })`, o
   `setTimeout(fn, 2000)` donde no existe. O sea: **se dispara justo cuando la
   persona se queda quieta**, que es exactamente la condición que el reporte
   describe. Es un `import()` dinámico de un chunk grande más la inicialización
   del SDK. Prueba de un minuto y sin tocar código: es uno de los tres portones
   de `debeMedir`, así que un build con `PUBLIC_FIREBASE_MEASUREMENT_ID` vacío
   apaga la analítica entera — si con eso el almanaque no se cierra, es esto.
2. **Un cambio de layout debajo del selector abierto.** La barra de acciones es
   `fixed` abajo y su mensaje («N campos para revisar») aparece y desaparece según
   la validación; `AvisoVersionNueva` puede insertar una barra arriba. En Android
   un reflow de la página con el picker abierto lo descarta.
3. **Un `value` vacío de vuelta.** Un `datetime-local` incompleto reporta
   `value === ''`. Si en algún momento del recorrido del almanaque llega un
   `change` con `''`, se guarda `''`, React lo reescribe y el navegador limpia el
   campo y cierra. Se confirma o se descarta logueando `e.target.value` en cada
   `change` mientras se usa el selector.

**Lo que falta para arreglarlo es el dato del dispositivo**, que es justo lo que
un bug de fechas no se diagnostica sin él (trampa 1, en versión picker): navegador
y sistema. El reporte anterior del dueño (issue #4) vino de Android, así que
Chrome/Android es la primera hipótesis, y el selector nativo de `datetime-local`
se comporta distinto en cada plataforma.

**P2 y no P1** porque hay salida —tipear— y no se pierde ni se corrompe nada. Pero
es fricción en la acción más repetida del panel, y del tipo que hace que se cargue
menos.

Si al final resulta que es el selector nativo y no hay nada que apagar, la
alternativa es un selector propio, y eso es otro ítem: pesa en el bundle (B-09) y
hay que decidirlo, no descubrirlo.

### B-187 · `npx firebase` resolvía el global, así que el primer push de CI cortó al minuto — ✅ hecho (2026-08-25)

El primer push a GitHub disparó «Deploy desde main» y el job `verificar` murió en
el paso de los tests:

```
npm error could not determine executable to run
```

`firebase-tools` estaba **solo instalado global** (declarado como dependencia del
entorno local en [`02-infraestructura.md`](02-infraestructura.md), versión
15.9.1). Los workflows lo invocan con `npx firebase`, que en la máquina de
desarrollo encuentra el global y en un runner limpio no encuentra nada. Tres
lugares dependían de eso: `emulators:exec` del gate de CI, y los dos
`firebase deploy` de las reglas y de las Functions.

**Lo importante no es el error, es que el gate de pre-push no podía verlo.**
`scripts/verificar-todo.sh` corre el mismo `npx firebase` en la misma máquina que
tiene el global, así que da verde por el mismo motivo por el que CI da rojo. Es la
familia de B-180 y de `que-deployar.sh`: una condición que solo se evalúa en
producción se descubre en producción, y acá "producción" es el push.

**Arreglado** pasando `firebase-tools` a `devDependency` (`^15.28.1`, 17 MB) en
lugar de instalarlo en el workflow. Las dos opciones tapan el error; solo una tapa
la clase: con la dependencia declarada, `npm ci` la provee en los cuatro jobs y en
cualquier clone nuevo, y el gate local y CI corren **el mismo binario**. Un
`npm i -g` en el YAML habría dejado dos versiones que pueden separarse, que es la
forma en que este error vuelve con otra cara.

De paso, `npm run emu` usaba `firebase` pelado: también pasó a `npx firebase`, así
que un clone nuevo levanta los emuladores sin instalar nada.

Lo que **no** cubre este arreglo: el deploy sigue sin poder correr por los secrets
que faltan (ver «Pendiente de acción manual del dueño»). Este ítem es solo el gate.

### B-188 · `deploy.yml` falla al arrancar, y es el último eslabón del rebuild — ✅ hecho (2026-08-25)

Desde el primer push del repo (2026-08-25), **cada** push a `main` deja dos
corridas en Actions: la de «Deploy desde main», que es la que corresponde, y una
de `.github/workflows/deploy.yml` que muere sin ejecutar ningún job. GitHub la
muestra con el path en lugar del `name:` del archivo —señal de que no llegó a
parsearlo— y con el texto *"This run likely failed because of a workflow file
issue"*, sin más detalle por API.

Dos cosas raras a la vez: **`deploy.yml` no tiene trigger de `push`** (solo
`repository_dispatch: [rebuild]` y `workflow_dispatch`), así que un push no
debería producirle ninguna corrida.

**Lo que se descartó:** el archivo es YAML estructuralmente válido —sin tabs, sin
BOM, sin CRLF, sin claves duplicadas de primer nivel, `on`/`jobs`/`permissions` en
su lugar— y el otro workflow, con la misma forma, arranca bien.

**Por qué es P1 y no ruido en la pestaña Actions:** `deploy.yml` es el workflow del
lazo del §8, el que republica el sitio cuando se edita una actividad. Y
`dispararRebuild` **ya está desplegada y corriendo cada 5 minutos** —relevado el
2026-08-25, contra lo que decía la doc—, así que el lazo está prendido de punta a
punta y corta acá: la Function manda el `repository_dispatch`, el workflow no
arranca, y **la Function no tiene forma de enterarse**; para ella el dispatch salió
bien. Es una falla silenciosa en el último eslabón de una cadena que ya está en
producción.

Lo que todavía lo tapa es que no hay sitio público que republicar (paso 3 del §10).
El día que lo haya, esto es el motivo por el que una actividad nueva no va a
aparecer nunca, y no va a haber ningún error que lo diga. La corrida fallida de
cada push es la única señal visible, así que conviene no acostumbrarse a
ignorarla.

#### La causa, y cómo se encontró sin la UI

El candidato que había anotado era el correcto pero por el motivo equivocado: no
era el contexto inexistente, era **la sintaxis de la línea**.

```yaml
run: echo "Motivo: ${{ github.event.client_payload.motivo || 'disparo manual' }}"
```

Un `: ` adentro de un escalar sin comillas hace que YAML lea un **mapa anidado**, y
el archivo entero queda inválido:

```
Nested mappings are not allowed in compact mappings at line 38, column 14
```

Lo que lo confirmó sin necesidad de la UI fueron dos observaciones:

1. **El `name` de la entidad del workflow era el path** (`.github/workflows/deploy.yml`
   en lugar de "Build y deploy del sitio"): GitHub nunca llegó a leer el `name:`.
2. **`POST .../dispatches` contestó 422 "Workflow does not have 'workflow_dispatch'
   trigger"** sobre un archivo que declara ese trigger en la línea 15. O sea que la
   versión que GitHub tiene de este workflow **no tiene triggers**, y por eso un
   push le generaba una corrida de error en vez de ignorarlo.

Y el parser lo dijo en una línea, corriendo `yaml` con `strict` sobre los dos
workflows. Lo que descartó los sospechosos obvios antes: no hay tabs, ni BOM, ni
CRLF, ni claves duplicadas, ni caracteres invisibles — eso se verificó, y era
verdad; el problema no era el archivo como bytes sino como gramática.

**Arreglado** pasando la línea a `run: |`. Y va con red: `tests/workflows.test.ts`
parsea todos los workflows en modo estricto y verifica que cada uno tenga `name` y
al menos un trigger, más que el `repository_dispatch` de `deploy.yml` coincida con
el `event_type` que manda `functions/index.js`. Se comprobó reintroduciendo el bug:
el test falla y nombra la línea y la columna.

**Por qué el chequeo mira `doc.errors` y no el objeto parseado:** el parser de
`yaml` se **recupera** del error y devuelve un objeto con `name` y `on` adentro, así
que un test que mirara el resultado habría dado verde sobre un archivo que en
GitHub no funciona. Un parser más tolerante que el consumidor real da la respuesta
equivocada.

Quedó como **trampa 11** del `CLAUDE.md` §13 (D-118): es la única de la lista que
no se identificó leyendo el código, y ningún test del repo podía verla.

### B-190 · La plataforma es obligatoria para lo virtual, y a veces todavía no se sabe cuál es · P2

[Issue #5](https://github.com/benoffi7/agenda-literaria/issues/5), del panel,
Android, versión `1.0.1+538bef7`:

> Si no dice que plataforma dónde es el encuentro virtual, no quiero poner otro
> porqué capaz es meet o zoom. No podría no ser obligatoria? O no se me ocurre
> que poner

El `superRefine` del schema exige `online.plataforma` cuando la modalidad es
virtual o híbrida. El motivo es bueno —el evento público dice por dónde se
conecta la gente— pero **"todavía no se decidió" es un estado real del dominio**, y
hoy el formulario no lo puede expresar: obliga a elegir algo. El reporte lo dice
con precisión: no es que falte la opción, es que **poner cualquiera sería
inventar**, y una plataforma equivocada en un evento público es peor que ninguna.

**El arreglo más barato no toca el schema.** `online.plataforma` es una taxonomía
autogestionada del §4, así que alcanza con una opción base `a-confirmar` con
`fijo: true` en `src/lib/opciones-base.json` — una entrada, cero código. Es el
argumento del §4.1 con «a la gorra»: no es un caso raro que se resuelve con
«Otro…», es un estado de primera clase que merece nombre propio. Y además es
**honesto de publicar**: el evento dice "Virtual · plataforma a confirmar", que es
exactamente lo que se sabe.

Hay que revisar dos cosas del otro lado antes de darlo por hecho:

- **Cómo lo lee el evento** (`functions/calendario.js`): con `a-confirmar` la línea
  tiene que decir algo legible, no el slug. Es la clase de bug B-76/B-132 y ya hay
  un chequeo que exige etiqueta para todo valor de los enums, pero las taxonomías
  abiertas no pasan por ahí.
- **Qué pasa al publicar.** Si se acepta publicar con la plataforma a confirmar,
  alguien tiene que volver a completarla, y nada se lo va a recordar. Ese
  recordatorio es de la familia de B-126 (la vista calendario avisando de lo que
  falta), no de este ítem.

La otra mitad de la pregunta —hacerla **opcional** en vez de darle un valor— es la
alternativa, y es peor: un campo opcional no distingue "no hace falta" de "falta",
así que se publican encuentros virtuales sin decir por dónde y nadie se entera. El
mismo razonamiento que llevó a que el arancel obligue a elegir (D-16).

Lo mismo se le puede preguntar a `sede` en presencial —un lugar a confirmar es
igual de común—, pero eso es otro ítem: la sede además arrastra la dirección, el
mapa y el `location` del evento.

### B-192 · Una librería que sale a la calle no tiene tipo — ✅ hecho (2026-08-26)

Dos reportes del panel que son el mismo pedido con dos nombres distintos, del
mismo día:

[Issue #8](https://github.com/benoffi7/agenda-literaria/issues/8):

> Además de feria- cómo poner cuando una librería tiene un día especial que sale a
> la calle o se pone en un bar o café una mesita con libros? Venta especial?

[Issue #9](https://github.com/benoffi7/agenda-literaria/issues/9):

> Para cuando una librería pone los libros a la calle o hace algo (tipo música o
> charlas en la calle) ponerle : Librería ABIERTA - Librería a la calle

Misma familia que **B-129** («Feria»): una categoría del dominio que las cinco de
§3.1 no contemplan. Y como ahí, **se puede hacer hoy sin tocar código**: `tipo` es
una taxonomía abierta y el schema lo trata como slug (`texto.min(1)`), así que
«Otro…» + "Librería a la calle" ya funciona. Lo que hay que decidir es si pasa a
ser opción base, y **cómo se llama**.

**El nombre es el trabajo, no un detalle.** Los dos reportes proponen tres
etiquetas para la misma cosa —"Venta especial", "Librería ABIERTA", "Librería a la
calle"— y esa duda es la señal de que no es obvio. Acá aplica la lección de
**B-134**: un valor nuevo **no es reversible** (parte los datos en dos que después
nadie puede volver a juntar, porque nadie recuerda cuál eligió), y una **etiqueta
sí lo es**. Así que: **un solo slug**, y el label se puede cambiar después. Va como
**DEC-9**.

Dos cosas que arrastra, y son el trabajo real:

- **La cascada del §11.** ¿Prende «es un ciclo»? Una librería que abre a la calle
  un sábado es un día; una semana de la librería son varios, uno por jornada, que
  es lo mismo que se decidió para «Feria». No pide tallerista. Material,
  probablemente tampoco. Si no se define la cascada, cae en el default y hay que
  acordarse a mano, que es justo el olvido que el §11 evita.
- **`fijo: true`**, por el mismo motivo que «Feria»: si la cascada la nombra por
  slug, borrarla desde la pantalla de taxonomías —que ahora existe— dejaría la
  regla apuntando a un tipo que no se puede elegir. Eso va con test.

Nota de dominio que vale más que el ítem: los dos reportes describen algo que **no
es una actividad con horario de inicio y fin claros** sino un local abierto un día,
a veces con música o charlas adentro. Si eso se repite, el modelo va a necesitar
distinguir "evento" de "jornada", y ahí se cruza con **B-181**.

**Cómo quedó (2026-08-26, DEC-9).** Slug **`libreria-a-la-calle`**, label «Librería
a la calle», `orden: 7`, `fijo: true`. Se eligió el más concreto de los tres
propuestos porque es el que menos se va a estirar para significar otra cosa; el
label es cambiable, el slug no (la lección de B-134).

La cascada es la de «Feria» y por el mismo motivo: salir a la vereda un sábado es un
día, y una semana de la librería son varias jornadas. No prende material ni
tallerista.

**Y de paso la cascada dejó de ser una cadena de `||`.** Eran tres tipos ya, y una
cadena que crece es cómo un tipo nuevo queda con la mitad de la regla. Ahora es
`CICLOS_POR_TIPO`, un `Set`, con **dos tests en las dos direcciones**: que todo tipo
del Set prenda «es un ciclo», y que todo tipo del Set exista en
`opciones-base.json` con `fijo: true` — esa segunda es la que faltaría si alguien
agrega un slug al Set y se olvida del JSON, y la cascada quedaría apuntando a un
tipo que no se puede elegir. Verificado rompiendo las dos por separado.

### B-193 · La vista previa del evento ya existía y quien la pidió no la encontró — ✅ hecho (2026-08-26), falta la puerta del listado

[Issue #7](https://github.com/benoffi7/agenda-literaria/issues/7), del panel,
Android, versión `1.0.1+538bef7`:

> Se puede ver como una "vista previa" de como se va a ver en el calendario? O
> debería entrar al calendario y suscribirme

**La vista previa existe desde el 2026-08-21** (B-12, D-14) y estaba en la versión
desde la que se escribió ese reporte. O sea: no falta la función, **falta poder
encontrarla**. Es el reporte más barato de todos los que llegaron, porque no hay
que construir nada.

Por qué no se encontró, con lo que se sabe:

- Es la **última** sección del formulario y **arranca colapsada**, junto con
  Material, Opcional y Difusión. Hay que bajar hasta el final y abrirla.
- El reporte salió con `Pantalla: Otra` y ruta `/admin/`: quien preguntó no estaba
  en el formulario. Desde el listado, «cómo se va a ver el evento» no tiene
  ninguna puerta.

**Lo que NO es el arreglo:** explicarlo mejor en la guía. La guía ya lo explica
—`ayuda.ts` tiene el capítulo— y no alcanzó, que es precisamente el límite que
B-63 señala. Una función que hay que ir a buscar a la ayuda está escondida.

Dos caminos, y se pueden combinar:

1. **Que la vista previa nazca abierta la primera vez** que se abre una actividad,
   y recuerde el estado después. Es el cambio más chico y ataca el motivo
   principal.
2. **Una puerta desde el listado**, en el menú «⋯» de cada fila —que es donde
   estaba parada la persona—, que abra la vista previa sin entrar a editar. Cuesta
   más, y de paso sirve para revisar qué se publicó sin riesgo de tocar nada.

**El valor de este ítem está en la clase, más que en el arreglo.** Es la primera
evidencia medida de que la segunda persona **no encuentra** lo que se construye, y
eso no lo dice ningún test. Vale mirar con el mismo ojo las otras funciones que
viven detrás de un acordeón o de un menú: material, difusión, historial, y la
pantalla de taxonomías.

### B-194 · Dos jobs que no pueden terminar bien, y uno bloquea el deploy del panel — ✅ hecho (2026-08-28)

Desde que el deploy por CI funciona (2026-08-25), `push-main.yml` tiene **dos** jobs
que no pueden terminar bien con la credencial que hay:

| Job | Corta con |
|---|---|
| Cloud Functions | `Missing permissions … iam.serviceAccounts.ActAs on agenda-literaria@appspot.gserviceaccount.com` |
| Reglas e índices | `Permission denied` (desde D-119, que revirtió `firebaserules.admin`) |

**Los dos son a propósito**, y el razonamiento está en
[`02-infraestructura.md`](02-infraestructura.md) § "Roles de `deploy-ci@`" y en
**D-119**: la única key del proyecto no despliega código ni cambia qué es legible.
Lo que **no** es a propósito son las tres consecuencias:

1. **Toda corrida que toque `functions/` queda roja.** Una corrida roja que se
   espera roja es la forma más rápida de que nadie mire las corridas, que es
   exactamente lo que pasó con B-188: la señal de que algo anda mal se vuelve
   ruido de fondo.
2. **Se pierde el tag de versión.** El job `etiquetar` pide `!failure()`, así que
   un push que suba `version` en `package.json` **y** toque `functions/` no crea el
   tag. Y son el mismo push más seguido de lo que parece: el cambio del §7 al
   calendario suele venir con la versión nueva que lo anuncia.
3. **Un push que toque las reglas y `src/` no publica el panel** — y ésta es la que
   sube el ítem a P1. El `if` del job de Hosting pide
   `needs.firestore.result != 'failure'`, así que el rojo del job de reglas lo
   saltea. Medido:

   ```bash
   $ printf 'firestore.rules\nsrc/lib/schema.ts\n' | ./scripts/que-deployar.sh
   hosting=true   functions=false   firestore=true     # → reglas ❌ → Hosting salteado
   ```

   El `if` existe por un motivo bueno (el panel nuevo no debe salir antes que las
   reglas que necesita). Pero ahora distingue mal: trata igual "las reglas son
   inválidas" y "esta credencial no despliega reglas, por diseño".

Tres salidas, y la decisión es cuál:

- **Sacar los dos jobs y reemplazarlos por uno que solo avise.** Es lo más honesto
  con lo que ya se decidió: si reglas y Functions se despliegan a mano por diseño,
  dos jobs que intentan hacerlo y fallan no aportan nada, y una corrida que se
  espera roja es la forma más rápida de que nadie mire las corridas — que es
  exactamente lo que pasó con B-188. El job de aviso anota "cambió `functions/`:
  deployá a mano" y termina en verde. **Es la que recomendaría**, y resuelve las
  tres consecuencias de una. Lo que cuesta: el orden "reglas antes que el panel"
  deja de estar garantizado por el workflow y pasa a ser del runbook, así que hay
  que escribirlo ahí.
- **Dejarlos y aflojar los `if`**: sacar `functions` de los `needs` de `etiquetar`, y
  cambiar el de Hosting por algo que distinga "reglas inválidas" de "sin permiso".
  Tapa las consecuencias sin resolver la 1.
- **Otorgar los roles.** Resuelve todo y es la que se descartó dos veces por
  seguridad (§"Roles de `deploy-ci@`", D-119). Si se revisara, la forma menos mala es
  una **segunda** service account por tarea, con su propia key, para que el alcance
  no se acumule sobre la que publica el sitio.

`que-deployar.sh` decide cuándo corre este job, así que la primera y la segunda
opción se pueden probar con el script antes de tocar el YAML.

**Se fue por la tercera: se otorgaron los roles (D-132, 2026-08-28).** Vale anotar
que **no** es la que este ítem recomendaba —el job que solo avisa— y por qué se
movió el balance: la consecuencia 3 se cobró en producción antes de que hubiera
tiempo de elegir. La `1.5.0` se publicó, el job de reglas cortó con 403, Hosting se
salteó, y la web siguió mostrando `1.4.0` **sin que nada lo dijera**: la corrida
roja era la de siempre. La consecuencia 1 —"una corrida que se espera roja es la
forma más rápida de que nadie mire las corridas"— dejó de ser una predicción.

Con los roles, las tres consecuencias caen juntas: los seis jobs terminan bien, el
tag se crea, y el rojo vuelve a significar algo.

**Lo que este ítem proponía como forma menos mala —una segunda service account, para
que el alcance no se acumule sobre la que publica— no se hizo**, y sigue siendo la
buena idea. Está abierto como **B-225**, con el disparador escrito: parte la key el
día que el repo tenga más de un lector del secret.

### B-196 · Los tests de privacidad del `events.json` y del evento son una lista, no una propiedad — ✅ hecho (2026-08-26)

Sale del auditor de privacidad (B-195, H4). Las cuatro salidas públicas del §5.1 se
verifican de dos maneras distintas, y dos están mejor cubiertas que las otras dos:

| Salida | Cómo se verifica |
|---|---|
| Issue de GitHub | **barrido por clase** (`tests/clases-de-bug.test.ts`) |
| Analítica | **barrido por clase** (`tests/analytics-privacidad.test.ts`) |
| `events.json` / SSG | lista de campos conocidos (`tests/toPublic.test.ts`) |
| Evento de Calendar | lista de campos conocidos (`tests/calendario.test.ts`) |

Las dos últimas nombran cada campo privado que existía el día que se escribieron:
`zoom.us/j/secreto`, `coordinar con prensa`, `drive/privado`, `evt_secreto`,
`uid_abc`. Eso cubre lo que se conocía, no la propiedad. **El campo nuevo que nadie
agregue a la lista se publica sin que nada se ponga rojo**, y `construirDescripcion`
arma la descripción del evento con ~15 interpolaciones a mano, así que es justo donde
un campo se cuela por descuido.

**La forma:** un fixture donde **cada string** de la actividad es un centinela
distinto y verificable (`CENTINELA_titulo`, `CENTINELA_difusion_notas`, …), y la
afirmación de que en la salida sobreviven **exactamente** los centinelas de los
campos que el §5.2 permite. Un campo nuevo nace en el fixture —porque el fixture se
arma recorriendo el tipo— y si se publica sin estar permitido, falla.

Lo caro es armar el fixture exhaustivo; lo barato es que después cada campo nuevo
entra solo. Es el mismo patrón que ya usan las otras dos salidas, así que hay de
dónde copiarlo.

### B-195 · Lo que encontró el auditor de privacidad sobre el deploy nuevo — ✅ hecho (2026-08-25)

Cuatro hallazgos al auditar el día completo. Los dos primeros son **consecuencia de
arreglar B-188**: hasta ese momento `deploy.yml` no arrancaba nunca, así que sus
problemas eran inertes.

**H1 · el motivo del rebuild se interpolaba en el cuerpo del script.**

```yaml
run: |
  echo "Motivo: ${{ github.event.client_payload.motivo || 'disparo manual' }}"
```

Dos cosas a la vez. `${{ }}` dentro de un `run:` se pega en el texto del script
**antes** de que exista la shell, y `motivo` sale de Firestore: un valor con comillas
o `$(…)` ejecuta lo que quiera en el job que más abajo recibe
`FIREBASE_SERVICE_ACCOUNT`, la única key del proyecto. Y aparte, **los logs de
Actions de un repo público los lee cualquiera**, así que el motivo es una salida
pública más — una que el §5.1 no enumera.

Arreglado pasándolo por `env:`. Va con dos redes en `tests/workflows.test.ts`:
ningún `run:` de ningún workflow puede interpolar `github.event.*`, `inputs` ni
`client_payload`; y en `tests/costuras.test.ts`, que el motivo sea **opaco**. Ese
segundo es una propiedad y no una lista: ningún dato del documento se alcanza sin un
acceso a propiedad, así que se exige que las interpolaciones del motivo no tengan un
punto. `${id}` pasa; `${despues.titulo}` no, sin importar cómo se llame el campo. El
cambio tentador era justamente ése — `actividad ${despues.titulo}` se lee mucho mejor
en el log— y publicaría el título de una actividad que puede estar en **borrador**,
porque `marcarRebuild` corre con `huboCambioDeContenido` y no espera a que se
publique.

**H2 · el radio de la única key había cambiado y `07-seguridad.md` decía lo
contrario** → resuelto como **D-119**: se revirtieron los roles de reglas, y las dos
listas quedaron atadas por `tests/roles-deploy-ci.test.ts`.

**H3 · el gate de la trampa 4 estaba copiado en YAML, y la copia ya había
divergido.** `deploy.yml` tenía el `grep` inline en vez de llamar a
`scripts/verificar-bundle.sh`, y le faltaba la guarda final del script: que `dist/`
tenga al menos un `.js`. O sea que **un build vacío pasaba el gate habiendo
verificado nada** — exactamente lo que la cabecera del script advertía que pasaría
al duplicarlo, y exactamente el build que describe **B-189**. Ahora llama al script,
y el test exige que todo workflow que buildee lo haga.

**H4 · las dos salidas que se arman interpolando texto no tienen barrido de
centinelas** → queda abierto como **B-196**.

Las tres redes nuevas se verificaron reintroduciendo cada bug.

### B-199 · Duplicar copia todo sin preguntar, y con imágenes propias eso deja de ser gratis — ✅ hecho (2026-08-26)

Pedido del dueño (2026-08-26), a partir de la pregunta de qué hereda una copia en
la galería de B-167: **un modal al duplicar, con los campos que se quieren
copiar**.

Hoy `duplicar.ts` copia casi todo por spread y solo excluye lo que no puede
heredarse (ids de sesión, `calendarEventId`, slug, estado). Eso alcanza mientras
todo lo copiable sea texto. Con B-167 deja de alcanzar: una imagen **propia** vive
en Storage, y si la copia comparte el `storagePath`, borrar una le rompe las
imágenes a la otra.

**Lo que hay que decidir al implementarlo, y es el trabajo real:**

- ~~**El default.**~~ **Decidido el 2026-08-26: prendido lo que hoy se copia, y
  apagado solo lo riesgoso.** El primer pedido era "todos apagados", y eso convertía
  *duplicar* en *actividad nueva*: en el caso real —«el mismo club, la temporada que
  viene»— habría que tildar quince casillas para conseguir lo que hoy sale de un
  click, y con eso se deja de usar el botón. Nacen **apagadas** la **difusión**
  (notas internas y handles de otra edición, que hoy se arrastran y nadie revisa
  porque están en un acordeón cerrado) y las **imágenes propias**. El slug y el
  estado ya no se heredan y no son opcionales. O sea: el modal es para
  **desmarcar**, no para armar la copia de cero.
- **Qué pasa si alguien tilda las imágenes propias.** El modal mueve la pregunta,
  no la contesta: o se copia el objeto de Storage —y duplicar deja de ser lógica
  pura del cliente, y puede fallar después de copiar dos de cuatro— o se cuentan
  referencias, que es la variante con estado compartido de B-71. Hasta que esto se
  decida, B-167 sale con lo conservador: hereda las externas y no las propias.

**Por qué vale la pena igual sin B-167:** la copia arrastra hoy `difusion.notas`
y los handles a arrobar, que son trabajo interno de *otra* edición, y nadie los
revisa porque no se ven (están en un acordeón cerrado).

### B-203 · Una sesión que termina sin un click deja los borradores en el navegador — ✅ hecho (2026-08-26)

Lo encontró el `auditor-privacidad` verificando el arreglo de su propio hallazgo.
`cerrarSesion()` borra los borradores y cubre los **dos** botones «Salir», que son
los dos únicos call sites de `logout()`. Lo que no cubre: `observarAuth` es
`onAuthStateChanged`, y dispara `null` sin ningún click — token revocado, cuenta
deshabilitada, logout en otra pestaña. Ahí el panel vuelve al login y los
borradores quedan, en claro y hasta 30 días.

`07-seguridad.md` ya dice esto con precisión —lo garantizan los botones, no la
sesión— así que la doc no miente; falta el código.

**El cuidado que tiene el arreglo, y por eso es su propio ítem:** borrar en
cualquier `null` de `onAuthStateChanged` se llevaría trabajo bueno en un `null`
transitorio (el que aparece mientras se restaura la sesión al abrir el panel), y
eso es peor que la exposición residual. Hay que borrar en la **transición** de
usuario a `null`, guardando el anterior en un `useRef`.

**Test:** `it('cualquier fin de sesión se lleva los borradores, no solo el botón (§5.1)')`.

**Cómo quedó (2026-08-26).** `alCambiarDeSesion` en `borradoresDelNavegador.ts` —el
módulo que existe para que `AdminApp` no arrastre el molde del formulario al chunk
inicial— enganchada en el observador de auth con un `useRef` para el uid anterior.
El arreglo **no agrega ningún import al panel**: ese módulo ya estaba importado.

**Compara uids y no «hay usuario / no hay»**, que es lo que el ítem pedía no
equivocar y un poco más: `null → uid` es el arranque y no borra; `uid → mismo uid`
es refresco de token y tampoco; `uid → null` es el fin de sesión; y **`uid → otro
uid`** también, que es el caso que el predicado ingenuo se comía —
`onAuthStateChanged` no garantiza pasar por `null` al cambiar de cuenta.

Devuelve si borró, y eso es lo que permite fijar el caso **y el borde** con tests de
comportamiento contra el almacén falso, sin montar el panel ni mockear Firebase. El
aserto de fuente queda solo para el enganche, y afirma la **llamada** con
`uidAnterior.current` de argumento. Verificado con tres roturas: la condición
ingenua, desenganchar el observador, y una función que dice que borró sin borrar.

**Dos cosas que quedan afuera y ahora están dichas en `07-seguridad.md`:** si la
sesión se corta con la pestaña cerrada no hay observador que lo vea —el aviso de
apertura es indistinguible del arranque normal—, y el borrado es por prefijo, o sea
de los borradores **de este navegador** y no «de los míos».

### B-204 · Los dos campos del generador de encuentros se leen como «cantidad» y «cantidad de días» — ✅ hecho (2026-08-26)

Reporte de un segundo admin cargando una feria (2026-08-26):

> Y no entiendo porque hay 2 opciones : cuándo pongo N de encuentros. Lo de
> cantidad y cantidad de días.

Las etiquetas son **«Cantidad»** y **«Cada (días)»** (`SesionesEditor.tsx`).
Puestas una al lado de la otra y leídas rápido parecen dos cantidades: cuántos
encuentros y cuántos días. La segunda no es una cantidad de días, es el **salto**
entre un encuentro y el siguiente (`cadaDias`, default 7 = semanal).

**Por qué vale la pena y no es cosmético:** el default de 7 hace que el caso de la
feria —varias jornadas seguidas— salga mal sin que nada avise. Pide 3 encuentros,
le genera uno por semana durante tres semanas, y eso llega al calendario público
como tres eventos en fechas equivocadas. El error es silencioso: las fechas son
válidas, solo no son las que quería.

**El arreglo es de etiqueta y texto**, no de lógica: «Cuántos encuentros» y «Cada
cuántos días», y el párrafo de abajo —que hoy explica que recalcula y borra temas—
puede decir el caso de un solo día de diferencia. Con eso, «una feria de tres días
seguidos» es Cantidad 3, Cada 1, y se entiende sin abrir nada.

Relacionado con **B-62** (el modal por sección con qué hace / qué impacto / un
ejemplo), que es el arreglo general del que este es el caso particular. Este se
puede hacer solo y hoy.

**Cómo quedó (2026-08-26).** «Cuántos encuentros» y «Cada cuántos días», y el
párrafo de abajo abre diciendo lo que faltaba: **«7 es una vez por semana; para
días seguidos —una feria de tres jornadas— va 1»**. El default no cambió: sigue en
7 porque semanal sigue siendo el caso común, y lo que cambió es que ahora se
entiende sin abrir nada.

Las tres cosas quedan fijadas en `tests/etiquetas-de-ui.test.ts`, con las etiquetas
viejas como aserto negativo. Y ese test enseñó de nuevo la lección de la semana:
la primera versión se puso roja **con el código correcto**, porque el comentario
que explica el cambio cita las etiquetas viejas y el aserto las encontraba en la
prosa. Lee el fuente sin comentarios.

### B-216 · El `auditor-privacidad` no conocía su propia quinta salida — ✅ hecho (2026-08-27)

`src/lib/textoRedes.ts` (B-95) es una salida pública desde que existe, y la más
irreversible de las cinco: un posteo pegado en Instagram ya está copiado. La ficha
del agente listaba **cuatro** salidas y no la incluía, ni en la tabla del cuerpo ni
—lo que importa— en su `description`, que es lo que decide si Claude lo invoca por
nombre de archivo. Idem `docs/13-agentes.md`.

**Por qué es un hallazgo y no un typo.** Ningún test fallaba, y no podía fallar:
`textoRedes.ts` está bien cubierto —`Pick` explícito, barrido de centinelas,
guarda de forma—. Lo que estaba roto era la **cadena de invocación**: un cambio
que agregara un campo e lo interpolara en el posteo no disparaba la auditoría, y
si alguien la corría por otro motivo, el índice que el agente usa para orientarse
no incluía la salida que debía mirar. Un auditor que no sabe que una puerta existe
es peor que no tener auditor, porque su «LIMPIO» se lee como cobertura.

**Cómo se encontró, que es la parte instructiva:** el mismo cambio que arregló
esto agregó la tabla de las cinco salidas a `docs/07-seguridad.md` y **se olvidó de
espejarla** en el agente. Lo detectó el `auditor-documentacion` auditando ese
cambio. O sea: la inconsistencia la creó a medias el arreglo, y la encontró otro
auditor del mismo trío.

**Regla que queda escrita** en `13-agentes.md` para la próxima salida nueva: son
**tres** lugares —el documento de seguridad, el cuerpo del agente y su
`description`— y el tercero es el que decide si el agente se entera.

### B-137 · `construirIssue` sanea campo por campo, no la salida armada · P2

**Este ítem existía solo dentro de un comentario de test.**
`tests/clases-de-bug.test.ts` tiene `it.fails('B-137: el saneador se aplica sobre
la salida, no en cada campo')` desde el 2026-08-24, con la clase explicada en su
docblock, y `grep -rn 'B-137' docs/` no devolvía nada. La regla de proceso del
`CLAUDE.md` —todo reporte de bug entra al backlog— no se cumplió. Lo detectó el
`auditor-documentacion` el 2026-08-27.

`redactar()` se aplica a `descripcion` y `pasos` de la **entrada**, en siete
llamadas, y no al `title`/`body` ya armados de `construirIssue`
(`functions/reportes.js`). Hoy no filtra: los cuatro valores que se cuelan sin
pasar por el saneador —`id` del reporte, `actividad.slug`, `reporte.actividad.id`
y `severidad`— son ids o enums acotados por `reporteValido()` en las reglas, y no
pueden traer un link. El punto es que la próxima interpolación no tiene por qué
serlo, y ya pasó una vez con el `title`.

Arreglo: mover `redactar()` a un único punto de paso obligado, sobre el
`title`/`body` armados, en vez de por campo de la entrada. Los dos `it.fails`
(B-81 y B-137) pasan a `it` solos.

### B-213 · Los tres `.env` versionados no tienen ningún gate · P2

`.gitignore` versiona `.env.development`, `.env.production` y `functions/.env`
como excepciones deliberadas y bien argumentadas: la config del SDK web es pública
por diseño y `functions/.env` solo lleva el ID del calendario y el repo de GitHub.
Verificado hoy: las tres solo tienen claves `PUBLIC_*` más `GOOGLE_CALENDAR_ID` y
`GITHUB_REPO`.

El problema es que **la única defensa es la memoria**, y es la puerta que publica
de la forma más irreversible que hay (un commit a un repo público). Todas las
otras puertas del proyecto tienen gate automático: `verificar-bundle.sh` como paso
bloqueante en los dos workflows, `build-credenciales.test.ts` recorriendo `src/`,
`ssr.external` en `astro.config.mjs`. Esta no.

El candidato concreto es `GOOGLE_CALENDAR_ICS_PRIVADO` (ver `07-seguridad.md`):
es un secreto y tiene forma de URL cómoda de pegar en un `.env`.

Arreglo: un `it` que lea los tres archivos versionados y exija que toda clave
matchee una whitelist (`^PUBLIC_`, más las dos excepciones nombradas a mano), y
que ningún **valor** matchee `private-[0-9a-f]{10,}`, `BEGIN PRIVATE KEY`,
`ghp_` ni `github_pat_`. Compara claves y formas, nunca imprime valores.

### B-214 · Astro 5.x no tiene parche para ocho avisos de seguridad: hay que subir a 6/7 antes de B-01 · P2

`npm audit --omit=dev` da 2 altas en dependencias de producción: ocho avisos de
Astro (instalado 5.18.2) más `sharp`, que viene de Astro. Los peores son un SSRF
de CVSS 7.5 (`GHSA-2pvr-wf23-7pc7`, fetch de la página de error prerenderizada) y
un XSS reflejado de 7.1 por nombre de slot sin escapar (`GHSA-8hv8-536x-4wqp`).

**Ninguno es explotable hoy**, y se verificó uno por uno: no se usa `define:vars`,
ni `transition:*`, ni `server:defer`, ni spread props en `.astro`, ni slots con
nombre, ni `set:html`; y `output: 'static'`, así que el SSRF —que necesita
runtime de servidor— no aplica. El sitio son tres páginas y un layout.

**Lo que hace que sea un ítem y no un «ignorar»: no hay parche en la 5.x.** Las
versiones corregidas son ≥6.1.6, ≥6.3.3, ≥6.4.6, ≥7.0.4 y ≥7.0.6 según el aviso.
Quedarse en 5 es quedarse con los ocho abiertos para siempre.

**Y el momento importa.** Conviene subir **antes** de construir el sitio público
(B-01), no después: B-01 va a interpolar datos de Firestore en HTML, y ahí varios
de estos pasan de teóricos a vivos — justo cuando el salto de mayor va a ser más
caro de probar, porque habrá más superficie que revisar. Hoy el blast radius del
upgrade son tres páginas.

`functions/` aparte: 10 moderadas, ninguna alta, todas transitivas de
`firebase-admin`/`googleapis`.

### B-215 · Tres duplicaciones chicas en producción y una en los tests · P2

Salidas del barrido de duplicación del 2026-08-27 (ventanas de 8 líneas
significativas idénticas entre archivos). Ninguna es urgente; van juntas porque se
arreglan en el mismo rato:

- **El `useEffect` de carga de actividades**, verbatim en
  `CalendarioActividades.tsx` y `ListaActividades.tsx`: el flag `vivo`, el
  `setCargando`, el `catch` que estrecha `unknown` a mensaje, el `finally`. Un
  `useActividades(version)` lo borra y le da un solo lugar al manejo de error, que
  hoy son dos.
- **`MESES`**, los doce nombres idénticos, en `calendarioPanel.ts` y
  `novedades.ts`, y en los dos para lo mismo (formatear el nombre de un mes).
- **La adopción de `tests/fixtures/` es de 7 archivos sobre 59.** Hay un
  `actividadCentinela` completo y lo usa **uno**; siete archivos definen su propio
  builder de actividad, con cuatro firmas distintas (`Record<string, unknown>`,
  `Partial<Actividad>`, `Partial<ActividadConId>`, tipos propios). No es que
  falte el fixture: está escrito y no se usa. Ver también B-211, que es la misma
  historia con el `ts()`.

**Lo que NO entra acá**, para que no se lo confunda con duplicación: los tres
componentes de chips (`TaxonomiaSelect`, `TagsInput`, `ChipsInput`) comparten
markup y **se dejan como están** — son tres widgets distintos y la lógica pura ya
se comparte (D-116).


### B-225 · Partir la key de CI en dos el día que el secret tenga más de un lector · P2

D-132 le dio a `deploy-ci@` los roles para desplegar reglas y Functions, y aceptó
por escrito lo que eso significa: una key filtrada **hace legible todo Firestore** y
puede desplegar código que corre como `calendar-sync@`. La decisión se apoya en un
hecho del proyecto de hoy: **el secret tiene un solo lector**, el dueño del repo.

**El disparador de este ítem es que eso deje de ser cierto.** Un colaborador con
push a `main`, un fork con Actions habilitado, un runner de terceros: cualquiera de
los tres multiplica los lugares desde donde esa key se puede usar, y ahí el balance
de la tabla de D-132 se da vuelta.

**Lo que hay que hacer cuando pase**, que es lo que B-194 ya proponía como forma
menos mala y no se hizo:

- **`build-ci@`** — `datastore.viewer` + `serviceusage.serviceUsageConsumer`. Es la
  que usa el build de Astro para leer Firestore. Sin permiso de deploy de nada.
- **`deploy-ci@`** — el resto de los roles, y su key **detrás de un `environment` de
  GitHub con required reviewers**, para que desplegar reglas o Functions pida una
  aprobación humana en vez de ser un efecto de cualquier push.

El costo es un secret más y un `environment` que configurar; el beneficio es que el
job que solo lee no cargue el alcance del que publica.

**Mientras tanto, lo que sí está**: la rotación documentada en
[`08-operacion.md`](08-operacion.md), con el paso de redesplegar las reglas desde el
repo ordenado segundo, y `tests/roles-deploy-ci.test.ts`, que impide que el
documento de seguridad vuelva a decir que el daño se limita a leer.

---

### B-231 · La home no ofrece suscribirse al calendario, y el bloque ya está escrito · P2

`/suscribirse` existe (B-230) y se llega por el encabezado. Lo que falta es el
enganche donde la decisión se toma de verdad: **abajo del listado**, cuando alguien
ya vio que hay actividades y quiere no perdérselas. Entrar a una página aparte para
suscribirse lo hace quien ya decidió; el resto necesita que se lo ofrezcan ahí.

**Está hecho el trabajo y falta la línea.** `src/components/sitio/SuscribirseResumen.astro`
es el bloque corto —el botón de Google y un enlace a la página entera— con su prop
`nivel` para que el encabezado cuelgue del `h1` del listado sin saltear un nivel. No
se cableó porque la home la construye otro frente y este no la tocó (D-134).

```astro
import SuscribirseResumen from '@/components/sitio/SuscribirseResumen.astro';
<SuscribirseResumen />
```

Queda P2 y no P1 porque la página funciona y es alcanzable desde las cuatro
secciones del sitio. Lo que se pierde mientras tanto es conversión, no acceso.

## P3 — cuando sobre tiempo

### B-202 · Dos asertos de `foco.test.ts` los satisface el `import` · P3

Los encontró el `auditor-privacidad` en el cierre de `1.2.0`, buscando otras
instancias de la clase que apareció ahí. `tests/foco.test.ts:97` y `:105`:

```js
expect(src).toContain('indiceDeTecla');      // MenuAcciones.tsx:3 es un import
expect(src).toContain('SELECTOR_ENFOCABLE'); // CentroAyuda.tsx:11 es un import
```

El `it` promete «navega con teclas» y «atrapa el Tab»; lo que verifica es que el
nombre **aparezca** en el archivo, y el import alcanza para eso. O sea que borrar
la llamada dejaría el test verde.

Es P3 y no más porque es más flojo que el caso de B-80: los asertos de al lado sí
afirman llamadas, y un import sin usar lo levanta el linter. El arreglo es
`toContain('indiceDeTecla(')` y
`toContain('querySelectorAll<HTMLElement>(SELECTOR_ENFOCABLE)')`, con el mismo
colapso de espacios que usa `tests/autoguardado.test.ts`.

**La lección general, que vale más que los dos asertos:** un test que lee un
fuente y busca un **nombre** no verifica nada — el import lo satisface. Tiene que
afirmar la llamada, la sentencia completa o un dato. Quedó anotada en
`13-agentes.md`, y se llegó a ella dos veces en el mismo cierre: primero en el
test de la guarda de B-80, y después **en el test escrito para arreglar eso**.

### B-200 · La guarda de forma del borrador no valida las fechas, y el autoguardado agranda la superficie · P3

Lo encontró el `auditor-trampas` en el cierre de `1.2.0`, y es **preexistente**:
`pareceFormulario()` (`lib/formulario/autoguardado.ts`) chequea que `titulo` sea
string y `sesiones` sea array, y el schema —en los dos niveles de D-120— pide que
`inicio`/`fin` sean no vacíos, no que sean fechas parseables. Un borrador con una
fecha corrupta pasa la validación y recién `formADocumento` tira
`Fecha inválida: "<lo tipeado>"`, que el `try/catch` de `guardarActividad` convierte
en un `{estado:'error'}`.

O sea: **falla visible, no dato corrupto**, y por eso es P3 y no bloqueó el push.

Lo que cambió con B-191 no es el bug sino su superficie: el autoguardado
institucionaliza formularios de hasta 30 días que nadie volvió a tocar, así que la
fecha corrupta ahora puede venir de un borrador viejo y no solo de un tecleo de
hace un minuto. El arreglo natural es que el `refine` de `sesionSchema` valide que
la fecha se pueda convertir —que es lo que `formADocumento` ya hace, o sea la
tercera copia de la misma regla si no se comparte (B-72, B-75)—.

### B-201 · El conteo de líneas de `10-salud-del-codigo.md` §1.3 quedó viejo · P3

Lo marcó el `auditor-documentacion` en el cierre de `1.2.0`. La tabla dice
`ActividadFormulario.tsx | 858 LOC | 258 LOC` y "6 módulos de dominio puros", y hoy
son diez módulos y el `.tsx` creció (B-184 y B-191 le sumaron el aviso, el
autoguardado y la navegación a los campos que faltan).

No se corrigió en el mismo cambio a propósito, por el mismo criterio que el conteo
de tests: **el número depende de la metodología del conteo original** —qué cuenta
como módulo de dominio, si el fan-out incluye los tipos— y ponerle un número
inventado es peor que dejarlo viejo, porque el viejo al menos se sabe viejo. Hay que
recontarlo una vez, con el criterio escrito al lado, y ahí sí se puede automatizar.

`04-funcionalidades.md` ya dejó de citar el número y ahora apunta a esa tabla.


### B-197 · El título de cada fila de material no muestra su error al lado del campo · P3

Apareció haciendo B-183/B-184. `material.items.N.titulo` es obligatorio al
publicar, pero `MaterialEditor` recibe un solo `error` —el de la lista— y no el
mapa completo, así que el rechazo de una fila puntual **solo** se ve en el
mensaje de la barra («Título del material») y no en rojo al lado del campo, que
es donde el resto del formulario lo muestra. Con dos filas cargadas y una sin
título, el mensaje no dice cuál de las dos.

Hoy no deja a nadie sin salida: la sección Material se abre sola al fallar el
guardado (B-184) y la fila vacía se ve. Pero es la única familia de campos del
formulario que no muestra su propio error, y el patrón que la mantiene así es que
el editor de filas no recibe `errores`. Lo barato es pasarle el mapa y que cada
fila lea el suyo con su índice — lo mismo que ya hace `SesionesEditor` con el
error de la lista, un nivel más abajo.

### B-198 · El aviso de «lo que falta para publicar» corre una validación por tecla · P3

También de B-184. `pendientesParaPublicar` es un `useMemo` sobre `form`, así que
cada tecleo dispara un `safeParse` de zod sobre el formulario entero. Es del
mismo orden que el `JSON.stringify` que ya corre en cada tecla para saber si hay
cambios sin guardar (`useFormularioSucio`) y para el autoguardado, así que hoy no
se nota — y en un teléfono viejo con un ciclo de 20 encuentros es lo primero que
se notaría.

No se optimizó por adelantado a propósito: medir primero. Si hay que bajarlo, lo
barato es el mismo debounce que usa el autoguardado, porque el aviso no necesita
estar al día con la última letra.

### B-169 · Los tests de integración de aprobación fallaron una vez en una corrida completa · P3

Corriendo `npx vitest run` entero, tres tests de
`tests/opciones.integracion.test.ts` fallaron —«aprobar dos veces no rompe nada»,
«--listar muestra las pendientes y solo esas» y «--backfill hace explícito ese
default»— y el mismo archivo corrido solo pasó, y la corrida completa siguiente
también. O sea: **flaky, no roto**.

Los tres son los que ejecutan `scripts/aprobar-opciones.mjs` de verdad contra el
emulador (`execFileSync`), así que la sospecha es la interacción entre el script
—que abre su propia app de firebase-admin— y el estado que dejan los otros
archivos de integración. `fileParallelism: false` ya está puesto, así que no es
paralelismo de archivos.

Vale la pena porque un test que falla una de cada N corridas enseña a ignorar el
rojo, que es lo único peor que no tener el test. Primer paso: correr la suite en
loop unas cuantas veces para ver cada cuánto pasa y con qué vecino.

### B-114 · Precio real en los datos estructurados

`arancel.tipo` es un slug de taxonomía, no un monto, así que el `offers` del
JSON-LD puede decir "a la gorra" pero no un precio. Google muestra el precio en
el resultado enriquecido cuando lo tiene, y en un taller arancelado eso es
información que la gente quiere antes de escribir.

Hace falta un campo de monto en el modelo (`arancel.monto` + moneda, `ARS`),
opcional y solo para los tipos que lo tengan. Mientras no exista, la regla del
diseño (§5.3) es **no emitir precio salvo `gratis`**: un `0` en un taller pago es
un dato falso en un formato que las máquinas creen.

Es P3 porque `arancel.tipo` ya comunica lo esencial —y en la mitad de los casos
del circuito es "a la gorra", que no tiene precio que publicar.

### B-33 · Las etiquetas de GitHub hay que crearlas una vez

El issue se crea con `reporte-panel` y `bug`/`sugerencia`. GitHub crea las
etiquetas que no existan, pero sin color ni descripción. Crearlas a mano una vez
(los comandos están en [`08-operacion.md`](08-operacion.md)) deja la lista
prolija y filtrable.

### B-34 · Nada limita cuántos reportes se pueden cargar

Las reglas validan la forma del reporte y que quien lo carga sea admin, pero no
la frecuencia: cien reportes son cien issues y cien invocaciones. Con dos
cuentas de confianza no es un problema real; si alguna vez se le da el panel a
más gente, conviene un tope por autor y por día.

**Mirado en la fase 4 y dejado sin hacer, a propósito (2026-08-24).** El tope
vive en `firestore.rules`, que no es propiedad de este frente, y no hay ninguna
forma de escribir la red de contención antes que la regla: un test no puede
frenar un límite que no existe. Además la forma del límite es una decisión, no
una implementación — hay dos y no dan lo mismo:

- **por autor y por día**, contando con una query en la regla (`allow create if
  ...`): Firestore no puede contar documentos dentro de una regla, así que pide
  un contador escrito por el propio cliente (`/reportes-contador/{uid}-{fecha}`)
  y una regla que lo obligue a incrementarse de a uno. Es el patrón estándar y
  es feo pero funciona sin Function;
- **en la Function**, cortando en `decidirAccion` cuando el autor pasó el tope
  del día. No frena la escritura del reporte (que es lo que garantiza no
  perderlo, ver el encabezado de `reportes-trigger.js`), frena el **issue**, que
  es el efecto caro.

La segunda es más barata y más alineada con el diseño de reportes: el reporte se
guarda igual y lo que se limita es la salida a GitHub. Necesita decisión del
dueño sobre el tope. Toca `functions/**`, o sea la fase 1.

### B-10 · `aprobada` en las opciones (§4.3) — ✅ hecho (2026-08-21)


Las opciones creadas con "Otro" nacen pendientes: funcionan para quien las creó
y no aparecen en el desplegable de las demás cuentas hasta aprobarlas. Se aprueba
con `scripts/aprobar-opciones.mjs`. Decisiones: D-26 a D-30. Lo que quedó
abierto está en B-25 a B-29.

### B-11 · Duplicar una actividad entera — ✅ hecho (2026-08-21)

Menú "⋯" por fila en el listado, con "Duplicar", que abre el formulario
precargado con una copia. La copia rehace los ids de sesión, pone
`calendarEventId` en `null`, propone slug nuevo, arranca en borrador y corre las
fechas en semanas enteras.

Ver [CHANGELOG](CHANGELOG.md), D-17, D-18 y D-19. Lógica en
`src/lib/duplicar.ts`, tests en `tests/duplicar.test.ts`.

### B-12 · Vista previa de cómo queda el evento — ✅ hecho (2026-08-21)

### B-45 · Los links cortos de Maps (`maps.app.goo.gl`) no se pueden pegar

El campo de coordenadas (D-46) acepta el link largo y el par `lat, lng`, pero no
el link corto del botón "Compartir", que es justo el que ofrece la app de Maps
en el teléfono. Es un redirect y seguirlo desde el navegador lo bloquea CORS.

Hoy el campo lo detecta y explica que hay que abrirlo para copiar el link largo.
Si molesta seguido, la salida es una Function que siga el redirect y devuelva la
URL final — otro endpoint y otro deploy, así que no se hizo de entrada.

### B-13 · El schedule de `dispararRebuild` no reintenta con backoff

Sección colapsada al final del formulario: título, ubicación y descripción del
evento para el encuentro que se elija, armados con `construirEvento` de
`functions/calendario.js` —la misma función que publica el evento (D-20)—, así
que no puede divergir de lo que sale. Ver el
[changelog](CHANGELOG.md) y [`04-funcionalidades.md`](04-funcionalidades.md).


Quedó afuera, y no parece necesario: un botón para copiar la descripción, y
mostrar `start`/`end` (el formulario ya muestra las fechas al lado).

~~B-13 · El schedule de `dispararRebuild` no reintenta con backoff~~ →
[cerrado](#cerrados).

### B-14 · El menú de acciones del listado no se navega con flechas — ✅ hecho (2026-08-24)

`MenuAcciones` cierra con `Escape` y con un click afuera, y sus ítems son
`<button role="menuitem">` alcanzables con Tab, pero no implementa el patrón
completo de menú ARIA (flechas arriba/abajo, foco que vuelve al disparador al
cerrar). Con dos ítems alcanza; si el menú crece, conviene completarlo.

### B-25 · Aprobar taxonomías desde el panel — ✅ hecho (2026-08-24)

**Hecho** junto con B-06, como decía el ítem: botón "Aprobar" en la fila, sobre
`aprobarOpcion` (transaccional, rechaza las `fijo`). Ya no hace falta una máquina
con Node y `gcloud`.

**Ojo:** con B-131 nada nace pendiente, así que hoy esto solo alcanza a lo que
quedó pendiente antes de esa decisión (D-104). Es la maquinaria dormida, y se
deja lista a propósito.

**Cómo quedó, y por qué antes de que el menú creciera.** Se hizo junto con el
tercer punto de **B-64** (la capa de ayuda no atrapaba el foco) porque son la
misma clase vista en dos pantallas: un patrón de teclado a medio hacer. La
aritmética —dónde cae el foco al pasarse del último, qué tecla mueve a dónde—
salió a `src/lib/foco.ts`, pura y con tests; el DOM queda en cada componente.

El menú tiene ahora ↓/↑ con vuelta, `Home`/`End`, se abre con ↓ o ↑ cayendo en el
primero o el último, y **devuelve el foco al "⋯" al cerrarse con `Escape`** — sin
eso había que re-tabular el listado entero para volver a la fila donde se estaba,
que es lo que hacía inservible el `Escape`. La capa de ayuda cicla el Tab y
devuelve el foco a lo que estaba enfocado antes de abrirla.

Un bug que apareció escribiendo la cuenta: tratar "ninguno enfocado" como el
índice `-1` a secas hacía que ↑ cayera en el **penúltimo**. Con dos ítems —los
que el menú tiene hoy— el resultado parece razonable, así que habría entrado sin
que nadie lo viera.

### B-26 · Nadie se entera de que hay algo para aprobar — ✅ hecho (2026-08-24)

**Hecho a medias, y la mitad que falta es de otro frente.** La pantalla de
taxonomías muestra arriba cuántas etiquetas esperan aprobación, y
`usePendientesDeAprobacion()` (en `useOpciones.ts`) deja el número listo para la
**cabecera** del panel, que es lo que pedía el ítem — pero la cabecera vive en
`AdminApp.tsx`. Va con B-170.

Con B-131 el contador da 0 salvo por lo viejo (D-104).


Una etiqueta pendiente queda invisible para la otra cuenta y **no hay ningún
aviso**: si nadie corre `--listar`, la etiqueta puede quedar pendiente para
siempre y las dos personas terminan creando dos slugs para lo mismo (justo lo
que el §4.2 evita).

Mínimo útil: un contador de pendientes en la cabecera del panel. Cuadra con
B-25.

### B-27 · El `events.json` tiene que publicar solo las opciones aprobadas — ✅ hecho (desde B-212, 2026-08-25)

`opcionesPublicas` en `toPublic.ts` arma `opciones.*` con
`opcionesVisibles(valores)` **sin uid**, que devuelve exactamente las aprobadas, y
lo fija el barrido de `/opciones/*` en
`tests/barrido-de-salidas-publicas.test.ts` —incluido el caso de la opción `fijo`
con `aprobada: false`, que no puede desaparecer de los filtros—. **Quedó sin marcar
al cerrar B-212**; lo encontró el `auditor-documentacion` durante B-227.

Y el matiz que B-227 tuvo que resolver, porque este ítem no lo anticipaba: filtrar
lo **elegible** es correcto para los chips, pero **no** para resolver la etiqueta de
un slug que una actividad ya tiene guardado. Son dos mapas distintos — ver D-30 y
la tabla de [`07-seguridad.md`](07-seguridad.md).

El texto original decía «parte de B-01, el sitio público, que todavía no existe».
El sitio existe desde B-227.

### B-28 · ¿Claim `curador` para aprobar? — decisión del dueño

Hoy cualquiera de las dos cuentas con claim `admin` puede aprobar (D-28), y las
opciones nuevas nacen pendientes **incluso las del dueño**, porque el código no
distingue dueño de admin.

Si el dueño quiere ser el único que valida, o que lo suyo nazca aprobado, hace
falta un claim aparte (`curador`) y mover la aprobación a un campo o documento
propio para que las reglas puedan verificarla — hoy no pueden, porque `valores`
es un array de maps y no se puede comparar elemento por elemento.

No se implementó por cuenta propia: cambia el modelo de permisos.

### B-29 · ¿Auto-aprobar una etiqueta que reusa una segunda cuenta? — decisión del dueño

Si la cuenta B tipea en "Otro" una etiqueta que ya existe como pendiente de la
cuenta A, hoy se reusa el slug (bien, §4.2) pero la opción **sigue pendiente**:
dos personas la usan y ninguna la ve en su desplegable.

Que dos cuentas distintas la usen es buena señal de que es vocabulario real, y
aprobarla ahí sería automático y barato. Contra: aprueba sin que nadie mire, y
alcanza con que la segunda persona repita el mismo typo.

### B-57 · El abandono por cierre de pestaña se pierde si el SDK no cargó

`formulario_abandonado` se dispara también en `pagehide`, pero el SDK de
analítica se carga diferido (D-58): si alguien abre el panel y cierra la pestaña
antes de que arranque, ese evento se encola y muere con la página.

El camino que importa —"Cancelar" / "← Volver"— no sale de la página y se mide
bien. Si el número de abandonos parece bajo, esta es la primera sospecha.
Arreglarlo bien pide `sendBeacon` contra el Measurement Protocol, que es bastante
más máquina de la que amerita.

### B-58 · Dos interacciones sin medir, por no tocar el JSX

Marcar un encuentro como **cancelado** y tildar **"publicar el link de la
reunión"** están en `onChange` inline dentro del JSX, y medirlas exigía
reacomodar el markup de componentes que otros cambios están tocando. Se dejaron
afuera a propósito.

`url_publica` se mide igual en `guardado_ok`, que es el dato que importa. La
cancelación de un encuentro no se mide en ninguna parte.

Tampoco está el **embudo fino** del formulario (qué campo se tocó último antes de
abandonar): eso pide instrumentar 30+ inputs o un `onFocus` a nivel del `<form>`,
y hoy `formulario_abandonado.faltantes` da la ubicación gruesa sin tocar nada.

### B-59 · La instrumentación suma 2.8 KB gzip al chunk del panel — ❌ descartado (2026-08-24)

El SDK de analítica está diferido y no toca el chunk inicial (D-58); la
proyección y la taxonomía sí. La propuesta era moverlas al lado diferido y dejar
que `medir()` encole los valores crudos.

**Medido primero** (cierre estático de imports de `/admin`, el build real contra
el mismo build con la instrumentación en no-ops):

| | raw | gzip |
|---|---|---|
| Carga inicial de `/admin` hoy | 386.303 B | 107.590 B |
| Sin ninguna instrumentación | 377.245 B | 104.464 B |
| Toda la instrumentación | 9.058 B | 3.126 B (2,9 %) |
| **Solo la taxonomía + la proyección** | **6.522 B** | **2.188 B (2,0 %)** |

O sea que el techo de lo que este ítem podía ganar es **2,14 kB gzip**: el 2,0 %
de la carga inicial comprimida, el 1,7 % de la cruda. (El número viejo, 2.8 KB,
medía toda la instrumentación, no la parte que se iba a mover.)

**Se descarta con ese número.** Hoy la proyección es un único portón sincrónico:
`medir()` proyecta **antes** de encolar, así que lo que espera en la cola —hasta
30 eventos si el SDK no cargó, o nunca carga porque un ad blocker lo bloquea— son
payloads ya sanitizados. Del otro lado, la cola guardaría los valores **crudos**:
contenido del formulario en memoria, y la propiedad que hace valer a los 11 tests
de `analytics-privacidad.test.ts` pasaría a depender de dos pasos en vez de uno.
2,14 kB gzip no paga eso, y si el bundle necesitara kilobytes hay 34,5 kB de SDK
y 186 kB de runtime de React antes en la fila. Ver **D-99**.


---

### B-60 · Ayuda dentro del panel — ✅ hecho (2026-08-21)

Botón "Ayuda" en el encabezado, que abre una capa con la guía: los seis avisos
de lo que no se puede deshacer y un capítulo por sección del formulario, más el
recorrido de una actividad, el listado, las listas que crecen y la carga desde
el teléfono. Contenido en `src/lib/ayuda.ts`, tests en `tests/ayuda.test.ts`.

Ver [CHANGELOG](CHANGELOG.md), D-61 y D-62. Lo que quedó afuera está en B-62 y
B-63.

### B-61 · Historial de novedades del panel — ✅ hecho (2026-08-21)

Pestaña "Novedades" en la misma capa, con "qué podés hacer ahora que antes no
podías" en el idioma de quien carga actividades. Contenido en
`src/lib/novedades.ts` (en el repo, se despliega con el build: D-63), lo no
leído se marca con el id de la última vista en el navegador (D-64), y el aviso
es un número en el botón.

Ver [CHANGELOG](CHANGELOG.md), D-63, D-64 y D-65. Limitaciones en B-64.

### B-64 · Pendientes chicos del centro de ayuda — ✅ hecho (2026-08-24)

Tres cosas conocidas, ninguna urgente. **Dos quedaron cerradas**; la del medio no
es trabajo pendiente sino un costo aceptado en D-63, así que el ítem cierra acá:

- ~~**Las novedades no se anclan a la versión del panel.**~~ ✅ hecho
  (2026-08-24). Mostrarla ya se mostraba; lo que faltaba era **de dónde sale**, y
  esa era la razón de que el campo quedara vacío: `VERSION_APP` incluye el
  `+<sha>` del build, que quien escribe la entrada no puede saber. La versión de
  una novedad es la de `package.json` —la release en la que entra—, y eso quedó
  escrito en el tipo, en el paso 4 del skill `cerrar-cambio` (que era el que
  decía "si se sabe" y por eso nunca se llenaba) y en dos tests: la forma, y que
  no retroceda al bajar por la lista.
- **No se puede corregir una errata ni avisar nada sin desplegar** — costo
  aceptado en D-63. Si algún día hace falta un aviso urgente (una caída), es
  otro problema y otra herramienta.
- ~~**La capa no atrapa el foco.**~~ ✅ hecho (2026-08-24), junto con B-14, que
  era la misma clase en otra pantalla: la capa cicla el Tab sobre sus propios
  controles y devuelve el foco a lo que estaba enfocado antes de abrirse. Ver
  `src/lib/foco.ts`.

### B-100 · Prellenar sede, organizador e inscripción desde lo ya cargado

Extender el patrón del §4 para que elegir "Casa Brandon" complete nombre,
dirección, barrio, ciudad, indicaciones y coordenadas; y lo mismo con el
organizador y su Instagram, y con el canal de inscripción.

**Está en P3 a propósito, y con una condición.** Compite con "Duplicar" (B-11),
que ya resuelve el caso repetitivo real de este circuito —el ciclo del año pasado
con otras fechas— y lo resuelve para los 30 campos, no para tres. Lo que quedaría
es "tres talleres distintos en la misma sede", que existe y es menos frecuente.

Costo escondido: el §4.1 guarda **solo el slug** para que renombrar no toque
documentos, y con una sede eso no sirve (si la sede se mudó, la actividad del año
pasado no debe cambiar de dirección). La actividad tendría que guardar una
**copia** del objeto — segunda fuente de verdad, y el problema de B-04
multiplicado.

Vale la pena **si los datos dicen que las sedes se repiten**, y hoy nadie lo
mide. El vocabulario del §9 puede contestarlo antes de escribir una línea.

### B-101 · Las actividades que ya pasaron no se archivan en ninguna parte

No hay estado para "terminó". Un taller de marzo sigue `publicado` con todas sus
sesiones en el pasado: se mezcla en el listado del panel (ordenado por última
modificación) y, cuando exista el sitio, hay que decidir si aparece.

No hace falta un estado nuevo: se deriva de la última sesión. Lo que hace falta es
decidir qué hacen con eso el listado del panel (¿una pestaña "pasadas"? ¿un
filtro?) y el sitio (¿no las lista pero conserva la página por SEO, que es
probablemente lo correcto?). Cuadra con B-96 y con B-01.

### B-102 · ¿El sistema guarda algo de quien se inscribe? — decisión del dueño

Recomendación: **no**, y queda anotado para que la pregunta no vuelva a aparecer
sin el razonamiento.

Hoy el sistema **no guarda ni un dato personal de un tercero**, y por eso el §5
cabe en una tabla y el §7 se verifica de un pantallazo. Una lista de inscriptos
mete nombres y teléfonos de gente que no usa el sistema, y a partir de ahí la
privacidad, la retención y el borrado pasan a ser responsabilidad del proyecto.

Los tres casos que la pedirían tienen salidas más baratas: el conteo lo resuelve
B-97 con un booleano; el aviso de cancelación lo resuelve B-98 por el calendario,
sin guardar nada de nadie; y la conversación ya vive en el DM, que es donde
además se contesta. Copiarla a mano al panel es trabajo nuevo, y una lista
copiada a mano queda incompleta el primer día ocupado.

Si algún día hace falta, el orden es al revés del intuitivo: primero el aviso
público (B-98), después el estado agregado (B-97), y la lista de personas solo si
eso no alcanzó. Detalle en
[`11-ideas-de-producto.md`](11-ideas-de-producto.md).

### B-77 · `functions/index.js` es el único archivo de `functions/` sin el corte puro/trigger

327 LOC con seis responsabilidades: init de `db`, auth de Calendar, carga de
labels, marcado de rebuild, dos triggers (`syncCalendar`, `rebuildPorOpciones`),
el schedule `dispararRebuild` y un cliente HTTP de GitHub (líneas 239-263).

El resto de `functions/` sí tiene el corte que
[`05-patrones.md`](05-patrones.md) prescribe: `calendario.js`, `rebuild.js`,
`historial.js` y `reportes.js` son puros (877 de las 1.502 LOC) y concentran los
tests más densos del repo; `historial-trigger.js` y `reportes-trigger.js` son los
wrappers. `index.js` quedó afuera, y es el archivo de 327 LOC **sin ningún test**.

Ya se cobró una: el cliente de GitHub se duplicó sin el timeout (B-74). Extraer
`functions/github.js` puro con `fetch` inyectable y mover `syncCalendar` a
`calendario-trigger.js` es medio día y no hay diseño nuevo que discutir — el
patrón se usa cinco veces en el mismo directorio.

**No mover la copia de `CAMPOS_TAXONOMIA` de la línea 84 a `src/`:** `functions/`
se despliega con su propio `package.json` y no puede importar hacia arriba
(D-20 lo evaluó y descartó). Si molesta, la respuesta es un test que compare las
dos listas.

### B-78 · El 26 % de `src/lib/` es prosa, no lógica

`ayuda.ts` (616 LOC de guía) y el array `NOVEDADES` (175 de las 300 LOC de
`novedades.ts`), más `opciones-base.json`, son 937 LOC de **contenido
editorial** conviviendo con un `slugify.ts` de 13 líneas. Se editan cuando cambia
la funcionalidad, no cuando cambia la lógica, y son los archivos #2 y #6 más
grandes del repo por eso.

Mover el contenido a `src/contenido/` y dejar en `novedades.ts` solo las cuatro
funciones (`novedadesNoLeidas`, `leerVisto`, `guardarVisto`, `fechaLegible`) hace
que el ranking de tamaño vuelva a hablar de código. Es cosmético: no cambia
comportamiento ni destraba nada, por eso es P3.

Que el contenido viva en el repo y no en Firestore es decisión cerrada (D-63) y
que sea data tipada y testeada también (D-62). Esto es solo dónde vive el
archivo.

### B-79 · Partir el JSX de `ActividadFormulario` en componentes por sección — ✅ hecho (2026-08-24)

Después de B-70 el archivo queda en ~630 LOC, todas de JSX: nueve `<Seccion>`
en un solo `return`.

| Sección | Líneas | Aprox. |
|---|---|---|
| Qué es | 286-363 | 78 |
| Encuentros | 364-385 | 22 |
| Dónde | 386-515 | 130 |
| Quién | 516-593 | 78 |
| Arancel e inscripción | 594-693 | 100 |
| Material / Opcional / Difusión / Vista previa | 694-858 | 165 |

Vale por la superficie de conflicto: es el segundo archivo más tocado del repo
(9 de 41 commits) y en este proyecto ya se commitearon marcadores de conflicto
que sobrevivieron dos commits
(`tests/sin-marcadores-de-conflicto.test.ts`). Conviene hacerlo cuando no haya
ramas abiertas, y habilita además B-62 (el "?" por sección, que hoy exige tocar
`ActividadFormulario.tsx` en nueve lugares).

**Hecho (D-104).** Diez archivos en `src/components/admin/formulario/`: las
nueve secciones, la barra de acciones, el tipo de props común y el vocabulario
de etiquetas de la UI. El JSX se movió verbatim —las props se llaman igual que
las variables que tenían adentro—, así que el diff no esconde ningún cambio de
comportamiento. `ActividadFormulario.tsx` quedó en ~230 LOC: estado, cascadas,
guardado y el orden de las secciones.

Costo: +583 B en la carga inicial de `/admin` (+0,15 %), mismos 4 chunks.

Dos tests que leían el `.tsx` como texto se arreglaron en el mismo cambio
(`ayuda` y `opciones-orden`): ahora leen el directorio, y el de `opciones-orden`
verifica primero que **encontró** el campo, porque un `not.toContain` sobre un
string vacío pasa sin haber mirado nada.

> Este párrafo estuvo pegado por error al final de **B-175** entre la
> renumeración B-167→B-175 y el 2026-08-27. Volvió acá.

### B-174 · Los tests de reglas verifican el `firestore.rules` del checkout equivocado · P2

El emulador sirve las reglas **del directorio desde el que se lo arrancó**, no las
del checkout donde corren los tests. Con un solo repo no se nota. Con varios
worktrees en paralelo —que es cómo se está trabajando este backlog— un test de
reglas puede estar verificando el archivo de otra rama y **dar verde sin haber
probado el cambio**. Es el modo de falla más caro que tiene un test de reglas:
dice "las reglas pasaron" cuando quiere decir "unas reglas pasaron".

Se descubrió haciendo B-31: el emulador estaba levantado desde el checkout
principal, así que la regla nueva no existía para los tests de la rama que la
agregaba. La salida ya está escrita —`cargarReglas()` en `tests/emulador.ts`
empuja el archivo local por la API del emulador— y la usa
`tests/reportes-reintento.integracion.test.ts`.

**Lo que falta** es que la usen los otros tres archivos de integración
(`reportes`, `actividades`, `opciones`), que hoy siguen dependiendo de dónde se
arrancó el emulador. Es una línea en cada `beforeAll`. Se dejó afuera de B-31 a
propósito: tocar los tres archivos a la vez pisa a los otros frentes, y el
`EXIGIR_EMULADOR=1` del CI ya arranca el emulador en el checkout correcto.

Ojo con el efecto compartido: `cargarReglas` cambia las reglas del emulador
**para todos** los tests que estén corriendo contra él. Con un solo checkout es
inocuo; corriendo dos suites en paralelo, la última que carga gana.

### B-175 · El formulario y el listado tienen cada uno su vocabulario de etiquetas · P3

Residual de **B-76**, y la parte que era la causa y no el síntoma. El listado ya
usa `ETIQUETA_ESTADO` de `src/lib/filtrosActividades.ts`, pero
`ActividadFormulario.tsx:71-78` mantiene sus tres mapas propios
(`ETIQUETA_ESTADO`, `ETIQUETA_MODALIDAD`, `ETIQUETA_VIA`).

Ya divergieron: para `modalidad: 'hibrido'` el formulario dice **"Híbrido"** y el
desplegable de filtros dice **"Presencial y virtual"**. Las dos pantallas están a
un clic de distancia y hablan del mismo valor guardado.

El arreglo es el `src/lib/etiquetas.ts` de ~20 LOC que proponía B-76 —con los
mapas de `estado`, `modalidad` y `via`— del que tiren las dos pantallas. **No se
hizo ahora porque toca `ActividadFormulario.tsx`**, que es de la fase 2 del
saneamiento. `tests/etiquetas-de-ui.test.ts` tiene el `it.fails` que se vuelve
`it` el día que se cierre.

Ojo con lo que **no** entra: los `ETIQUETA_*` de `functions/calendario.js` son
prosa del evento público, no etiquetas de UI (el motivo, en B-76).

> **Nota de edición (2026-08-27).** Acá abajo estaba pegado un párrafo que
> empezaba «**Hecho (D-104).** Diez archivos en
> `src/components/admin/formulario/`…» y que **es el cierre de B-79**, no de este
> ítem: `git log -S` lo ubica escrito junto a B-79 en el commit que partió el JSX
> del formulario. Se perdió de allá y apareció acá durante la renumeración
> B-167→B-175. Efecto mientras duró: **B-175 se leía como cerrada estando
> abierta** —su `it.fails('las modalidades coinciden')` sigue en rojo— y B-79
> quedó sin su cierre. El párrafo volvió a B-79.

### B-165 · `analytics-privacidad.test.ts` tiene su propia copia de `FORMATO_VERSION` · P3

La tercera copia del formato de versión está en el test de privacidad
(`tests/analytics-privacidad.test.ts:60`), que la usa como predicado de
admisibilidad: un string que matchea el formato se acepta como valor de
parámetro. B-88 amplió el formato real y **no** tocó esa copia, así que hoy es
estrictamente más angosta que la del código.

**No es una fuga y no puede volverse una**: al ser más angosta, lo único que
puede hacer es rechazar un valor que el código sí acepta, o sea dar una falsa
alarma. Hoy ni eso, porque ningún caso del test mete una versión válida en el
payload. El arreglo es importar `FORMATO_VERSION` de `@/lib/analytics-eventos`,
que ya se exporta, y borrar la copia.

No se hizo junto con B-88 a propósito: ese cambio tenía que dejar los 11 tests de
privacidad en verde **sin tocarlos**, que es la única forma de que la garantía
signifique algo.

### B-166 · Un build sin versión estampada es indistinguible de un formato inválido · P3

`VERSION_APP` vale `'desconocida'` cuando no hay versión estampada (dev server,
tests), y el sanitizador lo manda como `'otro'` — el mismo valor que usa para "el
formato no lo reconozco". Después de B-88 el segundo caso no debería ocurrir
nunca, así que un `version: otro` con volumen es una alarma… que hoy se confunde
con el ruido de dev.

Es chico y es de datos, no de código: en dev no se mide (`PUBLIC_USE_EMULATORS`),
así que en producción no debería haber ninguno de los dos. Si algún día se quiere
usar `otro` como alarma, `'desconocida'` tiene que ser un valor propio del
vocabulario en vez de caer en la bolsa.

### B-172 · La trampa 7 del §13 no tiene ningún test · ✅ hecho (2026-08-27)

**Cerrado como efecto de B-208, y vale anotar cómo.** Este ítem decía que faltaba
escribir la query de colección en el test de reglas, y era cierto. Lo que no
decía —porque nadie había mirado esa mitad— es que la query **con** el `where`
pasaba y devolvía los documentos crudos: no era una trampa sin red, era una fuga
abierta. Arreglar la fuga (D-128) obligó a escribir exactamente los dos `it` que
este ítem pedía.

El texto original queda abajo sin tocar, porque la parte mejor razonada es la que
salió mal: «muerde el día de la primera lectura en vivo, que es justo cuando
nadie se va a acordar del §5.3». Eso justificó postergarlo, y era falso — la
trampa se podía ejercitar **ese mismo día**. Lo que faltaba no era esperar a
B-01, era mirar la misma regla desde el otro lado.

---

Salió de armar el mapa de B-119, que la calcula en vez de suponerla: de las
trampas del §13, la 7 —query pública sin `where('estado','==','publicado')`— es
la única que quedó sin red.

`tests/actividades.integracion.test.ts` cubre las reglas **por documento** (un
anónimo lee lo publicado, no lee un borrador). La trampa habla de otra cosa: con
`allow read` condicionado a `resource.data`, una **query de colección** sin el
`where` se rechaza **entera** en lugar de devolver el subconjunto visible. Es un
modo de falla de la consulta, no del documento, y hoy no hay ninguna query de
colección en el test de reglas.

Casi no muerde mientras el público lea el `events.json` estático (§2.5). Muerde
el día de la primera lectura en vivo del sitio público (B-01), que es justo
cuando nadie se va a acordar del §5.3 — o sea, el peor momento posible.

Son dos `it` en el test de reglas: una `getDocs(collection(db,'actividades'))`
anónima que tiene que rechazarse, y la misma con el `where` que tiene que
devolver solo lo publicado. Toca un test que no es de la fase 4.

### B-171 · El detector de triggers blindados dejó de ver las guardas mudadas a helpers — ✅ hecho (2026-08-24)

> **Numeración:** en la consigna de la fase 4 este ítem se llamó "B-166", pero
> ese número ya estaba tomado por lo de la versión sin estampar. Es B-171.

El chequeo de la clase de B-82 en `tests/clases-de-bug.test.ts` estaba en
`it.skip`. Causa: después del refactor de B-77 el efecto y la guarda de los
triggers viven en helpers, y el detector los buscaba en el cuerpo del trigger.
Dos consecuencias, y la segunda no la había visto nadie:

1. `guardarVersion` y `guardarVersionAlBorrar` dejaron de contar como triggers
   con efecto (su `.set()` se mudó a `guardar()`), así que no había dos
   blindados que contar y el test hubo que apagarlo;
2. `syncCalendar`, que **ya estaba blindado** (B-82 cerrado: `idDeEvento` dentro
   de `crearEvento`), seguía contándose como desguarnecido, así que el
   `it.fails` de B-82 seguía fallando mucho después de que el bug estaba
   arreglado. **Un detector ciego no solo pierde regresiones: también miente
   sobre lo que sigue roto.**

Arreglado siguiendo la llamada (D-102) y con nueve tests del propio detector
contra cuerpos sintéticos, que es lo que faltaba la primera vez. El `it.skip`
volvió a `it` y el `it.fails` de B-82 pasó a `it`.

### B-173 · `npx tsc --noEmit` sale con doce errores de `ImportMeta` · P3

Verificación de la fase 4: `npx tsc --noEmit` termina con doce
`Property 'env' does not exist on type 'ImportMeta'` en `src/lib/analytics.ts`,
`src/lib/firebase-client.ts` y `src/lib/version.ts`. Es ruido conocido —faltan
los tipos que genera `astro sync` (`.astro/types.d.ts`, que no está versionado)—
y el código está bien.

Es P3 porque no rompe nada, y no es cosmético: **el comando de verificación que
usan todos los frentes sale siempre en rojo**, así que un error nuevo de verdad
se esconde entre los doce y nadie lo ve. Se arregla con un `astro sync` antes del
`tsc` en `scripts/verificar-todo.sh` y en el CI, o versionando el
`env.d.ts` con el `/// <reference types="astro/client" />`.

No entró en la fase 4 porque `scripts/verificar-todo.sh` lo corren los cuatro
frentes ahora mismo y tocarlo era pedir un conflicto en el archivo que todos
usan para verificar.

**Y no se descarta mirando `main`, donde sale limpio.** Sale limpio ahí porque
`.astro/` ya está generado en ese directorio de hace rato. Los doce errores
aparecen donde `.astro/` no existe todavía: un **worktree recién creado**, un
clone fresco y **el CI** — o sea, exactamente los tres lugares donde el comando
se corre para decidir algo. Un hallazgo que solo se reproduce en el entorno
limpio es más grave, no menos.

### B-176 · Regenerar los encuentros borra los temas y las lecturas cargados — ✅ hecho (2026-08-26)

`generarSesiones` devuelve `tema: ''` y `lectura: ''` en todas las filas, así
que volver a generar las fechas de un club de lectura de ocho encuentros borra
las ocho lecturas asignadas — que es lo más caro de tipear de toda la actividad.
Pasaba desde siempre (el generador reemplazaba la lista entera) y por eso no es
una regresión, pero después de D-103 la fila **conserva su identidad**: el
encuentro 3 sigue siendo el encuentro 3, con su evento de calendario, y perder
su tema dejó de tener sentido.

Es una línea al lado de las dos que ya heredan `id` y `calendarEventId`. Lo que
hay que decidir antes es si conservar el tema es lo que espera quien aprieta el
botón: hoy el cartel dice explícitamente que los borra. Sale con la UI, no
suelto.

El caso que lo hace doler: el ciclo se corre una semana, se regeneran las fechas
y hay que volver a tipear ocho lecturas que no cambiaron.

**Cómo quedó (2026-08-26).** El generador recalcula **solo las fechas**: tema,
lectura y cancelación salen de la fila previa, y una fila que no existía antes nace
limpia. Salió con la UI, como pedía el ítem: el cartel decía «borra los temas y
lecturas ya cargados» y ahora dice qué se conserva — si el código conserva y el
cartel dice que borra, la que miente es la pantalla, y nadie aprieta el botón.

**`cancelada` cambió de lado y el ítem no lo nombraba.** Antes se pisaba a `false`,
y había un test que lo afirmaba sin decir por qué. El razonamiento escrito que
justificaba limpiarla —«una cancelación es una excepción del ciclo viejo»— es de
`duplicarSesionParaCopia`, y **ahí vale**: la copia es una actividad nueva, sin nada
en el calendario de nadie. Regenerar pasa sobre una actividad que puede estar
publicada, así que destildarla **recrea el evento en la agenda de todo el que esté
suscripto**, y eso no lo pidió nadie. Es la asimetría de D-124: volver a tildar
cuesta un click y se ve, porque la sección Encuentros no está colapsada.

Dos redes, y las dos verificadas rompiéndolas: el comportamiento en
`tests/sesiones.test.ts` y **el texto del cartel** en `tests/etiquetas-de-ui.test.ts`
—que es la clase de B-63 aplicada al único cartel que describe una operación
destructiva—. Sin lo segundo, el código y la pantalla podían separarse en silencio.

### B-177 · Nadie avisa cuando una etiqueta nueva no se registró · P3

Con el orden de escritura de D-100, si la actividad se guarda pero falla el alta
de la etiqueta en `/opciones/*`, el guardado es un éxito y la etiqueta queda sin
registrar. Es el modo de falla que se eligió a propósito —es recuperable
tipeándola otra vez— pero hoy **no se ve**: `guardarActividad` devuelve
`etiquetasSinRegistrar: true` y el formulario no lo mira.

No hay dónde mostrarlo con lo que hay: al guardar, el formulario se desmonta y
la pantalla pasa al listado. Las salidas son una franja en el listado (archivo
del frente 3B) o quedarse en el formulario con el aviso. Vale poco por sí solo;
vale más el día que exista la UI de taxonomías (B-06), que es donde la etiqueta
faltante se arregla en un clic.

### B-150 · El panel sigue siendo dueño de `calendarEventId` · P3

B-80 se arregló del lado de la Function (D-91), que es el lado defensivo: el
write-back repone el id que el panel pisó. Lo que **no** cambió es de quién es
el campo: `formADocumento` sigue emitiendo `calendarEventId` en cada guardado,
así que sigue habiendo una ventana en la que el documento tiene `null` y una
sesión sin id.

Con el arreglo de la Function esa ventana ya no deja daño permanente, así que
esto es prolijidad, no un bug: que `actualizarActividad` relea el documento y
fusione los ids por id de sesión antes de escribir, o directamente que
`formADocumento` no emita el campo. Toca `src/lib/actividades.ts` y el
formulario, o sea el archivo más disputado del repo (fase 2 del plan de
saneamiento).


## Agentes y automatización del flujo (B-115 a B-124)

Lo que quedó pendiente al definir los agentes y skills de `.claude/`. El qué hay
y por qué está en [`13-agentes.md`](13-agentes.md). La prioridad va en cada ítem.

### B-115 · Nada invoca a los auditores solos — ✅ hecho (2026-08-24, por B-139)

**Ya estaba cerrado y nadie lo había marcado.** Lo cierra el skill
`.claude/skills/antes-de-pushear`, que entró con B-139: lanza los tres auditores
en paralelo en el momento en que hace falta —antes de un push o un PR—, junta
los hallazgos en una tabla y decide si el push sale. La mitad mecánica
(typecheck, tests con emuladores, build, fuga de credenciales) la corre
`githooks/pre-push` → `scripts/verificar-todo.sh`, porque un hook de git no
puede invocar un modelo.

De los dos caminos que proponía el ítem se tomó el primero (el gate local) y en
mejor forma: no es un hook que gasta una corrida en cada cierre, es un skill que
se dispara con la intención de pushear.

**Lo que queda, y es de otro ítem:** el skill se dispara cuando alguien dice
"pusheá"; un `git push` a secas solo pasa por el gate mecánico, y **el hook quedó
activado el 2026-08-26** (`core.hooksPath = githooks`, decidido por el dueño —
B-138). Se activó porque el problema se midió: el push de la `1.2.0` pasó por el
gate **porque alguien se acordó de correrlo a mano**, no porque el repo lo
obligara. Si se
quiere que corran sí o sí, es el job de GitHub Actions sobre el PR, que es la
otra mitad de B-124. Si nadie se acuerda, no corren — que
es exactamente el problema que tienen las dos reglas de proceso de
[`05-patrones.md`](05-patrones.md) y que estos agentes venían a resolver.

Dos caminos, y no son excluyentes: un hook local en `settings.json` (correr el
auditor que corresponda al cerrar un cambio) o un job de GitHub Actions sobre el
PR. El hook es inmediato pero cuesta una corrida por cierre; el job de Actions es
más barato de ignorar. Decidirlo con B-124.

### B-116 · La verificación contra el sistema real no está automatizada · P2

[`07-seguridad.md`](07-seguridad.md) y [`08-operacion.md`](08-operacion.md)
tienen el bloque que importa de verdad: leer el ICS del calendario y buscar el
link de reunión, intentar la escritura anónima con `curl`, revisar las cabeceras
de cache, mirar qué versión quedó publicada. Los tests unitarios prueban la
intención; esto lee el resultado.

No se automatizó porque necesita red y secretos —la URL privada del ICS y la API
key de producción— y **un agente no debe tenerlos en la mano** (§5.4). La forma
razonable es un script en `scripts/` que lea las variables del entorno y lo corra
el dueño, con el skill `que-deployar` nombrándolo. Mientras no exista, los
comandos están en la doc y se corren a mano.

### B-117 · `tests/bundle-panel.test.ts` no cubre el tercer chunk — ✅ hecho (2026-08-24)

Hecho, y por la segunda mitad del ítem, que era la que valía. El test ya no
compara literales: recorre el cierre transitivo de imports desde la entrada de
la island (leída de `admin.astro`, no hardcodeada) y afirma dos propiedades —
el SDK pesado no se alcanza siguiendo solo imports estáticos, y lo que se carga
con `import()` no es alcanzable de forma estática—. El tercer chunk y el cuarto
(`ReportesPanel`, `CalendarioActividades`) entran solos, y el quinto también.

De paso cerró B-50 y cubrió la trampa 4 del §13, que era la única de las diez
sin ningún test (ver `docs/15-mapa-de-trampas.md`). Decisión: D-100.

El texto original del ítem, que sigue explicando por qué:

- `ReportesPanel` es el **tercer** componente que `AdminApp` carga con `import()`
  y no está en la lista: volverlo estático deshace el corte y el build queda
  verde;
- ningún test frena un import estático nuevo en `AdminApp`, `firebase-client`,
  `PieVersion`, `AvisoVersionNueva` o `ayuda/` que arrastre `firebase/firestore`
  **por la cadena** de imports, no directamente. Hoy eso se revisa a ojo.

Lo segundo es lo que vale: pide seguir el grafo, no comparar una lista de
literales. Relacionado con B-50.

### B-118 · B-56 quedó desactualizado · ✅ hecho (2026-08-24)

Hallazgo del `auditor-documentacion`. B-56 quedó corregido al cerrar B-88.
Confirmar en GA4 (DebugView) sigue siendo un paso de consola del dueño.

**B-92 dice exactamente lo mismo que este ítem**: el hallazgo se anotó dos veces
en la misma pasada. Los dos se cierran acá.

### B-119 · No hay un mapa trampa → test → archivo — ✅ hecho (2026-08-24)

Está en [`15-mapa-de-trampas.md`](15-mapa-de-trampas.md), y no se lee: se
verifica. `tests/mapa-de-trampas.test.ts` lee la lista de trampas del §13 del
`CLAUDE.md` (no la copia), comprueba que los archivos citados existan, que cada
test citado **nombre** su trampa, y —lo que vale— calcula del repo cuáles no
tienen ningún test y lo compara contra las que el documento declara sin red, en
las dos direcciones.

Resultado de la primera corrida: **dos trampas sin red**. La 4 se cerró en la
misma corrida (B-117); la 7 queda abierta como B-172. Decisión: D-101.

El texto original del ítem:

El `auditor-trampas` reconstruye en cada corrida, con `grep`, qué test nombra
cada trampa del §13. Funciona porque la convención se respeta (los `describe` y
los `it` citan `§7.1`, `trampa 3`), pero es frágil: si mañana un test cambia de
nombre, el agente reporta "sin red" sobre algo que sí está cubierto, o peor, lo
contrario.

Un archivo chico de mapeo —trampa, archivo donde vive, test que la fija— haría el
reporte determinístico y, de paso, un test podría verificar que las diez trampas
sigan teniendo dueño. Es la mitad de B-63 aplicada a las trampas.

### B-120 · Nada verifica que `13-agentes.md` liste los agentes que existen · P3

Un agente nuevo en `.claude/agents/` que no entre al documento es invisible: no
lo va a invocar nadie que lea la doc. Y al revés, un agente borrado deja una
sección que promete algo que no está.

Es el mismo patrón de `tests/ayuda.test.ts` (que falla si el formulario tiene una
sección sin capítulo) aplicado a otra lista, y se resuelve igual: un test que lea
el directorio y el documento. También podría validar el frontmatter, que es
justamente lo que rompió tres agentes en silencio la primera vez (ver
[`13-agentes.md`](13-agentes.md)).

### B-121 · Con el sitio público hay que sumar sus salidas al auditor · P1 (junto con B-01)

Hoy el `auditor-privacidad` audita `toPublic.ts` como **función**, porque el
`events.json` no se genera todavía. Cuando exista el sitio público (B-01) van a
aparecer dos salidas materializadas: el `events.json` y el HTML de las páginas de
detalle. Hay que sumar al agente la verificación sobre el artefacto —el `grep`
sobre `dist/` buscando `difusion`, la URL de la reunión y los uids— y decidir la
cabecera de cache del JSON (B-37).

Va con B-01: hacerlo antes es escribir contra algo que no existe.

**Adelantado a medias el 2026-08-27 (B-218).** La parte de «sumar las salidas al
auditor» ya está: la fila 1 de las dos tablas nombra los tres productores
(`toPublic.ts`, `eventsJson.ts`, `events.json.ts`) y el `description` del agente
también, que es lo que decide si se lo invoca por nombre de archivo. **Sigue
pendiente lo que este ítem pide de verdad:** la verificación sobre el
**artefacto** — el `grep` a `dist/` buscando `difusion`, la URL de la reunión y
los uids. Hoy eso lo hace el paso 4 del gate mecánico
(`scripts/build-contra-emulador.mjs`, B-217) para el `events.json`, pero no para
el HTML de las páginas de detalle, que **ya existe desde B-227**
(`dist/actividad/{slug}/index.html`) y todavía no se barre ahí. El equivalente a
nivel de view-model sí lo hace `tests/barrido-de-salidas-publicas.test.ts`
(D-140), así que no hay hueco de cobertura sobre la decisión — lo que falta es la
verificación sobre el **artefacto**, que es lo que este ítem pide. La cabecera de
cache (B-37) ya se decidió.

**Ojo con el fixture antes de escribirlo:** hoy el gate siembra una actividad
anterior a B-224 (sin `modalidades[]`), así que su HTML sale sin el bloque «Cómo
se cursa» y sin JSON-LD. Un grep sobre ese HTML daría verde sin mirar dos
secciones. Va primero **B-241**.

### B-122 · Falta un auditor del sitio público · P2 (después de B-01)

El proyecto existe para que la gente encuentre los talleres en Google (§2.3), y
eso se rompe en silencio: un `getStaticPaths` que se saltea una actividad, un
`noindex` que quedó del placeholder, títulos duplicados, la home indexable con
contenido de prueba (DEC-4), datos estructurados que no validan, o el filtro en
memoria que necesita JS y deja el listado vacío para un crawler.

**Ya se puede empezar:** B-227 construyó el listado y el detalle, así que hay HTML
de verdad contra el que escribirlo. Conviene esperar igual al SEO absoluto
—canonical, Open Graph, sitemap, todo colgado del dominio (**B-109**)— para no
auditar dos veces lo mismo.

Y una parte ya dejó de corresponderle: el **contraste** lo calcula
`tests/contraste-del-sitio.test.ts` (B-243), que además falla si un componente del sitio
baja del piso. Un auditor que lo revise a ojo estaría repitiendo lo que un test ya
frena, que es justo lo que la tabla de «qué no automatizar» de
[`13-agentes.md`](13-agentes.md) pide no hacer.

### B-123 · El inventario de infra no se re-releva solo — ✅ hecho (2026-08-25)

[`02-infraestructura.md`](02-infraestructura.md) dice que fue relevado con
`gcloud` y `firebase`, "no de memoria", y trae los comandos para repetirlo. Nadie
lo repite. El `auditor-documentacion` puede detectar que la doc se contradice
consigo misma, pero **no** puede saber qué Functions están desplegadas de verdad
ni qué roles tiene una service account: no tiene credenciales y no debe tenerlas.

La forma sensata es un script que corra el dueño y que imprima el inventario en
el formato del documento, para diffear a ojo. Sin eso, el riesgo es el inverso al
habitual: la doc dice que algo falta cuando ya está hecho (ver B-118).

**Y eso es exactamente lo que pasó el 2026-08-25**, dos veces en el mismo día: tres
Functions figuraban "escritas, sin desplegar" y estaban **ACTIVE**; el secreto
`GITHUB_TOKEN` figuraba "falta crearlo" y existía desde el 21. B-20 parecía tener
cinco pasos pendientes y tenía uno. Eso subió este ítem de P3 a hacerlo.

**Hecho, y con una vuelta de tuerca sobre lo que pedía el ítem:** en lugar de
imprimir para diffear a ojo, **compara**. `./scripts/relevar-infra.sh` consulta el
proyecto, sale con 1 y nombra cada divergencia; `--crudo` imprime solo el estado.

Compara las tres cosas que mintieron —estado de las Functions, roles de `deploy-ci@`,
existencia de los secretos (GCP y GitHub)— y no el inventario entero: automatizar el
resto pedía parsear prosa, y un comparador que se equivoca leyendo la doc es peor que
ninguno. Eso está escrito en la cabecera del script, para que la próxima persona no
lo lea como una omisión.

**Está partido en dos, y ahí está lo que lo hace mantenible.** `relevar-infra.sh`
consulta `gcloud`/`gh` —necesita credenciales, no se puede testear—, y
`comparar-infra.sh` recibe el estado por stdin y el documento como argumento, así que
**la mitad que decide tiene nueve tests** (`tests/comparar-infra.test.ts`), incluidos
los dos casos reales del día. Es el mismo corte de `que-deployar.sh`, por el mismo
motivo: una decisión que no se puede probar se prueba en producción.

Dos detalles que valieron la pena:

- **El aviso del rol nombra el otro archivo.** Si `deploy-ci@` tiene un rol que la
  doc no declara, el mensaje manda a mirar también `07-seguridad.md` — porque el
  drift entre esos dos es cómo una afirmación de seguridad quedó mintiendo una hora
  (D-119). Hay un test de eso.
- **"No pude ver" no es "no existe".** Sin permiso para leer los secrets de GitHub,
  el script deja esa comparación **sin verificar** en lugar de reportar que falta.
  Lo escribí mal la primera vez y el propio script gritó en falso; la primera vez que
  un chequeo grita en falso se lo empieza a ignorar, así que también tiene test.

### B-124 · Decisión del dueño: ¿cuándo corren los auditores? · P3

Tres opciones, y la diferencia es plata y fricción:

- **A pedido** (hoy): cero costo, se olvida.
- **En cada cierre de cambio**, por hook: no se olvida, pero son tres corridas
  por cambio y una de ellas usa el modelo caro (`auditor-privacidad` corre en
  `opus` a propósito: un falso negativo ahí es una credencial filtrada o un link
  de reunión público).
- **Solo en el PR**, por Actions: costo acotado y queda escrito en el PR, pero
  llega después de haber commiteado.

Un intermedio razonable: `auditor-privacidad` siempre que el diff toque una de
las cuatro salidas, y los otros dos solo antes del PR. Requiere decidir el
disparador de B-115.

### B-88 · La analítica no reconoce la versión de un build de árbol sucio — ✅ hecho (2026-08-24)

`scripts/version.mjs` produce tres formas y `FORMATO_VERSION` aceptaba solo la
primera (el sufijo de las otras dos lleva guiones y pasa de 20 caracteres), así
que todo build que no saliera de un árbol limpio mandaba `version: otro` en
**todos** sus eventos.

**Lo que se arregló no es el regex, es la costura.** Ampliar el regex a mano
dejaba el mismo problema para el próximo formato que alguien invente — que es
exactamente cómo apareció este. Ahora:

- el productor tiene **un solo lugar** donde se arma la cadena (`componerVersion`,
  puro) y declara al lado su dominio completo de entradas (`ENTRADAS_DE_BUILD`);
- el consumidor sigue con su constante, porque importar el productor arrastraría
  `node:child_process` al bundle (el problema del D-60 con zod);
- **los ata un test**: `tests/version.test.ts` recorre `versionesPosibles()` y
  mete cada salida del productor en el sanitizador real del consumidor, más la
  versión que estampa el árbol de trabajo de quien corre los tests (git de
  verdad). Un formato nuevo del lado del build rompe ese test en vez de mandar
  `otro` a GA4.

El formato se amplió a lo que el build produce, no se abrió: semver más un sufijo
de `[0-9A-Za-z.-]` hasta 40 caracteres, sin espacios ni acentos ni `@ : / ?`.
Nueve entradas rechazadas quedaron fijadas en un test y los 11 de privacidad
siguen en verde sin tocarse.

Los dos `it.fails` de `tests/costuras.test.ts` quedaron promovidos a `it`, y el
grep sobre el fuente de `version.mjs` salió: lo reemplaza el lazo. Ver
[CHANGELOG](CHANGELOG.md) y **D-98**.

### B-89 · Borrar una actividad deja huérfana su subcolección `versiones`

`borrarActividad` es un `deleteDoc`, y Firestore no borra subcolecciones. Las
hasta 20 versiones de `/actividades/{id}/versiones/*` quedan para siempre, con
copias completas del documento (incluidos `online.url` y `difusion`) y sin
ninguna forma de llegar a ellas desde el panel.

No es una fuga: las reglas limitan la lectura al claim `admin` igual que antes
(`match /versiones/{version} { allow read: if esAdmin() }`). Es basura que crece
y datos internos que sobreviven a la decisión de borrar la actividad.

Lo barato es una Function `onDocumentDeleted` que borre la subcolección, del
mismo tamaño que la poda que ya existe en `historial-trigger.js`. Sin test: la
escritura de versiones es un trigger, así que verificarlo pide los emuladores con
Functions.

### B-91 · Un slug legítimo que termine en `-copia` no se puede publicar

`esSlugDeCopia` es `/-copia(?:-\d+)?$/` sobre el slug entero, y el schema lo usa
para bloquear la publicación. Un título que derive en algo como
`taller-de-copia` (o cualquier cosa que termine en esa palabra) queda imposible
de publicar, con un mensaje que habla de un sufijo que la persona no puso.

Es un borde angosto y el error es del lado seguro (bloquea, no publica una URL
rota), así que P3. Si molesta, la marca de copia puede ir en el estado y no en el
texto del slug.

### B-92 · B-56 quedó desactualizado en este mismo archivo — ✅ hecho (2026-08-24)

Duplicado de **B-118**: el mismo hallazgo anotado dos veces. B-56 quedó
corregido al cerrar B-88.


## Cerrados

Se dejan para que quede el rastro de qué se rompió.

| Qué | Causa | Dónde |
|---|---|---|
| La página de detalle decía «ya pasó» sobre una actividad cuyos encuentros se **cancelaron todos** | sin ninguna sesión en pie no hay próxima, así que `yaPaso` daba `true` por el mismo camino que una actividad terminada. Falso y de la peor manera: quien pregunta «¿se hace?» se va creyendo que llegó tarde a algo que no se hizo, con la fecha del mes que viene escrita más abajo en la misma pantalla. El dato para distinguirlos ya estaba en la mano (`encuentros.length > 0 && vivos.length === 0`). Cerrado con el `aviso` del view-model, que además ordena los cuatro estados por prioridad | B-254, `src/lib/detallePublico.ts` (2026-08-31) |
| La página de detalle daba dos cuentas distintas de los mismos encuentros, en la misma pantalla | la ficha decía «Ciclo de 4 encuentros» (los que quedan en pie) y el título de abajo «Los 5 encuentros» (todos, porque el número es la identidad del encuentro dentro del ciclo, D-95). **Las dos cuentas están bien y ninguna se puede cambiar sin romper algo**: lo que sobraba era decir el número dos veces. Lo encontró mirar el HTML del build, no un test. Cerrado sacándole el número al título | B-258, `src/pages/actividad/[slug].astro` (2026-08-31) |
| El anillo de foco del sitio estaba copiado doce veces, y la clase del enlace acentuado cinco | no es una duplicación estética: la copia que se escriba con un typo deja **un** control sin foco visible, no lo ve nadie que use el mouse, no lo dice el compilador y no lo dice ningún test de contraste. Cerrado con `src/components/sitio/estilos.ts` y `tests/estilos-del-sitio.test.ts`, que además exige que todo archivo con algo enfocable lo importe —porque «no lo escribe a mano» también lo cumple una página sin foco en ninguna parte— | B-257, `src/components/sitio/estilos.ts` (2026-08-31) |
| El chequeo de contraste del sitio medía todo contra `papel`, y desde D-141 hay tres superficies | `contraste-del-sitio.test.ts` lo decía en su propio docblock («no puede ver texto sobre un fondo que no sea papel»), y era cierto mientras el sitio tuviera un fondo. Con `crema`, `hondo` y los tintes de acento el número viejo es **optimista**: `text-tinta/61` da 4,62 sobre papel —pasa— y 4,38 sobre la superficie más oscura —no pasa—, y el test viejo seguía verde. Cerrado con `tests/contraste-de-superficies.test.ts`, que **deriva** las superficies de `global.css` y del markup | B-256, `tests/contraste-de-superficies.test.ts` (2026-08-31) |
| La sección «Cómo se cursa» del detalle se pintaba vacía cuando la actividad no tiene `modalidades` | un encabezado que promete algo y no entrega nada. Lo encontró el HTML del gate de build, cuyo fixture es anterior a B-224 (**B-241**, que sigue abierto). Cerrado no pintando la sección: la ficha ya dice «Lugar a confirmar», que es todo lo que se sabe | B-253, `src/pages/actividad/[slug].astro` (2026-08-31) |
| El sitio se presentaba con su categoría y no con su nombre, en ocho lugares | el nombre estaba decidido desde el 2026-08-27 (DEC-6) y no se había usado en ninguna parte. No rompía nada: se ve bien, el build queda verde, y el sitio entero queda sin identidad en la pestaña, en el historial y en Google. Cerrado con `identidad.ts` y un test que exige el nombre en cada título | B-245, D-141 (2026-08-31) |
| La casilla de contacto versionada no era la del proyecto, y estuvo tres días publicada en un repo público | se cargó del canal equivocado el 2026-08-28. Se sacó del árbol en vez de habilitarse —del módulo, del CHANGELOG y del comentario del test—: una casilla ajena en un repo público no se conserva como registro. `sin-datos-personales.test.ts` sirvió dos veces acá: frenó la casilla al versionarla, y volvió a fallar sobre el rastro del CHANGELOG cuando se cambió solo el módulo | B-246, `src/lib/enlaces.ts` (2026-08-31) |
| Una página del sitio público podía publicarse sin encabezado ni pie y nadie se enteraba | `Base.astro` trae el chrome apagado por defecto —lo correcto para `/admin`, lo equivocado para el sitio— así que olvidarse de `seccion` deja el build verde y la página sin salida. Cerrado con `tests/chrome-del-sitio.test.ts`, que encontró una al escribirlo | B-229, `src/components/sitio/` (2026-08-28) |
| Faltaba un lugar único para los destinos externos del sitio, y tres frentes en paralelo iban a derivarlos por separado | no era un bug todavía: es la clase B-72/B-88 —tres derivaciones de la misma regla— vista antes de que ocurra. Se cerró escribiendo el contrato primero, que es la lección de la integración de `1.5.0` | B-228, `src/lib/enlaces.ts` (2026-08-28) |
| El comparador de infraestructura reportaba que la doc mentía sobre `roles/iam.serviceAccountUser` cuando la que no miraba era él | `relevar-infra.sh` solo consultaba los bindings **del proyecto**, y `iam.serviceAccountUser` se otorga sobre **cada cuenta de runtime**. Salió a la luz al declarar los roles de D-132; es justo el rol que menos convenía no mirar, porque es la mitad de "puede desplegar código que corre como una identidad privilegiada" | B-226, `scripts/relevar-infra.sh` (2026-08-28) |
| Una ayuda que enumerara los tipos de actividad a mano habría nacido vieja | el `CLAUDE.md` §3.1 lista cinco tipos y las opciones base ya son **siete**: `feria` (B-129) y `libreria-a-la-calle` entraron después. No era un bug todavía —la página no existía— pero el camino corto al escribirla era copiar la lista del documento. Se cerró derivando el glosario de `opciones-base.json`, con el test que nombra la categoría sin explicar | B-232, `src/lib/ayudaDelSitio.ts` (2026-08-28) |
| Las dos páginas nuevas atenuaban texto por debajo del contraste AA, y se veía bien | `text-tinta/60` sobre papel da 4,49:1 con el piso en 4,5:1. Se escribe sin pensar justamente porque a ojo no se distingue de `/70`. Se subió a `/70` (6,3:1) y quedó fijado con un chequeo que prohíbe el rango entero, no la instancia. La home tiene el mismo problema y es de otro frente: **B-235** | B-232, `src/pages/{ayuda,contacto}.astro` (2026-08-28) |
| La página «Suscribirse» prometía que el evento de Calendar **nunca** trae el link de la reunión | es falso desde **D-15**: con `urlPublica: true` el link sale en la descripción, por decisión explícita del dueño. El borrador citaba el §7.4 del `CLAUDE.md`, que quedó desviado hace una semana y sigue escrito como si no. Lo peor del caso es que **no rompe nada**: la página se veía bien y le mentía a quien decidía con eso si esperar un link o no. Corregido a «casi nunca» con el caso explicado, y atado a `construirEvento` en las dos direcciones para que no pueda volver a mentir en silencio (D-133) | B-230, `src/lib/suscripcion.ts` (2026-08-28) |
| Editar un encuentro desde la vista calendario y volver por el encabezado mandaba al listado y perdía el mes que se estaba mirando | el botón "← Volver" hacía `setVista({tipo:'lista'})` fijo, mientras el "Cancelar" del formulario ya respetaba `volverA`: dos salidas del mismo formulario con dos criterios | B-35, `AdminApp.tsx` |
| El listado y el calendario contestaban "¿ya pasó?" con campos distintos: un taller en curso desaparecía del listado a los minutos de empezar | `proximoEncuentro` filtraba por `inicio`, `yaPaso` por `fin`, y el fixture de los tests tenía `fin === inicio`, así que la diferencia era indetectable (patrón B-84) | auditoría del calendario, H1 |
| `desSlug` estaba copiado idéntico en el panel y en la descripción del evento | mejorar uno separaba los dos sin que nada fallara (D-20) | H2 |
| El calendario mostraba alarma roja después de cada publicación, diciendo que el sync había fallado | el texto afirmaba falla sobre algo en vuelo; el write-back del id tarda segundos | H3 |
| El aviso de encuentros pasados decía "ya no tiene arreglo" también para los que sobran en el calendario público | contaba junto `falta` y `sobra`, que piden lo opuesto | H4 |
| El orden de tres desplegables lo decidía el orden de llegada de los datos, y un test lo cementaba | `listarActividades()` no garantiza orden estable | H5 |
| La conversión `Timestamp` → `Date` estaba duplicada en dos módulos | es el corazón de la trampa 1; divergir habría hecho que el listado y el calendario discrepen sobre cuáles sesiones existen | H6 |
| Pisar una descripción larga la perdía para siempre | no había historial: el §12 estaba pendiente desde el principio (B-03) | D-41, D-42, D-43 |
| "Elegí el arancel" al guardar un formulario que parecía completo | el placeholder se renderizaba como el primer `<option>` con valor `""`, y el texto era un ejemplo ("Gratis, a la gorra…") que se veía idéntico a una opción elegida | `2fab7ef`, D-12 |
| El evento de Calendar quedaba sin mapa o con el mapa en otra ciudad | `location` mandaba solo `sede.direccion`, sin ciudad ni país | `90edc8a`, D-10 |
| iOS Safari hacía zoom al enfocar un campo y no volvía | inputs a 14px; iOS hace zoom por debajo de 16px | `2fab7ef` |
| La barra fija de acciones quedaba debajo de la barra de gestos del iPhone | faltaba `viewport-fit=cover` y `env(safe-area-inset-bottom)` | `2fab7ef` |
| Un usuario sin el claim hacía fallar la regla de Firestore | `request.auth.token.admin`: leer una clave ausente de un map es *evaluation error*, no `false` | `9a45c86`, D-05 |
| `createdAt`/`createdBy` se perdían al editar | `setDoc` con `merge:false` borraba los campos que el form no incluye | `9a45c86` |
| El primer deploy de Functions falló dos veces | la service account propia no tiene los roles que la default de Compute trae de fábrica | `af88f84`, D-06 |
| Riesgo: agregar un campo a la descripción del evento sin agregarlo a `CAL_FIELDS` dejaba de propagarlo, en silencio | lista de campos mantenida a mano | `90edc8a`, D-07 |
| Riesgo: un panel abierto días corriendo JS viejo — bugs ya arreglados que se vuelven a reportar, y bugs corregidos que se siguen usando | SPA estática sin versión ni cabeceras de cache: el HTML cacheado hacía que recargar volviera a pedir los mismos assets | D-36, D-37, D-38 |
| El checkbox "publicar el link de la reunión" no hacía nada | la proyección y el evento descartaban la URL sin mirar el flag | D-15 |
| **B-02** · No había quién atendiera el `repository_dispatch`: el paso 5 del §10 estaba a medias | faltaba el workflow de Actions y la config del repo. Queda pendiente **B-20** (credenciales del dueño) y el deploy de la Function | `.github/workflows/deploy.yml`, D-22 |
| **B-02** · `dispararRebuild` leía `process.env.GITHUB_TOKEN` sin declarar el secreto | en Functions v2 eso da `undefined` en producción: el PAT solo habría funcionado versionado en `functions/.env`, que es lo que el §5.4 prohíbe | D-21 |
| **B-81** · El título de un reporte salía sin redactar al issue de GitHub, que es público: un mail o un link de reunión escrito ahí quedaba a la vista | `construirIssue` pasaba `descripcion` y `pasos` por `redactar()` y el `titulo` no, que es el renglón más visible. El formulario del panel promete en pantalla que el panel los tapa | `functions/reportes.js`, `tests/costuras.test.ts` |
| **B-13** · Un `repository_dispatch` fallido reintentaba cada 5 minutos para siempre, sin límite ni registro | el fallo no dejaba rastro fuera de un log: ni contador, ni error persistido, ni forma de saber que el sitio estaba viejo | `functions/rebuild.js`, D-23 |

| Riesgo: `arancel` preseleccionado en "Gratis" podía publicar un taller pago como gratuito | la preselección se aplicó a todos los campos con opciones base, sin distinguir el costo de equivocarse | D-16 |

