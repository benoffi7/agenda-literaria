/**
 * Validación y armado de una propuesta. Lógica pura: sin Firestore ni
 * navegador, así se testea sin emuladores (`05-patrones.md`).
 *
 * Se valida en el submit con zod, como los otros dos formularios (D-01).
 *
 * ── Lo que este archivo NO es ─────────────────────────────────────────────
 * **No es la defensa.** Del otro lado del formulario hay un anónimo, así que
 * todo lo de acá se saltea con un `curl`: la defensa es `firestore.rules`
 * (`propuestaValida()`), y este schema existe para que la persona vea el error
 * antes de mandar. Los dos dicen los mismos números —importados de
 * `types/propuesta.ts`, y el lado de la regla atado por un test— porque un
 * documento que pase por acá y no por la regla no se guarda igual, y el
 * formulario diría que sí.
 *
 * Es la lección de DEC-7b, dicha por el `prd/README.md` § 2: «lo que no alcanza
 * es validar solo en el cliente».
 */
import { z } from 'zod';
import {
  ARANCELES_PROPUESTA,
  MAX_FECHAS_PROPUESTA,
  MAX_INCLUYE_PROPUESTA,
  MIN_CONTACTO_PROPUESTA,
  MIN_DESCRIPCION_PROPUESTA,
  MIN_FECHAS_PROPUESTA,
  MIN_ORGANIZADOR_PROPUESTA,
  MIN_TITULO_PROPUESTA,
  MODALIDADES_PROPUESTA,
  TOPE_CONTACTO_PROPUESTA,
  TOPE_CORTO_PROPUESTA,
  TOPE_DESCRIPCION_PROPUESTA,
  TOPE_INCLUYE_OTRO_PROPUESTA,
  TOPE_INSCRIPCION_PROPUESTA,
  TOPE_TITULO_PROPUESTA,
  TOPE_URL_PROPUESTA,
  VIAS_CONTACTO_PROPUESTA,
} from '@/types/propuesta';
import type { Propuesta, PropuestaForm } from '@/types/propuesta';

const texto = z.string().trim();

/**
 * `aaaa-mm-dd` y `hh:mm` — **las mismas expresiones que la regla**, y por eso
 * están acá exportadas y no inline: `tests/propuestas.test.ts` compara estas
 * fuentes con las del `matches` de `firestore.rules`.
 *
 * No validan que la fecha **exista** (`2026-02-31` pasa las dos): eso no se
 * puede hacer en una regla de Firestore, así que la forma se valida en los dos
 * lados y el calendario **solo acá**, en el `superRefine` de abajo. Es la
 * división que corresponde: la regla frena lo que un `curl` puede mandar para
 * hacer daño, y el schema además ayuda a quien completa.
 */
export const RE_DIA = '^\\d{4}-\\d{2}-\\d{2}$';
export const RE_HORA = '^([01]\\d|2[0-3]):[0-5]\\d$';

/** ¿`aaaa-mm-dd` es un día que existe? `2026-02-31` no lo es. */
export const diaReal = (dia: string): boolean => {
  if (!new RegExp(RE_DIA).test(dia)) return false;
  const [a, m, d] = dia.split('-').map(Number) as [number, number, number];
  // `Date.UTC` y no `new Date(dia)`: el segundo interpreta la cadena y después
  // hay que preguntarle el día **en alguna zona**, que es la trampa 1. Acá la
  // aritmética es de calendario, sin reloj: si el mes desborda, no era un día.
  const t = new Date(Date.UTC(a, m - 1, d));
  return t.getUTCFullYear() === a && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
};

const fechaSchema = z.object({
  dia: texto.regex(new RegExp(RE_DIA), 'La fecha va como año-mes-día'),
  desde: texto.regex(new RegExp(RE_HORA), 'La hora va como 19:00'),
  hasta: texto.regex(new RegExp(RE_HORA), 'La hora va como 21:00').or(z.literal('')).default(''),
});

