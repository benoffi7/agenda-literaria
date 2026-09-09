import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { VISTAS_A_TODO_ANCHO, ocupaTodoElAncho } from '@/lib/anchoDelPanel';
import { VISTAS_CON_FORMULARIO } from '@/lib/salida-del-panel';

/**
 * Qué pantalla del panel usa todo el ancho — B-620.
 *
 * La regla es pura y se testea directo. Lo que **no** se puede testear así es el
 * cableado, y es justo la mitad que se rompe sola: el panel volvería a quedar
 * encajonado si alguien deja el `max-w-3xl` fijo en el `className` y nada
 * fallaría. De ahí el segundo bloque, que lee `AdminApp.tsx` como texto — mismo
 * criterio y mismo motivo que `tests/salida-del-panel.test.ts`.
 */

const fuente = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(`../src/${rel}`, import.meta.url)), 'utf8');

describe('el ancho lo decide la vista (B-620)', () => {
  it('el listado usa todo el ancho: es la grilla de tarjetas', () => {
    expect(ocupaTodoElAncho('lista', 'pc')).toBe(true);
    // Y no depende de la vista elegida: la grilla de tarjetas es una grilla en
    // las dos (B-814).
    expect(ocupaTodoElAncho('lista', 'celular')).toBe(true);
  });

  it('y el tablero también, desde B-621: es una grilla de gráficos', () => {
    /*
     * La otra mitad de B-621. Cambió de grupo **a propósito y en el mismo
     * cambio** que le repartió las columnas (D-400): moverla acá sin mirar la
     * pantalla la dejaría con un tablero de 1600px de ancho y una sola columna
     * de contenido, que es peor que el panel encajonado.
     */
    expect(ocupaTodoElAncho('estadisticas', 'pc')).toBe(true);
    expect(ocupaTodoElAncho('estadisticas', 'celular')).toBe(true);
  });

  it('ninguna vista con formulario lo usa en vista celular', () => {
    /*
     * La mitad que importa de la decisión, **acotada por B-814 a la vista donde
     * sigue siendo cierta**. Un formulario de 30+ campos a 1900px separa la
     * etiqueta de su error y pasa el límite de renglón cómodo: es peor que el
     * panel encajonado, no mejor. Y en vista celular el formulario es exactamente
     * eso —las nueve secciones a lo largo, sin pestañas— así que el argumento de
     * B-620 aplica entero.
     *
     * La lista sale de `salida-del-panel.ts` y no se repite acá: son las mismas
     * tres vistas y no puede haber dos versiones de cuáles son.
     */
    for (const vista of VISTAS_CON_FORMULARIO) {
      expect(ocupaTodoElAncho(vista, 'celular'), vista).toBe(false);
    }
  });

  it('pero en vista PC sí, y eso revisa B-620 (B-814)', () => {
    /*
     * **El punto que contradice una decisión tomada, y por eso tiene test
     * propio.** Lo decidió el dueño con el argumento cambiado: D-490 partió el
     * formulario en pestañas, así que lo que se pinta a 1900px ya no son 30+
     * campos sino los seis de una pestaña; y las secciones **ya reparten en dos
     * columnas** (`grid sm:grid-cols-2`), hoy apretadas en 896px. O sea que el
     * ancho no se estira: se usa, que es lo que B-621 pide antes de ensanchar.
     *
     * MUTACIÓN PROBADA: sacando `VISTAS_DE_FORMULARIO` de `ocupaTodoElAncho`,
     * este caso falla y el formulario queda encajonado en las dos vistas.
     */
    for (const vista of VISTAS_CON_FORMULARIO) {
      expect(ocupaTodoElAncho(vista, 'pc'), vista).toBe(true);
    }
  });

  it('las demás vistas arrancan angostas: el default es no ensanchar', () => {
    // Agregar una pantalla y olvidarse de esta lista la deja como está hoy, que
    // es el lado barato de equivocarse (mismo criterio que D-41).
    //
    // `calendario` **salió de esta lista el 2026-09-07**, por pedido del dueño:
    // la grilla del mes en 896px daba celdas de 120px. Lo que sigue sin hacerse
    // es el reparto de la grilla por dentro —el trabajo real de B-621— y eso no
    // lo puede fijar este test: acá solo vive qué pantalla se ensancha.
    //
    // Y **en las dos vistas de B-814**: la vista elegida solo mueve el
    // formulario. Que `historial` no se ensanche con «PC» es lo que impide leer
    // el interruptor como «ensanchá todo».
    for (const vista of ['historial', 'reportes', 'taxonomias']) {
      expect(ocupaTodoElAncho(vista, 'pc'), vista).toBe(false);
      expect(ocupaTodoElAncho(vista, 'celular'), vista).toBe(false);
    }
    expect(ocupaTodoElAncho('inventada', 'pc')).toBe(false);
  });
});

