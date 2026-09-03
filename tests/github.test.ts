/**
 * B-77 — el cliente HTTP de GitHub, ahora que se puede testear.
 *
 * Vivía inline en `functions/index.js`, el único archivo de `functions/` sin el
 * corte puro/trigger y sin ningún test. **Y ya se había cobrado una**: el cliente
 * se duplicó sin el timeout (B-74). Con el `fetch` inyectable, lo que antes solo
 * se podía verificar en producción —un 401, un cuerpo vacío, un socket colgado—
 * se verifica acá.
 *
 * Lo que NO se prueba acá es qué hace el schedule con el resultado: eso es
 * `decidirDisparo`/`registrarFallo` y vive en `tests/rebuild.test.ts`. El corte
 * entre los dos es justamente lo que este módulo hizo posible.
 */
import { describe, expect, it } from 'vitest';
import {
  TIMEOUT_DISPATCH_MS,
  cuerpoDeDispatch,
  dispararDispatch,
} from '../functions/github.js';

const REPO = 'benoffi7/agenda-literaria';

/**
 * Un `fetch` de mentira que registra con qué lo llamaron.
 *
 * La firma se declara como la del global —`typeof fetch`— y no como
 * `(url: string, …)`: `dispararDispatch` recibe el default `globalThis.fetch`,
 * así que el parámetro tiene ese tipo y un doble más angosto no encaja. Es la
 * inyección funcionando: el compilador exige que el doble sea sustituible por lo
 * real.
 */
const fetchQueDevuelve = (respuesta: unknown) => {
  const llamadas: [string, RequestInit][] = [];
  const fake: typeof fetch = async (url, opciones) => {
    llamadas.push([String(url), opciones ?? {}]);
    if (respuesta instanceof Error) throw respuesta;
    return respuesta as Response;
  };
  return { fake, llamadas };
};

const ok = { ok: true, status: 204, text: async () => '' };

describe('cuerpoDeDispatch — lo que el workflow lee (§8)', () => {
  it('el `event_type` es exactamente `rebuild`', () => {
    /*
     * `.github/workflows/deploy.yml` declara `types: [rebuild]`. Un typo acá no
     * falla: GitHub acepta el dispatch y no dispara nada, así que el sitio queda
     * viejo y del lado de la Function todo se ve bien. Es la trampa 11 con otra
     * cara, y por eso el valor se afirma y no se describe.
     */
    expect(cuerpoDeDispatch('actividad abc').event_type).toBe('rebuild');
  });

  it('el motivo viaja al workflow, y sin motivo va un texto y no `undefined`', () => {
    expect(cuerpoDeDispatch('opciones/tags').client_payload).toEqual({ motivo: 'opciones/tags' });
    // `undefined` en un JSON se serializa como clave ausente, y el run del
    // workflow quedaría sin decir qué lo disparó. `null` idem.
    for (const sinMotivo of [undefined, null]) {
      expect(cuerpoDeDispatch(sinMotivo as unknown as string).client_payload.motivo).toBe(
        'sin motivo',
      );
    }
  });

  it('el string vacío pasa tal cual, y eso es `??` y no un descuido', () => {
    /*
     * `motivo ?? 'sin motivo'` no cubre `''`. Se deja así y se fija acá para que
     * el comportamiento sea una decisión y no una sorpresa: cambiarlo a `||`
     * sería una modificación de conducta metida adentro de un refactor (B-77),
     * y el caso no es alcanzable — el único que llama a esto es
     * `dispararRebuild` con `estado.motivo`, que lo escribió `marcarRebuild` con
     * una plantilla (`actividad ${id}`, `opciones/${campo}`) que nunca da vacío.
     *
     * Si algún día `motivo` llega vacío, el run del workflow lo va a decir con
     * un motivo en blanco — visible, no silencioso.
     */
    expect(cuerpoDeDispatch('').client_payload.motivo).toBe('');
  });
});

