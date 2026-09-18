/**
 * «La regla denegó» y «la regla tiró» no son lo mismo — B-1130.
 *
 * Todo test de reglas de este repo afirma lo mismo: *esta operación tiene que
 * ser rechazada*. Hasta acá lo verificaba mirando el `code` de la
 * `FirebaseError`, que es `permission-denied`. Ese chequeo era correcto para lo
 * que resolvía —separar «la regla denegó» de «no se pudo preguntar»
 * (`unavailable`, el emulador caído)— y sigue estando acá. **Lo que faltaba es
 * la segunda pregunta**, porque `permission-denied` también es lo que llega
 * cuando la regla **explotó antes de contestar**: un error de evaluación deniega
 * igual, y un caso que solo mira el `code` no puede notar la diferencia.
 *
 * ── Qué dice la traza, y por qué no alcanza con buscar «evaluation error» ──
 * El `message` trae la evaluación, con un término por **puerta** —una operación
 * y la línea del `allow` que la resolvió— separados por comas:
 *
 *     false for 'create' @ L1110, false for 'create' @ L3089
 *
 * Y hay tres formatos de término para el mismo `permission-denied`, medidos el
 * 2026-09-18 contra un emulador efímero:
 *
 *   | término | qué pasó |
 *   |---|---|
 *   | `false for 'create' @ L1110` | la regla corrió y dijo que no |
 *   | `evaluation error at L1110:24 for 'create' @ L1110` | algo explotó |
 *   | `Property y is undefined on object. for 'create' @ L5` | también explotó |
 *
 * El tercero **no dice «evaluation error»** aunque lo sea, así que un matcher
 * por esa frase habría dejado pasar la mitad de los casos. Y el primero tampoco
 * se puede buscar a secas, por lo que sigue.
 *
 * ── La corrección al diagnóstico del ítem, que es lo que define este helper ─
 * B-1130 se abrió diciendo que un `serverTimestamp()` en un documento denegado
 * convierte el rechazo en un error de evaluación y **que por eso el caso
 * negativo no probaba nada**. La primera mitad es cierta; la segunda no, y
 * verificarlo cambió el arreglo entero:
 *
 *   - **La cláusula sí se evalúa.** Con la regla entera, el documento de origen
 *     incorrecto es rechazado; **sacando la cláusula del origen, el mismo
 *     documento escribe**. O sea que el caso negativo se pone rojo si la
 *     cláusula deja de estar: era un caso válido, no un falso verde.
 *   - **El `evaluation error` es de una pasada intermedia.** Un documento con un
 *     sentinel de transformación —`serverTimestamp()`, y también `increment()`—
 *     se evalúa dos veces, y la primera ve el sentinel sin resolver. Por eso la
 *     traza del sentinel trae el error **y**, para la misma puerta, un `false`:
 *
 *         evaluation error at L5:24 for 'create' @ L5, false for 'create' @ L5
 *
 *     Mientras que la de un error de verdad no trae ningún `false` para esa
 *     puerta:
 *
 *         evaluation error at L5:24 for 'create' @ L5,
 *         Property noExiste is undefined on object. for 'create' @ L5
 *
 * **Por eso lo que se mira es si alguna evaluación terminó en `false`, y no si
 * alguna falló.** Buscar «evaluation error» en el mensaje habría puesto rojos
 * 197 casos que estaban bien.
 *
 * ── Y se agrupa por operación, que es la segunda vuelta de lo mismo ────────
 * Un `setDoc` sobre un documento que no existe hace que el emulador evalúe
 * **`create` y `update`**, y la de `update` no puede contestar: lee
 * `resource.data` de un documento que no está. Esa puerta aparece como error en
 * casi todo caso negativo de creación —76 de los 121 rojos de la primera
 * corrida— y no dice nada sobre la cláusula que el caso prueba.
 *
 * Así que la pregunta es por **operación**: una operación contestó si alguna de
 * sus puertas dio `false`, y solo se reporta cuando **ninguna** contestó. Es
 * conservador a propósito, y el límite conviene dejarlo escrito: si la
 * operación pedida explota pero **otra** —de las que el emulador evalúa por su
 * cuenta— contesta `false`, esto lo da por limpio. Para que eso pase, la regla
 * de la otra operación tiene que no leer `resource.data`, que es justo lo
 * contrario de lo que hacen las de este repo.
 *
 * ── Y es una lista blanca ──────────────────────────────────────────────────
 * Lo que cuenta como denegación se enumera; **cualquier otra cosa es un
 * throw**, incluido el formato que el emulador invente en su próxima versión.
 * Mismo criterio que `toPublic.ts` (§5.2 del `CLAUDE.md`): si algo nuevo no se
 * agrega a mano, no pasa. El modo de falla es marcar de más —se ve en el primer
 * rojo y se arregla agregando el término— y es el que se quiere: al revés se
 * pierden años.
 *
 * `tests/rechazos-del-emulador.test.ts` fija los mensajes medidos, y
 * `tests/rechazos-sin-copia.test.ts` impide que la copia diez vuelva a nacer —
 * las **nueve** que este archivo reemplaza diferían entre sí, que es el costo
 * real de la copia y no el tipeo (B-1060).
 */
