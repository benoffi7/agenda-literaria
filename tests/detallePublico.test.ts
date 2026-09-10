/**
 * La página de detalle: el view-model y sus datos estructurados — B-227.
 *
 * Lo que este archivo **no** cubre es la privacidad: eso es el barrido de
 * centinelas de `tests/barrido-de-salidas-publicas.test.ts`, que corre sobre esta
 * misma proyección. Acá están las instancias —el botón de cada vía, el JSON-LD,
 * los casos incómodos del §7— y allá está la clase.
 */
import { readFileSync } from 'node:fs';
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
  plataforma: [{ slug: 'meet', label: 'Google Meet' }, { slug: 'a-confirmar', label: 'A confirmar' }],
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
    // B-375 — la analítica del clic lee esto, nunca el `destino` real.
    expect(a?.via).toBe('mail');
  });

  it('whatsapp arma un wa.me con los dígitos y el mensaje', () => {
    const a = accionDeInscripcion('whatsapp', '+54 9 11 5555-1234', 'Taller');
    expect(a?.texto).toBe('Escribir por WhatsApp');
    expect(a?.href).toContain('https://wa.me/5491155551234?text=');
    expect(decodeURIComponent(a!.href)).toContain('Hola, quiero anotarme en Taller');
    expect(a?.via).toBe('whatsapp');
  });

  it('dm lleva al perfil', () => {
    const a = accionDeInscripcion('dm', '@casabrandon', 'X');
    expect(a?.href).toBe('https://instagram.com/casabrandon');
    expect(a?.via).toBe('dm');
  });

  it('formulario pasa por urlSegura', () => {
    expect(accionDeInscripcion('formulario', 'javascript:alert(1)', 'X')).toBeNull();
    const a = accionDeInscripcion('formulario', 'forms.gle/abc', 'X');
    expect(a?.href).toBe('https://forms.gle/abc');
    expect(a?.via).toBe('formulario');
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
  it('la de edición nunca, y la de alta en un solo campo — B-812 movió media celda', () => {
    /*
     * Lo pidió el `auditor-privacidad`, y es un hueco que ningún otro chequeo
     * podía ver: el barrido de centinelas no mira fechas —un `Timestamp` no lleva
     * un centinela adentro— así que «el detalle no publica `creadoEn`» estaba
     * decidido por omisión y nada lo sostenía.
     *
     * **B-812 dio vuelta la mitad de esa celda, y este caso es lo que impide que
     * se dé vuelta entera.** La fecha de alta llega ahora a **un solo campo**
     * —`ofertaDesde`, que es el `validFrom` del `Offer`— y no como una fecha de
     * auditoría más: el resto del view-model sigue sin verla. `updatedAt` no sale
     * a ninguna salida y eso no se movió. El fixture tiene las dos distintas
     * (`2026-08-01` de alta, `2026-08-02` de edición) justamente para poder
     * buscarlas por valor.
     *
     * MUTACIÓN PROBADA: agregar un segundo campo con la misma fecha —un
     * `creadoEn: a.creadoEn` al lado de `ofertaDesde`, que es lo que uno escribe
     * el día que quiera poner «cargado el …» en la ficha— deja este caso en rojo
     * aunque el `validFrom` siga saliendo idéntico.
     */
    const d = detalleDe();
    expect(
      JSON.stringify(d),
      'la fecha de edición no sale a ninguna salida',
    ).not.toContain('2026-08-02');

    expect(d.ofertaDesde, 'la fecha de alta es la del `validFrom`').toBe('2026-08-01');
    const { ofertaDesde: _validFrom, ...resto } = d;
    expect(
      JSON.stringify(resto),
      'la fecha de alta solo puede estar en `ofertaDesde`',
    ).not.toContain('2026-08-01');
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

  it('B-190 — «a confirmar» no se lee como el nombre de una plataforma', () => {
    /*
     * MUTACIÓN PROBADA: sacar el chequeo de `plataformaAConfirmar` en
     * `dondeCorto` y volver siempre a `Online por ${m.plataforma}`. Pasa el
     * resto de la suite (que solo prueba plataformas reales) y acá sale
     * «Online por A confirmar», que se lee como si «A confirmar» fuera el
     * nombre de una plataforma.
     */
    const d = detalleDe(
      { titulo: 'Club sin plataforma' },
      {
        modalidades: [
          {
            id: 'mod_0',
            modalidad: 'virtual',
            inicio: null,
            fin: null,
            sede: null,
            online: { plataforma: 'a-confirmar', url: '', urlPublica: false },
          },
        ],
      },
    );
    expect(d.meta.titulo).toContain('Online, plataforma a confirmar');
    expect(d.meta.titulo).not.toContain('Online por A confirmar');
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

  it('cada subEvent es un item completo: hereda el lugar, la descripción y el organizador (B-721)', () => {
    /*
     * Un `subEvent` es la misma actividad en otra fecha, así que repetir esos
     * datos no afirma nada nuevo (§7). Y `location` es **obligatorio** en un
     * `Event`: sin él cada encuentro del ciclo era un item incompleto que Google
     * tolera heredando del padre, y de esa tolerancia no hay que depender.
     *
     * MUTACIÓN PROBADA: volver al `subEvent` de cáscara (solo `name`,
     * `startDate`, `endDate` y `eventStatus`) deja este caso en rojo en la
     * primera aserción.
     */
    const ld = datosEstructurados(
      detalleDe({
        esCiclo: true,
        fechas: ['2026-09-17T22:00:00Z', '2026-09-24T22:00:00Z'],
      }),
    )!;
    const subs = ld.subEvent as Record<string, unknown>[];
    for (const sub of subs) {
      expect(sub.location).toEqual(ld.location);
      expect(sub.description).toBe(ld.description);
      expect(sub.organizer).toEqual(ld.organizer);
      expect(sub.eventAttendanceMode).toBe(ld.eventAttendanceMode);
      // El otro que la regla 7 declara heredado. Sin esta línea, sacarlo de la
      // herencia no ponía nada rojo — lo señaló el `auditor-privacidad`.
      expect(sub.performer).toEqual(ld.performer);
      /*
       * **El `url` dejó de ser heredado** — B-733, aprobado por el dueño el
       * 2026-09-07. Decía `expect(sub.url).toBe(ld.url)`, y era la herencia que
       * B-730 había puesto: no menos verdadera, pero **el mismo link repetido N
       * veces**. Ahora cada `subEvent` apunta al ancla de su propia fila.
       *
       * Se afirma por partes y no contra un string armado a mano: la página
       * adelante, el ancla del encuentro atrás. Escribir la URL entera acá sería
       * una segunda copia de cómo se arma una canónica.
       */
      expect(String(sub.url).startsWith(String(ld.url))).toBe(true);
      expect(String(sub.url)).toMatch(/#ses_/);
      // El `@context` va **una sola vez**, en la raíz: repetirlo en un item
      // anidado es ruido que ningún consumidor pide.
      expect(sub).not.toHaveProperty('@context');
    }
    // Y los dos anclas son distintas, que es el punto: si fueran iguales, el
    // `url` seguiría siendo el mismo link N veces con un `#` de adorno.
    expect(subs[0]!.url).not.toBe(subs[1]!.url);

    // Y lo propio del encuentro sigue siendo del encuentro, no de la serie.
    expect(subs[0]!.name).toBe('Taller de crónica — Tema 1');
    expect(subs[1]!.name).toBe('Taller de crónica — Tema 2');

    // La `image` va aparte porque el fixture normal no tiene galería: sin un
    // caso con imagen, esa mitad de la herencia quedaba sin fijar.
    const conImagen = datosEstructurados(
      detalleDe({
        esCiclo: true,
        imagenUrl: 'https://ejemplo.ar/flyer.jpg',
        fechas: ['2026-09-17T22:00:00Z', '2026-09-24T22:00:00Z'],
      }),
    )!;
    expect(conImagen.image).toBe('https://ejemplo.ar/flyer.jpg');
    for (const sub of conImagen.subEvent as Record<string, unknown>[]) {
      expect(sub.image).toBe(conImagen.image);
    }
  });

  it('ningún subEvent publica una clave que la raíz no publique (§5.1, la clase)', () => {
    /*
     * **La invariante que hace segura la herencia**, y va por claves y no por
     * valores a propósito.
     *
     * `comun` se spreadea entero en la raíz de las dos ramas, así que
     * `keys(subEvent) ⊆ keys(raíz)` sin resto. Esto lo fija, y fija de paso las
     * dos formas de romperlo: cambiar `...deLaActividad` por `...e` o `...d`
     * —que metería el `id` de la sesión, la `lectura`, el `numero`— y agregarle
     * al `subEvent` un campo propio que la serie no tenga.
     *
     * **Por qué claves y no centinelas:** el barrido de
     * `barrido-de-salidas-publicas.test.ts` solo puede plantar strings, así que
     * un campo numérico o booleano nuevo en `comun` —un
     * `maximumAttendeeCapacity: cupo`, que es justo lo que un informe de Search
     * Console invita a agregar— se le escapa, y esta rama lo replicaría en cada
     * encuentro. Lo señaló el `auditor-privacidad` auditando B-721.
     *
     * MUTACIÓN PROBADA: reemplazar `...deLaActividad` por `...e` deja este caso
     * en rojo nombrando las claves que sobran.
     */
    const ld = datosEstructurados(
      detalleDe({
        esCiclo: true,
        modalidades: ['hibrido'],
        imagenUrl: 'https://ejemplo.ar/flyer.jpg',
        fechas: ['2026-09-17T22:00:00Z', '2026-09-24T22:00:00Z'],
        canceladas: [1],
      }),
    )!;
    const subs = ld.subEvent as Record<string, unknown>[];
    // Un `for…of` sobre un array vacío no ejecuta ninguna aserción: sin esta
    // línea el caso pasaría en verde con `subEvent: []`. Lo señaló el
    // `auditor-privacidad` revisando el caso.
    expect(subs).toHaveLength(2);
    const enLaRaiz = new Set(Object.keys(ld));
    for (const sub of subs) {
      expect(Object.keys(sub).filter((k) => !enLaRaiz.has(k))).toEqual([]);
    }
  });

  it('el subEvent cancelado no ofrece nada, y el que sigue en pie sí (regla 4 por encuentro)', () => {
    /*
     * La serie sigue abierta —`ofrecible` mira la actividad—, pero un encuentro
     * cancelado con `availability: InStock` afirma que a ese encuentro todavía
     * se entra. Es la regla 4 un nivel más abajo.
     */
    const ld = datosEstructurados(
      detalleDe({
        esCiclo: true,
        arancel: 'gratis',
        fechas: ['2026-09-17T22:00:00Z', '2026-09-24T22:00:00Z'],
        canceladas: [1],
      }),
    )!;
    expect(ld.offers).toMatchObject({ price: '0' });
    const subs = ld.subEvent as Record<string, unknown>[];
    expect(subs[0]!.offers).toMatchObject({ price: '0', priceCurrency: 'ARS' });
    expect(subs[1]!.offers).toBeUndefined();
  });

  it('con monto cargado el `offers` lleva el precio de verdad (B-114)', () => {
    /*
     * **Lo que B-114 pedía, y la regla que reemplaza.** Antes solo `gratis` emitía
     * precio (`'0'`) porque `arancel.tipo` es un slug y no un número: un `0` en un
     * taller pago es un dato falso en un formato que las máquinas creen.
     *
     * Ahora hay tres casos y no dos, y los tres están acá porque el de en medio no
     * se puede leer sin los otros dos.
     */
    const conMonto = datosEstructurados(
      detalleDe({}, { arancel: { tipo: 'arancelado', notas: '', monto: 15000 } }),
    )!;
    expect(conMonto.offers).toMatchObject({ price: '15000', priceCurrency: 'ARS' });

    // Sin formato: el consumidor es una máquina y `priceCurrency` dice la moneda.
    expect(JSON.stringify(conMonto.offers)).not.toContain('$15.000');

    // `gratis` sigue siendo `'0'`, con o sin monto (el schema no lo deja tener uno).
    expect(
      datosEstructurados(detalleDe({}, { arancel: { tipo: 'gratis', notas: '', monto: null } }))!
        .offers,
    ).toMatchObject({ price: '0', priceCurrency: 'ARS' });

    /*
     * Y **sin monto y sin ser gratis sigue sin emitir precio**, que es la regla
     * original y no una excepción: es «a la gorra» —la mitad del circuito— y el
     * arancelado al que nadie le cargó el número.
     */
    const sinMonto = datosEstructurados(
      detalleDe({}, { arancel: { tipo: 'arancelado', notas: '', monto: null } }),
    )!;
    expect(sinMonto.offers).toBeDefined();
    expect(sinMonto.offers).not.toHaveProperty('price');
    expect(sinMonto.offers).not.toHaveProperty('priceCurrency');
  });

  it('un monto en un arancel que no se paga se ignora, aunque el documento lo traiga (B-114)', () => {
    /*
     * El schema lo prohíbe, pero un documento anterior a esa regla —o restaurado
     * del historial— puede traer las dos cosas, y esta página es HTML indexado: un
     * «Gratis · $8.000» ahí se lo lleva Google. El view-model lo descarta, que es
     * el único lugar que ve las dos mitades.
     *
     * MUTACIÓN PROBADA: sacar el `admiteMonto` del view-model deja este caso en
     * rojo por los dos lados —el `precio` de la página y el `price` del JSON-LD—.
     */
    const d = detalleDe({}, { arancel: { tipo: 'gratis', notas: '', monto: 8000 } });
    expect(d.arancel.monto).toBeNull();
    expect(d.arancel.precio).toBe(d.arancel.etiqueta);
    expect(datosEstructurados(d)!.offers).toMatchObject({ price: '0' });
    expect(JSON.stringify(datosEstructurados(d))).not.toContain('8000');
  });

  it('la frase de la página pega el monto a la etiqueta del arancel (B-114)', () => {
    const d = detalleDe({}, { arancel: { tipo: 'arancelado', notas: '', monto: 15000 } });
    // `precio` es lo que pinta la página; `monto` es el número que necesita el
    // JSON-LD. Los dos, porque derivar uno del otro del lado del consumidor sería
    // parsear una cadena que este módulo ya tuvo entera (D-140).
    expect(d.arancel.precio).toBe(`${d.arancel.etiqueta} · $15.000`);
    expect(d.arancel.monto).toBe(15000);
  });

  it('el encuentro que ya pasó no ofrece nada, aunque la serie siga en pie (B-650 por encuentro)', () => {
    /*
     * Con `AHORA` en el 10 de septiembre, el primer encuentro ya terminó y el
     * segundo no. La serie es ofrecible —quedan fechas por venir— y el `Offer`
     * de la raíz está bien; el del encuentro pasado sería la misma afirmación
     * falsa que B-650 apagó para la actividad entera.
     *
     * MUTACIÓN PROBADA: heredar `offers` sin mirar `e.paso` deja este caso en
     * rojo en la última aserción.
     */
    const ld = datosEstructurados(
      detalleDe({
        esCiclo: true,
        arancel: 'gratis',
        fechas: ['2026-09-03T22:00:00Z', '2026-09-17T22:00:00Z'],
      }),
    )!;
    expect(ld.offers).toBeDefined();
    const subs = ld.subEvent as Record<string, unknown>[];
    expect(subs[1]!.offers).toBeDefined();
    expect(subs[0]!.offers).toBeUndefined();
  });

  it('con la actividad cancelada ningún subEvent ofrece nada', () => {
    const ld = datosEstructurados(
      detalleCancelado({
        esCiclo: true,
        arancel: 'gratis',
        fechas: ['2026-09-17T22:00:00Z', '2026-09-24T22:00:00Z'],
      }),
    )!;
    expect(ld.offers).toBeUndefined();
    for (const sub of ld.subEvent as Record<string, unknown>[]) {
      expect(sub.offers).toBeUndefined();
      expect(sub.eventStatus).toBe('https://schema.org/EventCancelled');
    }
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

  it('con la actividad ya pasada tampoco, aunque nunca haya cerrado (regla 4) — B-650', () => {
    /*
     * **La mitad de la regla 4 que faltaba.** El §5.3 la escribe así: «`InStock`
     * si la inscripción está abierta **y hay sesiones por venir**», y lo segundo
     * no se miraba: `inscripcion.cerrada` mira solo `cierra`, y una actividad sin
     * fecha de cierre —el caso normal— queda abierta para siempre. El taller de
     * enero publicaba `availability: InStock` en septiembre.
     *
     * Es la misma trampa que el §7.1 ya nombraba para el CTA («el CTA se decide
     * por fecha, no por `inscripcion.abierta`»): la página apagaba el botón y el
     * JSON-LD seguía ofreciendo. Acá se afirma que las dos superficies dicen lo
     * mismo, que es lo que evita que vuelvan a separarse.
     *
     * MUTACIÓN PROBADA: sacar `!d.yaPaso` de `ofrecible` deja este caso en rojo
     * y todos los demás de este `describe` en verde.
     */
    const como = { arancel: 'gratis', requiereInscripcion: true, cierra: null };
    const pasada = detalleDe(
      { ...como, fechas: ['2026-01-10T22:00:00Z'] },
      {},
      new Date('2026-09-20T15:00:00Z'),
    );
    expect(pasada.yaPaso, 'el fixture dejó de producir una pasada').toBe(true);
    expect(pasada.inscripcion.cerrada, 'sin `cierra`, la inscripción figura abierta').toBe(false);
    // La página ya apagaba el CTA por fecha (§7.1) — es la afirmación de que las
    // dos superficies dicen lo mismo, no un aserto suelto: sin `requiereInscripcion`
    // no habría acción que apagar y esto pasaría sin haber mirado nada.
    expect(detalleDe({ ...como }).inscripcion.mostrarAccion).toBe(true);
    expect(pasada.inscripcion.mostrarAccion).toBe(false);

    const ld = datosEstructurados(pasada)!;
    // La página sobrevive y conserva sus fechas (§7.1): lo único que no sale es
    // la oferta.
    expect(ld.startDate).toBeDefined();
    expect(ld.offers).toBeUndefined();
  });

  it('y la que sí tiene fecha por venir sigue ofreciendo — control negativo', () => {
    // Sin este caso, `ofrecible: false` a secas dejaría el anterior en verde y
    // el sitio entero sin `offers`.
    const viva = datosEstructurados(detalleDe({ arancel: 'gratis' }))!;
    expect(viva.offers).toMatchObject({
      availability: 'https://schema.org/InStock',
      price: '0',
    });
  });

  it('el `offers` dice desde cuándo, con la fecha de alta (B-812)', () => {
    /*
     * El único de los nueve avisos del informe «Eventos» que era **código y no
     * dato faltante**: `validFrom` no se emitía nunca (24 elementos, lectura del
     * 2026-09-08). El dato honesto sería «desde cuándo se puede inscribir» y ese
     * campo no existe (§3.1), así que va la fecha de alta: no dice que la oferta
     * empezó más tarde de lo que empezó, porque nada se pudo ofrecer antes de
     * existir. Ver `DetallePublico.ofertaDesde`.
     *
     * Se afirma contra **dos** altas distintas y no contra una: con una sola, un
     * `validFrom` escrito a mano con la fecha del fixture pasaría igual.
     *
     * MUTACIÓN PROBADA: derivar `ofertaDesde` de la primera sesión —la otra fecha
     * que este módulo tiene a mano, y la que uno agarra si no lee el ítem— deja
     * las dos aserciones en rojo. Devolverlo siempre `null` también, y arrastra
     * de paso al caso de la precisión y al de las fechas de auditoría.
     */
    const agosto = datosEstructurados(
      detalleDe({ arancel: 'gratis', creadoEn: '2026-08-01T00:00:00Z' }),
    )!;
    expect(agosto.offers).toMatchObject({ validFrom: '2026-08-01' });

    const julio = datosEstructurados(
      detalleDe({ arancel: 'gratis', creadoEn: '2026-07-15T21:30:00Z' }),
    )!;
    expect(julio.offers).toMatchObject({ validFrom: '2026-07-15' });
  });

  it('el `validFrom` es del día: la hora del alta no viaja (B-812, D-138)', () => {
    /*
     * D-138 — con **un solo admin**, el instante exacto de cada carga no es una
     * fecha, es su agenda de trabajo: a qué hora carga y en qué tandas. `toPublic`
     * ya recorta al día y lo que este caso afirma es que la salida 6 no lo
     * deshace, que es lo único nuevo que B-812 podía romper.
     *
     * MUTACIÓN PROBADA: emitir `` `${d.ofertaDesde}T00:00:00-03:00` `` —completar
     * la fecha a un instante, que es lo que uno hace mirando los ejemplos de
     * schema.org, todos con `dateTime`— deja este caso en rojo. Es la forma real
     * de romperlo: la hora exacta del alta ya no llega hasta acá (`toPublic` la
     * recortó), así que lo que hay que impedir es que alguien la reponga
     * inventada.
     */
    const ld = datosEstructurados(
      detalleDe({ arancel: 'gratis', creadoEn: '2026-08-01T03:14:52.881Z' }),
    )!;
    const desde = String((ld.offers as Record<string, unknown>).validFrom);
    expect(desde).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(desde).not.toContain('T');
  });

  it('sin fecha de alta no se emite `validFrom`, y nunca uno vacío (B-812)', () => {
    /*
     * El sentinel de `serverTimestamp()` todavía sin resolver: `toPublic` devuelve
     * la cadena vacía (su propio caso lo fija) y acá lo que importa es que la
     * clave **no salga**. Un `validFrom: ''` es peor que el aviso de Search
     * Console — el aviso dice que falta un dato y la cadena vacía dice que hay
     * uno, en el formato que las máquinas creen.
     *
     * MUTACIÓN PROBADA: cambiar el spread condicional por
     * `validFrom: d.ofertaDesde ?? ''` deja este caso en rojo y ningún otro.
     */
    const d = detalleDe(
      { arancel: 'gratis' },
      { createdAt: { _methodName: 'serverTimestamp' } as never },
    );
    expect(d.ofertaDesde).toBeNull();
    const offers = datosEstructurados(d)!.offers as Record<string, unknown>;
    // Control positivo: sin esto, un `offers` que dejó de emitirse por cualquier
    // otro motivo haría pasar el `not.toHaveProperty` de abajo.
    expect(offers).toMatchObject({ price: '0' });
    expect(offers).not.toHaveProperty('validFrom');
  });

  it('performer solo si hay tallerista (regla 5)', () => {
    expect(datosEstructurados(detalleDe({ tallerista: 'Ana Ruiz' }))!.performer).toMatchObject({
      name: 'Ana Ruiz',
    });
    // No se inventa el organizador como performer.
    expect(datosEstructurados(detalleDe({ tallerista: null }))!.performer).toBeUndefined();
  });

  it('y «hay tallerista» es que tenga nombre, no que el objeto exista — B-854', () => {
    /*
     * **El documento anterior a la regla de `formADocumento`.** Desde entonces el
     * panel escribe `tallerista: null` cuando no hay nombre («el tallerista solo
     * tiene sentido si tiene nombre», `lib/actividades.ts`), pero un documento
     * cargado antes —o editado fuera del panel— conserva la cáscara. Con el
     * predicado viejo (`d.tallerista ? …`) eso publicaba `performer.name: ''`:
     * un dato falso en el formato que las máquinas creen, que es justo lo que la
     * regla 6 de este docblock evita en todo lo demás.
     *
     * Se afirma sobre el view-model **y** sobre el JSON-LD porque la corrección
     * vive en `detalleDeActividad` (D-140): la plantilla gatea la sección «Quién
     * lo da» con el mismo objeto, así que con la cáscara pintaba un `<h2>` y un
     * párrafo vacío debajo. Es la misma línea la que arregla las dos superficies.
     *
     * El `bio` cargado es a propósito: es el dato que se pierde, y perderlo es lo
     * correcto — `formADocumento` ya lo tira en el próximo guardado, y una bio sin
     * nombre no dice quién la da.
     *
     * MUTACIÓN PROBADA: volver a `tallerista: a.tallerista ? {…}` en
     * `detallePublico.ts`. Los cuatro asertos de acá se ponen rojos y ninguna otra
     * suite se entera.
     */
    for (const nombre of ['', '   ']) {
      const d = detalleDe({}, {
        tallerista: { nombre, bio: 'Dicta talleres desde 2010', instagram: '@ana' },
      } as Partial<Actividad>);
      expect(d.tallerista, JSON.stringify(nombre)).toBeNull();
      expect(datosEstructurados(d)!.performer, JSON.stringify(nombre)).toBeUndefined();
    }
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

  it('con dos formas de cursar, ningún subEvent afirma en cuál ocurre (B-734)', () => {
    /*
     * **Honestidad de datos y no privacidad**: no hay fuga, el conjunto de lugares
     * ya es público y es el mismo. Lo que pasaba es que la raíz decía «la serie
     * ocurre en estos lugares» —cierto— y cada encuentro decía «*esta* fecha
     * ocurre en todos ellos», que nadie sabe: `modalidadDeDetalle` no lleva el
     * `inicio`/`fin` de la fila al view-model, así que el JSON-LD no puede saber
     * qué encuentro va con qué lugar. Es la regla 6 al revés — afirmar más fino
     * que el dato que lo respalda.
     *
     * La serie **sí** los sigue publicando, y eso es la mitad que hace que esto no
     * sea una regresión de B-730: el item queda incompleto en el modo que Google
     * tolera, heredando del padre, y no sin lugar en ninguna parte.
     *
     * MUTACIÓN PROBADA: volver a heredar `location` siempre —sacarlo del
     * destructuring y del spread condicional, que es como estaba— deja este caso
     * en rojo y ningún otro: el fixture normal tiene una sola fila.
     */
    const ld = datosEstructurados(
      detalleDe({
        esCiclo: true,
        modalidades: ['presencial', 'virtual'],
        fechas: ['2026-09-17T22:00:00Z', '2026-09-24T22:00:00Z'],
      }),
    )!;
    expect((ld.location as Record<string, unknown>[]).map((l) => l['@type'])).toEqual([
      'Place',
      'VirtualLocation',
    ]);

    const subs = ld.subEvent as Record<string, unknown>[];
    expect(subs).toHaveLength(2);
    for (const sub of subs) {
      expect(sub).not.toHaveProperty('location');
      // Y el resto de la herencia de B-721 no se toca: lo que se cae es la
      // afirmación fina, no el item.
      expect(sub.description).toBe(ld.description);
      expect(sub.organizer).toEqual(ld.organizer);
      expect(sub.startDate).toBeTruthy();
    }
  });

  it('una sola fila híbrida conserva el lugar, aunque sean dos (B-734)', () => {
    /*
     * **La cuenta es de filas y no de lugares**, y este caso es el que lo fija:
     * una fila híbrida produce un `Place` y un `VirtualLocation`, y de cada fecha
     * de ese ciclo las dos cosas son ciertas a la vez. Lo que no se puede atribuir
     * son dos **filas** —dos formas de cursar, cada una con su ventana—.
     *
     * MUTACIÓN PROBADA: escribir la guarda sobre `lugares.length <= 1`, que es lo
     * que uno escribe leyendo «con más de un lugar no se sabe», deja este caso en
     * rojo: el ciclo híbrido pierde el lugar de todos sus encuentros sin que nada
     * más cambie.
     */
    const ld = datosEstructurados(
      detalleDe({
        esCiclo: true,
        modalidades: ['hibrido'],
        fechas: ['2026-09-17T22:00:00Z', '2026-09-24T22:00:00Z'],
      }),
    )!;
    expect((ld.location as Record<string, unknown>[]).map((l) => l['@type'])).toEqual([
      'Place',
      'VirtualLocation',
    ]);

    const subs = ld.subEvent as Record<string, unknown>[];
    expect(subs).toHaveLength(2);
    for (const sub of subs) expect(sub.location).toEqual(ld.location);
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

  it('B-190 — la plataforma «a confirmar» no sale como nombre de plataforma en el JSON-LD', () => {
    /*
     * MUTACIÓN PROBADA: sacar el spread condicional y volver a `name:
     * m.plataforma` siempre. Ese cambio pasa todos los tests de arriba —siguen
     * pidiendo un `meet`/`zoom` real— y solo se ve acá: el `VirtualLocation`
     * emitiría `name: "A confirmar"`, una plataforma inventada en los datos
     * estructurados que indexa Google.
     */
    const d = detalleDe(
      {},
      {
        modalidades: [
          {
            id: 'mod_0',
            modalidad: 'virtual',
            inicio: null,
            fin: null,
            sede: null,
            online: { plataforma: 'a-confirmar', url: '', urlPublica: false },
          },
        ],
      },
    );
    const location = datosEstructurados(d)!.location;
    const lugares = (Array.isArray(location) ? location : [location]) as Record<
      string,
      unknown
    >[];
    const virtual = lugares.find((l) => l['@type'] === 'VirtualLocation')!;
    expect(virtual.name).toBeUndefined();
    // El `url` (la canónica de la actividad) sigue estando: `VirtualLocation`
    // no deja de ser válido por no tener `name`.
    expect(virtual.url).toBe(urlDeDetalle(d.slug));
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

// ───────────────────────────────────────────────────────────────────────────
// Las opciones para sumarse — B-181
// ───────────────────────────────────────────────────────────────────────────

describe('las opciones para sumarse, en la página de detalle (B-181)', () => {
  /**
   * El reporte del dueño: «un club de lectura puede darte 4 opciones para
   * sumarte. Pero no son 4 encuentros, sino opciones».
   *
   * **Ésta es la página donde vive el malentendido**: es la única superficie que
   * muestra la lista de encuentros entera, así que dieciséis fechas de corrido se
   * leen como un ciclo de dieciséis encuentros.
   */
  const MARTES = { id: 'com_martes', etiqueta: 'Martes 19 h' };
  const JUEVES = { id: 'com_jueves', etiqueta: 'Jueves 19 h' };

  /** Dos comisiones de dos encuentros, alternadas en el tiempo. */
  const conDosComisiones = (over: Partial<Actividad> = {}) =>
    detalleDe(
      {},
      {
        esCiclo: true,
        comisiones: [MARTES, JUEVES],
        sesiones: [
          {
            id: 'ses_m1',
            comisionId: MARTES.id,
            inicio: ts('2026-09-15T22:00:00Z'),
            fin: ts('2026-09-16T00:00:00Z'),
            tema: 'Martes uno',
            lectura: null,
            cancelada: false,
            calendarEventId: null,
          },
          {
            id: 'ses_j1',
            comisionId: JUEVES.id,
            inicio: ts('2026-09-17T22:00:00Z'),
            fin: ts('2026-09-18T00:00:00Z'),
            tema: 'Jueves uno',
            lectura: null,
            cancelada: false,
            calendarEventId: null,
          },
          {
            id: 'ses_m2',
            comisionId: MARTES.id,
            inicio: ts('2026-09-22T22:00:00Z'),
            fin: ts('2026-09-23T00:00:00Z'),
            tema: 'Martes dos',
            lectura: null,
            cancelada: false,
            calendarEventId: null,
          },
          {
            id: 'ses_j2',
            comisionId: JUEVES.id,
            inicio: ts('2026-09-24T22:00:00Z'),
            fin: ts('2026-09-25T00:00:00Z'),
            tema: 'Jueves dos',
            lectura: null,
            cancelada: false,
            calendarEventId: null,
          },
        ],
        ...over,
      },
    );

  describe('los encuentros se agrupan por opción', () => {
    it('un grupo por opción, en el orden del documento y con sus fechas ordenadas', () => {
      const d = conDosComisiones();
      expect(
        d.comisiones.map((c) => [c.etiqueta, c.encuentros.map((e) => e.id)]),
      ).toEqual([
        ['Martes 19 h', ['ses_m1', 'ses_m2']],
        ['Jueves 19 h', ['ses_j1', 'ses_j2']],
      ]);
    });

    /**
     * `encuentros` sigue viajando entero y **eso no es redundancia**: lo
     * consumen el JSON-LD, «la próxima fecha» y los rótulos, que razonan sobre
     * la actividad y no sobre una de sus opciones.
     */
    it('la lista plana sigue estando, con los cuatro y en orden cronológico', () => {
      expect(conDosComisiones().encuentros.map((e) => e.id)).toEqual([
        'ses_m1',
        'ses_j1',
        'ses_m2',
        'ses_j2',
      ]);
    });

    it('sin opciones la lista de grupos está vacía y la plana no cambia', () => {
      // Es el caso de todas las actividades de hoy: la plantilla pinta la lista
      // de siempre porque no hay grupos que pintar.
      const d = detalleDe({ fechas: ['2026-09-15T22:00:00Z', '2026-09-22T22:00:00Z', '2026-09-29T22:00:00Z'] });
      expect(d.comisiones).toEqual([]);
      expect(d.encuentros).toHaveLength(3);
    });

    it('una opción sin nombre o sin encuentros no se emite', () => {
      /*
       * Las dos son etiquetas a medio cargar y pintarlas dejaría un encabezado
       * con nada abajo. El schema no deja publicar la primera; la segunda sí es
       * publicable —una opción que todavía no tiene fechas— y no tiene nada que
       * mostrar en la página.
       */
      const d = conDosComisiones({
        comisiones: [MARTES, JUEVES, { id: 'com_vacia', etiqueta: 'Sábados 11 h' }],
      });
      expect(d.comisiones.map((c) => c.etiqueta)).toEqual(['Martes 19 h', 'Jueves 19 h']);
    });
  });

  describe('el número de cada encuentro es el de su opción', () => {
    /**
     * Es la misma regla que el evento de Calendar (`numeroDeEncuentro`, D-520):
     * quien cursa los martes va a dos encuentros, no a los cuatro del ciclo.
     */
    it('el segundo de los martes es el 2, aunque por fecha sea el tercero', () => {
      /*
       * MUTACIÓN PROBADA: volviendo a `numero: i + 1` sobre la lista ordenada
       * —lo que hacía antes de B-181— este caso da 3 y falla.
       */
      const d = conDosComisiones();
      expect(d.encuentros.find((e) => e.id === 'ses_m2')!.numero).toBe(2);
      expect(d.encuentros.find((e) => e.id === 'ses_j1')!.numero).toBe(1);
    });

    it('sin opciones se numera sobre el ciclo entero, como siempre', () => {
      expect(detalleDe({ fechas: ['2026-09-15T22:00:00Z', '2026-09-22T22:00:00Z', '2026-09-29T22:00:00Z'] }).encuentros.map((e) => e.numero)).toEqual([1, 2, 3]);
    });

    it('cada encuentro dice de qué opción es, con su etiqueta y NADA más', () => {
      /*
       * **Solo la etiqueta, y el `toEqual` es el que lo fija:** el id del grupo
       * no viaja al view-model. La página no lo necesita —los grupos ya vienen
       * armados— y publicarlo sería una entrada más en la lista blanca del §5.1
       * a cambio de nada. Lo cobró el `auditor-privacidad`, y el barrido de
       * centinelas se pone rojo si vuelve (la excepción se borró).
       */
      const d = conDosComisiones();
      expect(d.encuentros.find((e) => e.id === 'ses_j2')!.comision).toEqual({
        etiqueta: JUEVES.etiqueta,
      });
    });

    it('un `comisionId` colgado se lee como «sin opción» y no rompe la página', () => {
      // El schema lo rechaza al publicar; solo puede llegar editado a mano, o por
      // una actividad **cancelada** (B-110), que conserva su página y no pasa por
      // el nivel «publicar».
      const d = conDosComisiones({ comisiones: [JUEVES] });
      expect(d.encuentros.find((e) => e.id === 'ses_m1')!.comision).toBeNull();
    });

    describe('y el encuentro huérfano NO desaparece de la página', () => {
      /**
       * **Era el peor de los cinco hallazgos del `auditor-privacidad`.** Con los
       * grupos armados solo desde `comisiones`, un encuentro cuyo `comisionId` no
       * resuelve se caía de la página: no estaba en ningún grupo, y la plantilla
       * pinta los grupos cuando la lista no está vacía.
       *
       * `lib/comisiones.ts` tiene la bolsa `sinComision` exactamente por esto —
       * «perder una fila en pantalla es el peor de los dos errores posibles»— y el
       * lado público cometía ese error.
       */
      it('sale en un grupo final sin encabezado', () => {
        /*
         * MUTACIÓN PROBADA: armando `grupos` solo desde `a.comisiones` —lo que
         * hacía antes— este caso falla: `ses_m1` y `ses_m2` no aparecen en ningún
         * grupo.
         */
        const d = conDosComisiones({ comisiones: [JUEVES] });
        const ultimo = d.comisiones[d.comisiones.length - 1]!;
        expect(ultimo.etiqueta).toBe('');
        expect(ultimo.encuentros.map((e) => e.id)).toEqual(['ses_m1', 'ses_m2']);
      });

      it('no aparece ningún grupo vacío cuando NINGUNA opción resuelve', () => {
        // Con todas colgadas no hay nada que agrupar: la página vuelve a la lista
        // plana de siempre, que es lo que corresponde («no hay opciones»).
        const d = conDosComisiones({ comisiones: [] });
        expect(d.comisiones).toEqual([]);
        expect(d.encuentros).toHaveLength(4);
      });

      it('la página y el evento numeran igual al huérfano (B-88)', () => {
        /*
         * Los dos agrupan los huérfanos **entre ellos**: la página resolviendo la
         * referencia antes de contar, y `numeroDeEncuentro` de `@calendario` con
         * `comisionDe`, que devuelve `null` para un id que no existe. Antes de la
         * corrección la página los numeraba en un balde por id colgado y el evento
         * a todos juntos: el mismo encuentro con dos números.
         */
        const d = conDosComisiones({ comisiones: [JUEVES] });
        expect(d.encuentros.filter((e) => !e.comision).map((e) => e.numero)).toEqual([1, 2]);
      });
    });
  });

  describe('el rótulo del ciclo cambia de sujeto', () => {
    /**
     * «Ciclo de 4 encuentros» sería **falso para todo el mundo** cuando son dos
     * opciones de dos: nadie va a los cuatro.
     */
    it('dice cuántas opciones hay y, si son parejas, cuántos encuentros cada una', () => {
      expect(conDosComisiones().rotuloCiclo).toContain('2 opciones para sumarse');
      expect(conDosComisiones().rotuloCiclo).toContain('2 encuentros cada una');
    });

    it('si las opciones tienen distinta cantidad, no se elige un número', () => {
      /*
       * Ni el máximo ni el de la primera: las dos serían una afirmación falsa
       * para alguien. El detalle está en la lista, tres párrafos más abajo.
       */
      const d = conDosComisiones({
        comisiones: [MARTES, JUEVES],
        sesiones: [
          {
            id: 'ses_m1',
            comisionId: MARTES.id,
            inicio: ts('2026-09-15T22:00:00Z'),
            fin: ts('2026-09-16T00:00:00Z'),
            tema: null,
            lectura: null,
            cancelada: false,
            calendarEventId: null,
          },
          {
            id: 'ses_j1',
            comisionId: JUEVES.id,
            inicio: ts('2026-09-17T22:00:00Z'),
            fin: ts('2026-09-18T00:00:00Z'),
            tema: null,
            lectura: null,
            cancelada: false,
            calendarEventId: null,
          },
          {
            id: 'ses_j2',
            comisionId: JUEVES.id,
            inicio: ts('2026-09-24T22:00:00Z'),
            fin: ts('2026-09-25T00:00:00Z'),
            tema: null,
            lectura: null,
            cancelada: false,
            calendarEventId: null,
          },
        ],
      });
      expect(d.rotuloCiclo).toContain('2 opciones para sumarse');
      expect(d.rotuloCiclo).not.toMatch(/encuentros cada una/);
    });

    it('sin opciones el rótulo es el de siempre', () => {
      expect(
        detalleDe({
          esCiclo: true,
          fechas: [
            '2026-09-15T22:00:00Z',
            '2026-09-22T22:00:00Z',
            '2026-09-29T22:00:00Z',
            '2026-10-06T22:00:00Z',
          ],
        }).rotuloCiclo,
      ).toContain('Ciclo de 4 encuentros');
    });
  });

  describe('el JSON-LD nombra la opción de cada `subEvent`', () => {
    /**
     * **Y con la misma función que el evento de Calendar** (`tituloDeEvento` de
     * `@calendario`). Dos composiciones para el mismo texto es la clase de B-88 y
     * acá se separarían en silencio: nada falla si el evento dice «— Martes 19 h»
     * y Google lee «· Martes 19 h».
     */
    it('el `name` lleva la etiqueta y después el tema', () => {
      const ld = datosEstructurados(conDosComisiones()) as {
        subEvent: { name: string }[];
      };
      expect(ld.subEvent.map((s) => s.name)).toEqual([
        'Taller de crónica — Martes 19 h · Martes uno',
        'Taller de crónica — Jueves 19 h · Jueves uno',
        'Taller de crónica — Martes 19 h · Martes dos',
        'Taller de crónica — Jueves 19 h · Jueves dos',
      ]);
    });

    it('sin opciones el `name` es exactamente el de antes', () => {
      // Es D-95 en la otra superficie: el markup de las actividades publicadas
      // no cambia una coma por este ítem.
      const ld = datosEstructurados(
        detalleDe({ fechas: ['2026-09-15T22:00:00Z', '2026-09-22T22:00:00Z'] }),
      ) as { subEvent: { name: string }[] };
      // El formato de siempre: título + ` — ` + tema, con **una** raya y sin
      // ningún `·` de más.
      expect(ld.subEvent[0]!.name).toBe('Taller de crónica — Tema 1');
    });
  });
});

describe('los grupos de opciones no pierden ni inventan encuentros (B-181)', () => {
  /**
   * **Las tres cosas de acá las encontró la segunda pasada del
   * `auditor-privacidad`, y las tres las había producido el arreglo de la
   * primera.** Vale anotarlo: la corrección de un hallazgo es código nuevo y hay
   * que auditarla como tal.
   */
  const MARTES = { id: 'com_martes', etiqueta: 'Martes 19 h' };
  const SIN_NOMBRE = { id: 'com_nueva', etiqueta: '' };

  const sesion = (id: string, comisionId: string | null, dia: string, cancelada = false) => ({
    id,
    comisionId,
    inicio: ts(`2026-09-${dia}T22:00:00Z`),
    fin: ts(`2026-09-${dia}T23:59:00Z`),
    tema: null,
    lectura: null,
    cancelada,
    calendarEventId: null,
  });

  const con = (comisiones: { id: string; etiqueta: string }[], sesiones: unknown[]) =>
    detalleDe({}, { esCiclo: true, comisiones, sesiones } as Partial<Actividad>);

  /**
   * **La propiedad, no el caso.** Un filtro de más en el armado de los grupos
   * hace desaparecer filas de la página sin que nada falle, y ya pasó dos veces
   * en la misma tanda (el huérfano y la comisión sin nombre). Esto lo fija de una
   * vez: lo que se pinta agrupado es **exactamente** lo que hay.
   */
  it('la unión de los grupos son todos los encuentros, siempre', () => {
    /*
     * **La quinta forma lleva cancelados, y eso lo cobró la tercera pasada del
     * `auditor-privacidad`:** con las cuatro primeras todas en `cancelada: false`,
     * la mutación «no repetir los cancelados en cada opción» —un
     * `.filter(x => !x.encuentro.cancelada)` en el armado de los grupos— dejaba los
     * cuatro casos en verde y sacaba los cancelados de la página. Es plausible como
     * cambio y su daño es exactamente lo que B-110 decide que no puede pasar: «el
     * cancelado sigue visible», porque quien tenía esa fecha anotada necesita ver
     * que se movió.
     *
     * Y el `expect` de arriba del loop es la otra mitad: sin él, el `continue`
     * podía dejar el `it` con cero aserciones y **pasar vacío**.
     */
    const casos = [
      con([MARTES], [sesion('s1', MARTES.id, '15'), sesion('s2', MARTES.id, '22')]),
      con([MARTES, SIN_NOMBRE], [sesion('s1', MARTES.id, '15'), sesion('s2', SIN_NOMBRE.id, '22')]),
      con([MARTES], [sesion('s1', MARTES.id, '15'), sesion('s2', 'com_borrada', '22')]),
      con([MARTES], [sesion('s1', MARTES.id, '15'), sesion('s2', null, '22')]),
      con(
        [MARTES, SIN_NOMBRE],
        [
          sesion('s1', MARTES.id, '15'),
          sesion('s2', MARTES.id, '22', true),
          sesion('s3', SIN_NOMBRE.id, '24', true),
          sesion('s4', 'com_borrada', '29', true),
        ],
      ),
    ];

    // Las cinco formas tienen que **entrar** al invariante: si alguna deja de
    // producir grupos, el loop no la mira y el test se vuelve vacío sin ponerse
    // rojo.
    expect(
      casos.filter((d) => d.comisiones.length > 0),
      'las cinco formas tienen que producir grupos: si no, el invariante no se evalúa',
    ).toHaveLength(casos.length);

    for (const d of casos) {
      expect(d.comisiones.flatMap((c) => c.encuentros.map((e) => e.id)).sort()).toEqual(
        d.encuentros.map((e) => e.id).sort(),
      );
    }
  });

  it('una opción sin nombre pero con encuentros los pinta igual, sin encabezado', () => {
    /*
     * Es alcanzable sin editar nada a mano: la regla que pide el nombre vive en el
     * nivel «publicar», y una **cancelada** conserva su página indexada (B-110).
     *
     * MUTACIÓN PROBADA: con el filtro viejo (`g.comision.etiqueta && …`) los dos
     * encuentros de la opción sin nombre no aparecen en ningún grupo, y como la
     * otra opción sí tiene nombre la plantilla entra por la rama de grupos: esas
     * dos fechas no se pintan en ninguna parte.
     */
    const d = con(
      [MARTES, SIN_NOMBRE],
      [
        sesion('s1', MARTES.id, '15'),
        sesion('s2', SIN_NOMBRE.id, '22'),
        sesion('s3', SIN_NOMBRE.id, '29'),
      ],
    );
    const sinTitulo = d.comisiones.find((c) => !c.etiqueta)!;
    expect(sinTitulo.encuentros.map((e) => e.id)).toEqual(['s2', 's3']);
  });

  describe('el rótulo cuenta opciones, no grupos', () => {
    it('el grupo sin encabezado no se cuenta como una opción', () => {
      /*
       * MUTACIÓN PROBADA: pasándole `grupos` sin filtrar a `rotuloDeCiclo`, esto
       * dice «2 opciones para sumarse» habiendo una.
       */
      const d = con([MARTES], [sesion('s1', MARTES.id, '15'), sesion('s2', null, '22')]);
      expect(d.rotuloCiclo).toContain('1 opción para sumarse');
      expect(d.rotuloCiclo).not.toContain('2 opciones');
    });

    it('con una sola opción va en singular y NO dice «cada una»', () => {
      /*
       * «1 opciones para sumarse» en una página indexada, y es alcanzable
       * publicando normal: con una comisión el schema no dice nada. El «cada una»
       * es la mitad que la corrección anterior había dejado afuera —lo cobró la
       * tercera pasada—: no tiene con qué comparar cuando hay una sola.
       */
      const d = con([MARTES], [sesion('s1', MARTES.id, '15'), sesion('s2', MARTES.id, '22')]);
      expect(d.rotuloCiclo).toContain('1 opción para sumarse');
      expect(d.rotuloCiclo).not.toMatch(/1 opciones/);
      expect(d.rotuloCiclo).not.toContain('cada una');
    });

    it('una opción sin encuentros vivos no publica «0 encuentros cada una»', () => {
      /*
       * El corte temprano de `rotuloDeCiclo` es `vivos.length === 0` y es
       * **global**: una comisión con nombre y todos sus encuentros cancelados, más
       * un encuentro vivo huérfano, llega hasta la cuenta por opción con cero. Y
       * ésa es la rama de la cancelada, que conserva página indexada (B-110).
       */
      const d = con(
        [MARTES, SIN_NOMBRE],
        [
          sesion('s1', MARTES.id, '15', true),
          sesion('s2', MARTES.id, '22', true),
          sesion('s3', SIN_NOMBRE.id, '24'),
        ],
      );
      expect(d.rotuloCiclo).not.toContain('0 encuentros');
    });

    it('dos opciones sin encuentros vivos tampoco publican «0 encuentros cada una»', () => {
      /*
       * **El caso de arriba pasaba por la razón equivocada**, y lo cobró el
       * `auditor-trampas`: con una sola comisión con nombre, el `cada` se suprime
       * por la rama `comisiones.length === 1` **antes** de mirar `parejas === 0`.
       * O sea que sacar el término del cero dejaba ese test en verde.
       *
       * Para ejercitar la rama del cero hacen falta **dos** comisiones con nombre,
       * las dos con todos sus encuentros cancelados, más un huérfano vivo aparte
       * —el huérfano es lo que sostiene `vivos.length > 0` y evita el corte
       * temprano—. Es el escenario que el comentario del código describe, y es
       * alcanzable: una cancelada con página indexada (B-110).
       *
       * MUTACIÓN PROBADA: sacando `parejas === 0` de la condición, este caso falla
       * con «2 opciones para sumarse · 0 encuentros cada una».
       */
      const JUEVES = { id: 'com_jueves', etiqueta: 'Jueves 19 h' };
      const d = con(
        [MARTES, JUEVES],
        [
          sesion('s1', MARTES.id, '15', true),
          sesion('s2', JUEVES.id, '17', true),
          sesion('s3', null, '24'),
        ],
      );
      expect(d.opcionesConNombre).toBe(2);
      expect(d.rotuloCiclo).not.toContain('0 encuentros');
    });

    it('una etiqueta de solo espacios no cuenta como opción ni pinta encabezado', () => {
      /*
       * **Por dónde llega, dicho bien:** no por el panel. `formADocumento` trima la
       * etiqueta (`limpiar`), así que las dos puertas del formulario la dejan
       * limpia — la primera versión de este comentario decía que el form se
       * escribe crudo y era falso para este campo; lo cobró el
       * `auditor-privacidad`. Llega por un documento **editado a mano** o por una
       * versión vieja restaurada verbatim, que es la misma clase que la defensa de
       * `comisionDe` contra un `comisionId` colgado.
       *
       * Y el estado que la acepta con la regla del nombre en el nivel publicar es
       * `cancelado`, que conserva página indexada (B-110).
       *
       * MUTACIÓN PROBADA: sacando el `.trim()` del `Map` de etiquetas, esto cuenta
       * la opción («1 opción para sumarse») y pinta un `<h3>` vacío.
       */
      const d = con(
        [{ id: 'com_espacios', etiqueta: '   ' }],
        [sesion('s1', 'com_espacios', '15'), sesion('s2', 'com_espacios', '22')],
      );
      expect(d.opcionesConNombre).toBe(0);
      expect(d.comisiones.map((c) => c.etiqueta)).toEqual(['']);
      expect(d.rotuloCiclo).not.toContain('opción para sumarse');
    });

    it('el `subEvent` del JSON-LD usa la misma etiqueta trimada que el encabezado (B-88)', () => {
      /*
       * **La mitad que el `.trim()` no cubría.** `EncuentroDeDetalle.comision
       * .etiqueta` no sale del grupo: sale del `Map` que resuelve la referencia, y
       * es lo que `tituloDeEvento` usa para el `name` de cada `subEvent`. Con la
       * etiqueta cruda, el `<h3>` decía una cosa y Google leía otra —que es
       * justamente la divergencia que `tituloDeEvento` existe para evitar—.
       *
       * MUTACIÓN PROBADA: sacando el `.trim()` del `Map`, el `name` sale como
       * «Taller de crónica —    · Martes uno» y este caso falla.
       */
      const d = con(
        [{ id: 'com_espacios', etiqueta: '  Martes 19 h  ' }],
        [sesion('s1', 'com_espacios', '15'), sesion('s2', 'com_espacios', '22')],
      );
      expect(d.comisiones[0]!.etiqueta).toBe('Martes 19 h');
      const ld = datosEstructurados(d) as { subEvent: { name: string }[] };
      expect(ld.subEvent[0]!.name).toBe('Taller de crónica — Martes 19 h');
    });

    it('la cuenta de horarios del view-model es la misma que cuenta el rótulo (B-88)', () => {
      /*
       * Las tres frases públicas —el rótulo de la ficha, el `<h2>` de la sección y
       * la bajada— salen de la **misma** cuenta. Vivía dos veces, una acá y una en
       * el frontmatter del `.astro`, y ningún test la nombraba porque un `.astro`
       * no se importa desde vitest (D-140).
       */
      const d = con([MARTES, SIN_NOMBRE], [sesion('s1', MARTES.id, '15'), sesion('s2', SIN_NOMBRE.id, '22')]);
      expect(d.opcionesConNombre).toBe(1);
      expect(d.rotuloCiclo).toContain('1 opción para sumarse');

      const dos = con(
        [MARTES, { id: 'com_jueves', etiqueta: 'Jueves 19 h' }],
        [sesion('s1', MARTES.id, '15'), sesion('s2', 'com_jueves', '17')],
      );
      expect(dos.opcionesConNombre).toBe(2);
      expect(dos.rotuloCiclo).toContain('2 opciones para sumarse');
    });
  });
});

describe('la etiqueta de una opción se sanea en un solo lugar (B-181, clase de B-88)', () => {
  /**
   * **Un chequeo estructural, y hace falta por lo que ya pasó dos veces en este
   * mismo ítem.** Los casos de comportamiento prueban cada salida por separado —el
   * detalle acá, el evento en `tests/calendario.test.ts`— así que si alguien vuelve
   * a inlinear el saneado en uno de los dos lados **todo queda verde** y la
   * divergencia entre la salida 2 y la 6 vuelve a estar a un carácter. Eso es
   * exactamente lo que pasó: el primer arreglo del espacio en blanco quedó del lado
   * del sitio y la divergencia se mudó, no se cerró.
   *
   * Lo pidió el `auditor-privacidad`, con el molde que este repo ya usa para las
   * propiedades del grafo de imports (`tests/pagina-de-detalle.test.ts`,
   * `tests/bundle-panel.test.ts`): se lee la fuente, porque lo que se afirma es qué
   * **nombra** el archivo.
   */
  /*
   * **Sobre el código y no sobre los comentarios de bloque ni los de línea
   * completa** — es la lección de B-799, y este chequeo la necesitaba desde el
   * primer intento: el docblock de al lado **cita** `etiqueta.trim() !== ''` para
   * explicar qué hace el schema, así que buscar en el archivo entero daba rojo por
   * una cita.
   *
   * Los comentarios **al final de una línea de código** no se barren, y es a
   * propósito: el archivo tiene catorce `https://` y un regex de `//` a fin de
   * línea se los llevaría, rompiendo el aserto positivo. La consecuencia —un
   * `// …etiqueta.trim()…` pegado a una línea de código daría rojo— es la
   * dirección segura del error. Lo precisó el `auditor-privacidad`.
   */
  const sinComentarios = (src: string): string =>
    src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');

  const fuente = sinComentarios(readFileSync('src/lib/detallePublico.ts', 'utf8'));

  it('el detalle importa `etiquetaDeComision` de `@calendario`', () => {
    expect(fuente).toMatch(/etiquetaDeComision as etiquetaSaneada/);
    // Y que el barrido de comentarios no se llevó el código: si `sinComentarios`
    // vaciara el archivo, el caso de abajo pasaría por eso.
    expect(fuente).toContain('etiquetaSaneada(g.comision)');
  });

  it('y no vuelve a derivar el saneado por su cuenta', () => {
    /*
     * MUTACIÓN PROBADA: reemplazando `etiquetaSaneada(c)` por
     * `(c.etiqueta ?? '').trim() || null`, este caso falla nombrando la línea.
     *
     * El patrón busca `.trim()` aplicado a algo que se llame `etiqueta`, que es la
     * forma que tomó las dos veces.
     */
    const reimplementaciones = [...fuente.matchAll(/etiqueta[^\n]*\.trim\(\)/g)].map((m) => m[0]);
    expect(
      reimplementaciones,
      `estas líneas vuelven a derivar «esta comisión tiene nombre» en vez de usar ` +
        `\`etiquetaSaneada\`: ${reimplementaciones.join(' · ')}. Dos derivaciones en dos ` +
        `salidas es la clase de B-88, y acá se separan en silencio.`,
    ).toEqual([]);
  });
});
