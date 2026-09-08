/**
 * **El límite de error que evita que el panel quede en blanco** — reporte del
 * dueño (2026-09-07).
 *
 * El panel tiene diez puertas de carga diferida —este límite cubre nueve; la de la
 * subida de imágenes tiene su propio `try`— y una pestaña abierta desde antes de
 * un deploy apunta a chunks que Hosting ya borró. Un `import()` que falla adentro
 * de `lazy` **tira hacia arriba y React desmonta el árbol**: sin este límite, el
 * panel queda en blanco, sin mensaje y sin nada que tocar.
 *
 * Necesita DOM porque lo que se verifica es una consecuencia del render, y las dos
 * mitades son igual de importantes: que **atrape** el fallo de carga, y que **no
 * atrape nada más** — un límite que se queda con todo convierte cualquier bug en
 * «recargá la página», que es falso y además esconde el error.
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SiNoCarga } from '@/components/admin/SiNoCarga';

afterEach(cleanup);

/** React escribe el error en la consola además de propagarlo. No es señal de nada. */
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

const QueTira = ({ error }: { error: unknown }): never => {
  throw error;
};

describe('SiNoCarga atrapa «el módulo no llegó»', () => {
  it('muestra el motivo y el botón en vez de dejar la pantalla vacía', () => {
    render(
      <SiNoCarga>
        <QueTira
          error={
            new TypeError(
              'Failed to fetch dynamically imported module: https://x/_astro/lista.Bq3x9.js',
            )
          }
        />
      </SiNoCarga>,
    );

    const aviso = screen.getByRole('alert');
    expect(aviso.textContent).toMatch(/pestaña/);
    expect(aviso.textContent).toMatch(/[Rr]ecarg/);
    expect(screen.getByRole('button', { name: 'Recargar ahora' })).toBeTruthy();
    /*
     * **Y NO promete el borrador**, que es la corrección del
     * `auditor-privacidad`: este límite envuelve las diez puertas de carga del
     * panel y **solo el formulario de actividad tiene autoguardado**. El de
     * reportes no —y es el origen de B-191, «reporté algo y todo lo que escribí se
     * borró»— así que la frase acá sería una promesa falsa justo ahí. La dice el
     * editor de imágenes, que vive adentro del formulario.
     */
    expect(aviso.textContent, 'promete el borrador donde puede no haberlo').not.toMatch(
      /guardado en este navegador/,
    );
  });

  it('y con el hijo sano no se mete en el medio', () => {
    render(
      <SiNoCarga>
        <p>El listado</p>
      </SiNoCarga>,
    );
    expect(screen.getByText('El listado')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('y NO atrapa nada más, que es la otra mitad', () => {
  it('un error de render cualquiera sigue rompiendo', () => {
    /*
     * **Deliberado.** Un límite que se queda con todo convierte un bug de render
     * en «recargá la página»: la persona recarga, el bug sigue, y el error ya no
     * está ni en la consola. Lo que no es un módulo que no llegó tiene que seguir
     * rompiendo ruidosamente.
     *
     * MUTACIÓN PROBADA: hacer que `getDerivedStateFromError` devuelva
     * `{ noCargo: true }` sin consultar `esFalloDeCarga` deja este caso en rojo.
     */
    expect(() =>
      render(
        <SiNoCarga>
          <QueTira error={new TypeError('actividades.map is not a function')} />
        </SiNoCarga>,
      ),
    ).toThrow(/is not a function/);
  });
});
