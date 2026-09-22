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
> Lo que ningún archivo sabe es un id **reservado por una tanda y nunca
> escrito**: esos hay que buscarlos a mano en los ítems que los reservaron.

> **Rangos reservados por la tanda del 2026-09-22 — los `B-` del 1150 al 1199 y
> las `D-` de la 751 a la 770.** Esto es **B-1051 aplicado a sí mismo**: ese ítem
> dice que un id reservado por una tanda y nunca escrito se ofrece como libre,
> porque la reserva no queda escrita en ningún lado que el tablero pueda leer.
> Acá queda, y **al abrir la tanda**, que es el momento en que el ítem señala que
> nadie se acuerda de anotarlo. Cinco frentes, de diez en diez: `decisiones-2`
> desde el 1150, `instagram` desde el 1160, `analitica-doc` desde el 1170,
> `calendario-ig` desde el 1180 y `form-ig` desde el 1190. Del 1200 al 1219 los
> tomó una sesión hermana que trabajó B-1112 y B-1121 en paralelo, con las `D-`
> de la 771 a la 774. Los números 1148 y 1149 quedaron de margen.
>
> **Los extremos de un rango se escriben así, sin la forma `B-nnnn`, y no es
> capricho:** la primera versión de esta nota los escribió con el prefijo y
> `items-referenciados.mjs` los leyó como **citas**, así que la nota que existe
> para no perder ids se convirtió ella misma en cinco huérfanos y puso el chequeo
> en rojo. Es la misma clase que esa red persigue, producida por la nota que la
> documenta. **Lo que sobre al cerrar se anota como hueco acá**, con esta misma
> nota reescrita — si no, es exactamente el agujero que B-1051 describe.

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
| DEC-6 | ~~**El nombre está: «Agenda LEH — Leer, Escribir, Hacer».** Falta **registrar el dominio**~~ — **el dominio está: `agendaleh.ar`, registrado y elegido como canónico el 2026-09-02 (D-165), y con él se cerró B-109.** El **handle de Instagram es `@librosdelatiahildita`**, decidido el 2026-09-03: con eso DEC-6 queda cerrada entera. Lo que sigue abierto son las decisiones #4 a #8 del §11.1, ninguna bloqueante. (El texto original decía que faltaba el handle (#2) y las decisiones #4 a #8 del §11.1, ninguna bloqueante. El texto original: | Resuelto el 2026-08-27. Era el bloqueo de la cadena entera: sin nombre no hay dominio, sin dominio no hay `site`, y sin `site` no hay canonical, ni Open Graph, ni sitemap — o sea B-109 y con él **B-01 a B-114**. El acrónimo hace trabajo: «LEH» es corto para la marca y «Leer, Escribir, Hacer» funciona como la línea de qué es, que también hacía falta (va en `og:site_name`, en el `Organization` y en las cinco imágenes de OG). Y «Hacer» abre el paraguas más allá de talleres y clubes, que es donde entraron «Feria» y «Librería a la calle». **Lo que falta decidir es qué parte del nombre va en el dominio** —el completo es largo para una URL— y registrarlo antes de que se indexe nada. Sigue abierto además el handle de Instagram (#2, ya decidido el canal) y las decisiones #4 a #8 del §11.1 de [`12-sitio-publico.md`](12-sitio-publico.md), que ya no bloquean: el sitio se puede empezar. |

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

---

## Pendiente de acción manual del dueño

### ⚠️ Sembrar `tipo-biblioteca` en producción — bloquea el deploy por `push` desde el 2026-09-17

**Un comando, y es de quien tiene las credenciales de producción** (§5.4: un
agente no las toca):

```bash
npm run opciones:sembrar:prod
```

Crea **solo los documentos que faltan** y no pisa lo que alguien haya creado con
«Otro». El rebuild del sitio se dispara solo al escribir en `/opciones/*`
(trampa 8), así que los chips aparecen en la corrida siguiente.

**Qué está pasando mientras tanto:** `/opciones/tipo-biblioteca` no existe en la
base, así que el desplegable «tipo de biblioteca» sale vacío en el formulario
público de `/guia/bibliotecas/sumar` y en los chips del sitio. En el **panel** se
ve bien —`leerOpciones` cae de vuelta a `opciones-base.json`—, que es justamente
lo que hizo que nadie lo notara con las otras doce taxonomías (B-973).

Y **el deploy por `push` a `main` viene fallando por esto desde que entró
bibliotecas**; el sitio se publicó igual porque el otro camino no corre el
chequeo, que es **B-1139**.


Código terminado, no se puede avanzar sin credenciales que un agente no debe
crear ni ver (§5.4).

### B-1124 · Las cinco fichas que B-976 dejó para corregir a mano: ¿siguen cruzadas? · P3 — solo se ve en el panel

**Sobrante declarado adentro de B-976** (la migración de `/opciones/barrio`, ✅
2026-09-17): su propio título dice «quedan 5 a mano», y lista cinco actividades
con `barrio` y `ciudad` incoherentes —CABA contra provincia de Buenos Aires,
Núñez contra Neuquén— esperando que las corrija el dueño.

**Nadie confirmó nunca que se hayan hecho, y no se puede confirmar desde el
repo:** es dato de producción. Lo que sí está verificado es que el mecanismo de
soporte sigue vigente y con tests (`src/lib/reubicacion-de-barrio.mjs`) y que
**se niega a adivinar a propósito**: marca «ambiguo» y no reubica solo, que es lo
correcto y también el motivo de que estas cinco queden a mano.

**Y hay un segundo número, más nuevo y distinto, que conviene no confundir:**
`docs/CHANGELOG.md:337-338` dice «quedan 9 sedes para el dueño», de un backfill
posterior (`sembrar-geografia.mjs`). No son las mismas cinco.

**Qué hacer:** mirar en el panel si esas cinco fichas siguen cruzadas. Si ya
están, esto se cierra con una línea; si no, son cinco ediciones. Lo que no puede
seguir es que nadie sepa cuál de las dos es.

### B-836a · App Check: registrado y cableado, **falta publicar, verificar y exigir** · P1

**Los dos primeros pasos están hechos el 2026-09-09**, y el que faltaba lo hizo
el dueño: creó la clave de sitio de **reCAPTCHA Enterprise** y registró la app
web en App Check. Con la clave en mano se cableó el cliente en el mismo día
(`src/lib/appcheck.ts`, llamado desde `app()`). La forma completa —proveedor,
costo, modo de falla y lo que **no** va— está en
[`02-infraestructura.md`](02-infraestructura.md) → «App Check».

**Y era Enterprise, no v3 clásico.** La primera versión de este ítem decía
«reCAPTCHA v3» porque era lo que se asumió. No son intercambiables: cada
proveedor valida contra un servicio distinto, así que con `ReCaptchaV3Provider`
el token se rechazaría — y ese error **no se ve hasta que el enforcement está
activo**, o sea el peor momento posible. Lo fija `tests/appcheck.test.ts`.

**Lo que sí está hecho, y en qué orden se hizo:**

1. ✅ **Consola** — clave de sitio de reCAPTCHA Enterprise (score-based) + app web
   registrada en App Check. Queda en «no exigido»: se mide, no se rechaza.
2. ✅ **Código** — `src/lib/appcheck.ts` con `ReCaptchaEnterpriseProvider`,
   activado desde `app()` de `firebase-client.ts` para que esté inicializado
   **antes de la primera llamada a Firestore**. La clave va en
   `PUBLIC_RECAPTCHA_SITE_KEY` (`.env.production`), pública por diseño.

**Lo que falta, y los tres son del dueño:**

3. ✅ **Verificar los dominios permitidos de la clave** — hecho el 2026-09-10, **y
   estaba mal**: la lista tenía los dos nombres propios (`agendaleh.ar`,
   `agendaleh.com.ar`) y **le faltaban los dos de Firebase Hosting**. Con el
   enforcement puesto, entrar al panel por `agenda-literaria.web.app` —que según
   `02-infraestructura.md` «no se apaga nunca»— habría dejado de poder escribir, y
   habría fallado como «el panel no guarda» y no como «App Check te rechazó».
   Corregido a los cuatro, con `allowAllDomains: false` e `integrationType: SCORE`
   confirmados. El detalle —por qué van con el nombre completo del sitio y nunca
   `web.app` pelado, y por qué el comando necesita `--web`— está en
   `02-infraestructura.md` → «App Check». Era el paso del que
   depende que todo esto sirva. La clave de sitio es pública y viaja en el bundle,
   así que lo único que impide que un script la use desde su propia página es esa
   lista. Sin ella, App Check deja de frenar «al script que no pasa por la
   página» —lo único que hace— y encima le consume la cuota facturable de
   Enterprise. Lo señaló el `auditor-privacidad`, y es la clase de B-773: es
   configuración, así que **ningún test lo sostiene**.

   ```sh
   gcloud recaptcha keys describe <clave> --project agenda-literaria
   ```

   `webSettings.allowedDomains` tiene que listar los **cuatro** nombres que sirven
   el sitio —`agendaleh.ar`, `agendaleh.com.ar` y los dos de Firebase Hosting— y
   nada más. Que sean cuatro y no tres es lo que la primera versión de este paso
   no había previsto: el alias `.com.ar` también sirve el mismo HTML.
4. ✅ **Publicar** — hecho el 2026-09-10. Eran **44 commits** desde el 2026-09-08:
   producción venía de antes de todo el cableado, así que publicar App Check fue
   publicar también la bandeja, la retención, `/proponer` y las dos tandas enteras.
   El gate de pre-push y los seis jobs del workflow pasaron.
5. 🔸 **Verificar que llegan peticiones verificadas.** La mitad mecánica está
   hecha el 2026-09-10, contra el bundle de producción, y descarta los tres modos
   de falla silenciosa: el chunk publicado tiene la clave inlineada, la pasa
   `app()` a `activarAppCheck` con `usarEmuladores: false`, y el script que
   referencia es `recaptcha/enterprise.js` y no el `api.js` del v3 clásico. O sea
   que no es `sin-clave`, no es `emuladores` y no es el proveedor equivocado.

   **La otra mitad es del dueño y no se puede saltear**: la consola de Firebase es
   lo único que dice si los tokens **llegan y se aceptan**, y necesita tráfico real
   —entrar al panel y guardar algo—. Lo que hay que ver antes del paso 6 es que las
   peticiones propias figuren como **verificadas**; exigir con la consola en cero
   deja el panel sin poder escribir y el diagnóstico cuesta arriba.

   De verificar esto a mano salió **B-868**: nada en el repo sostiene que el
   artefacto construido lleve App Check.
6. 🔸 **Exigir — Firestore hecho el 2026-09-10, Storage pendiente y a propósito.**
   `firestore.googleapis.com` quedó en `ENFORCED` a las 17:42 UTC, con el panel
   verificado inmediatamente después: entra, lee y guarda. `identitytoolkit`
   (Auth) **no se exige** —está en versión preliminar y si algo sale mal el que no
   puede entrar al panel es el dueño— y `firebasestorage` **tampoco todavía**: su
   métrica marcaba **1% verificado**, y hay que entender qué es ese 99% antes de
   tocarlo. La sospecha es que son las lecturas públicas de imágenes por URL de
   descarga —un GET anónimo del navegador, que no lleva token—, y si el
   enforcement las bloqueara **se caen todas las fotos del sitio**. Eso se
   averigua antes y no después: es **B-872**.

   El paso 1 se cerró con la prueba directa y no con la métrica: el registro de
   `firebase-app-check-database` en el navegador tenía un token para la app
   `…5b52810e`, emitido 17:32 y vencido 18:32 — exactamente el `tokenTtl: 3600s`
   configurado. Un token no existe si Firebase rechazó el desafío, así que eso es
   la verificación entera. La métrica de la consola, en cambio, **nunca va a
   llegar a 100%**: el build y las Functions leen con el Admin SDK, que no pasa
   por App Check y que el enforcement tampoco bloquea.

   Al revés del orden, **el panel deja de poder escribir**: sus
   peticiones tampoco traen token y las reglas ni se evalúan.

**Dos cosas que cambiaron respecto de cómo estaba escrito este ítem:**

- **El token de debug para los emuladores no hace falta**, y es mejor así. Los
  emuladores **no verifican** App Check, así que `appcheck.ts` no lo activa
  cuando `PUBLIC_USE_EMULATORS=true`. Con eso la suite de integración no depende
  de un tercero para correr, que es lo que un token de debug hubiera dejado a
  medias.
- **Enterprise tiene su propia cuota facturable** arriba del free tier, aparte de
  Firebase. Entra en el budget alert del §2.3, y el volumen de un formulario
  público es chico — el de un script que lo abusa, no.

**Y no reemplaza a las otras cuatro capas de B-836** (validación en la regla,
topes de tamaño y forma, honeypot, barrido programado): App Check frena al script
que no pasa por la página, y es la única de las cinco que depende de un tercero
—si reCAPTCHA no responde y el enforcement está activo, no se puede escribir—.
Hoy, con el enforcement apagado, un fallo de reCAPTCHA no rompe nada:
`activarAppCheck` no propaga la excepción.

---

## P0 — rompe algo o pierde datos

> **Tres abiertos desde el 2026-09-18, los tres del chrome del sitio público y
> los tres con capturas del dueño.** No pierden datos: lo que rompen es la
> **primera pantalla**, que es por donde entra todo el mundo. Van acá porque el
> dueño los pidió con máxima urgencia y porque dos de los tres se ven **rotos**,
> no mejorables. Se atacan de a uno.

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

### B-1182 · El índice de salidas públicas no nombra a dos productores de la descripción del evento · P1 — del `auditor-privacidad` sobre el cierre de B-1145 (2026-09-22)

> **🟡 Las tres tablas ya lo nombran (2026-09-22)** — `docs/07-seguridad.md`,
> `.claude/agents/auditor-privacidad.md` (fila 2 y el `description`) y
> `.claude/skills/campo-nuevo/SKILL.md`—, y `tests/agentes-y-skills.test.ts` las
> sostiene: al escribirlas se puso **en rojo** nombrando los cuatro productores
> que faltaban, que es exactamente para lo que existe. **Lo que queda abierto es
> la red de B-1161**: ese chequeo exige las *funciones* de la celda, pero toma el
> **primer** archivo como «el productor», así que un archivo agregado a la celda
> y no al `description` todavía puede pasar.

`arrobaInstagram` **decide texto visible del calendario público**: el
`@casabrandon` de la descripción. Es productor de la salida 2 en el mismo sentido
exacto en que `src/lib/handle-instagram.mjs` es productor de la salida 6 — y la
fila 6 lo dice con todas las letras desde B-1141 («un cambio que toque solo ese
archivo tiene que despertar esta auditoría»). La fila 2 nombra solo
`functions/calendario.js`.

**Consecuencia concreta:** un diff que toque **solo**
`functions/handle-instagram.js` —ampliar el alfabeto, sacar el corte del
`?igsh=`, invertir el orden de los `replace`— no dispara la auditoría por nombre
de archivo, y reescribe texto de un calendario que ya está copiado en
dispositivos ajenos. Es el modo de falla que B-863/B-896 dejaron escrito para
`functions/propuestas*.js`.

**Hay una instancia hermana, pre-existente y nunca anotada:**
`functions/geografia.js` (`geografiaNormalizada`, vía `piezasDeDireccion`)
produce la dirección del bloque «Dónde» del mismo evento y tampoco está en
ninguna de las tres tablas — `src/lib/geografia.mjs` sí está, pero para la salida
11. El arreglo es la misma línea, y por eso van juntos.

**Y el mismo agujero tiene una tercera instancia, de otro frente de la misma
tanda:** el archivo que decide cómo se escribe un handle no está nombrado en la
fila de la salida 5 (el texto para redes) — eso es **B-1161**. Los dos se cierran
con la misma pasada por las tres tablas.

**Tres tablas atadas, las tres a mano:** `.claude/agents/auditor-privacidad.md`
(fila 2 y el `description`), `docs/07-seguridad.md` (fila 2) y
`.claude/skills/campo-nuevo/SKILL.md`. En cuanto entren, los `it` de
`tests/agentes-y-skills.test.ts` los sostienen solos.

### B-1112 · El aislamiento del emulador cubre Firestore y **no** Auth, y por eso un uid viejo da verde donde uno nuevo da rojo — ✅ hecho (2026-09-22) · P1 — de `frente/bibliotecas` (2026-09-17)

> **✅ Hecho el 2026-09-22, en dos tramos y con la decisión que quedaba movida a
> su propio ítem.** La salida **(a)** —que `tests/emulador.ts` detecte el
> desajuste y falle nombrándolo— entró el 2026-09-17 en `b8a5068`:
> `verificarProyectoDeAuth` está cableada en
> `tests/fixtures/credenciales-del-emulador.ts:139`, o sea que corre en el primer
> login de **todo** test de integración, y tiene test propio en
> `tests/proyecto-de-auth.test.ts` (9 casos). La salida **(b)** ya estaba: el gate
> levanta un emulador por corrida. Lo que faltaba era la segunda mitad de la
> pregunta de abajo —«o los tests de integración dejan de derivar el `projectId`
> por su cuenta»—, que es **B-1111**, cerrado hoy.
>
> **Verificado contra el emulador vivo el 2026-09-22, que es lo que faltaba:** con
> un emulador levantado en `…-57a98788` y los tests forzados a `…-0326695e`, la
> detección dispara en el primer login, nombra los dos proyectos, nombra la causa
> y dice qué hacer; los 10 casos del archivo quedan **skipped** en vez de rojos
> con `PERMISSION_DENIED` sobre un documento válido, que era el síntoma caro. Con
> los proyectos coincidiendo, 10/10 verde. O sea que (a) no es un test con un JWT
> sintético: funciona contra el sistema real.
>
> **Lo que NO se hizo es la salida (c)** —sembrar los claims contra el `aud`
> real—, y no se hizo porque es una decisión abierta y no trabajo pendiente: sale
> como **B-1201**. Se cierra este ítem en vez de dejarlo esperando porque **un
> ítem hecho en su mayor parte y listado como abierto ya costó una vez**: se leyó
> como pendiente cuando (a) estaba en `main` hacía días, y otra sesión estuvo a
> punto de rehacerlo. Es el caso que **B-1170** vino a cerrar.

**Es la causa que faltaba abajo de B-1021 y de B-1030**, los dos cerrados hoy
sin ella. B-219 deriva un `projectId` por working-tree (sha256 de la ruta) para
que dos worktrees no se pisen la base. Funciona para Firestore. **Auth no.**

Medido desde `frente/bibliotecas`:

    PROJECT_ID (el derivado del worktree)      agenda-literaria-0326695e
    aud del ID token del cliente               agenda-literaria-c7201d89
    claims.admin                               undefined

El Admin SDK escribe el custom claim en el proyecto **del worktree**; el cliente
se autentica contra el proyecto **con el que se levantó el emulador**. Son dos
namespaces de Auth distintos: el uid con claims no existe del lado donde el
cliente entra, y `esAdmin()` da `false`.

**Lo que esto explica, y es lo que lo hace P1:**

- **B-1021** — los cuatro rojos de `rol-publicador.integracion.test.ts` desde
  cualquier worktree, con CI y el árbol principal en verde. El ítem dejó la
  hipótesis escrita y sin confirmar. Ésta es la confirmación.
- **B-1030** — «`storage.rules` no ve el claim que llega por el registro». Se
  cerró midiendo 19/19 en el árbol principal, donde los dos proyectos coinciden.
  La conclusión era correcta y el mecanismo faltaba: no era Storage.

**Y el síntoma es un falso verde, que es lo peor de todo.**
`tests/librerias.integracion.test.ts` pasaba **60/60 desde un worktree** — no
porque funcionara, sino porque `uid_librerias_admin` **ya existía con sus
claims** en el store del emulador, de una corrida vieja en el árbol principal. Un
uid **nuevo** (`uid_bibliotecas_admin`) se pone rojo con el mismo código. O sea
que el error no aparece cuando se rompe: aparece meses después, cuando alguien
agrega una entidad nueva, y llega como `PERMISSION_DENIED` sobre un documento
perfectamente válido — así que el primer lugar donde se lo busca es
`firestore.rules`, que no tiene nada que ver. Es B-894 con otra cara: el
desajuste de proyecto apaga solo lo que las reglas **otorgan**.

**El mecanismo, y esto es lo que hay que entender antes de tocar nada: un
emulador limpio NO lo arregla.** El emulador de Auth es de **un solo proyecto**
—el de su `--project` de arranque— y no particiona como sí hace Firestore.
`createCustomToken` lo mintea para el proyecto del Admin SDK, el emulador lo
acepta igual y emite el ID token **para el suyo**. `npm run emu` levanta con
`--project "$(node scripts/project-id-emulador.mjs)"`, derivado de la ruta del
checkout **desde donde se lo corre**: o sea que el emulador es de quien lo
prendió, y coincide con el cliente solo para ese checkout. No es que los
worktrees estén rotos.

**El arrastre, aparte, ya no existe:** el emulador de seis días se paró el
2026-09-17 y había arrancado **sin `--export-on-exit`**, así que su estado era
memoria y se fue entero. La próxima corrida de `librerias.integracion.test.ts`
desde un worktree va a ser la primera sin uid preexistente — y si
`uid_librerias_admin` ya no está, ese archivo cae por lo mismo.

**Repro determinística** (el `uid_${Date.now()}` es lo que la hace determinística:
con un uid fijo, la segunda corrida pasa por el arrastre que dejó la primera).
El archivo tiene que terminar en `.integracion.test.ts` para caer en el glob que
exporta las variables de entorno:

```ts
const uid = `uid_probe_${Date.now()}`;            // nuevo: sin arrastre
await a.createUser({ uid });
await a.setCustomUserClaims(uid, { admin: true });
const t = await a.createCustomToken(uid);
const res = await (await signInWithCustomToken(auth(), t)).user.getIdTokenResult();
expect(res.claims.aud, 'el cliente entra a otro proyecto').toBe(PROJECT_ID);
expect(res.claims.admin).toBe(true);
```

### Medido el 2026-09-17, contra un emulador efímero — dos puertas cerradas

**1 · El endpoint de config del emulador de Auth NO sirve como detector.**
`tests/emulador.ts` ya consulta
`/emulator/v1/projects/${PROJECT_ID}/config` para saber si el emulador está
vivo, y descarta el status con un `< 500`. Parecía que ajustarlo a `=== 200`
alcanzaba. No alcanza: levantando con `--project …-aaaaaaa1` y pidiendo la
config de `…-zzzzzzz9`, las dos devuelven **200 y el mismo body**.

**2 · Y `"singleProjectMode": false` tampoco lo arregla, aunque el propio
emulador lo recomiende.** Al pedirle un proyecto ajeno, el emulador avisa por
stderr: «Multiple projectIds are not recommended in single project mode …
To opt-out add/set the `singleProjectMode` false property». `firebase.json`
lo tiene en `true` explícitamente, así que era la salida más barata imaginable.
Corrida la repro completa con el flag en los dos estados:

| `singleProjectMode` | `aud` del ID token | `claims.admin` |
|---|---|---|
| `true` (hoy) | `…-aaaaaaa1` (el del emulador) | `undefined` |
| `false` | `…-aaaaaaa1` (igual) | `undefined` |

**El flag controla el aviso, no el particionado.** El emulador de Auth sirve un
solo proyecto y no hay configuración que lo cambie. Queda escrito para que nadie
vuelva a probar esa puerta: parece la respuesta y no lo es.

