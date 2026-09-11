/**
 * La librería, del lado puro — B-831, PRD 2.
 *
 * Acá vive lo que se puede probar sin emuladores: el schema de zod, el armado
 * del documento, y **las ataduras con `firestore.rules`**, que son las que
 * importan más.
 *
 * ── Por qué las ataduras son el corazón de este archivo ───────────────────
 * El formulario de `/guia/librerias/sumar` lo va a completar un anónimo, así que
 * el schema de zod **no es la defensa**: se saltea con un `curl`. La defensa es
 * la regla. Los dos dicen los mismos números y los mismos vocabularios, y un
 * documento que pase por el schema y no por la regla **no se guarda** — con el
 * formulario diciendo que sí. Es la clase de B-88 en el peor lugar posible.
 *
 * `firestore.rules` es un runtime aparte y no puede importar TypeScript, así que
 * el único modo de atarlo es un test que lea el archivo y compare. Es el patrón
 * de `TOPE_TITULO_REPORTE` (B-364), el mismo que aplica `tests/propuestas.test.ts`.
 *
 * ── Y una atadura más, que `/propuestas` no necesitaba ────────────────────
 * El **ciclo de vida** de esta colección no es propio: es el de
 * `src/lib/directorios.ts` (B-834, el motor compartido). Los tres estados y el
 * grafo de transiciones están escritos allá **y** en la regla, así que son dos
 * derivaciones de la misma idea y se pueden separar sin que nada falle. Los
 * casos del final las comparan.
 *
 * Las reglas contra el emulador —qué rechaza cada cláusula, verificado por
 * mutación— están en `tests/librerias.integracion.test.ts`.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { sinComentarios } from '../scripts/sin-comentarios.mjs';
import { ESTADOS_DIRECTORIO, ESTADO_INICIAL, TRANSICIONES } from '@/lib/directorios';
import {
  RE_INSTAGRAM,
  RE_SLUG,
  RE_WHATSAPP,
  formALibreria,
  libreriaFormSchema,
  libreriaPublicaFormSchema,
  libreriaVacia,
  slugDeLibreria,
  soloDigitos,
} from '@/lib/libreria-schema';
import {
  CIUDAD_POR_DEFECTO,
  MAX_IMAGENES_LIBRERIA,
  MIN_CONTACTO_LIBRERIA,
  MIN_DIRECCION_LIBRERIA,
  MIN_MAIL_LIBRERIA,
  MIN_NOMBRE_LIBRERIA,
  MIN_NO_VACIO_LIBRERIA,
  ORIGENES_LIBRERIA,
  TOPE_BARRIO_LIBRERIA,
  TOPE_CIUDAD_LIBRERIA,
  TOPE_CONTACTO_LIBRERIA,
  TOPE_DESCRIPCION_LIBRERIA,
  TOPE_DIRECCION_LIBRERIA,
  TOPE_MAIL_LIBRERIA,
  TOPE_MOTIVO_LIBRERIA,
  TOPE_NOMBRE_LIBRERIA,
  TOPE_SEARCH_TEXT_LIBRERIA,
  TOPE_SLUG_LIBRERIA,
  TOPE_WEB_LIBRERIA,
  VIAS_CONTACTO_LIBRERIA,
} from '@/types/libreria';
import type { LibreriaForm } from '@/types/libreria';

const REGLAS = readFileSync(
  fileURLToPath(new URL('../firestore.rules', import.meta.url)),
  'utf8',
);

/**
 * El bloque de `/librerias` entero: sus helpers, `formaDeLibreria()`,
 * `libreriaValida()`, `libreriaActualizable()` y el `match`.
 *
 * **El ancla es el comentario de sección y no el nombre del primer helper**, por
 * lo que el `auditor-trampas` señaló en `tests/propuestas.test.ts`: con el nombre
 * de una función, un helper nuevo agregado **antes** de ésa —agrupar por tema,
 * ordenar alfabéticamente— quedaba afuera del recorte y de todo lo que este
 * archivo verifica, sin que nada lo dijera.
 *
 * **El bloque se lee SIN comentarios**, porque los docblocks de la regla citan
 * cláusulas para explicarlas y un barrido que los lea se agarra a sí mismo.
 */
