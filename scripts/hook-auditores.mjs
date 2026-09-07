#!/usr/bin/env node
/**
 * La plomería del disparo automático del `auditor-privacidad` — B-124, D-350.
 *
 * Se invoca desde los hooks de `.claude/settings.json` y **no decide nada**:
 * la decisión de "¿este diff toca una salida pública?" vive en
 * `scripts/auditores-que-corresponden.mjs`, que se testea sin git y sin estado.
 * Este archivo es la mitad que no se puede testear: git, el sello en disco y
 * el código de salida del hook. Es el mismo corte de
 * `relevar-infra.sh` / `comparar-infra.sh` (B-123), por el mismo motivo.
 *
 * ── Modos ─────────────────────────────────────────────────────────
 *   node scripts/hook-auditores.mjs parada    # hook Stop: avisa una vez
 *   node scripts/hook-auditores.mjs commit    # hook PreToolUse(Bash): frena el commit
 *   node scripts/hook-auditores.mjs marcar    # hook PostToolUse(Task): sella lo auditado
 *
 * Los tres leen el JSON del hook por stdin.
 *
 * ── El sello ──────────────────────────────────────────────────────
 * `<git-dir>/auditores.json`, o sea afuera del árbol de trabajo: no necesita
 * entrada en `.gitignore` y es **por worktree**, que es lo correcto — seis
 * frentes en paralelo no comparten qué se auditó.
 *
 * Guarda dos huellas por auditor:
 *
 *   { "privacidad": { "auditado": "<sha>", "avisado": "<sha>" } }
 *
 * La huella es el **código** de los archivos de salida pública que el cambio
 * toca, sin sus comentarios: si el código cambia, la huella cambia y el aviso
 * vuelve. Vive en `huella-de-auditoria.mjs` —la mitad pura, con tests— y ahí
 * está escrito por qué los comentarios no cuentan (B-794).
 *
 * ── El modo de falla que este archivo NO puede tener (B-180) ──────
 * «Un gate que falla por su propia plomería enseña a saltearlo.» Así que:
 *
 * 1. **Cualquier excepción sale con 0.** Un `git` que no está, un repo sin
 *    HEAD, un JSON ilegible: el hook no dice nada y no frena nada. Prefiere
 *    dejar pasar un cambio sin auditar antes que ponerse rojo por sí mismo.
 * 2. **El alcance es lo NO commiteado**, nunca `main...HEAD`. Con el diff de
 *    la rama entera, una rama larga hace que el hook grite por el cambio de
 *    otra persona, que es literalmente «rojo por razones que no son el cambio
 *    de quien lo disparó».
 * 3. **El aviso del Stop es una sola vez por contenido.** Un hook que repite
 *    el mismo aviso en cada turno se aprende a ignorar en tres turnos.
 * 4. **Siempre dice por qué**: qué archivo lo disparó, qué correr, y cómo
 *    saltearlo a propósito (`SALTEAR_AUDITORES=1` adelante del `git commit`,
 *    igual que `SALTEAR_PRE_PUSH=1 git push`).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { auditoresQueCorresponden, leerFichas } from './auditores-que-corresponden.mjs';
import { huellaDeAuditoria } from './huella-de-auditoria.mjs';

/** El único auditor que corre solo. La decisión de B-124 en una constante. */
const AUTOMATICO = 'privacidad';
const AGENTE = 'auditor-privacidad';

const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

/**
 * Las rutas con cambios **sin commitear** (modificadas, staged, nuevas).
 *
 * `git status --porcelain` las trae todas juntas, incluidas las que `git diff`
 * no ve (las no rastreadas). En un rename (`R old -> new`) interesa el
 * destino.
 */
const rutasSinCommitear = () =>
  git('status', '--porcelain')
    .split('\n')
    .filter(Boolean)
    .map((linea) => {
      const resto = linea.slice(3);
      const flecha = resto.indexOf(' -> ');
      return (flecha === -1 ? resto : resto.slice(flecha + 4)).replace(/^"|"$/g, '');
    });

const rutaDelSello = () => join(git('rev-parse', '--absolute-git-dir').trim(), 'auditores.json');

const leerSello = () => {
  try {
    return JSON.parse(readFileSync(rutaDelSello(), 'utf8'));
  } catch {
    return {};
  }
};

const escribirSello = (sello) => {
  try {
    writeFileSync(rutaDelSello(), `${JSON.stringify(sello, null, 2)}\n`);
  } catch {
    // Un sello que no se puede escribir hace que el aviso se repita. Molesto,
    // no roto: nunca es motivo para frenar nada.
  }
};

const entrada = () => {
  try {
    return JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    return {};
  }
};

/**
 * El estado actual: qué disparó al auditor automático y con qué huella.
 * `null` si no corresponde.
 */
const estado = () => {
  const raiz = git('rev-parse', '--show-toplevel').trim();
  const decision = auditoresQueCorresponden(rutasSinCommitear(), leerFichas(new URL(`file://${raiz}/`)));
  const { disparadores } = decision[AUTOMATICO];
  if (disparadores.length === 0) return null;
  return { disparadores, fp: huellaDeAuditoria(raiz, disparadores) };
};

