import { Campo, claseInput } from '@/components/campos/Campo';
import { conProvincia, subdivisionDe } from '@/lib/geografia.mjs';
import { claseBotonPrimario, claseRotulo } from '@/components/sitio/estilos';
import { CampoTrampa, Gracias, useAltaPublica } from '@/components/publico/altaPublica';
import { CampoDeTaxonomia } from '@/components/publico/camposDeTaxonomia';
import type { OpcionOfrecida } from '@/components/publico/camposDeTaxonomia';
import { libreriaPublicaFormSchema, libreriaVacia } from '@/lib/libreria-schema';
import {
  TOPE_CONTACTO_LIBRERIA,
  TOPE_DESCRIPCION_LIBRERIA,
  TOPE_DIRECCION_LIBRERIA,
  TOPE_MAIL_LIBRERIA,
  TOPE_NOMBRE_LIBRERIA,
  TOPE_WEB_LIBRERIA,
  VIAS_CONTACTO_LIBRERIA,
} from '@/types/libreria';
import type { LibreriaForm, ViaContactoLibreria } from '@/types/libreria';

/**
 * **El formulario público de una librería** — `/guia/librerias/sumar`, § 5 del
 * PRD 2.
 *
 * Es «el mismo formulario con dos configuraciones» y ésta es la de afuera: los
 * siete campos de la ficha más el contacto interno, **sin** `geo`, **sin** el
 * `slug` —lo deriva el admin del nombre— y **sin** la gestión. El tipo es uno
 * solo (`LibreriaForm`) y los schemas son dos con una regla de diferencia.
 *
 * ── Y sin foto, que es la decisión del 2026-09-15 ────────────────────────
 * El PRD pedía «URL o archivo» (DEC-11). La ficha que llega de afuera nace con
 * la galería vacía, y eso lo **fuerza la regla**
 * (`d.origen == 'panel' || d.imagenes.size() == 0`), no este componente. Es lo
 * que hace que abrir el `create` anónimo no arrastre `storage.rules`, la
 * callable de B-896 generalizada, el objeto huérfano ni un `imagenValida()` por
 * entidad. Las fotos las pone el admin al publicar, donde está el editor de
 * galería. Queda anotado como **B-924**.
 *
 * ── Lo que este componente NO decide ─────────────────────────────────────
 * Ni la validación (`libreriaPublicaFormSchema`), ni el armado del documento
 * (`formALibreria`), ni el ciclo de vida (`lib/directorios.ts`), ni las dos
 * capas anti-abuso del navegador (`altaPublica.tsx`). Acá hay campos y nada más
 * — el mismo reparto que `LibreriaFormulario` tiene del lado del panel.
 *
 * ── Por qué no importa nada de `admin/` ──────────────────────────────────
 * Porque arrastraría la medición del panel —que no tiene portón de
 * consentimiento (D-250)— a una página pública, y con `TaxonomiaSelect` además
 * Firebase entero al árbol estático. `campos/Campo` sí se puede: es genérico
 * desde B-827. Lo hace cumplir `tests/panel-fuera-del-sitio.test.ts`.
 */
interface Props {
  /**
   * Los barrios que **ya existen**, leídos en el build y pasados como prop.
   *
   * No se leen en el navegador a propósito: `/opciones/*` es de lectura pública,
   * pero pedirlos en runtime obligaría a inicializar Firestore —y con él App
   * Check— al **abrir** la página, que es justo lo que este formulario evita
   * (el motivo entero está en `lib/enviar-ficha.ts`). El build ya los lee y el
   * sitio se rebuildea cuando cambian (§4.4), así que la lista viaja al día.
   */
  barriosOfrecidos: readonly OpcionOfrecida[];
  /**
   * Las provincias y las ciudades, con el mismo reparto — B-967. Las provincias
   * vienen sembradas (`PROVINCIAS`), las ciudades crecen con el uso igual que los
   * barrios.
   */
  provinciasOfrecidas: readonly OpcionOfrecida[];
  ciudadesOfrecidas: readonly OpcionOfrecida[];
}

