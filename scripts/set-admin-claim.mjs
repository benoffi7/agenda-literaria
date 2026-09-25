#!/usr/bin/env node
/**
 * §5.3 — setea el custom claim del rol con el Admin SDK. Sin un claim, las
 * reglas de Firestore rechazan toda escritura.
 *
 *   npm run admin:claim -- <uid|email>                 → admin (ve y toca todo)
 *   npm run admin:claim -- --publicador <uid|email>    → publicador general (B-888):
 *                                                        carga en cualquier ciudad
 *                                                        y ve solo lo suyo (B-921)
 *   npm run admin:claim -- --publicador --ciudad "Mar del Plata" <uid|email>
 *                                                      → publicador de una ciudad:
 *                                                        carga solo ahí (B-921) y
 *                                                        ve lo de ahí (B-919)
 *   npm run admin:claim -- --quitar <uid|email>        → sin claims
 *   npm run admin:claim -- --ver <uid|email>           → SOLO LEE: rol y ciudad (B-2051)
 *
 * Contra los emuladores exportá antes:
 *   export FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
 *
 * ── Por qué los roles no se pueden acumular, y no depende de este script ──
 * B-888. `setCustomUserClaims` **reemplaza el objeto entero**, nunca lo fusiona:
 * darle `publicador` a una cuenta que era admin le saca el `admin` en la misma
 * llamada, que es lo que hace que «bajar de rango» sea una operación y no dos.
 * Por eso acá se escribe siempre el objeto completo del rol elegido y nunca un
 * `{ ...previos, … }`.
 *
 * Las reglas no se confían de eso igual: `esAdmin()` exige además **no** ser
 * publicador, así que un token con los dos claims —que solo saldría de tocar la
 * consola a mano— cae del lado acotado. Las dos mitades hacen falta: ésta hace
 * que el estado raro no se pueda crear desde acá, y aquélla decide qué pasa si
 * igual existe.
 *
 * El nombre del archivo quedó de cuando había un solo rol. No se renombra: lo
 * nombran `docs/08-operacion.md`, `package.json` y `tests/guardas-de-los-scripts.test.ts`.
 */
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
/*
 * **B-919 — el `slugify` del proyecto, importado y no copiado.**
 *
 * La regla compara `request.auth.token.ciudad` contra `resource.data.ciudades`,
 * que `formADocumento` escribe con **este mismo** `slugify`. Si el script y el
 * documento normalizaran distinto —una `ñ`, un acento, un guión— el permiso no
 * matchearía y **nadie entendería por qué**: el panel no diría «no tenés
 * permiso», diría «no hay actividades de tu ciudad». Es la clase de B-88 (la
 * misma pregunta contestada por dos funciones) con el peor síntoma posible.
 *
 * Por eso se importa la implementación de `functions/slugify.js` y no la fachada
 * `.ts`: node no corre TypeScript, y una copia acá es exactamente lo que no puede
 * existir.
 */
import { slugify } from '../functions/slugify.js';
import { describirClaims } from './describir-claims.mjs';

const argumentos = process.argv.slice(2);

/**
 * **`--ver`: el único modo que no escribe** — B-2051.
 *
 * La consola de Firebase no muestra los custom claims, y el runbook de
 * `ciudades-no-coinciden` (`docs/08-operacion.md`) pide comparar la ciudad de
 * una cuenta contra lo que cargó. Hasta acá la única forma de saberla era
 * acordarse del comando con que se le dio.
 *
 * ── Por qué no pide nada más para mirar producción ────────────────────────
 * El entorno lo sigue eligiendo el comando, igual que para escribir
 * (`admin:claim` → emulador, `admin:claim:prod` → producción): leer no pide un
 * permiso aparte porque no hay nada que proteger de un error de destino —mirar
 * la cuenta equivocada no cambia nada—. Lo que se protege es lo contrario: que
 * `--ver` **no pueda escribir**. Por eso se rechaza junto con cualquier flag de
 * rol (un `--ver --publicador` es un comando que quería otra cosa, y el
 * default de este script es `admin`) y sale del script **antes** de la rama
 * que llama a `setCustomUserClaims`. `tests/claim-ver.integracion.test.ts` lo
 * verifica contra el emulador: los claims de la cuenta quedan byte por byte.
 */
const ver = argumentos.includes('--ver');
if (ver) {
  const choca = argumentos.filter((a) => ['--publicador', '--quitar', '--ciudad', '--todos'].includes(a));
  if (choca.length > 0) {
    console.error(
      `--ver solo lee y no se combina con ${choca.join(' ')}: ` +
        'para cambiar el rol, corré el comando sin --ver.',
    );
    process.exit(1);
  }
}

/**
 * El rol sale de un flag y **el default es `admin`**, que es lo que este comando
 * hacía antes de que hubiera roles: no cambiar lo que ya está en los dedos del
 * dueño es más importante que la simetría.
 */
const ROLES = {
  '--publicador': { nombre: 'publicador', claims: { publicador: true } },
  '--quitar': { nombre: 'sin rol', claims: {} },
};
const flag = argumentos.find((a) => a in ROLES);
const rol = ROLES[flag] ?? { nombre: 'admin', claims: { admin: true } };