**Lo que sí queda especificado por la medición:** la señal del desajuste es
`aud !== PROJECT_ID` después del primer `signInWithCustomToken`. No hay que
inventar el criterio — la repro de arriba ya lo mide.

**Tres salidas, y la primera es la que conviene hacer primero** porque ataca el
daño real —las horas de diagnóstico— y no cuesta casi nada: (a) que
`tests/emulador.ts` **detecte el desajuste y falle con un mensaje que lo nombre**,
en vez de dejar que se manifieste como `PERMISSION_DENIED` sobre un documento
válido; (b) que el gate levante un emulador por corrida, que es lo que
`verificar-todo.sh` ya hace; (c) sembrar los claims contra el `aud` real,
leyéndolo de un primer token.

**Qué habría que decidir**, y por eso no se cierra acá: o el emulador se levanta
con el `projectId` del working-tree que lo usa —que es volver a una tanda de
emuladores por worktree, lo que B-219 quiso evitar—, o los tests de integración
dejan de derivar el `projectId` por su cuenta y leen el del emulador vivo. La
segunda es la que se parece a lo que ya hace `scripts/emuladores-arriba.sh`, y
se apoya en el mismo argumento que **B-1111**: un valor derivado dos veces
diverge.

~~**Pendiente de verificación, y no se cuenta como verde:**
`tests/bibliotecas.integracion.test.ts` —37 casos, los que prueban lo que la
regla **rechaza**— está escrito y commiteado y **no pudo correr** por esto.~~

> ✅ **Ya corrió, y esta parte del ítem estaba vieja.** El cierre de B-960 lo
> decía («la corrida llegó después») y acá no se había actualizado, así que el
> ítem seguía afirmando que había 37 casos sin verificar. **Remedido el
> 2026-09-18 contra el emulador: 36/36 en verde** (36 y no 37: el conteo viejo
> tampoco era el de hoy). Lo que sigue abierto de B-1112 es el mecanismo —el
> aislamiento del emulador de Auth—, no la verificación de bibliotecas.

El proyecto existe para que la gente encuentre los talleres en Google (§2.3). Hoy
eso todavía no pasa, pero por un motivo distinto que antes: **el sitio existe y no
está desplegado.** Falta elegir el dominio (B-109), sin el cual no hay canonical ni
sitemap, y falta el rebuild automático (B-20).

Y desde el 2026-09-01 hay un segundo frente medido: **el flyer**. B-263, B-264 y
B-265 arreglaron el recorte, sacaron el campo de donde estaba escondido y le dieron
pared propia. El **peso** era B-266 y **quedó resuelto del todo el 2026-09-02**
con la Function de B-220 (D-175) y el `srcset` de **B-320**: la página más pesada
del sitio pasó de 3226,7 KB a 184,3 KB y el recorrido de la cartelera de 3518,5 KB
a 1032,4 KB. Lo que queda de ese frente es un paso manual del dueño: los permisos
de IAM sobre el bucket, y después `scripts/optimizar-imagenes.mjs`.

### B-930 · Con App Check exigiendo, un token que no llega se lee como «no hay internet» — y nadie se entera de cuál de las dos es · P1 — reportado por el dueño (2026-09-15)

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

### B-897 · `/guia` es una salida pública indexada y no está numerada · P1

**Del `auditor-privacidad`.** Es HTML indexado, enlazado desde la barra, con texto
escrito a mano: la clase de las filas 13 a 18, que se decidió numerar **por la
promesa y no por la proyección**. El precedente para no numerarla sería
`/proponer` — pero aquélla está fuera del sitemap **y** fuera del chrome, y tiene
su propio párrafo en `07-seguridad.md`.

**Actualizado el 2026-09-11:** la tajada de librerías metió sus **dos** salidas en
las tres tablas en el mismo cambio que las creó, así que la cuenta pasó de
diecinueve a **veintiuna** — pero `/guia` sigue sin numerar. O sea que lo que
faltaba sigue faltando, con un número distinto.

O la fila que le toque en las tres tablas atadas (`docs/07-seguridad.md`, la ficha
del `auditor-privacidad`, `campo-nuevo/SKILL.md`) con su celda «no proyecta ningún
documento», o el párrafo que diga por qué no. Lo que no puede quedar es sin
decidir: cuando `/guia` tenga párrafos de verdad va a ser la página que presenta
tres directorios cargados con datos de terceros.

### B-893 · El publicador tiene que poder crear etiquetas, y eso es exactamente lo que B-28 dejó para cuando entrara una tercera cuenta · P1

> **Pedido del dueño el 2026-09-11, en dos mitades:** «La cuenta acotada NO puede
> cargar bugs y las etiquetas nuevas entran sin aprobar derechos.»
>
> **La primera mitad ya está construida así** y no hay nada que hacer: `/reportes`
> tiene `allow read/create/update: if esAdmin()` en las reglas y el botón no se le
> dibuja al publicador (`ReporteFormulario.tsx` lo dice explícito). El rol no puede
> cargar bugs ni ver los de nadie.
>
> **La segunda contradice lo que se construyó**, y no por olvido. Hoy el publicador
> **no puede crear etiquetas en absoluto**: el panel no le ofrece «Otro…»
> (`campos-del-panel.tsx`) y el guardado saltea `upsertOpcion()` y `registrarUsos()`
> (`formulario/guardar.ts`). Eso salió de la tajada 1: `/opciones/{campo}` es un
> documento **compartido por todo el sitio** —los chips de filtro salen de ahí
> (§4.4)— y **las reglas no pueden inspeccionar qué elemento del array `valores`
> cambió**. A nivel de regla, «agrega una opción con Otro» y «reescribe la taxonomía
> del sitio entero» son **el mismo permiso**: `allow write` sobre ese documento
> también deja borrar valores, dar vuelta `fijo` y aprobar lo que quiera, sin una
> sola cláusula que lo verifique.
>
> **O sea que `aprobada: false` no alcanza como salvaguarda.** Marcar la etiqueta
> como no aprobada resuelve que no aparezca en el desplegable de los demás, que es
> lo que pide el dueño; no resuelve que la misma escritura pueda pisar el resto del
> array. Las dos cosas van juntas o la segunda anula a la primera.

**Los dos caminos que sí son verificables**, en orden de costo:

1. **Una Function que hace el upsert** (`onCall`), y el rol sigue sin `write` sobre
   `/opciones/*`. La Function corre con el Admin SDK, así que puede leer el array
   anterior, verificar que lo único que cambió es **un elemento agregado** con
   `aprobada: false` y `usos: 1`, y escribir. Es el único lugar donde eso se puede
   verificar — ya estaba escrito así en el comentario de `firestore.rules` desde la
   tajada 1, y es el mismo camino que haría falta para que los `usos` del rol
   cuenten. Cuesta: una Function nueva, el camino de error en el guardado (hoy
   `registrarUsos` falla en silencio a propósito, y por acá no puede), y volver a
   mostrarle «Otro…» al panel del rol.
2. **Una colección aparte de etiquetas pendientes** (`/opciones-propuestas/{id}`,
   un documento por etiqueta). Ahí sí la regla verifica todo —conjunto exacto de
   campos, `creadoPor == request.auth.uid`, `aprobada` ausente— porque es un
   documento propio y no un elemento de un array. Cuesta más de panel: la pantalla
   de taxonomías gana una bandeja, y el admin aprueba moviendo el valor al array.

**Esto es B-28 volviendo.** Se cerró con «no, queda como está… vuelve cuando entre
una tercera cuenta que no sea de confianza». El publicador **es** esa cuenta: el
`aprobada: boolean` del §4.3 —que se había dejado explícitamente para «si en el
futuro carga gente además del dueño»— pasó de hipotético a pedido. Y **B-29**
(auto-aprobar la etiqueta que una segunda cuenta reusa) queda del otro lado del
mismo camino: cualquiera de los dos mecanismos de arriba es dónde vive.

**No arrancar sin que el dueño elija entre 1 y 2.** Lo que cambia entre los dos no
es el esfuerzo sino quién aprueba y dónde se ve: en (1) la etiqueta ya está en el
array, marcada; en (2) está afuera hasta que alguien la mueva.

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

### B-891 · El `libro` de DEC-1 está hoy como estaba el tallerista antes de B-861 · P2

**Lo encontró el frente de B-885** cerrando la convergencia del tallerista, y es la
misma clase con otro campo. Cuatro derivaciones de «¿hay libro?», y **dos están
mal**:

| Dónde | Predicado | |
|---|---|---|
| `formADocumento` | `?.titulo?.trim()` | ✅ |
| `libroDelPosteo` (`textoRedes.ts`) | `?.titulo?.trim()` | ✅ |
| `libroPublico` (`toPublic.ts`) | `l?.titulo` sin trim | ❌ |
| `detalleDeActividad` (`detallePublico.ts`) | **gatea por el objeto** | ❌ |

**La consecuencia es medible y está en la salida con SEO:** con
`{ titulo: '   ', autor: 'Bolaño' }` la página de detalle renderiza **«Se presenta
    , de Bolaño»** —el rótulo colgado en HTML indexado— y el `events.json` lleva el
objeto con el título vacío.

El camino de entrada es el mismo que el de B-885 y B-861: un escritor de afuera del
panel, o una restauración del historial. Y el arreglo es el mismo predicado que ya
usan las otras dos — no una quinta variante.

**Y la raíz de la clase, que vale más que este ítem:** `texto = z.string().trim()`
produce un `parsed.data` limpio que **ningún escritor usa**. `guardar.ts` valida con
`safeParse` y escribe `candidato`; `issuesDeRestauracion` valida y `restaurarCampo`
escribe el payload crudo. Por eso «un campo con espacios» reaparece salida por
salida en vez de resolverse una vez. Arreglarlo de raíz —escribir `parsed.data`— es
barato de decir y caro de verificar: cambia el valor almacenado de **todo** campo de
texto, o sea el payload del §7.2 para los documentos con espacios, o sea que le
reescribe el evento a quien lo tiene agendado. **Es una decisión, no un arreglo.**

### B-886 · El chequeo de frescura no ve la edición de una actividad ya listada · P3

Sale de B-882. El conjunto de slugs no cambia cuando se edita el título de una
actividad que el sitio ya muestra —el slug es inmutable después de publicar,
trampa 10—, así que un build que deja de correr después de una **edición** pasa
inadvertido hasta la próxima alta o baja.

**Lo que no se hace, y el motivo importa:** comparar el contenido de cada entrada
es rederivar `toPublic`/`entradaDeIndice` dentro de una Cloud Function, y
terminaría avisando de **sus propias diferencias** — la clase de B-88. El conjunto
de slugs es la comparación más grande que no duplica ninguna derivación.

Lo que sí puede servir ahora que B-884 cerró: comparar el `generadoEn` del índice
contra `despacho.cubreHasta` de `sistema/rebuild`, que es una comparación de **dos
marcas del pipeline** y no de dos derivaciones del documento.

### B-879 · La «red» de un barrido no es un `fetch`: es la corrida entera · P3

**Salió de B-867**, y es el ítem que ese cierre deja anticipado. El chequeo de la
clase de B-85 define `red` como «habla con un servicio de afuera» y la reconoce por
`fetch(`, `cal.events.` y `google.\w+(`. Con esa definición **los tres barridos
quedan afuera de la clase por no tener red** — y ése es un motivo más débil de lo
que parece.

Entre la query que decide qué borrar y el `delete`, esos barridos hacen
round-trips: `bucket.file().delete()` por propuesta en retención, N borrados por
corrida en imágenes. Son latencia real, y durante toda esa ventana el estado que
se leyó al principio puede cambiar — que es **exactamente el daño que la clase de
B-85 nombra**. B-864 existió por eso.

**Si `red` se ensanchara a contar esos round-trips, `limpiarImagenesHuerfanas` y
`borrarPropuestasVencidas` se ponen rojos en el chequeo principal**, y la respuesta
correcta sería la guarda declarada de cada uno (`GUARDAS_DE_BARRIDO`, B-867). O sea
que la infraestructura para contestarlo ya está; lo que falta es la decisión de si
el chequeo tiene que exigir esa guarda en vez de aceptarla declarada.

Es una decisión y no un renglón: ensancharlo pone en rojo dos funciones que hoy
pasan, y la salida no es relajarlo sino decidir qué guarda le exigimos a un barrido
que borra.

### B-874 · «Interacciones con formularios» sigue prendido en GA4, y B-480 no lo apagó porque no había formularios · P2

**Sale del `auditor-privacidad` sobre B-847.** El Enhanced Measurement de GA4
tiene **cuatro** interruptores prendidos por default y B-480 apagó tres:
búsquedas en el sitio, `page_view` por historial y clics salientes. El cuarto
—`form_start` / `form_submit`, con `form_id`, `form_name`, `form_destination` y
`form_submit_text`— **no estaba en esa lista, ni en la tabla del §7.4, ni en
ningún checklist**, y el motivo estaba escrito con todas las letras en el §7.1:
«el sitio no tiene formularios».

**Esa premisa se cayó dos veces y nadie volvió a mirar el interruptor.** La
primera con `/proponer` (B-830), que es un formulario público de verdad y donde
lo que se manda **es texto que un tercero escribió**. La segunda con B-847. Lo
que se escapa con el consentimiento aceptado: que este `client_id` interactuó con
el formulario y lo envió, y a qué destino. **No se escapa el contenido de los
campos** —GA4 no manda valores— y por eso es P2 y no P1.

**Es configuración y no código: ningún test lo puede sostener**, igual que los
tres de B-480 y que los settings de propiedad de B-773. Lo que sí quedó atado es
que el checklist lo nombre. El paso está en `08-operacion.md` como bloqueante
junto al doble opt-in.

**Y hay que mirar `/proponer` aparte**, que es lo que este ítem no resuelve: ahí
el `form_submit` sale **hoy**, sin que la lista del correo exista.

### B-866 · Convertir no renueva el plazo, así que el barrido se lleva la propuesta con el formulario abierto · P3

**Es la mitad de B-864 que la precondición no puede cubrir**, y sale de la misma
lectura. `PropuestasPanel.convertir` **no escribe nada** en Firestore hasta que la
actividad se guarda (**D-600**: «convertir es prellenar, no importar»), así que
abrir el formulario sobre una propuesta vieja no mueve su `updateTime` y B-864 no
tiene contra qué proteger: el barrido de esa noche se la lleva con el formulario
abierto, y el `revisarPropuesta` de `alGuardar` falla con NOT_FOUND. Lo que queda
es la actividad creada y la propuesta desaparecida — el catálogo bien y **la prueba
de qué se pidió perdida** (§4.3 del PRD).

**La ventana es más ancha que la de B-864**, y es lo que lo hace un ítem y no una
nota: allá eran los segundos de una corrida, acá es todo el tiempo que el
formulario quede abierto.

Lo único que lo arregla es que abrir la conversión **sea** un movimiento de estado
—pasar la propuesta a `en-revision`, que es literalmente lo que está pasando— y eso
contradice D-600 tal como está escrita. Por eso es una decisión del dueño y no un
renglón: la pregunta es si «convertir no escribe nada» es la decisión, o si lo era
«convertir no escribe **la actividad**», que es el riesgo que D-600 argumenta (una
conversión abandonada dejando una `aceptada` que apunta a una actividad que no
existe). Marcarla `en-revision` al abrir no tiene ese problema: `en-revision` es
reversible, se ve en la bandeja y ya renueva el plazo por el reloj de B-844.

### B-1200 · `npm run emu` no arranca en la máquina del dueño, y el motivo no es del repo · P4 — de levantar el emulador para B-1112 (2026-09-22)

`npm run emu` levanta `auth, functions, firestore, hosting, storage, extensions` y
muere entero con «Could not start Hosting Emulator, port taken». **El 5000 lo tiene
`ControlCenter`** —el receptor de AirPlay de macOS, verificado con
`lsof -nP -iTCP:5000 -sTCP:LISTEN`—, no otro emulador ni una corrida colgada.

Lo que lo hace anotable y no una anécdota: **el emulador de Hosting no se usa para
nada en esta suite** —los tests de integración hablan con Firestore, Auth y
Storage— pero su puerto tomado se lleva puesta la tanda entera, así que el síntoma
es «no puedo correr ningún test de integración» y la causa es un servicio del
sistema operativo que no tiene nada que ver.

**La salida de hoy es `--only auth,firestore` (o `auth,firestore,storage`)**, que
arranca sin chistar. Las dos formas de cerrarlo de verdad, ninguna urgente: mover
el puerto de Hosting en `firebase.json` —`emulators.hosting.port`, que es
exactamente lo que sugiere el propio mensaje de error— o sacar `hosting` del
arranque por default. **Lo primero es preferible**: cambia una línea y no le saca
una capacidad al comando.

Va **P4** porque el costo actual es cero para quien ya sabe el atajo. Lo que este
ítem compra es que el próximo no pierda la tarde buscándolo en el repo, que es
donde no está.

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

### B-852 · Las versiones que quedaron rotas antes de B-560 siguen restaurando un 404 · P4

**Lo dejó anotado el frente que cerró B-560**, y es la mitad que aquel arreglo no
puede alcanzar: las imágenes que el barrido **ya borró** antes de que
`referenciasEnUso` mirara el historial no vuelven. Restaurar una de esas versiones
sigue devolviendo una fila con una `url` que da 404, y nadie avisa.

Es **P4 y no P3** porque la ventana es finita y **se cierra sola**: esas versiones
caducan con la retención de D-42 (20 por actividad) y con el barrido de B-89 (30
días para las huérfanas). Lo que queda es el caso de una actividad muy poco editada
cuya versión vieja sobreviva meses.

Si alguna vez se atiende, el camino es el 3 del ítem original —que restaurar avise
cuando la imagen ya no está— y vive en `src/lib/historial.ts` +
`HistorialActividad.tsx`, no en el barrido.

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

### B-842 · La regla no puede validar la forma de cada fecha de una propuesta · P2

**Sale de construir `/propuestas`** (B-830, paso 5), y es una limitación del
runtime y no un olvido: **una regla de Firestore no itera una lista**. De `fechas`
se puede acotar la cantidad (1–12) y el tipo, y no la forma de cada fila. Lo mismo
con los elementos de `incluye`: se acota cuántos, no el largo de cada uno.

O sea que el día que el `create` anónimo se abra, un `curl` va a poder mandar doce
mapas arbitrarios ahí adentro, con strings tan largos como el tope de **1 MB** del
documento permita. El schema de zod los rechaza y no cuenta: es lo primero que se
saltea.

**Por qué no bloquea nada, y por qué igual está anotado.** Nada de una propuesta
llega a una salida pública sin que **un admin la convierta en actividad**. El daño
posible es «el admin ve una fila rara en la bandeja» y una escritura facturada de
hasta 1 MB — molesto, no peligroso.

> ⚠️ **Corrección: lo que protege no es `actividadFormSchema`, es que un admin
> mire.** Esta entrada decía que la conversión «pasa por `actividadFormSchema` con
> su `superRefine` entero», y para **`incluye` eso no filtra nada**: ese schema lo
> declara `z.array(texto)`, o sea texto libre sin lista blanca. Lo cobró el
> `auditor-privacidad`, y el camino completo es: `toPublic` lo proyecta →
> `detallePublico` lo resuelve con `etiquetaDe` → `listadoPublico` cae a
> `desSlug(valor)` si el slug no está en la taxonomía. O sea que **un slug
> inventado se publica verbatim, des-slugueado, como texto visible en la página de
> detalle**, que es HTML indexado.
>
> Y es el campo donde «el admin lo va a ver» es **más débil**, no más fuerte: doce
> chips que parecen taxonomía se leen como taxonomía. `titulo` y `descripcion`
> corren por el mismo camino y ahí el ojo humano sí alcanza, porque son texto que
> se lee entero.
>
> **El arreglo no es de la regla: es una línea de la conversión** (`propuestas.ts`,
> paso siguiente del PRD): `incluye.filter((s) => slugsConocidos.has(s))`, y lo que
> no esté en la taxonomía cae a `incluyeOtro` para que el admin decida — que es
> exactamente el mecanismo que el § 4.2 del PRD ya definió para el «Otro». **Va con
> `propuestas.ts`, no después**, y su test es
> `it('la conversión descarta los `incluye` que no están en la taxonomía')`. Lo que sí importa es que esté **escrito como
asimetría y no como garantía**: `tests/propuestas.test.ts` tiene un caso que
afirma que las expresiones de fecha viven **solo** en el schema y que la regla
**no** las tiene, así que si alguien las agrega ahí, el test se pone rojo y hay que
venir a decidir qué quedó cubierto. La primera versión de ese caso afirmaba lo
contrario —que la regla las repetía— y era falso.

**Dónde y el molde, si aparece abuso.** No es del lado de la regla: es una
Function `onDocumentCreated` sobre `/propuestas` que valide la forma fila por fila
y marque —o borre— la que no pasa. Hay dos moldes: el barrido programado que B-836
pide para la bandeja, y `functions/reportes.js`, que ya hace validación del lado
del servidor sobre algo que entró por el cliente. **No hacerlo antes de tener el
problema**: es una Function más para cubrir un caso que hoy nadie ejerce, y el
techo de 1 MB ya lo acota.

Y hay una defensa que llega antes y no es ésta: **App Check** (B-836a). El script
que manda doce mapas de 80 KB es exactamente el que no pasa por la página.

> ✅ **La parte accionable está hecha (2026-09-09), y el camino se verificó antes
> de tocar nada.** El filtro que la corrección pedía **ya había entrado con
> `propuestas.ts`** (B-830, paso 6): `incluyeDePropuesta` compara contra los slugs
> de `/opciones/incluye-actividad` y manda el resto a `incluyeOtro` vía el aviso de
> conversión, que es el mecanismo del § 4.2 del PRD. La taxonomía no se lee ahí —el
> módulo es puro (§05)—: entra por parámetro y la pasa el `PropuestasPanel`, con
> **default `[]`, no «dejar entrar»**, así que un llamador distraído no publica
> nada.
>
> El camino que la corrección afirma es **exacto**, eslabón por eslabón:
> `toPublic.ts` → `detallePublico.ts` (`etiquetaDe`) → `listadoPublico.ts`
> (`?? desSlug(valor)`) → `actividad/[slug].astro`, donde se pinta como `<li>` bajo
> «Qué se llevan». HTML indexado, confirmado.
>
> **Lo que faltaba era lo otro que este ítem pedía:** que estuviera escrito como
> asimetría y no como garantía. `tests/propuestas.test.ts` todavía repetía la frase
> retractada —«esa conversión pasa por `actividadFormSchema`… no un dato
> publicado»— justo en el docblock que **justifica** el hueco de la regla. Se
> corrigió y se le puso aserto, con la carga que la regla no puede rechazar (un
> slug inventado y uno de 4000 caracteres), afirmando que ninguno queda en ningún
> campo del formulario. Está en ese archivo y no en `propuestas-conversion.test.ts`
> para que, si alguien borra el filtro, lo que se ponga rojo sea el párrafo que
> dice que el hueco es aceptable.
>
> **Lo que sigue abierto es lo que este ítem manda no hacer todavía:** la Function
> `onDocumentCreated` que valide fila por fila, y App Check (B-836a). No antes de
> tener el problema. Y salió **B-859**, que sí es un defecto y no una asimetría
> aceptada.

