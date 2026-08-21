import { useEffect, useState } from 'react';
import { ActividadFormulario } from '@/components/admin/ActividadFormulario';
import { AvisoVersionNueva } from '@/components/admin/AvisoVersionNueva';
import { BotonAyuda } from '@/components/admin/ayuda/BotonAyuda';
import { ListaActividades } from '@/components/admin/ListaActividades';
import {
  loginConGoogle,
  logout,
  observarAuth,
  tieneClaimAdmin,
  usarEmuladores,
} from '@/lib/firebase-client';
import type { ActividadConId, ActividadForm } from '@/types/actividad';
import type { User } from 'firebase/auth';

type Vista =
  | { tipo: 'lista' }
  | { tipo: 'nueva' }
  | { tipo: 'editar'; actividad: ActividadConId }
  // B-11 — la copia viaja como form, no como documento: se guarda por el camino
  // de creación, así el id, el slug y `createdAt`/`createdBy` son de la copia.
  | { tipo: 'duplicar'; copia: ActividadForm; tituloOrigen: string };

/**
 * SPA del panel, montada como island `client:only` en `/admin` (§2.3, §9).
 * El router es propio y mínimo: lista, nueva, editar y duplicar.
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

      {vista.tipo !== 'lista' && (
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
