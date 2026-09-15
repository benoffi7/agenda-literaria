import { Campo, claseInput } from '@/components/campos/Campo';
import { claseBotonPrimario, claseRotulo } from '@/components/sitio/estilos';
import { CampoTrampa, Gracias, useAltaPublica } from '@/components/publico/altaPublica';
import { CampoDeEtiquetas, CampoDeTaxonomia } from '@/components/publico/camposDeTaxonomia';
import type { OpcionOfrecida } from '@/components/publico/camposDeTaxonomia';
import {
  suscripcionPublicaFormSchema,
  suscripcionVacia,
} from '@/lib/suscripcion-literaria-schema';
import {
  TOPE_COMPROMISO_SUSCRIPCION,
  TOPE_CONTACTO_SUSCRIPCION,
  TOPE_DESCRIPCION_SUSCRIPCION,
  TOPE_LINK_SUSCRIPCION,
  TOPE_MAIL_SUSCRIPCION,
  TOPE_NOMBRE_SUSCRIPCION,
  TOPE_OFRECIDA_POR_SUSCRIPCION,
  TOPE_OTRO_SUSCRIPCION,
  TOPE_TEMATICA_SUSCRIPCION,
  VIAS_CONTACTO_SUSCRIPCION,
} from '@/types/suscripcion-literaria';
import type {
  SuscripcionLiterariaForm,
  ViaContactoSuscripcion,
} from '@/types/suscripcion-literaria';

/**
 * **El formulario público de una suscripción literaria** —
 * `/guia/suscripciones/sumar`, § 5 del PRD 3.
 *
 * Es el modelo más complicado de los tres (§ 3.1 del PRD): seis vocabularios,
 * campos condicionales y un precio. De este lado se pide **lo que quien la
 * ofrece sabe de memoria** y se deja afuera lo que es trabajo de catálogo: el
 * `slug` lo deriva el admin del nombre, y `ofrecidaPor.libreriaSlug` —el enlace
 * a la ficha de una librería de la Guía— también, porque exige saber la
 * dirección web de **otra** ficha de este sitio y es la clase de campo que, mal
 * completado, produce un enlace a una página que no existe.
 *
 * ── Y sin foto, que es la decisión del 2026-09-15 ────────────────────────
 * La ficha que llega de afuera nace con la galería vacía, y eso lo **fuerza la
 * regla** (`d.origen == 'panel' || d.imagenes.size() == 0`), no este componente.
 * El argumento entero está en `SumarLibreria.tsx`.
 *
 * ── El precio se pide, y su fecha NO ─────────────────────────────────────
 * Es la mitad de DEC-12 que el formulario no puede escribir: `cargadoEn` lo pone
 * `formASuscripcion` con el reloj de quien guarda y lo **verifica la regla**
 * contra `request.time`. Un campo de fecha que se puede escribir es un campo de
 * fecha que se puede mentir, y ésta es justamente la que le dice a quien lee si
 * le puede creer al número.
 *
 * La otra mitad va en pantalla y no en un comentario: quien carga el precio
 * tiene que saber que se publica **con la fecha al lado**, porque es lo que va a
 * envejecer a la vista de todo el mundo.
 */
interface Props {
  /** Las opciones que ya existen, leídas en el build. Ver `SumarLibreria.tsx`. */
  tiposDeOferente: readonly OpcionOfrecida[];
  periodicidades: readonly OpcionOfrecida[];
  incluyeOfrecido: readonly OpcionOfrecida[];
  extrasOfrecidos: readonly OpcionOfrecida[];
  alcancesOfrecidos: readonly OpcionOfrecida[];
  perfilesEditoriales: readonly OpcionOfrecida[];
}

const TEXTO_VIA: Record<ViaContactoSuscripcion, string> = {
  mail: 'Mail',
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
};

const PLACEHOLDER_VIA: Record<ViaContactoSuscripcion, string> = {
  mail: 'vos@ejemplo.com',
  whatsapp: '+54 9 11 …',
  instagram: '@tucuenta',
};

