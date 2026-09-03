import { describe, expect, it } from 'vitest';
import {
  MARCA_SIN_CONFIGURAR as MARCA_SIN_CONFIGURAR_PANEL,
  MAX_MOTIVO,
  ctrLegible,
  diaLegible,
  leerResumenDelSitio,
  periodoLegible,
  variacionLegible,
} from '@/lib/resumenDelSitio';
import {
  MARCA_SIN_CONFIGURAR as MARCA_SIN_CONFIGURAR_FUNCTION,
  MAX_MOTIVO as MAX_MOTIVO_FUNCTION,
  MOTIVOS_SIN_CONFIGURAR,
  documentoDeAnalitica,
  resumenGa4,
  resumenSearchConsole,
} from '../functions/analitica.js';

/**
 * La lectura del resumen desde el panel — B-374 y B-373, `lib/resumenDelSitio.ts`.
 *
 * ── Los dos lados que este archivo ata ─────────────────────────────────────
 * El productor del documento es `functions/analitica.js` y el consumidor es
 * este módulo, y son dos paquetes distintos que **nunca se importan entre
 * sí**. Es exactamente la clase de bug que este repo persigue: un formato con
 * un productor y un consumidor que derivan por separado. Así que los casos de
 * abajo no arman el documento a mano donde importa — lo arman **con el
 * productor real** (`documentoDeAnalitica`), que es lo único que hace que un
 * cambio de forma en la Function ponga esto en rojo.
 *
 * Los que sí van a mano son los casos de documento **degradado**: el que
 * escribió un deploy anterior, el que llegó con un campo de menos, el que trae
 * un string donde iba un número. Esos no los puede producir el productor de
 * hoy, y son justamente los que la pantalla se va a encontrar.
 *
 * ── Y lo que verifica de verdad ────────────────────────────────────────────
 * **D-272**: que las cuatro situaciones que se ven parecidas en la pantalla
 * sean distinguibles acá. La que importa más es la cuarta: `sin-datos` con la
 * API contestando perfecto y el número en cero, que es el estado del primer
 * mes de medición y el que un tablero corriente muestra como «0 visitas».
 */

const VENTANA = { desde: '2026-09-17', hasta: '2026-10-14' };

const informe = (metricas: string[]) => ({
  rows: [{ metricValues: metricas.map((value) => ({ value })) }],
  rowCount: 1,
});

const conFilas = (filas: [string, string][]) => ({
  rows: filas.map(([clave, valor]) => ({
    dimensionValues: [{ value: clave }],
    metricValues: [{ value: valor }],
  })),
  rowCount: filas.length,
});

const informesGa4 = (opciones: { vacio?: boolean } = {}) =>
  opciones.vacio
    ? {
        totales: informe(['0', '0', '0']),
        paginas: { rowCount: 0 },
        canales: { rowCount: 0 },
        dispositivos: { rowCount: 0 },
        eventos: { rowCount: 0 },
      }
    : {
        totales: informe(['412', '317', '1103']),
        paginas: conFilas([
          ['/', '480'],
          ['/cartelera/', '96'],
        ]),
        canales: conFilas([['Organic Search', '210']]),
        dispositivos: conFilas([['mobile', '330']]),
        eventos: conFilas([['clic_inscripcion', '37']]),
      };

/** El documento tal cual lo escribe la Function, con las dos mitades en ok. */
const documentoReal = (opciones: { vacio?: boolean } = {}) =>
  JSON.parse(
    JSON.stringify(
      documentoDeAnalitica({
        ga4: {
          ok: true,
          resumen: resumenGa4({
            actual: informesGa4(opciones),
            /*
             * La ventana anterior acompaña a la actual: con el sitio recién
             * midiendo, las dos están en cero —que es lo que hace que la
             * variación sea `null` y no −100 %—; con datos, la anterior es
             * menor, para que la variación salga positiva y se pueda leer.
             */
            anterior: opciones.vacio
              ? informesGa4({ vacio: true })
              : {
                  totales: informe(['300', '250', '900']),
                  paginas: { rowCount: 0 },
                  canales: { rowCount: 0 },
                  dispositivos: { rowCount: 0 },
                  eventos: { rowCount: 0 },
                },
            primerDia: opciones.vacio
              ? { rowCount: 0 }
              : { rows: [{ dimensionValues: [{ value: '20260903' }] }] },
            ventana: VENTANA,
          }),
        },
        searchConsole: {
          ok: true,
          resumen: resumenSearchConsole({
            busquedas: opciones.vacio
              ? {}
              : {
                  rows: [
                    {
                      keys: ['taller de escritura'],
                      clicks: 14,
                      impressions: 320,
                      ctr: 0.04375,
                      position: 8.42,
                    },
                  ],
                },
            paginas: {},
            ventana: { desde: '2026-09-15', hasta: '2026-10-12' },
          }),
        },
        generadoEn: '2026-10-15T10:00:00.000Z',
      }),
    ),
  );

