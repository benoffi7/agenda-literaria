/**
 * Salida 9: el sitemap (B-109).
 *
 * Un barrido de salidas públicas, partido de
 * `tests/barrido-de-salidas-publicas.test.ts` (PRD 6, M-12). El índice de
 * todos está en ese archivo; lo que comparten, en
 * `tests/fixtures/barrido-de-salidas.ts`.
 */
import { describe, expect, it } from 'vitest';
import { toPublic } from '@/lib/toPublic';
import { entradaDeIndice } from '@/lib/eventsJson';
import { lastmodDelSitemap, rutasDelSitemap, textoDeRobots, xmlDelSitemap } from '@/lib/sitemap';
import { CENTINELA, actividadCentinela } from '../fixtures/centinelas';
import { barrer, type Excepcion } from '../fixtures/barrido';

describe('barrido del sitemap (§5, salida 9, B-109)', () => {
  /*
   * **La salida más chica del repo, y por eso el barrido es al revés.**
   *
   * Lo que el sitemap publica son **rutas**: ni un título, ni una descripción, ni
   * una fecha. Así que la lista de permitidos tiene **un** centinela —el slug, que
   * *es* la URL— y la dirección que importa es la de las fugas: cualquier otro
   * centinela que aparezca en el XML llegó por un campo que alguien interpoló.
   *
   * El caso plausible no es rebuscado: un `<lastmod>` sacado de `updatedAt`
   * (B-112) o el título de la actividad al lado de cada `<loc>` «para poder
   * revisar el archivo a ojo». Con eso, el sitemap dejaría de ser una lista de
   * URLs y sería una segunda proyección del documento, sin proyección.
   *
   * MUTACIÓN PROBADA: emitir un comentario XML con el título al lado de cada
   * `<loc>` hace fallar este `describe` nombrando el centinela del título.
   */
  const AHORA = new Date('2026-08-20T15:00:00Z');

  const entradas = () => [entradaDeIndice(toPublic(actividadCentinela(), 'act_sitemap'))];

  const xml = () =>
    xmlDelSitemap(
      rutasDelSitemap({
        entradas: entradas(),
        canceladas: [{ slug: CENTINELA.slug, editadaEn: AHORA.toISOString() }],
        ahora: AHORA,
      }),
    );

  const PERMITIDO_EN_EL_SITEMAP: readonly Excepcion[] = [
    {
      nombre: 'el slug, que es la URL',
      centinelas: ['slug'],
      porque:
        '§5.6 — una entrada del sitemap **es** la URL de la página: el origen más ' +
        '`/actividad/{slug}/`. El slug es la URL pública de la actividad desde B-227 ' +
        '(trampa 10: inmutable después de publicar) y ya sale en el `events.json`, en el ' +
        '`href` de cada fila y en el JSON-LD. Es el único centinela que puede aparecer ' +
        'acá: todo lo demás sería un campo interpolado en una lista de URLs.',
    },
  ];

  it('control positivo: el XML tiene la URL de la actividad', () => {
    // Sin esto, un sitemap vacío pasaría la dirección «no sobra nada» sin haber
    // mirado una sola URL.
    expect(xml()).toContain(`/actividad/${CENTINELA.slug}/`);
  });

  it('en el sitemap sobrevive solo el slug', () => {
    barrer('sitemap.xml', xml(), PERMITIDO_EN_EL_SITEMAP, { insensible: true });
  });

  it('el `lastmod` de B-112 nunca lleva la hora, ni aunque se lo pasen con ISO completo', () => {
    /*
     * El riesgo que el propio B-112 dejó anotado: «con un solo admin, un
     * `<lastmod>2026-09-02T03:14:52.881Z</lastmod>` no es una fecha, es la
     * agenda de trabajo de una persona identificada» (D-138). La fuente real
     * del recorte es `contenidoDelSitio.ts` (`publicadasEditadasEn`, que ya
     * guarda solo el día), pero `lastmodDelSitemap` recorta **de nuevo** —
     * belt-and-suspenders— para que un llamador futuro que le pase el ISO
     * completo por error no filtre la hora igual.
     *
     * MUTACIÓN PROBADA: sacar el `.slice(0, 10)` de `lastmodDelSitemap` deja
     * este caso en rojo con el instante completo en el XML.
     */
    const rutasOfrecidas = rutasDelSitemap({ entradas: entradas(), canceladas: [], ahora: AHORA });
    const lastmod = lastmodDelSitemap(rutasOfrecidas, {
      [CENTINELA.slug]: '2026-09-02T03:14:52.881Z',
    });
    const xmlConFecha = xmlDelSitemap(rutasOfrecidas, lastmod);
    expect(xmlConFecha).toContain('<lastmod>2026-09-02</lastmod>');
    expect(xmlConFecha).not.toContain('03:14:52');
    expect(xmlConFecha).not.toMatch(/<lastmod>[^<]*T[^<]*<\/lastmod>/);
  });

  it('y el robots.txt no publica ni el slug', () => {
    /*
     * Tres líneas fijas y una URL: la del propio sitemap. No toca los datos —no
     * recibe ninguno— y eso es lo que se afirma, porque el atajo tentador sería
     * listar ahí algo «para que Google lo encuentre antes».
     */
    barrer('robots.txt', textoDeRobots(), [], { insensible: true });
  });
});
