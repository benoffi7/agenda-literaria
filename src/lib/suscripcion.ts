/**
 * El contenido de la página «Suscribirse» — B-230.
 *
 * ── Por qué el texto vive acá y no en el markup ───────────────────────────
 * Porque es **lo que hay que verificar**. Esta página existe para que alguien
 * que no sabe qué es un calendario suscribible termine suscripto, y la forma en
 * que falla no es rompiéndose: es dejando un camino a medias. Un botón sin los
 * pasos al lado, un paso que dice «pegá la dirección» sin decir dónde, o un
 * cuarto camino que se agrega y nadie muestra. Nada de eso pone el build en
 * rojo, y todo eso deja a una persona sin poder seguir.
 *
 * Siendo data, `tests/suscribirse.test.ts` puede exigir la propiedad que
 * importa —**ningún camino sin instrucciones**— en vez de mirar la pantalla. Es
 * el mismo criterio de `src/lib/ayuda.ts`.
 *
 * ── Las URLs no se escriben acá ───────────────────────────────────────────
 * Todas salen de `src/lib/enlaces.ts`, que es el único lugar donde viven. No es
 * prolijidad: Google publica **dos** direcciones del mismo calendario, y la que
 * empieza con `private-` le da acceso de lectura al calendario entero a
 * cualquiera que la tenga. Están a un path de distancia y se copian igual de
 * fácil. Quien escriba una URL a mano en esta página se sale de la red que
 * `tests/enlaces.test.ts` tendió alrededor de esa diferencia — así que el test
 * de esta página también barre las suyas, y además exige que cada una sea
 * exactamente una de las que produce `enlaces.ts`.
 *
 * ── Tono ──────────────────────────────────────────────────────────────────
 * Le habla a quien va a un taller de escritura, no a quien programa. Sin
 * nombres de archivo, sin nombres de campo, sin referencias a secciones.
 */
import {
  urlDeInstagram,
  urlDelCalendario,
  urlDelIcs,
  urlParaSuscribirseEnGoogle,
  urlWebcal,
} from '@/lib/enlaces';

/**
 * Un enlace que la página ofrece como acción.
 *
 * `avisoLector` es obligatorio y no decorativo: tres de las cuatro acciones no
 * hacen lo que un enlace hace normalmente —dos abren una pestaña nueva y una
 * **se va del navegador y abre otra aplicación**—. Quien ve la pantalla se da
 * cuenta; quien escucha la página, no, salvo que se lo digan antes de tocar.
 */
export interface Accion {
  /** Lo que dice el botón. */
  texto: string;
  /** Sale de `enlaces.ts`, siempre. */
  url: string;
  /** Lo que se anuncia además del texto del botón: adónde lleva de verdad. */
  avisoLector: string;
  /** Abre una pestaña nueva del navegador. `webcal:` **no**: abre otra aplicación. */
  nuevaPestana: boolean;
  /**
   * La dirección se muestra escrita, porque el camino consiste en copiarla y
   * pegarla en otro programa. Solo la del calendario para otros lectores.
   */
  seCopia?: boolean;
}

/** Los cuatro caminos. El tipo obliga a que cada uno tenga su contenido. */
export type IdCamino = 'google' | 'apple' | 'otros' | 'mirar';

export interface Camino {
  id: IdCamino;
  titulo: string;
  /** Una línea: cómo sabe alguien que este camino es el suyo. */
  paraQuien: string;
  accion: Accion;
  /** Las instrucciones, en orden. Nunca vacío: un botón solo no alcanza. */
  pasos: string[];
  /** Lo que sale mal seguido en este camino, y cómo se arregla. */
  siSaleMal?: string;
}

/** Lo que el calendario NO hace. Cada una evita una sorpresa distinta. */
export type IdAdvertencia = 'inscripcion' | 'reunion' | 'cancelada';

export interface Advertencia {
  id: IdAdvertencia;
  titulo: string;
  texto: string;
}

// ───────────────────────────────────────────────────────────────────────────
// Qué gana tu calendario
// ───────────────────────────────────────────────────────────────────────────

/**
 * La diferencia entre anotarse las fechas a mano y suscribirse. Es lo primero
 * que lee la página porque es lo único que justifica el resto: si no se
 * entiende que los cambios llegan solos, cualquiera de los cuatro caminos
 * parece trabajo de más.
 */
export const COMO_FUNCIONA = {
  titulo: 'Qué gana tu calendario',
  entrada:
    'La agenda es un calendario público al que te podés suscribir. No es copiarte las fechas: es que las fechas te sigan.',
  puntos: [
    'Cuando se publica una actividad nueva, aparece sola entre tus eventos.',
    'Si se corre una fecha, cambia el horario o se muda la dirección, el encuentro se corrige solo. No tenés que volver acá a controlar.',
    'Cada encuentro entra por separado: un ciclo de ocho semanas te deja ocho eventos, cada uno con el tema de ese día.',
    'Es de solo lectura. Lo podés apagar o borrar cuando quieras, pero no editarlo: lo que ves es lo que está publicado.',
  ],
} as const;

