/**
 * B-80: un solo dueño por campo del documento.
 *
 * Una clase de bug con red, partida de `tests/clases-de-bug.test.ts` (PRD 6,
 * M-12). Qué es una clase, cómo leer los `it.fails` y lo que comparten todas:
 * `tests/fixtures/clases-de-bug.ts`.
 */
import { Timestamp } from 'firebase/firestore';
import { describe, expect, it } from 'vitest';
import { documentoAForm, formADocumento, payloadDeActualizacion } from '@/lib/actividades';
import type { Actividad } from '@/types/actividad';
import { fuente, ARCHIVOS_FUNCTIONS, triggers, TRIGGERS, primero, trazaDe } from '../fixtures/clases-de-bug';

/** Un array literal de constantes del fuente: `const X = ['a', 'b'];` → `['a','b']`. */
const listaLiteral = (src: string, nombre: string): string[] => {
  const m = new RegExp(`${nombre}\\s*=\\s*\\[([^\\]]*)\\]`).exec(src);
  if (!m) return [];
  return [...m[1]!.matchAll(/'([^']+)'/g)].map((x) => x[1]!);
};


// ─────────────────────────────────────────────────────────────────────
// Clase de B-80 · un campo que escribe el backend, pisado por el ida y
// vuelta del documento a través del formulario
// ─────────────────────────────────────────────────────────────────────

/**
 * La clase, en una línea: **hay un solo dueño por campo.** Si una Cloud
 * Function escribe un campo y el formulario también lo emite, el panel puede
 * pisarlo con lo que tenía en un snapshot viejo — y el daño ni se nota, porque
 * el guardado que lo pisa todavía funciona.
 *
 * La verificación va sobre la **lista** de campos que escribe la máquina, no
 * sobre `calendarEventId`. La lista no se mantiene a mano acá: se deriva del
 * write-back de `functions/index.js` y de la lista negra de `functions/
 * historial.js` (D-41), que es hoy el único lugar del repo donde está escrito
 * qué campo escribe la máquina.
 */
const SRC_HISTORIAL = fuente('functions/historial.js');

/**
 * El fuente de **todas** las Functions, concatenado, y no el de `index.js`.
 *
 * Apuntar a un archivo concreto ya se rompió una vez: B-77 partió `index.js` en
 * módulos y el write-back se mudó a `sincronizacion.js`, así que los chequeos de
 * abajo se quedaron recorriendo listas vacías. El guard de "la lista no está
 * vacía" lo agarró, que es para lo que está — pero la respuesta correcta no es
 * re-apuntar a otro archivo, es dejar de depender de dónde vive el código.
 */
const SRC_FUNCTIONS = ARCHIVOS_FUNCTIONS.map((f) => fuente(f)).join('\n');


const CAMPOS_DE_MAQUINA_SESION = listaLiteral(SRC_HISTORIAL, 'CAMPOS_DE_MAQUINA_SESION');


/**
 * Lo mismo dentro de cada imagen de la galería — B-206 #2.
 *
 * No hay un `CAMPOS_QUE_ESCRIBE_EL_SYNC` con el que cruzarla: hoy el único que
 * escribe estos campos es la subida del panel, y el segundo escritor (la Function
 * de DEC-7d) todavía no existe. Lo que sí se puede afirmar ya, y es lo que hace
 * el chequeo de abajo, es que **el registro creció con el cambio**: si mañana se
 * agrega una clave de máquina a `Imagen` y nadie la suma acá, cada write-back de
 * la Function va a dejar una versión de historial y un rebuild del sitio.
 */
const CAMPOS_DE_MAQUINA_IMAGEN = listaLiteral(SRC_HISTORIAL, 'CAMPOS_DE_MAQUINA_IMAGEN');


/**
 * Los campos que el sync escribe dentro de una sesión, leídos de la constante
 * que el propio módulo declara.
 *
 * Antes se derivaba con un regex sobre el fuente y se rompió dos veces: al
 * mudarse el write-back de archivo, y al renombrarse la variable esparcida. Las
 * dos veces el chequeo se quedó recorriendo una lista vacía — o sea, pasando en
 * verde sin verificar nada. Una lista declarada sobrevive a los dos casos.
 */
