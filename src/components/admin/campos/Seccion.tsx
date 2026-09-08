import { useEffect, useId, useState, type ReactNode } from 'react';
import { AyudaDeSeccion } from '@/components/admin/ayuda/AyudaDeSeccion';
import { medirSeccion } from '@/lib/analytics';
import type { AlmacenLocal } from '@/lib/formulario/borradoresDelNavegador';

interface Props {
  titulo: string;
  descripcion?: string;
  /** Las secciones opcionales arrancan colapsadas (§11: acordeón "opcional"). */
  colapsable?: boolean;
  abiertaPorDefecto?: boolean;
  insignia?: string;
  /**
   * Ancla en el DOM, para que la barra de acciones pueda llevar hasta acá
   * (B-184). Es el `id` de la sección en `lib/formulario/camposFaltantes.ts`.
   */
  ancla?: string;
  /**
   * Contador de pedidos de apertura. Cada vez que sube, la sección se abre.
   *
   * B-184 — un campo rechazado adentro de un acordeón cerrado no está en ninguna
   * parte de la pantalla: el contador decía "3 campos" y se veían cero. Es un
   * contador y no un booleano a propósito, para que un segundo pedido vuelva a
   * abrirla después de que alguien la cerró a mano.
   */
  pedidoDeApertura?: number;
  /**
   * Clave con la que esta sección **recuerda** si quedó abierta o cerrada
   * (B-193). Sin clave no recuerda nada, que es el comportamiento de siempre.
   */
  recuerdaComo?: string;
  /**
   * B-62 — muestra el «?» que abre la guía en el capítulo de esta sección.
   *
   * Es opt-in y no automático por dos razones. Una: la guía **se dibuja a sí
   * misma con `Seccion`** (un acordeón por capítulo), así que un «?» automático
   * pondría un botón de ayuda adentro de la ayuda. Y dos: no toda sección del
   * panel es una sección del formulario —el tablero y el formulario de reportes
   * también usan este componente— y solo las del formulario tienen capítulo.
   *
   * No lleva el id del capítulo: la llave es el `titulo` de esta misma sección,
   * que ya es el vínculo que la guía declara (`seccionFormulario`). Así el string
   * se escribe una vez.
   */
  conAyuda?: boolean;
  children: ReactNode;
}

/**
 * ── B-193 · el acordeón se acuerda de cómo lo dejaron ─────────────────────
 *
 * El reporte pedía una vista previa del evento que **ya existía**: última
 * sección, colapsada, y desde el listado sin ninguna puerta. O sea que el
 * problema no era la función sino encontrarla, y explicarlo mejor en la guía no
 * es el arreglo (la guía ya lo explicaba).
 *
 * Que nazca abierta ataca eso, pero abrirla siempre castiga a quien ya la
 * conoce y la cerró a propósito. Con memoria, las dos cosas: la primera vez está
 * a la vista, y después vale lo que la persona decidió.
 *
 * Va por sección y **no** por actividad: es una preferencia de quien carga, no
 * un dato de la actividad. Lo único que se guarda es `abierta`/`cerrada`, así
 * que no hay nada del §5.1 en juego —a diferencia del borrador local, que sí
 * guarda contenido y por eso lleva la huella del admin en la clave.
 */
const PREFIJO_SECCION = 'agenda:seccion:';

/**
 * Lo mínimo de `localStorage` que hace falta. Es un `Pick` del puerto que ya
 * define `borradoresDelNavegador.ts` —importado como tipo, así que no entra al
 * grafo de imports del bundle (B-09)— para no inventar un segundo vocabulario
 * para la misma idea.
 */
export type AlmacenDeSecciones = Pick<AlmacenLocal, 'getItem' | 'setItem'>;

/**
 * Cómo quedó esta sección la última vez, o `null` si no hay memoria.
 *
 * `null` y `false` no son lo mismo y de ahí el tipo: «nunca se tocó» cae al
 * default de la sección, «se cerró» gana sobre el default.
 */
export const leerSeccionRecordada = (
  almacen: AlmacenDeSecciones | null,
  clave?: string,
): boolean | null => {
  if (!almacen || !clave) return null;
  try {
    const guardado = almacen.getItem(`${PREFIJO_SECCION}${clave}`);
    return guardado === 'abierta' ? true : guardado === 'cerrada' ? false : null;
  } catch {
    // Un almacén que tira no puede romper el formulario: se cae al default.
    return null;
  }
};

export const recordarSeccion = (
  almacen: AlmacenDeSecciones | null,
  clave: string | undefined,
  abierta: boolean,
): void => {
  if (!almacen || !clave) return;
  try {
    almacen.setItem(`${PREFIJO_SECCION}${clave}`, abierta ? 'abierta' : 'cerrada');
  } catch {
    // Sin memoria se pierde la preferencia, no la sección.
  }
};