### B-843 · Cuatro cosas que la bandeja de propuestas necesita antes de existir · P1

Las cuatro salen de la auditoría de `/propuestas` (el `auditor-privacidad` sobre
B-830) y comparten una forma: **son decisiones que cuestan una línea ahora y un
rediseño después**, porque cuando la bandeja esté escrita ya va a haber
documentos guardados.

> ✅ **Las dos primeras las contestó el dueño el 2026-09-09.** La 1 como estaba
> recomendada; la 2 con la **primera opción**. Lo que cada una cambia está al
> final de su punto.

**1 · Hoy no hay ninguna forma de borrar el dato personal del tercero.** El
camino de admin (`origen: 'panel'`) **está abierto desde el paso 5**, así que el
proyecto ya puede guardar el mail o el WhatsApp de alguien. Y: `allow delete: if
false`, `revisionValida()` acota el update a `estado` + `revision` —así que
tampoco se puede vaciar el campo— y la Function de retención de **B-838 no
existe**. La única forma de honrar un «borrame» es un script con el Admin SDK que
nadie escribió. La decisión de que rechazar sea un estado y no una desaparición es
buena; lo que falta es que **la excepción del borrado exista antes que el dato**.
Lo más barato: no usar el camino de panel hasta que B-838 esté, y que la fila de
`07-seguridad.md` lo diga en futuro (ya corregida).

> ✅ **Decidido: el camino de panel no se usa hasta que B-838 exista.** Y eso
> **cambia el orden del plan**: el paso 11 de la tajada 1 (la retención) pasa a ir
> **antes** de que el `PropuestasPanel` (paso 7) tenga cualquier forma de cargar
> una propuesta a mano. Hoy no hay UI que lo haga, así que la decisión no cuesta
> nada — lo que no puede pasar es que esa pantalla llegue con un botón de «cargar
> a mano» mientras la Function de retención todavía no existe.
>
> ✅ **Cumplido — y el bloqueo NO se levanta solo con B-838 (2026-09-09).** El
> `PropuestasPanel` (paso 7) salió **sin** ninguna forma de cargar a mano, y
> `borrarPropuestasVencidas` ya existe. Pero el bloqueo era «no guardar el dato de
> un tercero mientras no exista lo que lo borra», y lo que se escribió borra
> **solo la rechazada**: una propuesta cargada a mano nace `nueva` —lo **fuerza la
> regla**, `propuestaValida()` exige `d.estado == 'nueva'` para los dos orígenes—
> y `nueva` es justo uno de los tres estados que **no caducan** (**B-844**). O sea
> que el alta manual seguiría produciendo un dato personal sin fecha de
> vencimiento, con la única salida de rechazarlo a mano para meterlo en la cola.
>
> Lo señaló el `auditor-privacidad` sobre este mismo commit, corrigiendo lo que
> esta nota decía al escribirse («el bloqueo se levantó»). **El alta manual queda
> condicionada a B-844**, no a B-838.

**2 · El `hasAny(['estado'])` va a bloquear el flujo de aceptar.** `affectedKeys`
solo incluye lo que **cambió de valor**, y el flujo natural de aceptar son dos
escrituras: mover a `aceptada` → crear la actividad → guardar su id. La segunda
toca solo `revision.actividadId` y **la regla la rechaza**. Hay dos salidas y hay
que elegir una **antes** de escribir el panel: crear la actividad primero y mover
`estado` + `revision` en **una** escritura (preferible — deja la propuesta
consistente en un solo paso), o aflojar el `hasAny`. Mejor decidirlo ahora que
descubrirlo con la pantalla hecha.

> ✅ **Decidido: una sola escritura** (**D-600**). El `hasAny(['estado'])` se
> queda, y el flujo de aceptar es: crear la actividad → **después** mover `estado`
> y `revision` juntos. La regla no se toca y es el panel el que se adapta, que es
> el orden correcto: una regla que acepta una propuesta a medio revisar es más
> difícil de arreglar que un `await` en el orden correcto. El razonamiento —y por
> qué la asimetría de los fallos es lo que decide— está en D-600.

**3 · La revisión se puede pisar sin rastro.** — ✅ **decidido (2026-09-16)**
Un admin puede sobrescribir
`revision` —firmándola a su nombre, que es lo que la regla exige— y el `motivo`
anterior desaparece: `/propuestas` no tiene subcolección `versiones` y el trigger
de historial solo mira `/actividades`. La propuesta queda como prueba de qué se
pidió; **quién la revisó y por qué, no**. Con cuatro cuentas admin eso importa
menos que con cuarenta, así que puede quedar así — pero escrito.

> ✅ **Decidido por el dueño: queda sin rastro** (**D-721**). Es la opción que
> este punto recomendaba, y lo que la hace defendible es **para qué existe
> `/propuestas`**: es una cola de entrada, no un registro. Lo que hay que poder
> reconstruir es *qué pidió el de afuera* —y eso no se pisa nunca, porque
> `revisionValida()` acota el `update` a `estado` + `revision` y el cuerpo de la
> propuesta es inmutable desde que entra—. El acto administrativo de revisarla es
> interno, entre cuatro cuentas de confianza, y **la actividad que sale de ahí sí
> tiene historial completo** (§12): el dato que sobrevive está versionado, el que
> se pisa es el que se descarta.
>
> **Lo que la decisión compra:** no entra una subcolección `versiones` en
> `/propuestas` —que arrastraría su propio trigger, sus reglas, su retención (los
> datos personales de B-838/B-844 se copiarían a un lugar que **no** caduca) y su
> línea en las tres tablas de privacidad—. Poner un dato personal en un segundo
> lugar para auditar quién lo revisó es un mal negocio de privacidad.
>
> **La condición de reapertura, que es la misma que la de B-28:** el día que
> revise una cuenta que no sea de confianza. Con el rol `publicador` ya existiendo
> (B-888), eso dejó de ser hipotético — pero **hoy el publicador no ve la
> bandeja**, así que la condición todavía no se cumple. Si la bandeja se le abre,
> este punto se reabre **en el mismo cambio**, y lo barato entonces no es la
> subcolección: es un campo `revisionesPrevias` acotado y con la misma retención
> que la propuesta.

**4 · El saneador de la salida 3 no reconoce dos de las tres vías de contacto.** — ✅ hecho (2026-09-09)
`redactar()` (`functions/reportes.js`) tapa `LINK_REUNION` y `MAIL`, y
`VIAS_CONTACTO_PROPUESTA` es `['mail', 'whatsapp', 'instagram']`: un teléfono y un
`@handle` pasan enteros. Hoy no hay camino —nada lee `/propuestas` y el reporte lo
arma el panel con su propio contexto— pero la bandeja va a vivir al lado del botón
de reportar, y el `contexto` del reporte lleva la `url` de la pantalla. Cuando la
bandeja entre: o dos patrones más en `redactar()`, o que el contexto del reporte
no pueda incluir esa pantalla. Y el centinela de esa salida tiene que ser **no
saneable** para esta clase (un `+54 9 11 …` y un `@casabrandon`), porque si no el
test pasa por el motivo equivocado.

> ✅ **Cerrado con la bandeja (paso 7), que es cuando el camino se abrió.** Los
> dos patrones, y el del teléfono **con guarda**: se tapa desde diez dígitos y
> nunca lo que contiene una fecha ISO. Sin eso el saneador se comía «el encuentro
> del 2026-10-07 19:00 no aparece», que son diez dígitos y es justo el reporte que
> este panel escribe todo el tiempo — tapar de más no filtra nada, pero deja el
> reporte sin lo que hace falta para reproducirlo. La guarda está verificada por
> mutación, y el `CENTINELA_CRUDO` de `clases-de-bug.test.ts` sigue siendo no
> saneable (no tiene diez dígitos ni arroba), así que el barrido de esa salida no
> pasó a pasar por el motivo equivocado.

### B-830 a B-839 · Los cuatro formularios: propuestas de organizadores y los tres directorios · P1 — **para mañana (2026-09-09)**

**Los PRDs están escritos y el inventario de archivos también.** Pedido del dueño
el 2026-09-08; la especificación completa vive en [`prd/`](prd/README.md) y esto
es solo la fila del backlog. La sesión de mañana **no tiene que explorar**: el
inventario archivo por archivo, el orden por commit y las siete cosas que se
rompen en silencio están en
[`prd/05-inventario-de-archivos.md`](prd/05-inventario-de-archivos.md).

| # | Qué | Dónde está especificado | Estado |
|---|---|---|---|
| **B-836** | **La defensa de la escritura anónima** — App Check + validación en la regla + topes + honeypot + barrido. **Bloquea a los otros cuatro**: hoy ninguna colección acepta una escritura sin el claim `admin`, y estos formularios abren la primera puerta | [`prd/README.md`](prd/README.md) § 2 | 🟠 **empezado (2026-09-09)** — están el control positivo (`tests/escritura-anonima.integracion.test.ts`: hoy nadie escribe sin el claim, ni en las cuatro colecciones futuras) y **App Check cableado** (`src/lib/appcheck.ts`, reCAPTCHA **Enterprise**, con la app ya registrada por el dueño). Falta publicar, verificar en la consola y **exigir** — **B-836a**, y el orden no se puede invertir: exigir antes de que el cliente mande tokens deja al panel sin poder escribir. Las otras cuatro capas (validación en la regla, topes, honeypot, barrido) van con la colección que las estrene |
| **B-834** | **El motor compartido de los directorios** — una colección por entidad (la proyección es whitelist **por entidad**) con un solo mecanismo para el formulario público, la moderación, el `estado` y el rebuild | [`prd/README.md`](prd/README.md) § 1 | 🔴 decidir con el primero |
| **B-837** | **El dato que envejece** — `DatoConFecha<T>`: el valor nunca se muestra sin su fecha de carga, no entra a ningún filtro, y el panel avisa a los 60 días. Resuelve de una vez las promos bancarias y el precio de una suscripción | [`prd/03-suscripciones-literarias.md`](prd/03-suscripciones-literarias.md) § 6 | ✅ **hecho (2026-09-09)** — `src/lib/datoConFecha.ts` + `tests/dato-con-fecha.test.ts`. Las tres reglas son propiedades del módulo: la proyección pública es **un solo string** («$18.000 por mes · cargado el 24 de septiembre de 2026»), así que no hay número que filtrar ni que meter en un `Offer`, y **el valor sin fecha usable no sale** — desaparece en vez de publicarse solo. La fecha es absoluta y con año porque el sitio es estático: un «hace tres meses» horneado en el HTML envejece solo (**D-570**). Todavía sin consumidor: lo estrenan las librerías y las suscripciones |
| **B-830** | **Propuestas de organizadores** — `/proponer` sin login → `/propuestas/{id}` en estado `nueva` → bandeja en el panel → «convertir en actividad» (prellena el formulario que ya existe) → se publica como cualquier otra. **El de más valor de los cuatro**: es el único que no agrega un modelo nuevo al sitio, y le saca de encima la carga manual que hoy se hace todos los meses **Con DEC-11 adentro**: el formulario acepta archivo además de URL, o sea que `storage.rules`, la guarda de la trampa 12 y el borrado al descartar entran a esta tajada y no a una segunda | [`prd/01-propuestas-de-organizadores.md`](prd/01-propuestas-de-organizadores.md) | 🟠 **empezado (2026-09-09)** — **la tajada 1 completa salvo el anuncio** (pasos 4 a 11): **`incluye`** en el modelo de actividad (con **D-580**) y la colección **`/propuestas`** con su tipo, su schema, sus reglas y sus dos tests —33 casos contra el emulador, verificados por mutación— más **D-590** (las fechas como string) y **B-842** (lo que la regla no puede). **El `create` anónimo sigue cerrado a admin**: falta que App Check exija (B-836a). **Dos decisiones del dueño del 2026-09-09 cambian el resto** (B-843): aceptar es **una sola escritura**, con la actividad creada primero (**D-600**), y **la retención (B-838) va antes** de que el panel tenga cualquier forma de cargar una propuesta a mano. **Los pasos 6 y 7 ya están**: la conversión pura (`propuestas.ts`, con sus `ses_<uuid>` y sin slug) y la **bandeja** —convertir, marcar en revisión, rechazar con motivo, reabrir— con D-600 cableado y **sin carga a mano**, que es esa decisión respetada. De paso cerró **B-843 punto 4**. Y el **paso 11 (la retención, B-838) también está**, adelantado por B-843 punto 1: `borrarPropuestasVencidas` borra la rechazada y su imagen a los 30 días, con script en seco y las dos mitades verificadas contra los emuladores; la despliega CI en el push. Con el **paso 10 (B-839)** la tajada queda **completa salvo el anuncio**. Y el **paso 9 (`/proponer`)**: la página, el `FormularioPublico` con honeypot y tiempo mínimo, la subida enganchada, y el guard de imports partido en **estático** (prohibido para toda página pública) y **diferido** (solo para las que escriben) — que es lo que hace que App Check entre en el submit y no al abrir. **Escrita y no anunciada**: sin sitemap y sin enlace hasta que App Check exija (último paso de B-836a). Y el **paso 8 (la imagen de DEC-11)**: el prefijo `propuestas/` en `storage.rules` (`get` solo para un admin —desvío del PRD decidido por el dueño—, `list` para nadie, `delete` para nadie), el flyer visible en la bandeja, la promoción a `imagenes/` al convertir (por el panel, no por una Function: la clase de B-80) y el borrado en el acto al rechazar (`borrarImagenAlRechazar`). De paso salió **B-846**. Quedan `/proponer` (paso 9) y `/contacto` con Instagram (paso 10) |
| **B-831** | **Directorio de librerías** — `/guia/librerias`, `/guia/librerias/sumar`, panel. Reusa `/opciones/barrio` **y los hubs de barrio que ya están indexados**, que es lo que lo hace valer más que la suma de sus fichas | [`prd/02-librerias.md`](prd/02-librerias.md) | ✅ **hecho (2026-09-15)** — listado, ficha, panel y **formulario público**. Lo último fue `/guia/librerias/sumar`, y con él la decisión que desvía el § 5 del PRD: la ficha que llega de afuera **nace sin fotos** (**D-700**) |
| **B-832** | **Directorio de suscripciones literarias** — `/guia/suscripciones`. El modelo más complicado de los cuatro: campos condicionales, seis vocabularios y un precio. El choque de nombre que tenía —la barra ya dice «Suscribirse», el calendario— **se lo llevó `/guia/`**: las dos etiquetas nunca aparecen juntas | [`prd/03-suscripciones-literarias.md`](prd/03-suscripciones-literarias.md) | ✅ **hecho (2026-09-15)** — listado, ficha, panel y **formulario público**. El precio se pide y su fecha no: la estampa la regla con `request.time`, así que quien carga no elige qué fecha se publica al lado del número (DEC-12) |
| **B-833** | **Directorio de lugares para eventos** — `/guia/lugares`. El que más cierra el círculo (quien organiza necesita lugar; el lugar quiere que pasen cosas ahí) y **el único que puede publicar la dirección de la casa de una persona**: por eso `direccionPublica`, con default por tipo de lugar | [`prd/04-lugares-para-eventos.md`](prd/04-lugares-para-eventos.md) | ✅ **hecho (2026-09-15)** — listado, ficha, panel y **formulario público** (B-915). De los tres es el que abre sobre el problema serio del § 6: la ficha que llega de afuera **nunca** publica su dirección, mire lo que mire el `tipo` |
| **B-835** | **La pestaña «Guía» y la página `/guia` que la recibe.** Era «la barra pasa de 7 a 10 pestañas y ya no entra en un teléfono»; con la decisión de `/guia/*` del 2026-09-08 **pasa de 7 a 8** y el ítem se desinfló a dos cosas concretas: la entrada en `ENLACES` y `src/pages/guia/index.astro`. Va **con** la primera sección y no después — `/guia/librerias` sin `/guia` es una URL cuyo padre no existe | [`prd/README.md`](prd/README.md) § «Las decisiones del dueño» y § 6 | 🟢 chico, y ya sin decisión pendiente |
| **B-838** | **Retención: 30 días** (DEC-13) — reabre **B-102** («¿el sistema guarda algo de quien se inscribe?» → *no*), que dejó de ser cierto el día que existe una bandeja con el mail de quien propone. Function `onSchedule`, y borra **documento e imagen** (DEC-11) | [`prd/01-propuestas-de-organizadores.md`](prd/01-propuestas-de-organizadores.md) § 7 | ✅ **hecho (2026-09-09)** — `borrarPropuestasVencidas`, con su decisión pura (`functions/retencion.js`), su script en seco (`scripts/borrar-propuestas-vencidas.mjs`) y las dos mitades del borrado verificadas contra los emuladores. **Adelantado al paso 11 → antes del 8**, por la decisión de B-843 punto 1. **El deploy lo hace CI**: el push a `main` ve el cambio en `functions/` y la despliega sola, sin IAM nuevo — el job `functions` va después de `hosting`, así que hay una ventana de minutos en la que el panel promete un borrado que todavía no corre (dicho en `07-seguridad.md`). A mano, si hiciera falta: `firebase deploy --only functions:borrarPropuestasVencidas` |
| **B-839** ✅ **hecho (2026-09-09)** | **`/contacto` suma Instagram como canal** — pedido del dueño el 2026-09-08. Hoy `BLOQUES_DE_CONTACTO` son dos `mailto:` y el handle (`agenda.leh`) está en el chrome, no como forma de escribir. En este circuito el canal real es el DM. Chico y sin dependencias; el cuidado es que **un DM no tiene `asunto`** y `BLOQUES_DE_CONTACTO` hoy es homogéneo | [`prd/01-propuestas-de-organizadores.md`](prd/01-propuestas-de-organizadores.md) § 2 | ✅ **hecho (2026-09-09)** — y el cuidado se resolvió no metiéndolo donde no entra: Instagram **no es un motivo**, es un canal, así que va en su propia sección y `MOTIVOS_DE_CONTACTO` queda homogéneo (mismo argumento que el asunto comercial de B-770). La sección dice además por qué el mail sigue siendo la primera opción — un DM se pierde entre las solicitudes de mensaje—, que es lo que evita que el canal cómodo se coma al que deja rastro. **Lo que NO entró y va con el anuncio de `/proponer`:** que el texto de `/contacto` mande ahí (DEC-10). Un enlace desde una página indexada **es** anunciarla, así que eso es el último paso de B-836a y no de acá |

**Por qué esto es P1 y no P2.** Los tres directorios, solos, serían P2 —son
información al costado de la agenda—. Lo que los pone acá es **B-830**: el
proyecto existe para que la gente encuentre las actividades (§2.3 del
`CLAUDE.md`), y hoy el cuello de botella no es el sitio sino **la carga**, que es
una persona transcribiendo mails. Un formulario que le llega la actividad cargada
ataca eso directo.

**Lo que hay que aceptar al empezar, escrito para que no sorprenda:**

1. **Se abre la primera escritura anónima del proyecto.** El §5.3 del `CLAUDE.md`
   deja de ser cierto tal como está redactado, y hay que actualizarlo en el mismo
   cambio.
2. **Se guarda el primer dato personal de un tercero.** Es B-102 al revés, y con
   los ojos abiertos: sin forma de repreguntar, la bandeja no sirve.
3. **Son once vocabularios de taxonomía nuevos.** Vale revisar cuáles pueden
   arrancar como texto libre; la única que yo dejaría libre es la temática de una
   suscripción.
4. **Un directorio vacío es peor que no tenerlo.** Con seis fichas la sección
   parece abandonada. Antes de publicar cada una hay que cargarla, y eso es
   trabajo del dueño, no del código.
5. **Y desde el 2026-09-08, un anónimo escribe también en Storage** (DEC-11). Es
   la parte que más creció con las respuestas del dueño: el bucket pasa a tener un
   prefijo con contenido que subió alguien de afuera, y el borrado deja de ser una
   limpieza para ser parte del ciclo de vida. Las dos trampas que entran con eso
   —la 12, un trigger que se dispara a sí mismo al promover; la 13, `read` incluye
   `list`— ya están en el §13 del `CLAUDE.md` y ninguna es teórica: la 12 se cobró
   la Function de miniaturas, la 13 es por qué `imagenes/` tiene `get` y `list`
   separados.

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

## P2 — mejoras reales

### B-1150 · `D-239` se cita desde el encabezado del sitio y nunca se escribió · P2 — la destapó B-1147 (2026-09-22)

**Es la primera huérfana que el barrido no podía ver, y salió en la corrida en
que dejó de estar ciego.** `src/components/sitio/Encabezado.astro:322` dice «Es el
mismo criterio de **D-239** sobre la home», justificando que el desplegable del
encabezado sea un `<details>` nativo y no una isla de React. `06-decisiones.md` no
tiene esa entrada: va de D-232 a D-250 sin pasar por ahí.

**No es una tanda en vuelo.** La cita la trajo `ec2027f` (`fix(B-1134)`,
2026-09-18), integrado en `main` cuatro días antes, y es la **única** del repo: no
hay otro archivo que la nombre.

**Y acá sí hay que reconstruir, a diferencia de B-1082.** Se buscó en los once
`.estado/*.md` del árbol principal —que es donde B-910 encontró cinco de sus seis
y donde estaban D-400 y D-401— y **D-239 no aparece en ninguno**. Tampoco hay
ninguna decisión escrita sobre `<details>` en el registro, así que no es una cita
con el número equivocado apuntando a algo que exista.

**Dos salidas y conviene mirar cuál antes de escribir nada:** que el número se
haya acuñado para una decisión que nunca se tomó —y entonces la cita se corrige o
se borra— o que el criterio sea real y haya que redactarlo desde lo que el propio
comentario ya da: elemento nativo semántico y accesible por encima de bajar un
runtime de React al sitio público para reimplementar peor lo que el navegador
trae. **Lo que no se hace es inventar la entrada**: una entrada inventada es peor
que un hueco (la lección de `D-9` en B-910).

**Dónde:** `src/components/sitio/Encabezado.astro:322`.

### B-1160 · `handleInstagram` corta en el primer `#` o `?` aunque no haya URL, y deriva a **otra cuenta** · P2 — del `auditor-privacidad` sobre el cierre de B-1142 (2026-09-22)

**Verificado corriendo el helper, no leyéndolo:** `handleInstagram('casa#brandon')`
devuelve `'casa'`, y `handleInstagram('taller?2026')` devuelve `'taller'`. El
corte por `?`/`#` (`src/lib/handle-instagram.mjs:53`) se aplica a **cualquier**
valor, no solo a uno que haya empezado con `instagram.com/`, que es el único caso
que B-928 vino a cubrir (el `?igsh=…` del botón «Compartir»).

**Lo que pasa es peor que mostrar mal:** `@casa` es una cuenta real de otra
persona. Y en un posteo de Instagram la arroba no es texto, **menciona**: linkea y
notifica a la cuenta etiquetada. Es la salida de la que no se puede volver.

**Y no se queda en la salida: se guarda.** `formADocumento` escribe
`conHandle(crudo)` en el documento (`src/lib/actividades.ts:197`), así que quien
tipea `casa#brandon` en el panel **guarda `casa`** — el valor original se pierde,
y con él la posibilidad de ver qué se había escrito. Eso contradice de frente el
criterio que el propio docblock declara dos párrafos más arriba: «si no se
reconoce, se guarda lo tipeado, porque es la única copia del dato».

