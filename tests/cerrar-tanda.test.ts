/**
 * La mitad que decide de `scripts/cerrar-tanda.mjs` — B-1125 y B-1090.
 *
 * Lo que **no** se testea, a propósito, es que la tanda de hoy esté cerrada:
 * mientras una tanda está abierta sus ids se citan antes de escribirse, y ese
 * aserto estaría rojo por razones ajenas a quien corre la suite (B-180). Eso lo
 * dice el script al cerrar, con exit 1.
 *
 * Los ids inventados se arman con `b()` y `d()` y no se escriben literales: este
 * archivo lo barren `items-referenciados.mjs` y `decisiones-referenciadas.mjs`, y
 * un id que no existe escrito tal cual sería una huérfana nueva para ellos.
 */
import { describe, expect, it } from 'vitest';
import {
  baseDeLaTanda,
  cerrarTanda,
  escritos,
  lineasAgregadas,
  pendientesDe,
  sinEntrada,
  sinRangos,
} from '../scripts/cerrar-tanda.mjs';

const b = (n: number | string) => ['B', String(n)].join('-');
const d = (n: number | string) => ['D', String(n)].join('-');

const registros = {
  backlog: `# Backlog\n\n### ${b(50)} · Un ítem vivo · P2\n\ncuerpo que cita ${b(9001)}\n`,
  cerrados: `# Cerrados\n\n### ${b(40)} · Uno cerrado · ✅ hecho (2026-09-01)\n\n| **${b(41)}** | fila en negrita |\n`,
  decisiones: `# Decisiones\n\n## ${d('09')} · Con cero\n\n## ${d(900)} · Una\n`,
};
const registro = escritos(registros);

describe('baseDeLaTanda', () => {
  it('lee el commit de la línea «Base»', () => {
    expect(baseDeLaTanda('# Tanda\n\nBase: `main` @ `46cc3f5` (= origin/main).\n')).toBe('46cc3f5');
    expect(baseDeLaTanda('Base: `main` @ `e025ca7` (local, **5 commits** por delante')).toBe('e025ca7');
  });

  it('sin línea «Base» no inventa una', () => {
    expect(baseDeLaTanda('# Tanda\n\nSin base.\n')).toBeNull();
    expect(baseDeLaTanda('')).toBeNull();
  });
});

describe('lineasAgregadas', () => {
  it('toma las líneas + con su archivo y descarta las cabeceras', () => {
    const diff = [
      'diff --git a/src/x.ts b/src/x.ts',
      '--- a/src/x.ts',
      '+++ b/src/x.ts',
      '@@ -1,0 +2 @@',
      '+// nueva',
      '-// vieja',
      'diff --git a/src/borrado.ts b/src/borrado.ts',
      '--- a/src/borrado.ts',
      '+++ /dev/null',
      '-todo',
    ].join('\n');
    expect(lineasAgregadas(diff)).toEqual([{ archivo: 'src/x.ts', texto: '// nueva' }]);
  });
});

describe('escritos', () => {
  it('lee encabezados, filas en negrita y decisiones por número', () => {
    expect(registro.items.has(b(50))).toBe(true);
    expect(registro.items.has(b(40))).toBe(true);
    expect(registro.items.has(b(41))).toBe(true);
    // Una mención en el cuerpo no es una entrada.
    expect(registro.items.has(b(9001))).toBe(false);
    expect(registro.decisiones.has(9)).toBe(true);
    expect(registro.decisiones.has(900)).toBe(true);
  });
});

describe('sinRangos', () => {
  it('saca las declaraciones de rango, que son reservas y no ids acuñados', () => {
    expect(sinRangos(`${d(771)} a ${d(774)} para la sesión hermana`)).toBe(' para la sesión hermana');
    expect(sinRangos(`${b(1200)} a ${b(1219)}`)).toBe('');
    // Un id suelto se queda.
    expect(sinRangos(`cierra ${b(50)}`)).toBe(`cierra ${b(50)}`);
  });
});

