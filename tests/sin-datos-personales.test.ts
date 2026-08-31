import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Red contra un error que ya pasó: `docs/02-infraestructura.md` tenía una tabla
 * titulada «Cuentas con claim `admin`» con los dos mails y los dos uids reales,
 * mapeados uno contra otro, y este repo es **público**. Los mismos dos valores
 * estaban además como centinelas en `tests/fixtures/formulario.ts` — o sea, el
 * dato que no puede salir vivía en el archivo que verifica que no sale.
 *
 * El §5.1 y D-57 son explícitos: uid y mail de admin no salen ni crudos ni
 * hasheados. Un uid no es una credencial, pero es la mitad del trabajo de un
 * ataque dirigido, y publicarlo en un repo público es irreversible: para cuando
 * alguien lo nota, ya está scrapeado.
 *
 * Esto es un chequeo de forma, no de contenido: no sabe cuáles son los uids
 * reales (no puede saberlo sin volver a versionarlos, que es el bug). Busca la
 * **forma** de un uid de Firebase y de un mail, y exige que todo lo que
 * aparezca sea reconociblemente inventado.
 */

/**
 * Un uid de Firebase son 28 caracteres alfanuméricos. El patrón pide mezcla de
 * mayúsculas, minúsculas y dígitos: sin eso, cualquier hash hexadecimal de 28
 * caracteres, un `sha1` truncado o una tirada de guiones bajos entraría como
 * falso positivo. Los uids de verdad los genera Firebase con las tres clases.
 */
const FORMA_DE_UID = /\b(?=[A-Za-z0-9]{28}\b)(?=[A-Za-z0-9]*[a-z])(?=[A-Za-z0-9]*[A-Z])(?=[A-Za-z0-9]*[0-9])[A-Za-z0-9]{28}\b/g;

const FORMA_DE_MAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

/**
 * Un uid inventado se declara con el prefijo, no con el largo: así este test
 * puede seguir exigiendo los 28 caracteres —que es lo que hace que el fixture
 * ejercite la forma real— sin confundirlo con uno de verdad.
 */
const UID_DECLARADO_FALSO = /^(CENTINELA|EJEMPLO|FALSO|uid_)/;

/**
 * Proveedores de correo gratuitos. Una casilla en cualquiera de estos dominios
 * es, por construcción, la de una persona: no hay forma de que un
 * `@gmail.com` versionado sea una identidad de máquina.
 *
 * ── Lo que este test NO cubre, y por qué ──────────────────────────────
 * Un mail en un dominio propio (`hola@casabrandon.example`) puede ser tanto un
 * fixture inventado —el repo tiene varios— como el mail real de una sede. Este
 * test no puede distinguirlos sin una lista de dominios reales, que sería
 * exactamente el dato que no queremos versionar. Así que no lo intenta: esa
 * mitad queda en el `auditor-privacidad`, que sí puede leer el contexto.
 *
 * Preferir un chequeo angosto que nunca da falsos positivos antes que uno ancho
 * que se apaga con excepciones es deliberado: la tabla que hizo nacer este test
 * sobrevivió meses en un archivo que nadie sospechaba, y un test que la gente
 * aprende a ignorar no la habría encontrado tampoco.
 */
const PROVEEDORES_PERSONALES = [
  'gmail.com',
  'googlemail.com',
  'hotmail.com',
  'hotmail.com.ar',
  'outlook.com',
  'live.com',
  'msn.com',
  'yahoo.com',
  'yahoo.com.ar',
  'icloud.com',
  'me.com',
  'proton.me',
  'protonmail.com',
  'aol.com',
  'fibertel.com.ar',
  'speedy.com.ar',
];

/**
 * Excepciones, cada una con su motivo. La lista es explícita a propósito: una
 * excepción por patrón («ignorar todo `docs/`») convertiría este test en
 * decorativo, que es lo que pasó con la tabla que lo hizo nacer.
 */
const PERMITIDOS = new Set<string>([
  // La casilla de contacto del proyecto (`src/lib/enlaces.ts`), que el sitio
  // publica para que le sugieran actividades o le reporten errores. Es un gmail,
  // pero **no es la casilla de una persona**: publicarla es el objetivo, no la
  // fuga. B-228.
  //
  // Que sea esta dirección y no el dominio es el punto: si mañana aparece otro
  // `@gmail.com` versionado, este test tiene que volver a fallar. Y ya sirvió
  // para eso dos veces: primero frenó la casilla al versionarla, y después —cuando
  // resultó que la dirección cargada no era la del proyecto, corregida el
  // 2026-08-31— **volvió a fallar sobre el rastro que quedaba en el CHANGELOG**.
  // La equivocada no se anota acá ni allá: se sacó del repo en vez de habilitarse.
  //
  // Que la excepción sea **una dirección** y no un dominio es lo que hizo posible
  // las dos cosas. Con `@gmail.com` permitido, ni el primer caso ni el segundo
  // habrían dicho nada.
  'agendaleh@gmail.com',
]);

