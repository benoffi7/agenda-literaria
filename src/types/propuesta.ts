/**
 * Propuestas de organizadores — `/propuestas/{id}`.
 *
 * Las carga **cualquiera, sin login**, desde `/proponer`, y un admin las valida
 * en una bandeja del panel antes de que existan como actividad
 * (`docs/prd/01-propuestas-de-organizadores.md`). Es la **primera colección del
 * proyecto que acepta una escritura anónima**: hasta acá `firestore.rules` era
 * tajante —sin el claim `admin` no hay `write`— y eso está fijado en
 * `tests/escritura-anonima.integracion.test.ts`.
 *
 * ── Una propuesta no es una actividad, y el tipo lo dice ───────────────────
 * No es un borrador de `Actividad` con menos campos: es **lo que alguien pidió**,
 * y queda como prueba de eso. Por eso el vocabulario es más chico y más simple
 * que el del modelo —`'las-dos'` en vez de `'hibrido'`, tres aranceles en vez de
 * la taxonomía entera, una sola imagen— y por eso un admin **no puede editar su
 * contenido**: si hay que corregir el título, se corrige en la actividad que sale
 * de ella. La traducción de este vocabulario al del modelo la hace el admin al
 * convertir, y vive en `src/lib/propuestas.ts`.
 *
 * Nombres en español, como el resto del modelo (§14).
 */
import type { TimestampLike } from '@/types/actividad';

/**
 * Ciclo de vida. `nueva` lo **fuerza la regla** en la creación: si lo decidiera
 * el cliente, un `curl` marcaría su propia propuesta como aceptada.
 */
export const ESTADOS_PROPUESTA = ['nueva', 'en-revision', 'aceptada', 'rechazada'] as const;
export type EstadoPropuesta = (typeof ESTADOS_PROPUESTA)[number];

/**
 * Cómo se cursa, en el vocabulario del formulario público.
 *
 * **`'las-dos'` y no `'hibrido'`**, que es el valor del modelo (`MODALIDADES`).
 * No es descuido: «híbrido» es jerga y quien completa el formulario no la usa.
 * La traducción la hace la conversión a actividad, en un solo lugar.
 */
export const MODALIDADES_PROPUESTA = ['presencial', 'virtual', 'las-dos'] as const;
export type ModalidadPropuesta = (typeof MODALIDADES_PROPUESTA)[number];

/**
 * Los aranceles que el formulario público ofrece: **solo los tres `fijo: true`**
 * de `/opciones/arancel` (§4.1), y nada más.
 *
 * Está escrito acá y no derivado de `opciones-base.json` a propósito: derivarlo
 * haría que una cuarta opción base **ensanche sola** lo que un anónimo puede
 * mandar, y eso tiene que ser una decisión. `tests/propuestas.test.ts` ata las
 * dos listas en las dos direcciones, así que la cuarta pone el test en rojo y
 * alguien decide — que es lo contrario de que entre sin que nadie mire.
 *
 * El motivo de fondo es el del § 4.2 del PRD: `'beca-parcial'` y las que vengan
 * se eligen **desde el panel**, porque una opción nueva se crea con «Otro» y
 * `/opciones/*` es de lectura pública y viaja al `events.json`.
 */
export const ARANCELES_PROPUESTA = ['gratis', 'a-la-gorra', 'arancelado'] as const;
export type ArancelPropuesta = (typeof ARANCELES_PROPUESTA)[number];

/**
 * Por dónde escribirle a quien propuso. **Interno: no sale nunca** (§5.1 del
 * `CLAUDE.md`, y § 7 del PRD).
 *
 * `'instagram'` está y en `VIAS_INSCRIPCION` del modelo se llama `'dm'`: acá el
 * canal se nombra como lo nombra quien lo usa.
 */
export const VIAS_CONTACTO_PROPUESTA = ['mail', 'whatsapp', 'instagram'] as const;
export type ViaContactoPropuesta = (typeof VIAS_CONTACTO_PROPUESTA)[number];

/** De dónde entró. Un admin también puede cargar una propuesta a mano. */
export const ORIGENES_PROPUESTA = ['formulario-publico', 'panel'] as const;
export type OrigenPropuesta = (typeof ORIGENES_PROPUESTA)[number];

