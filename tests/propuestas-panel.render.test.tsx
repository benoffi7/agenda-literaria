/**
 * `PropuestasPanel` renderizado de verdad — B-830, paso 7.
 *
 * **Por qué esta pantalla necesita DOM.** Lo que hay que verificar acá no es una
 * función pura —esas ya están en `bandeja-de-propuestas.test.ts` y en
 * `propuestas-conversion.test.ts`— sino **el cableado**, que es donde esta
 * pantalla puede fallar en silencio y de las formas más caras:
 *
 *  - **el orden de D-600**: «Convertir» **no escribe nada**. Si escribiera antes
 *    de que la actividad exista, una conversión abandonada dejaría la propuesta
 *    marcada `aceptada` apuntando a una actividad que no está;
 *  - **el contacto ajeno en un `href`**: la defensa es pura y está probada, pero
 *    que la pantalla **la use** —y no interpole el valor a mano— no lo prueba
 *    ningún test de la función;
 *  - **que no se pueda editar el contenido de una propuesta** (§4.3 del PRD): la
 *    regla lo hace cumplir, y que la pantalla ni siquiera lo ofrezca es lo que
 *    evita el intento;
 *  - y el filtro por estado, que es un `filter` que se invierte sin que nada se
 *    ponga rojo (la lección de B-580 y de `menu-acciones.render.test.tsx`).
 *
 * Se mockea el I/O (`observarPropuestas`, `revisarPropuesta`) y las opciones; el
 * resto del módulo es el de verdad, incluida `enlaceDeContacto`.
 */
import { readFileSync } from 'node:fs';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PropuestaConId } from '@/types/propuesta';
// El doble de `Timestamp` del repo, uno y solo uno (B-211).
import { tsDe } from './fixtures/tiempo';

vi.mock('@/lib/analytics', () => ({
  medirFuncion: vi.fn(),
  medirSeccion: vi.fn(),
}));

/*
 * **El mock deriva `elegibles` con `opcionesVisibles` de verdad** — B-859. Las
 * dos listas que `useOpciones` devuelve contestan preguntas distintas
 * (`valores` = todas, para resolver etiquetas; `elegibles` = lo que se puede
 * elegir), y un mock que las inventara podría hacerlas coincidir justo donde el
 * bug vive. Con el filtro real, `vino-de-honor` —pendiente de aprobación— está
 * en `valores` y **no** en `elegibles`, que es exactamente la asimetría que hay
 * que poder ejercitar.
 */
vi.mock('@/components/admin/useOpciones', async () => {
  const { opcionesVisibles } = await import('@/lib/taxonomia');
  const POR_CAMPO: Record<string, { slug: string; label: string; orden: number; fijo: boolean; usos: number; aprobada?: boolean }[]> = {
    'incluye-actividad': [
      { slug: 'merienda', label: 'Merienda', orden: 1, fijo: true, usos: 0 },
      // Existe en la taxonomía y **espera validación**: el formulario público
      // no la ofrece (`opcionesPublicas` = `opcionesVisibles` sin uid).
      { slug: 'vino-de-honor', label: 'Vino de honor', orden: 2, fijo: false, usos: 1, aprobada: false },
    ],
    arancel: [{ slug: 'a-la-gorra', label: 'A la gorra', orden: 1, fijo: true, usos: 0 }],
  };
  return {
    useOpciones: (campo: string) => {
      const valores = POR_CAMPO[campo] ?? [];
      return { valores, elegibles: opcionesVisibles(valores as never), cargando: false };
    },
  };
});

/*
 * El módulo dueño de `firebase/storage`, que el panel carga con `import()`. Se
 * mockea entero: lo que este archivo ejercita es el cableado —que la bandeja lo
 * llame y qué hace con lo que devuelve—, no la subida.
 */
vi.mock('@/lib/subir-imagen', () => ({
  urlDeImagenDePropuesta: vi.fn(),
  promoverImagenDePropuesta: vi.fn(),
}));

vi.mock('@/lib/bandejaDePropuestas', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/bandejaDePropuestas')>()),
  observarPropuestas: vi.fn(),
  revisarPropuesta: vi.fn(),
}));

import { PropuestasPanel, type Conversion } from '@/components/admin/PropuestasPanel';
import { medirFuncion } from '@/lib/analytics';
import { promoverImagenDePropuesta, urlDeImagenDePropuesta } from '@/lib/subir-imagen';
import { observarPropuestas, revisarPropuesta } from '@/lib/bandejaDePropuestas';

