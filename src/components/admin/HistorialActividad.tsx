import { useCallback, useEffect, useState } from 'react';
import { claseBotonSecundario } from '@/components/admin/campos/Campo';
import { Seccion } from '@/components/admin/campos/Seccion';
import { leerActividad } from '@/lib/actividades';
import { fechaHoraLegible } from '@/lib/calendarioPanel';
import {
  camposRestaurables,
  listarVersiones,
  resumenDeCampo,
  restaurarCampo,
  slugRestaurable,
  valorARestaurar,
  type VersionConId,
} from '@/lib/historial';
import { instanteDeTimestamp } from '@/lib/sesiones';
import type { ActividadConId } from '@/types/actividad';

interface Props {
  actividad: ActividadConId;
  uid: string;
  /** Se llama después de restaurar, para que el listado se refresque. */
  onRestaurado: () => void;
}

/**
 * Nombres de campo en el idioma del panel.
 *
 * El documento de versión trae claves del modelo (`imagenUrl`, `esCiclo`), y
 * mostrarlas crudas sería el mismo error que B-76 en otra pantalla: la persona
 * que recupera una descripción pisada no tiene por qué saber cómo se llama el
 * campo. Los que no están se muestran legibilizados, no se ocultan: un campo
 * nuevo del modelo tiene que poder restaurarse el día uno, aunque se lea feo.
 */
const NOMBRE_DE_CAMPO: Record<string, string> = {
  tipo: 'Tipo de actividad',
  titulo: 'Título',
  slug: 'Dirección web',
  descripcion: 'Descripción',
  // `imagenUrl` se conserva: las versiones anteriores a B-167 lo tienen, y sin
  // la entrada el historial mostraría la clave cruda.
  imagenUrl: 'Imagen',
  imagenes: 'Imágenes',
  organizador: 'Organizador',
  tallerista: 'Tallerista o invitado',
  // DEC-1 — sin esta entrada el historial mostraría la clave cruda `libro`.
  libro: 'Libro presentado',
  esCiclo: 'Es un ciclo',
  sesiones: 'Encuentros',
  // B-224 — la lista es lo que se edita; `modalidad`, `sede` y `online` son
  // derivados y cambian con ella, así que nombrarlos aparte diría cuatro veces
  // el mismo cambio.
  modalidades: 'Modalidades',
  modalidad: 'Modalidad',
  sede: 'Sede',
  online: 'Datos de la reunión',
  inscripcion: 'Inscripción',
  arancel: 'Arancel',
  material: 'Material',
  difusion: 'Difusión',
  estado: 'Estado',
  tags: 'Etiquetas',
  destacado: 'Destacada',
  searchText: 'Texto de búsqueda',
};

const legibleCampo = (campo: string): string =>
  NOMBRE_DE_CAMPO[campo] ?? campo.replace(/([A-Z])/g, ' $1').toLowerCase();

/** "24 de agosto · 19:30" a partir del `guardadoEn` de la versión. */
const cuando = (v: VersionConId): string => {
  const d = instanteDeTimestamp(v.guardadoEn);
  return d ? fechaHoraLegible(d) : 'fecha desconocida';
};

/**
 * B-40 — pantalla del historial de versiones (§12).
 *
 * El historial se guardaba desde B-03 y no había forma de mirarlo: recuperar un
 * campo pisado era abrir la consola de Firestore. Esta pantalla lo hace visible y
 * agrega lo único que faltaba de verdad, que es poder traer un valor de vuelta
 * **sin** pisar todo lo demás.
 *
 * **Restaura de a un campo.** Restaurar el documento entero pisaría los cambios
 * posteriores que sí se querían; el caso real es "me comí la descripción hace dos
 * ediciones", no "quiero volver al martes".
 *
 * **Solo ofrece los campos que hoy están distintos**, no los que esa edición
 * tocó: si el campo ya volvió solo a su valor viejo, restaurarlo no hace nada y
 * ofrecerlo es ruido.
 *
 * Es de solo lectura salvo por el botón: no hay borrar una versión. La retención
 * la maneja la Function (D-42), y una pantalla para borrar historial es una
 * pantalla para perder datos.
 */
