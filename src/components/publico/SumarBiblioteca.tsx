import { Campo, claseInput } from '@/components/campos/Campo';
import { conProvincia, subdivisionDe } from '@/lib/geografia.mjs';
import { claseBotonPrimario, claseRotulo } from '@/components/sitio/estilos';
import { CampoTrampa, Gracias, useAltaPublica } from '@/components/publico/altaPublica';
import { CampoDeTaxonomia } from '@/components/publico/camposDeTaxonomia';
import type { OpcionOfrecida } from '@/components/publico/camposDeTaxonomia';
import { bibliotecaPublicaFormSchema, bibliotecaVacia } from '@/lib/biblioteca-schema';
import {
  TOPE_CATALOGO_BIBLIOTECA,
  TOPE_CONTACTO_BIBLIOTECA,
  TOPE_COSTO_DE_ASOCIARSE_BIBLIOTECA,
  TOPE_DESCRIPCION_BIBLIOTECA,
  TOPE_DIRECCION_BIBLIOTECA,
  TOPE_HORARIO_DE_SALA_BIBLIOTECA,
  TOPE_HORARIOS_BIBLIOTECA,
  TOPE_MAIL_BIBLIOTECA,
  TOPE_NOMBRE_BIBLIOTECA,
  TOPE_WEB_BIBLIOTECA,
  VIAS_CONTACTO_BIBLIOTECA,
} from '@/types/biblioteca';
import type { BibliotecaForm, ViaContactoBiblioteca } from '@/types/biblioteca';

/**
 * **El formulario público de una biblioteca** — `/guia/bibliotecas/sumar`, B-960.
 *
 * Es «el mismo formulario con dos configuraciones» y ésta es la de afuera: los
 * campos de la ficha más el contacto interno, **sin** `geo`, **sin** el `slug`
 * —lo deriva el admin del nombre— y **sin** la gestión. El tipo es uno solo
 * (`BibliotecaForm`) y los schemas son dos con una regla de diferencia.
 *
 * ── Y sin foto ───────────────────────────────────────────────────────────
 * La ficha que llega de afuera nace con la galería vacía, y eso lo **fuerza la
 * regla** (`d.origen == 'panel' || d.imagenes.size() == 0`), no este componente.
 * Es lo que hace que abrir el `create` anónimo no arrastre `storage.rules`, la
 * callable de B-896 generalizada, el objeto huérfano ni un `imagenValida()` por
 * entidad. Las fotos las pone el admin al publicar.
 *
 * ── El costo de asociarse, y la línea que hay que decir ──────────────────
 * Se pide **solo si marcaron que hace falta**, porque un costo colgado de un «no
 * hace falta» lo rechazan el schema y la regla. Y la ayuda dice que **se publica
 * con la fecha de hoy al lado**: quien carga tiene derecho a saber que ese
 * número va a quedar fechado, porque es lo que va a hacer que dentro de seis
 * meses alguien decida si le cree.
 *
 * ── Lo que este componente NO decide ─────────────────────────────────────
 * Ni la validación (`bibliotecaPublicaFormSchema`), ni el armado del documento
 * (`formABiblioteca`), ni el ciclo de vida (`lib/directorios.ts`), ni las dos
 * capas anti-abuso del navegador (`altaPublica.tsx`). Acá hay campos y nada más.
 *
 * ── Por qué no importa nada de `admin/` ──────────────────────────────────
 * Porque arrastraría la medición del panel —que no tiene portón de
 * consentimiento (D-250)— a una página pública, y con `TaxonomiaSelect` además
 * Firebase entero al árbol estático. `campos/Campo` sí se puede: es genérico
 * desde B-827. Lo hace cumplir `tests/panel-fuera-del-sitio.test.ts`.
 */
interface Props {
  /**
   * Los vocabularios que **ya existen**, leídos en el build y pasados como prop.
   *
   * No se leen en el navegador a propósito: `/opciones/*` es de lectura pública,
   * pero pedirlos en runtime obligaría a inicializar Firestore —y con él App
   * Check— al **abrir** la página, que es justo lo que este formulario evita.
   */
  barriosOfrecidos: readonly OpcionOfrecida[];
  provinciasOfrecidas: readonly OpcionOfrecida[];
  ciudadesOfrecidas: readonly OpcionOfrecida[];
  /** Los tipos de biblioteca. El vocabulario propio de esta entidad. */
  tiposOfrecidos: readonly OpcionOfrecida[];
}