afterEach(() => {
  cleanup();
  vi.mocked(urlDeImagenDePropuesta).mockReset();
  vi.mocked(promoverImagenDePropuesta).mockReset();
  vi.mocked(observarPropuestas).mockReset();
  vi.mocked(revisarPropuesta).mockReset();
  vi.mocked(medirFuncion).mockReset();
});

const USUARIO = { uid: 'uid_admin' };

const propuesta = (over: Partial<PropuestaConId> = {}): PropuestaConId => ({
  id: 'p1',
  titulo: 'Taller de crónica urbana',
  descripcion: 'Cuatro encuentros para escribir crónica, con lecturas y consignas.',
  fechas: [{ dia: '2026-10-07', desde: '19:00', hasta: '21:00' }],
  modalidad: 'presencial',
  lugar: { nombre: 'Casa Brandon', direccion: 'Luis María Drago 236', barrio: 'Villa Crespo' },
  organizador: { nombre: 'Casa Brandon', instagram: '@casabrandon' },
  arancel: { tipo: 'a-la-gorra', notas: null },
  inscripcion: { requiere: false, comoDice: null },
  incluye: ['merienda'],
  incluyeOtro: null,
  imagen: null,
  contacto: { via: 'mail', valor: 'hola@casabrandon.test' },
  estado: 'nueva',
  creadoEn: { toDate: () => new Date('2026-09-08T18:00:00Z') } as never,
  origen: 'formulario-publico',
  revision: { porUid: null, en: null, actividadId: null, motivo: null },
  ...over,
});

/** Monta la pantalla con las propuestas dadas y devuelve el `onConvertir` espiado. */
const montar = (ps: PropuestaConId[]) => {
  vi.mocked(observarPropuestas).mockImplementation((cb) => {
    cb(ps);
    return () => {};
  });
  const onConvertir = vi.fn<(c: Conversion) => void>();
  render(<PropuestasPanel usuario={USUARIO} onConvertir={onConvertir} />);
  return onConvertir;
};