// ─────────────────────────────────────────────────────────────────────
// 1 · Las cuatro situaciones — D-272
// ─────────────────────────────────────────────────────────────────────

describe('las cuatro situaciones se distinguen — D-272', () => {
  it('sin documento: la Function nunca corrió', () => {
    for (const nada of [null, undefined, 42, 'x', []]) {
      const r = leerResumenDelSitio(nada);
      expect(r.ga4.situacion).toBe('sin-documento');
      expect(r.searchConsole.situacion).toBe('sin-documento');
      expect(r.generadoEn).toBeNull();
      // Y ni una métrica: `null`, no cero.
      expect(r.ga4.sesiones).toBeNull();
    }
  });

  it('sin configurar: corrió y le falta un paso de consola', () => {
    /*
     * **Se separa de `falla` a propósito.** La acción es distinta —cargar una
     * variable de entorno y desplegar, contra mirar un log— y sobre todo no es
     * un problema: es el estado normal hasta que el dueño hace su paso. Un
     * tablero que grita «error» por eso enseña a ignorar sus errores.
     */
    const doc = documentoDeAnalitica({
      ga4: { ok: false, motivo: MOTIVOS_SIN_CONFIGURAR.ga4 },
      searchConsole: { ok: false, motivo: MOTIVOS_SIN_CONFIGURAR.searchConsole },
      generadoEn: '2026-10-15T10:00:00.000Z',
    });
    const r = leerResumenDelSitio(JSON.parse(JSON.stringify(doc)));
    expect(r.ga4.situacion).toBe('sin-configurar');
    expect(r.searchConsole.situacion).toBe('sin-configurar');
    expect(r.ga4.motivo).toBe(MOTIVOS_SIN_CONFIGURAR.ga4);
  });

  it('la marca que separa «sin configurar» de «falla» es la misma en los dos lados', () => {
    /*
     * **La red que faltaba, y la encontró el `auditor-trampas`.** El productor
     * (`functions/analitica.js`) y el consumidor (`lib/resumenDelSitio.ts`) no
     * se importan entre sí a propósito, y lo único que distingue «falta un paso
     * de consola» de «la API dijo no» es que el `motivo` contenga esta frase.
     *
     * Antes el caso de arriba usaba el literal escrito a mano en el fixture: si
     * alguien reformulaba el mensaje en la Function —agregarle detalle, cambiar
     * el orden de las palabras— el test seguía verde comparando dos copias
     * congeladas, y en producción esa rama pasaba en silencio de «cargá esta
     * variable» a «mirá un log». No se pierde un dato; se pierde el
     * diagnóstico, que es lo único que esta pantalla tiene para dar mientras no
     * hay números.
     *
     * MUTACIÓN PROBADA: se cambió `MARCA_SIN_CONFIGURAR` de `analitica.js` a
     * `'sin definir'` y este caso pasó a rojo (y el de arriba con él,
     * clasificando `falla` en vez de `sin-configurar`).
     */
    expect(MARCA_SIN_CONFIGURAR_FUNCTION).toBe(MARCA_SIN_CONFIGURAR_PANEL);
    for (const motivo of Object.values(MOTIVOS_SIN_CONFIGURAR)) {
      expect(motivo.toLowerCase()).toContain(MARCA_SIN_CONFIGURAR_PANEL);
      // Y cada motivo nombra **qué** variable falta, que es la mitad accionable.
      expect(motivo).toMatch(/^[A-Z0-9_]+ /);
    }
  });

  it('falla: la API dijo no', () => {
    const doc = documentoDeAnalitica({
      ga4: { ok: false, motivo: 'User does not have sufficient permissions for this property.' },
      searchConsole: { ok: true, resumen: resumenSearchConsole({ busquedas: {}, paginas: {}, ventana: VENTANA }) },
      generadoEn: '2026-10-15T10:00:00.000Z',
    });
    const r = leerResumenDelSitio(JSON.parse(JSON.stringify(doc)));
    expect(r.ga4.situacion).toBe('falla');
    expect(r.ga4.motivo).toContain('sufficient permissions');
    /*
     * **Y la otra mitad sigue viva**, que es el motivo por el que cada rama
     * lleva su propio estado: un resumen a medias es más útil que ninguno.
     */
    expect(r.searchConsole.situacion).toBe('sin-datos');
  });

  it('sin datos: la API contestó perfecto y el número es CERO', () => {
    /*
     * **El caso que motivó D-272.** Una propiedad recién creada contesta bien y
     * devuelve cero. Un tablero que muestre «0 visitas» tres semanas parece
     * roto, y el dueño no puede distinguirlo de un enganche que no funciona.
     *
     * MUTACIÓN PROBADA: se cambió `situacionDe` para devolver `'ok'` cuando el
     * estado es `ok` sin mirar `hayDatos`. Este caso pasó a rojo, junto con el
     * de `falla` —que verifica que la otra mitad quede en `sin-datos`—, y
     * ningún otro: con `'ok'` la pantalla dibujaría los ceros como si fueran
     * una medición y todo el resto del archivo seguiría en verde.
     */
    const r = leerResumenDelSitio(documentoReal({ vacio: true }));
    expect(r.ga4.situacion).toBe('sin-datos');
    expect(r.searchConsole.situacion).toBe('sin-datos');
    // Las métricas SÍ están (la fuente contestó): son cero de verdad. La
    // pantalla decide no escribirlas, y ésa es su decisión, no la del dato.
    expect(r.ga4.sesiones).toEqual({ valor: 0, variacion: null });
    expect(r.ga4.desdeCuando).toBeNull();
  });

  it('ok: hay números', () => {
    const r = leerResumenDelSitio(documentoReal());
    expect(r.ga4.situacion).toBe('ok');
    expect(r.ga4.sesiones).toEqual({ valor: 412, variacion: 37 });
    expect(r.ga4.personas).toEqual({ valor: 317, variacion: 27 });
    expect(r.ga4.desdeCuando).toBe('2026-09-03');
    expect(r.ga4.ventana).toEqual(VENTANA);
    expect(r.ga4.paginas).toEqual([
      { clave: '/', valor: 480 },
      { clave: '/cartelera/', valor: 96 },
    ]);
    expect(r.ga4.eventos.clic_inscripcion).toBe(37);
    // El evento que todavía no ocurrió llega en cero explícito desde la
    // Function, no ausente.
    expect(r.ga4.eventos.clic_triptico).toBe(0);
    expect(r.searchConsole.situacion).toBe('ok');
    expect(r.searchConsole.busquedas[0]!.clave).toBe('taller de escritura');
    expect(r.searchConsole.clicsEnElTope).toBe(14);
  });

  it('el productor real y este lector no se separaron', () => {
    /*
     * El control que hace que todo lo de arriba valga: los casos usan
     * `documentoDeAnalitica` de la Function, así que si esa forma cambia —una
     * clave renombrada, una rama movida— acá se cae. Sin este `it` explícito,
     * un lector que devolviera todo en default pasaría los casos de «sin
     * documento» y nadie notaría que dejó de leer.
     */
    const r = leerResumenDelSitio(documentoReal());
    expect(r.generadoEn).toBe('2026-10-15T10:00:00.000Z');
    expect(r.ga4.canales.length).toBeGreaterThan(0);
    expect(r.ga4.dispositivos.length).toBeGreaterThan(0);
    expect(Object.keys(r.ga4.eventos).length).toBe(3);
  });
});

