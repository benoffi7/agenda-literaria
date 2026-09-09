/**
 * B-838 / DEC-13 — una propuesta rechazada no se guarda para siempre.
 *
 * Este archivo prueba la decisión pura de `functions/retencion.js`: qué caducó y
 * qué objeto se va con ella. El pegamento (`retencion-trigger.js`) no se importa
 * —arrastra `firebase-functions`, B-561— y las **dos mitades del borrado** se
 * verifican contra los emuladores en `tests/retencion.integracion.test.ts`, que
 * es donde se puede afirmar que el documento y el objeto se van juntos.
 *
 * Lo que este archivo fija, en una línea cada uno: el plazo, que solo caducan las
 * rechazadas, que una fecha ilegible **no** borra nada, y que el objeto que se
 * borra está acotado al prefijo propio — que es lo que impide que este barrido,
 * que corre con el Admin SDK y **no pasa por las reglas**, se lleve puesto el
 * flyer de una actividad publicada.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  MARGEN_DE_RETENCION_MS,
  MAX_PROPUESTAS_POR_CORRIDA,
  PREFIJO_PROPUESTAS,
  decidirRetencion,
  objetoDePropuesta,
} from '../functions/retencion.js';

const fuente = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(`../${rel}`, import.meta.url)), 'utf8');

const DIA = 24 * 60 * 60 * 1000;
const AHORA = Date.parse('2026-10-10T12:00:00Z');
const VENCIDA = AHORA - MARGEN_DE_RETENCION_MS - DIA;
const RECIENTE = AHORA - DIA;

/** Una propuesta con la forma que el trigger lee (`select`: estado, revision, imagen). */
const propuesta = (over: Record<string, unknown> = {}) => ({
  id: 'p1',
  estado: 'rechazada',
  // Un `Timestamp` de Firestore se lee con `toMillis`, que es lo que `milisDe`
  // resuelve. Se arma el mínimo, igual que en `limpieza-versiones.test.ts`.
  revision: { porUid: 'uid_admin', en: { toMillis: () => VENCIDA }, actividadId: null, motivo: null },
  imagen: null,
  ...over,
});

