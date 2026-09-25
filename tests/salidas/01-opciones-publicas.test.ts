/**
 * Salida 1: las opciones públicas (§4.4, B-212).
 *
 * Un barrido de salidas públicas, partido de
 * `tests/barrido-de-salidas-publicas.test.ts` (PRD 6, M-12). El índice de
 * todos está en ese archivo; lo que comparten, en
 * `tests/fixtures/barrido-de-salidas.ts`.
 */
import { describe, expect, it } from 'vitest';
import { opcionesPublicas } from '@/lib/toPublic';
import { CENTINELA, opcionCentinela } from '../fixtures/centinelas';
import { barrer, type Excepcion } from '../fixtures/barrido';

describe('barrido de las opciones públicas (§4.4, B-212)', () => {
  const PERMITIDO_EN_OPCIONES: readonly Excepcion[] = [
    {
      nombre: 'la etiqueta y su slug',
      centinelas: ['opcion.slug', 'opcion.label'],
      porque:
        '§4.4 — es exactamente lo que el JSON lleva: la web arma los chips de filtro con ' +
        'el label y cruza el slug contra el que guarda cada actividad. Sin los dos no hay ' +
        'filtros, que es el motivo por el que las opciones viajan en el archivo.',
    },
  ];

  it('sobreviven exactamente el slug y la etiqueta', () => {
    const publicas = opcionesPublicas([opcionCentinela()]);
    barrer('opciones del events.json', JSON.stringify(publicas), PERMITIDO_EN_OPCIONES);
  });

  it('la huella del creador no sale, aunque sea una huella y no un uid', () => {
    /*
     * El caso que más importa de los cinco que no salen, y el que un spread
     * publicaría sin ruido. D-27 la hizo una huella justamente porque el
     * documento es de lectura pública, pero «no es un uid» no es lo mismo que
     * «es publicable»: sigue siendo un identificador estable de una persona, y
     * §5.1 dice que del creador no sale nada.
     */
    const json = JSON.stringify(opcionesPublicas([opcionCentinela()]));
    expect(json).not.toContain(CENTINELA['opcion.huellaCreador']);
    expect(json).not.toContain('huellaCreador');
  });

  it('los campos de gestión tampoco: no llevan texto, así que se afirma por clave', () => {
    // `orden`, `fijo`, `usos`, `aprobada` y `aprobadaPorReuso` (B-29) son
    // números y booleanos: no hay string donde esconder contenido, así que el
    // barrido de centinelas no los ve. Se comparan las claves de la salida
    // contra la lista permitida.
    //
    // `tono` es el único de los cinco que sale (D-150): el color de la categoría
    // lo pinta el sitio, y el sitio no lee Firestore. Es la lista de claves —y no
    // el barrido de cadenas— lo que lo fija, porque es un número.
    const [publica] = opcionesPublicas([opcionCentinela()]);
    expect(Object.keys(publica!).sort()).toEqual(['label', 'slug', 'tono']);
  });

  it('sin matiz elegido no se emite la clave: el color se deriva del slug', () => {
    /*
     * D-150 — el caso normal es que nadie haya elegido color, y entonces el JSON
     * no lleva nada: el consumidor deriva el mismo color del slug con la misma
     * función que el build. Emitir el derivado convertiría en dato publicado algo
     * que hoy es una función, y el día que la derivación cambie el archivo viejo
     * mandaría el color viejo.
     */
    const [publica] = opcionesPublicas([opcionCentinela({ tono: undefined })]);
    expect(Object.keys(publica!).sort()).toEqual(['label', 'slug']);
  });

  it('un matiz que no es elegible no sale, aunque esté guardado', () => {
    /*
     * La guarda del lado del que escribe. `/opciones/*` se puede editar a mano
     * desde la consola de Firestore, así que un `tono: 999` o un `tono: 12.5` son
     * posibles; publicarlos pintaría un color fuera de la banda medida, o
     * directamente nada. Es la misma guarda que `tonoDeTipo` aplica al leer: el
     * color ilegible no se puede colar por ninguno de los dos caminos.
     *
     * MUTACIÓN PROBADA: sacar el `esTonoElegible` de `opcionPublica` y dejar el
     * spread condicional a `v.tono !== undefined` hace fallar este caso con
     * `['label','slug','tono']`.
     */
    for (const malo of [999, -1, 12.5, Number.NaN]) {
      const [publica] = opcionesPublicas([opcionCentinela({ tono: malo })]);
      expect(Object.keys(publica!).sort(), `tono ${malo}`).toEqual(['label', 'slug']);
    }
  });

  it('una opción sin aprobar no entra a los filtros del sitio', () => {
    // §4.3 / D-30 — el desplegable del panel se la muestra a quien la creó; un
    // chip en el sitio público publica una decisión a medio tomar.
    expect(opcionesPublicas([opcionCentinela({ aprobada: false })])).toEqual([]);
  });

  it('pero una opción base sí entra, aunque diga `aprobada: false`', () => {
    /*
     * Control del error que la primera versión de `opcionesPublicas` tenía: se
     * filtraba con `v.aprobada !== false` en vez de reusar `estaAprobada`, que
     * es `v.fijo || (v.aprobada ?? true)`. Las `fijo` son las opciones base del
     * §4.1 —«Gratis», «A la gorra»— o sea justo las que no pueden faltar en los
     * filtros.
     */
    const base = opcionCentinela({ fijo: true, aprobada: false });
    expect(opcionesPublicas([base])).toHaveLength(1);
  });

  it('y el default de los documentos viejos cuenta como aprobada', () => {
    // §4.3 — los documentos de producción anteriores al campo no lo tienen, y
    // ausente cuenta como aprobada (`estaAprobada`). Si esto rompiera, renombrar
    // una etiqueta vieja la borraría de los filtros del sitio.
    const vieja = opcionCentinela({ aprobada: undefined });
    expect(opcionesPublicas([vieja])).toHaveLength(1);
  });

  it('CONTROL NEGATIVO: un spread en la proyección dispara la fuga nombrando la huella', () => {
    /*
     * El `docs/BACKLOG.md` de B-212 y `13-agentes.md` afirman «verificado por
     * mutación — cambiar la proyección por un spread dispara FUGA DE
     * PRIVACIDAD». Eso se hizo **a mano**, y una afirmación de la doc que
     * ningún test sostiene envejece igual que cualquier otra: mañana alguien
     * afloja `PERMITIDO_EN_OPCIONES` y la frase sigue ahí, diciendo que hay una
     * red que ya no atrapa nada.
     *
     * Así que se codifica. Es el gemelo del control del `libro` de más arriba, y
     * lo señaló el `auditor-privacidad`: para la actividad ese control existía y
     * para las opciones no.
     *
     * Se simula el atajo —volcar el documento entero, que es lo que uno escribe
     * cuando implementa B-106 con apuro— y se exige que el barrido **falle**, y
     * que falle **nombrando** el campo. Un barrido que se rompe con un mensaje
     * genérico no sirve a las 2 de la mañana.
     */
    let mensaje = '';
    try {
      barrer(
        'opciones (mutación: la proyección hace spread)',
        JSON.stringify([{ ...opcionCentinela() }]),
        PERMITIDO_EN_OPCIONES,
      );
    } catch (e) {
      mensaje = e instanceof Error ? e.message : String(e);
    }

    expect(mensaje, 'el barrido NO detectó el spread: la red no atrapa nada').not.toBe('');
    expect(mensaje).toContain('FUGA');
    expect(mensaje).toContain('opcion.huellaCreador');
  });
});
