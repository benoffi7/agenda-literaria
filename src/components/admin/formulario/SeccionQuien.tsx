/**
 * Organizador siempre; tallerista o autor invitado según el tipo (§11), y el
 * libro presentado en presentación y charla (DEC-1).
 */
import { Seccion } from '@/components/admin/campos-del-panel';
import { Campo, claseInput } from '@/components/campos/Campo';
import { handleInstagram } from '@/lib/enlaceSeguro';
import { muestraLibro } from '@/lib/formulario/condicionales';
import type { PropsSeccion } from '@/components/admin/formulario/PropsSeccion';

type Props = Omit<PropsSeccion, 'uid'> & {
  esTaller: boolean;
  esCharla: boolean;
  /** "Tallerista" o "Autor o autora invitada", según el tipo. */
  nombrePersona: string;
};

/**
 * Lo que se lee debajo de los dos campos de Instagram. Es la ayuda corta de un
 * campo puntual, así que va en la prop `ayuda` de `Campo` y no en `ayuda.ts`
 * (regla de proceso, `docs/05-patrones.md`): se lee al lado del campo, que es
 * donde importa.
 *
 * **Nombra las dos ramas, y la segunda no es un adorno.** Lo señaló el
 * `auditor-privacidad`: una ayuda que promete solo «queda casabrandon» convierte
 * «no pasó nada» en «el sistema lo revisó y estaba bien», y el valor que el
 * saneador no reconoce es exactamente el que sale **crudo** a la descripción del
 * evento de Calendar (B-1145) y al pie del posteo para redes (B-1142). Antes de
 * B-1144 ver el link pegado tal cual no significaba nada; con media ayuda pasaría
 * a significar lo contrario de lo que pasa. La corrección al vuelo no puede
 * comerse la única señal que queda, porque D-767 ya decidió que acá no se frena
 * nada.
 */
const AYUDA_INSTAGRAM =
  'Podés pegar el link del perfil: al salir del campo queda «casabrandon». ' +
  'Si el campo no cambia es que no lo reconocimos — revisalo, se publica tal cual.';

/**
 * **El Instagram se corrige al salir del campo** — B-1144, D-767.
 *
 * Quien pega `https://www.instagram.com/casabrandon/?igsh=…` —el botón
 * «Compartir» de Instagram, que es la forma real en que se copia una cuenta—
 * ve `casabrandon` en cuanto sale del campo. El saneador es `handleInstagram`,
 * el mismo de las cuatro guías, de la ficha pública (B-1141) y de la bandeja de
 * propuestas: acá no hay un regex propio, porque una segunda implementación del
 * alfabeto del handle es la clase de bug de B-88.
 *
 * ── Esto no inventa una regla: muestra la que ya existe ────────────────────
 * `formADocumento` normaliza este mismo campo con este mismo saneador desde
 * B-928 (`lib/actividades.ts`, `conHandle`). O sea que lo guardado ya salía
 * como handle; lo que faltaba era **verlo antes de guardar**. Por eso la
 * corrección vive acá y no en `lib/formulario/`: la regla del modelo ya está
 * escrita del otro lado, y esto es su eco en la pantalla. Es el principio de
 * `CoordenadasSede` con `parsearCoordenadas` —el `onBlur` aplica una función
 * pura de `lib/` y el componente sigue siendo presentación—, con el mecanismo
 * cambiado porque allá hay un buffer `texto` que se vacía al acertar y acá el
 * campo **es** el valor del formulario: lo que evita reescribir de más no es el
 * buffer sino la comparación de abajo.
 *
 * ── Lo que el saneador no entiende NO se toca, y es a propósito ────────────
 * `handleInstagram` devuelve `null` para lo que no reconoce —«Casa Brandon /
 * IG», un handle con una barra adentro, un link a un posteo—. En ese caso el
 * campo **queda exactamente como se tipeó**: no se borra, no se recorta y no se
 * frena nada. Borrarlo sería perder la única copia de lo que alguien escribió
 * para castigar un formato, y dejaría a quien edita sin saber qué corregir; es
 * el mismo criterio que `conHandle` al guardar y que `arrobaInstagram` al
 * mostrar. Si aparece un valor así, se publica igual: la actividad sale, y en
 * la ficha ese texto se muestra sin arroba y sin link, que es el aviso.
 *
 * ── El caso en que el saneador entendía de más — B-1160, ya cerrado ───────
 * Hasta B-1160, `handleInstagram` cortaba por `?`/`#` cualquier valor, y
 * `casa#brandon` quedaba en `casa`: **la cuenta de otra persona**. Desde B-1160
 * el corte va solo detrás de `instagram.com/`, así que ese valor queda como se
 * tipeó. El arreglo fue del saneador y no de acá —una guarda local habría sido
 * la segunda implementación del alfabeto del handle—, y el test de
 * `tests/seccionQuien.render.test.tsx` fija el caso ya dado vuelta.
 *
 * ── El costo aceptado, escrito acá para que no se lea como un descuido ─────
 * D-767 — este campo queda con un criterio **distinto** del de las cuatro guías
 * (librerías, bibliotecas, lugares, suscripciones), que sí frenan el publicado
 * con una regla en su `superRefine` cuando el Instagram no es un handle. Son
 * dos criterios para el mismo dato en el mismo panel: acá se corrige, allá se
 * frena. El dueño eligió esto el 2026-09-22, con el costo a la vista y contra
 * la recomendación, porque publicar una actividad no puede depender de cómo se
 * tipeó una cuenta de Instagram. No es una inconsistencia que quedó: es la
 * decisión.
 *
 * ── La expresión es la misma que la de `conHandle`, letra por letra ───────
 * `handleInstagram(crudo) ?? crudo.trim()`, y eso incluye el `.trim()` del
 * caso no reconocido. Lo señaló el `auditor-trampas`: con `?? crudo` a secas,
 * «Casa Brandon / IG » se quedaba con el espacio en pantalla y lo perdía al
 * guardar, así que el campo mostraba una cosa y el documento guardaba otra. Es
 * cosmético, pero un campo que miente sobre lo que va a guardar es justo lo que
 * este ítem vino a cerrar: la promesa acá es **lo que ves es lo que se
 * guarda**, y para eso las dos expresiones tienen que ser la misma. Sacar el
 * texto no es tocarlo: no se pierde nada de lo que alguien escribió.
 *
 * Solo escribe si el saneado difiere de lo tipeado. Un blur que no cambia nada
 * no toca el formulario, así que tabular por encima del campo no dispara el
 * «hay cambios sin guardar» de `useFormularioSucio` ni el autoguardado — la
 * misma precaución que el docblock de `GaleriaEditor` sobre medir al abrir.
 */
