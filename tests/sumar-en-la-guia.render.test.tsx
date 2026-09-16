/**
 * **Los tres formularios públicos de la Guía, renderizados de verdad** —
 * `/guia/<x>/sumar`, 2026-09-15.
 *
 * Es el hermano de `tests/proponer.render.test.tsx` y existe por el mismo
 * motivo: las cosas que hacen aceptable una escritura anónima desde el navegador
 * son **cableado** —el honeypot, el tiempo mínimo, que la validación corra antes
 * de escribir, y que el módulo que habla con Firebase se cargue en el submit— y
 * ninguna se puede verificar leyendo el fuente sin arriesgar un falso verde (la
 * lección de B-202).
 *
 * Lo complementa `tests/panel-fuera-del-sitio.test.ts`, que mira el grafo de
 * imports: **cuándo** entra el tercero. Acá se mira **qué pasa cuando alguien
 * aprieta el botón**.
 *
 * ── Y una mitad que este archivo tiene y el de `/proponer` no ─────────────
 * La dirección de un lugar (§ 6 del PRD 4). Es la única pantalla del proyecto
 * donde alguien puede tipear el domicilio de una casa, y las tres capas que lo
 * cubren tienen que poder verse fallar: acá se prueba la primera —el formulario
 * arranca con el flag apagado, así que no pide la dirección como obligatoria y no
 * ofrece ninguna casilla para prenderla—. La segunda (`formALugar`) vive en
 * `tests/lugares.test.ts` y la tercera (la regla) en
 * `tests/lugares.integracion.test.ts`.
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/enviar-ficha', () => ({
  enviarLibreria: vi.fn(),
  enviarSuscripcion: vi.fn(),
  enviarLugar: vi.fn(),
}));

import { SumarLibreria } from '@/components/publico/SumarLibreria';
import { SumarLugar } from '@/components/publico/SumarLugar';
import { SumarSuscripcion } from '@/components/publico/SumarSuscripcion';
import { enviarLibreria, enviarLugar, enviarSuscripcion } from '@/lib/enviar-ficha';

const BARRIOS = [{ slug: 'palermo', label: 'Palermo' }];
// B-967 — la cascada de las guías. El formulario arranca en CABA, así que lo que
// se ve por defecto es el desplegable de barrio.
const PROVINCIAS_OFRECIDAS = [
  { slug: 'caba', label: 'CABA' },
  { slug: 'buenos-aires', label: 'Buenos Aires' },
];
const CIUDADES_OFRECIDAS = [
  { slug: 'caba', label: 'CABA' },
  { slug: 'mar-del-plata', label: 'Mar del Plata' },
];
const TIPOS_LUGAR = [{ slug: 'cafe', label: 'Café' }];
const CONDICIONES = [{ slug: 'con-consumicion', label: 'Con consumición' }];
const TIPOS_OFERENTE = [{ slug: 'libreria', label: 'Librería' }];
const PERIODICIDADES = [{ slug: 'mensual', label: 'Mensual' }];

afterEach(() => {
  cleanup();
  vi.mocked(enviarLibreria).mockReset();
  vi.mocked(enviarSuscripcion).mockReset();
  vi.mocked(enviarLugar).mockReset();
  vi.restoreAllMocks();
});

beforeEach(() => {
  vi.mocked(enviarLibreria).mockResolvedValue('l_nueva');
  vi.mocked(enviarSuscripcion).mockResolvedValue('s_nueva');
  vi.mocked(enviarLugar).mockResolvedValue('lug_nuevo');
});

/**
 * El tiempo mínimo son cinco segundos reales, así que **hay que viajar en el
 * tiempo**: sin esto, todos los casos caerían en la trampa y verían la pantalla
 * de gracias sin haber escrito nada. Se mueve el reloj del sistema y no el del
 * componente, que es lo que hace que el caso pruebe el mecanismo de verdad.
 */
const pasaronLosSegundos = () => {
  vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 60_000);
};

// ─────────────────────────────────────────────────────────────────────
// Librerías
// ─────────────────────────────────────────────────────────────────────

const montarLibreria = () =>
  render(
    <SumarLibreria
      barriosOfrecidos={BARRIOS}
      provinciasOfrecidas={PROVINCIAS_OFRECIDAS}
      ciudadesOfrecidas={CIUDADES_OFRECIDAS}
    />,
  );

const llenarLibreria = async () => {
  await userEvent.type(screen.getByLabelText(/cómo se llama/i), 'Librería Del Otro Lado');
  await userEvent.type(screen.getByLabelText(/^Dirección/), 'Thames 1762');
  await userEvent.selectOptions(screen.getByLabelText(/^Barrio/), 'palermo');
  await userEvent.type(screen.getByLabelText(/tu contacto/i), 'quien.cargo@ejemplo.test');
};

