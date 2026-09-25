import { Campo, claseInput } from '@/components/campos/Campo';
import { TaxonomiaSelect } from '@/components/admin/campos-del-panel';
import { CoordenadasSede } from '@/components/admin/CoordenadasSede';
import { GaleriaEditor } from '@/components/admin/GaleriaEditor';
import {
  MarcoDeFicha,
  useEtiquetasNuevas,
  useFichaDeDirectorio,
} from '@/components/admin/useFichaDeDirectorio';
import { conProvincia, subdivisionDe } from '@/lib/geografia.mjs';
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


export function LibreriaFormulario({ uid, inicial, onGuardado, onCancelar }: Props) {
  const { recordar, registrarUnaPorUna } = useEtiquetasNuevas();
  const { form, set, errorDe, fallo, aviso, guardando, slugResultante, congelado, guardar } =
    useFichaDeDirectorio<LibreriaForm, LibreriaConId>({
      inicial,
      vacia: libreriaVacia,
      aFormulario: libreriaAFormulario,
      schema: libreriaFormSchema,
      slugDe: slugDeLibreria,
      slugDisponible: slugDeLibreriaDisponible,
      slugTomado: 'Ya hay otra librería con esta dirección web.',
      crear: crearLibreria,
      guardarExistente: (id, f) => guardarLibreria(id, f),
      medicion: 'libreria-guardar',
      respaldo: 'No se pudo guardar la librería',
      /*
       * La provincia entra aunque sus 24 valores estén sembrados `fijo: true`:
       * el control ofrece «Otro…» mientras la cuenta pueda escribir
       * `/opciones/*`, así que tirar el label sería B-914 esperando a que alguien
       * lo use.
       */
      registrarEtiquetas: () =>
        registrarUnaPorUna(
          [
            ['barrio', 'barrio'],
            ['ciudad', 'ciudad'],
            ['provincia', 'provincia'],
          ],
          uid,
        ),
      onGuardado,
    });

  return (
    <MarcoDeFicha
      esAlta={!inicial}
      fallo={fallo}
      aviso={aviso}
      guardando={guardando}
      guardar={guardar}
      onCancelar={onCancelar}
      pie={{
        alCrear: 'Sin publicar queda esperando en la lista de librerías, y no se ve en el sitio.',
        alEditar:
          'Editar no cambia si está publicada o no. Eso se mueve desde la lista de librerías.',
      }}
    >
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
              recordar('provincia', label);
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
                recordar('barrio', label);
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
                recordar('ciudad', label);
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
        <legend className="px-1 text-xs text-tinta/65">
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
    </MarcoDeFicha>
  );
}
