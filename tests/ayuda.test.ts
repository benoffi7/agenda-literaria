import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { AVISOS, CAPITULOS, CAPITULO_POR_CONTEXTO } from '@/lib/ayuda';
import type { VinculoTest } from '@/lib/ayuda';

/**
 * La ayuda del panel es contenido, y el contenido se desactualiza en silencio.
 * Estos tests son el único mecanismo automático que lo evita: fijan qué tiene
 * que estar explicado y con qué tono. Si un cambio del formulario los rompe, la
 * respuesta no es aflojar el test, es escribir la ayuda que falta.
 */

/** Todo el texto que le llega a la persona, en una sola cadena. */
const corpus = [
  ...AVISOS.flatMap((a) => [a.titulo, a.texto]),
  ...CAPITULOS.flatMap((c) => [c.titulo, c.paraQue, ...c.puntos.map((p) => p.texto)]),
].join('\n');

/**
 * Los seis comportamientos que se hacen mal una vez y no se pueden deshacer.
 * Son el pedido explícito del dueño: si alguno deja de estar explicado, hay
 * alguien cargando actividades que va a descubrirlo rompiendo algo.
 *
 * Vive fuera del `describe` porque el bloque de B-63 del final lo usa también:
 * los seis no solo tienen que estar explicados, tienen que estar atados.
 */
const OBLIGATORIOS = [
  'slug-bloqueado',
  'link-reunion',
  'interno',
  'cancelar-encuentro',
  'borrador-borra-eventos',
  'calendario-espejo',
];

describe('avisos de lo irreversible', () => {
  it.each(OBLIGATORIOS)('está explicado: %s', (id) => {
    const aviso = AVISOS.find((a) => a.id === id);
    expect(aviso, `falta el aviso «${id}» en src/lib/ayuda.ts`).toBeDefined();
    expect(aviso!.titulo.length).toBeGreaterThan(10);
    expect(aviso!.texto.length).toBeGreaterThan(80);
  });

  it('no hay dos avisos con el mismo id', () => {
    expect(new Set(AVISOS.map((a) => a.id)).size).toBe(AVISOS.length);
  });
});

describe('capítulos', () => {
  it('cada sección del formulario tiene su capítulo', () => {
    // Lee el formulario de verdad, como `tests/opciones-orden.test.ts`: es la
    // forma de que agregar una sección nueva sin escribir su ayuda falle acá y
    // no dos meses después, cuando alguien no entienda para qué es.
    //
    // Desde B-79 cada sección vive en su archivo dentro de `formulario/`, así
    // que se lee el directorio entero: mirar solo `ActividadFormulario.tsx`
    // dejaría de ver ocho de las nueve secciones y el test pasaría sin haber
    // mirado nada.
    const fuente = [
      readFileSync('src/components/admin/ActividadFormulario.tsx', 'utf8'),
      ...readdirSync('src/components/admin/formulario')
        .filter((f) => f.endsWith('.tsx'))
        .map((f) => readFileSync(`src/components/admin/formulario/${f}`, 'utf8')),
    ].join('\n');
    const secciones = [...fuente.matchAll(/\btitulo="([^"]+)"/g)].map((m) => m[1]!);
    expect(secciones.length).toBeGreaterThanOrEqual(9);

    const cubiertas = new Set(
      CAPITULOS.map((c) => c.seccionFormulario).filter((s): s is string => Boolean(s)),
    );
    const sinAyuda = secciones.filter((s) => !cubiertas.has(s));
    expect(
      sinAyuda,
      `secciones del formulario sin capítulo en src/lib/ayuda.ts: ${sinAyuda.join(', ')}`,
    ).toEqual([]);
  });

  it('todo capítulo dice para qué sirve y tiene al menos un punto', () => {
    for (const c of CAPITULOS) {
      expect(c.paraQue.length, `«${c.titulo}» sin "para qué"`).toBeGreaterThan(30);
      expect(c.puntos.length, `«${c.titulo}» sin puntos`).toBeGreaterThan(0);
      for (const p of c.puntos) {
        expect(p.texto.length, `punto vacío en «${c.titulo}»`).toBeGreaterThan(20);
      }
    }
  });

  it('no hay dos capítulos con el mismo id', () => {
    expect(new Set(CAPITULOS.map((c) => c.id)).size).toBe(CAPITULOS.length);
  });

  it('el capítulo que abre según la pantalla existe', () => {
    for (const id of Object.values(CAPITULO_POR_CONTEXTO)) {
      expect(CAPITULOS.some((c) => c.id === id), `no existe el capítulo «${id}»`).toBe(true);
    }
  });

  it('hay capítulo para lo que no es una sección del formulario', () => {
    // El recorrido completo y el listado no son secciones, y son justo lo que
    // no se puede deducir mirando el formulario.
    for (const id of ['flujo', 'listado', 'listas']) {
      expect(CAPITULOS.some((c) => c.id === id)).toBe(true);
    }
  });
});