describe('decidirRetencion — qué propuesta caducó (DEC-13)', () => {
  it('una rechazada hace más de 30 días se borra', () => {
    const { aBorrar, motivos } = decidirRetencion({ propuestas: [propuesta()], ahora: AHORA });
    expect(aBorrar).toEqual([{ id: 'p1', objeto: null }]);
    expect(motivos['p1']).toBe('rechazada-vencida');
  });

  it('y se lleva su imagen: las dos mitades o ninguna', () => {
    // El punto 4 de «las nueve cosas que se rompen en silencio»: un objeto que
    // sobrevive a su documento es la foto de una persona sin nada que la
    // nombre, así que nadie la vuelve a encontrar para borrarla.
    const { aBorrar } = decidirRetencion({
      propuestas: [propuesta({ imagen: { storagePath: 'propuestas/prop_abc.jpg' } })],
      ahora: AHORA,
    });
    expect(aBorrar).toEqual([{ id: 'p1', objeto: 'propuestas/prop_abc.jpg' }]);
  });

  it('una rechazada de ayer no se toca: el plazo es para reabrirla y para repreguntar', () => {
    const { aBorrar, motivos } = decidirRetencion({
      propuestas: [propuesta({ revision: { en: { toMillis: () => RECIENTE } } })],
      ahora: AHORA,
    });
    expect(aBorrar).toEqual([]);
    expect(motivos['p1']).toBe('dentro-del-plazo');
  });

  it('el plazo corre desde el rechazo y no desde que llegó', () => {
    /*
     * Una propuesta que estuvo dos meses en la bandeja y **recién ayer** se
     * rechazó tiene sus treinta días completos. `creadoEn` ni siquiera se lee —
     * el `select` del trigger no lo trae—, y este caso es lo que lo fija: si
     * alguien cambiara la cuenta a `creadoEn`, ésta se borraría hoy.
     */
    const { aBorrar } = decidirRetencion({
      propuestas: [
        propuesta({
          creadoEn: { toMillis: () => AHORA - 60 * DIA },
          revision: { en: { toMillis: () => RECIENTE } },
        }),
      ],
      ahora: AHORA,
    });
    expect(aBorrar).toEqual([]);
  });

  it('los otros tres estados no caducan, ni con la fecha vencida', () => {
    // DEC-13 habla de la rechazada y de ninguna otra. Que una `nueva` abandonada
    // o una `aceptada` conserven el contacto sin plazo es una decisión con costo
    // y está anotada como **B-844**, no es un descuido de esta función.
    for (const estado of ['nueva', 'en-revision', 'aceptada']) {
      const { aBorrar, motivos } = decidirRetencion({
        propuestas: [propuesta({ estado })],
        ahora: AHORA,
      });
      expect(aBorrar, estado).toEqual([]);
      expect(motivos['p1'], estado).toBe(`estado-${estado}`);
    }
  });

  it('una fecha de revisión ilegible no borra nada', () => {
    /*
     * Falla cerrado, como `decidirPurga` y `decidirLimpieza`. Acá el error caro
     * es borrar de más: una propuesta que se ve en la bandeja se puede volver a
     * rechazar, una borrada no vuelve.
     *
     * MUTACIÓN PROBADA: con `?? 0` en vez del `=== null`, los cuatro casos pasan
     * a borrarse —el 1 de enero de 1970 venció hace rato— y este caso lo agarra.
     */
    for (const rota of [undefined, null, 'no es una fecha', {}]) {
      const { aBorrar, motivos } = decidirRetencion({
        propuestas: [propuesta({ revision: { en: rota } })],
        ahora: AHORA,
      });
      expect(aBorrar, String(rota)).toEqual([]);
      expect(motivos['p1'], String(rota)).toBe('sin-fecha-legible');
    }
    // Y una propuesta sin `revision` entera, que es lo que tendría una escrita a
    // mano: el `?.` no puede convertirse en un acceso directo que rompa el
    // barrido para todas las demás.
    const { aBorrar } = decidirRetencion({ propuestas: [propuesta({ revision: undefined })], ahora: AHORA });
    expect(aBorrar).toEqual([]);
  });

  /**
   * **Un `storagePath` que no calza el prefijo no borra nada** — lo trajo el
   * `auditor-privacidad`, y el caso va acá y no en el `describe` de
   * `objetoDePropuesta`: lo que faltaba no era que el path se rechazara (eso ya
   * estaba) sino que el **documento** no se fuera igual.
   *
   * Sin esta guarda, borrar la propuesta dejaba el objeto vivo y **sin nada que
   * lo nombre**, bajo un prefijo que `limpiarImagenesHuerfanas` no barre: la foto
   * de una persona en el bucket para siempre, mientras la ayuda del panel dice
   * que se borró «con la imagen que hayan mandado».
   *
   * MUTACIÓN PROBADA: sacando el corte, este caso se pone rojo y el resto sigue
   * verde.
   */
  it('una imagen fuera del prefijo bloquea el borrado: la foto quedaría sin nada que la nombre', () => {
    for (const path of ['imagenes/img_de_otra.jpg', 'propuestas/sub/x.jpg', 'propuestas/../x.jpg']) {
      const { aBorrar, motivos } = decidirRetencion({
        propuestas: [propuesta({ imagen: { storagePath: path } })],
        ahora: AHORA,
      });
      expect(aBorrar, path).toEqual([]);
      expect(motivos['p1'], path).toBe('imagen-fuera-del-prefijo');
    }
  });

  it('pero una sin imagen propia se borra igual: `null` no es lo mismo que ilegible', () => {
    // El control que hace que la guarda de arriba no se lea como «cualquier
    // imagen bloquea»: la de afuera (`{url}`) y la ausencia no tienen objeto que
    // borrar, y eso es correcto y frecuente.
    for (const imagen of [null, { url: 'https://ejemplo.test/flyer.jpg' }]) {
      const { aBorrar } = decidirRetencion({ propuestas: [propuesta({ imagen })], ahora: AHORA });
      expect(aBorrar, JSON.stringify(imagen)).toEqual([{ id: 'p1', objeto: null }]);
    }
  });

  it('el tope corta la lista y deja el motivo de lo que quedó pendiente', () => {
    const propuestas = Array.from({ length: MAX_PROPUESTAS_POR_CORRIDA + 3 }, (_, i) =>
      propuesta({ id: `p_${i}` }),
    );
    const { aBorrar, motivos } = decidirRetencion({ propuestas, ahora: AHORA });

    expect(aBorrar).toHaveLength(MAX_PROPUESTAS_POR_CORRIDA);
    expect(Object.keys(motivos)).toHaveLength(propuestas.length);
    expect(Object.values(motivos).filter((m) => m.endsWith('-pendiente-por-tope'))).toHaveLength(3);
  });

  it('el margen es un parámetro: el test no espera 30 días', () => {
    // `05-patrones.md` § «El reloj también es infraestructura».
    const { aBorrar } = decidirRetencion({
      propuestas: [propuesta({ revision: { en: { toMillis: () => RECIENTE } } })],
      ahora: AHORA,
      margenMs: 0,
    });
    expect(aBorrar).toEqual([{ id: 'p1', objeto: null }]);
  });

  it('y por default son los 30 días que contestó DEC-13', () => {
    // Fija la decisión del dueño: si alguien lo baja a horas, el «lo rechacé sin
    // querer» deja de existir en la práctica y nada más lo diría.
    expect(MARGEN_DE_RETENCION_MS).toBe(30 * DIA);
  });
});

