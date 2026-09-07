import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

/**
 * Ningún host de tercero se contacta antes de que la persona decida — D-254.
 *
 * ── Qué pasó ──────────────────────────────────────────────────────────────
 * `Base.astro` tenía `<link rel="preconnect" href="https://www.googletagmanager.com">`
 * sin ninguna condición de consentimiento (solo `conChrome`, para no ofrecerlo
 * en `/admin`). Lo encontró el coordinador leyendo `dist/index.html`
 * de un build real, con un `grep` a mano — no un chequeo, así que la próxima
 * vez no había garantía de encontrarlo.
 *
 * Un `preconnect` **no es una pista pasiva**: el navegador resuelve DNS, abre
 * TCP y completa el handshake TLS (con SNI) **en el load**, antes de que
 * exista ningún script y sin que la persona haya tocado el banner. No manda
 * la URL ni cookies, pero sí le dice al borde de Google que este navegador,
 * desde esta IP, entró al sitio — y eso pasaba también para quien **rechaza**.
 * Contradice la promesa de D-250 («hasta que la persona decide, no se mide»)
 * y es exactamente lo que una auditoría de banner de cookies busca primero.
 *
 * ── Por qué no se condicionó, y se sacó ────────────────────────────────────
 * En un sitio estático el HTML es el mismo para todo el mundo: la decisión de
 * consentimiento vive en el `localStorage` de cada visitante, y `Base.astro`
 * no sabe cuál es cuando genera el HTML. Un `preconnect` condicional no
 * existe acá. Ponerlo por JavaScript, un instante antes de inyectar el script
 * del tag, tampoco ahorra nada: el pedido del script sale en el mismo tick.
 *
 * ── Qué verifica este archivo, y qué NO ────────────────────────────────────
 * Lee el **HTML construido** (no el fuente: un chequeo sobre el fuente tendría
 * que reimplementar el parser de Astro, la misma razón por la que
 * `tests/sin-comentarios-en-el-html.test.ts` también lee `dist/`) y exige que
 * todo host de un `<link rel="preconnect"|"dns-prefetch"|"prefetch"|"preload"|"stylesheet">`,
 * `<script src="...">` o `<iframe src="...">` **absoluto** esté en la lista
 * blanca de abajo, con su motivo escrito al lado.
 *
 * **No mira `<img>`.** Una actividad puede traer una imagen externa (un flyer
 * en Instagram, por decisión de producto — D-131 y compañía): ese host varía
 * por documento, ya es una salida pública decidida y auditada en
 * `07-seguridad.md`, y no tiene nada que ver con el consentimiento de
 * analítica. Lo que este chequeo cuida es la **infraestructura fija** que
 * sale igual en todas las páginas porque viene de un layout o componente
 * compartido — que es exactamente la clase de bug que causó esto.
 *
 * ── Requiere `dist/` ────────────────────────────────────────────────────────
 * Se saltea si no hay build, como los de emulador: correr `npm run build`
 * antes. En CI el build siempre corre, así que ahí no se saltea nunca.
 *
 * ── La lista blanca está VACÍA, y eso es el estado final — B-481 ───────────
 * Cuando este archivo se escribió tenía dos entradas, las dos de tipografía
 * (`fonts.googleapis.com` y `fonts.gstatic.com`, B-260): anteriores a la
 * analítica, decididas antes de que existiera un banner, y anotadas como
 * pendiente y no como aceptado. **B-481 las sacó**: las tres familias se
 * sirven desde `/fuentes/` de este mismo dominio, declaradas con `@font-face`
 * en `src/styles/global.css`.
 *
 * Así que hoy la respuesta correcta es **cero hosts**, y por eso la lista está
 * vacía en vez de borrada. Que siga existiendo como constante es el punto:
 * agregar un tercero es agregarle una entrada acá, con el motivo escrito, y
 * eso se lee en una review. Un `preconnect` puesto de paso, no.
 */
const PERMITIDOS: { host: string; motivo: string }[] = [];

const raiz = (rel: string): string => fileURLToPath(new URL(`../${rel}`, import.meta.url));

const paginas = (): string[] => {
  try {
    return execFileSync('find', [raiz('dist'), '-name', '*.html'], { encoding: 'utf8' })
      .split('\n')
      .filter(Boolean);
  } catch {
    return [];
  }
};

