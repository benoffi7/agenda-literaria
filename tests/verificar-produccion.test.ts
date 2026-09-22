import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  PLATAFORMAS,
  desdoblarICS,
  esRechazo,
  estadoDeLoPublicado,
  fugasEnICS,
  reglasDeCache,
} from '../scripts/verificar-produccion.mjs';

/**
 * `scripts/verificar-produccion.mjs` — la verificación contra el sistema real,
 * B-116.
 *
 * ── Qué se testea acá y qué no puede testearse ────────────────────────────
 * El script habla con producción, así que **la mitad que hace red no se testea
 * y no debe testearse**: un test que pegue contra el sitio real es un test que
 * falla cuando se cae el wifi, y ese es el chequeo que enseña a saltear los
 * chequeos (B-180). También sería el único test de la suite que necesita
 * internet.
 *
 * Lo que sí se testea es lo que decide, que es donde estaban los bugs de este
 * tipo de chequeo en este repo:
 *
 * 1. **La derivación de las cabeceras** desde `firebase.json`. Es lo que hace que
 *    una regla de cache nueva se verifique sola, y la doc ya había envejecido
 *    exactamente ahí: enumeraba tres rutas y hay cuatro literales.
 * 2. **Que un rechazo se distinga de «no vino nada»**. `07-seguridad.md` lo
 *    advierte con todas las letras —«un `permission-denied` y un "no encontré
 *    nada" se parecen si solo se mira que no haya datos»— y un chequeo que los
 *    confunde reporta «cerrado» sobre una base abierta y vacía.
 * 3. **Que el ICS se desdoble antes de buscar**. Es el falso negativo que
 *    importa: el formato parte las líneas largas, y lo largo de un evento es
 *    justamente la URL de la reunión.
 */
const script = readFileSync(
  fileURLToPath(new URL('../scripts/verificar-produccion.mjs', import.meta.url)),
  'utf8',
);
const firebaseJson = JSON.parse(
  readFileSync(fileURLToPath(new URL('../firebase.json', import.meta.url)), 'utf8'),
);

describe('las cabeceras de cache se derivan de firebase.json — B-116', () => {
  it('saca todas las reglas de `source` literal, y no una lista escrita', () => {
    const reglas = reglasDeCache() as { ruta: string; esperado: string }[];

    // Lo mismo, calculado acá de otra forma: desde el JSON parseado.
    const esperadas = (firebaseJson.hosting?.headers ?? [])
      .filter((h: { source: string }) => !h.source.includes('*'))
      .map((h: { source: string; headers: { key: string; value: string }[] }) => h.source);

    expect(reglas.map((r) => r.ruta)).toEqual(esperadas);
    // Control positivo: si `firebase.json` dejara de declarar cabeceras, la
    // comparación de arriba sería `[] === []` y no probaría nada.
    expect(reglas.length).toBeGreaterThanOrEqual(3);
  });

  it('los comodines quedan afuera, porque no dicen qué URL pedir', () => {
    const reglas = reglasDeCache() as { ruta: string }[];
    expect(reglas.some((r) => r.ruta.includes('*'))).toBe(false);
    // Y hay comodines de verdad en el archivo, si no este caso no prueba nada:
    // `/_astro/**` y `**/*.html` son dos.
    const conComodin = (firebaseJson.hosting?.headers ?? []).filter((h: { source: string }) =>
      h.source.includes('*'),
    );
    expect(conComodin.length).toBeGreaterThan(0);
  });

  it('trae el valor que firebase.json declara, no uno inventado', () => {
    const reglas = reglasDeCache() as { ruta: string; esperado: string }[];
    const version = reglas.find((r) => r.ruta === '/version.json');
    expect(version?.esperado).toBe('no-store, max-age=0');
  });
});

