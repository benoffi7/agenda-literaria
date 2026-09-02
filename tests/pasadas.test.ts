import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

import {
  BAJADA_DE_PASADAS,
  TITULO_DE_PASADAS,
  VACIO_DE_PASADAS,
  descripcionDePasadas,
  frasesDePasadas,
  pasadasDelSitio,
} from '@/lib/pasadasPublicas';
import { agruparPorMes, estadoDe, vigentesDelIndice } from '@/lib/listadoPublico';
import { RUTA_PASADAS } from '@/lib/rutasPublicas';
import { RUTAS_FIJAS } from '@/lib/sitemap';
import { construirIndice } from '@/lib/eventsJson';
import { entradaDePrueba } from './fixtures/indice';

/**
 * `/pasadas` — el archivo. B-109, §4.5 del diseño.
 *
 * ── Qué se puede romper acá, que no es que se rompa ───────────────────────
 * Esta página existe **para que ninguna página de detalle quede huérfana**
 * (§2.1), y la forma de romperla es dejar afuera actividades sin que nada lo
 * diga. Tres modos de falla, los tres invisibles:
 *
 * 1. **Una publicada que no está ni en la home ni acá.** Su única entrada
 *    interna era el sitemap, y la entrada del sitemap se acaba a los 90 días
 *    (`lib/sitemap.ts`): a partir de ahí no la enlaza nada. El invariante de la
 *    partición es el aserto principal de este archivo.
 * 2. **El orden al revés.** Un archivo que abre con el taller de hace dos años
 *    se ve igual de bien y no sirve para lo que la cabecera promete («muchas se
 *    repiten: seguí a quien la organiza»).
 * 3. **Una cancelada colándose.** El §7.3 es explícito: no entra a ninguna
 *    lista, `/pasadas` incluida.
 *
 * ── El reloj entra como parámetro ─────────────────────────────────────────
 * Todo contra `AHORA`, así que ningún caso depende de qué día es hoy.
 */
const AHORA = new Date('2026-09-10T15:00:00Z');

const raiz = (rel: string): string => fileURLToPath(new URL(`../${rel}`, import.meta.url));
const fuente = (rel: string): string => readFileSync(raiz(rel), 'utf8');

const sinComentarios = (src: string): string =>
  src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/<!--[\s\S]*?-->/g, '');

const suelta = (slug: string, iso: string) =>
  entradaDePrueba({ id: slug, slug, titulo: slug, fechas: [iso] });

/** Tres pasadas de tres meses distintos y una que todavía no pasó. */
const MAYO = suelta('de-mayo', '2026-05-20T22:00:00Z');
const JULIO = suelta('de-julio', '2026-07-15T22:00:00Z');
const AGOSTO = suelta('de-agosto', '2026-08-28T22:00:00Z');
const FUTURA = suelta('por-venir', '2026-09-24T22:00:00Z');
const TODAS = [JULIO, FUTURA, MAYO, AGOSTO];

