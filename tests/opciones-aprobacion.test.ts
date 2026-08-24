import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import base from '@/lib/opciones-base.json';
import { huellaCreador } from '@/lib/huella';
import { estaAprobada, opcionesVisibles } from '@/lib/opciones';
import { CAMPOS_TAXONOMIA, type ValorOpcion } from '@/types/actividad';

const UID_A = 'bNvcQmbUwdSduoSfA2Oa9hxYMQp2';
const UID_B = 'JBnbwgf2VxgPWSMaWKTI5PlSwUu1';

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
