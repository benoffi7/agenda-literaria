import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  SELECTOR_ENFOCABLE,
  indiceDeTab,
  indiceDeTecla,
  indiceSiguiente,
} from '@/lib/foco';

/**
 * B-14 y B-64 — la aritmética del foco.
 *
 * Los dos ítems eran la misma clase vista en dos pantallas: un patrón de teclado
 * a medio hacer (cierra con `Escape`, se alcanza con Tab, y nada más) en el menú
 * "⋯" del listado y en la capa del centro de ayuda. Por eso hay una sola
 * implementación y este archivo la cubre una vez.
 */

const fuente = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(`../src/${rel}`, import.meta.url)), 'utf8');

describe('el índice siguiente da la vuelta', () => {
  it('avanza y vuelve al principio', () => {
    expect(indiceSiguiente(0, 3, 1)).toBe(1);
    expect(indiceSiguiente(2, 3, 1)).toBe(0);
  });

  it('retrocede y vuelve al final', () => {
    expect(indiceSiguiente(0, 3, -1)).toBe(2);
    expect(indiceSiguiente(1, 3, -1)).toBe(0);
  });

  it('desde «ninguno» (-1) cae en el primero o en el último', () => {
    // Es lo que hace que abrir el menú con ↓ caiga en el primero y con ↑ en el
    // último, sin ningún caso especial en el componente.
    expect(indiceSiguiente(-1, 3, 1)).toBe(0);
    expect(indiceSiguiente(-1, 3, -1)).toBe(2);
  });

  it('con un solo ítem se queda ahí, no se va a -1', () => {
    expect(indiceSiguiente(0, 1, 1)).toBe(0);
    expect(indiceSiguiente(0, 1, -1)).toBe(0);
  });

  it('sin ítems no hay dónde poner el foco', () => {
    expect(indiceSiguiente(0, 0, 1)).toBe(-1);
  });
});

describe('qué tecla mueve a dónde en un menú', () => {
  it('las flechas mueven de a uno', () => {
    expect(indiceDeTecla('ArrowDown', 0, 3)).toBe(1);
    expect(indiceDeTecla('ArrowUp', 0, 3)).toBe(2);
  });

  it('Home y End van a los extremos', () => {
    expect(indiceDeTecla('Home', 2, 3)).toBe(0);
    expect(indiceDeTecla('End', 0, 3)).toBe(2);
  });

  it('una tecla que no es de navegación devuelve null', () => {
    // `null` y no el índice actual: es lo que le dice al componente que NO
    // llame a preventDefault(), así Tab, Escape y las letras siguen andando.
    for (const tecla of ['Tab', 'Escape', 'Enter', 'a', 'ArrowLeft']) {
      expect(indiceDeTecla(tecla, 0, 3)).toBeNull();
    }
  });

  it('un menú vacío no navega a ninguna parte', () => {
    expect(indiceDeTecla('ArrowDown', -1, 0)).toBeNull();
  });
});

describe('el ciclo de Tab de una capa', () => {
  it('desde el último Tab vuelve al primero, y Shift+Tab al revés', () => {
    expect(indiceDeTab(2, 3, false)).toBe(0);
    expect(indiceDeTab(0, 3, true)).toBe(2);
  });

  it('con el foco en la caja del diálogo entra por el extremo que corresponde', () => {
    expect(indiceDeTab(-1, 3, false)).toBe(0);
    expect(indiceDeTab(-1, 3, true)).toBe(2);
  });

  it('el selector no toma tabindex="-1": es enfocable por programa, no una parada de Tab', () => {
    // La caja del diálogo tiene tabindex={-1} para recibir el foco al abrirse.
    // Si entrara al ciclo, Tab pasaría por el contenedor y no por sus controles.
    expect(SELECTOR_ENFOCABLE).toContain('[tabindex]:not([tabindex="-1"])');
  });
});

describe('las dos pantallas usan la misma implementación (B-14, B-64)', () => {
  it('el menú del listado navega con teclas y devuelve el foco al disparador', () => {
    const src = fuente('components/admin/MenuAcciones.tsx');
    expect(src).toContain("from '@/lib/foco'");
    expect(src).toContain('indiceDeTecla');
    // Sin esto, cerrar con Escape obliga a re-tabular el listado entero.
    expect(src).toContain('disparador.current?.focus()');
  });

  it('el menú no tiene su propia copia del cálculo', () => {
    // La clase que se cerró es «el mismo patrón de teclado a medio hacer en dos
    // lugares»: una copia local del módulo la reabre. Las capas modales van por
    // el describe de abajo, que es más estricto.
    expect(fuente('components/admin/MenuAcciones.tsx')).not.toMatch(
      /%\s*enfocables\.length|%\s*acciones\.length/,
    );
  });
});

