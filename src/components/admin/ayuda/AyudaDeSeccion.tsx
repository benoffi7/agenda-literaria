import { Suspense, lazy, useState } from 'react';
import { SiNoCarga } from '@/components/admin/SiNoCarga';

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

/**
 * Lo que este botón NO hace con las novedades, dicho para que no se lea como un
 * olvido: abre la capa con `idsSinLeer: []`, así que **entra siempre por la
 * guía** —que es lo que se pidió— y no marca nada como leído por abrirse.
 *
 * Si desde acá alguien toca la pestaña «Novedades», la capa sí las marca leídas
 * (eso vive en `CentroAyuda` y está bien: verlas es haberlas visto), pero **el
 * número del botón del encabezado no se apaga hasta el próximo montaje**: ese
 * contador lo calcula `BotonAyuda` una vez, y los dos componentes no se ven entre
 * sí. Es un número de más durante una sesión, se arregla solo al recargar, y
 * cerrarlo del todo pedía un estado compartido para una capa que ya sabe abrirse
 * sola. Si alguna vez molesta, el patrón del repo para eso es un store de módulo
 * como `formulario-sucio.ts`.
 */
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
        // `min-h-touch min-w-touch` y no un `size-8`: la regla del panel es que un
        // blanco táctil son 44px, y este botón vive pegado al encabezado del
        // acordeón —que es otro control— así que un blanco chico se erra hacia el
        // vecino. La única excepción escrita a esa regla es `claseEnlaceCelda`, y
        // no hace falta una segunda.
        className="flex min-h-touch min-w-touch shrink-0 items-center justify-center rounded-full border border-borde bg-white text-sm text-tinta/60 hover:bg-black/[0.03]"
      >
        <span aria-hidden>?</span>
      </button>

      {abierto && (
        /*
          **`SiNoCarga` acá también, aunque este punto ya estuviera cubierto** —
          B-805. Este `lazy()` se monta adentro del formulario, o sea debajo del
          límite que `diferido()` ya pone en `AdminApp`; el que estaba **afuera**
          era el gemelo de `BotonAyuda`, en el encabezado, y ése era el P1.

          Se envuelve igual por dos razones: el chequeo de clase pide que **todo**
          archivo que declare un `lazy` lo envuelva —así el que se agregue mañana
          no depende de dónde lo monten— y un límite más cerca del `lazy` deja el
          cartel en la sección en vez de reemplazar la pantalla entera.
        */
        <SiNoCarga>
          <Suspense fallback={null}>
            <CentroAyuda
              contexto="formulario"
              seccion={seccion}
              idsSinLeer={[]}
              onCerrar={() => setAbierto(false)}
              onNovedadesLeidas={() => {}}
            />
          </Suspense>
        </SiNoCarga>
      )}
    </>
  );
}
