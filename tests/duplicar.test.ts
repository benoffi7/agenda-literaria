import { describe, expect, it } from 'vitest';
import {
  diasDeDesplazamiento,
  duplicarActividadForm,
  duplicarSesionParaCopia,
  slugCopia,
  tituloCopia,
} from '@/lib/duplicar';
import { actividadFormSchema } from '@/lib/schema';
import { deDatetimeLocal } from '@/lib/sesiones';
import type { ActividadForm, SesionForm } from '@/types/actividad';

const sesion = (over: Partial<SesionForm> = {}): SesionForm => ({
  id: 'ses_original',
  inicio: '2025-09-02T19:00',
  fin: '2025-09-02T21:00',
  tema: 'Cap. 1-4',
  lectura: 'Los siete locos',
  cancelada: false,
  calendarEventId: 'evento_del_original',
  ...over,
});

/** Ciclo de tres martes de 2025, con un salto de dos semanas en el medio. */
const original = (over: Partial<ActividadForm> = {}): ActividadForm => ({
  tipo: 'club-lectura',
  titulo: 'Club de lectura latinoamericana',
  slug: 'club-latinoamericana',
  descripcion: 'Ocho encuentros por narrativa del boom y después.',
  imagenUrl: '',
  organizador: { nombre: 'Casa Brandon', instagram: '@casabrandon', web: '' },
  tallerista: { nombre: 'María Moreno', bio: 'Cronista', instagram: '@mmoreno' },
  esCiclo: true,
  sesiones: [
    sesion({ id: 'ses_a', inicio: '2025-09-02T19:00', fin: '2025-09-02T21:00' }),
    sesion({ id: 'ses_b', inicio: '2025-09-09T19:00', fin: '2025-09-09T21:00' }),
    // Se saltea una semana (feriado) — el hueco irregular tiene que sobrevivir.
    sesion({ id: 'ses_c', inicio: '2025-09-23T19:00', fin: '2025-09-23T21:30' }),
  ],
  modalidad: 'hibrido',
  sede: {
    nombre: 'Casa Brandon',
    direccion: 'Drago 236',
    barrio: 'villa-crespo',
    ciudad: 'CABA',
    indicaciones: 'Timbre 2',
    geo: null,
  },
  online: { plataforma: 'zoom', url: 'https://zoom.us/j/secreto', urlPublica: false },
  inscripcion: {
    requiere: true,
    via: 'mail',
    destino: 'hola@casabrandon.org',
    cupo: 12,
    cierra: '2025-08-30T00:00',
  },
  arancel: { tipo: 'a-la-gorra', notas: 'incluye material' },
  material: {
    tiene: true,
    items: [
      {
        tipo: 'guia',
        titulo: 'Guía de lectura',
        url: 'https://drive/privado',
        entrega: 'al-inscribirse',
        publico: false,
      },
    ],
  },
  difusion: { arrobar: ['@editorial'], notas: 'coordinar con prensa' },
  estado: 'publicado',
  tags: ['narrativa'],
  destacado: true,
  ...over,
});

const AHORA = new Date('2026-08-21T12:00');

describe('duplicar una actividad — lo que NO se puede heredar (B-11)', () => {
  it('le da a cada sesión un id nuevo: dos actividades con los mismos ids rompen el diff (§7.2, trampa 2)', () => {
    const o = original();
    const copia = duplicarActividadForm(o, { ahora: AHORA });

    const idsOriginales = o.sesiones.map((s) => s.id);
    const idsCopia = copia.sesiones.map((s) => s.id);

    expect(idsCopia).toHaveLength(3);
    expect(idsCopia.every((id) => !idsOriginales.includes(id))).toBe(true);
    // Únicos entre sí, y con el prefijo que exige el schema.
    expect(new Set(idsCopia).size).toBe(3);
    expect(idsCopia.every((id) => id.startsWith('ses_'))).toBe(true);
    // Y el original queda intacto.
    expect(o.sesiones.map((s) => s.id)).toEqual(idsOriginales);
  });

  it('pone calendarEventId en null en todas las sesiones: los eventos son del original (§7.2)', () => {
    const copia = duplicarActividadForm(original(), { ahora: AHORA });
    expect(copia.sesiones.map((s) => s.calendarEventId)).toEqual([null, null, null]);
    expect(JSON.stringify(copia)).not.toContain('evento_del_original');
  });

  it('arranca en borrador aunque el original esté publicado: no manda nada al calendario (§7.3)', () => {
    for (const estado of ['publicado', 'pendiente', 'cancelado'] as const) {
      const copia = duplicarActividadForm(original({ estado }), { ahora: AHORA });
      expect(copia.estado).toBe('borrador');
    }
  });

  it('propone un slug distinto del original', () => {
    const o = original();
    const copia = duplicarActividadForm(o, { ahora: AHORA });
    expect(copia.slug).not.toBe(o.slug);
    expect(copia.slug).toBe('club-latinoamericana-copia');
  });

  it('esquiva los slugs ya tomados', () => {
    const copia = duplicarActividadForm(original(), {
      ahora: AHORA,
      tomados: ['club-latinoamericana', 'club-latinoamericana-copia', 'club-latinoamericana-copia-2'],
    });
    expect(copia.slug).toBe('club-latinoamericana-copia-3');
  });

  it('duplicar la copia no encadena sufijos', () => {
    expect(slugCopia('club-copia', ['club-copia'])).toBe('club-copia-2');
    expect(slugCopia('club-copia-3', [])).toBe('club-copia');
    expect(tituloCopia('Club (copia)')).toBe('Club (copia)');
    expect(tituloCopia('Club')).toBe('Club (copia)');
  });

  it('marca el título como copia: dos filas con el mismo título son indistinguibles en el listado', () => {
    const copia = duplicarActividadForm(original(), { ahora: AHORA });
    expect(copia.titulo).toBe('Club de lectura latinoamericana (copia)');
  });
});

