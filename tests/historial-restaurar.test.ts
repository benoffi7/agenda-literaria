import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { camposRestaurables, payloadDeRestauracion, valorARestaurar } from '@/lib/historial';
import { CAMPOS_DE_SEARCH_TEXT, buildSearchText } from '@/lib/normalize';
import type { Actividad } from '@/types/actividad';
import { ts } from './fixtures/tiempo';

/**
 * B-40 — la restauración de un campo desde una versión vieja.
 *
 * Las tres funciones de este camino (`camposRestaurables`, `valorARestaurar`,
 * `payloadDeRestauracion`) **no tenían ningún test** hasta acá, y es el camino que
 * escribe en el documento en vivo con un `updateDoc` directo: **no pasa por el
 * schema**, así que lo que se cuele acá no lo frena nada aguas abajo.
 *
 * Lo que fija este archivo es una clase, no un caso: **un campo que se agregó al
 * modelo después de que se guardó una versión no es restaurable.** `camposCambiados`
 * une las claves de los dos documentos, así que lo reporta como cambiado —con razón,
 * para decidir si vale guardar una versión— y el `??` de `valorARestaurar` lo
 * convertía en `null`. La instancia que lo destapó es `imagenes` (B-167), y el mismo
 * camino existía para todos los campos agregados antes.
 */

const actividad = (over: Partial<Actividad> = {}): Actividad =>
  ({
    tipo: 'taller',
    titulo: 'Taller de crónica',
    slug: 'taller-de-cronica',
    descripcion: 'ocho encuentros',
    imagenes: [
      { id: 'img_1', url: 'https://hoy/1.jpg', epigrafe: '', origen: 'externa', portada: true },
      { id: 'img_2', url: 'https://hoy/2.jpg', epigrafe: '', origen: 'externa', portada: false },
    ],
    organizador: { nombre: 'Casa Brandon', instagram: '', web: '' },
    tallerista: null,
    esCiclo: false,
    sesiones: [],
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
  }) as unknown as Actividad;

/** Un encuentro mínimo, para los casos que solo miran su `comisionId` (B-181). */
const sesionDePrueba = (id: string) => ({
  id,
  inicio: ts('2026-09-15T22:00:00Z'),
  fin: ts('2026-09-16T00:00:00Z'),
  tema: null,
  lectura: null,
  cancelada: false,
  calendarEventId: null,
  comisionId: null,
});

/** Una versión guardada **antes** de que existiera `imagenes` (B-167). */
const versionAnteriorAB167 = () => ({
  guardadoEn: null,
  actualizadoPor: 'uid-a',
  camposCambiados: ['descripcion'],
  borrado: false,
  documento: {
    tipo: 'taller',
    titulo: 'Taller de crónica',
    slug: 'taller-de-cronica',
    descripcion: 'lo que decía antes',
    imagenUrl: 'https://vieja/tapa.jpg',
    organizador: { nombre: 'Casa Brandon', instagram: '', web: '' },
    tallerista: null,
    esCiclo: false,
    sesiones: [],
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
  },
});

describe('un campo que no existía en esa versión no es restaurable', () => {
  it('«Imágenes» no se ofrece sobre una versión anterior a B-167', () => {
    // Ofrecerlo mostraba «Decía: (vacío)» y restaurarlo escribía `imagenes: null`
    // en el documento en vivo, sin pasar por el schema.
    const campos = camposRestaurables(versionAnteriorAB167() as never, actividad());
    expect(campos).not.toContain('imagenes');
  });

  it('pero lo que sí cambió en esa versión se sigue ofreciendo', () => {
    // El filtro no puede llevarse puesto el campo que la persona vino a buscar.
    const campos = camposRestaurables(versionAnteriorAB167() as never, actividad());
    expect(campos).toContain('descripcion');
  });

  it('y si la versión SÍ tenía el campo, se ofrece igual que siempre', () => {
    const version = versionAnteriorAB167();
    (version.documento as Record<string, unknown>).imagenes = [];
    expect(camposRestaurables(version as never, actividad())).toContain('imagenes');
  });

  it('la clase, no la instancia: vale para cualquier campo agregado después', () => {
    // `destacado` se agregó en su momento igual que `imagenes` ahora. Una versión
    // sin la clave no puede ofrecer restaurarlo a `null`.
    const version = versionAnteriorAB167();
    delete (version.documento as Record<string, unknown>).destacado;
    expect(camposRestaurables(version as never, actividad({ destacado: true }))).not.toContain(
      'destacado',
    );
  });
});

