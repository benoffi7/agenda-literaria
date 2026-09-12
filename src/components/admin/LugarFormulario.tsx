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
import {
  lugarFormSchema,
  lugarVacio,
  puedePublicarLaDireccion,
  slugDeLugar,
} from '@/lib/lugar-schema';
import {
  crearLugar,
  guardarLugar,
  lugarAFormulario,
  slugDeLugarDisponible,
} from '@/lib/lugares';
import { upsertOpcion, upsertOpciones } from '@/lib/opciones';
import {
  MAX_CAPACIDAD_LUGAR,
  MIN_CAPACIDAD_LUGAR,
  TOPE_CAPACIDAD_NOTAS_LUGAR,
  TOPE_CIUDAD_LUGAR,
  TOPE_CONDICION_NOTAS_LUGAR,
  TOPE_DESCRIPCION_LUGAR,
  TOPE_DIRECCION_LUGAR,
  TOPE_MAIL_LUGAR,
  TOPE_NOMBRE_LUGAR,
  TOPE_OTRO_LUGAR,
  TOPE_SLUG_LUGAR,
  TOPE_WEB_LUGAR,
  UNIDADES_DE_PRECIO_LUGAR,
  VIAS_CONTACTO_LUGAR,
} from '@/types/lugar';
import type { CampoMultivalor, CampoTaxonomia } from '@/types/actividad';
import type { LugarConId, LugarForm, UnidadDePrecioLugar, ViaContactoLugar } from '@/types/lugar';

/** Cómo se lee cada canal en el desplegable. El modelo guarda el slug. */
const TEXTO_VIA: Record<ViaContactoLugar, string> = {
  mail: 'Mail',
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
};

/** Cómo se lee cada unidad de precio. El modelo guarda el valor de la izquierda. */
const TEXTO_UNIDAD: Record<UnidadDePrecioLugar, string> = {
  hora: 'Por hora',
  jornada: 'Por jornada',
  evento: 'Por evento',
  persona: 'Por persona',
};

/**
 * **El formulario de un lugar para eventos, del lado del panel** — B-833,
 * tajada 4.
 *
 * Es la **tercera puerta** del § 1 del PRD («el formulario de admin: el dueño,
 * logueado»), y hoy la única abierta: el `create` público de
 * `/guia/lugares/sumar` sigue cerrado por B-872, y `firestore.rules` deja
 * escritos los cinco pasos para abrirlo.
 *
 * Y acá esa puerta no es un andamio sino **la forma recomendada de arrancar**
 * (§ 10 del PRD): los lugares que ya están en la base como sede —los que
 * `src/lib/sedesRepetidas.ts` detecta— cargados a mano, **con permiso pedido**.
 *
 * ── Lo que este componente no decide ─────────────────────────────────────
 * Ni la validación (`lib/lugar-schema.ts`), ni el armado del documento
 * (`formALugar`), ni el ciclo de vida (`lib/directorios.ts`), ni la escritura
 * (`lib/lugares.ts`). Acá hay pantalla y nada más.
 *
 * ── Lo único propio, y es el § 6 entero: la casilla de la dirección ──────
 * **El default lo decide el tipo, no quien carga.** Elegir «Casa» apaga la
 * casilla en el acto y el cartel de al lado dice por qué. «Un default que hay
 * que apagar a mano es el que se olvida» (§ 6), así que acá se apaga sola.
 *
 * Y si alguien la vuelve a prender sobre un domicilio particular, **esta
 * pantalla avisa y no frena**. Es el reparto que el `auditor-privacidad` corrigió:
 * la primera versión lo hacía el schema con un error bloqueante, y eso cerraba el
 * **único camino legítimo** —un admin que sí pidió permiso a quien vive ahí no
 * podía guardar—. Una decisión que alguien tiene derecho a tomar no se frena: se
 * señala.
 *
 * La otra mitad no está en esta pantalla: `firestore.rules` fuerza el flag en
 * `false` cuando la ficha viene del **formulario público**, sea cual sea el tipo
 * de lugar. Acá el tipo decide el **default**, que es otra cosa.
 *
 * ── El precio, y la mitad que este formulario NO tiene ───────────────────
 * B-837. Hay un monto y una unidad, y **no hay campo de fecha**: la fecha la
 * pone quien guarda (`guardarLugar`), se estampa con el reloj del servidor y
 * solo se mueve si el número se movió.
 *
 * ── Las etiquetas nuevas sí se registran ─────────────────────────────────
 * D-02: las opciones creadas con «Otro» se persisten **en el submit**, como en
 * `SuscripcionFormulario` y **no** como en el de librerías, que las descarta
 * (B-914). Acá hay tres vocabularios, y uno de ellos —`tipo-lugar`— decide el
 * default de la dirección: una etiqueta nueva que no se da de alta deja un tipo
 * que ningún desplegable vuelve a ofrecer.
 */