/*
 * ── Los topes ─────────────────────────────────────────────────────────────
 *
 * **Cada uno está dicho en tres lugares y tiene que ser el mismo número**: acá,
 * en el schema de zod y en `firestore.rules`. Es el patrón de
 * `TOPE_TITULO_REPORTE` (B-364), y acá importa más que allá: del otro lado del
 * formulario hay un anónimo, así que el tope de la **regla** es el único que no
 * se puede saltear —el del schema y el del `maxLength` los saltea un `curl`—.
 *
 * `firestore.rules` es un runtime aparte y no puede importar TypeScript, así que
 * ese lado lo ata un test que lee el archivo y compara los números:
 * `tests/propuestas.test.ts`.
 */

/** Igual que el del reporte, y por lo mismo: es un título. */
export const TOPE_TITULO_PROPUESTA = 120;
/**
 * El id de la actividad que salió de la propuesta (`act_<uuid>`), que escribe un
 * admin al aceptarla.
 *
 * Tiene su propia constante y no reusa `TOPE_CORTO_PROPUESTA` aunque valga lo
 * mismo: son cotas de cosas distintas y el día que una se mueva no tiene por qué
 * mover la otra. Lo señaló el `auditor-trampas` — era el único número de la regla
 * que no estaba declarado en ninguna parte, así que cambiarlo o borrarlo no
 * ponía nada en rojo.
 */
export const TOPE_ACTIVIDAD_ID_PROPUESTA = 200;
export const TOPE_DESCRIPCION_PROPUESTA = 4000;
/** El texto libre de «qué incluye» que el admin decide si promueve (§4.2). */
export const TOPE_INCLUYE_OTRO_PROPUESTA = 200;
/** Nombre del lugar, dirección, barrio, nombre de quien organiza, notas. */
export const TOPE_CORTO_PROPUESTA = 200;
/** «Escribime por WhatsApp al…», el `comoDice` de la inscripción. */
export const TOPE_INSCRIPCION_PROPUESTA = 500;
/** El valor del contacto: un mail, un teléfono o un handle. */
export const TOPE_CONTACTO_PROPUESTA = 200;
/** El motivo del rechazo, que escribe un admin y no sale nunca. */
export const TOPE_MOTIVO_PROPUESTA = 500;
/** La URL de la imagen, si se pega en vez de subirse. */
export const TOPE_URL_PROPUESTA = 500;

/**
 * Cuántas fechas y cuántos «incluye» se aceptan.
 *
 * Doce fechas cubre un ciclo semanal de tres meses, que es el más largo que el
 * circuito produce. El techo existe porque **el cliente se saltea**: sin él, un
 * array de 5000 filas es un documento de Firestore de 1 MB escrito por un
 * anónimo (§ 2 del `prd/README.md`).
 */
export const MAX_FECHAS_PROPUESTA = 12;
export const MAX_INCLUYE_PROPUESTA = 12;

/*
 * ── Y los mínimos ─────────────────────────────────────────────────────────
 *
 * Van declarados por lo mismo que los topes: la regla los repite, y un número
 * suelto en `firestore.rules` que no esté declarado acá no se puede atar — o sea
 * que cambiarlo no pone nada en rojo. Es la mitad que le faltaba al patrón de
 * B-364, y la señaló el `auditor-trampas`.
 */
export const MIN_TITULO_PROPUESTA = 6;
export const MIN_DESCRIPCION_PROPUESTA = 15;
export const MIN_ORGANIZADOR_PROPUESTA = 2;
export const MIN_CONTACTO_PROPUESTA = 3;
/** Una fecha, y una imagen que no sea la cadena vacía. */
export const MIN_FECHAS_PROPUESTA = 1;
export const MIN_NO_VACIO_PROPUESTA = 1;

/**
 * Una fecha propuesta. **Strings, no `Timestamp`** — desvío deliberado del §3.2
 * del `CLAUDE.md`, razonado en D-590 y en el § 4.1 del PRD.
 *
 * En una línea: un `Timestamp` armado en el navegador de un **anónimo** lleva su
 * zona horaria (la trampa 1, sin poder suponer nada de su reloj), y
 * `'aaaa-mm-dd'` + `'hh:mm'` se valida en la regla con un `matches` mientras un
 * `Timestamp` solo se valida por tipo. La conversión con
 * `America/Argentina/Buenos_Aires` explícito pasa a ocurrir **una vez y del lado
 * del admin**, al convertir, que es donde el proyecto ya la hace bien.
 */
