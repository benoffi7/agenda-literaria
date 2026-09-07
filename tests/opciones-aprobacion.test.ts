import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import base from '@/lib/opciones-base.json';
import { huellaCreador } from '@/lib/huella';
import { elReusoLaAprueba, estaAprobada, opcionesVisibles } from '@/lib/opciones';
import { opcionPublica, opcionesPublicas } from '@/lib/toPublic';
import { CAMPOS_TAXONOMIA, type ValorOpcion } from '@/types/actividad';

/*
 * Dos uids con la forma real (28 caracteres) pero inventados: eran los de las
 * dos cuentas admin de verdad, y este repo es público (§5.1, D-57). Lo que el
 * test necesita es que `huellaCreador` distinga dos uids distintos, no que sean
 * los del proyecto.
 */
const UID_A = 'CENTINELAuidA000000000000000';
const UID_B = 'CENTINELAuidB000000000000000';

const opcion = (v: Partial<ValorOpcion> = {}): ValorOpcion => ({
  slug: 'beca',
  label: 'Con beca parcial',
  orden: 99,
  fijo: false,
  usos: 1,
  ...v,
});

/** §4.3 — las opciones nuevas funcionan igual pero no aparecen en el desplegable de los demás. */
describe('estaAprobada — §4.3', () => {
  it('las opciones base están aprobadas por definición', () => {
    expect(estaAprobada(opcion({ fijo: true }))).toBe(true);
    // Ni siquiera un `aprobada: false` explícito puede sacar del desplegable a
    // una opción base: son las que pueden estar cableadas en la lógica.
    expect(estaAprobada(opcion({ fijo: true, aprobada: false }))).toBe(true);
  });

  it('una opción creada con "Otro" arranca pendiente', () => {
    expect(estaAprobada(opcion({ aprobada: false }))).toBe(false);
  });

  it('una opción aprobada lo está', () => {
    expect(estaAprobada(opcion({ aprobada: true }))).toBe(true);
  });

  /**
   * El caso que importa en producción: los documentos de `/opciones/*` que ya
   * existen se escribieron antes de que existiera el campo. Si la ausencia
   * contara como "pendiente", opciones que hoy se usan desaparecerían del
   * desplegable y el formulario mostraría el slug crudo.
   */
  it('el campo ausente cuenta como aprobada — compatibilidad con lo que ya está cargado', () => {
    const yaEnProduccion: ValorOpcion = {
      slug: 'narrativa',
      label: 'narrativa',
      orden: 99,
      fijo: false,
      usos: 3,
    };
    expect(yaEnProduccion.aprobada).toBeUndefined();
    expect(estaAprobada(yaEnProduccion)).toBe(true);
    expect(opcionesVisibles([yaEnProduccion])).toHaveLength(1);
  });

  it('las opciones base del JSON están todas aprobadas', () => {
    for (const campo of CAMPOS_TAXONOMIA) {
      for (const v of base[campo] as ValorOpcion[]) {
        expect(estaAprobada(v), `${campo}/${v.slug}`).toBe(true);
      }
    }
  });
});

describe('opcionesVisibles — §4.3', () => {
  const aprobada = opcion({ slug: 'aprobada', aprobada: true });
  const miPendiente = opcion({
    slug: 'mi-pendiente',
    aprobada: false,
    huellaCreador: huellaCreador(UID_A),
  });
  const pendienteAjena = opcion({
    slug: 'ajena',
    aprobada: false,
    huellaCreador: huellaCreador(UID_B),
  });
  const todas = [aprobada, miPendiente, pendienteAjena];

  it('quien la creó sigue viendo su opción pendiente', () => {
    expect(opcionesVisibles(todas, UID_A).map((v) => v.slug)).toEqual([
      'aprobada',
      'mi-pendiente',
    ]);
  });

  it('los demás no la ven hasta que se apruebe', () => {
    expect(opcionesVisibles(todas, UID_B).map((v) => v.slug)).toEqual(['aprobada', 'ajena']);
  });

  it('sin uid solo se ven las aprobadas — es el caso del events.json (§4.4)', () => {
    expect(opcionesVisibles(todas).map((v) => v.slug)).toEqual(['aprobada']);
  });

  it('aprobarla la hace visible para todos', () => {
    const aprobadas = todas.map((v) =>
      v.slug === 'ajena' ? { ...v, aprobada: true } : v,
    );
    expect(opcionesVisibles(aprobadas, UID_A).map((v) => v.slug)).toEqual([
      'aprobada',
      'mi-pendiente',
      'ajena',
    ]);
  });

  /**
   * Trampa: `undefined === undefined` es true. Si el filtro comparara huellas
   * sin exigir que existan, una opción pendiente sin autor se le mostraría a
   * cualquiera, incluido el sitio público.
   */
  it('una pendiente sin huella de autor no se le muestra a nadie', () => {
    const huerfana = opcion({ slug: 'huerfana', aprobada: false });
    expect(opcionesVisibles([huerfana], UID_A)).toEqual([]);
    expect(opcionesVisibles([huerfana], '')).toEqual([]);
    expect(opcionesVisibles([huerfana])).toEqual([]);
  });

  it('no muta el array recibido', () => {
    const original = [...todas];
    opcionesVisibles(todas, UID_A);
    expect(todas).toEqual(original);
  });
});

