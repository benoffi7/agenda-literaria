/**
 * **Los dos roles del panel, del lado que no es la frontera** — B-888, tajada 2.
 *
 * La frontera es `firestore.rules` y `storage.rules`, y la prueban
 * `rol-publicador.integracion.test.ts` y `storage-reglas.integracion.test.ts`
 * contra el emulador. Este archivo prueba lo otro, que también hace falta y que
 * la tajada 1 dejó dicho: **que la pantalla no se rompa y que no ofrezca lo que
 * las reglas van a rechazar**. Un botón que siempre falla es peor que no tenerlo.
 *
 * Tres cosas, y las tres son de clase y no de instancia:
 *
 *  1. el desempate de los dos claims dice lo **mismo** que la regla;
 *  2. ninguna pantalla del panel se olvida de decidir quién la ve;
 *  3. y cada pantalla que el publicador no tiene está gateada en `AdminApp`.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { sinComentarios } from '../scripts/sin-comentarios.mjs';
import {
  PANTALLAS_DEL_PANEL,
  PERMISOS,
  ROLES_DEL_PANEL,
  puedeVer,
  rolDeClaims,
  type PantallaDelPanel,
} from '@/lib/rolDelPanel';

const raiz = (rel: string): string => `${process.cwd()}/${rel}`;
const ADMIN_APP = readFileSync(raiz('src/components/admin/AdminApp.tsx'), 'utf8');
const REGLAS = readFileSync(raiz('firestore.rules'), 'utf8');

describe('rolDeClaims — el desempate es el mismo que el de la regla (D-650)', () => {
  it('con un solo claim devuelve ese rol, y sin ninguno devuelve null', () => {
    expect(rolDeClaims({ admin: true })).toBe('admin');
    expect(rolDeClaims({ publicador: true })).toBe('publicador');
    expect(rolDeClaims({})).toBeNull();
    expect(rolDeClaims(null)).toBeNull();
    // Un claim que no es `true` no es un rol: el mismo `== true` de la regla.
    expect(rolDeClaims({ admin: 'si' })).toBeNull();
    expect(rolDeClaims({ publicador: 1 })).toBeNull();
  });

  it('con los DOS claims gana el acotado, igual que `esAdmin()` en las reglas', () => {
    /*
     * Cada regla se lee `esAdmin() || (esPublicador() && …)` y `||`
     * cortocircuita, así que la regla exige además **no** ser publicador: un
     * token con los dos cae del lado acotado. Si acá ganara el admin, el panel le
     * dibujaría las diez pantallas a una cuenta que las reglas tratan como
     * acotada, y cada botón sería un `permission-denied`.
     *
     * MUTACIÓN PROBADA: invertir el orden de los dos `if` de `rolDeClaims` deja
     * este caso en rojo.
     */
    expect(rolDeClaims({ admin: true, publicador: true })).toBe('publicador');
  });

  it('y la regla sigue diciendo lo mismo — si no, este par se separa en silencio', () => {
    /*
     * Las dos mitades son cosas distintas —una decide qué se dibuja, la otra qué
     * se puede escribir— y tienen que coincidir. Se afirma sobre el **texto de la
     * regla** porque es la única forma de que un cambio allá ponga esto en rojo:
     * es la clase de B-88, dos derivaciones de la misma idea.
     *
     * MUTACIÓN PROBADA: sacar el `&& !esPublicador()` de `esAdmin()` en
     * `firestore.rules` deja este caso en rojo.
     */
    const esAdmin = REGLAS.slice(REGLAS.indexOf('function esAdmin()'));
    expect(esAdmin.slice(0, esAdmin.indexOf('}')).replace(/\s+/g, ' ')).toContain(
      '&& !esPublicador();',
    );
  });
});

