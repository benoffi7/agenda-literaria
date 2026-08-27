/**
 * Historial de novedades del panel (B-61, D-63, D-64).
 *
 * **No es el changelog.** `docs/CHANGELOG.md` es técnico: habla de decisiones,
 * de trampas y de por qué se eligió un enfoque, y le sirve a quien programa.
 * Esto es lo mismo contado de otra manera: *qué podés hacer ahora que antes no
 * podías*, en el idioma de quien carga actividades. Existe porque hay una
 * segunda persona cargando actividades que no participó de ninguna decisión y
 * que, sin esto, se entera de lo nuevo solo si alguien se lo cuenta.
 *
 * **Por qué vive en el repo y no en la base de datos** (D-63): una novedad
 * existe *porque se publicó código*. No hay ningún caso en que haga falta
 * anunciar algo sin haber desplegado nada, así que "editable sin deploy" no
 * compra nada — y sí cuesta: reglas nuevas, una pantalla para editar que nadie
 * va a construir, y un paso manual después del deploy que se olvida. Acá, en
 * cambio, la novedad entra en el mismo commit que la funcionalidad y se revisa
 * junto con el código.
 *
 * **Cómo se agrega una entrada** (30 segundos, y es la regla de proceso de
 * `docs/05-patrones.md`): al terminar un cambio que se note al usar el panel,
 * agregar un objeto arriba del array. Nada más. Si el cambio no se nota al
 * usar el panel, no va: esta lista no es un registro de trabajo.
 */

export interface Novedad {
  /**
   * Id estable y único. **No se reusa ni se renombra:** es la marca de "hasta
   * acá leí" que queda guardada en el navegador de cada persona.
   */
  id: string;
  /** `AAAA-MM-DD`. Solo para mostrar; el orden lo da el array. */
  fecha: string;
  /** Qué podés hacer ahora que antes no podías. En una línea. */
  titulo: string;
  /** Dos o tres frases. Si no entra en eso, es la guía y no una novedad. */
  detalle: string;
  /** Dónde está en el panel, para poder ir a mirarlo. */
  donde?: string;
  /**
   * Versión del panel en la que salió, si se sabe (B-64).
   *
   * Sirve para un reporte de bug: "esto empezó a pasar con la versión en la que
   * salió tal cosa". Es el **número de `package.json`** —la parte semver, sin el
   * `+<sha>` que le agrega el build—, porque quien escribe la entrada no puede
   * saber contra qué commit se va a publicar, pero sí en qué release entra.
   *
   * Opcional y no obligatoria a propósito: las entradas anteriores al versionado
   * no la tienen y nunca la van a tener. `tests/novedades.test.ts` verifica la
   * forma de las que sí están, no que estén.
   */
  version?: string;
}

/**
 * Lo más nuevo arriba. El orden del array es el orden en que se muestran y el
 * que decide qué está sin leer, así que **las entradas nuevas van primero**.
 */
