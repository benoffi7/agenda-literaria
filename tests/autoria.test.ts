/**
 * B-130 — quién cargó cada actividad.
 *
 * El reporte era una pregunta, no un bug: *"los eventos que crea el otro admin
 * también me aparecen, ¿no?"*. Se contesta con el uid que el panel ya tiene en
 * la sesión, sin tocar el modelo ni arriesgar una filtración del §5.1.
 */
import { describe, expect, it } from 'vitest';
import { ETIQUETA_AUTORIA, autoriaDe, marcaDeAutoria } from '@/lib/formulario/autoria';

const YO = 'uid_propio';

describe('de quién es la actividad', () => {
  it('la mía es propia', () => {
    expect(autoriaDe({ createdBy: YO }, YO)).toBe('propia');
  });

  it('la de la otra cuenta es ajena', () => {
    expect(autoriaDe({ createdBy: 'uid_ajeno' }, YO)).toBe('ajena');
  });

  it('sin `createdBy` es desconocida, no ajena', () => {
    // Los documentos anteriores a que se escribiera `createdBy`. Marcarlos como
    // ajenos sería afirmar de más sobre datos viejos, que es peor que callarse.
    expect(autoriaDe({}, YO)).toBe('desconocida');
    expect(autoriaDe({ createdBy: null }, YO)).toBe('desconocida');
    expect(autoriaDe({ createdBy: '' }, YO)).toBe('desconocida');
  });

  it('sin sesión no se afirma nada', () => {
    expect(autoriaDe({ createdBy: 'uid_ajeno' }, undefined)).toBe('desconocida');
  });

  it('el veredicto no depende de cuántas cuentas admin haya (B-179, D-610)', () => {
    /*
     * La clase, no la instancia. La marca se escribió con dos cuentas y desde el
     * 2026-09-08 hay cuatro: B-179 esperaba que ahí dejara de servir. No dejó,
     * porque `autoriaDe` compara UN uid contra el de la sesión y su respuesta a
     * "¿esto lo cargué yo?" es la misma con dos, con cuatro y con cuarenta.
     *
     * Lo que este aserto mata es la forma de arreglarlo que parece razonable y
     * no lo es: cablear el conjunto de cuentas conocidas —"si no sos vos y sos
     * el uid de fulano, entonces ajena"—, que es el mapa uid→nombre que el
     * comentario del módulo dice que queda viejo sin que nada falle.
     */
    const muchas = Array.from({ length: 40 }, (_, i) => `uid_ajeno_${i}`);
    expect(muchas.map((u) => autoriaDe({ createdBy: u }, YO))).toEqual(muchas.map(() => 'ajena'));
    expect(autoriaDe({ createdBy: YO }, YO)).toBe('propia');
  });

  it('la autoría se decide con `createdBy` y ningún otro campo (D-610)', () => {
    /*
     * D-610 cerró B-179 **sin** guardar el mail de quien carga en el documento:
     * la trazabilidad de "quién tocó qué" ya la da el historial del §12, y un
     * mail en el documento entra a las versiones guardadas y hay que excluirlo
     * de cada salida pública nueva para siempre.
     *
     * Esto se pone rojo el día que alguien lea un campo más desde acá, que es el
     * momento en que esa decisión hay que volver a discutirla — y en el §5.1.
     */
    const leidos: string[] = [];
    const documento: Record<string, unknown> = { createdBy: 'uid_ajeno', creadoPorMail: 'a@b.c' };
    const espia = new Proxy(documento, {
      get(o, k) {
        if (typeof k === 'string') leidos.push(k);
        return o[k as string];
      },
    }) as { createdBy?: string | null };

    expect(autoriaDe(espia, YO)).toBe('ajena');
    expect(leidos).toEqual(['createdBy']);
  });
});

