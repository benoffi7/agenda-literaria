import { Suspense, lazy, useEffect, useState, type ComponentType, type ReactNode } from 'react';
// Estático a propósito: el aviso de versión nueva tiene que poder aparecer
// desde el primer render, incluso en la pantalla de login. No arrastra
// Firestore, así que no rompe el corte del bundle de D-51.
import { AvisoVersionNueva } from '@/components/admin/AvisoVersionNueva';
// El SDK de analítica lo carga este módulo de forma diferida, así que el
// import no engorda el chunk inicial.
import { medirPanelAbierto, registrarVersion } from '@/lib/analytics';
import { VERSION_APP } from '@/lib/version';
// Estático: la ayuda es solo datos y componentes, no toca Firestore.
import { BotonAyuda } from '@/components/admin/ayuda/BotonAyuda';
import {
  loginConGoogle,
  logout,
  observarAuth,
  tieneClaimAdmin,
  usarEmuladores,
} from '@/lib/firebase-client';
import type { ActividadFormulario as TipoFormulario } from '@/components/admin/ActividadFormulario';
import type { ListaActividades as TipoLista } from '@/components/admin/ListaActividades';
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
  | { tipo: 'reportes' };

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

/**
 * SPA del panel, montada como island `client:only` en `/admin` (§2.3, §9).
 * El router es propio y mínimo: lista, nueva, editar y duplicar.
/**
 * SPA del panel, montada como island `client:only` en `/admin` (§2.3, §9).
 * El router es propio y mínimo: lista, nueva, editar, duplicar y reportes.
 */
export function AdminApp() {
  const [usuario, setUsuario] = useState<User | null>(null);
  const [esAdmin, setEsAdmin] = useState<boolean | null>(null);
  const [cargando, setCargando] = useState(true);
  const [vista, setVista] = useState<Vista>({ tipo: 'lista' });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    return observarAuth(async (u) => {
      setUsuario(u);
      setEsAdmin(u ? await tieneClaimAdmin(u) : null);
      setCargando(false);
    });
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
          onClick={() => void logout()}
          className="mt-6 min-h-touch rounded-md border border-borde bg-white px-4 text-sm"
        >
          Salir
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-segura py-6 lg:max-w-4xl">
      <AvisoVersionNueva />
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
                  : vista.actividad.titulo}
          </h1>
          <p className="truncate text-xs text-tinta/50">{usuario.email}</p>
        </div>
        {vista.tipo !== 'lista' && (
          <button
            type="button"
            onClick={() => setVista({ tipo: 'lista' })}
            className="min-h-touch shrink-0 rounded-md border border-borde bg-white px-3 text-sm"
          >
            ← Volver
          </button>
        )}
        {vista.tipo !== 'reportes' && (
          <button
            type="button"
            onClick={() => setVista({ tipo: 'reportes' })}
            className="min-h-touch shrink-0 rounded-md px-3 text-xs text-tinta/55 hover:bg-black/5"
          >
            Reportar algo
          </button>
        )}
        {/* Única entrada a la ayuda y a las novedades (D-61): el encabezado se
            ve en todas las pantallas, y al ser una capa se puede consultar sin
            perder el formulario a medio cargar. */}
        <BotonAyuda contexto={vista.tipo === 'lista' ? 'lista' : 'formulario'} />
        <button
          type="button"
          onClick={() => void logout()}
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

      {vista.tipo === 'lista' && (
        <ListaActividades
          version={version}
          onNueva={() => setVista({ tipo: 'nueva' })}
          onEditar={(a) => setVista({ tipo: 'editar', actividad: a })}
          onDuplicar={(copia, tituloOrigen) =>
            setVista({ tipo: 'duplicar', copia, tituloOrigen })
          }
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
          onCancelar={() => setVista({ tipo: 'lista' })}
          onGuardado={() => {
            setVersion((v) => v + 1);
            setVista({ tipo: 'lista' });
          }}
        />
      )}
    </div>
  );
}