export const NOVEDADES: Novedad[] = [
  {
    id: 'cierres-de-inscripcion-en-el-calendario',
    fecha: '2026-08-27',
    version: '1.3.0',
    titulo: 'El calendario te avisa de las inscripciones que cierran',
    detalle:
      'La fecha de cierre aparece como un marcador en su día, en celeste y con borde punteado, ' +
      'así no se confunde con un encuentro. Y si una inscripción ya cerró y la actividad sigue ' +
      'publicada, sale un aviso arriba con el nombre y el día. Lo que marcaste como completo no ' +
      'aparece en ese aviso, porque no hay nada que hacer.',
    donde: 'Listado de actividades → botón «Calendario»',
  },
  {
    id: 'texto-para-redes',
    fecha: '2026-08-27',
    version: '1.3.0',
    titulo: 'Ya no hace falta escribir el posteo a mano',
    detalle:
      'La sección «Texto para publicar» arma el texto con lo que cargaste y al final arroba a ' +
      'las cuentas de «Arrobar al publicar», más el Instagram del organizador y de quien está al ' +
      'frente, sin repetir la misma cuenta escrita distinto. Hay dos versiones: «Anuncio», con ' +
      'todas las fechas, y «Recordatorio», con el próximo encuentro. El link de la reunión no ' +
      'sale nunca.',
    donde: 'Formulario, sección «Texto para publicar»',
  },
  {
    id: 'correr-la-fecha-de-un-encuentro',
    fecha: '2026-08-27',
    version: '1.3.0',
    titulo: 'Correr un encuentro de fecha ya no pide pelear con el almanaque',
    detalle:
      'Cada encuentro tiene cuatro botones —un día o una semana, adelante o atrás— que mueven el ' +
      'inicio y el fin juntos. Y si escribís la fecha a mano, abajo dice en qué día de la semana ' +
      'cae y cuánto dura, que era lo único que había que ir a mirar al calendario. Cambiar el ' +
      'inicio ya no obliga a corregir el fin.',
    donde: 'Formulario, sección «Encuentros»',
  },
  {
    id: 'duplicar-elegir-que-se-copia',
    fecha: '2026-08-27',
    version: '1.3.0',
    titulo: 'Al duplicar podés elegir qué se copia',
    detalle:
      '«Duplicar» ahora pregunta antes: viene todo tildado, como hasta ahora, y destildás lo que ' +
      'sea de la edición anterior. Las notas internas de difusión y las cuentas a arrobar vienen ' +
      'destildadas: son trabajo de la otra edición y no se ven sin abrir el acordeón. Solo ' +
      'aparecen las casillas de lo que la actividad tiene cargado.',
    donde: 'Listado, menú «⋯» → «Duplicar»',
  },
  {
    id: 'cupo-completo',
    fecha: '2026-08-27',
    version: '1.3.0',
    titulo: 'Ahora podés avisar que una actividad se llenó',
    detalle:
      'En el menú «⋯» del listado hay «Marcar cupo completo»: lo dice en el evento del calendario ' +
      'de cada encuentro, así que quien ya se había suscripto se entera sin que le avises. Es un ' +
      'toque, sin abrir el formulario. El contacto de inscripción no se esconde: queda a la vista ' +
      'con el cartel al lado, porque siempre hay quien quiere anotarse por si se cae alguien.',
    donde: 'Listado de actividades, menú «⋯» de cada fila',
  },
  {
    id: 'libro-presentado',
    fecha: '2026-08-27',
    version: '1.3.0',
    titulo: 'En una presentación o una charla ya se carga el libro',
    detalle:
      'El título de la obra tiene su propio campo, así que no hace falta meterlo en la ' +
      'descripción: se muestra aparte, sale en el evento del calendario y quien busque el nombre ' +
      'del libro encuentra la actividad. El autor se completa solo si es distinto de la persona ' +
      'invitada.',
    donde: 'Formulario, sección «Quién»',
  },
  {
    id: 'galeria-de-imagenes',
    fecha: '2026-08-27',
    version: '1.3.0',
    titulo: 'Una actividad puede tener varias imágenes',
    detalle:
      'Hasta cuatro, cada una con un epígrafe opcional, y una marcada como portada: esa es la que ' +
      'se ve al compartir el link. Se pegan direcciones de imágenes que ya estén publicadas en ' +
      'otro lado y se ven al momento de pegarlas. Subir fotos desde el dispositivo todavía no ' +
      'está.',
    donde: 'Formulario, sección «Opcional»',
  },
  {
    id: 'regenerar-no-borra-los-temas',
    fecha: '2026-08-27',
    version: '1.3.0',
    titulo: 'Regenerar las fechas ya no borra los temas ni las lecturas',
    detalle:
      '«Generar N encuentros» recalcula solo las fechas: los temas, las lecturas y las ' +
      'cancelaciones que hayas cargado se conservan. Antes había que volver a tipear todo, que en ' +
      'un club de ocho encuentros era lo más caro de rehacer.',
    donde: 'Formulario, sección «Encuentros»',
  },
  {
    id: 'generador-dice-que-es-cada-campo',
    fecha: '2026-08-27',
    version: '1.3.0',
    titulo: 'El generador de encuentros dice qué es cada campo',
    detalle:
      'Los dos campos de «Generar N encuentros» ahora se llaman «Cuántos encuentros» y «Cada ' +
      'cuántos días», y el texto de al lado aclara que 7 es una vez por semana y que para días ' +
      'seguidos —una feria de varias jornadas— va 1.',
    donde: 'Formulario, sección «Encuentros», botón «Generar N encuentros…»',
  },
  {
    id: 'tipo-libreria-a-la-calle',
    fecha: '2026-08-27',
    version: '1.3.0',
    titulo: 'Hay un tipo nuevo: «Librería a la calle»',
    detalle:
      'Para cuando una librería saca los libros a la vereda, se instala en un bar o hace algo en ' +
      'la calle. Como «Feria», viene marcada como ciclo: cargá un encuentro por jornada.',
    donde: 'Formulario, campo «Tipo de actividad»',
  },
  {
    id: 'vista-previa-abierta',
    fecha: '2026-08-27',
    version: '1.3.0',
    titulo: 'La vista previa del evento está a la vista',
    detalle:
      'La sección del final del formulario arranca abierta: ahí se ve el título, la ubicación y ' +
      'el texto completo del evento tal como lo va a ver quien esté suscrito al calendario. Si la ' +
      'cerrás, queda cerrada la próxima vez.',
    donde: 'Formulario, sección «Vista previa del evento»',
  },
  {
    id: 'autoguardado-del-formulario',
    fecha: '2026-08-26',
    version: '1.2.0',
    titulo: 'El formulario se guarda solo mientras lo completás',
    detalle:
      'Lo que vas escribiendo queda guardado cada pocos segundos en el dispositivo que estés ' +
      'usando. Si se cierra la pantalla o te vas sin guardar, al volver a abrir la actividad te ' +
      'ofrece seguir desde ahí, con la fecha de lo último que quedó. Es de tu cuenta y se borra ' +
      'al salir. Al recuperarlo, las casillas que muestran un link quedan destildadas.',
    donde: 'Formulario de una actividad, en un aviso arriba de todo',
  },
  {
    id: 'borrador-sin-completar-todo',
    fecha: '2026-08-26',
    version: '1.2.0',
    titulo: 'Guardar borrador ya no te pide completar todo',
    detalle:
      'Ahora alcanza con el título para guardar una actividad a medias y seguirla otro día: el ' +
      'tipo, la descripción, quién la organiza, el arancel, la sede y los encuentros se piden ' +
      'recién cuando la publicás, que es cuando sale al calendario. Lo único que se sigue ' +
      'pidiendo siempre es la fecha de cada encuentro que hayas cargado.',
    donde: 'Botón «Guardar borrador», abajo del formulario',
  },
  {
    id: 'la-barra-dice-que-falta',
    fecha: '2026-08-26',
    version: '1.2.0',
    titulo: 'Cuando falta algo, la barra dice qué y te lleva hasta ahí',
    detalle:
      'Antes decía cuántos campos faltaban; ahora los nombra, y si son muchos nombra las ' +
      'secciones con la cantidad de cada una. Tocando un nombre se abre la sección —incluso si ' +
      'estaba cerrada— y baja hasta el campo. Y si el borrador se puede guardar pero le falta ' +
      'algo para publicarse, la barra lo avisa en gris sin frenar el guardado.',
    donde: 'Barra de abajo del formulario',
  },
  {
    id: 'etiquetas-nacen-aprobadas',
    fecha: '2026-08-25',
    version: '1.1.0',
    titulo: 'Una etiqueta nueva que creás ya la puede usar la otra cuenta enseguida',
    detalle:
      'Esto cambia lo que decía la novedad «Una etiqueta nueva que creás no le aparece a la otra ' +
      'persona hasta revisarla»: ya no hay que revisar nada. Lo que cargás con «Otro…» —un barrio, ' +
      'un arancel, una etiqueta— queda disponible para las dos cuentas en el momento. La revisión ' +
      'sigue existiendo por dentro para el día en que cargue gente de afuera; hoy no molesta a nadie.',
    donde: 'En cualquier desplegable con la opción «Otro…».',
  },
  {
    id: 'tipo-feria',
    fecha: '2026-08-25',
    version: '1.1.0',
    titulo: '«Feria» ya está en la lista de tipos de actividad',
    detalle:
      'Antes había que cargarla con «Otro…» y acordarse de tildar «es un ciclo» a mano. Ahora está ' +
      'entre las opciones de siempre y, al elegirla, nace marcada como ciclo: una feria dura varios ' +
      'días, así que va un encuentro por jornada. No pide tallerista ni abre la sección de material.',
    donde: 'Campo «Tipo», en la sección «Qué es».',
  },
  {
    id: 'material-mas-formatos',
    fecha: '2026-08-25',
    version: '1.1.0',
    titulo: 'El material acepta «durante el mes», newsletter y playlist',
    detalle:
      'La entrega ya no tiene que ser un instante: «Durante el mes» es para la lectura que se va ' +
      'repartiendo a lo largo del ciclo. Y se sumaron dos formatos que antes no entraban en ningún ' +
      'lado, newsletter y playlist. «Lectura» ahora se lee «Libro o lectura», que es lo mismo de ' +
      'siempre con el nombre más claro. Y en el evento, un ítem cargado como «Otro» ya no arrastra ' +
      'la palabra «Otro»: queda el título y cuándo llega.',
    donde: 'Sección «Material», en cada fila.',
  },
  {
    id: 'quien-cargo-cada-actividad',
    fecha: '2026-08-25',
    version: '1.1.0',
    titulo: 'El listado te dice cuáles cargó la otra cuenta',
    detalle:
      'Sí, en el panel se ven las actividades de las dos cuentas: es una sola agenda. Lo que faltaba ' +
      'era poder distinguirlas, y ahora las que no cargaste vos dicen «La cargó otra cuenta» debajo ' +
      'de la fecha. Lo tuyo no lleva marca, a propósito: si todo estuviera marcado, la marca no ' +
      'avisaría de nada.',
    donde: 'Debajo de la fecha, en cada fila del listado.',
  },
  {
    id: 'arrobar-varios-handles',
    fecha: '2026-08-25',
    version: '1.1.0',
    titulo: 'Ahora sí podés arrobar a más de una cuenta',
    detalle:
      'El campo «Arrobar al publicar» se comía la coma justo al escribirla, así que no había ' +
      'forma de cargar un segundo handle, y Enter intentaba guardar la actividad. Ahora cada ' +
      'cuenta queda como una etiqueta: Enter o coma la agrega, Backspace borra la última, y ' +
      'podés pegar una lista entera de una vez. La misma cuenta escrita distinto no entra dos ' +
      'veces.',
    donde: 'Sección «Difusión», campo «Arrobar al publicar».',
  },
  {
    id: 'desplegables-sin-slug-crudo',
    fecha: '2026-08-25',
    version: '1.1.0',
    titulo: 'Los desplegables ya no muestran el nombre en minúscula con guiones',
    detalle:
      'Al cargar un barrio o un lugar nuevo, el desplegable mostraba «villa-crespo (nueva)» en ' +
      'lugar de «Villa Crespo». Pasaba también al reabrir una actividad cuya etiqueta no había ' +
      'llegado a registrarse. Ahora se lee igual que en el evento del calendario.',
    donde: 'Cualquier desplegable con «Otro…»: arancel, tipo, barrio y plataforma.',
  },
  {
    id: 'administrar-las-opciones',
    fecha: '2026-08-25',
    version: '1.1.0',
    titulo: 'Ya podés arreglar, borrar y ordenar las opciones de los desplegables',
    detalle:
      'El botón «Opciones» abre las cinco listas que crecen solas —arancel, tipo, barrio, ' +
      'plataforma y etiquetas— con cuántas actividades usan cada una. Ahí podés renombrar una ' +
      'mal escrita o borrar la que sobra, sin tocar ninguna actividad. Ojo: renombrar cambia ' +
      'solo cómo se lee, así que NO corrige un typo ya guardado; para eso hay que borrar la ' +
      'mala y volver a elegir.',
    donde: 'Botón «Opciones», arriba del listado de actividades.',
  },
  {
    id: 'regenerar-encuentros-conserva-el-calendario',
    fecha: '2026-08-24',
    version: '1.1.0',
    titulo: 'Volver a generar los encuentros ya no borra los eventos del calendario',
    detalle:
      'Si el ciclo se corre una semana, ahora podés volver a generar las fechas sin perder nada ' +
      'del calendario: los encuentros que ya estaban publicados se mueven de día en lugar de ' +
      'borrarse y crearse de nuevo, así que quien se suscribió los conserva con sus ' +
      'recordatorios. Los temas y las lecturas se siguen borrando, eso no cambió.',
    donde: 'Botón «Generar N encuentros…», en la sección Encuentros.',
  },
  {
    id: 'reintentar-reporte-fallido',
    fecha: '2026-08-24',
    version: '1.1.0',
    titulo: 'Un reporte que no se pudo publicar ahora lo podés reintentar vos',
    detalle:
      'Cuando un bug o una sugerencia queda como «no se pudo publicar», aparece un botón para ' +
      'volver a intentarlo, sin pedirle nada a nadie. Conviene esperar un rato si acaba de ' +
      'fallar: casi siempre es algo que se está arreglando del otro lado.',
    donde: 'En «Reportar algo», en la lista de últimos reportes.',
  },
  {
    id: 'menu-y-ayuda-con-teclado',
    fecha: '2026-08-24',
    version: '1.1.0',
    titulo: 'El menú «⋯» de cada actividad y la ayuda se manejan con el teclado',
    detalle:
      'En el menú de cada fila podés bajar y subir con las flechas y salir con Escape, y al ' +
      'salir volvés al mismo lugar del listado en vez de empezar de nuevo. La ventana de ayuda ' +
      'ya no te deja escaparte con Tab hacia el formulario de atrás.',
    donde: 'El botón «⋯» de cada actividad del listado, y el botón «Ayuda» del encabezado.',
  },
  {
    id: 'aviso-al-salir-sin-guardar',
    fecha: '2026-08-24',
    version: '1.1.0',
    titulo: 'Si te vas de una actividad a medio cargar, ahora el panel te pregunta',
    detalle:
      'Antes, tocar «Volver», «Reportar algo», «Salir» o «Cancelar» con la actividad a medio ' +
      'llenar la descartaba sin decir nada, y cerrar la pestaña también. Ahora pregunta antes, ' +
      'y solo cuando hay algo escrito que se perdería.',
    donde: 'En cualquier botón que te saque del formulario, y al cerrar la pestaña.',
  },
  {
    id: 'destacar-llega-al-sitio',
    fecha: '2026-08-24',
    version: '1.1.0',
    titulo: 'Destacar una actividad, o cambiarle la imagen, ahora sí se ve en el sitio',
    detalle:
      'Antes, los cambios que no tocan el calendario —destacar en la portada, la imagen, el ' +
      'título para buscar— se guardaban bien pero el sitio no se rehacía, así que no se veían ' +
      'hasta que editabas otra cosa. Ahora cualquier cambio que hagas pide la actualización del ' +
      'sitio, que tarda unos minutos.',
    donde: 'Casilla «Destacar en la portada» y campo de imagen, en el formulario.',
  },
  {
    id: 'sin-encuentros-duplicados',
    fecha: '2026-08-24',
    version: '1.1.0',
    titulo: 'El calendario público ya no puede quedarse con dos veces el mismo encuentro',
    detalle:
      'Había dos formas de que un encuentro terminara publicado dos veces: editar una actividad ' +
      'justo después de publicarla, y un reintento interno del sistema. Las dos están cerradas. ' +
      'Si en el calendario ves un encuentro repetido de antes, hay que borrarlo a mano una vez.',
    donde: 'En el calendario público, y en la vista «Calendario» del panel.',
  },
  {
    id: 'cancelar-no-renumera',
    fecha: '2026-08-24',
    version: '1.1.0',
    titulo: 'Cancelar un encuentro ya no le cambia el nombre a los demás',
    detalle:
      'Antes, cancelar el tercero de ocho hacía que el sexto pasara a decir «Encuentro 5 de 7» en ' +
      'el calendario de todos los que lo tenían agendado, sin que nada hubiera cambiado para ' +
      'ellos. Ahora cada encuentro conserva su número y en la serie queda un hueco, que es la ' +
      'forma de ver que ese día se canceló.',
    donde: 'Al tildar «cancelado» en un encuentro de un ciclo.',
  },
  {
    id: 'calendario-en-curso',
    fecha: '2026-08-24',
    version: '1.1.0',
    titulo: 'Una actividad que está empezando ahora ya no se te esconde en la lista',
    detalle:
      'Antes, un taller de 19 a 21 desaparecía de "lo que se viene" a las 19:01, justo cuando ' +
      'alguien podía necesitar abrirlo. Ahora sigue contando como próximo hasta que termina de ' +
      'verdad.',
    donde: 'En la lista, en el orden y en el filtro «con algo por venir».',
  },
  {
    id: 'vista-calendario',
    fecha: '2026-08-22',
    version: '1.1.0',
    titulo: 'Hay una vista calendario que te dice qué está publicado de verdad',
    detalle:
      'Muestra los encuentros día por día y, con un color por encuentro, si la gente ya lo ve en ' +
      'el calendario público. Lo más útil: avisa cuando un encuentro debería estar publicado y su ' +
      'evento no existe, algo que antes no se veía en ninguna pantalla. En el teléfono se ve como ' +
      'agenda, no como grilla.',
    donde: 'Botón «Calendario», arriba a la derecha del listado.',
  },
  {
    id: 'orden-y-filtros-del-listado',
    fecha: '2026-08-22',
    version: '1.1.0',
    titulo: 'El listado arranca por lo que se viene, y se puede filtrar',
    detalle:
      'Arriba está la actividad con el encuentro más próximo, no la última que tocaste, y cada ' +
      'fila dice cuándo es. Con el botón «Filtros» podés cruzar estado, tipo, modalidad, barrio y ' +
      'si le queda algo por venir. El orden de antes sigue disponible en «Ordenar por».',
    donde: 'En el listado de actividades.',
  },
  {
    id: 'version-en-el-pie',
    fecha: '2026-08-22',
    version: '1.0.1',
    titulo: 'Abajo de todo siempre dice qué versión del panel estás usando',
    detalle:
      'Y si hay una más nueva publicada, te lo avisa ahí con un botón para actualizar. ' +
      'Sirve para cuando algo no funciona: con ese número se puede saber exactamente qué ' +
      'versión estabas usando.',
    donde: 'Al pie de cualquier pantalla del panel.',
  },
  {
    id: 'medicion-del-uso',
    fecha: '2026-08-21',
    version: '1.0.0',
    titulo: 'El panel mide cómo se usa, para encontrar lo que molesta',
    detalle:
      'Queda registrado en qué pantalla se trabaja, qué campos dan error al guardar y cuánto ' +
      'tarda una carga. Es para descubrir qué está mal hecho antes de que alguien se enoje. ' +
      'No se guarda nada de lo que escribís, ni tu mail, ni quién sos: solo qué campo falló y ' +
      'cuántas veces. Te lo contamos porque corresponde, no porque haga falta tu permiso ' +
      'técnico.',
    donde: 'No se ve en ninguna pantalla: pasa de fondo.',
  },
  {
    id: 'reportar-desde-el-panel',
    fecha: '2026-08-21',
    version: '1.0.0',
    titulo: 'Podés reportar un problema o pedir algo sin salir del panel',
    detalle:
      'Cargás el problema y llega directo a la lista de pendientes del proyecto. Queda con la ' +
      'versión del panel que estabas usando, así se puede reproducir. Ojo: por ahora la ' +
      'respuesta no vuelve al panel, así que si es urgente, avisá también por otro lado.',
    donde: 'Botón «Reportar algo», arriba a la derecha.',
  },
  {
    id: 'historial-de-cambios',
    fecha: '2026-08-21',
    version: '1.0.0',
    titulo: 'Si pisás una descripción larga, ya no se pierde',
    detalle:
      'Cada vez que se edita una actividad se guarda cómo estaba antes. Se conservan las ' +
      'últimas veinte. Todavía no hay pantalla para verlas, así que si necesitás recuperar ' +
      'algo, pedilo: el dato está guardado.',
    donde: 'No se ve en ninguna pantalla todavía.',
  },
  {
    id: 'etiquetas-a-revisar',
    fecha: '2026-08-21',
    version: '1.0.0',
    titulo: 'Una etiqueta nueva que creás no le aparece a la otra persona hasta revisarla',
    detalle:
      'Cuando usás «Otro…» para agregar un barrio, un arancel o un tag, lo podés usar enseguida ' +
      'y queda marcado «(sin aprobar)». La otra cuenta no lo ve en su desplegable hasta que se ' +
      'revise. Es para que la lista no se llene de variantes de lo mismo escritas distinto.',
    donde: 'En cualquier desplegable con la opción «Otro…».',
  },
  {
    id: 'ayuda-y-novedades',
    fecha: '2026-08-21',
    titulo: 'Hay una guía del panel adentro del panel, y esta lista de novedades',
    detalle:
      'La guía explica para qué sirve cada sección y, sobre todo, las cosas que no se ven: qué ' +
      'queda fijo al publicar, qué se publica y qué no, qué pasa cuando cancelás un encuentro. ' +
      'Y esta lista te va a ir contando lo que cambie, así no hace falta que nadie te lo cuente.',
    donde: 'Botón «Ayuda», arriba a la derecha, en cualquier pantalla.',
  },
  {
    id: 'aviso-version-nueva',
    fecha: '2026-08-21',
    titulo: 'El panel te avisa cuando se actualizó mientras lo tenías abierto',
    detalle:
      'Si no estás cargando nada, se pone al día solo y no te molesta. Si estás en medio de un ' +
      'formulario, no se actualiza: te avisa arriba y espera a que guardes, porque actualizar en ' +
      'ese momento te borraría el trabajo.',
    donde: 'Aviso amarillo fijo arriba, cuando corresponde.',
  },
  {
    id: 'coordenadas-sede',
    fecha: '2026-08-21',
    titulo: 'Podés marcar el punto exacto del lugar en el mapa',
    detalle:
      'Buscás el lugar en Google Maps, pegás el link, y el evento del calendario abre el mapa ' +
      'justo ahí en vez de hacer que Google adivine por la dirección. Sirve para las librerías sin ' +
      'número claro y los lugares dentro de un predio. Los links cortos «maps.app.goo.gl» no ' +
      'sirven: hay que abrirlos y pegar el largo.',
    donde: 'Sección «Dónde», debajo de «Cómo llegar».',
  },
  {
    id: 'slug-copia-no-publica',
    fecha: '2026-08-21',
    titulo: 'Una copia ya no se puede publicar con la dirección web «-copia»',
    detalle:
      'La dirección web queda fija para siempre en el momento de publicar. Antes se podía publicar ' +
      'una copia sin corregirla y quedaba «…-copia» a la vista, sin arreglo. Ahora el panel no te ' +
      'deja publicar hasta que la cambies. Guardarla como borrador sigue funcionando igual.',
  },
  {
    id: 'vista-previa-evento',
    fecha: '2026-08-21',
    titulo: 'Podés ver cómo va a quedar el evento antes de publicarlo',
    detalle:
      'Elegís un encuentro y ves el título, la ubicación y el texto completo del evento, tal como ' +
      'los va a ver cualquiera que esté suscrito al calendario. No es una aproximación: si el link ' +
      'de la reunión no aparece ahí, no se publica.',
    donde: 'Última sección del formulario: «Vista previa del evento».',
  },
  {
    id: 'duplicar-actividad',
    fecha: '2026-08-21',
    titulo: 'Podés duplicar una actividad entera',
    detalle:
      'El ciclo del año pasado con otras fechas ya no se carga de cero: la copia trae los 30 y ' +
      'pico de campos, corre las fechas hacia adelante conservando el día de la semana y la hora, y ' +
      'arranca como borrador sin tocar el calendario ni el original. Revisá título, dirección web y ' +
      'fechas antes de publicar.',
    donde: 'Menú «⋯» de cada fila del listado.',
  },
  {
    id: 'arancel-obliga-elegir',
    fecha: '2026-08-21',
    titulo: 'El arancel ahora te obliga a elegir',
    detalle:
      'Antes venía puesto en «Gratis». Un taller pago que nadie corregía se publicaba como ' +
      'gratuito y la gente llegaba esperando no pagar. Ahora hay que elegirlo a mano: es un clic ' +
      'más por actividad.',
    donde: 'Sección «Arancel e inscripción».',
  },
  {
    id: 'link-reunion-casilla',
    fecha: '2026-08-21',
    titulo: 'La casilla «publicar el link de la reunión» ahora hace lo que dice',
    detalle:
      'Antes el link nunca se publicaba, la tildaras o no. Ahora, tildada, el link sale en el sitio ' +
      'y en el evento del calendario. Dejala destildada salvo que sea un encuentro abierto sin ' +
      'cupo: un link de reunión público lo puede usar cualquiera.',
    donde: 'Sección «Dónde», debajo del link del encuentro.',
  },
  {
    id: 'evento-completo',
    fecha: '2026-08-21',
    titulo: 'El evento del calendario ahora lleva toda la información que cargás',
    detalle:
      'Antes llevaba solo el título, la descripción y la calle. Ahora lleva la modalidad, la sede ' +
      'con el «cómo llegar» y el link al mapa, el arancel con sus notas, la inscripción, el ' +
      'material, el organizador y la bio. Sigue sin llevar tus notas internas, los links del ' +
      'material privado ni el link de la reunión (salvo que lo tildes).',
  },
  {
    id: 'mapa-direccion',
    fecha: '2026-08-21',
    titulo: 'La dirección del evento ahora abre bien el mapa',
    detalle:
      'Se mandaba solo la calle, sin barrio ni ciudad, y el mapa del evento podía aparecer en otra ' +
      'ciudad o no aparecer. Ahora va la dirección completa.',
  },
  {
    id: 'formulario-telefono',
    fecha: '2026-08-21',
    titulo: 'El formulario se puede cargar desde el teléfono',
    detalle:
      'Los campos ya no hacen zoom en el iPhone al tocarlos, los botones de guardar están siempre ' +
      'abajo a la vista, y lo que no entra a lo ancho se acomoda en una columna.',
  },
  {
    id: 'desplegables-placeholder',
    fecha: '2026-08-21',
    titulo: 'Los desplegables ya no parecen elegidos cuando no lo están',
    detalle:
      'El texto de ejemplo se veía igual a una opción ya elegida, así que al guardar saltaba «Elegí ' +
      'el arancel» sobre un formulario que parecía completo. Ahora los desplegables piden ' +
      'explícitamente que elijas.',
  },
];

