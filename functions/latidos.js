/**
 * **El latido de los barridos diarios** — B-2220.
 *
 * `barrido-fallo` (B-2195) avisa cuando un barrido falla **corriendo**. Lo que no
 * deja log es que deje de correr: un job de Cloud Scheduler pausado o borrado, o
 * una Function que crashea antes de entrar al cuerpo. Para eso cada barrido, al
 * terminar bien, anota su latido en `sistema/latidos`, y `verificarFrescuraDelSitio`
 * —que ya corre cada 30 minutos— avisa si alguno lleva más de 48 horas.
 *
 * La lógica de cuándo avisar es pura (`latidosVencidos`) para que tenga test.
 */

export const DOC_LATIDOS = 'sistema/latidos';

/** Los barridos que laten: los cuatro diarios de `conAlertaDeBarrido`. */
export const BARRIDOS_CON_LATIDO = Object.freeze([
  'borrarPropuestasVencidas',
  'borrarFichasVencidas',
  'limpiarImagenesHuerfanas',
  'limpiarVersionesHuerfanas',
]);

/** Dos días: un diario que se saltea una corrida no es todavía un problema. */
export const PLAZO_LATIDO_MS = 48 * 60 * 60 * 1000;

/** Una vez por día por barrido, no cada media hora: el mail no es un contador. */
export const ENTRE_AVISOS_MS = 24 * 60 * 60 * 1000;

const ms = (v) =>
  typeof v === 'number' ? v : typeof v?.toMillis === 'function' ? v.toMillis() : null;

/**
 * Los barridos que dejaron de latir y no se avisaron en el último día.
 *
 * Un barrido sin latido cuenta **desde `desde`**, la primera vez que la frescura
 * vio el documento: así el deploy que estrena esto no avisa de barridos que
 * todavía no tuvieron su primera corrida.
 *
 * @param {Record<string, any> | null} doc `sistema/latidos`
 * @param {number} ahora
 * @returns {string[]}
 */
export const latidosVencidos = (doc, ahora) => {
  const desde = ms(doc?.desde) ?? ahora;
  return BARRIDOS_CON_LATIDO.filter((nombre) => {
    const ultimo = ms(doc?.[nombre]) ?? desde;
    const avisado = ms(doc?.avisado?.[nombre]) ?? 0;
    return ahora - ultimo > PLAZO_LATIDO_MS && ahora - avisado > ENTRE_AVISOS_MS;
  });
};
