import { useEffect, useState } from 'react';
import {
  claseBotonPrimario,
  claseBotonSecundario,
  claseBotonTinta,
  claseInput,
  Campo,
} from '@/components/admin/campos/Campo';
import { Seccion } from '@/components/admin/campos/Seccion';
import { listarActividades } from '@/lib/actividades';
import { reporteFormSchema, reporteVacio } from '@/lib/reporte-schema';
import { contextoTecnico, crearReporte } from '@/lib/reportes';
import type { ActividadConId } from '@/types/actividad';
import { PANTALLAS, SEVERIDADES, TIPOS_REPORTE } from '@/types/reporte';
import type { Pantalla, ReporteForm, Severidad, TipoReporte } from '@/types/reporte';

interface Props {
  usuario: { uid: string; email: string | null };
  onEnviado: () => void;
}

const LABEL_TIPO: Record<TipoReporte, string> = {
  bug: 'Algo no funciona',
  sugerencia: 'Se me ocurre algo',
};

const LABEL_SEVERIDAD: Record<Severidad, string> = {
  'me-bloquea': 'Me bloquea: no puedo seguir',
  molesta: 'Molesta, pero puedo seguir',
  menor: 'Es un detalle',
};

const LABEL_PANTALLA: Record<Pantalla, string> = {
  listado: 'El listado de actividades',
  'nueva-actividad': 'Cargar una actividad nueva',
  'editar-actividad': 'Editar una actividad',
  encuentros: 'El editor de encuentros',
  otra: 'Otra / no me acuerdo',
};

/**
 * Formulario de reporte. Escribe en `/reportes/{id}` y la Function
 * `reporteAIssue` crea el issue en GitHub: el panel nunca ve el token (§5.4).
 *
 * Mismo criterio que el formulario de actividades: estado controlado, zod en el
 * submit (D-01), y condicional por tipo (§11) — los pasos y la severidad son
 * de un bug, no de una idea.
 */