describe('tono: le habla a quien organiza actividades, no a quien programa', () => {
  /**
   * Jerga que ya se colaba en la documentación del proyecto y que acá no sirve
   * de nada: nombres de archivo, referencias a secciones del `CLAUDE.md`,
   * nombres de campos y de herramientas.
   */
  const PROHIBIDO = [
    '§',
    'trampa',
    '.tsx',
    '.json',
    'Firestore',
    'Cloud Function',
    'localStorage',
    'commit',
    'deploy',
    'searchText',
    'urlPublica',
    'calendarEventId',
  ];

  it.each(PROHIBIDO)('el texto no dice «%s»', (termino) => {
    expect(corpus.toLowerCase()).not.toContain(termino.toLowerCase());
  });

  it('tampoco nombra los estados internos en inglés ni los uids', () => {
    expect(corpus).not.toMatch(/\buid\b/i);
    expect(corpus).not.toMatch(/\bslug\b/i);
  });
});

// ─────────────────────────────────────────────────────────────────────
// B-63 · que lo que la guía afirma siga siendo cierto
// ─────────────────────────────────────────────────────────────────────

/**
 * Los tests de arriba verifican que el texto **esté**. Ninguno puede verificar
 * que sea **cierto**: si mañana cancelar un encuentro deja de sacarlo del
 * calendario, la guía va a seguir diciendo que lo saca y todo va a estar en
 * verde. Y una ayuda que miente es peor que no tener ayuda, porque la gente
 * toma decisiones que no se deshacen leyéndola.
 *
 * El vínculo de B-63: cada aviso nombra, en `atadoA`, los tests de
 * comportamiento que fijan lo que afirma. Lo que se verifica acá es que ese
 * vínculo **siga en pie**, no que exista la cita:
 *
 *  1. el archivo existe y entra en la corrida de `npm test`;
 *  2. contiene un `it` con ese nombre exacto, escrito como llamada y no
 *     mencionado en un comentario ni en otra cadena;
 *  3. ese `it` no está apagado ni invertido (`.skip`, `.todo`, `.fails`,
 *     `.skipIf`…), y tampoco lo apaga ninguno de sus `describe`. Un `it.each`
 *     no tiene nombre propio —el suyo es una plantilla—, así que no se registra
 *     y un vínculo que apunte ahí cae por el punto 2.
 *
 * Así, borrar o renombrar el test que sostiene un aviso rompe esto nombrando
 * qué vínculo se cortó, que es la única señal automática que existe de "la
 * guía puede haber quedado mintiendo".
 *
 * **Tres cosas que este chequeo NO puede ver**, y por eso están anotadas en
 * B-63 en vez de dadas por cubiertas:
 *
 *  - Que el `it` atado afirme de verdad lo que el aviso dice. Que siga
 *    afirmando *algo* lo sostiene el propio `it` —si su cuerpo dejara de
 *    afirmar, o afirmara otra cosa, fallaría en la misma corrida—, pero que la
 *    afirmación siga siendo *la del aviso* es trabajo de la review.
 *  - Las frases del texto que no tienen ningún `it` atado. El vínculo cubre las
 *    afirmaciones atadas, no el párrafo entero.
 *  - Un comportamiento que nadie testea todavía. Ahí no hay test que romper.
 */

