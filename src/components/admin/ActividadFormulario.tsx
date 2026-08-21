import { useMemo, useState } from 'react';
import {
  Campo,
  claseBotonPrimario,
  claseBotonSecundario,
  claseInput,
} from '@/components/admin/campos/Campo';
import { Seccion } from '@/components/admin/campos/Seccion';
import { TaxonomiaSelect } from '@/components/admin/campos/TaxonomiaSelect';
import { TagsInput } from '@/components/admin/campos/TagsInput';
import { SesionesEditor } from '@/components/admin/SesionesEditor';
import { MaterialEditor } from '@/components/admin/MaterialEditor';
import { CoordenadasSede } from '@/components/admin/CoordenadasSede';
import { useFormularioSucio } from '@/components/admin/useFormularioSucio';
import { useMedicionFormulario } from '@/components/admin/useMedicionFormulario';
import { VistaPreviaEvento } from '@/components/admin/VistaPreviaEvento';
import { actualizarActividad, crearActividad, documentoAForm, slugDisponible } from '@/lib/actividades';
import { upsertOpcion, upsertOpciones } from '@/lib/opciones';
import { actividadFormSchema } from '@/lib/schema';
import { sesionVacia } from '@/lib/sesiones';
import { slugify } from '@/lib/slugify';
import type { LabelsTaxonomia } from '@/lib/vistaPreviaEvento';
import {
  ESTADOS,
  MODALIDADES,
  VIAS_INSCRIPCION,
  type ActividadConId,
  type ActividadForm,
} from '@/types/actividad';

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

const formVacio = (): ActividadForm => ({
  tipo: '' as ActividadForm['tipo'],
  titulo: '',
  slug: '',
  descripcion: '',
  imagenUrl: '',
  organizador: { nombre: '', instagram: '', web: '' },
  tallerista: null,
  esCiclo: false,
  sesiones: [sesionVacia()],
  modalidad: 'presencial',
  sede: { nombre: '', direccion: '', barrio: '', ciudad: 'CABA', indicaciones: '', geo: null },
  online: null,
  inscripcion: { requiere: false, via: null, destino: '', cupo: null, cierra: '' },
  arancel: { tipo: '', notas: '' },
  material: { tiene: false, items: [] },
  difusion: { arrobar: [], notas: '' },
  estado: 'borrador',
  tags: [],
  destacado: false,
});

