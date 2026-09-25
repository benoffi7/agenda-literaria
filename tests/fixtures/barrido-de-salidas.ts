/**
 * Lo compartido por los barridos de `tests/salidas/` — PRD 6, M-12.
 *
 * Hasta el 2026-09-25 los veintiún barridos vivían en un solo archivo,
 * `tests/barrido-de-salidas-publicas.test.ts` (4.200 líneas, ~50 mil tokens):
 * para sumar **una** salida había que leerlo entero. Ahora cada barrido es su
 * archivo en `tests/salidas/`, y lo que usan dos o más —las listas de
 * permitidos, las canastas del gate, las rutas del centinela— vive acá. El
 * conteo de casos es el mismo: 108 antes y después, con los mismos nombres.
 *
 * El índice de qué salida vive en qué archivo sigue en la ruta vieja,
 * `tests/barrido-de-salidas-publicas.test.ts`, y es un test: si una fila deja de
 * coincidir con su archivo, se pone rojo.
 *
 * ── El registro, como estaba escrito ───────────────────────────────────────
 *
 * **Barrido de las salidas públicas: sobreviven exactamente los centinelas
 * permitidos** (B-196).
 *
 * ── Qué reemplaza ──────────────────────────────────────────────────────────
 * Las cuatro salidas públicas del §5.1 se verificaban de dos maneras, y dos
 * estaban peor cubiertas:
 *
 * | Salida | Antes | Ahora |
 * |---|---|---|
 * | Issue de GitHub | barrido por clase (`clases-de-bug.test.ts`) | igual |
 * | Analítica | barrido por clase (`analytics-privacidad.test.ts`) | igual |
 * | `events.json` / SSG | lista de campos conocidos | **este barrido** |
 * | Evento de Calendar | lista de campos conocidos | **este barrido** |
 *
 * Las listas nombraban los campos privados que existían el día que se
 * escribieron (`zoom.us/j/secreto`, `coordinar con prensa`, `drive/privado`,
 * `evt_secreto`, `uid_abc`). Eso cubre lo que se conocía, no la propiedad: el
 * campo nuevo que nadie agregue a la lista se publica y nada se pone rojo. Ya
 * pasó dos veces esta semana en la variante barata —una celda de la tabla del
 * paso 0 que no la fijaba nada **porque el fixture no tenía el campo**— y es el
 * agujero que esto cierra de raíz.
 *
 * ── La forma ───────────────────────────────────────────────────────────────
 * 1. Un fixture donde **cada string del documento es un centinela** distinto y
 *    verificable (`tests/fixtures/centinelas.ts`).
 * 2. Por cada salida, una lista **corta, nombrada y justificada** de los
 *    centinelas que SÍ deben salir. Es el corazón del chequeo: sin ella el
 *    barrido fallaría contra todo, y con veinte excepciones sin explicar no
 *    verificaría nada.
 * 3. La aserción va en las **dos** direcciones: ningún centinela de más (fuga)
 *    y ninguno de menos (dejó de publicarse algo, o la excepción sobra).
 *
 * ── Por qué las dos direcciones ────────────────────────────────────────────
 * La dirección "de menos" es la que convierte cada fila de la tabla del paso 0
 * en algo que falla: si mañana se saca `libro` de la proyección, o el bloque
 * «Cupo completo» del evento, este archivo lo dice. Un barrido de una sola
 * dirección pasa con una proyección vacía.
 *
 * ── No se toca lo que ya estaba ────────────────────────────────────────────
 * `toPublic.test.ts` y `calendario.test.ts` siguen con sus casos nombrados:
 * ahí están las **instancias** (la forma exacta de `online`, el desvío de
 * `urlPublica`, la línea del cupo). Acá está la **clase**.
 */
