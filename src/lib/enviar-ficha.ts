/**
 * **Mandar una ficha a la Guía desde el sitio público** — `/guia/<x>/sumar`.
 *
 * Es el pegamento con Firestore de los tres formularios de directorio, y vive
 * aparte de los componentes por el mismo corte de siempre: lo que se puede
 * decidir sin red está en `{libreria,suscripcion-literaria,lugar}-schema.ts`
 * (puros), acá queda lo que habla con Firestore.
 *
 * ── Este módulo se carga con `import()` y **nunca** estáticamente ──────────
 * El motivo es el de `lib/enviar-propuesta.ts` y no cambia: `app()` es el borde
 * donde App Check se inicializa (B-836), así que importarlo desde el árbol
 * estático de una página haría que el desafío de reCAPTCHA Enterprise —un
 * tercero de Google, con cuota facturable por visitante— cargue para cualquiera
 * que **mire** la página, haya o no tocado el formulario. Cargándolo en el
 * submit, el tercero entra cuando la persona **decide mandar** algo. Lo hace
 * cumplir `tests/panel-fuera-del-sitio.test.ts`.
 *
 * ── Por qué los tres están en un archivo y no en `librerias.ts` ───────────
 * Porque `lib/librerias.ts`, `lib/lugares.ts` y el resto son del **panel**:
 * traen el `onSnapshot`, la conversión inversa, el `moverX` de la bandeja y la
 * verificación de slug. Importar cualquiera de ellos desde el sitio arrastraría
 * todo eso al bundle de una página pública para usar una función de tres líneas.
 * Acá está solo lo que el formulario público necesita: **crear**.
 *
 * Y están los tres juntos, y no uno por entidad, porque lo único que cambia
 * entre ellos es el nombre de la colección y qué `formAX` se llama: tres
 * archivos de quince líneas serían tres lugares donde olvidarse del
 * `serverTimestamp()`.
 *
 * ── Lo que este archivo NO decide ────────────────────────────────────────
 * Ni el `estado` inicial ni la `revision`: los fuerza `firestore.rules`. Salen
 * de `formAX` con el valor que la regla va a exigir igual, que es lo que hace
 * que el documento pase — pero **la garantía es de la regla**, porque un valor
 * en un módulo de TypeScript no le impide nada a nadie (§ 1 del `prd/README.md`:
 * «si lo decide el cliente, un `curl` publica»).
 */
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firestore-client';
import { formALibreria } from '@/lib/libreria-schema';
import { formASuscripcion } from '@/lib/suscripcion-literaria-schema';
import { formALugar } from '@/lib/lugar-schema';
import type { LibreriaForm } from '@/types/libreria';
import type { SuscripcionLiterariaForm } from '@/types/suscripcion-literaria';
import type { LugarForm } from '@/types/lugar';

/**
 * El sentinel, tipado como el `Timestamp` que va a quedar.
 *
 * **Y no `new Date()`**, que es la trampa que este alias existe para no tener a
 * mano: `cargadoEn` es la fecha que se publica al lado del precio (DEC-12,
 * B-837), y la regla exige `== request.time`. Un reloj de navegador la haría
 * rechazar —o, si la regla algún día se aflojara, publicaría una fecha que quien
 * carga puede elegir, que es justo lo que DEC-12 decidió que no—.
 */
const ahoraDelServidor = () => serverTimestamp() as unknown as never;

/**
 * Manda una librería. Devuelve el id, que no se le muestra a nadie: sirve para
 * el log de un fallo y para el test.
 *
 * `'formulario-publico'` es el default de `formALibreria` y va **explícito**
 * igual: es la mitad del par que la regla compara contra `!esAdmin()`, y un
 * default que se puede mover en otro archivo no es el lugar donde se lee de qué
 * lado de la puerta está esta llamada.
 */
export const enviarLibreria = async (f: LibreriaForm): Promise<string> => {
  const ref = await addDoc(collection(db(), 'librerias'), {
    ...formALibreria(f, 'formulario-publico'),
    // La regla exige `creadoEn == request.time`: así nadie antedata su ficha.
    creadoEn: serverTimestamp(),
  });
  return ref.id;
};

/**
 * Manda una suscripción literaria.
 *
 * Es la única de las tres que además lleva un **precio**, y por eso recibe el
 * reloj del servidor dos veces: `creadoEn` y el `cargadoEn` del precio. Los dos
 * los verifica la regla contra `request.time`.
 */
export const enviarSuscripcion = async (f: SuscripcionLiterariaForm): Promise<string> => {
  const ref = await addDoc(collection(db(), 'suscripciones'), {
    ...formASuscripcion(f, ahoraDelServidor(), 'formulario-publico'),
    creadoEn: serverTimestamp(),
  });
  return ref.id;
};

/**
 * Manda un lugar para eventos.
 *
 * ⚠️ **`formALugar` fuerza `direccionPublica: false` cuando el origen es el
 * formulario público** (§ 6 del PRD 4), y por eso el tercer argumento no es
 * decorativo. Pero esa es la mitad que se saltea con un `curl`: la que sostiene
 * la promesa es `lugarDeGuiaValido()` en `firestore.rules`, con
 * `d.origen != 'formulario-publico' || d.direccionPublica == false`. Las dos
 * mitades, como siempre.
 */
export const enviarLugar = async (f: LugarForm): Promise<string> => {
  const ref = await addDoc(collection(db(), 'lugares'), {
    ...formALugar(f, ahoraDelServidor(), 'formulario-publico'),
    creadoEn: serverTimestamp(),
  });
  return ref.id;
};
