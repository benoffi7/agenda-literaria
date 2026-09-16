/**
 * **La geografía de una sede** — B-950, `src/lib/geografia.mjs`.
 *
 * El módulo es puro y contesta tres preguntas que antes no tenían dónde vivir:
 * qué provincia tiene una sede (incluida la que no lo dice), qué subdivide a esa
 * provincia, y qué renglón de lugar se muestra. Las tres las comparten cinco
 * salidas, así que lo que se fija acá es lo que evita que la regla de CABA esté
 * aplicada en cuatro y en la quinta no.
 */
import { describe, expect, it } from 'vitest';
import {
  CIUDADES_FIJAS,
  PROVINCIAS,
  SLUG_CABA,
  conProvincia,
  esCaba,
  geografiaNormalizada,
  piezasDeLugar,
  provinciaDeSede,
  subdivisionDe,
  zonaDeSede,
} from '@/lib/geografia.mjs';
import { ejesVisibles, filtrosVacios } from '@/lib/listadoPublico';
import { slugify } from '@/lib/slugify';

const sede = (over: Record<string, string> = {}) => ({
  provincia: '',
  barrio: '',
  ciudad: '',
  ...over,
});

describe('las 24 jurisdicciones', () => {
  it('son 24, con slug único y ya slugificado', () => {
    expect(PROVINCIAS).toHaveLength(24);
    expect(new Set(PROVINCIAS.map((p) => p.slug)).size).toBe(24);
    // `slugify` idempotente sobre cada una: si una entrada se escribiera con
    // acento o mayúscula, el documento y el desplegable guardarían cosas
    // distintas para la misma provincia — el bug que `ciudades.mjs` ya pagó.
    for (const p of PROVINCIAS) expect(slugify(p.slug)).toBe(p.slug);
  });

  it('CABA y Buenos Aires van primero, que es lo que se pidió', () => {
    expect(PROVINCIAS[0]!.slug).toBe(SLUG_CABA);
    expect(PROVINCIAS[1]!.slug).toBe('buenos-aires');
  });

  it('el resto va alfabético, que es lo único defendible entre iguales', () => {
    const resto = PROVINCIAS.slice(2).map((p) => p.label);
    expect(resto).toEqual([...resto].sort((a, b) => a.localeCompare(b, 'es')));
  });

  it('la única ciudad sembrada es CABA, porque no la tipea nadie', () => {
    // Las demás las crea quien carga con «Otro», igual que los barrios. Ésta va
    // sembrada porque la pone la cascada sola: sin la opción, el desplegable
    // mostraría el slug crudo.
    expect(CIUDADES_FIJAS.map((c) => c.slug)).toEqual([SLUG_CABA]);
  });
});

describe('esCaba — slugifica antes de comparar', () => {
  it.each(['caba', 'CABA', 'Caba', ' caba '])('reconoce %p', (v) => {
    expect(esCaba(v)).toBe(true);
  });

  it('y no confunde a ninguna otra', () => {
    expect(esCaba('buenos-aires')).toBe(false);
    expect(esCaba('')).toBe(false);
    expect(esCaba(null)).toBe(false);
  });

  /*
   * El control que importa: los documentos anteriores a B-950 tienen la ciudad
   * como texto libre, y `sedeVacia()` traía `'CABA'` en mayúsculas cableado. Si
   * la comparación fuera `=== 'caba'`, todo el catálogo viejo quedaría sin
   * provincia — o sea sin el primer nivel de la cascada.
   */
  it('lo viejo cuenta: `ciudad: "CABA"` es CABA', () => {
    expect(provinciaDeSede(sede({ ciudad: 'CABA' }))).toBe(SLUG_CABA);
  });
});

describe('subdivisionDe — la bifurcación de la cascada', () => {
  it('en CABA subdivide el barrio', () => {
    expect(subdivisionDe(SLUG_CABA)).toBe('barrio');
  });

  it('en cualquier otra provincia subdivide la ciudad', () => {
    expect(subdivisionDe('buenos-aires')).toBe('ciudad');
    expect(subdivisionDe('cordoba')).toBe('ciudad');
  });

  it('sin provincia elegida no hay segundo nivel, que es distinto de ofrecer el equivocado', () => {
    expect(subdivisionDe('')).toBe(null);
    expect(subdivisionDe(undefined)).toBe(null);
  });
});

describe('provinciaDeSede — el default de lectura (D-26)', () => {
  it('si el campo está, gana el campo', () => {
    expect(provinciaDeSede(sede({ provincia: 'cordoba', ciudad: 'caba' }))).toBe('cordoba');
  });

  it('sin campo y con ciudad CABA, la provincia es CABA', () => {
    expect(provinciaDeSede(sede({ ciudad: 'caba' }))).toBe(SLUG_CABA);
  });

  /*
   * **No se adivina.** Para «Mar del Plata» la provincia es deducible por una
   * persona y no por este módulo, y una tabla ciudad→provincia sería inventar el
   * dato. Queda vacía, no se muestra, y la completa el backfill o quien reedite.
   */
  it('sin campo y con otra ciudad, queda vacía en vez de inventarse', () => {
    expect(provinciaDeSede(sede({ ciudad: 'Mar del Plata' }))).toBe('');
  });

  it('sin sede, vacía', () => {
    expect(provinciaDeSede(null)).toBe('');
  });
});