const TEXTO_VIA: Record<ViaContactoBiblioteca, string> = {
  mail: 'Mail',
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
};

const PLACEHOLDER_VIA: Record<ViaContactoBiblioteca, string> = {
  mail: 'vos@ejemplo.com',
  whatsapp: '+54 9 11 …',
  instagram: '@tucuenta',
};

export function SumarBiblioteca({
  barriosOfrecidos,
  provinciasOfrecidas,
  ciudadesOfrecidas,
  tiposOfrecidos,
}: Props) {
  const alta = useAltaPublica<BibliotecaForm>({
    inicial: bibliotecaVacia,
    schema: bibliotecaPublicaFormSchema,
    enviar: async (f) => {
      // `import()` y no un import de arriba: es lo que hace que App Check entre
      // en el submit y no al abrir la página. Ver `lib/enviar-ficha.ts`.
      const { enviarBiblioteca } = await import('@/lib/enviar-ficha');
      return enviarBiblioteca(f);
    },
    textoDeFallo:
      'No pudimos recibir la biblioteca. Lo que escribiste sigue acá: probá de nuevo en un ' +
      'rato, o escribinos y la cargamos nosotros.',
  });

  const { form, set, errorDe } = alta;

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
      <CampoTrampa id="bib-pub-web" trampa={alta.trampa} />

      <Campo label="¿Cómo se llama?" htmlFor="bib-pub-nombre" requerido error={errorDe('nombre')}>
        <input
          id="bib-pub-nombre"
          className={claseInput}
          maxLength={TOPE_NOMBRE_BIBLIOTECA}
          value={form.nombre}
          onChange={(e) => set('nombre', e.target.value)}
          placeholder="Biblioteca Popular Alberdi"
        />
      </Campo>

      <Campo
        label="Qué tiene, qué la hace distinta"
        htmlFor="bib-pub-descripcion"
        error={errorDe('descripcion')}
        ayuda="Si tiene hemeroteca, sala para estudiar, actividades para chicos, fondo especializado."
      >
        <textarea
          id="bib-pub-descripcion"
          className={claseInput}
          rows={4}
          maxLength={TOPE_DESCRIPCION_BIBLIOTECA}
          value={form.descripcion}
          onChange={(e) => set('descripcion', e.target.value)}
        />
      </Campo>

      <div className="grid gap-6 sm:grid-cols-2">
        <Campo label="Qué biblioteca es" htmlFor="bib-pub-tipo" error={errorDe('tipo')}>
          <CampoDeTaxonomia
            id="bib-pub-tipo"
            opciones={tiposOfrecidos}
            value={form.tipo}
            onChange={(v) => set('tipo', v)}
            placeholder="Popular, municipal, universitaria…"
          />
        </Campo>

        <Campo label="Dirección" htmlFor="bib-pub-direccion" requerido error={errorDe('direccion')}>
          <input
            id="bib-pub-direccion"
            className={claseInput}
            maxLength={TOPE_DIRECCION_BIBLIOTECA}
            value={form.direccion}
            onChange={(e) => set('direccion', e.target.value)}
            placeholder="Talcahuano 1261"
          />
        </Campo>

        {/*
          Los dos horarios. Son dos campos porque en una biblioteca no son lo
          mismo: el mostrador y la sala de lectura pueden abrir distinto.
        */}
        <Campo label="Horario de atención" htmlFor="bib-pub-horarios" error={errorDe('horarios')}>
          <input
            id="bib-pub-horarios"
            className={claseInput}
            maxLength={TOPE_HORARIOS_BIBLIOTECA}
            value={form.horarios}
            onChange={(e) => set('horarios', e.target.value)}
            placeholder="Lun a vie de 9 a 20, sábados de 10 a 14"
          />
        </Campo>

        <Campo
          label="Horario de sala de lectura"
          htmlFor="bib-pub-horario-sala"
          error={errorDe('horarioDeSala')}
          ayuda="Si no tiene sala, dejalo vacío."
        >
          <input
            id="bib-pub-horario-sala"
            className={claseInput}
            maxLength={TOPE_HORARIO_DE_SALA_BIBLIOTECA}
            value={form.horarioDeSala}
            onChange={(e) => set('horarioDeSala', e.target.value)}
            placeholder="Lun a vie de 14 a 19"
          />
        </Campo>

        {/*
          La misma cascada del panel y del riel, con la misma `subdivisionDe`.
          Acá «Otro…» **no da de alta** la etiqueta —un anónimo no escribe en
          `/opciones/*`, que es un documento compartido por todo el sitio— pero
          existe igual: la lista puede no tener la ciudad de quien carga, y un
          desplegable cerrado dejaría el formulario inguardable.
        */}
        <Campo label="Provincia" htmlFor="bib-pub-provincia" requerido error={errorDe('provincia')}>
          <CampoDeTaxonomia
            id="bib-pub-provincia"
            opciones={provinciasOfrecidas}
            value={form.provincia}
            onChange={(v) => {
              const geo = conProvincia(
                { provincia: form.provincia, barrio: form.barrio, ciudad: form.ciudad },
                v,
              );
              set('provincia', geo.provincia);
              set('barrio', geo.barrio);
              set('ciudad', geo.ciudad);
            }}
            placeholder="Elegí la provincia"
          />
        </Campo>

        {subdivisionDe(form.provincia) === 'barrio' ? (
          <Campo
            label="Barrio"
            htmlFor="bib-pub-barrio"
            error={errorDe('barrio')}
            ayuda={
              barriosOfrecidos.length > 0
                ? 'Si no está en la lista, elegí «Otro…» y escribilo.'
                : undefined
            }
          >
            <CampoDeTaxonomia
              id="bib-pub-barrio"
              opciones={barriosOfrecidos}
              value={form.barrio}
              onChange={(v) => set('barrio', v)}
              placeholder="Elegí el barrio"
            />
          </Campo>
        ) : (
          <Campo
            label="Ciudad"
            htmlFor="bib-pub-ciudad"
            error={errorDe('ciudad')}
            ayuda={
              form.provincia
                ? 'Si no está en la lista, elegí «Otro…» y escribila.'
                : 'Elegí primero la provincia.'
            }
          >
            <CampoDeTaxonomia
              id="bib-pub-ciudad"
              opciones={ciudadesOfrecidas}
              value={form.ciudad}
              onChange={(v) => set('ciudad', v)}
              placeholder="Elegí la ciudad"
            />
          </Campo>
        )}
      </div>

      {/*
        **Para llevarse libros** — lo propio de esta ficha.

        El costo aparece solo si marcaron que hace falta asociarse: un costo
        colgado de un «no hace falta» es una contradicción que el schema y la
        regla rechazan, y ofrecerlo igual sería un camino que el formulario abre
        y la validación corta.
      */}
      <fieldset className="min-w-0">
        <legend className={claseRotulo}>Para llevarse libros</legend>
        <div className="mt-3 flex flex-col gap-4">
          <label className="body-md flex items-center gap-2 text-super">
            <input
              type="checkbox"
              checked={form.asociarse.haceFalta}
              onChange={(e) =>
                set('asociarse', {
                  haceFalta: e.target.checked,
                  costo: e.target.checked ? form.asociarse.costo : '',
                })
              }
            />
            Hay que asociarse
          </label>

          {form.asociarse.haceFalta && (
            <Campo
              label="Cuánto sale asociarse"
              htmlFor="bib-pub-asociarse-costo"
              error={errorDe('asociarse.costo')}
              ayuda="Se publica con la fecha de hoy al lado. Si no sabés cuánto, dejalo vacío."
            >
              <input
                id="bib-pub-asociarse-costo"
                className={claseInput}
                maxLength={TOPE_COSTO_DE_ASOCIARSE_BIBLIOTECA}
                placeholder="$3.000 por año"
                value={form.asociarse.costo}
                onChange={(e) => set('asociarse', { ...form.asociarse, costo: e.target.value })}
              />
            </Campo>
          )}
        </div>
      </fieldset>

      <fieldset className="min-w-0">
        <legend className={claseRotulo}>Por dónde te encuentran</legend>
        <p className="body-sm mt-1 max-w-[65ch] text-super">
          Lo que pongas acá <strong>se publica en la ficha</strong>. Con uno alcanza.
        </p>
        <div className="mt-3 grid gap-6 sm:grid-cols-2">
          {/*
            El catálogo va primero: es el dato que hace que alguien elija esta
            biblioteca y no la de al lado, y el que una librería no tiene.
          */}
          <Campo
            label="Catálogo online"
            htmlFor="bib-pub-catalogo"
            error={errorDe('catalogo')}
            ayuda="El link para buscar en su catálogo, si lo tiene."
          >
            <input
              id="bib-pub-catalogo"
              className={claseInput}
              maxLength={TOPE_CATALOGO_BIBLIOTECA}
              placeholder="https://…"
              value={form.catalogo}
              onChange={(e) => set('catalogo', e.target.value)}
            />
          </Campo>

          <Campo label="Instagram" htmlFor="bib-pub-instagram" error={errorDe('instagram')}>
            <input
              id="bib-pub-instagram"
              className={claseInput}
              placeholder="@bpalberdi o el link del perfil"
              value={form.instagram}
              onChange={(e) => set('instagram', e.target.value)}
            />
          </Campo>

          {/*
            **El cartel del WhatsApp, y no es decorativo.** El §5.1 del
            `CLAUDE.md` advierte que un número personal publicado queda expuesto
            a bots. Acá el número es institucional, pero eso solo es cierto si
            quien lo carga sabe que se publica — y de este lado del formulario
            puede estar cargándolo alguien que no lo pensó.
          */}
          <Campo
            label="WhatsApp"
            htmlFor="bib-pub-whatsapp"
            error={errorDe('whatsapp')}
            ayuda="Este número se publica en el sitio."
          >
            <input
              id="bib-pub-whatsapp"
              className={claseInput}
              inputMode="tel"
              value={form.whatsapp}
              onChange={(e) => set('whatsapp', e.target.value)}
            />
          </Campo>

          <Campo label="Sitio web" htmlFor="bib-pub-web-sitio" error={errorDe('web')}>
            <input
              id="bib-pub-web-sitio"
              className={claseInput}
              maxLength={TOPE_WEB_BIBLIOTECA}
              placeholder="https://…"
              value={form.web}
              onChange={(e) => set('web', e.target.value)}
            />
          </Campo>

          <Campo label="Mail" htmlFor="bib-pub-mail" error={errorDe('mail')}>
            <input
              id="bib-pub-mail"
              className={claseInput}
              type="email"
              maxLength={TOPE_MAIL_BIBLIOTECA}
              value={form.mail}
              onChange={(e) => set('mail', e.target.value)}
            />
          </Campo>
        </div>
      </fieldset>

      {/*
        **El contacto de quien manda la ficha: interno, no sale nunca.** La
        proyección pública (`lib/bibliotecaPublica.ts`) no lo lleva — lo afirma un
        centinela en `tests/biblioteca-publica.test.ts`. Se dice acá arriba del
        campo por lo mismo que se dice lo contrario en el del WhatsApp: quien
        carga tiene que saber qué pasa con cada dato que escribe.

        Y es **obligatorio** de este lado y opcional del de adentro: quien carga
        desde afuera no vuelve a entrar, así que si la ficha llega incompleta la
        única salida sería descartarla. Eso lo decide `bibliotecaPublicaFormSchema`.
      */}
      <fieldset className="min-w-0">
        <legend className={claseRotulo}>Cómo te escribimos</legend>
        <p className="body-sm mt-1 max-w-[65ch] text-super">
          Esto <strong>no se publica</strong>. Es solo por si hay que preguntarte algo antes de
          sumarla, y se borra si al final la ficha no entra.
        </p>
        <div className="mt-3 grid gap-6 sm:grid-cols-2">
          <Campo label="Por dónde" htmlFor="bib-pub-contacto-via">
            <select
              id="bib-pub-contacto-via"
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
            label="Tu contacto"
            htmlFor="bib-pub-contacto-valor"
            requerido
            error={errorDe('contactoDeQuienCargo.valor')}
          >
            <input
              id="bib-pub-contacto-valor"
              className={claseInput}
              maxLength={TOPE_CONTACTO_BIBLIOTECA}
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
          {alta.enviando ? 'Mandando…' : 'Mandar la biblioteca'}
        </button>
      </div>
    </form>
  );
}
