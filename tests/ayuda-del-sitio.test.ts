import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import opcionesBase from '@/lib/opciones-base.json';
import * as RUTAS from '@/lib/rutasPublicas';
import {
  CIERRE_DE_AYUDA,
  ENTRADA_DE_AYUDA,
  FORMAS_DE_ARANCEL,
  GRUPOS_DE_AYUDA,
  PREGUNTAS_DE_AYUDA,
  TIPOS_DE_ACTIVIDAD,
} from '@/lib/ayudaDelSitio';

/**
 * La ayuda del **sitio público** — B-232.
 *
 * No confundir con `tests/ayuda.test.ts`, que cuida la guía del **panel**. Esta
 * le habla a quien busca una actividad; aquella, a quien la carga.
 *
 * Tres cosas que este archivo verifica y que no se ven mirando la página:
 *
 * 1. **Que no falte una pregunta.** La lista obligatoria está abajo, con el
 *    motivo de por qué cada una es obligatoria. Borrar una respuesta pone esto
 *    en rojo nombrando cuál.
 * 2. **Que el texto no se quede atrás del modelo.** El glosario de tipos y el de
 *    aranceles se derivan de `opciones-base.json`: agregar una categoría base
 *    —ya pasó dos veces— deja la ayuda incompleta y acá se dice cuál falta. Es
 *    la forma de "verificar la clase, no la instancia" de `05-patrones.md`: la
 *    lista se deriva del código y lo nuevo entra solo.
 * 3. **Que no se cuele lo que el §5.1 no publica.** Es texto libre en una salida
 *    pública, y un ejemplo con el link de una reunión de verdad es la trampa 5.
 */

const raiz = (rel: string): string => fileURLToPath(new URL(`../${rel}`, import.meta.url));

/** Todo el texto que la página muestra, en una lista plana. */
const TEXTOS = (): string[] => [
  ENTRADA_DE_AYUDA,
  CIERRE_DE_AYUDA.titulo,
  CIERRE_DE_AYUDA.texto,
  CIERRE_DE_AYUDA.enlace.texto,
  ...GRUPOS_DE_AYUDA.map((g) => g.titulo),
  ...PREGUNTAS_DE_AYUDA.flatMap((p) => [
    p.pregunta,
    ...p.respuesta,
    ...(p.glosario ?? []).flatMap((t) => [t.label, t.que]),
    ...(p.enlaces ?? []).map((e) => e.texto),
  ]),
];

/**
 * Las preguntas que la página **tiene** que contestar, con por qué.
 *
 * No es "las que se nos ocurrieron": son las que decide el encargo y las que
 * salen del modelo. Una página de ayuda se degrada por lo que le sacan, no por
 * lo que le agregan, y sin esta lista sacar la del link de la reunión no rompe
 * nada.
 */
const OBLIGATORIAS: Record<string, string> = {
  'que-es': 'sin esto la página no dice qué es el sitio',
  'no-es-inscripcion': 'esto NO es una plataforma de inscripción, y es la confusión más cara',
  tipos: 'qué significa cada tipo de actividad',
  'a-la-gorra': 'opción de primera clase del circuito, no un caso raro (§4.1)',
  ciclo: 'por qué un ciclo es una tarjeta con varios encuentros (§2.2)',
  'como-me-anoto': 'la inscripción va por el canal de quien organiza',
  'link-de-la-reunion': 'por qué el link de la reunión no se publica (§5.1, trampa 5)',
  suscribirme: 'cómo suscribirse al calendario',
  sugerir: 'cómo sugerir una actividad',
  'hay-un-error': 'cómo avisar de un error',
};

/**
 * Las rutas del sitio, **leídas del encabezado**. Es el componente que declara
 * las secciones que existen: derivarlas de ahí evita que esta ayuda linkee a una
 * página que nadie escribió (y evita una segunda lista que se desincroniza).
 */
