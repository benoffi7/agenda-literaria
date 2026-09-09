import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  TOPE_SUGERENCIAS,
  etiquetaConEstado,
  etiquetaPresentable,
  pistaDeOpcion,
  resolverEtiqueta,
  sugerenciasPara,
} from '@/lib/taxonomia';
import { CAMPOS_MULTIVALOR, CAMPOS_TAXONOMIA } from '@/types/actividad';
import type { ValorOpcion } from '@/types/actividad';

/**
 * §4.2 — la mitad de la deduplicación que corre en el cliente: el
 * autocompletado contra lo que ya existe y la resolución por slug antes de
 * escribir. Es "la que evita que el 90 % de los duplicados nazca" y hasta B-72
 * estaba escrita dos veces, en dos `.tsx`, sin un solo test.
 */

const v = (slug: string, label: string, extra: Partial<ValorOpcion> = {}): ValorOpcion => ({
  slug,
  label,
  orden: 99,
  fijo: false,
  usos: 0,
  ...extra,
});

const ARANCEL: ValorOpcion[] = [
  v('gratis', 'Gratis', { fijo: true, orden: 1 }),
  v('a-la-gorra', 'A la gorra', { fijo: true, orden: 2 }),
  v('arancelado', 'Arancelado', { fijo: true, orden: 3 }),
  v('con-beca-parcial', 'Con beca parcial', { usos: 3 }),
];

describe('resolverEtiqueta — §4.2', () => {
  it('las cuatro variantes del §4.2 caen en la misma opción, sin duplicar', () => {
    for (const texto of ['A la gorra', 'a la gorra ', 'A la Gorra', '  A LA GORRA  ']) {
      const r = resolverEtiqueta(texto, ARANCEL);
      expect(r.slug).toBe('a-la-gorra');
      expect(r.coincidencia?.label).toBe('A la gorra');
      // Reusa: no hay etiqueta nueva que persistir.
      expect(r.labelNuevo).toBeUndefined();
    }
  });

  it('los acentos no crean una opción aparte', () => {
    const valores = [...ARANCEL, v('poesia', 'Poesía')];
    expect(resolverEtiqueta('poesía', valores).coincidencia?.slug).toBe('poesia');
    expect(resolverEtiqueta('POESIA', valores).coincidencia?.slug).toBe('poesia');
  });

  it('una etiqueta que no existe vuelve con su slug y su label a persistir', () => {
    const r = resolverEtiqueta('  con  media beca ', ARANCEL);
    expect(r.slug).toBe('con-media-beca');
    expect(r.coincidencia).toBeUndefined();
    expect(r.labelNuevo).toBe('Con media beca');
  });

  /**
   * §4.3 — se resuelve contra la lista completa, no contra lo elegible: si la
   * etiqueta ya existe como opción pendiente de otra persona hay que reusar su
   * slug igual. Crear un segundo slug para lo mismo es exactamente lo que el
   * §4.2 evita.
   */
  it('reusa el slug de una opción pendiente de otra cuenta', () => {
    const valores = [...ARANCEL, v('trueque', 'Trueque', { aprobada: false, huellaCreador: 'aaaa' })];
    const r = resolverEtiqueta('trueque', valores);
    expect(r.coincidencia?.slug).toBe('trueque');
    expect(r.labelNuevo).toBeUndefined();
  });

  it('un texto que se normaliza a vacío no propone nada que guardar', () => {
    for (const texto of ['', '   ', '¡!¿?', '---']) {
      expect(resolverEtiqueta(texto, ARANCEL)).toEqual({ slug: '' });
    }
  });
});

describe('sugerenciasPara — §4.2', () => {
  it('"gor" encuentra "A la gorra" — el caso del CLAUDE.md', () => {
    expect(sugerenciasPara('gor', ARANCEL).map((o) => o.slug)).toEqual(['a-la-gorra']);
  });

  it('busca sin acentos y sin mayúsculas, a mitad de la palabra', () => {
    const valores = [v('poesia', 'Poesía'), v('cronica', 'Crónica')];
    expect(sugerenciasPara('POESI', valores).map((o) => o.slug)).toEqual(['poesia']);
    expect(sugerenciasPara('ónic', valores).map((o) => o.slug)).toEqual(['cronica']);
  });

  it('con el texto vacío no sugiere nada, salvo que se lo pidan', () => {
    // El input de chips: siempre visible, una lista desplegada taparía el form.
    expect(sugerenciasPara('', ARANCEL)).toEqual([]);
    // El desplegable en modo "Otro": entrar es deliberado y ver qué hay orienta.
    expect(sugerenciasPara('', ARANCEL, { mostrarConTextoVacio: true })).toHaveLength(4);
  });

  it('respeta el tope', () => {
    const muchas = Array.from({ length: 20 }, (_, i) => v(`t-${i}`, `Tema ${i}`));
    expect(sugerenciasPara('tema', muchas)).toHaveLength(TOPE_SUGERENCIAS);
    expect(sugerenciasPara('tema', muchas, { tope: 3 })).toHaveLength(3);
    expect(
      sugerenciasPara('', muchas, { mostrarConTextoVacio: true, tope: 2 }),
    ).toHaveLength(2);
  });

  it('no vuelve a ofrecer lo que ya está elegido (caso tags)', () => {
    const slugs = sugerenciasPara('a', ARANCEL, { excluir: ['a-la-gorra'] }).map((o) => o.slug);
    expect(slugs).not.toContain('a-la-gorra');
    expect(slugs).toContain('arancelado');
  });

  it('no muta ni reordena la lista que recibe', () => {
    const original = [...ARANCEL];
    sugerenciasPara('a', ARANCEL, { excluir: ['gratis'] });
    expect(ARANCEL).toEqual(original);
  });
});