/**
 * **El alcance por ciudad** — B-919, D-690. `--ciudad "Mar del Plata"`.
 *
 * Se slugifica con el `slugify` del proyecto (ver el import) porque es lo que la
 * regla va a comparar contra `ciudades`, que el documento escribe con esa misma
 * función.
 *
 * ── Tres decisiones ───────────────────────────────────────────────────────
 *  - **Solo para `--publicador`.** Un admin ve todo el catálogo, así que una
 *    ciudad en su claim no significaría nada y quedaría como un dato que alguien
 *    lee mañana y cree que restringe algo. Se rechaza en vez de ignorarse: el
 *    comando que la pasó quería otra cosa.
 *  - **Una ciudad que no deja slug se rechaza.** `--ciudad "¿?"` da `''`, y un
 *    claim con ciudad vacía es exactamente el estado que la regla tiene que
 *    tapar con su tercera cláusula. Que el script no pueda producirlo es la otra
 *    mitad del mismo reparto que ya tienen los roles: acá no se crea el estado
 *    raro, y allá se decide qué pasa si igual existe.
 *  - **Sin `--ciudad`, el publicador queda sin alcance**, o sea exactamente como
 *    antes de B-919: ve lo suyo y nada más. Es el default que preserva lo
 *    anterior (§«Un campo nuevo se lee con el default que preserva lo anterior»).
 *    Desde B-921 es además el **publicador general**: la ciudad del claim es
 *    también **dónde puede cargar** (`dentroDeSuCiudad()` en `firestore.rules`,
 *    D-1150), y sin ciudad carga en cualquiera. «General» es dónde carga, no qué
 *    ve: no lee lo ajeno de ninguna ciudad (D-1152).
 */
const iCiudad = argumentos.indexOf('--ciudad');
const ciudadCruda = iCiudad >= 0 ? argumentos[iCiudad + 1] : undefined;
if (iCiudad >= 0) {
  if (flag !== '--publicador') {
    console.error('--ciudad solo tiene sentido con --publicador: un admin ve todo el catálogo.');
    process.exit(1);
  }
  if (!ciudadCruda || ciudadCruda.startsWith('--')) {
    console.error('--ciudad necesita un nombre: --ciudad "Mar del Plata".');
    process.exit(1);
  }
  const slug = slugify(ciudadCruda);
  if (!slug) {
    console.error(`«${ciudadCruda}» no deja ningún nombre usable de ciudad. Abortando.`);
    process.exit(1);
  }
  rol.claims.ciudad = slug;
  rol.nombre = `publicador de ${slug} (carga solo ahí)`;
} else if (flag === '--publicador') {
  // B-921 — se anuncia, porque olvidarse el `--ciudad` ahora es darle todo el país.
  rol.nombre = 'publicador general (carga en cualquier ciudad, ve solo lo suyo)';
}

const consumidos = new Set([flag, '--ciudad', ciudadCruda, ver && '--ver'].filter(Boolean));
const objetivo = argumentos.find((a) => !consumidos.has(a));
if (!objetivo) {
  console.error('Uso: npm run admin:claim -- <uid|email>                 (admin)');
  console.error('     npm run admin:claim -- --publicador <uid|email>    (general: carga en cualquier ciudad, ve lo suyo)');
  console.error('     npm run admin:claim -- --publicador --ciudad "Mar del Plata" <uid|email>');
  console.error('                                                       (carga solo en su ciudad; ve lo suyo + su ciudad, en lectura)');
  console.error('     npm run admin:claim -- --quitar <uid|email>        (le saca el rol)');
  console.error('     npm run admin:claim -- --ver <uid|email>           (solo lee: rol y ciudad)');
  console.error('     npm run admin:claim -- --todos                     (solo emulador)');
  process.exit(1);
}

const projectId = process.env.PUBLIC_FIREBASE_PROJECT_ID ?? 'agenda-literaria';
const enEmulador = Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST);

const credencial = () => {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  return raw ? cert(JSON.parse(raw)) : applicationDefault();
};

initializeApp(enEmulador ? { projectId } : { credential: credencial(), projectId });

/**
 * **El objetivo, dicho antes de escribir** — B-810.
 *
 * `docs/08-operacion.md` ya afirmaba que este script «anuncia el objetivo
 * (EMULADOR o PRODUCCIÓN) antes de escribir», y era el único de los **siete** que
 * deciden entre los dos entornos que **no lo hacía** — la lista la deriva
 * `tests/guardas-de-los-scripts.test.ts`, y decía «tres» acá porque el borrador de
 * este comentario se escribió antes de contarlos (lo cobró el
 * `auditor-documentacion`).
 *
 * No es cosmética: los dos comandos existen justamente para no darle admin a una
 * cuenta real creyendo estar en local, y el que se equivoca de comando no tiene
 * ninguna señal hasta que el error de Firebase le dice «no existe ese usuario» —
 * que es lo que pasó el 2026-09-08 con una cuenta que existía en producción.
 */
