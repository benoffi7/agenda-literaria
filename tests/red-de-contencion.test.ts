import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { AUDITORES } from '../scripts/auditores-que-corresponden.mjs';

/**
 * La tabla «Qué se decidió no automatizar» de `docs/13-agentes.md` no se
 * rompe por merges — B-367 (duplicado de B-294, la misma cicatriz).
 *
 * **El daño que ya pasó dos veces, con el mismo mecanismo.** Varios frentes
 * tocan esta tabla en paralelo, y un merge sin criterio puede pegar dos filas
 * en una línea física con un `||` en el medio, o dejar una fila repetida con
 * dos versiones que se contradicen. El 2026-09-02 pasó de verdad: catorce
 * filas terminaron siendo once (B-294), con `color-de-tipo.test.ts` triplicado
 * y una fila fusionada con `sin-marcadores-de-conflicto.test.ts` detrás de un
 * `||`. Una fila fusionada **no renderiza como fila** — la mitad de su
 * contenido deja de leerse — y una fila triplicada dice, dos de cada tres
 * veces, una cobertura vieja. Esta tabla es justo lo que `auditor-trampas` y
 * `auditor-privacidad` consultan para no reportar lo que un test ya frena, así
 * que una copia desactualizada les hace reportar de más o de menos.
 *
 * El chequeo es el que B-367 proponía y B-294 no llegó a dejar escrito:
 * ninguna línea de la tabla tiene `||`, ninguna deja de empezar con `|`, y
 * ninguna celda de la primera columna se repite.
 */
const doc = readFileSync(
  fileURLToPath(new URL('../docs/13-agentes.md', import.meta.url)),
  'utf8',
);

/** Las líneas de la tabla, sin el título, sin la fila de encabezado ni la de separadores. */
const filasDeLaTabla = (): string[] => {
  const inicio = doc.indexOf('### Porque ya hay un test, y duplicarlo daría falsa cobertura');
  const fin = doc.indexOf('### Porque un agente no es la herramienta');
  if (inicio === -1 || fin === -1 || fin <= inicio) {
    throw new Error('no se encontraron los encabezados que delimitan la sección de la tabla');
  }
  return doc
    .slice(inicio, fin)
    .split('\n')
    .filter((l) => l.trim().length > 0)
    // El título de la sección y el encabezado/separador de la tabla no son filas de datos.
    .filter((l) => !l.startsWith('###'))
    .slice(2); // encabezado (`| Lo que...`) y separador (`|---|---|`)
};

describe('la tabla «no automatizar» no se rompe por merges — B-367/B-294', () => {
  it('tiene filas de verdad para chequear (si esto da 0, cambió el formato del documento)', () => {
    expect(filasDeLaTabla().length).toBeGreaterThan(30);
  });

  it('ninguna línea tiene `||` — dos filas fusionadas en una', () => {
    const fusionadas = filasDeLaTabla().filter((l) => l.includes('||'));
    expect(fusionadas, `líneas fusionadas:\n${fusionadas.join('\n')}`).toEqual([]);
  });

  it('toda línea de la tabla empieza con `|` — si no, dejó de ser una fila', () => {
    const rotas = filasDeLaTabla().filter((l) => !l.startsWith('|'));
    expect(rotas, `líneas que no empiezan con "|":\n${rotas.join('\n')}`).toEqual([]);
  });

  it('ninguna celda de la primera columna se repite', () => {
    const primeraColumna = filasDeLaTabla().map((l) => l.split('|')[1]?.trim() ?? '');
    const vistas = new Set<string>();
    const repetidas = primeraColumna.filter((c) => (vistas.has(c) ? true : (vistas.add(c), false)));
    expect(repetidas, `celdas repetidas:\n${repetidas.join('\n')}`).toEqual([]);
  });
});

