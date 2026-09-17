/**
 * La mitad que decide de la guarda de D-730 / B-1112.
 *
 * El emulador de Auth es de **un solo proyecto** —el de su `--project` de
 * arranque— y no lo dice por ninguna vía consultable: medido el 2026-09-17,
 * `/emulator/v1/projects/{p}/config` contesta `200` para cualquier proyecto, y
 * `"singleProjectMode": false` solo apaga el aviso sin particionar nada.
 *
 * Lo único que lo delata es el `aud` del ID token, que lo emite el emulador. Eso
 * es lo que se prueba acá; lo que no se puede probar sin un emulador mal
 * levantado —que el login real lo dispare— vive en `entrarComo`.
 */
import { describe, expect, it } from 'vitest';
import { cargaDelToken, desajusteDeProyecto } from './emulador';

const jwtCon = (carga: Record<string, unknown>): string => {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'none' })}.${b64(carga)}.firma-que-nadie-verifica`;
};

describe('el aud del ID token delata el proyecto del emulador de Auth', () => {
  it('no hay desajuste cuando el aud es el proyecto de este checkout', () => {
    expect(desajusteDeProyecto(jwtCon({ aud: 'agenda-literaria-c7201d89' }), 'agenda-literaria-c7201d89')).toBeNull();
  });

  it('devuelve el proyecto ajeno cuando el emulador sirve otro — el caso de B-1112', () => {
    expect(desajusteDeProyecto(jwtCon({ aud: 'agenda-literaria-c7201d89' }), 'agenda-literaria-0326695e')).toBe(
      'agenda-literaria-c7201d89',
    );
  });

  // El chequeo corre en el login de TODOS los tests de integración, así que un
  // falso positivo se parecería al bug que viene a nombrar. Ante cualquier duda,
  // callarse.
  it.each([
    ['un token que no es un JWT', 'esto-no-es-un-jwt'],
    ['la cadena vacía', ''],
    ['un payload que no es base64', 'a.@@@.c'],
    ['un payload que no es JSON', `x.${Buffer.from('no soy json').toString('base64url')}.y`],
  ])('no dispara con %s', (_, token) => {
    expect(desajusteDeProyecto(token, 'agenda-literaria-c7201d89')).toBeNull();
    expect(cargaDelToken(token)).toEqual({});
  });

  it('no dispara si el token no trae aud', () => {
    expect(desajusteDeProyecto(jwtCon({ sub: 'uid_x' }), 'agenda-literaria-c7201d89')).toBeNull();
  });

  it('no dispara si el aud no es una cadena', () => {
    expect(desajusteDeProyecto(jwtCon({ aud: 42 }), 'agenda-literaria-c7201d89')).toBeNull();
  });

  it('lee el resto de la carga, que es lo que hace legible el mensaje', () => {
    expect(cargaDelToken(jwtCon({ aud: 'p', sub: 'uid_admin', admin: true }))).toEqual({
      aud: 'p',
      sub: 'uid_admin',
      admin: true,
    });
  });
});
