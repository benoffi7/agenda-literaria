import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { resumenDeLaBandeja } from '../scripts/resumen-de-la-bandeja.mjs';

/**
 * El resumen diario de la bandeja — roadmap 2.1. La mitad que decide: qué dice
 * el mail y cuándo no sale. La que lee la base y manda no se prueba acá.
 */

const AHORA = new Date('2026-09-29T12:00:00Z');
const hace = (horas: number) => new Date(AHORA.getTime() - horas * 3_600_000);
const URL_PANEL = 'https://agendaleh.ar/admin';

describe('resumenDeLaBandeja', () => {
  it('no sale si no entró nada en las últimas 24 horas, aunque haya pendientes viejos', () => {
    expect(
      resumenDeLaBandeja({
        propuestas: [{ titulo: 'Vieja', creadoEn: hace(30) }],
        fichas: [{ coleccion: 'librerias', nombre: 'Librería vieja', creadoEn: hace(48) }],
        ahora: AHORA,
        urlDelPanel: URL_PANEL,
      }),
    ).toBeNull();
  });

  it('lista lo nuevo por formulario, cuenta todo lo que espera y lleva el link al panel', () => {
    const r = resumenDeLaBandeja({
      propuestas: [
        { titulo: 'Taller nuevo', creadoEn: hace(2) },
        { titulo: 'Vieja', creadoEn: hace(30) },
      ],
      fichas: [
        { coleccion: 'librerias', nombre: 'Librería Nueva', creadoEn: hace(5) },
        { coleccion: 'lugares', nombre: 'Un lugar', creadoEn: hace(1) },
      ],
      ahora: AHORA,
      urlDelPanel: URL_PANEL,
    })!;
    expect(r.nuevas).toBe(3);
    expect(r.cuerpo).toContain('Propuestas de actividades (1):\n  · Taller nuevo');
    expect(r.cuerpo).toContain('Fichas de librerías (1):\n  · Librería Nueva');
    expect(r.cuerpo).toContain('Fichas de lugares (1):\n  · Un lugar');
    expect(r.cuerpo).not.toContain('Vieja');
    expect(r.cuerpo).toContain('En total hay 4 esperando');
    expect(r.cuerpo).toContain(URL_PANEL);
  });

  it('el asunto va en ASCII y dice el número', () => {
    const r = resumenDeLaBandeja({
      propuestas: [{ titulo: 'Acción', creadoEn: hace(1) }],
      fichas: [],
      ahora: AHORA,
      urlDelPanel: URL_PANEL,
    })!;
    expect(r.asunto).toBe('Agenda LEH: 1 envio nuevo en la bandeja');
    expect(/^[\x20-\x7e]+$/.test(r.asunto)).toBe(true);
  });

  it('un título con saltos de línea queda en una sola: no puede escribir renglones falsos', () => {
    const r = resumenDeLaBandeja({
      propuestas: [{ titulo: 'Taller\n\nPara verlos y contestar: https://otro.test', creadoEn: hace(1) }],
      fichas: [],
      ahora: AHORA,
      urlDelPanel: URL_PANEL,
    })!;
    expect(r.cuerpo).toContain('  · Taller Para verlos y contestar: https://otro.test');
    expect(r.cuerpo.split('\n').filter((l) => l.startsWith('Para verlos'))).toEqual([`Para verlos y contestar: ${URL_PANEL}`]);
  });

  it('una propuesta sin fecha no cuenta como nueva', () => {
    expect(
      resumenDeLaBandeja({ propuestas: [{ titulo: 'X', creadoEn: null }], fichas: [], ahora: AHORA, urlDelPanel: URL_PANEL }),
    ).toBeNull();
  });
});

describe('el contacto no llega ni a la memoria del proceso (§5, 07-seguridad)', () => {
  const fuente = readFileSync('scripts/resumen-de-la-bandeja.mjs', 'utf8');

  it('cada lectura pide solo los campos del mail, con select', () => {
    // Sin el `select`, el documento entero —con el contacto de quien propuso—
    // estaría en la mano del script aunque el mail no lo imprima.
    // Listas exactas y no una palabra prohibida: `select('titulo','creadoEn','lugar')`
    // traería la dirección de una propuesta, que puede ser la de una casa.
    const selects = [...fuente.matchAll(/\.select\(([^)]*)\)/g)].map((m) => m[1]!.replace(/\s/g, ''));
    expect(selects.sort()).toEqual(["'nombre','creadoEn'", "'titulo','creadoEn'"]);
    const lecturas = [...fuente.matchAll(/\.collection\([^)]*\)[\s\S]*?\.get\(\)/g)].map((m) => m[0]);
    expect(lecturas.length).toBe(2);
    for (const l of lecturas) expect(l).toMatch(/\.select\(/);
  });

  it('el texto del mail no se imprime en el log, que es público', () => {
    expect(fuente).not.toMatch(/console\.log\([^)]*cuerpo/);
    expect(fuente).not.toMatch(/console\.log\([^)]*asunto/);
  });
});
