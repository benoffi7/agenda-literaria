import { describe, expect, it } from 'vitest';
import {
  CLAVE_CONSENTIMIENTO,
  EVENTOS_SITIO,
  FUERA_DE_VOCABULARIO_SITIO,
  NOMBRES_EVENTOS_SITIO,
  construirEventoSitio,
  debeCargarGA,
  debeMedirSitio,
  debeMostrarBanner,
  guardarConsentimiento,
  leerConsentimiento,
  ubicacionSinQuery,
  VIAS_INSCRIPCION,
  type AlmacenConsentimiento,
  type EstadoConsentimiento,
} from '@/lib/analyticsSitio';
import { EJES } from '@/lib/listadoPublico';

/**
 * `analyticsSitio.ts` es la proyección que hace segura la analítica del
 * **sitio público** (B-372, B-375). No hereda nada de `analytics-eventos.ts`
 * del panel — es su propia implementación, y por eso tiene sus propios tests
 * de centinelas, igual que `analytics-privacidad.test.ts` los tiene para el
 * panel.
 */

// ─────────────────────────────────────────────────────────────────────────
// Un `Almacen` de mentira, para testear sin `localStorage`
// ─────────────────────────────────────────────────────────────────────────

const almacenDeMentira = (inicial: Record<string, string> = {}): AlmacenConsentimiento => {
  const datos = { ...inicial };
  return {
    getItem: (clave) => datos[clave] ?? null,
    setItem: (clave, valor) => {
      datos[clave] = valor;
    },
  };
};

describe('el consentimiento — B-376, la decisión C3', () => {
  it('sin nada guardado es "sin-decidir"', () => {
    expect(leerConsentimiento(almacenDeMentira())).toBe('sin-decidir');
  });

  it('guardar y releer devuelve exactamente lo guardado', () => {
    const almacen = almacenDeMentira();
    guardarConsentimiento(almacen, 'aceptado');
    expect(leerConsentimiento(almacen)).toBe('aceptado');
    guardarConsentimiento(almacen, 'rechazado');
    expect(leerConsentimiento(almacen)).toBe('rechazado');
  });

  it('un valor corrompido o de otra versión del banner cuenta como "sin-decidir"', () => {
    // Nunca se interpreta un valor desconocido como aceptación: el error
    // seguro es preguntar de más, no medir sin haber preguntado.
    expect(leerConsentimiento(almacenDeMentira({ [CLAVE_CONSENTIMIENTO]: 'si' }))).toBe(
      'sin-decidir',
    );
    expect(leerConsentimiento(almacenDeMentira({ [CLAVE_CONSENTIMIENTO]: '' }))).toBe(
      'sin-decidir',
    );
  });

  it('el banner se muestra únicamente mientras nadie decidió', () => {
    expect(debeMostrarBanner('sin-decidir')).toBe(true);
    expect(debeMostrarBanner('aceptado')).toBe(false);
    expect(debeMostrarBanner('rechazado')).toBe(false);
  });

  it('el tag se puede cargar únicamente con "aceptado" — nunca "mientras se decide"', () => {
    // Es la decisión central de B-376: no hay Consent Mode con default
    // denegado, hay «se instala o no se instala».
    expect(debeCargarGA('aceptado')).toBe(true);
    expect(debeCargarGA('sin-decidir')).toBe(false);
    expect(debeCargarGA('rechazado')).toBe(false);
  });
});

