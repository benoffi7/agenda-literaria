import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import {
  ANCHO_MINIATURA,
  ID_IMAGEN_MIGRADA,
  LADO_MAXIMO,
  MAXIMO_IMAGENES,
  conPortada,
  imagenExterna,
  imagenesDe,
  nuevaImagenId,
  portadaDe,
  sinImagen,
  srcsetDeMiniatura,
  urlDeMiniatura,
  urlDeMiniaturaSiExiste,
} from '@/lib/imagenes';
import { toPublic } from '@/lib/toPublic';
import { carteleraDeDetalles } from '@/lib/cartelera';
import { detalleDeActividad } from '@/lib/detallePublico';
import { mapaDeEtiquetas } from '@/lib/listadoPublico';
import { miniaturasConocidas, olvidarMiniaturas } from '@/lib/contenidoDelSitio';
import { duplicarActividadForm } from '@/lib/duplicar';
import { formVacio } from '@/lib/formulario/estadoInicial';
import { actividadFormSchema } from '@/lib/schema';
import { actividadDePrueba } from './fixtures/indice';
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

describe('el generador de ids y el schema que los valida (clase de B-88)', () => {
  /**
   * Dos derivaciones del mismo acuerdo: `nuevaImagenId()` y `ID_IMAGEN_MIGRADA`
   * producen el formato, `/^img_/` en el schema lo valida. Cada lado estaba
   * aserido contra el literal por su cuenta y **nadie hacía pasar la salida del
   * productor por el consumidor**.
   *
   * El caso que rompe en semi-silencio: cambiar `ID_IMAGEN_MIGRADA` deja
   * **inguardable en el panel toda actividad anterior a la galería**, porque su
   * fila migrada no pasaría el regex — y nada lo diría hasta que alguien intente
   * guardar una.
   */
  it('el schema acepta todos los ids que el generador produce, incluido el migrado', () => {
    for (const id of [nuevaImagenId(), ID_IMAGEN_MIGRADA]) {
      const r = actividadFormSchema.safeParse({
        ...formVacio(),
        titulo: 'Taller',
        slug: 'taller',
        imagenes: [{ id, url: 'https://a/1.jpg', epigrafe: '', origen: 'externa', portada: true }],
      });
      const rutas = r.success ? [] : r.error.issues.map((i) => i.path.join('.'));
      expect(rutas.filter((x) => x.includes('imagenes')), `el schema rechazó el id ${id}`).toEqual(
        [],
      );
    }
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

describe('urlDeMiniaturaSiExiste — la miniatura, solo si está confirmada (D-210)', () => {
  /*
   * El defecto que el coordinador encontró antes de integrar B-320/B-321:
   * `urlDeMiniatura` deriva la URL de la miniatura **a ciegas**, sin saber si
   * el objeto existe. Servirla en un `srcset` público sin confirmar rompe la
   * imagen si no existe — no degrada al original, que es lo que la primera
   * versión de B-320/B-321 daba por sentado: una vez que el navegador elige un
   * candidato del `srcset`, esa URL reemplaza al `src` en el algoritmo de
   * selección de imagen. El `src` es el respaldo para un navegador sin
   * soporte de `srcset`, no para un candidato que da 404.
   *
   * `optimizarImagen` está desplegada desde el 2026-09-03 y el barrido corrió
   * sobre el bucket entero, así que lo subido tiene su miniatura: la rotura no
   * es el caso general. Lo que queda es la ventana entre la subida y el
   * trigger —y cualquier corrida que falle—, que **cada** imagen nueva
   * atraviesa; un build ahí adentro publica el afiche roto en la cartelera y
   * en la portada de su propia página de detalle, hasta el rebuild siguiente.
   */
  const ORIGINAL =
    'https://firebasestorage.googleapis.com/v0/b/agenda-literaria.firebasestorage.app/o/' +
    'imagenes%2Fimg_1.jpg?alt=media&token=tok';
  const RUTA_MINIATURA = 'miniaturas/img_1.jpg';

  it('confirmada en el set: devuelve la misma URL que urlDeMiniatura', () => {
    const conocidas = new Set([RUTA_MINIATURA]);
    expect(urlDeMiniaturaSiExiste(ORIGINAL, conocidas)).toBe(urlDeMiniatura(ORIGINAL));
    expect(urlDeMiniaturaSiExiste(ORIGINAL, conocidas)).toContain('miniaturas%2Fimg_1.jpg');
  });

  it('NO confirmada: null, aunque la URL se pudiera derivar igual — el caso que rompía la imagen', () => {
    /*
     * MUTACIÓN PROBADA: cambiar la implementación para ignorar
     * `miniaturasConocidas` y devolver siempre `urlDeMiniatura(url)` (o sea,
     * volver al comportamiento de antes de D-210). Este test es el primero en
     * caer, antes que cualquier test de markup: afirma la función pura, no una
     * plantilla.
     */
    expect(urlDeMiniaturaSiExiste(ORIGINAL, new Set())).toBeNull();
    expect(urlDeMiniaturaSiExiste(ORIGINAL, new Set(['miniaturas/otra-imagen.jpg']))).toBeNull();
  });

  it('externa: null, tenga o no el set algo adentro — DEC-7d no la toca', () => {
    const conocidas = new Set([RUTA_MINIATURA]);
    expect(urlDeMiniaturaSiExiste('https://ejemplo.com/flyer.jpg', conocidas)).toBeNull();
  });

  it('URL inválida o vacía: null, no tira', () => {
    const conocidas = new Set([RUTA_MINIATURA]);
    expect(urlDeMiniaturaSiExiste(null, conocidas)).toBeNull();
    expect(urlDeMiniaturaSiExiste('no-es-una-url', conocidas)).toBeNull();
  });
});

/** Un detalle con una imagen **propia** y fecha próxima: el que sí lleva miniatura. */
const detalleConFotoPropia = () =>
  detalleDeActividad(
    toPublic(
      {
        ...actividadDePrueba({ fechas: ['2027-09-24T22:00:00Z'] }),
        imagenes: [
          {
            id: 'img_1',
            url:
              'https://firebasestorage.googleapis.com/v0/b/agenda-literaria.firebasestorage.app/o/' +
              'imagenes%2Fimg_1.jpg?alt=media&token=tok',
            epigrafe: '',
            origen: 'propia',
            portada: true,
            storagePath: 'imagenes/img_1.jpg',
          },
        ],
      },
      'act_miniatura',
    ),
    mapaDeEtiquetas({ tipo: [{ slug: 'taller', label: 'Taller' }] }),
    new Date('2027-09-10T15:00:00Z'),
    {},
  );

describe('miniaturasConocidas — la lectura de Storage del build (D-210)', () => {
  /*
   * Lo que se fija acá es el **modo de falla**, que es la mitad de D-210 que
   * puede romper el sitio entero si se hace mal.
   *
   * `contenidoDelSitio()` tira sin credenciales a propósito (B-189): un
   * `events.json` vacío publicado encima del que tenía datos es un incidente.
   * Esta lectura es la contraria y **nunca puede tirar**: si el build no puede
   * confirmar las miniaturas, la respuesta correcta es servir los originales
   * —el sitio exacto que había antes de B-320, más pesado y entero—, no
   * quedarse sin portadas ni voltear el build. Un `throw` acá convertiría una
   * optimización de peso en un bloqueante de publicación.
   */
  const guardar = (): Record<string, string | undefined> => ({
    FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST,
    FIREBASE_STORAGE_EMULATOR_HOST: process.env.FIREBASE_STORAGE_EMULATOR_HOST,
    FIREBASE_SERVICE_ACCOUNT: process.env.FIREBASE_SERVICE_ACCOUNT,
    GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  });

  const restaurar = (previo: Record<string, string | undefined>): void => {
    for (const [k, v] of Object.entries(previo)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  };

  it('sin credenciales: set vacío, no tira, y el sitio se queda con los originales', async () => {
    const previo = guardar();
    const avisos = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      delete process.env.FIRESTORE_EMULATOR_HOST;
      delete process.env.FIREBASE_STORAGE_EMULATOR_HOST;
      delete process.env.FIREBASE_SERVICE_ACCOUNT;
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
      olvidarMiniaturas();

      const conocidas = await miniaturasConocidas();
      expect(conocidas.size).toBe(0);

      /*
       * Y la consecuencia, dicha por valor y no por confianza: con el set
       * vacío el afiche sigue existiendo —con su `url` original— y lo único
       * que falta es el candidato chico del `srcset`. Sin esta afirmación, un
       * cambio que hiciera `flatMap` sobre «tiene miniatura» dejaría la
       * cartelera vacía en un build sin credenciales y los tests en verde.
       */
      const [afiche] = carteleraDeDetalles([detalleConFotoPropia()], conocidas);
      expect(afiche?.url).toContain('imagenes%2Fimg_1.jpg');
      expect(afiche?.urlMiniatura).toBeNull();
      expect(srcsetDeMiniatura(afiche!.urlMiniatura, afiche!.url)).toBeUndefined();
    } finally {
      avisos.mockRestore();
      restaurar(previo);
      olvidarMiniaturas();
    }
  });

  it('emulador de Firestore sin el de Storage: no sale a producción — set vacío y aviso', async () => {
    /*
     * `hayCredenciales()` dice que sí con solo `FIRESTORE_EMULATOR_HOST`, pero
     * el cliente de `@google-cloud/storage` no mira esa variable: mira la
     * suya. Sin la guarda, un build local contra el emulador en una máquina
     * con credenciales de GCP listaría el bucket de **producción** y
     * confirmaría paths de un bucket que no es el que el build está leyendo —
     * daría verde, con datos de otro lado.
     *
     * MUTACIÓN PROBADA: sacar el `if` de `leerMiniaturas` deja este test en
     * rojo (el aviso no sale) sin necesidad de red.
     */
    const previo = guardar();
    const avisos = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
      delete process.env.FIREBASE_STORAGE_EMULATOR_HOST;
      olvidarMiniaturas();

      expect((await miniaturasConocidas()).size).toBe(0);
      expect(avisos.mock.calls.flat().join(' ')).toContain('FIREBASE_STORAGE_EMULATOR_HOST');
    } finally {
      avisos.mockRestore();
      restaurar(previo);
      olvidarMiniaturas();
    }
  });
});

describe('ninguna salida pública deriva la miniatura a ciegas — D-210', () => {
  /*
   * La red que impide que el bug vuelva por otra puerta. Los tests de arriba
   * fijan las dos salidas que existen hoy (`cartelera.astro` por valor,
   * `[slug].astro` por markup en `galeria-del-detalle.test.ts`); esto fija la
   * **regla**, que es lo que sobrevive a la tercera salida que alguien agregue.
   *
   * `urlDeMiniatura` sigue exportada porque hace falta la derivación pura —la
   * usa `urlDeMiniaturaSiExiste` por dentro y los tests de paridad con
   * `functions/imagenes.js`—, y ese es justamente el riesgo: está a mano, tiene
   * la firma más cómoda de las dos, y llamarla produce una URL que se ve bien.
   */
  const raiz = (rel: string): string => fileURLToPath(new URL(`../${rel}`, import.meta.url));

  /** Sin comentarios: los docblocks de D-210 nombran la función que prohíben. */
  const sinComentarios = (s: string): string =>
    s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

  const archivos = (dir: string): string[] =>
    readdirSync(raiz(dir), { withFileTypes: true }).flatMap((e) =>
      e.isDirectory()
        ? archivos(`${dir}/${e.name}`)
        : /\.(astro|ts|tsx)$/.test(e.name)
          ? [`${dir}/${e.name}`]
          : [],
    );

  it('solo `src/lib/imagenes.ts` la llama', () => {
    const culpables = archivos('src')
      .filter((f) => f !== 'src/lib/imagenes.ts')
      .filter((f) => /\burlDeMiniatura\s*\(/.test(sinComentarios(readFileSync(raiz(f), 'utf8'))));

    expect(
      culpables,
      'una salida pública que llama a `urlDeMiniatura` a ciegas publica un ' +
        '`srcset` cuyo candidato puede dar 404, y eso ROMPE la imagen en vez de ' +
        'degradar al `src` (D-210). Usar `urlDeMiniaturaSiExiste`.',
    ).toEqual([]);
  });
});

describe('srcsetDeMiniatura — el srcset de dos candidatos (B-320, B-321)', () => {
  const MINIATURA = 'https://firebasestorage.googleapis.com/v0/b/x/o/miniaturas%2Fimg_1.jpg?alt=media';
  const ORIGINAL = 'https://firebasestorage.googleapis.com/v0/b/x/o/imagenes%2Fimg_1.jpg?alt=media&token=t';

  it('con miniatura: dos candidatos, el original siempre el grande', () => {
    expect(srcsetDeMiniatura(MINIATURA, ORIGINAL)).toBe(
      `${MINIATURA} ${ANCHO_MINIATURA}w, ${ORIGINAL} ${LADO_MAXIMO}w`,
    );
  });

  it('sin miniatura (externa, o subida antes de que la Function existiera): undefined, no vacío', () => {
    // Un `srcset=""` es distinto de que el atributo no exista: Astro omite el
    // atributo con `undefined` y lo emite vacío con `''`, y un `srcset` vacío
    // no es lo mismo que ausente para algunos navegadores.
    expect(srcsetDeMiniatura(null, ORIGINAL)).toBeUndefined();
  });

  it('una coma o un espacio en el original no compone: partiría la lista de candidatos', () => {
    /*
     * Lo encontró el `auditor-privacidad` auditando B-320: `imagenSchema` solo
     * valida `z.string().url()`, así que nada impide guardar una URL con una
     * coma en la query. Un `srcset` con esa coma sin escapar haría que el
     * navegador interprete el resto del string como una URL relativa a
     * **nuestro propio origen** — no una fuga de dato, pero sí un `srcset`
     * roto en una salida pública.
     *
     * MUTACIÓN PROBADA: sacar el `if` y componer siempre. Este test es el que
     * cae — sin él, una URL con coma compone un string que **parece** un
     * srcset válido y nada más lo distingue.
     */
    const conComa = 'https://firebasestorage.googleapis.com/v0/b/x/o/imagenes%2Fa.jpg?alt=media,x=y';
    expect(srcsetDeMiniatura(MINIATURA, conComa)).toBeUndefined();
    const conEspacio = 'https://ejemplo.com/foto raro.jpg';
    expect(srcsetDeMiniatura(MINIATURA, conEspacio)).toBeUndefined();
  });
});
