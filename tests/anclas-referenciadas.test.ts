/**
 * Las anclas de `docs/` y del `CLAUDE.md` resuelven a un encabezado — B-1171.
 *
 * La red que `scripts/anclas-referenciadas.mjs` anuncia en su propia salida, y
 * el tercer hermano de `items-referenciados.test.ts` y
 * `decisiones-referenciadas.test.ts`.
 *
 * **La clase de bug: un ancla rota no se ve rota.** La página carga, no hay
 * 404, y el salto no va a ninguna parte. En este repo la causa es estructural
 * —el `·` de los encabezados deja **dos** guiones en el ancla— y la otra es
 * renombrar un encabezado sin tocar a quien lo cita. Se encontraron ocho a mano
 * entre el 2026-09-02 y el 2026-09-22; al escribir este test quedaba una
 * (`07-seguridad.md` → `#d-640`, que se escribió con el ancla corta).
 *
 * ── Qué congela ───────────────────────────────────────────────────
 * La deuda de hoy es **cero**, así que la lista congelada está vacía y el test
 * exige que siga así. Se deja la forma de lista —y no un `toEqual([])` pelado—
 * para el día en que un registro histórico (`06-decisiones.md`, el CHANGELOG,
 * los backlogs), que no se reescribe a la ligera, cite un encabezado que dejó
 * de existir: ese caso se congela con su motivo, y la lista solo puede bajar.
 */
import { describe, expect, it } from 'vitest';
import {
  anclasDe,
  enlacesConAncla,
  relevar,
  rotos,
  slugDeGithub,
} from '../scripts/anclas-referenciadas.mjs';

/** `archivo:enlace` de las rotas que se toleran, con su motivo. Hoy, ninguna. */
const CONGELADAS: Record<string, string> = {};

describe('las anclas de docs/ y CLAUDE.md — B-1171', () => {
  const { corpus, enlaces, rotos: sueltos } = relevar();
  const clave = (r: { archivo: string; enlace: string }) => `${r.archivo}:${r.enlace}`;

  it('no nació ningún ancla rota', () => {
    const nuevas = sueltos.filter((r) => !(clave(r) in CONGELADAS));
    expect(
      nuevas.map((r) => `${r.archivo}:${r.linea} ](${r.enlace}) — ${r.motivo}`),
      'Este enlace no salta a ningún encabezado. Copiá el ancla de GitHub (clic en ' +
        'el eslabón del encabezado) o corré `node scripts/anclas-referenciadas.mjs`. ' +
        'Ojo con el `·` de los encabezados: deja DOS guiones.',
    ).toEqual([]);
  });

  it('las congeladas siguen rotas, y si arreglaste una hay que sacarla de la lista', () => {
    const arregladas = Object.keys(CONGELADAS).filter((k) => !sueltos.some((r) => clave(r) === k));
    expect(arregladas, 'La lista solo puede bajar.').toEqual([]);
  });

  it('el barrido mira algo — no queda verde por no buscar', () => {
    expect(corpus).toContain('CLAUDE.md');
    expect(corpus).toContain('docs/16-analitica-del-sitio.md');
    expect(corpus.some((a) => a.startsWith('docs/prd/'))).toBe(true);
    expect(enlaces).toBeGreaterThan(100);
  });
});

/**
 * Los controles positivos, sin disco. Cada uno es una forma en que el slug o el
 * barrido se podría equivocar — y un chequeo que da falsos positivos se aprende
 * a ignorar, que es la otra manera de que muera.
 */
describe('el mecanismo — el slug de GitHub', () => {
  it('el `·` deja dos guiones', () => {
    expect(slugDeGithub('5.3 · El invariante nuevo')).toBe('53--el-invariante-nuevo');
  });

  it('conserva el `_` — la trampa que midió B-1171', () => {
    expect(slugDeGithub('7.6 · `filtro_sin_resultados` dice cuál')).toBe(
      '76--filtro_sin_resultados-dice-cuál',
    );
    expect(slugDeGithub('page_view')).toBe('page_view');
  });

  it('conserva tildes y eñes, y borra el énfasis', () => {
    expect(slugDeGithub('**Pendiente** de acción manual del dueño')).toBe(
      'pendiente-de-acción-manual-del-dueño',
    );
  });

  it('un encabezado repetido gana -1, -2', () => {
    const anclas = anclasDe('## Notas\n\n## Notas\n\n## Notas\n');
    expect([...anclas]).toEqual(['notas', 'notas-1', 'notas-2']);
  });

  it('un `<form>` en código en línea deja `form` en el ancla; una etiqueta real, nada', () => {
    expect(anclasDe('## D-640 · Un `<form>` a Mailchimp\n')).toContain('d-640--un-form-a-mailchimp');
    expect(anclasDe('## Hola <br> mundo\n')).toContain('hola--mundo');
  });

  it('un enlace en el encabezado aporta solo su texto', () => {
    expect(anclasDe('## Ver [D-9](06-decisiones.md#d-09)\n')).toContain('ver-d-9');
  });

  it('un `<a id>` cuenta como ancla', () => {
    expect(anclasDe('<a id="aca"></a>\n')).toContain('aca');
  });

  it('un `#` adentro de un bloque de código no es un encabezado', () => {
    expect(anclasDe('```bash\n# no soy un título\n```\n').size).toBe(0);
  });
});

describe('el mecanismo — los enlaces', () => {
  it('encuentra el ancla propia y la de otro .md, y no la de http', () => {
    const e = enlacesConAncla('[a](#uno) y [b](otro.md#dos) y [c](https://x.org/#tres)\n');
    expect(e.map((x) => `${x.destino}#${x.ancla}`)).toEqual(['#uno', 'otro.md#dos']);
  });

  it('un ejemplo en código en línea o cercado no es una cita', () => {
    expect(enlacesConAncla('se escribe `](#algo)`\n\n```md\n[x](#y)\n```\n')).toEqual([]);
  });

  it('un ancla que no existe sale rota, y una que existe no', () => {
    const textos = {
      'docs/a.md': '## 5.3 · Algo\n\n[bien](#53--algo) [mal](#53-algo) [otro](b.md#x)\n',
      'docs/b.md': '## X\n',
    };
    const r = rotos(textos, () => null);
    expect(r.map((x) => x.enlace)).toEqual(['#53-algo']);
  });

  it('resuelve la ruta relativa, y un archivo que no existe también es roto', () => {
    const textos = { 'docs/a.md': '[c](../CLAUDE.md#hola) [d](nada.md#x)\n' };
    const leer = (ruta: string) => (ruta === 'CLAUDE.md' ? '## Hola\n' : null);
    expect(rotos(textos, leer).map((x) => [x.enlace, x.motivo])).toEqual([
      ['nada.md#x', 'sin-archivo'],
    ]);
  });
});
