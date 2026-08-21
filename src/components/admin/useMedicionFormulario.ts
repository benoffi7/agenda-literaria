import { useEffect, useMemo, useRef } from 'react';
import { medir } from '@/lib/analytics';
import {
  avanceDelFormulario,
  clasificarFalloGuardado,
  formaDelFormulario,
  type ModoFormulario,
} from '@/lib/analytics-eventos';
import type { ActividadForm } from '@/types/actividad';

/**
 * Instrumentación del formulario de carga, en un hook aparte para que el
 * componente tenga **una sola línea** de instrumentación y no haya que
 * reacomodar nada para medir.
 *
 * Mide el ciclo de vida de una carga: cuándo se abre, cuánto tarda, cuántas
 * veces rebota la validación y en qué campos, si termina guardada o
 * abandonada, y con qué grupos sin completar si se abandonó.
 *
 * Nada de lo que sale de acá es contenido: la proyección de
 * `analytics-eventos.ts` solo acepta enums, contadores y rutas de campo del
 * schema. Ver `docs/09-analitica.md`.
 */
export interface MedicionFormulario {
  /** El schema rechazó el guardado: se reporta qué campos, no qué se escribió. */
  validacionFallida: (
    issues: readonly { path: readonly (string | number)[] }[],
    accion: 'borrador' | 'submit',
  ) => void;
  /** Se guardó: cierra el cronómetro y describe la forma de la actividad. */
  guardadoOk: (form: ActividadForm, accion: 'borrador' | 'submit') => void;
  /** No se pudo guardar: motivo clasificado, nunca el mensaje del error. */
  guardadoFallido: (error: unknown, accion: 'borrador' | 'submit') => void;
}

/** Tope de eventos `campo_invalido` por intento, para no inundar. */
const MAX_CAMPOS_REPORTADOS = 12;

export function useMedicionFormulario(
  form: ActividadForm,
  modo: ModoFormulario,
): MedicionFormulario {
  // El estado vivo del formulario, para poder describir el avance en el
  // desmontaje sin que el efecto dependa de cada tecleo.
  const formVivo = useRef(form);
  formVivo.current = form;

  // Huella del formulario al abrirlo, para saber si se abandonó con trabajo
  // adentro o se abrió y se salió sin tocar nada. Se compara la huella, no se
  // guarda contenido en ninguna parte que salga del navegador.
  const huellaInicial = useRef('');
  const abierto = useRef(0);
  const intentos = useRef(0);
  const resuelto = useRef(false);
  const cerrado = useRef(false);

  const segundos = () => Math.round((Date.now() - abierto.current) / 1000);

  useEffect(() => {
    abierto.current = Date.now();
    huellaInicial.current = JSON.stringify(formVivo.current);
    intentos.current = 0;
    resuelto.current = false;
    cerrado.current = false;
    medir('formulario_abierto', { modo });

    /**
     * Una carga abandonada: se salió del formulario sin guardar. Es la señal
     * de fricción más valiosa, y `faltantes` dice en qué grupo se trabó sin
     * mandar una letra de lo que se escribió.
     */
    const cerrar = () => {
      if (cerrado.current || resuelto.current) return;
      cerrado.current = true;
      const { completos, faltantes } = avanceDelFormulario(formVivo.current);
      medir('formulario_abandonado', {
        modo,
        segundos: segundos(),
        avance: completos.length,
        faltantes,
        encuentros: formVivo.current.sesiones.length,
        intentos_validacion: intentos.current,
        sucio: JSON.stringify(formVivo.current) !== huellaInicial.current,
      });
    };

    // `pagehide` y no `beforeunload`: es el que dispara en iOS Safari. Si el
    // SDK todavía no cargó, ese evento se pierde — el camino que importa es
    // "Cancelar"/"Volver", que desmonta el componente sin salir de la página.
    window.addEventListener('pagehide', cerrar);
    return () => {
      window.removeEventListener('pagehide', cerrar);
      cerrar();
    };
  }, [modo]);

  return useMemo<MedicionFormulario>(
    () => ({
      validacionFallida: (issues, accion) => {
        intentos.current += 1;
        const campos = issues.map((i) => i.path.join('.'));
        medir('validacion_fallida', {
          modo,
          accion,
          cantidad: campos.length,
          campos,
          intento: intentos.current,
        });
        // Uno por campo, para poder rankear "qué campo traba a la gente" sin
        // desarmar una lista concatenada en GA4.
        for (const campo of campos.slice(0, MAX_CAMPOS_REPORTADOS)) {
          medir('campo_invalido', { modo, campo, intento: intentos.current });
        }
      },

      guardadoOk: (guardado, accion) => {
        resuelto.current = true;
        medir('guardado_ok', {
          modo,
          accion,
          segundos: segundos(),
          intentos_validacion: intentos.current,
          ...formaDelFormulario(guardado),
        });
      },

      guardadoFallido: (error, accion) => {
        const { motivo, codigo } = clasificarFalloGuardado(error);
        medir('guardado_fallido', { modo, accion, motivo, codigo });
      },
    }),
    [modo],
  );
}
