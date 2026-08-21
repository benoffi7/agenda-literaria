import { describe, expect, it } from 'vitest';
import { actividadFormSchema } from '@/lib/schema';
import { sesionVacia } from '@/lib/sesiones';
import type { ItemMaterial } from '@/types/actividad';

const valido = () => ({
  tipo: 'taller',
  titulo: 'Taller de crónica urbana',
  slug: 'taller-cronica-urbana',
  descripcion: 'Escritura de no ficción, ocho encuentros.',
  imagenUrl: '',
  organizador: { nombre: 'Casa Brandon', instagram: '', web: '' },
  tallerista: null,
  esCiclo: false,
  sesiones: [{ ...sesionVacia(), inicio: '2026-09-03T19:00', fin: '2026-09-03T21:00' }],
  modalidad: 'presencial' as const,
  sede: {
    nombre: 'Casa Brandon',
    direccion: 'Drago 236',
    barrio: 'villa-crespo',
    ciudad: 'CABA',
    indicaciones: '',
    geo: null,
  },
  online: null,
  inscripcion: { requiere: false, via: null, destino: '', cupo: null, cierra: '' },
  arancel: { tipo: 'a-la-gorra', notas: '' },
  material: { tiene: false, items: [] as ItemMaterial[] },
  difusion: { arrobar: [], notas: '' },
  estado: 'borrador' as const,
  tags: [],
  destacado: false,
});

const errores = (v: unknown) => {
  const r = actividadFormSchema.safeParse(v);
  return r.success ? [] : r.error.issues.map((i) => i.path.join('.'));
};

describe('schema — caso feliz', () => {
  it('acepta una actividad presencial completa', () => {
    expect(actividadFormSchema.safeParse(valido()).success).toBe(true);
  });
});

describe('schema — condicionales de §11', () => {
  it('exige sede en presencial', () => {
    const v = valido();
    v.sede = { ...v.sede, nombre: '', direccion: '' };
    expect(errores(v)).toContain('sede.nombre');
    expect(errores(v)).toContain('sede.direccion');
  });

  it('exige plataforma en virtual', () => {
    const v = { ...valido(), modalidad: 'virtual' as const, sede: null, online: null };
    expect(errores(v)).toContain('online.plataforma');
  });

  it('exige sede Y plataforma en híbrido', () => {
    const v = { ...valido(), modalidad: 'hibrido' as const, online: null };
    expect(errores(v)).toContain('online.plataforma');
  });

  it('no pide sede en virtual', () => {
    const v = {
      ...valido(),
      modalidad: 'virtual' as const,
      sede: null,
      online: { plataforma: 'zoom', url: '', urlPublica: false },
    };
    expect(actividadFormSchema.safeParse(v).success).toBe(true);
  });
});

describe('schema — inscripción', () => {
  it('exige vía y destino si requiere inscripción', () => {
    const v = valido();
    v.inscripcion = { ...v.inscripcion, requiere: true };
    const e = errores(v);
    expect(e).toContain('inscripcion.via');
    expect(e).toContain('inscripcion.destino');
  });
});

describe('schema — sesiones', () => {
  it('pide al menos un encuentro', () => {
    expect(errores({ ...valido(), sesiones: [] })).toContain('sesiones');
  });

  it('rechaza un encuentro que termina antes de empezar', () => {
    const v = valido();
    v.sesiones = [{ ...v.sesiones[0]!, inicio: '2026-09-03T21:00', fin: '2026-09-03T19:00' }];
    expect(errores(v)).toContain('sesiones.0.fin');
  });

  it('rechaza ids que no vengan de nuevaSesionId', () => {
    const v = valido();
    v.sesiones = [{ ...v.sesiones[0]!, id: '0' }];
    expect(errores(v)).toContain('sesiones.0.id');
  });

  it('un ciclo necesita más de un encuentro', () => {
    expect(errores({ ...valido(), esCiclo: true })).toContain('sesiones');
  });
});

describe('schema — slug', () => {
  it('rechaza mayúsculas y espacios', () => {
    expect(errores({ ...valido(), slug: 'Taller Crónica' })).toContain('slug');
  });

  it('acepta minúsculas con guiones', () => {
    expect(errores({ ...valido(), slug: 'taller-de-cronica-2026' })).toEqual([]);
  });
});

describe('schema — material', () => {
  it('no deja tildar "tiene material" sin items', () => {
    const v = valido();
    v.material = { tiene: true, items: [] };
    expect(errores(v)).toContain('material.items');
  });

  it('exige título en cada item', () => {
    const v = valido();
    v.material = {
      tiene: true,
      items: [{ tipo: 'lectura', titulo: '', url: '', entrega: 'previo', publico: false }],
    };
    expect(errores(v)).toContain('material.items.0.titulo');
  });
});

describe('schema — coordenadas de la sede (§3.1)', () => {
  const conGeo = (geo: { lat: number; lng: number } | null) => {
    const v = valido();
    return { ...v, sede: { ...v.sede, geo } };
  };

  it('acepta la sede sin coordenadas: el campo es opcional', () => {
    expect(errores(conGeo(null))).toEqual([]);
  });

  it('acepta un punto válido', () => {
    expect(errores(conGeo({ lat: -34.5989, lng: -58.4392 }))).toEqual([]);
  });

  it('rechaza una latitud que no existe', () => {
    expect(errores(conGeo({ lat: 200, lng: -58.4392 }))).toContain('sede.geo.lat');
  });

  it('rechaza una longitud que no existe', () => {
    expect(errores(conGeo({ lat: -34.5989, lng: -400 }))).toContain('sede.geo.lng');
  });
});

describe('schema — no publicar con el slug de una copia (trampa 10)', () => {
  it('rechaza publicar con un slug que termina en -copia', () => {
    const v = { ...valido(), estado: 'publicado' as const, slug: 'club-lectura-copia' };
    expect(errores(v)).toContain('slug');
  });

  it('rechaza también los sufijos numerados', () => {
    const v = { ...valido(), estado: 'publicado' as const, slug: 'club-lectura-copia-3' };
    expect(errores(v)).toContain('slug');
  });

  it('deja GUARDAR un borrador con ese slug', () => {
    // La copia nace como borrador con `-copia` a propósito: el bloqueo es solo
    // al publicar, para no romper el flujo de duplicar.
    const v = { ...valido(), estado: 'borrador' as const, slug: 'club-lectura-copia' };
    expect(errores(v)).toEqual([]);
  });

  it('deja publicar en cuanto se corrige el slug', () => {
    const v = { ...valido(), estado: 'publicado' as const, slug: 'club-lectura-2027' };
    expect(errores(v)).toEqual([]);
  });

  it('no confunde un slug que solo contiene la palabra copia', () => {
    // "copiando-a-borges" no es una copia: la regla es sobre el sufijo.
    const v = { ...valido(), estado: 'publicado' as const, slug: 'copia-de-seguridad-taller' };
    expect(errores(v)).toEqual([]);
  });
});
