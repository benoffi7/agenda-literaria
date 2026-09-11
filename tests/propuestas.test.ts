/**
 * La propuesta, del lado puro — B-830.
 *
 * Acá vive lo que se puede probar sin emuladores: el schema de zod, el armado
 * del documento, y **las ataduras con `firestore.rules`**, que son las que
 * importan más.
 *
 * ── Por qué las ataduras son el corazón de este archivo ───────────────────
 * Del otro lado del formulario público hay un anónimo, así que el schema de zod
 * **no es la defensa**: se saltea con un `curl`. La defensa es la regla. Los dos
 * dicen los mismos números, y un documento que pase por el schema y no por la
 * regla **no se guarda** — con el formulario diciendo que sí. Es la clase de B-88
 * en el peor lugar posible.
 *
 * `firestore.rules` es un runtime aparte y no puede importar TypeScript, así que
 * el único modo de atarlo es un test que lea el archivo y compare. Es el patrón
 * de `TOPE_TITULO_REPORTE` (B-364), acá aplicado a **diez** números y cuatro
 * vocabularios.
 *
 * **Y hay una cosa que los dos lados NO comparten**, que también se afirma acá:
 * la forma de cada fecha. Una regla no itera una lista, así que eso vive solo en
 * el schema — ver el caso que lo dice, y por qué es aceptable.
 *
 * Las reglas contra el emulador —qué rechaza cada cláusula, verificado por
 * mutación— están en `tests/propuestas.integracion.test.ts`.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { sinComentarios } from '../scripts/sin-comentarios.mjs';
import { RE_DIA, RE_HORA, diaReal, formAPropuesta, propuestaFormSchema, propuestaVacia } from '@/lib/propuesta-schema';
import { propuestaAFormulario } from '@/lib/propuestas';
import {
  ARANCELES_PROPUESTA,
  ESTADOS_PROPUESTA,
  MAX_FECHAS_PROPUESTA,
  MAX_INCLUYE_PROPUESTA,
  MIN_CONTACTO_PROPUESTA,
  MIN_DESCRIPCION_PROPUESTA,
  MIN_FECHAS_PROPUESTA,
  MIN_NO_VACIO_PROPUESTA,
  MIN_ORGANIZADOR_PROPUESTA,
  MIN_TITULO_PROPUESTA,
  MODALIDADES_PROPUESTA,
  TOPE_ACTIVIDAD_ID_PROPUESTA,
  TOPE_CONTACTO_PROPUESTA,
  TOPE_CORTO_PROPUESTA,
  TOPE_DESCRIPCION_PROPUESTA,
  TOPE_INCLUYE_OTRO_PROPUESTA,
  TOPE_INSCRIPCION_PROPUESTA,
  TOPE_MOTIVO_PROPUESTA,
  TOPE_TITULO_PROPUESTA,
  TOPE_URL_PROPUESTA,
  VIAS_CONTACTO_PROPUESTA,
} from '@/types/propuesta';
import type { Propuesta, PropuestaForm } from '@/types/propuesta';
import { ts } from './fixtures/tiempo';

const REGLAS = readFileSync(
  fileURLToPath(new URL('../firestore.rules', import.meta.url)),
  'utf8',
);

/**
 * El bloque de `/propuestas` entero: sus helpers, `propuestaValida()`,
 * `revisionValida()` y el `match`.
 *
 * **El ancla es el comentario de sección y no el nombre del primer helper**, y lo
 * señaló el `auditor-trampas`: con `indexOf('function fechasValidas(')`, un
 * helper nuevo agregado **antes** de ése —agrupar por tema, ordenar
 * alfabéticamente— quedaba afuera del recorte y de todo lo que este archivo
 * verifica, sin que nada lo dijera. Era el punto ciego del patrón B-364
 * reintroducido a nivel de sub-bloque.
 *
 * **El bloque se lee SIN comentarios**, porque los docblocks de la regla citan
 * cláusulas para explicarlas —«`valor.size() >= 3` también»— y un barrido que
 * los lea se agarra a sí mismo: la primera versión de la comparación de cotas
 * contaba una de más que estaba escrita en un comentario. Es la misma lección
 * que `appcheck.test.ts` y `guardas-de-los-scripts.test.ts`.
 */