const ETIQUETA_MODALIDAD = { presencial: 'Presencial', virtual: 'Virtual', hibrido: 'Híbrido' };
const ETIQUETA_VIA = { mail: 'Mail', whatsapp: 'WhatsApp', dm: 'DM de Instagram', formulario: 'Formulario' };
const ETIQUETA_ESTADO = {
  borrador: 'Borrador',
  pendiente: 'Pendiente',
  publicado: 'Publicado',
  cancelado: 'Cancelado',
};

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
  const [labelsNuevos, setLabelsNuevos] = useState<
    { campo: 'arancel' | 'tipo' | 'barrio' | 'plataforma'; label: string }[]
  >([]);
  const [tagsNuevos, setTagsNuevos] = useState<Record<string, string>>({});

  const set = <K extends keyof ActividadForm>(k: K, v: ActividadForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // §11 — condicionales por tipo y modalidad.
  const esTaller = form.tipo === 'taller';
  const esClub = form.tipo === 'club-lectura';
  const esCharla = form.tipo === 'presentacion' || form.tipo === 'charla';
  const necesitaSede = form.modalidad === 'presencial' || form.modalidad === 'hibrido';
  const necesitaOnline = form.modalidad === 'virtual' || form.modalidad === 'hibrido';

  /** Trampa 10 — el slug es inmutable después de publicar: si no, URLs rotas y SEO perdido. */
  const slugBloqueado = inicial?.estado === 'publicado';

  const nombrePersona = esCharla ? 'Autor o autora invitada' : 'Tallerista';

  const errorDe = (path: string) => errores[path];

  const recordarLabel = (
    campo: 'arancel' | 'tipo' | 'barrio' | 'plataforma',
    label?: string,
  ) => {
    if (label) setLabelsNuevos((prev) => [...prev.filter((l) => l.campo !== campo), { campo, label }]);
  };

  const cambiarTitulo = (titulo: string) => {
    setForm((f) => ({
      ...f,
      titulo,
      // El slug se deriva del título mientras no esté publicado, y sigue
      // siendo editable a mano.
      slug: slugBloqueado ? f.slug : slugify(titulo),
    }));
  };

  const cambiarTipo = (tipo: string) => {
    setForm((f) => ({
      ...f,
      tipo: tipo as ActividadForm['tipo'],
      // Un club de lectura es casi siempre un ciclo con material (§2.2, §11).
      esCiclo: tipo === 'club-lectura' ? true : f.esCiclo,
      material: tipo === 'club-lectura' ? { ...f.material, tiene: true } : f.material,
      tallerista:
        tipo === 'taller' || tipo === 'presentacion' || tipo === 'charla'
          ? (f.tallerista ?? { nombre: '', bio: '', instagram: '' })
          : f.tallerista,
    }));
  };

  const cambiarModalidad = (modalidad: ActividadForm['modalidad']) => {
    setForm((f) => ({
      ...f,
      modalidad,
      sede:
        modalidad === 'virtual'
          ? null
          : (f.sede ?? {
              nombre: '',
              direccion: '',
              barrio: '',
              ciudad: 'CABA',
              indicaciones: '',
              geo: null,
            }),
      online:
        modalidad === 'presencial'
          ? null
          : (f.online ?? { plataforma: '', url: '', urlPublica: false }),
    }));
  };

  const resumenErrores = useMemo(() => Object.entries(errores), [errores]);

  /**
   * Las etiquetas creadas con "Otro" todavía no están en `/opciones/*` (se
   * persisten en el submit, D-02), así que la vista previa las necesita de acá:
   * si no, mostraría "Con Beca Parcial" des-slugueado donde el evento publicado
   * va a decir "Con beca parcial".
   */
  const labelsPendientes = useMemo<LabelsTaxonomia>(() => {
    const mapa: LabelsTaxonomia = {};
    for (const { campo, label } of labelsNuevos) {
      mapa[campo] = { ...mapa[campo], [slugify(label)]: label.trim() };
    }
    const tags = Object.entries(tagsNuevos);
    if (tags.length) {
      mapa.tags = Object.fromEntries(tags.map(([slug, label]) => [slug, label.trim()]));
    }
    return mapa;
  }, [labelsNuevos, tagsNuevos]);

  const guardar = async (estadoDestino?: ActividadForm['estado']) => {
    setFallo(null);
    const accion = estadoDestino === 'borrador' ? 'borrador' : 'submit';
    const candidato: ActividadForm = estadoDestino
      ? { ...form, estado: estadoDestino }
      : form;

    const parsed = actividadFormSchema.safeParse(candidato);
    if (!parsed.success) {
      const mapa: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        mapa[issue.path.join('.')] = issue.message;
      }
      medicion.validacionFallida(parsed.error.issues, accion);
      setErrores(mapa);
      setFallo('Revisá los campos marcados.');
      return;
    }
    setErrores({});
    setGuardando(true);

    try {
      const slug = slugify(candidato.slug);
      if (!(await slugDisponible(slug, inicial?.id))) {
        medicion.guardadoFallido('slug-tomado', accion);
        setErrores({ slug: 'Ya hay otra actividad con este slug' });
        setFallo('El slug está tomado.');
        return;
      }

      // §4.2 — las etiquetas nuevas se incorporan al desplegable acá, en
      // transacción y reusando por slug si ya existían.
      //
      // §4.3 — el uid queda como huella de autor: la opción nueva sirve para
      // esta actividad y para las próximas de esta cuenta, pero no entra al
      // desplegable de las demás hasta que alguien la apruebe.
      for (const { campo, label } of labelsNuevos) {
        await upsertOpcion(campo, label, uid);
      }
      const labelsTags = candidato.tags.map((s) => tagsNuevos[s]).filter(Boolean) as string[];
      if (labelsTags.length) await upsertOpciones('tags', labelsTags, uid);

      const conSlug: ActividadForm = { ...candidato, slug };
      const id = inicial
        ? (await actualizarActividad(inicial.id, conSlug, uid), inicial.id)
        : await crearActividad(conSlug, uid);

      medicion.guardadoOk(conSlug, accion);
      onGuardado(id);
    } catch (e) {
      medicion.guardadoFallido(e, accion);
      setFallo(e instanceof Error ? e.message : 'No se pudo guardar.');
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

      {/* ── Qué es ─────────────────────────────────────────────── */}
      <Seccion titulo="Qué es" descripcion="Elegí el tipo primero: el resto del formulario se adapta.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Tipo de actividad" requerido error={errorDe('tipo')}>
            <TaxonomiaSelect
              campo="tipo"
              uid={uid}
              value={form.tipo}
              onChange={(slug, labelNuevo) => {
                cambiarTipo(slug);
                recordarLabel('tipo', labelNuevo);
              }}
              placeholder="Elegí el tipo…"
              autoSeleccionarPrimera
            />
          </Campo>

          <Campo label="Estado" error={errorDe('estado')}>
            <select
              className={claseInput}
              value={form.estado}
              onChange={(e) => set('estado', e.target.value as ActividadForm['estado'])}
            >
              {ESTADOS.map((e) => (
                <option key={e} value={e}>
                  {ETIQUETA_ESTADO[e]}
                </option>
              ))}
            </select>
          </Campo>

          <Campo label="Título" requerido error={errorDe('titulo')} className="sm:col-span-2">
            <input
              className={claseInput}
              value={form.titulo}
              onChange={(e) => cambiarTitulo(e.target.value)}
              placeholder="Taller de crónica urbana"
            />
          </Campo>

          <Campo
            label="Slug"
            requerido
            error={errorDe('slug')}
            ayuda={
              slugBloqueado
                ? 'Bloqueado: la actividad ya está publicada y cambiarlo rompe la URL y el SEO.'
                : 'Se arma solo desde el título. Después de publicar queda fijo.'
            }
            className="sm:col-span-2"
          >
            <input
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              className={claseInput}
              value={form.slug}
              disabled={slugBloqueado}
              onChange={(e) => set('slug', slugify(e.target.value))}
            />
          </Campo>

          <Campo
            label="Descripción"
            requerido
            error={errorDe('descripcion')}
            className="sm:col-span-2"
          >
            <textarea
              className={`${claseInput} min-h-32`}
              value={form.descripcion}
              onChange={(e) => set('descripcion', e.target.value)}
              placeholder="Qué se hace, para quién es, qué se lleva."
            />
          </Campo>
        </div>
      </Seccion>

      {/* ── Encuentros ─────────────────────────────────────────── */}
      <Seccion
        titulo="Encuentros"
        descripcion="Un ciclo de 8 encuentros es una sola actividad con ocho sesiones."
        insignia={form.esCiclo ? 'ciclo' : undefined}
      >
        <label className="mb-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.esCiclo}
            onChange={(e) => set('esCiclo', e.target.checked)}
          />
          Es un ciclo (varios encuentros)
        </label>
        <SesionesEditor
          sesiones={form.sesiones}
          onChange={(s) => set('sesiones', s)}
          mostrarLectura={esClub || form.esCiclo}
          error={errorDe('sesiones')}
        />
      </Seccion>

      {/* ── Dónde ──────────────────────────────────────────────── */}
      <Seccion titulo="Dónde">
        <Campo label="Modalidad" requerido error={errorDe('modalidad')} className="mb-4">
          <div className="flex gap-2">
            {MODALIDADES.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => cambiarModalidad(m)}
                aria-pressed={form.modalidad === m}
                className={`min-h-touch flex-1 rounded-md border px-3 text-sm sm:flex-none sm:px-4 ${
                  form.modalidad === m
                    ? 'border-acento bg-acento/10 font-medium text-acento'
                    : 'border-borde bg-white'
                }`}
              >
                {ETIQUETA_MODALIDAD[m]}
              </button>
            ))}
          </div>
        </Campo>

        {necesitaSede && form.sede && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Sede" requerido error={errorDe('sede.nombre')}>
              <input
                className={claseInput}
                value={form.sede.nombre}
                onChange={(e) => set('sede', { ...form.sede!, nombre: e.target.value })}
                placeholder="Casa Brandon"
              />
            </Campo>
            <Campo label="Dirección" requerido error={errorDe('sede.direccion')}>
              <input
                className={claseInput}
                value={form.sede.direccion}
                onChange={(e) => set('sede', { ...form.sede!, direccion: e.target.value })}
                placeholder="Luis María Drago 236"
              />
            </Campo>
            <Campo label="Barrio" error={errorDe('sede.barrio')}>
              <TaxonomiaSelect
                campo="barrio"
                uid={uid}
                value={form.sede.barrio}
                onChange={(slug, labelNuevo) => {
                  set('sede', { ...form.sede!, barrio: slug });
                  recordarLabel('barrio', labelNuevo);
                }}
                placeholder="Elegí o agregá el barrio…"
              />
            </Campo>
            <Campo label="Ciudad">
              <input
                className={claseInput}
                value={form.sede.ciudad}
                onChange={(e) => set('sede', { ...form.sede!, ciudad: e.target.value })}
              />
            </Campo>
            <Campo
              label="Cómo llegar"
              ayuda="Timbre, piso, referencias. Sale al sitio público."
              className="sm:col-span-2"
            >
              <input
                className={claseInput}
                value={form.sede.indicaciones}
                onChange={(e) => set('sede', { ...form.sede!, indicaciones: e.target.value })}
              />
            </Campo>
            <CoordenadasSede
              geo={form.sede.geo}
              onChange={(geo) => set('sede', { ...form.sede!, geo })}
              className="sm:col-span-2"
            />
          </div>
        )}

        {necesitaOnline && form.online && (
          <div className={`grid gap-4 sm:grid-cols-2 ${necesitaSede ? 'mt-4 border-t border-borde pt-4' : ''}`}>
            <Campo label="Plataforma" requerido error={errorDe('online.plataforma')}>
              <TaxonomiaSelect
                campo="plataforma"
                uid={uid}
                value={form.online.plataforma}
                onChange={(slug, labelNuevo) => {
                  set('online', { ...form.online!, plataforma: slug });
                  recordarLabel('plataforma', labelNuevo);
                }}
                placeholder="Elegí la plataforma…"
                autoSeleccionarPrimera
              />
            </Campo>
            <Campo
              label="Link del encuentro"
              ayuda="No se publica: se manda al inscribirse."
            >
              <input
                type="url"
                inputMode="url"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                className={claseInput}
                value={form.online.url}
                onChange={(e) => set('online', { ...form.online!, url: e.target.value })}
                placeholder="https://zoom.us/j/…"
              />
            </Campo>
            <div className="sm:col-span-2 rounded-md border border-acento/25 bg-acento/5 px-3 py-2">
              <label className="flex items-start gap-2 text-xs">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={form.online.urlPublica}
                  onChange={(e) => set('online', { ...form.online!, urlPublica: e.target.checked })}
                />
                <span>
                  Publicar el link en el sitio.
                  <strong className="block text-acento">
                    Dejalo destildado salvo que sea un encuentro abierto: un link de Zoom
                    público habilita zoombombing.
                  </strong>
                </span>
              </label>
            </div>
          </div>
        )}
      </Seccion>

      {/* ── Quién ──────────────────────────────────────────────── */}
      <Seccion titulo="Quién">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Organizador" requerido error={errorDe('organizador.nombre')}>
            <input
              className={claseInput}
              value={form.organizador.nombre}
              onChange={(e) => set('organizador', { ...form.organizador, nombre: e.target.value })}
            />
          </Campo>
          <Campo label="Instagram del organizador">
            <input
              className={claseInput}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              value={form.organizador.instagram}
              onChange={(e) => set('organizador', { ...form.organizador, instagram: e.target.value })}
              placeholder="@casabrandon"
            />
          </Campo>
          <Campo label="Web del organizador" className="sm:col-span-2">
            <input
              className={claseInput}
              value={form.organizador.web}
              onChange={(e) => set('organizador', { ...form.organizador, web: e.target.value })}
              placeholder="https://…"
            />
          </Campo>
        </div>

        {(esTaller || esCharla) && (
          <div className="mt-4 border-t border-borde pt-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo label={nombrePersona}>
                <input
                  className={claseInput}
                  value={form.tallerista?.nombre ?? ''}
                  onChange={(e) =>
                    set('tallerista', {
                      bio: form.tallerista?.bio ?? '',
                      instagram: form.tallerista?.instagram ?? '',
                      nombre: e.target.value,
                    })
                  }
                />
              </Campo>
              <Campo label="Instagram">
                <input
                  className={claseInput}
                  value={form.tallerista?.instagram ?? ''}
                  onChange={(e) =>
                    set('tallerista', {
                      nombre: form.tallerista?.nombre ?? '',
                      bio: form.tallerista?.bio ?? '',
                      instagram: e.target.value,
                    })
                  }
                />
              </Campo>
              <Campo label="Bio" className="sm:col-span-2">
                <textarea
                  className={`${claseInput} min-h-20`}
                  value={form.tallerista?.bio ?? ''}
                  onChange={(e) =>
                    set('tallerista', {
                      nombre: form.tallerista?.nombre ?? '',
                      instagram: form.tallerista?.instagram ?? '',
                      bio: e.target.value,
                    })
                  }
                />
              </Campo>
            </div>
          </div>
        )}
      </Seccion>

      {/* ── Arancel e inscripción ──────────────────────────────── */}
      <Seccion titulo="Arancel e inscripción">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Arancel" requerido error={errorDe('arancel.tipo')}>
            <TaxonomiaSelect
              campo="arancel"
              uid={uid}
              value={form.arancel.tipo}
              onChange={(slug, labelNuevo) => {
                set('arancel', { ...form.arancel, tipo: slug });
                recordarLabel('arancel', labelNuevo);
              }}
              placeholder="Elegí el arancel…"
            />
          </Campo>
          <Campo label="Notas del arancel" ayuda="«2 cuotas», «incluye material»">
            <input
              className={claseInput}
              value={form.arancel.notas}
              onChange={(e) => set('arancel', { ...form.arancel, notas: e.target.value })}
            />
          </Campo>
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.inscripcion.requiere}
            onChange={(e) =>
              set('inscripcion', { ...form.inscripcion, requiere: e.target.checked })
            }
          />
          Requiere inscripción previa
        </label>

        {form.inscripcion.requiere && (
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <Campo label="Por dónde" requerido error={errorDe('inscripcion.via')}>
              <select
                className={claseInput}
                value={form.inscripcion.via ?? ''}
                onChange={(e) =>
                  set('inscripcion', {
                    ...form.inscripcion,
                    via: (e.target.value || null) as ActividadForm['inscripcion']['via'],
                  })
                }
              >
                <option value="">Elegí…</option>
                {VIAS_INSCRIPCION.map((v) => (
                  <option key={v} value={v}>
                    {ETIQUETA_VIA[v]}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo
              label="Destino"
              requerido
              error={errorDe('inscripcion.destino')}
              ayuda="Es público. Usá un contacto de trabajo, no un WhatsApp personal."
            >
              <input
                className={claseInput}
                value={form.inscripcion.destino}
                onChange={(e) =>
                  set('inscripcion', { ...form.inscripcion, destino: e.target.value })
                }
                placeholder="inscripciones@… o https://wa.me/…"
              />
            </Campo>
            <Campo label="Cupo">
              <input
                type="number"
                inputMode="numeric"
                min={1}
                className={claseInput}
                value={form.inscripcion.cupo ?? ''}
                onChange={(e) =>
                  set('inscripcion', {
                    ...form.inscripcion,
                    cupo: e.target.value ? Number(e.target.value) : null,
                  })
                }
              />
            </Campo>
            <Campo label="Cierra la inscripción">
              <input
                type="datetime-local"
                className={claseInput}
                value={form.inscripcion.cierra}
                onChange={(e) =>
                  set('inscripcion', { ...form.inscripcion, cierra: e.target.value })
                }
              />
            </Campo>
          </div>
        )}
      </Seccion>

      {/* ── Material ───────────────────────────────────────────── */}
      <Seccion
        titulo="Material"
        descripcion="Lecturas, guías y contexto. Sobre todo en clubes de lectura."
        colapsable
        abiertaPorDefecto={esClub || form.material.tiene}
        insignia={form.material.items.length ? `${form.material.items.length}` : undefined}
      >
        <label className="mb-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.material.tiene}
            onChange={(e) => set('material', { ...form.material, tiene: e.target.checked })}
          />
          Tiene material asociado
        </label>
        {form.material.tiene && (
          <MaterialEditor
            items={form.material.items}
            onChange={(items) => set('material', { ...form.material, items })}
            error={errorDe('material.items')}
          />
        )}
      </Seccion>

      {/* ── Opcional ───────────────────────────────────────────── */}
      <Seccion
        titulo="Opcional"
        descripcion="Tags, imagen, destacado."
        colapsable
        abiertaPorDefecto={false}
      >
        <div className="grid gap-4">
          <Campo label="Tags" ayuda="Alimentan los filtros del sitio público.">
            <TagsInput
              uid={uid}
              value={form.tags}
              onChange={(slugs, nuevos) => {
                set('tags', slugs);
                setTagsNuevos(nuevos);
              }}
            />
          </Campo>
          <Campo label="Imagen" error={errorDe('imagenUrl')}>
            <input
              type="url"
              inputMode="url"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              className={claseInput}
              value={form.imagenUrl ?? ''}
              onChange={(e) => set('imagenUrl', e.target.value)}
              placeholder="https://…"
            />
          </Campo>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.destacado}
              onChange={(e) => set('destacado', e.target.checked)}
            />
            Destacar en la portada
          </label>
        </div>
      </Seccion>

      {/* ── Difusión (interno) ─────────────────────────────────── */}
      <Seccion
        titulo="Difusión"
        descripcion="Uso interno. Nunca sale al sitio público ni al calendario."
        colapsable
        abiertaPorDefecto={false}
        insignia="interno"
      >
        <div className="grid gap-4">
          <Campo label="Arrobar al publicar" ayuda="Un handle por línea o separados por coma.">
            <input
              className={claseInput}
              value={form.difusion.arrobar.join(', ')}
              onChange={(e) =>
                set('difusion', {
                  ...form.difusion,
                  arrobar: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                })
              }
              placeholder="@casabrandon, @editorial"
            />
          </Campo>
          <Campo label="Notas internas">
            <textarea
              className={`${claseInput} min-h-20`}
              value={form.difusion.notas}
              onChange={(e) => set('difusion', { ...form.difusion, notas: e.target.value })}
            />
          </Campo>
        </div>
      </Seccion>

      {/*
        ── Vista previa del evento ─────────────────────────────
        Última sección y colapsada: es el paso natural antes de publicar, y
        mientras está cerrada no abre las cinco suscripciones a /opciones que
        necesita para resolver las etiquetas.
      */}
      <Seccion
        titulo="Vista previa del evento"
        descripcion="Cómo va a quedar en Google Calendar. Lo arma la misma lógica que publica el evento."
        colapsable
        abiertaPorDefecto={false}
      >
        <VistaPreviaEvento form={form} labelsPendientes={labelsPendientes} />
      </Seccion>

      {/*
        ── Barra de acciones ────────────────────────────────────
        Fija abajo, con pb-segura para que en un iPhone no quede debajo de la
        barra de gestos. En mobile los dos botones de guardado van a mitad y
        mitad del ancho, y "Cancelar" pasa a una línea propia arriba: tres
        botones en fila en 360px dan blancos de ~100px y se erra el toque.
      */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-borde bg-papel/95 px-segura pt-3 pb-segura backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row sm:items-center lg:max-w-4xl">
          {/*
            El resumen de errores se reduce a un contador. Listar cuatro rutas
            de campo acá tapaba media pantalla en mobile, y el detalle ya está
            al lado de cada campo.
          */}
          {(fallo || resumenErrores.length > 0) && (
            <p role="status" className="text-xs text-acento sm:order-2 sm:flex-1 sm:text-center">
              {resumenErrores.length > 0
                ? `${resumenErrores.length} ${resumenErrores.length === 1 ? 'campo' : 'campos'} para revisar`
                : fallo}
            </p>
          )}

          <button
            type="button"
            onClick={onCancelar}
            className={`${claseBotonSecundario} sm:order-1`}
          >
            Cancelar
          </button>

          <div className="flex gap-2 sm:order-3">
            <button
              type="button"
              disabled={guardando}
              onClick={() => void guardar('borrador')}
              className={`${claseBotonSecundario} flex-1 sm:flex-none`}
            >
              Guardar borrador
            </button>
            <button
              type="submit"
              disabled={guardando}
              className={`${claseBotonPrimario} flex-1 sm:flex-none`}
            >
              {guardando ? 'Guardando…' : inicial ? 'Guardar cambios' : 'Crear actividad'}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
