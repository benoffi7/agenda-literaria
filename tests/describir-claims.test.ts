/**
 * **`--ver`, del lado puro: qué dice de cada objeto de claims** — B-2051.
 *
 * `scripts/describir-claims.mjs` es lo que el modo de solo lectura de
 * `set-admin-claim.mjs` imprime. Lo que importa acá es que conteste **lo mismo
 * que el panel**: el `--ver` existe para el paso 3 del runbook de
 * `ciudades-no-coinciden`, y si dijera «admin» o «general» de una cuenta que las
 * reglas tratan como publicador de una ciudad, mandaría a decidir sobre un dato
 * falso (clase de B-88). La prueba del script entero, contra el emulador de
 * Auth, está en `claim-ver.integracion.test.ts`.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { describirClaims } from '../scripts/describir-claims.mjs';
import { sinComentarios } from '../scripts/sin-comentarios.mjs';
import { ciudadDeClaims, rolDeClaims } from '@/lib/rolDelPanel';

const TABLA: (Record<string, unknown> | null | undefined)[] = [
  {},
  { admin: true },
  { publicador: true },
  { publicador: true, ciudad: 'mar-del-plata' },
  { publicador: true, ciudad: '' },
  { publicador: true, ciudad: 7 },
  { admin: true, ciudad: 'mar-del-plata' },
  { admin: true, publicador: true },
  { admin: true, publicador: true, ciudad: 'rosario' },
  { admin: 'true' },
  { publicador: 1, ciudad: 'rosario' },
  null,
  undefined,
];

describe('describirClaims — el rol y la ciudad que imprime `--ver`', () => {
  it('contesta el mismo rol y la misma ciudad que el panel, sobre toda la tabla', () => {
    for (const claims of TABLA) {
      const d = describirClaims(claims);
      expect(d.rol, JSON.stringify(claims)).toBe(rolDeClaims(claims));
      expect(d.ciudad, JSON.stringify(claims)).toBe(ciudadDeClaims(claims));
    }
  });

  it('los cuatro nombres que pide el ítem', () => {
    expect(describirClaims({ admin: true }).nombre).toBe('admin');
    expect(describirClaims({ publicador: true }).nombre).toBe('publicador general');
    expect(describirClaims({ publicador: true, ciudad: 'mar-del-plata' }).nombre).toBe(
      'publicador de mar-del-plata',
    );
    expect(describirClaims({}).nombre).toBe('sin rol');
    expect(describirClaims(undefined).nombre).toBe('sin rol');
  });

  it('los estados que el script no produce se avisan, y los normales no traen aviso', () => {
    for (const normal of [{}, { admin: true }, { publicador: true }, { publicador: true, ciudad: 'x' }]) {
      expect(describirClaims(normal).avisos, JSON.stringify(normal)).toEqual([]);
    }
    // Los dos claims: gana el acotado, y se dice.
    const dos = describirClaims({ admin: true, publicador: true });
    expect(dos.nombre).toBe('publicador general');
    expect(dos.avisos.join(' ')).toMatch(/los dos claims/);
    // Una ciudad que no restringe nada, o una vacía.
    expect(describirClaims({ admin: true, ciudad: 'rosario' }).avisos.join(' ')).toMatch(/no restringe/);
    expect(describirClaims({ publicador: true, ciudad: '' }).avisos.join(' ')).toMatch(/vacía/);
    // Un flag que no es `true`.
    expect(describirClaims({ admin: 'true' }).avisos.join(' ')).toMatch(/no es `true`/);
  });

  it('el rol no se deriva acá: se importa de la derivación de la Function', () => {
    // Una cuarta copia de «el publicador gana» es lo que este módulo no puede
    // tener. MUTACIÓN PROBADA: reemplazar el import por un `if (c.publicador
    // === true) return …` local deja este caso en rojo.
    const src = readFileSync('scripts/describir-claims.mjs', 'utf8');
    expect(src).toContain("from '../functions/alta-de-opcion.js'");
    expect(sinComentarios(src)).not.toMatch(/\.publicador === true\)\s*return/);
  });
});
