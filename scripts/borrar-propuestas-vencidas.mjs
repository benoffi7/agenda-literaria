#!/usr/bin/env node
/**
 * B-838 / DEC-13 + B-844 — lista (y opcionalmente borra) las propuestas que ya
 * cumplieron su plazo, **con su imagen**: la rechazada a los 30 días del
 * rechazo, y la que nadie tocó a los 30 días de su última señal de vida — el
 * mismo número, otro reloj.
 *
 *   node scripts/borrar-propuestas-vencidas.mjs                  # solo informa
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
 *   FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199 \
 *     node scripts/borrar-propuestas-vencidas.mjs --aplicar      # borra, en el emulador
 *   node scripts/borrar-propuestas-vencidas.mjs --aplicar --produccion   # borra, en producción
 *
 * ── Para qué, si ya existe la Function programada ─────────────────────────
 * `borrarPropuestasVencidas` (`functions/retencion-trigger.js`) hace este mismo
 * barrido sola, todos los días. Este script reusa **la misma decisión pura**
 * (`decidirRetencion`, de `functions/retencion.js`) para lo que la Function
 * programada no puede dar: correrlo contra el emulador antes de confiar en la
 * real —lo que el §10 del `CLAUDE.md` pide para todo lo que borra datos— y verlo
 * en seco cuando se quiera, sin esperar el próximo tick ni mirar solo los logs.
 *
 * **Y acá el «verlo antes» vale más que en los otros dos barridos**: lo que se
 * borra es el dato personal de un tercero y la prueba de qué pidió. No hay
 * papelera, y del otro lado hay una persona que quizás vuelva a escribir.
 *
 * ── Las guardas, que son dos y no una ─────────────────────────────────────
 * `--aplicar` fuera del emulador exige `--produccion` explícito (§ «Idempotencia
 * en los scripts» de `05-patrones.md`, y `tests/guardas-de-los-scripts.test.ts`
 * lo hace cumplir). Y como este barrido **también borra objetos**, mira las dos
 * variables: apuntar Firestore al emulador y Storage a producción borraría fotos
 * de verdad mientras el informe dice «EMULADOR», que es la peor combinación
 * posible — un script que parece cuidado.
 *
 * ── Y tampoco borra a ciegas (B-864) ──────────────────────────────────────
 * Usa el mismo `borrarPropuesta` que la Function, así que hereda la precondición:
 * si alguien toca una propuesta entre la lectura y el borrado, no se borra y el
 * informe lo dice (`intacta:`). Acá pesa incluso más que en la Function, porque
 * este script se corre **a mano y mientras alguien mira la bandeja**.
 *
 * ── Lo que NO hace, a propósito ───────────────────────────────────────────
 * No reimplementa ni relaja el tope: `decidirRetencion` recorta a
 * `MAX_PROPUESTAS_POR_CORRIDA` y marca el resto, así que este script informa
 * **lo mismo que haría la Function**, incluido lo que dejaría para mañana.
 *
 * ── Y desde B-871 releva además los flyers que no borra nadie ─────────────
 * Al final del informe va una segunda lista que **no sale de la retención**: los
 * objetos que hoy existen bajo `propuestas/` cruzados contra los documentos que
 * los nombran. Ahí aparecen el flyer de una propuesta **aceptada** —que no vence,
 * así que ningún barrido va a pasar por él— y el que ningún documento nombra.
 * Esta parte **solo informa**, también con `--aplicar`: qué hacer con cada caso
 * está en el runbook, y borrarlos automáticamente es una decisión de producto que
 * el dueño todavía no tomó.
 *
 * Es el chequeo que `08-operacion.md` decía que este script ya hacía y **no
 * hacía**: la query de la retención no trae las aceptadas, así que el motivo que
 * el runbook mandaba buscar no podía imprimirse nunca.
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

import {
  MAX_PROPUESTAS_POR_CORRIDA,
  PREFIJO_PROPUESTAS,
  RETENCION_POR_ESTADO,
  borrarPropuesta,
  decidirRetencion,
  propuestasVencibles,
  relevarFlyeresSinPlazo,
} from '../functions/retencion.js';

const aplicar = process.argv.includes('--aplicar');
const enEmulador = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const storageEnEmulador = Boolean(process.env.FIREBASE_STORAGE_EMULATOR_HOST);
const confirmaProduccion = process.argv.includes('--produccion');
const projectId = process.env.PUBLIC_FIREBASE_PROJECT_ID ?? 'agenda-literaria';
const bucketId = process.env.PUBLIC_FIREBASE_STORAGE_BUCKET ?? 'agenda-literaria.firebasestorage.app';

if (aplicar && !enEmulador && !confirmaProduccion) {
  console.error(
    '--aplicar sin FIRESTORE_EMULATOR_HOST apunta a PRODUCCIÓN y borra sin papelera.\n' +
      'Lo que se borra es el contacto de una persona y la prueba de qué propuso.\n' +
      'Si es un accidente: exportá FIRESTORE_EMULATOR_HOST y probá contra el emulador.\n' +
      'Si es a propósito: agregá también --produccion. Abortando.',
  );
  process.exit(1);
}

if (aplicar && enEmulador !== storageEnEmulador) {
  /*
   * **La guarda que ningún otro script necesita: acá se borra en los dos lados,
   * así que los dos tienen que apuntar al mismo lado.**
   *
   * Es de **coherencia y no de dirección**, y esa es la corrección del
   * `auditor-privacidad`: la primera versión solo miraba «Firestore en el
   * emulador y Storage en producción» —la mezcla ruidosa, que borra de más— y
   * dejaba pasar la de al lado, que es peor porque **borra de menos y en
   * silencio**. Con Firestore en producción y Storage en el emulador (el
   * `FIREBASE_STORAGE_EMULATOR_HOST` que quedó de la sesión anterior, y
   * `--produccion` agregado al final para «hacerlo de verdad»), el
   * `delete({ ignoreNotFound: true })` pega contra el emulador, **no encuentra
   * nada y no falla** —ese es el punto de `ignoreNotFound`— así que el orden
   * «objeto primero» no protege: después se borra el documento de producción y
   * la foto del tercero sobrevive en el bucket real, sin referencia, mientras el
   * informe dice `borrada: … (+ propuestas/…)`.
   *
   * Por eso `--produccion` **no** la levanta: ese flag confirma el destino, no
   * autoriza dos destinos distintos.
   */
  console.error(
    'Firestore y Storage apuntan a lugares distintos, y este barrido borra en los dos:\n' +
      `  Firestore: ${enEmulador ? 'EMULADOR' : 'PRODUCCIÓN'}\n` +
      `  Storage:   ${storageEnEmulador ? 'EMULADOR' : 'PRODUCCIÓN'}\n` +
      'Exportá (o sacá) las dos variables juntas. Abortando.',
  );
  process.exit(1);
}

