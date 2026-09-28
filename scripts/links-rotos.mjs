#!/usr/bin/env node
/**
 * **Los links del sitio que se rompieron** — roadmap 5.5.
 *
 * El formulario de inscripción, la web del organizador, el link del material de
 * lectura, la web de una librería de la Guía: son de terceros y se rompen sin
 * avisar. Hoy nadie se entera hasta que alguien escribe. Este script recorre el
 * sitio publicado, junta cada link a un sitio de afuera, lo prueba **una vez**
 * aunque aparezca en diez páginas, y deja un informe de qué está roto y en qué
 * páginas.
 *
 * ── Por qué lee el sitio publicado y no Firestore ─────────────────────────
 * Porque así **solo puede ver lo que ya es público**. El link de la reunión que
 * no se publica (§5.1) no está en ninguna página, así que el script no lo puede
 * pedir aunque quiera: la garantía es de construcción y no de un filtro que hay
 * que acordarse de mantener. Y no necesita credenciales, así que lo corre
 * cualquiera. Las páginas salen del `sitemap.xml`, que es la lista de lo que el
 * sitio ofrece (B-109); una sección nueva entra sola.
 *
 * ── Qué no prueba, y por qué ───────────────────────────────────────────────
 * - **Lo nuestro** (el sitio, las imágenes del bucket) y **lo que arma el sitio**
 *   (el mapa de Google, los botones de compartir, la suscripción al calendario):
 *   no los carga nadie a mano, así que no se rompen por un dato.
 * - **Instagram y Facebook**: contestan mal a cualquier robot —un login, un 429—
 *   aunque la cuenta exista. Probarlos llenaría el informe de falsos positivos,
 *   que es como un informe se aprende a ignorar. Se cuentan como «no
 *   verificables» y se nombran, sin veredicto.
 *
 * ── Tres veredictos y no dos ──────────────────────────────────────────────
 * `roto` es lo que seguro no anda: 404, 410, o un dominio que ya no existe.
 * `dudoso` es lo que falló de una forma que puede ser del robot y no del link
 * —403, 429, 5xx, un timeout—: se mira a mano. Mezclarlos haría que el primer
 * 403 de un sitio con antibots convierta a todo el informe en sospechoso.
 *
 * **No es parte de ningún gate**: depende de la red y de sitios ajenos (B-180).
 * Es a pedido; si sirve, se programa después.
 *
 * Uso:
 *   node scripts/links-rotos.mjs                  # informe en .informes/
 *   SITIO=https://agenda-literaria.web.app node scripts/links-rotos.mjs
 *   node scripts/links-rotos.mjs --solo=actividad # solo las páginas de actividad
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

// ── Lo puro: qué se prueba y cómo se lee la respuesta ──────────────────────

/** Hosts que no se prueban: nuestros, armados por el sitio, o que no contestan a robots. */
export const HOSTS_PROPIOS = ['agendaleh.ar', 'agenda-literaria.web.app', 'firebasestorage.googleapis.com'];
export const HOSTS_ARMADOS = [
  'google.com', // el mapa (`/maps/search`) y la suscripción al calendario
  'calendar.google.com',
  'wa.me',
  'api.whatsapp.com',
  'twitter.com',
  'x.com',
  't.me',
  'cafecito.app',
];
export const HOSTS_NO_VERIFICABLES = ['instagram.com', 'facebook.com', 'fb.com', 'threads.net', 'tiktok.com'];

const esDe = (host, lista) => lista.some((h) => host === h || host.endsWith(`.${h}`));

/** Desescapa lo que un `href` trae escrito en HTML. */
const desescapar = (s) =>
  s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

/**
 * Los links a sitios de afuera de una página, sin repetir, y separados en los que
 * se prueban y los que no se pueden verificar. Solo `http(s)`: un `mailto:` o un
 * `tel:` no se rompen de esta forma.
 */
export const linksDeLaPagina = (html) => {
  const aProbar = new Set();
  const noVerificables = new Set();
  for (const m of html.matchAll(/<a\b[^>]*\bhref\s*=\s*"([^"]+)"/gi)) {
    let url;
    try {
      url = new URL(desescapar(m[1]));
    } catch {
      continue;
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') continue;
    const host = url.hostname.toLowerCase();
    if (esDe(host, HOSTS_PROPIOS) || esDe(host, HOSTS_ARMADOS)) continue;
    url.hash = '';
    (esDe(host, HOSTS_NO_VERIFICABLES) ? noVerificables : aProbar).add(url.href);
  }
  return { aProbar: [...aProbar], noVerificables: [...noVerificables] };
};

/**
 * Las URLs del `sitemap.xml`, opcionalmente solo las de una sección (`actividad`, `guia`…).
 *
 * @param {string} xml
 * @param {string | null} [solo]
 */
export const paginasDelSitemap = (xml, solo = null) =>
  [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)]
    .map((m) => desescapar(m[1]))
    .filter((u) => !solo || new URL(u).pathname.split('/')[1] === solo);

/**
 * El veredicto de un intento: `{ status }` si hubo respuesta, `{ error }` si no.
 * El `code` del error es el de Node (`ENOTFOUND`, …), que viaja en `cause`.
 */
