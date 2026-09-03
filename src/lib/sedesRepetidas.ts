/**
 * ¿Se repiten las sedes? — el número que B-100 necesita para poder decidirse.
 *
 * ── Por qué esto y no la funcionalidad ────────────────────────────────────
 * B-100 pide prellenar sede, organizador e inscripción desde lo ya cargado, y se
 * puso a sí mismo una condición: **«vale la pena si los datos dicen que las sedes
 * se repiten, y hoy nadie lo mide»**. Sigue sin medirse, así que la funcionalidad
 * no se hace: sería construir para un caso que nadie vio.
 *
 * Y el ítem se corrige a sí mismo en un punto que importa: dice que el
 * vocabulario de la analítica puede contestarlo, y **no puede**. `sede.nombre` es
 * texto libre, no una taxonomía, así que ningún evento lo lleva — ni debe, porque
 * es contenido y el §9 lo prohíbe. Lo único que contesta la pregunta es contar
 * los nombres de sede repetidos sobre las actividades cargadas.
 *
 * ── Por qué en el panel y no en un script ─────────────────────────────────
 * El ítem propone «un script de veinte líneas» sobre cuarenta y seis documentos.
 * Un script contesta la pregunta **una vez, para quien lo corra**, y hay que tener
 * una máquina con Node y credenciales. El tablero ya trae la colección entera a
 * memoria (`listarActividades`), así que esto es una función pura sobre lo que ya
 * está cargado: **cero lecturas nuevas de Firestore**, y la respuesta queda a la
 * vista de quien tiene que decidir, actualizándose sola.
 *
 * ── Qué se cuenta, y por qué así ──────────────────────────────────────────
 * Se cuenta **en cuántas actividades distintas** aparece cada nombre de sede, no
 * cuántas filas hay con ese nombre: una actividad con dos filas en la misma sede
 * —presencial los martes y los jueves— es *una* actividad ahí, y contarla dos
 * veces inflaría justo la señal que se está midiendo.
 *
 * El nombre se normaliza con `normalize` (el mismo del §6, importado y no
 * copiado): sin eso «Casa Brandon» y «casa brandon » son dos sedes distintas y la
 * repetición se ve más chica de lo que es — que es el error que llevaría a
 * descartar B-100 por un dato falso.
 *
 * **No se guarda ni se publica nada.** Es un cálculo de pantalla sobre datos que
 * el panel ya tiene; el nombre de la sede ya es público (sale al sitio y al
 * evento del calendario), y la cuenta no sale a ninguna parte.
 */
import { normalize } from '@/lib/normalize';

/** La forma mínima que hace falta mirar: las sedes de cada actividad. */
export interface ActividadConSedes {
  modalidades?: readonly { sede?: { nombre?: string } | null }[] | null;
  /** @deprecated Anterior a B-224, cuando la sede era una sola. Se lee igual. */
  sede?: { nombre?: string } | null;
}

export interface SedeRepetida {
  /** El nombre tal como se escribió la primera vez que aparece. */
  nombre: string;
  /** En cuántas actividades distintas aparece. */
  actividades: number;
}

/**
 * La llave con la que dos nombres de sede son «el mismo lugar».
 *
 * `normalize` baja y saca acentos (§6) pero **no toca los espacios**, así que
 * «Casa  Brandon» y «Casa Brandon» le salen distintas. Van juntas: es la misma
 * razón por la que `etiquetaPresentable` colapsa espacios en las taxonomías, y
 * acá el error se paga como una repetición que no se ve.
 */
const claveDeSede = (nombre: string): string => normalize(nombre.trim()).replace(/\s+/g, ' ');

/**
 * Los nombres de sede de **una** actividad, sin repetir, con la llave normalizada
 * y el texto tal como se escribió.
 *
 * Lee las dos formas: `modalidades[].sede.nombre` (B-224) y el `sede.nombre`
 * suelto, que es **el derivado** que publica `toPublic` —«la primera fila que
 * tenga sede», D-130— y de paso la forma del modelo anterior a B-224.
 *
 * **No es una rama de compatibilidad**, aunque lo parezca, y conviene decirlo
 * porque `modalidades.ts` dice lo contrario de su propia rama: ahí la
 * compatibilidad se sacó a propósito, porque no hay nada en producción sin
 * `modalidades[]`. Acá la segunda rama está por otra razón — el `Map` la vuelve
 * un no-op cuando las dos formas coinciden, y **abarata al llamador**: esto se
 * puede correr sobre un documento crudo o sobre una vista pública sin que quien
 * llama tenga que saber cuál tiene en la mano.
 */
const sedesDe = (a: ActividadConSedes): Map<string, string> => {
  const nombres = [
    ...(a.modalidades ?? []).map((m) => m?.sede?.nombre ?? ''),
    a.sede?.nombre ?? '',
  ];
  const mapa = new Map<string, string>();
  for (const n of nombres) {
    const limpio = (n ?? '').trim();
    if (!limpio) continue;
    const clave = claveDeSede(limpio);
    if (!mapa.has(clave)) mapa.set(clave, limpio);
  }
  return mapa;
};

/**
 * Las sedes que aparecen en **más de una** actividad, de la más repetida a la
 * menos, y a igualdad por nombre para que el orden sea estable.
 *
 * Las que aparecen una sola vez no entran: la pregunta es si se repiten, y una
 * lista con las cuarenta sedes del catálogo no la contesta, la esconde.
 */
export const sedesRepetidas = (actividades: readonly ActividadConSedes[]): SedeRepetida[] => {
  const cuenta = new Map<string, { nombre: string; actividades: number }>();
  for (const a of actividades) {
    for (const [clave, nombre] of sedesDe(a)) {
      const previo = cuenta.get(clave);
      if (previo) previo.actividades += 1;
      else cuenta.set(clave, { nombre, actividades: 1 });
    }
  }
  return [...cuenta.values()]
    .filter((s) => s.actividades > 1)
    .sort((a, b) => b.actividades - a.actividades || a.nombre.localeCompare(b.nombre, 'es'));
};

/** El resumen de una línea: es lo que contesta la pregunta de B-100. */
export interface ResumenDeSedes {
  /** Actividades que tienen al menos una sede cargada. Es el denominador. */
  conSede: number;
  /** Cuántas de esas caen en una sede que además usa otra actividad. */
  enSedeRepetida: number;
  repetidas: SedeRepetida[];
}

/**
 * El denominador importa tanto como el numerador, y es la lección de B-55
 * aplicada acá: «hay tres sedes repetidas» no dice nada sin saber sobre cuántas
 * actividades con sede. Tres sobre cinco es una cosa y tres sobre cuarenta es
 * otra, y son decisiones opuestas.
 */
export const resumenDeSedes = (actividades: readonly ActividadConSedes[]): ResumenDeSedes => {
  const repetidas = sedesRepetidas(actividades);
  const claves = new Set(repetidas.map((s) => claveDeSede(s.nombre)));
  let conSede = 0;
  let enSedeRepetida = 0;
  for (const a of actividades) {
    const sedes = sedesDe(a);
    if (sedes.size === 0) continue;
    conSede += 1;
    if ([...sedes.keys()].some((k) => claves.has(k))) enSedeRepetida += 1;
  }
  return { conSede, enSedeRepetida, repetidas };
};
