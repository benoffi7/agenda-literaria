import { Campo, claseInput } from '@/components/campos/Campo';
import { claseBotonPrimario, claseRotulo } from '@/components/sitio/estilos';
import { CampoTrampa, Gracias, useAltaPublica } from '@/components/publico/altaPublica';
import { CampoDeEtiquetas, CampoDeTaxonomia } from '@/components/publico/camposDeTaxonomia';
import type { OpcionOfrecida } from '@/components/publico/camposDeTaxonomia';
import { lugarPublicoFormSchema, lugarVacio } from '@/lib/lugar-schema';
import {
  TOPE_CAPACIDAD_NOTAS_LUGAR,
  TOPE_CONDICION_NOTAS_LUGAR,
  TOPE_CONTACTO_LUGAR,
  TOPE_DESCRIPCION_LUGAR,
  TOPE_DIRECCION_LUGAR,
  TOPE_MAIL_LUGAR,
  TOPE_NOMBRE_LUGAR,
  TOPE_OTRO_LUGAR,
  TOPE_WEB_LUGAR,
  UNIDADES_DE_PRECIO_LUGAR,
  VIAS_CONTACTO_LUGAR,
} from '@/types/lugar';
import type { LugarForm, ViaContactoLugar } from '@/types/lugar';

/**
 * **El formulario público de un lugar para eventos** — `/guia/lugares/sumar`,
 * criterio 11 del PRD 4 y B-915.
 *
 * ── ⚠️ La diferencia que este formulario tiene y los otros dos no ─────────
 * **La dirección de una casa** (§ 6 del PRD). De los tres directorios, éste es
 * el único que puede terminar publicando dónde vive una persona, y por eso acá
 * `direccionPublica` **no es una casilla**: arranca apagada y no se muestra.
 *
 * Son tres capas y ninguna reemplaza a otra:
 *
 *  1. **Este componente** arranca el formulario con `direccionPublica: false` —y
 *     no con el `true` de `lugarVacio()`, que es el default del panel—. No es
 *     cosmética: el schema exige la dirección **si se va a publicar**, así que
 *     con el default del panel este formulario pediría el dato más sensible del
 *     proyecto como obligatorio.
 *  2. **`formALugar`** lo fuerza en `false` cuando el origen es el formulario
 *     público, mire lo que mire este componente.
 *  3. **`firestore.rules`**, que es la única que un `curl` no se saltea:
 *     `d.origen != 'formulario-publico' || d.direccionPublica == false`.
 *
 * Y la regla **no mira el `tipo`**, a propósito: `tipo` sale de
 * `/opciones/tipo-lugar`, que acepta «Otro», así que `mi-living` o
 * `casa-de-familia` pasarían cualquier lista negra. El tipo sigue decidiendo el
 * default **del panel** (`TIPOS_SIN_DIRECCION_PUBLICA`), que es donde hay alguien
 * mirando.
 *
 * Prender el flag es una acción de admin, y es la única forma legítima: alguien
 * pidió permiso a quien vive ahí. Por eso el contacto interno importa más acá que
 * en los otros dos —es por dónde se pide ese permiso— y por eso la pantalla dice,
 * con esas palabras, que la dirección no se publica.
 *
 * ── Y sin foto, que es la decisión del 2026-09-15 ────────────────────────
 * La ficha que llega de afuera nace con la galería vacía, forzado por la regla.
 * El argumento entero está en `SumarLibreria.tsx`.
 */
interface Props {
  /** Las opciones que ya existen, leídas en el build. Ver `SumarLibreria.tsx`. */
  tiposDeLugar: readonly OpcionOfrecida[];
  barriosOfrecidos: readonly OpcionOfrecida[];
  incluyeOfrecido: readonly OpcionOfrecida[];
  condicionesDeUso: readonly OpcionOfrecida[];
}

const TEXTO_VIA: Record<ViaContactoLugar, string> = {
  mail: 'Mail',
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
};

const PLACEHOLDER_VIA: Record<ViaContactoLugar, string> = {
  mail: 'vos@ejemplo.com',
  whatsapp: '+54 9 11 …',
  instagram: '@tucuenta',
};

const TEXTO_UNIDAD: Record<(typeof UNIDADES_DE_PRECIO_LUGAR)[number], string> = {
  hora: 'Por hora',
  jornada: 'Por jornada',
  evento: 'Por evento',
  persona: 'Por persona',
};

