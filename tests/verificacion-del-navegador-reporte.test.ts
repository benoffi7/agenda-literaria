/**
 * **El endpoint del reporte de verificación** — B-930 paso 3, D-1225 a D-1228.
 *
 * `functions/verificacion-del-navegador.js` es puro: la decisión y el manejador
 * con el log y el reloj inyectados. Acá se prueban los dos sin el emulador de
 * Functions (D-660), con un `req`/`res` de mentira. Lo que no es ejecutable
 * —las opciones del `onRequest`, el export— se lee sobre el fuente, como en
 * `tests/alta-de-opcion-callable.test.ts`.
 *
 * Y el vocabulario: el panel manda un motivo que la Function valida contra su
 * lista, en dos runtimes que no se importan (clase de B-88). Si divergen, el
 * panel manda y la Function descarta en silencio, que es la peor forma de que
 * una alerta no llegue.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sinComentarios } from '../scripts/sin-comentarios.mjs';
import { REGION } from '../functions/despliegue.js';
import {
  ALERTA,
  crearManejador,
  decidirReporte,
  LARGO_MAXIMO_DEL_CUERPO,
  leerMotivo,
  MOTIVOS_DE_VERIFICACION,
  ORIGENES_PERMITIDOS,
  TOPE_POR_MINUTO,
  ventanaVacia,
} from '../functions/verificacion-del-navegador.js';
import {
  cuerpoDelReporte,
  FUNCTION_DEL_REPORTE,
  REGION_DEL_REPORTE,
  urlDelReporte,
} from '@/lib/reporteDeVerificacion';
import type { CausaSinVerificar } from '@/lib/verificacionDelNavegador';
import { SITIO } from '@/lib/rutasPublicas';

const ORIGEN = 'https://agendaleh.ar';
const pedido = (cambios: Partial<Parameters<typeof decidirReporte>[0]> = {}) => ({
  metodo: 'POST',
  origen: ORIGEN,
  cuerpo: '{"motivo":"sin-respuesta"}',
  ahora: 1_000_000,
  ventana: ventanaVacia(),
  ...cambios,
});

describe('el vocabulario es el mismo en el panel y en la Function (clase de B-88)', () => {
  it('cada causa del panel es un motivo que la Function acepta, y viceversa', () => {
    /*
     * El `satisfies` es la mitad de tipos: una causa nueva en el TS que no esté
     * en esta lista no compila. La otra mitad, que la lista no tenga de más,
     * la afirma el `toEqual` contra el JS.
     */
    const delPanel = [
      'no-se-activo',
      'token-rechazado',
      'sin-respuesta',
      'renovacion-fallida',
    ] as const satisfies readonly CausaSinVerificar[];
    expect([...MOTIVOS_DE_VERIFICACION].sort()).toEqual([...delPanel].sort());
    for (const motivo of delPanel) {
      expect(leerMotivo(cuerpoDelReporte(motivo)), motivo).toBe(motivo);
    }
  });

  it('el cuerpo más largo que manda el panel entra con margen en el tope', () => {
    for (const motivo of MOTIVOS_DE_VERIFICACION) {
      expect(cuerpoDelReporte(motivo as CausaSinVerificar).length).toBeLessThan(
        LARGO_MAXIMO_DEL_CUERPO / 2,
      );
    }
  });

  it('la URL del panel apunta al nombre y a la región de la Function', () => {
    expect(REGION_DEL_REPORTE).toBe(REGION);
    const trigger = sinComentarios(readFileSync('functions/verificacion-del-navegador-trigger.js', 'utf8'));
    expect(trigger).toContain(`export const ${FUNCTION_DEL_REPORTE} = onRequest(`);
    expect(urlDelReporte('agenda-literaria')).toBe(
      `https://southamerica-east1-agenda-literaria.cloudfunctions.net/${FUNCTION_DEL_REPORTE}`,
    );
  });

  it('el origen canónico del sitio está entre los permitidos', () => {
    // Si `SITIO` cambia y esta lista no, el panel del dominio nuevo reporta y
    // la Function lo descarta con un 403 que nadie lee.
    expect(ORIGENES_PERMITIDOS).toContain(SITIO);
  });
});

