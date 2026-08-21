import { useEffect, useMemo, useState } from 'react';
import { OPCIONES_BASE, observarOpciones, ordenarValores } from '@/lib/opciones';
import { labelsDeOpciones, type LabelsTaxonomia } from '@/lib/vistaPreviaEvento';
import type { CampoTaxonomia, ValorOpcion } from '@/types/actividad';

/**
 * §4.4 — las opciones se leen en vivo, así una etiqueta nueva aparece sola en
 * el desplegable sin recargar el panel.
 * Si Firestore no responde, cae a las opciones base para que el formulario
 * siga siendo usable.
 */
export function useOpciones(campo: CampoTaxonomia) {
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

  return { valores, cargando };
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