const alSalirDelInstagram = (crudo: string, guardar: (saneado: string) => void): void => {
  // La misma expresión que `conHandle` (`lib/actividades.ts`), a propósito: si
  // las dos se separan, el campo vuelve a mostrar algo distinto de lo guardado.
  const saneado = handleInstagram(crudo) ?? crudo.trim();
  if (saneado !== crudo) guardar(saneado);
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
        <Campo label="Instagram del organizador" htmlFor="org-instagram" ayuda={AYUDA_INSTAGRAM}>
          <input
            id="org-instagram"
            className={claseInput}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            value={form.organizador.instagram}
            onChange={(e) => set('organizador', { ...form.organizador, instagram: e.target.value })}
            // B-1144 — el saneado va al salir del campo y no en cada tecla: a
            // medio tipear, `instagram.com/ca` todavía no es nada, y recortarlo
            // mientras alguien escribe le mueve el cursor de abajo de los dedos.
            onBlur={(e) =>
              alSalirDelInstagram(e.target.value, (handle) =>
                set('organizador', { ...form.organizador, instagram: handle }),
              )
            }
            placeholder="@casabrandon o el link del perfil"
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
            <Campo label="Instagram" htmlFor="persona-instagram" ayuda={AYUDA_INSTAGRAM}>
              <input
                id="persona-instagram"
                className={claseInput}
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                value={form.tallerista?.instagram ?? ''}
                onChange={(e) =>
                  set('tallerista', {
                    nombre: form.tallerista?.nombre ?? '',
                    bio: form.tallerista?.bio ?? '',
                    instagram: e.target.value,
                  })
                }
                // El mismo saneo que el del organizador, y por eso pasa por la
                // misma función: son dos campos del mismo dato, y una copia acá
                // es la que se olvida de corregir el día que cambie la regla.
                onBlur={(e) =>
                  alSalirDelInstagram(e.target.value, (handle) =>
                    set('tallerista', {
                      nombre: form.tallerista?.nombre ?? '',
                      bio: form.tallerista?.bio ?? '',
                      instagram: handle,
                    }),
                  )
                }
                placeholder="@casabrandon o el link del perfil"
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
