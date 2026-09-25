/**
 * **La validación y el armado del documento de una efeméride** — B-959.
 *
 * Puro: sin Firestore y sin reloj. Lo importa el formulario del panel y lo
 * recorre `tests/efemerides.test.ts`, que ata cada tope de acá con el de
 * `firestore.rules` (clase de B-88: dos runtimes diciendo el mismo número).
 *
 * La validación es **en el submit, no por campo** (`05-patrones.md`): el
 * formulario llama a `efemerideFormSchema.safeParse` al guardar y pinta los
 * errores por ruta.
 */
import { z } from 'zod';
import { urlSegura } from '@/lib/enlaceSeguro';
import { slugify } from '@/lib/slugify';
import {
  DIAS_POR_MES,
  MIN_ANIO_EFEMERIDE,
  MIN_TITULO_EFEMERIDE,
  TOPE_ANIO_EFEMERIDE,
  TOPE_DESCRIPCION_EFEMERIDE,
  TOPE_FUENTE_TEXTO_EFEMERIDE,
  TOPE_FUENTE_URL_EFEMERIDE,
  TOPE_SLUG_EFEMERIDE,
  TOPE_TITULO_EFEMERIDE,
  type Efemeride,
  type EfemerideForm,
  type EstadoEfemeride,
} from '@/types/efemeride';

/**
 * El alfabeto del slug. **Es el mismo de las fichas de la Guía**
 * (`esSlugDeFicha`, `RE_SLUG` de los schemas de directorio), y va como cadena
 * para que el test lo compare contra el `matches` de la regla por su fuente.
 */
export const RE_SLUG_EFEMERIDE = '^[a-z0-9]+(-[a-z0-9]+)*$';

/** El formulario vacío de un alta. */
export const efemerideVacia = (): EfemerideForm => ({
  titulo: '',
  slug: '',
  descripcion: '',
  dia: '',
  mes: '',
  anio: '',
  fuente: { texto: '', url: '' },
});

/**
 * El slug que va a quedar: el tipeado, o el que sale del título.
 *
 * `slugify` y no un regex propio (§4.2 y la clase de B-88): el mismo normalizador
 * que el resto del proyecto. De «Nace Julio Cortázar» sale `nace-julio-cortazar`.
 */
export const slugDeEfemeride = (f: { titulo: string; slug: string }): string =>
  f.slug.trim() ? f.slug.trim() : slugify(f.titulo);

/** ¿Ese día existe en ese mes? El 29 de febrero sí (ver `DIAS_POR_MES`). */
export const esDiaDelMes = (dia: number, mes: number): boolean =>
  Number.isInteger(dia) &&
  Number.isInteger(mes) &&
  mes >= 1 &&
  mes <= 12 &&
  dia >= 1 &&
  dia <= DIAS_POR_MES[mes - 1]!;

/**
 * Un entero en texto, o `null`. `Number('')` es `0` y `Number(' 7 ')` es `7`:
 * la conversión se escribe acá una vez para que ninguna de las dos sorpresas
 * llegue al documento.
 */
const entero = (texto: string): number | null => {
  const limpio = texto.trim();
  if (!/^\d+$/.test(limpio)) return null;
  return Number(limpio);
};

const texto = z.string().trim();

