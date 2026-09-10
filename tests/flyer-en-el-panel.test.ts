import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { faltaElFlyer } from '@/lib/imagenes';
import { recomendacionesDelFormulario } from '@/lib/formulario/recomendaciones';
import { CAMPOS, SECCIONES } from '@/lib/formulario/camposFaltantes';
import { EVENTOS, formaDelFormulario } from '@/lib/analytics-eventos';
import { faltaParaPublicar } from '@/lib/schema';
import { datosEstructurados, detalleDeActividad } from '@/lib/detallePublico';
import { carteleraDeDetalles } from '@/lib/cartelera';
import { mapaDeEtiquetas } from '@/lib/listadoPublico';
import { toPublic } from '@/lib/toPublic';
import { formularioLleno } from './fixtures/formulario';
import { actividadDePrueba } from './fixtures/indice';
import type { Actividad, Imagen } from '@/types/actividad';

/**
 * Que el flyer se cargue — B-264.
 *
 * ── El problema, medido ───────────────────────────────────────────────────
 * 42 actividades publicadas, **2 con imagen**. No es que falte materia prima: en
 * el circuito literario porteño el flyer *es* el medio de difusión. Es que el
 * campo estaba en un acordeón cerrado llamado «Opcional», la única frase que lo
 * acompañaba tranquilizaba («se ve igual de bien») y nada lo pedía nunca.
 *
 * Este archivo fija las cuatro mitades del arreglo, y **la cuarta es la que más
 * importa**: que nada de esto haya terminado bloqueando la publicación.
 */
const raiz = (rel: string): string => fileURLToPath(new URL(`../${rel}`, import.meta.url));
const fuente = (rel: string): string => readFileSync(raiz(rel), 'utf8');

const imagen = (over: Partial<Imagen> = {}): Imagen => ({
  id: 'img_1',
  url: 'https://ejemplo.com/flyer.jpg',
  epigrafe: '',
  origen: 'externa',
  portada: true,
  ...over,
});

describe('faltaElFlyer — una sola derivación para tres lugares', () => {
  it('sin imágenes, falta', () => {
    expect(faltaElFlyer([])).toBe(true);
    expect(faltaElFlyer()).toBe(true);
  });

  it('con una imagen con dirección, no falta', () => {
    expect(faltaElFlyer([imagen()])).toBe(false);
  });

  it('una fila con la dirección en blanco no cuenta como flyer', () => {
    /*
     * MUTACIÓN PROBADA: escribir la condición como `imagenes.length === 0`. Pasa
     * todo lo de arriba y falla acá — y el modo de falla en producción es el peor
     * de los tres: el panel deja de marcar «Sin flyer», el formulario deja de
     * avisar, y la cartelera igual no la muestra porque no hay nada que pintar.
     * O sea, los tres carteles diciendo que está y la pared vacía.
     */
    expect(faltaElFlyer([imagen({ url: '' })])).toBe(true);
    expect(faltaElFlyer([imagen({ url: '   ' })])).toBe(true);
  });

  it('una dirección no vacía pero inválida tampoco cuenta — B-854', () => {
    /*
     * **El caso que separaba al panel de la salida**, y el que hace falta el
     * `urlSegura`: los cuatro valores de abajo son no vacíos, así que el
     * predicado viejo (`!portadaDe(imagenes)?.url?.trim()`) decía «tiene flyer»
     * para los cuatro — mientras `imagenesDeDetalle` los descartaba, la pared
     * quedaba vacía y Google no recibía `image`.
     *
     * Son alcanzables: un documento con el `imagenUrl` legacy (D-125) nunca pasó
     * por `esUrl` ni por el esquema que B-817 puso sobre `imagenes[].url`.
     *
     * MUTACIÓN PROBADA: volver la condición a `!portadaDe(imagenes)?.url?.trim()`.
     * Todo lo de arriba sigue verde y este caso se pone rojo en los cuatro.
     */
    for (const url of [
      'javascript:alert(1)',
      'data:image/png;base64,AAAA',
      'C:\\fotos\\flyer.jpg',
      'Ver el flyer en instagram',
    ]) {
      expect(faltaElFlyer([imagen({ url })]), url).toBe(true);
    }
  });

  it('alcanza con que quede alguna publicable, no con que sea la marcada', () => {
    /*
     * `portadaDe` cae en la primera si ninguna está marcada, así que una lista
     * sin portada explícita tampoco es «sin flyer».
     *
     * Y con la portada rota **no falta el flyer**, porque la pared muestra la
     * otra: `imagenesDeDetalle` busca la marcada **después** de filtrar, justo
     * para no dejar la página sin imagen habiendo una válida. Preguntar acá por
     * la portada primero volvería a separar las dos respuestas.
     */
    expect(faltaElFlyer([imagen({ portada: false })])).toBe(false);
    expect(
      faltaElFlyer([
        imagen({ id: 'img_1', url: 'https://ejemplo.com/patio.jpg', portada: false }),
        imagen({ id: 'img_2', url: 'javascript:alert(1)', portada: true }),
      ]),
    ).toBe(false);
  });
});