describe('trampa 10 — la dirección web no se restaura sobre una actividad publicada', () => {
  /**
   * `restaurarCampo` escribe con `updateDoc` directo — no pasa por el schema
   * ni por `slugBloqueado` del formulario (§7, trampa 10). Si `camposRestaurables`
   * no filtrara `slug` acá, el historial sería la puerta de atrás para romper una
   * URL ya indexada. `HistorialActividad.tsx` confía en este filtro para no
   * mostrar el botón; sin test, un `slugRestaurable` invertido o un filtro
   * borrado pasarían en verde.
   */
  it('«slug» no se ofrece si la actividad ya está publicada', () => {
    const version = versionAnteriorAB167();
    version.camposCambiados = ['slug'];
    (version.documento as Record<string, unknown>).slug = 'direccion-vieja';
    const actual = actividad({ estado: 'publicado' });
    expect(camposRestaurables(version as never, actual)).not.toContain('slug');
  });

  it('pero sí se ofrece sobre un borrador — todavía puede cambiar de dirección', () => {
    // Control negativo: sin este caso, filtrar `slug` siempre (con cualquier
    // estado) pasaría el test de arriba igual.
    const version = versionAnteriorAB167();
    version.camposCambiados = ['slug'];
    (version.documento as Record<string, unknown>).slug = 'direccion-vieja';
    const actual = actividad({ estado: 'borrador' });
    expect(camposRestaurables(version as never, actual)).toContain('slug');
  });

  /**
   * B-285 — el agujero que quedaba abierto: **despublicar no des-indexa nada**.
   *
   * Con `actual.estado !== 'publicado'` bastaba pasar la actividad a borrador
   * para que el historial volviera a ofrecer el slug de una URL que estuvo tres
   * semanas en Google y en Instagram. La marca pegajosa lo cierra, y el caso de
   * arriba sigue valiendo: un borrador que **nunca** se publicó sí puede cambiar
   * de dirección.
   */
  it('un borrador que ESTUVO publicado tampoco ofrece el slug (B-285)', () => {
    const version = versionAnteriorAB167();
    version.camposCambiados = ['slug'];
    (version.documento as Record<string, unknown>).slug = 'direccion-vieja';
    const actual = actividad({ estado: 'borrador', publicadaAlgunaVez: true });
    expect(camposRestaurables(version as never, actual)).not.toContain('slug');
  });
});

