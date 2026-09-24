/**
 * El campo de fecha y hora del panel, en 24 o en 12 horas — B-889, **D-720**.
 *
 * Envuelve al `<input type="datetime-local">` de siempre y, **solo cuando
 * corresponde** (`usaControlDeHoraPropio`), lo reemplaza por cuatro piezas:
 * fecha, hora, minutos y AM/PM. En cualquiera de los dos casos lo que sale por
 * `onChange` es **el mismo string de `datetime-local`** que el formulario ya
 * manejaba, así que del control para adentro no cambió nada — el punto 4 de
 * D-720, y la trampa 1.
 *
 * ── Por qué hay estado local, si el componente es controlado ──────────────
 * Porque el valor de afuera es **el compuesto**, y las piezas se tipean de a
 * una. Con `value` como única fuente, escribir la hora antes que la fecha
 * borraría lo tipeado en cada tecla: `dePiezas` de un campo incompleto es `''`
 * —a propósito, es lo que el schema lee como «falta»— y ese `''` volvería como
 * `value` y vaciaría la cajita. Así que las piezas viven acá mientras están a
 * medio llenar, y se resincronizan cuando el valor de afuera dice otra cosa.
 *
 * El estado guarda **con qué formato se armó**: sin eso, pasar de 24 a 12 con
 * una hora que vale en los dos (`07:30`) dejaría la cajita mostrando `07` en un
 * reloj de 12, porque el valor compuesto no cambió y nada pediría rearmar.
 *
 * ── La accesibilidad no se inventa acá ────────────────────────────────────
 * `Campo` ya sabe presentar varios controles como uno solo: `comoGrupo` emite
 * `role="group"` + `aria-labelledby` contra el rótulo. Lo que agrega este
 * componente es el nombre de **cada** pieza (`aria-label`), porque «Inicio» es
 * el nombre del grupo y no el de la cajita de los minutos. Las cuatro heredan
 * el `min-h-touch` de `claseInput` (punto 3 de D-720).
 *
 * ── Lo que se tipea en la cajita de la hora ───────────────────────────────
 * `20` vale y queda `8 PM` (B-1234). Interpretar la hora de 24 no es una
 * comodidad: sin eso, el segundo dígito sacaba el valor de rango y **vaciaba la
 * fecha entera sin decir nada**, con la cajita mostrando `20` como si estuviera
 * cargada. La regla es de `horaTipeadaEn12`; acá se llama y nada más.
 *
 * ── Lo que no tiene lectura se dice ───────────────────────────────────────
 * Un `25` en la hora o un `75` en los minutos no se convierten —son typos—, pero
 * tampoco se callan (B-1236): con los dos dígitos puestos, el campo muestra el
 * error por el mismo canal que los del schema y marca la cajita con
 * `aria-invalid`. Qué pieza y qué mensaje decide `piezaFueraDeRango`, pura.
 *
 * ── El eco ────────────────────────────────────────────────────────────────
 * Debajo del control, lo que quedó cargado escrito en palabras. Era la opción
 * que se recomendó y el dueño no eligió; entra adentro de ésta porque un control
 * que dibujamos nosotros necesita confirmar lo que entendió más que uno que
 * garantiza el navegador. **Se muestra solo con el control propio**: al lado del
 * nativo sería repetir en palabras lo que el navegador ya dibuja.
 */
import { useEffect, useState } from 'react';
import { Campo, claseInput } from '@/components/campos/Campo';
import {
  aPiezas,
  dePiezas,
  ecoDeFechaYHora,
  horaTipeadaEn12,
  MERIDIANOS,
  piezaFueraDeRango,
  usaControlDeHoraPropio,
  type FormatoDeHora,
  type Meridiano,
  type PiezasDeFechaYHora,
} from '@/lib/formatoDeHora';
import { type VistaDelPanel } from '@/lib/vistaDelPanel';

interface Props {
  /** El rótulo del campo entero: «Inicio», «Fin», «La inscripción cierra». */
  label: string;
  /** Base de los ids de las piezas, y `htmlFor` del rótulo. */
  id: string;
  /** El valor compuesto, en formato `datetime-local`. */
  value: string;
  onChange: (valor: string) => void;
  formato: FormatoDeHora;
  vista: VistaDelPanel;
  error?: string;
  ayuda?: string;
  requerido?: boolean;
}

/** Solo dígitos, y a lo sumo dos: lo que se puede tipear en una hora o un minuto. */
const soloDosDigitos = (texto: string): string => texto.replace(/\D/g, '').slice(0, 2);

