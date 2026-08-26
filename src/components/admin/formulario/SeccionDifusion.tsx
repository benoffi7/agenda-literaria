/**
 * §3.2 — trabajo interno: no sale al sitio público ni al calendario (§5.1).
 */
import { Campo, claseInput } from '@/components/admin/campos/Campo';
import { ChipsInput } from '@/components/admin/campos/ChipsInput';
import { Seccion } from '@/components/admin/campos/Seccion';
import type { PropsSeccion } from '@/components/admin/formulario/PropsSeccion';

type Props = Pick<PropsSeccion, 'form' | 'set'> & {
  /**
   * B-184 — sube cuando la barra manda a un campo de esta sección: arranca
   * cerrada, y un error adentro de un acordeón cerrado no se ve en ninguna
   * parte de la pantalla.
   */
  pedidoDeApertura?: number;
};

export function SeccionDifusion({ form, set, pedidoDeApertura }: Props) {
  return (
    <Seccion
      ancla="difusion"
      pedidoDeApertura={pedidoDeApertura}
      titulo="Difusión"
      descripcion="Uso interno. Nunca sale al sitio público ni al calendario."
      colapsable
      abiertaPorDefecto={false}
      insignia="interno"
    >
      <div className="grid gap-4">
        <Campo
          label="Arrobar al publicar"
          ayuda="Enter o coma para agregar. Backspace borra el último."
        >
          <ChipsInput
            value={form.difusion.arrobar}
            onChange={(arrobar) => set('difusion', { ...form.difusion, arrobar })}
            placeholder="@casabrandon"
            etiquetaQuitar={(h) => `Dejar de arrobar a ${h}`}
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