const bloqueDeLibrerias = (): string => {
  const anclaje = REGLAS.indexOf('LIBRERÍAS — B-831');
  // El `/*` que abre el comentario de sección, **no** el texto del comentario:
  // recortar desde el medio de un bloque `/* … */` deja a `sinComentarios` sin
  // la apertura y se come el código que sigue.
  const i = anclaje === -1 ? -1 : REGLAS.lastIndexOf('/*', anclaje);
  /*
   * **El final es la sección siguiente, no el catch-all**, y esto no es
   * previsión: es lo que `bloqueDePropuestas` no tenía y que este mismo cambio
   * puso en rojo. `/librerias` es el primero de **tres** directorios, así que el
   * día que entre `/suscripciones` (B-832) este recorte se llevaría su bloque
   * puesto y compararía cotas ajenas.
   */
  const finDelBanner = REGLAS.indexOf('\n', anclaje);
  const siguienteSeccion = REGLAS.indexOf('══', finDelBanner);
  const catchAll = REGLAS.indexOf('match /{document=**}');
  const j =
    siguienteSeccion !== -1 && siguienteSeccion < catchAll
      ? REGLAS.lastIndexOf('/*', siguienteSeccion)
      : catchAll;
  if (i === -1 || j === -1 || j <= i) {
    throw new Error('no se encontró el bloque de /librerias en firestore.rules');
  }
  return sinComentarios(REGLAS.slice(i, j));
};

