import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CLAVE_CONSENTIMIENTO,
  EJES_SIN_SLUG,
  EVENTOS_SITIO,
  FUERA_DE_VOCABULARIO_SITIO,
  NOMBRES_EVENTOS_SITIO,
  construirEventoSitio,
  crudosDeFiltroSinResultados,
  debeCargarGA,
  debeMedirSitio,
  debeMostrarBanner,
  guardarConsentimiento,
  leerConsentimiento,
  ubicacionSinQuery,
  VIAS_INSCRIPCION,
  type AlmacenConsentimiento,
  type Eje,
  type EstadoConsentimiento,
  type PanelMedible,
} from '@/lib/analyticsSitio';
import { EJES, desdeQuery } from '@/lib/listadoPublico';
import type { ClaveDePanel } from '@/lib/ahoraPublico';

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

  it('los cuatro filtros que no son chips también son vocabulario — B-798', () => {
    // La otra mitad de `EJES_MEDIBLES`. Sin esto, `eje: 'busqueda'` llegaría a
    // GA4 como `otro` y el ítem no habría contestado nada: «el buscador no
    // encuentra» y «un eje que no reconozco» serían la misma fila.
    for (const eje of EJES_SIN_SLUG) {
      expect(construirEventoSitio('filtro_sin_resultados', { eje })?.params.eje).toBe(eje);
    }
  });

  it('los dos vocabularios son disjuntos', () => {
    /*
     * No es una formalidad: `crudosDeFiltroSinResultados` decide si un eje
     * puede llevar `slug` preguntando si está en la lista de taxonomía. Si un
     * día `EJES` de `listadoPublico.ts` estrenara un eje llamado `cuando` o
     * `busqueda`, ese nombre pasaría a habilitar el `slug` — y el que lo emite
     * sería el otro. Solaparlos es la única forma de que la guarda de abajo
     * signifique otra cosa de la que dice.
     */
    for (const eje of EJES_SIN_SLUG) {
      expect(EJES as readonly string[]).not.toContain(eje);
    }
  });
});

