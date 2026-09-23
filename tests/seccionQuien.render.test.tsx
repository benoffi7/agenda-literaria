/**
 * **El Instagram de la actividad se corrige al salir del campo** — B-1144,
 * D-767.
 *
 * ── Qué se está fijando, y por qué un render test ─────────────────────────
 * La decisión del dueño (D-767) fue **corregir al vuelo en el formulario y no
 * frenar el publicado**. O sea que lo que hay que verificar no es una regla del
 * schema —no la hay, ésa fue justamente la alternativa descartada— sino una
 * consecuencia del DOM: qué queda escrito en el `<input>` después de salir de
 * él. Eso no se puede leer del fuente sin arriesgar un falso verde, que es lo
 * que pasó en B-202: hay que montar el componente y disparar el blur.
 *
 * ── Los cuatro casos, y cuál protege a quién ──────────────────────────────
 * 1. **Pegar la URL completa deja el handle.** Es el caso que motivó el ítem:
 *    el botón «Compartir» de Instagram pega `…/casabrandon/?igsh=…`, y es la
 *    forma real en que se copia una cuenta (B-928).
 * 2. **Un handle ya limpio no se toca** — ni se reescribe ni se marca el
 *    formulario como sucio. Si escribiera igual, tabular por encima del campo
 *    de una actividad abierta diría «tenés cambios sin guardar» y dispararía el
 *    autoguardado, que es la familia de problema que el docblock de
 *    `GaleriaEditor` ya tiene escrita.
 * 3. **Lo que el saneador no entiende se respeta tal cual.** Éste es el que
 *    protege a quien carga: `handleInstagram` devuelve `null` para «Casa
 *    Brandon / IG», y si el campo tomara ese `null` la persona perdería lo que
 *    escribió sin enterarse. Es la mitad del valor del ítem y por eso está en
 *    la red, no solo en un comentario.
 * 4. **El campo vacío sigue vacío**: ni un `null` ni un `"null"` ni un string
 *    raro. Un blur sobre un campo que nadie tocó es el evento más frecuente de
 *    todos.
 *
 * Los **dos** campos —organizador y tallerista— pasan la misma batería: son el
 * mismo dato en dos lugares, y el modo de falla clásico acá es arreglar uno y
 * olvidarse del otro.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/analytics', () => ({
  medir: vi.fn(),
  medirFuncion: vi.fn(),
  medirSeccion: vi.fn(),
  medirPanelAbierto: vi.fn(),
  registrarVersion: vi.fn(),
  analiticaHabilitada: () => false,
}));
vi.mock('@/components/admin/useOpciones', () => ({
  useOpciones: () => ({ valores: [], elegibles: [], cargando: false }),
  useLabelsTaxonomia: () => ({}),
}));

import { SeccionQuien } from '@/components/admin/formulario/SeccionQuien';
import { formADocumento } from '@/lib/actividades';
import { formVacio } from '@/lib/formulario/estadoInicial';
import type { ActividadForm } from '@/types/actividad';
import { formGuardable } from './fixtures/formulario';

afterEach(cleanup);

/**
 * El formulario de verdad, con estado: `set` tiene que llegar a la pantalla
 * para que el `value` del input sea lo que se afirma. Un `set` espiado y nada
 * más mostraría la llamada pero no el resultado, que es lo que se ve.
 *
 * `escrituras` cuenta cuántas veces se escribió el formulario, para poder
 * afirmar el caso 2 —que un blur inocuo **no** escribe—, que es invisible
 * mirando solo el valor final.
 */
function Arnes({ escrituras }: { escrituras: { n: number } }) {
  const [form, setForm] = useState<ActividadForm>(() => ({
    ...formVacio(),
    // El bloque del tallerista solo se pinta en taller o charla (§11).
    tipo: 'taller',
  }));
  return (
    <SeccionQuien
      form={form}
      set={(k, v) => {
        escrituras.n += 1;
        setForm((f) => ({ ...f, [k]: v }));
      }}
      errorDe={() => undefined}
      esTaller
      esCharla={false}
      nombrePersona="Tallerista"
    />
  );
}

/** Tipea `texto` en el campo y sale de él, que es cuando corrige. */
const tipearYSalir = (etiqueta: RegExp, texto: string): HTMLInputElement => {
  const input = screen.getByLabelText(etiqueta) as HTMLInputElement;
  fireEvent.change(input, { target: { value: texto } });
  fireEvent.blur(input);
  return input;
};

