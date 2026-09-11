import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const RULES = 'firestore.rules';
const BACKUP = '/tmp/firestore.rules.b888.bak';
copyFileSync(RULES, BACKUP);
const original = readFileSync(RULES, 'utf8');

const M = [
  ['01 · read: el publicador lee cualquier actividad',
   `allow read: if esAdmin()\n        || (esPublicador() && resource.data.get('createdBy', '') == request.auth.uid);`,
   `allow read: if esAdmin() || esPublicador();`],
  ['02 · create: no se verifica el createdBy propio',
   `             && request.resource.data.get('createdBy', '') == request.auth.uid\n             && request.resource.data.get('updatedBy', '') == request.auth.uid);`,
   `             && request.resource.data.get('updatedBy', '') == request.auth.uid);`],
  ['03 · create: no se verifica el updatedBy propio',
   `             && request.resource.data.get('createdBy', '') == request.auth.uid\n             && request.resource.data.get('updatedBy', '') == request.auth.uid);`,
   `             && request.resource.data.get('createdBy', '') == request.auth.uid);`],
  ['04 · update: no se verifica que la actividad sea suya',
   `             && resource.data.get('createdBy', '') == request.auth.uid\n             && request.resource.data.get('createdBy', '') == resource.data.get('createdBy', '')`,
   `             && request.resource.data.get('createdBy', '') == resource.data.get('createdBy', '')`],
  ['05 · update: el dueño se mira en el documento NUEVO (robo)',
   `             && resource.data.get('createdBy', '') == request.auth.uid\n             && request.resource.data.get('createdBy', '') == resource.data.get('createdBy', '')`,
   `             && request.resource.data.get('createdBy', '') == request.auth.uid`],
  ['06 · update: el createdBy puede cambiar (regalar)',
   `             && request.resource.data.get('createdBy', '') == resource.data.get('createdBy', '')\n             && request.resource.data.get('updatedBy', '') == request.auth.uid);`,
   `             && request.resource.data.get('updatedBy', '') == request.auth.uid);`],
  ['07 · update: el updatedBy puede ser de otro',
   `             && request.resource.data.get('createdBy', '') == resource.data.get('createdBy', '')\n             && request.resource.data.get('updatedBy', '') == request.auth.uid);`,
   `             && request.resource.data.get('createdBy', '') == resource.data.get('createdBy', ''));`],
  ['08 · delete: se puede borrar lo ajeno',
   `      allow delete: if esAdmin()\n        || (esPublicador() && resource.data.get('createdBy', '') == request.auth.uid);`,
   `      allow delete: if esAdmin() || esPublicador();`],
  ['09 · el default del .get() es el uid propio (documento sin dueño)',
   `resource.data.get('createdBy', '') == request.auth.uid`,
   `resource.data.get('createdBy', request.auth.uid) == request.auth.uid`],
  ['10 · esAdmin() no excluye al publicador (orden de las guardas)',
   `        && request.auth.token.get('admin', false) == true\n        && !esPublicador();`,
   `        && request.auth.token.get('admin', false) == true;`],
  ['11 · /opciones: el publicador reescribe la taxonomía',
   `      allow write: if esAdmin();\n    }\n\n    function reporteValido() {`,
   `      allow write: if esDelPanel();\n    }\n\n    function reporteValido() {`],
  ['12 · /reportes read: abierto al publicador',
   `      allow read: if esAdmin();\n      allow create: if esAdmin() && reporteValido();`,
   `      allow read: if esDelPanel();\n      allow create: if esAdmin() && reporteValido();`],
  ['13 · /reportes create: abierto al publicador',
   `      allow create: if esAdmin() && reporteValido();`,
   `      allow create: if esDelPanel() && reporteValido();`],
  ['14 · /sistema read: abierto al publicador',
   `      allow read: if esAdmin();\n      allow write: if false;\n    }`,
   `      allow read: if esDelPanel();\n      allow write: if false;\n    }`],
  ['15 · /versiones read: abierto al publicador',
   `      match /versiones/{version} {\n        allow read: if esAdmin();`,
   `      match /versiones/{version} {\n        allow read: if esDelPanel();`],
  ['16 · /propuestas read: abierto al publicador',
   `      allow read: if esAdmin();\n\n      /*\n       * ⚠️ **ACÁ VA LA PRIMERA ESCRITURA ANÓNIMA`,
   `      allow read: if esDelPanel();\n\n      /*\n       * ⚠️ **ACÁ VA LA PRIMERA ESCRITURA ANÓNIMA`],
  ['17 · /propuestas update: abierto al publicador',
   `      allow update: if esAdmin() && revisionValida();`,
   `      allow update: if esDelPanel() && revisionValida();`],
  ['18 · /usuarios: se puede escribir el registro de otro uid',
   `allow create, update: if esDelPanel() && uid == request.auth.uid && usuarioValido();`,
   `allow create, update: if esDelPanel() && usuarioValido();`],
  ['19 · /usuarios: cualquiera con sesión se registra (sin claim)',
   `allow create, update: if esDelPanel() && uid == request.auth.uid && usuarioValido();`,
   `allow create, update: if uid == request.auth.uid && usuarioValido();`],
  ['20 · /usuarios: el mail no se compara contra el token',
   `        && d.email == request.auth.token.get('email', '')\n`,
   ``],
  ['21 · /usuarios: no se exige email_verified',
   `        && request.auth.token.get('email_verified', false) == true\n`,
   ``],
  ['22 · /usuarios: sin hasOnly (se puede meter un rol)',
   `      return d.keys().hasOnly(['email', 'actualizadoEn'])\n        && d.keys().hasAll(['email', 'actualizadoEn'])`,
   `      return d.keys().hasAll(['email', 'actualizadoEn'])`],
  ['23 · /usuarios: sin hasAll (registro sin mail)',
   `        && d.keys().hasAll(['email', 'actualizadoEn'])\n`,
   ``],
  ['24 · /usuarios: se puede antedatar',
   `        && d.actualizadoEn == request.time;`,
   `;`],
  ['25 · /usuarios: se puede borrar el registro propio',
   `      allow delete: if false;\n    }\n\n    match /actividades/{id} {`,
   `      allow delete: if uid == request.auth.uid;\n    }\n\n    match /actividades/{id} {`],
  ['26 · /usuarios read: cualquiera del panel lee el directorio',
   `      allow read: if esAdmin() || (esPublicador() && uid == request.auth.uid);`,
   `      allow read: if esDelPanel();`],
  ['27 · el tope del mail se desfasa del de TypeScript',
   `d.email.size() <= 200`,
   `d.email.size() <= 320`],
];

