import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// @ts-expect-error — el productor es .js sin tipos, igual que en el resto de la suite.
import { construirIssue } from '../functions/reportes.js';
// @ts-expect-error — el script es .mjs sin tipos, igual que `scripts/version.mjs`.
import { COSMETICA, etiquetasDelProductor, tiposDeReporte } from '../scripts/etiquetas-github.mjs';

/**
 * `scripts/etiquetas-github.mjs` — las etiquetas de GitHub, derivadas — B-33.
 *
 * ── La clase de bug que este archivo frena ────────────────────────────────
 * **Una segunda lista de lo mismo, que se separa de la primera sin que nada
 * falle.** El productor (`functions/reportes.js`) decide qué etiquetas lleva un
 * issue; el script las crea en el repo. Si el script llevara su propia lista
 * escrita a mano, el día que el productor agregue una tercera etiqueta el script
 * seguiría creando dos, en verde, y la etiqueta nueva volvería a nacer gris y sin
 * descripción — o sea, el ítem sin cerrar y nadie enterado.
 *
 * Es la misma forma de `desSlug` duplicado entre el panel y el evento (H2) y de
 * la analítica que dejó de reconocer las versiones que el build produce (B-88).
 *
 * ── Cómo se evita, y qué ata este archivo ─────────────────────────────────
 * El script **no tiene lista**: ejecuta `construirIssue` con cada `tipo` que
 * `firestore.rules` permite y junta lo que devuelve en `labels`. Eso no puede
 * quedar viejo, así que no hace falta atarlo.
 *
 * Lo que **sí** está escrito a mano es el color y la descripción de cada
 * etiqueta, porque no se derivan de ninguna parte. Ese es el acuerdo que se
 * rompe solo, y es el que se ata acá: **toda etiqueta que el productor aplique
 * tiene que tener cosmética elegida**. El día que `construirIssue` agregue una,
 * este archivo se pone rojo pidiendo su color — y el rojo es sobre el cambio de
 * quien la agregó, que es la condición de B-180.
 *
 * El script, mientras tanto, **no la saltea**: la crea con el gris de default y
 * avisa. Una etiqueta sin color es mejor que una etiqueta que no existe.
 */
const raiz = new URL('..', import.meta.url);
const script = readFileSync(fileURLToPath(new URL('scripts/etiquetas-github.mjs', raiz)), 'utf8');

describe('las etiquetas se derivan del productor — B-33', () => {
  it('el dominio de `tipo` sale de firestore.rules y no de una lista', () => {
    const tipos = tiposDeReporte() as string[];
    expect(tipos).toEqual(['bug', 'sugerencia']);

    /*
     * Control de la derivación: no alcanza con que el valor sea el esperado,
     * porque un `return ['bug','sugerencia']` cableado daría lo mismo. Lo que se
     * verifica es que **lea las reglas** — se le pasa un texto de reglas
     * distinto y tiene que devolver otra cosa.
     */
    expect(tiposDeReporte("&& d.tipo in ['uno', 'dos', 'tres']")).toEqual(['uno', 'dos', 'tres']);
  });

  it('si la regla cambia de forma, corta en vez de adivinar', () => {
    // El peor resultado posible sería una lista vacía tomada por «no hay nada
    // que crear». Corta con un error que dice qué buscaba.
    expect(() => tiposDeReporte('reglas sin nada parecido')).toThrow(/no se encontró la regla/);
  });

  it('las etiquetas son las que `construirIssue` devuelve de verdad', () => {
    const derivadas = etiquetasDelProductor() as string[];

    // La verificación independiente: se llama al productor acá, con los mismos
    // tipos, y se compara. Si el script cambiara a leer el fuente con un regex
    // —que daría la lista literal y no la efectiva— esto lo notaría.
    const aMano = new Set<string>();
    for (const tipo of tiposDeReporte() as string[]) {
      const { labels } = construirIssue({
        id: 'rep_test',
        reporte: { tipo, titulo: 't', descripcion: '' },
        actividad: null,
      }) as { labels: string[] };
      for (const l of labels) aMano.add(l);
    }

    expect(derivadas).toEqual([...aMano].sort());
    // Control positivo: al menos la fija más una por tipo.
    expect(derivadas.length).toBeGreaterThanOrEqual(3);
  });

  it('el script no lleva la lista escrita: los nombres no están cableados en su lógica', () => {
    /*
     * MUTACIÓN PROBADA: cambiar `etiquetasDelProductor` por un `return
     * ['reporte-panel','bug','sugerencia']` hace pasar los casos de arriba —los
     * valores serían los mismos— y falla este, que es el que mira **cómo** se
     * obtienen.
     *
     * Se permite que los nombres aparezcan en `COSMETICA` (son sus claves, y esa
     * parte es a mano a propósito) y en los comentarios. Lo que no se permite es
     * que estén en un array de la lógica.
     */
    const sinCosmeticaNiComentarios = script
      .replace(/const COSMETICA = \{[\s\S]*?\n\};/, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*/g, '');

    for (const nombre of etiquetasDelProductor() as string[]) {
      expect(
        sinCosmeticaNiComentarios.includes(`'${nombre}'`),
        `el script cablea la etiqueta \`${nombre}\` en su lógica en vez de derivarla`,
      ).toBe(false);
    }
  });
});

