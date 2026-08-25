import { useMemo, useState } from 'react';
import { useFormularioSucio } from '@/components/admin/useFormularioSucio';
import { useMedicionFormulario } from '@/components/admin/useMedicionFormulario';
import { BarraAcciones } from '@/components/admin/formulario/BarraAcciones';
import { SeccionArancelInscripcion } from '@/components/admin/formulario/SeccionArancelInscripcion';
import { SeccionDifusion } from '@/components/admin/formulario/SeccionDifusion';
import { SeccionDonde } from '@/components/admin/formulario/SeccionDonde';
import { SeccionEncuentros } from '@/components/admin/formulario/SeccionEncuentros';
import { SeccionMaterial } from '@/components/admin/formulario/SeccionMaterial';
import { SeccionOpcional } from '@/components/admin/formulario/SeccionOpcional';
import { SeccionQueEs } from '@/components/admin/formulario/SeccionQueEs';
import { SeccionQuien } from '@/components/admin/formulario/SeccionQuien';
import { SeccionVistaPrevia } from '@/components/admin/formulario/SeccionVistaPrevia';
import { documentoAForm } from '@/lib/actividades';
import { cambiarModalidad, cambiarTipo, cambiarTitulo } from '@/lib/formulario/cascadas';
import {
  esCharla,
  esClub,
  esTaller,
  necesitaOnline,
  necesitaSede,
  nombrePersona,
} from '@/lib/formulario/condicionales';
import { formVacio } from '@/lib/formulario/estadoInicial';
import {
  labelsPendientesDe,
  recordarLabel,
  type CampoLabelUnico,
  type LabelNuevo,
} from '@/lib/formulario/etiquetas';
import { guardarActividad } from '@/lib/formulario/guardar';
import type { ActividadConId, ActividadForm } from '@/types/actividad';

interface Props {
  uid: string;
  /** Si viene, el formulario edita; si no, crea. */
  inicial?: ActividadConId;
  /**
   * B-11 — copia precargada de otra actividad, ya con ids de sesión nuevos,
   * `calendarEventId` en null, slug propuesto y estado borrador
   * (`duplicarActividadForm`). Llega sin `inicial` a propósito: se guarda por
   * el camino de creación, así el documento, el slug y `createdAt`/`createdBy`
   * son de la copia y no del original.
   */
  copia?: ActividadForm;
  /** Título del original, solo para el aviso de la copia. */
  tituloOrigen?: string;
  onGuardado: (id: string) => void;
  onCancelar: () => void;
}