export function ReporteFormulario({ usuario, onEnviado }: Props) {
  const [form, setForm] = useState<ReporteForm>(reporteVacio());
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const [actividades, setActividades] = useState<ActividadConId[]>([]);

  // Para poder referenciar una actividad concreta. Si falla, el reporte se
  // manda igual sin referencia: no es motivo para bloquear el formulario.
  useEffect(() => {
    let vivo = true;
    listarActividades()
      .then((as) => vivo && setActividades(as))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  const set = <K extends keyof ReporteForm>(campo: K, valor: ReporteForm[K]) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  const errorDe = (path: string) => errores[path];
  const esBug = form.tipo === 'bug';

  const enviar = async () => {
    setFallo(null);
    const parsed = reporteFormSchema.safeParse(form);
    if (!parsed.success) {
      const mapa: Record<string, string> = {};
      for (const issue of parsed.error.issues) mapa[issue.path.join('.')] = issue.message;
      setErrores(mapa);
      setFallo('Revisá los campos marcados.');
      return;
    }
    setErrores({});
    setEnviando(true);
    try {
      const titulo = actividades.find((a) => a.id === form.actividadId)?.titulo ?? '';
      await crearReporte(form, contextoTecnico(form.pantalla), usuario, titulo);
      setForm(reporteVacio(form.pantalla));
      onEnviado();
    } catch (e) {
      // El reporte no se perdió en el aire: si la escritura falló, el texto
      // sigue en el formulario.
      setFallo(e instanceof Error ? e.message : 'No se pudo enviar el reporte.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void enviar();
      }}
    >
      <Seccion
        titulo="Contar un problema o una idea"
        descripcion="Va directo a la lista de pendientes del proyecto, en GitHub."
      >
        <div className="flex flex-col gap-4">
          <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <strong>El repositorio es público:</strong> lo que escribas se puede leer desde
            internet. No hace falta que pongas mails de inscriptos ni links de reunión — si
            se cuela alguno, el panel lo tapa antes de publicar, pero mejor no escribirlos.
            Tu cuenta no aparece en el issue.
          </p>

          <Campo label="¿Qué es?" requerido>
            {/* Dos botones y no un desplegable: es la decisión que ordena el
                resto del formulario y en el teléfono se toca de una. */}
            <div className="flex flex-col gap-2 sm:flex-row">
              {TIPOS_REPORTE.map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={form.tipo === t}
                  onClick={() => set('tipo', t)}
                  className={`${form.tipo === t ? claseBotonTinta : claseBotonSecundario} flex-1`}
                >
                  {LABEL_TIPO[t]}
                </button>
              ))}
            </div>
          </Campo>

          <Campo
            label="En una línea"
            htmlFor="rep-titulo"
            requerido
            error={errorDe('titulo')}
            ayuda={esBug ? 'Ej.: «no puedo guardar un borrador sin sede»' : 'Ej.: «duplicar una actividad del año pasado»'}
          >
            <input
              id="rep-titulo"
              className={claseInput}
              value={form.titulo}
              maxLength={120}
              onChange={(e) => set('titulo', e.target.value)}
            />
          </Campo>

          <Campo
            label={esBug ? 'Qué pasó' : 'Contame la idea'}
            htmlFor="rep-desc"
            requerido
            error={errorDe('descripcion')}
            ayuda={esBug ? 'Qué esperabas que pasara y qué pasó en su lugar.' : 'Para qué te serviría.'}
          >
            <textarea
              id="rep-desc"
              className={`${claseInput} min-h-32`}
              value={form.descripcion}
              maxLength={4000}
              onChange={(e) => set('descripcion', e.target.value)}
            />
          </Campo>

          {esBug && (
            <>
              <Campo
                label="Cómo se repite"
                htmlFor="rep-pasos"
                error={errorDe('pasos')}
                ayuda="Opcional, pero es lo que más ayuda: 1) entré a…, 2) toqué…, 3) apareció…"
              >
                <textarea
                  id="rep-pasos"
                  className={`${claseInput} min-h-24`}
                  value={form.pasos}
                  maxLength={2000}
                  onChange={(e) => set('pasos', e.target.value)}
                />
              </Campo>

              <Campo label="¿Cuánto molesta?" htmlFor="rep-sev" requerido error={errorDe('severidad')}>
                <select
                  id="rep-sev"
                  className={claseInput}
                  value={form.severidad ?? ''}
                  onChange={(e) => set('severidad', (e.target.value || null) as Severidad | null)}
                >
                  {SEVERIDADES.map((s) => (
                    <option key={s} value={s}>
                      {LABEL_SEVERIDAD[s]}
                    </option>
                  ))}
                </select>
              </Campo>
            </>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              label="¿Dónde estabas?"
              htmlFor="rep-pantalla"
              error={errorDe('pantalla')}
              ayuda="Se pregunta porque el problema suele pasar en otra pantalla."
            >
              <select
                id="rep-pantalla"
                className={claseInput}
                value={form.pantalla}
                onChange={(e) => set('pantalla', e.target.value as Pantalla)}
              >
                {PANTALLAS.map((p) => (
                  <option key={p} value={p}>
                    {LABEL_PANTALLA[p]}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo
              label="¿Es sobre una actividad?"
              htmlFor="rep-act"
              ayuda="Opcional. Su título solo se copia al issue si ya está publicada."
            >
              <select
                id="rep-act"
                className={claseInput}
                value={form.actividadId}
                onChange={(e) => set('actividadId', e.target.value)}
              >
                <option value="">No, es del panel en general</option>
                {actividades.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.titulo}
                  </option>
                ))}
              </select>
            </Campo>
          </div>

          <p className="text-xs text-tinta/55">
            Se manda también el navegador, el tamaño de la pantalla, la versión del panel y
            tu zona horaria: es lo que evita el ida y vuelta de «¿desde qué teléfono?».
          </p>

          {fallo && (
            <p
              role="alert"
              className="rounded-md border border-acento/30 bg-acento/5 px-3 py-2 text-sm text-acento"
            >
              {fallo}
            </p>
          )}

          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <button type="submit" disabled={enviando} className={`${claseBotonPrimario} sm:w-auto`}>
              {enviando ? 'Enviando…' : 'Enviar reporte'}
            </button>
          </div>
        </div>
      </Seccion>
    </form>
  );
}
