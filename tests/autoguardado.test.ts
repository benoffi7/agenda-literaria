import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  DIAS_QUE_VIVE,
  conIdsDeCalendarioDe,
  conLoQueEsDelDocumento,
  PREFIJO_CLAVE,
  VERSION_BORRADOR,
  borrarBorradorLocal,
  borrarTodosLosBorradores,
  claveBorrador,
  cuandoSeGuardo,
  guardarBorradorLocal,
  leerBorradorLocal,
  sinFlagsDePublicacion,
  teniaFlagsDePublicacion,
  vaLaPenaOfrecer,
  type AlmacenLocal,
} from '@/lib/formulario/autoguardado';
import {
  formVacio,
  geoVacia,
  onlineVacio,
  personaVacia,
  sedeVacia,
} from '@/lib/formulario/estadoInicial';
import { huellaCreador } from '@/lib/huella';

/**
 * B-191 — el autoguardado del formulario en el navegador.
 *
 * Lo que se guarda acá es **contenido**, a diferencia de todo lo demás que el
 * panel persiste. De ahí las tres cosas que estos tests fijan:
 *
 * 1. **No sale del navegador.** El módulo no importa la analítica, y el hook no
 *    mide nada. Es la guarda de §9: el vocabulario de eventos solo acepta enums
 *    y contadores, y un descuido acá sería la primera vía de fuga de texto.
 * 2. **Un borrador ilegible, viejo o de otra versión del formulario se
 *    descarta**, y se descarta *borrándolo*: si quedara en el navegador,
 *    reaparecería en cada apertura sin que nadie pueda hacer nada con él.
 * 3. **Nunca tira.** `localStorage` falla en modo privado y con la cuota llena,
 *    y un formulario no puede romperse porque no se pudo autoguardar.
 */

/** Un `localStorage` de mentira, con la opción de fallar como el de verdad. */
const almacenFalso = (opts: { falla?: boolean } = {}) => {
  const datos = new Map<string, string>();
  const almacen: AlmacenLocal = {
    getItem: (k) => {
      if (opts.falla) throw new Error('SecurityError');
      return datos.get(k) ?? null;
    },
    setItem: (k, v) => {
      if (opts.falla) throw new Error('QuotaExceededError');
      datos.set(k, v);
    },
    removeItem: (k) => {
      if (opts.falla) throw new Error('SecurityError');
      datos.delete(k);
    },
    get length() {
      if (opts.falla) throw new Error('SecurityError');
      return datos.size;
    },
    key: (i) => {
      if (opts.falla) throw new Error('SecurityError');
      return [...datos.keys()][i] ?? null;
    },
  };
  return { almacen, datos };
};

/**
 * El código de un archivo **sin comentarios y sin espacios**, para poder afirmar
 * una **llamada**.
 *
 * Las dos cosas hacen falta y por motivos distintos. Sin colapsar espacios hay
 * que buscar un nombre, y el nombre lo satisface el `import`. Sin quitar
 * comentarios lo satisface la **prosa**: este repo escribe comentarios largos que
 * citan código, y el bloque que está justo arriba de la llamada que verificamos
 * enumera los tres saneadores por nombre.
 */
const codigoSinEspacios = (ruta: string): string =>
  readFileSync(ruta, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\s+/g, '');

const fuenteDelFormulario = (): string =>
  codigoSinEspacios('src/components/admin/ActividadFormulario.tsx');

const fuenteDelPanel = (): string => codigoSinEspacios('src/components/admin/AdminApp.tsx');

const UID = 'uid-de-ana';
const OTRO_UID = 'uid-de-beto';
const CLAVE = claveBorrador({ uid: UID, idActividad: 'act-1' });
const AHORA = new Date('2026-08-26T12:00:00Z');

describe('claves', () => {
  it('una por actividad', () => {
    const unaClave = claveBorrador({ uid: UID, idActividad: 'act-1' });
    expect(unaClave.startsWith(PREFIJO_CLAVE)).toBe(true);
    expect(unaClave.endsWith(':act-1')).toBe(true);
    expect(claveBorrador({ uid: UID, idActividad: 'act-2' })).not.toBe(unaClave);
  });

  it('la actividad nueva tiene la suya', () => {
    // Sin esto, el borrador de un taller reaparecería adentro de otro.
    expect(claveBorrador({ uid: UID }).endsWith(':nueva')).toBe(true);
  });

  it('la copia no comparte la clave de la carga nueva', () => {
    // Las dos nacen sin id porque las dos se guardan creando un documento, pero
    // lo que se ofrece es contenido: un borrador de "nueva" ofrecido dentro de un
    // duplicado publica una actividad distinta de la que se quiso duplicar.
    expect(claveBorrador({ uid: UID, esCopia: true })).not.toBe(claveBorrador({ uid: UID }));
    expect(claveBorrador({ uid: UID, esCopia: true }).endsWith(':copia')).toBe(true);
  });

  it('el borrador es por admin, y el uid no queda en claro (§5.1)', () => {
    // Con dos cuentas en la misma máquina (D-57), una clave sin dueño le ofrece a
    // B el borrador sin guardar de A — y el formulario tiene campos que el §5.1
    // marca como internos.
    expect(claveBorrador({ uid: OTRO_UID, idActividad: 'act-1' })).not.toBe(CLAVE);
    expect(CLAVE).not.toContain(UID);
    expect(CLAVE).toBe(`${PREFIJO_CLAVE}${huellaCreador(UID)}:act-1`);
  });
});

