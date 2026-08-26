/**
 * Contenido de la ayuda del panel (B-60, D-61, D-62).
 *
 * Hay dos personas cargando actividades: quien pidió el panel, que sabe por qué
 * cada cosa es como es, y quien no participó de ninguna de esas decisiones. Esto
 * es para la segunda.
 *
 * **Es data, no componentes.** El texto vive acá y no repartido en JSX por tres
 * archivos, por dos razones:
 *
 * 1. Se puede testear. `tests/ayuda.test.ts` exige que estén cubiertos los seis
 *    comportamientos que no se pueden deshacer, que cada sección del formulario
 *    tenga su capítulo, y que el texto no tenga jerga de programación.
 * 2. Se puede actualizar sin leer código de UI: quien agrega una funcionalidad
 *    edita un array de textos.
 *
 * **Qué NO va acá:** la ayuda corta de un campo puntual. Eso ya vive en la prop
 * `ayuda` de `Campo` ("Es público. Usá un contacto de trabajo…"), al lado del
 * campo, que es donde sirve. Acá va el *para qué* de cada sección y lo que pasa
 * sin que se vea.
 *
 * Tono: le habla a alguien que organiza actividades literarias. Sin referencias
 * a secciones de documentos, sin nombres de archivos, sin jerga.
 */

/** Un comportamiento que no se ve, dentro de un capítulo. */
export interface PuntoAyuda {
  texto: string;
  /** Se destaca: equivocarse acá cuesta caro o no se deshace. */
  cuidado?: boolean;
}

export interface CapituloAyuda {
  id: string;
  titulo: string;
  /** Una frase: para qué sirve esta parte del panel. */
  paraQue: string;
  puntos: PuntoAyuda[];
  /**
   * Título exacto de la sección del formulario que explica este capítulo, si
   * explica una. `tests/ayuda.test.ts` lee el formulario y falla si aparece una
   * sección sin capítulo: así una funcionalidad nueva no puede quedar sin ayuda.
   */
  seccionFormulario?: string;
}

/** Lo que se hace mal una vez y no se puede deshacer. */
export interface AvisoAyuda {
  id: string;
  titulo: string;
  texto: string;
}

/**
 * Los seis avisos que abren la guía. Están arriba de todo y no colapsados a
 * propósito: son los que, si nadie los cuenta, se descubren rompiendo algo.
 */
export const AVISOS: AvisoAyuda[] = [
  {
    id: 'slug-bloqueado',
    titulo: 'La dirección web queda fija cuando publicás',
    texto:
      'Cada actividad tiene su propia dirección en el sitio, que se arma sola con el título. ' +
      'Mientras la actividad esté en borrador la podés cambiar; en el momento en que la publicás ' +
      'queda fija para siempre. Cambiarla después rompe los links que ya circularon y hace que la ' +
      'actividad desaparezca de las búsquedas de Google. Revisá el título antes de publicar, porque ' +
      'de ahí sale la dirección. Por lo mismo, una copia no se deja publicar mientras conserve la ' +
      'dirección que termina en «-copia»: el panel te lo pide antes de dejarte seguir.',
  },
  {
    id: 'link-reunion',
    titulo: 'El link de la reunión se publica solo si tildás la casilla',
    texto:
      'En una actividad virtual el link se guarda siempre, pero no se publica: se lo mandás a cada ' +
      'persona cuando se inscribe. Solo sale al sitio y al evento del calendario si tildás «Publicar ' +
      'el link en el sitio». Si la actividad tiene cupo, publicarlo es dejar la puerta abierta: entra ' +
      'cualquiera, el cupo deja de significar algo y alguien puede arruinar el encuentro. Tildalo ' +
      'solo en encuentros abiertos, sin inscripción ni cupo.',
  },
  {
    id: 'interno',
    titulo: 'Lo que escribís en «Difusión» no sale nunca',
    texto:
      'La sección «Difusión» —a quién arrobar, notas internas— es tu cuaderno de trabajo: no aparece ' +
      'en el sitio, ni en el calendario, ni en el evento. Lo mismo vale para el material que dejás ' +
      'sin marcar como público: de ese se ve el título y el tipo, nunca el link. Si algo no tiene ' +
      'que verlo nadie de afuera, va en uno de esos dos lugares y en ningún otro.',
  },
  {
    id: 'cancelar-encuentro',
    titulo: 'Cancelar un encuentro lo saca del calendario, pero no lo borra',
    texto:
      'Al marcar un encuentro como cancelado, su evento desaparece del calendario público. El ' +
      'encuentro sigue acá, con su fecha y su tema, así que queda el registro de que ese día estaba ' +
      'previsto y no se hizo. Si destildás la cancelación, el evento vuelve. Borrar el encuentro, en ' +
      'cambio, lo saca del calendario y también del registro. ' +
      'Los demás encuentros no se tocan: el que era «Encuentro 6 de 8» sigue diciendo eso en el ' +
      'calendario de quien lo tenga agendado. En la serie queda un hueco, que es justamente la ' +
      'forma de ver que ese día se canceló.',
  },
  {
    id: 'borrador-borra-eventos',
    titulo: 'Pasar a borrador borra todos los eventos del calendario',
    texto:
      'Una actividad publicada tiene un evento por encuentro en el calendario. Si la pasás a ' +
      'borrador, a pendiente o a cancelada, todos esos eventos se borran. Si después la volvés a ' +
      'publicar se crean de nuevo, pero son eventos nuevos: quien se los había guardado o tenía un ' +
      'recordatorio, lo pierde. Para corregir un dato no hace falta despublicar: editás, guardás, y ' +
      'el calendario se actualiza solo.',
  },
  {
    id: 'calendario-espejo',
    titulo: 'El calendario es un espejo: no se edita ahí',
    texto:
      'Todo lo que se ve en el calendario público sale de este panel. Si entrás a Google Calendar y ' +
      'cambiás a mano una hora, un título o una dirección, ese cambio se pierde la próxima vez que ' +
      'se toque la actividad acá, sin avisar. Lo que haya que cambiar, se cambia en el panel.',
  },
];

