/**
 * §3.2 — trabajo interno: no sale al sitio público ni al calendario (§5.1).
 */
import { Campo, claseInput } from '@/components/admin/campos/Campo';
import { Seccion } from '@/components/admin/campos/Seccion';
import type { PropsSeccion } from '@/components/admin/formulario/PropsSeccion';

type Props = Pick<PropsSeccion, 'form' | 'set'>;

export function SeccionDifusion({ form, set }: Props) {
  return (
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
  );
}
