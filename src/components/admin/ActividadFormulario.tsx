import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import { textoDeFallo } from '@/lib/fallosDelPanel';
import { useAutoguardado } from '@/components/admin/useAutoguardado';
import { useFormularioSucio } from '@/components/admin/useFormularioSucio';
import { useMedicionFormulario } from '@/components/admin/useMedicionFormulario';
import { AvisoBorradorLocal } from '@/components/admin/formulario/AvisoBorradorLocal';
import {
  PestaniasFormulario,
  idDePanel,
  idDeSolapa,
} from '@/components/admin/formulario/PestaniasFormulario';
import { BarraAcciones } from '@/components/admin/formulario/BarraAcciones';
import { SeccionArancelInscripcion } from '@/components/admin/formulario/SeccionArancelInscripcion';
import { SeccionDifusion } from '@/components/admin/formulario/SeccionDifusion';
import { SeccionDonde } from '@/components/admin/formulario/SeccionDonde';
import { SeccionEncuentros } from '@/components/admin/formulario/SeccionEncuentros';
import { SeccionMaterial } from '@/components/admin/formulario/SeccionMaterial';
import { SeccionOpcional } from '@/components/admin/formulario/SeccionOpcional';
import { SeccionQueEs } from '@/components/admin/formulario/SeccionQueEs';
import { SeccionQuien } from '@/components/admin/formulario/SeccionQuien';
import { SeccionTextoRedes } from '@/components/admin/formulario/SeccionTextoRedes';
import { SeccionVistaPrevia } from '@/components/admin/formulario/SeccionVistaPrevia';
import { documentoAForm } from '@/lib/actividades';
import { sinComision } from '@/lib/comisiones';
// B-285 — «estuvo publicada alguna vez» se pregunta con la MISMA función que usa
// el trigger que escribe la marca, importada por `@historial` (el patrón de D-20
// aplicado al §12). Reescribirla acá sería dos ideas del mismo predicado, y la
// que se olvide del campo vuelve a abrir el candado del slug.
import { estuvoPublicada } from '@historial';
import {
  claveBorrador,
  conIdsDeCalendarioDe,
  conLoQueEsDelDocumento,
  cuandoSeGuardo,
  sinFlagsDePublicacion,
  teniaFlagsDePublicacion,
} from '@/lib/formulario/autoguardado';
import { resumirFaltantes, type IdSeccion } from '@/lib/formulario/camposFaltantes';
import {
  PESTANIAS,
  PRIMERA_PESTANIA,
  faltantesPorPestania,
  pestaniaDe,
  type IdPestania,
} from '@/lib/formulario/pestanias';
import { type FormatoDeHora, type PreferenciaDeHora } from '@/lib/formatoDeHora';
import { usaPestanias, type VistaDelPanel } from '@/lib/vistaDelPanel';
import { cambiarArancel, cambiarTipo, cambiarTitulo } from '@/lib/formulario/cascadas';
import { esCharla, esClub, esTaller, nombrePersona } from '@/lib/formulario/condicionales';
import { loQuePierdeEnGoogle } from '@/lib/formulario/enGoogle';
import { formVacio } from '@/lib/formulario/estadoInicial';
import {
  labelsPendientesDe,
  recordarLabel,
  type CampoLabelUnico,
  type LabelNuevo,
  type MultivalorNuevos,
} from '@/lib/formulario/etiquetas';
import { guardarActividad } from '@/lib/formulario/guardar';
import { ciudadesFueraDeSuCiudad, textoFueraDeSuCiudad } from '@/lib/alcanceDeCiudad';
import { ciudadesDe } from '@/lib/ciudades.mjs';
import { useOpciones } from '@/components/admin/useOpciones';
import { faltaParaPublicar } from '@/lib/schema';
import { recomendacionesDelFormulario } from '@/lib/formulario/recomendaciones';
import type { RolDelPanel } from '@/lib/rolDelPanel';
import type { ActividadConId, ActividadForm, CampoMultivalor } from '@/types/actividad';