const CAMPOS_QUE_ESCRIBE_EL_SYNC = listaLiteral(
  fuente('functions/sincronizacion.js'),
  'CAMPOS_QUE_ESCRIBE_EL_SYNC',
);


/**
 * Claves de primer nivel que **el sync** escribe en la actividad.
 *
 * Sale de la traza de `syncCalendar` —su cuerpo más el de todo lo que llama— y
 * no de un archivo nombrado: **el chequeo no puede depender de dónde vive el
 * código.** Apuntar a `functions/index.js` ya se rompió dos veces, las dos por
 * B-77: primero cuando el write-back se mudó a `sincronizacion.js`, y después
 * cuando el corte terminó y `syncCalendar` se fue a `calendario-trigger.js`. Las
 * dos veces el chequeo quedó recorriendo una lista vacía, o sea pasando en verde
 * sin verificar nada.
 *
 * Y tampoco es `SRC_FUNCTIONS` entero, que fue el primer reflejo: ahí entran los
 * `tx.update(ref, …)` de **otros** triggers —el de reportes tiene el suyo— y la
 * pregunta de este chequeo es sobre el sync, no sobre cualquier escritura del
 * proyecto. Un chequeo que mide de más también deja de medir lo que dice medir.
 */
const CAMPOS_DOCUMENTO_QUE_ESCRIBE_EL_SYNC = [
  ...new Set(
    [
      ...TRIGGERS.filter((t) => t.nombre === 'syncCalendar')
        .flatMap((t) => trazaDe(t).cuerpos)
        .join('\n')
        .matchAll(/tx\.update\(ref,\s*\{([^}]*)\}\)/g),
    ].flatMap((m) =>
      m[1]!
        .split(',')
        .map((c) => c.split(':')[0]!.trim())
        .filter(Boolean),
    ),
  ),
];


const actividadCon = (sesion: Record<string, unknown>): Actividad =>
  ({
    tipo: 'taller',
    titulo: 'Taller de crónica',
    slug: 'taller-de-cronica',
    descripcion: 'Ocho encuentros de crónica urbana',
    imagenUrl: null,
    organizador: { nombre: 'Casa Brandon', instagram: '', web: '' },
    tallerista: null,
    esCiclo: false,
    sesiones: [
      {
        id: 'ses_1',
        inicio: Timestamp.fromDate(new Date('2026-09-03T22:00:00Z')),
        fin: Timestamp.fromDate(new Date('2026-09-04T00:00:00Z')),
        tema: null,
        lectura: null,
        cancelada: false,
        ...sesion,
      },
    ],
    modalidad: 'presencial',
    sede: {
      nombre: 'Casa Brandon',
      direccion: 'Drago 236',
      barrio: '',
      ciudad: 'CABA',
      indicaciones: '',
      geo: null,
    },
    online: null,
    inscripcion: { requiere: false, via: null, destino: '', cupo: null, cierra: null },
    arancel: { tipo: 'gratis', notas: '' },
    material: { tiene: false, items: [] },
    difusion: { arrobar: [], notas: '' },
    estado: 'publicado',
    tags: [],
    destacado: false,
    searchText: '',
  }) as unknown as Actividad;