import { expect } from 'vitest';

/**
 * El prefijo que el transporte le pega adelante. Está en las escrituras
 * (`7 PERMISSION_DENIED: `) y no en las lecturas, así que se saca antes de
 * mirar la traza en vez de tener dos juegos de patrones.
 */
const PREFIJO_DEL_TRANSPORTE = /^\s*(?:\d+\s+)?PERMISSION_DENIED:\s*/;

/**
 * Un rechazo de producción, sin traza: Firestore de verdad no manda la
 * evaluación. Acá casi no se ve —el emulador siempre traza— pero es la forma
 * que llega en el navegador, y dejarla afuera volvería inútil al helper contra
 * cualquier captura real.
 */
const SIN_TRAZA = 'Missing or insufficient permissions.';

/**
 * Un término de la traza, partido en «qué pasó» y «en qué puerta».
 *
 * La puerta es `operación @ línea`: la misma línea puede aparecer varias veces
 * —una evaluación por pasada— y es justamente lo que hay que juntar.
 */
const TERMINO = /^(.*?) for '([a-z]+)' @ L(\d+)$/;

/** La regla corrió y dijo que no. */
const DENEGO = 'false';

/**
 * El `evaluation error` **sin mensaje propio**, que es mecánica del emulador y
 * no una regla rota.
 *
 * Aparece en dos situaciones medidas, las dos inevitables y las dos ajenas a la
 * cláusula que el caso prueba:
 *
 *  - la pasada que ve un sentinel de transformación sin resolver, y
 *  - la puerta que **no aplica** a la operación pedida: un `setDoc` sobre un
 *    documento que no existe evalúa también el `allow update`, que lee
 *    `resource.data` de algo que no está.
 *
 * Un error de los que importan trae su propia frase —`Property … is undefined on
 * object.`, `Function not found error: Name: [size].`, `Null value error.`— y por
 * eso se reporta aunque venga acompañado de éste.
 */
const RUIDO_DEL_EMULADOR = /^evaluation error at L\d+:\d+$/;

/**
 * Los términos que explican el rechazo cuando la puerta que los emitió **nunca
 * llegó a contestar**; `[]` si toda puerta con un problema de verdad terminó,
 * en alguna pasada, en un `false`.
 *
 * Es puro para que tenga test sin emulador: los mensajes que fija
 * `tests/rechazos-del-emulador.test.ts` son transcripciones de una corrida, no
 * invenciones.
 */
export const evaluacionesSinRespuesta = (mensaje: string): string[] => {
  const cuerpo = mensaje.replace(PREFIJO_DEL_TRANSPORTE, '').trim();
  if (cuerpo === '' || cuerpo === SIN_TRAZA) return [];

  const puertas = new Map<string, { contesto: boolean; motivos: string[] }>();
  for (const termino of cuerpo.split(', ').map((t) => t.trim())) {
    if (termino === '') continue;
    const m = TERMINO.exec(termino);
    // Un término con una forma que no conocemos es su propia puerta, y una que
    // no contestó: lo que no se entiende no se da por bueno.
    const clave = m === null ? termino : `${m[2]} @ L${m[3]}`;
    const puerta = puertas.get(clave) ?? { contesto: false, motivos: [] };
    if (m !== null && m[1] === DENEGO) puerta.contesto = true;
    else if (m === null || !RUIDO_DEL_EMULADOR.test(m[1])) puerta.motivos.push(termino);
    puertas.set(clave, puerta);
  }

  return [...puertas.values()].filter((p) => !p.contesto).flatMap((p) => p.motivos);
};

