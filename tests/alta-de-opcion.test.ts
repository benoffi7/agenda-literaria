/**
 * **El alta de una opción, sin Firestore** — B-893.
 *
 * `functions/alta-de-opcion.js` es lo que corren los dos caminos que crean una
 * etiqueta con «Otro…»: `upsertOpcion` del admin (transacción del cliente) y la
 * callable `crearOpcionDelPanel` del publicador (Admin SDK). Acá se prueba la
 * decisión entera sin emulador; la transacción de verdad contra el emulador está
 * en `tests/alta-de-opcion.integracion.test.ts`.
 *
 * La pieza que B-893 existe para tener es `cambioInesperado`: las reglas no
 * pueden verificar qué elemento del array `valores` cambió, así que la Function
 * es el único lugar donde «el publicador solo agregó una etiqueta, sin aprobar»
 * se puede afirmar. Por eso la mayor parte de este archivo son **mutaciones del
 * resultado** que la verificación tiene que rechazar.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CAMPOS_CREABLES_POR_FUNCTION,
  LARGO_MAXIMO_DE_ETIQUETA,
  ORDEN_DE_LA_CREADA,
  TOPE_DE_PENDIENTES_POR_CUENTA,
  cambioInesperado,
  decidirAlta,
  iguales,
  opcionNueva,
  rolDeLaSesion,
  validarPedidoDeOpcion,
  valoresConLaEtiqueta,
} from '../functions/alta-de-opcion.js';
import { huellaCreador } from '@/lib/huella';
import { slugify } from '@/lib/slugify';
import { rolDeClaims } from '@/lib/rolDelPanel';
import { CAMPOS_TAXONOMIA, type ValorOpcion } from '@/types/actividad';
import { sinComentarios } from '../scripts/sin-comentarios.mjs';

const fuente = (rel: string): string => readFileSync(rel, 'utf8');

const HUELLA_PUBLICADOR = huellaCreador('CENTINELAuidPublicador000000');
const HUELLA_OTRA = huellaCreador('CENTINELAuidOtraCuenta000000');

const base = (): ValorOpcion[] => [
  { slug: 'gratis', label: 'Gratis', orden: 1, fijo: true, usos: 4 },
  { slug: 'a-la-gorra', label: 'A la gorra', orden: 2, fijo: true, usos: 7 },
  {
    slug: 'beca-parcial',
    label: 'Con beca parcial',
    orden: 99,
    fijo: false,
    usos: 3,
    aprobada: true,
    huellaCreador: HUELLA_OTRA,
    tono: 210,
  },
];

/** El alta del publicador: la que nace sin aprobar. */
const altaDelPublicador = (label: string) => ({
  slug: slugify(label),
  label,
  huella: HUELLA_PUBLICADOR,
  aprobada: false,
});

