import { describe, expect, it } from 'vitest';
import {
  ID_IMAGEN_MIGRADA,
  MAXIMO_IMAGENES,
  conPortada,
  imagenExterna,
  imagenesDe,
  nuevaImagenId,
  portadaDe,
  sinImagen,
} from '@/lib/imagenes';
import { toPublic } from '@/lib/toPublic';
import { duplicarActividadForm } from '@/lib/duplicar';
import { formVacio } from '@/lib/formulario/estadoInicial';
import type { Actividad, Imagen } from '@/types/actividad';

/**
 * B-167 — la galería de imágenes.
 *
 * Lo que estos tests fijan, en orden de qué duele más si se rompe:
 *
 * 1. **`storagePath` no sale al público** (§5.1). Es la ruta interna del bucket.
 * 2. **El id del default de lectura es determinístico** (trampa 2 + D-125): un
 *    uuid nuevo en cada lectura hace que el formulario se crea sucio siempre.
 * 3. **Siempre hay exactamente una portada**, o ninguna con la lista vacía:
 *    B-107 necesita una imagen y no puede depender del orden de lectura.
 */

const img = (over: Partial<Imagen> = {}): Imagen => ({
  id: 'img_1',
  url: 'https://ejemplo.ar/tapa.jpg',
  epigrafe: '',
  origen: 'externa',
  portada: true,
  ...over,
});

describe('ids', () => {
  it('llevan el prefijo y no se repiten (trampa 2)', () => {
    const a = nuevaImagenId();
    const b = nuevaImagenId();
    expect(a.startsWith('img_')).toBe(true);
    expect(a).not.toBe(b);
  });
});

describe('la portada es exactamente una', () => {
  it('la primera que se agrega nace portada', () => {
    expect(imagenExterna('https://a/1.jpg', true).portada).toBe(true);
    expect(imagenExterna('https://a/2.jpg', false).portada).toBe(false);
  });

  it('marcar una desmarca las demás, en una sola operación', () => {
    const lista = [img({ id: 'img_a' }), img({ id: 'img_b', portada: false })];
    expect(conPortada(lista, 'img_b').map((i) => i.portada)).toEqual([false, true]);
  });

  it('quitar la portada la reasigna a la primera que queda', () => {
    // Sin esto, borrar la portada deja la lista sin ninguna y B-107 se queda sin
    // imagen para Open Graph sin que nada falle.
    const lista = [img({ id: 'img_a' }), img({ id: 'img_b', portada: false })];
    const quedan = sinImagen(lista, 'img_a');
    expect(quedan).toHaveLength(1);
    expect(quedan[0]!.portada).toBe(true);
  });

  it('quitar la última deja la lista vacía y sin inventar nada', () => {
    expect(sinImagen([img()], 'img_1')).toEqual([]);
  });

  it('`portadaDe` no depende del orden ni tira con la lista vacía', () => {
    const lista = [img({ id: 'img_a', portada: false }), img({ id: 'img_b' })];
    expect(portadaDe(lista)?.id).toBe('img_b');
    expect(portadaDe([])).toBeNull();
    expect(portadaDe()).toBeNull();
  });

  it('el máximo es el de DEC-7b', () => {
    expect(MAXIMO_IMAGENES).toBe(4);
  });
});

describe('el default de lectura de los documentos que ya existen (D-125)', () => {
  it('`imagenUrl` se lee como una lista de un elemento, marcada como portada', () => {
    const lista = imagenesDe({ imagenUrl: 'https://vieja/tapa.jpg' });
    expect(lista).toHaveLength(1);
    expect(lista[0]!.url).toBe('https://vieja/tapa.jpg');
    expect(lista[0]!.portada).toBe(true);
    expect(lista[0]!.origen).toBe('externa');
  });

  it('el id es determinístico, y esto NO es un detalle (trampa 2)', () => {
    // Un uuid nuevo en cada lectura hace que `huboCambioDeContenido` vea un
    // cambio cada vez que se abre el formulario: el aviso de "cambios sin
    // guardar" aparecería solo y se escribiría una versión al historial por cada
    // apertura.
    expect(imagenesDe({ imagenUrl: 'https://v/1.jpg' })[0]!.id).toBe(
      imagenesDe({ imagenUrl: 'https://v/1.jpg' })[0]!.id,
    );
    expect(imagenesDe({ imagenUrl: 'https://v/1.jpg' })[0]!.id).toBe(ID_IMAGEN_MIGRADA);
  });

  it('sin ninguno de los dos campos, la lista es vacía y no null', () => {
    expect(imagenesDe({})).toEqual([]);
    expect(imagenesDe({ imagenUrl: null })).toEqual([]);
  });

  it('si ya hay `imagenes`, el campo viejo se ignora', () => {
    const lista = imagenesDe({ imagenes: [img({ url: 'https://nueva/1.jpg' })], imagenUrl: 'https://vieja/x.jpg' });
    expect(lista.map((i) => i.url)).toEqual(['https://nueva/1.jpg']);
  });
});

