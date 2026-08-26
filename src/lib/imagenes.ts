/**
 * La galería de imágenes de una actividad (B-167, DEC-7).
 *
 * El modelo pasó de `imagenUrl: string | null` a una **lista**: una actividad
 * tiene el flyer, fotos del espacio y de ediciones anteriores, y B-107 necesita
 * exactamente una para Open Graph. De ahí `portada`, que es un flag explícito y
 * no "la primera": la que uno quiere que aparezca al compartir el link no siempre
 * es la primera que cargó.
 *
 * Todo lo de acá es **puro** y no toca Storage ni Firestore. La subida vive en su
 * propio módulo cargado lazy, por el corte del bundle (B-09/D-51).
 */
import type { Imagen } from '@/types/actividad';

/**
 * Id de una fila de la galería. **Generado en el cliente al crear la fila, nunca
 * por índice del array** — es la trampa 2, la misma que costó el diff de
 * sesiones: borrar la segunda imagen renumera todo y cualquier cosa que compare
 * por posición cree que cambiaron todas.
 *
 * Mismo patrón y mismo fallback que `nuevaSesionId()`.
 */
export const nuevaImagenId = (): string => {
  const uuid =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `img_${uuid}`;
};

/**
 * DEC-7b — cuántas por actividad. **Hoy el tope lo valida solo el schema.**
 *
 * Decía "y en las reglas", y era falso: `firestore.rules` no valida forma en
 * `/actividades` (solo `esAdmin()`) y `storage.rules` todavía no existe. La
 * validación del lado de las reglas entra con la tajada de la subida, que es donde
 * importa —ahí el cliente es lo que se puede saltear— y hasta entonces esto es una
 * sola defensa, no dos.
 */
export const MAXIMO_IMAGENES = 4;

/** DEC-7b — tamaño máximo de un archivo propio, en bytes. */
export const MAXIMO_BYTES = 3 * 1024 * 1024;

/**
 * Los tipos que se aceptan al subir. **SVG no**: es un documento ejecutable, y si
 * algún día se sirve por un rewrite de Hosting pasa a ser mismo origen que el
 * panel.
 */
export const TIPOS_ACEPTADOS = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const;

/** Una fila nueva de la galería, para una URL de afuera. */
export const imagenExterna = (url: string, esPrimera: boolean): Imagen => ({
  id: nuevaImagenId(),
  url: url.trim(),
  epigrafe: '',
  origen: 'externa',
  portada: esPrimera,
});

/**
 * La portada de la lista, o `null` si no hay ninguna.
 *
 * Devuelve la **primera** marcada aunque hubiera dos: el schema garantiza que sea
 * una sola, y esta función se usa también sobre datos que todavía no pasaron por
 * el schema (el default de lectura de un documento viejo, la vista previa).
 */
export const portadaDe = (imagenes: readonly Imagen[] = []): Imagen | null =>
  imagenes.find((i) => i.portada) ?? imagenes[0] ?? null;

/**
 * Marca una imagen como portada y desmarca las demás.
 *
 * Es una sola operación y no dos porque "exactamente una portada" es un
 * invariante: dejarlo en manos de dos llamadas separadas es cómo aparecen los
 * estados con dos portadas o con ninguna.
 */
export const conPortada = (imagenes: readonly Imagen[], id: string): Imagen[] =>
  imagenes.map((i) => ({ ...i, portada: i.id === id }));

/**
 * Saca una fila y **reasigna la portada si era la que se fue**.
 *
 * Sin esto, borrar la portada deja una lista sin ninguna, y B-107 se queda sin
 * imagen para Open Graph sin que nada falle.
 */
export const sinImagen = (imagenes: readonly Imagen[], id: string): Imagen[] => {
  const quedan = imagenes.filter((i) => i.id !== id);
  if (quedan.length === 0 || quedan.some((i) => i.portada)) return quedan;
  return quedan.map((i, n) => ({ ...i, portada: n === 0 }));
};

/**
 * El default de lectura de los documentos que ya están en producción (D-125).
 *
 * Tienen `imagenUrl` y no tienen `imagenes`. **Se resuelve al leer, para siempre**,
 * y no con un script que escriba en producción: nada se pisa, no hay una ventana
 * en la que el panel y el sitio vean cosas distintas, y no hay que acordarse de
 * correr nada antes de deployar.
 *
 * **El id tiene que ser determinístico**, y esto no es un detalle: un uuid nuevo
 * en cada lectura hace que `huboCambioDeContenido` —el que decide si hay algo que
 * guardar y si se escribe una versión al historial— vea un cambio cada vez que se
 * abre el formulario. El centinela fijo dice además, a quien lo mire, que esa fila
 * viene de un documento anterior a la galería.
 */
export const ID_IMAGEN_MIGRADA = 'img_legacy';

export const imagenesDe = (doc: {
  imagenes?: Imagen[];
  imagenUrl?: string | null;
}): Imagen[] => {
  if (doc.imagenes) return doc.imagenes;
  if (!doc.imagenUrl) return [];
  return [
    {
      id: ID_IMAGEN_MIGRADA,
      url: doc.imagenUrl,
      epigrafe: '',
      origen: 'externa',
      portada: true,
    },
  ];
};
