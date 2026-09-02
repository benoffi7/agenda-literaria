/**
 * Subir una imagen propia a Firebase Storage (B-167 segunda tajada, DEC-7c).
 *
 * **Este módulo se carga con `import()` y nunca estáticamente.** Es el único
 * dueño de `firebase/storage`, que es un SDK del mismo orden que
 * `firebase/firestore`: importarlo desde el árbol estático del panel deshace el
 * corte del bundle de B-09/D-51 con el build en verde. Lo cuidan dos chequeos de
 * `tests/bundle-panel.test.ts`: `firebase/storage` está en `SDK_PESADO` (no puede
 * llegar al chunk inicial) y «quién es dueño de Storage» (nadie importa este
 * módulo de forma estática, así que tampoco se pega al chunk del formulario).
 *
 * Todo lo que se puede decidir sin red vive en `imagenes-archivo.ts`, que es
 * puro: acá queda el pegamento con Storage, igual que `firestore-client.ts` es
 * el pegamento con Firestore.
 */
import { getStorage, connectStorageEmulator, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { FirebaseStorage } from 'firebase/storage';
import { app, usarEmuladores } from '@/lib/firebase-client';
import { CACHE_AL_SUBIR } from '@/lib/imagenes';
import {
  dimensiones,
  esDelTipoDeclarado,
  esTipoSubible,
  quedanMetadatos,
  rutaDeImagen,
  sinMetadatos,
  validarArchivo,
} from '@/lib/imagenes-archivo';
import type { MotivoImagen } from '@/lib/analytics-eventos';
import type { Imagen } from '@/types/actividad';

/** Puerto del emulador de Storage (`firebase.json`). */
const PUERTO_EMULADOR = 9199;

let _storage: FirebaseStorage | null = null;
const storage = (): FirebaseStorage => {
  if (_storage) return _storage;
  _storage = getStorage(app());
  if (usarEmuladores) connectStorageEmulator(_storage, '127.0.0.1', PUERTO_EMULADOR);
  return _storage;
};

/**
 * Un rechazo con un motivo que se le puede mostrar a una persona.
 *
 * Es una clase y no un string suelto para poder distinguir, en el componente,
 * "el archivo no sirve y ya sabemos por qué" de "se cayó la red": lo primero se
 * muestra tal cual, lo segundo necesita un mensaje genérico porque el error del
 * SDK no está escrito para nadie.
 */
export class ImagenRechazada extends Error {
  /**
   * Para la analítica: enum cerrado, nunca el nombre del archivo (§9).
   *
   * El tipo se **importa** de `analytics-eventos.ts` en vez de repetir la unión:
   * es la lección de B-88, y acá el modo de falla es mudo — un motivo que el
   * vocabulario no conoce llega a GA4 como `otro` y nadie se entera.
   */
  readonly causa: MotivoImagen;

  constructor(mensaje: string, causa: MotivoImagen) {
    super(mensaje);
    this.name = 'ImagenRechazada';
    this.causa = causa;
  }
}

/**
 * Sube el archivo y devuelve la fila de galería lista para agregar al formulario.
 *
 * `id` lo pasa el llamador y **es el que va a quedar en el documento**: el nombre
 * del objeto en Storage sale de él (`rutaDeImagen`), así que una fila y su
 * archivo comparten identidad. Se genera con `nuevaImagenId()` en el cliente, que
 * es la trampa 2 — nunca por índice del array.
 *
 * **No se borra nada al fallar a mitad de camino ni al quitar la fila.** Un
 * objeto huérfano en Storage cuesta centavos y es invisible; un borrado
 * automático puede llevarse el archivo de otra actividad si algún día se
 * comparten, y no hay papelera de la que sacarlo. La limpieza queda anotada en el
 * BACKLOG con su criterio.
 */
export const subirImagen = async (archivo: File, id: string): Promise<Imagen> => {
  const motivo = validarArchivo({ tipo: archivo.type, bytes: archivo.size });
  // El orden importa: el guard de tipo tiene que quedar **después** de haber
  // devuelto el mensaje de `validarArchivo`, que es el que dice cuál era el tipo.
  if (!esTipoSubible(archivo.type)) {
    throw new ImagenRechazada(motivo ?? 'Ese archivo no es una imagen JPG o PNG.', 'tipo');
  }
  if (motivo) throw new ImagenRechazada(motivo, 'tamano');

  const tipo = archivo.type;
  const crudo = new Uint8Array(await archivo.arrayBuffer());

  /*
   * **El tipo declarado no se puede creer.** Lo deriva el navegador de la
   * extensión, así que un WebP o un HEIC renombrado `.jpg` pasa `validarArchivo`,
   * hace que `sinMetadatos` no reconozca la firma y devuelva el archivo **tal
   * cual**, y engaña también a `storage.rules`, que compara el `contentType` que
   * manda este mismo cliente. Las tres capas confiaban en el mismo dato.
   */
  if (!esDelTipoDeclarado(tipo, crudo)) {
    throw new ImagenRechazada(
      'Ese archivo tiene nombre de imagen pero adentro es otra cosa, así que no le ' +
        'podemos sacar los datos ocultos. Abrila y volvé a exportarla como JPG o PNG.',
      'tipo',
    );
  }

  const limpio = sinMetadatos(tipo, crudo);

  /*
   * El barrido del §5, sobre una salida binaria: en vez de confiar en que el
   * recorrido de `sinMetadatos` sacó todo, se mira el resultado. Corta la subida
   * si quedó algo, y falla cerrado a propósito — una foto que hoy no se puede
   * subir es un problema de una tarde; una foto con las coordenadas de una casa
   * particular en el `events.json` no se despublica.
   */
  if (quedanMetadatos(limpio)) {
    throw new ImagenRechazada(
      'No pudimos sacarle todos los datos ocultos a esta foto (algunos celulares le ' +
        'guardan una segunda copia adentro). Abrila en el editor de fotos del teléfono, ' +
        'guardala de nuevo o recortala, y volvé a intentar.',
      'metadatos',
    );
  }

  const medida = dimensiones(tipo, limpio);
  const ruta = rutaDeImagen(id, tipo);

  try {
    const destino = ref(storage(), ruta);
    await uploadBytes(destino, limpio, {
      contentType: tipo,
      // **Corto, y el `immutable` lo pone la Function** — B-220, D-175.
      //
      // Hasta acá el comentario decía que el contenido de esta URL no puede
      // cambiar porque cada subida crea una fila nueva, y eso dejó de ser
      // cierto: la Function de DEC-7d escribe la imagen optimizada **encima de
      // este objeto**. Marcarlo `immutable` ahora sería pedirle al CDN y al
      // navegador que se queden un año con los bytes que están por ser
      // reemplazados, y un `immutable` es literal.
      //
      // El razonamiento completo y el modo de falla están en `CACHE_AL_SUBIR`.
      cacheControl: CACHE_AL_SUBIR,
    });
    const url = await getDownloadURL(destino);
    return {
      id,
      url,
      epigrafe: '',
      origen: 'propia',
      storagePath: ruta,
      ...(medida ?? {}),
      // La portada la decide el llamador, que es el que sabe si la lista estaba
      // vacía. Nace en `false` y `GaleriaEditor` la corrige al agregar la fila.
      portada: false,
    };
  } catch {
    // El mensaje del SDK ("storage/unauthorized") no está escrito para nadie.
    throw new ImagenRechazada(
      'No se pudo subir la imagen. Fijate la conexión y volvé a intentar; si sigue ' +
        'fallando, probá con una imagen más chica.',
      'red',
    );
  }
};
