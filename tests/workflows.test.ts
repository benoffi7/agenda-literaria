import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseDocument } from 'yaml';
import { describe, expect, it } from 'vitest';

/**
 * Los workflows de Actions, como archivos YAML — **trampa 11** del `CLAUDE.md`
 * §13, y B-188.
 *
 * **Por qué existe este test** (B-188). `deploy.yml` tenía esta línea:
 *
 * ```yaml
 * run: echo "Motivo: ${{ github.event.client_payload.motivo || '…' }}"
 * ```
 *
 * Un `: ` adentro de un escalar sin comillas hace que YAML lea un mapa anidado,
 * así que **el archivo entero quedaba inválido**. Y la forma en que eso falla es
 * lo que lo hace peligroso: GitHub no puede leer el `on:`, así que el workflow
 * queda registrado **sin ningún trigger** — el `repository_dispatch` que le manda
 * `dispararRebuild` no dispara nada, la Function no se entera (para ella el POST
 * salió 204), y lo único visible es una corrida fallida sin jobs en cada push.
 * Estuvo así desde el primer día y nadie lo vio.
 *
 * No hay forma de que el resto de la suite lo detecte: el YAML roto no rompe
 * ningún import, ningún tipo y ningún test. El único lugar donde se nota es
 * GitHub, o sea después de pushear.
 *
 * Por eso el chequeo es **por clase y no por línea**: no verifica que esa línea
 * esté con `run: |`, verifica que todos los workflows parseen y que cada uno
 * tenga los triggers de los que depende. Una línea nueva con el mismo problema,
 * en cualquier workflow, cae acá.
 *
 * **El que atrapa esta clase es «parsea sin errores», y no «tiene name y al menos
 * un trigger».** Se comprobó reintroduciendo el bug: el parser de `yaml` se
 * recupera del error y devuelve un objeto usable, así que `name` y `on` seguían
 * ahí; GitHub, en cambio, abandona el archivo. O sea que **acá hay que mirar
 * `doc.errors` y no el resultado**, porque un parser tolerante da la respuesta
 * equivocada sobre un archivo que en GitHub no funciona.
 */
const DIR = '.github/workflows';

const archivos = readdirSync(DIR).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));

/** El YAML de un workflow, parseado como lo haría GitHub: estricto y sin claves repetidas. */
const parsear = (archivo: string) =>
  parseDocument(readFileSync(join(DIR, archivo), 'utf8'), { uniqueKeys: true, strict: true });

describe('los workflows son YAML válido', () => {
  it('hay workflows que verificar', () => {
    expect(archivos.length).toBeGreaterThan(0);
  });

  it.each(archivos)('%s parsea sin errores', (archivo) => {
    const doc = parsear(archivo);
    // El mensaje del parser dice línea y columna: se muestra tal cual, que es
    // lo único que hace accionable el fallo.
    expect(doc.errors.map((e) => e.message)).toEqual([]);
  });

  it.each(archivos)('%s tiene name y al menos un trigger', (archivo) => {
    const wf = parsear(archivo).toJS() as { name?: string; on?: Record<string, unknown> };
    // Sin `name`, GitHub muestra el path — que es exactamente el síntoma de que
    // no pudo parsear el archivo.
    expect(wf.name, 'falta `name:`').toBeTruthy();
    // Un workflow sin triggers no corre nunca y no avisa: es el modo de falla de
    // B-188.
    expect(Object.keys(wf.on ?? {}), 'no tiene ningún trigger').not.toHaveLength(0);
  });
});

describe('los triggers de los que depende el §8', () => {
  it('deploy.yml escucha el mismo event_type que manda la Function', () => {
    const wf = parsear('deploy.yml').toJS() as {
      on: { repository_dispatch?: { types?: string[] } };
    };
    // El otro lado de este acuerdo está en `functions/index.js`:
    // `event_type: 'rebuild'`. Si alguno de los dos cambia y el otro no, el lazo
    // del §8 se corta sin ningún error.
    const enviado = readFileSync('functions/index.js', 'utf8').match(
      /event_type:\s*'([^']+)'/,
    )?.[1];
    expect(enviado, 'no se encontró el event_type en functions/index.js').toBeTruthy();
    expect(wf.on.repository_dispatch?.types).toContain(enviado);
  });

  it('push-main.yml se dispara con un push a main', () => {
    const wf = parsear('push-main.yml').toJS() as {
      on: { push?: { branches?: string[] } };
    };
    expect(wf.on.push?.branches).toContain('main');
  });
});

