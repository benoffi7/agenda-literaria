/**
 * **Convertir una propuesta con foto, de punta a punta** — B-1235, contra los
 * emuladores.
 *
 * ── Por qué este archivo existe, y por qué no existía antes ───────────────
 * B-1235 fue un bug que **toda la suite daba por bueno**: la foto de una
 * propuesta aceptada no llegaba nunca a la actividad, y los tests de cada tramo
 * estaban en verde. Podían estarlo porque ninguno ejecutaba
 * `promoverImagenDePropuesta`: el del panel la mockea (`propuestas-panel.render`),
 * el del borrado del original va por el Admin SDK (`propuestas-imagen.integracion`),
 * y el resto de la cadena es puro. Entre el mock y el Admin SDK quedaba justo la
 * función que fallaba.
 *
 * Acá se ejecuta de verdad: se escribe un flyer en `propuestas/` como lo deja la
 * callable, se promueve con el **SDK de cliente**, se guarda la actividad, se
 * **relee** —que es el gesto con el que el dueño encontró el bug: «reabrí la
 * actividad y el campo está vacío»— y se acepta la propuesta para ver que el
 * original se va y la copia queda.
 *
 * ── Lo que este archivo NO puede probar, y hay que decirlo ────────────────
 * **El CORS, que era la causa.** El `fetch` de `promoverImagenDePropuesta` fallaba
 * en el navegador porque la descarga (`alt=media`) no traía
 * `Access-Control-Allow-Origin`; el emulador no aplica el CORS del bucket y Node
 * no lo evalúa, así que acá pasa igual con el arreglo y sin él. Eso se verifica
 * contra el bucket de producción —`curl -H 'Origin: https://agendaleh.ar'` sobre
 * una imagen del `events.json`, que tiene que responder con el header— y es lo que
 * quedó escrito en B-1235a.
 *
 * O sea que estas dos redes son complementarias y ninguna sustituye a la otra:
 * **la de acá cubre la cadena, la de allá cubre el permiso del navegador.**
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { signInWithCustomToken } from 'firebase/auth';
import { tokenDe } from './fixtures/credenciales-del-emulador';
import { auth } from '@/lib/firebase-client';
import { adminBucket, adminDb } from '@/lib/firebase-admin';
import { promoverImagenDePropuesta } from '@/lib/subir-imagen';
import { crearActividad, documentoAForm, leerActividad } from '@/lib/actividades';
import { formVacio } from '@/lib/formulario/estadoInicial';
import { borrarOriginalAlAceptar, decidirBorradoDeImagen } from '../functions/propuestas.js';
import {
  PROJECT_ID,
  cargarReglas,
  cargarReglasStorage,
  emuladorStorageVivo,
  emuladorVivo,
} from './emulador';

const vivo = (await emuladorVivo()) && (await emuladorStorageVivo());

const UID = 'uid_admin_conversion';
const ORIGINAL = `propuestas/prop_conversion_${PROJECT_ID}.jpg`;
const PROPUESTA = `p_conversion_${PROJECT_ID}`;

/**
 * Un JPEG **de verdad**, y no los cuatro bytes de `jpegDeMentira`.
 *
 * Tiene que serlo: el camino que se prueba pasa por `prepararImagen`, que
 * verifica la firma del archivo, le saca los metadatos y le mide las
 * dimensiones. Con un `ffd8 ffd9` pelado la promoción también saldría, pero sin
 * `ancho`/`alto` — o sea probando menos de lo que el nombre del archivo promete.
 * Se genera con el `sharp` de `functions/`, que es el mismo que produce el
 * objeto real en `propuestas/`.
 */
const flyerDeVerdad = async (): Promise<Buffer> => {
  const { createRequire } = await import('node:module');
  const require = createRequire(`${process.cwd()}/functions/index.js`);
  const sharp = require('sharp');
  return sharp({
    create: { width: 600, height: 800, channels: 3, background: { r: 200, g: 60, b: 40 } },
  })
    .jpeg()
    .toBuffer();
};

