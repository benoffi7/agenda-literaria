import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FUNCIONES } from '@/lib/analytics-eventos';
import {
  aDatetimeLocal,
  deDatetimeLocal,
  duplicarSesion,
  duracionMinutos,
  generarSesiones,
  nuevaSesionId,
  ordenarPorInicio,
  sesionVacia,
} from '@/lib/sesiones';
import type { SesionForm } from '@/types/actividad';

describe('nuevaSesionId — trampa 2', () => {
  it('genera ids únicos, no índices', () => {
    const ids = new Set(Array.from({ length: 200 }, nuevaSesionId));
    expect(ids.size).toBe(200);
  });

  it('usa el prefijo ses_ que espera el schema', () => {
    expect(nuevaSesionId()).toMatch(/^ses_/);
  });
});

describe('generarSesiones — §11', () => {
  it('genera N encuentros semanales desde la fecha base', () => {
    const s = generarSesiones({
      cantidad: 8,
      inicio: '2026-09-03T19:00',
      duracionMinutos: 90,
      cadaDias: 7,
    });
    expect(s).toHaveLength(8);
    expect(s[0]!.inicio).toBe('2026-09-03T19:00');
    expect(s[1]!.inicio).toBe('2026-09-10T19:00');
    expect(s[7]!.inicio).toBe('2026-10-22T19:00');
  });

  it('respeta la duración pedida', () => {
    const [primera] = generarSesiones({
      cantidad: 1,
      inicio: '2026-09-03T19:00',
      duracionMinutos: 90,
    });
    expect(primera!.fin).toBe('2026-09-03T20:30');
  });

  it('da a cada encuentro su propio id', () => {
    const s = generarSesiones({ cantidad: 5, inicio: '2026-09-03T19:00', duracionMinutos: 60 });
    expect(new Set(s.map((x) => x.id)).size).toBe(5);
  });

  it('no acumula desvío: la última fecha se calcula desde la primera', () => {
    const s = generarSesiones({ cantidad: 4, inicio: '2026-01-01T10:00', duracionMinutos: 60, cadaDias: 14 });
    expect(s[3]!.inicio).toBe('2026-02-12T10:00');
  });

  it('devuelve vacío con cantidad 0 o fecha inválida', () => {
    expect(generarSesiones({ cantidad: 0, inicio: '2026-09-03T19:00', duracionMinutos: 60 })).toEqual([]);
    expect(generarSesiones({ cantidad: 3, inicio: '', duracionMinutos: 60 })).toEqual([]);
  });
});

/**
 * B-90 — regenerar la lista de un ciclo **ya publicado** no puede estrenar ids:
 * el diff del §7.2 no reconocería ningún encuentro y borraría y recrearía los
 * ocho eventos, con los recordatorios y las suscripciones de la gente adentro.
 */
