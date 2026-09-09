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
import { CACHE_AL_SUBIR, nuevaImagenId } from '@/lib/imagenes';
import {
  ORIENTACION_DERECHA,
  dimensiones,
  orientacionExif,
  esDelTipoDeclarado,
  esTipoSubible,
  motivoDeSubidaFallida,
  quedanMetadatos,
  rutaDeImagen,
  sinMetadatos,
  validarArchivo,
} from '@/lib/imagenes-archivo';
import type { MotivoImagen } from '@/lib/analytics-eventos';
import type { TipoSubible } from '@/lib/imagenes-archivo';
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
/**
 * Lo que la subida devuelve: la fila, y **un aviso si hay algo que decir**.
 *
 * B-324 — el dueño eligió «solo avisar en el panel cuando la foto viene rotada»
 * de las tres salidas que el ítem planteaba. La subida sale bien igual: esto no
 * es un rechazo, es información que la persona necesita **antes** de publicar.
 */
export interface Subida {
  imagen: Imagen;
  /**
   * El valor del tag `Orientation` que traía el archivo, cuando **no era 1**.
   * `null` es «venía derecha» o «no se pudo leer», que para un aviso son lo
   * mismo: no se dice nada.
   */
  orientacion: number | null;
}

/**
 * **La imagen de una propuesta pasa a ser una de la galería** — B-830 paso 8,
 * DEC-11, decisión del dueño del 2026-09-09 sobre las dos alternativas.
 *
 * Baja el objeto de `propuestas/` y lo vuelve a subir por `subirImagen`, que es
 * el camino de siempre: valida tipo y tamaño, verifica que adentro sea lo que
 * dice ser, **saca los metadatos** —la foto de un taller en una casa lleva las
 * coordenadas de esa casa, y esta vez la mandó alguien de afuera— y deja que el
 * trigger de optimización haga lo suyo, porque el destino sí está en su prefijo.
 *
 * ── Por qué re-subir y no copiar del lado del servidor ────────────────────
 * Copiar entre prefijos es una operación de Storage que solo puede hacer el
 * Admin SDK, o sea una Function; y esa Function tendría que **escribir la
 * actividad** para agregarle la imagen. Eso mete un segundo dueño en
 * `imagenes[]` —la clase de B-80: el panel puede pisar lo que la máquina
 * escribió— y agrega un write-back a `/actividades` que dispara los dos triggers
 * que ya escuchan ahí. Re-subir desde el panel cuesta un viaje de ida y vuelta
 * de hasta 3 MB en la máquina del admin y no agrega ninguna pieza: la imagen
 * entra en el formulario **antes** de guardar, así que la actividad nace con
 * ella.
 *
 * El objeto viejo **no se borra acá**. Se lo lleva el ciclo de la propuesta:
 * si se acepta, la retención lo borra con el documento a los 30 días; si se
 * rechaza, el trigger lo borra en el acto. Borrarlo desde el panel además no se
 * puede —`storage.rules` cierra el `delete` para todo cliente—, y es a propósito:
 * así el borrado es consecuencia del estado y no de que alguien se acuerde.
 */
/**
 * La URL para **mirar** el flyer que mandaron con una propuesta.
 *
 * Existe aparte de la promoción porque la bandeja la necesita antes de decidir:
 * el admin mira la foto y recién ahí acepta o rechaza. `storage.rules` deja el
 * `get` solo para un admin, así que esto falla sin sesión — y falla también
 * cuando el objeto ya no está, que es lo que pasa con una propuesta rechazada
 * (la imagen se borra en el acto, DEC-11).
 *
 * **Lo que devuelve es una capability, no una vista con sesión.** El token que
 * acuña `getDownloadURL()` sirve el objeto sin volver a evaluar las reglas, así
 * que esta URL lee el flyer para cualquiera que la tenga. Es aceptable porque
 * solo se acuña adentro del panel y el objeto tiene fecha de vencimiento, pero no
 * es «nadie puede leerlo»: está dicho en `07-seguridad.md` y anotado como
 * **B-846**.
 */
