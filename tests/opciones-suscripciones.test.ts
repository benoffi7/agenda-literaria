import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { crearRegistroDeOpciones } from '@/components/admin/useOpciones';
import type { CampoTaxonomia, ValorOpcion } from '@/types/actividad';

/**
 * B-127 — el registro de suscripciones compartidas a `/opciones/*`.
 *
 * El costo que el ítem describe no era el que parecía: la primera pantalla
 * autenticada monta el listado (cinco campos) **y** el contador de la cabecera
 * (los cinco, por definición), así que eran diez `onSnapshot` sobre cinco
 * documentos. Recortar el listado a los dos campos que muestra no bajaba de
 * cinco mientras la cabecera siga ahí; compartir sí baja de diez a cinco, y sin
 * apagarle el "en vivo" a nadie (§4.4).
 *
 * Se prueba con un observador de mentira, sin emuladores: el criterio del
 * `docs/05-patrones.md` para lógica pura.
 */

const valor = (slug: string): ValorOpcion =>
  ({ slug, label: slug, orden: 1, fijo: false, usos: 0 }) as unknown as ValorOpcion;

/** Observador de mentira: cuenta aperturas y cierres, y deja emitir a mano. */
const observadorFalso = () => {
  const aperturas: CampoTaxonomia[] = [];
  const cierres: CampoTaxonomia[] = [];
  const emisores = new Map<CampoTaxonomia, (v: ValorOpcion[]) => void>();

  const observar = (campo: CampoTaxonomia, cb: (v: ValorOpcion[]) => void) => {
    aperturas.push(campo);
    emisores.set(campo, cb);
    return () => {
      cierres.push(campo);
      emisores.delete(campo);
    };
  };

  return {
    observar,
    aperturas,
    cierres,
    emitir: (campo: CampoTaxonomia, valores: ValorOpcion[]) => emisores.get(campo)?.(valores),
  };
};

