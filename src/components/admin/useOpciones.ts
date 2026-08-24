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
    const desuscribir = observarOpciones(campo, (v) => {
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
 * que la cantidad de hooks nunca cambia entre renders. Quien lo use conviene que
 * se monte recién cuando hace falta (la vista previa está colapsada por
 * defecto), porque cada uno abre su suscripción a Firestore.
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
 * Ojo: abre cinco suscripciones a Firestore, así que va montado una sola vez y
 * en un lugar que esté siempre visible, no en cada pantalla.
 */
export function usePendientesDeAprobacion(): number {
  const { porCampo } = useTodasLasOpciones();
  return useMemo(
    () =>
      CAMPOS_TAXONOMIA.reduce((total, campo) => total + pendientesDe(porCampo[campo]).length, 0),
    [porCampo],
  );
}