export function SumarSuscripcion({
  tiposDeOferente,
  periodicidades,
  incluyeOfrecido,
  extrasOfrecidos,
  alcancesOfrecidos,
  perfilesEditoriales,
}: Props) {
  const alta = useAltaPublica<SuscripcionLiterariaForm>({
    /*
     * **El precio arranca vacío de los DOS lados**, y no con el
     * `porPeriodo: PERIODICIDAD_POR_DEFECTO` de `suscripcionVacia()`.
     *
     * El schema pide el monto y el período **o ninguno de los dos**, así que un
     * período con default y un monto vacío es un formulario que no se puede
     * guardar sin precio — y no tener precio es el caso normal de este lado:
     * quien llena esto puede no querer publicarlo, y no hay un admin que sepa
     * que además tiene que vaciar el desplegable. Es la misma clase de default
     * que en `SumarLugar` con `direccionPublica`: el del panel no sirve acá.
     *
     * (Del lado del panel esto es un bug y está anotado como **B-923**: la ayuda
     * dice «si no querés publicarlo, dejalo vacío» y con el período en `mensual`
     * el guardado falla.)
     */
    inicial: () => ({
      ...suscripcionVacia(),
      precio: { monto: '', porPeriodo: '' },
    }),
    schema: suscripcionPublicaFormSchema,
    enviar: async (f) => {
      const { enviarSuscripcion } = await import('@/lib/enviar-ficha');
      return enviarSuscripcion(f);
    },
    textoDeFallo:
      'No pudimos recibir la suscripción. Lo que escribiste sigue acá: probá de nuevo en un ' +
      'rato, o escribinos y la cargamos nosotros.',
  });

  const { form, set, errorDe } = alta;

  const setOfrecidaPor = (clave: keyof SuscripcionLiterariaForm['ofrecidaPor'], valor: string) =>
    set('ofrecidaPor', { ...form.ofrecidaPor, [clave]: valor });

  const setEnvio = <K extends keyof SuscripcionLiterariaForm['envio']>(
    clave: K,
    valor: SuscripcionLiterariaForm['envio'][K],
  ) => set('envio', { ...form.envio, [clave]: valor });

  if (alta.listo) {
    return (
      <Gracias titulo="Gracias, la recibimos">
        <p className="body-lectura mt-3 max-w-[65ch] text-super">
          La vamos a mirar y, si entra en la guía, la publicamos nosotros. Si falta algún dato te
          escribimos por donde nos dijiste.
        </p>
        <p className="body-lectura mt-3 max-w-[65ch] text-super">
          Las fotos las sumamos nosotros al publicarla, así que no hace falta que mandes nada más.
        </p>
      </Gracias>
    );
  }

  return (
    <form onSubmit={alta.onSubmit} className="mt-10 flex flex-col gap-6" noValidate>
      <CampoTrampa id="sus-pub-web" trampa={alta.trampa} />

      <Campo label="¿Cómo se llama?" htmlFor="sus-pub-nombre" requerido error={errorDe('nombre')}>
        <input
          id="sus-pub-nombre"
          className={claseInput}
          maxLength={TOPE_NOMBRE_SUSCRIPCION}
          value={form.nombre}
          onChange={(e) => set('nombre', e.target.value)}
        />
      </Campo>

      {/*
        **Obligatoria, al revés que en una librería.** Una suscripción es una
        promesa a futuro: sin esto la ficha no dice nada, y es además lo que va a
        la descripción que Google muestra.
      */}
      <Campo
        label="Qué es y para quién"
        htmlFor="sus-pub-descripcion"
        requerido
        error={errorDe('descripcion')}
      >
        <textarea
          id="sus-pub-descripcion"
          className={claseInput}
          rows={4}
          maxLength={TOPE_DESCRIPCION_SUSCRIPCION}
          value={form.descripcion}
          onChange={(e) => set('descripcion', e.target.value)}
        />
      </Campo>

      <fieldset className="min-w-0">
        <legend className={claseRotulo}>Quién la ofrece</legend>
        <div className="mt-3 grid gap-6 sm:grid-cols-2">
          <Campo
            label="Nombre"
            htmlFor="sus-pub-oferente"
            requerido
            error={errorDe('ofrecidaPor.nombre')}
          >
            <input
              id="sus-pub-oferente"
              className={claseInput}
              maxLength={TOPE_OFRECIDA_POR_SUSCRIPCION}
              value={form.ofrecidaPor.nombre}
              onChange={(e) => setOfrecidaPor('nombre', e.target.value)}
            />
          </Campo>

          <Campo
            label="Qué es"
            htmlFor="sus-pub-tipo-oferente"
            requerido
            error={errorDe('ofrecidaPor.tipo')}
          >
            <CampoDeTaxonomia
              id="sus-pub-tipo-oferente"
              opciones={tiposDeOferente}
              value={form.ofrecidaPor.tipo}
              onChange={(v) => setOfrecidaPor('tipo', v)}
              placeholder="Elegí qué es"
            />
          </Campo>

          <Campo
            label="Instagram"
            htmlFor="sus-pub-oferente-ig"
            error={errorDe('ofrecidaPor.instagram')}
          >
            <input
              id="sus-pub-oferente-ig"
              className={claseInput}
              placeholder="sin la arroba"
              value={form.ofrecidaPor.instagram}
              onChange={(e) => setOfrecidaPor('instagram', e.target.value)}
            />
          </Campo>
        </div>
      </fieldset>

      <div className="grid gap-6 sm:grid-cols-2">
        <Campo
          label="Cada cuánto llega"
          htmlFor="sus-pub-periodicidad"
          requerido
          error={errorDe('periodicidad')}
        >
          <CampoDeTaxonomia
            id="sus-pub-periodicidad"
            opciones={periodicidades}
            value={form.periodicidad}
            onChange={(v) => set('periodicidad', v)}
            placeholder="Elegí cada cuánto"
          />
        </Campo>

        <Campo
          label="Compromiso mínimo"
          htmlFor="sus-pub-compromiso"
          error={errorDe('compromisoMinimo')}
          ayuda="Como se lee: «Sin compromiso», «3 meses». Si no lo dice, dejalo vacío."
        >
          <input
            id="sus-pub-compromiso"
            className={claseInput}
            maxLength={TOPE_COMPROMISO_SUSCRIPCION}
            value={form.compromisoMinimo}
            onChange={(e) => set('compromisoMinimo', e.target.value)}
          />
        </Campo>
      </div>

      <Campo label="Qué incluye" htmlFor="sus-pub-incluye" comoGrupo error={errorDe('incluye')}>
        <CampoDeEtiquetas
          id="sus-pub-incluye"
          opciones={incluyeOfrecido}
          value={form.incluye}
          onChange={(v) => set('incluye', v)}
        />
      </Campo>

      <Campo
        label="Otra cosa que incluya"
        htmlFor="sus-pub-incluye-otro"
        error={errorDe('incluyeOtro')}
        ayuda="Lo que no esté en la lista de arriba, con tus palabras."
      >
        <input
          id="sus-pub-incluye-otro"
          className={claseInput}
          maxLength={TOPE_OTRO_SUSCRIPCION}
          value={form.incluyeOtro}
          onChange={(e) => set('incluyeOtro', e.target.value)}
        />
      </Campo>

      <fieldset className="min-w-0">
        <legend className={claseRotulo}>Si manda libros</legend>
        <label className="mt-3 flex min-h-touch items-center gap-2">
          <input
            type="checkbox"
            checked={form.envio.manda}
            onChange={(e) => setEnvio('manda', e.target.checked)}
          />
          <span className="body-md text-super">Manda libros a casa</span>
        </label>

        {/*
          Los campos del envío aparecen solo con el flag prendido, y eso no es
          cosmética: `formASuscripcion` **descarta** la temática y el perfil
          cuando `manda` está en `false`. Un dato que se completa y después se
          tira es la forma de que alguien crea que cargó algo que no se guardó.
        */}
        {form.envio.manda && (
          <div className="mt-4 grid gap-6 sm:grid-cols-2">
            <Campo
              label="Cuántos por entrega"
              htmlFor="sus-pub-cuantos"
              error={errorDe('envio.cuantos')}
            >
              <input
                id="sus-pub-cuantos"
                className={claseInput}
                placeholder="1, 2, «uno o dos»"
                value={form.envio.cuantos}
                onChange={(e) => setEnvio('cuantos', e.target.value)}
              />
            </Campo>

            <Campo label="Temática" htmlFor="sus-pub-tematica" error={errorDe('envio.tematica')}>
              <input
                id="sus-pub-tematica"
                className={claseInput}
                maxLength={TOPE_TEMATICA_SUSCRIPCION}
                placeholder="Narrativa latinoamericana, poesía…"
                value={form.envio.tematica}
                onChange={(e) => setEnvio('tematica', e.target.value)}
              />
            </Campo>

            <Campo
              label="Qué editoriales"
              htmlFor="sus-pub-editoriales"
              error={errorDe('envio.editoriales')}
            >
              <CampoDeTaxonomia
                id="sus-pub-editoriales"
                opciones={perfilesEditoriales}
                value={form.envio.editoriales}
                onChange={(v) => setEnvio('editoriales', v)}
                placeholder="Elegí una"
              />
            </Campo>

            <Campo
              label="¿Se sabe qué libro llega?"
              htmlFor="sus-pub-sorpresa"
              error={errorDe('envio.sorpresa')}
            >
              <input
                id="sus-pub-sorpresa"
                className={claseInput}
                placeholder="«Es sorpresa», «lo elegís vos»"
                value={form.envio.sorpresa}
                onChange={(e) => setEnvio('sorpresa', e.target.value)}
              />
            </Campo>
          </div>
        )}
      </fieldset>

      <Campo label="Extras" htmlFor="sus-pub-extras" comoGrupo error={errorDe('extras')}>
        <CampoDeEtiquetas
          id="sus-pub-extras"
          opciones={extrasOfrecidos}
          value={form.extras}
          onChange={(v) => set('extras', v)}
        />
      </Campo>

      <Campo label="Otros extras" htmlFor="sus-pub-extras-otro" error={errorDe('extrasOtro')}>
        <input
          id="sus-pub-extras-otro"
          className={claseInput}
          maxLength={TOPE_OTRO_SUSCRIPCION}
          value={form.extrasOtro}
          onChange={(e) => set('extrasOtro', e.target.value)}
        />
      </Campo>

      <Campo label="A dónde llega" htmlFor="sus-pub-alcance" comoGrupo error={errorDe('alcance')}>
        <CampoDeEtiquetas
          id="sus-pub-alcance"
          opciones={alcancesOfrecidos}
          value={form.alcance}
          onChange={(v) => set('alcance', v)}
        />
      </Campo>

      <fieldset className="min-w-0">
        <legend className={claseRotulo}>Cuánto sale</legend>
        {/*
          **La mitad de DEC-12 que va en pantalla.** El precio se publica **con
          la fecha de carga al lado** («$18.000 por mes · cargado el 24 de
          septiembre de 2026») y queda fuera de todo filtro y orden. Decirlo acá
          es lo que hace que quien lo carga sepa qué está prometiendo; la fecha la
          pone el servidor y no se puede elegir.
        */}
        <p className="body-sm mt-1 max-w-[65ch] text-super">
          Se publica <strong>con la fecha en que lo cargaste al lado</strong>, para que quien lo
          lea sepa de cuándo es. Si preferís no ponerlo, dejalo vacío.
        </p>
        <div className="mt-3 grid gap-6 sm:grid-cols-2">
          <Campo label="Precio en pesos" htmlFor="sus-pub-precio" error={errorDe('precio.monto')}>
            <input
              id="sus-pub-precio"
              className={claseInput}
              inputMode="numeric"
              placeholder="18000"
              value={form.precio.monto}
              onChange={(e) => set('precio', { ...form.precio, monto: e.target.value })}
            />
          </Campo>

          <Campo
            label="Por qué período"
            htmlFor="sus-pub-precio-periodo"
            error={errorDe('precio.porPeriodo')}
          >
            <CampoDeTaxonomia
              id="sus-pub-precio-periodo"
              opciones={periodicidades}
              value={form.precio.porPeriodo}
              onChange={(v) => set('precio', { ...form.precio, porPeriodo: v })}
              placeholder="Elegí el período"
            />
          </Campo>
        </div>
      </fieldset>

      <fieldset className="min-w-0">
        <legend className={claseRotulo}>Por dónde se suscribe la gente</legend>
        <p className="body-sm mt-1 max-w-[65ch] text-super">
          Lo que pongas acá <strong>se publica en la ficha</strong>. Con uno alcanza.
        </p>
        <div className="mt-3 grid gap-6 sm:grid-cols-2">
          <Campo
            label="Link para suscribirse"
            htmlFor="sus-pub-link"
            error={errorDe('linkDeSuscripcion')}
            ayuda="La página donde se contrata, si la hay."
          >
            <input
              id="sus-pub-link"
              className={claseInput}
              maxLength={TOPE_LINK_SUSCRIPCION}
              placeholder="https://…"
              value={form.linkDeSuscripcion}
              onChange={(e) => set('linkDeSuscripcion', e.target.value)}
            />
          </Campo>

          <Campo label="Instagram" htmlFor="sus-pub-instagram" error={errorDe('instagram')}>
            <input
              id="sus-pub-instagram"
              className={claseInput}
              placeholder="sin la arroba"
              value={form.instagram}
              onChange={(e) => set('instagram', e.target.value)}
            />
          </Campo>

          <Campo
            label="WhatsApp"
            htmlFor="sus-pub-whatsapp"
            error={errorDe('whatsapp')}
            ayuda="Este número se publica en el sitio."
          >
            <input
              id="sus-pub-whatsapp"
              className={claseInput}
              inputMode="tel"
              value={form.whatsapp}
              onChange={(e) => set('whatsapp', e.target.value)}
            />
          </Campo>

          <Campo label="Mail" htmlFor="sus-pub-mail" error={errorDe('mail')}>
            <input
              id="sus-pub-mail"
              className={claseInput}
              type="email"
              maxLength={TOPE_MAIL_SUSCRIPCION}
              value={form.mail}
              onChange={(e) => set('mail', e.target.value)}
            />
          </Campo>
        </div>
      </fieldset>

      <fieldset className="min-w-0">
        <legend className={claseRotulo}>Cómo te escribimos</legend>
        <p className="body-sm mt-1 max-w-[65ch] text-super">
          Esto <strong>no se publica</strong>. Es solo por si hay que preguntarte algo antes de
          sumarla, y se borra si al final la ficha no entra.
        </p>
        <div className="mt-3 grid gap-6 sm:grid-cols-2">
          <Campo label="Por dónde" htmlFor="sus-pub-contacto-via">
            <select
              id="sus-pub-contacto-via"
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
            label="Tu contacto"
            htmlFor="sus-pub-contacto-valor"
            requerido
            error={errorDe('contactoDeQuienCargo.valor')}
          >
            <input
              id="sus-pub-contacto-valor"
              className={claseInput}
              maxLength={TOPE_CONTACTO_SUSCRIPCION}
              placeholder={PLACEHOLDER_VIA[form.contactoDeQuienCargo.via]}
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

      {alta.fallo && (
        <p className="body-md text-acento" role="alert">
          {alta.fallo}
        </p>
      )}

      <div>
        <button type="submit" className={claseBotonPrimario} disabled={alta.enviando}>
          {alta.enviando ? 'Mandando…' : 'Mandar la suscripción'}
        </button>
      </div>
    </form>
  );
}
