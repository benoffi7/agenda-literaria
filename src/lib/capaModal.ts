import { useEffect, useRef, type RefObject } from 'react';
import { SELECTOR_ENFOCABLE, indiceDeTab } from '@/lib/foco';

/**
 * El cableado de una capa modal: atrapar el Tab, cerrar con Escape, frenar el
 * scroll de atrás y devolver el foco al cerrarse — B-210.
 *
 * **Vive en `lib/` y no en `components/admin/` desde B-238** (2026-09-03): la
 * hoja inferior de filtros del sitio público es la tercera capa modal del
 * repo y la primera fuera del panel. Este archivo es puro (React + DOM, cero
 * dependencia de Firebase o del panel), así que mudarlo no cruza ninguna
 * frontera real — la frontera que importa (`firebase-admin` nunca al
 * cliente, §5.4) sigue intacta. El ítem original pedía lo contrario —«el
 * sitio público es donde este componente se hace bien de entrada, y después
 * resuelve los dos del panel»— pero el panel llegó primero (B-210); mover el
 * hook ahora es más barato que escribir una tercera copia del cableado, que
 * es exactamente la clase de bug que este archivo existe para cerrar.
 *
 * ── Por qué existe ────────────────────────────────────────────────────────
 * `src/lib/foco.ts` comparte la **aritmética** del foco a propósito, y su
 * docblock dice que la parte que toca el DOM "queda en cada componente, que es
 * donde está el `ref`". Esa decisión era correcta con **una** capa. Con dos, las
 * ~40 líneas que tocan el DOM quedaron copiadas verbatim en `DialogoDuplicar` y
 * en `ayuda/CentroAyuda`.
 *
 * Y ya habían divergido en lo que importa: **una copia tenía el arreglo y la otra
 * no.** `DialogoDuplicar` guardaba el callback en un `ref` con deps `[]`;
 * `CentroAyuda` se quedó con `[onCerrar]`, y `BotonAyuda` le pasa una flecha
 * inline. Con eso, cualquier re-render del padre mientras la capa está abierta
 * corría la limpieza —devolviendo el foco al abridor y soltando el scroll— y
 * volvía a montar el efecto, robándole el foco a lo que la persona estuviera
 * usando. En la ayuda se veía al marcar las novedades como leídas: eso cambia el
 * estado de `BotonAyuda`, así que el foco saltaba solo y el scroll parpadeaba.
 *
 * La lección, que es el motivo de este archivo y no del bug puntual: **compartir
 * la mitad fácil de escribir mal no alcanza si la otra mitad también lo es.** La
 * aritmética estaba compartida y aun así el bug apareció, porque estaba en el
 * cableado.
 *
 * ── Lo que hace, y por qué así ────────────────────────────────────────────
 * - **El callback vive en un `ref` y el efecto se engancha una sola vez.** Es el
 *   arreglo de arriba, ahora para las dos capas y para la próxima. Quien la
 *   escriba puede pasar una flecha inline sin pensarlo, que es lo que uno hace.
 * - **Los enfocables se recalculan en cada Tab**, no se congelan al abrir: las
 *   pestañas y el acordeón de la guía cambian la lista con la capa abierta, así
 *   que una lista de apertura estaría mal casi siempre.
 * - **Solo se intercepta el Tab del borde.** Adentro, el Tab nativo respeta el
 *   orden del documento mejor que cualquier cálculo propio.
 * - **`overflow: hidden` en el body**, o la rueda del mouse sobre la capa
 *   scrollea la pantalla de atrás. Se guarda el valor previo en vez de asumir
 *   `''`, para no pisar un `overflow` que ponga otra cosa.
 *
 * @param caja  El contenedor de la capa. Tiene que tener `tabIndex={-1}` para
 *              poder recibir el foco al abrirse sin ser una parada de Tab.
 * @param alCerrar  Qué hacer con `Escape`. Puede ser una flecha inline.
 * @param activo  Default `true` — las dos capas del panel no lo pasan y se
 *                comportan exactamente igual que antes de B-238. Existe para
 *                un consumidor cuya caja **sigue montada** cuando no es un
 *                modal: la hoja de filtros del sitio público es, en `lg`, un
 *                panel siempre visible del riel y no una capa — con `activo`
 *                en `false` el hook no atrapa el Tab ni bloquea el scroll de
 *                una página que no tiene ningún diálogo abierto. Sin este
 *                parámetro, esa capa necesitaría montarse y desmontarse por
 *                completo solo para prender y apagar el cableado, duplicando
 *                sus ~80 líneas de controles entre la versión de escritorio y
 *                la de teléfono.
 */
