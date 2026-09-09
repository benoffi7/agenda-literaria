/**
 * **De propuesta a formulario de actividad** — B-830, paso 6 de la tajada 1.
 *
 * Lo que hace este módulo es una sola cosa: tomar una `Propuesta` y devolver un
 * `ActividadForm` **prellenado**, para que el admin abra el formulario que ya
 * existe con todo lo que se puede saber y complete el resto. Nada más.
 *
 * ── Lo que NO hace, y es la mitad del diseño ──────────────────────────────
 * **No escribe.** Ni la actividad, ni la propuesta. Es puro, y por dos motivos:
 *
 *  1. **El orden de las dos escrituras es una decisión y vive en un solo lugar**
 *     (**D-600**, del dueño el 2026-09-09): se crea la actividad **primero** y
 *     después se mueven `estado` + `revision` de la propuesta en **una** sola
 *     escritura. La regla lo exige —`revisionValida()` pide que todo update mueva
 *     el estado— y la asimetría de los fallos lo confirma: una actividad en
 *     borrador de más se borra en dos clics, y una propuesta marcada `aceptada`
 *     que no dice en qué actividad terminó es un dato mentiroso que nadie nota.
 *     Ese orden es del panel; acá no hay ningún `await`.
 *  2. Puro se testea sin emuladores, que es el criterio del §05.
 *
 * **Y no publica nada.** La actividad nace **borrador**, como cualquier copia
 * (D-17): aceptar una propuesta no publica, prellena. El admin revisa y publica
 * desde el formulario, con las validaciones que ya están.
 *
 * ── La traducción de vocabulario, que es el trabajo de verdad ─────────────
 * Una propuesta no es un borrador de actividad: tiene su propio vocabulario, más
 * chico y más simple (ver `types/propuesta.ts`). Lo que se traduce acá:
 *
 * | Propuesta | Actividad |
 * |---|---|
 * | `modalidad: 'las-dos'` | `'hibrido'` — «híbrido» es jerga y quien completa el formulario no la usa |
 * | `fechas[]` de strings | `sesiones[]` con `ses_<uuid>` y `datetime-local` (**D-590**) |
 * | `lugar` | la **primera fila** de `modalidades` |
 * | `arancel.tipo` (tres valores) | el slug de la taxonomía, que los incluye |
 * | `incluye` + `incluyeOtro` | `incluye` **filtrado** contra la taxonomía — ver abajo |
 * | `contacto` | **nada.** Es interno y no viaja (§5.1) |
 */
import { conModalidadDeFila, modalidadVacia, sedeVacia } from '@/lib/formulario/estadoInicial';
import { formVacio } from '@/lib/formulario/estadoInicial';
import { nuevaSesionId } from '@/lib/sesiones';
import type { ActividadForm, Modalidad, SesionForm } from '@/types/actividad';
import type { FechaPropuesta, ModalidadPropuesta, Propuesta } from '@/types/propuesta';

/**
 * `'las-dos'` → `'hibrido'`. La traducción vive acá y en ningún otro lado: si el
 * panel la repitiera, una propuesta híbrida se convertiría distinto según por
 * dónde se la abra (la clase de B-88).
 */
export const modalidadDeActividad = (m: ModalidadPropuesta): Modalidad =>
  m === 'las-dos' ? 'hibrido' : m;

/**
 * `'aaaa-mm-dd'` + `'hh:mm'` → el `datetime-local` que espera el formulario.
 *
 * **Es una concatenación y no una conversión de zona, y eso es el punto de
 * D-590.** Un `datetime-local` no lleva zona: es la hora de pared, y la hora de
 * pared que quiso decir quien propuso es exactamente la que escribió. La
 * conversión a `Timestamp` con `America/Argentina/Buenos_Aires` explícito la hace
 * `formADocumento` al guardar, que es el único lugar del proyecto que la hace y
 * el que tiene sus tests (trampa 1).
 *
 * Tocar esto para «arreglar la zona» es reintroducir la trampa: acá no hay
 * ninguna zona que arreglar.
 */
export const aDatetimeLocalDePropuesta = (dia: string, hora: string): string =>
  `${dia}T${hora}`;

/**
 * Cuánto dura un encuentro cuando la propuesta no dijo hasta cuándo.
 *
 * Dos horas es lo que dura un taller o un club en este circuito. **No se
 * adivina y después se olvida**: el formulario abre con este valor visible y
 * editable fila por fila, que es el mismo criterio que el botón de «generar N
 * encuentros» del §11 — la aritmética ahorra tipeo y las fechas quedan
 * corregibles una por una, porque los ciclos siempre tienen excepciones.
 */
export const HORAS_POR_DEFECTO = 2;

