/**
 * **El deploy por contenido no repite la suite si el commit ya pasó** — M-14 del
 * PRD 6, decisión D del dueño.
 *
 * La condición de la decisión es que la verificación **falle cerrada**: si no se
 * puede confirmar que el job «Tests y typecheck» de `push-main.yml` pasó para
 * este mismo commit, la suite corre. Acá se prueba eso contra un `gh` de mentira
 * puesto adelante en el PATH, con un caso por cada forma de no poder confirmar,
 * y después se ata el YAML: que `deploy.yml` use la salida como se debe y que el
 * nombre del job sea el de verdad.
 */
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseDocument } from 'yaml';
import { afterAll, describe, expect, it } from 'vitest';

const SCRIPT = 'scripts/suite-verde-del-commit.sh';
const SHA = 'a'.repeat(40);
const OTRO_SHA = 'b'.repeat(40);
const JOB = 'Tests y typecheck';

const tmp = mkdtempSync(join(tmpdir(), 'suite-verde-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

/**
 * Un `gh api` de mentira: sirve `runs.json` para la lista de corridas y
 * `jobs-<id>.json` para los jobs, y falla si el archivo no está. Anota cada URL
 * pedida, para poder afirmar que la consulta filtra por el commit.
 */
const GH_FALSO = `#!/bin/sh
printf '%s\\n' "$2" >> "$FALSO/pedidos.log"
case "$2" in
  *"/actions/workflows/push-main.yml/runs?"*) f="$FALSO/runs.json" ;;
  */actions/runs/*/jobs*) id=$(printf '%s' "$2" | sed 's#.*/runs/\\([0-9]*\\)/jobs.*#\\1#'); f="$FALSO/jobs-$id.json" ;;
  *) exit 1 ;;
esac
[ -f "$f" ] || exit 1
cat "$f"
`;

let n = 0;
type Escenario = {
  runs?: unknown | string;
  jobs?: Record<number, unknown | string>;
  env?: Record<string, string | undefined>;
};

const correr = ({ runs, jobs = {}, env = {} }: Escenario) => {
  const dir = join(tmp, `caso-${n++}`);
  const bin = join(dir, 'bin');
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(bin, 'gh'), GH_FALSO);
  chmodSync(join(bin, 'gh'), 0o755);
  const escribir = (archivo: string, v: unknown) =>
    writeFileSync(join(dir, archivo), typeof v === 'string' ? v : JSON.stringify(v));
  if (runs !== undefined) escribir('runs.json', runs);
  for (const [id, v] of Object.entries(jobs)) escribir(`jobs-${id}.json`, v);
  const r = spawnSync('bash', [SCRIPT], {
    encoding: 'utf8',
    env: {
      PATH: `${bin}:${process.env.PATH}`,
      FALSO: dir,
      GH_REPO: 'dueno/agenda',
      SHA,
      ...env,
    },
  });
  const salida = Object.fromEntries(
    r.stdout
      .trim()
      .split('\n')
      .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
  );
  let pedidos: string[] = [];
  try {
    pedidos = readFileSync(join(dir, 'pedidos.log'), 'utf8').trim().split('\n');
  } catch {
    // Sin pedidos: el script cortó antes de llamar a `gh`.
  }
  return { status: r.status, saltear: salida.saltear, motivo: salida.motivo ?? '', pedidos };
};

const corrida = (id: number, sha = SHA) => ({ id, head_sha: sha });
const jobs = (conclusion: string | null, nombre = JOB) => ({
  jobs: [
    { name: 'Qué deployar', conclusion: 'success' },
    { name: nombre, conclusion },
  ],
});

describe('dice saltear=true solo cuando lo puede confirmar', () => {
  it('la corrida de este commit tiene la suite en verde → se saltea', () => {
    const r = correr({ runs: { workflow_runs: [corrida(7)] }, jobs: { 7: jobs('success') } });
    expect(r).toMatchObject({ status: 0, saltear: 'true' });
    expect(r.motivo).toContain('corrida 7');
    // Y la consulta pide las corridas de ESTE commit, no las últimas del workflow.
    expect(r.pedidos[0]).toContain(`head_sha=${SHA}`);
  });

  it('alcanza con que una de varias corridas del commit la tenga en verde (un re-run)', () => {
    const r = correr({
      runs: { workflow_runs: [corrida(8), corrida(9)] },
      jobs: { 8: jobs('failure'), 9: jobs('success') },
    });
    expect(r.saltear).toBe('true');
  });
});

describe('falla cerrada: en cualquier otro caso la suite corre', () => {
  it.each<[string, Escenario]>([
    ['la suite falló', { runs: { workflow_runs: [corrida(1)] }, jobs: { 1: jobs('failure') } }],
    ['la suite sigue corriendo', { runs: { workflow_runs: [corrida(1)] }, jobs: { 1: jobs(null) } }],
    ['la suite se salteó', { runs: { workflow_runs: [corrida(1)] }, jobs: { 1: jobs('skipped') } }],
    ['la suite se canceló', { runs: { workflow_runs: [corrida(1)] }, jobs: { 1: jobs('cancelled') } }],
    ['el job se renombró', { runs: { workflow_runs: [corrida(1)] }, jobs: { 1: jobs('success', 'Tests') } }],
    ['no hay corridas para el commit', { runs: { workflow_runs: [] } }],
    [
      'la API devolvió la corrida de OTRO commit',
      { runs: { workflow_runs: [corrida(1, OTRO_SHA)] }, jobs: { 1: jobs('success') } },
    ],
    ['la lista de corridas no se pudo pedir', {}],
    ['la lista de corridas no parsea', { runs: '<html>502</html>' }],
    ['la lista de corridas no tiene la forma esperada', { runs: { message: 'Not Found' } }],
    ['los jobs no se pudieron pedir', { runs: { workflow_runs: [corrida(1)] } }],
    ['los jobs no parsean', { runs: { workflow_runs: [corrida(1)] }, jobs: { 1: 'no es json' } }],
    [
      'el id de la corrida no es un número',
      { runs: { workflow_runs: [{ id: '1;rm', head_sha: SHA }] }, jobs: { 1: jobs('success') } },
    ],
    ['falta el repo', { runs: { workflow_runs: [corrida(1)] }, jobs: { 1: jobs('success') }, env: { GH_REPO: '' } }],
    ['falta el SHA', { runs: { workflow_runs: [corrida(1)] }, jobs: { 1: jobs('success') }, env: { SHA: '' } }],
    [
      'el SHA no es un commit completo',
      { runs: { workflow_runs: [corrida(1)] }, jobs: { 1: jobs('success') }, env: { SHA: 'abc123' } },
    ],
  ])('%s → saltear=false', (_caso, escenario) => {
    const r = correr(escenario);
    // Siempre sale con 0: un rojo acá cortaría el deploy por algo que no es de los datos.
    expect(r.status).toBe(0);
    expect(r.saltear).toBe('false');
    expect(r.motivo).not.toBe('');
  });
});

describe('el YAML usa la salida como se debe', () => {
  const leer = (archivo: string) =>
    parseDocument(readFileSync(`.github/workflows/${archivo}`, 'utf8')).toJS() as {
      permissions?: Record<string, string>;
      jobs: Record<
        string,
        {
          name?: string;
          steps?: {
            id?: string;
            name?: string;
            if?: string;
            run?: string;
            'continue-on-error'?: boolean;
            env?: Record<string, string>;
          }[];
        }
      >;
    };

  it('el job que el script busca es el que corre la suite en push-main.yml', () => {
    const script = readFileSync(SCRIPT, 'utf8');
    const job = /^JOB_DE_LA_SUITE='([^']+)'/m.exec(script)?.[1];
    const verificar = leer('push-main.yml').jobs.verificar!;
    expect(job).toBe(verificar.name);
    // Y ese job es el que corre `npm test`: saltear por él es saltear por la suite.
    expect(verificar.steps?.some((s) => /\bnpm test\b/.test(s.run ?? ''))).toBe(true);
    expect(/^WORKFLOW='push-main\.yml'/m.test(script)).toBe(true);
  });

  const deploy = leer('deploy.yml');
  const pasos = deploy.jobs.deploy!.steps ?? [];
  const suite = pasos.find((p) => p.run?.includes(SCRIPT.replace('scripts/', './scripts/')));
  const tests = pasos.find((p) => /\bnpm test\b/.test(p.run ?? ''));

  it('la verificación no puede tumbar el deploy, y su salida va a $GITHUB_OUTPUT', () => {
    expect(suite, 'deploy.yml no corre el script').toBeDefined();
    expect(suite!.id).toBe('suite');
    expect(suite!['continue-on-error']).toBe(true);
    expect(suite!.run).toContain('$GITHUB_OUTPUT');
    expect(suite!.env?.SHA).toBe('${{ github.sha }}');
    expect(deploy.permissions?.actions).toBe('read');
  });

  it('los tests se saltean SOLO con un true explícito, y van después de la verificación', () => {
    /*
     * `!= 'true'` y no `== 'false'`: con la verificación caída la salida queda
     * vacía, y `'' == 'false'` es falso — o sea que la forma al revés saltearía
     * la suite justo cuando no se pudo confirmar nada. Es la falla abierta que
     * la decisión D prohíbe.
     */
    expect(tests!.if).toBe("steps.suite.outputs.saltear != 'true'");
    expect(pasos.indexOf(suite!)).toBeLessThan(pasos.indexOf(tests!));
  });

  it('lo que depende del contenido no se saltea nunca', () => {
    for (const aguja of ['scripts/taxonomias-en-produccion.mjs', './scripts/verificar-bundle.sh']) {
      const paso = pasos.find((p) => p.run?.includes(aguja));
      expect(paso, aguja).toBeDefined();
      expect(paso!.if, `${aguja} no puede depender de la verificación de la suite`).toBeUndefined();
    }
  });
});
