/**
 * `FormularioPublico` renderizado de verdad — B-830, paso 9.
 *
 * **Por qué éste sí necesita DOM.** Es el único formulario del sitio público y el
 * único que escribe en Firestore desde el navegador de un visitante, y las cuatro
 * cosas que lo hacen aceptable son **cableado**: el honeypot, el tiempo mínimo,
 * que la validación corra antes de escribir, y que el módulo que habla con
 * Firebase se cargue **en el submit** y no antes. Ninguna se puede verificar
 * leyendo el fuente sin arriesgar un falso verde — que es la lección de B-202.
 *
 * Lo complementa `tests/panel-fuera-del-sitio.test.ts`, que mira el grafo de
 * imports: **cuándo** entra el tercero. Acá se mira **qué pasa cuando alguien
 * aprieta el botón**.
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/enviar-propuesta', () => ({
  enviarPropuesta: vi.fn(),
  subirImagenDePropuesta: vi.fn(),
}));

import { FormularioPublico } from '@/components/publico/FormularioPublico';
import { enviarPropuesta, subirImagenDePropuesta } from '@/lib/enviar-propuesta';

const OFRECIDO = [{ slug: 'merienda', label: 'Merienda' }];

afterEach(() => {
  cleanup();
  vi.mocked(enviarPropuesta).mockReset();
  vi.mocked(subirImagenDePropuesta).mockReset();
  vi.useRealTimers();
});

beforeEach(() => {
  vi.mocked(enviarPropuesta).mockResolvedValue('p_nueva');
});

const montar = () => render(<FormularioPublico incluyeOfrecido={OFRECIDO} />);

/** Llena lo mínimo que el schema exige. Devuelve nada: los asertos son de afuera. */
const llenarLoMinimo = async () => {
  await userEvent.type(screen.getByLabelText(/qué actividad es/i), 'Taller de crónica urbana');
  await userEvent.type(
    screen.getByLabelText(/contanos de qué se trata/i),
    'Cuatro encuentros para escribir crónica, con lecturas y consignas.',
  );
  await userEvent.type(screen.getByLabelText('Día'), '2026-10-07');
  await userEvent.type(screen.getByLabelText('Desde'), '19:00');
  await userEvent.type(screen.getByLabelText(/lugar/i), 'Casa Brandon');
  await userEvent.type(screen.getByLabelText(/quién organiza/i), 'Casa Brandon');
  await userEvent.type(screen.getByLabelText(/tu contacto/i), 'hola@casabrandon.test');
};

/**
 * El tiempo mínimo son cinco segundos reales, así que **hay que viajar en el
 * tiempo**: sin esto, todos los casos de abajo caerían en la trampa y verían la
 * pantalla de gracias sin haber escrito nada. Se mueve el reloj del sistema y no
 * el del componente, que es lo que hace que el caso pruebe el mecanismo de verdad.
 */
const pasaronLosSegundos = () => {
  vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 60_000);
};

describe('el formulario público manda una propuesta', () => {
  it('valida antes de escribir: con el formulario vacío no toca Firestore', async () => {
    montar();
    pasaronLosSegundos();
    await userEvent.click(screen.getByRole('button', { name: 'Mandar la propuesta' }));

    expect(enviarPropuesta).not.toHaveBeenCalled();
    // Por texto y no por `role="alert"`: cada `Campo` rechazado pinta el suyo, así
    // que con el formulario vacío hay varios y `findByRole` no sabría cuál.
    expect(await screen.findByText(/Faltan algunas cosas/)).toBeTruthy();
  });

  it('y con lo mínimo completo, manda y agradece', async () => {
    montar();
    await llenarLoMinimo();
    pasaronLosSegundos();
    await userEvent.click(screen.getByRole('button', { name: 'Mandar la propuesta' }));

    await waitFor(() => expect(enviarPropuesta).toHaveBeenCalledTimes(1));
    const [form, storagePath] = vi.mocked(enviarPropuesta).mock.calls[0]!;
    expect(form.titulo).toBe('Taller de crónica urbana');
    expect(form.contacto.valor).toBe('hola@casabrandon.test');
    // Sin imagen subida: el segundo argumento es lo que distingue las dos formas
    // de `ImagenPropuesta`, y no puede viajar un path inventado.
    expect(storagePath).toBeNull();

    expect(await screen.findByText(/Gracias, la recibimos/i)).toBeTruthy();
  });

  it('si Firestore rechaza, lo dice y NO se pierde lo que escribieron', async () => {
    /*
     * Hoy el rechazo más probable es el permission-denied de la puerta que
     * todavía no se abrió (B-836a), y mañana va a ser la red. En los dos casos lo
     * que la persona necesita es que el formulario siga lleno: volver a escribir
     * once campos es lo que hace que no lo vuelva a intentar.
     */
    vi.mocked(enviarPropuesta).mockRejectedValue(new Error('permission-denied'));
    montar();
    await llenarLoMinimo();
    pasaronLosSegundos();
    await userEvent.click(screen.getByRole('button', { name: 'Mandar la propuesta' }));

    expect(await screen.findByText(/No pudimos recibir la propuesta/)).toBeTruthy();
    expect(screen.queryByText(/Gracias, la recibimos/i)).toBeNull();
    expect(screen.getByLabelText(/qué actividad es/i)).toHaveProperty(
      'value',
      'Taller de crónica urbana',
    );
  });
});

