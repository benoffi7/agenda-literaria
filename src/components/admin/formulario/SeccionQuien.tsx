/**
 * Organizador siempre; tallerista o autor invitado según el tipo (§11), y el
 * libro presentado en presentación y charla (DEC-1).
 */
import { Campo, claseInput } from '@/components/admin/campos/Campo';
import { Seccion } from '@/components/admin/campos/Seccion';
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
    <Seccion ancla="quien" titulo="Quién">
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
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              label="Libro presentado"
              error={errorDe('libro.titulo')}
              ayuda="Se publica en el sitio y en el evento del calendario."
            >
              <input
                className={claseInput}
                value={form.libro.titulo}
                onChange={(e) => set('libro', { ...form.libro, titulo: e.target.value })}
                placeholder="Los detectives salvajes"
              />
            </Campo>
            <Campo
              label="Autor del libro"
              error={errorDe('libro.autor')}
              ayuda="Solo si es distinto de la persona invitada."
            >
              <input
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