// ─────────────────────────────────────────────────────────────────────
// 2 · Un documento degradado — la clase de B-580
// ─────────────────────────────────────────────────────────────────────

describe('un documento de otra versión no dibuja huecos', () => {
  it('una rama sin los campos nuevos se lee con defaults, no con undefined', () => {
    /*
     * El documento lo escribió **otro deploy**. Un campo agregado después deja
     * los documentos viejos sin él, la pantalla lo lee como `undefined` y
     * dibuja un hueco sin explicación: es la clase de B-580.
     */
    const r = leerResumenDelSitio({
      generadoEn: '2026-10-15T10:00:00.000Z',
      ga4: { estado: 'ok', hayDatos: true, sesiones: { valor: 5 } },
      searchConsole: { estado: 'ok', hayDatos: true },
    });
    expect(r.ga4.sesiones).toEqual({ valor: 5, variacion: null });
    expect(r.ga4.personas).toEqual({ valor: 0, variacion: null });
    expect(r.ga4.paginas).toEqual([]);
    expect(r.ga4.eventos).toEqual({});
    expect(r.searchConsole.busquedas).toEqual([]);
    expect(r.searchConsole.clicsEnElTope).toBe(0);
  });

  it('un string donde iba un número cuenta como cero y no se cuela a la pantalla', () => {
    /*
     * Las métricas de GA4 vienen como string y `analitica.js` las convierte. Si
     * acá llega un string, algo se rompió aguas arriba: aceptarlo taparía el
     * bug, y peor, `"412" + "300"` concatena.
     */
    const r = leerResumenDelSitio({
      ga4: {
        estado: 'ok',
        hayDatos: true,
        sesiones: { valor: '412', variacion: '37' },
        paginas: [{ clave: '/', valor: '480' }, 'no soy una fila', null],
      },
      searchConsole: { estado: 'ok', hayDatos: true, busquedas: 'no soy un array' },
    });
    expect(r.ga4.sesiones).toEqual({ valor: 0, variacion: null });
    expect(r.ga4.paginas).toEqual([{ clave: '/', valor: 0 }]);
    expect(r.searchConsole.busquedas).toEqual([]);
  });

  it('un motivo larguísimo se recorta, y se nota que se recortó', () => {
    /*
     * **Esto es defensa en profundidad, no la única defensa.** El recorte de
     * verdad está del lado que escribe (`documentoDeAnalitica`, tras el
     * hallazgo del `auditor-privacidad`), porque acá ya es tarde: el string
     * está persistido. Este tope cubre el documento que escribió un deploy
     * anterior al arreglo.
     */
    const largo = 'x'.repeat(MAX_MOTIVO + 50);
    const r = leerResumenDelSitio({ ga4: { estado: 'falla', motivo: largo } });
    expect(r.ga4.motivo!.length).toBe(MAX_MOTIVO);
    expect(r.ga4.motivo!.endsWith('…')).toBe(true);
  });

  it('los dos topes del motivo son el mismo número', () => {
    // Dos números distintos harían que el lector recortara un motivo que la
    // Function ya recortó —dos elipsis— o que dejara pasar uno más largo del
    // que la Function permite, que es la mitad que importa.
    expect(MAX_MOTIVO).toBe(MAX_MOTIVO_FUNCTION);
  });

  it('una fila de ranking sin clave dice «(sin dato)» y no queda vacía', () => {
    // GA4 devuelve `(other)` y `(not set)` de verdad; una clave vacía sería una
    // fila invisible con un número al lado.
    const r = leerResumenDelSitio({
      ga4: { estado: 'ok', hayDatos: true, canales: [{ clave: '', valor: 3 }] },
    });
    expect(r.ga4.canales).toEqual([{ clave: '(sin dato)', valor: 3 }]);
  });
});

