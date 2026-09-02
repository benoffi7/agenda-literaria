import { z } from 'zod';
import { MAXIMO_IMAGENES } from '@/lib/imagenes';
import { filaPideOnline, filaPideSede } from '@/lib/modalidades';
import { esSlugDeCopia } from '@/lib/duplicar';
import {
  ENTREGAS_MATERIAL,
  ESTADOS,
  MODALIDADES,
  TIPOS_MATERIAL,
  VIAS_INSCRIPCION,
} from '@/types/actividad';

/**
 * Validación del formulario de admin (§11), en **dos niveles sobre el mismo
 * schema** (B-183).
 *
 * - **Borrador** — lo mínimo para que el documento exista, se pueda encontrar
 *   después en el listado y sea legible: título, slug, y que cada encuentro que
 *   esté cargado tenga su id de cliente (trampa 2) y fechas convertibles a
 *   `Timestamp` (trampa 1). Nada más. Un borrador es, por definición, lo que
 *   todavía no está completo: es la mitad de la razón por la que el estado
 *   existe.
 * - **Publicar** — todo lo que se exigía antes, que es lo que evita que el sitio
 *   público y el evento de Calendar salgan a medias.
 *
 * **Dos niveles, no dos schemas.** El patrón ya estaba en este archivo aplicado
 * a una regla sola —el slug `-copia`, que solo se bloquea al publicar (trampa
 * 10)—: ahora lo comparten todas las reglas de completitud. Los `superRefine` no
 * cambiaron de contenido, cambiaron de condición. Dos schemas paralelos, en
 * cambio, se desincronizan en el primer campo nuevo, y el que se olvida es
 * siempre el de publicar.
 *
 * **Por qué la línea es `estado === 'publicado'`** y no "borrador vs. el resto":
 * publicado es exactamente lo que sale al sitio y a Calendar. §7.3 borra los
 * eventos de todo lo que no está publicado, y el listado público filtra por ese
 * mismo estado, así que nada de lo que no está publicado puede publicar algo
 * incompleto. `pendiente` y `cancelado` se guardan con el nivel corto a
 * propósito: el bloqueo llega cuando se intenta publicar, que es cuando importa.
 *
 * Lo que el modelo necesita para no corromperse **sigue siendo obligatorio en
 * los dos niveles**: los ids de sesión, las fechas y el formato del slug. Eso no
 * es "completar el formulario", es que el documento sea legible.
 */

const texto = z.string().trim();
const opcional = texto.default('');

/** ¿Este guardado sale al público? Es la línea que separa los dos niveles. */
const publicando = (estado: string): boolean => estado === 'publicado';

/** Una URL válida, para las validaciones que solo corren al publicar. */
const esUrl = (valor: string): boolean => z.string().url().safeParse(valor).success;

/**
 * Los esquemas con los que puede empezar la URL de una imagen: `https`, y
 * `http` **solo contra localhost**, que es el emulador de Storage. Ver el `if`
 * que lo usa, más abajo, para el razonamiento completo.
 */
const ESQUEMA_PERMITIDO = /^(https:\/\/|http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/)/i;

/**
 * Una fila de la galería (B-167). Las reglas de forma van en los dos niveles: son
 * las que harían ilegible el documento, no las que lo harían incompleto.
 *
 * `epigrafe` es opcional a propósito (DEC-7a): es un pie de foto, no el texto
 * alternativo — ese sale del título de la actividad.
 */
