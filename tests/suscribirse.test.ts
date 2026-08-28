import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

import {
  urlDeContacto,
  urlDeInstagram,
  urlDelCalendario,
  urlDelIcs,
  urlParaSuscribirseEnGoogle,
  urlWebcal,
} from '@/lib/enlaces';
import {
  ADVERTENCIAS,
  CAMINOS,
  DONDE_SEGUIR,
  ORDEN_ADVERTENCIAS,
  ORDEN_CAMINOS,
  accionesDelContenido,
  advertenciasEnOrden,
  caminosEnOrden,
  textoDelContenido,
} from '@/lib/suscripcion';
import { construirEvento, planificar } from '../functions/calendario.js';
import {
  ENCUENTROS_DEL_CICLO,
  cicloDeOcho,
  sesionesDeCiclo,
} from './fixtures/ciclo';

/**
 * La página «Suscribirse» — B-230.
 *
 * ── Qué puede salir mal acá, que no es que se rompa ───────────────────────
 * Esta página existe para que alguien que no sabe qué es un calendario
 * suscribible termine suscripto. Falla dejando un camino a medias: un botón sin
 * los pasos al lado, un camino que se agrega y nadie muestra, un enlace que
 * abre otra aplicación sin avisarle a quien no ve la pantalla. Ninguna de esas
 * cosas pone el build en rojo y todas dejan a una persona sin poder seguir.
 *
 * Y una que sí es grave: **la variante privada del ICS**. Google publica dos
 * direcciones del mismo calendario y la que lleva `private-` le da acceso de
 * lectura al calendario entero a cualquiera que la tenga. `enlaces.ts` no la
 * produce y `tests/enlaces.test.ts` lo verifica — pero esta página es el
 * segundo lugar donde alguien podría pegarla, así que acá se verifica lo de
 * más arriba: que ninguna dirección de la página esté **escrita**, sino
 * derivada de `enlaces.ts`.
 */

const raiz = (rel: string): string => fileURLToPath(new URL(`../${rel}`, import.meta.url));
const fuente = (rel: string): string => readFileSync(raiz(rel), 'utf8');

const PAGINA = 'src/pages/suscribirse.astro';

/**
 * Todo lo que `enlaces.ts` sabe producir. Una dirección de la página tiene que
 * ser **exactamente** una de estas: cualquier otra cosa es una URL escrita a
 * mano, que es como se cuela la privada.
 */
const URLS_DE_ENLACES = (): Set<string> =>
  new Set([
    urlDelCalendario(),
    urlParaSuscribirseEnGoogle(),
    urlDelIcs(),
    urlWebcal(),
    urlDeInstagram(),
    urlDeContacto('sugerencia'),
    urlDeContacto('error'),
  ]);

/** Los archivos que esta página aporta al sitio, para los barridos de markup. */
const ARCHIVOS_DE_LA_PAGINA = (): string[] => [
  PAGINA,
  ...execFileSync('git', ['ls-files', 'src/components/sitio'], { encoding: 'utf8' })
    .split('\n')
    .filter((f) => /\/Suscribirse[^/]*\.astro$/.test(f)),
];

// ───────────────────────────────────────────────────────────────────────────
// El contenido
// ───────────────────────────────────────────────────────────────────────────

