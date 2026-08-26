import { useEffect, useRef, useState } from 'react';
import {
  almacenDelNavegador,
  borrarBorradorLocal,
  guardarBorradorLocal,
  leerBorradorLocal,
  vaLaPenaOfrecer,
  type AlmacenLocal,
  type BorradorLocal,
} from '@/lib/formulario/autoguardado';
import type { ActividadForm } from '@/types/actividad';

/**
 * Autoguardado del formulario (B-191): persiste lo que se está escribiendo en el
 * navegador y, al abrir, ofrece lo que quedó sin guardar.
 *
 * Los dos ganchos que hacen falta ya existían: el estado del formulario está
 * centralizado desde B-70 y `useFormularioSucio` ya sabe comparar contra el
 * estado inicial. Acá se hace lo mismo con el JSON, y por el mismo motivo: es un
 * `useEffect` y nada más, contra tocar los ~30 `onChange` del formulario.
 *
 * **Solo guarda si hay algo que perder.** Mientras el formulario esté igual que
 * cuando se abrió no se escribe nada: abrir una actividad para mirarla no puede
 * dejar un borrador que después se ofrezca como si fuera trabajo pendiente.
 *
 * **Lo recuperado se lee una sola vez, al montar.** Después el autoguardado pisa
 * la clave con lo que se vaya escribiendo, y aun así el aviso sigue pudiendo
 * ofrecer lo de antes: está en memoria. Sin eso, empezar a tipear sin decidir
 * qué hacer con el aviso se llevaría puesto lo que el aviso ofrecía.
 */

/** Cuánto se espera después de la última tecla antes de guardar. */
export const ESPERA_MS = 800;

export interface Autoguardado {
  /** Lo que quedó sin guardar de una sesión anterior, si vale ofrecerlo. */
  recuperado: BorradorLocal | null;
  /** El aviso se cierra: se recuperó, se descartó, o ya no aplica. */
  descartar: () => void;
  /** Se guardó bien en Firestore: el borrador local ya no tiene sentido. */
  limpiar: () => void;
}

export function useAutoguardado(form: ActividadForm, clave: string): Autoguardado {
  // `undefined` = todavía no se resolvió; `null` = no hay almacén usable (modo
  // privado, cuota, iframe con cookies bloqueadas). Distinguirlos evita volver a
  // preguntar en cada render cuando la respuesta ya fue "no hay".
  const almacen = useRef<AlmacenLocal | null | undefined>(undefined);
  const dameAlmacen = (): AlmacenLocal | null => {
    if (almacen.current === undefined) almacen.current = almacenDelNavegador();
    return almacen.current;
  };

  const inicial = useRef<string | null>(null);
  const [recuperado, setRecuperado] = useState<BorradorLocal | null>(null);
  const [descartado, setDescartado] = useState(false);

  // Al montar: leer lo que haya quedado. Va en un efecto y no en el `useState`
  // inicial porque `leerBorradorLocal` puede borrar la clave (versión vieja,
  // vencido) y eso es un efecto, no un cálculo.
  useEffect(() => {
    const guardado = leerBorradorLocal(dameAlmacen(), clave);
    setRecuperado(guardado && vaLaPenaOfrecer(guardado, form) ? guardado : null);
    // `form` a propósito **no** está en las dependencias: es la lectura de
    // apertura, y volver a correrla en cada tecleo re-ofrecería el borrador que
    // se acaba de pisar.
  }, [clave]);

  useEffect(() => {
    const actual = JSON.stringify(form);
    // Primer render: es el estado inicial, la referencia contra la que comparar.
    if (inicial.current === null) {
      inicial.current = actual;
      return;
    }
    if (actual === inicial.current) return;

    const id = setTimeout(() => {
      guardarBorradorLocal(dameAlmacen(), clave, form);
    }, ESPERA_MS);
    return () => clearTimeout(id);
  }, [form, clave]);

  return {
    recuperado: descartado ? null : recuperado,
    // Descartar **borra**, no esconde. Escondiendo, el borrador seguía en el
    // navegador —con `online.url`, `difusion` e `inscripcion.destino` en claro—
    // hasta 30 días, y como el aviso se lee al montar, volver al listado y
    // reabrir la actividad lo volvía a ofrecer: el botón no descartaba nada.
    // Es seguro para el camino de recuperar, que también pasa por acá: el
    // autoguardado reescribe la clave 800 ms después, ya saneada.
    descartar: () => {
      borrarBorradorLocal(dameAlmacen(), clave);
      setDescartado(true);
    },
    limpiar: () => {
      // Limpiar al guardar bien, o el borrador viejo reaparece encima de la
      // versión buena la próxima vez que se abra la actividad.
      borrarBorradorLocal(dameAlmacen(), clave);
      setDescartado(true);
    },
  };
}