export const efemerideFormSchema = z
  .object({
    titulo: texto
      .min(MIN_TITULO_EFEMERIDE, '¿Qué pasó ese día?')
      .max(TOPE_TITULO_EFEMERIDE, 'El título tiene que ser más corto'),
    slug: texto.max(TOPE_SLUG_EFEMERIDE, 'El link quedó muy largo').default(''),
    descripcion: texto
      .max(TOPE_DESCRIPCION_EFEMERIDE, 'Quedó muy largo: es el dato, no un artículo')
      .default(''),
    dia: texto,
    mes: texto,
    anio: texto.default(''),
    fuente: z.object({
      texto: texto.max(TOPE_FUENTE_TEXTO_EFEMERIDE, 'Quedó muy largo').default(''),
      url: texto.max(TOPE_FUENTE_URL_EFEMERIDE, 'La dirección quedó muy larga').default(''),
    }),
  })
  .superRefine((v, ctx) => {
    const falta = (path: (string | number)[], message: string): void => {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
    };

    const slug = slugDeEfemeride(v);
    if (!slug) falta(['slug'], 'Escribí el link: el título no produce ninguno');
    else if (!new RegExp(RE_SLUG_EFEMERIDE).test(slug)) {
      falta(['slug'], 'El link va en minúsculas, números y guiones');
    }

    const mes = entero(v.mes);
    const dia = entero(v.dia);
    if (mes === null || mes < 1 || mes > 12) falta(['mes'], 'Elegí el mes');
    if (dia === null) falta(['dia'], '¿Qué día?');
    else if (mes !== null && mes >= 1 && mes <= 12 && !esDiaDelMes(dia, mes)) {
      falta(['dia'], `Ese mes tiene ${DIAS_POR_MES[mes - 1]} días`);
    }

    if (v.anio) {
      const anio = entero(v.anio);
      if (anio === null || anio < MIN_ANIO_EFEMERIDE || anio > TOPE_ANIO_EFEMERIDE) {
        falta(['anio'], 'Poné el año con números, o dejalo vacío');
      }
    }

    // `javascript:` en un `href` de una página indexada: la regla también lo
    // frena, pero el aviso tiene que llegar antes de ir al servidor.
    if (v.fuente.url && !urlSegura(v.fuente.url)) {
      falta(['fuente', 'url'], 'Esa dirección no es válida');
    }
  });

/**
 * La fuente como la guarda el documento: `null` si no se cargó nada, y la URL
 * **ya saneada** (con esquema `https://` si se pegó sin él). Guardar lo tipeado
 * tal cual dejaría el saneo para cada consumidor, y el que se olvide publica un
 * `href` roto.
 */
export const fuenteDelForm = (f: EfemerideForm['fuente']): Efemeride['fuente'] => {
  const textoLimpio = f.texto.trim();
  const url = urlSegura(f.url) ?? '';
  return textoLimpio || url ? { texto: textoLimpio, url } : null;
};

/**
 * Los campos de **contenido** del documento — lo que el formulario escribe.
 *
 * No lleva `createdAt`/`createdBy`/`updatedAt`/`updatedBy`: esos los pone
 * `lib/efemerides.ts`, que es quien tiene el reloj del servidor y el uid. Y no
 * lleva `publicadaAlgunaVez`, que es de la máquina.
 *
 * Supone un formulario **ya validado** por `efemerideFormSchema`; sobre uno
 * inválido los números pueden salir `NaN` y la regla los rechaza.
 */
export const formAEfemeride = (
  f: EfemerideForm,
  estado: EstadoEfemeride,
): Pick<
  Efemeride,
  'titulo' | 'slug' | 'descripcion' | 'dia' | 'mes' | 'anio' | 'fuente' | 'estado'
> => ({
  titulo: f.titulo.trim(),
  slug: slugDeEfemeride(f),
  descripcion: f.descripcion.trim(),
  dia: entero(f.dia) ?? Number.NaN,
  mes: entero(f.mes) ?? Number.NaN,
  anio: f.anio.trim() ? (entero(f.anio) ?? Number.NaN) : null,
  fuente: fuenteDelForm(f.fuente),
  estado,
});

/** Documento → formulario. La inversa de `formAEfemeride`. */
export const efemerideAFormulario = (e: Efemeride): EfemerideForm => ({
  titulo: e.titulo,
  slug: e.slug,
  descripcion: e.descripcion ?? '',
  dia: String(e.dia),
  mes: String(e.mes),
  // Default de lectura (D-26): un documento sin el campo no tiene año.
  anio: e.anio == null ? '' : String(e.anio),
  fuente: { texto: e.fuente?.texto ?? '', url: e.fuente?.url ?? '' },
});

/**
 * ¿El slug ya no se puede tocar? **Trampa 10.** Mismo criterio que
 * `slugBloqueado` de los directorios (D-911): la marca **o** el estado, con `||`
 * — igual que la regla, que es la que decide de verdad.
 */
export const slugDeEfemerideBloqueado = (e: {
  estado: EstadoEfemeride;
  publicadaAlgunaVez?: boolean;
}): boolean => e.publicadaAlgunaVez === true || e.estado === 'publicado';
