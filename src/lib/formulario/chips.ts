/**
 * Lista de texto libre editada como chips (B-133).
 *
 * **Por qué no es `TagsInput`.** El backlog proponía reusarlo, y el patrón de
 * interacción es el mismo, pero `TagsInput` está atado a la taxonomía `tags`:
 * slugifica lo que se escribe y lo persiste en `/opciones/tags` (§4.2). Los
 * handles de «arrobar» no son una taxonomía —son trabajo interno del §3.2, no
 * salen nunca al público (§5.1) y nadie va a filtrar por ellos—, así que
 * reusarlo habría metido `@casabrandon` en el desplegable de etiquetas de todas
 * las actividades. El bug de fondo de B-133 era modelar una lista como string;
 * la respuesta no es cambiarla por la lista equivocada.
 *
 * Puro y sin React: la interacción se prueba sin montar nada.
 */

/**
 * Lo que separa un chip del siguiente al escribir o al pegar: coma, punto y
 * coma, salto de línea y tabulación.
 *
 * El espacio **no** está: hay handles y nombres con espacios, y cortar por
 * espacio los partiría a la mitad mientras se los escribe.
 */
const SEPARADORES = /[,;\n\r\t]+/;

/** `"@a, @b"` → `['@a', '@b']`. Es lo que resuelve pegar una lista entera. */
export const separarPegado = (texto: string): string[] =>
  texto
    .split(SEPARADORES)
    .map((s) => s.trim())
    .filter(Boolean);

/** ¿Este texto trae un separador adentro? Decide si confirmar al tipear. */
export const traeSeparador = (texto: string): boolean => SEPARADORES.test(texto);

/**
 * Agrega uno o varios chips, sin repetir.
 *
 * La comparación de duplicados **ignora mayúsculas y el arroba de adelante**:
 * `@CasaBrandon`, `casabrandon` y `@casabrandon` son la misma cuenta, y tenerlas
 * tres veces en la lista de a quién etiquetar es el error que se comete al
 * volver sobre una actividad meses después. Se guarda lo que se escribió: no se
 * normaliza el valor, solo se lo compara normalizado. Forzar el arroba rompería
 * los handles que no son de Instagram, y quitarlo perdería información que quien
 * lo tipeó puso a propósito.
 */
export const agregarChips = (lista: readonly string[], texto: string): string[] => {
  const clave = (s: string) => s.trim().toLowerCase().replace(/^@+/, '');
  const vistos = new Set(lista.map(clave));
  const salida = [...lista];
  for (const chip of separarPegado(texto)) {
    if (vistos.has(clave(chip))) continue;
    vistos.add(clave(chip));
    salida.push(chip);
  }
  return salida;
};

/** Saca el chip de esa posición. Fuera de rango devuelve la lista igual. */
export const quitarChip = (lista: readonly string[], indice: number): string[] =>
  indice < 0 || indice >= lista.length ? [...lista] : lista.filter((_, i) => i !== indice);