const bloqueDePropuestas = (): string => {
  const anclaje = REGLAS.indexOf('PROPUESTAS DE ORGANIZADORES');
  // El `/*` que abre el comentario de sección, **no** el texto del comentario:
  // recortar desde el medio de un bloque `/* … */` deja a `sinComentarios` sin
  // la apertura y se come el código que sigue. Costó un rojo confuso.
  const i = anclaje === -1 ? -1 : REGLAS.lastIndexOf('/*', anclaje);
  /*
   * **El final es la sección SIGUIENTE, no el catch-all** — B-831.
   *
   * Mientras `/propuestas` fue el último bloque del archivo, cortar en
   * `match /{document=**}` daba lo mismo. Desde que `/librerias` se agregó
   * debajo, ese corte se llevaba puesto el bloque de **otra** colección: la
   * comparación exhaustiva de cotas de acá abajo pasó a ver veinte números que no
   * son de esta regla, y el barrido de `matches` a ver patrones ajenos. Se puso
   * en rojo, que es lo correcto — y el arreglo es anclar en el borde y no en el
   * fondo, porque cada directorio que venga agrega otro bloque.
   */
  const finDelBanner = REGLAS.indexOf('\n', anclaje);
  const siguienteSeccion = REGLAS.indexOf('══', finDelBanner);
  const catchAll = REGLAS.indexOf('match /{document=**}');
  const j =
    siguienteSeccion !== -1 && siguienteSeccion < catchAll
      ? REGLAS.lastIndexOf('/*', siguienteSeccion)
      : catchAll;
  if (i === -1 || j === -1 || j <= i) {
    throw new Error('no se encontró el bloque de /propuestas en firestore.rules');
  }
  return sinComentarios(REGLAS.slice(i, j));
};

/**
 * Todas las cotas de tamaño del bloque, sacadas del archivo: `[campo, op, n]`.
 *
 * Es la mitad que le faltaba al atado. La primera versión comparaba una **lista
 * a mano** de ocho cotas contra un archivo que tiene **veinticuatro**, así que
 * `TOPE_CORTO_PROPUESTA` estaba atado en `organizador.nombre` y suelto en las
 * otras cuatro ocurrencias: subirlo de un lado y actualizar solo la línea que el
 * test mira dejaba el test verde, el schema aceptando 300 y Firestore
 * rechazando la escritura — el formulario diciendo que sí. Lo encontró el
 * `auditor-trampas`.
 */