export function useCapaModal(
  caja: RefObject<HTMLElement | null>,
  alCerrar: () => void,
  activo = true,
): void {
  /*
   * El ref se actualiza en cada render, así que el efecto siempre llama a la
   * versión de hoy sin necesitar la función en sus dependencias. Es la mitad que
   * hace que `[]` sea correcto y no un olvido.
   */
  const cerrar = useRef(alCerrar);
  cerrar.current = alCerrar;

  useEffect(() => {
    if (!activo) return;
    // Quién tenía el foco antes de abrir, para devolvérselo al cerrar.
    const anterior = document.activeElement as HTMLElement | null;

    const teclas = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cerrar.current();
        return;
      }
      if (e.key !== 'Tab') return;

      const enfocables = [
        ...(caja.current?.querySelectorAll<HTMLElement>(SELECTOR_ENFOCABLE) ?? []),
      ];
      if (enfocables.length === 0) return;

      // `actual === -1` es el foco en la caja, recién abierta.
      const actual = enfocables.indexOf(document.activeElement as HTMLElement);
      const enElBorde =
        actual === -1 || (e.shiftKey ? actual === 0 : actual === enfocables.length - 1);
      if (!enElBorde) return;

      e.preventDefault();
      enfocables[indiceDeTab(actual, enfocables.length, e.shiftKey)]?.focus();
    };

    document.addEventListener('keydown', teclas);
    const previo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    caja.current?.focus();

    return () => {
      document.removeEventListener('keydown', teclas);
      document.body.style.overflow = previo;
      anterior?.focus();
    };
    // `activo` sí va en las deps: es lo que hace que el efecto se enganche y
    // se limpie en cada transición false→true→false, como un mount/unmount
    // real. `alCerrar` no va — ver `cerrar` — y `caja` es un ref estable.
  }, [caja, activo]);
}

/**
 * La entrada de historial de una capa: el botón atrás del teléfono la cierra en
 * vez de sacar a la persona del sitio — B-720.
 *
 * ── Por qué esto vive acá y no en el componente ───────────────────────────
 * El cableado ya existía, escrito a mano dentro de `Buscador.tsx` para la hoja
 * de filtros (B-238): un `pushState` al abrir, un listener de `popstate` que
 * cierra, y `history.back()` cuando el cierre lo pide la UI, para que los dos
 * caminos dejen el historial igual. El visor de la galería (B-720) es la
 * **segunda** capa que lo necesita, y una segunda copia del mismo cableado es
 * exactamente el bug que este archivo existe para no repetir — la lección del
 * docblock de arriba, otra vez y con la otra mitad.
 *
 * **La hoja de filtros todavía no lo usa**, y está dicho para que no parezca
 * olvido: su versión arrastra una guarda propia (`cerrandoLaHoja`) porque su URL
 * lleva los filtros elegidos, así que el `popstate` que restaura la URL de antes
 * de abrir le pisaría la selección. Migrarla es un cambio con riesgo propio y va
 * en su ítem (**B-750**); lo que se comparte hoy es el caso general, que es el
 * del visor: una capa cuya URL no cambia.
 *
 * ── El caso general, y por qué no hace falta la bandera de la hoja ────────
 * Cuando la capa se abre se empuja **una** entrada, con la misma URL. Cerrar es
 * siempre `history.back()`, y eso lo hace la limpieza del efecto: o sea que
 * `Escape`, el botón de cerrar, el click en el fondo y hasta el desmontaje del
 * componente pasan por el mismo camino sin que ninguno tenga que acordarse. El
 * botón atrás **real** llega como `popstate`, y ahí la bandera `nuestra` ya
 * quedó en `false` cuando corre la limpieza, así que no se dispara un segundo
 * `history.back()` que sacaría a la persona del sitio — el modo de falla que
 * `entradaPropia` cuida en la hoja de filtros.
 *
 * Las flechas que recorren las imágenes **no** empujan historial, por el mismo
 * criterio con el que veinte toques de filtro no son veinte entradas (§6.2 del
 * diseño): el botón atrás cierra la capa, no deshace una foto.
 *
 * @param abierta  Si la capa está abierta. La entrada se empuja en la
 *                 transición a `true` y se deshace en la de vuelta.
 * @param alCerrar Qué hacer cuando el botón atrás cierra la capa. Puede ser una
 *                 flecha inline: vive en un `ref` por el mismo motivo que en
 *                 `useCapaModal`.
 */
export function useHistorialDeCapa(abierta: boolean, alCerrar: () => void): void {
  const cerrar = useRef(alCerrar);
  cerrar.current = alCerrar;

  /**
   * ¿La entrada del historial sigue siendo **nuestra**? — la guarda de B-238,
   * acá con una sola responsabilidad. Sin ella, un `popstate` real (el botón
   * atrás) cerraría la capa y la limpieza del efecto haría **otro**
   * `history.back()`, sacando a la persona de la página.
   */
  const nuestra = useRef(false);

  useEffect(() => {
    if (!abierta) return;
    window.history.pushState({ capaModal: true }, '', window.location.href);
    nuestra.current = true;

    const alVolver = () => {
      // El navegador ya consumió la entrada: no queda nada que deshacer.
      nuestra.current = false;
      cerrar.current();
    };
    window.addEventListener('popstate', alVolver);

    return () => {
      window.removeEventListener('popstate', alVolver);
      if (!nuestra.current) return;
      /*
       * Se apaga **antes** de `history.back()` y no después — el hallazgo del
       * auditor de trampas en B-238. `history.back()` es asíncrono: el
       * `popstate` que dispara no llega en esta misma vuelta, así que una
       * segunda corrida de esta limpieza en esa ventana repetiría el `back()` y
       * retrocedería una entrada de más.
       */
      nuestra.current = false;
      window.history.back();
    };
  }, [abierta]);
}