describe('dispararDispatch — el efecto y sus fallas (B-77, B-74)', () => {
  it('con 2xx devuelve null: no hay nada que registrar', async () => {
    const { fake, llamadas } = fetchQueDevuelve(ok);
    expect(await dispararDispatch(REPO, 'tok', 'actividad abc', fake)).toBeNull();
    expect(llamadas).toHaveLength(1);
  });

  it('le pega al repo que se le pasa, con el PAT y la versión de la API', async () => {
    const { fake, llamadas } = fetchQueDevuelve(ok);
    await dispararDispatch(REPO, 'ghp_secreto', 'actividad abc', fake);

    const [url, opciones] = llamadas[0]!;
    expect(url).toBe(`https://api.github.com/repos/${REPO}/dispatches`);
    expect(opciones.method).toBe('POST');
    const headers = opciones.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer ghp_secreto');
    // Sin la versión pineada, un cambio de default de la API rompe el lazo del
    // §8 sin aviso.
    expect(headers['X-GitHub-Api-Version']).toBe('2022-11-28');
    expect(JSON.parse(opciones.body as string)).toEqual(cuerpoDeDispatch('actividad abc'));
  });

  it('B-74: siempre manda un `signal` con timeout', async () => {
    /*
     * La regresión concreta de B-74: la copia del cliente se hizo sin el
     * timeout, y un socket colgado se come el tick entero del schedule. Se
     * verifica que el `signal` esté, no solo que la constante exista — una
     * constante declarada y no usada es exactamente el bug que se quiere
     * evitar.
     */
    const { fake, llamadas } = fetchQueDevuelve(ok);
    await dispararDispatch(REPO, 'tok', 'x', fake);
    expect(llamadas[0]![1].signal).toBeInstanceOf(AbortSignal);
    expect(TIMEOUT_DISPATCH_MS).toBe(15_000);
  });

  it('con un status de error devuelve el código Y el cuerpo', async () => {
    // Sin el cuerpo, un 404 por repo mal escrito y un PAT vencido se ven igual
    // en el log — y son dos arreglos distintos.
    const { fake } = fetchQueDevuelve({
      ok: false,
      status: 401,
      text: async () => '{"message":"Bad credentials"}',
    });
    const error = await dispararDispatch(REPO, 'vencido', 'x', fake);
    expect(error).toContain('401');
    expect(error).toContain('Bad credentials');
  });

  it('si el cuerpo del error no se puede leer, igual devuelve el status', async () => {
    const { fake } = fetchQueDevuelve({
      ok: false,
      status: 502,
      text: async () => {
        throw new Error('stream cortado');
      },
    });
    // El `.catch(() => '')` del cuerpo: un cuerpo ilegible no puede convertir un
    // 502 en «no falló», ni en una excepción que el schedule no espera.
    expect(await dispararDispatch(REPO, 'tok', 'x', fake)).toBe('HTTP 502');
  });

  it('un fetch que tira no propaga la excepción: devuelve el mensaje', async () => {
    /*
     * Es lo que hace que el schedule pueda decidir. `dispararRebuild` llama a
     * esto y con el resultado arma `registrarFallo`: si acá se propagara la
     * excepción, el tick moriría sin escribir el intento y el backoff (D-23)
     * nunca avanzaría — se reintentaría para siempre, cada 5 minutos.
     */
    const { fake } = fetchQueDevuelve(new Error('The operation was aborted'));
    expect(await dispararDispatch(REPO, 'tok', 'x', fake)).toBe('The operation was aborted');
  });

  it('un fetch que tira algo que no es Error tampoco rompe', async () => {
    const { fake } = fetchQueDevuelve(Object.assign(new Error(), { message: undefined }));
    const error = await dispararDispatch(REPO, 'tok', 'x', fake);
    expect(typeof error).toBe('string');
  });

  it('el PAT no aparece en el mensaje de error', async () => {
    // El mensaje se guarda en `sistema/rebuild.ultimoError` y se loguea. El
    // documento lo lee un admin y el log un dev, pero un secreto que viaja a un
    // campo de datos es un secreto que dejó de estar en Secret Manager (§5.4).
    const { fake } = fetchQueDevuelve({
      ok: false,
      status: 401,
      text: async () => 'Bad credentials',
    });
    const error = await dispararDispatch(REPO, 'ghp_secretisimo', 'x', fake);
    expect(error).not.toContain('ghp_secretisimo');
  });
});