describe('el chasis del panel respeta la decisión (B-620)', () => {
  const ADMIN_APP = fuente('components/admin/AdminApp.tsx');

  /**
   * **Sin comentarios**, y por experiencia propia: este archivo explica en prosa
   * por qué el ancho completo no es `max-w-none`, así que un aserto que busque
   * ese texto en el fuente crudo mide el comentario y no el código. Es la misma
   * lección que dejó escrita `tests/etiquetas-de-ui.test.ts` sobre B-204.
   */
  const codigo = ADMIN_APP.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '');

  it('el contenedor pregunta por la vista en lugar de fijar un ancho', () => {
    expect(ADMIN_APP).toContain('ocupaTodoElAncho(vista.tipo, vistaDelPanel)');
  });

  it('el ancho de lectura sigue siendo el de siempre', () => {
    // Si esto cambia sin querer, cambia la medida de todas las pantallas del
    // panel menos una, y en ninguna se nota hasta que alguien la mira.
    expect(ADMIN_APP).toContain("ANCHO_DE_LECTURA = 'max-w-3xl lg:max-w-4xl'");
  });

  it('y el ancho completo tiene tope: `max-w-none` sería el mismo bug al revés', () => {
    // Sin tope, en 2560px las cuatro columnas dan tarjetas de 600px.
    expect(codigo).toMatch(/ANCHO_COMPLETO = 'max-w-\[\d+rem\]'/);
    expect(codigo).not.toContain('max-w-none');
  });

  it('no quedó ningún ancho fijo suelto en el contenedor de la vista', () => {
    /*
     * El bug exacto que dejaría el panel encajonado con este módulo puesto: un
     * `max-w-*` escrito al lado del ternario, que gana o pierde contra el de la
     * constante según el orden en que Tailwind emitió las dos utilidades
     * (`docs/05-patrones.md`, primera trampa de Tailwind).
     *
     * Se mira **la clase del contenedor de la vista** y no todo el archivo: el
     * login y la pantalla de «sin permisos» son angostas a propósito y tienen su
     * `max-w-sm` / `max-w-md` legítimo.
     */
    const contenedor = /className=\{`mx-auto[^`]*`\}/.exec(codigo);
    expect(contenedor, 'el contenedor de la vista cambió de forma').not.toBeNull();
    expect(contenedor![0]).not.toContain('max-w-');
  });

  it('las vistas a todo ancho existen en el router', () => {
    // Un typo en la lista la volvería inerte sin que nada falle: la vista no
    // matchearía nunca y el panel seguiría angosto.
    for (const vista of VISTAS_A_TODO_ANCHO) {
      expect(ADMIN_APP, `el router no tiene la vista «${vista}»`).toContain(
        `vista.tipo === '${vista}'`,
      );
    }
  });
});

/**
 * **Que el ancho de más se use y no quede como aire** — B-814, y es la mitad que
 * B-621 pide antes de ensanchar cualquier cosa: «qué crece, qué se reparte en
 * columnas, qué queda con su ancho». Sin esto, `ocupaTodoElAncho` devolviendo
 * `true` da el mismo formulario con 700px vacíos al costado, que es lo que el
 * propio ítem dice que no alcanza.
 *
 * Se afirma sobre la fuente porque es maquetación: jsdom no tiene layout, así que
 * un test de render no puede decir cuántas columnas se ven. Lo que sí se puede
 * fijar son las **dos trampas** de este reparto, y las dos dejan el build verde:
 *
 * 1. **`col-span-2` con tres columnas deja un hueco.** El span de un texto largo
 *    tiene que ser `col-span-full`, o la descripción ocupa dos de tres y al lado
 *    queda una celda vacía.
 * 2. **Un breakpoint de viewport en vez de contenedor rompe la vista celular.**
 *    `xl:grid-cols-3` mira la ventana, no el formulario: el mismo monitor de
 *    1920px pinta el formulario a 896px cuando la vista elegida es «celular», y
 *    ahí tres columnas son de 290px. Es el bug que tuvo la primera versión de este
 *    cambio.
 */
describe('el reparto de columnas del formulario (B-814, B-621)', () => {
  const SECCIONES_QUE_REPARTEN = [
    'components/admin/formulario/SeccionQueEs.tsx',
    'components/admin/formulario/SeccionQuien.tsx',
    'components/admin/formulario/SeccionArancelInscripcion.tsx',
  ];

  it('los textos largos abarcan la fila entera, no dos columnas', () => {
    /*
     * MUTACIÓN PROBADA: volviendo un `col-span-full` a `col-span-2`, este caso
     * falla — y con tres columnas esa fila queda con una celda vacía al lado de
     * la descripción.
     */
    for (const rel of SECCIONES_QUE_REPARTEN) {
      const codigo = fuente(rel);
      expect(codigo, `${rel} usa col-span-2, que con tres columnas deja un hueco`).not.toContain(
        'col-span-2',
      );
    }
    // Y que alguno de verdad abarca la fila: sin esto, borrar todos los spans
    // dejaría este caso en verde.
    expect(fuente(SECCIONES_QUE_REPARTEN[0]!)).toContain('col-span-full');
  });

  it('la tercera columna la decide el contenedor, no el viewport', () => {
    /*
     * MUTACIÓN PROBADA: cambiando `@5xl:grid-cols-3` por `xl:grid-cols-3`, este
     * caso falla — y la vista celular en un monitor grande reparte en tres dentro
     * de 896px.
     */
    for (const rel of SECCIONES_QUE_REPARTEN) {
      const codigo = fuente(rel);
      if (!codigo.includes('grid-cols-3')) continue;
      expect(codigo, `${rel} reparte por viewport y no por contenedor`).not.toMatch(
        /*
         * El `\b` y el lookbehind no son adorno: sin ellos `@5xl:grid-cols-3`
         * matchea —contiene `xl:grid-cols-3`— y el test rechaza justamente la
         * forma correcta. Pasó en la primera versión de este caso.
         */
        /(?<!@)\b(?:sm|md|lg|xl|2xl):grid-cols-3/,
      );
      expect(codigo).toContain('@5xl:grid-cols-3');
    }
  });

  it('y el contenedor existe, una sola vez, en el cuerpo de la sección', () => {
    /*
     * Sin `container-type` en un ancestro, las `@5xl:` no matchean nunca y el
     * formulario se queda en dos columnas para siempre — **sin que nada falle**,
     * que es la forma en que este reparto se puede volver inerte.
     *
     * Una sola vez y en `Seccion.tsx`: una grilla no puede consultarse a sí misma,
     * así que el contenedor tiene que ser un ancestro, y el cuerpo de la sección
     * es el ancestro común de las nueve.
     */
    const seccion = fuente('components/campos/Seccion.tsx');
    expect(seccion, 'el cuerpo de la sección dejó de ser el contenedor de consulta').toContain(
      '@container',
    );
    for (const rel of SECCIONES_QUE_REPARTEN) {
      expect(fuente(rel), `${rel} declara su propio @container: no se puede consultar a sí mismo`)
        .not.toContain('@container');
    }
  });
});
