/**
 * Reglas y escritura de `/propuestas/{id}` contra el emulador — B-830.
 *
 * ── Por qué este archivo importa más que los otros de integración ─────────
 * `/propuestas` es la colección donde va a vivir **la primera escritura anónima
 * del proyecto**, y `propuestaValida()` es lo único que va a acotar la forma de
 * un documento que escribe alguien sin login. El schema de zod no cuenta: se
 * saltea con un `curl`. Así que cada tope, cada enum y cada `null` de la regla
 * tiene su caso acá, y se prueban **contra el emulador** porque un `grep` al
 * archivo pasaría con la regla escrita mal (`'Publicado'`, `!=`, el campo
 * renombrado) — el argumento de B-218.
 *
 * ── El `create` todavía está cerrado, y los casos lo dicen ────────────────
 * Falta que App Check esté **exigiendo** (B-836a, pasos del dueño). Mientras
 * tanto la regla es `esAdmin() && propuestaValida()`, así que la validación se
 * ejercita por el camino del admin —que es un camino del PRD y no un andamio:
 * sirve para cargar lo que llega por DM— y el `describe` del final fija el
 * estado de la puerta y nombra qué hay que hacer para abrirla.
 *
 * Las reglas que se verifican son las de **este** checkout: se empujan por la
 * API del emulador en el `beforeAll` (B-174).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { initializeApp as initAdmin, deleteApp as deleteAdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { signInWithCustomToken, signOut } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { auth } from '@/lib/firebase-client';
import { db } from '@/lib/firestore-client';
import { formAPropuesta, propuestaVacia } from '@/lib/propuesta-schema';
import type { Propuesta, PropuestaForm } from '@/types/propuesta';
import {
  PROJECT_ID,
  cargarReglas,
  emuladorAuthVivo,
  emuladorVivo,
  limpiarFirestore,
} from './emulador';

const vivo = (await emuladorVivo()) && (await emuladorAuthVivo());
const REGLAS = fileURLToPath(new URL('../firestore.rules', import.meta.url));

const UID = 'uid_propuestas_admin';
const UID_OTRO = 'uid_propuestas_admin_2';
const UID_PELADO = 'uid_propuestas_sin_claim';

const token = async (uid: string, esAdmin: boolean) => {
  const app = initAdmin({ projectId: PROJECT_ID }, `p-${uid}-${Date.now()}`);
  const a = getAdminAuth(app);
  try {
    await a.createUser({ uid });
  } catch {
    /* ya existía */
  }
  await a.setCustomUserClaims(uid, esAdmin ? { admin: true } : {});
  const t = await a.createCustomToken(uid, esAdmin ? { admin: true } : {});
  await deleteAdminApp(app);
  return t;
};

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

/**
 * El documento tal como lo va a mandar el cliente, para poder deformarlo campo
 * por campo. `origen: 'panel'` porque el `create` de hoy es del admin, y la
 * regla exige que el origen coincida con quién escribe.
 */
const documento = (over: Record<string, unknown> = {}, f: PropuestaForm = form()) => ({
  ...formAPropuesta(f, 'panel'),
  creadoEn: serverTimestamp(),
  ...over,
});

const RECHAZADA = /permission|insufficient/i;

