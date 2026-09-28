import { describe, expect, it } from 'vitest';
import {
  fechaCompacta,
  icsDeEvento,
  linkDeGoogleCalendar,
  linkParaCompartirPorWhatsApp,
  type EventoParaAgendar,
} from '@/lib/agendarEncuentro';
import { detalleDeActividad } from '@/lib/detallePublico';
import { mapaDeEtiquetas } from '@/lib/listadoPublico';
import { DOMINIO, rutaDeDetalle, rutaDelIcs, urlDeDetalle } from '@/lib/rutasPublicas';
import { toPublic } from '@/lib/toPublic';
import { tituloDeEvento } from '@calendario';
import type { Actividad } from '@/types/actividad';
import { actividadDePrueba, type OpcionesDeEntrada } from './fixtures/indice';

/**
 * «Agendar este encuentro» y «Compartir» — roadmap 1.1. Es una salida pública
 * nueva (el `.ics` y dos links), así que lo que se fija acá es sobre todo **qué
 * no lleva**: el link de la reunión, la descripción, un encuentro que no va a pasar.
 */

const evento = (over: Partial<EventoParaAgendar> = {}): EventoParaAgendar => ({
  uid: 'ses_1@agendaleh.ar',
  titulo: 'Club de lectura — Cap. 1-4',
  inicioIso: '2026-10-12T22:00:00.000Z',
  finIso: '2026-10-13T00:00:00.000Z',
  ubicacion: 'Casa Brandon, Luis María Drago 236, Villa Crespo',
  url: 'https://agendaleh.ar/actividad/club/',
  generadoIso: '2026-09-28T12:00:00.000Z',
  ...over,
});

describe('las dos formas del evento', () => {
  it('las fechas van en UTC, que es el instante exacto sin importar la zona (trampa 1)', () => {
    expect(fechaCompacta('2026-10-12T19:00:00-03:00')).toBe('20261012T220000Z');
  });

  it('el link de Google lleva título, fechas, lugar y la página, y nada más', () => {
    const u = new URL(linkDeGoogleCalendar(evento()));
    expect(u.origin + u.pathname).toBe('https://calendar.google.com/calendar/render');
    expect(u.searchParams.get('action')).toBe('TEMPLATE');
    expect(u.searchParams.get('text')).toBe('Club de lectura — Cap. 1-4');
    expect(u.searchParams.get('dates')).toBe('20261012T220000Z/20261013T000000Z');
    expect(u.searchParams.get('location')).toContain('Casa Brandon');
    expect(u.searchParams.get('details')).toBe('Más información e inscripción: https://agendaleh.ar/actividad/club/');
    expect([...u.searchParams.keys()].sort()).toEqual(['action', 'ctz', 'dates', 'details', 'location', 'text']);
  });

  it('el .ics es un calendario válido de un solo evento, con CRLF', () => {
    const ics = icsDeEvento(evento());
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(ics).toContain('UID:ses_1@agendaleh.ar');
    expect(ics).toContain('DTSTART:20261012T220000Z');
    expect(ics).toContain('DTSTAMP:20260928T120000Z');
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/\n/);
  });

  it('escapa comas, punto y coma y barras como pide el RFC', () => {
    const ics = icsDeEvento(evento({ ubicacion: 'Sede; Av. 1, CABA \\ piso' }));
    expect(ics).toContain('LOCATION:Sede\\; Av. 1\\, CABA \\\\ piso');
  });

  it('pliega las líneas largas a 75 bytes sin partir un carácter con tilde', () => {
    const ics = icsDeEvento(evento({ titulo: 'Taller de escritura: ' + 'ñandú acción '.repeat(10) }));
    for (const linea of ics.split('\r\n')) expect(new TextEncoder().encode(linea).length).toBeLessThanOrEqual(75);
    // Desplegado, dice lo mismo que se escribió.
    expect(ics.replace(/\r\n /g, '')).toContain('ñandú acción ñandú acción');
  });

  it('compartir por WhatsApp lleva el título y la dirección, sin número de nadie', () => {
    const u = new URL(linkParaCompartirPorWhatsApp('Club & amigos', 'https://agendaleh.ar/actividad/x/'));
    expect(u.origin + u.pathname).toBe('https://wa.me/');
    expect(u.searchParams.get('text')).toBe('Club & amigos https://agendaleh.ar/actividad/x/');
  });
});

