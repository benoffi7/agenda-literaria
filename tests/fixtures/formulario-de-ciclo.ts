import { formVacio, modalidadVacia } from '@/lib/formulario/estadoInicial';
import { sesionVacia } from '@/lib/sesiones';
import type { ActividadForm } from '@/types/actividad';

/**
 * **El `ActividadForm` de un ciclo, como lo escribe el panel** — B-215.
 *
 * ── Qué duplicación cierra, medida y no supuesta ──────────────────────────
 * Tres archivos armaban casi el mismo formulario: `duplicar.test.ts`,
 * `actividades.integracion.test.ts` y `vistaPreviaEvento.test.ts`, con **20 a 25
 * líneas idénticas entre cada par**. El mismo club de lectura, la misma Casa
 * Brandon, el mismo arancel a la gorra.
 *
 * Y el costo no era hipotético: **el comentario de B-224 estaba copiado en los
 * tres**. O sea que cuando `sede`/`online` pasaron a ser una fila de
 * `modalidades[]`, esa migración se pagó tres veces — que es exactamente lo que
 * B-215 decía que iba a pasar.
 *
 * ── Lo que este fixture NO trae, y es la parte importante ─────────────────
 * **Solo el andamiaje inerte**: quién organiza, dónde se cursa, cuánto sale, el
 * tipo y el título. Nada de lo que un test **afirma** viene de acá.
 *
 * `tests/fixtures/ciclo.ts` ya dejó escrita la lección que esto respeta: «la
 * clase de bug más caro de este repo es un test que pasa porque su fixture no
 * ejercita el caso normal del dominio». Un fixture que trajera
 * `inscripcion.completo: true` por default rompería justo eso: `duplicar.test.ts`
 * verifica que la copia **no herede** el cupo completo (B-97), y si ese `true`
 * viniera de acá, cambiar el default del fixture haría que ese chequeo **pase por
 * vacío** sin que nada se ponga en rojo.
 *
 * Así que la regla es: **el valor sobre el que un test afirma se escribe en ese
 * test**, con su comentario, aunque quede repetido entre dos archivos. Lo que se
 * comparte es lo que ninguno mira.
 *
 * Por eso `sesiones`, `inscripcion`, `material`, `difusion`, `estado`, `tags` y
 * `destacado` **no** están abajo: los tres archivos declaran los suyos, y los
 * declaran distintos porque cada uno prueba otra cosa —tres martes con un salto
 * irregular en `duplicar`, dos con tema en la integración, uno solo en la vista
 * previa—.
 *
 * ── Por qué no alcanzaba `formularioLleno` ────────────────────────────────
 * Porque `tests/fixtures/formulario.ts` es el fixture de **centinelas**: cada
 * campo lleva un `CENTINELA.*` para que el barrido de privacidad los detecte al
 * salir. Sirve para eso y no para leer un aserto: `expect(texto).toContain(...)`
 * contra `CENTINELA.titulo` no dice nada de lo que la pantalla muestra. Son dos
 * fixtures con dos trabajos, y confundirlos era la mitad del malentendido de este
 * ítem.
 */
export const formDeCiclo = (over: Partial<ActividadForm> = {}): ActividadForm => ({
  ...formVacio(),
  tipo: 'club-lectura',
  titulo: 'Club de lectura latinoamericana',
  slug: 'club-latinoamericana',
  descripcion: 'Ocho encuentros por narrativa del boom y después.',
  imagenes: [],
  organizador: { nombre: 'Casa Brandon', instagram: '@casabrandon', web: '' },
  tallerista: { nombre: 'María Moreno', bio: 'Cronista', instagram: '@mmoreno' },
  libro: { titulo: '', autor: '' },
  esCiclo: true,
  /*
   * B-224 — una fila híbrida: el mismo lugar de antes, ahora adentro de la forma
   * de cursar. `modalidad`, `sede` y `online` son derivados y los escribe
   * `formADocumento`.
   *
   * **Este bloque es el motivo por el que el fixture existe.** Eran estas
   * dieciocho líneas, iguales en tres archivos, las que hubo que migrar tres
   * veces cuando el modelo cambió.
   */
  modalidades: [
    {
      ...modalidadVacia('hibrido'),
      id: 'mod_a',
      sede: {
        nombre: 'Casa Brandon',
        direccion: 'Drago 236',
        barrio: 'villa-crespo',
        ciudad: 'CABA',
        indicaciones: 'Timbre 2',
        geo: null,
      },
      online: { plataforma: 'zoom', url: 'https://zoom.us/j/secreto', urlPublica: false },
    },
  ],
  arancel: { tipo: 'a-la-gorra', notas: 'incluye material' },
  ...over,
});

/** Una sesión del ciclo, con los defaults del formulario. */
export const sesionDeCiclo = (over: Partial<ActividadForm['sesiones'][number]> = {}) => ({
  ...sesionVacia(),
  ...over,
});
