import { describe, expect, it } from 'vitest';
import { analiticaHabilitada } from '@/lib/analytics';
import {
  ACCIONES,
  ANCHOS,
  CAMPOS_VALIDABLES,
  CODIGOS_FIREBASE,
  DETALLES,
  DISPOSITIVOS,
  ESTADOS_DESTINO,
  EVENTOS,
  FORMATO_VERSION,
  FUERA_DE_VOCABULARIO,
  FUNCIONES,
  GRUPOS,
  MODALIDADES_MEDIBLES,
  MODOS,
  MOTIVOS_FALLO,
  NOMBRES_EVENTOS,
  avanceDelFormulario,
  clasificarFalloGuardado,
  construirEvento,
  formaDelFormulario,
  normalizarCampo,
  type NombreEvento,
} from '@/lib/analytics-eventos';
import { actividadFormSchema } from '@/lib/schema';
import { CENTINELAS, VALORES_CENTINELA, formularioLleno } from './fixtures/formulario';

/**
 * **Ningún payload de analítica lleva contenido del formulario.**
 *
 * Es el equivalente, para la analítica, de los tests que verifican que el link
 * de Zoom no sale al calendario: no se confía en la intención del código, se
 * arma el payload y se busca el dato adentro.
 *
 * El fixture llena cada campo de texto con un centinela reconocible
 * (`tests/fixtures/formulario.ts`), incluidos los que el §5.1 prohíbe publicar
 * —link de la reunión, difusión interna, URL de material privado— y además el
 * uid y el mail del admin, que no salen ni al `events.json` ni a acá.
 */

/** Todos los vocabularios cerrados: lo único que un string puede llegar a ser. */
const VOCABULARIO = new Set<string>([
  ...DISPOSITIVOS,
  ...ANCHOS,
  ...MODOS,
  ...ACCIONES,
  ...ESTADOS_DESTINO,
  ...MODALIDADES_MEDIBLES,
  ...MOTIVOS_FALLO,
  ...CODIGOS_FIREBASE,
  ...FUNCIONES,
  ...DETALLES,
  ...GRUPOS,
  FUERA_DE_VOCABULARIO,
  '',
]);

/**
 * Un valor de parámetro es admisible si es un número, o texto de vocabulario.
 *
 * B-165 — `FORMATO_VERSION` se **importa** del código que sanea, no se copia.
 * Acá había una tercera copia del formato, y B-88 amplió el real sin tocarla:
 * quedó estrictamente más angosta que la que el código acepta. Eso no podía
 * volverse una fuga —al ser más angosta, lo único que podía hacer era rechazar
 * un valor que el código sí acepta, o sea dar una falsa alarma— pero un
 * predicado de admisibilidad que no es el del productor no está verificando lo
 * que dice verificar.
 *
 * Que el consumidor derive por su cuenta el formato del productor es la clase de
 * B-88, y este archivo era una instancia con la red puesta al lado. La guarda
 * contra la próxima copia está en `tests/clases-de-bug.test.ts`.
 */
const esAdmisible = (valor: unknown): boolean => {
  if (typeof valor === 'number') return Number.isFinite(valor);
  if (typeof valor !== 'string') return false;
  if (FORMATO_VERSION.test(valor)) return true;
  // Las listas viajan unidas por coma; cada token va por separado.
  return valor
    .split(',')
    .every((token) => VOCABULARIO.has(token) || CAMPOS_VALIDABLES.has(token));
};

const revisar = (evento: { nombre: string; params: Record<string, unknown> } | null) => {
  expect(evento).not.toBeNull();
  const serializado = JSON.stringify(evento);
  for (const centinela of VALORES_CENTINELA) {
    expect(serializado).not.toContain(centinela);
  }
  for (const [param, valor] of Object.entries(evento!.params)) {
    // Ni objetos ni arrays: un valor anidado podría esconder contenido.
    expect(['string', 'number']).toContain(typeof valor);
    expect(String(valor).length).toBeLessThanOrEqual(100);
    expect(esAdmisible(valor), `${evento!.nombre}.${param} = ${String(valor)}`).toBe(true);
  }
};

