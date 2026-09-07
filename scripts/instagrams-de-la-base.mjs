#!/usr/bin/env node
/**
 * **Todas las cuentas de Instagram que aparecen en la base, en una página para
 * abrir y seguir de una.**
 *
 *   node scripts/instagrams-de-la-base.mjs
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node scripts/instagrams-de-la-base.mjs
 *
 * Pedido del dueño: «una pagina local con todos los usuarios de ig que tienen
 * actividad en la base de datos, quiero seguir a esas cuentas».
 *
 * ── Es LOCAL, y eso no es un detalle de comodidad ─────────────────────────
 * La página sale a `.estado/`, que está en el `.gitignore`, y **no** a `public/`
 * ni a `dist/`. El motivo es `difusion.arrobar`: el §5.1 lo marca como **trabajo
 * interno que nunca sale al público**, y esta lista lo incluye a propósito —son
 * justamente las cuentas a las que hay que seguir—. Un archivo en `public/` se
 * publicaría con el próximo build; uno en `.estado/` no se versiona ni se
 * despliega.
 *
 * Por eso tampoco se sube a ningún lado: es un archivo para abrir en el
 * navegador de quien lo corre.
 *
 * ── De dónde saca los handles ─────────────────────────────────────────────
 * De los tres lugares del modelo donde vive un Instagram, y **dice de cuál**:
 *
 * | Campo | Qué es esa cuenta |
 * |---|---|
 * | `organizador.instagram` | quien organiza la actividad |
 * | `tallerista.instagram` | quien la da, o el autor invitado |
 * | `difusion.arrobar[]` | a quién hay que etiquetar al publicar (interno) |
 *
 * Se lee **toda** la colección, no solo lo publicado: un borrador ya tiene
 * cargado a su organizador, y para seguir una cuenta no hace falta esperar a
 * publicar la actividad.
 *
 * ── El handle: una copia, y atada por un test ─────────────────────────────
 * La normalización de verdad es `handleInstagram` (`src/lib/detallePublico.ts`):
 * resuelve `@casabrandon`, `casabrandon` y `instagram.com/casabrandon`, y
 * **valida contra el alfabeto real de Instagram** —lo que no lo cumple no se
 * convierte en link, porque un handle con una barra adentro armaría una URL a
 * **otra cuenta**—.
 *
 * **Este script no la puede importar**, y es la misma restricción que D-20 ya
 * había resuelto para las Functions: un `.mjs` que corre con `node` a secas no
 * resuelve los alias `@/` de TypeScript, y arrastrar un loader para un script de
 * una página no vale.
 *
 * Así que la copia vive en `scripts/handle-instagram.mjs` —aparte, porque
 * importar **este** archivo lo ejecuta— **con la misma red que usa D-20**:
 * `tests/instagrams-de-la-base.test.ts` corre las dos funciones contra la misma
 * batería de entradas y exige que contesten igual. Si divergen, esta página
 * armaría una URL distinta de la que arma el sitio para el mismo dato — y una de
 * las dos mandaría a la cuenta equivocada.
 *
 * Lo que no pasa el filtro **no se descarta en silencio**: va a una sección
 * aparte con el valor crudo, porque un handle mal cargado es justamente algo que
 * el dueño quiere ver y corregir.
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { handleInstagram } from './handle-instagram.mjs';


const enEmulador = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const projectId = process.env.PUBLIC_FIREBASE_PROJECT_ID ?? 'agenda-literaria';
const raiz = new URL('..', import.meta.url);
const SALIDA = fileURLToPath(new URL('.estado/instagrams.html', raiz));

initializeApp(enEmulador ? { projectId } : { credential: applicationDefault(), projectId });

console.log(
  enEmulador
    ? `Objetivo: EMULADOR (${process.env.FIRESTORE_EMULATOR_HOST})`
    : `Objetivo: PRODUCCIÓN (${projectId})`,
);
console.log('Modo:     solo lectura\n');

const db = getFirestore();
const snap = await db.collection('actividades').get();

/** `handle` → qué actividades y en qué rol. */
const cuentas = new Map();
/** Lo que no pasó el filtro de handle, con su valor crudo. */
const dudosos = [];

const anotar = (crudo, rol, actividad) => {
  if (!crudo || !String(crudo).trim()) return;
  const handle = handleInstagram(String(crudo));
  if (!handle) {
    dudosos.push({ crudo: String(crudo).trim(), rol, actividad });
    return;
  }
  // La clave es en minúsculas —Instagram no distingue— y se guarda el primer
  // valor tal cual vino, para mostrarlo como lo escribió quien lo cargó.
  const clave = handle.toLowerCase();
  const previo = cuentas.get(clave) ?? { handle, apariciones: [] };
  previo.apariciones.push({ rol, actividad });
  cuentas.set(clave, previo);
};