describe('qué entra', () => {
  it('lo que pasó entra, lo que viene no', () => {
    const slugs = pasadasDelSitio(TODAS, AHORA).map((e) => e.slug);
    expect(slugs).toContain('de-mayo');
    expect(slugs).not.toContain('por-venir');
  });

  it('«pasó» es la misma definición que usa el resto del sitio', () => {
    /*
     * No se reescribe acá: sale de `estadoDe`, que es lo que decide el filtro
     * «Cuándo» de la home. Con dos definiciones, la home y `/pasadas` podrían
     * mostrar la misma actividad las dos —o ninguna— y las dos páginas se seguirían
     * viendo bien (la clase de B-88).
     */
    for (const e of pasadasDelSitio(TODAS, AHORA)) {
      expect(estadoDe(e, AHORA).paso).toBe(true);
    }
  });

  it('un ciclo con un encuentro por venir NO es una pasada', () => {
    // §7.2 — un ciclo empezado es **vigente**: tiene sesiones futuras. Si cayera
    // acá, el archivo mostraría como terminado algo a lo que todavía se puede ir.
    const enCurso = entradaDePrueba({
      id: 'ciclo',
      slug: 'ciclo',
      esCiclo: true,
      fechas: ['2026-09-03T22:00:00Z', '2026-09-24T22:00:00Z'],
    });
    expect(pasadasDelSitio([enCurso], AHORA)).toEqual([]);
  });

  it('la home y `/pasadas` parten en dos las publicadas, sin huérfanas', () => {
    /*
     * **El aserto principal de este archivo.** Toda actividad publicada tiene que
     * estar en exactamente una de las dos páginas: en las dos sería contradictorio,
     * y en ninguna es una **página huérfana** — sin un solo link interno una vez
     * que su entrada del sitemap venció a los 90 días.
     *
     * MUTACIÓN PROBADA: filtrar por `estado.hasta` en vez de por `estado.paso`
     * —o excluir las de todos los encuentros cancelados «porque no pasaron»— deja
     * actividades en ninguna de las dos y pone este caso en rojo nombrándolas.
     */
    const indice = construirIndice({
      actividades: [],
      opciones: {},
      version: 'test',
      generadoEn: AHORA.toISOString(),
    });
    const conActividades = { ...indice, actividades: TODAS };

    const enLaHome = vigentesDelIndice(conActividades, AHORA).map((e) => e.slug);
    const enPasadas = pasadasDelSitio(TODAS, AHORA).map((e) => e.slug);

    expect([...enLaHome].sort()).not.toEqual([]);
    expect(enLaHome.filter((s) => enPasadas.includes(s))).toEqual([]);
    expect([...enLaHome, ...enPasadas].sort()).toEqual(TODAS.map((e) => e.slug).sort());
  });

  it('una actividad con todos sus encuentros cancelados entra igual — B-254', () => {
    /*
     * No «pasó» en el sentido de que se hizo, pero **no tiene ninguna fecha por
     * venir**, así que la home no la muestra (`cuando=proximas` la excluye). Si
     * tampoco entrara acá, su página no la enlazaría nada — que es la huérfana
     * del caso de arriba. Va al fondo del orden porque no tiene `hasta` con el
     * que ubicarla en un mes.
     */
    const anulada = entradaDePrueba({
      id: 'anulada',
      slug: 'anulada',
      fechas: ['2026-09-24T22:00:00Z'],
      canceladas: [0],
    });
    const salida = pasadasDelSitio([anulada, AGOSTO], AHORA);
    expect(salida.map((e) => e.slug)).toEqual(['de-agosto', 'anulada']);
  });

  it('las canceladas no pueden entrar ni queriendo (§7.3)', () => {
    /*
     * No hay filtro que verificar y eso es la afirmación: este módulo recibe
     * `EntradaDeIndice[]`, o sea el índice, y una cancelada **nunca entra al
     * índice** (B-110, dos queries y dos campos distintos de `ContenidoDelSitio`).
     * La garantía la da el tipo, no una condición que alguien pueda borrar.
     */
    // Sobre el código y no sobre el archivo crudo: los dos docblocks nombran las
    // canceladas justamente para explicar por qué no entran.
    const modulo = sinComentarios(fuente('src/lib/pasadasPublicas.ts'));
    expect(modulo).toContain('EntradaDeIndice');
    expect(modulo).not.toContain('cancelada');
    expect(sinComentarios(fuente('src/pages/pasadas.astro'))).not.toContain('cancelada');
  });
});

describe('el orden: de lo más reciente a lo más antiguo', () => {
  it('abre con lo último que pasó', () => {
    /*
     * MUTACIÓN PROBADA: invertir el `sort` —o dejarlas en el orden del índice—
     * deja la página perfectamente funcional y pone este caso en rojo. Un archivo
     * que abre con el taller de hace dos años no sirve para lo que la cabecera
     * promete: enterarse de lo que hubo hace poco para seguir a quien lo organiza.
     */
    expect(pasadasDelSitio(TODAS, AHORA).map((e) => e.slug)).toEqual([
      'de-agosto',
      'de-julio',
      'de-mayo',
    ]);
  });

  it('los marcadores de mes salen en ese mismo orden', () => {
    /*
     * `agruparPorMes` agrupa **consecutivos** por el mes de `proxima ?? hasta`, y
     * en una pasada `proxima` es siempre `null`. O sea que el orden de arriba es
     * lo único que decide los marcadores: sin él, la página mostraría «AGOSTO»,
     * «MAYO», «JULIO» y hasta un mes repetido dos veces.
     */
    const grupos = agruparPorMes(pasadasDelSitio(TODAS, AHORA), AHORA);
    expect(grupos.map((g) => g.clave)).toEqual(['2026-08', '2026-07', '2026-05']);
    // Y ninguno repetido: dos marcadores del mismo mes son la firma de una lista
    // mal ordenada.
    expect(new Set(grupos.map((g) => g.clave)).size).toBe(grupos.length);
  });
});