describe('generarSesiones — reemplazo de una lista existente (B-90)', () => {
  const previas = (n: number): SesionForm[] =>
    Array.from({ length: n }, (_, i) => ({
      id: `ses_previa_${i}`,
      inicio: '2026-09-03T19:00',
      fin: '2026-09-03T21:00',
      tema: 'Cap. 1-4',
      lectura: 'Pedro Páramo',
      cancelada: false,
      calendarEventId: `evt_${i}`,
      comisionId: null,
    }));

  it('la fila de cada posición hereda el id y su evento de calendario', () => {
    const s = generarSesiones({
      cantidad: 8,
      inicio: '2026-09-10T19:00',
      duracionMinutos: 120,
      previas: previas(8),
    });
    expect(s.map((x) => x.id)).toEqual(previas(8).map((x) => x.id));
    expect(s.map((x) => x.calendarEventId)).toEqual(previas(8).map((x) => x.calendarEventId));
  });

  it('las fechas sí son las nuevas: es lo que se pidió regenerar', () => {
    const s = generarSesiones({
      cantidad: 2,
      inicio: '2026-09-10T19:00',
      duracionMinutos: 120,
      previas: previas(2),
    });
    expect(s[0]!.inicio).toBe('2026-09-10T19:00');
    expect(s[1]!.inicio).toBe('2026-09-17T19:00');
  });

  it('las filas que sobran estrenan id y nacen sin evento', () => {
    const s = generarSesiones({
      cantidad: 10,
      inicio: '2026-09-10T19:00',
      duracionMinutos: 120,
      previas: previas(8),
    });
    expect(s[8]!.id).toMatch(/^ses_[0-9a-f-]{8,}/); // uuid de cliente, no índice
    expect(s[8]!.calendarEventId).toBeNull();
    expect(s[9]!.id).not.toBe(s[8]!.id);
  });

  it('generar de menos deja afuera las últimas, no las primeras', () => {
    const s = generarSesiones({
      cantidad: 6,
      inicio: '2026-09-10T19:00',
      duracionMinutos: 120,
      previas: previas(8),
    });
    expect(s.map((x) => x.id)).toEqual(previas(6).map((x) => x.id));
  });

  /**
   * B-176 — **regenerar recalcula solo las fechas.** El contenido de cada fila
   * —tema, lectura y la cancelación— se conserva.
   *
   * Devolvía `''` en las tres, y eso venía de cuando el generador reemplazaba la
   * lista entera. Desde D-103 la fila conserva su identidad (el encuentro 3 sigue
   * siendo el 3, con su evento), así que perder ocho lecturas asignadas al correr
   * el ciclo una semana dejó de tener sentido: es lo más caro de tipear de toda la
   * actividad.
   *
   * **`cancelada` cambió de lado, y no lo pedía el ítem.** Antes se pisaba a
   * `false` y este test lo afirmaba. El razonamiento escrito que justificaba
   * limpiarla —"una cancelación es una excepción del ciclo viejo"— es de
   * `duplicarSesionParaCopia`, y ahí vale: la copia es una actividad nueva, sin
   * nada en el calendario de nadie. Regenerar pasa sobre una actividad que puede
   * estar **publicada**, así que destildarla **recrea el evento en la agenda de
   * todo el que esté suscripto** — y eso no lo pidió nadie. La asimetría de D-124:
   * volver a tildar cuesta un click y se ve, porque la sección Encuentros no está
   * colapsada.
   */
  it('regenerar conserva el tema, la lectura y la cancelación de cada fila', () => {
    const [previa] = previas(1);
    const [s] = generarSesiones({
      cantidad: 1,
      inicio: '2026-09-10T19:00',
      duracionMinutos: 120,
      previas: [{ ...previa!, tema: 'Cap. 1-4', lectura: 'Pedro Páramo', cancelada: true }],
    });
    expect(s!.tema).toBe('Cap. 1-4');
    expect(s!.lectura).toBe('Pedro Páramo');
    expect(s!.cancelada).toBe(true);
    expect(s!.id).toBe(previa!.id);
  });

  it('pero una fila que no existía antes nace limpia', () => {
    const s = generarSesiones({
      cantidad: 2,
      inicio: '2026-09-10T19:00',
      duracionMinutos: 120,
      previas: [{ ...previas(1)[0]!, tema: 'Cap. 1-4', cancelada: true }],
    });
    expect(s[1]!.tema).toBe('');
    expect(s[1]!.lectura).toBe('');
    expect(s[1]!.cancelada).toBe(false);
  });

  it('y las fechas sí se recalculan: es lo único que el generador pisa', () => {
    const [s] = generarSesiones({
      cantidad: 1,
      inicio: '2026-09-10T19:00',
      duracionMinutos: 120,
      previas: [{ ...previas(1)[0]!, inicio: '2026-01-01T10:00', fin: '2026-01-01T12:00' }],
    });
    expect(s!.inicio).toBe('2026-09-10T19:00');
  });

  it('sin `previas` estrena todos los ids: es una lista nueva, no un reemplazo', () => {
    const s = generarSesiones({ cantidad: 3, inicio: '2026-09-10T19:00', duracionMinutos: 60 });
    expect(s.every((x) => x.calendarEventId === null)).toBe(true);
    expect(new Set(s.map((x) => x.id)).size).toBe(3);
  });
});

