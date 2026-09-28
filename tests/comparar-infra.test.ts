import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * El comparador del inventario de infra — B-123.
 *
 * `docs/02-infraestructura.md` dice que fue relevado "con `gcloud` y `firebase`, no
 * de memoria", y nadie lo repetía. El 2026-08-25 eso costó caro: la doc afirmaba que
 * faltaba trabajo terminado hacía días —tres Functions "sin desplegar" que estaban
 * ACTIVE, un secreto "falta crearlo" que existía— y **B-20 parecía mucho más grande
 * de lo que era**.
 *
 * `relevar-infra.sh` consulta el proyecto y `comparar-infra.sh` compara. Están
 * partidos a propósito, por el mismo motivo que `que-deployar.sh` no vive dentro del
 * YAML: consultar gcloud necesita credenciales que un agente no debe tener (§5.4),
 * comparar dos listas de texto no. Así que **la mitad que decide se puede probar**, y
 * es la que se prueba acá: se le pasan inventarios inventados y se verifica qué
 * divergencias encuentra.
 */
const comparar = (real: string, doc: string): { salida: string; codigo: number } => {
  const dir = mkdtempSync(join(tmpdir(), 'infra-'));
  const ruta = join(dir, 'doc.md');
  writeFileSync(ruta, doc);
  try {
    const salida = execFileSync('./scripts/comparar-infra.sh', [ruta], {
      input: real,
      encoding: 'utf8',
    });
    return { salida, codigo: 0 };
  } catch (e) {
    const err = e as { stdout?: string; status?: number };
    return { salida: err.stdout ?? '', codigo: err.status ?? -1 };
  }
};

/** Un documento con la forma de las tablas reales, y solo las filas que importan. */
const doc = ({
  funciones = [['syncCalendar', 'ACTIVE']] as [string, string][],
  rolesDeployCi = ['roles/datastore.viewer'],
  secretosGcp = ['GITHUB_TOKEN'],
  secretosGh = ['FIREBASE_SERVICE_ACCOUNT'],
} = {}) =>
  [
    '| Función | Trigger | Estado |',
    '|---|---|---|',
    // La primera fila ancla el rango que lee el script, igual que en el doc real.
    ...funciones.map(([n, e]) => `| \`${n}\` | \`onDocumentWritten x/{id}\` | ${e} |`),
    '',
    '### Secretos (Secret Manager)',
    '',
    ...secretosGcp.map((s) => `| \`${s}\` | algo | **existe** desde el 2026-08-21 |`),
    '',
    '### Secrets de GitHub Actions',
    '',
    ...secretosGh.map((s) => `| \`${s}\` | algo | **existe** desde el 2026-08-25 |`),
    '',
    '### Roles de `deploy-ci@`',
    '',
    '```',
    ...rolesDeployCi,
    '```',
    '',
  ].join('\n');

/** El estado real, en el formato que emite `relevar-infra.sh`. */
const real = (lineas: string[]) => lineas.join('\n') + '\n';

const REAL_COMPLETO = real([
  'funcion=syncCalendar ACTIVE',
  'rol=deploy-ci roles/datastore.viewer',
  'secreto=GITHUB_TOKEN',
  'secreto_gh=FIREBASE_SERVICE_ACCOUNT',
]);

describe('cuando el documento dice la verdad', () => {
  it('no reporta nada y sale con 0', () => {
    const r = comparar(REAL_COMPLETO, doc());
    expect(r.salida).toContain('dice la verdad');
    expect(r.codigo).toBe(0);
  });
});

describe('el drift que pasó de verdad — la doc dice que falta lo que ya está', () => {
  it('una Function ACTIVE que la tabla muestra como no desplegada', () => {
    const r = comparar(
      real(['funcion=syncCalendar ACTIVE', 'funcion=dispararRebuild ACTIVE']),
      doc({
        funciones: [
          ['syncCalendar', 'ACTIVE'],
          ['dispararRebuild', '**escrita, sin desplegar**'],
        ],
      }),
    );
    expect(r.salida).toContain('`dispararRebuild` está ACTIVE y la doc la muestra como no desplegada');
    expect(r.codigo).toBe(1);
  });

  it('un rol que la cuenta tiene y la doc no declara — y manda a mirar 07-seguridad', () => {
    const r = comparar(
      real(['funcion=syncCalendar ACTIVE', 'rol=deploy-ci roles/datastore.viewer', 'rol=deploy-ci roles/firebaserules.admin']),
      doc(),
    );
    expect(r.salida).toContain('roles/firebaserules.admin');
    // El drift entre los dos documentos es cómo una afirmación de seguridad quedó
    // mintiendo una hora (D-119): el aviso tiene que nombrar el otro archivo.
    expect(r.salida).toContain('07-seguridad.md');
    expect(r.codigo).toBe(1);
  });
});