describe('B-127 · una suscripción por documento, no una por hook', () => {
  it('dos interesados en el mismo campo abren un solo listener', () => {
    const falso = observadorFalso();
    const registro = crearRegistroDeOpciones(falso.observar);

    registro.suscribir('arancel', () => {});
    registro.suscribir('arancel', () => {});

    expect(falso.aperturas).toEqual(['arancel']);
    expect(registro.abiertas()).toEqual(['arancel']);
  });

  it('los dos reciben cada snapshot: nadie pierde el "en vivo" del §4.4', () => {
    const falso = observadorFalso();
    const registro = crearRegistroDeOpciones(falso.observar);
    const primero: string[][] = [];
    const segundo: string[][] = [];

    registro.suscribir('tipo', (v) => primero.push(v.map((x) => x.slug)));
    registro.suscribir('tipo', (v) => segundo.push(v.map((x) => x.slug)));
    falso.emitir('tipo', [valor('taller')]);

    expect(primero).toEqual([['taller']]);
    expect(segundo).toEqual([['taller']]);
  });

  it('el que llega tarde recibe el último snapshot al suscribirse', () => {
    // Sin esto, quien se monta después se queda en `OPCIONES_BASE` hasta el
    // próximo cambio en Firestore —que puede no llegar nunca— y muestra el slug
    // crudo de una etiqueta que la pantalla de al lado muestra bien.
    const falso = observadorFalso();
    const registro = crearRegistroDeOpciones(falso.observar);

    registro.suscribir('barrio', () => {});
    falso.emitir('barrio', [valor('almagro')]);

    const tarde: string[][] = [];
    registro.suscribir('barrio', (v) => tarde.push(v.map((x) => x.slug)));

    expect(tarde).toEqual([['almagro']]);
  });

  it('el listener se cierra recién cuando se va el último oyente', () => {
    const falso = observadorFalso();
    const registro = crearRegistroDeOpciones(falso.observar);

    const bajaA = registro.suscribir('tags', () => {});
    const bajaB = registro.suscribir('tags', () => {});

    bajaA();
    expect(falso.cierres).toEqual([]);
    expect(registro.abiertas()).toEqual(['tags']);

    bajaB();
    expect(falso.cierres).toEqual(['tags']);
    expect(registro.abiertas()).toEqual([]);
  });

  it('el que quedó sigue recibiendo después de que el otro se dio de baja', () => {
    const falso = observadorFalso();
    const registro = crearRegistroDeOpciones(falso.observar);
    const recibidos: string[][] = [];

    const bajaA = registro.suscribir('plataforma', () => {});
    registro.suscribir('plataforma', (v) => recibidos.push(v.map((x) => x.slug)));
    bajaA();
    falso.emitir('plataforma', [valor('zoom')]);

    expect(recibidos).toEqual([['zoom']]);
  });

  it('dos oyentes con la MISMA función se cuentan como dos', () => {
    // Si los oyentes se guardaran como funciones sueltas en un `Set`, dos hooks
    // que pasan la misma referencia se contarían como uno y la primera baja
    // cerraría el listener del otro.
    const falso = observadorFalso();
    const registro = crearRegistroDeOpciones(falso.observar);
    const recibidos: string[][] = [];
    const mismo = (v: ValorOpcion[]) => recibidos.push(v.map((x) => x.slug));

    const bajaA = registro.suscribir('arancel', mismo);
    registro.suscribir('arancel', mismo);
    bajaA();

    expect(falso.cierres).toEqual([]);
    falso.emitir('arancel', [valor('gratis')]);
    expect(recibidos).toEqual([['gratis']]);
  });

  it('dar la baja dos veces no cierra el listener del que sigue escuchando', () => {
    const falso = observadorFalso();
    const registro = crearRegistroDeOpciones(falso.observar);

    const bajaA = registro.suscribir('tipo', () => {});
    registro.suscribir('tipo', () => {});
    bajaA();
    bajaA();

    expect(falso.cierres).toEqual([]);
    expect(registro.abiertas()).toEqual(['tipo']);
  });

  it('campos distintos son documentos distintos: un listener cada uno', () => {
    const falso = observadorFalso();
    const registro = crearRegistroDeOpciones(falso.observar);

    registro.suscribir('arancel', () => {});
    registro.suscribir('tipo', () => {});

    expect(falso.aperturas).toEqual(['arancel', 'tipo']);
  });

  it('volver a suscribirse después del cierre reabre y no se queda mudo', () => {
    const falso = observadorFalso();
    const registro = crearRegistroDeOpciones(falso.observar);
    const recibidos: string[][] = [];

    const baja = registro.suscribir('tags', () => {});
    falso.emitir('tags', [valor('viejo')]);
    baja();

    registro.suscribir('tags', (v) => recibidos.push(v.map((x) => x.slug)));
    // El caché sobrevive al cierre a propósito: mostrar la etiqueta de hace un
    // minuto es mejor que volver al slug crudo mientras llega el snapshot.
    expect(recibidos).toEqual([['viejo']]);

    falso.emitir('tags', [valor('nuevo')]);
    expect(falso.aperturas).toEqual(['tags', 'tags']);
    expect(recibidos.at(-1)).toEqual(['nuevo']);
  });

  it('los diez oyentes de la primera pantalla dan cinco listeners, no diez', () => {
    // El escenario exacto de B-127: el listado (`useLabelsTaxonomia`) y el
    // contador de la cabecera (`usePendientesDeAprobacion`) sobre los mismos
    // cinco documentos.
    const falso = observadorFalso();
    const registro = crearRegistroDeOpciones(falso.observar);
    const campos: CampoTaxonomia[] = ['arancel', 'tipo', 'barrio', 'plataforma', 'tags'];

    for (const campo of campos) registro.suscribir(campo, () => {});
    for (const campo of campos) registro.suscribir(campo, () => {});

    expect(falso.aperturas).toHaveLength(5);
    expect(registro.abiertas().sort()).toEqual([...campos].sort());
  });
});

describe('B-127 · el hook no puede volver a abrir su propio listener', () => {
  /**
   * El registro se puede saltear sin que nada falle: alcanza con que un
   * `useEffect` vuelva a llamar `observarOpciones` directo y el panel sigue
   * funcionando, solo con el doble de listeners. Este chequeo es el que se da
   * cuenta.
   *
   * Se buscan **llamadas** (`observarOpciones(`) y con el fuente sin comentarios:
   * el `import` no tiene paréntesis y la prosa de los docstrings nombra la
   * función varias veces.
   */
  const sinComentarios = readFileSync('src/components/admin/useOpciones.ts', 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');

  it('el único uso de `observarOpciones` es armar el registro, no llamarla', () => {
    expect(sinComentarios).not.toMatch(/observarOpciones\s*\(/);
    expect(sinComentarios).toMatch(/crearRegistroDeOpciones\s*\(\s*observarOpciones\s*,?\s*\)/);
  });

  it('y `useOpciones` se suscribe por el registro', () => {
    const cuerpo = sinComentarios.slice(sinComentarios.indexOf('export function useOpciones'));
    expect(cuerpo).toMatch(/registroDeOpciones\.suscribir\s*\(/);
  });
});
