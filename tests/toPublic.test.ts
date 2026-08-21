import { describe, expect, it } from 'vitest';
import { toPublic } from '@/lib/toPublic';
import type { Actividad } from '@/types/actividad';

/** Timestamp mínimo, suficiente para la proyección. */
const ts = (iso: string) => {
  const d = new Date(iso);
  return {
    toDate: () => d,
    toMillis: () => d.getTime(),
    seconds: Math.floor(d.getTime() / 1000),
    nanoseconds: 0,
  };
};

const actividad = (over: Partial<Actividad> = {}): Actividad => ({
  tipo: 'club-lectura',
  titulo: 'Club de lectura latinoamericana',
  slug: 'club-latinoamericana',
  descripcion: 'Ocho encuentros',
  imagenUrl: null,
  organizador: { nombre: 'Brandon', instagram: '@brandon', web: '' },
  tallerista: null,
  esCiclo: true,
  sesiones: [
    {
      id: 'ses_1',
      inicio: ts('2026-09-03T22:00:00Z'),
      fin: ts('2026-09-04T00:00:00Z'),
      tema: 'Cap. 1-4',
      lectura: 'Pedro Páramo',
      cancelada: false,
      // Interno: no debería salir al JSON público.
      calendarEventId: 'evt_secreto',
    },
  ],
  modalidad: 'virtual',
  sede: null,
  online: { plataforma: 'zoom', url: 'https://zoom.us/j/999', urlPublica: false },
  inscripcion: {
    requiere: true,
    via: 'mail',
    destino: 'hola@ejemplo.com',
    cupo: 12,
    cierra: ts('2026-09-01T00:00:00Z'),
  },
  arancel: { tipo: 'a-la-gorra', notas: '' },
  material: {
    tiene: true,
    items: [
      { tipo: 'lectura', titulo: 'Pedro Páramo', url: 'https://drive/publico', entrega: 'previo', publico: true },
      { tipo: 'guia', titulo: 'Guía de lectura', url: 'https://drive/privado', entrega: 'al-inscribirse', publico: false },
    ],
  },
  difusion: { arrobar: ['@editorial'], notas: 'coordinar con prensa' },
  estado: 'publicado',
  tags: ['narrativa'],
  destacado: false,
  searchText: 'club de lectura latinoamericana',
  createdAt: ts('2026-08-01T00:00:00Z'),
  updatedAt: ts('2026-08-02T00:00:00Z'),
  createdBy: 'uid_abc',
  updatedBy: 'uid_abc',
  ...over,
});

describe('toPublic — §5, trampa 5', () => {
  it('no filtra el link de la reunión, solo la plataforma', () => {
    const p = toPublic(actividad(), 'id1');
    expect(p.online).toEqual({ plataforma: 'zoom' });
    expect(JSON.stringify(p)).not.toContain('zoom.us/j/999');
  });

  it('no incluye difusion', () => {
    const p = toPublic(actividad(), 'id1');
    expect('difusion' in p).toBe(false);
    expect(JSON.stringify(p)).not.toContain('coordinar con prensa');
  });

  it('no incluye createdBy ni updatedBy', () => {
    const json = JSON.stringify(toPublic(actividad(), 'id1'));
    expect(json).not.toContain('uid_abc');
  });

  it('un material privado conserva título y tipo pero pierde la URL', () => {
    const p = toPublic(actividad(), 'id1');
    const [publico, privado] = p.material.items;
    expect(publico!.url).toBe('https://drive/publico');
    expect(privado!.titulo).toBe('Guía de lectura');
    expect(privado!.url).toBeUndefined();
    expect(JSON.stringify(p)).not.toContain('drive/privado');
  });

  it('no expone el calendarEventId de las sesiones', () => {
    const p = toPublic(actividad(), 'id1');
    expect(JSON.stringify(p)).not.toContain('evt_secreto');
    expect(p.sesiones[0]!.tema).toBe('Cap. 1-4');
  });
});

describe('toPublic — inscripción', () => {
  it('marca la inscripción cerrada cuando ya pasó la fecha', () => {
    const p = toPublic(actividad(), 'id1', new Date('2026-09-02T00:00:00Z').getTime());
    expect(p.inscripcion.abierta).toBe(false);
  });

  it('la marca abierta antes de la fecha de cierre', () => {
    const p = toPublic(actividad(), 'id1', new Date('2026-08-15T00:00:00Z').getTime());
    expect(p.inscripcion.abierta).toBe(true);
  });

  it('sin fecha de cierre queda abierta', () => {
    const a = actividad();
    a.inscripcion.cierra = null;
    expect(toPublic(a, 'id1').inscripcion.abierta).toBe(true);
  });
});

describe('toPublic — fechas', () => {
  it('serializa los Timestamp a ISO, sin corrimiento', () => {
    const p = toPublic(actividad(), 'id1');
    expect(p.sesiones[0]!.inicio).toBe('2026-09-03T22:00:00.000Z');
    expect(p.sesiones[0]!.fin).toBe('2026-09-04T00:00:00.000Z');
  });
});
