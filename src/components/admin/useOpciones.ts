import { useEffect, useMemo, useState } from 'react';
import {
  OPCIONES_BASE,
  estaAprobada,
  observarOpciones,
  opcionesVisibles,
  ordenarValores,
} from '@/lib/opciones';
import { labelsDeOpciones, type LabelsTaxonomia } from '@/lib/vistaPreviaEvento';
import { CAMPOS_TAXONOMIA, type CampoTaxonomia, type ValorOpcion } from '@/types/actividad';

/**
 * B-127 — **una suscripción por documento de `/opciones/*`, no una por hook.**
 *
 * `observarOpciones` abre un `onSnapshot` cada vez que se lo llama, y el panel
 * lo llamaba una vez por hook montado. En la primera pantalla autenticada eso
 * son **diez** listeners sobre **cinco** documentos: cinco del listado
 * (`useLabelsTaxonomia`) y cinco del contador de la cabecera
 * (`usePendientesDeAprobacion`, que por definición mira los cinco campos). Con
 * el formulario y la vista previa abiertos se repite: los desplegables abren los
 * suyos y la vista previa otros cinco, todos sobre los mismos documentos.
 *
 * Este registro es lo que hace que el segundo interesado en `arancel` se cuelgue
 * del listener que ya está abierto en lugar de abrir otro. **No cambia lo que se
 * ve**: cada oyente sigue recibiendo cada snapshot, así que la propiedad del
 * §4.4 —una etiqueta nueva aparece sola, sin recargar el panel— queda intacta.
 * Es la razón por la que esto comparte en vez de recortar campos: recortar
 * apagaría el "en vivo" de alguno.
 *
 * Tres detalles que no son adorno:
 *
 * - **El último snapshot se guarda y se le repite al que llega tarde.** Sin eso,
 *   quien se suscribe cuando el listener ya estaba abierto se queda con
 *   `OPCIONES_BASE` hasta el próximo cambio en Firestore, que puede no llegar
 *   nunca: mostraría el slug crudo de una etiqueta que el de al lado sí muestra
 *   bien. El caché sobrevive al cierre del listener a propósito, por el mismo
 *   motivo.
 * - **El refcount cierra el listener cuando se va el último oyente**, que es el
 *   comportamiento de hoy: la vista se desmonta y no queda nada escuchando.
 * - **Los oyentes se guardan en cajas dentro de un `Set`**, y no como funciones
 *   sueltas ni como un contador. Funciones sueltas: dos hooks podrían pasar la
 *   misma referencia y el `Set` los contaría como uno, dejando al segundo sin
 *   datos cuando el primero se desmonta. Un contador: una limpieza repetida
 *   —React las llama de más en desarrollo— descontaría dos veces y cerraría el
 *   listener de alguien que sigue mirando.
 *
 * El observador entra por parámetro para poder probar el refcount sin Firestore
 * ni emuladores, que es el criterio del `docs/05-patrones.md`.
 */
export type Observador = (
  campo: CampoTaxonomia,
  cb: (valores: ValorOpcion[]) => void,
) => () => void;

export interface RegistroDeOpciones {
  /**
   * Devuelve la baja. Llamarla dos veces no descuenta dos veces: el refcount es
   * un `Set` de oyentes y no un contador, así que la segunda baja saca algo que
   * ya no está. React llama las limpiezas de más en desarrollo.
   */
  suscribir: (campo: CampoTaxonomia, cb: (valores: ValorOpcion[]) => void) => () => void;
  /** Qué documentos tienen un listener abierto ahora mismo. */
  abiertas: () => CampoTaxonomia[];
}

