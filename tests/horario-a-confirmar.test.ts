/**
 * «Horario a confirmar por el organizador» — B-2175.
 *
 * El pedido, de una publicadora que carga ferias de una cuenta que anuncia los
 * días y no los horarios, y no contesta: «un tilde que diga "horario a confirmar
 * por el organizador" y me deje seguir sin horario».
 *
 * El modelo guarda el día entero —00:00 a 23:59 de Buenos Aires— y **esas dos
 * horas son un relleno**. Lo que se puede romper sin que nada se ponga rojo es
 * que alguna salida las imprima como si fueran la hora del encuentro: «00:00» en
 * una tarjeta, un `startDate` a medianoche en el JSON-LD, un evento de Calendar
 * que le tapa el día entero a quien se suscribió. Este archivo recorre cada
 * salida que hoy imprime la hora y afirma que dice la frase y no el relleno.
 */
import { describe, expect, it } from 'vitest';
import {
  HORARIO_A_CONFIRMAR,
  HORARIO_A_CONFIRMAR_CORTO,
  construirEvento,
  diaEnZona,
  diaSiguiente,
  planificar,
} from '@calendario';
import { camposDivergentes } from '../scripts/verificar-calendario.mjs';
import { documentoAForm, formADocumento } from '@/lib/actividades';
import { icsDeEvento, linkDeGoogleCalendar } from '@/lib/agendarEncuentro';
import { panelesDeAhora } from '@/lib/ahoraPublico';
import { boletinSemanal } from '@/lib/boletinSemanal';
import { encuentrosDe } from '@/lib/calendarioPanel';
import { datosEstructurados, detalleDeActividad } from '@/lib/detallePublico';
import { construirIndice } from '@/lib/eventsJson';
import { estadoDe, mapaDeEtiquetas } from '@/lib/listadoPublico';
import { actividadFormSchema } from '@/lib/schema';
import {
  conHorarioAConfirmar,
  duplicarSesion,
  generarSesiones,
  sesionVacia,
} from '@/lib/sesiones';
import { bloqueDeFecha } from '@/lib/tarjetaPublica';
import { construirTextoRedes, type ActividadParaRedes } from '@/lib/textoRedes';
import { toPublic } from '@/lib/toPublic';
import type { Actividad, ActividadConId, Sesion } from '@/types/actividad';
import { formGuardable } from './fixtures/formulario';
import { actividadDePrueba } from './fixtures/indice';
import { ts } from './fixtures/tiempo';

/** Sábado 3 de octubre: 00:00 y 23:59 de Buenos Aires, en UTC. */
const MEDIANOCHE = '2026-10-03T03:00:00.000Z';
const CASI_MEDIANOCHE = '2026-10-04T02:59:00.000Z';
/** Ese sábado a las 10 de la mañana de Buenos Aires: la feria sigue en pie. */
const ESA_MANANA = new Date('2026-10-03T13:00:00Z');
/** El jueves anterior. */
const ANTES = new Date('2026-10-01T15:00:00Z');

const ETIQUETAS = mapaDeEtiquetas({
  tipo: [{ slug: 'encuentro', label: 'Encuentro' }],
  barrio: [{ slug: 'villa-crespo', label: 'Villa Crespo' }],
  ciudad: [{ slug: 'caba', label: 'CABA' }],
  provincia: [{ slug: 'caba', label: 'CABA' }],
  arancel: [{ slug: 'gratis', label: 'Gratis' }],
});

const sinHorario = (over: Partial<Sesion> = {}): Sesion => ({
  id: 'ses_feria',
  inicio: ts(MEDIANOCHE),
  fin: ts(CASI_MEDIANOCHE),
  tema: null,
  lectura: null,
  cancelada: false,
  calendarEventId: null,
  horarioAConfirmar: true,
  ...over,
});

/** Una feria publicada de un solo día, sin horario. */
const feria = (over: Partial<Actividad> = {}): Actividad => ({
  ...actividadDePrueba({ tipo: 'encuentro', slug: 'feria-del-barrio', titulo: 'Feria del barrio' }),
  estado: 'publicado',
  esCiclo: false,
  sesiones: [sinHorario()],
  ...over,
});

