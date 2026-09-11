import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { correrGate, paginaLimpia } from './fixtures/artefacto';

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
 * ── Qué verifica el barrido, y qué NO ──────────────────────────────────────
 * Lee el **HTML construido** (no el fuente: un chequeo sobre el fuente tendría
 * que reimplementar el parser de Astro, la misma razón por la que el barrido de
 * B-261 también mira el artefacto) y exige que todo host de un
 * `<link rel="preconnect"|"dns-prefetch"|"prefetch"|"preload"|"stylesheet">`,
 * `<script src="...">` o `<iframe src="...">` **absoluto** esté en la lista
 * blanca, con su motivo escrito al lado.
 *
 * **No mira `<img>`.** Una actividad puede traer una imagen externa (un flyer
 * en Instagram, por decisión de producto — D-131 y compañía): ese host varía
 * por documento, ya es una salida pública decidida y auditada en
 * `07-seguridad.md`, y no tiene nada que ver con el consentimiento de
 * analítica. Lo que este chequeo cuida es la **infraestructura fija** que
 * sale igual en todas las páginas porque viene de un layout o componente
 * compartido — que es exactamente la clase de bug que causó esto.
 *
 * ── La lista blanca está VACÍA, y eso es el estado final — B-481 ───────────
 * Cuando esto se escribió tenía dos entradas, las dos de tipografía
 * (`fonts.googleapis.com` y `fonts.gstatic.com`, B-260): anteriores a la
 * analítica, decididas antes de que existiera un banner, y anotadas como
 * pendiente y no como aceptado. **B-481 las sacó**: las tres familias se
 * sirven desde `/fuentes/` de este mismo dominio, declaradas con `@font-face`
 * en `src/styles/global.css`.
 *
 * Así que hoy la respuesta correcta es **cero hosts**, y por eso la lista sigue
 * existiendo vacía en vez de borrada: agregar un tercero es agregarle una
 * entrada, con el motivo escrito, y eso se lee en una review. Un `preconnect`
 * puesto de paso, no.
 *
 * ── El barrido ya no vive acá, y el motivo es B-873 ───────────────────────
 * **Hasta el 2026-09-11 este archivo leía el `dist/` del repo y se salteaba si no
 * estaba**, con esta frase escrita en el docblock: «en CI el build siempre corre,
 * así que ahí no se saltea nunca». Era falsa, y medida contra los dos workflows:
 * en `deploy.yml` el paso `Tests` es el 4 y `Build` el 5; en `push-main.yml` los
 * tests son el job `verificar`, que no buildea nunca, y el build es el job
 * `hosting`, otro runner. Reproducido moviendo el `dist/` local: la suite sale
 * **verde con los casos salteados y estado 0**, sin decir una palabra.
 *
 * O sea que **la promesa de D-254 dependía de que alguien hubiera buildeado a
 * mano antes de correr la suite**, y la red de contención la contaba como
 * cubierta igual. El barrido está ahora en `scripts/verificar-bundle.sh`,
 * sección 3, que es el paso post-build de los dos workflows y el paso 5 de
 * `verificar-todo.sh`. Lo que queda acá es probar ese barrido con artefactos
 * sintéticos: **ningún caso de este archivo depende de que exista un build**.
 */
const raiz = (rel: string): string => fileURLToPath(new URL(`../${rel}`, import.meta.url));

/** Una página con las etiquetas que el caso quiera, sobre un esqueleto válido. */
const paginaCon = (etiquetas: string): string =>
  `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Agenda</title>${etiquetas}` +
  '</head><body><h1>Agenda</h1></body></html>';