describe('debeMedirSitio — los cuatro portones, y los cuatro tienen que abrir', () => {
  const base = {
    navegador: true,
    emuladores: false,
    measurementId: 'G-9CFMHSSGRC',
    consentimiento: 'aceptado' as EstadoConsentimiento,
  };

  it('con los cuatro portones abiertos, mide', () => {
    expect(debeMedirSitio(base)).toBe(true);
  });

  it('sin navegador (el build corre en Node), no mide', () => {
    expect(debeMedirSitio({ ...base, navegador: false })).toBe(false);
  });

  it('con los emuladores prendidos, no mide', () => {
    expect(debeMedirSitio({ ...base, emuladores: true })).toBe(false);
  });

  it('sin measurementId configurado, no mide', () => {
    expect(debeMedirSitio({ ...base, measurementId: undefined })).toBe(false);
    expect(debeMedirSitio({ ...base, measurementId: '   ' })).toBe(false);
  });

  /**
   * **La guarda que más importa de todo este frente.** Con la preferencia en
   * `'rechazado'` no se manda ningún hit, sea cual sea el resto del entorno —
   * ni con navegador, ni con measurementId, ni sin emuladores. Es la garantía
   * central de B-376: «si la persona rechaza, no se manda nada».
   *
   * **Mutación probada:** se comentó la cláusula
   * `entorno.consentimiento === 'aceptado'` de `debeMedirSitio`
   * (`src/lib/analyticsSitio.ts`), dejando pasar `'rechazado'` igual que
   * `'aceptado'`. Los dos primeros `expect` de este `it` pasaron a fallar de
   * inmediato — se restauró la cláusula y se confirmó que vuelven a pasar.
   */
  it('con "rechazado" no mide, aunque todo lo demás esté en verde', () => {
    expect(debeMedirSitio({ ...base, consentimiento: 'rechazado' })).toBe(false);
    expect(
      debeMedirSitio({ navegador: true, emuladores: false, measurementId: 'G-X', consentimiento: 'rechazado' }),
    ).toBe(false);
  });

  it('con "sin-decidir" tampoco mide — la mitad del invariante que "rechazado" no cubre sola', () => {
    expect(debeMedirSitio({ ...base, consentimiento: 'sin-decidir' })).toBe(false);
  });
});

describe('ubicacionSinQuery — el invariante del §5.3', () => {
  it('una URL sin query ni hash queda igual', () => {
    expect(ubicacionSinQuery('https://agendaleh.ar/cartelera')).toBe(
      'https://agendaleh.ar/cartelera',
    );
  });

  it('recorta la query entera, no un parámetro a la vez', () => {
    // Es la fuga concreta que el §5.3 del diseño señala: el texto que alguien
    // tipeó en el buscador viaja en `?q=...` (`aQuery` de `listadoPublico.ts`).
    expect(
      ubicacionSinQuery('https://agendaleh.ar/?q=CENTINELA+lo+que+alguien+tipeo&tipo=taller'),
    ).toBe('https://agendaleh.ar/');
  });

  it('recorta también el hash', () => {
    expect(ubicacionSinQuery('https://agendaleh.ar/ayuda#seccion')).toBe(
      'https://agendaleh.ar/ayuda',
    );
  });

  it('recorta los dos juntos', () => {
    expect(ubicacionSinQuery('https://agendaleh.ar/?q=CENTINELA#resultados')).toBe(
      'https://agendaleh.ar/',
    );
  });

  it('conserva la ruta de la página de detalle intacta', () => {
    expect(
      ubicacionSinQuery('https://agendaleh.ar/actividad/taller-de-cuento-luciano-lamberti/'),
    ).toBe('https://agendaleh.ar/actividad/taller-de-cuento-luciano-lamberti/');
  });
});

describe('los ejes medibles no se desactualizan en silencio', () => {
  it('EJES_MEDIBLES (copiado a propósito, ver el docblock) sigue igual a EJES de listadoPublico.ts', () => {
    // `EJES_MEDIBLES` es privado — se verifica indirectamente: cualquier eje
    // real tiene que sobrevivir al saneador, y ningún eje falso (fuera de
    // `EJES`) puede colarse.
    for (const eje of EJES) {
      const evento = construirEventoSitio('filtro_sin_resultados', { eje, slug: ['x'] });
      expect(evento?.params.eje).toBe(eje);
    }
  });
});

