import { useMemo, useState } from 'react';
import { z } from 'zod';
import {
  Campo,
  claseBotonPrimario,
  claseBotonSecundario,
  claseInput,
} from '@/components/campos/Campo';
import { TagsInput, TaxonomiaSelect } from '@/components/admin/campos-del-panel';
import { GaleriaEditor } from '@/components/admin/GaleriaEditor';
import { useFormularioSucio } from '@/components/admin/useFormularioSucio';
import { medirFuncion } from '@/lib/analytics';
import { slugBloqueado } from '@/lib/directorios';
import { upsertOpcion, upsertOpciones } from '@/lib/opciones';
import {
  pideDatosDeEnvio,
  slugDeSuscripcion,
  suscripcionFormSchema,
  suscripcionVacia,
} from '@/lib/suscripcion-literaria-schema';
import {
  crearSuscripcion,
  guardarSuscripcion,
  slugDeSuscripcionDisponible,
  suscripcionAFormulario,
} from '@/lib/suscripcionesLiterarias';
import {
  MAX_LIBROS_POR_ENTREGA,
  MIN_LIBROS_POR_ENTREGA,
  TOPE_COMPROMISO_SUSCRIPCION,
  TOPE_DESCRIPCION_SUSCRIPCION,
  TOPE_LINK_SUSCRIPCION,
  TOPE_MAIL_SUSCRIPCION,
  TOPE_NOMBRE_SUSCRIPCION,
  TOPE_OFRECIDA_POR_SUSCRIPCION,
  TOPE_OTRO_SUSCRIPCION,
  TOPE_SLUG_SUSCRIPCION,
  TOPE_TEMATICA_SUSCRIPCION,
  VIAS_CONTACTO_SUSCRIPCION,
} from '@/types/suscripcion-literaria';
import type { CampoMultivalor, CampoTaxonomia } from '@/types/actividad';
import type {
  SuscripcionLiterariaConId,
  SuscripcionLiterariaForm,
  ViaContactoSuscripcion,
} from '@/types/suscripcion-literaria';

/** Cómo se lee cada canal en el desplegable. El modelo guarda el slug. */
const TEXTO_VIA: Record<ViaContactoSuscripcion, string> = {
  mail: 'Mail',
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
};

/**
 * **El formulario de una suscripción literaria, del lado del panel** — B-832,
 * tajada 3.
 *
 * Es la **tercera puerta** del § 1 del PRD («el formulario de admin: el dueño,
 * logueado»), y hoy la única abierta: el `create` público de
 * `/guia/suscripciones/sumar` sigue cerrado por B-872, y `firestore.rules` deja
 * escritos los cinco pasos para abrirlo.
 *
 * ── Lo que este componente no decide ─────────────────────────────────────
 * Ni la validación (`lib/suscripcion-literaria-schema.ts`), ni el armado del
 * documento (`formASuscripcion`), ni el ciclo de vida (`lib/directorios.ts`), ni
 * la escritura (`lib/suscripcionesLiterarias.ts`). Acá hay pantalla y nada más.
 *
 * ── Los condicionales del §11, con la condición compartida ───────────────
 * «Se elige `tipo` primero y se muestra solo lo que aplica». Acá el eje es
 * `envio.manda`: sin él no se pintan los cuatro campos del envío. La condición es
 * `pideDatosDeEnvio`, **la misma función que usa el `superRefine`** — si se
 * separan, el formulario esconde un campo que el schema exige y el guardado falla
 * por algo que no está en pantalla (§ «Validación en el submit»).
 *
 * ── El precio, y la mitad que este formulario NO tiene ───────────────────
 * DEC-12. Hay un monto y un período, y **no hay campo de fecha**: la fecha la
 * pone quien guarda (`guardarSuscripcion`), se estampa con el reloj del servidor
 * y solo se mueve si el número se movió. Un campo de fecha que se puede tipear es
 * un campo de fecha que se puede mentir, y esa fecha es justo lo que le dice a
 * quien lee si le puede creer al número.
 *
 * ── Las etiquetas nuevas sí se registran, y eso es propio de esta pantalla ─
 * D-02: las opciones creadas con «Otro» se persisten **en el submit**. El
 * formulario de librerías no lo hace —su `TaxonomiaSelect` de barrio descarta el
 * label nuevo— y el síntoma es el que `tests/taxonomia.test.ts` describe: el chip
 * aparece, la ficha guarda el slug y la opción nunca se da de alta, así que ningún
 * desplegable la vuelve a ofrecer y el sitio la muestra des-slugueada. Acá hay seis
 * vocabularios, así que ese olvido costaría seis veces más; está anotado para el
 * backlog del lado de librerías.
 */