describe('la analítica no se puede llevar contenido del formulario', () => {
  it('un centinela en CADA parámetro declarado de CADA evento no sobrevive', () => {
    // Esta es la garantía estructural: si mañana alguien agrega un parámetro
    // que acepte texto libre, este test falla sin que haya que acordarse de
    // escribirle un caso propio.
    for (const nombre of NOMBRES_EVENTOS) {
      for (const param of Object.keys(EVENTOS[nombre])) {
        for (const centinela of VALORES_CENTINELA) {
          revisar(construirEvento(nombre, { [param]: centinela }));
          revisar(construirEvento(nombre, { [param]: [centinela, centinela] }));
        }
      }
    }
  });

  it('los centinelas metidos en parámetros NO declarados se descartan', () => {
    const contrabando: Record<string, unknown> = {
      titulo: CENTINELAS.titulo,
      descripcion: CENTINELAS.descripcion,
      email: CENTINELAS.mailAdmin,
      uid: CENTINELAS.uid,
      url: CENTINELAS.linkReunion,
      form: formularioLleno(),
    };
    for (const nombre of NOMBRES_EVENTOS) {
      revisar(construirEvento(nombre, contrabando));
    }
  });

  it('el formulario entero como parámetros no filtra nada', () => {
    // El peor caso imaginable: alguien pasa el estado del formulario tal cual.
    const form = formularioLleno() as unknown as Record<string, unknown>;
    for (const nombre of NOMBRES_EVENTOS) {
      revisar(construirEvento(nombre, form));
    }
  });

  it('un nombre de evento inventado no manda nada', () => {
    expect(construirEvento('titulo_de_la_actividad', { titulo: CENTINELAS.titulo })).toBeNull();
  });
});

