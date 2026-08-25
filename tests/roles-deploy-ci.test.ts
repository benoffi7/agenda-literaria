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
 * **Lo que este test NO puede afirmar:** que la política real de IAM sea ésta. Eso
 * vive en GCP y se consulta con el comando que documenta `02-infraestructura.md`.
 * Acá se verifica lo que sí es verificable sin credenciales — que los dos
 * documentos digan lo mismo —, que es exactamente el drift que ocurrió.
 */
const fuente = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(`../${rel}`, import.meta.url)), 'utf8');

/** Los `roles/...` que un documento declara como los que la cuenta tiene hoy. */
const rolesDeclarados = (texto: string): string[] => [
  ...new Set([...texto.matchAll(/roles\/([a-zA-Z.]+)/g)].map((m) => m[1]!)),
];

/**
 * El bloque de código de `02-infraestructura.md` § "Roles de `deploy-ci@`" — solo
 * el bloque, porque el texto de alrededor **nombra a propósito** los dos roles que
 * se quitaron, y contarlos como vigentes sería leer al revés.
 */
const bloqueInventario = (): string => {
  const md = fuente('docs/02-infraestructura.md');
  const desde = md.indexOf('### Roles de `deploy-ci@`');
  expect(desde, 'no se encontró la sección de roles en 02-infraestructura.md').toBeGreaterThan(-1);
  const abre = md.indexOf('```', desde);
  const cierra = md.indexOf('```', abre + 3);
  return md.slice(abre + 3, cierra);
};

/** El párrafo de `07-seguridad.md` que enumera lo que la cuenta tiene. */
const parrafoSeguridad = (): string => {
  const md = fuente('docs/07-seguridad.md');
  const desde = md.indexOf('**La key de `deploy-ci@` es la única key del proyecto**');
  expect(desde, 'no se encontró el párrafo de la key en 07-seguridad.md').toBeGreaterThan(-1);
  // Hasta el fin del párrafo: es donde está la enumeración.
  return md.slice(desde, md.indexOf('\n\n', desde));
};

describe('los roles de deploy-ci@ se declaran igual en los dos documentos — B-195', () => {
  it('el inventario declara al menos los tres roles mínimos', () => {
    // Control positivo: sin esto, dos extracciones vacías coincidirían entre sí.
    expect(rolesDeclarados(bloqueInventario()).length).toBeGreaterThanOrEqual(3);
  });

  it('07-seguridad enumera exactamente los roles del inventario', () => {
    expect(rolesDeclarados(parrafoSeguridad()).sort()).toEqual(
      rolesDeclarados(bloqueInventario()).sort(),
    );
  });

  it('ninguno de los dos declara un rol de escritura', () => {
    // La propiedad que hace verdadera la afirmación del §5.4: si aparece un rol
    // `admin`, `editor`, `owner` o `writer` que no sea el de Hosting, el radio de
    // la key cambió y la afirmación de seguridad hay que volver a escribirla.
    const escritura = (rs: string[]) =>
      rs.filter((r) => /(admin|editor|owner|writer)$/i.test(r) && r !== 'firebasehosting.admin');
    expect(escritura(rolesDeclarados(bloqueInventario())), 'inventario').toEqual([]);
    expect(escritura(rolesDeclarados(parrafoSeguridad())), '07-seguridad').toEqual([]);
  });
});
