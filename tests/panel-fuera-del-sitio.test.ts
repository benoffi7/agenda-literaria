/**
 * **Ninguna página del sitio público alcanza la plomería del panel** — B-841.
 *
 * ── El agujero que esto cierra, y por qué ninguna red lo veía ──────────────
 * Lo encontró el `auditor-privacidad` sobre la tanda de B-830. `campos/` salió
 * de `admin/` para que lo usen los formularios públicos de `prd/`, pero tres de
 * sus seis archivos siguen importando hacia adentro, y la cadena real es larga:
 *
 *   campos/{Seccion,TagsInput,TaxonomiaSelect}
 *     → @/lib/analytics          (la medición del **panel**)
 *       → @/lib/firebase-client
 *         → @/lib/appcheck       (estático desde B-836a)
 *           → firebase/app-check
 *
 * O sea que un formulario público a un `import` de distancia haría **dos** cosas
 * en el navegador de un visitante anónimo:
 *
 * 1. **medir sin consentimiento.** `debeMedir` tiene tres portones —navegador,
 *    no-emuladores, `measurementId`— y **ninguno es el consentimiento**: la
 *    analítica del panel nunca lo necesitó. La del sitio (salida 12) sí lo tiene.
 *    Un `Seccion` en una página pública dispararía `funcion_usada` y crearía el
 *    perfil de medición en `localStorage` para alguien que no tocó el banner, en
 *    la misma propiedad de GA4 que comparten los dos (B-801). Contradice D-250 y
 *    la promesa de `/apoyar`.
 * 2. **cargar dos terceros de Google antes del consentimiento**: `gtag.js` y el
 *    desafío de reCAPTCHA, este último con cuota facturable por visitante.
 *
 * **Y ninguna red lo diría.** `terceros-antes-del-consentimiento.test.ts` lee el
 * HTML de `dist/` buscando `<script src>` absolutos, y los dos los inyectan los
 * SDK en runtime desde un chunk local. `bundle-panel.test.ts` mira el chunk
 * inicial **del panel**, o sea la dirección contraria.
 * `build-credenciales.test.ts` barre `firebase-admin`, no el SDK cliente.
 *
 * ── Por qué esto y no el refactor ─────────────────────────────────────────
 * El arreglo de fondo es sacar la medición de esos tres componentes a una prop
 * opcional (`onMedir?`), que es el corte que hace a `campos/` genérico de verdad
 * — el panel pasa `medirFuncion`, un formulario público no pasa nada. Es B-841 y
 * va antes del primer formulario público con desplegable de taxonomía.
 *
 * Este archivo es lo que hace que se pueda **posponer sin riesgo**: si el
 * formulario nuevo importa `TaxonomiaSelect` antes de que B-841 esté hecho, se
 * pone rojo acá y no en producción.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const raiz = new URL('..', import.meta.url);
const ruta = (rel: string): string => fileURLToPath(new URL(rel, raiz));
const fuente = (rel: string): string => readFileSync(ruta(rel), 'utf8');

/**
 * Los especificadores que importa un archivo: estáticos, de efecto y
 * **diferidos**.
 *
 * Los `import()` cuentan igual, y es la diferencia que importa acá: para el
 * corte del bundle un diferido está bien —no entra al chunk inicial— y para
 * **esto** da lo mismo, porque el módulo se carga cuando el componente se usa y
 * mide igual. Son dos preguntas distintas sobre el mismo grafo.
 *
 * Las dos comillas, por lo mismo que en `bundle-panel.test.ts`: el repo no tiene
 * prettier, así que nada normaliza la comilla.
 */
const importsEstaticos = (src: string): string[] => [
  ...[...src.matchAll(/^import\s+(?!type\s)[^;]*?from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]!),
  ...[...src.matchAll(/^import\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]!),
];

const importsDiferidos = (src: string): string[] =>
  [...src.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]!);

const importsDe = (src: string): string[] => [...importsEstaticos(src), ...importsDiferidos(src)];

