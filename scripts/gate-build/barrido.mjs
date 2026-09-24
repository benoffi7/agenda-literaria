/**
 * **El barrido del paso 9 del gate, como función pura** — corte 3 de D-1070
 * (B-1760), sobre B-121.
 *
 * Recibe lo publicable que el build escribió (`{relativa, contenido}[]`,
 * relativo a `dist/`) y devuelve los mensajes de falla. No lee el disco ni
 * imprime: por eso se puede probar sin build, y por eso una fuga inyectada a
 * mano en un archivo de cada canasta se puede ver ponerse roja en milisegundos
 * (`tests/gate-build.test.ts`) además de en la corrida contra el emulador.
 *
 * ── Por qué este barrido existe al lado del de vitest ─────────────────────
 * `tests/barrido-de-salidas-publicas.test.ts` mira las **funciones puras** —qué
 * decide publicar la proyección— y corre sin build. Éste mira **lo que quedó
 * escrito en el artefacto**, que es lo único que prueba que ninguna plantilla
 * interpoló algo por su cuenta: un `title={imagen.storagePath}` agregado en un
 * `.astro` pasa el barrido del view-model y muere acá. Son complementarios.
 *
 * La lista de archivos **se deriva del `dist/`**: una página nueva entra sola.
 */
import {
  CENTINELA,
  CENTINELA_DEL_DETALLE,
  CENTINELA_DEL_INDICE,
  CENTINELA_DE_LA_CARTELERA,
  CENTINELA_DEL_DIRECTORIO,
  CENTINELA_DE_SUSCRIPCIONES,
  CENTINELA_DE_LUGARES,
  CENTINELA_DE_BIBLIOTECAS,
  MONTO_EN_EL_ARTEFACTO,
  PAGINAS_CON_TARJETA,
  pintaLaTarjeta,
} from './semilla.mjs';

/**
 * Qué centinelas puede llevar un archivo, según a qué salida pertenece.
 *
 * Las excepciones son **por salida**, cortas y justificadas, igual que en
 * `tests/barrido-de-salidas-publicas.test.ts`: la página de detalle publica la
 * descripción entera, la dirección y el tema (D-139); la cartelera, el epígrafe
 * (D-125); cada directorio de la Guía, la descripción y la dirección de sus
 * fichas. **Todo lo demás se barre en todos los archivos**, que es lo que hace
 * que una plantilla nueva no pueda publicar de más.
 *
 * @param {string} relativa  la ruta del archivo, relativa a `dist/`
 * @returns {readonly string[]}
 */
export const canastaDe = (relativa) => {
  const deLaGuia = (coleccion) =>
    relativa === `${coleccion}.json` || relativa.startsWith(`guia/${coleccion}/`);
  if (relativa.startsWith('actividad/')) return CENTINELA_DEL_DETALLE;
  if (relativa === 'events.json') return CENTINELA_DEL_INDICE;
  if (relativa.startsWith('cartelera/')) return CENTINELA_DE_LA_CARTELERA;
  if (deLaGuia('librerias')) return CENTINELA_DEL_DIRECTORIO;
  if (deLaGuia('suscripciones')) return CENTINELA_DE_SUSCRIPCIONES;
  if (deLaGuia('lugares')) return CENTINELA_DE_LUGARES;
  if (deLaGuia('bibliotecas')) return CENTINELA_DE_BIBLIOTECAS;
  return [];
};

/**
 * @param {{ relativa: string, contenido: string }[]} archivos
 * @returns {string[]} los mensajes de falla, vacío si el artefacto está limpio
 */