// ───────────────────────────────────────────────────────────────────────────
// Los cuatro caminos
// ───────────────────────────────────────────────────────────────────────────

/**
 * Un registro y no un array: `Record<IdCamino, Camino>` hace que **agregar un
 * camino al tipo sin escribir su contenido no compile**. Es la mitad barata de
 * «ningún camino sin instrucciones»; la otra mitad —que las instrucciones estén
 * de verdad, y que la página los muestre a todos— la sostiene el test.
 */
export const CAMINOS: Record<IdCamino, Camino> = {
  google: {
    id: 'google',
    titulo: 'Google Calendar',
    paraQuien: 'Si usás Gmail o un teléfono Android, tu calendario es este.',
    accion: {
      texto: 'Agregar a mi Google Calendar',
      url: urlParaSuscribirseEnGoogle(),
      avisoLector: 'se abre Google Calendar en una pestaña nueva',
      nuevaPestana: true,
    },
    pasos: [
      'Tocá el botón. Google Calendar te va a preguntar si querés agregar este calendario.',
      'Confirmá con «Agregar».',
      'Listo. Queda en tu lista de «Otros calendarios», y desde ahí lo podés apagar cuando no lo quieras ver, sin perder la suscripción.',
    ],
    siSaleMal:
      'Desde la aplicación del teléfono no se puede agregar un calendario: hacelo una vez desde el navegador y en el teléfono aparece solo. Si tenés más de una cuenta de Google abierta, mirá arriba a la derecha en cuál lo estás agregando.',
  },

  apple: {
    id: 'apple',
    titulo: 'iPhone, iPad y Mac',
    paraQuien: 'La aplicación Calendario que ya viene en el dispositivo.',
    accion: {
      texto: 'Suscribirme en la aplicación Calendario',
      url: urlWebcal(),
      // El único caso que no es «una pestaña más»: el botón sale del navegador.
      // Sin este aviso, quien escucha la página no tiene forma de anticiparlo.
      avisoLector:
        'sale del navegador y abre la aplicación Calendario del dispositivo',
      nuevaPestana: false,
    },
    pasos: [
      'Tocá el botón. El navegador va a pedirte permiso para abrir la aplicación Calendario: aceptá.',
      'Calendario pregunta si querés suscribirte. Confirmá con «Suscribirse».',
      'En la Mac, además, te deja elegir cada cuánto se actualiza: con «Cada hora» alcanza y sobra.',
    ],
    siSaleMal:
      'Si en lugar de abrirse la aplicación se te descargó un archivo, no lo abras. Un archivo te copia las fechas de hoy una sola vez y después queda viejo para siempre. Volvé a esta página y usá el botón.',
  },

  otros: {
    id: 'otros',
    titulo: 'Outlook, Thunderbird y el resto',
    paraQuien: 'Cualquier calendario que sepa suscribirse a una dirección de internet.',
    accion: {
      /*
       * Esta acción **no** es un botón que lleva a ningún lado, y es a
       * propósito: abrir la dirección en el navegador descarga un archivo, y
       * ese archivo es justo lo que el paso de más abajo pide no usar —copia
       * las fechas de hoy y no vuelve a mirar—. Ofrecer el link sería poner el
       * error a un toque de distancia. Lo que hace falta es la dirección
       * escrita, para copiarla.
       */
      texto: 'La dirección para pegar en el otro programa',
      url: urlDelIcs(),
      avisoLector:
        'es la dirección pública del calendario; se copia y se pega en el otro programa, no hace falta abrirla acá',
      nuevaPestana: false,
      seCopia: true,
    },
    pasos: [
      'Copiá la dirección de acá arriba.',
      'En Outlook desde el navegador: «Calendario», después «Agregar calendario», después «Suscribirse desde la web». Pegá la dirección y confirmá.',
      'En Thunderbird: «Calendario nuevo», después «En la red», formato «iCalendar (ICS)». Pegá la dirección.',
      'En cualquier otro programa: buscá la opción que diga «suscribirse por dirección» o «por URL».',
    ],
    siSaleMal:
      'Elegí siempre «suscribirse», nunca «importar un archivo». Importar te copia las fechas de hoy y no vuelve a mirar nunca más: dos meses después tu calendario te muestra encuentros que ya se movieron de día.',
  },

  mirar: {
    id: 'mirar',
    titulo: 'Solo mirarlo',
    paraQuien: 'Si no querés sumarlo a tu calendario y solo querés ver qué hay.',
    accion: {
      texto: 'Abrir el calendario',
      url: urlDelCalendario(),
      avisoLector: 'se abre el calendario en una pestaña nueva',
      nuevaPestana: true,
    },
    pasos: [
      'Se abre en una pestaña, con el horario de Buenos Aires.',
      'No hace falta tener cuenta ni instalar nada.',
      'Eso sí: mirar no es suscribirse. Los cambios no te van a llegar a ningún lado, tenés que volver a mirar.',
    ],
  },
};

/**
 * El orden en que se muestran. Va aparte del registro porque el orden es una
 * decisión —primero el camino de la mayoría, último el que no es suscribirse—
 * y porque así el test puede exigir que la página los muestre **a todos**: un
 * camino escrito que no está en esta lista es un camino que nadie ve.
 */
