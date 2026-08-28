import { describe, expect, it } from 'vitest';
import {
  ANCHOS,
  CAMPOS_TAXONOMIA_MEDIBLES,
  CAMPOS_VALIDABLES,
  DETALLES,
  ESTADOS_DESTINO,
  EVENTOS,
  GRUPOS,
  MODALIDADES_MEDIBLES,
  MOTIVOS_IMAGEN,
  NOMBRES_EVENTOS,
  avanceDelFormulario,
  bucketDeAncho,
  clasificarFalloGuardado,
  construirEvento,
  debeMedir,
  dispositivoDe,
  formaDelFormulario,
  normalizarCampo,
  seccionASlug,
} from '@/lib/analytics-eventos';
import { CAMPOS_TAXONOMIA, ESTADOS, MODALIDADES } from '@/types/actividad';
import { formularioLleno } from './fixtures/formulario';

/**
 * Analítica del panel — qué se manda y cuándo.
 *
 * La garantía de privacidad tiene su propio archivo
 * (`analytics-privacidad.test.ts`), que es el equivalente de los tests que
 * verifican que el link de Zoom no sale al calendario.
 */

describe('debeMedir — los tres portones', () => {
  const base = { navegador: true, emuladores: false, measurementId: 'G-XXXX' };

  it('mide en un navegador de producción con measurementId', () => {
    expect(debeMedir(base)).toBe(true);
  });

  it('NO mide con los emuladores prendidos', () => {
    // Si midiera, las pruebas de desarrollo contaminan los datos de producción
    // y el panel deja de servir para lo que se instrumentó.
    expect(debeMedir({ ...base, emuladores: true })).toBe(false);
  });

  it('NO mide sin measurementId', () => {
    expect(debeMedir({ ...base, measurementId: undefined })).toBe(false);
    expect(debeMedir({ ...base, measurementId: '   ' })).toBe(false);
  });

  it('NO mide fuera del navegador (el build de Astro corre en Node)', () => {
    expect(debeMedir({ ...base, navegador: false })).toBe(false);
  });
});

