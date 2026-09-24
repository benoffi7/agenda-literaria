/**
 * **El registro de los campos de Instagram contra la tabla de docs/03, y el
 * barrido contra sí mismo** — B-1590, B-1780.
 *
 * El registro vive en `tests/fixtures/campos-de-instagram.ts` y cada salida lo
 * recorre en su propio test (`calendario`, `textoRedes`, `detallePublico`). Acá
 * queda lo que no es de ninguna salida: que el registro sea la tabla, fila por
 * fila, y que el barrido ponga en rojo lo que dice que pone en rojo.
 */
import { describe, expect, it } from 'vitest';

import {
  ARCHIVO_DE_SALIDA,
  CAMPOS_DE_INSTAGRAM,
  barrerSalida,
  filasDeLaTabla,
} from './fixtures/campos-de-instagram';

describe('el registro de campos de Instagram — B-1590, B-1780', () => {
  it('es la tabla de docs/03, fila por fila', () => {
    const filas = filasDeLaTabla();
    // Sin esto el cruce pasaría vacío el día que la tabla cambie de formato o de título.
    expect(filas.length, 'el cruce dejó de encontrar las filas de la tabla').toBeGreaterThanOrEqual(6);
    expect(
      CAMPOS_DE_INSTAGRAM.map((c) => c.fila),
      'el registro y la tabla de docs/03 no tienen las mismas filas: la nueva decide, salida por salida, si sale',
    ).toEqual(filas);
  });

  it('cada fila contesta todas las salidas, y la que no sale dice por qué', () => {
    const salidas = Object.keys(ARCHIVO_DE_SALIDA).sort();
    for (const { fila, salidas: en } of CAMPOS_DE_INSTAGRAM) {
      expect(Object.keys(en).sort(), fila.join(', ')).toEqual(salidas);
      for (const [salida, decision] of Object.entries(en)) {
        if ('porque' in decision) {
          expect(decision.porque.trim().length, `${fila.join(', ')} en ${salida}`).toBeGreaterThan(20);
        } else {
          for (const c of decision.crudo ?? []) {
            expect(c.porque.trim().length, `${fila.join(', ')} en ${salida}`).toBeGreaterThan(20);
          }
        }
      }
    }
  });

  it('cada «no sale» elige: un nombre que se verifica ausente, o por qué no se puede — B-1840', () => {
    for (const { fila, salidas: en } of CAMPOS_DE_INSTAGRAM) {
      for (const [salida, decision] of Object.entries(en)) {
        if (!('porque' in decision)) continue;
        const donde = `${fila.join(', ')} en ${salida}`;
        const ausente = decision.ausente ?? [];
        expect(
          ausente.length > 0 || (decision.sinAusente ?? '').trim().length > 20,
          `${donde}: un \`porque\` sin \`ausente\` tiene que decir en \`sinAusente\` por qué no se verifica`,
        ).toBe(true);
        if (decision.sinAusente !== undefined) {
          expect(decision.sinAusente.trim().length, donde).toBeGreaterThan(20);
        }
        // Atado a la fila: si el campo se renombra en la tabla, el chequeo no queda mirando un nombre muerto.
        for (const nombre of ausente) {
          expect(
            fila.some((campo) => new RegExp(`(?<![\\w$])${nombre}(?![\\w$])`).test(campo)),
            `${donde}: \`${nombre}\` no es un nombre de la fila`,
          ).toBe(true);
        }
      }
    }
  });
});

/**
 * El barrido sobre código chico y escrito a mano: la prueba de que la guarda
 * tiene dientes no depende de que alguien haga la mutación sobre el archivo real.
 */