describe('leerMotivo — solo `{ motivo }` de la lista', () => {
  it.each([
    ['JSON roto', '{motivo:'],
    ['un motivo inventado', '{"motivo":"se-me-antojo"}'],
    ['un motivo que no es string', '{"motivo":1}'],
    ['una clave de más', '{"motivo":"sin-respuesta","uid":"abc"}'],
    ['sin motivo', '{}'],
    ['un array', '["sin-respuesta"]'],
    ['null', 'null'],
    ['un string suelto', '"sin-respuesta"'],
  ])('rechaza %s', (_, crudo) => {
    expect(leerMotivo(crudo)).toBeNull();
  });

  it('no es texto: null', () => {
    expect(leerMotivo(undefined)).toBeNull();
  });
});

describe('decidirReporte', () => {
  it('el pedido bueno se loguea y contesta 204', () => {
    const d = decidirReporte(pedido());
    expect(d).toMatchObject({ estado: 204, motivo: 'sin-respuesta' });
    expect(d.ventana.cuenta).toBe(1);
  });

  it.each([
    ['GET', { metodo: 'GET' }, 405],
    ['sin Origin', { origen: undefined }, 403],
    ['de otro sitio', { origen: 'https://otro.example' }, 403],
    // `web.app` pelado habilitaría cualquier sitio de Firebase Hosting (§ «Los
    // dominios permitidos» de 02-infraestructura).
    ['de web.app pelado', { origen: 'https://web.app' }, 403],
    ['sin cuerpo', { cuerpo: undefined }, 400],
    ['con un motivo inventado', { cuerpo: '{"motivo":"x"}' }, 400],
    ['con un cuerpo enorme', { cuerpo: `{"motivo":"sin-respuesta"}${' '.repeat(LARGO_MAXIMO_DEL_CUERPO)}` }, 413],
  ] as const)('%s: no loguea', (_, cambios, estado) => {
    const d = decidirReporte(pedido(cambios));
    expect(d.estado).toBe(estado);
    expect(d.motivo).toBeNull();
    expect(d.ventana).toEqual(ventanaVacia());
  });

  it('cada uno de los cuatro nombres del sitio puede reportar', () => {
    for (const origen of ORIGENES_PERMITIDOS) {
      expect(decidirReporte(pedido({ origen })).motivo, origen).toBe('sin-respuesta');
    }
  });

  /**
   * MUTACIÓN PROBADA: cambiando `vigente.cuenta >= TOPE_POR_MINUTO` por
   * `vigente.cuenta > TOPE_POR_MINUTO`, se loguea uno de más y este test se
   * pone rojo.
   */
  it('pasado el tope por minuto se descarta sin log, y contesta igual 204', () => {
    let ventana = ventanaVacia();
    const logueados: (string | null)[] = [];
    for (let i = 0; i < TOPE_POR_MINUTO + 3; i++) {
      const d = decidirReporte(pedido({ ahora: 1_000_000 + i * 1000, ventana }));
      ventana = d.ventana;
      expect(d.estado).toBe(204);
      logueados.push(d.motivo);
    }
    expect(logueados.filter(Boolean)).toHaveLength(TOPE_POR_MINUTO);
    expect(logueados.slice(TOPE_POR_MINUTO).every((m) => m === null)).toBe(true);
  });

  it('pasado el minuto, la ventana se renueva', () => {
    let ventana = ventanaVacia();
    for (let i = 0; i < TOPE_POR_MINUTO; i++) {
      ventana = decidirReporte(pedido({ ahora: 1_000_000, ventana })).ventana;
    }
    expect(decidirReporte(pedido({ ahora: 1_000_000, ventana })).motivo).toBeNull();
    expect(decidirReporte(pedido({ ahora: 1_000_000 + 60_000, ventana })).motivo).toBe(
      'sin-respuesta',
    );
  });

  it('lo rechazado no consume el tope', () => {
    let ventana = ventanaVacia();
    for (let i = 0; i < TOPE_POR_MINUTO * 2; i++) {
      ventana = decidirReporte(pedido({ origen: 'https://otro.example', ventana })).ventana;
    }
    expect(decidirReporte(pedido({ ventana })).motivo).toBe('sin-respuesta');
  });
});

