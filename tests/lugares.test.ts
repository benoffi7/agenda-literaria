/**
 * El lugar para eventos, del lado puro — B-833, PRD 4.
 *
 * Acá vive lo que se puede probar sin emuladores: el schema de zod, el armado del
 * documento, y **las ataduras con `firestore.rules`**, que son las que importan
 * más.
 *
 * ── Por qué las ataduras son el corazón de este archivo ───────────────────
 * El formulario de `/guia/lugares/sumar` lo va a completar un anónimo, así que el
 * schema de zod **no es la defensa**: se saltea con un `curl`. La defensa es la
 * regla. Los dos dicen los mismos números y los mismos vocabularios, y un
 * documento que pase por el schema y no por la regla **no se guarda** — con el
 * formulario diciendo que sí.
 *
 * ── Y dos ataduras que ninguno de los otros dos directorios necesitaba ────
 * 1. **`TIPOS_SIN_DIRECCION_PUBLICA`** (§ 6). La regla no puede importar
 *    TypeScript, así que los dos lados dicen `'casa'` y este archivo los compara.
 *    Es el mismo trato que `cargarLabels` y los topes de `/reportes`, aplicado al
 *    dato más sensible del proyecto.
 * 2. **El `searchText` sin la dirección.** No hay regla que lo pueda verificar
 *    —desde `firestore.rules` no se puede mirar adentro de una cadena derivada—,
 *    así que lo sostiene `formALugar` y lo fija un caso de acá.
 *
 * Las reglas contra el emulador —qué rechaza cada cláusula, verificado por
 * mutación— están en `tests/lugares.integracion.test.ts`.
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
  RE_INSTAGRAM_LUGAR,
  RE_SLUG_LUGAR,
  RE_WEB_LUGAR,
  RE_WHATSAPP_LUGAR,
  formALugar,
  lugarFormSchema,
  lugarPublicoFormSchema,
  lugarVacio,
  precioCambio,
  precioDelForm,
  puedePublicarLaDireccion,
  slugDeLugar,
  soloDigitos,
} from '@/lib/lugar-schema';
import {
  MAX_CAPACIDAD_LUGAR,
  MAX_IMAGENES_LUGAR,
  MAX_INCLUYE_LUGAR,
  MAX_PRECIO_LUGAR,
  MIN_CAPACIDAD_LUGAR,
  MIN_CIUDAD_LUGAR,
  MIN_CONTACTO_LUGAR,
  MIN_DIRECCION_LUGAR,
  MIN_MAIL_LUGAR,
  MIN_NOMBRE_LUGAR,
  MIN_PRECIO_LUGAR,
  ORIGENES_LUGAR,
  TIPOS_SIN_DIRECCION_PUBLICA,
  TOPE_CAPACIDAD_NOTAS_LUGAR,
  TOPE_CIUDAD_LUGAR,
  TOPE_CONDICION_NOTAS_LUGAR,
  TOPE_CONTACTO_LUGAR,
  TOPE_DESCRIPCION_LUGAR,
  TOPE_DIRECCION_LUGAR,
  TOPE_MAIL_LUGAR,
  TOPE_MOTIVO_LUGAR,
  TOPE_NOMBRE_LUGAR,
  TOPE_OTRO_LUGAR,
  TOPE_SEARCH_TEXT_LUGAR,
  TOPE_SLUG_LUGAR,
  TOPE_SLUG_TAXONOMIA_LUGAR,
  TOPE_WEB_LUGAR,
  UNIDADES_DE_PRECIO_LUGAR,
  VIAS_CONTACTO_LUGAR,
  direccionPublicaPorDefecto,
} from '@/types/lugar';
import { ts } from './fixtures/tiempo';
import type { LugarForm } from '@/types/lugar';

/** Un archivo del repo, desde la raíz. */
const raiz = (rel: string) => fileURLToPath(new URL(`../${rel}`, import.meta.url));

const REGLAS = readFileSync(raiz('firestore.rules'), 'utf8');

/**
 * El bloque de `/lugares` entero: sus helpers, `formaDeLugar()`,
 * `lugarDeGuiaValido()`, `lugarDeGuiaActualizable()` y el `match`.
 *
 * **El ancla es el comentario de sección y no el nombre del primer helper**, por
 * lo que el `auditor-trampas` señaló en `tests/propuestas.test.ts`: con el nombre
 * de una función, un helper nuevo agregado **antes** de ésa quedaba afuera del
 * recorte y de todo lo que este archivo verifica, sin que nada lo dijera.
 *
 * **El bloque se lee SIN comentarios**, porque los docblocks de la regla citan
 * cláusulas para explicarlas y un barrido que los lea se agarra a sí mismo.
 */
const bloqueDeLugares = (): string => {
  const anclaje = REGLAS.indexOf('LUGARES PARA EVENTOS — B-833');
  const i = anclaje === -1 ? -1 : REGLAS.lastIndexOf('/*', anclaje);
  /*
   * El final es la sección siguiente si la hay, y si no el catch-all — la misma
   * forma que `bloqueDeLibrerias` y `bloqueDeSuscripciones`, que es lo que hizo
   * que cada bloque no se comiera al anterior.
   */
  const finDelBanner = REGLAS.indexOf('\n', anclaje);
  const siguienteSeccion = REGLAS.indexOf('══', finDelBanner);
  const catchAll = REGLAS.indexOf('match /{document=**}');
  const j =
    siguienteSeccion !== -1 && siguienteSeccion < catchAll
      ? REGLAS.lastIndexOf('/*', siguienteSeccion)
      : catchAll;
  if (i === -1 || j === -1 || j <= i) {
    throw new Error('no se encontró el bloque de /lugares en firestore.rules');
  }
  return sinComentarios(REGLAS.slice(i, j));
};

