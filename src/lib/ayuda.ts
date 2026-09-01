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
 *    tenga su capítulo, que el texto no tenga jerga de programación, y que cada
 *    aviso siga atado a un test de comportamiento que corre (ver abajo).
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
 *
 * ── Por qué cada aviso nombra un test (B-63) ────────────────────────────────
 *
 * Los tests de arriba verifican que el texto **esté**. Ninguno puede verificar
 * que el texto sea **cierto**: el día que cancelar un encuentro deje de sacarlo
 * del calendario, la guía va a seguir diciendo que lo saca y todo va a estar en
 * verde. Y una ayuda que miente es peor que no tener ayuda, porque la gente
 * toma decisiones que no se deshacen leyéndola.
 *
 * De ahí el campo `atadoA`: cada aviso nombra los tests de comportamiento que
 * fijan lo que afirma. No es una cita decorativa —`tests/ayuda.test.ts` abre
 * cada uno de esos archivos y exige que el `it` exista con ese nombre exacto,
 * que no esté saltado y que ninguno de sus `describe` lo apague—, así que
 * borrar, renombrar o saltear el test que sostiene un aviso pone el test de la
 * guía en rojo nombrando qué vínculo se cortó. El nombre del test **no sale a
 * la pantalla**: es data para el test, y hay un chequeo que lo verifica.
 *
 * **Lo que el vínculo NO puede verificar, y hay que saberlo:** que el `it`
 * atado afirme de verdad lo que el aviso dice. El vínculo prueba que sigue
 * habiendo un test con ese nombre corriendo; que su cuerpo no se haya vaciado
 * lo sostiene el mismo `it` (si dejara de afirmar, fallaría) y la review. Y
 * cubre un aviso por sus afirmaciones **atadas**: una frase suelta del texto,
 * sin `it` que la fije, sigue pudiendo mentir. Las que quedaron así están
 * anotadas en B-63.
 */

/** Un comportamiento que no se ve, dentro de un capítulo. */
export interface PuntoAyuda {
  texto: string;
  /** Se destaca: equivocarse acá cuesta caro o no se deshace. */
  cuidado?: boolean;
  /**
   * Tests de comportamiento que fijan lo que este punto afirma. Opcional acá
   * —en los avisos es obligatorio—, y se verifica igual cuando está.
   */
  atadoA?: VinculoTest[];
}

/**
 * Un test de comportamiento que fija lo que la guía afirma.
 *
 * `archivo` es la ruta desde la raíz del repo y tiene que entrar en la corrida
 * de `npm test`: bajo `tests/` y terminada en `.test.ts`. Los
 * `*.integracion.test.ts` **no** sirven: se saltean solos cuando no hay
 * emuladores, así que un vínculo ahí podría estar verde sin haber corrido nada.
 *
 * `it` es el nombre exacto del `it`, tal cual está escrito en el fuente.
 */
