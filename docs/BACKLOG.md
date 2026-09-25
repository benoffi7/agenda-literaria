# Backlog

**Esto es lo que falta hacer.** El rastro de lo ya cerrado —lo hecho y lo
descartado, con su prosa entera— vive en
[`BACKLOG-cerrados.md`](BACKLOG-cerrados.md), y se mueve solo:
`node scripts/archivar-backlog.mjs` se lleva de acá todo lo que quedó
`✅ hecho` o `❌ descartado`. El 2026-09-17 eran 372 de 433 ítems y el 87% de las
líneas, así que lo pendiente estaba enterrado adentro del rastro.

**Un `B-` que este archivo cite y no tenga**, está en el de cerrados: los ítems
se citan por id desde la prosa de otros —hay 96 así— y el corte no los reescribió
uno por uno, porque el id es la dirección y sigue siendo única entre los dos
archivos. Si no aparece acá, buscalo allá.

**Todo reporte de posible bug entra acá**, incluso si se arregla en el momento:
en ese caso se carga y se marca `✅ hecho` en la misma tanda, y la próxima
corrida del archivador lo manda al otro archivo. Lo que se arregló sin ítem va a
la tabla de [Cerrados](BACKLOG-cerrados.md#cerrados), que también está allá.
**Nada se borra**: el rastro importa más que la prolijidad de la lista.

Prioridades: **P0** rompe algo o pierde datos · **P1** bloquea el objetivo del
proyecto · **P2** mejora real · **P3** cuando sobre tiempo.

> **Los números no se reciclan, y los huecos están explicados abajo.** El próximo
> `B-` libre se calcula sobre **los dos archivos** —la mitad de los ids usados
> está en el de cerrados—, así que el tablero (`npm run tablero`) lo dice bien.
> Un id **reservado por una tanda y nunca escrito** lo lee el tablero de la
> sección `## Rangos` del archivo de coordinación de la tanda (B-1051, D-981).

> **Rangos reservados por la tanda del 2026-09-22 — cincuenta números, de diez en
> diez por frente, a partir del 1150; y veinte de las decisiones a partir de la
> 751.** Esto es **B-1051 aplicado a sí mismo**: ese ítem
> dice que un id reservado por una tanda y nunca escrito se ofrece como libre,
> porque la reserva no queda escrita en ningún lado que el tablero pueda leer.
> Acá queda, y **al abrir la tanda**, que es el momento en que el ítem señala que
> nadie se acuerda de anotarlo. Cinco frentes, de diez en diez: `decisiones-2`
> desde el 1150, `instagram` desde el 1160, `analitica-doc` desde el 1170,
> `calendario-ig` desde el 1180 y `form-ig` desde el 1190. Del 1200 al 1219 los
> tomó una sesión hermana que trabajó B-1112 y B-1121 en paralelo, con veinte
> decisiones a partir de la 771. Los números 1148 y 1149 quedaron de margen.
>
> **Los rangos se escriben así —sin la forma `B-nnnn` y sin «del X al Y»— y no es
> capricho: costó dos correcciones el mismo día.** La primera versión escribía los
> extremos con el prefijo y `items-referenciados.mjs` los leyó como **citas**; la
> segunda los sacó pero dejó «del 1150 al 1199», y el barrido **expande rangos**,
> así que volvió a inventar una huérfana. La nota que existe para no perder ids se
> convirtió dos veces en huérfanas y puso el chequeo en rojo las dos. Es la misma clase que esa red persigue, producida por la nota que la
> documenta. **Lo que sobre al cerrar se anota como hueco acá**, con esta misma
> nota reescrita — si no, es exactamente el agujero que B-1051 describe.

> **Tanda del 2026-09-23 — treinta números de bug a partir del 1240 y veinte
> decisiones a partir de la 810, de a diez por frente.** Se usaron el 1240 y el
> 1241 (etiquetas del publicador), el 1250 (App Check en el panel) y las
> decisiones 810 y 820. **Todo el resto de esos rangos queda como hueco**: no son
> entradas perdidas, y el tablero ya no los ofrece porque el próximo libre se
> calcula por encima del mayor usado. En paralelo, otra sesión tomó el 1234, el
> 1235 y la decisión 803, fuera de los rangos.

> **Hueco de numeración: `B-297`, `B-298` y `B-299` no existen y no se borró nada.**
> El último ítem abierto era B-296 y la tanda del 2026-09-02 arrancó a numerar en
> **B-300** por reserva de números entre frentes en paralelo. Queda escrito acá para
> que el salto no se lea como una entrada perdida. Ningún chequeo del repo exige
> numeración contigua.
>
> **Y un segundo hueco por el mismo motivo: `B-303` a `B-309`.** El frente del
> barrido de backlog y drift tenía reservado el rango **B-310 a B-319** y usó los
> tres primeros (**B-310**, **B-311**, **B-312**); los números del medio son de
> otros frentes de la misma tanda.
>
> **Y una convención nueva, que no es un hueco: el sufijo de letra.** **B-836a**
> es el primer id con letra del archivo. Se usa cuando un ítem ya numerado se
> parte y una de las mitades es **acción manual del dueño**: `B-836a` es el click
> de consola que B-836 no puede hacer desde el repo, y va con letra en vez de un
> número nuevo justamente para que se lea como una mitad de B-836 y no como un
> ítem independiente que alguien pueda cerrar por separado.
>
> **Y un cuarto hueco, chico y del mismo motivo: `B-828` y `B-829`.** El último
> ítem era B-827 y la tanda de los cuatro formularios del 2026-09-08 arrancó a
> numerar en **B-830** para dejarse un par de números de margen. Nada se borró.
>
> **Y un tercer hueco, con una renumeración adentro: `B-603`.** La tanda del
> 2026-09-03 tuvo tres frentes en paralelo y dos numeraron a ciegas. El frente del
> sitio reservó **B-600 a B-603** y usó tres (**B-600**, el tríptico de la home;
> **B-601**, medirlo; **B-602**, el `RangeError` del reloj del build que salió de
> auditarlo). El frente de salud del repo había
> propuesto cuatro ítems con esos mismos números, y **se renumeraron a B-604 a
> B-607** al integrarlos: `B-600(salud)`→**B-604**, `B-601(salud)`→**B-605**,
> `B-602(salud)`→**B-606**, `B-603(salud)`→**B-607**. **B-600 se quedó como el
> tríptico** porque ya estaba escrito en el código y en los commits, que es lo que
> no se puede renumerar. Si alguna nota de otro frente cita «B-601 · analítica»
> o «B-603 · npm audit fix», está hablando de B-605 y B-607.
>
> **Y un quinto hueco, el más grande hasta ahora: `B-941` a `B-949`.** La tanda de
> pedidos del dueño del 2026-09-15 —geografía, panel, efemérides y bibliotecas—
> se numeró primero en **B-930 a B-940** y chocó de frente: mientras se escribía,
> otro frente de la misma tarde ocupó **B-930** (el token de App Check que se lee
> como «no hay internet»). El lote entero se corrió veinte números, a **B-950 a
> B-960**, en vez de meterlo entre los ocupados; los del medio quedaron de
> margen para lo que salga de esos mismos frentes. Es la misma reserva de siempre
> y el mismo motivo: dos frentes numerando a ciegas al mismo tiempo.

> **Y un sexto hueco, el primero que se detectó en caliente: `B-975` a `B-979`.**
> El ítem que salió de la decisión 6 del §11.1 (autolinkear las URLs de la
> descripción) se escribió como **B-975** el 2026-09-16 y, a los minutos, se vio
> que **otro frente de esa misma tarde ya tenía B-975 escrito en el código** —el
> comentario de `elegidosDe` en `src/lib/formulario/etiquetas.ts`, que cuenta los
> `usos` de las tres taxonomías de la geografía—. Se movió **el de la doc**, no el
> del código, por el precedente de B-600: lo que ya está escrito en un archivo
> fuente y en un commit es lo que no se puede renumerar. El ítem de autolinkear es
> **B-980**, y del 975 al 979 quedan de margen para lo que salga de ese frente.
>
> **Es el mismo motivo que los cinco huecos de arriba —dos frentes numerando a
> ciegas— con una diferencia:** los otros se descubrieron al integrar, y éste se
> descubrió por el `git status` del working tree, antes de que ninguno de los dos
> commiteara. Es el argumento más concreto que hay a favor de mirar el árbol
> completo y no solo los archivos propios antes de reservar un número.

---

## Decisiones pendientes del usuario

DEC-14 se resolvió el 2026-09-23 (D-802) y pasó a
[`BACKLOG-cerrados.md`](BACKLOG-cerrados.md), y DEC-15 el mismo día (D-811).

Nada de esto se puede avanzar sin respuesta. Están primero porque bloquean
trabajo.

> **2026-09-16 — la tanda de decisiones abiertas se vació, y queda una sola.**
> Se contestaron cinco de un saque: **B-889** (dónde vive la preferencia de
> formato de hora → `localStorage`, **D-720**), **B-843 punto 3** (la revisión de
> una propuesta queda sin rastro, **D-721**), **B-872** (delegada: no se exige App
> Check en Storage, **D-722**), **B-959/B-960** (van después de los P1) y las
> **cuatro** decisiones 5 a 8 del §11.1 de
> [`12-sitio-publico.md`](12-sitio-publico.md) (**D-723**, con **B-980** como el
> único trabajo que nace de ellas).
>
> **Y el punto 3 de B-889 se contestó el mismo día: control propio** (la opción
> cara, contra la recomendación y con el costo a la vista). Con eso **no queda
> ninguna decisión del dueño pendiente en este archivo** — por primera vez desde
> que existe la sección.

| # | Tema | Contexto |
|---|---|---|
| **DEC-12** | ✅ **Resuelta el 2026-09-11** (B-837, D-570, D-670): las promos **no**; el precio **sí**, con la fecha de carga visible, fuera de todo filtro y orden, y fuera del `Offer` del JSON-LD. El texto original: | Recomendación: **las promos no** (un dato viejo acá no es viejo, es equivocado, y lo paga la librería); **el precio sí**, con **la fecha de carga visible**, fuera de todo filtro y fuera del `Offer` del JSON-LD. El mecanismo compartido es **B-837**. Razonado en [`prd/02-librerias.md`](prd/02-librerias.md) § 6 y [`prd/03-suscripciones-literarias.md`](prd/03-suscripciones-literarias.md) § 6 |
| DEC-1 | ~~`libro presentado`~~ **resuelto e implementado el 2026-08-26** (D-126). | El §11 lo lista para presentaciones y charlas, pero el §3.1 no lo tiene en el modelo. Decidido el 2026-08-21: campo propio con título de la obra y autor de la obra si difiere del invitado, para poder filtrar y mostrarlo aparte. |
| DEC-6 | ~~**El nombre está: «Agenda LEH — Leer, Escribir, Hacer».** Falta **registrar el dominio**~~ — **el dominio está: `agendaleh.ar`, registrado y elegido como canónico el 2026-09-02 (D-165), y con él se cerró B-109.** El **handle de Instagram es `@librosdelatiahildita`**, decidido el 2026-09-03: con eso DEC-6 queda cerrada entera. Lo que sigue abierto son las decisiones #4 a #8 del §11.1, ninguna bloqueante. El texto de antes de la resolución está abajo de la tabla (B-840). |

> **DEC-6, el texto de antes de la resolución** (conservado por B-840, que sacó la cicatriz de merge de la fila): Resuelto el 2026-08-27. Era el bloqueo de la cadena entera: sin nombre no hay dominio, sin dominio no hay `site`, y sin `site` no hay canonical, ni Open Graph, ni sitemap — o sea B-109 y con él **B-01 a B-114**. El acrónimo hace trabajo: «LEH» es corto para la marca y «Leer, Escribir, Hacer» funciona como la línea de qué es, que también hacía falta (va en `og:site_name`, en el `Organization` y en las cinco imágenes de OG). Y «Hacer» abre el paraguas más allá de talleres y clubes, que es donde entraron «Feria» y «Librería a la calle». **Lo que falta decidir es qué parte del nombre va en el dominio** —el completo es largo para una URL— y registrarlo antes de que se indexe nada. Sigue abierto además el handle de Instagram (#2, ya decidido el canal) y las decisiones #4 a #8 del §11.1 de [`12-sitio-publico.md`](12-sitio-publico.md), que ya no bloquean: el sitio se puede empezar.

Resueltas el 2026-09-08 (los cuatro formularios, **B-830 a B-839**):

| # | Tema | Resolución |
|---|---|---|
| DEC-10 | ¿El formulario público de propuestas reemplaza el `mailto:` «Sugerir una actividad» de `/contacto`? | **No: `/contacto` queda también.** Al revés de lo que recomendaba el PRD, y con razón: un formulario de once campos es una puerta más angosta que una casilla de mail, y la propuesta que no entra por uno tiene que poder entrar por la otra. Los dos conviven, con el `mailto:` mandando primero a `/proponer` |
| DEC-11 | ¿Un anónimo puede subir un archivo de imagen, o solo pegar una URL? | **Puede subir imagen**, y **si la propuesta se descarta la imagen se borra**. También al revés de la recomendación —el PRD pedía solo URL en la v1— y también con razón: pedirle a un organizador que hostee su flyer para poder pegar una URL es pedirle que resuelva un problema nuestro, y el que no pueda no manda la foto. **Lo que cuesta:** `storage.rules` entra a la tajada 1, con el prefijo `propuestas/` (`get`/`list` en `false`, trampa 13), la guarda del prefijo en el trigger de optimización (trampa 12), el borrado al rechazar y el borrado a los 30 días |
| DEC-13 | ¿Cuántos días se guarda una propuesta rechazada? | **30 días**, y se borra **documento e imagen**. Function `onSchedule`, como las tres que ya hay |
| — | ¿La URL de los directorios es `/librerias` o `/guia/librerias`? | **`/guia/librerias`**, y con eso los tres van bajo `/guia/`. **Es la decisión que más abarató el trabajo:** la barra gana **una** pestaña en vez de tres —pasa de 7 a 8, no a 10—, se lleva puesto el choque «Suscribirse»/«Suscripciones» de arriba, y lo que queda de B-835 es la pestaña más una página `/guia` que la reciba. Las colecciones **no** llevan `/guia/`: el documento es `/librerias/{id}`, la página es `/guia/librerias/{slug}` |

Resueltas el 2026-08-26:

| # | Tema | Resolución |
|---|---|---|
| DEC-7 | La galería de imágenes (B-167), cuatro decisiones — **implementado en dos tajadas, 2026-08-26 y 2026-08-28** (D-125 y D-131); lo único que falta de (d) es la Function, que es **B-220** | (a) **un solo campo opcional**, que es un epígrafe; el texto alternativo sale del título de la actividad — decisión de accesibilidad tomada a propósito, no un olvido. (b) **hasta 4 imágenes de 3 MB**, validado en el schema **y** en `storage.rules`, porque el cliente se puede saltear; el mensaje de rechazo tiene que decir el tamaño real y el máximo, que 3 MB es menos que una foto de celular sin recortar. (c) **conviven externas y propias** desde el día uno, así que entra Firebase Storage con todo lo que arrastra. (d) las **propias se optimizan** del lado de la Function (EXIF, recompresión, miniatura) y las **externas se sirven tal cual**, sin descargarlas al build. Ojo con la trampa que aparece acá y no está en el §13: una Function que escribe la miniatura en el mismo bucket **se dispara a sí misma** — es la trampa 3 con otra cara. |
| DEC-8 | Las N opciones para sumarse a un mismo ciclo (B-181) | **Eje nuevo `opciones: [{ id, etiqueta, sesiones }]`** — el más fiel y el más caro, que es lo que el reporte describe literalmente. Toca el schema, el formulario, la proyección, el diff del §7.2 y la numeración de D-95; los ids van generados en el cliente (trampa 2). Va **después de B-167 y antes de descongelar el sitio**: hoy el daño es un calendario con eventos de más, y después es información equivocada indexada en Google. |
| DEC-9 | Cómo se llama la librería que sale a la calle (B-192) — **implementado el 2026-08-26** | Slug **`libreria-a-la-calle`** — el más concreto de los tres propuestos, y por eso el que menos se va a estirar para significar otra cosa. El label es cambiable; el slug no (la lección de B-134). Va `fijo: true` con su test, y la cascada del §11 es la de «Feria»: prende `esCiclo` —una semana de la librería son varias jornadas— y no pide tallerista ni material. |
| B-28 | ¿Claim `curador` para aprobar? — **volvió el 2026-09-11: ver B-893.** La condición que este ítem puso para reabrirse («cuando entre una tercera cuenta que no sea de confianza») se cumplió con el rol `publicador` de B-888. | **No, queda como está.** Con dos cuentas de confianza es maquinaria de permisos para un problema que todavía no existe, y mover la aprobación a un campo propio —que es lo que las reglas necesitarían— toca reglas, modelo y la pantalla de taxonomías. Vuelve cuando entre una tercera cuenta que no sea de confianza. |
| B-29 | ¿Auto-aprobar una etiqueta que reusa una segunda cuenta? | **Sí.** Y es más barato de lo que parecía: `ValorOpcion` ya tiene `huellaCreador`, así que comparar esa huella con la de quien guarda alcanza, dentro de la misma transacción del §4.2 que ya incrementa `usos`. Dos bordes: si `huellaCreador` está ausente (documentos viejos) **no** se auto-aprueba, porque no se puede saber de quién era; y queda por decidir si la etiqueta aprobada así **se marca** en la pantalla de taxonomías o desaparece de pendientes sin rastro — conviene marcarla, es lo que permite deshacer el typo que las dos personas escribieron igual. |
| B-102 | ¿El sistema guarda algo de quien se inscribe? | **No**, ratificando la recomendación que ya estaba escrita. La decisión sigue en pie para **quien se inscribe** — pero «hoy el sistema no guarda ni un dato personal de un tercero», que era el argumento de al lado, **dejó de ser cierto el 2026-09-09**: `/propuestas` guarda el contacto de quien propone (B-830), con retención de 30 días para la rechazada (DEC-13, B-838) y 30 días para la que nadie tocó (**B-844**, resuelto el 2026-09-09). La `aceptada` no vence, y conserva el contacto y la foto original — **B-863**. Ver el aviso arriba del ítem. Si algún día hace falta, el orden es al revés del intuitivo: primero el aviso público (B-98), después el estado agregado (B-97), y la lista de personas solo si eso no alcanzó. |
| B-124 | ¿Cuándo corren los auditores? | **A pedido**, como hoy. La mitigación es que `/antes-de-pushear` los lanza a los tres con un comando, así que "a pedido" no es "a mano". Y conviene usarlo: en el cierre de la `1.2.0` los tres auditores encontraron **dieciséis** bugs en tres pasadas, dos de ellos P1 de privacidad. |

Resueltas el 2026-08-21:

| # | Tema | Resolución |
|---|---|---|
| DEC-3 | Checkbox "publicar el link de la reunión" | **respetarlo** → implementado (D-15) |
| DEC-4 | Home indexable con el placeholder | se deja así |
| DEC-5 | Eventos de prueba en el calendario | los borra el usuario |
| DEC-2 | `arancel` preseleccionaba "Gratis" | **obliga a elegir** → implementado (D-16) |

## Pendiente de acción manual del dueño

## P0 — rompe algo o pierde datos

> **Tres abiertos desde el 2026-09-18, los tres del chrome del sitio público y
> los tres con capturas del dueño.** No pierden datos: lo que rompen es la
> **primera pantalla**, que es por donde entra todo el mundo. Van acá porque el
> dueño los pidió con máxima urgencia y porque dos de los tres se ven **rotos**,
> no mejorables. Se atacan de a uno.
>
> **Los tres se cerraron** (el último, B-1134) y hoy la sección no tiene ningún
> ítem abierto (2026-09-23).

## P0 — ya arreglados

**Los cuatro primeros, en dos tandas y de dos clases distintas:**

- **B-80 y B-82** (2026-08-24) salieron de revisar las costuras del merge del
  2026-08-21: cada feature estaba testeada por dentro, el par no. Los tests que
  los demuestran están en [`tests/costuras.test.ts`](../tests/costuras.test.ts) y
  ya no son `it.fails` — pasaron a `it` y ahora son la guarda de que no vuelvan.
- **B-208 y B-209** (2026-08-27) salieron de la auditoría de privacidad, y son de
  otra familia: no rompían nada visible ni perdían datos. **Publicaban.** Ninguno
  de los dos tenía forma de aparecer en un test que estuviera mirando lo que el
  código hace, porque los dos hacían exactamente lo que estaba escrito que
  hicieran — el problema estaba en lo que estaba escrito.

> ✅ **Hecho — lo verificó el triage del 2026-09-24.** Los tres pasos de abajo
> pasaron, aunque no exactamente como se escribieron: la subida del flyer no se
> abrió en `storage.rules` sino que migró a una callable (B-896), y `/proponer`
> está en el sitemap y enlazada desde el pie. El plan queda como estaba escrito.
>
> **Y desde el 2026-09-09 hay un paso más al final, que no estaba: anunciar
> `/proponer`.** La página del formulario ya está escrita y publicada con el sitio,
> pero **no** en el sitemap ni enlazada desde el chrome, porque hasta que App Check
> exija su formulario no puede recibir nada de nadie sin el claim `admin`. Cuando
> los pasos de arriba estén hechos, el último es un commit de tres líneas:
>
> 1. borrar `esAdmin() &&` del `create` de `/propuestas` en `firestore.rules` **y**
>    del `create` de `propuestas/` en `storage.rules` — **juntos**: una subida que
>    no puede terminar en un documento es un objeto huérfano, y un documento que no
>    puede traer su imagen es DEC-11 a medias;
> 2. `RUTA_PROPONER` a `RUTAS_FIJAS` (`src/lib/sitemap.ts`) y sacar la excepción de
>    `tests/sitemap.test.ts`, que está escrita con este motivo;
> 3. el enlace en el chrome —y el texto de `/contacto` mandando ahí, que es DEC-10.
>
> Los testigos que se ponen rojos al abrir la puerta están nombrados en las dos
> reglas.

## P1 — bloquean el objetivo del proyecto

### B-1235 · La imagen de una propuesta no queda en la actividad al promoverla · P1 — 🟡 arreglado y verificado por partes, falta una conversión real (2026-09-24)

> 🟡 **Causa encontrada y verificada contra el bucket de producción (2026-09-23).** No era la cadena de guardado: era el **CORS**. La respuesta con los bytes (`alt=media`) no manda `Access-Control-Allow-Origin` para ningún origen, así que el `fetch` de `promoverImagenDePropuesta` falla en el navegador («Failed to fetch»); en el emulador anda porque no aplica el CORS del bucket, y en la bandeja la foto «se ve» porque un `<img>` no lo necesita. **Hecho** (`de19dc2`, `d245919`): `cors.json` en la raíz (solo GET/HEAD desde los cuatro orígenes del sitio), y una alerta visible arriba del formulario cuando la foto no entra, con la causa y qué hacer (`avisoDeImagenNoPromovida`, `Conversion.imagenNoPromovida`). **Falta:** B-1235a, y probar una conversión real. Se cierra cuando una propuesta con foto se convierta y la actividad reabra con el flyer.

> 🟡 **Las dos mitades verificadas por separado (2026-09-24), y por qué eso
> todavía no es el cierre.** B-1235a quedó hecho, así que ahora se puede medir:
>
> - **El permiso del navegador, contra producción.** `curl -H 'Origin:
>   https://agendaleh.ar'` sobre una imagen del `events.json` responde
>   `access-control-allow-origin: https://agendaleh.ar`; con un origen ajeno **no
>   manda el header**. O sea que el `fetch` que fallaba ahora está autorizado, y
>   el bucket no quedó abierto a cualquiera.
> - **La cadena, contra los emuladores.** `tests/propuesta-a-actividad.integracion.test.ts`
>   escribe un flyer en `propuestas/` como lo deja la callable, lo promueve con el
>   **SDK de cliente**, guarda la actividad, la **relee** —el gesto con el que
>   apareció el bug— y acepta la propuesta: la galería vuelve con la imagen y su
>   `portada`, el original se borra y la copia queda.
>
> **Falta la conversión real en el panel de producción**, que es la única que
> junta las dos mitades: navegador de verdad, bucket de verdad y una propuesta con
> foto de verdad. Se cierra ahí.

**Por qué la suite podía estar verde con esto roto, que es lo que hay que no
repetir.** Ningún test ejecutaba `promoverImagenDePropuesta`: el del panel la
mockea, el del borrado del original va por el Admin SDK, y el resto de la cadena
es puro. Entre el mock y el Admin SDK quedaba justo la función que fallaba. Y no
era por falta de ganas: `vitest.config.ts` no definía
`PUBLIC_FIREBASE_STORAGE_BUCKET`, así que cualquier test que intentara ese camino
moría con `storage/no-default-bucket` **antes** de tocar el emulador. Esa clave ya
está, y con ella el archivo de integración nuevo.

**El reporte:** «cuando una propuesta con imagen se promueve a actividad, el
usuario pulsó usar imagen pero no la tomó». Apretó «Sí, usarla», la imagen se veía
en el formulario, y al reabrir la actividad **el campo «Flyer e imágenes» está
vacío**.

**Lo que se descartó en la sesión del 2026-09-23, con la cadena corrida de punta a
punta y todo en verde.** Queda escrito porque es la mitad del trabajo y sin esto
la próxima sesión lo repite:

- `PropuestasPanel.convertir` promueve y manda la imagen en `copia.imagenes`, con
  `portada: true` — ya cubierto por `tests/propuestas-panel.render.test.tsx`;
- `ActividadFormulario` montado con esa `copia` llega a `guardarActividad` con la
  imagen puesta (montado de verdad, no leyendo el fuente);
- `guardarActividad` la pasa a `crearActividad` y el schema no la rechaza;
- `formADocumento` la escribe, con y sin `ancho`/`alto`;
- `documentoAForm`/`imagenesDe` la leen de vuelta;
- ninguna Function escribe `imagenes` de `/actividades`: el trigger de aceptación
  borra el **original** en `propuestas/` y verifica antes la copia (B-863), y el
  barrido de huérfanas tiene 72 horas de gracia.

**O sea que falta evidencia de runtime**, que es lo único que la sesión no pudo
conseguir: si `promoverImagenDePropuesta` falló de verdad —`getDownloadURL`, el
`fetch` del objeto, el re-saneado del cliente sobre un archivo que el servidor ya
saneó— la conversión **sigue igual** y el motivo va a un aviso arriba del
formulario («La imagen que mandaron no se pudo traer (…). La actividad se abre sin
ella»). Ese aviso es hoy un párrafo entre otros y puede pasar desapercibido, que
es justo lo que haría que el modo de falla se lea como «no la tomó».

**Próximo paso:** reproducir contra los emuladores con la consola abierta y mirar
(a) si el aviso aparece y con qué causa, y (b) qué tiene `imagenes` en el
documento recién creado. Según qué conteste, el arreglo es el fallo de Storage o
—si el documento sí la tiene— la lectura al reabrir. **Y en cualquiera de los dos
casos entra además hacer el fallo imposible de ignorar:** hoy, si la promoción no
sale, lo que queda es una actividad sin flyer y un original huérfano que nadie
barre (`propuestas/` no lo recorre `limpiarImagenesHuerfanas`).

### B-930 · Con App Check exigiendo, un token que no llega se lee como «no hay internet» — y nadie se entera de cuál de las dos es · P1 — reportado por el dueño (2026-09-15)

> 🟡 **Pasos 1 y 2 hechos (2026-09-23), queda el 3.** El panel pide el token de
> App Check al arrancar (`src/lib/verificacionDelNavegador.ts`,
> `verificarNavegadorAlArrancar` en `firebase-client.ts`) y, si `getToken` rechaza
> o no vuelve en diez segundos, muestra arriba «No pudimos verificar tu
> navegador» con los tres primeros pasos del triaje de abajo
> (`AvisoVerificacion.tsx`) — en el login, en «Sin permisos» y en el panel. El
> umbral es lo que hace que ande: con el script de reCAPTCHA bloqueado, `getToken`
> **no rechaza nunca**, así que un `catch` solo no lo veía.
> `clasificarFalloGuardado` gana el motivo `verificacion` y el cartel rojo dice
> «no es la conexión: esperar no lo arregla»; el clasificador lee el mismo store
> por defecto, así que la métrica y el texto no se pueden separar (clase de B-88).
> Con emuladores el cartel no puede aparecer. Decisión en **D-820**. Sigue abierto
> el **paso 3**, la alerta de operación. **La alerta de GCP del 2026-09-25 no lo
> cubre** (B-871): un token que no llega pasa en el navegador y no deja log en el
> servidor. Para cubrirlo, el panel tendría que reportarlo a algún lado, y eso es
> código. Y la renovación del token a mitad de
> sesión no se mira todavía: **B-1250**.

**Pasó de verdad, en el panel productivo:** «Failed to get document because the
client is offline». Con este ítem queda escrito el mecanismo, porque el mensaje
no lo dice y lleva a mirar el lugar equivocado.

Desde el 2026-09-10 App Check está **`ENFORCED` en Cloud Firestore** (B-836a paso
6; lo afirman los comentarios de `firestore.rules` que sostienen las dos
escrituras anónimas). O sea que **ninguna lectura ni escritura del panel llega a
las reglas sin un token de reCAPTCHA Enterprise**. Si el token no se consigue —una
extensión que bloquea `www.google.com/recaptcha/…`, la red de quien carga,
reCAPTCHA que no responde (§ «Qué pasa si se cae» de
[`02-infraestructura.md`](02-infraestructura.md))— el SDK de Firestore **no dice
que lo rechazaron**: acumula fallos de canal, se declara offline, y el primer
`getDoc` tira ese texto en inglés. `activarAppCheck` tampoco propaga nada: es
deliberado —un fallo de App Check no puede dejar el login en blanco— pero deja el
diagnóstico sin ninguna huella del lado de la persona.

**Verificado el 2026-09-15, y conviene dejar el método escrito porque es de una
línea:** una lectura anónima de `opciones/tipo` contra producción devuelve `403
PERMISSION_DENIED`, y la regla desplegada de esa colección es literalmente `allow
read: if true`. Una regla que dice `true` no puede denegar; lo que deniega está
**arriba** de las reglas. Eso prueba el enforcement desde afuera, sin consola.

```sh
curl -s "https://firestore.googleapis.com/v1/projects/agenda-literaria/databases/(default)/documents/opciones/tipo?key=$PUBLIC_FIREBASE_API_KEY"
```

Lo que **no** era: el bundle publicado está bien —`appId`, `projectId`, la clave
de sitio y `isTokenAutoRefreshEnabled: true` son los de `.env.production`—, las
reglas se desplegaron ese mismo día, y los cuatro dominios de la clave están
puestos desde el 2026-09-10 (§ «Los dominios permitidos»).

Tres cosas para hacer, en orden. **La 1 y la 2 son una sola tajada y son lo que
cierra el ítem** — decidido el 2026-09-15, después de que el diagnóstico costara
un ida y vuelta entero por chat con alguien que no puede abrir devtools:

1. **Pedir el token al entrar, y avisar si no vuelve.** `getToken()` del SDK de
   App Check apenas el panel arranca —no en el primer guardado, que es tarde— y,
   si falla o tarda, un cartel arriba que diga **«no pudimos verificar tu
   navegador»** con las tres cosas del triaje de abajo: recargar, probar en
   incógnito, probar con datos móviles. Es lo que convierte «el panel no anda» en
   algo que la persona resuelve sola, sin que nadie le pida la consola. El estado
   ya existe del lado del módulo: `activarAppCheck` guarda el motivo
   (`MotivoSinAppCheck`) — lo que falta es que alguien lo mire y lo pinte.
2. **Que el cartel de fallo lo distinga.** `clasificarFalloGuardado` manda
   `unavailable` a `motivo: 'red'`, que hoy significa las dos cosas a la vez. Con
   el estado de App Check del punto 1 a mano, «no hay internet» y «no conseguiste
   token» pasan a ser dos textos distintos, que es la diferencia entre esperar y
   apagar una extensión. Es la otra mitad de **B-929**, y conviene hacerlas juntas
   porque las dos tocan el mismo cartel.
3. **La alerta que la doc admite que no existe**: «el aviso llega por donde llegue
   el reclamo, porque no hay alerta». Con dos personas cargando, el reclamo puede
   tardar un día — y si la que no puede escribir no es la dueña, puede no llegar
   nunca. Esta va aparte: es del lado de operación, no del panel.

**Lo que este ítem NO es:** un bug del código ni del deploy. El 2026-09-15 se
verificó que el bundle publicado, las reglas desplegadas y los cuatro dominios de
la clave están todos bien. Lo que falta es que el panel **cuente** lo que le pasa.

**Triaje cuando le pasa a otra persona y no a vos** (que es como apareció: el
dueño no lo reprodujo en su máquina). En orden, de lo que más descarta por
minuto:

1. **Que recargue.** Si vuelve a andar, fue transitorio: red o un token que no
   llegó una vez. No hay nada que arreglar del lado del repo.
2. **Ventana de incógnito, sin extensiones.** Si ahí anda, es una extensión de
   ese navegador bloqueando reCAPTCHA. Es el caso más común y el que el mensaje
   del SDK esconde peor.
3. **Otro navegador, o el celular con datos móviles.** Si con datos anda y con su
   wifi no, es la red —oficina, VPN, portal cautivo—.
4. **Si falla en las tres**, mirar la consola: la petición a
   `firebaseappcheck.googleapis.com/…/exchangeRecaptchaEnterpriseToken`. 403 es
   token rechazado; bloqueada o fallida es extensión o red.

**Y un caso que no es «algo está roto» y conviene tener presente:** la clave es
`integrationType: SCORE`, así que una sesión con score bajo —VPN, red compartida,
navegador muy blindado— **puede quedarse sin token siendo una persona de verdad**.
Le pasa a ella y no a vos, en la misma versión del panel, y no hay nada que
desplegar: es el precio de la capa que frena a los scripts. Otra razón para el
punto 1 de arriba — si el panel dijera «no pudimos verificar tu navegador», esto
se diagnostica solo.

**Y la salida de emergencia, que hay que saber antes de necesitarla:** poner Cloud
Firestore en `Unenforced` en la consola destraba el panel en el acto — pero abre
también las escrituras anónimas de `/proponer` y de las tres guías, que es la capa
que las sostiene. Es una decisión con costo, no un botón de reinicio.

### B-871 · Si el borrado del flyer aceptado falla, no reintenta nadie — 🟠 empezado (2026-09-11) · P2

> 🟠 **La detección está; el borrado espera la decisión.** La salida 3 se
> implementó **a medias a propósito**: `decidirFlyeresSinPlazo` +
> `relevarFlyeresSinPlazo` cruzan los objetos vivos bajo `propuestas/` contra los
> documentos que los nombran, y el script sin `--aplicar` los imprime con su
> motivo. Entra **por el bucket**, así que ve los siete caminos —incluido el
> séptimo, que no emite ningún log—. **No borra nada**, que es exactamente la parte
> que necesita la decisión de producto.
>
> **Y el chequeo que este ítem daba por existente no existía:** el runbook decía
> que el backfill se miraba buscando una línea `aceptada-no-vence` en el informe, y
> ese motivo **no puede imprimirse nunca**. Verde sobre el caso que existía para
> encontrar.
>
> **Un séptimo motivo apareció haciéndolo, y lo cobró el `auditor-trampas`:** una
> propuesta en un estado que caduca pero **sin fecha legible** no la borra el
> barrido, así que su flyer tampoco tiene quien lo borre — y mirando solo la tabla
> de plazos salía marcado «tiene red». Era el agujero de este ítem reabierto un
> renglón más abajo.
>
> **Lo que falta para cerrarlo es la respuesta del dueño**, en dos preguntas
> anotadas abajo.
>
> ✅ **La salida 1 está hecha (2026-09-25):** el dueño creó la alerta de GCP sobre
> `jsonPayload.alerta:*`, con su mail como canal. Ver `08-operacion.md` § «La
> alerta de todas las `alerta`». Los seis caminos que loguean ahora avisan; el
> séptimo (el backfill) sigue sin log, y ese es el que necesita la salida 3.

**Sale de B-863, y es el precio de que la `aceptada` no venza.** El borrado del
original ocurre en el trigger `borrarImagenAlCerrar`, y **no hay red debajo**: la
retención no alcanza a la aceptada (`RETENCION_POR_ESTADO.aceptada === null`) y
`limpiarImagenesHuerfanas` sólo recorre `imagenes/` y `miniaturas/`. Si el
borrado no ocurre, la foto de un tercero se queda **para siempre** — que es
exactamente el bug que B-863 vino a cerrar, entrando por otra puerta.

Son **seis** caminos, todos con el mismo campo `alerta:
"flyer-de-propuesta-sin-borrar"` y su fila en `08-operacion.md`. Los dos
primeros no son fallas: **conservar el original cuando no hay copia verificada es
lo correcto** (perderla no se deshace). Lo que falta no es la decisión, es que
después **no pase nadie**.

**Y hay un séptimo caso que no emite nada:** el trigger actúa sólo en la
**transición**, así que toda propuesta que ya estuviera en `aceptada` antes del
deploy no lo despierta nunca. Hoy la colección está vacía; el chequeo es
`node scripts/borrar-propuestas-vencidas.mjs` sin `--aplicar`.

Tres salidas, de menos a más:

1. **Alerta de GCP sobre el campo `alerta`** — consola, no código, el mismo caso
   que B-21. Convierte «está en el log» en «alguien se entera».
2. **`retry: true` en el trigger.** Cubre el transitorio, que es el fallo más
   probable, y **no** el permanente. Se evaluó en B-863 y se descartó: ninguna
   Function del proyecto lo usa, y encenderlo reintentaría también cualquier bug
   del handler durante siete días.
3. **Que el barrido de huérfanas recorra `propuestas/`** — la única que cierra
   los siete caminos, incluido el backfill. Es la más cara: hay que leer
   `/propuestas` para saber qué objeto está referenciado y por una propuesta no
   cerrada, y hay que decidir qué pasa con la aceptada que conservó su original a
   propósito, que es una decisión de producto.

Mientras tanto el remedio es manual y está escrito, incluidos los dos casos en
los que lo correcto es **no** borrar.

### B-857 · Un plugin desactivado sigue escribiendo en la raíz del repo, y el `.gitignore` lo tapa · P4

**Lo trajo el frente de B-849** como «la línea `.mdd/` nunca se sacó», y al ir a
sacarla resultó ser otra cosa y más interesante.

`861f0fd` («Higiene de la raíz… y el `.mdd/` ajeno») dice en su mensaje que **sacó
la línea y borró el directorio**. Su diff **la mueve de sección**, y el directorio
se había recreado tres minutos antes del commit — exactamente lo que ese mismo
mensaje advertía que iba a pasar si la línea quedaba.

**El 2026-09-09 se volvió a probar, con el mismo resultado y ahora con la causa a
la vista:** se borró la línea y el directorio, y **a los tres minutos estaban los
dos de vuelta**. Los escribe un hook del plugin `mdd@modo-ai-standards`, que está
activo en la configuración global de la máquina aunque **este repo no use MDD**
—el proceso es el del `CLAUDE.md` y el `docs/05-patrones.md`, y el propio dueño lo
dijo explícitamente— y no tiene ni `.mdd/state.json` propio ni skills del plugin
en sesión.

**Por eso la línea se queda, y ahora con el motivo escrito al lado.** Mientras el
hook exista, borrarla no limpia nada: solo cambia «un directorio ajeno ignorado»
por «un directorio ajeno apareciendo en cada `git status`». Lo que se arregló acá
es lo que sí se podía arreglar: que el `.gitignore` dejara de tener una línea sin
explicación que ya engañó a dos lectores —el commit que creyó haberla sacado y el
frente que la reportó como olvido—.

**Lo que lo cierra de verdad es de la máquina y no del repo:** desactivar el plugin
para este proyecto. Va como P4 porque el costo actual es cero y el riesgo también:
un directorio vacío ignorado. Lo que no es cero es el costo de descubrirlo de
nuevo, y eso es lo que este ítem compra.

## P2 — mejoras reales

### B-959 · Efemérides: cargarlas en el panel, mostrarlas en el sitio, y que no lleguen al calendario · P2 — pedido del dueño (2026-09-15)

> 📌 **Orden fijado por el dueño el 2026-09-16: va después de los P1.** Vale igual
> para **B-960**. Los dos son entidades nuevas —el trabajo más caro que hay
> pendiente— y los P1 que tienen adelante son cosas que hoy **publican mal o
> confunden a quien carga** (B-926, B-928, B-930). Poner una entidad nueva arriba
> de eso sería agrandar la superficie antes de arreglar la que ya está en uso.

*«En el panel y web, efemérides poder cargar. No van al calendario público.»*
Definido por el dueño el 2026-09-15: **es el dato del día, sin lugar ni horario** —
«hoy nació Cortázar», «se publicó *Rayuela*». No es una actividad a la que se vaya.

**Por qué no entra como un `tipo` más de actividad**, que era la salida barata:

1. **Una actividad publicada va al calendario.** La guarda de eso no es un flag:
   son `estado` y `sesiones` (§ 7.3). Meter efemérides como tipo obliga a un `if`
   por tipo adentro de `syncCalendar` — una excepción en la parte más frágil del
   sistema, que es lo que el § 7 pide no hacer.
2. **No tiene nada del formulario**: ni sede, ni modalidades, ni inscripción, ni
   arancel, ni material, ni sesiones. El § 11 tendría que esconder casi los 30
   campos para mostrar dos.
3. **Y sobre todo, no es una fecha: es un día y un mes.** Una efeméride se repite
   todos los años. Guardarla como `Timestamp` es pedir la trampa 1; lo que se
   guarda es `dia` y `mes` (números) y, aparte, el año del hecho. Esto **no**
   contradice el § 2.2 («no usar RRULE»): esa decisión es sobre encuentros de un
   ciclo, y acá justamente no hay evento que recurrir.

O sea: **colección propia `/efemerides/{id}`**, con su pantalla en el panel, su
proyección whitelist (`toPublic` por entidad, nunca genérico — la cita está en el
docblock de `src/lib/directorios.ts`) y su JSON estático, como los tres
directorios.

**La parte que hay que resolver bien, y es la única interesante:** el contenido
cambia **todos los días sin que nadie edite nada**, y el sitio es estático. Un
build diario para mostrar la efeméride del día es un rebuild por día para siempre.
La salida es la del § 2.5: **el JSON las lleva todas y el cliente elige la del
día** — cero builds extra, cero lecturas de Firestore, y la página de la
efeméride sigue siendo SSG e indexable.

**Lo que falta decidir (del dueño):** dónde se ven. Tres candidatas, y no son
excluyentes: un renglón en la home, la página de mes (`/agenda/{aaaa-mm}`), y una
sección propia `/efemerides` con página por efeméride. La tercera es la que
aporta al objetivo del proyecto —es contenido indexable de long tail que hoy no
tenemos— y las otras dos son de uso. Sin esa respuesta se puede escribir el modelo
y el panel, pero no el sitio.

### B-798 · 🟡 la emisión hecha (2026-09-09) — «Filtros que no encuentran nada» decía cuántas veces, no cuál filtro · P2

> ✅ **Hecha la mitad de emisión, y el diagnóstico del ítem estaba incompleto.**
>
> El ítem daba por sentado que el evento ya emitía el desglose y que el corte era
> solo de la Function. **No era así:** el `eje` salía de `ejeQueSobra`, que mira los
> **seis** rieles de chips, y el listado tiene **diez** filtros. Un cero causado por
> el texto del buscador, por el «Cuándo», por «abierta» o por «cursada» llegaba
> **sin ningún parámetro** — indistinguible de «ningún filtro solo explica el cero».
> O sea que hacer los pasos 1 y 2 y no éste habría dejado la pregunta sin contestar
> igual, con las dimensiones registradas y todo.
>
> Ahora `eje` cubre los diez, **sin reimplementar `ejeQueSobra`**: su respuesta
> manda —es la que pinta «Probá sin el filtro de…»— y los otros cuatro son la cola,
> así que la serie histórica de los seis no cambia ni un evento.
>
> **La mitad de privacidad es lo que hacía interesante al ítem, y quedó escrita:**
> `busqueda` es un eje —enum cerrado— y el texto tipeado no viaja. La garantía es
> **estructural**: `crudosDeFiltroSinResultados` saca el `slug` del mapa de los
> rieles y de ningún otro lado, y el buscador no escribe ahí. Y **el saneador solo
> no alcanzaba**: `FORMATO_SLUG` acepta `poesia` igual que `club-lectura`, y los
> cinco centinelas del barrido tienen todos mayúsculas, espacios, acentos o
> arrobas, así que pasar el texto tipeado **habría pasado, en verde**.
>
> **El frente corrió el `auditor-privacidad` sobre su propio diff y se cobró dos
> hallazgos.** El que importa: al mudar la garantía del saneador al llamador, la
> dejó **sin red en el lugar nuevo** —`medirSitio` recibe `Record<string, unknown>`,
> así que un payload escrito a mano compilaba, pasaba `tsc` y pasaba la suite
> entera—. Es la clase de B-81, y ahora hay un chequeo que lee el fuente del único
> emisor. El otro: «sale del mapa» **no es** «sale de la taxonomía» —`desdeQuery` no
> contrasta contra las opciones conocidas—, así que la frase se corrigió y la
> garantía quedó apoyada en el motivo correcto.
>
> Costo medido: **+88 B gzip** en todas las páginas y **+156 B** en el listado.
>
> **Siguen abiertos los otros dos tercios**, en el orden del ítem: registrar `eje` y
> `slug` como dimensiones en la consola de GA4 —**es lo que corre el reloj**, el
> registro no es retroactivo—, sumarlas a `DIMENSIONES_PERMITIDAS` de
> `functions/analitica.js` (decisión de privacidad, no cambio mecánico) y el
> desglose en la fila del panel.

**Lo preguntó el dueño el 2026-09-07 mirando la pantalla:** «no hay que expandir
eso para saber qué filtros?». Tenía razón, y la fila **prometía** lo que no podía
dar: decía «qué combinación de filtros deja la lista vacía, para saber qué etiqueta
conviene completar o retirar» y lo que muestra es **un número**.

**Dónde se corta el dato.** El evento sí lleva el eje y el slug elegidos
(`filtro_sin_resultados`, `analyticsSitio.ts`), pero la Function le pide a GA4
`eventName` + `eventCount` y nada más (`functions/analitica.js`), así que al panel
llega la cuenta y no el desglose. La promesa ya se corrigió: la fila dice ahora lo
que muestra.

**Traer el desglose son tres cosas, y la primera es la que corre el reloj:**

1. **Registrar `eje` y `slug` como dimensiones personalizadas de evento en la
   consola de GA4.** Un parámetro de evento **no se puede consultar** por la Data
   API hasta que está registrado como dimensión personalizada, y **el registro no
   es retroactivo**: los datos empiezan a acumularse desde que se registra. O sea
   que **registrarlo hoy es lo único que hace posible verlo el mes que viene** —
   y por eso conviene hacerlo aunque el resto quede para después.
2. **Sumar la dimensión a `DIMENSIONES_PERMITIDAS`** (`functions/analitica.js`), y
   eso es **una decisión de privacidad, no un cambio mecánico**: esa lista blanca
   existe con su docblock escrito para que no entren `pageLocation` —que llevaría
   `?q=<lo que alguien tipeó>`— ni `city`, `region`, `userAgeBracket` o
   `userGender`. `customEvent:eje` y `customEvent:slug` son agregados sin persona
   y el slug ya es público, así que el caso es defendible; lo que no se puede es
   agregarlo sin pasar por ahí. `tests/analitica-del-sitio.test.ts` compara el
   conjunto exacto de dimensiones contra esa lista, así que el test lo va a pedir.
3. **El desglose en el panel**: la fila pasa a poder expandirse y mostrar los
   ejes con más ceros. Es lo más chico de los tres.

**Y lo que se gana es concreto**, que es el motivo por el que el ítem no es P3: la
pregunta que contesta es «qué etiqueta conviene cargar o retirar». Un `barrio` que
se filtra seguido y nunca tiene nada es una actividad que falta o una etiqueta que
sobra, y hoy eso no se puede saber.

### B-770 a B-773 · La sección comercial `/anunciar` · P2

> ⚠️ **Este bloque estaba dentro de un bloque de código, y con él B-780 a B-786.**
> Dos ` ``` ` de sobra —restos de un texto pegado desde `.estado/comercial.md` con
> sus propias marcas— envolvían primero las tres filas de acá y después **siete
> ítems enteros**, que se renderizaban como código plano: sin tablas, sin negritas
> y sin links. Arreglado el 2026-09-07, junto con la misma cicatriz en
> `06-decisiones.md` (D-460 y D-461). Es el patrón de «merge mal resuelto» que ya
> tenía ítem propio en **B-294** y que ningún chequeo cuenta.

| # | Qué | Estado |
|---|---|---|
| **B-770** | **La sección comercial `/anunciar`**: ofrecerle espacio a cafés, librerías y espacios culturales, con el mail como única acción. Sin planes, sin precios y sin un número de audiencia inventado | ✅ hecho (2026-09-04) — D-450, `src/lib/comercialDelSitio.ts` + `src/pages/anunciar.astro`. Entra al sitemap y al pie; **B-377 sigue intacto** |
| **B-771** | **Revisar `/anunciar` cuando haya datos de audiencia.** Hoy la página dice que no los tenemos, que es lo correcto: la medición arrancó el 2026-09-03. Con un mes de historia (**B-374**) se puede agregar un número real, y ahí hay que revisar el chequeo de `tests/comercial-del-sitio.test.ts` que hoy prohíbe las cifras de audiencia — con los números en la mano, no sacándolo porque molesta | 🟡 depende de B-374 |
| **B-772** | **La fila de `/anunciar` en el índice de salidas públicas** | ✅ **hecho (2026-09-07)** — el dueño decidió numerarlas. Son **seis** filas y no cinco (`/suscribirse`, `/ayuda`, `/contacto`, `/404`, `/apoyar` y `/anunciar` → **13 a 18**), en las tres tablas atadas, más el `PALABRAS` del test y la prosa de los tres documentos. Cerró **B-654** de paso. Ver el ítem propio abajo |
| **B-773** | **Los settings de propiedad de GA4 que nadie verificó** — ver abajo, tiene cuerpo propio desde el 2026-09-07 | ✅ hecho (2026-09-25) — Signals y datos de usuarios apagados; la personalización de anuncios pasó de 307 a 0 regiones |

#### B-773 · Los settings de propiedad de GA4 que nadie verificó · P2 · ✅ hecho (2026-09-25)

**✅ Hecho (2026-09-25)**, con capturas del dueño de Administrar → Recogida de
datos. **Google Signals** estaba desactivado, y también la recogida de datos
proporcionados por los usuarios y la de ubicación y dispositivo granulares. Lo que
estaba prendido era la **personalización de anuncios**, en las 307 regiones: el
default de fábrica. No tenía efecto porque no hay cuenta de Ads vinculada y
Signals está apagado, pero bastaba con que alguien la vinculara. El dueño la dejó
en **0 de 307**. Anotado en `16-analitica-del-sitio.md` §9.4.

**Estaba citado en tres lugares y no tenía cuerpo.** Lo nombran la ficha del
`auditor-privacidad` (fila 12), `docs/13-agentes.md` y el texto de `/anunciar`, y
hasta hoy no había ítem que dijera qué es — o sea que las tres citas mandaban a un
número.

**Qué es.** B-480 cerró en la consola de GA4 las cuatro cosas del «Enhanced
Measurement» que mandaban eventos por su cuenta —búsquedas en el sitio, clics
salientes, `page_view` por cambio de historial, y el borrado de la clave `q`—.
**Lo que no se tocó son los settings de propiedad**, que son otra pantalla y otra
decisión:

- **personalización de anuncios** (`Google signals` / `Ad personalization`), que
  habilita audiencias y remarketing;
- **Google Signals**, que cruza la medición con la sesión de Google de quien mira
  y agrega datos demográficos.

**Por qué importa, y no es hipotético.** El texto de `/anunciar` afirma que «no hay
un anuncio, ni una red, ni un píxel», y el docblock de `comercialDelSitio.ts` ya
dejó escrito que la frase se redactó **evitando decir «no hacemos remarketing»**
justamente porque eso afirmaría un ajuste de consola que este repo no controla. O
sea: la página está escrita para no mentir sobre esto, y lo que falta es
**confirmar el estado real**.

**Y no hay ningún test que lo sostenga, ni puede haberlo**: es configuración de una
consola, no código. Es la misma clase que B-480 —cerrado y sin red— y por eso la
ficha del auditor ahora lo dice con esas palabras: si alguien lo reactiva, ningún
rojo lo dice.

**Qué habría que hacer**, y es de consola, no de repo:

1. En GA4 → Administrar → Configuración de datos → **Recopilación de datos**:
   confirmar que **Google Signals** está desactivado.
2. En Administrar → **Configuración de la propiedad**: confirmar que la
   personalización de anuncios no está habilitada para la propiedad.
3. Escribir el estado encontrado en `docs/16-analitica-del-sitio.md` §9.4, al lado
   de los otros pasos de consola, **con la fecha** — que es lo único que puede
   hacer de red acá: dejar por escrito qué se vio y cuándo.

Si alguno de los dos está activado, es una decisión: apagarlo (y entonces el texto
de `/anunciar` puede afirmar más) o dejarlo (y entonces hay que revisar que ninguna
página afirme lo contrario — el barrido de `tests/promesas-sobre-datos.test.ts`
mira las promesas sobre medición, no sobre publicidad).

---

### B-370 a B-379, B-480 y B-481 · La analítica del sitio público · P2

**Los diez ítems que salieron de la arquitectura de la analítica
([`16-analitica-del-sitio.md`](16-analitica-del-sitio.md), D-201), más dos que
salieron de auditar la implementación — uno antes de pushear.** El dueño ya
contestó las tres preguntas que bloqueaban este frente — **B-376 → C3**
(banner con aceptar/rechazar), **B-371 → aceptado** (el costo de JS de la
página de detalle) y **B-373 → diferido a propósito, para el final de todo**.
El §12 de `16-analitica-del-sitio.md` tiene el detalle completo de cada uno.

| Ítem | Qué es | Estado |
|---|---|---|
| **B-370** | El ítem paraguas y el documento de arquitectura | 🟡 el tablero (con pestañas, B-500/B-501), el banner, el tag, los eventos y B-480 están; **falta B-373 y B-374** |
| **B-371** | **Decisión del dueño:** aceptar el costo de JavaScript en la página de detalle, que hoy tiene cero | ✅ resuelto — **aceptado** (D-251), con el número medido en el §6bis del documento |
| **B-372** | Instalar el tag de GA4 en las páginas públicas — la mitad vendible entera | ✅ hecho (2026-09-03) — código, enganche en `Base.astro` y **B-480 resuelto** en la consola. En el camino se encontró y corrigió un `preconnect` a `googletagmanager.com` sin condicionar al consentimiento (D-254), con un test que lee el `dist/` y frena cualquier tercero previo al consentimiento; B-481 anota lo que ese hallazgo dejó pendiente |
| **B-373** | Search Console: conectar el dominio y leerlo | 🟡 **conectado el 2026-09-03 por el dueño** — el histórico ya empezó a acumular, que era la parte sensible al calendario. **Queda la lectura al panel**: traer sus datos (qué búsquedas traen gente, qué páginas rankean) a una vista del tablero. Es código y depende de datos acumulados, igual que B-374, así que va con esa tanda. Conviene además cargar el `sitemap.xml` (ya existe, B-109) en Search Console para que Google descubra las páginas más rápido |
| **B-374** | La Function que lee la Data API de GA4 para el resumen del panel | ⛔ depende de un mes de datos (B-372 y B-480 ya están) |
| **B-375** | Los eventos propios: el clic en inscripción y el filtro que deja cero | ✅ construidos (`clic_inscripcion`, `filtro_sin_resultados`) y **ya miden**, con B-372/B-480 cerrados |
| **B-376** | **Decisión del dueño:** el aviso de privacidad y el consentimiento, entre las tres opciones del §7 | ✅ resuelto — **C3** (D-250), banner construido en `src/components/sitio/AvisoDeCookies.astro` |
| **B-377** | El inventario publicitario: una salida pública nueva. Anotado, no resuelto | 🔵 futuro |
| **B-378** | El tablero del catálogo es una foto y no una serie | 🔵 futuro |
| **B-379** | El tablero agrupa en el navegador; con miles de actividades conviene un agregado | 🔵 futuro |
| **B-480** | — ✅ hecho (2026-09-03). El dueño apagó en la consola de GA4 (flujo `G-9CFMHSSGRC`, Enhanced Measurement) **«Búsquedas en el sitio»** y **«Clics salientes»**, y —al configurarlo— dos cosas más que aparecieron: **desactivó los `page_view` basados en el historial de navegación** (el buscador reescribe la URL con `replaceState` en cada filtro, así que sin esto cada toque contaba una vista con el texto de `q` en la URL), y en **Ocultar datos** activó el borrado de la clave de consulta **`q`** —el parámetro donde viaja el texto del buscador—, que es la red durable: GA4 lo borra al recibirlo pase por donde pase. Con esto B-372 queda cerrado. | ✅ hecho (2026-09-03) |
| **B-481** | **Las tipografías (`fonts.googleapis.com`/`fonts.gstatic.com`) son, hoy, una conexión a un tercero en el load** — el mismo `preconnect` que D-254 sacó para GA4, pero decidido antes de que hubiera un banner y sin la lupa del consentimiento encima. Autoalojarlas (servir los `.woff2` desde el propio dominio) la eliminaría del todo. No es privacidad en el mismo sentido que B-480 —una tipografía no manda datos de la persona—, es la misma clase de dato de red (que este navegador entró al sitio) que ya se decidió aceptar para las fuentes, y conviene tenerlo escrito ahora que el tema está sobre la mesa | ✅ **hecho (2026-09-03)** — autoalojadas en `public/fuentes/`, servidas con `@font-face` desde `src/styles/global.css` y precargadas en `Base.astro`. **Cero terceros en el load** y un pedido menos; el `preconnect` a `fonts.googleapis.com` ya no está. La decisión es **D-340**. Lo encontró `npm run backlog:contradicciones` (B-1170, B-1220): el documento lo decía bien y este registro no |
| **B-500** | El aviso «ya-paso»: el dueño no entendía por qué el tablero marcaba como problema algo que es el archivo funcionando bien | ✅ hecho (2026-09-03) — primero reencuadrado (D-270), después **sacado del todo** (D-273): el dueño señaló que la lista crece sin techo y no pide ninguna acción para casi nada. Queda la cobertura acotada «cuántas tienen fecha futura», no la lista |
| **B-501** | El tablero pasa a pestañas internas — «El catálogo» y «El sitio público» — para que entre sin scroll infinito | ✅ hecho (2026-09-03) — `EstadisticasPanel.tsx`, D-271 |
| **B-502** | La pestaña «El sitio público»: el andamiaje honesto de lo que B-374 va a mostrar, sin un solo número inventado | ✅ hecho (2026-09-03) — estado vacío deliberado, con la fecha de arranque de la medición (3 de septiembre de 2026) y qué falta para que deje de estar vacío. D-272 |

## P3 — cuando sobre tiempo

### B-1920 · La regla de dónde carga el publicador confía en el derivado `ciudades` · P3 — del `auditor-privacidad` sobre B-921 (2026-09-25)

`dentroDeSuCiudad()` mira `ciudades` y la primera `sede`, no todas las
`modalidades[]`, porque una regla no puede recorrer un array de maps. Quien arme el
documento a mano con el SDK puede declarar una ciudad falsa o sumar una segunda sede
sin ciudad. Por el panel no se puede. **No es una fuga**: es contenido propio de una
cuenta que ya publica sin revisión, y una actividad con `ciudades` mentido queda
**menos** visible. Arreglo si hace falta: que el trigger del historial recalcule
`ciudadesDe(modalidades)` y avise al admin si no coincide.

### B-731 · Confirmar en la consola que los avisos bajaron, después del próximo rastreo · P3

**Lo único que queda del lado del dueño, y es mirar, no arreglar.** Después del
próximo deploy y del rastreo siguiente:

1. **Inspección de URL** sobre una página de **ciclo** —cualquiera de las 17 con
   más de un encuentro; `feria-del-libro-malvinas-argentinas` es la más grande,
   con 11— y confirmar que en la pestaña de datos estructurados cada `subEvent`
   ahora trae `description`, `location` y `organizer`.
2. En el informe «Eventos», que `description` y `organizer` **desaparezcan** de
   la tabla de avisos, y que `offers` baje a las actividades ya pasadas.
3. Los conteos de `performer`, `image`, `price`, `priceCurrency`, `validFrom` y
   `organizer.url` **van a subir**, y está bien: el informe cubría 18 de 68
   páginas y va a cubrir las 68. No es una regresión, es el rastreo llegando.

**Cargar el `sitemap.xml` en Search Console si todavía no está** (lo pide B-373):
es lo que hace que las 50 páginas que Google no había visto entren rápido.

#### La lectura del 2026-09-08 (informe actualizado al 6/9) — el rastreo todavía no llegó

El dueño pasó la pantalla del informe «Eventos». Así está:

| | Elementos |
|---|---|
| **No válidas** — `Falta el campo "location"` (crítico) | **44** |
| **Válidas** | **24** |

Y los nueve avisos: `performer` 65, `image` 49, `offers` 44, `description` 44,
`organizer` 44, `validFrom` (en `offers`) 24, `url` (en `organizer`) 24,
`priceCurrency` 20, `price` 20.

**El punto 2 de arriba todavía no se puede dar por cumplido, y los números dicen
por qué:** `location`, `description`, `organizer` y `offers` valen **44 los
cuatro**. Ese 44 es exactamente el conjunto que B-730 arregló —los `subEvent` que
eran cáscaras de `name` + fechas, sin ninguno de los cuatro campos— así que lo
que se está mirando es el markup **anterior** al arreglo. B-730 se implementó el
2026-09-04 y el informe está actualizado al 6/9 con el rastreo a mitad de camino
(las barras arrancan el 31/8), o sea que Google todavía no volvió a leer esas
páginas. Las 44 no válidas son el pasado del sitio, no su estado.

**Lo que hay que hacer con esto: nada todavía, y no pedir la validación aún.**
Pedirla antes de que el rastreo termine la hace fallar y el informe queda con la
marca de «validación fallida» encima. El orden es: esperar el rastreo → confirmar
por Inspección de URL que una página de ciclo ya trae los cuatro campos en cada
`subEvent` → recién ahí pedir la validación de `location`.

**De los nueve avisos, ocho no son código.** Se separan en tres grupos y solo uno
tiene arreglo en el repo:

- **Es el markup viejo** (van a caer con el rastreo): `description`, `organizer`,
  `offers`, los tres en 44.
- **Falta el dato, no el campo** — el código ya los emite cuando están cargados,
  y no están: `performer` 65 (actividades sin tallerista), `image` 49 (sin
  imagen), `url` en `organizer` 24 (organizador sin web), `price` y
  `priceCurrency` 20 (arancelado sin `arancel.monto`, que es el campo que B-114
  acaba de agregar). Inventarlos sería afirmar algo falso, que es la regla del
  §7; lo que sí se puede hacer es que el panel avise **antes de publicar** qué se
  va a perder — **B-813**.
- **No se emite nunca**: `validFrom` en `offers`, 24 — **B-812**.

## Vigilado — sin trabajo hasta que se cumpla su condición

**Estos no son pendientes.** Son decisiones ya tomadas o limitaciones aceptadas que
llevan escrita la condición que las reabriría. Los juntó acá el triage del
2026-09-24 para que no se lean como trabajo en la lista de prioridades: si la
condición se cumple, el ítem vuelve a su P.

### B-846 · La URL de descarga de un flyer privado es una capability, y eso no es «nadie puede leerlo» · P3

**Lo descubrió `tests/storage-reglas.integracion.test.ts` fallando**, escribiendo
el paso 8 de B-830: el caso afirmaba que sin sesión no se podía leer el objeto de
`propuestas/` «ni con la URL en la mano», y era falso.

`allow get: if esAdmin()` cierra el acceso **por ruta**: sin sesión, pedir la URL
de descarga es un permission-denied aunque se sepa el path exacto. Pero la URL que
`getDownloadURL()` **ya acuñó** sirve el objeto sin volver a evaluar las reglas —
es el mismo mecanismo que hace pública una imagen de `imagenes/`, donde es
deliberado (B-206 #1). O sea que el flyer de una propuesta es privado **mientras
su URL no salga del panel**.

**Por qué es P3 y no más:** la URL solo se acuña adentro del panel, con una sesión
de admin; el objeto se borra al rechazar o a los 30 días; y para que el token se
filtre tiene que salir del navegador del admin (una captura de devtools, un link
pegado en un chat). No hay ningún camino automático.

**Qué costaría cerrarlo:** no acuñar tokens nunca — bajar los bytes con `getBlob`,
que manda el `Authorization` en el header y no deja una URL portadora. Cuesta
**configurar CORS en el bucket** para el origen del panel (un `gsutil cors set`,
que es un paso de consola que hoy no existe en `08-operacion.md`) y cambiar el
visor y la promoción. Vale la pena el día que la bandeja tenga volumen, o antes si
aparece un segundo lugar que muestre objetos privados.

Está afirmado en las **dos** direcciones en el test, así que el día que se cierre,
el caso se pone rojo y hay que venir a decidirlo en vez de descubrirlo con una
imagen rota.

> **2026-09-16 — este ítem dejó de ser solo una fuga chica: es el primer escalón
> de otra cosa** (**D-722**, al cerrar **B-872**). Mientras las imágenes públicas
> se sirvan por URL de descarga, `firebasestorage` no se puede poner en
> `ENFORCED` sin apagar el sitio, así que **B-846 + B-222 son la precondición de
> exigir App Check en Storage**, no un arreglo paralelo. Eso no lo sube de P3 —no
> hay nada urgente colgando— pero sí cambia con qué se agenda: el día que se toque
> uno, se tocan los tres juntos, y recién ahí la medición de B-872 vale la pena.

> **A «Vigilado» el 2026-09-24 (triage):** diferido a propósito por el propio ítem, que dice cuándo vuelve.

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

> **A «Vigilado» el 2026-09-24 (triage):** diferido a propósito por el propio ítem, que dice cuándo vuelve.

### B-920 · ¿Qué debería ver el publicador de una actividad ajena de su ciudad? · P2

**Lo marcó el `auditor-privacidad` sobre B-919 y la decisión es del dueño.** Una
regla de Firestore es **todo-o-nada por documento**: el alcance por ciudad no
autoriza «la vista pública de las actividades de mi ciudad», autoriza **el
documento crudo**. O sea que de una actividad ajena de su ciudad, esa cuenta lee
también `online.url` con `urlPublica: false`, `difusion`, `inscripcion.destino`,
la URL del material privado, los uids y `imagenes[].storagePath`. Y **sin cláusula
de `estado`**, así que alcanza a los **borradores** ajenos, de los que no salió
nunca nada a ninguna parte.

**Se aceptó, con tres motivos**: el claim lo entrega el dueño de a una cuenta por
vez con un script; el alcance es estrictamente menor que el del `admin`, que ya lee
todo; y recortar por campo **no es expresable en una regla** (la alternativa es una
Function que proyecte en el camino de lectura del panel, que es lo que D-660
descartó). El panel además no se lo pone adelante: la ficha en solo lectura no
muestra «Difusión».

**Vuelve cuando entre la segunda publicadora**, que el propio pedido anticipa
(«puede ser que no sea la única»): ahí deja de ser una cuenta mirando y pasa a ser
N cuentas cruzadas.

La ruta de recorte ya está escrita y medida a medias: sumarle
`resource.data.get('estado','') == 'publicado'` al disyunto de la ciudad, más el
`where('estado','==','publicado')` correspondiente en la segunda query de
`listarActividades` — y **medirlo contra el emulador, no suponerlo** (trampa 7). El
testigo que hay que dar vuelta ya existe y **enumera lo que lee**: `it('lee un
BORRADOR ajeno de su ciudad, con su link de reunión y sus notas internas adentro')`
en `tests/rol-publicador.integracion.test.ts`.

### B-786 · P3 — el `Referer` a Cafecito, y cuándo habría que volver a decidirlo

El enlace sale con el `Referer` por defecto
(`strict-origin-when-cross-origin`), así que a Cafecito le llega
`https://agendaleh.ar` — el origen, sin ruta ni query. No identifica a nadie, y no
se puso `noreferrer` a propósito: borraría la única señal de que el aporte vino del
sitio, y eso es información que nos interesa perder por nada.

Queda anotado por dos motivos. Uno: es la primera vez que el sitio manda un
`Referer` a un tercero **por una acción de la persona**, y el criterio con el que se
decidió que está bien tiene que estar escrito antes de que haya un segundo caso.
Dos: **si algún día el enlace sale desde otra página** —una tira en el pie de la
página de detalle, por ejemplo— el `Referer` pasa a decir **qué actividad** estaba
mirando, y ahí sí hay algo que decidir.

---

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

> **2026-09-03 — verificado, el disparador todavía no ocurrió.** Contra la API
> de GitHub, con la cuenta dueña del repo (`gh api repos/benoffi7/agenda-literaria/…`):
> **un solo colaborador** (`benoffi7`, admin), **cero forks**, **cero
> colaboradores externos** (`?affiliation=outside`), **un solo secret de
> Actions** (`FIREBASE_SERVICE_ACCOUNT`) y **cero `environments`** configurados.
> El secret sigue teniendo un solo lector, así que la condición que dispara
> este ítem sigue sin cumplirse — no se implementó el split de `build-ci@` /
> `deploy-ci@` porque hacerlo ahora sería resolver un problema que todavía no
> existe, en contra de lo que el ítem mismo pide ("el día que pase"). Queda
> escrito para que la próxima vez que se agregue un colaborador con push, se
> habilite un fork con Actions, o se sume un runner de terceros, sea la señal
> de volver a este ítem.

---

### B-366 · Las reglas de Storage no se pueden particionar por proyecto · P3

Residual conocido de B-219, anotado en el docblock de `cargarReglasStorage`.

A diferencia de Firestore —que tiene
`/emulator/v1/projects/{p}:securityRules`— el emulador de Storage expone
`/internal/setRules`, que es **global**: la última carga gana para todos los
proyectos. Así que el aislamiento por `projectId` no llega hasta ahí.

**Hoy no muerde**, y vale decir por qué para no sobreestimarlo: los objetos van con
nombre único por caso (`img_test-<base36>-<n>`), nadie barre el bucket, y dos
checkouts empujando el mismo `storage.rules` cargan lo mismo. Muerde el día que dos
worktrees corran a la vez **con `storage.rules` distinto** — o sea, cuando alguien
esté cambiando esas reglas, que es justo cuando el test importa.

No hay arreglo dentro del emulador: sería un puerto de Storage por checkout, que es
la candidata que D-195 descartó. Si esto llega a molestar de verdad, el camino más
corto es un lock de archivo alrededor de `storage-reglas.integracion.test.ts`
—serializa un solo archivo, no la suite.

### B-734 · Con más de una fila de modalidad, el `location` de cada `subEvent` afirma más de lo que sabe — 🟡 hecho a medias (2026-09-09) · P3

> ✅ **Hecho con la primera de las dos salidas: el `subEvent` deja de heredar
> `location` cuando hay más de una fila.** La raíz lo sigue publicando —el conjunto
> de lugares es de la actividad y es cierto—, así que el item vuelve al estado
> incompleto que B-730 arregló, que es el que «Google tolera heredando del padre»,
> y no a un encuentro sin lugar en ninguna parte.
>
> **La segunda salida no se puede hacer desde la página, y ése es el hallazgo.**
> Repartir los lugares de verdad necesita `modalidades[].inicio`/`fin` en el
> view-model, y hoy esos dos campos son una fila explícita del «Qué NUNCA sale»
> (B-224, **D-130**). Aunque se usaran solo dentro del build para casar fila con
> encuentro, subirlos a `ModalidadPublica` es una decisión de `toPublic` y no de
> esta salida. Es lo que hay que decidir el día que aparezca la primera actividad
> con dos filas.
>
> **Un detalle que el ítem no decía y que ahora tiene test: la cuenta es de filas,
> no de lugares.** Una fila **híbrida** produce un `Place` y un `VirtualLocation`,
> y de esa fecha las dos cosas son ciertas a la vez, así que conserva su
> `location`. Escribir la guarda sobre la cantidad de lugares —que es lo que uno
> escribe leyendo «con más de un lugar no se sabe»— rompe el ciclo híbrido, que sí
> es un caso real de hoy.
>
> **`eventAttendanceMode` no se tocó, y está argumentado en el código:** con filas
> mixtas dice «esto se cursa de las dos formas», que es una propiedad de la
> actividad; `location` nombra lugares concretos, que es la afirmación fina. Si el
> reparto de verdad llega, los dos se resuelven juntos.

**Lo derivó el `auditor-privacidad` auditando B-730, y lo clasificó como
honestidad de datos y no como privacidad — con razón: no hay fuga.**

Con `modalidades.length > 1` (B-224, «presencial los martes y por Meet los
jueves») la serie decía «esto ocurre en estos lugares» y cada `subEvent` pasa a
decir «*esta fecha* ocurre en todos ellos». `modalidadDeDetalle` no lleva el
`inicio`/`fin` de la fila al view-model, así que el JSON-LD **no puede** saber
qué encuentro va con qué lugar.

No dice más que la página, que tampoco los reparte, y el conjunto de lugares ya
era público y es el mismo. Pero es una afirmación más fina que el dato que la
respalda, o sea que roza la regla 6 del §5.3.

**Hoy es hipotético y por eso es P3:** de las 68 actividades publicadas,
**ninguna** tiene más de una fila (verificado sobre el `events.json` real). El
caveat quedó escrito en la regla 7 del §5.3 y en el docblock de
`datosEstructurados`, que es lo que hace que no se pierda.

**Las dos salidas, si el caso aparece:** omitir `location` en el `subEvent`
cuando hay más de una fila —vuelve a dejarlo incompleto, que es lo que B-730
arregló—, o llevar las fechas de la fila al view-model y repartir los lugares de
verdad. La segunda es la buena y es más grande que este ítem.

---

## Agentes y automatización del flujo (B-115 a B-124)

Lo que quedó pendiente al definir los agentes y skills de `.claude/`. El qué hay
y por qué está en [`13-agentes.md`](13-agentes.md). La prioridad va en cada ítem.
