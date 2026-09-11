/**
 * Reglas y escritura de `/librerias/{id}` contra el emulador — B-831, PRD 2.
 *
 * ── Por qué este archivo es el que importa de esta tajada ─────────────────
 * `/librerias` es la **segunda** colección que va a aceptar una escritura
 * anónima, y `formaDeLibreria()` es lo único que va a acotar un documento que
 * escribe alguien sin login. El schema de zod no cuenta: se saltea con un
 * `curl`. Así que cada tope, cada enum y cada `null` de la regla tiene su caso
 * acá, y se prueban **contra el emulador** porque un `grep` al archivo pasaría
 * con la regla escrita mal (`'Publicado'`, `!=`, el campo renombrado) — el
 * argumento de B-218.
 *
 * ── Y por qué hay tantos controles POSITIVOS ──────────────────────────────
 * Porque una denegación es lo que devuelve también un emulador que no está, una
 * base sin reglas o un `projectId` equivocado. **B-894 fue exactamente eso**: el
 * emulador de CI corría en otro proyecto que los tests, y el desajuste apagó
 * *solo* lo que las reglas otorgan — todo lo que niegan siguió en verde. Cada
 * `describe` de acá abre o cierra con el caso que tiene que **funcionar**.
 *
 * ── El `create` anónimo todavía está cerrado, y los casos lo dicen ────────
 * Lo bloquea **B-872** (App Check sin exigir en Storage), no la falta de código.
 * Mientras tanto la regla es `esAdmin() && libreriaValida()`, así que la
 * validación se ejercita por el camino del admin —que es la tercera puerta del
 * § 1 del PRD y no un andamio— y el `describe` del final fija el estado de la
 * puerta y nombra qué hay que hacer para abrirla.
 *
 * Las reglas que se verifican son las de **este** checkout: se empujan por la
 * API del emulador en el `beforeAll` (B-174).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { initializeApp as initAdmin, deleteApp as deleteAdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import type { Firestore as FirestoreAdmin } from 'firebase-admin/firestore';
import { signInWithCustomToken, signOut } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { auth } from '@/lib/firebase-client';
import { db } from '@/lib/firestore-client';
import { formALibreria, libreriaVacia } from '@/lib/libreria-schema';
import type { Libreria, LibreriaForm } from '@/types/libreria';
import {
  PROJECT_ID,
  cargarReglas,
  emuladorAuthVivo,
  emuladorVivo,
  limpiarFirestore,
} from './emulador';

const vivo = (await emuladorVivo()) && (await emuladorAuthVivo());
const REGLAS = fileURLToPath(new URL('../firestore.rules', import.meta.url));

const UID = 'uid_librerias_admin';
const UID_OTRO = 'uid_librerias_admin_2';
const UID_PELADO = 'uid_librerias_sin_claim';
const UID_PUBLICADOR = 'uid_librerias_publicador';

const token = async (uid: string, claims: Record<string, boolean>) => {
  const app = initAdmin({ projectId: PROJECT_ID }, `l-${uid}-${Date.now()}`);
  const a = getAdminAuth(app);
  try {
    await a.createUser({ uid });
  } catch {
    /* ya existía */
  }
  await a.setCustomUserClaims(uid, claims);
  // Los dos caminos, como el resto de los archivos de integración: el registro
  // (que es lo que hace producción) y el custom token. B-894 es el motivo por el
  // que esto importa.
  const t = await a.createCustomToken(uid, claims);
  await deleteAdminApp(app);
  return t;
};

/** El Admin SDK, para sembrar lo que ningún cliente puede escribir. */
const conAdminSdk = async (fn: (db: FirestoreAdmin) => Promise<void>) => {
  const app = initAdmin({ projectId: PROJECT_ID }, `l-sdk-${Date.now()}-${Math.random()}`);
  await fn(getAdminFirestore(app));
  await deleteAdminApp(app);
};

const form = (over: Partial<LibreriaForm> = {}): LibreriaForm => ({
  ...libreriaVacia(),
  nombre: 'Librería Del Otro Lado',
  descripcion: 'Librería de barrio con mesa de novedades y club de lectura los martes.',
  direccion: 'Thames 1762',
  barrio: 'villa-crespo',
  instagram: '@delotrolado',
  whatsapp: '+54 9 11 2222-3333',
  web: 'delotrolado.test',
  mail: 'hola@delotrolado.test',
  contactoDeQuienCargo: { via: 'mail', valor: 'quien.cargo@delotrolado.test' },
  ...over,
});

