/**
 * Pasos 1 a 3 del gate: el `events.json` **leyó** Firestore, sin el borrador,
 * sin las canceladas, con el eje de encuentros y sin ningún campo recortado.
 */
import {
  CENTINELA,
  CIUDAD_DEL_GATE,
  ID_DE_SESION_QUE_SALE,
  PROVINCIA_DEL_GATE,
  SLUG_AFUERA,
  SLUG_BORRADOR,
  SLUG_CANCELADA,
  SLUG_CANCELADA_NUNCA,
  SLUG_PUBLICADA,
} from '../semilla.mjs';

export const nombre = "el índice de actividades (events.json)";

/** @param {import('../chequeos.mjs').Contexto} ctx */
export const chequear = async (ctx) => {
  const { fallo, leer: leerDist } = ctx;
  const crudo = await leerDist('events.json');
  if (crudo === null) {
    fallo('no se generó dist/events.json: el build no escribió el índice que baja el listado.');
    return;
  }
  const indice = JSON.parse(crudo);
  const slugs = (indice.actividades ?? []).map((a) => a.slug);

  // 1 · El aserto que faltaba: el build tiene que haber LEÍDO algo.
  if (!slugs.includes(SLUG_PUBLICADA)) {
    fallo(
      `el events.json salió con ${slugs.length} actividades y ninguna es la sembrada.\n` +
        '  El build no leyó Firestore: apuntar FIRESTORE_EMULATOR_HOST no alcanza si\n' +
        '  del otro lado no hay nadie o la base está vacía. Un events.json vacío se\n' +
        '  publicaría encima del sitio que tiene datos (D-123, B-189).',
    );
  }

  // 2 · Control negativo del `where('estado','==','publicado')` (§5.3).
  if (slugs.includes(SLUG_BORRADOR)) {
    fallo(
      'el events.json trae la actividad en BORRADOR.\n' +
        "  Falta o está mal el where('estado','==','publicado') de src/pages/events.json.ts.",
    );
  }

  /*
   * 1b · **B-969 — la mitad no-CABA, sobre el artefacto de verdad.**
   *
   * Tres afirmaciones, y la primera es la que el bug de B-950 habría puesto en
   * rojo: `EntradaDeIndice.sede` tiene que llevar la **provincia**. Sin ella el
   * único chip posible es `caba`, y como la cascada abre el eje `ciudad` solo
   * con una provincia no-CABA elegida, el filtro de ciudad del sitio queda
   * inalcanzable — con la suite entera en verde, porque los unitarios le pasan
   * la otra forma del mismo dato.
   */
  const entradaDeAfuera = (indice.actividades ?? []).find((a) => a.slug === SLUG_AFUERA);
  if (!entradaDeAfuera) {
    fallo(
      `el events.json no trae la actividad de afuera de CABA (${SLUG_AFUERA}).\n` +
        '  Es la que cubre la mitad no-CABA de la cascada de B-950.',
    );
  } else if (entradaDeAfuera.sede?.provincia !== PROVINCIA_DEL_GATE) {
    fallo(
      'la entrada del índice salió SIN provincia: ' +
        `\`sede.provincia\` es ${JSON.stringify(entradaDeAfuera.sede?.provincia)}.\n` +
        '  Sin ese campo, `provinciaDeSede` cae al respaldo «¿la ciudad es CABA?»: el\n' +
        '  único chip posible pasa a ser `caba` y el eje `ciudad` del sitio queda\n' +
        '  inalcanzable. Es el bug que B-969 vino a cubrir (B-950, D-710).',
    );
  } else if (entradaDeAfuera.sede?.ciudad !== CIUDAD_DEL_GATE) {
    fallo(
      'la entrada del índice salió sin la ciudad esperada: ' +
        `${JSON.stringify(entradaDeAfuera.sede?.ciudad)}.`,
    );
  }

  // 2b · B-110 — una cancelada tiene página y **no** entra al índice (§7.3):
  // no es algo a lo que se pueda ir, existe solo para quien tiene el link.
  const canceladasEnElIndice = [SLUG_CANCELADA, SLUG_CANCELADA_NUNCA].filter((s) =>
    slugs.includes(s),
  );
  if (canceladasEnElIndice.length > 0) {
    fallo(
      `el events.json trae actividades CANCELADAS: ${canceladasEnElIndice.join(', ')}.\n` +
        '  Una cancelada conserva su página y no entra al listado (§7.3, B-110).',
    );
  }

  // 3b · El eje de encuentros de B-99 sí está, con su id de sesión. Es la
  // dirección contraria del aserto de abajo, y hace falta: sin ella, el día
  // que el eje deje de emitirse el archivo pasaría este gate en silencio.
  if (!crudo.includes(ID_DE_SESION_QUE_SALE)) {
    fallo(
      'el events.json NO trae el eje de encuentros de B-99: falta el id de sesión.\n' +
        '  Es lo que alimenta el tríptico «¿Qué hay ahora?» de la home (B-600).',
    );
  }

  // 3 · Ningún centinela de los campos recortados sobrevivió al archivo.
  const filtrados = Object.entries(CENTINELA).filter(([, v]) => crudo.includes(v));
  if (filtrados.length > 0) {
    fallo(
      'el events.json publica campos que el índice recorta:\n' +
        filtrados.map(([campo, valor]) => `    ${campo} → ${valor}`).join('\n'),
    );
  }
};