**Lo tapan dos puertas puestas en la tanda del 2026-09-22, y ninguna lo arregla:**
el calendario no deriva cuando el corte descartaría texto que no viene de una URL
de Instagram (D-763), y el formulario lo deja a la vista en el campo en vez de en
silencio (D-767). Las dos son locales a su salida. La ficha pública, el pie del
posteo y el documento guardado siguen expuestos.

**Los bordes que sí están cerrados** (verificados uno por uno): el prefijo está
anclado con `^`, así que `ar.instagram.com/x`, `instagram.com.evil.com/x` y un
redirect con `?u=instagram.com/otra` no derivan nada; cualquier valor con espacio,
`/` o `:` falla el alfabeto y sale como se escribió; `instagram.com/p/ABC/` queda
con barra y no deriva. El único agujero es el corte sobre un valor **pelado**.

**Arreglo mínimo:** aplicar el corte de query/fragmento **solo si hubo prefijo de
`instagram.com`**, dejando sin derivar el valor pelado con `#` o `?`. Al cerrarlo
se saca la puerta de `functions/calendario.js` (D-763) y se cae el test que fija
el caso en `tests/seccionQuien.render.test.tsx`, que está escrito a propósito para
ponerse rojo ese día.

**Dónde:** `src/lib/handle-instagram.mjs:53` — desde B-1145 la implementación vive
en `functions/handle-instagram.js`, así que el arreglo va allá y `src/` lo hereda.

### B-1161 · `handle-instagram` es productor de la salida más irreversible y no está en ninguna de las tres tablas que la indexan · P2 — del `auditor-privacidad` sobre el cierre de B-1142 (2026-09-22)

> **🟡 La fila 5 ya nombra el saneador (2026-09-22)** en las tres tablas, junto
> con la fila 2 de B-1182. **Lo que queda es la red**, que es la parte que cierra
> la clase: extender `tests/agentes-y-skills.test.ts` para que exija **todos**
> los archivos nombrados en la celda dentro del `description` del agente, y no
> solo el primero. Hasta entonces el índice se puede volver a desfasar por la
> misma puerta.

**Es la reincidencia exacta de lo que B-1141 ya arregló una vez**, y por eso vale
como ítem y no como línea suelta. Desde B-1142, quién decide el texto literal que
se pega en Instagram no es solo `textoRedes.ts`: es `arrobaInstagram`. La fila 6
de la tabla ya enuncia esa regla para sí misma —«ese archivo es un productor de
esta salida y un cambio que toque solo ese archivo tiene que despertar esta
auditoría»—. El mismo argumento vale ahora para la salida **5**, que es la
irreversible.

**Y la segunda mitad es peor y es anterior:** el archivo del saneador no está en
la lista de archivos del `description` del `auditor-privacidad`, así que **hoy un
cambio que lo toque solo a él no despierta la auditoría por ninguna de las dos
salidas** — ni por la 6, donde la tabla dice que tiene que despertarla.

Es el modo de falla que este índice ya documenta para esta misma fila: «la 5
faltaba en esta tabla hasta el 2026-08-27, y el agujero era del tipo peor: no de
cobertura, sino de índice». La cobertura está bien; falta la línea que hace que
alguien abra el archivo.

**Hermano:** **B-1182**, la misma falta en la fila 2 (el calendario). Se cierran
juntos, en una sola pasada por las tres tablas.

**La red que lo cierra de verdad, y es la que conviene:** extender
`tests/agentes-y-skills.test.ts` para que exija **todos** los archivos nombrados
en la celda dentro del `description`, no solo el primero. Así el índice no se
puede volver a desfasar.

### B-1170 · Un documento de diseño afirma el estado de un ítem y nada lo compara contra el backlog · P2 — de cerrar B-1085 (2026-09-22)

**El caso que lo abre es el más caro que produjo este repo hasta ahora en
documentación.** `16-analitica-del-sitio.md` tiene tres lugares que declaran
estado —el encabezado, el § 11 y el § 12— más las columnas «¿Hoy?» del § 3 y del
§ 4. El 2026-09-22 **ocho filas** llamaban «⛔ bloqueado por B-480» a cosas que
B-480 dejó de bloquear el **2026-09-03**, y el § 9.4 pedía tres pasos de consola
que **B-790 hizo y verificó de punta a punta el 2026-09-07**. Tres semanas.

**Lo que lo vuelve un ítem y no una corrección:** el documento se contradecía a sí
mismo a tres párrafos de distancia —el paso 1 del § 9.4 terminaba en «faltan los
pasos 2, 3 y 4» encima de los pasos 2 y 3 marcados «✅ hecho el 2026-09-07»— y
**nadie lo vio en diecinueve días**. Peor: el frente que estaba arreglando el
§ 8.1 **propagó la redacción vieja a filas nuevas**, porque lo razonable al
escribir una fila es copiar el formato de la de al lado, y la de al lado era del
2026-09-02. Lo agarró el `auditor-documentacion`, no el que escribía.

**Y el mismo día pasó del otro lado, en el archivo que es la fuente de verdad:**
`docs/BACKLOG.md` listaba B-1112 como abierto cuando su opción (a) estaba en
`main` desde el 2026-09-17, y otra sesión estuvo a punto de rehacer ese trabajo.

**Por qué ningún barrido lo ve.** `scripts/items-referenciados.mjs` verifica que
un `B-nnnn` citado **exista**; `decisiones-referenciadas.mjs` hace lo mismo con
las `D-`. Ninguno mira lo que la cita **afirma**. Un `| **B-480** | … | ⛔ acción
manual del dueño |` es un id válido con una entrada válida, y lo único falso es el
estado — que es lo que alguien lee para decidir qué hacer esta semana.

Es la misma forma de **B-1090** con el signo cambiado: allá falta el texto, acá
sobra el viejo.

> **Decidido el 2026-09-22: se construye el barrido**, que era la recomendación y
> la única de las tres salidas que cierra la clase. Se aceptaron sus dos costos:
> que va a tener falsos positivos —`🟡` significa cosas distintas según la fila— y
> que la deuda de hoy se congela para que solo baje, el patrón de B-1100. Las dos
> descartadas: sacar los estados de los documentos de diseño (barato, pero se
> pierde leer el orden de trabajo con su estado al lado) y una regla de proceso
> (cuesta cero y depende de la memoria, que es lo que falló seis veces en B-1090
> y dos veces hoy). **En curso en el frente `estados`.**

### B-1180 · El saneador del Instagram tiene dos cuerpos, y falta la línea que los junta · P2 — de cerrar B-1145 (2026-09-22)

`functions/handle-instagram.js` nació en B-1145 porque `functions/` no puede
importar `src/` (D-20) y la descripción del evento necesita el mismo handle que
la ficha. **Falta el último tramo del patrón**, que es el que lo convierte en «una
implementación, tres runtimes» en vez de en dos copias: que
`src/lib/handle-instagram.mjs` reexporte en lugar de tener su propio cuerpo,
exactamente como `src/lib/slugify.mjs` y `src/lib/geografia.mjs` desde B-968.

**No se hizo en B-1145 porque ese archivo era de otro frente de la tanda.** El
parche está escrito, aplicado en local y verificado —547 tests verdes y `tsc`
limpio— y es una línea de código:

```js
export { handleInstagram, arrobaInstagram } from '../../functions/handle-instagram.js';
```

**Mientras tanto hay red**, y es la misma que B-928 corrió entre el script y el
sitio: un test que importa las dos y las corre contra la misma batería exigiendo
que contesten igual (`tests/calendario.test.ts`). Funcionó entonces y funciona
ahora —probado mutando cada copia—, pero B-928 también dejó escrito su límite:
avisa **después** y el arreglo hay que escribirlo dos veces. Por eso este ítem
existe y no es opcional.

**Al cerrarlo**, el `it` de equivalencia pasa a comparar la función consigo misma
y deja de probar nada: hay que reemplazarlo por el chequeo de fuente de que la
fachada no tiene implementación propia, igual que
`tests/instagrams-de-la-base.test.ts:101`. Y conviene aprovechar para mover los
dos chequeos de clase D-20 de `tests/calendario.test.ts` a
`tests/clases-de-bug.test.ts`, donde viven los otros ocho.

**Y hay un tercer cuerpo, que este ítem no baja:** `conArroba` en
`src/lib/textoRedes.ts` también contesta «cómo se escribe este handle», con otro
alfabeto a propósito (admite `-`, para `difusion.arrobar`). Son tres, B-1180 los
deja en dos, y que no exista ninguna tabla que diga cuál va con cuál es **B-1191**.

**Dónde:** `src/lib/handle-instagram.mjs`; el modelo, `src/lib/slugify.mjs`.

### B-1181 · El arreglo del Instagram en Calendar no es retroactivo — ❌ descartado (2026-09-22), con el motivo escrito · P2 — de cerrar B-1145

> **El dueño decidió dejarlo el 2026-09-22, con el número medido a la vista.** Lo
> nuevo sale limpio desde ya; los eventos ya publicados se corrigen solos a medida
> que alguien edite esa ficha por cualquier motivo, y ahí el cambio viaja en el
> update que esa edición ya iba a producir igual. **Una ficha que nadie vuelva a
> tocar deja su evento con la URL cruda para siempre**, y eso está aceptado: no es
> una fuga —la URL de un perfil público no es un dato privado—, es una ficha que
> se ve un poco peor en el calendario de alguien. A cambio, cero escrituras y cero
> notificaciones de «evento actualizado».
>
> Se descartaron las dos que sí lo arreglaban, y las dos tenían el mismo costo:
> `replanificarPorEtiquetas` (`functions/sincronizacion.js`), que nació para
> exactamente esto —empujar un cambio de **texto** a los eventos publicados sin
> tocar el documento, con tope por corrida ya incluido—, y la opción (b) de
> B-1145, migrar los documentos. Las dos producen el pulso de updates a Calendar
> que el dueño ya había decidido no pagar.

**Queda escrito porque el razonamiento de por qué no muerde es el mismo que
explica por qué D-763 salió gratis**, y quien lea uno va a preguntar por el otro.
`construirDescripcion` deriva `@casabrandon` al armar el evento, así que todo lo
que se publique de acá en más sale limpio. Pero el diff (`planificar`) solo emite
una operación cuando el **documento** se vuelve a escribir, y comparar dos
recálculos con el mismo código nunca da diferencia.

**Lo que no hay que hacer, y conviene que quede escrito:** debilitar la guarda
anti-loop ni agregarle una excepción para que el cambio se propague solo. Es la
trampa 3 del § 13, el bug más caro del sistema.

**Dónde:** `functions/calendario.js` (`planificar`, `mismoEvento`);
`functions/sincronizacion.js` (`replanificarPorEtiquetas`, el molde si algún día
se revierte esta decisión).

### B-1190 · El campo de Instagram avisa por omisión: si no reconoce el valor, lo único que pasa es que no pasa nada · P2 — del `auditor-privacidad` sobre el cierre de B-1144 (2026-09-22)

**Es la consecuencia deliberada de D-767, no un olvido — pero merece un ítem
porque la decisión del dueño fue «no frenar», no «no avisar».** Las dos cosas se
pueden tener a la vez y hoy solo está la primera.

**El hecho:** cuando `handleInstagram` devuelve `null` —«Casa Brandon / IG», un
handle con una barra, un link a un posteo—, el `onBlur` deja el campo como está.
La ayuda del campo lo dice desde B-1144 («si el campo no cambia es que no lo
reconocimos»), pero eso es una instrucción que se lee antes, no una señal que
aparezca cuando el caso ocurre.

**Por qué importa, y por qué es más ahora que antes.** Ese valor sale **crudo** al
pie del posteo para redes (B-1142). Y el propio B-1144 debilitó la única señal que
quedaba: antes, ver el link pegado tal cual en el campo no significaba nada;
ahora, con un campo que se corrige solo, «quedó como lo pegué» se lee como «ya
estaba bien». La ayuda nueva compensa, pero por instrucción y no por evidencia.

**Lo que hay que decidir es de UI, y no lo tomó el dueño:** un aviso bajo el campo
cuando `handleInstagram(valor) === null` y el valor no está vacío, del tipo «no lo
reconocimos como una cuenta: se va a publicar tal cual». **No bloquea nada**
—D-767 ya decidió eso y esto no lo toca—, es un cartel. La alternativa es dejarlo
como está y aceptar que el aviso vive en la ayuda.

**Test que lo fijaría:** `it('si el saneador no entiende el valor, el campo lo
dice en pantalla')` en `tests/seccionQuien.render.test.tsx`.

**Dónde:** `src/components/admin/formulario/SeccionQuien.tsx`.

### B-1147 · El barrido de decisiones huérfanas mira 27 `.md` y su gemelo mira el repo entero — ✅ hecho (2026-09-22) · P2 — salió de cerrar B-1113 (2026-09-21)

> **Arreglado copiándole el corpus al gemelo**, que era la ruta que el ítem
> proponía: `archivosDelRepo` (B-964), lista blanca de extensiones —**importada**
> de `items-referenciados.mjs`, no copiada— y el informe separa las citas desde el
> código de las de prosa, que es el control de ruido del gemelo aplicado acá. Pasó
> de 27 archivos a **679**.
>
> **Las cifras del ítem estaban estimadas y salieron cortas:** `D-88` no se cita
> desde catorce archivos sino desde **dieciocho**, así que el informe subestimaba
> por casi seis y no por cuatro. La estimación se había hecho a mano con el barrido
> que no los veía, que es el ítem describiéndose a sí mismo.
>
> **Lo que destapó:** `D-239`, citada desde `src/components/sitio/Encabezado.astro`
> desde el 2026-09-18 y sin entrada en ninguna parte → **B-1150**.
>
> **Sobre el ruido, que es lo que el ítem pedía mirar:** acá **no** va lista
> congelada de huérfanas, a diferencia del gemelo, y no es olvido — el motivo está
> escrito en la cabecera del script desde que nació: una `D-` se acuña en el commit
> que la decide, así que congelarlas deja el test rojo mientras una tanda está
> abierta (B-180). Lo que sí se congela es **el corpus**: ocho casos nuevos exigen
> que siga incluyendo `src/`, `tests/` y `scripts/`, con sus ocho mutaciones
> probadas. Un barrido que se encoge no rompe nada visible —sigue corriendo, sigue
> en verde— y lo único que cambia es lo que deja de ver.


**Mismo desbalance que B-1128, del lado del barrido en vez del de los
duplicados.** `scripts/items-referenciados.mjs` busca los `B-` huérfanos en
**todo** el repo —código incluido, que el propio script declara como el caso
más caro: «el comentario explica el porqué de una línea y manda a buscar un
ítem que nadie escribió»—. `scripts/decisiones-referenciadas.mjs` barre **27
archivos, todos `.md`**.

**O sea que una `D-` citada solo desde el código no puede aparecer como
huérfana.** Y no es hipotético: **`D-88`** está huérfana y se la cita desde
`scripts/tablero/parseo.mjs`, `scripts/archivar-backlog.mjs`,
`scripts/mail-de-aviso.sh` y ocho archivos de `tests/` — el barrido la reporta
nombrando solo los tres `.md`, así que quien lea el informe subestima el
alcance por un factor de cuatro.

**Por qué importa más en las `D-` que en las `B-`,** y es el mismo argumento que
D-740 escribió para los duplicados: una decisión es lo que el **código** cita.
Un comentario que manda a una `D-` inexistente no se descubre leyendo el código
— se descubre el día que alguien va a buscar por qué se hizo algo.

**El arreglo es copiarle el corpus al gemelo**, que ya usa `archivosDelRepo`
(B-964). Lo que hay que mirar al hacerlo es el ruido: el barrido de los `B-`
tiene su lista de huérfanas congeladas justamente porque abrir el corpus las
destapó de golpe, y acá va a pasar lo mismo.

**Dónde:** `scripts/decisiones-referenciadas.mjs`; el corpus del gemelo, en
`scripts/items-referenciados.mjs`.

### B-1144 · El Instagram de la actividad es el único del repo que no se valida al publicar — ✅ hecho (2026-09-22) · P2 — del `auditor-privacidad` sobre el cierre de B-1141 (2026-09-21)

> **Cerrado por una ruta distinta de la que este ítem proponía, por decisión del
> dueño (D-767) y contra la recomendación.** La ruta escrita acá era una regla en
> el `superRefine` del nivel «publicar», como la de las cuatro guías. El dueño
> eligió **corregir al vuelo en el formulario y no frenar el publicado**:
> `organizador.instagram` y `tallerista.instagram` siguen sin ninguna regla en
> `actividadFormSchema` —el hecho que abrió este ítem sigue siendo cierto—, pero
> `SeccionQuien.tsx` aplica `handleInstagram` en el `onBlur` de los dos campos, así
> que quien pega el link del perfil ve el handle antes de guardar.
>
> **El costo, a la vista y aceptado:** este campo queda con un criterio distinto
> del de las cuatro guías —ellas frenan, éste corrige—, dos criterios para el mismo
> dato en el mismo panel. Que no exista ninguna tabla donde los tres criterios de
> Instagram del repo estén juntos es **B-1191**.
>
> **Lo que el ítem no pedía y salió al hacerlo, que era la mitad del valor:** la
> normalización que protege a las salidas públicas no es la del formulario sino
> `conHandle` dentro de `formADocumento` —el `onBlur` es salteable abriendo una
> actividad vieja y guardándola sin tocar el campo— y **no tenía ningún test**. Lo
> contó el `auditor-privacidad`: los dieciocho casos nuevos probaban el eco y cero
> la regla. Era la condición exacta para que alguien borrara el original por
> redundante y los dieciocho siguieran verdes. Quedó con red, probada mutando
> `conHandle` a un `trim()` pelado.
>
> **Y un bug del propio saneador quedó a la vista en vez de en silencio**
> (B-1160). Que el campo lo diga con un cartel en vez de por omisión es **B-1190**,
> y es una decisión de UI que el dueño todavía no tomó.
>
> Siete mutaciones probadas.


**Lo destapó el tercer arreglo de B-1141.** El comentario de `conHandle` decía
que «el `superRefine` del schema ya lo rechaza al publicar»; se corrigió porque
es falso, pero **corregir el comentario no cierra el agujero que describía mal**,
y un comentario no es un ítem: nadie lo va a encontrar.

**El hecho:** `organizador.instagram` y `tallerista.instagram` son `opcional` en
`actividadFormSchema` (`src/lib/schema.ts:458` y `:462`) y **ninguna regla los
mira**, ni al guardar ni al publicar. Son los **únicos** campos de Instagram del
repo sin validación: las cuatro guías sí validan el suyo contra el alfabeto del
handle —`libreria-schema.ts:234`, `biblioteca-schema.ts:268`,
`lugar-schema.ts:377`, `suscripcion-literaria-schema.ts:327` y `:330`—.

**Por qué importa más ahora, no menos.** De ese campo sale texto libre a **dos**
salidas públicas: la descripción del evento de Calendar (B-1145) y el pie del
posteo para redes (B-1142). B-1141 le sacó el síntoma que se veía —la URL en la
ficha— y dejó el resto igual: ahora la ficha lo muestra prolijo y el crudo sigue
saliendo por las otras dos. El aviso de que algo está mal cargado quedó más
débil, no más fuerte.

**La ruta ya está escrita** en el comentario corregido: una regla en el
`superRefine` del nivel «publicar», como la de las cuatro guías. Lo que hay que
decidir es si frenar el publicado por un handle mal escrito, que es el costo.

**Test que lo fijaría:** `it('publicar con un Instagram que no es un handle no
pasa, como en las cuatro guías (§4.2)')` en `tests/schema.test.ts`.

**Dónde:** `src/lib/schema.ts:458` y `:462`; el `superRefine` del nivel
«publicar» arranca en `:564`.

### B-1145 · La descripción del evento de Google Calendar pega la URL cruda del Instagram, y arreglarlo reescribe todo lo publicado — ✅ hecho (2026-09-22) · P2 — del `auditor-trampas` sobre el cierre de B-1141 (2026-09-21)

> **Cerrado con la opción (a) que eligió el dueño —normalizar en la Function
> (D-763)—, y la premisa del título era falsa: no reescribe nada.** El ítem decía
> que la guarda anti-loop compara «el payload recalculado contra el guardado». No
> hay payload guardado: `mismoEvento` compara dos recálculos con el mismo código
> desplegado, así que una normalización simétrica es invisible para el diff.
> `planificar(doc, doc)` devuelve `[]`, y sin una escritura al documento el trigger
> no corre. Verificado además contra los otros tres caminos que arman el evento
> (`replanificarPorEtiquetas`, `reconciliacion.js`,
> `scripts/verificar-calendario.mjs`).
>
> **Así que el título habría que leerlo al revés: lo que no hace es reescribir.**
> El arreglo no es retroactivo — los eventos ya publicados conservan la URL cruda
> hasta que alguien edite esa ficha. Se le volvió a preguntar al dueño con el
> número medido y **eligió dejarlo**: **B-1181**, descartado con el motivo escrito.
>
> **Dos cosas que el ítem no nombraba y aparecieron al medir:**
>
> 1. **No era solo un problema de fichas viejas.** Desde B-928 el documento guarda
>    el handle **pelado**, sin arroba, así que el evento decía «Casa Brandon ·
>    casabrandon» para **todas**. Es la otra mitad de B-1141.
> 2. **El saneador que había que usar derivaba a la cuenta de otra persona**:
>    `casa#brandon` → `@casa`. El calendario no lo deriva cuando el corte
>    descartaría texto que no viene de una URL de Instagram. Acotarlo en el
>    saneador, para las seis salidas, es **B-1160**.
>
> El saneador no se reescribió: **bajó** a `functions/` (D-20, B-968), porque
> `functions/` se despliega con su propio `package.json` y no puede importar
> `src/`. Falta el último tramo —la fachada de una línea— y es **B-1180**.
>
> Catorce mutaciones probadas.


**Es la única de las tres que se ve hoy, y la única cuyo arreglo no es gratis.**
`functions/calendario.js` arma el bloque «Organiza:» concatenando
`[org.nombre, org.instagram, org.web]`, así que una actividad con el Instagram
sin migrar sincroniza al calendario **público** (§7.4) una descripción con la
URL pegada tal cual.

**Por qué no entró con B-1141, y por qué no es un two-liner:** el propio archivo
explica en el docblock de arriba (líneas 706-717) que **a propósito** no
normaliza estos valores. La guarda anti-loop compara el payload recalculado
contra el guardado (`decidirAccion`/`mismoEvento`, trampa 3 del §13, B-162), así
que envolver `org.instagram` con `arrobaInstagram` haría que **todo** evento ya
publicado con un Instagram sin migrar se vea distinto del guardado y se
actualice — la primera vez que corra el sync después del deploy. No es un loop:
es un update masivo de una sola vez contra el calendario de gente que tiene el
evento agendado, que es justo lo que D-95 decidió evitar.

**O sea que la decisión no es «arreglarlo o no», es cuál de estas:**

- **(a)** Normalizar y aceptar el update masivo de una vez. Costo: un pulso de
  escrituras a la API de Calendar y una notificación de «evento actualizado» a
  quien lo tenga agendado, por un cambio de texto.
- **(b)** Migrar los documentos (un script que pase `handleInstagram` sobre
  `organizador.instagram` y `tallerista.instagram` de la colección). Arregla
  ésta, B-1142 y B-1144 de una sola vez y **sin** tocar la lógica del sync… pero
  el sync se dispara igual al escribir el documento, así que el update masivo
  ocurre lo mismo. La diferencia es que queda hecho en los datos y no hay que
  acordarse en cada salida nueva.
