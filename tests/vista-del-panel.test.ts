import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CLAVE_VISTA_DEL_PANEL,
  VISTAS_DEL_PANEL,
  VISTA_POR_DEFECTO,
  esVistaDelPanel,
  laOtraVista,
  leerVistaElegida,
  recordarVistaDelPanel,
  usaPestanias,
  vistaInicialDelPanel,
  type AlmacenDeVistaDelPanel,
} from '@/lib/vistaDelPanel';

/**
 * **La forma del formulario, elegida a mano y recordada** — B-814.
 *
 * Lo que este archivo fija no es «se guarda una cadena»: es la decisión de
 * diseño del pedido, que va contra el reflejo. «**Que no sea automatico por
 * deteccion sino eleccion del usuario**», así que **no puede haber ninguna
 * consulta de ancho de ventana en este camino** — y eso se afirma sobre la
 * fuente, porque un `matchMedia` agregado mañana no rompería ningún otro test:
 * el módulo seguiría devolviendo una vista válida.
 *
 * El resto es la lectura tolerante, que es donde estas piezas se rompen: un
 * almacén que no está, uno que tira, y un valor que alguien editó a mano.
 */

/** Un `localStorage` de mentira, con lo mínimo que el módulo usa. */
const almacenDePrueba = (inicial: Record<string, string> = {}) => {
  const datos = { ...inicial };
  return {
    almacen: {
      getItem: (c: string) => datos[c] ?? null,
      setItem: (c: string, v: string) => {
        datos[c] = v;
      },
    } satisfies AlmacenDeVistaDelPanel,
    datos,
  };
};

/** Uno que tira en las dos direcciones: el modo privado de Safari, en chico. */
const almacenQueTira: AlmacenDeVistaDelPanel = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('QuotaExceededError');
  },
};

describe('la vista del panel se elige, no se detecta (B-814)', () => {
  it('el default es «PC», que es lo que el panel ya hacía', () => {
    /*
     * Quien no toque el interruptor no ve ningún cambio: es el lado barato de
     * equivocarse, mismo criterio que D-41 y `VISTAS_A_TODO_ANCHO`. Y las
     * pestañas son D-490, o sea una decisión que resolvió un problema medido —
     * no se descarta por default.
     */
    expect(VISTA_POR_DEFECTO).toBe('pc');
    expect(vistaInicialDelPanel(null)).toBe('pc');
    expect(usaPestanias(VISTA_POR_DEFECTO)).toBe(true);
  });

  it('nada del camino mira el ancho de la ventana', () => {
    /*
     * **La decisión del pedido, y la única que se puede perder en silencio.** Un
     * `matchMedia` o un `innerWidth` agregado acá dejaría todos los demás tests
     * en verde: el módulo seguiría devolviendo `'pc'` o `'celular'`. Lo que se
     * rompería es el pedido — «que no sea automatico por deteccion» — y eso no
     * tiene otra forma de afirmarse que mirar que no esté.
     *
     * Se lee el fuente sin comentarios: el docblock del módulo **explica** por
     * qué no hay detección y nombra `matchMedia`, así que un aserto sobre el
     * texto crudo mediría el comentario. Es la lección de `etiquetas-de-ui`
     * sobre B-204, y la misma que `ancho-del-panel.test.ts` ya aplica.
     */
    const fuente = readFileSync(
      fileURLToPath(new URL('../src/lib/vistaDelPanel.ts', import.meta.url)),
      'utf8',
    );
    const codigo = fuente.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

    for (const deteccion of ['matchMedia', 'innerWidth', 'outerWidth', 'userAgent', 'maxTouchPoints']) {
      expect(codigo, `el módulo detecta con ${deteccion} y el pedido dice que no`).not.toContain(
        deteccion,
      );
    }
    // Y que el recorte no se comió el módulo entero: sin esto pasaría solo.
    expect(codigo).toContain('VISTA_POR_DEFECTO');
  });

  it('las dos vistas, y una es la otra de la otra', () => {
    expect(VISTAS_DEL_PANEL).toEqual(['pc', 'celular']);
    expect(laOtraVista('pc')).toBe('celular');
    expect(laOtraVista('celular')).toBe('pc');
    expect(usaPestanias('celular')).toBe(false);
  });
});

