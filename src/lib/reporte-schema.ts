/**
 * Validación y armado del reporte. Lógica pura: sin Firestore ni navegador,
 * así se testea sin emuladores (patrón de `05-patrones.md`).
 *
 * Se valida en el submit con zod, como el formulario de actividades (D-01).
 */
import { z } from 'zod';
import { PANTALLAS, SEVERIDADES, TIPOS_REPORTE, TOPE_TITULO_REPORTE } from '@/types/reporte';
import type { ContextoReporte, Reporte, ReporteForm } from '@/types/reporte';

const texto = z.string().trim();

/**
 * Los topes de largo no son decorativos: el cuerpo del reporte termina en un
 * issue público y las mismas cotas están en `firestore.rules`, así que un
 * documento que las pase no se guarda igual. El del título sale de
 * `TOPE_TITULO_REPORTE` (B-364): `firestore.rules` no puede importarlo, así
 * que ese lado lo ata un test que compara el número.
 */
export const reporteFormSchema = z
  .object({
    tipo: z.enum(TIPOS_REPORTE),
    titulo: texto
      .min(6, 'Escribí un título un poco más largo')
      .max(TOPE_TITULO_REPORTE, 'El título tiene que ser más corto'),
    descripcion: texto
      .min(15, 'Contá un poco más: qué esperabas y qué pasó')
      .max(4000, 'Quedó muy largo, resumilo'),
    pasos: texto.max(2000, 'Quedó muy largo, resumilo').default(''),
    severidad: z.enum(SEVERIDADES).nullable().default(null),
    pantalla: z.enum(PANTALLAS),
    actividadId: texto.default(''),
  })
  // Condicional por tipo, como el §11: la severidad y los pasos son de un bug,
  // no de una idea.
  .superRefine((v, ctx) => {
    if (v.tipo === 'bug' && !v.severidad) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['severidad'],
        message: '¿Cuánto te molesta?',
      });
    }
  });

export type ReporteFormValues = z.input<typeof reporteFormSchema>;

export const reporteVacio = (pantalla: ReporteForm['pantalla'] = 'listado'): ReporteForm => ({
  tipo: 'bug',
  titulo: '',
  descripcion: '',
  pasos: '',
  severidad: 'molesta',
  pantalla,
  actividadId: '',
});

/**
 * Form → documento de Firestore, sin los timestamps (los pone la capa que
 * escribe, con `serverTimestamp`).
 *
 * `reportadoPor` es la trazabilidad interna del §5.1: queda en Firestore, que
 * solo leen los admins, y **no** viaja al issue público.
 */
export const formAReporte = (
  f: ReporteForm,
  contexto: ContextoReporte,
  usuario: { uid: string; email: string | null },
  tituloActividad = '',
): Omit<Reporte, 'creadoEn' | 'actualizadoEn'> => ({
  tipo: f.tipo,
  titulo: f.titulo.trim(),
  descripcion: f.descripcion.trim(),
  // Los pasos y la severidad se descartan en una sugerencia: si el tipo cambió
  // a mitad de camino, no se cuela lo que ya no aplica.
  pasos: f.tipo === 'bug' && f.pasos.trim() ? f.pasos.trim() : null,
  severidad: f.tipo === 'bug' ? f.severidad : null,
  actividad: f.actividadId ? { id: f.actividadId, titulo: tituloActividad } : null,
  contexto,
  reportadoPor: { uid: usuario.uid, email: usuario.email ?? '' },
  // El ciclo de vida arranca acá y lo mueve solo la Function. Las reglas
  // exigen estos tres valores en la creación: un cliente no puede nacer con un
  // issue ya asignado ni con los intentos gastados.
  estado: 'pendiente',
  intentos: 0,
  github: null,
  error: null,
});
