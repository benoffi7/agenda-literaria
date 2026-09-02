import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// La Function es JS plano; TS le infiere los tipos con allowJs.
import {
  actividadParaIssue,
  construirIssue,
  decidirAccion,
  esReintentable,
  estadoTrasFallo,
  MAX_INTENTOS,
  redactar,
} from '../functions/reportes.js';
import { formAReporte, reporteFormSchema, reporteVacio } from '@/lib/reporte-schema';
import type { ContextoReporte, ReporteForm } from '@/types/reporte';
import { ts } from './fixtures/tiempo';



const contexto = (): ContextoReporte => ({
  versionPanel: '0.1.0 (2026-08-21 12:00 UTC)',
  navegador: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)',
  ventana: '390×844 @3x',
  zonaHoraria: 'America/Argentina/Buenos_Aires',
  url: '/admin',
  pantalla: 'nueva-actividad',
});

const reporte = (over: Record<string, unknown> = {}) => ({
  tipo: 'bug',
  titulo: 'No puedo guardar un borrador',
  descripcion: 'Toco guardar y no pasa nada.',
  pasos: '1) entré a nueva actividad 2) toqué guardar',
  severidad: 'me-bloquea',
  actividad: null,
  contexto: contexto(),
  reportadoPor: { uid: 'uid_tia_hilda', email: 'tia-hilda@ejemplo.com' },
  estado: 'pendiente',
  intentos: 0,
  github: null,
  error: null,
  creadoEn: ts('2026-08-21T18:30:00Z'),
  ...over,
});

describe('redactar — el repo de GitHub es público (§5.1, trampa 5)', () => {
  it('tapa los mails que se hayan colado en el texto', () => {
    expect(redactar('escribile a hola@casabrandon.example y listo')).toBe(
      'escribile a «mail oculto» y listo',
    );
  });

  it('tapa los links de reunión', () => {
    for (const link of [
      'https://us02web.zoom.us/j/8123?pwd=secreto',
      'https://meet.google.com/abc-defg-hij',
      'https://wa.me/5491122223333',
    ]) {
      expect(redactar(`el link es ${link} ojo`)).toBe('el link es «link de reunión oculto» ojo');
    }
  });

  it('no toca un texto común ni un link inofensivo', () => {
    const t = 'el botón de la home https://agendaleh.ar/admin no responde';
    expect(redactar(t)).toBe(t);
  });
});

describe('decidirAccion — guarda anti-loop y anti-duplicado (§7.1, trampa 3)', () => {
  it('envía un reporte pendiente y cuenta el intento', () => {
    expect(decidirAccion(reporte())).toEqual({ accion: 'enviar', intento: 1 });
  });

  it('ignora la escritura de vuelta del número de issue', () => {
    // Es la segunda pasada del trigger: sin esto el issue se duplicaría en loop.
    const d = decidirAccion(reporte({ estado: 'creado', github: { numero: 7, url: 'x' } }));
    expect(d.accion).toBe('ignorar');
  });

  it('ignora un reporte que ya tiene issue aunque el estado diga otra cosa', () => {
    // La entrega de eventos de Firestore es "al menos una vez": un evento
    // repetido no puede crear un segundo issue.
    const d = decidirAccion(reporte({ estado: 'pendiente', github: { numero: 7, url: 'x' } }));
    expect(d.accion).toBe('ignorar');
  });

  it('ignora el que ya está en vuelo', () => {
    expect(decidirAccion(reporte({ estado: 'enviando', intentos: 1 })).accion).toBe('ignorar');
  });

  it('corta la cadena de reintentos', () => {
    expect(decidirAccion(reporte({ intentos: MAX_INTENTOS })).accion).toBe('ignorar');
  });

  it('ignora un documento borrado', () => {
    expect(decidirAccion(null).accion).toBe('ignorar');
  });
});