initializeApp(
  enEmulador
    ? { projectId, storageBucket: bucketId }
    : { credential: applicationDefault(), projectId, storageBucket: bucketId },
);

console.log(
  enEmulador
    ? `Objetivo: EMULADOR (${process.env.FIRESTORE_EMULATOR_HOST})`
    : `Objetivo: PRODUCCIÓN (${projectId})`,
);
console.log(
  storageEnEmulador
    ? `Imágenes: EMULADOR (${process.env.FIREBASE_STORAGE_EMULATOR_HOST})`
    : `Imágenes: PRODUCCIÓN (${bucketId})`,
);
console.log(aplicar ? 'Modo:     APLICAR (borra)\n' : 'Modo:     informar (no borra)\n');

const db = getFirestore();
const bucket = getStorage().bucket();

/*
 * **Un solo reloj para las dos llamadas** (B-865). Desde que la lectura se corta
 * cuando las candidatas llenan el tope, `propuestasVencibles` le pregunta a la
 * misma decisión pura cuándo dejar de leer: con dos `Date.now()` distintos podría
 * cortar con un juicio y el informe imprimirse con otro.
 */
const ahora = Date.now();
const propuestas = await propuestasVencibles(db, { ahora });
const { aBorrar, motivos } = decidirRetencion({ propuestas, ahora });

