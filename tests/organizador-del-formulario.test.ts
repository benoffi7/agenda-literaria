import { describe, expect, it } from 'vitest';
import { formADocumento } from '@/lib/actividades';
import { usosAContar } from '@/lib/formulario/etiquetas';
import { resolverOrganizador } from '@/lib/formulario/organizador';
import type { Organizador, ValorOpcion } from '@/types/actividad';
import { formGuardable } from './fixtures/formulario';

/**
 * Roadmap 1.5, B-2172 paso 2 — lo que se guarda con lo escrito en «Organiza».
 *
 * La caja es texto libre que autocompleta; lo que evita la página duplicada es
 * lo que pasa al guardar, y eso es lo que fija este archivo: reusar la opción
 * que ya existe (por slug, y por el slug de su etiqueta después de renombrarla)
 * y dar de alta la nueva por el buffer de D-02.
 */
const opcion = (slug: string, label: string, extra: Partial<ValorOpcion> = {}): ValorOpcion => ({
  slug,
  label,
  orden: 99,
  fijo: false,
  usos: 3,
  ...extra,
});

const org = (nombre: string, extra: Partial<Organizador> = {}): Organizador => ({
  nombre,
  instagram: 'casabrandon',
  web: '',
  ...extra,
});

const LISTA = [opcion('casa-brandon', 'Casa Brandon'), opcion('mandolina', 'Mandolina Libros')];

describe('resolverOrganizador', () => {
  it('reusa la opción que ya existe aunque se haya tipeado distinto (§4.2)', () => {
    const r = resolverOrganizador(org('  casa  brandon '), LISTA);
    expect(r.organizador).toEqual({
      nombre: 'Casa Brandon',
      instagram: 'casabrandon',
      web: '',
      slug: 'casa-brandon',
    });
    expect(r.labelNuevo).toBeUndefined();
  });

  it('reconoce una opción renombrada por su etiqueta nueva, sin duplicarla', () => {
    // «mandolina» se renombró a «Mandolina Libros»: el slug no cambió (§4.1).
    // Mutación: sacar la segunda mirada de `opcionDeOrganizador` crea
    // «mandolina-libros» en el segundo guardado de la misma actividad.
    const r = resolverOrganizador(org('Mandolina Libros'), LISTA);
    expect(r.organizador.slug).toBe('mandolina');
    expect(r.labelNuevo).toBeUndefined();
  });

  it('da de alta el organizador nuevo, con la misma etiqueta que queda escrita', () => {
    const r = resolverOrganizador(org('librería la  gran siete'), LISTA);
    expect(r.organizador).toMatchObject({
      nombre: 'Librería la gran siete',
      slug: 'libreria-la-gran-siete',
    });
    expect(r.labelNuevo).toEqual({ campo: 'organizador', label: 'Librería la gran siete' });
  });

  it('reusa también una opción sin aprobar de otra cuenta: el slug es el mismo', () => {
    const lista = [opcion('ana-perez', 'Ana Pérez', { aprobada: false, huellaCreador: 'otra' })];
    const r = resolverOrganizador(org('ana perez'), lista);
    expect(r.organizador.slug).toBe('ana-perez');
    expect(r.labelNuevo).toBeUndefined();
  });

  it('no arrastra el slug viejo cuando se cambió el nombre', () => {
    const r = resolverOrganizador(org('Mandolina', { slug: 'casa-brandon' }), []);
    expect(r.organizador.slug).toBe('mandolina');
  });

  it('con la lista sin cargar no reescribe el nombre, y el slug sale igual', () => {
    const r = resolverOrganizador(org('Casa Brandon'), [], { listaCargada: false });
    expect(r.organizador).toMatchObject({ nombre: 'Casa Brandon', slug: 'casa-brandon' });
    // El alta reusa por slug (`upsertOpcion`, la callable): no duplica.
    expect(r.labelNuevo?.label).toBe('Casa Brandon');
  });

  it('sin nombre no hay slug ni alta', () => {
    const r = resolverOrganizador(org('   ', { slug: 'casa-brandon' }), LISTA);
    expect(r.organizador).toEqual({ nombre: '', instagram: 'casabrandon', web: '' });
    expect(r.labelNuevo).toBeUndefined();
  });
});

describe('formADocumento escribe organizador.slug', () => {
  it('el que resolvió el formulario', () => {
    const doc = formADocumento(
      formGuardable({ organizador: org('Mandolina Libros', { slug: 'mandolina' }) }),
      'uid',
      true,
    );
    expect(doc.organizador).toMatchObject({ nombre: 'Mandolina Libros', slug: 'mandolina' });
  });

  it('y si nadie lo resolvió, el del nombre (el mismo que deriva la lectura, D-26)', () => {
    const doc = formADocumento(formGuardable({ organizador: org('Casa Brandon') }), 'uid', true);
    expect((doc.organizador as Organizador).slug).toBe('casa-brandon');
  });

  it('sin nombre, la clave no va: ni vacía ni undefined (Firestore rechaza undefined)', () => {
    const doc = formADocumento(
      formGuardable({ organizador: org('', { slug: 'casa-brandon' }) }),
      'uid',
      true,
    );
    expect('slug' in (doc.organizador as Organizador)).toBe(false);
  });
});

describe('usosAContar cuenta el organizador (§4.3)', () => {
  const base = {
    arancel: { tipo: '' },
    tipo: '',
    modalidades: [],
    tags: [],
  };

  it('el elegido de la lista suma un uso', () => {
    expect(
      usosAContar({ ...base, organizador: { nombre: 'Casa Brandon', slug: 'casa-brandon' } }, [], {})
        .organizador,
    ).toEqual(['casa-brandon']);
  });

  it('el recién creado no, que ya nace con usos: 1', () => {
    const r = usosAContar(
      { ...base, organizador: { nombre: 'Ana Pérez', slug: 'ana-perez' } },
      [{ campo: 'organizador', label: 'Ana Pérez' }],
      {},
    );
    expect(r.organizador).toBeUndefined();
  });

  it('ni el que ya estaba antes de esta edición, aunque el documento viejo no tenga slug (B-340)', () => {
    const r = usosAContar(
      { ...base, organizador: { nombre: 'Casa Brandon', slug: 'casa-brandon' } },
      [],
      {},
      { ...base, organizador: { nombre: 'Casa Brandon' } },
    );
    expect(r.organizador).toBeUndefined();
  });
});