describe('construirEvento — whitelist en las dos direcciones', () => {
  it('un evento no declarado no se manda', () => {
    expect(construirEvento('evento_inventado', { cantidad: 1 })).toBeNull();
  });

  it('un parámetro no declarado en ese evento se descarta', () => {
    const e = construirEvento('panel_abierto', {
      dispositivo: 'mobile',
      titulo: 'Taller de crónica',
    });
    expect(e?.params).toEqual({ dispositivo: 'mobile' });
  });

  it('un valor fuera del vocabulario se reemplaza por "otro"', () => {
    const e = construirEvento('formulario_abierto', { modo: 'club de lectura de los martes' });
    expect(e?.params.modo).toBe('otro');
  });

  it('los booleanos viajan como 0 y 1', () => {
    const a = construirEvento('guardado_ok', { es_ciclo: true, url_publica: false });
    expect(a?.params.es_ciclo).toBe(1);
    expect(a?.params.url_publica).toBe(0);
  });

  it('los enteros se redondean y se acotan al máximo declarado', () => {
    const e = construirEvento('formulario_abandonado', { segundos: 999_999, avance: 2.6 });
    expect(e?.params.segundos).toBe(7200);
    expect(e?.params.avance).toBe(3);
  });

  it('un entero que no es número se omite en lugar de viajar como texto', () => {
    const e = construirEvento('funcion_usada', { funcion: 'encuentros-generar', valor: 'ocho' });
    expect(e?.params).not.toHaveProperty('valor');
  });

  it('undefined y null no generan parámetro', () => {
    const e = construirEvento('funcion_usada', {
      funcion: 'taxonomia-otro',
      detalle: undefined,
      valor: null,
    });
    expect(Object.keys(e!.params).sort()).toEqual(['funcion']);
  });

  it('la lista de campos se ordena, deduplica y no repite', () => {
    const e = construirEvento('validacion_fallida', {
      campos: ['titulo', 'arancel.tipo', 'titulo'],
    });
    expect(e?.params.campos).toBe('arancel.tipo,titulo');
  });

  it('la lista de campos se corta en 100 caracteres sin partir un token', () => {
    const muchos = [...CAMPOS_VALIDABLES].slice(0, 40);
    const e = construirEvento('validacion_fallida', { campos: muchos });
    const valor = String(e?.params.campos);
    expect(valor.length).toBeLessThanOrEqual(100);
    // Todo lo que quedó tiene que seguir siendo una ruta entera.
    for (const parte of valor.split(',')) expect(CAMPOS_VALIDABLES.has(parte)).toBe(true);
  });

  it('la lista de grupos filtra lo que no es un grupo conocido', () => {
    const e = construirEvento('formulario_abandonado', {
      faltantes: ['encuentros', 'Casa Brandon', 'quien'],
    });
    expect(e?.params.faltantes).toBe('encuentros,quien');
  });

  it('todos los eventos declaran dispositivo y ancho', () => {
    // Mobile vs escritorio es la mitad del análisis: el bug del zoom de iOS
    // solo se ve si cada evento trae de dónde vino.
    for (const nombre of NOMBRES_EVENTOS) {
      expect(Object.keys(EVENTOS[nombre])).toContain('dispositivo');
      expect(Object.keys(EVENTOS[nombre])).toContain('ancho');
    }
  });

  it('ningún evento pasa el tope de 25 parámetros de GA4', () => {
    for (const nombre of NOMBRES_EVENTOS) {
      expect(Object.keys(EVENTOS[nombre]).length).toBeLessThanOrEqual(25);
    }
  });

  it('la versión viaja solo si tiene el formato esperado', () => {
    // Sin la versión, un pico de errores no se puede atribuir a un deploy. Con
    // formato libre, sería una puerta abierta a texto arbitrario.
    expect(construirEvento('panel_abierto', { version: '0.1.0+5e2cb50' })?.params.version).toBe(
      '0.1.0+5e2cb50',
    );
    expect(construirEvento('panel_abierto', { version: '1.2.3' })?.params.version).toBe('1.2.3');
    expect(
      construirEvento('panel_abierto', { version: 'Taller de crónica urbana' })?.params.version,
    ).toBe('otro');
  });

  it('todos los eventos declaran la versión', () => {
    for (const nombre of NOMBRES_EVENTOS) {
      expect(Object.keys(EVENTOS[nombre])).toContain('version');
    }
  });

  it('los vocabularios del modelo no son copias: son el mismo objeto (B-75)', () => {
    // La guardia es la identidad, no la igualdad: si mañana alguien vuelve a
    // escribir la lista al lado del import, `toBe` falla aunque los valores
    // coincidan hoy. Eso es lo que evita el modo de falla del B-75 — un quinto
    // `estado` en el modelo que la analítica reporta como `otro` en silencio.
    expect(ESTADOS_DESTINO).toBe(ESTADOS);
    expect(MODALIDADES_MEDIBLES).toBe(MODALIDADES);
    expect(CAMPOS_TAXONOMIA_MEDIBLES).toBe(CAMPOS_TAXONOMIA);
  });

  it('los enums del modelo llegan enteros a la especificación del evento', () => {
    // Que el vocabulario del parámetro sea el del modelo no alcanza si el
    // evento declara otro: se verifica contra el payload real.
    for (const estado of ESTADOS) {
      expect(construirEvento('guardado_ok', { estado })?.params.estado).toBe(estado);
    }
    for (const modalidad of MODALIDADES) {
      expect(construirEvento('guardado_ok', { modalidad })?.params.modalidad).toBe(modalidad);
    }
    for (const campo of CAMPOS_TAXONOMIA) {
      expect(
        construirEvento('funcion_usada', { funcion: 'taxonomia-otro', detalle: campo })?.params
          .detalle,
      ).toBe(campo);
    }
  });

  it('los nombres son válidos para GA4 y no usan un prefijo reservado', () => {
    for (const nombre of NOMBRES_EVENTOS) {
      expect(nombre).toMatch(/^[a-z][a-z0-9_]{0,39}$/);
      expect(nombre).not.toMatch(/^(firebase_|google_|ga_)/);
    }
  });
});