describe('crearManejador — con dobles de req, res y logger', () => {
  const armar = (ahora = () => 1_000_000) => {
    const avisos: { mensaje: string; campos: Record<string, unknown> }[] = [];
    const manejar = crearManejador({
      avisar: (mensaje: string, campos: Record<string, unknown>) => avisos.push({ mensaje, campos }),
      ahora,
    });
    const llamar = (req: Record<string, unknown>) => {
      const res = {
        codigo: 0,
        terminado: false,
        status(c: number) {
          this.codigo = c;
          return this;
        },
        end() {
          this.terminado = true;
        },
      };
      manejar(req, res);
      return res;
    };
    return { avisos, llamar };
  };

  const req = (cambios: Record<string, unknown> = {}) => {
    const headers: Record<string, string> = {
      origin: ORIGEN,
      'user-agent': 'Mozilla/5.0 (algo muy identificable)',
      'x-forwarded-for': '203.0.113.7',
    };
    return {
      method: 'POST',
      headers,
      get: (h: string) => headers[h.toLowerCase()],
      rawBody: Buffer.from('{"motivo":"token-rechazado"}'),
      ...cambios,
    };
  };

  /**
   * **Lo que el log lleva es exactamente esto, y nada más.** Es la promesa de
   * privacidad del endpoint: ni IP, ni user agent, ni el origen.
   *
   * MUTACIÓN PROBADA: agregando `origen: d.origen` o `ua: req.get('user-agent')`
   * a los campos del `avisar`, el `toEqual` se pone rojo.
   */
  it('loguea la alerta con el motivo y nada de la persona', () => {
    const { avisos, llamar } = armar();
    const res = llamar(req());
    expect(res.codigo).toBe(204);
    expect(res.terminado).toBe(true);
    expect(avisos).toHaveLength(1);
    expect(avisos[0].campos).toEqual({ alerta: ALERTA, motivo: 'token-rechazado' });
    expect(JSON.stringify(avisos)).not.toMatch(/203\.0\.113|Mozilla|agendaleh/);
  });

  it('la alerta es la que engancha la política de B-871', () => {
    expect(ALERTA).toBe('verificacion-del-navegador');
  });

  it('un `body` ya parseado (sin `rawBody`) se lee igual', () => {
    const { avisos, llamar } = armar();
    llamar(req({ rawBody: undefined, body: { motivo: 'sin-respuesta' } }));
    expect(avisos[0].campos.motivo).toBe('sin-respuesta');
  });

  it('un GET no loguea y contesta 405', () => {
    const { avisos, llamar } = armar();
    expect(llamar(req({ method: 'GET' })).codigo).toBe(405);
    expect(avisos).toHaveLength(0);
  });

  it('el tope vive en la instancia: el manejador lo recuerda entre pedidos', () => {
    const { avisos, llamar } = armar();
    for (let i = 0; i < TOPE_POR_MINUTO + 4; i++) llamar(req());
    expect(avisos).toHaveLength(TOPE_POR_MINUTO);
  });
});

describe('el trigger, leído sobre el fuente', () => {
  const trigger = () =>
    sinComentarios(readFileSync('functions/verificacion-del-navegador-trigger.js', 'utf8'));

  it('no exige App Check: es justo lo que falta (D-1225)', () => {
    expect(trigger()).not.toContain('enforceAppCheck');
    expect(trigger()).toContain("invoker: 'public'");
  });

  it('una sola instancia: es lo que hace del tope por instancia un tope del endpoint', () => {
    expect(trigger()).toContain('maxInstances: 1,');
  });

  it('CORS con la lista de orígenes, no `cors: true`', () => {
    expect(trigger()).toContain('cors: [...ORIGENES_PERMITIDOS]');
    expect(trigger()).not.toMatch(/cors:\s*true/);
  });

  it('declara región y cuenta de servicio, y no las hereda (D-35)', () => {
    expect(trigger()).toContain('region: REGION');
    expect(trigger()).toContain('serviceAccount: CUENTA_DE_SERVICIO');
  });

  it('loguea con `warn`, que es lo que toma `severity>=WARNING`', () => {
    expect(trigger()).toContain('logger.warn(');
  });

  it('está exportada en `index.js`: una Function que no se exporta no se despliega', () => {
    expect(sinComentarios(readFileSync('functions/index.js', 'utf8'))).toContain(
      "export { reportarVerificacionDelNavegador } from './verificacion-del-navegador-trigger.js';",
    );
  });
});