describe('el gate atrapa un tercero contactado antes del consentimiento — D-254', () => {
  it('el `preconnect` a googletagmanager lo pone en rojo, nombrando el host', () => {
    /*
     * La forma exacta de D-254: la etiqueta que estuvo publicada en `Base.astro`,
     * sin condición de consentimiento, saliendo también para quien rechaza.
     */
    const { estado, salida } = correrGate({
      'index.html': paginaCon('<link rel="preconnect" href="https://www.googletagmanager.com">'),
    });
    expect(estado).not.toBe(0);
    expect(salida).toContain('un host de tercero aparece en el HTML sin pasar por el consentimiento');
    expect(salida, 'el error no nombra el host').toContain('www.googletagmanager.com');
    expect(salida, 'el error no dice en qué página').toContain('index.html');
  });

  it.each([
    ['preconnect', '<link rel="preconnect" href="https://ejemplo-uno.com">', 'ejemplo-uno.com'],
    ['dns-prefetch', '<link rel="dns-prefetch" href="https://ejemplo-dos.com">', 'ejemplo-dos.com'],
    ['stylesheet', `<link rel='stylesheet' href='https://ejemplo-tres.com/x.css'>`, 'ejemplo-tres.com'],
    [
      'preload',
      '<link rel="preload" as="font" href="https://ejemplo-cuatro.com/f.woff2" crossorigin>',
      'ejemplo-cuatro.com',
    ],
    ['prefetch', '<link rel="prefetch" href="https://ejemplo-cinco.com/a">', 'ejemplo-cinco.com'],
    ['script src', '<script src="https://ejemplo-seis.com/t.js"></script>', 'ejemplo-seis.com'],
    ['iframe src', '<iframe src="https://ejemplo-siete.com/e"></iframe>', 'ejemplo-siete.com'],
  ])('también lo atrapa por %s', (_que, etiqueta, host) => {
    /*
     * **Control positivo de las tres etiquetas y las cinco `rel` de una.** Con la
     * lista blanca vacía no queda un solo tercero en el artefacto real, así que
     * un control «encontrá el host que sabemos que está» sería imposible sin
     * reponer un tercero para que el control tenga qué encontrar. Sintético es
     * más fuerte: si el parseo se rompe, esto falla aunque el `dist/` esté
     * impecable.
     */
    const { estado, salida } = correrGate({ 'index.html': paginaCon(etiqueta) });
    expect(estado).not.toBe(0);
    expect(salida).toContain(host);
  });

  it('un `<img>` externo NO lo pone en rojo — es una decisión de producto (D-131)', () => {
    const { estado, salida } = correrGate({
      'index.html': paginaLimpia('Agenda').replace(
        '<h1>',
        '<img src="https://scontent.cdninstagram.com/flyer.jpg" alt="flyer"><h1>',
      ),
    });
    expect(estado, salida).toBe(0);
  });

  it('ni lo relativo del propio dominio, que es todo lo que el sitio sirve hoy', () => {
    const { estado, salida } = correrGate({
      'index.html': paginaCon(
        '<link rel="icon" href="/marca.svg">' +
          '<link rel="preload" as="font" href="/fuentes/public-sans-v21-latin.woff2" crossorigin>' +
          '<link rel="stylesheet" href="/_astro/Base.css">',
      ),
    });
    expect(estado, salida).toBe(0);
  });
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
 *
 * El punto 1 se verifica contra el gate, por lo mismo que el bloque de arriba:
 * la hoja que importa es la **construida**, y el único lugar del pipeline donde
 * existe es el paso post-build (B-873). El punto 2 mira el fuente y nunca
 * dependió de un build.
 */
describe('las tipografías se sirven desde este dominio — B-481', () => {
  it.each([
    ["src: url('https://fonts.gstatic.com/s/publicsans/v21/x.woff2')", 'fonts.gstatic.com'],
    ["@import url('https://fonts.googleapis.com/css2?family=Fraunces');", 'fonts.googleapis.com'],
    ['@import "https://fonts.googleapis.com/css2?family=Fraunces";', 'fonts.googleapis.com'],
  ])('una hoja construida con %s es rojo', (linea, host) => {
    const { estado, salida } = correrGate({
      '_astro/Base.css': `@font-face{font-family:'Public Sans';${linea}}\n`,
    });
    expect(estado).not.toBe(0);
    expect(salida).toContain('una hoja de estilos construida sale a un host de tercero');
    expect(salida).toContain(host);
  });

  it('y un artefacto sin ninguna hoja es ROJO, no verde — la guarda de B-873', () => {
    /*
     * El mismo agujero que las páginas: un barrido sobre cero hojas pasa todos
     * los `expect` que se le pongan. El build siempre emite al menos la hoja del
     * layout, así que «no hay ninguna» es que el artefacto no es el artefacto.
     */
    const { estado, salida } = correrGate({ '_astro/Base.css': null });
    expect(estado).not.toBe(0);
    expect(salida).toContain('no tiene ninguna hoja de estilos');
    expect(salida).toContain('B-873');
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