export const crearRegistroDeOpciones = (observar: Observador): RegistroDeOpciones => {
  interface Caja {
    cb: (valores: ValorOpcion[]) => void;
  }
  interface Compartida {
    oyentes: Set<Caja>;
    cerrar: () => void;
  }
  const abiertas = new Map<CampoTaxonomia, Compartida>();
  const ultimo = new Map<CampoTaxonomia, ValorOpcion[]>();

  const suscribir = (campo: CampoTaxonomia, cb: (valores: ValorOpcion[]) => void) => {
    let compartida = abiertas.get(campo);
    if (!compartida) {
      const nueva: Compartida = { oyentes: new Set<Caja>(), cerrar: () => {} };
      // Se registra ANTES de abrir: `observar` puede responder de forma
      // sincrónica y el callback necesita encontrar la entrada ya puesta.
      abiertas.set(campo, nueva);
      nueva.cerrar = observar(campo, (valores) => {
        ultimo.set(campo, valores);
        // Copia de la lista: un oyente puede darse de baja al recibir.
        for (const caja of [...nueva.oyentes]) caja.cb(valores);
      });
      compartida = nueva;
    }

    const caja: Caja = { cb };
    compartida.oyentes.add(caja);

    const cacheado = ultimo.get(campo);
    if (cacheado) cb(cacheado);

    return () => {
      const actual = abiertas.get(campo);
      if (!actual) return;
      actual.oyentes.delete(caja);
      if (actual.oyentes.size === 0) {
        abiertas.delete(campo);
        actual.cerrar();
      }
    };
  };

  return { suscribir, abiertas: () => [...abiertas.keys()] };
};

/**
 * El registro del panel. Es estado de módulo a propósito: lo que se comparte
 * son los listeners de Firestore, que son globales al proceso, y un registro por
 * componente no compartiría nada.
 */
export const registroDeOpciones = crearRegistroDeOpciones(observarOpciones);

/**
 * §4.4 — las opciones se leen en vivo, así una etiqueta nueva aparece sola en
 * el desplegable sin recargar el panel.
 * Si Firestore no responde, cae a las opciones base para que el formulario
 * siga siendo usable.
 *
 * Devuelve dos listas y la diferencia importa (§4.3):
 *
 * - `valores` — **todas**, sin filtrar. Es lo que hay que usar para resolver la
 *   etiqueta de un slug: una actividad puede estar usando legítimamente una
 *   opción pendiente de otra persona, y con la lista filtrada se mostraría el
 *   slug crudo.
 * - `elegibles` — lo que esta cuenta puede **elegir**: las aprobadas más las
 *   que ella misma creó y esperan validación. Es lo que va en el desplegable.
 *
 * Sin `uid`, `elegibles` son solo las aprobadas.
 */
export function useOpciones(campo: CampoTaxonomia, uid?: string) {
  const [valores, setValores] = useState<ValorOpcion[]>(() =>
    ordenarValores(OPCIONES_BASE[campo]),
  );
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vivo = true;
    // B-127 — por el registro y no por `observarOpciones` directo: dos hooks
    // sobre el mismo campo comparten un solo `onSnapshot`.
    const desuscribir = registroDeOpciones.suscribir(campo, (v) => {
      if (!vivo) return;
      setValores(v);
      setCargando(false);
    });
    return () => {
      vivo = false;
      desuscribir();
    };
  }, [campo]);

  const elegibles = useMemo(() => opcionesVisibles(valores, uid), [valores, uid]);

  return { valores, elegibles, cargando };
}

/**
 * §4.1 — las cinco taxonomías juntas, en la forma `{ campo: { slug: etiqueta } }`
 * que necesita la descripción del evento. Es el equivalente en el panel de lo
 * que la Function resuelve leyendo `/opciones/*`.
 *
 * Cinco `useOpciones` en orden fijo: `CAMPOS_TAXONOMIA` es una constante, así
 * que la cantidad de hooks nunca cambia entre renders.
 *
 * B-127 — los cinco pasan por `registroDeOpciones`, así que montar esto **no**
 * agrega cinco `onSnapshot`: agrega cinco oyentes a los listeners que haya, y
 * abre solo los que todavía no estaban. Montarlo dos veces en la misma pantalla
 * —el listado y la vista previa— no cuesta el doble. Lo que sigue siendo cierto
 * es que el primero en montarse paga la apertura de los cinco documentos, así
 * que quien pueda esperar (la vista previa está colapsada por defecto) hace
 * bien en esperar.
 */
