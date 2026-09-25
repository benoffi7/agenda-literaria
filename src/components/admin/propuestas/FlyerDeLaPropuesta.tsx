import { useEffect, useState } from 'react';
import { claseBotonSecundario } from '@/components/campos/Campo';
import { esFalloDeCarga } from '@/lib/carga-diferida';

/*
 * M-17 — el flyer de una propuesta, mirable y bajable desde la bandeja. Salió
 * entero de `PropuestasPanel.tsx`: la bandeja lo monta por ficha y le pasa
 * `onEstado` para saber si la foto se pudo ver (B-926).
 */

/**
 * **El flyer que mandaron, mirable desde la bandeja** — B-830 paso 8, DEC-11.
 *
 * La URL se pide al montar y no viene en el documento: el objeto vive en
 * `propuestas/`, que `storage.rules` deja leer **solo a un admin** (decisión del
 * dueño del 2026-09-09, desviándose del «`get` en `false`» del PRD, porque sin
 * ver la foto no se puede decidir).
 *
 * El `import()` es el de siempre: `subir-imagen` es el único dueño de
 * `firebase/storage` y traerlo al árbol estático deshace el corte del bundle
 * (B-09/D-51).
 *
 * Los dos fallos esperables se muestran como texto y no como imagen rota: sin
 * sesión (que no debería pasar acá) y **objeto que ya no está**, que es
 * exactamente lo que le pasa a una propuesta rechazada.
 */
export function FlyerDeLaPropuesta({
  storagePath,
  onEstado,
}: {
  storagePath: string;
  /**
   * **Si la foto se pudo mostrar o no** — B-926, hallazgo del pase de auditoría.
   *
   * Lo necesita el paso de decisión, y el motivo es el argumento entero del
   * ítem: saltear la verificación de B-863 se justifica porque «la pregunta ya
   * la contestó una persona **mirando** la foto». Si la foto no se pudo mostrar,
   * esa frase deja de ser cierta y lo que queda es una persona que clickeó — que
   * no es lo mismo, y es la diferencia sobre la que descansa un borrado
   * irreversible.
   */
  onEstado: (sePudoVer: boolean) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [fallo, setFallo] = useState<'chunk' | 'objeto' | null>(null);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const { urlDeImagenDePropuesta } = await import('@/lib/subir-imagen');
        const u = await urlDeImagenDePropuesta(storagePath);
        /*
         * **No se avisa acá que la foto se vio, y es el punto entero** — B-926.
         * Que `getDownloadURL` haya resuelto dice que hay una URL, no que el
         * navegador haya pintado algo: un `<img>` que 404ea después (objeto
         * borrado en la carrera, red caída, bloqueador de contenido) dejaría al
         * admin mirando el ícono roto con «No usarla» disponible. La señal sale
         * del `onLoad`/`onError` del propio `<img>`, más abajo.
         */
        if (vivo) setUrl(u);
      } catch (e) {
        /*
         * Las dos causas se distinguen porque se arreglan distinto: si el chunk
         * no llegó (pestaña vieja después de un deploy), recargar alcanza; si
         * Storage dijo que no, la imagen ya no está. Es la misma puerta que
         * `GaleriaEditor` y la que `tests/carga-diferida.test.ts` vigila para
         * todo `await import()` del panel.
         */
        if (vivo) {
          setFallo(esFalloDeCarga(e) ? 'chunk' : 'objeto');
          onEstado(false);
        }
      }
    })();
    return () => {
      vivo = false;
    };
    // `onEstado` queda fuera de las dependencias a propósito: viene de un
    // `useState` del padre y es estable, y meterla haría reejecutar el fetch en
    // cada render del padre — una lectura de Storage por cada tecla del motivo
    // de rechazo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storagePath]);

  if (fallo === 'chunk') {
    return (
      <span className="text-tinta/65">
        No se pudo cargar esa parte del panel. Recargá la página para ver la imagen.
      </span>
    );
  }
  if (fallo === 'objeto') {
    return (
      <span className="text-tinta/65">
        La imagen que subieron ya no está (se borra al rechazar la propuesta).
      </span>
    );
  }
  if (!url) return <span className="text-tinta/65">Trayendo la imagen…</span>;

  return (
    <div className="flex flex-col items-start gap-2">
      <a href={url} target="_blank" rel="noreferrer" className="inline-block">
        <img
          src={url}
          /*
           * El texto alternativo no puede salir del título: es texto de un
           * tercero y describiría la actividad, no la foto. Lo que le sirve a
           * quien escucha la pantalla es qué es esto y de quién vino.
           */
          alt="El flyer que mandaron con esta propuesta"
          /*
           * **Acá está la garantía de «se pudo mirar»**, y no en la promesa que
           * trajo la URL. Mientras ninguno de los dos haya disparado, el estado
           * queda `undefined` y el gate del padre (`=== true`) esconde «No
           * usarla»: el default es no ofrecer el borrado.
           */
          onLoad={() => onEstado(true)}
          onError={() => onEstado(false)}
          loading="lazy"
          className="max-h-40 rounded-md border border-borde"
        />
      </a>
      <BajarElFlyer url={url} />
    </div>
  );
}