describe('piezasDeLugar — la regla de CABA, en un solo lugar', () => {
  it('en CABA dice el barrio y nada más', () => {
    expect(piezasDeLugar(sede({ provincia: 'caba', barrio: 'boedo', ciudad: 'caba' }))).toEqual([
      { campo: 'barrio', slug: 'boedo' },
    ]);
  });

  it('afuera de CABA dice la ciudad y después la provincia', () => {
    expect(
      piezasDeLugar(sede({ provincia: 'buenos-aires', ciudad: 'mar-del-plata' })),
    ).toEqual([
      { campo: 'ciudad', slug: 'mar-del-plata' },
      { campo: 'provincia', slug: 'buenos-aires' },
    ]);
  });

  /*
   * El borde que obligó al `if` de más: «si es CABA, solo barrio» da por hecho
   * que el barrio está cargado. Sin él, cortar ahí devolvería una lista vacía y
   * la tarjeta diría el nombre del lugar sin decir en qué ciudad queda.
   */
  it('en CABA sin barrio se cae a la ciudad', () => {
    expect(piezasDeLugar(sede({ provincia: 'caba', ciudad: 'caba' }))).toEqual([
      { campo: 'ciudad', slug: 'caba' },
    ]);
  });

  it('un barrio cargado afuera de CABA se respeta y va primero', () => {
    // No se pide en el formulario, pero esconder un dato que alguien escribió es
    // peor que mostrarlo.
    expect(
      piezasDeLugar(sede({ provincia: 'buenos-aires', barrio: 'centro', ciudad: 'la-plata' })),
    ).toEqual([
      { campo: 'barrio', slug: 'centro' },
      { campo: 'ciudad', slug: 'la-plata' },
      { campo: 'provincia', slug: 'buenos-aires' },
    ]);
  });

  it('una sede sin nada no inventa piezas', () => {
    expect(piezasDeLugar(sede())).toEqual([]);
    expect(piezasDeLugar(null)).toEqual([]);
  });

  it('normaliza la ciudad de un documento viejo, que la guardó como se tipeó', () => {
    expect(piezasDeLugar(sede({ provincia: 'buenos-aires', ciudad: 'Mar del Plata' }))).toEqual([
      { campo: 'ciudad', slug: 'mar-del-plata' },
      { campo: 'provincia', slug: 'buenos-aires' },
    ]);
  });
});

describe('zonaDeSede — el renglón ya resuelto', () => {
  const LABELS: Record<string, Record<string, string>> = {
    barrio: { boedo: 'Boedo' },
    ciudad: { caba: 'CABA', 'mar-del-plata': 'Mar del Plata' },
    provincia: { 'buenos-aires': 'Buenos Aires' },
  };
  const resolver = (campo: string, slug: string) => LABELS[campo]?.[slug] ?? slug;

  it('en CABA, el barrio', () => {
    expect(zonaDeSede(sede({ provincia: 'caba', barrio: 'boedo', ciudad: 'caba' }), resolver)).toBe(
      'Boedo',
    );
  });

  it('afuera, la ciudad y la provincia', () => {
    expect(
      zonaDeSede(sede({ provincia: 'buenos-aires', ciudad: 'mar-del-plata' }), resolver),
    ).toBe('Mar del Plata, Buenos Aires');
  });

  it('sin nada que decir, cadena vacía y no una coma colgada', () => {
    expect(zonaDeSede(sede(), resolver)).toBe('');
  });

  it('una pieza que el resolvedor no sabe resolver no deja un hueco', () => {
    // El resolvedor de verdad cae a `desSlug`, pero uno que devuelva '' no puede
    // producir «Boedo, , Buenos Aires».
    expect(
      zonaDeSede(sede({ provincia: 'buenos-aires', ciudad: 'la-plata' }), (c, s) =>
        c === 'ciudad' ? '' : (LABELS[c]?.[s] ?? s),
      ),
    ).toBe('Buenos Aires');
  });
});

