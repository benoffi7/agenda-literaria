/**
 * Los mensajes del emulador, transcritos — B-1130.
 *
 * Cada string de este archivo salió de una corrida contra un emulador efímero
 * el 2026-09-18, no de la imaginación de nadie. Es lo que hace que el
 * clasificador de `tests/fixtures/rechazos-del-emulador.ts` sea verificable sin
 * emulador: la parte que decide es pura, y lo único que hay que sostener es que
 * estas formas son las que llegan de verdad.
 *
 * **El par que define el helper son `sentinel` y `errorGenuino`**: los dos
 * traen un `evaluation error` en el mismo lugar, y solo uno de los dos es un
 * problema. Lo que los separa es si alguna evaluación de esa puerta terminó en
 * `false`. La mutación que lo probó está en el docblock del helper.
 *
 * **Si el emulador cambia el formato**, este archivo es el que se pone rojo
 * primero —y tiene que ponerse rojo—: un formato nuevo entra a la lista blanca
 * a mano, con alguien mirándolo, que es la decisión de D-88 aplicada a los
 * mensajes de un runtime ajeno.
 */
import { describe, expect, it } from 'vitest';
import { clasificarRechazo, evaluacionesSinRespuesta } from './fixtures/rechazos-del-emulador';

/** Las formas medidas. Los saltos de línea son los del emulador. */
const MENSAJES = {
  create: "7 PERMISSION_DENIED: \nfalse for 'create' @ L1110, false for 'create' @ L3089",
  get: "\nfalse for 'get' @ L1063, false for 'get' @ L3089",
  update: "7 PERMISSION_DENIED: \nfalse for 'update' @ L1112, false for 'update' @ L3089",
  delete: "7 PERMISSION_DENIED: \nfalse for 'delete' @ L1117, false for 'delete' @ L3089",
  /**
   * El `create` anónimo de `/propuestas` con `serverTimestamp()`: el caso que
   * abrió B-1130. La puerta L1110 aparece **dos veces** —una por pasada de
   * evaluación— y la segunda dice `false`: la regla corrió.
   */
  sentinel:
    "7 PERMISSION_DENIED: \nevaluation error at L1110:24 for 'create' @ L1110, " +
    "false for 'create' @ L3089, false for 'update' @ L1112, false for 'update' @ L3089, " +
    "false for 'create' @ L1110, false for 'create' @ L3089",
  /**
   * Una regla que lee un campo que el documento no tiene, con el mismo sentinel
   * en el documento. Mismo `evaluation error` que arriba, y **ningún `false`**
   * para esa puerta: acá la cláusula nunca contestó.
   */
  errorGenuino:
    "7 PERMISSION_DENIED: \nevaluation error at L5:24 for 'create' @ L5, " +
    "Property noExiste is undefined on object. for 'create' @ L5",
  /** El mismo error sin sentinel: **no dice «evaluation error»** en ninguna parte. */
  campoAusente:
    "7 PERMISSION_DENIED: \nProperty y is undefined on object. for 'create' @ L5, " +
    "Property y is undefined on object. for 'create' @ L5",
  /**
   * Un `create` denegado limpio: la puerta de `create` dice `false` y la de
   * `update` —que el emulador evalúa igual— explota porque el documento no
   * existe todavía. Es la forma de casi todo caso negativo de creación.
   */
  createConUpdateQueNoAplica:
    "7 PERMISSION_DENIED: \nfalse for 'create' @ L1640, " +
    "evaluation error at L1642:24 for 'update' @ L1642",
  /** Producción: sin traza. */
  produccion: 'Missing or insufficient permissions.',
} as const;

const err = (message: string, code = 'permission-denied') => ({ code, message });