export const urlDeImagenDePropuesta = (storagePath: string): Promise<string> =>
  getDownloadURL(ref(storage(), storagePath));

export const promoverImagenDePropuesta = async (storagePath: string): Promise<Subida> => {
  const origen = ref(storage(), storagePath);
  const url = await getDownloadURL(origen);
  const respuesta = await fetch(url);
  if (!respuesta.ok) {
    throw new ImagenRechazada(
      'No se pudo traer la imagen que mandaron con la propuesta.',
      'red',
    );
  }
  const bytes = await respuesta.blob();
  /*
   * El `type` sale del blob y no del path: es lo que el bucket guardó como
   * `contentType`, o sea el mismo dato que `storage.rules` validó al subirlo.
   * Derivarlo de la extensión sería una tercera derivación del mismo hecho.
   */
  const archivo = new File([bytes], storagePath, { type: bytes.type });
  return subirImagen(archivo, nuevaImagenId());
};

export const subirImagen = async (
  archivo: File,
  id: string,
  /**
   * Dónde va el objeto. Por default, la galería de una actividad
   * (`imagenes/<id>.<ext>`).
   *
   * **Entra por parámetro desde B-830 paso 9**, cuando apareció el segundo
   * destino: el flyer que manda alguien desde `/proponer` va a `propuestas/`, que
   * no es público y que el trigger de optimización ignora. Lo que **no** cambia
   * es el pipeline —validar el tipo y el tamaño, verificar que el archivo sea por
   * dentro lo que dice, y sacarle los metadatos—, y esa es toda la razón de
   * generalizar en vez de escribir una subida nueva y más simple del otro lado:
   * la foto de un taller en una casa lleva las coordenadas de esa casa, y quien
   * la manda no lo sabe. Dos subidas serían dos pipelines, y el segundo nacería
   * sin la parte que importa.
   */
  comoRuta: (imagenId: string, tipo: TipoSubible) => string = rutaDeImagen,
): Promise<Subida> => {
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

  /*
   * **Antes de `sinMetadatos`, que es lo único que hace que esto sea posible** —
   * B-324. El tag `Orientation` viaja adentro del APP1, y `sinMetadatos` tira ese
   * bloque entero sin rotar los píxeles: después de esta línea el dato no existe
   * más. Leerlo acá cuesta un recorrido del JPEG y es lo único que el aviso
   * necesita.
   *
   * Se lee del **crudo** y no del limpio a propósito, y el orden de las dos
   * líneas es la decisión: invertirlas daría `null` siempre y el aviso nunca
   * saldría, sin que nada se pusiera rojo.
   */
  const orientacion = orientacionExif(tipo, crudo);

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
  const ruta = comoRuta(id, tipo);

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
      // `orientacion` viaja **al lado** de la imagen y no adentro: no es un campo
      // del modelo —no se guarda ni se publica— es una observación sobre el
      // archivo que se acaba de subir, y solo le sirve a la pantalla.
      orientacion: orientacion === ORIENTACION_DERECHA ? null : orientacion,
      imagen: {
      id,
      url,
      epigrafe: '',
      // B-301 — vacío, como el epígrafe: lo escribe una persona en el editor, no
      // la subida. Nace presente para que la fila tenga siempre la misma forma.
      textoAlternativo: '',
      origen: 'propia',
      storagePath: ruta,
      ...(medida ?? {}),
      // La portada la decide el llamador, que es el que sabe si la lista estaba
      // vacía. Nace en `false` y `GaleriaEditor` la corrige al agregar la fila.
      portada: false,
      },
    };
  } catch (e) {
    // El `message` crudo del SDK no está escrito para nadie, pero el `code`
    // (`storage/unauthorized`, etc.) es un enum estable que sí se traduce a un
    // motivo — B-590. Antes acá se tiraba siempre «fijate la conexión», falso
    // cuando el problema era permiso o sesión vencida.
    const code = (e as { code?: string } | null)?.code;
    const { mensaje, causa } = motivoDeSubidaFallida(code);
    throw new ImagenRechazada(mensaje, causa);
  }
};