/**
 * B-05 — el slug es la identidad, esto es lo que se ve: en el desplegable, en
 * la descripción del evento de Calendar (D-11) y en los chips de filtro del
 * sitio (§4.4).
 */
describe('etiquetaPresentable — B-05', () => {
  it('un tag tipeado en minúscula se guarda presentable', () => {
    expect(etiquetaPresentable('narrativa')).toBe('Narrativa');
  });

  it('no baja el resto: no rompe nombres propios ni siglas', () => {
    expect(etiquetaPresentable('Villa Crespo')).toBe('Villa Crespo');
    expect(etiquetaPresentable('Google Meet')).toBe('Google Meet');
    expect(etiquetaPresentable('taller de LIJ')).toBe('Taller de LIJ');
  });

  it('no sube cada palabra: "Club de lectura" no es "Club De Lectura"', () => {
    expect(etiquetaPresentable('club de lectura')).toBe('Club de lectura');
  });

  it('colapsa los espacios, que el slug ya ignoraba', () => {
    // "A  la   gorra" y "A la gorra" comparten slug: tienen que compartir label.
    expect(etiquetaPresentable('  a  la   gorra  ')).toBe('A la gorra');
  });

  it('respeta los acentos y la ñ', () => {
    expect(etiquetaPresentable('ñandú')).toBe('Ñandú');
    expect(etiquetaPresentable('épica')).toBe('Épica');
  });

  it('un texto vacío queda vacío, no explota', () => {
    expect(etiquetaPresentable('   ')).toBe('');
  });
});

describe('pistaDeOpcion y etiquetaConEstado — §4.3', () => {
  it('"sin aprobar" gana sobre el uso: es lo accionable', () => {
    expect(pistaDeOpcion(v('x', 'X', { usos: 9, aprobada: false }))).toBe('sin aprobar');
    expect(etiquetaConEstado(v('x', 'X', { aprobada: false }))).toBe('X (sin aprobar)');
  });

  it('una opción aprobada muestra su uso, y sin usos no muestra nada', () => {
    expect(pistaDeOpcion(v('x', 'X', { usos: 4 }))).toBe('4 usos');
    expect(pistaDeOpcion(v('x', 'X', { usos: 0 }))).toBe('');
    expect(etiquetaConEstado(v('x', 'X', { usos: 4 }))).toBe('X');
  });

  it('una opción base nunca se marca como pendiente', () => {
    const base = v('gratis', 'Gratis', { fijo: true, aprobada: false });
    expect(pistaDeOpcion(base)).toBe('');
    expect(etiquetaConEstado(base)).toBe('Gratis');
  });
});

/**
 * B-72 — la guardia de que la unificación no se deshaga. El §4.2 está marcado
 * **crítico** en el `CLAUDE.md` y la copia volvió a nacer una vez: alcanza con
 * que alguien "arregle" el filtro en un componente y no en el otro. No hay
 * testing-library en el repo (B-08), así que la guardia mira el fuente.
 */