describe('el contenido de «Suscribirse» — B-230', () => {
  it('el barrido mira todas las acciones de la página', () => {
    // Control positivo: las afirmaciones de abajo recorren esta lista, y una
    // lista corta —o vacía— las dejaría pasar sin haber mirado nada. Son los
    // cuatro caminos más Instagram.
    expect(accionesDelContenido()).toHaveLength(5);
    expect(new Set(accionesDelContenido().map((a) => a.url)).size).toBe(5);
  });

  it('ninguna dirección está escrita a mano: todas salen de enlaces.ts', () => {
    const conocidas = URLS_DE_ENLACES();
    for (const accion of accionesDelContenido()) {
      expect(
        conocidas.has(accion.url),
        `«${accion.texto}» apunta a una dirección que enlaces.ts no produce: ${accion.url}. ` +
          'Si hace falta un destino nuevo, se agrega allá, que es donde está la red ' +
          'que impide publicar la variante privada del calendario.',
      ).toBe(true);
    }
  });

  it('ninguna es la variante privada del calendario', () => {
    for (const accion of accionesDelContenido()) {
      expect(accion.url, accion.texto).not.toContain('private-');
    }
  });

  it('cada camino tiene instrucciones que se pueden seguir', () => {
    for (const camino of caminosEnOrden()) {
      expect(camino.pasos.length, `«${camino.titulo}» no tiene ni un paso`).toBeGreaterThan(0);
      for (const paso of camino.pasos) {
        expect(paso.trim(), `un paso vacío en «${camino.titulo}»`).not.toBe('');
      }
      expect(camino.paraQuien.trim(), `«${camino.titulo}» no dice para quién es`).not.toBe('');
      expect(camino.accion.texto.trim(), `«${camino.titulo}» no tiene botón`).not.toBe('');
    }
  });

  it('el camino que se copia y se pega dice dónde se pega', () => {
    /*
     * Copiar la dirección no es la parte difícil: la parte difícil es encontrar,
     * en cada programa, la opción que la acepta —y que no es la que dice
     * «importar»—. Un camino que dice «pegala en tu calendario» y nada más deja
     * a la persona buscando en un menú, que es donde se abandona.
     */
    const conCopia = caminosEnOrden().filter((c) => c.accion.seCopia);
    expect(conCopia.length, 'no quedó ninguno, el chequeo no mira nada').toBe(1);

    for (const camino of conCopia) {
      const pasos = camino.pasos.join('\n');
      expect(pasos, 'no dice que hay que pegar la dirección').toMatch(/peg[aá]/i);
      for (const programa of ['Outlook', 'Thunderbird']) {
        expect(pasos, `no dice dónde se pega en ${programa}`).toContain(programa);
      }
    }
  });

  it('el orden muestra todos los caminos, cada uno una sola vez', () => {
    /*
     * El tipo obliga a que cada camino tenga contenido; esto obliga a lo otro,
     * que es lo que el tipo no puede ver: **que la página lo muestre**. Un
     * camino escrito y fuera de esta lista es un camino que nadie encuentra.
     */
    expect([...ORDEN_CAMINOS].sort()).toEqual(Object.keys(CAMINOS).sort());
    expect(new Set(ORDEN_CAMINOS).size).toBe(ORDEN_CAMINOS.length);
  });

  it('la clave del registro y el id de cada camino son el mismo', () => {
    // Se duplican para poder recorrer los caminos sin arrastrar la clave. Si se
    // separan por un copiar y pegar, un mensaje de error nombra otro camino.
    for (const [clave, camino] of Object.entries(CAMINOS)) expect(camino.id).toBe(clave);
    for (const [clave, aviso] of Object.entries(ADVERTENCIAS)) expect(aviso.id).toBe(clave);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Accesibilidad del contenido
// ───────────────────────────────────────────────────────────────────────────

describe('las acciones se anuncian a quien no ve la pantalla', () => {
  it('todas dicen adónde llevan', () => {
    for (const accion of accionesDelContenido()) {
      expect(
        accion.avisoLector.trim(),
        `«${accion.texto}» no tiene aviso para el lector de pantalla`,
      ).not.toBe('');
    }
  });

  it('la que se va del navegador avisa que abre una aplicación', () => {
    /*
     * `webcal:` es el que hace que el camino de iPhone funcione —abre la
     * aplicación Calendario en vez de bajar un archivo que después hay que ir a
     * buscar—, y es exactamente por eso que no se comporta como un enlace. Para
     * quien mira la pantalla, la aplicación que se abre es la señal. Para quien
     * escucha la página no hay ninguna señal, salvo esta.
     */
    const salenDelNavegador = accionesDelContenido().filter(
      (a) => !a.url.startsWith('https:'),
    );
    expect(salenDelNavegador.length, 'no quedó ninguna, el chequeo no mira nada').toBe(1);

    for (const accion of salenDelNavegador) {
      expect(accion.avisoLector, accion.texto).toMatch(/aplicaci[oó]n/i);
    }
  });

  it('solo las que abren una pestaña dicen que abren una pestaña', () => {
    for (const accion of accionesDelContenido()) {
      /*
       * Abre una pestaña la que es un enlace `https:` de verdad. Las otras dos
       * no: `webcal:` sale del navegador —un `target="_blank"` ahí deja una
       * pestaña en blanco— y la que se copia no es un enlace, es un texto. Y
       * anunciar una pestaña que no aparece desorienta más que no anunciar
       * nada.
       */
      const abrePestana = accion.url.startsWith('https:') && !accion.seCopia;
      expect(accion.nuevaPestana, accion.texto).toBe(abrePestana);
      expect(/pesta[nñ]a/i.test(accion.avisoLector), accion.texto).toBe(accion.nuevaPestana);
    }
  });

  it('la dirección que se copia no se ofrece además como enlace', () => {
    /*
     * Abrir esa dirección en el navegador **descarga un archivo**, y ese archivo
     * es exactamente lo que los pasos de ese camino piden no usar: copia las
     * fechas de hoy y no vuelve a mirar. Un botón que lleva ahí pone el error a
     * un toque de distancia del consejo que dice evitarlo.
     */
    for (const camino of caminosEnOrden()) {
      if (!camino.accion.seCopia) continue;
      expect(camino.accion.nuevaPestana, camino.titulo).toBe(false);
    }
    const src = fuente('src/components/sitio/SuscribirseCamino.astro');
    expect(src).toMatch(/!accion\.seCopia/);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Lo que el calendario no hace
// ───────────────────────────────────────────────────────────────────────────

describe('las advertencias', () => {
  it('están las tres y en un orden completo', () => {
    expect([...ORDEN_ADVERTENCIAS].sort()).toEqual(Object.keys(ADVERTENCIAS).sort());
    expect(advertenciasEnOrden()).toHaveLength(3);
  });

  it('cada una dice lo que existe para decir', () => {
    /*
     * Tres afirmaciones concretas, no «que el texto esté». Cada una evita una
     * sorpresa distinta y cara: presentarse a una actividad sin haberse
     * inscripto, esperar el link de la reunión en el evento, y ver un encuentro
     * desaparecer sin explicación. Un texto que se suavice hasta dejar de
     * decirlas deja de servir, y eso es lo que estas tres frenan.
     */
    expect(ADVERTENCIAS.inscripcion.texto, 'tiene que decir que no reserva el lugar').toMatch(
      /no te reserva|no reserva/i,
    );
    expect(ADVERTENCIAS.reunion.texto, 'tiene que decir que el calendario es público').toMatch(
      /cualquiera|p[uú]blico/i,
    );
    expect(ADVERTENCIAS.cancelada.texto, 'tiene que decir que se borra').toMatch(
      /se borra|desaparece/i,
    );
  });
});

// ───────────────────────────────────────────────────────────────────────────
// …y siguen siendo ciertas
// ───────────────────────────────────────────────────────────────────────────

/**
 * Los chequeos de arriba verifican que la advertencia **esté**. Ninguno puede
 * verificar que sea **cierta**: el día que cancelar un encuentro deje de
 * borrarlo del calendario, la página va a seguir diciendo que lo borra y todo
 * va a estar en verde. Es la lección de B-63 (`src/lib/ayuda.ts`), y acá pesa
 * más, porque esto lo lee gente de afuera del proyecto y decide con eso si
 * espera un link o si se presenta a un encuentro.
 *
 * Así que las dos advertencias que afirman algo sobre el evento se verifican
 * contra la función que **construye el evento de verdad** — la misma que corre
 * en la Cloud Function, importada por el alias que ya existe para eso.
 */
describe('lo que la página promete del calendario es lo que el calendario hace', () => {
  const LINK_DE_LA_REUNION = 'https://zoom.us/j/no-publicar';

  /**
   * El ciclo de ocho del §2.2, dictado por videollamada. Se usa la familia de
   * fixtures y no una actividad de una sesión escrita acá: la página promete
   * cosas sobre **encuentros de un ciclo** —«cancelar uno», «cada encuentro por
   * separado»— y un fixture de una sola sesión deja esas promesas sin probar,
   * que es la clase que persigue `tests/invariantes-de-ciclo.test.ts` (B-135).
   */
  const cicloVirtual = (urlPublica: boolean, over: Record<string, unknown> = {}) =>
    cicloDeOcho({
      sede: null,
      modalidades: [
        {
          id: 'mod_prueba',
          modalidad: 'virtual',
          sede: null,
          online: { plataforma: 'zoom', url: LINK_DE_LA_REUNION, urlPublica },
        },
      ],
      ...over,
    });

  it('«casi nunca trae el link de la reunión»: con el valor de fábrica no lo trae', () => {
    const evento = construirEvento(cicloVirtual(false), sesionesDeCiclo()[0]);
    expect(JSON.stringify(evento)).not.toContain(LINK_DE_LA_REUNION);
  });

  it('y el «casi»: cuando quien organiza decide publicarlo, el evento sí lo trae', () => {
    /*
     * Este es el motivo de que la advertencia diga «casi nunca» y no «nunca».
     * Publicar el link es una decisión por actividad y el valor de fábrica es no
     * hacerlo, pero existe. Si algún día se saca esa posibilidad, este test se
     * pone en rojo y la página puede volver a prometer «nunca».
     */
    const evento = construirEvento(cicloVirtual(true), sesionesDeCiclo()[0]);
    expect(JSON.stringify(evento)).toContain(LINK_DE_LA_REUNION);
  });

  it('«si algo se cancela, desaparece»: en un ciclo, se borra ese encuentro y ninguno más', () => {
    const antes = cicloVirtual(false);
    const despues = cicloVirtual(false, {
      sesiones: sesionesDeCiclo().map((s, i) => (i === 2 ? { ...s, cancelada: true } : s)),
    });

    expect(planificar(antes, despues)).toEqual([
      { tipo: 'borrar', id: 'ses_0003', eventId: 'evt_0003' },
    ]);
  });

  it('«cada encuentro entra por separado, con el tema de ese día»', () => {
    const ciclo = cicloVirtual(false);
    const eventos = sesionesDeCiclo().map((s) => construirEvento(ciclo, s));

    expect(eventos).toHaveLength(ENCUENTROS_DEL_CICLO);
    // Ocho eventos distintos, no ocho copias del mismo: el tema de cada
    // encuentro es lo que hace que valga la pena tenerlos por separado.
    expect(new Set(eventos.map((e) => e.summary)).size).toBe(ENCUENTROS_DEL_CICLO);
    expect(eventos[0].summary).toBe('Club de lectura: Rulfo — Capítulos 1-4');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Tono
// ───────────────────────────────────────────────────────────────────────────

describe('tono: le habla a quien va a un taller, no a quien programa', () => {
  const corpus = (): string => textoDelContenido();

  /**
   * La misma lista que `tests/ayuda.test.ts`, por el mismo motivo: la jerga se
   * cuela cuando el texto lo escribe quien tiene el código en la cabeza. Acá
   * pesa más todavía, porque esta página la lee gente de afuera del proyecto.
   */
  const PROHIBIDO = [
    '§',
    'trampa',
    '.astro',
    '.ts',
    'Firestore',
    'Cloud Function',
    'commit',
    'deploy',
    'endpoint',
    'sincroniz',
  ];

  it.each(PROHIBIDO)('el texto no dice «%s»', (termino) => {
    expect(corpus().toLowerCase()).not.toContain(termino.toLowerCase());
  });

  it('tampoco nombra los estados internos ni los identificadores', () => {
    expect(corpus()).not.toMatch(/\bslug\b/i);
    expect(corpus()).not.toMatch(/\buid\b/i);
    expect(corpus()).not.toMatch(/\bJSON\b/i);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// La página
// ───────────────────────────────────────────────────────────────────────────

describe('la página /suscribirse', () => {
  it('el barrido encuentra la página y sus componentes', () => {
    // Control positivo: sin esto, un `git ls-files` que no devuelve nada haría
    // pasar los barridos de abajo sin haber abierto un solo archivo.
    const archivos = ARCHIVOS_DE_LA_PAGINA();
    expect(archivos).toContain(PAGINA);
    expect(archivos.length).toBeGreaterThan(2);
  });

  it('declara su sección para que la barra la marque', () => {
    /*
     * `tests/chrome-del-sitio.test.ts` exige que **haya** una sección, porque
     * sin ella la página se publica sin encabezado ni pie. Lo que no puede
     * exigir —diría que sí a `seccion="contacto"`— es que sea la correcta, y
     * esta página sabe cuál es la suya.
     */
    expect(fuente(PAGINA)).toMatch(/<Base[^>]*\bseccion="suscribirse"/s);
  });

  it('no escribe ni una dirección en el markup', () => {
    /*
     * La regla de raíz: las direcciones se derivan de `enlaces.ts` y no se
     * pegan. Una pegada acá se saltea el barrido de arriba —que mira el
     * contenido, no la pantalla— y la que peor se pega es la privada.
     *
     * Los enlaces internos del sitio (`/suscribirse`) no son direcciones
     * externas y por eso el patrón busca un esquema, no una barra.
     */
    for (const archivo of ARCHIVOS_DE_LA_PAGINA()) {
      const encontradas = fuente(archivo).match(/\b(https?|webcal):\/\//g) ?? [];
      expect(encontradas, `${archivo} tiene una dirección escrita a mano`).toEqual([]);
    }
  });

  it('muestra todos los caminos y todas las advertencias, sin elegirlos a mano', () => {
    const src = fuente(PAGINA);

    // Recorre las dos listas completas…
    expect(src).toContain('caminosEnOrden()');
    expect(src).toContain('advertenciasEnOrden()');

    /*
     * …y no toca ningún camino de a uno. Es la mitad que importa: listar los
     * cuatro a mano compila, se ve bien, y el quinto que alguien escriba queda
     * fuera de la página sin que nada lo diga.
     */
    expect(
      src,
      'la página nombra un camino en particular; tiene que recorrer la lista entera',
    ).not.toMatch(/\bCAMINOS\s*[.[]/);
  });

  it('el botón de copiar no aparece si no puede copiar', () => {
    /*
     * La dirección para Outlook se copia y se pega: el botón ahorra el paso más
     * fallado del camino más difícil. Pero sale del HTML **oculto** y lo
     * muestra el script solo si hay portapapeles — sin JavaScript, o en un
     * contexto donde el portapapeles no existe, un botón que no hace nada es
     * peor que no tenerlo, y la dirección se puede seleccionar igual.
     */
    const src = fuente('src/components/sitio/SuscribirseCamino.astro');
    expect(src).toMatch(/data-copiar\s*\n?\s*hidden/);
    expect(src).toContain('navigator.clipboard');
    expect(src).toContain('boton.hidden = false');
  });

  it('el aviso de lector de pantalla no reemplaza al texto del botón', () => {
    /*
     * Un `aria-label` en el enlace **pisa** el texto visible: el nombre
     * accesible pasa a ser el aviso y deja de contener lo que está escrito, así
     * que quien maneja el sitio por voz no puede pedir el botón por su nombre.
     * Va sumado, en un `sr-only` adentro del enlace.
     */
    // Se busca el atributo puesto, no la palabra: el comentario del componente
    // la nombra justamente para explicar por qué no está.
    const src = fuente('src/components/sitio/SuscribirseAccion.astro');
    expect(src).not.toMatch(/\saria-label\s*=/);
    expect(src).toContain('sr-only');
  });

  it('el destino de la sección «dónde seguir» es Instagram', () => {
    expect(DONDE_SEGUIR.accion.url).toBe(urlDeInstagram());
  });
});
