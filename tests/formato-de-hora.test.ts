/**
 * El formato de hora del panel — B-889, D-720.
 *
 * Lo que este archivo protege, y es lo único que puede romper un dato: **las
 * piezas se componen en el mismo string de `datetime-local` que el formulario ya
 * manejaba**. Si `dePiezas` se equivoca, el panel guarda una hora que nadie
 * tipeó; si devuelve algo donde debería devolver `''`, guarda media fecha como
 * si fuera una entera.
 *
 * Los dos bordes que se escriben mal en todo reloj de 12 —**la medianoche es
 * 12 AM y el mediodía es 12 PM**— tienen caso propio en las dos direcciones, y
 * la ida y vuelta se verifica sobre las 24 horas del día, no sobre una muestra.
 */
import { describe, expect, it } from 'vitest';
import { deDatetimeLocal } from '@/lib/sesiones';
import {
  CLAVE_FORMATO_DE_HORA,
  ETIQUETA_FORMATO_DE_HORA,
  FORMATOS_DE_HORA,
  FORMATO_POR_DEFECTO,
  PIEZAS_VACIAS,
  aPiezas,
  aReloj12,
  de12A24,
  horaTipeadaEn12,
  dePiezas,
  ecoDeFechaYHora,
  partesDeDatetimeLocal,
  elOtroFormato,
  esFormatoDeHora,
  formatoInicialDeHora,
  leerFormatoElegido,
  QUE_HACE_EL_FORMATO,
  recordarFormatoDeHora,
  type AlmacenDeFormatoDeHora,
  type FormatoDeHora,
} from '@/lib/formatoDeHora';

/** Un almacén de mentira: el puerto es lo que deja testear esto sin DOM. */
const almacenFalso = (inicial: Record<string, string> = {}) => {
  const datos = { ...inicial };
  return {
    datos,
    getItem: (k: string) => datos[k] ?? null,
    setItem: (k: string, v: string) => {
      datos[k] = v;
    },
  };
};

describe('lo que se tipea en la cajita de la hora — B-1234', () => {
  /**
   * El reporte del dueño: «escribo 20 y sigue saliendo 2». Lo que pasaba era
   * peor que no aceptar el 20: `dePiezas` devolvía `''` y **la fecha entera se
   * vaciaba en silencio**, con la cajita mostrando `20` como si estuviera
   * cargada. Ni rechazaba, ni convertía, ni avisaba.
   *
   * MUTACIÓN PROBADA: devolviendo siempre `{ hora: texto, meridiano }`, los dos
   * primeros casos se ponen rojos.
   */
  it('una hora de 24 se entiende: 20 es 8 PM', () => {
    expect(horaTipeadaEn12('20', 'AM')).toEqual({ hora: '8', meridiano: 'PM' });
    expect(horaTipeadaEn12('13', 'AM')).toEqual({ hora: '1', meridiano: 'PM' });
    expect(horaTipeadaEn12('23', 'AM')).toEqual({ hora: '11', meridiano: 'PM' });
  });

  it('y la medianoche también, que es el borde que se escribe mal', () => {
    // `00` es 12 AM, no «0 AM»: el mismo borde que `aReloj12` ya cuida.
    expect(horaTipeadaEn12('00', 'PM')).toEqual({ hora: '12', meridiano: 'AM' });
  });

  it('una hora que el reloj de 12 sí sabe decir no toca el AM/PM elegido', () => {
    /*
     * La mitad que evita que el arreglo moleste: quien tenía PM y retipea `10`
     * quiere las diez de la noche. Convertir acá lo mudaría a la mañana en
     * silencio, que es la misma clase de bug que este ítem vino a cerrar.
     */
    expect(horaTipeadaEn12('10', 'PM')).toEqual({ hora: '10', meridiano: 'PM' });
    expect(horaTipeadaEn12('05', 'PM')).toEqual({ hora: '05', meridiano: 'PM' });
    expect(horaTipeadaEn12('12', 'AM')).toEqual({ hora: '12', meridiano: 'AM' });
  });

  it('con un solo dígito no se decide nada todavía', () => {
    /*
     * Es lo que deja tipear `12` sin que el `1` se vuelva otra cosa a mitad de
     * camino, y lo que evita que el `0` de `05` se convierta en `12 AM` y le
     * coma el lugar al `5` (la cajita admite dos dígitos).
     */
    expect(horaTipeadaEn12('1', 'AM')).toEqual({ hora: '1', meridiano: 'AM' });
    expect(horaTipeadaEn12('0', 'AM')).toEqual({ hora: '0', meridiano: 'AM' });
    expect(horaTipeadaEn12('', 'PM')).toEqual({ hora: '', meridiano: 'PM' });
  });

  it('un typo no se inventa: 25 no es ninguna hora y queda como está', () => {
    // El campo no compone y el schema lo cobra como fecha faltante. Convertirlo
    // sería adivinar sobre algo que no tiene lectura.
    expect(horaTipeadaEn12('25', 'AM')).toEqual({ hora: '25', meridiano: 'AM' });
    expect(horaTipeadaEn12('99', 'PM')).toEqual({ hora: '99', meridiano: 'PM' });
  });
});

