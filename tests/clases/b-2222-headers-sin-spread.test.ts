/**
 * B-2222 — desde google-auth-library 10, `getRequestHeaders()` devuelve un
 * `Headers` y no un objeto plano. Un `{ ...headers }` da `{}`: el pedido sale
 * sin `Authorization` y la API contesta 401, sin que nada local se ponga rojo.
 * `scripts/verificar-calendario.mjs` lo tuvo así desde que se subió a la 10.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { OAuth2Client } from 'google-auth-library';
import { describe, expect, it } from 'vitest';

const fuentes = (dir: string) =>
  readdirSync(dir)
    .filter((f) => /\.(m?js|ts)$/.test(f))
    .map((f) => join(dir, f));

describe('clase de B-2222 · los headers de google-auth-library no se desarman con un spread', () => {
  it('getRequestHeaders devuelve un Headers, que un spread vacía', async () => {
    const cliente = new OAuth2Client();
    cliente.setCredentials({ access_token: 'tok', expiry_date: Date.now() + 3_600_000 });
    const headers = await cliente.getRequestHeaders();
    expect({ ...headers }).toEqual({});
    expect(new Headers(headers).get('authorization')).toBe('Bearer tok');
  });

  it('ningún script ni Function desarma esos headers con un spread', () => {
    for (const archivo of [...fuentes('scripts'), ...fuentes('functions')]) {
      const texto = readFileSync(archivo, 'utf8');
      const variables = [...texto.matchAll(/const (\w+) = await \w+\.getRequestHeaders\(/g)].map(
        (m) => m[1],
      );
      for (const v of variables) expect(texto, archivo).not.toMatch(new RegExp(`\\.\\.\\.${v}\\b`));
    }
  });
});
