/**
 * El acceso crudo a los borradores del navegador (B-191): la clave, el almacén y
 * el borrado.
 *
 * **Está separado de `autoguardado.ts` por el corte del bundle** (B-09/D-51), y
 * es la única razón. `autoguardado.ts` importa `estadoInicial` —y con él
 * `lib/opciones`— para conocer la forma del formulario; `AdminApp.tsx`, que vive
 * en el chunk inicial del panel, solo necesita **borrar** al cerrar sesión. Si
 * importara `autoguardado.ts` para eso, se llevaría el molde del formulario y las
 * opciones a la carga inicial. Este módulo no importa nada.
 *
 * `autoguardado.ts` re-exporta lo de acá, así que sus consumidores no cambian.
 */

/** Prefijo de las claves. Uno por admin y por actividad. */
export const PREFIJO_CLAVE = 'agenda-literaria:borrador:';

/**
 * Lo mínimo de `localStorage` que hace falta.
 *
 * `length` y `key` están para poder recorrer las claves al cerrar sesión: sin
 * eso no hay forma de borrar los borradores de todas las actividades, solo el de
 * la que se estaba mirando.
 */
export interface AlmacenLocal {
  getItem: (clave: string) => string | null;
  setItem: (clave: string, valor: string) => void;
  removeItem: (clave: string) => void;
  readonly length: number;
  key: (indice: number) => string | null;
}

/**
 * El `localStorage` del navegador, o `null` si no se puede usar.
 *
 * Acceder a `localStorage` **tira** —no devuelve null— en un iframe con cookies
 * bloqueadas y en algunos modos privados, así que el acceso va adentro del
 * try/catch y no solo la escritura.
 */
export const almacenDelNavegador = (): AlmacenLocal | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
};

export const borrarBorradorLocal = (almacen: AlmacenLocal | null, clave: string): void => {
  if (!almacen) return;
  try {
    almacen.removeItem(clave);
  } catch {
    /* nada que hacer: el borrador viejo se descarta igual al leerlo */
  }
};

/**
 * Borra **todos** los borradores del navegador. Va al cerrar sesión.
 *
 * Lo guardado es contenido, y parte de ese contenido el §5.1 lo marca como
 * interno (`difusion`, `inscripcion.destino`, `online.url`). Sin esto sobrevive al
 * logout, en claro y bajo una clave predecible, hasta 30 días — y
 * `07-seguridad.md` promete que el alcance es "el mismo que la sesión del panel en
 * ese navegador". Esa promesa se cumple del lado del código, no de la prosa.
 *
 * Junta las claves antes de borrar: `removeItem` mientras se recorre por índice
 * corre las que siguen y se saltea la mitad.
 */
export const borrarTodosLosBorradores = (almacen: AlmacenLocal | null): void => {
  if (!almacen) return;
  try {
    const claves: string[] = [];
    for (let i = 0; i < almacen.length; i += 1) {
      const clave = almacen.key(i);
      if (clave?.startsWith(PREFIJO_CLAVE)) claves.push(clave);
    }
    claves.forEach((clave) => borrarBorradorLocal(almacen, clave));
  } catch {
    /* un almacén que tira no puede impedir cerrar sesión */
  }
};
