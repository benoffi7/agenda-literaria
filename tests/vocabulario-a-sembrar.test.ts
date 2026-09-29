import { describe, expect, it } from 'vitest';
import { usosPorCampo, valoresNuevos } from '../scripts/vocabulario-a-sembrar.mjs';

/**
 * B-975 y roadmap 1.5 (B-2172 paso 3) — lo que `vocabulario-desde-actividades`
 * siembra: lo que las actividades usan y el vocabulario no ofrece, con su `usos`
 * real y la etiqueta de la variante más escrita.
 */
const conSede = (sede: Record<string, string>, organizador?: Record<string, string>) => ({
  modalidades: [{ sede }],
  ...(organizador ? { organizador } : {}),
});

describe('usosPorCampo', () => {
  it('cuenta por actividad y no por fila: dos sedes en la misma ciudad son un uso', () => {
    const u = usosPorCampo([
      { modalidades: [{ sede: { ciudad: 'Mar del Plata' } }, { sede: { ciudad: 'mar del plata' } }] },
    ]);
    expect(u.ciudad.get('mar-del-plata')?.usos).toBe(1);
  });

  it('junta al organizador por slug y propone la variante más escrita', () => {
    // Mutación: quedarse con la primera variante propone «casa brandon ».
    const u = usosPorCampo([
      conSede({}, { nombre: 'casa brandon ' }),
      conSede({}, { nombre: 'Casa Brandon' }),
      conSede({}, { nombre: 'Casa  Brandon' }),
    ]);
    expect(u.organizador.get('casa-brandon')).toEqual({ usos: 3, crudo: 'Casa Brandon' });
  });

  it('a igual cantidad, propone la variante con más mayúsculas', () => {
    const u = usosPorCampo([conSede({}, { nombre: 'casa brandon' }), conSede({}, { nombre: 'Casa Brandon' })]);
    expect(u.organizador.get('casa-brandon')?.crudo).toBe('Casa Brandon');
  });

  it('usa el slug guardado del organizador antes que el del nombre (D-26)', () => {
    const u = usosPorCampo([conSede({}, { nombre: 'Mandolina Libros', slug: 'mandolina' })]);
    expect([...u.organizador.keys()]).toEqual(['mandolina']);
  });

  it('una actividad sin organizador no aporta nada', () => {
    const u = usosPorCampo([conSede({}, { nombre: '  ' }), conSede({})]);
    expect(u.organizador.size).toBe(0);
  });
});

describe('valoresNuevos', () => {
  it('no siembra lo excluido: el relleno nacería aprobado y con página (B-2178)', () => {
    const u = usosPorCampo([conSede({}, { nombre: 'A conf' }), conSede({}, { nombre: 'Ana Pérez' })]);
    expect(valoresNuevos(u.organizador, [], ['a-conf']).map((v) => v.slug)).toEqual(['ana-perez']);
  });

  it('solo lo que falta, por uso, aprobado y sin huella', () => {
    const u = usosPorCampo([
      conSede({}, { nombre: 'Casa Brandon' }),
      conSede({}, { nombre: 'Ana Pérez' }),
      conSede({}, { nombre: 'ana pérez' }),
      conSede({}, { nombre: 'Mandolina' }),
    ]);
    const nuevos = valoresNuevos(u.organizador, [{ slug: 'mandolina' }]);
    expect(nuevos).toEqual([
      { slug: 'ana-perez', label: 'Ana Pérez', orden: 99, fijo: false, usos: 2, aprobada: true },
      { slug: 'casa-brandon', label: 'Casa Brandon', orden: 99, fijo: false, usos: 1, aprobada: true },
    ]);
  });
});