describe('el reloj de 12 y sus dos bordes', () => {
  it('la medianoche es 12 AM y el mediodía es 12 PM, no «0»', () => {
    // Un `h % 12` pelado manda los dos a 0, que no es una hora de reloj.
    expect(aReloj12(0)).toEqual({ hora: 12, meridiano: 'AM' });
    expect(aReloj12(12)).toEqual({ hora: 12, meridiano: 'PM' });
  });

  it('y las horas comunes caen donde tienen que caer', () => {
    expect(aReloj12(1)).toEqual({ hora: 1, meridiano: 'AM' });
    expect(aReloj12(11)).toEqual({ hora: 11, meridiano: 'AM' });
    expect(aReloj12(13)).toEqual({ hora: 1, meridiano: 'PM' });
    expect(aReloj12(19)).toEqual({ hora: 7, meridiano: 'PM' });
    expect(aReloj12(23)).toEqual({ hora: 11, meridiano: 'PM' });
  });

  it('la vuelta también, y los bordes son los mismos', () => {
    expect(de12A24(12, 'AM')).toBe(0);
    expect(de12A24(12, 'PM')).toBe(12);
    expect(de12A24(1, 'AM')).toBe(1);
    expect(de12A24(7, 'PM')).toBe(19);
  });

  it('la ida y vuelta vale para las 24 horas del día, no para una muestra', () => {
    for (let h = 0; h < 24; h++) {
      const { hora, meridiano } = aReloj12(h);
      expect(de12A24(hora, meridiano), `la hora ${h}`).toBe(h);
      expect(hora, `la hora ${h} en reloj de 12`).toBeGreaterThanOrEqual(1);
      expect(hora, `la hora ${h} en reloj de 12`).toBeLessThanOrEqual(12);
    }
  });
});