describe('qué se muestra', () => {
  it('lo propio no lleva marca', () => {
    // Si todo lleva marca, la marca deja de avisar: la fila del listado ya tiene
    // título, estado y próximo encuentro compitiendo por la atención.
    expect(ETIQUETA_AUTORIA.propia).toBeNull();
  });

  it('lo desconocido tampoco', () => {
    expect(ETIQUETA_AUTORIA.desconocida).toBeNull();
  });

  it('lo ajeno sí, y no nombra a nadie', () => {
    const texto = ETIQUETA_AUTORIA.ajena;
    expect(texto).toBeTruthy();
    // No hay nombre ni mail que mostrar: `createdBy` es un uid. Y si algún día
    // se guarda el mail, este test recuerda que el §5.1 lo tiene que revisar.
    expect(texto).not.toMatch(/@/);
  });

  it('la marca no afirma que la otra cuenta sea una sola (B-811, D-610)', () => {
    /*
     * Con dos cuentas, "la cargó LA otra cuenta" habría sido cierto; con las
     * cuatro que hay desde el 2026-09-08 es falso. El artículo definido —y
     * cualquier número— es la pieza que envejece, no el mecanismo: el rótulo de
     * taxonomías pagó exactamente este bug ("la usaron LAS dos cuentas").
     *
     * La marca ya estaba escrita en indefinido y por eso sobrevivió al alta de
     * dos cuentas; el aserto es para que siga así cuando alguien la reescriba.
     */
    const texto = ETIQUETA_AUTORIA.ajena ?? '';
    expect(texto).toMatch(/otra cuenta/i);
    expect(texto, 'artículo definido: afirma que la otra cuenta es una sola').not.toMatch(
      /\bl[ao]s? +otr[ao]/i,
    );
    expect(texto, 'un número acá vuelve a quedar viejo con el próximo alta').not.toMatch(
      /\b(una|dos|tres|cuatro|cinco)\b/i,
    );
  });
});

/**
 * **B-888 — la marca pasa a decir el mail**, que es el pedido del dueño en la
 * tajada 2 del panel.
 *
 * Lo que la hace posible es `/usuarios` (D-650): el mail vive una vez, fuera de
 * `toPublic` y fuera del historial, y **no envejece** porque cada cuenta lo
 * refresca al entrar. Sin ese directorio la marca decía «otra cuenta» y no cuál,
 * que es lo que los casos de arriba fijan.
 */
describe('la marca con el mail — B-888', () => {
  const OTRO = 'uid_ajeno';
  const MAILES = new Map([[OTRO, 'otra@ejemplo.test']]);
  const SIN_DIRECTORIO = new Map<string, string>();

  it('lo propio y sin tocar por nadie sigue sin marca', () => {
    // Si todo llevara marca, la marca dejaría de avisar — es lo mismo que decía
    // `ETIQUETA_AUTORIA.propia = null`.
    expect(marcaDeAutoria({ createdBy: YO, updatedBy: YO }, YO, MAILES)).toBeNull();
  });

  it('lo ajeno nombra a quien lo cargó', () => {
    expect(marcaDeAutoria({ createdBy: OTRO, updatedBy: OTRO }, YO, MAILES)).toBe(
      'La cargó otra@ejemplo.test',
    );
  });

  it('lo propio que tocó otro nombra a quien lo cambió', () => {
    /*
     * El dato que el §12 guardaba desde siempre (`updatedBy` en cada escritura) y
     * que el listado no miraba. Es la mitad del pedido que no existía antes.
     *
     * MUTACIÓN PROBADA: sacarle a `marcaDeAutoria` la rama de `updatedBy` deja
     * este caso en rojo y los otros cuatro en verde.
     */
    expect(marcaDeAutoria({ createdBy: YO, updatedBy: OTRO }, YO, MAILES)).toBe(
      'La cambió otra@ejemplo.test',
    );
  });

  it('con el directorio vacío dice exactamente lo que decía antes de B-888', () => {
    /*
     * **El default que preserva lo anterior.** `/usuarios` arranca vacía y se
     * llena a medida que cada cuenta entra, así que durante un rato no hay ningún
     * mail que resolver. Ahí la marca vuelve al artículo indefinido de B-130 —el
     * que no envejece con la cantidad de cuentas— en vez de mostrar un uid.
     */
    expect(marcaDeAutoria({ createdBy: OTRO, updatedBy: OTRO }, YO, SIN_DIRECTORIO)).toBe(
      ETIQUETA_AUTORIA.ajena,
    );
  });

  it('y un uid suelto nunca llega a la pantalla', () => {
    /*
     * El §5.1 mantiene los identificadores afuera de todo lo que se muestre, y
     * ésa era la razón por la que D-74 había descartado el filtro por autor. Lo
     * que cambió es que ahora hay un mail; lo que **no** cambió es que el uid no
     * se muestra, ni siquiera como respaldo.
     */
    for (const mailes of [MAILES, SIN_DIRECTORIO]) {
      for (const a of [
        { createdBy: OTRO, updatedBy: OTRO },
        { createdBy: YO, updatedBy: OTRO },
        { createdBy: 'uid_que_nadie_conoce', updatedBy: 'uid_que_nadie_conoce' },
      ]) {
        expect(marcaDeAutoria(a, YO, mailes) ?? '').not.toContain('uid_');
      }
    }
  });

  it('una actividad anterior a `createdBy` no se marca como ajena', () => {
    // Afirmar de más sobre datos viejos es peor que no decir nada: es la misma
    // regla que `autoriaDe` aplica con `desconocida`.
    expect(marcaDeAutoria({ updatedBy: YO }, YO, MAILES)).toBeNull();
  });
});
