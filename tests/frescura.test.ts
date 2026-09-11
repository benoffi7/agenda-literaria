import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// El módulo es JS plano; TS le infiere los tipos con allowJs. Y es el **puro**:
// el trigger no se importa nunca (`tests/tests-no-importan-triggers.test.ts`),
// se lee como fuente más abajo.
import {
  DEBOUNCE_MS,
  FALLAS_PARA_ESCALAR,
  PROPAGACION_MS,
  REAVISO_MS,
  REINTENTO_DEL_BUILD_MS,
  TOLERANCIA_MS,
  TOPE_DEL_BUILD_MS,
  compararFrescura,
  decidirAviso,
  edadGruesa,
  decidirAvisoDeLectura,
  diferenciaDeSlugs,
  fechar,
  firmaDe,
  issueDeAtraso,
  issueDeSinLectura,
  leerIndice,
  MOTIVOS,
  registrarFalloDeLectura,
  TOPE_DE_VISTAS,
} from '../functions/frescura.js';

/**
 * B-882 — el chequeo de frescura: ¿lo que está publicado aparece en el sitio?
 *
 * El 2026-09-11 el dueño publicó ocho actividades y ninguna apareció: el rebuild
 * venía fallando desde el día anterior y **el único que se enteró fue él,
 * mirando el sitio**. Este chequeo mide el efecto —lo publicado en Firestore
 * contra el `events.json` vivo— y no el mecanismo, así que atrapa el workflow
 * roto, la marca de rebuild perdida, el CDN cacheado y las causas que todavía no
 * conocemos.
 */

const raiz = new URL('..', import.meta.url);
const fuente = (rel: string) => readFileSync(fileURLToPath(new URL(rel, raiz)), 'utf8');

/**
 * El fuente **sin comentarios**, que es la única forma honesta de afirmar algo
 * sobre un archivo que se lee como texto: este archivo se escribió primero sin
 * esto y el caso de la etiqueta `alerta` pasaba en verde **por la prosa de la
 * cabecera** del trigger, con el `logger.error` borrado. Es la misma doctrina
 * de `tests/clases-de-bug.test.ts`: la prosa que explica una guarda no puede
 * contar como la guarda.
 *
 * Se sacan los bloques `/* … *\/` y las líneas que **empiezan** con `//`; un
 * `//` a mitad de línea no se toca, para no cortar una URL de un literal.
 */
const codigo = (rel: string) =>
  fuente(rel)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('//'))
    .join('\n');

const MINUTO = 60_000;
const T0 = new Date('2026-09-11T15:00:00Z').getTime();

/** Un índice como el que sirve el sitio, con los slugs que se le pidan. */
const indice = (slugs: string[]) =>
  JSON.stringify({
    generadoEn: '2026-09-11T14:00:00.000Z',
    version: '0.1.0+abc',
    opciones: {},
    actividades: slugs.map((slug, i) => ({ id: `id-${slug}`, slug, titulo: `T${i}` })),
    encuentros: [],
  });

/** El veredicto completo, a partir de los dos lados y de las fechas. */
const veredicto = ({
  publicados,
  enElIndice,
  fechas = {},
  fechasSobrantes = {},
  vistas = [],
  ahora = T0,
}: {
  publicados: string[];
  enElIndice: string[];
  fechas?: Record<string, number>;
  fechasSobrantes?: Record<string, number>;
  vistas?: { slug: string; desdeMs: number }[];
  ahora?: number;
}) => {
  const { faltan, sobran } = diferenciaDeSlugs(publicados, enElIndice);
  return compararFrescura({
    faltan: fechar(faltan, fechas, vistas, ahora),
    sobran: fechar(sobran, fechasSobrantes, vistas, ahora),
    publicadas: publicados.length,
    enElIndice: enElIndice.length,
    ahora,
  });
};

// ─────────────────────────────────────────────────────────────────────
// El caso central
// ─────────────────────────────────────────────────────────────────────

