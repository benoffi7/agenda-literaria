import { useMemo, useState } from 'react';
import { textoDeFallo } from '@/lib/fallosDelPanel';
import { z } from 'zod';
import {
  Campo,
  claseBotonPrimario,
  claseBotonSecundario,
  claseInput,
} from '@/components/campos/Campo';
import { TaxonomiaSelect } from '@/components/admin/campos-del-panel';
import { CoordenadasSede } from '@/components/admin/CoordenadasSede';
import { GaleriaEditor } from '@/components/admin/GaleriaEditor';
import { useFormularioSucio } from '@/components/admin/useFormularioSucio';
import { medirFuncion } from '@/lib/analytics';
import { conProvincia, subdivisionDe } from '@/lib/geografia.mjs';
import { upsertOpcion } from '@/lib/opciones';
import { slugBloqueado } from '@/lib/directorios';
import { libreriaFormSchema, libreriaVacia, slugDeLibreria } from '@/lib/libreria-schema';
import {
  crearLibreria,
  guardarLibreria,
  libreriaAFormulario,
  slugDeLibreriaDisponible,
} from '@/lib/librerias';
import { VIAS_CONTACTO_LIBRERIA } from '@/types/libreria';
import type { LibreriaConId, LibreriaForm, ViaContactoLibreria } from '@/types/libreria';

/** Cómo se lee cada canal en el desplegable. El modelo guarda el slug. */
const TEXTO_VIA: Record<ViaContactoLibreria, string> = {
  mail: 'Mail',
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
};

/**
 * **El formulario de una librería, del lado del panel** — B-901, tajada 2 paso 14.
 *
 * Es la **tercera puerta** del § 1 del PRD («el formulario de admin: el dueño,
 * logueado»), y hoy la única abierta: el `create` público de `/guia/librerias/sumar`
 * sigue cerrado por B-872 y esa tajada es otra (`firestore.rules` lo deja escrito
 * con los cuatro pasos para abrirlo).
 *
 * ── El mismo formulario con dos configuraciones, no dos formularios ───────
 * § 5 del PRD. Lo que existe hoy es la configuración de admin: todos los campos,
 * incluidos los tres que el público no va a ver (`slug`, `geo` y la gestión). La
 * diferencia entre las dos es qué se **pinta**, no qué existe, y por eso el tipo
 * es uno solo (`LibreriaForm`) y los schemas son dos con una regla de diferencia
 * (`libreriaFormSchema` / `libreriaPublicaFormSchema`).
 *
 * ── Lo que este componente no decide ─────────────────────────────────────
 * Ni la validación (`lib/libreria-schema.ts`), ni el armado del documento
 * (`formALibreria`), ni el ciclo de vida (`lib/directorios.ts`), ni la escritura
 * (`lib/librerias.ts`). Acá hay pantalla y nada más — el mismo reparto que
 * `PropuestasPanel` tiene con `bandejaDePropuestas.ts`.
 *
 * ── Reusa lo que ya está construido, y no es poco ─────────────────────────
 * `GaleriaEditor` (la subida, el recorte, el saneo de metadatos y la Function de
 * optimización, B-167/B-220), `CoordenadasSede`, `TaxonomiaSelect` con el
 * desplegable de barrio —**el mismo `/opciones/barrio` que usan las
 * actividades**, que es lo que deja cruzarlas en el hub— y `Campo`. Ni una línea
 * nueva de ninguna de esas cuatro cosas.
 *
 * ── La dirección web se congela al publicar — trampa 10 ──────────────────
 * `slugBloqueado` apaga el campo **y lo explica**: un campo deshabilitado sin
 * motivo es lo que hace que alguien lo intente cambiar por la consola. La mitad
 * que lo impide de verdad es `slugDeLibreriaCongelado` en `firestore.rules`.
 */
interface Props {
  uid: string;
  /** La ficha que se edita. Sin ella, es un alta. */
  inicial?: LibreriaConId;
  onGuardado: () => void;
  onCancelar: () => void;
}

/** `{ 'geo.lat': 'mensaje' }` — la forma en que `Campo` pide su error. */
const erroresDe = (issues: z.ZodIssue[]): Record<string, string> =>
  Object.fromEntries(issues.map((i) => [i.path.join('.'), i.message]));

