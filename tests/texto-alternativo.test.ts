import { describe, expect, it } from 'vitest';
// Las Functions son JS plano; TS les infiere los tipos con allowJs.
import { camposCambiados, huboCambioDeContenido } from '../functions/historial.js';
import { documentoAForm, formADocumento } from '@/lib/actividades';
import { duplicarActividadForm } from '@/lib/duplicar';
import { formVacio } from '@/lib/formulario/estadoInicial';
import { CAMPOS } from '@/lib/formulario/camposFaltantes';
import { CAMPOS_VALIDABLES } from '@/lib/analytics-eventos';
import { imagenExterna, imagenesDe } from '@/lib/imagenes';
import { faltaParaPublicar } from '@/lib/schema';
import { toPublic } from '@/lib/toPublic';
import type { Actividad, ActividadForm, Imagen } from '@/types/actividad';
import { ts } from './fixtures/tiempo';

/**
 * B-301 · **D-440** — el texto alternativo de la portada, que reabre DEC-7a.
 *
 * DEC-7a (D-125) decidió a propósito que este campo **no** existiera: el
 * alternativo salía del título de la actividad, con el argumento de que un campo
 * obligatorio por imagen en un panel de una persona produce «foto». El desvío del
 * dueño (2026-09-03) le acepta el argumento y le cambia el alcance: el campo
 * existe y **se pide solo en la portada**, que es la única que se comparte.
 *
 * Acá viven las respuestas del paso 0 del skill `campo-nuevo` que no tienen dueño
 * en otro archivo, más las dos cosas que un campo nuevo rompe en silencio:
 *
 *  1. **el default de lectura** de las imágenes que ya están en producción, y que
 *     tiene que ser determinístico (D-125, D-26);
 *  2. **la ida y vuelta** formulario ⇄ documento, que no puede perder nada.
 *
 * Lo demás se verifica donde alguien lo va a editar: `schema.test.ts` (que
 * publicar ya no lo exige, con los casos del bloqueo dados vuelta),
 * `imagenes.test.ts` y `barrido-de-salidas-publicas.test.ts` (que sale al
 * `events.json` y que nada más de la fila sale con él),
 * `texto-alternativo.render.test.tsx` (que el campo se pide una sola vez, en la
 * portada) y `analytics-privacidad.test.ts` (que el texto **no** sale a GA4).
 *
 * **B-850 — la mención a `errores-de-fila.test.ts` se fue con lo que nombraba.**
 * Ese archivo verificaba que el rechazo del campo se pintara al lado del campo, y
 * hoy no hay ningún rechazo: lo que queda acá abajo, en su lugar, es el caso que
 * afirma **por qué** no lo hay.
 */

const imagen = (over: Partial<Imagen> = {}): Imagen => ({
  id: 'img_1',
  url: 'https://ejemplo.ar/flyer.jpg',
  epigrafe: '',
  textoAlternativo: 'Flyer vertical con la fecha y la sede',
  origen: 'externa',
  portada: true,
  ...over,
});

/** Una imagen tal como la trae un documento anterior a B-301: sin la clave. */
const sinElCampo = (over: Partial<Imagen> = {}): Imagen => {
  const i = imagen(over);
  delete (i as { textoAlternativo?: string }).textoAlternativo;
  return i;
};

const actividad = (imagenes: Imagen[], over: Partial<Actividad> = {}): Actividad =>
  ({
    tipo: 'taller',
    titulo: 'Taller de crónica urbana',
    slug: 'taller-cronica',
    descripcion: 'Ocho encuentros de crónica.',
    imagenes,
    organizador: { nombre: 'Casa Brandon', instagram: '', web: '' },
    tallerista: null,
    esCiclo: false,
    sesiones: [],
    modalidades: [],
    modalidad: 'presencial',
    sede: null,
    online: null,
    inscripcion: { requiere: false, via: null, destino: '', cupo: null, cierra: null },
    arancel: { tipo: 'gratis', notas: '' },
    material: { tiene: false, items: [] },
    difusion: { arrobar: [], notas: '' },
    estado: 'publicado',
    tags: [],
    destacado: false,
    searchText: '',
    createdAt: ts('2026-08-01T00:00:00Z'),
    updatedAt: ts('2026-08-01T00:00:00Z'),
    createdBy: 'uid',
    updatedBy: 'uid',
    ...over,
  }) as Actividad;

const conImagen = (over: Partial<Imagen> = {}): ActividadForm => ({
  ...formVacio(),
  titulo: 'Taller de crónica urbana',
  slug: 'taller-cronica',
  imagenes: [imagen(over)],
});