/**
 * El aviso, y la línea del final que no es adorno — B-796.
 *
 * Este hook rechaza **la invocación de Bash entera**, no el `git commit` solo. Un
 * comando encadenado —editar la doc, `git add`, `git commit`— se rechaza completo:
 * la edición **no corre**, y el único rastro es este mensaje, que habla del
 * commit.
 *
 * Pasó dos veces el 2026-09-07, con el cierre documental de un ítem, y la segunda
 * fue peor: el reintento era un `replace` sobre un texto que ya no existía y **no
 * falló** (no tenía `assert`), así que el arreglo también se perdió en silencio.
 * Se descubrió por un `git status` que no mostraba lo que tenía que mostrar.
 *
 * El chequeo es correcto y no se afloja: el commit no tenía que pasar. Lo que se
 * puede mejorar es lo que el mensaje **dice**, y son dos líneas.
 */
const aviso = (disparadores, comoSaltear) =>
  [
    `⚠ El cambio toca ${disparadores.length} salida(s) pública(s) y todavía no pasó por el \`${AGENTE}\`:`,
    ...disparadores.map((d) => `    ${d}`),
    '',
    `  Corré el agente \`${AGENTE}\` sobre el diff antes de cerrar el cambio.`,
    '  Publicar es irreversible: un falso negativo acá es una credencial filtrada',
    '  o un link de reunión público (B-124, D-350).',
    '',
    `  Para saltearlo a propósito: ${comoSaltear}`,
    '',
    '  OJO: esto rechazó el comando ENTERO, no solo el commit. Si venía encadenado',
    '  con algo adelante (una edición, un script), eso tampoco corrió — verificalo',
    '  antes de reintentar, y mandá la edición en un comando aparte (B-796).',
  ].join('\n');

const modos = {
  /**
   * Hook `Stop`. Avisa **una vez por contenido** y devuelve 2 para que el
   * aviso llegue al modelo. Nunca dos veces por lo mismo.
   */
  parada() {
    const datos = entrada();
    // La guarda del propio Claude Code contra el bucle: si ya frenamos esta
    // parada, no volvemos a frenarla.
    if (datos.stop_hook_active === true) return 0;

    const hoy = estado();
    if (!hoy) return 0;

    const sello = leerSello();
    const mio = sello[AUTOMATICO] ?? {};
    if (mio.auditado === hoy.fp || mio.avisado === hoy.fp) return 0;

    sello[AUTOMATICO] = { ...mio, avisado: hoy.fp };
    escribirSello(sello);
    process.stderr.write(`${aviso(hoy.disparadores, 'ignorá este aviso — no frena nada.')}\n`);
    return 2;
  },

  /**
   * Hook `PreToolUse` sobre `Bash`. Frena el `git commit` si el cambio toca
   * una salida pública sin auditar. Es el punto donde el aviso tiene que
   * valer: después del commit el árbol queda limpio y el hook de parada deja
   * de ver el cambio.
   */
  commit() {
    const comando = entrada().tool_input?.command ?? '';
    // Pre-filtro barato: nada de git antes de saber que es un commit.
    if (!/\bgit\b[^\n]*\bcommit\b/.test(comando)) return 0;
    if (/SALTEAR_AUDITORES=1/.test(comando)) {
      process.stderr.write('⚠ Auditor de privacidad salteado por SALTEAR_AUDITORES=1.\n');
      return 0;
    }

    const hoy = estado();
    if (!hoy) return 0;
    if ((leerSello()[AUTOMATICO] ?? {}).auditado === hoy.fp) return 0;

    process.stderr.write(`${aviso(hoy.disparadores, 'SALTEAR_AUDITORES=1 git commit …')}\n`);
    return 2;
  },

  /**
   * Hook `PostToolUse` sobre el tool de sub-agentes. Sella la huella actual
   * cuando el que corrió fue el `auditor-privacidad`.
   *
   * Se lee `tool_input.subagent_type` y no un grep sobre el JSON entero: el
   * prompt de otro sub-agente puede nombrar al auditor, y un sello escrito por
   * una mención es un sello que miente.
   */
  marcar() {
    const datos = entrada();
    if (datos.tool_input?.subagent_type !== AGENTE) return 0;

    const hoy = estado();
    if (!hoy) return 0;

    const sello = leerSello();
    sello[AUTOMATICO] = { auditado: hoy.fp, avisado: hoy.fp };
    escribirSello(sello);
    return 0;
  },
};

const modo = process.argv[2];
try {
  process.exit(modos[modo] ? modos[modo]() : 0);
} catch (e) {
  // Regla 1 de arriba. El motivo va a stderr con salida 0: se ve en el
  // transcript de quien lo debuguee y no frena a nadie.
  process.stderr.write(`hook-auditores (${modo}): no pudo verificar — ${e.message}\n`);
  process.exit(0);
}
