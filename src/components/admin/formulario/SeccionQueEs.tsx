/**
 * §11 — "Elegí el tipo primero: el resto del formulario se adapta". Tipo,
 * estado, título, slug, descripción y **el flyer**.
 *
 * ── Por qué el flyer se mudó acá — B-264 ──────────────────────────────────
 * Estaba en «Opcional»: un acordeón **cerrado por defecto**, llamado literalmente
 * «Opcional», con la descripción «Tags, imagen, destacado». O sea: escondido y
 * etiquetado como prescindible. El resultado era medible — 2 actividades con
 * imagen sobre 42 publicadas, y no porque falte materia prima, sino porque en el
 * circuito literario el flyer *es* el medio de difusión y acá no se pedía.
 *
 * «Qué es» es la primera sección, no colapsa nunca, y es donde ya viven el título
 * y la descripción. Un flyer es exactamente eso: qué es la actividad, contado en
 * una imagen. No se vuelve obligatorio —bloquear la publicación agrega fricción
 * donde hace falta lo contrario— pero deja de estar oculto, y la barra de abajo
 * avisa qué se pierde sin él (`lib/formulario/recomendaciones.ts`).
 *
 * En «Opcional» quedan las etiquetas y «destacar», que sí son opcionales.
 */
import { Seccion, TagsInput, TaxonomiaSelect } from '@/components/admin/campos-del-panel';
import { GaleriaEditor } from '@/components/admin/GaleriaEditor';
import { Campo, claseInput } from '@/components/campos/Campo';
import { ETIQUETA_ESTADO } from '@/components/admin/formulario/etiquetasUI';
import type { PropsSeccion } from '@/components/admin/formulario/PropsSeccion';
import type { CampoLabelUnico } from '@/lib/formulario/etiquetas';
import { slugify } from '@/lib/slugify';
import { ESTADOS, type ActividadForm, type CampoMultivalor } from '@/types/actividad';

interface Props extends PropsSeccion {
  conTitulo: (titulo: string) => void;
  /** B-830 — las opciones de «Qué se llevan» tipeadas con «Otro» (D-02). */
  anotarMultivalor: (campo: CampoMultivalor, nuevos: Record<string, string>) => void;
  conTipo: (tipo: string) => void;
  anotarLabel: (campo: CampoLabelUnico, label?: string) => void;
  /** Trampa 10 — después de publicar, el slug no se toca más. */
  slugBloqueado: boolean;
}

export function SeccionQueEs({
  form,
  set,
  errorDe,
  uid,
  conTitulo,
  conTipo,
  anotarLabel,
  anotarMultivalor,
  slugBloqueado,
}: Props) {
  return (
    <Seccion
      ancla="que-es"
      titulo="Qué es"
      conAyuda
      descripcion="Elegí el tipo primero: el resto del formulario se adapta."
    >
      <div className="grid gap-4 sm:grid-cols-2 @5xl:grid-cols-3">
        <Campo label="Tipo de actividad" htmlFor="act-tipo" requerido error={errorDe('tipo')}>
          <TaxonomiaSelect
            id="act-tipo"
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

        <Campo label="Estado" htmlFor="act-estado" error={errorDe('estado')}>
          <select
            id="act-estado"
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

        <Campo
          label="Título"
          htmlFor="act-titulo"
          requerido
          error={errorDe('titulo')}
          className="sm:col-span-full"
        >
          <input
            id="act-titulo"
            className={claseInput}
            value={form.titulo}
            onChange={(e) => conTitulo(e.target.value)}
            placeholder="Taller de crónica urbana"
          />
        </Campo>

        <Campo
          label="Slug"
          htmlFor="act-slug"
          requerido
          error={errorDe('slug')}
          ayuda={
            slugBloqueado
              ? 'Bloqueado: la actividad ya está publicada y cambiarlo rompe la URL y el SEO.'
              : 'Se arma solo desde el título. Después de publicar queda fijo.'
          }
          className="sm:col-span-full"
        >
          <input
            id="act-slug"
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
          htmlFor="act-descripcion"
          requerido
          error={errorDe('descripcion')}
          className="sm:col-span-full"
        >
          <textarea
            id="act-descripcion"
            className={`${claseInput} min-h-32`}
            value={form.descripcion}
            onChange={(e) => set('descripcion', e.target.value)}
            placeholder="Qué se hace, para quién es, qué se lleva."
          />
        </Campo>

        {/*
          B-830 · DEC-1 del PRD 1 — «qué se llevan». Va en «Qué es» y no en
          «Opcional» por lo mismo que el flyer (B-264): es información que
          alguien necesita para decidir si va, no un metadato del catálogo, y un
          campo en una sección cerrada por defecto es un campo que queda vacío.

          **No es `material`.** Ese son links de lectura con su forma de entrega,
          para el club de lectura; «merienda» no entra ahí.
        */}
        <Campo
          label="Qué se llevan"
          htmlFor="act-incluye"
          ayuda="Material de lectura, libro, merienda, certificado. Enter o coma para agregar."
          className="sm:col-span-full"
        >
          <TagsInput
            id="act-incluye"
            campo="incluye-actividad"
            uid={uid}
            value={form.incluye}
            onChange={(slugs, nuevos) => {
              set('incluye', slugs);
              anotarMultivalor('incluye-actividad', nuevos);
            }}
          />
        </Campo>

        {/*
          B-264 — el flyer, acá y no en «Opcional». La ayuda de al lado dice para
          qué sirve: en un panel de una persona, el campo que no explica qué gana
          quien lo completa es el campo que queda vacío.
        */}
        <Campo
          label="Flyer e imágenes"
          htmlFor="act-imagenes"
          // `GaleriaEditor` es una lista con su propio alta y sus filas: no hay
          // un control único al que apuntar, así que el rótulo nombra al grupo.
          comoGrupo
          // B-341 — sin `error` acá: `GaleriaEditor` ya pinta el de la lista
          // (`errorDe('imagenes')`) y el de cada fila. Pasarlo también acá
          // duplicaría el mismo mensaje dos veces en la misma sección.
          ayuda="El flyer es lo primero que se ve. Con imagen, la actividad entra en la cartelera del sitio y el link se comparte con algo para mirar."
          className="sm:col-span-full"
        >
          <GaleriaEditor
            imagenes={form.imagenes}
            onChange={(imagenes) => set('imagenes', imagenes)}
            tituloActividad={form.titulo}
            errorDe={errorDe}
          />
        </Campo>
      </div>
    </Seccion>
  );
}
