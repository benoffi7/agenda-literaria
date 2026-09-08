# PRDs — lo que todavía no se construyó

Cuatro PRDs escritos el **2026-09-08**, a pedido del dueño, en una sola
conversación. No son backlog: el backlog dice *qué falta y con qué prioridad*
([`../BACKLOG.md`](../BACKLOG.md), **B-830 a B-838**); esto dice **qué se va a
construir**, con el modelo, las salidas, la privacidad y las decisiones que
faltan.

| # | PRD | Qué agrega | Link público |
|---|---|---|---|
| 1 | [`01-propuestas-de-organizadores.md`](01-propuestas-de-organizadores.md) | Un formulario **sin login** para que un organizador cargue su actividad, y una **bandeja** en el panel para validarla, completarla y publicarla | `/proponer` |
| 2 | [`02-librerias.md`](02-librerias.md) | Directorio de **librerías** | `/librerias` + `/librerias/sumar` |
| 3 | [`03-suscripciones-literarias.md`](03-suscripciones-literarias.md) | Directorio de **suscripciones literarias** | `/suscripciones` + `/suscripciones/sumar` |
| 4 | [`04-lugares-para-eventos.md`](04-lugares-para-eventos.md) | Directorio de **lugares para hacer eventos** | `/lugares` + `/lugares/sumar` |
| — | [`05-inventario-de-archivos.md`](05-inventario-de-archivos.md) | **El inventario archivo por archivo**: qué se crea, qué se toca, de dónde se copia cada patrón, en qué orden, y las siete cosas que se rompen en silencio | — |

Los cuatro son, además, **una sección nueva de la barra de navegación** — eso lo
pidió el dueño con esas palabras: «cada uno de estos formularios también es una
sección superior en la web».

