/**
 * La suscripción literaria, del lado puro — B-832, PRD 3.
 *
 * Acá vive lo que se puede probar sin emuladores: el schema de zod, el armado del
 * documento, y **las ataduras con `firestore.rules`**, que son las que importan
 * más.
 *
 * ── Por qué las ataduras son el corazón de este archivo ───────────────────
 * El formulario de `/guia/suscripciones/sumar` lo va a completar un anónimo, así
 * que el schema de zod **no es la defensa**: se saltea con un `curl`. La defensa
 * es la regla. Los dos dicen los mismos números y los mismos vocabularios, y un
 * documento que pase por el schema y no por la regla **no se guarda** — con el
 * formulario diciendo que sí.
 *
 * ── Y dos ataduras que `/librerias` no necesitaba ─────────────────────────
 * 1. **El precio y su fecha** (DEC-12). La regla no solo acota la forma: exige
 *    que `cargadoEn` sea `request.time` al cargarlo y al cambiarlo, y que **no se
 *    mueva** si el número no se movió. Es la única cláusula del archivo que
 *    defiende una *afirmación* del sitio y no un dato privado, así que el caso
 *    que la fija es de los que hay que leer antes de tocarla.
 * 2. **El link de cobro con `https:` y nada más** (criterio 7).
 *
 * Las reglas contra el emulador —qué rechaza cada cláusula, verificado por
 * mutación— están en `tests/suscripciones.integracion.test.ts`.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { sinComentarios } from '../scripts/sin-comentarios.mjs';
import {
  ESTADOS_DIRECTORIO,
  ESTADO_INICIAL,
  ESTADO_PUBLICO,
  TRANSICIONES,
} from '@/lib/directorios';
import {
  RE_INSTAGRAM_SUSCRIPCION,
  RE_LINK_SUSCRIPCION,
  RE_SLUG_SUSCRIPCION,
  RE_WHATSAPP_SUSCRIPCION,
  formASuscripcion,
  precioCambio,
  precioDelForm,
  slugDeSuscripcion,
  soloDigitos,
  suscripcionFormSchema,
  suscripcionPublicaFormSchema,
  suscripcionVacia,
} from '@/lib/suscripcion-literaria-schema';
import {
  MAX_ALCANCE_SUSCRIPCION,
  MAX_EXTRAS_SUSCRIPCION,
  MAX_IMAGENES_SUSCRIPCION,
  MAX_INCLUYE_SUSCRIPCION,
  MAX_LIBROS_POR_ENTREGA,
  MAX_PRECIO_SUSCRIPCION,
  MIN_CONTACTO_SUSCRIPCION,
  MIN_DESCRIPCION_SUSCRIPCION,
  MIN_LIBROS_POR_ENTREGA,
  MIN_MAIL_SUSCRIPCION,
  MIN_NOMBRE_SUSCRIPCION,
  MIN_OFRECIDA_POR_SUSCRIPCION,
  MIN_PRECIO_SUSCRIPCION,
  ORIGENES_SUSCRIPCION,
  PERIODICIDAD_POR_DEFECTO,
  TOPE_COMPROMISO_SUSCRIPCION,
  TOPE_CONTACTO_SUSCRIPCION,
  TOPE_DESCRIPCION_SUSCRIPCION,
  TOPE_LINK_SUSCRIPCION,
  TOPE_MAIL_SUSCRIPCION,
  TOPE_MOTIVO_SUSCRIPCION,
  TOPE_NOMBRE_SUSCRIPCION,
  TOPE_OFRECIDA_POR_SUSCRIPCION,
  TOPE_OTRO_SUSCRIPCION,
  TOPE_SEARCH_TEXT_SUSCRIPCION,
  TOPE_SLUG_SUSCRIPCION,
  TOPE_SLUG_TAXONOMIA_SUSCRIPCION,
  TOPE_TEMATICA_SUSCRIPCION,
  VIAS_CONTACTO_SUSCRIPCION,
} from '@/types/suscripcion-literaria';
import { TOPE_SLUG_LIBRERIA } from '@/types/libreria';
import { ts } from './fixtures/tiempo';
import type { SuscripcionLiterariaForm } from '@/types/suscripcion-literaria';

/** Un archivo del repo, desde la raíz. */
const raiz = (rel: string) => fileURLToPath(new URL(`../${rel}`, import.meta.url));

const REGLAS = readFileSync(raiz('firestore.rules'), 'utf8');

/**
 * El bloque de `/suscripciones` entero: sus helpers, `formaDeSuscripcion()`,
 * `suscripcionValida()`, `suscripcionActualizable()` y el `match`.
 *
 * **El ancla es el comentario de sección y no el nombre del primer helper**, por
 * lo que el `auditor-trampas` señaló en `tests/propuestas.test.ts`: con el nombre
 * de una función, un helper nuevo agregado **antes** de ésa quedaba afuera del
 * recorte y de todo lo que este archivo verifica, sin que nada lo dijera.
 *
 * **El bloque se lee SIN comentarios**, porque los docblocks de la regla citan
 * cláusulas para explicarlas y un barrido que los lea se agarra a sí mismo.
 */
