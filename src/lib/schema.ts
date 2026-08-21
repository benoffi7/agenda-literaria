import { z } from 'zod';
import {
  ENTREGAS_MATERIAL,
  ESTADOS,
  MODALIDADES,
  TIPOS_MATERIAL,
  VIAS_INSCRIPCION,
} from '@/types/actividad';

/**
 * Validación del formulario de admin (§11).
 * Las reglas condicionales replican la tabla de "qué aparece en qué tipo":
 * sede en presencial/híbrido, online en virtual/híbrido, etc.
 */

const texto = z.string().trim();
const opcional = texto.default('');

const sesionSchema = z
  .object({
    id: z.string().regex(/^ses_/, 'El id de sesión debe venir de nuevaSesionId()'),
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
  geo: z.object({ lat: z.number(), lng: z.number() }).nullable().default(null),
});

const onlineSchema = z.object({
  plataforma: opcional,
  url: opcional,
  // Por defecto el link NO se publica (§5.1, trampa 5).
  urlPublica: z.boolean().default(false),
});

const itemMaterialSchema = z.object({
  tipo: z.enum(TIPOS_MATERIAL),
  titulo: texto.min(1, 'El material necesita un título'),
  url: opcional,
  entrega: z.enum(ENTREGAS_MATERIAL),
  publico: z.boolean().default(false),
});

export const actividadFormSchema = z
  .object({
    // El `tipo` es slug de taxonomía (§4), así que no se cierra a un enum fijo.
    tipo: texto.min(1, 'Elegí el tipo de actividad'),
    titulo: texto.min(3, 'El título es obligatorio'),
    slug: texto
      .min(1, 'El slug es obligatorio')
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Solo minúsculas, números y guiones'),
    descripcion: texto.min(10, 'Escribí una descripción'),
    imagenUrl: z.string().trim().url('URL inválida').nullable().or(z.literal('')).default(''),

    organizador: z.object({
      nombre: texto.min(1, 'Falta el organizador'),
      instagram: opcional,
      web: opcional,
    }),
    tallerista: z
      .object({ nombre: opcional, bio: opcional, instagram: opcional })
      .nullable()
      .default(null),

    esCiclo: z.boolean().default(false),
    sesiones: z.array(sesionSchema).min(1, 'Cargá al menos un encuentro'),

    modalidad: z.enum(MODALIDADES),
    sede: sedeSchema.nullable().default(null),
    online: onlineSchema.nullable().default(null),

    inscripcion: z.object({
      requiere: z.boolean().default(false),
      via: z.enum(VIAS_INSCRIPCION).nullable().default(null),
      destino: opcional,
      cupo: z.number().int().positive().nullable().default(null),
      cierra: opcional,
    }),

    arancel: z.object({
      tipo: texto.min(1, 'Elegí el arancel'),
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
  // §11 — sede aparece en presencial e híbrido, y ahí es obligatoria.
  .superRefine((v, ctx) => {
    const necesitaSede = v.modalidad === 'presencial' || v.modalidad === 'hibrido';
    if (necesitaSede && !v.sede?.nombre) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sede', 'nombre'],
        message: 'Una actividad presencial necesita sede',
      });
    }
    if (necesitaSede && !v.sede?.direccion) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sede', 'direccion'],
        message: 'Falta la dirección',
      });
    }

    const necesitaOnline = v.modalidad === 'virtual' || v.modalidad === 'hibrido';
    if (necesitaOnline && !v.online?.plataforma) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['online', 'plataforma'],
        message: 'Elegí la plataforma',
      });
    }

    if (v.inscripcion.requiere && !v.inscripcion.via) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['inscripcion', 'via'],
        message: '¿Por dónde se inscriben?',
      });
    }
    if (v.inscripcion.requiere && !v.inscripcion.destino) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['inscripcion', 'destino'],
        message: 'Falta el mail, teléfono, handle o URL de inscripción',
      });
    }

    if (v.material.tiene && v.material.items.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['material', 'items'],
        message: 'Agregá al menos un material o destildá la casilla',
      });
    }

    // Un ciclo con un solo encuentro casi siempre es un olvido (§2.2).
    if (v.esCiclo && v.sesiones.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sesiones'],
        message: 'Un ciclo tiene más de un encuentro',
      });
    }
  });

export type ActividadFormValues = z.input<typeof actividadFormSchema>;
