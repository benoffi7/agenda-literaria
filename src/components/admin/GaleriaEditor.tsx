/**
 * La galería de imágenes del formulario (B-167, DEC-7).
 *
 * Filas dinámicas, cada una con su `id` generado al crearse — trampa 2, la misma
 * que costó el diff de sesiones. Y con **vista previa en el momento de pegar la
 * URL**, que era la otra mitad del pedido: pegar una dirección y no ver nada hasta
 * publicar es cómo se publica una imagen rota.
 *
 * Lo que hay acá es la mitad de **URLs de afuera**. Subir archivos propios entra
 * en su propio módulo cargado lazy, por el corte del bundle (B-09/D-51): el SDK de
 * Storage no puede viajar en la carga inicial del panel.
 */
import { useState } from 'react';
import { claseBotonFila, claseBotonTinta, claseInput } from '@/components/admin/campos/Campo';
import { MAXIMO_IMAGENES, conPortada, imagenExterna, sinImagen } from '@/lib/imagenes';
import type { Imagen } from '@/types/actividad';

interface Props {
  imagenes: Imagen[];
  onChange: (imagenes: Imagen[]) => void;
  /** El título de la actividad: es el texto alternativo de todas (DEC-7a, D-125). */
  tituloActividad: string;
  error?: string;
}

/** Estado de la vista previa de cada fila, por id. */
type EstadoPrevia = 'cargando' | 'lista' | 'rota';

export function GaleriaEditor({ imagenes, onChange, tituloActividad, error }: Props) {
  const [previas, setPrevias] = useState<Record<string, EstadoPrevia>>({});
  const [urlNueva, setUrlNueva] = useState('');

  const marcarPrevia = (id: string, estado: EstadoPrevia) =>
    setPrevias((p) => ({ ...p, [id]: estado }));

  const agregar = () => {
    const url = urlNueva.trim();
    if (!url) return;
    // La primera nace portada: si no, la lista arranca sin ninguna y B-107 se
    // queda sin imagen para compartir sin que nada falle.
    onChange([...imagenes, imagenExterna(url, imagenes.length === 0)]);
    setUrlNueva('');
  };

  const editar = (id: string, cambio: Partial<Imagen>) =>
    onChange(imagenes.map((i) => (i.id === id ? { ...i, ...cambio } : i)));

  const lleno = imagenes.length >= MAXIMO_IMAGENES;

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="text-xs text-acento">{error}</p>}

      {imagenes.map((img) => {
        const estado = previas[img.id] ?? 'cargando';
        return (
          <div key={img.id} className="rounded-md border border-borde p-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
              {/*
                La miniatura es la vista previa. `alt` vacío a propósito: el
                epígrafe de al lado ya dice lo que es, y repetirlo se lee dos
                veces en un lector de pantalla.
              */}
              <div className="flex h-20 w-full shrink-0 items-center justify-center overflow-hidden rounded bg-tinta/[0.04] sm:w-28">
                {estado === 'rota' ? (
                  <span className="px-2 text-center text-[11px] text-tinta/50">
                    No se pudo cargar
                  </span>
                ) : (
                  <img
                    src={img.url}
                    alt=""
                    className="h-full w-full object-cover"
                    onLoad={() => marcarPrevia(img.id, 'lista')}
                    onError={() => marcarPrevia(img.id, 'rota')}
                  />
                )}
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <input
                  type="url"
                  inputMode="url"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  className={claseInput}
                  value={img.url}
                  onChange={(e) => {
                    marcarPrevia(img.id, 'cargando');
                    editar(img.id, { url: e.target.value });
                  }}
                  placeholder="https://…"
                  aria-label="Dirección de la imagen"
                />
                <input
                  type="text"
                  className={claseInput}
                  value={img.epigrafe}
                  onChange={(e) => editar(img.id, { epigrafe: e.target.value })}
                  placeholder="Epígrafe (opcional)"
                  aria-label="Epígrafe"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex min-h-touch items-center gap-2 text-xs">
                    <input
                      type="radio"
                      name="portada-galeria"
                      checked={img.portada}
                      onChange={() => onChange(conPortada(imagenes, img.id))}
                    />
                    Portada
                  </label>
                  {img.origen === 'propia' && (
                    <span className="text-[11px] text-tinta/50">Subida a la agenda</span>
                  )}
                  <button
                    type="button"
                    onClick={() => onChange(sinImagen(imagenes, img.id))}
                    className={`${claseBotonFila} ml-auto text-acento hover:bg-acento/10`}
                  >
                    Quitar
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {lleno ? (
        <p className="text-xs text-tinta/55">
          Llegaste a {MAXIMO_IMAGENES} imágenes, que es el máximo. Para agregar otra, quitá
          una.
        </p>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="url"
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            className={claseInput}
            value={urlNueva}
            onChange={(e) => setUrlNueva(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                // Enter agrega la fila y no manda el formulario: en una sección
                // de filas, el submit accidental es el error más caro.
                e.preventDefault();
                agregar();
              }
            }}
            placeholder="Pegá la dirección de una imagen"
            aria-label="Dirección de la imagen nueva"
          />
          <button type="button" onClick={agregar} className={`${claseBotonTinta} sm:w-auto`}>
            Agregar
          </button>
        </div>
      )}

      <p className="text-xs text-tinta/55">
        {imagenes.length === 0
          ? 'Sin imagen, la tarjeta del sitio no reserva un hueco gris: se ve igual de bien.'
          : `Para quien no puede ver la imagen, y para Google, se usa el título de la actividad${
              tituloActividad ? ` («${tituloActividad}»)` : ''
            }. El epígrafe es aparte y se muestra debajo de la foto.`}
      </p>
    </div>
  );
}
