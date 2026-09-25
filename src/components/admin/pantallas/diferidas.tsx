import { Suspense, lazy, type ComponentType, type ReactNode } from 'react';
import { SiNoCarga } from '@/components/admin/SiNoCarga';
import type { ActividadFormulario as TipoFormulario } from '@/components/admin/ActividadFormulario';
import type { CalendarioActividades as TipoCalendario } from '@/components/admin/CalendarioActividades';
import type { HistorialActividad as TipoHistorial } from '@/components/admin/HistorialActividad';
import type { ListaActividades as TipoLista } from '@/components/admin/ListaActividades';
import type { EstadisticasPanel as TipoEstadisticas } from '@/components/admin/EstadisticasPanel';
import type { ReportesPanel as TipoReportes } from '@/components/admin/ReportesPanel';
import type { PropuestasPanel as TipoPropuestas } from '@/components/admin/PropuestasPanel';
import type { LibreriasPanel as TipoLibrerias } from '@/components/admin/LibreriasPanel';
import type { SuscripcionesPanel as TipoSuscripciones } from '@/components/admin/SuscripcionesPanel';
import type { LugaresPanel as TipoLugares } from '@/components/admin/LugaresPanel';
import type { BibliotecasPanel as TipoBibliotecas } from '@/components/admin/BibliotecasPanel';
import type { EfemeridesPanel as TipoEfemerides } from '@/components/admin/EfemeridesPanel';

/*
 * M-17 — las puertas diferidas del panel, en un módulo propio. Vivían arriba de
 * `AdminApp.tsx`; se sacaron al partirlo, sin cambiar una sola carga: cada
 * pantalla sigue entrando por `import()`, y este archivo solo importa **tipos**
 * de ellas, que se borran al compilar. Lo que sí queda en el chunk del login es
 * el helper y `SiNoCarga`, que ya estaban.
 */

/**
 * B-09 — carga diferida del panel autenticado.
 *
 * El listado y el formulario son los que arrastran el SDK de Firestore
 * (`@/lib/firestore-client`) y, con él, la mitad del bundle. Nadie los ve antes
 * de loguearse ni sin el claim `admin`, así que se cargan por `import()`: la
 * pantalla de login baja solo React + `firebase/auth`.
 *
 * El `Suspense` va acá adentro a propósito: así los puntos de uso del JSX no
 * cambian y el diff queda contenido en este bloque.
 */
const diferido = <P extends object>(
  cargar: () => Promise<{ default: (props: P) => ReactNode }>,
): ComponentType<P> => {
  const Cargado = lazy(cargar);
  return (props: P) => (
    /*
     * `SiNoCarga` envuelve el `Suspense` y no al revés — reporte del 2026-09-07.
     * Una pestaña abierta desde antes de un deploy apunta a chunks que Hosting ya
     * borró, y un `import()` que falla adentro de `lazy` tira hacia arriba: sin
     * este límite, React desmonta el árbol y **el panel queda en blanco**, sin
     * mensaje y sin nada que tocar.
     *
     * Va acá, en el helper, y así cubre de una las ocho vistas que pasan por él.
     * Las otras dos puertas de carga del panel llevan el suyo: la subida de
     * imágenes con un `try` propio —ahí el error no pasa por el render— y el
     * centro de ayuda, que se monta desde el encabezado y desde cada sección del
     * formulario, o sea **fuera** de este helper. Esa última quedó sin límite hasta
     * que los auditores la encontraron, y hoy lo verifica un chequeo de clase.
     */
    <SiNoCarga>
      <Suspense fallback={<p className="p-8 text-sm text-tinta/65">Cargando…</p>}>
        <Cargado {...props} />
      </Suspense>
    </SiNoCarga>
  );
};

// Los props salen del componente real vía `import type` (se borra al compilar,
// no genera import en runtime). Hay que anotarlos explícitamente: dentro de un
// `.then()` TypeScript no puede inferir `P`.
export const ListaActividades = diferido<Parameters<typeof TipoLista>[0]>(() =>
  import('@/components/admin/ListaActividades').then((m) => ({ default: m.ListaActividades })),
);

export const ActividadFormulario = diferido<Parameters<typeof TipoFormulario>[0]>(() =>
  import('@/components/admin/ActividadFormulario').then((m) => ({
    default: m.ActividadFormulario,
  })),
);

// Diferido igual que las otras dos vistas: ReportesPanel lee y escribe
// /reportes, así que arrastra Firestore. Estático devolvería el SDK al chunk
// del login y desharía el corte de B-09.
export const ReportesPanel = diferido<Parameters<typeof TipoReportes>[0]>(() =>
  import('@/components/admin/ReportesPanel').then((m) => ({ default: m.ReportesPanel })),
);

