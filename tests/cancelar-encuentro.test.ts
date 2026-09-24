import { describe, expect, it } from 'vitest';
import { construirEvento, motivoDeCancelacion, PREFIJO_CANCELADO } from '@calendario';
import { documentoAForm, formADocumento } from '@/lib/actividades';
import { detalleDeActividad } from '@/lib/detallePublico';
import { mapaDeEtiquetas } from '@/lib/listadoPublico';
import { actividadFormSchema, MENSAJES_DE_PRIVACIDAD } from '@/lib/schema';
import { duplicarSesion, sesionVacia } from '@/lib/sesiones';
import { duplicarSesionParaCopia } from '@/lib/duplicar';
import { toPublic } from '@/lib/toPublic';
import type { Actividad, SesionForm } from '@/types/actividad';
import { formDeCiclo } from './fixtures/formulario-de-ciclo';

/**
 * B-98 — cancelar un encuentro sin que desaparezca en silencio.
 *
 * Decisión del dueño (2026-08-26): «sí, y con el motivo de cancelación
 * incluido». Un encuentro cancelado **conserva su evento** de Calendar y lo
 * anuncia —`CANCELADO — ` en el título, el motivo arriba de la descripción—, la
 * página lo muestra tachado con el mismo motivo, y el panel tiene dónde
 * escribirlo. Borrar el encuentro, o despublicar la actividad, siguen borrando.
 *
 * El diff del §7.2 (qué operación emite cancelar, descancelar, cambiar el
 * motivo) vive en `calendario.test.ts`, al lado de los demás casos de
 * `planificar`; el recorrido completo contra el emulador, en
 * `cancelar-encuentro.integracion.test.ts`. Acá está el campo: schema, ida y
 * vuelta, proyección pública y la regla de cuándo hay motivo.
 */

const encuentro = (over: Partial<SesionForm> = {}): SesionForm => ({
  ...sesionVacia(),
  inicio: '2026-09-03T19:00',
  fin: '2026-09-03T21:00',
  tema: 'Cap. 1-4',
  ...over,
});

const rutasDeRechazo = (form: unknown): string[] => {
  const r = actividadFormSchema.safeParse(form);
  return r.success ? [] : r.error.issues.map((i) => i.path.join('.'));
};

describe('motivoDeCancelacion — cuándo hay motivo (B-98)', () => {
  it('solo con el encuentro cancelado, y recortado', () => {
    expect(motivoDeCancelacion({ cancelada: true, motivoCancelacion: '  Feriado  ' })).toBe('Feriado');
    expect(motivoDeCancelacion({ cancelada: false, motivoCancelacion: 'Feriado' })).toBeNull();
  });

  it('vacío, en blanco, ausente o de otro tipo es «sin motivo»', () => {
    expect(motivoDeCancelacion({ cancelada: true, motivoCancelacion: '   ' })).toBeNull();
    expect(motivoDeCancelacion({ cancelada: true, motivoCancelacion: null })).toBeNull();
    // Un documento anterior a B-98 no tiene el campo (D-26).
    expect(motivoDeCancelacion({ cancelada: true })).toBeNull();
    // Escrito a mano por consola: no tira, y no sale.
    expect(motivoDeCancelacion({ cancelada: true, motivoCancelacion: 42 })).toBeNull();
    expect(motivoDeCancelacion(undefined)).toBeNull();
  });
});