export function LibreriaFormulario({ uid, inicial, onGuardado, onCancelar }: Props) {
  const [form, setForm] = useState<LibreriaForm>(() =>
    inicial ? libreriaAFormulario(inicial) : libreriaVacia(),
  );
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [fallo, setFallo] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  /**
   * La etiqueta que se tipeó en «Otro…», para darla de alta **al guardar** — B-914.
   *
   * Este formulario **descartaba el segundo argumento** del `onChange`
   * (`(v) => set('barrio', v)`), que es justamente el label a persistir (D-02). El
   * síntoma era silencioso y de los caros: el chip aparecía, la ficha guardaba el
   * slug, y la opción **nunca se daba de alta** en `/opciones/barrio` — así que
   * ningún desplegable la volvía a ofrecer y el sitio la mostraba des-slugueada
   * («villa-crespo» en vez de «Villa Crespo»). Es la trampa 6 por el lado que no se
   * ve: no cuatro variantes de la misma etiqueta, sino ninguna.
   *
   * Lo encontró el `auditor-trampas` comparando contra `SuscripcionFormulario`,
   * que sí las persiste.
   */
  const [labelNuevoDeBarrio, setLabelNuevoDeBarrio] = useState<string | null>(null);
  /**
   * Lo mismo para la ciudad — B-967. **Entra en el mismo cambio que el control**,
   * que es la lección de B-914: un `TaxonomiaSelect` cuyo label no se persiste
   * guarda el slug y no da de alta la opción, así que ningún desplegable la vuelve
   * a ofrecer y el sitio la muestra des-slugueada.
   *
   * La provincia **no lleva buffer y no le falta**: sus 24 valores están sembrados
   * `fijo: true`, así que «Otro…» no puede crear ninguna.
   */
  const [labelNuevoDeCiudad, setLabelNuevoDeCiudad] = useState<string | null>(null);
  /**
   * Y la provincia — B-967. **Sus 24 valores están sembrados `fijo: true`, así que
   * «Otro…» no debería crear ninguna**… pero el control lo ofrece igual mientras
   * la cuenta pueda escribir `/opciones/*` (`permitirOtro`), así que tirar el
   * label sería la misma trampa que B-914 esperando a que alguien lo use. Cuesta
   * tres líneas y no hay que razonar sobre si puede pasar.
   */
  const [labelNuevoDeProvincia, setLabelNuevoDeProvincia] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useFormularioSucio(form);

  const set = <K extends keyof LibreriaForm>(campo: K, valor: LibreriaForm[K]) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  const errorDe = (path: string) => errores[path];

  /** La dirección web que va a quedar, con el derivado a la vista antes de guardar. */
  const slugResultante = useMemo(() => slugDeLibreria(form), [form]);

  const congelado = inicial ? slugBloqueado(inicial) : false;

  const guardar = async (publicar = false) => {
    const parsed = libreriaFormSchema.safeParse(form);
    if (!parsed.success) {
      setErrores(erroresDe(parsed.error.issues));
      setFallo('Faltan datos o hay algo mal cargado. Mirá los campos marcados.');
      return;
    }
    setErrores({});
    setGuardando(true);
    try {
      /*
       * La guarda **de aviso** del slug (ver `slugDeLibreriaDisponible`): no es
       * una garantía —la de B-909 es `asegurarSlugPublicable`, al publicar— pero convierte un
       * choque en un mensaje con arreglo de una línea en vez de dos fichas con la
       * misma URL descubiertas tres semanas después.
       *
       * Se salta cuando el slug está congelado: ahí no cambió, y preguntarlo
       * sería una lectura por guardado para una respuesta que ya se sabe.
       */
      if (!congelado && !(await slugDeLibreriaDisponible(slugResultante, inicial?.id))) {
        setErrores({ slug: 'Ya hay otra librería con esta dirección web.' });
        setFallo('La dirección web está tomada. Cambiala y volvé a guardar.');
        return;
      }
      if (inicial) await guardarLibreria(inicial.id, parsed.data as LibreriaForm);
      else await crearLibreria(parsed.data as LibreriaForm, publicar);
      medirFuncion('libreria-guardar');
      setFallo(null);
      /*
       * La etiqueta nueva, **después** de guardar y en su propio `try` — el orden
       * de `guardarActividad` y por el mismo motivo: primero se escribe la ficha,
       * que es lo que no se puede perder, y después se siembra la opción.
       *
       * Y lo que falla se avisa **por su nombre**, no con un «algo salió mal»: el
       * arreglo es volver a tipear esa etiqueta (B-177).
       */
      for (const [campo, comoSeLlama, label] of [
        ['barrio', 'barrio', labelNuevoDeBarrio],
        ['ciudad', 'ciudad', labelNuevoDeCiudad],
        ['provincia', 'provincia', labelNuevoDeProvincia],
      ] as const) {
        if (!label?.trim()) continue;
        try {
          await upsertOpcion(campo, label, uid);
        } catch {
          setAviso(
            `Se guardó, pero el ${comoSeLlama} «${label}» no quedó en la lista. ` +
              'Volvé a tipearlo la próxima vez que edites la ficha.',
          );
          return;
        }
      }
      onGuardado();
    } catch (e: unknown) {
      setFallo(textoDeFallo(e, { respaldo: 'No se pudo guardar la librería' }));
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
        <Campo label="Nombre" htmlFor="lib-nombre" requerido error={errorDe('nombre')}>
          <input
            id="lib-nombre"
            className={claseInput}
            maxLength={80}
            value={form.nombre}
            onChange={(e) => set('nombre', e.target.value)}
          />
        </Campo>

        {/*
          B-981 — **«Link de la ficha» y no «Dirección web».**

          Lo reportó el dueño cargando una librería desde el panel: «lugar para
          página web 2 veces». No estaba duplicado — este campo es el **slug** y
          más abajo está el **sitio web de la librería**, pero los dos se
          llamaban casi igual. Y en librerías y lugares hay además un
          «Dirección», que es la de la calle: tres rótulos peleando por la misma
          palabra.

          El rótulo dice ahora de qué link se trata, que es lo que la ayuda de
          abajo ya explicaba y el título contradecía.
        */}
        <Campo
          label="Link de la ficha"
          htmlFor="lib-slug"
          error={errorDe('slug')}
          ayuda={
            congelado
              ? `Fija desde que se publicó: /${form.slug}. Cambiarla rompería el link que ya está en Google.`
              : `Queda en /guia/librerias/${slugResultante || '…'}. Si lo dejás vacío sale del nombre.`
          }
        >
          <input
            id="lib-slug"
            className={claseInput}
            maxLength={120}
            disabled={congelado}
            placeholder={slugResultante}
            value={form.slug}
            onChange={(e) => set('slug', e.target.value)}
          />
        </Campo>

        <Campo
          label="Qué tiene, qué la hace distinta"
          htmlFor="lib-descripcion"
          error={errorDe('descripcion')}
          className="sm:col-span-2"
        >
          <textarea
            id="lib-descripcion"
            className={claseInput}
            rows={4}
            maxLength={1000}
            value={form.descripcion}
            onChange={(e) => set('descripcion', e.target.value)}
          />
        </Campo>

        <Campo label="Dirección" htmlFor="lib-direccion" requerido error={errorDe('direccion')}>
          <input
            id="lib-direccion"
            className={claseInput}
            maxLength={160}
            value={form.direccion}
            onChange={(e) => set('direccion', e.target.value)}
          />
        </Campo>

        {/*
          B-982 — el horario de atención, **texto libre y opcional**, reportado
          por el dueño: «no tiene horario de atención». Es el dato que más se
          busca después de la dirección.

          La ayuda muestra la forma esperada en vez de imponerla con un editor:
          la decisión del dueño fue texto libre, y el costo asumido es que no se
          puede filtrar por «abierto ahora» ni emitir `openingHours` en el
          JSON-LD — `schema.org` lo quiere en un formato fijo y un texto libre no
          valida. Publicar un horario mal formado es peor que no publicarlo.
        */}
        <Campo
          label="Horario de atención"
          htmlFor="lib-horarios"
          error={errorDe('horarios')}
          ayuda="Como quieras: «Lun a vie de 10 a 20, sábados de 10 a 14»."
        >
          <input
            id="lib-horarios"
            className={claseInput}
            maxLength={200}
            placeholder="Lun a vie de 10 a 20, sábados de 10 a 14"
            value={form.horarios}
            onChange={(e) => set('horarios', e.target.value)}
          />
        </Campo>

        {/*
          **La misma cascada que una sede** — B-967, D-710. Provincia primero, y de
          ahí barrio (CABA) o ciudad (el resto), con la misma `subdivisionDe` que
          usan el editor de modalidades y el riel del sitio.

          Los tres vocabularios son **los mismos que usan las actividades** (§ 2 del
          PRD): una librería en Palermo y un taller en Palermo comparten slug, que
          es lo que deja mostrar las dos cosas en el hub de barrio. Por eso van
          controles de taxonomía y no inputs libres.
        */}
        <Campo label="Provincia" htmlFor="lib-provincia" requerido error={errorDe('provincia')}>
          <TaxonomiaSelect
            campo="provincia"
            /*
             * B-972 — **sin «Otro», porque las provincias son 24 y no se
             * agregan.** Es el único vocabulario cerrado de los tres: el barrio
             * y la ciudad se llenan escribiendo, y la provincia no tiene nada
             * que llenar. Dejar el botón ofrecía inventarse una —de ahí salió
             * `'cordoba-capital'`— y el `.refine(esProvincia)` del schema la
             * rechaza al guardar, o sea un camino que la UI ofrece y la
             * validación corta. Mejor no ofrecerlo.
             */
            permitirOtro={false}
            uid={uid}
            id="lib-provincia"
            value={form.provincia}
            onChange={(v, label) => {
              // `conProvincia` arrastra los otros dos: CABA completa la ciudad
              // sola, salir de CABA limpia el barrio. Es regla del modelo y por
              // eso vive en `lib/geografia.mjs`, no acá.
              const geo = conProvincia(
                { provincia: form.provincia, barrio: form.barrio, ciudad: form.ciudad },
                v,
              );
              set('provincia', geo.provincia);
              set('barrio', geo.barrio);
              set('ciudad', geo.ciudad);
              if (label) setLabelNuevoDeProvincia(label);
            }}
            placeholder="Elegí la provincia"
          />
        </Campo>

        {subdivisionDe(form.provincia) === 'barrio' ? (
          <Campo label="Barrio" htmlFor="lib-barrio" error={errorDe('barrio')}>
            <TaxonomiaSelect
              campo="barrio"
              uid={uid}
              id="lib-barrio"
              value={form.barrio}
              onChange={(v, label) => {
                set('barrio', v);
                // El segundo argumento es el label a persistir, y tirarlo era B-914.
                if (label) setLabelNuevoDeBarrio(label);
              }}
              placeholder="Elegí el barrio"
            />
          </Campo>
        ) : (
          <Campo
            label="Ciudad"
            htmlFor="lib-ciudad"
            error={errorDe('ciudad')}
            ayuda={form.provincia ? undefined : 'Elegí primero la provincia.'}
          >
            <TaxonomiaSelect
              campo="ciudad"
              uid={uid}
              id="lib-ciudad"
              value={form.ciudad}
              deshabilitado={!form.provincia}
              onChange={(v, label) => {
                set('ciudad', v);
                if (label) setLabelNuevoDeCiudad(label);
              }}
              placeholder="Elegí o agregá la ciudad"
            />
          </Campo>
        )}

        <Campo
          label="Coordenadas"
          htmlFor="lib-geo"
          comoGrupo
          error={errorDe('geo.lat') ?? errorDe('geo.lng') ?? errorDe('geo')}
          className="sm:col-span-2"
        >
          <CoordenadasSede
            id="lib-geo"
            geo={
              form.geo.lat && form.geo.lng
                ? { lat: Number(form.geo.lat), lng: Number(form.geo.lng) }
                : null
            }
            onChange={(g) =>
              set('geo', g ? { lat: String(g.lat), lng: String(g.lng) } : { lat: '', lng: '' })
            }
          />
        </Campo>

        <Campo label="Instagram" htmlFor="lib-instagram" error={errorDe('instagram')}>
          <input
            id="lib-instagram"
            className={claseInput}
            placeholder="@casabrandon o el link del perfil"
            value={form.instagram}
            onChange={(e) => set('instagram', e.target.value)}
          />
        </Campo>

        {/*
          **El cartel del WhatsApp, y no es decorativo**: es el criterio de
          aceptación 4 del PRD. El §5.1 del `CLAUDE.md` advierte que un número
          personal publicado queda expuesto a bots; acá el número es de trabajo,
          pero solo si quien lo carga sabe que se publica. En el formulario del
          panel lo carga el dueño sobre el número de otra persona, así que decirlo
          importa igual o más.
        */}
        <Campo
          label="WhatsApp"
          htmlFor="lib-whatsapp"
          error={errorDe('whatsapp')}
          ayuda="Este número se publica en el sitio."
        >
          <input
            id="lib-whatsapp"
            className={claseInput}
            inputMode="tel"
            value={form.whatsapp}
            onChange={(e) => set('whatsapp', e.target.value)}
          />
        </Campo>

        <Campo label="Sitio web" htmlFor="lib-web" error={errorDe('web')}>
          <input
            id="lib-web"
            className={claseInput}
            placeholder="https://…"
            value={form.web}
            onChange={(e) => set('web', e.target.value)}
          />
        </Campo>

        <Campo label="Mail" htmlFor="lib-mail" error={errorDe('mail')}>
          <input
            id="lib-mail"
            className={claseInput}
            type="email"
            value={form.mail}
            onChange={(e) => set('mail', e.target.value)}
          />
        </Campo>
      </div>

      <Campo label="Fotos" htmlFor="lib-imagenes" comoGrupo error={errorDe('imagenes')}>
        <GaleriaEditor
          imagenes={form.imagenes}
          onChange={(imagenes) => set('imagenes', imagenes)}
          tituloActividad={form.nombre}
          errorDe={errorDe}
        />
      </Campo>

      {/*
        **El contacto de quien pidió el alta: interno, no sale nunca.** Es el
        segundo dato personal de un tercero que el proyecto guarda, y la
        proyección pública (`lib/libreriaPublica.ts`) no lo lleva, y lo afirma un
        centinela en `tests/libreria-publica.test.ts` (el barrido de **esta**
        colección; el de la actividad es otro archivo y otro fixture). Se dice acá
        arriba del campo por lo mismo que se dice lo contrario en el del WhatsApp:
        quien carga tiene que saber qué pasa con cada dato que escribe.
      */}
      <fieldset className="rounded-md border border-borde p-4">
        <legend className="px-1 text-xs text-tinta/55">
          Interno — no se publica. Es por dónde repreguntarle a quien pidió el alta.
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Por dónde" htmlFor="lib-contacto-via">
            <select
              id="lib-contacto-via"
              className={claseInput}
              value={form.contactoDeQuienCargo.via}
              onChange={(e) =>
                set('contactoDeQuienCargo', {
                  ...form.contactoDeQuienCargo,
                  via: e.target.value as ViaContactoLibreria,
                })
              }
            >
              {VIAS_CONTACTO_LIBRERIA.map((v) => (
                <option key={v} value={v}>
                  {TEXTO_VIA[v]}
                </option>
              ))}
            </select>
          </Campo>
          <Campo
            label="Contacto"
            htmlFor="lib-contacto-valor"
            error={errorDe('contactoDeQuienCargo.valor')}
          >
            <input
              id="lib-contacto-valor"
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

      {/*
        B-983 — **dos botones al crear, uno solo al editar.**

        Antes había un botón y un aviso que decía «Guardar no la publica»: cargar
        desde el panel dejaba la ficha en `pendiente` y había que ir a la bandeja
        a publicarla. Lo reportó el dueño — «no se sube automáticamente, lo tengo
        que validar después de cargar»—, y el paso era ceremonia: **quien carga
        desde el panel es el revisor**, no hay tercero a quien revisarle nada.

        **«Guardar sin publicar» se queda**, y no por simetría: los estados del
        directorio son `pendiente | publicado | rechazado`, **sin `borrador`**, así
        que es la única forma de guardar una ficha a medio cargar sin que salga al
        sitio.

        **Al editar no aparecen los dos.** `crearLibreria` es lo único que elige
        el estado; `guardarLibreria` no lo toca a propósito —el estado de una
        ficha que ya existe lo mueve la bandeja, que es donde está el historial de
        revisión—. Poner acá un «publicar» que a veces publica y a veces no sería
        un botón que miente.
      */}
      <div className="flex flex-wrap gap-2">
        {!inicial && (
          <button
            type="button"
            onClick={() => void guardar(true)}
            disabled={guardando}
            className={`${claseBotonPrimario} disabled:opacity-50`}
          >
            {guardando ? 'Guardando…' : 'Guardar y publicar'}
          </button>
        )}
        <button
          type="button"
          onClick={() => void guardar()}
          disabled={guardando}
          className={`${inicial ? claseBotonPrimario : claseBotonSecundario} disabled:opacity-50`}
        >
          {guardando ? 'Guardando…' : inicial ? 'Guardar' : 'Guardar sin publicar'}
        </button>
        <button type="button" onClick={onCancelar} className={claseBotonSecundario}>
          Cancelar
        </button>
      </div>

      <p className="text-xs text-tinta/55">
        {inicial
          ? 'Editar no cambia si está publicada o no. Eso se mueve desde la lista de librerías.'
          : 'Sin publicar queda esperando en la lista de librerías, y no se ve en el sitio.'}
      </p>
    </section>
  );
}