// Diferida por la misma razón que las otras vistas: lee /actividades, así que
// arrastra Firestore y no puede volver al chunk del login (B-09, D-51).
export const CalendarioActividades = diferido<Parameters<typeof TipoCalendario>[0]>(() =>
  import('@/components/admin/CalendarioActividades').then((m) => ({
    default: m.CalendarioActividades,
  })),
);

// B-40 — ídem, y con una razón de más: es la vista menos usada del panel
// (recuperar un campo pisado es una operación rara), así que es justo la que no
// tiene por qué viajar en el chunk que se baja para mostrar "Entrar con Google".
export const HistorialActividad = diferido<Parameters<typeof TipoHistorial>[0]>(() =>
  import('@/components/admin/HistorialActividad').then((m) => ({
    default: m.HistorialActividad,
  })),
);

// B-170 — ídem: la administración de taxonomías se abre poco y el contador de
// pendientes que lleva al lado importa Firestore, así que ninguno de los dos
// tiene por qué viajar en el chunk del login.
export const TaxonomiasPanel = diferido<object>(() =>
  import('@/components/admin/taxonomias/TaxonomiasPanel').then((m) => ({
    default: m.TaxonomiasPanel,
  })),
);

// B-370 — ídem: el tablero lee /actividades, así que arrastra Firestore. Y es
// además la pantalla que se abre de a ratos y no en cada carga, así que es justo
// la que no tiene por qué viajar en el chunk del login (B-09, D-51, B-117).
export const EstadisticasPanel = diferido<Parameters<typeof TipoEstadisticas>[0]>(() =>
  import('@/components/admin/EstadisticasPanel').then((m) => ({
    default: m.EstadisticasPanel,
  })),
);

// Diferida por lo mismo que las otras vistas: la bandeja lee y escribe
// `/propuestas`, así que arrastra Firestore (B-09, D-51).
export const PropuestasPanel = diferido<Parameters<typeof TipoPropuestas>[0]>(() =>
  import('@/components/admin/PropuestasPanel').then((m) => ({ default: m.PropuestasPanel })),
);

// Diferida por lo mismo que las otras vistas: la pantalla lee y escribe
// `/librerias`, así que arrastra Firestore (B-09, D-51). Y arrastra además el
// editor de galería, que trae `firebase/storage`.
export const LibreriasPanel = diferido<Parameters<typeof TipoLibrerias>[0]>(() =>
  import('@/components/admin/LibreriasPanel').then((m) => ({ default: m.LibreriasPanel })),
);

// Diferida por lo mismo que las otras vistas: lee y escribe `/suscripciones`,
// así que arrastra Firestore (B-09, D-51), y con el editor de galería arrastra
// además `firebase/storage`.
export const SuscripcionesPanel = diferido<Parameters<typeof TipoSuscripciones>[0]>(() =>
  import('@/components/admin/SuscripcionesPanel').then((m) => ({
    default: m.SuscripcionesPanel,
  })),
);

// Diferida por lo mismo que las otras vistas: lee y escribe `/lugares`, así que
// arrastra Firestore (B-09, D-51), y con el editor de galería arrastra además
// `firebase/storage`.
export const LugaresPanel = diferido<Parameters<typeof TipoLugares>[0]>(() =>
  import('@/components/admin/LugaresPanel').then((m) => ({ default: m.LugaresPanel })),
);

// Diferida por lo mismo que las otras vistas: lee y escribe `/bibliotecas`, así
// que arrastra Firestore (B-09, D-51), y con el editor de galería arrastra
// además `firebase/storage`.
export const BibliotecasPanel = diferido<Parameters<typeof TipoBibliotecas>[0]>(() =>
  import('@/components/admin/BibliotecasPanel').then((m) => ({ default: m.BibliotecasPanel })),
);

// Diferida por lo mismo que las otras vistas: lee y escribe `/efemerides`, así
// que arrastra Firestore (B-09, D-51).
export const EfemeridesPanel = diferido<Parameters<typeof TipoEfemerides>[0]>(() =>
  import('@/components/admin/EfemeridesPanel').then((m) => ({ default: m.EfemeridesPanel })),
);

/*
 * B-1230 — diferida como las otras vistas, aunque el motivo de siempre no
 * aplique: esta pantalla **no** arrastra Firestore (lee el `events.json` con un
 * `fetch`). Lo que sí arrastra es el armador del correo con sus dos renders, y
 * es la vista que se abre una vez por semana: no tiene por qué viajar en el
 * chunk que se baja para mostrar «Entrar con Google» (B-09, D-51, B-117).
 */
export const BoletinPanel = diferido<object>(() =>
  import('@/components/admin/BoletinPanel').then((m) => ({ default: m.BoletinPanel })),
);

export const PropuestasBadge = diferido<object>(() =>
  import('@/components/admin/PropuestasBadge').then((m) => ({ default: m.PropuestasBadge })),
);

export const PendientesBadge = diferido<object>(() =>
  import('@/components/admin/taxonomias/PendientesBadge').then((m) => ({
    default: m.PendientesBadge,
  })),
);
