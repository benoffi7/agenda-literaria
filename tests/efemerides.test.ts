/**
 * **Una efeméride: el schema, la regla y el trigger dicen lo mismo** — B-959.
 *
 * `firestore.rules` es un runtime aparte y no puede importar TypeScript, así que
 * cada tope se escribe dos veces. Este archivo es lo que hace que las dos copias
 * no se separen (clase de B-88): cada cota del bloque de `/efemerides` sale de
 * una constante de `src/types/efemeride.ts`, y el `hasOnly` enumera exactamente
 * los campos que el panel escribe.
 *
 * Y la parte del trigger: que exista, que esté exportado y que la guarda de
 * rebuild haga lo que su docblock dice — un borrador no le cuesta un build a
 * nadie; publicar, despublicar, editar una publicada y borrarla, sí.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { sinComentarios } from '../scripts/sin-comentarios.mjs';
import {
  RE_SLUG_EFEMERIDE,
  efemerideAFormulario,
  efemerideFormSchema,
  efemerideVacia,
  esDiaDelMes,
  formAEfemeride,
  fuenteDelForm,
  slugDeEfemeride,
  slugDeEfemerideBloqueado,
} from '@/lib/efemeride-schema';
import {
  DIAS_POR_MES,
  MIN_ANIO_EFEMERIDE,
  MIN_TITULO_EFEMERIDE,
  TOPE_ANIO_EFEMERIDE,
  TOPE_DESCRIPCION_EFEMERIDE,
  TOPE_FUENTE_TEXTO_EFEMERIDE,
  TOPE_FUENTE_URL_EFEMERIDE,
  TOPE_SLUG_EFEMERIDE,
  TOPE_TITULO_EFEMERIDE,
  type Efemeride,
  type EfemerideForm,
} from '@/types/efemeride';
import { efemerideAmeritaRebuild } from '../functions/efemerides.js';
import { ts } from './fixtures/tiempo';

const raiz = (rel: string) => fileURLToPath(new URL(`../${rel}`, import.meta.url));
const REGLAS = readFileSync(raiz('firestore.rules'), 'utf8');

/**
 * El bloque de `/efemerides`, **sin comentarios** (los docblocks citan
 * cláusulas para explicarlas). Anclado al comentario de sección y no al primer
 * helper, por lo que el `auditor-trampas` señaló en `tests/propuestas.test.ts`:
 * un helper nuevo agregado antes quedaría afuera sin que nada lo dijera.
 */
const bloqueDeEfemerides = (): string => {
  const anclaje = REGLAS.indexOf('EFEMÉRIDES — B-959');
  const i = anclaje === -1 ? -1 : REGLAS.lastIndexOf('/*', anclaje);
  const finDelBanner = REGLAS.indexOf('\n', anclaje);
  const siguienteSeccion = REGLAS.indexOf('══', finDelBanner);
  const catchAll = REGLAS.indexOf('match /{document=**}');
  const j =
    siguienteSeccion !== -1 && siguienteSeccion < catchAll
      ? REGLAS.lastIndexOf('/*', siguienteSeccion)
      : catchAll;
  if (i === -1 || j === -1 || j <= i) {
    throw new Error('no se encontró el bloque de /efemerides en firestore.rules');
  }
  return sinComentarios(REGLAS.slice(i, j));
};

const form = (over: Partial<EfemerideForm> = {}): EfemerideForm => ({
  ...efemerideVacia(),
  titulo: 'Nace Julio Cortázar',
  descripcion: 'Nace en Ixelles, Bélgica, el autor de Rayuela.',
  dia: '26',
  mes: '8',
  anio: '1914',
  fuente: { texto: 'Biblioteca Nacional', url: 'bn.gov.ar' },
  ...over,
});

const valida = (over: Partial<EfemerideForm> = {}) => efemerideFormSchema.safeParse(form(over));
const rutas = (r: ReturnType<typeof valida>): string[] =>
  r.success ? [] : r.error.issues.map((i) => i.path.join('.'));

