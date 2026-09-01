import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { initializeApp as initAdmin, deleteApp as deleteAdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { signInWithCustomToken } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth } from '@/lib/firebase-client';
// `db` sale de firestore-client desde el corte del bundle (B-09).
import { db } from '@/lib/firestore-client';
import { huellaCreador } from '@/lib/huella';
import {
  OPCIONES_BASE,
  estaAprobada,
  borrarOpcion,
  leerOpciones,
  opcionesVisibles,
  pintarOpcion,
  renombrarOpcion,
  upsertOpcion,
  upsertOpciones,
} from '@/lib/opciones';
import type { ValorOpcion } from '@/types/actividad';
import { HOST_FIRESTORE, emuladorVivo, limpiarFirestore } from './emulador';

/** El uid que crea las opciones en estos tests (el usuario logueado más abajo). */
const UID = 'uid_test_admin';
/** La otra cuenta con claim admin (§4.3): no debería ver lo pendiente de UID. */
const UID_OTRO = 'uid_test_admin_2';

const vivo = await emuladorVivo();

/** Loguea al panel con el claim `admin`, como lo haría scripts/set-admin-claim.mjs. */
const entrarComoAdmin = async (uid: string) => {
  const adminApp = initAdmin({ projectId: 'agenda-literaria' }, `test-${Date.now()}`);
  const adminAuth = getAdminAuth(adminApp);
  try {
    await adminAuth.createUser({ uid, email: `${uid}@test.local` });
  } catch {
    /* ya existía */
  }
  await adminAuth.setCustomUserClaims(uid, { admin: true });
  const token = await adminAuth.createCustomToken(uid, { admin: true });
  await deleteAdminApp(adminApp);
  await signInWithCustomToken(auth(), token);
};

/** Siembra las base, como hace scripts/seed-emulador.mjs. */
const sembrarBase = async () => {
  for (const [campo, valores] of Object.entries(OPCIONES_BASE)) {
    await setDoc(doc(db(), 'opciones', campo), { valores });
  }
};

/** Los valores tal como quedaron en el documento, sin ordenar ni filtrar. */
const valoresCrudos = async (campo: string): Promise<ValorOpcion[]> => {
  const snap = await getDoc(doc(db(), 'opciones', campo));
  return (snap.data()?.valores ?? []) as ValorOpcion[];
};

/**
 * Tests contra el emulador. Verifican lo que `slugify` solo no puede: que la
 * transacción de §4.2 realmente reuse en vez de duplicar, y que las reglas de
 * §5.3 bloqueen la escritura sin el claim `admin`.
 *
 * Se saltean si los emuladores no están corriendo (`npm run emu`).
 */
describe.skipIf(!vivo)('taxonomías contra el emulador — §4.2', () => {
  beforeAll(async () => {
    await limpiarFirestore();
    await entrarComoAdmin(UID);
    await sembrarBase();
  }, 30_000);

  it('reusa la opción existente en lugar de duplicarla', async () => {
    const antes = await leerOpciones('arancel');

    // Las cuatro variantes del §4.2 que arruinaban el desplegable.
    for (const v of ['A la gorra', 'a la gorra ', 'A la Gorra', '  A LA GORRA  ']) {
      const slug = await upsertOpcion('arancel', v, UID);
      expect(slug).toBe('a-la-gorra');
    }

    const despues = await leerOpciones('arancel');
    expect(despues).toHaveLength(antes.length);
    expect(despues.filter((v) => v.slug === 'a-la-gorra')).toHaveLength(1);
  });

  it('incrementa `usos` cada vez que se reusa', async () => {
    const inicial = (await leerOpciones('arancel')).find((v) => v.slug === 'gratis')!.usos;
    await upsertOpcion('arancel', 'Gratis', UID);
    await upsertOpcion('arancel', 'gratis', UID);
    const final = (await leerOpciones('arancel')).find((v) => v.slug === 'gratis')!.usos;
    expect(final).toBe(inicial + 2);
  });

  it('incorpora una etiqueta nueva al desplegable, no fija', async () => {
    await upsertOpcion('arancel', 'Con beca parcial', UID);
    const valores = await leerOpciones('arancel');
    const nueva = valores.find((v) => v.slug === 'con-beca-parcial');
    expect(nueva).toMatchObject({ label: 'Con beca parcial', fijo: false, usos: 1 });
  });

  it('las opciones fijas van primero y las nuevas se ordenan por uso', async () => {
    await upsertOpciones('barrio', ['Villa Crespo', 'Boedo', 'Villa Crespo', 'Villa Crespo'], UID);
    const valores = await leerOpciones('barrio');
    expect(valores.map((v) => v.slug)).toEqual(['villa-crespo', 'boedo']);
  });

  it('crea el documento del campo si no existía', async () => {
    await limpiarFirestore();
    const slug = await upsertOpcion('plataforma', 'Discord', UID);
    expect(slug).toBe('discord');
    const snap = await getDoc(doc(db(), 'opciones', 'plataforma'));
    expect(snap.exists()).toBe(true);
    // Sembró también las base junto con la nueva.
    const slugs = (snap.data()!.valores as { slug: string }[]).map((v) => v.slug);
    expect(slugs).toContain('zoom');
    expect(slugs).toContain('discord');
  });

  it('rechaza una etiqueta que se normaliza a vacío', async () => {
    await expect(upsertOpcion('barrio', '¡!¿?', UID)).rejects.toThrow();
  });
});