/** Los dos campos del mismo dato: el que organiza y el que está adelante. */
const CAMPOS: [quien: string, etiqueta: RegExp][] = [
  ['organizador', /^instagram del organizador/i],
  ['tallerista', /^instagram$/i],
];

describe('el Instagram del formulario se corrige al salir del campo — B-1144', () => {
  describe.each(CAMPOS)('campo del %s', (_quien, etiqueta) => {
    it('pegar el link del perfil deja el handle solo', () => {
      const escrituras = { n: 0 };
      render(<Arnes escrituras={escrituras} />);
      const input = tipearYSalir(etiqueta, 'https://www.instagram.com/casabrandon/');
      expect(input.value).toBe('casabrandon');
    });

    it('el link que pega el botón «Compartir», con su `?igsh=`, también', () => {
      const escrituras = { n: 0 };
      render(<Arnes escrituras={escrituras} />);
      const input = tipearYSalir(etiqueta, 'https://www.instagram.com/casabrandon/?igsh=MWx4bGs');
      expect(input.value).toBe('casabrandon');
    });

    it('un handle ya limpio no se toca, y el blur no escribe el formulario', () => {
      const escrituras = { n: 0 };
      render(<Arnes escrituras={escrituras} />);
      const input = screen.getByLabelText(etiqueta) as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'casabrandon' } });
      const trasTipear = escrituras.n;
      fireEvent.blur(input);
      expect(input.value).toBe('casabrandon');
      expect(
        escrituras.n,
        'un blur que no corrige nada no puede escribir el formulario: marcaría ' +
          '«cambios sin guardar» y dispararía el autoguardado',
      ).toBe(trasTipear);
    });

    it('la arroba se saca, que es como se tipea de verdad', () => {
      const escrituras = { n: 0 };
      render(<Arnes escrituras={escrituras} />);
      const input = tipearYSalir(etiqueta, '@casabrandon');
      expect(input.value).toBe('casabrandon');
    });

    it('lo que el saneador no entiende se respeta tal cual — no se borra', () => {
      const escrituras = { n: 0 };
      render(<Arnes escrituras={escrituras} />);
      const input = tipearYSalir(etiqueta, 'Casa Brandon / IG');
      expect(
        input.value,
        'perder lo que alguien escribió para castigar un formato deja a quien ' +
          'edita sin saber qué corregir (D-767)',
      ).toBe('Casa Brandon / IG');
    });

    it('un link a un posteo tampoco se convierte en handle ni se pierde', () => {
      const escrituras = { n: 0 };
      render(<Arnes escrituras={escrituras} />);
      const input = tipearYSalir(etiqueta, 'https://www.instagram.com/p/ABC123/');
      expect(input.value).toBe('https://www.instagram.com/p/ABC123/');
    });

    /**
     * **B-1160 — un `#` adentro del handle ya no lo recorta.** Hasta B-1160
     * `handleInstagram` cortaba por el primer `?` o `#` de cualquier valor, así
     * que `casa#brandon` quedaba en `casa`, que es **la cuenta de otra
     * persona**; este caso fijaba ese recorte a la vista, escrito para ponerse
     * rojo el día del arreglo. Ahora el corte va solo detrás de
     * `instagram.com/`, y el valor pelado falla el alfabeto: el campo queda como
     * se tipeó, que es el criterio de todo lo que el saneador no reconoce.
     */
    it('un `#` adentro del handle no lo recorta: queda como se tipeó — B-1160', () => {
      const escrituras = { n: 0 };
      render(<Arnes escrituras={escrituras} />);
      const input = tipearYSalir(etiqueta, 'casa#brandon');
      expect(
        input.value,
        'B-1160 — recortarlo a `casa` apunta a la cuenta de otra persona',
      ).toBe('casa#brandon');
    });

    /** Y el control positivo: detrás de una URL, el `?igsh=…` sí se sigue cortando. */
    it('pero el `?igsh=…` de una URL de Instagram sí se corta', () => {
      const escrituras = { n: 0 };
      render(<Arnes escrituras={escrituras} />);
      const input = tipearYSalir(etiqueta, 'https://www.instagram.com/casabrandon/?igsh=MWx0eXo4a2Rr');
      expect(input.value).toBe('casabrandon');
    });

    /**
     * **Lo que se ve tiene que ser lo que se guarda** — lo pidió el
     * `auditor-trampas`. `conHandle` (`lib/actividades.ts`) resuelve este mismo
     * campo con `handleInstagram(crudo) ?? crudo.trim()`, así que un texto no
     * reconocido con espacios al final se guarda recortado. Si el campo no los
     * sacara, mostraría una cosa y el documento guardaría otra — y la asimetría
     * solo se descubre al reabrir la actividad.
     *
     * Recortar no es perder: no se va nada de lo que alguien escribió.
     */
    it('un texto no reconocido se recorta igual que al guardar, sin perder nada', () => {
      const escrituras = { n: 0 };
      render(<Arnes escrituras={escrituras} />);
      const input = tipearYSalir(etiqueta, '  Casa Brandon / IG  ');
      expect(input.value).toBe('Casa Brandon / IG');
    });

    it('el campo vacío sigue vacío: ni `null` ni un string raro', () => {
      const escrituras = { n: 0 };
      render(<Arnes escrituras={escrituras} />);
      const input = screen.getByLabelText(etiqueta) as HTMLInputElement;
      fireEvent.blur(input);
      expect(input.value).toBe('');
      expect(escrituras.n, 'un blur sobre un campo vacío no escribe nada').toBe(0);
    });
  });
});