/** Un `it` tal como está escrito en el fuente de un test. */
interface ItDelFuente {
  nombre: string;
  /** `['skip']` en `it.skip`, `['each']` en `it.each`, `[]` en un `it` pelado. */
  modificadores: string[];
  /** Modificadores de los `describe` que lo contienen, de afuera hacia adentro. */
  contenedores: string[][];
}

/**
 * Recorre el fuente carácter por carácter en vez de buscar con un regex.
 *
 * Es más código, y es el que hace que el vínculo no sea decorativo. Las cuatro
 * formas de que un chequeo que lee un fuente crea haber encontrado lo que
 * buscaba, todas vistas en este repo:
 *
 *  1. **Buscar el nombre suelto**: lo satisface el `import`, o cualquier
 *     mención. Acá el nombre solo cuenta si es el primer argumento de una
 *     llamada a `it(`.
 *  2. **Leer con los comentarios adentro**: lo satisface la prosa, y este repo
 *     escribe comentarios largos que citan el código que explican. El walker
 *     saltea comentarios, así que un `it('…')` citado en un comentario no
 *     cuenta como test.
 *  3. **Confundir una cadena con código**: una comilla suelta dentro de un
 *     literal de regex (`/titulo="([^"]+)"/`) desincroniza a cualquier lector
 *     ingenuo y le hace tragarse el `it` siguiente. De ahí que los literales de
 *     regex se detecten y se salteen como una unidad.
 *  4. **Mirar solo el `it` y no su `describe`**: un `describe.skip` deja el
 *     `it` intacto en el fuente y no lo corre nadie. De ahí la pila de
 *     contenedores.
 */