describe('con el sitio atrasado, el chequeo avisa (B-882)', () => {
  /**
   * **El caso del 2026-09-11, reconstruido.** Ocho actividades publicadas ayer,
   * el sitio sirviendo el índice de antes.
   *
   * MUTACIÓN PROBADA: cambiar `d.edadMs > toleranciaMs` por `>=` en
   * `compararFrescura` deja este caso en verde (la edad es de un día), pero
   * poner `toleranciaMs = Infinity` o invertir el filtro a `< toleranciaMs` lo
   * pone en rojo con `estado: 'fresco'` y `avisar: false` — que es exactamente
   * el bug: el chequeo callado con el sitio roto.
   */
  const ayer = T0 - 26 * 60 * MINUTO;
  const ocho = Array.from({ length: 8 }, (_, i) => `taller-${i + 1}`);
  const yaEstaban = ['club-de-lectura-mayo', 'charla-con-la-autora'];

  const v = veredicto({
    publicados: [...yaEstaban, ...ocho],
    enElIndice: yaEstaban,
    fechas: Object.fromEntries(ocho.map((s) => [s, ayer])),
  });

  it('el veredicto es «atrasado» y nombra las ocho que no aparecen', () => {
    expect(v.estado).toBe('atrasado');
    expect(v.faltan.map((d) => d.slug).sort()).toEqual([...ocho].sort());
    expect(v.sobran).toEqual([]);
    // Nombrar es la mitad del valor: «taller-1 no está hace 26 h» se verifica en
    // un click; «hay 2 y tendría que haber 10» manda a contar a mano.
    expect(v.peorEdadMs).toBeGreaterThan(TOLERANCIA_MS);
  });

  it('y eso dispara el aviso, sin nada previo', () => {
    expect(decidirAviso({ previo: null, veredicto: v, ahora: T0 })).toMatchObject({
      avisar: true,
      motivo: 'divergencia nueva',
    });
  });

  it('el issue dice cuántas, cuáles y contra qué ventana se midió', () => {
    const issue = issueDeAtraso(v);
    expect(issue.title).toContain('El sitio quedó atrasado');
    expect(issue.body).toContain('`taller-1`');
    expect(issue.body).toContain('Publicadas que el sitio no muestra (8)');
    // La ventana va escrita en el aviso: sin el número contra el que se midió,
    // quien lo lee no puede juzgar si el chequeo se apuró.
    expect(issue.body).toContain(`${TOLERANCIA_MS / MINUTO}`);
  });

  it('con una sola actividad también avisa — que es lo que el volumen tapaba', () => {
    // `rebuild.js` (B-884) lo dice: ocho ediciones son ocho oportunidades de que
    // algún build sea el bueno; con una sola no hay octava oportunidad. El
    // chequeo no depende del volumen.
    const uno = veredicto({
      publicados: [...yaEstaban, 'taller-solo'],
      enElIndice: yaEstaban,
      fechas: { 'taller-solo': ayer },
    });
    expect(uno.estado).toBe('atrasado');
    expect(uno.faltan).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────
// §1 — qué se compara: el conjunto, no el conteo
// ─────────────────────────────────────────────────────────────────────

describe('se compara el conjunto de slugs y no el conteo', () => {
  /**
   * **La razón de la decisión, hecha test.** Dos diferencias que se cancelan dan
   * el mismo número de los dos lados, y un contador diría «fresco» con las dos
   * mitades rotas.
   *
   * MUTACIÓN PROBADA: reemplazar el cuerpo de `diferenciaDeSlugs` por una
   * comparación de largos (`publicados.length === enElIndice.length ? {faltan:
   * [], sobran: []} : …`) deja este caso en rojo y **ningún otro**, que es lo
   * que prueba que este caso es el que cuida esta decisión.
   */
  it('dos diferencias que se cancelan: los conteos coinciden y el conjunto no', () => {
    const publicados = ['a', 'b', 'nueva-que-no-llego'];
    const enElIndice = ['a', 'b', 'cancelada-que-no-se-fue'];
    expect(publicados.length).toBe(enElIndice.length); // el contador diría «fresco»

    const { faltan, sobran } = diferenciaDeSlugs(publicados, enElIndice);
    expect(faltan).toEqual(['nueva-que-no-llego']);
    expect(sobran).toEqual(['cancelada-que-no-se-fue']);
  });

  it('las dos direcciones se reportan por separado', () => {
    const v = veredicto({
      publicados: ['a', 'falta'],
      enElIndice: ['a', 'sobra'],
      fechas: { falta: T0 - 2 * TOLERANCIA_MS },
      fechasSobrantes: { sobra: T0 - 2 * TOLERANCIA_MS },
    });
    expect(v.faltan.map((d) => d.slug)).toEqual(['falta']);
    expect(v.sobran.map((d) => d.slug)).toEqual(['sobra']);
  });

  it('los conteos viajan como dato, no como decisión', () => {
    const v = veredicto({ publicados: ['a', 'b'], enElIndice: ['a', 'b'] });
    expect(v).toMatchObject({ estado: 'fresco', publicadas: 2, enElIndice: 2 });
  });

  it('sin diferencias, fresco', () => {
    expect(veredicto({ publicados: ['a', 'b'], enElIndice: ['b', 'a'] }).estado).toBe('fresco');
  });

  it('un sitio vacío con actividades publicadas es la divergencia más grande, no un error de lectura', () => {
    // El build que produce un índice vacío (B-189) es una de las formas de
    // romper la promesa, y tiene que verse como tal.
    const leido = leerIndice(indice([]));
    expect(leido.ok).toBe(true);
    const v = veredicto({
      publicados: ['a', 'b'],
      enElIndice: [],
      fechas: { a: T0 - 2 * TOLERANCIA_MS, b: T0 - 2 * TOLERANCIA_MS },
    });
    expect(v.estado).toBe('atrasado');
    expect(v.faltan).toHaveLength(2);
  });
});

// ─────────────────────────────────────────────────────────────────────
// §2 — cuánta divergencia es normal
// ─────────────────────────────────────────────────────────────────────

describe('la ventana: el sitio siempre está atrasado un rato', () => {
  it('una actividad recién publicada está «en vuelo», no atrasada', () => {
    const v = veredicto({
      publicados: ['a', 'recien'],
      enElIndice: ['a'],
      fechas: { recien: T0 - 3 * MINUTO },
    });
    expect(v.estado).toBe('en-vuelo');
    expect(v.faltan).toEqual([]);
    expect(v.enVuelo).toBe(1);
  });

  it('justo en el borde todavía está en vuelo, y un minuto después ya no', () => {
    const enElBorde = veredicto({
      publicados: ['falta'],
      enElIndice: [],
      fechas: { falta: T0 - TOLERANCIA_MS },
    });
    expect(enElBorde.estado).toBe('en-vuelo');

    const pasado = veredicto({
      publicados: ['falta'],
      enElIndice: [],
      fechas: { falta: T0 - TOLERANCIA_MS - MINUTO },
    });
    expect(pasado.estado).toBe('atrasado');
  });

  /**
   * **El criterio, no el número** — y por eso este caso lee los otros archivos.
   *
   * La ventana es una suma de cuatro cotas que viven en otros archivos del repo.
   * Si alguno cambia y nadie toca `frescura.js`, la tolerancia queda vieja **y
   * nada lo diría**: el chequeo avisaría de más (si el build tarda más) o de
   * menos. Esto lo pone rojo.
   *
   * MUTACIÓN PROBADA: cambiar `TOPE_DEL_BUILD_MS` a `10 * 60 * 1000` pone este
   * caso en rojo nombrando el `timeout-minutes: 15` del workflow.
   */
  it('cada sumando de la tolerancia coincide con el archivo del que sale', () => {
    const workflow = fuente('.github/workflows/deploy.yml');
    const tope = /timeout-minutes:\s*(\d+)/.exec(workflow);
    expect(tope, 'el workflow ya no declara timeout-minutes').not.toBeNull();
    expect(TOPE_DEL_BUILD_MS).toBe(Number(tope![1]) * MINUTO);
    // El reintento es otro build entero, porque el workflow cancela el que está
    // en curso cuando llega un dispatch nuevo.
    expect(workflow).toContain('cancel-in-progress: true');
    expect(REINTENTO_DEL_BUILD_MS).toBe(TOPE_DEL_BUILD_MS);

    const rebuild = fuente('functions/rebuild-trigger.js');
    const cada = /schedule:\s*'every (\d+) minutes'/.exec(rebuild);
    expect(cada, 'el debounce del §8 ya no es «every N minutes»').not.toBeNull();
    expect(DEBOUNCE_MS).toBe(Number(cada![1]) * MINUTO);

    // Y el total es la suma, no un número elegido aparte.
    expect(TOLERANCIA_MS).toBe(
      DEBOUNCE_MS + TOPE_DEL_BUILD_MS + REINTENTO_DEL_BUILD_MS + PROPAGACION_MS,
    );
  });

  it('el período del chequeo no se confunde con la tolerancia', () => {
    // Son dos preguntas distintas: cada cuánto miro, y cuánto atraso tolero.
    const cada = /schedule:\s*'every (\d+) minutes'/.exec(codigo('functions/frescura-trigger.js'));
    expect(cada).not.toBeNull();
    // Tickear más seguido que la ventana no detecta antes: solo gasta lecturas.
    expect(Number(cada![1]) * MINUTO).toBeLessThanOrEqual(TOLERANCIA_MS);
  });
});

// ─────────────────────────────────────────────────────────────────────
// El reloj con el que se fecha cada divergencia
// ─────────────────────────────────────────────────────────────────────

describe('fechar — de qué reloj sale la edad de una divergencia', () => {
  it('el `updatedAt` del documento manda, y sirve desde la primera corrida', () => {
    // Sin esto, ocho actividades publicadas ayer con el chequeo recién desplegado
    // tendrían edad cero y el sitio roto estaría media hora más en silencio.
    const [d] = fechar(['a'], { a: T0 - 3 * 60 * MINUTO }, [], T0);
    expect(d).toEqual({ slug: 'a', desdeMs: T0 - 3 * 60 * MINUTO, reloj: 'documento' });
  });

  it('sin documento cae a cuándo se vio por primera vez', () => {
    // El único caso: un slug en el JSON cuya actividad se borró de verdad.
    const [d] = fechar(['fantasma'], {}, [{ slug: 'fantasma', desdeMs: T0 - 2 * TOLERANCIA_MS }], T0);
    expect(d).toMatchObject({ desdeMs: T0 - 2 * TOLERANCIA_MS, reloj: 'primera-vez' });
  });

  it('lo que se ve por primera vez y no se puede fechar arranca su reloj ahora', () => {
    const [d] = fechar(['fantasma'], {}, [], T0);
    expect(d).toMatchObject({ desdeMs: T0, reloj: 'primera-vez' });
    // Y por eso necesita una segunda corrida para contar: es el precio de no
    // tener otro reloj, y se paga solo en el caso del borrado duro.
    expect(veredicto({ publicados: [], enElIndice: ['fantasma'] }).estado).toBe('en-vuelo');
  });

  /**
   * **H5 del `auditor-privacidad`.** `vistas` era un **mapa**, y
   * `sistema/frescura` se escribe con `set(..., { merge: true })`: el merge de
   * Firestore es profundo sobre los mapas, así que una clave que deja de venir
   * **no se borra**. O sea que el registro hacía lo contrario de lo que su
   * comentario promete —acumulaba para siempre el slug de todo lo que alguna vez
   * divergió— hasta el tope de 1 MB del documento, y ahí la transacción empieza a
   * fallar: **la alarma se muere en silencio**, que es el modo de falla exacto
   * que este ítem existe para cerrar.
   *
   * Una lista el merge la reemplaza entera. Y de paso el slug —que viene de un
   * archivo traído por HTTP— deja de ser la **clave** de un mapa de Firestore.
   *
   * MUTACIÓN PROBADA: volver `vistas` a `Object.fromEntries(...)` pone en rojo
   * este caso y el de abajo.
   */
  it('las vistas son una lista, no un mapa: el merge de Firestore las reemplaza', () => {
    const v = veredicto({
      publicados: ['falta'],
      enElIndice: [],
      fechas: { falta: T0 - 5 * MINUTO },
    });
    expect(Array.isArray(v.vistas)).toBe(true);
    // Y el trigger la escribe tal cual, sin volver a armar un mapa en el medio.
    expect(codigo('functions/frescura-trigger.js')).toContain('vistas: veredicto.vistas');
  });

  it('y tienen tope, para que el documento no crezca hasta romper la transacción', () => {
    const muchos = Array.from({ length: TOPE_DE_VISTAS + 40 }, (_, i) => `taller-${i}`);
    const v = veredicto({ publicados: muchos, enElIndice: [] });
    expect(v.vistas).toHaveLength(TOPE_DE_VISTAS);
  });

  it('el veredicto devuelve las vistas para persistir, y solo las que siguen divergiendo', () => {
    const v = veredicto({
      publicados: ['a', 'falta'],
      enElIndice: ['a'],
      fechas: { falta: T0 - 5 * MINUTO },
    });
    // `a` coincide de los dos lados: no tiene por qué quedar en el registro.
    expect(v.vistas).toEqual([{ slug: 'falta', desdeMs: T0 - 5 * MINUTO }]);
  });
});

// ─────────────────────────────────────────────────────────────────────
// §3 — cómo avisa, y cuándo no vuelve a avisar
// ─────────────────────────────────────────────────────────────────────

describe('el aviso se deduplica por firma', () => {
  const atrasado = veredicto({
    publicados: ['falta'],
    enElIndice: [],
    fechas: { falta: T0 - 2 * TOLERANCIA_MS },
  });

  it('la firma dice qué diverge, no hace cuánto', () => {
    const masViejo = veredicto({
      publicados: ['falta'],
      enElIndice: [],
      fechas: { falta: T0 - 50 * TOLERANCIA_MS },
    });
    // Si la firma llevara la edad, cada corrida sería una firma nueva y el
    // deduplicado no existiría: un issue cada media hora.
    expect(firmaDe(masViejo)).toBe(firmaDe(atrasado));
  });

  it('no se reavisa de la misma divergencia antes de 24 h', () => {
    const previo = { aviso: { firma: firmaDe(atrasado), enMs: T0 - 60 * MINUTO } };
    expect(decidirAviso({ previo, veredicto: atrasado, ahora: T0 })).toMatchObject({
      avisar: false,
      motivo: 'ya avisado',
    });
  });

  it('pasadas las 24 h vuelve a avisar: sigue roto y nadie lo miró', () => {
    const previo = { aviso: { firma: firmaDe(atrasado), enMs: T0 - REAVISO_MS - MINUTO } };
    expect(decidirAviso({ previo, veredicto: atrasado, ahora: T0 })).toMatchObject({
      avisar: true,
      motivo: 'sigue atrasado',
    });
  });

  it('una divergencia nueva avisa en el acto, aunque haya un aviso reciente', () => {
    const previo = { aviso: { firma: firmaDe(atrasado), enMs: T0 - MINUTO } };
    const otra = veredicto({
      publicados: ['falta', 'otra'],
      enElIndice: [],
      fechas: { falta: T0 - 2 * TOLERANCIA_MS, otra: T0 - 2 * TOLERANCIA_MS },
    });
    expect(decidirAviso({ previo, veredicto: otra, ahora: T0 })).toMatchObject({
      avisar: true,
      motivo: 'divergencia nueva',
    });
  });

  it('sin atraso no se avisa, y el motivo queda escrito igual', () => {
    const fresco = veredicto({ publicados: ['a'], enElIndice: ['a'] });
    expect(decidirAviso({ previo: null, veredicto: fresco, ahora: T0 })).toEqual({
      avisar: false,
      motivo: 'fresco',
    });
  });
});

describe('los dos canales del aviso, y el repo público', () => {
  const trigger = codigo('functions/frescura-trigger.js');

  /**
   * MUTACIÓN PROBADA: borrar la llamada a `crearIssue` del trigger pone este
   * caso en rojo. Es el que impide que el ítem se cierre con «lo loguea»: un
   * aviso que nadie ve es el bug que B-882 existe para cerrar.
   */
  it('el canal primario es un issue en el repo', () => {
    expect(trigger).toContain('crearIssue');
    expect(trigger).toContain("from './github-issues.js'");
  });

  it('y el log con `alerta` va igual, porque el canal de aviso también se rompe', () => {
    expect(trigger).toContain("alerta: 'sitio-atrasado'");
    // El que queda cuando GitHub no contesta: si esto no estuviera, un fallo del
    // canal dejaría el atraso sin ninguna huella.
    expect(trigger).toContain("alerta: 'frescura-sin-canal'");
  });

  it('si el issue no se pudo crear, la reserva se borra para reintentar', () => {
    // Sin esto el chequeo quedaría creyendo que ya avisó de algo que nadie vio.
    expect(trigger).toContain('aviso: FieldValue.delete()');
  });

  /**
   * §5.1 — el repo es público. Del aviso solo salen slugs, y los slugs ya son
   * públicos de los dos lados: el que falta está `publicado` en Firestore y el
   * que sobra ya lo sirve el `events.json`.
   *
   * MUTACIÓN PROBADA: cambiar `slugImprimible` por `String(slug)` en `lista()`
   * pone este caso en rojo con el centinela entero adentro del cuerpo.
   */
  it('al issue no puede colarse nada que no tenga forma de slug', () => {
    const v = compararFrescura({
      faltan: [
        { slug: 'taller-normal', desdeMs: T0 - 2 * TOLERANCIA_MS },
        { slug: 'CENTINELA https://zoom.us/j/9 hola@mail.com', desdeMs: T0 - 2 * TOLERANCIA_MS },
      ],
      ahora: T0,
    });
    const { body } = issueDeAtraso(v);
    expect(body).toContain('`taller-normal`');
    expect(body).not.toContain('CENTINELA');
    expect(body).not.toContain('zoom.us');
    expect(body).not.toContain('@mail.com');
  });

  it('el issue no lista trescientos slugs: resume', () => {
    const muchos = Array.from({ length: 50 }, (_, i) => ({
      slug: `taller-${i}`,
      desdeMs: T0 - 2 * TOLERANCIA_MS,
    }));
    const { body } = issueDeAtraso(compararFrescura({ faltan: muchos, ahora: T0 }));
    expect(body).toContain('…y 30 más');
  });

  /**
   * **H1 del `auditor-privacidad`, P0.** `peorEdadMs` es `ahora - updatedAt`, y un
   * issue de GitHub lleva su `created_at` público: publicar «hace 137 minutos» es
   * publicar el `updatedAt` de un documento con precisión de un minuto, en una
   * salida que no se puede despublicar. El §5 dice que `updatedAt` no sale a
   * ninguna salida, y D-138 ya había recortado `createdAt` al día por lo mismo.
   *
   * MUTACIÓN PROBADA: volver `edadGruesa(...)` a `minutos(veredicto.peorEdadMs)`
   * pone este caso en rojo con el minuto exacto adentro del cuerpo.
   */
  it('el issue no publica el minuto exacto de la divergencia (§5, D-138)', () => {
    const edad = 137 * MINUTO;
    const v = compararFrescura({
      faltan: [{ slug: 'taller-de-cronica', desdeMs: T0 - edad }],
      ahora: T0,
    });
    const { body } = issueDeAtraso(v);
    expect(body).not.toContain('137');
    expect(body).toContain('más que la ventana');
    // La ventana sí va con su número: es una constante de este repo, no el dato
    // de nadie.
    expect(body).toContain(`${TOLERANCIA_MS / MINUTO} minutos`);
  });

  it('los tramos son gruesos: lo más fino que se infiere es una banda de seis horas', () => {
    expect(edadGruesa(45 * MINUTO)).toBe('más que la ventana');
    expect(edadGruesa(5.9 * 60 * MINUTO)).toBe('más que la ventana');
    expect(edadGruesa(7 * 60 * MINUTO)).toBe('más de seis horas');
    expect(edadGruesa(30 * 60 * MINUTO)).toBe('más de un día');
    expect(edadGruesa(10 * 24 * 60 * MINUTO)).toBe('más de una semana');
  });

  /**
   * **H3 del `auditor-privacidad`.** El aviso de «el sitio no contesta» era la
   * única interpolación que no pasaba por una lista blanca: llevaba el
   * `e.message` crudo del `fetch`. Hoy nada privado podía aparecer ahí, pero la
   * garantía volvía a ser de disciplina —«nadie va a agregar mañana el cuerpo de
   * la respuesta para saber qué devolvió»— justo lo que `slugImprimible` cerró
   * por forma para el otro aviso.
   *
   * MUTACIÓN PROBADA: volver a interpolar `motivo` sin filtrarlo por `MOTIVOS`
   * pone este caso en rojo con el centinela entero adentro del cuerpo.
   */
  it('al aviso de «sitio sin índice» tampoco se cuela texto libre (§5.1, trampa 5)', () => {
    const { body, title } = issueDeSinLectura({
      seguidas: 4,
      motivo: 'CENTINELA https://zoom.us/j/9 hola@mail.com +54 9 11 2222 3333',
      url: 'https://ejemplo.test/events.json',
    });
    expect(body).not.toContain('CENTINELA');
    expect(body).not.toContain('zoom.us');
    expect(body).not.toContain('@mail.com');
    expect(body).toContain('`desconocido`');
    expect(title.length).toBeLessThanOrEqual(200);
  });

  it('y el motivo del vocabulario cerrado sí se imprime, que es para lo que está', () => {
    const { body } = issueDeSinLectura({ seguidas: 4, motivo: MOTIVOS.timeout, url: 'u' });
    expect(body).toContain('`timeout`');
  });

  it('el chequeo no cierra issues: cerrar es del dueño', () => {
    expect(trigger).not.toContain('PATCH');
    expect(issueDeAtraso(veredicto({ publicados: [], enElIndice: [] })).body).toContain(
      'Se cierra a mano',
    );
  });
});

// ─────────────────────────────────────────────────────────────────────
// §4 — qué pasa si no se puede leer el `events.json`
// ─────────────────────────────────────────────────────────────────────

describe('un chequeo que grita cuando el roto es él se apaga a la semana', () => {
  it('una página de error servida con 200 no es «se borraron todas»', () => {
    // Es el caso que decide el corte: sin esto, un HTML del CDN con status 200
    // se leería como un índice sin actividades y dispararía la alarma más
    // ruidosa posible por un problema del chequeo.
    expect(leerIndice('<!doctype html><h1>502</h1>')).toMatchObject({
      ok: false,
      motivo: MOTIVOS.noJson,
    });
  });

  it('un JSON que no tiene la lista tampoco alcanza', () => {
    expect(leerIndice('{"generadoEn":"x"}').ok).toBe(false);
    expect(leerIndice('[]').ok).toBe(false);
    expect(leerIndice('{"actividades":[{"titulo":"sin slug"}]}').ok).toBe(false);
  });

  /**
   * **H5, nota menor.** El `id` del índice se interpola en una **ruta de
   * documento** (`actividades/<id>`), y viene de un archivo traído por HTTP: uno
   * con `/` direccionaría otra colección —`…/versiones/…`— o tiraría. Entra por
   * lista blanca de forma, igual que el slug del aviso.
   *
   * MUTACIÓN PROBADA: volver a `typeof a?.id === 'string' && a.id` pone este
   * caso en rojo.
   */
  it('un id con forma rara no llega a armar una ruta de documento', () => {
    const crudo = JSON.stringify({
      actividades: [
        { id: 'abc123', slug: 'bueno' },
        { id: 'otra/coleccion/x', slug: 'raro' },
        { id: '', slug: 'vacio' },
      ],
    });
    const leido = leerIndice(crudo);
    expect(leido.ok).toBe(true);
    expect(leido.idPorSlug).toEqual({ bueno: 'abc123' });
    // El slug sigue entrando a la comparación: lo que se pierde es el atajo para
    // fecharlo, no la divergencia.
    expect(leido.slugs).toEqual(['bueno', 'raro', 'vacio']);
  });

  it('un índice bueno devuelve los slugs y el id de cada uno', () => {
    const leido = leerIndice(indice(['a', 'b']));
    expect(leido).toMatchObject({ ok: true, slugs: ['a', 'b'], idPorSlug: { a: 'id-a', b: 'id-b' } });
  });

  /**
   * MUTACIÓN PROBADA: bajar `FALLAS_PARA_ESCALAR` a 1 pone en rojo el primer
   * caso de acá: un timeout suelto pasaría a abrir un issue.
   */
  it('la primera lectura fallida no avisa a nadie: sube el contador y se calla', () => {
    const f = registrarFalloDeLectura({ previo: null, motivo: MOTIVOS.timeout, ahora: T0 });
    expect(f).toMatchObject({ estado: 'sin-lectura', escalar: false, seguidas: 1 });
    expect(decidirAvisoDeLectura({ previo: null, seguidas: 1, ahora: T0 }).avisar).toBe(false);
  });

  it('el veredicto anterior no se pisa con un «atrasado» inventado', () => {
    const f = registrarFalloDeLectura({ previo: { estado: 'fresco' }, motivo: MOTIVOS.red, ahora: T0 });
    expect(f.estado).toBe('sin-lectura');
    expect(f.estado).not.toBe('atrasado');
  });

  it('varias seguidas sí: ya no es el chequeo, es el sitio que no contesta', () => {
    let previo: Record<string, unknown> | null = null;
    let ultima = registrarFalloDeLectura({ previo, motivo: MOTIVOS.timeout, ahora: T0 });
    for (let i = 1; i < FALLAS_PARA_ESCALAR; i++) {
      previo = { lectura: ultima.lectura };
      ultima = registrarFalloDeLectura({ previo, motivo: MOTIVOS.timeout, ahora: T0 });
    }
    expect(ultima.seguidas).toBe(FALLAS_PARA_ESCALAR);
    expect(ultima.escalar).toBe(true);
    expect(decidirAvisoDeLectura({ previo, seguidas: ultima.seguidas, ahora: T0 })).toMatchObject({
      avisar: true,
      motivo: 'el sitio no contesta',
    });
  });

  it('y tampoco se avisa una vez por corrida mientras el sitio esté caído', () => {
    const previo = { aviso: { firma: 'sin-lectura', enMs: T0 - 60 * MINUTO } };
    expect(decidirAvisoDeLectura({ previo, seguidas: 12, ahora: T0 }).avisar).toBe(false);
  });

  it('el contador se resetea con la primera lectura buena', () => {
    // El trigger escribe `lectura: { ok: true, ..., fallas: 0 }` en la rama
    // buena: sin eso, cuatro timeouts repartidos en un mes escalarían.
    expect(codigo('functions/frescura-trigger.js')).toContain(
      'lectura: { ok: true, motivo: null, detalle: null, fallas: 0 }',
    );
  });
});

// ─────────────────────────────────────────────────────────────────────
// La forma del trigger
// ─────────────────────────────────────────────────────────────────────

describe('el trigger mide el efecto, y lo mide bien', () => {
  const trigger = codigo('functions/frescura-trigger.js');

  /**
   * MUTACIÓN PROBADA: mover la lectura de Firestore arriba del `fetch` pone este
   * caso en rojo. Es un bug real y silencioso: una actividad publicada entre las
   * dos lecturas aparece en el JSON y no en el conjunto de Firestore, o sea un
   * `sobrante` fantasma que el propio chequeo fabricó.
   */
  it('lee el índice ANTES que Firestore, para que la foto de Firestore nunca sea la vieja', () => {
    const indiceEn = trigger.indexOf('await leerElIndice(');
    const firestoreEn = trigger.indexOf('await leerPublicadas(');
    expect(indiceEn).toBeGreaterThan(0);
    expect(firestoreEn).toBeGreaterThan(indiceEn);
  });

  /**
   * MUTACIÓN PROBADA: agregar `?t=${Date.now()}` a la URL pone este caso en
   * rojo. Con un parámetro que esquiva la cache, el chequeo deja de medir lo que
   * el público ve y el «CDN cacheado» —una de las causas que este ítem viene a
   * cubrir— se vuelve invisible.
   */
  it('pide la misma URL que el público, sin esquivar la cache del CDN', () => {
    expect(trigger).toContain('/events.json`');
    expect(trigger).not.toMatch(/events\.json\?[^`'"]/);
    expect(trigger).not.toContain('Cache-Control');
  });

  it('la lectura del índice tiene timeout: un socket colgado no se come la corrida', () => {
    expect(trigger).toContain('AbortSignal.timeout(TIMEOUT_LECTURA_MS)');
  });

  it('compara contra las publicadas y nada más', () => {
    expect(trigger).toContain("where('estado', '==', 'publicado')");
  });

  /**
   * §5.1 — un documento de actividad trae `online.url`, `difusion` y los uids, y
   * nada de eso tiene por qué entrar a una Function que compara listas de slugs.
   * No es por costo (Firestore cobra el documento igual): es para que el campo
   * privado que se agregue mañana no llegue acá solo.
   *
   * MUTACIÓN PROBADA: sacar el `.select(...)` —o volver el fechado de sobrantes
   * a un `.get()` del documento entero— pone este caso en rojo.
   */
  it('de cada actividad pide el slug y la fecha, no el documento entero', () => {
    expect(trigger).toContain("select('slug', 'updatedAt')");
    expect(trigger).toContain("fieldMask: ['updatedAt']");
  });

  /**
   * El trabajo por corrida tiene que estar acotado. El caso normal son cero
   * sobrantes; el feo —alguien despublica media agenda— serían doscientas
   * lecturas de a una, y una Function que se cuelga no avisa nada.
   *
   * MUTACIÓN PROBADA: sacar el `.slice(...)` pone este caso en rojo.
   */
  it('fechar los sobrantes tiene tope: el trabajo por corrida está acotado', () => {
    expect(trigger).toContain('TOPE_DE_SOBRANTES_A_FECHAR');
    expect(trigger).toContain('sobran.slice(0, TOPE_DE_SOBRANTES_A_FECHAR)');
  });

  /**
   * La clase de B-85. El `previo` con el que se decide si abrir un issue se leyó
   * antes de un `fetch` de hasta 10 s, así que la decisión se vuelve a tomar
   * adentro de una transacción contra el documento de ahora. Sin eso, dos
   * corridas superpuestas abren dos issues del mismo atraso.
   *
   * `tests/clases-de-bug.test.ts` ya se pone rojo si la transacción desaparece
   * (los cuatro síntomas encendidos); esto afirma la otra mitad: que adentro de
   * la transacción se **relea y se vuelva a decidir**, y no que solo se escriba.
   *
   * MUTACIÓN PROBADA: mover el `decidirAviso` afuera de la transacción deja el
   * chequeo de B-85 en verde (la transacción sigue estando) y pone este en rojo.
   */
  it('la decisión de avisar se toma adentro de la transacción, releyendo', () => {
    // Los cuerpos de las dos transacciones (la del veredicto y la de la lectura
    // fallida), recortados desde su apertura.
    const cuerpos = trigger
      .split('runTransaction(')
      .slice(1)
      .map((x) => x.slice(0, 1500));
    expect(cuerpos.length, 'el trigger ya no tiene transacciones').toBe(2);
    for (const c of cuerpos) expect(c).toContain('await tx.get(ref)');
    // Las dos decisiones de aviso —la del atraso y la del sitio que no
    // contesta— se toman contra el documento releído, no contra el `previo`
    // que se leyó antes del `fetch`.
    expect(cuerpos.some((c) => /\bdecidirAviso\(/.test(c))).toBe(true);
    expect(cuerpos.some((c) => /\bdecidirAvisoDeLectura\(/.test(c))).toBe(true);
  });

  /**
   * **Lo que marcó el `auditor-trampas` como «sin red».** `crearIssue` vive hoy
   * en dos lugares: `functions/github-issues.js` (el módulo, que usa este
   * chequeo) y una copia inline en `functions/reportes-trigger.js`. La
   * duplicación es deliberada y está dicha en la cabecera del módulo —ese archivo
   * lo está tocando otro frente— pero **es exactamente la forma de B-74**, donde
   * el cliente del `repository_dispatch` se copió y la copia perdió el timeout.
   *
   * Mientras las dos existan, esto ata lo único que se perdió aquella vez. El día
   * que `reportes-trigger.js` importe el módulo, este caso se borra con la copia.
   *
   * MUTACIÓN PROBADA: bajar `TIMEOUT_ISSUE_MS` a 5_000 lo pone en rojo nombrando
   * los dos archivos.
   */
  it('las dos copias de `crearIssue` siguen teniendo el mismo timeout (B-74)', () => {
    const delModulo = /TIMEOUT_ISSUE_MS = (\d+)_?(\d*)/.exec(codigo('functions/github-issues.js'));
    const inline = /TIMEOUT_MS = (\d+)_?(\d*)/.exec(codigo('functions/reportes-trigger.js'));
    expect(delModulo, 'github-issues.js ya no declara su timeout').not.toBeNull();
    expect(inline, 'reportes-trigger.js ya no tiene la copia — borrá este caso').not.toBeNull();
    expect(delModulo![0].replace(/\D/g, '')).toBe(inline![0].replace(/\D/g, ''));
  });

  it('está exportada desde `index.js`, o no existe', () => {
    expect(fuente('functions/index.js')).toContain(
      "export { verificarFrescuraDelSitio } from './frescura-trigger.js';",
    );
  });

  it('el origen del sitio es config y no un literal del código', () => {
    // D-165 — el dominio no se copia. En `functions/` no se puede importar
    // `rutasPublicas.ts`, así que va por `.env`, como `SEARCH_CONSOLE_SITE`.
    expect(trigger).toContain('process.env.SITIO_PUBLICO');
    expect(trigger).not.toContain('agendaleh');
    expect(fuente('functions/.env')).toContain('SITIO_PUBLICO=');
  });
});