export interface FechaPropuesta {
  /** `aaaa-mm-dd`. */
  dia: string;
  /** `hh:mm`, 24 horas. */
  desde: string;
  /** `hh:mm`. `null` = no lo sabe; lo completa el admin. */
  hasta: string | null;
}

/**
 * La imagen, si vino: **una URL de afuera o un objeto de nuestro bucket, nunca
 * las dos** (DEC-11 — el dueño pidió poder subir el archivo, no solo pegar el
 * link).
 *
 * El prefijo `propuestas/` de Storage, su borrado al rechazar y la promoción a
 * `imagenes/` al aceptar son de la tajada siguiente; acá está la **forma**, que
 * es lo que la regla tiene que poder validar.
 */
export type ImagenPropuesta = { url: string } | { storagePath: string };

export interface Propuesta {
  titulo: string;
  descripcion: string;
  fechas: FechaPropuesta[];
  modalidad: ModalidadPropuesta;
  /** `null` si es solo virtual. */
  lugar: { nombre: string; direccion: string; barrio: string } | null;
  organizador: { nombre: string; instagram: string | null };
  arancel: { tipo: ArancelPropuesta; notas: string | null };
  /** `comoDice` es cómo lo explicaría quien propone: «escribime al DM». */
  inscripcion: { requiere: boolean; comoDice: string | null };
  /**
   * Slugs que **ya existen** en `/opciones/incluye-actividad`. El formulario
   * público no puede crear una opción (§4.2 del PRD): sería dejar que cualquiera
   * escriba en una colección de lectura pública que viaja al `events.json`.
   */
  incluye: string[];
  /**
   * Lo que no estaba en la lista, como **texto libre**. No crea ninguna opción:
   * el admin decide si merece entrar a la taxonomía, y entonces sí corre por
   * `upsertOpcion` con su slugify (trampa 6).
   */
  incluyeOtro: string | null;
  imagen: ImagenPropuesta | null;

  // ── interno, no sale nunca ───────────────────────────────────────────────
  /**
   * Cómo repreguntarle a quien propuso. **Es el primer dato personal de un
   * tercero que el proyecto guarda** —B-102 decía que no guardaba ninguno— y se
   * reabre a propósito: sin forma de repreguntar, la bandeja no sirve (§ 7 del
   * PRD). Nunca sale a ninguna salida pública, tiene su fila en
   * `docs/07-seguridad.md` y su retención a 30 días (DEC-13, B-838).
   */
  contacto: { via: ViaContactoPropuesta; valor: string };
  /** Lo fuerza la regla en `'nueva'`. */
  estado: EstadoPropuesta;
  /** `request.time`: el cliente no puede antedatar su propuesta. */
  creadoEn: TimestampLike;
  origen: OrigenPropuesta;
  /**
   * Quién la revisó y en qué terminó. Todo en `null` al crearse —lo fuerza la
   * regla— y solo un admin lo mueve.
   */
  revision: {
    porUid: string | null;
    en: TimestampLike | null;
    /** La actividad que salió de acá, si se aceptó. */
    actividadId: string | null;
    /** Por qué se rechazó. Interno. */
    motivo: string | null;
  };
}

export interface PropuestaConId extends Propuesta {
  id: string;
}

/**
 * Una fila de fecha **en el formulario**, donde `hasta` es siempre un string y
 * `''` significa «no lo sé».
 *
 * Es la misma asimetría que `SesionForm` con el documento, y por el mismo
 * motivo: un `<input>` no tiene `null`. `formAPropuesta` traduce el `''` a `null`
 * al armar el documento, que es donde la ausencia tiene que representarse **de
 * una sola forma** para que la regla pueda exigir `== null`.
 */
export interface FechaPropuestaForm {
  dia: string;
  desde: string;
  hasta: string;
}

/** Lo que llena quien propone, en el formulario público. */
export interface PropuestaForm {
  titulo: string;
  descripcion: string;
  fechas: FechaPropuestaForm[];
  modalidad: ModalidadPropuesta;
  lugar: { nombre: string; direccion: string; barrio: string };
  organizador: { nombre: string; instagram: string };
  arancel: { tipo: ArancelPropuesta; notas: string };
  inscripcion: { requiere: boolean; comoDice: string };
  incluye: string[];
  incluyeOtro: string;
  /** `''` = no pegó ninguna. La subida de archivo va aparte. */
  imagenUrl: string;
  contacto: { via: ViaContactoPropuesta; valor: string };
}