describe('duplicar una actividad — las fechas', () => {
  it('corre el ciclo entero en semanas enteras: mismo día de semana y misma hora', () => {
    const copia = duplicarActividadForm(original(), { ahora: AHORA });

    for (const [i, s] of copia.sesiones.entries()) {
      const antes = deDatetimeLocal(original().sesiones[i]!.inicio)!;
      const despues = deDatetimeLocal(s.inicio)!;
      expect(despues.getDay()).toBe(antes.getDay());
      expect(despues.getHours()).toBe(antes.getHours());
      expect(despues.getMinutes()).toBe(antes.getMinutes());
    }
  });

  it('conserva los huecos irregulares y las duraciones (§2.2 — un feriado que se saltea)', () => {
    const copia = duplicarActividadForm(original(), { ahora: AHORA });
    const ms = (s: string) => deDatetimeLocal(s)!.getTime();

    // Original: +7 días entre la 1ª y la 2ª, +14 entre la 2ª y la 3ª.
    expect(ms(copia.sesiones[1]!.inicio) - ms(copia.sesiones[0]!.inicio)).toBe(7 * 86_400_000);
    expect(ms(copia.sesiones[2]!.inicio) - ms(copia.sesiones[1]!.inicio)).toBe(14 * 86_400_000);
    // La tercera duraba media hora más.
    expect(ms(copia.sesiones[2]!.fin) - ms(copia.sesiones[2]!.inicio)).toBe(2.5 * 3_600_000);
  });

  it('un ciclo del año pasado arranca en el futuro: publicar la copia no crea eventos vencidos', () => {
    const copia = duplicarActividadForm(original(), { ahora: AHORA });
    const primera = deDatetimeLocal(copia.sesiones[0]!.inicio)!;
    expect(primera.getTime()).toBeGreaterThan(AHORA.getTime());
    // El primer martes de septiembre de 2025 corrido a semanas enteras cae en
    // el primer martes futuro respecto de "ahora".
    expect(copia.sesiones[0]!.inicio).toBe('2026-08-25T19:00');
  });

  it('un ciclo que todavía no terminó arranca después del último encuentro del original', () => {
    const enCurso = original({
      sesiones: [
        sesion({ id: 'ses_1', inicio: '2026-08-25T19:00', fin: '2026-08-25T21:00' }),
        sesion({ id: 'ses_2', inicio: '2026-09-01T19:00', fin: '2026-09-01T21:00' }),
      ],
    });
    const copia = duplicarActividadForm(enCurso, { ahora: AHORA });
    expect(copia.sesiones[0]!.inicio).toBe('2026-09-08T19:00');
    expect(copia.sesiones[1]!.inicio).toBe('2026-09-15T19:00');
  });

  it('nunca se queda sentada sobre las fechas del original: mínimo una semana', () => {
    const unaSola = original({
      esCiclo: false,
      sesiones: [sesion({ id: 'ses_x', inicio: '2027-01-05T19:00', fin: '2027-01-05T21:00' })],
    });
    const copia = duplicarActividadForm(unaSola, { ahora: AHORA });
    expect(copia.sesiones[0]!.inicio).toBe('2027-01-12T19:00');
    expect(diasDeDesplazamiento(unaSola.sesiones, AHORA)).toBe(7);
  });

  it('corre también el cierre de inscripción: si no, la copia sale con la inscripción cerrada', () => {
    const o = original();
    const copia = duplicarActividadForm(o, { ahora: AHORA });
    const dias = diasDeDesplazamiento(o.sesiones, AHORA);

    const cierreOriginal = deDatetimeLocal(o.inscripcion.cierra)!;
    const cierreCopia = deDatetimeLocal(copia.inscripcion.cierra)!;
    expect(Math.round((cierreCopia.getTime() - cierreOriginal.getTime()) / 86_400_000)).toBe(dias);
    // Y sigue cayendo antes del primer encuentro.
    expect(copia.inscripcion.cierra < copia.sesiones[0]!.inicio).toBe(true);
  });

  it('sin cierre de inscripción no se inventa uno', () => {
    const copia = duplicarActividadForm(
      original({ inscripcion: { ...original().inscripcion, cierra: '' } }),
      { ahora: AHORA },
    );
    expect(copia.inscripcion.cierra).toBe('');
  });

  it('una fecha inválida se deja como está para que la marque la validación', () => {
    const roto = original({
      esCiclo: false,
      sesiones: [sesion({ id: 'ses_roto', inicio: '', fin: '' })],
    });
    const copia = duplicarActividadForm(roto, { ahora: AHORA });
    expect(copia.sesiones[0]!.inicio).toBe('');
    expect(diasDeDesplazamiento(roto.sesiones, AHORA)).toBe(0);
  });
});

