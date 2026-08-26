import { describe, expect, it } from 'vitest';
import type { Imagen } from '@/types/actividad';
import { actividadFormSchema, faltaParaPublicar } from '@/lib/schema';
import { sesionVacia } from '@/lib/sesiones';
import type { ItemMaterial } from '@/types/actividad';

/**
 * Los dos niveles de validación de B-183.
 *
 * El schema es uno solo y la condición es `estado === 'publicado'`, así que casi
 * todos los tests de completitud de acá abajo se escriben sobre `publicado()`:
 * son las reglas del §11, que ahora corren al publicar y no al guardar a medias.
 * Los que se escriben sobre `valido()` —un borrador— son los que tienen que
 * seguir bloqueando en los dos niveles: ids de sesión, fechas y formato del slug.
 */
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

/** La misma actividad, pero saliendo al público: el nivel largo. */
const publicado = () => ({ ...valido(), estado: 'publicado' as const });

const errores = (v: unknown) => {
  const r = actividadFormSchema.safeParse(v);
  return r.success ? [] : r.error.issues.map((i) => i.path.join('.'));
};

describe('schema — caso feliz', () => {
  it('acepta una actividad presencial completa', () => {
    expect(actividadFormSchema.safeParse(valido()).success).toBe(true);
  });

  it('la acepta también publicada', () => {
    expect(actividadFormSchema.safeParse(publicado()).success).toBe(true);
  });
});

describe('schema — el borrador se guarda a medias (B-183)', () => {
  /**
   * El pedido del dueño, palabra por palabra: "No me deja GUARDAR BORRADOR si
   * no completo todo". Esto es el mínimo con el que ahora se puede guardar: el
   * título, y el slug que se genera solo desde el título.
   */
  const aMedias = () => ({
    ...valido(),
    tipo: '',
    descripcion: '',
    organizador: { nombre: '', instagram: '', web: '' },
    sesiones: [],
    arancel: { tipo: '', notas: '' },
    sede: { nombre: '', direccion: '', barrio: '', ciudad: '', indicaciones: '', geo: null },
  });

  it('guarda un borrador con solo título y slug', () => {
    expect(errores(aMedias())).toEqual([]);
  });

  it('guarda un borrador sin ningún encuentro cargado', () => {
    expect(errores({ ...valido(), sesiones: [] })).toEqual([]);
  });

  it('guarda un borrador con una URL de imagen a medio escribir', () => {
    expect(errores({ ...valido(), imagenUrl: 'https://ins' })).toEqual([]);
  });

  it('guarda un borrador de un ciclo con un solo encuentro', () => {
    expect(errores({ ...valido(), esCiclo: true })).toEqual([]);
  });

  it('guarda un borrador con material tildado y sin ítems', () => {
    expect(errores({ ...valido(), material: { tiene: true, items: [] } })).toEqual([]);
  });

  it('guarda un borrador que pide inscripción sin decir por dónde', () => {
    const v = valido();
    v.inscripcion = { ...v.inscripcion, requiere: true };
    expect(errores(v)).toEqual([]);
  });

  it('pero sigue pidiendo un título: sin él no se lo encuentra en el listado', () => {
    expect(errores({ ...aMedias(), titulo: '' })).toContain('titulo');
  });

  it('y sigue pidiendo el slug, que es la dirección del documento', () => {
    expect(errores({ ...aMedias(), slug: '' })).toContain('slug');
  });

  it('el mismo borrador a medias NO se puede publicar', () => {
    // El par que define los dos niveles: mismo formulario, dos respuestas.
    const e = errores({ ...aMedias(), estado: 'publicado' });
    expect(e).toContain('tipo');
    expect(e).toContain('descripcion');
    expect(e).toContain('organizador.nombre');
    expect(e).toContain('arancel.tipo');
    expect(e).toContain('sesiones');
    expect(e).toContain('sede.nombre');
  });
});

