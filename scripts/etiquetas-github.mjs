#!/usr/bin/env node
/**
 * Crea (o actualiza) en GitHub las etiquetas que el panel le pone a sus issues
 * — B-33.
 *
 * ── Qué problema resuelve ──────────────────────────────────────────────────
 * `functions/reportes.js` abre el issue con `labels: [...]`. GitHub crea sola
 * cualquier etiqueta que no exista, así que **nada se rompe** si faltan: el issue
 * entra igual, pero con etiquetas grises, sin descripción y —lo que importa— sin
 * que nadie sepa cuáles son sin abrir un issue. El backlog las tenía como
 * «crearlas a mano una vez, los comandos están en la doc».
 *
 * El dueño eligió automatizarlo. Este es ese script.
 *
 * ── La lista NO está escrita acá ───────────────────────────────────────────
 * Es la regla de este repo y el motivo por el que el ítem valía la pena: una
 * lista de etiquetas escrita a mano en un script es una segunda fuente de verdad
 * que se separa de la primera sin que nada falle — la misma forma por la que
 * `desSlug` se duplicó (H2) y por la que la analítica dejó de reconocer las
 * versiones del build (B-88).
 *
 * Así que las etiquetas **se derivan del productor, ejecutándolo**:
 *
 *   1. el dominio de `tipo` sale de `firestore.rules`, que es donde está la
 *      regla que lo acota (`d.tipo in ['bug', 'sugerencia']`);
 *   2. por cada `tipo`, se llama a `construirIssue` de `functions/reportes.js`
 *      —la misma función que corre en la Cloud Function— y se junta lo que
 *      devuelve en `labels`.
 *
 * O sea que la lista no es lo que alguien creyó que el productor aplica: es lo
 * que el productor aplica. Si mañana `construirIssue` agrega una etiqueta, este
 * script la crea sin que nadie lo toque.
 *
 * Lo único escrito a mano es el **color y la descripción** de cada una, que son
 * cosmética y no se pueden derivar de ninguna parte. Una etiqueta derivada que
 * no tenga cosmética se crea igual, con el gris de default y un aviso — nunca se
 * saltea. `tests/etiquetas-github.test.ts` ata las dos listas: si el productor
 * empieza a aplicar una etiqueta que no está en `COSMETICA`, el test se pone rojo
 * pidiendo su color.
 *
 * ── Credenciales ───────────────────────────────────────────────────────────
 * Usa el `gh` que ya está autenticado en la máquina de quien lo corre. **No pide,
 * no crea y no lee ninguna credencial nueva** (§5.4): un agente no debe tener un
 * token en la mano, y este script tampoco necesita uno.
 *
 * Uso:
 *   node scripts/etiquetas-github.mjs              # crea/actualiza y verifica
 *   node scripts/etiquetas-github.mjs --dry-run    # dice qué haría, sin tocar nada
 *   node scripts/etiquetas-github.mjs --json       # las etiquetas derivadas, y nada más
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { construirIssue } from '../functions/reportes.js';

const RAIZ = new URL('..', import.meta.url);
const leer = (relativo) => readFileSync(fileURLToPath(new URL(relativo, RAIZ)), 'utf8');

/**
 * El dominio de `reporte.tipo`, sacado de la regla que lo acota.
 *
 * `firestore.rules` es la fuente de verdad de qué puede escribir el panel, así
 * que es también la fuente de verdad de qué `tipo` puede llegarle a
 * `construirIssue`. Es el mismo criterio con el que el fixture de reportes deriva
 * sus claves de las reglas (B-361).
 */
export const tiposDeReporte = (reglas = leer('firestore.rules')) => {
  const m = /d\.tipo\s+in\s+\[([^\]]+)\]/.exec(reglas);
  if (!m) {
    throw new Error(
      'no se encontró la regla que acota `tipo` en firestore.rules.\n' +
        '  Se buscaba algo con la forma `d.tipo in [...]`. Si la regla cambió de\n' +
        '  forma, este script no puede derivar las etiquetas y NO debe adivinarlas.',
    );
  }
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
};

/**
 * Las etiquetas que el productor aplica, ejecutándolo.
 *
 * No se leen del fuente con un regex: se llama a `construirIssue` con un reporte
 * mínimo de cada tipo y se junta lo que devuelve. Un regex sobre `labels: [...]`
 * habría dado la lista literal y no la efectiva — y la efectiva es la que GitHub
 * ve.
 */
export const etiquetasDelProductor = (tipos = tiposDeReporte()) => {
  const juntadas = new Set();
  for (const tipo of tipos) {
    const { labels } = construirIssue({
      id: 'rep_derivacion',
      reporte: { tipo, titulo: 'derivación', descripcion: '' },
      actividad: null,
    });
    for (const l of labels) juntadas.add(l);
  }
  return [...juntadas].sort();
};

