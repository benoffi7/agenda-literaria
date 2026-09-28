import { useEffect, useState } from 'react';
import type { Indice } from '@/lib/eventsJson';

/**
 * **El `events.json` publicado, una vez por pestaña** — roadmap 5.4.
 *
 * Lo usa el aviso de posibles duplicados del formulario (`formulario/duplicados.ts`,
 * donde está el porqué de comparar contra el índice y no contra Firestore). Se pide
 * **una sola vez** y se comparte: abrir diez formularios seguidos no son diez
 * pedidos. `no-store` y una query única por lo mismo que el boletín: lo que se
 * quiere es el último índice publicado, no el que tenga el navegador.
 *
 * **Si falla, no hay aviso y nada más**: el formulario no puede depender de que el
 * sitio público esté arriba. El próximo formulario lo vuelve a intentar.
 *
 * **Y vence a los 15 minutos** (lo señaló el `auditor-trampas`): el panel se deja
 * abierto días, y sin vencimiento una pestaña vieja compararía contra el índice
 * del día que se abrió, no contra el atraso del rebuild (~7 minutos, §8) que dice
 * la documentación. 15 es el doble de ese atraso: pedirlo más seguido no trae
 * nada nuevo.
 */
const VENCE_MS = 15 * 60 * 1000;
let pedido: Promise<Indice | null> | null = null;
let pedidoEn = 0;

const pedirIndice = (ahora = Date.now()): Promise<Indice | null> => {
  if (pedido && ahora - pedidoEn > VENCE_MS) pedido = null;
  if (!pedido) pedidoEn = ahora;
  pedido ??= fetch(`/events.json?t=${Date.now()}`, { cache: 'no-store' })
    .then((r) => (r.ok ? (r.json() as Promise<Indice>) : null))
    .catch(() => null)
    .then((indice) => {
      if (!indice) pedido = null;
      return indice;
    });
  return pedido;
};

export const useIndicePublicado = (activo = true): Indice | null => {
  const [indice, setIndice] = useState<Indice | null>(null);
  useEffect(() => {
    if (!activo) return;
    let vivo = true;
    pedirIndice().then((i) => vivo && setIndice(i));
    return () => {
      vivo = false;
    };
  }, [activo]);
  return indice;
};