export function ActividadFormulario({
  uid,
  inicial,
  copia,
  tituloOrigen,
  onGuardado,
  onCancelar,
}: Props) {
  const [form, setForm] = useState<ActividadForm>(() =>
    inicial ? documentoAForm(inicial) : (copia ?? formVacio()),
  );
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  useFormularioSucio(form);

  /** Analítica del ciclo de carga. No sale contenido: docs/09-analitica.md. */
  const medicion = useMedicionFormulario(form, inicial ? 'editar' : copia ? 'duplicar' : 'nueva');

  /**
   * Etiquetas creadas con "Otro" que todavía no están en `/opciones/*`.
   * Se persisten en el submit, no al tipearlas: abandonar el formulario no
   * debería dejar basura en la taxonomía (§4.3).
   */
  const [labelsNuevos, setLabelsNuevos] = useState<LabelNuevo[]>([]);
  const [tagsNuevos, setTagsNuevos] = useState<Record<string, string>>({});

  const set = <K extends keyof ActividadForm>(k: K, v: ActividadForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  /** Trampa 10 — el slug es inmutable después de publicar: si no, URLs rotas y SEO perdido. */
  const slugBloqueado = inicial?.estado === 'publicado';

  const errorDe = (path: string) => errores[path];

  const anotarLabel = (campo: CampoLabelUnico, label?: string) =>
    setLabelsNuevos((prev) => recordarLabel(prev, campo, label));

  /** Las cascadas del modelo viven en `lib/formulario/cascadas.ts` (B-70). */
  const conTitulo = (titulo: string) =>
    setForm((f) => cambiarTitulo(f, titulo, slugBloqueado));
  const conTipo = (tipo: string) => setForm((f) => cambiarTipo(f, tipo));
  const conModalidad = (modalidad: ActividadForm['modalidad']) =>
    setForm((f) => cambiarModalidad(f, modalidad));

  const resumenErrores = useMemo(() => Object.entries(errores), [errores]);

  /**
   * Las etiquetas creadas con "Otro" todavía no están en `/opciones/*` (se
   * persisten en el submit, D-02), así que la vista previa las necesita de acá:
   * si no, mostraría "Con Beca Parcial" des-slugueado donde el evento publicado
   * va a decir "Con beca parcial".
   */
  const labelsPendientes = useMemo(
    () => labelsPendientesDe(labelsNuevos, tagsNuevos),
    [labelsNuevos, tagsNuevos],
  );

  /**
   * El caso de uso vive en `lib/formulario/guardar.ts` (B-70): validar, chequear
   * el slug, escribir la actividad y registrar las etiquetas nuevas. Acá queda
   * solo lo que es del componente — estado de React y analítica — traducido
   * desde el resultado.
   */
  const guardar = async (estadoDestino?: ActividadForm['estado']) => {
    setFallo(null);
    const accion = estadoDestino === 'borrador' ? 'borrador' : 'submit';
    setGuardando(true);
    try {
      const r = await guardarActividad({
        form,
        uid,
        estadoDestino,
        idActual: inicial?.id,
        labelsNuevos,
        tagsNuevos,
      });

      if (r.estado === 'invalido') {
        medicion.validacionFallida(r.issues, accion);
        setErrores(r.errores);
        setFallo('Revisá los campos marcados.');
        return;
      }
      setErrores({});

      if (r.estado === 'slug-tomado') {
        medicion.guardadoFallido('slug-tomado', accion);
        setErrores(r.errores);
        setFallo('El slug está tomado.');
        return;
      }
      if (r.estado === 'error') {
        medicion.guardadoFallido(r.error, accion);
        setFallo(r.error instanceof Error ? r.error.message : 'No se pudo guardar.');
        return;
      }

      medicion.guardadoOk(r.guardado, accion);
      onGuardado(r.id);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-4 pb-56 sm:pb-28"
      onSubmit={(e) => {
        e.preventDefault();
        void guardar();
      }}
    >
      {/*
        Aviso de copia. Dice explícitamente qué se rehízo y qué hay que revisar:
        una copia guardada sin mirar es una actividad con el título del año
        pasado y un slug "-copia" que después queda fijo (trampa 10).
      */}
      {copia && (
        <div className="rounded-md border border-acento/30 bg-acento/5 px-3 py-2.5 text-xs">
          <p className="font-medium text-acento">
            Copia de «{tituloOrigen ?? copia.titulo}» — todavía no existe.
          </p>
          <p className="mt-1 text-tinta/70">
            Los encuentros son nuevos y todavía no están en el calendario: los del
            original quedan intactos. Las fechas se corrieron en semanas enteras
            para conservar el día y la hora. Revisá <strong>título</strong>,{' '}
            <strong>slug</strong> y <strong>fechas</strong> antes de publicar: el
            slug queda fijo después.
          </p>
        </div>
      )}

      {/* ── Las nueve secciones del §11 ─────────────────────────
        Cada una en su archivo (B-79). El formulario se queda con el estado, las
        cascadas y el guardado; las secciones son presentación y reciben lo que
        necesitan por props. Era el segundo archivo más tocado del repo, y en
        este proyecto ya se commitearon marcadores de conflicto que sobrevivieron
        dos commits (`tests/sin-marcadores-de-conflicto.test.ts`).
      */}
      <SeccionQueEs
        form={form}
        set={set}
        errorDe={errorDe}
        uid={uid}
        conTitulo={conTitulo}
        conTipo={conTipo}
        anotarLabel={anotarLabel}
        slugBloqueado={slugBloqueado}
      />

      <SeccionEncuentros form={form} set={set} errorDe={errorDe} esClub={esClub(form)} />

      <SeccionDonde
        form={form}
        set={set}
        errorDe={errorDe}
        uid={uid}
        conModalidad={conModalidad}
        anotarLabel={anotarLabel}
        necesitaSede={necesitaSede(form)}
        necesitaOnline={necesitaOnline(form)}
      />

      <SeccionQuien
        form={form}
        set={set}
        errorDe={errorDe}
        esTaller={esTaller(form)}
        esCharla={esCharla(form)}
        nombrePersona={nombrePersona(form)}
      />

      <SeccionArancelInscripcion
        form={form}
        set={set}
        errorDe={errorDe}
        uid={uid}
        anotarLabel={anotarLabel}
      />

      <SeccionMaterial form={form} set={set} errorDe={errorDe} esClub={esClub(form)} />

      <SeccionOpcional
        form={form}
        set={set}
        errorDe={errorDe}
        uid={uid}
        setTagsNuevos={setTagsNuevos}
      />

      <SeccionDifusion form={form} set={set} />

      <SeccionVistaPrevia form={form} labelsPendientes={labelsPendientes} />

      <BarraAcciones
        guardando={guardando}
        fallo={fallo}
        cantidadErrores={resumenErrores.length}
        esEdicion={Boolean(inicial)}
        onCancelar={onCancelar}
        onGuardarBorrador={() => void guardar('borrador')}
      />
    </form>
  );
}