describe('valoresConLaEtiqueta — la transformación compartida', () => {
  it('una etiqueta nueva agrega UN elemento al final, con la forma exacta del alta', () => {
    const antes = base();
    const { valores, creada } = valoresConLaEtiqueta(antes, altaDelPublicador('  poesía  joven '));
    expect(creada).toBe(true);
    expect(valores).toHaveLength(antes.length + 1);
    expect(valores.slice(0, -1)).toEqual(antes);
    expect(valores.at(-1)).toEqual({
      slug: 'poesia-joven',
      // `etiquetaPresentable`: primera letra arriba y espacios colapsados (B-05).
      label: 'Poesía joven',
      orden: ORDEN_DE_LA_CREADA,
      fijo: false,
      usos: 1,
      aprobada: false,
      huellaCreador: HUELLA_PUBLICADOR,
    });
  });

  it('una que ya existe suma un uso y no cambia nada más, ni el autor ni la etiqueta', () => {
    const antes = base();
    const { valores, creada } = valoresConLaEtiqueta(antes, altaDelPublicador('BECA   parcial'));
    expect(creada).toBe(false);
    expect(valores).toEqual(
      antes.map((v) => (v.slug === 'beca-parcial' ? { ...v, usos: 4 } : v)),
    );
  });

  it('B-29: reusar una pendiente de OTRA cuenta la aprueba y la marca', () => {
    const antes = [...base(), { ...opcionNueva({ ...altaDelPublicador('Slam'), huella: HUELLA_OTRA }) }];
    const { valores } = valoresConLaEtiqueta(antes, altaDelPublicador('slam'));
    expect(valores.at(-1)).toMatchObject({ aprobada: true, aprobadaPorReuso: true, usos: 2 });
    expect(valores.at(-1)?.huellaCreador).toBe(HUELLA_OTRA);
  });

  it('…y reusar una pendiente PROPIA no la aprueba: la señal es dos personas, no dos veces', () => {
    const antes = [...base(), opcionNueva(altaDelPublicador('Slam'))];
    const { valores } = valoresConLaEtiqueta(antes, altaDelPublicador('slam'));
    expect(valores.at(-1)).toMatchObject({ aprobada: false, usos: 2 });
    expect(valores.at(-1)).not.toHaveProperty('aprobadaPorReuso');
  });

  it('no toca el array que recibe', () => {
    const antes = base();
    const copia = structuredClone(antes);
    valoresConLaEtiqueta(antes, altaDelPublicador('Nueva'));
    valoresConLaEtiqueta(antes, altaDelPublicador('Gratis'));
    expect(antes).toEqual(copia);
  });
});