import { expect, it } from 'vitest';
import { toPublic } from '@/lib/toPublic';
import { entradaDeIndice } from '@/lib/eventsJson';
import type { RutaCentinela } from './centinelas';
import { type Excepcion } from './barrido';
import { PERMITIDO_EN_LA_PROYECCION_DE_BIBLIOTECAS, PERMITIDO_EN_LA_PROYECCION_DE_LIBRERIAS, PERMITIDO_EN_LA_PROYECCION_DE_LUGARES, PERMITIDO_EN_LA_PROYECCION_DE_SUSCRIPCIONES, PERMITIDO_SIN_DIRECCION_DE_LUGARES } from './canastas-de-la-guia';
import type { RutaDeBiblioteca } from './centinelas-biblioteca';
import type { RutaDeLibreria } from './centinelas-libreria';
import type { RutaDeLugar } from './centinelas-lugar';
import type { RutaDeSuscripcion } from './centinelas-suscripcion';
import { CENTINELA_DEL_DIRECTORIO, CENTINELA_DE_BIBLIOTECAS, CENTINELA_DE_LUGARES, CENTINELA_DE_SUSCRIPCIONES } from '../../scripts/gate-build/semilla.mjs';


// ───────────────────────────────────────────────────────────────────────────
// B-1761 — las canastas del gate del build, atadas a las de acá.
// ───────────────────────────────────────────────────────────────────────────

/**
 * **Cada centinela del gate, con la ruta de este fixture que mide lo mismo** —
 * B-1761.
 *
 * El paso 9 del gate (`scripts/gate-build/chequeos/11-barrido.mjs`) barre el `dist/` con sus
 * propias canastas, y una excepción nueva se declaraba «en los dos» de memoria.
 * Falló cuatro veces (B-99, `comisionId`, `incluyeSlug`, el monto): una lista se
 * actualizaba y la otra no, y el gate quedaba rojo por un campo que se publica a
 * propósito o ciego a uno nuevo. Desde B-1760 la semilla del gate es un módulo
 * sin efectos, así que se puede importar y comparar.
 *
 * Las cuatro colecciones de la Guía tienen su propia tabla —`RUTA_EN_LA_GUIA`,
 * abajo—, porque sus rutas son las de otro fixture. Hasta B-1812 estaban acá
 * mapeadas a `null` y no se comparaban. El único `null` que queda es el mail de
 * una cuenta del panel: no es parte de ningún documento que un barrido de vitest
 * recorra. Que entre esta tabla y las de la Guía estén **todas** las claves lo
 * exige el primer `it` de abajo: un centinela nuevo en el gate obliga a decidir
 * acá con qué se compara.
 */
export const RUTA_DEL_CENTINELA_DEL_GATE: Record<string, RutaCentinela | null> = {
  descripcion: 'descripcion',
  destino: 'inscripcion.destino',
  direccion: 'sede.direccion',
  indicaciones: 'sede.indicaciones',
  tema: 'sesiones.tema',
  lectura: 'sesiones.lectura',
  motivoCancelacion: 'sesiones.motivoCancelacion',
  bio: 'tallerista.bio',
  talleristaInstagram: 'tallerista.instagram',
  organizadorInstagram: 'organizador.instagram',
  organizadorWeb: 'organizador.web',
  arancelNotas: 'arancel.notas',
  // El item del gate es `publico: true`: su título y su URL son los del público.
  materialTitulo: 'material.titulo.publico',
  materialUrl: 'material.url.publico',
  difusionNotas: 'difusion.notas',
  difusionArrobar: 'difusion.arrobar',
  onlineUrl: 'online.url',
  storagePath: 'imagenes.storagePath',
  createdBy: 'createdBy',
  epigrafeImagen: 'imagenes.epigrafe',
  comisionId: 'comisiones.id',
  incluyeSlug: 'incluye',
  mailDePanel: null,
};


/**
 * **Lo mismo para las cuatro colecciones de la Guía** — B-1812.
 *
 * Cada una se compara con la lista de su proyección
 * (`tests/fixtures/canastas-de-la-guia.ts`) y no con la de su ficha o su marcado:
 * la canasta del gate es **del archivo**, y los tres archivos de cada colección
 * —el JSON, el listado y la ficha, con su JSON-LD adentro— publican entre todos
 * lo que publica la proyección. Las otras dos listas son subconjuntos de ésa.
 *
 * `storagePath` y `createdBy` también están: el gate los siembra en las fichas de
 * la Guía (la imagen y el `revision.porUid`), así que la canasta de cada
 * directorio los tiene que seguir prohibiendo, como el barrido de acá.
 *
 * El `null` de cada `*Pendiente` es de otra naturaleza: es la descripción de una
 * ficha que **espera decisión**, y lo que la deja afuera es el
 * `where('estado','==','publicado')` de la lectura del build, no la proyección.
 * Ningún barrido de vitest recorre esa lectura, así que no hay con qué
 * compararlo; el gate lo prohíbe en todo el `dist/` y esa es su única red.
 *
 * La casa de los lugares es la única clave que se compara contra **otra** lista
 * de la misma colección: `lugarDireccionDeCasa` es la `direccion` de un lugar
 * publicado con `direccionPublica: false`, así que su par es
 * `PERMITIDO_SIN_DIRECCION`, no la proyección del local comercial.
 */
