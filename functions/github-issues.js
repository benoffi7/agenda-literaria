/**
 * Crear un issue en GitHub. Cliente HTTP, con el `fetch` inyectable.
 *
 * ── Por qué este archivo existe, y qué hay que hacer con él ───────────────
 *
 * Esta llamada ya estaba escrita **inline dentro de `reportes-trigger.js`**, y
 * B-882 necesita la misma. Copiarla es exactamente el error que B-74 ya cobró:
 * el cliente del `repository_dispatch` se duplicó y **la copia perdió el
 * timeout**, que es la decisión que el pegamento arrastraba sin declararla. B-77
 * sacó ése a `github.js` por eso mismo.
 *
 * Así que va acá, en un módulo, y `reportes-trigger.js` tiene que pasar a
 * importarlo y borrar su copia — es un cambio de cuatro líneas que quedó
 * **propuesto y sin aplicar** porque ese archivo lo está tocando otro frente.
 * Mientras tanto hay dos copias y eso está dicho en voz alta, que es lo único
 * que evita que la segunda envejezca sola.
 *
 * Vive aparte de `github.js` —que tiene el `repository_dispatch`— por la misma
 * razón: `github.js` también es de otro frente hoy. Si algún día los dos están
 * quietos, esto son doce líneas que se mudan.
 *
 * **El parámetro se llama `fetch` y tapa al global, a propósito**, igual que en
 * `github.js`: el detector de llamadas a la red de `tests/clases-de-bug.test.ts`
 * busca `fetch(` en el texto, y un nombre distinto lo dejaría ciego justo en la
 * función que habla con afuera.
 *
 * No importa `firebase-admin` ni `firebase-functions`.
 */

const API = 'https://api.github.com';

/**
 * Timeout de la llamada. Sin esto un socket colgado se come la invocación
 * entera hasta el timeout de la plataforma (B-74). Es el mismo valor que las
 * otras dos llamadas a GitHub del proyecto.
 */
export const TIMEOUT_ISSUE_MS = 15_000;

/**
 * Crea el issue. Devuelve `{ ok, numero, url }` o `{ ok: false, status, mensaje }`.
 *
 * **No tira**: quien decide qué hacer con el fallo es el llamador, que es el que
 * sabe si esto se reintenta o se registra.
 */
export const crearIssue = async ({ repo, token, issue }, fetch = globalThis.fetch) => {
  let r;
  try {
    r = await fetch(`${API}/repos/${repo}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        'User-Agent': 'agenda-literaria',
      },
      body: JSON.stringify(issue),
      signal: AbortSignal.timeout(TIMEOUT_ISSUE_MS),
    });
  } catch (e) {
    // Sin status: error de red.
    return { ok: false, status: null, mensaje: e?.message ?? 'error de red' };
  }
  if (!r.ok) {
    // El cuerpo trae el porqué real ("Bad credentials", "Not Found" si el PAT no
    // ve el repo). Sin él, un 404 y un token vencido se ven igual.
    const texto = await r.text().catch(() => '');
    return { ok: false, status: r.status, mensaje: `GitHub ${r.status}: ${texto.slice(0, 300)}` };
  }
  const datos = await r.json().catch(() => ({}));
  return { ok: true, numero: datos?.number ?? null, url: datos?.html_url ?? null };
};
