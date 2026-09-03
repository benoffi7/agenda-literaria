import { describe, expect, it } from 'vitest';
import {
  ETIQUETA_VISTA,
  PREFIJO_VISTA,
  VISTAS_DE_GRAFICO,
  type AlmacenDeVistas,
  esVistaDeGrafico,
  leerVistaRecordada,
  recordarVista,
  vistaInicial,
} from '@/lib/vistaDeGrafico';

/**
 * La memoria de «torta o lista» — B-701.
 *
 * Mismo corte y mismo motivo que `tests/secciones-recordadas.test.ts`: la
 * decisión es pura y el almacén entra como puerto, así que los tres estados
 * —sin memoria, con memoria, almacén roto— se prueban sin DOM.
 *
 * La mitad que **no** se puede testear así es el cableado (que el toggle guarde
 * lo que se eligió), y esa la cubre `tests/estadisticas-pestanias.render.test.tsx`,
 * que es el único lugar del panel donde este repo monta React de verdad.
 */

/** Almacén de mentira, y uno que tira: `localStorage` hace las dos cosas. */
const almacenFalso = (inicial: Record<string, string> = {}) => {
  const datos = { ...inicial };
  return {
    datos,
    puerto: {
      getItem: (k: string) => datos[k] ?? null,
      setItem: (k: string, v: string) => {
        datos[k] = v;
      },
    } satisfies AlmacenDeVistas,
  };
};

const almacenQueTira: AlmacenDeVistas = {
  getItem: () => {
    throw new Error('modo privado');
  },
  setItem: () => {
    throw new Error('cuota llena');
  },
};

describe('el vocabulario de vistas', () => {
  it('son dos, y la torta es la primera porque es el default', () => {
    expect(VISTAS_DE_GRAFICO).toEqual(['torta', 'lista']);
  });

  it('cada una tiene su etiqueta: ninguna se pinta con su slug', () => {
    // Una vista nueva sin etiqueta saldría con el nombre técnico en un botón, y
    // nada fallaría. Es la misma red que `ETIQUETA_ESTADO`.
    for (const vista of VISTAS_DE_GRAFICO) {
      expect(ETIQUETA_VISTA[vista], vista).toBeTruthy();
    }
    expect(Object.keys(ETIQUETA_VISTA).sort()).toEqual([...VISTAS_DE_GRAFICO].sort());
  });

  it('la guarda reconoce las dos y rechaza cualquier otra cosa', () => {
    expect(esVistaDeGrafico('torta')).toBe(true);
    expect(esVistaDeGrafico('lista')).toBe(true);
    for (const basura of ['barras', '', 'TORTA', null, undefined, 3, {}]) {
      expect(esVistaDeGrafico(basura), String(basura)).toBe(false);
    }
  });
});

describe('con qué vista arranca un reparto', () => {
  it('sin memoria manda el default', () => {
    expect(vistaInicial({ recordada: null, porDefecto: 'torta' })).toBe('torta');
    expect(vistaInicial({ recordada: null, porDefecto: 'lista' })).toBe('lista');
  });

  it('con memoria manda la memoria, en las dos direcciones', () => {
    /*
     * Las dos direcciones y no una: quien lee con lector de pantalla elige
     * «lista» una vez y no la tiene que volver a elegir, y quien prefiere ver
     * proporciones puede volver a la torta en un reparto cuyo default fuera
     * lista.
     */
    expect(vistaInicial({ recordada: 'lista', porDefecto: 'torta' })).toBe('lista');
    expect(vistaInicial({ recordada: 'torta', porDefecto: 'lista' })).toBe('torta');
  });
});

describe('la memoria de un reparto', () => {
  it('lo que se guarda se vuelve a leer', () => {
    const { puerto } = almacenFalso();
    recordarVista(puerto, 'barrio', 'lista');
    expect(leerVistaRecordada(puerto, 'barrio')).toBe('lista');
    recordarVista(puerto, 'barrio', 'torta');
    expect(leerVistaRecordada(puerto, 'barrio')).toBe('torta');
  });

  it('cada reparto recuerda lo suyo', () => {
    // Una sola clave para todos convertiría el toggle en global sin que nadie
    // lo haya decidido: elegir lista en «barrio» pondría lista en «estado».
    const { puerto } = almacenFalso();
    recordarVista(puerto, 'barrio', 'lista');
    recordarVista(puerto, 'tipo', 'torta');
    expect(leerVistaRecordada(puerto, 'barrio')).toBe('lista');
    expect(leerVistaRecordada(puerto, 'tipo')).toBe('torta');
  });

  it('sin memoria previa devuelve `null`, que no es «torta»', () => {
    /*
     * Los dos casos caen hoy en el mismo lado, y se separan el día que el
     * default cambie. Un `?? 'torta'` escondido en el lector haría que ese día
     * la elección de alguien se pierda sin que nada falle.
     */
    expect(leerVistaRecordada(almacenFalso().puerto, 'barrio')).toBeNull();
  });

  it('guarda bajo el prefijo del módulo, y nada más', () => {
    const { datos, puerto } = almacenFalso();
    recordarVista(puerto, 'arancel', 'lista');
    expect(Object.keys(datos)).toEqual([`${PREFIJO_VISTA}arancel`]);
    // Nada de contenido: la clave es el nombre del reparto y el valor, la vista
    // (§5.1). Por eso no lleva la huella del admin, a diferencia del borrador.
    expect(datos[`${PREFIJO_VISTA}arancel`]).toBe('lista');
  });

  it('un valor ilegible se ignora en vez de pintarse', () => {
    // Alguien lo editó a mano, o una versión anterior guardó otra cosa. La
    // guarda va del lado de la **lectura**, como `esTonoElegible`.
    const { puerto } = almacenFalso({ [`${PREFIJO_VISTA}tipo`]: 'barras' });
    expect(leerVistaRecordada(puerto, 'tipo')).toBeNull();
  });

  it('un almacén que tira no rompe el tablero', () => {
    // `localStorage` **tira** al accederlo en un iframe con cookies bloqueadas:
    // no devuelve null. Por eso el acceso va adentro del try, no solo la
    // escritura.
    expect(leerVistaRecordada(almacenQueTira, 'tipo')).toBeNull();
    expect(() => recordarVista(almacenQueTira, 'tipo', 'lista')).not.toThrow();
  });

  it('sin almacén tampoco', () => {
    expect(leerVistaRecordada(null, 'tipo')).toBeNull();
    expect(() => recordarVista(null, 'tipo', 'lista')).not.toThrow();
  });
});
