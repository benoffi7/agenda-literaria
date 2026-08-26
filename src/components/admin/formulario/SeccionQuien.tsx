/**
 * Organizador siempre; tallerista o autor invitado según el tipo (§11).
 */
import { Campo, claseInput } from '@/components/admin/campos/Campo';
import { Seccion } from '@/components/admin/campos/Seccion';
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
    </Seccion>
  );
}