describe('normalizarCampo — rutas derivadas del schema', () => {
  it('el vocabulario sale del schema, no de una lista a mano', () => {
    // Si la derivación se rompe (por ejemplo con un cambio de zod), esto falla
    // en vez de reportar todos los campos como "otro" en silencio.
    expect(CAMPOS_VALIDABLES.size).toBeGreaterThan(30);
    for (const esperado of [
      'titulo',
      'arancel.tipo',
      'sede.direccion',
      'online.plataforma',
      'inscripcion.destino',
      'sesiones',
      'sesiones.N.fin',
      'material.items.N.titulo',
    ]) {
      expect(CAMPOS_VALIDABLES.has(esperado)).toBe(true);
    }
  });

  it('colapsa el índice de la fila: lo que importa es qué campo falla', () => {
    expect(normalizarCampo('sesiones.3.fin')).toBe('sesiones.N.fin');
    expect(normalizarCampo(['sesiones', 7, 'inicio'])).toBe('sesiones.N.inicio');
  });

  it('una ruta que no es del schema cae en "otro"', () => {
    expect(normalizarCampo('titulo.raro.inventado')).toBe('otro');
    expect(normalizarCampo(42)).toBe('otro');
  });
});

describe('clasificarFalloGuardado — motivo, nunca el mensaje', () => {
  it('reconoce el permiso denegado de Firestore', () => {
    expect(clasificarFalloGuardado({ code: 'permission-denied' })).toEqual({
      motivo: 'permisos',
      codigo: 'permission-denied',
    });
  });

  it('reconoce los códigos con prefijo del SDK', () => {
    expect(clasificarFalloGuardado({ code: 'firestore/unavailable' })).toEqual({
      motivo: 'red',
      codigo: 'unavailable',
    });
  });

  it('el slug tomado se pasa como motivo directo', () => {
    expect(clasificarFalloGuardado('slug-tomado').motivo).toBe('slug-tomado');
  });

  it('una fecha inválida se reconoce SIN llevarse lo que se escribió', () => {
    // `formADocumento` tira `Fecha inválida: "<lo tipeado>"`: el mensaje es
    // contenido del formulario y no puede salir.
    const r = clasificarFalloGuardado(new Error('Fecha inválida: "el martes que viene"'));
    expect(r).toEqual({ motivo: 'fecha-invalida' });
  });

  it('un error desconocido no arrastra su mensaje', () => {
    const r = clasificarFalloGuardado(new Error('falló al escribir Taller de crónica urbana'));
    expect(r).toEqual({ motivo: 'desconocido' });
  });

  it('un código que no está en la lista no viaja', () => {
    const r = clasificarFalloGuardado({ code: 'algo-nuevo-del-sdk' });
    expect(r).toEqual({ motivo: 'desconocido' });
  });
});

describe('avanceDelFormulario — dónde quedó una carga abandonada', () => {
  it('un formulario completo no tiene faltantes', () => {
    expect(avanceDelFormulario(formularioLleno()).faltantes).toEqual([]);
  });

  it('un formulario recién abierto tiene casi todo pendiente', () => {
    const vacio = formularioLleno({
      tipo: '' as never,
      titulo: '',
      descripcion: '',
      organizador: { nombre: '', instagram: '', web: '' },
      arancel: { tipo: '', notas: '' },
      sesiones: [],
    });
    const { faltantes } = avanceDelFormulario(vacio);
    expect(faltantes).toContain('que-es');
    expect(faltantes).toContain('encuentros');
    expect(faltantes).toContain('quien');
    expect(faltantes).toContain('arancel');
  });

  it('una actividad virtual no reclama sede', () => {
    const virtual = formularioLleno({
      modalidad: 'virtual',
      sede: null,
      online: { plataforma: 'zoom', url: '', urlPublica: false },
    });
    expect(avanceDelFormulario(virtual).faltantes).not.toContain('donde');
  });

  it('una actividad presencial sin dirección se traba en "donde"', () => {
    const sinDireccion = formularioLleno({
      sede: {
        nombre: 'Casa Brandon',
        direccion: '',
        barrio: '',
        ciudad: 'CABA',
        indicaciones: '',
        geo: null,
      },
    });
    expect(avanceDelFormulario(sinDireccion).faltantes).toContain('donde');
  });

  it('inscripción sin destino se traba en "inscripcion"', () => {
    const sinDestino = formularioLleno({
      inscripcion: {
        requiere: true,
        via: 'mail',
        destino: '',
        cupo: null,
        cierra: '',
        completo: false,
      },
    });
    expect(avanceDelFormulario(sinDestino).faltantes).toContain('inscripcion');
  });

  it('material tildado sin items se traba en "material"', () => {
    const sinItems = formularioLleno({ material: { tiene: true, items: [] } });
    expect(avanceDelFormulario(sinItems).faltantes).toContain('material');
  });

  it('completos y faltantes siempre suman todos los grupos', () => {
    const { completos, faltantes } = avanceDelFormulario(formularioLleno());
    expect(completos.length + faltantes.length).toBe(GRUPOS.length);
  });
});

