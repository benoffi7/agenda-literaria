import { Suspense, lazy, useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';
// Estático a propósito: el aviso de versión nueva tiene que poder aparecer
// desde el primer render, incluso en la pantalla de login. No arrastra
// Firestore, así que no rompe el corte del bundle de D-51.
import { AvisoEtiquetas } from '@/components/admin/AvisoEtiquetas';
import { AvisoVersionNueva } from '@/components/admin/AvisoVersionNueva';
import { PieVersion } from '@/components/admin/PieVersion';
import { useVersionPublicada } from '@/components/admin/useVersionPublicada';
// El SDK de analítica lo carga este módulo de forma diferida, así que el
// import no engorda el chunk inicial.
import { medirPanelAbierto, registrarVersion } from '@/lib/analytics';
// Store de módulo, sin Firestore ni React context (ver formulario-sucio.ts).
import { hayCambiosSinGuardar, marcarCambiosSinGuardar } from '@/lib/formulario-sucio';
import {
  AVISO_CAMBIOS_SIN_GUARDAR,
  debeConfirmarSalida,
  tieneFormulario,
} from '@/lib/salida-del-panel';
import { VERSION_APP } from '@/lib/version';
// Estático: la ayuda es solo datos y componentes, no toca Firestore.
import { BotonAyuda } from '@/components/admin/ayuda/BotonAyuda';
import {
  alCambiarDeSesion,
  almacenDelNavegador,
  borrarTodosLosBorradores,
} from '@/lib/formulario/borradoresDelNavegador';
import {
  loginConGoogle,
  logout,
  observarAuth,
  tieneClaimAdmin,
  usarEmuladores,
} from '@/lib/firebase-client';
import type { ActividadFormulario as TipoFormulario } from '@/components/admin/ActividadFormulario';
import type { CalendarioActividades as TipoCalendario } from '@/components/admin/CalendarioActividades';
import type { HistorialActividad as TipoHistorial } from '@/components/admin/HistorialActividad';
import type { ListaActividades as TipoLista } from '@/components/admin/ListaActividades';
import type { EstadisticasPanel as TipoEstadisticas } from '@/components/admin/EstadisticasPanel';
import type { ReportesPanel as TipoReportes } from '@/components/admin/ReportesPanel';
import type { ActividadConId, ActividadForm } from '@/types/actividad';
import type { User } from 'firebase/auth';

type Vista =
  | { tipo: 'lista' }
  | { tipo: 'nueva' }
  | { tipo: 'editar'; actividad: ActividadConId }
  // B-11 — la copia viaja como form, no como documento: se guarda por el camino
  // de creación, así el id, el slug y `createdAt`/`createdBy` son de la copia.
  | { tipo: 'duplicar'; copia: ActividadForm; tituloOrigen: string }
  | { tipo: 'reportes' }
  // La vista calendario es de solo lectura: enumera encuentros y, al tocar uno,
  // abre la actividad. No necesita estado propio (D-70).
  | { tipo: 'calendario' }
  // B-40 — historial de versiones de UNA actividad. Lleva la actividad y no solo
  // su id porque la comparación es contra el documento actual, y el listado ya
  // lo tiene en memoria: entrar no cuesta una lectura.
  | { tipo: 'historial'; actividad: ActividadConId }
  // B-170 — administración de las taxonomías del §4. No lleva estado: la
  // pantalla lee `/opciones/*` sola.
  | { tipo: 'taxonomias' }
  // B-370 — «Estado del catálogo», el tablero de docs/16-analitica-del-sitio.md.
  // No lleva estado: la pantalla lee `/actividades` sola, como el listado.
  | { tipo: 'estadisticas' };

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
    <Suspense fallback={<p className="p-8 text-sm text-tinta/50">Cargando…</p>}>
      <Cargado {...props} />
    </Suspense>
  );
};

// Los props salen del componente real vía `import type` (se borra al compilar,
// no genera import en runtime). Hay que anotarlos explícitamente: dentro de un
// `.then()` TypeScript no puede inferir `P`.
const ListaActividades = diferido<Parameters<typeof TipoLista>[0]>(() =>
  import('@/components/admin/ListaActividades').then((m) => ({ default: m.ListaActividades })),
);

const ActividadFormulario = diferido<Parameters<typeof TipoFormulario>[0]>(() =>
  import('@/components/admin/ActividadFormulario').then((m) => ({
    default: m.ActividadFormulario,
  })),
);