describe('el evento de un encuentro cancelado (§7.4, B-98)', () => {
  const doc = formADocumento(
    formDeCiclo({
      estado: 'publicado',
      sesiones: [encuentro({ cancelada: true, motivoCancelacion: 'Se pasa al jueves 10' })],
    }),
    'uid',
    false,
  ) as unknown as Actividad;

  it('el título lleva el prefijo y el motivo abre la descripción', () => {
    const e = construirEvento(doc, doc.sesiones[0]!);
    expect(e.summary).toBe(`${PREFIJO_CANCELADO}${doc.titulo} — Cap. 1-4`);
    expect(e.description.split('\n\n')[0]).toBe('Este encuentro se canceló.\nMotivo: Se pasa al jueves 10');
  });

  it('el resto del evento no cambia: misma fecha, mismo lugar, misma descripción debajo', () => {
    const vivo = { ...doc.sesiones[0]!, cancelada: false, motivoCancelacion: null };
    const e = construirEvento(doc, doc.sesiones[0]!);
    const antes = construirEvento(doc, vivo);
    expect(e.start).toEqual(antes.start);
    expect(e.end).toEqual(antes.end);
    expect(e.location).toEqual(antes.location);
    expect(e.description.endsWith(antes.description)).toBe(true);
  });

  it('sin motivo, el aviso va solo', () => {
    const sin = { ...doc.sesiones[0]!, motivoCancelacion: null };
    expect(construirEvento(doc, sin).description.split('\n\n')[0]).toBe('Este encuentro se canceló.');
  });

  it('siempre con timeZone explícito (trampa 1)', () => {
    const e = construirEvento(doc, doc.sesiones[0]!);
    expect(e.start.timeZone).toBe('America/Argentina/Buenos_Aires');
    expect(e.end.timeZone).toBe('America/Argentina/Buenos_Aires');
  });
});

describe('el schema (B-98)', () => {
  it('acepta un motivo de una línea y por defecto está vacío', () => {
    const r = actividadFormSchema.safeParse(formDeCiclo({ sesiones: [encuentro()] }));
    expect(r.success && r.data.sesiones[0]!.motivoCancelacion).toBe('');
  });

  it('rechaza un motivo de más de 200 caracteres', () => {
    const form = formDeCiclo({
      sesiones: [encuentro({ cancelada: true, motivoCancelacion: 'x'.repeat(201) })],
    });
    expect(rutasDeRechazo(form)).toContain('sesiones.0.motivoCancelacion');
  });

  /**
   * «Seguimos por Zoom: …» es una de las respuestas naturales a «por qué se
   * canceló», y el motivo va a la primera línea del evento **público** (trampa
   * 5). Corre con página —publicado y cancelado—, como la etiqueta de una
   * comisión.
   */
  it('rechaza el link de una reunión en el motivo, publicada o cancelada (§5.1, trampa 5)', () => {
    for (const estado of ['publicado', 'cancelado'] as const) {
      const form = formDeCiclo({
        estado,
        sesiones: [
          encuentro({ cancelada: true, motivoCancelacion: 'Seguimos por https://zoom.us/j/123' }),
        ],
      });
      expect(rutasDeRechazo(form), estado).toContain('sesiones.0.motivoCancelacion');
    }
    expect(MENSAJES_DE_PRIVACIDAD.motivoConLink).toMatch(/link/);
  });

  it('en borrador no traba, y en un encuentro descancelado tampoco: de ahí no sale', () => {
    const conLink = 'Seguimos por meet.google.com/abc';
    expect(
      rutasDeRechazo(
        formDeCiclo({
          estado: 'borrador',
          sesiones: [encuentro({ cancelada: true, motivoCancelacion: conLink })],
        }),
      ),
    ).not.toContain('sesiones.0.motivoCancelacion');
    expect(
      rutasDeRechazo(
        formDeCiclo({
          estado: 'publicado',
          sesiones: [encuentro({ cancelada: false, motivoCancelacion: conLink })],
        }),
      ),
    ).not.toContain('sesiones.0.motivoCancelacion');
  });
});

