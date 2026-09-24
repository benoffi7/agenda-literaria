/**
 * El ritmo del catálogo **dibujado** en el tablero — B-1081.
 *
 * `tests/ritmo-del-catalogo.test.ts` cubre el cálculo puro. Lo que este archivo
 * cuida es lo que solo existe con DOM:
 *
 * 1. **Que se dibuje.** B-1081 nació de un módulo de 260 líneas con sus tests
 *    que ninguna pantalla importaba; un test del módulo no puede ver eso.
 * 2. **El equivalente para un lector de pantalla.** El mapa es una `<table>` con
 *    su nombre, sus encabezados de fila y de columna, y cada celda dice la fecha
 *    y la cantidad en palabras. Se consulta por rol, que es como lo recorre un
 *    lector, y no por clase.
 * 3. **Ningún número inventado** (D-272): sin encuentros no hay grilla de
 *    ceros, y con pocos no hay escala.
 * 4. **El contraste de cada celda**, leído de las mismas clases que pinta
 *    `Ritmo.tsx` y no de una lista copiada acá.
 *
 * El reloj se fija con `toFake: ['Date']` y nada más: el tablero congela `ahora`
 * al montar con `new Date()`, y los temporizadores tienen que seguir siendo
 * reales para que `findByRole` espere a que `listarActividades` resuelva.
 */
import { readFileSync } from 'node:fs';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/actividades', () => ({
  listarActividades: vi.fn(async () => []),
}));
vi.mock('@/lib/analytics', () => ({
  medirFuncion: vi.fn(),
}));
vi.mock('@/components/admin/useOpciones', () => ({
  useLabelsTaxonomia: () => ({}),
  useOpciones: () => ({ valores: [], cargando: false }),
}));
vi.mock('@/lib/analiticaDelSitio', () => ({
  leerAnaliticaDelSitio: vi.fn(async () => leerResumenDelSitio(null)),
}));

import { EstadisticasPanel } from '@/components/admin/EstadisticasPanel';
import { CELDA_POR_NIVEL, CELDA_YA_PASO } from '@/components/admin/estadisticas/Ritmo';
import { listarActividades } from '@/lib/actividades';
import { AA_TEXTO, contraste, mezclar, oklchASrgb, type Srgb } from '@/lib/contraste';
import { leerResumenDelSitio } from '@/lib/resumenDelSitio';
import { SEMANAS_DEL_MAPA } from '@/lib/ritmoDelCatalogo';
import type { ActividadConId, Sesion } from '@/types/actividad';
import { ts } from './fixtures/tiempo';

/** Jueves 24 de septiembre de 2026, 12:00 en Buenos Aires. El mapa arranca el lunes 21. */
const HOY = new Date('2026-09-24T15:00:00Z');

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(HOY);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const DOS_HORAS = 2 * 60 * 60 * 1000;

const sesion = (inicioIso: string): Sesion =>
  ({
    id: `ses_${inicioIso}`,
    tema: null,
    lectura: null,
    cancelada: false,
    calendarEventId: null,
    inicio: ts(inicioIso),
    fin: ts(new Date(new Date(inicioIso).getTime() + DOS_HORAS).toISOString()),
  }) as unknown as Sesion;

const acto = (id: string, inicios: string[]): ActividadConId =>
  ({
    id,
    titulo: `Actividad ${id}`,
    tipo: 'taller',
    estado: 'publicado',
    esCiclo: inicios.length > 1,
    modalidad: 'presencial',
    modalidades: [],
    sede: null,
    online: null,
    sesiones: inicios.map(sesion),
    tags: ['escritura'],
    imagenes: [],
    descripcion: 'x'.repeat(120),
    arancel: { tipo: 'gratis', notas: '' },
    inscripcion: { requiere: false, via: null, destino: '', cupo: null, cierra: null },
    material: { tiene: false, items: [] },
    difusion: { arrobar: [], notas: '' },
  }) as unknown as ActividadConId;

const montar = async (actividades: ActividadConId[]) => {
  vi.mocked(listarActividades).mockResolvedValueOnce(actividades);
  render(<EstadisticasPanel onEditar={() => {}} />);
  await screen.findByRole('tablist');
};

/*
 * Tres el martes 29 a las 19 (el día más cargado: con un máximo de 3 hay
 * escala), uno el jueves 1/10 a las 10, y uno el martes 22, que ya pasó.
 */
const CON_ESCALA = [
  acto('a', ['2026-09-29T22:00:00Z', '2026-10-01T13:00:00Z']),
  acto('b', ['2026-09-29T22:00:00Z']),
  acto('c', ['2026-09-29T23:00:00Z']),
  acto('d', ['2026-09-22T22:00:00Z']),
];

