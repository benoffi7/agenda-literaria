import { useMemo, useState } from 'react';
import { z } from 'zod';
import {
  Campo,
  claseBotonPrimario,
  claseBotonSecundario,
  claseInput,
} from '@/components/campos/Campo';
import { useFormularioSucio } from '@/components/admin/useFormularioSucio';
import { medirFuncion } from '@/lib/analytics';
import { textoDeFallo } from '@/lib/fallosDelPanel';
import { MESES } from '@/lib/meses';
import { rutaDeEfemeride } from '@/lib/rutasPublicas';
import {
  efemerideAFormulario,
  efemerideFormSchema,
  efemerideVacia,
  slugDeEfemeride,
  slugDeEfemerideBloqueado,
} from '@/lib/efemeride-schema';
import {
  borrarEfemeride,
  crearEfemeride,
  guardarEfemeride,
  slugDeEfemerideDisponible,
  slugPublicable,
} from '@/lib/efemerides';
import {
  TOPE_DESCRIPCION_EFEMERIDE,
  TOPE_FUENTE_TEXTO_EFEMERIDE,
  TOPE_FUENTE_URL_EFEMERIDE,
  TOPE_SLUG_EFEMERIDE,
  TOPE_TITULO_EFEMERIDE,
  type EfemerideConId,
  type EfemerideForm,
  type EstadoEfemeride,
} from '@/types/efemeride';

/**
 * **El formulario de una efeméride** — B-959.
 *
 * Son siete campos y ninguno condicional, así que no hay acordeón ni pestañas
 * (el §11 los pide para los 30 de una actividad, no para esto). Lo único que
 * tiene de delicado es lo mismo que cualquier ficha con URL:
 *
 * - **el link se congela al publicar** (trampa 10): `slugDeEfemerideBloqueado`
 *   apaga el campo y la regla es la que lo impide de verdad;
 * - **y publicar es una decisión aparte de guardar.** «Guardar» deja la
 *   efeméride en el estado en que estaba —un alta nace en borrador—, y «Guardar
 *   y publicar» es el botón que la manda al sitio.
 */
interface Props {
  uid: string;
  inicial?: EfemerideConId;
  onGuardado: () => void;
  onCancelar: () => void;
}

const erroresDe = (issues: z.ZodIssue[]): Record<string, string> =>
  Object.fromEntries(issues.map((i) => [i.path.join('.'), i.message]));