export type Veredicto =
  /** La regla corrió y dijo que no. Es lo único que un caso negativo quiere. */
  | { clase: 'denegada' }
  /** Ninguna regla llegó a contestar. Deniega igual, y no probó nada. */
  | { clase: 'tiro'; trazas: string[] }
  /** Ni siquiera se pudo preguntar (el emulador caído es `unavailable`). */
  | { clase: 'otro'; code: string | undefined };

export const clasificarRechazo = (error: unknown): Veredicto => {
  const e = error as { code?: string; message?: string } | undefined;
  if (e?.code !== 'permission-denied') return { clase: 'otro', code: e?.code };
  const trazas = evaluacionesSinRespuesta(e.message ?? '');
  return trazas.length > 0 ? { clase: 'tiro', trazas } : { clase: 'denegada' };
};

/** El cuerpo compartido: corre la operación y devuelve el error, o `undefined`. */
const elErrorDe = async (operacion: Promise<unknown>): Promise<unknown> => {
  try {
    await operacion;
    return undefined;
  } catch (e) {
    return e;
  }
};

const noEsUnaRegla = (que: string, code: string | undefined): never =>
  expect.fail(
    `${que}: se rechazó, pero no por permisos (code=${code ?? 'sin code'}). ` +
      '`unavailable` es el emulador caído, no una regla.',
  );

/**
 * **La regla corrió y denegó.** Es el helper que usan los casos negativos.
 *
 * `que` describe el caso y sale en el mensaje del rojo: sin él, veintisiete
 * aserciones del mismo `it` fallan con el mismo texto. Es opcional porque los
 * archivos que venían de `rejects.toThrow(RECHAZADA)` a secas no lo tenían — no
 * porque dé igual ponerlo.
 */
export const denegada = async (operacion: Promise<unknown>, que = 'la operación'): Promise<void> => {
  const error = await elErrorDe(operacion);
  expect(error, `${que}: NO se rechazó`).toBeDefined();

  const v = clasificarRechazo(error);
  if (v.clase === 'otro') noEsUnaRegla(que, v.code);
  if (v.clase === 'tiro') {
    expect.fail(
      `${que}: la regla NO denegó — nunca contestó, y un throw deniega igual (B-1130).\n` +
        `  ${v.trazas.join('\n  ')}\n` +
        'Ninguna evaluación terminó en `false`, así que la cláusula que este caso ' +
        'dice probar no llegó a correr. Suele ser una regla que lee un campo que ' +
        'el documento no tiene, o que llama un método sobre un tipo que no lo ' +
        'tiene. Si lo que el caso afirma es que la puerta está cerrada y da igual ' +
        'por dónde, decilo con `denegadaOReglaQueTira()`.',
    );
  }
};

/**
 * **La puerta está cerrada, y da igual si la regla denegó o tiró.**
 *
 * La excepción con nombre, para el caso que afirma que nadie pasa y no una
 * cláusula en particular — el de la trampa 7, por ejemplo, donde lo que se
 * quiere ver es justamente que la regla no se puede evaluar. No es un parámetro
 * del helper de arriba porque `denegada(p, q, { permitirThrow: true })` se
 * escribe sin pensar y no se lee en un diff. Un nombre distinto sí.
 */
export const denegadaOReglaQueTira = async (
  operacion: Promise<unknown>,
  que = 'la operación',
): Promise<void> => {
  const error = await elErrorDe(operacion);
  expect(error, `${que}: NO se rechazó`).toBeDefined();

  const v = clasificarRechazo(error);
  if (v.clase === 'otro') noEsUnaRegla(que, v.code);
};
