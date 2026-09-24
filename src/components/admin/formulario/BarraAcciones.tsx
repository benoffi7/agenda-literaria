/**
 * Barra de acciones del formulario: cancelar, guardar borrador, guardar.
 *
 * Fija abajo, con `pb-segura` para que en un iPhone no quede debajo de la barra
 * de gestos. En mobile los dos botones de guardado van a mitad y mitad del
 * ancho, y "Cancelar" pasa a una línea propia arriba: tres botones en fila en
 * 360 px dan blancos de ~100 px y se erra el toque.
 *
 * ── B-184 · el mensaje dice qué falta, y lleva hasta ahí ───────────────────
 * Antes decía «3 campos para revisar». La decisión escrita era esa —listar
 * rutas de campo tapaba media pantalla en mobile— y le faltaba un dato: cuatro
 * secciones arrancan colapsadas, así que el campo rechazado podía no estar en
 * ninguna parte de la pantalla. Ahora nombra los campos (pocos) o las secciones
 * con su cuenta (muchos), y cada nombre es un botón que abre la sección y
 * scrollea hasta el campo. El armado del texto vive en
 * `lib/formulario/camposFaltantes.ts`, que es donde se puede testear.
 *
 * ── B-264 · el tercer nivel, y por qué no es un cuarto rojo ───────────────
 * La barra ya decía dos cosas: lo que **frena** el guardado (rojo) y lo que va a
 * frenar la publicación (gris). El flyer no es ninguna de las dos —bloquear la
 * publicación por una imagen agrega fricción justo donde hace falta lo
 * contrario— pero el campo existía y no lo usaba nadie: 2 actividades de 42.
 *
 * Entonces entra un nivel más abajo del gris y con otra forma de decirlo: no
 * nombra lo que falta, nombra **lo que se pierde**. El texto vive en
 * `lib/formulario/recomendaciones.ts`, que es donde se testea.
 *
 * ── B-813 · lo que se pierde en Google, en una fila propia ───────────────
 * Debajo del consejo, y en el mismo momento —cuando no queda nada que frene—,
 * una fila más: «Se publica igual, pero en Google sale sin foto, quién la da ni
 * precio». Es propia y no un consejo más de la lista porque la barra muestra un
 * solo consejo, y este aviso junta cuatro datos: meterlo ahí lo habría escondido
 * detrás del flyer justo en la mitad de los casos.
 *
 * No frena y no es rojo, por D-440 y D-900: gris, con cada dato como botón que
 * lleva a su sección. Y no aparece en solo lectura: quien no puede guardar
 * tampoco puede cargar lo que falta, y un aviso sin acción es ruido. El qué y el
 * texto viven en `lib/formulario/enGoogle.ts`.
 *
 * ── B-1700 · la fila no cambia de texto a medio escribir ──────────────────
 * «(lo cargado no es una dirección)» depende de cómo quedó escrita la web, y
 * `https://…` a medio tipear no enlaza: la fila lo decía en cada tecla y lo
 * retiraba al final. Ahora, entre la primera tecla y la salida del campo, va la
 * etiqueta neutra (`mientrasSeEscribe`), y la variante aparece al salir — o
 * desde el vamos si la actividad ya la traía guardada. Es el `editando` de
 * `AvisoInstagram` (D-900), escuchado desde acá porque la barra no es dueña del
 * campo: el `input` y el `focusout` burbujean hasta el documento.
 */
import { useEffect, useState } from 'react';
import { claseBotonPrimario, claseBotonSecundario } from '@/components/campos/Campo';
import {
  nombraSecciones,
  type IdSeccion,
  type ResumenFaltantes,
} from '@/lib/formulario/camposFaltantes';
import {
  ENCABEZADO_EN_GOOGLE,
  etiquetaEnGoogle,
  separadorEnGoogle,
  type PerdidaEnGoogle,
} from '@/lib/formulario/enGoogle';
import type { Recomendacion } from '@/lib/formulario/recomendaciones';

