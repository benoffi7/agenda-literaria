/**
 * Las dos decisiones del paso 10 del gate de build — B-122.
 *
 * ── Por qué viven acá y no adentro del gate ────────────────────────────────
 * Es el mismo movimiento que B-180 hizo con `emuladores-arriba.sh` y B-205 con
 * `que-deployar.sh`: **una decisión que no se puede probar se prueba en
 * producción.** `scripts/build-contra-emulador.mjs` corre su cuerpo entero al
 * importarlo —termina en `process.exit`— así que nada puede importarle una
 * función para probarla. Con las dos decisiones acá afuera,
 * `tests/seo-del-artefacto.test.ts` les mete los casos rotos que el sitio de
 * verdad no tiene: la página sin `h1`, el salto de `h2` a `h4`, el título
 * repetido.
 *
 * Y con la lección que B-180 dejó escrita: **extraer la decisión y dejar la
 * copia adentro es peor que no extraerla**, porque habría dos y la que se testea
 * no sería la que corre. El test tiene un caso que verifica que el gate
 * **importe** estas funciones y no las reimplemente.
 *
 * ── Qué deciden, y por qué son propiedades y no juicios ────────────────────
 * B-122 pedía «un auditor del sitio público». De lo que le quedaba sin red, esto
 * es la mitad que es una **propiedad del artefacto** y por lo tanto no necesita
 * un modelo. La otra mitad —el nombre accesible de un control, el foco en un
 * recorrido real— necesita tabular una página viva y sigue siendo manual.
 */

/** El `<title>` de una página, sin los espacios de alrededor, o `null`. */
export const tituloDe = (html) => /<title>([\s\S]*?)<\/title>/.exec(html)?.[1]?.trim() ?? null;

/**
 * Lo que está mal en la jerarquía de encabezados de una página, en castellano.
 *
 * Dos reglas, y las dos se rompen sin que se vea nada:
 *
 * - **un solo `h1`.** Es el título de la página para un lector de pantalla; dos
 *   o ninguno lo dejan sin punto de partida.
 * - **ningún nivel salteado al bajar.** Un `h2` seguido de un `h4` deja un hueco
 *   en el índice que el lector arma. Visualmente es idéntico —basta ponerle la
 *   clase del `h3`— y por eso no lo encuentra nadie mirando.
 *
 * **Subir sí puede saltear**, y esto no lo reporta: cerrar una sección `h4` y
 * abrir la siguiente con `h2` es exactamente lo correcto. Reportarlo sería el
 * chequeo que avisa de más, o sea el que se aprende a ignorar.
 *
 * Se devuelve **un solo salto por página**: el arreglo es el mismo sea uno o
 * diez, y diez líneas por página convierten el error en ruido.
 */
export const problemasDeJerarquia = (html) => {
  const niveles = [...html.matchAll(/<h([1-6])\b/g)].map((m) => Number(m[1]));
  const problemas = [];

  const unos = niveles.filter((n) => n === 1).length;
  if (unos !== 1) problemas.push(`${unos} <h1> (tiene que haber exactamente uno)`);

  for (let i = 1; i < niveles.length; i += 1) {
    if (niveles[i] - niveles[i - 1] > 1) {
      problemas.push(`salta de h${niveles[i - 1]} a h${niveles[i]}`);
      break;
    }
  }
  return problemas;
};
