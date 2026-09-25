import { useMemo, useState, type ReactNode } from 'react';
import type { z } from 'zod';
import { claseBotonPrimario, claseBotonSecundario } from '@/components/campos/Campo';
import { useFormularioSucio } from '@/components/admin/useFormularioSucio';
import { medirFuncion } from '@/lib/analytics';
import type { Funcion } from '@/lib/analytics-eventos';
import { slugBloqueado, type EstadoDirectorio } from '@/lib/directorios';
import { textoDeFallo } from '@/lib/fallosDelPanel';
import { upsertOpcion, upsertOpciones } from '@/lib/opciones';
import type { CampoMultivalor, CampoTaxonomia } from '@/types/actividad';

/**
 * **El esqueleto de los cuatro formularios de la Guía** — M-10, D-1196.
 *
 * Librerías, bibliotecas, suscripciones y lugares tienen campos distintos y el
 * mismo ciclo: el estado del formulario, el aviso de cambios sin guardar, la
 * validación, la guarda de aviso del slug, crear (publicada o no) o guardar la
 * que existe, la medición y el alta de las etiquetas nuevas **después** de la
 * escritura. Eso vive acá una vez; cada formulario pone sus campos y le pasa sus
 * funciones.
 *
 * Lo que este hook no decide es lo mismo que no decidía cada formulario: ni la
 * validación (el schema de la entidad), ni el armado del documento, ni el ciclo
 * de vida (`lib/directorios.ts`), ni la escritura (`lib/<entidad>.ts`).
 */
export interface ConfigDeFicha<F extends object, I extends FichaConEstado> {
  /** La ficha que se edita. Sin ella, es un alta. */
  inicial?: I;
  vacia: () => F;
  aFormulario: (inicial: I) => F;
  schema: z.ZodTypeAny;
  slugDe: (form: F) => string;
  slugDisponible: (slug: string, id?: string) => Promise<boolean>;
  /** El error del campo cuando el slug ya lo usa otra ficha del directorio. */
  slugTomado: string;
  crear: (form: F, publicar: boolean) => Promise<unknown>;
  guardarExistente: (id: string, form: F, inicial: I) => Promise<unknown>;
  medicion: Funcion;
  /** Lo que se muestra si la escritura falla con un error sin mensaje propio. */
  respaldo: string;
  /**
   * Da de alta las etiquetas tipeadas en «Otro…» y devuelve el aviso si alguna
   * no quedó, o `null`. Corre **después** de escribir la ficha, que es lo que no
   * se puede perder (el orden de `guardarActividad`).
   */
  registrarEtiquetas: () => Promise<string | null>;
  onGuardado: () => void;
}

interface FichaConEstado {
  id: string;
  estado: EstadoDirectorio;
  publicadaAlgunaVez?: boolean;
}

/** `{ 'geo.lat': 'mensaje' }` — la forma en que `Campo` pide su error. */
const erroresDe = (issues: z.ZodIssue[]): Record<string, string> =>
  Object.fromEntries(issues.map((i) => [i.path.join('.'), i.message]));