describe('el formulario público de una librería', () => {
  it('valida antes de escribir: con el formulario vacío no toca Firestore', async () => {
    montarLibreria();
    pasaronLosSegundos();
    await userEvent.click(screen.getByRole('button', { name: 'Mandar la librería' }));

    expect(enviarLibreria).not.toHaveBeenCalled();
    expect(await screen.findByText(/Faltan algunas cosas/)).toBeTruthy();
  });

  it('exige el contacto interno, que del lado del panel es opcional', async () => {
    // Es la única diferencia entre las dos configuraciones del § 5 del PRD, y
    // está donde tiene que estar: quien carga desde afuera no vuelve a entrar,
    // así que sin contacto la única salida sería descartar la ficha.
    montarLibreria();
    await userEvent.type(screen.getByLabelText(/cómo se llama/i), 'Librería Del Otro Lado');
    await userEvent.type(screen.getByLabelText(/^Dirección/), 'Thames 1762');
    await userEvent.selectOptions(screen.getByLabelText(/^Barrio/), 'palermo');
    pasaronLosSegundos();
    await userEvent.click(screen.getByRole('button', { name: 'Mandar la librería' }));

    expect(enviarLibreria).not.toHaveBeenCalled();
    expect(await screen.findByText(/Cómo te escribimos si hay que preguntarte algo|¿Cómo te escribimos si hay que preguntarte algo\?/i)).toBeTruthy();
  });

  it('y con lo mínimo completo, manda y agradece', async () => {
    montarLibreria();
    await llenarLibreria();
    pasaronLosSegundos();
    await userEvent.click(screen.getByRole('button', { name: 'Mandar la librería' }));

    await waitFor(() => expect(enviarLibreria).toHaveBeenCalledTimes(1));
    const [form] = vi.mocked(enviarLibreria).mock.calls[0]!;
    expect(form.nombre).toBe('Librería Del Otro Lado');
    expect(form.barrio).toBe('palermo');
    expect(form.contactoDeQuienCargo.valor).toBe('quien.cargo@ejemplo.test');
    // La galería viaja vacía: la regla lo exige y el formulario no la pide.
    expect(form.imagenes).toEqual([]);
    expect(await screen.findByText(/Gracias, la recibimos/)).toBeTruthy();
  });

  it('el honeypot se traga el envío y agradece igual, sin escribir nada', async () => {
    // Decirle a un bot «te agarré» es enseñarle qué corregir. El costo es un
    // humano con un gestor de contraseñas entusiasta, y por eso el campo va con
    // `tabIndex={-1}`, `autocomplete="off"` y un nombre que nadie autocompleta.
    montarLibreria();
    await llenarLibreria();
    pasaronLosSegundos();
    await userEvent.type(screen.getByLabelText('No completes esto'), 'soy-un-bot');
    await userEvent.click(screen.getByRole('button', { name: 'Mandar la librería' }));

    expect(await screen.findByText(/Gracias, la recibimos/)).toBeTruthy();
    expect(enviarLibreria).not.toHaveBeenCalled();
  });

  it('y el envío instantáneo también — la otra firma de un script', async () => {
    montarLibreria();
    await llenarLibreria();
    // Sin `pasaronLosSegundos()`: el formulario se acaba de abrir.
    await userEvent.click(screen.getByRole('button', { name: 'Mandar la librería' }));

    expect(await screen.findByText(/Gracias, la recibimos/)).toBeTruthy();
    expect(enviarLibreria).not.toHaveBeenCalled();
  });

  it('si Firestore rechaza, lo escrito NO se pierde y el texto no inventa el motivo', async () => {
    vi.mocked(enviarLibreria).mockRejectedValue(new Error('permission-denied'));
    montarLibreria();
    await llenarLibreria();
    pasaronLosSegundos();
    await userEvent.click(screen.getByRole('button', { name: 'Mandar la librería' }));

    expect(await screen.findByRole('alert')).toBeTruthy();
    // Lo que la persona necesita: que no se le pierda lo que escribió.
    expect((screen.getByLabelText(/cómo se llama/i) as HTMLInputElement).value).toBe(
      'Librería Del Otro Lado',
    );
    expect(screen.queryByText(/Gracias, la recibimos/)).toBeNull();
  });

  it('«Otro…» deja escribir un barrio que todavía no existe, y lo manda slugueado', async () => {
    // `/opciones/barrio` arranca vacío (`opciones-base.json`): un desplegable
    // cerrado dejaría el formulario inguardable. Y el schema exige un slug, así
    // que la conversión pasa acá — si viajara crudo, la regla lo rechazaría con
    // un «Elegí el barrio de la lista» que no explica nada.
    montarLibreria();
    await userEvent.type(screen.getByLabelText(/cómo se llama/i), 'Librería Del Otro Lado');
    await userEvent.type(screen.getByLabelText(/^Dirección/), 'Thames 1762');
    await userEvent.selectOptions(screen.getByLabelText(/^Barrio/), '__otro__');
    await userEvent.type(screen.getByLabelText(/^Barrio/), 'Villa Crespo');
    await userEvent.type(screen.getByLabelText(/tu contacto/i), 'quien.cargo@ejemplo.test');
    pasaronLosSegundos();
    await userEvent.click(screen.getByRole('button', { name: 'Mandar la librería' }));

    await waitFor(() => expect(enviarLibreria).toHaveBeenCalledTimes(1));
    expect(vi.mocked(enviarLibreria).mock.calls[0]![0].barrio).toBe('villa-crespo');
  });
});