// Diferido igual que las otras dos vistas: ReportesPanel lee y escribe
// /reportes, así que arrastra Firestore. Estático devolvería el SDK al chunk
// del login y desharía el corte de B-09.
const ReportesPanel = diferido<Parameters<typeof TipoReportes>[0]>(() =>
  import('@/components/admin/ReportesPanel').then((m) => ({ default: m.ReportesPanel })),
);

// Diferida por la misma razón que las otras vistas: lee /actividades, así que
// arrastra Firestore y no puede volver al chunk del login (B-09, D-51).
const CalendarioActividades = diferido<Parameters<typeof TipoCalendario>[0]>(() =>
  import('@/components/admin/CalendarioActividades').then((m) => ({
    default: m.CalendarioActividades,
  })),
);

// B-40 — ídem, y con una razón de más: es la vista menos usada del panel
// (recuperar un campo pisado es una operación rara), así que es justo la que no
// tiene por qué viajar en el chunk que se baja para mostrar "Entrar con Google".
const HistorialActividad = diferido<Parameters<typeof TipoHistorial>[0]>(() =>
  import('@/components/admin/HistorialActividad').then((m) => ({
    default: m.HistorialActividad,
  })),
);

// B-170 — ídem: la administración de taxonomías se abre poco y el contador de
// pendientes que lleva al lado importa Firestore, así que ninguno de los dos
// tiene por qué viajar en el chunk del login.
const TaxonomiasPanel = diferido<object>(() =>
  import('@/components/admin/taxonomias/TaxonomiasPanel').then((m) => ({
    default: m.TaxonomiasPanel,
  })),
);

// B-370 — ídem: el tablero lee /actividades, así que arrastra Firestore. Y es
// además la pantalla que se abre de a ratos y no en cada carga, así que es justo
// la que no tiene por qué viajar en el chunk del login (B-09, D-51, B-117).
const EstadisticasPanel = diferido<Parameters<typeof TipoEstadisticas>[0]>(() =>
  import('@/components/admin/EstadisticasPanel').then((m) => ({
    default: m.EstadisticasPanel,
  })),
);

const PendientesBadge = diferido<object>(() =>
  import('@/components/admin/taxonomias/PendientesBadge').then((m) => ({
    default: m.PendientesBadge,
  })),
);

/**
 * Cerrar sesión se lleva los borradores del navegador (B-191).
 *
 * El autoguardado persiste **contenido**, y parte de ese contenido el §5.1 lo
 * marca como interno (`difusion`, `inscripcion.destino`, `online.url`). Sin este
 * paso sobrevive al logout hasta 30 días, en claro y bajo una clave predecible:
 * en una máquina compartida, la persona que entra después se encuentra con lo que
 * dejó a medias la anterior. La clave lleva la huella del uid, así que el aviso
 * no se lo ofrecería —eso es lo que arregla la clave—, pero el contenido seguiría
 * ahí, y `07-seguridad.md` promete que el alcance es el de la sesión del panel.
 *
 * Se borra **antes** del `signOut`: después de cerrar sesión la pantalla puede
 * remontar y no hay garantía de llegar a correrlo.
 */
const cerrarSesion = () => {
  borrarTodosLosBorradores(almacenDelNavegador());
  return logout();
};

/**
 * SPA del panel, montada como island `client:only` en `/admin` (§2.3, §9).
 * El router es propio y mínimo: lista, nueva, editar, duplicar, reportes y
 * calendario.
 */
