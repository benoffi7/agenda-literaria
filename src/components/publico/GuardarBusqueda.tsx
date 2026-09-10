import { useId, useState } from 'react';

import {
  claseBotonBloque,
  claseBotonSecundario,
  claseCampo,
  claseEnlace,
  claseEtiquetaDeCampo,
} from '@/components/sitio/estilos';
import { guardarBusqueda } from '@/lib/guardadoDelNavegador';
import { rutaCanonicaDeFiltros } from '@/lib/listadoPublico';
import { LARGO_MAXIMO_NOMBRE, MAXIMO_BUSQUEDAS } from '@/lib/guardadosDelSitio';
import { RUTA_MIS_FAVORITOS } from '@/lib/rutasPublicas';

/**
 * «Guardar esta búsqueda» — B-848.
 *
 * ── Guardar un filtro es guardar una URL con un nombre ───────────────────
 * Los filtros del listado **ya viajan en la query string** (`aQuery` /
 * `desdeQuery`, §6.2), así que no hay nada que serializar: lo que se guarda es
 * la ruta que la island ya escribió en la barra de direcciones con
 * `replaceState`. Es también lo que hace que una búsqueda guardada sea idéntica
 * a una compartida por WhatsApp — el mismo formato, sin un segundo camino que
 * pueda desincronizarse.
 *
 * **Y se lee de `window.location` al guardar, y no de una prop** — pero pasando
 * por `rutaCanonicaDeFiltros`, que es la ida y vuelta `desdeQuery` → `aQuery`.
 * Pasarle los filtros y volver a llamar a `aQuery` acá sería la clase de B-88
 * —dos derivaciones del mismo formato separándose—; leer la barra a secas
 * tampoco alcanza, porque el efecto que la reescribe **saltea el primer
 * render** y en la primera visita ahí está la query como llegó, con el
 * `utm_source` de quien la haya compartido. La normalización usa las mismas dos
 * funciones que la island y vive con ellas.
 *
 * ── Solo aparece con filtros puestos ─────────────────────────────────────
 * Lo decide quien lo monta (`Buscador`), que es quien sabe. Guardar «la agenda
 * entera sin filtrar» es guardar la home, que ya está en el encabezado.
 *
 * ── El nombre se pide, no se inventa ─────────────────────────────────────
 * Un nombre derivado de los filtros —«tipo: taller · barrio: Villa Crespo»— es
 * ilegible en una lista y no dice para qué la guardó la persona («los martes»,
 * «para mamá»). Se pide en un campo, que aparece recién al tocar el botón: un
 * `<input>` permanente en el riel ocupa el lugar de un filtro.
 */

interface Props {
  /** Con `false` el control no se dibuja: es la decisión de `Buscador`. */
  hayAlgoQueGuardar: boolean;
  /** El índice todavía no llegó, o falló: no hay búsqueda que guardar. */
  deshabilitado: boolean;
}

type Estado =
  | { paso: 'cerrado' }
  | { paso: 'nombrando' }
  | { paso: 'guardada' }
  | { paso: 'error'; texto: string };

/**
 * Qué se le dice a la persona por cada motivo de rechazo.
 *
 * Los cuatro se arreglan distinto y por eso el módulo devuelve un motivo y no un
 * booleano: dos piden hacer algo, uno explica que el navegador no deja, y el
 * cuarto no debería poder pasar desde acá —la URL la escribe la propia island—
 * pero se contesta igual antes que quedar mudo.
 */
const TEXTO_DE_RECHAZO: Record<string, string> = {
  'sin-nombre': 'Poné un nombre para poder encontrarla después.',
  tope: `Ya tenés ${MAXIMO_BUSQUEDAS} búsquedas guardadas. Borrá alguna para guardar esta.`,
  almacen:
    'Tu navegador no dejó guardarla. Puede ser una ventana privada o que tenga bloqueado ' +
    'el almacenamiento de este sitio.',
  'ruta-invalida': 'No se pudo guardar esta dirección.',
};

export function GuardarBusqueda({ hayAlgoQueGuardar, deshabilitado }: Props) {
  const id = useId();
  const [estado, setEstado] = useState<Estado>({ paso: 'cerrado' });
  const [nombre, setNombre] = useState('');

  if (!hayAlgoQueGuardar) return null;

  const guardar = () => {
    /*
     * La **canónica** de lo que hay en la barra de direcciones, no la barra tal
     * cual. Casi siempre son la misma —la island reescribe la query con
     * `replaceState` en cada cambio— pero el efecto saltea el primer render, así
     * que en la primera visita lo que hay es la query **como llegó**: con un
     * `utm_source`, o con lo que venga pegado en un link de mail. El viaje de
     * ida y vuelta por `rutaCanonicaDeFiltros` deja solo lo que la island
     * escribiría, y no es una segunda derivación del formato: es **la misma**,
     * llamada desde acá. Lo señaló el `auditor-privacidad`.
     */
    const url = rutaCanonicaDeFiltros(window.location.pathname, window.location.search);
    const resultado = guardarBusqueda(nombre, url);
    if (resultado.ok) {
      setEstado({ paso: 'guardada' });
      setNombre('');
      return;
    }
    setEstado({
      paso: 'error',
      texto: TEXTO_DE_RECHAZO[resultado.motivo] ?? 'No se pudo guardar.',
    });
  };

  return (
    <div className="regla-fina mt-6 pt-4">
      {estado.paso === 'nombrando' ? (
        <>
          <label htmlFor={`${id}-nombre`} className={claseEtiquetaDeCampo}>
            Nombre de la búsqueda
          </label>
          <input
            id={`${id}-nombre`}
            type="text"
            value={nombre}
            maxLength={LARGO_MAXIMO_NOMBRE}
            placeholder="Poesía en Villa Crespo"
            onChange={(e) => setNombre(e.target.value)}
            onKeyDown={(e) => {
              // Enter guarda: el campo está solo y no hay `<form>` que lo haga.
              if (e.key === 'Enter') guardar();
              if (e.key === 'Escape') setEstado({ paso: 'cerrado' });
            }}
            className={`${claseCampo} body-md`}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button type="button" onClick={guardar} className={claseBotonBloque}>
              Guardar
            </button>
            <button
              type="button"
              onClick={() => setEstado({ paso: 'cerrado' })}
              className={`${claseBotonSecundario} body-sm`}
            >
              Cancelar
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          disabled={deshabilitado}
          onClick={() => setEstado({ paso: 'nombrando' })}
          className={`${claseBotonBloque} w-full`}
        >
          Guardar esta búsqueda
        </button>
      )}

      {/*
        El resultado va en un `aria-live`: quien usa lector de pantalla tiene que
        enterarse de que se guardó —o de por qué no— sin ir a buscarlo.
      */}
      <p aria-live="polite" className="body-sm mt-2 text-super">
        {estado.paso === 'guardada' && (
          <>
            Guardada en este navegador.{' '}
            <a href={RUTA_MIS_FAVORITOS} className={claseEnlace}>
              Ver mis búsquedas
            </a>
          </>
        )}
        {estado.paso === 'error' && estado.texto}
      </p>
    </div>
  );
}