describe('las piezas ⇄ el string del formulario', () => {
  it('parte un valor en formato 12', () => {
    expect(aPiezas('2026-10-07T19:30', '12')).toEqual({
      fecha: '2026-10-07',
      hora: '7',
      minutos: '30',
      meridiano: 'PM',
    });
  });

  it('y en formato 24 deja la hora como está, con dos dígitos', () => {
    expect(aPiezas('2026-10-07T09:05', '24')).toEqual({
      fecha: '2026-10-07',
      hora: '09',
      minutos: '05',
      meridiano: 'AM',
    });
  });

  it('un valor vacío, a medio tipear o con basura no tira: da las piezas vacías', () => {
    // Al control lo puede alcanzar un borrador viejo (D-122) o un valor a medio
    // escribir, y eso no puede voltear el formulario.
    for (const raro of ['', '2026-10-07', 'mañana a la tarde', '2026-10-07T25:00', 'T19:30']) {
      expect(aPiezas(raro, '12'), raro).toEqual(PIEZAS_VACIAS);
    }
  });

  it('compone de vuelta el mismo string, en los dos formatos', () => {
    for (const formato of FORMATOS_DE_HORA) {
      for (const valor of ['2026-10-07T00:00', '2026-10-07T12:00', '2026-10-07T19:30', '2026-01-01T23:59']) {
        expect(dePiezas(aPiezas(valor, formato), formato), `${valor} en ${formato}`).toBe(valor);
      }
    }
  });

  it('un campo incompleto da `\'\'`, que es lo que el schema lee como «falta»', () => {
    // Y no media fecha guardada como si fuera entera.
    expect(dePiezas({ fecha: '2026-10-07', hora: '', minutos: '30', meridiano: 'PM' }, '12')).toBe('');
    expect(dePiezas({ fecha: '2026-10-07', hora: '7', minutos: '', meridiano: 'PM' }, '12')).toBe('');
    expect(dePiezas({ fecha: '', hora: '7', minutos: '30', meridiano: 'PM' }, '12')).toBe('');
  });

  it('una hora fuera de rango da `\'\'`: no se recorta ni se ajusta sola', () => {
    // Un `13` que se vuelve `1 PM` mientras alguien tipea es peor que un campo
    // que todavía no vale: cambia lo que la persona escribió sin avisar.
    expect(dePiezas({ fecha: '2026-10-07', hora: '13', minutos: '30', meridiano: 'PM' }, '12')).toBe('');
    expect(dePiezas({ fecha: '2026-10-07', hora: '0', minutos: '30', meridiano: 'AM' }, '12')).toBe('');
    expect(dePiezas({ fecha: '2026-10-07', hora: '24', minutos: '00', meridiano: 'AM' }, '24')).toBe('');
    expect(dePiezas({ fecha: '2026-10-07', hora: '19', minutos: '60', meridiano: 'AM' }, '24')).toBe('');
  });

  it('el meridiano cambia la hora que se compone, que es el punto del pedido', () => {
    const piezas = { fecha: '2026-10-07', hora: '7', minutos: '30', meridiano: 'AM' } as const;
    expect(dePiezas(piezas, '12')).toBe('2026-10-07T07:30');
    expect(dePiezas({ ...piezas, meridiano: 'PM' }, '12')).toBe('2026-10-07T19:30');
  });
});

describe('un solo parser del string, y la red que lo mantiene así — D-88', () => {
  /*
   * El `auditor-trampas` lo marcó sobre el propio cambio de B-889: había tres
   * implementaciones de «parsear el string de `datetime-local`» —la de `aPiezas`,
   * la del eco y la de `lib/sesiones.ts`— y ninguna prueba que las cruzara. Las
   * dos de este módulo son ahora una sola; la tercera vive aparte a propósito
   * (devuelve un `Date`, no componentes) y **esta red es lo que impide que se
   * separen**: si una empieza a aceptar algo que la otra no, acá se pone rojo.
   */
  const VALORES = [
    '2026-10-07T19:30',
    '2026-10-07T00:00',
    '2026-10-07T12:00',
    '2026-01-01T23:59',
    '2026-02-29T10:00',
  ];
  const BASURA = ['', '2026-10-07', 'mañana', '2026-10-07T25:00', '2026-10-07T19:60'];

  it('lo que este módulo acepta, `deDatetimeLocal` también', () => {
    for (const v of VALORES) {
      const partes = partesDeDatetimeLocal(v);
      expect(partes, v).not.toBeNull();
      const d = deDatetimeLocal(v);
      expect(d, v).not.toBeNull();
      expect(partes!.hora24, `la hora de ${v}`).toBe(d!.getHours());
      expect(Number(partes!.minutos), `los minutos de ${v}`).toBe(d!.getMinutes());
    }
  });

  it('y lo que rechaza, no lo compone nadie', () => {
    for (const v of BASURA) {
      expect(partesDeDatetimeLocal(v), v).toBeNull();
      expect(aPiezas(v, '12'), v).toEqual(PIEZAS_VACIAS);
      expect(ecoDeFechaYHora(v), v).toBe('');
    }
  });

  it('el eco sale del mismo parseo que las piezas', () => {
    // Si se separaran, el texto que confirma la hora podría decir una y el
    // formulario componer otra — en el único lugar que existe para confirmarla.
    for (const v of VALORES) {
      const { hora24 } = partesDeDatetimeLocal(v)!;
      const { hora, meridiano } = aReloj12(hora24);
      expect(ecoDeFechaYHora(v), v).toContain(`${hora}:`);
      expect(ecoDeFechaYHora(v), v).toContain(meridiano);
    }
  });
});