describe('B-181 — el historial tampoco restaura una etiqueta con un link de reunión', () => {
  /**
   * **La otra mitad de la puerta**, y la encontró el `auditor-privacidad` como P1
   * sobre la guarda que el schema ya tenía: `restaurarCampo` escribe con
   * `updateDoc` y **no pasa por el schema**, así que el camino era
   *
   *   guardar el link en la etiqueta en **borrador** (permitido a propósito) →
   *   corregirlo y publicar → la versión conserva el link → «Restaurar → Opciones
   *   para sumarse» lo escribe sobre la publicada, y marca rebuild.
   *
   * Es el precedente de B-285 con otro campo: «el historial no puede ser la puerta
   * de atrás».
   */
  const conEtiqueta = (etiqueta: string) => {
    const version = versionAnteriorAB167();
    version.camposCambiados = ['comisiones'];
    (version.documento as Record<string, unknown>).comisiones = [{ id: 'com_1', etiqueta }];
    return version;
  };

  const conComisiones = (estado: Actividad['estado'], etiqueta: string): Actividad =>
    actividad({
      estado,
      comisiones: [{ id: 'com_1', etiqueta }],
    });

  it('sobre una publicada no se ofrece', () => {
    /*
     * MUTACIÓN PROBADA: sacando el filtro de `comisiones` de `camposRestaurables`,
     * este caso queda en verde y el link llega al `<h3>` de la página indexada.
     */
    const version = conEtiqueta('Martes 19 h — se pasa a https://meet.google.com/abc');
    const actual = conComisiones('publicado', 'Martes 19 h');
    expect(camposRestaurables(version as never, actual)).not.toContain('comisiones');
  });

  it('sobre una cancelada tampoco: su página sigue indexada (B-110)', () => {
    const version = conEtiqueta('Martes 19 h — zoom.us/j/84123?pwd=aB3');
    const actual = conComisiones('cancelado', 'Martes 19 h');
    expect(camposRestaurables(version as never, actual)).not.toContain('comisiones');
  });

  it('sobre un borrador SÍ se ofrece: de ahí no sale nada', () => {
    // Control negativo, y el que impide «filtrar comisiones siempre»: restaurar lo
    // que se escribió sobre un borrador es exactamente para lo que existe el
    // historial.
    const version = conEtiqueta('Martes 19 h — https://meet.google.com/abc');
    const actual = conComisiones('borrador', 'Martes 19 h');
    expect(camposRestaurables(version as never, actual)).toContain('comisiones');
  });

  it('restaurar las opciones no deja encuentros apuntando a una que ya no existe', () => {
    /*
     * **`comisiones` y `sesiones[].comisionId` son un par**, y esta pantalla puede
     * restaurar una mitad sola. Lo cobró la cuarta pasada del
     * `auditor-privacidad`: una versión anterior a la creación de una comisión la
     * borra, y las sesiones que la referencian quedan colgadas — un documento que
     * el schema rechaza al publicar, entrando por la única puerta que no lo valida,
     * y con rebuild marcado.
     *
     * Es el patrón de `modalidades` (B-224): el derivado se arregla en la **misma**
     * escritura.
     *
     * MUTACIÓN PROBADA: sacando el bloque `campo === 'comisiones'` de
     * `payloadDeRestauracion`, este caso falla con `com_1` colgado en las dos
     * sesiones.
     */
    const version = conEtiqueta('Jueves 19 h');
    (version.documento as Record<string, unknown>).comisiones = [
      { id: 'com_2', etiqueta: 'Jueves 19 h' },
    ];
    const actual = actividad({
      estado: 'publicado',
      comisiones: [{ id: 'com_1', etiqueta: 'Martes 19 h' }],
      sesiones: [
        { ...sesionDePrueba('ses_1'), comisionId: 'com_1' },
        { ...sesionDePrueba('ses_2'), comisionId: 'com_1' },
      ],
    });

    const payload = payloadDeRestauracion('comisiones', version as never, actual, 'uid_1');
    expect((payload.sesiones as { comisionId: string | null }[]).map((x) => x.comisionId)).toEqual([
      null,
      null,
    ]);
    // Y la comisión restaurada es la de la versión, no una mezcla.
    expect((payload.comisiones as { id: string }[]).map((c) => c.id)).toEqual(['com_2']);
  });

  it('restaurar los encuentros tampoco reintroduce una opción que ya no existe', () => {
    /*
     * **El sentido simétrico**, y lo cobró la quinta pasada del `auditor-trampas`
     * sobre la corrección del primero: cerrar una mitad de un par y no la otra es
     * la clase D-30/B-88.
     *
     * `comisionId` no es un campo de máquina (`CAMPOS_DE_MAQUINA_SESION` es solo
     * `calendarEventId`), así que `fusionarSesiones` trae el `comisionId` de la
     * versión vieja tal cual. Si esa comisión se borró después, restaurar
     * «Encuentros» la reintroduce colgada — y es alcanzable sin consola: abrir una
     * comisión, cursar unos meses, borrarla, y restaurar una versión anterior.
     *
     * MUTACIÓN PROBADA: sin la rama `campo === 'sesiones'`, este caso falla con
     * `com_vieja` puesto.
     */
    const version = versionAnteriorAB167();
    version.camposCambiados = ['sesiones'];
    (version.documento as Record<string, unknown>).sesiones = [
      { ...sesionDePrueba('ses_1'), comisionId: 'com_vieja' },
      { ...sesionDePrueba('ses_2'), comisionId: 'com_hoy' },
    ];
    const actual = actividad({
      estado: 'publicado',
      comisiones: [{ id: 'com_hoy', etiqueta: 'Martes 19 h' }],
      sesiones: [
        { ...sesionDePrueba('ses_1'), comisionId: 'com_hoy' },
        { ...sesionDePrueba('ses_2'), comisionId: 'com_hoy' },
      ],
    });

    const payload = payloadDeRestauracion('sesiones', version as never, actual, 'uid_1');
    expect((payload.sesiones as { comisionId: string | null }[]).map((x) => x.comisionId)).toEqual([
      // La que apuntaba a la comisión borrada queda sin opción…
      null,
      // …y la que apunta a una que existe conserva la suya.
      'com_hoy',
    ]);
  });

  it('restaurar las opciones sin ningún encuentro colgado NO reescribe las sesiones', () => {
    /*
     * **B-80 por una puerta nueva**, y lo cobró el `auditor-privacidad` sobre la
     * corrección anterior: `actual` es el snapshot que la pantalla leyó al montar,
     * así que escribir el array de sesiones cuando no hay nada que desenganchar
     * devuelve al documento los `calendarEventId` de entonces — el panel volviendo
     * a ser dueño de un campo que escribe la Function (D-360, B-150).
     *
     * Y no se autorrepara: sin cambios en el payload del evento, `planificar` no
     * emite operaciones y el trigger no repone los ids (D-91).
     *
     * MUTACIÓN PROBADA: asignando `payload.sesiones` sin el `if`, este caso falla
     * con las sesiones adentro del payload.
     */
    const version = conEtiqueta('Jueves 19 h');
    (version.documento as Record<string, unknown>).comisiones = [
      { id: 'com_hoy', etiqueta: 'Jueves 19 h' },
    ];
    const actual = actividad({
      estado: 'publicado',
      comisiones: [{ id: 'com_hoy', etiqueta: 'Martes 19 h' }],
      sesiones: [{ ...sesionDePrueba('ses_1'), comisionId: 'com_hoy' }],
    });

    const payload = payloadDeRestauracion('comisiones', version as never, actual, 'uid_1');
    expect(payload).not.toHaveProperty('sesiones');
  });

  it('el encuentro que SÍ resuelve conserva su opción', () => {
    /*
     * El control negativo de «desenganchar todo»: con dos encuentros y una sola
     * comisión borrada, el que apunta a la que sigue existiendo conserva la suya.
     * (Con **ninguno** colgado no se escriben las sesiones en absoluto — ver el
     * caso de arriba —, así que el control necesita una mezcla.)
     */
    const version = conEtiqueta('Jueves 19 h');
    (version.documento as Record<string, unknown>).comisiones = [
      { id: 'com_hoy', etiqueta: 'Jueves 19 h' },
    ];
    const actual = actividad({
      estado: 'publicado',
      comisiones: [{ id: 'com_hoy', etiqueta: 'Martes 19 h' }],
      sesiones: [
        { ...sesionDePrueba('ses_1'), comisionId: 'com_borrada' },
        { ...sesionDePrueba('ses_2'), comisionId: 'com_hoy' },
      ],
    });

    const payload = payloadDeRestauracion('comisiones', version as never, actual, 'uid_1');
    expect((payload.sesiones as { comisionId: string | null }[]).map((x) => x.comisionId)).toEqual([
      null,
      'com_hoy',
    ]);
  });

  it('una versión con etiquetas limpias se restaura igual sobre una publicada', () => {
    // El otro control negativo: la guarda mira el **contenido** de la versión, no
    // el campo. Sin este caso, filtrar `comisiones` en toda publicada pasaría los
    // dos primeros.
    const version = conEtiqueta('Jueves 19 h');
    const actual = conComisiones('publicado', 'Martes 19 h');
    expect(camposRestaurables(version as never, actual)).toContain('comisiones');
  });
});

