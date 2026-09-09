/**
 * El contador de propuestas esperando decisión, para la cabecera (B-830).
 *
 * **Es la única mitigación que el PRD tiene para su riesgo sin mitigación**
 * (§9): «si nadie la mira, las propuestas mueren ahí y es peor que el mail,
 * porque el mail al menos molesta en la casilla». El badge es lo que molesta.
 *
 * Componente aparte y no un hook en `AdminApp`, por el mismo motivo que
 * `PendientesBadge`: la cabecera vive en el chunk inicial del panel —el que se
 * baja para mostrar «Entrar con Google»— y este contador lee Firestore. Llamarlo
 * desde ahí arrastraría el SDK a ese chunk y desharía el corte de B-09/D-51
 * **sin que nada falle**. Ese error ya se cometió tres veces.
 */
import { useEffect, useState } from 'react';
import { observarPendientes } from '@/lib/bandejaDePropuestas';

export function PropuestasBadge() {
  const [pendientes, setPendientes] = useState(0);

  useEffect(
    () =>
      observarPendientes(
        (n) => setPendientes(n),
        // Un contador que no se pudo leer se muestra como cero y no rompe la
        // cabecera: las reglas ya se encargan de que solo un admin lea.
        () => setPendientes(0),
      ),
    [],
  );

  if (pendientes === 0) return null;

  return (
    <span
      className="ml-1 rounded-full bg-acento px-1.5 py-0.5 text-[10px] font-semibold text-white"
      aria-label={`${pendientes} ${pendientes === 1 ? 'propuesta' : 'propuestas'} para revisar`}
    >
      {pendientes}
    </span>
  );
}
