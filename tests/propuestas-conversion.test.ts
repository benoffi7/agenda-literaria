/**
 * **De propuesta a formulario de actividad** — B-830, paso 6, y **D-600**.
 *
 * `src/lib/propuestas.ts` es puro y devuelve un `ActividadForm` prellenado: no
 * escribe nada, y por eso este archivo no necesita emuladores. El orden de las
 * dos escrituras de aceptar —crear la actividad **primero**, después mover
 * `estado` + `revision` en una sola escritura— es del panel y vive en D-600.
 *
 * Lo que se prueba acá, por orden de lo que se rompe en silencio:
 *
 *  1. **el filtro de `incluye` contra la taxonomía**, que es un hallazgo del
 *     `auditor-privacidad` y no una precaución: sin él, un slug inventado se
 *     publica des-slugueado en la página de detalle, que es HTML indexado;
 *  2. **la trampa 1** — la conversión de fechas no toca ninguna zona, y los casos
 *     están escritos para que eso se note: el cruce de medianoche y el de fin de
 *     mes fallarían si la aritmética usara el reloj del proceso. El gate corre la
 *     suite entera una segunda vez con `TZ=Asia/Tokyo`, que es lo que lo
 *     confirma sin que cada caso tenga que moverse el reloj;
 *  3. **la trampa 2** — los ids de encuentro son uuids nuevos, nunca el índice;
 *  4. **lo que NO viaja**, que es donde una ausencia se lee como olvido si nadie
 *     la afirma: el contacto, el estado, el slug y el canal de inscripción.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { sinComentarios } from '../scripts/sin-comentarios.mjs';
import {
  HORAS_POR_DEFECTO,
  aDatetimeLocalDePropuesta,
  avisosDeConversion,
  incluyeDePropuesta,
  modalidadDeActividad,
  propuestaAFormulario,
  sesionDeFecha,
} from '@/lib/propuestas';
import { formAPropuesta, propuestaVacia } from '@/lib/propuesta-schema';
import type { Propuesta, PropuestaForm } from '@/types/propuesta';
import { ts } from './fixtures/tiempo';

const form = (over: Partial<PropuestaForm> = {}): PropuestaForm => ({
  ...propuestaVacia(),
  titulo: 'Taller de crónica urbana',
  descripcion: 'Cuatro encuentros para escribir crónica, con lecturas y consignas.',
  fechas: [{ dia: '2026-10-07', desde: '19:00', hasta: '21:00' }],
  lugar: { nombre: 'Casa Brandon', direccion: 'Luis María Drago 236', barrio: 'villa-crespo' },
  organizador: { nombre: 'Casa Brandon', instagram: '@casabrandon' },
  contacto: { via: 'mail', valor: 'hola@casabrandon.test' },
  ...over,
});

const propuesta = (over: Partial<PropuestaForm> = {}): Propuesta => ({
  ...formAPropuesta(form(over)),
  creadoEn: ts('2026-09-09T12:00:00Z'),
});

const TAXONOMIA = ['merienda', 'material-de-lectura', 'libro', 'cafe'];

describe('el vocabulario se traduce en un solo lugar', () => {
  it('«las dos» es «híbrido»: la jerga del modelo no está en el formulario público', () => {
    expect(modalidadDeActividad('las-dos')).toBe('hibrido');
    expect(modalidadDeActividad('presencial')).toBe('presencial');
    expect(modalidadDeActividad('virtual')).toBe('virtual');
  });

  it('el lugar entra como la primera fila de modalidades, con su cascada', () => {
    const { form: f } = propuestaAFormulario(propuesta());
    expect(f.modalidades).toHaveLength(1);
    expect(f.modalidades[0]!.modalidad).toBe('presencial');
    expect(f.modalidades[0]!.sede?.nombre).toBe('Casa Brandon');
    expect(f.modalidades[0]!.sede?.barrio).toBe('villa-crespo');
    // La cascada del §11 la aplica el módulo del modelo, no este archivo: una
    // fila presencial no lleva bloque online.
    expect(f.modalidades[0]!.online).toBeNull();
  });

  it('una propuesta virtual no arrastra una sede vacía', () => {
    const { form: f } = propuestaAFormulario(propuesta({ modalidad: 'virtual' }));
    expect(f.modalidades[0]!.modalidad).toBe('virtual');
    expect(f.modalidades[0]!.sede).toBeNull();
    expect(f.modalidades[0]!.online).not.toBeNull();
  });

  it('con una sola fecha no es ciclo, con dos sí', () => {
    expect(propuestaAFormulario(propuesta()).form.esCiclo).toBe(false);
    const dos = propuesta({
      fechas: [
        { dia: '2026-10-07', desde: '19:00', hasta: '21:00' },
        { dia: '2026-10-14', desde: '19:00', hasta: '21:00' },
      ],
    });
    expect(propuestaAFormulario(dos).form.esCiclo).toBe(true);
  });
});

describe('las fechas: la trampa 1, sin ninguna zona que arreglar (D-590)', () => {
  it('es una concatenación, no una conversión', () => {
    expect(aDatetimeLocalDePropuesta('2026-10-07', '19:00')).toBe('2026-10-07T19:00');
  });

  it('la hora que escribió quien propone es la que queda', () => {
    const { form: f } = propuestaAFormulario(propuesta());
    expect(f.sesiones[0]!.inicio).toBe('2026-10-07T19:00');
    expect(f.sesiones[0]!.fin).toBe('2026-10-07T21:00');
  });

  /**
   * **El caso que decide que la aritmética no use el reloj.** `sumarHoras` está
   * escrito sobre `Date.UTC` y no sobre `new Date('2026-10-07T23:00')`, que se
   * interpreta en la zona del proceso: con el reloj en Tokio, el segundo daría un
   * `fin` corrido y el CI —que corre en UTC— vería otra cosa que esta máquina.
   * Es la trampa 1 aplicada a la aritmética, no al formateo.
   */
  it('sin hora de fin, suma las horas por defecto y cruza la medianoche bien', () => {
    const sinFin = propuesta({ fechas: [{ dia: '2026-10-07', desde: '23:00', hasta: '' }] });
    const { form: f } = propuestaAFormulario(sinFin);
    expect(f.sesiones[0]!.inicio).toBe('2026-10-07T23:00');
    // 23:00 + 2 = 01:00 del día siguiente, y el día tiene que avanzar.
    expect(f.sesiones[0]!.fin).toBe('2026-10-08T01:00');
  });

  it('y el fin de mes también', () => {
    const finDeMes = propuesta({ fechas: [{ dia: '2026-10-31', desde: '23:30', hasta: '' }] });
    expect(propuestaAFormulario(finDeMes).form.sesiones[0]!.fin).toBe('2026-11-01T01:30');
  });

  /**
   * **La red de la clase, porque el caso no se puede escribir.**
   *
   * La aritmética va sobre `Date.UTC` y el motivo es el **DST**, no la zona del
   * proceso: la versión con reloj local pasa los veinte casos en Buenos Aires y
   * en Tokio —lo mostró la mutación— porque el parseo local y los getters locales
   * se cancelan. Lo que no se cancela es un cambio de horario en el medio:
   * `01:30 + 2h` de reloj local en una zona con DST no da `03:30`.
   *
   * Argentina no tiene DST y el CI corre en UTC, así que el bug estaría dormido,
   * y la suite **no puede cambiar la zona del proceso caso por caso** para
   * despertarlo. Así que lo que se afirma es la forma: que el módulo no use los
   * constructores de reloj local. Mutación probada: reescribir `sumarHoras` con
   * `new Date(\`${dia}T…\`)` + `setHours` deja los veinte casos en verde y **este**
   * en rojo.
   */
  it('la aritmética no usa el reloj del proceso, y eso se afirma sobre el fuente', () => {
    const src = sinComentarios(
      readFileSync(fileURLToPath(new URL('../src/lib/propuestas.ts', import.meta.url)), 'utf8'),
    );
    expect(src, 'la suma de horas dejó de ser aritmética de calendario').toContain('Date.UTC(');
    // Los dos caminos por los que volvería el reloj local.
    expect(src, 'volvió el parseo local de una fecha').not.toMatch(/new Date\(\s*`/);
    expect(src, 'volvió el `setHours` local').not.toContain('setHours(');
    expect(src, 'volvió un getter local').not.toMatch(/\.get(Hours|Date|Month|FullYear)\(/);
  });

  it('las horas por defecto están declaradas y se avisan, no se esconden', () => {
    expect(HORAS_POR_DEFECTO).toBe(2);
    const sinFin = propuesta({ fechas: [{ dia: '2026-10-07', desde: '19:00', hasta: '' }] });
    expect(propuestaAFormulario(sinFin).avisos.join(' ')).toContain('hora de fin');
  });
});

describe('los encuentros: la trampa 2, ids de cliente y nunca el índice', () => {
  it('cada encuentro nace con su `ses_<uuid>`, y son distintos', () => {
    const tres = propuesta({
      fechas: [
        { dia: '2026-10-07', desde: '19:00', hasta: '21:00' },
        { dia: '2026-10-14', desde: '19:00', hasta: '21:00' },
        { dia: '2026-10-21', desde: '19:00', hasta: '21:00' },
      ],
    });
    const ids = propuestaAFormulario(tres).form.sesiones.map((s) => s.id);
    expect(ids.every((id) => id.startsWith('ses_'))).toBe(true);
    expect(new Set(ids).size).toBe(3);
    // Y no son el índice ni nada derivado de él: dos conversiones de la misma
    // propuesta dan ids distintos, que es lo que hace que el diff del §7.2 no
    // pueda confundir dos encuentros (B-90).
    const otraVez = propuestaAFormulario(tres).form.sesiones.map((s) => s.id);
    expect(otraVez).not.toEqual(ids);
  });

  it('el encuentro nace sin `calendarEventId` y sin comisión', () => {
    // Son campos de máquina: heredarlos de algo sería la costura de B-80.
    const s = sesionDeFecha({ dia: '2026-10-07', desde: '19:00', hasta: null });
    expect(s.calendarEventId).toBeNull();
    expect(s.comisionId).toBeNull();
    expect(s.cancelada).toBe(false);
  });
});

describe('`incluye` se filtra contra la taxonomía, y el resto va al texto libre', () => {
  /**
   * **El hallazgo, no la precaución.** Lo cobró el `auditor-privacidad`
   * corrigiendo algo que B-842 afirmaba: «lo protege `actividadFormSchema`». Para
   * `incluye` ese schema es `z.array(texto)`, o sea texto libre — y el camino
   * sigue: `toPublic` lo proyecta, `detallePublico` lo resuelve con `etiquetaDe`,
   * y `listadoPublico` cae a `desSlug(valor)` si el slug no está. O sea que un
   * slug inventado **se publica** des-slugueado en la página de detalle.
   */
  it('los slugs conocidos pasan y los inventados no', () => {
    const p = propuesta({ incluye: ['merienda', 'pizza-gratis', 'libro'] });
    const r = incluyeDePropuesta(p, TAXONOMIA);
    expect(r.incluye).toEqual(['merienda', 'libro']);
    expect(r.sinReconocer).toEqual(['pizza-gratis']);
  });

  it('sin taxonomía cargada, nada pasa — el default no es «dejar entrar»', () => {
    // El default de `slugsConocidos` es `[]`, así que el llamador que se olvide
    // de pasarla no publica nada: es el lado seguro del error.
    const { form: f, avisos } = propuestaAFormulario(propuesta({ incluye: ['merienda'] }));
    expect(f.incluye).toEqual([]);
    expect(avisos.join(' ')).toContain('merienda');
  });

  it('el `incluyeOtro` se junta con los no reconocidos y ninguno se descarta', () => {
    const p = propuesta({ incluye: ['merienda', 'pizza'], incluyeOtro: 'vino de honor' });
    const r = incluyeDePropuesta(p, TAXONOMIA);
    expect(r.sinReconocer).toEqual(['pizza', 'vino de honor']);
  });

  it('lo no reconocido llega al aviso: prellenar y perder es lo mismo si nadie dice', () => {
    const p = propuesta({ incluye: ['pizza'], incluyeOtro: 'vino de honor' });
    const avisos = avisosDeConversion(p, incluyeDePropuesta(p, TAXONOMIA).sinReconocer);
    expect(avisos.join(' ')).toContain('pizza');
    expect(avisos.join(' ')).toContain('vino de honor');
  });
});

describe('lo que NO viaja, y cada ausencia es una decisión', () => {
  it('el contacto de quien propuso no está en ninguna parte del formulario', () => {
    // Es el dato personal del tercero (§5.1, §7 del PRD): interno, no sale de
    // `/propuestas`. El formulario de actividad no tiene dónde ponerlo.
    const { form: f } = propuestaAFormulario(propuesta(), TAXONOMIA);
    const crudo = JSON.stringify(f);
    expect(crudo).not.toContain('hola@casabrandon.test');
    expect(crudo).not.toContain('mail');
  });

  it('la actividad nace borrador: aceptar prellena, no publica (D-17)', () => {
    expect(propuestaAFormulario(propuesta()).form.estado).toBe('borrador');
  });

  it('el slug no se prellena: se arma del título y queda fijo al publicar (trampa 10)', () => {
    // Prellenarlo sería fijar una URL que nadie revisó.
    const { form: f } = propuestaAFormulario(propuesta());
    expect(f.slug).toBe('');
    // Y el título sí viaja tal cual, que es lo que hace que el slug derivado sea
    // el que la persona quiso.
    expect(f.titulo).toBe('Taller de crónica urbana');
  });

  it('el canal de inscripción no se adivina: viaja el `requiere` y nada más', () => {
    // `destino` es **público** (§5.1) y la propuesta solo dice cómo con sus
    // palabras. Adivinar el canal es publicar uno que nadie confirmó.
    const p = propuesta({ inscripcion: { requiere: true, comoDice: 'escribime al DM' } });
    const { form: f, avisos } = propuestaAFormulario(p);
    expect(f.inscripcion.requiere).toBe(true);
    expect(f.inscripcion.via).toBeNull();
    expect(f.inscripcion.destino).toBe('');
    expect(avisos.join(' ')).toContain('inscripción');
  });

  it('la imagen tampoco: promoverla al bucket es de la tajada de DEC-11', () => {
    const p = propuesta({ imagenUrl: 'https://x.test/flyer.jpg' });
    expect(propuestaAFormulario(p).form.imagenes).toEqual([]);
  });
});
