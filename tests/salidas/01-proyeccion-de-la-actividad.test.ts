/**
 * Salida 1: la proyección de la actividad (§5.2, `toPublic`).
 *
 * Un barrido de salidas públicas, partido de
 * `tests/barrido-de-salidas-publicas.test.ts` (PRD 6, M-12). El índice de
 * todos está en ese archivo; lo que comparten, en
 * `tests/fixtures/barrido-de-salidas.ts`.
 */
import { describe, it } from 'vitest';
import { toPublic } from '@/lib/toPublic';
import { CENTINELA, actividadCentinela, conLinkPublico } from '../fixtures/centinelas';
import { barrer } from '../fixtures/barrido';
import { PERMITIDO_EN_LA_PROYECCION } from '../fixtures/barrido-de-salidas';

describe('barrido de la proyección de la actividad (§5.2, `toPublic`)', () => {
  it('sobreviven exactamente los centinelas permitidos', () => {
    const publica = toPublic(actividadCentinela(), 'act_centinela');
    barrer('proyección de la actividad (toPublic)', JSON.stringify(publica), PERMITIDO_EN_LA_PROYECCION);
  });

  it('un documento anterior a la galería publica el `imagenUrl` viejo y nada más', () => {
    // B-167 / D-125 — el default de lectura convierte el campo viejo en una lista
    // de un elemento. El centinela de `imagenUrl` pasa a estar permitido y los de
    // la galería desaparecen porque no están en la entrada.
    const legacy = actividadCentinela({
      imagenes: undefined,
      imagenUrl: CENTINELA.imagenUrl,
    });
    barrer('proyección (documento anterior a B-167)', JSON.stringify(toPublic(legacy, 'act_viejo')), [
      ...PERMITIDO_EN_LA_PROYECCION.filter((g) => g.nombre !== 'galería'),
      {
        nombre: 'la imagen del campo viejo',
        centinelas: ['imagenUrl'],
        porque:
          'D-125 — el default de lectura la convierte en la única fila de la galería, con ' +
          'id determinístico `img_legacy`. Es la misma URL que se publicaba antes de B-167.',
      },
    ]);
  });

  it('un tallerista sin nombre no publica NADA de él, ni la bio ni el Instagram (B-861)', () => {
    /*
     * **La hermana de B-854 del lado de la proyección**, y el caso que la vuelve
     * medible: la cáscara `{ nombre: '', … }`.
     *
     * `formADocumento` escribe `tallerista: null` cuando no hay nombre, así que
     * esta forma no la produce el panel: la produce un documento **anterior** a
     * esa regla, uno restaurado del historial, o una edición desde la consola de
     * Firestore. Hasta B-861 `toPublic` miraba si el objeto existe, así que media
     * ficha cargada —la bio escrita, el nombre todavía no— **publicaba la bio**,
     * que es texto sobre una persona, en la salida más barata de cosechar (D-129).
     *
     * El fixture le deja los dos centinelas puestos y le vacía el nombre: si la
     * condición volviera a ser el objeto, los dos reaparecen y el barrido lo dice
     * por la dirección de FUGA, que es la que importa. `tallerista.nombre` sale
     * del grupo «quién» por la otra dirección: con la cáscara no hay nombre que
     * publicar, así que exigirlo presente sería pedir que salga una cadena vacía.
     */
    const cascara = actividadCentinela({
      tallerista: {
        nombre: '',
        bio: CENTINELA['tallerista.bio'],
        instagram: CENTINELA['tallerista.instagram'],
      },
    });
    barrer(
      'proyección (tallerista sin nombre)',
      JSON.stringify(toPublic(cascara, 'act_cascara')),
      [
        ...PERMITIDO_EN_LA_PROYECCION.filter((g) => g.nombre !== 'quién'),
        {
          nombre: 'quién, sin el tallerista',
          centinelas: ['organizador.nombre', 'organizador.instagram', 'organizador.web'],
          porque:
            'B-861 — el organizador sale como siempre; del tallerista no sale nada porque ' +
            'no tiene nombre, y «hay tallerista» es que tenga nombre (B-854). Las tres ' +
            'rutas de `tallerista.*` quedan fuera de la lista a propósito: es la ausencia ' +
            'que este caso mide.',
        },
      ],
    );
  });

  it('con `urlPublica: true` el link de la reunión entra a la lista, y solo así', () => {
    // Desvío consciente del §5.2 decidido por el dueño: el modelo tiene el flag y
    // el formulario su casilla. El default sigue siendo `false` — el caso base de
    // arriba exige que el centinela del link NO salga.
    const abierta = actividadCentinela(conLinkPublico());
    barrer('proyección (link de reunión publicado a mano)', JSON.stringify(toPublic(abierta, 'act_abierta')), [
      ...PERMITIDO_EN_LA_PROYECCION,
      {
        nombre: 'el link de la reunión, publicado a mano',
        centinelas: ['online.url'],
        porque:
          'trampa 5 — sale SOLO con `urlPublica: true`, que es una acción deliberada por ' +
          'actividad. El caso base de este mismo archivo exige que con el default no salga.',
      },
    ]);
  });
});
