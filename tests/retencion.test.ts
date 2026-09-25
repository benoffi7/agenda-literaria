/**
 * B-838 / DEC-13 + B-844 — una propuesta no se guarda para siempre.
 *
 * Este archivo prueba la decisión pura de `functions/retencion.js`: qué caducó y
 * qué objeto se va con ella. El pegamento (`retencion-trigger.js`) no se importa
 * —arrastra `firebase-functions`, B-561— y las **dos mitades del borrado** se
 * verifican contra los emuladores en `tests/retencion.integracion.test.ts`, que
 * es donde se puede afirmar que el documento y el objeto se van juntos.
 *
 * Lo que este archivo fija, en una línea cada uno: los **dos** plazos —30 días
 * desde el rechazo (DEC-13) y 30 días sin tocar (B-844), el mismo número y dos
 * decisiones—, que la **`aceptada` no vence** —que es una decisión y no el cálculo—, cuál es el reloj de cada uno,
 * que una fecha ilegible **no** borra nada, y que el objeto que se borra está
 * acotado al prefijo propio — que es lo que impide que este barrido, que corre
 * con el Admin SDK y **no pasa por las reglas**, se lleve puesto el flyer de una
 * actividad publicada.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  ESTADOS_QUE_CADUCAN,
  ESTADOS_SIN_PLAZO,
  ESTADO_ACEPTADO,
  MARGEN_DEL_FLYER_EN_VUELO_MS,
  MARGEN_DEL_ORIGINAL_ACEPTADO_MS,
  MARGEN_DE_RETENCION_MS,
  MARGEN_SIN_TOCAR_MS,
  MAX_FLYERES_POR_CORRIDA,
  MAX_PROPUESTAS_POR_CORRIDA,
  PREFIJO_PROPUESTAS,
  PROPUESTAS_POR_PAGINA,
  RETENCION_POR_ESTADO,
  borrarFlyer,
  borrarPropuesta,
  decidirFlyeresSinPlazo,
  decidirRetencion,
  objetoDePropuesta,
  propuestasVencibles,
  relojDeAceptacion,
  relojDeRetencion,
} from '../functions/retencion.js';
import { ESTADOS_PROPUESTA } from '@/types/propuesta';
// El doble de `Timestamp` del repo, uno y solo uno (B-211).
import { tsDe } from './fixtures/tiempo';

const fuente = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(`../${rel}`, import.meta.url)), 'utf8');

const DIA = 24 * 60 * 60 * 1000;
const AHORA = Date.parse('2026-10-10T12:00:00Z');
const VENCIDA = AHORA - MARGEN_DE_RETENCION_MS - DIA;
const RECIENTE = AHORA - DIA;
/** Más vieja que el plazo de B-844, para el caso de «sin tocar». */
const ABANDONADA = AHORA - MARGEN_SIN_TOCAR_MS - DIA;

/** El doble de `fixtures/tiempo`, en milisegundos: acá la aritmética es en ms. */
const ts = (ms: number) => tsDe(new Date(ms));

/**
 * Una propuesta con la forma que el trigger lee (`select`: estado, creadoEn,
 * revision.en, imagen.storagePath).
 *
 * **Sin `updateTime`, y a propósito** (B-864): estos casos son sobre el *plazo*,
 * y `decidirRetencion` pasa la versión de largo sin juzgarla. Ponerla en el
 * fixture obligaría a escribirla en la docena de `toEqual` de abajo, que hablan
 * de otra cosa. El passthrough tiene su `describe` propio, con la versión
 * puesta a mano.
 */