export type ComparacionDeLaGuia = {
  salida: string;
  canasta: readonly string[];
  grupos: readonly { centinelas: readonly string[] }[];
  rutas: Record<string, string | null>;
};


export const RUTA_EN_LA_GUIA = {
  librerias: {
    salida: 'librerías',
    canasta: CENTINELA_DEL_DIRECTORIO,
    grupos: PERMITIDO_EN_LA_PROYECCION_DE_LIBRERIAS,
    rutas: {
      libreriaDescripcion: 'descripcion',
      libreriaDireccion: 'direccion',
      libreriaContacto: 'contactoDeQuienCargo.valor',
      libreriaMotivo: 'revision.motivo',
      libreriaPendiente: null,
      storagePath: 'imagenes.storagePath',
      createdBy: 'revision.porUid',
    } satisfies Record<string, RutaDeLibreria | null>,
  },
  suscripciones: {
    salida: 'suscripciones',
    canasta: CENTINELA_DE_SUSCRIPCIONES,
    grupos: PERMITIDO_EN_LA_PROYECCION_DE_SUSCRIPCIONES,
    rutas: {
      suscripcionDescripcion: 'descripcion',
      suscripcionTematica: 'envio.tematica',
      suscripcionContacto: 'contactoDeQuienCargo.valor',
      suscripcionMotivo: 'revision.motivo',
      suscripcionPendiente: null,
      storagePath: 'imagenes.storagePath',
      createdBy: 'revision.porUid',
    } satisfies Record<string, RutaDeSuscripcion | null>,
  },
  lugares: {
    salida: 'lugares (local comercial)',
    canasta: CENTINELA_DE_LUGARES,
    grupos: PERMITIDO_EN_LA_PROYECCION_DE_LUGARES,
    rutas: {
      lugarDescripcion: 'descripcion',
      lugarDireccion: 'direccion',
      lugarContacto: 'contactoDeQuienCargo.valor',
      lugarMotivo: 'revision.motivo',
      lugarPendiente: null,
      storagePath: 'imagenes.storagePath',
      createdBy: 'revision.porUid',
    } satisfies Record<string, RutaDeLugar | null>,
  },
  casa: {
    salida: 'lugares (casa, sin la dirección)',
    canasta: CENTINELA_DE_LUGARES,
    grupos: PERMITIDO_SIN_DIRECCION_DE_LUGARES,
    rutas: {
      lugarDireccionDeCasa: 'direccion',
    } satisfies Record<string, RutaDeLugar | null>,
  },
  bibliotecas: {
    salida: 'bibliotecas',
    canasta: CENTINELA_DE_BIBLIOTECAS,
    grupos: PERMITIDO_EN_LA_PROYECCION_DE_BIBLIOTECAS,
    rutas: {
      bibliotecaDescripcion: 'descripcion',
      bibliotecaDireccion: 'direccion',
      bibliotecaContacto: 'contactoDeQuienCargo.valor',
      bibliotecaMotivo: 'revision.motivo',
      bibliotecaPendiente: null,
      storagePath: 'imagenes.storagePath',
      createdBy: 'revision.porUid',
    } satisfies Record<string, RutaDeBiblioteca | null>,
  },
} satisfies Record<string, ComparacionDeLaGuia>;


/**
 * Las diferencias entre una canasta del gate y la de acá que **son a propósito**,
 * con su motivo. Una diferencia sin motivo es la desincronización que B-1761
 * vino a frenar; una declarada que ya no difiere, un permiso colgado.
 *
 * MUTACIÓN PROBADA: sacar `'bio'` de la canasta del detalle del gate, o vaciar
 * la de la cartelera, pone en rojo el `it` de esa salida nombrando el campo.
 *
 * `rutas` es la traducción de nombres: la de una actividad por defecto, o la de
 * una colección de la Guía (`RUTA_EN_LA_GUIA`, B-1812).
 */