/** Todos los `steps[].run` de todos los jobs de un workflow, con su nombre. */
const pasosConScript = (archivo: string): { nombre: string; run: string }[] => {
  const wf = parsear(archivo).toJS() as {
    jobs?: Record<string, { steps?: { name?: string; run?: string; uses?: string }[] }>;
  };
  return Object.entries(wf.jobs ?? {}).flatMap(([job, def]) =>
    (def.steps ?? [])
      .filter((s) => typeof s.run === 'string')
      .map((s) => ({ nombre: `${archivo} · ${job} · ${s.name ?? s.uses ?? 'sin nombre'}`, run: s.run! })),
  );
};

describe('los scripts de los workflows no interpolan datos ajenos — §5.4', () => {
  /**
   * **Por qué es un chequeo de seguridad y no de estilo** (B-195). `${{ … }}`
   * dentro de un `run:` se pega en el texto del script **antes** de que exista la
   * shell, así que un valor con comillas o `$(…)` ejecuta lo que quiera. Cuando el
   * valor sale de Firestore —el `motivo` del rebuild— es texto que no controlamos,
   * y el job que lo imprime es el mismo que más abajo recibe
   * `FIREBASE_SERVICE_ACCOUNT`: la única key del proyecto.
   *
   * Por `env:` el valor llega como variable de entorno y la shell no lo
   * reinterpreta. La regla es esa, y vale para cualquier contexto que traiga datos
   * de afuera: `github.event.*`, `inputs.*` y `client_payload`.
   */
  const CONTEXTOS_AJENOS = /\$\{\{[^}]*\b(github\.event|inputs|client_payload)\b/;

  it.each(archivos)('%s no interpola contexto de evento en el cuerpo de un run', (archivo) => {
    const culpables = pasosConScript(archivo)
      .filter((p) => CONTEXTOS_AJENOS.test(p.run))
      .map((p) => p.nombre);
    expect(culpables, 'pasalo por `env:` en vez de interpolarlo en el script').toEqual([]);
  });
});

describe('el gate de la trampa 4 no está copiado en YAML — §5.4', () => {
  /**
   * `scripts/verificar-bundle.sh` existe porque **dos** workflows lo necesitan, y
   * su cabecera dice por qué no se duplica: "duplicar en YAML era garantizar que
   * una de las dos copias se quedara vieja". Pasó exactamente eso — la copia de
   * `deploy.yml` se quedó sin la guarda final, la que exige que `dist/` tenga al
   * menos un `.js`, así que un build vacío pasaba el gate habiendo verificado
   * nada (B-195, y es el build que B-189 describe).
   *
   * El chequeo es por clase: cualquier workflow que buildee tiene que llamar al
   * script, no reimplementar el `grep`.
   */
  const PATRON_COPIADO = /grep[^\n]*(firebase-admin|private_key|BEGIN PRIVATE KEY)/;

  it.each(archivos)('%s no reimplementa el grep del bundle', (archivo) => {
    const culpables = pasosConScript(archivo)
      .filter((p) => PATRON_COPIADO.test(p.run))
      .map((p) => p.nombre);
    expect(culpables, 'llamá a ./scripts/verificar-bundle.sh').toEqual([]);
  });

  it.each(archivos)('%s corre el script si buildea', (archivo) => {
    const pasos = pasosConScript(archivo);
    const buildea = pasos.some((p) => /npm run build|astro build/.test(p.run));
    if (!buildea) return;
    const verifica = pasos.some((p) => /verificar-bundle\.sh/.test(p.run));
    expect(verifica, 'buildea pero no verifica que la credencial no se filtró').toBe(true);
  });
});