describe('crudosDeFiltroSinResultados — de dónde puede salir un slug (B-798)', () => {
  /** Los seis ejes de taxonomía vacíos, derivado de `EJES` y no escrito a mano:
   *  un eje nuevo del listado entra solo. */
  const sinValores = (): Record<Eje, string[]> =>
    Object.fromEntries(EJES.map((eje) => [eje, [] as string[]])) as unknown as Record<
      Eje,
      string[]
    >;

  it('sin un filtro que explique el cero, no manda ningún parámetro', () => {
    // Sigue siendo la señal válida que ya existía: «hubo un cero que sacar un
    // solo filtro no arregla».
    expect(crudosDeFiltroSinResultados(null, sinValores())).toEqual({});
  });

  it('un eje de taxonomía viaja con los slugs que estaban puestos', () => {
    expect(
      crudosDeFiltroSinResultados('barrio', { ...sinValores(), barrio: ['villa-crespo'] }),
    ).toEqual({ eje: 'barrio', slug: ['villa-crespo'] });
  });

  it('un eje de taxonomía sin valores viaja solo, sin un `slug` vacío', () => {
    expect(crudosDeFiltroSinResultados('tipo', sinValores())).toEqual({ eje: 'tipo' });
  });

  it('los cuatro filtros que no son chips viajan sin `slug`, siempre', () => {
    for (const eje of EJES_SIN_SLUG) {
      expect(crudosDeFiltroSinResultados(eje, sinValores())).toEqual({ eje });
    }
  });

  /**
   * **El caso del ítem, y el que hay que mirar si alguien toca este archivo.**
   *
   * B-798 agrega `busqueda` al vocabulario de `eje` para poder distinguir «el
   * buscador no encuentra nada» —que se arregla con contenido— de «ningún
   * filtro solo explica el cero». Lo que **no** puede pasar por agregarlo es que
   * el texto tipeado encuentre una salida: es exactamente lo que el §5.4 del
   * diseño prohíbe.
   *
   * Acá se fuerza el peor caso posible: alguien le mete al mapa de valores una
   * entrada con el nombre del eje nuevo y adentro lo que la persona tipeó. La
   * función **no consulta el mapa** para un eje que no es de taxonomía, así que
   * el texto no tiene por dónde salir.
   *
   * MUTACIÓN PROBADA: en `crudosDeFiltroSinResultados`
   * (`src/lib/analyticsSitio.ts`) se reemplazó
   * `esEjeDeTaxonomia(eje) ? (valores[eje] ?? []) : []` por el acceso directo
   * `(valores as Record<string, readonly string[] | undefined>)[eje] ?? []`.
   * Este `it` pasó a fallar de inmediato —el crudo salía como
   * `{ eje: 'busqueda', slug: ['centinela-lo-que-alguien-tipeo'] }`— y el de
   * abajo, el de punta a punta, también. Se restauró la guarda y los dos
   * vuelven a pasar.
   */
  it('el texto tipeado NO puede salir por el camino nuevo, ni forzándolo', () => {
    const conElTextoAdentro = {
      ...sinValores(),
      busqueda: ['centinela-lo-que-alguien-tipeo'],
    } as unknown as Record<Eje, string[]>;

    const crudos = crudosDeFiltroSinResultados('busqueda', conElTextoAdentro);
    expect(crudos).toEqual({ eje: 'busqueda' });
    expect(crudos.slug).toBeUndefined();

    // Y de punta a punta, que es lo que llega a GA4.
    const evento = construirEventoSitio('filtro_sin_resultados', crudos);
    expect(evento?.params).toEqual({ eje: 'busqueda' });
    expect(JSON.stringify(evento)).not.toContain('centinela-lo-que-alguien-tipeo');
  });

  /**
   * **Por qué la garantía de arriba es estructural y no del saneador**, dicho
   * con el caso que lo prueba en vez de con una promesa.
   *
   * El saneador `lista-slugs` verifica la **forma** (`FORMATO_SLUG`), y una
   * búsqueda de una sola palabra en minúscula —`poesia`, `borges`,
   * `caballito`— tiene exactamente la forma de un slug de taxonomía. O sea que
   * si alguien pasara `filtros.q` como `slug`, **el saneador lo dejaría pasar**
   * y el test de centinelas de más abajo tampoco lo vería: sus centinelas
   * tienen mayúsculas, espacios, acentos o arrobas.
   *
   * Este caso está para que eso quede fijado y no se descubra el día que
   * alguien «enriquezca» el evento. Lo que impide la fuga es de dónde sale el
   * valor, y eso solo lo puede cuidar `crudosDeFiltroSinResultados`.
   */
  /**
   * **La precisión que el `auditor-privacidad` pidió sobre la frase del diseño**
   * (su H3). El docblock decía que un slug es seguro «porque viene de la
   * taxonomía», y no es exacto: `desdeQuery` llena `filtros.valores` partiendo
   * el query string **sin contrastarlo contra las opciones conocidas**, así que
   * lo que la persona ponga en su propia URL entra al mapa y lo único que lo
   * recorta es `FORMATO_SLUG`.
   *
   * Este caso lo deja escrito como comportamiento y no como promesa, para que
   * nadie se apoye en la frase que no era. **La garantía sigue en pie por otro
   * motivo**, que es el que importa: el buscador no escribe en ese mapa, y el
   * valor que llega es el que la propia persona puso en su propia URL — no un
   * dato de un tercero. Es superficie de B-375, no de B-798.
   */
  it('lo que entra por la URL llega al mapa sin pasar por la taxonomía — solo lo recorta el formato', () => {
    const { filtros } = desdeQuery('barrio=un-barrio-que-no-existe-en-ninguna-opcion');
    expect(filtros.valores.barrio).toEqual(['un-barrio-que-no-existe-en-ninguna-opcion']);

    // Y sale, porque tiene forma de slug. Lo que lo hace aceptable no es la
    // taxonomía: es de dónde viene el campo.
    expect(crudosDeFiltroSinResultados('barrio', filtros.valores)).toEqual({
      eje: 'barrio',
      slug: ['un-barrio-que-no-existe-en-ninguna-opcion'],
    });
  });

  it('el saneador solo no alcanzaría: una búsqueda de una palabra tiene forma de slug', () => {
    const comoSiAlguienLoPasaraAMano = construirEventoSitio('filtro_sin_resultados', {
      eje: 'tag',
      slug: ['poesia'],
    });
    expect(comoSiAlguienLoPasaraAMano?.params.slug).toBe('poesia');
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

  describe('clic_triptico — B-601', () => {
    it('todo panel de ClaveDePanel es medible: PANELES_MEDIBLES no queda atrás', () => {
      /*
       * **La red que el docblock de `PANELES_MEDIBLES` proponía y no existía**, y
       * la escribió el `auditor-trampas` mirando B-791: ese renombre
       * (`manana` → `semana`) hubo que hacerlo **a mano en los dos lados**, y la
       * única consecuencia de olvidarse uno habría sido un `panel=otro` en GA4
       * semanas después. Es el patrón de B-88: dos listas de lo mismo, derivadas
       * por separado.
       *
       * El `Record` es lo que verifica: **no compila** si `ClaveDePanel` gana una
       * clave que `PanelMedible` no tiene. Vive en el test y no en el módulo
       * porque `ahoraPublico.ts` no puede entrar al bundle que carga en todas las
       * páginas —el banner de `Base.astro` importa este archivo—, y un
       * `import type` no deja rastro.
       *
       * MUTACIÓN PROBADA: sacar `'semana'` de `PANELES_MEDIBLES` deja este caso
       * en rojo en `tsc`, no en runtime, que es antes.
       */
      const cubiertos: Record<ClaveDePanel, PanelMedible> = {
        hoy: 'hoy',
        finde: 'finde',
        semana: 'semana',
      };
      // Y la vuelta, que el tipo no puede dar: ningún panel medible sobra.
      for (const panel of Object.values(cubiertos)) {
        expect(construirEventoSitio('clic_triptico', { panel })?.params).toEqual({ panel });
      }
    });

    it('los tres paneles pasan tal cual', () => {
      for (const panel of ['hoy', 'finde', 'semana'] satisfies PanelMedible[]) {
        expect(construirEventoSitio('clic_triptico', { panel })?.params).toEqual({ panel });
      }
    });

    it('un panel fuera del vocabulario cae en "otro", y el clic no se pierde', () => {
      /*
       * Es la degradación diseñada, no un descuido: si el tríptico gana un
       * panel y `PANELES_MEDIBLES` no se actualiza, en GA4 aparece
       * `panel=otro` — el clic se cuenta y el desfase **se ve en los datos**.
       * Descartar el parámetro en silencio haría que un panel nuevo se
       * pareciera a un clic sin panel, que es una fila distinta.
       */
      expect(construirEventoSitio('clic_triptico', { panel: 'la-semana' })?.params.panel).toBe(
        FUERA_DE_VOCABULARIO_SITIO,
      );
    });

    it('NO manda la actividad a la que el clic lleva — ni slug, ni título, ni ruta', () => {
      /*
       * **El caso que fija la decisión de diseño de este evento** (§5.4 del
       * diseño, tercer punto): el `page_view` de la página de detalle a la que
       * el clic lleva ya manda la ruta, así que repetirla acá no agrega una
       * respuesta y sí agrega superficie. El sanitizador lo cumple sin una
       * regla nueva —whitelist en las dos direcciones—, y este caso es lo que
       * impide que alguien «enriquezca» el evento más adelante sin que nada
       * falle.
       */
      const evento = construirEventoSitio('clic_triptico', {
        panel: 'hoy',
        slug: 'CENTINELA-taller-de-cronica',
        titulo: 'CENTINELA Taller de crónica',
        ruta: '/actividad/CENTINELA-taller-de-cronica/',
        href: 'https://agendaleh.ar/actividad/CENTINELA-taller-de-cronica/',
        rotulo: 'El finde que viene',
      });
      expect(evento?.params).toEqual({ panel: 'hoy' });
    });

    it('sin `panel`, el evento se manda igual y sin ese parámetro', () => {
      // Un clic contado sin saber de qué panel sigue contestando «¿se toca el
      // tríptico?», que es la mitad más importante de la pregunta.
      expect(construirEventoSitio('clic_triptico', {})?.params).toEqual({});
    });
  });
});

describe('el payload de filtro_sin_resultados no se arma a mano — B-798, H1 del auditor', () => {
  /**
   * **La red donde ahora vive el riesgo, y no donde vivía antes.**
   *
   * B-798 mudó la garantía de privacidad del saneador al llamador, por un motivo
   * bueno: `FORMATO_SLUG` no distingue `poesia` —lo que alguien tipeó— de
   * `club-lectura` —un slug de taxonomía—, así que la forma no puede ser la
   * defensa. Lo que la mudanza no dejó, y lo encontró el `auditor-privacidad`,
   * es una red **en el lugar nuevo**: `medirSitio` acepta
   * `Record<string, unknown>`, así que
   * `medirSitio('filtro_sin_resultados', { eje, slug: [filtros.q] })` **compila,
   * pasa el type-check y pasa todos los tests de este archivo** — porque
   * `crudosDeFiltroSinResultados` sigue existiendo y sigue siendo correcta, solo
   * que nadie la usa. Es la clase de B-81: se acordaron de armarlo bien el día
   * que lo escribieron.
   *
   * Vive acá y no en `tests/listado-del-sitio.test.ts` —que ya lee este mismo
   * archivo para `clic_triptico`— porque la regla es de **este** módulo: está
   * escrita en el docblock de `construirEventoSitio` («el único llamador
   * soportado es `crudosDeFiltroSinResultados`, nunca a mano») y el chequeo que
   * la sostiene tiene que poder leerse al lado.
   *
   * Se mira el fuente **sin comentarios**: los docblocks de `Buscador.tsx` y de
   * `analyticsSitio.ts` escriben la forma prohibida para explicarla, así que un
   * barrido sobre el archivo entero se agarraría a sí mismo.
   *
   * MUTACIÓN PROBADA: se reemplazó la línea de `Buscador.tsx` por
   * `medirSitio('filtro_sin_resultados', { eje: ejeDelCero, slug: [filtros.q] })`
   * —la fuga exacta que el auditor describe, con `tsc` y el resto de la suite en
   * verde—. Los dos `expect` de este `it` pasaron a fallar. Se restauró la
   * llamada real y vuelven a pasar.
   */
  const BUSCADOR = fileURLToPath(new URL('../src/components/publico/Buscador.tsx', import.meta.url));

  /**
   * El fuente **sin comentarios**, con el mismo recorte local que usan
   * `tests/listado-del-sitio.test.ts` y `tests/pagina-de-detalle.test.ts` sobre
   * este mismo archivo, y **no** `scripts/sin-comentarios.mjs`: ese saneador
   * compartido se come la mayor parte de `Buscador.tsx` —ya lo hacía antes de
   * este cambio, se verificó contra el archivo de `HEAD`— por algún `//` que le
   * abre una corrida adentro de sus docblocks largos. Está anotado en el
   * reporte; acá alcanza el recorte simple.
   */
  const codigoDelBuscador = (): string =>
    readFileSync(BUSCADOR, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');

  it('la única emisión del evento pasa por `crudosDeFiltroSinResultados`', () => {
    const codigo = codigoDelBuscador();

    // Una sola: dos emisiones son dos oportunidades de armar el payload, y la
    // segunda es siempre la que se escribe sin releer la regla.
    expect([...codigo.matchAll(/medirSitio\('filtro_sin_resultados'/g)]).toHaveLength(1);
    expect(codigo).toMatch(
      /medirSitio\('filtro_sin_resultados',\s*crudosDeFiltroSinResultados\(/,
    );
  });

  it('y `filtros.q` no aparece en ninguna llamada a `medirSitio`', () => {
    /*
     * El complemento, por si el evento se emitiera desde otro lado del archivo:
     * el texto del buscador no puede aparecer como argumento de ninguna
     * medición. `filtros.q` sí se usa —para saber si el filtro está puesto y
     * para vaciarlo en `SIN_EL_FILTRO`—, así que lo que se prohíbe es la
     * vecindad con `medirSitio`, no la mención.
     */
    const codigo = codigoDelBuscador();
    for (const [llamada] of codigo.matchAll(/medirSitio\([^;]*\);/g)) {
      expect(llamada).not.toMatch(/\bfiltros\.q\b/);
      expect(llamada).not.toMatch(/\bq\b\s*:/);
    }
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
