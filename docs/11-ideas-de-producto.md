# Ideas de producto

Propuestas de funcionalidad, con su argumento en contra. No es un backlog: lo
que valga la pena anotar formalmente está en [`BACKLOG.md`](BACKLOG.md) (B-95 a
B-102). Esto es la conversación previa.

**Desde dónde están pensadas.** No desde "qué le falta a un CRUD" sino desde el
trabajo real de las dos personas que cargan, y desde lo que le pasa a alguien
que busca un taller. El sistema hoy resuelve muy bien **cargar** una actividad y
**espejarla** al calendario. Casi todo lo que sigue está en los dos bordes que
quedaron sin atender: lo que pasa **antes** de cargar (la difusión, el trabajo
repetido) y lo que pasa **después** de publicar (el cupo, la cancelación, el
encuentro que es mañana).

Una regla que apliqué a todo: **nada que obligue a guardar datos de terceros.**
Hoy el sistema no guarda ni un nombre ni un teléfono de nadie que se inscriba, y
eso hace que los §5 y §7 sean cortos y verificables. Varias ideas que parecían
obvias mueren ahí, y están al final con el motivo.

---

## 1 · El texto para publicar en redes

**El problema, como pasa.** Cargás el taller: título, fecha, sede, arancel, que
la inscripción es por DM. Guardás. Y después abrís Instagram y escribís todo eso
otra vez, a mano, en el teléfono, mirando el panel en otra pestaña para no
equivocarte con la hora. Y te acordás de arrobar a la casa pero te olvidás de la
talleristas. O ponés "a la gorra" en un taller que era arancelado con beca,
porque el arancel lo cargaste hace tres días.

El dato ya está todo cargado y **encima ya cargaste a quién arrobar**: el §3.1
tiene `difusion.arrobar` y el formulario tiene su campo. Hoy ese campo no hace
absolutamente nada más que guardarse. Es la única parte del modelo que se llena
y no se usa para nada.

**La propuesta.** Una sección del formulario —del mismo tipo que la vista previa
del evento— que muestre **el texto listo para pegar en redes**, con un botón de
copiar. Armado con lo que ya está cargado: título, fechas (todas las del ciclo,
o la del próximo encuentro), modalidad y barrio, arancel con sus notas, cómo se
inscribe, y al final los handles: los de `difusion.arrobar` más el de
`organizador.instagram` y el de `tallerista.instagram`, deduplicados y con `@`.

Dos variantes bastan: **"anuncio"** (sale el ciclo entero, para cuando abre la
inscripción) y **"recordatorio"** (el próximo encuentro, con su tema y su
lectura, para el día antes).

**Qué reusa.** Casi todo. `ActividadForm` tal cual, la resolución de slugs a
etiquetas que ya hace `vistaPreviaEvento.ts`, y el criterio de privacidad del
§5.1 —el link de la reunión no va nunca en un posteo público, `arrobar` sí
porque acá justamente es su lugar—. Una función pura nueva
(`src/lib/textoRedes.ts`) y un componente colapsado.

**Qué cuesta.** Un componente y una función pura. **No toca el modelo, ni las
reglas, ni las Functions, ni el sitio.** Es la propuesta más barata de todas y
la única que aprovecha un campo que hoy está muerto.

**Por qué ahora.** Porque el trabajo que ahorra se hace hoy, todos los meses, a
mano. No depende del sitio público (B-01): funciona igual de bien con el sitio
sin existir, porque el canal de difusión real de este circuito es Instagram, no
Google.

**Decisión del dueño.** Una sola: **si el texto lleva el link a la página de la
actividad.** Hoy ese link no existe (el sitio es un placeholder), así que la
primera versión no lo lleva, y cuando exista el sitio se agrega en una línea.
Vale la pena decidirlo ahora para que el formato del texto no cambie después.