const imagenSchema = z.object({
  id: z.string().regex(/^img_/, 'El id de imagen debe venir de nuevaImagenId()'),
  url: texto.min(1, 'Falta la dirección de la imagen'),
  epigrafe: opcional,
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

const sesionSchema = z
  .object({
    id: z.string().regex(/^ses_/, 'El id de sesión debe venir de nuevaSesionId()'),
    // Las fechas se exigen en los dos niveles: `formADocumento` las convierte a
    // `Timestamp` y una cadena vacía tira `Fecha inválida` en el guardado
    // (trampa 1). Un encuentro nuevo nace con fecha y hora puestas
    // (`sesionVacia`), así que esto solo salta si se vació el campo a mano.
    inicio: texto.min(1, 'Falta la fecha de inicio'),
    fin: texto.min(1, 'Falta la fecha de fin'),
    tema: opcional,
    lectura: opcional,
    cancelada: z.boolean().default(false),
    calendarEventId: z.string().nullable().default(null),
  })
  .refine((s) => new Date(s.fin) > new Date(s.inicio), {
    message: 'El encuentro tiene que terminar después de empezar',
    path: ['fin'],
  });

const sedeSchema = z.object({
  nombre: texto,
  direccion: texto,
  barrio: opcional,
  ciudad: opcional,
  indicaciones: opcional,
  // El rango se valida también acá y no solo al pegar el link: una latitud de
  // 200 no existe, y un lat/lng invertido manda el evento al otro lado del
  // mundo. Va en los dos niveles: no es completitud, es un dato roto. El aviso
  // de "esto cae lejos de Argentina" es del formulario, porque no bloquea
  // (lib/coordenadas.ts).
  geo: z
    .object({
      lat: z.number().min(-90, 'Latitud fuera de rango').max(90, 'Latitud fuera de rango'),
      lng: z.number().min(-180, 'Longitud fuera de rango').max(180, 'Longitud fuera de rango'),
    })
    .nullable()
    .default(null),
});

const onlineSchema = z.object({
  plataforma: opcional,
  url: opcional,
  // Por defecto el link NO se publica (§5.1, trampa 5).
  urlPublica: z.boolean().default(false),
});

/**
 * Una fila de modalidad (B-224): una forma de cursar, con su lugar y su ventana.
 *
 * Sigue el molde de `sesionSchema`: las reglas de forma —el id de cliente y que
 * la ventana no esté al revés— van en **los dos niveles**, porque son las que
 * harían ilegible el documento, no las que lo harían incompleto. Que la sede esté
 * completa, en cambio, es completitud y va solo al publicar (abajo).
 *
 * Las dos fechas son opcionales: es lo que pidió el dueño, y `''` es lo que
 * reporta un `<input type="datetime-local">` vacío. Por eso no hay `.min(1)`, a
 * diferencia de las de un encuentro.
 */
const modalidadFilaSchema = z
  .object({
    id: z.string().regex(/^mod_/, 'El id de modalidad debe venir de nuevaModalidadId()'),
    modalidad: z.enum(MODALIDADES),
    inicio: opcional,
    fin: opcional,
    sede: sedeSchema.nullable().default(null),
    online: onlineSchema.nullable().default(null),
  })
  .refine((m) => !m.inicio || !m.fin || new Date(m.fin) > new Date(m.inicio), {
    message: 'La modalidad tiene que terminar después de empezar',
    path: ['fin'],
  });

const itemMaterialSchema = z.object({
  // B-342 — trampa 2: el id se genera en el cliente, nunca por índice.
  id: z.string().regex(/^mat_/, 'El id de material debe venir de nuevaItemMaterialId()'),
  tipo: z.enum(TIPOS_MATERIAL),
  // El título del material se exige al publicar: en el evento, un ítem sin
  // título sale como una línea vacía. A medio cargar puede estar en blanco.
  titulo: opcional,
  url: opcional,
  entrega: z.enum(ENTREGAS_MATERIAL),
  publico: z.boolean().default(false),
});

export const actividadFormSchema = z
  .object({
    // El `tipo` es slug de taxonomía (§4), así que no se cierra a un enum fijo.
    tipo: opcional,
    // El título va en los dos niveles: es lo que hace que el borrador se pueda
    // encontrar en el listado, y de él sale el slug.
    titulo: texto.min(1, 'El título es obligatorio'),
    slug: texto
      .min(1, 'El slug es obligatorio')
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Solo minúsculas, números y guiones'),
    descripcion: opcional,
    // Las URLs se validan al publicar (abajo): a medio escribir, "https://ins" no
    // es una URL y no tiene por qué frenar un borrador.
    imagenes: z.array(imagenSchema).default([]),

    organizador: z.object({
      nombre: opcional,
      instagram: opcional,
      web: opcional,
    }),
    tallerista: z
      .object({ nombre: opcional, bio: opcional, instagram: opcional })
      .nullable()
      .default(null),
    /**
     * DEC-1 — el libro presentado. **No se exige para publicar**, igual que el
     * bloque de autor invitado del §11 con el que aparece y desaparece: una
     * presentación puede publicarse sin el dato cargado, y bloquear el publicado
     * por un campo nuevo dejaría inguardables las presentaciones que ya existen.
     *
     * Va sin `.nullable()`: en el formulario es siempre un objeto de dos textos
     * (`libroVacio()`), y el `null` del documento lo produce `formADocumento`.
     */
    libro: z
      .object({ titulo: opcional, autor: opcional })
      .default({ titulo: '', autor: '' }),

    esCiclo: z.boolean().default(false),
    sesiones: z.array(sesionSchema),

    /**
     * B-224 — las formas de cursar, con su sede o su bloque online adentro.
     *
     * `modalidad`, `sede` y `online` **no están en el formulario**: son campos
     * derivados de esta lista que escribe `formADocumento`, igual que
     * `searchText`. Validarlos acá sería validar dos veces el mismo dato, y la
     * copia se desincroniza.
     */
    modalidades: z.array(modalidadFilaSchema).default([]),

    inscripcion: z.object({
      requiere: z.boolean().default(false),
      via: z.enum(VIAS_INSCRIPCION).nullable().default(null),
      destino: opcional,
      cupo: z.number().int().positive().nullable().default(null),
      cierra: opcional,
      /**
       * B-97 — «se llenó». Va en los dos niveles con default `false` y **sin
       * ninguna regla en `superRefine`**: no es completitud, es un estado que
       * cambia después de publicar. Un borrador puede estar completo, y una
       * actividad completa se sigue pudiendo publicar y editar.
       */
      completo: z.boolean().default(false),
    }),

    arancel: z.object({
      tipo: opcional,
      notas: opcional,
    }),

    material: z.object({
      tiene: z.boolean().default(false),
      items: z.array(itemMaterialSchema).default([]),
    }),

    difusion: z.object({
      arrobar: z.array(texto).default([]),
      notas: opcional,
    }),

    estado: z.enum(ESTADOS),
    tags: z.array(texto).default([]),
    destacado: z.boolean().default(false),
  })
  // ── Nivel «publicar» ──────────────────────────────────────────────
  // Todo lo de acá abajo corre **solo** si el guardado es a `publicado`. Es la
  // completitud del §11: lo que evita que el sitio o el evento salgan a medias.
  .superRefine((v, ctx) => {
    const faltaSiempre = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: 'custom', path, message });

    // Las dos de la galería que van en los DOS niveles (D-120): harían ilegible
    // el documento, no incompleto.
    if (v.imagenes.length > MAXIMO_IMAGENES) {
      faltaSiempre(['imagenes'], `Hasta ${MAXIMO_IMAGENES} imágenes por actividad`);
    }
    // Exactamente una portada, o ninguna si la lista está vacía. Dos portadas
    // hacen que B-107 emita una imagen distinta según el orden de lectura.
    const portadas = v.imagenes.filter((i) => i.portada).length;
    if (v.imagenes.length > 0 && portadas !== 1) {
      faltaSiempre(['imagenes'], 'Elegí una sola imagen como portada');
    }
  })
  .superRefine((v, ctx) => {
    if (!publicando(v.estado)) return;

    const falta = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });

    if (!v.tipo) falta(['tipo'], 'Elegí el tipo de actividad');
    // El mínimo de 3 es de siempre: un título de dos letras publicado es un
    // error de tipeo con URL propia.
    if (v.titulo.length < 3) falta(['titulo'], 'El título es muy corto para publicar');
    if (v.descripcion.length < 10) falta(['descripcion'], 'Escribí una descripción');
    if (!v.organizador.nombre) falta(['organizador', 'nombre'], 'Falta el organizador');
    if (!v.arancel.tipo) falta(['arancel', 'tipo'], 'Elegí el arancel');
    v.imagenes.forEach((img, n) => {
      if (!esUrl(img.url)) {
        falta(['imagenes', String(n), 'url'], 'URL inválida');
        return;
      }
      // `z.string().url()` acepta todo lo que `new URL()` parsee, o sea también
      // `data:` y `javascript:`, y esa URL sale entera al `events.json` y va a
      // terminar en un `<img src>` y en `og:image` (B-107). Y un `http://` pasa
      // la validación y después lo bloquea el contenido mixto en una página
      // `https`: imagen rota en el sitio, sin que nada avise.
      //
      // La excepción de `localhost` es el emulador de Storage, que sirve por
      // `http://127.0.0.1:9199/…`: sin ella, una imagen propia subida en
      // desarrollo no se puede publicar ni siquiera para probar el flujo, que es
      // justo lo que el §10 pide hacer contra emuladores. Lo que la excepción
      // habilita en producción es una URL a `localhost`, o sea una imagen rota en
      // la propia vista previa del panel — no un `data:` ni un `javascript:`, que
      // siguen bloqueados por este mismo `if`.
      if (!ESQUEMA_PERMITIDO.test(img.url)) {
        falta(['imagenes', String(n), 'url'], 'La dirección tiene que empezar con https://');
      }
    });
    if (v.sesiones.length === 0) falta(['sesiones'], 'Cargá al menos un encuentro');

    // B-224 — sin al menos una modalidad no se sabe si la actividad es
    // presencial ni qué bloques pedirle. Se exige solo al publicar, como los
    // encuentros: un borrador puede estar a medio armar.
    if (v.modalidades.length === 0) falta(['modalidades'], 'Elegí al menos una modalidad');

    /*
     * §11 — la sede se pide en presencial e híbrido, y la plataforma en virtual
     * e híbrido. Desde B-224 es **por fila**: cada forma de cursar tiene su
     * lugar, así que una actividad presencial en una sede y virtual por Meet
     * necesita las dos cosas completas y no una sola.
     *
     * La condición es la misma que decide si el bloque se **muestra**
     * (`filaPideSede` / `filaPideOnline`, las que usa el editor): si se
     * separaran, el schema exigiría un campo que no está en pantalla.
     *
     * El `path` lleva el índice de la fila para que el error caiga al lado del
     * control correcto, como en `sesiones.N.fin`.
     */
    v.modalidades.forEach((m, i) => {
      if (filaPideSede(m.modalidad)) {
        if (!m.sede?.nombre) {
          falta(['modalidades', i, 'sede', 'nombre'], 'Una modalidad presencial necesita sede');
        }
        if (!m.sede?.direccion) {
          falta(['modalidades', i, 'sede', 'direccion'], 'Falta la dirección');
        }
      }
      if (filaPideOnline(m.modalidad) && !m.online?.plataforma) {
        falta(['modalidades', i, 'online', 'plataforma'], 'Elegí la plataforma');
      }
    });

    if (v.inscripcion.requiere && !v.inscripcion.via) {
      falta(['inscripcion', 'via'], '¿Por dónde se inscriben?');
    }
    if (v.inscripcion.requiere && !v.inscripcion.destino) {
      falta(['inscripcion', 'destino'], 'Falta el mail, teléfono, handle o URL de inscripción');
    }

    if (v.material.tiene && v.material.items.length === 0) {
      falta(['material', 'items'], 'Agregá al menos un material o destildá la casilla');
    }
    v.material.items.forEach((item, i) => {
      if (!item.titulo) falta(['material', 'items', i, 'titulo'], 'El material necesita un título');
    });

    // Un ciclo con un solo encuentro casi siempre es un olvido (§2.2).
    if (v.esCiclo && v.sesiones.length < 2) {
      falta(['sesiones'], 'Un ciclo tiene más de un encuentro');
    }

    // Trampa 10 — el slug queda inmutable al publicar, así que una URL
    // `…-copia` publicada por descuido no se arregla nunca más sin perder el
    // SEO de esa página. Se bloquea al publicar, no al guardar borrador: la
    // copia nace como borrador con ese slug a propósito.
    if (esSlugDeCopia(v.slug)) {
      falta(['slug'], 'Antes de publicar, cambiá el slug: quedaría fijo con «-copia» en la URL');
    }
  });

export type ActividadFormValues = z.input<typeof actividadFormSchema>;

/** Un rechazo del schema, en la forma en que el formulario lo muestra. */
export interface IssueDeSchema {
  path: readonly (string | number)[];
  message: string;
}

/**
 * Qué le falta a este formulario **para publicar**, sin intentar guardarlo.
 *
 * Es lo que evita que los dos niveles de B-183 se conviertan en una trampa: si
 * el borrador valida con menos, quien carga tiene que poder ver desde el
 * principio lo que le va a faltar al final. Acá es aviso; bloquea recién cuando
 * el estado es `publicado`, y entonces lo devuelve el mismo `safeParse` del
 * guardado.
 */
export const faltaParaPublicar = (form: unknown): IssueDeSchema[] => {
  const r = actividadFormSchema.safeParse(
    typeof form === 'object' && form !== null ? { ...form, estado: 'publicado' } : form,
  );
  return r.success ? [] : r.error.issues.map((i) => ({ path: [...i.path], message: i.message }));
};
