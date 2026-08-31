/**
 * Las fechas del sitio público — B-227.
 *
 * **Es la trampa 1 aplicada al frontend** (§6.4 del diseño): las fechas del
 * `events.json` son ISO en UTC y quien mira puede estar en cualquier zona. Un
 * taller a las 19:00 de Buenos Aires tiene que decir «19:00» en un teléfono con
 * el reloj en Madrid, porque la actividad pasa en Buenos Aires.
 *
 * Por eso **cada caso de este archivo corre además con `TZ` en otra zona**: sin
 * eso, todos pasarían en una máquina configurada en Argentina y fallarían en el
 * CI —o al revés—, que es exactamente cómo se cuela un evento corrido tres horas.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ZONA,
  claveDeMes,
  diaYMes,
  fechaCompleta,
  fechaCorta,
  fechaLarga,
  hora,
  isoConOffset,
  nombreDeMes,
  partesDeFecha,
  partesDeMes,
  rangoCorto,
} from '@/lib/fechasPublicas';

/** 24 de septiembre de 2026, 19:00 en Buenos Aires. */
const MIERCOLES = new Date('2026-09-24T22:00:00Z');

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('la zona es la del proyecto y no la de quien mira (trampa 1)', () => {
  it('la constante es la misma que usa el evento de Calendar', () => {
    // Se importa de `@calendario` en vez de escribir la cadena: si el sitio y el
    // calendario tuvieran cada uno la suya, el día que una cambie el sitio diría
    // una hora y el calendario otra, para el mismo encuentro.
    expect(ZONA).toBe('America/Argentina/Buenos_Aires');
  });

  it('la hora es la de Buenos Aires, no la del proceso', () => {
    // `TZ` no se puede cambiar a mitad de proceso con Intl ya inicializado, así
    // que el caso se hace al revés: se formatea un instante cuya hora **local en
    // UTC** es distinta de la de Buenos Aires. Si el `timeZone` explícito
    // faltara, esto diría 22:00.
    expect(hora(MIERCOLES)).toBe('19:00');
  });

  it('y el día también, no solo la hora', () => {
    // 01:00 UTC del 1 de septiembre son las 22:00 del 31 de agosto en Buenos
    // Aires. Es el caso que rompe la agrupación por mes si alguien usa
    // `getMonth()`.
    const cruce = new Date('2026-09-01T01:00:00Z');
    expect(claveDeMes(cruce)).toBe('2026-08');
    expect(diaYMes(cruce)).toBe('31 de agosto');
  });
});

describe('los formatos que se leen en la pantalla', () => {
  it('la larga va sin la coma que mete es-AR', () => {
    expect(fechaLarga(MIERCOLES)).toBe('jueves 24 de septiembre');
  });

  it('la corta de la tarjeta abrevia septiembre a tres letras', () => {
    // «jue, 24 sept» es lo que devuelve es-AR; en 360px la coma y la cuarta
    // letra sobran.
    expect(fechaCorta(MIERCOLES)).toBe('jue 24 sep');
  });

  it('la hora es de 24 horas, no «07:00 p. m.»', () => {
    // El default de `es-AR` es 12 horas. Es el caso que fija `hourCycle`.
    expect(hora(MIERCOLES)).toBe('19:00');
    expect(hora(MIERCOLES)).not.toContain('p. m.');
  });

  it('la completa lleva el año, para el cierre de inscripción', () => {
    expect(fechaCompleta(MIERCOLES)).toBe('24 de septiembre de 2026');
  });

  it('el nombre del mes arranca en mayúscula', () => {
    expect(nombreDeMes('2026-09')).toBe('Septiembre de 2026');
  });

  it('un mes de enero no se corre de año por el offset', () => {
    // La clave se convierte a una fecha para formatearla: hacerlo a medianoche
    // daría el 31 de diciembre del año anterior con un offset negativo.
    expect(nombreDeMes('2026-01')).toBe('Enero de 2026');
    expect(nombreDeMes('2026-12')).toBe('Diciembre de 2026');
  });

  it('una clave rota se devuelve tal cual en vez de decir «Invalid Date»', () => {
    expect(nombreDeMes('cualquier-cosa')).toBe('cualquier-cosa');
  });
});

describe('el rango de un ciclo', () => {
  it('junta las dos puntas', () => {
    expect(rangoCorto(MIERCOLES, new Date('2026-10-22T22:00:00Z'))).toBe('24 sep – 22 oct');
  });

  it('con una sola fecha no inventa un rango', () => {
    // «24 sep – 24 sep» se lee como un error de software.
    expect(rangoCorto(MIERCOLES, MIERCOLES)).toBe('24 sep');
  });
});