describe('la bandeja muestra lo que hace falta para decidir', () => {
  it('el contacto de quien propuso está, y es lo que hace que la bandeja sirva', () => {
    montar([propuesta()]);
    const link = screen.getByRole('link', { name: 'hola@casabrandon.test' });
    expect(link.getAttribute('href')).toBe('mailto:hola@casabrandon.test');
  });

  /**
   * **La defensa contra el texto ajeno, verificada donde se usa.** Que
   * `enlaceDeContacto` devuelva `null` ya está probado; lo que este caso fija es
   * que la pantalla **la llame** en vez de interpolar el valor en el `href`.
   *
   * MUTACIÓN PROBADA: reemplazando `enlaceDeContacto(p.contacto)` por
   * `p.contacto.valor` en el componente, se ponen rojos **este caso y el de
   * arriba** — el de arriba porque el `href` deja de llevar `mailto:`, éste
   * porque el `javascript:` pasa a ser un link. Los dos hacen falta igual: el de
   * arriba fija que el link se arme, éste que no se arme cuando no se puede.
   */
  it('y si no se puede armar un link seguro, queda como texto', () => {
    montar([propuesta({ contacto: { via: 'mail', valor: 'javascript:alert(1)' } })]);
    expect(screen.getByText('javascript:alert(1)')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'javascript:alert(1)' })).toBeNull();
  });

  /**
   * El segundo `href` de texto ajeno de la pantalla, con el mismo par de casos que
   * el contacto y por el mismo motivo: uno prueba que el link se arme, el otro que
   * no se arme cuando no se puede — y solo los dos juntos distinguen «se saneó» de
   * «no se interpoló».
   */
  it('la imagen que pegaron también pasa por el saneador', () => {
    montar([propuesta({ imagen: { url: 'https://casabrandon.test/flyer.jpg' } })]);
    expect(
      screen.getByRole('link', { name: /Imagen que pegaron/ }).getAttribute('href'),
    ).toBe('https://casabrandon.test/flyer.jpg');

    cleanup();
    montar([propuesta({ imagen: { url: 'javascript:alert(1)' } })]);
    expect(screen.queryByRole('link', { name: /Imagen que pegaron/ })).toBeNull();
    expect(screen.getByText(/el link no se puede abrir/)).toBeTruthy();
  });

  it('y la que subieron se muestra, que es lo que deja decidir (DEC-11)', async () => {
    vi.mocked(urlDeImagenDePropuesta).mockResolvedValue('https://emu.test/flyer.jpg?token=t');
    montar([propuesta({ imagen: { storagePath: 'propuestas/abc.jpg' } })]);

    const img = await screen.findByRole('img', { name: /flyer que mandaron/i });
    expect(img.getAttribute('src')).toBe('https://emu.test/flyer.jpg?token=t');
    expect(urlDeImagenDePropuesta).toHaveBeenCalledWith('propuestas/abc.jpg');
    // El path queda igual: es lo que hay que poder leer cuando algo no cuadra.
    expect(screen.getByText(/Subieron esa imagen: propuestas\/abc\.jpg/)).toBeTruthy();
  });

  it('la de una rechazada no se pide siquiera: se borró al rechazar', async () => {
    // Pedirla mostraría «trayendo la imagen…» y después un error, para algo que
    // ya sabemos. El texto lo dice y no hay `img`.
    montar([propuesta({ estado: 'rechazada', imagen: { storagePath: 'propuestas/abc.jpg' } })]);
    await userEvent.click(screen.getByLabelText('Ver aceptadas y rechazadas'));

    expect(urlDeImagenDePropuesta).not.toHaveBeenCalled();
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText(/se borró al rechazar/)).toBeTruthy();
  });

  it('y si el objeto ya no está, lo dice en vez de mostrar una imagen rota', async () => {
    vi.mocked(urlDeImagenDePropuesta).mockRejectedValue(new Error('object-not-found'));
    montar([propuesta({ imagen: { storagePath: 'propuestas/abc.jpg' } })]);

    expect(await screen.findByText(/La imagen que subieron ya no está/)).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('no ofrece editar el contenido: la propuesta es prueba de qué se pidió', () => {
    // §4.3 del PRD. La regla lo hace cumplir; que no haya dónde escribir es lo
    // que evita el intento. El único campo de texto de la pantalla aparece al
    // rechazar, y es el motivo — que no es contenido de la propuesta.
    montar([propuesta()]);
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
  });

  it('arranca mostrando las que esperan decisión, y las cerradas con el tilde', async () => {
    montar([propuesta(), propuesta({ id: 'p2', titulo: 'Club ya aceptado', estado: 'aceptada' })]);
    expect(screen.queryByText('Club ya aceptado')).toBeNull();
    await userEvent.click(screen.getByLabelText('Ver aceptadas y rechazadas'));
    expect(screen.getByText('Club ya aceptado')).toBeTruthy();
  });

  it('mide cuántas estaban esperando, que es el termómetro de que alguien la mire', () => {
    montar([propuesta(), propuesta({ id: 'p2', estado: 'rechazada' })]);
    expect(medirFuncion).toHaveBeenCalledWith('propuestas-abrir', undefined, 1);
  });
});

/**
 * **Que la bandeja diga cuándo se va** — B-844.
 *
 * El barrido borra sin que nadie apriete nada, así que ahora hay documentos que
 * desaparecen de la bandeja y **nadie los ve irse**. El aviso es lo que evita
 * que eso se lea como un bug de la pantalla — y la ventana de
 * `AVISO_DE_CADUCIDAD_DIAS` es lo que evita que el aviso se convierta en un
 * cartel en cada ficha, que es el precedente de D-273.
 *
 * La lógica pura está en `bandeja-de-propuestas.test.ts`, cruzada contra la
 * decisión de la Function. Lo que se verifica acá es el cableado: que la
 * pantalla **la llame** y que muestre lo que devuelve.
 */