describe('el ritmo se dibuja en «El catálogo» (B-1081)', () => {
  it('aparece la sección, con el mapa como tabla que se puede recorrer', async () => {
    await montar(CON_ESCALA);
    expect(screen.getByRole('heading', { name: 'Cuándo pasan las cosas' })).not.toBeNull();

    const tabla = screen.getByRole('table', { name: /^Encuentros por día/ });
    // Ocho semanas y una fila de encabezados: la grilla es rectangular, con los
    // huecos adentro, que es lo que el mapa vino a mostrar.
    expect(within(tabla).getAllByRole('row')).toHaveLength(SEMANAS_DEL_MAPA + 1);
    expect(within(tabla).getAllByRole('rowheader')).toHaveLength(SEMANAS_DEL_MAPA);
    // Siete días más la esquina.
    expect(within(tabla).getAllByRole('columnheader')).toHaveLength(8);
    expect(within(tabla).getAllByRole('cell')).toHaveLength(SEMANAS_DEL_MAPA * 7);
    // Las columnas se llaman por su nombre largo: «M» no distingue martes de miércoles.
    expect(within(tabla).getByRole('columnheader', { name: 'miércoles' })).not.toBeNull();
  });

  it('cada celda dice su fecha y su cantidad en palabras, y la escala la pinta', async () => {
    await montar(CON_ESCALA);
    const tabla = screen.getByRole('table', { name: /^Encuentros por día/ });

    const saturado = within(tabla).getByRole('cell', {
      name: 'martes 29 de septiembre: 3 encuentros',
    });
    expect(saturado.getAttribute('data-nivel')).toBe('3');
    expect(saturado.className).toContain(CELDA_POR_NIVEL[3]);

    const poco = within(tabla).getByRole('cell', { name: 'jueves 1 de octubre: 1 encuentro' });
    expect(poco.getAttribute('data-nivel')).toBe('1');

    // El martes 22 ya pasó: entra en la grilla —sacarlo dejaría un hueco que se
    // confunde con un día libre— pero apagado, sin el color de la escala.
    const pasado = within(tabla).getByRole('cell', {
      name: 'martes 22 de septiembre: 1 encuentro (ya pasó)',
    });
    expect(pasado.getAttribute('data-nivel')).toBe('ya-paso');

    expect(
      within(tabla).getByRole('cell', { name: 'jueves 24 de septiembre: ningún encuentro (hoy)' }),
    ).not.toBeNull();
  });

  it('la conclusión va en texto: días sin nada y semanas vacías', async () => {
    await montar(CON_ESCALA);
    // 5 encuentros en la ventana (el del 22 cuenta: está dentro), 53 días vacíos.
    expect(screen.getByText(/5 encuentros, y 53 de los 56 días sin ninguno/)).not.toBeNull();
    // Esta semana ya no tiene nada por venir, y de la del 5/10 en adelante tampoco.
    expect(screen.getByText(/Sin nada por venir: la semana del 21\/9, la del 5\/10/)).not.toBeNull();
  });

  it('la leyenda dice qué cantidad pinta cada color', async () => {
    await montar(CON_ESCALA);
    const leyenda = screen.getByRole('list', { name: 'Referencias del mapa' });
    expect(within(leyenda).getByText('mucho (3)')).not.toBeNull();
    expect(within(leyenda).getByText('poco (1)')).not.toBeNull();
    expect(screen.queryByText(/el color no gradúa/)).toBeNull();
  });

  it('las dos vistas de tiempo reparten lo que queda por venir', async () => {
    await montar(CON_ESCALA);
    const dia = screen.getByRole('heading', { name: 'Por día de la semana' }).closest('section')!;
    // Los siete días, también los de cero: «no hay nada los lunes» es el dato.
    expect(within(dia).getAllByRole('listitem')).toHaveLength(7);
    expect(within(dia).getByText('Sobre los 4 encuentros por venir, no solo las próximas semanas.'))
      .not.toBeNull();
    const martes = within(dia).getByText('Martes').closest('li')!;
    expect(martes.textContent).toContain('3(75 %)');

    const franja = screen.getByRole('heading', { name: 'Por franja horaria' }).closest('section')!;
    expect(within(franja).getAllByRole('listitem')).toHaveLength(3);
    expect(within(franja).getByText('Noche').closest('li')!.textContent).toContain('3(75 %)');
    expect(within(franja).getByText('Mañana').closest('li')!.textContent).toContain('1(25 %)');
  });
});

describe('sin números inventados (D-272)', () => {
  it('con un máximo de dos por día no hay escala, y lo dice', async () => {
    await montar([acto('a', ['2026-09-29T22:00:00Z', '2026-09-29T23:00:00Z'])]);
    expect(screen.getByText(/el color no gradúa: dice solo si hay o no hay/)).not.toBeNull();
    const leyenda = screen.getByRole('list', { name: 'Referencias del mapa' });
    expect(within(leyenda).getByText('hay')).not.toBeNull();
    expect(within(leyenda).queryByText(/^mucho/)).toBeNull();
    // Y el día de dos no se pinta de «saturado».
    expect(
      screen
        .getByRole('cell', { name: 'martes 29 de septiembre: 2 encuentros' })
        .getAttribute('data-nivel'),
    ).toBe('1');
  });

  it('sin nada en la ventana no hay una grilla de ceros: se dice que no hay', async () => {
    // Una actividad cargada con un solo encuentro en agosto: el tablero tiene
    // catálogo, y el ritmo no tiene nada que mostrar.
    await montar([acto('a', ['2026-08-10T22:00:00Z'])]);
    expect(screen.getByRole('heading', { name: 'Cuándo pasan las cosas' })).not.toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByText(/no hay mapa que mostrar/)).not.toBeNull();
    expect(screen.getByText(/no hay reparto por día ni por franja/)).not.toBeNull();
    expect(screen.queryByRole('heading', { name: 'Por día de la semana' })).toBeNull();
  });
});