/**
 * **Las dos trampas, que son la capa que frena lo automático.**
 *
 * Las dos hacen lo mismo a propósito: muestran la pantalla de gracias y **no
 * escriben nada**. Decirle a un bot «te agarré» es enseñarle qué corregir.
 */
describe('el honeypot y el tiempo mínimo', () => {
  it('el campo trampa lleno no escribe, y no se nota', async () => {
    montar();
    await llenarLoMinimo();
    pasaronLosSegundos();
    // El campo está fuera del flujo de tabulación y con `aria-hidden`, así que un
    // humano no llega — se lo llena como lo llenaría un bot, por el DOM.
    await userEvent.type(screen.getByLabelText('No completes esto'), 'https://spam.test');
    await userEvent.click(screen.getByRole('button', { name: 'Mandar la propuesta' }));

    expect(enviarPropuesta).not.toHaveBeenCalled();
    expect(await screen.findByText(/Gracias, la recibimos/i)).toBeTruthy();
  });

  it('y el envío instantáneo tampoco, aunque esté todo bien completado', async () => {
    // Sin mover el reloj: el submit llega antes de los cinco segundos.
    montar();
    await llenarLoMinimo();
    await userEvent.click(screen.getByRole('button', { name: 'Mandar la propuesta' }));

    expect(enviarPropuesta).not.toHaveBeenCalled();
    expect(await screen.findByText(/Gracias, la recibimos/i)).toBeTruthy();
  });

  it('el campo trampa no lo ve ni lo tabula quien navega con teclado', () => {
    // La otra mitad del honeypot: si un lector de pantalla lo anunciara, alguien
    // lo llenaría de buena fe y su propuesta se perdería en silencio.
    montar();
    const trampa = screen.getByLabelText('No completes esto');
    expect(trampa.getAttribute('tabindex')).toBe('-1');
    expect(trampa.getAttribute('autocomplete')).toBe('off');
    expect(trampa.closest('[aria-hidden="true"]')).not.toBeNull();
  });
});

describe('la imagen, que es opcional y va por Storage (DEC-11)', () => {
  it('se sube al elegirla y su path viaja al documento, no la URL pegada', async () => {
    vi.mocked(subirImagenDePropuesta).mockResolvedValue('propuestas/prop_abc.jpg');
    montar();
    await llenarLoMinimo();

    const archivo = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'flyer.jpg', {
      type: 'image/jpeg',
    });
    await userEvent.upload(screen.getByLabelText(/el flyer, si tenés/i), archivo);
    await waitFor(() => expect(subirImagenDePropuesta).toHaveBeenCalledWith(archivo));

    pasaronLosSegundos();
    await userEvent.click(screen.getByRole('button', { name: 'Mandar la propuesta' }));
    await waitFor(() => expect(enviarPropuesta).toHaveBeenCalled());

    const [, storagePath] = vi.mocked(enviarPropuesta).mock.calls[0]!;
    expect(storagePath).toBe('propuestas/prop_abc.jpg');
  });

  it('y si la subida falla, la propuesta se puede mandar igual sin ella', async () => {
    // Cortar acá dejaría a alguien sin poder mandar una actividad que ya escribió
    // por un problema de Storage. La foto es opcional; la propuesta no.
    vi.mocked(subirImagenDePropuesta).mockRejectedValue(new Error('se cayó la red'));
    montar();
    await llenarLoMinimo();

    await userEvent.upload(
      screen.getByLabelText(/el flyer, si tenés/i),
      new File([new Uint8Array([1])], 'flyer.jpg', { type: 'image/jpeg' }),
    );
    expect(await screen.findByText(/No se pudo subir la imagen/)).toBeTruthy();

    pasaronLosSegundos();
    await userEvent.click(screen.getByRole('button', { name: 'Mandar la propuesta' }));
    await waitFor(() => expect(enviarPropuesta).toHaveBeenCalled());
    expect(vi.mocked(enviarPropuesta).mock.calls[0]![1]).toBeNull();
  });
});
