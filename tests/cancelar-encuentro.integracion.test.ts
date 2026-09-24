/**
 * B-98 — cancelar un encuentro, de punta a punta contra el emulador: el panel
 * guarda, Firestore devuelve el documento con sus `Timestamp` de verdad, y el
 * diff del §7.2 decide qué le pasa al evento.
 *
 * ── Qué verifica esto que los tests puros no ─────────────────────────────
 * `calendario.test.ts` arma los documentos a mano. Acá el `antes` y el
 * `despues` son **los que lee la Function**: escritos por `actualizarActividad`
 * (que relee el documento y conserva el `calendarEventId` de cada sesión por id,
 * B-150), serializados por Firestore y leídos con el Admin SDK, que es lo que
 * `syncCalendar` recibe en `event.data.before/after`. Si la conversión perdiera
 * el id del evento, o el motivo, o convirtiera las fechas en strings, el diff
 * de acá emitiría un `crear` o un `borrar` en vez del `actualizar`.
 *
 * ── Por qué no corre el trigger de verdad ────────────────────────────────
 * Sin `GOOGLE_CALENDAR_ID` la Function sale antes de tocar Calendar (§10: un
 * bug del diff contra el calendario real crea o borra eventos de verdad), así
 * que ejecutarla en el emulador no dice nada del evento. Se corre lo mismo que
 * ella corre —`planificar` sobre before/after y `reponerIds` para el
 * write-back— sobre los documentos del emulador, que es la parte que importa.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { initializeApp as initAdmin, deleteApp as deleteAdminApp } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { construirEvento, planificar } from '@calendario';
import { reponerIds } from '../functions/sincronizacion.js';
import { actualizarActividad, crearActividad } from '@/lib/actividades';
import { sesionVacia } from '@/lib/sesiones';
import type { ActividadForm } from '@/types/actividad';
import { entrarComo, uidDe } from './fixtures/credenciales-del-emulador';
import { formDeCiclo } from './fixtures/formulario-de-ciclo';
import {
  PROJECT_ID,
  cargarReglas,
  emuladorAuthVivo,
  emuladorVivo,
  limpiarFirestore,
  sembrarCentinelaDeSlugs,
} from './emulador';

// B-365 — los dos: este archivo hace login.
const vivo = (await emuladorVivo()) && (await emuladorAuthVivo());

const UID = uidDe('uid_b98_admin');
const REGLAS = fileURLToPath(new URL('../firestore.rules', import.meta.url));

type Op = {
  tipo: 'crear' | 'actualizar' | 'borrar';
  id: string;
  eventId?: string;
  evento?: { summary: string; description: string; start: unknown; end: unknown };
};

/** Cliente Admin: lee como la Function, sin pasar por las reglas. */
const admin = initAdmin({ projectId: PROJECT_ID }, `b98-${Date.now()}`);
const adminDb = getAdminFirestore(admin);

/** El documento tal como lo recibe `syncCalendar` en `event.data.*.data()`. */
const comoLaFunction = async (id: string) => {
  const snap = await adminDb.doc(`actividades/${id}`).get();
  return snap.data() as Record<string, unknown> & {
    titulo: string;
    sesiones: { id: string; calendarEventId: string | null; cancelada: boolean }[];
  };
};

/**
 * El write-back de `syncCalendar`: dado lo que se aplicó en Calendar, escribe
 * los `calendarEventId` en el documento con la misma `reponerIds`. Los `crear`
 * reciben un id de mentira, como si Calendar lo hubiera devuelto.
 */
const aplicarEnCalendario = async (id: string, ops: Op[]) => {
  const ids = new Map<string, string | null>();
  for (const op of ops) {
    if (op.tipo === 'crear') ids.set(op.id, `evt_${op.id}`);
    else if (op.tipo === 'actualizar') ids.set(op.id, op.eventId!);
    else ids.set(op.id, null);
  }
  const ref = adminDb.doc(`actividades/${id}`);
  const actual = (await ref.get()).data()!;
  const sesiones = reponerIds(actual.sesiones ?? [], ids);
  if (sesiones) await ref.update({ sesiones });
};

/** Un ciclo de tres encuentros, publicado. */
const formPublicado = (slug: string): ActividadForm =>
  formDeCiclo({
    slug,
    estado: 'publicado',
    sesiones: [
      { ...sesionVacia(), inicio: '2026-10-01T19:00', fin: '2026-10-01T21:00', tema: 'Cap. 1-4' },
      { ...sesionVacia(), inicio: '2026-10-08T19:00', fin: '2026-10-08T21:00', tema: 'Cap. 5-8' },
      { ...sesionVacia(), inicio: '2026-10-15T19:00', fin: '2026-10-15T21:00', tema: 'Cap. 9-12' },
    ],
  });

/**
 * Crea la actividad desde el panel y deja sus tres eventos creados, como queda
 * después de la primera pasada del sync.
 */
const publicadaConEventos = async (slug: string) => {
  const form = formPublicado(slug);
  const id = await crearActividad(form, UID);
  const ops = planificar(null, await comoLaFunction(id)) as Op[];
  expect(ops.map((o) => o.tipo)).toEqual(['crear', 'crear', 'crear']);
  await aplicarEnCalendario(id, ops);
  const doc = await comoLaFunction(id);
  expect(doc.sesiones.every((s) => s.calendarEventId)).toBe(true);
  return { id, form };
};

/** El form que el panel tiene abierto, con el encuentro `i` editado. */
const conEncuentro = (form: ActividadForm, i: number, cambio: Record<string, unknown>) => ({
  ...form,
  sesiones: form.sesiones.map((s, j) => (j === i ? { ...s, ...cambio } : s)),
});

