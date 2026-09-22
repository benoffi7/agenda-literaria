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
import { formVacio } from '@/lib/formulario/estadoInicial';
import type { ActividadForm } from '@/types/actividad';

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
     * **Fija el bug de B-1160, no lo bendice.** `handleInstagram` corta por el
     * primer `?` o `#` sobre cualquier valor —no solo sobre los que traen
     * `instagram.com/` adelante—, así que un handle con un `#` adentro se
     * recorta y termina apuntando a **otra cuenta**. El arreglo es del saneador
     * y vive en B-1160; acá se deja escrito qué se ve en el formulario mientras
     * tanto, que es lo que este ítem cambió: hasta B-1144 ese recorte lo hacía
     * `conHandle` al guardar, en silencio.
     *
     * Cuando B-1160 se arregle, este caso se pone rojo. La respuesta correcta
     * es darlo vuelta —esperar `'casa#brandon'`—, no aflojar el aserto.
     */
    it('un `#` adentro del handle lo recorta, y se ve en el campo — B-1160', () => {
      const escrituras = { n: 0 };
      render(<Arnes escrituras={escrituras} />);
      const input = tipearYSalir(etiqueta, 'casa#brandon');
      expect(
        input.value,
        'B-1160 — `casa` es una cuenta de otra persona. Que se vea en el campo ' +
          'es peor que nada y mejor que el recorte silencioso al guardar',
      ).toBe('casa');
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