/**
 * **El orden de las dos mitades, afirmado sobre el fuente.**
 *
 * Lo señaló el `auditor-trampas`: `borrarPropuesta` escribe en dos lugares donde
 * ninguno se puede deshacer, y el orden elegido es lo único que decide el modo de
 * falla — pero **nada lo fijaba**. Invertirlo en un refactor deja toda la suite en
 * verde: los dos borrados ocurren igual, y la diferencia solo se ve el día que
 * uno de los dos falla.
 *
 * Es la familia de la clase de B-71 («el efecto irreversible va último») **con la
 * conclusión al revés**, y por eso no entra en aquel registro: allá uno de los dos
 * efectos es reversible y el otro no, así que el que no se deshace va último; acá
 * los dos son irreversibles y lo que decide es **cuál huérfano es peor**. Un
 * documento sin su objeto muestra un flyer roto en la bandeja y se vuelve a
 * borrar; un objeto sin su documento es la foto de una persona sin nada que la
 * nombre —el barrido de B-221 solo recorre `imagenes/` y `miniaturas/`— y no hay
 * desde dónde volver a encontrarla.
 *
 * MUTACIÓN PROBADA: invirtiendo las dos líneas de `borrarPropuesta`, este caso se
 * pone rojo y los tres de integración siguen verdes.
 */
describe('borrarPropuesta — el objeto primero, el documento después', () => {
  it('el orden está en el fuente y no depende de que nadie lo toque', () => {
    const src = fuente('functions/retencion.js');
    const objeto = src.indexOf('bucket.file(objeto).delete');
    const documento = src.indexOf(".collection('propuestas').doc(id).delete");

    // Control positivo: si alguno de los dos deja de encontrarse —porque el
    // borrado se escribió de otra forma— el aserto de abajo compararía dos `-1`
    // y pasaría sin mirar nada.
    expect(objeto, 'no se encontró el borrado del objeto').toBeGreaterThan(0);
    expect(documento, 'no se encontró el borrado del documento').toBeGreaterThan(0);
    expect(objeto).toBeLessThan(documento);
  });
});

/**
 * **El barrido corre con el Admin SDK, así que no pasa por `firestore.rules`.**
 *
 * El `matches('^propuestas/…')` que valida la escritura de `imagen.storagePath`
 * no protege a esta Function: un documento escrito antes de esa cláusula, o por
 * un camino futuro que se olvide de validarla, puede nombrar el flyer de una
 * actividad **publicada** —y el path no hay que adivinarlo, viaja adentro de la
 * URL de descarga—. Borrarlo deja el sitio con la imagen rota, en vivo.
 *
 * Es el mismo hallazgo que el `auditor-privacidad` cobró sobre la regla en el
 * paso 5, del lado donde la regla no llega.
 */
describe('objetoDePropuesta — solo el prefijo propio', () => {
  it('un objeto de `propuestas/` se borra', () => {
    expect(objetoDePropuesta({ storagePath: 'propuestas/prop_abc.jpg' })).toBe(
      'propuestas/prop_abc.jpg',
    );
  });

  it('el de otra actividad NO: borrarlo rompería el sitio en vivo', () => {
    /*
     * MUTACIÓN PROBADA: sacando el `startsWith`, este caso se pone rojo y el de
     * arriba sigue verde — que es por qué hacen falta los dos.
     */
    for (const path of [
      'imagenes/img_de_otra_actividad.jpg',
      'miniaturas/img_de_otra_actividad.jpg',
      // Empieza con el prefijo y **no está adentro**: es el caso que el segundo
      // chequeo tapa y el primero no.
      'propuestas/../imagenes/img_de_otra.jpg',
      'propuestas/subcarpeta/x.jpg',
      'propuestas/',
    ]) {
      expect(objetoDePropuesta({ storagePath: path }), path).toBeNull();
    }
  });

  it('una imagen que es un link de afuera no tiene objeto que borrar', () => {
    // La otra forma de `ImagenPropuesta` (DEC-11): `{ url }`. No es nuestra y no
    // se toca.
    expect(objetoDePropuesta({ url: 'https://ejemplo.test/flyer.jpg' })).toBeNull();
    expect(objetoDePropuesta(null)).toBeNull();
    expect(objetoDePropuesta(undefined)).toBeNull();
    expect(objetoDePropuesta({ storagePath: 42 })).toBeNull();
  });

  it('el prefijo es el mismo que exige la regla de Firestore', () => {
    /*
     * La atadura de B-364 aplicada a un prefijo: `firestore.rules` es otro
     * runtime y no puede importar este módulo, así que el único modo de que los
     * dos no se separen es un test que lea el archivo. Si la regla pasara a
     * aceptar otro prefijo, esta Function seguiría borrando solo el viejo — o
     * sea que las imágenes nuevas quedarían huérfanas para siempre, en silencio.
     *
     * `storage.rules` va a ser el tercero cuando el paso 8 escriba su bloque; hoy
     * no dice nada del prefijo y un aserto contra él pasaría por ausencia.
     */
    expect(fuente('firestore.rules')).toContain(`matches('^${PREFIJO_PROPUESTAS}`);
  });
});
