/**
 * B-133 — la lista de «arrobar», que estaba modelada como string.
 *
 * El bug no era el `split`: era que una lista viajaba como texto y se
 * reconstruía en cada tecla, así que la coma se borraba sola en el momento de
 * escribirla. Estos tests fijan el comportamiento de la lista como lista.
 */
import { describe, expect, it } from 'vitest';
import { agregarChips, quitarChip, separarPegado, traeSeparador } from '@/lib/formulario/chips';

describe('separar lo que se pega o se tipea', () => {
  it('corta por coma, punto y coma, enter y tab', () => {
    expect(separarPegado('@a, @b; @c\n@d\t@e')).toEqual(['@a', '@b', '@c', '@d', '@e']);
  });

  it('no corta por espacio: hay nombres con espacios', () => {
    // Cortar por espacio partiría "Casa Brandon" a la mitad mientras se escribe,
    // que es el mismo tipo de daño que hacía el bug original.
    expect(separarPegado('Casa Brandon')).toEqual(['Casa Brandon']);
  });

  it('descarta los vacíos que dejan los separadores de más', () => {
    expect(separarPegado(', , @a,,')).toEqual(['@a']);
    expect(separarPegado('   ')).toEqual([]);
  });

  it('reconoce cuándo hay que confirmar', () => {
    expect(traeSeparador('@casabrandon,')).toBe(true);
    expect(traeSeparador('@casabrandon')).toBe(false);
    // El espacio no confirma: se sigue escribiendo.
    expect(traeSeparador('Casa ')).toBe(false);
  });
});

describe('agregar sin repetir', () => {
  it('agrega en orden y conserva lo que ya estaba', () => {
    expect(agregarChips(['@a'], '@b, @c')).toEqual(['@a', '@b', '@c']);
  });

  it('la misma cuenta escrita distinto no entra dos veces', () => {
    // El error real: volver sobre la actividad meses después y agregar la misma
    // cuenta con otra capitalización o sin el arroba.
    expect(agregarChips(['@CasaBrandon'], 'casabrandon')).toEqual(['@CasaBrandon']);
    expect(agregarChips(['casabrandon'], '@casabrandon')).toEqual(['casabrandon']);
    expect(agregarChips(['@a'], '@A')).toEqual(['@a']);
  });

  it('no repite dentro de lo que se pega de una vez', () => {
    expect(agregarChips([], '@a, @A, a')).toEqual(['@a']);
  });

  it('guarda lo que se escribió, no una versión normalizada', () => {
    // Se compara normalizado y se guarda tal cual: forzar el arroba rompería los
    // handles que no son de Instagram, y quitarlo perdería lo que alguien puso.
    expect(agregarChips([], '@Casa_Brandon')).toEqual(['@Casa_Brandon']);
    expect(agregarChips([], 'editorial sin arroba')).toEqual(['editorial sin arroba']);
  });
});

describe('quitar', () => {
  it('saca el de esa posición', () => {
    expect(quitarChip(['@a', '@b', '@c'], 1)).toEqual(['@a', '@c']);
  });

  it('fuera de rango no cambia nada y no muta', () => {
    const original = ['@a'];
    expect(quitarChip(original, 5)).toEqual(['@a']);
    expect(quitarChip(original, -1)).toEqual(['@a']);
    expect(quitarChip(original, 0)).not.toBe(original);
    expect(original).toEqual(['@a']);
  });

  it('el caso del Backspace: saca el último', () => {
    const lista = ['@a', '@b'];
    expect(quitarChip(lista, lista.length - 1)).toEqual(['@a']);
  });
});