describe('reintentos', () => {
  it('reintenta lo transitorio y no lo que es configuración', () => {
    expect(esReintentable(500)).toBe(true);
    expect(esReintentable(502)).toBe(true);
    expect(esReintentable(429)).toBe(true);
    expect(esReintentable(null)).toBe(true); // error de red
    expect(esReintentable(401)).toBe(false); // token vencido
    expect(esReintentable(403)).toBe(false); // sin permiso sobre el repo
    expect(esReintentable(404)).toBe(false); // repo mal escrito
    expect(esReintentable(422)).toBe(false);
  });

  it('vuelve a pendiente mientras queden intentos, y si no lo deja en error', () => {
    expect(estadoTrasFallo(1, 500)).toBe('pendiente');
    expect(estadoTrasFallo(MAX_INTENTOS, 500)).toBe('error');
    expect(estadoTrasFallo(1, 401)).toBe('error');
  });
});

describe('construirIssue', () => {
  it('pone el tipo en el título y en las etiquetas', () => {
    const i = construirIssue({ id: 'rep1', reporte: reporte() });
    expect(i.title).toBe('[bug] No puedo guardar un borrador');
    expect(i.labels).toEqual(['reporte-panel', 'bug']);
  });

  it('NO publica quién lo cargó: ni el uid ni el mail (§5.1)', () => {
    const i = construirIssue({ id: 'rep1', reporte: reporte() });
    expect(i.body).not.toContain('uid_tia_hilda');
    expect(i.body).not.toContain('librosdelatiahilda');
    // La trazabilidad queda en Firestore, que solo leen los admins.
    expect(i.body).toContain('reportes/rep1');
  });

  it('lleva el contexto que evita el ida y vuelta', () => {
    const i = construirIssue({ id: 'rep1', reporte: reporte() });
    expect(i.body).toContain('0.1.0 (2026-08-21 12:00 UTC)');
    expect(i.body).toContain('iPhone');
    expect(i.body).toContain('390×844');
    // Trampa 1: sin la zona horaria un bug de fechas no se diagnostica.
    expect(i.body).toContain('America/Argentina/Buenos_Aires');
    expect(i.body).toContain('Nueva actividad');
  });

  it('tapa un link de reunión pegado en la descripción', () => {
    const i = construirIssue({
      id: 'rep1',
      reporte: reporte({ descripcion: 'el link https://zoom.us/j/secreto no abre' }),
    });
    expect(i.body).not.toContain('zoom.us');
    expect(i.body).toContain('«link de reunión oculto»');
  });

  it('en una sugerencia no arma el bloque de pasos ni la molestia', () => {
    const i = construirIssue({
      id: 'rep2',
      reporte: reporte({ tipo: 'sugerencia', pasos: null, severidad: null }),
    });
    expect(i.title).toBe('[sugerencia] No puedo guardar un borrador');
    expect(i.body).toContain('La idea');
    expect(i.body).not.toContain('Cómo reproducirlo');
    expect(i.body).not.toContain('Molestia');
  });

  it('copia el título de la actividad solo si está publicada', () => {
    const r = reporte({ actividad: { id: 'act1', titulo: 'Taller secreto' } });

    const publicada = construirIssue({
      id: 'rep1',
      reporte: r,
      actividad: actividadParaIssue({ estado: 'publicado', titulo: 'Taller abierto', slug: 'taller-abierto' }),
    });
    expect(publicada.body).toContain('Taller abierto');
    expect(publicada.body).toContain('taller-abierto');

    // Un borrador todavía no es público: solo sale el id, que no dice nada.
    const borrador = construirIssue({
      id: 'rep1',
      reporte: r,
      actividad: actividadParaIssue({ estado: 'borrador', titulo: 'Taller secreto', slug: 'x' }),
    });
    expect(borrador.body).not.toContain('Taller secreto');
    expect(borrador.body).toContain('act1');
  });

  it('aguanta un reporte sin contexto sin romper el issue', () => {
    const i = construirIssue({ id: 'rep1', reporte: reporte({ contexto: undefined }) });
    expect(i.body).toContain('Contexto');
  });
});