// ─────────────────────────────────────────────────────────────────────
// Lugares — la dirección de una casa
// ─────────────────────────────────────────────────────────────────────

const montarLugar = () =>
  render(
    <SumarLugar
      tiposDeLugar={TIPOS_LUGAR}
      barriosOfrecidos={BARRIOS}
      provinciasOfrecidas={PROVINCIAS_OFRECIDAS}
      ciudadesOfrecidas={CIUDADES_OFRECIDAS}
      incluyeOfrecido={[]}
      condicionesDeUso={CONDICIONES}
    />,
  );

describe('el formulario público de un lugar — § 6 del PRD 4', () => {
  it('⚠️ NO ofrece ninguna casilla para publicar la dirección', () => {
    /*
     * La primera de las tres capas. Prender el flag es una acción de admin —
     * alguien pidió permiso a quien vive ahí— y de este lado ni siquiera existe
     * el control.
     *
     * MUTACIÓN: agregar la casilla de `direccionPublica` al componente. Este
     * caso se pone rojo.
     */
    montarLugar();
    expect(screen.queryByLabelText(/publicar la dirección|dirección pública/i)).toBeNull();
    // Y lo dice con palabras, que es lo que hace que el dato se cargue sabiendo
    // qué va a pasar con él.
    expect(screen.getAllByText(/La dirección exacta no se publica/).length).toBeGreaterThan(0);
  });

  it('y la dirección es OPCIONAL: se puede mandar un lugar sin darla', async () => {
    /*
     * La consecuencia de arrancar con el flag apagado, y es la que importa: con
     * el default del panel (`direccionPublica: true`) el `superRefine` exige la
     * dirección, o sea que este formulario pediría como obligatorio el dato más
     * sensible del proyecto para después no publicarlo.
     *
     * MUTACIÓN: sacar el `direccionPublica: false` del `inicial` de
     * `SumarLugar`. Este caso se pone rojo.
     */
    montarLugar();
    await userEvent.type(screen.getByLabelText(/cómo se llama/i), 'El Salón del Fondo');
    await userEvent.selectOptions(screen.getByLabelText(/^Qué es\*?$/), 'cafe');
    await userEvent.selectOptions(screen.getByLabelText(/^Barrio/), 'palermo');
    await userEvent.selectOptions(screen.getByLabelText(/^Condición/), 'con-consumicion');
    await userEvent.type(screen.getByLabelText(/tu contacto/i), 'quien.cargo@ejemplo.test');
    pasaronLosSegundos();
    await userEvent.click(screen.getByRole('button', { name: 'Mandar el lugar' }));

    await waitFor(() => expect(enviarLugar).toHaveBeenCalledTimes(1));
    const [form] = vi.mocked(enviarLugar).mock.calls[0]!;
    expect(form.direccion).toBe('');
    expect(form.direccionPublica).toBe(false);
    expect(form.imagenes).toEqual([]);
  });

  it('y si la da, viaja igual con el flag apagado', async () => {
    montarLugar();
    await userEvent.type(screen.getByLabelText(/cómo se llama/i), 'El Salón del Fondo');
    await userEvent.selectOptions(screen.getByLabelText(/^Qué es\*?$/), 'cafe');
    await userEvent.selectOptions(screen.getByLabelText(/^Barrio/), 'palermo');
    await userEvent.selectOptions(screen.getByLabelText(/^Condición/), 'con-consumicion');
    await userEvent.type(screen.getByLabelText(/^Dirección/), 'Honduras 4321');
    await userEvent.type(screen.getByLabelText(/tu contacto/i), 'quien.cargo@ejemplo.test');
    pasaronLosSegundos();
    await userEvent.click(screen.getByRole('button', { name: 'Mandar el lugar' }));

    await waitFor(() => expect(enviarLugar).toHaveBeenCalledTimes(1));
    const [form] = vi.mocked(enviarLugar).mock.calls[0]!;
    expect(form.direccion).toBe('Honduras 4321');
    expect(form.direccionPublica).toBe(false);
  });

  it('el honeypot también se lo traga acá', async () => {
    montarLugar();
    await userEvent.type(screen.getByLabelText(/cómo se llama/i), 'El Salón del Fondo');
    await userEvent.selectOptions(screen.getByLabelText(/^Qué es\*?$/), 'cafe');
    await userEvent.selectOptions(screen.getByLabelText(/^Barrio/), 'palermo');
    await userEvent.selectOptions(screen.getByLabelText(/^Condición/), 'con-consumicion');
    await userEvent.type(screen.getByLabelText(/tu contacto/i), 'quien.cargo@ejemplo.test');
    pasaronLosSegundos();
    await userEvent.type(screen.getByLabelText('No completes esto'), 'soy-un-bot');
    await userEvent.click(screen.getByRole('button', { name: 'Mandar el lugar' }));

    expect(await screen.findByText(/Gracias, lo recibimos/)).toBeTruthy();
    expect(enviarLugar).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────
// Suscripciones — el precio y su fecha
// ─────────────────────────────────────────────────────────────────────

const montarSuscripcion = () =>
  render(
    <SumarSuscripcion
      tiposDeOferente={TIPOS_OFERENTE}
      periodicidades={PERIODICIDADES}
      incluyeOfrecido={[]}
      extrasOfrecidos={[]}
      alcancesOfrecidos={[]}
      perfilesEditoriales={[]}
    />,
  );

const llenarSuscripcion = async () => {
  await userEvent.type(screen.getByLabelText(/cómo se llama/i), 'Caja de narrativa');
  await userEvent.type(
    screen.getByLabelText(/qué es y para quién/i),
    'Una caja mensual con dos libros de narrativa latinoamericana y una guía de lectura.',
  );
  await userEvent.type(screen.getByLabelText(/^Nombre/), 'Librería Del Otro Lado');
  await userEvent.selectOptions(screen.getByLabelText(/^Qué es\*?$/), 'libreria');
  await userEvent.selectOptions(screen.getByLabelText(/cada cuánto llega/i), 'mensual');
  await userEvent.type(screen.getByLabelText(/tu contacto/i), 'quien.cargo@ejemplo.test');
};

describe('el formulario público de una suscripción', () => {
  it('manda lo mínimo y agradece', async () => {
    montarSuscripcion();
    await llenarSuscripcion();
    pasaronLosSegundos();
    await userEvent.click(screen.getByRole('button', { name: 'Mandar la suscripción' }));

    await waitFor(() => expect(enviarSuscripcion).toHaveBeenCalledTimes(1));
    const [form] = vi.mocked(enviarSuscripcion).mock.calls[0]!;
    expect(form.nombre).toBe('Caja de narrativa');
    expect(form.ofrecidaPor.tipo).toBe('libreria');
    expect(form.periodicidad).toBe('mensual');
    expect(form.imagenes).toEqual([]);
  });

  it('NO pide la fecha del precio, y dice que se publica con ella al lado — DEC-12', () => {
    /*
     * La mitad de DEC-12 que el formulario no puede escribir: `cargadoEn` lo
     * pone el servidor y lo verifica la regla contra `request.time`. Un campo de
     * fecha que se puede escribir es un campo de fecha que se puede mentir, y
     * ésta es justamente la que le dice a quien lee si le puede creer al número.
     *
     * Y la mitad que sí va en pantalla: quien carga el precio tiene que saber
     * que se publica con la fecha al lado.
     */
    montarSuscripcion();
    expect(screen.queryByLabelText(/fecha.*precio|cargado el/i)).toBeNull();
    expect(screen.getByText(/con la fecha en que lo cargaste al lado/i)).toBeTruthy();
  });

  it('los campos del envío aparecen solo si manda libros', async () => {
    // `formASuscripcion` **descarta** la temática y el perfil cuando `manda` está
    // en `false`. Un dato que se completa y después se tira es la forma de que
    // alguien crea que cargó algo que no se guardó.
    montarSuscripcion();
    expect(screen.queryByLabelText(/^Temática/)).toBeNull();
    await userEvent.click(screen.getByLabelText(/manda libros a casa/i));
    expect(screen.getByLabelText(/^Temática/)).toBeTruthy();
  });

  it('el honeypot también se lo traga acá', async () => {
    montarSuscripcion();
    await llenarSuscripcion();
    pasaronLosSegundos();
    await userEvent.type(screen.getByLabelText('No completes esto'), 'soy-un-bot');
    await userEvent.click(screen.getByRole('button', { name: 'Mandar la suscripción' }));

    expect(await screen.findByText(/Gracias, la recibimos/)).toBeTruthy();
    expect(enviarSuscripcion).not.toHaveBeenCalled();
  });
});
