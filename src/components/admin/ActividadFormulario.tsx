import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
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
import { usaPestanias, type VistaDelPanel } from '@/lib/vistaDelPanel';
import { cambiarArancel, cambiarTipo, cambiarTitulo } from '@/lib/formulario/cascadas';
import { esCharla, esClub, esTaller, nombrePersona } from '@/lib/formulario/condicionales';
import { formVacio } from '@/lib/formulario/estadoInicial';
import {
  labelsPendientesDe,
  recordarLabel,
  type CampoLabelUnico,
  type LabelNuevo,
} from '@/lib/formulario/etiquetas';
import { guardarActividad } from '@/lib/formulario/guardar';
import { faltaParaPublicar } from '@/lib/schema';
import { recomendacionesDelFormulario } from '@/lib/formulario/recomendaciones';
import type { ActividadConId, ActividadForm } from '@/types/actividad';

interface Props {
  uid: string;
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
   * B-177 — el segundo argumento son las etiquetas nuevas que **no** llegaron a
   * la taxonomía. Va acá y no queda en el formulario porque al guardar el
   * formulario se desmonta: el aviso lo pinta el chasis del panel, que es lo
   * único que sobrevive al cambio de vista.
   */
  onGuardado: (id: string, etiquetasSinRegistrar?: readonly string[]) => void;
  onCancelar: () => void;
}

export function ActividadFormulario({
  uid,
  vistaDelPanel,
  inicial,
  copia,
  tituloOrigen,
  onGuardado,
  onCancelar,
}: Props) {
  /**
   * B-814 — la única pregunta que este componente le hace a la vista elegida.
   * Se calcula una vez y no se repite el `=== 'pc'` en los cuatro lugares que la
   * usan; el motivo de que sea una función y no un `===` está en
   * `usaPestanias`.
   */
  const conPestanias = usaPestanias(vistaDelPanel);
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
  const medicion = useMedicionFormulario(form, inicial ? 'editar' : copia ? 'duplicar' : 'nueva');

  /**
   * Etiquetas creadas con "Otro" que todavía no están en `/opciones/*`.
   * Se persisten en el submit, no al tipearlas: abandonar el formulario no
   * debería dejar basura en la taxonomía (§4.3).
   */
  const [labelsNuevos, setLabelsNuevos] = useState<LabelNuevo[]>([]);
  const [tagsNuevos, setTagsNuevos] = useState<Record<string, string>>({});

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
    () => labelsPendientesDe(labelsNuevos, tagsNuevos),
    [labelsNuevos, tagsNuevos],
  );

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
        },
        labelsNuevos,
        tagsNuevos,
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
      if (r.estado === 'error') {
        medicion.guardadoFallido(r.error, accion);
        setFallo(r.error instanceof Error ? r.error.message : 'No se pudo guardar.');
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
        void guardar();
      }}
    >
      {/*
        B-191 — lo que quedó sin guardar de una sesión anterior. Va primero: es
        una decisión sobre con qué contenido se sigue trabajando, y tomarla
        después de haber tocado diez campos no sirve de nada.
      */}
      {autoguardado.recuperado && (
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
      {copia && (
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
              slugBloqueado={slugBloqueado}
            />
          ),
          encuentros: (
            <SeccionEncuentros
              form={form}
              set={set}
              errorDe={errorDe}
              esClub={esClub(form)}
              borrarComision={borrarComision}
            />
          ),
          donde: (
            <SeccionDonde form={form} set={set} errorDe={errorDe} uid={uid} anotarLabel={anotarLabel} />
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
              setTagsNuevos={setTagsNuevos}
              pedidoDeApertura={aperturas['opcional']}
            />
          ),
          difusion: <SeccionDifusion form={form} set={set} pedidoDeApertura={aperturas['difusion']} />,
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

      <BarraAcciones
        guardando={guardando}
        fallo={fallo}
        faltantes={faltantes}
        pendientesParaPublicar={pendientesParaPublicar}
        recomendaciones={recomendaciones}
        esEdicion={Boolean(inicial)}
        onCancelar={onCancelar}
        onGuardarBorrador={() => void guardar('borrador')}
        onIrASeccion={irASeccion}
      />
    </form>
  );
}
