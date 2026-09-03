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