describe('el default de lectura de las imágenes que ya existen (D-26, D-125)', () => {
  it('una fila sin la clave llega al formulario sin la clave, no con basura', () => {
    // El formulario la muestra como vacía (`img.textoAlternativo ?? ''`) y el
    // guardado la escribe como `''`. Lo que NO puede hacer la lectura es
    // inventar un valor: si `documentoAForm` devolviera «Imagen de {título}»,
    // ese texto quedaría guardado como si alguien lo hubiera escrito.
    const f = documentoAForm(actividad([sinElCampo()]));
    expect(f.imagenes[0]!.textoAlternativo).toBeUndefined();
  });

  it('preserva el comportamiento anterior: la salida pública no inventa el texto', () => {
    // Antes de B-301 la página armaba el `alt` con el título de la actividad, y
    // eso lo sigue haciendo la página. Lo que la proyección publica es «no hay»,
    // o sea la cadena vacía — nunca un derivado del título, que el consumidor ya
    // tiene a mano (mismo criterio que `OpcionPublica.tono`).
    const publica = toPublic(actividad([sinElCampo()]), 'act-1');
    expect(publica.imagenes[0]!.textoAlternativo).toBe('');
    expect(JSON.stringify(publica.imagenes[0])).not.toContain('Taller de crónica urbana');
  });

  it('es determinístico: abrir el formulario dos veces da lo mismo', () => {
    /*
     * Un default que devolviera algo distinto en cada lectura —un id, una fecha—
     * haría que `huboCambioDeContenido` vea un cambio cada vez que se abre el
     * formulario: el aviso de «cambios sin guardar» aparecería solo y se
     * escribiría una versión al historial por cada vez que alguien **mira** una
     * actividad. Es lo que casi pasó con la galería (D-125).
     */
    const doc = actividad([sinElCampo()]);
    expect(documentoAForm(doc).imagenes).toEqual(documentoAForm(doc).imagenes);
  });

  it('el default de la galería vieja (`imagenUrl`) también nace con el campo vacío', () => {
    const vieja = { imagenUrl: 'https://viejo.ar/1.jpg' };
    expect(imagenesDe(vieja)[0]!.textoAlternativo).toBe('');
    // Y sigue siendo determinístico, que es la mitad de D-125.
    expect(imagenesDe(vieja)).toEqual(imagenesDe(vieja));
  });
});

describe('la ida y vuelta formulario y documento no pierde el alternativo', () => {
  it('lo escribe recortado, como el epígrafe', () => {
    const doc = formADocumento(
      conImagen({ textoAlternativo: '  Flyer con la fecha  ' }),
      'uid',
      true,
    ) as unknown as Actividad;
    expect(doc.imagenes![0]!.textoAlternativo).toBe('Flyer con la fecha');
  });

  it('una fila sin la clave se escribe como cadena vacía, no como ausente', () => {
    // `formADocumento` **enumera** las claves de cada imagen (B-206 #2), así que
    // la clave sale siempre. Ausente y `''` no los unifica
    // `huboCambioDeContenido`, y dejarlo ausente en unos documentos y presente en
    // otros sería una versión de historial y un rebuild por guardado.
    const f = { ...conImagen(), imagenes: [sinElCampo()] };
    const doc = formADocumento(f, 'uid', true) as unknown as Actividad;
    expect(doc.imagenes![0]).toHaveProperty('textoAlternativo', '');
  });

  it('vuelve del documento al formulario tal como se cargó', () => {
    const doc = formADocumento(conImagen(), 'uid', true) as unknown as Actividad;
    expect(documentoAForm(actividad(doc.imagenes!)).imagenes[0]!.textoAlternativo).toBe(
      'Flyer vertical con la fecha y la sede',
    );
  });

  it('la fila que escribe el guardado no tiene ninguna clave de más', () => {
    // La enumeración de `formADocumento` es lo que impide que una clave de un
    // borrador recuperado de `localStorage` llegue a Firestore (§5.2).
    const doc = formADocumento(conImagen(), 'uid', true) as unknown as Actividad;
    expect(Object.keys(doc.imagenes![0]!).sort()).toEqual([
      'epigrafe',
      'id',
      'origen',
      'portada',
      'textoAlternativo',
      'url',
    ]);
  });

  it('es contenido y no campo de máquina: pisarlo guarda una versión al historial', () => {
    // La contracara de `storagePath`/`ancho`/`alto`, que sí son de máquina y por
    // eso están en `CAMPOS_DE_MAQUINA_IMAGEN`. Este lo tipea una persona, así que
    // perderlo tiene que ser recuperable (§12, D-41).
    const antes = actividad([imagen()]);
    const despues = actividad([imagen({ textoAlternativo: 'Otro texto' })]);
    expect(huboCambioDeContenido(antes, despues)).toBe(true);
    expect(camposCambiados(antes, despues)).toContain('imagenes');
  });
});

