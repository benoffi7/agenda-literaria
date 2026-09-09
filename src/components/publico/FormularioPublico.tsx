import { useEffect, useRef, useState } from 'react';
import { Campo, claseInput } from '@/components/campos/Campo';
import {
  claseBotonPrimario,
  claseBotonSecundario,
  claseBloque,
  claseRotulo,
} from '@/components/sitio/estilos';
import { propuestaFormSchema, propuestaVacia } from '@/lib/propuesta-schema';
import {
  ARANCELES_PROPUESTA,
  MAX_FECHAS_PROPUESTA,
  MODALIDADES_PROPUESTA,
  TOPE_CONTACTO_PROPUESTA,
  TOPE_DESCRIPCION_PROPUESTA,
  TOPE_INCLUYE_OTRO_PROPUESTA,
  TOPE_INSCRIPCION_PROPUESTA,
  TOPE_TITULO_PROPUESTA,
  VIAS_CONTACTO_PROPUESTA,
} from '@/types/propuesta';
import type {
  ArancelPropuesta,
  ModalidadPropuesta,
  PropuestaForm,
  ViaContactoPropuesta,
} from '@/types/propuesta';

/**
 * **El formulario público de propuestas** — B-830, paso 9. `/proponer`.
 *
 * Es el **primer formulario del sitio público** y el primero que escribe en
 * Firestore desde el navegador de un visitante. Todo lo raro que tiene sale de
 * ahí.
 *
 * ── Las cuatro capas contra el abuso, y cuál hace qué ─────────────────────
 * Ninguna alcanza sola y ninguna reemplaza a otra (§2 de `prd/README.md`):
 *
 * 1. **App Check** — la única que frena a un script. Se activa recién en el
 *    submit, porque el módulo que habla con Firebase entra por `import()`: ver
 *    `lib/enviar-propuesta.ts`, donde está el motivo entero. **Todavía no está
 *    exigiendo** (B-836a), y por eso hoy la escritura sigue cerrada a admin.
 * 2. **La regla de Firestore** — acota la forma, no el volumen. Es la que un
 *    `curl` no se puede saltear, y por eso el schema de acá **no es la defensa**:
 *    es lo que hace que el error se vea antes de mandar.
 * 3. **El honeypot y el tiempo mínimo**, que están en este archivo. Frenan lo
 *    automático y torpe, que es la mayoría.
 * 4. **La bandeja** — un humano insistente no lo frena nadie: lo frena que
 *    alguien mire y borre.
 *
 * ── Por qué el honeypot no dice que lo agarró ─────────────────────────────
 * Cuando el campo trampa viene lleno o el envío llega demasiado rápido, la
 * pantalla muestra **la misma pantalla de gracias** y no se escribe nada. Decirle
 * a un bot «te agarré» es enseñarle qué corregir; el costo es que un humano con
 * un gestor de contraseñas muy entusiasta podría llenar el campo oculto y creer
 * que mandó. Por eso el campo se llama algo que ningún gestor autocompleta, va
 * con `autocomplete="off"` y `tabIndex={-1}`, y el tiempo mínimo es corto.
 *
 * ── Y por qué no importa nada de `admin/` ─────────────────────────────────
 * Porque arrastraría la medición del panel, que **no tiene portón de
 * consentimiento**, a una página pública (B-841). `campos/Campo` sí se puede: es
 * genérico desde ese mismo cambio. Lo hace cumplir
 * `tests/panel-fuera-del-sitio.test.ts`.
 */
export interface OpcionOfrecida {
  slug: string;
  label: string;
}

interface Props {
  /**
   * Las opciones de «qué se llevan» que **ya existen**, leídas en el build y
   * pasadas como prop.
   *
   * No se leen en el navegador a propósito: `/opciones/*` es de lectura pública,
   * pero pedirlas en runtime obligaría a inicializar Firestore —y con él App
   * Check— al **abrir** la página, que es justo lo que este formulario evita. El
   * build ya las lee para el `events.json` (§4.4) y el sitio se rebuildea cuando
   * cambian, así que la lista está al día sin costo.
   *
   * Y quien propone **no puede crear una**: lo que no esté en la lista va al
   * texto libre de abajo, y el admin decide si merece entrar a la taxonomía
   * (§4.2 del PRD).
   */
  incluyeOfrecido: readonly OpcionOfrecida[];
}

