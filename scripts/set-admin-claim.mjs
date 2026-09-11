#!/usr/bin/env node
/**
 * §5.3 — setea el custom claim del rol con el Admin SDK. Sin un claim, las
 * reglas de Firestore rechazan toda escritura.
 *
 *   npm run admin:claim -- <uid|email>                 → admin (ve y toca todo)
 *   npm run admin:claim -- --publicador <uid|email>    → publicador (B-888)
 *   npm run admin:claim -- --quitar <uid|email>        → sin claims
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

const argumentos = process.argv.slice(2);

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

const objetivo = argumentos.find((a) => a !== flag);
if (!objetivo) {
  console.error('Uso: npm run admin:claim -- <uid|email>                 (admin)');
  console.error('     npm run admin:claim -- --publicador <uid|email>    (solo lo suyo)');
  console.error('     npm run admin:claim -- --quitar <uid|email>        (le saca el rol)');
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
console.log(`Rol: ${rol.nombre.toUpperCase()}`);

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
          `${objetivo}\`: este apunta al emulador.\n`
        : '  · Si la cuenta es del emulador, el comando es `npm run admin:claim -- ' +
          `${objetivo}\`.\n`) +
      '  · Y si es la cuenta correcta: con Google el usuario nace en el PRIMER LOGIN.\n' +
      '    Que entre una vez a /admin (va a ver «sin permisos», eso está bien) y\n' +
      '    repetí este comando después.',
  );
  process.exit(1);
};

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
