/**
 * El setup del proyecto `render` de vitest — B-2203.
 *
 * `useActividades` guarda la última lectura a nivel de módulo para que el panel no
 * relea la colección en cada cambio de vista. Dentro de un archivo de tests eso
 * es estado compartido entre casos que mockean la lectura con datos distintos:
 * sin esto, un caso vería la lista del anterior.
 *
 * **Import dinámico y adentro del `beforeEach`, a propósito.** Uno estático cargaría
 * `@/lib/actividades` real antes de que el archivo de tests registre su `vi.mock`,
 * y los mocks dejarían de aplicar.
 */
import { beforeEach } from 'vitest';

beforeEach(async () => {
  const { olvidarActividadesLeidas } = await import('@/components/admin/useActividades');
  olvidarActividadesLeidas();
});
