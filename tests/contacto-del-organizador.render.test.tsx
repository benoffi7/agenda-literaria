import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Roadmap 2.6 — al elegir un organizador que ya existe, se **ofrecen** su
 * Instagram y su web de las otras actividades, y se aplican con un clic. Nada
 * se completa solo.
 */
vi.mock('@/lib/analytics', () => ({
  medir: vi.fn(),
  medirFuncion: vi.fn(),
  medirSeccion: vi.fn(),
  medirPanelAbierto: vi.fn(),
  registrarVersion: vi.fn(),
  analiticaHabilitada: () => false,
}));
vi.mock('@/components/admin/useOpciones', () => ({
  useOpciones: () => {
    const valores = [{ slug: 'casa-brandon', label: 'Casa Brandon', orden: 99, fijo: false, usos: 3 }];
    return { valores, elegibles: valores, cargando: false };
  },
  useLabelsTaxonomia: () => ({}),
}));
vi.mock('@/components/admin/useContactoDeOrganizador', () => ({
  useContactoDeOrganizador: (slug: string | null) =>
    slug === 'casa-brandon'
      ? {
          instagram: { texto: '@casabrandon', href: 'https://instagram.com/casabrandon' },
          web: { texto: 'https://casabrandon.com.ar', href: 'https://casabrandon.com.ar/' },
        }
      : null,
}));

import { SeccionQuien } from '@/components/admin/formulario/SeccionQuien';
import { formVacio } from '@/lib/formulario/estadoInicial';
import type { ActividadForm } from '@/types/actividad';

afterEach(cleanup);

function Arnes({ inicial = '' }: { inicial?: string }) {
  const [form, setForm] = useState<ActividadForm>(() => ({
    ...formVacio(),
    organizador: { nombre: inicial, instagram: '', web: '' },
  }));
  return (
    <SeccionQuien
      form={form}
      set={(k, v) => setForm((f) => ({ ...f, [k]: v }))}
      errorDe={() => undefined}
      uid="uid_test"
      rol="admin"
      esTaller={false}
      esCharla={false}
      nombrePersona="Tallerista"
    />
  );
}

describe('el contacto del organizador, ofrecido', () => {
  it('con un organizador que ya existe, ofrece su Instagram y su web, y «Completar» los pone', () => {
    render(<Arnes inicial="casa brandon" />);
    expect(screen.getByText(/Sus otras actividades dicen @casabrandon · https:\/\/casabrandon.com.ar/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Completar' }));
    expect((screen.getByLabelText(/^instagram del organizador/i) as HTMLInputElement).value).toBe('@casabrandon');
    expect((screen.getByLabelText(/^web del organizador/i) as HTMLInputElement).value).toBe(
      'https://casabrandon.com.ar',
    );
    // Ya no falta nada: la oferta se va.
    expect(screen.queryByRole('button', { name: 'Completar' })).toBeNull();
  });

  it('con un organizador nuevo no ofrece nada', () => {
    render(<Arnes inicial="Una casa nueva" />);
    expect(screen.queryByText(/Sus otras actividades dicen/)).toBeNull();
  });
});
