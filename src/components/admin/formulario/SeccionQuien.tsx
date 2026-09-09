/**
 * Organizador siempre; tallerista o autor invitado según el tipo (§11), y el
 * libro presentado en presentación y charla (DEC-1).
 */
import { Seccion } from '@/components/admin/campos-del-panel';
import { Campo, claseInput } from '@/components/campos/Campo';
import { muestraLibro } from '@/lib/formulario/condicionales';
import type { PropsSeccion } from '@/components/admin/formulario/PropsSeccion';

type Props = Omit<PropsSeccion, 'uid'> & {
  esTaller: boolean;
  esCharla: boolean;
  /** "Tallerista" o "Autor o autora invitada", según el tipo. */
  nombrePersona: string;
};

export function SeccionQuien({ form, set, errorDe, esTaller, esCharla, nombrePersona }: Props) {
  return (
    <Seccion ancla="quien" titulo="Quién" conAyuda>
      <div className="grid gap-4 sm:grid-cols-2 @5xl:grid-cols-3">
        <Campo label="Organizador" htmlFor="org-nombre" requerido error={errorDe('organizador.nombre')}>
          <input
            id="org-nombre"
            className={claseInput}
            value={form.organizador.nombre}
            onChange={(e) => set('organizador', { ...form.organizador, nombre: e.target.value })}
          />
        </Campo>
        <Campo label="Instagram del organizador" htmlFor="org-instagram">
          <input
            id="org-instagram"
            className={claseInput}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            value={form.organizador.instagram}
            onChange={(e) => set('organizador', { ...form.organizador, instagram: e.target.value })}
            placeholder="@casabrandon"
          />
        </Campo>
        <Campo label="Web del organizador" htmlFor="org-web" className="sm:col-span-full">
          <input
            id="org-web"
            className={claseInput}
            value={form.organizador.web}
            onChange={(e) => set('organizador', { ...form.organizador, web: e.target.value })}
            placeholder="https://…"
          />
        </Campo>
      </div>

      {(esTaller || esCharla) && (
        <div className="mt-4 border-t border-borde pt-4">
          <div className="grid gap-4 sm:grid-cols-2 @5xl:grid-cols-3">
            <Campo label={nombrePersona} htmlFor="persona-nombre">
              <input
                id="persona-nombre"
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
            <Campo label="Instagram" htmlFor="persona-instagram">
              <input
                id="persona-instagram"
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
            <Campo label="Bio" htmlFor="persona-bio" className="sm:col-span-full">
              <textarea
                id="persona-bio"
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

      {/*
        DEC-1 — el libro presentado. Aparece en presentación y charla, los dos
        tipos en los que la persona al frente es «autor o autora invitada», y
        además en cualquier actividad que ya lo tenga cargado: lo que se publica
        tiene que poder verse y borrarse desde donde se cargó.

        La condición es del modelo y vive en `formulario/condicionales.ts`
        (B-70), no acá: se importa en lugar de recibirse como prop porque
        depende del contenido del formulario y no solo del tipo, y escribirla en
        el `.tsx` es lo que hace que el campo se esconda en un caso donde el
        documento —y las dos salidas públicas— lo siguen teniendo.
      */}
      {muestraLibro(form) && (
        <div className="mt-4 border-t border-borde pt-4">
          <div className="grid gap-4 sm:grid-cols-2 @5xl:grid-cols-3">
            <Campo
              label="Libro presentado"
              htmlFor="libro-titulo"
              error={errorDe('libro.titulo')}
              ayuda="Se publica en el sitio y en el evento del calendario."
            >
              <input
                id="libro-titulo"
                className={claseInput}
                value={form.libro.titulo}
                onChange={(e) => set('libro', { ...form.libro, titulo: e.target.value })}
                placeholder="Los detectives salvajes"
              />
            </Campo>
            <Campo
              label="Autor del libro"
              htmlFor="libro-autor"
              error={errorDe('libro.autor')}
              ayuda="Solo si es distinto de la persona invitada."
            >
              <input
                id="libro-autor"
                className={claseInput}
                value={form.libro.autor}
                onChange={(e) => set('libro', { ...form.libro, autor: e.target.value })}
                placeholder="Roberto Bolaño"
              />
            </Campo>
          </div>
        </div>
      )}
    </Seccion>
  );
}