describe('clase de B-80 · un solo dueño por campo del documento', () => {
  it('la lista de campos que escribe la máquina existe y no está vacía', () => {
    // Sin esto los chequeos de abajo recorrerían una lista vacía y pasarían
    // sin verificar nada. La lista vive en functions/historial.js (D-41).
    expect(CAMPOS_DE_MAQUINA_SESION.length).toBeGreaterThan(0);
    expect(CAMPOS_QUE_ESCRIBE_EL_SYNC.length).toBeGreaterThan(0);
    // B-206 #2 — el registro creció con la galería. Si esto se rompe, o se
    // renombró la constante o alguien la borró, y el chequeo de abajo estaría
    // recorriendo una lista vacía.
    expect(CAMPOS_DE_MAQUINA_IMAGEN.length).toBeGreaterThan(0);
  });

  /**
   * B-206 #2 — la clave de máquina de una imagen sobrevive el ida y vuelta por
   * el formulario, y **ninguna clave de más entra al documento**.
   *
   * Son las dos mitades de "conservar explícitamente" en vez de spreadear la
   * fila. La primera es lo que hace que la subida no se pierda al guardar; la
   * segunda es lo que va a hacer que, cuando la Function de DEC-7d sea el otro
   * escritor, el panel no le meta claves que ella no puso — y de paso cierra el
   * camino del §5.2 por el que un borrador viejo de `localStorage` mete una
   * clave inventada en el documento.
   */
  it('B-206: formADocumento enumera las claves de una imagen, no las spreadea', () => {
    const conImagen = (imagen: Record<string, unknown>): Actividad =>
      ({
        ...actividadCon({}),
        imagenes: [
          { id: 'img_1', url: 'https://x.ar/a.jpg', epigrafe: '', origen: 'propia', portada: true, ...imagen },
        ],
      }) as unknown as Actividad;

    // 1 · los campos de máquina dan la vuelta completa
    const conMaquina = Object.fromEntries(
      CAMPOS_DE_MAQUINA_IMAGEN.map((c) => [c, c === 'storagePath' ? 'imagenes/img_1.jpg' : 1200]),
    );
    const ida = formADocumento(documentoAForm(conImagen(conMaquina)), 'uid', false) as {
      imagenes: Record<string, unknown>[];
    };
    for (const campo of CAMPOS_DE_MAQUINA_IMAGEN) {
      expect(ida.imagenes[0]![campo], campo).toEqual(conMaquina[campo]);
    }

    // 2 · una clave que el modelo no tiene NO llega al documento
    const conBasura = formADocumento(
      documentoAForm(conImagen({ inventada: 'no-deberia-viajar' })),
      'uid',
      false,
    ) as { imagenes: Record<string, unknown>[] };
    expect(Object.keys(conBasura.imagenes[0]!)).not.toContain('inventada');
  });

  it('todo campo de sesión que escribe el sync está declarado como campo de máquina', () => {
    // Si el sync escribe un campo que `historial.js` no considera de máquina,
    // cada write-back genera una versión de basura en el historial (§12).
    const sinDeclarar = CAMPOS_QUE_ESCRIBE_EL_SYNC.filter(
      (c) => !CAMPOS_DE_MAQUINA_SESION.includes(c),
    );
    expect(sinDeclarar).toEqual([]);
  });

  it('el sync no escribe ningún campo de primer nivel de la actividad', () => {
    // Sin esto un `tx.update(ref, {...})` que se mude o se reescriba dejaría la
    // lista vacía, y `[]` no contiene ningún campo prohibido: verde vacío.
    expect(CAMPOS_DOCUMENTO_QUE_ESCRIBE_EL_SYNC.length).toBeGreaterThan(0);
    // Hoy escribe solo el contenedor `sesiones`. Un campo suelto acá —
    // `ultimoSync`, `calendarSyncedAt` — sería un dueño nuevo en disputa con el
    // formulario, y hay que decidirlo antes de escribirlo.
    /*
     * **B-1920 — y `ciudades`, decidido.** `corregirCiudades` lo reescribe cuando
     * no coincide con `ciudadesDe(modalidades)`. Es un segundo escritor, pero no
     * un dueño en disputa en el sentido de B-80: los dos escriben **la misma
     * derivación de las mismas filas**, el panel en la misma escritura que las
     * filas y la Function releyéndolas en una transacción. Un snapshot viejo del
     * panel trae filas viejas **y** su `ciudades`, juntos, así que no hay valor de
     * la máquina que pisar. Un campo que no sea un derivado de lo que el panel
     * escribe sigue sin poder entrar acá sin decidirlo.
     */
    expect([...CAMPOS_DOCUMENTO_QUE_ESCRIBE_EL_SYNC].sort()).toEqual(['ciudades', 'sesiones']);
  });

  /**
   * El chequeo de la clase. El formulario no puede ser dueño de un campo que
   * escribe una Function: si lo emite, lo emite con lo que tenía en el snapshot.
   *
   * **Era `it.fails` y pasó a `it` con B-150** — que es lo que un `it.fails`
   * existe para provocar. La salida elegida es la segunda de las tres de B-80:
   * el camino de escritura del panel **relee el documento y fusiona** por id de
   * sesión (`actualizarActividad` → `payloadDeActualizacion` →
   * `fusionarSesiones`). La primera —que `formADocumento` deje de emitir el
   * campo— se evaluó y es un bug peor: `updateDoc` reemplaza el array `sesiones`
   * entero, así que la clave ausente borra el id de **todas** las sesiones y la
   * pasada siguiente del sync crea N eventos duplicados.
   *
   * **La verificación se mudó de `formADocumento` al payload de escritura, y no
   * es una concesión.** `formADocumento` sigue emitiendo el campo —tiene que
   * emitirlo, por lo de arriba— así que preguntarle a él nunca podría dar
   * verde con el arreglo correcto puesto. Lo que la clase afirma es que **lo que
   * sale hacia Firestore** no lleva el valor del formulario, y eso se le
   * pregunta al payload.
   *
   * **Qué NO lo haría pasar, a propósito:** que `syncCalendar` reponga el id
   * también en las ops `actualizar` (la tercera salida, D-91). Eso tapa el
   * síntoma conocido y deja la ventana abierta entre las dos escrituras. Sigue
   * estando —es la red de abajo— pero no es lo que este chequeo mide.
   */
  it('B-80: el payload de escritura del panel no lleva ningún campo que escriba una Function', () => {
    const emitidos: string[] = [];
    for (const campo of CAMPOS_DE_MAQUINA_SESION) {
      const enFirestore = actividadCon({ [campo]: 'valor-escrito-por-la-function' });
      const viejo = actividadCon({ [campo]: null }); // snapshot previo al write-back
      const escrito = payloadDeActualizacion(
        documentoAForm(viejo),
        'uid-admin',
        // Lo que el documento tiene AHORA, que es lo que el panel relee.
        enFirestore.sesiones,
      ) as { sesiones: Record<string, unknown>[] };
      const enElDocumento = (enFirestore.sesiones as unknown as Record<string, unknown>[])[0]!;
      if (escrito.sesiones[0]![campo] !== enElDocumento[campo]) {
        emitidos.push(`${campo}: el panel escribe ${JSON.stringify(escrito.sesiones[0]![campo])}`);
      }
    }
    expect(emitidos).toEqual([]);
  });

  /**
   * La otra mitad, y la que hace que el chequeo de arriba no se pueda satisfacer
   * de la forma barata y equivocada: **la clave sigue estando en el documento.**
   *
   * Sin esto, "que el panel no escriba el valor del formulario" se cumpliría
   * también omitiendo la clave — y eso, con `updateDoc` reemplazando el array
   * entero, borra el `calendarEventId` de todas las sesiones y le hace crear N
   * eventos duplicados al sync. Es el bug que B-150 descartó explícitamente.
   */
  it('B-150: la clave del campo de máquina viaja igual, con el valor del documento', () => {
    for (const campo of CAMPOS_DE_MAQUINA_SESION) {
      const enFirestore = actividadCon({ [campo]: 'evt-de-la-function' });
      const escrito = payloadDeActualizacion(
        documentoAForm(actividadCon({ [campo]: null })),
        'uid-admin',
        enFirestore.sesiones,
      ) as { sesiones: Record<string, unknown>[] };
      expect(Object.keys(escrito.sesiones[0]!), campo).toContain(campo);
      expect(escrito.sesiones[0]![campo], campo).toBe('evt-de-la-function');
    }
  });

  /**
   * Y la fila nueva: una sesión que el documento no tiene no puede heredar el
   * campo de máquina de nadie. Con `[]` —el "no hay nada en el documento"
   * explícito que el tercer argumento obliga a decidir— queda `null`, que es lo
   * que hace que el sync le cree su evento como si fuera nueva.
   */
  it('B-150: una sesión que el documento no tiene queda con el campo de máquina en null', () => {
    for (const campo of CAMPOS_DE_MAQUINA_SESION) {
      const escrito = payloadDeActualizacion(
        documentoAForm(actividadCon({ [campo]: 'evt-de-un-snapshot-viejo' })),
        'uid-admin',
        [],
      ) as { sesiones: Record<string, unknown>[] };
      expect(escrito.sesiones[0]![campo], campo).toBeNull();
    }
  });
});
