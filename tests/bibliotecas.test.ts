/**
 * La biblioteca, del lado puro — B-960, el cuarto directorio.
 *
 * Acá vive lo que se puede probar sin emuladores: el schema de zod, el armado
 * del documento, y **las ataduras con `firestore.rules`**, que son las que
 * importan más.
 *
 * ── Por qué las ataduras son el corazón de este archivo ───────────────────
 * El formulario de `/guia/bibliotecas/sumar` lo va a completar un anónimo, así
 * que el schema de zod **no es la defensa**: se saltea con un `curl`. La defensa
 * es la regla. Los dos dicen los mismos números y los mismos vocabularios, y un
 * documento que pase por el schema y no por la regla **no se guarda** — con el
 * formulario diciendo que sí. Es la clase de B-88 en el peor lugar posible.
 *
 * `firestore.rules` es un runtime aparte y no puede importar TypeScript, así que
 * el único modo de atarlo es un test que lea el archivo y compare. Es el patrón
 * de `TOPE_TITULO_REPORTE` (B-364), el mismo que aplican `tests/librerias.test.ts`
 * y `tests/propuestas.test.ts`.
 *
 * ── Y la atadura del ciclo de vida ────────────────────────────────────────
 * El ciclo de vida de esta colección no es propio: es el de
 * `src/lib/directorios.ts` (B-834, el motor compartido). Los tres estados y el
 * grafo de transiciones están escritos allá **y** en la regla, así que son dos
 * derivaciones de la misma idea y se pueden separar sin que nada falle.
 *
 * Las reglas contra el emulador —qué rechaza cada cláusula, verificado por
 * mutación— están en `tests/bibliotecas.integracion.test.ts`.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { sinComentarios } from '../scripts/sin-comentarios.mjs';
import {
  ESTADOS_DIRECTORIO,
  ESTADO_INICIAL,
  TRANSICIONES,
} from '@/lib/directorios';
import {
  RE_INSTAGRAM,
  RE_SLUG,
  RE_WHATSAPP,
  bibliotecaFormSchema,
  bibliotecaPublicaFormSchema,
  bibliotecaVacia,
  costoDeAsociarseCambio,
  costoDeAsociarseDelForm,
  formABiblioteca,
  slugDeBiblioteca,
  soloDigitos,
} from '@/lib/biblioteca-schema';
import {
  CIUDAD_POR_DEFECTO,
  MAX_IMAGENES_BIBLIOTECA,
  MIN_CONTACTO_BIBLIOTECA,
  MIN_DIRECCION_BIBLIOTECA,
  MIN_MAIL_BIBLIOTECA,
  MIN_NOMBRE_BIBLIOTECA,
  ORIGENES_BIBLIOTECA,
  TOPE_BARRIO_BIBLIOTECA,
  TOPE_CATALOGO_BIBLIOTECA,
  TOPE_CIUDAD_BIBLIOTECA,
  TOPE_CONTACTO_BIBLIOTECA,
  TOPE_COSTO_DE_ASOCIARSE_BIBLIOTECA,
  TOPE_DESCRIPCION_BIBLIOTECA,
  TOPE_DIRECCION_BIBLIOTECA,
  TOPE_HORARIO_DE_SALA_BIBLIOTECA,
  TOPE_HORARIOS_BIBLIOTECA,
  TOPE_MAIL_BIBLIOTECA,
  TOPE_MOTIVO_BIBLIOTECA,
  TOPE_NOMBRE_BIBLIOTECA,
  TOPE_PROVINCIA_BIBLIOTECA,
  TOPE_SEARCH_TEXT_BIBLIOTECA,
  TOPE_SLUG_BIBLIOTECA,
  TOPE_TIPO_BIBLIOTECA,
  TOPE_WEB_BIBLIOTECA,
  VIAS_CONTACTO_BIBLIOTECA,
} from '@/types/biblioteca';
import type { BibliotecaForm } from '@/types/biblioteca';
import type { TimestampLike } from '@/types/actividad';

/** Un archivo del repo, desde la raíz. */
const raiz = (rel: string) => fileURLToPath(new URL(`../${rel}`, import.meta.url));