- **(c)** Dejarlo. Las fichas viejas se van corrigiendo solas a medida que
  alguien las edita, porque `formADocumento` normaliza al guardar desde B-928.

**Sin red:** no hay test sobre el Instagram en la descripción del evento. Va con
la decisión, no antes.

**Dónde:** `functions/calendario.js:721` y `:727`; el docblock que explica el
criterio, `:706-717`.

### B-1142 · El pie del posteo para redes arroba la URL cruda en las fichas anteriores a B-928 — ✅ hecho (2026-09-22) · P2 — salió de cerrar B-1141 (2026-09-21)

> **Cerrado aplicando `arrobaInstagram` solo a los dos campos que dicen Instagram
> en el nombre.** `handlesDe` (`src/lib/textoRedes.ts`) los deriva con la misma
> función que la ficha pública usa desde B-1141, antes de que entren a
> `agregarChips`, así que el pie y la ficha no pueden discrepar sobre cómo se
> escribe una cuenta (D-20). `difusion.arrobar` queda como estaba: no es un campo
> de Instagram, admite el `-` que Instagram no tiene y puede ser de otra red, así
> que pasarlo por el mismo saneador le cambiaría el valor a algo que nadie
> escribió.
>
> **Y el ítem estaba mal en lo principal: por el panel el pie ya decía
> `@casabrandon`.** Se midió al arreglarlo. El único consumidor del módulo es
> `textoRedesDeForm`, que arma el documento con `formADocumento`, y ése normaliza
> el campo con `conHandle` desde B-928. El ítem concluyó leyendo `handlesDe`
> —donde el campo, efectivamente, se lee directo— y no la puerta por la que se
> entra. **Es D-750 con el signo cambiado**: allá una red que parecía red y no
> verificaba nada, acá un bug que parecía bug y no se veía. La consecuencia
> práctica no es que el arreglo sobrara, es que la prioridad mintió → **B-1162**.
>
> **El arreglo vale igual**, y por eso quedó: la correctitud del pie colgaba de una
> normalización que vive en otro módulo y contesta otra pregunta —*qué se guarda*,
> no *cómo se muestra*—. Y `construirTextoRedes` está exportado y toma un
> documento, así que un segundo consumidor que no pase por el formulario entra por
> la puerta sin cubrir. Ahora las dos puertas contestan lo mismo y hay un test que
> las compara entre sí, no contra un literal.
>
> **El hermano de costo distinto ya no está abierto:** B-1145, la descripción del
> evento de Calendar, se cerró el mismo día normalizando **al mostrar** (D-763) y
> no migrando los documentos — la opción (b) no se tomó, y el costo que la hacía
> cara resultó no existir. Si alguna vez se la vuelve a considerar, hay que medir
> el costo de nuevo.
>
> Destapó **B-1160** (`casa#brandon` deriva a `@casa`) y **B-1161** (el índice de
> productores de la salida 5). Cinco mutaciones probadas.


**Es la misma causa que B-1141, y son dos las salidas que quedaron sin
cubrir: ésta y la descripción del evento de Calendar (B-1145).** El
documento de una ficha cargada antes del 2026-09-17 tiene
`https://www.instagram.com/casabrandon/` adentro de `organizador.instagram`.
B-1141 derivó el texto visible **en la ficha pública**; el texto para redes del
panel (`lib/textoRedes.ts`) lee el campo directo.

Lo que pasa ahí: `conArroba` exige `^[A-Za-z0-9._-]+$` para poner la arroba, y
una URL no lo cumple, así que **sale la URL pelada en el pie del posteo** —
donde tenía que ir `@casabrandon`. No se rompe nada; lo que no pasa es lo único
que ese pie existe para hacer, que es etiquetar la cuenta. Quien copia la caption
la pega así.

**Por qué no se arregló junto con B-1141:** `conArroba` no es solo para
Instagram. También arma los handles de `difusion.arrobar`, que admiten `-` —que
Instagram no tiene— y que pueden ser de otra red. Pasarlo entero por
`arrobaInstagram` rompería esos. El arreglo es aplicar `arrobaInstagram` **solo a
los dos campos de Instagram** (`organizador.instagram` y `tallerista.instagram`)
antes de que entren a `handlesDe`, y dejar `difusion.arrobar` como está.

**El `events.json` NO está entre ellas, y se verificó:** el índice publica el
organizador como **el nombre solo** (`entradaDeIndice`, `src/lib/eventsJson.ts:451`)
y `tests/eventsJson.test.ts:242` afirma que los dos centinelas de Instagram no
aparecen. El `auditor-trampas` lo había reportado como fuga mirando `toPublic.ts`,
que sí lo proyecta — pero el único consumidor de ese campo es la página de
detalle, que desde B-1141 lo deriva. Queda escrito para que no se vuelva a
reportar.

**Hermano de costo distinto:** B-1145, la descripción del evento de Calendar.
Los dos se cierran de una si se decide la opción (b) de B-1145, que es migrar
los documentos.

**Dónde:** `handlesDe` en `src/lib/textoRedes.ts:233-247`.

### B-1081 · El ritmo del catálogo está calculado, testeado, y nadie lo dibuja · P2 — de documentar el tablero (2026-09-17)

`src/lib/ritmoDelCatalogo.ts` (B-704, B-705, B-706) calcula el mapa de calor de
ocho semanas, el reparto por día de la semana y el de franja horaria. Son **260
líneas con su test, y el único import del repo es ese test**: ninguna pantalla lo
usa. El commit que lo trajo lo dice —«solo el módulo puro y sus tests, falta la
pantalla»— pero eso quedó en el mensaje de commit y en ningún otro lado.

**Por qué importa aunque no rompa nada.** Código vivo que nadie ejecuta envejece
sin que se note: el día que se dibuje, el módulo va a tener meses de deriva
contra `calendarioPanel.ts`, del que depende. Y la ausencia **ya empezó a
contradecir a la doc** — ver B-1084.

Dos salidas, y la decisión es del dueño: dibujarlo (es la pregunta que un listado
no contesta nunca: qué semanas están vacías, qué día está saturado), o borrarlo y
dejar el rastro. Lo que no conviene es el estado de hoy.

### B-1082 · `D-400` y `D-401` se citan doce veces desde el código y nunca se escribieron — ✅ hecho (2026-09-22) · P2 — de documentar el tablero (2026-09-17)

> **Escritas, y no hizo falta reconstruirlas.** Van en `06-decisiones.md` en su
> lugar numérico, entre D-381 y D-410. El primer intento las redactó de los
> docblocks, que es lo que este ítem pedía; al verificarlo apareció que el frente
> del tablero las había dejado **redactadas enteras** en `.estado/tablero.md`,
> bajo «Para `docs/06-decisiones.md`», con la advertencia «quien integre tiene que
> pegarlo, si no quedan dos referencias colgadas». Nadie lo pegó: es **B-1090** con
> la misma forma que las seis de B-910. Van con el texto original —precedente de
> D-430—, nota de procedencia, y aparte lo verificado contra el código de hoy.
> D-400 suma además el bloque de acotación que le faltaba: su título dice «y el
> calendario todavía no» y el calendario entró cuatro días después.
>
> **Y la cuenta del título estaba corta:** son **diecisiete citas en siete
> archivos**, no doce. El doce era la cuenta de D-401 sola.
>
> **Las dos mitades quedan cerradas por el mismo frente:** escribir las entradas, y
> decidir que el barrido mire `src/` y `tests/` — que es **B-1147**.


`EstadisticasPanel.tsx`, `Reparto.tsx`, `tortaDelPanel.ts`, `estadoDelCatalogo.ts`,
`anchoDelPanel.ts` y dos tests citan **D-400** (el tablero a todo ancho y el
reparto de columnas) y **D-401** (la regla que hace honesta a una torta: el todo
es la suma de sus tajadas, y la nota de unidad es obligatoria). `06-decisiones.md`
no tiene ninguna de las dos: va de D-199 a D-410 sin pasar por ahí.

**Y el chequeo que existe para esto no puede verlas.** `scripts/decisiones-referenciadas.mjs`
barre **`docs/`**, y estas dos se citan **solo desde `src/` y `tests/`**. O sea que
la clase que ese barrido persigue tiene una puerta abierta justo donde el repo más
cita decisiones: los docblocks. Es la mitad medible de **B-1090**.

Dos mitades: escribir las dos entradas (el razonamiento está entero en los
docblocks, es transcribir) y decidir si el barrido pasa a mirar `src/` y `tests/`.

### B-1085 · El § 8.1 de `16-analitica-del-sitio.md` quedó atrás del tablero que describe — ✅ hecho (2026-09-22) · P2 — de documentar el tablero (2026-09-17)

