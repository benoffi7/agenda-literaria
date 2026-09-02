/**
 * La página de detalle: el view-model y sus datos estructurados — B-227.
 *
 * Lo que este archivo **no** cubre es la privacidad: eso es el barrido de
 * centinelas de `tests/barrido-de-salidas-publicas.test.ts`, que corre sobre esta
 * misma proyección. Acá están las instancias —el botón de cada vía, el JSON-LD,
 * los casos incómodos del §7— y allá está la clase.
 */
import { describe, expect, it } from 'vitest';
import {
  accionDeInscripcion,
  datosEstructurados,
  detalleDeActividad,
  handleInstagram,
  migasDeDetalle,
  urlSegura,
} from '@/lib/detallePublico';
import { mapaDeEtiquetas, type TonosDeTipo } from '@/lib/listadoPublico';
import { rutaDeTipo, urlAbsoluta, urlDeDetalle } from '@/lib/rutasPublicas';
import { toPublic } from '@/lib/toPublic';
import type { Actividad } from '@/types/actividad';
import { actividadDePrueba, type OpcionesDeEntrada } from './fixtures/indice';
import { ts } from './fixtures/tiempo';

const AHORA = new Date('2026-09-10T15:00:00Z');

const ETIQUETAS = mapaDeEtiquetas({
  tipo: [
    { slug: 'taller', label: 'Taller' },
    { slug: 'presentacion', label: 'Presentación' },
  ],
  barrio: [{ slug: 'villa-crespo', label: 'Villa Crespo' }],
  arancel: [
    { slug: 'gratis', label: 'Gratis' },
    { slug: 'a-la-gorra', label: 'A la gorra' },
  ],
  plataforma: [{ slug: 'meet', label: 'Google Meet' }],
  tags: [{ slug: 'cronica', label: 'Crónica' }],
});

/**
 * Los matices elegidos para los tipos (D-153). Vacío en casi todos los casos: el
 * color derivado del slug es el camino normal, y el mapa con algo adentro se
 * ejercita donde importa — `tests/color-de-tipo.test.ts`, que ata el color del
 * detalle con el del listado.
 */
const TONOS: TonosDeTipo = {};

const detalleDe = (o: OpcionesDeEntrada = {}, over: Partial<Actividad> = {}, ahora = AHORA) =>
  detalleDeActividad(
    toPublic({ ...actividadDePrueba(o), ...over }, o.id ?? 'act_1'),
    ETIQUETAS,
    ahora,
    TONOS,
  );

/**
 * El mismo detalle pero **con la actividad cancelada** — B-110.
 *
 * La bandera es el cuarto argumento y no un campo de la actividad: `estado` no se
 * proyecta, y el único que sabe de qué query salió cada documento es el lector
 * (`contenidoDelSitio.ts`). Ver `DetallePublico.cancelada`.
 */
const detalleCancelado = (
  o: OpcionesDeEntrada = {},
  over: Partial<Actividad> = {},
  ahora = AHORA,
) =>
  detalleDeActividad(
    toPublic({ ...actividadDePrueba(o), ...over }, o.id ?? 'act_1'),
    ETIQUETAS,
    ahora,
    TONOS,
    true,
  );

/**
 * El mismo detalle pero **con el hub de su tipo existiendo** — B-107.
 *
 * `tipoTieneHub` es el séptimo argumento, con default `false`: solo el lector
 * (`contenidoDelSitio.ts`) sabe si alguna otra actividad publicada comparte el
 * tipo, así que los tests que quieren la miga con sus tres niveles lo piden
 * explícito acá.
 */
const detalleConHub = (o: OpcionesDeEntrada = {}, over: Partial<Actividad> = {}, ahora = AHORA) =>
  detalleDeActividad(
    toPublic({ ...actividadDePrueba(o), ...over }, o.id ?? 'act_1'),
    ETIQUETAS,
    ahora,
    TONOS,
    false,
    {},
    true,
  );

// ───────────────────────────────────────────────────────────────────────────
// 1 · Saneamiento de lo que va a un href
// ───────────────────────────────────────────────────────────────────────────

describe('urlSegura — lo único que puede terminar en un href', () => {
  it.each(['javascript:alert(1)', 'JavaScript:alert(1)', 'data:text/html,<script>', 'vbscript:x'])(
    'rechaza %s',
    (peligrosa) => {
      /*
       * Es un XSS en una página pública: `organizador.web`,
       * `inscripcion.destino` con vía «formulario» y `material.items[].url` son
       * texto libre de un formulario, y Astro escapa el **contenido**, no el
       * esquema de un `href`.
       *
       * MUTACIÓN PROBADA: sacar el chequeo de `protocol` hace que los cuatro
       * pasen y que el `javascript:` llegue al HTML.
       */
      expect(urlSegura(peligrosa)).toBeNull();
    },
  );

  it('acepta http y https', () => {
    expect(urlSegura('https://casabrandon.com')).toBe('https://casabrandon.com/');
    expect(urlSegura('http://casabrandon.com')).toBe('http://casabrandon.com/');
  });

  it('sin esquema asume https, porque eso es lo que se tipea', () => {
    expect(urlSegura('casabrandon.com')).toBe('https://casabrandon.com/');
  });

  it('vacío o basura da null en vez de un link roto', () => {
    expect(urlSegura('')).toBeNull();
    expect(urlSegura('   ')).toBeNull();
    expect(urlSegura(null)).toBeNull();
  });
});