const REGLAS = readFileSync(raiz('firestore.rules'), 'utf8');

/**
 * El bloque de `/bibliotecas` entero: sus helpers, `formaDeBiblioteca()`,
 * `bibliotecaValida()`, `bibliotecaActualizable()` y el `match`.
 *
 * **El ancla es el comentario de sección y no el nombre del primer helper**, por
 * lo que el `auditor-trampas` señaló en `tests/propuestas.test.ts`: con el
 * nombre de una función, un helper nuevo agregado **antes** de ésa quedaba
 * afuera del recorte y de todo lo que este archivo verifica, sin que nada lo
 * dijera.
 *
 * **El bloque se lee SIN comentarios**, porque los docblocks de la regla citan
 * cláusulas para explicarlas y un barrido que los lea se agarra a sí mismo.
 *
 * El final es el catch-all porque hoy ésta es la **última** sección del archivo.
 * Si mañana entra un quinto directorio debajo, el corte tiene que pasar a la
 * sección siguiente como ya hace `bloqueDeLibrerias` — que es exactamente el
 * bug que aquél tenía antes de ser el primero de tres.
 */
const bloqueDeBibliotecas = (): string => {
  const anclaje = REGLAS.indexOf('BIBLIOTECAS — B-960');
  // El `/*` que abre el comentario de sección, **no** el texto del comentario:
  // recortar desde el medio de un bloque `/* … */` deja a `sinComentarios` sin
  // la apertura y se come el código que sigue.
  const i = anclaje === -1 ? -1 : REGLAS.lastIndexOf('/*', anclaje);
  const finDelBanner = REGLAS.indexOf('\n', anclaje);
  const siguienteSeccion = REGLAS.indexOf('══', finDelBanner);
  const catchAll = REGLAS.indexOf('match /{document=**}');
  const j =
    siguienteSeccion !== -1 && siguienteSeccion < catchAll
      ? REGLAS.lastIndexOf('/*', siguienteSeccion)
      : catchAll;
  if (i === -1 || j === -1 || j <= i) {
    throw new Error('no se encontró el bloque de /bibliotecas en firestore.rules');
  }
  return sinComentarios(REGLAS.slice(i, j));
};

