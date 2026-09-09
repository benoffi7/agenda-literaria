/**
 * La bandeja de propuestas, la parte que no necesita pantalla — B-830, paso 7.
 *
 * Tres cosas que son puras y se pueden verificar sin emuladores y sin DOM:
 * **la forma de la única escritura** que el panel hace sobre una propuesta, **el
 * link del contacto** —que es texto de un anónimo puesto en un `href`— y **la
 * frase de una fecha**, que es donde la trampa 1 volvería a aparecer si a
 * alguien se le ocurre formatear con `Date`.
 *
 * El cableado de la pantalla está en `propuestas-panel.render.test.tsx`, y que
 * la regla acepte de verdad lo que se arma acá, en
 * `propuestas.integracion.test.ts` — que importa **esta** función en vez de
 * copiar el objeto, que es lo que se desincroniza.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  ESTADOS_PENDIENTES,
  cambioDeRevision,
  enlaceDeContacto,
  enlaceDeImagen,
  esPendiente,
  fraseDeFechaPropuesta,
} from '@/lib/bandejaDePropuestas';
import { ESTADOS_PROPUESTA } from '@/types/propuesta';

const fuente = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(`../${rel}`, import.meta.url)), 'utf8');

describe('la única escritura del panel sobre una propuesta', () => {
  it('mueve el estado y firma la revisión, con los cuatro campos siempre', () => {
    expect(cambioDeRevision('uid_admin', 'aceptada', 'AHORA', { actividadId: 'act_1' })).toEqual({
      estado: 'aceptada',
      revision: { porUid: 'uid_admin', en: 'AHORA', actividadId: 'act_1', motivo: null },
    });
  });

  it('los dos opcionales van en `null` y no ausentes', () => {
    /*
     * No es cosmética: `revisionValida()` los exige con un `hasAll`, así que
     * `{ porUid, en }` a secas es un permission-denied. Es la asimetría con el
     * `create`, donde el default centinela ya tapa la clave ausente.
     */
    const { revision } = cambioDeRevision('uid_admin', 'en-revision', 'AHORA');
    expect(Object.keys(revision).sort()).toEqual(['actividadId', 'en', 'motivo', 'porUid']);
    expect(revision.actividadId).toBeNull();
    expect(revision.motivo).toBeNull();
  });

  it('no toca nada más que `estado` y `revision`', () => {
    // La otra mitad de la regla (`affectedKeys().hasOnly([...])`) y la razón por
    // la que la bandeja no puede editar el contenido de una propuesta: no hay
    // forma de mandar un título por este camino.
    expect(Object.keys(cambioDeRevision('u', 'rechazada', 'AHORA', { motivo: 'no' }))).toEqual([
      'estado',
      'revision',
    ]);
  });

  it('y las claves son exactamente las que `firestore.rules` acepta', () => {
    /*
     * La atadura de B-364 aplicada a un mapa: la regla vive en otro runtime y no
     * puede importar TypeScript, así que el único modo de que las dos listas no
     * se separen es un test que lea el archivo. Sin esto, agregar un campo a
     * `revision` en la regla y olvidarse acá —o al revés— deja la bandeja
     * rechazada en producción con el build en verde.
     *
     * Se comparan **las dos** apariciones (la del `create` y la del `update`):
     * son el mismo mapa y tienen que seguir siéndolo.
     */
    const declaradas = [
      ...fuente('firestore.rules').matchAll(/revision\.keys\(\)\.hasOnly\(\[([^\]]+)\]\)/g),
    ].map((m) => m[1]!.split(',').map((k) => k.trim().replace(/'/g, '')).sort());
    expect(declaradas.length).toBeGreaterThanOrEqual(2);
    const { revision } = cambioDeRevision('u', 'aceptada', 'AHORA');
    for (const claves of declaradas) {
      expect(claves).toEqual(Object.keys(revision).sort());
    }
  });

  it('los estados pendientes son estados de verdad, y las cerradas no lo son', () => {
    for (const e of ESTADOS_PENDIENTES) {
      expect(ESTADOS_PROPUESTA).toContain(e);
      expect(esPendiente({ estado: e })).toBe(true);
    }
    expect(esPendiente({ estado: 'aceptada' })).toBe(false);
    expect(esPendiente({ estado: 'rechazada' })).toBe(false);
  });
});