describe('isoConOffset — el ISO del JSON-LD (regla 1 del §5.3)', () => {
  it('emite la hora local con el offset explícito, no la UTC con Z', () => {
    /*
     * Es la regla que evita que un consumidor que no convierta diga «22:00». El
     * instante es el mismo; lo que cambia es que no queda nada que interpretar.
     */
    expect(isoConOffset(MIERCOLES)).toBe('2026-09-24T19:00:00-03:00');
    expect(isoConOffset(MIERCOLES)).not.toContain('Z');
  });

  it('el offset se lee de Intl y no está escrito a mano', () => {
    /*
     * MUTACIÓN PROBADA: reemplazar el offset leído por un `-03:00` literal deja
     * este caso en verde y rompe el de abajo. Argentina no tiene horario de
     * verano hoy, pero lo tuvo hasta 2009 y volver a tenerlo es una decisión
     * política: un literal se convierte en una hora de error en silencio.
     *
     * Se verifica con una fecha de 2008, cuando el país sí estaba en -02:00 en
     * verano — el mismo dato que tiene la base de zonas horarias del sistema.
     */
    const verano2008 = new Date('2009-01-15T22:00:00Z');
    const emitido = isoConOffset(verano2008);
    const esperado = new Intl.DateTimeFormat('es-AR', {
      timeZone: ZONA,
      timeZoneName: 'longOffset',
    })
      .formatToParts(verano2008)
      .find((p) => p.type === 'timeZoneName')!.value.replace('GMT', '');
    expect(emitido.endsWith(esperado)).toBe(true);
  });

  it('el instante que representa es el mismo que el de entrada', () => {
    // La propiedad que importa: cambia la notación, no el momento. Sin esto, un
    // error de signo en el offset pasaría desapercibido.
    expect(new Date(isoConOffset(MIERCOLES)).getTime()).toBe(MIERCOLES.getTime());
    const otro = new Date('2026-02-05T03:30:00Z');
    expect(new Date(isoConOffset(otro)).getTime()).toBe(otro.getTime());
  });
});

describe('las piezas del marcador de mes y del bloque de fecha — B-260', () => {
  /*
   * Las dos funciones existen porque el sistema visual pinta el mes y la fecha a
   * **dos cuerpos tipográficos distintos en el mismo elemento**, y para eso hacen
   * falta las piezas por separado. El riesgo que cubren estos casos es el de
   * siempre en este módulo: que alguien las derive partiendo una cadena ya
   * formateada, que se rompe con el idioma, o sin `timeZone`, que es la trampa 1.
   */
  it('`partesDeMes` separa el mes del año, sin el «de» del idioma', () => {
    // MUTACIÓN PROBADA: derivarlo con `nombreDeMes(clave).split(' de ')` da
    // `['Septiembre', '2026']` hoy y se rompe con el primer cambio de formato.
    expect(partesDeMes('2026-09')).toEqual({ mes: 'Septiembre', anio: '2026' });
    expect(partesDeMes('2026-01')).toEqual({ mes: 'Enero', anio: '2026' });
    expect(partesDeMes('2027-12')).toEqual({ mes: 'Diciembre', anio: '2027' });
  });

  it('y el mes va con mayúscula inicial, como el marcador lo pinta', () => {
    // `es-AR` devuelve «septiembre» en minúscula. El marcador va en versalitas por
    // CSS, pero el dato tiene que servir también fuera de ese contexto.
    expect(partesDeMes('2026-09').mes[0]).toBe('S');
  });

  it('una clave rota no rompe la página: devuelve la clave y ningún año', () => {
    // El listado agrupa con la clave `sin-fecha` cuando una actividad no tiene
    // ninguna. Un `NaN` en el marcador sería un «NaN» de 72px en la home.
    expect(partesDeMes('sin-fecha')).toEqual({ mes: 'sin-fecha', anio: '' });
  });

  it('`partesDeFecha` da las tres piezas en la zona del proyecto', () => {
    /*
     * **La trampa 1 del lado del frontend.** Las 22:00 UTC del 24 son las 19:00
     * del 24 en Buenos Aires; sin `timeZone` explícito, un navegador en Madrid
     * formatea el 25 — y el número del día es lo más grande de la fila.
     *
     * MUTACIÓN PROBADA: usar `d.getDate()` en vez de `formatToParts` con la zona
     * hace fallar este caso en cualquier máquina que no esté en -03:00.
     */
    expect(partesDeFecha(new Date('2026-09-24T22:00:00Z'))).toEqual({
      dia: '24',
      diaSemana: 'jue',
      mes: 'sep',
    });
  });

  it('sin el punto de la abreviatura, que en versalitas es una mancha', () => {
    const p = partesDeFecha(new Date('2026-10-05T22:00:00Z'));
    expect(p.diaSemana).not.toContain('.');
    expect(p.mes).not.toContain('.');
    expect(p.diaSemana).toBe('lun');
  });

  it('y ningún mes se pasa de tres letras', () => {
    /*
     * El bloque de fecha mide 56px: un mes de cuatro letras («sept») desalinea la
     * única fila del año que lo tenga. Se recorren los doce en vez de probar
     * septiembre, que es el que hoy falla — un idioma nuevo podría traer otro.
     */
    for (let m = 1; m <= 12; m++) {
      const d = new Date(Date.UTC(2026, m - 1, 15, 15));
      expect(partesDeFecha(d).mes.length, `mes ${m}`).toBeLessThanOrEqual(3);
    }
  });
});