export const ORDEN_CAMINOS: readonly IdCamino[] = ['google', 'apple', 'otros', 'mirar'];

export const caminosEnOrden = (): Camino[] => ORDEN_CAMINOS.map((id) => CAMINOS[id]);

// ───────────────────────────────────────────────────────────────────────────
// Lo que el calendario no hace
// ───────────────────────────────────────────────────────────────────────────

/**
 * Las tres sorpresas. Están en la página y no en una nota al pie porque las
 * tres se descubren tarde: cuando el cupo ya se llenó, cuando falta el link
 * cinco minutos antes, o cuando el encuentro se esfumó de la pantalla.
 */
export const ADVERTENCIAS: Record<IdAdvertencia, Advertencia> = {
  inscripcion: {
    id: 'inscripcion',
    titulo: 'No te inscribe',
    texto:
      'Tener el encuentro en tu calendario no te reserva el lugar. Cada actividad se anota por su propio canal —un mail, un mensaje, un formulario— y muchas tienen cupo. Cómo inscribirse está en la página de cada actividad.',
  },
  reunion: {
    id: 'reunion',
    /*
     * Dice «casi nunca» y no «nunca» porque el evento **sí** lleva el link
     * cuando quien organiza eligió publicarlo, actividad por actividad. Es raro
     * y es deliberado —el valor de fábrica es no publicarlo— pero pasa, y una
     * advertencia que promete «nunca» miente el día que pasa.
     */
    titulo: 'Casi nunca trae el link de la reunión',
    texto:
      'Los encuentros virtuales dicen en qué plataforma son, no el link para entrar. Este calendario lo puede leer cualquiera, y un link de reunión a la vista termina con gente que nadie invitó adentro del encuentro: te lo pasa quien organiza cuando te inscribís. Alguna actividad abierta lo publica igual, a propósito, y en ese caso lo vas a ver en el evento.',
  },
  cancelada: {
    id: 'cancelada',
    titulo: 'Si algo se cancela, desaparece',
    texto:
      'Un encuentro cancelado no queda tachado ni con un cartel: se borra de tu calendario. La primera vez sorprende. Es a propósito: el calendario muestra siempre lo que sigue en pie, y una actividad cancelada que queda a la vista hace que alguien se presente igual.',
  },
};

export const ORDEN_ADVERTENCIAS: readonly IdAdvertencia[] = [
  'inscripcion',
  'reunion',
  'cancelada',
];

export const advertenciasEnOrden = (): Advertencia[] =>
  ORDEN_ADVERTENCIAS.map((id) => ADVERTENCIAS[id]);

// ───────────────────────────────────────────────────────────────────────────
// Dónde seguir el proyecto
// ───────────────────────────────────────────────────────────────────────────

export const DONDE_SEGUIR = {
  titulo: 'Dónde seguir la agenda',
  texto:
    'Las actividades nuevas y los cambios de último momento también se cuentan en Instagram. El calendario avisa cuándo y dónde; ahí se cuenta el resto.',
  accion: {
    texto: 'Seguir en Instagram',
    url: urlDeInstagram(),
    avisoLector: 'se abre Instagram en una pestaña nueva',
    nuevaPestana: true,
  } satisfies Accion,
};

// ───────────────────────────────────────────────────────────────────────────
// Barridos para los tests
// ───────────────────────────────────────────────────────────────────────────

/**
 * **Todas** las acciones que la página ofrece, de una.
 *
 * Es lo que permite afirmar propiedades transversales —ninguna URL escrita a
 * mano, ninguna sin aviso para el lector de pantalla, ninguna que sea la
 * variante privada— sin repetir la lista en cada afirmación. Mismo patrón que
 * el `TODAS()` de `tests/enlaces.test.ts`, y por el mismo motivo: una lista que
 * se olvida de una salida da falsa cobertura.
 *
 * Vive en el módulo y no en el test para que **crezca con el contenido**: una
 * acción nueva en un camino nuevo entra sola.
 */
export const accionesDelContenido = (): Accion[] => [
  ...caminosEnOrden().map((c) => c.accion),
  DONDE_SEGUIR.accion,
];

/**
 * Todo el texto que la página muestra, concatenado. Lo usa el test de tono: es
 * la única forma de verificar que no se coló jerga en una frase que se agregó
 * hoy en un rincón.
 */
export const textoDelContenido = (): string =>
  [
    COMO_FUNCIONA.titulo,
    COMO_FUNCIONA.entrada,
    ...COMO_FUNCIONA.puntos,
    ...caminosEnOrden().flatMap((c) => [
      c.titulo,
      c.paraQuien,
      c.accion.texto,
      c.accion.avisoLector,
      ...c.pasos,
      c.siSaleMal ?? '',
    ]),
    ...advertenciasEnOrden().flatMap((a) => [a.titulo, a.texto]),
    DONDE_SEGUIR.titulo,
    DONDE_SEGUIR.texto,
    DONDE_SEGUIR.accion.texto,
    DONDE_SEGUIR.accion.avisoLector,
  ].join('\n');