describe('huellaCreador — §4.3, §5.1', () => {
  it('es estable para el mismo uid', () => {
    expect(huellaCreador(UID_A)).toBe(huellaCreador(UID_A));
  });

  it('distingue uids distintos', () => {
    expect(huellaCreador(UID_A)).not.toBe(huellaCreador(UID_B));
  });

  /** §5.1 — los uids no salen al público, y `/opciones/*` es de lectura pública (§5.3). */
  it('no contiene el uid: lo que se publica es un pseudónimo', () => {
    const huella = huellaCreador(UID_A);
    expect(huella).toMatch(/^[0-9a-f]{8}$/);
    expect(huella).not.toContain(UID_A);
    expect(UID_A).not.toContain(huella);
  });

  it('sin uid no hay huella — no puede haber dos sesiones anónimas que se reconozcan', () => {
    expect(huellaCreador('')).toBe('');
  });
});

/**
 * B-131 — el dueño decidió que las opciones nuevas nazcan **aprobadas**, y con
 * eso la maquinaria de aprobación queda dormida. Una maquinaria dormida tiene
 * dos formas de fallar en silencio, y esta guardia cubre las dos: que el
 * default se vuelva a dar vuelta sin que nadie lo note, y que alguien lea
 * `aprobada: true` como un descuido y lo "arregle".
 *
 * Se lee el fuente y no se corre `upsertOpcion` a propósito: el camino real
 * necesita el emulador y sus tests se saltean cuando no está corriendo, que es
 * justo cuando un cambio de default pasaría inadvertido (D-98: la guardia más
 * barata que alcance).
 */
describe('default de `aprobada` en upsertOpcion — B-131', () => {
  const bloqueNueva = (): string => {
    const src = readFileSync('src/lib/opciones.ts', 'utf8');
    const desde = src.indexOf('const nueva = ()');
    expect(desde, 'no se encontró el constructor de la opción nueva').toBeGreaterThan(0);
    return src.slice(desde, src.indexOf('runTransaction', desde));
  };

  it('nace aprobada', () => {
    expect(bloqueNueva()).toMatch(/aprobada:\s*true/);
  });

  it('con el motivo escrito al lado, para que no se lea como un descuido', () => {
    expect(bloqueNueva()).toContain('B-131');
  });

  it('y sigue guardando la huella de su autor', () => {
    // Es el rastro de quién la creó y lo que hace falta el día que la
    // aprobación se vuelva a prender: no es código muerto.
    expect(bloqueNueva()).toContain('huellaCreador(uid)');
  });
});

/**
 * B-29 — que la reuse otra cuenta la aprueba, y la deja marcada.
 *
 * La decisión del dueño, con sus dos mitades: **aprobar**, porque que dos
 * personas distintas escriban el mismo vocabulario es la mejor señal automática
 * de que el vocabulario es real y hoy esa etiqueta queda en el peor estado
 * posible —dos la usan y ninguna la ve—; y **marcar**, porque el contra que el
 * ítem nombra es que las dos repitan el mismo typo, y sin marca esa aprobación
 * sería indistinguible de una humana.
 *
 * Hoy casi no hay pendientes —B-131 hace que todo nazca aprobado y dejó la
 * maquinaria dormida—, así que esta regla cubre lo que quedó de antes **y** es la
 * que hace que la maquinaria sea correcta el día que se vuelva a prender, que es
 * el escenario que anticipa el §4.3.
 */