describe('conProvincia — la cascada del formulario', () => {
  it('elegir CABA completa la ciudad sola y conserva el barrio', () => {
    // La ciudad se guarda aunque el formulario no la pregunte: `ciudades[]` y las
    // tres salidas que leen `sede.ciudad` dependen de que esté.
    expect(conProvincia(sede({ barrio: 'boedo' }), 'caba')).toEqual({
      provincia: 'caba',
      barrio: 'boedo',
      ciudad: 'caba',
    });
  });

  it('salir de CABA limpia el barrio y la ciudad que era CABA', () => {
    expect(conProvincia(sede({ provincia: 'caba', barrio: 'boedo', ciudad: 'caba' }), 'cordoba')).toEqual(
      { provincia: 'cordoba', barrio: '', ciudad: '' },
    );
  });

  /*
   * Corregir la provincia de una sede de Mar del Plata no es motivo para hacerle
   * volver a tipear la ciudad: se conserva.
   */
  it('cambiar de provincia conserva una ciudad de verdad ya cargada', () => {
    expect(
      conProvincia(sede({ provincia: 'buenos-aires', ciudad: 'mar-del-plata' }), 'cordoba'),
    ).toEqual({ provincia: 'cordoba', barrio: '', ciudad: 'mar-del-plata' });
  });

  /**
   * **Lo cobró el `auditor-trampas`.** La versión anterior limpiaba el barrio en
   * toda transición hacia una provincia que no fuera CABA, incluida «de Buenos
   * Aires a Córdoba» — donde el campo Barrio ni siquiera está en pantalla. O sea
   * que corregir la provincia de una sede de Mar del Plata borraba, sin que nadie
   * lo viera, un barrio que alguien había cargado. Y contradecía a
   * `piezasDeLugar`, que respeta y muestra un barrio cargado fuera de CABA.
   *
   * MUTACIÓN PROBADA: volver a `barrio: ''` incondicional deja este caso rojo y
   * el de arriba verde.
   */
  it('cambiar entre dos provincias que no son CABA no borra un barrio legado', () => {
    expect(
      conProvincia(
        sede({ provincia: 'buenos-aires', barrio: 'centro', ciudad: 'la-plata' }),
        'cordoba',
      ),
    ).toEqual({ provincia: 'cordoba', barrio: 'centro', ciudad: 'la-plata' });
  });

  it('vaciar la provincia no rompe nada', () => {
    expect(conProvincia(sede({ provincia: 'cordoba', ciudad: 'villa-maria' }), '')).toEqual({
      provincia: '',
      barrio: '',
      ciudad: 'villa-maria',
    });
  });
});

describe('geografiaNormalizada — idempotente, que es lo que hace opcional al backfill', () => {
  it('sobre un documento ya migrado no cambia nada', () => {
    const ya = { provincia: 'buenos-aires', barrio: '', ciudad: 'mar-del-plata' };
    expect(geografiaNormalizada(ya)).toEqual(ya);
    expect(geografiaNormalizada(geografiaNormalizada(ya))).toEqual(ya);
  });

  it('sobre uno anterior a B-950 deriva la provincia y slugifica la ciudad', () => {
    expect(geografiaNormalizada({ barrio: 'boedo', ciudad: 'CABA' })).toEqual({
      provincia: 'caba',
      barrio: 'boedo',
      ciudad: 'caba',
    });
  });

  it('una sede sin geografía queda con los tres vacíos, no con undefined', () => {
    expect(geografiaNormalizada({})).toEqual({ provincia: '', barrio: '', ciudad: '' });
  });
});

describe('ejesVisibles — la cascada del riel del sitio (B-950)', () => {
  const con = (provincia: string[] = [], otros: Record<string, string[]> = {}) => ({
    ...filtrosVacios(),
    valores: { ...filtrosVacios().valores, provincia, ...otros },
  });

  it('sin provincia elegida no se ofrece ni barrio ni ciudad', () => {
    // Es el punto de la cascada: la lista larga no se muestra hasta que hay con
    // qué acortarla. Los otros cuatro ejes siguen enteros.
    const ejes = ejesVisibles(con());
    expect(ejes).not.toContain('barrio');
    expect(ejes).not.toContain('ciudad');
    expect(ejes).toEqual(['tipo', 'arancel', 'modalidad', 'provincia', 'tag']);
  });

  it('con CABA se abre el barrio, y solo el barrio', () => {
    const ejes = ejesVisibles(con(['caba']));
    expect(ejes).toContain('barrio');
    expect(ejes).not.toContain('ciudad');
  });

  it('con otra provincia se abre la ciudad, y solo la ciudad', () => {
    const ejes = ejesVisibles(con(['buenos-aires']));
    expect(ejes).toContain('ciudad');
    expect(ejes).not.toContain('barrio');
  });

  it('con las dos se abren las dos: los ejes son multivalor y OR entre sí', () => {
    // Esconder una dejaría un filtro puesto sin ningún control que lo saque.
    const ejes = ejesVisibles(con(['caba', 'buenos-aires']));
    expect(ejes).toContain('barrio');
    expect(ejes).toContain('ciudad');
  });

  /**
   * La regla que rescata un enlace compartido: `?barrio=boedo` sin `provincia`.
   * Sin esto el filtro estaría aplicado, el listado mostraría tres resultados de
   * treinta, y no habría ningún control en pantalla para entender por qué ni
   * para sacarlo — la misma clase de bug que D-143.
   */
  it('un eje con valores puestos se muestra aunque la cascada no lo abra', () => {
    expect(ejesVisibles(con([], { barrio: ['boedo'] }))).toContain('barrio');
    expect(ejesVisibles(con([], { ciudad: ['mar-del-plata'] }))).toContain('ciudad');
  });

  it('y el orden de la pantalla se conserva: provincia antes que su subdivisión', () => {
    const ejes = ejesVisibles(con(['caba']));
    expect(ejes.indexOf('provincia')).toBeLessThan(ejes.indexOf('barrio'));
  });
});