describe('cuándo se borra sola, dicho en la ficha (B-844)', () => {
  /**
   * Hace N días **y medio**, y la media es a propósito: la pantalla lee el reloj
   * en el render, o sea unos milisegundos después de armado el fixture, así que
   * un fixture parado justo en el borde del día da 5 o 4 según cuánto tardó
   * jsdom. Media jornada de margen lo saca del borde sin cambiar lo que el caso
   * afirma. (`caducaEn` redondea para abajo: 5,5 días → «5 días».)
   */
  const hace = (dias: number) =>
    tsDe(new Date(Date.now() - dias * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000));

  it('una que nadie tocó y está por caducar lo dice, con el número', () => {
    montar([propuesta({ creadoEn: hace(25) })]);
    /*
     * 30 − 25: cinco días. El texto se afirma **con el número adentro** porque
     * es lo único accionable del aviso: con 30 días de plazo una propuesta
     * puede caducar antes de que nadie la haya abierto, y ahí «esto vence» y
     * «esto vence el jueves» son la diferencia entre llegar y no llegar.
     */
    expect(screen.getByText('Se borra en 5 días')).toBeTruthy();
  });

  /**
   * **El control que hace que el aviso siga siendo un aviso** — D-273: «una
   * lista de 65 sobre 68 no es trabajo pendiente sino el catálogo con otro
   * nombre».
   *
   * MUTACIÓN PROBADA: sacando el corte por `AVISO_DE_CADUCIDAD_DIAS` en
   * `avisoDeCaducidad`, este caso se pone rojo (aparece «Se borra en 29 días»
   * en una propuesta de ayer) y el de arriba sigue verde.
   */
  it('y una de ayer no dice nada: el aviso no es un cartel en cada ficha', () => {
    montar([propuesta({ creadoEn: hace(1) })]);
    expect(screen.queryByText(/Se borra/)).toBeNull();
  });

  it('la aceptada nunca lo dice, por vieja que sea: no vence', async () => {
    montar([
      propuesta({
        estado: 'aceptada',
        creadoEn: hace(300),
        revision: { porUid: 'uid_admin', en: hace(280) as never, actividadId: 'act_1', motivo: null },
      }),
    ]);
    /*
     * **El tilde primero, y no es un rodeo**: la bandeja oculta las cerradas por
     * defecto, así que sin esto «no dice nada» pasaría porque **no hay ficha**,
     * que es el falso verde de esta clase de aserto. El título es el control
     * positivo de que la ficha sí está.
     */
    await userEvent.click(screen.getByLabelText('Ver aceptadas y rechazadas'));
    expect(screen.getByText('Taller de crónica urbana')).toBeTruthy();
    expect(screen.queryByText(/Se borra/)).toBeNull();
  });
});

