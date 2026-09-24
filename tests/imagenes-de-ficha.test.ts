/**
 * **La galería de las cuatro guías sale saneada** — B-907.
 *
 * Una regla de Firestore no itera una lista: de `imagenes` acota la cantidad y
 * el tipo, no la forma de cada fila. Lo que decide qué llega al `src` de una
 * página indexada es la proyección, y este archivo fija que **las cuatro**
 * —librería, biblioteca, suscripción, lugar— pasen por la misma función
 * (`imagenesDeFichaPublica`) y no por una copia propia.
 *
 * Se prueba **a través de cada proyección** y no solo la función suelta: lo que
 * se quiere fijar es que cada `*Publica` la llame. MUTACIÓN PROBADA: volver una
 * de las cuatro a copiar `epigrafe`/`ancho` del documento pone en rojo su fila
 * de `describe.each`.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { imagenesDeFichaPublica } from '@/lib/imagenesDeFicha';
import { libreriaPublica } from '@/lib/libreriaPublica';
import { bibliotecaPublica } from '@/lib/bibliotecaPublica';
import { suscripcionPublica } from '@/lib/suscripcionPublica';
import { lugarPublico } from '@/lib/lugarPublico';
import { libreriaCentinela } from './fixtures/centinelas-libreria';
import { bibliotecaCentinela } from './fixtures/centinelas-biblioteca';
import { suscripcionCentinela } from './fixtures/centinelas-suscripcion';
import { lugarCentinela } from './fixtures/centinelas-lugar';

type ConImagenes = { imagenes: unknown[] };
type Proyectar = (doc: ConImagenes) => { imagenes: unknown[] };

const GUIAS: { nombre: string; archivo: string; base: () => ConImagenes; proyectar: Proyectar }[] = [
  {
    nombre: 'una librería',
    archivo: 'src/lib/libreriaPublica.ts',
    base: libreriaCentinela as unknown as () => ConImagenes,
    proyectar: libreriaPublica as unknown as Proyectar,
  },
  {
    nombre: 'una biblioteca',
    archivo: 'src/lib/bibliotecaPublica.ts',
    base: bibliotecaCentinela as unknown as () => ConImagenes,
    proyectar: bibliotecaPublica as unknown as Proyectar,
  },
  {
    nombre: 'una suscripción',
    archivo: 'src/lib/suscripcionPublica.ts',
    base: suscripcionCentinela as unknown as () => ConImagenes,
    proyectar: suscripcionPublica as unknown as Proyectar,
  },
  {
    nombre: 'un lugar',
    archivo: 'src/lib/lugarPublico.ts',
    base: lugarCentinela as unknown as () => ConImagenes,
    proyectar: lugarPublico as unknown as Proyectar,
  },
];

/** Una fila como la podría dejar un documento que nadie validó. */
const filaRara = (extra: Record<string, unknown>) => ({
  id: 'img_x',
  url: 'https://ok.example/foto.jpg',
  origen: 'externa',
  portada: false,
  ...extra,
});

describe.each(GUIAS)('la galería de $nombre — B-907', ({ archivo, base, proyectar }) => {
  const proyectarCon = (imagenes: unknown[]) => proyectar({ ...base(), imagenes }).imagenes;

  it('una URL que no es http(s) no sale, y la portada pasa a ser la siguiente', () => {
    const salida = proyectarCon([
      filaRara({ id: 'img_a', url: 'javascript:alert(1)', portada: true }),
      filaRara({ id: 'img_b', url: 'data:text/html,<script>', portada: false }),
      filaRara({ id: 'img_c', url: 'https://ok.example/sana.jpg' }),
    ]);
    expect(salida).toEqual([
      { url: 'https://ok.example/sana.jpg', epigrafe: '', ancho: null, alto: null },
    ]);
  });

  it('epígrafe, ancho y alto salen con su tipo o no salen', () => {
    const salida = proyectarCon([
      filaRara({
        epigrafe: { html: '<img onerror=alert(1)>' },
        ancho: '100" onerror="alert(1)',
        alto: -3,
      }),
    ]);
    expect(salida).toEqual([
      { url: 'https://ok.example/foto.jpg', epigrafe: '', ancho: null, alto: null },
    ]);
  });

  it('no deja pasar ninguna clave fuera de la whitelist', () => {
    const [imagen] = proyectarCon([
      filaRara({ storagePath: 'imagenes/secreto.jpg', textoAlternativo: 'x', extra: 'y' }),
    ]) as Record<string, unknown>[];
    expect(Object.keys(imagen!).sort()).toEqual(['alto', 'ancho', 'epigrafe', 'url']);
  });

  it('una fila que no es un mapa, o una lista que no es lista, no rompe el build', () => {
    expect(proyectarCon([null, 'https://ok.example/a.jpg', 42, { url: 7 }])).toEqual([]);
    expect(proyectar({ ...base(), imagenes: {} as unknown as unknown[] }).imagenes).toEqual([]);
  });

  it('la proyección llama a la implementación compartida y no tiene una copia', () => {
    // El control estructural de lo de arriba: una quinta copia pasaría los casos
    // de hoy y se separaría el día que la compartida gane una cláusula.
    const fuente = readFileSync(archivo, 'utf8');
    expect(fuente).toContain('imagenesDeFichaPublica(');
    expect(fuente).not.toMatch(/imagenesPublicables\(/);
  });
});

describe('imagenesDeFichaPublica — lo sano pasa entero', () => {
  it('conserva epígrafe y dimensiones válidas, con la portada primera', () => {
    expect(
      imagenesDeFichaPublica([
        filaRara({ id: 'img_a', url: 'https://ok.example/a.jpg', epigrafe: 'La vidriera' }),
        filaRara({ id: 'img_b', url: 'https://ok.example/b.jpg', portada: true, ancho: 1200, alto: 800 }),
      ]),
    ).toEqual([
      { url: 'https://ok.example/b.jpg', epigrafe: '', ancho: 1200, alto: 800 },
      { url: 'https://ok.example/a.jpg', epigrafe: 'La vidriera', ancho: null, alto: null },
    ]);
  });

  it('sin galería devuelve la lista vacía', () => {
    expect(imagenesDeFichaPublica(undefined)).toEqual([]);
    expect(imagenesDeFichaPublica(null)).toEqual([]);
  });
});
