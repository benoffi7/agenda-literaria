import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { ZodType } from 'zod';
import { claseBloque } from '@/components/sitio/estilos';

/**
 * **Las dos capas anti-abuso que viven en el navegador, escritas una sola vez.**
 *
 * `/proponer` las tenía adentro de `FormularioPublico.tsx` porque era el único
 * formulario del sitio. Con los tres de `/guia/<x>/sumar` pasan a ser cuatro, y
 * cuatro copias del mismo honeypot son cuatro oportunidades de que una quede sin
 * el `tabIndex={-1}`, o con un umbral distinto, o —lo más caro— **mostrando el
 * error en vez de la pantalla de gracias**, que es enseñarle al bot qué
 * corregir. Es la clase de B-88 aplicada a una defensa.
 *
 * Lo que este módulo **no** es: la defensa. Las capas que un cliente no se puede
 * saltear son App Check y `firestore.rules` (`prd/README.md` § 2), y ninguna
 * está acá. Esto frena lo automático y torpe, que es la mayoría — y es la única
 * de las cinco capas que se puede escribir en React.
 *
 * ── Por qué es un hook y no un componente que envuelve ────────────────────
 * Porque el estado del formulario es de quien dibuja los campos: un envoltorio
 * tendría que recibir el `render` de los campos y devolverle `form`/`set`, que
 * es la misma dependencia con una indirección más. El hook deja que cada
 * entidad escriba su JSX como si nada, y lo que comparte es la conducta.
 *
 * ── Lo que NO se generalizó, y es a propósito ─────────────────────────────
 * El schema y la conversión a documento viven **por entidad**
 * (`libreria-schema.ts` y sus dos hermanos), y no se tocan desde acá. Es la
 * misma línea que `lib/directorios.ts` traza con la proyección: lo que no
 * depende de los campos se escribe una vez, lo que sí depende **no se
 * generaliza**.
 */

/**
 * Cuánto tarda una persona, como piso, en completar un formulario.
 *
 * Cinco segundos es deliberadamente **poco**: no es una medida de cuánto lleva
 * escribirlo —lleva minutos— sino el piso por debajo del cual seguro no lo
 * escribió nadie. Un umbral alto empieza a rechazar humanos rápidos que pegan
 * texto preparado, y ese falso positivo es **silencioso**: la persona ve la
 * pantalla de gracias y su ficha no existe.
 *
 * Es el mismo número que `/proponer` usaba suelto, y ahora es uno solo: dos
 * umbrales distintos para la misma defensa eran dos decisiones donde hay una.
 */
export const SEGUNDOS_MINIMOS = 5;

interface Opciones<T> {
  /** El formulario vacío. Se llama una sola vez, al montar. */
  inicial: () => T;
  /**
   * El schema **público** de la entidad (`libreriaPublicaFormSchema` y sus dos
   * hermanos): el del panel más la regla de que el contacto es obligatorio,
   * porque quien carga desde afuera no vuelve a entrar y sin contacto la única
   * salida es descartar la ficha.
   */
  schema: ZodType;
  /**
   * Manda la ficha. **Tiene que hacer el `import()` adentro**, no importar el
   * módulo arriba del archivo: `app()` es el borde donde App Check se
   * inicializa, así que importarlo estáticamente haría que el desafío de
   * reCAPTCHA Enterprise —un tercero de Google, con cuota facturable por
   * visitante— cargue para cualquiera que **mire** la página. Lo hace cumplir
   * `tests/panel-fuera-del-sitio.test.ts`.
   */
  enviar: (f: T) => Promise<unknown>;
  /** Qué decir cuando Firestore rechaza o la red falla. Sin inventar el motivo. */
  textoDeFallo: string;
}

export interface AltaPublica<T> {
  form: T;
  set: <K extends keyof T>(clave: K, valor: T[K]) => void;
  /** El mensaje de error de un campo, por su path de zod (`'contactoDeQuienCargo.valor'`). */
  errorDe: (ruta: string) => string | undefined;
  enviando: boolean;
  fallo: string | null;
  /** Ya se mandó (o el honeypot la comió): hay que mostrar la pantalla de gracias. */
  listo: boolean;
  /** Lo que va en el `<form onSubmit>`. */
  onSubmit: (e: React.FormEvent) => void;
  /** Lo que `<CampoTrampa>` necesita. Se pasa entero, sin desarmar. */
  trampa: { valor: string; onChange: (v: string) => void };
}

