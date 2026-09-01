import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { faltaElFlyer } from '@/lib/imagenes';
import { recomendacionesDelFormulario } from '@/lib/formulario/recomendaciones';
import { CAMPOS, SECCIONES } from '@/lib/formulario/camposFaltantes';
import { EVENTOS, formaDelFormulario } from '@/lib/analytics-eventos';
import { faltaParaPublicar } from '@/lib/schema';
import { formularioLleno } from './fixtures/formulario';
import type { Imagen } from '@/types/actividad';

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

  it('mira la portada, que es la que se publica', () => {
    // `portadaDe` cae en la primera si ninguna está marcada, así que una lista
    // sin portada explícita tampoco es «sin flyer».
    expect(faltaElFlyer([imagen({ portada: false })])).toBe(false);
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
