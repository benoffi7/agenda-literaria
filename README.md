# Agenda de actividades literarias

Sitio público de talleres de escritura, clubes de lectura, encuentros y
presentaciones en Argentina, con panel propio de carga.

Las decisiones de arquitectura están en **[CLAUDE.md](./CLAUDE.md)** — leerlo
antes de tocar código. El estado de la implementación, el inventario de
infraestructura, los patrones, el changelog y el backlog están en
**[`docs/`](./docs/README.md)**.

**Al terminar cualquier cambio de código, actualizar `docs/`.** Los reportes de
bug van al [backlog](./docs/BACKLOG.md) por prioridad. Detalle en
[`docs/05-patrones.md`](./docs/05-patrones.md).

## Estado

| Paso (§10) | Estado |
|---|---|
| 1. Modelo + reglas + emuladores | ✅ |
| 2. Panel de admin (React) | ✅ formulario completo |
| 3. Sitio público (SSG) | ⬜ placeholder |
| 4. Sync a Google Calendar | ✅ |
| 5. Trigger de rebuild | 🟡 código y workflow listos; faltan las credenciales del dueño |

## Arrancar

```bash
npm install
cp .env.example .env        # completar con la config del proyecto Firebase
```

Dos terminales:

```bash
npm run emu                 # emuladores: Auth 9099, Firestore 8080, Storage 9199, UI 4000
npm run seed                # siembra /opciones/* con las opciones base (§4.1)
npm run dev                 # Astro en :4321 — el panel está en /admin
```

Para que el panel deje escribir hace falta el custom claim `admin` (§5.3).
Entrá una vez a `/admin` con el popup del emulador, y después:

```bash
npm run admin:claim -- --todos     # da admin a los usuarios del emulador
```

Salí y volvé a entrar: el claim entra al token en el próximo login.

En producción el uid va explícito, con otro script para que nadie le dé admin a
una cuenta real creyendo estar en local:

```bash
npm run admin:claim:prod -- <uid|email>
```

### Nota sobre Java

Los emuladores exigen JDK 21+. En esta máquina el default es el JDK 17 que trae
Android Studio, así que el script `emu` apunta a `openjdk@21` de Homebrew sin
tocar el `JAVA_HOME` global. Si no lo tenés: `brew install openjdk@21`.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Astro en modo desarrollo |
| `npm run build` | Build estático a `dist/` |
| `npm test` | Tests unitarios (vitest) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run emu` | Emuladores de Firebase, con import/export de estado |
| `npm run seed` | Siembra `/opciones/*` en el emulador |
| `npm run admin:claim -- --todos` | Da el claim `admin` a los usuarios del emulador |
| `npm run admin:claim:prod -- <uid\|email>` | Setea el claim `admin` en producción |

## Mapa del código

```
src/
  types/actividad.ts        modelo de §3 en TypeScript
  lib/
    slugify.ts              normalización de taxonomías (§4.2)
    normalize.ts            searchText y búsqueda sin acentos (§6)
    sesiones.ts             ids uuid, generador de N encuentros (§11)
    schema.ts               validación del form, condicionales de §11
    actividades.ts          CRUD y conversión form ⇄ documento
    opciones.ts             taxonomías autogestionadas (§4)
    toPublic.ts             proyección pública (§5.2)
    firebase-client.ts      auth y Firestore del panel
    firebase-admin.ts       SOLO build time (§5.4)
  components/admin/         panel: form, sesiones, material, taxonomías
  pages/admin.astro         island client:only
firestore.rules             reglas de §5.3
scripts/                    seed del emulador, custom claim
tests/                      cobertura de las trampas de §13
```

## Seguridad

- `firebase-admin` no puede importarse desde código de cliente (§5.4). El
  módulo tiene una guarda que tira error si se intenta, y el build verifica que
  no aparezca en `dist/`.
- El link de la reunión virtual nunca sale al JSON público ni al calendario
  (§5.1, trampa 5). El checkbox para publicarlo arranca destildado.
- La service account key va en variable de entorno de CI, nunca en el repo.
- La URL privada del ICS del calendario es un secreto: va en `.env`, no acá.

## Sync a Google Calendar (§7)

El calendario es un **espejo de solo lectura**: Firestore es la única fuente de
verdad y el flujo es unidireccional (§2.1). Si alguien edita un evento directo
en Calendar, ese cambio se pierde en el próximo sync — es el comportamiento
esperado, no un bug.

```
functions/
  calendario.js   diff y armado del evento — lógica pura, testeable sin red
  rebuild.js      backoff y corte por intentos del rebuild — lógica pura (§8)
  index.js        los triggers de Firestore y el schedule del rebuild
```

`calendario.js` no importa Firebase ni googleapis a propósito: el diff es la
parte más frágil del sistema y así se testea sin emuladores y sin tocar un
calendario real. Los 27 tests de `tests/calendario.test.ts` cubren la guarda
anti-loop, el diff por id y la propagación de un cambio de sede a las N
sesiones del ciclo.

### Autenticación

La Function **corre como** la service account
`calendar-sync@agenda-literaria.iam.gserviceaccount.com` y toma el token de las
credenciales de su propio runtime.

Es un desvío respecto del §2.6, que habla de autenticar con la *key* de la
service account: el resultado es el mismo y no queda ninguna key para guardar,
rotar ni filtrar. El setup del calendario es idéntico — compartirlo con el mail
de la service account dándole **"Realizar cambios en los eventos"**.

### Desplegar

```bash
firebase deploy --only functions:syncCalendar,functions:rebuildPorOpciones
```

`dispararRebuild` (§8) queda **sin desplegar** hasta que el dueño cree el PAT de
GitHub en Secret Manager y la credencial de deploy: sin eso es un schedule cada
5 minutos que no puede disparar nada. El workflow que lo atiende ya existe
(`.github/workflows/deploy.yml`) y los pasos manuales están en
[`docs/08-operacion.md`](docs/08-operacion.md).