/**
 * **La atadura, que es lo que este ítem pedía** — B-854.
 *
 * Los avisos del panel y lo que el sitio muestra son la **misma pregunta**
 * («¿esta actividad va a mostrar un flyer?») contestada por dos funciones que
 * nacieron para cosas distintas: `faltaElFlyer` para el panel, `imagenesDeDetalle`
 * para la página. Fijar cada una por separado protege cada instancia; lo que hay
 * que fijar es que **den lo mismo**, que es lo que se rompió en silencio.
 *
 * Por eso se afirma sobre una familia de fixtures y no sobre un caso: la clase,
 * no la instancia (`docs/05-patrones.md`).
 */
describe('el panel y la salida contestan lo mismo — B-854, clase de B-88', () => {
  const ETIQUETAS = mapaDeEtiquetas({
    tipo: [{ slug: 'taller', label: 'Taller' }],
    barrio: [{ slug: 'villa-crespo', label: 'Villa Crespo' }],
    arancel: [{ slug: 'gratis', label: 'Gratis' }],
  });
  const AHORA = new Date('2026-09-10T15:00:00Z');

  const detalleCon = (imagenes: Imagen[]) =>
    detalleDeActividad(
      toPublic({ ...actividadDePrueba(), imagenes } as Actividad, 'act_1'),
      ETIQUETAS,
      AHORA,
      {},
    );

  /** Las galerías que separaban las dos respuestas, y las que nunca las separaron. */
  const FAMILIA: { nombre: string; imagenes: Imagen[] }[] = [
    { nombre: 'sin imágenes', imagenes: [] },
    { nombre: 'una sana', imagenes: [imagen()] },
    { nombre: 'una en blanco', imagenes: [imagen({ url: '   ' })] },
    { nombre: 'una legacy con `javascript:`', imagenes: [imagen({ url: 'javascript:alert(1)' })] },
    { nombre: 'una legacy con texto', imagenes: [imagen({ url: 'Ver el flyer en instagram' })] },
    { nombre: 'una legacy con `data:`', imagenes: [imagen({ url: 'data:image/png;base64,AAAA' })] },
    {
      nombre: 'portada rota y foto sana',
      imagenes: [
        imagen({ id: 'img_1', url: 'https://ejemplo.com/patio.jpg', portada: false }),
        imagen({ id: 'img_2', url: 'javascript:alert(1)', portada: true }),
      ],
    },
    {
      nombre: 'las dos rotas',
      imagenes: [
        imagen({ id: 'img_1', url: 'data:image/png;base64,AAAA', portada: false }),
        imagen({ id: 'img_2', url: '   ', portada: true }),
      ],
    },
  ];

  it('«falta el flyer» ⟺ la página no publica ninguna imagen', () => {
    /*
     * MUTACIÓN PROBADA: dejar `faltaElFlyer` con `!portadaDe(imagenes)?.url?.trim()`.
     * Las cuatro filas legacy se ponen rojas acá y ninguna otra suite se entera.
     */
    for (const { nombre, imagenes } of FAMILIA) {
      expect(faltaElFlyer(imagenes), nombre).toBe(detalleCon(imagenes).imagenes.length === 0);
    }
  });

  it('«falta el flyer» ⟺ no entra a la cartelera y Google no recibe `image`', () => {
    /*
     * Las dos salidas que la recomendación del formulario nombra («no entra en la
     * cartelera y el link se comparte sin nada que mirar»). Son consumidores del
     * mismo view-model, así que esto no agrega una tercera derivación: fija que la
     * promesa del panel es la que el sitio cumple.
     */
    for (const { nombre, imagenes } of FAMILIA) {
      const detalle = detalleCon(imagenes);
      const falta = faltaElFlyer(imagenes);
      expect(carteleraDeDetalles([detalle]).length === 0, `${nombre} · cartelera`).toBe(falta);
      expect(datosEstructurados(detalle)?.image === undefined, `${nombre} · JSON-LD`).toBe(falta);
    }
  });
});

