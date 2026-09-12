import { useMemo, useState } from 'react';
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
  const [guardando, setGuardando] = useState(false);

  useFormularioSucio(form);

  const set = <K extends keyof LibreriaForm>(campo: K, valor: LibreriaForm[K]) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  const errorDe = (path: string) => errores[path];

  /** La dirección web que va a quedar, con el derivado a la vista antes de guardar. */
  const slugResultante = useMemo(() => slugDeLibreria(form), [form]);

  const congelado = inicial ? slugBloqueado(inicial) : false;

  const guardar = async () => {
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
       * una garantía —no hay reserva atómica en esta colección— pero convierte un
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
      else await crearLibreria(parsed.data as LibreriaForm);
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
      if (labelNuevoDeBarrio?.trim()) {
        try {
          await upsertOpcion('barrio', labelNuevoDeBarrio, uid);
        } catch {
          setAviso(
            `Se guardó, pero el barrio «${labelNuevoDeBarrio}» no quedó en la lista. ` +
              'Volvé a tipearlo la próxima vez que edites la ficha.',
          );
          return;
        }
      }
      onGuardado();
    } catch (e: unknown) {
      setFallo(e instanceof Error ? e.message : 'No se pudo guardar la librería');
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

        <Campo
          label="Dirección web"
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
          **El mismo `/opciones/barrio` que usan las actividades** (§ 2 del PRD):
          una librería en Palermo y un taller en Palermo comparten slug, que es lo
          que deja mostrar las dos cosas en el hub de barrio. Por eso va el control
          de taxonomía y no un input libre.
        */}
        <Campo label="Barrio" htmlFor="lib-barrio" requerido error={errorDe('barrio')}>
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

        <Campo label="Ciudad" htmlFor="lib-ciudad" error={errorDe('ciudad')}>
          <input
            id="lib-ciudad"
            className={claseInput}
            maxLength={80}
            value={form.ciudad}
            onChange={(e) => set('ciudad', e.target.value)}
          />
        </Campo>

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
            placeholder="sin la arroba"
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
        formulario, y sin decirlo alguien carga una librería, la ve guardada y
        espera verla en el sitio.
      */}
      <p className="text-xs text-tinta/55">
        Guardar no la publica. Para que entre al sitio hay que publicarla desde la lista de
        librerías.
      </p>
    </section>
  );
}