describe('la cosmética no se puede quedar corta — B-33', () => {
  it('toda etiqueta que el productor aplica tiene color y descripción elegidos', () => {
    const derivadas = etiquetasDelProductor() as string[];
    const sinCosmetica = derivadas.filter((n) => !(n in (COSMETICA as Record<string, unknown>)));
    expect(
      sinCosmetica,
      'functions/reportes.js aplica estas etiquetas y `COSMETICA` de ' +
        'scripts/etiquetas-github.mjs no les elige color ni descripción. El script ' +
        'las crea igual, con el gris de default, pero una etiqueta nueva merece que ' +
        'alguien decida cómo se ve: agregalas ahí.',
    ).toEqual([]);
  });

  it('los colores son hex de seis dígitos sin `#`, que es lo que `gh` acepta', () => {
    for (const [nombre, c] of Object.entries(COSMETICA as Record<string, { color: string; descripcion: string }>)) {
      expect(c.color, `${nombre}: color`).toMatch(/^[0-9a-f]{6}$/);
      expect(c.descripcion.length, `${nombre}: descripción`).toBeGreaterThan(10);
    }
  });

  it('la cosmética no tiene entradas de más', () => {
    // Una clave que ya nadie aplica es una decisión colgada: la etiqueta se
    // dejó de usar y el script la seguiría actualizando.
    const derivadas = new Set(etiquetasDelProductor() as string[]);
    const sobrantes = Object.keys(COSMETICA as Record<string, unknown>).filter(
      (n) => !derivadas.has(n),
    );
    expect(
      sobrantes,
      '`COSMETICA` tiene etiquetas que el productor ya no aplica: o falta ' +
        'derivarlas, o hay que sacarlas.',
    ).toEqual([]);
  });
});

describe('el script es seguro de correr — B-33', () => {
  it('`--dry-run` no toca nada y dice qué haría', () => {
    const salida = execFileSync('node', ['scripts/etiquetas-github.mjs', '--dry-run'], {
      cwd: fileURLToPath(raiz),
      encoding: 'utf8',
    });
    expect(salida).toContain('--dry-run: no se toca nada');
    for (const nombre of etiquetasDelProductor() as string[]) {
      expect(salida).toContain(nombre);
    }
    // Y no invoca `gh` en seco: es lo que hace que este mismo test pueda correr
    // en una máquina sin `gh` y en el CI.
    expect(salida).not.toContain('Como quedaron en GitHub');
  });

  it('usa `--force`, que es lo que lo hace idempotente', () => {
    // Correrlo dos veces no puede fallar ni duplicar. Sin `--force`, la segunda
    // corrida falla con «label already exists» y el script queda inservible
    // como paso repetible de un runbook.
    expect(script).toContain("'--force'");
  });

  it('no crea, no pide y no lee ninguna credencial (§5.4)', () => {
    /*
     * Usa la sesión de `gh` que ya está en la máquina. Un agente no debe tener
     * un token en la mano, y este script tampoco necesita uno.
     *
     * Lo que se prohíbe es **leer o escribir** una credencial. Nombrar
     * `gh auth login` en el mensaje de error está bien y es lo contrario: es
     * decirle a la persona que la ponga ella, fuera del script.
     */
    for (const prohibido of [
      'process.env.GITHUB_TOKEN',
      'process.env.GH_TOKEN',
      '--with-token',
      'secret set',
      '.env',
    ]) {
      expect(script, `el script usa \`${prohibido}\``).not.toContain(prohibido);
    }
  });
});