// ─────────────────────────────────────────────────────────────────────
// 3 · El formateo
// ─────────────────────────────────────────────────────────────────────

describe('el formateo para la pantalla', () => {
  it('la fecha NO se parsea con `new Date`, que corre el día', () => {
    /*
     * `new Date('2026-09-17')` interpreta una fecha sin hora como **UTC**, así
     * que en Buenos Aires (−03) devuelve el 16. Es la trampa 1 del §13 y la
     * clase de bug que este repo ya arregló en `instanteDeIso`.
     */
    expect(diaLegible('2026-09-17')).toBe('17 de septiembre');
    expect(new Date('2026-09-17').getDate()).toBe(16); // el testigo del bug
    expect(diaLegible('2026-01-01')).toBe('1 de enero');
    expect(diaLegible('2026-12-31', true)).toBe('31 de diciembre de 2026');
  });

  it('una fecha que no es una clave de día da null', () => {
    expect(diaLegible(null)).toBeNull();
    expect(diaLegible('20260917')).toBeNull();
    expect(diaLegible('2026-13-01')).toBeNull();
  });

  it('el período se escribe entero, con el año una sola vez', () => {
    expect(periodoLegible(VENTANA)).toBe('del 17 de septiembre al 14 de octubre de 2026');
    expect(periodoLegible(null)).toBeNull();
  });

  it('la variación distingue «igual» de «sin comparación»', () => {
    /*
     * Son dos cosas distintas y las dos existen: `0` es «hubo la misma cantidad
     * que el mes anterior» y `null` es «no hay mes anterior con qué comparar»,
     * que es el estado del primer mes entero. Mostrar «0 %» en el segundo caso
     * afirma una comparación que no se hizo.
     */
    expect(variacionLegible(37)).toBe('+37 %');
    expect(variacionLegible(-27)).toBe('−27 %');
    expect(variacionLegible(0)).toBe('igual');
    expect(variacionLegible(null)).toBeNull();
  });

  it('el ctr se muestra como porcentaje, con coma decimal', () => {
    // Se guarda como fracción y se formatea acá: guardarlo ya multiplicado
    // hace que el día que alguien lo formatee otra vez salga 437 %.
    expect(ctrLegible(0.04375)).toBe('4,4 %');
    expect(ctrLegible(0)).toBe('0,0 %');
    expect(ctrLegible(1)).toBe('100,0 %');
  });
});