describe('actividadParaIssue — proyección, no volcado', () => {
  it('solo título y slug de una actividad publicada', () => {
    expect(
      actividadParaIssue({
        estado: 'publicado',
        titulo: 'Club',
        slug: 'club',
        createdBy: 'uid_dueño',
        online: { url: 'https://zoom.us/j/x' },
      }),
    ).toEqual({ titulo: 'Club', slug: 'club' });
  });

  it('nada si no está publicada o no existe', () => {
    expect(actividadParaIssue({ estado: 'pendiente', titulo: 'x' })).toBeNull();
    expect(actividadParaIssue(null)).toBeNull();
  });

  /**
   * DEC-1, §5.1 — el libro presentado **no sale al issue de GitHub**, que es un
   * repo público y ajeno al sitio: el reporte es sobre el panel, no sobre la
   * actividad, y de ella solo salen título y slug. Que la proyección enumere ya
   * lo garantiza; esto lo fija con un centinela, porque «enumera» es una
   * propiedad que se puede perder en un spread de una línea.
   */
  it('el libro presentado no llega al issue (DEC-1, §5.1)', () => {
    const actividad = {
      estado: 'publicado',
      titulo: 'Presentación de un libro',
      slug: 'presentacion',
      libro: { titulo: 'CENTINELA-LIBRO Los detectives salvajes', autor: 'CENTINELA-AUTORLIBRO' },
    };
    const proyectada = actividadParaIssue(actividad);
    expect(Object.keys(proyectada!).sort()).toEqual(['slug', 'titulo']);

    const issue = construirIssue({
      id: 'rep1',
      reporte: reporte({ actividad: { id: 'act1', titulo: 'Presentación de un libro' } }),
      actividad: proyectada,
    });
    for (const centinela of ['CENTINELA-LIBRO', 'CENTINELA-AUTORLIBRO']) {
      expect(
        `${issue.title}\n${issue.body}`,
        `se escapó ${centinela} al issue público`,
      ).not.toContain(centinela);
    }
  });

  /**
   * B-97, §5.1 — «se llenó» **no sale al issue de GitHub**. El reporte es sobre
   * el panel, no sobre la actividad: de ella salen título y slug y nada más, y
   * el estado del cupo no ayuda a diagnosticar un bug del formulario.
   *
   * Un booleano no admite centinela, así que lo que fija esta celda es la
   * enumeración de claves más el centinela del contacto de inscripción que va al
   * lado: si alguien cambiara la proyección por un spread para "llevar el
   * contexto de la inscripción", las dos cosas se rompen juntas.
   */
  it('el cupo completo no llega al issue (B-97, §5.1)', () => {
    const proyectada = actividadParaIssue({
      estado: 'publicado',
      titulo: 'Club de lectura',
      slug: 'club',
      inscripcion: {
        requiere: true,
        via: 'mail',
        destino: 'centinela-inscripciones@ejemplo.com',
        cupo: 12,
        completo: true,
      },
    });
    expect(Object.keys(proyectada!).sort()).toEqual(['slug', 'titulo']);

    const issue = construirIssue({
      id: 'rep1',
      reporte: reporte({ actividad: { id: 'act1', titulo: 'Club de lectura' } }),
      actividad: proyectada,
    });
    const todo = `${issue.title}\n${issue.body}`;
    expect(todo).not.toContain('centinela-inscripciones');
    expect(todo).not.toContain('Cupo completo');
    expect(todo).not.toContain('completo');
  });
});

describe('validación del formulario de reporte', () => {
  const valido = (over: Partial<ReporteForm> = {}): ReporteForm => ({
    ...reporteVacio(),
    titulo: 'No guarda el borrador',
    descripcion: 'Toco guardar y no pasa nada, se queda igual.',
    ...over,
  });

  it('acepta un bug completo', () => {
    expect(reporteFormSchema.safeParse(valido()).success).toBe(true);
  });

  it('un bug necesita severidad, una sugerencia no (§11: condicional por tipo)', () => {
    expect(reporteFormSchema.safeParse(valido({ severidad: null })).success).toBe(false);
    expect(
      reporteFormSchema.safeParse(valido({ tipo: 'sugerencia', severidad: null })).success,
    ).toBe(true);
  });

  it('rechaza títulos y descripciones que no dicen nada', () => {
    expect(reporteFormSchema.safeParse(valido({ titulo: 'roto' })).success).toBe(false);
    expect(reporteFormSchema.safeParse(valido({ descripcion: 'no anda' })).success).toBe(false);
  });

  it('rechaza lo que las reglas de Firestore rechazarían por largo', () => {
    expect(reporteFormSchema.safeParse(valido({ titulo: 'x'.repeat(121) })).success).toBe(false);
    expect(reporteFormSchema.safeParse(valido({ descripcion: 'x'.repeat(4001) })).success).toBe(
      false,
    );
  });
});