/** El host de una URL absoluta, o `null` si no lo es (relativa, `data:`, etc). */
const hostDe = (url: string): string | null => {
  if (!/^https?:\/\//i.test(url)) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
};

interface Hallazgo {
  etiqueta: string;
  host: string;
}

/**
 * Los hosts absolutos de las etiquetas que hacen una conexión propia en el
 * load: `<link>` de precarga/hoja de estilos, `<script src>` y `<iframe src>`.
 * Deliberadamente NO mira `<img>` — ver el docblock.
 */
const hostsDeInfraestructura = (html: string): Hallazgo[] => {
  const hallazgos: Hallazgo[] = [];

  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const etiqueta = m[0];
    const rel = /\brel=["']?([\w -]+)["']?/i.exec(etiqueta)?.[1]?.toLowerCase() ?? '';
    const esDeConexion = /(^|\s)(preconnect|dns-prefetch|prefetch|preload|stylesheet)(\s|$)/.test(
      rel,
    );
    if (!esDeConexion) continue;
    const href = /\bhref=["']([^"']+)["']/i.exec(etiqueta)?.[1];
    const host = href ? hostDe(href) : null;
    if (host) hallazgos.push({ etiqueta, host });
  }

  for (const m of html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) {
    const host = hostDe(m[1]!);
    if (host) hallazgos.push({ etiqueta: m[0], host });
  }

  for (const m of html.matchAll(/<iframe\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) {
    const host = hostDe(m[1]!);
    if (host) hallazgos.push({ etiqueta: m[0], host });
  }

  return hallazgos;
};

describe('ningún host de tercero se contacta antes del consentimiento — D-254', () => {
  const html = paginas();

  it.skipIf(html.length === 0)('el barrido encuentra páginas construidas', () => {
    // Control positivo: sin build, los asertos de abajo pasarían sin mirar nada.
    expect(html.length).toBeGreaterThan(2);
    expect(html.some((f) => f.endsWith('/index.html'))).toBe(true);
  });

  it('el parseo reconoce las tres etiquetas — control positivo sin depender del `dist/`', () => {
    /*
     * **Este caso cambió con B-481, y el motivo importa.** Antes verificaba que
     * el barrido encontrara alguno de los dos hosts de tipografía en el HTML
     * real: mientras hubiera un tercero permitido, encontrarlo probaba que el
     * regex seguía leyendo. Al autoalojar las fuentes **no queda ni un host de
     * tercero en el `dist/`**, así que ese control se volvió imposible — y
     * dejarlo habría forzado la conclusión equivocada: reponer un tercero para
     * que el control positivo tenga qué encontrar.
     *
     * El control se mueve entonces a un HTML **sintético**, que es más fuerte
     * que el anterior: no depende de que exista un build, ni de que el sitio
     * contacte a nadie, y prueba las tres etiquetas y las cinco `rel` de una.
     * Si el parseo se rompe, este caso falla aunque el `dist/` esté impecable.
     */
    const fixture = `
      <link rel="preconnect" href="https://ejemplo-uno.com" />
      <link rel="dns-prefetch" href="https://ejemplo-dos.com">
      <link rel='stylesheet' href='https://ejemplo-tres.com/x.css'>
      <link rel="preload" as="font" href="https://ejemplo-cuatro.com/f.woff2" crossorigin>
      <link rel="prefetch" href="https://ejemplo-cinco.com/a">
      <script src="https://ejemplo-seis.com/t.js"></script>
      <iframe src="https://ejemplo-siete.com/e"></iframe>
      <link rel="icon" href="/marca.svg" />
      <link rel="preload" as="font" href="/fuentes/public-sans-v21-latin.woff2" crossorigin>
      <img src="https://ejemplo-ocho.com/flyer.jpg" />
    `;
    const hosts = hostsDeInfraestructura(fixture).map((h) => h.host);
    expect(hosts.sort()).toEqual([
      'ejemplo-cinco.com',
      'ejemplo-cuatro.com',
      'ejemplo-dos.com',
      'ejemplo-seis.com',
      'ejemplo-siete.com',
      'ejemplo-tres.com',
      'ejemplo-uno.com',
    ]);
    // Y lo que NO tiene que ver: el `<img>` externo (decisión de producto,
    // D-131) y todo lo relativo del propio dominio.
    expect(hosts).not.toContain('ejemplo-ocho.com');
  });

  it.skipIf(html.length === 0)(
    'todo host de un <link> de conexión, <script> o <iframe> está en la lista blanca',
    () => {
      /*
       * MUTACIÓN PROBADA: se repuso a mano el
       * `<link rel="preconnect" href="https://www.googletagmanager.com">` en
       * `src/layouts/Base.astro`, se corrió `npm run build` y este `it` pasó
       * a rojo nombrando `www.googletagmanager.com` y el archivo exacto. Se
       * sacó de nuevo y se confirmó que vuelve a pasar.
       */
      const permitidos = new Set(PERMITIDOS.map((p) => p.host));
      const violaciones: string[] = [];

      for (const archivo of html) {
        const contenido = readFileSync(archivo, 'utf8');
        for (const h of hostsDeInfraestructura(contenido)) {
          if (!permitidos.has(h.host)) {
            const relativo = archivo.split('/dist/')[1] ?? archivo;
            violaciones.push(`${relativo} — ${h.host} — ${h.etiqueta.slice(0, 120)}`);
          }
        }
      }

      expect(
        violaciones,
        'un host de tercero aparece en el HTML sin pasar por el consentimiento. ' +
          'Si es legítimo (tipografía, CDN propio), agregalo a PERMITIDOS con el motivo ' +
          'escrito; si es analítica o un tercero de tracking, no se puede: tiene que ' +
          'inyectarse por JavaScript, condicionado a `debeCargarGA`/consentimiento ' +
          '(ver src/lib/medicionSitio.ts).',
      ).toEqual([]);
    },
  );
});

/**
 * Las tipografías no vuelven a salir a la red — **B-481**.
 *
 * El `describe` de arriba ya lo cubre por el lado del HTML: con la lista blanca
 * vacía, un `<link>` a `fonts.googleapis.com` lo hace fallar. Este bloque
 * agrega **lo que ese barrido no ve**, que es por donde volverían de verdad:
 *
 * 1. **El CSS.** Un `@import url('https://fonts.googleapis.com/...')` o un
 *    `src: url('https://fonts.gstatic.com/...')` dentro de una `@font-face`
 *    salen a la red igual que un `<link>`, y no aparecen en ninguna etiqueta
 *    del HTML. Es la puerta cómoda: una línea en `global.css` y las fuentes
 *    vuelven a Google sin que nada del `<head>` lo diga.
 * 2. **Que las `@font-face` propias existan y apunten a `/fuentes/`.** Sin este
 *    lado, borrar el bloque entero de `global.css` dejaría los dos casos de
 *    arriba en verde —cero terceros, porque cero fuentes— y el sitio se vería
 *    con las faces de respaldo del sistema. Un chequeo que solo prohíbe pasa
 *    con el archivo vacío.
 */
describe('las tipografías se sirven desde este dominio — B-481', () => {
  const hojas = (): string[] => {
    try {
      return execFileSync('find', [raiz('dist/_astro'), '-name', '*.css'], { encoding: 'utf8' })
        .split('\n')
        .filter(Boolean);
    } catch {
      return [];
    }
  };

  const css = hojas();

  it.skipIf(css.length === 0)('ninguna hoja construida referencia un host de tercero', () => {
    /*
     * MUTACIÓN PROBADA: se repuso en `src/styles/global.css` un
     * `src: url('https://fonts.gstatic.com/s/publicsans/v21/…woff2')` en la
     * `@font-face` de Public Sans, se corrió `npm run build`, y este caso pasó
     * a rojo nombrando `fonts.gstatic.com` y el archivo de la hoja. Se
     * restauró la URL local y volvió a pasar.
     */
    const violaciones: string[] = [];
    for (const archivo of css) {
      const contenido = readFileSync(archivo, 'utf8');
      for (const m of contenido.matchAll(/url\(\s*['"]?(https?:\/\/[^'")\s]+)/gi)) {
        violaciones.push(`${archivo.split('/dist/')[1] ?? archivo} — ${m[1]}`);
      }
      for (const m of contenido.matchAll(/@import\s+(?:url\()?\s*['"]?(https?:\/\/[^'")\s]+)/gi)) {
        violaciones.push(`${archivo.split('/dist/')[1] ?? archivo} — @import ${m[1]}`);
      }
    }
    expect(
      violaciones,
      'una hoja de estilos construida sale a un host de tercero. Las fuentes van ' +
        'en `public/fuentes/` y se declaran con `@font-face` apuntando a `/fuentes/…` ' +
        '(B-481); cualquier otro tercero es una conexión en el load y no puede ' +
        'condicionarse al consentimiento (D-254).',
    ).toEqual([]);
  });

  it('`global.css` declara las tres familias contra `/fuentes/`, y no contra Google', () => {
    const fuente = readFileSync(raiz('src/styles/global.css'), 'utf8');
    /*
     * Las seis faces: tres familias × dos subsets (`latin` y `latin-ext`). Se
     * cuenta `@font-face {`, con la llave: el docblock de `global.css` nombra
     * la regla en prosa para explicar qué subsets se bajaron y cuál no, y
     * castigar esa explicación empujaría a borrarla — el mismo criterio con el
     * que `sistema-visual.test.ts` lee el CSS sin comentarios.
     */
    expect((fuente.match(/@font-face\s*\{/g) ?? []).length).toBe(6);
    for (const familia of ['Archivo Narrow', 'Fraunces', 'Public Sans']) {
      expect(fuente, `falta la @font-face de ${familia}`).toContain(`font-family: '${familia}'`);
    }
    for (const archivo of [
      'archivo-narrow-v35-latin.woff2',
      'archivo-narrow-v35-latin-ext.woff2',
      'fraunces-v38-opsz72-latin.woff2',
      'fraunces-v38-opsz72-latin-ext.woff2',
      'public-sans-v21-latin.woff2',
      'public-sans-v21-latin-ext.woff2',
    ]) {
      expect(fuente, `la @font-face no apunta a /fuentes/${archivo}`).toContain(
        `url('/fuentes/${archivo}')`,
      );
      // Y el archivo está de verdad en `public/`: una ruta que no existe da un
      // 404 silencioso y el texto se pinta con la face de respaldo.
      expect(
        existsSync(raiz(`public/fuentes/${archivo}`)),
        `public/fuentes/${archivo} no está en el repo`,
      ).toBe(true);
    }
    /*
     * `swap` y no `optional`/`block`: es lo que pedía el `display=swap` del
     * `<link>` que se sacó, así que la primera carga se ve igual que antes.
     */
    expect((fuente.match(/font-display:\s*swap;/g) ?? []).length).toBe(6);
  });
});