interface Props {
  uid: string;
  /** La ficha que se edita. Sin ella, es un alta. */
  inicial?: SuscripcionLiterariaConId;
  onGuardado: () => void;
  onCancelar: () => void;
}

/** `{ 'envio.cuantos': 'mensaje' }` — la forma en que `Campo` pide su error. */
const erroresDe = (issues: z.ZodIssue[]): Record<string, string> =>
  Object.fromEntries(issues.map((i) => [i.path.join('.'), i.message]));

export function SuscripcionFormulario({ uid, inicial, onGuardado, onCancelar }: Props) {
  const [form, setForm] = useState<SuscripcionLiterariaForm>(() =>
    inicial ? suscripcionAFormulario(inicial) : suscripcionVacia(),
  );
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [fallo, setFallo] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  /**
   * Las etiquetas tipeadas en «Otro» que todavía no están en `/opciones/*`
   * (D-02): se recuerdan acá y se persisten en el submit. Si se persistieran al
   * tipearlas, abandonar el formulario dejaría basura en la taxonomía (§4.3).
   */
  const [labelsNuevos, setLabelsNuevos] = useState<Partial<Record<CampoTaxonomia, string>>>({});
  const [multivalorNuevos, setMultivalorNuevos] = useState<
    Partial<Record<CampoMultivalor, Record<string, string>>>
  >({});

  useFormularioSucio(form);

  const set = <K extends keyof SuscripcionLiterariaForm>(
    campo: K,
    valor: SuscripcionLiterariaForm[K],
  ) => setForm((f) => ({ ...f, [campo]: valor }));

  const setEnvio = <K extends keyof SuscripcionLiterariaForm['envio']>(
    campo: K,
    valor: SuscripcionLiterariaForm['envio'][K],
  ) => setForm((f) => ({ ...f, envio: { ...f.envio, [campo]: valor } }));

  const setOfrecidaPor = <K extends keyof SuscripcionLiterariaForm['ofrecidaPor']>(
    campo: K,
    valor: SuscripcionLiterariaForm['ofrecidaPor'][K],
  ) => setForm((f) => ({ ...f, ofrecidaPor: { ...f.ofrecidaPor, [campo]: valor } }));

  const recordarLabel = (campo: CampoTaxonomia, label?: string) =>
    setLabelsNuevos((prev) => (label ? { ...prev, [campo]: label } : prev));

  const recordarMultivalor = (campo: CampoMultivalor, nuevos: Record<string, string>) =>
    setMultivalorNuevos((prev) => ({ ...prev, [campo]: { ...prev[campo], ...nuevos } }));

  const errorDe = (path: string) => errores[path];

  /** La dirección web que va a quedar, con el derivado a la vista antes de guardar. */
  const slugResultante = useMemo(() => slugDeSuscripcion(form), [form]);

  const congelado = inicial ? slugBloqueado(inicial) : false;
  const muestraEnvio = pideDatosDeEnvio(form.envio);

  /**
   * Las etiquetas nuevas, después de guardar y en su propio `try`.
   *
   * El orden es el de `guardarActividad` y por el mismo motivo: primero se
   * escribe la ficha, que es lo que no se puede perder, y después se siembran las
   * opciones. Lo que falla acá se **avisa por su nombre** —no con un «algo salió
   * mal»—, porque el arreglo es volver a tipear **esa** etiqueta, y con seis
   * vocabularios un aviso genérico no es accionable (B-177).
   */
  const registrarEtiquetas = async (): Promise<string[]> => {
    const sinRegistrar: string[] = [];
    for (const [campo, label] of Object.entries(labelsNuevos) as [CampoTaxonomia, string][]) {
      if (!label?.trim()) continue;
      try {
        await upsertOpcion(campo, label, uid);
      } catch {
        sinRegistrar.push(label);
      }
    }
    for (const [campo, mapa] of Object.entries(multivalorNuevos) as [
      CampoMultivalor,
      Record<string, string>,
    ][]) {
      const labels = Object.values(mapa ?? {}).filter((l) => l.trim());
      if (labels.length === 0) continue;
      try {
        await upsertOpciones(campo, labels, uid);
      } catch {
        sinRegistrar.push(...labels);
      }
    }
    return [...new Set(sinRegistrar)];
  };

  const guardar = async () => {
    const parsed = suscripcionFormSchema.safeParse(form);
    if (!parsed.success) {
      setErrores(erroresDe(parsed.error.issues));
      setFallo('Faltan datos o hay algo mal cargado. Mirá los campos marcados.');
      return;
    }
    setErrores({});
    setGuardando(true);
    try {
      /*
       * La guarda **de aviso** del slug: no es una garantía —no hay reserva
       * atómica en esta colección— pero convierte un choque en un mensaje con
       * arreglo de una línea. Se saltea cuando el slug está congelado: ahí no
       * cambió, y preguntarlo sería una lectura por guardado para una respuesta
       * que ya se sabe.
       */
      if (!congelado && !(await slugDeSuscripcionDisponible(slugResultante, inicial?.id))) {
        setErrores({ slug: 'Ya hay otra suscripción con esta dirección web.' });
        setFallo('La dirección web está tomada. Cambiala y volvé a guardar.');
        return;
      }
      if (inicial) {
        await guardarSuscripcion(inicial.id, parsed.data as SuscripcionLiterariaForm, inicial);
      } else {
        await crearSuscripcion(parsed.data as SuscripcionLiterariaForm);
      }
      medirFuncion('suscripcion-guardar');
      const sinRegistrar = await registrarEtiquetas();
      setFallo(null);
      if (sinRegistrar.length > 0) {
        setAviso(
          `Se guardó, pero estas opciones nuevas no quedaron en la lista: ${sinRegistrar.join(', ')}. ` +
            'Volvé a tipearlas la próxima vez que edites la ficha.',
        );
        return;
      }
      onGuardado();
    } catch (e: unknown) {
      setFallo(e instanceof Error ? e.message : 'No se pudo guardar la suscripción');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <section className="flex flex-col gap-6">
      {fallo && (
        <p
          role="alert"
          className="rounded-md border border-acento/30 bg-acento/5 px-3 py-2 text-sm text-acento"
        >
          {fallo}
        </p>
      )}
      {aviso && (
        <p role="status" className="rounded-md border border-borde bg-black/[0.03] px-3 py-2 text-sm">
          {aviso}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Nombre" htmlFor="sus-nombre" requerido error={errorDe('nombre')}>
          <input
            id="sus-nombre"
            className={claseInput}
            maxLength={TOPE_NOMBRE_SUSCRIPCION}
            value={form.nombre}
            onChange={(e) => set('nombre', e.target.value)}
          />
        </Campo>

        <Campo
          label="Dirección web"
          htmlFor="sus-slug"
          error={errorDe('slug')}
          ayuda={
            congelado
              ? `Fija desde que se publicó: /${form.slug}. Cambiarla rompería el link que ya está en Google.`
              : `Queda en /guia/suscripciones/${slugResultante || '…'}. Si lo dejás vacío sale del nombre.`
          }
        >
          <input
            id="sus-slug"
            className={claseInput}
            maxLength={TOPE_SLUG_SUSCRIPCION}
            disabled={congelado}
            placeholder={slugResultante}
            value={form.slug}
            onChange={(e) => set('slug', e.target.value)}
          />
        </Campo>

        {/*
          **Obligatoria, al revés que en una librería.** Una suscripción es una
          promesa a futuro: sin esto la ficha no dice nada, y es además lo que va
          a la descripción que Google muestra.
        */}
        <Campo
          label="Qué es y para quién"
          htmlFor="sus-descripcion"
          requerido
          error={errorDe('descripcion')}
          className="sm:col-span-2"
        >
          <textarea
            id="sus-descripcion"
            className={claseInput}
            rows={4}
            maxLength={TOPE_DESCRIPCION_SUSCRIPCION}
            value={form.descripcion}
            onChange={(e) => set('descripcion', e.target.value)}
          />
        </Campo>
      </div>

      <fieldset className="rounded-md border border-borde p-4">
        <legend className="px-1 text-xs text-tinta/55">Quién la ofrece</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            label="Nombre"
            htmlFor="sus-oferente"
            requerido
            error={errorDe('ofrecidaPor.nombre')}
          >
            <input
              id="sus-oferente"
              className={claseInput}
              maxLength={TOPE_OFRECIDA_POR_SUSCRIPCION}
              value={form.ofrecidaPor.nombre}
              onChange={(e) => setOfrecidaPor('nombre', e.target.value)}
            />
          </Campo>

          <Campo label="Qué es" htmlFor="sus-tipo-oferente" requerido error={errorDe('ofrecidaPor.tipo')}>
            <TaxonomiaSelect
              campo="tipo-oferente"
              uid={uid}
              id="sus-tipo-oferente"
              value={form.ofrecidaPor.tipo}
              onChange={(v, label) => {
                setOfrecidaPor('tipo', v);
                recordarLabel('tipo-oferente', label);
              }}
              autoSeleccionarPrimera
            />
          </Campo>

          <Campo label="Instagram" htmlFor="sus-oferente-ig" error={errorDe('ofrecidaPor.instagram')}>
            <input
              id="sus-oferente-ig"
              className={claseInput}
              placeholder="sin la arroba"
              value={form.ofrecidaPor.instagram}
              onChange={(e) => setOfrecidaPor('instagram', e.target.value)}
            />
          </Campo>

          {/*
            El enlace a la ficha de la librería (§ 5 del PRD). Se guarda la
            dirección web y no el nombre, y la ficha **solo lo linkea si esa
            librería está publicada**: si está esperando decisión, el enlace no
            aparece en vez de llevar a una página que no existe.
          */}
          <Campo
            label="Si la ofrece una librería de la Guía"
            htmlFor="sus-libreria"
            error={errorDe('ofrecidaPor.libreriaSlug')}
            ayuda="Su dirección web, sin /guia/librerias/. Solo se enlaza si esa librería está publicada."
          >
            <input
              id="sus-libreria"
              className={claseInput}
              placeholder="del-otro-lado"
              value={form.ofrecidaPor.libreriaSlug}
              onChange={(e) => setOfrecidaPor('libreriaSlug', e.target.value)}
            />
          </Campo>
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Cada cuánto llega" htmlFor="sus-periodicidad" requerido error={errorDe('periodicidad')}>
          <TaxonomiaSelect
            campo="periodicidad"
            uid={uid}
            id="sus-periodicidad"
            value={form.periodicidad}
            onChange={(v, label) => {
              set('periodicidad', v);
              recordarLabel('periodicidad', label);
            }}
            autoSeleccionarPrimera
          />
        </Campo>

        <Campo
          label="Compromiso mínimo"
          htmlFor="sus-compromiso"
          error={errorDe('compromisoMinimo')}
          ayuda="Como se lee: «Sin compromiso», «3 meses». Si no lo dice, dejalo vacío."
        >
          <input
            id="sus-compromiso"
            className={claseInput}
            maxLength={TOPE_COMPROMISO_SUSCRIPCION}
            value={form.compromisoMinimo}
            onChange={(e) => set('compromisoMinimo', e.target.value)}
          />
        </Campo>
      </div>

      <Campo label="Qué incluye" htmlFor="sus-incluye" comoGrupo error={errorDe('incluye')}>
        <TagsInput
          campo="incluye-suscripcion"
          uid={uid}
          id="sus-incluye"
          value={form.incluye}
          onChange={(slugs, nuevos) => {
            set('incluye', slugs);
            recordarMultivalor('incluye-suscripcion', nuevos);
          }}
        />
      </Campo>

      <Campo
        label="Y además…"
        htmlFor="sus-incluye-otro"
        error={errorDe('incluyeOtro')}
        ayuda="Lo que no entra en la lista de arriba, en una línea."
      >
        <input
          id="sus-incluye-otro"
          className={claseInput}
          maxLength={TOPE_OTRO_SUSCRIPCION}
          value={form.incluyeOtro}
          onChange={(e) => set('incluyeOtro', e.target.value)}
        />
      </Campo>

      {/*
        **El condicional del §11.** `manda` parte el catálogo en dos mundos y es
        el primer filtro del sitio; los cuatro campos de abajo solo tienen sentido
        de un lado. La condición es `pideDatosDeEnvio`, la misma del schema.
      */}
      <fieldset className="rounded-md border border-borde p-4">
        <legend className="px-1 text-xs text-tinta/55">Si manda libros</legend>
        <label className="flex min-h-touch items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.envio.manda}
            onChange={(e) => setEnvio('manda', e.target.checked)}
          />
          Manda libros
        </label>
        {errorDe('envio.manda') && (
          <p className="mt-1 text-xs text-acento">{errorDe('envio.manda')}</p>
        )}

        {muestraEnvio && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Campo label="Cuántos por entrega" htmlFor="sus-cuantos" error={errorDe('envio.cuantos')}>
              <input
                id="sus-cuantos"
                className={claseInput}
                type="number"
                inputMode="numeric"
                min={MIN_LIBROS_POR_ENTREGA}
                max={MAX_LIBROS_POR_ENTREGA}
                value={form.envio.cuantos}
                onChange={(e) => setEnvio('cuantos', e.target.value)}
              />
            </Campo>

            {/*
              **Texto libre y no un desplegable** (§ 4.2 del PRD): «novela negra
              latinoamericana contemporánea» no entra en una lista, y forzarlo
              produce las cuatro variantes de lo mismo. El buscador lo encuentra
              igual.
            */}
            <Campo
              label="De qué tema"
              htmlFor="sus-tematica"
              error={errorDe('envio.tematica')}
              ayuda="Como lo dirías: «poesía argentina», «novela negra»."
            >
              <input
                id="sus-tematica"
                className={claseInput}
                maxLength={TOPE_TEMATICA_SUSCRIPCION}
                value={form.envio.tematica}
                onChange={(e) => setEnvio('tematica', e.target.value)}
              />
            </Campo>

            <Campo
              label="De qué editoriales"
              htmlFor="sus-editoriales"
              requerido
              error={errorDe('envio.editoriales')}
              ayuda="Si no lo dice, elegí «No lo dice»: es una respuesta, y así no queda marcado algo que no es."
            >
              <TaxonomiaSelect
                campo="perfil-editorial"
                uid={uid}
                id="sus-editoriales"
                value={form.envio.editoriales}
                onChange={(v, label) => {
                  setEnvio('editoriales', v);
                  recordarLabel('perfil-editorial', label);
                }}
                placeholder="Elegí una opción"
              />
            </Campo>

            <Campo label="¿Se sabe qué libro llega?" htmlFor="sus-sorpresa" error={errorDe('envio.sorpresa')}>
              <select
                id="sus-sorpresa"
                className={claseInput}
                value={form.envio.sorpresa}
                onChange={(e) => setEnvio('sorpresa', e.target.value)}
              >
                <option value="">No lo dice</option>
                <option value="si">Es sorpresa</option>
                <option value="no">Se sabe de antemano</option>
              </select>
            </Campo>
          </div>
        )}
      </fieldset>

      <Campo label="Extras" htmlFor="sus-extras" comoGrupo error={errorDe('extras')}>
        <TagsInput
          campo="extras-suscripcion"
          uid={uid}
          id="sus-extras"
          value={form.extras}
          onChange={(slugs, nuevos) => {
            set('extras', slugs);
            recordarMultivalor('extras-suscripcion', nuevos);
          }}
        />
      </Campo>

      <Campo label="Otros extras" htmlFor="sus-extras-otro" error={errorDe('extrasOtro')}>
        <input
          id="sus-extras-otro"
          className={claseInput}
          maxLength={TOPE_OTRO_SUSCRIPCION}
          value={form.extrasOtro}
          onChange={(e) => set('extrasOtro', e.target.value)}
        />
      </Campo>

      <Campo label="A dónde llega" htmlFor="sus-alcance" comoGrupo error={errorDe('alcance')}>
        <TagsInput
          campo="alcance-envio"
          uid={uid}
          id="sus-alcance"
          value={form.alcance}
          onChange={(slugs, nuevos) => {
            set('alcance', slugs);
            recordarMultivalor('alcance-envio', nuevos);
          }}
        />
      </Campo>

      {/*
        **El precio, y la fecha que no se tipea** — DEC-12.

        El cartel no es decorativo: es lo que hace que quien carga entienda por
        qué el sitio va a mostrar una fecha al lado del número, y que corregir
        cualquier otra cosa de la ficha no la mueve.
      */}
      <fieldset className="rounded-md border border-borde p-4">
        <legend className="px-1 text-xs text-tinta/55">
          Precio — se publica con la fecha en que lo cargaste al lado
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            label="Cuánto"
            htmlFor="sus-precio"
            error={errorDe('precio.monto')}
            ayuda="En pesos, sin puntos ni centavos. Si no querés publicarlo, dejalo vacío."
          >
            <input
              id="sus-precio"
              className={claseInput}
              type="number"
              inputMode="numeric"
              value={form.precio.monto}
              onChange={(e) => setForm((f) => ({ ...f, precio: { ...f.precio, monto: e.target.value } }))}
            />
          </Campo>

          <Campo label="Por qué período" htmlFor="sus-precio-periodo" error={errorDe('precio.porPeriodo')}>
            <TaxonomiaSelect
              campo="periodicidad"
              uid={uid}
              id="sus-precio-periodo"
              value={form.precio.porPeriodo}
              onChange={(v, label) => {
                setForm((f) => ({ ...f, precio: { ...f.precio, porPeriodo: v } }));
                recordarLabel('periodicidad', label);
              }}
            />
          </Campo>
        </div>
        <p className="mt-3 text-xs text-tinta/55">
          La fecha se actualiza sola cuando cambiás el número o el período, y no se mueve si
          corregís cualquier otra cosa. En el sitio no se puede filtrar ni ordenar por precio.
        </p>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        {/*
          ⚠️ **El link a la página de cobro de otra persona** (§ 7 del PRD). La
          ficha lo publica diciendo a dónde va —«Suscribite en la página de …»— y
          no como un botón que diga «Suscribite» a secas, que se leería como un
          respaldo del proyecto.
        */}
        <Campo
          label="Link para suscribirse"
          htmlFor="sus-link"
          error={errorDe('linkDeSuscripcion')}
          ayuda="Tiene que empezar con https://. En la ficha se muestra nombrando a quién le estás comprando."
          className="sm:col-span-2"
        >
          <input
            id="sus-link"
            className={claseInput}
            placeholder="https://…"
            maxLength={TOPE_LINK_SUSCRIPCION}
            value={form.linkDeSuscripcion}
            onChange={(e) => set('linkDeSuscripcion', e.target.value)}
          />
        </Campo>

        <Campo label="Instagram" htmlFor="sus-instagram" error={errorDe('instagram')}>
          <input
            id="sus-instagram"
            className={claseInput}
            placeholder="sin la arroba"
            value={form.instagram}
            onChange={(e) => set('instagram', e.target.value)}
          />
        </Campo>

        {/*
          El mismo cartel que en una librería, y por el mismo motivo: el §5.1
          advierte que un número personal publicado queda expuesto a bots, y acá
          quien lo carga es el dueño sobre el número de otra persona.
        */}
        <Campo
          label="WhatsApp"
          htmlFor="sus-whatsapp"
          error={errorDe('whatsapp')}
          ayuda="Este número se publica en el sitio."
        >
          <input
            id="sus-whatsapp"
            className={claseInput}
            inputMode="tel"
            value={form.whatsapp}
            onChange={(e) => set('whatsapp', e.target.value)}
          />
        </Campo>

        <Campo label="Mail" htmlFor="sus-mail" error={errorDe('mail')}>
          <input
            id="sus-mail"
            className={claseInput}
            type="email"
            maxLength={TOPE_MAIL_SUSCRIPCION}
            value={form.mail}
            onChange={(e) => set('mail', e.target.value)}
          />
        </Campo>
      </div>

      <Campo label="Fotos" htmlFor="sus-imagenes" comoGrupo error={errorDe('imagenes')}>
        <GaleriaEditor
          imagenes={form.imagenes}
          onChange={(imagenes) => set('imagenes', imagenes)}
          tituloActividad={form.nombre}
          errorDe={errorDe}
        />
      </Campo>

      {/*
        **El contacto de quien pidió el alta: interno, no sale nunca.** La
        proyección pública (`lib/suscripcionPublica.ts`) no lo lleva, y lo afirma
        un centinela en `tests/suscripcion-publica.test.ts`. Se dice acá arriba del
        campo por lo mismo que se dice lo contrario en el del WhatsApp: quien
        carga tiene que saber qué pasa con cada dato que escribe.
      */}
      <fieldset className="rounded-md border border-borde p-4">
        <legend className="px-1 text-xs text-tinta/55">
          Interno — no se publica. Es por dónde repreguntarle a quien pidió el alta.
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Por dónde" htmlFor="sus-contacto-via">
            <select
              id="sus-contacto-via"
              className={claseInput}
              value={form.contactoDeQuienCargo.via}
              onChange={(e) =>
                set('contactoDeQuienCargo', {
                  ...form.contactoDeQuienCargo,
                  via: e.target.value as ViaContactoSuscripcion,
                })
              }
            >
              {VIAS_CONTACTO_SUSCRIPCION.map((v) => (
                <option key={v} value={v}>
                  {TEXTO_VIA[v]}
                </option>
              ))}
            </select>
          </Campo>
          <Campo
            label="Contacto"
            htmlFor="sus-contacto-valor"
            error={errorDe('contactoDeQuienCargo.valor')}
          >
            <input
              id="sus-contacto-valor"
              className={claseInput}
              maxLength={200}
              value={form.contactoDeQuienCargo.valor}
              onChange={(e) =>
                set('contactoDeQuienCargo', {
                  ...form.contactoDeQuienCargo,
                  valor: e.target.value,
                })
              }
            />
          </Campo>
        </div>
      </fieldset>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void guardar()}
          disabled={guardando}
          className={`${claseBotonPrimario} disabled:opacity-50`}
        >
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
        <button type="button" onClick={onCancelar} className={claseBotonSecundario}>
          Cancelar
        </button>
      </div>

      {/*
        **Guardar no publica.** Es la misma advertencia que la bandeja pone
        arriba, y acá hace falta igual: el estado lo mueve la bandeja, no este
        formulario.
      */}
      <p className="text-xs text-tinta/55">
        Guardar no la publica. Para que entre al sitio hay que publicarla desde la lista de
        suscripciones.
      </p>
    </section>
  );
}