describe('formaDelFormulario — contadores, no contenido', () => {
  it('describe la actividad guardada con números y booleanos', () => {
    const forma = formaDelFormulario(formularioLleno());
    expect(forma.encuentros).toBe(2);
    expect(forma.modalidad).toBe('presencial');
    expect(forma.tags).toBe(1);
    expect(forma.requiere_inscripcion).toBe(true);
    expect(forma.tiene_tallerista).toBe(true);
  });

  it('url_publica es false si el flag está prendido pero no hay link', () => {
    // Mismo criterio que `toPublic`: sin URL cargada no se inventa el campo.
    const forma = formaDelFormulario(
      formularioLleno({
        modalidad: 'virtual',
        online: { plataforma: 'zoom', url: '', urlPublica: true },
      }),
    );
    expect(forma.url_publica).toBe(false);
  });

  it('no cuenta los materiales si la casilla está destildada', () => {
    const forma = formaDelFormulario(
      formularioLleno({
        material: {
          tiene: false,
          items: [
            {
              tipo: 'lectura',
              titulo: 'Pedro Páramo',
              url: '',
              entrega: 'previo',
              publico: false,
            },
          ],
        },
      }),
    );
    expect(forma.material_items).toBe(0);
  });
});

describe('contexto de dispositivo', () => {
  it('clasifica por ancho y grosor del puntero, no por user agent', () => {
    expect(dispositivoDe(375, true)).toBe('mobile');
    expect(dispositivoDe(834, true)).toBe('tablet');
    expect(dispositivoDe(1440, false)).toBe('escritorio');
    // Un escritorio angosto se lee como mobile: es el layout lo que importa.
    expect(dispositivoDe(360, false)).toBe('mobile');
  });

  it('los buckets de ancho cubren los cortes del layout', () => {
    expect(bucketDeAncho(360)).toBe('xs');
    expect(bucketDeAncho(430)).toBe('sm');
    expect(bucketDeAncho(820)).toBe('md');
    expect(bucketDeAncho(1512)).toBe('lg');
    for (const ancho of [0, 1, 767, 768, 5000]) {
      expect(ANCHOS).toContain(bucketDeAncho(ancho));
    }
  });
});

describe('seccionASlug — los títulos de sección son literales del código', () => {
  it('resuelve las secciones del formulario', () => {
    expect(seccionASlug('Qué es')).toBe('que-es');
    expect(seccionASlug('Arancel e inscripción')).toBe('arancel-e-inscripcion');
    expect(seccionASlug('Difusión')).toBe('difusion');
  });

  it('un título desconocido no viaja como texto', () => {
    expect(seccionASlug('Taller de crónica urbana')).toBe('otro');
  });
});

describe('los motivos de rechazo de una imagen sobreviven al sanitizador — B-167, B-88', () => {
  it('los cuatro están en el vocabulario de `detalle`', () => {
    // La clase de B-88: productor y consumidor del mismo vocabulario declarados
    // por separado. Acá el modo de falla es **mudo** — un motivo que `DETALLES`
    // no conoce llega a GA4 como `otro`, los cuatro rechazos quedan
    // indistinguibles, y `imagen-rechazada` deja de ser el termómetro del tope de
    // 3 MB sin que nada se ponga rojo. Por eso `ImagenRechazada.causa` **importa**
    // el tipo de acá en vez de repetir la unión.
    for (const motivo of MOTIVOS_IMAGEN) {
      expect(DETALLES as readonly string[], motivo).toContain(motivo);
    }
  });

  it('y llegan enteros al evento, no como «otro»', () => {
    for (const motivo of MOTIVOS_IMAGEN) {
      const evento = construirEvento('funcion_usada', {
        funcion: 'imagen-rechazada',
        detalle: motivo,
      });
      expect(evento?.params.detalle, motivo).toBe(motivo);
    }
  });
});