describe('lo que la página dice', () => {
  it('el título y la bajada son los del §4.5, y no interpolan datos', () => {
    /*
     * La cabecera del diseño, palabra por palabra: «Lo que ya pasó. Muchas de
     * estas actividades se repiten: si te interesa una, seguí a quien la
     * organiza.» Es lo que convierte «llegué tarde» en algo que se puede hacer.
     */
    expect(TITULO_DE_PASADAS).toBe('Lo que ya pasó');
    expect(BAJADA_DE_PASADAS).toContain('se repiten');
    expect(BAJADA_DE_PASADAS).toContain('seguí a quien la organiza');
    expect(VACIO_DE_PASADAS.trim()).not.toBe('');
  });

  it('las cuatro frases salen de una función que recibe las entradas', () => {
    /*
     * Que `frasesDePasadas` **tenga los datos a mano y no los use** es lo que hace
     * verificable el «acá no se interpola nada»: el barrido de centinelas de esta
     * salida corre sobre su salida con la lista de permitidos **vacía**, así que el
     * día que una frase meta un título el barrido lo dice sin tocar ningún test.
     *
     * Con las frases sueltas, esa interpolación se agregaría por un parámetro
     * nuevo y el barrido seguiría llamándolas sin datos: verde y publicando.
     */
    const frases = frasesDePasadas(pasadasDelSitio(TODAS, AHORA));
    expect(frases).toEqual({
      titulo: TITULO_DE_PASADAS,
      bajada: BAJADA_DE_PASADAS,
      descripcion: descripcionDePasadas(3),
      vacio: VACIO_DE_PASADAS,
    });
    // Y la página las pide, no las arma.
    expect(sinComentarios(fuente('src/pages/pasadas.astro'))).toContain(
      'frasesDePasadas(entradas)',
    );
  });

  it('la descripción lleva la cuenta y ningún título de actividad', () => {
    /*
     * A diferencia de `descripcionDelMes`, que mete tres títulos en la
     * `meta description` (y por eso tiene barrido de centinelas), esta frase no
     * interpola **nada** de una actividad: solo cuántas. Es una salida pública
     * menos por donde se puede escapar algo, y está afirmado para que agregar una
     * interpolación sea una decisión.
     */
    expect(descripcionDePasadas(3)).toContain('3 actividades');
    expect(descripcionDePasadas(1)).toContain('1 actividad');
    expect(descripcionDePasadas(0)).not.toContain('0');
    for (const n of [0, 1, 3]) {
      const texto = descripcionDePasadas(n);
      expect(texto).not.toContain('de-mayo');
      expect(texto.length).toBeLessThan(180);
    }
  });
});

describe('la página', () => {
  const PAGINA = 'src/pages/pasadas.astro';
  const src = () => sinComentarios(fuente(PAGINA));

  it('control positivo: la página existe y está versionada', () => {
    expect(
      execFileSync('git', ['ls-files', 'src/pages'], { encoding: 'utf8' }),
    ).toContain(PAGINA);
    expect(src().length).toBeGreaterThan(200);
  });

  it('declara la sección «agenda»: es el archivo de la agenda, no una sección nueva', () => {
    // `chrome-del-sitio.test.ts` exige que **haya** sección; cuál es lo sabe esta
    // página. Es la misma decisión que la página de mes y la de detalle.
    expect(src()).toMatch(/<Base[^>]*\bseccion="agenda"/s);
  });

  it('es estática y no monta ninguna island', () => {
    /*
     * El §4.5 pide «sin filtros salvo la búsqueda», y la búsqueda es la island de
     * la home, que filtra lo **vigente** y no sabe de pasadas: traerla acá es un
     * cambio de la island (B-292). Mientras tanto, cero JavaScript — como el
     * detalle y la cartelera.
     */
    expect(src()).toContain('export const prerender = true;');
    expect(src()).not.toMatch(/client:(load|idle|visible|only|media)/);
  });

  it('no ve el índice: recibe su view-model (D-140)', () => {
    /*
     * La tentación es `indiceDelSitio()` acá para sacar las etiquetas: no filtra
     * nada y deja el índice entero —con `searchText` y `creadoEn`— al alcance de
     * un `{}`. Es la puerta que el `auditor-privacidad` encontró abierta en la
     * primera versión de la página de mes.
     */
    expect(src()).toContain('vistaDePasadas');
    expect(src()).not.toContain('indiceDelSitio');
    expect(src()).not.toContain('firebase-admin');
    expect(src()).not.toContain('searchText');
  });

  it('usa el reloj del índice y no `new Date()`', () => {
    // Con dos relojes, una actividad que termina mientras corre el build puede
    // quedar afuera de la home y de acá: la huérfana que esta página evita.
    expect(src()).toContain('new Date(generadoEn)');
    expect(src()).not.toContain('new Date()');
  });

  it('está en el sitemap y se llega desde el pie de todas las páginas', () => {
    /*
     * Las dos mitades de para qué existe (§2.1): la entrada del sitemap y **un
     * link interno permanente**. Sin el segundo, una página en el sitemap y sin
     * links vale casi nada para un buscador — que es justamente el problema de
     * las pasadas que esta página vino a resolver.
     */
    expect(RUTAS_FIJAS).toContain(RUTA_PASADAS);
    const pie = sinComentarios(fuente('src/components/sitio/PieDePagina.astro'));
    expect(pie).toContain('RUTA_PASADAS');
    expect(pie).toContain('Lo que ya pasó');
  });

  it('el sistema visual: sin radio, sin sombras y sin opacidades', () => {
    /*
     * D-146: radio 0, estrictamente plano, tintas con nombre y no opacidades. El
     * §4.5 pedía las tarjetas «atenuadas» y eso se escribió antes del rediseño —
     * una opacidad es por donde se cae el contraste (B-235). Lo que distingue una
     * pasada es la **tinta** del bloque de fecha (`super` y no terracota), que la
     * fila ya aplica sola. El desvío está en D-167.
     */
    const codigo = src();
    expect(codigo).not.toMatch(/\brounded/);
    expect(codigo).not.toMatch(/\bshadow-/);
    expect(codigo).not.toMatch(/\bopacity-/);
    expect(codigo).not.toMatch(/text-tinta\/\d/);
  });
});
