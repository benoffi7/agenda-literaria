/**
 * El contador de opciones esperando aprobación, para la cabecera (B-26).
 *
 * **Por qué es un componente y no un `usePendientesDeAprobacion()` en
 * `AdminApp`.** El hook vive en `useOpciones.ts`, que importa
 * `@/lib/firestore-client`. La cabecera se renderiza en `AdminApp`, que está en
 * el chunk inicial del panel — el que se baja para mostrar "Entrar con Google".
 * Llamarlo desde ahí arrastraría el SDK de Firestore a ese chunk y desharía el
 * corte de B-09/D-51 **sin que nada falle**: el panel seguiría funcionando, solo
 * tardaría el doble en aparecer. Ese error ya se cometió tres veces.
 *
 * Envuelto en `diferido()` y usado solo en la vista de lista, no cuesta nada:
 * ahí el listado ya bajó Firestore.
 */
import { usePendientesDeAprobacion } from '@/components/admin/useOpciones';

export function PendientesBadge() {
  const pendientes = usePendientesDeAprobacion();
  if (pendientes === 0) return null;

  return (
    <span
      className="ml-1 rounded-full bg-acento px-1.5 py-0.5 text-[10px] font-semibold text-white"
      aria-label={`${pendientes} ${pendientes === 1 ? 'opción' : 'opciones'} para aprobar`}
    >
      {pendientes}
    </span>
  );
}
