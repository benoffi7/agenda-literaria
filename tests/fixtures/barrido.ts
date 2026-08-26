/**
 * El barrido de una salida pública contra el fixture de centinelas (B-196).
 *
 * Vive acá y no en el test que lo usa por dos razones:
 *
 * 1. **Para poder reusarlo desde otra salida sin importar un archivo de tests**
 *    (importar un `.test.ts` haría correr sus tests dos veces). Hoy lo usa
 *    `tests/barrido-de-salidas-publicas.test.ts` para el `events.json`, el
 *    evento de Calendar y el `searchText`; la próxima salida pública que aparezca
 *    —cada una con su propia lista de excepciones— entra sin copiar nada.
 * 2. Porque la parte que se copia es **la mecánica**, no el criterio: el criterio
 *    es la lista de excepciones, y esa es distinta en cada salida y se escribe a
 *    mano, con su motivo.
 */
import { expect } from 'vitest';
import { CENTINELA, RUTAS_CENTINELA, type RutaCentinela } from './centinelas';

/**
 * Un grupo de centinelas que SÍ pueden salir por una salida, con su motivo.
 *
 * **El motivo no es decorativo.** Un barrido con veinte excepciones sin explicar
 * no verifica nada: la lista es el chequeo, y una entrada sin justificación es
 * una fuga aprobada por cansancio.
 */
export type Excepcion = {
  /** Nombre del grupo, para que el motivo se lea junto a lo que cubre. */
  nombre: string;
  centinelas: readonly RutaCentinela[];
  /** Por qué ese contenido es público. */
  porque: string;
};

export type OpcionesBarrido = {
  /** La salida está normalizada a minúsculas (el `searchText` del §6). */
  insensible?: boolean;
};

const permitidos = (grupos: readonly Excepcion[]): Set<RutaCentinela> =>
  new Set(grupos.flatMap((g) => g.centinelas));

/**
 * La aserción, **en las dos direcciones**:
 *
 *  - ningún centinela de más → sería una fuga de privacidad;
 *  - ninguno de menos → o se rompió la proyección, o la excepción sobra.
 *
 * La segunda dirección es la que convierte cada fila de la tabla del paso 0 en
 * algo que falla: un barrido de una sola dirección pasa con una salida vacía.
 *
 * El mensaje dice **qué** centinela y **a qué** salida, porque "expected false
 * to be true" sobre una fuga de privacidad no le sirve a nadie a las 2 de la
 * mañana.
 */
export const barrer = (
  salida: string,
  texto: string,
  grupos: readonly Excepcion[],
  opciones: OpcionesBarrido = {},
): void => {
  const permitido = permitidos(grupos);
  const aguja = opciones.insensible ? texto.toLowerCase() : texto;
  const contiene = (v: string) => aguja.includes(opciones.insensible ? v.toLowerCase() : v);

  const fugas: string[] = [];
  const faltantes: string[] = [];

  for (const ruta of RUTAS_CENTINELA) {
    const presente = contiene(CENTINELA[ruta]);
    if (presente && !permitido.has(ruta)) fugas.push(`${ruta} → ${CENTINELA[ruta]}`);
    if (!presente && permitido.has(ruta)) faltantes.push(`${ruta} → ${CENTINELA[ruta]}`);
  }

  expect(
    fugas,
    `FUGA DE PRIVACIDAD en «${salida}»: se publicó contenido que el §5.1 no permite. ` +
      `Centinelas que sobrevivieron sin estar en la lista de excepciones: ` +
      `${fugas.join(' | ') || '(ninguno)'}`,
  ).toEqual([]);

  expect(
    faltantes,
    `«${salida}» dejó de publicar contenido que la lista de excepciones dice que sale. ` +
      `O se rompió la proyección, o la excepción sobra y hay que borrarla: ` +
      `${faltantes.join(' | ') || '(ninguno)'}`,
  ).toEqual([]);
};