> **El contra.** En este circuito la voz importa: un texto generado suena a bot,
> y quien publica lo va a reescribir igual. Si lo reescribe siempre y de cero, la
> función no ahorró nada y encima ocupa lugar en un formulario que ya tiene 30+
> campos.
>
> Lo que me deja tranquilo es que **la parte que se reescribe no es la que
> cuesta**. Lo aburrido y lo que se equivoca es el bloque de datos: la hora, la
> sede, el arancel, la lista de handles. La prosa es de ellos y va a seguir
> siendo de ellos. Si igual resulta que reescriben todo, el remate honesto es
> recortar el texto a solo ese bloque de datos y los handles, y dejar de
> pretender redactar.

---

## 2 · "Esta semana" arriba del listado

**El problema, como pasa.** El club de lectura es mañana y la lectura del
encuentro nunca se cargó. La inscripción del taller cierra hoy y la actividad
sigue en borrador. Son dos personas cargando: nadie tiene el panorama, y el
panel no ayuda a tenerlo porque **el listado está ordenado por última
modificación**. Lo que ves arriba es lo que tocaste, no lo que se viene.

**La propuesta.** Un bloque chico arriba del listado, con tres cosas y nada más:

- los encuentros de los próximos 7 días,
- las actividades cuya inscripción cierra en los próximos 3 días,
- los **borradores** cuyo primer encuentro es en menos de una semana — que es el
  olvido caro: la actividad existe, está cargada, y no está en ninguna parte.

**Qué reusa.** El listado ya trae todas las actividades a memoria
(`listarActividades`) y ya tiene las fechas parseadas. Es una función pura sobre
lo que ya está cargado, más un bloque en `ListaActividades.tsx`. Cero lecturas
nuevas de Firestore.

**Qué cuesta.** Un componente y una función pura. No toca el modelo, ni las
reglas, ni las Functions, ni el sitio. Es la más barata en trabajo real de las
cuatro.

**Por qué ahora.** Porque el costo es casi nulo y porque el dato ya está ahí; y
porque el olvido que evita (un borrador que no se publicó) es justo el que no
tiene arreglo después de la fecha.

**Decisión del dueño.** Ninguna, salvo los umbrales (7 y 3 días), que son un
parámetro.

> **El contra.** Con diez actividades ya sabés lo que se viene: el panel te va a
> contar algo que tenés en la cabeza. Y un tablero que no dice nada nuevo se
> vuelve decorado que uno saltea con la vista, y entonces el día que sí tiene un
> aviso importante tampoco lo ves.
>
> La mitigación es la única que funciona con estas cosas: **que no aparezca
> cuando no tiene nada que decir.** Si no hay encuentros cerca ni cierres ni
> borradores urgentes, el bloque no se dibuja. Así, que esté visible ya es
> información.

---

## 3 · "Completo": lo único que hay que poder decir después de publicar

**El problema, como pasa.** El taller se llenó. La gente sigue mandando DM y hay
que contestarle una por una que ya no hay lugar. Y el sitio y el calendario
siguen diciendo "cupo: 12" como si nada, porque `inscripcion.cupo` es un número
que se carga una vez y no se vuelve a mirar nunca. Del otro lado: alguien ve el
taller, no se anima a escribir, y no sabe si está a tiempo o llegó tarde.

Hoy, después de publicar, **no hay ninguna forma de decir nada**. Editar la
actividad es abrir un formulario de 30+ campos para cambiar un estado que es
binario.

**La propuesta.** Un solo campo booleano: `inscripcion.completo`. Y —esto es la
mitad de la propuesta— **se prende desde el listado, no desde el formulario**:
una entrada más en el menú "⋯" de la fila, "Marcar completo" / "Reabrir". Un
toque desde el teléfono, sin abrir nada.

De ahí sale, gratis:

- el sitio público (B-01) muestra "cupo completo" en la tarjeta y en el detalle,
- la descripción del evento de Calendar lo dice, así que **quien ya estaba
  suscripto se entera sin que nadie le avise**,