describe('duplicarSesion', () => {
  const base = {
    id: 'ses_original',
    inicio: '2026-09-03T19:00',
    fin: '2026-09-03T21:00',
    tema: 'Cap. 1-4',
    lectura: 'Pedro Páramo',
    cancelada: true,
    calendarEventId: 'evt_123',
    comisionId: null,
  };

  it('cambia el id y corre una semana', () => {
    const copia = duplicarSesion(base);
    expect(copia.id).not.toBe(base.id);
    expect(copia.inicio).toBe('2026-09-10T19:00');
    expect(copia.fin).toBe('2026-09-10T21:00');
  });

  it('no arrastra el calendarEventId del original — la copia no existe en Calendar', () => {
    expect(duplicarSesion(base).calendarEventId).toBeNull();
  });

  it('la copia no nace cancelada', () => {
    expect(duplicarSesion(base).cancelada).toBe(false);
  });

  it('conserva tema y lectura', () => {
    const copia = duplicarSesion(base);
    expect(copia.tema).toBe('Cap. 1-4');
    expect(copia.lectura).toBe('Pedro Páramo');
  });

  it('conserva la comisión: duplicar una fila es agregar otra fecha al mismo grupo', () => {
    /*
     * Lo pidió el `auditor-trampas` sobre B-181, y con motivo: la conserva por
     * spread, o sea que ninguna línea la nombra. Con `comisionId` afuera del
     * spread —o pisado a `null`— duplicar un encuentro produciría una fila
     * huérfana que el schema no deja publicar, y nada más lo diría.
     */
    expect(duplicarSesion({ ...base, comisionId: 'com_martes' }).comisionId).toBe('com_martes');
    expect(duplicarSesion(base).comisionId).toBeNull();
  });
});

describe('ida y vuelta de datetime-local', () => {
  it('no corre la hora', () => {
    const d = new Date(2026, 8, 3, 19, 30);
    expect(deDatetimeLocal(aDatetimeLocal(d))?.getTime()).toBe(d.getTime());
  });

  it('rechaza strings inválidos', () => {
    expect(deDatetimeLocal('')).toBeNull();
    expect(deDatetimeLocal('no-es-fecha')).toBeNull();
  });
});