const bloqueDeSuscripciones = (): string => {
  const anclaje = REGLAS.indexOf('SUSCRIPCIONES LITERARIAS — B-832');
  const i = anclaje === -1 ? -1 : REGLAS.lastIndexOf('/*', anclaje);
  /*
   * El final es la sección siguiente si la hay, y si no el catch-all — la misma
   * forma que `bloqueDeLibrerias`, que es lo que hizo que **este** bloque no se
   * comiera aquél cuando entró. La tajada 4 hereda el mecanismo.
   */
  const finDelBanner = REGLAS.indexOf('\n', anclaje);
  const siguienteSeccion = REGLAS.indexOf('══', finDelBanner);
  const catchAll = REGLAS.indexOf('match /{document=**}');
  const j =
    siguienteSeccion !== -1 && siguienteSeccion < catchAll
      ? REGLAS.lastIndexOf('/*', siguienteSeccion)
      : catchAll;
  if (i === -1 || j === -1 || j <= i) {
    throw new Error('no se encontró el bloque de /suscripciones en firestore.rules');
  }
  return sinComentarios(REGLAS.slice(i, j));
};

/** Todas las cotas de tamaño del bloque, sacadas del archivo: `[campo, op, n]`. */
const cotasDeLaRegla = (): [campo: string, op: string, n: number][] =>
  [...bloqueDeSuscripciones().matchAll(/([\w.'()[\], ]+)\.size\(\) (<=|>=) (\d+)/g)].map((m) => [
    m[1]!.trim(),
    m[2]!,
    Number(m[3]!),
  ]);

const form = (over: Partial<SuscripcionLiterariaForm> = {}): SuscripcionLiterariaForm => ({
  ...suscripcionVacia(),
  nombre: 'La Caja de los Martes',
  descripcion: 'Una caja mensual de poesía argentina contemporánea, con guía de lectura.',
  ofrecidaPor: {
    nombre: 'Eterna Cadencia',
    tipo: 'libreria',
    instagram: '@eternacadencia',
    libreriaSlug: 'eterna-cadencia',
  },
  periodicidad: 'mensual',
  compromisoMinimo: '3 meses',
  incluye: ['libros', 'encuentros'],
  incluyeOtro: 'Un marcapáginas ilustrado',
  envio: {
    manda: true,
    cuantos: '2',
    tematica: 'poesía argentina',
    editoriales: 'independientes',
    sorpresa: 'si',
  },
  extras: ['descuentos-en-local'],
  extrasOtro: '',
  precio: { monto: '18000', porPeriodo: 'mensual' },
  alcance: ['caba', 'todo-el-pais'],
  linkDeSuscripcion: 'https://cobro.example/la-caja',
  instagram: '@lacajadelosmartes',
  whatsapp: '+54 9 11 2222-3333',
  mail: 'hola@lacaja.test',
  contactoDeQuienCargo: { via: 'mail', valor: 'quien.cargo@lacaja.test' },
  ...over,
});

const CARGADO = ts('2026-09-11T15:00:00Z');

const valida = (over: Partial<SuscripcionLiterariaForm> = {}) =>
  suscripcionFormSchema.safeParse(form(over));
const rutas = (r: ReturnType<typeof valida>): string[] =>
  r.success ? [] : r.error.issues.map((i) => i.path.join('.'));

describe('los topes se dicen en dos runtimes y son el mismo número (B-364, clase de B-88)', () => {
  it('el bloque de la regla existe y tiene contenido', () => {
    // Control positivo: si el recorte fallara, los casos de abajo compararían
    // contra una cadena vacía y `toContain` sería falso para todo.
    const bloque = bloqueDeSuscripciones();
    expect(bloque.length).toBeGreaterThan(1000);
    expect(bloque).toContain('function formaDeSuscripcion()');
    expect(bloque).toContain('match /suscripciones/{id}');
  });

  /**
   * **La comparación es exhaustiva, no una muestra.** Cada cota de la regla está
   * acá con la constante que le corresponde, y el aserto compara las **dos listas
   * completas**: una cota nueva en `firestore.rules` que nadie agregue acá pone el
   * test en rojo.
   */
  it('todas las cotas de la regla salen de una constante del modelo', () => {
    const esperadas: [string, string, number][] = [
      ['o.nombre', '>=', MIN_OFRECIDA_POR_SUSCRIPCION],
      ['o.nombre', '<=', TOPE_OFRECIDA_POR_SUSCRIPCION],
      ['o.tipo', '<=', TOPE_SLUG_TAXONOMIA_SUSCRIPCION],
      // El slug de una **librería**, así que el tope es el de aquella colección:
      // es el segmento de `/guia/librerias/{slug}` y no de esta ficha.
      ['o.libreriaSlug', '<=', TOPE_SLUG_LIBRERIA],
      ['e.tematica', '<=', TOPE_TEMATICA_SUSCRIPCION],
      ['e.editoriales', '<=', TOPE_SLUG_TAXONOMIA_SUSCRIPCION],
      ['p.valor.porPeriodo', '<=', TOPE_SLUG_TAXONOMIA_SUSCRIPCION],
      ["c.get('valor', '')", '>=', MIN_CONTACTO_SUSCRIPCION],
      ["c.get('valor', '')", '<=', TOPE_CONTACTO_SUSCRIPCION],
      ['d.nombre', '>=', MIN_NOMBRE_SUSCRIPCION],
      ['d.nombre', '<=', TOPE_NOMBRE_SUSCRIPCION],
      ['d.slug', '<=', TOPE_SLUG_SUSCRIPCION],
      ['d.descripcion', '>=', MIN_DESCRIPCION_SUSCRIPCION],
      ['d.descripcion', '<=', TOPE_DESCRIPCION_SUSCRIPCION],
      ['d.imagenes', '<=', MAX_IMAGENES_SUSCRIPCION],
      ['d.periodicidad', '<=', TOPE_SLUG_TAXONOMIA_SUSCRIPCION],
      ['d.compromisoMinimo', '<=', TOPE_COMPROMISO_SUSCRIPCION],
      ['d.incluye', '<=', MAX_INCLUYE_SUSCRIPCION],
      ['d.incluyeOtro', '<=', TOPE_OTRO_SUSCRIPCION],
      ['d.extras', '<=', MAX_EXTRAS_SUSCRIPCION],
      ['d.extrasOtro', '<=', TOPE_OTRO_SUSCRIPCION],
      ['d.alcance', '<=', MAX_ALCANCE_SUSCRIPCION],
      ['d.linkDeSuscripcion', '<=', TOPE_LINK_SUSCRIPCION],
      ['d.mail', '>=', MIN_MAIL_SUSCRIPCION],
      ['d.mail', '<=', TOPE_MAIL_SUSCRIPCION],
      ['d.searchText', '<=', TOPE_SEARCH_TEXT_SUSCRIPCION],
      ["d.revision.get('motivo', '')", '<=', TOPE_MOTIVO_SUSCRIPCION],
    ];
    expect(cotasDeLaRegla().sort()).toEqual(esperadas.sort());
  });

  /**
   * Las cotas **numéricas** no se comparan con `.size()`, así que el barrido de
   * arriba no las ve: van acá, una por una. Son las dos que este modelo tiene y
   * los otros dos directorios no: el precio y cuántos libros por entrega.
   */
  it('las cotas de los dos números también salen del modelo', () => {
    const bloque = bloqueDeSuscripciones();
    expect(bloque).toContain(`p.valor.monto >= ${MIN_PRECIO_SUSCRIPCION}`);
    expect(bloque).toContain(`p.valor.monto <= ${MAX_PRECIO_SUSCRIPCION}`);
    expect(bloque).toContain(`e.get('cuantos', 0) >= ${MIN_LIBROS_POR_ENTREGA}`);
    expect(bloque).toContain(`e.get('cuantos', 0) <= ${MAX_LIBROS_POR_ENTREGA}`);
  });

  /**
   * **Los patrones, comparados por su fuente y no por su efecto.**
   *
   * El schema los exporta como cadena justamente para esto: si acá se comparara
   * «un slug con mayúsculas lo rechazan los dos», la comparación seguiría en
   * verde el día que uno de los dos acepte algo que el otro no.
   */
  it('los `matches` de la regla son los mismos patrones que el schema', () => {
    const bloque = bloqueDeSuscripciones();
    expect(bloque, 'el alfabeto del slug').toContain(`'${RE_SLUG_SUSCRIPCION}'`);
    expect(bloque, 'el handle de Instagram').toContain(`'${RE_INSTAGRAM_SUSCRIPCION}'`);
    expect(bloque, 'los dígitos del WhatsApp').toContain(`'${RE_WHATSAPP_SUSCRIPCION}'`);
    expect(bloque, 'el link de cobro').toContain(`'${RE_LINK_SUSCRIPCION}'`);
    // El alfabeto de slug lo usan **seis** campos: la ficha, el tipo de quien la
    // ofrece, el slug de la librería, la periodicidad, el perfil editorial y el
    // período del precio.
    expect(bloque.split(`'${RE_SLUG_SUSCRIPCION}'`).length - 1).toBe(6);
  });

  it('el link de cobro exige `https:` y no acepta `http:` — criterio 7', () => {
    /*
     * Es la diferencia deliberada con la `web` de una librería, que sí acepta
     * `http://`. Este caso la fija: si alguien «unifica» los dos patrones, se cae.
     */
    const bloque = bloqueDeSuscripciones();
    expect(bloque).toContain("'^https://.*'");
    expect(bloque, 'la regla aflojó a http://').not.toContain("'^https?://.*'");
  });

  /**
   * **Los campos del documento salen de `formASuscripcion`, no de una lista a
   * mano.** Un campo nuevo del modelo entra al barrido solo.
   */
  it('el `hasOnly`/`hasAll` de la regla enumera exactamente los campos del documento', () => {
    const bloque = bloqueDeSuscripciones();
    const delDocumento = [
      ...Object.keys(formASuscripcion(form(), CARGADO, 'panel')),
      'creadoEn',
    ].sort();
    const desde = bloque.indexOf('let obligatorios = [');
    const obligatorios = bloque
      .slice(desde, bloque.indexOf('];', desde))
      .match(/'[a-zA-Z]+'/g)!
      .map((s) => s.replaceAll("'", ''))
      .sort();
    expect(obligatorios).toEqual(delDocumento);
    // Y el opcional va en `hasOnly` y **no** en `hasAll`: lo escribe un trigger
    // con el Admin SDK, así que hoy está ausente en todos los documentos.
    expect(obligatorios).not.toContain('publicadaAlgunaVez');
    expect(bloque).toContain("hasOnly(obligatorios.concat(['publicadaAlgunaVez']))");
    expect(bloque).toContain('hasAll(obligatorios)');
  });
});

describe('el ciclo de vida de la regla es el del motor compartido (B-834)', () => {
  it('los tres estados y los dos orígenes son los mismos vocabularios', () => {
    const bloque = bloqueDeSuscripciones();
    expect(bloque).toContain(`[${ESTADOS_DIRECTORIO.map((e) => `'${e}'`).join(', ')}]`);
    for (const origen of ORIGENES_SUSCRIPCION) {
      expect(bloque, `el origen ${origen}`).toContain(`d.origen == '${origen}'`);
    }
    expect(bloque).toContain(`[${VIAS_CONTACTO_SUSCRIPCION.map((v) => `'${v}'`).join(', ')}]`);
  });

  it('el estado inicial que la regla fuerza es el del motor', () => {
    expect(bloqueDeSuscripciones()).toContain(`d.estado == '${ESTADO_INICIAL}'`);
  });

  /**
   * **La única arista que le falta al grafo, derivada y no escrita a mano.**
   *
   * Si mañana `TRANSICIONES` prohibiera otra cosa, la regla se quedaría
   * defendiendo una sola arista y este caso lo dice. Y si el grafo se completara,
   * también: la cláusula quedaría de más, que es la otra dirección del error.
   */
  it('la regla defiende exactamente la arista que `TRANSICIONES` no tiene', () => {
    const faltantes = ESTADOS_DIRECTORIO.flatMap((desde) =>
      ESTADOS_DIRECTORIO.filter(
        (hasta) => desde !== hasta && !TRANSICIONES[desde].includes(hasta),
      ).map((hasta) => [desde, hasta]),
    );
    expect(faltantes).toEqual([['rechazado', 'publicado']]);
    expect(bloqueDeSuscripciones()).toContain(
      "previo.get('estado', '') != 'rechazado' || d.estado != 'publicado'",
    );
  });

  /**
   * **La cláusula propia de esta colección: la fecha del precio** — DEC-12.
   *
   * Es la única del archivo que defiende una **afirmación** del sitio y no un dato
   * privado, y por eso tiene su caso: sin ella, la frase «$18.000 · cargado el 24
   * de septiembre» se puede fabricar desde el cliente, y entonces el mecanismo
   * entero de B-837 no afirma nada.
   *
   * MUTACIÓN PROBADA: sacar cualquiera de las dos cláusulas deja este caso en rojo
   * nombrando cuál.
   */
  it('la fecha del precio la estampa el servidor, y no se mueve si el precio no se movió', () => {
    const bloque = bloqueDeSuscripciones();
    expect(bloque, 'al crear, el precio no nace con la fecha del servidor').toContain(
      "d.get('precio', null) == null || d.precio.cargadoEn == request.time",
    );
    expect(bloque, 'al editar, la fecha se puede mover sin que cambie el precio').toContain(
      'd.precio.valor == previo.precio.valor',
    );
    expect(bloque).toContain('d.precio.cargadoEn == previo.precio.cargadoEn');
  });
});

describe('el schema — lo que se le avisa a quien completa antes de mandar', () => {
  it('una suscripción completa pasa', () => {
    // Control positivo: sin esto, «el schema rechaza X» podría querer decir que
    // rechaza todo.
    expect(valida().success).toBe(true);
  });

  it('el nombre, la descripción y quién la ofrece son obligatorios', () => {
    expect(rutas(valida({ nombre: 'x' }))).toContain('nombre');
    expect(rutas(valida({ descripcion: 'corta' }))).toContain('descripcion');
    expect(rutas(valida({ descripcion: 'x'.repeat(TOPE_DESCRIPCION_SUSCRIPCION + 1) }))).toContain(
      'descripcion',
    );
    expect(rutas(valida({ ofrecidaPor: { ...form().ofrecidaPor, nombre: '' } }))).toContain(
      'ofrecidaPor.nombre',
    );
  });

  it('la descripción es obligatoria acá y no en una librería, y este caso lo fija', () => {
    // § 3.1 del PRD: una suscripción es una promesa a futuro. Es la diferencia de
    // producto entre las dos entidades, no una preferencia de validación.
    expect(MIN_DESCRIPCION_SUSCRIPCION).toBeGreaterThan(0);
    expect(rutas(valida({ descripcion: '' }))).toContain('descripcion');
  });

  it('un nombre que no produce ninguna dirección web se avisa en el slug — trampa 10', () => {
    expect(slugDeSuscripcion({ nombre: '※ ※', slug: '' })).toBe('');
    expect(rutas(valida({ nombre: '※ ※' }))).toContain('slug');
  });

  it('los seis vocabularios guardan slugs, y lo que no lo es se avisa', () => {
    expect(rutas(valida({ periodicidad: 'Cada Mes' }))).toContain('periodicidad');
    expect(rutas(valida({ periodicidad: '' }))).toContain('periodicidad');
    expect(rutas(valida({ ofrecidaPor: { ...form().ofrecidaPor, tipo: 'Una Librería' } }))).toContain(
      'ofrecidaPor.tipo',
    );
    expect(rutas(valida({ incluye: ['Con Mayúsculas'] }))).toContain('incluye');
    expect(rutas(valida({ extras: ['Con Mayúsculas'] }))).toContain('extras');
    expect(rutas(valida({ alcance: ['Con Mayúsculas'] }))).toContain('alcance');
  });

  it('las tres listas tienen tope, que es lo que la regla no puede iterar', () => {
    const muchos = (n: number) => Array.from({ length: n }, (_, i) => `slug-${i}`);
    expect(rutas(valida({ incluye: muchos(MAX_INCLUYE_SUSCRIPCION + 1) }))).toContain('incluye');
    expect(rutas(valida({ extras: muchos(MAX_EXTRAS_SUSCRIPCION + 1) }))).toContain('extras');
    expect(rutas(valida({ alcance: muchos(MAX_ALCANCE_SUSCRIPCION + 1) }))).toContain('alcance');
  });

  /**
   * **Los condicionales del §11, en las dos direcciones.** La de abajo es la que
   * se olvida siempre: los datos del envío cargados **sin** que mande libros.
   */
  it('si manda libros, el perfil editorial es obligatorio', () => {
    expect(rutas(valida({ envio: { ...form().envio, editoriales: '' } }))).toContain(
      'envio.editoriales',
    );
  });

  it('y si NO manda libros, los datos del envío no se pueden quedar cargados', () => {
    /*
     * Sin esto, una suscripción que dejó de mandar libros conserva su temática y
     * el documento queda diciendo dos cosas a la vez. La proyección lo impone
     * igual al publicar; acá se **avisa**, que es lo que le deja arreglarlo a
     * quien está mirando la pantalla.
     *
     * MUTACIÓN PROBADA: borrar la rama `else` del `superRefine` deja este caso en
     * rojo.
     */
    const apagado = { manda: false, cuantos: '', tematica: 'novela negra', editoriales: '', sorpresa: '' };
    expect(rutas(valida({ envio: apagado }))).toContain('envio.manda');
    // Y vacío sí pasa: si no, «no manda libros» sería inguardable.
    expect(
      valida({ envio: { manda: false, cuantos: '', tematica: '', editoriales: '', sorpresa: '' } })
        .success,
    ).toBe(true);
  });

  it('cuántos libros por entrega es un entero en rango', () => {
    expect(rutas(valida({ envio: { ...form().envio, cuantos: '0' } }))).toContain('envio.cuantos');
    expect(
      rutas(valida({ envio: { ...form().envio, cuantos: String(MAX_LIBROS_POR_ENTREGA + 1) } })),
    ).toContain('envio.cuantos');
    expect(rutas(valida({ envio: { ...form().envio, cuantos: '1.5' } }))).toContain('envio.cuantos');
    expect(valida({ envio: { ...form().envio, cuantos: '' } }).success).toBe(true);
  });

  it('el precio va con su período, o no va — DEC-12', () => {
    expect(rutas(valida({ precio: { monto: '18000', porPeriodo: '' } }))).toContain(
      'precio.porPeriodo',
    );
    expect(rutas(valida({ precio: { monto: '', porPeriodo: 'mensual' } }))).toContain(
      'precio.monto',
    );
    expect(rutas(valida({ precio: { monto: '18000,50', porPeriodo: 'mensual' } }))).toContain(
      'precio.monto',
    );
    expect(
      rutas(valida({ precio: { monto: String(MAX_PRECIO_SUSCRIPCION + 1), porPeriodo: 'mensual' } })),
    ).toContain('precio.monto');
    // Y los dos vacíos pasan: el precio es opcional, que es el «(opcional)» del
    // pedido del dueño.
    expect(valida({ precio: { monto: '', porPeriodo: '' } }).success).toBe(true);
  });

  it('el link de cobro tiene que ser `https:`', () => {
    expect(rutas(valida({ linkDeSuscripcion: 'javascript:alert(1)' }))).toContain(
      'linkDeSuscripcion',
    );
    expect(rutas(valida({ linkDeSuscripcion: 'http://cobro.example/x' }))).toContain(
      'linkDeSuscripcion',
    );
    expect(rutas(valida({ linkDeSuscripcion: 'cobro.example/x' }))).toEqual([]);
  });

  it('los tres contactos se validan con los saneadores del proyecto', () => {
    expect(rutas(valida({ instagram: 'cuenta/otra' }))).toContain('instagram');
    expect(rutas(valida({ whatsapp: '1122' }))).toContain('whatsapp');
    expect(rutas(valida({ mail: 'no-es-un-mail' }))).toContain('mail');
    // Y las formas que la gente escribe de verdad sí pasan.
    expect(valida({ instagram: 'https://instagram.com/lacaja' }).success).toBe(true);
    expect(valida({ whatsapp: '+54 9 11 2222-3333' }).success).toBe(true);
  });

  it('la galería lleva exactamente una portada, y hasta el tope de imágenes', () => {
    const imagen = (i: number, portada: boolean) => ({
      id: `img_${i}`,
      url: `https://x.test/${i}.jpg`,
      epigrafe: '',
      origen: 'externa' as const,
      portada,
    });
    expect(rutas(valida({ imagenes: [imagen(0, false)] }))).toContain('imagenes');
    expect(rutas(valida({ imagenes: [imagen(0, true), imagen(1, true)] }))).toContain('imagenes');
    expect(valida({ imagenes: [imagen(0, true), imagen(1, false)] }).success).toBe(true);
    expect(valida({ imagenes: [] }).success).toBe(true);
  });

  /**
   * **La única diferencia entre las dos configuraciones del mismo formulario**
   * (§ 5 del PRD): quien carga desde afuera **no vuelve a entrar**.
   */
  it('el contacto de quien carga es obligatorio solo en el formulario público', () => {
    const sinContacto = form({ contactoDeQuienCargo: { via: 'mail', valor: '' } });
    expect(suscripcionFormSchema.safeParse(sinContacto).success).toBe(true);
    const publico = suscripcionPublicaFormSchema.safeParse(sinContacto);
    expect(publico.success).toBe(false);
    expect(rutas(publico as ReturnType<typeof valida>)).toContain('contactoDeQuienCargo.valor');
    expect(suscripcionPublicaFormSchema.safeParse(form()).success).toBe(true);
  });
});

describe('el armado del documento — lo que se guarda es lo que se va a publicar', () => {
  it('normaliza los contactos y el link, que es de donde salen los `href`', () => {
    const d = formASuscripcion(form(), CARGADO, 'panel');
    expect(d.instagram).toBe('lacajadelosmartes');
    expect(d.ofrecidaPor.instagram).toBe('eternacadencia');
    expect(d.whatsapp).toBe('5491122223333');
    expect(d.mail).toBe('hola@lacaja.test');
    expect(d.linkDeSuscripcion).toBe('https://cobro.example/la-caja');
    expect(soloDigitos('+54 9 11 2222-3333')).toBe('5491122223333');
  });

  it('un link que no es `https:` no se guarda, ni siquiera como texto', () => {
    // La regla lo rechazaría igual; guardarlo crudo dejaría el saneo en manos del
    // consumidor, que es lo que B-817 dejó anotado como agujero.
    expect(formASuscripcion(form({ linkDeSuscripcion: 'http://x.test' }), CARGADO).linkDeSuscripcion).toBeNull();
  });

  it("`''` se guarda como `null`, una sola forma de vacío", () => {
    const d = formASuscripcion(
      form({
        compromisoMinimo: '',
        incluyeOtro: '',
        extrasOtro: '',
        linkDeSuscripcion: '',
        instagram: '',
        whatsapp: '',
        mail: '',
        contactoDeQuienCargo: { via: 'mail', valor: '' },
      }),
      CARGADO,
    );
    expect(d.compromisoMinimo).toBeNull();
    expect(d.incluyeOtro).toBeNull();
    expect(d.extrasOtro).toBeNull();
    expect(d.linkDeSuscripcion).toBeNull();
    expect(d.instagram).toBeNull();
    expect(d.whatsapp).toBeNull();
    expect(d.mail).toBeNull();
    expect(d.contactoDeQuienCargo).toBeNull();
  });

  it('con `manda: false` los cuatro datos del envío se vacían al guardar', () => {
    /*
     * La otra mitad del condicional: el schema avisa, y esto **impide** que el
     * documento quede diciendo dos cosas a la vez. Es el par flag + dato que
     * `tests/clases-de-bug.test.ts` ya vigila en otras dos instancias.
     *
     * MUTACIÓN PROBADA: guardar `tematica: oNull(f.envio.tematica)` sin mirar
     * `manda` deja este caso en rojo.
     */
    const d = formASuscripcion(
      form({
        envio: { manda: false, cuantos: '3', tematica: 'novela negra', editoriales: 'mixto', sorpresa: 'si' },
      }),
      CARGADO,
    );
    expect(d.envio).toEqual({
      manda: false,
      cuantos: null,
      tematica: null,
      editoriales: null,
      sorpresa: null,
    });
  });

  it('`sorpresa` tiene tres estados y el vacío es «no lo dice», no `false`', () => {
    // Convertir el vacío a `false` haría que abrir una ficha para corregir un typo
    // publicara «se sabe qué libro llega» de algo que nunca lo dijo.
    expect(formASuscripcion(form({ envio: { ...form().envio, sorpresa: '' } }), CARGADO).envio.sorpresa).toBeNull();
    expect(formASuscripcion(form({ envio: { ...form().envio, sorpresa: 'no' } }), CARGADO).envio.sorpresa).toBe(false);
    expect(formASuscripcion(form(), CARGADO).envio.sorpresa).toBe(true);
  });

  it('el precio se guarda con la fecha que le pasan, y nunca con una del formulario', () => {
    /*
     * **La mitad de DEC-12 que el formulario no puede escribir.** `cargadoEn` no
     * está en `SuscripcionLiterariaForm`, así que no hay campo que tipear: la
     * fecha entra como parámetro y la pone quien guarda, con el reloj del
     * servidor.
     */
    const d = formASuscripcion(form(), CARGADO);
    expect(d.precio).toEqual({ valor: { monto: 18000, porPeriodo: 'mensual' }, cargadoEn: CARGADO });
    expect(precioDelForm(form({ precio: { monto: '', porPeriodo: 'mensual' } }), CARGADO)).toBeNull();
    expect(Object.keys(suscripcionVacia())).not.toContain('cargadoEn');
  });

  it('`precioCambio` mira el valor y no el objeto: corregir un typo no refecha', () => {
    /*
     * Es lo que decide si la fecha se mueve. Si comparara el objeto entero, dos
     * fechas distintas del mismo número darían «cambió» y la ficha publicaría que
     * el precio es más fresco de lo que es.
     */
    const a = { valor: { monto: 18000, porPeriodo: 'mensual' }, cargadoEn: CARGADO };
    const b = { valor: { monto: 18000, porPeriodo: 'mensual' }, cargadoEn: ts('2026-10-01T00:00:00Z') };
    expect(precioCambio(a, b)).toBe(false);
    expect(precioCambio(a, { ...a, valor: { monto: 19000, porPeriodo: 'mensual' } })).toBe(true);
    expect(precioCambio(a, { ...a, valor: { monto: 18000, porPeriodo: 'anual' } })).toBe(true);
    expect(precioCambio(null, a)).toBe(true);
    expect(precioCambio(a, null)).toBe(true);
  });

  it('el estado y la revisión nacen como la regla los va a exigir', () => {
    const d = formASuscripcion(form(), CARGADO, 'formulario-publico');
    expect(d.estado).toBe(ESTADO_INICIAL);
    expect(d.origen).toBe('formulario-publico');
    expect(d.revision).toEqual({ porUid: null, en: null, motivo: null });
  });

  it('la periodicidad arranca en mensual, que es el default del § 4.1', () => {
    expect(suscripcionVacia().periodicidad).toBe(PERIODICIDAD_POR_DEFECTO);
    expect(PERIODICIDAD_POR_DEFECTO).toBe('mensual');
  });

  it('el `searchText` va normalizado (§6), trae los dos textos libres y NO el precio', () => {
    /*
     * **El precio afuera es DEC-12 y no un olvido**: el buscador del listado es un
     * filtro, y tipear «18000» y que aparezca una ficha es comparar precios por la
     * ventana.
     *
     * MUTACIÓN PROBADA: agregar el monto al `join` deja este caso en rojo.
     */
    const d = formASuscripcion(form(), CARGADO, 'panel');
    expect(d.searchText).toContain('poesia argentina');
    expect(d.searchText).toContain('3 meses');
    expect(d.searchText).toContain('eterna cadencia');
    expect(d.searchText).not.toContain('18000');
    expect(d.searchText).not.toMatch(/[áéíóúÁÉÍÓÚ]/);
    expect(d.searchText.length).toBeLessThanOrEqual(TOPE_SEARCH_TEXT_SUSCRIPCION);
  });

  it('el contacto interno no se mezcla con los públicos', () => {
    const d = formASuscripcion(
      form({
        mail: 'hola@lacaja.test',
        contactoDeQuienCargo: { via: 'instagram', valor: 'quien.cargo' },
      }),
      CARGADO,
      'formulario-publico',
    );
    expect(d.mail).toBe('hola@lacaja.test');
    expect(d.contactoDeQuienCargo).toEqual({ via: 'instagram', valor: 'quien.cargo' });
  });

  it('las claves de cada imagen se enumeran, no se spreadean', () => {
    // B-206 #2: así un campo que escriba el servidor no puede viajar de vuelta por
    // el formulario.
    const d = formASuscripcion(
      form({
        imagenes: [
          {
            id: 'img_1',
            url: 'https://x.test/1.jpg',
            epigrafe: '',
            origen: 'propia',
            portada: true,
            storagePath: 'imagenes/img_1.jpg',
            // @ts-expect-error — un campo que el servidor podría agregar mañana
            optimizada: true,
          },
        ],
      }),
      CARGADO,
    );
    expect(d.imagenes[0]).not.toHaveProperty('optimizada');
    expect(d.imagenes[0]!.storagePath).toBe('imagenes/img_1.jpg');
  });
});

/**
 * **La lectura del build filtra en la query, no en memoria.**
 *
 * Es la misma atadura que B-903 le puso a librerías, y está acá desde el día uno
 * porque la tajada 3 hereda la constante y no la deuda. El daño de filtrar después
 * de leer es el mismo: el documento **entero** —con el `contactoDeQuienCargo` de
 * quien pidió el alta y con el precio crudo— pasa por el proceso de build y queda
 * en memoria del runner de CI.
 */
describe('la lectura del build no lee lo que no va a publicar', () => {
  const CONTENIDO = readFileSync(raiz('src/lib/contenidoDelSitio.ts'), 'utf8');

  it('control positivo: el archivo tiene la lectura de suscripciones', () => {
    expect(CONTENIDO).toContain('const suscripcionesPublicadas =');
    expect(CONTENIDO).toContain(".collection('suscripciones')");
  });

  it('la query lleva el `where`, y el estado sale de `ESTADO_PUBLICO` del motor', () => {
    /*
     * MUTACIÓN PROBADA: reemplazar el `.where(...)` por un `.filter(...)` sobre el
     * snapshot completo deja este caso en rojo.
     */
    const cuerpo = sinComentarios(CONTENIDO);
    const desde = cuerpo.indexOf('const suscripcionesPublicadas =');
    const lectura = cuerpo.slice(desde, cuerpo.indexOf('};', desde));
    expect(lectura, 'la lectura de suscripciones no filtra en la query').toContain(
      ".where('estado', '==', ESTADO_PUBLICO_DE_FICHA)",
    );
    expect(ESTADO_PUBLICO).toBe('publicado');
  });

  it('y no baja los campos que no va a publicar — `.select()`, D-159', () => {
    /*
     * La lista tiene que ser **la de `SuscripcionPublica`**: un campo que la
     * proyección publique y la query no traiga saldría vacío, en silencio.
     *
     * MUTACIÓN PROBADA: sacar `'envio'` del `.select()` deja este caso en rojo
     * nombrando el campo (y el efecto real sería un catálogo entero publicado como
     * si ninguna mandara libros).
     */
    const cuerpo = sinComentarios(CONTENIDO);
    const bloque = /const CAMPOS_DE_LA_PROYECCION_SUSCRIPCION = \[([\s\S]*?)\] as const;/.exec(cuerpo);
    expect(bloque, 'no se encontró `CAMPOS_DE_LA_PROYECCION_SUSCRIPCION`').not.toBeNull();
    const pedidos = [...bloque![1]!.matchAll(/'([^']+)'/g)].map((m) => m[1]!);

    expect(cuerpo, 'la query no usa `.select()`').toContain(
      '.select(...CAMPOS_DE_LA_PROYECCION_SUSCRIPCION)',
    );

    const proyeccion = readFileSync(raiz('src/lib/suscripcionPublica.ts'), 'utf8');
    const interfaz = /export interface SuscripcionPublica \{\n([\s\S]*?)\n\}/.exec(proyeccion);
    expect(interfaz, 'no se encontró `SuscripcionPublica`').not.toBeNull();
    const publicados = [...interfaz![1]!.matchAll(/^ {2}(\w+)\??:/gm)].map((m) => m[1]!);

    expect(publicados.length, 'no se leyó ningún campo de la proyección').toBeGreaterThan(10);
    expect(
      [...pedidos].sort(),
      'la query y la proyección dejaron de decir lo mismo: o se baja un campo de más ' +
        '(que entra al runner de CI sin publicarse) o falta uno que la ficha va a mostrar vacío',
    ).toEqual([...publicados].sort());
  });

  it('y la ficha con un slug que no es un slug se descarta en vez de tirar el build', () => {
    expect(sinComentarios(CONTENIDO)).toContain('esSlugDeFicha(s.slug)');
  });

  it('el rebuild de la Function cubre esta colección — trampa 8', () => {
    /*
     * La sexta de las nueve: sin el trigger se publica una ficha desde el panel y
     * el sitio estático **no la muestra nunca**. Acá el daño tiene una cara más:
     * el precio publicado se queda con su fecha vieja al lado, o sea afirmando algo
     * que ya no es cierto (DEC-12).
     *
     * MUTACIÓN PROBADA: sacar el `export { rebuildPorSuscripciones }` de
     * `functions/index.js` deja este caso en rojo.
     */
    const index = readFileSync(raiz('functions/index.js'), 'utf8');
    expect(index).toContain("export { rebuildPorSuscripciones } from './directorios-trigger.js';");
    const trigger = readFileSync(raiz('functions/directorios-trigger.js'), 'utf8');
    expect(trigger).toContain("document: 'suscripciones/{id}'");
    expect(trigger).toContain("marcarRebuild(getFirestore(), `suscripcion ${id}`)");
  });
});