/** Todas las cotas de tamaño del bloque, sacadas del archivo: `[campo, op, n]`. */
const cotasDeLaRegla = (): [campo: string, op: string, n: number][] =>
  [...bloqueDeLugares().matchAll(/([\w.'()[\], ]+)\.size\(\) (<=|>=) (\d+)/g)].map((m) => [
    m[1]!.trim(),
    m[2]!,
    Number(m[3]!),
  ]);

const form = (over: Partial<LugarForm> = {}): LugarForm => ({
  ...lugarVacio(),
  nombre: 'El Salón del Fondo',
  descripcion: 'Un salón con mesa larga y patio, atrás del café.',
  tipo: 'cafe',
  direccion: 'Honduras 4321',
  barrio: 'palermo',
  ciudad: 'Ciudad de Buenos Aires',
  geo: { lat: '-34.5875', lng: '-58.4306' },
  direccionPublica: true,
  capacidad: '30',
  capacidadNotas: 'Sentados 20, de pie 35',
  incluye: ['mesa-larga', 'patio'],
  incluyeOtro: 'Una biblioteca de la casa',
  condicion: 'con-consumicion',
  precio: { monto: '25000', porUnidad: 'hora' },
  condicionNotas: 'Mínimo de consumición $8000 por persona',
  instagram: '@elsalondelfondo',
  whatsapp: '+54 9 11 2222-3333',
  mail: 'hola@elsalon.test',
  web: 'https://elsalon.test',
  contactoDeQuienCargo: { via: 'mail', valor: 'quien.cargo@elsalon.test' },
  ...over,
});

const CARGADO = ts('2026-09-11T15:00:00Z');

const valida = (over: Partial<LugarForm> = {}) => lugarFormSchema.safeParse(form(over));
const rutas = (r: ReturnType<typeof valida>): string[] =>
  r.success ? [] : r.error.issues.map((i) => i.path.join('.'));

describe('los topes se dicen en dos runtimes y son el mismo número (B-364, clase de B-88)', () => {
  it('el bloque de la regla existe y tiene contenido', () => {
    // Control positivo: si el recorte fallara, los casos de abajo compararían
    // contra una cadena vacía y `toContain` sería falso para todo.
    const bloque = bloqueDeLugares();
    expect(bloque.length).toBeGreaterThan(1000);
    expect(bloque).toContain('function formaDeLugar()');
    expect(bloque).toContain('match /lugares/{id}');
  });

  /**
   * **La comparación es exhaustiva, no una muestra.** Cada cota de la regla está
   * acá con la constante que le corresponde, y el aserto compara las **dos listas
   * completas**: una cota nueva en `firestore.rules` que nadie agregue acá pone el
   * test en rojo.
   */
  it('todas las cotas de la regla salen de una constante del modelo', () => {
    const esperadas: [string, string, number][] = [
      ["c.get('valor', '')", '>=', MIN_CONTACTO_LUGAR],
      ["c.get('valor', '')", '<=', TOPE_CONTACTO_LUGAR],
      ['d.nombre', '>=', MIN_NOMBRE_LUGAR],
      ['d.nombre', '<=', TOPE_NOMBRE_LUGAR],
      ['d.slug', '<=', TOPE_SLUG_LUGAR],
      ['d.descripcion', '<=', TOPE_DESCRIPCION_LUGAR],
      ['d.imagenes', '<=', MAX_IMAGENES_LUGAR],
      ['d.tipo', '<=', TOPE_SLUG_TAXONOMIA_LUGAR],
      ['d.direccion', '>=', MIN_DIRECCION_LUGAR],
      ['d.direccion', '<=', TOPE_DIRECCION_LUGAR],
      ['d.barrio', '<=', TOPE_SLUG_TAXONOMIA_LUGAR],
      ['d.ciudad', '>=', MIN_CIUDAD_LUGAR],
      ['d.ciudad', '<=', TOPE_CIUDAD_LUGAR],
      ['d.capacidadNotas', '<=', TOPE_CAPACIDAD_NOTAS_LUGAR],
      ['d.incluye', '<=', MAX_INCLUYE_LUGAR],
      ['d.incluyeOtro', '<=', TOPE_OTRO_LUGAR],
      ['d.condicion', '<=', TOPE_SLUG_TAXONOMIA_LUGAR],
      ['d.condicionNotas', '<=', TOPE_CONDICION_NOTAS_LUGAR],
      ['d.mail', '>=', MIN_MAIL_LUGAR],
      ['d.mail', '<=', TOPE_MAIL_LUGAR],
      ['d.web', '<=', TOPE_WEB_LUGAR],
      ['d.searchText', '<=', TOPE_SEARCH_TEXT_LUGAR],
      ["d.revision.get('motivo', '')", '<=', TOPE_MOTIVO_LUGAR],
    ];
    expect(cotasDeLaRegla().sort()).toEqual(esperadas.sort());
  });

  /**
   * Las cotas **numéricas** no se comparan con `.size()`, así que el barrido de
   * arriba no las ve: van acá, una por una. Son las dos que este modelo tiene: el
   * precio y la capacidad.
   */
  it('las cotas de los dos números también salen del modelo', () => {
    const bloque = bloqueDeLugares();
    expect(bloque).toContain(`p.valor.monto >= ${MIN_PRECIO_LUGAR}`);
    expect(bloque).toContain(`p.valor.monto <= ${MAX_PRECIO_LUGAR}`);
    expect(bloque).toContain(`d.get('capacidad', 0) >= ${MIN_CAPACIDAD_LUGAR}`);
    expect(bloque).toContain(`d.get('capacidad', 0) <= ${MAX_CAPACIDAD_LUGAR}`);
  });

  /**
   * **Los patrones, comparados por su fuente y no por su efecto.**
   *
   * El schema los exporta como cadena justamente para esto: si acá se comparara
   * «un slug con mayúsculas lo rechazan los dos», la comparación seguiría en
   * verde el día que uno de los dos acepte algo que el otro no.
   */
  it('los `matches` de la regla son los mismos patrones que el schema', () => {
    const bloque = bloqueDeLugares();
    expect(bloque, 'el alfabeto del slug').toContain(`'${RE_SLUG_LUGAR}'`);
    expect(bloque, 'el handle de Instagram').toContain(`'${RE_INSTAGRAM_LUGAR}'`);
    expect(bloque, 'los dígitos del WhatsApp').toContain(`'${RE_WHATSAPP_LUGAR}'`);
    expect(bloque, 'la web').toContain(`'${RE_WEB_LUGAR}'`);
    // El alfabeto de slug lo usan **cuatro** campos: la ficha, el tipo de lugar,
    // el barrio y la condición.
    expect(bloque.split(`'${RE_SLUG_LUGAR}'`).length - 1).toBe(4);
  });

  it('la web acepta `http://`, al revés que el link de cobro de una suscripción', () => {
    /*
     * Es una diferencia deliberada entre dos colecciones y este caso la fija: la
     * `web` de un lugar lleva a una página institucional que puede ser vieja; el
     * `linkDeSuscripcion` lleva a una página de **cobro**. Si alguien «unifica»
     * los dos patrones, se cae uno de los dos casos.
     */
    const bloque = bloqueDeLugares();
    expect(bloque).toContain("'^https?://.*'");
    expect(bloque, 'la web de un lugar no es un destino de cobro').not.toContain("'^https://.*'");
  });

  /**
   * **Los campos del documento salen de `formALugar`, no de una lista a mano.**
   * Un campo nuevo del modelo entra al barrido solo.
   */
  it('el `hasOnly`/`hasAll` de la regla enumera exactamente los campos del documento', () => {
    const bloque = bloqueDeLugares();
    const delDocumento = [...Object.keys(formALugar(form(), CARGADO, 'panel')), 'creadoEn'].sort();
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

  it('las cuatro unidades de precio de la regla son las del modelo', () => {
    /*
     * La única cota de todo `firestore.rules` que enumera un vocabulario **cerrado
     * en el código** y no una taxonomía: `UNIDADES_DE_PRECIO_LUGAR` no vive en
     * `/opciones/*`, así que los dos lados escriben los cuatro valores y este caso
     * los compara.
     *
     * MUTACIÓN PROBADA: agregar `'dia'` a `UNIDADES_DE_PRECIO_LUGAR` sin tocar la
     * regla deja este caso en rojo — y el efecto real sería un precio que el
     * formulario deja elegir y la regla rechaza, con el panel diciendo «no se pudo
     * guardar» sin decir por qué.
     */
    const enLaRegla = `[${UNIDADES_DE_PRECIO_LUGAR.map((u) => `'${u}'`).join(', ')}]`;
    expect(bloqueDeLugares()).toContain(`p.valor.porUnidad in ${enLaRegla}`);
  });
});

describe('el ciclo de vida de la regla es el del motor compartido (B-834)', () => {
  it('los tres estados y los dos orígenes son los mismos vocabularios', () => {
    const bloque = bloqueDeLugares();
    expect(bloque).toContain(`[${ESTADOS_DIRECTORIO.map((e) => `'${e}'`).join(', ')}]`);
    for (const origen of ORIGENES_LUGAR) {
      expect(bloque, `el origen ${origen}`).toContain(`d.origen == '${origen}'`);
    }
    expect(bloque).toContain(`[${VIAS_CONTACTO_LUGAR.map((v) => `'${v}'`).join(', ')}]`);
  });

  it('el estado inicial que la regla fuerza es el del motor', () => {
    expect(bloqueDeLugares()).toContain(`d.estado == '${ESTADO_INICIAL}'`);
  });

  /**
   * **La única arista que le falta al grafo, derivada y no escrita a mano.**
   */
  it('la regla defiende exactamente la arista que `TRANSICIONES` no tiene', () => {
    const faltantes = ESTADOS_DIRECTORIO.flatMap((desde) =>
      ESTADOS_DIRECTORIO.filter(
        (hasta) => desde !== hasta && !TRANSICIONES[desde].includes(hasta),
      ).map((hasta) => [desde, hasta]),
    );
    expect(faltantes).toEqual([['rechazado', 'publicado']]);
    expect(bloqueDeLugares()).toContain(
      "previo.get('estado', '') != 'rechazado' || d.estado != 'publicado'",
    );
  });

  it('la fecha del precio la estampa el servidor, y no se mueve si el precio no se movió', () => {
    /*
     * La misma cláusula que en `/suscripciones` (DEC-12), acá por B-837. Sin ella
     * la frase «$25.000 por hora · cargado el 24 de septiembre» se fabrica desde el
     * cliente y el mecanismo entero deja de afirmar nada.
     *
     * MUTACIÓN PROBADA: sacar cualquiera de las dos cláusulas deja este caso en
     * rojo nombrando cuál.
     */
    const bloque = bloqueDeLugares();
    expect(bloque, 'al crear, el precio no nace con la fecha del servidor').toContain(
      "d.get('precio', null) == null || d.precio.cargadoEn == request.time",
    );
    expect(bloque, 'al editar, la fecha se puede mover sin que cambie el precio').toContain(
      'd.precio.valor == previo.precio.valor',
    );
    expect(bloque).toContain('d.precio.cargadoEn == previo.precio.cargadoEn');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// § 6 · el domicilio particular
// ───────────────────────────────────────────────────────────────────────────

describe('el default de la dirección lo decide el tipo — § 6 del PRD 4', () => {
  it('⚠️ la cláusula de la regla NO nombra ningún tipo: sería una lista negra', () => {
    /*
     * **El hallazgo del `auditor-privacidad`.** La primera versión de esta
     * cláusula decía `d.tipo != 'casa' || …`, o sea una lista negra de **un**
     * elemento sobre un vocabulario **abierto**: `tipo` sale de
     * `/opciones/tipo-lugar`, que acepta «Otro», y la regla solo puede acotar su
     * forma. `ph`, `mi-living`, `casa-de-familia` o `domicilio-particular` la
     * pasaban con el flag prendido y publicaban la dirección de una casa.
     *
     * Hoy la cláusula mira **solo el origen**: del camino público la dirección
     * nunca nace publicada, sea cual sea el tipo. Un admin sí puede prenderla
     * —puede haber pedido permiso, y es la única forma legítima—, y por eso la
     * cláusula mira el `origen` y no prohíbe a secas.
     *
     * MUTACIÓN PROBADA: volver a la versión con `d.tipo != 'casa'` deja este caso
     * en rojo, y el de `tests/lugares.integracion.test.ts` que carga un `ph`
     * desde el camino público.
     */
    const bloque = bloqueDeLugares();
    expect(bloque).toContain("d.origen != 'formulario-publico' || d.direccionPublica == false");
    expect(
      bloque,
      'la regla volvió a mirar el tipo: es una lista negra sobre un vocabulario abierto',
    ).not.toMatch(/d\.tipo !=/);
  });

  it('el tipo decide el default DEL PANEL, que es otra cosa y sí es una lista', () => {
    /*
     * `TIPOS_SIN_DIRECCION_PUBLICA` no desapareció: cambió de trabajo. Ya no
     * defiende nada del lado que no se puede saltear —eso lo hace el origen— y
     * sigue siendo lo que apaga la casilla en el formulario, que es donde hay
     * alguien mirando. Una lista incompleta ahí cuesta un cartel que no aparece,
     * no una dirección publicada.
     *
     * **Lo que esta lista no puede prometer**, y está dicho en su docblock: cubrir
     * un tipo que alguien tipee con «Otro». Ahí el default vuelve a ser publicar y
     * quien revisa la ficha en la bandeja es el que lo ve.
     */
    expect(TIPOS_SIN_DIRECCION_PUBLICA).toContain('casa');
    expect(direccionPublicaPorDefecto('casa')).toBe(false);
    expect(direccionPublicaPorDefecto('cafe')).toBe(true);
    // Un tipo inventado se lleva el default permisivo, y eso es lo que la regla
    // cubre desde el otro lado.
    expect(direccionPublicaPorDefecto('ph')).toBe(true);
  });

  it('el default por tipo es el mismo en el modelo y en el schema', () => {
    expect(direccionPublicaPorDefecto('cafe')).toBe(true);
    expect(direccionPublicaPorDefecto('casa')).toBe(false);
    // La condición que usa el formulario **es la misma** que usa el schema: si se
    // separan, el formulario esconde una decisión que el schema exige.
    expect(puedePublicarLaDireccion('casa')).toBe(direccionPublicaPorDefecto('casa'));
    expect(puedePublicarLaDireccion('cafe')).toBe(direccionPublicaPorDefecto('cafe'));
  });

  it('⚠️ el schema NO bloquea al admin que publica la dirección de una casa', () => {
    /*
     * **El hallazgo del `auditor-privacidad`.** La primera versión emitía un error
     * acá, y eso **cerraba el único camino legítimo**: un admin que sí pidió
     * permiso a quien vive ahí no podía guardar — mientras cuatro docblocks, la
     * ayuda del panel y un caso de integración decían que podía. Fallaba cerrada,
     * así que no filtraba nada; lo caro era el próximo cambio, cuando el arreglo
     * obvio fuera aflojar la capa que no correspondía.
     *
     * El aviso vive donde hay alguien mirando —el formulario— y no frena.
     *
     * MUTACIÓN PROBADA: volver a emitir el issue deja este caso en rojo.
     */
    expect(rutas(valida({ tipo: 'casa', direccionPublica: true }))).toEqual([]);
    expect(rutas(valida({ tipo: 'casa', direccionPublica: false, direccion: '' }))).toEqual([]);
  });

  it('y el aviso vive en el formulario, a la vista y sin frenar', () => {
    /*
     * La otra mitad del hallazgo: sacar el bloqueo sin poner el aviso dejaría la
     * decisión más delicada del proyecto sin nada que la señale.
     *
     * MUTACIÓN PROBADA: borrar el bloque del aviso de `LugarFormulario.tsx` deja
     * este caso en rojo.
     */
    const formulario = readFileSync(raiz('src/components/admin/LugarFormulario.tsx'), 'utf8');
    expect(formulario).toContain('form.direccionPublica && !admiteDireccionPublica');
    expect(formulario).toContain('domicilio particular');
    // `role="status"` y no `role="alert"`: es un cartel, no un error.
    expect(formulario).toContain('role="status"');
  });

  it('`formALugar` fuerza el flag en `false` en TODO el camino público', () => {
    /*
     * **Criterio 3 del PRD**, y la mitad que el cliente no puede saltear la pone la
     * regla. Acá se fija que el armado no depende de que el formulario se haya
     * acordado de apagar la casilla — **ni del tipo de lugar**, que es lo que el
     * `auditor-privacidad` corrigió: con la condición mirando el tipo, un `ph`
     * cargado desde afuera publicaba la dirección.
     *
     * MUTACIÓN PROBADA: devolver `f.direccionPublica` tal cual —o volver a
     * condicionarlo por tipo— deja este caso en rojo.
     */
    for (const tipo of ['casa', 'cafe', 'ph', 'mi-living']) {
      const f = form({ tipo, direccionPublica: true });
      expect(
        formALugar(f, CARGADO, 'formulario-publico').direccionPublica,
        `el tipo «${tipo}» publicó la dirección desde el camino público`,
      ).toBe(false);
      // Del panel sí, porque puede haber permiso y hay alguien mirando.
      expect(formALugar(f, CARGADO, 'panel').direccionPublica).toBe(true);
    }
  });

  it('la dirección se GUARDA igual aunque no se publique: el admin la necesita', () => {
    /*
     * Es la forma de `online.url` con `urlPublica` (D-15) y **no** la de `envio`
     * con `manda` (B-832), y la diferencia es para qué sirve el dato: la dirección
     * de un lugar es lo que el admin necesita para poder contestar «¿dónde
     * queda?». Lo que la protege es que la proyección no la publica.
     */
    const doc = formALugar(
      form({ tipo: 'casa', direccionPublica: true }),
      CARGADO,
      'formulario-publico',
    );
    expect(doc.direccionPublica).toBe(false);
    expect(doc.direccion).toBe('Honduras 4321');
    expect(doc.geo).toEqual({ lat: -34.5875, lng: -58.4306 });
  });

  it('⚠️ la dirección NO entra al `searchText`, que es un campo que se publica', () => {
    /*
     * **La mitad más fácil de olvidar de toda la tajada**, y la que ninguna regla
     * puede verificar: desde `firestore.rules` no se puede mirar adentro de una
     * cadena derivada.
     *
     * El `searchText` viaja en `/lugares.json` para que el listado filtre en
     * memoria (§2.5). Meter la dirección ahí la publicaría por una puerta que
     * ningún flag gatea — y peor: se deriva **al escribir**, así que quedaría
     * publicada aunque después alguien apague la casilla.
     *
     * `librerias.ts` sí la mete, y ahí es correcto: la dirección de un local
     * comercial es pública por definición y no tiene flag. Acá no.
     *
     * MUTACIÓN PROBADA: agregar `direccion` al `join` del `searchText` deja este
     * caso en rojo, con el flag prendido y con el flag apagado.
     */
    for (const origen of ORIGENES_LUGAR) {
      const doc = formALugar(form(), CARGADO, origen);
      expect(doc.searchText, `con origen ${origen}`).not.toContain('honduras');
      expect(doc.searchText).not.toContain('4321');
    }
    // Control positivo: lo que **sí** entra, entra. Sin esto el caso pasaría en
    // verde con un `searchText` vacío.
    const doc = formALugar(form(), CARGADO, 'panel');
    expect(doc.searchText).toContain('salon del fondo');
    expect(doc.searchText).toContain('palermo');
    expect(doc.searchText).toContain('sentados 20');
  });

  it('y el precio tampoco entra al `searchText`: el buscador es un filtro', () => {
    const doc = formALugar(form(), CARGADO, 'panel');
    expect(doc.searchText).not.toContain('25000');
  });
});

describe('el schema — lo que se le avisa a quien completa antes de mandar', () => {
  it('un lugar completo pasa', () => {
    expect(rutas(valida())).toEqual([]);
  });

  it('el nombre, el tipo y la condición son obligatorios', () => {
    expect(rutas(valida({ nombre: '' }))).toContain('nombre');
    expect(rutas(valida({ tipo: '' }))).toContain('tipo');
    expect(rutas(valida({ condicion: '' }))).toContain('condicion');
    expect(rutas(valida({ barrio: '' }))).toContain('barrio');
  });

  it('**la condición es obligatoria y el precio no** — § 5 del PRD', () => {
    /*
     * El hallazgo del pedido: «no sé si todos cobran, o le dicen que tienen que
     * consumir». Lo que siempre se puede decir es *qué tipo de arreglo es*, así
     * que el campo que no puede faltar es ése y no el número.
     */
    expect(rutas(valida({ precio: { monto: '', porUnidad: '' } }))).toEqual([]);
    expect(rutas(valida({ condicion: '' }))).toContain('condicion');
  });

  it('la dirección es opcional, y obligatoria solo si se va a publicar', () => {
    /*
     * Al revés que en una librería, y es el § 6: un lugar puede ser la casa de
     * alguien, y ahí la dirección no se va a publicar — exigirla sería pedir el
     * dato más sensible del proyecto para guardarlo y no usarlo.
     *
     * La otra mitad cierra el par en la otra dirección: publicar un campo vacío no
     * es publicar nada, pero deja la ficha diciendo que da la dirección cuando no
     * la da.
     */
    expect(rutas(valida({ tipo: 'casa', direccionPublica: false, direccion: '' }))).toEqual([]);
    expect(rutas(valida({ direccion: '', direccionPublica: true }))).toContain('direccion');
    expect(rutas(valida({ direccion: 'a-' }))).toContain('direccion');
  });

  it('un nombre que no produce ninguna dirección web se avisa en el slug — trampa 10', () => {
    expect(rutas(valida({ nombre: '※※', slug: '' }))).toContain('slug');
    expect(slugDeLugar({ nombre: 'El Salón del Fondo', slug: '' })).toBe('el-salon-del-fondo');
    // Lo tipeado NO se slugifica: reescribir en silencio un valor que queda
    // congelado al publicar es la trampa 10 con disfraz.
    expect(slugDeLugar({ nombre: 'x', slug: 'Mayús' })).toBe('Mayús');
    expect(rutas(valida({ slug: 'Mayús' }))).toContain('slug');
  });

  it('los cuatro vocabularios guardan slugs, y lo que no lo es se avisa', () => {
    expect(rutas(valida({ tipo: 'Café' }))).toContain('tipo');
    expect(rutas(valida({ barrio: 'Villa Crespo' }))).toContain('barrio');
    expect(rutas(valida({ condicion: 'Con Consumición' }))).toContain('condicion');
    expect(rutas(valida({ incluye: ['Mesa Larga'] }))).toContain('incluye');
  });

  it('`incluye` tiene tope, que es lo que la regla no puede iterar', () => {
    const muchos = Array.from({ length: MAX_INCLUYE_LUGAR + 1 }, (_, i) => `cosa-${i}`);
    expect(rutas(valida({ incluye: muchos }))).toContain('incluye');
  });

  it('la capacidad es un entero en rango, o nada — § 9', () => {
    expect(rutas(valida({ capacidad: '' }))).toEqual([]);
    expect(rutas(valida({ capacidad: '0' }))).toContain('capacidad');
    expect(rutas(valida({ capacidad: '99999' }))).toContain('capacidad');
    expect(rutas(valida({ capacidad: '12.5' }))).toContain('capacidad');
    expect(rutas(valida({ capacidad: '12' }))).toEqual([]);
  });

  it('el precio va con su unidad, o no va — B-837', () => {
    expect(rutas(valida({ precio: { monto: '25000', porUnidad: '' } }))).toContain('precio.porUnidad');
    expect(rutas(valida({ precio: { monto: '', porUnidad: 'hora' } }))).toContain('precio.monto');
    expect(rutas(valida({ precio: { monto: '25000.5', porUnidad: 'hora' } }))).toContain('precio.monto');
    expect(rutas(valida({ precio: { monto: '25000', porUnidad: 'por-luna-llena' } }))).toContain(
      'precio.porUnidad',
    );
  });

  it('`geo` va completa o no va, y dentro del rango', () => {
    expect(rutas(valida({ geo: { lat: '-34.5', lng: '' } }))).toContain('geo.lng');
    expect(rutas(valida({ geo: { lat: '200', lng: '-58' } }))).toContain('geo.lat');
    expect(rutas(valida({ geo: { lat: '', lng: '' } }))).toEqual([]);
  });

  it('los cuatro contactos se validan con los saneadores del proyecto', () => {
    expect(rutas(valida({ instagram: 'cuenta/otra' }))).toContain('instagram');
    expect(rutas(valida({ whatsapp: '123' }))).toContain('whatsapp');
    expect(rutas(valida({ mail: 'no es un mail' }))).toContain('mail');
    expect(rutas(valida({ web: 'javascript:alert(1)' }))).toContain('web');
    expect(soloDigitos('+54 9 11 2222-3333')).toBe('5491122223333');
  });

  it('la galería lleva exactamente una portada, y hasta el tope de imágenes', () => {
    const img = (id: string, portada: boolean) => ({
      id: `img_${id}`,
      url: 'https://ok.example/x.jpg',
      epigrafe: '',
      origen: 'externa' as const,
      portada,
    });
    expect(rutas(valida({ imagenes: [img('a', false), img('b', false)] }))).toContain('imagenes');
    expect(rutas(valida({ imagenes: [img('a', true), img('b', true)] }))).toContain('imagenes');
    expect(rutas(valida({ imagenes: [img('a', true), img('b', false)] }))).toEqual([]);
    expect(rutas(valida({ imagenes: [] }))).toEqual([]);
  });

  it('el contacto de quien carga es obligatorio solo en el formulario público', () => {
    const sinContacto = form({ contactoDeQuienCargo: { via: 'mail', valor: '' } });
    expect(lugarFormSchema.safeParse(sinContacto).success).toBe(true);
    const publico = lugarPublicoFormSchema.safeParse(sinContacto);
    expect(publico.success).toBe(false);
    expect(
      publico.success ? [] : publico.error.issues.map((i) => i.path.join('.')),
    ).toContain('contactoDeQuienCargo.valor');
  });
});

describe('el armado del documento — lo que se guarda es lo que se va a publicar', () => {
  it('normaliza los contactos y la web, que es de donde salen los `href`', () => {
    const doc = formALugar(form(), CARGADO, 'panel');
    expect(doc.instagram).toBe('elsalondelfondo');
    expect(doc.whatsapp).toBe('5491122223333');
    expect(doc.web).toBe('https://elsalon.test/');
  });

  it("`''` se guarda como `null`, una sola forma de vacío", () => {
    const doc = formALugar(
      form({
        descripcion: '',
        direccion: '',
        direccionPublica: false,
        capacidadNotas: '',
        incluyeOtro: '',
        condicionNotas: '',
        instagram: '',
        whatsapp: '',
        mail: '',
        web: '',
        contactoDeQuienCargo: { via: 'mail', valor: '' },
      }),
      CARGADO,
      'panel',
    );
    for (const campo of [
      'descripcion',
      'direccion',
      'capacidadNotas',
      'incluyeOtro',
      'condicionNotas',
      'instagram',
      'whatsapp',
      'mail',
      'web',
      'contactoDeQuienCargo',
    ] as const) {
      expect(doc[campo], `${campo} no quedó en null`).toBeNull();
    }
  });

  it('la capacidad vacía es `null` y no `0`: «no lo sé» es una respuesta', () => {
    expect(formALugar(form({ capacidad: '' }), CARGADO, 'panel').capacidad).toBeNull();
    expect(formALugar(form({ capacidad: '30' }), CARGADO, 'panel').capacidad).toBe(30);
  });

  it('el precio se guarda con la fecha que le pasan, y nunca con una del formulario', () => {
    const doc = formALugar(form(), CARGADO, 'panel');
    expect(doc.precio).toEqual({ valor: { monto: 25000, porUnidad: 'hora' }, cargadoEn: CARGADO });
    expect(precioDelForm(form({ precio: { monto: '', porUnidad: 'hora' } }), CARGADO)).toBeNull();
    expect(
      precioDelForm(form({ precio: { monto: '25000', porUnidad: 'inventada' } }), CARGADO),
    ).toBeNull();
  });

  it('`precioCambio` mira el valor y no el objeto: corregir un typo no refecha', () => {
    /*
     * Las dos mitades de la misma decisión (B-837): corregir la descripción no
     * mueve la fecha del precio, y cambiar el número sí.
     */
    const previo = { valor: { monto: 25000, porUnidad: 'hora' as const }, cargadoEn: CARGADO };
    const otraFecha = { valor: { monto: 25000, porUnidad: 'hora' as const }, cargadoEn: ts('2027-01-01T00:00:00Z') };
    expect(precioCambio(previo, otraFecha)).toBe(false);
    expect(
      precioCambio(previo, { valor: { monto: 30000, porUnidad: 'hora' }, cargadoEn: CARGADO }),
    ).toBe(true);
    expect(
      precioCambio(previo, { valor: { monto: 25000, porUnidad: 'evento' }, cargadoEn: CARGADO }),
    ).toBe(true);
    expect(precioCambio(previo, null)).toBe(true);
    expect(precioCambio(null, null)).toBe(false);
  });

  it('el estado y la revisión nacen como la regla los va a exigir', () => {
    const doc = formALugar(form(), CARGADO, 'formulario-publico');
    expect(doc.estado).toBe(ESTADO_INICIAL);
    expect(doc.origen).toBe('formulario-publico');
    expect(doc.revision).toEqual({ porUid: null, en: null, motivo: null });
  });

  it('las claves de cada imagen se enumeran, no se spreadean', () => {
    /*
     * B-206 #2: así un campo que escriba el servidor no puede viajar de vuelta por
     * el formulario.
     */
    const doc = formALugar(
      form({
        imagenes: [
          {
            id: 'img_x',
            url: 'https://ok.example/x.jpg',
            epigrafe: 'pie',
            origen: 'propia',
            storagePath: 'imagenes/x.jpg',
            ancho: 10,
            alto: 20,
            portada: true,
            // @ts-expect-error — un campo que el servidor escribe y que el
            // formulario no puede devolver.
            optimizada: true,
          },
        ],
      }),
      CARGADO,
      'panel',
    );
    expect(doc.imagenes[0]).not.toHaveProperty('optimizada');
    expect(Object.keys(doc.imagenes[0]!).sort()).toEqual([
      'alto',
      'ancho',
      'epigrafe',
      'id',
      'origen',
      'portada',
      'storagePath',
      'url',
    ]);
  });
});

/**
 * **La lectura del build filtra en la query, no en memoria.**
 *
 * Es la misma atadura que B-903 le puso a librerías y la tajada 3 heredó. El daño
 * de filtrar después de leer es el mismo y acá tiene una cara más: el documento
 * **entero** —con el `contactoDeQuienCargo` de quien pidió el alta **y con la
 * dirección de una casa cuyo flag está apagado**— pasa por el proceso de build y
 * queda en memoria del runner de CI.
 */
describe('la lectura del build no lee lo que no va a publicar', () => {
  const CONTENIDO = readFileSync(raiz('src/lib/contenidoDelSitio.ts'), 'utf8');

  it('control positivo: el archivo tiene la lectura de lugares', () => {
    expect(CONTENIDO).toContain('const lugaresPublicados =');
    expect(CONTENIDO).toContain(".collection('lugares')");
  });

  it('la query lleva el `where`, y el estado sale de `ESTADO_PUBLICO` del motor', () => {
    /*
     * MUTACIÓN PROBADA: reemplazar el `.where(...)` por un `.filter(...)` sobre el
     * snapshot completo deja este caso en rojo.
     */
    const cuerpo = sinComentarios(CONTENIDO);
    const desde = cuerpo.indexOf('const lugaresPublicados =');
    const lectura = cuerpo.slice(desde, cuerpo.indexOf('};', desde));
    expect(lectura, 'la lectura de lugares no filtra en la query').toContain(
      ".where('estado', '==', ESTADO_PUBLICO_DE_FICHA)",
    );
    expect(ESTADO_PUBLICO).toBe('publicado');
  });

  it('y no baja los campos que no va a publicar — `.select()`, D-159', () => {
    /*
     * **Acá la lista NO es «las claves de la proyección»**, que es lo que sí pasa
     * en las otras dos colecciones: `LugarPublico` tiene dos claves que no son
     * campos del documento (`donde`, que son cinco, y `costo`, que es derivado).
     *
     * Con un `.select()` copiado de las claves de la proyección, el build pediría
     * `donde` y `costo` —que no existen— y **no pediría la dirección ni el flag**:
     * la ficha saldría sin dirección para todos. La correspondencia se declara acá
     * y se compara campo por campo, que es la única forma de que esta asimetría no
     * se convierta en un olvido.
     *
     * MUTACIÓN PROBADA: sacar `'direccionPublica'` del `.select()` deja este caso
     * en rojo — y el efecto real sería el contrario del anterior: el flag llegaría
     * `undefined`, `dondeQueSale` fallaría cerrada y **ninguna** ficha publicaría
     * su dirección.
     */
    const cuerpo = sinComentarios(CONTENIDO);
    const bloque = /const CAMPOS_DE_LA_PROYECCION_LUGAR = \[([\s\S]*?)\] as const;/.exec(cuerpo);
    expect(bloque, 'no se encontró `CAMPOS_DE_LA_PROYECCION_LUGAR`').not.toBeNull();
    const pedidos = [...bloque![1]!.matchAll(/'([^']+)'/g)].map((m) => m[1]!);

    expect(cuerpo, 'la query no usa `.select()`').toContain(
      '.select(...CAMPOS_DE_LA_PROYECCION_LUGAR)',
    );

    const proyeccion = readFileSync(raiz('src/lib/lugarPublico.ts'), 'utf8');
    const interfaz = /export interface LugarPublico \{\n([\s\S]*?)\n\}/.exec(proyeccion);
    expect(interfaz, 'no se encontró `LugarPublico`').not.toBeNull();
    const publicados = [...interfaz![1]!.matchAll(/^ {2}(\w+)\??:/gm)].map((m) => m[1]!);

    /** Las tres claves de la proyección que no son campos del documento. */
    const DESDE_EL_DOCUMENTO: Record<string, readonly string[]> = {
      donde: ['direccion', 'barrio', 'ciudad', 'geo', 'direccionPublica'],
      costo: [], // derivado de `condicion`, que ya está en la lista
      /*
       * ⚠️ **Derivado también, y por eso el documento NO se lee.** El
       * `searchText` del documento lo escribe el cliente; la proyección lo vuelve
       * a armar con los campos que publica, así que la dirección queda afuera por
       * construcción y no por la disciplina de `formALugar` (§ 6).
       */
      searchText: [],
    };

    expect(publicados.length, 'no se leyó ningún campo de la proyección').toBeGreaterThan(10);
    const esperados = publicados.flatMap((c) => DESDE_EL_DOCUMENTO[c] ?? [c]);
    expect(
      [...pedidos].sort(),
      'la query y la proyección dejaron de decir lo mismo: o se baja un campo de más (que entra ' +
        'al runner de CI sin publicarse) o falta uno que la ficha va a mostrar vacío',
    ).toEqual([...esperados].sort());

    // Y el que no puede faltar, dicho por su nombre: sin el flag, `dondeQueSale`
    // falla cerrada y **ninguna** ficha publica su dirección.
    expect(pedidos).toContain('direccionPublica');
  });

  it('y la ficha con un slug que no es un slug se descarta en vez de tirar el build', () => {
    expect(sinComentarios(CONTENIDO)).toContain('esSlugDeFicha(l.slug)');
  });

  it('el rebuild de la Function cubre esta colección — trampa 8', () => {
    /*
     * La sexta de las nueve: sin el trigger se publica una ficha desde el panel y
     * el sitio estático **no la muestra nunca**. Acá el daño tiene una cara peor:
     * **apagar `direccionPublica` no sacaría la dirección del sitio**, porque el
     * HTML publicado no se rehace.
     *
     * MUTACIÓN PROBADA: sacar el `export { rebuildPorLugares }` de
     * `functions/index.js` deja este caso en rojo.
     */
    const index = readFileSync(raiz('functions/index.js'), 'utf8');
    expect(index).toContain("export { rebuildPorLugares } from './directorios-trigger.js';");
    const trigger = readFileSync(raiz('functions/directorios-trigger.js'), 'utf8');
    expect(trigger).toContain("document: 'lugares/{id}'");
    expect(trigger).toContain('marcarRebuild(getFirestore(), `lugar ${id}`)');
  });
});