describe('lo que se escribe es lo que decía la versión', () => {
  it('un campo que la versión tenía se restaura con su valor', () => {
    expect(valorARestaurar('descripcion', versionAnteriorAB167() as never, actividad())).toBe(
      'lo que decía antes',
    );
  });

  it('restaurar la galería de una versión que la tenía devuelve esa lista', () => {
    const version = versionAnteriorAB167();
    (version.documento as Record<string, unknown>).imagenes = [
      { id: 'img_v', url: 'https://vieja/x.jpg', epigrafe: '', origen: 'externa', portada: true },
    ];
    const restaurado = valorARestaurar('imagenes', version as never, actividad()) as unknown[];
    expect(restaurado).toHaveLength(1);
    expect((restaurado[0] as { url: string }).url).toBe('https://vieja/x.jpg');
  });
});

describe('el searchText y la restauración no derivan por separado (B-88, B-72)', () => {
  /**
   * `historial.ts` tenía su propia copia de «de qué campos sale el `searchText`»,
   * con cinco de los seis. Al agregar el libro (DEC-1), restaurar un libro viejo
   * escribía el campo y **dejaba el `searchText` con el título descartado** — y eso
   * es lo que sale al `events.json`, o sea el documento diciendo una cosa y el
   * índice público otra. La respuesta no fue un test que compare dos listas: fue
   * que haya una sola (`CAMPOS_DE_SEARCH_TEXT`).
   *
   * Estos dos chequeos cubren las dos direcciones de la clase, y ninguno compara
   * literales — uno mide comportamiento y el otro lee la función, que tiene ocho
   * líneas.
   */
  it('todo campo de la lista cambia de verdad el searchText', () => {
    // Si la lista nombra un campo que `buildSearchText` ignora, restaurarlo
    // recalcula al vacío: peor que no recalcular.
    for (const campo of CAMPOS_DE_SEARCH_TEXT) {
      const conCentinela: Record<string, unknown> = {
        titulo: '',
        descripcion: '',
        sede: { nombre: '', barrio: '' },
        organizador: { nombre: '' },
        tallerista: { nombre: '' },
        libro: { titulo: '', autor: '' },
      };
      conCentinela[campo] =
        campo === 'sede'
          ? { nombre: 'CENTINELA', barrio: '' }
          : // B-224 — las formas de cursar entran por la sede de cada fila.
            campo === 'modalidades'
            ? [{ sede: { nombre: 'CENTINELA', barrio: '' } }]
            : campo === 'libro'
              ? { titulo: 'CENTINELA', autor: '' }
              : campo === 'organizador' || campo === 'tallerista'
                ? { nombre: 'CENTINELA' }
                : 'CENTINELA';
      expect(buildSearchText(conCentinela), `${campo} no llega al searchText`).toContain(
        'centinela',
      );
    }
  });

  it('y toda fuente que la función lee está en la lista', () => {
    // La dirección que falló: `buildSearchText` creció y la lista no. Se lee la
    // función —ocho líneas— y se extraen los `a.<campo>` que consume.
    const fuente = readFileSync('src/lib/normalize.ts', 'utf8');
    const cuerpo = fuente.slice(fuente.indexOf('export const buildSearchText'));
    const leidos = new Set([...cuerpo.matchAll(/\ba\.([a-zA-Z]+)/g)].map((m) => m[1]!));
    for (const campo of leidos) {
      expect(
        (CAMPOS_DE_SEARCH_TEXT as readonly string[]).includes(campo),
        `buildSearchText lee \`${campo}\` y CAMPOS_DE_SEARCH_TEXT no lo tiene`,
      ).toBe(true);
    }
    // Y que de verdad encontró algo: un regex que no matchea nada pasaría solo.
    expect(leidos.size).toBeGreaterThanOrEqual(6);
  });

  it('restaurar las formas de cursar no deja el barrio viejo en el índice (B-224)', () => {
    /**
     * El bug: `buildSearchText` lee las sedes de `modalidades` **y** la `sede` de
     * primer nivel, que es el derivado. Armando el índice sobre `actual` con el
     * campo restaurado encima, el barrio viejo seguía adentro al lado del nuevo, y
     * la actividad quedaba buscable por un barrio que ya no es suyo. Se corregía
     * sola en la próxima edición completa: si alguien la busca no la encuentra
     * donde está, y si no, no se entera nadie.
     *
     * Es la clase de B-88 en miniatura: dos consumidores del mismo dato derivando
     * por caminos distintos. El arreglo es de orden — los derivados primero, el
     * índice sobre lo que va a quedar.
     */
    const sede = (barrio: string, nombre: string) => ({
      nombre,
      direccion: 'Drago 236',
      barrio,
      ciudad: 'CABA',
      indicaciones: '',
      geo: null,
    });
    const fila = (barrio: string, nombre: string) => ({
      id: 'mod_1',
      modalidad: 'presencial' as const,
      inicio: null,
      fin: null,
      sede: sede(barrio, nombre),
      online: null,
    });

    const actual = actividad({
      modalidades: [fila('palermo', 'Libreria Palermo')],
      sede: sede('palermo', 'Libreria Palermo'),
    } as unknown as Partial<Actividad>);
    const version = {
      ...versionAnteriorAB167(),
      camposCambiados: ['modalidades'],
      documento: { ...actual, modalidades: [fila('boedo', 'Casa Boedo')] },
    };

    const payload = payloadDeRestauracion('modalidades', version as never, actual, 'uid-a');
    expect(payload.searchText).toContain('boedo');
    expect(payload.searchText, 'el barrio viejo quedó en el índice').not.toContain('palermo');
    // Y los tres derivados acompañan en la misma escritura.
    expect((payload.sede as { barrio: string }).barrio).toBe('boedo');
    expect(payload.modalidad).toBe('presencial');
  });

  it('restaurar un libro viejo recalcula el searchText (§6)', () => {
    const version = versionAnteriorAB167();
    (version.documento as Record<string, unknown>).libro = {
      titulo: 'Pedro Páramo',
      autor: 'Juan Rulfo',
    };
    const payload = payloadDeRestauracion('libro', version as never, actividad(), 'uid-a');
    expect(payload.searchText).toContain('pedro paramo');
  });
});