export function HistorialActividad({ actividad, uid, onRestaurado }: Props) {
  const [versiones, setVersiones] = useState<VersionConId[]>([]);
  const [actual, setActual] = useState<ActividadConId>(actividad);
  const [cargando, setCargando] = useState(true);
  const [fallo, setFallo] = useState<string | null>(null);
  const [restaurando, setRestaurando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      // Las dos juntas: la comparación es contra el documento de HOY, así que
      // leer las versiones sin refrescar la actividad mostraría diferencias que
      // ya no existen.
      const [vs, a] = await Promise.all([
        listarVersiones(actividad.id),
        leerActividad(actividad.id),
      ]);
      setVersiones(vs);
      if (a) setActual(a);
    } catch (e: unknown) {
      setFallo(e instanceof Error ? e.message : 'No se pudo leer el historial');
    } finally {
      setCargando(false);
    }
  }, [actividad.id]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const restaurar = async (version: VersionConId, campo: string) => {
    const nombre = legibleCampo(campo).toLowerCase();
    if (!confirm(`¿Restaurar ${nombre} como estaba el ${cuando(version)}?`)) return;

    setRestaurando(`${version.id}:${campo}`);
    try {
      await restaurarCampo(actual, campo, version, uid);
      onRestaurado();
      // Se relee todo: la restauración es una edición más, así que genera su
      // propia versión y cambia qué campos siguen estando distintos.
      await cargar();
    } catch (e: unknown) {
      setFallo(e instanceof Error ? e.message : 'No se pudo restaurar');
    } finally {
      setRestaurando(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-tinta/60">
        Cada vez que alguien edita esta actividad se guarda cómo estaba antes. Acá podés
        traer de vuelta un dato suelto sin tocar el resto de lo que se cargó después.
      </p>

      {cargando && <p className="text-sm text-tinta/50">Cargando…</p>}

      {fallo && (
        <p className="rounded-md border border-acento/30 bg-acento/5 px-3 py-2 text-sm text-acento">
          {fallo}
        </p>
      )}

      {!cargando && versiones.length === 0 && (
        <p className="rounded-md border border-dashed border-borde px-3 py-10 text-center text-sm text-tinta/50">
          Todavía no hay versiones guardadas: esta actividad no se editó desde que se creó.
        </p>
      )}

      {!cargando && !slugRestaurable(actual) && (
        <p className="rounded-md border border-borde bg-white px-3 py-2 text-xs text-tinta/60">
          La dirección web no se puede restaurar: la actividad está publicada y cambiarla
          rompería el link que ya está dando vueltas.
        </p>
      )}

      {versiones.map((v) => {
        const restaurables = camposRestaurables(v, actual);
        return (
          <Seccion
            key={v.id}
            titulo={cuando(v)}
            descripcion={
              v.borrado
                ? 'Esta es la actividad completa, guardada al borrarla.'
                : `Se editó: ${v.camposCambiados.map(legibleCampo).join(', ') || '—'}`
            }
            colapsable
            abiertaPorDefecto={false}
          >
            {restaurables.length === 0 ? (
              <p className="text-sm text-tinta/55">
                Todo lo de esta versión está igual hoy. No hay nada que traer de vuelta.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {restaurables.map((campo) => (
                  <li
                    key={campo}
                    className="flex flex-col gap-2 rounded-md border border-borde bg-white px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3"
                  >
                    <div className="min-w-0 sm:flex-1">
                      <p className="text-sm font-medium">{legibleCampo(campo)}</p>
                      <p className="truncate text-xs text-tinta/55">
                        Decía: {resumenDeCampo(valorARestaurar(campo, v, actual))}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void restaurar(v, campo)}
                      disabled={restaurando === `${v.id}:${campo}`}
                      className={`${claseBotonSecundario} shrink-0 disabled:opacity-50`}
                    >
                      {restaurando === `${v.id}:${campo}` ? 'Restaurando…' : 'Restaurar'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Seccion>
        );
      })}
    </div>
  );
}
