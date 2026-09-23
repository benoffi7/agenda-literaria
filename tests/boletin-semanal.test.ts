import { describe, expect, it } from 'vitest';

import {
  AVISO_DE_CAMBIOS,
  DIAS_DEL_BOLETIN,
  boletinSemanal,
  htmlDelBoletin,
  textoPlanoDelBoletin,
  ventanaDelBoletin,
} from '@/lib/boletinSemanal';
import { construirIndice, type Indice } from '@/lib/eventsJson';
import { claveDeDia, diaDeSemana, fechaLargaDeDia } from '@/lib/fechasPublicas';
import { mapaDeEtiquetas } from '@/lib/listadoPublico';
import { SITIO } from '@/lib/rutasPublicas';
import { toPublic } from '@/lib/toPublic';
import { actividadDePrueba, type OpcionesDeEntrada } from './fixtures/indice';

/**
 * El borrador del correo semanal (B-1230).
 *
 * ── Qué se puede romper acá, que no es que se rompa ───────────────────────
 * Igual que el tríptico del que este módulo es pariente: **nada de esto deja el
 * build en rojo, y todo produce un correo que se ve perfecto**. La diferencia es
 * el costo — el tríptico se corrige con un rebuild y un correo no se corrige.
 *
 * 1. **La zona horaria (trampa 1).** Un encuentro a las 00:30 de Buenos Aires es
 *    el día anterior en UTC: agrupado con `getDate()` sale bajo el encabezado de
 *    ayer, y quien lo lee llega un día tarde.
 * 2. **«Lo que queda de hoy».** Un correo escrito a la noche que anuncia el
 *    taller de las siete de esa misma tarde manda gente a una puerta cerrada.
 * 3. **La ventana.** Un encuentro del octavo día adentro de un correo que dice
 *    «esta semana», o el del séptimo afuera, y nadie se entera de ninguno de los
 *    dos.
 * 4. **El escape del HTML.** Un título con `&` o con `<` sale roto en la casilla
 *    de todos los suscriptos. Es la clase de la trampa 11: lo que se le entrega
 *    a un parser ajeno se escapa siempre.
 * 5. **El total del asunto.** El asunto promete un número verificable; si no
 *    coincide con las filas, lo desmiente el propio correo tres renglones abajo.
 *
 * **La privacidad de esta salida no se verifica acá**: va con centinelas, con
 * las otras veintiocho, en `tests/barrido-de-salidas-publicas.test.ts`
 * («barrido del correo semanal»). Acá el fixture tiene valores legibles, que es
 * lo que deja leer un test de orden y de agrupación — el mismo reparto que
 * explica `tests/fixtures/indice.ts`.
 *
 * ── El reloj entra como parámetro ─────────────────────────────────────────
 * La semana de referencia es la del **lunes 14 de septiembre de 2026**, la misma
 * que `tests/ahoraPublico.test.ts`, y el primer `describe` lo verifica antes que
 * nada.
 */

const ETIQUETAS = mapaDeEtiquetas({
  tipo: [
    { slug: 'taller', label: 'Taller' },
    { slug: 'club-lectura', label: 'Club de lectura' },
  ],
  barrio: [{ slug: 'villa-crespo', label: 'Villa Crespo' }],
  arancel: [
    { slug: 'a-la-gorra', label: 'A la gorra' },
    { slug: 'arancelado', label: 'Arancelado' },
  ],
  plataforma: [{ slug: 'meet', label: 'Google Meet' }],
});

/** Bien antes de cualquier fecha de estos casos: el eje no recorta nada. */
const GENERADO_EN = '2026-09-01T00:00:00.000Z';

/**
 * El índice, pasado por las dos proyecciones reales — mismo criterio que el test
 * del tríptico: el eje plano de encuentros lo calcula `construirIndice` y no un
 * literal escrito a mano.
 */