interface Props {
  uid: string;
  /**
   * B-888 — el rol de quien guarda. Decide **una** cosa acá: si el guardado
   * intenta escribir las etiquetas nuevas y el conteo de `usos` en `/opciones/*`
   * (ver `formulario/guardar.ts`). Qué controles ofrecen «Otro…» lo decide
   * `campos-del-panel.tsx` con el store de `rolActivo.ts`, que es el único lugar
   * por el que pasan las cinco taxonomías.
   */
  rol: RolDelPanel;
  /**
   * **Con qué forma se dibuja el formulario** — B-814. `pc`: pestañas y todo el
   * ancho. `celular`: las nueve secciones a lo largo, sin pestañas, que es cómo
   * era antes de D-490.
   *
   * Entra como prop y **no** lo lee este componente de `localStorage`: la
   * preferencia la elige la cabecera del panel (decisión del dueño), así que el
   * dueño del estado es `AdminApp` y acá llega ya resuelta.
   *
   * **Sin default, a propósito.** La primera versión le puso `'celular'` diciendo
   * «el comportamiento de antes de B-814», y era al revés: antes de B-814 este
   * formulario tenía pestañas (D-490). Un default que significa una cosa acá y la
   * contraria en `anchoDelPanel.ts` es la clase de trampa que no falla en el
   * compilador — así que se pide, y quien monte el formulario elige.
   */
  vistaDelPanel: VistaDelPanel;
  /**
   * En qué formato se tipean las horas — B-889, D-720. Llega de arriba y no se
   * lee acá: es una preferencia del panel entero, y `AdminApp` es quien la
   * recuerda. Viaja hasta los tres campos de fecha y hora del formulario.
   */
  formatoDeHora: FormatoDeHora;
  /** Si viene, el formulario edita; si no, crea. */
  inicial?: ActividadConId;
  /**
   * B-11 — copia precargada de otra actividad, ya con ids de sesión nuevos,
   * `calendarEventId` en null, slug propuesto y estado borrador
   * (`duplicarActividadForm`). Llega sin `inicial` a propósito: se guarda por
   * el camino de creación, así el documento, el slug y `createdAt`/`createdBy`
   * son de la copia y no del original.
   */
  copia?: ActividadForm;
  /** Título del original, solo para el aviso de la copia. */
  tituloOrigen?: string;
  /**
   * B-830 — **de dónde salió el contenido precargado**, para que el aviso de
   * arriba diga la verdad.
   *
   * `copia` era una sola cosa hasta la bandeja de propuestas: duplicar otra
   * actividad (B-11). Convertir una propuesta llega por la misma puerta —un
   * `ActividadForm` que se guarda por el camino de creación— pero **no es una
   * copia**: no hay original que quede intacto, las fechas no se corrieron en
   * semanas y lo que hay que revisar es otra cosa. Sin este prop, el aviso le
   * diría a quien convierte que «los encuentros del original quedan intactos»,
   * que es una frase sobre una actividad que no existe.
   */
  origenDeLaCopia?: 'duplicado' | 'propuesta';
  /**
   * B-830 — lo que la conversión **no pudo** prellenar, que es lo que hay que
   * completar a mano (`avisosDeConversion`).
   *
   * Va arriba del formulario y no en un cartel del panel que se pierde al
   * cambiar de vista: se lee mientras se corrige, que es cuando sirve.
   */
  avisos?: readonly string[];
  /**
   * B-1235 — la foto de la propuesta que pidieron usar y **no entró**, con la
   * causa y qué hacer (`avisoDeImagenNoPromovida`). Se pinta como alerta arriba
   * de todo y no adentro del aviso de conversión: ahí era una línea más y se
   * leía como «apreté usarla y no la tomó».
   */
  imagenNoPromovida?: string | null;
  /**
   * B-177 — el segundo argumento son las etiquetas nuevas que **no** llegaron a
   * la taxonomía. Va acá y no queda en el formulario porque al guardar el
   * formulario se desmonta: el aviso lo pinta el chasis del panel, que es lo
   * único que sobrevive al cambio de vista.
   */
  onGuardado: (id: string, etiquetasSinRegistrar?: readonly string[]) => void;
  onCancelar: () => void;
  /**
   * **B-919 — la ficha se mira y no se guarda.**
   *
   * Es una actividad de la ciudad del publicador que cargó otra cuenta: las
   * reglas le dan `read` y nada más («era modo lectura los otros que no son de
   * ella», el dueño). Lo decide `esSoloLectura()` en `AdminApp`, no este
   * componente, porque es la misma pregunta que decide qué botones tiene la fila
   * del listado y no puede contestarse distinto en los dos lados.
   *
   * Lo que hace acá, y son tres cosas porque con dos no alcanza:
   *  1. un `<fieldset disabled>` alrededor de todo el cuerpo — es el navegador el
   *     que apaga los ~ochenta controles, no una lista de `disabled` que hay que
   *     acordarse de extender con cada campo nuevo (es el criterio del
   *     §"Verificar la clase, no la instancia"): el campo que se agregue mañana
   *     nace apagado;
   *  2. la barra de abajo sin los dos botones de guardar;
   *  3. el `onSubmit` cortado, porque un `<form>` se manda también con Enter en
   *     un campo de texto y eso no lo frena ningún `hidden`.
   */
  soloLectura?: boolean;
  /**
   * **B-921 — la ciudad del claim de quien guarda** (`ciudadDeClaims`), o `''`.
   *
   * Un publicador con ciudad no puede guardar una actividad con una sede fuera
   * de la suya (`dentroDeSuCiudad()` en `firestore.rules`, D-1150). Con esto el
   * formulario lo avisa **mientras se carga** y el guardado no lo intenta. `''`
   * —el default— es el publicador general y el admin: no hay nada que avisar.
   */
  ciudad?: string;
}

