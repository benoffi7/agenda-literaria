/**
 * Entradas del `events.json` para los tests del sitio público — B-227.
 *
 * **No es `centinelas.ts`.** Aquél es el documento de Firestore con un centinela
 * en cada string, y sirve para preguntar *qué se publica*. Éste es el índice ya
 * proyectado, con valores legibles, y sirve para preguntar *qué se muestra y en
 * qué orden*: un test de orden con centinelas sería ilegible y uno de privacidad
 * con estos valores no verificaría nada.
 *
 * Se construye con `entradaDeIndice(toPublic(...))` y no a mano, y eso es
 * deliberado: si se armara el objeto literal, un campo nuevo del índice quedaría
 * fuera del fixture y los tests seguirían pasando sobre una forma que ya no
 * existe. Pasando por las dos proyecciones reales, el fixture no puede
 * desactualizarse sin que el compilador lo diga.
 */
import { entradaDeIndice, type EntradaDeIndice } from '@/lib/eventsJson';
import { buildSearchText } from '@/lib/normalize';
import { toPublic } from '@/lib/toPublic';
import type { Actividad, ModalidadFila, Sesion } from '@/types/actividad';
import { ts } from './tiempo';

export interface OpcionesDeEntrada {
  id?: string;
  slug?: string;
  titulo?: string;
  tipo?: Actividad['tipo'];
  descripcion?: string;
  /** ISO de cada encuentro. La duración es de dos horas. */
  fechas?: string[];
  /** Los índices de `fechas` que están cancelados. */
  canceladas?: number[];
  modalidades?: ModalidadFila['modalidad'][];
  barrio?: string;
  ciudad?: string;
  arancel?: string;
  tags?: string[];
  esCiclo?: boolean;
  organizador?: string;
  tallerista?: string | null;
  /** ISO del cierre de inscripción, o `null`. */
  cierra?: string | null;
  requiereInscripcion?: boolean;
  cupo?: number | null;
  completo?: boolean;
  /** ISO del alta, que es la clave del orden «Recién agregadas». */
  creadoEn?: string;
  imagenUrl?: string | null;
}

const sesion = (iso: string, i: number, cancelada: boolean): Sesion => ({
  id: `ses_${i}`,
  inicio: ts(iso),
  fin: ts(new Date(new Date(iso).getTime() + 2 * 60 * 60 * 1000).toISOString()),
  tema: `Tema ${i + 1}`,
  lectura: null,
  cancelada,
  calendarEventId: null,
});

export const actividadDePrueba = (o: OpcionesDeEntrada = {}): Actividad => {
  const fechas = o.fechas ?? ['2026-09-24T22:00:00Z'];
  const canceladas = new Set(o.canceladas ?? []);
  const modalidades = (o.modalidades ?? ['presencial']).map((m, i) => ({
    id: `mod_${i}`,
    modalidad: m,
    inicio: null,
    fin: null,
    sede:
      m === 'virtual'
        ? null
        : {
            nombre: 'Casa Brandon',
            direccion: 'Luis María Drago 236',
            barrio: o.barrio ?? 'villa-crespo',
            ciudad: o.ciudad ?? 'CABA',
            indicaciones: 'Timbre del fondo',
            geo: null,
          },
    online: m === 'presencial' ? null : { plataforma: 'meet', url: 'https://meet/x', urlPublica: false },
  })) satisfies ModalidadFila[];

  const conSede = modalidades.find((m) => m.sede)?.sede ?? null;
  const conOnline = modalidades.find((m) => m.online)?.online ?? null;
  const distintas = new Set(modalidades.map((m) => m.modalidad));
  const derivada =
    distintas.size > 1 || distintas.has('hibrido')
      ? 'hibrido'
      : ([...distintas][0] ?? 'presencial');

  const base: Actividad = {
    tipo: o.tipo ?? 'taller',
    titulo: o.titulo ?? 'Taller de crónica',
    slug: o.slug ?? 'taller-de-cronica',
    descripcion: o.descripcion ?? 'Ocho encuentros para escribir una crónica de barrio.',
    imagenes: o.imagenUrl
      ? [{ id: 'img_1', url: o.imagenUrl, epigrafe: '', origen: 'externa', portada: true }]
      : [],
    organizador: { nombre: o.organizador ?? 'Casa Brandon', instagram: '', web: '' },
    tallerista:
      o.tallerista === null ? null : { nombre: o.tallerista ?? 'Ana Ruiz', bio: '', instagram: '' },
    libro: null,
    esCiclo: o.esCiclo ?? false,
    sesiones: fechas.map((f, i) => sesion(f, i, canceladas.has(i))),
    modalidades,
    modalidad: derivada,
    sede: conSede,
    online: conOnline,
    inscripcion: {
      requiere: o.requiereInscripcion ?? true,
      via: 'mail',
      destino: 'hola@casabrandon.com',
      cupo: o.cupo ?? null,
      cierra: o.cierra === undefined ? null : o.cierra === null ? null : ts(o.cierra),
      completo: o.completo ?? false,
    },
    arancel: { tipo: o.arancel ?? 'a-la-gorra', notas: '' },
    material: { tiene: false, items: [] },
    difusion: { arrobar: [], notas: '' },
    estado: 'publicado',
    tags: o.tags ?? [],
    destacado: false,
    searchText: '',
    createdAt: ts(o.creadoEn ?? '2026-08-01T00:00:00Z'),
    updatedAt: ts('2026-08-02T00:00:00Z'),
    createdBy: 'uid_1',
    updatedBy: 'uid_1',
  };

  /*
   * El `searchText` se calcula con **la misma función que lo escribe** al guardar
   * (§6). Escribirlo a mano en el fixture haría que los tests de búsqueda
   * verifiquen contra un índice que el panel nunca produciría: por ejemplo, sin
   * la descripción adentro, que es la mitad de lo que la gente tipea.
   */
  return { ...base, searchText: buildSearchText(base) };
};

/** Una entrada del índice, pasada por las dos proyecciones reales. */
export const entradaDePrueba = (o: OpcionesDeEntrada = {}): EntradaDeIndice =>
  entradaDeIndice(toPublic(actividadDePrueba(o), o.id ?? o.slug ?? 'act_1'));