export function EfemerideFormulario({ uid, inicial, onGuardado, onCancelar }: Props) {
  const [form, setForm] = useState<EfemerideForm>(() =>
    inicial ? efemerideAFormulario(inicial) : efemerideVacia(),
  );
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [fallo, setFallo] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useFormularioSucio(form);

  const set = <K extends keyof EfemerideForm>(campo: K, valor: EfemerideForm[K]) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  const slugResultante = useMemo(() => slugDeEfemeride(form), [form]);
  const congelado = inicial ? slugDeEfemerideBloqueado(inicial) : false;
  const estadoActual: EstadoEfemeride = inicial?.estado ?? 'borrador';

  const guardar = async (estado: EstadoEfemeride) => {
    const parsed = efemerideFormSchema.safeParse(form);
    if (!parsed.success) {
      setErrores(erroresDe(parsed.error.issues));
      setFallo('Faltan datos o hay algo mal cargado. Mirá los campos marcados.');
      return;
    }
    setErrores({});
    setGuardando(true);
    try {
      /*
       * Dos guardas del slug, y no son la misma: la de siempre —que ninguna otra
       * efeméride lo tenga— y, si se va a publicar, que ninguna otra que **ya
       * tuvo URL** lo use. La segunda es la que importa de verdad: dos páginas
       * con la misma dirección se pisan en el build.
       */
      if (!congelado && !(await slugDeEfemerideDisponible(slugResultante, inicial?.id))) {
        setErrores({ slug: 'Ya hay otra efeméride con este link.' });
        setFallo('El link está tomado. Cambialo y volvé a guardar.');
        return;
      }
      if (estado === 'publicado' && !(await slugPublicable(slugResultante, inicial?.id))) {
        setErrores({ slug: 'Este link ya es de otra efeméride publicada.' });
        setFallo('El link ya está en uso en el sitio. Cambialo y volvé a publicar.');
        return;
      }
      const datos = parsed.data as EfemerideForm;
      if (inicial) await guardarEfemeride(inicial.id, datos, uid, estado);
      else await crearEfemeride(datos, uid, estado);
      medirFuncion('efemeride-guardar');
      setFallo(null);
      onGuardado();
    } catch (e: unknown) {
      setFallo(textoDeFallo(e, { respaldo: 'No se pudo guardar la efeméride' }));
    } finally {
      setGuardando(false);
    }
  };

  const borrar = async () => {
    if (!inicial) return;
    const aviso =
      inicial.estado === 'publicado'
        ? 'Esta efeméride está publicada: si la borrás, su página deja de existir en el próximo rebuild. No se puede deshacer. ¿Borrar igual?'
        : 'Borrar esta efeméride no se puede deshacer. ¿Borrar igual?';
    if (!confirm(aviso)) return;
    setGuardando(true);
    try {
      await borrarEfemeride(inicial.id);
      onGuardado();
    } catch (e: unknown) {
      setFallo(textoDeFallo(e, { respaldo: 'No se pudo borrar la efeméride' }));
    } finally {
      setGuardando(false);
    }
  };

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

      <p className="text-xs text-tinta/65">
        Una efeméride es el dato del día —«nació Cortázar», «se publicó <em>Rayuela</em>»—: sin
        lugar ni horario, y no va al calendario público. Se repite todos los años, así que se
        carga el día y el mes, y el año del hecho aparte.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          label="Qué pasó"
          htmlFor="efe-titulo"
          requerido
          error={errores.titulo}
          className="sm:col-span-2"
          ayuda="Es lo que se lee en el renglón de la home: «Nace Julio Cortázar»."
        >
          <input
            id="efe-titulo"
            className={claseInput}
            maxLength={TOPE_TITULO_EFEMERIDE}
            value={form.titulo}
            onChange={(e) => set('titulo', e.target.value)}
          />
        </Campo>

        <Campo label="Día" htmlFor="efe-dia" requerido error={errores.dia}>
          <input
            id="efe-dia"
            className={claseInput}
            inputMode="numeric"
            maxLength={2}
            placeholder="26"
            value={form.dia}
            onChange={(e) => set('dia', e.target.value)}
          />
        </Campo>

        <Campo label="Mes" htmlFor="efe-mes" requerido error={errores.mes}>
          <select
            id="efe-mes"
            className={claseInput}
            value={form.mes}
            onChange={(e) => set('mes', e.target.value)}
          >
            <option value="">Elegí el mes</option>
            {MESES.map((nombre, i) => (
              <option key={nombre} value={String(i + 1)}>
                {nombre}
              </option>
            ))}
          </select>
        </Campo>

        <Campo
          label="Año del hecho"
          htmlFor="efe-anio"
          error={errores.anio}
          ayuda="Opcional. No decide qué día se muestra: eso lo deciden el día y el mes."
        >
          <input
            id="efe-anio"
            className={claseInput}
            inputMode="numeric"
            maxLength={4}
            placeholder="1914"
            value={form.anio}
            onChange={(e) => set('anio', e.target.value)}
          />
        </Campo>

        <Campo
          label="Link de la efeméride"
          htmlFor="efe-slug"
          error={errores.slug}
          ayuda={
            congelado
              ? `Fijo desde que se publicó: ${rutaDeEfemeride(form.slug)}. Cambiarlo rompería el link que ya está en Google.`
              : `Queda en ${rutaDeEfemeride(slugResultante || '…')}. Si lo dejás vacío sale del título.`
          }
        >
          <input
            id="efe-slug"
            className={claseInput}
            maxLength={TOPE_SLUG_EFEMERIDE}
            disabled={congelado}
            placeholder={slugResultante}
            value={form.slug}
            onChange={(e) => set('slug', e.target.value)}
          />
        </Campo>

        <Campo
          label="El dato, en dos o tres oraciones"
          htmlFor="efe-descripcion"
          error={errores.descripcion}
          className="sm:col-span-2"
        >
          <textarea
            id="efe-descripcion"
            className={claseInput}
            rows={4}
            maxLength={TOPE_DESCRIPCION_EFEMERIDE}
            value={form.descripcion}
            onChange={(e) => set('descripcion', e.target.value)}
          />
        </Campo>

        <Campo
          label="Fuente"
          htmlFor="efe-fuente-texto"
          error={errores['fuente.texto']}
          ayuda="Opcional: de dónde sale el dato («Biblioteca Nacional»)."
        >
          <input
            id="efe-fuente-texto"
            className={claseInput}
            maxLength={TOPE_FUENTE_TEXTO_EFEMERIDE}
            value={form.fuente.texto}
            onChange={(e) => set('fuente', { ...form.fuente, texto: e.target.value })}
          />
        </Campo>

        <Campo label="Link de la fuente" htmlFor="efe-fuente-url" error={errores['fuente.url']}>
          <input
            id="efe-fuente-url"
            className={claseInput}
            maxLength={TOPE_FUENTE_URL_EFEMERIDE}
            placeholder="https://…"
            value={form.fuente.url}
            onChange={(e) => set('fuente', { ...form.fuente, url: e.target.value })}
          />
        </Campo>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={guardando}
          onClick={() => void guardar(estadoActual)}
          className={estadoActual === 'publicado' ? claseBotonPrimario : claseBotonSecundario}
        >
          {guardando ? 'Guardando…' : estadoActual === 'publicado' ? 'Guardar' : 'Guardar borrador'}
        </button>
        {estadoActual === 'borrador' && (
          <button
            type="button"
            disabled={guardando}
            onClick={() => void guardar('publicado')}
            className={claseBotonPrimario}
          >
            Guardar y publicar
          </button>
        )}
        <button type="button" onClick={onCancelar} className={claseBotonSecundario}>
          Cancelar
        </button>
        {inicial && (
          <button
            type="button"
            disabled={guardando}
            onClick={() => void borrar()}
            className={`${claseBotonSecundario} text-acento`}
          >
            Borrar
          </button>
        )}
      </div>
    </section>
  );
}