const cotasDeLaRegla = (): [campo: string, op: string, n: number][] =>
  [...bloqueDePropuestas().matchAll(/([\w.'()[\], ]+)\.size\(\) (<=|>=) (\d+)/g)].map((m) => [
    m[1]!.trim(),
    m[2]!,
    Number(m[3]!),
  ]);

const form = (over: Partial<PropuestaForm> = {}): PropuestaForm => ({
  ...propuestaVacia(),
  titulo: 'Taller de crónica urbana',
  descripcion: 'Cuatro encuentros para escribir crónica, con lecturas y consignas.',
  fechas: [{ dia: '2026-10-07', desde: '19:00', hasta: '21:00' }],
  lugar: { nombre: 'Casa Brandon', direccion: 'Luis María Drago 236', barrio: 'villa-crespo' },
  organizador: { nombre: 'Casa Brandon', instagram: '@casabrandon' },
  contacto: { via: 'mail', valor: 'hola@casabrandon.test' },
  ...over,
});

const valida = (over: Partial<PropuestaForm> = {}) => propuestaFormSchema.safeParse(form(over));
const rutas = (r: ReturnType<typeof valida>): string[] =>
  r.success ? [] : r.error.issues.map((i) => i.path.join('.'));

describe('los topes se dicen en dos runtimes y son el mismo número (B-364, clase de B-88)', () => {
  it('el bloque de la regla existe y tiene contenido', () => {
    // Control positivo: si el recorte fallara, los casos de abajo compararían
    // contra una cadena vacía y `toContain` sería falso para todo — o peor,
    // pasarían si alguien los escribiera al revés.
    const bloque = bloqueDePropuestas();
    expect(bloque.length).toBeGreaterThan(1000);
    expect(bloque).toContain('function propuestaValida()');
  });

  /**
   * **La comparación es exhaustiva, no una muestra.** Cada cota de la regla está
   * acá con la constante del modelo que le corresponde, y el aserto compara las
   * **dos listas completas**: una cota nueva en `firestore.rules` que nadie
   * agregue acá pone esto en rojo, y una que cambie de número también.
   *
   * Es lo que la primera versión no hacía: comparaba ocho de veinticuatro con un
   * `it.each`, así que las otras dieciséis estaban sueltas.
   */
  it('todas las cotas de la regla son las constantes del modelo, y no falta ninguna', () => {
    const esperadas: [string, string, number][] = [
      // Las listas.
      ['fechas', '>=', MIN_FECHAS_PROPUESTA],
      ['fechas', '<=', MAX_FECHAS_PROPUESTA],
      ['d.incluye', '<=', MAX_INCLUYE_PROPUESTA],
      // El lugar, que es donde `TOPE_CORTO_PROPUESTA` se repite.
      ["lugar.get('nombre', '')", '<=', TOPE_CORTO_PROPUESTA],
      ["lugar.get('direccion', '')", '<=', TOPE_CORTO_PROPUESTA],
      ["lugar.get('barrio', '')", '<=', TOPE_CORTO_PROPUESTA],
      // La imagen, con sus dos formas (DEC-11) y el «no vacío» de cada una.
      ["imagen.get('url', '')", '>=', MIN_NO_VACIO_PROPUESTA],
      ["imagen.get('url', '')", '<=', TOPE_URL_PROPUESTA],
      ["imagen.get('storagePath', '')", '>=', MIN_NO_VACIO_PROPUESTA],
      ["imagen.get('storagePath', '')", '<=', TOPE_URL_PROPUESTA],
      // El contenido.
      ['d.titulo', '>=', MIN_TITULO_PROPUESTA],
      ['d.titulo', '<=', TOPE_TITULO_PROPUESTA],
      ['d.descripcion', '>=', MIN_DESCRIPCION_PROPUESTA],
      ['d.descripcion', '<=', TOPE_DESCRIPCION_PROPUESTA],
      ["d.organizador.get('nombre', '')", '>=', MIN_ORGANIZADOR_PROPUESTA],
      ["d.organizador.get('nombre', '')", '<=', TOPE_CORTO_PROPUESTA],
      ["d.organizador.get('instagram', '')", '<=', TOPE_CORTO_PROPUESTA],
      ["d.arancel.get('notas', '')", '<=', TOPE_CORTO_PROPUESTA],
      ["d.inscripcion.get('comoDice', '')", '<=', TOPE_INSCRIPCION_PROPUESTA],
      ['d.incluyeOtro', '<=', TOPE_INCLUYE_OTRO_PROPUESTA],
      // El contacto de quien propone, que es interno.
      ["d.contacto.get('valor', '')", '>=', MIN_CONTACTO_PROPUESTA],
      ["d.contacto.get('valor', '')", '<=', TOPE_CONTACTO_PROPUESTA],
      // La revisión, que solo escribe un admin.
      ["d.revision.get('actividadId', '')", '<=', TOPE_ACTIVIDAD_ID_PROPUESTA],
      ["d.revision.get('motivo', '')", '<=', TOPE_MOTIVO_PROPUESTA],
    ];
    const clave = (c: [string, string, number]) => `${c[0]} ${c[1]} ${c[2]}`;
    expect(cotasDeLaRegla().map(clave).sort()).toEqual(esperadas.map(clave).sort());
  });

  it('los máximos de las dos listas también', () => {
    expect(bloqueDePropuestas()).toContain(`fechas.size() <= ${MAX_FECHAS_PROPUESTA}`);
    expect(bloqueDePropuestas()).toContain(`d.incluye.size() <= ${MAX_INCLUYE_PROPUESTA}`);
  });

  it('y los cuatro vocabularios', () => {
    const bloque = bloqueDePropuestas();
    const comoLista = (xs: readonly string[]) => `[${xs.map((x) => `'${x}'`).join(', ')}]`;
    expect(bloque, 'las modalidades').toContain(comoLista(MODALIDADES_PROPUESTA));
    expect(bloque, 'los aranceles').toContain(comoLista(ARANCELES_PROPUESTA));
    expect(bloque, 'las vías de contacto').toContain(comoLista(VIAS_CONTACTO_PROPUESTA));
    expect(bloque, 'los estados').toContain(comoLista(ESTADOS_PROPUESTA));
  });

  /**
   * **La asimetría que hay que conocer: la forma de cada fecha la valida el
   * schema y NO la regla.**
   *
   * Una regla de Firestore **no itera una lista**, así que de `fechas` se puede
   * acotar la cantidad (1–12) y el tipo, y no la forma de cada fila. O sea que un
   * `curl` puede mandar doce mapas arbitrarios ahí adentro, con strings tan
   * largos como el tope de 1 MB del documento permita.
   *
   * **Qué lo hace aceptable, y conviene tenerlo escrito y no supuesto:** nada de
   * una propuesta llega a una salida pública sin que un admin la convierta en
   * actividad — y para `incluye`, que la conversión **filtre contra la
   * taxonomía**, que es el caso de acá abajo.
   *
   * Lo que **no** lo hace aceptable es `actividadFormSchema`, que es lo que la
   * primera versión de este párrafo decía: para `incluye` ese schema es
   * `z.array(texto)` —texto libre, sin lista blanca—, así que un slug inventado
   * seguía viaje hasta `toPublic`, `detallePublico` lo resolvía con `etiquetaDe`
   * y `listadoPublico` caía a `desSlug(valor)`: se publicaba verbatim, apenas
   * des-slugueado, en la página de detalle. Lo cobró el `auditor-privacidad`
   * sobre B-830.
   *
   * El daño que queda es «el admin ve una fila rara en la bandeja» y una
   * escritura facturada de hasta 1 MB. Si aparece abuso, la defensa que falta es
   * del lado de una Function y no de la regla — anotado en el backlog (B-842).
   *
   * Este caso afirma la asimetría en vez de fingir que no está. La primera
   * versión afirmaba que la regla repetía las dos expresiones: era **falso** y se
   * leía como una garantía.
   */
  it('la forma de cada fecha vive SOLO en el schema, y la regla no la puede validar', () => {
    const bloque = bloqueDePropuestas();
    // Las expresiones existen y son las que el schema usa.
    expect(new RegExp(RE_DIA).test('2026-10-07')).toBe(true);
    expect(new RegExp(RE_HORA).test('19:00')).toBe(true);
    // Lo que la regla sí acota de `fechas` es la cantidad y el tipo.
    expect(bloque).toContain('fechas is list');
    expect(bloque).toContain('fechas.size() >= 1');
    /*
     * **Y no la forma de cada fila.** La primera versión pedía que la regla no
     * tuviera **ningún** `matches`, y eso caducó: el `auditor-privacidad` hizo
     * falta uno para acotar `storagePath` al prefijo `propuestas/` —que es un
     * **escalar**, y por eso ahí sí se puede—. Lo que se afirma ahora es más
     * preciso y sigue poniéndose rojo por el motivo correcto: hay `matches`
     * **solo** sobre la imagen, y ninguno sobre las tres claves de una fecha. El
     * día que aparezca uno ahí, alguien encontró cómo y hay que actualizar B-842.
     */
    const conMatches = [...bloque.matchAll(/(\w+)[^\n;&]*\.matches\(/g)].map((m) => m[1]!);
    expect([...new Set(conMatches)].sort()).toEqual(['imagen']);
    for (const clave of ['dia', 'desde', 'hasta']) {
      expect(bloque, `la regla empezó a validar \`${clave}\``).not.toContain(`${clave}.matches`);
    }
  });
});

describe('lo que la regla no puede mirar de `incluye`, lo filtra la conversión (B-842)', () => {
  /**
   * **La compensación de la asimetría de arriba, verificada donde se la afirma.**
   *
   * El párrafo de ahí dice que la forma de cada elemento de una lista vive solo
   * en el schema y que igual es aceptable. Para `incluye` eso es cierto **solo
   * mientras la conversión filtre**: es el único paso entre un `curl` anónimo y
   * `toPublic`. Si alguien borra el filtro de `incluyeDePropuesta`, la
   * justificación escrita arriba deja de ser cierta y este caso se pone rojo —
   * que es el punto de tenerlo acá y no solo en `propuestas-conversion.test.ts`,
   * donde los casos prueban la traducción de vocabulario y no esta atadura.
   *
   * La carga es la que la regla **no** puede rechazar: `d.incluye.size() <= 12`
   * acota cuántos y no el largo ni la forma de cada uno.
   */
  const TAXONOMIA = (
    JSON.parse(
      readFileSync(fileURLToPath(new URL('../src/lib/opciones-base.json', import.meta.url)), 'utf8'),
    ) as Record<
      string,
      { slug: string }[]
    >
  )['incluye-actividad']!.map((v) => v.slug);

  const propuestaCon = (incluye: string[]): Propuesta => ({
    ...formAPropuesta(form({ incluye })),
    creadoEn: ts('2026-09-09T12:00:00Z'),
  });

  it('la conversión descarta los `incluye` que no están en la taxonomía', () => {
    // Dos formas de lo que la regla deja pasar: el slug inventado que **parece**
    // taxonomía —que es por qué «el admin lo va a ver» es más débil acá que en
    // `titulo`, un chip no se lee como se lee un párrafo— y el que ningún ojo
    // lee entero.
    const inventado = 'clase-abierta-en-plataforma-x-punto-test';
    const larguisimo = 'x'.repeat(4000);
    const { form: f, avisos } = propuestaAFormulario(
      propuestaCon(['merienda', inventado, larguisimo]),
      TAXONOMIA,
    );

    expect(f.incluye).toEqual(['merienda']);
    // Y no quedan colgados en ningún otro campo: lo que no está en el formulario
    // no llega a `toPublic`, que es lo único que se publica.
    const crudo = JSON.stringify(f);
    expect(crudo, 'el slug inventado').not.toContain(inventado);
    expect(crudo, 'el slug larguísimo').not.toContain(larguisimo);
    // Descartar **en silencio** sería perder lo que la persona escribió: van al
    // aviso, que es el «Otro» del § 4.2 del PRD. El admin decide si alguno
    // merece entrar a la taxonomía —y entonces sí corre por `upsertOpcion` con
    // su slugify (trampa 6)— o si no era nada.
    expect(avisos.join(' '), 'el aviso de lo no reconocido').toContain(inventado);
  });
});

describe('los aranceles del formulario público son los tres `fijo: true`, y nada más (§4.2)', () => {
  /**
   * La lista está escrita a mano en `types/propuesta.ts` a propósito: derivarla
   * de `opciones-base.json` haría que una cuarta opción base **ensanche sola** lo
   * que un anónimo puede mandar. Este caso la ata en las dos direcciones, así que
   * la cuarta pone el test en rojo y alguien decide.
   */
  const base = JSON.parse(readFileSync('src/lib/opciones-base.json', 'utf8')) as Record<
    string,
    { slug: string; fijo: boolean }[]
  >;
  const fijos = base.arancel!.filter((v) => v.fijo).map((v) => v.slug);

  it('son exactamente los `fijo: true` de la taxonomía', () => {
    expect([...ARANCELES_PROPUESTA].sort()).toEqual([...fijos].sort());
  });

  it('y no hay ninguno de más, que es el sentido de la lista', () => {
    // Si mañana aparece un quinto `fijo: true`, el caso de arriba se pone rojo y
    // hay que decidir si el formulario público lo ofrece. Este es el control
    // positivo de que la taxonomía tiene de dónde sacar la comparación.
    expect(fijos.length).toBeGreaterThan(2);
    expect(fijos).toContain('a-la-gorra');
  });
});

describe('el schema — lo que la persona ve antes de mandar', () => {
  it('acepta la propuesta completa', () => {
    const r = valida();
    expect(rutas(r)).toEqual([]);
  });

  it('pide título, descripción, quién organiza y cómo contactarlo', () => {
    expect(rutas(valida({ titulo: 'corto' }))).toContain('titulo');
    expect(rutas(valida({ descripcion: 'poco' }))).toContain('descripcion');
    expect(rutas(valida({ organizador: { nombre: '', instagram: '' } }))).toContain(
      'organizador.nombre',
    );
    expect(rutas(valida({ contacto: { via: 'mail', valor: '' } }))).toContain('contacto.valor');
  });

  it('pide al menos una fecha, y no más de doce', () => {
    expect(rutas(valida({ fechas: [] }))).toContain('fechas');
    const trece = Array.from({ length: 13 }, () => ({
      dia: '2026-10-07',
      desde: '19:00',
      hasta: '',
    }));
    expect(rutas(valida({ fechas: trece }))).toContain('fechas');
  });

  it('rechaza la forma de la fecha y de la hora', () => {
    expect(rutas(valida({ fechas: [{ dia: '7/10/2026', desde: '19:00', hasta: '' }] }))).toContain(
      'fechas.0.dia',
    );
    expect(rutas(valida({ fechas: [{ dia: '2026-10-07', desde: '7pm', hasta: '' }] }))).toContain(
      'fechas.0.desde',
    );
    // 24:00 no existe en un reloj de 24 horas, y `[01]\d|2[0-3]` es lo que lo dice.
    expect(
      rutas(valida({ fechas: [{ dia: '2026-10-07', desde: '24:00', hasta: '' }] })),
    ).toContain('fechas.0.desde');
  });

  /**
   * **La fecha que no existe**, que es lo único de las fechas que el schema
   * verifica y la regla no puede: `2026-02-31` pasa el `matches` de los dos
   * lados. Se avisa acá, que es donde hay alguien mirando la pantalla.
   */
  it('rechaza el 31 de febrero, que la regla no puede ver', () => {
    expect(diaReal('2026-02-31')).toBe(false);
    expect(diaReal('2026-02-28')).toBe(true);
    // Bisiesto, que es el caso donde una implementación a ojo se equivoca.
    expect(diaReal('2028-02-29')).toBe(true);
    expect(diaReal('2026-02-29')).toBe(false);
    expect(diaReal('2026-13-01')).toBe(false);
    expect(rutas(valida({ fechas: [{ dia: '2026-02-31', desde: '19:00', hasta: '' }] }))).toContain(
      'fechas.0.dia',
    );
  });

  it('rechaza el fin antes del inicio', () => {
    expect(
      rutas(valida({ fechas: [{ dia: '2026-10-07', desde: '21:00', hasta: '19:00' }] })),
    ).toContain('fechas.0.hasta');
    // Igual tampoco: una actividad de duración cero no es una actividad.
    expect(
      rutas(valida({ fechas: [{ dia: '2026-10-07', desde: '19:00', hasta: '19:00' }] })),
    ).toContain('fechas.0.hasta');
  });

  it('pide el lugar salvo que sea virtual, y alcanza con uno de los dos datos', () => {
    const sinLugar = { nombre: '', direccion: '', barrio: '' };
    expect(rutas(valida({ lugar: sinLugar }))).toContain('lugar.nombre');
    expect(rutas(valida({ modalidad: 'virtual', lugar: sinLugar }))).toEqual([]);
    // Con el nombre solo, o con la dirección sola, alcanza: quien propone no
    // siempre sabe la dirección exacta, y el admin la completa.
    expect(rutas(valida({ lugar: { ...sinLugar, nombre: 'Casa Brandon' } }))).toEqual([]);
    expect(rutas(valida({ lugar: { ...sinLugar, direccion: 'Aráoz 32' } }))).toEqual([]);
  });

  it('si pide inscripción, pide cómo se anota la gente', () => {
    expect(
      rutas(valida({ inscripcion: { requiere: true, comoDice: '' } })),
    ).toContain('inscripcion.comoDice');
    expect(rutas(valida({ inscripcion: { requiere: false, comoDice: '' } }))).toEqual([]);
  });
});

describe('form → documento', () => {
  it('recorta y pasa lo opcional vacío a `null`, no a `\'\'`', () => {
    // Una sola forma de vacío, para que la regla pueda exigir `== null` en vez
    // de aceptar dos. Es el criterio de `formAReporte`.
    const d = formAPropuesta(
      form({
        titulo: '  Taller de crónica urbana  ',
        organizador: { nombre: ' Casa Brandon ', instagram: '   ' },
        arancel: { tipo: 'gratis', notas: '  ' },
        incluyeOtro: '   ',
        imagenUrl: '  ',
      }),
    );
    expect(d.titulo).toBe('Taller de crónica urbana');
    expect(d.organizador.nombre).toBe('Casa Brandon');
    expect(d.organizador.instagram).toBeNull();
    expect(d.arancel.notas).toBeNull();
    expect(d.incluyeOtro).toBeNull();
    expect(d.imagen).toBeNull();
  });

  it('nace con el estado y la revisión que la regla exige', () => {
    const d = formAPropuesta(form());
    expect(d.estado).toBe('nueva');
    expect(d.revision).toEqual({ porUid: null, en: null, actividadId: null, motivo: null });
    expect(d.origen).toBe('formulario-publico');
  });

  it('descarta el lugar si es virtual, y el «cómo se anota» si no pide inscripción', () => {
    // Si la modalidad o la casilla cambiaron a mitad de camino, no se cuela lo
    // que ya no aplica — el criterio de `formAReporte` con los pasos.
    expect(formAPropuesta(form({ modalidad: 'virtual' })).lugar).toBeNull();
    expect(
      formAPropuesta(form({ inscripcion: { requiere: false, comoDice: 'por DM' } }))
        .inscripcion.comoDice,
    ).toBeNull();
  });

  it('`hasta` vacío es `null`, no `\'\'`', () => {
    const d = formAPropuesta(form({ fechas: [{ dia: '2026-10-07', desde: '19:00', hasta: '' }] }));
    expect(d.fechas[0]!.hasta).toBeNull();
  });

  it('la URL pegada entra como `{ url }`, que es una de las dos formas (DEC-11)', () => {
    const d = formAPropuesta(form({ imagenUrl: ' https://x.test/flyer.jpg ' }));
    expect(d.imagen).toEqual({ url: 'https://x.test/flyer.jpg' });
    // **Una sola clave**: la regla rechaza el mapa con las dos.
    expect(Object.keys(d.imagen as object)).toEqual(['url']);
  });

  /**
   * **Los dos campos donde zod recortaba y el armado no** — lo encontró el
   * `auditor-privacidad`. `texto = z.string().trim()` corre **antes** del
   * `regex`, así que `' 2026-10-07 '` pasa la validación; sin el `trim()` del
   * armado se guardaba con los espacios, y ni la regla (no itera la lista) ni el
   * schema (ya vio la versión recortada) lo podían ver.
   */
  it('recorta también las dos listas, que es donde el `trim` de zod no llega', () => {
    const d = formAPropuesta(
      form({
        fechas: [{ dia: ' 2026-10-07 ', desde: ' 19:00 ', hasta: ' 21:00 ' }],
        incluye: [' merienda ', '  ', 'libro'],
      }),
    );
    expect(d.fechas[0]).toEqual({ dia: '2026-10-07', desde: '19:00', hasta: '21:00' });
    // Y el elemento que era solo espacios no queda como slug vacío.
    expect(d.incluye).toEqual(['merienda', 'libro']);
  });

  /**
   * **El conjunto de campos, atado contra la lista de la regla.**
   *
   * `formAPropuesta` emite exactamente los quince campos que `propuestaValida()`
   * exige, más el `creadoEn` que agrega quien escribe. Hoy eso lo cobra el test
   * de integración —`p_ok` deja de escribirse— pero con un `permission-denied`
   * que **no dice cuál** campo sobra o falta. Este aserto lo nombra, y es la
   * misma idea que la comparación de cotas: parsear la lista de la regla en vez
   * de copiarla. Lo pidió el `auditor-privacidad`.
   */
  it('emite exactamente los campos que la regla exige, menos `creadoEn`', () => {
    const m = /let campos = \[([\s\S]*?)\];/.exec(bloqueDePropuestas());
    expect(m, 'no se encontró la lista `campos` en la regla').not.toBeNull();
    const deLaRegla = [...m![1]!.matchAll(/'([^']+)'/g)].map((x) => x[1]!);
    // Control positivo: una lista vacía dejaría la comparación pasando sola.
    expect(deLaRegla.length).toBeGreaterThan(10);
    expect(deLaRegla).toContain('contacto');

    const delArmado = Object.keys(formAPropuesta(form()));
    expect(delArmado.sort()).toEqual(deLaRegla.filter((c) => c !== 'creadoEn').sort());
  });

  it('no emite `creadoEn`: lo pone la capa que escribe, con `request.time`', () => {
    // Si el armado lo emitiera, el cliente podría antedatar la propuesta y la
    // regla lo rechazaría — con el formulario diciendo que se mandó.
    expect(Object.prototype.hasOwnProperty.call(formAPropuesta(form()), 'creadoEn')).toBe(false);
  });
});
