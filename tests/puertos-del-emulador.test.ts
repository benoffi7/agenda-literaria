/**
 * Los puertos de `firebase.json` que el sistema operativo ya tiene tomados — B-1200.
 *
 * `npm run emu` levanta todos los emuladores del `firebase.json`, y si **uno**
 * no consigue su puerto se cae la tanda entera. El 2026-09-22 el que no lo
 * consiguió fue Hosting: el 5000 lo tiene `ControlCenter`, el receptor de
 * AirPlay de macOS (medido con `lsof -nP -iTCP:5000 -sTCP:LISTEN`). El emulador
 * de Hosting no lo usa ningún test —la suite habla con Firestore, Auth y
 * Storage—, pero su puerto tomado dejaba sin correr **todos** los de
 * integración, y la causa no estaba en el repo, que es donde uno la busca.
 *
 * Se movió el puerto en vez de sacar `hosting` del arranque: cambia una línea y
 * no le saca una capacidad al comando, que es lo que recomendaba la entrada.
 *
 * El test fija la lista de puertos que macOS escucha por su cuenta, no el 5002:
 * cualquier otro puerto libre sirve, y lo que no puede volver es uno de éstos.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** 5000 y 7000 son del receptor de AirPlay (`ControlCenter`) desde macOS 12. */
const TOMADOS_POR_MACOS = [5000, 7000];

const config = JSON.parse(readFileSync(new URL('../firebase.json', import.meta.url), 'utf8')) as {
  emulators: Record<string, unknown>;
};

const puertos = Object.entries(config.emulators).flatMap(([nombre, valor]) => {
  const puerto = (valor as { port?: unknown } | null)?.port;
  return typeof puerto === 'number' ? [[nombre, puerto] as const] : [];
});

describe('los puertos del emulador — B-1200', () => {
  it('lee los puertos: si el formato de firebase.json cambia, el test no pasa en el vacío', () => {
    expect(puertos.map(([nombre]) => nombre)).toEqual(
      expect.arrayContaining(['auth', 'firestore', 'storage', 'hosting', 'functions', 'ui']),
    );
  });

  it.each(puertos)('%s no usa un puerto que macOS ya tiene tomado', (_, puerto) => {
    expect(TOMADOS_POR_MACOS).not.toContain(puerto);
  });

  it('dos emuladores no comparten puerto', () => {
    const numeros = puertos.map(([, p]) => p);
    expect(new Set(numeros).size).toBe(numeros.length);
  });
});