const sumarHoras = (dia: string, hora: string, horas: number): string => {
  const [h, m] = hora.split(':').map(Number) as [number, number];
  /*
   * **Aritmética sobre `Date.UTC`, y el motivo es el DST — no la zona del
   * proceso.**
   *
   * Conviene ser preciso porque la primera versión de este comentario decía lo
   * segundo y **es falso**: `new Date('2026-10-07T23:00')` se interpreta en la
   * zona del proceso, `setHours(+2)` suma en esa misma zona y los getters locales
   * la leen igual, así que el ida y vuelta se cancela y el resultado es el mismo
   * en Buenos Aires que en Tokio. Lo mostró la verificación por mutación: la
   * versión con reloj local pasaba los veinte casos en las dos zonas.
   *
   * Lo que **no** se cancela es un **cambio de horario en el medio**. En una zona
   * con DST, `2026-11-01T01:30 + 2h` de reloj local no da `03:30`: da `02:30` o
   * `04:30` según el salto, porque la hora de pared no es continua ese día.
   * Argentina no tiene DST hoy y el CI corre en UTC, así que el bug estaría
   * dormido — pero acá no hay **ninguna** zona que respetar: lo que quiso decir
   * quien propuso es hora de pared, y sumarle horas es aritmética de calendario.
   * `Date.UTC` no tiene DST, así que es la operación correcta y no una defensa.
   *
   * **Y el test no puede demostrarlo**, porque la suite no puede cambiar la zona
   * del proceso caso por caso. Lo que sí tiene red es la clase: un caso de
   * `tests/propuestas-conversion.test.ts` afirma sobre el fuente que acá no
   * aparecen los constructores de reloj local.
   */
  const [a, mes, d] = dia.split('-').map(Number) as [number, number, number];
  const t = new Date(Date.UTC(a, mes - 1, d, h + horas, m));
  const dosDigitos = (n: number) => String(n).padStart(2, '0');
  return (
    `${t.getUTCFullYear()}-${dosDigitos(t.getUTCMonth() + 1)}-${dosDigitos(t.getUTCDate())}` +
    `T${dosDigitos(t.getUTCHours())}:${dosDigitos(t.getUTCMinutes())}`
  );
};

/**
 * Una fecha de la propuesta → una fila de encuentro.
 *
 * El `id` es un `ses_<uuid>` **nuevo**, generado acá: es la trampa 2 del §13, y
 * acá aplica de la forma más directa: si los ids salieran del índice de la
 * lista, editar los encuentros después de aceptar le movería la fecha al evento
 * de otro (B-90, y el caso que `generarSesiones` ya cerró ordenando).
 */
export const sesionDeFecha = (f: FechaPropuesta): SesionForm => ({
  id: nuevaSesionId(),
  inicio: aDatetimeLocalDePropuesta(f.dia, f.desde),
  fin: f.hasta
    ? aDatetimeLocalDePropuesta(f.dia, f.hasta)
    : sumarHoras(f.dia, f.desde, HORAS_POR_DEFECTO),
  tema: '',
  lectura: '',
  cancelada: false,
  calendarEventId: null,
  comisionId: null,
});

/**
 * Los `incluye` de la propuesta que **existen en la taxonomía**, y el resto
 * empujado al texto libre.
 *
 * ── Por qué se filtra, que es un hallazgo y no una precaución ────────────
 * Lo cobró el `auditor-privacidad` sobre B-830, corrigiendo algo que B-842
 * afirmaba: «lo que protege el contenido de una propuesta es que pasa por
 * `actividadFormSchema`». Para `incluye` **eso no filtra nada** — ese schema lo
 * declara `z.array(texto)`, texto libre sin lista blanca— y el camino completo
 * es: `toPublic` lo proyecta → `detallePublico` lo resuelve con `etiquetaDe` →
 * `listadoPublico` cae a `desSlug(valor)` cuando el slug no está en la taxonomía.
 *
 * O sea que **un slug inventado se publica verbatim, des-slugueado, como texto
 * visible en la página de detalle**, que es HTML indexado. Y es el campo donde
 * «el admin lo va a ver» es **más débil**, no más fuerte: doce chips que parecen
 * taxonomía se leen como taxonomía.
 *
 * Lo que no está en el vocabulario **no se descarta**: se junta en `incluyeOtro`,
 * que es exactamente el mecanismo que el § 4.2 del PRD ya definió para el «Otro»
 * del formulario público — el admin decide si merece entrar a la taxonomía, y
 * entonces sí corre por `upsertOpcion` con su slugify (trampa 6).
 */