describe('el eco: lo que quedó cargado, en palabras', () => {
  it('escribe la fecha y la hora en 12 horas', () => {
    expect(ecoDeFechaYHora('2026-10-07T19:30', new Date(2026, 0, 1))).toBe(
      'miércoles, 7 de octubre, 7:30 PM',
    );
  });

  it('en 12 horas **siempre**, aunque el panel esté en 24', () => {
    // El eco existe para contestar «¿es de mañana o de tarde?». Repetir `19:30`
    // al lado de `19:30` no confirma nada.
    expect(ecoDeFechaYHora('2026-10-07T00:15', new Date(2026, 0, 1))).toContain('12:15 AM');
    expect(ecoDeFechaYHora('2026-10-07T12:15', new Date(2026, 0, 1))).toContain('12:15 PM');
  });

  it('el año aparece solo cuando no es el corriente', () => {
    expect(ecoDeFechaYHora('2027-03-02T10:00', new Date(2026, 0, 1))).toContain('2027');
    expect(ecoDeFechaYHora('2026-03-02T10:00', new Date(2026, 0, 1))).not.toContain('2026');
  });

  it('un valor incompleto no dibuja nada', () => {
    for (const raro of ['', '2026-10-07', 'cualquier cosa']) {
      expect(ecoDeFechaYHora(raro), raro).toBe('');
    }
  });
});

describe('la preferencia — D-720: `localStorage`, con el almacén como puerto', () => {
  it('sin nada guardado, «no eligió» no es «eligió 24»', () => {
    // Los dos caen hoy al mismo formato y se separan el día que cambie el
    // default; ése es justo el día en que un `?? '24'` escondido perdería la
    // elección de alguien.
    expect(leerFormatoElegido(almacenFalso())).toBeNull();
    expect(formatoInicialDeHora(almacenFalso())).toBe(FORMATO_POR_DEFECTO);
  });

  it('lee lo que se guardó', () => {
    const almacen = almacenFalso({ [CLAVE_FORMATO_DE_HORA]: '12' });
    expect(leerFormatoElegido(almacen)).toBe('12');
    expect(formatoInicialDeHora(almacen)).toBe('12');
  });

  it('un valor ilegible cae al default y no rompe', () => {
    const almacen = almacenFalso({ [CLAVE_FORMATO_DE_HORA]: 'am/pm' });
    expect(leerFormatoElegido(almacen)).toBeNull();
    expect(formatoInicialDeHora(almacen)).toBe(FORMATO_POR_DEFECTO);
  });

  it('un almacén que tira no puede romper el panel', () => {
    // Ventana privada, almacenamiento bloqueado: el accesor mismo explota.
    const queTira: AlmacenDeFormatoDeHora = {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('bloqueado');
      },
    };
    expect(leerFormatoElegido(queTira)).toBeNull();
    expect(formatoInicialDeHora(queTira)).toBe(FORMATO_POR_DEFECTO);
    expect(() => recordarFormatoDeHora(queTira, '12')).not.toThrow();
  });

  it('sin almacén tampoco: el panel funciona igual, sin memoria', () => {
    expect(leerFormatoElegido(null)).toBeNull();
    expect(formatoInicialDeHora(null)).toBe(FORMATO_POR_DEFECTO);
    expect(() => recordarFormatoDeHora(null, '12')).not.toThrow();
  });

  it('recuerda lo elegido', () => {
    const almacen = almacenFalso();
    recordarFormatoDeHora(almacen, '12');
    expect(almacen.datos[CLAVE_FORMATO_DE_HORA]).toBe('12');
  });

  it('el interruptor alterna entre los dos y vuelve', () => {
    expect(elOtroFormato('24')).toBe('12');
    expect(elOtroFormato('12')).toBe('24');
    for (const f of FORMATOS_DE_HORA) expect(elOtroFormato(elOtroFormato(f))).toBe(f);
  });

  it('la guarda de lectura no acepta cualquier cosa', () => {
    expect(esFormatoDeHora('12')).toBe(true);
    expect(esFormatoDeHora('24')).toBe(true);
    for (const no of ['AM', 12, null, undefined, '', 'doce']) expect(esFormatoDeHora(no)).toBe(false);
  });

  it('los dos formatos tienen etiqueta y explicación: el interruptor no inventa texto', () => {
    for (const f of FORMATOS_DE_HORA) {
      expect(ETIQUETA_FORMATO_DE_HORA[f as FormatoDeHora]).toBeTruthy();
      expect(QUE_HACE_EL_FORMATO[f as FormatoDeHora]).toBeTruthy();
    }
  });
});