export function CampoDeFechaYHora({
  label,
  id,
  value,
  onChange,
  formato,
  vista,
  error,
  ayuda,
  requerido,
}: Props) {
  const propio = usaControlDeHoraPropio(formato, vista);

  const [estado, setEstado] = useState<{ formato: FormatoDeHora; piezas: PiezasDeFechaYHora }>(
    () => ({ formato, piezas: aPiezas(value, formato) }),
  );

  useEffect(() => {
    // Ver el docblock: se rearma cuando cambia el formato, o cuando el valor de
    // afuera dejó de ser el que componen estas piezas (cargar otra actividad,
    // restaurar un borrador, el botón de generar encuentros).
    if (estado.formato !== formato || dePiezas(estado.piezas, formato) !== value) {
      setEstado({ formato, piezas: aPiezas(value, formato) });
    }
    // `estado` queda afuera a propósito: es lo que este efecto escribe, y
    // mirarlo lo volvería a disparar sobre su propio resultado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, formato]);

  if (!propio) {
    return (
      <Campo label={label} htmlFor={id} error={error} ayuda={ayuda} requerido={requerido}>
        <input
          id={id}
          type="datetime-local"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={claseInput}
        />
      </Campo>
    );
  }

  const editar = (cambio: Partial<PiezasDeFechaYHora>) => {
    const piezas = { ...estado.piezas, ...cambio };
    setEstado({ formato, piezas });
    onChange(dePiezas(piezas, formato));
  };

  /**
   * La cajita de la hora, que es la única que interpreta lo tipeado — B-1234.
   *
   * `20` se guarda como `8` + PM en vez de vaciar la fecha en silencio. La
   * decisión —cuándo convertir y cuándo no tocar el meridiano— vive entera en
   * `horaTipeadaEn12`, pura y con test: acá solo se cablea, porque el JSX es
   * justamente donde una regla así deja de poder probarse.
   */
  const editarHora = (texto: string) => {
    const { hora, meridiano } = horaTipeadaEn12(soloDosDigitos(texto), estado.piezas.meridiano);
    editar({ hora, meridiano });
  };

  const eco = ecoDeFechaYHora(value);

  /*
   * B-1236: una pieza imposible le gana al error de afuera, porque es más
   * precisa — el schema solo sabe decir «falta la fecha», y la causa es que la
   * cajita de los minutos dice `75`. Va por `Campo` y no por un `<p>` propio para
   * que sea el mismo `role="alert"` y el mismo `data-campo-con-error` que usa el
   * scroll al primer error (B-184).
   */
  const fueraDeRango = piezaFueraDeRango(estado.piezas, formato);

  /*
   * El rótulo del grupo necesita **su propio** id: `Campo comoGrupo` lo pone en
   * un `<span>` y lo referencia con `aria-labelledby`, así que reusar el `id`
   * del campo lo duplicaría con el `<input>` de la fecha. Dos elementos con el
   * mismo id es DOM inválido y, peor, deja al lector de pantalla resolviendo
   * cuál de los dos nombra al grupo.
   */
  const idDelRotulo = `${id}-rotulo`;

  return (
    <Campo
      label={label}
      htmlFor={idDelRotulo}
      comoGrupo
      error={fueraDeRango?.mensaje ?? error}
      ayuda={ayuda}
      requerido={requerido}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <input
          id={id}
          type="date"
          value={estado.piezas.fecha}
          onChange={(e) => editar({ fecha: e.target.value })}
          aria-label={`${label} — fecha`}
          className={`${claseInput} basis-full sm:basis-auto sm:flex-1`}
        />
        <input
          id={`${id}-hora`}
          type="text"
          inputMode="numeric"
          maxLength={2}
          placeholder="7"
          value={estado.piezas.hora}
          onChange={(e) => editarHora(e.target.value)}
          aria-invalid={fueraDeRango?.pieza === 'hora' || undefined}
          aria-label={`${label} — hora, de 1 a 12`}
          className={`${claseInput} w-14 text-center`}
        />
        <span aria-hidden="true" className="text-sm text-tinta/65">
          :
        </span>
        <input
          id={`${id}-minutos`}
          type="text"
          inputMode="numeric"
          maxLength={2}
          placeholder="30"
          value={estado.piezas.minutos}
          onChange={(e) => editar({ minutos: soloDosDigitos(e.target.value) })}
          aria-invalid={fueraDeRango?.pieza === 'minutos' || undefined}
          aria-label={`${label} — minutos`}
          className={`${claseInput} w-14 text-center`}
        />
        <select
          id={`${id}-meridiano`}
          value={estado.piezas.meridiano}
          onChange={(e) => editar({ meridiano: e.target.value as Meridiano })}
          aria-label={`${label} — AM o PM`}
          className={`${claseInput} w-auto`}
        >
          {MERIDIANOS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
      {eco && (
        // `aria-live` no: el eco cambia con cada tecla y anunciarlo sería
        // interrumpir a quien está tipeando. Se lee al salir del grupo, que es
        // cuando sirve.
        <p className="text-xs text-tinta/65">{eco}</p>
      )}
    </Campo>
  );
}
