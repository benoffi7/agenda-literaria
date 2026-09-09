import { useRef, useState } from 'react';
import {
  Campo,
  claseBotonFila,
  claseBotonSecundario,
  claseInput,
} from '@/components/campos/Campo';
import { medirFuncion } from '@/lib/analytics';
import {
  formatearGeo,
  linkCortoParaAbrir,
  linkMapa,
  parsearCoordenadas,
  type Geo,
} from '@/lib/coordenadas';

interface Props {
  geo: Geo | null;
  onChange: (geo: Geo | null) => void;
  /**
   * B-827 — id del input donde se pega el link. Lo pone quien monta el
   * componente porque hay uno por fila de modalidad: derivarlo acá adentro
   * repetiría el mismo id en las dos sedes de una actividad híbrida.
   */
  id: string;
  className?: string;
}

const AYUDA =
  'Opcional. Buscá el lugar en Google Maps y pegá el link de la barra de direcciones, ' +
  'o hacé clic derecho sobre el punto exacto y pegá el "lat, lng" que copia.';

/**
 * Captura de `sede.geo` (§3.1). Sirve para lo que abunda en el circuito
 * literario y la dirección sola no resuelve: una librería sin numeración
 * clara, un centro cultural dentro de un predio, una casa en un pasaje. Si hay
 * coordenadas, el link del evento de Calendar apunta al punto exacto en vez de
 * hacer que Google adivine por texto (D-10).
 *
 * El parseo vive en `lib/coordenadas.ts` (puro y testeado). Acá solo el
 * control: pegar, ver qué se cargó, y poder borrarlo para volver a `null`.
 *
 * ── Qué se mide, y por qué (B-55, §9) ──────────────────────────────────────
 * `coordenadas-pegar` es el **denominador**: un intento de resolver lo que hay
 * en el campo, salga o no. `coordenadas-fallo` es el numerador, con el `motivo`
 * que devuelve el parseo —no una clasificación hecha acá mirando el texto del
 * mensaje, que se rompería sola con la próxima corrección de redacción (B-88).
 *
 * Sin el denominador la pregunta no se contesta: "el 80 % de los fallos es un
 * link corto" no dice nada si no se sabe cuántos intentos hubo en total. Es lo
 * que decide **B-45** — si casi todo lo que se pega es un link corto, lo que hay
 * que hacer es resolverlos y no explicar mejor el campo.
 *
 * **Nunca viaja lo pegado.** El link es contenido: puede llevar el nombre del
 * lugar, y el `detalle` es un enum cerrado de cuatro etiquetas de causa.
 */
