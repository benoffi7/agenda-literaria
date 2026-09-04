/**
 * B-77 — el cliente HTTP de GitHub, en su propio módulo y con el `fetch`
 * inyectable.
 *
 * Vivía inline en `index.js`, que era el único archivo de `functions/` sin el
 * corte puro/trigger. **Y ya se cobró una**: el cliente se duplicó sin el timeout
 * (B-74), que es exactamente lo que pasa cuando el pegamento y la decisión están
 * en el mismo lugar — se copia el pegamento y se pierde la decisión.
 *
 * `fetch` entra como parámetro con default por el mismo motivo que el reloj de
 * `rebuild.js` (`05-patrones.md` § «El reloj también es infraestructura»): así el
 * test puede provocar un 401, un cuerpo vacío o un socket colgado sin red y sin
 * un PAT de verdad, que es lo único que hace verificable el manejo de errores.
 *
 * **El parámetro se llama `fetch` y tapa al global, a propósito.** Un nombre
 * distinto (`hacerFetch`) dejaba el cuerpo diciendo algo que no es `fetch(`, y
 * el detector de llamadas a la red de `tests/clases-de-bug.test.ts` —que es el
 * que le exige la transacción a `dispararRebuild` (B-85)— dejaba de encontrarla:
 * el chequeo pasaba en verde sin mirar nada. El default es `globalThis.fetch` y
 * no `fetch`: en la lista de parámetros, `fetch` ya es el binding nuevo, así que
 * `fetch = fetch` sería una referencia en zona muerta.
 *
 * No importa `firebase-admin` ni `firebase-functions`.
 */

/**
 * Timeout del dispatch. Sin esto un socket colgado se come el tick entero del
 * schedule, y el sitio queda viejo sin que nada lo diga.
 */
export const TIMEOUT_DISPATCH_MS = 15_000;

/**
 * El cuerpo del `repository_dispatch`. Puro y aparte para poder afirmar por
 * valor lo que el workflow lee: `event_type` tiene que ser exactamente
 * `'rebuild'` —es lo que `.github/workflows/deploy.yml` declara en
 * `types: [rebuild]`— y un typo ahí no falla, simplemente no dispara nada
 * (trampa 11 con otra cara).
 */
export const cuerpoDeDispatch = (motivo) => ({
  event_type: 'rebuild',
  // El motivo viaja al workflow para que el run diga qué lo disparó.
  client_payload: { motivo: motivo ?? 'sin motivo' },
});

/**
 * Dispara el `repository_dispatch` que arranca el workflow de build
 * (`.github/workflows/deploy.yml`, `types: [rebuild]`).
 *
 * Devuelve `null` si salió bien, o el mensaje del error para guardarlo en el
 * documento. **No tira**: el que decide qué hacer con el fallo es el schedule
 * (`registrarFallo`, backoff y corte por intentos — D-23).
 */
export const dispararDispatch = async (repo, token, motivo, fetch = globalThis.fetch) => {
  try {
    const r = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(cuerpoDeDispatch(motivo)),
      signal: AbortSignal.timeout(TIMEOUT_DISPATCH_MS),
    });
    if (r.ok) return null;
    // El cuerpo trae el porqué real ("Bad credentials", "Not Found" si el PAT
    // no ve el repo). Sin él, un 404 y un PAT vencido se ven igual.
    const cuerpo = await r.text().catch(() => '');
    return `HTTP ${r.status} ${cuerpo}`.trim();
  } catch (e) {
    return e?.message ?? String(e);
  }
};
