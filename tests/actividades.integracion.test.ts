import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { initializeApp as initAdmin, deleteApp as deleteAdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { initializeApp, deleteApp } from 'firebase/app';
import { signInWithCustomToken, signOut } from 'firebase/auth';
import {
  collection,
  connectFirestoreEmulator,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { auth } from '@/lib/firebase-client';
import { db } from '@/lib/firestore-client';
import {
  actualizarActividad,
  crearActividad,
  documentoAForm,
  leerActividad,
  marcarCupoCompleto,
  slugDisponible,
} from '@/lib/actividades';
import { duplicarActividadForm } from '@/lib/duplicar';
import { toPublic } from '@/lib/toPublic';
import { sesionVacia } from '@/lib/sesiones';
import type { ActividadForm } from '@/types/actividad';
import { HOST_FIRESTORE, cargarReglas, emuladorVivo, limpiarFirestore } from './emulador';

const vivo = await emuladorVivo();

const UID = 'uid_test_admin';

/*
 * El emulador sirve el `firestore.rules` del directorio desde el que se lo
 * arrancó, no el de este checkout. Este archivo es el que verifica las reglas y
 * era el único que no las empujaba: con un worktree en paralelo podía estar
 * dando verde sobre el archivo de otra rama — el modo de falla que el docblock
 * de `cargarReglas` describe y que `reportes-reintento` ya evitaba.
 */
const REGLAS = fileURLToPath(new URL('../firestore.rules', import.meta.url));

/**
 * Afirma que una lectura se rechazó **por permisos**, y no por cualquier otra
 * cosa.
 *
 * Un `rejects.toThrow()` pelado también lo satisface un emulador que se cayó a
 * mitad de corrida, un `db()` que tira o un projectId equivocado: los tests de
 * reglas pintarían verde sin haber probado ninguna regla. Lo señaló el
 * `auditor-privacidad` sobre este mismo cambio.
 *
 * Lo que **no** sirve es apretar el mensaje. Para una lectura denegada el
 * emulador no devuelve "Missing or insufficient permissions" —eso es de las
 * escrituras— sino la traza de evaluación (`false for 'get' @ L50`) o incluso
 * `Property estado is undefined on object`, que es la forma que toma la trampa 7
 * cuando la regla no se puede evaluar sin el `where`. Se probó: el matcher por
 * mensaje falla en las cuatro.
 *
 * El `code` de la `FirebaseError`, en cambio, es `permission-denied` en todos
 * esos casos, y es `unavailable` si el emulador no está. Eso es lo que separa
 * "la regla denegó" de "no se pudo preguntar".
 */
const rechazadaPorPermisos = async (lectura: Promise<unknown>, que: string) => {
  let error: unknown;
  try {
    await lectura;
  } catch (e) {
    error = e;
  }
  expect(error, `${que}: la lectura NO se rechazó`).toBeDefined();
  expect((error as { code?: string }).code, `${que}: se rechazó, pero no por permisos`).toBe(
    'permission-denied',
  );
};

const tokenAdmin = async (uid: string, esAdmin: boolean) => {
  const app = initAdmin({ projectId: 'agenda-literaria' }, `t-${uid}-${Date.now()}`);
  const a = getAdminAuth(app);
  try {
    await a.createUser({ uid });
  } catch {
    /* ya existía */
  }
  await a.setCustomUserClaims(uid, esAdmin ? { admin: true } : {});
  const token = await a.createCustomToken(uid, esAdmin ? { admin: true } : {});
  await deleteAdminApp(app);
  return token;
};

const formCompleto = (): ActividadForm => ({
  tipo: 'club-lectura',
  titulo: 'Club de lectura latinoamericana',
  slug: 'club-latinoamericana',
  descripcion: 'Ocho encuentros por narrativa del boom y después.',
  imagenes: [],
  organizador: { nombre: 'Casa Brandon', instagram: '@casabrandon', web: '' },
  tallerista: { nombre: 'María Moreno', bio: 'Cronista', instagram: '@mmoreno' },
  libro: { titulo: '', autor: '' },
  esCiclo: true,
  sesiones: [
    { ...sesionVacia(), inicio: '2026-09-03T19:00', fin: '2026-09-03T21:00', tema: 'Cap. 1-4' },
    { ...sesionVacia(), inicio: '2026-09-10T19:00', fin: '2026-09-10T21:00', tema: 'Cap. 5-8' },
  ],
  // B-224 — una fila híbrida: el mismo lugar de antes, ahora adentro de la forma
  // de cursar. `modalidad`, `sede` y `online` son derivados y los escribe
  // `formADocumento`.
  modalidades: [
    {
      id: 'mod_a',
      modalidad: 'hibrido',
      inicio: '',
      fin: '',
      sede: {
        nombre: 'Casa Brandon',
        direccion: 'Drago 236',
        barrio: 'villa-crespo',
        ciudad: 'CABA',
        indicaciones: 'Timbre 2',
        geo: null,
      },
      online: { plataforma: 'zoom', url: 'https://zoom.us/j/secreto', urlPublica: false },
    },
  ],
  inscripcion: {
    requiere: true,
    via: 'mail',
    destino: 'hola@casabrandon.example',
    cupo: 12,
    cierra: '2026-09-01T00:00',
    // B-97 — en `true` para que la ida y vuelta lo ejercite: con `false` no se
    // distingue "lo conserva" de "lo pisa con el default".
    completo: true,
  },
  arancel: { tipo: 'a-la-gorra', notas: 'incluye material' },
  material: {
    tiene: true,
    items: [
      { tipo: 'guia', titulo: 'Guía de lectura', url: 'https://drive/privado', entrega: 'al-inscribirse', publico: false },
    ],
  },
  difusion: { arrobar: ['@editorial'], notas: 'coordinar con prensa' },
  estado: 'borrador',
  tags: ['narrativa'],
  destacado: false,
});

describe.skipIf(!vivo)('guardado de actividades contra el emulador', () => {
  beforeAll(async () => {
    await limpiarFirestore();
    await signInWithCustomToken(auth(), await tokenAdmin(UID, true));
  }, 30_000);

  it('guarda las fechas como Timestamp, no como string (trampa 1)', async () => {
    const id = await crearActividad(formCompleto(), UID);
    const a = await leerActividad(id);
    const s = a!.sesiones[0]!;
    expect(typeof s.inicio.toDate).toBe('function');
    expect(s.inicio.toDate().getHours()).toBe(19);
  });

  it('conserva los ids de sesión generados en el cliente (trampa 2)', async () => {
    const form = formCompleto();
    form.slug = 'club-ids';
    const idsOriginales = form.sesiones.map((s) => s.id);

    const id = await crearActividad(form, UID);
    const a = await leerActividad(id);
    expect(a!.sesiones.map((s) => s.id)).toEqual(idsOriginales);
    expect(idsOriginales.every((i) => i.startsWith('ses_'))).toBe(true);
  });

  it('borrar una sesión no renumera las otras (trampa 2)', async () => {
    const form = formCompleto();
    form.slug = 'club-borrado';
    form.sesiones = [
      { ...sesionVacia(), inicio: '2026-09-03T19:00', fin: '2026-09-03T21:00' },
      { ...sesionVacia(), inicio: '2026-09-10T19:00', fin: '2026-09-10T21:00' },
      { ...sesionVacia(), inicio: '2026-09-17T19:00', fin: '2026-09-17T21:00' },
    ];
    const id = await crearActividad(form, UID);

    const sobreviviente = form.sesiones[2]!.id;
    const conMenos = { ...form, sesiones: [form.sesiones[0]!, form.sesiones[2]!] };
    await actualizarActividad(id, conMenos, UID);

    const a = await leerActividad(id);
    expect(a!.sesiones).toHaveLength(2);
    // El id del tercer encuentro sigue siendo el mismo: el diff de §7.2 no va a
    // creer que cambió.
    expect(a!.sesiones[1]!.id).toBe(sobreviviente);
  });

  it('calcula el searchText normalizado (§6)', async () => {
    const form = formCompleto();
    form.slug = 'club-search';
    const id = await crearActividad(form, UID);
    const a = await leerActividad(id);
    expect(a!.searchText).toContain('latinoamericana');
    expect(a!.searchText).toContain('villa-crespo');
    expect(a!.searchText).toContain('maria moreno');
  });

  it('preserva createdAt y createdBy al editar', async () => {
    const form = formCompleto();
    form.slug = 'club-auditoria';
    const id = await crearActividad(form, UID);
    const antes = await leerActividad(id);

    await actualizarActividad(id, { ...form, titulo: 'Título nuevo' }, 'otro_uid');
    const despues = await leerActividad(id);

    expect(despues!.createdBy).toBe(UID);
    expect(despues!.updatedBy).toBe('otro_uid');
    expect(despues!.createdAt.toMillis()).toBe(antes!.createdAt.toMillis());
  });

  it('descarta la sede de una fila que pasó a virtual (§11, B-224)', async () => {
    // El formulario **conserva** la sede al cambiar el selector —las cascadas no
    // borran lo que alguien escribió— y es `formADocumento` el que decide que no
    // se escribe. Sin eso, una dirección que la actividad ya no tiene saldría al
    // `events.json` y al evento.
    const base = formCompleto();
    const form = {
      ...base,
      slug: 'club-virtual',
      modalidades: [{ ...base.modalidades[0]!, modalidad: 'virtual' as const }],
    };
    const id = await crearActividad(form, UID);
    const a = await leerActividad(id);
    expect(a!.modalidades[0]!.sede).toBeNull();
    expect(a!.modalidades[0]!.online?.plataforma).toBe('zoom');
    // Y los derivados acompañan: sin fila presencial no hay sede principal.
    expect(a!.sede).toBeNull();
    expect(a!.modalidad).toBe('virtual');
    expect(a!.online?.plataforma).toBe('zoom');
  });

  it('B-224 — dos formas de cursar: la resultante es híbrida y la sede es la primera', async () => {
    const base = formCompleto();
    const form = {
      ...base,
      slug: 'club-dos-modalidades',
      modalidades: [
        { ...base.modalidades[0]!, id: 'mod_pres', modalidad: 'presencial' as const },
        {
          id: 'mod_virt',
          modalidad: 'virtual' as const,
          inicio: '2026-10-01T19:00',
          fin: '2026-12-01T21:00',
          sede: null,
          online: { plataforma: 'meet', url: 'https://meet.example/x', urlPublica: false },
        },
      ],
    };
    const id = await crearActividad(form, UID);
    const a = await leerActividad(id);
    expect(a!.modalidades).toHaveLength(2);
    expect(a!.modalidad).toBe('hibrido');
    expect(a!.sede?.nombre).toBe('Casa Brandon');
    // El online principal es el de la **primera fila que tenga uno**: la
    // presencial no lo tiene (§11 lo borra al guardar), así que es el de la
    // virtual.
    expect(a!.online?.plataforma).toBe('meet');
    // Trampa 1 — la ventana viaja como `Timestamp`, no como string.
    expect(typeof a!.modalidades[1]!.inicio?.toMillis()).toBe('number');
    expect(a!.modalidades[0]!.inicio).toBeNull();
  });

  it('detecta un slug ya tomado', async () => {
    const form = { ...formCompleto(), slug: 'club-unico' };
    const id = await crearActividad(form, UID);
    expect(await slugDisponible('club-unico')).toBe(false);
    // El propio documento no cuenta como conflicto consigo mismo.
    expect(await slugDisponible('club-unico', id)).toBe(true);
    expect(await slugDisponible('club-libre')).toBe(true);
  });

  it('el ida y vuelta form → documento → form no pierde datos', async () => {
    const form = { ...formCompleto(), slug: 'club-roundtrip' };
    const id = await crearActividad(form, UID);
    const doc = await leerActividad(id);
    const vuelta = documentoAForm(doc!);

    expect(vuelta.titulo).toBe(form.titulo);
    expect(vuelta.sesiones.map((s) => s.id)).toEqual(form.sesiones.map((s) => s.id));
    expect(vuelta.sesiones[0]!.inicio).toBe('2026-09-03T19:00');
    expect(vuelta.inscripcion.cierra).toBe('2026-09-01T00:00');
    expect(vuelta.material.items[0]!.publico).toBe(false);
  });

  it('la copia se guarda como documento nuevo sin tocar los ids ni los eventos del original (B-11)', async () => {
    const form = { ...formCompleto(), slug: 'club-b11', estado: 'publicado' as const };
    // El original ya tiene sus eventos en el calendario.
    form.sesiones = form.sesiones.map((s, i) => ({ ...s, calendarEventId: `evento_${i}` }));
    const idOriginal = await crearActividad(form, UID);

    const guardado = await leerActividad(idOriginal);
    const copia = duplicarActividadForm(documentoAForm(guardado!), { tomados: [form.slug] });
    const idCopia = await crearActividad(copia, 'otro_uid');

    expect(idCopia).not.toBe(idOriginal);
    const laCopia = await leerActividad(idCopia);
    const elOriginal = await leerActividad(idOriginal);

    // La copia: borrador, slug propio, sin eventos y con ids de sesión nuevos.
    expect(laCopia!.estado).toBe('borrador');
    expect(laCopia!.slug).toBe('club-b11-copia');
    expect(laCopia!.sesiones.every((s) => s.calendarEventId === null)).toBe(true);
    const idsOriginal = elOriginal!.sesiones.map((s) => s.id);
    expect(laCopia!.sesiones.some((s) => idsOriginal.includes(s.id))).toBe(false);
    // Fechas como Timestamp, no como string (trampa 1).
    expect(typeof laCopia!.sesiones[0]!.inicio.toDate).toBe('function');
    // `createdAt`/`createdBy` son de la copia.
    expect(laCopia!.createdBy).toBe('otro_uid');

    // Y el original, intacto: sus eventos de Calendar siguen siendo suyos.
    expect(elOriginal!.estado).toBe('publicado');
    expect(elOriginal!.createdBy).toBe(UID);
    expect(elOriginal!.sesiones.map((s) => s.calendarEventId)).toEqual(['evento_0', 'evento_1']);
  });

  /**
   * B-97 — «se llenó», marcado desde el listado contra el emulador.
   *
   * Va contra el emulador y no en un test puro porque lo que se verifica es
   * **semántica de Firestore**: `marcarCupoCompleto` escribe con ruta punteada
   * (`'inscripcion.completo'`), y lo que hay que ver es que eso deje el resto del
   * objeto `inscripcion` intacto en el documento de verdad. Un `updateDoc` con la
   * clave sin puntear reemplazaría el objeto entero y se llevaría el destino, el
   * cupo y el cierre — y desde el listado no hay formulario con el que reponerlos.
   */
  it('marcar el cupo completo no pisa el resto de la inscripción (B-97)', async () => {
    const form = { ...formCompleto(), slug: 'club-b97', estado: 'publicado' as const };
    const id = await crearActividad(form, UID);

    await marcarCupoCompleto(id, true, 'otro_uid');
    const lleno = await leerActividad(id);

    expect(lleno!.inscripcion.completo).toBe(true);
    // Lo que NO se tocó: el resto del bloque sigue igual, y con sus tipos.
    expect(lleno!.inscripcion.destino).toBe('hola@casabrandon.example');
    expect(lleno!.inscripcion.cupo).toBe(12);
    expect(lleno!.inscripcion.requiere).toBe(true);
    expect(lleno!.inscripcion.via).toBe('mail');
    expect(typeof lleno!.inscripcion.cierra!.toDate).toBe('function');
    // Firma la edición, que es lo que hace correr el historial y el rebuild.
    expect(lleno!.updatedBy).toBe('otro_uid');
    // Y no toca nada de afuera del bloque.
    expect(lleno!.createdBy).toBe(UID);
    expect(lleno!.sesiones.map((x) => x.id)).toEqual(form.sesiones.map((x) => x.id));

    // Apagarlo vuelve a `false` y no deja el campo ausente: `undefined` en un
    // `updateDoc` no borra, y el default de lectura tiene que seguir siendo el
    // valor guardado y no el de un campo que falta.
    await marcarCupoCompleto(id, false, UID);
    const vacio = await leerActividad(id);
    expect(vacio!.inscripcion.completo).toBe(false);
    expect(documentoAForm(vacio!).inscripcion.completo).toBe(false);
  });

  it('lo que se guarda, proyectado, no filtra el link ni la difusión (§5)', async () => {
    const form = { ...formCompleto(), slug: 'club-proyeccion', estado: 'publicado' as const };
    const id = await crearActividad(form, UID);
    const a = await leerActividad(id);

    const json = JSON.stringify(toPublic(a!, id));
    expect(json).not.toContain('zoom.us/j/secreto');
    expect(json).not.toContain('drive/privado');
    expect(json).not.toContain('coordinar con prensa');
    expect(json).not.toContain(UID);
    expect(json).toContain('Guía de lectura');
  });
});

describe.skipIf(!vivo)('reglas de Firestore — §5.3', () => {
  beforeAll(async () => {
    await limpiarFirestore();
    await cargarReglas(REGLAS);
    await signInWithCustomToken(auth(), await tokenAdmin(UID, true));
    /*
     * La publicada lleva adentro los campos del §5.1 a propósito: son
     * exactamente los que un anónimo recibía cuando la regla decía
     * `resource.data.estado == 'publicado'` (D-130). Puestos acá, el día que
     * alguien afloje la regla el test no solo falla: el diff dice qué se
     * filtraba.
     */
    await setDoc(doc(db(), 'actividades', 'publicada'), {
      titulo: 'Publicada',
      estado: 'publicado',
      online: { plataforma: 'zoom', url: 'https://zoom.us/j/secreto', urlPublica: false },
      difusion: { arrobar: ['@editorial'], notas: 'coordinar con prensa' },
      createdBy: UID,
      sesiones: [{ id: 'ses_1', calendarEventId: 'evt_privado' }],
      imagenes: [{ id: 'img_1', storagePath: 'actividades/ruta/privada.jpg' }],
    });
    await setDoc(doc(db(), 'actividades', 'borrador'), {
      titulo: 'Borrador',
      estado: 'borrador',
    });
  }, 30_000);

  it('sin el claim admin no se puede escribir', async () => {
    await signInWithCustomToken(auth(), await tokenAdmin('uid_pelado', false));
    await expect(
      setDoc(doc(db(), 'actividades', 'intento'), { titulo: 'No', estado: 'borrador' }),
    ).rejects.toThrow(/permission|insufficient/i);
  });

  /*
   * ── Control positivo, y no es decorativo ─────────────────────────────
   * Los dos `it` que siguen afirman que una lectura se rechaza. Un rechazo
   * también ocurre si el documento no existe, si `limpiarFirestore` corrió de
   * más o si el `beforeAll` falló en silencio: sin este control, los dos darían
   * verde sobre una colección vacía sin haber probado nada. Es el mismo motivo
   * por el que `bundle-panel.test.ts` sigue los `import()` para comprobar que
   * el SDK *sí* aparece.
   */
  it('el admin SÍ lee la publicada, con sus campos privados adentro', async () => {
    await signInWithCustomToken(auth(), await tokenAdmin(UID, true));
    const snap = await getDoc(doc(db(), 'actividades', 'publicada'));
    expect(snap.exists()).toBe(true);
    expect(snap.data()?.online?.url).toBe('https://zoom.us/j/secreto');
  });

  /*
   * El positivo por **query**, y no solo por documento: son dos permisos
   * distintos (`get` y `list`), y el camino de la fuga era la query. Sin esto, el
   * rechazo de abajo podría estar tapando que el admin tampoco puede listar —o
   * sea, el panel roto— y el test seguiría en verde. Lo señaló el
   * `auditor-privacidad` sobre este cambio.
   */
  it('el admin SÍ hace la query con el where y le vuelve la publicada', async () => {
    await signInWithCustomToken(auth(), await tokenAdmin(UID, true));
    const snap = await getDocs(
      query(collection(db(), 'actividades'), where('estado', '==', 'publicado')),
    );
    expect(snap.size).toBe(1);
  });

  /*
   * D-130 — lo que este `it` afirma es lo contrario de lo que afirmaba hasta el
   * 2026-08-27, cuando decía `it('un anónimo lee lo publicado')`. Ese `it` no
   * estaba mal escrito: fijaba como deseado el comportamiento que prescribía el
   * §5.3 del `CLAUDE.md`. Lo que estaba mal era la regla, porque una regla no
   * proyecta: entregaba el documento entero y no la vista de `toPublic`.
   */
  it('un anónimo NO lee una actividad publicada: el documento trae el link y la difusión (§5.1)', async () => {
    await signOut(auth());
    await rechazadaPorPermisos(
      getDoc(doc(db(), 'actividades', 'publicada')),
      'la publicada, por documento',
    );
  });

  /*
   * Por query y no solo por documento, porque son dos permisos distintos: la
   * fuga real no era un `getDoc` con el id adivinado —los ids son `act_<uuid>`—
   * sino esta query, que devolvía la colección entera y cruda de una sola vez.
   *
   * Con la regla anterior pasaba: cada documento devuelto cumplía la condición.
   * Sin el `where` se rechazaba por la **trampa 7** del §13, que es otro modo de
   * falla — y ese contraste, que esta regla ya no puede ejercitar porque no
   * condiciona por `resource.data`, está fijado en el `describe('trampa 7 — el
   * mecanismo, con una regla condicionada')` al final del archivo.
   */
  it('una query anónima no devuelve documentos, ni con el where del §5.3', async () => {
    await signOut(auth());
    await rechazadaPorPermisos(
      getDocs(query(collection(db(), 'actividades'), where('estado', '==', 'publicado'))),
      'la query con el where',
    );
  });

  it('un anónimo NO lee un borrador', async () => {
    await signOut(auth());
    await rechazadaPorPermisos(getDoc(doc(db(), 'actividades', 'borrador')), 'el borrador');
  });

  it('las opciones se leen sin estar logueado (§4.4)', async () => {
    await signOut(auth());
    await expect(getDoc(doc(db(), 'opciones', 'arancel'))).resolves.toBeDefined();
  });

  it('sin el claim admin no se pueden escribir opciones', async () => {
    await signOut(auth());
    await expect(
      setDoc(doc(db(), 'opciones', 'arancel'), { valores: [] }),
    ).rejects.toThrow(/permission|insufficient/i);
  });
});

/*
 * ── La trampa 7 del §13, probada como mecanismo y no como consecuencia ──────
 *
 * Este bloque nació de un hallazgo del `auditor-trampas` sobre el cambio de
 * D-130, y vale contar por qué, porque es un modo de falla de los tests y no
 * del código.
 *
 * Al cerrar B-224 la regla pasó a `allow read: if esAdmin()`, y con eso el `it`
 * de arriba —«una query anónima no devuelve documentos, ni con el where»— pasó a
 * dar verde. Se dio por cerrada la trampa 7. **Pero pasaba por el motivo
 * equivocado:** sin ninguna condición sobre `resource.data`, *toda* query
 * anónima se rechaza, con `where` y sin `where`. Lo que la trampa 7 describe es
 * un **contraste**: con la regla condicionada, la query CON el `where` pasa y la
 * query SIN el `where` se rechaza entera en vez de devolver el subconjunto
 * visible. Ese contraste no lo ejercitaba nada.
 *
 * Y el chequeo de `mapa-de-trampas.test.ts` no podía notarlo: exige que algún
 * archivo de `tests/` diga `trampa 7`, y eso lo satisface un comentario.
 *
 * Así que este test carga **su propio ruleset** con la regla condicionada, en un
 * projectId aparte, y afirma las dos mitades. Queda independiente de cuál sea la
 * regla viva en `/actividades`: el día que B-01 necesite lectura en vivo y
 * alguien vuelva a condicionar por `resource.data` —la subcolección `privado/`
 * de D-130, o cualquier otra forma—, el mecanismo ya está fijado.
 */
describe.skipIf(!vivo)('trampa 7 — el mecanismo, con una regla condicionada', () => {
  const PID = 'trampa-7-mecanismo';
  const BASE = `http://${HOST_FIRESTORE}/v1/projects/${PID}/databases/(default)/documents`;

  // La regla que el §5.3 del CLAUDE.md prescribía, aislada en su propio
  // projectId: cargarla sobre `agenda-literaria` reabriría la fuga de B-224
  // para los tests que corran después.
  const REGLA_CONDICIONADA = `
    rules_version = '2';
    service cloud.firestore {
      match /databases/{database}/documents {
        match /cosas/{id} {
          allow read: if resource.data.estado == 'publicado';
          allow write: if false;
        }
      }
    }`;

  let app: ReturnType<typeof initializeApp>;
  let base: ReturnType<typeof getFirestore>;

  beforeAll(async () => {
    const r = await fetch(`http://${HOST_FIRESTORE}/emulator/v1/projects/${PID}:securityRules`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rules: { files: [{ name: 'firestore.rules', content: REGLA_CONDICIONADA }] },
      }),
    });
    if (!r.ok) throw new Error(`el emulador rechazó el ruleset de prueba: ${r.status}`);

    // Se siembra con `Bearer owner`, que en el emulador saltea las reglas: es el
    // equivalente del Admin SDK y lo que hace el panel logueado.
    for (const [id, estado] of [
      ['publicada', 'publicado'],
      ['borrador', 'borrador'],
    ]) {
      const w = await fetch(`${BASE}/cosas?documentId=${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
        body: JSON.stringify({ fields: { estado: { stringValue: estado } } }),
      });
      if (!w.ok) throw new Error(`no se pudo sembrar ${id}: ${w.status}`);
    }

    app = initializeApp({ projectId: PID, apiKey: 'fake-api-key' }, 'trampa-7');
    base = getFirestore(app);
    connectFirestoreEmulator(base, HOST_FIRESTORE.split(':')[0]!, Number(HOST_FIRESTORE.split(':')[1]));
  }, 30_000);

  afterAll(async () => {
    await fetch(`http://${HOST_FIRESTORE}/emulator/v1/projects/${PID}/databases/(default)/documents`, {
      method: 'DELETE',
    });
    await deleteApp(app);
  });

  it('control positivo: el documento publicado SÍ se lee de a uno', async () => {
    // Sin esto, los dos de abajo podrían estar pasando sobre una colección
    // vacía o un ruleset que no cargó, y el contraste no probaría nada.
    const snap = await getDoc(doc(base, 'cosas', 'publicada'));
    expect(snap.exists()).toBe(true);
  });

  it('la query CON el where devuelve el subconjunto visible', async () => {
    const snap = await getDocs(
      query(collection(base, 'cosas'), where('estado', '==', 'publicado')),
    );
    expect(snap.size).toBe(1);
  });

  it('la query SIN el where se rechaza ENTERA, no devuelve lo visible', async () => {
    // Esta es la trampa: uno esperaría un resultado filtrado y recibe un
    // rechazo. Es lo que hace que una lectura en vivo del sitio público falle
    // por completo si alguien olvida el where del §5.3.
    await rechazadaPorPermisos(getDocs(collection(base, 'cosas')), 'la query sin el where');
  });
});
