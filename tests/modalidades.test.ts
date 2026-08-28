/**
 * B-224 — las N formas de cursar, cada una con su lugar y su ventana.
 *
 * Lo que este archivo fija, y por qué cada cosa:
 *
 * 1. **Las derivaciones** (`modalidad`, `sede`, `online`). Son lo que hace que
 *    las salidas que solo admiten un valor sigan diciendo algo cierto. Si se
 *    rompen, el filtro del panel y el `location` del evento mienten sin que nada
 *    falle.
 * 2. **Los ids son de cliente** (trampa 2) y sobreviven a las operaciones de la
 *    fila. Es la llave de todo lo que compare filas.
 * 3. **La celda de privacidad de las fechas** (§5.1): hoy no salen a ninguna de
 *    las cinco salidas públicas, porque qué significan frente a los encuentros
 *    sigue sin decidir. Un campo que no sale no puede decir algo equivocado.
 * 4. **La propagación a las N sesiones** (trampa 9, D-07): cambiar la sede de una
 *    modalidad tiene que actualizar los ocho eventos del ciclo, no uno.
 * 5. **La enumeración de `formADocumento`**, que es la guarda que reemplazó a la
 *    poda del autoguardado para `sede` y `online` cuando se mudaron adentro de un
 *    array.
 *
 * Todo puro: no hace falta emulador para nada de esto.
 */
import { describe, expect, it } from 'vitest';
import { construirEvento, planificar } from '@calendario';
import { formADocumento, documentoAForm } from '@/lib/actividades';
import { duplicarActividadForm } from '@/lib/duplicar';
import { formVacio, modalidadVacia } from '@/lib/formulario/estadoInicial';
import { filtrar, FILTROS_VACIOS, opcionesPresentes } from '@/lib/filtrosActividades';
import {
  duplicarModalidad,
  modalidadResultante,
  modalidadesQueOfrece,
  nuevaModalidadId,
  onlinePrincipal,
  sedePrincipal,
  ventanaInvertida,
} from '@/lib/modalidades';
import { toPublic } from '@/lib/toPublic';
import { textoRedesDeForm } from '@/lib/textoRedes';
import type { ActividadConId, ActividadForm, Sede } from '@/types/actividad';

const AHORA = new Date('2026-08-27T12:00:00Z');

const sede = (over: Partial<Sede> = {}): Sede => ({
  nombre: 'Casa Brandon',
  direccion: 'Drago 236',
  barrio: 'villa-crespo',
  ciudad: 'CABA',
  indicaciones: '',
  geo: null,
  ...over,
});

/**
 * Las dos fechas de la ventana, con valores **reconocibles a simple vista**: son
 * las que se buscan en las salidas públicas para afirmar que no están. Un `2026`
 * cualquiera aparecería por casualidad en las fechas de los encuentros.
 */
const VENTANA = { inicio: '2027-03-03T19:00', fin: '2027-06-30T21:00' };

/** Cómo se ven esas fechas una vez convertidas, en las formas que podrían salir. */
const HUELLAS_DE_LA_VENTANA = ['2027-03-03', '2027-06-30', '2027'];

const formConFilas = (filas: ActividadForm['modalidades']): ActividadForm => ({
  ...formVacio(),
  titulo: 'Club de lectura',
  slug: 'club-de-lectura',
  descripcion: 'Ocho encuentros por el boom latinoamericano.',
  organizador: { nombre: 'Casa Brandon', instagram: '', web: '' },
  arancel: { tipo: 'a-la-gorra', notas: '' },
  esCiclo: true,
  estado: 'publicado',
  sesiones: Array.from({ length: 8 }, (_, i) => ({
    id: `ses_${i + 1}`,
    inicio: `2026-09-0${i + 1}T19:00`,
    fin: `2026-09-0${i + 1}T21:00`,
    tema: `Encuentro ${i + 1}`,
    lectura: '',
    cancelada: false,
    calendarEventId: `evt_${i + 1}`,
  })).slice(0, 8),
  modalidades: filas,
});

const presencial = () => ({ ...modalidadVacia('presencial'), id: 'mod_p', sede: sede() });
const virtual = () => ({
  ...modalidadVacia('virtual'),
  id: 'mod_v',
  online: { plataforma: 'meet', url: 'https://meet.example/x', urlPublica: false },
});

const documentoDe = (f: ActividadForm) =>
  formADocumento(f, 'uid_admin', true) as unknown as ActividadConId;