describe('duplicar una actividad — el resto del contenido', () => {
  it('conserva los 30+ campos que son el motivo de duplicar (§11)', () => {
    const o = original();
    const copia = duplicarActividadForm(o, { ahora: AHORA });

    expect(copia.tipo).toBe(o.tipo);
    expect(copia.descripcion).toBe(o.descripcion);
    expect(copia.modalidad).toBe(o.modalidad);
    expect(copia.sede).toEqual(o.sede);
    expect(copia.online).toEqual(o.online);
    expect(copia.arancel).toEqual(o.arancel);
    expect(copia.material).toEqual(o.material);
    expect(copia.difusion).toEqual(o.difusion);
    expect(copia.organizador).toEqual(o.organizador);
    expect(copia.tallerista).toEqual(o.tallerista);
    expect(copia.tags).toEqual(o.tags);
    expect(copia.esCiclo).toBe(true);
    expect(copia.inscripcion.requiere).toBe(true);
    expect(copia.inscripcion.cupo).toBe(12);
    // El tema y la lectura de cada encuentro son la mitad del trabajo de carga.
    expect(copia.sesiones.map((s) => s.tema)).toEqual(o.sesiones.map((s) => s.tema));
    expect(copia.sesiones.map((s) => s.lectura)).toEqual(o.sesiones.map((s) => s.lectura));
  });

  it('no comparte referencias con el original: editar la copia no lo toca', () => {
    const o = original();
    const copia = duplicarActividadForm(o, { ahora: AHORA });

    expect(copia.sede).not.toBe(o.sede);
    expect(copia.online).not.toBe(o.online);
    expect(copia.material.items[0]).not.toBe(o.material.items[0]);
    expect(copia.difusion.arrobar).not.toBe(o.difusion.arrobar);
    expect(copia.tags).not.toBe(o.tags);
    expect(copia.organizador).not.toBe(o.organizador);
  });

  it('descancela los encuentros: una cancelación es una excepción del ciclo original', () => {
    const conCancelado = original({
      sesiones: [
        sesion({ id: 'ses_1' }),
        sesion({ id: 'ses_2', inicio: '2025-09-09T19:00', fin: '2025-09-09T21:00', cancelada: true }),
      ],
    });
    const copia = duplicarActividadForm(conCancelado, { ahora: AHORA });
    expect(copia.sesiones).toHaveLength(2);
    expect(copia.sesiones.every((s) => !s.cancelada)).toBe(true);
  });

  it('la copia pasa la validación del formulario sin tocar nada más', () => {
    const copia = duplicarActividadForm(original(), { ahora: AHORA });
    const parsed = actividadFormSchema.safeParse(copia);
    expect(parsed.success).toBe(true);
  });

  it('duplicarSesionParaCopia sola también limpia id, evento y cancelación', () => {
    const s = sesion({ cancelada: true });
    const copia = duplicarSesionParaCopia(s, 7);
    expect(copia.id).not.toBe(s.id);
    expect(copia.calendarEventId).toBeNull();
    expect(copia.cancelada).toBe(false);
    expect(copia.inicio).toBe('2025-09-09T19:00');
  });
});