Y un pedido chico del mismo día, que no es un PRD y va derecho al backlog:
**`/contacto` suma Instagram como canal** (**B-839**). Está razonado en el
[PRD 1 § 2](01-propuestas-de-organizadores.md#2--el-problema-como-pasa-hoy),
porque es el mismo problema: hoy el único camino para avisar de una actividad es
un `mailto:`, y en este circuito la gente escribe por DM.

---

## Por qué hay un README antes de los PRDs

Porque **los cuatro comparten la mitad del trabajo**, y si cada PRD se lee solo,
esa mitad se escribe cuatro veces y se construye tres veces mal. Lo que sigue es
lo común; cada PRD asume esto y solo dice lo suyo.

Es exactamente la clase de bug que este repo ya tiene nombrada (B-88, B-72): un
productor y un consumidor derivando el mismo formato por separado. Acá serían
**cuatro** formularios públicos, **cuatro** moderaciones y **cuatro**
proyecciones, con las mismas reglas y cuatro implementaciones.

---

## 1 · La forma común: proponer → bandeja → publicar

Los cuatro tienen el mismo ciclo de vida, y es el mismo que ya funciona para una
actividad, con un paso más adelante:

```
alguien de afuera (sin login)  →  documento en estado 'pendiente'
                                        ↓
                          bandeja en el panel (solo admin)
                                        ↓
                 admin completa / corrige / rechaza  →  'publicado'
                                        ↓
                              rebuild  →  sitio estático
```

**Nada que entre por un formulario público aparece en el sitio sin que un admin
lo publique.** No es una preferencia: es lo único que hace que abrir la escritura
anónima no sea abrir la publicación anónima. El `estado` inicial **lo fuerza la
regla de Firestore**, no el cliente — si lo decide el cliente, un `curl` publica.

Y de acá sale la decisión de arquitectura que hay que tomar **antes** de construir
el primero de los cuatro (**B-834**): un mecanismo compartido para el formulario
público, la moderación y la proyección, con los campos por entidad, o cuatro
implementaciones. La recomendación de estos PRDs es **una colección por entidad**
(`/propuestas`, `/librerias`, `/suscripciones`, `/lugares` — la proyección pública
tiene que ser una whitelist **por entidad**, y una whitelist genérica es la forma
de que un campo nuevo salga solo) **con un solo motor** para lo que no depende de
los campos: la regla de creación anónima, la bandeja, el `estado`, la auditoría de
quién publicó y el disparo del rebuild.

---

## 2 · El problema nuevo: por primera vez alguien escribe sin estar logueado

Hoy **ninguna** colección acepta una escritura de un anónimo. `firestore.rules`
es explícito: sin el claim `admin` no hay `write` posible, y el `match
/{document=**}` del final cierra todo lo que no se nombró. Estos cuatro PRDs
abren la primera puerta, y con ella entran tres cosas que hoy el proyecto no
tiene:

1. **Spam y abuso.** Un formulario público sin login es un endpoint de escritura
   a Firestore. Sin defensa, un script llena la bandeja y la factura.
2. **Costo.** Cada escritura es una escritura facturada, y el plan es Blaze
   (§2.3). El budget alert existe; el techo de escrituras no.
3. **Datos personales de terceros.** Es el más caro de los tres y tiene una
   decisión ya tomada **en contra** que hay que reabrir a propósito — ver §4.

La defensa mínima, y es **bloqueante de los cuatro** (**B-836**):

| Capa | Qué frena | Dónde vive |
|---|---|---|
| **Firebase App Check** (reCAPTCHA v3 en la web) | el script que escribe sin pasar por la página | consola + `firestore.rules` |
| **Validación en la regla** | el documento gigante, el campo de más, el `estado` elegido por el cliente | `firestore.rules`, con el mismo patrón de `reporteValido()` que ya existe |
| **Techo de tamaño y de forma** | el texto de 2 MB, el array de 500 items | la misma regla |
| **Honeypot + tiempo mínimo de tipeo** | el bot tonto, que es la mayoría | el componente del formulario |
| **Barrido programado** | la bandeja que crece sin que nadie la mire | una Function `onSchedule`, como las que ya hay |

Lo que **no** alcanza: validar solo en el cliente. El cliente se saltea, y este
repo ya lo aprendió con las imágenes (DEC-7b: el límite está en el schema **y** en
`storage.rules`).

### La foto, que es el caso incómodo

El dueño pidió, para el formulario de propuestas, «cargar la foto **o** subir la
url». La URL es gratis: es un string que se valida y no toca el bucket. **El
archivo no**: subir un archivo sin login es abrirle `write` a Storage a un
anónimo, y `07-seguridad.md` ya trata al bucket como una salida pública más.

La forma de tenerlo sin abrir el bucket:

- un **prefijo propio** (`propuestas/`, `directorio-pendiente/`) que ninguna
  salida pública lee;
- `allow write` acotado a **tipo, tamaño y cantidad**, con App Check;
- **`allow get` y `allow list` en `false`** para ese prefijo — es la trampa 13 del
  §13: `read` incluye `list`, y un uuid impredecible no sirve si te dan la lista;
- la imagen **se promueve** a la galería de la actividad recién cuando el admin
  publica, y ahí entra por el camino que ya existe (B-167, y la Function de
  optimización de B-220);
- y un barrido que borra lo que quedó sin promover, que es el mismo problema de
  huérfanos de B-221.

Si esto se ve caro para la v1, la salida barata es **solo URL en el formulario
público** y el archivo lo sube el admin desde el panel. Es una decisión del dueño
(**DEC-11**), no una que un agente deba tomar sola.

---

## 3 · «Qué incluye», el campo que aparece en los cuatro

No estaba buscado y salió de leer los cuatro pedidos juntos:

| PRD | Cómo lo pidió el dueño |
|---|---|
| Propuestas | «qué incluye el evento? (Material de lectura, libro, merienda, etc)» |
| Librerías | — |
| Suscripciones | «Qué incluye?» + «Extras: incluye algo más? Regalos, descuentos, otros» |
| Lugares | «Que incluye el lugar: atención (Café, consumición, etc), mesa para varias personas, salón sólo con espacio y sillas» |

Son **tres veces el mismo campo**: una lista de cosas de un vocabulario abierto
que crece con el uso. O sea, exactamente el patrón del **§4 del `CLAUDE.md`** —
desplegable enumerado + «Otro» que se incorpora—, que ya está implementado y
resuelto para cinco campos.

**Recomendación: `incluye: string[]` con taxonomía autogestionada, una por
entidad** (`/opciones/incluye-actividad`, `/opciones/incluye-suscripcion`,
`/opciones/incluye-lugar`). Vocabularios separados porque «merienda» y «proyector»
no pertenecen a la misma lista, y el desplegable ordenado por `usos` deja de
servir si están mezclados. El costo es cero de mecanismo: se reusa `upsertOpcion`,
el slugify, el `fijo: true` de las opciones base, la pantalla de taxonomías y el
viaje al JSON del §4.4.

Y trae la trampa 6 gratis: sin slugify, en tres meses hay «Merienda», «merienda » y
«Con merienda».

---

## 4 · Privacidad: los cuatro guardan datos de terceros, y eso hoy no pasa

**`B-102` está decidido y dice que no.** Textual: «Hoy el sistema no guarda ni un
dato personal de un tercero, y por eso el §5 cabe en una tabla».

Los cuatro formularios rompen eso, y de dos maneras distintas que hay que separar
porque no tienen el mismo riesgo:

| Clase | Qué es | Es público? |
|---|---|---|
| **Contacto comercial** | el WhatsApp de una librería, el Instagram de una suscripción, el mail de un espacio | **Sí, y es el punto**: existe para que la gente escriba. Pero el formulario **tiene que decirlo con esas palabras** antes de que alguien lo tipee |
| **Contacto de quien propone** | el mail de quien cargó la propuesta, para poder repreguntarle | **No, nunca.** Es interno, como `difusion` (§5.1) |

Lo que esto obliga, y va en cada PRD:

1. **La proyección sigue siendo whitelist** (`toPublic.ts`, §5.2). Un campo nuevo
   que no se agregue a mano **no sale**, y esa es la propiedad que no se toca.
2. **El campo de contacto de quien propone tiene que estar en la lista de lo que
   nunca sale**, con su fila en `07-seguridad.md` y su chequeo — el barrido de
   `tests/sin-datos-personales.test.ts` ya existe y hay que hacerlo crecer.
3. **Retención** (**B-838**): una propuesta rechazada no puede quedar para
   siempre con el mail de alguien adentro. Hay que decidir el plazo y quién lo
   borra (una Function `onSchedule`, que es lo que ya se usa).
4. **El `auditor-privacidad` tiene que despertarse** con los archivos nuevos: su
   ficha lista los paths que lo disparan, y cuatro entidades nuevas son ocho o
   diez archivos que hoy no están en esa lista.

---

## 5 · Lo que los cuatro le suman al sitio, y no es gratis

Cada directorio agrega **páginas indexables**, y este repo ya tiene medido lo que
eso arrastra:

- **Salidas públicas numeradas.** Hoy son 18 (B-772/B-654) en **tres tablas
  atadas** más el `PALABRAS` de un test y la prosa de tres documentos. Cuatro
  secciones con listado + detalle es una tanda grande de filas nuevas, y la
  numeración es a mano.
- **`sitemap.xml`, `canonical` y Open Graph** para cada página nueva
  (`rutasPublicas.ts` es el dueño del origen — B-109/B-330).
- **JSON-LD propio por entidad**, que es donde está el SEO de verdad de un
  directorio: `BookStore` para una librería, `Place` para un lugar,
  `Product`/`Offer` para una suscripción. No es lo mismo que el `Event` que ya
  existe.
- **El rebuild.** El §8 dispara el build cuando cambia una actividad o una opción.
  **Cuatro colecciones nuevas son cuatro disparadores nuevos**, y olvidarse de uno
  es la trampa 8 con otra cara: se publica una librería y el sitio sigue sin
  mostrarla hasta que alguien edite otra cosa.
- **La barra de navegación pasa de 7 a 10 pestañas** (**B-835**). Eso ya no entra
  en un teléfono, y es una decisión de producto, no un detalle de CSS: lo más
  probable es que las tres guías vivan bajo **una** pestaña («Guía», «Circuito»,
  «Directorio») con su propio índice.

---

## 6 · Orden recomendado

1. **B-836 — la defensa de la escritura anónima.** Bloquea los cuatro. Sin esto,
   el primer formulario público es un endpoint de escritura sin puerta.
2. **B-834 — el motor compartido**, decidido y construido con el primero.
3. **B-830 — las propuestas de organizadores.** Es el de más valor: le saca de
   encima al dueño la carga manual, que es el trabajo que hoy se hace todos los
   meses. Y es el único de los cuatro que **reusa el modelo que ya existe**.
4. **B-831 / B-832 / B-833 — los tres directorios**, en ese orden: librerías es el
   más chico y el que valida el motor; suscripciones el que tiene el modelo más
   raro; lugares el que más taxonomía nueva pide.
5. **B-835 — la navegación**, antes de publicar la tercera sección.

---

## 7 · Lo que estos cuatro PRDs *no* deciden

- **Quién carga qué.** No hay cuentas de organizador, ni claim nuevo, ni panel
  para terceros. B-28 ya decidió que no se agrega maquinaria de permisos hasta que
  entre una tercera cuenta que no sea de confianza, y estos PRDs no la traen: quien
  propone **no vuelve a entrar**, manda y listo.
- **Precio como dato vivo.** Ni las promos bancarias de una librería ni el precio
  de una suscripción se van a mantener al día. Cómo se publica un dato que
  envejece es **DEC-12**, y la propuesta de los PRDs es la misma para los tres:
  el dato lleva **la fecha en que se cargó, visible**, y no entra a ningún filtro.
