/**
 * **¿Este comando de shell hace un `git commit`?** — B-799.
 *
 * Lo usa el hook `PreToolUse` de `hook-auditores.mjs` para decidir si mira el
 * diff. Vive aparte porque es la única parte decidible del hook y porque el hook
 * no se puede importar sin ejecutarlo — el mismo corte que `huella-de-auditoria.mjs`.
 *
 * ── El bug que esto arregla ───────────────────────────────────────────────
 * El detector era `/\bgit\b[^\n]*\bcommit\b/` sobre el comando entero, así que
 * frenaba cualquier invocación que tuviera las dos palabras en algún lado.
 * Frenó tres veces en una sesión, y ninguna escribía nada:
 *
 *   git log --oneline -1; echo "--- ¿es HEAD el commit con el mail?"; git log …
 *
 * Es la regla que el propio hook se puso: «un hook que repite el mismo aviso se
 * aprende a ignorar en tres turnos» (B-180). Un aviso sobre un `git log` es peor
 * que repetido — es **falso**, y enseña a leer el bloque del hook como ruido,
 * justo el bloque que un día va a estar frenando una credencial.
 *
 * ── Cómo se arregla sin aflojar el gate ───────────────────────────────────
 * La tentación es anclar la palabra al verbo de un `git` de verdad
 * (`/(^|[;&|])\s*git\s+commit/`). **No se hizo, y el motivo es la dirección del
 * error:** un `git -C /otro/repo commit` o cualquier forma que el ancla no
 * cubriera **pasaría sin auditar**, que es el modo de falla caro. Este archivo
 * prefiere el otro: seguir usando la detección amplia y **sacarle al comando lo
 * que es texto y no código** —lo que está entre comillas y los cuerpos de
 * heredoc—, que es donde estaban los tres falsos positivos.
 *
 * Así, cualquier `git … commit` **fuera de comillas** sigue frenando, y la
 * palabra adentro de un `echo`, de un mensaje de commit o del texto de un ítem
 * del backlog deja de contar.
 *
 * ── Lo que sigue siendo falso positivo, y está aceptado ───────────────────
 * Un heredoc cuyo delimitador no se parsee bien deja su cuerpo adentro, y la
 * palabra ahí vuelve a contar. Es el lado seguro: se frena de más, nunca de
 * menos. **No es un parser de shell y no tiene que serlo.**
 */

/**
 * El comando sin lo que es **texto**: cuerpos de heredoc y spans entre comillas.
 *
 * Los heredocs van primero: adentro puede haber comillas sin cerrar que
 * desbalancearían el paso siguiente.
 */
export const soloCodigo = (comando) => {
  let s = String(comando ?? '');

  /*
   * `<<'EOF' … EOF` / `<<EOF … EOF` / `<<-EOF`. Se saca el cuerpo y se deja la
   * primera línea, que es donde vive el `git commit -F -` si lo hay.
   */
  s = s.replace(/<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1[^\n]*\n[\s\S]*?^\2\s*$/gm, (m) =>
    m.slice(0, m.indexOf('\n')),
  );

  // Y lo que está entre comillas, simples o dobles, sin cruzar saltos de línea.
  return s.replace(/'[^'\n]*'/g, "''").replace(/"[^"\n]*"/g, '""');
};

/**
 * `true` si el comando hace un `git commit`.
 *
 * La detección es la de siempre —`git` y después `commit` en la misma línea—
 * pero aplicada al **código** y no al texto. Ver el encabezado.
 */
export const esUnCommit = (comando) => /\bgit\b[^\n]*\bcommit\b/.test(soloCodigo(comando));
