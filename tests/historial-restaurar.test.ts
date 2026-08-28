import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { camposRestaurables, payloadDeRestauracion, valorARestaurar } from '@/lib/historial';
import { CAMPOS_DE_SEARCH_TEXT, buildSearchText } from '@/lib/normalize';
import type { Actividad } from '@/types/actividad';

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