export function useFichaDeDirectorio<F extends object, I extends FichaConEstado>(c: ConfigDeFicha<F, I>) {
  const { inicial } = c;
  const [form, setForm] = useState<F>(() => (inicial ? c.aFormulario(inicial) : c.vacia()));
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [fallo, setFallo] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useFormularioSucio(form);

  const set = <K extends keyof F>(campo: K, valor: F[K]) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  const errorDe = (path: string) => errores[path];

  /** La dirección web que va a quedar, con el derivado a la vista antes de guardar. */
  const slugResultante = useMemo(() => c.slugDe(form), [form]);

  /**
   * La dirección web se congela al publicar — trampa 10. El formulario apaga el
   * campo **y lo explica**; la mitad que lo impide de verdad está en
   * `firestore.rules`.
   */
  const congelado = inicial ? slugBloqueado(inicial) : false;

  const guardar = async (publicar = false) => {
    const parsed = c.schema.safeParse(form);
    if (!parsed.success) {
      setErrores(erroresDe(parsed.error.issues));
      setFallo('Faltan datos o hay algo mal cargado. Mirá los campos marcados.');
      return;
    }
    setErrores({});
    setGuardando(true);
    try {
      /*
       * La guarda **de aviso** del slug: no es una garantía —la de B-909 es
       * `asegurarSlugPublicable`, al publicar— pero convierte un choque en un
       * mensaje con arreglo de una línea en vez de dos fichas con la misma URL
       * descubiertas semanas después. Se salta con el slug congelado: ahí no
       * cambió, y preguntarlo sería una lectura por guardado para nada.
       */
      if (!congelado && !(await c.slugDisponible(slugResultante, inicial?.id))) {
        setErrores({ slug: c.slugTomado });
        setFallo('La dirección web está tomada. Cambiala y volvé a guardar.');
        return;
      }
      /*
       * `guardarExistente` no toca el estado a propósito: el de una ficha que ya
       * existe lo mueve la bandeja, que es donde está el historial de revisión.
       * Solo el alta elige si sale publicada (B-983).
       */
      if (inicial) await c.guardarExistente(inicial.id, parsed.data as F, inicial);
      else await c.crear(parsed.data as F, publicar);
      medirFuncion(c.medicion);
      setFallo(null);
      const sinRegistrar = await c.registrarEtiquetas();
      if (sinRegistrar) {
        setAviso(sinRegistrar);
        return;
      }
      c.onGuardado();
    } catch (e: unknown) {
      setFallo(textoDeFallo(e, { respaldo: c.respaldo }));
    } finally {
      setGuardando(false);
    }
  };

  return {
    form,
    setForm,
    set,
    errorDe,
    fallo,
    aviso,
    guardando,
    slugResultante,
    congelado,
    guardar,
  };
}

/**
 * La etiqueta tipeada en «Otro…» de cada campo, para darla de alta **al
 * guardar**.
 *
 * El segundo argumento del `onChange` de `TaxonomiaSelect` es el label a
 * persistir (D-02), y tirarlo fue B-914: el chip aparecía, la ficha guardaba el
 * slug y la opción **nunca se daba de alta**, así que ningún desplegable la
 * volvía a ofrecer. `recordar` solo guarda si hay label, que es el `if (label)`
 * que cada formulario escribía a mano.
 *
 * Se persisten en el submit y no al tipearlas: si no, abandonar el formulario
 * dejaría basura en la taxonomía (§4.3).
 */