describe('el reuso de otra cuenta aprueba la etiqueta (B-29)', () => {
  const huellaA = huellaCreador(UID_A);
  const huellaB = huellaCreador(UID_B);

  it('pendiente de A, la reusa B: se aprueba', () => {
    const v = opcion({ aprobada: false, huellaCreador: huellaA });
    expect(elReusoLaAprueba(v, huellaB)).toBe(true);
  });

  it('pendiente de A, la reusa A: no pasa nada', () => {
    // La señal es «dos personas», no «dos veces». Sin esto, cualquiera se
    // aprueba sus propias etiquetas usándolas de nuevo, que es no tener
    // aprobación.
    const v = opcion({ aprobada: false, huellaCreador: huellaA });
    expect(elReusoLaAprueba(v, huellaA)).toBe(false);
  });

  it('pendiente pero sin huella: NO se aprueba', () => {
    /*
     * El borde que el propio ítem nombra. Sin `huellaCreador` —los documentos
     * anteriores a que el campo existiera— no se puede afirmar que la esté
     * reusando *otra* cuenta: podría ser la misma persona, y entonces no hay
     * ninguna señal. El default seguro es no aprobar.
     */
    const v = opcion({ aprobada: false });
    expect(elReusoLaAprueba(v, huellaB)).toBe(false);
  });

  it('sin sesión —sin huella de quien la usa— tampoco', () => {
    const v = opcion({ aprobada: false, huellaCreador: huellaA });
    expect(elReusoLaAprueba(v, '')).toBe(false);
  });

  it('una que ya está aprobada no se vuelve a «aprobar por reuso»', () => {
    // Si no, una etiqueta que aprobó una persona quedaría marcada como aprobada
    // sola, y la marca dejaría de significar «nadie la miró».
    expect(elReusoLaAprueba(opcion({ aprobada: true, huellaCreador: huellaA }), huellaB)).toBe(
      false,
    );
    // Ausente cuenta como aprobada (`estaAprobada`), y una base también.
    expect(elReusoLaAprueba(opcion({ huellaCreador: huellaA }), huellaB)).toBe(false);
    expect(
      elReusoLaAprueba(opcion({ fijo: true, aprobada: false, huellaCreador: huellaA }), huellaB),
    ).toBe(false);
  });

  it('la decisión se aplica adentro de la transacción que ya suma el uso', () => {
    /*
     * Es lo que hace que no cueste una lectura más **y** que no sea una carrera:
     * resolverlo afuera —leer, decidir, escribir— compite con el otro guardado
     * simultáneo, que es lo que la transacción del §4.2 existe para evitar.
     */
    const src = readFileSync('src/lib/opciones.ts', 'utf8');
    expect(src).toContain('elReusoLaAprueba(v, huella)');
    expect(src).toContain('aprobadaPorReuso: true');
    // Y el incremento de `usos` pasa por la misma función, en los dos caminos
    // (documento sembrado y documento existente): si alguno se saltea `conElUso`,
    // ese camino aprueba distinto que el otro.
    expect(src.match(/v\.slug === slug \? conElUso\(v\) : v/g)?.length).toBe(2);
  });

  it('la pantalla de taxonomías muestra la marca', () => {
    // Sin esto la marca queda en la base de datos y no la ve nadie, que es lo
    // mismo que no marcarla: el punto de marcar es poder deshacer el typo.
    const panel = readFileSync('src/components/admin/taxonomias/TaxonomiasPanel.tsx', 'utf8');
    expect(panel).toContain('v.aprobadaPorReuso === true');
  });

  /**
   * La celda que faltaba decidir **por valor y no por prosa**, y la señaló el
   * `auditor-privacidad`: aprobar una etiqueta es publicarla. `opcionesPublicas`
   * emite las visibles, así que la que aprueba esta regla entra al `events.json`
   * y a los chips del sitio aunque solo la usen borradores. Es la consecuencia de
   * la decisión, no un efecto no querido — pero tiene que estar fijada, porque es
   * la que convierte «coinciden dos cuentas» en una puerta de publicación de
   * texto tipeado a mano.
   */
  it('una etiqueta aprobada por reuso entra a las opciones públicas: aprobar es publicar', () => {
    const v = opcion({ aprobada: true, aprobadaPorReuso: true, huellaCreador: huellaA });
    expect(opcionesPublicas([v]).map((o) => o.slug)).toContain(v.slug);
    // Y mientras estaba pendiente NO salía: es lo que cambia el reuso.
    const pendiente = opcion({ aprobada: false, huellaCreador: huellaA });
    expect(opcionesPublicas([pendiente])).toEqual([]);
  });

  it('la marca no sale al sitio: la proyección del §4.4 sigue siendo whitelist', () => {
    // `aprobadaPorReuso` es un booleano sobre la etiqueta y no identifica a
    // nadie, pero el chequeo que importa es el de la forma: que un campo nuevo
    // de `ValorOpcion` no salga por no haberlo agregado a mano.
    expect(Object.keys(opcionPublica(opcion({ aprobadaPorReuso: true, huellaCreador: huellaA }))))
      .toEqual(['slug', 'label']);
  });
});