describe('el barrido pone en rojo lo que dice — B-1780', () => {
  const REDES_SANO = [
    "const destinoLegible = (via, destino) => via === 'dm' ? arrobaInstagram(destino) : (destino ?? '').trim();",
    'const c = [...(actividad.difusion?.arrobar ?? []), arrobaInstagram(actividad.organizador?.instagram), arrobaInstagram(tallerista.instagram)];',
    'const destino = destinoLegible(insc.via, insc.destino);',
  ].join(' ');

  it('el código sano da verde', () => {
    expect(barrerSalida(REDES_SANO, 'redes')).toEqual([]);
  });

  it('un destino crudo, un Instagram sin envolver o un campo nuevo dan rojo nombrando la fila', () => {
    const casos: [string, string][] = [
      ['destinoLegible(insc.via, insc.destino)', 'insc.destino'],
      ['arrobaInstagram(actividad.organizador?.instagram)', 'actividad.organizador?.instagram'],
      ['arrobaInstagram(tallerista.instagram)', 'tallerista?.instagram'],
    ];
    for (const [sano, crudo] of casos) {
      const problemas = barrerSalida(REDES_SANO.replace(sano, crudo), 'redes');
      expect(problemas.join('\n'), crudo).toMatch(/entra crudo a redes/);
    }
    const nuevo = barrerSalida(`${REDES_SANO} const x = libro.autorInstagram;`, 'redes');
    expect(nuevo.join('\n')).toMatch(/libro\.autorInstagram.*el registro no conoce/);
  });

  it('un saneador vaciado adentro da rojo aunque la llamada siga igual', () => {
    const vaciado = REDES_SANO.replace('arrobaInstagram(destino)', 'destino');
    expect(barrerSalida(vaciado, 'redes').join('\n')).toMatch(/falta lo que sanea/);
  });

  it('y un campo que desaparece también: la guarda no pasa vacía', () => {
    expect(barrerSalida('', 'redes').join('\n')).toMatch(/encontró 0 lecturas/);
  });
});

/**
 * Lo que una fila dice que no sale, sobre código chico — B-1840. La ficha y
 * Calendar no tienen ningún campo vigilado que se pueda tocar sin romper el
 * mínimo, así que el código sano de cada una son sus lecturas aceptadas.
 */
describe('el barrido pone en rojo lo que no tenía que salir — B-1840', () => {
  const FICHA_SANA = [
    'const a = [arrobaInstagram(org.instagram), enlaceInstagram(org.instagram), arrobaInstagram(p.instagram), enlaceInstagram(p.instagram)];',
    "const canal = { destino: a.inscripcion.destino, accion: accionDeInscripcion(insc.via, insc.destino) };",
    "if (via === 'dm') { const handle = handleInstagram(valor); } const mostrarCanal: canal.requiere && canal.accion === null;",
  ].join(' ');
  const CALENDARIO_SANO = [
    'const o = arrobaPublicable(org.instagram); const t = arrobaPublicable(persona.instagram);',
    "const d = insc.via === 'dm' ? arrobaPublicable(insc.destino) : insc.destino;",
  ].join(' ');

  it('el código sano da verde', () => {
    expect(barrerSalida(FICHA_SANA, 'ficha')).toEqual([]);
    expect(barrerSalida(CALENDARIO_SANO, 'calendario')).toEqual([]);
  });

  it('leer `difusion.arrobar`, pasarlo por un `pick` o desestructurarlo da rojo en la ficha y en Calendar', () => {
    const lecturas = [
      'const arrobas = actividad.difusion?.arrobar ?? [];',
      "const x = pick(a, ['arrobar']);",
      'const { arrobar } = extras;',
      'const d = a.difusion;',
    ];
    for (const lectura of lecturas) {
      for (const [sano, salida] of [
        [FICHA_SANA, 'ficha'],
        [CALENDARIO_SANO, 'calendario'],
      ] as const) {
        expect(barrerSalida(`${sano} ${lectura}`, salida).join('\n'), `${lectura} en ${salida}`).toMatch(
          /difusion\.arrobar\[\]: `(arrobar|difusion)` aparece en/,
        );
      }
    }
  });

  it('una guía o un contacto interno que se cuelan dan rojo en las tres salidas', () => {
    for (const [lectura, fila] of [
      ['const o = suscripcion.ofrecidaPor;', /instagram, ofrecidaPor\.instagram: `ofrecidaPor` aparece/],
      ['const c = libreria.contactoDeQuienCargo;', /contactoDeQuienCargo, .*: `contactoDeQuienCargo` aparece/],
    ] as const) {
      expect(barrerSalida(`${FICHA_SANA} ${lectura}`, 'ficha').join('\n')).toMatch(fila);
      expect(barrerSalida(`${CALENDARIO_SANO} ${lectura}`, 'calendario').join('\n')).toMatch(fila);
    }
  });

  it('una palabra que solo contiene el nombre no da rojo', () => {
    expect(barrerSalida(`${CALENDARIO_SANO} const arrobarlo = 1; const difusionDelDia = 2;`, 'calendario')).toEqual([]);
  });
});