describe('convertir en actividad — el orden de D-600', () => {
  it('arma el formulario prellenado y NO escribe nada', async () => {
    const onConvertir = montar([propuesta()]);
    await userEvent.click(screen.getByRole('button', { name: 'Convertir en actividad' }));

    expect(revisarPropuesta).not.toHaveBeenCalled();
    const c = onConvertir.mock.calls[0]![0];
    expect(c.tituloOrigen).toBe('Taller de crónica urbana');
    expect(c.copia.titulo).toBe('Taller de crónica urbana');
    // Un `ses_<uuid>` por fecha, generado al convertir (trampa 2).
    expect(c.copia.sesiones).toHaveLength(1);
    expect(c.copia.sesiones[0]!.id).toMatch(/^ses_/);
    expect(c.copia.estado).toBe('borrador');
  });

  it('los «qué se llevan» se filtran contra la taxonomía que la pantalla tiene', async () => {
    const onConvertir = montar([propuesta({ incluye: ['merienda', 'pizza-gratis'] })]);
    await userEvent.click(screen.getByRole('button', { name: 'Convertir en actividad' }));

    const c = onConvertir.mock.calls[0]![0];
    expect(c.copia.incluye).toEqual(['merienda']);
    expect(c.avisos.join(' ')).toContain('pizza-gratis');
  });

  /**
   * **Y se filtran contra lo `elegible`, no contra todo** — B-859.
   *
   * `vino-de-honor` **existe** en `/opciones/incluye-actividad` y está pendiente
   * de aprobación, así que `/proponer` no lo ofrece: ese formulario arma sus
   * casillas con `opcionesPublicas`, que es `opcionesVisibles` sin uid, o sea
   * las aprobadas. Quien lo nombre igual lo hace salteándose el formulario, y
   * la conversión no puede tratarlo como parte del vocabulario: cae a «Otro» y
   * el admin decide (§ 4.2 del PRD, D-30).
   *
   * El caso es difícil de ver a ojo porque **las dos versiones funcionan**: con
   * `valores` el slug entra y se ve bien, solo que es una opción que el circuito
   * público deliberadamente no ofrece.
   *
   * MUTACIÓN PROBADA: volviendo a `incluyeConocido.valores` en `convertir`, este
   * caso se pone rojo por partida doble (el slug entra a `copia.incluye` y
   * desaparece del aviso) y los otros tres de este `describe` siguen verdes.
   */
  it('y contra lo elegible: un slug que existe pero espera validación cae a «Otro»', async () => {
    const onConvertir = montar([propuesta({ incluye: ['merienda', 'vino-de-honor'] })]);
    await userEvent.click(screen.getByRole('button', { name: 'Convertir en actividad' }));

    const c = onConvertir.mock.calls[0]![0];
    expect(c.copia.incluye).toEqual(['merienda']);
    expect(c.avisos.join(' ')).toContain('vino-de-honor');
  });

  /**
   * **La promoción de la imagen** (paso 8, DEC-11): la foto pasa de `propuestas/`
   * a `imagenes/` al convertir, así la actividad nace con ella y no hace falta
   * ninguna Function que escriba `/actividades` después (la clase de B-80).
   */
  it('la imagen que mandaron viaja a la galería, como portada', async () => {
    vi.mocked(promoverImagenDePropuesta).mockResolvedValue({
      imagen: {
        id: 'img_nueva',
        url: 'https://emu.test/img_nueva.jpg',
        epigrafe: '',
        textoAlternativo: '',
        origen: 'propia',
        storagePath: 'imagenes/img_nueva.jpg',
        portada: false,
      },
      orientacion: null,
    });
    const onConvertir = montar([propuesta({ imagen: { storagePath: 'propuestas/abc.jpg' } })]);

    await userEvent.click(screen.getByRole('button', { name: 'Convertir en actividad' }));
    await waitFor(() => expect(onConvertir).toHaveBeenCalled());

    expect(promoverImagenDePropuesta).toHaveBeenCalledWith('propuestas/abc.jpg');
    const { copia } = onConvertir.mock.calls[0]![0];
    expect(copia.imagenes).toHaveLength(1);
    expect(copia.imagenes[0]!.storagePath).toBe('imagenes/img_nueva.jpg');
    // Primera de la galería: nace portada, igual que al subir una a mano.
    expect(copia.imagenes[0]!.portada).toBe(true);
  });

  it('y si no se puede traer, la conversión sigue y el aviso lo dice', async () => {
    /*
     * Cortar la conversión obligaría a resolver un problema de Storage antes de
     * poder cargar una actividad que ya está escrita. La foto se puede volver a
     * poner a mano mientras la propuesta siga en la bandeja.
     */
    vi.mocked(promoverImagenDePropuesta).mockRejectedValue(new Error('se cayó la red'));
    const onConvertir = montar([propuesta({ imagen: { storagePath: 'propuestas/abc.jpg' } })]);

    await userEvent.click(screen.getByRole('button', { name: 'Convertir en actividad' }));
    await waitFor(() => expect(onConvertir).toHaveBeenCalled());

    const c = onConvertir.mock.calls[0]![0];
    expect(c.copia.imagenes).toHaveLength(0);
    expect(c.avisos.join(' ')).toContain('se cayó la red');
  });

  it('una propuesta sin imagen propia no toca Storage', async () => {
    // Control: la promoción no puede correr «por las dudas» en cada conversión.
    const onConvertir = montar([propuesta({ imagen: { url: 'https://ejemplo.test/f.jpg' } })]);
    await userEvent.click(screen.getByRole('button', { name: 'Convertir en actividad' }));
    await waitFor(() => expect(onConvertir).toHaveBeenCalled());
    expect(promoverImagenDePropuesta).not.toHaveBeenCalled();
  });

  it('y recién al guardar la actividad la propuesta pasa a aceptada, con su id', async () => {
    const onConvertir = montar([propuesta()]);
    await userEvent.click(screen.getByRole('button', { name: 'Convertir en actividad' }));

    await onConvertir.mock.calls[0]![0].alGuardar('act_nueva');
    expect(revisarPropuesta).toHaveBeenCalledWith('p1', 'uid_admin', 'aceptada', {
      actividadId: 'act_nueva',
    });
    expect(medirFuncion).toHaveBeenCalledWith('propuesta-convertida');
  });
});