describe('ida y vuelta formulario ⇄ documento (B-98)', () => {
  it('el motivo de un cancelado se guarda recortado y vuelve igual', () => {
    const form = formDeCiclo({
      sesiones: [encuentro({ cancelada: true, motivoCancelacion: '  Feriado  ' })],
    });
    const doc = formADocumento(form, 'uid', false) as unknown as Actividad;
    expect(doc.sesiones[0]!.motivoCancelacion).toBe('Feriado');
    expect(documentoAForm({ ...doc, id: 'a' } as never).sesiones[0]!.motivoCancelacion).toBe('Feriado');
  });

  it('un encuentro no cancelado guarda `null` aunque el formulario conserve lo tipeado', () => {
    const form = formDeCiclo({
      sesiones: [encuentro({ cancelada: false, motivoCancelacion: 'Feriado' })],
    });
    const doc = formADocumento(form, 'uid', false) as unknown as Actividad;
    expect(doc.sesiones[0]!.motivoCancelacion).toBeNull();
  });

  it('un cancelado sin motivo guarda `null`, y la clave se escribe siempre', () => {
    const doc = formADocumento(
      formDeCiclo({ sesiones: [encuentro({ cancelada: true })] }),
      'uid',
      false,
    ) as unknown as Actividad;
    expect('motivoCancelacion' in doc.sesiones[0]!).toBe(true);
    expect(doc.sesiones[0]!.motivoCancelacion).toBeNull();
  });

  it('un documento anterior a B-98 se lee con el motivo vacío (D-26)', () => {
    const doc = formADocumento(
      formDeCiclo({ sesiones: [encuentro({ cancelada: true })] }),
      'uid',
      false,
    ) as unknown as Actividad;
    const { motivoCancelacion: _fuera, ...sinCampo } = doc.sesiones[0]!;
    const viejo = { ...doc, id: 'a', sesiones: [sinCampo] };
    expect(documentoAForm(viejo as never).sesiones[0]!.motivoCancelacion).toBe('');
  });
});

describe('las copias no heredan la cancelación ni su motivo (B-98)', () => {
  const cancelada = encuentro({ cancelada: true, motivoCancelacion: 'Feriado' });

  it('duplicar la fila', () => {
    const copia = duplicarSesion(cancelada);
    expect(copia.cancelada).toBe(false);
    expect(copia.motivoCancelacion).toBe('');
  });

  it('duplicar la actividad', () => {
    const copia = duplicarSesionParaCopia(cancelada, 7);
    expect(copia.cancelada).toBe(false);
    expect(copia.motivoCancelacion).toBe('');
  });
});

describe('la página de detalle (salida 6, B-98)', () => {
  const ETIQUETAS = mapaDeEtiquetas({});
  const detalle = (sesiones: SesionForm[]) =>
    detalleDeActividad(
      toPublic(
        formADocumento(formDeCiclo({ estado: 'publicado', sesiones }), 'uid', false) as never,
        'act_1',
      ),
      ETIQUETAS,
      new Date('2026-08-20T15:00:00Z'),
      {},
    );

  it('el encuentro cancelado lleva su motivo, y el vivo no lleva ninguno', () => {
    const d = detalle([
      encuentro({ cancelada: true, motivoCancelacion: 'Feriado' }),
      encuentro({ inicio: '2026-09-10T19:00', fin: '2026-09-10T21:00' }),
    ]);
    const [primero, segundo] = d.encuentros;
    expect(primero!.cancelada).toBe(true);
    expect(primero!.motivoCancelacion).toBe('Feriado');
    expect(segundo!.motivoCancelacion).toBeNull();
  });

  it('la proyección pública no lleva un motivo que no se publica', () => {
    const doc = formADocumento(formDeCiclo({ sesiones: [encuentro()] }), 'uid', false) as never as Actividad;
    // Un documento escrito a mano: motivo sin cancelación.
    const aMano = { ...doc, sesiones: [{ ...doc.sesiones[0]!, motivoCancelacion: 'Borrador del motivo' }] };
    const publica = toPublic(aMano, 'act_1');
    expect(publica.sesiones[0]!.motivoCancelacion).toBeNull();
    expect(JSON.stringify(publica)).not.toContain('Borrador del motivo');
  });
});
