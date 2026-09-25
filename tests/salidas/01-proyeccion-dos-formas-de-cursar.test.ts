/**
 * Salida 1: la proyección con dos formas de cursar (B-224).
 *
 * Un barrido de salidas públicas, partido de
 * `tests/barrido-de-salidas-publicas.test.ts` (PRD 6, M-12). El índice de
 * todos está en ese archivo; lo que comparten, en
 * `tests/fixtures/barrido-de-salidas.ts`.
 */
import { describe, it } from 'vitest';
import { toPublic } from '@/lib/toPublic';
import { actividadCentinela, conDosFormasDeCursar, conDosSedes } from '../fixtures/centinelas';
import { barrer } from '../fixtures/barrido';
import { PERMITIDO_EN_LA_PROYECCION } from '../fixtures/barrido-de-salidas';

describe('barrido de la proyección con dos formas de cursar (B-224)', () => {
  /**
   * El caso que la lista hace posible y que una sola fila no puede ver: los tres
   * derivados salen de la **primera** fila, así que un cambio que leyera el flag
   * del derivado —o que copiara la fila con un spread— publicaría el link de la
   * segunda sin que nada se ponga rojo.
   */
  it('sale el link de la fila que lo tildó, y NO el de la que no', () => {
    const dos = actividadCentinela(conDosFormasDeCursar());
    barrer('proyección (dos formas de cursar)', JSON.stringify(toPublic(dos, 'act_dos')), [
      ...PERMITIDO_EN_LA_PROYECCION,
      {
        nombre: 'la segunda forma de cursar',
        centinelas: ['modalidades.2.id', 'modalidades.2.online.plataforma'],
        porque:
          'B-224 — la segunda fila es una forma de cursar más: su plataforma es pública igual ' +
          'que la de la primera, y el id es el uuid del §3.1. El **link** de esta fila entra en ' +
          'el grupo de abajo, y el de la primera NO está en ninguna lista: ese es el punto.',
      },
      {
        nombre: 'el link de la segunda fila, publicado a mano',
        centinelas: ['modalidades.2.online.url'],
        porque:
          'trampa 5 — sale SOLO porque **esa fila** tiene `urlPublica: true`. El de la primera ' +
          'sigue en `false` y el barrido lo exige ausente: si `onlinePublico` leyera el flag del ' +
          'derivado en lugar del de la fila, saldrían los dos y esto fallaría.',
      },
    ]);
  });

  it('con dos sedes salen las dos direcciones', () => {
    const dos = actividadCentinela(conDosSedes());
    barrer('proyección (dos sedes)', JSON.stringify(toPublic(dos, 'act_sedes')), [
      ...PERMITIDO_EN_LA_PROYECCION,
      {
        nombre: 'la segunda sede',
        centinelas: [
          'modalidades.2.id',
          'modalidades.2.sede.nombre',
          'modalidades.2.sede.direccion',
        ],
        porque:
          'B-224 — sin la dirección de la segunda forma de cursar, la mitad de la gente no sabe ' +
          'a dónde ir. La **derivada** sigue siendo la de la primera fila, que es la que va al ' +
          'campo que dibuja el mapa.',
      },
    ]);
  });
});