describe('helpers de lista', () => {
  it('duracionMinutos lee la duración de la sesión', () => {
    expect(duracionMinutos({ ...sesionVacia(), inicio: '2026-09-03T19:00', fin: '2026-09-03T20:30' })).toBe(90);
  });

  it('ordenarPorInicio no muta el array original', () => {
    const a = { ...sesionVacia(), inicio: '2026-09-10T19:00' };
    const b = { ...sesionVacia(), inicio: '2026-09-03T19:00' };
    const lista = [a, b];
    const ordenada = ordenarPorInicio(lista);
    expect(ordenada[0]!.inicio).toBe('2026-09-03T19:00');
    expect(lista[0]!.inicio).toBe('2026-09-10T19:00');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// La cancelación de un encuentro se mide — B-58
// ───────────────────────────────────────────────────────────────────────────

describe('tildar «Cancelado» se mide, con vocabulario cerrado (§9) — B-58', () => {
  const raiz = (rel: string): string => `${process.cwd()}/${rel}`;
  const fuente = (rel: string): string => readFileSync(raiz(rel), 'utf8').replace(/\s+/g, '');

  it('la función está en el enum y el editor la emite', () => {
    /*
     * **Estaba sin medir a propósito**, y el motivo caducó: el `onChange` es
     * inline en el JSX y medirlo pedía reacomodar el markup de un componente que
     * otros frentes estaban tocando.
     *
     * No es un evento por completitud. Es el dato que falta para decidir
     * **B-162**, trabado desde agosto: si el rótulo de un encuentro cancelado de
     * un ciclo publicado hay que actualizarlo en el calendario depende de cuántas
     * veces pasa, y hoy nadie lo sabe.
     *
     * MUTACIÓN PROBADA: sacar el `medirFuncion` del `onChange` deja este caso en
     * rojo; sacar la entrada del enum lo deja en rojo **y** no compila, que es la
     * red que ya existía.
     */
    expect(FUNCIONES).toContain('encuentro-cancelar');
    expect(fuente('src/components/admin/SesionesEditor.tsx')).toContain(
      "medirFuncion('encuentro-cancelar'",
    );
  });

  it('y se emite con 1 al prender y 0 al apagar, no solo al prender', () => {
    /*
     * La mitad que se olvida: medir solo el «prender» hace que el número cuente
     * cancelaciones **y** arrepentimientos como si fueran lo mismo, y el dato que
     * B-162 necesita es cuántos encuentros quedan cancelados de verdad. Es el
     * mismo par que usa `actividad-cupo-completo`.
     */
    expect(fuente('src/components/admin/SesionesEditor.tsx')).toContain(
      "medirFuncion('encuentro-cancelar',undefined,e.target.checked?1:0)",
    );
  });
});

describe('generarSesiones con comisiones (B-181)', () => {
  const MARTES = 'com_martes';
  const s = (id: string, inicio: string, over: Partial<SesionForm> = {}): SesionForm => ({
    id,
    inicio,
    fin: inicio.replace('T19:00', 'T21:00'),
    tema: '',
    lectura: '',
    cancelada: false,
    calendarEventId: `evt_${id}`,
    comisionId: MARTES,
    ...over,
  });

  it('las filas nuevas nacen en la comisión que se pidió', () => {
    /*
     * Sin esto, «generar 8 encuentros» en la comisión de los martes producía ocho
     * filas huérfanas que el schema no deja publicar — y el que las generó tendría
     * que elegirle la opción a las ocho, una por una.
     */
    const r = generarSesiones({
      cantidad: 3,
      inicio: '2026-09-01T19:00',
      duracionMinutos: 120,
      comisionId: MARTES,
    });
    expect(r.map((x) => x.comisionId)).toEqual([MARTES, MARTES, MARTES]);
  });

  it('la fila que ya existía conserva SU comisión, no la del generador', () => {
    // `previa?.comisionId ?? comisionId`: el generador recalcula fechas, no
    // reasigna grupos. Mover un encuentro de comisión es otra acción.
    const otra = s('ses_1', '2026-09-01T19:00', { comisionId: 'com_jueves' });
    const r = generarSesiones({
      cantidad: 1,
      inicio: '2026-09-08T19:00',
      duracionMinutos: 120,
      previas: [otra],
      comisionId: MARTES,
    });
    expect(r[0]!.comisionId).toBe('com_jueves');
  });

  describe('la herencia por posición se hace sobre el orden CRONOLÓGICO', () => {
    /**
     * **Lo encontró el `auditor-trampas` sobre B-181, y era un P1.**
     *
     * La herencia de `id`/`calendarEventId` es por posición, y las fechas que el
     * generador produce son ascendentes. Con `previas` desordenado, el encuentro
     * nuevo del 1º heredaba el evento del último, y el diff del §7.2 le movía la
     * fecha al evento equivocado **en silencio**.
     *
     * Antes de B-181 el array se pasaba entero y el botón «Ordenar por fecha» era
     * la mitigación manual; con comisiones se pasa un subconjunto filtrado por
     * grupo, donde ese botón no alcanza — ordena el array entero, no cada grupo.
     */
    it('un grupo desordenado en el array igual empareja bien', () => {
      /*
       * MUTACIÓN PROBADA: volviendo a `previas[i]` en lugar del array ordenado,
       * este caso falla con los eventos cruzados (`evt_c`, `evt_a`, `evt_b`).
       */
      const desordenadas = [
        s('ses_c', '2026-09-15T19:00'),
        s('ses_a', '2026-09-01T19:00'),
        s('ses_b', '2026-09-08T19:00'),
      ];
      const r = generarSesiones({
        cantidad: 3,
        inicio: '2026-09-02T19:00',
        duracionMinutos: 120,
        cadaDias: 7,
        previas: desordenadas,
        comisionId: MARTES,
      });
      expect(r.map((x) => x.id)).toEqual(['ses_a', 'ses_b', 'ses_c']);
      expect(r.map((x) => x.calendarEventId)).toEqual(['evt_ses_a', 'evt_ses_b', 'evt_ses_c']);
    });

    it('y el contenido de cada fila viaja con su id, no con su posición vieja', () => {
      // Es la otra mitad de B-176: el tema y la lectura son de ese encuentro.
      const desordenadas = [
        s('ses_b', '2026-09-08T19:00', { tema: 'Segundo' }),
        s('ses_a', '2026-09-01T19:00', { tema: 'Primero' }),
      ];
      const r = generarSesiones({
        cantidad: 2,
        inicio: '2026-09-02T19:00',
        duracionMinutos: 120,
        previas: desordenadas,
        comisionId: MARTES,
      });
      expect(r.map((x) => [x.id, x.tema])).toEqual([
        ['ses_a', 'Primero'],
        ['ses_b', 'Segundo'],
      ]);
    });
  });
});