const analizar = (
  src: string,
): { its: ItDelFuente[]; sinComentarios: string } => {
  const its: ItDelFuente[] = [];
  const pila: { modificadores: string[]; profundidad: number }[] = [];
  const limpio: string[] = [];
  let profundidad = 0;
  let i = 0;

  const esIdent = (c: string | undefined): boolean => !!c && /[A-Za-z0-9_$]/.test(c);
  const copiar = (desde: number, hasta: number): void => {
    limpio.push(src.slice(desde, hasta));
  };

  /** Fin (exclusivo) de un literal de cadena que arranca en `desde`. */
  const finDeCadena = (desde: number): number => {
    const comilla = src[desde]!;
    let j = desde + 1;
    while (j < src.length) {
      if (src[j] === '\\') {
        j += 2;
        continue;
      }
      if (src[j] === comilla) return j + 1;
      j++;
    }
    return src.length;
  };

  /** Fin (exclusivo) de un literal de regex que arranca en `desde`. */
  const finDeRegex = (desde: number): number => {
    let j = desde + 1;
    let enClase = false;
    while (j < src.length) {
      const c = src[j]!;
      if (c === '\\') {
        j += 2;
        continue;
      }
      if (c === '\n') return j;
      if (enClase) {
        if (c === ']') enClase = false;
      } else if (c === '[') {
        enClase = true;
      } else if (c === '/') {
        return j + 1;
      }
      j++;
    }
    return src.length;
  };

  /**
   * ¿Ese `/` abre un regex o es una división? Se decide por el carácter
   * significativo anterior: después de un identificador, un número, `)` o `]`
   * es división; en cualquier otro lugar, regex.
   */
  const abreRegex = (): boolean => {
    let j = i - 1;
    while (j >= 0 && /\s/.test(src[j]!)) j--;
    const previo = src[j];
    if (previo === undefined) return true;
    return !(esIdent(previo) || previo === ')' || previo === ']');
  };

  const saltarEspacios = (desde: number): number => {
    let j = desde;
    while (j < src.length && /\s/.test(src[j]!)) j++;
    return j;
  };

  const desescapar = (s: string): string => s.replace(/\\(['"`\\])/g, '$1');

  while (i < src.length) {
    const c = src[i]!;

    // Comentarios: se saltean y NO se copian, así la prosa no satisface nada.
    if (c === '/' && src[i + 1] === '/') {
      const fin = src.indexOf('\n', i);
      i = fin < 0 ? src.length : fin;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      const fin = src.indexOf('*/', i + 2);
      i = fin < 0 ? src.length : fin + 2;
      continue;
    }
    if (c === '/' && abreRegex()) {
      const fin = finDeRegex(i);
      copiar(i, fin);
      i = fin;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      const fin = finDeCadena(i);
      copiar(i, fin);
      i = fin;
      continue;
    }
    if (c === '{') {
      profundidad++;
      copiar(i, i + 1);
      i++;
      continue;
    }
    if (c === '}') {
      profundidad--;
      while (pila.length > 0 && pila[pila.length - 1]!.profundidad >= profundidad) pila.pop();
      copiar(i, i + 1);
      i++;
      continue;
    }

    if (/[A-Za-z_$]/.test(c) && !esIdent(src[i - 1])) {
      const m = /^(describe|it|test)((?:\.[A-Za-z0-9_$]+)*)/.exec(src.slice(i));
      const abre = m ? saltarEspacios(i + m[0].length) : -1;
      if (m && src[abre] === '(') {
        const modificadores = m[2] ? m[2]!.slice(1).split('.') : [];
        if (m[1] === 'describe') {
          pila.push({ modificadores, profundidad });
        } else {
          const arg = saltarEspacios(abre + 1);
          const comilla = src[arg];
          if (comilla === '"' || comilla === "'" || comilla === '`') {
            const fin = finDeCadena(arg);
            its.push({
              nombre: desescapar(src.slice(arg + 1, fin - 1)),
              modificadores,
              contenedores: pila.map((p) => p.modificadores),
            });
          }
        }
        copiar(i, abre + 1);
        i = abre + 1;
        continue;
      }
      let fin = i;
      while (fin < src.length && esIdent(src[fin])) fin++;
      copiar(i, fin);
      i = fin;
      continue;
    }

    copiar(i, i + 1);
    i++;
  }

  return { its, sinComentarios: limpio.join('') };
};

const analisis = new Map<string, ReturnType<typeof analizar>>();
const analizarArchivo = (ruta: string): ReturnType<typeof analizar> => {
  let a = analisis.get(ruta);
  if (!a) {
    a = analizar(readFileSync(ruta, 'utf8'));
    analisis.set(ruta, a);
  }
  return a;
};

/**
 * Modificadores que no cambian si el test corre ni qué afirma. Todo lo demás
 * —`.skip`, `.todo`, `.fails`, `.skipIf`— invalida el vínculo: o el test no
 * corre, o afirma lo contrario de lo que el aviso dice.
 */
const MODIFICADORES_INOCUOS = ['concurrent', 'sequential'];

/** Un vínculo con el lugar de la guía del que salió, para el mensaje de error. */
interface Vinculado {
  donde: string;
  vinculo: VinculoTest;
}

const VINCULOS: Vinculado[] = [
  ...AVISOS.flatMap((a) => a.atadoA.map((vinculo) => ({ donde: `aviso «${a.id}»`, vinculo }))),
  ...CAPITULOS.flatMap((c) =>
    c.puntos.flatMap((p, i) =>
      (p.atadoA ?? []).map((vinculo) => ({
        donde: `punto ${i + 1} del capítulo «${c.id}»`,
        vinculo,
      })),
    ),
  ),
];

describe('B-63 · cada aviso está atado a un test de comportamiento', () => {
  it.each(OBLIGATORIOS)('el aviso «%s» nombra al menos un test que lo fija', (id) => {
    const aviso = AVISOS.find((a) => a.id === id)!;
    expect(
      aviso.atadoA.length,
      `el aviso «${id}» no ata ningún test: si el comportamiento cambia, el texto ` +
        'queda mintiendo y nada falla. Atalo al `it` que lo fija en `atadoA`.',
    ).toBeGreaterThan(0);
  });

  it('hay vínculos, y no un array vacío que haría pasar todo esto por omisión', () => {
    expect(VINCULOS.length).toBeGreaterThanOrEqual(AVISOS.length);
  });

  it.each(VINCULOS.map((v) => [`${v.donde} → ${v.vinculo.it}`, v] as [string, Vinculado]))(
    '%s',
    (_etiqueta, { donde, vinculo }) => {
      const { archivo } = vinculo;
      const buscado = vinculo.it;

      // Que el archivo entre en la corrida: `tests/**/*.test.ts` del config.
      expect(
        archivo.startsWith('tests/') && archivo.endsWith('.test.ts'),
        `${donde}: «${archivo}» no entra en la corrida de \`npm test\`.`,
      ).toBe(true);

      // Los de integración se saltean solos sin emuladores (`tests/emulador.ts`):
      // un vínculo ahí podría estar verde sin haber corrido nada.
      expect(
        archivo.endsWith('.integracion.test.ts'),
        `${donde}: «${archivo}» es un test de integración y se saltea sin ` +
          'emuladores, así que no puede sostener un aviso.',
      ).toBe(false);

      expect(existsSync(archivo), `${donde}: no existe «${archivo}».`).toBe(true);

      const { its } = analizarArchivo(archivo);
      const iguales = its.filter((t) => t.nombre === buscado);

      if (iguales.length === 0) {
        // El mensaje tiene que decir qué hacer. Los nombres parecidos suelen ser
        // el mismo test renombrado, que es el caso frecuente.
        const parecidos = its
          .filter((t) => {
            const a = t.nombre.toLowerCase();
            const b = buscado.toLowerCase();
            return a.includes(b.slice(0, 18)) || b.includes(a.slice(0, 18));
          })
          .map((t) => `«${t.nombre}»`);
        expect.fail(
          `Vínculo cortado. ${donde} dice lo que fija «${buscado}» de ${archivo}, ` +
            `y ese \`it\` ya no está con ese nombre.\n` +
            (parecidos.length > 0
              ? `Candidatos a que sea el mismo test renombrado: ${parecidos.join(', ')}.\n`
              : '') +
            'Si el test se renombró, actualizá `atadoA` en src/lib/ayuda.ts. Si el ' +
            'comportamiento cambió, el texto de la guía cambia en el mismo commit: ' +
            'una ayuda que miente es peor que no tener ayuda.',
        );
      }

      for (const t of iguales) {
        const propios = t.modificadores.filter((m) => !MODIFICADORES_INOCUOS.includes(m));
        expect(
          propios,
          `${donde}: «${buscado}» de ${archivo} está marcado \`it.${propios.join('.')}\`, ` +
            'así que no corre o no afirma lo que el aviso dice.',
        ).toEqual([]);

        const contenedoresApagados = t.contenedores
          .flatMap((mods) => mods.filter((m) => !MODIFICADORES_INOCUOS.includes(m)))
          .map((m) => `describe.${m}`);
        expect(
          contenedoresApagados,
          `${donde}: «${buscado}» de ${archivo} está intacto pero lo apaga ` +
            `${contenedoresApagados.join(', ')}. Un test que no corre no sostiene nada.`,
        ).toEqual([]);
      }
    },
  );
});

describe('B-63 · el nombre del test no sale a la pantalla', () => {
  /*
   * `atadoA` es data para el test. Si se filtrara al texto, la guía le estaría
   * hablando a quien programa y no a quien organiza actividades — que es lo que
   * el bloque de tono de arriba existe para impedir.
   */
  it('el texto que se lee no nombra ningún archivo de test', () => {
    expect(corpus).not.toContain('.test.ts');
    expect(corpus).not.toContain('tests/');
    for (const { vinculo } of VINCULOS) expect(corpus).not.toContain(vinculo.archivo);
  });

  it('la pantalla de ayuda no renderiza el campo', () => {
    // Sin los comentarios: si el chequeo los leyera, una línea que explique por
    // qué no se renderiza lo satisfaría, que es el modo de falla de B-176.
    const { sinComentarios } = analizar(
      readFileSync('src/components/admin/ayuda/CentroAyuda.tsx', 'utf8'),
    );
    expect(sinComentarios).toContain('AVISOS.map');
    expect(sinComentarios).not.toContain('atadoA');
  });
});
