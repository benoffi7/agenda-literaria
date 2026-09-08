/**
 * **La restauración relee el documento antes de escribir** — B-181, con el
 * argumento de B-150 / D-360 / D-91.
 *
 * ── Por qué este archivo existe aparte ────────────────────────────────────
 * `tests/historial-restaurar.test.ts` prueba las tres funciones **puras** del
 * camino (`camposRestaurables`, `valorARestaurar`, `payloadDeRestauracion`), y por
 * eso no mockea nada. Lo que falta cubrir acá es `restaurarCampo`, que es la que
 * hace I/O: relee con `leerActividad` y escribe con `updateDoc`.
 *
 * El primer intento fue un chequeo **sobre la fuente** —buscar
 * `await leerActividad(actual.id)` en el texto del archivo— y el `auditor-trampas`
 * lo cobró con razón: eso es un test calcado de la implementación. Rompe con un
 * refactor correcto (renombrar la variable) y no prueba el comportamiento. Así que
 * lo que se afirma acá es **qué dato terminó en el `updateDoc`**.
 *
 * ── Qué se está evitando ──────────────────────────────────────────────────
 * `actual` es el snapshot que la pantalla leyó al montar, y la pantalla puede
 * quedar abierta. Si el payload se armara con ese snapshot, la restauración le
 * devolvería al documento los `calendarEventId` de entonces — el panel volviendo a
 * ser dueño de un campo que escribe la Function, que es lo que B-150 le sacó a
 * `actualizarActividad`. Un `null` de antes del write-back del sync vuelve al
 * documento, la edición siguiente emite `crear`, y queda un segundo evento en el
 * calendario **público** con el primero huérfano (B-80). `reponerIds` no lo tapa:
 * solo toca las sesiones que tuvieron operación (D-91).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Actividad, ActividadConId } from '@/types/actividad';
import { ts } from './fixtures/tiempo';

const updateDocEspia = vi.fn();

vi.mock('firebase/firestore', async () => {
  const real = await vi.importActual<typeof import('firebase/firestore')>('firebase/firestore');
  return {
    ...real,
    doc: () => ({ id: 'act_1' }),
    updateDoc: (...args: unknown[]) => updateDocEspia(...args),
  };
});

vi.mock('@/lib/firestore-client', () => ({ db: () => ({}) }));

/*
 * `leerActividad` se dobla y **el resto de `@/lib/actividades` queda real**:
 * `historial.ts` también importa `fusionarSesiones` de ahí, que es lo que empareja
 * las sesiones por id, y doblarlo haría que este test no probara el camino.
 */
vi.mock('@/lib/actividades', async () => {
  const real = await vi.importActual<typeof import('@/lib/actividades')>('@/lib/actividades');
  return { ...real, leerActividad: vi.fn() };
});

import { leerActividad } from '@/lib/actividades';
import { restaurarCampo } from '@/lib/historial';

const sesion = (id: string, calendarEventId: string | null) => ({
  id,
  inicio: ts('2026-09-15T22:00:00Z'),
  fin: ts('2026-09-16T00:00:00Z'),
  tema: 'Cap. 1-4',
  lectura: null,
  cancelada: false,
  calendarEventId,
  comisionId: null,
});

const actividad = (over: Partial<Actividad> = {}): ActividadConId =>
  ({
    id: 'act_1',
    tipo: 'club-lectura',
    titulo: 'Club de lectura',
    slug: 'club-de-lectura',
    descripcion: 'ocho encuentros',
    imagenes: [],
    organizador: { nombre: 'Casa Brandon', instagram: '', web: '' },
    tallerista: null,
    esCiclo: true,
    sesiones: [sesion('ses_1', 'evt_1')],
    comisiones: [],
    modalidades: [],
    modalidad: 'presencial',
    sede: null,
    online: null,
    inscripcion: { requiere: false, via: null, destino: '', cupo: null, cierra: null },
    arancel: { tipo: 'gratis', notas: '' },
    material: { tiene: false, items: [] },
    difusion: { arrobar: [], notas: '' },
    estado: 'publicado',
    tags: [],
    destacado: false,
    searchText: '',
    ...over,
  }) as unknown as ActividadConId;

/** Una versión que cambia el tema de la sesión, o sea que restaura `sesiones`. */
const version = () => ({
  guardadoEn: ts('2026-09-01T12:00:00Z'),
  actualizadoPor: 'uid_viejo',
  camposCambiados: ['sesiones'],
  documento: actividad({
    sesiones: [{ ...sesion('ses_1', 'evt_de_hace_tres_ediciones'), tema: 'Cap. 5-8' }],
  }) as unknown as Actividad,
});

beforeEach(() => {
  updateDocEspia.mockReset();
  vi.mocked(leerActividad).mockReset();
});