export function AdminApp() {
  const [usuario, setUsuario] = useState<User | null>(null);
  const [esAdmin, setEsAdmin] = useState<boolean | null>(null);
  const [cargando, setCargando] = useState(true);
  const [vista, setVista] = useState<Vista>({ tipo: 'lista' });
  const [version, setVersion] = useState(0);

  // Una sola llamada: el hook hace el fetch de /version.json y el reload().
  // Dos componentes llamándolo serían dos chequeos y, en el peor caso, dos
  // recargas. Se reparte al aviso y al pie.
  const estadoVersion = useVersionPublicada();

  /**
   * A dónde vuelve el formulario al guardar o cancelar. Sin esto, editar desde
   * el calendario devolvía al listado y se perdía el mes que se estaba
   * mirando — que en una vista de calendario es la mitad del contexto.
   */
  const [volverA, setVolverA] = useState<'lista' | 'calendario' | 'estadisticas'>('lista');

  /**
   * B-177 — las etiquetas nuevas que el último guardado no llegó a registrar.
   *
   * Vive acá y no en el formulario porque el formulario se desmonta al guardar:
   * el aviso tiene que sobrevivir al cambio de vista, y este es el único
   * componente que lo hace. Se limpia al abrir cualquier formulario de nuevo —un
   * aviso del guardado anterior colgado arriba de una carga nueva se lee como si
   * fuera de esta.
   */
  const [etiquetasSinRegistrar, setEtiquetasSinRegistrar] = useState<readonly string[]>([]);

  /**
   * B-35 — toda salida del formulario pasa por acá.
   *
   * Antes cada botón del encabezado hacía su `setVista` directo, así que
   * "Volver", "Calendario", "Reportar algo", "Salir" y "Cancelar" descartaban
   * los 30+ campos del §11 sin decir nada. La regla de cuándo preguntar es pura
   * y vive en `salida-del-panel.ts`; acá queda solo el `confirm()`.
   *
   * Envolver la acción en vez de chequear en cada `onClick` es lo que hace que
   * una salida nueva no pueda olvidarse del aviso: el botón nuevo se escribe
   * como `salirDe(() => …)` porque es la forma que tienen todos los demás.
   */
  const salirDe = (accion: () => void): void => {
    if (debeConfirmarSalida(vista.tipo, hayCambiosSinGuardar())) {
      if (!confirm(AVISO_CAMBIOS_SIN_GUARDAR)) return;
      // La persona eligió perderlos: el store queda limpio para que el aviso no
      // se repita en la pantalla siguiente si el desmontaje llega después.
      marcarCambiosSinGuardar(false);
    }
    accion();
  };

  /**
   * A dónde manda "← Volver" del encabezado. Desde el formulario respeta
   * `volverA` igual que "Cancelar": antes mandaba siempre al listado, así que
   * editar un encuentro desde el calendario y volver por el encabezado perdía
   * el mes que se estaba mirando — justo lo que `volverA` existe para evitar.
   */
  const destinoDeVolver = (): Vista =>
    tieneFormulario(vista.tipo) ? { tipo: volverA } : { tipo: 'lista' };

  /**
   * B-203 — el fin de sesión que no pasa por el botón «Salir».
   *
   * `cerrarSesion()` cubre los dos botones, que son los dos únicos call sites de
   * `logout()`. Pero `observarAuth` es `onAuthStateChanged` y avisa **sin ningún
   * click**: token revocado, cuenta deshabilitada, logout en otra pestaña. Ahí el
   * panel vuelve al login y, sin esto, los borradores quedan en el navegador en
   * claro y hasta 30 días, con campos que el §5.1 marca como internos.
   *
   * El uid anterior va en un `useRef` porque la condición es la **transición**, no
   * el valor: el primer aviso del observador es `null` mientras se restaura la
   * sesión, y borrar en cualquier `null` se llevaría el trabajo de quien está
   * abriendo el panel. La regla —qué transición borra y por qué— vive en
   * `alCambiarDeSesion`, junto al borrado; acá queda solo el enganche.
   *
   * Se corre **antes** del `await`: el `ref` tiene que quedar al día aunque la
   * lectura del claim tarde y llegue otro aviso del observador en el medio.
   */
  const uidAnterior = useRef<string | null>(null);

  useEffect(() => {
    return observarAuth(async (u) => {
      alCambiarDeSesion(almacenDelNavegador(), uidAnterior.current, u?.uid ?? null);
      uidAnterior.current = u?.uid ?? null;
      setUsuario(u);
      setEsAdmin(u ? await tieneClaimAdmin(u) : null);
      setCargando(false);
    });
  }, []);

  /**
   * B-35 — cerrar la pestaña con el formulario a medio cargar.
   *
   * Es el único camino de salida que el panel no controla: no hay click que
   * interceptar, así que va por `beforeunload`. El navegador muestra su propio
   * cartel y no se le puede poner texto — de ahí que el `confirm()` de las
   * salidas de abajo sí valga la pena, que es donde se puede explicar qué se
   * pierde.
   *
   * El estado se lee dentro del handler y no como dependencia del efecto: el
   * listener se registra una vez y siempre ve el valor actual del store.
   */
  useEffect(() => {
    const alCerrar = (e: BeforeUnloadEvent) => {
      if (!hayCambiosSinGuardar()) return;
      e.preventDefault();
      // Sin esto Chrome ignora el `preventDefault()` y cierra sin preguntar.
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', alCerrar);
    return () => window.removeEventListener('beforeunload', alCerrar);
  }, []);

  // Analítica del panel. Deliberadamente fuera del efecto de auth y sin datos
  // de la sesión: no se mide ni el uid ni el mail (docs/09-analitica.md).
  useEffect(() => {
    // Sin esto los eventos viajan sin `version` y un pico de errores no se
    // puede atribuir a un deploy, que es la mitad del valor de medir.
    registrarVersion(VERSION_APP);
    medirPanelAbierto();
  }, []);

  if (cargando) {
    return <p className="p-8 text-sm text-tinta/50">Cargando…</p>;
  }

  if (!usuario) {
    return (
      <div className="mx-auto max-w-sm px-segura py-24 text-center">
        <h1 className="font-serif text-2xl font-semibold">Panel de carga</h1>
        <p className="mt-2 text-sm text-tinta/60">
          Agenda de actividades literarias
        </p>
        <button
          type="button"
          onClick={() => void loginConGoogle()}
          className="mt-6 min-h-touch w-full rounded-md bg-acento px-4 text-sm font-medium text-white"
        >
          Entrar con Google
        </button>
        {usarEmuladores && (
          <p className="mt-4 text-xs text-tinta/45">
            Emuladores activos — la cuenta que uses es de mentira.
          </p>
        )}
        <PieVersion {...estadoVersion} />
      </div>
    );
  }

  // §5.3 — sin el custom claim `admin` no hay escritura posible: las reglas de
  // Firestore lo rechazan igual, esto solo evita mostrar un panel inútil.
  if (esAdmin === false) {
    return (
      <div className="mx-auto max-w-md px-segura py-24 text-center">
        <h1 className="font-serif text-xl font-semibold">Sin permisos</h1>
        <p className="mt-2 text-sm text-tinta/60">
          {usuario.email} no tiene el claim <code>admin</code>. Correlo con{' '}
          <code className="rounded bg-tinta/8 px-1">
            npm run admin:claim -- {usuario.uid}
          </code>{' '}
          y volvé a entrar.
        </p>
        <button
          type="button"
          onClick={() => void cerrarSesion()}
          className="mt-6 min-h-touch rounded-md border border-borde bg-white px-4 text-sm"
        >
          Salir
        </button>
        <PieVersion {...estadoVersion} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-segura py-6 lg:max-w-4xl">
      <AvisoVersionNueva {...estadoVersion} />
      <header className="mb-6 flex flex-wrap items-center gap-3 border-b border-borde pb-4">
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-xl font-semibold">
            {vista.tipo === 'lista'
              ? 'Actividades'
              : vista.tipo === 'nueva'
                ? 'Nueva actividad'
                : vista.tipo === 'duplicar'
                  ? `Copia de ${vista.tituloOrigen}`
                  : vista.tipo === 'reportes'
                    ? 'Bugs y sugerencias'
                    : vista.tipo === 'calendario'
                      ? 'Calendario'
                      : vista.tipo === 'historial'
                        ? `Historial de ${vista.actividad.titulo}`
                        : vista.tipo === 'taxonomias'
                          ? 'Opciones de los desplegables'
                          : vista.tipo === 'estadisticas'
                            ? 'Estado del catálogo'
                            : vista.actividad.titulo}
          </h1>
          <p className="truncate text-xs text-tinta/50">{usuario.email}</p>
        </div>
        {vista.tipo !== 'lista' && (
          <button
            type="button"
            onClick={() => salirDe(() => setVista(destinoDeVolver()))}
            className="min-h-touch shrink-0 rounded-md border border-borde bg-white px-3 text-sm"
          >
            ← Volver
          </button>
        )}
        {vista.tipo === 'lista' && (
          <button
            type="button"
            onClick={() => setVista({ tipo: 'calendario' })}
            className="min-h-touch shrink-0 rounded-md px-3 text-xs text-tinta/55 hover:bg-black/5"
          >
            Calendario
          </button>
        )}
        {vista.tipo === 'lista' && (
          <button
            type="button"
            onClick={() => setVista({ tipo: 'taxonomias' })}
            className="min-h-touch flex shrink-0 items-center rounded-md px-3 text-xs text-tinta/55 hover:bg-black/5"
          >
            Opciones
            <PendientesBadge />
          </button>
        )}
        {vista.tipo === 'lista' && (
          <button
            type="button"
            onClick={() => setVista({ tipo: 'estadisticas' })}
            className="min-h-touch shrink-0 rounded-md px-3 text-xs text-tinta/55 hover:bg-black/5"
          >
            Estadísticas
          </button>
        )}
        {vista.tipo !== 'reportes' && (
          <button
            type="button"
            onClick={() => salirDe(() => setVista({ tipo: 'reportes' }))}
            className="min-h-touch shrink-0 rounded-md px-3 text-xs text-tinta/55 hover:bg-black/5"
          >
            Reportar algo
          </button>
        )}
        {/* Única entrada a la ayuda y a las novedades (D-61): el encabezado se
            ve en todas las pantallas, y al ser una capa se puede consultar sin
            perder el formulario a medio cargar. */}
        <BotonAyuda
          contexto={
            vista.tipo === 'lista'
              ? 'lista'
              : vista.tipo === 'calendario'
                ? 'calendario'
                : vista.tipo === 'taxonomias' || vista.tipo === 'estadisticas'
                  ? 'lista'
                  : 'formulario'
          }
        />
        <button
          type="button"
          onClick={() => salirDe(() => void cerrarSesion())}
          className="min-h-touch shrink-0 rounded-md px-3 text-xs text-tinta/55 hover:bg-black/5"
        >
          Salir
        </button>
      </header>

      {usarEmuladores && (
        <p className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Conectado a los emuladores locales. Nada de esto toca producción.
        </p>
      )}

      {/*
        B-177 — arriba de la vista y no adentro del listado: al volver del
        formulario se puede caer en el listado o en el calendario (según de dónde
        se entró), y el aviso tiene que estar en las dos.
      */}
      <AvisoEtiquetas
        etiquetas={etiquetasSinRegistrar}
        onIrAOpciones={() => {
          setEtiquetasSinRegistrar([]);
          setVista({ tipo: 'taxonomias' });
        }}
        onCerrar={() => setEtiquetasSinRegistrar([])}
      />

      {vista.tipo === 'lista' && (
        <ListaActividades
          version={version}
          onNueva={() => {
            setVolverA('lista');
            setEtiquetasSinRegistrar([]);
            setVista({ tipo: 'nueva' });
          }}
          onEditar={(a) => {
            // Se resetea acá y no solo se setea en el calendario: si no, la
            // preferencia queda pegada y una edición desde el listado
            // devolvería al calendario.
            setVolverA('lista');
            setEtiquetasSinRegistrar([]);
            setVista({ tipo: 'editar', actividad: a });
          }}
          onDuplicar={(copia, tituloOrigen) => {
            setVolverA('lista');
            setEtiquetasSinRegistrar([]);
            setVista({ tipo: 'duplicar', copia, tituloOrigen });
          }}
          uid={usuario.uid}
          onHistorial={(a) => {
            setVolverA('lista');
            setVista({ tipo: 'historial', actividad: a });
          }}
        />
      )}

      {vista.tipo === 'historial' && (
        <HistorialActividad
          actividad={vista.actividad}
          uid={usuario.uid}
          // Restaurar es una edición del documento: el listado tiene que
          // releerlo, igual que después de guardar el formulario.
          onRestaurado={() => setVersion((v) => v + 1)}
        />
      )}

      {vista.tipo === 'calendario' && (
        <CalendarioActividades
          version={version}
          onEditar={(a) => {
            setVolverA('calendario');
            setEtiquetasSinRegistrar([]);
            setVista({ tipo: 'editar', actividad: a });
          }}
        />
      )}

      {vista.tipo === 'taxonomias' && <TaxonomiasPanel />}

      {vista.tipo === 'estadisticas' && (
        <EstadisticasPanel
          onEditar={(a) => {
            // Vuelve al tablero y no al listado, con el mismo criterio que el
            // calendario: se llegó acá desde un aviso, y lo más probable es que
            // haya más de uno para atender en la misma sentada.
            setVolverA('estadisticas');
            setVista({ tipo: 'editar', actividad: a });
          }}
        />
      )}

      {vista.tipo === 'reportes' && (
        <ReportesPanel usuario={{ uid: usuario.uid, email: usuario.email }} />
      )}

      {(vista.tipo === 'nueva' || vista.tipo === 'editar' || vista.tipo === 'duplicar') && (
        <ActividadFormulario
          uid={usuario.uid}
          inicial={vista.tipo === 'editar' ? vista.actividad : undefined}
          copia={vista.tipo === 'duplicar' ? vista.copia : undefined}
          tituloOrigen={vista.tipo === 'duplicar' ? vista.tituloOrigen : undefined}
          onCancelar={() => salirDe(() => setVista({ tipo: volverA }))}
          onGuardado={(_id, sinRegistrar) => {
            setVersion((v) => v + 1);
            setEtiquetasSinRegistrar(sinRegistrar ?? []);
            setVista({ tipo: volverA });
          }}
        />
      )}
      <PieVersion {...estadoVersion} />
    </div>
  );
}