describe('schema — lo que bloquea en los dos niveles', () => {
  /**
   * No es completitud: es que el documento sea legible. Una fecha vacía tira
   * `Fecha inválida` en `formADocumento` (trampa 1) y un id que no viene del
   * cliente rompe el diff contra Calendar (trampa 2). Un borrador con eso
   * adentro no es un borrador incompleto, es un documento roto.
   */
  it('rechaza una fecha de inicio vacía, también en borrador', () => {
    const v = valido();
    v.sesiones = [{ ...v.sesiones[0]!, inicio: '' }];
    expect(errores(v)).toContain('sesiones.0.inicio');
  });

  it('rechaza un encuentro que termina antes de empezar, también en borrador', () => {
    const v = valido();
    v.sesiones = [{ ...v.sesiones[0]!, inicio: '2026-09-03T21:00', fin: '2026-09-03T19:00' }];
    expect(errores(v)).toContain('sesiones.0.fin');
  });

  it('rechaza ids que no vengan de nuevaSesionId, también en borrador (trampa 2)', () => {
    const v = valido();
    v.sesiones = [{ ...v.sesiones[0]!, id: '0' }];
    expect(errores(v)).toContain('sesiones.0.id');
  });

  it('rechaza un slug con mayúsculas y espacios, también en borrador', () => {
    expect(errores({ ...valido(), slug: 'Taller Crónica' })).toContain('slug');
  });
});

describe('schema — condicionales de §11 (al publicar)', () => {
  it('exige sede en presencial', () => {
    const v = publicado();
    v.sede = { ...v.sede, nombre: '', direccion: '' };
    expect(errores(v)).toContain('sede.nombre');
    expect(errores(v)).toContain('sede.direccion');
  });

  it('exige plataforma en virtual', () => {
    const v = { ...publicado(), modalidad: 'virtual' as const, sede: null, online: null };
    expect(errores(v)).toContain('online.plataforma');
  });

  it('exige sede Y plataforma en híbrido', () => {
    const v = { ...publicado(), modalidad: 'hibrido' as const, online: null };
    expect(errores(v)).toContain('online.plataforma');
  });

  it('no pide sede en virtual', () => {
    const v = {
      ...publicado(),
      modalidad: 'virtual' as const,
      sede: null,
      online: { plataforma: 'zoom', url: '', urlPublica: false },
    };
    expect(actividadFormSchema.safeParse(v).success).toBe(true);
  });
});

describe('schema — inscripción (al publicar)', () => {
  it('exige vía y destino si requiere inscripción', () => {
    const v = publicado();
    v.inscripcion = { ...v.inscripcion, requiere: true };
    const e = errores(v);
    expect(e).toContain('inscripcion.via');
    expect(e).toContain('inscripcion.destino');
  });
});

describe('schema — sesiones (al publicar)', () => {
  it('pide al menos un encuentro', () => {
    expect(errores({ ...publicado(), sesiones: [] })).toContain('sesiones');
  });

  it('un ciclo necesita más de un encuentro', () => {
    expect(errores({ ...publicado(), esCiclo: true })).toContain('sesiones');
  });
});

describe('schema — slug', () => {
  it('acepta minúsculas con guiones', () => {
    expect(errores({ ...valido(), slug: 'taller-de-cronica-2026' })).toEqual([]);
  });
});

describe('schema — material (al publicar)', () => {
  it('no deja tildar "tiene material" sin items', () => {
    const v = publicado();
    v.material = { tiene: true, items: [] };
    expect(errores(v)).toContain('material.items');
  });

  it('exige título en cada item', () => {
    const v = publicado();
    v.material = {
      tiene: true,
      items: [{ tipo: 'lectura', titulo: '', url: '', entrega: 'previo', publico: false }],
    };
    expect(errores(v)).toContain('material.items.0.titulo');
  });

  it('nombra la fila exacta cuando el que falta es el segundo', () => {
    const v = publicado();
    v.material = {
      tiene: true,
      items: [
        { tipo: 'lectura', titulo: 'Pedro Páramo', url: '', entrega: 'previo', publico: false },
        { tipo: 'guia', titulo: '', url: '', entrega: 'previo', publico: false },
      ],
    };
    expect(errores(v)).toContain('material.items.1.titulo');
  });
});

