#!/usr/bin/env bash
#
# Manda un aviso por mail — B-1140.
#
# ── Por qué es un script y no dos bloques de YAML ─────────────────────────
# Lo usan los dos jobs de aviso de `deploy.yml` —el de «se rompió» y el de
# «volvió»— y serían dos copias del mismo `curl`, con la de siempre: la que se
# olvide de actualizar es la que falla el día que hace falta (D-88). Y sobre
# todo: **acá se puede correr a mano**, que es lo único que convierte un aviso
# escrito en un aviso probado.
#
#     MAIL_AVISOS_DESTINO=... MAIL_AVISOS_USUARIO=... MAIL_AVISOS_PASSWORD=... \
#       ./scripts/mail-de-aviso.sh 'Prueba' 'Si esto llega, el aviso funciona.'
#
# Un aviso que nunca se probó es un aviso que no existe: se descubre roto el día
# que hacía falta, que es exactamente lo que pasó con el mecanismo anterior
# (B-883: quince corridas rojas sin que nadie se enterara).
#
# ── Por qué `curl` y no una action ────────────────────────────────────────
# Una action de terceros acá recibiría las credenciales del correo, y eso es
# superficie que un aviso no necesita. `curl` ya está en el runner y en
# cualquier máquina.
#
# ── Lo que NO hace, y es a propósito ──────────────────────────────────────
# **No decide qué avisar ni arma el cuerpo**: recibe asunto y cuerpo ya escritos.
# Quien llama sabe qué pasó; esto sabe mandar un mail.
#
# **Y nunca devuelve error.** Un aviso que falla no puede poner en rojo la
# corrida que venía a avisar (punto 3 de B-883): avisa por `stderr` y termina en
# 0. Quien quiera saber si salió, que mire el log.
set -uo pipefail

ASUNTO="${1:-}"
CUERPO="${2:-}"

rendirse() {
  printf '⚠ no se pudo mandar el aviso por mail: %s\n' "$1" >&2
  exit 0
}

[ -n "$ASUNTO" ] || rendirse 'falta el asunto'
[ -n "${MAIL_AVISOS_DESTINO:-}" ] || rendirse 'falta MAIL_AVISOS_DESTINO'
[ -n "${MAIL_AVISOS_USUARIO:-}" ] || rendirse 'falta MAIL_AVISOS_USUARIO'
[ -n "${MAIL_AVISOS_PASSWORD:-}" ] || rendirse 'falta MAIL_AVISOS_PASSWORD'

# El servidor sale del entorno para poder probar contra otro (o contra un SMTP
# de mentira) sin tocar esto. El default es el de la casilla del proyecto.
SERVIDOR="${MAIL_AVISOS_SMTP:-smtps://smtp.gmail.com:465}"

MENSAJE=$(mktemp) || rendirse 'no se pudo escribir el mensaje'
trap 'rm -f "$MENSAJE"' EXIT

# El asunto va **en ASCII**: un `Subject:` con acentos sin codificar llega como
# mojibake en varios clientes, y el cuerpo —que sí va en UTF-8 declarado— ya
# dice todo. Quien llama escribe el asunto sin acentos a propósito.
{
  printf 'From: Agenda LEH <%s>\n' "$MAIL_AVISOS_USUARIO"
  printf 'To: %s\n' "$MAIL_AVISOS_DESTINO"
  printf 'Subject: %s\n' "$ASUNTO"
  printf 'Content-Type: text/plain; charset=UTF-8\n'
  printf '\n'
  printf '%s\n' "$CUERPO"
} > "$MENSAJE"

curl --silent --show-error --ssl-reqd \
  --url "$SERVIDOR" \
  --user "$MAIL_AVISOS_USUARIO:$MAIL_AVISOS_PASSWORD" \
  --mail-from "$MAIL_AVISOS_USUARIO" \
  --mail-rcpt "$MAIL_AVISOS_DESTINO" \
  --upload-file "$MENSAJE" \
  || rendirse 'el SMTP rechazó el envío'

printf 'aviso mandado a %s\n' "$MAIL_AVISOS_DESTINO"
exit 0