const borrar = new Map(aBorrar.map((p) => [p.id, p.objeto]));

/*
 * Los plazos se **imprimen desde la tabla** y no se escriben acá (B-844): este
 * informe es lo que alguien mira antes de dejar borrar de verdad, así que un
 * número copiado que quedó viejo es precisamente la mentira que no puede darse
 * — diría «30 días» mientras el barrido usa otro.
 */
console.log(`${propuestas.length} propuesta(s) que pueden caducar`);
console.log('Retención por estado:');
for (const [estado, plazo] of Object.entries(RETENCION_POR_ESTADO)) {
  const cuanto =
    plazo === null
      ? 'no vence'
      : `${(plazo / (24 * 60 * 60 * 1000)).toFixed(0)} días desde ${
          estado === 'rechazada' ? 'el rechazo' : 'la última vez que se tocó'
        }`;
  console.log(`  ${estado.padEnd(12)} ${cuanto}`);
}
console.log(`Tope por corrida: ${MAX_PROPUESTAS_POR_CORRIDA} propuestas\n`);

for (const p of propuestas) {
  const marca = borrar.has(p.id) ? '[BORRAR]' : '[      ]';
  const objeto = borrar.get(p.id);
  // Ni el título ni el contacto: el barrido no los lee, y este informe se pega
  // en un chat o en un issue con la misma facilidad que cualquier otra salida.
  console.log(`${marca} ${p.id}  ·  ${motivos[p.id]}${objeto ? `  ·  ${objeto}` : ''}`);
}

const conImagen = aBorrar.filter((p) => p.objeto).length;
console.log(
  `\n${aBorrar.length} propuesta(s) y ${conImagen} imagen(es) ` +
    `${aplicar ? 'a borrar' : 'se borrarían'}`,
);

if (aplicar) {
  let borradas = 0;
  let rescatadas = 0;
  /*
   * **Contador aparte y no `rescatadas + 1`** — lo pidió el `auditor-trampas`.
   * `la-tocaron-tarde` **no** es una propuesta intacta: el documento se salvó y
   * el flyer no. Meterla en el mismo número dejaba la última línea del informe
   * —que es justo la que se lee de apuro— diciendo «N intacta(s)» de algo que
   * perdió una mitad.
   */
  let sinImagen = 0;
  for (const caducada of aBorrar) {
    /*
     * **El informe dice qué pasó de verdad, no qué se pensaba hacer** (B-864).
     * `borrarPropuesta` puede no borrar: si alguien tocó la propuesta entre la
     * query de arriba y esta línea, la precondición la salva. Escribir
     * «borrada:» igual sería la misma mentira que la guarda cruzada de este
     * script vino a cerrar — un script que parece cuidado.
     */
    const final = await borrarPropuesta(db, bucket, caducada);
    if (final === 'la-tocaron') {
      rescatadas += 1;
      console.log(`intacta: ${caducada.id}  ·  la tocaron mientras corría este script`);
      continue;
    }
    if (final === 'la-tocaron-tarde') {
      sinImagen += 1;
      console.log(
        `intacta: ${caducada.id}  ·  la tocaron en el último segundo` +
          `${caducada.objeto ? ` — y su imagen ya se había borrado (${caducada.objeto})` : ''}`,
      );
      continue;
    }
    borradas += 1;
    console.log(`borrada: ${caducada.id}${caducada.objeto ? ` (+ ${caducada.objeto})` : ''}`);
  }
  console.log(
    `\n${borradas} propuesta(s) borrada(s)` +
      `${rescatadas > 0 ? `, ${rescatadas} intacta(s) porque las tocaron` : ''}` +
      `${sinImagen > 0 ? `, ${sinImagen} salvada(s) SIN su imagen` : ''}.`,
  );
} else if (aBorrar.length > 0) {
  console.log('\nCorré de nuevo con --aplicar para borrarlas de verdad.');
}