describe('cambioInesperado — lo único que cambia es ese elemento (B-893)', () => {
  it('CONTROL POSITIVO: acepta lo que produce la transformación, en los tres caminos', () => {
    // Sin esto, una verificación que rechazara todo pasaría cada caso de abajo.
    const antes = base();
    for (const alta of [
      altaDelPublicador('Nueva etiqueta'),
      altaDelPublicador('gratis'),
      { ...altaDelPublicador('Otra'), aprobada: true, huella: HUELLA_OTRA },
    ]) {
      expect(cambioInesperado(antes, valoresConLaEtiqueta(antes, alta).valores, alta)).toBeNull();
    }
    const conPendienteAjena = [...antes, opcionNueva({ ...altaDelPublicador('Slam'), huella: HUELLA_OTRA })];
    const reuso = altaDelPublicador('slam');
    expect(
      cambioInesperado(conPendienteAjena, valoresConLaEtiqueta(conPendienteAjena, reuso).valores, reuso),
    ).toBeNull();
  });

  /*
   * Las mutaciones del **resultado**: cada una es un array que un bug de la
   * transformación —o una escritura que no es un alta— podría producir, y la
   * verificación tiene que rechazarla con su motivo.
   *
   * MUTACIÓN PROBADA (sobre el código, 2026-09-23): sacar de `cambioInesperado`
   * el chequeo `const cambiado = antes.findIndex(...)` del camino «crear» deja en
   * rojo «borra o toca otro elemento al crear» y «aprueba otra opción de paso»;
   * sacar el `if (!iguales(a, d))` del camino «reusar» deja en rojo «toca otro
   * elemento al reusar».
   */
  const nueva = altaDelPublicador('Nueva etiqueta');
  const crear = (): ValorOpcion[] => valoresConLaEtiqueta(base(), nueva).valores as ValorOpcion[];
  const reuso = altaDelPublicador('gratis');
  const reusar = (): ValorOpcion[] => valoresConLaEtiqueta(base(), reuso).valores as ValorOpcion[];

  const casos: [string, () => ValorOpcion[], typeof nueva][] = [
    ['borra o toca otro elemento al crear', () => crear().map((v, i) => (i === 0 ? { ...v, fijo: false } : v)), nueva],
    ['aprueba otra opción de paso', () => {
      const r = crear();
      r[2] = { ...r[2]!, aprobada: false };
      return r;
    }, nueva],
    ['reescribe el array entero', () => [crear().at(-1)!], nueva],
    ['agrega dos elementos', () => [...crear(), { ...crear().at(-1)!, slug: 'otra' }], nueva],
    ['la nueva nace aprobada cuando se pidió sin aprobar', () => crear().map((v, i, a) => (i === a.length - 1 ? { ...v, aprobada: true } : v)), nueva],
    ['la nueva nace con usos: 2', () => crear().map((v, i, a) => (i === a.length - 1 ? { ...v, usos: 2 } : v)), nueva],
    ['la nueva nace fija', () => crear().map((v, i, a) => (i === a.length - 1 ? { ...v, fijo: true } : v)), nueva],
    ['la nueva trae un campo de más', () => crear().map((v, i, a) => (i === a.length - 1 ? { ...v, tono: 30 } : v)), nueva],
    ['la nueva no lleva la huella de quien la creó', () => crear().map((v, i, a) => (i === a.length - 1 ? { ...v, huellaCreador: HUELLA_OTRA } : v)), nueva],
    ['la etiqueta de la nueva no corresponde a su slug', () => crear().map((v, i, a) => (i === a.length - 1 ? { ...v, label: 'Otra cosa' } : v)), nueva],
    ['toca otro elemento al reusar', () => reusar().map((v) => (v.slug === 'a-la-gorra' ? { ...v, usos: 99 } : v)), reuso],
    ['reusar suma dos usos', () => reusar().map((v) => (v.slug === 'gratis' ? { ...v, usos: v.usos + 1 } : v)), reuso],
    ['reusar renombra la opción', () => reusar().map((v) => (v.slug === 'gratis' ? { ...v, label: 'GRATIS' } : v)), reuso],
    ['reusar le da vuelta el `fijo`', () => reusar().map((v) => (v.slug === 'gratis' ? { ...v, fijo: false } : v)), reuso],
    ['reusar la «aprueba por reuso» sin que B-29 lo permita', () => reusar().map((v) => (v.slug === 'gratis' ? { ...v, aprobada: true, aprobadaPorReuso: true } : v)), reuso],
    ['reusar agrega un elemento', () => [...reusar(), opcionNueva(altaDelPublicador('Colada'))], reuso],
  ];

  it.each(casos)('rechaza: %s', (_nombre, mutar, alta) => {
    expect(cambioInesperado(base(), mutar(), alta)).toEqual(expect.any(String));
  });

  it('el orden de las claves no importa: el Admin SDK no promete conservarlo', () => {
    const antes = base();
    const desordenado = valoresConLaEtiqueta(antes, nueva).valores.map((v) =>
      Object.fromEntries(Object.entries(v).reverse()),
    ) as unknown as ValorOpcion[];
    expect(cambioInesperado(antes, desordenado, nueva)).toBeNull();
  });

  it('`iguales` distingue lo que tiene que distinguir', () => {
    expect(iguales({ a: 1, b: [1, { c: 2 }] }, { b: [1, { c: 2 }], a: 1 })).toBe(true);
    expect(iguales({ a: 1 }, { a: 1, b: undefined })).toBe(false);
    expect(iguales([1, 2], [2, 1])).toBe(false);
    expect(iguales({ a: null }, { a: {} })).toBe(false);
    expect(iguales([], {})).toBe(false);
  });
});

describe('validarPedidoDeOpcion — lo que llega del cliente', () => {
  it('deriva el slug con el slugify compartido y no acepta uno armado', () => {
    const { pedido } = validarPedidoDeOpcion({ campo: 'tags', label: ' Poesía  Joven ', slug: 'x' });
    expect(pedido).toEqual({ campo: 'tags', label: 'Poesía  Joven', slug: 'poesia-joven' });
  });

  it.each([
    ['un campo fuera de la lista', { campo: 'provincia', label: 'Nueva' }],
    ['un campo que no es de ninguna taxonomía', { campo: '../usuarios', label: 'x' }],
    ['sin campo', { label: 'x' }],
    ['sin etiqueta', { campo: 'tags' }],
    ['una etiqueta que no es texto', { campo: 'tags', label: 42 }],
    ['una etiqueta que queda vacía', { campo: 'tags', label: ' ¡¿?! ' }],
    ['una etiqueta demasiado larga', { campo: 'tags', label: 'a'.repeat(LARGO_MAXIMO_DE_ETIQUETA + 1) }],
    ['un cuerpo que no es un objeto', 'tags'],
    ['nada', null],
  ])('rechaza %s', (_nombre, datos) => {
    const { rechazo } = validarPedidoDeOpcion(datos);
    expect(rechazo?.codigo).toBe('invalid-argument');
    expect(rechazo?.message.length).toBeGreaterThan(10);
  });

  it('el tope de largo se mide sobre la etiqueta ya recortada', () => {
    expect(validarPedidoDeOpcion({ campo: 'tags', label: `  ${'a'.repeat(LARGO_MAXIMO_DE_ETIQUETA)}  ` }).pedido).toBeTruthy();
  });
});