export function CoordenadasSede({ geo, onChange, id, className = '' }: Props) {
  const [texto, setTexto] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [advertencia, setAdvertencia] = useState<string | null>(null);
  /**
   * B-45 — el link corto que se pegó, si lo que se pegó es uno.
   *
   * Se guarda el **saneado** que devuelve `linkCortoParaAbrir` y no el texto del
   * campo: lo que va a un `href` no puede salir del portapapeles sin pasar por
   * la lista blanca de hosts y el `https` forzado. Y se guarda al fallar y no se
   * deriva del `texto` en el render, porque el campo se puede seguir tipeando
   * mientras el mensaje de error está en pantalla.
   */
  const [linkCorto, setLinkCorto] = useState<string | null>(null);
  /**
   * Lo último que se midió, para no contar dos veces lo mismo.
   *
   * Hace falta porque hay **cuatro** disparadores sobre el mismo texto —pegar,
   * Enter, el botón "Usar" y el blur— y uno se encadena con otro: pegar aplica y
   * deja el texto en el campo, así que salir del campo vuelve a aplicarlo. Sin
   * esto, un solo link corto pegado llega a GA4 como dos o tres fallos y la
   * proporción que decide B-45 sale inflada justo en el modo de fallo más
   * frecuente. Un `useRef` y no estado: no se pinta nada con esto, y un
   * `setState` acá provocaría un render por tecla de más.
   */
  const medido = useRef<string | null>(null);

  /** `entrada` explícita porque al pegar se lee del portapapeles, no del state. */
  const aplicar = (entrada: string) => {
    if (!entrada.trim()) {
      // Campo vacío no es un error: es que todavía no cargó nada. Y no se mide:
      // no hubo intento.
      setError(null);
      setAdvertencia(null);
      setLinkCorto(null);
      return;
    }
    const r = parsearCoordenadas(entrada);
    // Un intento es un intento aunque falle: `coordenadas-pegar` es el
    // denominador de `coordenadas-fallo` (§9).
    const yaMedido = medido.current === entrada;
    medido.current = entrada;
    if (!yaMedido) medirFuncion('coordenadas-pegar');
    if (!r.ok) {
      // Falla visible y con instrucción: el silencio acá se paga cuando alguien
      // no encuentra el lugar.
      if (!yaMedido) medirFuncion('coordenadas-fallo', r.motivo);
      setError(r.error);
      setAdvertencia(null);
      // B-45 — `null` cuando no es un link corto: si no se limpiara, el botón de
      // abrir quedaría colgado del intento anterior apuntando a otra cosa.
      setLinkCorto(linkCortoParaAbrir(entrada));
      return;
    }
    setError(null);
    setAdvertencia(r.advertencia);
    setLinkCorto(null);
    setTexto('');
    // El campo queda vacío, así que el próximo intento es uno nuevo aunque se
    // pegue el mismo link: sin esto, corregir a mano y volver a pegar lo mismo
    // no contaría.
    medido.current = null;
    onChange(r.geo);
  };

  const quitar = () => {
    setError(null);
    setAdvertencia(null);
    setLinkCorto(null);
    setTexto('');
    medido.current = null;
    onChange(null);
  };

  return (
    <Campo
      label="Punto exacto en el mapa"
      htmlFor={id}
      // Con el punto cargado no hay ningún control que rotular —queda la
      // lectura y los dos botones—, así que ahí el rótulo nombra al grupo. Sin
      // cargar, el input es el campo y el `<label for>` le corresponde.
      comoGrupo={geo !== null}
      ayuda={geo ? undefined : AYUDA}
      error={error ?? undefined}
      className={className}
    >
      {geo ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <p className="min-w-0 flex-1 truncate text-sm">
            <span aria-hidden>📍</span> Cargado:{' '}
            <span className="font-medium">{formatearGeo(geo)}</span>
          </p>
          {/* Verificar el punto es la mitad del valor de haberlo cargado. */}
          <a
            href={linkMapa(geo)}
            target="_blank"
            rel="noopener noreferrer"
            className={`${claseBotonSecundario} shrink-0`}
          >
            Ver en el mapa
          </a>
          <button
            type="button"
            onClick={quitar}
            className={`${claseBotonFila} shrink-0 text-acento hover:bg-acento/10`}
          >
            Quitar
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <input
            id={id}
            className={claseInput}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            // Pegar un link largo desde el teléfono es el caso principal: se
            // resuelve en el propio paste, sin obligar a apretar nada.
            onPaste={(e) => {
              const pegado = e.clipboardData.getData('text');
              if (pegado) {
                e.preventDefault();
                setTexto(pegado);
                aplicar(pegado);
              }
            }}
            onKeyDown={(e) => {
              // El input vive dentro del <form>: sin esto, Enter guarda la
              // actividad en lugar de leer la coordenada.
              if (e.key === 'Enter') {
                e.preventDefault();
                aplicar(texto);
              }
            }}
            onBlur={() => aplicar(texto)}
            placeholder="Link de Google Maps, o -34.5989, -58.4392"
            // Un link no se autocapitaliza ni se autocorrige, y en iOS el
            // teclado con "@" y "/" a mano ahorra dos toques.
            type="text"
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            onClick={() => aplicar(texto)}
            className={`${claseBotonSecundario} shrink-0`}
          >
            Usar
          </button>
        </div>
      )}

      {/*
        B-45 — la salida del link corto, a un toque.
        El mensaje de error ya explicaba cómo salir del paso ("abrilo y pegá el
        link largo"), y hacerlo a mano son cuatro pasos en el teléfono, que es
        justo donde el botón "Compartir" de Maps entrega este link. El redirect
        no se puede seguir desde el navegador (ver `linkCortoParaAbrir`), así que
        lo sigue el navegador abriéndolo, que es lo único que funciona sin una
        Function que sea un fetcher de URLs arbitrarias.

        El `href` sale de `linkCortoParaAbrir` —lista blanca de hosts y `https`
        forzado— y nunca del texto del campo, que es un pegado del portapapeles.
      */}
      {linkCorto && (
        <a
          href={linkCorto}
          target="_blank"
          rel="noopener noreferrer"
          className={`${claseBotonSecundario} self-start`}
        >
          Abrir el link ↗
        </a>
      )}

      {advertencia && (
        <p role="alert" className="text-xs font-medium text-tinta/70">
          <span aria-hidden>⚠</span> {advertencia}
        </p>
      )}
    </Campo>
  );
}