/**
 * El cableado de una capa modal vive en **un** lugar — B-210.
 *
 * `src/lib/foco.ts` compartía la aritmética y dejaba el DOM en cada componente,
 * con el argumento de que ahí está el `ref`. Con dos capas eso significó ~40
 * líneas copiadas verbatim, y las dos copias **divergieron en lo que importa**:
 * `DialogoDuplicar` guardaba el callback en un `ref` con deps `[]` —arreglo
 * deliberado y comentado— y `CentroAyuda` se quedó con `[onCerrar]`, mientras
 * `BotonAyuda` le pasa una flecha inline. Resultado: marcar las novedades como
 * leídas remontaba el efecto y le robaba el foco.
 *
 * La lección que vale más que el arreglo: **compartir la mitad fácil de escribir
 * mal no alcanza si la otra mitad también lo es.** La aritmética estaba
 * compartida y el bug apareció igual, en el cableado.
 *
 * Estos `it` son el único lugar donde se verifica **qué hace** el hook. Los
 * componentes solo prueban que lo usan y que no tienen copia propia (ver
 * `tests/duplicar-modal.test.ts`).
 */
describe('el cableado de una capa modal está en un solo lugar — B-210', () => {
  const HOOK = 'components/admin/useCapaModal.ts';
  const CAPAS = ['components/admin/DialogoDuplicar.tsx', 'components/admin/ayuda/CentroAyuda.tsx'];

  /** Sin comentarios ni espacios: afirma la llamada y no la prosa que la cita. */
  const codigo = (rel: string): string =>
    fuente(rel)
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
      .replace(/\s+/g, '');

  it('el hook existe y hay más de una capa que lo usaría', () => {
    // Control positivo: con una sola capa, «todas usan el hook» es una
    // afirmación sobre un conjunto de uno y no prueba nada sobre compartir.
    expect(CAPAS.length).toBeGreaterThanOrEqual(2);
    expect(codigo(HOOK)).toContain('exportfunctionuseCapaModal');
  });

  it('las dos capas lo usan', () => {
    for (const capa of CAPAS) {
      expect(codigo(capa), `${capa} no llama al hook`).toContain('useCapaModal(caja,');
    }
  });

  it('ninguna capa reimplementa el cableado', () => {
    /*
     * La guarda que evita que B-210 vuelva: alcanza con que alguien escriba el
     * `keydown` al lado del hook «porque este caso es distinto» para tener dos
     * comportamientos otra vez. Aplica a **toda** capa de la lista, no solo a la
     * que se estaba mirando cuando se escribió el test.
     */
    for (const capa of CAPAS) {
      for (const propio of [
        "addEventListener('keydown'",
        'document.body.style.overflow',
        'document.activeElement',
        'SELECTOR_ENFOCABLE',
      ]) {
        expect(codigo(capa), `${capa} tiene su propio ${propio}`).not.toContain(propio);
      }
    }
  });

  it('el hook guarda el callback en un ref, que es el arreglo que una copia no tenía', () => {
    /*
     * El corazón de B-210. Sin el ref, el efecto necesita la función en sus
     * dependencias; y como cualquier llamador razonable pasa una flecha inline,
     * eso es «remontarse en cada render del padre»: devolver el foco,
     * re-capturarlo y llevárselo a la caja, más el scroll parpadeando.
     */
    const src = codigo(HOOK);
    expect(src).toContain('cerrar=useRef(alCerrar)');
    expect(src).toContain('cerrar.current=alCerrar');
    expect(src).toContain('cerrar.current()');
    // Las dependencias son solo el ref del contenedor, que es estable. Si acá
    // apareciera `alCerrar`, el bug volvió.
    expect(src).toContain('},[caja]);');
    expect(src).not.toContain('alCerrar]);');
  });

  it('el hook hace las cuatro cosas que una capa necesita', () => {
    const src = codigo(HOOK);
    // Cerrar con Escape, atrapar el Tab, frenar el scroll de atrás y devolver el
    // foco a quien lo tenía. Las cuatro juntas: a alguna de las copias le faltó
    // alguna en algún momento de su historia.
    expect(src).toContain("e.key==='Escape'");
    expect(src).toContain('indiceDeTab(actual,enfocables.length,e.shiftKey)');
    expect(src).toContain("document.body.style.overflow='hidden'");
    expect(src).toContain('anterior?.focus()');
    // Y restaura el overflow previo en vez de asumir que era vacío.
    expect(src).toContain('previo=document.body.style.overflow');
    expect(src).toContain('document.body.style.overflow=previo');
  });
});