export function useLabelsTaxonomia(pendientes: LabelsTaxonomia = {}): LabelsTaxonomia {
  const arancel = useOpciones('arancel');
  const tipo = useOpciones('tipo');
  const barrio = useOpciones('barrio');
  const plataforma = useOpciones('plataforma');
  const tags = useOpciones('tags');

  return useMemo(
    () =>
      labelsDeOpciones(
        {
          arancel: arancel.valores,
          tipo: tipo.valores,
          barrio: barrio.valores,
          plataforma: plataforma.valores,
          tags: tags.valores,
        },
        pendientes,
      ),
    [arancel.valores, tipo.valores, barrio.valores, plataforma.valores, tags.valores, pendientes],
  );
}

/**
 * §4.1 · B-06 — las cinco taxonomías en vivo, sin filtrar por aprobación, para
 * la pantalla que las administra.
 *
 * Sin filtrar es el punto: administrarlas incluye ver justamente lo que el
 * desplegable esconde (lo pendiente de otra cuenta) y lo que sobra (el typo con
 * `usos: 1`). Cinco `useOpciones` en orden fijo, como `useLabelsTaxonomia`:
 * `CAMPOS_TAXONOMIA` es una constante, así que la cantidad de hooks nunca
 * cambia entre renders.
 */
export function useTodasLasOpciones(): {
  porCampo: Record<CampoTaxonomia, ValorOpcion[]>;
  cargando: boolean;
} {
  const arancel = useOpciones('arancel');
  const tipo = useOpciones('tipo');
  const barrio = useOpciones('barrio');
  const plataforma = useOpciones('plataforma');
  const tags = useOpciones('tags');

  return useMemo(
    () => ({
      porCampo: {
        arancel: arancel.valores,
        tipo: tipo.valores,
        barrio: barrio.valores,
        plataforma: plataforma.valores,
        tags: tags.valores,
      },
      cargando:
        arancel.cargando ||
        tipo.cargando ||
        barrio.cargando ||
        plataforma.cargando ||
        tags.cargando,
    }),
    [arancel, tipo, barrio, plataforma, tags],
  );
}

/** Las que esperan validación en un campo (§4.3). */
export const pendientesDe = (valores: ValorOpcion[]): ValorOpcion[] =>
  valores.filter((v) => !estaAprobada(v));

/**
 * §4.3 · B-26 — cuántas opciones esperan validación, en total.
 *
 * Existe para que la cabecera del panel pueda mostrar un número: una etiqueta
 * pendiente es invisible para la otra cuenta y, sin aviso, puede quedar
 * pendiente para siempre mientras las dos personas crean dos slugs para lo
 * mismo — justo lo que el §4.2 evita.
 *
 * Hoy devuelve 0 salvo por lo que quedó pendiente antes de B-131 (las opciones
 * nuevas nacen aprobadas). Se deja igual: es la parte de la maquinaria dormida
 * que hay que tener lista para el día que se prenda.
 *
 * Ojo: mira los cinco campos, así que mientras esté montado los cinco
 * documentos de `/opciones/*` tienen un listener abierto — recortar el listado a
 * los dos campos que muestra no bajaría de cinco mientras la cabecera esté ahí
 * (B-127). Va montado una sola vez y en un lugar que esté siempre visible, no en
 * cada pantalla: con `registroDeOpciones` no duplica listeners, pero sí oyentes
 * y re-renders.
 */
export function usePendientesDeAprobacion(): number {
  const { porCampo } = useTodasLasOpciones();
  return useMemo(
    () =>
      CAMPOS_TAXONOMIA.reduce((total, campo) => total + pendientesDe(porCampo[campo]).length, 0),
    [porCampo],
  );
}