describe('cerrar sesión se lleva los borradores (§5.1)', () => {
  it('borra los de todas las actividades, no solo el que se estaba mirando', () => {
    const { almacen, datos } = almacenFalso();
    guardarBorradorLocal(almacen, claveBorrador({ uid: UID, idActividad: 'act-1' }), formVacio());
    guardarBorradorLocal(almacen, claveBorrador({ uid: UID, idActividad: 'act-2' }), formVacio());
    guardarBorradorLocal(almacen, claveBorrador({ uid: UID }), formVacio());
    datos.set('agenda-literaria:novedad-leida', '2026-08-26');

    borrarTodosLosBorradores(almacen);

    expect([...datos.keys()].filter((k) => k.startsWith(PREFIJO_CLAVE))).toEqual([]);
    // Lo que no es un borrador no es contenido y no se toca.
    expect(datos.has('agenda-literaria:novedad-leida')).toBe(true);
  });

  it('descartar lo saca del navegador, no solo de la pantalla (§5.1)', () => {
    // Escondía el aviso y dejaba el borrador —con `online.url`, `difusion` e
    // `inscripcion.destino` en claro— hasta 30 días; y como el aviso se lee al
    // montar, reabrir la actividad lo volvía a ofrecer. La doc afirmaba que el
    // borrador queda "hasta que se descarta", y ese botón no descartaba nada.
    const hook = readFileSync('src/components/admin/useAutoguardado.ts', 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
      .replace(/\s+/g, '');
    expect(hook).toContain('descartar:()=>{borrarBorradorLocal(dameAlmacen(),clave);');
  });

  it('un almacén que tira no impide cerrar sesión', () => {
    const { almacen } = almacenFalso({ falla: true });
    expect(() => borrarTodosLosBorradores(almacen)).not.toThrow();
    expect(() => borrarTodosLosBorradores(null)).not.toThrow();
  });

  it('el panel lo llama al salir, y no llama a logout pelado', () => {
    // Se afirma la **llamada**: `toContain('borrarTodosLosBorradores')` lo
    // satisface el import de la línea 21, así que ese aserto seguía verde con la
    // llamada borrada de dentro de `cerrarSesion()`. Es la misma clase que el
    // aserto de B-80, reproducida en el test escrito para arreglarla.
    const fuente = fuenteDelPanel();
    expect(fuente).toContain('borrarTodosLosBorradores(almacenDelNavegador());returnlogout()');
    expect(fuente).not.toContain('onClick={()=>voidlogout()}');
  });
});

describe('guardar y recuperar', () => {
  it('vuelve el mismo formulario', () => {
    const { almacen } = almacenFalso();
    const form = { ...formVacio(), titulo: 'Taller de crónica' };
    expect(guardarBorradorLocal(almacen, CLAVE, form, AHORA)).toBe(true);

    const leido = leerBorradorLocal(almacen, CLAVE, AHORA);
    expect(leido?.form).toEqual(form);
    expect(leido?.version).toBe(VERSION_BORRADOR);
    expect(leido?.guardadoEn).toBe(AHORA.toISOString());
  });

  it('sin nada guardado no hay nada que ofrecer', () => {
    const { almacen } = almacenFalso();
    expect(leerBorradorLocal(almacen, CLAVE, AHORA)).toBeNull();
  });

  it('un borrador de otra actividad no se cruza', () => {
    const { almacen } = almacenFalso();
    guardarBorradorLocal(almacen, claveBorrador({ uid: UID, idActividad: 'act-1' }), formVacio(), AHORA);
    expect(
      leerBorradorLocal(almacen, claveBorrador({ uid: UID, idActividad: 'act-2' }), AHORA),
    ).toBeNull();
  });

  it('borrar lo saca del navegador', () => {
    const { almacen, datos } = almacenFalso();
    guardarBorradorLocal(almacen, CLAVE, formVacio(), AHORA);
    borrarBorradorLocal(almacen, CLAVE);
    expect(datos.has(CLAVE)).toBe(false);
  });
});

describe('lo que no se puede aplicar se descarta, y se borra', () => {
  const guardadoCrudo = (valor: unknown) => {
    const { almacen, datos } = almacenFalso();
    datos.set(CLAVE, typeof valor === 'string' ? valor : JSON.stringify(valor));
    return { almacen, datos };
  };

  it('un JSON roto', () => {
    const { almacen, datos } = guardadoCrudo('{no es json');
    expect(leerBorradorLocal(almacen, CLAVE, AHORA)).toBeNull();
    expect(datos.has(CLAVE)).toBe(false);
  });

  it('otra versión del formato: un borrador viejo sobre un formulario nuevo parece bueno', () => {
    const { almacen, datos } = guardadoCrudo({
      version: VERSION_BORRADOR + 1,
      guardadoEn: AHORA.toISOString(),
      form: formVacio(),
    });
    expect(leerBorradorLocal(almacen, CLAVE, AHORA)).toBeNull();
    expect(datos.has(CLAVE)).toBe(false);
  });

  it('algo que no tiene forma de formulario', () => {
    const { almacen, datos } = guardadoCrudo({
      version: VERSION_BORRADOR,
      guardadoEn: AHORA.toISOString(),
      form: { cualquier: 'cosa' },
    });
    expect(leerBorradorLocal(almacen, CLAVE, AHORA)).toBeNull();
    expect(datos.has(CLAVE)).toBe(false);
  });

  it('una fecha que no es fecha', () => {
    const { almacen } = guardadoCrudo({
      version: VERSION_BORRADOR,
      guardadoEn: 'el martes',
      form: formVacio(),
    });
    expect(leerBorradorLocal(almacen, CLAVE, AHORA)).toBeNull();
  });

  it('un borrador vencido: no se ofrece el taller del año pasado', () => {
    const { almacen, datos } = almacenFalso();
    const viejo = new Date(AHORA.getTime() - (DIAS_QUE_VIVE + 1) * 24 * 60 * 60 * 1000);
    guardarBorradorLocal(almacen, CLAVE, formVacio(), viejo);
    expect(leerBorradorLocal(almacen, CLAVE, AHORA)).toBeNull();
    expect(datos.has(CLAVE)).toBe(false);
  });

  it('el día anterior al vencimiento todavía se ofrece', () => {
    const { almacen } = almacenFalso();
    const casi = new Date(AHORA.getTime() - (DIAS_QUE_VIVE - 1) * 24 * 60 * 60 * 1000);
    guardarBorradorLocal(almacen, CLAVE, formVacio(), casi);
    expect(leerBorradorLocal(almacen, CLAVE, AHORA)).not.toBeNull();
  });
});

describe('nunca rompe el formulario', () => {
  it('sin almacén no guarda ni tira', () => {
    expect(guardarBorradorLocal(null, CLAVE, formVacio(), AHORA)).toBe(false);
    expect(leerBorradorLocal(null, CLAVE, AHORA)).toBeNull();
    expect(() => borrarBorradorLocal(null, CLAVE)).not.toThrow();
  });

  it('un almacén que tira en cada acceso no propaga el error', () => {
    const { almacen } = almacenFalso({ falla: true });
    expect(guardarBorradorLocal(almacen, CLAVE, formVacio(), AHORA)).toBe(false);
    expect(leerBorradorLocal(almacen, CLAVE, AHORA)).toBeNull();
    expect(() => borrarBorradorLocal(almacen, CLAVE)).not.toThrow();
  });
});

describe('cuándo vale la pena ofrecerlo', () => {
  it('no se ofrece lo que ya está en la pantalla', () => {
    const form = formVacio();
    const borrador = { version: VERSION_BORRADOR, guardadoEn: AHORA.toISOString(), form };
    expect(vaLaPenaOfrecer(borrador, form)).toBe(false);
  });

  it('se ofrece si tiene algo distinto', () => {
    const borrador = {
      version: VERSION_BORRADOR,
      guardadoEn: AHORA.toISOString(),
      form: { ...formVacio(), titulo: 'Club de lectura' },
    };
    expect(vaLaPenaOfrecer(borrador, formVacio())).toBe(true);
  });

  it('dice de cuándo es, para que el aviso no sea un misterio', () => {
    const borrador = { version: VERSION_BORRADOR, guardadoEn: AHORA.toISOString(), form: formVacio() };
    // Hora de Buenos Aires (UTC-3), no la del navegador de quien mira.
    expect(cuandoSeGuardo(borrador)).toContain('26/8/26');
    expect(cuandoSeGuardo(borrador)).toMatch(/\b9:00\b/);
  });
});

describe('lo guardado no sale del navegador (§9)', () => {
  /**
   * Se mira el código y no el archivo entero: los comentarios de estos módulos
   * hablan justamente de la analítica y de Firestore para explicar por qué no
   * los tocan, y un test que lea la prosa fallaría por decir la verdad.
   */
  const codigo = (ruta: string): string =>
    readFileSync(ruta, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');

  const modulo = codigo('src/lib/formulario/autoguardado.ts');
  const hook = codigo('src/components/admin/useAutoguardado.ts');

  it('el módulo no conoce la analítica', () => {
    expect(modulo).not.toMatch(/analytics/);
    expect(modulo).not.toMatch(/\bmedir\b/);
  });

  it('el hook tampoco mide nada', () => {
    expect(hook).not.toMatch(/analytics/);
    expect(hook).not.toMatch(/\bmedir\b/);
  });

  it('no escribe a Firestore: no hay reglas nuevas ni costo por tecla', () => {
    for (const fuente of [modulo, hook]) {
      expect(fuente).not.toMatch(/firebase|firestore|addDoc|setDoc|updateDoc/i);
    }
  });
});

describe('recuperar no puede duplicar eventos del calendario (familia de B-80)', () => {
  /**
   * El `calendarEventId` es el único campo del formulario que escribe el
   * backend. Un borrador de hace un mes lo tiene como estaba antes del
   * write-back, y aplicarlo tal cual persiste `null` en el documento: el sync de
   * ese guardado todavía usa el id del snapshot anterior y no se nota, y la
   * edición siguiente crea un segundo evento para el mismo encuentro.
   */
  const sesion = (id: string, calendarEventId: string | null) => ({
    id,
    inicio: '2026-09-03T19:00',
    fin: '2026-09-03T21:00',
    tema: '',
    lectura: '',
    cancelada: false,
    calendarEventId,
  });

  it('la fila recuperada se queda con el id de calendario de hoy', () => {
    const borrador = { ...formVacio(), sesiones: [sesion('ses_a', null)] };
    const hoy = { ...formVacio(), sesiones: [sesion('ses_a', 'evt-123')] };
    expect(conIdsDeCalendarioDe(borrador, hoy).sesiones[0]!.calendarEventId).toBe('evt-123');
  });

  it('cruza por id de sesión y no por posición (trampa 2)', () => {
    const borrador = {
      ...formVacio(),
      sesiones: [sesion('ses_b', null), sesion('ses_a', null)],
    };
    const hoy = {
      ...formVacio(),
      sesiones: [sesion('ses_a', 'evt-a'), sesion('ses_b', 'evt-b')],
    };
    const r = conIdsDeCalendarioDe(borrador, hoy);
    expect(r.sesiones.map((s) => [s.id, s.calendarEventId])).toEqual([
      ['ses_b', 'evt-b'],
      ['ses_a', 'evt-a'],
    ]);
  });

  it('una fila que solo existe en el borrador se queda sin id, que es lo correcto', () => {
    const borrador = { ...formVacio(), sesiones: [sesion('ses_nueva', null)] };
    const hoy = { ...formVacio(), sesiones: [sesion('ses_a', 'evt-a')] };
    expect(conIdsDeCalendarioDe(borrador, hoy).sesiones[0]!.calendarEventId).toBeNull();
  });

  it('no toca nada más del borrador recuperado', () => {
    const borrador = { ...formVacio(), titulo: 'Lo que estaba escribiendo', sesiones: [] };
    expect(conIdsDeCalendarioDe(borrador, formVacio()).titulo).toBe('Lo que estaba escribiendo');
  });

  it('el formulario lo aplica al recuperar, no solo el módulo', () => {
    // Se afirma la **llamada**, no el nombre: `toContain('conIdsDeCalendarioDe')`
    // lo satisface el import, así que ese test seguía verde con la llamada
    // borrada. Se verificó reintroduciendo el bug.
    expect(fuenteDelFormulario()).toContain('conIdsDeCalendarioDe(sinFlagsDePublicacion(');
  });
});

describe('recuperar no puede publicar un link que estaba privado (§5.1, trampa 5)', () => {
  /**
   * La otra mitad de la guarda de B-80, y por el mismo motivo: el borrador tiene
   * hasta 30 días, así que un valor viejo se aplica sobre el documento de hoy.
   * `online.urlPublica` y `material.items[].publico` son los dos flags que
   * deciden si el link de la reunión y las URLs del material salen a
   * `events.json` y a la descripción del evento. Destildar, no guardar, recuperar
   * a los veinte días y publicar los volvía a prender.
   */
  const conFlagsPrendidos = () => ({
    ...formVacio(),
    online: { ...onlineVacio(), plataforma: 'zoom', url: 'https://zoom.us/j/1', urlPublica: true },
    material: {
      tiene: true,
      items: [
        { tipo: 'lectura' as const, titulo: 'Cap. 1', url: 'https://d/1', entrega: 'previo' as const, publico: true },
        { tipo: 'guia' as const, titulo: 'Guía', url: 'https://d/2', entrega: 'previo' as const, publico: false },
      ],
    },
  });

  it('los dos flags vuelven al default privado', () => {
    const r = sinFlagsDePublicacion(conFlagsPrendidos());
    expect(r.online?.urlPublica).toBe(false);
    expect(r.material.items.map((i) => i.publico)).toEqual([false, false]);
  });

  it('no pierde nada más: la URL sigue ahí, solo deja de mostrarse', () => {
    const r = sinFlagsDePublicacion(conFlagsPrendidos());
    expect(r.online?.url).toBe('https://zoom.us/j/1');
    expect(r.material.items.map((i) => i.titulo)).toEqual(['Cap. 1', 'Guía']);
  });

  it('sin bloque online no inventa uno', () => {
    // `online` nace en null y lo crean las cascadas de modalidad: fabricarlo acá
    // haría aparecer una actividad virtual sin que nadie la haya hecho virtual.
    expect(sinFlagsDePublicacion(formVacio()).online).toBeNull();
  });

  it('el aviso lo dice solo cuando hay algo que decir', () => {
    // La casilla puede estar en una sección cerrada —`Seccion` lee
    // `abiertaPorDefecto` solo al montar— así que si no se avisa, el flag
    // restaurado no está en ninguna parte de la pantalla.
    expect(teniaFlagsDePublicacion(conFlagsPrendidos())).toBe(true);
    expect(teniaFlagsDePublicacion(formVacio())).toBe(false);
  });

  it('el formulario lo aplica al recuperar, no solo el módulo', () => {
    const fuente = fuenteDelFormulario();
    // El borrador nunca entra al formulario sin pasar por los dos saneadores.
    expect(fuente).toContain('conIdsDeCalendarioDe(sinFlagsDePublicacion(');
    expect(fuente).not.toContain('conIdsDeCalendarioDe(autoguardado.recuperado');
  });

  it('y el aviso mira las dos formas: la del borrador y la de hoy', () => {
    // Solo el primer disyunto dejaba un caso muerto: si el borrador no tenía
    // flags y el documento de hoy sí, recuperar los apaga y el aviso callaba.
    expect(fuenteDelFormulario()).toContain(
      'linksSinPublicar={teniaFlagsDePublicacion(autoguardado.recuperado.form)||teniaFlagsDePublicacion(form)}',
    );
  });
});

describe('lo recuperado entra podado (§5.2)', () => {
  /**
   * `pareceFormulario` mira dos campos de ~30. Lo que pasa esa guarda entra al
   * estado del formulario, y de ahí `formADocumento` copia `sede`, `online`,
   * `organizador` y `tallerista` tal cual — y `toPublic` proyecta los tres
   * primeros **enteros**. O sea que una clave de más en el borrador termina en
   * `events.json`. No filtra nada hoy; entra por la regla de "publica solo el
   * campo que se agregue mañana".
   */
  it('una clave que el formulario no conoce no sobrevive', () => {
    const { almacen } = almacenFalso();
    const conBasura = { ...formVacio(), notasPrivadas: 'no debería viajar' };
    guardarBorradorLocal(almacen, CLAVE, conBasura as never, AHORA);

    const leido = leerBorradorLocal(almacen, CLAVE, AHORA);
    expect(leido).not.toBeNull();
    expect(leido!.form).not.toHaveProperty('notasPrivadas');
    expect(leido!.form.titulo).toBe('');
  });

  it('poda también adentro de los objetos que toPublic proyecta enteros', () => {
    const { almacen } = almacenFalso();
    const conBasura = {
      ...formVacio(),
      sede: { ...formVacio().sede!, apodoInterno: 'la casa de Ana' },
      organizador: { nombre: 'Casa Brandon', instagram: '', web: '', telefonoPrivado: '11' },
    };
    guardarBorradorLocal(almacen, CLAVE, conBasura as never, AHORA);

    const leido = leerBorradorLocal(almacen, CLAVE, AHORA);
    expect(leido!.form.sede).not.toHaveProperty('apodoInterno');
    expect(leido!.form.organizador).not.toHaveProperty('telefonoPrivado');
    // Y lo que sí conoce llega intacto.
    expect(leido!.form.organizador.nombre).toBe('Casa Brandon');
  });

  it('no toca los arrays: sesiones y material tienen proyección campo por campo', () => {
    // `sesionPublica` e `itemPublico` enumeran, así que una clave de más no llega
    // a ninguna salida y podar cada fila sería trabajo sin destinatario.
    const { almacen } = almacenFalso();
    const form = { ...formVacio(), tags: ['poesia'] };
    guardarBorradorLocal(almacen, CLAVE, form, AHORA);
    expect(leerBorradorLocal(almacen, CLAVE, AHORA)!.form.tags).toEqual(['poesia']);
  });
});

describe('recuperar no publica ni despublica nada (§5.1, trampa 10)', () => {
  /**
   * `duplicar.ts` ya había contestado esta pregunta para el otro lugar donde se
   * aplica un formulario viejo: `estado: 'borrador'`, «duplicar no publica».
   * Recuperar aplicaba `estado` crudo, así que un borrador de hace veinte días
   * que decía `publicado` re-publicaba una actividad retirada a propósito.
   */
  const sesion = (id: string, cancelada: boolean) => ({
    id,
    inicio: '2026-09-03T19:00',
    fin: '2026-09-03T21:00',
    tema: '',
    lectura: '',
    cancelada,
    calendarEventId: null,
  });

  it('un borrador que decía «publicado» no re-publica lo que hoy está retirado', () => {
    const borrador = { ...formVacio(), estado: 'publicado' as const };
    const hoy = { ...formVacio(), estado: 'cancelado' as const };
    expect(conLoQueEsDelDocumento(borrador, hoy, false).estado).toBe('cancelado');
  });

  it('y tampoco publica un borrador sobre algo que hoy es borrador', () => {
    const borrador = { ...formVacio(), estado: 'publicado' as const };
    const hoy = { ...formVacio(), estado: 'borrador' as const };
    expect(conLoQueEsDelDocumento(borrador, hoy, false).estado).toBe('borrador');
  });

  it('el slug de una actividad publicada no lo cambia un borrador viejo (trampa 10)', () => {
    // El input está bloqueado, pero el borrador pisaba el campo sin mirar el flag:
    // un borrador anterior a publicar trae el slug todavía cascadeando del título.
    const borrador = { ...formVacio(), slug: 'taller-de-cronica-urbana-2' };
    const hoy = { ...formVacio(), slug: 'taller-de-cronica-urbana' };
    expect(conLoQueEsDelDocumento(borrador, hoy, true).slug).toBe('taller-de-cronica-urbana');
  });

  it('si el slug no está bloqueado, el del borrador es trabajo legítimo', () => {
    const borrador = { ...formVacio(), slug: 'lo-que-estaba-escribiendo' };
    const hoy = { ...formVacio(), slug: 'algo-viejo' };
    expect(conLoQueEsDelDocumento(borrador, hoy, false).slug).toBe('lo-que-estaba-escribiendo');
  });

  it('una cancelación de hoy no la revive un borrador de hace tres semanas', () => {
    // Revivirla le recrea el evento a todo el que esté suscripto.
    const borrador = { ...formVacio(), sesiones: [sesion('ses_a', false)] };
    const hoy = { ...formVacio(), sesiones: [sesion('ses_a', true)] };
    expect(conLoQueEsDelDocumento(borrador, hoy, false).sesiones[0]!.cancelada).toBe(true);
  });

  it('una fila que solo existe en el borrador conserva la suya', () => {
    const borrador = { ...formVacio(), sesiones: [sesion('ses_nueva', false)] };
    const hoy = { ...formVacio(), sesiones: [sesion('ses_a', true)] };
    expect(conLoQueEsDelDocumento(borrador, hoy, false).sesiones[0]!.cancelada).toBe(false);
  });

  it('no toca nada más de lo recuperado', () => {
    const borrador = { ...formVacio(), titulo: 'Lo que estaba escribiendo' };
    expect(conLoQueEsDelDocumento(borrador, formVacio(), false).titulo).toBe(
      'Lo que estaba escribiendo',
    );
  });

  it('el formulario aplica los tres saneadores en cadena, y el resultado va al estado', () => {
    // Los asertos de antes —el nombre de la función, y `'actual,slugBloqueado,'`—
    // no ataban nada: pasaban con una llamada muerta en cualquier parte del
    // archivo, y el segundo dependía de la coma final, así que se habría puesto
    // rojo con el código correcto el día que la llamada entre en una línea.
    const fuente = fuenteDelFormulario();
    expect(fuente).toContain(
      'setForm((actual)=>conLoQueEsDelDocumento(conIdsDeCalendarioDe(sinFlagsDePublicacion(',
    );
    // Corta antes del cierre a propósito: `slugBloqueado)` contra
    // `slugBloqueado,)` depende de si el formateador parte la llamada en varias
    // líneas, y atar eso es pintarse el aserto en una esquina.
    expect(fuente).toContain('),actual,slugBloqueado');
  });
});

describe('el molde de la poda no puede quedarse corto (B-88)', () => {
  /**
   * El molde nació escrito a mano y con la forma equivocada: le puso a
   * `tallerista` la de `organizador` —que tiene `web` y no `bio`— así que la poda
   * **borraba `tallerista.bio`** de todo borrador recuperado. Pérdida silenciosa
   * del texto más largo sobre una persona, en la función que existe para no perder
   * texto. Ahora sale de las mismas fábricas que las cascadas.
   */
  it('lo que el formulario sí conoce sobrevive a la poda: tallerista.bio', () => {
    const { almacen } = almacenFalso();
    const form = {
      ...formVacio(),
      tallerista: { ...personaVacia(), nombre: 'Ana Pérez', bio: 'Nació en Rosario' },
    };
    guardarBorradorLocal(almacen, CLAVE, form, AHORA);
    expect(leerBorradorLocal(almacen, CLAVE, AHORA)!.form.tallerista?.bio).toBe(
      'Nació en Rosario',
    );
  });

  it('y las coordenadas de la sede, que el molde tiene que conocer para podar adentro', () => {
    const { almacen } = almacenFalso();
    const form = { ...formVacio(), sede: { ...sedeVacia(), geo: { lat: -34.6, lng: -58.4 } } };
    guardarBorradorLocal(almacen, CLAVE, form, AHORA);
    expect(leerBorradorLocal(almacen, CLAVE, AHORA)!.form.sede?.geo).toEqual({
      lat: -34.6,
      lng: -58.4,
    });
  });

  it('una clave de más adentro de sede.geo tampoco pasa', () => {
    const { almacen } = almacenFalso();
    const form = {
      ...formVacio(),
      sede: { ...sedeVacia(), geo: { lat: -34.6, lng: -58.4, precision: 'exacta' } },
    };
    guardarBorradorLocal(almacen, CLAVE, form as never, AHORA);
    expect(leerBorradorLocal(almacen, CLAVE, AHORA)!.form.sede!.geo).not.toHaveProperty(
      'precision',
    );
  });

  it('una clave de más en tallerista y en online tampoco', () => {
    const { almacen } = almacenFalso();
    const form = {
      ...formVacio(),
      tallerista: { ...personaVacia(), telefonoPrivado: '11' },
      online: { ...onlineVacio(), claveDeLaSala: '1234' },
    };
    guardarBorradorLocal(almacen, CLAVE, form as never, AHORA);
    const leido = leerBorradorLocal(almacen, CLAVE, AHORA)!.form;
    expect(leido.tallerista).not.toHaveProperty('telefonoPrivado');
    expect(leido.online).not.toHaveProperty('claveDeLaSala');
  });

  it('sin sede no inventa coordenadas: el molde da la forma, no los defaults', () => {
    // Usar el molde como default metería un {lat: 0, lng: 0} —el golfo de Guinea—
    // en la sede de una actividad a la que le faltara el bloque.
    const { almacen } = almacenFalso();
    const { sede: _, ...sinSede } = formVacio();
    guardarBorradorLocal(almacen, CLAVE, sinSede as never, AHORA);
    expect(leerBorradorLocal(almacen, CLAVE, AHORA)!.form.sede?.geo ?? null).toBeNull();
  });

  it('un bloque a medias también se completa: material sin items no rompe la isla', () => {
    // Completar de primer nivel no alcanzaba: la clave incompleta se conservaba
    // tal cual, `material.items` quedaba `undefined`, y `teniaFlagsDePublicacion`
    // —que se llama en el JSX— tiraba en el render.
    const { almacen } = almacenFalso();
    const form = { ...formVacio(), material: { tiene: true } };
    guardarBorradorLocal(almacen, CLAVE, form as never, AHORA);
    const leido = leerBorradorLocal(almacen, CLAVE, AHORA)!.form;
    expect(leido.material).toEqual({ tiene: true, items: [] });
    expect(() => teniaFlagsDePublicacion(leido)).not.toThrow();
  });

  it('sin sede no inventa ni coordenadas ni ciudad (§5.1)', () => {
    // `sedeVacia()` trae `ciudad: 'CABA'`, y `toPublic` proyecta `sede` entera:
    // completar con la fábrica publicaba una ubicación que nadie cargó. Es el
    // mismo argumento del golfo de Guinea, una capa más arriba.
    const { almacen } = almacenFalso();
    const { sede: _, ...sinSede } = formVacio();
    guardarBorradorLocal(almacen, CLAVE, sinSede as never, AHORA);
    expect(leerBorradorLocal(almacen, CLAVE, AHORA)!.form.sede).toBeNull();
  });

  it('sin tallerista tampoco lo inventa', () => {
    const { almacen } = almacenFalso();
    const { tallerista: _, ...sinTallerista } = formVacio();
    guardarBorradorLocal(almacen, CLAVE, sinTallerista as never, AHORA);
    expect(leerBorradorLocal(almacen, CLAVE, AHORA)!.form.tallerista).toBeNull();
  });

  it('una clave que falta se completa, así ningún consumidor tira', () => {
    // `pareceFormulario` mira 2 campos de ~30, así que un borrador sin `material`
    // pasa; el primero que haga `f.material.items.some(...)` se lleva la isla.
    const { almacen } = almacenFalso();
    const { material: _, ...sinMaterial } = formVacio();
    guardarBorradorLocal(almacen, CLAVE, sinMaterial as never, AHORA);
    const leido = leerBorradorLocal(almacen, CLAVE, AHORA)!.form;
    expect(leido.material).toEqual({ tiene: false, items: [] });
    expect(() => teniaFlagsDePublicacion(leido)).not.toThrow();
  });
});

describe('la versión del formato y la forma del formulario no derivan por separado (B-88)', () => {
  /**
   * `VERSION_BORRADOR` era una convención escrita en un comentario: "se sube
   * cuando el formulario cambia de forma". Nada la verificaba, y es la clase de
   * B-88 —el productor de un formato y su consumidor derivando por separado—.
   *
   * **Se fijan las rutas en profundidad y no las 19 claves de arriba**, porque el
   * drift que hubo fue anidado: el molde tenía mal la forma de `tallerista` y un
   * test de primer nivel pasaba igual. Agregar `Persona.telefono` o `Sede.piso`
   * pone rojo esto, y ahí hay que decidir si el borrador viejo sigue sirviendo: si
   * sirve, se actualiza la lista; si no, se sube la versión.
   */
  const rutas = (v: unknown, prefijo = ''): string[] => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) return [prefijo];
    return Object.keys(v).flatMap((k) =>
      rutas((v as Record<string, unknown>)[k], prefijo ? `${prefijo}.${k}` : k),
    );
  };

  it('cambiar la forma del formulario, también adentro, obliga a pasar por acá', () => {
    expect(
      rutas({
        ...formVacio(),
        tallerista: personaVacia(),
        online: onlineVacio(),
        // `sede.geo` va con su fábrica: con el `null` de `formVacio()` entraba
        // como hoja y las claves de adentro no se enumeraban, así que un campo
        // nuevo en las coordenadas lo tiraba la poda **en silencio** y este test
        // quedaba verde afirmando la pérdida.
        sede: { ...sedeVacia(), geo: geoVacia() },
      }).sort(),
    )
      .toEqual([
        'arancel.notas',
        'arancel.tipo',
        'descripcion',
        'destacado',
        'difusion.arrobar',
        'difusion.notas',
        'esCiclo',
        'estado',
        'imagenes',
        'inscripcion.cierra',
        'inscripcion.cupo',
        'inscripcion.destino',
        'inscripcion.requiere',
        'inscripcion.via',
        'material.items',
        'material.tiene',
        'modalidad',
        'online.plataforma',
        'online.url',
        'online.urlPublica',
        'organizador.instagram',
        'organizador.nombre',
        'organizador.web',
        'sede.barrio',
        'sede.ciudad',
        'sede.direccion',
        'sede.geo.lat',
        'sede.geo.lng',
        'sede.indicaciones',
        'sede.nombre',
        'sesiones',
        'slug',
        'tags',
        'tallerista.bio',
        'tallerista.instagram',
        'tallerista.nombre',
        'tipo',
        'titulo',
      ]);
    // Subió a 2 con B-167: el formulario pasó de `imagenUrl` a `imagenes`, y un
    // borrador viejo aplicado sobre la forma nueva **parece bueno** — que es
    // justo lo peligroso. Esta es la primera vez que esta red se ejerce de
    // verdad, y funcionó: el cambio de forma la puso roja.
    expect(VERSION_BORRADOR).toBe(2);
  });
});