console.log(
  enEmulador
    ? `Objetivo: EMULADOR (${process.env.FIREBASE_AUTH_EMULATOR_HOST})`
    : `Objetivo: PRODUCCIÓN (${projectId})`,
);
// Y el rol, por el mismo motivo que el objetivo: `--publicador` es un flag de
// una palabra en medio de un comando largo, y equivocarse en silencio acá es
// darle el panel entero a quien tenía que ver solo lo suyo.
// Con `--ver` no hay rol que anunciar: se anuncia que no se escribe.
console.log(ver ? 'Modo: SOLO LECTURA (--ver no escribe nada)' : `Rol: ${rol.nombre.toUpperCase()}`);

const auth = getAuth();

/**
 * Un `user-not-found` explicado — B-810.
 *
 * El error crudo del SDK es `There is no user record corresponding to the
 * provided identifier` más un stack de veinte líneas, y **no dice ni contra qué
 * proyecto miró**. Las dos causas reales son las dos que este mensaje nombra, en
 * el orden en que conviene revisarlas:
 *
 * 1. **el comando equivocado**: `admin:claim` va al emulador y
 *    `admin:claim:prod` a producción. Es el caso que pasó;
 * 2. **la cuenta todavía no existe**: con Google, el usuario **nace en el primer
 *    login** (`08-operacion.md` § «Dar permiso de admin»), así que hay que
 *    entrar una vez y recién después dar el claim. El orden es al revés del
 *    intuitivo y es la mitad que más se olvida.
 */
const explicarSiNoExiste = (e) => {
  if (e?.errorInfo?.code !== 'auth/user-not-found') throw e;
  console.error(
    `\nNo existe «${objetivo}» en ${enEmulador ? 'el EMULADOR' : `PRODUCCIÓN (${projectId})`}.\n\n` +
      (enEmulador
        ? '  · Si la cuenta es de producción, el comando es `npm run admin:claim:prod -- ' +
          `${ver ? '--ver ' : ''}${objetivo}\`: este apunta al emulador.\n`
        : '  · Si la cuenta es del emulador, el comando es `npm run admin:claim -- ' +
          `${ver ? '--ver ' : ''}${objetivo}\`.\n`) +
      '  · Y si es la cuenta correcta: con Google el usuario nace en el PRIMER LOGIN.\n' +
      '    Que entre una vez a /admin (va a ver «sin permisos», eso está bien) y\n' +
      '    repetí este comando después.',
  );
  process.exit(1);
};

if (ver) {
  const usuario = await (objetivo.includes('@')
    ? auth.getUserByEmail(objetivo)
    : auth.getUser(objetivo)
  ).catch(explicarSiNoExiste);
  const { nombre, ciudad, avisos } = describirClaims(usuario.customClaims);
  console.log(`\nCuenta: ${usuario.email ?? '(sin correo)'} (uid ${usuario.uid})`);
  console.log(`Rol: ${nombre}`);
  console.log(`Ciudad: ${ciudad || '— (sin alcance por ciudad)'}`);
  console.log(`Claims: ${JSON.stringify(usuario.customClaims ?? {})}`);
  for (const aviso of avisos) console.log(`⚠️  ${aviso}`);
  // Lo que se lee es el claim guardado, no el del token: una sesión que ya
  // estaba abierta sigue con el anterior hasta volver a entrar (hasta una hora).
  console.log('\nEs el claim guardado. Una sesión abierta del panel puede tener el anterior hasta volver a entrar.');
  process.exit(0);
}

/**
 * `--todos` es comodidad de desarrollo: entrás una vez con el popup del
 * emulador (que inventa un uid nuevo cada vez) y en lugar de copiar el uid a
 * mano, le das el claim a todos los usuarios de mentira que haya.
 * Bloqueado fuera del emulador por razones obvias.
 */
if (objetivo === '--todos') {
  if (!enEmulador) {
    console.error('--todos solo funciona contra el emulador. Exportá FIREBASE_AUTH_EMULATOR_HOST.');
    process.exit(1);
  }
  const { users } = await auth.listUsers(1000);
  if (users.length === 0) {
    console.log('No hay usuarios en el emulador todavía. Entrá una vez a /admin y repetí.');
    process.exit(0);
  }
  for (const u of users) {
    await auth.setCustomUserClaims(u.uid, rol.claims);
    console.log(`${rol.nombre} -> ${u.email ?? u.uid}`);
  }
} else {
  const usuario = await (objetivo.includes('@')
    ? auth.getUserByEmail(objetivo)
    : auth.getUser(objetivo)
  ).catch(explicarSiNoExiste);
  // El objeto completo, nunca fusionado con los claims previos: es lo que hace
  // que cambiar de rol saque el anterior (ver el docblock de arriba).
  await auth.setCustomUserClaims(usuario.uid, rol.claims);
  console.log(`${rol.nombre} -> ${usuario.email ?? usuario.uid}${enEmulador ? ' (emulador)' : ''}`);
}

console.log('\nEl claim entra al token en el próximo login. Salí y volvé a entrar en /admin.');
