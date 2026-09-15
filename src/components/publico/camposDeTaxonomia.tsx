import { useState } from 'react';
import { claseInput } from '@/components/campos/Campo';
import { slugify } from '@/lib/slugify';

/**
 * **Los dos controles de taxonomía del lado público** — `/guia/<x>/sumar`.
 *
 * El panel tiene `TaxonomiaSelect` y `TagsInput` (`admin/campos-del-panel.tsx`)
 * y **no se pueden reusar acá**: importan `useOpciones`, que lee `/opciones/*`
 * en vivo con el SDK de Firestore. Traerlos al sitio arrastraría Firebase al
 * árbol **estático** de una página pública, o sea App Check inicializándose para
 * cualquiera que mire (`tests/panel-fuera-del-sitio.test.ts`). Estos dos
 * **reciben** las opciones, leídas en el build y pasadas como prop — el mismo
 * reparto que `/proponer` hace con `incluyeOfrecido`.
 *
 * ── La diferencia que importa: acá «Otro…» NO da de alta la opción ────────
 * En el panel, escribir una etiqueta nueva la persiste en `/opciones/{campo}`
 * con `upsertOpcion` (D-02, y olvidarse de eso fue B-914). Acá no puede pasar:
 * un anónimo no escribe en `/opciones/*` —es un documento **compartido por todo
 * el sitio**, del que salen los chips de filtro (§4.4), y a nivel de regla
 * «agregar un valor» y «reescribir la taxonomía entera» son el mismo permiso
 * (B-893)—. Así que lo que se tipea viaja **slugueado adentro de la ficha** y
 * nada más; la etiqueta la da de alta el admin al publicarla, que es cuando hay
 * alguien mirando si «Villa Crespo» ya existe escrito de otra forma.
 *
 * Es la misma decisión que `/proponer` tomó con «qué se llevan»: «quien propone
 * **no puede crear una**: lo que no esté en la lista va al texto libre y el
 * admin decide si merece entrar a la taxonomía».
 *
 * ── Y por qué igual hay «Otro…», en vez de un `<select>` a secas ──────────
 * Porque `/opciones/barrio` **arranca vacío** (`opciones-base.json`): se llena a
 * medida que el dueño carga actividades. Un desplegable cerrado dejaría el
 * formulario inguardable el primer día y, después, cada vez que alguien quiera
 * sumar una librería de un barrio que todavía no tuvo ninguna actividad. El
 * schema exige que el valor sea un slug, así que lo que se tipea se slugifica
 * **acá** — si se guardara crudo, `formaDeLibreria()` lo rechazaría con un
 * «Elegí el barrio de la lista» que no explica nada.
 */

export interface OpcionOfrecida {
  slug: string;
  label: string;
}

/** El valor centinela del `<option>` que revela el campo libre. */
const OTRO = '__otro__';

interface UnaProps {
  id: string;
  /** Las que ya existen, leídas en el build. Puede venir vacía. */
  opciones: readonly OpcionOfrecida[];
  /** El slug elegido, o `''`. */
  value: string;
  onChange: (slug: string) => void;
  /** Qué dice la opción vacía: «Elegí el barrio», «Elegí el tipo de lugar». */
  placeholder: string;
}

/**
 * Un valor de una taxonomía: desplegable con lo que ya existe, más «Otro…».
 *
 * El modo libre se recuerda en un `useState` y no se deriva de «el valor no está
 * en la lista»: derivarlo haría que el campo se cerrara solo mientras alguien
 * está tipeando —cada tecla produce un slug que tampoco está en la lista, hasta
 * que coincide con uno por casualidad— y esa clase de salto es la que hace que
 * un formulario se sienta roto sin que nada falle.
 */
export function CampoDeTaxonomia({ id, opciones, value, onChange, placeholder }: UnaProps) {
  const [libre, setLibre] = useState(false);
  const [tipeado, setTipeado] = useState('');

  if (libre) {
    return (
      <div className="flex flex-col gap-2">
        <input
          id={id}
          className={claseInput}
          value={tipeado}
          placeholder="Escribilo como se dice"
          onChange={(e) => {
            setTipeado(e.target.value);
            // Se slugifica acá: lo que el schema y la regla esperan es el slug,
            // y lo que la persona escribe es la etiqueta.
            onChange(slugify(e.target.value));
          }}
        />
        {opciones.length > 0 && (
          <button
            type="button"
            className="self-start text-sm text-acento underline decoration-2 underline-offset-4"
            onClick={() => {
              setLibre(false);
              setTipeado('');
              onChange('');
            }}
          >
            Volver a la lista
          </button>
        )}
      </div>
    );
  }

  return (
    <select
      id={id}
      className={claseInput}
      value={value}
      onChange={(e) => {
        if (e.target.value === OTRO) {
          setLibre(true);
          onChange('');
          return;
        }
        onChange(e.target.value);
      }}
    >
      <option value="">{placeholder}</option>
      {opciones.map((o) => (
        <option key={o.slug} value={o.slug}>
          {o.label}
        </option>
      ))}
      <option value={OTRO}>Otro…</option>
    </select>
  );
}

interface VariasProps {
  id: string;
  opciones: readonly OpcionOfrecida[];
  /** Los slugs elegidos. */
  value: readonly string[];
  onChange: (slugs: string[]) => void;
}

/**
 * Varios valores de una taxonomía: casillas.
 *
 * **Sin «Otro…»**, y eso no es una omisión: los tres modelos que lo usan tienen
 * al lado un campo de texto libre propio (`incluyeOtro`, `extrasOtro`) que es
 * exactamente para esto, y que el admin lee al revisar. Dos caminos para «lo que
 * no está en la lista» serían dos lugares donde termina el mismo dato.
 *
 * Casillas y no un `<select multiple>`: en un teléfono, un `multiple` nativo es
 * de los controles menos usables que hay, y acá del otro lado hay alguien que
 * entró una sola vez.
 */
export function CampoDeEtiquetas({ id, opciones, value, onChange }: VariasProps) {
  if (opciones.length === 0) return null;
  return (
    <ul id={id} className="flex flex-col gap-2">
      {opciones.map((o) => {
        const puesto = value.includes(o.slug);
        return (
          <li key={o.slug}>
            <label className="flex min-h-touch items-center gap-2">
              <input
                type="checkbox"
                checked={puesto}
                onChange={() =>
                  onChange(
                    puesto ? value.filter((s) => s !== o.slug) : [...value, o.slug],
                  )
                }
              />
              <span className="body-md text-super">{o.label}</span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}