const archivosVersionados = (): string[] =>
  execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
    .split('\0')
    .filter(Boolean)
    .filter((f) => !/\.(png|jpe?g|gif|webp|ico|woff2?|pdf)$/i.test(f))
    .filter((f) => f !== 'package-lock.json' && f !== 'functions/package-lock.json');

/** En qué línea cae la primera aparición, para que el error sea navegable. */
const linea = (contenido: string, aguja: string): number =>
  contenido.slice(0, contenido.indexOf(aguja)).split('\n').length;

describe('ningún archivo versionado publica un dato personal — el repo es público', () => {
  const archivos = archivosVersionados().filter(
    // Este archivo lleva los patrones como dato.
    (f) => !f.endsWith('sin-datos-personales.test.ts'),
  );

  /*
   * Control positivo. Los dos `it` de abajo afirman que una lista está vacía, y
   * una lista vacía también es lo que devuelve un `git ls-files` que no
   * encontró nada, un filtro demasiado ancho o una regex que no compila como se
   * cree. Sin esto, los dos darían verde sin haber leído un solo archivo.
   */
  it('el barrido lee el árbol de verdad', () => {
    expect(archivos.length).toBeGreaterThan(50);
    expect(archivos).toContain('docs/02-infraestructura.md');

    // Y las dos formas encuentran lo que dicen encontrar.
    expect('CENTINELAuid0000000000000000'.match(FORMA_DE_UID)).toHaveLength(1);
    expect('hola@ejemplo.com'.match(FORMA_DE_MAIL)).toHaveLength(1);
    // Un hash hexadecimal de 28 no es un uid: si esto empieza a fallar, la
    // regex se ensanchó y el test va a llenarse de falsos positivos.
    expect('a3f9b2c1d4e5f60718293a4b5c6d'.match(FORMA_DE_UID)).toBeNull();

    /*
     * Y la FORMA que tenían los dos valores versionados —mezcla de mayúsculas,
     * minúsculas y dígitos, sin prefijo declarado— con un valor sintético: el
     * uid real no vuelve a entrar a un archivo versionado ni como caso de
     * prueba, que sería reintroducir la fuga para demostrar que la detectamos.
     *
     * Si mañana alguien afloja `FORMA_DE_UID` o `PROVEEDORES_PERSONALES`, esto
     * rompe antes que el barrido — que para entonces ya estaría en verde por el
     * motivo equivocado.
     */
    expect('aB3dEfGhIjKlMnOpQrStUvWxYz01'.match(FORMA_DE_UID)).toHaveLength(1);
    expect(UID_DECLARADO_FALSO.test('aB3dEfGhIjKlMnOpQrStUvWxYz01')).toBe(false);
    expect(PROVEEDORES_PERSONALES).toContain('gmail.com');
  });

  it('no hay uids de Firebase, salvo los declarados falsos', () => {
    const encontrados: string[] = [];

    for (const archivo of archivos) {
      let contenido: string;
      try {
        contenido = readFileSync(archivo, 'utf8');
      } catch {
        continue;
      }
      for (const uid of contenido.match(FORMA_DE_UID) ?? []) {
        if (UID_DECLARADO_FALSO.test(uid)) continue;
        encontrados.push(`${archivo}:${linea(contenido, uid)} — ${uid.slice(0, 6)}…`);
      }
    }

    expect(encontrados).toEqual([]);
  });

  it('no hay casillas de correo personales', () => {
    const encontrados = new Set<string>();

    for (const archivo of archivos) {
      let contenido: string;
      try {
        contenido = readFileSync(archivo, 'utf8');
      } catch {
        continue;
      }
      for (const mail of contenido.match(FORMA_DE_MAIL) ?? []) {
        if (PERMITIDOS.has(mail.toLowerCase())) continue;
        const dominio = mail.split('@')[1]?.toLowerCase() ?? '';
        if (!PROVEEDORES_PERSONALES.includes(dominio)) continue;
        encontrados.add(`${archivo}:${linea(contenido, mail)} — ${dominio}`);
      }
    }

    expect([...encontrados]).toEqual([]);
  });
});