export const incluyeDePropuesta = (
  p: Pick<Propuesta, 'incluye' | 'incluyeOtro'>,
  slugsConocidos: readonly string[],
): { incluye: string[]; sinReconocer: string[] } => {
  const conocidos = new Set(slugsConocidos);
  const incluye: string[] = [];
  const sinReconocer: string[] = [];
  for (const slug of p.incluye) {
    if (conocidos.has(slug)) incluye.push(slug);
    else sinReconocer.push(slug);
  }
  if (p.incluyeOtro) sinReconocer.push(p.incluyeOtro);
  return { incluye, sinReconocer };
};

/**
 * El texto que el admin lee al abrir una propuesta aceptada, con lo que **no**
 * se pudo prellenar.
 *
 * Existe porque prellenar y perder son lo mismo si nadie avisa: el `contacto` no
 * viaja al formulario (es interno), los `incluye` que no están en la taxonomía
 * tampoco, y la duración inventada tiene que decirse. Sin esta línea, el admin
 * cree que el formulario tiene todo lo que la persona escribió.
 */
export const avisosDeConversion = (
  p: Propuesta,
  sinReconocer: readonly string[],
): string[] => {
  const avisos: string[] = [];
  if (p.fechas.some((f) => !f.hasta)) {
    avisos.push(
      `Algún encuentro no traía hora de fin: quedó en ${HORAS_POR_DEFECTO} horas. Revisalo.`,
    );
  }
  if (sinReconocer.length > 0) {
    avisos.push(`«Qué se llevan» sin reconocer: ${sinReconocer.join(', ')}.`);
  }
  if (p.inscripcion.requiere) {
    avisos.push(
      'Pide inscripción, y la propuesta solo dice cómo con sus palabras: elegí la vía y el destino.',
    );
  }
  return avisos;
};

/**
 * **Propuesta → formulario de actividad, prellenado.** Puro.
 *
 * `slugsConocidos` son los slugs de `/opciones/incluye-actividad` que ya existen;
 * los trae quien llama (el panel, con `useOpciones`) y no se leen acá, por lo
 * mismo que este módulo no escribe: puro se testea sin emuladores.
 *
 * Lo que **no** viaja, y cada ausencia es una decisión:
 *
 *  - **`contacto`**: interno, no sale de `/propuestas` (§5.1, §7 del PRD). Es el
 *    dato personal del tercero, y el formulario de actividad no tiene dónde
 *    ponerlo — ni debería.
 *  - **`estado`**: la actividad nace **borrador** (D-17). Aceptar prellena, no
 *    publica.
 *  - **`slug`**: se arma solo desde el título en el formulario, y queda fijo al
 *    publicar (trampa 10). Prellenarlo acá sería fijar una URL que nadie revisó.
 *  - **`titulo` sí viaja tal cual**, que es lo que hace que el slug derivado sea
 *    el que la persona quiso.
 */
export const propuestaAFormulario = (
  p: Propuesta,
  slugsConocidos: readonly string[] = [],
): { form: ActividadForm; avisos: string[] } => {
  const { incluye, sinReconocer } = incluyeDePropuesta(p, slugsConocidos);
  const modalidad = modalidadDeActividad(p.modalidad);

  /*
   * El lugar entra como la **primera fila** de `modalidades` (B-224), con su
   * cascada aplicada por `conModalidadDeFila`: una fila virtual no lleva sede y
   * una presencial no lleva online, y eso lo decide el módulo del modelo y no
   * este archivo.
   */
  const fila = conModalidadDeFila(
    {
      ...modalidadVacia(modalidad),
      modalidad,
      sede: p.lugar
        ? { ...sedeVacia(), nombre: p.lugar.nombre, direccion: p.lugar.direccion, barrio: p.lugar.barrio }
        : null,
    },
    modalidad,
  );

  return {
    form: {
      ...formVacio(),
      titulo: p.titulo,
      descripcion: p.descripcion,
      esCiclo: p.fechas.length > 1,
      sesiones: p.fechas.map(sesionDeFecha),
      modalidades: [fila],
      organizador: {
        nombre: p.organizador.nombre,
        instagram: p.organizador.instagram ?? '',
        web: '',
      },
      arancel: { tipo: p.arancel.tipo, notas: p.arancel.notas ?? '', monto: null },
      /*
       * `requiere` viaja y el **canal no**: la propuesta dice «escribime por
       * WhatsApp» con sus palabras, y `via`/`destino` son un enum y un dato
       * estructurado. Adivinarlos es publicar un canal de inscripción que nadie
       * confirmó — y `destino` es público (§5.1). Va al aviso.
       */
      inscripcion: { ...formVacio().inscripcion, requiere: p.inscripcion.requiere },
      incluye,
    },
    avisos: avisosDeConversion(p, sinReconocer),
  };
};