describe('el contacto de quien propuso, que es texto ajeno en un `href`', () => {
  it('un mail se abre con el cliente de mail', () => {
    expect(enlaceDeContacto({ via: 'mail', valor: ' hola@casabrandon.example ' })).toBe(
      'mailto:hola@casabrandon.example',
    );
  });

  it('un WhatsApp se queda con los dígitos', () => {
    expect(enlaceDeContacto({ via: 'whatsapp', valor: '+54 9 11 2222-3333' })).toBe(
      'https://wa.me/5491122223333',
    );
  });

  it('un handle de Instagram, con o sin arroba', () => {
    expect(enlaceDeContacto({ via: 'instagram', valor: '@casa.brandon' })).toBe(
      'https://instagram.com/casa.brandon',
    );
    expect(enlaceDeContacto({ via: 'instagram', valor: 'casabrandon' })).toBe(
      'https://instagram.com/casabrandon',
    );
  });

  /**
   * **El caso que justifica que esto sea una función y no una interpolación.**
   *
   * `contacto.valor` lo escribe alguien sin login, y un `href` es donde un string
   * ajeno deja de ser texto: `javascript:` en un panel con la sesión de un admin
   * abierta es código con sus permisos. React escapa el **contenido** de un
   * atributo, no su esquema.
   *
   * MUTACIÓN PROBADA: devolver `valor` sin validar en cualquiera de las tres
   * ramas pone en rojo el caso de esa rama.
   */
  it('nada que no sea un contacto de verdad llega a un link', () => {
    const veneno = [
      'javascript:alert(document.cookie)',
      'JavaScript:alert(1)',
      ' javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox(1)',
    ];
    for (const valor of veneno) {
      for (const via of ['mail', 'whatsapp', 'instagram'] as const) {
        expect(enlaceDeContacto({ via, valor }), `${via} · ${valor}`).toBeNull();
      }
    }
  });

  it('y tampoco un valor a medias, que se muestra como texto y no como link roto', () => {
    expect(enlaceDeContacto({ via: 'mail', valor: 'escribime al mail' })).toBeNull();
    // Cinco dígitos no son un teléfono; dieciséis tampoco (E.164 corta en 15).
    expect(enlaceDeContacto({ via: 'whatsapp', valor: '12345' })).toBeNull();
    expect(enlaceDeContacto({ via: 'whatsapp', valor: '1'.repeat(16) })).toBeNull();
    expect(enlaceDeContacto({ via: 'instagram', valor: 'mi cuenta de insta' })).toBeNull();
  });
});

/**
 * **El otro `href` de texto ajeno de la bandeja** — lo señaló el
 * `auditor-privacidad`. `imagen.url` es el único string de una propuesta que no
 * pasa por ningún validador de forma: la regla exige `is string` y 1–500
 * caracteres, y el schema solo el largo. Con `/proponer` abierto (paso 9) el
 * documento puede traer cualquier cosa.
 */
describe('la imagen que pegaron, que es el otro href', () => {
  it('una URL de verdad se puede abrir', () => {
    expect(enlaceDeImagen({ url: 'https://casabrandon.test/flyer.jpg' })).toBe(
      'https://casabrandon.test/flyer.jpg',
    );
  });

  it('un esquema que no es http(s) no arma ningún link', () => {
    for (const url of ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>']) {
      expect(enlaceDeImagen({ url }), url).toBeNull();
    }
  });

  it('y la imagen subida no es un link: verla es del paso 8 (DEC-11)', () => {
    expect(enlaceDeImagen({ storagePath: 'propuestas/abc.jpg' })).toBeNull();
    expect(enlaceDeImagen(null)).toBeNull();
  });

  it('el saneo es el mismo de la ficha pública, importado y no copiado', () => {
    // Dos versiones de «qué URL es segura» divergen y una queda vieja (B-88).
    expect(fuente('src/lib/bandejaDePropuestas.ts')).toContain("from '@/lib/enlaceSeguro'");
  });
});

describe('la fecha propuesta, que es hora de pared y no un instante', () => {
  it('se lee como la escribieron', () => {
    expect(
      fraseDeFechaPropuesta({ dia: '2026-10-07', desde: '19:00', hasta: '21:00' }),
    ).toBe('07/10/2026 · 19:00 a 21:00');
  });

  it('sin hora de fin lo dice, en vez de inventarla', () => {
    // Las dos horas por defecto las pone la conversión, y con su aviso: la
    // bandeja muestra lo que llegó.
    expect(fraseDeFechaPropuesta({ dia: '2026-10-07', desde: '19:00', hasta: null })).toBe(
      '07/10/2026 · 19:00 (sin hora de fin)',
    );
  });

  /**
   * **La trampa 1 al revés**, y por eso se afirma sobre el fuente: lo que hay en
   * una propuesta son strings de hora de pared (D-590), así que darles un `Date`
   * para formatearlos les inventaría la zona del navegador del admin para
   * leerlos en otra. Un test de valores no lo puede mostrar —en la zona del CI
   * daría lo mismo—, y es exactamente el caso que corre una fecha un día.
   */
  it('y no pasa por `Date` en ningún momento', () => {
    expect(fuente('src/lib/bandejaDePropuestas.ts')).not.toMatch(/new Date\(/);
  });
});