const propuesta = (over: Record<string, unknown> = {}) => ({
  id: 'p1',
  estado: 'rechazada',
  // Vieja de entrada: para el plazo de la rechazada `creadoEn` no se mira, y
  // así los casos que **sí** lo miran no pasan por casualidad.
  creadoEn: ts(AHORA - 200 * DIA),
  // Se arma el mínimo, igual que en `limpieza-versiones.test.ts`.
  revision: { porUid: 'uid_admin', en: ts(VENCIDA), actividadId: null, motivo: null },
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
      propuestas: [propuesta({ revision: { en: ts(RECIENTE) } })],
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
          creadoEn: ts(AHORA - 60 * DIA),
          revision: { en: ts(RECIENTE) },
        }),
      ],
      ahora: AHORA,
    });
    expect(aBorrar).toEqual([]);
  });

  /**
   * **La decisión de B-844, y es la que no es un cálculo.**
   *
   * DEC-13 contestó el plazo de la rechazada. Que la `aceptada` **no** venza es
   * la otra mitad, y es una decisión: ahí el contacto sirve —la actividad
   * existe, está publicada, puede haber que repreguntar por ella— así que
   * borrarlo no protege a nadie, deja al proyecto sin poder avisarle a esa
   * persona sobre su propia actividad.
   *
   * El caso le da **todas** las fechas vencidas —llegó hace 200 días, se aceptó
   * hace 90— para que lo único que la salve sea la decisión y no la aritmética.
   *
   * MUTACIÓN PROBADA: poniéndole cualquier número a `aceptada` en
   * `RETENCION_POR_ESTADO` (`MARGEN_SIN_TOCAR_MS`, por ejemplo), este caso se
   * pone rojo — y también el de `ESTADOS_QUE_CADUCAN`, porque la query pasaría
   * a traerlas.
   */
  it('la aceptada NO vence, ni con todas las fechas vencidas: ahí el contacto sirve', () => {
    const { aBorrar, motivos } = decidirRetencion({
      propuestas: [
        propuesta({
          estado: 'aceptada',
          creadoEn: ts(AHORA - 200 * DIA),
          revision: { en: ts(ABANDONADA) },
          imagen: { storagePath: 'propuestas/prop_abc.jpg' },
        }),
      ],
      ahora: AHORA,
    });
    expect(aBorrar).toEqual([]);
    expect(motivos['p1']).toBe('aceptada-no-vence');
    // Y la tabla lo dice con `null`, que es lo que hace que el motivo sea ése y
    // no «cayó acá porque el filtro no la contemplaba».
    expect(RETENCION_POR_ESTADO['aceptada']).toBeNull();
  });

  it('un estado que la tabla no nombra tampoco caduca: agregar uno no puede borrar de rebote', () => {
    const { aBorrar, motivos } = decidirRetencion({
      propuestas: [propuesta({ estado: 'archivada' })],
      ahora: AHORA,
    });
    expect(aBorrar).toEqual([]);
    expect(motivos['p1']).toBe('estado-archivada');
  });

  /**
   * **Y tampoco uno que se llame como una clave de `Object.prototype`** — lo
   * trajo el `auditor-privacidad`, y es el caso que hacía que la propiedad de
   * arriba valiera para `'archivada'` y para nada más.
   *
   * `plazos['constructor']` devuelve una **función**, que no es `undefined` ni
   * `null`, así que se saltea las dos guardas; después `ahora - reloj.ms < plazo`
   * da `NaN < función` → `false` → **la propuesta se borra**. Sigue el mismo
   * criterio de fallar cerrado que `sin-fecha-legible`.
   *
   * MUTACIÓN PROBADA: volviendo a `plazos[p.estado]` sin `Object.hasOwn`, este
   * caso se pone rojo y el de `'archivada'` sigue verde — que es por qué hacen
   * falta los dos.
   */
  it('ni uno que se llame como una clave heredada: el lookup falla cerrado', () => {
    for (const estado of ['constructor', 'toString', 'valueOf', '__proto__']) {
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

  it('los plazos son un parámetro: el test no espera 30 días ni 90', () => {
    // `05-patrones.md` § «El reloj también es infraestructura».
    const { aBorrar } = decidirRetencion({
      propuestas: [propuesta({ revision: { en: ts(RECIENTE) } })],
      ahora: AHORA,
      plazos: { ...RETENCION_POR_ESTADO, rechazada: 0 },
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
 * **El segundo plazo: la que nadie tocó** — B-844.
 *
 * DEC-13 no lo contestó porque no se le preguntó, y sin él una propuesta que
 * llegó, no interesó y quedó ahí conservaba el mail o el WhatsApp de una persona
 * **para siempre** — con el único borrado dependiendo de que un admin apretara
 * «rechazar», que es justo de lo que la retención automática vino a no depender.
 *
 * > **El número lo contestó el dueño el 2026-09-09: 30 días** (la pregunta se le
 * > hizo con una hipótesis de 90 escrita en el código). Los casos se escriben
 * > igual contra `MARGEN_SIN_TOCAR_MS` y no contra el literal: si mañana se
 * > mueve, se mueven todos y ninguno hay que reescribirlo.
 */
describe('decidirRetencion — la que nadie tocó (B-844)', () => {
  const sinTocar = (over: Record<string, unknown> = {}) =>
    propuesta({ estado: 'nueva', creadoEn: ts(ABANDONADA), revision: { en: null }, ...over });

  it('una `nueva` que nadie miró en 30 días se borra, contada desde que llegó', () => {
    const { aBorrar, motivos } = decidirRetencion({ propuestas: [sinTocar()], ahora: AHORA });
    expect(aBorrar).toEqual([{ id: 'p1', objeto: null }]);
    expect(motivos['p1']).toBe('sin-mirar-vencida');
  });

  it('y se lleva su imagen, igual que la rechazada', () => {
    const { aBorrar } = decidirRetencion({
      propuestas: [sinTocar({ imagen: { storagePath: 'propuestas/prop_abc.jpg' } })],
      ahora: AHORA,
    });
    expect(aBorrar).toEqual([{ id: 'p1', objeto: 'propuestas/prop_abc.jpg' }]);
  });

  it('una de un día menos no: el plazo es el plazo', () => {
    const { aBorrar, motivos } = decidirRetencion({
      propuestas: [sinTocar({ creadoEn: ts(AHORA - MARGEN_SIN_TOCAR_MS + DIA) })],
      ahora: AHORA,
    });
    expect(aBorrar).toEqual([]);
    expect(motivos['p1']).toBe('dentro-del-plazo');
  });

  /**
   * **«Sin tocar» no es «creada hace 30 días», y ésta es la diferencia.**
   *
   * `revision.en` se escribe en **todo** movimiento de estado, así que una que
   * un admin miró hace una semana y dejó en `en-revision` no es la misma que una
   * que nadie abrió nunca. El ítem pedía «contados desde `creadoEn`» y también
   * decía «sin tocar»; donde las dos mitades no coinciden gana la segunda.
   *
   * MUTACIÓN PROBADA: haciendo que `relojDeRetencion` devuelva siempre
   * `creadoEn` para los no-rechazados, este caso se pone rojo y el de arriba
   * sigue verde — que es por qué hacen falta los dos.
   */
  it('una que un admin miró ayer NO se borra, aunque haya llegado hace tres meses', () => {
    const { aBorrar, motivos } = decidirRetencion({
      propuestas: [
        sinTocar({ estado: 'en-revision', revision: { en: ts(RECIENTE) } }),
      ],
      ahora: AHORA,
    });
    expect(aBorrar).toEqual([]);
    expect(motivos['p1']).toBe('dentro-del-plazo');
  });

  /**
   * El caso que hace que la decisión del reloj no sea una preferencia estética:
   * **una rechazada que se reabre**. Vuelve a `nueva` con `creadoEn` de hace más
   * de 90 días y `revision.en` de hoy. Con el reloj en `creadoEn`, el barrido de
   * esa misma noche se lleva la propuesta que un admin acababa de rescatar a
   * mano — el error exacto que la retención existía para no cometer.
   */
  it('y una reabierta hoy tampoco, aunque haya llegado hace medio año', () => {
    const { aBorrar } = decidirRetencion({
      propuestas: [
        sinTocar({ creadoEn: ts(AHORA - 180 * DIA), revision: { en: ts(AHORA) } }),
      ],
      ahora: AHORA,
    });
    expect(aBorrar).toEqual([]);
  });

  it('una abandonada después de mirarla también vence, y el motivo lo distingue', () => {
    const { aBorrar, motivos } = decidirRetencion({
      propuestas: [
        sinTocar({ estado: 'en-revision', revision: { en: ts(ABANDONADA) } }),
      ],
      ahora: AHORA,
    });
    expect(aBorrar).toEqual([{ id: 'p1', objeto: null }]);
    // No es `sin-mirar-vencida`: alguien la abrió y la dejó, y el log de la
    // corrida es el único lugar donde después se puede reconstruir cuál fue.
    expect(motivos['p1']).toBe('sin-avanzar-vencida');
  });

  it('sin ninguna fecha legible no se borra, igual que la rechazada', () => {
    for (const rota of [undefined, null, 'no es una fecha', {}]) {
      const { aBorrar, motivos } = decidirRetencion({
        propuestas: [sinTocar({ creadoEn: rota, revision: { en: rota } })],
        ahora: AHORA,
      });
      expect(aBorrar, String(rota)).toEqual([]);
      expect(motivos['p1'], String(rota)).toBe('sin-fecha-legible');
    }
  });

  it('el plazo son los 30 días que contestó el dueño, y está en una sola línea', () => {
    // Si mañana se mueve, esto es lo único que se toca del lado de la Function
    // (y su gemelo de la bandeja, atado por
    // `tests/bandeja-de-propuestas.test.ts`).
    expect(MARGEN_SIN_TOCAR_MS).toBe(30 * DIA);
    expect(RETENCION_POR_ESTADO['nueva']).toBe(MARGEN_SIN_TOCAR_MS);
    expect(RETENCION_POR_ESTADO['en-revision']).toBe(MARGEN_SIN_TOCAR_MS);
  });
});

/**
 * **Los dos plazos dan el mismo número, y eso NO es una atadura** — B-844.
 *
 * El dueño contestó 30 para «sin tocar», que es lo mismo que DEC-13 había
 * contestado para la rechazada. Son **dos decisiones que hoy coinciden**: aquélla
 * es el margen de un arrepentimiento («la rechacé sin querer»), ésta es cuánto
 * tarda una bandeja en dejar de mirarse. Nada obliga a que se muevan juntas.
 *
 * Este `describe` existe para que nadie las una **por prolijidad**, que es el
 * refactor que se ve bien y borra una decisión: escribir
 * `MARGEN_SIN_TOCAR_MS = MARGEN_DE_RETENCION_MS` haría que alargar el margen de
 * rescate alargara también cuánto se guarda el WhatsApp de quien nunca recibió
 * respuesta, y nada lo diría. Es el criterio de `MINIMO_DESCRIPCION` en
 * `estadoDelCatalogo.ts`, que no se importa de `LARGO_RESUMEN` aunque los dos
 * hablen de la misma descripción.
 */
describe('los dos plazos coinciden hoy, y son dos decisiones', () => {
  it('cada uno se afirma por su lado, no uno contra el otro', () => {
    // A propósito **no** es `expect(MARGEN_SIN_TOCAR_MS).toBe(MARGEN_DE_RETENCION_MS)`:
    // ese aserto convertiría la coincidencia en un requisito, que es justo lo
    // contrario de lo que este archivo quiere fijar.
    expect(MARGEN_DE_RETENCION_MS).toBe(30 * DIA);
    expect(MARGEN_SIN_TOCAR_MS).toBe(30 * DIA);
  });

  it('y ninguno está escrito en términos del otro', () => {
    /*
     * MUTACIÓN PROBADA: con
     * `export const MARGEN_SIN_TOCAR_MS = MARGEN_DE_RETENCION_MS;` —que hoy deja
     * **toda** la suite en verde, porque el valor no cambia— este caso se pone
     * rojo. Es el único que lo agarra, y por eso existe.
     */
    const declaracion = /export const MARGEN_SIN_TOCAR_MS = ([^;]+);/.exec(
      fuente('functions/retencion.js'),
    );
    expect(declaracion, 'no se encontró la declaración de MARGEN_SIN_TOCAR_MS').not.toBeNull();
    expect(declaracion![1]).not.toContain('MARGEN_DE_RETENCION_MS');
  });
});

/**
 * **La tabla y la query no pueden separarse** — B-844.
 *
 * El modo de falla es silencioso y caro: la tabla dice que un estado caduca, el
 * `where` de `propuestasVencibles` no lo trae, y entonces **no caduca nunca** con
 * toda la suite en verde. Por eso los estados de la query salen de la tabla y no
 * están escritos otra vez.
 */
describe('los estados que la query trae salen de la tabla', () => {
  it('la `aceptada` queda afuera porque su plazo es `null`, no porque haya una segunda lista', () => {
    expect(ESTADOS_QUE_CADUCAN.sort()).toEqual(['en-revision', 'nueva', 'rechazada']);
    for (const estado of ESTADOS_QUE_CADUCAN as (keyof typeof RETENCION_POR_ESTADO)[]) {
      expect(RETENCION_POR_ESTADO[estado], estado).not.toBeNull();
    }
  });

  it('y la query las nombra por la constante derivada, no por un literal', () => {
    /*
     * MUTACIÓN PROBADA: escribiendo `['nueva','en-revision','rechazada']` a mano
     * en el `where`, este caso se pone rojo — que es lo que hace que «poner un
     * número en `aceptada`» alcance para que empiece a caducar.
     */
    expect(fuente('functions/retencion.js')).toContain(
      ".where('estado', 'in', ESTADOS_QUE_CADUCAN)",
    );
  });

  it('la tabla cubre exactamente los estados que el tipo declara', () => {
    /*
     * La atadura de B-364 sobre un mapa: el día que aparezca un quinto estado en
     * `ESTADOS_PROPUESTA`, esto se pone rojo y alguien tiene que decidir si
     * caduca. Sin este caso, el estado nuevo caería en `estado-<x>` y no
     * caducaría nunca, en silencio.
     */
    expect(Object.keys(RETENCION_POR_ESTADO).sort()).toEqual([...ESTADOS_PROPUESTA].sort());
  });
});

/**
 * `relojDeRetencion` aparte, porque es la decisión de B-844 en una función y
 * cada rama tiene su motivo.
 */
describe('relojDeRetencion — desde cuándo se cuenta', () => {
  it('la rechazada cuenta desde el rechazo y no cae a `creadoEn` (DEC-13)', () => {
    expect(relojDeRetencion({ estado: 'rechazada', creadoEn: ts(1), revision: { en: ts(9) } }))
      .toEqual({ ms: 9, campo: 'rechazo' });
    // Sin fecha de rechazo legible **no hay reloj**: contar desde `creadoEn`
    // sería otro plazo, decidido por accidente.
    expect(relojDeRetencion({ estado: 'rechazada', creadoEn: ts(1), revision: { en: null } }))
      .toBeNull();
  });

  it('las otras cuentan desde la última señal de vida', () => {
    expect(relojDeRetencion({ estado: 'nueva', creadoEn: ts(1), revision: { en: null } }))
      .toEqual({ ms: 1, campo: 'llegada' });
    expect(relojDeRetencion({ estado: 'en-revision', creadoEn: ts(1), revision: { en: ts(9) } }))
      .toEqual({ ms: 9, campo: 'ultimo-toque' });
  });

  it('y se queda con la más reciente, no con la primera que exista', () => {
    // Un `revision.en` anterior a `creadoEn` es un documento imposible por la
    // regla (`request.time` las dos veces), y aun así no puede acortar el plazo.
    expect(relojDeRetencion({ estado: 'nueva', creadoEn: ts(9), revision: { en: ts(1) } }))
      .toEqual({ ms: 9, campo: 'llegada' });
  });

  it('sin nada legible, no hay reloj', () => {
    expect(relojDeRetencion({ estado: 'nueva' })).toBeNull();
    expect(relojDeRetencion({ estado: 'nueva', creadoEn: 'ayer', revision: { en: {} } })).toBeNull();
  });
});

/**
 * **El orden de las tres, afirmado sobre el fuente.**
 *
 * Lo señaló el `auditor-trampas` sobre las dos primeras: `borrarPropuesta` escribe
 * en dos lugares donde ninguno se puede deshacer, y el orden elegido es lo único
 * que decide el modo de falla — pero **nada lo fijaba**. Invertirlo en un refactor
 * deja toda la suite en verde: los dos borrados ocurren igual, y la diferencia
 * solo se ve el día que uno de los dos falla.
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
 * ── Y desde B-864 son tres, con la relectura arriba ───────────────────────
 * **El orden de B-838 no se cambió** —el objeto sigue primero y el documento
 * después—; lo que se agregó es una guarda **arriba de los dos**. Esa posición es
 * la decisión de B-864 y hay que fijarla igual que la otra: si la relectura cayera
 * *entre* los dos borrados, la precondición seguiría salvando el documento y el
 * objeto ya se habría ido, que es exactamente el huérfano que este ítem vino a no
 * causar sobre una propuesta rescatada. Storage no tiene precondición: al objeto
 * solo se lo puede proteger **no llegando hasta él**.
 *
 * MUTACIÓN PROBADA (dos): invirtiendo las dos líneas de borrado, este caso se pone
 * rojo y los de integración siguen verdes; bajando el `getAll` a después del
 * borrado del objeto, este caso se pone rojo y —lo importante— el caso de la
 * carrera de `retencion.integracion.test.ts` se pone rojo **solo en la mitad de
 * la imagen**, que es la prueba de que las dos guardas cubren cosas distintas.
 */
describe('borrarPropuesta — la relectura, después el objeto, después el documento', () => {
  it('el orden está en el fuente y no depende de que nadie lo toque', () => {
    const src = fuente('functions/retencion.js');
    const relectura = src.indexOf('db.getAll(ref, { fieldMask: [] })');
    const guarda = src.indexOf("if (!ahora.updateTime.isEqual(visto)) return 'la-tocaron';");
    /*
     * **Desde la guarda y no desde el principio del archivo, y esto lo encontró
     * una mutación.** `bucket.file(objeto).delete` aparece **dos** veces: en la
     * rama `ya-no-esta` y en el camino principal. Con un `indexOf` pelado el
     * aserto miraba la primera —que está antes del borrado del documento pase lo
     * que pase— y **la inversión del orden pasaba en verde**, que es exactamente
     * el falso verde que este caso existe para no tener. Se busca desde la
     * guarda, o sea en el camino que de verdad borra las dos mitades.
     */
    const objeto = src.indexOf('bucket.file(objeto).delete', guarda);
    const documento = src.indexOf('ref.delete({ lastUpdateTime: visto })');

    // Control positivo: si alguno deja de encontrarse —porque el borrado se
    // escribió de otra forma— los asertos de abajo compararían `-1` y pasarían
    // sin mirar nada.
    expect(relectura, 'no se encontró la relectura de metadata').toBeGreaterThan(0);
    expect(guarda, 'no se encontró la guarda de la versión').toBeGreaterThan(0);
    expect(objeto, 'no se encontró el borrado del objeto en el camino principal').toBeGreaterThan(0);
    expect(documento, 'no se encontró el borrado del documento con precondición').toBeGreaterThan(0);

    expect(relectura, 'la relectura tiene que ir antes de tocar Storage').toBeLessThan(objeto);
    expect(objeto, 'el orden de B-838: el objeto primero').toBeLessThan(documento);
  });

  /**
   * **La relectura trae metadata y nada más, y eso es la mitad de por qué se
   * puede hacer.** Un `ref.get()` traería el documento entero —y con él el
   * contacto del tercero—, que es justo lo que el `select` de
   * `propuestasVencibles` existe para evitar: la guarda nueva no puede deshacer
   * la garantía vieja. `fieldMask: []` devuelve `exists` y `updateTime` con cero
   * campos (verificado contra el emulador).
   *
   * Se afirma sobre el fuente por lo mismo que el `select`: desde el resultado no
   * se distingue un `getAll` con máscara vacía de uno sin máscara — los dos
   * devuelven el `updateTime` correcto.
   *
   * MUTACIÓN PROBADA: cambiándolo por `await ref.get()`, este caso se pone rojo y
   * todos los de integración siguen verdes.
   */
  it('y la relectura no trae ni un campo del documento', () => {
    const src = fuente('functions/retencion.js');
    expect(src).toContain('db.getAll(ref, { fieldMask: [] })');
    expect(src, 'un `ref.get()` traería el contacto del tercero a la memoria').not.toMatch(
      /await ref\.get\(\)/,
    );
  });
});

/**
 * **La versión vista viaja de la query al borrado** — B-864.
 *
 * `propuestasVencibles` guarda el `updateTime` de cada candidata y
 * `borrarPropuesta` lo exige como precondición. En el medio está esta función
 * pura, que **no lo juzga**: lo pasa de largo. El modo de falla que este
 * `describe` tapa es el de siempre en este archivo —el dato que la lógica de
 * abajo necesita y que alguien saca de arriba «porque no se usa acá»—, con la
 * diferencia de que este se nota: sin `visto` el borrado no ocurre, tira.
 */
describe('el `visto` pasa por la decisión sin que la decisión lo juzgue', () => {
  it('la entrada a borrar lleva la versión que la query trajo', () => {
    /*
     * MUTACIÓN PROBADA: sacando `visto: p.updateTime` del `aBorrar.push` de
     * `decidirRetencion`, este caso se pone rojo — y todos los demás de este
     * archivo siguen verdes, porque comparan `{ id, objeto }` y `toEqual`
     * ignora una clave `undefined`.
     */
    const version = { marca: 'la que vio la query' };
    const { aBorrar } = decidirRetencion({
      propuestas: [propuesta({ updateTime: version })],
      ahora: AHORA,
    });
    expect(aBorrar).toEqual([{ id: 'p1', objeto: null, visto: version }]);
  });

  it('y sin ella `borrarPropuesta` no borra: tira antes de tocar nada', async () => {
    /*
     * **Ruidoso y no «falla cerrado», y es a propósito** — ver el docblock de
     * `borrarPropuesta`. Una lista armada sin `propuestasVencibles` es un error
     * de programación, no un documento mal escrito, y clasificarlo como un
     * motivo más lo dejaría pasar como «una que no se borró».
     *
     * `db` y `bucket` van en `null` porque la guarda es la **primera** línea: si
     * alguna vez se moviera abajo de la relectura o del borrado del objeto, este
     * caso reventaría con un `TypeError` en vez de con el mensaje, y eso también
     * es rojo.
     *
     * MUTACIÓN PROBADA: sacando el `if (!visto) throw`, este caso se pone rojo
     * (falla con `Cannot read properties of null`, no con el mensaje esperado).
     */
    await expect(
      borrarPropuesta(null as never, null as never, { id: 'p1', objeto: null, visto: undefined }),
    ).rejects.toThrow(/sin la versión vista/);
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

/**
 * **La lectura se corta por trabajo, no por cantidad leída** — B-865.
 *
 * El ítem pedía un `limit()` en la query del barrido, que no lo tenía y desde
 * B-844 arrastra toda la bandeja pendiente. Lo que estos casos fijan es que el
 * `limit()` que se puso **no es el ingenuo**: la query no tiene `orderBy` (pediría
 * índice compuesto), así que un `limit(50)` pelado leería siempre las mismas
 * primeras cincuenta por id y una vencida que quedara más adelante en la
 * colección **no se borraría nunca**, en silencio y con la suite en verde — o
 * sea, el plazo de retención dejaría de cumplirse sin que nada lo diga. Por eso
 * la lectura es paginada con cursor y lo que la corta es haber juntado el tope de
 * borrados de hoy.
 *
 * Se prueba con un doble y no contra el emulador porque lo que hay que poder
 * afirmar es **cuántas páginas pidió y con qué cursor**, que desde el resultado
 * no se ve. Que el cursor funcione de verdad contra Firestore —`startAfter` con
 * un snapshot y sin `orderBy` explícito— es otra pregunta, y está en
 * `retencion.integracion.test.ts`.
 */
describe('propuestasVencibles — la lectura paginada (B-865)', () => {
  /**
   * El mínimo de Firestore que este barrido usa: `collection().where().select()`,
   * `.startAfter()`, `.limit()` y `.get()`. Anota cada página pedida con su
   * cursor, que es lo que los casos miran.
   */
  const firestoreFalso = (docs: { id: string; datos: Record<string, unknown> }[]) => {
    const paginas: { desde: string | null; limite: number | null }[] = [];

    const construir = (desde: string | null, limite: number | null): Record<string, unknown> => ({
      where: () => construir(desde, limite),
      select: () => construir(desde, limite),
      startAfter: (snap: { id: string }) => construir(snap.id, limite),
      limit: (n: number) => construir(desde, n),
      get: async () => {
        paginas.push({ desde, limite });
        const arranque = desde === null ? 0 : docs.findIndex((d) => d.id === desde) + 1;
        const trozo = docs.slice(arranque, arranque + (limite ?? docs.length));
        return {
          size: trozo.length,
          docs: trozo.map((d) => ({
            id: d.id,
            get: (campo: string) => d.datos[campo],
            updateTime: `v-${d.id}`,
          })),
        };
      },
    });

    return { db: { collection: () => construir(null, null) }, paginas };
  };

  /** `n` propuestas en orden de id, con el `creadoEn` que se le pase a cada una. */
  const bandeja = (n: number, cuando: (i: number) => number) =>
    Array.from({ length: n }, (_, i) => ({
      id: `p_${String(i).padStart(4, '0')}`,
      datos: {
        estado: 'nueva',
        creadoEn: ts(cuando(i)),
        revision: { en: null },
        imagen: null,
      },
    }));

  it('el tamaño de página deja lugar de sobra para el tope de borrados', () => {
    /*
     * La relación entre las dos constantes es lo que hace que la corrida normal
     * sea **una sola página**: si la página fuera más chica que el tope, cada
     * corrida con trabajo pediría varias. No es una atadura —son dos números
     * independientes— pero sí una desigualdad que tiene que valer.
     */
    expect(PROPUESTAS_POR_PAGINA).toBeGreaterThan(MAX_PROPUESTAS_POR_CORRIDA);
  });

  it('con trabajo por delante lee una sola página y corta', async () => {
    const { db, paginas } = firestoreFalso(bandeja(500, () => ABANDONADA));
    const leidas = await propuestasVencibles(db, { ahora: AHORA });

    // Una página: las primeras 200 ya llenan (y sobran) el tope de 50 borrados,
    // así que seguir leyendo no cambiaría nada de lo que esta corrida va a hacer.
    expect(paginas).toHaveLength(1);
    expect(paginas[0]).toEqual({ desde: null, limite: PROPUESTAS_POR_PAGINA });
    expect(leidas).toHaveLength(PROPUESTAS_POR_PAGINA);
  });

  it('y una vencida al final de la colección se encuentra igual', async () => {
    /*
     * **El caso que un `limit()` pelado rompería**, y es el motivo entero de que
     * esto sea paginado. Con 500 propuestas de ayer y una sola vencida en la
     * última posición por id, un `limit(50)` —o un `limit(200)`— sin cursor
     * devuelve puras propuestas dentro de su plazo y el barrido no borra nada,
     * todos los días, mientras el dato personal de un tercero sigue guardado.
     *
     * MUTACIÓN PROBADA: reemplazando el `for (;;)` de `propuestasVencibles` por
     * un único `await base.limit(PROPUESTAS_POR_PAGINA).get()`, este caso se pone
     * rojo y el de arriba sigue verde — que es la prueba de que miden mitades
     * distintas.
     */
    const docs = bandeja(500, () => RECIENTE);
    docs[docs.length - 1]!.datos.creadoEn = ts(ABANDONADA);

    const { db, paginas } = firestoreFalso(docs);
    const leidas = await propuestasVencibles(db, { ahora: AHORA });

    expect(paginas).toHaveLength(3);
    expect(leidas).toHaveLength(500);
    const { aBorrar } = decidirRetencion({ propuestas: leidas, ahora: AHORA });
    expect(aBorrar.map((p) => p.id)).toEqual([docs[docs.length - 1]!.id]);
  });

  it('el cursor de cada página es la última de la anterior', async () => {
    const docs = bandeja(500, () => RECIENTE);
    const { db, paginas } = firestoreFalso(docs);
    await propuestasVencibles(db, { ahora: AHORA });

    /*
     * Sin esto, un cursor mal armado —el primero de la página en vez del último,
     * o siempre `null`— daría un bucle infinito o repetiría documentos, y los
     * casos de arriba pasarían igual mientras el conteo diera.
     */
    expect(paginas.map((p) => p.desde)).toEqual([
      null,
      docs[PROPUESTAS_POR_PAGINA - 1]!.id,
      docs[PROPUESTAS_POR_PAGINA * 2 - 1]!.id,
    ]);
    expect(paginas.every((p) => p.limite === PROPUESTAS_POR_PAGINA)).toBe(true);
  });

  it('una página corta termina la recorrida sin pedir una vacía', async () => {
    const { db, paginas } = firestoreFalso(bandeja(3, () => RECIENTE));
    expect(await propuestasVencibles(db, { ahora: AHORA })).toHaveLength(3);
    expect(paginas).toHaveLength(1);
  });

  it('y la corta el mismo reloj con el que el llamador decide después', async () => {
    /*
     * `ahora` entra por parámetro porque `propuestasVencibles` le pregunta a
     * `decidirRetencion` cuándo parar: con el reloj de adentro (`Date.now()`) y
     * el de afuera separados, la lectura podría cortar con un juicio y el borrado
     * hacerse con otro. Acá se ve al revés: con un `ahora` anterior al
     * vencimiento, nada vence y no hay corte por trabajo.
     */
    const { db, paginas } = firestoreFalso(bandeja(500, () => ABANDONADA));
    const leidas = await propuestasVencibles(db, { ahora: ABANDONADA + 1 });
    expect(paginas).toHaveLength(3);
    expect(leidas).toHaveLength(500);
  });
});

/**
 * **Los flyers de `propuestas/` que no borraba nadie** — B-871, salida 3.
 *
 * El borrado del original de una propuesta **aceptada** ocurre una sola vez, en
 * la transición (`borrarImagenAlCerrar`), y debajo no había red: la `aceptada` no
 * vence y `limpiarImagenesHuerfanas` solo recorre `imagenes/` y `miniaturas/`.
 * Si ese borrado no ocurría —falló, o la decisión correcta fue **no** borrar
 * porque no había copia verificada, o la propuesta ya estaba aceptada antes del
 * deploy— la foto de un tercero se quedaba para siempre.
 *
 * Desde la decisión del dueño del 2026-09-25 esto **borra**: el original de una
 * aceptada a los 30 días de aceptada (D-1160) y el objeto que ningún documento
 * nombra, pasada la gracia de 72 horas (D-1161). La propiedad que ordena los
 * casos: **un objeto se borra acá solo si ningún otro barrido lo va a borrar**;
 * el de una propuesta que caduca sigue siendo de la retención, que no cambió.
 */
describe('decidirFlyeresSinPlazo — qué flyer de `propuestas/` se borra (B-871)', () => {
  const VIEJO = AHORA - MARGEN_DEL_FLYER_EN_VUELO_MS - DIA;
  /** Aceptada hace más de 30 días: su original ya venció. */
  const ACEPTADA_HACE_MUCHO = AHORA - MARGEN_DEL_ORIGINAL_ACEPTADO_MS - DIA;
  const objeto = (nombre: string, creado = VIEJO) => ({ nombre, creado });
  /**
   * **Con las dos fechas, y eso no es relleno del fixture.** Una propuesta en un
   * estado que caduca pero que no se puede fechar **no la borra el barrido**
   * (`sin-fecha-legible`), así que su flyer tampoco tiene quien lo borre. Y van
   * las dos porque el reloj no es el mismo: la `rechazada` y la `aceptada`
   * cuentan desde `revision.en` **sin caer** a `creadoEn`.
   */
  const conFlyer = (id: string, estado: string, nombre: string, en = AHORA - DIA) => ({
    id,
    estado,
    creadoEn: ts(AHORA - DIA),
    revision: { en: ts(en) },
    imagen: { storagePath: nombre },
  });

  it('el original de una aceptada se borra a los 30 días de aceptada, contados desde la aceptación', () => {
    /*
     * **D-1160.** El `creadoEn` es de hace un día a propósito: el plazo es de la
     * aceptación (`revision.en`), no de la llegada. Y la entrada lleva la
     * versión que la lectura vio, que es lo que `borrarFlyer` exige antes de
     * tocar el objeto (B-864).
     */
    const vista = ts(AHORA - 3 * DIA);
    const { aBorrar, aRevisar, motivos } = decidirFlyeresSinPlazo({
      objetos: [objeto('propuestas/prop_a.jpg')],
      propuestas: [
        {
          ...conFlyer('p1', 'aceptada', 'propuestas/prop_a.jpg', ACEPTADA_HACE_MUCHO),
          updateTime: vista,
        },
      ],
      ahora: AHORA,
    });
    expect(aBorrar).toEqual([
      { objeto: 'propuestas/prop_a.jpg', propuesta: 'p1', visto: vista, motivo: 'aceptada-vencida' },
    ]);
    expect(aRevisar).toEqual([]);
    expect(motivos['propuestas/prop_a.jpg']).toBe('aceptada-vencida');
  });

  it('y un día antes no: son 30 días para decidir si la foto se usa', () => {
    for (const en of [AHORA - DIA, AHORA - MARGEN_DEL_ORIGINAL_ACEPTADO_MS + DIA]) {
      const { aBorrar, aRevisar, motivos } = decidirFlyeresSinPlazo({
        objetos: [objeto('propuestas/prop_a.jpg')],
        propuestas: [conFlyer('p1', 'aceptada', 'propuestas/prop_a.jpg', en)],
        ahora: AHORA,
      });
      expect(aBorrar, String(en)).toEqual([]);
      // Tampoco pide a nadie: tiene red, la corrida del día 30 se lo lleva.
      expect(aRevisar, String(en)).toEqual([]);
      expect(motivos['propuestas/prop_a.jpg']).toBe('aceptada-dentro-del-plazo');
    }
  });

  it('una aceptada sin fecha de aceptación legible no se borra: queda para revisar', () => {
    /*
     * Falla cerrado, como la rechazada sin `revision.en`: no se puede afirmar que
     * pasaron los 30 días, y la foto que se borra no vuelve. Con `creadoEn`
     * viejísimo y legible a propósito — caer a la llegada sería otro plazo,
     * decidido por accidente.
     */
    for (const en of [null, undefined, 'no-es-una-fecha', NaN]) {
      const { aBorrar, aRevisar } = decidirFlyeresSinPlazo({
        objetos: [objeto('propuestas/prop_a.jpg')],
        propuestas: [
          {
            id: 'p1',
            estado: 'aceptada',
            creadoEn: ts(AHORA - 400 * DIA),
            revision: { en },
            imagen: { storagePath: 'propuestas/prop_a.jpg' },
          },
        ],
        ahora: AHORA,
      });
      expect(aBorrar, String(en)).toEqual([]);
      expect(aRevisar, String(en)).toEqual([
        { objeto: 'propuestas/prop_a.jpg', propuesta: 'p1', motivo: 'aceptada-sin-fecha-legible' },
      ]);
    }
  });

  it('el reloj de la aceptación solo existe para la aceptada, y es `revision.en` a secas', () => {
    expect(relojDeAceptacion({ estado: 'aceptada', revision: { en: ts(AHORA) } })).toBe(AHORA);
    expect(relojDeAceptacion({ estado: 'aceptada', creadoEn: ts(AHORA) })).toBeNull();
    expect(relojDeAceptacion({ estado: 'rechazada', revision: { en: ts(AHORA) } })).toBeNull();
  });

  it('el documento de la aceptada sigue sin vencer: lo que se va es la foto, no el contacto', () => {
    // La otra mitad de D-1160, dicha donde se pone roja si alguien «simplifica»
    // dándole a la aceptada un plazo de documento para que se lleve la foto.
    expect(RETENCION_POR_ESTADO.aceptada).toBeNull();
    expect(ESTADO_ACEPTADO).toBe('aceptada');
  });

  it('el flyer de una que caduca sigue siendo de la retención, aunque su documento ya venció', () => {
    /*
     * **La retención de `nueva`, `en-revision` y `rechazada` no cambia.** Ni con
     * el objeto viejo ni con el documento vencido: ése lo borra
     * `decidirRetencion` junto con su documento y en el orden de B-838. Borrarlo
     * acá sería un segundo borrado del mismo objeto en carrera con aquél, y
     * dejaría a la bandeja mostrando un flyer roto el mes que le queda.
     */
    for (const estado of ESTADOS_QUE_CADUCAN) {
      for (const en of [AHORA - DIA, AHORA - 400 * DIA]) {
        const { aBorrar, aRevisar, motivos } = decidirFlyeresSinPlazo({
          objetos: [objeto('propuestas/prop_b.jpg', AHORA - 400 * DIA)],
          propuestas: [conFlyer('p2', estado, 'propuestas/prop_b.jpg', en)],
          ahora: AHORA,
        });
        expect(aBorrar, estado).toEqual([]);
        expect(aRevisar, estado).toEqual([]);
        expect(motivos['propuestas/prop_b.jpg'], estado).toBe('de-una-que-caduca');
      }
    }
  });

  it('un objeto que ningún documento nombra se borra, pasada la gracia', () => {
    /*
     * **D-1161.** Son dos historias que terminan igual: un `/proponer`
     * abandonado después de subir la foto (el formulario sube al elegir el
     * archivo y escribe el documento al enviar), o la mitad que sobrevivió a un
     * borrado cortado por la mitad. En los dos casos es una foto de una persona
     * **sin nada que la referencie**, y nadie la va a encontrar desde otro lado.
     */
    const { aBorrar, aRevisar, motivos } = decidirFlyeresSinPlazo({
      objetos: [objeto('propuestas/prop_c.jpg')],
      propuestas: [],
      ahora: AHORA,
    });
    expect(aBorrar).toEqual([
      { objeto: 'propuestas/prop_c.jpg', propuesta: null, visto: null, motivo: 'sin-propuesta' },
    ]);
    expect(aRevisar).toEqual([]);
    expect(motivos['propuestas/prop_c.jpg']).toBe('sin-propuesta');
  });

  it('salvo que sea reciente: alguien puede estar llenando el formulario', () => {
    const { aBorrar, motivos } = decidirFlyeresSinPlazo({
      objetos: [objeto('propuestas/prop_d.jpg', AHORA - MARGEN_DEL_FLYER_EN_VUELO_MS + 60_000)],
      propuestas: [],
      ahora: AHORA,
    });
    expect(aBorrar).toEqual([]);
    expect(motivos['propuestas/prop_d.jpg']).toBe('recien-subido');
  });

  it('y una fecha de objeto ilegible falla cerrado, como en los otros dos barridos', () => {
    for (const creado of [undefined, NaN, null, 'ayer']) {
      const { aBorrar, aRevisar, motivos } = decidirFlyeresSinPlazo({
        objetos: [{ nombre: 'propuestas/prop_e.jpg', creado } as never],
        propuestas: [],
        ahora: AHORA,
      });
      expect(aBorrar, String(creado)).toEqual([]);
      expect(aRevisar, String(creado)).toEqual([]);
      expect(motivos['propuestas/prop_e.jpg'], String(creado)).toBe('recien-subido');
    }
  });

  it('lo que no está bajo `propuestas/<un segmento>` no se borra nunca', () => {
    // Mismo criterio que `decidirLimpieza`: no se toca lo que no se entiende. Y
    // desde que esto borra, es la guarda que impide que un objeto de la galería
    // —el flyer de una actividad publicada— llegue a `aBorrar`.
    for (const nombre of [
      'imagenes/img_a.jpg',
      'propuestas/sub/prop_a.jpg',
      'propuestas/',
      'miniaturas/img_a.jpg',
    ]) {
      const { aBorrar, aRevisar, motivos } = decidirFlyeresSinPlazo({
        objetos: [objeto(nombre)],
        propuestas: [],
        ahora: AHORA,
      });
      expect(aBorrar, nombre).toEqual([]);
      expect(aRevisar, nombre).toEqual([]);
      expect(motivos[nombre], nombre).toBe('fuera-del-alcance');
    }
  });

  it('un documento que nombra un objeto de la galería no la arrastra al borrado', () => {
    /*
     * Lo que este caso fija es el corte del lado del objeto: el de la galería
     * queda `fuera-del-alcance` y el flyer de la propuesta queda sin dueño
     * porque **su** documento nombra otra cosa. La guarda del índice —armarlo
     * con `objetoDePropuesta` y no con el path crudo— es defensa en profundidad
     * y hoy no es alcanzable (verificado por mutación cuando esto solo
     * relevaba); este caso no la afirma, para no declarar una cobertura que no
     * existe.
     */
    const { aBorrar, aRevisar, motivos } = decidirFlyeresSinPlazo({
      objetos: [objeto('propuestas/prop_f.jpg'), objeto('imagenes/img_x.jpg')],
      propuestas: [conFlyer('p3', 'aceptada', 'imagenes/img_x.jpg', ACEPTADA_HACE_MUCHO)],
      ahora: AHORA,
    });
    expect(motivos['imagenes/img_x.jpg']).toBe('fuera-del-alcance');
    expect(aBorrar.map((f) => f.objeto)).toEqual(['propuestas/prop_f.jpg']);
    expect(aRevisar).toEqual([]);
  });

  it('dos documentos que nombran el mismo objeto no se resuelven: se pide a alguien', () => {
    /*
     * Con un solo dueño por objeto ganaría el último, y si el último fuera una
     * aceptada vencida se borraría el flyer que una `nueva` todavía muestra en
     * la bandeja. `/proponer` genera un uuid por flyer, así que solo pasa con un
     * documento escrito a mano — y el orden de los dos va probado para los dos
     * lados.
     */
    const aceptada = conFlyer('p8', 'aceptada', 'propuestas/prop_n.jpg', ACEPTADA_HACE_MUCHO);
    const nueva = conFlyer('p9', 'nueva', 'propuestas/prop_n.jpg');
    for (const propuestas of [
      [aceptada, nueva],
      [nueva, aceptada],
    ]) {
      const { aBorrar, aRevisar } = decidirFlyeresSinPlazo({
        objetos: [objeto('propuestas/prop_n.jpg')],
        propuestas,
        ahora: AHORA,
      });
      expect(aBorrar).toEqual([]);
      expect(aRevisar).toEqual([
        { objeto: 'propuestas/prop_n.jpg', propuesta: null, motivo: 'varias-propuestas' },
      ]);
    }
  });

  it('un estado que caduca pero con fecha ilegible queda para revisar y no se borra', () => {
    /*
     * **Lo encontró el `auditor-trampas`**, y es la clase de B-88: dos lugares
     * que derivan por separado la misma pregunta —«¿el barrido va a pasar por
     * este documento?»—. `decidirRetencion` pide un plazo numérico **y** un reloj
     * legible; mirar solo la tabla daba por cubierta una propuesta que el
     * barrido no toca nunca. Y **no** se borra acá: la retención de ese estado
     * no se cambia, así que lo que corresponde es arreglarle la fecha.
     */
    const rota = {
      id: 'p7',
      estado: 'nueva',
      creadoEn: null,
      revision: { en: null },
      imagen: { storagePath: 'propuestas/prop_m.jpg' },
    };
    expect(decidirRetencion({ propuestas: [rota], ahora: AHORA }).motivos['p7']).toBe(
      'sin-fecha-legible',
    );

    const { aBorrar, aRevisar, motivos } = decidirFlyeresSinPlazo({
      objetos: [objeto('propuestas/prop_m.jpg')],
      propuestas: [rota],
      ahora: AHORA,
    });
    expect(motivos['propuestas/prop_m.jpg']).toBe('sin-fecha-legible');
    expect(aBorrar).toEqual([]);
    expect(aRevisar).toEqual([
      { objeto: 'propuestas/prop_m.jpg', propuesta: 'p7', motivo: 'sin-fecha-legible' },
    ]);
  });

  it('un estado que la tabla no nombra tampoco tiene quien lo borre, y no se borra de rebote', () => {
    /*
     * El hermano del caso `estado-<x>` de `decidirRetencion`: allá un estado
     * desconocido **no caduca**, así que acá su flyer **sí** necesita a alguien.
     * Y no entra a `aBorrar`: agregar un estado no puede empezar a borrar fotos
     * de terceros sin que nadie lo decida.
     */
    const { aBorrar, aRevisar } = decidirFlyeresSinPlazo({
      objetos: [objeto('propuestas/prop_g.jpg')],
      propuestas: [conFlyer('p4', 'archivada', 'propuestas/prop_g.jpg', ACEPTADA_HACE_MUCHO)],
      ahora: AHORA,
    });
    expect(aBorrar).toEqual([]);
    expect(aRevisar).toEqual([
      { objeto: 'propuestas/prop_g.jpg', propuesta: 'p4', motivo: 'archivada-sin-plazo' },
    ]);
  });

  it('el tope corta la lista y deja el motivo de lo que quedó para mañana', () => {
    const objetos = Array.from({ length: MAX_FLYERES_POR_CORRIDA + 3 }, (_, i) =>
      objeto(`propuestas/prop_t${String(i).padStart(3, '0')}.jpg`),
    );
    const { aBorrar, motivos } = decidirFlyeresSinPlazo({ objetos, propuestas: [], ahora: AHORA });
    expect(aBorrar).toHaveLength(MAX_FLYERES_POR_CORRIDA);
    const pendientes = Object.values(motivos).filter((m) => m === 'sin-propuesta-pendiente-por-tope');
    expect(pendientes).toHaveLength(3);
  });

  it('los estados sin plazo de documento salen de la tabla y son el complemento exacto', () => {
    expect(ESTADOS_SIN_PLAZO).toEqual(['aceptada']);
    expect([...ESTADOS_SIN_PLAZO, ...ESTADOS_QUE_CADUCAN].sort()).toEqual(
      [...ESTADOS_PROPUESTA].sort(),
    );
  });

  it('el margen del flyer en vuelo no está escrito en términos del de la limpieza de imágenes', () => {
    /*
     * MUTACIÓN PROBADA: con
     * `export const MARGEN_DEL_FLYER_EN_VUELO_MS = MARGEN_DE_GRACIA_MS;` —que deja
     * toda la suite en verde, porque el valor no cambia— este caso se pone rojo.
     * Son dos decisiones que hoy coinciden.
     */
    const declaracion = /export const MARGEN_DEL_FLYER_EN_VUELO_MS = ([^;]+);/.exec(
      fuente('functions/retencion.js'),
    );
    expect(declaracion, 'no se encontró la declaración del margen').not.toBeNull();
    expect(declaracion![1]).not.toContain('MARGEN_DE_GRACIA_MS');
  });

  it('el plazo del original aceptado son 30 días, y no está escrito en términos del de la rechazada', () => {
    /*
     * El dueño lo dijo como «el mismo plazo que la rechazada», y son dos
     * decisiones que hoy coinciden: aquél es cuánto se guarda el **documento**
     * de una rechazada —el margen de un arrepentimiento—; éste, cuánto se guarda
     * **la foto** de una propuesta que se cerró bien. Mismo criterio que
     * `MARGEN_SIN_TOCAR_MS`.
     */
    expect(MARGEN_DEL_ORIGINAL_ACEPTADO_MS).toBe(30 * DIA);
    const declaracion = /export const MARGEN_DEL_ORIGINAL_ACEPTADO_MS = ([^;]+);/.exec(
      fuente('functions/retencion.js'),
    );
    expect(declaracion, 'no se encontró la declaración del plazo').not.toBeNull();
    expect(declaracion![1]).not.toMatch(/MARGEN_/);
  });

  it('la Function y el script usan la misma decisión y el mismo borrado', () => {
    /*
     * Lo pedía el ítem: el informe en seco tiene que decir exactamente lo que la
     * corrida diaria va a hacer. Dos implementaciones del mismo barrido son la
     * clase de B-88.
     */
    const trigger = fuente('functions/retencion-trigger.js');
    const script = fuente('scripts/borrar-propuestas-vencidas.mjs');
    for (const [nombre, src] of [
      ['retencion-trigger.js', trigger],
      ['borrar-propuestas-vencidas.mjs', script],
    ] as const) {
      expect(src, nombre).toContain('await relevarFlyeresSinPlazo(db, bucket');
      expect(src, nombre).toContain('await borrarFlyer(db, bucket, flyer)');
      // Y ninguno borra un objeto de `propuestas/` por su cuenta en este camino.
      expect(src, nombre).not.toMatch(/decidirFlyeresSinPlazo\(/);
    }
  });

  it('lo que queda para revisar se loguea con la alerta de siempre', () => {
    const trigger = fuente('functions/retencion-trigger.js');
    const cuerpo = trigger.slice(
      trigger.indexOf('const barrerFlyeresDePropuestas'),
      trigger.indexOf('export const borrarPropuestasVencidas'),
    );
    expect(cuerpo, 'no se encontró el barrido de flyers').toContain('for (const f of aRevisar)');
    expect(cuerpo).toContain("alerta: 'flyer-de-propuesta-sin-borrar'");
    // Y va en el `finally`, después de B-1370.
    const handler = trigger.slice(trigger.indexOf('export const borrarPropuestasVencidas'));
    const fin = handler.indexOf('} finally {');
    expect(handler.indexOf('barrerOriginalesConCopia(db, bucket)', fin)).toBeGreaterThan(fin);
    expect(handler.indexOf('barrerFlyeresDePropuestas(db, bucket)', fin)).toBeGreaterThan(
      handler.indexOf('barrerOriginalesConCopia(db, bucket)', fin),
    );
  });

  it('cada motivo tiene su fila en el runbook', () => {
    /*
     * Un motivo que aparece en el informe o en el log a las tres de la mañana y
     * no está en `08-operacion.md` es un hallazgo sin instrucción. Se derivan
     * del código —corriendo la decisión— y no se enumeran a mano.
     */
    const { motivos } = decidirFlyeresSinPlazo({
      objetos: [
        objeto('propuestas/prop_h.jpg'),
        objeto('propuestas/prop_h2.jpg'),
        objeto('propuestas/prop_h3.jpg'),
        objeto('propuestas/prop_i.jpg'),
        objeto('propuestas/prop_j.jpg'),
        objeto('propuestas/prop_k.jpg', AHORA - DIA),
        objeto('propuestas/sub/prop_l.jpg'),
        objeto('propuestas/prop_m.jpg'),
        objeto('propuestas/prop_n.jpg'),
      ],
      propuestas: [
        conFlyer('p5', 'aceptada', 'propuestas/prop_h.jpg', ACEPTADA_HACE_MUCHO),
        conFlyer('p5b', 'aceptada', 'propuestas/prop_h2.jpg'),
        { id: 'p5c', estado: 'aceptada', revision: {}, imagen: { storagePath: 'propuestas/prop_h3.jpg' } },
        conFlyer('p6', 'nueva', 'propuestas/prop_j.jpg'),
        {
          id: 'p7',
          estado: 'nueva',
          creadoEn: null,
          revision: { en: null },
          imagen: { storagePath: 'propuestas/prop_m.jpg' },
        },
        conFlyer('p8', 'aceptada', 'propuestas/prop_n.jpg'),
        conFlyer('p9', 'nueva', 'propuestas/prop_n.jpg'),
      ],
      ahora: AHORA,
    });
    const vocabulario = [...new Set(Object.values(motivos))];
    expect(vocabulario, 'no se cubrieron los nueve motivos').toHaveLength(9);
    const runbook = fuente('docs/08-operacion.md');
    for (const motivo of vocabulario) {
      expect(runbook, `«${motivo}» no tiene fila en el runbook`).toContain(`| \`${motivo}\` |`);
    }
  });
});

/**
 * **`borrarFlyer` — las guardas que no dependen del emulador.** Lo que sí
 * depende —que la relectura vea de verdad la versión y que el `in` empate con el
 * nombre del bucket— está en `retencion.integracion.test.ts`.
 */
describe('borrarFlyer — no borra lo que no le toca (B-871)', () => {
  /** Un `db`/`bucket` que anotan qué se tocó y tiran si se toca lo que no. */
  const dobles = ({
    existe = true,
    version = 'v1',
    nombrado = false,
  }: { existe?: boolean; version?: string; nombrado?: boolean } = {}) => {
    const borrados: string[] = [];
    const db = {
      collection: () => ({
        doc: (id: string) => ({ id }),
        where: () => ({
          select: () => ({ limit: () => ({ get: async () => ({ empty: !nombrado }) }) }),
        }),
      }),
      getAll: async () => [
        { exists: existe, updateTime: { isEqual: (otra: unknown) => otra === version } },
      ],
    };
    const bucket = {
      file: (nombre: string) => ({
        delete: async () => {
          borrados.push(nombre);
        },
      }),
    };
    return { db, bucket, borrados };
  };

  it('fuera de `propuestas/<un segmento>` tira antes de tocar nada', async () => {
    for (const objeto of ['imagenes/img_a.jpg', 'propuestas/sub/x.jpg', 'propuestas/']) {
      const { db, bucket, borrados } = dobles();
      await expect(
        borrarFlyer(db as never, bucket as never, { objeto, propuesta: null, visto: null }),
        objeto,
      ).rejects.toThrow(/B-871/);
      expect(borrados, objeto).toEqual([]);
    }
  });

  it('el de una aceptada sin la versión vista tira: es un error de quien llama', async () => {
    const { db, bucket, borrados } = dobles();
    await expect(
      borrarFlyer(db as never, bucket as never, {
        objeto: 'propuestas/prop_a.jpg',
        propuesta: 'p1',
        visto: null,
      }),
    ).rejects.toThrow(/versión vista/);
    expect(borrados).toEqual([]);
  });

  it('si la reabrieron en el medio de la corrida, no la toca', async () => {
    const { db, bucket, borrados } = dobles({ version: 'v2' });
    const final = await borrarFlyer(db as never, bucket as never, {
      objeto: 'propuestas/prop_a.jpg',
      propuesta: 'p1',
      visto: 'v1',
    });
    expect(final).toBe('la-tocaron');
    expect(borrados).toEqual([]);
  });

  it('si sigue igual, borra el objeto y solo el objeto', async () => {
    const { db, bucket, borrados } = dobles();
    const final = await borrarFlyer(db as never, bucket as never, {
      objeto: 'propuestas/prop_a.jpg',
      propuesta: 'p1',
      visto: 'v1',
    });
    expect(final).toBe('borrado');
    expect(borrados).toEqual(['propuestas/prop_a.jpg']);
  });

  it('el huérfano que ganó su documento en el medio no se borra', async () => {
    const { db, bucket, borrados } = dobles({ nombrado: true });
    const final = await borrarFlyer(db as never, bucket as never, {
      objeto: 'propuestas/prop_c.jpg',
      propuesta: null,
      visto: null,
    });
    expect(final).toBe('lo-nombran');
    expect(borrados).toEqual([]);
  });

  it('una aceptada que ya no existe deja un huérfano, y se pregunta como tal', async () => {
    // Sin documento, la versión vista no dice nada: lo que decide es si algún
    // otro documento nombra el objeto.
    const nombrado = dobles({ existe: false, nombrado: true });
    expect(
      await borrarFlyer(nombrado.db as never, nombrado.bucket as never, {
        objeto: 'propuestas/prop_a.jpg',
        propuesta: 'p1',
        visto: 'v1',
      }),
    ).toBe('lo-nombran');
    const solo = dobles({ existe: false });
    expect(
      await borrarFlyer(solo.db as never, solo.bucket as never, {
        objeto: 'propuestas/prop_a.jpg',
        propuesta: 'p1',
        visto: 'v1',
      }),
    ).toBe('borrado');
    expect(solo.borrados).toEqual(['propuestas/prop_a.jpg']);
  });
});