export const propuestaFormSchema = z
  .object({
    titulo: texto
      .min(MIN_TITULO_PROPUESTA, 'Escribí un título un poco más largo')
      .max(TOPE_TITULO_PROPUESTA, 'El título tiene que ser más corto'),
    descripcion: texto
      .min(MIN_DESCRIPCION_PROPUESTA, 'Contá un poco más: qué se hace y para quién es')
      .max(TOPE_DESCRIPCION_PROPUESTA, 'Quedó muy largo, resumilo'),
    fechas: z
      .array(fechaSchema)
      .min(MIN_FECHAS_PROPUESTA, 'Poné al menos una fecha')
      .max(MAX_FECHAS_PROPUESTA, `Hasta ${MAX_FECHAS_PROPUESTA} fechas`),
    modalidad: z.enum(MODALIDADES_PROPUESTA),
    lugar: z.object({
      nombre: texto.max(TOPE_CORTO_PROPUESTA).default(''),
      direccion: texto.max(TOPE_CORTO_PROPUESTA).default(''),
      barrio: texto.max(TOPE_CORTO_PROPUESTA).default(''),
    }),
    organizador: z.object({
      nombre: texto
        .min(MIN_ORGANIZADOR_PROPUESTA, '¿Quién organiza?')
        .max(TOPE_CORTO_PROPUESTA, 'Quedó muy largo'),
      instagram: texto.max(TOPE_CORTO_PROPUESTA).default(''),
    }),
    arancel: z.object({
      tipo: z.enum(ARANCELES_PROPUESTA),
      notas: texto.max(TOPE_CORTO_PROPUESTA, 'Quedó muy largo').default(''),
    }),
    inscripcion: z.object({
      requiere: z.boolean(),
      comoDice: texto.max(TOPE_INSCRIPCION_PROPUESTA, 'Quedó muy largo').default(''),
    }),
    incluye: z
      .array(texto)
      .max(MAX_INCLUYE_PROPUESTA, `Hasta ${MAX_INCLUYE_PROPUESTA} cosas`)
      .default([]),
    incluyeOtro: texto.max(TOPE_INCLUYE_OTRO_PROPUESTA, 'Quedó muy largo').default(''),
    imagenUrl: texto.max(TOPE_URL_PROPUESTA, 'La dirección quedó muy larga').default(''),
    contacto: z.object({
      via: z.enum(VIAS_CONTACTO_PROPUESTA),
      valor: texto
        .min(MIN_CONTACTO_PROPUESTA, '¿Cómo te escribimos si hay que preguntarte algo?')
        .max(TOPE_CONTACTO_PROPUESTA, 'Quedó muy largo'),
    }),
  })
  .superRefine((v, ctx) => {
    /*
     * Los condicionales, con el criterio del §11: el campo se pide **solo si
     * aplica**, y la condición vive acá y no en el tipo.
     */
    if (v.modalidad !== 'virtual' && !v.lugar.nombre.trim() && !v.lugar.direccion.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['lugar', 'nombre'],
        message: '¿Dónde es? Alcanza con el nombre del lugar o la dirección',
      });
    }
    if (v.inscripcion.requiere && !v.inscripcion.comoDice.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['inscripcion', 'comoDice'],
        message: '¿Cómo se anota la gente?',
      });
    }
    /*
     * La fecha que **no existe**, que la regla no puede ver: `2026-02-31` pasa
     * el `matches` de los dos lados. Se avisa acá, que es donde hay alguien
     * mirando la pantalla.
     */
    v.fechas.forEach((f, i) => {
      if (f.dia && !diaReal(f.dia)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['fechas', i, 'dia'],
          message: 'Esa fecha no existe',
        });
      }
      // El fin antes del inicio es del mismo día, así que se compara como texto:
      // `hh:mm` ordena igual que el reloj. Una actividad que cruza la medianoche
      // la arma el admin al convertir.
      if (f.hasta && f.desde && f.hasta <= f.desde) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['fechas', i, 'hasta'],
          message: 'La hora de fin va después de la de inicio',
        });
      }
    });
  });

export type PropuestaFormValues = z.input<typeof propuestaFormSchema>;

export const propuestaVacia = (): PropuestaForm => ({
  titulo: '',
  descripcion: '',
  fechas: [{ dia: '', desde: '', hasta: '' }],
  modalidad: 'presencial',
  lugar: { nombre: '', direccion: '', barrio: '' },
  organizador: { nombre: '', instagram: '' },
  // Sin default de arancel, por lo mismo que D-16 en el panel: el default sería
  // «Gratis» y una actividad paga que nadie corrige se propone como gratuita.
  arancel: { tipo: 'gratis', notas: '' },
  inscripcion: { requiere: false, comoDice: '' },
  incluye: [],
  incluyeOtro: '',
  imagenUrl: '',
  contacto: { via: 'mail', valor: '' },
});