describe('schema — la galería (B-167)', () => {
  const img = (over: Partial<Imagen> = {}): Imagen => ({
    id: 'img_1',
    url: 'https://ejemplo.ar/tapa.jpg',
    epigrafe: '',
    origen: 'externa',
    portada: true,
    ...over,
  });

  it('acepta la lista vacía: la imagen nunca fue obligatoria', () => {
    expect(errores({ ...publicado(), imagenes: [] })).toEqual([]);
  });

  it('acepta una externa con portada', () => {
    expect(errores({ ...publicado(), imagenes: [img()] })).toEqual([]);
  });

  it('rechaza al publicar una URL inválida, con la ruta de la fila', () => {
    expect(errores({ ...publicado(), imagenes: [img({ url: 'no-es-una-url' })] })).toContain(
      'imagenes.0.url',
    );
  });

  it('pero un borrador con la URL a medio escribir se guarda igual (D-120)', () => {
    expect(errores({ ...valido(), imagenes: [img({ url: 'https://ins' })] })).toEqual([]);
  });

  it('el id tiene que venir del generador, en los dos niveles (trampa 2)', () => {
    // Por índice, borrar la segunda imagen renumera todo y cualquier cosa que
    // compare por posición cree que cambiaron todas.
    expect(errores({ ...valido(), imagenes: [img({ id: '0' })] })).toContain('imagenes.0.id');
  });

  it('exactamente una portada, en los dos niveles', () => {
    const dos = [img(), img({ id: 'img_2' })];
    expect(errores({ ...valido(), imagenes: dos })).toContain('imagenes');
    const ninguna = [img({ portada: false })];
    expect(errores({ ...valido(), imagenes: ninguna })).toContain('imagenes');
  });

  it('hasta cuatro, en los dos niveles (DEC-7b)', () => {
    const cinco = Array.from({ length: 5 }, (_, n) =>
      img({ id: `img_${n}`, portada: n === 0 }),
    );
    expect(errores({ ...valido(), imagenes: cinco })).toContain('imagenes');
  });

  it('al publicar, la URL tiene que ser https', () => {
    // `z.string().url()` acepta todo lo que `new URL()` parsee, o sea también
    // `data:` y `javascript:`, y esa URL sale entera al events.json y va a
    // terminar en un <img src> y en og:image (B-107). Y un http:// lo bloquea el
    // contenido mixto: imagen rota en el sitio, sin que nada avise.
    for (const url of ['http://ejemplo.ar/tapa.jpg', 'data:image/png;base64,AAA']) {
      expect(
        errores({ ...publicado(), imagenes: [img({ url })] }),
        `se aceptó ${url}`,
      ).toContain('imagenes.0.url');
    }
  });

  it('pero un borrador con http:// se guarda igual: se corrige antes de publicar', () => {
    expect(errores({ ...valido(), imagenes: [img({ url: 'http://ejemplo.ar/t.jpg' })] })).toEqual(
      [],
    );
  });

  it('storagePath se acepta pero no se exige: lo escribe la Function', () => {
    expect(
      errores({ ...publicado(), imagenes: [img({ origen: 'propia', storagePath: 'a/b.jpg' })] }),
    ).toEqual([]);
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

  it('rechaza una latitud que no existe, también en borrador', () => {
    expect(errores(conGeo({ lat: 200, lng: -58.4392 }))).toContain('sede.geo.lat');
  });

  it('rechaza una longitud que no existe, también en borrador', () => {
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

describe('faltaParaPublicar — el aviso que no bloquea', () => {
  const rutas = (v: unknown) => faltaParaPublicar(v).map((i) => i.path.join('.'));

  it('sobre un borrador válido dice lo que le va a faltar al publicar', () => {
    const v = { ...valido(), arancel: { tipo: '', notas: '' }, descripcion: '' };
    expect(actividadFormSchema.safeParse(v).success).toBe(true);
    expect(rutas(v)).toEqual(expect.arrayContaining(['arancel.tipo', 'descripcion']));
  });

  it('no devuelve nada cuando la actividad ya está lista para publicar', () => {
    expect(faltaParaPublicar(valido())).toEqual([]);
  });

  it('cada faltante viene con su mensaje, para poder nombrarlo', () => {
    const faltantes = faltaParaPublicar({ ...valido(), arancel: { tipo: '', notas: '' } });
    expect(faltantes[0]).toMatchObject({ path: ['arancel', 'tipo'], message: 'Elegí el arancel' });
  });

  it('no toca el formulario que recibe: el estado sigue siendo borrador', () => {
    const v = valido();
    faltaParaPublicar(v);
    expect(v.estado).toBe('borrador');
  });

  it('no explota con algo que no es un formulario', () => {
    expect(faltaParaPublicar(null).length).toBeGreaterThan(0);
  });
});
