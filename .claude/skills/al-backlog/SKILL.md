---
name: al-backlog
description: Anota un reporte de bug, una sospecha o una idea en docs/BACKLOG.md con su prioridad, en el lugar correcto y con el formato del archivo. Invocalo SIEMPRE que aparezca un posible bug — lo reporte el usuario, lo encuentre un auditor o se descubra al programar — incluso si se arregla en el momento, porque la regla de proceso de este repo pide que quede el rastro. También cuando el usuario diga "anotá esto", "esto es un bug" o "/al-backlog".
---

# Anotar en el backlog

Regla de proceso de `docs/05-patrones.md`: **todo reporte de posible bug va a
`docs/BACKLOG.md`, ordenado por prioridad, incluso si se arregla en el momento**
— en ese caso entra ya cerrado, para que quede el rastro de qué se rompió y por
qué.

El reporte a anotar viene en `$ARGUMENTS` o de la conversación.

## 1 · Antes de escribir: ¿ya está?

```bash
grep -n "B-" docs/BACKLOG.md | tail -40
```

Leé la sección **Cerrados** además de las abiertas. Si el ítem ya existe, **no
abras otro**: agregá el dato nuevo al que está (un síntoma más, un caso que lo
reproduce, la versión en que se vio) y decilo.

## 2 · Clasificar

**Prioridad**, con el criterio del propio archivo:

| | Cuándo |
|---|---|
| **P0** | rompe algo o pierde datos. Va arriba de todo y se arregla ya |
| **P1** | bloquea el objetivo del proyecto — que la gente encuentre las actividades en Google |
| **P2** | mejora real |
| **P3** | cuando sobre tiempo |

Y **la sección**, que no siempre es la de la prioridad:

- **Decisiones pendientes del usuario** (`DEC-x`): no se puede avanzar sin una
  respuesta del dueño. Van primero porque bloquean trabajo.
- **Pendiente de acción manual del dueño**: el código está listo y falta una
  credencial o un paso de consola que un agente no debe hacer (§5.4) — un PAT,
  una key de service account, un toggle de la consola de Firebase.
- **P1 / P2 / P3**: el resto.
- **Cerrados**: lo que ya se arregló. Es una tabla `Qué | Causa | Dónde`.

## 3 · Escribir

**Ítem abierto** — encabezado `### B-xx · Título en una línea` con el siguiente
`B-xx` libre (miralo, no lo adivines), y después:

- qué pasa, en el idioma de quien lo reportó, sin traducirlo a jerga;
- **por qué vale la pena** arreglarlo, o qué se pierde si no: es lo que hace que
  el ítem se pueda priorizar meses después;
- dónde está el código (archivo, `D-xx`, `§`, trampa) si se sabe;
- si el arreglo es chico y está claro, decilo ("es **una línea** en
  `AdminApp`"): eso es lo que hace que alguien lo tome.

**Ítem que nace cerrado** — fila en la tabla de **Cerrados**:

| Qué | Causa | Dónde |
|---|---|---|
| el síntoma que se vio | **la causa real**, no "se arregló" | commit corto, `D-xx` o archivo |

La columna del medio es la que sirve dentro de seis meses: sin la causa, la fila
no enseña nada.

**Ítem que se cierra ahora** (ya existía y se arregló): dejalo donde está,
agregale `— ✅ hecho (AAAA-MM-DD)` al título y no borres el texto. El rastro
importa más que la prolijidad de la lista.

## 4 · Datos que hacen accionable un reporte del panel

Si el reporte vino del panel o de un issue con la etiqueta `reporte-panel`,
copiá lo que ya trae y sirve para reproducir: **versión del bundle**
(`0.1.0+<sha>`), navegador, tamaño de ventana, ruta y **zona horaria** (sin la
zona, un bug de fechas no se diagnostica — trampa 1). El número del issue va
como referencia.

**No copies** al backlog el mail ni el uid de quien reportó, ni links de reunión:
`docs/BACKLOG.md` está versionado en un repo público (§5.1). Lo que trae el
issue ya viene filtrado (`redactar()`); lo que te pase el usuario a mano, no.

## 5 · Cerrar

Decí en una línea qué ítem quedó anotado, con qué prioridad y en qué sección. Si
además hay que arreglarlo ahora, eso es un cambio aparte y termina con el skill
`cerrar-cambio`.
