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

/**
 * B-888 / D-660 — el batch con el que `restaurarCampo` **mueve la reserva del
 * slug**. Restaurar el slug es el cuarto lugar que lo escribe, así que es el
 * cuarto que tiene que mover su reserva en `/slugs`, y en la misma operación
 * atómica que el documento: si no, el índice diría que el slug viejo sigue tomado
 * y que el nuevo está libre, o sea al revés que el catálogo.
 *
 * El doble registra qué hizo el batch para poder afirmarlo sin emuladores.
 */
const batchEspia = { set: vi.fn(), update: vi.fn(), delete: vi.fn(), commit: vi.fn() };

vi.mock('firebase/firestore', async () => {
  const real = await vi.importActual<typeof import('firebase/firestore')>('firebase/firestore');
  return {
    ...real,
    // El `id` del doble es el de la actividad para los casos de siempre; para las
    // refs de `/slugs` lo que se mira es el argumento del `set`/`delete`, que el
    // espía guarda igual.
    doc: (...args: unknown[]) => ({ id: 'act_1', args }),
    updateDoc: (...args: unknown[]) => updateDocEspia(...args),
    writeBatch: () => batchEspia,
    serverTimestamp: () => 'TS',
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
  /*
   * `slugDisponible` se dobla desde B-820: es una **query** (`getDocs` sobre la
   * colección entera) y el mock de `firebase/firestore` de arriba no la cubre, así
   * que sin doblarla el caso del slug intentaría hablar con Firestore de verdad.
   * Doblarla es además lo correcto para lo que se afirma: que `restaurarCampo` la
   * **consulte** y respete su respuesta.
   */
  return { ...real, leerActividad: vi.fn(), slugDisponible: vi.fn() };
});

import { leerActividad, slugDisponible } from '@/lib/actividades';
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
  /*
   * `mockReset()` **antes** del valor por defecto: `mockResolvedValue` no limpia el
   * historial de llamadas, así que sin el reset el caso «restaurar otro campo no
   * gasta la query» veía las llamadas de los casos anteriores y fallaba con «been
   * called 2 times». Lo pagué escribiéndolo.
   */
  vi.mocked(slugDisponible).mockReset();
  vi.mocked(slugDisponible).mockResolvedValue(true);
  for (const espia of Object.values(batchEspia)) espia.mockReset();
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

  describe('y el documento resultante pasa por el schema (B-818, D-540)', () => {
    /**
     * **La guarda general, y la que hace que este archivo sea el lugar donde se
     * afirma.** `issuesDeRestauracion` es pura y se ejercita directo en
     * `historial-restaurar.test.ts`, así que un test suyo no puede notar que nadie
     * la llame — ni que la llamen **después** del `updateDoc`, que sería no
     * validar. Acá la escritura está doblada, así que lo que se afirma es que **no
     * ocurrió**, que es el mismo criterio con el que el `auditor-trampas` rechazó
     * el chequeo sobre la fuente del que nació este archivo.
     *
     * El camino de B-818: publicada → borrador → se edita algo que en borrador
     * está permitido → «Restaurar → Estado» sobre una versión que decía
     * `publicado`. Eso escribía `estado: 'publicado'` salteando el nivel entero de
     * publicar, con rebuild marcado.
     */
    const versionPublicada = () => ({
      ...version(),
      camposCambiados: ['estado'],
      documento: actividad({ estado: 'publicado' }) as unknown as Actividad,
    });

    it('no publica desde el historial una actividad que el formulario no dejaría publicar', async () => {
      /*
       * El fixture de este archivo tiene `modalidades: []`, o sea que en borrador
       * es válido y publicado no: es exactamente la actividad a medio cargar del
       * ítem.
       *
       * MUTACIÓN PROBADA: sacando la llamada a `issuesDeRestauracion` de
       * `restaurarCampo`, este caso escribe `estado: 'publicado'` y la actividad
       * incompleta sale al sitio sola.
       */
      const borrador = actividad({ estado: 'borrador' });
      vi.mocked(leerActividad).mockResolvedValue(borrador);

      await expect(
        restaurarCampo(borrador, 'estado', versionPublicada() as never, 'uid_1'),
      ).rejects.toThrow(/No se puede restaurar/);
      expect(updateDocEspia).not.toHaveBeenCalled();
    });

    it('pero el simétrico sí se escribe: despublicar solo quita rechazos', async () => {
      // El control negativo, y el que impide «bloquear el estado siempre», que era
      // la primera de las tres salidas del ítem y la que se descartó.
      const publicada = actividad({ estado: 'publicado' });
      vi.mocked(leerActividad).mockResolvedValue(publicada);

      const versionBorrador = {
        ...version(),
        camposCambiados: ['estado'],
        documento: actividad({ estado: 'borrador' }) as unknown as Actividad,
      };

      await restaurarCampo(publicada, 'estado', versionBorrador as never, 'uid_1');

      expect(updateDocEspia).toHaveBeenCalledTimes(1);
      expect((updateDocEspia.mock.calls[0]![1] as { estado: string }).estado).toBe('borrador');
    });
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

describe('restaurarCampo — la unicidad del slug, que el schema no puede ver (B-820)', () => {
  /*
   * El formulario no deja guardar **dos** cosas: lo que rechaza
   * `actividadFormSchema` y lo que rechaza `slugDisponible`
   * (`formulario/guardar.ts`, «Ya hay otra actividad con este slug»). El piso de
   * B-818 cubre solo la primera, porque el schema es **puro** y la unicidad es una
   * query — así que esta mitad no la veía nadie.
   *
   * El camino: una actividad que **nunca se publicó** —`slugRestaurable` la
   * habilita, y es correcto por la trampa 10— restaura su slug viejo, que en el
   * medio otra actividad reusó. Quedan dos documentos con el mismo slug, y si las
   * dos terminan publicadas `getStaticPaths` colisiona: la URL sirve el contenido
   * de una de las dos y nada avisa.
   */
  const borrador = (over: Partial<Actividad> = {}) =>
    actividad({ estado: 'borrador', estuvoPublicada: false, ...over } as never);

  const versionConSlug = (slug: string) => ({
    guardadoEn: ts('2026-09-01T12:00:00Z'),
    actualizadoPor: 'uid_viejo',
    camposCambiados: ['slug'],
    documento: actividad({ slug }) as unknown as Actividad,
  });

  it('no escribe si el slug de la versión ya lo usa otra actividad', async () => {
    vi.mocked(leerActividad).mockResolvedValue(borrador({ slug: 'club-nuevo' } as never));
    vi.mocked(slugDisponible).mockResolvedValue(false);

    await expect(
      restaurarCampo(
        borrador({ slug: 'club-nuevo' } as never),
        'slug',
        versionConSlug('club-de-lectura') as never,
        'uid_1',
      ),
    ).rejects.toThrow(/ya la usa otra actividad/i);

    expect(updateDocEspia, 'escribió igual el slug duplicado').not.toHaveBeenCalled();
  });

  it('y pregunta por el slug del payload, excluyendo la actividad misma', async () => {
    /*
     * El `idActual` importa: sin él, restaurar un slug que la actividad **ya tiene**
     * se rechazaría contra sí misma. Y lo que se consulta es el valor del
     * `payload` —lo que se va a escribir— y no el del snapshot, por lo mismo que el
     * schema valida el payload (B-818).
     */
    vi.mocked(leerActividad).mockResolvedValue(borrador({ slug: 'club-nuevo' } as never));

    await restaurarCampo(
      borrador({ slug: 'club-nuevo' } as never),
      'slug',
      versionConSlug('club-de-lectura') as never,
      'uid_1',
    );

    expect(vi.mocked(slugDisponible)).toHaveBeenCalledWith('club-de-lectura', 'act_1');
    /*
     * B-888 / D-660 — y escribe por el batch, no por `updateDoc`: las tres
     * escrituras (reservar el nuevo, soltar el viejo, actualizar el documento)
     * tienen que ser una sola operación.
     *
     * MUTACIÓN PROBADA: sacarle a `restaurarCampo` la rama del batch —volver al
     * `updateDoc` pelado— deja este caso en rojo en las cuatro líneas de abajo, y
     * ningún otro del archivo se mueve.
     */
    expect(updateDocEspia, 'restauró el slug sin pasar por el batch').not.toHaveBeenCalled();
    expect(batchEspia.set, 'no reservó el slug restaurado').toHaveBeenCalled();
    expect(batchEspia.delete, 'no soltó la reserva del slug que se deja').toHaveBeenCalled();
    expect(batchEspia.update).toHaveBeenCalled();
    expect(batchEspia.commit).toHaveBeenCalled();
  });

  it('y suelta el slug del documento RELEÍDO, no el del snapshot de la pantalla', async () => {
    /*
     * **El P0 que encontró el `auditor-trampas`, con su red.**
     *
     * `actual` es el documento que trajo el montaje de la pantalla de historial;
     * `fresco` es el que el documento tiene en este instante (la relectura que el
     * docblock de `restaurarCampo` argumenta tres veces). La primera versión del
     * bloque del batch comparaba y borraba contra **`actual`**.
     *
     * El daño: entre que se abre la pantalla y el click, alguien le cambia el slug
     * a esta actividad —permitido, es un borrador; la trampa 10 solo lo congela
     * después de publicar— y ese nombre liberado lo toma **otra** actividad.
     * Restaurar borraba entonces la reserva de **esa otra**, y el índice pasaba a
     * decir «libre» sobre un nombre en uso: el estado exacto que D-660 existe para
     * que no pueda ocurrir. Alcanzan dos pestañas del mismo panel.
     *
     * Por qué al chequeo de clase de `historial-restaurar.test.ts` se le escapó:
     * ese barrido busca llamadas a `*Restaurables(… actual …)` por regex, y esto
     * **no es una llamada a una guarda**, es una comparación cruda.
     *
     * MUTACIÓN PROBADA: volver las dos referencias a `actual.slug` deja este caso
     * en rojo, y el de arriba en verde — que es la diferencia entre los dos.
     */
    const enPantalla = borrador({ slug: 'el-viejo-del-snapshot' } as never);
    // Lo que el documento tiene AHORA: alguien le cambió el slug en el medio.
    vi.mocked(leerActividad).mockResolvedValue(borrador({ slug: 'el-de-ahora' } as never));

    await restaurarCampo(enPantalla, 'slug', versionConSlug('club-de-lectura') as never, 'uid_1');

    const borrados = batchEspia.delete.mock.calls.map(
      ([ref]) => (ref as { args?: unknown[] }).args?.[2],
    );
    expect(borrados, 'soltó el slug del snapshot, que ya es de otra actividad').not.toContain(
      'el-viejo-del-snapshot',
    );
    expect(borrados, 'no soltó el slug que el documento tiene de verdad').toContain('el-de-ahora');
  });

  it('restaurar otro campo no gasta la query', async () => {
    /*
     * Va última y solo cuando hay slug en el payload: las tres guardas puntuales y
     * el schema son gratis, y esta cuesta una lectura de la colección entera.
     * Cobrarla en cada restauración sería pagar por todos el precio de un campo.
     */
    vi.mocked(leerActividad).mockResolvedValue(actividad({ sesiones: [sesion('ses_1', 'evt_1')] }));

    await restaurarCampo(actividad(), 'sesiones', version() as never, 'uid_1');

    expect(vi.mocked(slugDisponible)).not.toHaveBeenCalled();
    expect(updateDocEspia).toHaveBeenCalled();
  });
});
