/**
 * **La callable del publicador, leída sobre el fuente** — B-893.
 *
 * La decisión es pura y tiene sus casos en `tests/alta-de-opcion.test.ts`; la
 * transacción, contra el emulador, en `tests/alta-de-opcion.integracion.test.ts`.
 * Lo que queda es lo que **no es ejecutable** sin el emulador de Functions (que
 * el CI no levanta, D-660): las opciones del `onCall`, el orden de los portones
 * y que la Function esté exportada. Mismo criterio que
 * `tests/flyer-por-callable.test.ts` para la otra callable.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sinComentarios } from '../scripts/sin-comentarios.mjs';
import { REGION } from '../functions/despliegue.js';

const fuente = (rel: string): string => readFileSync(rel, 'utf8');

const TRIGGER = 'functions/alta-de-opcion-trigger.js';
const codigo = () => sinComentarios(fuente(TRIGGER));

describe('crearOpcionDelPanel — B-893', () => {
  it('exige App Check, como la otra callable y como Firestore', () => {
    /*
     * `sinComentarios`: el docblock del trigger nombra `enforceAppCheck: true`
     * para explicarlo, y un chequeo de presencia sobre el fuente crudo pasaría
     * con la opción borrada.
     *
     * MUTACIÓN PROBADA: borrar la línea `enforceAppCheck: true,` del trigger.
     */
    expect(codigo()).toContain('enforceAppCheck: true');
    expect(codigo()).not.toContain('enforceAppCheck: false');
  });

  it('está exportada en `index.js`: una Function que no se exporta no se despliega', () => {
    expect(sinComentarios(fuente('functions/index.js'))).toContain(
      "export { crearOpcionDelPanel } from './alta-de-opcion-trigger.js';",
    );
    expect(codigo()).toContain('export const crearOpcionDelPanel = onCall(');
  });

  it('declara región y cuenta de servicio, y no las hereda (D-35)', () => {
    expect(codigo()).toContain('region: REGION');
    expect(codigo()).toContain('serviceAccount: CUENTA_DE_SERVICIO');
  });

  it('solo el admin crea aprobado: el publicador, nunca', () => {
    /*
     * Es la mitad de B-893 que pidió el dueño: «las etiquetas nuevas entran sin
     * aprobar». Si esto dijera `rol !== null` o `true`, el publicador crearía
     * vocabulario visible para todo el sitio sin que nadie lo revise.
     *
     * MUTACIÓN PROBADA: cambiar `aprobada: rol === 'admin'` por `aprobada: true`.
     */
    expect(codigo()).toContain("aprobada: rol === 'admin'");
    expect(codigo().match(/aprobada:/g)).toHaveLength(1);
  });

  it('los portones van antes de la escritura: sesión, rol, pedido', () => {
    const src = codigo();
    const escritura = src.indexOf('aplicarAltaDeOpcion(getFirestore()');
    expect(escritura).toBeGreaterThan(0);
    for (const porton of ['if (!peticion.auth)', 'if (!rol)', 'if (rechazo)']) {
      const i = src.indexOf(porton);
      expect(i, `no se encontró \`${porton}\``).toBeGreaterThan(0);
      expect(i, `\`${porton}\` tiene que ir antes de escribir`).toBeLessThan(escritura);
    }
  });

  it('el uid que marca la opción es el de la sesión, no uno que mande el cliente', () => {
    // La huella es lo que hace que la etiqueta le aparezca a quien la creó; si
    // saliera del cuerpo del pedido, cualquiera podría crear a nombre de otro.
    expect(codigo()).toContain('uid: peticion.auth.uid');
    expect(codigo()).not.toMatch(/peticion\.data\.uid|pedido\.uid/);
  });

  it('el nombre y la región que usa el panel son los de la Function (clase de B-88)', () => {
    /*
     * Productor y consumidor en dos runtimes que no se pueden importar entre sí:
     * con el nombre equivocado el SDK contesta `functions/not-found`, y con la
     * región equivocada le pega a `us-central1` — los dos recién en runtime, o
     * sea cuando un publicador guarda.
     */
    const cliente = fuente('src/lib/opcion-por-function.ts');
    const nombre = /const CALLABLE_OPCION = '([^']+)'/.exec(cliente)?.[1];
    expect(nombre).toBe('crearOpcionDelPanel');
    expect(sinComentarios(fuente('functions/index.js'))).toContain(`export { ${nombre} }`);
    expect(/const REGION_FUNCTIONS = '([^']+)'/.exec(cliente)?.[1]).toBe(REGION);
  });

  it('el guardado del publicador pasa por la callable', () => {
    // El otro extremo del cable: sin esto, el panel podría seguir salteando las
    // etiquetas del publicador y todo lo de arriba estaría verde sin usarse.
    const guardar = sinComentarios(fuente('src/lib/formulario/guardar.ts'));
    expect(guardar).toContain("import { proponerOpcion } from '@/lib/opcion-por-function';");
    expect(guardar).toMatch(/await proponerOpcion\(campo, label, slugify\(label\)\)/);
  });
});