interface Props {
  uid: string;
  /** La ficha que se edita. Sin ella, es un alta. */
  inicial?: LugarConId;
  onGuardado: () => void;
  onCancelar: () => void;
}

/** `{ 'geo.lat': 'mensaje' }` — la forma en que `Campo` pide su error. */
const erroresDe = (issues: z.ZodIssue[]): Record<string, string> =>
  Object.fromEntries(issues.map((i) => [i.path.join('.'), i.message]));

export function LugarFormulario({ uid, inicial, onGuardado, onCancelar }: Props) {
  const [form, setForm] = useState<LugarForm>(() =>
    inicial ? lugarAFormulario(inicial) : lugarVacio(),
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

  const set = <K extends keyof LugarForm>(campo: K, valor: LugarForm[K]) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  /**
   * **Cambiar el tipo mueve la casilla de la dirección** — § 6 del PRD.
   *
   * No es una comodidad: es «el default lo decide el tipo, no el usuario». Va en
   * las dos direcciones a propósito —elegir «Casa» la apaga, y volver a un local
   * comercial la prende— porque el caso real es corregir un tipo mal elegido, y
   * ahí dejar la casilla como quedó publicaría la dirección de una casa o
   * escondería la de un café sin que nadie lo decidiera.
   *
   * La condición es `puedePublicarLaDireccion`, que es la misma que
   * `direccionPublicaPorDefecto` del modelo: el default del panel se decide en un
   * solo lugar. **Lo que esa lista no puede prometer** —y está dicho en su
   * docblock— es cubrir un tipo que alguien tipee con «Otro»: ahí el default
   * vuelve a ser publicar, y el aviso de abajo no aparece. Lo que sí no depende
   * de la lista es el camino público, que la regla cierra mire lo que mire el
   * tipo.
   */
  const setTipo = (tipo: string, label?: string) => {
    setForm((f) => ({ ...f, tipo, direccionPublica: puedePublicarLaDireccion(tipo) }));
    recordarLabel('tipo-lugar', label);
  };

  const setGeo = (campo: 'lat' | 'lng', valor: string) =>
    setForm((f) => ({ ...f, geo: { ...f.geo, [campo]: valor } }));

  const recordarLabel = (campo: CampoTaxonomia, label?: string) =>
    setLabelsNuevos((prev) => (label ? { ...prev, [campo]: label } : prev));

  const recordarMultivalor = (campo: CampoMultivalor, nuevos: Record<string, string>) =>
    setMultivalorNuevos((prev) => ({ ...prev, [campo]: { ...prev[campo], ...nuevos } }));

  const errorDe = (path: string) => errores[path];

  /** La dirección web que va a quedar, con el derivado a la vista antes de guardar. */
  const slugResultante = useMemo(() => slugDeLugar(form), [form]);

  const congelado = inicial ? slugBloqueado(inicial) : false;
  /** ¿Este tipo de lugar admite publicar la dirección? Decide el cartel de la casilla. */
  const admiteDireccionPublica = puedePublicarLaDireccion(form.tipo);

  /**
   * Las etiquetas nuevas, después de guardar y en su propio `try`.
   *
   * El orden es el de `guardarActividad` y el de `SuscripcionFormulario`:
   * primero se escribe la ficha, que es lo que no se puede perder, y después se
   * siembran las opciones. Lo que falla acá se **avisa por su nombre** —no con
   * un «algo salió mal»—, porque el arreglo es volver a tipear **esa** etiqueta
   * (B-177).
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
    const parsed = lugarFormSchema.safeParse(form);
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
       * atómica en esta colección (B-909)— pero convierte un choque en un mensaje
       * con arreglo de una línea. Se saltea cuando el slug está congelado.
       */
      if (!congelado && !(await slugDeLugarDisponible(slugResultante, inicial?.id))) {
        setErrores({ slug: 'Ya hay otro lugar con esta dirección web.' });
        setFallo('La dirección web está tomada. Cambiala y volvé a guardar.');
        return;
      }
      if (inicial) {
        await guardarLugar(inicial.id, parsed.data as LugarForm, inicial);
      } else {
        await crearLugar(parsed.data as LugarForm);
      }
      medirFuncion('lugar-guardar');
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
      setFallo(e instanceof Error ? e.message : 'No se pudo guardar el lugar');
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
        <Campo label="Nombre" htmlFor="lug-nombre" requerido error={errorDe('nombre')}>
          <input
            id="lug-nombre"
            className={claseInput}
            maxLength={TOPE_NOMBRE_LUGAR}
            value={form.nombre}
            onChange={(e) => set('nombre', e.target.value)}
          />
        </Campo>

        <Campo
          label="Dirección web"
          htmlFor="lug-slug"
          error={errorDe('slug')}
          ayuda={
            congelado
              ? `Fija desde que se publicó: /${form.slug}. Cambiarla rompería el link que ya está en Google.`
              : `Queda en /guia/lugares/${slugResultante || '…'}. Si lo dejás vacío sale del nombre.`
          }
        >
          <input
            id="lug-slug"
            className={claseInput}
            maxLength={TOPE_SLUG_LUGAR}
            disabled={congelado}
            placeholder={slugResultante}
            value={form.slug}
            onChange={(e) => set('slug', e.target.value)}
          />
        </Campo>

        {/*
          **Qué es el lugar** — el «(por ahí poner a completar)» del pedido del
          dueño, y el campo del que depende el default de la dirección. Por eso
          va arriba de todo lo de «dónde»: se elige primero y lo de abajo se
          acomoda, que es el §11 del `CLAUDE.md`.
        */}
        <Campo label="Qué es el lugar" htmlFor="lug-tipo" requerido error={errorDe('tipo')}>
          <TaxonomiaSelect
            campo="tipo-lugar"
            uid={uid}
            id="lug-tipo"
            value={form.tipo}
            onChange={(v, label) => setTipo(v, label)}
            placeholder="Elegí una opción"
          />
        </Campo>

        <Campo
          label="Qué es y para quién"
          htmlFor="lug-descripcion"
          error={errorDe('descripcion')}
          className="sm:col-span-2"
          ayuda="Opcional. Qué tiene el lugar y qué tipo de actividad entra bien ahí."
        >
          <textarea
            id="lug-descripcion"
            className={claseInput}
            rows={4}
            maxLength={TOPE_DESCRIPCION_LUGAR}
            value={form.descripcion}
            onChange={(e) => set('descripcion', e.target.value)}
          />
        </Campo>
      </div>

      {/*
        ⚠️ **El recuadro del § 6 del PRD.** La casilla y su cartel viven pegados a
        los campos que gatean, y no en un acordeón «opcional»: quien carga tiene
        que ver la decisión al lado del dato.
      */}
      <fieldset className="rounded-md border border-borde p-4">
        <legend className="px-1 text-xs text-tinta/55">Dónde queda</legend>

        <label className="flex min-h-touch items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={form.direccionPublica}
            onChange={(e) => set('direccionPublica', e.target.checked)}
          />
          <span>
            Publicar la dirección en el sitio
            <span className="block text-xs text-tinta/55">
              {admiteDireccionPublica
                ? 'Si la destildás, en el sitio sale solo el barrio y quien quiera ir la pide escribiendo.'
                : 'Es un domicilio particular: la dirección no se publica. Para publicarla hace falta que quien vive ahí lo pida.'}
            </span>
          </span>
        </label>
        {/*
          ⚠️ **El aviso del § 6, y es lo único que queda avisando** — lo pidió el
          `auditor-privacidad`. La primera versión lo hacía el schema con un error
          bloqueante, y eso **impedía el único camino legítimo**: un admin que sí
          pidió permiso a quien vive ahí no podía guardar. Acá avisa y no frena,
          que es lo que corresponde a una decisión que alguien tiene derecho a
          tomar y tiene que tomar a conciencia.

          `role="status"` y no `role="alert"`: no es un error, es un cartel.
        */}
        {form.direccionPublica && !admiteDireccionPublica && (
          <p
            role="status"
            className="mt-2 rounded-md border border-acento/30 bg-acento/5 px-3 py-2 text-xs text-acento"
          >
            Estás por publicar la dirección de un domicilio particular. Hacelo solo si quien vive
            ahí lo pidió: es el dato con el que se llega a la puerta de alguien.
          </p>
        )}
        {errorDe('direccionPublica') && (
          <p className="mt-1 text-xs text-acento">{errorDe('direccionPublica')}</p>
        )}

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Campo
            label="Dirección"
            htmlFor="lug-direccion"
            error={errorDe('direccion')}
            className="sm:col-span-2"
            ayuda={
              form.direccionPublica
                ? 'Se publica en la ficha y en el dato que lee Google.'
                : 'No se publica: queda para poder contestar si alguien pregunta. Podés dejarla vacía.'
            }
          >
            <input
              id="lug-direccion"
              className={claseInput}
              maxLength={TOPE_DIRECCION_LUGAR}
              value={form.direccion}
              onChange={(e) => set('direccion', e.target.value)}
            />
          </Campo>

          {/*
            El barrio es **el mismo vocabulario** que el de las actividades y el
            de las librerías (§ 3 del PRD): con otro alfabeto el hub de barrio no
            cruzaría las tres cosas. Y sale al sitio **siempre**, también para una
            casa: es el «más o menos por Villa Crespo» que el § 6 sí deja
            publicar.
          */}
          <Campo label="Barrio" htmlFor="lug-barrio" requerido error={errorDe('barrio')}>
            <TaxonomiaSelect
              campo="barrio"
              uid={uid}
              id="lug-barrio"
              value={form.barrio}
              onChange={(v, label) => {
                set('barrio', v);
                recordarLabel('barrio', label);
              }}
              placeholder="Elegí el barrio"
            />
          </Campo>

          <Campo label="Ciudad" htmlFor="lug-ciudad" requerido error={errorDe('ciudad')}>
            <input
              id="lug-ciudad"
              className={claseInput}
              maxLength={TOPE_CIUDAD_LUGAR}
              value={form.ciudad}
              onChange={(e) => set('ciudad', e.target.value)}
            />
          </Campo>

          {/*
            ⚠️ Las coordenadas siguen la misma casilla que la dirección: unas
            coordenadas son la dirección escrita de otra forma, y `geo` es lo que
            pone la casa **en un mapa** (§ 6, el segundo agravante).
          */}
          <Campo
            label="Latitud"
            htmlFor="lug-lat"
            error={errorDe('geo.lat')}
            ayuda={
              form.direccionPublica
                ? 'Opcional. Sale en el mapa del dato que lee Google.'
                : 'No se publica: sigue la misma casilla que la dirección.'
            }
          >
            <input
              id="lug-lat"
              className={claseInput}
              inputMode="decimal"
              value={form.geo.lat}
              onChange={(e) => setGeo('lat', e.target.value)}
            />
          </Campo>

          <Campo label="Longitud" htmlFor="lug-lng" error={errorDe('geo.lng')}>
            <input
              id="lug-lng"
              className={claseInput}
              inputMode="decimal"
              value={form.geo.lng}
              onChange={(e) => setGeo('lng', e.target.value)}
            />
          </Campo>
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        {/*
          **La capacidad es un dato que quien carga no sabe** (§ 9 del PRD): por
          eso es opcional, por eso está el campo de notas al lado, y por eso en el
          sitio el filtro es por rangos y no por un número exacto.
        */}
        <Campo
          label="Para cuántas personas"
          htmlFor="lug-capacidad"
          error={errorDe('capacidad')}
          ayuda="Opcional. En el sitio se filtra por rangos, así que un número aproximado sirve."
        >
          <input
            id="lug-capacidad"
            className={claseInput}
            type="number"
            inputMode="numeric"
            min={MIN_CAPACIDAD_LUGAR}
            max={MAX_CAPACIDAD_LUGAR}
            value={form.capacidad}
            onChange={(e) => set('capacidad', e.target.value)}
          />
        </Campo>

        <Campo
          label="Aclaraciones de capacidad"
          htmlFor="lug-capacidad-notas"
          error={errorDe('capacidadNotas')}
          ayuda="«Sentados 20, de pie 35». Es la respuesta real a «¿cuántos entran?»."
        >
          <input
            id="lug-capacidad-notas"
            className={claseInput}
            maxLength={TOPE_CAPACIDAD_NOTAS_LUGAR}
            value={form.capacidadNotas}
            onChange={(e) => set('capacidadNotas', e.target.value)}
          />
        </Campo>
      </div>

      <Campo label="Qué incluye" htmlFor="lug-incluye" comoGrupo error={errorDe('incluye')}>
        <TagsInput
          campo="incluye-lugar"
          uid={uid}
          id="lug-incluye"
          value={form.incluye}
          onChange={(slugs, nuevos) => {
            set('incluye', slugs);
            recordarMultivalor('incluye-lugar', nuevos);
          }}
        />
      </Campo>

      <Campo
        label="Y además…"
        htmlFor="lug-incluye-otro"
        error={errorDe('incluyeOtro')}
        ayuda="Lo que no entra en la lista de arriba, en una línea."
      >
        <input
          id="lug-incluye-otro"
          className={claseInput}
          maxLength={TOPE_OTRO_LUGAR}
          value={form.incluyeOtro}
          onChange={(e) => set('incluyeOtro', e.target.value)}
        />
      </Campo>

      {/*
        **La condición, que no es un precio** — § 5 del PRD, el hallazgo del
        pedido: «no sé si todos cobran, o le dicen que tienen que consumir». Por
        eso lo obligatorio es el tipo de arreglo y el número es opcional.
      */}
      <fieldset className="rounded-md border border-borde p-4">
        <legend className="px-1 text-xs text-tinta/55">
          Cómo se usa — el precio es opcional y se publica con su fecha al lado
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            label="Condición"
            htmlFor="lug-condicion"
            requerido
            error={errorDe('condicion')}
            ayuda="«Con consumición» es una respuesta de primera clase, no un caso raro."
          >
            <TaxonomiaSelect
              campo="condicion-de-uso"
              uid={uid}
              id="lug-condicion"
              value={form.condicion}
              onChange={(v, label) => {
                set('condicion', v);
                recordarLabel('condicion-de-uso', label);
              }}
              placeholder="Elegí una opción"
            />
          </Campo>

          <Campo
            label="Aclaraciones"
            htmlFor="lug-condicion-notas"
            error={errorDe('condicionNotas')}
            ayuda="«Mínimo de consumición $8000 por persona», «dos horas»."
          >
            <input
              id="lug-condicion-notas"
              className={claseInput}
              maxLength={TOPE_CONDICION_NOTAS_LUGAR}
              value={form.condicionNotas}
              onChange={(e) => set('condicionNotas', e.target.value)}
            />
          </Campo>

          <Campo
            label="Cuánto"
            htmlFor="lug-precio"
            error={errorDe('precio.monto')}
            ayuda="En pesos, sin puntos ni centavos. Si no cobra, dejalo vacío."
          >
            <input
              id="lug-precio"
              className={claseInput}
              type="number"
              inputMode="numeric"
              value={form.precio.monto}
              onChange={(e) =>
                setForm((f) => ({ ...f, precio: { ...f.precio, monto: e.target.value } }))
              }
            />
          </Campo>

          <Campo label="Por qué unidad" htmlFor="lug-precio-unidad" error={errorDe('precio.porUnidad')}>
            <select
              id="lug-precio-unidad"
              className={claseInput}
              value={form.precio.porUnidad}
              onChange={(e) =>
                setForm((f) => ({ ...f, precio: { ...f.precio, porUnidad: e.target.value } }))
              }
            >
              {UNIDADES_DE_PRECIO_LUGAR.map((u) => (
                <option key={u} value={u}>
                  {TEXTO_UNIDAD[u]}
                </option>
              ))}
            </select>
          </Campo>
        </div>
        <p className="mt-3 text-xs text-tinta/55">
          La fecha se actualiza sola cuando cambiás el número o la unidad, y no se mueve si
          corregís cualquier otra cosa. En el sitio no se puede filtrar ni ordenar por precio: se
          filtra por sin costo, consumiendo o pagando.
        </p>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Instagram" htmlFor="lug-instagram" error={errorDe('instagram')}>
          <input
            id="lug-instagram"
            className={claseInput}
            placeholder="sin la arroba"
            value={form.instagram}
            onChange={(e) => set('instagram', e.target.value)}
          />
        </Campo>

        {/*
          El mismo cartel que en los otros dos directorios, y por el mismo motivo:
          el §5.1 advierte que un número personal publicado queda expuesto a bots,
          y acá quien lo carga es el dueño sobre el número de otra persona.
        */}
        <Campo
          label="WhatsApp"
          htmlFor="lug-whatsapp"
          error={errorDe('whatsapp')}
          ayuda="Este número se publica en el sitio."
        >
          <input
            id="lug-whatsapp"
            className={claseInput}
            inputMode="tel"
            value={form.whatsapp}
            onChange={(e) => set('whatsapp', e.target.value)}
          />
        </Campo>

        <Campo label="Mail" htmlFor="lug-mail" error={errorDe('mail')}>
          <input
            id="lug-mail"
            className={claseInput}
            type="email"
            maxLength={TOPE_MAIL_LUGAR}
            value={form.mail}
            onChange={(e) => set('mail', e.target.value)}
          />
        </Campo>

        <Campo label="Web" htmlFor="lug-web" error={errorDe('web')}>
          <input
            id="lug-web"
            className={claseInput}
            placeholder="https://…"
            maxLength={TOPE_WEB_LUGAR}
            value={form.web}
            onChange={(e) => set('web', e.target.value)}
          />
        </Campo>
      </div>

      <Campo label="Fotos" htmlFor="lug-imagenes" comoGrupo error={errorDe('imagenes')}>
        <GaleriaEditor
          imagenes={form.imagenes}
          onChange={(imagenes) => set('imagenes', imagenes)}
          tituloActividad={form.nombre}
          errorDe={errorDe}
        />
      </Campo>

      {/*
        **El contacto de quien pidió el alta: interno, no sale nunca.** La
        proyección pública (`lib/lugarPublico.ts`) no lo lleva, y lo afirma un
        centinela en `tests/lugar-publico.test.ts`. Acá además tiene un uso propio
        del § 6: es por dónde se pide el permiso para publicar la dirección de una
        casa.
      */}
      <fieldset className="rounded-md border border-borde p-4">
        <legend className="px-1 text-xs text-tinta/55">
          Interno — no se publica. Es por dónde repreguntarle a quien pidió el alta.
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Por dónde" htmlFor="lug-contacto-via">
            <select
              id="lug-contacto-via"
              className={claseInput}
              value={form.contactoDeQuienCargo.via}
              onChange={(e) =>
                set('contactoDeQuienCargo', {
                  ...form.contactoDeQuienCargo,
                  via: e.target.value as ViaContactoLugar,
                })
              }
            >
              {VIAS_CONTACTO_LUGAR.map((v) => (
                <option key={v} value={v}>
                  {TEXTO_VIA[v]}
                </option>
              ))}
            </select>
          </Campo>
          <Campo
            label="Contacto"
            htmlFor="lug-contacto-valor"
            error={errorDe('contactoDeQuienCargo.valor')}
          >
            <input
              id="lug-contacto-valor"
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
        Guardar no lo publica. Para que entre al sitio hay que publicarlo desde la lista de
        lugares.
      </p>
    </section>
  );
}