for (const doc of snap.docs) {
  const a = doc.data();
  const actividad = { titulo: a.titulo ?? doc.id, estado: a.estado ?? 'sin estado' };
  anotar(a.organizador?.instagram, 'organiza', actividad);
  anotar(a.tallerista?.instagram, 'da el taller', actividad);
  for (const arroba of a.difusion?.arrobar ?? []) anotar(arroba, 'a etiquetar', actividad);
}

/*
 * Orden: primero las que aparecen en más actividades. Es el orden en que conviene
 * seguirlas —la cuenta que organiza ocho cosas importa más que la que aparece una
 * vez— y el desempate alfabético hace que dos corridas den la misma página.
 */
const ordenadas = [...cuentas.values()].sort(
  (x, y) => y.apariciones.length - x.apariciones.length || x.handle.localeCompare(y.handle),
);

const escapar = (t) =>
  String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const fila = ({ handle, apariciones }) => {
  const roles = [...new Set(apariciones.map((x) => x.rol))].join(' · ');
  const donde = apariciones
    .map((x) => `${escapar(x.actividad.titulo)} <span class="estado">${escapar(x.actividad.estado)}</span>`)
    .join('<br>');
  return `<tr>
    <td class="cuenta"><a href="https://instagram.com/${handle}" target="_blank" rel="noreferrer">@${escapar(handle)}</a></td>
    <td class="n">${apariciones.length}</td>
    <td class="rol">${escapar(roles)}</td>
    <td class="donde">${donde}</td>
  </tr>`;
};

const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Instagrams de la base — Agenda LEH</title>
<style>
  :root { color-scheme: light; }
  body { margin: 0; padding: 2rem 1.25rem 4rem; background: #fbf9f4; color: #1b1c19;
         font: 15px/1.5 ui-sans-serif, system-ui, sans-serif; }
  main { max-width: 60rem; margin: 0 auto; }
  h1 { font-size: 1.5rem; margin: 0 0 .25rem; }
  .bajada { color: #58413c; margin: 0 0 1.5rem; font-size: .875rem; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; vertical-align: top; padding: .625rem .75rem; border-bottom: 1px solid #8c716b33; }
  th { font-size: .6875rem; text-transform: uppercase; letter-spacing: .05em; color: #58413c; }
  .cuenta a { color: #a7341c; font-weight: 600; text-decoration: none; }
  .cuenta a:hover { text-decoration: underline; }
  .n { font-variant-numeric: tabular-nums; color: #58413c; width: 3rem; }
  .rol { color: #58413c; font-size: .8125rem; width: 11rem; }
  .donde { font-size: .8125rem; color: #1b1c19cc; }
  .estado { color: #58413c99; font-size: .75rem; }
  h2 { font-size: 1rem; margin: 2.5rem 0 .5rem; }
  .aviso { background: #a7341c0d; border: 1px solid #a7341c33; padding: .75rem 1rem;
           font-size: .8125rem; margin: 0 0 1.5rem; }
</style>
</head>
<body>
<main>
  <h1>Instagrams de la base</h1>
  <p class="bajada">
    ${ordenadas.length} cuenta(s) en ${snap.size} actividad(es) ·
    generado el ${new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}
  </p>

  <p class="aviso">
    <strong>Este archivo es local y no se publica.</strong> Incluye los handles de
    <code>difusion.arrobar</code>, que el §5.1 marca como trabajo interno: nunca salen al
    sitio. Vive en <code>.estado/</code>, que está en el <code>.gitignore</code>.
  </p>

  <table>
    <thead>
      <tr><th>Cuenta</th><th>Act.</th><th>Rol</th><th>En qué actividades</th></tr>
    </thead>
    <tbody>
      ${ordenadas.map(fila).join('\n')}
    </tbody>
  </table>

  ${
    dudosos.length > 0
      ? `<h2>No se pudieron leer como handle (${dudosos.length})</h2>
  <p class="bajada">
    No pasaron el alfabeto de Instagram, así que no se armó un link: se muestran crudos
    porque un handle mal cargado conviene verlo y corregirlo, no descartarlo en silencio.
  </p>
  <table>
    <thead><tr><th>Valor cargado</th><th>Rol</th><th>Actividad</th></tr></thead>
    <tbody>
      ${dudosos
        .map(
          (d) =>
            `<tr><td><code>${escapar(d.crudo)}</code></td><td class="rol">${escapar(d.rol)}</td><td class="donde">${escapar(d.actividad.titulo)}</td></tr>`,
        )
        .join('\n')}
    </tbody>
  </table>`
      : ''
  }
</main>
</body>
</html>
`;

mkdirSync(fileURLToPath(new URL('.estado', raiz)), { recursive: true });
writeFileSync(SALIDA, html);

console.log(`${snap.size} actividad(es) leídas`);
console.log(`${ordenadas.length} cuenta(s) distintas`);
if (dudosos.length > 0) console.log(`${dudosos.length} valor(es) que no se pudieron leer como handle`);
console.log(`\nPágina: ${SALIDA}`);
console.log(`Abrila con:  open ${SALIDA}`);

process.exit(0);
