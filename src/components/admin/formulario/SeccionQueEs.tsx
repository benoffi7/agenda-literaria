/**
 * §11 — "Elegí el tipo primero: el resto del formulario se adapta". Tipo,
 * estado, título, slug y descripción.
 */
import { Campo, claseInput } from '@/components/admin/campos/Campo';
import { Seccion } from '@/components/admin/campos/Seccion';
import { TaxonomiaSelect } from '@/components/admin/campos/TaxonomiaSelect';
import { ETIQUETA_ESTADO } from '@/components/admin/formulario/etiquetasUI';
import type { PropsSeccion } from '@/components/admin/formulario/PropsSeccion';
import type { CampoLabelUnico } from '@/lib/formulario/etiquetas';
import { slugify } from '@/lib/slugify';
import { ESTADOS, type ActividadForm } from '@/types/actividad';

interface Props extends PropsSeccion {
  conTitulo: (titulo: string) => void;
  conTipo: (tipo: string) => void;
  anotarLabel: (campo: CampoLabelUnico, label?: string) => void;
  /** Trampa 10 — después de publicar, el slug no se toca más. */
  slugBloqueado: boolean;
}

export function SeccionQueEs({ form, set, errorDe, uid, conTitulo, conTipo, anotarLabel, slugBloqueado }: Props) {
  return (
    <Seccion
      ancla="que-es"
      titulo="Qué es"
      descripcion="Elegí el tipo primero: el resto del formulario se adapta."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Tipo de actividad" requerido error={errorDe('tipo')}>
          <TaxonomiaSelect
            campo="tipo"
            uid={uid}
            value={form.tipo}
            onChange={(slug, labelNuevo) => {
              conTipo(slug);
              anotarLabel('tipo', labelNuevo);
            }}
            placeholder="Elegí el tipo…"
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
            onChange={(e) => conTitulo(e.target.value)}
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
  );
}