/**
 * El documento tal como lo va a mandar el cliente, para poder deformarlo campo
 * por campo. `origen: 'panel'` porque el `create` de hoy es del admin, y la
 * regla exige que el origen coincida con quién escribe.
 */
const documento = (over: Record<string, unknown> = {}, f: LibreriaForm = form()) => ({
  ...formALibreria(f, 'panel'),
  creadoEn: serverTimestamp(),
  ...over,
});

const RECHAZADA = /permission|insufficient/i;

/**
 * Una lectura denegada **por permisos**, no por cualquier cosa.
 *
 * Un `rejects.toThrow()` pelado lo satisface un emulador caído, y el mensaje de
 * una lectura denegada no es «insufficient permissions» sino la traza de
 * evaluación — el `code`, en cambio, sí es `permission-denied` siempre.
 */
const rechazadaPorPermisos = async (lectura: Promise<unknown>, que: string) => {
  let error: unknown;
  try {
    await lectura;
  } catch (e) {
    error = e;
  }
  expect(error, `${que}: NO se rechazó`).toBeDefined();
  expect((error as { code?: string }).code, `${que}: se rechazó, pero no por permisos`).toBe(
    'permission-denied',
  );
};

describe.skipIf(!vivo)('librerías contra el emulador — B-831', () => {
  beforeAll(async () => {
    await limpiarFirestore();
    // B-174 / B-219 — las reglas de este checkout, sobre la base de este
    // working-tree, que arranca sin ninguna.
    await cargarReglas(REGLAS);
    await signInWithCustomToken(auth(), await token(UID, { admin: true }));
  }, 30_000);

  describe('el camino que hoy funciona: un admin carga una librería', () => {
    it('crea una ficha válida y la puede leer', async () => {
      await setDoc(doc(db(), 'librerias', 'l_ok'), documento());
      const snap = await getDoc(doc(db(), 'librerias', 'l_ok'));
      expect(snap.exists()).toBe(true);
      const d = snap.data() as Libreria;
      expect(d.nombre).toBe('Librería Del Otro Lado');
      // El slug sale derivado del nombre, y es el que va a estar en la URL para
      // siempre (trampa 10).
      expect(d.slug).toBe('libreria-del-otro-lado');
      // El estado y la revisión nacen como la regla exige, y salen del armado
      // puro: si `formALibreria` los pusiera mal, esto no se escribiría.
      expect(d.estado).toBe('pendiente');
      expect(d.revision).toEqual({ porUid: null, en: null, motivo: null });
      // Los cuatro contactos públicos se guardan **normalizados**, que es lo que
      // la ficha va a publicar: el handle sin arroba y el teléfono sin signos.
      expect(d.instagram).toBe('delotrolado');
      expect(d.whatsapp).toBe('5491122223333');
      expect(d.web).toBe('https://delotrolado.test/');
    });

    it('acepta los opcionales en null, que es lo que una regla mal escrita rechaza de más', async () => {
      // Una librería sin descripción, sin redes y cargada por un admin (o sea sin
      // nadie a quien repreguntarle) es una ficha perfectamente válida.
      await setDoc(
        doc(db(), 'librerias', 'l_nulls'),
        documento(
          {},
          form({
            descripcion: '',
            instagram: '',
            whatsapp: '',
            web: '',
            mail: '',
            contactoDeQuienCargo: { via: 'mail', valor: '' },
          }),
        ),
      );
      const d = (await getDoc(doc(db(), 'librerias', 'l_nulls'))).data() as Libreria;
      expect(d.descripcion).toBeNull();
      expect(d.instagram).toBeNull();
      expect(d.whatsapp).toBeNull();
      expect(d.web).toBeNull();
      expect(d.mail).toBeNull();
      expect(d.contactoDeQuienCargo).toBeNull();
      expect(d.geo).toBeNull();
    });

    it('acepta la geo y las cuatro imágenes, que son los topes', async () => {
      await setDoc(
        doc(db(), 'librerias', 'l_topes'),
        documento(
          {},
          form({
            geo: { lat: '-34.5983', lng: '-58.4375' },
            imagenes: Array.from({ length: 4 }, (_, i) => ({
              id: `img_${i}`,
              url: `https://x.test/${i}.jpg`,
              epigrafe: '',
              origen: 'externa' as const,
              portada: i === 0,
            })),
          }),
        ),
      );
      const d = (await getDoc(doc(db(), 'librerias', 'l_topes'))).data() as Libreria;
      expect(d.geo).toEqual({ lat: -34.5983, lng: -58.4375 });
      expect(d.imagenes).toHaveLength(4);
    });
  });

  describe('la forma: lo que `formaDeLibreria()` rechaza', () => {
    const rechaza = async (que: string, over: Record<string, unknown>) => {
      await expect(
        setDoc(doc(db(), 'librerias', `l_no_${que}`), documento(over)),
        que,
      ).rejects.toThrow(RECHAZADA);
    };

    it('un campo de más no entra', async () => {
      // `hasOnly` — es lo que impide que alguien invente un campo y lo guarde.
      await rechaza('extra', { notaInterna: 'no publicar' });
    });

    it('un campo de menos tampoco, incluidos los que pueden ser null', async () => {
      // Los siete nullables se leen con `.get(clave, null)`, así que ausente y
      // `null` son indistinguibles: el `hasAll` es lo único que los exige, y
      // estos casos son los que lo hacen mutable.
      for (const campo of ['nombre', 'web', 'geo', 'contactoDeQuienCargo', 'searchText']) {
        const d = documento() as Record<string, unknown>;
        delete d[campo];
        await expect(
          setDoc(doc(db(), 'librerias', `l_falta_${campo}`), d),
          `sin ${campo}`,
        ).rejects.toThrow(RECHAZADA);
      }
    });

    it('el nombre fuera de 2–80', async () => {
      await rechaza('nombre_corto', { nombre: 'x' });
      await rechaza('nombre_largo', { nombre: 'x'.repeat(81) });
    });

    it('un slug vacío, con mayúsculas o con espacios — trampa 10', async () => {
      // El slug **es** la URL pública: lo que no sea el alfabeto de `slugify` no
      // puede entrar, porque después queda congelado.
      await rechaza('slug_vacio', { slug: '' });
      await rechaza('slug_mayus', { slug: 'Libreria-Del-Otro-Lado' });
      await rechaza('slug_espacio', { slug: 'libreria del otro lado' });
      await rechaza('slug_guion', { slug: '-libreria-' });
      await rechaza('slug_largo', { slug: `a${'-b'.repeat(60)}` });
    });

    it('una descripción de más de 1000', async () => {
      await rechaza('desc_larga', { descripcion: 'x'.repeat(1001) });
    });

    it('la dirección fuera de 4–160', async () => {
      await rechaza('dir_corta', { direccion: 'abc' });
      await rechaza('dir_larga', { direccion: 'x'.repeat(161) });
    });

    it('un barrio que no es un slug de `/opciones/barrio`', async () => {
      // §4.2 — con otro alfabeto, el hub de barrio no cruza la librería con las
      // actividades de ahí, que es el § 2 entero del PRD.
      await rechaza('barrio_vacio', { barrio: '' });
      await rechaza('barrio_mayus', { barrio: 'Villa Crespo' });
      await rechaza('barrio_acento', { barrio: 'núñez' });
    });

    it('una ciudad vacía o larguísima', async () => {
      await rechaza('ciudad_vacia', { ciudad: '' });
      await rechaza('ciudad_larga', { ciudad: 'x'.repeat(81) });
    });

    it('las imágenes que no son una lista, o son cinco', async () => {
      const imagen = (i: number) => ({
        id: `img_${i}`,
        url: `https://x.test/${i}.jpg`,
        epigrafe: '',
        origen: 'externa',
        portada: i === 0,
      });
      await rechaza('imagenes_string', { imagenes: 'una foto' });
      await rechaza('imagenes_cinco', { imagenes: Array.from({ length: 5 }, (_, i) => imagen(i)) });
    });

    it('una geo rota: clave de más, valor que no es número, o fuera de rango', async () => {
      await rechaza('geo_extra', { geo: { lat: -34.6, lng: -58.4, alt: 25 } });
      await rechaza('geo_parcial', { geo: { lat: -34.6 } });
      await rechaza('geo_string', { geo: { lat: '-34.6', lng: '-58.4' } });
      // Los cuatro bordes, y no solo dos: con `lat: 200` sola, el piso (`>= -90`)
      // no tiene quién lo mute y se lee como load-bearing sin poder fallar.
      await rechaza('geo_lat_alta', { geo: { lat: 200, lng: -58.4 } });
      await rechaza('geo_lat_baja', { geo: { lat: -200, lng: -58.4 } });
      await rechaza('geo_lng_alta', { geo: { lat: -34.6, lng: 200 } });
      await rechaza('geo_lng_baja', { geo: { lat: -34.6, lng: -200 } });
    });

    it('un Instagram que no es un handle: la barra manda a otra cuenta', async () => {
      await rechaza('ig_barra', { instagram: 'delotrolado/otra' });
      await rechaza('ig_arroba', { instagram: '@delotrolado' });
      await rechaza('ig_largo', { instagram: 'x'.repeat(31) });
    });

    it('un WhatsApp que no son 8–15 dígitos: de ahí sale un `wa.me`', async () => {
      await rechaza('wa_signos', { whatsapp: '+54 9 11 2222-3333' });
      await rechaza('wa_corto', { whatsapp: '1122' });
      await rechaza('wa_largo', { whatsapp: '1'.repeat(16) });
    });

    it('una web sin esquema, o con uno que no es http(s)', async () => {
      // `javascript:` en un `href` de una página **indexada**. Sin esta cláusula
      // la defensa la estaría poniendo el consumidor y no el dato.
      await rechaza('web_js', { web: 'javascript:alert(1)' });
      await rechaza('web_data', { web: 'data:text/html,<script>x</script>' });
      await rechaza('web_pelada', { web: 'delotrolado.test' });
      await rechaza('web_larga', { web: `https://x.test/${'a'.repeat(500)}` });
    });

    it('un mail demasiado corto o demasiado largo', async () => {
      await rechaza('mail_corto', { mail: 'a' });
      await rechaza('mail_largo', { mail: `${'x'.repeat(200)}@t.test` });
    });

    it('un `contactoDeQuienCargo` con una vía inventada, un campo de más o un valor corto', async () => {
      await rechaza('cqc_via', { contactoDeQuienCargo: { via: 'telepatia', valor: 'a@b.cd' } });
      await rechaza('cqc_extra', {
        contactoDeQuienCargo: { via: 'mail', valor: 'a@b.cd', nombre: 'Ana' },
      });
      await rechaza('cqc_corto', { contactoDeQuienCargo: { via: 'mail', valor: 'a' } });
      await rechaza('cqc_largo', {
        contactoDeQuienCargo: { via: 'mail', valor: 'x'.repeat(201) },
      });
    });

    it('un estado o un origen que no son del vocabulario', async () => {
      // `'borrador'` y `'cancelado'` son los de una **actividad**: es el error
      // más probable de quien escriba el cliente mirando el otro modelo.
      await rechaza('estado_borrador', { estado: 'borrador' });
      await rechaza('origen_raro', { origen: 'importado' });
    });

    it('un `searchText` de más de 2000: es un campo derivado que nadie mira', async () => {
      await rechaza('search_largo', { searchText: 'x'.repeat(2001) });
    });

    it('una revisión con una clave de más, o de menos', async () => {
      await rechaza('rev_extra', {
        revision: { porUid: null, en: null, motivo: null, actividadId: null },
      });
      await rechaza('rev_falta', { revision: { porUid: null, en: null } });
    });
  });

  describe('lo que hace que la bandeja sirva para algo', () => {
    it('la ficha no puede nacer publicada ni descartada', async () => {
      // Es **el** caso: si el estado lo decidiera el cliente, un `curl` publica
      // su propia librería y la moderación no existe (§1 del `prd/README.md`).
      await expect(
        setDoc(doc(db(), 'librerias', 'l_publicada'), documento({ estado: 'publicado' })),
      ).rejects.toThrow(RECHAZADA);
      await expect(
        setDoc(doc(db(), 'librerias', 'l_rechazada'), documento({ estado: 'rechazado' })),
      ).rejects.toThrow(RECHAZADA);
    });

    /**
     * **Los tres campos de la revisión, uno por uno**, y no los tres juntos en un
     * caso: con un documento que trae los tres mal, cualquiera de las tres
     * cláusulas lo rechaza y las otras dos se vuelven inmutables — se leen como
     * load-bearing y borrarlas deja la suite en verde. Lo delató la verificación
     * por mutación.
     */
    it.each([
      ['porUid', { porUid: UID, en: null, motivo: null }],
      ['motivo', { porUid: null, en: null, motivo: 'ya lo revisaron' }],
    ])('ni con la revisión ya firmada: `%s`', async (campo, revision) => {
      await expect(
        setDoc(doc(db(), 'librerias', `l_firmada_${campo}`), documento({ revision })),
        campo,
      ).rejects.toThrow(RECHAZADA);
    });

    it('ni con la fecha de revisión puesta', async () => {
      const { Timestamp } = await import('firebase/firestore');
      await expect(
        setDoc(
          doc(db(), 'librerias', 'l_firmada_en'),
          documento({
            revision: {
              porUid: null,
              en: Timestamp.fromDate(new Date('2026-09-01T00:00:00Z')),
              motivo: null,
            },
          }),
        ),
      ).rejects.toThrow(RECHAZADA);
    });

    it('ni antedatada: `creadoEn` es `request.time`', async () => {
      const { Timestamp } = await import('firebase/firestore');
      await expect(
        setDoc(
          doc(db(), 'librerias', 'l_antigua'),
          documento({ creadoEn: Timestamp.fromDate(new Date('2020-01-01T00:00:00Z')) }),
        ),
      ).rejects.toThrow(RECHAZADA);
    });

    it('ni marcada como que ya estuvo publicada: nacería con el slug congelado', async () => {
      // Trampa 10 al revés: la marca la escribe un trigger, y una ficha que nace
      // con ella nace con el candado del lado de afuera.
      await expect(
        setDoc(doc(db(), 'librerias', 'l_marcada'), documento({ publicadaAlgunaVez: true })),
      ).rejects.toThrow(RECHAZADA);
    });

    it('el origen tiene que coincidir con quién escribe', async () => {
      // Un admin no puede hacer pasar su carga por una ficha del formulario
      // público: es lo que hace que `origen` signifique algo el día que la puerta
      // se abra.
      await expect(
        setDoc(doc(db(), 'librerias', 'l_origen'), documento({ origen: 'formulario-publico' })),
      ).rejects.toThrow(RECHAZADA);
    });
  });

  describe('lo que un admin SÍ puede cambiarle: es una ficha de catálogo, no una propuesta', () => {
    beforeAll(async () => {
      await signInWithCustomToken(auth(), await token(UID, { admin: true }));
      await setDoc(doc(db(), 'librerias', 'l_edit'), documento());
    });

    it('corrige el contenido y mueve el estado, firmando la revisión', async () => {
      // Control positivo, y es el que B-894 apagaba: completar y corregir una
      // ficha **es** el trabajo de la bandeja (§ 5 del PRD), al revés que una
      // propuesta, que queda como prueba de qué se pidió.
      const corregida = formALibreria(
        form({ nombre: 'Librería del Otro Lado', direccion: 'Thames 1762, PB' }),
        'panel',
      );
      await updateDoc(doc(db(), 'librerias', 'l_edit'), {
        ...corregida,
        estado: 'publicado',
        revision: { porUid: UID, en: serverTimestamp(), motivo: null },
      });
      const d = (await getDoc(doc(db(), 'librerias', 'l_edit'))).data() as Libreria;
      expect(d.direccion).toBe('Thames 1762, PB');
      expect(d.estado).toBe('publicado');
      expect(d.revision.porUid).toBe(UID);
    });

    it('pero NO puede cambiarle la dirección web una vez publicada — trampa 10', async () => {
      // La ficha quedó `publicado` en el caso anterior. Cambiar el slug ahora es
      // un 404 sin aviso y el SEO perdido.
      await expect(
        updateDoc(doc(db(), 'librerias', 'l_edit'), { slug: 'del-otro-lado' }),
      ).rejects.toThrow(RECHAZADA);
    });

    it('y sí puede mientras espera decisión, que es el trabajo de la bandeja', async () => {
      // Control positivo del caso anterior: sin esto, «no se puede cambiar»
      // podría querer decir que el slug no se puede tocar nunca, y corregirle la
      // dirección al nombre que llegó mal escrito es justamente para lo que está
      // la bandeja.
      await setDoc(doc(db(), 'librerias', 'l_slug'), documento());
      await updateDoc(doc(db(), 'librerias', 'l_slug'), { slug: 'del-otro-lado' });
      const d = (await getDoc(doc(db(), 'librerias', 'l_slug'))).data() as Libreria;
      expect(d.slug).toBe('del-otro-lado');
    });

    /**
     * **El vocabulario de estados, en el `update`** — que es el único lugar donde
     * esa cláusula puede fallar: en el `create` el estado ya está forzado a
     * `'pendiente'`, así que sin este caso el `in [...]` se leía como
     * load-bearing y borrarlo dejaba la suite en verde.
     *
     * Lo que impide es concreto: un estado inventado rompe el
     * `where('estado','==','publicado')` del build —la ficha no se publica y
     * nadie se entera— y deja la bandeja mostrando una fila que ningún botón
     * puede mover.
     */
    it('ni ponerle un estado que no es del vocabulario del motor', async () => {
      await expect(
        updateDoc(doc(db(), 'librerias', 'l_slug'), {
          estado: 'cancelado',
          revision: { porUid: UID, en: serverTimestamp(), motivo: null },
        }),
      ).rejects.toThrow(RECHAZADA);
      await expect(
        updateDoc(doc(db(), 'librerias', 'l_slug'), {
          estado: 'borrador',
          revision: { porUid: UID, en: serverTimestamp(), motivo: null },
        }),
      ).rejects.toThrow(RECHAZADA);
    });

    it('ni cambiar de cuándo es la ficha ni por dónde entró', async () => {
      const { Timestamp } = await import('firebase/firestore');
      await expect(
        updateDoc(doc(db(), 'librerias', 'l_slug'), { origen: 'formulario-publico' }),
      ).rejects.toThrow(RECHAZADA);
      await expect(
        updateDoc(doc(db(), 'librerias', 'l_slug'), {
          creadoEn: Timestamp.fromDate(new Date('2020-01-01T00:00:00Z')),
        }),
      ).rejects.toThrow(RECHAZADA);
    });

    it('ni firmar la revisión a nombre de otro admin, ni antedatarla', async () => {
      const { Timestamp } = await import('firebase/firestore');
      await expect(
        updateDoc(doc(db(), 'librerias', 'l_slug'), {
          estado: 'rechazado',
          revision: { porUid: UID_OTRO, en: serverTimestamp(), motivo: 'no' },
        }),
      ).rejects.toThrow(RECHAZADA);
      await expect(
        updateDoc(doc(db(), 'librerias', 'l_slug'), {
          estado: 'rechazado',
          revision: {
            porUid: UID,
            en: Timestamp.fromDate(new Date('2020-01-01T00:00:00Z')),
            motivo: 'no',
          },
        }),
      ).rejects.toThrow(RECHAZADA);
    });

    /**
     * **La revisión del update con una clave de menos**, que es donde el `hasAll`
     * de `formaDeLibreria()` frena de verdad.
     *
     * En el `create` no hace falta —los tres campos se chequean contra un
     * centinela que no es `null`, así que la clave ausente ya no pasa—; en el
     * `update`, `motivo` se chequea con `== null` **contra un default `null`**,
     * porque ahí `null` es un valor legítimo que un admin manda. Sin este caso el
     * `hasAll` era inmutable: borrarlo dejaba la suite en verde, y el documento
     * podía quedar sin la clave que el tipo declara.
     */
    it('la revisión del update tampoco puede venir con claves de menos', async () => {
      await expect(
        updateDoc(doc(db(), 'librerias', 'l_slug'), {
          estado: 'rechazado',
          revision: { porUid: UID, en: serverTimestamp() },
        }),
      ).rejects.toThrow(RECHAZADA);
    });

    it('y puede corregir un typo sin refirmar la revisión', async () => {
      // Control positivo de la cláusula condicionada: la firma se exige **solo
      // si `revision` está en el diff**. Exigirla siempre obligaría a refirmar en
      // cada corrección, y entonces la firma dejaría de significar «quién la
      // revisó».
      await updateDoc(doc(db(), 'librerias', 'l_slug'), { direccion: 'Thames 1764' });
      const d = (await getDoc(doc(db(), 'librerias', 'l_slug'))).data() as Libreria;
      expect(d.direccion).toBe('Thames 1764');
      expect(d.revision.porUid).toBeNull();
    });

    /**
     * **La arista que le falta al grafo de `TRANSICIONES`**, y es toda la razón
     * por la que ese grafo existe: publicar de un saque lo que ya se descartó
     * mete al sitio una ficha **sin que nadie la haya vuelto a leer**.
     */
    it('no puede publicar de un saque una ficha descartada', async () => {
      await setDoc(doc(db(), 'librerias', 'l_desc'), documento());
      await updateDoc(doc(db(), 'librerias', 'l_desc'), {
        estado: 'rechazado',
        revision: { porUid: UID, en: serverTimestamp(), motivo: 'ya cerró' },
      });
      await expect(
        updateDoc(doc(db(), 'librerias', 'l_desc'), {
          estado: 'publicado',
          revision: { porUid: UID, en: serverTimestamp(), motivo: null },
        }),
      ).rejects.toThrow(RECHAZADA);
    });

    it('pero sí reabrirla y publicarla desde ahí: dos clicks y un estado en el medio', async () => {
      // Control positivo del anterior: si «no se puede» valiera para las dos
      // aristas, una ficha descartada por error quedaría muerta para siempre.
      await updateDoc(doc(db(), 'librerias', 'l_desc'), {
        estado: 'pendiente',
        revision: { porUid: UID, en: serverTimestamp(), motivo: null },
      });
      await updateDoc(doc(db(), 'librerias', 'l_desc'), {
        estado: 'publicado',
        revision: { porUid: UID, en: serverTimestamp(), motivo: null },
      });
      const d = (await getDoc(doc(db(), 'librerias', 'l_desc'))).data() as Libreria;
      expect(d.estado).toBe('publicado');
    });

    /**
     * **La marca de la trampa 10 no la mueve un cliente** — la escribe un trigger
     * con el Admin SDK, que no pasa por estas reglas.
     *
     * Se siembra con el Admin SDK porque ningún cliente la puede crear (el
     * `create` la exige en `false`), que es justamente la propiedad que se está
     * verificando.
     */
    it('no puede bajar la marca de «estuvo publicada», ni con la ficha en pendiente', async () => {
      await conAdminSdk(async (adm) => {
        await adm.doc('librerias/l_marca').set({
          ...formALibreria(form(), 'panel'),
          creadoEn: new Date(),
          publicadaAlgunaVez: true,
        });
      });
      // Con la marca puesta el slug está congelado aunque el estado sea
      // `pendiente`: es la puerta de atrás del candado (publicar, despublicar,
      // renombrar) y esto es lo que la cierra.
      await expect(
        updateDoc(doc(db(), 'librerias', 'l_marca'), { slug: 'otra-direccion' }),
      ).rejects.toThrow(RECHAZADA);
      await expect(
        updateDoc(doc(db(), 'librerias', 'l_marca'), { publicadaAlgunaVez: false }),
      ).rejects.toThrow(RECHAZADA);
      // Y con la marca puesta el resto se sigue pudiendo editar: lo que se
      // congela es la dirección web, no la ficha.
      await updateDoc(doc(db(), 'librerias', 'l_marca'), { direccion: 'Thames 1766' });
      const d = (await getDoc(doc(db(), 'librerias', 'l_marca'))).data() as Libreria;
      expect(d.direccion).toBe('Thames 1766');
      expect(d.publicadaAlgunaVez).toBe(true);
    });

    it('borrar sí lo puede un admin: es lo único con lo que hoy se honra un «borrame»', async () => {
      // Al revés que `/propuestas`, donde lo borra la Function de retención
      // (DEC-13). Acá esa Function todavía no existe, así que una ficha
      // descartada conserva el contacto de quien la cargó para siempre.
      await setDoc(doc(db(), 'librerias', 'l_borrar'), documento());
      await deleteDoc(doc(db(), 'librerias', 'l_borrar'));
      expect((await getDoc(doc(db(), 'librerias', 'l_borrar'))).exists()).toBe(false);
    });
  });

  /**
   * **`get` y `list` son dos permisos distintos, y se prueban por separado.**
   *
   * `read` incluye `list` (trampa 13): un `list` abierto no entrega un
   * documento, entrega el directorio entero de una sentada —las pendientes, las
   * descartadas y todos los contactos internos— y un id impredecible no protege
   * nada si te dan la lista.
   */
  describe('quién puede mirar el directorio', () => {
    it('un admin lee por id y lista: sin esto, el panel no existe', async () => {
      // El control positivo va **primero**: todo lo que sigue es una denegación,
      // y una denegación la devuelve también un emulador mal apuntado (B-894).
      await signInWithCustomToken(auth(), await token(UID, { admin: true }));
      expect((await getDoc(doc(db(), 'librerias', 'l_ok'))).exists()).toBe(true);
      expect((await getDocs(collection(db(), 'librerias'))).empty).toBe(false);
    });

    it('un anónimo no lee una ficha por id: lleva el contacto de quien la cargó', async () => {
      await signOut(auth());
      await rechazadaPorPermisos(getDoc(doc(db(), 'librerias', 'l_ok')), 'get anónimo');
    });

    it('ni lista la colección — trampa 13', async () => {
      await rechazadaPorPermisos(getDocs(collection(db(), 'librerias')), 'list anónimo');
    });

    it('y alguien logueado sin claim tampoco, ni por id ni listando', async () => {
      // «No está logueado» no es la defensa: cualquiera puede crear una cuenta
      // con la API key web, que es pública por diseño. La defensa es el claim.
      await signInWithCustomToken(auth(), await token(UID_PELADO, {}));
      await rechazadaPorPermisos(getDoc(doc(db(), 'librerias', 'l_ok')), 'get sin claim');
      await rechazadaPorPermisos(getDocs(collection(db(), 'librerias')), 'list sin claim');
    });

    /**
     * **El publicador no tiene nada acá, y es una decisión escrita** (B-888).
     *
     * El rol contesta «¿de quién es este documento?», y una librería no tiene
     * dueño del panel: es la ficha de un tercero, con su contacto adentro, y
     * decidir qué entra al catálogo es justamente la autoridad que este rol no
     * tiene.
     */
    it('un publicador tampoco: ni lee, ni lista, ni escribe', async () => {
      await signInWithCustomToken(auth(), await token(UID_PUBLICADOR, { publicador: true }));
      await rechazadaPorPermisos(getDoc(doc(db(), 'librerias', 'l_ok')), 'get publicador');
      await rechazadaPorPermisos(getDocs(collection(db(), 'librerias')), 'list publicador');
      await expect(
        setDoc(doc(db(), 'librerias', 'l_pub'), documento({ origen: 'formulario-publico' })),
      ).rejects.toThrow(RECHAZADA);
      await expect(
        updateDoc(doc(db(), 'librerias', 'l_ok'), { direccion: 'Otra 123' }),
      ).rejects.toThrow(RECHAZADA);
      await expect(deleteDoc(doc(db(), 'librerias', 'l_ok'))).rejects.toThrow(RECHAZADA);
    });

    it('y su sesión está viva, que es lo que hace que lo de arriba signifique algo', async () => {
      // El control positivo del caso anterior: `/opciones/{campo}` es
      // `allow read: if true` (§4.4). Si esto fallara, las cinco denegaciones de
      // arriba estarían midiendo una sesión rota y no una regla — que es
      // exactamente lo que pasó en B-894.
      await expect(getDoc(doc(db(), 'opciones', 'barrio'))).resolves.toBeDefined();
    });
  });

  /**
   * **El estado de la puerta, afirmado a propósito.**
   *
   * Este `describe` no verifica una regla: verifica **una decisión de
   * secuencia**. El `create` anónimo es el punto del PRD y está cerrado hasta que
   * **B-872** esté contestado y App Check exija también en Storage — porque el
   * formulario de una librería sube una foto, y abrir Firestore sin Storage da un
   * formulario que acepta el texto y rechaza la imagen, mientras que abrir los
   * dos sin enforcement publica un endpoint de subida anónimo.
   *
   * El día que se abra, estos dos casos se ponen en rojo y hay que venir a darlos
   * vuelta. Eso es lo que se busca: que abrir la puerta sea un diff visible en un
   * test.
   */
  describe('el `create` anónimo TODAVÍA está cerrado — B-872', () => {
    it('un anónimo no puede crear una librería, ni con el documento perfecto', async () => {
      await signOut(auth());
      await expect(
        setDoc(doc(db(), 'librerias', 'l_anon'), {
          ...formALibreria(form(), 'formulario-publico'),
          creadoEn: serverTimestamp(),
        }),
      ).rejects.toThrow(RECHAZADA);
    });

    it('y alguien logueado sin el claim tampoco', async () => {
      await signInWithCustomToken(auth(), await token(UID_PELADO, {}));
      await expect(
        setDoc(doc(db(), 'librerias', 'l_anon2'), {
          ...formALibreria(form(), 'formulario-publico'),
          creadoEn: serverTimestamp(),
        }),
      ).rejects.toThrow(RECHAZADA);
    });

    /**
     * **La regla tiene que nombrar el testigo que de verdad se pone rojo.** Es la
     * lección que `/propuestas` pagó: su secuencia decía que
     * `escritura-anonima.integracion.test.ts` se ponía rojo solo, y **no se
     * pone** — ese archivo prueba con un documento sonda que `hasOnly` rechaza
     * con la puerta abierta o cerrada, así que es testigo de la **lista** de
     * colecciones, no de esta puerta.
     */
    it('la regla nombra el testigo correcto, el bloqueo y el orden para abrirla', () => {
      const reglas = readFileSync(REGLAS, 'utf8');
      expect(reglas).toContain('allow create: if esAdmin() && libreriaValida();');
      // Qué falta, y no es lo mismo que bloqueaba a `/propuestas`.
      expect(reglas, 'la regla no nombra el bloqueo real').toContain('B-872');
      expect(reglas).toContain('App Check');
      // Storage va en el mismo commit: el formulario sube una foto.
      expect(reglas, 'la secuencia no nombra el prefijo de Storage').toContain('storage.rules');
      expect(reglas).toContain('COLECCIONES_ABIERTAS');
      // Y el testigo que de verdad falla: este archivo.
      expect(reglas, 'la secuencia no nombra el test que se pone rojo').toContain(
        'tests/librerias.integracion.test.ts',
      );
      expect(
        reglas,
        'la secuencia volvió a decir que `escritura-anonima` se pone rojo solo',
      ).toContain('NO se pone rojo solo');
    });
  });
});