export function useEtiquetasNuevas() {
  const [labels, setLabels] = useState<Partial<Record<CampoTaxonomia, string>>>({});
  const [multivalor, setMultivalor] = useState<
    Partial<Record<CampoMultivalor, Record<string, string>>>
  >({});

  const recordar = (campo: CampoTaxonomia, label?: string) =>
    setLabels((prev) => (label ? { ...prev, [campo]: label } : prev));

  const recordarMultivalor = (campo: CampoMultivalor, nuevos: Record<string, string>) =>
    setMultivalor((prev) => ({ ...prev, [campo]: { ...prev[campo], ...nuevos } }));

  /**
   * De a una y en orden, y la primera que falla se avisa **por su nombre** y
   * corta: el arreglo es volver a tipear esa etiqueta (B-177). Es la política de
   * librerías y bibliotecas, cuyos campos son pocos y fijos.
   */
  const registrarUnaPorUna = async (
    campos: readonly (readonly [CampoTaxonomia, string])[],
    uid: string,
  ): Promise<string | null> => {
    for (const [campo, comoSeLlama] of campos) {
      const label = labels[campo];
      if (!label?.trim()) continue;
      try {
        await upsertOpcion(campo, label, uid);
      } catch {
        return (
          `Se guardó, pero el ${comoSeLlama} «${label}» no quedó en la lista. ` +
          'Volvé a tipearlo la próxima vez que edites la ficha.'
        );
      }
    }
    return null;
  };

  /**
   * Todas, las simples y las de los campos multivalor, y un solo aviso con las
   * que no quedaron. Es la política de suscripciones y lugares, que tienen
   * listas donde se tipean varias de una vez.
   */
  const registrarTodas = async (uid: string): Promise<string | null> => {
    const sinRegistrar: string[] = [];
    for (const [campo, label] of Object.entries(labels) as [CampoTaxonomia, string][]) {
      if (!label?.trim()) continue;
      try {
        await upsertOpcion(campo, label, uid);
      } catch {
        sinRegistrar.push(label);
      }
    }
    for (const [campo, mapa] of Object.entries(multivalor) as [
      CampoMultivalor,
      Record<string, string>,
    ][]) {
      const nuevas = Object.values(mapa ?? {}).filter((l) => l.trim());
      if (nuevas.length === 0) continue;
      try {
        await upsertOpciones(campo, nuevas, uid);
      } catch {
        sinRegistrar.push(...nuevas);
      }
    }
    const unicas = [...new Set(sinRegistrar)];
    return unicas.length > 0
      ? `Se guardó, pero estas opciones nuevas no quedaron en la lista: ${unicas.join(', ')}. ` +
          'Volvé a tipearlas la próxima vez que edites la ficha.'
      : null;
  };

  return { recordar, recordarMultivalor, registrarUnaPorUna, registrarTodas };
}

interface MarcoProps {
  esAlta: boolean;
  fallo: string | null;
  aviso: string | null;
  guardando: boolean;
  guardar: (publicar?: boolean) => Promise<void>;
  onCancelar: () => void;
  /** La frase de abajo de los botones: al crear y al editar. */
  pie: { alCrear: string; alEditar: string };
  children: ReactNode;
}

/**
 * El marco de la pantalla: el cartel del fallo, el del aviso, los campos que
 * pone cada formulario y los botones.
 *
 * **Dos botones al crear, uno solo al editar** (B-983). Quien carga desde el
 * panel es el revisor, así que «Guardar y publicar» evita la vuelta por la
 * bandeja; «Guardar sin publicar» se queda porque el directorio no tiene
 * `borrador` y es la única forma de dejar una ficha a medio cargar sin que salga
 * al sitio. Al editar no aparecen los dos: la escritura de una ficha que existe
 * no toca el estado, y un «publicar» que a veces publica sería un botón que
 * miente.
 */
export function MarcoDeFicha({
  esAlta,
  fallo,
  aviso,
  guardando,
  guardar,
  onCancelar,
  pie,
  children,
}: MarcoProps) {
  return (
    <section className="flex flex-col gap-6">
      {fallo && (
        <p
          role="alert"
          className="rounded-md border border-acento/30 bg-acento/5 px-3 py-2 text-sm text-acento"
        >
          {fallo}
        </p>
      )}
      {aviso && (
        <p role="status" className="rounded-md border border-borde bg-black/[0.03] px-3 py-2 text-sm">
          {aviso}
        </p>
      )}

      {children}

      <div className="flex flex-wrap gap-2">
        {esAlta && (
          <button
            type="button"
            onClick={() => void guardar(true)}
            disabled={guardando}
            className={`${claseBotonPrimario} disabled:opacity-50`}
          >
            {guardando ? 'Guardando…' : 'Guardar y publicar'}
          </button>
        )}
        <button
          type="button"
          onClick={() => void guardar()}
          disabled={guardando}
          className={`${esAlta ? claseBotonSecundario : claseBotonPrimario} disabled:opacity-50`}
        >
          {guardando ? 'Guardando…' : esAlta ? 'Guardar sin publicar' : 'Guardar'}
        </button>
        <button type="button" onClick={onCancelar} className={claseBotonSecundario}>
          Cancelar
        </button>
      </div>

      <p className="text-xs text-tinta/65">{esAlta ? pie.alCrear : pie.alEditar}</p>
    </section>
  );
}
