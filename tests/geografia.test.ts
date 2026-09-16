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
import { readFileSync } from 'node:fs';
import {
  ALIAS_DE_CABA,
  CIUDADES_FIJAS,
  PROVINCIAS,
  SLUG_CABA,
  conFiltroDeGeografia,
  conProvincia,
  esCaba,
  esProvincia,
  geografiaNormalizada,
  muestraEjeDeGeografia,
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

/**
 * **B-972 — que una provincia sea una provincia.**
 *
 * Hasta acá lo único que se exigía era la forma: no vacía, no muy larga, con
 * pinta de slug. `'cordoba-capital'` pasaba las tres y no denota ninguna
 * provincia, así que quedaba guardado y después no casaba con ningún filtro ni
 * con ningún hub — un dato perdido en silencio, que es peor que un error.
 *
 * Es la única de las tres piezas que se puede verificar: el barrio y la ciudad
 * son vocabulario abierto y no hay padrón contra el cual medirlos. Las
 * provincias son 24 y están enumeradas.
 */
describe('B-972 · esProvincia', () => {
  it('acepta las 24, en slug y en label', () => {
    for (const p of PROVINCIAS) {
      expect(esProvincia(p.slug), p.slug).toBe(true);
      expect(esProvincia(p.label), p.label).toBe(true);
    }
  });

  /**
   * CABA es ciudad y provincia a la vez, y quedó escrita de cuatro formas antes
   * de B-967. Si los alias no pasaran, una ficha vieja con `capital-federal`
   * dejaría de poder guardarse al editarla — que es exactamente el modo de
   * romper cosas que tiene una validación nueva sobre datos que ya existen.
   */
  it('acepta los alias de CABA, que son los que tienen las fichas viejas', () => {
    for (const alias of ALIAS_DE_CABA) expect(esProvincia(alias), alias).toBe(true);
  });

  it('rechaza lo que tiene forma de slug pero no es una provincia', () => {
    for (const no of ['cordoba-capital', 'villa-crespo', 'mar-del-plata', 'uruguay', 'bs-as']) {
      expect(esProvincia(no), no).toBe(false);
    }
  });

  /**
   * El vacío se rechaza acá y **se deja pasar en el schema de la sede**: ahí la
   * provincia es opcional hasta publicar, y el `!v ||` de `schema.ts` es lo que
   * mantiene guardable un borrador a medio cargar. Son dos preguntas distintas
   * —«¿es una provincia?» y «¿está completo?»— y confundirlas rompe el borrador.
   */
  it('el vacío no es una provincia', () => {
    for (const v of ['', null, undefined, '   ']) expect(esProvincia(v as string)).toBe(false);
  });
});

/**
 * **La lista duplicada en `firestore.rules`, atada a su fuente.**
 *
 * Las reglas son un runtime aparte que no puede importar `functions/geografia.js`
 * (D-20), así que la lista se copió. Esto es lo que hace que la copia no derive:
 * agregar una provincia al módulo sin tocar las reglas dejaría una regla que la
 * rechaza y una ficha que no se puede guardar, con todo lo demás en verde.
 */
describe('B-972 · las reglas conocen las mismas provincias que el módulo', () => {
  const reglas = readFileSync('firestore.rules', 'utf8');

  const enLasReglas = (): string[] => {
    const fn = /function esProvinciaValida\(p\) \{\s*return p in \[([\s\S]*?)\];/.exec(reglas);
    expect(fn, 'no se encontró `esProvinciaValida` en firestore.rules').not.toBeNull();
    return [...fn![1]!.matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1]!);
  };

  it('la lista de las reglas es exactamente PROVINCIAS + ALIAS_DE_CABA', () => {
    const esperado = [...new Set([...PROVINCIAS.map((p) => p.slug), ...ALIAS_DE_CABA])].sort();
    expect(enLasReglas().sort()).toEqual(esperado);
  });

  /**
   * Y que la función esté **usada**, no solo definida: una función de reglas que
   * nadie llama no da ningún error y no valida nada. Son dos usos —la librería y
   * el lugar—, que son los dos documentos con provincia propia.
   */
  it('y la usan los dos documentos con provincia', () => {
    const usos = reglas.match(/&& esProvinciaValida\(d\.provincia\)/g) ?? [];
    expect(usos).toHaveLength(2);
  });
});

/**
 * **B-970 — la regla de la cascada del lado del filtro, una sola vez.**
 *
 * La comparten tres rieles: el listado de actividades, la guía de librerías y la
 * de lugares. Estaba escrita una sola vez —dentro de `ejesVisibles`— porque
 * había un solo riel con cascada; al aparecer el segundo y el tercero, copiarla
 * era el camino recto a que funcionara en dos pantallas y en la tercera no.
 */
describe('B-970 · muestraEjeDeGeografia', () => {
  it('un eje que no es subdivisión se muestra siempre', () => {
    for (const eje of ['provincia', 'tipo', 'arancel', 'tipo-lugar']) {
      expect(muestraEjeDeGeografia(eje, [], false), eje).toBe(true);
    }
  });

  it('sin provincia elegida no se ofrece ni barrio ni ciudad', () => {
    expect(muestraEjeDeGeografia('barrio', [], false)).toBe(false);
    expect(muestraEjeDeGeografia('ciudad', [], false)).toBe(false);
  });

  it('CABA abre el barrio; cualquier otra, la ciudad', () => {
    expect(muestraEjeDeGeografia('barrio', ['caba'], false)).toBe(true);
    expect(muestraEjeDeGeografia('ciudad', ['caba'], false)).toBe(false);
    expect(muestraEjeDeGeografia('ciudad', ['santa-fe'], false)).toBe(true);
    expect(muestraEjeDeGeografia('barrio', ['santa-fe'], false)).toBe(false);
  });

  /**
   * La regla que rescata un enlace compartido (`?barrio=boedo` sin provincia).
   * Sin ella el filtro quedaría aplicado y **sin ningún control en pantalla**
   * para entender por qué ni para sacarlo — la clase de bug de D-143.
   */
  it('un eje con algo elegido se muestra aunque la cascada no lo abra', () => {
    expect(muestraEjeDeGeografia('barrio', [], true)).toBe(true);
    expect(muestraEjeDeGeografia('ciudad', ['caba'], true)).toBe(true);
  });
});

/**
 * **B-970 — al cambiar de provincia, la subdivisión de antes se suelta.**
 *
 * Es `conProvincia` del lado del filtro, y existe por la misma razón. La
 * diferencia es que acá **no se ve**: en el formulario el campo queda con un
 * valor imposible y salta a la vista; en un riel de chips el síntoma es cero
 * resultados sin motivo visible.
 */
describe('B-970 · conFiltroDeGeografia', () => {
  it('cambiar de provincia suelta el barrio que ya no aplica', () => {
    expect(conFiltroDeGeografia({ provincia: 'caba', barrio: 'boedo' }, 'provincia', 'santa-fe'))
      .toEqual({ provincia: 'santa-fe', barrio: undefined, ciudad: undefined });
  });

  /**
   * **El caso que el primer intento dejaba pasar, y es el más común de todos.**
   *
   * La versión original preguntaba `subdivisionDe(provinciaNueva)` y conservaba
   * la subdivisión de ese tipo. Entre dos provincias que no son CABA la
   * subdivisión es `ciudad` en las dos, así que ir de Buenos Aires a Santa Fe
   * conservaba Mar del Plata: una ciudad bonaerense filtrando bajo Santa Fe, cero
   * resultados, y el chip marcado como si fuera lo pedido. Lo encontró el
   * `auditor-trampas`; los dos casos que sí estaban cubiertos eran justamente los
   * que cruzan CABA, que son los menos.
   *
   * MUTACIÓN PROBADA: volver al `queda === 'ciudad' ? siguiente.ciudad : undefined`
   * deja este caso en rojo con `mar-del-plata` colgada.
   */
  it('cambiar entre dos provincias que no son CABA suelta la ciudad de la anterior', () => {
    expect(
      conFiltroDeGeografia(
        { provincia: 'buenos-aires', ciudad: 'mar-del-plata' },
        'provincia',
        'santa-fe',
      ),
    ).toEqual({ provincia: 'santa-fe', barrio: undefined, ciudad: undefined });
  });

  it('apagar la provincia también suelta la ciudad, no solo el barrio', () => {
    const r = conFiltroDeGeografia(
      { provincia: 'buenos-aires', ciudad: 'mar-del-plata' },
      'provincia',
      'buenos-aires',
    );
    expect(r.provincia).toBeUndefined();
    expect(r.ciudad).toBeUndefined();
  });

  it('y la ciudad, al entrar a CABA', () => {
    expect(
      conFiltroDeGeografia(
        { provincia: 'buenos-aires', ciudad: 'mar-del-plata' },
        'provincia',
        'caba',
      ),
    ).toEqual({ provincia: 'caba', barrio: undefined, ciudad: undefined });
  });

  it('apagar la provincia apaga las dos subdivisiones: sin primer nivel no hay segundo', () => {
    const r = conFiltroDeGeografia({ provincia: 'caba', barrio: 'boedo' }, 'provincia', 'caba');
    expect(r.provincia).toBeUndefined();
    expect(r.barrio).toBeUndefined();
  });

  /**
   * Y **solo** cuando se movió la provincia: los demás ejes del riel —qué
   * incluye, qué tipo, qué perfil— no cuelgan de la geografía. Si esto limpiara
   * siempre, elegir «bar» en la guía de lugares borraría el barrio elegido.
   */
  it('tocar otro eje no limpia nada', () => {
    expect(
      conFiltroDeGeografia({ provincia: 'caba', barrio: 'boedo' }, 'tipo-lugar', 'bar'),
    ).toEqual({ provincia: 'caba', barrio: 'boedo', 'tipo-lugar': 'bar' });
  });

  it('volver a tocar el chip elegido lo apaga', () => {
    expect(conFiltroDeGeografia({ barrio: 'boedo' }, 'barrio', 'boedo').barrio).toBeUndefined();
  });
});
