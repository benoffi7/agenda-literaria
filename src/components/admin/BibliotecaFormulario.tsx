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
import { DIAS_PARA_REVISAR } from '@/lib/datoConFecha';
import { bibliotecaFormSchema, bibliotecaVacia, slugDeBiblioteca } from '@/lib/biblioteca-schema';
import {
  crearBiblioteca,
  guardarBiblioteca,
  bibliotecaAFormulario,
  slugDeBibliotecaDisponible,
} from '@/lib/bibliotecas';
import { VIAS_CONTACTO_BIBLIOTECA } from '@/types/biblioteca';
import type { BibliotecaConId, BibliotecaForm, ViaContactoBiblioteca } from '@/types/biblioteca';

/** Cómo se lee cada canal en el desplegable. El modelo guarda el slug. */
const TEXTO_VIA: Record<ViaContactoBiblioteca, string> = {
  mail: 'Mail',
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
};

/**
 * **El formulario de una biblioteca, del lado del panel** — B-960.
 *
 * ── El mismo formulario con dos configuraciones, no dos formularios ───────
 * Lo que existe acá es la configuración de admin: todos los campos, incluidos
 * los que el público no ve (`slug`, `geo` y la gestión). La diferencia entre las
 * dos es qué se **pinta**, no qué existe, y por eso el tipo es uno solo
 * (`BibliotecaForm`) y los schemas son dos con una regla de diferencia.
 *
 * ── Lo que este componente no decide ─────────────────────────────────────
 * Ni la validación (`lib/biblioteca-schema.ts`), ni el armado del documento
 * (`formABiblioteca`), ni el ciclo de vida (`lib/directorios.ts`), ni la
 * escritura (`lib/bibliotecas.ts`). Acá hay pantalla y nada más.
 *
 * ── Reusa lo que ya está construido ──────────────────────────────────────
 * `GaleriaEditor` (la subida, el recorte, el saneo de metadatos y la Function de
 * optimización, B-167/B-220), `CoordenadasSede`, `TaxonomiaSelect` y `Campo`. Ni
 * una línea nueva de ninguna de las cuatro.
 *
 * ── Lo único propio: los cuatro campos que no tiene una librería ──────────
 * `tipo`, `horarioDeSala`, `asociarse` y `catalogo`. Cada uno tiene su comentario
 * abajo; el que tiene algo que explicar es el costo de asociarse, porque su
 * fecha **no se tipea** y eso hay que decirlo en la pantalla.
 *
 * ── La dirección web se congela al publicar — trampa 10 ──────────────────
 * `slugBloqueado` apaga el campo **y lo explica**: un campo deshabilitado sin
 * motivo es lo que hace que alguien lo intente cambiar por la consola. La mitad
 * que lo impide de verdad es `slugDeBibliotecaCongelado` en `firestore.rules`.
 */
interface Props {
  uid: string;
  /** La ficha que se edita. Sin ella, es un alta. */
  inicial?: BibliotecaConId;
  onGuardado: () => void;
  onCancelar: () => void;
}