// ───────────────────────────────────────────────────────────────────────────
// 1 · Las derivaciones
// ───────────────────────────────────────────────────────────────────────────

describe('la modalidad de la actividad se deriva de sus filas (B-224)', () => {
  it('una sola fila manda su propio valor', () => {
    expect(modalidadResultante([{ modalidad: 'presencial' }])).toBe('presencial');
    expect(modalidadResultante([{ modalidad: 'virtual' }])).toBe('virtual');
    expect(modalidadResultante([{ modalidad: 'hibrido' }])).toBe('hibrido');
  });

  it('una presencial y una virtual dan híbrido: la actividad es las dos cosas', () => {
    expect(modalidadResultante([{ modalidad: 'presencial' }, { modalidad: 'virtual' }])).toBe(
      'hibrido',
    );
  });

  it('no depende del orden de las filas (trampa 2, en su otra forma)', () => {
    // Si mandara «la primera», reordenar el array cambiaría lo que publica el
    // `events.json` sin que nadie haya cambiado nada.
    const a = modalidadResultante([{ modalidad: 'presencial' }, { modalidad: 'virtual' }]);
    const b = modalidadResultante([{ modalidad: 'virtual' }, { modalidad: 'presencial' }]);
    expect(a).toBe(b);
  });

  it('sin filas cae en presencial, que es el default de `formVacio`', () => {
    expect(modalidadResultante([])).toBe('presencial');
  });

  it('la sede y el online principales son los de la primera fila que los tenga', () => {
    const filas = [virtual(), presencial()];
    expect(sedePrincipal(filas)?.nombre).toBe('Casa Brandon');
    expect(onlinePrincipal(filas)?.plataforma).toBe('meet');
    expect(sedePrincipal([virtual()])).toBeNull();
  });

  it('`formADocumento` escribe las tres derivaciones', () => {
    const doc = documentoDe(formConFilas([presencial(), virtual()]));
    expect(doc.modalidad).toBe('hibrido');
    expect(doc.sede?.nombre).toBe('Casa Brandon');
    expect(doc.online?.plataforma).toBe('meet');
    expect(doc.modalidades).toHaveLength(2);
  });
});