// ── El contraste de las celdas ─────────────────────────────────────

// `process.cwd()` y no `import.meta.url`: bajo jsdom la URL del módulo no es un
// `file:` y el `fileURLToPath` de los tests puros no resuelve (el mismo recurso
// que `lista-actividades.render.test.tsx`).
const raiz = (rel: string): string => `${process.cwd()}/${rel}`;
const css = readFileSync(raiz('src/styles/global.css'), 'utf8');

const BLANCO: Srgb = [1, 1, 1];

/** Un token de la paleta, leído de `global.css` y no copiado. `white` es el de Tailwind. */
const color = (nombre: string): Srgb => {
  if (nombre === 'white') return BLANCO;
  const m = css.match(
    new RegExp(`--color-${nombre}:\\s*oklch\\(([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)\\)`),
  );
  expect(m, `no se encontró --color-${nombre} en global.css`).not.toBeNull();
  return oklchASrgb(Number(m![1]), Number(m![2]), Number(m![3]));
};

/**
 * El contraste del texto de una celda contra su fondo, leído de sus clases.
 * `base` es lo que hay debajo de un fondo translúcido: el blanco o el papel.
 */
const contrasteDeClases = (clases: string, base: Srgb): number => {
  const fondo = clases.match(/(?:^|\s)bg-(\w+)(?:\/(\d+))?(?=\s|$)/);
  const texto = clases.match(/(?:^|\s)text-(\w+)(?:\/(\d+))?(?=\s|$)/);
  expect(fondo, `sin fondo en «${clases}»`).not.toBeNull();
  expect(texto, `sin texto en «${clases}»`).not.toBeNull();
  const bg = mezclar(color(fondo![1]!), base, fondo![2] ? Number(fondo![2]) / 100 : 1);
  const fg = mezclar(color(texto![1]!), bg, texto![2] ? Number(texto![2]) / 100 : 1);
  return contraste(fg, bg);
};

const papel = (): Srgb => color('papel');

describe('el contraste del ritmo', () => {
  it('el número de cada celda pasa AA contra su fondo, sobre blanco y sobre papel', () => {
    const flojas: string[] = [];
    for (const clases of [...CELDA_POR_NIVEL, CELDA_YA_PASO]) {
      for (const [nombre, base] of [
        ['blanco', BLANCO],
        ['papel', papel()],
      ] as const) {
        const r = contrasteDeClases(clases, base);
        if (r < AA_TEXTO) flojas.push(`«${clases}» sobre ${nombre}: ${r.toFixed(2)}:1`);
      }
    }
    expect(flojas).toEqual([]);
  });

  it('control negativo: la tinta sobre el acento pleno no pasa, que es por lo que el nivel 3 va en blanco', () => {
    // Sin esto, una aritmética rota que devolviera siempre un número alto
    // dejaría verde el caso de arriba.
    expect(contrasteDeClases('bg-acento text-tinta', BLANCO)).toBeLessThan(AA_TEXTO);
  });

  it('los cuatro niveles son cuatro fondos distintos', () => {
    const fondos = CELDA_POR_NIVEL.map((c) => c.match(/bg-\S+/)![0]);
    expect(new Set(fondos).size).toBe(CELDA_POR_NIVEL.length);
  });

  it('ningún texto atenuado de la sección queda por debajo de AA', () => {
    /*
     * El panel usa `text-tinta/50` y `/55` en otros lados, y sobre blanco dan
     * menos de 4,5:1. Esta sección no hereda eso: todo lo atenuado que escribe
     * se mide acá, leído del fuente, contra el blanco y el papel.
     */
    const fuente = readFileSync(raiz('src/components/admin/estadisticas/Ritmo.tsx'), 'utf8');
    const atenuados = [...new Set([...fuente.matchAll(/text-tinta\/(\d+)/g)].map((m) => m[0]))];
    expect(atenuados.length, 'control positivo: el barrido encuentra algo').toBeGreaterThan(0);
    const flojos = atenuados.filter((clase) =>
      ['white', 'papel'].some(
        (fondo) => contrasteDeClases(`bg-${fondo} ${clase}`, BLANCO) < AA_TEXTO,
      ),
    );
    expect(flojos).toEqual([]);
  });
});