describe('los otros dos movimientos', () => {
  it('«la estoy mirando» la saca de las que nadie tocó', async () => {
    montar([propuesta()]);
    await userEvent.click(screen.getByRole('button', { name: 'La estoy mirando' }));
    expect(revisarPropuesta).toHaveBeenCalledWith('p1', 'uid_admin', 'en-revision', {});
  });

  it('rechazar pide el motivo antes de escribir, y lo manda', async () => {
    montar([propuesta()]);
    await userEvent.click(screen.getByRole('button', { name: 'Rechazar' }));
    // El click abre el motivo y **no** escribe: es la mitad que evita rechazar
    // de un botonazo.
    expect(revisarPropuesta).not.toHaveBeenCalled();

    await userEvent.type(screen.getByRole('textbox'), 'ya existe en el catálogo');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar el rechazo' }));
    await waitFor(() =>
      expect(revisarPropuesta).toHaveBeenCalledWith('p1', 'uid_admin', 'rechazada', {
        motivo: 'ya existe en el catálogo',
      }),
    );
    await waitFor(() => expect(medirFuncion).toHaveBeenCalledWith('propuesta-rechazada'));
  });

  it('sin motivo escrito se manda `null`, que es la única forma que la regla acepta', async () => {
    montar([propuesta()]);
    await userEvent.click(screen.getByRole('button', { name: 'Rechazar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar el rechazo' }));
    await waitFor(() =>
      expect(revisarPropuesta).toHaveBeenCalledWith('p1', 'uid_admin', 'rechazada', {
        motivo: null,
      }),
    );
  });

  /**
   * **Un rechazo que no se escribió no es un rechazo** — lo encontró el
   * `auditor-trampas`. `mover` atrapa el error y lo muestra en pantalla, así que
   * medir antes del `await` contaba como rechazo lo que la pantalla acababa de
   * reportar como fallido. Y `propuesta-rechazada` es la mitad de lo que decide
   * si `/proponer` vale la pena (§9 del PRD): una racha de fallos de red dejaría
   * esa métrica mintiendo despacio, con la suite en verde.
   *
   * MUTACIÓN PROBADA: midiendo antes del `await`, este caso se pone rojo y el de
   * arriba —el rechazo que sí sale— sigue verde.
   */
  it('y si la escritura falla, no se mide un rechazo que no ocurrió', async () => {
    vi.mocked(revisarPropuesta).mockRejectedValueOnce(new Error('sin permisos'));
    montar([propuesta()]);
    await userEvent.click(screen.getByRole('button', { name: 'Rechazar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar el rechazo' }));

    await waitFor(() => expect(screen.getByText('sin permisos')).toBeTruthy());
    expect(medirFuncion).not.toHaveBeenCalledWith('propuesta-rechazada');
  });

  it('«mejor no» cierra el motivo sin escribir nada', async () => {
    montar([propuesta()]);
    await userEvent.click(screen.getByRole('button', { name: 'Rechazar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Mejor no' }));
    expect(revisarPropuesta).not.toHaveBeenCalled();
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
  });

  it('una rechazada se puede reabrir', async () => {
    montar([propuesta({ estado: 'rechazada' })]);
    await userEvent.click(screen.getByLabelText('Ver aceptadas y rechazadas'));
    await userEvent.click(screen.getByRole('button', { name: 'Reabrir (sin la imagen)' }));
    expect(revisarPropuesta).toHaveBeenCalledWith('p1', 'uid_admin', 'nueva', {});
  });
});

/**
 * El otro lado de D-600: **el chasis**, que es quien tiene el id de la actividad
 * recién guardada.
 *
 * La bandeja arma el `alGuardar` y no lo llama; `AdminApp` lo llama y no sabe qué
 * hace. La propiedad —que se llame **después** de que la actividad se guardó, y
 * solo entonces— no vive entera en ninguno de los dos, así que no la puede fijar
 * un test de componente. Se lee el fuente, con el mismo criterio y el mismo
 * motivo que `tests/salida-del-panel.test.ts`.
 */
describe('el segundo movimiento lo dispara el guardado, no el botón (D-600)', () => {
  // `process.cwd()` y no `import.meta.url`: este archivo corre en jsdom, donde
  // `import.meta.url` es una URL `http` y `fileURLToPath` no la puede resolver.
  const ADMIN_APP = readFileSync(`${process.cwd()}/src/components/admin/AdminApp.tsx`, 'utf8');

  it('`alGuardar` se llama una sola vez, y desde `onGuardado`', () => {
    /*
     * Si se llamara desde el `onConvertir` —que es donde la primera versión de
     * esto lo tentaría a uno a ponerlo— una conversión abandonada dejaría la
     * propuesta `aceptada` apuntando a una actividad que no existe, y eso no lo
     * arregla nadie después: la bandeja ya no la muestra.
     */
    expect([...ADMIN_APP.matchAll(/alGuardar\(/g)]).toHaveLength(1);
    const desdeElGuardado = ADMIN_APP.slice(ADMIN_APP.indexOf('onGuardado={(id'));
    expect(desdeElGuardado).toContain('vista.alGuardar(id)');
  });

  it('y si falla, el panel lo dice: la actividad quedó creada', () => {
    // Sin este aviso, la próxima vez que alguien mire la bandeja la convierte de
    // nuevo y quedan dos actividades de la misma propuesta.
    expect(ADMIN_APP).toMatch(/\.catch\([\s\S]{0,120}setFalloAlAceptar/);
  });
});
