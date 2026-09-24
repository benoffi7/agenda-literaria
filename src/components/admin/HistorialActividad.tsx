import { Seccion } from '@/components/admin/campos-del-panel';
import { textoDeFallo } from '@/lib/fallosDelPanel';
import { useCallback, useEffect, useState } from 'react';
import { claseBotonSecundario } from '@/components/campos/Campo';
import { leerActividad } from '@/lib/actividades';
import { fechaHoraLegible } from '@/lib/calendarioPanel';
import {
  avisoDeImagenesQueYaNoEstan,
  camposRestaurables,
  imagenesAComprobar,
  imagenesQueYaNoEstan,
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
  // B-181 — el nombre de pantalla, no el del modelo: en el panel se llaman
  // «opciones para sumarse» (ver el docblock de `Comision`). Sin esta entrada el
  // historial mostraría la clave cruda `comisiones`.
  comisiones: 'Opciones para sumarse',
  // B-224 — la lista es lo que se edita; `modalidad`, `sede` y `online` son
  // derivados y cambian con ella, así que nombrarlos aparte diría cuatro veces
  // el mismo cambio.
  modalidades: 'Modalidades',
  modalidad: 'Modalidad',
  sede: 'Lugar',
  online: 'Datos de la reunión',
  // B-919 — el cuarto derivado de `modalidades`. No se restaura por separado
  // (está en `CAMPOS_DERIVADOS`), pero tiene nombre igual que los otros tres:
  // un campo sin nombre se muestra con la clave cruda si alguna vez se lista.
  ciudades: 'Ciudades',
  inscripcion: 'Inscripción',
  arancel: 'Arancel',
  material: 'Material',
  difusion: 'Difusión',
  estado: 'Estado',
  tags: 'Etiquetas',
  // B-830 — el nombre de pantalla y no la clave: en el panel el campo se llama
  // «Qué se llevan».
  incluye: 'Qué se llevan',
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
 * Cuánto se espera a que una imagen conteste antes de darla por buena — B-852.
 * Pasado esto no se sabe nada, y no saber no es motivo para avisar de una pérdida.
 */
const ESPERA_DE_COMPROBACION_MS = 8000;

/**
 * ¿La `url` carga como imagen? — B-852.
 *
 * **Con un `<img>` y no con el SDK de Storage.** Lo que hay que saber es
 * exactamente lo que va a ver la persona después de restaurar —si esa `url` se
 * dibuja o da 404—, y un `Image` contesta eso sin nada más: no pide CORS (el
 * `fetch` a una URL de descarga sí, y el bucket no lo tiene, B-1235), no mete
 * `firebase/storage` en este chunk (su dueño es `subir-imagen.ts`, B-09/D-51) y
 * no necesita una regla nueva, porque es la misma lectura pública con la que el
 * sitio muestra la imagen.
 *
 * Un `onerror` por la red caída se lee como «no está», y está bien que así sea:
 * el aviso no frena nada, así que un falso positivo cuesta una frase de más en la
 * confirmación. La espera cortada, en cambio, se lee como «está».
 */
const cargaLaImagen = (url: string): Promise<boolean> =>
  new Promise((resolver) => {
    const img = new Image();
    const terminar = (carga: boolean) => {
      clearTimeout(espera);
      img.onload = null;
      img.onerror = null;
      resolver(carga);
    };
    const espera = setTimeout(() => terminar(true), ESPERA_DE_COMPROBACION_MS);
    img.onload = () => terminar(true);
    img.onerror = () => terminar(false);
    img.src = url;
  });

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
  const [comprobando, setComprobando] = useState<string | null>(null);

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
      setFallo(textoDeFallo(e, { respaldo: 'No se pudo leer el historial' }));
    } finally {
      setCargando(false);
    }
  }, [actividad.id]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  /**
   * B-852 — el aviso de las imágenes que ya no están, o `null`.
   *
   * Se comprueba **acá**, al elegir restaurar, y no al listar: es la única vez
   * que la respuesta sirve para algo. Para cualquier campo que no sea la galería
   * `imagenesAComprobar` devuelve vacío y no se pide nada a la red.
   */
  const avisoAntesDeRestaurar = async (
    version: VersionConId,
    campo: string,
  ): Promise<string | null> => {
    const aComprobar = imagenesAComprobar(campo, version, actual);
    if (aComprobar.length === 0) return null;
    const perdidas = await imagenesQueYaNoEstan(aComprobar, cargaLaImagen);
    const galeria = valorARestaurar(campo, version, actual);
    const total = Array.isArray(galeria) ? galeria.length : aComprobar.length;
    return avisoDeImagenesQueYaNoEstan(perdidas.length, total);
  };

  const restaurar = async (version: VersionConId, campo: string) => {
    const clave = `${version.id}:${campo}`;
    const nombre = legibleCampo(campo).toLowerCase();

    setComprobando(clave);
    let aviso: string | null;
    try {
      aviso = await avisoAntesDeRestaurar(version, campo);
    } finally {
      setComprobando(null);
    }

    const pregunta = `¿Restaurar ${nombre} como estaba el ${cuando(version)}?`;
    if (!confirm(aviso ? `${pregunta}\n\n${aviso}` : pregunta)) return;

    setRestaurando(clave);
    try {
      await restaurarCampo(actual, campo, version, uid);
      onRestaurado();
      // Se relee todo: la restauración es una edición más, así que genera su
      // propia versión y cambia qué campos siguen estando distintos.
      await cargar();
    } catch (e: unknown) {
      setFallo(textoDeFallo(e, { respaldo: 'No se pudo restaurar' }));
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
                      disabled={
                        restaurando === `${v.id}:${campo}` ||
                        comprobando === `${v.id}:${campo}`
                      }
                      className={`${claseBotonSecundario} shrink-0 disabled:opacity-50`}
                    >
                      {comprobando === `${v.id}:${campo}`
                        ? 'Comprobando…'
                        : restaurando === `${v.id}:${campo}`
                          ? 'Restaurando…'
                          : 'Restaurar'}
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