/** Dónde se recuerda, por navegador, hasta dónde leyó esta persona. */
export const CLAVE_VISTO = 'agenda-literaria:novedad-vista';

/**
 * Novedades que esta persona todavía no vio.
 *
 * - Sin marca guardada (primera vez, o navegador nuevo) → todas son nuevas. Es
 *   lo que queremos: la primera vez el badge invita a leer la lista completa.
 * - Con una marca que ya no existe en la lista → **ninguna**. Es el lado
 *   prudente del error: si alguien borra una entrada vieja que era la marca de
 *   otra persona, preferimos no avisar de nada antes que gritarle "12
 *   novedades" a quien ya las leyó. Un aviso falso repetido se aprende a
 *   ignorar, y ahí el mecanismo entero deja de servir.
 */
export function novedadesNoLeidas(lista: Novedad[], visto: string | null): Novedad[] {
  if (!visto) return lista;
  const i = lista.findIndex((n) => n.id === visto);
  return i === -1 ? [] : lista.slice(0, i);
}

/**
 * Lectura de la marca. Devuelve `null` ante cualquier problema: en una ventana
 * privada de Safari, o con el sitio bloqueado para guardar datos, leer esto
 * lanza una excepción en vez de devolver vacío.
 */
export function leerVisto(): string | null {
  try {
    return window.localStorage.getItem(CLAVE_VISTO);
  } catch {
    return null;
  }
}

/**
 * Guarda hasta dónde leyó. Si el navegador no deja guardar, no pasa nada grave:
 * el badge va a volver a aparecer en la próxima visita. Preferimos eso a que
 * el panel se caiga por una novedad.
 */
export function guardarVisto(id: string): void {
  try {
    window.localStorage.setItem(CLAVE_VISTO, id);
  } catch {
    // Sin lugar donde guardar; el aviso reaparece y no se rompe nada.
  }
}

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/**
 * `'2026-08-21'` → `'21 de agosto de 2026'`.
 *
 * Se formatea con las partes del texto y **no** con `new Date(...)`: esa cadena
 * se interpreta como medianoche UTC y, mostrada en la zona del proyecto, retro-
 * cede un día — el 21 se ve como 20. Es la misma trampa de los eventos corridos
 * tres horas, en chiquito.
 */
export function fechaLegible(fecha: string): string {
  const [anio, mes, dia] = fecha.split('-');
  const nombre = MESES[Number(mes) - 1];
  if (!anio || !dia || !nombre) return fecha;
  return `${Number(dia)} de ${nombre} de ${anio}`;
}