const resultados = [];
for (const [nombre, de, a] of M) {
  if (!original.includes(de)) { resultados.push([nombre, 'NO APLICÓ (el patrón no está)', '']); continue; }
  writeFileSync(RULES, original.replace(de, a));
  let salida = '';
  let codigo = 0;
  try {
    salida = execSync(
      'npx vitest run tests/rol-publicador.integracion.test.ts tests/usuarios.integracion.test.ts --reporter=basic 2>&1',
      { encoding: 'utf8', maxBuffer: 40 * 1024 * 1024 },
    );
  } catch (e) { salida = e.stdout ?? ''; codigo = e.status ?? 1; }
  const rojos = [...salida.matchAll(/FAIL\s+tests\/\S+\s+>\s+(.+)/g)].map((m) => m[1].trim());
  const unicos = [...new Set(rojos.map((r) => r.split(' > ').pop()))];
  resultados.push([nombre, codigo === 0 ? '🟢 VERDE (no se cobró)' : `🔴 ROJO (${unicos.length})`, unicos.slice(0, 3).join(' | ')]);
  console.log(`${resultados.at(-1)[1].padEnd(22)} ${nombre}\n    ${resultados.at(-1)[2]}`);
}
writeFileSync(RULES, original);
console.log('\n=== reglas restauradas ===');
const verdes = resultados.filter((r) => r[1].startsWith('🟢') || r[1].startsWith('NO'));
console.log(verdes.length === 0 ? 'TODAS las mutaciones se cobraron.' : `SIN COBRAR: ${verdes.map((v) => v[0]).join(', ')}`);
