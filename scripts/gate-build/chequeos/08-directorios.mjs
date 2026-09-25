/**
 * Pasos 8i a 8l del gate (B-901, B-832, B-833, B-960).
 */
import {
  CENTINELA,
  LAT_DE_LA_CASA,
  SLUG_BIBLIOTECA,
  SLUG_BIBLIOTECA_PENDIENTE,
  SLUG_LIBRERIA,
  SLUG_LIBRERIA_PENDIENTE,
  SLUG_LUGAR,
  SLUG_LUGAR_CASA,
  SLUG_LUGAR_PENDIENTE,
  SLUG_SUSCRIPCION,
  SLUG_SUSCRIPCION_PENDIENTE,
} from '../semilla.mjs';
import { datoConFecha, etiquetaCon, verificarDirectorio } from '../directorio.mjs';

export const nombre = "los cuatro directorios de la Guía";

/** @param {import('../chequeos.mjs').Contexto} ctx */
export const chequear = async (ctx) => {
  /*
   * 8i-8l · **Los cuatro directorios de la Guía, sobre los archivos
   * construidos** — B-901, B-832, B-833, B-960.
   *
   * (El primero se llama **8i** y no 8h porque el rótulo estaba tomado: el
   * «control de la mayoría» de la galería es el 8h, y `docs/13-agentes.md` cita
   * «los pasos 8a-8h» contando aquél.)
   *
   * Lo que estos pasos pueden ver y ningún unitario puede: que la **lectura**
   * trajo solo lo publicado y que el **build** escribió la ficha. El barrido de
   * vitest mira la proyección pura —qué se decide publicar— y no puede saber si
   * `getStaticPaths` generó la página ni si la query pidió de más. La pendiente
   * es el control: con una sola ficha sembrada, un build que leyera la colección
   * entera daría exactamente el mismo `dist/`.
   *
   * Desde B-1760 (corte 2 de D-1070) el esqueleto común vive una sola vez, en
   * `scripts/gate-build/directorio.mjs`; acá queda lo que cada colección tiene
   * de propio, que es lo que vale la pena leer.
   */
  /** Los cuatro mensajes que las cuatro colecciones dicen igual. */
  const mensajesDeFicha = (coleccion, laPendiente) => ({
    sinFicha: (slug) =>
      `no se generó la página /guia/${coleccion}/${slug}/.\n` +
      '  El listado la linkea igual: sin la página, cada fila del directorio es un 404.',
    fichaPendiente: (slug) =>
      `se generó la página de ${laPendiente} que ESPERA DECISIÓN\n` +
      `  (/guia/${coleccion}/${slug}/). Es HTML indexable con el\n` +
      '  contenido de una ficha que nadie aprobó.',
    sinSitemap: (slug) =>
      `la ficha /guia/${coleccion}/${slug}/ no está en el sitemap.xml.\n` +
      '  Existe, se navega, y el buscador no la conoce (§6 #7 del inventario de PRDs).',
    pendienteEnElSitemap:
      `el sitemap.xml ofrece la ficha de ${laPendiente} que espera decisión: es una URL\n` +
      '  que contesta 404 y que además no tendría que existir.',
  });

  // 8i · B-901 — las librerías. Lo propio es poco: el `BookStore`.
  await verificarDirectorio(ctx, {
    coleccion: 'librerias',
    indice: 'librerias.json',
    publicadas: [SLUG_LIBRERIA],
    pendiente: SLUG_LIBRERIA_PENDIENTE,
    tipoLd: '"@type":"BookStore"',
    mensajes: {
      ...mensajesDeFicha('librerias', 'la librería'),
      sinLeer: (n) =>
        `dist/librerias.json salió con ${n} librerías y ninguna es la\n` +
        '  sembrada. El build no leyó /librerias, así que todo lo que sigue no prueba nada.',
      pendienteEnElIndice:
        'dist/librerias.json trae la librería que ESPERA DECISIÓN.\n' +
        "  Falta o está mal el where('estado','==','publicado') de libreriasPublicadas\n" +
        '  (src/lib/contenidoDelSitio.ts). Y lo que se publica con ella es el\n' +
        '  contactoDeQuienCargo de quien pidió el alta (B-903).',
      sinLd:
        'la ficha de la librería no emite el JSON-LD `BookStore`.\n' +
        '  Es el SEO de esta sección entera (§ 4 del PRD 2): sin el marcado, la ficha\n' +
        '  es una página más y no entra al panel local de Google.',
    },
    exito: () =>
      'el directorio de librerías salió con la publicada y sin la que espera decisión ' +
      '(B-903), con su ficha, su BookStore y su entrada de sitemap.',
  });

  /*
   * 8j · B-832 — las suscripciones, y **una cosa que ninguna otra tiene: el
   * precio**. DEC-12 dice que el monto no se muestra nunca sin su fecha de
   * carga, y esa garantía la da la forma —`fraseDePrecio` devuelve un solo
   * string— pero eso lo verifica un unitario sobre la función pura. Acá se
   * verifica sobre **lo que quedó escrito en el `dist/`**.
   */
  await verificarDirectorio(ctx, {
    coleccion: 'suscripciones',
    indice: 'suscripciones.json',
    publicadas: [SLUG_SUSCRIPCION],
    pendiente: SLUG_SUSCRIPCION_PENDIENTE,
    tipoLd: '"@type":"Product"',
    /*
     * 8j.4 · **DEC-12 — el precio en el marcado.** El § 5 del PRD lo deja
     * afuera a propósito: Google **muestra** el precio del `Offer` en el
     * resultado, y uno de tres meses se publica equivocado en el lugar de más
     * visibilidad y con la credibilidad de un dato estructurado.
     */
    ldSinPrecio: {
      patron: /"price"|"priceCurrency"|"priceSpecification"/,
      mensaje:
        'el JSON-LD de la suscripción publica el precio.\n' +
        '  El § 5 del PRD 3 lo deja afuera a propósito (DEC-12): Google lo muestra en\n' +
        '  el resultado de búsqueda, y un precio de tres meses se publica equivocado\n' +
        '  en el lugar de más visibilidad. En la página va, con su fecha al lado.',
    },
    verificarFicha: async (c, { html }) => {
      /*
       * 8j.4b · **El `rel` del link de cobro, y las dos mitades de B-786.**
       *
       * Lo pidió el `auditor-privacidad`: el criterio 8 del PRD 3 y el § 7.2
       * —que es una decisión **discriminada**— vivían solo en un comentario del
       * `.astro`, así que nada se ponía rojo si alguien sacaba el `noreferrer`
       * del link de cobro **ni** si lo aplicaba parejo a todo link externo, que
       * **revierte B-786 sin decirlo**.
       */
      const accion = etiquetaCon(html, 'https://example.invalid/gate-cobro');
      if (!accion || !accion.includes('noopener') || !accion.includes('noreferrer')) {
        c.fallo(
          'el link de cobro de la suscripción no sale con `rel="noopener noreferrer"`.\n' +
            '  Sin `noopener`, la página de destino puede tocar la nuestra; sin `noreferrer`\n' +
            '  le mandamos nuestro dominio de referencia a la página de cobro de un tercero\n' +
            '  (§ 7.2 del PRD 3, criterio 8).',
        );
      }
      const mail = etiquetaCon(html, 'mailto:gate-sus@example.invalid');
      if (mail && mail.includes('noreferrer')) {
        c.fallo(
          'un contacto de la ficha salió con `noreferrer`, y eso revierte B-786 sin decirlo.\n' +
            '  El `noreferrer` es **del link de cobro y de ninguno más**: aplicarlo parejo a\n' +
            '  todo link externo borraría la señal de que un aporte vino del sitio, que es\n' +
            '  justo lo que B-786 decidió conservar.',
        );
      }
      // Y la ficha enlaza la librería que la ofrece, que es lo que confirma
      // que el build resolvió la lista y no linkeó a ciegas.
      if (!html.includes(`/guia/librerias/${SLUG_LIBRERIA}/`)) {
        c.fallo(
          'la ficha de la suscripción no enlaza la librería publicada que la ofrece.\n' +
            '  O el build no resolvió la lista de librerías, o la está linkeando a ciegas.',
        );
      }
    },
    /*
     * 8j.6 · **DEC-12 sobre el `dist/` entero: el monto no aparece nunca solo.**
     *
     * Es el ítem de este paso que no tiene equivalente en ningún unitario: cada
     * aparición del monto del gate en cualquier archivo publicado tiene que
     * traer «cargado el» pegado. Es el modo de falla que D-570 anticipa y que
     * una función pura no puede impedir: que alguien, en una plantilla o en una
     * island, arme la frase por su cuenta y pinte el número solo «porque en la
     * tarjeta angosta no entra la fecha».
     */
    extras: async (c) => {
      const monto = (18246813).toLocaleString('es-AR');
      const { huerfanos, con } = datoConFecha(await c.publicables(), monto);
      if (huerfanos.length > 0) {
        c.fallo(
          'el precio de una suscripción salió publicado SIN su fecha de carga al lado.\n' +
            '  Es DEC-12: un precio de hace tres meses en este país ya no es cierto, y la\n' +
            '  fecha es lo único que deja que quien lee decida si le cree. La proyección\n' +
            '  devuelve UNA frase con las dos cosas; si acá aparece el número solo, alguien\n' +
            '  la rearmó en una plantilla o en una island.\n' +
            `  Archivos:\n${huerfanos.join('\n')}`,
        );
      }
      // Y el control positivo: el monto **tiene** que aparecer en alguna parte.
      // Sin esto, el barrido de arriba pasa en verde si el precio dejó de
      // publicarse — que es el otro error, y también en silencio.
      const apariciones = con.filter((r) => /\.(html|json)$/.test(r)).length;
      if (apariciones === 0) {
        c.fallo(
          'el precio de la suscripción sembrada no aparece en ningún archivo del dist/.\n' +
            '  O dejó de publicarse, o el barrido de arriba no estaba mirando nada.',
        );
      }
      return { apariciones };
    },
    mensajes: {
      ...mensajesDeFicha('suscripciones', 'la suscripción'),
      sinLeer: (n) =>
        `dist/suscripciones.json salió con ${n} suscripciones y ninguna es la\n` +
        '  sembrada. El build no leyó /suscripciones, así que nada de lo que sigue prueba nada.',
      pendienteEnElIndice:
        'dist/suscripciones.json trae la suscripción que ESPERA DECISIÓN.\n' +
        "  Falta o está mal el where('estado','==','publicado') de suscripcionesPublicadas\n" +
        '  (src/lib/contenidoDelSitio.ts). Y con ella se publica el contactoDeQuienCargo\n' +
        '  de quien pidió el alta, y el precio crudo.',
      sinLd:
        'la ficha de la suscripción no emite el JSON-LD `Product`.\n' +
        '  Es el SEO de esta sección entera (§ 5 del PRD 3).',
    },
    exito: ({ apariciones }) =>
      'el directorio de suscripciones salió con la publicada y sin la que espera ' +
      `decisión, con su ficha, su Product sin precio, su entrada de sitemap y el ` +
      `monto siempre con su fecha (${apariciones} archivos).`,
  });

  /*
   * 8k · B-833 — los lugares, y **una cosa que ninguna otra colección tiene:
   * una ausencia condicional**. La casa del gate está publicada —su ficha se
   * genera, su página se indexa— y su dirección no puede estar en ningún
   * archivo. Eso lo verifica el barrido del paso 9 sin cláusula especial (el
   * centinela no está en ninguna canasta); acá se verifica la otra mitad, que es
   * la que un barrido de ausencias no puede dar: **que la ficha de la casa
   * exista de verdad**. Sin ella, el paso 9 pasaría en verde por no haber
   * mirado nada.
   */
  await verificarDirectorio(ctx, {
    coleccion: 'lugares',
    indice: 'lugares.json',
    publicadas: [SLUG_LUGAR, SLUG_LUGAR_CASA],
    pendiente: SLUG_LUGAR_PENDIENTE,
    tipoLd: '"@type":"Place"',
    /*
     * 8k.4 · **§ 7 — la condición no es un rango de precios.** El precio queda
     * afuera del marcado por lo mismo que el `Offer` de una suscripción: un
     * número que envejece publicado como dato estructurado es información
     * equivocada en el lugar de más visibilidad.
     */
    ldSinPrecio: {
      patron: /"priceRange"|"price"|"offers"/,
      mensaje:
        'el JSON-LD del lugar publica un precio o un rango de precios.\n' +
        '  El § 7 del PRD 4 lo deja afuera a propósito: la condición no es un rango\n' +
        '  de precios, y un número que envejece publicado como dato estructurado es\n' +
        '  información equivocada donde más se ve.',
    },
    verificarFicha: async (c, { slug, html, ld }) => {
      // Y el control positivo del marcado: la capacidad sí está.
      if (!ld.includes('"maximumAttendeeCapacity"')) {
        c.fallo(
          'el JSON-LD del lugar no publica la capacidad.\n' +
            '  Es el dato que hace que el marcado diga algo más que el nombre (§ 7).',
        );
      }
      if (slug !== SLUG_LUGAR_CASA) return;
      /*
       * 8k.5 · ⚠️ **La casa: su ficha EXISTE y su dirección NO está.**
       *
       * Las dos mitades van juntas y ninguna sirve sola. Que la dirección no
       * aparezca lo verifica el paso 9 en todo el `dist/`; lo que no puede ver es
       * si eso pasó porque la proyección la frenó o porque la página nunca se
       * generó. Esta mitad es la que distingue las dos cosas.
       */
      if (html.includes(CENTINELA.lugarDireccionDeCasa)) {
        c.fallo(
          'LA FICHA DE LA CASA PUBLICA SU DIRECCIÓN.\n' +
            '  Es el § 6 del PRD 4: `direccionPublica` está en `false` y la dirección salió\n' +
            '  igual. Lo que se publicó es el dato con el que se llega a la puerta de\n' +
            '  alguien, cargado por alguien que puede no vivir ahí.',
        );
      }
      // Y su JSON-LD no puede llevar `address` ni `geo` — criterio 5 del PRD,
      // el camino que se filtra sin que nadie lo vea.
      if (/"address"|"geo"/.test(ld)) {
        c.fallo(
          'el JSON-LD de la casa publica `address` o `geo`.\n' +
            '  Criterio 5 del PRD 4: «`direccion` ausente de la ficha implica ausente del\n' +
            '  JSON-LD». Es el camino que se filtra sin que nadie lo note, porque nadie lee\n' +
            '  el JSON-LD al revisar una ficha. Y unas coordenadas son la dirección con otro\n' +
            '  formato.',
        );
      }
      // Control positivo: el barrio **sí** está. Es el «más o menos por Villa
      // Crespo» que el § 6 deja publicar, y sin él este bloque estaría
      // afirmando ausencias sobre una página vacía.
      if (!html.includes('gate-barrio') && !html.includes('Gate lugar casa')) {
        c.fallo(
          'la ficha de la casa salió sin barrio y sin nombre: está vacía, así que las\n' +
            '  ausencias de arriba no prueban nada.',
        );
      }
    },
    /*
     * 8k.7 · ⚠️ **La `geo` de la casa tampoco está, y se busca por valor.**
     *
     * Lo pidió el `auditor-privacidad`: el barrido del paso 9 mira strings
     * centinela, y una coordenada es un número. Sin este chequeo, una fuga de la
     * `geo` de una casa al índice —el archivo que baja todo el mundo— pasaría el
     * gate entero. Se barre **todo** el `dist/` y no solo el índice, por lo
     * mismo que el barrido del monto: una plantilla puede escribirla en
     * cualquier parte.
     */
    extras: async (c, { crudo }) => {
      const conLaGeo = (await c.publicables())
        .filter(({ contenido }) => contenido.includes(String(LAT_DE_LA_CASA)))
        .map(({ relativa }) => `    ${relativa}`);
      if (conLaGeo.length > 0) {
        c.fallo(
          'LAS COORDENADAS DE LA CASA SE PUBLICARON.\n' +
            '  Es el § 6 del PRD 4: `direccionPublica` está en `false` y la `geo` salió igual.\n' +
            '  Unas coordenadas son la dirección con otro formato, y con un mapa al lado el\n' +
            '  «más o menos por Villa Crespo» deja de ser más o menos.\n' +
            `  Archivos:\n${conLaGeo.join('\n')}`,
        );
      }
      // Control positivo: la `geo` del local publicado **sí** aparece. Sin esto,
      // el barrido de arriba pasaría en verde el día que la proyección dejara de
      // publicar toda `geo` — que es el otro error, y también en silencio.
      if (!crudo.includes('-34.5875')) {
        c.fallo(
          'la `geo` del lugar publicado no aparece en dist/lugares.json.\n' +
            '  O dejó de publicarse, o el barrido de arriba no estaba mirando nada.',
        );
      }
      return {};
    },
    mensajes: {
      ...mensajesDeFicha('lugares', 'el lugar'),
      sinFicha: (slug) =>
        slug === SLUG_LUGAR_CASA
          ? `no se generó la página /guia/lugares/${slug}/ (la casa publicada).\n` +
            '  Sin ella, el barrido del paso 9 no prueba nada sobre la dirección de una casa:\n' +
            '  no hay página donde pudiera haberse filtrado (§ 6 del PRD 4).'
          : `no se generó la página /guia/lugares/${slug}/.\n` +
            '  El listado la linkea igual: sin la página, cada fila del directorio es un 404.',
      sinLeer: (n, slug) =>
        `dist/lugares.json salió con ${n} lugares y no está «${slug}».\n` +
        '  El build no leyó /lugares (o dejó una publicada afuera), así que nada de lo\n' +
        '  que sigue prueba nada — incluida la ausencia de la dirección de la casa.',
      pendienteEnElIndice:
        'dist/lugares.json trae el lugar que ESPERA DECISIÓN.\n' +
        "  Falta o está mal el where('estado','==','publicado') de lugaresPublicados\n" +
        '  (src/lib/contenidoDelSitio.ts). Y con él se publica el contactoDeQuienCargo\n' +
        '  de quien pidió el alta, y la dirección de un lugar que nadie aprobó.',
      sinLd:
        'la ficha del lugar no emite el JSON-LD `Place`.\n' +
        '  Es el SEO de esta sección entera (§ 7 del PRD 4).',
    },
    exito: () =>
      'el directorio de lugares salió con los dos publicados y sin el que espera ' +
      'decisión, con sus fichas, su Place sin precio, sus entradas de sitemap — y la ' +
      'casa publicada sin su dirección y sin sus coordenadas en ningún archivo (§ 6).',
  });

  /*
   * 8l · B-960 — las bibliotecas, que **entraron tarde**: el frente construyó la
   * sección entera y no tocó este archivo, así que hasta el pase de auditores
   * el gate no sembraba ninguna biblioteca y el paso 9 recorría sus archivos sin
   * un solo centinela que pudiera aparecer ahí. Verde por vacuidad.
   *
   * Lo propio es **el costo de asociarse**: un dato con fecha (D-570, B-837) que
   * tiene que salir como frase con su fecha pegada y nunca como número suelto
   * ni como `Offer` del JSON-LD, por el mismo motivo que el precio de una
   * suscripción (DEC-12).
   */
  await verificarDirectorio(ctx, {
    coleccion: 'bibliotecas',
    indice: 'bibliotecas.json',
    publicadas: [SLUG_BIBLIOTECA],
    pendiente: SLUG_BIBLIOTECA_PENDIENTE,
    tipoLd: '"@type":"Library"',
    // 8l.4 · El costo de asociarse no va al marcado (DEC-12, mismo argumento).
    ldSinPrecio: {
      patron: /"price"|"priceCurrency"|"priceRange"|"offers"/i,
      mensaje:
        'el JSON-LD de la biblioteca publica el costo de asociarse.\n' +
        '  Queda afuera a propósito, por el mismo motivo que el precio de una\n' +
        '  suscripción (DEC-12). En la página va, como frase y con su fecha.',
    },
    /*
     * 8l.5 · **El costo sale como frase con su fecha, nunca como número
     * suelto** — con ventana alrededor de **cada** aparición y sobre **todo** el
     * `dist/`. Preguntar si la ficha tiene «cargado el» en alguna parte da verde
     * aunque el monto esté suelto en otro lado de esa misma página: la primera
     * versión de este paso hacía justamente eso, un chequeo laxo con forma de
     * red.
     */
    extras: async (c) => {
      const { huerfanos, con } = datoConFecha(await c.publicables(), '$3.000');
      if (huerfanos.length > 0) {
        c.fallo(
          'el costo de asociarse a una biblioteca salió publicado SIN su fecha de carga.\n' +
            '  D-570 y B-837: un carnet de hace tres meses en este país ya no cuesta lo\n' +
            '  mismo, y la fecha es lo único que deja que quien lee decida si le cree. La\n' +
            '  proyección devuelve UNA frase con las dos cosas; si acá aparece el número\n' +
            '  solo, alguien la rearmó en una plantilla o en una island.\n' +
            `  Archivos:\n${huerfanos.join('\n')}`,
        );
      }
      // Y el control positivo: sin esto, el barrido de arriba pasa en verde el
      // día que el costo deje de publicarse, que es la otra mitad del error.
      if (con.length === 0) {
        c.fallo(
          'el costo de asociarse del gate no aparece en ningún archivo del dist/.\n' +
            '  O la ficha dejó de publicarlo, o cambió de forma: en los dos casos el\n' +
            '  chequeo de la fecha de arriba quedó sin nada que mirar.',
        );
      }
      return {};
    },
    mensajes: {
      ...mensajesDeFicha('bibliotecas', 'la biblioteca'),
      sinLeer: (n) =>
        `dist/bibliotecas.json salió con ${n} bibliotecas y ninguna es la\n` +
        '  sembrada. El build no leyó /bibliotecas, así que nada de lo que sigue prueba nada.',
      pendienteEnElIndice:
        'dist/bibliotecas.json trae la biblioteca que ESPERA DECISIÓN.\n' +
        "  Falta o está mal el where('estado','==','publicado') de bibliotecasPublicadas\n" +
        '  (src/lib/contenidoDelSitio.ts). Y con ella se publica el contactoDeQuienCargo\n' +
        '  de quien la cargó, que es un dato de una persona y no de la institución.',
      sinLd:
        'la ficha de la biblioteca no emite el JSON-LD `Library`.\n' +
        '  Es el SEO de esta sección entera.',
    },
    exito: () =>
      'el directorio de bibliotecas salió con la publicada y sin la que espera ' +
      'decisión, con su ficha, su Library sin el costo en el marcado, el costo con ' +
      'su fecha en la página y su entrada de sitemap.',
  });
};
