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

/** Un valor de parámetro es admisible si es un número, o texto de vocabulario. */
const FORMATO_VERSION = /^\d{1,3}\.\d{1,3}\.\d{1,3}(?:[-+][0-9A-Za-z.]{1,20})?$/;

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
      inscripcion: { requiere: true, via: null, destino: '', cupo: null, cierra: '' },
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