/**
 * Color y descripción de cada etiqueta. Es lo único a mano, y es cosmética.
 *
 * Los colores siguen la convención de GitHub: `d73a4a` es el rojo de `bug` que
 * el propio GitHub usa, y las otras dos se eligieron para que se distingan de un
 * vistazo en la lista de issues.
 *
 * **Si el productor aplica una etiqueta que no está acá, se crea igual** con el
 * default de abajo y un aviso: una etiqueta sin color es mejor que una etiqueta
 * que no existe. Lo que avisa a tiempo es el test.
 */
const COSMETICA = {
  'reporte-panel': {
    color: '0e8a16',
    descripcion: 'Entró por el formulario de reportes del panel, no a mano',
  },
  bug: { color: 'd73a4a', descripcion: 'Algo no funciona como debería' },
  sugerencia: { color: 'a2eeef', descripcion: 'Idea o mejora propuesta desde el panel' },
};

const DEFAULT = { color: 'ededed', descripcion: 'Etiqueta que el panel aplica a sus issues' };

const gh = (...args) => execFileSync('gh', args, { encoding: 'utf8' });

const main = () => {
  const etiquetas = etiquetasDelProductor();

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(etiquetas, null, 2));
    return 0;
  }

  /*
   * Control positivo. Un script que deriva su lista puede derivar una lista
   * vacía —porque cambió la forma de la regla, porque `construirIssue` dejó de
   * devolver `labels`— y entonces «no hay nada que crear» se ve idéntico a «todo
   * está creado». Es el mismo modo de falla que B-217 encontró en el gate de
   * build: un chequeo que pasa sin haber mirado nada.
   */
  if (etiquetas.length < 2) {
    console.error(
      `✗ la derivación dio ${etiquetas.length} etiqueta(s), y son al menos dos ` +
        '(la fija más una por tipo de reporte).\n' +
        '  Algo cambió en functions/reportes.js o en firestore.rules. El script NO\n' +
        '  inventa la lista: revisá la derivación antes de crear nada.',
    );
    return 1;
  }

  const seco = process.argv.includes('--dry-run');
  console.log(
    `Etiquetas derivadas de functions/reportes.js: ${etiquetas.join(', ')}\n` +
      (seco ? '(--dry-run: no se toca nada)\n' : ''),
  );

  if (!seco) {
    const disponible = spawnSync('gh', ['--version'], { stdio: 'ignore' });
    if (disponible.status !== 0) {
      console.error(
        '✗ no se encontró `gh` (o no está autenticado).\n' +
          '  Este script usa la sesión de `gh` que ya tenés: no crea credenciales\n' +
          '  ni las pide (§5.4). Instalalo y corré `gh auth login`.',
      );
      return 1;
    }
  }

  let salida = 0;
  for (const nombre of etiquetas) {
    const { color, descripcion } = COSMETICA[nombre] ?? DEFAULT;
    if (!COSMETICA[nombre]) {
      console.log(
        `  ⚠ ${nombre}: sin color elegido, se crea con el default.\n` +
          '    Agregala a COSMETICA de este script (tests/etiquetas-github.test.ts te lo va a pedir).',
      );
    }
    if (seco) {
      console.log(`  · ${nombre} → #${color} · ${descripcion}`);
      continue;
    }
    try {
      // `--force` es lo que lo hace idempotente: crea si no existe y actualiza
      // color y descripción si existe. Correrlo dos veces no falla ni duplica.
      gh('label', 'create', nombre, '--color', color, '--description', descripcion, '--force');
      console.log(`  ✓ ${nombre}`);
    } catch (e) {
      console.error(`  ✗ ${nombre}: ${e instanceof Error ? e.message : String(e)}`);
      salida = 1;
    }
  }

  if (seco) return 0;

  // La verificación que pidió el ítem: qué quedó, leído de GitHub, para poder
  // confirmarlo sin abrir el navegador.
  console.log('\nComo quedaron en GitHub:');
  try {
    const lista = JSON.parse(gh('label', 'list', '--json', 'name,color,description', '--limit', '200'));
    const porNombre = new Map(lista.map((l) => [l.name, l]));
    for (const nombre of etiquetas) {
      const l = porNombre.get(nombre);
      if (!l) {
        console.error(`  ✗ ${nombre}: NO existe en el repo después de crearla.`);
        salida = 1;
      } else {
        console.log(`  ✓ ${l.name} · #${l.color} · ${l.description || '(sin descripción)'}`);
      }
    }
  } catch (e) {
    console.error(`  ⚠ no se pudo leer la lista de etiquetas: ${e instanceof Error ? e.message : String(e)}`);
    salida = 1;
  }

  return salida;
};

if (process.argv[1] && process.argv[1].endsWith('etiquetas-github.mjs')) {
  process.exit(main());
}

export { COSMETICA };
