/**
 * **B-1250 — el cableado de las renovaciones**: que `activarAppCheck` se
 * suscriba con `onTokenChanged` y que cada aviso llegue al store del cartel.
 *
 * La regla de qué hace cada aviso está en `verificacion-del-navegador.test.ts`,
 * pura. Acá se afirma lo que ese test no ve: que alguien la llama, con la
 * instancia de verdad. Va en un archivo aparte porque necesita el SDK mockeado,
 * y `appcheck.test.ts` depende de que el `initializeAppCheck` real tire contra
 * una app de mentira.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FirebaseApp } from 'firebase/app';

const sdk = vi.hoisted(() => ({
  siguiente: null as null | ((r: unknown) => void),
  error: null as null | ((e: Error) => void),
  instancia: { app: {} },
}));

vi.mock('firebase/app-check', () => ({
  initializeAppCheck: vi.fn(() => sdk.instancia),
  ReCaptchaEnterpriseProvider: vi.fn(),
  getToken: vi.fn(() => Promise.resolve({ token: 'primero' })),
  onTokenChanged: vi.fn(
    (_instancia: unknown, siguiente: (r: unknown) => void, error: (e: Error) => void) => {
      sdk.siguiente = siguiente;
      sdk.error = error;
      return () => {};
    },
  ),
}));

const { _resetAppCheck, activarAppCheck, motivoSinAppCheck, pedidorDeToken } = await import(
  '@/lib/appcheck'
);
const { onTokenChanged } = await import('firebase/app-check');
const { _resetVerificacion, estadoDeVerificacion, verificarNavegador } = await import(
  '@/lib/verificacionDelNavegador'
);

const NAVEGADOR = { hayNavegador: true, usarEmuladores: false, claveDeSitio: 'clave' };

beforeEach(() => {
  _resetAppCheck();
  _resetVerificacion();
  sdk.siguiente = null;
  sdk.error = null;
  vi.mocked(onTokenChanged).mockClear();
});

/** Lo mismo que hace `verificarNavegadorAlArrancar`, sin `firebase-client`. */
const arrancarElPanel = async (): Promise<void> => {
  activarAppCheck({} as FirebaseApp, NAVEGADOR);
  await verificarNavegador({ motivo: motivoSinAppCheck(), pedirToken: pedidorDeToken() });
};

describe('las renovaciones llegan al cartel — B-1250', () => {
  it('al activar se suscribe una vez, sobre la instancia, con `siguiente` y `error`', () => {
    activarAppCheck({} as FirebaseApp, NAVEGADOR);
    activarAppCheck({} as FirebaseApp, NAVEGADOR);
    expect(onTokenChanged).toHaveBeenCalledTimes(1);
    expect(vi.mocked(onTokenChanged).mock.calls[0]![0]).toBe(sdk.instancia);
    expect(sdk.siguiente).toBeTypeOf('function');
    expect(sdk.error).toBeTypeOf('function');
  });

  it('con emuladores no se suscribe: no hay App Check que escuchar', () => {
    activarAppCheck({} as FirebaseApp, { ...NAVEGADOR, usarEmuladores: true });
    expect(onTokenChanged).not.toHaveBeenCalled();
  });

  it('una renovación que falla después de `verificado` pone el cartel, y la vuelta lo saca', async () => {
    await arrancarElPanel();
    expect(estadoDeVerificacion()).toBe('verificado');

    sdk.error!(new Error('appCheck/fetch-network-error'));
    expect(estadoDeVerificacion()).toBe('sin-verificar');

    sdk.siguiente!({ token: 'renovado' });
    expect(estadoDeVerificacion()).toBe('verificado');
  });

  it('si suscribirse tira, App Check queda activado igual', () => {
    vi.mocked(onTokenChanged).mockImplementationOnce(() => {
      throw new Error('sdk raro');
    });
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(activarAppCheck({} as FirebaseApp, NAVEGADOR)).toBe(sdk.instancia);
    expect(motivoSinAppCheck()).toBe(null);
    aviso.mockRestore();
  });
});