describe('un rechazo de reglas no se confunde con una base vacía — B-116', () => {
  /*
   * La advertencia está escrita en `docs/07-seguridad.md` desde B-208: «si la
   * primera devuelve `{}` en vez del error, no significa que esté cerrada —
   * significa que la colección está vacía o que el `key` no era el de
   * producción. El error tiene que estar **nombrado** en la respuesta».
   *
   * Un chequeo que se equivoque acá reporta «todo cerrado» sobre la fuga que
   * D-128 arregló, que es el peor resultado posible de esta verificación.
   */
  it('reconoce el rechazo por el error nombrado y por el 403', () => {
    expect(esRechazo('{"error":{"message":"Missing or insufficient permissions."}}', 200)).toBe(true);
    expect(esRechazo('PERMISSION_DENIED', 200)).toBe(true);
    expect(esRechazo('cualquier cosa', 403)).toBe(true);
  });

  it('una respuesta vacía NO es un rechazo', () => {
    expect(esRechazo('{}', 200)).toBe(false);
    expect(esRechazo('{"documents":[]}', 200)).toBe(false);
    expect(esRechazo('', 200)).toBe(false);
  });

  it('el bloque de sondas tiene un control positivo', () => {
    /*
     * Sin él, todo el bloque de Firestore pasa con una API key equivocada, con
     * el proyecto mal escrito o sin red: cada sonda daría «rechazo» y se leería
     * como «está todo cerrado». Es la misma lección que B-217 en el gate de
     * build — un chequeo que pasa sin haber mirado nada.
     */
    expect(script).toContain('CONTROL POSITIVO');
    expect(script).toContain("espera: 'permitido'");
  });
});