/**
 * El `localStorage` del navegador, o `null` si no se puede usar. Acceder **tira**
 * —no devuelve null— en un iframe con cookies bloqueadas y en algunos modos
 * privados, así que el acceso va adentro del try/catch y no solo la escritura.
 */
const almacenDelNavegador = (): AlmacenDeSecciones | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
};

/** ¿Con qué estado arranca la sección? Puro, para poder testear los tres casos. */
export const seccionArrancaAbierta = ({
  colapsable,
  abiertaPorDefecto,
  recordada,
}: {
  colapsable: boolean;
  abiertaPorDefecto: boolean;
  recordada: boolean | null;
}): boolean => (colapsable ? (recordada ?? abiertaPorDefecto) : true);

export function Seccion({
  titulo,
  descripcion,
  colapsable = false,
  abiertaPorDefecto = true,
  insignia,
  ancla,
  pedidoDeApertura = 0,
  recuerdaComo,
  conAyuda = false,
  children,
}: Props) {
  const [abierta, setAbierta] = useState(() =>
    seccionArrancaAbierta({
      colapsable,
      abiertaPorDefecto,
      recordada: leerSeccionRecordada(almacenDelNavegador(), recuerdaComo),
    }),
  );
  const idPanel = useId();

  useEffect(() => {
    if (pedidoDeApertura > 0) setAbierta(true);
  }, [pedidoDeApertura]);

  const encabezado = (
    <div className="flex min-w-0 flex-1 items-center gap-3 text-left">
      {colapsable && (
        <span
          aria-hidden
          className={`shrink-0 text-tinta/40 transition-transform ${abierta ? 'rotate-90' : ''}`}
        >
          ▶
        </span>
      )}
      <div className="min-w-0 flex-1">
        <h2 className="font-serif text-base font-semibold">{titulo}</h2>
        {descripcion && <p className="text-xs text-tinta/55">{descripcion}</p>}
      </div>
      {insignia && (
        <span className="shrink-0 rounded-full bg-acento/10 px-2 py-0.5 text-xs text-acento">
          {insignia}
        </span>
      )}
    </div>
  );

  // El `scroll-mt` deja aire arriba cuando se scrollea hasta acá desde el
  // mensaje de campos faltantes de la barra.
  return (
    <section id={ancla} className="scroll-mt-4 rounded-lg border border-borde bg-white/60">
      {/*
        B-62 — el «?» va **al lado** del disparador del acordeón y no adentro:
        un <button> anidado dentro de otro <button> no es HTML válido, y el
        navegador desarma el markup de formas que no se ven hasta que alguien
        navega con teclado.
      */}
      <div className="flex items-center">
        {colapsable ? (
          // Un <button> real y no un div con onClick: se abre con teclado, lo
          // anuncia el lector de pantalla, y en mobile el blanco táctil ocupa
          // todo el ancho del encabezado en lugar de solo el texto.
          <button
            type="button"
            aria-expanded={abierta}
            aria-controls={idPanel}
            onClick={() => {
              const proxima = !abierta;
              // Qué acordeones se despliegan de verdad. Va el slug del título,
              // que es un literal del código (docs/09-analitica.md).
              medirSeccion(titulo, proxima);
              // Lo que se recuerda es el click, no el `pedidoDeApertura`: que la
              // barra abra una sección para mostrar un campo rechazado (B-184) no
              // es una preferencia de nadie.
              recordarSeccion(almacenDelNavegador(), recuerdaComo, proxima);
              setAbierta(proxima);
            }}
            className="flex min-h-touch min-w-0 flex-1 items-center px-4 py-3"
          >
            {encabezado}
          </button>
        ) : (
          <header className="flex min-w-0 flex-1 items-center px-4 py-3">{encabezado}</header>
        )}
        {conAyuda && (
          <div className="shrink-0 pr-3">
            <AyudaDeSeccion seccion={titulo} />
          </div>
        )}
      </div>
      {abierta && (
        <div
          id={idPanel}
          /*
            `@container` — B-814. El reparto de columnas de las secciones
            pregunta por el ancho de **este** cuerpo y no por el del viewport, y
            es lo que hace posible la vista celular: el mismo monitor de 1920px
            pinta el formulario a 896px cuando la vista elegida es «celular», y
            un `xl:grid-cols-3` de viewport repartiría en tres dentro de esos
            896px — tres columnas de 290px, que es peor que dos de 430.

            Va acá y no en cada grilla: una grilla no puede consultarse a sí
            misma (`container-type` habilita la consulta a los **descendientes**),
            así que el contenedor tiene que ser un ancestro. El cuerpo de la
            sección es el ancestro común de todas, así que es una línea y no
            nueve.
          */
          className="@container border-t border-borde px-3 py-4 sm:px-4">
          {children}
        </div>
      )}
    </section>
  );
}
