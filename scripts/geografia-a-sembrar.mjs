/**
 * **La decisión de `sembrar-geografia.mjs`, separada del I/O** — B-950, B-976,
 * B-2090.
 *
 * El script corre en el cuerpo del módulo y se conecta a Firestore al
 * importarlo, así que lo que un test tiene que poder mirar vive acá (la misma
 * forma que `slugs-a-reconciliar.mjs`, ver `tests/sembrar-slugs.test.ts`).
 */
// **La misma derivación que el panel y que la proyección pública**, importada y
// no copiada: con una copia acá, un documento sembrado y uno guardado desde el
// panel podrían discrepar en el slug de la ciudad — y el síntoma sería una
// actividad que el filtro del sitio no encuentra. Es la clase de B-88.
import { geografiaNormalizada } from '../src/lib/geografia.mjs';
// B-976 — para **no** normalizar una sede que se contradice.
import { reubicacionDe } from '../src/lib/reubicacion-de-barrio.mjs';

/**
 * Las modalidades con la geografía de cada sede normalizada. Devuelve `null` si
 * no hay nada que cambiar, para que el llamador no escriba de más.
 *
 * Solo se tocan los tres campos de la geografía: el resto de la sede —nombre,
 * dirección, indicaciones, `geo`— se copia tal cual. Un backfill que reescriba
 * un campo que no le toca es un backfill que puede perder datos.
 *
 * @param {readonly any[]} [modalidades]
 * @returns {any[] | null}
 */
export const modalidadesMigradas = (modalidades = []) => {
  let cambio = false;
  const nuevas = modalidades.map((m) => {
    if (!m?.sede) return m;
    /*
     * **Una sede que se contradice se saltea** — B-976.
     *
     * `geografiaNormalizada` deduce la provincia de la ciudad, y eso está bien
     * mientras la sede diga una sola cosa. Cuando dice dos, la deducción **elige
     * una y la escribe**: la actividad «Basura» tiene `barrio=provincia-de-buenos-aires`
     * y `ciudad=CABA`, y sin esta guarda quedaría como `caba / caba /
     * provincia-de-buenos-aires` — o sea, con la contradicción resuelta a la
     * fuerza, en una dirección, y con pinta de decidida. Eso es peor que el
     * estado de ahora: el dato malo deja de verse.
     *
     * `reubicacionDe` ya sabe reconocer esos casos, así que la guarda es
     * consultarla. Es el mismo principio que el script declara —«no inventa la
     * provincia de una ciudad que no sea CABA»— aplicado a la otra forma de
     * inventar: desempatar.
     */
    if (reubicacionDe(m.sede).estado === 'ambiguo') return m;
    const geo = geografiaNormalizada(m.sede);
    const igual =
      (m.sede.provincia ?? '') === geo.provincia &&
      (m.sede.barrio ?? '') === geo.barrio &&
      (m.sede.ciudad ?? '') === geo.ciudad;
    if (igual) return m;
    cambio = true;
    return { ...m, sede: { ...m.sede, ...geo } };
  });
  return cambio ? nuevas : null;
};