/** Todas las cotas de tamaño del bloque, sacadas del archivo: `[campo, op, n]`. */
const cotasDeLaRegla = (): [campo: string, op: string, n: number][] =>
  [...bloqueDeBibliotecas().matchAll(/([\w.'()[\], ]+)\.size\(\) (<=|>=) (\d+)/g)].map((m) => [
    m[1]!.trim(),
    m[2]!,
    Number(m[3]!),
  ]);

/** Un `Timestamp` de mentira: lo único que se le pide es `toDate()`. */
const cuando = (iso: string): TimestampLike =>
  ({ toDate: () => new Date(iso) }) as unknown as TimestampLike;

const form = (over: Partial<BibliotecaForm> = {}): BibliotecaForm => ({
  ...bibliotecaVacia(),
  nombre: 'Biblioteca Popular Alberdi',
  descripcion: 'Biblioteca de barrio con sala de lectura y hemeroteca.',
  tipo: 'popular',
  direccion: 'Talcahuano 1261',
  barrio: 'recoleta',
  horarios: 'Lun a vie de 9 a 20',
  horarioDeSala: 'Lun a vie de 14 a 19',
  asociarse: { haceFalta: true, costo: '$3.000 por año' },
  catalogo: 'catalogo.alberdi.test',
  instagram: '@bpalberdi',
  whatsapp: '+54 9 11 2222-3333',
  web: 'alberdi.test',
  mail: 'hola@alberdi.test',
  contactoDeQuienCargo: { via: 'mail', valor: 'quien.cargo@alberdi.test' },
  ...over,
});

const valida = (over: Partial<BibliotecaForm> = {}) => bibliotecaFormSchema.safeParse(form(over));
const rutas = (r: ReturnType<typeof valida>): string[] =>
  r.success ? [] : r.error.issues.map((i) => i.path.join('.'));

/** El documento que sale del formulario, con una fecha fija para el costo. */
const doc = (over: Partial<BibliotecaForm> = {}) =>
  formABiblioteca(form(over), cuando('2026-09-17T12:00:00Z'), 'panel');

describe('los topes se dicen en dos runtimes y son el mismo número (B-364, clase de B-88)', () => {
  it('el bloque de la regla existe y tiene contenido', () => {
    // Control positivo: si el recorte fallara, los casos de abajo compararían
    // contra una cadena vacía y `toContain` sería falso para todo — o peor,
    // pasarían si alguien los escribiera al revés.
    const bloque = bloqueDeBibliotecas();
    expect(bloque.length).toBeGreaterThan(1000);
    expect(bloque).toContain('function formaDeBiblioteca()');
    expect(bloque).toContain('match /bibliotecas/{id}');
  });

  /**
   * **La comparación es exhaustiva, no una muestra.** Cada cota de la regla está
   * acá con la constante que le corresponde, y el aserto compara las **dos
   * listas completas**: una cota nueva en `firestore.rules` que nadie agregue acá
   * pone el test en rojo, que es lo contrario de lo que pasaba cuando la lista
   * era una muestra (el hallazgo del `auditor-trampas` en `/propuestas`).
   */
  it('todas las cotas de la regla salen de una constante del modelo', () => {
    const esperadas: [string, string, number][] = [
      ['a.costo.valor', '>=', 1],
      ['a.costo.valor', '<=', TOPE_COSTO_DE_ASOCIARSE_BIBLIOTECA],
      ['c.valor', '>=', MIN_CONTACTO_BIBLIOTECA],
      ['c.valor', '<=', TOPE_CONTACTO_BIBLIOTECA],
      ['d.nombre', '>=', MIN_NOMBRE_BIBLIOTECA],
      ['d.nombre', '<=', TOPE_NOMBRE_BIBLIOTECA],
      ['d.slug', '<=', TOPE_SLUG_BIBLIOTECA],
      ['d.descripcion', '<=', TOPE_DESCRIPCION_BIBLIOTECA],
      ['d.tipo', '<=', TOPE_TIPO_BIBLIOTECA],
      ['d.horarios', '<=', TOPE_HORARIOS_BIBLIOTECA],
      ['d.horarioDeSala', '<=', TOPE_HORARIO_DE_SALA_BIBLIOTECA],
      ['d.catalogo', '<=', TOPE_CATALOGO_BIBLIOTECA],
      ['d.imagenes', '<=', MAX_IMAGENES_BIBLIOTECA],
      ['d.direccion', '>=', MIN_DIRECCION_BIBLIOTECA],
      ['d.direccion', '<=', TOPE_DIRECCION_BIBLIOTECA],
      ['d.barrio', '<=', TOPE_BARRIO_BIBLIOTECA],
      // `d.ciudad` no tiene `>= 1`: ganó el `matches`, cuyo `+` ya exige un
      // carácter, que es la poda que el resto de la regla ya tenía. Y admite
      // `''` porque la cascada pide **una** de las dos según la provincia.
      ['d.ciudad', '<=', TOPE_CIUDAD_BIBLIOTECA],
      ['d.provincia', '<=', TOPE_PROVINCIA_BIBLIOTECA],
      ['d.web', '<=', TOPE_WEB_BIBLIOTECA],
      ['d.mail', '>=', MIN_MAIL_BIBLIOTECA],
      ['d.mail', '<=', TOPE_MAIL_BIBLIOTECA],
      ['d.searchText', '<=', TOPE_SEARCH_TEXT_BIBLIOTECA],
      ["d.revision.get('motivo', '')", '<=', TOPE_MOTIVO_BIBLIOTECA],
    ];
    expect(cotasDeLaRegla().sort()).toEqual(esperadas.sort());
  });

  /**
   * **Los tres patrones, comparados por su fuente y no por su efecto.**
   *
   * El schema los exporta como cadena justamente para esto: si acá se comparara
   * «un slug con mayúsculas lo rechazan los dos», la comparación seguiría en
   * verde el día que uno de los dos acepte algo que el otro no.
   */
  it('los `matches` de la regla son los mismos patrones que el schema', () => {
    const bloque = bloqueDeBibliotecas();
    expect(bloque, 'el alfabeto del slug').toContain(`'${RE_SLUG}'`);
    expect(bloque, 'el handle de Instagram').toContain(`'${RE_INSTAGRAM}'`);
    expect(bloque, 'los dígitos del WhatsApp').toContain(`'${RE_WHATSAPP}'`);
    /*
     * **Cinco apariciones del alfabeto de slug**: el de la URL, los tres de la
     * geografía y el del `tipo`, que es el que esta entidad suma. Con `toContain`
     * sola, borrar el `matches` del tipo no habría movido nada.
     */
    expect(bloque.split(`'${RE_SLUG}'`)).toHaveLength(6);
  });

  it('la web y el catálogo traen esquema http(s), y eso está en la regla y no solo en el saneador', () => {
    // `javascript:` en un `href` de una página indexada. Sin esta cláusula la
    // defensa la pone el consumidor y no el dato. **Son dos**: el catálogo es
    // una URL más que termina en un `href`, y es el campo nuevo de esta entidad.
    expect(bloqueDeBibliotecas().split("'^https?://.*'")).toHaveLength(3);
  });

  /**
   * **Los campos del documento salen de `formABiblioteca`, no de una lista a
   * mano.** Un campo nuevo del modelo entra al barrido solo, que es lo que hace
   * que este aserto no envejezca.
   */
  it('el `hasOnly`/`hasAll` de la regla enumera exactamente los campos del documento', () => {
    const bloque = bloqueDeBibliotecas();
    const delDocumento = [...Object.keys(doc()), 'creadoEn'].sort();
    const inicio = bloque.indexOf('let obligatorios = [');
    const obligatorios = bloque
      .slice(inicio, bloque.indexOf('];', inicio))
      .match(/'[a-zA-Z]+'/g)!
      .map((s) => s.replaceAll("'", ''))
      .sort();
    expect(obligatorios).toEqual(delDocumento);
    // Y el opcional va en `hasOnly` y **no** en `hasAll`: lo escribiría un
    // trigger con el Admin SDK, así que hoy está ausente en todos los documentos.
    expect(obligatorios).not.toContain('publicadaAlgunaVez');
    expect(bloque).toContain("hasOnly(obligatorios.concat(['publicadaAlgunaVez']))");
    expect(bloque).toContain('hasAll(obligatorios)');
  });
});

describe('el ciclo de vida de la regla es el del motor compartido (B-834)', () => {
  it('los tres estados y los dos orígenes son los mismos vocabularios', () => {
    const bloque = bloqueDeBibliotecas();
    expect(ESTADOS_DIRECTORIO).toEqual(['pendiente', 'publicado', 'rechazado']);
    expect(bloque).toContain(`[${ESTADOS_DIRECTORIO.map((e) => `'${e}'`).join(', ')}]`);
    /*
     * `origen` **no** tiene un `in [...]` en la regla, por lo mismo que en
     * librerías: era letra muerta. Su vocabulario lo fuerza la cláusula de
     * coherencia del `create` y la inmutabilidad del `update`, así que lo que se
     * ata es eso: los dos valores tienen que estar nombrados ahí.
     */
    for (const origen of ORIGENES_BIBLIOTECA) {
      expect(bloque, `el origen ${origen}`).toContain(`d.origen == '${origen}'`);
    }
    expect(bloque).toContain(`[${VIAS_CONTACTO_BIBLIOTECA.map((v) => `'${v}'`).join(', ')}]`);
  });

  it('el estado inicial que la regla fuerza es el del motor', () => {
    expect(bloqueDeBibliotecas()).toContain(`d.estado == '${ESTADO_INICIAL}'`);
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
    expect(bloqueDeBibliotecas()).toContain(
      "previo.get('estado', '') != 'rechazado' || d.estado != 'publicado'",
    );
  });
});

describe('el costo de asociarse — DEC-12 / B-837, y es lo único que no se copió', () => {
  it('un costo sobre un «no hace falta» lo rechazan el schema Y la regla', () => {
    /*
     * Las dos mitades, porque son dos runtimes: el schema se lo dice a quien
     * mira la pantalla y la regla se lo dice al `curl`. Si solo estuviera el
     * schema, un documento con la contradicción entraría por la puerta de atrás.
     */
    expect(rutas(valida({ asociarse: { haceFalta: false, costo: '$3.000' } }))).toContain(
      'asociarse.costo',
    );
    expect(bloqueDeBibliotecas()).toContain('a.haceFalta == true');
  });

  it('el error se marca sobre el costo y no sobre el flag — la lección de B-923', () => {
    // Marcar el campo que la persona dejó como quería se lee como un bug del
    // sistema. El valor de más es el costo, así que ahí va el error.
    expect(rutas(valida({ asociarse: { haceFalta: false, costo: '$3.000' } }))).not.toContain(
      'asociarse.haceFalta',
    );
  });

  it('saber que hace falta sin saber cuánto es válido: es la ficha que llega de afuera', () => {
    expect(valida({ asociarse: { haceFalta: true, costo: '' } }).success).toBe(true);
    expect(doc({ asociarse: { haceFalta: true, costo: '' } }).asociarse).toEqual({
      haceFalta: true,
      costo: null,
    });
  });

  it('sin costo no hay fecha: un `cargadoEn` suelto no fecha nada', () => {
    expect(costoDeAsociarseDelForm(form({ asociarse: { haceFalta: true, costo: '' } }), cuando('2026-09-17T12:00:00Z'))).toBeNull();
    expect(
      costoDeAsociarseDelForm(
        form({ asociarse: { haceFalta: false, costo: '$3.000' } }),
        cuando('2026-09-17T12:00:00Z'),
      ),
    ).toBeNull();
  });

  /**
   * **La fecha se mueve solo si el valor se movió.** Las dos mitades importan:
   * corregir un typo de la descripción no puede refechar el costo —publicaría
   * que el número es más fresco de lo que es— y cambiar el número sí.
   */
  it('`costoDeAsociarseCambio` compara el valor y no el objeto', () => {
    const viejo = { valor: '$3.000 por año', cargadoEn: cuando('2026-07-01T00:00:00Z') };
    const mismoValorOtraFecha = { valor: '$3.000 por año', cargadoEn: cuando('2026-09-17T00:00:00Z') };
    const otroValor = { valor: '$5.000 por año', cargadoEn: cuando('2026-07-01T00:00:00Z') };
    expect(costoDeAsociarseCambio(viejo, mismoValorOtraFecha)).toBe(false);
    expect(costoDeAsociarseCambio(viejo, otroValor)).toBe(true);
    // Y los dos bordes: aparecer y desaparecer son cambios.
    expect(costoDeAsociarseCambio(null, otroValor)).toBe(true);
    expect(costoDeAsociarseCambio(viejo, null)).toBe(true);
  });

  it('la regla exige la hora del servidor al crear, y las dos formas legales al editar', () => {
    const bloque = bloqueDeBibliotecas();
    expect(bloque).toContain('d.asociarse.costo.cargadoEn == request.time');
    expect(bloque).toContain('d.asociarse.costo.valor == previo.asociarse.costo.valor');
    expect(bloque).toContain(
      'd.asociarse.costo.cargadoEn == previo.asociarse.costo.cargadoEn',
    );
  });

  it('el costo es texto y no un entero, al revés que el precio de una suscripción', () => {
    // El carnet casi nunca es un número solo, y como no entra a ningún filtro
    // (regla 2 de `datoConFecha.ts`) el entero no compraba nada.
    expect(bloqueDeBibliotecas()).toContain('a.costo.valor is string');
    expect(doc().asociarse.costo!.valor).toBe('$3.000 por año');
  });
});

describe('el schema — lo que se le avisa a quien completa antes de mandar', () => {
  it('una biblioteca completa pasa', () => {
    // Control positivo: sin esto, «el schema rechaza X» podría querer decir que
    // rechaza todo.
    expect(valida().success).toBe(true);
  });

  it('el nombre y la dirección son obligatorios y tienen su piso', () => {
    expect(rutas(valida({ nombre: 'x' }))).toContain('nombre');
    expect(rutas(valida({ nombre: 'x'.repeat(TOPE_NOMBRE_BIBLIOTECA + 1) }))).toContain('nombre');
    expect(rutas(valida({ direccion: 'abc' }))).toContain('direccion');
    expect(rutas(valida({ direccion: 'x'.repeat(TOPE_DIRECCION_BIBLIOTECA + 1) }))).toContain(
      'direccion',
    );
  });

  it('los dos horarios y el tipo son opcionales: una ficha sin ellos se publica igual', () => {
    expect(valida({ horarios: '', horarioDeSala: '', tipo: '' }).success).toBe(true);
  });

  it('el tipo tiene que ser un slug de la taxonomía, no lo que se tipeó', () => {
    // Con mayúsculas o espacios no resuelve su etiqueta, y el chip del filtro no
    // lo encuentra.
    expect(rutas(valida({ tipo: 'Biblioteca Popular' }))).toContain('tipo');
    expect(valida({ tipo: 'popular' }).success).toBe(true);
  });

  it('el catálogo pasa por el mismo saneador que la web', () => {
    expect(rutas(valida({ catalogo: 'javascript:alert(1)' }))).toContain('catalogo');
    /*
     * Y se guarda **con esquema y normalizada por `urlSegura`** —de ahí la barra
     * final—: lo que se guarda es lo que se publica, así que ningún consumidor
     * tiene que volver a normalizarla (la clase de B-88).
     */
    expect(doc({ catalogo: 'catalogo.alberdi.test' }).catalogo).toBe(
      'https://catalogo.alberdi.test/',
    );
    expect(doc({ catalogo: '' }).catalogo).toBeNull();
  });

  it('la provincia se exige y tiene que ser una de las 24 (B-972)', () => {
    expect(rutas(valida({ provincia: '' }))).toContain('provincia');
    expect(rutas(valida({ provincia: 'cordoba-capital' }))).toContain('provincia');
    expect(valida({ provincia: 'cordoba', barrio: '', ciudad: 'rosario' }).success).toBe(true);
  });

  it('el slug se deriva del nombre, y lo tipeado no se slugifica', () => {
    expect(slugDeBiblioteca({ nombre: 'Biblioteca Popular Alberdi', slug: '' })).toBe(
      'biblioteca-popular-alberdi',
    );
    // Lo tipeado se respeta tal cual, y si está mal se avisa en vez de
    // reescribirlo en silencio: el slug queda congelado al publicar (trampa 10).
    expect(rutas(valida({ slug: 'Alberdi Recoleta' }))).toContain('slug');
    // Un nombre de puros signos no produce ninguna dirección.
    expect(rutas(valida({ nombre: '※※', slug: '' }))).toContain('slug');
  });

  it('los contactos públicos se guardan normalizados: lo que se guarda es lo que se publica', () => {
    const d = doc();
    expect(d.instagram).toBe('bpalberdi');
    expect(d.whatsapp).toBe(soloDigitos('+54 9 11 2222-3333'));
    expect(d.web).toBe('https://alberdi.test/');
    expect(d.mail).toBe('hola@alberdi.test');
  });

  it('el contacto interno es obligatorio del lado público y opcional del lado del panel', () => {
    const sinContacto = form({ contactoDeQuienCargo: { via: 'mail', valor: '' } });
    expect(bibliotecaFormSchema.safeParse(sinContacto).success).toBe(true);
    const publico = bibliotecaPublicaFormSchema.safeParse(sinContacto);
    expect(publico.success).toBe(false);
    expect(
      publico.success ? [] : publico.error.issues.map((i) => i.path.join('.')),
    ).toContain('contactoDeQuienCargo.valor');
    expect(rutas(valida({ contactoDeQuienCargo: { via: 'mail', valor: 'ab' } }))).toContain(
      'contactoDeQuienCargo.valor',
    );
    expect(MIN_CONTACTO_BIBLIOTECA).toBe(3);
  });

  it('la galería pide exactamente una portada, y hasta el techo compartido', () => {
    const imagen = (id: string, portada = false) => ({
      id: `img_${id}`,
      url: 'https://ejemplo.test/f.jpg',
      epigrafe: '',
      origen: 'externa' as const,
      portada,
    });
    expect(rutas(valida({ imagenes: [imagen('a'), imagen('b')] }))).toContain('imagenes');
    expect(rutas(valida({ imagenes: [imagen('a', true), imagen('b', true)] }))).toContain(
      'imagenes',
    );
    expect(valida({ imagenes: [imagen('a', true), imagen('b')] }).success).toBe(true);
    // Cero imágenes es válido: una ficha sin foto se publica igual.
    expect(valida({ imagenes: [] }).success).toBe(true);
  });

  it('`geo` va con los dos o con ninguno, y dentro del rango', () => {
    expect(rutas(valida({ geo: { lat: '-34.6', lng: '' } }))).toContain('geo.lng');
    expect(rutas(valida({ geo: { lat: '200', lng: '-58.4' } }))).toContain('geo.lat');
    expect(valida({ geo: { lat: '-34.6', lng: '-58.4' } }).success).toBe(true);
    expect(doc({ geo: { lat: '', lng: '' } }).geo).toBeNull();
  });
});

describe('el armado del documento', () => {
  it('lo opcional vacío se guarda como null: la ausencia se representa una sola vez', () => {
    const d = doc({
      descripcion: '',
      horarios: '',
      horarioDeSala: '',
      catalogo: '',
      mail: '',
      contactoDeQuienCargo: { via: 'mail', valor: '' },
    });
    expect(d.descripcion).toBeNull();
    expect(d.horarios).toBeNull();
    expect(d.horarioDeSala).toBeNull();
    expect(d.catalogo).toBeNull();
    expect(d.mail).toBeNull();
    expect(d.contactoDeQuienCargo).toBeNull();
  });

  it('nace `pendiente` y sin revisión, que es lo que la regla va a exigir igual', () => {
    const d = doc();
    expect(d.estado).toBe(ESTADO_INICIAL);
    expect(d.revision).toEqual({ porUid: null, en: null, motivo: null });
  });

  it('la ciudad por defecto es el slug de CABA y la geografía se normaliza', () => {
    expect(doc().ciudad).toBe(CIUDAD_POR_DEFECTO);
    // Los alias de CABA colapsan al slug canónico en vez de crear una segunda.
    expect(doc({ ciudad: 'Ciudad de Buenos Aires' }).ciudad).toBe(CIUDAD_POR_DEFECTO);
  });

  /**
   * **El `searchText` del documento sale de la misma función que el publicado.**
   *
   * Es la mitad que hace que el buscador del panel y el del sitio digan lo
   * mismo. La otra mitad —que lo publicado se derive y no se copie— vive en
   * `tests/biblioteca-publica.test.ts`, que es donde importa contra un anónimo.
   */
  it('el `searchText` indexa los slugs de las dos formas: «villa crespo» encuentra `villa-crespo`', () => {
    const d = doc({ barrio: 'villa-crespo', tipo: 'popular' });
    expect(d.searchText).toContain('villa-crespo');
    expect(d.searchText).toContain('villa crespo');
    expect(d.searchText).toContain('popular');
    // Y normalizado: «Crónica» matchea «cronica».
    expect(doc({ nombre: 'Biblioteca Crónica' }).searchText).toContain('cronica');
  });
});
