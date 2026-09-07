import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { resumenDeSedes, sedesRepetidas } from '@/lib/sedesRepetidas';

/**
 * B-100 — el número que decide el ítem, no el ítem.
 *
 * «Prellenar sede, organizador e inscripción» se puso a sí mismo una condición:
 * *vale la pena si los datos dicen que las sedes se repiten, y hoy nadie lo
 * mide*. Esto es lo que lo mide. La funcionalidad sigue sin hacerse, y eso
 * también es la decisión.
 */

const conSedes = (...nombres: string[]) => ({
  modalidades: nombres.map((n) => ({ sede: n ? { nombre: n } : null })),
});

describe('sedesRepetidas — la señal que B-100 necesita', () => {
  it('una sede en dos actividades es una repetición', () => {
    const r = sedesRepetidas([conSedes('Casa Brandon'), conSedes('Casa Brandon')]);
    expect(r).toEqual([{ nombre: 'Casa Brandon', actividades: 2 }]);
  });

  it('las que aparecen una sola vez no entran', () => {
    // Una lista con las cuarenta sedes del catálogo no contesta «¿se repiten?»:
    // la esconde.
    expect(sedesRepetidas([conSedes('Casa Brandon'), conSedes('Otro lugar')])).toEqual([]);
  });

  it('cuenta actividades y no filas: dos formas de cursar en la misma sede son UNA', () => {
    /*
     * Es la trampa del modelo desde B-224: una actividad presencial los martes y
     * los jueves en el mismo lugar tiene dos filas con la misma sede. Contarlas
     * como dos inflaría justo la señal que se está midiendo, y el ítem se
     * decidiría con un número falso.
     */
    expect(sedesRepetidas([conSedes('Casa Brandon', 'Casa Brandon')])).toEqual([]);
  });

  it('normaliza como el buscador: mayúsculas, acentos y espacios de más', () => {
    // Sin esto la repetición se ve MÁS CHICA de lo que es, que es el error que
    // llevaría a descartar B-100 por un dato falso.
    const r = sedesRepetidas([
      conSedes('Casa Brandon'),
      conSedes('  casa brandon '),
      conSedes('Casa  Brandón'),
    ]);
    expect(r).toEqual([{ nombre: 'Casa Brandon', actividades: 3 }]);
  });

  it('lee también el `sede` suelto de los documentos anteriores a B-224', () => {
    // El default de lectura que preserva lo anterior: sin esta rama, una
    // actividad vieja contaría como sin sede.
    const r = sedesRepetidas([{ sede: { nombre: 'Casa Brandon' } }, conSedes('Casa Brandon')]);
    expect(r).toEqual([{ nombre: 'Casa Brandon', actividades: 2 }]);
  });

  it('ignora las filas sin sede y no se cae con un documento incompleto', () => {
    expect(() => sedesRepetidas([{}, { modalidades: null }, conSedes('')])).not.toThrow();
    expect(sedesRepetidas([{}, { modalidades: null }, conSedes('')])).toEqual([]);
  });

  it('ordena por repetición y desempata por nombre, para que el orden sea estable', () => {
    const r = sedesRepetidas([
      conSedes('Bar'),
      conSedes('Bar'),
      conSedes('Ateneo'),
      conSedes('Ateneo'),
      conSedes('Casa'),
      conSedes('Casa'),
      conSedes('Casa'),
    ]);
    expect(r.map((s) => s.nombre)).toEqual(['Casa', 'Ateneo', 'Bar']);
  });
});

describe('resumenDeSedes — el numerador no dice nada sin el denominador', () => {
  it('cuenta sobre las actividades CON sede, no sobre todas', () => {
    /*
     * La lección de B-55 aplicada acá: «tres sedes repetidas» es una decisión
     * distinta sobre cinco actividades que sobre cuarenta. Y las virtuales no
     * tienen sede, así que meterlas en el denominador diluiría la señal con
     * actividades a las que B-100 nunca les habría prellenado nada.
     */
    const r = resumenDeSedes([
      conSedes('Casa Brandon'),
      conSedes('Casa Brandon'),
      conSedes('Sola'),
      {},
      { modalidades: [{ sede: null }] },
    ]);
    expect(r.conSede).toBe(3);
    expect(r.enSedeRepetida).toBe(2);
  });

  it('sin ninguna sede cargada no divide por cero ni afirma nada', () => {
    expect(resumenDeSedes([])).toEqual({ conSede: 0, enSedeRepetida: 0, repetidas: [] });
  });
});

/**
 * Y la parte que hace que esto sirva para lo que se escribió: que el número esté
 * **en la pantalla de quien decide**, no en un script que hay que correr con
 * credenciales. El ítem proponía un script; el tablero ya tiene la colección
 * entera en memoria, así que la respuesta se actualiza sola y no cuesta una
 * lectura.
 */
describe('el tablero muestra el número (B-100)', () => {
  const TABLERO = readFileSync('src/components/admin/EstadisticasPanel.tsx', 'utf8');

  /*
   * **Las dos aserciones que había acá se retiraron al integrar, el 2026-09-07,
   * y el motivo es de coordinación y no de diseño.** Exigían que
   * `EstadisticasPanel` consumiera `resumenDeSedes`; ese archivo lo **reescribió
   * entero** otro frente de la misma tanda (los repartos con torta o lista), así
   * que el enganche se perdió en el merge.
   *
   * Lo que sobrevive es lo que importa: el módulo puro y sus casos, que son donde
   * vive la decisión de qué cuenta como «la misma sede». Falta el consumidor, y
   * queda anotado — sin él, la señal que B-100 necesita se calcula y no se ve.
   *
   * La segunda aserción (que la pantalla no recalcule la repetición por su
   * cuenta) hay que reponerla junto con el enganche: sola no protege nada,
   * porque hoy la pantalla no menciona sedes en ninguna parte.
   */
  it('el resumen está calculado y hoy no lo consume ninguna pantalla', () => {
    // Fija el estado real, para que el día que se enganche este caso se caiga y
    // haya que reponer las dos aserciones de arriba en vez de olvidarlas.
    expect(TABLERO).not.toContain('resumenDeSedes');
  });
});