/**
 * **Bajar el flyer al disco** — B-926 (a), la primera de las cuatro opciones.
 *
 * ── Por qué existe, y es el punto del ítem ────────────────────────────────
 * **El único momento en que esta foto existe y alguien la está mirando es esta
 * pantalla.** Al aceptar la propuesta, `borrarImagenAlCerrar` borra el original
 * de `propuestas/` (B-863); al rechazarla, también. Sin un botón acá, la única
 * forma de conservarla es acordarse de abrirla en otra pestaña y guardarla a
 * mano antes de decidir — o sea, acordarse de algo que la pantalla no pide.
 *
 * ── Por qué NO alcanza un `<a download>` sobre la URL ─────────────────────
 * Es lo que el ítem del backlog proponía («la descarga es un `<a download>`
 * sobre la URL que el panel ya trae») y **no funciona**: el atributo `download`
 * se **ignora** cuando el destino es de otro origen, y la URL de Storage lo es
 * (`firebasestorage.googleapis.com`). El resultado sería el mismo link que ya
 * está arriba —abre la imagen en una pestaña— con un botón que promete otra
 * cosa. Es la clase de promesa que no se cumple y nadie reporta, porque «se
 * abrió algo» se parece bastante a que funcionó.
 *
 * Lo que sí funciona es traer los bytes y armar un `blob:` del **propio**
 * origen, que es donde `download` sí manda.
 *
 * ⚠️ **B-1235: en producción esto hoy NO anda, y el párrafo que estaba acá
 * afirmaba lo contrario** («la URL de descarga responde CORS para el `GET` con
 * su token»). Es falso mientras el bucket no tenga CORS configurado: se miró el
 * 2026-09-23 y la respuesta con los bytes (`alt=media`) no trae
 * `Access-Control-Allow-Origin` para ningún origen —la metadata sí, y por eso
 * confunde—. El emulador no aplica CORS de bucket, así que ahí anda. Es la misma
 * causa que la promoción de la imagen; el arreglo es el `cors.json` del repo
 * aplicado al bucket. Mientras tanto, el fallo de abajo manda a abrirla en otra
 * pestaña, que sí funciona (navegar no pide CORS).
 *
 * `URL.revokeObjectURL` en el mismo tick: el blob queda retenido en memoria
 * hasta que se revoque, y una bandeja con veinte propuestas abiertas se las
 * acumularía todas.
 */
function BajarElFlyer({ url }: { url: string }) {
  const [bajando, setBajando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  const bajar = async () => {
    setBajando(true);
    setFallo(null);
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const blob = await r.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      /*
       * El nombre **no sale del título de la propuesta**: es texto de un tercero
       * y terminaría en el nombre de un archivo del disco de quien revisa. Sale
       * del tipo del blob, que es lo único que describe al archivo y no a nadie.
       */
      const ext = (blob.type.split('/')[1] ?? 'jpg').replace(/[^a-z0-9]/gi, '');
      a.download = `flyer-de-propuesta.${ext || 'jpg'}`;
      a.click();
      URL.revokeObjectURL(href);
    } catch (e: unknown) {
      /*
       * El fallo se dice y no se traga: quien iba a bajar la foto antes de
       * descartarla necesita saber que **no la bajó**, porque el paso siguiente
       * la borra. Un botón que falla en silencio acá pierde la foto de verdad.
       */
      setFallo(
        `No se pudo bajar (${e instanceof Error ? e.message : 'error desconocido'}). ` +
          'Abrila en otra pestaña y guardala a mano antes de seguir.',
      );
    } finally {
      setBajando(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void bajar()}
        disabled={bajando}
        className={`${claseBotonSecundario} disabled:opacity-50`}
      >
        {bajando ? 'Bajando…' : 'Bajar la imagen'}
      </button>
      {fallo && (
        <p role="alert" className="text-xs text-acento">
          {fallo}
        </p>
      )}
    </>
  );
}