export interface VinculoTest {
  archivo: string;
  it: string;
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
  /**
   * Los tests de comportamiento que fijan lo que este aviso afirma.
   * **Obligatorio**: `tests/ayuda.test.ts` falla si un aviso no ata ninguno.
   */
  atadoA: VinculoTest[];
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
    atadoA: [
      // Publicada, el título cambia y la dirección no.
      { archivo: 'tests/formulario-dominio.test.ts', it: 'con el slug bloqueado el título cambia y el slug no' },
      // Y la copia no se deja publicar mientras conserve la dirección «-copia».
      { archivo: 'tests/schema.test.ts', it: 'rechaza publicar con un slug que termina en -copia' },
      { archivo: 'tests/schema.test.ts', it: 'deja GUARDAR un borrador con ese slug' },
    ],
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
    atadoA: [
      // Se guarda y no se publica, salvo que la casilla esté tildada — en el
      // evento del calendario y en el sitio, que son las dos salidas.
      { archivo: 'tests/calendario.test.ts', it: 'el default es NO publicarlo' },
      { archivo: 'tests/calendario.test.ts', it: 'publica el link SOLO si urlPublica está en true' },
      { archivo: 'tests/toPublic.test.ts', it: 'por defecto no filtra el link de la reunión, solo la plataforma' },
      { archivo: 'tests/toPublic.test.ts', it: 'publica el link si urlPublica está en true' },
    ],
  },
  {
    id: 'interno',
    titulo: 'Lo que escribís en «Difusión» no sale nunca',
    texto:
      'La sección «Difusión» —a quién arrobar, notas internas— es tu cuaderno de trabajo: no aparece ' +
      'en el sitio, ni en el calendario, ni en el evento. Lo mismo vale para el material que dejás ' +
      'sin marcar como público: de ese se ve el título y el tipo, nunca el link. Si algo no tiene ' +
      'que verlo nadie de afuera, va en uno de esos dos lugares y en ningún otro.',
    atadoA: [
      // «Difusión» no sale ni al sitio ni al evento.
      { archivo: 'tests/toPublic.test.ts', it: 'no incluye difusion' },
      { archivo: 'tests/calendario.test.ts', it: 'no publica la difusión interna' },
      // Del material sin marcar como público se ve el título, nunca el link.
      { archivo: 'tests/toPublic.test.ts', it: 'un material privado conserva título y tipo pero pierde la URL' },
      { archivo: 'tests/calendario.test.ts', it: 'un material privado conserva título pero pierde la URL' },
    ],
  },
  {
    id: 'cancelar-encuentro',
    /*
     * El título decía «Cancelar un encuentro lo saca del calendario, pero no lo
     * borra», y ese «lo» tenía dos lecturas: la que el texto explica —el
     * encuentro sigue acá— y una falsa, «el evento se queda en el calendario
     * marcado como cancelado», que es justo lo que hoy NO pasa. En un aviso que
     * se lee de un pantallazo, el título tiene que ser cierto solo.
     */
    titulo: 'Cancelar un encuentro saca su evento del calendario y conserva el encuentro acá',
    texto:
      'Al marcar un encuentro como cancelado, su evento desaparece del calendario público. El ' +
      'encuentro sigue acá, con su fecha y su tema, así que queda el registro de que ese día estaba ' +
      'previsto y no se hizo. Si destildás la cancelación, el evento vuelve. Borrar el encuentro, en ' +
      'cambio, lo saca del calendario y también del registro. ' +
      'Los demás encuentros no se tocan: el que era «Encuentro 6 de 8» sigue diciendo eso en el ' +
      'calendario de quien lo tenga agendado. En la serie queda un hueco, que es justamente la ' +
      'forma de ver que ese día se canceló.',
    atadoA: [
      // Cancelar saca del calendario el evento de ESE encuentro, y solo el suyo.
      { archivo: 'tests/calendario.test.ts', it: 'cancelar el tercero de ocho borra solo el suyo (B-84)' },
      // El encuentro sigue acá, con su número: el hueco en la serie se ve.
      { archivo: 'tests/calendario.test.ts', it: 'el cancelado conserva su número, aunque no tenga evento' },
      // Y los demás no se tocan: el 6 de 8 sigue diciendo eso.
      { archivo: 'tests/calendario.test.ts', it: 'el sexto sigue siendo "Encuentro 6 de 8" después de cancelar el tercero' },
      { archivo: 'tests/calendario.test.ts', it: 'el total no cambia por cancelar, así que ningún otro evento se toca' },
    ],
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
    atadoA: [
      // Borrador y cancelada borran los eventos de todos los encuentros.
      { archivo: 'tests/calendario.test.ts', it: 'pasar a borrador borra los ocho eventos' },
      { archivo: 'tests/calendario.test.ts', it: 'cancelar la actividad borra los ocho eventos' },
      // Al republicar se crean de nuevo: son eventos nuevos, no los de antes.
      { archivo: 'tests/calendario.test.ts', it: 'republicar vuelve a crear los eventos' },
      // Y corregir un dato con la actividad publicada actualiza, no recrea.
      { archivo: 'tests/calendario.test.ts', it: 'un cambio de título también propaga a todas' },
    ],
  },
  {
    id: 'calendario-espejo',
    titulo: 'El calendario es un espejo: no se edita ahí',
    texto:
      'Todo lo que se ve en el calendario público sale de este panel. Si entrás a Google Calendar y ' +
      'cambiás a mano una hora, un título o una dirección, ese cambio se pierde la próxima vez que ' +
      'se toque la actividad acá, sin avisar. Lo que haya que cambiar, se cambia en el panel.',
    atadoA: [
      /*
       * Lo que se puede atar es la mitad verificable del aviso: cuando la
       * actividad se toca acá, el evento se reescribe entero con lo que dice el
       * panel —de ahí que el cambio hecho a mano se pierda—, y un solo cambio
       * de la actividad reescribe los eventos de sus ocho encuentros.
       *
       * La otra mitad —que nada lee de vuelta del calendario— no tiene test que
       * la fije, porque no hay código que hacerlo fallar: está anotada en B-63.
       */
      { archivo: 'tests/calendario.test.ts', it: 'un cambio de sede propaga a las ocho sesiones del ciclo' },
      { archivo: 'tests/calendario.test.ts', it: 'un cambio de título también propaga a todas' },
    ],
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
          'Cada fila tiene «Editar» y un menú «⋯» con «Marcar cupo completo», «Duplicar», ' +
          '«Historial» y «Borrar». Están en el menú, y no como botones sueltos, para que ' +
          '«Borrar» no quede pegado a «Editar» en el teléfono.',
      },
      {
        texto:
          'Cuando una actividad se llena, «Marcar cupo completo» lo dice en el evento del ' +
          'calendario de cada encuentro: quien ya se había suscripto al calendario se entera sin ' +
          'que le avises. Es un toque desde el listado, sin abrir el formulario. Si se libera un ' +
          'lugar, el mismo menú lo saca. En el sitio va a aparecer cuando el sitio esté publicado.',
      },
      {
        texto:
          'El contacto de inscripción no se esconde cuando está completo: queda a la vista con el ' +
          'cartel al lado. Siempre hay quien quiere anotarse por si se cae alguien, y esconder el ' +
          'contacto convierte una baja en un lugar que se pierde.',
      },
      {
        texto:
          'Marcar el cupo completo cambia el evento de los encuentros que ya están en el ' +
          'calendario, así que no es un cambio silencioso: es justo lo que se busca, pero conviene ' +
          'saberlo antes de tocarlo y destocarlo varias veces.',
      },
      {
        texto:
          'Duplicar sirve para el ciclo que se repite. Antes de armar la copia te pregunta qué ' +
          'copiar: viene todo tildado y destildás lo que sea de la edición anterior. Las fechas se ' +
          'corren hacia adelante en semanas enteras, así se conservan el día de la semana y la ' +
          'hora. Arranca en borrador y no manda nada al calendario hasta que la publiques.',
        atadoA: [
          {
            archivo: 'tests/duplicar.test.ts',
            it: 'el default hereda lo que hoy se copia: el modal es para desmarcar, no para armar la copia de cero',
          },
        ],
      },
      {
        texto:
          'En esa pregunta, la difusión —las notas internas y las cuentas a arrobar— viene ' +
          'destildada a propósito: es trabajo de la edición anterior y no se ve sin abrir el ' +
          'acordeón, así que antes se colaba en la copia sin que nadie la revise. Solo aparecen ' +
          'las casillas de lo que la actividad tiene cargado, y destildar algo nunca deja la copia ' +
          'sin poder guardarse.',
        atadoA: [
          {
            archivo: 'tests/duplicar.test.ts',
            it: 'la difusión no se hereda: son notas y handles de otra edición que nadie revisa',
          },
          {
            archivo: 'tests/duplicar.test.ts',
            it: 'destildar cualquier casilla deja una copia que el formulario acepta',
          },
        ],
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
      {
        texto:
          'El calendario también muestra las fechas de cierre de inscripción, en celeste y con ' +
          'borde punteado para que no se confundan con un encuentro. Aparecen solo en las ' +
          'actividades publicadas que piden inscripción: la de un borrador no le está ' +
          'ofreciendo nada a nadie. Al tocarlas se abre la actividad, igual que con un encuentro.',
        atadoA: [
          {
            archivo: 'tests/calendarioPanel.test.ts',
            it: 'una actividad que no está publicada no aporta cierre: no invita a nadie',
          },
          {
            archivo: 'tests/calendarioPanel.test.ts',
            it: 'una fecha colgada de una inscripción que ya no se requiere no aporta cierre',
          },
        ],
      },
      {
        texto:
          'Si una inscripción ya cerró y la actividad sigue publicada, sale un aviso arriba de ' +
          'todo con el nombre y el día en que cerró. No es un error del sistema: es que el sitio ' +
          'y el evento del calendario siguen mostrando el contacto, así que alguien puede seguir ' +
          'escribiendo para anotarse. Se resuelve de una de dos formas, y las dos están bien: ' +
          'corré la fecha si todavía entra gente, o marcá «se llenó» desde el menú «⋯» del ' +
          'listado si ya no entra nadie.',
        cuidado: true,
        atadoA: [
          {
            archivo: 'tests/calendarioPanel.test.ts',
            it: 'el aviso junta los vencidos de TODOS los meses y dice dónde están',
          },
        ],
      },
      {
        texto:
          'Las actividades que ya marcaste como completas no entran en ese aviso: su marcador ' +
          'queda en gris y dice «Cupo completo». Es a propósito. Que una inscripción cierre ' +
          'porque se llenó es lo más normal que puede pasar, y si el aviso se encendiera también ' +
          'ahí se encendería casi siempre — y un aviso que se enciende siempre deja de leerse, ' +
          'justo cuando aparece el que sí importaba.',
        atadoA: [
          {
            archivo: 'tests/calendarioPanel.test.ts',
            it: '«se llenó» gana sobre la fecha: un cierre vencido y lleno no pide nada (D-127)',
          },
        ],
      },
      {
        texto:
          'Y un día que solo tiene un cierre de inscripción, sin ningún encuentro, se ve igual: ' +
          'era el caso más fácil de perder de vista, el de la actividad con un solo encuentro ' +
          'lejano cuya inscripción cierra la semana que viene.',
        atadoA: [
          {
            archivo: 'tests/calendarioPanel.test.ts',
            it: 'un día con un cierre y ningún encuentro APARECE en la agenda',
          },
        ],
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
          'El botón «Filtros» abre seis: estado, tipo, arancel, modalidad, barrio y fechas. Se ' +
          'cruzan entre sí y se combinan con el buscador. El número al lado del botón dice ' +
          'cuántos hay puestos, para que un filtro olvidado no parezca un listado vacío.',
      },
      {
        texto:
          'El de arancel es el que contesta «¿qué tengo publicado que sea gratis?». Buscarlo por ' +
          'texto no funciona: el buscador mira el título, la descripción, el lugar y los nombres, ' +
          'no el arancel. «Gratis» y «A la gorra» aparecen primero, igual que en el sitio.',
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
          'Los tipos de actividad tienen además un botón «Color», que decide con qué tinta ' +
          'escribe el sitio esa categoría en el listado. Es la única cosa que se puede cambiar ' +
          'de una opción base: «Taller» y «Charla» no se pueden renombrar ni borrar, pero sí ' +
          'pintar.',
      },
      {
        texto:
          'Los doce colores que ofrece son todos los que hay, y es a propósito: cualquiera de ' +
          'ellos se lee bien sobre el fondo del sitio. Por eso no hay un selector de color libre ' +
          '— con uno se podría elegir un amarillo con el que el nombre de la categoría no se lea.',
      },
      {
        texto:
          'Si no elegís ninguno, el color sale del nombre interno del tipo. Eso vale también ' +
          'para un tipo que crees vos con «Otro»: nace con su propio color en vez de nacer sin ' +
          'color. «Automático» vuelve a ese estado.',
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
          'días. Recalcula solo las fechas: el tema, la lectura y la cancelación de cada encuentro ' +
          'se conservan, así que si el ciclo se corre una semana no hay que volver a tipear las ocho ' +
          'lecturas. Un encuentro que antes no existía nace limpio.',
        atadoA: [
          /*
           * Este punto decía «borra los temas y las lecturas», y era cierto
           * hasta B-176. El código pasó a conservarlos y el texto se quedó
           * mintiendo en la dirección más cara —que es la que hace que nadie
           * apriete el botón—, sin que nada fallara: es el caso que B-63 dice
           * que no se puede ver, encontrado en la guía y no en un cartel.
           */
          { archivo: 'tests/sesiones.test.ts', it: 'regenerar conserva el tema, la lectura y la cancelación de cada fila' },
          { archivo: 'tests/sesiones.test.ts', it: 'y las fechas sí se recalculan: es lo único que el generador pisa' },
          { archivo: 'tests/sesiones.test.ts', it: 'pero una fila que no existía antes nace limpia' },
        ],
      },
      {
        texto:
          'Si los encuentros ya están en el calendario, generarlos de nuevo los mueve de día en ' +
          'lugar de borrarlos y volver a crearlos: quien se suscribió los conserva, con sus ' +
          'recordatorios. Si pedís menos de los que hay, los últimos sí se borran del calendario.',
        atadoA: [
          { archivo: 'tests/sesiones.test.ts', it: 'la fila de cada posición hereda el id y su evento de calendario' },
          { archivo: 'tests/sesiones.test.ts', it: 'generar de menos deja afuera las últimas, no las primeras' },
          { archivo: 'tests/calendario.test.ts', it: 'correr la fecha de un encuentro actualiza solo ese' },
        ],
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
    paraQue:
      'Una fila por forma de cursar. Cada una puede ser presencial, virtual o las dos, y trae su ' +
      'propia dirección o plataforma.',
    puntos: [
      {
        texto:
          'Podés agregar más de una forma de cursar, igual que agregás encuentros. Sirve cuando la ' +
          'misma actividad se da presencial en un lugar y virtual por otro lado: cada fila lleva su ' +
          'dirección o su plataforma, así nadie tiene que adivinar cuál es cuál.',
      },
      {
        texto:
          'El «desde» y el «hasta» de cada forma de cursar son opcionales y hoy no se publican en ' +
          'ningún lado: quedan guardados acá para vos. Todavía está por decidirse qué dicen frente ' +
          'a las fechas de los encuentros, y hasta entonces no salen ni al sitio ni al calendario.',
      },
      {
        texto:
          'Si cambiás una fila de presencial a virtual, la dirección que habías cargado se queda en ' +
          'pantalla pero no se guarda ni se publica: se guarda solo el lugar que corresponde a ' +
          'lo que elegiste. Así podés volver atrás sin perder lo escrito.',
      },
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
          'En «híbrido» se piden las dos cosas en esa misma fila: la gente que va y la que se ' +
          'conecta se anotan igual.',
      },
      {
        texto:
          'El evento del calendario nombra todas las formas de cursar, una por una y con su lugar. ' +
          'La dirección que dibuja el mapa es la de la primera fila que tenga sede, porque el mapa ' +
          'admite una sola: si querés que sea otra, movela arriba.',
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
        texto:
          'En una presentación o una charla se carga además el libro que se presenta. Va en su ' +
          'propio campo y no dentro de la descripción: así se puede mostrar aparte, y alguien que ' +
          'busca el título del libro encuentra la actividad. El autor del libro se llena solo ' +
          'cuando es distinto de la persona invitada —una traducción, una antología, un autor que ' +
          'no viene—; si el autor es quien viene, alcanza con cargarlo arriba. El título y el ' +
          'autor salen en el sitio y en el evento del calendario.',
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
      {
        texto:
          'El cupo se carga una vez y no se vuelve a mirar solo: que se hayan anotado doce de doce ' +
          'no lo sabe nadie más que vos. Para eso está «Marcar cupo completo» en el menú «⋯» del ' +
          'listado; acá abajo aparece un aviso cuando está marcada, pero se prende y se apaga ' +
          'desde el listado.',
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
    paraQue: 'Etiquetas, imágenes y destacado. Nada de esto es obligatorio, pero las etiquetas son las que hacen que la gente encuentre la actividad.',
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
      {
        texto:
          'Las imágenes se pueden cargar de dos maneras: pegando la dirección de una que ya ' +
          'está en otro sitio, o subiendo un archivo tuyo con «Subir una imagen». Las dos ' +
          'conviven en la misma lista y se ven igual en el sitio.',
      },
      {
        texto:
          'Para subir: JPG o PNG, hasta 3 MB cada una y hasta cuatro por actividad. Una foto ' +
          'sacada con el celular sin recortar casi siempre pasa los 3 MB; si el panel la ' +
          'rechaza, te dice cuánto pesa y cuánto es el máximo.',
      },
      {
        texto:
          'Al subir una foto se le quitan los datos ocultos que traen las fotos, entre ellos ' +
          'el lugar exacto donde se sacó. Si el taller es en una casa, esa dirección no se ' +
          'publica sin que nadie se dé cuenta.',
        cuidado: true,
      },
      {
        texto:
          '«Portada» es la que se ve al compartir el link y en la tarjeta del listado. Es una ' +
          'sola: elegir otra desmarca la anterior.',
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
    id: 'texto-para-redes',
    titulo: 'Texto para publicar',
    seccionFormulario: 'Texto para publicar',
    paraQue: 'El posteo armado con lo que ya cargaste, para copiar y pegar.',
    puntos: [
      {
        texto:
          '«Anuncio» trae todas las fechas del ciclo: es para cuando abre la inscripción. ' +
          '«Recordatorio» trae solo el próximo encuentro, con su tema y su lectura: es para el ' +
          'día antes.',
      },
      {
        texto:
          'Los handles del final salen de «Arrobar al publicar», más el Instagram del ' +
          'organizador y el de quien está al frente. La misma cuenta escrita distinto ' +
          '—«@CasaBrandon», «casabrandon»— sale una sola vez.',
        atadoA: [
          {
            archivo: 'tests/textoRedes.test.ts',
            it: 'la misma cuenta escrita distinto sale una sola vez (B-133)',
          },
        ],
      },
      {
        texto:
          'El link de la reunión no sale nunca, ni con «Publicar el link» tildado: en el ' +
          'calendario vos decidís, pero un posteo se copia y no se despublica. Las notas ' +
          'internas de Difusión tampoco salen.',
        cuidado: true,
        atadoA: [
          {
            archivo: 'tests/textoRedes.test.ts',
            it: 'el link de la reunión no sale, ni con `urlPublica: true` (§5.1, trampa 5)',
          },
        ],
      },
      {
        texto:
          'Si marcaste «Cupo completo», el texto lo dice arriba y deja igual el contacto de ' +
          'inscripción: siempre hay quien quiere anotarse por si se cae alguien.',
        atadoA: [
          {
            archivo: 'tests/textoRedes.test.ts',
            it: 'el cupo completo no esconde el canal, va arriba y con el paréntesis (D-127)',
          },
        ],
      },
      {
        texto:
          'El texto no lleva la descripción ni un link a la actividad: la prosa es tuya, y la ' +
          'página del sitio todavía no existe. Lo que se automatiza es el bloque de datos, que ' +
          'es lo que se copia mal.',
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
          'Las secciones «Material», «Opcional» y «Difusión» arrancan cerradas para que el ' +
          'formulario no sea infinito. Se abren tocando el título, y la que abras o cierres ' +
          'queda así para la próxima.' +
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