describe('la recomendación dice qué se pierde, no qué falta', () => {
  it('aparece cuando no hay flyer', () => {
    const consejos = recomendacionesDelFormulario(formularioLleno({ imagenes: [] }));
    expect(consejos.map((c) => c.id)).toEqual(['flyer']);
    expect(consejos[0]!.porQue).toContain('cartelera');
  });

  it('desaparece cuando lo hay', () => {
    expect(recomendacionesDelFormulario(formularioLleno({ imagenes: [imagen()] }))).toEqual([]);
  });

  it('lleva a la sección donde el campo está de verdad', () => {
    /*
     * El botón del aviso abre una sección y scrollea hasta ella. Si apuntara a
     * «Opcional» —donde el editor estaba antes— abriría un acordeón vacío, y el
     * build seguiría en verde. Se compara contra el registro de secciones para
     * que un id inventado no pase.
     */
    const consejo = recomendacionesDelFormulario(formularioLleno({ imagenes: [] }))[0]!;
    expect(SECCIONES.map((s) => s.id)).toContain(consejo.seccion);
    expect(consejo.seccion).toBe(CAMPOS.imagenes!.seccion);
  });

  it('el texto no tiene jerga: le habla a quien organiza', () => {
    // Mismo criterio que `tests/ayuda.test.ts`: sin `§`, sin nombres de archivo,
    // sin nombres de campo.
    for (const c of recomendacionesDelFormulario(formularioLleno({ imagenes: [] }))) {
      const texto = `${c.etiqueta} ${c.porQue}`;
      expect(texto).not.toMatch(/§|\.tsx|\.ts\b|imagenes|portada|storagePath/);
    }
  });
});

