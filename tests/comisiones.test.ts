import { describe, expect, it } from 'vitest';
import { comisionVacia, nuevaComisionId, porComision, sinComision, tieneComisiones } from '@/lib/comisiones';
import { formularioLleno } from './fixtures/formulario';
import { sesionVacia } from '@/lib/sesiones';

/**
 * B-181 — «un club de lectura puede darte 4 opciones para sumarte. Pero no son 4
 * encuentros, sino opciones» (el dueño, usando el panel).
 *
 * Acá se verifica el lado del panel: la lista, el agrupado y —lo que más
 * importa— que borrar una opción no deje encuentros colgados.
 */
describe('las comisiones de un ciclo (B-181)', () => {
  describe('el id se genera en el cliente (trampa 2)', () => {
    it('lleva el prefijo `com_` y no es el índice de nada', () => {
      expect(nuevaComisionId()).toMatch(/^com_/);
      expect(comisionVacia().id).toMatch(/^com_/);
    });

    it('dos ids seguidos no colisionan', () => {
      // Es lo que el índice no puede prometer: si el id fuera la posición,
      // borrar la primera opción reapuntaría los encuentros de la segunda.
      const ids = new Set(Array.from({ length: 200 }, () => nuevaComisionId()));
      expect(ids.size).toBe(200);
    });

    it('nace sin nombre: lo escribe quien la creó', () => {
      expect(comisionVacia().etiqueta).toBe('');
      expect(comisionVacia('Martes 19 h').etiqueta).toBe('Martes 19 h');
    });
  });

  describe('tieneComisiones', () => {
    it('pregunta por la lista y no por `esCiclo`', () => {
      // Una actividad puede tener comisiones sin que nadie haya tildado el
      // ciclo, y el schema no lo prohíbe.
      expect(tieneComisiones({ comisiones: [comisionVacia('Martes')] })).toBe(true);
      expect(tieneComisiones({ comisiones: [] })).toBe(false);
      expect(tieneComisiones({})).toBe(false);
    });
  });

  describe('porComision', () => {
    const A = { id: 'com_a', etiqueta: 'Martes' };
    const B = { id: 'com_b', etiqueta: 'Jueves' };
    const s = (id: string, comisionId: string | null) => ({ id, comisionId });

    it('agrupa en el orden de la lista de opciones, no en el de aparición', () => {
      /*
       * El orden es el que el dueño armó en el formulario, y es el que se
       * mantiene igual aunque se reordenen o se borren encuentros. Ordenar por
       * «la primera fecha de cada grupo» haría que la lista se reacomode sola al
       * cancelar un encuentro.
       */
      const { grupos } = porComision([A, B], [s('1', B.id), s('2', A.id), s('3', B.id)]);
      expect(grupos.map((g) => [g.comision.id, g.sesiones.map((x) => x.id)])).toEqual([
        ['com_a', ['2']],
        ['com_b', ['1', '3']],
      ]);
    });

    it('una opción sin encuentros sale igual, con la lista vacía', () => {
      // Quién decide no mostrarla es el consumidor: el view-model público la
      // filtra, y el panel la muestra con «0 encuentros» para poder borrarla.
      const { grupos } = porComision([A, B], [s('1', A.id)]);
      expect(grupos[1]!.sesiones).toEqual([]);
    });

    describe('los huérfanos no se esconden', () => {
      /**
       * Un documento así no se puede publicar —el schema lo rechaza— pero puede
       * llegar editado a mano en la consola de Firestore. La regla es que sus
       * encuentros **se vean**: perder una fila en pantalla es el peor de los dos
       * errores posibles, porque nadie la puede arreglar si no la ve.
       */
      it('el que no tiene opción va a `sinComision`', () => {
        const { sinComision: sueltos } = porComision([A], [s('1', A.id), s('2', null)]);
        expect(sueltos.map((x) => x.id)).toEqual(['2']);
      });

      it('el que apunta a una opción que no existe también', () => {
        const { grupos, sinComision: sueltos } = porComision([A], [s('1', 'com_borrada')]);
        expect(sueltos.map((x) => x.id)).toEqual(['1']);
        expect(grupos[0]!.sesiones).toEqual([]);
      });
    });
  });

  describe('sinComision — borrar la opción y desenganchar sus encuentros', () => {
    const MARTES = { id: 'com_martes', etiqueta: 'Martes 19 h' };
    const JUEVES = { id: 'com_jueves', etiqueta: 'Jueves 19 h' };
    const form = () =>
      formularioLleno({
        comisiones: [MARTES, JUEVES],
        sesiones: [
          { ...sesionVacia(), id: 'ses_1', comisionId: MARTES.id },
          { ...sesionVacia(), id: 'ses_2', comisionId: JUEVES.id },
          { ...sesionVacia(), id: 'ses_3', comisionId: MARTES.id },
        ],
      });

    /**
     * **Las dos mitades van juntas en una sola función, y ése es el punto.**
     * Borrar la opción sin tocar las sesiones deja los `comisionId` apuntando a
     * un id que ya no existe, que es exactamente lo que el schema rechaza al
     * publicar. El que borra desde la UI no tiene por qué acordarse de la
     * segunda mitad.
     */
    it('saca la opción de la lista', () => {
      expect(sinComision(form(), MARTES.id).comisiones).toEqual([JUEVES]);
    });

    it('deja sus encuentros sin opción, y NO los borra', () => {
      /*
       * Son fechas cargadas a mano: que desaparezcan por sacar una etiqueta
       * sería destruir trabajo sin preguntar. Quedan visibles y el schema pide
       * que se les asigne otra antes de publicar.
       *
       * MUTACIÓN PROBADA: con `sesiones` devuelto tal cual —o sea, borrando solo
       * la fila de la lista— este test falla mostrando `com_martes` en dos
       * encuentros de un formulario que ya no tiene esa opción.
       */
      const r = sinComision(form(), MARTES.id);
      expect(r.sesiones.map((s) => [s.id, s.comisionId])).toEqual([
        ['ses_1', null],
        ['ses_2', JUEVES.id],
        ['ses_3', null],
      ]);
    });

    it('no toca los encuentros de las otras opciones', () => {
      const r = sinComision(form(), MARTES.id);
      expect(r.sesiones.find((s) => s.id === 'ses_2')!.comisionId).toBe(JUEVES.id);
    });

    it('borrar un id que no está no cambia nada', () => {
      const antes = form();
      expect(sinComision(antes, 'com_inexistente')).toEqual(antes);
    });
  });
});
