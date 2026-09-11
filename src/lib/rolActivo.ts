/**
 * El rol de la sesión del panel, como **store de módulo** — B-888, tajada 2.
 *
 * Es el patrón del §"Estado compartido fuera del árbol" de `05-patrones.md`, el
 * mismo de `formulario-sucio.ts`: dos partes del panel que no se conocen
 * necesitan compartir un dato chico. Acá son `AdminApp`, que sabe el rol, y
 * `campos-del-panel.tsx`, que es donde se decide si un desplegable de taxonomía
 * ofrece «Otro…».
 *
 * ── Por qué no va por props ───────────────────────────────────────────────
 * El camino sería `AdminApp` → `ActividadFormulario` → cada `Seccion*` →
 * `ModalidadesEditor` → el control. Son seis saltos para un booleano, y —lo que
 * de verdad decide— **se puede olvidar**: el campo de taxonomía que alguien
 * agregue mañana nacería ofreciendo «Otro…» a una cuenta que no puede crear
 * etiquetas, y el síntoma sería un alta que falla en silencio (el `catch` de las
 * altas es mudo a propósito, ver `formulario/guardar.ts`). Pasando por el único
 * lugar donde el panel ata sus taxonomías, el campo nuevo hereda la regla sin
 * que nadie se acuerde. Es el mismo argumento que `salirDe` en `AdminApp`.
 *
 * ── Y lo que NO es ────────────────────────────────────────────────────────
 * **No es autorización.** La autorización es `allow write: if esAdmin()` en
 * `/opciones/{campo}`, y sigue ahí aunque esto diga cualquier cosa. Lo que este
 * store decide es qué se **ofrece**: el portón que de verdad saltea las
 * escrituras está en `formulario/guardar.ts`, con el rol que llega por
 * parámetro. Si este store quedara sin setear, el peor caso es un «Otro…»
 * ofrecido que no se puede completar — feo, no inseguro.
 *
 * Por eso el default es **permisivo**: sin rol fijado se comporta como antes de
 * B-888, que es lo que preserva el formulario público y los tests que montan un
 * control suelto.
 */
import { PERMISOS, type RolDelPanel } from '@/lib/rolDelPanel';

let activo: RolDelPanel | null = null;

/** Lo llama `AdminApp` cuando resuelve el claim, y al salir de la sesión. */
export const fijarRolActivo = (rol: RolDelPanel | null): void => {
  activo = rol;
};

export const rolActivo = (): RolDelPanel | null => activo;

/**
 * ¿Esta sesión puede **crear** una etiqueta de taxonomía?
 *
 * Sin rol fijado devuelve `true` — ver el docblock: el default preserva lo
 * anterior y este store no es la frontera.
 */
export const puedeCrearEtiquetas = (): boolean =>
  activo === null || PERMISOS[activo].escribeTaxonomias;
