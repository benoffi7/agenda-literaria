/**
 * Salida 2: el evento de Calendar (§5.1, §7.4).
 *
 * Un barrido de salidas públicas, partido de
 * `tests/barrido-de-salidas-publicas.test.ts` (PRD 6, M-12). El índice de
 * todos está en ese archivo; lo que comparten, en
 * `tests/fixtures/barrido-de-salidas.ts`.
 */
import { describe, expect, it } from 'vitest';
import { construirEvento } from '../../functions/calendario.js';
import { ENCUENTROS, LABELS_CENTINELA, actividadCentinela, conDosFormasDeCursar, conDosSedes, conLinkPublico } from '../fixtures/centinelas';
import { barrer } from '../fixtures/barrido';
import { PERMITIDO_EN_EVENTO_DE_CALENDAR } from '../fixtures/barrido-de-salidas';

describe('barrido del evento de Calendar (§5.1, §7.4)', () => {
  const actividad = actividadCentinela();

  it('sobreviven exactamente los centinelas permitidos, en los 8 encuentros', () => {
    // Los ocho: la descripción se arma con datos de la sesión Y de la actividad
    // (§7.2), así que un bloque que solo aparece en el primero —o solo en el
    // último— no se ve barriendo uno.
    expect(actividad.sesiones).toHaveLength(ENCUENTROS);
    for (const sesion of actividad.sesiones) {
      const evento = construirEvento(actividad, sesion, LABELS_CENTINELA);
      barrer(
        `evento de Calendar (${sesion.id})`,
        JSON.stringify(evento),
        PERMITIDO_EN_EVENTO_DE_CALENDAR,
      );
    }
  });

  it('con `urlPublica: true` el link entra a la lista, y solo así', () => {
    const abierta = actividadCentinela(conLinkPublico());
    barrer(
      'evento de Calendar (link de reunión publicado a mano)',
      JSON.stringify(construirEvento(abierta, abierta.sesiones[0], LABELS_CENTINELA)),
      [
        ...PERMITIDO_EN_EVENTO_DE_CALENDAR,
        {
          nombre: 'el link de la reunión, publicado a mano',
          centinelas: ['online.url'],
          porque:
            'trampa 5 — el §7.4 dice que el link no va nunca; se respeta el flag del modelo ' +
            'por decisión explícita del dueño, con default `false` y aviso en el formulario.',
        },
      ],
    );
  });

  it('con dos formas de cursar sale el link de la que lo tildó, y solo ese (B-224)', () => {
    const dos = actividadCentinela(conDosFormasDeCursar());
    barrer(
      'evento de Calendar (dos formas de cursar)',
      JSON.stringify(construirEvento(dos, dos.sesiones[0], LABELS_CENTINELA)),
      [
        ...PERMITIDO_EN_EVENTO_DE_CALENDAR,
        {
          nombre: 'la segunda forma de cursar',
          centinelas: ['modalidades.2.online.plataforma', 'modalidades.2.online.url'],
          porque:
            'B-224 — el bloque «Dónde» sale una vez por fila. La plataforma es pública siempre; ' +
            'el link, solo porque **esa fila** tildó `urlPublica`. El de la primera sigue ' +
            'ausente, que es lo que verifica que el flag se lee por fila y no del derivado.',
        },
      ],
    );
  });

  it('con dos sedes el evento nombra las dos direcciones (B-224)', () => {
    const dos = actividadCentinela(conDosSedes());
    barrer(
      'evento de Calendar (dos sedes)',
      JSON.stringify(construirEvento(dos, dos.sesiones[0], LABELS_CENTINELA)),
      [
        ...PERMITIDO_EN_EVENTO_DE_CALENDAR,
        {
          nombre: 'la segunda sede',
          centinelas: ['modalidades.2.sede.nombre', 'modalidades.2.sede.direccion'],
          porque:
            'B-224 — el evento nombra cada forma de cursar con su lugar. El campo `location`, en ' +
            'cambio, lleva **una** dirección: la derivada, o sea la de la primera fila.',
        },
      ],
    );
  });

  it('sin labels el evento muestra el slug desSlugeado, y sigue sin filtrar nada', () => {
    // `syncCalendar` puede quedarse sin `/opciones/*` (un slug que nadie registró):
    // ahí `desSlug` deriva la etiqueta del propio slug. Es el mismo texto público,
    // así que la lista de excepciones cambia solo de columna: salen los slugs y no
    // las etiquetas.
    const evento = construirEvento(actividad, actividad.sesiones[0], {});
    barrer('evento de Calendar (sin /opciones)', JSON.stringify(evento), [
      ...PERMITIDO_EN_EVENTO_DE_CALENDAR.filter((g) => g.nombre !== 'etiquetas de /opciones'),
      {
        nombre: 'taxonomías sin etiqueta registrada',
        centinelas: ['sede.barrio', 'arancel.tipo', 'online.plataforma', 'tags'],
        porque:
          '`desSlug` es el último recurso del §4.1 cuando el slug no está en `/opciones/*`: ' +
          'muestra el slug capitalizado en lugar de la etiqueta. Es el mismo dato público ' +
          'con otra tipografía, no información nueva.',
      },
    ]);
  });
});
