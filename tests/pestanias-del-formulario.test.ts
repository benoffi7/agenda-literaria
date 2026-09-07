/**
 * **Las pestañas del formulario parten el registro de secciones.**
 *
 * El rediseño en pestañas (pedido del dueño el 2026-09-07) introduce un lugar
 * nuevo donde una sección puede quedar huérfana: hasta ahora todas se pintaban
 * apiladas, así que existir en `SECCIONES` y estar en la pantalla eran lo mismo.
 * Con pestañas hay dos listas y una tiene que cubrir a la otra.
 *
 * El modo de falla es caro y silencioso: la barra de acciones nombra la sección
 * donde falta un campo y ofrece llevar hasta él (B-184). Si esa sección no tiene
 * pestaña, el enlace cambia a `undefined` —o a ninguna— y **el campo que falta
 * para publicar no está en ninguna parte de la pantalla**, que es exactamente el
 * problema que B-184 vino a resolver cuando el campo estaba dentro de un acordeón
 * cerrado. Compila, se ve bien, y no se puede publicar sin saber por qué.
 *
 * Por eso lo que se verifica no es «hay nueve pestañas» —eso envejece con el
 * próximo pedido— sino la **propiedad**: cada sección del registro está en
 * exactamente una pestaña.
 */
import { describe, expect, it } from 'vitest';

import { SECCIONES, resumirFaltantes, type IdSeccion } from '@/lib/formulario/camposFaltantes';
import {
  PESTANIAS,
  PRIMERA_PESTANIA,
  faltantesPorPestania,
  pestaniaDe,
} from '@/lib/formulario/pestanias';

describe('las pestañas cubren el registro de secciones, sin huecos ni repetidas', () => {
  it('cada sección está en exactamente una pestaña', () => {
    /*
     * MUTACIÓN PROBADA: agregar una sección a `SECCIONES` sin declararla en
     * `JUNTAS` la deja como pestaña propia y esto sigue verde (que es el default
     * deseado); mandarla a dos pestañas o sacarla del armado deja este caso en
     * rojo nombrando el id.
     */
    const cuantasVeces = new Map<IdSeccion, number>();
    for (const pestania of PESTANIAS) {
      for (const seccion of pestania.secciones) {
        cuantasVeces.set(seccion, (cuantasVeces.get(seccion) ?? 0) + 1);
      }
    }

    const huerfanas = SECCIONES.filter((s) => !cuantasVeces.has(s.id)).map((s) => s.id);
    const repetidas = [...cuantasVeces.entries()].filter(([, n]) => n > 1).map(([id]) => id);
    const intrusas = [...cuantasVeces.keys()].filter(
      (id) => !SECCIONES.some((s) => s.id === id),
    );

    expect(huerfanas, 'secciones sin pestaña: la barra no podría llevar hasta ellas').toEqual([]);
    expect(repetidas, 'secciones en dos pestañas: el campo se pintaría dos veces').toEqual([]);
    expect(intrusas, 'la pestaña pinta una sección que no está en el registro').toEqual([]);
  });

  it('el orden de las pestañas es el del registro', () => {
    /*
     * No es estética: el mensaje de la barra nombra las secciones de arriba hacia
     * abajo —el orden en que se recorre el formulario— y «el primer error» se
     * resuelve por orden del documento. Si las solapas fueran en otro orden, «el
     * primero» de la barra y «el primero» de la pantalla serían distintos.
     */
    const primeras = PESTANIAS.map((p) => p.secciones[0]);
    const esperado = SECCIONES.map((s) => s.id).filter((id) => primeras.includes(id));
    expect(primeras).toEqual(esperado);
    expect(PRIMERA_PESTANIA).toBe(SECCIONES[0]!.id);
  });

  it('cada pestaña tiene un título, y el de las de una sección es el de su sección', () => {
    for (const pestania of PESTANIAS) {
      expect(pestania.titulo, `la pestaña ${pestania.id} no tiene título`).toBeTruthy();
      if (pestania.secciones.length === 1) {
        const seccion = SECCIONES.find((s) => s.id === pestania.secciones[0]);
        expect(pestania.titulo, 'la solapa dice algo distinto que el encabezado').toBe(
          seccion!.titulo,
        );
      }
    }
  });

  it('la pestaña que junta dos NO se llama como ninguna de las dos', () => {
    /*
     * La única pestaña con dos secciones es «Vista previa», y su título tiene que
     * ser declarado: llamarla «Texto para publicar» o «Vista previa del evento»
     * escondería la otra mitad detrás de un nombre que no la nombra.
     */
    const juntas = PESTANIAS.filter((p) => p.secciones.length > 1);
    for (const pestania of juntas) {
      const titulos = pestania.secciones.map(
        (id) => SECCIONES.find((s) => s.id === id)!.titulo,
      );
      expect(titulos, 'la solapa junta dos secciones y usa el título de una').not.toContain(
        pestania.titulo,
      );
    }
  });
});

describe('de una sección a su pestaña', () => {
  it('contesta para todas las secciones del registro', () => {
    // Es lo que hace `irASeccion`: sin esto, el enlace de la barra no sabría a
    // qué solapa cambiar.
    for (const seccion of SECCIONES) {
      expect(pestaniaDe(seccion.id), `sin pestaña: ${seccion.id}`).toBeTruthy();
    }
  });

  it('y devuelve `undefined` para un id que no existe', () => {
    expect(pestaniaDe('inventada' as IdSeccion)).toBeUndefined();
  });
});

describe('el número de cada solapa suma las secciones que tiene adentro', () => {
  it('reparte los faltantes por pestaña', () => {
    /*
     * **Es la mitad que hace que las pestañas no escondan nada.** Con todo
     * apilado, un campo pendiente se encontraba scrolleando; con nueve pestañas,
     * ocho están fuera de la pantalla, así que el número de la solapa es lo único
     * que dice dónde mirar.
     */
    const resumen = resumirFaltantes(['titulo', 'descripcion', 'sesiones.0.inicio']);
    const porPestania = faltantesPorPestania(resumen);
    expect(porPestania['que-es']).toBe(2);
    expect(porPestania['encuentros']).toBe(1);
    expect(porPestania['donde']).toBeUndefined();
  });

  it('sin faltantes no hay ningún número', () => {
    expect(faltantesPorPestania(resumirFaltantes([]))).toEqual({});
  });

  it('una ruta que no está en el mapa de campos no inventa una pestaña', () => {
    /*
     * `resumirFaltantes` las deja en `sinUbicar` a propósito —un campo nuevo sin
     * nombre no puede desaparecer— y acá lo que importa es que no se cuente en
     * ninguna solapa: un número que no corresponde a nada visible es peor que no
     * tener número, porque manda a buscar lo que no está.
     */
    const resumen = resumirFaltantes(['campo.que.nadie.declaro']);
    expect(resumen.sinUbicar).toHaveLength(1);
    expect(faltantesPorPestania(resumen)).toEqual({});
  });
});