describe.skipIf(!vivo)('B-98 · cancelar un encuentro, contra el emulador', () => {
  beforeAll(async () => {
    await limpiarFirestore();
    await cargarReglas(REGLAS);
    await sembrarCentinelaDeSlugs();
    await entrarComo(UID, { admin: true });
  }, 30_000);

  afterAll(async () => {
    await deleteAdminApp(admin);
  });

  it('cancelar el segundo actualiza su evento —CANCELADO y el motivo— y no toca los otros', async () => {
    const { id, form } = await publicadaConEventos('club-b98-cancelar');
    const antes = await comoLaFunction(id);
    const eventoDelSegundo = antes.sesiones[1]!.calendarEventId;

    // El panel guarda desde un form **sin** los ids del write-back: la relectura
    // de B-150 los tiene que conservar, o el diff vería un encuentro sin evento.
    await actualizarActividad(
      id,
      conEncuentro(
        { ...form, sesiones: form.sesiones.map((s) => ({ ...s, calendarEventId: null })) },
        1,
        { cancelada: true, motivoCancelacion: '  Se pasa al jueves 16  ' },
      ),
      UID,
    );
    const despues = await comoLaFunction(id);

    // Lo que Firestore guardó: el motivo recortado y el id del evento intacto.
    expect(despues.sesiones[1]).toMatchObject({
      cancelada: true,
      motivoCancelacion: 'Se pasa al jueves 16',
      calendarEventId: eventoDelSegundo,
    });
    // Las fechas siguen siendo Timestamp (trampa 1).
    expect(typeof (despues.sesiones[1] as unknown as { inicio: { toDate: unknown } }).inicio.toDate).toBe(
      'function',
    );

    const ops = planificar(antes, despues) as Op[];
    expect(ops.map((o) => [o.tipo, o.eventId])).toEqual([['actualizar', eventoDelSegundo]]);
    expect(ops[0]!.evento!.summary).toBe(`CANCELADO — ${despues.titulo} — Cap. 5-8`);
    expect(ops[0]!.evento!.description.split('\n\n')[0]).toBe(
      'Este encuentro se canceló.\nMotivo: Se pasa al jueves 16',
    );
    // Misma fecha: el evento que la gente tiene agendado es el mismo.
    expect(ops[0]!.evento!.start).toEqual(
      construirEvento(antes, antes.sesiones[1] as never).start,
    );

    // La guarda anti-loop (§7.1): el write-back no cambia ningún id, así que no
    // escribe, y aunque escribiera, la pasada siguiente no tiene nada que hacer.
    await aplicarEnCalendario(id, ops);
    const trasElWriteBack = await comoLaFunction(id);
    expect(planificar(despues, trasElWriteBack)).toEqual([]);
  });

  it('descancelar vuelve a dejar el evento como estaba, con el mismo id', async () => {
    const { id, form } = await publicadaConEventos('club-b98-descancelar');
    const original = await comoLaFunction(id);

    const cancelado = conEncuentro(form, 1, { cancelada: true, motivoCancelacion: 'Feriado' });
    await actualizarActividad(id, cancelado, UID);
    const conCancelacion = await comoLaFunction(id);
    await aplicarEnCalendario(id, planificar(original, conCancelacion) as Op[]);

    // El form conserva lo tipeado, pero el documento guarda el motivo vacío.
    await actualizarActividad(id, conEncuentro(cancelado, 1, { cancelada: false }), UID);
    const reactivado = await comoLaFunction(id);
    expect(reactivado.sesiones[1]).toMatchObject({
      cancelada: false,
      motivoCancelacion: null,
      calendarEventId: original.sesiones[1]!.calendarEventId,
    });

    const ops = planificar(conCancelacion, reactivado) as Op[];
    expect(ops.map((o) => [o.tipo, o.eventId])).toEqual([
      ['actualizar', original.sesiones[1]!.calendarEventId],
    ]);
    // Byte por byte el evento de antes de cancelar.
    expect(ops[0]!.evento).toEqual(construirEvento(original, original.sesiones[1] as never));
  });

  it('borrar la fila del encuentro, en cambio, borra su evento', async () => {
    const { id, form } = await publicadaConEventos('club-b98-borrar');
    const antes = await comoLaFunction(id);

    await actualizarActividad(id, { ...form, sesiones: [form.sesiones[0]!, form.sesiones[2]!] }, UID);
    const despues = await comoLaFunction(id);

    const ops = planificar(antes, despues) as Op[];
    expect(ops.filter((o) => o.tipo === 'borrar')).toEqual([
      { tipo: 'borrar', id: form.sesiones[1]!.id, eventId: antes.sesiones[1]!.calendarEventId },
    ]);
    expect(ops.some((o) => o.tipo === 'crear')).toBe(false);
  });

  it('despublicar con un encuentro cancelado borra los tres eventos, el del cancelado incluido', async () => {
    const { id, form } = await publicadaConEventos('club-b98-despublicar');
    const original = await comoLaFunction(id);
    const cancelado = conEncuentro(form, 1, { cancelada: true, motivoCancelacion: 'Feriado' });
    await actualizarActividad(id, cancelado, UID);
    const conCancelacion = await comoLaFunction(id);
    await aplicarEnCalendario(id, planificar(original, conCancelacion) as Op[]);

    await actualizarActividad(id, { ...cancelado, estado: 'borrador' }, UID);
    const borrador = await comoLaFunction(id);

    const ops = planificar(conCancelacion, borrador) as Op[];
    expect(ops.map((o) => o.tipo)).toEqual(['borrar', 'borrar', 'borrar']);
  });
});