describe.skipIf(!vivo)('propuestas contra el emulador — B-830', () => {
  beforeAll(async () => {
    await limpiarFirestore();
    // B-174 / B-219 — las reglas de este checkout, sobre la base de este
    // working-tree, que arranca sin ninguna.
    await cargarReglas(REGLAS);
    await signInWithCustomToken(auth(), await token(UID, true));
  }, 30_000);

  describe('el camino que hoy funciona: un admin carga lo que llegó por DM', () => {
    it('crea una propuesta válida y la puede leer', async () => {
      await setDoc(doc(db(), 'propuestas', 'p_ok'), documento());
      const snap = await getDoc(doc(db(), 'propuestas', 'p_ok'));
      expect(snap.exists()).toBe(true);
      const d = snap.data() as Propuesta;
      expect(d.titulo).toBe('Taller de crónica urbana');
      // El estado y la revisión nacen como la regla exige, y salen del armado
      // puro: si `formAPropuesta` los pusiera mal, esto no se escribiría.
      expect(d.estado).toBe('nueva');
      expect(d.revision).toEqual({
        porUid: null,
        en: null,
        actividadId: null,
        motivo: null,
      });
    });

    it('acepta los opcionales en null, que es lo que una regla mal escrita rechaza de más', async () => {
      // Acceder a un campo `null` en las reglas no es `false`: es un error de
      // evaluación, y un error deniega igual. Es el mismo caso que la sugerencia
      // sin severidad de `/reportes`.
      await setDoc(
        doc(db(), 'propuestas', 'p_nulls'),
        documento(
          {},
          form({
            organizador: { nombre: 'Alguien', instagram: '' },
            arancel: { tipo: 'a-la-gorra', notas: '' },
            inscripcion: { requiere: false, comoDice: '' },
            incluyeOtro: '',
            imagenUrl: '',
          }),
        ),
      );
      const d = (await getDoc(doc(db(), 'propuestas', 'p_nulls'))).data() as Propuesta;
      expect(d.organizador.instagram).toBeNull();
      expect(d.arancel.notas).toBeNull();
      expect(d.inscripcion.comoDice).toBeNull();
      expect(d.incluyeOtro).toBeNull();
      expect(d.imagen).toBeNull();
    });

    it('una propuesta virtual va sin lugar, y la regla lo acepta', async () => {
      await setDoc(
        doc(db(), 'propuestas', 'p_virtual'),
        documento({}, form({ modalidad: 'virtual' })),
      );
      const d = (await getDoc(doc(db(), 'propuestas', 'p_virtual'))).data() as Propuesta;
      expect(d.lugar).toBeNull();
      expect(d.modalidad).toBe('virtual');
    });

    it('acepta las doce fechas y los doce «incluye», que son los topes', async () => {
      const doce = Array.from({ length: 12 }, (_, i) => ({
        dia: `2026-10-${String(i + 1).padStart(2, '0')}`,
        desde: '19:00',
        hasta: null,
      }));
      await setDoc(
        doc(db(), 'propuestas', 'p_topes'),
        documento({
          fechas: doce,
          incluye: Array.from({ length: 12 }, (_, i) => `cosa-${i}`),
        }),
      );
      const d = (await getDoc(doc(db(), 'propuestas', 'p_topes'))).data() as Propuesta;
      expect(d.fechas).toHaveLength(12);
      expect(d.incluye).toHaveLength(12);
    });
  });

  describe('la forma: lo que `propuestaValida()` rechaza', () => {
    const rechaza = async (que: string, over: Record<string, unknown>) => {
      await expect(
        setDoc(doc(db(), 'propuestas', `p_no_${que}`), documento(over)),
        que,
      ).rejects.toThrow(RECHAZADA);
    };

    it('un campo de más no entra', async () => {
      // `hasOnly` — es lo que impide que alguien invente un campo y lo guarde.
      await rechaza('extra', { notaInterna: 'no publicar' });
    });

    it('un campo de menos tampoco', async () => {
      const { contacto: _, ...sinContacto } = documento();
      await expect(
        setDoc(doc(db(), 'propuestas', 'p_no_falta'), sinContacto),
      ).rejects.toThrow(RECHAZADA);
    });

    it('el título fuera de 6–120', async () => {
      await rechaza('titulo_corto', { titulo: 'hola' });
      await rechaza('titulo_largo', { titulo: 'x'.repeat(121) });
    });

    it('la descripción fuera de 15–4000', async () => {
      await rechaza('desc_corta', { descripcion: 'corto' });
      await rechaza('desc_larga', { descripcion: 'x'.repeat(4001) });
    });

    it('sin fechas, o con trece', async () => {
      await rechaza('sin_fechas', { fechas: [] });
      await rechaza('trece_fechas', {
        fechas: Array.from({ length: 13 }, () => ({ dia: '2026-10-07', desde: '19:00', hasta: null })),
      });
    });

    it('las fechas que no son una lista', async () => {
      await rechaza('fechas_string', { fechas: 'el jueves' });
    });

    it('una modalidad que no es una de las tres', async () => {
      // `'hibrido'` es el valor del **modelo**, no el del formulario público: es
      // el error más probable de quien escriba el cliente mirando `Actividad`.
      await rechaza('modalidad', { modalidad: 'hibrido' });
    });

    it('un arancel que no es uno de los tres `fijo: true` (§4.2)', async () => {
      // `beca-parcial` existe en la taxonomía y **no** se ofrece en el
      // formulario público: crear una opción es escribir en `/opciones/*`, que
      // es de lectura pública y viaja al `events.json`.
      await rechaza('arancel', { arancel: { tipo: 'beca-parcial', notas: null } });
    });

    it('un contacto sin vía conocida, o demasiado corto', async () => {
      await rechaza('via', { contacto: { via: 'telepatia', valor: 'hola@test.com' } });
      await rechaza('contacto_corto', { contacto: { via: 'mail', valor: 'a' } });
    });

    it('trece «incluye»', async () => {
      await rechaza('incluye', { incluye: Array.from({ length: 13 }, (_, i) => `c-${i}`) });
    });

    it('un `incluyeOtro` de más de 200', async () => {
      await rechaza('otro_largo', { incluyeOtro: 'x'.repeat(201) });
    });

    it('una imagen con las dos claves a la vez (DEC-11)', async () => {
      // Una URL de afuera **o** un objeto del bucket, nunca las dos. Lo rechaza
      // el `hasOnly`: ninguno de los dos acepta un mapa con la clave del otro.
      await rechaza('imagen_dos', {
        imagen: { url: 'https://x.test/a.jpg', storagePath: 'propuestas/a.jpg' },
      });
    });

    it('una imagen vacía, o con la URL vacía', async () => {
      /*
       * `{}` pasa `hasOnly(['url'])` —no tiene ninguna clave de más— así que la
       * mitad que lo frena es otra: el `.get('url', '').size() >= 1`. Estos dos
       * casos existen porque ese `>= 1` se lee como un detalle y es lo único que
       * rechaza el mapa vacío **con un `false` limpio** en vez de con un error de
       * evaluación. Verificado por mutación.
       */
      await rechaza('imagen_vacia', { imagen: {} });
      await rechaza('imagen_url_vacia', { imagen: { url: '' } });
    });

    it('una imagen con una clave inventada', async () => {
      await rechaza('imagen_rara', { imagen: { ruta: 'propuestas/a.jpg' } });
    });

    it('un lugar con un campo de más', async () => {
      await rechaza('lugar_extra', {
        lugar: { nombre: 'X', direccion: 'Y', barrio: 'z', piso: '3' },
      });
    });

    /**
     * **Y con las claves de menos, que es la mitad que `hasOnly` NO frena** — lo
     * encontró el `auditor-privacidad`. Con `.get(k, '')` y solo `hasOnly`,
     * `lugar: {}` y `lugar: { barrio: 'x' }` **entraban**: el `.get()` devuelve
     * `''` y los tres asertos de tamaño pasan. El tipo declara los tres strings
     * como requeridos, así que la bandeja iba a leer `undefined`.
     */
    it('un lugar con las claves de menos, o vacío', async () => {
      await rechaza('lugar_vacio', { lugar: {} });
      await rechaza('lugar_parcial', { lugar: { barrio: 'villa-crespo' } });
    });

    /**
     * **Los cinco mapas anidados exigen todas sus claves**, y hasta este cambio
     * eso lo sostenía **el error de evaluación** y no una cláusula declarada. Los
     * casos existen para que el `hasAll` de cada uno se pueda mutar: sin ellos,
     * borrarlo dejaba la suite en verde y la regla «funcionando» por el camino
     * equivocado — que es lo que dejaba abierta la puerta a aflojarla sin querer
     * al pasar los accesos directos a `.get()`.
     *
     * El de `contacto` es el que más importa: es el mapa del dato personal del
     * tercero.
     */
    /**
     * **La clave opcional AUSENTE, que es el caso que el `hasAll` de cada mapa
     * es lo único que frena.**
     *
     * Con todo leído por `.get()` —el idiom que este archivo prescribe en
     * `esAdmin()`— un `instagram` ausente y un `instagram: null` son
     * indistinguibles para la regla, así que `organizador: { nombre: 'X' }`
     * pasaría todas las cotas. El `hasAll` es lo que lo rechaza, y estos casos
     * son los que lo hacen **mutable**: sin ellos, borrarlo dejaba la suite en
     * verde. `contacto` no está acá a propósito: sus dos claves son obligatorias
     * y las exigen sus propias cotas, así que un `hasAll` ahí no podría fallar.
     */
    it.each([
      ['organizador', { organizador: { nombre: 'Alguien' } }],
      ['arancel', { arancel: { tipo: 'gratis' } }],
      ['inscripcion', { inscripcion: { requiere: false } }],
      // `revision` no está acá: su ausencia la rechaza el centinela
      // `.get(clave, 'x')`, que no es `null`, así que no le hace falta `hasAll`.
      ['revision', { revision: { porUid: null, en: null } }],
    ])('un `%s` con una clave opcional ausente no entra', async (nombre, over) => {
      await rechaza(`falta_${nombre}`, over);
    });

    it('un `contacto` sin `valor` tampoco, y lo frena su propia cota', async () => {
      // Sin `hasAll`: `.get('valor', '')` da `''` y el `size() >= 3` lo rechaza.
      // Es la razón por la que ese mapa no lleva `hasAll` — no tendría qué frenar.
      await rechaza('falta_contacto', { contacto: { via: 'mail' } });
    });

    it.each([
      ['organizador', { organizador: { nombre: 'X', instagram: null, telefono: '+5491100000000' } }],
      ['arancel', { arancel: { tipo: 'gratis', notas: null, moneda: 'ARS' } }],
      ['inscripcion', { inscripcion: { requiere: false, comoDice: null, cupo: 20 } }],
      ['contacto', { contacto: { via: 'mail', valor: 'a@b.cd', valor2: 'otro' } }],
    ])('un `%s` con un campo de más tampoco', async (nombre, over) => {
      // El de `organizador` es el caso concreto: un `telefono` colado en el mapa
      // que la fila de `07-seguridad.md` declara interno.
      await rechaza(`extra_${nombre}`, over);
    });

    it('`incluye` tiene que ser una lista: un string de doce caracteres no es doce cosas', async () => {
      // `string.size()` existe, así que sin el `is list` un `incluye: 'no vengan'`
      // pasaba el tope de 12. `fechas is list` tenía su caso y su gemelo no.
      await rechaza('incluye_string', { incluye: 'no vengan' });
    });

    it('`inscripcion.requiere` tiene que ser un booleano', async () => {
      await rechaza('requiere_string', { inscripcion: { requiere: 'si', comoDice: null } });
      await rechaza('requiere_numero', { inscripcion: { requiere: 1, comoDice: null } });
    });

    /**
     * **`revision.motivo` y `revision.en` en null al crearse**, que solo estaban
     * probados para `porUid` y `actividadId`. El caso concreto: un anónimo
     * escribiendo `motivo: 'ya lo aprobó el equipo'`, que el panel va a mostrar
     * como si lo hubiera escrito un admin.
     */
    it('la revisión no puede nacer con un motivo ni una fecha', async () => {
      const { Timestamp } = await import('firebase/firestore');
      await rechaza('motivo', {
        revision: { porUid: null, en: null, actividadId: null, motivo: 'ya lo aprobaron' },
      });
      await rechaza('revision_en', {
        revision: {
          porUid: null,
          en: Timestamp.fromDate(new Date('2026-09-01T00:00:00Z')),
          actividadId: null,
          motivo: null,
        },
      });
    });

    /**
     * **El `storagePath` acotado a `propuestas/`** (DEC-11), y no es higiene: sin
     * esto, con la puerta abierta un anónimo manda el path del flyer de una
     * actividad **real y publicada** —que no hay que adivinar: viaja adentro de la
     * URL de descarga— y el flujo de rechazo lo **borra**. Lo encontró el
     * `auditor-privacidad`.
     */
    it('un `storagePath` que apunta afuera de `propuestas/` no entra', async () => {
      await rechaza('path_ajeno', { imagen: { storagePath: 'imagenes/img_abc123.jpg' } });
      await rechaza('path_arriba', { imagen: { storagePath: 'propuestas/../imagenes/x.jpg' } });
      await rechaza('path_raro', { imagen: { storagePath: 'propuestas/' } });
    });

    it('y uno del prefijo propio sí', async () => {
      // Control positivo: sin esto, «no entra» podría querer decir que ninguna
      // forma de `storagePath` entra, y el campo sería inútil.
      await setDoc(
        doc(db(), 'propuestas', 'p_path_ok'),
        documento({ imagen: { storagePath: 'propuestas/img_abc123.jpg' } }),
      );
      const d = (await getDoc(doc(db(), 'propuestas', 'p_path_ok'))).data() as Propuesta;
      expect(d.imagen).toEqual({ storagePath: 'propuestas/img_abc123.jpg' });
    });
  });

  describe('lo que hace que la bandeja sirva para algo', () => {
    it('la propuesta no puede nacer aceptada', async () => {
      // Es **el** caso: si el estado lo decidiera el cliente, un `curl` marca su
      // propia propuesta como aceptada y la moderación no existe (§1 del
      // `prd/README.md`).
      await expect(
        setDoc(doc(db(), 'propuestas', 'p_aceptada'), documento({ estado: 'aceptada' })),
      ).rejects.toThrow(RECHAZADA);
      await expect(
        setDoc(doc(db(), 'propuestas', 'p_revision'), documento({ estado: 'en-revision' })),
      ).rejects.toThrow(RECHAZADA);
    });

    it('ni con la revisión ya firmada', async () => {
      await expect(
        setDoc(
          doc(db(), 'propuestas', 'p_firmada'),
          documento({
            revision: { porUid: UID, en: null, actividadId: 'act_1', motivo: null },
          }),
        ),
      ).rejects.toThrow(RECHAZADA);
    });

    it('ni antedatada: `creadoEn` es `request.time`', async () => {
      const { Timestamp } = await import('firebase/firestore');
      await expect(
        setDoc(
          doc(db(), 'propuestas', 'p_antigua'),
          documento({ creadoEn: Timestamp.fromDate(new Date('2020-01-01T00:00:00Z')) }),
        ),
      ).rejects.toThrow(RECHAZADA);
    });

    it('el origen tiene que coincidir con quién escribe', async () => {
      // Un admin no puede hacer pasar su carga por una propuesta del formulario
      // público: es lo que hace que `origen` signifique algo el día que la puerta
      // se abra.
      await expect(
        setDoc(
          doc(db(), 'propuestas', 'p_origen'),
          documento({ origen: 'formulario-publico' }),
        ),
      ).rejects.toThrow(RECHAZADA);
    });
  });

  describe('el único cambio que un admin puede hacer: revisarla', () => {
    beforeAll(async () => {
      await signInWithCustomToken(auth(), await token(UID, true));
      await setDoc(doc(db(), 'propuestas', 'p_rev'), documento());
    });

    it('mueve el estado y firma la revisión', async () => {
      await updateDoc(doc(db(), 'propuestas', 'p_rev'), {
        estado: 'aceptada',
        revision: {
          porUid: UID,
          en: serverTimestamp(),
          actividadId: 'act_nueva',
          motivo: null,
        },
      });
      const d = (await getDoc(doc(db(), 'propuestas', 'p_rev'))).data() as Propuesta;
      expect(d.estado).toBe('aceptada');
      expect(d.revision.actividadId).toBe('act_nueva');
    });

    it('pero NO puede editar el contenido: la propuesta es prueba de qué se pidió', async () => {
      await expect(
        updateDoc(doc(db(), 'propuestas', 'p_rev'), { titulo: 'Otro título' }),
      ).rejects.toThrow(RECHAZADA);
      await expect(
        updateDoc(doc(db(), 'propuestas', 'p_rev'), {
          estado: 'rechazada',
          titulo: 'Otro título',
          revision: { porUid: UID, en: serverTimestamp(), actividadId: null, motivo: 'no' },
        }),
      ).rejects.toThrow(RECHAZADA);
    });

    /**
     * **La cláusula que no tenía quién la ejercite** — la señaló el
     * `auditor-trampas` sobre este mismo commit, y es la misma clase que las dos
     * cláusulas muertas de `imagenValida()`: `hasAny(['estado'])` estaba en la
     * regla y **ningún caso la podía mutar**. Los que pasan traen `estado`, y los
     * que fallan traen además una clave de contenido que ya los tira por el
     * `hasOnly` anterior — así que borrar el `hasAny` dejaba los 33 en verde.
     *
     * Lo que la cláusula impide: re-firmar la revisión **sin mover el estado**.
     * El daño es acotado —solo un admin ya autenticado— pero una regla que no se
     * puede verificar por mutación es exactamente lo que este archivo dice que
     * no quiere.
     */
    it('un update que toca solo `revision`, sin mover el estado, se rechaza', async () => {
      await expect(
        updateDoc(doc(db(), 'propuestas', 'p_rev'), {
          revision: {
            porUid: UID,
            en: serverTimestamp(),
            actividadId: 'act_otra',
            motivo: null,
          },
        }),
      ).rejects.toThrow(RECHAZADA);
    });

    it('ni firmar la revisión a nombre de otro admin', async () => {
      await expect(
        updateDoc(doc(db(), 'propuestas', 'p_rev'), {
          estado: 'rechazada',
          revision: { porUid: UID_OTRO, en: serverTimestamp(), actividadId: null, motivo: 'no' },
        }),
      ).rejects.toThrow(RECHAZADA);
    });

    /**
     * **La `revision` del update con una clave de menos**, que es donde el
     * `hasAll` de `revisionValida()` sí frena y donde el del `create` no hacía
     * falta.
     *
     * La asimetría vale la pena tenerla escrita: en el `create` los cuatro
     * campos se chequean con un default centinela (`.get(k, 'x') == null`), así
     * que la clave ausente ya no pasa; en el `update`, los dos opcionales se
     * chequean con `== null` **contra un default `null`** —porque ahí `null` es
     * un valor legítimo que un admin manda— y entonces sí hace falta declarar la
     * presencia. Verificado por mutación en los dos lados.
     */
    it('la revisión del update tampoco puede venir con claves de menos', async () => {
      await expect(
        updateDoc(doc(db(), 'propuestas', 'p_rev'), {
          estado: 'rechazada',
          revision: { porUid: UID, en: serverTimestamp() },
        }),
      ).rejects.toThrow(RECHAZADA);
    });

    it('ni antedatar la revisión', async () => {
      const { Timestamp } = await import('firebase/firestore');
      await expect(
        updateDoc(doc(db(), 'propuestas', 'p_rev'), {
          estado: 'rechazada',
          revision: {
            porUid: UID,
            en: Timestamp.fromDate(new Date('2020-01-01T00:00:00Z')),
            actividadId: null,
            motivo: 'no',
          },
        }),
      ).rejects.toThrow(RECHAZADA);
    });

    it('borrar está prohibido: rechazar es un estado, no una desaparición', async () => {
      // La borra la Function de retención a los 30 días (DEC-13), con el Admin
      // SDK, que no pasa por estas reglas.
      await expect(deleteDoc(doc(db(), 'propuestas', 'p_rev'))).rejects.toThrow(RECHAZADA);
    });
  });

  describe('quién puede mirar la bandeja', () => {
    it('un anónimo no lee una propuesta: lleva el contacto de quien la cargó', async () => {
      await signOut(auth());
      await expect(getDoc(doc(db(), 'propuestas', 'p_ok'))).rejects.toThrow();
    });

    it('y alguien logueado sin el claim tampoco', async () => {
      await signInWithCustomToken(auth(), await token(UID_PELADO, false));
      await expect(getDoc(doc(db(), 'propuestas', 'p_ok'))).rejects.toThrow();
    });
  });

  /**
   * **El estado de la puerta, afirmado a propósito.**
   *
   * Este `describe` no verifica una regla: verifica **una decisión de
   * secuencia**. El `create` anónimo es el punto entero del PRD y está cerrado
   * hasta que App Check esté exigiendo (B-836a), porque abrirlo antes es
   * publicar un endpoint de escritura a Firestore que nada frena —
   * `propuestaValida()` acota la forma, no el volumen, y cada escritura se
   * factura.
   *
   * El día que se abra, estos dos casos se ponen en rojo y hay que venir a
   * darlos vuelta. Eso es lo que se busca: que abrir la puerta sea un diff
   * visible en un test, igual que `COLECCIONES_ABIERTAS` de
   * `escritura-anonima.integracion.test.ts`.
   */
  describe('el `create` anónimo TODAVÍA está cerrado — B-836a', () => {
    it('un anónimo no puede crear una propuesta, ni con el documento perfecto', async () => {
      await signOut(auth());
      await expect(
        setDoc(doc(db(), 'propuestas', 'p_anon'), {
          ...formAPropuesta(form(), 'formulario-publico'),
          creadoEn: serverTimestamp(),
        }),
      ).rejects.toThrow(RECHAZADA);
    });

    it('y alguien logueado sin el claim tampoco', async () => {
      await signInWithCustomToken(auth(), await token(UID_PELADO, false));
      await expect(
        setDoc(doc(db(), 'propuestas', 'p_anon2'), {
          ...formAPropuesta(form(), 'formulario-publico'),
          creadoEn: serverTimestamp(),
        }),
      ).rejects.toThrow(RECHAZADA);
    });

    /**
     * **La regla tiene que nombrar el testigo que de verdad se pone rojo**, y la
     * primera versión nombraba el que no.
     *
     * El paso 3 de la secuencia decía «`escritura-anonima.integracion.test.ts` se
     * pone rojo — es su trabajo». **No se pone.** Ese archivo prueba las
     * escrituras con un documento sonda (`{ hola: 'mundo' }`), que
     * `propuestaValida()` rechaza por `hasOnly` **con la puerta abierta o
     * cerrada**: es testigo de la **lista** de colecciones, no de esta puerta. El
     * que sí se pone rojo es el caso de acá arriba, «ni con el documento
     * perfecto». Lo encontró el `auditor-privacidad`, y es la misma clase que las
     * cláusulas muertas: una afirmación que se lee como load-bearing y no puede
     * fallar — con el agravante de que era la única barrera que sostenía la
     * decisión de secuencia de B-836a.
     */
    it('la regla nombra el testigo correcto, y dice qué falta para abrirla', () => {
      // Un `esAdmin() &&` sin explicación se lee como una decisión de siempre y
      // se borra sin mirar. El comentario es la mitad que dice el orden.
      const reglas = readFileSync(REGLAS, 'utf8');
      expect(reglas).toContain('allow create: if esAdmin() && propuestaValida();');
      expect(reglas).toContain('App Check');
      expect(reglas).toContain('COLECCIONES_ABIERTAS');
      // Y el testigo que de verdad falla: este archivo.
      expect(reglas, 'la secuencia no nombra el test que se pone rojo').toContain(
        'tests/propuestas.integracion.test.ts',
      );
      expect(
        reglas,
        'la secuencia volvió a decir que `escritura-anonima` se pone rojo solo',
      ).toContain('**no** se pone rojo solo');
    });
  });
});
