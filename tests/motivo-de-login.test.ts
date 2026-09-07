/**
 * Por qué falló el login del panel — B-790.
 *
 * El bug que esto cierra no era un mensaje malo: **era la ausencia de mensaje.**
 * `void loginConGoogle()` descartaba la promesa, así que un
 * `auth/unauthorized-domain` no llegaba a ninguna parte y la pantalla quedaba
 * igual. Es la misma clase que B-590 —el dato para explicar la falla estaba y se
 * tiraba— y por eso el chequeo también es el mismo: **por clase, no por caso.**
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { motivoDeLoginFallido } from '@/lib/motivoDeLogin';

/** Un error del SDK, con la forma que tiene de verdad. */
const conCodigo = (code: string) => ({ code, name: 'FirebaseError', message: code });

describe('motivoDeLoginFallido — B-790', () => {
  /*
   * El caso que motivó el ítem, y el único que no se arregla del lado de quien
   * entra: el dominio propio no está en la lista de Auth. El mensaje tiene que
   * decir eso y **no ofrecer reintentar**, porque reintentar no va a funcionar
   * nunca.
   */
  it('el dominio sin autorizar se nombra, y no se ofrece reintentar', () => {
    const m = motivoDeLoginFallido(conCodigo('auth/unauthorized-domain'));
    expect(m.reintentable).toBe(false);
    expect(m.texto.toLowerCase()).toContain('dominio');
    // Y da la salida que sí funciona hoy, en vez de dejar a la persona sin nada.
    expect(m.texto).toContain('agenda-literaria.web.app');
  });

  it('el acceso deshabilitado tampoco se reintenta', () => {
    expect(motivoDeLoginFallido(conCodigo('auth/operation-not-allowed')).reintentable).toBe(false);
  });

  /*
   * Cerrar el popup no es un error: si eso saliera en rojo, el mensaje más
   * frecuente del panel sería un falso problema.
   */
  it('cerrar el popup no se cuenta como falla del sistema', () => {
    for (const code of [
      'auth/popup-closed-by-user',
      'auth/cancelled-popup-request',
      'auth/user-cancelled',
    ]) {
      const m = motivoDeLoginFallido(conCodigo(code));
      expect(m.reintentable, code).toBe(true);
      expect(m.texto.toLowerCase(), code).not.toContain('error');
    }
  });

  /*
   * **La clase.** Un código que este módulo no conoce tiene que salir **con el
   * código a la vista**: es lo único que permite reportarlo. Es literalmente la
   * lección de B-590, donde el mensaje genérico escondía la causa durante tres
   * reportes.
   */
  it('un código desconocido se muestra, no se esconde', () => {
    const m = motivoDeLoginFallido(conCodigo('auth/algo-que-no-existe-todavia'));
    expect(m.texto).toContain('auth/algo-que-no-existe-todavia');
  });

  it('y sin código no se inventa una causa', () => {
    for (const raro of [undefined, null, 'texto pelado', new Error('sin code'), {}]) {
      const m = motivoDeLoginFallido(raro);
      expect(m.texto.length, String(raro)).toBeGreaterThan(20);
      // Lo que NO puede hacer es afirmar un motivo que no conoce.
      expect(m.texto.toLowerCase(), String(raro)).not.toContain('dominio');
      expect(m.texto.toLowerCase(), String(raro)).not.toContain('conexión');
    }
  });

  it('ningún motivo sale vacío ni con el código pelado como mensaje', () => {
    for (const code of [
      'auth/unauthorized-domain',
      'auth/operation-not-allowed',
      'auth/popup-blocked',
      'auth/network-request-failed',
      'auth/too-many-requests',
    ]) {
      const { texto } = motivoDeLoginFallido(conCodigo(code));
      expect(texto.trim().length, code).toBeGreaterThan(30);
      expect(texto, code).not.toBe(code);
    }
  });
});

describe('la pantalla de login usa el motivo, y no se come el error', () => {
  /*
   * El bug era del cableado, no del texto: **un módulo puro perfecto con
   * `void loginConGoogle()` en el botón no arregla nada.** Esto barre el fuente
   * porque es lo único que puede afirmarlo sin un test de render.
   *
   * MUTACIÓN PROBADA: volver el `onClick` a `void loginConGoogle()` deja este
   * caso en rojo.
   */
  /*
   * **Sin comentarios**, y hace falta: el docblock del arreglo explica el bug
   * nombrando `void loginConGoogle()`, así que un barrido sobre el texto crudo
   * fallaría contra su propia documentación — y la salida fácil sería dejar de
   * explicarlo. Es el mismo recorte que hacen `pagina-de-detalle.test.ts` y
   * `listado-del-sitio.test.ts`.
   */
  const fuente = () =>
    readFileSync(fileURLToPath(new URL('../src/components/admin/AdminApp.tsx', import.meta.url)), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');

  it('el botón no descarta la promesa del login', () => {
    expect(fuente()).not.toMatch(/void\s+loginConGoogle\(\)/);
  });

  it('y el motivo se muestra en pantalla', () => {
    const src = fuente();
    expect(src).toContain('motivoDeLoginFallido');
    expect(src).toContain('role="alert"');
  });
});
