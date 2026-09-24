import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  ORIGEN_NO_DECLARADO,
  bucketDeUrl,
  imagenDelBucket,
  origenesDeCors,
  veredicto,
} from '../scripts/cors-del-bucket.mjs';

/**
 * `scripts/cors-del-bucket.mjs` — el humo del CORS del bucket, B-1321.
 *
 * Igual que `verificar-produccion.test.ts`: **la mitad que hace red no se testea**
 * —un test que pega contra el bucket real falla cuando se cae el wifi (B-180)—, y
 * lo que se testea es lo que decide: de dónde salen los orígenes, qué imagen se
 * elige, y cuándo una respuesta pasa.
 */
const leer = (r: string) => readFileSync(fileURLToPath(new URL(r, import.meta.url)), 'utf8');

const BUCKET = 'agenda-literaria.firebasestorage.app';
const url = (bucket: string, objeto = 'imagenes%2Fimg_1.png') =>
  `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${objeto}?alt=media&token=t`;

describe('origenesDeCors — los orígenes salen de cors.json', () => {
  it('con el cors.json del repo, son los cuatro orígenes del sitio', () => {
    expect(origenesDeCors(JSON.parse(leer('../cors.json')))).toEqual([
      'https://agendaleh.ar',
      'https://www.agendaleh.ar',
      'https://agenda-literaria.web.app',
      'https://agenda-literaria.firebaseapp.com',
    ]);
  });

  it('un origen nuevo en el archivo se verifica solo, sin repetir los que ya estaban', () => {
    const cors = [
      { origin: ['https://a.ar', 'https://b.ar'], method: ['GET'] },
      { origin: ['https://b.ar', 'https://c.ar'], method: ['get', 'HEAD'] },
    ];
    expect(origenesDeCors(cors)).toEqual(['https://a.ar', 'https://b.ar', 'https://c.ar']);
  });

  it('una entrada que no habilita GET no cuenta: es el método del fetch que promueve la foto', () => {
    const cors = [
      { origin: ['https://solo-head.ar'], method: ['HEAD'] },
      { origin: ['https://a.ar'], method: ['GET'] },
    ];
    expect(origenesDeCors(cors)).toEqual(['https://a.ar']);
  });

  it('sin ningún origen para GET, falla: un chequeo sin casos saldría verde sin mirar nada', () => {
    expect(() => origenesDeCors([{ origin: ['https://a.ar'], method: ['HEAD'] }])).toThrow(/ningún origen/);
    expect(() => origenesDeCors([])).toThrow(/ningún origen/);
    expect(() => origenesDeCors({})).toThrow(/no es una lista/);
  });

  it('un "*" se rechaza: no hay origen concreto que mandar', () => {
    expect(() => origenesDeCors([{ origin: ['*'], method: ['GET'] }])).toThrow(/"\*"/);
  });
});

describe('imagenDelBucket — qué imagen de events.json se le pide al bucket', () => {
  it('toma la primera portada servida por el bucket de producción', () => {
    const eventos = {
      actividades: [
        { imagenUrl: null },
        { imagenUrl: 'https://otro-sitio.com/flyer.jpg' },
        { imagenUrl: url(BUCKET, 'imagenes%2Fprimera.png') },
        { imagenUrl: url(BUCKET, 'imagenes%2Fsegunda.png') },
      ],
    };
    expect(imagenDelBucket(eventos, BUCKET)).toBe(url(BUCKET, 'imagenes%2Fprimera.png'));
  });

  it('una imagen de OTRO bucket no sirve: su CORS no es el que se está verificando', () => {
    expect(imagenDelBucket({ actividades: [{ imagenUrl: url('otro-bucket.appspot.com') }] }, BUCKET)).toBeNull();
  });

  it('si la proyección vuelve a llevar la galería, también la mira', () => {
    const eventos = { actividades: [{ imagenUrl: null, imagenes: [{ url: 'https://x.com/a.png' }, { url: url(BUCKET) }] }] };
    expect(imagenDelBucket(eventos, BUCKET)).toBe(url(BUCKET));
  });

  it('sin actividades, o con un JSON que no tiene la forma, devuelve null en vez de romper', () => {
    expect(imagenDelBucket({ actividades: [] }, BUCKET)).toBeNull();
    expect(imagenDelBucket({}, BUCKET)).toBeNull();
    expect(imagenDelBucket(null, BUCKET)).toBeNull();
  });

  it('bucketDeUrl lee el bucket de una URL de descarga y nada más', () => {
    expect(bucketDeUrl(url(BUCKET))).toBe(BUCKET);
    expect(bucketDeUrl('https://otro-sitio.com/v0/b/x/o/y')).toBeNull();
    expect(bucketDeUrl('https://firebasestorage.googleapis.com/v0/b/')).toBeNull();
    expect(bucketDeUrl(null)).toBeNull();
  });
});

describe('veredicto — cuándo una respuesta pasa', () => {
  const O = 'https://agendaleh.ar';

  it('un origen declarado que recibe su propia cabecera, pasa', () => {
    expect(veredicto({ origen: O, declarado: true, status: 200, allowOrigin: O }).estado).toBe('ok');
  });

  it('un "*" también deja leer al navegador, así que pasa (el control negativo es el que lo marca)', () => {
    expect(veredicto({ origen: O, declarado: true, status: 200, allowOrigin: '*' }).estado).toBe('ok');
  });

  it('SIN la cabecera falla y dice qué se rompe: es el caso de B-1235', () => {
    const v = veredicto({ origen: O, declarado: true, status: 200, allowOrigin: null });
    expect(v.estado).toBe('mal');
    expect(v.detalle).toMatch(/B-1235/);
    expect(v.detalle).toMatch(/08-operacion/);
  });

  it('con la cabecera de OTRO origen falla: el navegador la rechaza igual', () => {
    const v = veredicto({ origen: O, declarado: true, status: 200, allowOrigin: 'https://agenda-literaria.web.app' });
    expect(v.estado).toBe('mal');
  });

  it('un no-2xx falla sin mirar la cabecera: un 404 no dice nada del CORS', () => {
    expect(veredicto({ origen: O, declarado: true, status: 404, allowOrigin: O }).estado).toBe('mal');
    expect(veredicto({ origen: ORIGEN_NO_DECLARADO, declarado: false, status: 403, allowOrigin: null }).estado).toBe('mal');
  });

  it('control negativo: un origen no declarado sin cabecera pasa; con cabecera, falla', () => {
    expect(veredicto({ origen: ORIGEN_NO_DECLARADO, declarado: false, status: 200, allowOrigin: null }).estado).toBe('ok');
    const v = veredicto({ origen: ORIGEN_NO_DECLARADO, declarado: false, status: 200, allowOrigin: '*' });
    expect(v.estado).toBe('mal');
    expect(v.detalle).toMatch(/cors\.json/);
  });

  it('el origen del control negativo no puede ser nunca uno del sitio', () => {
    expect(origenesDeCors(JSON.parse(leer('../cors.json')))).not.toContain(ORIGEN_NO_DECLARADO);
    expect(new URL(ORIGEN_NO_DECLARADO).hostname.endsWith('.invalid')).toBe(true);
  });
});
