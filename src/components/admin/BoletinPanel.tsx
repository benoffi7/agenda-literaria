import { useEffect, useMemo, useRef, useState } from 'react';
import { claseBotonSecundario } from '@/components/campos/Campo';
import {
  boletinSemanal,
  htmlDelBoletin,
  textoDelBoletin,
  type Boletin,
} from '@/lib/boletinSemanal';
import { mapaDeEtiquetas } from '@/lib/listadoPublico';
import { fechaCompleta, hora } from '@/lib/fechasPublicas';
import { RUTA_SUSCRIBIRSE } from '@/lib/rutasPublicas';
import { LISTA_DE_CORREO } from '@/lib/enlaces';
import type { Indice } from '@/lib/eventsJson';

/**
 * **El borrador del correo semanal** — B-1230.
 *
 * Todo el criterio vive en `src/lib/boletinSemanal.ts`, que es puro y está
 * testeado: acá adentro no se decide qué entra ni cómo se escribe. Es la misma
 * división que `TextoRedes` (B-95) y por el mismo motivo — las reglas del §5.1
 * no pueden vivir en un `.tsx`, donde ningún test las puede ejecutar.
 *
 * ── Por qué esta pantalla lee el sitio y no Firestore ─────────────────────
 * Es **D-801**, y es la decisión que hace que esta pantalla sea la única del
 * panel que no toca la base. El borrador se arma desde `/events.json`, que es lo
 * que el sitio publica: lo que se anuncia y lo que se puede abrir son por
 * construcción la misma lista, y ningún campo del §5.1 está en la mano de este
 * módulo. El costo es que el borrador está tan fresco como el último build (§8),
 * y por eso la pantalla **dice de cuándo es** en vez de dejarlo implícito.
 *
 * ── Y por qué no manda nada ───────────────────────────────────────────────
 * **D-800.** Se copia y se pega en Mailchimp. La continuación exacta de B-847:
 * este repo no tiene una credencial de Mailchimp y no la va a tener.
 */

/** El estado de la lectura del índice publicado. */
type Carga =
  | { estado: 'cargando' }
  | { estado: 'listo'; indice: Indice }
  | { estado: 'error' };

const claseCaja = 'rounded-md border border-borde bg-white px-3 py-2 text-sm';

/**
 * Una caja de texto de solo lectura con su botón de copiar.
 *
 * **El botón degrada**, igual que el de `TextoRedes`: `navigator.clipboard` no
 * existe en un contexto no seguro y puede fallar aunque exista. Cuando eso pasa
 * se selecciona el texto y se dice qué hacer — lo que no puede pasar es que el
 * trabajo quede inalcanzable porque el navegador no colaboró.
 */
function ParaCopiar({
  etiqueta,
  ayuda,
  texto,
  filas,
}: {
  etiqueta: string;
  ayuda: string;
  texto: string;
  filas: number;
}) {
  const [copia, setCopia] = useState<'nada' | 'copiado' | 'manual'>('nada');
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setCopia('nada'), [texto]);

  const copiar = async () => {
    if (!texto) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('sin portapapeles');
      await navigator.clipboard.writeText(texto);
      setCopia('copiado');
    } catch {
      area.current?.focus();
      area.current?.select();
      setCopia('manual');
    }
  };

  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-serif text-base font-semibold">{etiqueta}</h2>
      <p className="text-xs text-tinta/55">{ayuda}</p>
      <textarea
        ref={area}
        readOnly
        aria-label={etiqueta}
        value={texto}
        rows={filas}
        className="w-full min-w-0 rounded-md border border-borde bg-papel px-3 py-2 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap"
        onFocus={(e) => e.currentTarget.select()}
      />
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={claseBotonSecundario} onClick={copiar}>
          Copiar
        </button>
        <p aria-live="polite" className="text-xs text-tinta/60">
          {copia === 'copiado' && 'Copiado.'}
          {copia === 'manual' &&
            'No pude usar el portapapeles: quedó seleccionado, copialo con Ctrl+C (⌘+C en Mac).'}
          {copia === 'nada' && `${texto.length} caracteres`}
        </p>
      </div>
    </section>
  );
}