describe('la lista de campos de la callable (B-893)', () => {
  it('es un subconjunto del modelo', () => {
    const delModelo = new Set<string>(CAMPOS_TAXONOMIA);
    expect(CAMPOS_CREABLES_POR_FUNCTION.filter((c) => !delModelo.has(c))).toEqual([]);
  });

  it('es exactamente la de los desplegables con «Otro…» del formulario de actividad', () => {
    /*
     * Se lee del fuente de los componentes que arma el formulario de una
     * actividad —lo único que el publicador carga—: cada `<TaxonomiaSelect>` o
     * `<TagsInput>` con su `campo=`, y si trae `permitirOtro={false}`.
     *
     * En las dos direcciones: un desplegable nuevo con «Otro…» que no esté en la
     * lista le ofrecería al publicador algo que la callable rechaza (el guardado
     * avisaría, pero es un botón que siempre falla), y uno de la lista que ya no
     * ofrece «Otro…» es una puerta de escritura que ningún formulario usa.
     *
     * MUTACIÓN PROBADA: agregar `'provincia'` a `CAMPOS_CREABLES_POR_FUNCTION`
     * deja este caso en rojo; sacar `'ciudad'`, también.
     */
    const archivos = [
      'src/components/admin/ModalidadesEditor.tsx',
      ...readdirSync('src/components/admin/formulario')
        .filter((f) => f.endsWith('.tsx'))
        .map((f) => `src/components/admin/formulario/${f}`),
    ];
    const conOtro = new Set<string>();
    const sinOtro = new Set<string>();
    for (const archivo of archivos) {
      const src = sinComentarios(fuente(archivo));
      for (const m of src.matchAll(/<(?:TaxonomiaSelect|TagsInput)\b([\s\S]*?)\/>/g)) {
        const campo = /campo="([^"]+)"/.exec(m[1]!)?.[1];
        if (!campo) continue;
        (/permitirOtro=\{false\}/.test(m[1]!) ? sinOtro : conOtro).add(campo);
      }
    }
    // Control positivo: si el regex dejara de encontrar los controles, las dos
    // listas vacías harían pasar la comparación contra una lista vacía.
    expect(conOtro.size).toBeGreaterThanOrEqual(5);
    expect(sinOtro).toContain('provincia');
    expect([...conOtro].sort()).toEqual([...CAMPOS_CREABLES_POR_FUNCTION].sort());
  });
});

describe('rolDeLaSesion — el rol del token, del lado de la Function', () => {
  it('contesta lo mismo que `rolDeClaims` del panel (clase de B-88)', () => {
    /*
     * Dos derivaciones del mismo dato en dos runtimes. Si la de la Function
     * dejara ganar al admin con los dos claims, una cuenta que las reglas tratan
     * como acotada crearía etiquetas **aprobadas**.
     */
    const tabla = [
      {},
      { admin: true },
      { publicador: true },
      { admin: true, publicador: true },
      { admin: 'true' },
      { publicador: 1 },
      null,
      undefined,
    ];
    for (const claims of tabla) {
      expect(rolDeLaSesion(claims), JSON.stringify(claims)).toBe(rolDeClaims(claims));
    }
  });
});