describe('el editor dejó de estar escondido', () => {
  it('la galería vive en «Qué es» y ya no en «Opcional»', () => {
    /*
     * Es el cambio de fondo y es el que se puede deshacer sin que nada falle: el
     * componente se mueve de archivo y las dos pantallas siguen funcionando.
     *
     * MUTACIÓN PROBADA: devolver `<GaleriaEditor>` a `SeccionOpcional.tsx`. Todo
     * el resto de la suite queda en verde y el campo vuelve a estar detrás de un
     * acordeón cerrado, que es la causa medida del 2 sobre 42.
     */
    expect(fuente('src/components/admin/formulario/SeccionQueEs.tsx')).toContain(
      '<GaleriaEditor',
    );
    expect(fuente('src/components/admin/formulario/SeccionOpcional.tsx')).not.toContain(
      '<GaleriaEditor',
    );
  });

  it('«Qué es» no colapsa, que es la mitad que hace que se vea', () => {
    // Mudarla a otra sección colapsable no arreglaría nada. El registro de
    // secciones es la fuente: `colapsable: false`.
    const queEs = SECCIONES.find((s) => s.id === 'que-es');
    expect(queEs?.colapsable).toBe(false);
  });

  it('el mapa de campos manda a la sección nueva', () => {
    for (const [ruta, campo] of Object.entries(CAMPOS)) {
      if (!ruta.startsWith('imagenes')) continue;
      expect(campo.seccion, `${ruta} sigue apuntando a la sección vieja`).toBe('que-es');
    }
  });

  it('la ayuda del panel explica para qué sirve, y desde el capítulo correcto', () => {
    /*
     * `tests/ayuda.test.ts` exige que cada sección tenga capítulo; no exige que
     * el capítulo diga la verdad. Antes de B-264 el de «Opcional» describía las
     * imágenes y el del flujo decía que subir archivos «todavía no está», que es
     * falso desde D-131.
     */
    const ayuda = fuente('src/lib/ayuda.ts');
    expect(ayuda, 'la ayuda tiene que nombrar la cartelera: es el para qué').toContain(
      'cartelera',
    );
    expect(ayuda, 'subir imágenes existe desde D-131').not.toContain(
      'subir fotos desde el teléfono todavía no está',
    );
  });
});

describe('avisar no es bloquear — la traba que NO se puso', () => {
  it('una actividad sin flyer se puede publicar', () => {
    /*
     * **Esta es la afirmación que más vale del archivo.** Todo lo demás empuja a
     * cargar el flyer, y el empujón se convierte en traba con una línea: agregar
     * `imagenes` a la validación de publicación del schema (D-120). El pedido es
     * explícito en que no: bloquear la publicación frena que se carguen
     * actividades, que es peor que una actividad sin imagen.
     *
     * MUTACIÓN PROBADA: en `schema.ts`, exigir `imagenes.length > 0` cuando el
     * estado es `publicado`. Este test se pone en rojo y ningún otro se entera.
     */
    const rutas = faltaParaPublicar(formularioLleno({ imagenes: [] })).map((i) =>
      i.path.join('.'),
    );
    expect(rutas.filter((r) => r.startsWith('imagenes'))).toEqual([]);
  });

  it('y tampoco frena el guardado de un borrador', () => {
    const rutas = faltaParaPublicar(
      formularioLleno({ imagenes: [], estado: 'borrador' }),
    ).map((i) => i.path.join('.'));
    expect(rutas.filter((r) => r.startsWith('imagenes'))).toEqual([]);
  });
});

describe('la medición: sin esto no sabemos si funcionó', () => {
  it('el guardado manda cuántas imágenes tiene, como entero', () => {
    /*
     * La pregunta que abrió el cambio es «¿qué proporción de lo que se publica
     * lleva flyer?», y se contesta cruzando este contador con `estado`, que el
     * mismo evento ya manda. Sin el contador, el cambio se hace a ciegas y no hay
     * forma de saber si movió la aguja.
     */
    expect(EVENTOS.guardado_ok.imagenes).toEqual({ tipo: 'entero', max: 20 });
    expect(EVENTOS.guardado_ok.estado).toBeDefined();
  });

  it('la forma del formulario lo cuenta, y no dice cuáles', () => {
    const forma = formaDelFormulario(formularioLleno({ imagenes: [imagen(), imagen()] }));
    expect(forma.imagenes).toBe(2);
    expect(formaDelFormulario(formularioLleno({ imagenes: [] })).imagenes).toBe(0);
    // §9 — nunca la URL. `analytics-privacidad.test.ts` barre los centinelas
    // sobre todo el payload; acá se afirma la forma del dato.
    expect(typeof forma.imagenes).toBe('number');
  });
});