describe('los dos widgets de taxonomía comparten la lógica del §4.2 — B-72', () => {
  const widgets = ['TaxonomiaSelect', 'TagsInput'] as const;
  const fuente = (nombre: string) =>
    readFileSync(`src/components/campos/${nombre}.tsx`, 'utf8');

  it.each(widgets)('%s resuelve el texto tipeado con resolverEtiqueta', (nombre) => {
    expect(fuente(nombre)).toContain('resolverEtiqueta(');
  });

  it.each(widgets)('%s filtra las sugerencias con sugerenciasPara', (nombre) => {
    expect(fuente(nombre)).toContain('sugerenciasPara(');
  });

  it.each(widgets)('%s no vuelve a slugificar ni a filtrar por su cuenta', (nombre) => {
    const src = fuente(nombre);
    expect(src).not.toContain("from '@/lib/slugify'");
    expect(src).not.toContain("from '@/lib/normalize'");
  });

  /**
   * B-827 — el `id` que el `Campo` le pasa tiene que llegar al control **en
   * todas las ramas**.
   *
   * `TaxonomiaSelect` pinta dos widgets excluyentes: el `<select>` y, en modo
   * «Otro», un input con `autoFocus`. El id estaba solo en el primero, así que
   * entrar en «Otro» dejaba el campo sin nombre accesible justo cuando alguien
   * está tipeando en él. El barrido de `clases-de-bug.test.ts` no puede verlo:
   * mira los usos de `<Campo>`, y esto es adentro del control.
   */
  it.each(widgets)('%s le pone el id que recibe a su input', (nombre) => {
    expect(fuente(nombre), 'el id no llega al control').toContain('id={id}');
  });

  it('TaxonomiaSelect le pone el id a sus dos ramas, no solo al `<select>`', () => {
    const usos = fuente('TaxonomiaSelect').match(/\bid=\{id\}/g) ?? [];
    expect(usos.length, 'una rama quedó sin el id y su label queda huérfano').toBe(2);
  });

  /**
   * B-73 — el campo con más volumen esperado era el único invisible en GA4.
   *
   * ⚠️ **Este caso se degradó con B-841 y hay que leerlo sabiéndolo.** Cuando se
   * escribió, el control llamaba a `medirFuncion(...)` directo y encontrar el
   * literal probaba que se medía. Hoy la medición **se recibe por prop**
   * (`onMedir`), así que estos tres literales son argumentos de una llamada que
   * puede no tener a quién llamar: lo que este caso prueba es que **el vocabulario
   * sigue siendo el mismo en los dos widgets**, que es lo de B-72, y **no** que se
   * mida.
   *
   * Que se mida de verdad lo prueba `tests/campos-del-panel.render.test.tsx`,
   * montando la capa del panel y afirmando la llamada — y también la otra
   * dirección: que el control genérico **no** mida sin la prop, que es lo que hace
   * que un formulario público pueda usarlo.
   */
  it('los dos widgets nombran los mismos eventos de taxonomía (B-73, vocabulario)', () => {
    for (const nombre of widgets) {
      const src = fuente(nombre);
      for (const evento of ['taxonomia-nueva', 'taxonomia-reusada', 'taxonomia-sugerencia']) {
        expect(src, `${nombre} · ${evento}`).toContain(evento);
      }
    }
  });
});

/**
 * **Toda taxonomía tiene un buffer de etiquetas nuevas** — B-830.
 *
 * El §4 dice que las opciones creadas con «Otro» se persisten en el submit
 * (D-02), y el mecanismo que las recuerda hasta entonces está partido en dos por
 * la forma del campo: `CampoLabelUnico` (`recordarLabel`, una etiqueta por
 * campo) y `CAMPOS_MULTIVALOR` (`MultivalorNuevos`, un mapa `slug → label` por
 * campo).
 *
 * **La taxonomía que no esté en ninguna de las dos listas se queda sin buffer**,
 * y el modo de falla es silencioso y de los peores: el «Otro» funciona en
 * pantalla —el chip aparece, el formulario guarda el slug— y la opción **nunca
 * se da de alta en `/opciones/*`**, así que la actividad queda con un slug que
 * ningún desplegable ofrece y que el sitio muestra des-slugueado. Nada falla.
 *
 * Este caso lo impide desde los dos lados: que las dos listas **cubran**
 * `CAMPOS_TAXONOMIA` y que **no se pisen** — un campo en las dos tendría dos
 * buffers y el segundo pisaría al primero en `labelsPendientesDe`.
 *
 * `CampoLabelUnico` es un tipo y no una constante, así que se lee del fuente: es
 * el único modo de compararlo con la lista de multivalor. Si el tipo se convierte
 * en un `as const`, este caso se simplifica solo.
 */
describe('las dos familias de taxonomía cubren todas, y no se pisan — B-830', () => {
  const camposDeValorUnico = (): string[] => {
    const src = readFileSync('src/lib/formulario/etiquetas.ts', 'utf8');
    const m = /export type CampoLabelUnico =([^;]+);/.exec(src);
    if (!m) throw new Error('no se encontró `CampoLabelUnico` en etiquetas.ts');
    return [...m[1]!.matchAll(/'([^']+)'/g)].map((x) => x[1]!);
  };

  it('el lector del tipo encuentra los campos de valor único', () => {
    // Control positivo: una regex que deje de matchear daría una lista vacía y
    // los dos casos de abajo pasarían por vacuidad.
    const unicos = camposDeValorUnico();
    expect(unicos.length).toBeGreaterThan(2);
    expect(unicos).toContain('arancel');
  });

  it('entre las dos listas están todas las taxonomías', () => {
    const cubiertas = new Set<string>([...camposDeValorUnico(), ...CAMPOS_MULTIVALOR]);
    const huerfanas = CAMPOS_TAXONOMIA.filter((c) => !cubiertas.has(c));
    expect(
      huerfanas,
      'estas taxonomías no tienen buffer de etiquetas nuevas: el «Otro» va a funcionar ' +
        'en pantalla y la opción nunca se va a dar de alta en /opciones/*. Agregalas a ' +
        '`CampoLabelUnico` (valor único) o a `CAMPOS_MULTIVALOR` (array de slugs).',
    ).toEqual([]);
  });

  it('y ninguna está en las dos', () => {
    const unicos = new Set<string>(camposDeValorUnico());
    const enLasDos = CAMPOS_MULTIVALOR.filter((c) => unicos.has(c));
    expect(
      enLasDos,
      'una taxonomía en las dos familias tiene dos buffers, y el multivalor pisa al ' +
        'de valor único en `labelsPendientesDe`',
    ).toEqual([]);
  });
});