describe('PERMISOS — ninguna pantalla se olvida de decidir quién la ve', () => {
  it('la lista de pantallas es la de las vistas que `AdminApp` sabe montar', () => {
    /*
     * **Chequeo de clase, y la lista se deriva del fuente** (§"Verificar la clase,
     * no la instancia"): los `tipo:` del tipo `Vista` de `AdminApp.tsx`. Una vista
     * nueva que no esté en `PANTALLAS_DEL_PANEL` pone esto en rojo, así que no
     * puede nacer sin que alguien decida quién la ve — que es el momento en que
     * conviene decidirlo, no un mes después.
     *
     * MUTACIÓN PROBADA: agregar `| { tipo: 'inventada' }` al tipo `Vista` deja
     * este caso en rojo nombrando la vista.
     */
    const tipoVista = ADMIN_APP.slice(ADMIN_APP.indexOf('type Vista ='));
    const cuerpo = tipoVista.slice(0, tipoVista.indexOf('\n\n/**'));
    const vistas = [...cuerpo.matchAll(/tipo:\s*'([a-z]+)'/g)].map((m) => m[1]);

    // Control positivo: si el barrido dejara de encontrarlas —porque alguien
    // cambió la forma del tipo— la comparación de abajo pasaría sin mirar nada.
    expect(vistas.length, 'no se encontraron las vistas de AdminApp').toBeGreaterThan(8);
    expect([...new Set(vistas)].sort()).toEqual([...PANTALLAS_DEL_PANEL].sort());
  });

  it('el admin las ve todas y el publicador un subconjunto propio', () => {
    expect(PERMISOS.admin.pantallas).toEqual(PANTALLAS_DEL_PANEL);
    for (const p of PERMISOS.publicador.pantallas) {
      expect(PANTALLAS_DEL_PANEL, `«${p}» no es una pantalla del panel`).toContain(p);
    }
    // Control negativo: si el publicador las viera todas, el resto del archivo
    // pasaría sin verificar nada.
    expect(PERMISOS.publicador.pantallas.length).toBeLessThan(PANTALLAS_DEL_PANEL.length);
  });

  it('el publicador no ve ninguna de las cinco que las reglas le cierran', () => {
    /*
     * Cada una está cerrada **en las reglas** por un motivo propio (el mail de
     * otra cuenta, el contacto de un tercero, la taxonomía compartida, las
     * consultas de Google, la subcolección que no hereda). Acá se afirma que la
     * UI dice lo mismo: no es la frontera, es no ofrecer lo que va a fallar.
     */
    for (const p of ['reportes', 'propuestas', 'taxonomias', 'estadisticas', 'historial'] as const) {
      expect(puedeVer('publicador', p), `el publicador ve «${p}»`).toBe(false);
      expect(puedeVer('admin', p)).toBe(true);
    }
  });

  it('y sí ve su listado, el calendario y las tres de cargar', () => {
    // El control positivo del caso de arriba: sin esto, `pantallas: []` lo pasaría.
    for (const p of ['lista', 'calendario', 'nueva', 'editar', 'duplicar'] as const) {
      expect(puedeVer('publicador', p), `el publicador NO ve «${p}»`).toBe(true);
    }
  });

  it('los dos permisos de escritura del publicador son los que las reglas le niegan', () => {
    // `veTodoElCatalogo` decide la forma de la query del listado (trampa 7) y
    // `escribeTaxonomias` decide si el guardado intenta tocar `/opciones/*`.
    expect(PERMISOS.publicador.veTodoElCatalogo).toBe(false);
    expect(PERMISOS.publicador.escribeTaxonomias).toBe(false);
    expect(PERMISOS.publicador.leeElDirectorio).toBe(false);
    expect(PERMISOS.admin.veTodoElCatalogo).toBe(true);
    expect(PERMISOS.admin.escribeTaxonomias).toBe(true);
    expect(PERMISOS.admin.leeElDirectorio).toBe(true);
  });
});

