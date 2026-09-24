/**
 * La sonda que le pregunta al emulador de Auth vivo qué proyecto sirve — B-1201, D-1020.
 *
 * Firestore usa la base del checkout (B-219); Auth, que es de un solo proyecto,
 * usa el que el emulador vivo diga. Esto prueba la sonda con un `fetch` de
 * mentira: sin emulador, porque la mitad que decide es qué se hace con cada
 * respuesta. Que el emulador de verdad conteste así lo cubren los tests de
 * integración, que loguean todos a través de `tokenDe()`.
 */
import { describe, expect, it } from 'vitest';
import { cargaDelJwt, proyectoDelEmuladorDeAuth } from '../scripts/project-id-emulador.mjs';

const jwtCon = (carga: Record<string, unknown>): string => {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'none' })}.${b64(carga)}.`;
};

interface Pedido {
  url: string;
  cuerpo: unknown;
}

/** Un `fetch` que contesta `respuesta` al signUp y anota todo lo que le piden. */
const falso = (respuesta: () => Response) => {
  const pedidos: Pedido[] = [];
  const pedir = (async (url: string, init?: RequestInit) => {
    pedidos.push({ url, cuerpo: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (url.includes('accounts:signUp')) return respuesta();
    return new Response('{}', { status: 200 });
  }) as unknown as typeof fetch;
  return { pedir, pedidos };
};

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });

describe('proyectoDelEmuladorDeAuth — B-1201', () => {
  it('devuelve el aud del token de la cuenta anónima: es el proyecto que sirve el emulador', async () => {
    const token = jwtCon({ aud: 'agenda-literaria-c7201d89', sub: 'anonima' });
    const { pedir, pedidos } = falso(() => json({ idToken: token }));

    expect(await proyectoDelEmuladorDeAuth('127.0.0.1:9099', pedir)).toBe('agenda-literaria-c7201d89');
    expect(pedidos[0].url).toBe(
      'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=clave-del-emulador',
    );
    // Anónima: sin email ni password, que es lo que la hace una sonda y no una cuenta.
    expect(pedidos[0].cuerpo).toEqual({ returnSecureToken: true });
  });

  it('borra la cuenta de sonda con su propio token: el store de Auth no se limpia entre corridas', async () => {
    const token = jwtCon({ aud: 'p-sonda' });
    const { pedir, pedidos } = falso(() => json({ idToken: token }));

    await proyectoDelEmuladorDeAuth('127.0.0.1:9099', pedir);
    expect(pedidos[1]).toEqual({
      url: 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:delete?key=clave-del-emulador',
      cuerpo: { idToken: token },
    });
  });

  it('si el borrado falla, el proyecto igual se devuelve: la sonda huérfana no rompe la corrida', async () => {
    const token = jwtCon({ aud: 'p-sonda' });
    const pedir = (async (url: string) => {
      if (url.includes('accounts:delete')) throw new Error('ECONNRESET');
      return json({ idToken: token });
    }) as unknown as typeof fetch;

    expect(await proyectoDelEmuladorDeAuth('127.0.0.1:9099', pedir)).toBe('p-sonda');
  });

  /*
   * Cualquier duda es `null`, y quien llama cae al `PROJECT_ID` del checkout: el
   * comportamiento de antes de B-1201, con la guarda de B-1112 detrás. Un proyecto
   * inventado acá sería peor que ninguno: escribiría los claims donde nadie entra.
   */
  it.each([
    ['el emulador no contesta', () => {
      throw new TypeError('fetch failed');
    }],
    ['las anónimas están apagadas (ADMIN_ONLY_OPERATION)', () =>
      json({ error: { message: 'ADMIN_ONLY_OPERATION' } }, 400)],
    ['la respuesta no trae idToken', () => json({})],
    ['el idToken no es un JWT', () => json({ idToken: 'esto-no-es-un-jwt' })],
    ['el token no trae aud', () => json({ idToken: jwtCon({ sub: 'x' }) })],
    ['el aud no es una cadena', () => json({ idToken: jwtCon({ aud: 42 }) })],
    ['el aud es la cadena vacía', () => json({ idToken: jwtCon({ aud: '' }) })],
    ['el cuerpo no es JSON', () => new Response('<html>', { status: 200 })],
  ])('devuelve null si %s', async (_, respuesta) => {
    const { pedir } = falso(respuesta);
    expect(await proyectoDelEmuladorDeAuth('127.0.0.1:9099', pedir)).toBeNull();
  });
});

describe('cargaDelJwt — la única decodificación', () => {
  it('lee la carga', () => {
    expect(cargaDelJwt(jwtCon({ aud: 'p', admin: true }))).toEqual({ aud: 'p', admin: true });
  });

  it.each([
    ['la cadena vacía', ''],
    ['un token sin puntos', 'abc'],
    ['un payload que no es base64 de JSON', 'a.@@@.c'],
    ['un payload que es un número', `x.${Buffer.from('42').toString('base64url')}.y`],
    ['un payload que es una lista', `x.${Buffer.from('[1]').toString('base64url')}.y`],
  ])('degrada a {} con %s', (_, jwt) => {
    expect(cargaDelJwt(jwt)).toEqual({});
  });
});