describe('el drift al revés — la doc promete algo que no está', () => {
  it('una Function que la doc dice ACTIVE y no está desplegada', () => {
    const r = comparar(real(['rol=deploy-ci roles/datastore.viewer']), doc());
    expect(r.salida).toContain('la doc dice que `syncCalendar` está ACTIVE');
    expect(r.codigo).toBe(1);
  });

  it('un rol declarado que la cuenta no tiene', () => {
    const r = comparar(real(['funcion=syncCalendar ACTIVE']), doc());
    expect(r.salida).toContain('la doc declara `roles/datastore.viewer` y la cuenta no lo tiene');
    expect(r.codigo).toBe(1);
  });

  it('el secret de GitHub que faltaba y hacía fallar cada deploy', () => {
    const r = comparar(
      real(['funcion=syncCalendar ACTIVE', 'rol=deploy-ci roles/datastore.viewer', 'secreto=GITHUB_TOKEN']),
      doc(),
    );
    expect(r.salida).toContain('el secret `FIREBASE_SERVICE_ACCOUNT` de GitHub existe y no está cargado');
    expect(r.codigo).toBe(1);
  });

  it('no confunde el secreto de Secret Manager con el de GitHub', () => {
    // `FIREBASE_SERVICE_ACCOUNT` vive en GitHub y `GITHUB_TOKEN` en Secret Manager.
    // Leer las dos tablas como una sola reportaba una divergencia inventada.
    const r = comparar(REAL_COMPLETO, doc());
    expect(r.salida).not.toContain('FIREBASE_SERVICE_ACCOUNT` existe y no está en Secret Manager');
    expect(r.codigo).toBe(0);
  });
});

describe('«no pude ver» no es «no existe»', () => {
  it('con el centinela, deja los secrets de GitHub sin verificar y no inventa una divergencia', () => {
    const r = comparar(
      real([
        'funcion=syncCalendar ACTIVE',
        'rol=deploy-ci roles/datastore.viewer',
        'secreto=GITHUB_TOKEN',
        'secreto_gh=?no-se-pudo-leer',
      ]),
      doc(),
    );
    expect(r.salida).toContain('sin verificar');
    expect(r.salida).not.toContain('✗');
    expect(r.codigo).toBe(0);
  });
});

describe('un documento ilegible no pasa por verde', () => {
  it('sale con 2 si el documento no existe', () => {
    let codigo = 0;
    try {
      execFileSync('./scripts/comparar-infra.sh', ['no/existe.md'], { input: '', encoding: 'utf8' });
    } catch (e) {
      codigo = (e as { status?: number }).status ?? -1;
    }
    expect(codigo).toBe(2);
  });
});

describe('el respaldo de la base — roadmap 5.1', () => {
  /** La tabla de Firestore con las dos filas que lee el comparador. */
  const conRespaldo = (respaldo = 'diario 7d', proteccion = 'activada') =>
    doc() +
    [
      '| | |',
      '|---|---|',
      '| Base | `(default)` |',
      `| Respaldo | \`${respaldo}\` — se guarda una semana |`,
      `| Protección contra borrado | \`${proteccion}\` |`,
      '',
    ].join('\n');

  it('no reporta nada cuando el programa y la protección coinciden', () => {
    const r = comparar(REAL_COMPLETO + real(['respaldo=diario 7d', 'proteccion=activada']), conRespaldo());
    expect(r.salida).not.toContain('✗');
    expect(r.codigo).toBe(0);
  });

  it('avisa cuando alguien borró el programa desde la consola', () => {
    // Es el caso para el que entra al comparador: nada más se rompe cuando pasa.
    const r = comparar(REAL_COMPLETO + real(['proteccion=activada']), conRespaldo());
    expect(r.salida).toContain('hay un respaldo `diario 7d` y la base no lo tiene programado');
    expect(r.codigo).toBe(1);
  });

  it('avisa cuando cambió la retención y la doc no', () => {
    const r = comparar(REAL_COMPLETO + real(['respaldo=diario 30d', 'proteccion=activada']), conRespaldo());
    expect(r.salida).toContain('la base tiene un respaldo `diario 30d` que la doc no declara');
    expect(r.codigo).toBe(1);
  });

  it('avisa cuando se desactivó la protección contra borrado', () => {
    const r = comparar(REAL_COMPLETO + real(['respaldo=diario 7d', 'proteccion=desactivada']), conRespaldo());
    expect(r.salida).toContain('está `desactivada` y la doc dice `activada`');
    expect(r.codigo).toBe(1);
  });

  it('«no pude leer» deja el respaldo sin verificar y no inventa una divergencia', () => {
    const r = comparar(
      REAL_COMPLETO + real(['respaldo=?no-se-pudo-leer', 'proteccion=?no-se-pudo-leer']),
      conRespaldo(),
    );
    expect(r.salida).toContain('sin verificar: no se pudieron leer los programas de respaldo');
    expect(r.salida).not.toContain('✗');
    expect(r.codigo).toBe(0);
  });
});