describe('sinEntrada', () => {
  it('reporta lo citado en un commit o en una línea nueva que no está escrito', () => {
    const huerfanos = sinEntrada(
      [
        { donde: 'commit abc1234', texto: `feat(${b(50)}): … y acuña ${b(9002)} y ${d(9003)}` },
        { donde: 'src/x.ts', archivo: 'src/x.ts', texto: `// ver ${d(900)} y ${d(9004)}` },
      ],
      registro,
    );
    expect(huerfanos.map((h) => h.id)).toEqual([b(9002), d(9003), d(9004)]);
    expect(huerfanos[0].donde).toEqual(['commit abc1234']);
  });

  it('la misma decisión con otra grafía no es huérfana', () => {
    expect(sinEntrada([{ donde: 'commit x', texto: `según ${d(9)}` }], registro)).toEqual([]);
  });

  it('marca las del rango que reservó la tanda', () => {
    const [h] = sinEntrada([{ donde: 'commit x', texto: `acuña ${d(9005)}` }], registro, {
      bugs: [],
      decisiones: [9005],
    });
    expect(h.reservado).toBe(true);
  });

  it('ignora los archivos que los barridos gemelos dejan afuera', () => {
    const fuentes = [
      { donde: 'tests/items-referenciados.test.ts', archivo: 'tests/items-referenciados.test.ts', texto: b(9006) },
      { donde: 'package-lock.json', archivo: 'package-lock.json', texto: d(9007) },
    ];
    expect(sinEntrada(fuentes, registro)).toEqual([]);
  });
});

describe('pendientesDe', () => {
  it('una línea está abierta si su último marcador es ⏸ o ❓', () => {
    const texto = [
      `[11:24] ${b(50)} ✅ hecho · commit abc`,
      `[11:29] ${b(51)} ⏸ quedó sin tocar`,
      '[11:30] ❓ pregunta para el orquestador',
      `[11:40] ${b(52)} ⏸ faltaba … ✅ resuelto después`,
    ].join('\n');
    expect(pendientesDe(texto).map((p) => [p.linea, p.marca])).toEqual([
      [2, '⏸'],
      [3, '❓'],
    ]);
  });

  it('la línea de ejemplo del formato no es un pendiente', () => {
    expect(pendientesDe('[HH:MM] B-xxx ⏸  por qué se dejó abierto\n[HH:MM] ❓ pregunta')).toEqual([]);
  });

  it('un pendiente que dice adónde fue, y ese ítem existe, sale como derivado', () => {
    const [p] = pendientesDe(`[11:29] ⏸ sin tocar. Anotado como ${b(50)} nuevo en el BACKLOG.`, registro.items);
    expect(p.derivada).toBe(b(50));
    const [q] = pendientesDe(`[11:29] ⏸ sin tocar. Anotado como ${b(9008)}.`, registro.items);
    expect(q.derivada).toBeNull();
  });
});

describe('cerrarTanda', () => {
  const base = {
    commits: [{ hash: 'abc1234', mensaje: `fix(${b(50)}): arreglo` }],
    agregadas: [{ archivo: 'src/x.ts', texto: `// ${d(900)}` }],
    registros,
    tanda: '# Tanda\n\n## Rangos\nBugs (diez c/u): uno 9100. Decisiones (cinco c/u): uno 9200.\n',
    estado: [],
  };

  it('todo escrito y nada abierto: se puede cerrar', () => {
    expect(cerrarTanda(base).cerrada).toBe(true);
  });

  it('una decisión acuñada en un commit y no pegada frena el cierre (B-1090)', () => {
    const r = cerrarTanda({ ...base, commits: [{ hash: 'def5678', mensaje: `decide ${d(9201)}` }] });
    expect(r.cerrada).toBe(false);
    expect(r.huerfanos).toEqual([{ id: d(9201), donde: ['commit def5678'], reservado: true }]);
  });

  it('un ⏸ en .estado/ frena el cierre (B-1125), y también uno en el archivo de la tanda', () => {
    const r = cerrarTanda({
      ...base,
      tanda: `${base.tanda}\n| frente | ⏸ parche pendiente |\n`,
      estado: [{ archivo: '.estado/salud.md', texto: '[17:52] ⏸ npm audit fix NO hecho' }],
    });
    expect(r.cerrada).toBe(false);
    expect(r.abiertos.map((a) => a.archivo)).toEqual(['archivo de la tanda', '.estado/salud.md']);
  });

  it('la deuda que ya se citaba en la base no frena: se informa aparte', () => {
    const r = cerrarTanda({
      ...base,
      agregadas: [{ archivo: 'docs/BACKLOG-cerrados.md', texto: `movido: ${b(9009)}` }],
      yaCitados: (id: string) => id === b(9009),
    });
    expect(r.cerrada).toBe(true);
    expect(r.arrastrados.map((a) => a.id)).toEqual([b(9009)]);
  });
});