/*
 * ── El relevamiento de B-871, que es lo que este informe no podía contestar ──
 *
 * `08-operacion.md` decía que el backfill de los flyers de propuestas ya
 * aceptadas se chequeaba «corriendo este script sin --aplicar, y una línea
 * `aceptada-no-vence` con un `propuestas/…` al lado es un flyer huérfano vivo».
 * **Eso no podía pasar nunca**: la query de arriba trae `ESTADOS_QUE_CADUCAN` y
 * la `aceptada` queda afuera por definición, así que el motivo `aceptada-no-vence`
 * jamás se imprime y el chequeo documentado daba siempre «no hay ninguno».
 *
 * Lo que sigue entra por el otro lado —los objetos que existen en el bucket— y
 * por eso encuentra los siete caminos, incluido el que no emite ningún log
 * porque el trigger actúa solo en la transición. **Solo informa**: qué hacer con
 * cada uno está en el runbook, y automatizar el borrado necesita una decisión del
 * dueño que todavía no está.
 */
if (enEmulador !== storageEnEmulador) {
  /*
   * Sin `--aplicar` la guarda de coherencia de arriba no corre, y acá importa
   * igual: cruzar los documentos de un lado con los objetos del otro daría
   * **todo** como `sin-propuesta`, o sea un informe que inventa un problema
   * enorme. Es la misma mentira que esa guarda evita, del lado que no borra.
   */
  console.log(
    '\nFlyers sin plazo (B-871): no se releva.\n' +
      `  Firestore apunta a ${enEmulador ? 'EMULADOR' : 'PRODUCCIÓN'} y Storage a ` +
      `${storageEnEmulador ? 'EMULADOR' : 'PRODUCCIÓN'}: el cruce diría cualquier cosa.`,
  );
} else {
  const { aRevisar, motivos: porObjeto, objetos } = await relevarFlyeresSinPlazo(db, bucket, {
    ahora,
  });
  console.log(`\nFlyers bajo ${PREFIJO_PROPUESTAS} (B-871): ${objetos} objeto(s)`);
  /*
   * **Se listan uno por uno solo los que piden a alguien, y del resto va el
   * conteo por motivo.** Es al revés que la lista de arriba, y a propósito: ahí
   * cada línea es una decisión que alguien puede querer discutir antes de
   * `--aplicar`; acá el 99% son objetos sanos de propuestas abiertas, y
   * trescientas líneas de `de-una-que-caduca` esconden las dos que importan.
   */
  const porMotivo = {};
  for (const motivo of Object.values(porObjeto)) porMotivo[motivo] = (porMotivo[motivo] ?? 0) + 1;
  console.log(
    '  ' +
      Object.entries(porMotivo)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([motivo, n]) => `${motivo}: ${n}`)
        .join('  ·  '),
  );
  for (const f of aRevisar) {
    // El id de la propuesta cuando lo hay: sin él no se puede abrir la ficha
    // para mirar el `warn` que dice cuál de los seis caminos fue.
    console.log(`[REVISAR] ${f.objeto}  ·  ${f.motivo}${f.propuesta ? `  ·  ${f.propuesta}` : ''}`);
  }
  if (aRevisar.length === 0) {
    console.log('Ninguno quedó sin quien lo borre.');
  } else {
    console.log(
      `\n${aRevisar.length} flyer(s) que no va a borrar nadie. **Este script no los borra**: ` +
        'el remedio es manual y está en docs/08-operacion.md § «Cuando suena ' +
        '`flyer-de-propuesta-sin-borrar`».',
    );
  }
}

process.exit(0);
