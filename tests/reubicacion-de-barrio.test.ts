import { describe, expect, it } from 'vitest';
import { provinciaQueDenota, reubicacionDe } from '@/lib/reubicacion-de-barrio.mjs';
import { PROVINCIAS } from '@/lib/geografia.mjs';

/**
 * **B-976 — el barrio que en realidad era una provincia.**
 *
 * Hasta B-950 el barrio era el único campo de lugar del formulario, así que la
 * provincia se escribió ahí: `/opciones/barrio` quedó con «Provincia de Buenos
 * Aires» entre Belgrano y Colegiales, con 54 actividades detrás.
 *
 * Lo que se fija acá es **dónde está el límite de lo que el código puede
 * decidir**, que es la parte difícil de un backfill: reubicar de más escribe el
 * error con la misma confianza que el acierto, y sobre 58 actividades de
 * producción eso no se deshace con un ctrl+Z.
 */
describe('B-976 · provinciaQueDenota', () => {
  it('reconoce las 24, por slug y por label', () => {
    for (const p of PROVINCIAS) {
      expect(provinciaQueDenota(p.slug), p.slug).toBe(p.slug);
      expect(provinciaQueDenota(p.label), p.label).toBe(p.slug);
    }
  });

  /**
   * El alias es el dato de campo: así se tipeó las 54 veces, con el «Provincia
   * de» adelante justamente porque el campo decía «Barrio» y había que aclarar
   * que no lo era. Sin esta entrada el backfill no encuentra el caso principal.
   */
  it('reconoce «Provincia de Buenos Aires», que es como quedó escrita', () => {
    expect(provinciaQueDenota('provincia-de-buenos-aires')).toBe('buenos-aires');
    expect(provinciaQueDenota('Provincia de Buenos Aires')).toBe('buenos-aires');
  });

  it('los cuatro alias de CABA dan el slug canónico, no el tipeado', () => {
    for (const a of ['caba', 'Capital Federal', 'Ciudad Autónoma de Buenos Aires']) {
      expect(provinciaQueDenota(a), a).toBe('caba');
    }
  });

  it('un barrio no denota ninguna provincia', () => {
    for (const b of ['villa-crespo', 'boedo', 'palermo', '', 'mar-del-plata']) {
      expect(provinciaQueDenota(b), b).toBe('');
    }
  });
});

describe('B-976 · reubicacionDe', () => {
  it('el caso principal: el barrio era la provincia', () => {
    const r = reubicacionDe({ barrio: 'provincia-de-buenos-aires', ciudad: 'Tandil' });
    expect(r.estado).toBe('reubicar');
    expect(r.geografia).toEqual({ provincia: 'buenos-aires', barrio: '', ciudad: 'tandil' });
  });

  /**
   * La ciudad se **slugifica** al pasar: viene tipeada («Tres arroyos», «Gral
   * Rodríguez») porque no era taxonomía antes de B-950. Si saliera cruda, la
   * actividad quedaría con una ciudad que no casa con ningún valor de
   * `/opciones/ciudad` y no aparecería bajo ningún filtro — el bug que el
   * backfill vino a arreglar, reintroducido por el backfill.
   */
  it('y la ciudad sale slugificada, que es como no venía', () => {
    expect(reubicacionDe({ barrio: 'cordoba', ciudad: 'Cerro de las Rosas' }).geografia).toEqual({
      provincia: 'cordoba',
      barrio: '',
      ciudad: 'cerro-de-las-rosas',
    });
  });

  it('una sede sana no se toca', () => {
    for (const sede of [
      { provincia: 'caba', barrio: 'villa-crespo', ciudad: 'CABA' },
      { barrio: 'boedo', ciudad: 'CABA' },
      { barrio: '', ciudad: 'Rosario' },
      { barrio: '', ciudad: '' },
    ]) {
      expect(reubicacionDe(sede).estado, JSON.stringify(sede)).toBe('sin-cambios');
    }
  });

  /**
   * **La contradicción no se desempata.** «Provincia de Buenos Aires» con la
   * ciudad en CABA son dos afirmaciones de igual peso y una está mal; elegir una
   * es inventar. CABA no está en la provincia de Buenos Aires.
   */
  it('provincia de Buenos Aires con la ciudad en CABA es ambiguo', () => {
    expect(reubicacionDe({ barrio: 'provincia-de-buenos-aires', ciudad: 'CABA' }).estado).toBe(
      'ambiguo',
    );
  });

  /**
   * **El caso que la primera versión resolvía mal, y por eso está fijado.**
   *
   * «El barrio tiene una ciudad y la ciudad tiene una provincia → están
   * invertidos» parece obvio y funciona para `rosario | santa-fe`. Disparada
   * sobre `nunez | neuquen` produce «la ciudad de Núñez, en Neuquén»: Núñez es un
   * barrio de CABA. Distinguirlos pide saber si el barrio es un barrio de CABA, y
   * eso no se puede saber sin cablear una lista de 48 — la misma tabla que este
   * módulo se niega a inventar, con otro nombre.
   *
   * MUTACIÓN PROBADA: devolver `reubicar` con la geografía cruzada deja este caso
   * en rojo, que es lo que evita volver a escribirlo.
   */
  it('si la ciudad es una provincia, es ambiguo — no se invierte solo', () => {
    for (const sede of [
      { barrio: 'rosario', ciudad: 'Santa fé' },
      { barrio: 'nunez', ciudad: 'Neuquén' },
    ]) {
      const r = reubicacionDe(sede);
      expect(r.estado, JSON.stringify(sede)).toBe('ambiguo');
      expect(r.geografia).toBeUndefined();
    }
  });

  /**
   * En CABA el segundo nivel **es** el barrio, así que un `ciudad=caba` junto a
   * un barrio porteño es lo correcto y cruzarlo lo rompería. Es el control
   * negativo de la regla de arriba: sin él, «la ciudad es una provincia» se
   * aplicaría a la mitad del catálogo, porque CABA también lo es.
   */
  it('un barrio porteño con ciudad CABA no es ambiguo: es lo correcto', () => {
    expect(reubicacionDe({ barrio: 'villa-crespo', ciudad: 'caba' }).estado).toBe('sin-cambios');
  });

  /** Sin barrio no hay nada que reubicar, aunque el resto esté a medio cargar. */
  it('sin barrio no hace nada', () => {
    expect(reubicacionDe({ barrio: '', ciudad: 'Mar del Plata' }).estado).toBe('sin-cambios');
    expect(reubicacionDe({}).estado).toBe('sin-cambios');
    expect(reubicacionDe(null).estado).toBe('sin-cambios');
  });

  /**
   * **Solo los tres campos de la geografía.** El nombre, la dirección, las
   * indicaciones y la `geo` no salen de acá: el llamador hace `{...sede,
   * ...geografia}`. Un backfill que devuelve una sede entera es un backfill que
   * puede perder el campo que no miró.
   */
  it('devuelve los tres campos de la geografía y nada más', () => {
    const r = reubicacionDe({
      nombre: 'Casa Brandon',
      direccion: 'Luis María Drago 236',
      barrio: 'provincia-de-buenos-aires',
      ciudad: 'Tandil',
      geo: { lat: -1, lng: -2 },
    });
    expect(Object.keys(r.geografia!).sort()).toEqual(['barrio', 'ciudad', 'provincia']);
  });
});
