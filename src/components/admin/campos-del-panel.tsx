/**
 * **Los tres controles compartidos, atados al panel** — B-841.
 *
 * ── El problema que este archivo resuelve ─────────────────────────────────
 * `src/components/campos/` salió de `admin/` en B-827 para que lo usaran los
 * cuatro formularios públicos de `prd/`. Pero tres de sus seis archivos seguían
 * importando **hacia adentro**, y la cadena real era larga:
 *
 *   campos/{Seccion,TagsInput,TaxonomiaSelect}
 *     → @/lib/analytics          (la medición del PANEL)
 *       → @/lib/firebase-client
 *         → @/lib/appcheck       (estático desde B-836a)
 *           → firebase/app-check
 *
 * Así que un formulario público a un `import` de distancia hacía **dos** cosas en
 * el navegador de un visitante anónimo: **medir sin consentimiento** —`debeMedir`
 * tiene tres portones y ninguno es el consentimiento, porque la analítica del
 * panel nunca lo necesitó, y va a la misma propiedad de GA4 que el sitio (B-801),
 * contra D-250 y la promesa de `/apoyar`— y **cargar dos terceros de Google**
 * antes del banner, el segundo con cuota facturable por visitante. Lo
 * re-dimensionó el `auditor-privacidad`: no era deuda de capas.
 *
 * Y `TaxonomiaSelect`/`TagsInput` arrastraban además `useOpciones` →
 * `lib/opciones` → `firestore-client` → `firebase/firestore`, o sea el chunk
 * pesado que `bundle-panel.test.ts` mantiene afuera del primer render del panel.
 *
 * ── El corte ─────────────────────────────────────────────────────────────
 * Los de `campos/` quedaron **genéricos**: reciben la medición y los datos en vez
 * de importarlos. Y este archivo los ata a lo del panel, conservando la API que
 * los usos ya tenían — así los nueve `<Seccion conAyuda>` y los cinco
 * desplegables no cambiaron una línea, solo de dónde importan.
 *
 * **Esta es la capa que un formulario público NO importa.** Un formulario público
 * usa `campos/` directo, le pasa sus valores desde el JSON (§4.4 — «las opciones
 * viajan en el JSON») y no le pasa medición. Lo sostiene
 * `tests/panel-fuera-del-sitio.test.ts`, que recorre el grafo desde cada página y
 * exige que ninguna salvo `/admin` alcance la plomería del panel.
 */
import { AyudaDeSeccion } from '@/components/admin/ayuda/AyudaDeSeccion';
import { useOpciones } from '@/components/admin/useOpciones';
import { Seccion as SeccionBase, type AlmacenDeSecciones } from '@/components/campos/Seccion';
import { TagsInput as TagsInputBase } from '@/components/campos/TagsInput';
import { TaxonomiaSelect as TaxonomiaSelectBase } from '@/components/campos/TaxonomiaSelect';
import { medirFuncion, medirSeccion } from '@/lib/analytics';
import type { ComponentProps } from 'react';

export type { AlmacenDeSecciones };

type PropsSeccionBase = ComponentProps<typeof SeccionBase>;

/**
 * `Seccion` con el «?» de la guía y la medición del panel puestas.
 *
 * Conserva el `conAyuda?: boolean` de B-62 en vez de pedir el nodo: la llave del
 * capítulo es el `titulo` de la propia sección (`seccionFormulario`), así que
 * pedirlo afuera obligaría a escribir ese string dos veces — que es exactamente
 * lo que el docblock de B-62 evitaba.
 */
export function Seccion({
  conAyuda = false,
  ...props
}: Omit<PropsSeccionBase, 'ayuda' | 'medir'> & { conAyuda?: boolean }) {
  return (
    <SeccionBase
      {...props}
      // Qué acordeones se despliegan de verdad. Va el slug del título, que es un
      // literal del código (docs/09-analitica.md).
      medir={medirSeccion}
      ayuda={conAyuda ? <AyudaDeSeccion seccion={props.titulo} /> : undefined}
    />
  );
}

type PropsTaxonomiaBase = ComponentProps<typeof TaxonomiaSelectBase>;

/**
 * `TaxonomiaSelect` con sus opciones leídas de Firestore y su medición puesta.
 *
 * El hook vive **acá** y no adentro del control: es lo que hace que el control
 * sirva para un formulario público, que sus opciones las saca del `events.json`
 * (§4.4) y no de un `onSnapshot` — y de paso deja de arrastrar el SDK de
 * Firestore a cualquier página que lo use.
 */
export function TaxonomiaSelect({
  campo,
  uid,
  ...props
}: Omit<PropsTaxonomiaBase, 'valores' | 'elegibles' | 'onMedir'> & { uid: string }) {
  const { valores, elegibles } = useOpciones(campo, uid);
  return (
    <TaxonomiaSelectBase
      {...props}
      campo={campo}
      valores={valores}
      elegibles={elegibles}
      onMedir={medirFuncion}
    />
  );
}

type PropsTagsBase = ComponentProps<typeof TagsInputBase>;

/** Ídem para el editor de chips. */
export function TagsInput({
  campo,
  uid,
  ...props
}: Omit<PropsTagsBase, 'valores' | 'elegibles' | 'onMedir'> & { uid: string }) {
  const { valores, elegibles } = useOpciones(campo, uid);
  return (
    <TagsInputBase
      {...props}
      campo={campo}
      valores={valores}
      elegibles={elegibles}
      onMedir={medirFuncion}
    />
  );
}