describe('los topes se dicen en dos runtimes y son el mismo número (clase de B-88)', () => {
  it('el bloque de la regla existe y tiene contenido', () => {
    const bloque = bloqueDeEfemerides();
    expect(bloque.length).toBeGreaterThan(1000);
    expect(bloque).toContain('function formaDeEfemeride()');
    expect(bloque).toContain('match /efemerides/{id}');
  });

  it('todas las cotas de tamaño de la regla salen de una constante del modelo', () => {
    const cotas = [
      ...bloqueDeEfemerides().matchAll(/([\w.]+)\.size\(\) (<=|>=) (\d+)/g),
    ].map((m) => [m[1]!, m[2]!, Number(m[3]!)]);
    expect(cotas.sort()).toEqual(
      [
        ['d.titulo', '>=', MIN_TITULO_EFEMERIDE],
        ['d.titulo', '<=', TOPE_TITULO_EFEMERIDE],
        ['d.slug', '<=', TOPE_SLUG_EFEMERIDE],
        ['d.descripcion', '<=', TOPE_DESCRIPCION_EFEMERIDE],
        ['f.texto', '<=', TOPE_FUENTE_TEXTO_EFEMERIDE],
        ['f.url', '<=', TOPE_FUENTE_URL_EFEMERIDE],
      ].sort(),
    );
  });

  it('el rango del año y los días de cada mes son los del modelo', () => {
    const bloque = bloqueDeEfemerides();
    expect(bloque).toContain(`d.anio >= ${MIN_ANIO_EFEMERIDE} && d.anio <= ${TOPE_ANIO_EFEMERIDE}`);
    expect(bloque).toContain(`[${DIAS_POR_MES.join(', ')}][d.mes - 1]`);
  });

  it('el alfabeto del slug es el mismo patrón que el schema, comparado por su fuente', () => {
    expect(bloqueDeEfemerides()).toContain(`'${RE_SLUG_EFEMERIDE}'`);
  });

  it('el link de la fuente trae esquema http(s), y eso está en la regla', () => {
    expect(bloqueDeEfemerides()).toContain("f.url.matches('^https?://.*')");
  });

  /**
   * **Los campos del documento salen de lo que el panel escribe, no de una lista
   * a mano**: `formAEfemeride` más las cuatro firmas de `lib/efemerides.ts`. Un
   * campo nuevo del modelo pone este caso en rojo hasta que la regla lo acepte.
   */
  it('el `hasOnly`/`hasAll` de la regla enumera exactamente los campos del documento', () => {
    const bloque = bloqueDeEfemerides();
    const delDocumento = [
      ...Object.keys(formAEfemeride(form(), 'borrador')),
      'createdAt',
      'updatedAt',
      'createdBy',
      'updatedBy',
    ].sort();
    const inicio = bloque.indexOf('let obligatorios = [');
    const obligatorios = bloque
      .slice(inicio, bloque.indexOf('];', inicio))
      .match(/'[a-zA-Z]+'/g)!
      .map((s) => s.replaceAll("'", ''))
      .sort();
    expect(obligatorios).toEqual(delDocumento);
    expect(obligatorios).not.toContain('publicadaAlgunaVez');
    expect(bloque).toContain("hasOnly(obligatorios.concat(['publicadaAlgunaVez']))");
  });

  it('lectura y escritura solo del admin: el publicador no aparece en el bloque (D-1171)', () => {
    const match = bloqueDeEfemerides().slice(bloqueDeEfemerides().indexOf('match /efemerides/{id}'));
    expect(match).toContain('allow get: if esAdmin();');
    expect(match).toContain('allow list: if esAdmin();');
    expect(match).toContain('allow create: if esAdmin() && efemerideValida();');
    expect(match).toContain('allow update: if esAdmin() && efemerideActualizable();');
    expect(match).toContain('allow delete: if esAdmin();');
    expect(match).not.toMatch(/esPublicador|esDelPanel|if true/);
  });
});

describe('el schema del formulario', () => {
  it('el formulario completo es válido', () => {
    expect(valida().success).toBe(true);
  });

  it('el título es obligatorio', () => {
    expect(rutas(valida({ titulo: '' }))).toContain('titulo');
  });

  it('el día tiene que existir en el mes: el 31 de abril no, el 29 de febrero sí', () => {
    expect(rutas(valida({ dia: '31', mes: '4' }))).toContain('dia');
    expect(valida({ dia: '29', mes: '2' }).success).toBe(true);
    expect(rutas(valida({ dia: '30', mes: '2' }))).toContain('dia');
  });

  it('sin mes, o con un mes que no existe, pide el mes', () => {
    expect(rutas(valida({ mes: '' }))).toContain('mes');
    expect(rutas(valida({ mes: '13' }))).toContain('mes');
  });

  it('el día y el año son enteros: ni texto, ni decimales, ni negativos', () => {
    expect(rutas(valida({ dia: 'veinte' }))).toContain('dia');
    expect(rutas(valida({ dia: '2.5' }))).toContain('dia');
    expect(rutas(valida({ anio: '-44' }))).toContain('anio');
    expect(rutas(valida({ anio: '19141' }))).toContain('anio');
  });

  it('el año es opcional', () => {
    expect(valida({ anio: '' }).success).toBe(true);
  });

  it('un link de fuente que no es web se frena antes de ir al servidor', () => {
    expect(rutas(valida({ fuente: { texto: 'x', url: 'javascript:alert(1)' } }))).toContain(
      'fuente.url',
    );
  });

  it('el slug sale del título con `slugify`, y uno tipeado gana', () => {
    expect(slugDeEfemeride({ titulo: 'Nace Julio Cortázar', slug: '' })).toBe('nace-julio-cortazar');
    expect(slugDeEfemeride({ titulo: 'x', slug: 'otro' })).toBe('otro');
    expect(rutas(valida({ slug: 'Con Mayúsculas' }))).toContain('slug');
  });

  it('esDiaDelMes es la tabla de `DIAS_POR_MES`', () => {
    expect(esDiaDelMes(31, 12)).toBe(true);
    expect(esDiaDelMes(31, 11)).toBe(false);
    expect(esDiaDelMes(0, 1)).toBe(false);
    expect(esDiaDelMes(1, 0)).toBe(false);
  });
});