const rutasDelSitio = (): string[] => {
  /*
   * Desde B-330 el encabezado declara los destinos como **constantes** de
   * `rutasPublicas.ts` y no como literales (era B-293: un `href` sin la barra
   * final se come un 301). Así que se lee el nombre y se resuelve contra el
   * módulo: sigue siendo «las secciones que el encabezado declara», y encima
   * ahora falla si alguien nombra una constante que no existe.
   */
  const src = readFileSync(raiz('src/components/sitio/Encabezado.astro'), 'utf8');
  return [...src.matchAll(/href:\s*([A-Z_]+),/g)].map((m) => {
    const valor = (RUTAS as Record<string, unknown>)[m[1]!];
    expect(typeof valor, `el encabezado nombra ${m[1]} y rutasPublicas no lo exporta`).toBe(
      'string',
    );
    return valor as string;
  });
};

/** Jerga que no le dice nada a quien busca un taller. */
const JERGA = ['§', '.ts', '.json', '.astro', 'Firestore', 'events.json', 'toPublic', 'slug'];

/**
 * Lo que el §5.1 no publica nunca. No alcanza con no tener el dato: el riesgo
 * de una página de ayuda es el ejemplo bien intencionado ("por ejemplo,
 * https://zoom.us/j/…") que sí lo publica.
 */
const PROHIBIDO = [
  'zoom.us/j',
  'meet.google.com/',
  'jit.si/',
  'https://',
  'http://',
  'wa.me/',
  '@gmail',
];