> **Cerrado, y los tres puntos del ítem eran ciertos contados contra el código:**
> seis avisos (`CLASES_DE_AVISO`), la grilla es estado/tipo/arancel/**barrio** con
> forma de cursar aparte, y el bloque «Lo que se publica» son **diez** números
> —cuatro coberturas, tres proporciones de Google (B-813) y tres de inscripción
> (B-703)— donde el § 8.1 nombraba cuatro.
>
> **Lo que el ítem no vio, y era la mitad del punto 1:** el sexto aviso tampoco
> estaba en la tabla de fricciones del § 4, que es de donde el § 8.1 dice que
> salen. La tabla ganó su fila 9, y el conteo pasó a «seis de las nueve».
>
> **Y lo que apareció al pasarle el `auditor-documentacion` es más grande que el
> ítem: la capa de estado del documento se congeló el 2026-09-02/03 mientras el
> trabajo cerró el 09-07.** Ocho filas llamaban «bloqueante» a **B-480**, que está
> ✅ desde el 2026-09-03, y el § 9.4 pedía tres pasos de consola que B-790 hizo y
> verificó de punta a punta el 2026-09-07. El archivo se contradecía a tres
> párrafos de distancia. **El commit de esta misma tanda que subió las preguntas 5
> y 6 del § 3 de ❌ a 🟡 nació desactualizado por copiar esa redacción vieja**, y
> lo agarró el auditor: es la causa exacta que **B-1170** anota.
>
> Del mismo barrido: el § 8.2 no nombraba `tortaDelPanel.ts` ni `vistaDeGrafico.ts`;
> la tabla de dimensiones del § 9.4 se quedó sin `provincia` (B-950); y cuatro
> anclas internas tenían un guion de menos → **B-1171**.
>
> **Una autocorrección queda escrita porque es la lección:** en el commit del punto
> 2 se escribió «forma de cursar va sin torta» y «barrio es el único que arranca en
> lista», copiando el comentario del componente. Los dos falsos — el toggle está en
> los cinco repartos y abren en lista dos. Cruzarlo con `04-funcionalidades.md`,
> que lo tenía bien, es lo que lo encontró.
>
> **No se tocó el § 8.1bis:** su drift tiene ítem propio (**B-1086**).


Tres cosas que ya no son ciertas en el documento de diseño de la pantalla: los
avisos son **seis** y dice cinco (B-813 sumó «publicadas con una web del
organizador que no enlaza»); al reparto le falta **barrio** (B-702), que es uno de
los cuatro de la grilla; y el punto 2 no menciona las tres proporciones de Google
(B-813) ni las tres de inscripción (B-703), que son la mitad de ese bloque hoy.

No es un doc de funcionalidades —eso ya lo cubrió B-1080— pero **es el documento
al que el propio código manda a leer**, así que conviene que el inventario cierre.

### B-1090 · El número de una decisión se acuña en un commit y su texto queda en un pizarrón sin versionar · P2 — de cerrar B-910 (2026-09-17)

**Sale de la sorpresa de B-910**, y es más grande que las seis entradas que ese
ítem pedía: a cinco de las seis **no hubo que reconstruirlas**. Estaban redactadas
enteras en `.estado/sitio.md` y `.estado/galeria.md`, y el commit que las acuñó lo
decía con todas las letras. Lo que faltó no fue redactar: fue **pegar**.

O sea que el mecanismo es éste: un frente decide algo, le pone `D-nnn` en un
comentario del código o en un commit, escribe el texto en su archivo de estado
—que está en el `.gitignore`— y el paso que lo mueve a `06-decisiones.md` depende
de que alguien se acuerde al integrar. **Seis veces no se acordó nadie.**

`scripts/decisiones-referenciadas.mjs` detecta el resultado, no la causa: avisa
cuando la huérfana ya nació. Y **tiene un punto ciego que B-1082 midió**: barre
solo `docs/`, así que D-400 y D-401 —citadas doce veces desde `src/` y `tests/`—
no aparecen. Las dos mitades de este ítem: que el barrido mire también el código,
y que el cierre de una tanda no dependa de la memoria de quien integra. Es la
misma forma que **B-1125** y que **B-1051**.

### B-1121 · El chequeo que B-205 prometió —comparar lo publicado contra `main`— sigue sin existir — ✅ hecho (2026-09-22) · P2

> **Cerrado.** `scripts/verificar-produccion.mjs` leía `/version.json` y reportaba
> la cadena, sin mirar nunca contra qué. Ahora saca el sha y le pregunta a git tres
> cosas —si conoce el commit, si es ancestro de `main`, cuántos commits tiene
> `main` por encima— y lo dice en un renglón. **Verificado contra el sitio real el
> 2026-09-22: publica `1.10.0+1acad60` y `main` está 49 commits por encima**, que
> es justamente lo que no se notaba desde ningún lado.
>
> **El parser del sha no existía y era la mitad del trabajo.** `componerVersion`
> arma la cadena y nadie tenía su inverso: el único que sabía sacarle el sha era el
> `sed` de `commit-base-deploy.sh`. Escribirlo en el consumidor habría sido un
> tercer lado sabiendo el mismo formato —la clase **D-88**, la que acaba de costar
> **B-1111**—, así que `shaDeVersion` va al lado de `componerVersion` y conserva su
> decisión: solo contesta para un build limpio. El `sed` del bash no se saca —es el
> camino del deploy, y tocarlo por un reporte sería cambiar producción para
> arreglar visibilidad—, se lo **ata** con una red que lo corre de verdad.
>
> **Y esa red se escribió mal dos veces seguidas, por el mismo motivo, y las dos
> las encontró la mutación y no la inspección.** Primero recorría solo
> `ENTRADAS_DE_BUILD`: mutar el `sed` de `{7,40}` a `{6,40}` quedaba **verde**,
> porque el dominio del build solo trae shas de 7 y ensancharlo no cambia ninguna
> respuesta. Se agregaron bordes, corridos de punta a punta contra el `sh`: **dos
> mutaciones más quedaron verdes**, porque la salida del `sh` no distingue «no lo
> extraje» de «lo extraje y el commit no existe» —las dos caen al `before`— y
> ningún sha inventado existe. El chequeo pasaba por el `git cat-file` que tenía
> abajo, no por lo que decía mirar. La versión que quedó corre el `sed`
> **aislado**, leído del script con una regex en vez de copiado, y las tres
> mutaciones dan rojo. Es **B-1129 dos veces en el mismo chequeo**, y la salida fue
> la de allá las dos veces: cambiar la firma, no ensanchar el alcance.
>
> **Una decisión chica quedó escrita en el código y se anota acá para que no se lea
> después como un descuido:** `main` adelante cuenta como **fallado**. Corrido
> después de deployar —que es lo que dice el encabezado del script— eso es
> exactamente B-205, un deploy que no arrancó; corrido a mitad de la tarde es lo
> aburrido y esperable. El script no puede saber cuál de las dos es, así que el
> detalle **dice las dos** en vez de elegir. Si el dueño prefiere que sea
> informativo y no rojo, es una línea.


**Sobrante declarado adentro de un ítem ✅.** B-205 (recuperación de un deploy que
no arrancó, P1, cerrado el 2026-09-02) proponía **dos** arreglos y dejó escrito
que el segundo «sigue sin existir»: un chequeo que compare lo que hay publicado
contra `main` y avise si difieren. Verificado hoy: no hay script ni paso de
workflow que lo haga (`scripts/verificar-produccion.mjs`, sin nada de `sha`
contra `main`).

**El matiz importa para no buscar el bug equivocado:** la mitad automática de
B-205 **hoy funciona**. Tuvo su propio bug —quedó inerte por la trampa de
mock≠realidad— y se reparó bajo la cita `B-562`, que está comentada en
`scripts/commit-base-deploy.sh:35-38` y que **tampoco existe como ítem**. Lo que
falta es solo la visibilidad: que alguien se entere sin ir a mirar.

### B-1125 · `.estado/` está en el `.gitignore`, así que los pendientes de los frentes no sobreviven al disco · P2 — de la tanda de ítems no visibles (2026-09-17)

**Es el caso más puro de «ítem no visible» que produjo este repo, y lo produce
solo.** El protocolo de las tandas en paralelo pide que cada frente anote su
avance en `.estado/<frente>.md`, con un formato que distingue lo hecho (`✅`) de
lo que **quedó abierto** (`⏸`) y de las preguntas al orquestador (`❓`).
`.gitignore:50` tiene `.estado/`, y `git ls-files .estado` devuelve **cero**.

O sea: **el lugar donde el protocolo manda anotar lo que falta es el único
directorio del repo que no se versiona.** Hoy hay ⏸ y ❓ en once archivos de ahí.
Dos ejemplos de lo que eso costó, los dos verificados:

- El `npm audit fix` de `uuid` quedó anotado en `.estado/salud.md` el
  2026-09-03 y **nunca se hizo**; se cerró de casualidad catorce días después,
  cuando el salto a `astro@7.3.1` se llevó puesta esa rama de dependencias.
- El helper compartido de credenciales del emulador —quince archivos copiando
  `tokenAdmin`/`tokenPara`— quedó como `❓` en `.estado/falsos-verdes.md` el
  2026-09-17 y no llegó a ningún backlog. Se rescató a mano.

**No es que `.estado/` deba versionarse**: son archivos de coordinación, ruidosos
y de una sola tanda, y el `.gitignore` está bien. Lo que falta es que el cierre
de una tanda **no dependa de que alguien se acuerde de leerlos**. Lo más barato
que se ve: que integrar incluya un barrido de `⏸`/`❓` sobre `.estado/*.md` y que
cada uno salga como ítem o como línea del informe. Es la misma forma de B-1051 y
de B-1120 — lo que no deja rastro derivado, se pierde.

### B-1051 · Un id reservado por una tanda y nunca escrito se ofrece como libre · P2 — salió de la partición del backlog (2026-09-17)

`proximoNumero` deriva el próximo `B-` del número más alto que **encuentre
escrito**, y desde la partición lo busca en los dos archivos del backlog. Lo que
no puede encontrar es un id que una tanda **reservó y no llegó a usar**: no queda
escrito en ninguna parte, así que para el tablero está libre.

**Pasó dos veces el mismo día.** `B-1000` y `B-1020` se reservaron para los
frentes `barridos` y `saneador` de la tanda del 2026-09-17 y se cerraron al
integrar, antes de llegar al archivo; el motivo de cada uno está escrito adentro
de B-964 y de B-892. Hoy el tablero los ofrecería.

**Es el choque de B-930 por la otra dirección**, y por eso vale la pena anotarlo:
allá dos frentes numeraron a ciegas y eligieron el mismo; acá un frente numeró
**bien** —reservó su rango, lo anunció en `EN-CURSO.md`— y los números quedaron
libres igual. El mecanismo falla en los dos sentidos, así que reservar con
cuidado no alcanza.

**Y no lo causa la partición.** Cuando el backlog era un archivo solo pasaba lo
mismo: un id reservado nunca estuvo escrito. Lo que cambió es que ahora el número
se propone en una pantalla, con un botón al lado, y eso es cuando alguien lo
aprieta sin pensarlo.

**Lo que lo cerraría de verdad no es enseñarle a `proximoNumero` a leer más
archivos.** Es que reservar deje rastro. Dos caminos, ninguno gratis:

- **Una línea en la cabecera del backlog al abrir la tanda**, que es lo que ya se
  hace para los huecos —hay seis anotados— pero **después**, cuando el hueco ya
  existe. Anotarlo al reservar depende de que alguien se acuerde, que es
  exactamente lo que falló.
- **Que el tablero lea los rangos reservados de `EN-CURSO.md`**, donde ya están
  escritos: la tanda del 2026-09-17 los declara en una tabla. Sale derivado y no
  se olvida, pero es acoplar el tablero a un archivo de coordinación cuyo formato
  nadie prometió mantener.

Mientras tanto: **antes de tomar el número que ofrece el tablero, mirar los
rangos reservados en `EN-CURSO.md`.** Es una lectura, no un chequeo.

### B-980 · La descripción autolinkea las URLs, y nada más · P2 — de la decisión 6 del §11.1 (2026-09-16)

**Sale de D-723.** Hoy `descripcion` es texto plano en todas sus salidas: quien
pega `https://instagram.com/casabrandon` en la descripción de su taller publica
un texto muerto que hay que seleccionar y copiar a mano. La decisión fue la opción
del medio de las tres que ofrecía el §11.1: **autolinkear las URLs** — sin
negritas, sin listas, sin markdown.

**Dónde vale y dónde no**, que es la parte que hay que respetar:

| Salida | Autolinkea | Por qué |
|---|---|---|
| Página de detalle (`/actividad/[slug]`) | **sí** | es la única donde alguien puede hacer clic |
| `events.json` | — | **no lleva `descripcion`** (§11.3), así que no hay nada que decidir |
| Evento de Calendar | **no** | Google ya linkea solo en su propio cliente, y el texto que se manda es el crudo. Tocar `build()` es tocar el §7, que pide no tocarlo sin motivo |
| JSON-LD (`description`) | **no** | ahí va texto, no HTML: una etiqueta `<a>` adentro de un campo de Schema.org es basura para el parser |
| `meta description` | **no** | mismo motivo, y ya se recorta a 160 |

**Las tres cosas que pueden salir mal, y ninguna es el regex:**

1. **Escapar primero, linkear después.** Si se linkea sobre el texto crudo y
   después se escapa, se escapan las etiquetas recién creadas; si se escapa
   después de insertar HTML, se abre XSS en una salida pública con texto que hoy
   **carga gente de afuera** (`/proponer`, y las tres guías). El orden es
   innegociable y es lo que tiene que afirmar el test, con un centinela que
   contenga `<script>` **y** una URL en la misma línea.
2. **`rel="nofollow noopener"` y `target="_blank"`.** Es contenido de terceros
   apuntando afuera: sin `nofollow` el sitio reparte autoridad de SEO a cualquiera
   que pegue un link, que es exactamente el incentivo que no se quiere crear.
3. **Qué se considera URL.** Solo `http://` y `https://` explícitos. Nada de
   detectar `casabrandon.com.ar` a ojo: un dominio adivinado dentro de una frase
   es la clase de falso positivo que rompe el texto de alguien («el taller es de
   10 a 12.com no existe»), y el que quiere un link lo pega entero.

**Y una de privacidad que no es obvia:** esto convierte texto en una salida
pública clickeable, así que entra por la puerta del `auditor-privacidad` — el
mismo criterio de las filas 13 a 18. `descripcion` ya es pública, así que no
cambia qué se publica; cambia **la forma**, y es la primera vez que el sitio
emite HTML derivado de texto que escribió un desconocido.

### B-963 · No se mide el clic del banner · P2 — abierto con B-961

El banner de B-961 no emite ningún evento, así que no hay forma de saber si sirve
—que es lo primero que va a preguntar quien lo puso, y la misma pregunta que
`clic_triptico` contesta para el tríptico (B-601).

No entró en B-961 porque un cuarto evento propio toca tres lugares más: el
vocabulario de `EVENTOS_SITIO` (`src/lib/analyticsSitio.ts`), `EVENTOS_PROPIOS`
de `functions/analitica.js` —`tests/analitica-del-sitio.test.ts` exige que las dos
listas sean idénticas— y `docs/16-analitica-del-sitio.md`. El parámetro sería la
**ciudad en slug**, vocabulario cerrado con las ciudades que tienen banner, y
nunca el destino ni el nombre del emprendimiento.

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

### B-923 · El panel dice «si no querés publicarlo, dejalo vacío» y el guardado falla · P2

**Encontrado escribiendo los formularios públicos de la Guía (2026-09-15), sobre
el formulario del panel.**

`suscripcionVacia()` arranca con `precio: { monto: '', porPeriodo: 'mensual' }` y
`lugarVacio()` con `precio: { monto: '', porUnidad: 'hora' }`. El schema pide el
monto **y** la unidad, o **ninguno de los dos** —lo cual es correcto y está
testeado (`tests/suscripciones.test.ts`, `tests/lugares.test.ts`)—. Con el
período puesto por default y el monto vacío, la combinación cae del lado
prohibido.

O sea que **una suscripción o un lugar sin precio no se pueden guardar** a menos
que quien carga se acuerde de vaciar *también* el desplegable. Y la ayuda del
campo dice lo contrario con todas las letras:

> «En pesos, sin puntos ni centavos. **Si no querés publicarlo, dejalo vacío.**»

El error sale marcado sobre `precio.monto` («Cargá el precio y a qué período
corresponde, o ninguno de los dos»), o sea sobre el campo que la persona
**dejó vacío a propósito** y no sobre el que tiene el valor de más. Es la clase de
rechazo que se lee como un bug del sistema.

**Dónde duele más:** en lugares. El § 5 del PRD 4 nace de la pregunta del dueño
—«no sé si todos cobran, o le dicen que tienen que consumir»— así que *no tener
precio* es el caso normal de esa ficha, no el borde.

**Lo que ya está resuelto y no hay que rehacer:** los tres formularios públicos
(`/guia/<x>/sumar`) arrancan el precio **vacío de los dos lados**, con el motivo
escrito en `SumarSuscripcion.tsx` y `SumarLugar.tsx`. Este ítem es solo el lado
del panel.

**Las dos salidas, en orden de costo:**

1. **Que `suscripcionVacia()` y `lugarVacio()` arranquen sin unidad** (`''`). Es
   una línea por archivo y deja el formulario coherente con su propia ayuda. Lo
   que cuesta: el desplegable arranca en «elegí», que es un click más para quien
   sí va a cargar un precio.
2. **Que el formulario limpie la unidad cuando el monto se vacía.** Más amable de
   usar y más fácil de romper: es estado derivado en un `onChange`, o sea la
   clase de acople que se pierde la próxima vez que alguien toque el campo.

La 1 es la que yo elegiría, y es la que ya usan los formularios públicos.

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

### B-921 · Un publicador puede cargar una actividad fuera de su ciudad, y editar una la saca del alcance · P2

Dos bordes que B-919 dejó abiertos a propósito y conviene que el dueño mire:

1. **`create` no mira la ciudad.** Una publicadora de Mar del Plata puede cargar una
   actividad de Rosario: nace suya, así que la controla entera. No contradice ninguna
   regla, pero tampoco es lo que el pedido dice literalmente. Si hay que cerrarlo, la
   cláusula va en el `allow create` y **hay que decidir qué pasa con las que ya
   cargó**.
2. **Editar la sede puede sacar la actividad del alcance de otra cuenta**, sin aviso.
   `ciudades` es derivado, así que cambiarle la ciudad a una actividad hace que deje
   de verla quien la veía por su ciudad. Es coherente con que el campo sea una
   proyección y no una segunda fuente de verdad, pero el panel no lo dice en ningún
   lado.

Ninguno de los dos es una fuga: el primero es contenido propio y el segundo cierra
puertas, no las abre.

### B-913 · El panel avisa a los 60 días que revises el precio, y no ofrece decir «sigue siendo éste» · P2

`pideRevision` (B-837) pinta el aviso en la bandeja a los `DIAS_PARA_REVISAR` días.
`firestore.rules` **ya deja** refechar un precio que no cambió con el reloj del
servidor —es «lo revisé hoy y sigue siendo éste», y la puerta está abierta a
propósito y probada— pero la pantalla no ofrece el gesto: `guardarSuscripcion` solo
refecha cuando el monto o el período cambian.

O sea que hoy la única forma de bajar el aviso es **cambiarle el número**, que es
mentir, o dejarlo puesto para siempre, que es enseñar a ignorar el aviso. Es un
botón y una llamada.

### B-908 · La doc sigue diciendo que la subida anónima del flyer «espera que App Check exija» · P2

B-896 paso 1 cerró ese camino por otro lado —la subida va a una callable y
`storage.rules` para `propuestas/` quedó en `create: if false`— pero la doc no se
actualizó, y en cinco lugares:

- `docs/07-seguridad.md` §§ ~1396 y ~1417 — el prefijo `propuestas/` y su `create`.
- `docs/04-funcionalidades.md` líneas ~874, ~921 y ~926 — «la escritura anónima
  espera que App Check esté exigiendo (B-836a)». Sigue siendo cierto para el
  `create` de Firestore (paso 2 de B-896) y **ya no** para el de Storage.
- `docs/02-infraestructura.md` § App Check — falta la fila de `cloudfunctions`, y
  con el matiz que es el punto entero del ítem: **no hace falta ponerlo en
  `ENFORCED` en la consola**, `enforceAppCheck: true` es por función y rechaza
  solo. Es lo que hace que exigir acá no cueste nada en Storage.
- `docs/08-operacion.md` — la callable corre con `calendar-sync@` y necesita
  `storage.objects.create`, el mismo permiso que ya tiene `optimizarImagen`: no hay
  IAM nuevo que otorgar, y conviene que esté dicho para que no se busque.

Es la clase de B-773 —afirmaciones que dejaron de ser ciertas y que ningún test
sostiene— y el `auditor-documentacion` la encuentra sola si se lo corre sobre este
commit.

### B-905 · El candado del slug de una librería se apoya en el estado actual, no en la historia · P2

`publicadaAlgunaVez` está declarado en `src/types/libreria.ts` y la regla ya lo
respeta —e impide que un cliente lo mueva—, pero **nadie lo escribe**: falta el
trigger. Mientras tanto `slugDeLibreriaCongelado` contesta con el estado, así que
publicar → despublicar → renombrar → volver a publicar **reabre la URL**. Es la
puerta de atrás que `slugBloqueado` (`lib/directorios.ts`) ya tiene nombrada para
las tres entidades, y la misma que B-285 resolvió para una actividad.

Falla en la dirección cara: una URL indexada que cambia es un 404 sin aviso
(trampa 10). El arreglo es el trigger, y el día que exista este ítem se cierra solo
— la regla no hay que tocarla.

### B-900 · El circuito de `/guia` no está completo: falta el pie y el 404 · P2

El §2.1 del inventario lista `PieDePagina.astro` («los mismos destinos») y
`noEncontrado.ts` («el 404 sugiere secciones; hay tres más»). Los dos quedaron
afuera de la tajada 2 por propiedad de archivos. Es circuito del §2.1, o sea de los
que no perdonan el olvido.

### B-899 · La doc de la tajada 2 (pasos 12 y 13) · P2

Falta `04-funcionalidades.md` (la pestaña «Guía», la página `/guia`, la bandeja
genérica del panel), `12-sitio-publico.md` (la sección nueva y su SEO), y **dos
entradas en `06-decisiones.md`**: por qué `/guia` entra al sitemap con sus tres
filas todavía en camino (y en qué se diferencia de `/proponer`), y por qué la
bandeja **recibe** los datos en vez de leerlos.

### B-813 · Cuatro de los nueve avisos de Google son datos que faltan, y el panel no los pide · P2

> ✅ **La mitad del catálogo, hecha (2026-09-09). La del formulario sigue abierta.**
>
> El ítem pedía dos cosas que resultaron ser distintas, y la mejor planteada no era
> la que el texto de abajo propone.
>
> 1. **El catálogo entero — hecho.** «Estado del catálogo» gana el bloque «Lo que
>    Google puede mostrar»: tres proporciones (dice quién la da, web del
>    organizador, aranceladas con el monto cargado). **Como proporciones y no como
>    cuatro avisos, y el motivo estaba escrito en el mismo archivo: D-273.** Una
>    lista de 65 sobre 68 publicadas no es trabajo pendiente, es el catálogo con
>    otro nombre, y para casi ninguna de sus entradas hay algo que hacer. La cuarta,
>    `image`, no se agregó: ya es la cobertura «Con imagen» y el aviso `sin-flyer`,
>    y repetirla era la segunda derivación que el propio ítem pedía evitar.
>    **No se volvió obligatorio ningún campo** (D-440, por segunda vez) y **una
>    arancelada sin monto no se marca como error**: B-114 dejó el monto opcional a
>    propósito y que Google avise no lo convierte en un defecto nuestro.
>
>    De ahí salió además **un aviso que el ítem no había visto**: `web-que-no-enlaza`,
>    para la web del organizador que **está cargada y no es una dirección**. Ése sí
>    es un defecto nuestro, y hoy es silencioso en las tres salidas.
>
> 2. **La fila en la barra de guardar — abierta.** Es la mitad por-actividad y vive
>    en `src/lib/formulario/` + `ActividadFormulario.tsx`. Sigue valiendo lo que el
>    ítem dice: **aviso y no validación de publicado** (D-440).
>
> **Y dos hallazgos de leer `datosEstructurados`, que no son de este ítem:**
> `faltaElFlyer` y el `image` del JSON-LD **no son el mismo predicado** —aquél mira
> «url no vacía», éste `urlSegura`, y divergen en los dos sentidos, así que una
> portada con url inválida se anuncia como flyer y no llega a Google— y
> `datosEstructurados` decide `performer` por el objeto y no por el nombre, así que
> un documento anterior a `formADocumento` publicaría `performer.name: ''`.

Sale del informe «Eventos» del 2026-09-08 (la lectura entera está en **B-731**).
Cuatro avisos no son un bug del markup: el código emite el campo **cuando el dato
está cargado**, y no está.

| Aviso | Elementos | El dato que falta |
|---|---|---|
| `performer` | 65 | la actividad no tiene tallerista/invitado cargado |
| `image` | 49 | no tiene ninguna imagen |
| `url` (en `organizer`) | 24 | el organizador no tiene web |
| `price` + `priceCurrency` | 20 | es arancelada y no tiene `arancel.monto` |

**Por qué vale la pena.** El objetivo del proyecto es que la gente encuentre las
actividades en Google (P1 del archivo), y el resultado enriquecido con foto y
precio es lo que hace que un resultado de eventos se vea como un evento y no como
un link. 49 de 68 páginas sin `image` es la mitad del catálogo publicándose sin
foto — y no porque el código no la publique, sino porque nadie la cargó.

**Inventar el dato está prohibido** (§7, y la regla 5 de `armarJsonLd`: «no se
inventa el organizador como performer»). Lo que sí se puede es **pedirlo donde se
carga**: el formulario ya sabe qué campos están vacíos —tiene el schema en dos
niveles (B-183) y la lista de faltantes por pestaña (D-490)— así que el aviso
sería una fila más en la barra de guardar, con la forma «esto se publica igual,
pero en Google va a salir sin foto ni precio».

**Va como aviso y NO como validación de publicado.** Ese es el punto fino: D-440
hizo obligatoria la portada al publicar y el dueño sacó ese bloqueo a propósito
(ver el docblock de `imagenes` en `src/lib/schema.ts`). Una actividad sin flyer
tiene que poder publicarse; lo que no tiene que pasar es que se publique **sin
que nadie se haya enterado** de lo que pierde.

Dónde: `src/lib/formulario/` (el resumen de faltantes) y la barra de guardar de
`ActividadFormulario.tsx`. El criterio de qué campos mirar sale de las cuatro
filas de arriba, y conviene derivarlo de `armarJsonLd` en vez de escribir una
segunda lista (la clase de B-88).

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

### B-785 · 🟡 la mitad hecha (2026-09-09) — falta el `Organization` del §5.5, y la propiedad no es la que decía este ítem

**La ayuda ya la menciona.** Entró la pregunta «¿Esto es gratis? ¿Quién lo paga?»
en el grupo «Qué es esta agenda», con su enlace a `/apoyar`. La respuesta es
**corta y manda**, no resume la página: si dijera lo mismo con otras palabras
serían dos textos sobre plata que hay que mantener de acuerdo. Lo único que afirma
es lo que no puede cambiar sin que cambie el proyecto —es gratis, no hay
publicidad, lo hace una persona— y eso ya está atado por el test de `/apoyar`.

Y de paso salió un hallazgo del propio chequeo que ata el conteo de preguntas:
pedía corregir la línea del **CHANGELOG** donde la entrada de B-232 cuenta cuántas
preguntas tenía la ayuda **el día que se publicó**, o sea **reescribir el registro
de lo que pasó**. (Y el número no se cita acá por lo mismo: este archivo sí está
atado.) El CHANGELOG salió de la lista de ese test con el motivo escrito; los
cuatro documentos que describen el sitio de hoy siguen atados, `BACKLOG.md`
incluido.

> ⚠️ **La afirmación de arriba tenía un error, y era el hallazgo de esta mitad
> (2026-09-09).** «Lo único que afirma es lo que no puede cambiar sin que cambie el
> proyecto —es gratis, **no hay publicidad**, lo hace una persona— y eso ya está
> atado por el test de `/apoyar`»: las dos mitades eran falsas. La respuesta decía
> «no tiene publicidad y va a seguir así» mientras **`/anunciar` vende espacio del
> sitio** —su propio botón dice «Escribirnos sobre publicidad», y está en el
> encabezado dos ítems más allá de «Ayuda»—; y no estaba atada por ningún test:
> borrar la pregunta entera dejaba la suite en verde.
>
> Es la clase de **B-781** —una afirmación pública que el sitio desmiente, en HTML
> indexado— corrida de los datos del visitante **a la plata**, que es justo el eje
> que el barrido de `promesas-sobre-datos.test.ts` no mira (**B-851**).
>
> Corregido: promete lo que sí es cierto y depende de nosotros —entrar es gratis,
> publicar una actividad es gratis— y contesta la pregunta **entera**, que era la
> otra mitad: un espacio sí puede pagar para que se lo vea, y eso no adelanta a
> nadie en la fila ni compra un lugar en la agenda. No es una concesión: es lo
> primero que `/anunciar` aclara de su lado. Y la pregunta pasó a estar sostenida —
> obligatoria, con el enlace exigido, con un barrido que prohíbe repetir acá lo que
> es de `/apoyar`, y con un caso cuya **premisa se deriva** de
> `comercialDelSitio.ts`: el día que `/anunciar` deje de vender espacio se cae solo
> y la promesa vuelve a ser escribible.

**Lo que sigue abierto es la otra mitad**, y por el motivo de antes —el
`Organization` del §5.5 no existe todavía, y no se agrega JSON-LD a `/apoyar` sola,
sería un nodo suelto en una página secundaria compitiendo con el que algún día vaya
en la home— **más uno nuevo: la propiedad que este ítem proponía es la
incorrecta.** Verificado contra schema.org el 2026-09-09:

- **`funder`** va al revés: es «quién **nos** financia», y su tipo esperado es
  `Organization`/`Person`, no la URL de una página nuestra. Apuntarlo a `/apoyar`
  afirma que esa página es una organización que nos financia.
- **`sameAs`** es identidad —«*a reference Web page that unambiguously indicates the
  item's identity*»— y `/apoyar` es una página del propio sitio. El `sameAs`
  legítimo acá es el **perfil de Cafecito**, al lado del de Instagram: el instinto
  del planteo era correcto, pero apunta al perfil y no a la página.
- **No existe ninguna propiedad de `Organization` que signifique «la página donde
  podés apoyarnos».** Lo único modelable es `potentialAction: DonateAction`, y se
  descarta dos veces: el §5.5 ya decidió no emitir marcado inerte (`WebSite` +
  `SearchAction`), y `/apoyar` dice «no es una organización ni recibe donaciones
  formales» — un `DonateAction` sería, en marcado indexable, lo contrario de lo que
  la página afirma en prosa, que es el bug que se acaba de arreglar del otro lado.

Cuando se construya el nodo, `/apoyar` entra por el **`sameAs` del perfil de
Cafecito**. Casa probable: `contactoDelSitio.ts` + `src/pages/contacto.astro` (el
§5.5 dice que va en `/contacto`). **No** en `identidad.ts`: lo importa el panel, y
meterle `enlaces.ts`/`rutasPublicas.ts` lo arrastra a su bundle (B-841).

El planteo original queda abajo.

---


Dos huecos chicos, los dos deliberados para no tocar archivos de otros frentes:

- **`/ayuda` no la menciona.** Hay una pregunta natural que hoy no está contestada
  en ningún lado: «¿esto es gratis? ¿quién lo paga?». La respuesta vive en
  `/apoyar` y la ayuda es donde se busca. Es una entrada en
  `src/lib/ayudaDelSitio.ts` con su enlace, en el grupo «Qué es esta agenda».
- **El `Organization` del §5.5** —que sigue sin existir— es donde iría el
  `funder`/`sameAs` del perfil. No se agrega JSON-LD a `/apoyar` sola: sería un
  `Organization` suelto en una página secundaria, compitiendo con el que algún día
  vaya en la home.

---

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
| **B-773** | **Los settings de propiedad de GA4 que nadie verificó** — ver abajo, tiene cuerpo propio desde el 2026-09-07 | 🟡 pendiente, es de consola |

#### B-773 · Los settings de propiedad de GA4 que nadie verificó · P2

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
| **B-481** | **Las tipografías (`fonts.googleapis.com`/`fonts.gstatic.com`) son, hoy, una conexión a un tercero en el load** — el mismo `preconnect` que D-254 sacó para GA4, pero decidido antes de que hubiera un banner y sin la lupa del consentimiento encima. Autoalojarlas (servir los `.woff2` desde el propio dominio) la eliminaría del todo. No es privacidad en el mismo sentido que B-480 —una tipografía no manda datos de la persona—, es la misma clase de dato de red (que este navegador entró al sitio) que ya se decidió aceptar para las fuentes, y conviene tenerlo escrito ahora que el tema está sobre la mesa | 🔵 futuro, anotado a propósito por D-254 |
| **B-500** | El aviso «ya-paso»: el dueño no entendía por qué el tablero marcaba como problema algo que es el archivo funcionando bien | ✅ hecho (2026-09-03) — primero reencuadrado (D-270), después **sacado del todo** (D-273): el dueño señaló que la lista crece sin techo y no pide ninguna acción para casi nada. Queda la cobertura acotada «cuántas tienen fecha futura», no la lista |
| **B-501** | El tablero pasa a pestañas internas — «El catálogo» y «El sitio público» — para que entre sin scroll infinito | ✅ hecho (2026-09-03) — `EstadisticasPanel.tsx`, D-271 |
| **B-502** | La pestaña «El sitio público»: el andamiaje honesto de lo que B-374 va a mostrar, sin un solo número inventado | ✅ hecho (2026-09-03) — estado vacío deliberado, con la fecha de arranque de la medición (3 de septiembre de 2026) y qué falta para que deje de estar vacío. D-272 |

### B-239 · La home baja el runtime de React por la island de filtros · P2 — descartado (2026-09-03), con el motivo escrito

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

> **Medido de nuevo el 2026-08-31, al cerrar B-247.** `client.BlZe1zq3.js` **no se
> movió**: sigue en 186.619 B / 58.540 B gzip, que es el número del que habla este
> ítem. La island `Buscador` pasó de 16.458 B / 5.925 B gzip a 20.272 B / 7.435 B
> gzip —**+1,5 KB gzip**— por la portada generada y los controles nuevos; sin
> dependencias nuevas (la lupa del buscador es un SVG inline).
>
> Y el camino 1 se abarató: `Tarjeta` **sigue sin compartirse con el panel**, y ahora
> además todo lo que decide qué dice vive en `src/lib/tarjetaPublica.ts`, que es puro
> y no importa React. El camino 2 —reescribir la island sin framework— se encareció
> por lo mismo que se ganó: la portada es un componente más que habría que rehacer a
> mano y volvería a haber dos markups de tarjeta.

> ❌ **Descartado el 2026-09-03, midiendo antes de decidir — como pedía este
> ítem.** `client.BlZe1zq3.js` **sigue exactamente igual**: 186.619 B / 58.540 B
> gzip, el mismo hash de contenido que en la medición de B-247. La home carga
> ese chunk más `Buscador` (≈20 KB / 7 KB gzip) — nada más: un solo
> `astro-island` en todo `dist/index.html`. En un 3G simulado (~400 kbps) son
> ~1,3 s de descarga solo de JS, encima de ~17 KB de HTML — no es gratis, pero
> tampoco es el cuadro completo.
>
> **Las dos rutas de acción siguen sin mejorar, y una empeoró:**
>
> - **Camino 1 (`preact/compat`)** — el riesgo que el ítem señalaba (compartir
>   `Tarjeta` con el panel) ya no aplica, pero apareció uno más caro al mirarlo
>   de cerca: Astro no tiene forma de aliasear `react`→`preact/compat` **por
>   ruta**. El `resolve.alias` de Vite es un único bloque para todo
>   `astro.config.mjs`, así que un alias global se lo llevaría puesto también a
>   `AdminApp` (`217,91 KB`), que corre en **React 19**. `preact/compat` no
>   garantiza paridad con las APIs más nuevas de React 19, y el panel es la
>   herramienta de carga diaria: romperlo en silencio para bajar 48 KB gzip de
>   una página que no es la que recibe tráfico es cambiar un riesgo chico por
>   uno grande. Acotarlo de verdad pediría un segundo build o un plugin de Vite
>   que resuelva por importer — trabajo real, no una línea.
> - **Camino 2 (reescribir sin framework)** — sigue tan caro como en agosto: la
>   portada generada y los controles nuevos son componentes que habría que
>   rehacer a mano, y volvería a haber dos markups de tarjeta (lo que el §6.3
>   del diseño pedía evitar).
> - **Camino 3 (dejarlo)** — la página que recibe el tráfico real
>   (`/actividad/{slug}`) sigue en cero JavaScript y no está afectada. 58 KB
>   gzip cacheados en CDN, en el recorrido menos frecuente de los tres del §1
>   del diseño (el propio documento lo dice: «el más importante no empieza en
>   la home»).
>
> **Se elige el camino 3.** No porque el peso no importe, sino porque las dos
> formas de bajarlo cambiaron de precio en la dirección equivocada desde la
> última vez que se miró, y ninguna paga su costo hoy. Si el tráfico a la home
> crece lo suficiente para que esto duela de verdad, la medición de arriba es
> el punto de partida para retomarlo — no hay que volver a levantarla de cero.

### B-08 · Sin tests de componentes — 🟡 hecho el alcance angosto que el dueño aprobó (2026-09-02)

**El dueño aprobó el camino angosto de abajo, no el ítem entero.** Instalado
`@testing-library/react`, `@testing-library/dom`, `@testing-library/user-event`
y `jsdom`, y `environmentMatchGlobs` en `vitest.config.ts` — pero **solo** para
`tests/**/*.render.test.tsx`; el resto de la suite sigue en `environment: 'node'`,
como el argumento de abajo recomendaba.

**Se hizo el único caso genuino que el relevamiento identificó**:
`tests/menu-acciones.render.test.tsx`, contra `MenuAcciones` de verdad (no
leyendo el fuente): cierre por clic afuera (con su control negativo — un clic
**adentro** no cierra), cierre por `Escape` con el foco devuelto al "⋯", y
abrir con ↓ enfocando el primer ítem. Los otros tres candidatos quedan **sin
tocar**, tal como el relevamiento decía que correspondía: el placeholder de
`TaxonomiaSelect` y el editor de sesiones son preguntas puras que no necesitan
DOM, y el scroll de `VistaPreviaEvento` jsdom no lo puede medir (no hace
layout).

**Mutado, no solo verde — las cuatro aserciones, una por una:**

| Se mutó | Qué tiraba rojo |
|---|---|
| Se sacó `disparador.current?.focus()` de `cerrarYVolverAlDisparador` | «Escape cierra el menú Y devuelve el foco al ⋯» |
| Se comentó el `addEventListener('pointerdown', afuera)` | «un clic afuera cierra el menú abierto» |
| Se invirtió la condición de "afuera" (`setAbierto(false)` sin el `if`) | el control negativo, «un clic ADENTRO... no lo cierra» |
| `abrir(-1)` en vez de `abrir(e.key === 'ArrowDown' ? 0 : ...)` | «abrir con ↓ enfoca el primer ítem» |

Las cuatro se restauraron después de confirmar el rojo. Un detalle que valió la
pena corregir en el camino: la primera versión del test de Escape pasaba
**con la mutación adentro**, porque el foco nunca se había movido del
disparador (el `click` que abre el menú no mueve el foco a ningún ítem) — la
aserción "volvió al disparador" era trivialmente cierta. Se agregó un paso
que primero mueve el foco a un ítem con ↓, así la aserción de vuelta mide algo
real.

**Documentación actualizada**: `docs/05-patrones.md` (la fila "Qué no" ya no
dice categóricamente que no hay testing-library), `docs/10-salud-del-codigo.md`
(el Problema 1 tenía "confirmado que no hay forma de que existan", que dejó de
ser cierto — con una nota que no reclama haber resuelto el problema entero) y
`docs/06-decisiones.md` (D-100, una frase que decía "no está instalada").

**Lo que sigue exactamente igual que en el camino propuesto:** el resto del
ítem —`ActividadFormulario.tsx` y los demás componentes grandes— sigue sin
tests de render, y sigue siendo la decisión correcta no perseguirlos: la
lógica que importa ya salió a módulos puros (D-100, `foco.ts`,
`salida-del-panel.ts`). Este ítem no se cierra del todo porque el dueño no
aprobó "instalarlo para todo", aprobó este caso.

El texto original queda abajo.

> **No se agregó ninguna dependencia — hasta este cambio.** Una librería de
> render es una decisión de arquitectura y el ítem se relevó para que se decida
> con el costo a la vista. Abajo está el argumento; el ítem quedó **abierto**
> hasta que el dueño eligiera, y el 2026-09-02 aprobó el camino angosto de
> arriba.

**Lo que costaría.** Cuatro dependencias de desarrollo
(`@testing-library/react`, `@testing-library/dom`, `@testing-library/user-event`
y `jsdom` o `happy-dom`), más `environmentMatchGlobs` en `vitest.config.ts`
—hoy el entorno es `node` para toda la suite— y el tiempo de CI de arrancar un
DOM por archivo.

**Lo que hay que saber antes de decidir, y es lo que cambia la respuesta: de las
cuatro cosas que este ítem pide, jsdom solo puede verificar dos.**

| Lo que el ítem pide | ¿Lo cubre un test de render? |
|---|---|
| El placeholder de `TaxonomiaSelect` que se veía como opción elegida | **No hace falta**: es una pregunta pura —dado el valor actual y las opciones, qué valor y qué label le corresponden al `select`— y se testea hoy sin nada. Parte ya salió con D-116 |
| El editor de sesiones (agregar / duplicar / borrar con id generado) | **No hace falta**: `src/lib/sesiones.ts` es puro y está cubierto |
| `MenuAcciones`: cierre por clic afuera y por `Escape`, foco devuelto al disparador | **Sí, y es el caso genuino.** Es cableado de DOM: `addEventListener`, `document.activeElement`, el ciclo de Tab. Hoy lo único que lo vigila es `foco.test.ts` **leyendo el fuente**, y esa técnica ya produjo dos falsos verdes en el repo (B-202 es literalmente uno) |
| `VistaPreviaEvento`: que el aviso del link público se muestre, y que la descripción tenga **su propio scroll** | **A medias.** El aviso es puro (su adaptador ya está testeado). El scroll **no se puede**: jsdom no hace layout, así que `scrollHeight`, `clientHeight` y `overflow` efectivo no existen. Un test de render que afirme eso estaría afirmando una constante |

**La recomendación, entonces, es angosta y no la del ítem.** Vale la pena **si y
solo si** el objetivo es el cableado de las capas modales y del menú, que es
donde el repo ya se quemó dos veces: B-210 encontró ~40 líneas copiadas entre dos
capas que **habían divergido en lo que importa**, y la red que quedó es un grep
al fuente. Ahí un test de render compra algo que nada más compra.

Para el resto, el camino que este repo viene usando es **más barato y más
fuerte**: extraer la decisión a un módulo puro y testearla sin DOM
(`foco.ts`, `salida-del-panel.ts`, `formulario-dominio.ts`, `sesiones.ts`). No es
una preferencia estética — un test puro no necesita jsdom, no depende de la
implementación del markup, y no se rompe con un refactor de JSX.

**Lo que NO hay que esperar del cambio**, y conviene decirlo porque es la mitad
del ítem: agregar la librería **no** cubre el placeholder que se veía como opción
elegida (eso es apariencia, y jsdom no pinta) ni el scroll propio de la
descripción. Los dos se seguirían verificando a mano, o con un navegador de
verdad — que es otra decisión, más cara, y de otro ítem.

**Prueba de concepto:** se dejó sin hacer a propósito, porque no se puede escribir
sin instalar la dependencia primero, y eso es exactamente lo que hay que decidir
antes. El día que se apruebe, el primer archivo es `MenuAcciones` con los tres
casos de arriba (clic afuera, `Escape`, foco devuelto), que es el que mide si la
inversión rinde: si esos tres salen limpios, el resto de las capas modales sigue
el mismo molde.

---

Texto original:

No hay testing-library instalada. La lógica pura está muy cubierta (460 tests),
pero el render y la interacción del formulario se verificaron a mano.

Vale al menos para `TaxonomiaSelect` (el bug del placeholder que se veía como
opción elegida habría salido en un test de render), para el editor de sesiones y
para el `MenuAcciones` del listado (cierre por click afuera y por `Escape`) y
para `VistaPreviaEvento`: su adaptador está testeado, pero que el aviso del
link público se muestre —y que la descripción tenga su propio scroll— se
verificó a mano.

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

### B-918 · `suscripcion-literaria-schema.ts` cita B-909 donde corresponde B-906 · P4

El docblock de `imagenDeSuscripcionSchema` dice que la duplicación del schema de
`Imagen` «ya estaba anotada como deuda cuando eran dos (B-909)», y B-909 es otra
cosa: el slug sin reserva atómica. El ítem correcto es **B-906**.

Con la cuarta derivación (`imagenDeLugarSchema`) vale corregirlo antes de que la
cita mal se copie una quinta vez — la de lugares ya cita B-906.

## P3 — cuando sobre tiempo

### B-1183 · Los `node_modules` symlinkeados de un worktree no están ignorados, y un `git add -A` los commitea — ✅ hecho (2026-09-22) · P3 — de la tanda del 2026-09-22

> **Arreglado sacándoles la barra final a los dos patrones**, y verificado con
> `git check-ignore -v` en vez de leyendo el `.gitignore`.

El `.gitignore` tenía `node_modules/` y `functions/node_modules/`, **las dos con
barra final**, así que matchean un directorio y **no** un link simbólico. En un
worktree de `.claude/worktrees/` —donde `node_modules` se symlinkea al árbol
principal— los dos aparecían como `??` en `git status`, no como ignorados, y un
`git add -A` los metía al índice como blobs de modo `120000`. Le pasó a un frente
de esta tanda, que lo revirtió en un commit propio.

**Dónde:** `.gitignore:1` y `:37`.

### B-1162 · Un hallazgo que afirma «esto se ve» no dice si se reprodujo o si se dedujo leyendo · P3 — de cerrar B-1142 (2026-09-22)

**El caso concreto es B-1142.** Se cerró B-1141 con un barrido de qué otras
salidas leen el campo crudo y quedaron dos anotadas, las dos como «sale la URL
pelada». Al arreglar una se midió y era falso: `formADocumento` ya normalizaba y
el panel ya decía `@casabrandon`. El barrido miró **quién lee el campo**
(`handlesDe`, cierto) y no **por qué puerta se entra** (`textoRedesDeForm` →
`formADocumento`). Correcto sobre el módulo, falso sobre el producto.

**El costo no fue el arreglo** —vale igual, y está escrito por qué—, **fue la
prioridad**: B-1142 y B-1145 salieron en la misma lista con la misma etiqueta de
visibilidad, y solo uno la merecía. Quien prioriza no tenía cómo distinguirlas.

**Y la misma tanda dio el caso simétrico, que es lo que lo confirma como clase:**
B-1145 afirmaba en su título que arreglarlo «reescribe todo lo publicado», y al
medirlo resultó que no reescribe nada. Las dos afirmaciones se habían hecho
leyendo el código correcto y sacando la conclusión equivocada sobre el sistema.

**D-750 ya dice esto para los chequeos** («una red que no se probó mutando no se
sabe si verifica algo»). Falta el gemelo para el reporte: un hallazgo que afirma
que algo **se ve** tendría que decir si se reprodujo o si se concluyó leyendo.

**Ruta:** que los tres auditores marquen cada hallazgo como «medido» o «leído», y
que uno «leído» no pueda salir con una prioridad que afirme visibilidad. Vive en
`.claude/agents/*.md` y en `docs/13-agentes.md`.

**Sin red, y probablemente no la haya:** es una regla de redacción, no un
invariante de código. Por eso es P3 — pero el costo de no hacerlo ya está medido:
dos ítems de una misma lista con la prioridad puesta sobre una premisa falsa.

### B-1171 · Nada verifica que un enlace `](#…)` de `docs/` resuelva a un encabezado · P3 — de cerrar B-1085 (2026-09-22)

Un encabezado de este repo lleva `·`, que al generar el ancla se borra y **deja
sus dos espacios**: `### 5.3 · El invariante…` es `#53--el-invariante…`, con dos
guiones. Escribir uno solo da un enlace que **funciona** —la página carga— y no
salta a ninguna parte. Es la rotura más silenciosa que puede tener un documento
largo: no hay error, no hay 404, y quien la sufre supone que se distrajo.

`16-analitica-del-sitio.md` tenía **cuatro** así desde el 2026-09-02/03, y el
2026-09-22 se encontraron y arreglaron **otras cuatro** repartidas en
`06-decisiones.md` (D-16, D-74, D-121) y `12-sitio-publico.md` (§ 4.5), las cuatro
por un encabezado que se renombró sin actualizar a quien lo citaba. O sea que la
clase **no es de un archivo**: es el costo de renombrar un encabezado en un repo
con 96 citas cruzadas. Es hermano de `decisiones-referenciadas.mjs` e
`items-referenciados.mjs` —mismo corte, misma salida— corrido sobre la tercera
mitad del vocabulario: las anclas.

**Y hay una trampa medida en el barrido ad-hoc que lo encontró, que quien lo
escriba tiene que conocer:** la primera versión borraba el `_` al generar el
ancla, y GitHub **lo conserva**. Reportó tres falsos positivos en
`16-analitica-del-sitio.md` (`page_view`, `filtro_sin_resultados`) y se llegó a
«arreglar» dos enlaces que funcionaban antes de agarrarlo releyendo el resultado.
La regla correcta es: minúsculas, borrar lo que no sea `\w` —que **incluye** el
guion bajo—, espacio o guion, y espacios a guiones. Corrido así, `docs/` da cero.

**Lo que falta** es decidir si entra como test o como script con su test, y con
qué se congela la deuda de hoy —que es cero— para que solo pueda bajar.

### B-1191 · Los campos de Instagram del repo tienen tres criterios distintos y no hay ningún lugar donde esté escrito cuál va con cuál · P3 — salió de cerrar B-1144 (2026-09-22)

**D-767 escribe el porqué de uno de los tres. La tabla no existe.**

Hoy el mismo dato se resuelve de tres maneras según dónde se cargue:

- **Frenan el publicado** con una regla en su `superRefine`: las cuatro guías
  (`libreria-schema.ts:234`, `biblioteca-schema.ts:268`, `lugar-schema.ts:377`,
  `suscripcion-literaria-schema.ts:327` y `:330`).
- **Corrige al vuelo y no frena**: la actividad, desde B-1144 / D-767.
- **Corrige al convertir**, sin campo que mostrar: la bandeja de propuestas
  (`propuesta-schema.ts:255`, con su `?? f.organizador.instagram`).

Los tres son defendibles por separado y el del medio tiene su decisión escrita. Lo
que no hay es un lugar donde los tres estén juntos, así que **el próximo campo de
Instagram —una guía nueva, un formulario público nuevo— se va a resolver a ojo**,
copiando el vecino que quien lo escriba haya mirado primero. Es la clase de B-88
aplicada a un criterio en vez de a un formato.

**No es «unificar los tres».** Puede que la respuesta correcta siga siendo tres.
Es escribir la tabla —qué campo, qué criterio, por qué— para que la cuarta
instancia sea una elección y no una copia.

**Y hay una cuarta columna que la tabla tiene que tener:** con qué **alfabeto**.
`conArroba` en `textoRedes.ts` admite `-` y `handleInstagram` no, a propósito,
porque el primero también arma `difusion.arrobar`, que puede ser de otra red. Eso
hoy solo está en un comentario. Ver **B-1180**.

**Dónde:** candidato natural, `docs/07-seguridad.md` al lado del mapa de salidas,
o `docs/06-decisiones.md` colgado de D-767.

### B-1201 · De dónde sale el `projectId` del emulador: de la ruta del checkout o del emulador vivo · P3 — de cerrar B-1112 (2026-09-22)

**Es la salida (c) de B-1112, y es una decisión, no un renglón.** Hoy hay **una
sola** derivación —B-1111 sacó la segunda— y sale de la **ruta del working-tree**
(`scripts/project-id-emulador.mjs`, sha256 de la ruta, B-219). El emulador de
Auth, en cambio, es de **un solo proyecto**: el de su `--project` de arranque. O
sea que los dos valores coinciden solo cuando el emulador se levantó desde el
mismo checkout donde corre la suite, y cuando no coinciden lo que hay es el error
de B-1112 — que ahora se nombra, pero sigue siendo una corrida que no se puede
hacer.

Las dos salidas siguen siendo las que B-1112 dejó escritas, y ninguna es gratis:

- **Un emulador por worktree.** Es volver a la tanda de emuladores por checkout
  que B-219 evaluó y descartó (cuatro puertos por checkout más el
  `firebase.json`), y esta máquina ya no aguanta dos tandas a la vez.
- **Que los tests lean el `projectId` del emulador vivo** en vez de derivarlo. Se
  parece a lo que ya hace `scripts/emuladores-arriba.sh` y es la que B-1111 dejó
  a mitad de camino: hoy hay una derivación sola, pero sigue siendo de la ruta.
  Lo que cuesta es que el valor pasa a depender de un proceso externo, así que una
  corrida sin emulador arriba no puede resolverlo y hay que decidir qué hace ahí.

**Mientras tanto no muerde**, y conviene decir por qué para no sobreestimarlo: la
detección de B-1112 convierte el caso en un error que se lee en un renglón, y la
receta está en el propio mensaje (`levantá el emulador desde este checkout, o
corré con PUBLIC_FIREBASE_PROJECT_ID=…`). Lo que este ítem compra es no tener que
aplicarla a mano cada vez.

**Lo que hay que decidir, y por eso no se toma sin el dueño:** si el `projectId`
lo sigue mandando el checkout —y entonces la regla es «levantá el emulador donde
corrés»— o lo manda el emulador vivo, y el checkout se adapta.

### B-1146 · Correr el archivador del backlog reordena `BACKLOG-cerrados.md` entero: 19.000 líneas de diff para mover un ítem · P3 — medido al cerrar B-1141 (2026-09-21)

**El archivador es la herramienta documentada** —la cabecera de `BACKLOG.md`
dice que lo cerrado «se mueve solo» con `node scripts/archivar-backlog.mjs`— y
**nadie lo está corriendo**. Se ve en el historial: los últimos commits que
cerraron ítems (B-1136, B-1137, B-1139, B-1140) tocan `BACKLOG-cerrados.md` con
diffs de 13 a 59 líneas, o sea que escribieron la entrada a mano.

**Por qué, medido hoy.** Correrlo para mover **un** ítem produjo un diff de
**19.207 líneas** sobre `BACKLOG-cerrados.md` (9.627 inserciones, 9.580 bajas)
para un contenido que crece 47 líneas. La causa es que reescribe el archivo
agrupando por sección en el orden en que las encuentra, y eso **reordena las
secciones**: pasó de `P0 → P3 → P2 → Pendiente → P1` a
`P2 → P0 → P3 → Pendiente → P1`. Ninguno de los dos órdenes es el de las
prioridades, así que el reordenamiento no arregla nada — solo mueve.

**El daño no es el archivo, es la revisión.** Un diff de 19.000 líneas es
irrevisable, así que el cambio real queda enterrado y cualquier edición manual
que alguien hubiera hecho en el medio se vuelve invisible. Por eso el ítem se
cerró insertando la entrada a mano, como venían haciendo los anteriores: 49
líneas de diff en vez de 19.207.

**Lo que hay que decidir es cuál de las dos:** que el archivador **conserve** el
orden de secciones del archivo destino (inserta en su sección y no toca el
resto), o que **ordene** de verdad por prioridad, de una vez, en un commit
dedicado que se revise sabiendo que es puro movimiento. Lo que no puede quedar
es que la herramienta documentada sea la que nadie usa porque su salida no se
puede mirar.

**Dónde:** `scripts/archivar-backlog.mjs`. La red que lo obliga a existir es
`tests/tablero.test.ts:395` («parsea docs/BACKLOG.md entero y no pierde ítems»),
que se pone roja si un ítem `✅ hecho` se queda en el archivo vivo — y está
bien: es lo que detectó que faltaba archivar.

### B-1143 · El docblock de `instagrams-de-la-base.mjs` describe una copia y un test de equivalencia que B-928 borró · P3 — salió de cerrar B-1141 (2026-09-21)

**Misma clase que el tercer arreglo de B-1141: un comentario que afirma una red
que no existe.** El docblock de `scripts/instagrams-de-la-base.mjs` dedica
veinte líneas a explicar que la normalización del handle es «una copia, y atada
por un test»: que `scripts/handle-instagram.mjs` tiene una segunda
implementación y que `tests/instagrams-de-la-base.test.ts` corre las dos contra
la misma batería exigiendo que contesten igual.

**Nada de eso es cierto desde B-928.** `scripts/handle-instagram.mjs` es hoy una
reexportación de tres líneas —su propio docblock lo dice— y la implementación es
única. El comentario también manda a `src/lib/detallePublico.ts` como «la
normalización de verdad», y la implementación vive en
`src/lib/handle-instagram.mjs` desde el mismo ítem.

**Por qué importa aunque no rompa nada:** quien lea ese docblock antes de tocar
el handle va a creer que tiene que escribir el arreglo dos veces, o va a buscar
un test de equivalencia que ya no existe para entender por qué está en verde.
Es la misma confusión que B-1141 sacó de `conHandle`, en otro archivo.

**Dónde:** `scripts/instagrams-de-la-base.mjs:36-57`.

### B-1083 · `D-200` nombra dos decisiones distintas · P3 — de documentar el tablero (2026-09-17)

La entrada escrita en `06-decisiones.md` es «Los nombres de los meses se
comparten» (B-215). Pero `EstadisticasPanel.tsx`, `estadoDelCatalogo.ts`,
`analytics-eventos.ts`, `09-analitica.md` y dos secciones de
`16-analitica-del-sitio.md` citan **D-200** como «por qué el tablero arranca por
el catálogo». D-271 y D-273 también lo citan con ese segundo sentido.

**No lo agarra el barrido de decisiones huérfanas —el número existe, solo que dice
otra cosa— y el enlace resuelve**, así que quien lo siga lee una decisión sobre
meses y se queda pensando que entendió. Se arregla eligiendo número nuevo para la
del tablero (el criterio ya está redactado en el § 8 de `16-analitica-del-sitio.md`)
o renumerando la de los meses. Cualquiera de las dos toca varias citas: por eso es
P3.

### B-1084 · El docblock de `anchoDelPanel.ts` describe un tablero que no existe · P3 — de documentar el tablero (2026-09-17)

Para justificar que `estadisticas` use todo el ancho, dice: «el tablero pasó a
tener repartos con torta, **dos vistas de tiempo y un mapa de calor de ocho
semanas**». Los repartos con torta sí; las dos vistas de tiempo y el mapa de calor
**no se dibujan en ninguna parte** (B-1081). El argumento del ancho sigue siendo
bueno por los repartos y los avisos en dos columnas; lo que hay que sacar es la
mitad que afirma pantalla que no hay. Se cierra solo si B-1081 se dibuja.

### B-1086 · `D-272` y el § 8.1bis describen la franja fija que B-798 sacó · P3 — de documentar el tablero (2026-09-17)

Las dos describen «una franja fija con tres cosas» arriba de la pestaña del
sitio. El dueño **sacó los cuatro párrafos el 2026-09-07** mirando la pantalla
publicada (B-798), y el componente lo dejó escrito en un comentario largo con el
argumento que perdió.

**La decisión de D-272 no cambió** —ni un número inventado— y lo que caducó es la
descripción de la forma. El § 8.1bis ya tiene un aviso de «esta sección describe
el estado del 2026-09-03», así que ahí es una línea más; D-272 necesita una nota
de superada-en-parte, con el precedente de cómo quedaron escritas D-270 y D-273.

### B-1072 · `build-contra-emulador.mjs` creció 1.366 líneas en ocho días · P3 — de remedir B-1010 (2026-09-17)

Pasó a ser **el archivo más grande del repo** (2.977 LOC), y es la primera vez
que la cima no es código del producto sino un script de verificación. No es una
frontera de privacidad deliberada como `detallePublico.ts`, así que el argumento
de «no partir» que protege a los dos primeros de la lista no le aplica.

**Queda sin diagnóstico a propósito: medirlo no alcanza.** Hay que decidir si es
un barrido que se ganó el tamaño —cada paso que agrega es un gate real— o un
archivo que hay que partir. Mismo criterio que el § 1.3 con el formulario.

### B-1073 · El fan-in del formulario viene subiendo desde el saneamiento y es el único sin umbral escrito · P3 — de remedir B-1010 (2026-09-17)

12 → 19 → 25 → 26 → 24 → 27 → **32**, sin pausa. La fila de LOC tiene su alarma
calibrada (B-856 la recalibró mirando el archivo, y lo que estaba mal era el
umbral); ésta no tiene ninguna, y es la que mide **de cuántas piezas depende el
formulario** — o sea la que dice cuándo tocarlo empieza a ser caro.

### B-1111 · `tests/emulador.ts` deriva el `projectId` por su cuenta, con el literal como fallback — ✅ hecho (2026-09-22) · P3 — del relevamiento del emulador (2026-09-17)

> **Cerrado importando el valor de su fuente única** (`scripts/project-id-emulador.mjs`),
> que ya respeta `PUBLIC_FIREBASE_PROJECT_ID` cuando viene del entorno: la salida
> de emergencia del gate no se pierde, lo que se pierde es el fallback
> equivocado.
>
> **Medido antes de arreglar, y es lo que convierte «parece flojo» en «no
> agarraba nada» (D-750).** Con la línea vieja puesta a propósito, los **21
> casos** de `emulador-aislado` y `proyecto-de-auth` quedan **en verde** —
> incluido el `expect(PROJECT_ID).toBe(PROJECT_ID_EMULADOR)` que parecía cubrirlo
> exactamente. Bajo vitest la variable está exportada, así que las dos
> derivaciones coinciden y el assert pasa: la red tenía el assert que nombra la
> propiedad y no podía verla.
>
> **Es B-1129 con otra cara** —un chequeo que pasa por dónde está parado— y la
> salida fue la misma que allá: **cambiar la firma, no ensanchar el alcance**. El
> chequeo nuevo mira la **fuente** (en runtime el bug no existe) y, dentro de la
> fuente, la **asignación** y no el archivo entero: un
> `toContain('PROJECT_ID_EMULADOR')` lo satisfaría el propio docblock que explica
> el arreglo, que es el caso 2 de B-1129 calcado.
>
> **Y el hueco estaba en la red que ya existía**, que es lo que lo hace valer: la
> misma `emulador-aislado.test.ts` ya verificaba que `vitest.config.ts` importa y
> no re-deriva, que el gate en bash llama al CLI, y que ningún
> `*.integracion.test.ts` escribe el literal. El único archivo sin ese chequeo era
> `tests/emulador.ts` —el hub del que importan todos los demás— porque el barrido
> lista `*.integracion.test.ts` y él no termina así.
>
> Cuatro mutaciones probadas, las cuatro en rojo. Commit `75a6501`.

`export const PROJECT_ID = process.env.PUBLIC_FIREBASE_PROJECT_ID || 'agenda-literaria';`

El fallback es el **literal compartido**, no el valor que calcula
`scripts/project-id-emulador.mjs`, que es el único lugar donde vive esa decisión
(B-219). Por vitest está cubierto —`vitest.config.ts` exporta la variable— así que
**hoy no es un bug**. Pero cualquier corrida fuera de vitest —un script suelto, un
`node` a mano— cae al projectId compartido y **escribe en la base de todos**, que
es exactamente lo que B-219 existe para evitar.

Es la clase **D-88** otra vez, la misma que B-1110 en el archivador: dos lados
derivando el mismo valor por su cuenta, con uno de los dos desactualizado. Y va
junto con el residual conocido de **B-366**: `cargarReglasStorage` usa el endpoint
global `/internal/setRules`, así que `storage.rules` **no** está aislado por
proyecto y la última carga gana para todos los worktrees.

### B-1122 · El nodo `Organization` del sitio, con el `sameAs` a Cafecito, nunca se escribió · P3

**Sobrante declarado adentro de B-107** (Meta/OpenGraph/JSON-LD, ✅ 2026-09-02):
«`Organization` en `/contacto` sigue afuera: nadie la pidió, y no tiene ítem
propio (§4.5 del diseño)». Verificado hoy, sigue siendo cierto — y conviene
decir por qué no alcanza con lo que hay: los tres `Organization` que existen en
el código son **otra cosa**. `src/lib/detallePublico.ts:1670` es el organizador
de cada actividad; `src/lib/suscripcionPublica.ts:717,739` son el `brand` y el
`seller` de una oferta. Ninguno describe al sitio. En `src/pages/contacto.astro`
y `src/lib/contactoDelSitio.ts` no hay `Organization` ni `sameAs`.

Es el nodo que ata la identidad del sitio con sus perfiles, y **B-785 está
bloqueado esperándolo**: su mitad pendiente es agregarle el `sameAs` al perfil de
Cafecito, que no se puede hasta que el nodo exista.

### B-1123 · Un patrón citado tres veces como «D-100» y que no tiene ningún `D-` propio · P3

**Sobrante declarado adentro de B-345** (las citas a D-100 corregidas a D-111,
✅ 2026-09-02). Quedaron dos citas más a D-100, en los cuerpos de B-50 y B-35
(`docs/BACKLOG-cerrados.md:4301-4310` y `4312-4333`, verificadas hoy), que
describen **un tercer patrón**: derivar un chequeo del grafo de imports, y sacar
una decisión a un módulo puro para poder probarla. El propio B-345 lo dejó
escrito: «quedan anotadas acá para quien quiera formalizar esa decisión con su
propio número».

Es exactamente la misma forma que B-910 —una decisión que el repo aplica en todos
lados y que nunca se escribió— con la diferencia de que acá ni siquiera hay un
número reservado. Y el patrón que nombra es de los más usados del proyecto: sacar
la decisión del lugar imposible de probar es lo que hizo `que-deployar.sh`,
`emuladores-arriba.sh` y media docena más.

### B-1050 · El doble de `Timestamp` de `lista-actividades.render.test.tsx` no usa el fixture compartido · P3 — de cerrar B-875 (2026-09-17)

Ese archivo define su propio `ts` en vez de importar el de
`tests/fixtures/tiempo.ts`, que es la clase de B-211. Se dejó **a propósito** al
cerrar B-875 —ese ítem era el detector, no el fixture— y hoy vive como excepción
documentada (`EXCEPCIONES_CONOCIDAS`) en `clases-de-bug.test.ts`, que es
justamente el detector que hasta B-875 no lo veía por filtrar `.ts` y no `.tsx`.

Reemplazarlo por el fixture compartido y borrar la excepción. Mientras la
excepción exista, el detector tiene un agujero **declarado**, que es mejor que el
que tenía, pero sigue siendo un agujero.

### B-909 · Dos altas simultáneas de librería pueden quedarse con el mismo slug · P3

`slugDeLibreriaDisponible` (`src/lib/librerias.ts`) es una guarda **de aviso**, no
una garantía: consulta antes de escribir y no hay reserva atómica. `/actividades`
la tiene (`/slugs`, D-660) porque el slug se acuña en un `writeBatch`; montar lo
mismo acá es abrir `/slugs` a una colección más —o sea tocar la regla del índice—
por un catálogo de cuarenta fichas que carga una persona por vez.

El daño es acotado y visible: dos fichas con el mismo slug, las dos en `pendiente`
—nada sale al sitio sin que un admin lo publique— y la segunda se corrige en la
bandeja, que es justo el momento en que el slug todavía se puede tocar. **Lo que
haría subir la prioridad es abrir el alta pública** (B-872/B-896).

### B-906 · `imagenSchema` está escrito dos veces: `src/lib/schema.ts` no lo exporta · P3

`libreria-schema.ts` tiene su propia derivación zod de `Imagen` porque la de
`schema.ts` es privada del módulo. Son dos versiones de la misma forma, o sea la
clase de B-88: un campo nuevo de `Imagen` entra en una y no en la otra, y lo único
que hoy lo sostiene es que las dos tipan a `Imagen`. Se cierra exportando la de
`schema.ts` y borrando la copia; no se hizo en el commit de B-831 porque ese archivo
era de otro frente.

**Actualizado el 2026-09-11:** B-832 no lo hizo, así que ya son **tres** copias
(`schema.ts`, `libreria-schema.ts`, `suscripcion-literaria-schema.ts`). Con la
tajada 4 serían cuatro. Vale subirlo a P2.

### B-907 · La regla de `/librerias` no puede iterar `imagenes` — B-842 con otra cara · P3

De `imagenes` se acota la cantidad (4) y el tipo, no la forma de cada fila: una
regla de Firestore no itera una lista. Con el `create` cerrado a admin el daño es
«el admin ve una ficha rara»; el día que B-872/B-896 lo abran, un `curl` puede
mandar cuatro mapas arbitrarios, y **la URL de cada imagen termina en un `src` de
una página indexada**.

La defensa que corresponde es que la proyección pública las pase por `urlSegura` /
`imagenesPublicables`, que es donde el proyecto ya decidió que se sanea — y hay que
**verificarlo** cuando se escriba el `toPublic` de la entidad, no suponerlo. La otra
mitad, si aparece abuso, es una Function (es B-842).

### B-902 · La Guía merece su propia pregunta en la ayuda del sitio · P3

Hoy entra como tercer párrafo de «¿Qué es esto?» y no como «¿Esto solo tiene
actividades?». El motivo es de contabilidad, no de criterio: el conteo de preguntas
está atado a `04-funcionalidades.md`, `06-decisiones.md` y a este archivo, y la 22ª
obliga a corregir los tres números. Cuando la Guía tenga sus tres secciones cargadas
la pregunta propia se justifica sola.

### B-840 · La fila DEC-6 de este archivo tiene una cicatriz de merge · P3

**Lo encontró el `auditor-documentacion`** el 2026-09-08, auditando otra cosa (los
PRDs de B-830). La fila **DEC-6** de «Decisiones pendientes del usuario» tiene
prosa **duplicada y cortada a mitad de oración**, con un `|` suelto en el medio:
arranca con la resolución del 2026-09-03, abre un paréntesis que dice «El texto
original decía que faltaba el handle (#2)…», y ese paréntesis nunca cierra — sigue
con el texto viejo entero, que contradice al nuevo (dice que falta el dominio, y
el dominio está desde el 2026-09-02).

**No es de esta tanda.** `git blame` la fecha el **2026-08-26**, o sea que estuvo
así casi dos semanas. Queda anotada porque es el rastro que pide la regla de
proceso, y porque es **la misma clase que B-294 y B-367**: texto pegado de un
merge sin resolver, que no rompe nada y nadie ve. La diferencia con esas dos es
que acá el daño no es de renderizado —la tabla se dibuja bien— sino de contenido:
**la fila afirma dos cosas incompatibles y hay que leerla dos veces para saber
cuál vale**.

**El arreglo** es reescribir la fila con la resolución sola, y mover el texto
original a una cita `>` abajo si se lo quiere conservar — que es lo que este
archivo ya hace en otras entradas. Es P3 porque DEC-6 **está cerrada**: nadie
depende de leerla bien.

**Y no hay red que lo agarre**, ni la va a haber baratamente:
`tests/bloques-de-codigo-en-la-doc.test.ts` cuenta fences, `red-de-contencion.test.ts`
cuenta filas de **una** tabla puntual, y el `auditor-documentacion` lo encontró
leyendo. Una tercera cicatriz de la misma clase justificaría preguntarse por un
barrido de «paréntesis que no cierra en una celda de tabla», pero con dos y una de
ellas cerrada, todavía no.

---

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

### B-631 · La verificación contra Calendar mira si el evento existe, no si dice lo mismo · P3

`scripts/verificar-calendario.mjs` (B-125, D-293) le pregunta a Calendar por cada
`calendarEventId` publicado y actúa sobre una sola respuesta: **existe o no
existe**. Con `--reparar` recrea los que dan 404/410.

Lo que no mira es la otra divergencia posible, que es la de **B-162**: el evento
existe, y su texto no es el que el código de hoy produciría. Pasa cada vez que
cambia *cómo se arma* la descripción —D-95 cambió la numeración de los ciclos con
un encuentro cancelado y los eventos ya publicados se quedaron diciendo «de 7»—
porque la guarda del §7.1 calcula los dos lados con el código de hoy y no ve
diferencia (D-07). La divergencia solo se ve desde afuera, y este script es el
único que mira desde afuera.

**Y sale casi gratis:** `events.get` ya devuelve el evento entero. Hoy se usa
`respuesta.data.status` y se descarta el resto; `summary`, `description`,
`location`, `start` y `end` están ahí, sin una llamada más.

El corte es el de siempre: la comparación pura en `functions/reconciliacion.js`
—al lado de `interpretarExistencia` y `planificarReparacion`, que ya tienen su
tabla testeada sin red— y el efecto en el script.

Dos cuidados que no son obvios:

- **Comparar el subconjunto que nosotros escribimos, no el evento entero.**
  Calendar devuelve `etag`, `created`, `updated`, `iCalUID`, `sequence`,
  `reminders`, `organizer`… nada de eso lo manda `construirEvento`, y compararlo
  daría «distinto» en el 100 % de los eventos. Las claves a comparar salen de
  `Object.keys(construirEvento(...))`, **derivadas y no listadas a mano**: un
  campo nuevo en el evento entra solo al chequeo, que es el criterio de D-07 otra
  vez.
- **`start`/`end` vuelven normalizados.** Calendar devuelve `dateTime` con el
  offset local (`2026-09-03T19:00:00-03:00`) y nosotros mandamos ISO en UTC
  (`2026-09-03T22:00:00.000Z`): son el mismo instante y comparar los strings daría
  distinto siempre. Se comparan por `Date.parse` (o `milisDe`), no por texto. El
  `timeZone` sí se compara tal cual — es la trampa 1 y tiene que decir
  `America/Argentina/Buenos_Aires`.

Lo que compra: cierra **B-162** sin depender de la decisión de producto de
**B-160** —que hasta ahora eran los dos juntos o ninguno— y deja medida la
suposición que sostiene la guarda anti-loop para el próximo cambio de texto.

#### El parche de B-631, listo para el frente dueño de `scripts/`

**En `functions/reconciliacion.js`** (mitad pura, con sus tests en
`tests/reconciliacion.test.ts`):

```js
/**
 * B-631 — ¿el evento que Calendar tiene dice lo mismo que el código de hoy
 * produciría?
 *
 * Es la otra divergencia posible, la que la guarda del §7.1 no puede ver: los
 * dos lados de esa comparación se calculan con el código de hoy (D-07), así que
 * un cambio en *cómo se arma* la descripción deja los eventos publicados atrás
 * y no emite ninguna operación (B-162). Desde afuera sí se ve, y este script es
 * el único que mira desde afuera.
 *
 * Se comparan **solo las claves que `construirEvento` produce**, derivadas y no
 * listadas a mano: Calendar devuelve además `etag`, `created`, `updated`,
 * `iCalUID`, `sequence`, `reminders`, `organizer`… y compararlo entero daría
 * "distinto" en el 100 % de los eventos. Derivarlas es lo que hace que un campo
 * nuevo del evento entre solo a este chequeo, que es el criterio de D-07.
 *
 * `start`/`end` se comparan por **instante y zona**, no por texto: Calendar
 * devuelve `dateTime` con el offset local (`…T19:00:00-03:00`) y nosotros
 * mandamos ISO en UTC (`…T22:00:00.000Z`). Son el mismo momento; comparar los
 * strings daría distinto siempre. El `timeZone` sí se compara tal cual — es la
 * trampa 1, y tiene que decir `America/Argentina/Buenos_Aires`.
 */