/** La vista previa de las filas, para revisar antes de copiar. */
function VistaPrevia({ boletin }: { boletin: Boletin }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-serif text-base font-semibold">Lo que va a decir</h2>
      {boletin.dias.map((dia) => (
        <div key={dia.clave} className="flex flex-col gap-1">
          <h3 className="border-b border-borde pb-1 text-xs font-bold tracking-wider text-tinta/70 uppercase">
            {dia.rotulo}
          </h3>
          <ul className="flex flex-col gap-2 py-1">
            {dia.encuentros.map((e) => (
              <li key={e.clave}>
                <a href={e.url} target="_blank" rel="noreferrer" className="text-sm font-semibold">
                  {e.titulo}
                </a>
                <p className="text-xs text-tinta/60">
                  {[e.hora, e.tipoEtiqueta, e.lugar, e.arancel].filter(Boolean).join(' · ')}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

export function BoletinPanel() {
  const [carga, setCarga] = useState<Carga>({ estado: 'cargando' });

  useEffect(() => {
    let vigente = true;
    /*
     * `cache: 'no-store'` y una query única: el `events.json` lo cachea el CDN
     * con la versión del build como clave, y acá no hay versión que pasar —lo
     * que se quiere es justamente el último. Un borrador armado sobre un índice
     * cacheado de hace dos días anunciaría la semana pasada.
     */
    fetch(`/events.json?t=${Date.now()}`, { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<Indice>;
      })
      .then((indice) => vigente && setCarga({ estado: 'listo', indice }))
      .catch(() => vigente && setCarga({ estado: 'error' }));
    return () => {
      vigente = false;
    };
  }, []);

  // El reloj se lee acá y entra como parámetro (`docs/05-patrones.md`): el módulo
  // puro no llama a `Date.now()`, así que sus tests no dependen de qué día es hoy.
  const boletin = useMemo(
    () =>
      carga.estado === 'listo'
        ? boletinSemanal(carga.indice, new Date(), mapaDeEtiquetas(carga.indice.opciones))
        : null,
    [carga],
  );

  if (carga.estado === 'cargando') {
    return <p className="p-8 text-sm text-tinta/50">Leyendo lo que hay publicado…</p>;
  }

  if (carga.estado === 'error') {
    return (
      <p role="alert" className={`${claseCaja} border-acento/30 bg-acento/5 text-acento`}>
        No pude leer lo que hay publicado en el sitio. Probá de nuevo en un rato: el borrador se
        arma con <code>/events.json</code>, que se rehace con cada build.
      </p>
    );
  }

  const generadoEn = new Date(carga.indice.generadoEn);

  return (
    <div className="flex flex-col gap-6">
      <p className={`${claseCaja} text-tinta/65`}>
        Esto se arma con lo que el sitio <strong>ya publica</strong>, del último build (
        {fechaCompleta(generadoEn)}, {hora(generadoEn)}). Una actividad que guardaste recién todavía
        no está acá: aparece cuando el sitio se rehace, que tarda unos minutos.
      </p>

      {LISTA_DE_CORREO === null && (
        <p className={`${claseCaja} border-amber-300 bg-amber-50 text-amber-900`}>
          <strong>La lista de correo todavía no existe</strong>, así que la sección para anotarse no
          se dibuja en <a href={RUTA_SUSCRIBIRSE}>/suscribirse</a> y no hay a quién mandarle esto.
          Los pasos para crearla están en la documentación de operación, en «Activar el correo
          semanal».
        </p>
      )}

      {boletin === null ? (
        <p className={`${claseCaja} text-tinta/65`}>
          <strong>Esta semana no hay ningún encuentro publicado</strong>, así que no hay correo que
          mandar. Es lo que <a href={RUTA_SUSCRIBIRSE}>/suscribirse</a> promete: la semana que no
          hay nada que valga la pena, no sale.
        </p>
      ) : (
        <>
          <ParaCopiar
            etiqueta="Asunto"
            ayuda="Va en «Subject» de la campaña. Dice el número porque es lo que hace que se abra."
            texto={boletin.asunto}
            filas={1}
          />
          <ParaCopiar
            etiqueta="Vista previa"
            ayuda="El texto que se ve al lado del asunto en la bandeja, antes de abrir («Preview text»)."
            texto={boletin.preencabezado}
            filas={2}
          />

          <VistaPrevia boletin={boletin} />

          <ParaCopiar
            etiqueta="El cuerpo, en HTML"
            ayuda="Pegalo en un bloque de código de la campaña. Los estilos van adentro de cada etiqueta a propósito: Gmail borra las hojas de estilo."
            texto={htmlDelBoletin(boletin)}
            filas={16}
          />
          <ParaCopiar
            etiqueta="El cuerpo, en texto plano"
            ayuda="Va en la pestaña de texto plano. Si no se pega, Mailchimp arma una sola y le salen los links repetidos."
            texto={textoDelBoletin(boletin)}
            filas={16}
          />

          <p className={`${claseCaja} text-tinta/60`}>
            Esto es un borrador: la curaduría es tuya. Sacá lo que no quieras, cambiá el orden,
            escribí arriba de todo lo que quieras contar. Lo que se arma solo es la parte aburrida —
            los horarios, los lugares y los links, que es donde se cuelan los errores.
          </p>
        </>
      )}
    </div>
  );
}