describe('el ICS se desdobla antes de buscar — B-116', () => {
  /*
   * El falso negativo que importa, y el motivo por el que el comando de la doc
   * usaba python y no un `grep`: el formato ICS pliega las líneas de más de 75
   * octetos con CRLF + un espacio, y lo largo de un evento es la URL.
   *
   * MUTACIÓN PROBADA: sacar el desdoblado hace pasar el segundo caso con la
   * fuga adentro.
   */
  const conFugaPlegada = [
    'BEGIN:VCALENDAR',
    'BEGIN:VEVENT',
    'SUMMARY:Taller de crónica',
    'DESCRIPTION:Nos vemos en https://zoo',
    ' m.us/j/999999 a las 19',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  it('junta las líneas plegadas', () => {
    expect(desdoblarICS(conFugaPlegada)).toContain('https://zoom.us/j/999999');
  });

  it('encuentra el link de reunión partido al medio, que es el caso real', () => {
    // Sin desdoblar, `zoom.us` no aparece: el link está cortado entre `zoo` y
    // `m.us`. Es exactamente cómo un ICS real trae una URL larga.
    expect(conFugaPlegada.includes('zoom.us')).toBe(false);
    expect(fugasEnICS(conFugaPlegada)).toEqual(['zoom.us']);
  });

  it('un calendario limpio no reporta nada', () => {
    const limpio = 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nSUMMARY:Club de lectura\r\nEND:VEVENT\r\nEND:VCALENDAR';
    expect(fugasEnICS(limpio)).toEqual([]);
  });

  it('la lista de plataformas cubre las del modelo', () => {
    // `online.plataforma` es taxonomía autogestionada, así que la lista no se
    // puede derivar: lo que se fija es que estén las que el proyecto nombra en
    // el §5.1 y en la trampa 5.
    for (const p of ['zoom.us', 'meet.google.com']) {
      expect(PLATAFORMAS).toContain(p);
    }
  });
});

describe('el script no toca ninguna credencial — B-116, §5.4', () => {
  it('la URL privada del ICS entra por el entorno y no se imprime nunca', () => {
    expect(script).toContain('process.env.GOOGLE_CALENDAR_ICS_PRIVADO');
    // Lo que no puede pasar: que el valor llegue a la salida. Se busca cualquier
    // interpolación de la variable dentro de un template literal o un console.
    expect(script).not.toMatch(/console\.[a-z]+\([^)]*GOOGLE_CALENDAR_ICS_PRIVADO/);
    expect(script).not.toMatch(/\$\{\s*url\s*\}/);
  });

  it('no lee ningún archivo de secretos ni crea credenciales', () => {
    for (const prohibido of ['service-account', 'private_key', 'auth login', 'secrets create', '.env.local']) {
      expect(script, `el script menciona \`${prohibido}\``).not.toContain(prohibido);
    }
  });

  it('lo que no puede verificar lo informa como saltado, no como verde', () => {
    // La diferencia entre «lo verifiqué» y «no pude» es la mitad del valor de
    // esta verificación: un chequeo saltado que se lee como verde es peor que
    // no tenerlo.
    expect(script).toContain('Un chequeo saltado NO es un chequeo verde');
    expect(script).toContain("saltado(");
  });
});

describe('lo publicado contra `main` — B-1121, la mitad que B-205 dejó escrita', () => {
  /*
   * B-205 proponía dos arreglos y dejó anotado que el segundo «sigue sin
   * existir»: un chequeo que compare lo publicado contra `main` y avise si
   * difieren. La mitad automática —deployar diffeando contra lo publicado— hoy
   * funciona (`commit-base-deploy.sh`, y su bug propio se reparó bajo B-562).
   * Lo que faltaba era la **visibilidad**: que el sitio esté sirviendo un commit
   * viejo no se nota desde ningún lado.
   *
   * La decisión es pura y los hechos de git entran por parámetro, que es lo que
   * la hace testeable sin red y sin un repo de mentira — el mismo movimiento que
   * hicieron `que-deployar.sh` y `emuladores-arriba.sh`.
   */
  const base = {
    sha: 'abc1234',
    version: '1.10.0+abc1234',
    conocido: true,
    ancestro: true,
    adelanto: 0,
  };

  it('al día con main es lo único que cuenta como verde', () => {
    const r = estadoDeLoPublicado(base);
    expect(r.estado).toBe('ok');
    expect(r.detalle).toContain('abc1234');
  });

  it('sin sha limpio se SALTEA, que no es lo mismo que estar bien', () => {
    /*
     * Un build sucio o sin git no corresponde a ningún commit, así que no hay
     * contra qué comparar. Decir «ok» ahí sería afirmar que está al día sin
     * haberlo mirado, que es la mitad del valor de este script (su encabezado:
     * «un chequeo saltado NO es un chequeo verde»).
     */
    const r = estadoDeLoPublicado({
      ...base,
      sha: null,
      version: '1.10.0+abc1234-sucio.2609221200',
      conocido: false,
      ancestro: false,
    });
    expect(r.estado).toBe('saltado');
    expect(r.detalle).toContain('no hay contra qué comparar');
  });

  it('un sha que este clon no tiene falla, y dice por qué', () => {
    // Clon superficial, o —lo que importa— un deploy hecho desde un checkout
    // que nadie más tiene.
    const r = estadoDeLoPublicado({ ...base, conocido: false, ancestro: false });
    expect(r.estado).toBe('mal');
    expect(r.detalle).toContain('no está en este repo');
  });

  it('publicar algo que main no tiene falla: es un deploy desde una rama', () => {
    const r = estadoDeLoPublicado({ ...base, ancestro: false });
    expect(r.estado).toBe('mal');
    expect(r.detalle).toContain('no es ancestro de main');
  });

  it('main adelante falla, y el detalle distingue las dos lecturas', () => {
    /*
     * Es la decisión discutible de este chequeo y por eso tiene caso propio:
     * corrido DESPUÉS de deployar, «main tiene commits sin publicar» es
     * exactamente B-205 —el deploy no llegó—; corrido a mitad de la tarde es lo
     * aburrido y esperable. El script no puede saber cuál de las dos es, así
     * que **lo dice** en vez de elegir por su cuenta: avisar de más es mejor que
     * leer «todo bien» mientras el sitio sirve lo de anteayer.
     */
    const r = estadoDeLoPublicado({ ...base, adelanto: 49 });
    expect(r.estado).toBe('mal');
    expect(r.detalle).toContain('49 commit(s)');
    expect(r.detalle).toContain('B-205');
    expect(r.detalle).toContain('todavía no deployaste');
  });

  it('el orden de los casos importa: un sha desconocido no se reporta como atrasado', () => {
    // Si `conocido` se evaluara después de `adelanto`, un sha que no está en el
    // repo saldría como «main tiene 0 commits por encima», o sea verde.
    const r = estadoDeLoPublicado({ ...base, conocido: false, ancestro: false, adelanto: 0 });
    expect(r.estado).toBe('mal');
    expect(r.detalle).not.toContain('al día');
  });
});
