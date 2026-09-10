import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

import { CONTACTO, LISTA_DE_CORREO, campoTrampaDelBoletin, urlDeAltaAlBoletin } from '@/lib/enlaces';
import {
  EL_BOLETIN,
  EL_FORMULARIO,
  EL_TRATO,
  ORDEN_DEL_TRATO,
  formularioDelBoletin,
  hayBoletin,
  textoDelBoletin,
  tratoEnOrden,
} from '@/lib/boletinDelSitio';
import { PREGUNTAS_DE_AYUDA } from '@/lib/ayudaDelSitio';
import { QUE_CUESTA, QUIEN_LA_HACE } from '@/lib/apoyoDelSitio';
import { auditoresQueCorresponden, leerFichas } from '../scripts/auditores-que-corresponden.mjs';

/**
 * El correo de la agenda — B-847.
 *
 * ── Qué puede salir mal acá, y no es que se rompa ─────────────────────────
 * Esta sección es la primera vez que el sitio público le pide **un dato a una
 * persona** y lo manda a un tercero. Las cuatro formas de arruinarlo no ponen
 * el build en rojo:
 *
 * 1. **Que vuelva el script de Mailchimp.** Es lo más fácil del mundo: el
 *    embebido que ellos publican trae `mc-validate.js` desde `chimpstatic.com`
 *    y funciona mejor. Pegarlo pone en rojo `terceros-antes-del-consentimiento`
 *    —pero **solo si hay un `dist/` construido**, porque aquél lee el HTML del
 *    build y se saltea si no lo hay. Acá se afirma sobre el **fuente**, que
 *    falla en el acto y en cualquier máquina: no es duplicar aquella red, es la
 *    mitad que aquélla no puede cubrir sola. Y es **la decisión**, no una
 *    consecuencia: el dueño eligió el `<form>` pelado justamente por esto.
 * 2. **Que la promesa se afloje o se caiga.** Las cinco frases del trato son lo
 *    que alguien lee antes de escribir su dirección. Un rediseño que se lleve
 *    dos por delante deja un formulario que pide un mail sin decir qué pasa con
 *    él, y nada falla.
 * 3. **Que la promesa diga de más.** Es la clase de B-781, y acá la tentación
 *    concreta es «tu dirección no sale de acá»: es falso, sale, va a Mailchimp.
 * 4. **Que el formulario se dibuje sin lista.** Postearía la dirección de una
 *    persona contra un endpoint que no es nuestro. Ver `LISTA_DE_CORREO`.
 */

const raiz = (rel: string): string => fileURLToPath(new URL(`../${rel}`, import.meta.url));
const fuente = (rel: string): string => readFileSync(raiz(rel), 'utf8');

/**
 * El fuente **sin comentarios**. Hace falta de verdad: el docblock del
 * componente nombra `chimpstatic.com` y `mc-validate.js` para explicar por qué
 * no están, y castigar esa explicación empuja a borrarla. Mismo helper que
 * `promesas-sobre-datos.test.ts`.
 */
const sinComentarios = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const PAGINA = 'src/pages/suscribirse.astro';
const COMPONENTE = 'src/components/sitio/SuscribirseBoletin.astro';
const MODULO = 'src/lib/boletinDelSitio.ts';

/** La página y todos sus componentes, que es la superficie que publica. */
const ARCHIVOS_DE_LA_PAGINA = (): string[] => [
  PAGINA,
  ...execFileSync('git', ['ls-files', 'src/components/sitio'], { encoding: 'utf8' })
    .split('\n')
    .filter((f) => /\/Suscribirse[^/]*\.astro$/.test(f)),
];

/** Una lista de mentira, con la forma exacta que Mailchimp publica. */
const LISTA_DE_PRUEBA = {
  cuenta: 'agendaleh',
  centro: 'us21',
  u: '0f3c9a1b2d4e5f60718293a4b',
  id: 'c7d8e9f012',
};

// ───────────────────────────────────────────────────────────────────────────
// 1 · La decisión: ningún script de Mailchimp
// ───────────────────────────────────────────────────────────────────────────