export type Diferencia = { clave: string; porque: string };


export const canastaDelGateCoincide = (
  canastaDelGate: readonly string[],
  grupos: readonly { centinelas: readonly string[] }[],
  diferencias: readonly Diferencia[] = [],
  rutas: Record<string, string | null> = RUTA_DEL_CENTINELA_DEL_GATE,
): void => {
  const permitidas = new Set(grupos.flatMap((g) => g.centinelas));
  const aProposito = new Set(diferencias.map((d) => d.clave));
  const distintas: string[] = [];
  for (const [clave, ruta] of Object.entries(rutas)) {
    if (ruta === null) continue;
    const enElGate = canastaDelGate.includes(clave);
    const aca = permitidas.has(ruta);
    if (enElGate === aca) continue;
    if (!aProposito.has(clave)) {
      distintas.push(
        `${clave} (${ruta}): el gate ${enElGate ? 'lo permite' : 'lo prohíbe'} y este barrido ` +
          `${aca ? 'lo permite' : 'lo prohíbe'}`,
      );
    }
  }
  expect(
    distintas,
    'la canasta del gate (scripts/gate-build/semilla.mjs) y la de este barrido no dicen lo ' +
      'mismo: declaralo en las dos, o anotá la diferencia con su motivo',
  ).toEqual([]);
  const colgadas = diferencias
    .map((d) => d.clave)
    .filter((clave) => {
      const ruta = rutas[clave];
      return !ruta || canastaDelGate.includes(clave) === permitidas.has(ruta);
    });
  expect(colgadas, 'diferencias declaradas que ya no difieren').toEqual([]);
};


// ───────────────────────────────────────────────────────────────────────────
// Las excepciones: lo que SÍ debe salir, agrupado y con su motivo.
// La mecánica del barrido vive en `tests/fixtures/barrido.ts`; acá está el
// criterio, que es lo que se escribe a mano y se justifica una por una.
// ───────────────────────────────────────────────────────────────────────────

/**
 * §5.2 + D-125/D-126/D-127 — lo que la **proyección** de una actividad publica.
 *
 * **Se llamaba `PERMITIDO_EN_EVENTS_JSON` y el nombre estaba mal**, y lo cobró el
 * `auditor-privacidad` sobre B-181: lo que se barre acá es `toPublic`, no el
 * archivo `dist/events.json` — ése es el **índice** recortado de B-106
 * (`entradaDeIndice`, con su propia lista más abajo) y publica bastante menos.
 * Esa diferencia de nombre ya hizo escribir un aserto falso en el gate del build,
 * así que arreglar la prosa y dejar la etiqueta era dejar puesta la trampa: lo que
 * un rojo **imprime** ahora dice «proyección de la actividad (toPublic)».
 *
 * Nueve grupos. Lo que **no** está acá y por eso el barrido lo exige ausente:
 * `difusion.*`, `createdBy`/`updatedBy`, `sesiones.calendarEventId`,
 * `imagenes[].storagePath`, `online.url` y la URL del material privado.
 */