/**
 * Form → documento, **sin los campos que pone la regla**: `creadoEn` es
 * `request.time` y el `estado`/`revision` los fuerza la propia regla, así que la
 * capa que escribe los agrega y no salen de acá.
 *
 * `''` → `null` en todo lo opcional, por el mismo criterio que `formAReporte`:
 * la ausencia se representa una sola vez, y así la regla puede exigir
 * `== null` en vez de aceptar dos formas de vacío.
 */
export const formAPropuesta = (
  f: PropuestaForm,
  origen: Propuesta['origen'] = 'formulario-publico',
  /**
   * El objeto que la subida dejó en `propuestas/`, si hubo una — B-830 paso 8,
   * DEC-11.
   *
   * Entra **por parámetro y no como campo del formulario**, y no es un detalle:
   * un `storagePath` no es algo que una persona escriba, es el resultado de una
   * acción que ya ocurrió contra Storage. Como campo del `PropuestaForm` habría
   * que validarlo con zod —o sea repetir el `matches` de la regla en un tercer
   * runtime— para un valor que el propio código acaba de construir con
   * `rutaDeImagenPropuesta`.
   *
   * **Gana sobre la URL pegada**, porque las dos formas son excluyentes
   * (`imagenValida()` rechaza el mapa con las dos claves) y quien subió un
   * archivo eligió después: el formulario esconde un campo cuando el otro tiene
   * algo, y esto es la red por si los dos llegan igual.
   */
  storagePath: string | null = null,
): Omit<Propuesta, 'creadoEn'> => {
  const oNull = (s: string): string | null => (s.trim() ? s.trim() : null);
  const pideLugar = f.modalidad !== 'virtual';
  return {
    titulo: f.titulo.trim(),
    descripcion: f.descripcion.trim(),
    /*
     * **Recortados**, y no es cosmético: el schema los valida ya recortados
     * —`texto = z.string().trim()` corre antes del `regex`— así que
     * `' 2026-10-07 '` pasa la validación, y sin este `trim()` se guardaba **con
     * los espacios**. La regla no lo puede ver porque no itera la lista (B-842),
     * y el `matches` del schema tampoco, porque ya vio la versión recortada. Lo
     * encontró el `auditor-privacidad`: eran los dos únicos campos donde zod
     * recortaba y el armado no.
     */
    fechas: f.fechas.map((x) => ({
      dia: x.dia.trim(),
      desde: x.desde.trim(),
      hasta: x.hasta.trim() ? x.hasta.trim() : null,
    })),
    modalidad: f.modalidad,
    // El lugar se descarta entero si la propuesta es virtual: si la modalidad
    // cambió a mitad de camino, no se cuela lo que ya no aplica (el criterio de
    // `formAReporte` con los pasos y la severidad).
    lugar: pideLugar
      ? {
          nombre: f.lugar.nombre.trim(),
          direccion: f.lugar.direccion.trim(),
          barrio: f.lugar.barrio.trim(),
        }
      : null,
    organizador: {
      nombre: f.organizador.nombre.trim(),
      instagram: oNull(f.organizador.instagram),
    },
    arancel: { tipo: f.arancel.tipo, notas: oNull(f.arancel.notas) },
    inscripcion: {
      requiere: f.inscripcion.requiere,
      comoDice: f.inscripcion.requiere ? oNull(f.inscripcion.comoDice) : null,
    },
    // Ídem: son slugs, y un slug con un espacio adelante no es el mismo slug —
    // no resolvería su etiqueta y la ficha lo mostraría des-slugueado.
    incluye: f.incluye.map((x) => x.trim()).filter(Boolean),
    incluyeOtro: oNull(f.incluyeOtro),
    imagen: storagePath
      ? { storagePath }
      : f.imagenUrl.trim()
        ? { url: f.imagenUrl.trim() }
        : null,
    contacto: { via: f.contacto.via, valor: f.contacto.valor.trim() },
    estado: 'nueva',
    origen,
    revision: { porUid: null, en: null, actividadId: null, motivo: null },
  };
};
