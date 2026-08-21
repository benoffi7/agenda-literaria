import { useEffect, useState } from 'react';
import { OPCIONES_BASE, observarOpciones, ordenarValores } from '@/lib/opciones';
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