describe('formulario ⇄ documento', () => {
  it('guarda día, mes y año como números, y nunca un Timestamp (trampa 1)', () => {
    const d = formAEfemeride(form(), 'borrador');
    expect(d).toMatchObject({ dia: 26, mes: 8, anio: 1914, slug: 'nace-julio-cortazar' });
    expect(Object.values(d).some((v) => v && typeof v === 'object' && 'toDate' in v)).toBe(false);
  });

  it('sin año guarda `null`, no `0`', () => {
    expect(formAEfemeride(form({ anio: '' }), 'borrador').anio).toBeNull();
  });

  it('la fuente se guarda con la URL saneada, o `null` si no hay nada', () => {
    expect(fuenteDelForm({ texto: '', url: 'bn.gov.ar' })).toEqual({
      texto: '',
      url: 'https://bn.gov.ar/',
    });
    expect(fuenteDelForm({ texto: '  ', url: '' })).toBeNull();
    expect(fuenteDelForm({ texto: 'x', url: 'javascript:alert(1)' })).toEqual({ texto: 'x', url: '' });
  });

  it('ida y vuelta: el documento vuelve al mismo formulario', () => {
    const d: Efemeride = {
      ...formAEfemeride(form({ fuente: { texto: 'BN', url: 'https://bn.gov.ar/' } }), 'publicado'),
      createdAt: ts('2026-09-25T12:00:00Z'),
      updatedAt: ts('2026-09-25T12:00:00Z'),
      createdBy: 'uid',
      updatedBy: 'uid',
    };
    const f = efemerideAFormulario(d);
    expect(f).toMatchObject({ dia: '26', mes: '8', anio: '1914', slug: 'nace-julio-cortazar' });
    expect(formAEfemeride(f, 'publicado')).toEqual(formAEfemeride(efemerideAFormulario(d), 'publicado'));
  });

  it('el slug se congela al publicar, y sigue congelado con la marca aunque se despublique', () => {
    expect(slugDeEfemerideBloqueado({ estado: 'borrador' })).toBe(false);
    expect(slugDeEfemerideBloqueado({ estado: 'publicado' })).toBe(true);
    expect(slugDeEfemerideBloqueado({ estado: 'borrador', publicadaAlgunaVez: true })).toBe(true);
  });
});

describe('el rebuild — trampa 8', () => {
  const borrador = { estado: 'borrador', slug: 'a', titulo: 'A', dia: 1, mes: 1 };
  const publicada = { ...borrador, estado: 'publicado' };

  it('un borrador que nace, se edita o se borra no cuesta un build', () => {
    expect(efemerideAmeritaRebuild(null, borrador)).toBe(false);
    expect(efemerideAmeritaRebuild(borrador, { ...borrador, titulo: 'B' })).toBe(false);
    expect(efemerideAmeritaRebuild(borrador, null)).toBe(false);
  });

  it('publicar, despublicar, editar una publicada y borrarla, sí', () => {
    expect(efemerideAmeritaRebuild(borrador, publicada)).toBe(true);
    expect(efemerideAmeritaRebuild(publicada, borrador)).toBe(true);
    expect(efemerideAmeritaRebuild(publicada, { ...publicada, dia: 2 })).toBe(true);
    expect(efemerideAmeritaRebuild(publicada, null)).toBe(true);
    expect(efemerideAmeritaRebuild(null, publicada)).toBe(true);
  });

  it('el write-back de la marca no cuesta un build (trampa 3)', () => {
    expect(efemerideAmeritaRebuild(publicada, { ...publicada, publicadaAlgunaVez: true })).toBe(
      false,
    );
  });

  it('ni cambiar quién la editó por última vez', () => {
    expect(efemerideAmeritaRebuild(publicada, { ...publicada, updatedBy: 'otro' })).toBe(false);
  });

  it('el trigger existe, está exportado y no hay sync a Calendar sobre la colección', () => {
    const index = readFileSync(raiz('functions/index.js'), 'utf8');
    expect(index).toContain("export { rebuildPorEfemerides } from './efemerides-trigger.js';");
    const trigger = readFileSync(raiz('functions/efemerides-trigger.js'), 'utf8');
    expect(trigger).toContain("document: 'efemerides/{id}'");
    // Ningún otro trigger escucha la colección: en particular, no el de Calendar.
    const calendario = readFileSync(raiz('functions/calendario-trigger.js'), 'utf8');
    expect(calendario).not.toContain('efemerides');
  });
});