describe('construirEventoSitio — whitelist en las dos direcciones', () => {
  it('un nombre de evento no declarado no manda nada', () => {
    expect(construirEventoSitio('evento-inventado', { via: 'mail' })).toBeNull();
  });

  it('NOMBRES_EVENTOS_SITIO son exactamente las claves de EVENTOS_SITIO', () => {
    expect(NOMBRES_EVENTOS_SITIO.sort()).toEqual(Object.keys(EVENTOS_SITIO).sort());
  });

  it('un parámetro no declarado en ese evento se descarta', () => {
    const evento = construirEventoSitio('clic_inscripcion', {
      via: 'mail',
      destino: 'CENTINELA-alguien@ejemplo.com',
    });
    expect(evento?.params).toEqual({ via: 'mail' });
  });

  describe('clic_inscripcion', () => {
    it('las cuatro vías reales pasan tal cual', () => {
      for (const via of VIAS_INSCRIPCION) {
        expect(construirEventoSitio('clic_inscripcion', { via })?.params.via).toBe(via);
      }
    });

    it('una vía fuera del vocabulario cae en "otro", nunca se descarta en silencio', () => {
      expect(construirEventoSitio('clic_inscripcion', { via: 'telefono' })?.params.via).toBe(
        FUERA_DE_VOCABULARIO_SITIO,
      );
    });

    it('sin `via`, el evento se manda igual y sin ese parámetro', () => {
      expect(construirEventoSitio('clic_inscripcion', {})?.params).toEqual({});
    });
  });

  describe('filtro_sin_resultados', () => {
    it('un eje real con sus slugs pasa tal cual', () => {
      const evento = construirEventoSitio('filtro_sin_resultados', {
        eje: 'barrio',
        slug: ['villa-crespo'],
      });
      expect(evento?.params).toEqual({ eje: 'barrio', slug: 'villa-crespo' });
    });

    it('varios slugs se unen ordenados y sin repetir', () => {
      const evento = construirEventoSitio('filtro_sin_resultados', {
        eje: 'tipo',
        slug: ['taller', 'club-lectura', 'taller'],
      });
      expect(evento?.params.slug).toBe('club-lectura,taller');
    });

    it('un eje fuera del vocabulario cae en "otro"', () => {
      expect(
        construirEventoSitio('filtro_sin_resultados', { eje: 'organizador', slug: ['x'] })?.params
          .eje,
      ).toBe(FUERA_DE_VOCABULARIO_SITIO);
    });

    it('sin un eje que explique el cero (ejeQueSobra devolvió null), el evento se manda sin eje ni slug', () => {
      expect(construirEventoSitio('filtro_sin_resultados', {})?.params).toEqual({});
    });
  });
});

describe('centinelas — ningún payload de analítica del sitio lleva texto libre', () => {
  /**
   * El mismo truco que `analytics-privacidad.test.ts` del panel: en vez de
   * confiar en la intención del código, se arma el payload con valores
   * reconocibles —el texto de un buscador real, con mayúsculas, espacios y
   * acentos— y se busca el centinela adentro. Si el saneador de algún
   * parámetro nuevo se olvida de esto, el test lo encuentra sin que nadie
   * tenga que acordarse de escribirle un caso.
   */
  const CENTINELAS = [
    'CENTINELA búsqueda de una persona',
    'Café Vinilo, Palermo',
    'centinela-admin@ejemplo.com',
    '+54 9 11 CENTINELA-5555',
    'https://wa.me/CENTINELA',
  ];

  it('ningún centinela sobrevive como valor de string en ningún evento declarado', () => {
    for (const nombre of NOMBRES_EVENTOS_SITIO) {
      for (const centinela of CENTINELAS) {
        const spec = EVENTOS_SITIO[nombre];
        const crudos: Record<string, unknown> = {};
        for (const param of Object.keys(spec)) {
          crudos[param] = centinela;
        }
        const evento = construirEventoSitio(nombre, crudos);
        for (const valor of Object.values(evento?.params ?? {})) {
          expect(valor).not.toBe(centinela);
        }
      }
    }
  });

  it('un centinela metido como array (la forma que espera `slug`) tampoco sobrevive', () => {
    for (const centinela of CENTINELAS) {
      const evento = construirEventoSitio('filtro_sin_resultados', {
        eje: 'tipo',
        slug: [centinela],
      });
      // El centinela tiene mayúsculas/espacios/acentos/arroba: no matchea el
      // formato de un slug, así que se filtra entero y el parámetro
      // desaparece en vez de viajar.
      expect(evento?.params.slug).toBeUndefined();
    }
  });

  it('ningún valor de parámetro es un objeto ni un array', () => {
    for (const nombre of NOMBRES_EVENTOS_SITIO) {
      const evento = construirEventoSitio(nombre, {
        via: ['mail'],
        eje: { slug: 'x' },
        slug: 'no-es-un-array',
      });
      for (const valor of Object.values(evento?.params ?? {})) {
        expect(typeof valor === 'string' || typeof valor === 'number').toBe(true);
      }
    }
  });
});