/** Todas las cotas de tamaño del bloque, sacadas del archivo: `[campo, op, n]`. */
const cotasDeLaRegla = (): [campo: string, op: string, n: number][] =>
  [...bloqueDeLibrerias().matchAll(/([\w.'()[\], ]+)\.size\(\) (<=|>=) (\d+)/g)].map((m) => [
    m[1]!.trim(),
    m[2]!,
    Number(m[3]!),
  ]);

const form = (over: Partial<LibreriaForm> = {}): LibreriaForm => ({
  ...libreriaVacia(),
  nombre: 'Librería Del Otro Lado',
  descripcion: 'Librería de barrio con mesa de novedades.',
  direccion: 'Thames 1762',
  barrio: 'villa-crespo',
  instagram: '@delotrolado',
  whatsapp: '+54 9 11 2222-3333',
  web: 'delotrolado.test',
  mail: 'hola@delotrolado.test',
  contactoDeQuienCargo: { via: 'mail', valor: 'quien.cargo@delotrolado.test' },
  ...over,
});

const valida = (over: Partial<LibreriaForm> = {}) => libreriaFormSchema.safeParse(form(over));
const rutas = (r: ReturnType<typeof valida>): string[] =>
  r.success ? [] : r.error.issues.map((i) => i.path.join('.'));

describe('los topes se dicen en dos runtimes y son el mismo número (B-364, clase de B-88)', () => {
  it('el bloque de la regla existe y tiene contenido', () => {
    // Control positivo: si el recorte fallara, los casos de abajo compararían
    // contra una cadena vacía y `toContain` sería falso para todo — o peor,
    // pasarían si alguien los escribiera al revés.
    const bloque = bloqueDeLibrerias();
    expect(bloque.length).toBeGreaterThan(1000);
    expect(bloque).toContain('function formaDeLibreria()');
    expect(bloque).toContain('match /librerias/{id}');
  });

  /**
   * **La comparación es exhaustiva, no una muestra.** Cada cota de la regla está
   * acá con la constante que le corresponde, y el aserto compara las **dos
   * listas completas**: una cota nueva en `firestore.rules` que nadie agregue acá
   * pone el test en rojo, que es lo contrario de lo que pasaba cuando la lista
   * era una muestra de ocho sobre veinticuatro (el hallazgo del
   * `auditor-trampas` en `/propuestas`).
   */
  it('todas las cotas de la regla salen de una constante del modelo', () => {
    const esperadas: [string, string, number][] = [
      ["c.get('valor', '')", '>=', MIN_CONTACTO_LIBRERIA],
      ["c.get('valor', '')", '<=', TOPE_CONTACTO_LIBRERIA],
      ['d.nombre', '>=', MIN_NOMBRE_LIBRERIA],
      ['d.nombre', '<=', TOPE_NOMBRE_LIBRERIA],
      ['d.slug', '<=', TOPE_SLUG_LIBRERIA],
      ['d.descripcion', '<=', TOPE_DESCRIPCION_LIBRERIA],
      ['d.imagenes', '<=', MAX_IMAGENES_LIBRERIA],
      ['d.direccion', '>=', MIN_DIRECCION_LIBRERIA],
      ['d.direccion', '<=', TOPE_DIRECCION_LIBRERIA],
      ['d.barrio', '<=', TOPE_BARRIO_LIBRERIA],
      ['d.ciudad', '>=', MIN_NO_VACIO_LIBRERIA],
      ['d.ciudad', '<=', TOPE_CIUDAD_LIBRERIA],
      ['d.web', '<=', TOPE_WEB_LIBRERIA],
      ['d.mail', '>=', MIN_MAIL_LIBRERIA],
      ['d.mail', '<=', TOPE_MAIL_LIBRERIA],
      ['d.searchText', '<=', TOPE_SEARCH_TEXT_LIBRERIA],
      ["d.revision.get('motivo', '')", '<=', TOPE_MOTIVO_LIBRERIA],
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
  it('los tres `matches` de la regla son los mismos patrones que el schema', () => {
    const bloque = bloqueDeLibrerias();
    expect(bloque, 'el alfabeto del slug').toContain(`'${RE_SLUG}'`);
    expect(bloque, 'el handle de Instagram').toContain(`'${RE_INSTAGRAM}'`);
    expect(bloque, 'los dígitos del WhatsApp').toContain(`'${RE_WHATSAPP}'`);
    // Y el barrio, que es el mismo alfabeto de slug: dos apariciones, no una.
    expect(bloque.split(`'${RE_SLUG}'`)).toHaveLength(3);
  });

  it('la web tiene que traer esquema http(s), y eso está en la regla y no solo en el saneador', () => {
    // `javascript:` en un `href` de una página indexada. Sin esta cláusula la
    // defensa la pone el consumidor y no el dato.
    expect(bloqueDeLibrerias()).toContain("'^https?://.*'");
  });

  /**
   * **Los campos del documento salen de `formALibreria`, no de una lista a
   * mano.** Un campo nuevo del modelo entra al barrido solo, que es lo que hace
   * que este aserto no envejezca.
   */
  it('el `hasOnly`/`hasAll` de la regla enumera exactamente los campos del documento', () => {
    const bloque = bloqueDeLibrerias();
    const delDocumento = [...Object.keys(formALibreria(form(), 'panel')), 'creadoEn'].sort();
    const obligatorios = bloque
      .slice(bloque.indexOf('let obligatorios = ['), bloque.indexOf('];', bloque.indexOf('let obligatorios = [')))
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
    const bloque = bloqueDeLibrerias();
    expect(ESTADOS_DIRECTORIO).toEqual(['pendiente', 'publicado', 'rechazado']);
    expect(bloque).toContain(`[${ESTADOS_DIRECTORIO.map((e) => `'${e}'`).join(', ')}]`);
    /*
     * `origen` **no** tiene un `in [...]` en la regla, y eso es una decisión que
     * la mutación forzó: era letra muerta. Su vocabulario lo fuerza la cláusula
     * de coherencia del `create` —que exige uno de los dos valores exactos según
     * quién escriba— y la inmutabilidad del `update`. Así que lo que se ata es
     * eso: los dos valores tienen que estar nombrados ahí.
     */
    for (const origen of ORIGENES_LIBRERIA) {
      expect(bloque, `el origen ${origen}`).toContain(`d.origen == '${origen}'`);
    }
    expect(bloque).toContain(`[${VIAS_CONTACTO_LIBRERIA.map((v) => `'${v}'`).join(', ')}]`);
  });

  it('el estado inicial que la regla fuerza es el del motor', () => {
    expect(bloqueDeLibrerias()).toContain(`d.estado == '${ESTADO_INICIAL}'`);
  });

  /**
   * **La única arista que le falta al grafo, derivada y no escrita a mano.**
   *
   * Si mañana `TRANSICIONES` prohibiera otra cosa, la regla se quedaría
   * defendiendo una sola arista y este caso lo dice. Y si el grafo se completara
   * —o sea si `rechazado → publicado` se permitiera—, también: la cláusula de la
   * regla quedaría de más, que es la otra dirección del mismo error.
   */
  it('la regla defiende exactamente la arista que `TRANSICIONES` no tiene', () => {
    const faltantes = ESTADOS_DIRECTORIO.flatMap((desde) =>
      ESTADOS_DIRECTORIO.filter(
        (hasta) => desde !== hasta && !TRANSICIONES[desde].includes(hasta),
      ).map((hasta) => [desde, hasta]),
    );
    expect(faltantes).toEqual([['rechazado', 'publicado']]);
    expect(bloqueDeLibrerias()).toContain(
      "previo.get('estado', '') != 'rechazado' || d.estado != 'publicado'",
    );
  });
});

describe('el schema — lo que se le avisa a quien completa antes de mandar', () => {
  it('una librería completa pasa', () => {
    // Control positivo: sin esto, «el schema rechaza X» podría querer decir que
    // rechaza todo.
    expect(valida().success).toBe(true);
  });

  it('el nombre y la dirección son obligatorios y tienen su piso', () => {
    expect(rutas(valida({ nombre: 'x' }))).toContain('nombre');
    expect(rutas(valida({ nombre: 'x'.repeat(TOPE_NOMBRE_LIBRERIA + 1) }))).toContain('nombre');
    expect(rutas(valida({ direccion: 'abc' }))).toContain('direccion');
    expect(rutas(valida({ direccion: 'x'.repeat(TOPE_DIRECCION_LIBRERIA + 1) }))).toContain(
      'direccion',
    );
  });

  it('un nombre que no produce ninguna dirección web se avisa en el slug — trampa 10', () => {
    // Una librería llamada «※» se guardaría con `slug: ''` y su página no
    // existiría. `slugDeFicha` devuelve vacío a propósito en vez de inventar una.
    expect(slugDeLibreria({ nombre: '※ ※', slug: '' })).toBe('');
    expect(rutas(valida({ nombre: '※ ※' }))).toContain('slug');
  });

  it('un slug tipeado a mano tiene que ser un slug', () => {
    expect(rutas(valida({ slug: 'Del Otro Lado' }))).toContain('slug');
    expect(valida({ slug: 'del-otro-lado-palermo' }).success).toBe(true);
    expect(rutas(valida({ slug: 'x'.repeat(TOPE_SLUG_LIBRERIA + 1) }))).toContain('slug');
  });

  it('el barrio es un slug de `/opciones/barrio`, el mismo que usan las actividades', () => {
    expect(rutas(valida({ barrio: 'Villa Crespo' }))).toContain('barrio');
    expect(rutas(valida({ barrio: '' }))).toContain('barrio');
    expect(valida({ barrio: 'villa-crespo' }).success).toBe(true);
  });

  it('los tres contactos que terminan en un `href` se validan con los saneadores del proyecto', () => {
    expect(rutas(valida({ instagram: 'delotrolado/otra' }))).toContain('instagram');
    expect(rutas(valida({ whatsapp: '1122' }))).toContain('whatsapp');
    expect(rutas(valida({ web: 'javascript:alert(1)' }))).toContain('web');
    expect(rutas(valida({ mail: 'no-es-un-mail' }))).toContain('mail');
    // Y las formas que la gente escribe de verdad sí pasan, que es la mitad que
    // hace que la validación no sea un muro.
    expect(valida({ instagram: 'https://instagram.com/delotrolado' }).success).toBe(true);
    expect(valida({ whatsapp: '+54 9 11 2222-3333' }).success).toBe(true);
    expect(valida({ web: 'delotrolado.test' }).success).toBe(true);
  });

  it('la geo va completa y dentro de rango, o no va', () => {
    expect(rutas(valida({ geo: { lat: '-34.6', lng: '' } }))).toContain('geo.lng');
    expect(rutas(valida({ geo: { lat: '200', lng: '-58.4' } }))).toContain('geo.lat');
    expect(rutas(valida({ geo: { lat: '-34.6', lng: '200' } }))).toContain('geo.lng');
    expect(valida({ geo: { lat: '-34.6', lng: '-58.4' } }).success).toBe(true);
    expect(valida({ geo: { lat: '', lng: '' } }).success).toBe(true);
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
    expect(
      rutas(
        valida({
          imagenes: Array.from({ length: MAX_IMAGENES_LIBRERIA + 1 }, (_, i) => imagen(i, i === 0)),
        }),
      ),
    ).toContain('imagenes');
    expect(valida({ imagenes: [imagen(0, true), imagen(1, false)] }).success).toBe(true);
    // Cero imágenes es válido: una ficha sin foto se publica igual.
    expect(valida({ imagenes: [] }).success).toBe(true);
  });

  /**
   * **La única diferencia entre las dos configuraciones del mismo formulario**
   * (§ 5 del PRD): quien carga desde afuera **no vuelve a entrar**, así que si la
   * ficha llega dudosa no hay forma de repreguntar.
   */
  it('el contacto de quien carga es obligatorio solo en el formulario público', () => {
    const sinContacto = form({ contactoDeQuienCargo: { via: 'mail', valor: '' } });
    expect(libreriaFormSchema.safeParse(sinContacto).success).toBe(true);
    const publico = libreriaPublicaFormSchema.safeParse(sinContacto);
    expect(publico.success).toBe(false);
    expect(rutas(publico as ReturnType<typeof valida>)).toContain('contactoDeQuienCargo.valor');
    // Y con contacto, el público pasa: si no, «obligatorio» podría querer decir
    // que ese formulario no acepta nada.
    expect(libreriaPublicaFormSchema.safeParse(form()).success).toBe(true);
  });

  it('un contacto demasiado corto no pasa ni en el del panel', () => {
    expect(rutas(valida({ contactoDeQuienCargo: { via: 'mail', valor: 'a' } }))).toContain(
      'contactoDeQuienCargo.valor',
    );
    expect(
      valida({ contactoDeQuienCargo: { via: 'mail', valor: 'x'.repeat(MIN_CONTACTO_LIBRERIA) } })
        .success,
    ).toBe(true);
  });
});

describe('el armado del documento — lo que se guarda es lo que se va a publicar', () => {
  it('normaliza los cuatro contactos públicos, que es de donde salen los links', () => {
    const d = formALibreria(form(), 'panel');
    expect(d.instagram).toBe('delotrolado');
    expect(d.whatsapp).toBe('5491122223333');
    expect(d.web).toBe('https://delotrolado.test/');
    expect(d.mail).toBe('hola@delotrolado.test');
    expect(soloDigitos('+54 9 11 2222-3333')).toBe('5491122223333');
  });

  it('`\'\'` se guarda como `null`, una sola forma de vacío', () => {
    // Es lo que le permite a la regla exigir `== null` en vez de aceptar dos
    // representaciones de lo mismo.
    const d = formALibreria(
      form({
        descripcion: '',
        instagram: '',
        whatsapp: '',
        web: '',
        mail: '',
        contactoDeQuienCargo: { via: 'mail', valor: '' },
      }),
      'panel',
    );
    expect(d.descripcion).toBeNull();
    expect(d.instagram).toBeNull();
    expect(d.whatsapp).toBeNull();
    expect(d.web).toBeNull();
    expect(d.mail).toBeNull();
    expect(d.contactoDeQuienCargo).toBeNull();
    expect(d.geo).toBeNull();
  });

  it('el estado y la revisión nacen como la regla los va a exigir', () => {
    const d = formALibreria(form(), 'formulario-publico');
    expect(d.estado).toBe(ESTADO_INICIAL);
    expect(d.origen).toBe('formulario-publico');
    expect(d.revision).toEqual({ porUid: null, en: null, motivo: null });
  });

  it('el `searchText` va normalizado (§6) y trae el barrio', () => {
    const d = formALibreria(form(), 'panel');
    expect(d.searchText).toContain('libreria del otro lado');
    expect(d.searchText).toContain('villa-crespo');
    // Sin acentos: es lo que hace que «Librería» matchee «libreria».
    expect(d.searchText).not.toMatch(/[áéíóúÁÉÍÓÚ]/);
    expect(d.searchText.length).toBeLessThanOrEqual(TOPE_SEARCH_TEXT_LIBRERIA);
  });

  it('la ciudad trae su default', () => {
    expect(formALibreria(form({ ciudad: '' }), 'panel').ciudad).toBe(CIUDAD_POR_DEFECTO);
    expect(libreriaVacia().ciudad).toBe(CIUDAD_POR_DEFECTO);
  });

  /**
   * **`contactoDeQuienCargo` es el campo que no puede salir**, y la primera
   * defensa es que el armado no lo confunda con los cuatro públicos: viven en el
   * mismo documento, que es justo la condición donde una proyección por spread
   * filtra un campo (§ 8 del PRD).
   */
  it('el contacto interno no se mezcla con los públicos', () => {
    const d = formALibreria(
      form({
        mail: 'hola@libreria.test',
        contactoDeQuienCargo: { via: 'instagram', valor: 'quien.cargo' },
      }),
      'formulario-publico',
    );
    expect(d.mail).toBe('hola@libreria.test');
    expect(d.contactoDeQuienCargo).toEqual({ via: 'instagram', valor: 'quien.cargo' });
  });

  it('las claves de cada imagen se enumeran, no se spreadean', () => {
    // B-206 #2: así un campo que escriba el servidor no puede viajar de vuelta
    // por el formulario, que es como `calendarEventId` se pisaba.
    const d = formALibreria(
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
      'panel',
    );
    expect(d.imagenes[0]).not.toHaveProperty('optimizada');
    expect(d.imagenes[0]!.storagePath).toBe('imagenes/img_1.jpg');
  });
});