describe.skipIf(!vivo)('convertir una propuesta con foto — B-1235', () => {
  beforeAll(async () => {
    await cargarReglas(`${process.cwd()}/firestore.rules`);
    await cargarReglasStorage(`${process.cwd()}/storage.rules`);
    await signInWithCustomToken(auth(), await tokenDe(UID, { admin: true }, { etiqueta: 'conv' }));
  });

  it('la foto viaja de la propuesta a la actividad y el original se borra', async () => {
    // ── 1. El flyer que mandó un tercero, como lo deja la callable ──────
    const bytes = await flyerDeVerdad();
    await adminBucket()
      .file(ORIGINAL)
      .save(bytes, {
        contentType: 'image/jpeg',
        metadata: {
          metadata: { saneada: '1', firebaseStorageDownloadTokens: 'token-de-prueba' },
        },
      });
    expect((await adminBucket().file(ORIGINAL).exists())[0]).toBe(true);

    // ── 2. «Sí, usarla»: la promoción que fallaba por CORS en el navegador ──
    const { imagen } = await promoverImagenDePropuesta(ORIGINAL);
    console.log('imagen promovida:', JSON.stringify(imagen));
    expect(imagen.storagePath?.startsWith('imagenes/')).toBe(true);
    expect((await adminBucket().file(imagen.storagePath!).exists())[0]).toBe(true);

    // ── 3. El formulario se guarda con esa imagen como portada ──────────
    const form = {
      ...formVacio(),
      tipo: 'taller',
      titulo: 'Taller que vino de una propuesta con foto',
      slug: `taller-de-propuesta-con-foto-${Date.now()}`,
      descripcion:
        'Cuatro encuentros para escribir crónica, con lecturas y consignas por semana.',
      arancel: { tipo: 'gratis', notas: '', monto: null },
      sesiones: [
        { ...formVacio().sesiones[0]!, inicio: '2026-11-05T19:00', fin: '2026-11-05T21:00' },
      ],
      imagenes: [{ ...imagen, portada: true }],
    } as never;
    const actividadId = await crearActividad(form, UID);

    // ── 4. Reabrir la actividad: el campo «Flyer e imágenes» NO está vacío ──
    const guardada = await leerActividad(actividadId);
    const galeria = documentoAForm(guardada!).imagenes;
    console.log('galería al reabrir:', JSON.stringify(galeria));
    expect(galeria).toHaveLength(1);
    expect(galeria[0]!.storagePath).toBe(imagen.storagePath);
    expect(galeria[0]!.portada).toBe(true);

    // ── 5. Aceptar la propuesta: el original se va, la copia queda ──────
    await adminDb()
      .doc(`propuestas/${PROPUESTA}`)
      .set({ imagen: { storagePath: ORIGINAL }, estado: 'aceptada', revision: { actividadId } });
    const decision = decidirBorradoDeImagen({
      before: { estado: 'nueva', imagen: { storagePath: ORIGINAL } },
      after: {
        estado: 'aceptada',
        imagen: { storagePath: ORIGINAL },
        revision: { actividadId },
      },
    });
    console.log('decisión del trigger:', JSON.stringify(decision));
    const resultado = await borrarOriginalAlAceptar(adminDb(), adminBucket(), {
      objeto: decision.objeto,
      actividadId: decision.actividadId,
    });
    console.log('resultado del borrado:', resultado);
    expect(resultado).toBe('borrado');
    expect((await adminBucket().file(ORIGINAL).exists())[0]).toBe(false);
    expect((await adminBucket().file(imagen.storagePath!).exists())[0]).toBe(true);

    // Limpieza. Va al final del `it` y no en un `afterAll` porque los nombres
    // dependen del id que la promoción generó: sin la copia a mano, el barrido
    // de huérfanas no la tocaría hasta 72 horas después (B-221).
    await adminBucket().file(imagen.storagePath!).delete({ ignoreNotFound: true });
    /*
     * **`recursiveDelete` y no `delete`** — la clase de B-89, y acá la
     * introduciríamos nosotros: con el emulador de Functions vivo, guardar y
     * borrar esta actividad deja una versión en `actividades/{id}/versiones`, y
     * un `delete()` del padre la dejaría como **subcolección huérfana**. Eso es
     * basura que sobrevive a este test y que otro archivo —el de B-89, que
     * justamente busca huérfanas— puede levantar como suya.
     */
    await adminDb().recursiveDelete(adminDb().doc(`actividades/${actividadId}`));
    await adminDb().doc(`propuestas/${PROPUESTA}`).delete();
  }, 60000);
});
