import { Suspense, lazy, useState } from 'react';

/**
 * El «?» de al lado del título de una sección del formulario (B-62).
 *
 * ── Por qué existe ────────────────────────────────────────────────────────
 * La guía ya se abría desde el encabezado, con el capítulo de la pantalla
 * desplegado. Eso alcanza mientras la unidad de la duda sea la pantalla, y no lo
 * es: la duda aparece **mirando «Difusión»**, no pensando en abrir la ayuda.
 * Alguien que está cargando una feria y no entiende el generador de encuentros no
 * sale a buscar el botón «Ayuda»: se queda mirando dos campos.
 *
 * ── Por qué monta su propia capa en vez de avisarle al botón del encabezado ──
 * Son dos componentes que no se ven entre sí —uno vive en el encabezado del
 * panel, el otro adentro del formulario—, y coordinarlos pedía un estado
 * compartido para abrir una capa. La capa ya sabe abrirse en un capítulo y es la
 * **misma** —el mismo `import()`, el mismo chunk, el mismo trampeo de foco—, así
 * que montarla desde acá no duplica nada: duplicaría si hubiera dos capas
 * abiertas a la vez, y no puede haberlas.
 *
 * ── Por qué no importa `ayuda.ts` ─────────────────────────────────────────
 * Son ~25 kB de texto que hoy no viajan en el chunk inicial del panel: el botón
 * del encabezado los carga recién al abrir (`BotonAyuda`, D-61). Este componente
 * está adentro del formulario, así que un import estático de `ayuda.ts` sería
 * peor que el que se evitó. Por eso viaja **el título de la sección** y la
 * resolución a capítulo la hace la capa, que ya cargó la guía para mostrarla.
 */
const CentroAyuda = lazy(() =>
  import('@/components/admin/ayuda/CentroAyuda').then((m) => ({ default: m.CentroAyuda })),
);

interface Props {
  /**
   * Título exacto de la sección. Es la llave contra `seccionFormulario` de la
   * guía, y la pasa `Seccion` desde su propio `titulo`: quien la usa no escribe
   * el string dos veces, así que no puede desincronizarse del encabezado.
   */
  seccion: string;
}

export function AyudaDeSeccion({ seccion }: Props) {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        // El texto accesible dice de qué sección habla: en el formulario hay
        // hasta diez de estos botones y «Ayuda» repetido diez veces no ubica a
        // nadie que navegue por la lista de controles.
        aria-label={`Qué es «${seccion}»`}
        className="flex size-8 shrink-0 items-center justify-center rounded-full border border-borde bg-white text-sm text-tinta/60 hover:bg-black/[0.03]"
      >
        <span aria-hidden>?</span>
      </button>

      {abierto && (
        <Suspense fallback={null}>
          <CentroAyuda
            contexto="formulario"
            seccion={seccion}
            idsSinLeer={[]}
            onCerrar={() => setAbierto(false)}
            onNovedadesLeidas={() => {}}
          />
        </Suspense>
      )}
    </>
  );
}