describe('formAReporte', () => {
  const usuario = { uid: 'uid_tia_hilda', email: 'tia-hilda@ejemplo.com' };
  const form = (over: Partial<ReporteForm> = {}): ReporteForm => ({
    ...reporteVacio('editar-actividad'),
    titulo: 'No guarda el borrador',
    descripcion: 'Toco guardar y no pasa nada, se queda igual.',
    pasos: '1) entré 2) toqué guardar',
    ...over,
  });

  it('nace pendiente, sin issue y sin intentos gastados', () => {
    const d = formAReporte(form(), contexto(), usuario);
    expect(d.estado).toBe('pendiente');
    expect(d.intentos).toBe(0);
    expect(d.github).toBeNull();
    expect(d.error).toBeNull();
  });

  it('guarda quién lo cargó, que es la trazabilidad interna', () => {
    const d = formAReporte(form(), contexto(), usuario);
    expect(d.reportadoPor).toEqual({ uid: 'uid_tia_hilda', email: 'tia-hilda@ejemplo.com' });
  });

  it('descarta pasos y severidad si al final era una sugerencia', () => {
    const d = formAReporte(form({ tipo: 'sugerencia' }), contexto(), usuario);
    expect(d.pasos).toBeNull();
    expect(d.severidad).toBeNull();
  });

  it('referencia la actividad solo si se eligió una', () => {
    expect(formAReporte(form(), contexto(), usuario).actividad).toBeNull();
    expect(
      formAReporte(form({ actividadId: 'act1' }), contexto(), usuario, 'Club de lectura').actividad,
    ).toEqual({ id: 'act1', titulo: 'Club de lectura' });
  });

  it('el issue que sale de un reporte real no filtra la identidad de quien reporta', () => {
    // La cadena completa: lo que el formulario arma, publicado tal cual.
    const d = formAReporte(form(), contexto(), usuario);
    const i = construirIssue({ id: 'rep9', reporte: { ...d, creadoEn: ts('2026-08-21T18:30:00Z') } });
    const json = JSON.stringify(i);
    expect(json).not.toContain('uid_tia_hilda');
    expect(json).not.toContain('librosdelatiahilda');
  });
});

// ─────────────────────────────────────────────────────────────────────
// B-74 · el trigger no se puede colgar contra la API de GitHub
// ─────────────────────────────────────────────────────────────────────

/**
 * `reportes-trigger.js` había copiado las cinco cabeceras de la llamada de
 * `index.js` **pero no el timeout**, y el comentario que explica por qué hace
 * falta estaba escrito en una sola de las dos copias. Un socket colgado dejaba
 * la invocación corriendo hasta el timeout de la plataforma.
 *
 * Es un test sobre la fuente porque lo que hay que garantizar es que la llamada
 * lleve el `AbortSignal`: simularlo pediría colgar un socket de verdad.
 */
describe('B-74 · las dos llamadas a GitHub abortan por timeout', () => {
  const fuente = (relativo: string) =>
    readFileSync(fileURLToPath(new URL(`../${relativo}`, import.meta.url)), 'utf8');

  it.each(['functions/reportes-trigger.js', 'functions/index.js'])(
    '%s corta el fetch con AbortSignal.timeout',
    (archivo) => {
      expect(fuente(archivo)).toMatch(/signal: AbortSignal\.timeout\(/);
    },
  );
});
