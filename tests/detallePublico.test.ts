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
  urlSegura,
} from '@/lib/detallePublico';
import { mapaDeEtiquetas } from '@/lib/listadoPublico';
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

const detalleDe = (o: OpcionesDeEntrada = {}, over: Partial<Actividad> = {}, ahora = AHORA) =>
  detalleDeActividad(
    toPublic({ ...actividadDePrueba(o), ...over }, o.id ?? 'act_1'),
    ETIQUETAS,
    ahora,
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

  it('el JSON-LD no lleva URLs absolutas inventadas (B-109 todavía abierto)', () => {
    /*
     * `canonical`, `og:` y `url` necesitan `site` en la config, que necesita el
     * dominio decidido. Inventar una URL ahora es peor que no ponerla: una
     * canónica equivocada le dice a Google que la página buena es otra.
     */
    const texto = JSON.stringify(datosEstructurados(detalleDe())!);
    expect(texto).not.toContain('"url":"/');
    expect(texto).not.toContain('agenda-literaria.web.app');
  });
});
