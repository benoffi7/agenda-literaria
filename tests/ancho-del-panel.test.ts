import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ANCHO_DE_LECTURA,
  ANCHO_DE_TABLERO,
  VISTAS_A_TODO_ANCHO,
  claseAnchoDePanel,
} from '@/lib/anchoDelPanel';

/**
 * B-621 — el ancho es una propiedad de la vista.
 *
 * El panel entero vivía en una medida de lectura, que es la correcta para un
 * formulario y la equivocada para una grilla de siete columnas y para un tablero
 * de números que se comparan al lado uno del otro.
 *
 * Lo que estos casos protegen no es el número de píxeles sino las dos cosas que
 * se pierden solas: que la decisión siga viviendo en **un** lugar, y que las
 * vistas de lectura **no** se ensanchen de arrastre.
 */
describe('el ancho lo decide la vista (B-621)', () => {
  it('el calendario y el tablero van anchos: son los dos que el dueño pidió', () => {
    expect(claseAnchoDePanel('calendario')).toBe(ANCHO_DE_TABLERO);
    expect(claseAnchoDePanel('estadisticas')).toBe(ANCHO_DE_TABLERO);
  });

  it('el formulario, el listado y el resto siguen en la medida de lectura', () => {
    // Es la mitad que importa: ensanchar el chasis entero arregla dos pantallas y
    // rompe las cuatro donde se pasa el tiempo. Un campo de texto de 1200px es
    // peor que uno de 700.
    for (const v of ['lista', 'nueva', 'editar', 'duplicar', 'historial', 'reportes', 'taxonomias']) {
      expect(claseAnchoDePanel(v), `«${v}» no debería ir a todo ancho`).toBe(ANCHO_DE_LECTURA);
    }
  });

  it('una vista desconocida cae en la medida de lectura, no en la ancha', () => {
    // El default seguro: una pantalla nueva que nadie clasificó nace angosta, que
    // es lo que se puede mirar sin que se note, en vez de ancha y despatarrada.
    expect(claseAnchoDePanel('lo-que-venga')).toBe(ANCHO_DE_LECTURA);
  });

  it('la medida ancha tiene tope: «a todo ancho» no es «sin límite»', () => {
    // En un monitor grande una grilla sin tope da celdas enormes y vacías y el
    // ojo pierde la fila. Si esto se vuelve `w-full`, se rompe eso sin que nada
    // más falle.
    expect(ANCHO_DE_TABLERO).toMatch(/max-w-/);
    expect(ANCHO_DE_TABLERO).not.toMatch(/\bw-full\b/);
  });
});

/**
 * La otra mitad: que el chasis consuma la decisión en vez de tener la suya, y que
 * las vistas anchas de verdad **repartan** el espacio.
 *
 * Es lo que el propio ítem advierte: entrar a la lista es una línea; repartir la
 * pantalla es el trabajo. Una vista ancha que no reparte no mejora — estira las
 * mismas filas hasta que leer un renglón es viajar de una punta a la otra.
 */
describe('el chasis y las pantallas anchas (B-621)', () => {
  const fuente = (rel: string) => readFileSync(`src/${rel}`, 'utf8');

  it('el chasis pregunta por la vista y no tiene su propio ancho escrito', () => {
    const app = fuente('components/admin/AdminApp.tsx');
    expect(app).toContain('claseAnchoDePanel(vista.tipo)');
    // El literal que había antes. Si vuelve, vuelve el chasis único.
    expect(app).not.toContain('mx-auto max-w-3xl px-segura py-6 lg:max-w-4xl');
  });

  it('el tablero reparte en columnas lo que antes apilaba', () => {
    const tablero = fuente('components/admin/EstadisticasPanel.tsx');
    // Las tarjetas de «Qué conviene mirar» y los dos grupos de métricas del sitio:
    // los dos bloques que a 1200px dejaban el dato lejos de su nombre.
    expect(tablero).toContain('grid gap-4 xl:grid-cols-2');
    expect(tablero).toContain('grid gap-6 lg:grid-cols-2 lg:items-start');
  });

  /**
   * El calendario entra a la lista y **no** se reparte en este cambio, y es a
   * propósito: `CalendarioActividades.tsx` es del frente de ciclos.
   *
   * Igual gana, y por eso entra: su vista de mes ya es `grid-cols-7`, o sea que
   * el reparto está hecho y lo único que le faltaba era el espacio — a 896px cada
   * día mide ~120px y no entra un título. La vista de agenda deja de recortar.
   * Lo que queda pendiente es repartir **la agenda** en columnas, que sí es
   * trabajo dentro de ese archivo.
   */
  it('el calendario ya tenía la grilla que justifica el ancho', () => {
    expect(fuente('components/admin/CalendarioActividades.tsx')).toContain('grid grid-cols-7');
  });

  it('la lista de vistas anchas es corta y explícita, no una regla adivinada', () => {
    // Si esto crece sin que nadie lo mire, «a todo ancho» deja de ser una
    // decisión y pasa a ser el default por goteo.
    expect([...VISTAS_A_TODO_ANCHO].sort()).toEqual(['calendario', 'estadisticas']);
  });
});