/**
 * A los auditores se puede llegar — D-560.
 *
 * **Este bloque cambió de bug a cubrir el 2026-09-08.** Antes verificaba que el
 * disparo **automático** estuviera cableado: tres hooks en
 * `.claude/settings.json` (uno avisaba al terminar el turno, uno frenaba el
 * `git commit`, uno sellaba lo auditado) más un séptimo paso del gate de push que
 * exigía los tres sellos. La clase de bug era «un hook que no hace nada y nadie
 * se entera», y tenía tres modos: JSON inválido —Claude Code descarta el archivo
 * entero—, un comando apuntando a un script renombrado, y un modo inexistente que
 * hacía salir con 0 sin verificar nada.
 *
 * **Todo eso se eliminó.** Los auditores corren a pedido, por el skill `/audit`,
 * y no queda ni un hook ni un gate que los espere. Así que la clase de bug que
 * hay que cubrir ahora es la otra cara, y es más simple: **un auditor al que
 * ningún camino llega.** Con el disparo automático, un auditor huérfano se
 * notaba porque el hook fallaba; sin él, un auditor que `/audit` no nombra
 * simplemente no corre nunca, y su ficha sigue en el repo pareciendo cobertura.
 *
 * Se atan las dos puntas, como antes:
 *
 * 1. los auditores que el registro conoce (`AUDITORES`, que es lo que decide el
 *    alcance) tienen que existir como ficha en `.claude/agents/`;
 * 2. el skill `/audit` tiene que nombrarlos a todos — si agrega uno un día, este
 *    caso pide que el registro lo conozca, y al revés.
 *
 * Lo que **no** se verifica acá es que alguien invoque `/audit`, porque no se
 * puede: es una decisión humana por diseño, y es la contra asumida de D-560.
 */
describe('a los auditores se puede llegar — D-560', () => {
  const raiz = new URL('..', import.meta.url);
  const skill = readFileSync(
    fileURLToPath(new URL('.claude/skills/audit/SKILL.md', raiz)),
    'utf8',
  );

  it('no quedó ningún hook disparando auditores', () => {
    /*
     * El caso que fija la decisión. Un hook que vuelva sin decidirlo de nuevo
     * reintroduce lo que D-560 sacó, y lo haría en silencio: los hooks corren
     * fuera de la vista y su salida no se lee.
     */
    const settings = readFileSync(fileURLToPath(new URL('.claude/settings.json', raiz)), 'utf8');
    // Sigue teniendo que ser JSON válido: uno roto se descarta entero, y el día
    // que este archivo tenga otra cosa adentro nadie se enteraría.
    expect(() => JSON.parse(settings)).not.toThrow();
    const config = JSON.parse(settings) as { hooks?: Record<string, unknown> };
    expect(Object.keys(config.hooks ?? {}), 'volvió un hook de auditoría').toEqual([]);
  });

  it('y el gate mecánico tampoco los exige', () => {
    // La otra mitad de lo que se sacó. El gate verifica seis cosas mecánicas y
    // ninguna es «alguien auditó»: si esto vuelve, vuelve el modo de falla de
    // B-180, porque el gate no puede invocar un modelo para satisfacerse.
    const gate = readFileSync(fileURLToPath(new URL('scripts/verificar-todo.sh', raiz)), 'utf8');
    expect(gate).not.toContain('hook-auditores');
    expect(gate).not.toContain('SALTEAR_AUDITORES');
  });

  it('cada auditor del registro tiene su ficha en disco', () => {
    // Control positivo primero: si el registro quedara vacío, el `filter` de
    // abajo pasaría contra una lista vacía y este caso no verificaría nada.
    expect(Object.keys(AUDITORES).length).toBe(3);

    const sinFicha = Object.entries(AUDITORES).filter(
      ([, ficha]) => !existsSync(fileURLToPath(new URL(ficha, raiz))),
    );
    expect(sinFicha.map(([nombre]) => nombre), 'auditores sin ficha').toEqual([]);
  });

  it('y el skill `/audit` nombra a los tres', () => {
    /*
     * El caso que vale. `/audit` es el único camino: un auditor que el skill no
     * nombra no lo va a lanzar nadie, y su ficha se queda en el repo dando la
     * impresión de que ese frente está cubierto.
     *
     * Se busca el nombre del agente (`auditor-privacidad`) y no la clave del
     * registro (`privacidad`), porque es el nombre del agente lo que hay que
     * pasarle a la tool `Agent` para que corra.
     */
    const noNombrados = Object.values(AUDITORES)
      .map((ficha) => ficha.replace('.claude/agents/', '').replace('.md', ''))
      .filter((agente) => !skill.includes(agente));
    expect(noNombrados, 'auditores que `/audit` no nombra').toEqual([]);
  });

  it('el skill no quedó apuntando al mecanismo que se borró', () => {
    // Si `/audit` explica cómo satisfacer un sello que no existe, manda a
    // alguien a buscar un archivo borrado. Es el drift de siempre, en un skill.
    expect(skill).not.toContain('hook-auditores');
    expect(skill).not.toContain('SALTEAR_AUDITORES');
  });

});