describe('los payloads reales de los puntos de medición', () => {
  const form = formularioLleno();

  it('guardado_ok describe la actividad sin nombrarla', () => {
    revisar(
      construirEvento('guardado_ok', {
        dispositivo: 'mobile',
        ancho: 'xs',
        modo: 'nueva',
        accion: 'submit',
        segundos: 412,
        intentos_validacion: 2,
        ...formaDelFormulario(form),
      }),
    );
  });

  /**
   * DEC-1, §5.1 — de la analítica sale **si el libro se cargó o no**, nunca el
   * título de la obra ni su autor. Los dos son texto libre y no hay sanitizador
   * de texto libre (§9 de `docs/07-seguridad.md`): la única forma de que un
   * título no se escape es que el valor sea un booleano.
   *
   * El centinela del fixture es lo que fija esta celda: `revisar()` recorre
   * todos los centinelas, así que mandar `libro: form.libro.titulo` por descuido
   * en cualquier evento pone rojo esto.
   */
  it('del libro presentado sale el booleano, nunca el título (DEC-1, §5.1)', () => {
    const evento = construirEvento('guardado_ok', {
      dispositivo: 'mobile',
      ancho: 'xs',
      modo: 'nueva',
      accion: 'submit',
      ...formaDelFormulario(form),
    });
    revisar(evento);
    expect(evento!.params.tiene_libro).toBe(1);
    expect(
      formaDelFormulario(formularioLleno({ libro: { titulo: '', autor: '' } })).tiene_libro,
    ).toBe(false);
  });

  /**
   * B-97, §5.1 — de la analítica sale **si estaba marcada como completa**, y nada
   * más. Es un booleano, así que no hay contenido posible: no existe el número de
   * lugares que quedan (§3.1: booleano y no contador) ni el destino de la
   * inscripción, que es el campo de al lado y sí es texto libre — su centinela lo
   * cuida en el mismo payload.
   */
  it('del cupo completo sale el booleano y nada más (B-97, §5.1)', () => {
    const evento = construirEvento('guardado_ok', {
      dispositivo: 'mobile',
      ancho: 'xs',
      modo: 'nueva',
      accion: 'submit',
      ...formaDelFormulario(form),
    });
    revisar(evento);
    expect(evento!.params.cupo_completo).toBe(1);
    expect(
      formaDelFormulario(
        formularioLleno({ inscripcion: { ...form.inscripcion, completo: false } }),
      ).cupo_completo,
    ).toBe(false);
  });

  it('la ruta del campo del cupo viaja: es el nombre, no el estado (B-97, D-60)', () => {
    // Lo que la analítica necesita para decir «el schema rechaza esto» es la ruta
    // `inscripcion.completo`, que es vocabulario cerrado derivado del schema.
    expect(normalizarCampo('inscripcion.completo')).toBe('inscripcion.completo');
  });

  it('la ruta del campo sí viaja: es el nombre, no el valor (DEC-1, D-60)', () => {
    // Lo que la analítica necesita para decir «la gente se traba en el libro» es
    // la ruta `libro.titulo`, que es vocabulario cerrado derivado del schema.
    expect(normalizarCampo('libro.titulo')).toBe('libro.titulo');
    expect(normalizarCampo(CENTINELAS.libro)).toBe(FUERA_DE_VOCABULARIO);
  });

  it('formulario_abandonado dice en qué grupo se trabó, no qué escribió', () => {
    const { completos, faltantes } = avanceDelFormulario(
      formularioLleno({ material: { tiene: true, items: [] } }),
    );
    revisar(
      construirEvento('formulario_abandonado', {
        modo: 'duplicar',
        segundos: 95,
        avance: completos.length,
        faltantes,
        encuentros: form.sesiones.length,
        intentos_validacion: 1,
      }),
    );
  });

  it('validacion_fallida lleva las rutas del schema, no los valores', () => {
    // Se usan los issues de verdad que produce zod sobre un formulario roto,
    // no una lista inventada: es el mismo dato que ve el componente.
    const roto = formularioLleno({
      titulo: '',
      descripcion: '',
      arancel: { tipo: '', notas: CENTINELAS.notasArancel },
      sesiones: [
        {
          id: 'ses_3333',
          inicio: '2026-09-10T21:00',
          fin: '2026-09-10T19:00',
          tema: CENTINELAS.tema,
          lectura: CENTINELAS.lectura,
          cancelada: false,
          calendarEventId: null,
        },
      ],
      inscripcion: {
        requiere: true,
        via: null,
        destino: '',
        cupo: null,
        cierra: '',
        completo: false,
      },
    });
    const parsed = actividadFormSchema.safeParse(roto);
    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    const campos = parsed.error.issues.map((i) => i.path.join('.'));
    expect(campos.length).toBeGreaterThan(0);

    revisar(construirEvento('validacion_fallida', { cantidad: campos.length, campos }));
    for (const campo of campos) {
      revisar(construirEvento('campo_invalido', { campo }));
      // Y además: los paths de zod son rutas reconocidas, no "otro". Si esto
      // falla, la analítica funciona pero no sirve para nada.
      expect(normalizarCampo(campo)).not.toBe(FUERA_DE_VOCABULARIO);
    }
  });

  it('guardado_fallido no arrastra el mensaje del error', () => {
    const errores: unknown[] = [
      'slug-tomado',
      new Error(`Fecha inválida: "${CENTINELAS.titulo}"`),
      { code: 'permission-denied', message: `no se pudo escribir ${CENTINELAS.uid}` },
      new Error(`falló guardando ${CENTINELAS.mailInscripcion}`),
    ];
    for (const e of errores) {
      revisar(construirEvento('guardado_fallido', clasificarFalloGuardado(e)));
    }
  });
});

describe('no se mide en desarrollo', () => {
  it('con los emuladores prendidos la analítica está apagada', () => {
    // `vitest.config.ts` corre con PUBLIC_USE_EMULATORS=true, igual que
    // `npm run dev`: en este entorno no puede salir un solo evento.
    expect(analiticaHabilitada()).toBe(false);
  });
});

describe('la taxonomía es chica y estable', () => {
  it('son pocos eventos, con nombres explícitos', () => {
    // Cincuenta eventos sueltos no se analizan; diez bien elegidos sí. El tope
    // es para que agregar el número once sea una decisión, no un descuido.
    expect(NOMBRES_EVENTOS.length).toBeLessThanOrEqual(10);
  });

  it('los nombres documentados son exactamente los implementados', () => {
    // Si se agrega un evento sin documentarlo, el valor de esto se pierde a los
    // tres meses: nadie se acuerda qué medía cada nombre.
    const nombres: NombreEvento[] = [
      'panel_abierto',
      'formulario_abierto',
      'formulario_abandonado',
      'validacion_fallida',
      'campo_invalido',
      'guardado_ok',
      'guardado_fallido',
      'funcion_usada',
    ];
    expect([...NOMBRES_EVENTOS].sort()).toEqual([...nombres].sort());
  });
});