describe('la ayuda del sitio público — B-232', () => {
  it('el barrido recorre la página entera', () => {
    // Control positivo: las aserciones de abajo recorren estas listas, y con
    // listas cortas pasarían sin haber leído nada.
    expect(GRUPOS_DE_AYUDA.length).toBeGreaterThanOrEqual(5);
    expect(PREGUNTAS_DE_AYUDA.length).toBeGreaterThanOrEqual(15);
    expect(TEXTOS().length).toBeGreaterThanOrEqual(60);
    expect(rutasDelSitio()).toContain(RUTAS.RUTA_CONTACTO);
  });

  it('cada pregunta tiene un ancla estable y única', () => {
    // El id es la URL de la respuesta (`/ayuda#a-la-gorra`): repetido, el
    // navegador salta al primero y la mitad de los links llevan al lugar
    // equivocado sin que nada falle.
    const ids = PREGUNTAS_DE_AYUDA.map((p) => p.id);
    expect(new Set(ids).size, 'hay ids repetidos').toBe(ids.length);

    for (const id of [...ids, ...GRUPOS_DE_AYUDA.map((g) => g.id)]) {
      expect(id, `«${id}» no es un ancla válida`).toMatch(/^[a-z][a-z0-9-]*$/);
    }
  });

  it('ninguna respuesta está vacía', () => {
    for (const p of PREGUNTAS_DE_AYUDA) {
      expect(p.respuesta.length, `«${p.pregunta}» no tiene respuesta`).toBeGreaterThan(0);
      for (const parrafo of p.respuesta) {
        expect(parrafo.trim().length, `«${p.pregunta}» tiene un párrafo vacío`).toBeGreaterThan(30);
      }
    }
  });

  it('contesta las preguntas que tiene que contestar', () => {
    const ids = new Set(PREGUNTAS_DE_AYUDA.map((p) => p.id));
    const faltan = Object.entries(OBLIGATORIAS)
      .filter(([id]) => !ids.has(id))
      .map(([id, motivo]) => `${id} (${motivo})`);

    expect(
      faltan,
      'la ayuda dejó de contestar algo que tiene que contestar. Si la pregunta ' +
        'cambió de nombre, actualizá OBLIGATORIAS; si se sacó, volvé a ponerla.',
    ).toEqual([]);
  });

  it('explica todos los tipos de actividad del modelo, y ninguno de más', () => {
    /*
     * La clase, no la instancia: la lista sale de `opciones-base.json`, que es
     * de donde también sale el desplegable del panel. El día que se agregue una
     * categoría base —ya pasó con «Feria» (B-129) y con «Librería a la calle»—
     * este test la nombra en vez de dejar una ayuda que enumera cinco tipos
     * mientras el sitio muestra siete.
     */
    const base = opcionesBase.tipo.filter((v) => v.fijo).map((v) => v.slug);
    expect(base.length).toBeGreaterThanOrEqual(5);
    expect(TIPOS_DE_ACTIVIDAD.map((t) => t.slug).sort()).toEqual([...base].sort());

    // Y el nombre no se reescribe a mano: es el mismo que ve quien carga.
    for (const t of TIPOS_DE_ACTIVIDAD) {
      const enBase = opcionesBase.tipo.find((v) => v.slug === t.slug)!;
      expect(t.label).toBe(enBase.label);
      expect(t.que.length, `«${t.label}» está sin explicar`).toBeGreaterThan(40);
    }
  });

  it('explica las tres formas de arancel, con «a la gorra» diferenciada de gratis', () => {
    const base = opcionesBase.arancel.filter((v) => v.fijo).map((v) => v.slug);
    expect(FORMAS_DE_ARANCEL.map((t) => t.slug).sort()).toEqual([...base].sort());

    const gorra = FORMAS_DE_ARANCEL.find((t) => t.slug === 'a-la-gorra')!;
    // La propiedad que importa del §4.1: «a la gorra» no es gratis ni es un caso
    // raro. Una definición que no lo diga deja intacto el malentendido.
    expect(gorra.que.toLowerCase()).toContain('gratis');
    expect(gorra.que.length).toBeGreaterThan(150);
  });

  it('el link de la reunión se explica como decisión, no como olvido', () => {
    const p = PREGUNTAS_DE_AYUDA.find((q) => q.id === 'link-de-la-reunion')!;
    const texto = p.respuesta.join(' ').toLowerCase();
    // Si dijera solo "no está", quien lo lee asume que falta cargarlo y escribe
    // para pedirlo. Tiene que decir que lo manda quien organiza al anotarse.
    expect(texto).toContain('no lo publicamos');
    expect(texto).toMatch(/anot/);
  });

  it('todos los enlaces van a secciones que el sitio tiene', () => {
    const rutas = new Set(rutasDelSitio());
    const rotos = PREGUNTAS_DE_AYUDA.flatMap((p) => p.enlaces ?? [])
      .concat(CIERRE_DE_AYUDA.enlace)
      .map((e) => e.href)
      .filter((href) => !rutas.has(href));

    expect(rotos, 'estos destinos no son secciones declaradas en el encabezado').toEqual([]);
  });

  it('la ayuda manda a suscribirse y a contacto, que es donde sigue el camino', () => {
    const destinos = new Set(
      PREGUNTAS_DE_AYUDA.flatMap((p) => p.enlaces ?? []).map((e) => e.href),
    );
    // El encargo pide que estas dos salidas existan: la página de suscripción la
    // escribe otro frente y contacto es la única forma de avisar de un error.
    expect(destinos).toContain(RUTAS.RUTA_SUSCRIBIRSE);
    expect(destinos).toContain(RUTAS.RUTA_CONTACTO);
  });

  it('el texto no tiene jerga', () => {
    for (const texto of TEXTOS()) {
      for (const palabra of JERGA) {
        expect(texto, `«${texto.slice(0, 60)}…» tiene jerga: ${palabra}`).not.toContain(palabra);
      }
    }
  });

  it('no publica nada que el §5.1 prohíbe', () => {
    for (const texto of TEXTOS()) {
      for (const aguja of PROHIBIDO) {
        expect(texto, `«${texto.slice(0, 60)}…» contiene ${aguja}`).not.toContain(aguja);
      }
    }
  });

  it('ningún texto de las dos páginas cae por debajo del contraste AA', () => {
    /*
     * Medido, no estimado. Con la paleta de `global.css` —papel `#fcfaf6`, tinta
     * `#171b22`— el texto atenuado sobre papel da:
     *
     * | clase           | contraste | AA (4.5:1 para texto normal) |
     * |-----------------|-----------|------------------------------|
     * | `text-tinta`    | 16,6:1    | sí                           |
     * | `text-tinta/80` |  8,9:1    | sí                           |
     * | `text-tinta/70` |  6,3:1    | sí                           |
     * | `text-tinta/60` |  4,5:1    | **no, por un pelo** (4,49)   |
     *
     * `/60` se ve perfectamente bien y por eso es el que se escribe sin pensar:
     * la primera versión de estas dos páginas lo usaba en cuatro lugares. No hay
     * forma de notarlo mirando, así que va como chequeo y no como criterio.
     *
     * Es la clase y no la instancia: prohíbe el rango entero, así que el próximo
     * `text-tinta/45` entra en rojo sin que nadie tenga que acordarse.
     */
    for (const rel of ['src/pages/ayuda.astro', 'src/pages/contacto.astro']) {
      const src = readFileSync(raiz(rel), 'utf8');
      const flojos = [...src.matchAll(/text-tinta\/(\d+)/g)]
        .map((m) => Number(m[1]))
        .filter((opacidad) => opacidad < 70);

      expect(
        flojos,
        `${rel} atenúa el texto por debajo de AA. Con esta paleta el piso es /70.`,
      ).toEqual([]);
    }
  });

  it('ningún documento afirma una cantidad de preguntas que no es la que hay', () => {
    /*
     * El `auditor-documentacion` encontró esto el 2026-08-28, y el hallazgo es de
     * los que valen: cinco lugares de la doc —escritos en el **mismo cambio** que
     * las preguntas— decían «diecisiete» cuando ya eran 20. No era doc vieja: nació
     * mal, porque el número se contó sobre un borrador y después entraron cinco
     * preguntas más.
     *
     * Ningún test lo miraba, y el que había solo ponía un piso
     * (`toBeGreaterThanOrEqual(15)`), que es exactamente lo que deja pasar un
     * conteo equivocado. Así que la afirmación pasa a estar atada: el número va en
     * dígitos en la doc para que se pueda leer desde acá, y cualquier archivo que
     * diga «N preguntas» tiene que decir la verdad.
     *
     * Si mañana la doc deja de mencionar un número, esto no falla — no hay nada
     * que contradecir. Lo que no puede es mentir.
     */
    const reales = PREGUNTAS_DE_AYUDA.length;
    const documentos = [
      'docs/04-funcionalidades.md',
      'docs/06-decisiones.md',
      'docs/BACKLOG.md',
      'docs/CHANGELOG.md',
    ];

    // Control positivo: si la doc dejó de nombrar el conteo en todos lados, este
    // chequeo pasa vacío y conviene saberlo antes de confiar en él.
    const menciones = documentos.flatMap((rel) =>
      [...readFileSync(raiz(rel), 'utf8').matchAll(/(\d+)\s*\n?preguntas/g)].map((m) => ({
        rel,
        dice: Number(m[1]),
      })),
    );
    expect(menciones.length, 'ningún documento menciona el conteo').toBeGreaterThan(0);

    const mentirosos = menciones.filter((m) => m.dice !== reales);
    expect(
      mentirosos,
      `hay ${reales} preguntas en la ayuda y estos documentos dicen otra cosa`,
    ).toEqual([]);
  });

  it('la página no incrusta el contenido: lo importa', () => {
    /*
     * La regla que sostiene todo lo de arriba. Si el próximo párrafo se escribe
     * directo en el `.astro`, ninguna de estas aserciones lo mira y la página
     * queda con una mitad verificada y otra no.
     */
    const pagina = readFileSync(raiz('src/pages/ayuda.astro'), 'utf8');
    expect(pagina).toContain("from '@/lib/ayudaDelSitio'");

    const incrustados = PREGUNTAS_DE_AYUDA.filter((p) => pagina.includes(p.pregunta)).map(
      (p) => p.id,
    );
    expect(incrustados, 'estas preguntas están pegadas en el marcado').toEqual([]);
  });
});
