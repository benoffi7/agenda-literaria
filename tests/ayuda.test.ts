import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { AVISOS, CAPITULOS, CAPITULO_POR_CONTEXTO } from '@/lib/ayuda';

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

describe('avisos de lo irreversible', () => {
  /**
   * Los seis comportamientos que se hacen mal una vez y no se pueden deshacer.
   * Son el pedido explícito del dueño: si alguno deja de estar explicado, hay
   * alguien cargando actividades que va a descubrirlo rompiendo algo.
   */
  const OBLIGATORIOS = [
    'slug-bloqueado',
    'link-reunion',
    'interno',
    'cancelar-encuentro',
    'borrador-borra-eventos',
    'calendario-espejo',
  ];

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