export function ActividadFormulario({
  uid,
  rol,
  vistaDelPanel,
  formatoDeHora,
  inicial,
  copia,
  tituloOrigen,
  origenDeLaCopia = 'duplicado',
  avisos,
  imagenNoPromovida = null,
  onGuardado,
  onCancelar,
  soloLectura = false,
  ciudad = '',
}: Props) {
  /**
   * B-814 — la única pregunta que este componente le hace a la vista elegida.
   * Se calcula una vez y no se repite el `=== 'pc'` en los cuatro lugares que la
   * usan; el motivo de que sea una función y no un `===` está en
   * `usaPestanias`.
   */
  const conPestanias = usaPestanias(vistaDelPanel);
  /*
   * B-889 / D-720 — las dos mitades de «cómo se tipea una hora acá», juntas y en
   * una sola prop: el formato elegido y la vista, que es la que decide si el
   * control propio entra (ver `usaControlDeHoraPropio`).
   */
  const hora: PreferenciaDeHora = { formato: formatoDeHora, vista: vistaDelPanel };
  const [form, setForm] = useState<ActividadForm>(() =>
    inicial ? documentoAForm(inicial) : (copia ?? formVacio()),
  );
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  /**
   * Cuántas veces se pidió abrir cada sección (B-184). Es un contador por
   * sección y no un booleano para que un segundo pedido vuelva a abrirla después
   * de que alguien la cerró a mano.
   */
  const [aperturas, setAperturas] = useState<Partial<Record<IdSeccion, number>>>({});
  /**
   * En qué pestaña está parado el formulario (pedido del dueño, 2026-09-07: «que
   * sean tabs»). Arranca en la primera del registro, que es «Qué es»: es la que
   * tiene el tipo, y el tipo es lo que decide qué se muestra en el resto.
   *
   * **Los nueve paneles se quedan montados** y los que no están activos se
   * esconden con una clase. No es pereza: el estado de cada sección vive adentro
   * de ella —el acordeón abierto, la fila de imagen que se está subiendo, el
   * editor de encuentros— y desmontarla lo perdería al cambiar de solapa. Además,
   * `[data-campo-con-error]` tiene que existir en el DOM para que la barra pueda
   * llevar hasta él. Y no cuesta nada nuevo: hasta hoy los nueve estaban
   * montados **y** visibles.
   */
  const [pestania, setPestania] = useState<IdPestania>(PRIMERA_PESTANIA);

  useFormularioSucio(form);

  /**
   * B-191 — el formulario se guarda solo en el navegador mientras se escribe, y
   * al abrir ofrece lo que haya quedado sin guardar. No toca Firestore.
   *
   * La clave es por admin y por formulario. La carga nueva y la copia **no**
   * comparten la suya aunque las dos se guarden creando un documento: lo que se
   * ofrece es contenido, y un borrador de "nueva" ofrecido dentro de un duplicado
   * publica una actividad distinta de la que se quiso duplicar.
   */
  const autoguardado = useAutoguardado(
    form,
    claveBorrador({ uid, idActividad: inicial?.id, esCopia: Boolean(copia) }),
  );

  /** Analítica del ciclo de carga. No sale contenido: docs/09-analitica.md. */
  const medicion = useMedicionFormulario(
    form,
    inicial ? 'editar' : copia ? (origenDeLaCopia === 'propuesta' ? 'propuesta' : 'duplicar') : 'nueva',
  );

  /**
   * Etiquetas creadas con "Otro" que todavía no están en `/opciones/*`.
   * Se persisten en el submit, no al tipearlas: abandonar el formulario no
   * debería dejar basura en la taxonomía (§4.3).
   */
  const [labelsNuevos, setLabelsNuevos] = useState<LabelNuevo[]>([]);
  /**
   * B-830 — el buffer de las taxonomías **multivalor**, una entrada por campo.
   * Era el mapa de `tags` a secas; con `incluye-actividad` son dos, y el
   * mecanismo se generalizó en vez de copiarse (la clase de B-72).
   */
  const [multivalorNuevos, setMultivalorNuevos] = useState<MultivalorNuevos>({});

  const set = <K extends keyof ActividadForm>(k: K, v: ActividadForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  /**
   * Trampa 10 — el slug es inmutable después de publicar: si no, URLs rotas y SEO
   * perdido.
   *
   * **B-285 — «después de publicar» y no «mientras está publicada».** Esto era
   * `inicial?.estado === 'publicado'`, y con eso despublicar abría el candado:
   * pasar una actividad a borrador dejaba editar el slug de una URL que ya estuvo
   * en Google y en Instagram, y volver a publicarla la rompía. Es el mismo
   * agujero que `slugRestaurable` (`lib/historial.ts`) cierra del lado del
   * historial, con la nota escrita —«el historial no puede ser la puerta de
   * atrás»— mientras el formulario era la puerta de adelante.
   *
   * La pregunta la contesta `estuvoPublicada`, importada de `@historial` y no
   * reescrita acá: es la misma función que usa el trigger que escribe la marca, y
   * su default de lectura para un documento anterior al campo es justamente el
   * `estado === 'publicado'` de antes (D-26). El `=== true` es la coerción: la
   * Function es JS plano y su tipo inferido es `any`.
   */
  const slugBloqueado = estuvoPublicada(inicial) === true;

  const errorDe = (path: string) => errores[path];

  const anotarLabel = (campo: CampoLabelUnico, label?: string) =>
    setLabelsNuevos((prev) => recordarLabel(prev, campo, label));

  const anotarMultivalor = (campo: CampoMultivalor, nuevos: Record<string, string>) =>
    setMultivalorNuevos((prev) => ({ ...prev, [campo]: nuevos }));

  /** Las cascadas del modelo viven en `lib/formulario/cascadas.ts` (B-70). */
  const conTitulo = (titulo: string) =>
    setForm((f) => cambiarTitulo(f, titulo, slugBloqueado));
  const conTipo = (tipo: string) => setForm((f) => cambiarTipo(f, tipo));
  /** B-114 — el tipo de arancel arrastra el monto: ver `cambiarArancel`. */
  const conArancel = (tipo: string) => setForm((f) => cambiarArancel(f, tipo));
  /**
   * B-181 — borrar una opción de cursada saca la fila **y** desengancha sus
   * encuentros. Las dos mitades en una sola transformación (`sinComision`), por
   * lo mismo que las de arriba: el formulario nunca queda con un `comisionId`
   * apuntando a una opción que ya no está.
   */
  const borrarComision = (id: string) => setForm((f) => sinComision(f, id));

  /**
   * Lo que el schema rechazó, agrupado por sección y con el nombre de cada campo
   * (B-184). Antes de esto la barra mostraba `resumenErrores.length` y nada más.
   */
  const faltantes = useMemo(() => resumirFaltantes(Object.keys(errores)), [errores]);

  /**
   * Lo que le va a faltar para publicar, aunque el borrador ya se pueda guardar
   * (B-183). Se recalcula con cada tecla: es un `safeParse` de zod sobre un
   * objeto de treinta campos.
   *
   * **Medido, no supuesto (B-198).** Acá decía "del mismo orden que el
   * `JSON.stringify` que ya corre en cada tecleo", y es falso: cuesta ~10× más.
   * Lo que lo deja igual de barato es la otra mitad de la medición —el costo es
   * fijo del schema y **no escala con los encuentros**: 0,107 ms con uno,
   * 0,205 ms con cincuenta—, así que el escenario que el ítem temía (un ciclo de
   * 20 encuentros en un teléfono viejo) no existe. Sin debounce a propósito: un
   * número mágico y una ventana en la que el aviso miente, a cambio de nada
   * medible. Los números y el techo viven en `tests/costo-por-tecla.test.ts`.
   */
  const pendientesParaPublicar = useMemo(
    () => resumirFaltantes(faltaParaPublicar(form).map((i) => i.path.join('.'))),
    [form],
  );

  /**
   * Y lo que **conviene** tener, que no frena nada — B-264. Es el tercer nivel
   * de la barra: el flyer no entra ni en «no se puede guardar» ni en «no se va a
   * poder publicar», y sin decir nada el campo se quedaba vacío (2 de 42).
   */
  const recomendaciones = useMemo(() => recomendacionesDelFormulario(form), [form]);

  /**
   * B-813 — lo que Google no va a mostrar de esta actividad si se publica así:
   * foto, quién la da, web del organizador, precio. Aviso y no bloqueo (D-440);
   * las condiciones son las del tablero y el JSON-LD, no una copia (D-88).
   */
  const enGoogle = useMemo(() => loQuePierdeEnGoogle(form), [form]);

  /**
   * Llevar a una sección: **cambiar de pestaña y abrir el acordeón**, en ese
   * orden.
   *
   * Con todo apilado bastaba con abrir el acordeón (B-184). Con pestañas, una
   * sección de otra solapa no está en la pantalla —es el mismo problema que
   * B-184 resolvió, con otra cara— así que el cambio de pestaña es parte del
   * mismo gesto y no algo que quien carga tenga que adivinar.
   *
   * El `setAperturas` se conserva igual porque una pestaña puede tener más de una
   * sección y las colapsables siguen colapsadas adentro: «Material» arranca
   * cerrada si no es un club, y su pestaña puede estar activa con la sección
   * cerrada.
   */
  /** Cuántos campos pendientes tiene cada solapa. Ver el prop `pendientes`. */
  const pendientesPorPestania = useMemo(
    () => faltantesPorPestania(pendientesParaPublicar),
    [pendientesParaPublicar],
  );

  const irASeccion = (id: IdSeccion) => {
    /*
     * **Con pestañas cambia de pestaña; apilado, scrollea hasta el ancla**
     * (B-814). Las dos rutas ya existían: el ancla es de B-184 —de antes de
     * D-490— y el cambio de pestaña se le agregó encima. Lo que hace B-814 es
     * elegir por vista, porque en apilado `setPestania` no movería nada: los
     * nueve paneles están visibles, y la sección que falta puede estar tres
     * pantallas más abajo.
     *
     * El `pedidoDeApertura` va en las dos: abrir el acordeón es lo que hace que
     * el campo **esté en la pantalla**, que es el problema entero de B-184, y en
     * apilado sigue habiendo acordeones (son los de antes de D-490).
     *
     * El scroll va **después** del pedido de apertura y por eso en un
     * `requestAnimationFrame`: si scrolleara antes de que la sección se abra,
     * llegaría a la posición que el ancla tenía cerrada, y el campo quedaría
     * abajo del pliegue otra vez.
     */
    if (conPestanias) {
      const destino = pestaniaDe(id);
      if (destino) setPestania(destino);
    }
    setAperturas((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
    if (!conPestanias) {
      requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      });
    }
  };

  /**
   * **Al entrar a una pestaña, su sección se abre** — si la pestaña tiene una
   * sola.
   *
   * Cinco secciones son acordeones que arrancan cerrados (B-184, B-193), y con
   * pestañas eso deja un panel que se abre para mostrar un título y un ▶: quien
   * hizo click en «Material» hizo click justamente para verlo. **La pestaña pasó
   * a ser el mecanismo de plegado**, así que el acordeón de adentro no tiene nada
   * que plegar.
   *
   * **Salvo cuando la pestaña tiene dos secciones**, y ahí el acordeón sigue
   * sirviendo: en «Vista previa» conviven el texto para Instagram y el evento del
   * calendario, y cerrar uno para ver el otro es una preferencia legítima — que es
   * exactamente lo que B-193 le puso memoria. La condición sale de `PESTANIAS`
   * (`secciones.length`), no de una lista escrita a mano: la sección que se
   * agregue mañana cae del lado correcto sola.
   *
   * Es un `pedidoDeApertura`, así que **solo abre**: quien cierre el acordeón
   * dentro de la pestaña activa lo deja cerrado hasta que se vaya y vuelva.
   */
  useEffect(() => {
    /*
     * B-814 — apilado esto no corre, y es a propósito: **la pestaña era el
     * mecanismo de plegado** («quien hizo click en Material hizo click para
     * verlo»), y sin pestañas ese click no existe. Abrir las cinco secciones
     * colapsables al montar daría exactamente el formulario largo que D-490 vino
     * a partir, y encima ignorando la memoria de B-193. En apilado los
     * acordeones vuelven a ser los de antes de D-490, que es lo que el pedido
     * describe.
     */
    if (!conPestanias) return;
    const activa = PESTANIAS.find((p) => p.id === pestania);
    const unica = activa?.secciones.length === 1 ? activa.secciones[0] : undefined;
    if (!unica) return;
    setAperturas((prev) => ({ ...prev, [unica]: (prev[unica] ?? 0) + 1 }));
  }, [pestania, conPestanias]);

  /**
   * Un guardado que falla abre las secciones donde quedó algo pendiente y lleva
   * hasta el primer campo rechazado.
   *
   * El `setTimeout` no es un parche de estética: la sección colapsada se abre en
   * **su** efecto, que corre después de este render, así que el campo todavía no
   * está en el DOM cuando este efecto se ejecuta. Sin la espera, `querySelector`
   * no lo encuentra justo en el caso que B-184 vino a arreglar.
   */
  useEffect(() => {
    if (faltantes.total === 0) return;
    /*
     * **En orden inverso a propósito.** `irASeccion` cambia de pestaña, así que
     * si se recorren de arriba hacia abajo la que manda es la **última**, y hay
     * que quedarse en la **primera** —«el primer error» se resuelve por orden del
     * documento, y es donde el scroll de abajo va a caer—. Recorrer al revés deja
     * los nueve acordeones pedidos y la pestaña en la de arriba.
     */
    for (const seccion of [...faltantes.secciones].reverse()) irASeccion(seccion.id);
    const id = setTimeout(() => {
      document
        .querySelector('[data-campo-con-error]')
        ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 0);
    return () => clearTimeout(id);
    // Depende de `errores` y no de `faltantes`: es "hubo un intento fallido
    // nuevo", y `faltantes` se deriva de ahí.
  }, [errores]);

  /**
   * Las etiquetas creadas con "Otro" todavía no están en `/opciones/*` (se
   * persisten en el submit, D-02), así que la vista previa las necesita de acá:
   * si no, mostraría "Con Beca Parcial" des-slugueado donde el evento publicado
   * va a decir "Con beca parcial".
   */
  const labelsPendientes = useMemo(
    () => labelsPendientesDe(labelsNuevos, multivalorNuevos),
    [labelsNuevos, multivalorNuevos],
  );

  /*
   * B-921 — ¿alguna sede cae fuera de la ciudad de esta cuenta? Se recalcula con
   * cada cambio del formulario, así que el aviso aparece en el momento en que se
   * elige la ciudad y no después de apretar «Guardar». Es la misma función que
   * usa `guardarActividad`, así que el aviso y el guardado no pueden contestar
   * distinto. En solo lectura no se avisa nada: no hay guardado posible.
   */
  const ciudadesDeLaCiudad = useOpciones('ciudad');
  const fueraDeSuCiudad = useMemo(
    () =>
      soloLectura
        ? []
        : ciudadesFueraDeSuCiudad({
            ciudad,
            ciudades: ciudadesDe(form.modalidades),
            ciudadesAntes: inicial?.ciudades,
            editando: Boolean(inicial),
          }),
    [soloLectura, ciudad, form.modalidades, inicial],
  );
  const etiquetaDeCiudad = (slug: string) =>
    ciudadesDeLaCiudad.valores.find((v) => v.slug === slug)?.label ??
    labelsPendientes.ciudad?.[slug];
  const avisoFueraDeSuCiudad =
    fueraDeSuCiudad.length > 0
      ? textoFueraDeSuCiudad(fueraDeSuCiudad, ciudad, etiquetaDeCiudad)
      : null;

  /**
   * El caso de uso vive en `lib/formulario/guardar.ts` (B-70): validar, chequear
   * el slug, escribir la actividad y registrar las etiquetas nuevas. Acá queda
   * solo lo que es del componente — estado de React y analítica — traducido
   * desde el resultado.
   */
  const guardar = async (estadoDestino?: ActividadForm['estado']) => {
    setFallo(null);
    const accion = estadoDestino === 'borrador' ? 'borrador' : 'submit';
    setGuardando(true);
    try {
      const r = await guardarActividad({
        form,
        uid,
        rol,
        estadoDestino,
        idActual: inicial?.id,
        // B-340 — el documento antes de esta edición, para que `usosAContar`
        // no vuelva a sumar en cada guardado lo que ya estaba ahí. `inicial`
        // es exactamente eso: lo que el formulario cargó al abrirse, sin
        // pedir una lectura de más.
        //
        // **Se proyecta acá, no se pasa `inicial` entero** (lo señaló el
        // `auditor-privacidad`): `inicial` es el documento crudo —lleva
        // `online.url`, `difusion`, `createdBy`/`updatedBy`,
        // `calendarEventId`— y el tipo de `anterior` en `guardar.ts` no evita
        // que viajen igual, solo que se lean. Un `console.error({ entrada })`
        // de debug en el futuro, o mandar `entrada` entera a la medición de un
        // fallo, publicaría el link de la reunión y los uids. Los cuatro
        // campos que `usosAContar` de verdad mira son los únicos que cruzan
        // el borde.
        anterior: inicial && {
          tipo: inicial.tipo,
          arancel: { tipo: inicial.arancel.tipo },
          modalidades: inicial.modalidades.map((m) => ({
            sede: m.sede ? { barrio: m.sede.barrio } : null,
            online: m.online ? { plataforma: m.online.plataforma } : null,
          })),
          tags: inicial.tags,
          // B-830 — hace falta acá por lo mismo que `tags`: sin el «antes»,
          // `usosAContar` volvería a sumar en cada guardado lo que ya estaba,
          // que es exactamente lo que B-340 vino a arreglar.
          incluye: inicial.incluye,
        },
        labelsNuevos,
        multivalorNuevos,
        // B-921 — la misma pregunta que el aviso de arriba, contestada otra vez
        // al guardar: el aviso se puede no leer, el guardado no se saltea.
        alcance: { ciudad, ciudadesAntes: inicial?.ciudades },
      });

      if (r.estado === 'invalido') {
        medicion.validacionFallida(r.issues, accion);
        // Sin `fallo`: la barra ya nombra los campos y las secciones que faltan
        // (B-184), y "Revisá los campos marcados" arriba de eso solo tapaba el
        // mensaje que sí dice dónde mirar.
        setErrores(r.errores);
        return;
      }
      setErrores({});

      if (r.estado === 'slug-tomado') {
        medicion.guardadoFallido('slug-tomado', accion);
        setErrores(r.errores);
        setFallo('El slug está tomado.');
        return;
      }
      if (r.estado === 'fuera-de-ciudad') {
        medicion.guardadoFallido('fuera-de-ciudad', accion);
        setFallo(textoFueraDeSuCiudad(r.ciudades, ciudad, etiquetaDeCiudad));
        return;
      }
      if (r.estado === 'error') {
        medicion.guardadoFallido(r.error, accion);
        /*
         * **B-929 — y este es el único lugar del panel con `hayBorrador`.**
         *
         * El autoguardado (`useAutoguardado`, D-122) existe solo acá, así que es
         * el único cartel que puede prometer que lo escrito sobrevivió. Decirlo
         * desde otra pantalla sería prometer que el trabajo está a salvo cuando
         * no lo está — por eso la frase va por parámetro y no pegada al texto de
         * `red` en `fallosDelPanel.ts`.
         *
         * `medicion.guardadoFallido` recibe el **mismo** error, así que la
         * etiqueta que va a GA4 y el texto que lee la persona salen de la misma
         * clasificación. Eso es lo que B-929 vino a arreglar: la métrica ya decía
         * «red» mientras el cartel decía «Failed to get document because the
         * client is offline».
         */
        setFallo(textoDeFallo(r.error, { respaldo: 'No se pudo guardar.', hayBorrador: true }));
        return;
      }

      medicion.guardadoOk(r.guardado, accion);
      // El borrador del navegador ya no tiene sentido: lo guardado es esto
      // mismo, y dejarlo haría que reapareciera encima de la versión buena.
      autoguardado.limpiar();
      onGuardado(r.id, r.etiquetasSinRegistrar);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-4 pb-56 sm:pb-28"
      onSubmit={(e) => {
        e.preventDefault();
        // B-919 — un `<form>` se manda también con Enter adentro de un campo de
        // texto, así que esconder los botones no alcanza para que no se intente.
        if (soloLectura) return;
        void guardar();
      }}
    >
      {/*
        B-919 — por qué esta ficha no se puede guardar. Va **arriba de todo** y
        antes de los avisos de copia: es la primera pregunta al abrirla, y leerla
        después de haber corregido tres campos no sirve de nada.
      */}
      {soloLectura && (
        <div className="border border-borde bg-crema px-3 py-2.5 text-xs">
          <p className="font-medium">Solo lectura</p>
          <p className="mt-1 text-tinta/70">
            La cargó otra cuenta. La ves porque es de tu ciudad: podés mirar cómo está armada,
            pero los cambios los tiene que hacer quien la cargó. Lo interno de esa cuenta —a quién
            va a etiquetar y sus notas— no se muestra.
          </p>
        </div>
      )}

      {/*
        B-921 — una sede fuera de la ciudad de esta cuenta. Arriba de todo, igual
        que «Solo lectura»: con pestañas, un aviso adentro de «Dónde» no se ve
        desde la pestaña en la que se aprieta «Guardar». Borde de color y no
        rojo de error: no se rompió nada, es una regla de la cuenta.
      */}
      {avisoFueraDeSuCiudad && (
        <div
          role="status"
          data-aviso="fuera-de-su-ciudad"
          className="rounded-md border border-acento/40 bg-acento/5 px-3 py-2.5 text-xs"
        >
          <p className="font-medium text-acento">Esta actividad queda fuera de tu ciudad</p>
          <p className="mt-1 text-tinta/80">{avisoFueraDeSuCiudad}</p>
        </div>
      )}

      {/*
        B-191 — lo que quedó sin guardar de una sesión anterior. Va primero: es
        una decisión sobre con qué contenido se sigue trabajando, y tomarla
        después de haber tocado diez campos no sirve de nada.

        **No se ofrece en solo lectura** (B-919): recuperar un borrador es
        proponer escribir, y acá no hay dónde escribir.
      */}
      {!soloLectura && autoguardado.recuperado && (
        <AvisoBorradorLocal
          cuando={cuandoSeGuardo(autoguardado.recuperado)}
          linksSinPublicar={
            teniaFlagsDePublicacion(autoguardado.recuperado.form) || teniaFlagsDePublicacion(form)
          }
          onRecuperar={() => {
            // El borrador tiene hasta 30 días, así que no todo se aplica tal
            // cual. Los tres saneadores, y `autoguardado.ts` tiene el detalle:
            //
            // - los `calendarEventId` son del documento de hoy (familia de B-80);
            // - los flags de publicación vuelven a privado (trampa 5);
            // - el estado, el slug bloqueado y las cancelaciones son del
            //   documento: recuperar no publica ni despublica nada.
            setForm((actual) =>
              conLoQueEsDelDocumento(
                conIdsDeCalendarioDe(sinFlagsDePublicacion(autoguardado.recuperado!.form), actual),
                actual,
                slugBloqueado,
              ),
            );
            autoguardado.descartar();
          }}
          onDescartar={autoguardado.descartar}
        />
      )}

      {/*
        Aviso de copia. Dice explícitamente qué se rehízo y qué hay que revisar:
        una copia guardada sin mirar es una actividad con el título del año
        pasado y un slug "-copia" que después queda fijo (trampa 10).
      */}
      {copia && origenDeLaCopia === 'duplicado' && (
        <div className="rounded-md border border-acento/30 bg-acento/5 px-3 py-2.5 text-xs">
          <p className="font-medium text-acento">
            Copia de «{tituloOrigen ?? copia.titulo}» — todavía no existe.
          </p>
          <p className="mt-1 text-tinta/70">
            Los encuentros son nuevos y todavía no están en el calendario: los del
            original quedan intactos. Las fechas se corrieron en semanas enteras
            para conservar el día y la hora. Revisá <strong>título</strong>,{' '}
            <strong>slug</strong> y <strong>fechas</strong> antes de publicar: el
            slug queda fijo después.
          </p>
        </div>
      )}

      {/*
        B-830 — el aviso de la conversión. Dice las mismas dos cosas que el de la
        copia y las dice distinto, porque acá son otras: **nada se guardó
        todavía** (la propuesta se marca aceptada recién cuando esta actividad
        exista, D-600) y lo que hay que revisar no es un slug heredado sino lo que
        la propuesta **no** traía.
      */}
      {/*
        B-1235 — **la foto no entró, y tiene que ser imposible no verlo.** Va
        antes del aviso de conversión y con `role="alert"`: es lo único de esta
        pantalla que, si se pasa por alto, termina en una actividad sin flyer y en
        la foto de un tercero que se queda en la propuesta (la aceptación borra el
        original solo si la actividad tiene una copia propia, B-863).
      */}
      {copia && origenDeLaCopia === 'propuesta' && imagenNoPromovida && (
        <div
          role="alert"
          className="rounded-md border-2 border-acento bg-acento/10 px-3 py-2.5 text-sm"
        >
          <p className="font-semibold text-acento">
            La foto de la propuesta NO se agregó a esta actividad.
          </p>
          <p className="mt-1 text-tinta/80">{imagenNoPromovida}</p>
        </div>
      )}

      {copia && origenDeLaCopia === 'propuesta' && (
        <div className="rounded-md border border-acento/30 bg-acento/5 px-3 py-2.5 text-xs">
          <p className="font-medium text-acento">
            Sale de la propuesta «{tituloOrigen ?? copia.titulo}» — todavía no existe.
          </p>
          <p className="mt-1 text-tinta/70">
            Está en borrador: guardar no la publica. Los encuentros son nuevos y no están en el
            calendario. El contacto de quien propuso no viaja acá, queda en la bandeja. Revisá{' '}
            <strong>título</strong> y <strong>slug</strong> antes de publicar: el slug queda fijo
            después.
          </p>
          {avisos && avisos.length > 0 && (
            <ul className="mt-1.5 list-disc pl-4 text-tinta/70">
              {avisos.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── Las secciones del §11, una por pestaña ──────────────
        Cada una en su archivo (B-79). El formulario se queda con el estado, las
        cascadas y el guardado; las secciones son presentación y reciben lo que
        necesitan por props. Era el segundo archivo más tocado del repo, y en
        este proyecto ya se commitearon marcadores de conflicto que sobrevivieron
        dos commits (`tests/sin-marcadores-de-conflicto.test.ts`).

        **El mapa está tipado `Record<IdSeccion, ReactNode>` y eso no es
        decoración:** obliga a que toda sección del registro tenga contenido acá.
        Una sección nueva declarada en `camposFaltantes.ts` gana su pestaña sola
        (`pestanias.ts`) y **no compila** hasta que se le escribe el cuerpo — sin
        eso, la barra podría mandar a una pestaña vacía.
      */}
      {/*
        La fila de solapas. Va **después** de los dos avisos —el borrador local y
        el de copia— porque los dos son decisiones sobre con qué contenido se
        trabaja, y tomarlas después de haber recorrido tres pestañas no sirve de
        nada. Es la misma razón por la que el aviso del borrador iba primero.
      */}
      {conPestanias && (
      <PestaniasFormulario
        activa={pestania}
        onCambiar={setPestania}
        /*
          El número de cada solapa es **lo que le va a faltar para publicar**
          (`pendientesParaPublicar`) y no lo que el schema rechazó
          (`faltantes`), y la diferencia importa: lo segundo existe solo después
          de un guardado fallido, y lo primero está desde la primera tecla. La
          barra de abajo muestra los dos niveles; la solapa muestra el que sirve
          para orientarse mientras se carga.
        */
        pendientes={pendientesPorPestania}
      />
      )}

      {/*
        **El `fieldset` empieza acá y no arriba de todo** — B-919, y lo cobró el
        `auditor-privacidad`. Un `<fieldset disabled>` apaga **todos** sus
        descendientes, y las solapas son `<button>`: con la tira adentro, la ficha
        ajena quedaba clavada en la primera pestaña y el cartel de arriba —«podés
        mirarla entera»— era falso en pantalla ancha y cierto en el teléfono. O
        sea que **qué se veía de un tercero dependía del ancho de la ventana**,
        que no es una decisión: es un efecto.

        Navegar entre pestañas no escribe nada, así que la tira va afuera. Lo que
        el fieldset tiene que apagar son los campos, y empieza justo antes.
      */}
      <fieldset
        disabled={soloLectura}
        className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0"
      >
      {(() => {
        const contenido: Record<IdSeccion, ReactNode> = {
          'que-es': (
            <SeccionQueEs
              form={form}
              set={set}
              errorDe={errorDe}
              uid={uid}
              conTitulo={conTitulo}
              conTipo={conTipo}
              anotarLabel={anotarLabel}
              anotarMultivalor={anotarMultivalor}
              slugBloqueado={slugBloqueado}
            />
          ),
          encuentros: (
            <SeccionEncuentros
              hora={hora}
              form={form}
              set={set}
              errorDe={errorDe}
              esClub={esClub(form)}
              borrarComision={borrarComision}
            />
          ),
          donde: (
            <SeccionDonde
              hora={hora}
              form={form}
              set={set}
              errorDe={errorDe}
              uid={uid}
              anotarLabel={anotarLabel}
            />
          ),
          quien: (
            <SeccionQuien
              form={form}
              set={set}
              errorDe={errorDe}
              esTaller={esTaller(form)}
              esCharla={esCharla(form)}
              nombrePersona={nombrePersona(form)}
            />
          ),
          'arancel-inscripcion': (
            <SeccionArancelInscripcion
              hora={hora}
              form={form}
              set={set}
              errorDe={errorDe}
              uid={uid}
              anotarLabel={anotarLabel}
              onArancel={conArancel}
            />
          ),
          material: (
            <SeccionMaterial
              form={form}
              set={set}
              errorDe={errorDe}
              esClub={esClub(form)}
              pedidoDeApertura={aperturas['material']}
            />
          ),
          opcional: (
            <SeccionOpcional
              form={form}
              set={set}
              errorDe={errorDe}
              uid={uid}
              anotarMultivalor={anotarMultivalor}
              pedidoDeApertura={aperturas['opcional']}
            />
          ),
          /*
           * **Difusión no se muestra en solo lectura** — B-919, y lo cobró el
           * `auditor-privacidad`.
           *
           * Es la única sección del formulario que es **trabajo interno de quien
           * cargó** y de nadie más: `difusion.arrobar` son los handles que va a
           * etiquetar al publicar en redes y `difusion.notas` es texto libre que
           * el §5.1 declara «nunca público». Mostrárselo a otra cuenta no aporta
           * nada a «qué pasa en mi ciudad» y es exactamente la clase de dato que
           * el modelo separó para que no saliera.
           *
           * **No es la frontera** —la regla le da el documento entero, así que
           * quien quiera leerlo lo lee desde la consola— pero el panel no tiene
           * por qué ser el que se lo ponga adelante. Qué incluye ese `read` y por
           * qué es aceptable está escrito en `docs/07-seguridad.md` § «Los dos
           * roles del panel».
           *
           * Va en el mapa y no en la pestaña: el registro de `PESTANIAS` exige
           * que toda sección tenga contenido, así que el `null` es lo que la deja
           * vacía sin romper la tira de solapas ni la barra que lleva a ella.
           */
          difusion: soloLectura ? null : (
            <SeccionDifusion form={form} set={set} pedidoDeApertura={aperturas['difusion']} />
          ),
          'texto-redes': <SeccionTextoRedes form={form} labelsPendientes={labelsPendientes} />,
          'vista-previa': <SeccionVistaPrevia form={form} labelsPendientes={labelsPendientes} />,
        };

        return PESTANIAS.map((p) => (
          <div
            key={p.id}
            role={conPestanias ? 'tabpanel' : undefined}
            id={conPestanias ? idDePanel(p.id) : undefined}
            aria-labelledby={conPestanias ? idDeSolapa(p.id) : undefined}
            /*
              La activa se pinta y las otras se esconden con `hidden` **de
              Tailwind y no con el atributo HTML**: el `[hidden]` del preflight va
              con `:where()`, o sea especificidad cero, así que cualquier utilidad
              de `display` en el mismo elemento le gana y el panel «escondido» se
              vería igual. Con la clase no hay dos reglas peleando.
            */
            /*
              B-814 — **apilado no esconde ninguno**: la vista celular son las
              nueve secciones a lo largo, que es literalmente «no aplicar la
              clase `hidden`». El `role="tabpanel"` sí se saca, porque sin la
              fila de solapas no hay `tablist` que lo gobierne y un `tabpanel`
              huérfano le miente al lector de pantalla.
            */
            className={
              !conPestanias
                ? 'flex flex-col gap-4'
                : p.id === pestania
                  ? 'flex flex-col gap-4'
                  : 'hidden'
            }
          >
            {p.secciones.map((seccion) => (
              <Fragment key={seccion}>{contenido[seccion]}</Fragment>
            ))}
          </div>
        ));
      })()}

      </fieldset>

      {/*
        La barra queda **afuera** del `fieldset`: en solo lectura «Volver» tiene
        que seguir apretándose, y un botón adentro de un fieldset deshabilitado no
        se aprieta. Es la única parte del formulario que sigue viva.
      */}
      <BarraAcciones
        guardando={guardando}
        fallo={fallo}
        faltantes={faltantes}
        pendientesParaPublicar={pendientesParaPublicar}
        recomendaciones={recomendaciones}
        enGoogle={enGoogle}
        esEdicion={Boolean(inicial)}
        soloLectura={soloLectura}
        onCancelar={onCancelar}
        onGuardarBorrador={() => void guardar('borrador')}
        onIrASeccion={irASeccion}
      />
    </form>
  );
}