describe('el filtro del panel encuentra por cualquiera de las formas de cursar', () => {
  const actividad = { ...documentoDe(formConFilas([presencial(), virtual()])), id: 'act' };

  it('aparece bajo presencial, bajo virtual y bajo la resultante', () => {
    for (const modalidad of ['presencial', 'virtual', 'hibrido'] as const) {
      expect(
        filtrar([actividad], { ...FILTROS_VACIOS, modalidad }, AHORA),
        `no la encontró filtrando por ${modalidad}`,
      ).toHaveLength(1);
    }
  });

  it('el desplegable ofrece las tres, y no solo la resultante', () => {
    expect(opcionesPresentes([actividad]).modalidades).toEqual([
      'presencial',
      'virtual',
      'hibrido',
    ]);
  });

  it('modalidadesQueOfrece no repite', () => {
    expect(modalidadesQueOfrece([{ modalidad: 'presencial' }, { modalidad: 'presencial' }])).toEqual(
      ['presencial'],
    );
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 2 · Los ids (trampa 2)
// ───────────────────────────────────────────────────────────────────────────

describe('los ids de fila vienen del cliente, nunca del índice (trampa 2)', () => {
  it('`nuevaModalidadId` produce `mod_<uuid>` y no se repite', () => {
    const a = nuevaModalidadId();
    const b = nuevaModalidadId();
    expect(a).toMatch(/^mod_/);
    expect(a).not.toBe(b);
  });

  it('duplicar una fila le da un id nuevo y copia los anidados, no la referencia', () => {
    const original = presencial();
    const copia = duplicarModalidad(original);
    expect(copia.id).not.toBe(original.id);
    expect(copia.sede).toEqual(original.sede);
    expect(copia.sede).not.toBe(original.sede);
  });

  it('duplicar la actividad renumera las filas: dos actividades no comparten ids', () => {
    const o = formConFilas([presencial(), virtual()]);
    const copia = duplicarActividadForm(o, { ahora: AHORA });
    expect(copia.modalidades.map((m) => m.id)).not.toEqual(o.modalidades.map((m) => m.id));
    for (const m of copia.modalidades) expect(m.id).toMatch(/^mod_/);
  });

  it('el ida y vuelta form → documento → form conserva los ids y las fechas', () => {
    const f = formConFilas([{ ...presencial(), ...VENTANA }, virtual()]);
    const vuelta = documentoAForm(documentoDe(f) as never);
    expect(vuelta.modalidades.map((m) => m.id)).toEqual(['mod_p', 'mod_v']);
    expect(vuelta.modalidades[0]!.inicio).toBe(VENTANA.inicio);
    expect(vuelta.modalidades[0]!.fin).toBe(VENTANA.fin);
    // La fila sin ventana vuelve con las dos vacías, no con un «hoy» inventado.
    expect(vuelta.modalidades[1]!.inicio).toBe('');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 3 · La celda de privacidad de las fechas (§5.1)
// ───────────────────────────────────────────────────────────────────────────

describe('las fechas de una modalidad no salen a ninguna salida pública (§5.1)', () => {
  /**
   * **Es una decisión, no un olvido** (B-224, decisión pendiente del dueño): qué
   * significa la ventana frente a `sesiones[].inicio/fin` sigue sin resolver. Un
   * campo que no sale no puede decir algo equivocado en un calendario público, y
   * agregarlo después es barato — sacarlo de algo ya publicado, no.
   *
   * Se buscan las fechas **por su valor** y no por el nombre del campo: es la
   * única manera de ver una fuga que las formatee de otra forma.
   */
  const form = formConFilas([{ ...presencial(), ...VENTANA }]);
  const doc = documentoDe(form);

  it('el documento sí las guarda, como `Timestamp` (trampa 1)', () => {
    // Control positivo: sin esto, todo lo de abajo pasaría porque el dato no
    // existe, y el día que empiece a existir nadie se enteraría.
    expect(doc.modalidades[0]!.inicio?.toMillis()).toBe(new Date(VENTANA.inicio).getTime());
    expect(doc.modalidades[0]!.fin?.toMillis()).toBe(new Date(VENTANA.fin).getTime());
  });

  it('no salen al events.json', () => {
    const json = JSON.stringify(toPublic(doc as never, 'act'));
    for (const huella of HUELLAS_DE_LA_VENTANA) {
      expect(json, `la ventana se escapó al events.json: ${huella}`).not.toContain(huella);
    }
  });

  it('no salen al evento de Calendar', () => {
    const evento = JSON.stringify(construirEvento(doc, doc.sesiones[0], {}));
    for (const huella of HUELLAS_DE_LA_VENTANA) {
      expect(evento, `la ventana se escapó al evento: ${huella}`).not.toContain(huella);
    }
  });

  it('no salen al texto para redes', () => {
    const r = textoRedesDeForm(form, 'anuncio', AHORA, {});
    expect(r.ok).toBe(true);
    if (r.ok) {
      for (const huella of HUELLAS_DE_LA_VENTANA) {
        expect(r.texto, `la ventana se escapó al posteo: ${huella}`).not.toContain(huella);
      }
    }
  });

  it('no salen al searchText, que viaja entero al JSON (§6)', () => {
    expect(String((doc as unknown as { searchText: string }).searchText)).not.toContain('2027');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 4 · La propagación a las N sesiones (trampa 9)
// ───────────────────────────────────────────────────────────────────────────

describe('un cambio de modalidad propaga a las N sesiones del ciclo (trampa 9)', () => {
  const antes = documentoDe(formConFilas([presencial()]));

  it('cambiar la sede de una fila actualiza los ocho eventos, no uno', () => {
    const despues = documentoDe(
      formConFilas([{ ...presencial(), sede: sede({ direccion: 'Corrientes 1234' }) }]),
    );
    const ops = planificar(antes, despues, {});
    expect(ops).toHaveLength(8);
    expect(ops.every((o: { tipo: string }) => o.tipo === 'actualizar')).toBe(true);
  });

  it('agregar una forma de cursar también propaga a las ocho', () => {
    const despues = documentoDe(formConFilas([presencial(), virtual()]));
    const ops = planificar(antes, despues, {});
    expect(ops).toHaveLength(8);
    expect(ops.every((o: { tipo: string }) => o.tipo === 'actualizar')).toBe(true);
  });

  it('cambiar la sede de la SEGUNDA fila también propaga a las ocho', () => {
    /*
     * El caso que la lista hace posible, y el que de verdad fija la trampa 9 acá:
     * con la sede **derivada** —la de la primera fila— en el payload, tocar la
     * segunda no cambiaría nada y los ocho eventos quedarían con la dirección
     * vieja, sin que nada falle. Solo pasa si `construirDescripcion` recorre las
     * filas.
     */
    const dos = [presencial(), { ...presencial(), id: 'mod_p2' }];
    const antesDeDos = documentoDe(formConFilas(dos));
    const despues = documentoDe(
      formConFilas([dos[0]!, { ...dos[1]!, sede: sede({ direccion: 'Corrientes 1234' }) }]),
    );
    const ops = planificar(antesDeDos, despues, {});
    expect(ops).toHaveLength(8);
    expect(ops.every((o: { tipo: string }) => o.tipo === 'actualizar')).toBe(true);
  });

  it('la descripción nombra las dos formas de cursar, con su lugar', () => {
    const doc = documentoDe(formConFilas([presencial(), virtual()]));
    const { description } = construirEvento(doc, doc.sesiones[0], {});
    expect(description).toContain('Modalidad: Presencial');
    expect(description).toContain('Casa Brandon');
    expect(description).toContain('Modalidad: Virtual');
    expect(description).toContain('Plataforma: Meet');
  });

  it('con una sola fila sin ventana la descripción es la de antes de B-224', () => {
    /*
     * Y es deliberado: si el texto cambiara, el diff del §7.2 vería un evento
     * distinto y la primera edición de cada actividad publicada reescribiría sus
     * N eventos en el calendario de todos los suscriptos, sin que nada hubiera
     * cambiado para ellos.
     */
    const doc = documentoDe(formConFilas([presencial()]));
    const { description } = construirEvento(doc, doc.sesiones[0], {});
    expect(description).toContain('Modalidad: Presencial\nCasa Brandon\nDrago 236');
  });

  it('cambiar solo la ventana NO toca el calendario: no sale al evento', () => {
    // La otra cara de la celda de privacidad: como la ventana no entra al
    // payload, prenderla no reescribe los ocho eventos de nadie.
    const despues = documentoDe(formConFilas([{ ...presencial(), ...VENTANA }]));
    expect(planificar(antes, despues, {})).toEqual([]);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 5 · La guarda que reemplazó a la poda del autoguardado
// ───────────────────────────────────────────────────────────────────────────

describe('`formADocumento` enumera la fila: una clave de más no llega a Firestore', () => {
  /**
   * Hasta B-224 esto lo cuidaba la poda de `autoguardado.ts`, que **deja pasar
   * los arrays** a propósito. Al mudar `sede` y `online` adentro de
   * `modalidades`, esa red dejó de alcanzarlos: la que queda es esta enumeración,
   * y es más fuerte —la clave de más no llega ni siquiera al documento.
   */
  it('una clave de más adentro de la sede de una fila no se escribe', () => {
    const conBasura = formConFilas([
      { ...presencial(), sede: { ...sede(), apodoInterno: 'la casa de Ana' } as Sede },
    ]);
    const doc = documentoDe(conBasura);
    expect(JSON.stringify(doc)).not.toContain('apodoInterno');
    expect(doc.modalidades[0]!.sede).not.toHaveProperty('apodoInterno');
  });

  it('una clave de más adentro del bloque online tampoco', () => {
    const conBasura = formConFilas([
      {
        ...virtual(),
        online: { plataforma: 'meet', url: '', urlPublica: false, claveDeLaSala: '1234' } as never,
      },
    ]);
    expect(JSON.stringify(documentoDe(conBasura))).not.toContain('claveDeLaSala');
  });

  it('la sede de una fila que pasó a virtual no se escribe (§11)', () => {
    // El formulario conserva lo cargado al cambiar el selector; es acá donde se
    // decide que no viaja.
    const doc = documentoDe(formConFilas([{ ...presencial(), modalidad: 'virtual' }]));
    expect(doc.modalidades[0]!.sede).toBeNull();
    expect(JSON.stringify(doc)).not.toContain('Drago 236');
  });
});

describe('la ventana invertida se ve antes de guardar', () => {
  it('con las dos fechas al revés, sí', () => {
    expect(ventanaInvertida({ inicio: VENTANA.fin, fin: VENTANA.inicio })).toBe(true);
  });

  it('con una sola de las dos no hay nada que comparar', () => {
    expect(ventanaInvertida({ inicio: VENTANA.inicio, fin: '' })).toBe(false);
    expect(ventanaInvertida({ inicio: '', fin: '' })).toBe(false);
  });
});