export function BibliotecaFormulario({ uid, inicial, onGuardado, onCancelar }: Props) {
  const { recordar, registrarUnaPorUna } = useEtiquetasNuevas();
  const { form, set, errorDe, fallo, aviso, guardando, slugResultante, congelado, guardar } =
    useFichaDeDirectorio<BibliotecaForm, BibliotecaConId>({
      inicial,
      vacia: bibliotecaVacia,
      aFormulario: bibliotecaAFormulario,
      schema: bibliotecaFormSchema,
      slugDe: slugDeBiblioteca,
      slugDisponible: slugDeBibliotecaDisponible,
      slugTomado: 'Ya hay otra biblioteca con esta dirección web.',
      crear: crearBiblioteca,
      /*
       * Con la ficha que se abrió: `guardarBiblioteca` la necesita para decidir
       * si el costo de asociarse cambió: solo entonces se refecha (DEC-12).
       */
      guardarExistente: guardarBiblioteca,
      medicion: 'biblioteca-guardar',
      respaldo: 'No se pudo guardar la biblioteca',
      registrarEtiquetas: () =>
        registrarUnaPorUna(
          [
            ['barrio', 'barrio'],
            ['ciudad', 'ciudad'],
            ['provincia', 'provincia'],
            ['tipo-biblioteca', 'tipo de biblioteca'],
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
        alCrear: 'Sin publicar queda esperando en la lista de bibliotecas, y no se ve en el sitio.',
        alEditar:
          'Editar no cambia si está publicada o no. Eso se mueve desde la lista de bibliotecas.',
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Nombre" htmlFor="bib-nombre" requerido error={errorDe('nombre')}>
          <input
            id="bib-nombre"
            className={claseInput}
            maxLength={80}
            value={form.nombre}
            onChange={(e) => set('nombre', e.target.value)}
          />
        </Campo>

        {/*
          B-981 — «Link de la ficha» y no «Dirección web»: más abajo está el
          **sitio web de la biblioteca** y en el medio hay una «Dirección» que es
          la de la calle. Tres rótulos peleando por la misma palabra fue lo que el
          dueño reportó en librerías, y acá se nace con el nombre corregido.
        */}
        <Campo
          label="Link de la ficha"
          htmlFor="bib-slug"
          error={errorDe('slug')}
          ayuda={
            congelado
              ? `Fija desde que se publicó: /${form.slug}. Cambiarla rompería el link que ya está en Google.`
              : `Queda en /guia/bibliotecas/${slugResultante || '…'}. Si lo dejás vacío sale del nombre.`
          }
        >
          <input
            id="bib-slug"
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
          htmlFor="bib-descripcion"
          error={errorDe('descripcion')}
          className="sm:col-span-2"
        >
          <textarea
            id="bib-descripcion"
            className={claseInput}
            rows={4}
            maxLength={1000}
            value={form.descripcion}
            onChange={(e) => set('descripcion', e.target.value)}
          />
        </Campo>

        {/*
          **El tipo de biblioteca** — la taxonomía propia de esta entidad, y de los
          cuatro campos nuevos el único que es eje de filtro. Es
          `/opciones/tipo-biblioteca` y **no** `/opciones/tipo`, que es la de una
          actividad: compartirla mezclaría «taller» con «popular».

          Opcional a propósito, con el mismo criterio que el horario: una ficha sin
          el tipo cargado sigue diciendo dónde queda y qué presta, y exigirlo
          dejaría inguardable la que llega de afuera con lo que la persona sabía.
        */}
        <Campo label="Qué biblioteca es" htmlFor="bib-tipo" error={errorDe('tipo')}>
          <TaxonomiaSelect
            campo="tipo-biblioteca"
            uid={uid}
            id="bib-tipo"
            value={form.tipo}
            onChange={(v, label) => {
              set('tipo', v);
              recordar('tipo-biblioteca', label);
            }}
            placeholder="Popular, municipal, universitaria…"
          />
        </Campo>

        <Campo label="Dirección" htmlFor="bib-direccion" requerido error={errorDe('direccion')}>
          <input
            id="bib-direccion"
            className={claseInput}
            maxLength={160}
            value={form.direccion}
            onChange={(e) => set('direccion', e.target.value)}
          />
        </Campo>

        {/*
          **Los dos horarios, y son dos campos porque en una biblioteca no son lo
          mismo.** El mostrador puede abrir de 9 a 20 para retirar y devolver, y la
          sala de lectura de 14 a 19 — o no existir. Quien va a sacar un libro
          necesita el primero; quien va a pasar la tarde leyendo, el segundo.

          Los dos son texto libre, con la decisión de B-982 y su costo asumido: no
          se puede filtrar por «abierta ahora» ni emitir `openingHours` en el
          JSON-LD, porque `schema.org` lo quiere en un formato fijo y un texto
          libre no valida. Publicar un horario mal formado es peor que no
          publicarlo.
        */}
        <Campo
          label="Horario de atención"
          htmlFor="bib-horarios"
          error={errorDe('horarios')}
          ayuda="Como quieras: «Lun a vie de 9 a 20, sábados de 10 a 14»."
        >
          <input
            id="bib-horarios"
            className={claseInput}
            maxLength={200}
            placeholder="Lun a vie de 9 a 20, sábados de 10 a 14"
            value={form.horarios}
            onChange={(e) => set('horarios', e.target.value)}
          />
        </Campo>

        <Campo
          label="Horario de sala de lectura"
          htmlFor="bib-horario-sala"
          error={errorDe('horarioDeSala')}
          ayuda="Si no tiene sala, dejalo vacío."
        >
          <input
            id="bib-horario-sala"
            className={claseInput}
            maxLength={200}
            placeholder="Lun a vie de 14 a 19"
            value={form.horarioDeSala}
            onChange={(e) => set('horarioDeSala', e.target.value)}
          />
        </Campo>

        {/*
          **El catálogo online** — el dato que más distingue una biblioteca de una
          librería como salida pública: poder mirar desde casa si el libro está
          antes de cruzar la ciudad.

          Campo aparte del sitio web y no un segundo uso de él: son dos destinos
          distintos, y muchas bibliotecas tienen el catálogo sin tener web propia
          (vive en un dominio de un sistema compartido, tipo Koha o Aguapey).
        */}
        <Campo
          label="Catálogo online"
          htmlFor="bib-catalogo"
          error={errorDe('catalogo')}
          ayuda="El link para buscar en su catálogo, si lo tiene."
        >
          <input
            id="bib-catalogo"
            className={claseInput}
            placeholder="https://…"
            value={form.catalogo}
            onChange={(e) => set('catalogo', e.target.value)}
          />
        </Campo>

        {/*
          **La misma cascada que una sede** — D-710. Provincia primero, y de ahí
          barrio (CABA) o ciudad (el resto), con la misma `subdivisionDe` que usan
          el editor de modalidades y el riel del sitio.

          Los tres vocabularios son **los mismos que usan las actividades**: una
          biblioteca en Recoleta y un taller en Recoleta comparten slug, que es lo
          que deja mostrar las dos cosas en el hub de barrio.
        */}
        <Campo label="Provincia" htmlFor="bib-provincia" requerido error={errorDe('provincia')}>
          <TaxonomiaSelect
            campo="provincia"
            /*
             * B-972 — sin «Otro», porque las provincias son 24 y no se agregan.
             * Dejar el botón ofrecía inventarse una —de ahí salió
             * `'cordoba-capital'`— y el `.refine(esProvincia)` del schema la
             * rechaza al guardar: un camino que la UI ofrece y la validación
             * corta.
             */
            permitirOtro={false}
            uid={uid}
            id="bib-provincia"
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
          <Campo label="Barrio" htmlFor="bib-barrio" error={errorDe('barrio')}>
            <TaxonomiaSelect
              campo="barrio"
              uid={uid}
              id="bib-barrio"
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
            htmlFor="bib-ciudad"
            error={errorDe('ciudad')}
            ayuda={form.provincia ? undefined : 'Elegí primero la provincia.'}
          >
            <TaxonomiaSelect
              campo="ciudad"
              uid={uid}
              id="bib-ciudad"
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
          htmlFor="bib-geo"
          comoGrupo
          error={errorDe('geo.lat') ?? errorDe('geo.lng') ?? errorDe('geo')}
          className="sm:col-span-2"
        >
          <CoordenadasSede
            id="bib-geo"
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

        <Campo label="Instagram" htmlFor="bib-instagram" error={errorDe('instagram')}>
          <input
            id="bib-instagram"
            className={claseInput}
            placeholder="@bpalberdi o el link del perfil"
            value={form.instagram}
            onChange={(e) => set('instagram', e.target.value)}
          />
        </Campo>

        {/*
          **El cartel del WhatsApp, y no es decorativo.** El §5.1 del `CLAUDE.md`
          advierte que un número personal publicado queda expuesto a bots; acá el
          número es institucional, pero solo si quien lo carga sabe que se
          publica. En el panel lo carga el dueño sobre el número de otra persona,
          así que decirlo importa igual o más.
        */}
        <Campo
          label="WhatsApp"
          htmlFor="bib-whatsapp"
          error={errorDe('whatsapp')}
          ayuda="Este número se publica en el sitio."
        >
          <input
            id="bib-whatsapp"
            className={claseInput}
            inputMode="tel"
            value={form.whatsapp}
            onChange={(e) => set('whatsapp', e.target.value)}
          />
        </Campo>

        <Campo label="Sitio web" htmlFor="bib-web" error={errorDe('web')}>
          <input
            id="bib-web"
            className={claseInput}
            placeholder="https://…"
            value={form.web}
            onChange={(e) => set('web', e.target.value)}
          />
        </Campo>

        <Campo label="Mail" htmlFor="bib-mail" error={errorDe('mail')}>
          <input
            id="bib-mail"
            className={claseInput}
            type="email"
            value={form.mail}
            onChange={(e) => set('mail', e.target.value)}
          />
        </Campo>
      </div>

      {/*
        **Asociarse: el flag y el costo, juntos y en ese orden.**

        El costo solo se pide si hace falta asociarse, y eso es una regla del
        modelo antes que de la pantalla: un costo colgado de un «no hace falta»
        lo rechazan el schema **y** `firestore.rules`, porque la ficha publicaría
        «no hace falta asociarse · $3.000 por año».

        **El costo es texto y no un número**, al revés que el precio de una
        suscripción: el carnet casi nunca es un número solo («$3.000 por año,
        gratis para jubilados»). Y como un dato con fecha no entra a ningún filtro
        ni a ningún orden (regla 2 de `datoConFecha.ts`), el entero no compraba
        nada.

        **La fecha no se tipea y hay que decirlo**: la pone el servidor al
        guardar, y se mueve solo si el número cambió. Eso es lo que hace que la
        fecha publicada al lado del monto signifique algo — si se pudiera elegir,
        no diría nada.
      */}
      <fieldset className="rounded-md border border-borde p-4">
        <legend className="px-1 text-xs text-tinta/65">Para llevarse libros</legend>
        <div className="flex flex-col gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.asociarse.haceFalta}
              onChange={(e) =>
                set('asociarse', {
                  haceFalta: e.target.checked,
                  // Apagar el flag limpia el costo: dejarlo colgado haría que el
                  // guardado fallara contra una regla que la persona no ve.
                  costo: e.target.checked ? form.asociarse.costo : '',
                })
              }
            />
            Hay que asociarse
          </label>

          {form.asociarse.haceFalta && (
            <Campo
              label="Cuánto sale asociarse"
              htmlFor="bib-asociarse-costo"
              error={errorDe('asociarse.costo')}
              ayuda={
                `Como quieras: «$3.000 por año», «gratis para jubilados». Se publica con ` +
                `la fecha de hoy al lado, y el panel te avisa a los ${DIAS_PARA_REVISAR} días ` +
                `para que lo revises. Si no sabés cuánto, dejalo vacío.`
              }
            >
              <input
                id="bib-asociarse-costo"
                className={claseInput}
                maxLength={120}
                placeholder="$3.000 por año"
                value={form.asociarse.costo}
                onChange={(e) =>
                  set('asociarse', { ...form.asociarse, costo: e.target.value })
                }
              />
            </Campo>
          )}
        </div>
      </fieldset>

      <Campo label="Fotos" htmlFor="bib-imagenes" comoGrupo error={errorDe('imagenes')}>
        <GaleriaEditor
          imagenes={form.imagenes}
          onChange={(imagenes) => set('imagenes', imagenes)}
          tituloActividad={form.nombre}
          errorDe={errorDe}
        />
      </Campo>

      {/*
        **El contacto de quien pidió el alta: interno, no sale nunca.** La
        proyección pública (`lib/bibliotecaPublica.ts`) no lo lleva, y lo afirma
        un centinela en `tests/biblioteca-publica.test.ts`. Se dice acá arriba del
        campo por lo mismo que se dice lo contrario en el del WhatsApp: quien
        carga tiene que saber qué pasa con cada dato que escribe.
      */}
      <fieldset className="rounded-md border border-borde p-4">
        <legend className="px-1 text-xs text-tinta/65">
          Interno — no se publica. Es por dónde repreguntarle a quien pidió el alta.
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Por dónde" htmlFor="bib-contacto-via">
            <select
              id="bib-contacto-via"
              className={claseInput}
              value={form.contactoDeQuienCargo.via}
              onChange={(e) =>
                set('contactoDeQuienCargo', {
                  ...form.contactoDeQuienCargo,
                  via: e.target.value as ViaContactoBiblioteca,
                })
              }
            >
              {VIAS_CONTACTO_BIBLIOTECA.map((v) => (
                <option key={v} value={v}>
                  {TEXTO_VIA[v]}
                </option>
              ))}
            </select>
          </Campo>
          <Campo
            label="Contacto"
            htmlFor="bib-contacto-valor"
            error={errorDe('contactoDeQuienCargo.valor')}
          >
            <input
              id="bib-contacto-valor"
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