const LABEL_MODALIDAD: Record<ModalidadPropuesta, string> = {
  presencial: 'Presencial',
  virtual: 'Por videollamada',
  'las-dos': 'Las dos cosas',
};

const LABEL_ARANCEL: Record<ArancelPropuesta, string> = {
  gratis: 'Gratis',
  'a-la-gorra': 'A la gorra',
  arancelado: 'Con arancel',
};

const LABEL_VIA: Record<ViaContactoPropuesta, string> = {
  mail: 'Mail',
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
};

const PLACEHOLDER_CONTACTO: Record<ViaContactoPropuesta, string> = {
  mail: 'taller@ejemplo.com',
  whatsapp: '+54 9 11 …',
  instagram: '@tucuenta',
};

/**
 * Cuánto tarda una persona, como piso, en completar once campos.
 *
 * Cinco segundos es deliberadamente **poco**: no es una medida de cuánto lleva
 * escribir esto —lleva minutos— sino el piso por debajo del cual seguro no lo
 * escribió nadie. Un umbral alto empieza a rechazar humanos rápidos que pegan
 * texto preparado, y ese falso positivo es silencioso: la persona ve la pantalla
 * de gracias y su propuesta no existe.
 */
const SEGUNDOS_MINIMOS = 5;

export function FormularioPublico({ incluyeOfrecido }: Props) {
  const [form, setForm] = useState<PropuestaForm>(propuestaVacia());
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  /** El campo trampa. No se manda a ninguna parte: solo se mira si está vacío. */
  const [trampa, setTrampa] = useState('');
  /** El objeto que dejó la subida, si hubo una. */
  const [imagen, setImagen] = useState<{ path: string; nombre: string } | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const abierto = useRef(Date.now());

  useEffect(() => {
    abierto.current = Date.now();
  }, []);

  const set = <K extends keyof PropuestaForm>(clave: K, valor: PropuestaForm[K]) =>
    setForm((f) => ({ ...f, [clave]: valor }));

  const errorDe = (ruta: string): string | undefined => errores[ruta];

  const agregarFecha = () =>
    set('fechas', [...form.fechas, { dia: '', desde: '', hasta: '' }]);

  const quitarFecha = (i: number) =>
    set(
      'fechas',
      form.fechas.filter((_, n) => n !== i),
    );

  const cambiarFecha = (i: number, parte: 'dia' | 'desde' | 'hasta', valor: string) =>
    set(
      'fechas',
      form.fechas.map((f, n) => (n === i ? { ...f, [parte]: valor } : f)),
    );

  const alElegirArchivo = async (archivo: File | undefined) => {
    if (!archivo) return;
    setSubiendo(true);
    setFallo(null);
    try {
      const { subirImagenDePropuesta } = await import('@/lib/enviar-propuesta');
      const path = await subirImagenDePropuesta(archivo);
      setImagen({ path, nombre: archivo.name });
      // Las dos formas son excluyentes: si subió un archivo, la URL pegada se va.
      set('imagenUrl', '');
    } catch (e: unknown) {
      setFallo(
        e instanceof Error
          ? `No se pudo subir la imagen: ${e.message}`
          : 'No se pudo subir la imagen.',
      );
    } finally {
      setSubiendo(false);
    }
  };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (enviando) return;

    /*
     * Las dos trampas, **antes** de validar y sin distinguirse de un envío
     * bueno: el campo lleno y el envío instantáneo son las dos firmas de un
     * script. No se escribe nada y la pantalla dice gracias.
     */
    const rapido = (Date.now() - abierto.current) / 1000 < SEGUNDOS_MINIMOS;
    if (trampa.trim() !== '' || rapido) {
      setListo(true);
      return;
    }

    const r = propuestaFormSchema.safeParse(form);
    if (!r.success) {
      const nuevos: Record<string, string> = {};
      for (const i of r.error.issues) nuevos[i.path.join('.')] = i.message;
      setErrores(nuevos);
      setFallo('Faltan algunas cosas. Están marcadas abajo.');
      return;
    }

    setEnviando(true);
    setFallo(null);
    try {
      const { enviarPropuesta } = await import('@/lib/enviar-propuesta');
      await enviarPropuesta(form, imagen?.path ?? null);
      setListo(true);
    } catch (err: unknown) {
      /*
       * No se inventa el motivo. Hoy el más probable es el permission-denied de
       * la puerta que todavía no se abrió (B-836a) y mañana va a ser la red; en
       * los dos casos lo que la persona necesita es **que no se le pierda lo que
       * escribió** y una segunda puerta, que DEC-10 dejó abierta a propósito.
       */
      setFallo(
        'No pudimos recibir la propuesta. Lo que escribiste sigue acá: probá de nuevo en un ' +
          'rato, o escribinos y te la cargamos nosotros.',
      );
      setEnviando(false);
    }
  };

  if (listo) {
    return (
      <section className={`mt-10 p-6 ${claseBloque}`} aria-live="polite">
        <h2 className="headline-sm text-acento">Gracias, la recibimos</h2>
        <p className="body-lectura mt-3 max-w-[65ch] text-super">
          La vamos a mirar y, si entra en la agenda, la cargamos nosotros. Si falta algún dato
          te escribimos por donde nos dijiste.
        </p>
        <p className="body-lectura mt-3 max-w-[65ch] text-super">
          No hace falta que mandes nada más. Si te olvidaste de algo importante, escribinos y lo
          agregamos.
        </p>
      </section>
    );
  }

  return (
    <form onSubmit={(e) => void enviar(e)} className="mt-10 flex flex-col gap-6" noValidate>
      {/*
        El campo trampa. Fuera del flujo de tabulación, sin autocompletado y con
        `aria-hidden` para que un lector de pantalla no lo anuncie: quien navega
        con teclado o con lector **no tiene que poder llenarlo sin querer**.
        `hidden` de CSS y no el atributo, porque algunos bots ignoran lo segundo.
      */}
      <div className="absolute -left-[9999px] top-0 h-0 w-0 overflow-hidden" aria-hidden="true">
        <label htmlFor="prop-web">No completes esto</label>
        <input
          id="prop-web"
          name="web"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={trampa}
          onChange={(e) => setTrampa(e.target.value)}
        />
      </div>

      <Campo label="¿Qué actividad es?" htmlFor="prop-titulo" error={errorDe('titulo')}>
        <input
          id="prop-titulo"
          className={claseInput}
          maxLength={TOPE_TITULO_PROPUESTA}
          value={form.titulo}
          onChange={(e) => set('titulo', e.target.value)}
          placeholder="Taller de crónica urbana"
        />
      </Campo>

      <Campo
        label="Contanos de qué se trata"
        htmlFor="prop-descripcion"
        error={errorDe('descripcion')}
        ayuda="Qué se hace, para quién es, si hace falta saber algo de antes."
      >
        <textarea
          id="prop-descripcion"
          className={claseInput}
          rows={5}
          maxLength={TOPE_DESCRIPCION_PROPUESTA}
          value={form.descripcion}
          onChange={(e) => set('descripcion', e.target.value)}
        />
      </Campo>

      <fieldset className="min-w-0">
        <legend className={claseRotulo}>Cuándo</legend>
        {errorDe('fechas') && (
          <p className="body-sm mt-1 text-acento">{errorDe('fechas')}</p>
        )}
        <ul className="mt-2 flex flex-col gap-3">
          {form.fechas.map((f, i) => (
            // El índice como `key` acá **sí** corresponde: la fila no tiene id y
            // no debe tenerlo (los `ses_<uuid>` los genera la conversión, trampa
            // 2), y la lista no se reordena.
            <li key={i} className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <Campo label="Día" htmlFor={`prop-dia-${i}`} error={errorDe(`fechas.${i}.dia`)}>
                <input
                  id={`prop-dia-${i}`}
                  type="date"
                  className={claseInput}
                  value={f.dia}
                  onChange={(e) => cambiarFecha(i, 'dia', e.target.value)}
                />
              </Campo>
              <Campo label="Desde" htmlFor={`prop-desde-${i}`} error={errorDe(`fechas.${i}.desde`)}>
                <input
                  id={`prop-desde-${i}`}
                  type="time"
                  className={claseInput}
                  value={f.desde}
                  onChange={(e) => cambiarFecha(i, 'desde', e.target.value)}
                />
              </Campo>
              <Campo
                label="Hasta"
                htmlFor={`prop-hasta-${i}`}
                error={errorDe(`fechas.${i}.hasta`)}
                ayuda={i === 0 ? 'Si no sabés, dejalo vacío.' : undefined}
              >
                <input
                  id={`prop-hasta-${i}`}
                  type="time"
                  className={claseInput}
                  value={f.hasta}
                  onChange={(e) => cambiarFecha(i, 'hasta', e.target.value)}
                />
              </Campo>
              {form.fechas.length > 1 && (
                <button
                  type="button"
                  className={claseBotonSecundario}
                  onClick={() => quitarFecha(i)}
                >
                  Quitar
                </button>
              )}
            </li>
          ))}
        </ul>
        {form.fechas.length < MAX_FECHAS_PROPUESTA && (
          <button type="button" className={`${claseBotonSecundario} mt-2`} onClick={agregarFecha}>
            Agregar otra fecha
          </button>
        )}
      </fieldset>

      <Campo label="¿Cómo es?" htmlFor="prop-modalidad" comoGrupo error={errorDe('modalidad')}>
        <div className="flex flex-wrap gap-2" id="prop-modalidad">
          {MODALIDADES_PROPUESTA.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={form.modalidad === m}
              onClick={() => set('modalidad', m)}
              className={form.modalidad === m ? claseBotonPrimario : claseBotonSecundario}
            >
              {LABEL_MODALIDAD[m]}
            </button>
          ))}
        </div>
      </Campo>

      {form.modalidad !== 'virtual' && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo label="Lugar" htmlFor="prop-lugar" error={errorDe('lugar.nombre')}>
            <input
              id="prop-lugar"
              className={claseInput}
              value={form.lugar.nombre}
              onChange={(e) => set('lugar', { ...form.lugar, nombre: e.target.value })}
              placeholder="Casa Brandon"
            />
          </Campo>
          <Campo label="Dirección" htmlFor="prop-direccion" error={errorDe('lugar.direccion')}>
            <input
              id="prop-direccion"
              className={claseInput}
              value={form.lugar.direccion}
              onChange={(e) => set('lugar', { ...form.lugar, direccion: e.target.value })}
            />
          </Campo>
          <Campo label="Barrio" htmlFor="prop-barrio" error={errorDe('lugar.barrio')}>
            <input
              id="prop-barrio"
              className={claseInput}
              value={form.lugar.barrio}
              onChange={(e) => set('lugar', { ...form.lugar, barrio: e.target.value })}
            />
          </Campo>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="¿Quién organiza?" htmlFor="prop-organiza" error={errorDe('organizador.nombre')}>
          <input
            id="prop-organiza"
            className={claseInput}
            value={form.organizador.nombre}
            onChange={(e) => set('organizador', { ...form.organizador, nombre: e.target.value })}
          />
        </Campo>
        <Campo
          label="Instagram de quien organiza"
          htmlFor="prop-instagram"
          error={errorDe('organizador.instagram')}
          ayuda="Opcional."
        >
          <input
            id="prop-instagram"
            className={claseInput}
            value={form.organizador.instagram}
            onChange={(e) => set('organizador', { ...form.organizador, instagram: e.target.value })}
            placeholder="@casabrandon"
          />
        </Campo>
      </div>

      <Campo label="¿Cuánto sale?" htmlFor="prop-arancel" comoGrupo error={errorDe('arancel.tipo')}>
        <div className="flex flex-wrap gap-2" id="prop-arancel">
          {ARANCELES_PROPUESTA.map((a) => (
            <button
              key={a}
              type="button"
              aria-pressed={form.arancel.tipo === a}
              onClick={() => set('arancel', { ...form.arancel, tipo: a })}
              className={form.arancel.tipo === a ? claseBotonPrimario : claseBotonSecundario}
            >
              {LABEL_ARANCEL[a]}
            </button>
          ))}
        </div>
      </Campo>

      <Campo
        label="Algo más sobre el precio"
        htmlFor="prop-arancel-notas"
        error={errorDe('arancel.notas')}
        ayuda="Opcional: «dos cuotas», «incluye el material», «$18.000 por mes»."
      >
        <input
          id="prop-arancel-notas"
          className={claseInput}
          value={form.arancel.notas}
          onChange={(e) => set('arancel', { ...form.arancel, notas: e.target.value })}
        />
      </Campo>

      <Campo label="¿Hay que anotarse?" htmlFor="prop-inscripcion" comoGrupo>
        <div className="flex flex-wrap items-center gap-3" id="prop-inscripcion">
          <label className="body-md flex items-center gap-2 text-super">
            <input
              type="checkbox"
              checked={form.inscripcion.requiere}
              onChange={(e) =>
                set('inscripcion', { ...form.inscripcion, requiere: e.target.checked })
              }
            />
            Sí, hay que anotarse
          </label>
        </div>
      </Campo>

      {form.inscripcion.requiere && (
        <Campo
          label="¿Cómo se anota la gente?"
          htmlFor="prop-como-anotarse"
          error={errorDe('inscripcion.comoDice')}
          ayuda="Con tus palabras: «escribime por WhatsApp», «hay un formulario»."
        >
          <input
            id="prop-como-anotarse"
            className={claseInput}
            maxLength={TOPE_INSCRIPCION_PROPUESTA}
            value={form.inscripcion.comoDice}
            onChange={(e) => set('inscripcion', { ...form.inscripcion, comoDice: e.target.value })}
          />
        </Campo>
      )}

      {incluyeOfrecido.length > 0 && (
        <Campo label="¿Qué se llevan?" htmlFor="prop-incluye" comoGrupo error={errorDe('incluye')}>
          <div className="flex flex-wrap gap-2" id="prop-incluye">
            {incluyeOfrecido.map((o) => {
              const elegida = form.incluye.includes(o.slug);
              return (
                <button
                  key={o.slug}
                  type="button"
                  aria-pressed={elegida}
                  onClick={() =>
                    set(
                      'incluye',
                      elegida
                        ? form.incluye.filter((s) => s !== o.slug)
                        : [...form.incluye, o.slug],
                    )
                  }
                  className={elegida ? claseBotonPrimario : claseBotonSecundario}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </Campo>
      )}

      <Campo
        label="Otra cosa que se llevan"
        htmlFor="prop-incluye-otro"
        error={errorDe('incluyeOtro')}
        ayuda="Opcional, si no está en la lista de arriba."
      >
        <input
          id="prop-incluye-otro"
          className={claseInput}
          maxLength={TOPE_INCLUYE_OTRO_PROPUESTA}
          value={form.incluyeOtro}
          onChange={(e) => set('incluyeOtro', e.target.value)}
        />
      </Campo>

      <Campo
        label="El flyer, si tenés"
        htmlFor="prop-imagen"
        error={errorDe('imagenUrl')}
        ayuda="Opcional. Un JPG o un PNG de hasta 3 MB. Le sacamos los datos ocultos que traiga."
      >
        <div className="flex flex-col gap-2">
          <input
            id="prop-imagen"
            type="file"
            accept="image/jpeg,image/png"
            className={claseInput}
            disabled={subiendo || imagen !== null}
            onChange={(e) => void alElegirArchivo(e.target.files?.[0])}
          />
          {subiendo && <p className="body-sm text-super">Subiendo…</p>}
          {imagen && (
            <p className="body-sm text-super">
              Subiste «{imagen.nombre}».{' '}
              <button
                type="button"
                className={claseBotonSecundario}
                onClick={() => setImagen(null)}
              >
                Quitar
              </button>
            </p>
          )}
          {!imagen && !subiendo && (
            <input
              className={claseInput}
              value={form.imagenUrl}
              onChange={(e) => set('imagenUrl', e.target.value)}
              placeholder="O pegá la dirección de una imagen"
              aria-label="Dirección de una imagen, si preferís pegarla"
            />
          )}
        </div>
      </Campo>

      <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
        <Campo label="¿Por dónde te escribimos?" htmlFor="prop-via" comoGrupo>
          <div className="flex flex-wrap gap-2" id="prop-via">
            {VIAS_CONTACTO_PROPUESTA.map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={form.contacto.via === v}
                onClick={() => set('contacto', { ...form.contacto, via: v })}
                className={form.contacto.via === v ? claseBotonPrimario : claseBotonSecundario}
              >
                {LABEL_VIA[v]}
              </button>
            ))}
          </div>
        </Campo>
        <Campo
          label="Tu contacto"
          htmlFor="prop-contacto"
          error={errorDe('contacto.valor')}
          ayuda="Lo usamos solo para escribirte si falta un dato. No sale al sitio."
        >
          <input
            id="prop-contacto"
            className={claseInput}
            maxLength={TOPE_CONTACTO_PROPUESTA}
            value={form.contacto.valor}
            onChange={(e) => set('contacto', { ...form.contacto, valor: e.target.value })}
            placeholder={PLACEHOLDER_CONTACTO[form.contacto.via]}
          />
        </Campo>
      </div>

      {fallo && (
        <p role="alert" className={`p-4 text-acento ${claseBloque}`}>
          {fallo}
        </p>
      )}

      <div>
        <button type="submit" disabled={enviando || subiendo} className={claseBotonPrimario}>
          {enviando ? 'Mandando…' : 'Mandar la propuesta'}
        </button>
      </div>
    </form>
  );
}
