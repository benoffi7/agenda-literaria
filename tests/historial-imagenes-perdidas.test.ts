import { describe, expect, it, vi } from 'vitest';
import {
  avisoDeImagenesQueYaNoEstan,
  imagenesAComprobar,
  imagenesQueYaNoEstan,
  type Version,
} from '@/lib/historial';
import type { Actividad, Imagen } from '@/types/actividad';

/**
 * B-852 — restaurar una galería cuyas imágenes el barrido ya borró.
 *
 * Lo que fija este archivo es la mitad **barata** del aviso: qué se comprueba y
 * qué se le dice a la persona. La comprobación de red la pone la pantalla y se
 * prueba renderizada en `historial-actividad.render.test.tsx`.
 */

const propia = (n: number, portada = false): Imagen =>
  ({
    id: `img_${n}`,
    url: `https://depósito/imagenes/${n}.jpg?token=t${n}`,
    epigrafe: '',
    origen: 'propia',
    portada,
    storagePath: `imagenes/${n}.jpg`,
  }) as unknown as Imagen;

const externa = (n: number): Imagen =>
  ({
    id: `img_x${n}`,
    url: `https://afuera/${n}.jpg`,
    epigrafe: '',
    origen: 'externa',
    portada: false,
  }) as unknown as Imagen;

const conGaleria = (imagenes: Imagen[] | undefined): Actividad =>
  ({ titulo: 'Taller', imagenes }) as unknown as Actividad;

const version = (imagenes: Imagen[] | undefined): Version => ({
  guardadoEn: null,
  actualizadoPor: 'uid-a',
  camposCambiados: ['imagenes'],
  borrado: false,
  documento: conGaleria(imagenes),
});

describe('imagenesAComprobar — solo lo que puede estar roto por el barrido (B-852)', () => {
  it('ofrece las propias que hoy no están en la galería', () => {
    const v = version([propia(1, true), propia(2), propia(3)]);
    const hoy = conGaleria([propia(1, true)]);
    expect(imagenesAComprobar('imagenes', v, hoy).map((i) => i.id)).toEqual(['img_2', 'img_3']);
  });

  it('no comprueba las que el documento de hoy sigue nombrando: el barrido no las toca', () => {
    const v = version([propia(1), propia(2)]);
    expect(imagenesAComprobar('imagenes', v, conGaleria([propia(2), propia(1)]))).toEqual([]);
  });

  it('no comprueba los links de afuera: el barrido borra objetos del depósito, no esos', () => {
    const v = version([externa(1), propia(2)]);
    expect(imagenesAComprobar('imagenes', v, conGaleria([])).map((i) => i.id)).toEqual(['img_2']);
  });

  it('para cualquier otro campo no hay nada que comprobar — ni `imagenUrl`', () => {
    const v = version([propia(1)]);
    expect(imagenesAComprobar('descripcion', v, conGaleria([]))).toEqual([]);
    expect(imagenesAComprobar('imagenUrl', v, conGaleria([]))).toEqual([]);
  });

  it('una versión o un documento sin `imagenes` no rompe', () => {
    expect(imagenesAComprobar('imagenes', version(undefined), conGaleria(undefined))).toEqual([]);
    expect(
      imagenesAComprobar('imagenes', version([propia(1)]), conGaleria(undefined)).map((i) => i.id),
    ).toEqual(['img_1']);
  });
});

describe('imagenesQueYaNoEstan — el recorrido, sin red (B-852)', () => {
  it('devuelve las que no cargan, en el orden de la galería', async () => {
    const carga = vi.fn(async (url: string) => !url.includes('/2.jpg'));
    const perdidas = await imagenesQueYaNoEstan([propia(1), propia(2), propia(3)], carga);
    expect(perdidas.map((i) => i.id)).toEqual(['img_2']);
    expect(carga).toHaveBeenCalledTimes(3);
  });

  it('si la comprobación misma rechaza, NO se avisa de una pérdida que no se comprobó', async () => {
    const perdidas = await imagenesQueYaNoEstan([propia(1)], () =>
      Promise.reject(new Error('sin red')),
    );
    expect(perdidas).toEqual([]);
  });
});

describe('avisoDeImagenesQueYaNoEstan — qué va a pasar, y que se puede seguir (B-852)', () => {
  it('sin pérdidas no hay aviso', () => {
    expect(avisoDeImagenesQueYaNoEstan(0, 3)).toBeNull();
  });

  it('una de varias: la cuenta contra la galería entera, y dice dónde se arregla', () => {
    const aviso = avisoDeImagenesQueYaNoEstan(1, 3)!;
    expect(aviso).toMatch(/^Una de las 3 imágenes de esa versión ya no está: se borró/);
    expect(aviso).toContain('se restaura igual');
    expect(aviso).toContain('esa vuelve como una imagen rota');
    expect(aviso).toContain('«Flyer e imágenes»');
  });

  it('varias de varias, todas, y la única', () => {
    expect(avisoDeImagenesQueYaNoEstan(2, 3)).toMatch(
      /^2 de las 3 imágenes de esa versión ya no están: se borraron/,
    );
    expect(avisoDeImagenesQueYaNoEstan(3, 3)).toMatch(
      /^Ninguna de las 3 imágenes de esa versión está más: se borraron.*esas vuelven/,
    );
    expect(avisoDeImagenesQueYaNoEstan(1, 1)).toMatch(
      /^La imagen de esa versión ya no está: se borró.*esa vuelve/,
    );
  });
});