export const PERMITIDO_EN_LA_PROYECCION: readonly Excepcion[] = [
  {
    nombre: 'identidad',
    centinelas: ['titulo', 'descripcion', 'slug', 'searchText'],
    porque:
      'es la actividad: el título y la descripción son lo que el listado muestra, el ' +
      'slug es la URL de la página de detalle (§7, trampa 10) y el searchText es el ' +
      'índice de la búsqueda en memoria del §6 — viaja entero al JSON (quinta fila de D-126).',
  },
  {
    nombre: 'galería',
    centinelas: [
      'imagenes.id',
      'imagenes.url',
      'imagenes.epigrafe',
      'imagenes.textoAlternativo',
    ],
    porque:
      'la URL es lo que el navegador va a pedir igual y el epígrafe se muestra debajo ' +
      'de la foto (D-125); el id identifica la fila de la galería y es a lo que apunta ' +
      '`portada`, no es contenido. **`textoAlternativo` está permitido por adelantado** ' +
      '(B-301, D-440): viaja en esta proyección y hoy NO llega a ninguna salida — el ' +
      'archivo que se sirve es el índice, y el `alt` de la página lo sigue armando la ' +
      'plantilla con el título. Va a poder salir cuando `detallePublico.ts` lo ' +
      'proyecte, porque el `alt` se pinta del lado del sitio y el sitio no lee ' +
      'Firestore (§2.5); ese cambio tiene que decidir además el JSON-LD y el ' +
      '`og:image:alt`. Lo dejó dicho así el `auditor-privacidad`. `storagePath` NO ' +
      'está en esta lista: es la ruta interna del bucket (§5.1).',
  },
  {
    nombre: 'quién',
    centinelas: [
      'organizador.nombre',
      'organizador.instagram',
      'organizador.web',
      'tallerista.nombre',
      'tallerista.bio',
      'tallerista.instagram',
    ],
    porque:
      'quién organiza y quién está al frente, con sus redes: es cómo se llega a ellos, ' +
      'y son datos de trabajo publicados a propósito (§5.2).',
  },
  {
    nombre: 'la obra presentada',
    centinelas: ['libro.titulo', 'libro.autor'],
    porque:
      'DEC-1 / D-126, primera fila de su tabla del paso 0: es el dato central de una ' +
      'presentación, del mismo orden que el título de la actividad, y quien busca la ' +
      'obra tiene que encontrar la actividad.',
  },
  {
    nombre: 'encuentros',
    centinelas: ['sesiones.id', 'sesiones.tema', 'sesiones.lectura'],
    porque:
      'el tema y la lectura de cada encuentro son la mitad del valor de un ciclo (§2.2); ' +
      'el id es el uuid del §3.1 con el que el sitio identifica la fila, no contenido. ' +
      '`calendarEventId` NO está: es interno (§5.1).',
  },
  {
    nombre: 'opciones para sumarse',
    centinelas: ['comisiones.id', 'comisiones.etiqueta'],
    porque:
      'B-181 — la etiqueta es lo que se muestra («Martes 19 h»): sin ella la página no ' +
      'puede decir qué opciones hay, que es el punto del campo. El **id** sale por lo ' +
      'mismo que `modalidades.id`: es el uuid con el que el **build** ata cada encuentro ' +
      'a su grupo, no contenido. El `comisionId` de cada sesión es ese mismo valor: por ' +
      'eso no tiene centinela propio (ver `RUTAS` en el fixture) — y por eso mismo, **un ' +
      'rojo que nombre `comisiones.id` puede ser en realidad una fuga de ' +
      '`sesiones[].comisionId`**: antes de ampliar esta celda conviene mirar cuál de los ' +
      'dos se escapó. Lo señaló el `auditor-privacidad`. ' +
      '**OJO con el nombre de esta lista:** lo que se barre acá es la **proyección** ' +
      '(`toPublic`), no el archivo `dist/events.json` — ése es el índice recortado de ' +
      'B-106 (`entradaDeIndice`) y **no lleva ninguna de las dos rutas**, porque el ' +
      'listado no agrupa. Esa confusión ya hizo escribir un aserto falso en el gate del ' +
      'build, así que la ausencia en el índice tiene su propio caso, más abajo.',
  },
  {
    nombre: 'dónde',
    centinelas: [
      'sede.nombre',
      'sede.direccion',
      'sede.provincia',
      'sede.ciudad',
      'sede.indicaciones',
    ],
    porque:
      'sin la dirección y el cómo llegar nadie llega: es el punto de una actividad ' +
      'presencial. Salen dos veces —adentro de su fila de `modalidades` y en la sede ' +
      'derivada— porque son el mismo dato: el barrido cuenta presencia, no ocurrencias. ' +
      '**`sede.provincia` entró con B-950** y sale por lo mismo que la ciudad: es el ' +
      'primer nivel de la cascada de filtros del sitio, así que sin él el riel no puede ' +
      'ofrecer «provincia → barrio o ciudad». Como la ciudad, es una etiqueta ' +
      'geográfica: no dice nada de nadie.'
  },
  {
    nombre: 'formas de cursar',
    centinelas: ['modalidades.id'],
    porque:
      'B-224 — el id es el uuid del §3.1 con el que el sitio identifica la fila, no ' +
      'contenido; es lo mismo que `sesiones.id` e `imagenes.id`. Las **fechas** de la ' +
      'fila NO están en esta lista y tampoco tienen centinela (un `Timestamp` no puede ' +
      'llevarlo): que no salgan lo afirma `tests/modalidades.test.ts` buscándolas por su ' +
      'valor.',
  },
  {
    nombre: 'taxonomías, como slug',
    centinelas: ['sede.barrio', 'arancel.tipo', 'online.plataforma', 'tags', 'incluye'],
    porque:
      '§4.1/§4.4 — la actividad guarda el slug y el JSON lo lleva crudo: la web arma los ' +
      'chips de filtro resolviéndolo contra `opciones`, que viajan en el mismo archivo. ' +
      'A diferencia del evento de Calendar, acá no se resuelve la etiqueta. ' +
      '**`incluye` entró con B-830** y es la única de las cinco que **no** es eje de ' +
      'filtro: sale por esta proyección porque la consume la página de detalle, que ' +
      'recibe una `ActividadPublica`. En el **índice** no está —`entradaDeIndice` recorta ' +
      'más a propósito— y eso tiene su propio caso más abajo.',
  },
  {
    nombre: 'inscripción y arancel',
    centinelas: ['inscripcion.destino', 'arancel.notas'],
    porque:
      'el destino es el canal de inscripción y sale incluso con el cupo completo, por ' +
      'decisión del dueño (D-127); las notas del arancel son las condiciones ' +
      '(«2 cuotas», «incluye material»). El §5.1 advierte que un WhatsApp personal en ' +
      'el destino queda expuesto a bots: es público a propósito, no por descuido.',
  },
  {
    nombre: 'material',
    centinelas: ['material.titulo.publico', 'material.titulo.privado', 'material.url.publico'],
    porque:
      '§5.2 — de un item sobreviven siempre tipo y título; la URL solo con ' +
      '`publico: true`. Los dos títulos están acá y una sola URL: es la única entrada ' +
      'de esta lista que distingue dos items del mismo campo.',
  },
];