describe('denegación limpia contra regla que nunca contestó — B-1130', () => {
  describe('la parte pura: qué puertas no contestaron', () => {
    it('una denegación de escritura no deja ninguna puerta sin contestar', () => {
      expect(evaluacionesSinRespuesta(MENSAJES.create)).toEqual([]);
      expect(evaluacionesSinRespuesta(MENSAJES.update)).toEqual([]);
      expect(evaluacionesSinRespuesta(MENSAJES.delete)).toEqual([]);
    });

    it('una lectura denegada tampoco, aunque no traiga el prefijo del transporte', () => {
      // Es la asimetría que el docblock de `actividades.integracion.test.ts`
      // ya había pagado: el `7 PERMISSION_DENIED:` está en las escrituras y no
      // en las lecturas.
      expect(evaluacionesSinRespuesta(MENSAJES.get)).toEqual([]);
    });

    it('el rechazo de producción, sin traza, cuenta como denegación', () => {
      expect(evaluacionesSinRespuesta(MENSAJES.produccion)).toEqual([]);
    });

    it('el ruido del sentinel NO se reporta: la misma puerta terminó en `false`', () => {
      // Los 197 casos que este renglón salva. El `evaluation error` es de la
      // pasada que ve el sentinel sin resolver; la regla corrió igual.
      expect(evaluacionesSinRespuesta(MENSAJES.sentinel)).toEqual([]);
    });

    it('el error de verdad sí, y trae el mismo `evaluation error` que el anterior', () => {
      // Lo que se reporta es la frase propia del error, no el `evaluation
      // error` que la acompaña: ése aparece en los dos mensajes y por sí solo
      // no distingue nada.
      expect(evaluacionesSinRespuesta(MENSAJES.errorGenuino)).toEqual([
        "Property noExiste is undefined on object. for 'create' @ L5",
      ]);
    });

    it('el campo ausente se marca aunque no diga «evaluation error»', () => {
      // La razón de que esto sea una lista blanca: buscar la frase habría dejado
      // pasar este caso entero.
      expect(evaluacionesSinRespuesta(MENSAJES.campoAusente)).toEqual([
        "Property y is undefined on object. for 'create' @ L5",
        "Property y is undefined on object. for 'create' @ L5",
      ]);
    });

    it('un formato que el emulador todavía no inventó se marca, no se asume limpio', () => {
      expect(evaluacionesSinRespuesta('vaya a saber qué')).toEqual(['vaya a saber qué']);
      expect(evaluacionesSinRespuesta("boom for 'create' @ L5")).toEqual([
        "boom for 'create' @ L5",
      ]);
    });

    it('el `update` que el emulador evalúa de más en un `create` no se reporta', () => {
      // 76 de los 121 rojos de la primera corrida eran esto: un `setDoc` sobre
      // un documento que no existe evalúa `create` **y** `update`, y la de
      // `update` no puede contestar porque lee `resource.data` de algo que no
      // está. La operación pedida contestó, así que la denegación es limpia.
      expect(
        evaluacionesSinRespuesta(MENSAJES.createConUpdateQueNoAplica),
      ).toEqual([]);
    });

    it('y el límite de eso, escrito: es el `evaluation error` pelado lo que se tolera', () => {
      // La contracara del caso de arriba, y el precio de no saber qué operación
      // pidió quien llama: una regla que explote **sin** frase propia pasa por
      // ruido. Queda fijado para que el día que muerda se lea acá y no se
      // descubra de nuevo.
      expect(evaluacionesSinRespuesta("evaluation error at L9:24 for 'get' @ L9")).toEqual([]);

      // Con la frase propia, en cambio, se reporta aunque otra puerta haya
      // contestado: el `false` de una operación no dice nada sobre otra.
      expect(
        evaluacionesSinRespuesta(
          "Property x is undefined on object. for 'create' @ L10, false for 'update' @ L20",
        ),
      ).toEqual(["Property x is undefined on object. for 'create' @ L10"]);
    });
  });

  describe('el veredicto', () => {
    it('separa «denegó» de «nunca contestó» con el mismo code en las dos', () => {
      // Los dos son `permission-denied`: ésta es exactamente la distinción que
      // las nueve copias del helper viejo no podían hacer.
      expect(clasificarRechazo(err(MENSAJES.create))).toEqual({ clase: 'denegada' });
      expect(clasificarRechazo(err(MENSAJES.sentinel))).toEqual({ clase: 'denegada' });
      expect(clasificarRechazo(err(MENSAJES.errorGenuino))).toEqual({
        clase: 'tiro',
        trazas: ["Property noExiste is undefined on object. for 'create' @ L5"],
      });
    });

    it('el emulador caído no es una regla que denegó', () => {
      expect(clasificarRechazo(err('no se pudo conectar', 'unavailable'))).toEqual({
        clase: 'otro',
        code: 'unavailable',
      });
    });

    it('un error que no es de Firebase tampoco', () => {
      expect(clasificarRechazo(new Error('cualquier cosa'))).toEqual({
        clase: 'otro',
        code: undefined,
      });
    });
  });
});
