/**
 * **Qué comando de shell cuenta como un `git commit`** — B-799.
 *
 * Es lo que decide si el hook de los auditores mira el diff. Y lo que se
 * verifica acá no es «detecta commits» sino algo más fino y con dos lados:
 *
 * - **frena todo `git … commit` de verdad**, porque un commit que se escapa es
 *   un cambio publicado sin auditar;
 * - **no frena un comando de solo lectura** que apenas menciona la palabra,
 *   porque un aviso falso enseña a leer el bloque del hook como ruido — y es el
 *   bloque que un día va a estar frenando una credencial (B-180).
 *
 * ── Los tres falsos positivos que lo motivaron ────────────────────────────
 * Los tres pasaron en una sola sesión, el 2026-09-07, y ninguno escribía nada:
 * un `git log` con la palabra adentro de un `echo`, el comando que escribía el
 * ítem del backlog que describe este problema, y otro que la nombraba en un
 * heredoc. El detector era la palabra en cualquier parte del comando.
 */
import { describe, expect, it } from 'vitest';

import { esUnCommit, soloCodigo } from '../scripts/comando-de-commit.mjs';

/**
 * Los dos lados, en una sola tabla y a propósito: puestos juntos se lee que la
 * diferencia no es «tiene la palabra» sino **dónde la tiene**.
 *
 * Los cuatro `false` son casos reales o su forma exacta.
 */
const CASOS: readonly { comando: string; frena: boolean; porque: string }[] = [
  // ── Los que tienen que frenar ──────────────────────────────────────────
  { comando: 'git commit -m "x"', frena: true, porque: 'la forma más simple' },
  {
    comando: 'git commit -m "arreglar el commit roto"',
    frena: true,
    porque: 'el verbo está afuera de las comillas, aunque el mensaje repita la palabra',
  },
  {
    comando: 'git add . && git commit -F msg.txt',
    frena: true,
    porque: 'encadenado: el commit va después de un `&&`',
  },
  {
    comando: "git commit -F - <<'EOF'\nun mensaje\nEOF",
    frena: true,
    porque: 'con heredoc: el verbo está en la primera línea, que no se saca',
  },
  {
    comando: 'git -c user.name=x commit -m "y"',
    frena: true,
    porque: 'con una opción global en el medio — el detector no ancla al verbo',
  },
  // ── Los que NO tienen que frenar ───────────────────────────────────────
  {
    comando: 'git log --oneline -1; echo "el commit con el mail"; git log',
    frena: false,
    porque: 'CASO REAL: tres `git log` y un `echo`. Cero escrituras',
  },
  {
    comando: "python3 - <<'PY'\nprint('un git commit en el texto')\nPY",
    frena: false,
    porque: 'CASO REAL: el cuerpo de un heredoc que nombra la palabra',
  },
  { comando: 'git status', frena: false, porque: 'no la menciona' },
  {
    comando: 'echo "acordate de hacer git commit"',
    frena: false,
    porque: 'la frase entera está entre comillas',
  },
  { comando: '', frena: false, porque: 'vacío' },
];

describe('esUnCommit — frena las escrituras y no los `git log` — B-799', () => {
  it('cada caso da lo que tiene que dar', () => {
    /*
     * MUTACIÓN PROBADA: volver a `/\bgit\b[^\n]*\bcommit\b/` sobre el comando sin
     * pasar por `soloCodigo` deja en rojo los dos casos reales y el del `echo`.
     */
    const mal = CASOS.filter((c) => esUnCommit(c.comando) !== c.frena).map(
      (c) => `${c.frena ? 'tenía que frenar' : 'NO tenía que frenar'}: ${c.porque} — ${c.comando}`,
    );
    expect(mal).toEqual([]);
  });

  it('el error queda del lado de frenar de más, y eso es una decisión', () => {
    /*
     * **La tentación era anclar la palabra al verbo** —`/(^|[;&|])\s*git\s+commit/`—
     * y se descartó por la dirección del error: una forma que el ancla no cubriera
     * pasaría **sin auditar**, que es el modo de falla caro. Este detector prefiere
     * el otro lado.
     *
     * El caso que lo fija: un heredoc con un delimitador que el saneador no
     * reconoce deja su cuerpo adentro, y ahí la palabra vuelve a contar. **Frena
     * de más, y está aceptado.** Si algún día alguien lo «arregla» haciéndolo más
     * preciso, este caso se pone en rojo y hay que decidirlo, no descubrirlo.
     */
    const heredocRaro = 'cat <<"UN-DELIMITADOR-CON-GUIONES"\ngit commit\nUN-DELIMITADOR-CON-GUIONES';
    expect(
      esUnCommit(heredocRaro),
      'el detector se volvió más preciso: revisar que ninguna forma real de commit se escape',
    ).toBe(true);
  });
});

describe('soloCodigo saca el texto y deja el código', () => {
  it('saca los spans entre comillas y deja lo de afuera', () => {
    expect(soloCodigo('echo "hola" && ls')).toBe('echo "" && ls');
    expect(soloCodigo("echo 'hola' && ls")).toBe("echo '' && ls");
  });

  it('saca el cuerpo de un heredoc y conserva su primera línea', () => {
    /*
     * La primera línea se conserva porque **ahí vive el comando**: un
     * `git commit -F - <<'EOF'` tiene el verbo antes del cuerpo, y sacarlo entero
     * dejaría pasar el commit.
     */
    const s = soloCodigo("git commit -F - <<'EOF'\nun mensaje\ncon dos líneas\nEOF");
    expect(s).toContain('git commit -F -');
    expect(s).not.toContain('dos líneas');
  });

  it('los heredocs van antes que las comillas, y ese orden importa', () => {
    /*
     * Adentro de un heredoc puede haber una comilla sin cerrar —un apóstrofo en
     * una palabra, por ejemplo— y sacar las comillas primero desbalancearía el
     * resto del comando: el `replace` se comería desde ahí hasta la comilla
     * siguiente, que puede estar del otro lado del `&&`.
     */
    const s = soloCodigo("cat <<'FIN'\nno cerró la comilla: don't\nFIN\ngit status");
    expect(s).toContain('git status');
    expect(s).not.toContain("don't");
  });

  it('y un comando sin nada que sacar vuelve igual', () => {
    expect(soloCodigo('git status')).toBe('git status');
    expect(soloCodigo(undefined)).toBe('');
  });
});