export const veredicto = (intento) => {
  if ('status' in intento) {
    const s = intento.status;
    if (s >= 200 && s < 400) return 'ok';
    if (s === 404 || s === 410) return 'roto';
    return 'dudoso';
  }
  const code = intento.error?.cause?.code ?? intento.error?.code ?? '';
  // El dominio ya no existe o no atiende: no es el robot, es el link.
  if (['ENOTFOUND', 'ECONNREFUSED', 'ERR_TLS_CERT_ALTNAME_INVALID', 'CERT_HAS_EXPIRED'].includes(code))
    return 'roto';
  return 'dudoso';
};

/** Cómo se dice el motivo en el informe. */
export const motivo = (intento) =>
  'status' in intento
    ? `HTTP ${intento.status}`
    : (intento.error?.cause?.code ?? intento.error?.code ?? intento.error?.name ?? 'error');

/**
 * El informe en markdown: primero lo roto, después lo dudoso, cada link con las
 * páginas donde aparece. Lo que anda no se lista: es la mayoría y no pide nada.
 */
export const informe = ({ sitio, fecha, paginas, resultados, noVerificables }) => {
  const de = (v) => resultados.filter((r) => r.veredicto === v);
  const bloque = (titulo, filas) =>
    filas.length === 0
      ? [`## ${titulo}`, '', 'Ninguno.', '']
      : [
          `## ${titulo} (${filas.length})`,
          '',
          ...filas.flatMap((r) => [
            `- ${r.url} — **${r.motivo}**`,
            ...r.paginas.map((p) => `  - en ${p.replace(sitio, '') || '/'}`),
          ]),
          '',
        ];
  return [
    `# Links rotos — ${fecha}`,
    '',
    `Sitio: ${sitio} · ${paginas} páginas · ${resultados.length} links de afuera probados · ` +
      `${de('ok').length} andan · ${noVerificables.length} de Instagram y afines sin verificar.`,
    '',
    ...bloque('Rotos', de('roto')),
    ...bloque('Dudosos — mirarlos a mano, pueden ser del robot y no del link', de('dudoso')),
  ].join('\n');
};

// ── Lo que toca la red ──────────────────────────────────────────────────────

const AGENTE = 'AgendaLEH-links/1.0 (+https://agendaleh.ar; revisa que los links del sitio anden)';
const TIMEOUT_MS = 12_000;

const pedir = async (url, method) => {
  try {
    const r = await fetch(url, {
      method,
      redirect: 'follow',
      headers: { 'user-agent': AGENTE, accept: 'text/html,*/*' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    r.body?.cancel().catch(() => {});
    return { status: r.status };
  } catch (error) {
    return { error };
  }
};

/** HEAD primero; si no da un 2xx/3xx, GET, porque muchos servidores contestan mal al HEAD. */
const probar = async (url) => {
  const head = await pedir(url, 'HEAD');
  if (veredicto(head) === 'ok') return head;
  return pedir(url, 'GET');
};

/** Corre `fn` sobre `items` con a lo sumo `n` a la vez. */
const enTandas = async (items, n, fn) => {
  const salida = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const j = i++;
        salida[j] = await fn(items[j], j);
      }
    }),
  );
  return salida;
};

const main = async () => {
  const sitio = (process.env.SITIO ?? 'https://agendaleh.ar').replace(/\/$/, '');
  const solo = process.argv.find((a) => a.startsWith('--solo='))?.slice('--solo='.length) ?? null;

  const xml = await (await fetch(`${sitio}/sitemap.xml`)).text();
  const paginas = paginasDelSitemap(xml, solo);
  console.log(`Leyendo ${paginas.length} páginas de ${sitio}…`);

  /** link → páginas donde aparece */
  const donde = new Map();
  const noVerificables = new Set();
  await enTandas(paginas, 8, async (pagina) => {
    const r = await fetch(pagina, { headers: { 'user-agent': AGENTE } }).catch(() => null);
    if (!r?.ok) return console.warn(`  no se pudo leer ${pagina} (${r?.status ?? 'sin respuesta'})`);
    const { aProbar, noVerificables: nv } = linksDeLaPagina(await r.text());
    for (const u of aProbar) donde.set(u, [...(donde.get(u) ?? []), pagina]);
    for (const u of nv) noVerificables.add(u);
  });

  const links = [...donde.keys()].sort();
  console.log(`Probando ${links.length} links de afuera…`);
  const resultados = await enTandas(links, 6, async (url) => {
    const intento = await probar(url);
    return { url, veredicto: veredicto(intento), motivo: motivo(intento), paginas: donde.get(url).sort() };
  });

  const fecha = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' });
  const texto = informe({ sitio, fecha, paginas: paginas.length, resultados, noVerificables: [...noVerificables] });
  const dir = fileURLToPath(new URL('../.informes/', import.meta.url));
  mkdirSync(dir, { recursive: true });
  const ruta = `${dir}links-rotos-${fecha}.md`;
  writeFileSync(ruta, texto + '\n');

  const rotos = resultados.filter((r) => r.veredicto === 'roto').length;
  const dudosos = resultados.filter((r) => r.veredicto === 'dudoso').length;
  console.log(`\n${rotos} rotos · ${dudosos} dudosos · informe en .informes/links-rotos-${fecha}.md`);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e);
    process.exit(2);
  });
}
