import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Los roles de `deploy-ci@`, declarados en dos documentos que tienen que coincidir.
 *
 * **Por qué existe este test** (B-195). `02-infraestructura.md` es el inventario y
 * `07-seguridad.md` es donde se razona el radio de daño de la única key del
 * proyecto. El 2026-08-25 se le agregaron dos roles, se actualizó el inventario y
 * **no** la afirmación de seguridad, que siguió diciendo "el daño se limita a leer
 * datos que ya son públicos — no a modificar la base" cuando ya no era verdad: con
 * `firebaserules.admin`, una key filtrada podía reescribir las reglas del §5.3 y
 * hacer legible todo Firestore.
 *
 * Una afirmación de seguridad que miente es peor que no tenerla, porque se usa para
 * decidir. Así que las dos listas se atan acá.
 *
 * **Qué cambió el 2026-08-28 (D-132).** Este test exigía además que no hubiera
 * ningún rol de escritura. Esa exigencia era D-119 escrita como test, y D-119 se
 * revirtió: hoy la cuenta despliega reglas y Functions a propósito. Mantener el
 * aserto sería exigir que la decisión del dueño no exista, y aflojarlo a nada sería
 * perder el único chequeo que hay.
 *
 * Así que se invirtió, conservando lo que de verdad protegía: **mientras la lista
 * declare un rol de escritura, `07-seguridad.md` no puede afirmar que el daño se
 * limita a leer.** El pecado del 2026-08-25 no fue tener el rol — fue tenerlo y
 * seguir diciendo que no. Esto último es lo que queda prohibido.
 *
 * **Lo que este test NO puede afirmar:** que la política real de IAM sea ésta. Eso
 * vive en GCP y se consulta con el comando que documenta `02-infraestructura.md`.
 * Acá se verifica lo que sí es verificable sin credenciales — que los dos
 * documentos digan lo mismo, y que la afirmación acompañe a la lista.
 */
const fuente = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(`../${rel}`, import.meta.url)), 'utf8');

/** Los `roles/...` que un documento declara como los que la cuenta tiene hoy. */
const rolesDeclarados = (texto: string): string[] => [
  ...new Set([...texto.matchAll(/roles\/([a-zA-Z.]+)/g)].map((m) => m[1]!)),
];

/** El primer bloque cercado que sigue a un encabezado dado. */
const bloqueTras = (md: string, encabezado: string, archivo: string): string => {
  const desde = md.indexOf(encabezado);
  expect(desde, `no se encontró «${encabezado}» en ${archivo}`).toBeGreaterThan(-1);
  const abre = md.indexOf('```', desde);
  const cierra = md.indexOf('```', abre + 3);
  expect(cierra, `bloque sin cerrar tras «${encabezado}» en ${archivo}`).toBeGreaterThan(-1);
  return md.slice(abre + 3, cierra);
};

/**
 * El inventario de `02-infraestructura.md`: solo el bloque, porque el texto de
 * alrededor **nombra a propósito** roles que la cuenta no tiene —los que se
 * evaluaron y se descartaron—, y contarlos como vigentes sería leer al revés.
 */
const bloqueInventario = (): string =>
  bloqueTras(fuente('docs/02-infraestructura.md'), '### Roles de `deploy-ci@`', '02-infraestructura.md');

/** La enumeración de `07-seguridad.md`, en su propio bloque por el mismo motivo. */
const bloqueSeguridad = (): string =>
  bloqueTras(
    fuente('docs/07-seguridad.md'),
    '**La key de `deploy-ci@` es la única key del proyecto**',
    '07-seguridad.md',
  );

/** Roles que permiten cambiar algo, no solo leerlo. */
const deEscritura = (roles: string[]): string[] =>
  roles.filter((r) => /(admin|editor|owner|writer|developer|serviceAccountUser)$/i.test(r));

describe('los roles de deploy-ci@ se declaran igual en los dos documentos — B-195', () => {
  it('el inventario declara al menos los tres roles mínimos', () => {
    // Control positivo: sin esto, dos extracciones vacías coincidirían entre sí.
    expect(rolesDeclarados(bloqueInventario()).length).toBeGreaterThanOrEqual(3);
  });

  it('07-seguridad enumera exactamente los roles del inventario', () => {
    expect(rolesDeclarados(bloqueSeguridad()).sort()).toEqual(
      rolesDeclarados(bloqueInventario()).sort(),
    );
  });
});

describe('la afirmación de seguridad acompaña al radio real de la key — D-132', () => {
  /**
   * La frase exacta que estuvo mintiendo una hora, en la forma en que se escribió.
   * Se busca sin el markdown intermedio para que reformatear el párrafo no la
   * esconda: lo que se prohíbe es la afirmación, no una cadena literal.
   */
  const afirmaQueSoloLee = (md: string): boolean => {
    const plano = md
      .replace(/\*\*|`|—/g, ' ')
      .replace(/\s+/g, ' ')
      .toLowerCase();
    // Solo cuenta como afirmación vigente si no viene marcada como caducada.
    return /el daño se limita a (leer|datos)/.test(plano) && !/ya no es cierto|caduc/.test(plano);
  };

  it('mientras la lista declare un rol de escritura, 07-seguridad no dice que solo se lee', () => {
    const escritura = deEscritura(rolesDeclarados(bloqueInventario()));
    if (escritura.length === 0) return; // Si algún día se vuelve a D-119, no aplica.

    const md = fuente('docs/07-seguridad.md');
    const desde = md.indexOf('**La key de `deploy-ci@` es la única key del proyecto**');
    const seccion = md.slice(desde, md.indexOf('\n## ', desde));

    expect(
      afirmaQueSoloLee(seccion),
      `la cuenta tiene ${escritura.join(', ')} y 07-seguridad sigue diciendo que el daño ` +
        'se limita a leer. Es exactamente el drift del 2026-08-25 (D-119, D-132).',
    ).toBe(false);
  });

  it('y sí nombra lo que la key puede cambiar', () => {
    const escritura = deEscritura(rolesDeclarados(bloqueInventario()));
    if (escritura.length === 0) return;

    const md = fuente('docs/07-seguridad.md');
    const desde = md.indexOf('**La key de `deploy-ci@` es la única key del proyecto**');
    const seccion = md.slice(desde, md.indexOf('\n## ', desde));

    // Control negativo del test de arriba: que no diga la frase falsa no alcanza,
    // porque borrar el párrafo entero también lo cumpliría.
    expect(seccion, 'la sección no dice qué puede hacer la key si se filtra').toMatch(
      /puede cambiar qué es legible|hacer legible todo Firestore/i,
    );
  });
});