const indiceDe = (a: Actividad, generadoEn: string) =>
  construirIndice({
    actividades: [toPublic(a, 'act_feria')],
    opciones: {},
    version: 'test',
    generadoEn,
  });

describe('horario a confirmar por el organizador — B-2175', () => {
  describe('el formulario', () => {
    it('tildar la casilla conserva el día y pone el día entero', () => {
      const fila = { ...sesionVacia(new Date('2026-10-03T19:00:00')) };
      const tildada = conHorarioAConfirmar(fila, true);
      expect(tildada.horarioAConfirmar).toBe(true);
      expect(tildada.inicio).toBe('2026-10-03T00:00');
      expect(tildada.fin).toBe('2026-10-03T23:59');
    });

    it('destildarla deja el fin vacío: no se inventa una hora (B-957)', () => {
      const tildada = conHorarioAConfirmar(sesionVacia(new Date('2026-10-03T19:00:00')), true);
      const destildada = conHorarioAConfirmar(tildada, false);
      expect(destildada.horarioAConfirmar).toBe(false);
      expect(destildada.inicio).toBe('2026-10-03T00:00');
      expect(destildada.fin).toBe('');
    });

    it('el schema acepta el encuentro con solo el día, y rechaza el que no tiene día', () => {
      const conDia = formGuardable({
        titulo: 'Feria del barrio',
        slug: 'feria-del-barrio',
        sesiones: [conHorarioAConfirmar(sesionVacia(new Date('2026-10-03T19:00:00')), true)],
      });
      expect(actividadFormSchema.safeParse(conDia).success).toBe(true);

      const sinDia = formGuardable({
        titulo: 'Feria del barrio',
        slug: 'feria-del-barrio',
        sesiones: [conHorarioAConfirmar(sesionVacia(), true)],
      });
      const r = actividadFormSchema.safeParse(sinDia);
      expect(r.success).toBe(false);
      expect(r.error?.issues.map((i) => i.path.join('.'))).toContain('sesiones.0.inicio');
    });

    it('guardar escribe Timestamps del día entero aunque la fila traiga horas viejas (trampa 1)', () => {
      const fila = {
        ...sesionVacia(new Date('2026-10-03T19:00:00')),
        horarioAConfirmar: true,
      };
      const doc = formADocumento(formGuardable({ sesiones: [fila] }), 'uid_1', true) as unknown as Actividad;
      const s = doc.sesiones[0]!;
      expect(s.horarioAConfirmar).toBe(true);
      expect(typeof s.inicio.toDate).toBe('function');
      expect(s.inicio.toDate().getHours()).toBe(0);
      expect(s.fin.toDate().getHours()).toBe(23);
      expect(s.fin.toDate().getMinutes()).toBe(59);
    });

    it('ida y vuelta form ⇄ documento sin perder el flag ni el id de sesión', () => {
      const fila = conHorarioAConfirmar(sesionVacia(new Date('2026-10-03T19:00:00')), true);
      const doc = formADocumento(formGuardable({ sesiones: [fila] }), 'uid_1', true) as unknown as Actividad;
      const vuelta = documentoAForm(doc).sesiones[0]!;
      expect(vuelta.id).toBe(fila.id);
      expect(vuelta.horarioAConfirmar).toBe(true);
      expect(vuelta.inicio).toBe('2026-10-03T00:00');
      expect(vuelta.fin).toBe('2026-10-03T23:59');
    });

    it('un documento anterior al campo se lee con horario (D-26)', () => {
      const { horarioAConfirmar: _, ...vieja } = sinHorario();
      const doc = { ...feria(), sesiones: [{ ...vieja, inicio: ts('2026-10-03T22:00:00Z'), fin: ts('2026-10-04T00:00:00Z') }] };
      expect(documentoAForm(doc).sesiones[0]!.horarioAConfirmar).toBe(false);
      expect(toPublic(doc, 'x').sesiones[0]!.horarioAConfirmar).toBe(false);
    });

    it('duplicar la fila y generar N encuentros copian el flag del encuentro base', () => {
      const base = conHorarioAConfirmar(sesionVacia(new Date('2026-10-03T19:00:00')), true);
      const copia = duplicarSesion(base, 1);
      expect(copia.horarioAConfirmar).toBe(true);
      expect(copia.inicio).toBe('2026-10-04T00:00');
      expect(copia.fin).toBe('2026-10-04T23:59');

      const generadas = generarSesiones({
        cantidad: 3,
        inicio: base.inicio,
        duracionMinutos: 23 * 60 + 59,
        cadaDias: 1,
        previas: [base],
        horarioAConfirmar: true,
      });
      expect(generadas.map((s) => s.horarioAConfirmar)).toEqual([true, true, true]);
      expect(generadas.map((s) => s.fin)).toEqual([
        '2026-10-03T23:59',
        '2026-10-04T23:59',
        '2026-10-05T23:59',
      ]);
      // El id del encuentro que ya existía se hereda (B-90, trampa 2).
      expect(generadas[0]!.id).toBe(base.id);
    });
  });

  describe('el evento de Calendar (§7.4)', () => {
    it('es de día completo, con el fin exclusivo, y dice la frase arriba de la descripción', () => {
      const evento = construirEvento(feria(), sinHorario());
      expect(evento.start).toEqual({ date: '2026-10-03' });
      expect(evento.end).toEqual({ date: '2026-10-04' });
      expect(evento.description.startsWith(`${HORARIO_A_CONFIRMAR}.`)).toBe(true);
    });

    it('con horario sigue siendo `dateTime` con `timeZone` explícito (trampa 1)', () => {
      const conHora = sinHorario({ horarioAConfirmar: false });
      expect(construirEvento(feria(), conHora).start).toEqual({
        dateTime: MEDIANOCHE,
        timeZone: 'America/Argentina/Buenos_Aires',
      });
    });

    it('tildar o destildar la casilla en un encuentro de la feria actualiza ese evento y ningún otro (§7.1, §7.2)', () => {
      // Una feria de tres jornadas es un ciclo (§2.2): tres sesiones, tres eventos.
      const DIA_MS = 86_400_000;
      const jornada = (i: number, aConfirmar: boolean): Sesion =>
        sinHorario({
          id: `ses_jornada_${i}`,
          inicio: ts(new Date(Date.parse(MEDIANOCHE) + i * DIA_MS).toISOString()),
          fin: ts(new Date(Date.parse(CASI_MEDIANOCHE) + i * DIA_MS).toISOString()),
          calendarEventId: `ev_${i}`,
          horarioAConfirmar: aConfirmar,
        });
      const tresJornadas = (segunda: boolean) =>
        feria({ esCiclo: true, sesiones: [jornada(0, true), jornada(1, segunda), jornada(2, true)] });

      const antes = tresJornadas(false);
      const despues = tresJornadas(true);
      expect(planificar(antes, despues).map((o) => [o.tipo, o.id])).toEqual([
        ['actualizar', 'ses_jornada_1'],
      ]);
      expect(planificar(despues, antes).map((o) => [o.tipo, o.id])).toEqual([
        ['actualizar', 'ses_jornada_1'],
      ]);
      // Reescribir el mismo documento —la escritura del `calendarEventId` de
      // vuelta— no genera operaciones (trampa 3).
      expect(planificar(despues, tresJornadas(true))).toEqual([]);
    });

    it('`verificar-calendario` da por al día un evento de día completo igual, y ve el que cambió', () => {
      const esperado = construirEvento(feria(), sinHorario());
      expect(camposDivergentes(esperado, { ...esperado, start: { date: '2026-10-03' } })).toEqual([]);
      expect(camposDivergentes(esperado, { ...esperado, start: { date: '2026-10-04' } })).toEqual(['start']);
      // El evento viejo, con hora, no está al día con el de día completo.
      const conHora = construirEvento(feria(), sinHorario({ horarioAConfirmar: false }));
      expect(camposDivergentes(esperado, conHora)).toEqual(['description', 'start', 'end']);
    });

    it('el día sale en la zona del proyecto y no en UTC', () => {
      // 00:00 de Buenos Aires es las 03:00 UTC del mismo día, pero 23:59 es el día siguiente en UTC.
      expect(diaEnZona(ts(CASI_MEDIANOCHE))).toBe('2026-10-03');
      expect(diaSiguiente('2026-12-31')).toBe('2027-01-01');
    });
  });

  describe('el sitio', () => {
    it('el índice lo lleva solo cuando es `true`, y mide por el fin', () => {
      const indice = indiceDe(feria(), ESA_MANANA.toISOString());
      expect(indice.actividades[0]!.sesiones[0]).toMatchObject({ horarioAConfirmar: true });
      // A las diez de la mañana del mismo día la feria sigue en el eje de encuentros.
      expect(indice.encuentros).toHaveLength(1);
      expect(indice.encuentros[0]).toMatchObject({ horarioAConfirmar: true });

      const conHora = indiceDe(feria({ sesiones: [sinHorario({ horarioAConfirmar: false })] }), ANTES.toISOString());
      expect('horarioAConfirmar' in conHora.actividades[0]!.sesiones[0]!).toBe(false);
    });

    it('la tarjeta dice «Horario a confirmar» y no «00:00»', () => {
      const entrada = indiceDe(feria(), ANTES.toISOString()).actividades[0]!;
      const bloque = bloqueDeFecha(estadoDe(entrada, ANTES));
      expect(bloque.paso).toBe(false);
      if (!bloque.paso) expect(bloque.hora).toBe(HORARIO_A_CONFIRMAR_CORTO);
    });

    it('la página dice la frase entera, sin hora de fin', () => {
      const d = detalleDeActividad(toPublic(feria(), 'act_feria'), ETIQUETAS, ANTES, {});
      expect(d.encuentros[0]!.hora).toBe(HORARIO_A_CONFIRMAR);
      expect(d.proxima).toMatchObject({ desde: HORARIO_A_CONFIRMAR, hasta: '' });
    });

    it('el JSON-LD lleva solo la fecha: ni las 00:00 ni las 23:59', () => {
      const d = detalleDeActividad(toPublic(feria(), 'act_feria'), ETIQUETAS, ANTES, {});
      const ld = datosEstructurados(d);
      expect(ld).toMatchObject({ startDate: '2026-10-03', endDate: '2026-10-03' });
      expect(JSON.stringify(ld)).not.toMatch(/T03:00|T02:59|00:00:00/);
    });

    it('agendarlo es un evento de día completo, en el .ics y en Google', () => {
      const d = detalleDeActividad(toPublic(feria(), 'act_feria'), ETIQUETAS, ANTES, {});
      const evento = d.encuentros[0]!.agendar!.evento;
      const ics = icsDeEvento(evento);
      expect(ics).toContain('DTSTART;VALUE=DATE:20261003');
      expect(ics).toContain('DTEND;VALUE=DATE:20261004');
      expect(linkDeGoogleCalendar(evento)).toContain(`dates=${encodeURIComponent('20261003/20261004')}`);
    });

    it('el tríptico y el correo la siguen mostrando la mañana del mismo día, sin hora', () => {
      const indice = indiceDe(feria(), ANTES.toISOString());
      const ahora = panelesDeAhora(indice, ESA_MANANA, ETIQUETAS);
      const hoy = ahora?.paneles.find((p) => p.clave === 'hoy');
      expect(hoy?.encuentros[0]?.hora).toBe(HORARIO_A_CONFIRMAR_CORTO);

      const correo = boletinSemanal(indice, ESA_MANANA, ETIQUETAS);
      const fila = correo?.dias.flatMap((dd) => dd.encuentros)[0] ?? correo?.destacadas[0];
      expect(fila?.hora).toBe(HORARIO_A_CONFIRMAR_CORTO);
    });
  });

  describe('el panel y el texto para redes', () => {
    it('el calendario del panel no pone «00:00» en la columna de la hora', () => {
      const [e] = encuentrosDe([{ ...feria(), id: 'act_feria' } as ActividadConId]);
      expect(e!.horarioAConfirmar).toBe(true);
      expect(e!.hora).not.toBe('00:00');
    });

    it('el posteo dice la frase en «Cuándo» y no inventa una hora', () => {
      const r = construirTextoRedes(feria() as unknown as ActividadParaRedes, 'anuncio', ANTES);
      if (!r.ok) throw new Error(r.motivo);
      expect(r.texto.toLowerCase()).toContain(HORARIO_A_CONFIRMAR.toLowerCase());
      expect(r.texto).not.toContain('00:00');
    });
  });
});