export function useAltaPublica<T>({
  inicial,
  schema,
  enviar,
  textoDeFallo,
}: Opciones<T>): AltaPublica<T> {
  const [form, setForm] = useState<T>(inicial);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  /** El campo trampa. No se manda a ninguna parte: solo se mira si está vacío. */
  const [trampa, setTrampa] = useState('');
  const abierto = useRef(Date.now());

  useEffect(() => {
    abierto.current = Date.now();
  }, []);

  const set = <K extends keyof T>(clave: K, valor: T[K]) =>
    setForm((f) => ({ ...f, [clave]: valor }));

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (enviando) return;

    /*
     * Las dos trampas, **antes** de validar y sin distinguirse de un envío
     * bueno: el campo lleno y el envío instantáneo son las dos firmas de un
     * script. No se escribe nada y la pantalla dice gracias.
     *
     * Decirle a un bot «te agarré» es enseñarle qué corregir. El costo es que un
     * humano con un gestor de contraseñas muy entusiasta podría llenar el campo
     * oculto y creer que mandó; por eso el campo se llama algo que ningún gestor
     * autocompleta, va con `autocomplete="off"` y `tabIndex={-1}`, y el tiempo
     * mínimo es corto.
     */
    const rapido = (Date.now() - abierto.current) / 1000 < SEGUNDOS_MINIMOS;
    if (trampa.trim() !== '' || rapido) {
      setListo(true);
      return;
    }

    const r = schema.safeParse(form);
    if (!r.success) {
      const nuevos: Record<string, string> = {};
      for (const i of r.error.issues) nuevos[i.path.join('.')] = i.message;
      setErrores(nuevos);
      setFallo('Faltan algunas cosas. Están marcadas abajo.');
      return;
    }

    setErrores({});
    setEnviando(true);
    setFallo(null);
    void (async () => {
      try {
        await enviar(form);
        setListo(true);
      } catch {
        /*
         * **No se inventa el motivo.** Lo que la persona necesita es que no se
         * le pierda lo que escribió y una segunda puerta; el detalle técnico no
         * le sirve para nada y adivinarlo mal es peor que no decirlo.
         */
        setFallo(textoDeFallo);
        setEnviando(false);
      }
    })();
  };

  return {
    form,
    set,
    errorDe: (ruta: string) => errores[ruta],
    enviando,
    fallo,
    listo,
    onSubmit,
    trampa: { valor: trampa, onChange: setTrampa },
  };
}

/**
 * El campo trampa.
 *
 * Fuera del flujo de tabulación, sin autocompletado y con `aria-hidden` para que
 * un lector de pantalla no lo anuncie: **quien navega con teclado o con lector
 * no tiene que poder llenarlo sin querer**. `hidden` de CSS y no el atributo,
 * porque algunos bots ignoran lo segundo.
 *
 * El `id` entra por prop porque puede haber dos formularios en una página y dos
 * `id` iguales rompen el `<label for>` — hoy no pasa, pero el costo de
 * parametrizarlo es cero y el de descubrirlo después no.
 */
export function CampoTrampa({
  id,
  trampa,
}: {
  id: string;
  trampa: { valor: string; onChange: (v: string) => void };
}) {
  return (
    <div className="absolute -left-[9999px] top-0 h-0 w-0 overflow-hidden" aria-hidden="true">
      <label htmlFor={id}>No completes esto</label>
      <input
        id={id}
        name="web"
        type="text"
        tabIndex={-1}
        autoComplete="off"
        value={trampa.valor}
        onChange={(e) => trampa.onChange(e.target.value)}
      />
    </div>
  );
}

/**
 * La pantalla de después de mandar.
 *
 * **No promete publicación ni respuesta** (§ 5 del PRD 2), y eso es una decisión
 * de producto y no de tono: nada que entre por un formulario público aparece en
 * el sitio sin que un admin lo publique, así que prometerlo sería prometer lo que
 * no se cumple — que es lo que B-780 costó como P0.
 */
export function Gracias({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className={`mt-10 p-6 ${claseBloque}`} aria-live="polite">
      <h2 className="headline-sm text-acento">{titulo}</h2>
      {children}
    </section>
  );
}