const indiceDePrueba = (actividades: readonly OpcionesDeEntrada[]): Indice =>
  construirIndice({
    actividades: actividades.map((o, i) =>
      toPublic(actividadDePrueba(o), o.id ?? o.slug ?? `act_${i}`),
    ),
    opciones: {},
    version: '1.8.0+abc1234',
    generadoEn: GENERADO_EN,
  });

/** Las 11:00 de Buenos Aires de un día, que es el `ahora` neutro de un caso. */
const manana = (dia: string): Date => new Date(`${dia}T14:00:00Z`);

/** Un encuentro suelto, en su propia actividad. */
const encuentro = (
  i: number,
  iso: string,
  over: OpcionesDeEntrada = {},
): OpcionesDeEntrada => ({
  id: `act_${i}`,
  slug: `actividad-${i}`,
  titulo: `Actividad ${i}`,
  fechas: [iso],
  ...over,
});

// ───────────────────────────────────────────────────────────────────────────
// 0 · Control positivo: la semana de referencia es la que los casos dicen
// ───────────────────────────────────────────────────────────────────────────

describe('la semana de referencia de este archivo', () => {
  it('el 14 de septiembre de 2026 es lunes', () => {
    expect(diaDeSemana('2026-09-14')).toBe(1);
    expect(diaDeSemana('2026-09-20')).toBe(0);
  });

  it('y el fixture produce el eje de encuentros, no un array vacío', () => {
    // Sin esto, cualquier caso que dé `null` se leería como «no había nada esa
    // semana» cuando en realidad el fixture no emitió ni un encuentro.
    expect(indiceDePrueba([encuentro(1, '2026-09-15T22:00:00Z')]).encuentros).toHaveLength(1);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 1 · La ventana
// ───────────────────────────────────────────────────────────────────────────

describe('la ventana del correo', () => {
  it('son siete días corridos desde hoy, hoy incluido', () => {
    expect(ventanaDelBoletin(manana('2026-09-14'))).toEqual([
      '2026-09-14',
      '2026-09-15',
      '2026-09-16',
      '2026-09-17',
      '2026-09-18',
      '2026-09-19',
      '2026-09-20',
    ]);
    expect(ventanaDelBoletin(manana('2026-09-14'))).toHaveLength(DIAS_DEL_BOLETIN);
  });

  it('cruza el fin de mes sin pensarlo', () => {
    expect(ventanaDelBoletin(manana('2026-09-28'))).toContain('2026-10-04');
  });

  it('no es la semana calendario: el miércoles arranca el miércoles', () => {
    /*
     * La diferencia que justifica D-800bis: un correo que sale el miércoles y
     * abarca de lunes a domingo habla de dos días que ya pasaron y calla los dos
     * siguientes. Lo que se manda es lo que viene, contado desde el día que se
     * manda.
     */
    const ventana = ventanaDelBoletin(manana('2026-09-16'));
    expect(ventana[0]).toBe('2026-09-16');
    expect(ventana).not.toContain('2026-09-14');
    expect(ventana).toContain('2026-09-22');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 2 · Qué entra y qué no
// ───────────────────────────────────────────────────────────────────────────

describe('qué encuentros entran', () => {
  const ahora = manana('2026-09-14');

  it('los de los siete días, y ninguno del octavo', () => {
    const indice = indiceDePrueba([
      encuentro(1, '2026-09-14T22:00:00Z'),
      encuentro(2, '2026-09-20T22:00:00Z'),
      encuentro(3, '2026-09-21T22:00:00Z'),
    ]);
    const b = boletinSemanal(indice, ahora, ETIQUETAS);
    expect(b).not.toBeNull();
    expect(b!.total).toBe(2);
    expect(b!.dias.map((d) => d.clave)).toEqual(['2026-09-14', '2026-09-20']);
  });

  it('descarta lo que ya empezó hoy, aunque sea de hoy', () => {
    // 09:00 de Buenos Aires: ya pasó a las 11:00, que es el `ahora` del caso.
    const indice = indiceDePrueba([
      encuentro(1, '2026-09-14T12:00:00Z'),
      encuentro(2, '2026-09-14T22:00:00Z'),
    ]);
    const b = boletinSemanal(indice, ahora, ETIQUETAS);
    expect(b!.total).toBe(1);
    expect(b!.dias[0]!.encuentros[0]!.titulo).toBe('Actividad 2');
  });

  it('descarta los encuentros cancelados, porque el índice ya no los trae', () => {
    const indice = indiceDePrueba([
      { ...encuentro(1, '2026-09-15T22:00:00Z'), canceladas: [0] },
    ]);
    expect(boletinSemanal(indice, ahora, ETIQUETAS)).toBeNull();
  });

  it('devuelve `null` cuando no hay nada en la ventana, y no un correo vacío', () => {
    /*
     * Es lo que `/suscribirse` promete —«la semana que no haya nada que valga la
     * pena, no sale»—. Un borrador vacío invita a mandarlo igual.
     */
    const indice = indiceDePrueba([encuentro(1, '2026-10-15T22:00:00Z')]);
    expect(boletinSemanal(indice, ahora, ETIQUETAS)).toBeNull();
  });

  it('descarta un encuentro cuya actividad no está en el índice', () => {
    /*
     * No debería pasar —los dos ejes salen del mismo build— pero el índice lo
     * sirve un CDN. Una fila sin título en un correo ya está en la casilla de
     * todos: mismo criterio que el tríptico, con más motivo.
     */
    const indice = indiceDePrueba([encuentro(1, '2026-09-15T22:00:00Z')]);
    const roto: Indice = { ...indice, actividades: [] };
    expect(boletinSemanal(roto, ahora, ETIQUETAS)).toBeNull();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 3 · La agrupación por día, y la trampa 1
// ───────────────────────────────────────────────────────────────────────────

describe('la agrupación por día', () => {
  it('agrupa en orden de día y de horario, con el rótulo entero', () => {
    const indice = indiceDePrueba([
      encuentro(1, '2026-09-16T23:00:00Z'),
      encuentro(2, '2026-09-15T22:00:00Z'),
      encuentro(3, '2026-09-16T21:00:00Z'),
    ]);
    const b = boletinSemanal(indice, manana('2026-09-14'), ETIQUETAS)!;

    expect(b.dias.map((d) => d.clave)).toEqual(['2026-09-15', '2026-09-16']);
    expect(b.dias[0]!.rotulo).toBe('martes 15 de septiembre');
    expect(b.dias[1]!.encuentros.map((e) => e.hora)).toEqual(['18:00', '20:00']);
  });

  it('un encuentro de las 00:30 de Buenos Aires cae en SU día, no en el anterior (trampa 1)', () => {
    /*
     * `2026-09-17T03:30:00Z` son las 00:30 del **17** en Buenos Aires. Con
     * `getDate()` sobre el `Date` crudo el día sería el 17 en UTC y el 16 acá
     * según dónde corra: agrupado mal, la fila sale bajo el encabezado de ayer.
     */
    const iso = '2026-09-17T03:30:00Z';
    expect(claveDeDia(new Date(iso))).toBe('2026-09-17');

    const b = boletinSemanal(
      indiceDePrueba([encuentro(1, iso)]),
      manana('2026-09-14'),
      ETIQUETAS,
    )!;
    expect(b.dias).toHaveLength(1);
    expect(b.dias[0]!.clave).toBe('2026-09-17');
    expect(b.dias[0]!.rotulo).toBe(fechaLargaDeDia('2026-09-17'));
    expect(b.dias[0]!.encuentros[0]!.hora).toBe('00:30');
  });

  it('no corta: los seis encuentros de un día salen los seis', () => {
    /*
     * A diferencia del tríptico (`TOPE_DEL_PANEL`), que corta porque el listado
     * completo está unos centímetros más abajo. En un correo no hay nada más
     * abajo.
     */
    const horas = [18, 19, 20, 21, 22, 23];
    const indice = indiceDePrueba(
      horas.map((h, i) => encuentro(i, `2026-09-15T${h}:00:00Z`)),
    );
    const b = boletinSemanal(indice, manana('2026-09-14'), ETIQUETAS)!;
    expect(b.dias).toHaveLength(1);
    expect(b.dias[0]!.encuentros).toHaveLength(horas.length);
    expect(b.total).toBe(horas.length);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 4 · El asunto y el encabezado
// ───────────────────────────────────────────────────────────────────────────

describe('el asunto', () => {
  it('dice el total, y coincide con las filas que el correo trae', () => {
    const indice = indiceDePrueba([
      encuentro(1, '2026-09-15T22:00:00Z'),
      encuentro(2, '2026-09-16T22:00:00Z'),
      encuentro(3, '2026-09-17T22:00:00Z'),
    ]);
    const b = boletinSemanal(indice, manana('2026-09-14'), ETIQUETAS)!;
    expect(b.asunto).toBe('Esta semana: 3 encuentros literarios');
    expect(b.dias.flatMap((d) => d.encuentros)).toHaveLength(3);
  });

  it('concuerda en singular con uno solo', () => {
    const b = boletinSemanal(
      indiceDePrueba([encuentro(1, '2026-09-15T22:00:00Z')]),
      manana('2026-09-14'),
      ETIQUETAS,
    )!;
    expect(b.asunto).toBe('Esta semana: 1 encuentro literario');
  });

  it('el rango de fechas es el de la ventana, no el del primer y el último encuentro', () => {
    /*
     * «Del lunes 14 al domingo 20» es cierto del correo; «del martes 15 al
     * miércoles 16» sería cierto de lo que trae, y haría pensar que el resto de
     * la semana no se miró.
     */
    const b = boletinSemanal(
      indiceDePrueba([encuentro(1, '2026-09-16T22:00:00Z')]),
      manana('2026-09-14'),
      ETIQUETAS,
    )!;
    expect(b.desde).toBe('lunes 14 de septiembre');
    expect(b.hasta).toBe('domingo 20 de septiembre');
  });

  it('el preencabezado son los primeros títulos, no el primer párrafo de nada', () => {
    const indice = indiceDePrueba([
      encuentro(1, '2026-09-15T22:00:00Z', { titulo: 'Taller de crónica' }),
      encuentro(2, '2026-09-16T22:00:00Z', { titulo: 'Club de los martes' }),
    ]);
    const b = boletinSemanal(indice, manana('2026-09-14'), ETIQUETAS)!;
    expect(b.preencabezado).toBe('Taller de crónica · Club de los martes');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 5 · Las dos versiones del cuerpo
// ───────────────────────────────────────────────────────────────────────────

describe('el cuerpo del correo', () => {
  const indice = () =>
    indiceDePrueba([
      encuentro(1, '2026-09-15T22:00:00Z', { titulo: 'Taller de crónica', arancel: 'a-la-gorra' }),
      encuentro(2, '2026-09-16T22:00:00Z', {
        titulo: 'Club de los martes',
        tipo: 'club-lectura',
        modalidades: ['virtual'],
      }),
    ]);
  const boletin = () => boletinSemanal(indice(), manana('2026-09-14'), ETIQUETAS)!;

  it('el texto plano lleva cada fila con su link', () => {
    const texto = textoPlanoDelBoletin(boletin());
    expect(texto).toContain('MARTES 15 DE SEPTIEMBRE');
    expect(texto).toContain('· Taller de crónica');
    expect(texto).toContain('19:00 · Taller · Casa Brandon · Villa Crespo · A la gorra');
    expect(texto).toContain(`${SITIO}/actividad/actividad-1/`);
    expect(texto).toContain('Online por Google Meet');
  });

  it('todas las URLs son absolutas: en un correo no hay origen del que colgar una ruta', () => {
    const b = boletin();
    const urls = [...b.dias.flatMap((d) => d.encuentros.map((e) => e.url)), b.urlDeLaAgenda];
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) expect(url.startsWith(`${SITIO}/`)).toBe(true);
  });

  it('el HTML es un fragmento, no un documento: la plantilla de Mailchimp pone el resto', () => {
    const html = htmlDelBoletin(boletin());
    expect(html.startsWith('<table')).toBe(true);
    expect(html).not.toContain('<html');
    expect(html).not.toContain('<body');
  });

  it('el HTML lleva los estilos inline: Gmail borra el `<style>` del head', () => {
    const html = htmlDelBoletin(boletin());
    expect(html).not.toContain('<style');
    expect(html).toContain('style="');
  });

  it('escapa el texto que cargó una persona, y un título con `&` no sale roto', () => {
    /*
     * La clase de la trampa 11 sobre otro parser. Un título con `&` o con `<` es
     * normal —«Café & letras», «<sin título>»—, no una anomalía de la consola, y
     * un correo no se corrige después de mandado.
     */
    const indice = indiceDePrueba([
      encuentro(1, '2026-09-15T22:00:00Z', { titulo: 'Café & letras <taller>' }),
    ]);
    const html = htmlDelBoletin(boletinSemanal(indice, manana('2026-09-14'), ETIQUETAS)!);
    expect(html).toContain('Café &amp; letras &lt;taller&gt;');
    expect(html).not.toContain('<taller>');
  });

  it('escapa también el lugar y el arancel, no solo el título (trampa 11)', () => {
    /*
     * **Lo pidió el `auditor-privacidad`, y el hueco era real:** el caso de
     * arriba prueba `titulo`, que es uno de los cuatro huecos interpolados del
     * armador. El otro que lleva texto que una persona tipeó es la línea de
     * metadatos —`sede.nombre` es libre, y las etiquetas de taxonomía nacen de
     * «Otro»—, así que borrar el `escaparHtml` de esa línea dejaba la suite
     * verde. Una sede «Casa "El Ático" & Co» sale rota en la casilla de todos.
     */
    const indice = indiceDePrueba([
      encuentro(1, '2026-09-15T22:00:00Z', { sedeNombre: 'Casa "El Ático" & Co <galpón>' }),
    ]);
    const html = htmlDelBoletin(boletinSemanal(indice, manana('2026-09-14'), ETIQUETAS)!);
    expect(html).toContain('Casa &quot;El Ático&quot; &amp; Co &lt;galpón&gt;');
    expect(html).not.toContain('<galpón>');
  });

  it('el pie dice que lo anunciado puede cambiar, en los dos cuerpos', () => {
    /*
     * Es la única salida que **se manda** en vez de publicarse: el sitio y el
     * calendario se corrigen solos, un correo que salió no. Quien lo lee tres
     * días después no tiene forma de saber que hubo un cambio si no se lo dicen.
     */
    const b = boletin();
    expect(textoPlanoDelBoletin(b)).toContain(AVISO_DE_CAMBIOS);
    expect(htmlDelBoletin(b)).toContain(AVISO_DE_CAMBIOS);
  });

  it('el texto plano NO escapa: ahí un `&` es un `&`', () => {
    // El escape es del HTML, no del contenido. Escapar los dos sería imprimir
    // `&amp;` en la casilla de quien lee la versión de texto.
    const indice = indiceDePrueba([
      encuentro(1, '2026-09-15T22:00:00Z', { titulo: 'Café & letras' }),
    ]);
    const texto = textoPlanoDelBoletin(boletinSemanal(indice, manana('2026-09-14'), ETIQUETAS)!);
    expect(texto).toContain('Café & letras');
    expect(texto).not.toContain('&amp;');
  });
});