export const camposDivergentes = (esperado, enCalendar) => {
  const distintos = [];
  for (const clave of Object.keys(esperado)) {
    const a = esperado[clave];
    const b = enCalendar?.[clave];
    const iguales =
      clave === 'start' || clave === 'end'
        ? milisDe(a?.dateTime) === milisDe(b?.dateTime) && a?.timeZone === b?.timeZone
        : (a ?? null) === (b ?? null);
    if (!iguales) distintos.push(clave);
  }
  return distintos;
};

/**
 * Las sesiones cuyo evento existe pero dice otra cosa. `eventos` es un `Map` de
 * `sesion.id` → el cuerpo que devolvió `events.get`.
 *
 * Solo mira las que `interpretarExistencia` dio por `'existe'`: sobre una que no
 * está, o una que no se pudo verificar, no hay contenido que comparar — y
 * afirmar divergencia sobre un `'desconocido'` produciría un `update` sobre una
 * sospecha, que es lo mismo que `interpretarExistencia` ya evita.
 */
export const planificarReescritura = (candidatas, resultados, eventos, construir) => {
  const reescribir = [];
  for (const c of candidatas) {
    if ((resultados.get(c.sesion.id) ?? 'desconocido') !== 'existe') continue;
    const esperado = construir(c.actividad, c.sesion);
    const campos = camposDivergentes(esperado, eventos.get(c.sesion.id));
    if (campos.length > 0) reescribir.push({ ...c, campos, evento: esperado });
  }
  return reescribir;
};
```

(`milisDe` se importa de `./calendario.js`, como ya hace `rebuild.js` — D-20.)

**En `scripts/verificar-calendario.mjs`**, dentro de `ejecutarVerificacion`: al
guardar el resultado del `events.get`, guardar también el cuerpo (hoy se
descarta), y después de `planificarReparacion` calcular la reescritura:

```js
  const resultados = new Map();
  const eventos = new Map();                                   // ← nuevo
  for (const c of candidatas) {
    const respuesta = await cal.obtener(c.sesion.calendarEventId);
    if (respuesta.ok) eventos.set(c.sesion.id, respuesta.data); // ← nuevo
    resultados.set(/* … igual que hoy … */);
  }

  const { reparar: aReparar, desconocidos } = planificarReparacion(candidatas, resultados);
  const aReescribir = planificarReescritura(candidatas, resultados, eventos, (a, s) =>
    construirEvento(a, s, labels),
  );