export function SumarLugar({
  tiposDeLugar,
  barriosOfrecidos,
  incluyeOfrecido,
  condicionesDeUso,
}: Props) {
  const alta = useAltaPublica<LugarForm>({
    /*
     * **`direccionPublica: false` y no el default de `lugarVacio()`** — ver el
     * docblock de arriba, capa 1. Con el `true` del panel, el `superRefine`
     * exigiría la dirección para poder guardar, o sea que el formulario público
     * pediría como obligatorio el dato que nunca va a publicar.
     */
    inicial: () => ({
      ...lugarVacio(),
      direccionPublica: false,
      /*
       * **Y el precio arranca vacío de los dos lados**, por lo mismo que en
       * `SumarSuscripcion`: el schema pide el monto y la unidad **o ninguno de
       * los dos**, y `lugarVacio()` trae `porUnidad: 'hora'`. Acá el caso normal
       * es no cobrar —el § 5 del PRD nace de «no sé si todos cobran»— así que un
       * default que obliga a poner un número sería el peor default posible.
       */
      precio: { monto: '', porUnidad: '' },
    }),
    schema: lugarPublicoFormSchema,
    enviar: async (f) => {
      const { enviarLugar } = await import('@/lib/enviar-ficha');
      return enviarLugar(f);
    },
    textoDeFallo:
      'No pudimos recibir el lugar. Lo que escribiste sigue acá: probá de nuevo en un rato, o ' +
      'escribinos y lo cargamos nosotros.',
  });

  const { form, set, errorDe } = alta;

  if (alta.listo) {
    return (
      <Gracias titulo="Gracias, lo recibimos">
        <p className="body-lectura mt-3 max-w-[65ch] text-super">
          Lo vamos a mirar y, si entra en la guía, lo publicamos nosotros. Si falta algún dato te
          escribimos por donde nos dijiste.
        </p>
        <p className="body-lectura mt-3 max-w-[65ch] text-super">
          La dirección exacta no se publica. Si querés que sí aparezca, decínoslo cuando te
          escribamos.
        </p>
      </Gracias>
    );
  }

  return (
    <form onSubmit={alta.onSubmit} className="mt-10 flex flex-col gap-6" noValidate>
      <CampoTrampa id="lug-pub-web" trampa={alta.trampa} />

      <Campo label="¿Cómo se llama?" htmlFor="lug-pub-nombre" requerido error={errorDe('nombre')}>
        <input
          id="lug-pub-nombre"
          className={claseInput}
          maxLength={TOPE_NOMBRE_LUGAR}
          value={form.nombre}
          onChange={(e) => set('nombre', e.target.value)}
          placeholder="El Salón del Fondo"
        />
      </Campo>

      <Campo
        label="Cómo es el lugar"
        htmlFor="lug-pub-descripcion"
        error={errorDe('descripcion')}
        ayuda="Si tiene patio, si hay que subir escaleras, qué se puede hacer ahí."
      >
        <textarea
          id="lug-pub-descripcion"
          className={claseInput}
          rows={4}
          maxLength={TOPE_DESCRIPCION_LUGAR}
          value={form.descripcion}
          onChange={(e) => set('descripcion', e.target.value)}
        />
      </Campo>

      <div className="grid gap-6 sm:grid-cols-2">
        <Campo label="Qué es" htmlFor="lug-pub-tipo" requerido error={errorDe('tipo')}>
          <CampoDeTaxonomia
            id="lug-pub-tipo"
            opciones={tiposDeLugar}
            value={form.tipo}
            onChange={(v) => set('tipo', v)}
            placeholder="Elegí qué es"
          />
        </Campo>

        <Campo
          label="Barrio"
          htmlFor="lug-pub-barrio"
          requerido
          error={errorDe('barrio')}
          ayuda={
            barriosOfrecidos.length > 0
              ? 'Si no está en la lista, elegí «Otro…» y escribilo.'
              : undefined
          }
        >
          <CampoDeTaxonomia
            id="lug-pub-barrio"
            opciones={barriosOfrecidos}
            value={form.barrio}
            onChange={(v) => set('barrio', v)}
            placeholder="Elegí el barrio"
          />
        </Campo>

        <Campo label="Ciudad" htmlFor="lug-pub-ciudad" error={errorDe('ciudad')}>
          <input
            id="lug-pub-ciudad"
            className={claseInput}
            value={form.ciudad}
            onChange={(e) => set('ciudad', e.target.value)}
          />
        </Campo>
      </div>

      {/*
        ⚠️ **La dirección, con el cartel que este formulario existe para tener.**
        Es la única pantalla del proyecto donde alguien puede tipear el domicilio
        de una casa, así que lo que dice arriba del campo no es una nota de estilo:
        es lo que hace que el dato se cargue sabiendo qué va a pasar con él.

        Y es **opcional**, al revés que en una librería (§ 6 del PRD): un lugar que
        es la casa de alguien no tiene por qué darla, y con el barrio alcanza para
        que quien busca decida si le sirve.
      */}
      <fieldset className="min-w-0">
        <legend className={claseRotulo}>Dónde queda</legend>
        <p className="body-sm mt-1 max-w-[65ch] text-super">
          <strong>La dirección exacta no se publica.</strong> La ficha muestra el barrio, y quien
          quiera ir la pide. Nos sirve para saber de qué lugar estamos hablando; si querés que sí
          aparezca, escribinos y lo charlamos.
        </p>
        <div className="mt-3">
          <Campo label="Dirección" htmlFor="lug-pub-direccion" error={errorDe('direccion')}>
            <input
              id="lug-pub-direccion"
              className={claseInput}
              maxLength={TOPE_DIRECCION_LUGAR}
              value={form.direccion}
              onChange={(e) => set('direccion', e.target.value)}
              placeholder="Honduras 4321"
            />
          </Campo>
        </div>
      </fieldset>

      <div className="grid gap-6 sm:grid-cols-2">
        <Campo
          label="Cuánta gente entra"
          htmlFor="lug-pub-capacidad"
          error={errorDe('capacidad')}
          ayuda="Un número, aunque sea aproximado."
        >
          <input
            id="lug-pub-capacidad"
            className={claseInput}
            inputMode="numeric"
            value={form.capacidad}
            onChange={(e) => set('capacidad', e.target.value)}
          />
        </Campo>

        <Campo
          label="Aclaraciones sobre la capacidad"
          htmlFor="lug-pub-capacidad-notas"
          error={errorDe('capacidadNotas')}
        >
          <input
            id="lug-pub-capacidad-notas"
            className={claseInput}
            maxLength={TOPE_CAPACIDAD_NOTAS_LUGAR}
            placeholder="Sentados 20, de pie 35"
            value={form.capacidadNotas}
            onChange={(e) => set('capacidadNotas', e.target.value)}
          />
        </Campo>
      </div>

      <Campo label="Qué tiene" htmlFor="lug-pub-incluye" comoGrupo error={errorDe('incluye')}>
        <CampoDeEtiquetas
          id="lug-pub-incluye"
          opciones={incluyeOfrecido}
          value={form.incluye}
          onChange={(v) => set('incluye', v)}
        />
      </Campo>

      <Campo
        label="Otra cosa que tenga"
        htmlFor="lug-pub-incluye-otro"
        error={errorDe('incluyeOtro')}
        ayuda="Lo que no esté en la lista de arriba, con tus palabras."
      >
        <input
          id="lug-pub-incluye-otro"
          className={claseInput}
          maxLength={TOPE_OTRO_LUGAR}
          value={form.incluyeOtro}
          onChange={(e) => set('incluyeOtro', e.target.value)}
        />
      </Campo>

      <fieldset className="min-w-0">
        <legend className={claseRotulo}>Cómo se usa</legend>
        {/*
          § 5 del PRD, y la pregunta del dueño que lo originó: «no sé si todos
          cobran, o le dicen que tienen que consumir». Por eso la condición es un
          vocabulario y el precio es opcional: hay lugares que prestan, lugares
          que piden consumición y lugares que alquilan, y los tres tienen que
          poder cargarse sin inventar un número.
        */}
        <div className="mt-3 grid gap-6 sm:grid-cols-2">
          <Campo
            label="Condición"
            htmlFor="lug-pub-condicion"
            requerido
            error={errorDe('condicion')}
          >
            <CampoDeTaxonomia
              id="lug-pub-condicion"
              opciones={condicionesDeUso}
              value={form.condicion}
              onChange={(v) => set('condicion', v)}
              placeholder="Elegí cómo se usa"
            />
          </Campo>

          <Campo
            label="Aclaraciones"
            htmlFor="lug-pub-condicion-notas"
            error={errorDe('condicionNotas')}
          >
            <input
              id="lug-pub-condicion-notas"
              className={claseInput}
              maxLength={TOPE_CONDICION_NOTAS_LUGAR}
              placeholder="Mínimo de consumición por persona"
              value={form.condicionNotas}
              onChange={(e) => set('condicionNotas', e.target.value)}
            />
          </Campo>
        </div>

        {/*
          El precio se publica **con la fecha de carga al lado** (B-837, el mismo
          patrón que el de una suscripción) y queda fuera de todo filtro. Decirlo
          acá es lo que hace que quien lo carga sepa qué está prometiendo.
        */}
        <p className="body-sm mt-4 max-w-[65ch] text-super">
          Si cobran, se publica <strong>con la fecha en que lo cargaste al lado</strong>. Si no
          cobran o preferís no ponerlo, dejalo vacío.
        </p>
        <div className="mt-3 grid gap-6 sm:grid-cols-2">
          <Campo label="Precio en pesos" htmlFor="lug-pub-precio" error={errorDe('precio.monto')}>
            <input
              id="lug-pub-precio"
              className={claseInput}
              inputMode="numeric"
              placeholder="25000"
              value={form.precio.monto}
              onChange={(e) => set('precio', { ...form.precio, monto: e.target.value })}
            />
          </Campo>

          <Campo
            label="Por qué unidad"
            htmlFor="lug-pub-precio-unidad"
            error={errorDe('precio.porUnidad')}
          >
            <select
              id="lug-pub-precio-unidad"
              className={claseInput}
              value={form.precio.porUnidad}
              onChange={(e) => set('precio', { ...form.precio, porUnidad: e.target.value })}
            >
              {/*
                La opción vacía existe porque **no poner precio es una respuesta**
                y el schema la pide explícita: sin ella, la unidad quedaría
                siempre elegida y el formulario exigiría un monto.
              */}
              <option value="">Sin precio</option>
              {UNIDADES_DE_PRECIO_LUGAR.map((u) => (
                <option key={u} value={u}>
                  {TEXTO_UNIDAD[u]}
                </option>
              ))}
            </select>
          </Campo>
        </div>
      </fieldset>

      <fieldset className="min-w-0">
        <legend className={claseRotulo}>Por dónde lo contactan</legend>
        <p className="body-sm mt-1 max-w-[65ch] text-super">
          Lo que pongas acá <strong>se publica en la ficha</strong>. Con uno alcanza.
        </p>
        <div className="mt-3 grid gap-6 sm:grid-cols-2">
          <Campo label="Instagram" htmlFor="lug-pub-instagram" error={errorDe('instagram')}>
            <input
              id="lug-pub-instagram"
              className={claseInput}
              placeholder="sin la arroba"
              value={form.instagram}
              onChange={(e) => set('instagram', e.target.value)}
            />
          </Campo>

          <Campo
            label="WhatsApp"
            htmlFor="lug-pub-whatsapp"
            error={errorDe('whatsapp')}
            ayuda="Este número se publica en el sitio."
          >
            <input
              id="lug-pub-whatsapp"
              className={claseInput}
              inputMode="tel"
              value={form.whatsapp}
              onChange={(e) => set('whatsapp', e.target.value)}
            />
          </Campo>

          <Campo label="Sitio web" htmlFor="lug-pub-web-sitio" error={errorDe('web')}>
            <input
              id="lug-pub-web-sitio"
              className={claseInput}
              maxLength={TOPE_WEB_LUGAR}
              placeholder="https://…"
              value={form.web}
              onChange={(e) => set('web', e.target.value)}
            />
          </Campo>

          <Campo label="Mail" htmlFor="lug-pub-mail" error={errorDe('mail')}>
            <input
              id="lug-pub-mail"
              className={claseInput}
              type="email"
              maxLength={TOPE_MAIL_LUGAR}
              value={form.mail}
              onChange={(e) => set('mail', e.target.value)}
            />
          </Campo>
        </div>
      </fieldset>

      {/*
        El contacto interno, y acá pesa más que en los otros dos: es por dónde se
        pide el permiso del § 6 —«que una sede figure en una actividad no
        autoriza a publicarla como lugar que se alquila»—.
      */}
      <fieldset className="min-w-0">
        <legend className={claseRotulo}>Cómo te escribimos</legend>
        <p className="body-sm mt-1 max-w-[65ch] text-super">
          Esto <strong>no se publica</strong>. Es por si hay que preguntarte algo antes de sumarlo
          —incluida la dirección—, y se borra si al final la ficha no entra.
        </p>
        <div className="mt-3 grid gap-6 sm:grid-cols-2">
          <Campo label="Por dónde" htmlFor="lug-pub-contacto-via">
            <select
              id="lug-pub-contacto-via"
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
            label="Tu contacto"
            htmlFor="lug-pub-contacto-valor"
            requerido
            error={errorDe('contactoDeQuienCargo.valor')}
          >
            <input
              id="lug-pub-contacto-valor"
              className={claseInput}
              maxLength={TOPE_CONTACTO_LUGAR}
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
          {alta.enviando ? 'Mandando…' : 'Mandar el lugar'}
        </button>
      </div>
    </form>
  );
}
