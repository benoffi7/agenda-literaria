---
name: que-deployar
description: Dice qué hay que deployar de este repo y con qué comandos exactos, en el orden correcto, y qué verificar después. Atajo para tipear antes de un deploy a mano o para entender qué va a hacer el workflow de main.
disable-model-invocation: true
---

# Qué deployar

Atajo de consulta. **No deploya nada**: imprime la decisión y los comandos. El
deploy lo corre una persona.

Argumentos opcionales en `$ARGUMENTS`: un rango de commits (`main..HEAD`) o
`todo`.

## 1 · Qué cambió

La decisión **no se improvisa**: vive en un script, y está testeada en
`tests/que-deployar.test.ts`.

```bash
git diff --name-only main...HEAD | ./scripts/que-deployar.sh
```

Devuelve tres líneas: `hosting=`, `functions=`, `firestore=`.

Los criterios, para poder explicar la salida:

- **Reglas e índices:** cambió `firestore.rules` o `firestore.indexes.json`.
- **Functions:** cambió algo en `functions/` o `firebase.json`.
- **Hosting: lista negra, a propósito.** Se deploya salvo que **todo** lo que
  cambió sea provablemente incapaz de afectar el bundle. El bundle del panel
  depende de cosas fuera de `src/` — hoy `functions/calendario.js` por el alias
  `@calendario` — y una lista blanca se pierde ese caso **en silencio**: el build
  queda verde y producción se queda con el panel viejo. Un archivo nuevo y
  desconocido cae del lado de deployar, que es el error barato.

## 2 · El camino normal: un push a `main`

`.github/workflows/push-main.yml` hace todo esto solo, con los tests como gate y
**con los emuladores** (`EXIGIR_EMULADOR=1`, para que los tests de integración
fallen en vez de saltearse). También crea el tag cuando cambia `version` en
`package.json`.

Para deployar todo sin mirar el diff: Actions → «Deploy desde main» → Run
workflow → *Deployar todo*.

`deploy.yml` es otra cosa: es el deploy de **datos** del §8, lo dispara la
Function cuando cambia una actividad y solo republica el sitio.

## 3 · A mano, si hace falta

**El orden importa: reglas → hosting → functions.** Si el panel nuevo escribe
campos que las reglas viejas rechazan, el orden inverso deja una ventana de
escrituras fallidas.

```bash
npm run typecheck && npm test

# 1 · reglas e índices
firebase deploy --only firestore:rules,firestore:indexes

# 2 · sitio y panel
npm run build
./scripts/verificar-bundle.sh dist        # gate del §5.4 / trampa 4
firebase deploy --only hosting

# 3 · functions — SIEMPRE con filtro, nunca `--only functions` pelado
firebase deploy --only functions:syncCalendar,functions:rebuildPorOpciones,functions:guardarVersion
```

**Por qué el filtro:** hay Functions escritas que **no se deben desplegar
todavía** porque les falta una credencial que solo puede crear el dueño —
`dispararRebuild` y `reporteAIssue` necesitan el PAT en Secret Manager (B-20,
D-13). Un `--only functions` sin filtro las incluye. Antes de deployar, confirmá
la lista contra `docs/02-infraestructura.md` y `docs/08-operacion.md`: es la
única fuente de verdad de qué está desplegado y qué no.

## 4 · Verificar después

**Es un script desde B-116.** Antes eran nueve bloques de markdown repartidos
entre `07-seguridad.md` y `08-operacion.md` que había que copiar, pegar en orden e
interpretar de a uno — o sea que se corrían cuando alguien se acordaba.

```bash
# la credencial no se filtró al bundle (§5.4, trampa 4) — este sigue aparte
# porque mira el `dist/` local y no producción
./scripts/verificar-bundle.sh dist

# todo lo que se lee del sistema real: escritura y lectura anónimas rechazadas,
# el control positivo de /opciones, las cabeceras de cache contra lo que
# firebase.json declara, y qué versión quedó publicada
node scripts/verificar-produccion.mjs

# y, si se tocó el sync, además el calendario real
GOOGLE_CALENDAR_ICS_PRIVADO='https://…/private-…/basic.ics' \
  node scripts/verificar-produccion.mjs
```

Tres cosas para leer bien la salida:

- **Un `—` es un chequeo saltado, y no cuenta como verde.** El script dice por
  qué no pudo (falta la URL del ICS, no hay `gh`, no hubo red). La diferencia
  entre «lo verifiqué» y «no pude» es la mitad del valor.
- **Las cabeceras de cache salen de `firebase.json`**, no de una lista escrita:
  una regla nueva se verifica sola. La lista pegada que había acá enumeraba tres
  rutas y hay cuatro.
- **La URL privada del ICS va por variable de entorno**, nunca en el repo ni
  pegada en un chat: da acceso de lectura al calendario entero. El script no la
  imprime.

Un `+…-sucio.…` en la versión avisa que se buildeó con cambios sin commitear: lo
publicado no corresponde exactamente a ningún commit, y el script lo marca como
fallado.

## 5 · Qué NO hacer

- No corras `firebase deploy --only functions` sin filtro.
- No deployes con la suite en rojo ni salteando `EXIGIR_EMULADOR` cuando el
  cambio toca `firestore.rules`: sin los emuladores, "verde" no distingue *las
  reglas pasaron* de *las reglas no se probaron*.
- No crees credenciales, PATs ni keys de service account: son del dueño (§5.4,
  B-20).
- No desarrolles el sync contra el calendario real: un bug en el diff crea o
  borra eventos de verdad (§10).