```

y en el bloque de `--reparar`, un `cal.actualizar(c.sesion.calendarEventId,
c.evento)` por cada uno (no hace falta write-back: el `calendarEventId` no
cambia). `aReescribir` sale en el `return` para que el reporte de solo lectura lo
liste con sus `campos`, que es la mitad que vale aunque nadie repare nada.

**Ojo con el orden:** la reescritura va **después** de las recreaciones, o se
emitiría un `update` contra un evento que se acaba de recrear con ese mismo
contenido.

### B-57 · El abandono por cierre de pestaña se pierde si el SDK no cargó

`formulario_abandonado` se dispara también en `pagehide`, pero el SDK de
analítica se carga diferido (D-58): si alguien abre el panel y cierra la pestaña
antes de que arranque, ese evento se encola y muere con la página.

El camino que importa —"Cancelar" / "← Volver"— no sale de la página y se mide
bien. Si el número de abandonos parece bajo, esta es la primera sospecha.
Arreglarlo bien pide `sendBeacon` contra el Measurement Protocol, que es bastante
más máquina de la que amerita.

### B-58 · 🟡 la mitad hecha (2026-09-07) — Dos interacciones sin medir, por no tocar el JSX

**Hecha la que faltaba de verdad: `encuentro-cancelar`.** El motivo por el que
estaba afuera —«medirlas exigía reacomodar el markup de componentes que otros
cambios están tocando»— caducó: no hay frentes en paralelo.

Y no entró por completitud. **Es el dato que falta para decidir B-162**, trabado
desde agosto: si el rótulo de un encuentro cancelado de un ciclo publicado hay que
actualizarlo en el calendario depende de **cuántas veces pasa**, y hoy nadie lo
sabe. Un ciclo que se cancela una vez al año no justifica reescribir N eventos de
Calendar; uno que se cancela cada dos semanas sí. La cancelación es además el único
de los estados de una sesión que **borra un evento del calendario público** (§7.3),
o sea el que más se nota afuera.

Se emite con **1 al prender y 0 al apagar**, como `actividad-cupo-completo`: medir
solo el prendido contaría cancelaciones y arrepentimientos como lo mismo, y el
número que B-162 necesita es cuántos encuentros quedan cancelados de verdad. Los
dos casos están en `tests/sesiones.test.ts` con su mutación.

**Y al agregarla apareció un drift de tres:** la tabla del §«funcion» de
`docs/09-analitica.md` —lo único que dice **qué mide el panel y con qué `valor`**—
no nombraba `duplicar-desmarcar` (B-199), `encuentro-correr` (B-186) ni
`actividad-cupo-completo` (B-97). O sea que tres funciones se habían agregado al
enum sin pasar por la tabla: no es un olvido de una vez, es un patrón. Importa más
que un índice viejo, porque **esa tabla es la que se consulta para saber si un
evento puede llevar texto libre**: una función que no está es una que se mide sin
que nadie haya escrito qué manda.

Completada, y con red en las dos direcciones (`tests/analytics-privacidad.test.ts`):
la tabla no puede quedarse corta, y tampoco nombrar una función que el enum no
tiene —eso haría creer que se mide algo que no—. La lista sale del enum. De paso
quedó escrita la excepción del `valor`: `encuentro-correr` lleva **signo**, porque
correr un encuentro dos días para atrás y dos para adelante no son el mismo dato.

**Lo que sigue afuera, y sigue estando bien:** `url_publica` se mide igual en
`guardado_ok`, que es el dato que importa, así que un evento propio no agrega nada.
Y el **embudo fino** del formulario sigue costando 30+ inputs o un `onFocus` a
nivel del `<form>` para lo que `formulario_abandonado.faltantes` ya da grueso.

El planteo original queda abajo.

---


Marcar un encuentro como **cancelado** y tildar **"publicar el link de la
reunión"** están en `onChange` inline dentro del JSX, y medirlas exigía
reacomodar el markup de componentes que otros cambios están tocando. Se dejaron
afuera a propósito.

`url_publica` se mide igual en `guardado_ok`, que es el dato que importa. La
cancelación de un encuentro no se mide en ninguna parte.

Tampoco está el **embudo fino** del formulario (qué campo se tocó último antes de
abandonar): eso pide instrumentar 30+ inputs o un `onFocus` a nivel del `<form>`,
y hoy `formulario_abandonado.faltantes` da la ubicación gruesa sin tocar nada.

### B-101 · Las actividades que ya pasaron no se archivan en ninguna parte — 🟡 **la mitad del sitio, hecha** (2026-09-02)

**La mitad del sitio la cerró B-109.** «¿No las lista pero conserva la página por
SEO?» — sí, y con las tres cosas escritas: salen del listado y de los hubs,
conservan la página **indefinidamente** (§7.1), aparecen en **`/pasadas`** para
siempre, y su entrada del sitemap vence a los 90 días. No hizo falta un estado
nuevo: se deriva de la última sesión, como decía este ítem.

**Sigue abierto lo del panel**: el listado del panel las mezcla igual (está
ordenado por última modificación) y qué hace con ellas —una pestaña, un filtro—
no se decidió. Eso es lo que queda de este ítem, y cuadra con B-96.

El texto original:

No hay estado para "terminó". Un taller de marzo sigue `publicado` con todas sus
sesiones en el pasado: se mezcla en el listado del panel (ordenado por última
modificación) y, cuando exista el sitio, hay que decidir si aparece.

No hace falta un estado nuevo: se deriva de la última sesión. Lo que hace falta es
decidir qué hacen con eso el listado del panel (¿una pestaña "pasadas"? ¿un
filtro?) y el sitio (¿no las lista pero conserva la página por SEO, que es
probablemente lo correcto?). Cuadra con B-96 y con B-01.

## Agentes y automatización del flujo (B-115 a B-124)

Lo que quedó pendiente al definir los agentes y skills de `.claude/`. El qué hay
y por qué está en [`13-agentes.md`](13-agentes.md). La prioridad va en cada ítem.
