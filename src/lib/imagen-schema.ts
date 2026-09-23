import { z } from 'zod';

/**
 * El schema de una fila de la galería, **uno solo para todo el proyecto** —
 * B-906.
 *
 * Lo usan la actividad (`src/lib/schema.ts`, que lo reexporta) y las cuatro
 * fichas de la Guía (`libreria-schema.ts`, `suscripcion-literaria-schema.ts`,
 * `lugar-schema.ts`, `biblioteca-schema.ts`). Hasta B-906 cada ficha tenía su
 * propia derivación porque la de `schema.ts` era privada del módulo: eran cinco
 * versiones de la misma forma, la clase de B-88 —un campo nuevo de `Imagen`
 * entraba en una y no en las otras sin que nada se pusiera rojo—.
 *
 * **Vive en un módulo aparte, y no en `schema.ts`, por el bundle público.** Los
 * formularios de «sumá una ficha» del sitio (`SumarLibreria`, `SumarLugar`,
 * `SumarSuscripcion`, `SumarBiblioteca`) importan el schema de su ficha; si ese
 * schema importara `schema.ts`, el sitio cargaría el schema entero de la
 * actividad con todo lo que arrastra (`arancel`, `modalidades`, `duplicar`,
 * `sesiones`, `@calendario`) — zod construye los schemas al cargar el módulo, así
 * que nada de eso se cae por tree-shaking. Este archivo depende solo de `zod` y
 * tiene que seguir así.
 *
 * Un test de `tests/clases-de-bug.test.ts` frena la sexta copia: ningún archivo
 * de `src/` fuera de este puede validar el prefijo `img_` por su cuenta.
 */

const texto = z.string().trim();
const opcional = texto.default('');

/**
 * El mensaje del id de imagen (trampa 2). Lo usan dos reglas —el prefijo, acá, y
 * los ids repetidos, en el `superRefine` de la actividad— y por eso se exporta
 * en vez de escribirse dos veces (B-816).
 */
export const MENSAJE_ID_IMAGEN = 'El id de imagen debe venir de nuevaImagenId()';

/**
 * Una fila de la galería (B-167). Las reglas de forma van en los dos niveles: son
 * las que harían ilegible el documento, no las que lo harían incompleto.
 *
 * `epigrafe` es opcional a propósito (DEC-7a): es un pie de foto, no el texto
 * alternativo — ese es `textoAlternativo`, y **también es opcional**: B-301 /
 * D-440 lo había hecho obligatorio en la portada al publicar, y el dueño sacó ese
 * bloqueo el 2026-09-07. El campo sigue existiendo, se guarda y se edita; lo que
 * no hace es impedir publicar. El motivo largo está donde estaba el
 * `superRefine`, en el nivel «publicar».
 */
export const imagenSchema = z.object({
  id: z.string().regex(/^img_/, MENSAJE_ID_IMAGEN),
  url: texto.min(1, 'Falta la dirección de la imagen'),
  epigrafe: opcional,
  /*
   * B-301 — acá va sin regla: el campo es una cadena en las dos filas y en los
   * dos niveles. La obligatoriedad es **condicional** —solo la portada, solo al
   * publicar— y por eso vive en el `superRefine`, como los condicionales del §11
   * y por el mismo motivo: en el tipo no se puede escribir «obligatorio si esta
   * fila es la portada», y un `.min(1)` acá dejaría inguardable cualquier
   * borrador con una imagen a medio cargar.
   */
  textoAlternativo: opcional,
  origen: z.enum(['externa', 'propia']),
  // `storagePath` no se valida contra un formato: atarlo a un patrón acá haría
  // que un cambio del lado del servidor rompa el guardado del panel.
  //
  // **Quién lo escribe ya está decidido (B-206 #2).** Lo escribe la subida del
  // panel, y mañana lo va a reescribir la Function de DEC-7d. Para que eso no sea
  // `calendarEventId` dentro de `sesiones` otra vez, `formADocumento` **enumera**
  // las claves de cada imagen en vez de spreadear la fila, y `functions/
  // historial.js` lo declara en `CAMPOS_DE_MAQUINA_IMAGEN`.
  storagePath: z.string().optional(),
  ancho: z.number().optional(),
  alto: z.number().optional(),
  portada: z.boolean().default(false),
});