describe('la elección se recuerda, y la lectura tolera cualquier cosa', () => {
  it('lo que se elige es lo que se lee después', () => {
    const { almacen, datos } = almacenDePrueba();
    recordarVistaDelPanel(almacen, 'celular');

    expect(datos[CLAVE_VISTA_DEL_PANEL]).toBe('celular');
    expect(leerVistaElegida(almacen)).toBe('celular');
    expect(vistaInicialDelPanel(almacen)).toBe('celular');
  });

  it('sin memoria devuelve `null`, que no es lo mismo que el default', () => {
    /*
     * El mismo argumento que `leerVistaRecordada` (B-701): los dos casos caen
     * hoy en «PC», pero el día que el default cambie se separan — y ése es justo
     * el día en que un `?? 'pc'` escondido en la lectura haría que la elección de
     * alguien se pierda sin que nada falle.
     */
    expect(leerVistaElegida(almacenDePrueba().almacen)).toBeNull();
    expect(leerVistaElegida(null)).toBeNull();
    // Y quien quiere el default lo pide por su nombre.
    expect(vistaInicialDelPanel(almacenDePrueba().almacen)).toBe(VISTA_POR_DEFECTO);
  });

  it('un valor que alguien editó a mano cae al default y no rompe', () => {
    const { almacen } = almacenDePrueba({ [CLAVE_VISTA_DEL_PANEL]: 'tablet' });
    expect(leerVistaElegida(almacen)).toBeNull();
    expect(vistaInicialDelPanel(almacen)).toBe(VISTA_POR_DEFECTO);
    expect(esVistaDelPanel('tablet')).toBe(false);
    expect(esVistaDelPanel(null)).toBe(false);
  });

  it('un almacén que tira no puede romper el panel', () => {
    // Modo privado, cuota llena, cookies bloqueadas. Se pierde la preferencia,
    // no la pantalla.
    expect(() => leerVistaElegida(almacenQueTira)).not.toThrow();
    expect(leerVistaElegida(almacenQueTira)).toBeNull();
    expect(vistaInicialDelPanel(almacenQueTira)).toBe(VISTA_POR_DEFECTO);
    expect(() => recordarVistaDelPanel(almacenQueTira, 'celular')).not.toThrow();
    expect(() => recordarVistaDelPanel(null, 'celular')).not.toThrow();
  });

  it('la clave no lleva contenido ni la huella de nadie (§5.1)', () => {
    /*
     * La distinción que hace `Seccion.tsx` y repite `vistaDeGrafico.ts`: el
     * borrador local lleva la huella del admin porque **es contenido**; una
     * preferencia de pantalla no, así que la clave es fija. Que sea fija es
     * también lo que hace que la preferencia sea del panel entero y no de una
     * actividad.
     */
    const { datos } = almacenDePrueba();
    recordarVistaDelPanel(
      { getItem: () => null, setItem: (c, v) => void (datos[c] = v) },
      'celular',
    );
    expect(Object.keys(datos)).toEqual([CLAVE_VISTA_DEL_PANEL]);
    expect(CLAVE_VISTA_DEL_PANEL).toBe('agenda:vista-del-panel');
    expect(datos[CLAVE_VISTA_DEL_PANEL]).toBe('celular');
  });
});

describe('el cableado del interruptor en AdminApp', () => {
  /*
   * La mitad que el módulo puro no puede cubrir, y es la que se rompe sola.
   *
   * `InterruptorDeVista` recibe `vista` como **prop**: no lee su propio estado.
   * Así que si alguien reescribe `elegirVista` y se olvida del
   * `setVistaDelPanel`, el interruptor **igual cambia de color** —el click
   * llegó, el estado no— y el formulario sigue dibujado con la vista anterior.
   * Falla silencioso y con feedback visual falso, que es la peor combinación:
   * quien carga ve que eligió y no le pasó nada.
   *
   * No hay render-test de `AdminApp` en este repo (arrastra Firebase Auth), así
   * que se afirma sobre el fuente, mismo criterio que `ancho-del-panel.test.ts`
   * y `salida-del-panel.test.ts`. Se lee sin comentarios: el docblock de
   * `AdminApp` nombra las dos funciones al explicarlas, y un test que se
   * conforme con eso pasa con el cuerpo vacío.
   *
   * **Lo que este estilo NO puede ver**, y conviene tenerlo escrito: un chequeo
   * de presencia de texto no distingue código alcanzable de código muerto. Un
   * `if (false) { setVistaDelPanel(nueva); }` pasaría las dos afirmaciones de
   * abajo con el estado sin actualizar nunca. Es el límite de todos los
   * tests-de-fuente del repo y no de este caso en particular; se asume a
   * cambio de tener *algo* donde no hay render-test. El día que `AdminApp` se
   * pueda montar con un doble de Auth, estos dos casos son los primeros que
   * conviene reescribir como render-test de verdad.
   *
   * Lo que sí está probado: las reformulaciones que podrían romper el regex
   * —un `if` adentro, la firma partida en dos líneas, un parámetro con
   * paréntesis en el tipo— fallan **ruidoso** (`cuerpo` da `null` y el
   * `expect` de abajo se pone rojo), nunca en verde-falso.
   */
  const cuerpoDeElegirVista = (): string => {
    const fuente = readFileSync(
      fileURLToPath(new URL('../src/components/admin/AdminApp.tsx', import.meta.url)),
      'utf8',
    );
    const codigo = fuente.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const cuerpo = codigo.match(/const elegirVista = \([^)]*\) => \{([\s\S]*?)\n {2}\};/);
    expect(cuerpo, 'no se encontró `elegirVista` en AdminApp.tsx').not.toBeNull();
    return cuerpo![1];
  };

  it('elegir una vista la aplica Y la recuerda — las dos cosas', () => {
    const cuerpo = cuerpoDeElegirVista();
    expect(cuerpo).toMatch(/setVistaDelPanel\(\s*nueva\s*\)/);
    expect(cuerpo).toMatch(/recordarVistaDelPanel\(/);
  });

  it('y arranca leyendo del mismo almacén en el que escribe', () => {
    /*
     * Dos almacenes distintos —uno para leer al montar y otro para guardar—
     * darían el bug más confuso de todos: la preferencia se guarda, y al volver
     * a entrar el panel arranca con la otra. Se afirma que la expresión del
     * almacén es la misma cadena en los dos lados.
     */
    const fuente = readFileSync(
      fileURLToPath(new URL('../src/components/admin/AdminApp.tsx', import.meta.url)),
      'utf8',
    );
    const codigo = fuente.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const almacen = 'globalThis.localStorage ?? null';
    expect(codigo).toContain(`vistaInicialDelPanel(${almacen})`);
    expect(codigo).toContain(`recordarVistaDelPanel(${almacen},`);
  });
});