describe('decidirAlta — la decisión de la callable', () => {
  it('sin documento no escribe nada: no inventa las base ni crea el documento a medias', () => {
    expect(decidirAlta(null, altaDelPublicador('Nueva')).rechazo?.codigo).toBe('failed-precondition');
  });

  it('una nueva sale con la transformación ya verificada', () => {
    const r = decidirAlta(base(), altaDelPublicador('Nueva'));
    expect(r.rechazo).toBeUndefined();
    expect(r.creada).toBe(true);
    expect(r.valores?.at(-1)).toMatchObject({ slug: 'nueva', aprobada: false, usos: 1 });
  });

  it('frena al que ya tiene el tope de pendientes propias en el campo', () => {
    const muchas = Array.from({ length: TOPE_DE_PENDIENTES_POR_CUENTA }, (_, i) =>
      opcionNueva(altaDelPublicador(`Pendiente ${i}`)),
    );
    const r = decidirAlta([...base(), ...muchas], altaDelPublicador('Una más'));
    expect(r.rechazo?.codigo).toBe('resource-exhausted');
  });

  it('…pero reusar no suma elementos, así que no cuenta contra el tope', () => {
    const muchas = Array.from({ length: TOPE_DE_PENDIENTES_POR_CUENTA }, (_, i) =>
      opcionNueva(altaDelPublicador(`Pendiente ${i}`)),
    );
    const r = decidirAlta([...base(), ...muchas], altaDelPublicador('Gratis'));
    expect(r.rechazo).toBeUndefined();
    expect(r.creada).toBe(false);
  });

  it('…y las pendientes de otra cuenta tampoco cuentan contra la propia', () => {
    const ajenas = Array.from({ length: TOPE_DE_PENDIENTES_POR_CUENTA }, (_, i) =>
      opcionNueva({ ...altaDelPublicador(`Ajena ${i}`), huella: HUELLA_OTRA }),
    );
    expect(decidirAlta([...base(), ...ajenas], altaDelPublicador('Mía')).rechazo).toBeUndefined();
  });

  it('un array con el slug repetido no se escribe', () => {
    // Un documento corrupto a mano en la consola. Reusar tocaría las dos copias,
    // cada una con un cambio permitido, y escribir eso sería propagar la basura;
    // el rechazo trae el motivo para el log.
    const repetido = [...base(), { ...base()[0]! }];
    const r = decidirAlta(repetido, altaDelPublicador('Gratis'));
    expect(r.rechazo?.codigo).toBe('internal');
    expect(r.rechazo?.motivo).toEqual(expect.any(String));
  });
});

describe('las piezas compartidas son una sola (D-20)', () => {
  const COMPARTIDOS = [
    'functions/alta-de-opcion.js',
    'functions/huella.js',
    'functions/etiqueta-presentable.js',
    'functions/slugify.js',
  ];

  it('no importan nada de afuera de `functions/`: el panel y el sitio los traen a su bundle', () => {
    /*
     * `taxonomia.ts` —que usa el sitio público— y `opciones.ts` —el panel— los
     * importan. Un `firebase-admin` o un `node:` en cualquiera de estos
     * terminaría en el navegador (§5.4, trampa 4).
     */
    for (const archivo of COMPARTIDOS) {
      const src = fuente(archivo);
      const imports = [...src.matchAll(/^\s*(?:import|export)\s[^;]*?from\s+['"]([^'"]+)['"]/gm)].map(
        (m) => m[1]!,
      );
      expect(
        imports.filter((i) => !/^\.\/[\w.-]+\.js$/.test(i)),
        `${archivo} importa algo de afuera de functions/`,
      ).toEqual([]);
      expect(src, `${archivo} usa import() dinámico`).not.toMatch(/\bimport\s*\(/);
    }
  });

  it('`src/` no tiene su propia copia de la huella ni de la etiqueta presentable', () => {
    // Las fachadas solo reexportan. Una copia del FNV-1a en `src/` haría que la
    // etiqueta que crea la Function no le apareciera a quien la creó.
    expect(sinComentarios(fuente('src/lib/huella.ts')).trim()).toBe(
      "export { huellaCreador } from '../../functions/huella.js';",
    );
    expect(sinComentarios(fuente('src/lib/etiqueta-presentable.mjs')).trim()).toBe(
      "export { etiquetaPresentable } from '../../functions/etiqueta-presentable.js';",
    );
  });
});