describe('qué de cada imagen es público (§5.1, paso 0 de campo-nuevo)', () => {
  const actividad = (imagenes: Imagen[]): Actividad =>
    ({
      ...formVacio(),
      imagenes,
      searchText: '',
      inscripcion: { requiere: false, via: null, destino: '', cupo: null, cierra: null },
      sesiones: [],
    }) as unknown as Actividad;

  it('`storagePath` NO sale al events.json: dibuja el bucket', () => {
    const publica = toPublic(
      actividad([img({ origen: 'propia', storagePath: 'actividades/act-1/tapa.jpg' })]),
      'act-1',
    );
    expect(JSON.stringify(publica)).not.toContain('actividades/act-1/tapa.jpg');
    expect(publica.imagenes[0]).not.toHaveProperty('storagePath');
  });

  it('lo que sí sale es lo que el sitio necesita para no saltar al cargar', () => {
    const publica = toPublic(actividad([img({ ancho: 1200, alto: 630, epigrafe: 'El patio' })]), 'a');
    expect(publica.imagenes[0]).toEqual({
      id: 'img_1',
      url: 'https://ejemplo.ar/tapa.jpg',
      epigrafe: 'El patio',
      origen: 'externa',
      portada: true,
      ancho: 1200,
      alto: 630,
    });
  });

  it('un documento viejo se proyecta con la lista migrada, no con el campo viejo', () => {
    const vieja = { ...actividad([]), imagenes: undefined, imagenUrl: 'https://v/1.jpg' };
    const publica = toPublic(vieja as unknown as Actividad, 'a');
    expect(publica.imagenes.map((i) => i.url)).toEqual(['https://v/1.jpg']);
    expect(publica).not.toHaveProperty('imagenUrl');
  });
});

describe('duplicar (B-11, B-167)', () => {
  it('hereda las externas con ids nuevos', () => {
    const origen = { ...formVacio(), titulo: 'Club', slug: 'club', imagenes: [img()] };
    const copia = duplicarActividadForm(origen, { tomados: [] });
    expect(copia.imagenes).toHaveLength(1);
    expect(copia.imagenes[0]!.url).toBe('https://ejemplo.ar/tapa.jpg');
    // Compartir el id haría que cualquier cosa que compare por id crea que son
    // la misma fila (trampa 2).
    expect(copia.imagenes[0]!.id).not.toBe('img_1');
  });

  it('NO hereda las propias: compartir el storagePath rompe a la otra al borrar', () => {
    const origen = {
      ...formVacio(),
      titulo: 'Club',
      slug: 'club',
      imagenes: [img({ id: 'img_p', origen: 'propia', storagePath: 'a/b.jpg' })],
    };
    expect(duplicarActividadForm(origen, { tomados: [] }).imagenes).toEqual([]);
  });

  it('y la copia queda con una portada, no con ninguna', () => {
    const origen = {
      ...formVacio(),
      titulo: 'Club',
      slug: 'club',
      imagenes: [
        img({ id: 'img_p', origen: 'propia', storagePath: 'a/b.jpg' }),
        img({ id: 'img_e', portada: false }),
      ],
    };
    const copia = duplicarActividadForm(origen, { tomados: [] });
    expect(copia.imagenes.filter((i) => i.portada)).toHaveLength(1);
  });
});