/**
 * **La red del original, que este archivo no puede no tener** — lo pidió el
 * `auditor-privacidad` sobre B-1144, y la cuenta que da es la que importa: los
 * dieciocho casos de arriba prueban el **eco** y cero probaban la **regla**.
 *
 * La normalización que protege a las cuatro salidas públicas —el `events.json`,
 * la descripción del evento de Calendar, el pie del posteo para redes y la
 * ficha de detalle— no es la del formulario: es `conHandle` dentro de
 * `formADocumento` (`lib/actividades.ts`), porque el `onBlur` **es salteable
 * por el camino más común de todos** —abrir una actividad vieja, no tocar el
 * campo de Instagram, guardar—. Esa regla no tenía ningún test.
 *
 * Dejar así el repo es la condición exacta en la que alguien borra el original
 * por redundante: el docblock del componente dice «la regla del modelo ya está
 * escrita del otro lado, y esto es su eco en la pantalla», y si el otro lado
 * desaparece los dieciocho casos de arriba **siguen verdes** mientras todo
 * guardado sin blur publica la URL cruda.
 *
 * Vive acá y no en el archivo de `formADocumento` porque es este cambio el que
 * la vuelve necesaria: son las dos mitades de la misma afirmación y se leen
 * juntas.
 */
describe('la regla de la que esto es el eco: el guardado normaliza aunque nadie pase por el campo', () => {
  /** El form que deja una actividad vieja abierta y guardada sin tocar nada. */
  const conInstagram = (crudo: string): ActividadForm =>
    formGuardable({
      organizador: { nombre: 'Casa Brandon', instagram: crudo, web: '' },
      tallerista: { nombre: 'Ana Pérez', bio: '', instagram: crudo },
    });

  const guardado = (crudo: string) =>
    formADocumento(conInstagram(crudo), 'uid-de-prueba', false) as {
      organizador: { instagram: string };
      tallerista: { instagram: string } | null;
    };

  it('la URL completa se guarda como handle, sin que nadie haya tocado el campo', () => {
    const doc = guardado('https://www.instagram.com/casabrandon/?igsh=MWx4bGs');
    expect(
      doc.organizador.instagram,
      'si esto se rompe, toda actividad guardada sin pasar por el campo publica ' +
        'la URL cruda en las cuatro salidas — y los tests de arriba no se enteran',
    ).toBe('casabrandon');
    expect(doc.tallerista?.instagram).toBe('casabrandon');
  });

  it('y lo que el saneador no entiende se guarda recortado, no borrado', () => {
    const doc = guardado('  Casa Brandon / IG  ');
    expect(doc.organizador.instagram).toBe('Casa Brandon / IG');
  });

  it('lo que el campo deja escrito es exactamente lo que el guardado produce', () => {
    // Es la afirmación que une las dos mitades: el eco no puede decir una cosa
    // y la regla otra. `handleInstagram` es idempotente, así que pasar por el
    // blur y guardar tiene que dar lo mismo que guardar sin pasar por el blur.
    for (const crudo of [
      'https://www.instagram.com/casabrandon/?igsh=MWx4bGs',
      '@casabrandon',
      'casabrandon',
      '  Casa Brandon / IG  ',
      '',
    ]) {
      render(<Arnes escrituras={{ n: 0 }} />);
      const enPantalla = tipearYSalir(/^instagram del organizador/i, crudo).value;
      cleanup();
      expect(guardado(enPantalla).organizador.instagram, `divergen para «${crudo}»`).toBe(
        enPantalla,
      );
    }
  });
});