interface Props {
  /** Hay un guardado en curso: los dos botones de guardar se apagan. */
  guardando: boolean;
  /** El motivo del último fallo, si no fue de validación. */
  fallo: string | null;
  /** Lo que el schema rechazó en el último intento, agrupado por sección. */
  faltantes: ResumenFaltantes;
  /**
   * Lo que le va a faltar para **publicar**, aunque ahora se pueda guardar
   * (B-183). Es aviso, no bloqueo: sin esto, los dos niveles de validación se
   * vuelven una trampa y el bloqueo aparece recién al final.
   */
  pendientesParaPublicar: ResumenFaltantes;
  /**
   * Lo que conviene tener y **no** frena nada (B-264). Se muestra cuando no hay
   * nada más urgente que decir, que es justo el momento en que alguien está por
   * publicar.
   */
  recomendaciones: Recomendacion[];
  /**
   * Lo que esta actividad no le va a dar a Google si se publica así (B-813).
   * Opcional para que las pantallas que montan la barra sin formulario no
   * tengan que inventarlo.
   */
  enGoogle?: PerdidaEnGoogle[];
  /** El formulario edita una actividad que ya existe. */
  esEdicion: boolean;
  /**
   * **B-919 — la ficha se mira y no se guarda.** Es una actividad de la ciudad
   * del publicador que cargó otra cuenta: la regla le da `read` y nada más.
   *
   * Con esto la barra no dibuja «Guardar borrador» ni «Guardar cambios», y dice
   * por qué. No es prolijidad: un botón que existe y **siempre** falla es peor
   * que no tenerlo (es el argumento entero de `rolDelPanel.ts`), y acá el fallo
   * llegaría después de veinte minutos de edición.
   */
  soloLectura?: boolean;
  onCancelar: () => void;
  onGuardarBorrador: () => void;
  /** Abrir la sección y scrollear hasta su primer campo pendiente. */
  onIrASeccion: (id: IdSeccion) => void;
}

/** Los nombres del mensaje, cada uno como botón que lleva a su sección. */
function Nombres({
  resumen,
  onIrASeccion,
}: {
  resumen: ResumenFaltantes;
  onIrASeccion: (id: IdSeccion) => void;
}) {
  const porSeccion = nombraSecciones(resumen);
  return (
    <>
      {resumen.secciones.map((s, i) => (
        <span key={s.id}>
          {i > 0 && ', '}
          <button
            type="button"
            onClick={() => onIrASeccion(s.id)}
            className="underline decoration-dotted underline-offset-2"
          >
            {porSeccion ? `${s.titulo} (${s.cantidad})` : s.etiquetas.join(', ')}
          </button>
        </span>
      ))}
      {/*
        Una ruta que el diccionario no conoce no se esconde: sin nombre no se
        puede llevar a ningún lado, pero decirla igual es mejor que un mensaje
        que avisa que falta algo y no dice qué.
      */}
      {resumen.sinUbicar.map((ruta) => (
        <span key={ruta}>, {ruta}</span>
      ))}
    </>
  );
}

/**
 * B-1700 — cuál de `campos` (ids del DOM) se está tipeando: se prende con la
 * primera tecla (`input`) y se apaga al salir (`focusout`), como el `editando` de
 * `SeccionQuien`. Enfocar sin tipear no lo prende: el valor sigue asentado.
 */
function useCampoEnEdicion(campos: readonly string[]): string | null {
  const [editando, setEditando] = useState<string | null>(null);
  const clave = campos.join(' ');
  useEffect(() => {
    const mirados = new Set(clave.split(' ').filter(Boolean));
    const alTipear = (e: Event) => {
      const id = (e.target as HTMLElement | null)?.id;
      if (id && mirados.has(id)) setEditando(id);
    };
    // Sin mirar `mirados`: si la web se volvió válida mientras se tipeaba, la
    // pérdida se fue de la lista, y salir del campo igual tiene que apagarlo.
    const alSalir = (e: Event) => {
      const id = (e.target as HTMLElement | null)?.id;
      if (id) setEditando((actual) => (actual === id ? null : actual));
    };
    document.addEventListener('input', alTipear);
    document.addEventListener('focusout', alSalir);
    return () => {
      document.removeEventListener('input', alTipear);
      document.removeEventListener('focusout', alSalir);
    };
  }, [clave]);
  return editando;
}