/**
 * §5.1 + §7.4 — lo que la descripción del evento de Calendar publica.
 *
 * Igual que arriba **menos** el slug, el `searchText` y la galería (el evento no
 * los lleva), y **más** las etiquetas de `/opciones/*`.
 */
export const PERMITIDO_EN_EVENTO_DE_CALENDAR: readonly Excepcion[] = [
  {
    nombre: 'identidad',
    centinelas: ['titulo', 'descripcion'],
    porque:
      '§7.4 — el título es el `summary` del evento y la descripción, su primer bloque. ' +
      'El slug y el searchText NO están: el evento no es una página, no tiene para qué ' +
      'llevar la URL ni el índice de búsqueda.',
  },
  {
    nombre: 'quién',
    centinelas: [
      'organizador.nombre',
      'organizador.instagram',
      'organizador.web',
      'tallerista.nombre',
      'tallerista.bio',
      'tallerista.instagram',
    ],
    porque: 'el bloque «Organiza / Invitado» del §7.4: lo mismo que publica el JSON, y por lo mismo.',
  },
  {
    nombre: 'la obra presentada',
    centinelas: ['libro.titulo', 'libro.autor'],
    porque:
      'DEC-1 / D-126, segunda fila: «presentación de tal libro» es el dato central del ' +
      'evento. Va adentro de `construirDescripcion` a propósito, para que entre al ' +
      'payload de la guarda anti-loop y propague a las N sesiones (trampa 9, D-07).',
  },
  {
    nombre: 'este encuentro',
    centinelas: ['sesiones.tema', 'sesiones.lectura'],
    porque:
      'el tema va también en el `summary` («Título — Tema»): es lo que distingue un ' +
      'encuentro del siguiente en la agenda de quien se suscribió. El id de sesión NO ' +
      'está: el evento no lo lleva (lo lleva el documento, en `calendarEventId`).',
  },
  {
    nombre: 'de qué opción es',
    centinelas: ['comisiones.etiqueta'],
    porque:
      'B-181, decisión del dueño: el calendario publica **todas** las opciones y cada ' +
      'evento dice de cuál es, en el `summary` («Club de Saer — Martes 19 h») y en el ' +
      'encabezado de la descripción. Sin eso, dieciséis eventos con el mismo título no ' +
      'dejan elegir a qué suscribirse. La etiqueta la escribe el dueño para mostrarla, ' +
      'igual que el título. **`comisiones.id` NO está en esta lista**: el evento no ' +
      'lleva ids, lo mismo que pasa con `sesiones.id`.',
  },
  {
    nombre: 'dónde',
    centinelas: ['sede.nombre', 'sede.direccion', 'sede.indicaciones'],
    porque:
      'el bloque «Dónde» y el campo `location` del evento, que es lo que dibuja el mapa. ' +
      'Salen además dentro del link de Google Maps, escapados con encodeURIComponent. ' +
      '**`sede.ciudad` salió de esta lista con B-950**: dejó de ser texto libre, así que ' +
      'ahora el evento la resuelve a su etiqueta como venía haciendo con el barrio, y lo ' +
      'que sale está en la lista de abajo. Si el slug crudo vuelve a aparecer acá es que ' +
      'la resolución se salteó, que es exactamente lo que este cambio de lista fija.',
  },
  {
    nombre: 'etiquetas de /opciones',
    centinelas: [
      'labels.tipo',
      'labels.barrio',
      // B-950 — las dos de la geografía. `provincia` es nueva en la dirección
      // (es la que hace geocodificable una sede de afuera de CABA) y `ciudad`
      // pasó de texto libre a slug, así que se resuelve igual que el barrio.
      'labels.provincia',
      'labels.ciudad',
      'labels.plataforma',
      'labels.arancel',
      'labels.tags',
    ],
    porque:
      '§4.1 — la actividad guarda el slug y el evento muestra la **etiqueta**: ' +
      '"a-la-gorra" crudo en un calendario público se ve roto. `/opciones/*` es de ' +
      'lectura pública (§5.3), así que la etiqueta no agrega nada privado. Los siete ' +
      'slugs correspondientes NO están permitidos acá: si aparecen es que la resolución ' +
      'se salteó.',
  },
  {
    nombre: 'inscripción y arancel',
    centinelas: ['inscripcion.destino', 'arancel.notas'],
    porque:
      'D-127 — el canal sigue saliendo con el cupo completo, con el cartel al lado: ' +
      'siempre hay lista de espera y esconderlo convierte una baja en un lugar que se ' +
      'pierde. Las notas del arancel son las condiciones de la inscripción.',
  },
  {
    nombre: 'material',
    centinelas: ['material.titulo.publico', 'material.titulo.privado', 'material.url.publico'],
    porque: '§5.1 — solo tipo y título del item privado; la URL únicamente con `publico: true`.',
  },
];