const TEXTO_VIA: Record<ViaContactoLibreria, string> = {
  mail: 'Mail',
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
};

const PLACEHOLDER_VIA: Record<ViaContactoLibreria, string> = {
  mail: 'vos@ejemplo.com',
  whatsapp: '+54 9 11 …',
  instagram: '@tucuenta',
};

export function SumarLibreria({
  barriosOfrecidos,
  provinciasOfrecidas,
  ciudadesOfrecidas,
}: Props) {
  const alta = useAltaPublica<LibreriaForm>({
    inicial: libreriaVacia,
    schema: libreriaPublicaFormSchema,
    enviar: async (f) => {
      // `import()` y no un import de arriba: es lo que hace que App Check entre
      // en el submit y no al abrir la página. Ver `lib/enviar-ficha.ts`.
      const { enviarLibreria } = await import('@/lib/enviar-ficha');
      return enviarLibreria(f);
    },
    textoDeFallo:
      'No pudimos recibir la librería. Lo que escribiste sigue acá: probá de nuevo en un ' +
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
      <CampoTrampa id="lib-pub-web" trampa={alta.trampa} />

      <Campo label="¿Cómo se llama?" htmlFor="lib-pub-nombre" requerido error={errorDe('nombre')}>
        <input
          id="lib-pub-nombre"
          className={claseInput}
          maxLength={TOPE_NOMBRE_LIBRERIA}
          value={form.nombre}
          onChange={(e) => set('nombre', e.target.value)}
          placeholder="Librería Del Otro Lado"
        />
      </Campo>

      <Campo
        label="Qué tiene, qué la hace distinta"
        htmlFor="lib-pub-descripcion"
        error={errorDe('descripcion')}
        ayuda="Si hay mesa de novedades, si hace club de lectura, si es de usados."
      >
        <textarea
          id="lib-pub-descripcion"
          className={claseInput}
          rows={4}
          maxLength={TOPE_DESCRIPCION_LIBRERIA}
          value={form.descripcion}
          onChange={(e) => set('descripcion', e.target.value)}
        />
      </Campo>

      <div className="grid gap-6 sm:grid-cols-2">
        <Campo label="Dirección" htmlFor="lib-pub-direccion" requerido error={errorDe('direccion')}>
          <input
            id="lib-pub-direccion"
            className={claseInput}
            maxLength={TOPE_DIRECCION_LIBRERIA}
            value={form.direccion}
            onChange={(e) => set('direccion', e.target.value)}
            placeholder="Thames 1762"
          />
        </Campo>

        {/*
          B-967 — la misma cascada del panel y del riel, con la misma
          `subdivisionDe`. Acá «Otro…» **no da de alta** la etiqueta —un anónimo no
          escribe en `/opciones/*`, que es un documento compartido por todo el
          sitio— pero existe igual, por lo mismo que en el barrio: la lista puede
          no tener la ciudad de quien carga, y un desplegable cerrado dejaría el
          formulario inguardable.
        */}
        <Campo
          label="Provincia"
          htmlFor="lib-pub-provincia"
          requerido
          error={errorDe('provincia')}
        >
          <CampoDeTaxonomia
            id="lib-pub-provincia"
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
            htmlFor="lib-pub-barrio"
            error={errorDe('barrio')}
            ayuda={
              barriosOfrecidos.length > 0
                ? 'Si no está en la lista, elegí «Otro…» y escribilo.'
                : undefined
            }
          >
            <CampoDeTaxonomia
              id="lib-pub-barrio"
              opciones={barriosOfrecidos}
              value={form.barrio}
              onChange={(v) => set('barrio', v)}
              placeholder="Elegí el barrio"
            />
          </Campo>
        ) : (
          <Campo
            label="Ciudad"
            htmlFor="lib-pub-ciudad"
            error={errorDe('ciudad')}
            ayuda={
              form.provincia
                ? 'Si no está en la lista, elegí «Otro…» y escribila.'
                : 'Elegí primero la provincia.'
            }
          >
            <CampoDeTaxonomia
              id="lib-pub-ciudad"
              opciones={ciudadesOfrecidas}
              value={form.ciudad}
              onChange={(v) => set('ciudad', v)}
              placeholder="Elegí la ciudad"
            />
          </Campo>
        )}
      </div>

      <fieldset className="min-w-0">
        <legend className={claseRotulo}>Por dónde te encuentran</legend>
        <p className="body-sm mt-1 max-w-[65ch] text-super">
          Lo que pongas acá <strong>se publica en la ficha</strong>. Con uno alcanza.
        </p>
        <div className="mt-3 grid gap-6 sm:grid-cols-2">
          <Campo label="Instagram" htmlFor="lib-pub-instagram" error={errorDe('instagram')}>
            <input
              id="lib-pub-instagram"
              className={claseInput}
              placeholder="sin la arroba"
              value={form.instagram}
              onChange={(e) => set('instagram', e.target.value)}
            />
          </Campo>

          {/*
            **El cartel del WhatsApp, y no es decorativo**: es el criterio de
            aceptación 4 del PRD. El §5.1 del `CLAUDE.md` advierte que un número
            personal publicado queda expuesto a bots. Acá el número es de trabajo
            —es una librería— pero eso solo es cierto si quien lo carga sabe que
            se publica, y de este lado del formulario puede estar cargándolo
            alguien que no lo pensó.
          */}
          <Campo
            label="WhatsApp"
            htmlFor="lib-pub-whatsapp"
            error={errorDe('whatsapp')}
            ayuda="Este número se publica en el sitio."
          >
            <input
              id="lib-pub-whatsapp"
              className={claseInput}
              inputMode="tel"
              value={form.whatsapp}
              onChange={(e) => set('whatsapp', e.target.value)}
            />
          </Campo>

          <Campo label="Sitio web" htmlFor="lib-pub-web-sitio" error={errorDe('web')}>
            <input
              id="lib-pub-web-sitio"
              className={claseInput}
              maxLength={TOPE_WEB_LIBRERIA}
              placeholder="https://…"
              value={form.web}
              onChange={(e) => set('web', e.target.value)}
            />
          </Campo>

          <Campo label="Mail" htmlFor="lib-pub-mail" error={errorDe('mail')}>
            <input
              id="lib-pub-mail"
              className={claseInput}
              type="email"
              maxLength={TOPE_MAIL_LIBRERIA}
              value={form.mail}
              onChange={(e) => set('mail', e.target.value)}
            />
          </Campo>
        </div>
      </fieldset>

      {/*
        **El contacto de quien manda la ficha: interno, no sale nunca.** Es el
        segundo dato personal de un tercero que el proyecto guarda, y la
        proyección pública (`lib/libreriaPublica.ts`) no lo lleva — lo afirma un
        centinela en `tests/libreria-publica.test.ts`. Se dice acá arriba del
        campo por lo mismo que se dice lo contrario en el del WhatsApp: quien
        carga tiene que saber qué pasa con cada dato que escribe.

        Y es **obligatorio** de este lado y opcional del de adentro: quien carga
        desde afuera no vuelve a entrar, así que si la ficha llega incompleta la
        única salida sería descartarla. Eso lo decide `libreriaPublicaFormSchema`.
      */}
      <fieldset className="min-w-0">
        <legend className={claseRotulo}>Cómo te escribimos</legend>
        <p className="body-sm mt-1 max-w-[65ch] text-super">
          Esto <strong>no se publica</strong>. Es solo por si hay que preguntarte algo antes de
          sumarla, y se borra si al final la ficha no entra.
        </p>
        <div className="mt-3 grid gap-6 sm:grid-cols-2">
          <Campo label="Por dónde" htmlFor="lib-pub-contacto-via">
            <select
              id="lib-pub-contacto-via"
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
            label="Tu contacto"
            htmlFor="lib-pub-contacto-valor"
            requerido
            error={errorDe('contactoDeQuienCargo.valor')}
          >
            <input
              id="lib-pub-contacto-valor"
              className={claseInput}
              maxLength={TOPE_CONTACTO_LIBRERIA}
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
          {alta.enviando ? 'Mandando…' : 'Mandar la librería'}
        </button>
      </div>
    </form>
  );
}