export function BarraAcciones({
  guardando,
  fallo,
  faltantes,
  pendientesParaPublicar,
  recomendaciones,
  enGoogle = [],
  esEdicion,
  soloLectura = false,
  onCancelar,
  onGuardarBorrador,
  onIrASeccion,
}: Props) {
  const hayFaltantes = faltantes.total > 0;
  const hayPendientes = pendientesParaPublicar.total > 0;
  const consejo = recomendaciones[0];
  // B-813 — el mismo momento que el consejo: cuando ya no queda nada que frene.
  const avisoEnGoogle =
    !soloLectura && !fallo && !hayFaltantes && !hayPendientes && enGoogle.length > 0;
  const editando = useCampoEnEdicion(
    enGoogle.flatMap((p) => (p.mientrasSeEscribe ? [p.mientrasSeEscribe.campo] : [])),
  );

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-borde bg-papel/95 px-segura pt-3 pb-segura backdrop-blur">
      <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row sm:items-center lg:max-w-4xl">
        <div
          role="status"
          className="min-w-0 text-xs empty:hidden sm:order-2 sm:flex-1 sm:text-center"
        >
          {fallo ? (
            <span className="text-acento">{fallo}</span>
          ) : hayFaltantes ? (
            <span className="text-acento">
              Falta completar: <Nombres resumen={faltantes} onIrASeccion={onIrASeccion} />
            </span>
          ) : hayPendientes ? (
            // Gris y no rojo: se puede guardar igual, es lo que va a faltar el
            // día que se publique.
            <span className="text-tinta/60">
              Para publicar falta:{' '}
              <Nombres resumen={pendientesParaPublicar} onIrASeccion={onIrASeccion} />
            </span>
          ) : consejo ? (
            /*
              B-264 — el último nivel. Mismo gris que «para publicar falta»
              porque tampoco frena nada, y con la misma forma de botón que lleva
              hasta el campo: un aviso que no dice dónde arreglarlo se lee una
              vez y se ignora.

              Dice **qué se pierde** y no qué falta, que es la diferencia entre
              «falta el flyer» —que no mueve a nadie— y «no entra en la
              cartelera».
            */
            <span className="text-tinta/60">
              Conviene cargar{' '}
              <button
                type="button"
                onClick={() => onIrASeccion(consejo.seccion)}
                className="underline decoration-dotted underline-offset-2"
              >
                {consejo.etiqueta}
              </button>
              : {consejo.porQue}.
            </span>
          ) : null}
          {avisoEnGoogle && (
            <span data-aviso="en-google" className="block text-tinta/60">
              {ENCABEZADO_EN_GOOGLE}{' '}
              {enGoogle.map((p, i) => (
                <span key={p.id}>
                  {separadorEnGoogle(i, enGoogle.length)}
                  <button
                    type="button"
                    onClick={() => onIrASeccion(p.seccion)}
                    className="underline decoration-dotted underline-offset-2"
                  >
                    {etiquetaEnGoogle(p, editando)}
                  </button>
                </span>
              ))}
              .
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onCancelar}
          className={`${claseBotonSecundario} sm:order-1`}
        >
          {soloLectura ? 'Volver' : 'Cancelar'}
        </button>

        {/*
          B-919 — sin los dos botones de guardar, y sin nada en su lugar. La
          explicación va arriba del formulario (`ActividadFormulario`), que es
          donde se lee al abrir; acá abajo un cartel sería un aviso que aparece
          cuando ya se intentó editar.

          **No se esconden con `hidden`, no se renderizan.** Lo cobró
          `tests/formulario-solo-lectura.render.test.tsx` el día que se escribió:
          un `className="hidden"` deja los dos botones **en el DOM**, o sea
          alcanzables con Tab y anunciados por un lector de pantalla, y visibles
          del todo si la hoja de estilos no llegó. «Que el botón no esté» tiene que
          significar que no está.
        */}
        {!soloLectura && (
          <div className="flex gap-2 sm:order-3">
            <button
              type="button"
              disabled={guardando}
              onClick={onGuardarBorrador}
              className={`${claseBotonSecundario} flex-1 sm:flex-none`}
            >
              Guardar borrador
            </button>
            <button
              type="submit"
              disabled={guardando}
              className={`${claseBotonPrimario} flex-1 sm:flex-none`}
            >
              {guardando ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Crear actividad'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