- se deja de contestar DMs para decir que no.

**Qué reusa.** El menú de acciones del listado (`MenuAcciones`, D-19) y la
proyección pública. La descripción del evento ya lista la inscripción con su
cupo y su cierre, así que es una línea más ahí.

**Qué cuesta.** Toca el modelo (**un campo nuevo en `inscripcion` del §3.1**), su
traducción en `types/actividad.ts`, `schema.ts` y `actividades.ts`, la proyección
de `toPublic.ts`, `construirDescripcion` en `functions/calendario.js`, el menú
del listado, y el sitio cuando exista. Es media docena de archivos, todos con una
línea o dos: mediano en superficie, chico en profundidad.

Un detalle que no hay que pasar por alto: cambiar la descripción del evento
**actualiza los N eventos del ciclo** en el calendario. Es lo correcto y la
guarda anti-loop del §7.1 lo maneja sola (compara payloads, D-07), pero conviene
verlo pasar en emuladores antes de creerlo.

**Por qué ahora, con una salvedad.** El campo y el toggle del panel se pueden
hacer ya, y el calendario —que sí existe— ya se beneficia. La parte del sitio
tiene que ir con B-01. Hacerlo antes de B-01 tiene una ventaja concreta: el
`events.json` nace con el campo y no hay que rehacer la proyección después.

**Decisión del dueño.** Dos:

1. **¿Un booleano o un contador?** Yo propongo el booleano. Ver el contra.
2. **¿"Completo" cierra o solo avisa?** Es decir, si además de mostrar el cartel
   el sitio esconde el botón de inscripción. Yo diría que no lo esconda: en este
   circuito siempre hay lista de espera y alguien que se baja.

> **El contra.** Un estado manual que nadie actualiza es peor que no tener nada:
> un "completo" viejo espanta gente de un taller que tiene lugar, y eso es
> exactamente el daño que la funcionalidad quería evitar, con el signo dado
> vuelta. Y a diferencia de un dato objetivo (la fecha, la sede), este depende de
> que alguien se acuerde de apagarlo.
>
> Tengo dos respuestas y ninguna es del todo tranquilizadora. Una: **el default
> es no decir nada**, y no decir nada es el comportamiento de hoy, así que el
> piso no baja. Dos: el toggle vive donde uno ya está mirando (el listado), y no
> a doce campos de profundidad, que es la diferencia entre algo que se mantiene y
> algo que no.
>
> Sobre booleano contra contador: un contador ("quedan 3") es más útil y **mucho
> más fácil de que quede mintiendo**, porque cada inscripción lo desactualiza, no
> solo la última. El booleano se desactualiza una sola vez por actividad y el
> único momento en que hay que acordarse es el que uno recuerda igual, porque es
> el día en que dejás de tener lugar.

---

## 4 · Cancelar un encuentro sin que desaparezca en silencio

