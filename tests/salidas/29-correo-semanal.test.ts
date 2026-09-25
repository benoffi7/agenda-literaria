/**
 * Salida 29: el correo semanal (B-1230).
 *
 * Un barrido de salidas públicas, partido de
 * `tests/barrido-de-salidas-publicas.test.ts` (PRD 6, M-12). El índice de
 * todos está en ese archivo; lo que comparten, en
 * `tests/fixtures/barrido-de-salidas.ts`.
 */
import { describe, expect, it } from 'vitest';
import { toPublic } from '@/lib/toPublic';
import { construirIndice } from '@/lib/eventsJson';
import { boletinSemanal, htmlDelBoletin, textoPlanoDelBoletin } from '@/lib/boletinSemanal';
import { arancelDeTarjeta } from '@/lib/tarjetaPublica';
import { LABELS_CENTINELA, actividadCentinela } from '../fixtures/centinelas';
import { barrer, type Excepcion } from '../fixtures/barrido';

// ───────────────────────────────────────────────────────────────────────────
// El correo semanal — salida 29 (B-1230)
// ───────────────────────────────────────────────────────────────────────────

describe('barrido del correo semanal (§5, salida 29, B-1230)', () => {
  /*
   * El `ahora` cae **adentro** de la ventana de siete días: la primera sesión
   * centinela es el 3 de septiembre de 2026 a las 22:00 UTC (19:00 acá), así que
   * a las 11:00 de ese jueves el borrador la tiene. Con un `ahora` de otra semana
   * `boletinSemanal` devolvería `null` y el barrido correría sobre la nada — que
   * es la forma en que un barrido pasa sin verificar nada.
   */
  const AHORA = new Date('2026-09-03T14:00:00Z');
  const GENERADO_EN = '2026-09-03T12:00:00.000Z';

  const indice = () =>
    construirIndice({
      actividades: [toPublic(actividadCentinela(), 'act_boletin')],
      opciones: {},
      version: '1.8.0+abc1234',
      generadoEn: GENERADO_EN,
    });

  const armar = () => {
    const b = boletinSemanal(indice(), AHORA, LABELS_CENTINELA);
    expect(b, 'el `ahora` quedó fuera de la ventana del correo').not.toBeNull();
    return b!;
  };

  /**
   * **Es la misma lista que el tríptico, y no es casualidad:** las dos salidas se
   * arman desde el mismo índice ya proyectado y dicen la misma fila —«19:00 ·
   * Título · lugar»—. Lo que el índice sí lleva y el correo no tiene por qué
   * mostrar el barrido lo exige ausente: `searchText`, el `resumen` (o sea el
   * centinela de `descripcion`), `organizador.nombre`, `tallerista.nombre`,
   * `tags`, `imagenes.url` y la plataforma.
   *
   * Que la lista sea corta es el punto de **D-801**: el borrador se arma desde
   * `EntradaDeIndice` y no desde el documento, así que el link de la reunión, la
   * dirección, las notas de difusión y los uids **no están en la mano** de este
   * módulo. No se los excluye: no los tiene.
   */
  const PERMITIDO_EN_EL_CORREO: readonly Excepcion[] = [
    {
      nombre: 'el título, que es lo que la fila dice',
      centinelas: ['titulo'],
      porque:
        'una fila del correo es «Título» y debajo «19:00 · Taller · lugar · arancel». La ' +
        '**descripción** no está en esta lista y por eso el barrido la exige ausente: el ' +
        'correo es un cronograma, y quien quiera leer de qué se trata tiene el link.',
    },
    {
      nombre: 'el slug, que es el link al detalle',
      centinelas: ['slug'],
      porque:
        'cada fila enlaza a la página de la actividad (no hay página por encuentro, §2.3), ' +
        'y la URL es **absoluta** porque en un correo no hay origen del que colgar una ruta. ' +
        'El slug sale ahí y otra vez en la `clave`.',
    },
    {
      nombre: 'el id de sesión, adentro de la clave de la fila',
      centinelas: ['sesiones.id'],
      porque:
        'la `clave` es `slug#sesionId`, la `key` de React de la vista previa del panel — con ' +
        'el slug solo, dos encuentros del mismo ciclo en la misma semana serían dos filas ' +
        'iguales. Es el uuid opaco del cliente (trampa 2), sin PII, y ya es público en el eje ' +
        'de encuentros del índice (B-99). **No viaja al correo**: el HTML y el texto plano no ' +
        'la imprimen, solo la usa la pantalla.',
    },
    {
      nombre: 'la etiqueta de la categoría',
      centinelas: ['labels.tipo'],
      porque:
        '§4.4 — la fila dice la **etiqueta** resuelta contra `/opciones`, no el slug crudo, ' +
        'con la misma `etiquetaDe` del listado. Acá ni siquiera viaja el slug: a diferencia ' +
        'del tríptico, el correo no pinta el color del tipo (D-150) y no lo necesita.',
    },
    {
      nombre: 'el lugar y el arancel, los dos vía `tarjetaPublica`',
      centinelas: [
        'sede.nombre',
        'labels.barrio',
        'labels.ciudad',
        'labels.provincia',
        'labels.arancel',
      ],
      porque:
        'la línea de lugar la arma `lugarDeTarjeta` —la misma del listado, del tríptico, de ' +
        'la página de mes, de /pasadas y de los hubs— y el arancel `arancelDeTarjeta`. La ' +
        '**dirección**, las indicaciones y las coordenadas NO están en esta lista: el índice ' +
        'no las lleva y el correo no las necesita — quien va, abre el link. ' +
        '`labels.plataforma` tampoco está, y su ausencia NO es una prohibición: el fixture es ' +
        'híbrido, así que gana la rama de sede y la línea termina en «· y online». En una ' +
        'virtual pura `lugarDeTarjeta` sí imprime «Online por <etiqueta>», que es público ' +
        '(§4.1) — lo que nunca sale es el link de la reunión.',
    },
  ];

  it('sobreviven exactamente los centinelas que una fila del correo necesita', () => {
    const b = armar();
    // Control positivo: el barrido tiene que estar mirando una fila de verdad.
    expect(b.dias.flatMap((d) => d.encuentros)).toHaveLength(1);

    barrer('correo semanal (el borrador)', JSON.stringify(b), PERMITIDO_EN_EL_CORREO);
  });

  it('ni el HTML ni el texto plano publican nada que el borrador no tenga', () => {
    /*
     * Los dos renders son la salida de verdad: lo que se pega en Mailchimp. El
     * `it` de arriba barre la estructura; éste barre **lo que se manda**, que es
     * donde una interpolación de más se cuela sin pasar por ningún tipo.
     *
     * `sesiones.id` sale de la lista: la clave es de la pantalla, no del correo,
     * y el barrido exige en las dos direcciones — si algún día se imprimiera, esto
     * se pone en rojo y hay que decidirlo, que es exactamente lo que se busca.
     */
    const b = armar();
    const permitidoEnElCuerpo = PERMITIDO_EN_EL_CORREO.map((g) => ({
      ...g,
      centinelas: g.centinelas.filter((c) => c !== 'sesiones.id'),
    }));

    barrer('correo semanal (HTML)', htmlDelBoletin(b), permitidoEnElCuerpo);
    barrer('correo semanal (texto plano)', textoPlanoDelBoletin(b), permitidoEnElCuerpo);
  });

  it('el barrido detecta la fuga si alguien mete la entrada entera en la fila', () => {
    /*
     * El control negativo del barrido, igual que en el tríptico: sin esto, una
     * lista de excepciones demasiado ancha pasaría inadvertida.
     */
    const b = armar();
    const entrada = indice().actividades[0]!;
    const conFuga = {
      ...b,
      dias: b.dias.map((d) => ({
        ...d,
        encuentros: d.encuentros.map((e) => ({ ...e, entrada })),
      })),
    };

    let mensaje = '';
    try {
      barrer(
        'correo semanal (mutación: la entrada entera en la fila)',
        JSON.stringify(conFuga),
        PERMITIDO_EN_EL_CORREO,
      );
    } catch (e) {
      mensaje = e instanceof Error ? e.message : String(e);
    }

    expect(mensaje, 'el barrido NO detectó la entrada entera en la fila').not.toBe('');
    expect(mensaje).toContain('FUGA');
    expect(mensaje).toContain('searchText');
  });
});
