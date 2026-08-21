# Agenda de actividades literarias

Sitio público de talleres de escritura, clubes de lectura, encuentros y
presentaciones en Argentina, con panel propio de carga.

Las decisiones de arquitectura están en **[CLAUDE.md](./CLAUDE.md)** — leerlo
antes de tocar código.

## Estado

| Paso (§10) | Estado |
|---|---|
| 1. Modelo + reglas + emuladores | ✅ |
| 2. Panel de admin (React) | ✅ formulario completo |
| 3. Sitio público (SSG) | ⬜ placeholder |
| 4. Sync a Google Calendar | ⬜ |
| 5. Trigger de rebuild | ⬜ |

## Arrancar

```bash
npm install
cp .env.example .env        # completar con la config del proyecto Firebase
```

Dos terminales:

```bash
npm run emu                 # emuladores: Auth 9099, Firestore 8080, UI 4000
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