describe('handleInstagram', () => {
  it.each([
    ['@casabrandon', 'casabrandon'],
    ['casabrandon', 'casabrandon'],
    ['https://instagram.com/casabrandon', 'casabrandon'],
    ['https://www.instagram.com/casabrandon/', 'casabrandon'],
    ['casa.brandon_2', 'casa.brandon_2'],
  ])('%s → %s', (crudo, esperado) => {
    expect(handleInstagram(crudo)).toBe(esperado);
  });

  it('lo que no es un handle no se convierte en link', () => {
    // Un valor con barra armaría una URL a otra cuenta.
    expect(handleInstagram('casa/brandon')).toBeNull();
    expect(handleInstagram('a'.repeat(31))).toBeNull();
    expect(handleInstagram('')).toBeNull();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 2 · El botón de inscripción
// ───────────────────────────────────────────────────────────────────────────

describe('el CTA lleva el verbo de la vía real (§4.3)', () => {
  it('mail arma un mailto con asunto precargado', () => {
    const a = accionDeInscripcion('mail', 'hola@casabrandon.com', 'Taller de crónica');
    expect(a?.texto).toBe('Mandar un mail');
    expect(a?.href).toBe(
      'mailto:hola@casabrandon.com?subject=Inscripci%C3%B3n%3A%20Taller%20de%20cr%C3%B3nica',
    );
  });

  it('whatsapp arma un wa.me con los dígitos y el mensaje', () => {
    const a = accionDeInscripcion('whatsapp', '+54 9 11 5555-1234', 'Taller');
    expect(a?.texto).toBe('Escribir por WhatsApp');
    expect(a?.href).toContain('https://wa.me/5491155551234?text=');
    expect(decodeURIComponent(a!.href)).toContain('Hola, quiero anotarme en Taller');
  });

  it('dm lleva al perfil', () => {
    expect(accionDeInscripcion('dm', '@casabrandon', 'X')?.href).toBe(
      'https://instagram.com/casabrandon',
    );
  });

  it('formulario pasa por urlSegura', () => {
    expect(accionDeInscripcion('formulario', 'javascript:alert(1)', 'X')).toBeNull();
    expect(accionDeInscripcion('formulario', 'forms.gle/abc', 'X')?.href).toBe(
      'https://forms.gle/abc',
    );
  });

  it('un destino que no sirve para la vía no arma botón', () => {
    /*
     * Un botón que no lleva a ningún lado es peor que ninguno: la página cae a
     * mostrar el canal como texto, que es algo que una persona sí puede usar.
     */
    expect(accionDeInscripcion('mail', 'escribinos por insta', 'X')).toBeNull();
    expect(accionDeInscripcion('whatsapp', '1234', 'X')).toBeNull();
    expect(accionDeInscripcion(null, 'hola@x.com', 'X')).toBeNull();
    expect(accionDeInscripcion('mail', '', 'X')).toBeNull();
  });

  it('sin inscripción no hay acción, aunque haya destino', () => {
    const d = detalleDe({ requiereInscripcion: false });
    expect(d.inscripcion.accion).toBeNull();
    expect(d.inscripcion.requiere).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 3 · Los casos incómodos del §7
// ───────────────────────────────────────────────────────────────────────────

describe('el estado de la actividad se decide con el reloj del build', () => {
  it('con todo pasado, la página lo dice y no queda CTA', () => {
    // §7.1 — el CTA se decide **por fecha** y no por `abierta`: sin fecha de
    // cierre, `abierta` queda true para siempre y mostraría «Anotate» en un
    // taller de hace un año.
    const d = detalleDe({ fechas: ['2026-01-10T22:00:00Z'], cierra: null });
    expect(d.yaPaso).toBe(true);
    expect(d.proxima).toBeNull();
  });

  it('un ciclo empezado dice que empezó, y muestra la próxima', () => {
    const d = detalleDe({
      esCiclo: true,
      fechas: ['2026-09-03T22:00:00Z', '2026-09-17T22:00:00Z', '2026-09-24T22:00:00Z'],
    });
    expect(d.yaEmpezo).toBe(true);
    expect(d.yaPaso).toBe(false);
    expect(d.proxima?.fecha).toBe('jueves 17 de septiembre');
    expect(d.proxima?.desde).toBe('19:00');
    expect(d.proxima?.hasta).toBe('21:00');
  });

  it('los encuentros se numeran sobre TODOS, cancelados incluidos (D-95)', () => {
    /*
     * La misma regla que el evento de Calendar: el número es la identidad del
     * encuentro dentro del ciclo, no un recuento en vivo. Numerar sobre los no
     * cancelados convierte al cuarto en «3» al cancelar el segundo, y la página
     * y el calendario dirían números distintos del mismo encuentro (B-84).
     */
    const d = detalleDe({
      esCiclo: true,
      fechas: ['2026-09-03T22:00:00Z', '2026-09-10T22:00:00Z', '2026-09-17T22:00:00Z'],
      canceladas: [1],
    });
    expect(d.encuentros.map((e) => [e.numero, e.cancelada])).toEqual([
      [1, false],
      [2, true],
      [3, false],
    ]);
  });

  it('el rótulo del ciclo cuenta los que quedan en pie, no los cancelados', () => {
    const d = detalleDe({
      esCiclo: true,
      fechas: ['2026-09-03T22:00:00Z', '2026-09-10T22:00:00Z', '2026-09-17T22:00:00Z'],
      canceladas: [1],
    });
    expect(d.rotuloCiclo).toBe('Ciclo de 2 encuentros · 3 sep – 17 sep');
  });

  it('un `esCiclo` con una sola fecha dice «1 encuentro», no «Ciclo de 1» (§7.5)', () => {
    const d = detalleDe({ esCiclo: true, fechas: ['2026-09-17T22:00:00Z'] });
    expect(d.rotuloCiclo).toBe('1 encuentro');
  });

  it('tres fechas sin `esCiclo` se muestran igual, sin llamarlo ciclo (§7.5)', () => {
    // El flag manda para el vocabulario; los datos, para las fechas.
    const d = detalleDe({
      esCiclo: false,
      fechas: ['2026-09-17T22:00:00Z', '2026-09-24T22:00:00Z', '2026-10-01T22:00:00Z'],
    });
    expect(d.rotuloCiclo).toBe('3 encuentros · 17 sep – 1 oct');
    expect(d.encuentros).toHaveLength(3);
  });

  it('las sesiones se ordenan por fecha aunque vengan desordenadas', () => {
    const d = detalleDe({ fechas: ['2026-10-01T22:00:00Z', '2026-09-17T22:00:00Z'] });
    expect(d.encuentros.map((e) => e.numero)).toEqual([1, 2]);
    expect(d.encuentros[0]!.fecha).toContain('17 de septiembre');
  });
});

describe('cuándo se lista el bloque de encuentros', () => {
  /**
   * El caso lo encontró **el HTML de verdad**, no un test: mirando la página que
   * salió del build contra el emulador, el `tema` de una actividad de una sola
   * fecha no aparecía por ningún lado. Con la condición ingenua (`length > 1`) el
   * bloque no se pinta, y la ficha no muestra el tema — así que la página pública
   * decía **menos** que el evento de Calendar del mismo encuentro, que lo lleva
   * en el `summary`.
   */
  it('con varias fechas, siempre', () => {
    expect(detalleDe({ fechas: ['2026-09-17T22:00:00Z', '2026-09-24T22:00:00Z'] }).mostrarEncuentros).toBe(
      true,
    );
  });

  it('con una sola fecha pelada, no: la ficha ya la dice', () => {
    // El fixture pone `Tema N` en cada sesión, así que hay que sacarlo para ver
    // el caso «no hay nada más que la fecha».
    const d = detalleDeActividad(
      toPublic(
        {
          ...actividadDePrueba({ fechas: ['2026-09-17T22:00:00Z'] }),
          sesiones: [
            {
              id: 'ses_0',
              inicio: ts('2026-09-17T22:00:00Z'),
              fin: ts('2026-09-18T00:00:00Z'),
              tema: null,
              lectura: null,
              cancelada: false,
              calendarEventId: null,
            },
          ],
        },
        'act_pelada',
      ),
      ETIQUETAS,
      AHORA,
      TONOS,
    );
    expect(d.mostrarEncuentros).toBe(false);
  });

  it('con una sola fecha PERO con tema, sí — es el caso que se perdía', () => {
    const d = detalleDe({ fechas: ['2026-09-17T22:00:00Z'] });
    expect(d.encuentros[0]!.tema).toBe('Tema 1');
    expect(d.mostrarEncuentros).toBe(true);
  });

  it('y una sola fecha cancelada también, porque eso hay que decirlo', () => {
    const d = detalleDe({ fechas: ['2026-09-17T22:00:00Z'], canceladas: [0] });
    expect(d.mostrarEncuentros).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// El aviso de arriba: una prioridad, no un formato — B-253, B-254
// ───────────────────────────────────────────────────────────────────────────

describe('el aviso que la página muestra antes de nada', () => {
  /**
   * Quien llega de un link de hace tres meses tiene que enterarse **antes de leer
   * nada** (§7.1). Cuatro estados pueden valer a la vez, así que lo que se
   * verifica acá es el **orden**, que es la parte que una plantilla encadenando
   * `&&` decide sin querer y distinto cada vez que alguien la edita.
   */
  it('sin nada que avisar, no hay aviso', () => {
    // Control positivo: si esto devolviera siempre algo, los casos de abajo
    // pasarían por el motivo equivocado.
    const d = detalleDe({ fechas: ['2026-09-24T22:00:00Z'] });
    expect(d.aviso).toBeNull();
  });

  it('con todo cancelado dice que se canceló, y NO que ya pasó — B-254', () => {
    /*
     * **El bug que este cambio arregla.** Sin ningún encuentro en pie no hay
     * próximo, así que `yaPaso` da `true` y la página decía «Esta actividad ya
     * pasó» — falso, y de la peor manera: quien pregunta «¿se hace?» se va
     * creyendo que llegó tarde a algo que no se hizo, con la fecha del mes que
     * viene escrita más abajo en la misma pantalla.
     *
     * La fecha es **futura** a propósito: es lo que separa este caso del de una
     * actividad que efectivamente terminó.
     *
     * MUTACIÓN PROBADA: reemplazar la condición de `todoCancelado` por `false`
     * hace que este caso caiga en `pasado` y el test lo dice; pedirle
     * `vivos.length === 0` sin el `encuentros.length > 0` hace fallar el caso de
     * abajo, el de la actividad sin fechas.
     */
    const d = detalleDe({
      fechas: ['2026-10-01T22:00:00Z', '2026-10-08T22:00:00Z'],
      canceladas: [0, 1],
    });
    expect(d.yaPaso, 'sigue sin haber próximo encuentro').toBe(true);
    expect(d.aviso?.tono).toBe('cancelado');
    expect(d.aviso?.texto).toContain('cancelaron');
  });

  it('con todo pasado dice que pasó', () => {
    const d = detalleDe({ fechas: ['2026-01-10T22:00:00Z'], cierra: null });
    expect(d.aviso?.tono).toBe('pasado');
  });

  it('sin ninguna fecha no afirma nada: ni que pasó ni que se canceló', () => {
    /*
     * Una actividad publicada sin encuentros deja `yaPaso` en `true` por el mismo
     * camino, y ahí «ya pasó» es tan falso como en el caso cancelado. La ficha
     * dice «Sin fechas por venir», que es lo único que se sabe.
     */
    const d = detalleDe({ fechas: [] });
    expect(d.yaPaso).toBe(true);
    expect(d.aviso).toBeNull();
  });

  it('la inscripción cerrada avisa con la fecha, si la hay', () => {
    const d = detalleDe({
      fechas: ['2026-10-01T22:00:00Z'],
      cierra: '2026-09-01T22:00:00Z',
    });
    expect(d.aviso?.tono).toBe('cerrado');
    expect(d.aviso?.texto).toContain(d.inscripcion.cierra!);
  });

  it('y esa fecha sale con precisión de día, nunca con la hora (D-138)', () => {
    /*
     * **Lo pidió el `auditor-privacidad`, y el hueco es estructural.** El aserto de
     * arriba compara el aviso **contra sí mismo**: fija que las dos superficies
     * —el aviso y la ficha— usan la misma cadena, no qué contiene esa cadena.
     *
     * Y el barrido de centinelas no puede cubrirlo: su recorrido saltea los
     * `Timestamp` a propósito («no tienen strings adentro»), así que **ninguna
     * fecha del proyecto tiene centinela** y la precisión temporal es el punto
     * ciego de todos los barridos. Es exactamente la clase de D-138 — `creadoEn`
     * pasaba las seis celdas y publicaba el milisegundo igual.
     *
     * Hoy no filtra nada. El modo de falla es de una línea: alguien le agrega la
     * hora a `fechaCompleta` porque «se ve mejor en la ficha», y el instante exacto
     * de cierre queda publicado en un HTML indexado sin que nada se ponga rojo.
     *
     * MUTACIÓN PROBADA: pasar `cierra` por `fechaLarga` + `hora` en vez de
     * `fechaCompleta` pone esto en rojo y deja verde todo lo demás.
     */
    const d = detalleDe({
      fechas: ['2026-10-01T22:00:00Z'],
      cierra: '2026-09-01T22:30:00Z',
    });
    expect(d.inscripcion.cierra).not.toMatch(/\d{1,2}:\d{2}/);
    expect(d.aviso?.texto).not.toMatch(/\d{1,2}:\d{2}/);
  });

  it('el cupo completo avisa, y no esconde el canal (D-127)', () => {
    const d = detalleDe({ fechas: ['2026-10-01T22:00:00Z'], completo: true });
    expect(d.aviso?.tono).toBe('completo');
    // La mitad que importa de D-127: el aviso no reemplaza al canal, va al lado.
    expect(d.inscripcion.destino).toBe('hola@casabrandon.com');
    expect(d.inscripcion.accion).not.toBeNull();
  });

  it('sin inscripción, ni «cerró» ni «completo» pueden aparecer', () => {
    // `completo` y `cierra` son campos del formulario y pueden quedar cargados de
    // antes; con `requiere: false` la página no puede anunciar que cerró algo que
    // no existe.
    const d = detalleDe({
      fechas: ['2026-10-01T22:00:00Z'],
      requiereInscripcion: false,
      completo: true,
      cierra: '2026-09-01T22:00:00Z',
    });
    expect(d.aviso).toBeNull();
  });

  it('el orden es del más irreversible al menos', () => {
    /*
     * Los cuatro estados a la vez. Es el caso que decide **cuál** se muestra, y
     * es la razón por la que esto vive en el view-model y no en la plantilla.
     *
     * MUTACIÓN PROBADA: mover el bloque de `cerrado` arriba del de `cancelado`
     * hace que esta actividad anuncie «las inscripciones cerraron» sobre una que
     * directamente no se hace.
     */
    const d = detalleDe({
      fechas: ['2026-01-10T22:00:00Z', '2026-01-17T22:00:00Z'],
      canceladas: [0, 1],
      cierra: '2026-01-01T22:00:00Z',
      completo: true,
    });
    expect(d.aviso?.tono).toBe('cancelado');
  });
});

describe('la actividad cancelada conserva su página — B-110, §7.3', () => {
  /**
   * El caso entero del §7.3, que el diseño llama «la decisión menos obvia del
   * documento»: la URL estuvo tres semanas en Instagram y en Google, se cancela,
   * y un 404 le contesta «no existe» a quien pregunta si se hace. Lo que este
   * bloque fija es qué dice la página en ese estado, campo por campo.
   *
   * Que la página **se genere** —o sea el lector, el «estuvo publicada alguna
   * vez» y que no entre a ninguna lista— lo cubre
   * `tests/sitio-publico.integracion.test.ts`, contra Firestore.
   */
  it('la franja lo dice, y con su propio texto: no es «se cancelaron los encuentros»', () => {
    /*
     * Las dos ramas comparten el tono y **no** el texto, y la diferencia importa:
     * «se cancelaron todos los encuentros» (B-254) deja abierta la idea de que la
     * actividad existe y se reprograma; «esta actividad se canceló» no.
     *
     * MUTACIÓN PROBADA: hacer que la rama de `cancelada` devuelva el mismo texto
     * que la de `todoCancelado` deja verde todo lo demás del archivo y pone rojo
     * este `it` — que es el único que distingue las dos respuestas.
     */
    const d = detalleCancelado({ fechas: ['2026-10-01T22:00:00Z'] });
    expect(d.cancelada).toBe(true);
    expect(d.aviso?.tono).toBe('cancelado');
    expect(d.aviso?.texto).toContain('Esta actividad se canceló');
    expect(d.aviso?.texto, 'no es el texto de B-254').not.toContain('encuentros');
  });

  it('gana a los otros cuatro avisos, incluido el de todos los encuentros cancelados', () => {
    /*
     * Una actividad cancelada puede además tener todos sus encuentros cancelados,
     * haber pasado y tener la inscripción cerrada. Los estados valen a la vez y
     * **se muestra uno**: apilar los cinco es la forma de que no se lea ninguno.
     *
     * MUTACIÓN PROBADA: mover el `if (cancelada)` debajo del `if (todoCancelado)`
     * hace que este caso conteste «se cancelaron todos los encuentros» —que es
     * cierto y no es la respuesta— y el `it` de arriba sigue verde, porque ahí los
     * encuentros no están cancelados.
     */
    const d = detalleCancelado({
      fechas: ['2026-01-10T22:00:00Z'],
      canceladas: [0],
      cierra: '2026-01-01T00:00:00Z',
    });
    expect(d.yaPaso, 'también pasó').toBe(true);
    expect(d.inscripcion.cerrada, 'y la inscripción cerró').toBe(true);
    expect(d.aviso?.texto).toContain('Esta actividad se canceló');
  });

  it('sin CTA: ni el botón ni el canal en texto', () => {
    /*
     * La segunda de las tres cosas que pide el §7.3, y son **dos** campos porque
     * son dos piezas de la pantalla: el botón de la ficha (que es también el de la
     * barra fija de móvil) y el «Para anotarte: …» que aparece cuando no se pudo
     * armar un link. Invitar a anotarse en algo que no se hace es la contradicción
     * que este ítem vino a cerrar.
     *
     * MUTACIÓN PROBADA: sacar el `&& !cancelada` de `mostrarAccion` deja pasar el
     * primer aserto; sacarlo de `mostrarCanal`, el segundo. Son dos mutaciones
     * distintas y este `it` agarra las dos.
     */
    const conBoton = detalleCancelado({ fechas: ['2026-10-01T22:00:00Z'] });
    expect(conBoton.inscripcion.accion, 'el link se arma igual').not.toBeNull();
    expect(conBoton.inscripcion.mostrarAccion, 'pero no se muestra').toBe(false);

    /*
     * Un destino que no sirve para la vía: no hay botón, y la página caía al canal
     * en texto. Con la actividad cancelada, tampoco.
     */
    const base = actividadDePrueba({ fechas: ['2026-10-01T22:00:00Z'] });
    const sinBoton = detalleCancelado({ fechas: ['2026-10-01T22:00:00Z'] }, {
      inscripcion: { ...base.inscripcion, destino: 'escribinos y te contamos' },
    });
    expect(sinBoton.inscripcion.accion).toBeNull();
    expect(sinBoton.inscripcion.mostrarCanal).toBe(false);

    // Control: la misma, sin cancelar, sí muestra el canal.
    const viva = detalleDe({ fechas: ['2026-10-01T22:00:00Z'] }, {
      inscripcion: { ...base.inscripcion, destino: 'escribinos y te contamos' },
    });
    expect(viva.inscripcion.mostrarCanal).toBe(true);
  });

  it('la ficha no dice «Abierta»: la fila de inscripción sale del view-model', () => {
    /*
     * Era un ternario de cuatro ramas en el `.astro`, o sea una regla de una
     * salida pública que vitest no podía evaluar. La quinta rama es la que lo
     * mudó: con la franja «Esta actividad se canceló» arriba, la ficha decía
     * «Abierta hasta el 28 de septiembre» tres centímetros más abajo.
     *
     * MUTACIÓN PROBADA: sacar la primera línea de `resumenDeInscripcion` devuelve
     * «Abierta hasta el …» y este `it` lo dice. El control de abajo es lo que
     * evita que la función pase devolviendo siempre lo mismo.
     */
    const cancelada = detalleCancelado({
      fechas: ['2026-10-01T22:00:00Z'],
      cierra: '2026-09-28T00:00:00Z',
    });
    expect(cancelada.inscripcion.resumen).toBe('La actividad se canceló');

    const viva = detalleDe({ fechas: ['2026-10-01T22:00:00Z'], cierra: '2026-09-28T00:00:00Z' });
    expect(viva.inscripcion.resumen).toContain('Abierta hasta el');
  });

  it('las fechas quedan intactas: son lo que hay que ver', () => {
    /*
     * §7.3, y no es un detalle: quien mira necesita ver **qué** fecha se cayó. Una
     * página cancelada sin fechas no contesta «¿era la del jueves?».
     */
    const d = detalleCancelado({ fechas: ['2026-10-01T22:00:00Z', '2026-10-08T22:00:00Z'] });
    expect(d.encuentros).toHaveLength(2);
    expect(d.encuentros.map((e) => e.fecha)).toEqual([
      'jueves 1 de octubre',
      'jueves 8 de octubre',
    ]);
    expect(d.proxima?.fecha).toBe('jueves 1 de octubre');
  });

  it('el JSON-LD va con EventCancelled, que es lo que Google pide', () => {
    /*
     * La tercera de las tres cosas del §7.3. Un 404 no le comunica nada a Google:
     * el resultado que ya tiene indexado se queda como está hasta que vuelva a
     * pasar. Con la página viva y el evento marcado, lo tacha.
     *
     * MUTACIÓN PROBADA: volver `eventStatus` a la constante `PROGRAMADO` deja en
     * verde los quince `it` del bloque del JSON-LD y pone rojo este.
     */
    const d = detalleCancelado({ fechas: ['2026-10-01T22:00:00Z'] });
    expect(datosEstructurados(d)!.eventStatus).toBe('https://schema.org/EventCancelled');

    const viva = detalleDe({ fechas: ['2026-10-01T22:00:00Z'] });
    expect(datosEstructurados(viva)!.eventStatus).toBe('https://schema.org/EventScheduled');
  });

  it('y sus subeventos también, aunque ninguna sesión tenga su propio flag', () => {
    /*
     * El caso que se pierde fácil: la actividad está cancelada pero las sesiones
     * siguen con `cancelada: false`, porque se canceló la actividad entera y no
     * una por una. Un `subEvent` en `EventScheduled` adentro de una serie
     * `EventCancelled` es una contradicción publicada en un formato que las
     * máquinas creen.
     *
     * MUTACIÓN PROBADA: dejar el `subEvent` con `e.cancelada ? … : PROGRAMADO`
     * —la línea anterior a este cambio— hace fallar solo este `it`.
     */
    const d = detalleCancelado({ fechas: ['2026-10-01T22:00:00Z', '2026-10-08T22:00:00Z'] });
    const sub = datosEstructurados(d)!.subEvent as { eventStatus: string; startDate: string }[];
    expect(sub).toHaveLength(2);
    expect(sub.every((e) => e.eventStatus === 'https://schema.org/EventCancelled')).toBe(true);
    // Con su fecha original: sin `startDate` Google no puede tachar nada.
    expect(sub[0]!.startDate).toContain('2026-10-01');
  });

  it('con TODAS las sesiones canceladas sigue emitiendo JSON-LD, con las fechas', () => {
    /*
     * Sin cancelar, este caso devuelve `null` a propósito (B-254): sin un encuentro
     * en pie no hay agenda que anunciar. Con la **actividad** cancelada es al revés
     * — es justo cuando Google necesita el `startDate` original para tachar el
     * resultado que ya indexó.
     *
     * MUTACIÓN PROBADA: usar `vivos` en lugar de `conFechas` devuelve `null` acá y
     * la página cancelada se queda sin datos estructurados, sin que nada más falle.
     */
    const d = detalleCancelado({
      fechas: ['2026-10-01T22:00:00Z', '2026-10-08T22:00:00Z'],
      canceladas: [0, 1],
    });
    const ld = datosEstructurados(d);
    expect(ld).not.toBeNull();
    expect(ld!.startDate).toContain('2026-10-01');

    const viva = detalleDe({
      fechas: ['2026-10-01T22:00:00Z', '2026-10-08T22:00:00Z'],
      canceladas: [0, 1],
    });
    expect(datosEstructurados(viva)).toBeNull();
  });

  it('no emite `offers`: no se puede conseguir algo que no va a pasar', () => {
    /*
     * Un `Offer` con `availability: InStock` en un evento cancelado marca como
     * conseguible algo que no lo es, y eso es de las cosas que hacen que Google
     * desconfíe del sitio entero (regla 6 del §5.3). La actividad va **gratis**,
     * que es el caso en el que la página sí emite precio.
     *
     * MUTACIÓN PROBADA: sacar la rama `d.cancelada ? {}` emite el `Offer` de
     * `price: "0"` y solo este `it` se pone rojo.
     */
    const d = detalleCancelado({ fechas: ['2026-10-01T22:00:00Z'], arancel: 'gratis' });
    expect(datosEstructurados(d)!.offers).toBeUndefined();

    const viva = detalleDe({ fechas: ['2026-10-01T22:00:00Z'], arancel: 'gratis' });
    expect(datosEstructurados(viva)!.offers).toBeDefined();
  });

  it('el default es «no cancelada»: quien omita la bandera no cambia nada', () => {
    /*
     * La respuesta segura para quien llame a `detalleDeActividad` con tres
     * argumentos —o sea todo el código anterior a B-110— es la de siempre.
     */
    const d = detalleDe({ fechas: ['2026-10-01T22:00:00Z'] });
    expect(d.cancelada).toBe(false);
    expect(d.aviso).toBeNull();
  });
});

describe('cuál es el próximo encuentro', () => {
  it('es el primero que no pasó ni está cancelado, y es uno solo', () => {
    /*
     * Lo necesita la lista del ciclo para marcar una fila de las ocho. Se deriva
     * acá y no en la plantilla por la razón de siempre: dos derivaciones de la
     * misma idea se separan sin que nada falle.
     */
    const d = detalleDe({
      esCiclo: true,
      fechas: [
        '2026-09-03T22:00:00Z', // pasó
        '2026-09-17T22:00:00Z', // cancelado
        '2026-09-24T22:00:00Z', // ← el próximo
        '2026-10-01T22:00:00Z',
      ],
      canceladas: [1],
    });
    expect(d.encuentros.map((e) => e.esProximo)).toEqual([false, false, true, false]);
    // Y coincide con lo que la ficha dice arriba: si divergieran, la página se
    // contradiría consigo misma en la misma pantalla.
    expect(d.proxima?.fecha).toBe(d.encuentros[2]!.fecha);
  });

  it('un encuentro cancelado nunca es el próximo, aunque sea el que viene', () => {
    /*
     * MUTACIÓN PROBADA: derivar `esProximo` de `!e.paso` a secas —sin mirar
     * `cancelada`— marca el encuentro tachado como «El próximo», que es lo peor
     * que puede decir esta página.
     */
    const d = detalleDe({
      fechas: ['2026-09-17T22:00:00Z', '2026-09-24T22:00:00Z'],
      canceladas: [0],
    });
    expect(d.encuentros[0]!.esProximo).toBe(false);
    expect(d.encuentros[1]!.esProximo).toBe(true);
  });

  it('sin ninguno por venir, ninguno queda marcado', () => {
    const d = detalleDe({ fechas: ['2026-01-10T22:00:00Z'] });
    expect(d.encuentros.some((e) => e.esProximo)).toBe(false);
  });
});

describe('las fechas de auditoría no llegan al detalle', () => {
  it('ni la de alta ni la de edición: la celda 6 que estaba resuelta por omisión', () => {
    /*
     * Lo pidió el `auditor-privacidad`, y es un hueco que ningún otro chequeo
     * podía ver: el barrido de centinelas no mira fechas —un `Timestamp` no lleva
     * un centinela adentro— así que «el detalle no publica `creadoEn`» estaba
     * decidido por omisión y nada lo sostenía.
     *
     * La página **no tiene por qué decirlas**: `creadoEn` es la clave de un orden
     * del listado y `updatedAt` no sale a ninguna salida. El fixture tiene las dos
     * distintas (`2026-08-01` de alta, `2026-08-02` de edición) justamente para
     * poder buscarlas por valor.
     */
    const texto = JSON.stringify(detalleDe());
    expect(texto, 'la fecha de alta no es del detalle').not.toContain('2026-08-01');
    expect(texto, 'la fecha de edición no sale a ninguna salida').not.toContain('2026-08-02');
  });
});

describe('la meta description y el título', () => {
  it('el título de la actividad va primero y el lugar entra', () => {
    // §5.1 — Google recorta a ~60 caracteres: lo que importa es el nombre, y el
    // barrio es la palabra que hace match con «taller de escritura villa crespo».
    const d = detalleDe({ titulo: 'Taller de crónica' });
    expect(d.meta.titulo.startsWith('Taller de crónica · Taller en Casa Brandon · Villa Crespo')).toBe(
      true,
    );
  });

  it('con la descripción vacía cae al formato armado y no a una frase trunca (§7.7)', () => {
    const d = detalleDe({ descripcion: '' });
    expect(d.meta.descripcion).toContain('Taller');
    expect(d.meta.descripcion).toContain('Casa Brandon');
    expect(d.meta.descripcion).not.toBe('');
  });

  it('con descripción, la meta es el resumen recortado del índice', () => {
    const larga = 'a'.repeat(300);
    const d = detalleDe({ descripcion: larga });
    expect(d.meta.descripcion.length).toBeLessThanOrEqual(161);
    expect(d.meta.descripcion.endsWith('…')).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 4 · Datos estructurados
// ───────────────────────────────────────────────────────────────────────────

describe('el JSON-LD sigue las reglas del §5.3', () => {
  it('las fechas llevan el offset de Buenos Aires, no Z (regla 1, trampa 1)', () => {
    const ld = datosEstructurados(detalleDe({ fechas: ['2026-09-24T22:00:00Z'] }))!;
    expect(ld.startDate).toBe('2026-09-24T19:00:00-03:00');
    expect(JSON.stringify(ld)).not.toContain('Z"');
  });

  it('una sola sesión es un Event con el subtipo del tipo de actividad', () => {
    const ld = datosEstructurados(detalleDe({ tipo: 'taller' }))!;
    expect(ld['@type']).toBe('EducationEvent');
    expect(ld.subEvent).toBeUndefined();
  });

  it('un ciclo es un EventSeries con un subEvent por encuentro (regla 2)', () => {
    /*
     * La traducción literal del §2.2: una actividad, N encuentros. N `Event`
     * sueltos le dirían a Google que hay tres actividades distintas compitiendo
     * entre sí.
     */
    const ld = datosEstructurados(
      detalleDe({
        esCiclo: true,
        tipo: 'club-lectura',
        fechas: ['2026-09-17T22:00:00Z', '2026-09-24T22:00:00Z'],
      }),
    )!;
    expect(ld['@type']).toBe('EventSeries');
    expect((ld.subEvent as unknown[]).length).toBe(2);
    expect(ld.startDate).toBe('2026-09-17T19:00:00-03:00');
    expect(ld.endDate).toBe('2026-09-24T21:00:00-03:00');
  });

  it('una sesión cancelada conserva su fecha y va marcada (regla 3)', () => {
    // Google pide el `startDate` original: sin él no puede tacharlo en el
    // resultado. Borrar el subevento sería peor que marcarlo.
    const ld = datosEstructurados(
      detalleDe({
        esCiclo: true,
        fechas: ['2026-09-17T22:00:00Z', '2026-09-24T22:00:00Z'],
        canceladas: [1],
      }),
    )!;
    const subs = ld.subEvent as Record<string, unknown>[];
    expect(subs[1]!.eventStatus).toBe('https://schema.org/EventCancelled');
    expect(subs[1]!.startDate).toBe('2026-09-24T19:00:00-03:00');
  });

  it('gratis emite precio 0 en ARS; cualquier otro arancel NO emite precio (regla 4)', () => {
    /*
     * Un `0` en un taller arancelado es un dato falso publicado en un formato que
     * las máquinas creen. MUTACIÓN PROBADA: emitir `price: '0'` sin mirar el
     * arancel deja el primer caso en verde y rompe el segundo.
     */
    const gratis = datosEstructurados(detalleDe({ arancel: 'gratis' }))!;
    expect(gratis.offers).toMatchObject({ price: '0', priceCurrency: 'ARS' });

    const pago = datosEstructurados(detalleDe({ arancel: 'arancelado' }))!;
    expect(pago.offers).not.toHaveProperty('price');
    expect(pago.offers).not.toHaveProperty('priceCurrency');
  });

  it('con la inscripción cerrada no se emite offers (regla 4)', () => {
    const ld = datosEstructurados(detalleDe({ arancel: 'gratis', cierra: '2026-09-01T00:00:00Z' }))!;
    expect(ld.offers).toBeUndefined();
  });

  it('performer solo si hay tallerista (regla 5)', () => {
    expect(datosEstructurados(detalleDe({ tallerista: 'Ana Ruiz' }))!.performer).toMatchObject({
      name: 'Ana Ruiz',
    });
    // No se inventa el organizador como performer.
    expect(datosEstructurados(detalleDe({ tallerista: null }))!.performer).toBeUndefined();
  });

  it('nada de aggregateRating ni review (regla 6)', () => {
    const texto = JSON.stringify(datosEstructurados(detalleDe())!);
    expect(texto).not.toContain('aggregateRating');
    expect(texto).not.toContain('review');
  });

  it('el modo de asistencia sale de las formas de cursar', () => {
    expect(datosEstructurados(detalleDe({ modalidades: ['presencial'] }))!.eventAttendanceMode).toBe(
      'https://schema.org/OfflineEventAttendanceMode',
    );
    expect(datosEstructurados(detalleDe({ modalidades: ['virtual'] }))!.eventAttendanceMode).toBe(
      'https://schema.org/OnlineEventAttendanceMode',
    );
    expect(
      datosEstructurados(detalleDe({ modalidades: ['presencial', 'virtual'] }))!
        .eventAttendanceMode,
    ).toBe('https://schema.org/MixedEventAttendanceMode');
  });

  it('con dos formas de cursar, location es un array de Place y VirtualLocation', () => {
    const ld = datosEstructurados(detalleDe({ modalidades: ['presencial', 'virtual'] }))!;
    const lugares = ld.location as Record<string, unknown>[];
    expect(lugares.map((l) => l['@type'])).toEqual(['Place', 'VirtualLocation']);
  });

  it('el `url` del VirtualLocation es la canónica de la actividad, no el link de la reunión (§5.4)', () => {
    /*
     * **La regla del §5.4, que hasta B-109 no se podía cumplir.** Google pide en
     * `VirtualLocation.url` la URL donde se consigue el acceso, y ésa es **esta
     * página**: nunca `online.url`, ni con `urlPublica: true` (D-139). El JSON-LD
     * es lo primero que cosecha un bot, así que el link de la reunión no llega
     * ahí por ningún camino (trampa 5). Antes del dominio salía sin `url`, porque
     * una relativa no es válida ahí y una absoluta inventada es peor que nada.
     *
     * MUTACIÓN PROBADA: cambiar ese `urlDeDetalle` por `rutaDeDetalle` —la
     * relativa, que es lo que uno escribe— pone este caso en rojo. Y **el caso de
     * más abajo no lo veía**, porque el detalle por defecto es presencial y no
     * emite `VirtualLocation`: lo encontró el barrido de mutaciones de B-109.
     */
    const d = detalleDe({ modalidades: ['virtual'] });
    // Con un solo lugar, `location` es el objeto y no un array (así lo emite el
    // schema): se normaliza acá para que el caso valga en los dos.
    const location = datosEstructurados(d)!.location;
    const lugares = (Array.isArray(location) ? location : [location]) as Record<
      string,
      unknown
    >[];
    const virtual = lugares.find((l) => l['@type'] === 'VirtualLocation')!;
    expect(virtual.url).toBe(urlDeDetalle(d.slug));
    expect(String(virtual.url)).toMatch(/^https:\/\//);
    // Y no el link de la reunión, ni con la casilla de D-15 tildada.
    const conLink = detalleDe({ modalidades: ['virtual'] }, {
      online: { plataforma: 'meet', url: 'https://meet.google.com/abc-defg-hij', urlPublica: true },
    });
    expect(JSON.stringify(datosEstructurados(conLink))).not.toContain('meet.google.com');
  });

  it('una presencial sin sede no emite JSON-LD (§7.7)', () => {
    /*
     * `location` es obligatorio para el resultado enriquecido y un `Place`
     * inventado es peor que no tener datos estructurados: marcar lo que la
     * página no muestra es lo que hace que Google desconfíe del sitio entero.
     */
    const sinSede = detalleDeActividad(
      toPublic(
        {
          ...actividadDePrueba(),
          modalidades: [
            { id: 'mod_0', modalidad: 'presencial', inicio: null, fin: null, sede: null, online: null },
          ],
          sede: null,
          online: null,
        },
        'act_sin_sede',
      ),
      ETIQUETAS,
      AHORA,
      TONOS,
    );
    expect(datosEstructurados(sinSede)).toBeNull();
  });

  it('una actividad sin encuentros vivos tampoco', () => {
    const cancelados = detalleDe({ fechas: ['2026-09-17T22:00:00Z'], canceladas: [0] });
    expect(datosEstructurados(cancelados)).toBeNull();
  });

  it('un tipo nuevo de la taxonomía cae al Event genérico, que siempre es válido', () => {
    const d = { ...detalleDe(), tipo: 'lectura-performatica' };
    expect(datosEstructurados(d)!['@type']).toBe('Event');
  });

  it('el `url` del organizador pasa por urlSegura, igual que el href', () => {
    /*
     * Lo encontró el `auditor-privacidad`: el HTML ya caía a texto plano cuando la
     * web no era una URL válida, pero el JSON-LD publicaba el crudo. `schema.ts`
     * valida `organizador.web` como texto opcional y **no** como URL, así que es
     * texto libre de verdad — y el `<script type="application/ld+json">` es lo
     * primero que cosecha un bot, leído por una máquina que puede convertirlo en
     * link.
     *
     * MUTACIÓN PROBADA: volver a `d.organizador.web` en `datosEstructurados` deja
     * el resto del archivo en verde y hace fallar solo este caso.
     */
    const base = detalleDe();
    const hostil = {
      ...base,
      organizador: { ...base.organizador, web: 'javascript:alert(1)', webUrl: null },
    };
    const texto = JSON.stringify(datosEstructurados(hostil)!);
    expect(texto).not.toContain('javascript:');
    expect(texto).not.toContain('alert(1)');
  });

  it('y cuando la web SÍ es válida, sale saneada', () => {
    // La otra dirección: sin esto, el caso de arriba pasaría con un `organizer`
    // que nunca lleva `url`.
    const base = detalleDe();
    const buena = {
      ...base,
      organizador: { ...base.organizador, web: 'casabrandon.com', webUrl: 'https://casabrandon.com/' },
    };
    expect((datosEstructurados(buena)!.organizer as Record<string, unknown>).url).toBe(
      'https://casabrandon.com/',
    );
  });

  it('el JSON-LD lleva la canónica de la actividad, derivada y no escrita (B-109 cerrado)', () => {
    /*
     * **Este caso estaba escrito al revés, a propósito.** Hasta B-109 exigía que
     * el JSON-LD **no** llevara ninguna URL absoluta: `canonical`, `og:` y `url`
     * necesitaban `site` en la config, y `site` necesitaba el dominio decidido.
     * Inventar una URL era peor que no ponerla.
     *
     * **La condición se cumplió** (D-165), así que se da vuelta: el `url` del
     * evento, el del `VirtualLocation` (§5.4) y el de `offers` tienen que estar,
     * y tienen que salir de `urlDeDetalle` — no escritos a mano. Se comparan
     * contra la función, no contra el dominio literal: un test con el dominio
     * pegado sería la segunda copia que este cambio vino a evitar.
     *
     * Y quedan dos ausencias, las dos con motivo:
     *
     * - **ninguna URL relativa** (`"url":"/…"`): en un JSON-LD no es válida, y
     *   un consumidor que la resuelva contra el host que la sirvió apunta al
     *   espejo;
     * - **ninguna URL del espejo** `agenda-literaria.web.app`, que sigue
     *   sirviendo este mismo HTML para siempre porque Firebase no lo apaga. La
     *   canónica no puede ser la del espejo: eso es justo el contenido duplicado
     *   que B-109 cerró.
     *
     * MUTACIÓN PROBADA: cambiar `urlDeDetalle(d.slug)` por `rutaDeDetalle(d.slug)`
     * en `datosEstructurados` deja el HTML igual y pone este caso en rojo por la
     * URL relativa.
     */
    const d = detalleDe();
    const texto = JSON.stringify(datosEstructurados(d)!);
    expect(texto).toContain(urlDeDetalle(d.slug));
    expect(urlDeDetalle(d.slug)).toMatch(/^https:\/\//);
    expect(texto).not.toContain('"url":"/');
    expect(texto).not.toContain('agenda-literaria.web.app');
  });
});

describe('el bloque de fecha de cada encuentro — B-260, D-146', () => {
  /*
   * **Lo pidió el `auditor-privacidad`.** El campo es nuevo en la salida 6 —la
   * página de detalle indexada— y es la pieza **más visible** de cada encuentro:
   * el rectángulo de tinta plena con el día calado.
   *
   * `bloque` es un objeto libre dentro del view-model, así que agregarle `hora`,
   * `anio` o el `tema` no rompe nada y publica en la parte más grande de una
   * página pública. Lo que se fija acá es que lleve **exactamente** las tres
   * piezas que necesita y ninguna más.
   */
  it('lleva exactamente día, día de la semana y mes, y nada más', () => {
    // MUTACIÓN PROBADA: sumarle `hora` al objeto `bloque` en `detallePublico.ts`
    // hace fallar este caso.
    const d = detalleDe({ fechas: ['2026-09-24T22:00:00Z'] });
    const e = d.encuentros[0]!;
    expect(Object.keys(e.bloque).sort()).toEqual(['dia', 'diaSemana', 'mes']);
  });

  it('sale de `inicio` y en la zona del proyecto, no en la de quien mira', () => {
    /*
     * Las 22:00 UTC del 24 son las 19:00 del 24 en Buenos Aires. Sin `timeZone`
     * explícito, un build corrido en una máquina en otra zona escribiría el 25 —
     * y quedaría **estampado en el HTML**, que es peor que un error de cliente:
     * no se corrige solo al recargar. Es la trampa 1.
     */
    const d = detalleDe({ fechas: ['2026-09-24T22:00:00Z'] });
    expect(d.encuentros[0]!.bloque).toEqual({ dia: '24', diaSemana: 'jue', mes: 'sep' });
  });

  it('sin fecha válida queda vacío, y no inventa un día', () => {
    /*
     * El otro modo de falla: un bloque de tinta plena con un «NaN» o un «1» de
     * relleno adentro. Vacío se ve como lo que es —un dato que falta— y no miente.
     *
     * Se arma sobre la proyección pública y no con el fixture, porque el fixture
     * construye `Timestamp`s y no puede producir una fecha rota: lo que se está
     * probando es justamente qué hace el view-model cuando el ISO del índice no
     * parsea.
     */
    const publica = toPublic(actividadDePrueba({}), 'act_1');
    const rota = {
      ...publica,
      sesiones: [{ ...publica.sesiones[0]!, inicio: 'no-es-una-fecha', fin: 'no-es-una-fecha' }],
    };
    const d = detalleDeActividad(rota, ETIQUETAS, AHORA, TONOS);
    expect(d.encuentros[0]!.bloque).toEqual({ dia: '', diaSemana: '', mes: '' });
  });
});

// ───────────────────────────────────────────────────────────────────────────
// «Más en septiembre»: el enlace a la página de mes — B-331, cierra B-280
// ───────────────────────────────────────────────────────────────────────────

/**
 * **El enlace desde el detalle hacia `/agenda/{aaaa-mm}`** — B-280, §2.2 del
 * diseño.
 *
 * ── Qué se puede romper acá, que es un 404 en la página que más se ve ─────
 * La tentación es derivar la clave del mes de `proxima.iso` en la plantilla, y se
 * ve perfecto: `/agenda/2026-09` es una URL bien formada. Lo que no se ve es que
 * **esa página puede no existir**: el §2.2 la genera solo para los meses vigentes
 * con 3 o más actividades. Con dos, el enlace es un 404 servido desde la página
 * que recibe el tráfico de Google.
 *
 * Y no se puede decidir mirando la actividad: depende de **cuántas otras** caen en
 * su mes. Por eso el mapa de meses con página llega como argumento (lo arma
 * `mesesEnlazables` en el lector) y por eso el default es «no enlazar nada»: quien
 * omita el argumento pierde un enlace interno, no publica un 404.
 *
 * Los casos de abajo son las respuestas posibles, y cada uno tiene su mutación.
 */
describe('el enlace «más en septiembre» — B-280', () => {
  /** Las páginas de mes que existen en este build, como las arma el lector. */
  const CON_PAGINA = { '2026-09': 'Septiembre de 2026', '2026-10': 'Octubre de 2026' };

  const conMeses = (
    o: OpcionesDeEntrada,
    meses: Record<string, string> = CON_PAGINA,
    ahora = AHORA,
  ) =>
    detalleDeActividad(
      toPublic(actividadDePrueba(o), o.id ?? 'act_1'),
      ETIQUETAS,
      ahora,
      TONOS,
      false,
      meses,
    );

  it('enlaza el mes de la próxima fecha, con el nombre que le puso el lector', () => {
    const d = conMeses({ fechas: ['2026-09-24T22:00:00Z'] });
    expect(d.mes).toEqual({ clave: '2026-09', nombre: 'Septiembre de 2026' });
  });

  it('el nombre sale del mapa y no se vuelve a derivar', () => {
    /*
     * MUTACIÓN PROBADA: devolver `{ clave, nombre: nombreDeMes(clave) }` en vez de
     * tomar el nombre del mapa pone este caso en rojo. Con dos derivaciones el
     * enlace podría decir «Septiembre» y la página de destino «Septiembre de
     * 2026» — la clase de B-88 en su versión más chica, y la que nadie mira porque
     * las dos frases se leen bien por separado.
     */
    const d = conMeses({ fechas: ['2026-09-24T22:00:00Z'] }, { '2026-09': 'EL MES DE PRUEBA' });
    expect(d.mes?.nombre).toBe('EL MES DE PRUEBA');
  });

  it('si ese mes NO tiene página, no enlaza nada', () => {
    /*
     * El caso que importa, y el único que produce un 404 si se hace mal: el mes de
     * la actividad no pasó el corte de tres del §2.2.
     *
     * MUTACIÓN PROBADA: devolver `{ clave, nombre: nombreDeMes(clave) }` sin
     * consultar el mapa —o sea derivar el mes de la fecha, que es lo que uno
     * escribe— pone este caso en rojo y deja los otros en verde.
     */
    const d = conMeses({ fechas: ['2026-11-24T22:00:00Z'] });
    expect(d.mes).toBeNull();
  });

  it('una actividad que ya pasó no enlaza ningún mes', () => {
    /*
     * Su mes ya venció, y la página de un mes vencido **no es enlazable**: se emite
     * una última vez con `noindex` para que su URL no devuelva 404 (§2.2), no para
     * mandarle gente. La salida de una pasada es `/pasadas`, que el pie ya da.
     *
     * MUTACIÓN PROBADA: usar el **último** encuentro en vez del próximo —que es la
     * variante razonable, «el mes al que pertenece»— pone este caso en rojo.
     */
    const d = conMeses({ fechas: ['2026-09-01T22:00:00Z'] }, { '2026-09': 'Septiembre de 2026' });
    expect(d.yaPaso).toBe(true);
    expect(d.mes).toBeNull();
  });

  it('un ciclo a caballo de dos meses enlaza el de su próxima fecha', () => {
    /*
     * §7.5 — un ciclo del 3 de septiembre al 22 de octubre cae en las **dos**
     * páginas de mes. El enlace es uno solo y contesta «qué más hay cuando voy a
     * esto», no «en qué meses ocurre este ciclo»: mirado el 10 de septiembre,
     * septiembre.
     *
     * Con la fecha de septiembre ya pasada el enlace se corre a octubre solo, sin
     * ninguna regla más — que es la propiedad que hace que esto no envejezca.
     */
    const fechas = ['2026-09-24T22:00:00Z', '2026-10-22T22:00:00Z'];
    expect(conMeses({ fechas, esCiclo: true }).mes?.clave).toBe('2026-09');

    const yaEnOctubre = conMeses(
      { fechas, esCiclo: true },
      CON_PAGINA,
      new Date('2026-10-01T15:00:00Z'),
    );
    expect(yaEnOctubre.mes?.clave).toBe('2026-10');
  });

  it('el default es no enlazar: quien omita el mapa pierde un link, no publica un 404', () => {
    /*
     * MUTACIÓN PROBADA: poner el default en «derivar de la fecha» —o cualquier cosa
     * que no sea vacío— pone este caso en rojo. Es el mismo criterio del default
     * `false` de `cancelada`: la respuesta segura para quien lo omite.
     */
    expect(detalleDe({ fechas: ['2026-09-24T22:00:00Z'] }).mes).toBeNull();
  });

  it('un encuentro cancelado no cuenta como próxima fecha', () => {
    /*
     * Sale gratis —`siguiente` ya se calcula sobre los que están en pie— y se
     * afirma porque es la diferencia entre enlazar el mes de una fecha que no va a
     * ocurrir y enlazar el de la que sí.
     */
    const d = conMeses({
      fechas: ['2026-09-24T22:00:00Z', '2026-10-22T22:00:00Z'],
      canceladas: [0],
    });
    expect(d.mes?.clave).toBe('2026-10');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// N · El BreadcrumbList — B-107
// ───────────────────────────────────────────────────────────────────────────

describe('migasDeDetalle — Agenda → Tipo → título', () => {
  it('con hub, son tres niveles y el del medio apunta a /tipo/{slug}', () => {
    const d = detalleConHub({ tipo: 'taller' });
    const migas = migasDeDetalle(d) as {
      '@type': string;
      itemListElement: { position: number; name: string; item: string }[];
    };
    expect(migas['@type']).toBe('BreadcrumbList');
    expect(migas.itemListElement).toHaveLength(3);
    expect(migas.itemListElement[1]).toMatchObject({
      position: 2,
      name: 'Talleres',
      item: urlAbsoluta(rutaDeTipo('taller')),
    });
    expect(migas.itemListElement[2]).toMatchObject({
      position: 3,
      name: d.titulo,
      item: urlDeDetalle(d.slug),
    });
  });

  it('sin hub, son dos niveles y el título queda en la posición 2', () => {
    /*
     * MUTACIÓN PROBADA: ignorar `tipoTieneHub` y armar siempre los tres niveles
     * deja este caso en rojo — el segundo nivel apuntaría a un `/tipo/{slug}`
     * que el build nunca generó.
     */
    const d = detalleDe({ tipo: 'taller' }); // default: tipoTieneHub = false
    const migas = migasDeDetalle(d) as { itemListElement: { position: number; name: string }[] };
    expect(migas.itemListElement).toHaveLength(2);
    expect(migas.itemListElement[1]).toMatchObject({ position: 2, name: d.titulo });
  });

  it('el default de tipoTieneHub en detalleDeActividad es false: el lado que no publica un link roto', () => {
    /*
     * MUTACIÓN PROBADA: cambiar el default a `true` en `detalleDeActividad`
     * publicaría, para cualquier llamador que se olvide del séptimo argumento,
     * una miga de pan a un hub que puede no existir. Es el mismo criterio que
     * `cancelada` y `mesesConPagina`.
     */
    const sinArgumento = detalleDeActividad(
      toPublic({ ...actividadDePrueba({ tipo: 'taller' }) }, 'act_1'),
      ETIQUETAS,
      AHORA,
      TONOS,
    );
    expect(sinArgumento.tipoTieneHub).toBe(false);
  });

  it('siempre se emite, incluso cuando datosEstructurados devuelve null', () => {
    // Una actividad presencial sin sede no tiene `Event` honesto (§7.7), pero
    // sigue teniendo un lugar en la navegación del sitio.
    const sinSede = detalleDeActividad(
      toPublic({ ...actividadDePrueba({}), modalidades: [] }, 'act_1'),
      ETIQUETAS,
      AHORA,
      TONOS,
    );
    expect(datosEstructurados(sinSede)).toBeNull();
    expect(migasDeDetalle(sinSede)['@type']).toBe('BreadcrumbList');
  });

  it('el título hostil sigue necesitando el mismo escape de < que datosEstructurados', () => {
    /*
     * `migasDeDetalle` no escapa nada — es la plantilla la que aplica
     * `.replace(/</g, '\\u003c')`, igual que con `datosEstructurados` (misma
     * trampa: `JSON.stringify` no toca `<`). Esto prueba que un título con
     * `</script>` sigue cerrando el bloque **sin** ese paso, y deja de hacerlo
     * **con** él — o sea que el escape de la plantilla es necesario y suficiente
     * para esta salida también, y no algo que la forma del BreadcrumbList vuelva
     * innecesario.
     */
    const hostil = detalleConHub({}, { titulo: 'Taller</script><script>alert(1)' });
    const crudo = JSON.stringify(migasDeDetalle(hostil));
    expect(crudo).toContain('</script>');
    expect(crudo.replace(/</g, '\\u003c')).not.toContain('</script>');
  });
});
