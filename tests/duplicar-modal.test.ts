import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CASILLAS_COPIA, SIEMPRE_AL_DUPLICAR } from '@/lib/duplicar';

/**
 * B-199 — el cableado del modal de duplicar.
 *
 * Lo que decide qué se copia es `duplicar.ts` y se verifica en
 * `tests/duplicar.test.ts` como lógica pura. Acá se verifica lo otro, que es lo
 * que ese archivo no puede ver: que el listado **abra la capa** en vez de
 * duplicar de una, que la capa se pueda cerrar con el teclado sin dejar el foco
 * en la nada, y que sea usable con el dedo.
 *
 * Se leen los fuentes como texto porque el panel no tiene tests de componentes
 * (`docs/05-patrones.md`): importar el `.tsx` arrastraría React para leer cuatro
 * llamadas.
 */

/** El fuente sin comentarios (ni de bloque, ni de línea, ni de JSX). */
const sinComentarios = (ruta: string): string =>
  readFileSync(ruta, 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

/**
 * El código de un archivo **sin comentarios y sin espacios**, para poder afirmar
 * una llamada y no un nombre: sin colapsar espacios lo satisface el `import`, y
 * sin quitar comentarios lo satisface la prosa — y este repo escribe comentarios
 * largos que citan código. Es el helper de `tests/autoguardado.test.ts`, copiado
 * por la misma razón por la que ese lo copió.
 */
const codigoSinEspacios = (ruta: string): string => sinComentarios(ruta).replace(/\s+/g, '');

const MODAL = 'src/components/admin/DialogoDuplicar.tsx';
const LISTADO = 'src/components/admin/ListaActividades.tsx';
const MENU = 'src/components/admin/MenuAcciones.tsx';

describe('el listado abre la capa en vez de duplicar de una (B-199)', () => {
  it('«Duplicar» del menú ⋯ no llama al duplicador: abre la capa', () => {
    const listado = codigoSinEspacios(LISTADO);
    // La acción del menú y el render de la capa.
    expect(listado).toContain("{label:'Duplicar',onSelect:()=>duplicar(a)");
    expect(listado).toContain('<DialogoDuplicar');
    // Y lo que arma la lista de casillas es la función del módulo, no una lista
    // escrita a mano en la pantalla (la clase de B-75).
    expect(listado).toContain('casillasAplicables(form)');
  });

  it('sin ninguna casilla que aplique duplica directo, sin cobrar un click de peaje', () => {
    expect(codigoSinEspacios(LISTADO)).toContain(
      'if(casillas.length===0){confirmarDuplicado(a,form);return;}',
    );
  });

  it('la elección viaja al duplicador: la pantalla no rearma la copia por su cuenta', () => {
    const listado = codigoSinEspacios(LISTADO);
    // `copiar` es el objeto que devolvió la capa. Si la pantalla filtrara campos
    // por su cuenta, habría dos lugares donde vive la decisión y ninguno sería
    // el bueno — el default del módulo dejaría de ser el que manda.
    expect(listado).toContain('duplicarActividadForm(form,{');
    expect(listado).toContain('copiar,');
    expect(listado).toContain('onConfirmar={(copiar)=>');
  });

  it('la medición cuenta las copias hechas y no las que se cancelaron (§9)', () => {
    const listado = codigoSinEspacios(LISTADO);
    // El cuerpo de cada función, aislado: atar el chequeo al orden de las líneas
    // lo rompería el formateador sin que nada haya cambiado de verdad.
    const cuerpo = (nombre: string): string => {
      const m = new RegExp(`const${nombre}=\\([\\s\\S]*?\\n?\\};`).exec(
        listado.replace(/;/g, ';\n'),
      );
      expect(m, `no se encontró ${nombre} en el listado`).not.toBeNull();
      return m![0];
    };
    expect(cuerpo('confirmarDuplicado')).toContain("medirFuncion('actividad-duplicar'");
    // Abrir la capa no es duplicar: si midiera acá, la serie contaría las copias
    // pensadas y canceladas junto con las hechas.
    expect(cuerpo('duplicar')).not.toContain('medirFuncion');
  });
});

describe('la capa de duplicar se cierra sin dejar el foco en la nada (B-14, B-64)', () => {
  /*
   * B-210 — estos `it` se reescribieron cuando el cableado se mudó a
   * `useCapaModal`, y **cómo rompieron es el punto**: buscaban
   * `e.key==='Escape'` dentro de `DialogoDuplicar.tsx`, así que un refactor que
   * mejora el código los pone en rojo. Es la tercera vez que un chequeo que lee
   * el fuente termina midiendo un archivo que ya no tiene lo que busca
   * (`docs/10-salud-del-codigo.md`, problema 1).
   *
   * No se los repuntó al archivo nuevo: eso sería el mismo chequeo frágil con
   * otra ruta. Ahora afirman la **propiedad** —que la capa use el hook
   * compartido y no tenga cableado propio—, y el detalle de qué hace el hook se
   * verifica una sola vez, en `tests/foco.test.ts`. Cubre además a la próxima
   * capa que alguien escriba, que es lo que ninguna de las dos versiones
   * anteriores hacía.
   */
  it('el cableado sale del hook compartido, no de una copia local', () => {
    const modal = codigoSinEspacios(MODAL);
    expect(modal).toContain('useCapaModal(caja,onCancelar)');
    expect(modal).toContain("from'@/lib/capaModal'");
  });

  it('y ese «donde estaba» es el "⋯" de la fila, no el ítem del menú que se desmonta', () => {
    /*
     * El ítem del menú desaparece al elegirlo, así que el `activeElement` que la
     * capa memoriza tiene que ser el disparador. `MenuAcciones` lo devuelve
     * **antes** de disparar la acción, y solo para las acciones que lo piden: una
     * que cambia de vista no gana nada enfocando un botón que se va.
     */
    expect(codigoSinEspacios(LISTADO)).toContain('devuelveFoco:true');
    expect(codigoSinEspacios(MENU)).toContain('if(a.devuelveFoco)cerrarYVolverAlDisparador();');
  });

  it('no tiene cableado de capa propio: ni teclado, ni scroll, ni foco a mano', () => {
    /*
     * El anti-patrón concreto, y lo que se busca acá es su **ausencia**: que
     * nadie vuelva a escribir el `keydown`, el `overflow` del body o el
     * `activeElement` al lado del hook «porque este caso es distinto». Es la
     * clase que cerró B-64 —el mismo patrón de teclado a medio hacer en dos
     * pantallas— y la que reabrió B-210 cuando las dos copias divergieron.
     */
    const modal = codigoSinEspacios(MODAL);
    for (const propio of [
      'SELECTOR_ENFOCABLE',
      "addEventListener('keydown'",
      'document.body.style.overflow',
      'document.activeElement',
    ]) {
      expect(modal, `${propio} tendría que venir del hook`).not.toContain(propio);
    }
    expect(modal).not.toMatch(/%\s*enfocables\.length/);
  });

  it('es un diálogo para el lector de pantalla, no un div que aparece', () => {
    const modal = codigoSinEspacios(MODAL);
    expect(modal).toContain('role="dialog"');
    expect(modal).toContain('aria-modal="true"');
    expect(modal).toContain('aria-labelledby={idTitulo}');
  });
});

describe('la capa de duplicar se puede usar con el dedo', () => {
  it('las filas de casilla mantienen el blanco táctil de 44px', () => {
    // El cuadradito nativo mide 13px y estas filas quedan pegadas una a otra:
    // sin altura mínima en el label entero se erra el toque.
    expect(codigoSinEspacios(MODAL)).toContain('min-h-touch');
  });

  it('el texto arranca en 16px y baja a 14 desde sm: si no, iOS hace zoom al enfocar', () => {
    const clases = [...sinComentarios(MODAL).matchAll(/className="([^"]*)"/g)].map((m) => m[1]!);
    // Sin esto el chequeo pasaría por vacío el día que las clases se muevan a
    // otra forma de atributo.
    expect(clases.length).toBeGreaterThan(3);
    for (const c of clases.filter((c) => /\btext-base\b/.test(c))) {
      expect(c, `«${c}» se queda en 16px también en escritorio`).toMatch(/\bsm:text-sm\b/);
    }
  });

  it('los botones salen de las clases compartidas, no escritas a mano', () => {
    const modal = codigoSinEspacios(MODAL);
    expect(modal).toContain('${claseBotonPrimario}');
    expect(modal).toContain('${claseBotonSecundario}');
    // El modo de falla es un botón con sus propios colores: dos acentos
    // distintos en dos pantallas, y el `min-h-touch` del blanco perdido.
    expect(sinComentarios(MODAL)).not.toContain('bg-acento text-white');
  });

  it('cada casilla se ve con su explicación, y la letra chica de lo que pasa siempre', () => {
    const modal = codigoSinEspacios(MODAL);
    expect(modal).toContain('{c.label}');
    expect(modal).toContain('{c.ayuda}');
    // Lo que pasa igual, tildado lo que se tilde (D-17, D-18, §7.3): el lugar
    // para leerlo es antes de duplicar, no al descubrirlo en el formulario.
    expect(modal).toContain('SIEMPRE_AL_DUPLICAR.map');
    expect(SIEMPRE_AL_DUPLICAR.length).toBeGreaterThan(2);
    expect(CASILLAS_COPIA.length).toBeGreaterThan(2);
  });
});