describe('el formulario no carga un solo script de Mailchimp — la decisión, B-847', () => {
  it('el barrido mira los archivos de verdad', () => {
    // Control positivo: sin esto, un `git ls-files` que no devuelve nada dejaría
    // pasar todo lo de abajo sin haber abierto un archivo.
    const archivos = ARCHIVOS_DE_LA_PAGINA();
    expect(archivos).toContain(PAGINA);
    expect(archivos).toContain(COMPONENTE);
    expect(archivos.length).toBeGreaterThan(3);
  });

  it('ni la página ni sus componentes nombran un host o un script de Mailchimp', () => {
    /*
     * **El aserto que fija la decisión.** No es «no hay terceros» —eso lo cuida
     * D-254 sobre el `dist/`—: es que **esta** forma de anotarse es la del
     * `<form>` pelado y no la del embebido, que es lo que el dueño eligió.
     *
     * MUTACIÓN PROBADA: pegar en `SuscribirseBoletin.astro` el embebido oficial
     * (`<script src="https://chimpstatic.com/mcjs-connected/js/users/…"></script>`)
     * deja este caso en rojo nombrando el archivo y el patrón `chimpstatic`. Se
     * sacó y volvió a pasar.
     */
    const PROHIBIDO = [
      /chimpstatic/i,
      /mc-validate/i,
      /mcjs/i,
      /mc-embedded/i,
      /mailchimp\.com/i,
      /\bmc4wp\b/i,
    ];

    const hallazgos: string[] = [];
    for (const archivo of [...ARCHIVOS_DE_LA_PAGINA(), MODULO]) {
      const src = sinComentarios(fuente(archivo));
      for (const patron of PROHIBIDO) {
        if (patron.test(src)) hallazgos.push(`${archivo} — ${patron}`);
      }
    }

    expect(
      hallazgos,
      'volvió un pedazo del embebido de Mailchimp. El alta es un `<form method="post">` y ' +
        'nada más: su script sale a un host de tercero en el load, antes de cualquier ' +
        'consentimiento y también para quien apretó «Rechazar» (D-254).',
    ).toEqual([]);
  });

  it('el detector sabe decir que sí: el embebido oficial lo dispara', () => {
    // Control del control. Sin esto, un regex que dejó de matchear deja el caso
    // de arriba en verde para siempre — y es el caso que más importa del archivo.
    const embebido = '<script src="https://chimpstatic.com/mcjs-connected/js/users/a/b.js"></script>';
    expect(/chimpstatic/i.test(embebido)).toBe(true);
    expect(/chimpstatic/i.test(sinComentarios(fuente(COMPONENTE)))).toBe(false);
  });

  it('el componente no tiene ni un `<script>`: la sección es HTML y nada más', () => {
    /*
     * La otra mitad, y no es la misma: un script **propio** tampoco va acá.
     * `SuscribirseCamino.astro` sí tiene uno (el botón de copiar, mejora
     * progresiva sobre algo que ya funciona sin él); esto no puede tenerlo,
     * porque un formulario que necesita JavaScript para postear es un formulario
     * que no funciona.
     */
    expect(sinComentarios(fuente(COMPONENTE))).not.toMatch(/<script[\s>]/i);
  });

  it('es un formulario que postea, no un enlace ni una island', () => {
    const src = sinComentarios(fuente(COMPONENTE));
    expect(src).toMatch(/<form[^>]*\bmethod="post"/s);
    expect(src).toMatch(/type="email"/);
    expect(src).toMatch(/\brequired\b/);
    // Ninguna directiva de hidratación: la sección no monta un componente.
    expect(src).not.toMatch(/client:(load|idle|visible|only|media)/);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 2 · El destino, y de dónde sale
// ───────────────────────────────────────────────────────────────────────────

describe('el destino sale de `enlaces.ts` y tiene la forma que Mailchimp espera', () => {
  it('la URL de alta apunta a list-manage por https, con los dos ids', () => {
    const url = urlDeAltaAlBoletin(LISTA_DE_PRUEBA);
    expect(url.startsWith('https://')).toBe(true);
    expect(new URL(url).host).toBe('agendaleh.us21.list-manage.com');
    expect(new URL(url).pathname).toBe('/subscribe/post');
    expect(new URL(url).searchParams.get('u')).toBe(LISTA_DE_PRUEBA.u);
    expect(new URL(url).searchParams.get('id')).toBe(LISTA_DE_PRUEBA.id);
  });

  it('el campo trampa se deriva de los mismos dos ids', () => {
    /*
     * Mailchimp lo espera con este nombre exacto y descarta el alta si viene
     * lleno. Un `b_…` pegado a mano que no corresponde a esta lista no filtra
     * nada, y el modo de falla es que **no pasa nada**: ni un error, ni un
     * rojo — solo spam en la lista.
     */
    expect(campoTrampaDelBoletin(LISTA_DE_PRUEBA)).toBe(
      `b_${LISTA_DE_PRUEBA.u}_${LISTA_DE_PRUEBA.id}`,
    );
  });

  it('la plantilla no escribe el destino: lo recibe armado', () => {
    const src = sinComentarios(fuente(COMPONENTE));
    expect(src).toMatch(/action=\{formulario\.accion\}/);
    expect(src).toMatch(/name=\{formulario\.campoTrampa\}/);
    // Y la regla de raíz de esta página, ya cubierta por `suscribirse.test.ts`
    // para el resto: ninguna dirección escrita en el marcado.
    expect(src.match(/\b(https?|webcal):\/\//g) ?? []).toEqual([]);
  });

  it('mientras la lista no exista, la sección no se dibuja y no promete nada', () => {
    /*
     * **El caso que impide el peor error posible de este ítem**, y es el orden
     * que dejó escrito B-780 con el perfil de Cafecito. Con `u` e `id`
     * inventados el formulario no se rompe: postea igual, contra un endpoint que
     * o no existe —y la persona ve un error de Mailchimp con nuestra promesa
     * recién leída— o **existe y es de otra cuenta**, y entonces su dirección
     * termina en la lista de un desconocido. Eso no se deshace.
     *
     * Este caso cambia de sentido el día que la lista exista, y está escrito
     * para eso: ahí verifica **la forma** de los cuatro valores, que es lo único
     * que se puede verificar sin salir a la red.
     */
    if (LISTA_DE_CORREO === null) {
      expect(formularioDelBoletin()).toBeNull();
      expect(hayBoletin()).toBe(false);
      // Y la sección está condicionada, no dibujada siempre: sin esto, `null`
      // reventaría la plantilla en vez de esconderla.
      expect(sinComentarios(fuente(COMPONENTE))).toMatch(/formulario &&/);
      return;
    }

    const lista = LISTA_DE_CORREO;
    expect(lista.centro, 'el centro de datos es `us` y un número').toMatch(/^us\d{1,3}$/);
    expect(lista.cuenta, 'la cuenta es el subdominio, sin puntos').toMatch(/^[a-z0-9-]+$/);
    expect(lista.u, 'el `u` de Mailchimp es hexadecimal').toMatch(/^[0-9a-f]{16,40}$/);
    expect(lista.id, 'el `id` de la lista es hexadecimal').toMatch(/^[0-9a-f]{6,20}$/);
    expect(hayBoletin()).toBe(true);
    expect(formularioDelBoletin()!.accion).toBe(urlDeAltaAlBoletin(lista));
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 3 · La promesa
// ───────────────────────────────────────────────────────────────────────────

describe('las cinco promesas del trato están, y dicen lo que existen para decir', () => {
  it('el orden las muestra a todas, cada una una sola vez', () => {
    // El tipo obliga a que cada id tenga contenido; esto obliga a lo otro, que
    // es lo que el tipo no puede ver: que la sección las muestre.
    expect([...ORDEN_DEL_TRATO].sort()).toEqual(Object.keys(EL_TRATO).sort());
    expect(new Set(ORDEN_DEL_TRATO).size).toBe(ORDEN_DEL_TRATO.length);
    expect(tratoEnOrden()).toHaveLength(5);
    for (const [clave, t] of Object.entries(EL_TRATO)) expect(t.id).toBe(clave);
  });

  it('ninguna está vacía y ninguna es una frase suelta', () => {
    for (const t of tratoEnOrden()) {
      expect(t.titulo.trim(), `«${t.id}» sin título`).not.toBe('');
      expect(t.texto.trim().length, `«${t.id}» dice demasiado poco`).toBeGreaterThan(80);
    }
  });

  it('la cadencia dice el ritmo Y nombra la semana en que no sale', () => {
    /*
     * **La decisión de redacción de este ítem, fijada acá.** El dueño pidió «al
     * menos una vez por semana». Un **piso** se incumple con una sola semana
     * floja, y esto vive en una página indexada que `promesas-sobre-datos`
     * barre justamente porque una afirmación pública que el proyecto desmiente
     * es lo más caro que este sitio puede escribir.
     *
     * La salida no es aflojar la promesa: es **nombrar la excepción**, que es lo
     * que este repo ya hizo dos veces — «casi nunca trae el link de la reunión»
     * (`suscripcion.ts`, porque «una advertencia que promete "nunca" miente el
     * día que pasa») y la corrección de `/ayuda` sobre la publicidad (B-785).
     *
     * Así que se afirma la propiedad y no la frase: dice cada cuánto **y** qué
     * pasa la semana que no hay nada.
     *
     * MUTACIÓN PROBADA: reemplazar el texto por «Sale al menos una vez por
     * semana, siempre.» deja este caso en rojo por la segunda mitad.
     */
    const texto = EL_TRATO.cadencia.texto.toLowerCase();
    expect(texto, 'no dice cada cuánto sale').toMatch(/semanal|una vez por semana|cada semana/);
    expect(
      texto,
      'promete un ritmo sin decir qué pasa la semana que no hay nada: eso es un piso, y ' +
        'un piso se incumple con una sola semana floja',
    ).toMatch(/no sale|no va a salir|no te llega/);
  });

  it('el correo dice qué trae, y que es de todos los gustos y las tres maneras de cursar', () => {
    // Es la línea editorial que pidió el dueño, y es lo que distingue al correo
    // de un volcado automático de la agenda.
    const texto = EL_TRATO['que-llega'].texto.toLowerCase();
    expect(texto).toMatch(/a mano|selecci[óo]n|elegid/);
    for (const modalidad of ['presencial', 'virtual']) {
      expect(texto, `no nombra «${modalidad}»`).toContain(modalidad);
    }
    expect(texto, 'no dice que hay de todos los precios').toMatch(/gratis|gorra|arancel/);
  });

  it('el remitente es la casilla del proyecto, y no está escrita a mano', () => {
    /*
     * Es la decisión 3 del dueño y el motivo es concreto: **esa cuenta ya cambió
     * una vez** (B-839). Una dirección pegada acá seguiría diciendo la vieja el
     * día que cambie la constante, en una promesa pública, sin que nada falle —
     * la clase B-72/B-88 aplicada a un texto.
     */
    expect(EL_TRATO['quien-lo-manda'].texto).toContain(CONTACTO);
    const src = sinComentarios(fuente(MODULO));
    expect(src, 'la casilla está escrita a mano en el módulo').not.toMatch(/@gmail|@[a-z]+\.com/i);
    expect(src, 'la casilla no se importa de `enlaces.ts`').toContain('CONTACTO');
  });

  it('dice que la dirección la recibe un tercero, y lo nombra', () => {
    /*
     * **Lo que esta sección no puede callar.** Hasta B-847 el sitio público no
     * le mandaba un dato de nadie a ningún tercero; ahora sí, y quien escribe su
     * dirección tiene derecho a saber a dónde va antes de escribirla — no
     * después, y no en una letra chica.
     */
    const texto = EL_TRATO['donde-queda'].texto;
    expect(texto).toContain('Mailchimp');
    expect(texto.toLowerCase(), 'no dice que es una empresa de afuera').toMatch(
      /estados unidos|otro pa[íi]s|afuera/,
    );
  });

  it('si dice «lo único», nombra también lo que el sitio mide con permiso', () => {
    /*
     * **Lo encontró el `auditor-privacidad` sobre este mismo cambio**, y es la
     * forma del bug de `/apoyar` con otra gramática. La frase decía «es lo único
     * que la agenda le manda a un tercero», y es falsa: con el consentimiento
     * aceptado, la salida 12 le manda a Google la URL, el título, el referrer y
     * el `client_id` — con el banner que lo dice **en la misma pantalla**.
     *
     * `promesas-sobre-datos.test.ts` no lo puede ver: sus fórmulas son
     * negaciones («no se guarda», «sin analítica») y esto es una **exclusividad
     * afirmativa**. Por eso el caso vive acá y se afirma como propiedad: si el
     * texto usa «lo único», la misma frase nombra la medición.
     *
     * MUTACIÓN PROBADA: volver a «Es lo único que la agenda le manda a un
     * tercero, y por eso está dicho acá arriba» deja este caso en rojo.
     */
    const exclusivas = tratoEnOrden()
      .map((t) => t.texto)
      .filter((t) => /lo [úu]nico/i.test(t));
    for (const frase of exclusivas) {
      expect(
        frase,
        'una exclusividad sobre lo que sale de acá que no nombra la medición: el sitio ' +
          'mide con consentimiento (salida 12) y el banner lo dice en la misma pantalla',
      ).toMatch(/se mide|medici[óo]n|con tu permiso|analytics/i);
    }
  });

  it('el `auditor-privacidad` se despierta también con el componente del formulario', () => {
    /*
     * **El agujero que el propio `auditor-privacidad` encontró.** El caso de más
     * abajo prueba el módulo; el `description` de la ficha lo nombraba a él y
     * **no** al componente, que es el archivo que físicamente le manda el dato
     * al tercero. `tests/agentes-y-skills.test.ts` no lo cobra: deriva de la
     * tabla **el primer archivo de cada fila** (acá, `enlaces.ts`). O sea que un
     * diff que tocara solo el componente —un campo de más, el `action`, sacar
     * `rel="noopener"`, pegar un `<script>`— cerraba sin que nadie lo mirara. Es
     * B-818/B-819 otra vez, con el archivo peor posible.
     */
    const fichas = leerFichas(new URL('..', import.meta.url)) as Record<string, string>;
    expect(
      auditoresQueCorresponden([COMPONENTE], fichas).privacidad.corresponde,
      `${COMPONENTE} no está en la ficha del auditor`,
    ).toBe(true);
  });

  it('dice cómo se entra y cómo se sale: confirmación y baja', () => {
    /*
     * La confirmación es el **doble opt-in**, que se adopta como default y es lo
     * que hace que la casilla sea de quien la escribió. Ojo con lo que este caso
     * verifica y lo que no: verifica que la página **lo prometa**. Que la lista
     * esté configurada así en Mailchimp es una casilla de su consola —
     * configuración y no código, la misma clase que los ajustes de GA4 de B-480—
     * y **ningún test de este repo la puede sostener**.
     */
    const texto = EL_TRATO['como-te-vas'].texto.toLowerCase();
    expect(texto, 'no promete el mail de confirmación').toMatch(/confirm/);
    expect(texto, 'no dice que sin confirmar no queda anotado').toMatch(
      /hasta que no|sin confirmar|no qued/,
    );
    expect(texto, 'no dice cómo darse de baja').toMatch(/baja|desuscrib/);
  });

  it('el supuesto del doble opt-in está escrito donde alguien lo va a leer', () => {
    /*
     * Un supuesto que no se puede verificar tiene que estar **dicho**, si no es
     * una creencia. Es el mismo trato que B-480 le dio a los ajustes de GA4: no
     * hay test, así que hay prosa en los tres lugares donde alguien la busca.
     */
    for (const [archivo, patron] of [
      [MODULO, /doble opt-in/i],
      ['docs/07-seguridad.md', /doble opt-in/i],
      ['docs/08-operacion.md', /doble opt-in/i],
    ] as const) {
      expect(fuente(archivo), `${archivo} no explica el supuesto del doble opt-in`).toMatch(patron);
    }
  });

  it('y el checklist nombra el OTRO ajuste de consola que este formulario estrena', () => {
    /*
     * **Lo encontró el `auditor-privacidad`, y es el hallazgo menos visible del
     * ítem.** El «Enhanced Measurement» de GA4 tiene cuatro interruptores
     * prendidos por default y B-480 apagó tres. El cuarto —**«Interacciones con
     * formularios»**, que manda `form_start`/`form_submit` con `form_destination`—
     * no estaba en esa lista, y con razón: hasta hoy el sitio público no tenía
     * ningún formulario que hablara de datos. Este pone uno, justo en la página
     * de las promesas. No filtra la dirección (GA4 no manda valores de campo),
     * pero sí que este `client_id` mandó el formulario y a qué lista.
     *
     * Como el doble opt-in, es **configuración y no código**: ningún test lo
     * puede sostener. Lo que sí se puede fijar es que el checklist lo nombre —si
     * no está escrito, nadie lo va a apagar.
     */
    for (const archivo of ['docs/08-operacion.md', 'docs/16-analitica-del-sitio.md']) {
      expect(
        fuente(archivo),
        `${archivo} no nombra «Interacciones con formularios», el cuarto interruptor de ` +
          'Enhanced Measurement que este cambio vuelve relevante (B-480)',
      ).toMatch(/interacciones con formularios/i);
    }
  });

  it('la sección no promete lo que no puede: la dirección SÍ sale de acá', () => {
    /*
     * La clase de B-781 en su versión más tentadora: «tu dirección no sale de
     * este sitio» suena bien, tranquiliza, y es **falsa** — sale, va a
     * Mailchimp. Es exactamente la forma de la frase que `/apoyar` tuvo que
     * corregir, con otro objeto.
     *
     * El barrido general (`promesas-sobre-datos.test.ts`) toma este módulo solo
     * por el glob `*DelSitio.ts` y mira fórmulas de negación; esto mira la
     * afirmación concreta que este texto podría inventar.
     */
    const todo = textoDelBoletin().toLowerCase();
    const mentiras = [
      /no (sale|se va) de (ac[áa]|este sitio)/,
      /no (la |lo |le )?compartimos con nadie/,
      /no se la damos a nadie/,
      /queda solo (ac[áa]|en este sitio)/,
    ].filter((p) => p.test(todo));
    expect(
      mentiras.map(String),
      'la dirección sí sale de acá: la recibe Mailchimp. Decilo, no lo tapes.',
    ).toEqual([]);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 4 · Accesibilidad y forma
// ───────────────────────────────────────────────────────────────────────────

describe('la sección se puede usar sin ver la pantalla y sin mouse', () => {
  it('el botón avisa que abre una pestaña de otro sitio, sin pisar su texto', () => {
    /*
     * Este botón no hace lo que un botón hace normalmente: se va a una pestaña
     * de Mailchimp. Quien mira la pantalla lo ve; quien escucha la página no
     * tiene ninguna señal salvo ésta. Y va **sumado** y no en un `aria-label`,
     * que reemplazaría el texto visible y dejaría a quien maneja el sitio por
     * voz sin poder pedir el botón por su nombre (mismo criterio que
     * `SuscribirseAccion.astro`).
     */
    expect(EL_FORMULARIO.avisoLector.trim()).not.toBe('');
    expect(EL_FORMULARIO.avisoLector).toMatch(/pesta[nñ]a/i);
    const src = sinComentarios(fuente(COMPONENTE));
    expect(src).not.toMatch(/\saria-label\s*=/);
    expect(src).toMatch(/sr-only/);
  });

  it('la pestaña nueva va con `noopener`', () => {
    const src = sinComentarios(fuente(COMPONENTE));
    expect(src).toMatch(/target="_blank"/);
    expect(src, 'sin `noopener` la pestaña que se abre puede manipular a ésta').toMatch(
      /rel="noopener"/,
    );
  });

  it('el campo tiene etiqueta propia, y la ayuda está asociada', () => {
    const src = sinComentarios(fuente(COMPONENTE));
    expect(src).toMatch(/<label[^>]*for="boletin-mail"/s);
    expect(src).toMatch(/id="boletin-mail"/);
    expect(src).toMatch(/aria-describedby="boletin-ayuda"/);
    expect(src).toMatch(/id="boletin-ayuda"/);
    expect(src).toMatch(/autocomplete="email"/);
  });

  it('el formulario manda una sola cosa, y es la que la página promete', () => {
    /*
     * **Lo señaló el `auditor-privacidad`, y es la única afirmación del bloque
     * que habla de qué campos viajan a Mailchimp:** «no pedimos tu nombre ni
     * ninguna otra cosa». Lo que la sostenía era que alguien escribió un solo
     * `<input>`. El cambio que la vuelve falsa está a una línea y es el que el
     * propio embebido de Mailchimp sugiere —`name="FNAME"`, un `MMERGE3` con el
     * teléfono— y no lo veía nada: los otros casos miran el `type`, el
     * `required`, la etiqueta y el honeypot, y el barrido de promesas no tiene
     * «no pedimos» entre sus fórmulas.
     *
     * MUTACIÓN PROBADA: agregar `<input type="text" name="FNAME">` al formulario
     * deja este caso en rojo nombrando el campo de más.
     */
    const src = sinComentarios(fuente(COMPONENTE));
    // El bloque del honeypot va aparte: su campo es el que no se cuenta.
    const sinTrampa = src.replace(/<div class="sr-only" aria-hidden="true">[\s\S]*?<\/div>/, '');
    const nombres = [...sinTrampa.matchAll(/<input\b[^>]*\bname="([^"]+)"/g)].map((m) => m[1]!);
    expect(
      nombres,
      'el formulario pide algo más que la dirección, y la página promete que no pide nada más',
    ).toEqual(['EMAIL']);
    expect(EL_FORMULARIO.ayuda).toMatch(/no pedimos/i);
  });

  it('el campo trampa está fuera del teclado y fuera del lector de pantalla', () => {
    /*
     * Un honeypot mal puesto es peor que ninguno: si se tabula, alguien que
     * navega con teclado cae adentro y no entiende por qué; si un lector lo
     * anuncia, se lo dicta y lo completa. Las dos mitades tienen que estar.
     */
    const src = sinComentarios(fuente(COMPONENTE));
    const trampa = /<div class="sr-only" aria-hidden="true">[\s\S]*?<\/div>/.exec(src)?.[0] ?? '';
    expect(trampa, 'no se encontró el bloque del campo trampa').not.toBe('');
    expect(trampa).toMatch(/name=\{formulario\.campoTrampa\}/);
    expect(trampa).toMatch(/tabindex="-1"/);
    expect(trampa).toMatch(/autocomplete="off"/);
  });

  it('la página la renderiza, una sola vez, y recorre la lista entera', () => {
    const src = fuente(PAGINA);
    expect(src).toContain("from '@/components/sitio/SuscribirseBoletin.astro'");
    expect((src.match(/<SuscribirseBoletin[\s/>]/g) ?? []).length).toBe(1);
    // Y el componente no elige promesas de a una: las recorre. Listarlas a mano
    // compila, se ve bien, y la sexta que alguien escriba no la ve nadie.
    const comp = sinComentarios(fuente(COMPONENTE));
    expect(comp).toContain('tratoEnOrden()');
    expect(comp, 'el componente nombra una promesa en particular').not.toMatch(/EL_TRATO\s*[.[]/);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 5 · Tono, y el resto del sitio
// ───────────────────────────────────────────────────────────────────────────

describe('tono: le habla a quien va a un taller, no a quien programa', () => {
  const PROHIBIDO = ['§', '.astro', '.ts', 'Firestore', 'endpoint', 'opt-in', 'double opt-in'];

  it.each(PROHIBIDO)('el texto no dice «%s»', (termino) => {
    expect(textoDelBoletin().toLowerCase()).not.toContain(termino.toLowerCase());
  });

  it('la sección se presenta y dice para quién es', () => {
    expect(EL_BOLETIN.titulo.trim()).not.toBe('');
    expect(EL_BOLETIN.paraQuien.trim().length).toBeGreaterThan(40);
  });
});

describe('el resto del sitio no quedó diciendo lo contrario', () => {
  it('`/ayuda` habla del correo **si y solo si** el correo existe', () => {
    /*
     * **La mitad que casi se me escapa, y es la clase entera de este ítem.** La
     * primera versión de este cambio corrigió `/apoyar` («no hay newsletter»)
     * escribiendo lo contrario —«hay un correo semanal»— y sumó a `/ayuda` una
     * respuesta que lo cuenta. Con `LISTA_DE_CORREO` en `null` **eso también es
     * falso**: no hay correo al que anotarse, y la ayuda estaría prometiendo
     * uno. Arreglar una promesa falsa con otra promesa falsa es exactamente
     * B-781 al revés.
     *
     * Así que la premisa **se deriva**, igual que `elSitioVendeEspacio()` en
     * `tests/promesas-sobre-datos.test.ts`: el texto del correo aparece solo
     * cuando `hayBoletin()` da `true`. El día que la lista exista, las tres
     * páginas empiezan a contarlo solas y nadie tiene que acordarse.
     *
     * La ayuda es donde alguien busca «¿me mandan mails?». Entra en la respuesta
     * que ya existía sobre seguir la agenda y no en una pregunta propia: son dos
     * maneras de la misma intención, y quien lee «no te manda mails» tiene que
     * encontrar el matiz en la misma respuesta y no tres preguntas más abajo.
     */
    const p = PREGUNTAS_DE_AYUDA.find((q) => q.id === 'suscribirme');
    expect(p, 'se fue la respuesta de «seguir la agenda»').toBeDefined();
    const texto = p!.respuesta.join(' ').toLowerCase();

    // La frase que es cierta en los dos estados: el calendario no manda mails.
    expect(texto).toMatch(/no te (anota|suscribe) a nada m[áa]s ni te manda mails/);

    if (hayBoletin()) {
      expect(texto, 'no dice cada cuánto').toMatch(/semanal|una vez por semana/);
      expect(texto, 'no nombra al tercero').toContain('mailchimp');
      expect(texto, 'no dice que hay confirmación').toMatch(/confirm/);
      expect(texto, 'no dice cómo darse de baja').toMatch(/baja/);
    } else {
      expect(
        texto,
        'la lista todavía no existe y la ayuda ya cuenta el correo: es una promesa sobre ' +
          'algo a lo que nadie se puede anotar',
      ).not.toContain('mailchimp');
      expect(texto).not.toMatch(/hay correo|correo semanal/);
    }
  });

  it('y la derivación existe de verdad: las dos páginas preguntan `hayBoletin()`', () => {
    /*
     * Sin esto, el caso de arriba pasa con el texto **borrado** en vez de
     * condicionado: hoy `hayBoletin()` es `false`, así que «no lo menciona» y
     * «no existe la rama que lo menciona» se ven igual. Lo que hay que fijar es
     * que la rama esté escrita y colgada de la premisa, que es lo que hace que
     * esto se prenda solo el día que la lista exista.
     */
    for (const archivo of ['src/lib/ayudaDelSitio.ts', 'src/lib/apoyoDelSitio.ts']) {
      const src = sinComentarios(fuente(archivo));
      expect(src, `${archivo} no importa la premisa`).toContain("from '@/lib/boletinDelSitio'");
      expect(src, `${archivo} no la consulta`).toContain('hayBoletin()');
      expect(src, `${archivo} no tiene la rama que cuenta el correo`).toMatch(/correo semanal|hay correo/);
    }
  });

  it('`/apoyar` dejó de decir que no hay newsletter, que era lo que decía', () => {
    /*
     * **La afirmación viva que este cambio volvió falsa**, y es de la clase de
     * B-781: una promesa pública sobre datos en la única página cuyo valor
     * entero es que se le crea. Decía «acá no hay cuenta, no hay newsletter».
     *
     * MUTACIÓN PROBADA: reponer «no hay newsletter» en `apoyoDelSitio.ts` deja
     * este caso en rojo.
     */
    const apoyo = sinComentarios(fuente('src/lib/apoyoDelSitio.ts'));
    expect(apoyo, '`/apoyar` volvió a decir que no hay newsletter').not.toMatch(
      /no hay (un )?(newsletter|bolet[íi]n|correo)/i,
    );
    expect(apoyo, '`/apoyar` sigue diciendo que no hay una herramienta de mails').not.toMatch(
      /ni una herramienta de mails/i,
    );
    // Y lo dice al revés cuando corresponde: la herramienta existe, tiene un
    // costo que hoy es cero, y la frase cuelga de `hayBoletin()`.
    expect(apoyo).toMatch(/correo semanal/i);
    // El texto publicado hoy, que depende de la premisa.
    const publicado = [
      QUIEN_LA_HACE.parrafos.join(' '),
      QUE_CUESTA.puntos.map((x) => `${x.titulo} ${x.texto}`).join(' '),
    ].join(' ');
    if (hayBoletin()) expect(publicado).toMatch(/correo semanal/i);
    else expect(publicado, '/apoyar promete un correo que todavía no existe').not.toMatch(/correo semanal/i);
  });

  it('el `auditor-privacidad` se despierta cuando se toca el módulo del correo', () => {
    /*
     * Lo que decide si el agente mira un archivo es que su ficha lo nombre
     * (B-124, D-350). Este módulo produce texto de una salida pública y es el
     * único lugar donde se decide qué se le promete a alguien que entrega su
     * dirección: si no dispara, un cambio a esa promesa cierra sin que nadie la
     * mire — que es exactamente lo que le pasó a `enlaces.ts` hasta B-783.
     */
    const fichas = leerFichas(new URL('..', import.meta.url)) as Record<string, string>;
    const d = auditoresQueCorresponden([MODULO], fichas);
    expect(d.privacidad.corresponde, `${MODULO} no está en la ficha del auditor`).toBe(true);
  });
});