/**
 * Los alias que apuntan a un archivo puntual de `functions/` (`@calendario`,
 * `@historial`, `@png-chunks-seguros`), leídos de `astro.config.mjs` y no
 * hardcodeados.
 *
 * **Hacen falta acá y no es teórico:** `campos/TaxonomiaSelect.tsx` importa
 * `desSlug` de `@calendario`. Sin resolverlos, `aArchivo` los trata como paquete
 * externo y el recorrido se corta ahí — o sea que `caminoHasta` devolvería `null`
 * por **no haber sabido resolver** y no por no haber camino, que es un verde
 * falso. Lo señaló el `auditor-trampas`, y es el mismo punto ciego que B-323 ya
 * cerró para `bundle-panel.test.ts`: acá se reusó `caminoHasta` para un recorrido
 * nuevo sin heredar esa protección.
 */
const ALIAS_A_ARCHIVO: Record<string, string> = Object.fromEntries(
  [
    ...fuente('astro.config.mjs').matchAll(
      /'(@[\w-]+)':\s*fileURLToPath\(\s*new URL\('\.\/([^']+)'/g,
    ),
  ].map((m) => [m[1]!, m[2]!]),
);

const aArchivo = (spec: string, desde: string): string | null => {
  let base: string;
  if (spec in ALIAS_A_ARCHIVO) return ALIAS_A_ARCHIVO[spec]!;
  if (spec.startsWith('@/')) base = `src/${spec.slice(2)}`;
  else if (spec.startsWith('.')) {
    const partes = desde.split('/').slice(0, -1);
    for (const p of spec.split('/')) {
      if (p === '.') continue;
      else if (p === '..') partes.pop();
      else partes.push(p);
    }
    base = partes.join('/');
  } else return null;
  for (const cand of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.astro`,
    `${base}/index.ts`,
    `${base}/index.tsx`,
  ]) {
    if (cand.includes('.') && existsSync(ruta(cand))) return cand;
  }
  return null;
};

/** Todas las páginas de `src/pages`, incluidas las de subcarpetas. */
const paginas = (): string[] =>
  readdirSync(ruta('src/pages'), { recursive: true })
    .map(String)
    .filter((f) => f.endsWith('.astro'))
    .map((f) => `src/pages/${f}`)
    .sort();

/**
 * El primer camino de `pagina` a `objetivo`, o `null`. Devuelve la cadena.
 *
 * `soloEstaticos` recorta el grafo a los `import` de arriba del archivo, sin los
 * `import()`. **Es la distinción que B-830 paso 9 obligó a hacer**, y no vale para
 * las tres cosas por igual: ver `PLOMERIA_DEL_PANEL` y `FIREBASE_DEL_CLIENTE`.
 */
const caminoHasta = (
  pagina: string,
  objetivos: readonly string[],
  { soloEstaticos = false } = {},
): string[] | null => {
  const leer = soloEstaticos ? importsEstaticos : importsDe;
  const via = new Map<string, string>([[pagina, '']]);
  const pendientes = [pagina];
  while (pendientes.length > 0) {
    const archivo = pendientes.pop()!;
    for (const spec of leer(fuente(archivo))) {
      if (objetivos.includes(spec)) {
        // La cadena, de la página al hallazgo, para que el mensaje diga por dónde.
        const cadena = [spec, archivo];
        for (let a = via.get(archivo); a; a = via.get(a)) cadena.push(a);
        return cadena.reverse();
      }
      const destino = aArchivo(spec, archivo);
      if (destino && !via.has(destino)) {
        via.set(destino, archivo);
        pendientes.push(destino);
      }
    }
  }
  return null;
};

/**
 * **La medición del panel: prohibida para toda página pública, la alcance como la
 * alcance.**
 *
 * No tiene portón de consentimiento —nunca lo necesitó, D-250— así que un
 * `funcion_usada` disparado desde una página pública crea el perfil de medición en
 * el navegador de alguien que no tocó el banner. Que el módulo entre por
 * `import()` no cambia nada: se carga cuando el componente se usa, y mide igual.
 */
const MEDICION_DEL_PANEL = ['@/lib/analytics'];

/**
 * **Firebase del lado del cliente: prohibido de forma ESTÁTICA, y diferido solo
 * donde escribir es el punto de la página.**
 *
 * ── Por qué esta lista se separó de la de arriba (B-830, paso 9) ──────────
 * Hasta `/proponer`, las tres cosas eran el mismo problema a distinta profundidad
 * y estaban en una sola lista: `firebase-client` era **el camino** por el que la
 * medición del panel llegaba, y `appcheck` lo que ese camino arrastra. Ninguna
 * página pública tenía motivo para tocarlas.
 *
 * `/proponer` sí lo tiene, y no es una excepción cómoda: **es el diseño**. El
 * formulario escribe en Firestore desde el navegador de un visitante, y lo que lo
 * hace seguro es justamente App Check —o sea reCAPTCHA Enterprise, un tercero de
 * Google con cuota facturable por visitante—. La pregunta entonces no es *si* la
 * página puede alcanzar Firebase, sino **cuándo**:
 *
 * - **estático** = el tercero carga al **abrir** la página, para cualquiera que
 *   mire. Eso sí es lo que la lista de arriba evita, y sigue prohibido para todas.
 * - **diferido** = carga cuando la persona **decide mandar** algo. Ahí el
 *   anti-abuso es el motivo de la visita y no hay nada que explicarle a nadie.
 *
 * `app()` es el borde donde App Check se inicializa (B-836), así que el momento en
 * que el módulo se carga **es** el momento en que el tercero entra. Por eso la
 * distinción estático/diferido, que para la medición no significa nada, acá
 * significa todo.
 */
const FIREBASE_DEL_CLIENTE = [
  '@/lib/firebase-client',
  '@/lib/appcheck',
  '@/lib/firestore-client',
];

/**
 * Las páginas que **escriben**, y por lo tanto pueden alcanzar Firebase de forma
 * diferida. Es una lista y no una regla porque la segunda entrada tiene que ser
 * una decisión: hoy es la única página del sitio con un formulario.
 *
 * Los otros tres formularios públicos de `prd/` van a entrar acá, uno por uno.
 */
const PAGINAS_QUE_ESCRIBEN = ['src/pages/proponer.astro'];

/**
 * `/admin` es el panel: **tiene** que alcanzarla. Es la única excepción, y no es
 * una lista para ir agregando — la segunda entrada acá sería una página pública
 * midiendo sin consentimiento.
 */
const ES_EL_PANEL = 'src/pages/admin.astro';

describe('la plomería del panel no llega al sitio público — B-841', () => {
  it('hay páginas que recorrer, y son varias', () => {
    // Control positivo: un `readdirSync` que devolviera vacío dejaría el caso de
    // abajo pasando sin haber mirado nada.
    const todas = paginas();
    expect(todas.length).toBeGreaterThan(8);
    expect(todas).toContain(ES_EL_PANEL);
    expect(todas).toContain('src/pages/index.astro');
  });

  it('CONTROL POSITIVO: `/admin` sí la alcanza, así que el grafo sabe encontrarla', () => {
    // Sin esto, «ninguna página la alcanza» podría querer decir que el recorrido
    // no resuelve los imports — que es el modo de falla de B-117.
    const camino = caminoHasta(ES_EL_PANEL, MEDICION_DEL_PANEL);
    expect(camino, 'el grafo no encuentra la medición ni desde el panel').not.toBeNull();
    expect(camino!.length).toBeGreaterThan(2);
  });

  it('ninguna otra página alcanza la medición del panel, ni por `import()`', () => {
    const hallazgos = paginas()
      .filter((p) => p !== ES_EL_PANEL)
      .map((p) => [p, caminoHasta(p, MEDICION_DEL_PANEL)] as const)
      .filter(([, camino]) => camino !== null)
      .map(([p, camino]) => `${p}\n      ${camino!.join('\n        → ')}`);
    expect(
      hallazgos,
      'una página del sitio público alcanza la medición del **panel**, que no tiene ' +
        'portón de consentimiento (D-250). Es B-841: el arreglo es que el componente ' +
        'reciba la medición por prop, no que la importe.',
    ).toEqual([]);
  });

  it('ni Firebase de forma ESTÁTICA: el tercero no puede cargar al abrir la página', () => {
    /*
     * El corte que importa desde B-830 paso 9. Estático significa que App Check
     * —o sea reCAPTCHA, con cuota facturable por visitante— se inicializa para
     * cualquiera que **mire** la página, haya o no tocado nada. Vale para todas,
     * incluidas las que escriben.
     */
    const hallazgos = paginas()
      .filter((p) => p !== ES_EL_PANEL)
      .map((p) => [p, caminoHasta(p, FIREBASE_DEL_CLIENTE, { soloEstaticos: true })] as const)
      .filter(([, camino]) => camino !== null)
      .map(([p, camino]) => `${p}\n      ${camino!.join('\n        → ')}`);
    expect(
      hallazgos,
      'una página pública alcanza Firebase **estáticamente**: App Check se inicializa ' +
        'al abrirla y el desafío de reCAPTCHA carga para quien solo pasó a mirar. Si la ' +
        'página escribe, el módulo que habla con Firebase entra por `import()` adentro ' +
        'del handler (ver `lib/enviar-propuesta.ts`).',
    ).toEqual([]);
  });

  it('y de forma diferida, solo las que escriben — que hoy es una', () => {
    const alcanzan = paginas()
      .filter((p) => p !== ES_EL_PANEL)
      .filter((p) => caminoHasta(p, FIREBASE_DEL_CLIENTE) !== null);
    expect(
      alcanzan,
      'una página que no escribe alcanza Firebase: no hay motivo para que cargue el ' +
        'SDK ni App Check, ni siquiera diferido',
    ).toEqual(PAGINAS_QUE_ESCRIBEN);
  });

  it('CONTROL POSITIVO: `/proponer` sí lo alcanza diferido, y por el módulo que escribe', () => {
    /*
     * La otra mitad del caso de arriba, y hace falta: «solo las que escriben» se
     * cumpliría también con una lista **vacía** el día que alguien rompa los
     * `import()` del formulario, y ahí la página dejaría de poder mandar nada con
     * la suite en verde.
     *
     * Son **dos** asertos y no uno: el recorrido del grafo prueba que *algún*
     * camino diferido llega a Firebase, y el segundo nombra el módulo — que es lo
     * que quedaría en pie si alguien cambiara el camino por otro que no escribe.
     *
     * **Lo que estos dos NO prueban, medido y no supuesto:** que el **submit** lo
     * llame. El componente lo difiere en dos lugares —el envío y la subida de la
     * imagen— así que sacar el del envío deja los dos asertos verdes. Esa mitad es
     * de `tests/proponer.render.test.tsx`, que aprieta el botón: acá se verifica
     * **cuándo entra el tercero**, no que el formulario funcione.
     */
    const camino = caminoHasta(PAGINAS_QUE_ESCRIBEN[0]!, FIREBASE_DEL_CLIENTE);
    expect(camino, 'el formulario de /proponer no llega a Firebase por ningún camino').not.toBeNull();

    expect(
      importsDiferidos(fuente('src/components/publico/FormularioPublico.tsx')),
      'el formulario no difiere el módulo que escribe la propuesta',
    ).toContain('@/lib/enviar-propuesta');
  });
});

/**
 * **`campos/` es genérico de verdad, no solo por su ubicación** — B-841.
 *
 * El directorio se movió en B-827 «para que lo usen los formularios públicos», y
 * tres de sus seis archivos seguían importando hacia adentro: la medición del
 * panel, el centro de ayuda y `useOpciones`, con su cadena hasta
 * `firebase/firestore`. O sea que **parecía** compartido y no lo era, y el import
 * que lo delataba ya no decía `admin/` en ninguna parte.
 *
 * El `describe` de arriba mira la propiedad **desde las páginas**, que es lo que
 * hay que garantizar. Este la mira **desde el directorio**, y las dos hacen falta:
 * aquél se pone rojo cuando alguien ya escribió el formulario público que lo
 * arrastra —o sea tarde, con el trabajo hecho—, y éste cuando alguien mete el
 * import en `campos/`, que es donde el error se comete.
 */
describe('`campos/` no alcanza nada del panel ni el SDK pesado — B-841', () => {
  const DE_CAMPOS = (): string[] =>
    readdirSync(ruta('src/components/campos'))
      .filter((f) => f.endsWith('.tsx') || f.endsWith('.ts'))
      .map((f) => `src/components/campos/${f}`)
      .sort();

  /**
   * Lo que un control compartido no puede alcanzar. Los dos primeros son la
   * medición sin consentimiento y su cadena; el tercero es el chunk pesado que el
   * corte de B-09 mantiene afuera del primer render del panel, y que
   * `useOpciones` arrastraba.
   */
  const PROHIBIDO = [
    '@/lib/analytics',
    '@/lib/firebase-client',
    '@/lib/appcheck',
    '@/lib/opciones',
    'firebase/firestore',
  ];

  /**
   * Control positivo del resolvedor de alias, calcado del de
   * `bundle-panel.test.ts` (B-323). Sin esto, un `aArchivo` que dejara de
   * resolverlos volvería a cortar el recorrido en silencio y todos los casos de
   * abajo pasarían por no haber mirado esa rama.
   */
  it('los alias a `functions/` se resuelven como archivo del repo', () => {
    expect(Object.keys(ALIAS_A_ARCHIVO).sort()).toEqual([
      '@calendario',
      '@historial',
      '@png-chunks-seguros',
    ]);
    // Y el que de verdad se usa desde `campos/`: si dejara de resolverse, el
    // recorrido lo trataría como hoja.
    expect(aArchivo('@calendario', 'src/components/campos/TaxonomiaSelect.tsx')).toBe(
      'functions/calendario.js',
    );
  });

  it('hay archivos que recorrer, y son los seis', () => {
    const archivos = DE_CAMPOS();
    expect(archivos.length).toBeGreaterThanOrEqual(6);
    expect(archivos).toContain('src/components/campos/TaxonomiaSelect.tsx');
  });

  it.each(DE_CAMPOS())('%s no alcanza la plomería del panel', (archivo) => {
    const camino = caminoHasta(archivo, PROHIBIDO);
    expect(
      camino === null ? null : camino.join(' → '),
      'un control de `campos/` alcanza algo del panel: lo va a arrastrar el ' +
        'formulario público que lo use. El corte es que lo **reciba** por prop, ' +
        'como en `components/admin/campos-del-panel.tsx`',
    ).toBeNull();
  });

  it('y ninguno importa de `components/admin/`', () => {
    // Lo mismo dicho por ruta, que es como se lee en el diff. El caso de arriba
    // ya lo cubre por la cadena; éste nombra el error como se comete.
    const conAdmin = DE_CAMPOS().filter((f) =>
      importsDe(fuente(f)).some((spec) => spec.startsWith('@/components/admin/')),
    );
    expect(conAdmin, '`campos/` volvió a importar de `admin/`').toEqual([]);
  });

  /**
   * **Control positivo, y el que hace honesto a todo lo de arriba:** la capa del
   * panel **sí** alcanza las cinco cosas. Si no las alcanzara, «`campos/` no las
   * alcanza» podría querer decir que el recorrido no las sabe encontrar.
   */
  it('CONTROL POSITIVO: la capa del panel sí las alcanza', () => {
    const camino = caminoHasta('src/components/admin/campos-del-panel.tsx', PROHIBIDO);
    expect(camino, 'el grafo no encuentra la plomería ni desde la capa que la ata').not.toBeNull();
  });
});
