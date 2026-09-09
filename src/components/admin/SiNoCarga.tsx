import { Component, type ErrorInfo, type ReactNode } from 'react';
import { claseBotonPrimario } from '@/components/campos/Campo';
import { MENSAJE_PESTANIA_VIEJA, esFalloDeCarga } from '@/lib/carga-diferida';

/**
 * **La red para cuando una vista del panel no llega** — reporte del dueño
 * (2026-09-07).
 *
 * El panel tiene **diez puertas de carga diferida** —ocho vistas que pasan por
 * `diferido()` en `AdminApp`, el SDK de Storage de la subida, y el centro de
 * ayuda, que se monta desde **dos** lugares— y una pestaña que quedó abierta desde
 * antes de un deploy apunta a chunks que Hosting ya borró. Sin esto, el `import()`
 * que falla adentro de `lazy` **tira hacia arriba y React desmonta el árbol**: el
 * panel queda en blanco, sin un mensaje y sin nada que tocar.
 *
 * La de la subida se arregló donde ocurre —tiene su propio `try`, porque ahí el
 * error no pasa por el render—. Las otras nueve las cubre este límite, con el
 * mismo mensaje y la misma acción.
 *
 * **La cuenta decía «seis» y estaba mal, y eso costó un P1:** el `lazy` del centro
 * de ayuda que vive en el encabezado quedaba **fuera** de todo límite, así que
 * tocar «Ayuda» en una pestaña vieja dejaba el panel en blanco igual — la falla
 * que este archivo venía a cerrar, por otra puerta. Lo encontraron los dos
 * auditores, y ahora `tests/carga-diferida.test.ts` lo verifica **de clase**: todo
 * archivo del panel que declare un `lazy` tiene que envolverlo.
 *
 * ── Por qué una clase, y por qué no atrapa todo ───────────────────────────
 * Un límite de error en React **tiene** que ser una clase: no hay hook que reciba
 * un error de render de un hijo. Es el único componente de clase del panel y por
 * eso vive en su propio archivo.
 *
 * **Solo atrapa el fallo de carga.** Cualquier otro error se vuelve a tirar, y eso
 * es deliberado: un límite que se queda con todo convierte cualquier bug de render
 * en «recargá la página», que es falso y además esconde el error de la consola y
 * del reporte. Lo que no es un módulo que no llegó tiene que seguir rompiendo
 * ruidosamente.
 */
interface Props {
  children: ReactNode;
}

interface Estado {
  noCargo: boolean;
}

export class SiNoCarga extends Component<Props, Estado> {
  state: Estado = { noCargo: false };

  static getDerivedStateFromError(e: unknown): Estado | null {
    // `null` deja el estado como estaba y el error sigue subiendo: ver el
    // docblock — un límite que se queda con todo miente.
    return esFalloDeCarga(e) ? { noCargo: true } : null;
  }

  componentDidCatch(e: unknown, info: ErrorInfo): void {
    if (esFalloDeCarga(e)) return;
    /*
     * Lo que no es un fallo de carga se vuelve a tirar **en un turno aparte**: un
     * `throw` acá adentro lo volvería a atrapar el mismo límite. Con `setTimeout`
     * el error llega al `window.onerror`, o sea a la consola y a donde lo mire
     * quien esté debuggeando, que es lo que corresponde a un bug de verdad.
     */
    setTimeout(() => {
      throw e;
    });
    void info;
  }

  render(): ReactNode {
    if (!this.state.noCargo) return this.props.children;

    return (
      <div role="alert" className="mx-auto max-w-md px-segura py-16 text-center">
        <h2 className="font-serif text-lg font-semibold">No se pudo abrir esta parte</h2>
        <p className="mt-2 text-sm text-tinta/70">{MENSAJE_PESTANIA_VIEJA}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className={`${claseBotonPrimario} mt-6`}
        >
          Recargar ahora
        </button>
      </div>
    );
  }
}
