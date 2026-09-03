/**
 * B-221 — barrido periódico que borra las imágenes propias que quedan
 * huérfanas en Storage: la fila salió de la galería, o la actividad se borró,
 * y nadie más referencia ese objeto.
 *
 * La decisión de qué borrar es pura y vive en `limpieza-imagenes.js` —
 * incluido el porqué esto no es la trampa 12. Acá solo se junta lo que hace
 * falta para decidir (los objetos del bucket, los `storagePath` en uso) y se
 * ejecuta lo que la decisión dice.
 *
 * ── Por qué `onSchedule` y no un trigger de Firestore ──────────────────────
 * Un `onDocumentWritten` en `actividades/{id}` sabría que UNA fila de galería
 * se sacó, pero no alcanza solo: la actividad también se puede **borrar**
 * entera (`onDocumentDeleted`, que sería un segundo trigger) y una subida
 * abandonada nunca llega a escribir ningún documento. `onSchedule` cubre los
 * tres casos con un solo trigger, a costa de que un huérfano tarde hasta un
 * día en limpiarse — aceptable: B-221 dice explícito que "el problema no
 * crece solo" y "sigue costando centavos".
 */
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions/v2';
import { getStorage } from 'firebase-admin/storage';
import { getFirestore } from 'firebase-admin/firestore';
import { PREFIJO_MINIATURAS, PREFIJO_ORIGINALES } from './imagenes.js';
import {
  decidirLimpieza,
  MAX_BORRADOS_POR_CORRIDA,
  referenciasEnUso,
} from './limpieza-imagenes.js';

/** Los objetos de primer nivel bajo los dos prefijos, con su fecha de creación. */
export const objetosDelBucket = async (bucket) => {
  const [originales] = await bucket.getFiles({ prefix: PREFIJO_ORIGINALES });
  const [miniaturas] = await bucket.getFiles({ prefix: PREFIJO_MINIATURAS });
  return [...originales, ...miniaturas].map((archivo) => ({
    nombre: archivo.name,
    creado: archivo.metadata?.timeCreated ? new Date(archivo.metadata.timeCreated).getTime() : NaN,
    archivo,
  }));
};

export const limpiarImagenesHuerfanas = onSchedule(
  {
    // Mismas opciones explícitas que `optimizarImagen` y por el mismo motivo
    // (D-35): en ESM los imports corren antes de que `setGlobalOptions` de
    // `index.js` haya tenido oportunidad de ejecutarse.
    region: 'southamerica-east1',
    schedule: 'every 24 hours',
    timeZone: 'America/Argentina/Buenos_Aires',
    serviceAccount: 'calendar-sync@agenda-literaria.iam.gserviceaccount.com',
    // Necesita los mismos permisos de Storage que `optimizarImagen` — ver
    // `docs/08-operacion.md` § «Permisos que necesita `optimizarImagen`» — más
    // `storage.objects.delete`, que `roles/storage.objectUser` ya incluye.
    memory: '256MiB',
    timeoutSeconds: 300,
  },
  async () => {
    const db = getFirestore();
    const bucket = getStorage().bucket();

    const [referenciados, objetos] = await Promise.all([
      referenciasEnUso(db),
      objetosDelBucket(bucket),
    ]);

    const { aBorrar, motivos } = decidirLimpieza({
      objetos: objetos.map(({ nombre, creado }) => ({ nombre, creado })),
      referenciados,
      ahora: Date.now(),
    });

    if (aBorrar.length === 0) {
      logger.debug('barrido de huérfanas: nada para borrar', {
        revisados: objetos.length,
        referenciados: referenciados.size,
      });
      return;
    }

    const porNombre = new Map(objetos.map((o) => [o.nombre, o.archivo]));
    let borrados = 0;
    for (const nombre of aBorrar) {
      try {
        await porNombre.get(nombre)?.delete();
        borrados += 1;
        logger.info('imagen huérfana borrada', { nombre, motivo: motivos[nombre] });
      } catch (e) {
        // Una que falla no puede cortar el barrido de las demás — mismo
        // criterio que el resto de las Functions con un loop de operaciones.
        logger.error('no se pudo borrar una imagen huérfana', { nombre, error: e?.message });
      }
    }

    const pendientesPorTope = Object.values(motivos).filter((m) =>
      m.endsWith('-pendiente-por-tope'),
    ).length;
    if (pendientesPorTope > 0) {
      logger.warn('el barrido se cortó por el tope de la corrida', {
        borrados,
        pendientesPorTope,
        tope: MAX_BORRADOS_POR_CORRIDA,
      });
    } else {
      logger.info('barrido de huérfanas terminado', {
        borrados,
        revisados: objetos.length,
        referenciados: referenciados.size,
      });
    }
  },
);