**Esto contradice una decisión cerrada.** El §7.3 del `CLAUDE.md` dice que
`sesion.cancelada === true` **borra** el evento del calendario, y la guía del
panel lo promete con esas palabras ("Cancelar un encuentro lo saca del
calendario"). Lo que sigue propone cambiar ese comportamiento, y por eso viene
último aunque el problema que resuelve me parece el más grave de los cuatro.

**El problema, como pasa.** Se cancela el encuentro del jueves. Quien está
suscripto al calendario tenía ese evento agendado, con su recordatorio, y **el
evento simplemente deja de existir**. No hay aviso, no hay tachado, no hay nada:
el jueves a las 19 no le suena nada y en el mejor de los casos se acuerda sola de
mirar. En el peor, va.

El sistema tiene toda la información y elige no decirla. La cancelación es
justamente el momento en que un calendario público tiene más valor, porque es la
única vez que el dato cambió **después** de que la gente lo guardó.

Y hay una segunda mitad: hoy no hay dónde escribir **por qué**. "Se pasa al
jueves siguiente" y "se cancela por falta de inscriptos" son dos cosas
completamente distintas para quien iba a ir, y las dos se ven igual: como un
hueco.

**La propuesta.**

1. Un campo: `sesion.motivoCancelacion: string | null`, al lado de la casilla de
   cancelar en el editor de sesiones.
2. Un encuentro cancelado **no borra su evento: lo actualiza.** Título con
   `CANCELADO — ` adelante, y el motivo arriba de la descripción.
3. Lo que **no** cambia: pasar la actividad a borrador, pendiente o cancelada
   sigue borrando todos los eventos, y borrar el encuentro (no cancelarlo) sigue
   borrando el suyo. La distinción es exactamente esa: **cancelar es un anuncio,
   borrar es una corrección.**

**Qué reusa, y por qué es más barato de lo que parece.** El diff por id del §7.2
no se toca. Todo el comportamiento vive en `debeExistir(actividad, sesion)`, que
ya está exportada y es el único lugar donde se decide si un evento existe, y en
`construirEvento`. Son dos funciones puras, con tests, y la vista previa del panel
las importa (D-20), así que **el panel muestra el evento cancelado sin escribir
una línea de UI**.

**Qué cuesta.** El modelo (un campo en la sesión), el editor de sesiones, las dos
funciones de `functions/calendario.js`, y sus tests. Más una cosa que no es
código y es la que más cuidado pide: **la guía del panel pasa a mentir.** El
aviso `cancelar-encuentro` de `src/lib/ayuda.ts` dice lo contrario de lo que
haría el sistema, y es uno de los seis avisos de lo que no se puede deshacer.
Esto es literalmente el escenario que B-63 anticipa, y hay que actualizarlo en el
mismo commit.

**Por qué después y no ahora.** Porque toca la parte más frágil del sistema (§7 y
§10 avisan) y porque el sitio público —que es P1— vale más. Pero conviene
decidirlo antes de B-01: si el sitio se construye sabiendo que una sesión
cancelada tiene motivo y se muestra, la página de detalle nace con eso en vez de
agregarlo después.

**Decisión del dueño.** La de fondo: **¿cancelar avisa o borra?** Y una segunda,
menor: si un evento cancelado se borra del calendario cuando su fecha ya pasó, o
queda para siempre como registro. Yo lo dejaría, porque un evento pasado no
molesta a nadie y es la prueba de que ese día estaba previsto.

> **El contra.** Dos, y el primero es serio.
>
> **Uno: reabre el §7.** El sync es lo más delicado que tiene el proyecto y el
> `CLAUDE.md` pide tocarlo lo menos posible. Que el cambio esté contenido en dos
> funciones puras no significa que sea gratis: significa que es revisable. Y hay
> un caso nuevo que hoy no existe —un evento que se actualiza para decir que no
> va a pasar— que hay que probar en emuladores, nunca contra el calendario real.
>
> **Dos: le ensucia el calendario a la gente.** Quien se suscribe ve eventos
> "CANCELADO" en su agenda futura, y el que se suscribió a la agenda entera
> podría ver varios. Contra-argumento: eso no es ruido, es la noticia. El ruido
> sería que aparezcan para siempre, y para eso está la segunda decisión.
>
> Y un tercero más chico, honesto: **el motivo se va a dejar vacío la mitad de las
> veces.** Con el campo vacío el título ya dice CANCELADO, que es el 80% del
> valor, así que no es bloqueante — pero no hay que fingir que el campo se va a
> llenar siempre.

---

## Una nota para cuando se haga el sitio (B-01)

No es una propuesta, es algo que conviene decidir antes de escribir el listado
público, porque después es más caro.

El modelo es **centrado en la actividad** y eso está bien decidido (§2.2): un
club de lectura de 8 encuentros es una tarjeta, no ocho. Pero la pregunta que
alguien le hace a una agenda no es "¿qué talleres hay?", es **"¿qué hay el
sábado?"**. Y esa pregunta es centrada en el encuentro. Con tarjetas por
actividad, para saber si hay algo el sábado hay que abrir todas.

Lo que hace falta no es cambiar el modelo: es que el `events.json` lleve
**también** un índice plano de encuentros próximos (fecha, id de sesión, slug de
la actividad), derivado en build time, para que la island pueda ofrecer "este fin
de semana" o "esta semana" sin aplanar los ciclos en el navegador en cada
filtrado. Es más barato hacerlo cuando se escribe el generador que agregarlo
después, y no cuesta nada en el modelo.

---

## Dos cosas que pensé y descarté

Las dejo escritas porque el motivo del descarte vale más que la idea.

### Guardar quién se inscribió

Era la idea grande y obvia: si el problema es "¿cuánta gente se anotó?" y
"¿cómo le aviso a los inscriptos que se canceló?", la respuesta directa es una
lista de inscriptos. Un `/actividades/{id}/inscriptos/{id}` con nombre y
contacto, un contador real y —el premio— poder avisar de una cancelación.

**No la propongo, y no es por el trabajo.** Es por lo que cambia de naturaleza:

- Hoy el sistema **no guarda ni un dato personal de un tercero**. Por eso el §5
  cabe en una tabla y el §7 se puede verificar de un pantallazo. La lista de
  inscriptos mete nombres y teléfonos de gente que no es usuaria del sistema, y
  a partir de ahí toda pregunta de privacidad, retención y borrado se vuelve
  responsabilidad del proyecto.
- **La inscripción es por DM.** El nombre, el teléfono y la conversación ya
  viven en Instagram o WhatsApp, que es donde además se responde. Copiar eso a
  mano a un formulario del panel es trabajo nuevo, no trabajo ahorrado. Y una
  lista copiada a mano queda incompleta el primer día ocupado.
- **Avisar de una cancelación es el caso más fuerte y sigue perdiendo.** Si el
  sistema tuviera la lista, avisar por mail requiere mails (que no siempre hay,
  porque el canal fue un DM) y un proveedor de envío. Avisar por el canal por el
  que la persona escribió es lo que efectivamente funciona, y eso es un DM
  masivo que hace una persona. Lo que el sistema **sí** puede hacer es que el
  aviso llegue solo a quien se suscribió al calendario, sin guardar nada de
  nadie: eso es la propuesta 4.

Si algún día hace falta de verdad, el orden correcto es al revés del intuitivo:
primero el aviso público (propuesta 4), después el estado agregado (propuesta 3),
y la lista de personas solo si eso no alcanzó.

### Sedes y organizadores reusables

El §4 tiene un patrón lindísimo de taxonomía autogestionada, y da mucha
tentación extenderlo: elegís "Casa Brandon" de un desplegable y se completan
nombre, dirección, barrio, ciudad, cómo llegar y coordenadas. Lo mismo con el
organizador y su Instagram, y con el canal de inscripción.

**La descarté porque compite con algo que ya existe y gana.** "Duplicar"
(B-11) ya resuelve el caso repetitivo real de este circuito —el ciclo del año
pasado con otras fechas— y lo resuelve para los 30 campos, no para tres. El
caso que quedaría es "tres talleres distintos en la misma sede", que existe pero
es mucho menos frecuente.

Y tiene un costo escondido: el §4.1 guarda **solo el slug** para que renombrar
una etiqueta no toque ningún documento. Con una sede eso no sirve —si la sede se
mudó, la actividad del año pasado no debe cambiar de dirección—, así que la
actividad tendría que guardar una **copia** del objeto. Eso es una segunda fuente
de verdad que se desincroniza, más el problema que B-04 ya tiene con las
etiquetas renombradas, multiplicado.

Queda anotada como P3 (B-100) con una condición: vale la pena **si los datos
dicen que las sedes se repiten**, y hoy nadie lo está midiendo. El vocabulario de
analítica del §9 podría contestarlo antes de escribir una línea.