/**
 * `docs/13-agentes.md` no nombra tests que ya no existen.
 *
 * Vivía adentro del describe de los hooks por vecindad y no por tema; al
 * reemplazar aquél (D-560) se separó, que es lo que había que hacer desde el
 * principio. Lo que cubre es la fila que **afirma que algo está verificado** y
 * apunta a un archivo borrado o renombrado: se lee como cobertura y no la hay.
 *
 * Lo cobró al toque el borrado de D-560: la tabla seguía nombrando
 * `comando-de-commit.test.ts` y `huella-de-auditoria.test.ts`, los dos tests que
 * se fueron con el sello.
 */
describe('la tabla de `13-agentes.md` apunta a tests que existen — B-260', () => {
  const nombrados = (): string[] => {
    const crudos = [...doc.matchAll(/`(?:tests\/)?([A-Za-z0-9._-]+\.test\.tsx?)`/g)].map(
      (m) => m[1]!,
    );
    return [...new Set(crudos)].filter((n) => n !== 'x.test.ts');
  };

  it('nombra tests de verdad (control positivo: si da poco, el regex dejó de encontrarlos)', () => {
    expect(nombrados().length).toBeGreaterThan(30);
  });


  it('todos los tests que nombra existen', () => {
    const inexistentes = nombrados().filter(
      (n) => !existsSync(fileURLToPath(new URL(`../tests/${n}`, import.meta.url))),
    );
    expect(
      inexistentes,
      'docs/13-agentes.md nombra tests que no existen: la fila afirma que algo ya ' +
        'está verificado y apunta a un archivo borrado o renombrado.',
    ).toEqual([]);
  });


  it('ninguna línea de prosa quedó pegada a otra por un merge', () => {
    const LIMITE = 100;
    let enCodigo = false;
    const largas: string[] = [];
    for (const [i, linea] of doc.split('\n').entries()) {
      if (linea.trim().startsWith('```')) {
        enCodigo = !enCodigo;
        continue;
      }
      /*
       * Fuera: bloques de código, filas de tabla y bloques indentados — los tres
       * pasan de 100 legítimamente.
       *
       * La fila de tabla se reconoce **después de recortar los espacios**: una
       * tabla anidada dentro de una viñeta va indentada dos espacios y sigue
       * siendo una tabla. Sin el `trim` este chequeo reportaba las tres filas de
       * la tabla de B-122, que es reportar de más — o sea, el camino más corto a
       * que alguien afloje el umbral en vez de mirar el hallazgo.
       */
      if (enCodigo || linea.trim().startsWith('|') || linea.startsWith('    ')) continue;
      if (linea.length > LIMITE) largas.push(`${i + 1}: (${linea.length}) ${linea.slice(0, 90)}…`);
    }
    expect(
      largas,
      `líneas de prosa de más de ${LIMITE} caracteres en un documento envuelto a 80 — ` +
        'lo más probable es que un merge haya pegado dos oraciones en la misma línea:\n' +
        largas.join('\n'),
    ).toEqual([]);
  });
});