describe('restaurarCampo — el payload se arma con lo releído', () => {
  it('usa el `calendarEventId` del documento de AHORA, no el del snapshot', async () => {
    /*
     * El escenario exacto de B-80 por esta puerta: la pantalla se montó **antes**
     * del write-back del sync, así que su snapshot tiene `null`. El documento de
     * ahora ya tiene el id, y es el que tiene que sobrevivir.
     *
     * MUTACIÓN PROBADA: pasándole `actual` en vez de `fresco` a
     * `payloadDeRestauracion`, este caso falla con `null` en el payload.
     */
    const snapshotViejo = actividad({ sesiones: [sesion('ses_1', null)] });
    vi.mocked(leerActividad).mockResolvedValue(actividad({ sesiones: [sesion('ses_1', 'evt_1')] }));

    await restaurarCampo(snapshotViejo, 'sesiones', version() as never, 'uid_1');

    const payload = updateDocEspia.mock.calls[0]![1] as {
      sesiones: { calendarEventId: string | null; tema: string | null }[];
    };
    expect(payload.sesiones[0]!.calendarEventId).toBe('evt_1');
    // Y el contenido sí es el de la versión: es lo que se pidió restaurar.
    expect(payload.sesiones[0]!.tema).toBe('Cap. 5-8');
  });

  it('si la relectura no trae nada, usa el snapshot y escribe igual', async () => {
    /*
     * El control negativo, y la decisión: perder la restauración por un `getDoc`
     * que no contestó sería peor que restaurar con el snapshot, que es el
     * comportamiento que había antes.
     */
    vi.mocked(leerActividad).mockResolvedValue(null);

    await restaurarCampo(actividad(), 'sesiones', version() as never, 'uid_1');

    expect(updateDocEspia).toHaveBeenCalledTimes(1);
    const payload = updateDocEspia.mock.calls[0]![1] as {
      sesiones: { calendarEventId: string | null }[];
    };
    expect(payload.sesiones[0]!.calendarEventId).toBe('evt_1');
  });

  describe('las guardas se re-evalúan contra lo releído, no contra el snapshot', () => {
    /**
     * **El P1 de la séptima pasada del `auditor-privacidad`.**
     * `camposRestaurables` decide qué ofrece **en el render**, contra el snapshot
     * del montaje, y `restaurarCampo` confiaba en esa lista.
     *
     * El camino: la pantalla se monta con la actividad en `borrador` —donde la
     * etiqueta con un link es legítima y la guarda está en verde—, alguien la
     * publica desde otra pestaña, y el click escribe esa etiqueta sobre el
     * documento releído, que ya tiene página. Destino: el `<h3>` y el
     * `subEvent.name` de la página, el `summary` del evento, y rebuild marcado.
     */
    const versionConLink = () => ({
      ...version(),
      camposCambiados: ['comisiones'],
      documento: actividad({
        comisiones: [{ id: 'com_1', etiqueta: 'Martes — https://meet.google.com/abc' }],
      }) as unknown as Actividad,
    });

    it('no restaura una etiqueta con link si el documento de AHORA tiene página', async () => {
      /*
       * MUTACIÓN PROBADA: sacando la re-evaluación de `comisionesRestaurables`,
       * este caso escribe el link sobre la publicada.
       */
      const montadaComoBorrador = actividad({ estado: 'borrador' });
      vi.mocked(leerActividad).mockResolvedValue(actividad({ estado: 'publicado' }));

      await expect(
        restaurarCampo(montadaComoBorrador, 'comisiones', versionConLink() as never, 'uid_1'),
      ).rejects.toThrow(/link en el nombre de una opción/);
      expect(updateDocEspia).not.toHaveBeenCalled();
    });

    it('pero sí la restaura si sigue siendo un borrador', async () => {
      // El control negativo: de un borrador no sale nada, y restaurar lo que se
      // escribió es exactamente para lo que existe el historial.
      vi.mocked(leerActividad).mockResolvedValue(actividad({ estado: 'borrador' }));

      await restaurarCampo(
        actividad({ estado: 'borrador' }),
        'comisiones',
        versionConLink() as never,
        'uid_1',
      );
      expect(updateDocEspia).toHaveBeenCalledTimes(1);
    });

    it('y tampoco restaura el slug si se publicó en el medio (trampa 10)', async () => {
      /*
       * La misma clase por el campo con el que empezó: es preexistente —la guarda
       * del slug también se evaluaba contra el snapshot— y se cierra con las
       * mismas dos líneas.
       */
      const version = {
        ...versionConLink(),
        camposCambiados: ['slug'],
        documento: actividad({ slug: 'direccion-vieja' }) as unknown as Actividad,
      };
      vi.mocked(leerActividad).mockResolvedValue(
        actividad({ estado: 'publicado', publicadaAlgunaVez: true }),
      );

      await expect(
        restaurarCampo(actividad({ estado: 'borrador' }), 'slug', version as never, 'uid_1'),
      ).rejects.toThrow(/dirección web/);
      expect(updateDocEspia).not.toHaveBeenCalled();
    });
  });

  it('si la relectura RECHAZA, no escribe nada', async () => {
    /*
     * **Y tiene que seguir así.** `leerActividad` no atrapa nada, así que un
     * `getDoc` que rechaza aborta la restauración. Envolverlo en un `try/catch`
     * que caiga al snapshot parece amable y reabre el P1: las dos guardas de
     * abajo las contestaría el estado del montaje.
     *
     * El caso está para nombrar esa rama, que era la única sin control: la del
     * documento borrado ya estaba (arriba).
     */
    vi.mocked(leerActividad).mockRejectedValue(new Error('sin conexión'));

    await expect(
      restaurarCampo(actividad(), 'sesiones', version() as never, 'uid_1'),
    ).rejects.toThrow(/sin conexión/);
    expect(updateDocEspia).not.toHaveBeenCalled();
  });

  it('relee una sola vez y escribe una sola vez', async () => {
    // Que no se convierta en dos lecturas o dos escrituras por una edición
    // distraída: son operaciones facturadas y `updateDoc` dispara el trigger.
    vi.mocked(leerActividad).mockResolvedValue(actividad());

    await restaurarCampo(actividad(), 'descripcion', version() as never, 'uid_1');

    expect(vi.mocked(leerActividad)).toHaveBeenCalledTimes(1);
    expect(updateDocEspia).toHaveBeenCalledTimes(1);
  });
});