/**
 * §6 + quinta fila de D-126/D-127 — el `searchText` es una salida pública **por
 * la puerta de atrás**: se guarda en el documento y viaja entero al
 * `events.json`. Se barre aparte porque su lista es más corta que la del JSON.
 */
export const PERMITIDO_EN_SEARCH_TEXT: readonly Excepcion[] = [
  {
    nombre: 'lo que alguien tipea para encontrar la actividad',
    centinelas: [
      'titulo',
      'descripcion',
      'sede.nombre',
      'sede.barrio',
      'organizador.nombre',
      'tallerista.nombre',
      'libro.titulo',
      'libro.autor',
    ],
    porque:
      '§6 y `CAMPOS_DE_SEARCH_TEXT` — son las formas en que alguien llega a una ' +
      'actividad: por su nombre, por el barrio, por quién la da, o por la obra que se ' +
      'presenta (D-126). Todo lo demás queda afuera: cada campo que entra acá se ' +
      'publica en el JSON de toda visita, incluido el de una actividad cuyo detalle ' +
      'nadie abrió.',
  },
];


/**
 * B-98 — el motivo de un encuentro cancelado es **público a propósito**, y solo
 * con el encuentro cancelado: es el anuncio que reemplaza al borrado del evento
 * (§7.3). En el fixture base los encuentros están vivos y el motivo cargado no
 * sale a ningún lado; esta excepción se suma solo en los casos cancelados.
 */
export const MOTIVO_DE_CANCELACION: Excepcion = {
  nombre: 'el motivo de la cancelación',
  centinelas: ['sesiones.motivoCancelacion'],
  porque:
    'B-98 — decisión del dueño (2026-08-26): cancelar un encuentro lo anuncia en vez de ' +
    'borrarlo, «con el motivo de cancelación incluido». Es lo que distingue «se pasa al jueves» ' +
    'de «se cancela por falta de inscriptos». Solo con `cancelada: true` (`motivoDeCancelacion`).',
};