export const barrerArtefacto = (archivos) => {
  const fallos = [];

  /*
   * Control positivo, y no es una formalidad: si el glob dejara de encontrar
   * archivos —porque cambió el `outDir`, porque el build falló antes— este paso
   * saldría en verde **sin haber mirado nada**, que es la forma exacta en que el
   * paso 4 original pasaba leyendo cero documentos (B-217).
   */
  if (archivos.length < 5) {
    fallos.push(
      `el barrido del artefacto encontró ${archivos.length} archivo(s) publicables en dist/.\n` +
        '  Son demasiado pocos: o el build no escribió nada, o cambió dónde escribe.\n' +
        '  Un barrido sobre cero archivos pasa en verde sin haber mirado nada.',
    );
  }

  const hallazgos = [];
  /** Dónde apareció cada forma del monto — B-804. Es el control positivo. */
  const vistos = new Map(MONTO_EN_EL_ARTEFACTO.map((f) => [f.campo, []]));
  for (const { relativa, contenido } of archivos) {
    const permitido = canastaDe(relativa);
    for (const [campo, valor] of Object.entries(CENTINELA)) {
      if (!permitido.includes(campo) && contenido.includes(valor)) {
        hallazgos.push(`    ${relativa} → ${campo} (${valor})`);
      }
    }

    /*
     * B-804 — y el centinela **numérico**, que no entra en el modelo de canastas
     * porque sus dos formas no comparten permiso: el número crudo sale al índice
     * y al JSON-LD, la forma legible a todo lo que pinte la tarjeta compartida.
     */
    for (const forma of MONTO_EN_EL_ARTEFACTO) {
      if (!contenido.includes(forma.valor)) continue;
      vistos.get(forma.campo).push(relativa);
      if (!forma.permitido(relativa)) {
        hallazgos.push(`    ${relativa} → ${forma.campo} (${forma.valor})`);
      }
    }
  }

  /*
   * **Los tres controles positivos del monto** — B-804, y son la mitad del ítem.
   * Un barrido que solo afirma ausencias pasa en verde el día que la semilla deja
   * de sembrar el campo, que es exactamente el estado del que ese ítem venía: el
   * gate afirmaba sobre una salida que nunca tuvo el dato.
   */
  for (const forma of MONTO_EN_EL_ARTEFACTO) {
    if (vistos.get(forma.campo).length > 0) continue;
    fallos.push(
      `el monto del arancel no aparece en NINGÚN archivo del dist/ en su forma ` +
        `${forma.campo} (${forma.valor}).\n` +
        `  Tendría que salir en ${forma.donde}.\n` +
        '  O la semilla dejó de cargar `arancel.monto` con un tipo que lo admita, o la\n' +
        '  salida dejó de publicarlo: en los dos casos el barrido de abajo estaría\n' +
        '  afirmando sobre un dato que no existe (B-804).',
    );
  }

  if (vistos.get('montoLegible').filter((r) => pintaLaTarjeta(r)).length === 0) {
    fallos.push(
      'el monto no aparece en ninguna de las páginas que pintan la tarjeta compartida.\n' +
        `  Esperaba alguna de: ${PAGINAS_CON_TARJETA.join(', ')}.\n` +
        '  Es la cuarta canasta de B-804: si dejó de imprimirse ahí, el permiso que le\n' +
        '  dimos a esas páginas quedó sin nada que permitir.',
    );
  }

  if (!vistos.get('montoCrudo').includes('events.json')) {
    fallos.push(
      'el events.json no lleva el monto del arancel.\n' +
        '  Lo lleva desde B-114 porque la tarjeta del listado arma la frase del precio\n' +
        '  en el cliente: sin el número, el listado dice la etiqueta sola.',
    );
  }

  if (hallazgos.length > 0) {
    fallos.push(
      `hay campos privados en el artefacto construido (${hallazgos.length} hallazgo(s)):\n` +
        hallazgos.join('\n') +
        '\n  Es B-121: el barrido sobre `dist/`. Lo que se sube tiene un campo que\n' +
        '  ninguna salida pública debería llevar — y si el barrido de\n' +
        '  `tests/barrido-de-salidas-publicas.test.ts` está en verde, entonces la\n' +
        '  proyección recorta bien y lo publicó una **plantilla** por su cuenta.',
    );
  }

  return fallos;
};