describe('qué encuentros se pueden agendar, en la página', () => {
  const ETIQUETAS = mapaDeEtiquetas({});
  const AHORA = new Date('2026-10-01T12:00:00Z');
  const detalle = (o: OpcionesDeEntrada, over: Partial<Actividad> = {}, cancelada = false) =>
    detalleDeActividad(toPublic({ ...actividadDePrueba(o), ...over }, 'act_1'), ETIQUETAS, AHORA, {}, cancelada);

  it('los que pueden pasar sí; el que ya pasó y el cancelado no', () => {
    const d = detalle({ fechas: ['2026-09-20T22:00:00Z', '2026-10-10T22:00:00Z', '2026-10-17T22:00:00Z'], canceladas: [2] });
    expect(d.encuentros.map((e) => Boolean(e.agendar))).toEqual([false, true, false]);
    expect(d.agendarProximo?.evento.uid).toBe(`${d.encuentros[1]!.id}@${DOMINIO}`);
  });

  it('una actividad cancelada entera no se agenda, aunque sus encuentros no estén marcados', () => {
    const d = detalle({ fechas: ['2026-10-10T22:00:00Z'] }, {}, true);
    expect(d.encuentros.every((e) => e.agendar === null)).toBe(true);
    expect(d.agendarProximo).toBeNull();
  });

  it('el título es el del evento del calendario público, y el .ics vive al lado de la página', () => {
    const d = detalle({ slug: 'club', titulo: 'Club X', fechas: ['2026-10-10T22:00:00Z'] });
    const e = d.encuentros[0]!;
    expect(e.agendar!.evento.titulo).toBe(tituloDeEvento('Club X', null, e.tema));
    expect(e.agendar!.ics).toBe(rutaDelIcs('club', e.id));
    expect(rutaDelIcs('club', e.id)).toBe(`${rutaDeDetalle('club')}${e.id}.ics`);
    // El DTSTAMP es el reloj del build, no el momento en que corre el endpoint.
    expect(e.agendar!.evento.generadoIso).toBe(AHORA.toISOString());
    expect(e.agendar!.evento.url).toBe(urlDeDetalle('club'));
  });

  it('tampoco con la reunión publicable (`urlPublica: true`): el evento no lee `online` (trampa 5)', () => {
    const d = detalle(
      { modalidades: ['virtual'], fechas: ['2026-10-10T22:00:00Z'] },
      { online: { plataforma: 'zoom', url: 'https://zoom.us/j/CENTINELA_PUBLICABLE', urlPublica: true } } as Partial<Actividad>,
    );
    expect(icsDeEvento(d.agendarProximo!.evento)).not.toContain('CENTINELA_PUBLICABLE');
    expect(d.agendarProximo!.google).not.toContain('CENTINELA_PUBLICABLE');
  });

  it('nunca lleva el link de la reunión ni la descripción (trampa 5)', () => {
    const d = detalle(
      { descripcion: 'CENTINELA_DESCRIPCION entrá por https://zoom.us/j/CENTINELA_REUNION', modalidades: ['virtual'], fechas: ['2026-10-10T22:00:00Z'] },
      { online: { plataforma: 'zoom', url: 'https://zoom.us/j/CENTINELA_REUNION', urlPublica: false } } as Partial<Actividad>,
    );
    const agendar = JSON.stringify([d.encuentros.map((e) => e.agendar), d.agendarProximo]);
    const ics = icsDeEvento(d.agendarProximo!.evento);
    for (const salida of [agendar, ics, d.compartirPorWhatsApp]) {
      expect(salida).not.toContain('CENTINELA_REUNION');
      expect(salida).not.toContain('CENTINELA_DESCRIPCION');
    }
  });
});