/**
 * §4.3 — aprobación de opciones. Ahora hay dos cuentas con claim `admin`
 * cargando actividades, así que una etiqueta nueva no puede aparecer en el
 * desplegable de la otra persona antes de que alguien la valide.
 *
 * La aprobación se ejecuta corriendo el script de verdad
 * (`scripts/aprobar-opciones.mjs`) contra el emulador: es la única forma de
 * saber que el camino que se va a usar en producción funciona, no solo que la
 * intención estaba bien (§ "verificar contra el sistema real" de 05-patrones).
 */
describe.skipIf(!vivo)('aprobación de taxonomías — §4.3', () => {
  /**
   * Pone una opción en el estado "pendiente" a mano.
   *
   * Desde B-131 nada nace pendiente, así que la maquinaria de aprobación
   * —`estaAprobada`, `opcionesVisibles`, el script, la pantalla de taxonomías—
   * no tiene forma de recibir un caso de prueba del camino normal. Se sigue
   * verificando entera con el estado que produciría el default invertido: es lo
   * que garantiza que funcione el día que se prenda de nuevo, y también cubre
   * las opciones que quedaron pendientes en producción **antes** de B-131.
   */
  const volverPendiente = async (campo: string, slug: string) => {
    const valores = await valoresCrudos(campo);
    await setDoc(doc(db(), 'opciones', campo), {
      valores: valores.map((v) => (v.slug === slug ? { ...v, aprobada: false } : v)),
    });
  };

  const correrScript = (...args: string[]) =>
    execFileSync('node', ['scripts/aprobar-opciones.mjs', ...args], {
      cwd: fileURLToPath(new URL('..', import.meta.url)),
      env: { ...process.env, FIRESTORE_EMULATOR_HOST: HOST_FIRESTORE },
      encoding: 'utf8',
    });

  beforeAll(async () => {
    await limpiarFirestore();
    await entrarComoAdmin(UID);
    await sembrarBase();
  }, 30_000);

  /**
   * B-131 — el default se dio vuelta por decisión del dueño: una etiqueta
   * nueva queda disponible para las dos cuentas enseguida. La huella del autor
   * se sigue guardando (es el rastro de quién la creó, y lo que hace falta el
   * día que la aprobación se vuelva a prender).
   */
  it('una opción creada con "Otro" nace aprobada y con la huella de su autor', async () => {
    await upsertOpcion('arancel', 'Con beca parcial', UID);
    const nueva = (await valoresCrudos('arancel')).find((v) => v.slug === 'con-beca-parcial')!;
    expect(nueva.aprobada).toBe(true);
    expect(nueva.huellaCreador).toBe(huellaCreador(UID));
    // §5.1 — este documento es de lectura pública: el uid no puede estar ahí.
    expect(JSON.stringify(nueva)).not.toContain(UID);
  });

  it('una pendiente funciona para quien la creó y no aparece en el desplegable de la otra cuenta', async () => {
    await volverPendiente('arancel', 'con-beca-parcial');
    const valores = await leerOpciones('arancel');
    expect(opcionesVisibles(valores, UID).map((v) => v.slug)).toContain('con-beca-parcial');
    expect(opcionesVisibles(valores, UID_OTRO).map((v) => v.slug)).not.toContain(
      'con-beca-parcial',
    );
    // Tampoco en el events.json, que se genera sin usuario (§4.4).
    expect(opcionesVisibles(valores).map((v) => v.slug)).not.toContain('con-beca-parcial');
  });

  it('registrar el uso de una opción base no la vuelve pendiente ni le pone autor', async () => {
    await upsertOpcion('arancel', 'Gratis', UID);
    const gratis = (await valoresCrudos('arancel')).find((v) => v.slug === 'gratis')!;
    expect(gratis.aprobada).toBe(true);
    expect(gratis.huellaCreador).toBeUndefined();
    expect(gratis.usos).toBe(1);
  });

  it('el script la aprueba', () => {
    expect(correrScript('arancel', 'con-beca-parcial')).toContain(
      'aprobada -> arancel/con-beca-parcial',
    );
  });

  it('aprobada, la ve la otra cuenta y el sitio público, sin perder usos ni autor', async () => {
    const valores = await leerOpciones('arancel');
    const aprobada = valores.find((v) => v.slug === 'con-beca-parcial')!;
    expect(estaAprobada(aprobada)).toBe(true);
    expect(aprobada.usos).toBe(1);
    expect(aprobada.huellaCreador).toBe(huellaCreador(UID));
    expect(opcionesVisibles(valores, UID_OTRO).map((v) => v.slug)).toContain('con-beca-parcial');
    expect(opcionesVisibles(valores).map((v) => v.slug)).toContain('con-beca-parcial');
  });

  it('aprobar dos veces no rompe nada: el script es idempotente', () => {
    expect(correrScript('arancel', 'con-beca-parcial')).toContain('ya estaba aprobada');
  });

  it('rechaza un slug que no existe, sin tocar el resto del array', async () => {
    expect(() => correrScript('arancel', 'no-existe')).toThrow();
    expect((await valoresCrudos('arancel')).map((v) => v.slug)).not.toContain('no-existe');
  });

  it('--listar muestra las pendientes y solo esas', async () => {
    await upsertOpciones('tags', ['Narrativa'], UID);
    await volverPendiente('tags', 'narrativa');
    const salida = correrScript('--listar');
    expect(salida).toContain('opciones/tags');
    expect(salida).toContain('narrativa');
    // Ya aprobada: no puede seguir apareciendo como pendiente.
    expect(salida).not.toContain('con-beca-parcial');
  });

  /*
   * ── El color del tipo de actividad (D-150) ──────────────────────────────
   *
   * Lo que solo se puede ver contra el emulador: que la transacción de
   * `pintarOpcion` escriba el matiz en una opción **base**, que sacarlo borre la
   * clave en vez de guardar un `null`, y —sobre todo— que la llave `tocaFijas`
   * no se haya derramado a renombrar y borrar, que siguen prohibidas.
   */
  it('elige el color de una opción base, que es el único caso que existe hoy', async () => {
    /*
     * Los siete tipos de `/opciones/tipo` son `fijo: true`, así que si
     * `pintarOpcion` respetara la guarda del §4.3 no se podría elegir el color de
     * **ninguno de los que hay**. Lo que `fijo` protege es la identidad —el slug
     * cableado, la etiqueta con la que se reconoce—, y el matiz no es identidad.
     *
     * MUTACIÓN PROBADA: sacarle `{ tocaFijas: true }` a `pintarOpcion` hace fallar
     * este caso con «es una opción base».
     */
    const antes = (await valoresCrudos('tipo')).find((v) => v.slug === 'taller')!;
    expect(antes.fijo, 'el fixture dejó de tener a «taller» como base').toBe(true);
    expect(antes.tono).toBeUndefined();

    await pintarOpcion('tipo', 'taller', 290);

    const despues = (await valoresCrudos('tipo')).find((v) => v.slug === 'taller')!;
    expect(despues.tono).toBe(290);
    // Y no tocó nada más de la opción: el matiz es presentación, no identidad.
    expect(despues).toMatchObject({ slug: 'taller', label: antes.label, fijo: true, usos: antes.usos });
  });

  it('«Automático» borra la clave en vez de guardar un `null`', async () => {
    /*
     * Ausente es «derivado del slug», que es el default de lectura. Un `null`
     * guardado sería un tercer estado que significa lo mismo, y `tonoDeTipo` lo
     * trataría igual solo porque su guarda lo rechaza — o sea, funcionaría por
     * accidente.
     *
     * MUTACIÓN PROBADA: guardar `{ ...v, tono: null }` deja la clave presente y
     * hace fallar el `toBe(false)` de abajo.
     */
    await pintarOpcion('tipo', 'taller', 195);
    expect((await valoresCrudos('tipo')).find((v) => v.slug === 'taller')!.tono).toBe(195);

    await pintarOpcion('tipo', 'taller', null);

    const despues = (await valoresCrudos('tipo')).find((v) => v.slug === 'taller')!;
    expect(Object.prototype.hasOwnProperty.call(despues, 'tono')).toBe(false);
  });

  it('un matiz que no es un matiz no se escribe: falla antes de la transacción', async () => {
    await pintarOpcion('tipo', 'charla', 250);
    for (const malo of [999, -1, 12.5]) {
      await expect(pintarOpcion('tipo', 'charla', malo)).rejects.toThrow('entero de 0 a 359');
    }
    // Y el valor que estaba quedó intacto: no se escribió a medias.
    expect((await valoresCrudos('tipo')).find((v) => v.slug === 'charla')!.tono).toBe(250);
  });

  it('el color solo se puede elegir en la lista que el sitio pinta', async () => {
    /*
     * Lo encontró el `auditor-privacidad`. Sin esta guarda se podía guardar el
     * matiz de un barrio o de una etiqueta, y `opcionPublica` lo publicaría: el
     * `events.json` llevaría un dato que **ninguna salida consume**, que es la
     * definición de publicar sin decidir. La pantalla ya ofrecía el color solo
     * para `tipo`; esto es lo que lo vuelve una regla y no una casualidad de la UI.
     *
     * MUTACIÓN PROBADA: sacar la guarda de `campo !== CAMPO_CON_COLOR` hace fallar
     * este caso, y el barrio queda con `tono` guardado.
     */
    for (const campo of ['arancel', 'barrio', 'plataforma', 'tags'] as const) {
      await expect(pintarOpcion(campo, 'gratis', 195)).rejects.toThrow('solo se elige');
    }
    expect((await valoresCrudos('arancel')).some((v) => 'tono' in v)).toBe(false);
  });

  it('la llave de las opciones base no se derramó: renombrar y borrar siguen prohibidos', async () => {
    /*
     * El control que hace que `tocaFijas` sea una llave y no una puerta abierta.
     * Sin esto, el parámetro nuevo podría ir quedando en `true` por default —o
     * pasarse «por las dudas» desde otro llamador— y la guarda del §4.3 se
     * apagaría sin que nada lo diga.
     *
     * MUTACIÓN PROBADA: poner `tocaFijas = true` como default de `editarValor`
     * hace fallar los dos asertos.
     */
    await expect(renombrarOpcion('tipo', 'taller', 'Tallercito')).rejects.toThrow('opción base');
    await expect(borrarOpcion('tipo', 'taller')).rejects.toThrow('opción base');
    // Y la opción quedó como estaba.
    expect((await valoresCrudos('tipo')).find((v) => v.slug === 'taller')!.label).toBe('Taller');
  });

  /**
   * El caso de producción: los documentos de `/opciones/*` que ya están
   * cargados no tienen el campo `aprobada`. No pueden desaparecer del
   * desplegable de nadie por eso.
   */
  it('las opciones que ya estaban cargadas sin el campo siguen visibles para todos', async () => {
    await setDoc(doc(db(), 'opciones', 'barrio'), {
      valores: [
        // Exactamente la forma que tienen hoy en producción: sin `aprobada`.
        { slug: 'villa-crespo', label: 'Villa Crespo', orden: 99, fijo: false, usos: 4 },
      ],
    });
    const valores = await leerOpciones('barrio');
    expect(valores[0]!.aprobada).toBeUndefined();
    expect(opcionesVisibles(valores, UID_OTRO).map((v) => v.slug)).toEqual(['villa-crespo']);
    expect(opcionesVisibles(valores).map((v) => v.slug)).toEqual(['villa-crespo']);
  });

  it('--backfill hace explícito ese default sin cambiar la visibilidad', async () => {
    expect(correrScript('--backfill')).toContain('opciones/barrio');
    const valores = await valoresCrudos('barrio');
    expect(valores.find((v) => v.slug === 'villa-crespo')!.aprobada).toBe(true);
    expect(opcionesVisibles(valores, UID_OTRO).map((v) => v.slug)).toEqual(['villa-crespo']);
    // Y no despierta lo que está pendiente a propósito.
    expect((await valoresCrudos('tags')).find((v) => v.slug === 'narrativa')!.aprobada).toBe(
      false,
    );
  });
});