describe('el resto del recorrido del skill campo-nuevo', () => {
  it('la copia hereda el alternativo: es la misma imagen', () => {
    const origen = { ...formVacio(), titulo: 'Club', slug: 'club', imagenes: [imagen()] };
    const copia = duplicarActividadForm(origen, { tomados: [] });
    // Se hereda por el mismo motivo que el epígrafe y el libro: duplicar es la
    // misma actividad en otra fecha, y describir de nuevo la misma foto sería
    // trabajo inventado. El `id` sí cambia (trampa 2), el texto no.
    expect(copia.imagenes[0]!.textoAlternativo).toBe(imagen().textoAlternativo);
    expect(copia.imagenes[0]!.id).not.toBe('img_1');
  });

  it('una fila nueva nace con el campo presente y vacío', () => {
    // Así la fila tiene siempre la misma forma, venga de pegar una URL, de la
    // subida o del schema. B-850 — y decía «y vacío es lo que el nivel
    // «publicar» rechaza», que dejó de ser cierto el 2026-09-07: vacío es
    // un valor legítimo, el de la portada que nadie describió.
    expect(imagenExterna('https://x.ar/1.jpg', true).textoAlternativo).toBe('');
  });

  it('la barra de abajo ya no lo nombra, porque ya no falta para publicar', () => {
    /*
     * **Decía lo contrario**: «la barra de abajo sabe nombrarlo (B-184) — sin
     * nombre, un guardado a `publicado` diría "falta algo" sin decir qué». Era
     * cierto mientras el campo bloqueara; el dueño sacó el bloqueo el 2026-09-07.
     *
     * Y la etiqueta **se queda** en `CAMPOS`, que es la parte que hay que
     * entender para no borrarla de paso — pero **B-850 corrige el motivo**, que
     * estaba mal escrito acá. Decía «el campo existe y tiene su forma (largo
     * máximo)… si algún día alguien escribe 400 caracteres ahí, el rechazo va a
     * caer en esa ruta»: **no hay largo máximo**, y por eso ese rechazo no
     * existe. El motivo verdadero es otro y es más simple: `CAMPOS` espeja la
     * *forma* del schema —`tests/campos-faltantes.test.ts` lo compara contra
     * `CAMPOS_VALIDABLES` en las dos direcciones— igual que `imagenes.N.alto` o
     * `imagenes.N.id`, que tampoco pueden fallar y también están nombrados. Lo
     * que se fue es la exigencia de que **esté**; lo que nunca hubo es una regla
     * de formato.
     */
    expect(CAMPOS['imagenes.N.textoAlternativo']).toBeDefined();
    expect(
      faltaParaPublicar({ ...conImagen({ textoAlternativo: '' }) }).map((i) => i.path.join('.')),
    ).not.toContain('imagenes.0.textoAlternativo');
  });

  it('B-850 — nada puede rechazar el alternativo: el campo no tiene forma', () => {
    /*
     * Es la afirmación que faltaba, y la que vuelve honesto todo lo de arriba:
     * en el schema el campo es `opcional` —`z.string().trim().default('')`— sin
     * `.min()` ni `.max()`, y el `superRefine` que lo exigía se sacó el
     * 2026-09-07. O sea que **ninguna entrada produce un issue en
     * `imagenes.N.textoAlternativo`**, y por eso `GaleriaEditor` ya no pinta un
     * error para esa ruta (B-850 borró esa rama y su caso en
     * `errores-de-fila.test.ts`, que solo miraba el fuente y no podía fallar).
     *
     * Se afirma comparando los rechazos de un texto largo contra los de uno
     * corto, y no leyendo el fuente del schema: lo que importa no es cómo está
     * escrita la regla sino que no exista ninguna.
     *
     * MUTACIÓN PROBADA: agregarle `.max(200)` a `textoAlternativo` en
     * `src/lib/schema.ts` pone este caso en rojo — y ése es exactamente el día en
     * que hay que volver a pintarle el error al campo en `GaleriaEditor`.
     */
    const rechazos = (alt: string) =>
      faltaParaPublicar(conImagen({ textoAlternativo: alt }))
        .map((i) => i.path.join('.'))
        .sort();

    // Control positivo: si el formulario no tuviera ningún rechazo, la
    // comparación de abajo pasaría comparando dos listas vacías.
    expect(rechazos('Flyer con la fecha').length).toBeGreaterThan(0);
    expect(rechazos('a'.repeat(5_000))).toEqual(rechazos('Flyer con la fecha'));
    expect(rechazos('a'.repeat(5_000))).not.toContain('imagenes.0.textoAlternativo');
  });

  it('la analítica conoce la ruta, y solo la ruta', () => {
    // El vocabulario se deriva del schema (D-60) y lo ata
    // `tests/analytics-campos.test.ts`. Lo que viaja es el **nombre** del campo
    // que falló, nunca el texto: no hay sanitizador de texto libre y no se agrega
    // uno.
    expect(CAMPOS_VALIDABLES).toContain('imagenes.N.textoAlternativo');
  });
});
