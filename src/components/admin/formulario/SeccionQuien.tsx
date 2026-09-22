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
 */
const AYUDA_INSTAGRAM = 'Podés pegar el link del perfil: al salir del campo queda «casabrandon».';

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
 * escrita del otro lado, y esto es su eco en la pantalla. Es el mismo patrón
 * que `CoordenadasSede` con `parsearCoordenadas` — el `onBlur` aplica una
 * función pura de `lib/` y el componente sigue siendo presentación.
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
 * ── Y hay un caso en que el saneador entiende de más — B-1160 ─────────────
 * `handleInstagram('casa#brandon')` devuelve `'casa'`: el corte por `?`/`#` se
 * aplica a cualquier valor y no solo a los que vienen con `instagram.com/`
 * adelante, así que un handle con un `#` adentro se recorta y apunta a **otra
 * cuenta**. El arreglo es del saneador y vive en B-1160, no acá: escribir una
 * guarda local sería la segunda implementación del alfabeto del handle, que es
 * justo lo que este archivo no hace.
 *
 * Lo que sí cambia con B-1144 es que **se ve**. Ese recorte ya ocurría —lo hace
 * `conHandle` al guardar desde B-928, en silencio y contra el documento—; desde
 * acá queda escrito en el campo, en la pantalla de quien carga, antes de
 * guardar. Es la única forma en que hoy se puede notar. El test de
 * `tests/seccionQuien.render.test.tsx` lo fija con ese nombre: cuando B-1160 se
 * arregle, ese caso se pone rojo y hay que darlo vuelta.
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
 * Solo escribe si el saneado difiere de lo tipeado. Un blur que no cambia nada
 * no toca el formulario, así que tabular por encima del campo no dispara el
 * «hay cambios sin guardar» de `useFormularioSucio` ni el autoguardado — la
 * misma precaución que el docblock de `GaleriaEditor` sobre medir al abrir.
 */
const alSalirDelInstagram = (crudo: string, guardar: (handle: string) => void): void => {
  const handle = handleInstagram(crudo);
  if (handle && handle !== crudo) guardar(handle);
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