describe('el gating de `AdminApp` — la pantalla que no corresponde no tiene puerta', () => {
  /**
   * Las pantallas a las que se entra por un **botón del encabezado**: son las
   * únicas cuya puerta vive en `AdminApp.tsx`. Las otras se alcanzan desde
   * adentro de una pantalla (el formulario desde el listado, `convertir` desde la
   * bandeja), así que su gating es el de su origen.
   */
  const CON_BOTON_PROPIO: PantallaDelPanel[] = [
    'taxonomias',
    'estadisticas',
    'propuestas',
    'reportes',
    // B-901 / B-832 — la Guía. `libreria` y `suscripcion` (los formularios) no
    // entran: se alcanzan desde adentro de su bandeja, así que su gating es el de
    // su origen.
    'librerias',
    'suscripciones',
  ];

  it('cada una de esas puertas está envuelta en `puedeVer`', () => {
    /*
     * **Esto es lo que hace que esconder no se olvide.** Sin el chequeo, la
     * pantalla nueva que alguien agregue mañana nace con su botón visible para el
     * publicador, y el síntoma es un `permission-denied` en una pantalla que no
     * tendría que haber podido abrir.
     *
     * MUTACIÓN PROBADA: sacarle el `puedeVer(rol, 'propuestas') &&` a la puerta de
     * la bandeja deja este caso en rojo nombrando la pantalla, y ningún otro caso
     * del archivo se mueve.
     */
    for (const pantalla of CON_BOTON_PROPIO) {
      expect(puedeVer('publicador', pantalla), `«${pantalla}» ya no está cerrada`).toBe(false);
      expect(ADMIN_APP, `la puerta de «${pantalla}» no pasa por puedeVer`).toContain(
        `puedeVer(rol, '${pantalla}')`,
      );
    }
  });

  it('y el rol se fija en el store antes del primer render del panel', () => {
    /*
     * `campos-del-panel.tsx` decide con el store si ofrece «Otro…», y lo lee en el
     * render. Si `fijarRolActivo` corriera después de `setCargando(false)`, el
     * formulario se dibujaría una vez con el default permisivo — o sea ofreciendo
     * crear una etiqueta a quien no puede.
     *
     * MUTACIÓN PROBADA: mover el `fijarRolActivo(suRol)` abajo del
     * `setCargando(false)` deja este caso en rojo.
     */
    // Sobre el fuente sin comentarios: el comentario que explica este orden
    // **nombra** `setCargando(false)`, así que un `indexOf` sobre el texto crudo
    // encontraba la explicación en vez de la línea. Pasó al escribir este caso.
    const efecto = sinComentarios(ADMIN_APP).slice(
      sinComentarios(ADMIN_APP).indexOf('observarAuth(async (u)'),
    );
    expect(efecto.indexOf('fijarRolActivo(')).toBeLessThan(efecto.indexOf('setCargando(false)'));
  });

  it('y `registrarUsuario` tiene por fin un consumidor, que es el login', () => {
    /*
     * B-888 — la tajada 1 dejó `src/lib/usuarios.ts` **sin llamador**, así que la
     * colección estaba vacía y el panel no podía mostrar ningún mail. El llamador
     * va en el observador de auth y no en un botón: es lo que hace que el mail no
     * envejezca (D-650), porque se refresca en cada login.
     *
     * MUTACIÓN PROBADA: borrar el `import('@/lib/usuarios')` de `AdminApp.tsx`
     * deja este caso en rojo.
     */
    const efecto = ADMIN_APP.slice(ADMIN_APP.indexOf('observarAuth(async (u)'));
    expect(efecto).toContain("import('@/lib/usuarios')");
    expect(efecto).toContain('registrarUsuario(u.uid, u.email)');
  });
});

describe('los roles son dos y están nombrados en un solo lugar', () => {
  it('`ROLES_DEL_PANEL` cubre las claves de `PERMISOS`', () => {
    // Un rol nuevo en el tipo sin entrada en `PERMISOS` no compila; al revés —una
    // entrada de más— tampoco se ve sin esto.
    expect(Object.keys(PERMISOS).sort()).toEqual([...ROLES_DEL_PANEL].sort());
  });
});