/**
 * Capítulos de la guía. El orden es el del recorrido real: primero cómo llega
 * una actividad a la gente, después el listado, después el formulario en el
 * mismo orden en que aparecen sus secciones.
 */
export const CAPITULOS: CapituloAyuda[] = [
  {
    id: 'flujo',
    titulo: 'Cómo llega una actividad a la gente',
    paraQue: 'El recorrido completo, desde que la cargás hasta que alguien se anota.',
    puntos: [
      {
        texto:
          'Todo se carga una sola vez y en un solo lugar: acá. De este panel salen el calendario ' +
          'público, al que la gente se suscribe, y el sitio donde la gente busca actividades.',
      },
      {
        texto:
          'Mientras el estado sea «borrador» o «pendiente» no la ve nadie. Podés dejarla a medio ' +
          'cargar y volver mañana.',
      },
      {
        texto:
          'Cuando la publicás, en el calendario aparece un evento por encuentro, casi en el momento.',
      },
      {
        texto:
          'En el sitio tarda unos minutos: la página se rehace sola cada tanto. Si no la ves ' +
          'aparecer al instante no está mal cargada, hay que esperar un rato.',
      },
      {
        texto:
          'Hoy el sitio todavía no está publicado: se está construyendo. Por ahora lo que la gente ' +
          've de afuera es el calendario, así que lo que cargues acá igual sale al mundo.',
      },
      {
        texto:
          '«Guardar borrador» te pide solo el título: podés guardar una actividad a medias y ' +
          'seguirla otro día. El tipo, la descripción, quién organiza, el arancel, la sede y los ' +
          'encuentros se piden recién al publicar, porque son los datos que salen al calendario.',
      },
      {
        texto:
          'Con «Generar N encuentros» cargás las fechas de una vez: le decís cuántos ' +
          'encuentros y cada cuántos días. Siete es una vez por semana; para días seguidos, ' +
          'como una feria de tres jornadas, va uno. Recalcula solo las fechas: los temas, las ' +
          'lecturas y las cancelaciones que ya cargaste se conservan, y los encuentros que ya ' +
          'están en el calendario se mueven de fecha en lugar de borrarse y volver a crearse.',
      },
      {
        texto:
          'Lo único que se pide siempre, también en un borrador, es la fecha y la hora de cada ' +
          'encuentro que hayas agregado. Si no querés poner fechas todavía, borrá la fila del ' +
          'encuentro y agregala cuando las sepas.',
      },
      {
        texto:
          'Mientras completás, el formulario se va guardando solo en el dispositivo que estés ' +
          'usando. Si se cierra la pantalla o te vas sin guardar, al volver a abrir la actividad ' +
          'te ofrece seguir desde ahí, y podés descartarlo. Eso queda en ese dispositivo: si ' +
          'cargabas desde el teléfono, no lo vas a encontrar en la computadora.',
      },
      {
        texto:
          'En «Opcional» podés cargar hasta cuatro imágenes, cada una con un epígrafe si querés. ' +
          'Una queda marcada como portada: esa es la que se ve al compartir el link de la ' +
          'actividad. Por ahora se pegan direcciones de imágenes que ya estén publicadas en otro ' +
          'lado; subir fotos desde el teléfono todavía no está.',
      },
      {
        texto:
          'El epígrafe es lo que se muestra debajo de la foto, y es opcional. Lo que leen quienes ' +
          'usan un lector de pantalla, y lo que lee Google, es el título de la actividad — así que ' +
          'un título que describa bien lo que es sirve para las dos cosas.',
      },
      {
        texto:
          'Ese guardado automático es de tu cuenta: si otra persona entra con la suya en la misma ' +
          'computadora, no ve lo que dejaste a medias. Y al salir de la agenda se borra, así que ' +
          'en una computadora prestada conviene salir.',
      },
      {
        texto:
          'Cuando recuperás una carga sin terminar, las casillas de «mostrar el link sin ' +
          'inscribirse» —la de la reunión y las del material— quedan destildadas, y el aviso te lo ' +
          'dice. Es a propósito: lo que quedó guardado hace tres semanas no puede publicar un link ' +
          'por su cuenta. Si querías mostrarlo, volvé a tildarlo antes de publicar.',
        cuidado: true,
      },
      {
        texto:
          'Publicar y despublicar no es gratis para la gente: cada vez que despublicás, los eventos ' +
          'se borran del calendario de quien los tenía guardados.',
        cuidado: true,
      },
    ],
  },
  {
    id: 'listado',
    titulo: 'El listado de actividades',
    paraQue: 'La pantalla de entrada: están todas, las publicadas y las que son borrador.',
    puntos: [
      {
        texto:
          'El buscador ignora acentos y mayúsculas: escribiendo «cronica» encuentra «Crónica». Busca ' +
          'en el título, la descripción, la sede, el barrio y los nombres; no en las fechas.',
      },
      {
        texto:
          'Cada fila tiene «Editar» y un menú «⋯» con «Duplicar» y «Borrar». Están en el menú, y no ' +
          'como botones sueltos, para que «Borrar» no quede pegado a «Editar» en el teléfono.',
      },
      {
        texto:
          'Duplicar sirve para el ciclo que se repite: abre una copia con todo cargado, con las ' +
          'fechas corridas hacia adelante en semanas enteras, así se conservan el día de la semana y ' +
          'la hora. Arranca en borrador y no manda nada al calendario hasta que la publiques.',
      },
      {
        texto:
          'La copia no toca en nada al original ni a sus eventos del calendario, ni antes ni después ' +
          'de guardarla. Lo que sí hay que revisar en la copia es el título, la dirección web y las ' +
          'fechas: el aviso de arriba del formulario los nombra.',
      },
      {
        texto:
          'La copia se puede guardar como borrador tal como viene, pero no se deja publicar hasta ' +
          'que le cambies la dirección web: si se publicara con la que termina en «-copia», esa ' +
          'dirección quedaría fija para siempre.',
        cuidado: true,
      },
      {
        texto:
          'Borrar una actividad publicada borra también sus eventos del calendario, y no se puede ' +
          'deshacer desde el panel. Si la idea es sacarla de circulación pero conservarla, pasala a ' +
          'borrador. Por si acaso, al borrar queda guardada una copia de todo lo que tenía cargado: ' +
          'no la vas a ver en el panel, pero se puede recuperar pidiéndosela a quien administra el ' +
          'sistema.',
        cuidado: true,
      },
    ],
  },
  {
    id: 'calendario',
    titulo: 'La vista calendario',
    paraQue:
      'Ver los encuentros día por día y, sobre todo, saber de un pantallazo qué está viéndose ya en el calendario público y qué no.',
    puntos: [
      {
        texto:
          'Se entra con el botón «Calendario» del listado. El listado muestra una tarjeta por ' +
          'actividad; el calendario muestra un renglón por encuentro, así que un ciclo de ocho ' +
          'aparece ocho veces. Cada renglón dice qué encuentro es («Encuentro 3 de 8») y al ' +
          'tocarlo se abre la actividad completa, que sigue siendo la única cosa que se edita.',
      },
      {
        texto:
          'El color de cada encuentro no es el estado de la actividad: es la respuesta a «¿esto ' +
          'ya lo ve la gente?». Sale de tres cosas juntas: el estado de la actividad, si el ' +
          'encuentro está cancelado, y si su evento existe de verdad en el calendario público. ' +
          'Abajo de todo hay una lista con qué significa cada uno.',
      },
      {
        texto:
          'Si un encuentro debería estar publicado y su evento no existe, aparece un aviso rojo ' +
          'arriba de todo. Quiere decir que la publicación al calendario no llegó a correr o ' +
          'falló, y hasta ahora no había ninguna pantalla donde eso se viera: la actividad decía ' +
          '«publicado» y en el calendario no había nada. Se arregla volviendo a guardar la ' +
          'actividad.',
        cuidado: true,
      },
      {
        texto:
          'El caso opuesto también avisa: un encuentro que ya no debería estar publicado y cuyo ' +
          'evento todavía figura. Ahí la gente puede seguir viendo un encuentro que pasó a ' +
          'borrador o que se canceló. Si acabás de guardar, esperá unos segundos y refrescá: ' +
          'la publicación tarda un momento.',
        cuidado: true,
      },
      {
        texto:
          'El aviso mira todos los meses, no el que estás viendo, y trae un botón para ir al mes ' +
          'donde está el problema. La vista se abre directamente en ese mes cuando hay alguno.',
      },
      {
        texto:
          'Los encuentros cancelados de una actividad publicada se siguen viendo, en gris: el ' +
          'encuentro queda como registro de que ese día estaba previsto, aunque su evento ya no ' +
          'esté en el calendario. Lo mismo con las actividades canceladas cuyos encuentros ya ' +
          'pasaron.',
      },
      {
        texto:
          'En el teléfono no hay grilla de mes: siete columnas en una pantalla angosta no se ' +
          'leen. Se ve la agenda, que son los días con algo uno abajo del otro. En pantalla ' +
          'grande se puede elegir entre «Mes» y «Agenda».',
      },
      {
        texto:
          'Un mes sin nada lo dice, y ofrece ir al mes más cercano que tenga encuentros, así no ' +
          'hay que adivinar para qué lado apretar la flecha.',
      },
    ],
  },
  {
    id: 'orden-y-filtros',
    titulo: 'Ordenar y filtrar el listado',
    paraQue:
      'Encontrar una actividad entre muchas, y tener arriba lo que está por pasar en lugar de lo último que tocaste.',
    puntos: [
      {
        texto:
          'Por defecto el listado ordena por lo que se viene primero: arriba está el encuentro ' +
          'más próximo. Antes ordenaba por lo último modificado, y así un borrador con el primer ' +
          'encuentro en cuatro días quedaba al fondo y no lo veía nadie.',
      },
      {
        texto:
          'Cada fila dice cuándo es su próximo encuentro, o que no le queda ninguno por venir. ' +
          'Los encuentros cancelados no cuentan como próximos.',
      },
      {
        texto:
          'El desplegable «Ordenar por» tiene además última modificación —el orden de antes— y ' +
          'título de A a Z.',
      },
      {
        texto:
          'El botón «Filtros» abre cinco: estado, tipo, modalidad, barrio y fechas. Se cruzan ' +
          'entre sí y se combinan con el buscador. El número al lado del botón dice cuántos hay ' +
          'puestos, para que un filtro olvidado no parezca un listado vacío.',
      },
      {
        texto:
          '«Con algo por venir» deja las actividades que todavía tienen un encuentro por pasar, y ' +
          'su opuesto deja las que ya terminaron o nunca tuvieron fecha. Es la forma de encontrar ' +
          'lo que quedó sin cerrar.',
      },
      {
        texto:
          'Los filtros de tipo y barrio ofrecen solo lo que alguna actividad usa de verdad, así ' +
          'que nunca hay una opción que devuelva cero. Y se muestran con su nombre, no con la ' +
          'forma en que se guardan.',
      },
      {
        texto:
          'Todo esto pasa con lo que el panel ya tiene cargado: filtrar y ordenar es instantáneo ' +
          'y no consulta nada.',
      },
    ],
  },
  {
    id: 'opciones-de-los-desplegables',
    titulo: 'Las opciones de los desplegables',
    paraQue:
      'Arreglar una opción mal escrita, borrar una que sobra, y aprobar las que cargó otro admin — sin tocar ninguna actividad.',
    puntos: [
      {
        texto:
          'El botón «Opciones» del listado abre las cinco listas que se administran solas: ' +
          'arancel, tipo, barrio, plataforma y etiquetas. Al lado de cada valor dice cuántas ' +
          'actividades lo usan.',
      },
      {
        texto:
          'Renombrar cambia solo cómo se lee. La actividad guarda un código interno, no el ' +
          'texto, así que cambiarle el nombre a «A la gorra» no obliga a editar las veinte ' +
          'actividades que la usan: se ven todas con el nombre nuevo en el momento.',
      },
      {
        texto:
          'Por eso mismo, renombrar NO sirve para arreglar una opción cargada por error. Si ' +
          'escribiste «Villa Crepso» y renombrás a «Villa Crespo», las actividades siguen ' +
          'apuntando al código viejo. Para eso hay que borrar la mala y volver a elegir la ' +
          'buena en cada actividad.',
      },
      {
        texto:
          'Borrar una opción no toca las actividades que la usan: quedan apuntando a algo que ya ' +
          'no está en la lista, y se ven con el nombre deducido del código. Si la opción está en ' +
          'uso, el panel avisa cuántas actividades son antes de dejarte borrar.',
      },
      {
        texto:
          'Las opciones base —«Gratis», «A la gorra», «Arancelado» y las demás que vienen de ' +
          'fábrica— no se pueden renombrar ni borrar. Suelen estar cableadas en la lógica del ' +
          'sitio, así que cambiarlas rompería más de lo que arregla.',
      },
      {
        texto:
          'Cuando haya más de un admin cargando, las opciones que cree cada uno van a esperar ' +
          'una aprobación y el botón «Opciones» va a mostrar cuántas hay pendientes. Hoy nacen ' +
          'aprobadas: son todas tuyas.',
      },
    ],
  },
  {
    id: 'que-es',
    titulo: 'Qué es',
    seccionFormulario: 'Qué es',
    paraQue: 'El tipo, el título y la descripción. Va primero porque el resto del formulario se acomoda a lo que elijas acá.',
    puntos: [
      {
        texto:
          'El tipo decide qué campos aparecen más abajo: un taller pide tallerista, una presentación ' +
          'o una charla piden autor invitado, un club de lectura abre la sección de material.',
      },
      {
        texto:
          'Elegir «club de lectura» además marca solo «es un ciclo» y «tiene material», porque casi ' +
          'siempre es así. Si esta vez no lo es, destildalos.',
      },
      {
        texto:
          'Una «feria» también nace marcada como ciclo, porque suele durar varios días: cargá un ' +
          'encuentro por jornada. No pide tallerista ni abre material.',
      },
      {
        texto:
          'La dirección web se va armando sola con el título mientras la actividad no esté ' +
          'publicada, y se puede editar a mano. Al publicar queda fija.',
        cuidado: true,
      },
      {
        texto:
          'La descripción es lo que la gente lee en el sitio y en el evento del calendario. Conviene ' +
          'que diga qué se hace, para quién es y qué se lleva.',
      },
      {
        texto:
          'El estado es el interruptor de todo: «borrador» y «pendiente» no se ven en ningún lado, ' +
          '«publicado» sale al sitio y al calendario, «cancelado» saca los eventos del calendario ' +
          'pero conserva la actividad acá.',
        cuidado: true,
      },
    ],
  },
  {
    id: 'encuentros',
    titulo: 'Encuentros',
    seccionFormulario: 'Encuentros',
    paraQue: 'Las fechas. Un ciclo de ocho encuentros es una sola actividad con ocho encuentros, no ocho actividades.',
    puntos: [
      {
        texto:
          'Cargado así, en el sitio aparece una sola tarjeta y, si cambia la sede, se corrige una ' +
          'vez y se actualizan los ocho eventos del calendario.',
      },
      {
        texto:
          'La duración de cada encuentro sale de su hora de inicio y de fin, y puede ser distinta ' +
          'en cada uno.',
      },
      {
        texto:
          '«Generar encuentros» toma la fecha y la duración del primero y arma la serie cada tantos ' +
          'días. Recalcula las fechas de lo que haya cargado y borra los temas y las lecturas, así ' +
          'que se usa al principio y no después de ajustarlo todo a mano.',
      },
      {
        texto:
          'Si los encuentros ya están en el calendario, generarlos de nuevo los mueve de día en ' +
          'lugar de borrarlos y volver a crearlos: quien se suscribió los conserva, con sus ' +
          'recordatorios. Si pedís menos de los que hay, los últimos sí se borran del calendario.',
      },
      {
        texto:
          'Después de generarlos, cada fecha se edita por separado: los ciclos siempre tienen un ' +
          'feriado en el medio o una semana que se corre.',
      },
      {
        texto:
          'El tema y la lectura de cada encuentro salen en el evento de ese día, junto con la ' +
          'posición en el ciclo («Encuentro 3 de 8»). El número sale del orden de las fechas y ' +
          'cuenta también los cancelados: cancelar uno no renumera a los demás.',
      },
      {
        texto:
          'Marcar un encuentro como cancelado saca ese día del calendario y lo conserva acá. ' +
          'Borrarlo lo saca de los dos lados.',
        cuidado: true,
      },
    ],
  },
  {
    id: 'donde',
    titulo: 'Dónde',
    seccionFormulario: 'Dónde',
    paraQue: 'Presencial, virtual o las dos. Según lo que elijas aparece la dirección, la plataforma, o ambas.',
    puntos: [
      {
        texto:
          'La dirección viaja completa al calendario —sede, calle, barrio, ciudad— para que Google ' +
          'pueda dibujar el mapa. Con la calle sola el mapa puede caer en otra ciudad, así que vale ' +
          'la pena completar el barrio.',
      },
      {
        texto:
          '«Cómo llegar» (timbre, piso, referencias) sí es público: sale en el sitio y en el evento ' +
          'del calendario. No pongas ahí nada que no quieras que se vea.',
      },
      {
        texto:
          'El link de la reunión se guarda pero no se publica, salvo que tildes la casilla que está ' +
          'debajo. Con cupo, publicarlo deja entrar a cualquiera.',
        cuidado: true,
      },
      {
        texto:
          'Si el lugar es difícil de encontrar —una librería sin número claro, un centro cultural ' +
          'dentro de un predio, una casa en un pasaje— podés marcar el punto exacto: buscalo en ' +
          'Google Maps y pegá el link en el campo del punto en el mapa. Con eso el evento abre el ' +
          'mapa en el lugar y no donde Google adivine.',
      },
      {
        texto:
          'Los links cortos de Maps (los que empiezan con «maps.app.goo.gl») no sirven: no traen la ' +
          'ubicación adentro. Abrilo en el navegador y pegá el link largo que queda en la barra de ' +
          'direcciones, o hacé clic derecho sobre el punto en el mapa y pegá los dos números que ' +
          'copia Google.',
      },
      {
        texto:
          'El punto en el mapa es opcional y se puede quitar. Para confirmar que quedó bien, la ' +
          'vista previa del final del formulario muestra la ubicación y el link del mapa tal como ' +
          'van a salir.',
      },
      {
        texto:
          'En «híbrido» se piden las dos cosas: la gente que va y la que se conecta se anotan igual.',
      },
    ],
  },
  {
    id: 'quien',
    titulo: 'Quién',
    seccionFormulario: 'Quién',
    paraQue: 'Quién organiza y quién está adelante. Todo esto es público.',
    puntos: [
      {
        texto:
          'El organizador es la casa, la librería, la editorial o la persona que convoca. El ' +
          'tallerista —o el autor invitado, en una presentación o una charla— es quien da la ' +
          'actividad. Pueden ser la misma persona: entonces va en los dos lados.',
      },
      {
        texto:
          'La bio sale completa en el sitio y en el evento del calendario. Dos o tres líneas ' +
          'alcanzan; es una presentación, no un curriculum.',
      },
      {
        texto: 'Los usuarios de Instagram van con arroba y sin link: «@casabrandon».',
      },
    ],
  },
  {
    id: 'arancel',
    titulo: 'Arancel e inscripción',
    seccionFormulario: 'Arancel e inscripción',
    paraQue: 'Cuánto sale y por dónde se anota la gente.',
    puntos: [
      {
        texto:
          'El arancel no viene elegido a propósito. Si viniera puesto en «Gratis» y alguna vez nadie ' +
          'lo corrigiera, un taller pago se publicaría como gratuito y la gente llegaría esperando ' +
          'no pagar.',
      },
      {
        texto:
          '«A la gorra» es una opción como cualquier otra, no un caso raro: en el circuito literario ' +
          'es la mitad de los casos.',
      },
      {
        texto:
          'Lo que no entra en la lista va en las notas: «dos cuotas», «incluye el material», ' +
          '«descuento para estudiantes». Se publica tal cual.',
      },
      {
        texto:
          'El destino de la inscripción es público, y lo leen también los robots que juntan ' +
          'direcciones y teléfonos. Usá un contacto de trabajo, no el teléfono personal.',
        cuidado: true,
      },
      {
        texto:
          'La fecha de cierre es informativa: pasada esa fecha el sitio muestra la inscripción como ' +
          'cerrada, pero no se apaga nada solo ni se avisa a nadie.',
      },
    ],
  },
  {
    id: 'material',
    titulo: 'Material',
    seccionFormulario: 'Material',
    paraQue: 'Lecturas, guías y contexto. Aparece sobre todo en los clubes de lectura.',
    puntos: [
      {
        texto:
          'Cada ítem dice cuándo se entrega: antes del encuentro, al inscribirse, durante el mes o ' +
          'en el encuentro mismo. Eso también se publica, así que la gente sabe qué esperar. Un ítem ' +
          'cargado como «Otro» sale con el título y el momento, sin la palabra «Otro».',
      },
      {
        texto:
          'La casilla «público» de cada ítem decide si el link se ve sin inscribirse. Destildada, ' +
          'afuera se ve el título y el tipo del material, nunca el link.',
        cuidado: true,
      },
      {
        texto:
          'Por eso es el lugar del archivo de la lectura: dejándolo privado podés anunciar que hay ' +
          'material sin regalarlo.',
      },
    ],
  },
  {
    id: 'opcional',
    titulo: 'Opcional',
    seccionFormulario: 'Opcional',
    paraQue: 'Etiquetas, imagen y destacado. Nada de esto es obligatorio, pero las etiquetas son las que hacen que la gente encuentre la actividad.',
    puntos: [
      {
        texto:
          'Las etiquetas son los filtros del sitio. Pocas y repetidas filtran bien; muchas e ' +
          'inventadas no filtran nada. Tres bien puestas alcanzan.',
      },
      {
        texto:
          'Escribí la etiqueta como querés que se lea, con la mayúscula donde va: se muestra tal ' +
          'cual en el sitio y en el calendario.',
      },
      { texto: '«Destacar» es para que la actividad salga en la portada del sitio.' },
    ],
  },
  {
    id: 'listas',
    titulo: 'Las listas que crecen solas',
    paraQue: 'Cómo funcionan los desplegables de tipo, barrio, arancel, plataforma y etiquetas, que aprenden lo que vas cargando.',
    puntos: [
      {
        texto:
          'Si lo que necesitás no está en la lista, lo escribís y queda agregado para la próxima. No ' +
          'hay que pedirle a nadie que lo agregue.',
      },
      {
        texto:
          'Antes de crear una opción nueva, mirá lo que aparece mientras escribís: si tipeás «gor» y ' +
          'aparece «A la gorra», usá esa. Así no terminan cuatro versiones de lo mismo en los ' +
          'filtros del sitio.',
      },
      {
        texto:
          'Si lo que escribís es una manera distinta de escribir algo que ya existe, el panel avisa ' +
          'que va a usar la opción que ya está en lugar de crear otra.',
      },
      {
        texto:
          'Las opciones nuevas se guardan cuando guardás la actividad, no cuando las escribís: si ' +
          'abandonás el formulario a mitad de camino, no queda nada dando vueltas.',
      },
      {
        texto:
          'Las opciones de fábrica (los tipos de actividad, «Gratis», «A la gorra») no se pueden ' +
          'borrar ni renombrar desde acá.',
      },
    ],
  },
  {
    id: 'difusion',
    titulo: 'Difusión',
    seccionFormulario: 'Difusión',
    paraQue: 'Tu cuaderno de trabajo. Es la única parte del formulario que no sale a ningún lado.',
    puntos: [
      {
        texto:
          '«Arrobar al publicar» es la lista de cuentas para etiquetar cuando subas el posteo a las ' +
          'redes. Queda anotada acá; no se publica sola en ninguna parte.',
      },
      {
        texto:
          'Las notas internas son para vos y para la otra persona que carga: «confirmar con la ' +
          'librería», «pedir fotos», «el año pasado vinieron doce».',
      },
      {
        texto:
          'Si dudás de dónde poner algo que no tiene que verse, la respuesta es acá.',
      },
    ],
  },
  {
    id: 'vista-previa',
    titulo: 'Vista previa del evento',
    seccionFormulario: 'Vista previa del evento',
    paraQue: 'Ver el evento del calendario antes de publicarlo. Es el último paso, y el más barato.',
    puntos: [
      {
        texto:
          'Elegís un encuentro y ves el título, la ubicación y el texto completo del evento, tal ' +
          'como los va a ver cualquiera que esté suscrito al calendario.',
      },
      {
        texto:
          'No es una aproximación: lo arma exactamente lo mismo que publica el evento. Si el link de ' +
          'la reunión no aparece ahí, no se publica; si aparece, se publica.',
      },
      {
        texto:
          'Cuando avisa en rojo que el link de la reunión va a salir publicado, es literal. Si no ' +
          'era la idea, destildá la casilla de la sección «Dónde».',
        cuidado: true,
      },
      {
        texto:
          'Si la actividad está en borrador o el encuentro está cancelado, te muestra cómo quedaría ' +
          'y aclara que hoy ese evento no existe en el calendario.',
      },
      {
        texto:
          'Corregir acá no toca el calendario. Corregir después de publicar sí, y la gente lo ve.',
      },
    ],
  },
  {
    id: 'version',
    titulo: 'Cuando el panel se actualiza',
    paraQue: 'Qué significa el aviso amarillo de arriba, que aparece cuando el panel cambió mientras lo tenías abierto.',
    puntos: [
      {
        texto:
          'El panel se mejora seguido. Si lo dejás abierto en una pestaña, esa pestaña se queda con ' +
          'la versión de cuando la abriste.',
      },
      {
        texto:
          'Si no estás cargando nada, el panel se pone al día solo y no te avisa: no hay nada que ' +
          'decidir.',
      },
      {
        texto:
          'Si estás en medio de un formulario, no se actualiza solo: te avisa arriba y espera. ' +
          'Actualizar en ese momento borraría lo que estás cargando. Guardá, y ahí se pone al día ' +
          'sin preguntarte.',
        cuidado: true,
      },
      {
        texto:
          'El aviso no tiene botón para cerrarlo, a propósito: si se pudiera cerrar de un toque, se ' +
          'cerraría sin leerlo. Se va cuando el problema se resolvió.',
      },
      {
        texto:
          'Los dos códigos que muestra el aviso son las versiones: la que estás usando y la ' +
          'publicada. Si algo anda mal y lo contás, copialos: dicen exactamente con qué panel ' +
          'estabas trabajando.',
      },
      {
        texto:
          'Si el aviso dice que actualizar no alcanzó, cerrá la pestaña y volvé a abrirla.',
      },
    ],
  },
  {
    id: 'novedades',
    titulo: 'Qué hay de nuevo',
    paraQue: 'Cómo enterarte de lo que cambió en el panel sin que nadie te lo cuente.',
    puntos: [
      {
        texto:
          'La pestaña «Novedades», acá al lado, lista lo que se fue agregando: lo más nuevo arriba, ' +
          'en orden.',
      },
      {
        texto:
          'Cuando hay algo que todavía no viste, el botón «Ayuda» del encabezado muestra un número. ' +
          'Al abrir las novedades el número desaparece.',
      },
      {
        texto:
          'Cada novedad dice qué podés hacer ahora que antes no podías, y dónde está en el panel.',
      },
      {
        texto:
          'Lo visto se recuerda en el navegador que estés usando: si entrás desde el teléfono y ' +
          'desde la computadora, cada uno lleva su cuenta.',
      },
    ],
  },
  {
    id: 'telefono',
    titulo: 'Cargar desde el teléfono',
    paraQue: 'El panel se usa igual desde un teléfono; hay un par de cosas que están puestas para eso.',
    puntos: [
      {
        texto:
          'Los botones de guardar están siempre abajo, en una barra fija: no hay que volver al final ' +
          'del formulario para guardar.',
      },
      {
        texto:
          'Cuando algo está mal cargado, esa barra nombra lo que falta —los campos si son pocos, ' +
          'las secciones con su cuenta si son muchos— y tocando un nombre se abre esa sección y ' +
          'baja hasta el campo. El detalle también está al lado de cada campo, en rojo.',
      },
      {
        texto:
          'Si la actividad se puede guardar pero todavía no está para publicarse, la misma barra ' +
          'lo avisa en gris. Eso no frena el guardado: es para que no te enteres de lo que falta ' +
          'el día que quieras publicarla.',
      },
      {
        texto:
          'Las secciones «Material», «Opcional», «Difusión» y «Vista previa del evento» arrancan ' +
          'cerradas para que el formulario no sea infinito. Se abren tocando el título.',
      },
    ],
  },
];

/** Capítulo por el que conviene abrir la guía según desde dónde se la pidió. */
export const CAPITULO_POR_CONTEXTO = {
  lista: 'listado',
  formulario: 'flujo',
  calendario: 'calendario',
} as const;

export type ContextoAyuda = keyof typeof CAPITULO_POR_CONTEXTO;
