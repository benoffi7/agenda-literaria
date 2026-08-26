import type { ActividadForm } from '@/types/actividad';

/**
 * Un formulario lleno, con **centinelas** en cada campo de contenido: valores
 * inventados y bien reconocibles, para poder buscarlos en cualquier payload de
 * analítica y afirmar que no están.
 *
 * Es el mismo truco que usa la verificación del ICS del calendario: no se
 * confía en la intención del código, se busca el dato en lo que salió.
 */
export const CENTINELAS = {
  titulo: 'CENTINELA-TITULO-cronica-urbana',
  descripcion: 'CENTINELA-DESCRIPCION-ocho encuentros los martes',
  slug: 'centinela-slug-cronica-urbana',
  tema: 'CENTINELA-TEMA-ejercicio de voz',
  lectura: 'CENTINELA-LECTURA-Pedro Paramo',
  mailInscripcion: 'centinela-inscripciones@ejemplo.com',
  linkReunion: 'https://zoom.us/j/CENTINELA-999999',
  handle: '@CENTINELA_handle',
  direccion: 'CENTINELA-DIRECCION Drago 236',
  sede: 'CENTINELA-SEDE Casa Brandon',
  notasInternas: 'CENTINELA-NOTAS coordinar con prensa',
  bio: 'CENTINELA-BIO nacio en Rosario',
  uid: 'bNvcQmbUwdSduoSfA2Oa9hxYMQp2',
  mailAdmin: 'benoffi11@gmail.com',
  imagen: 'https://ejemplo.com/CENTINELA-imagen.jpg',
  epigrafeImagen: 'CENTINELA-EPIGRAFE el patio en la primera edicion',
  urlMaterial: 'https://drive.example/CENTINELA-material',
  tituloMaterial: 'CENTINELA-MATERIAL guia de lectura',
  notasArancel: 'CENTINELA-ARANCEL dos cuotas',
  indicaciones: 'CENTINELA-INDICACIONES timbre 3B',
  organizador: 'CENTINELA-ORGANIZADOR Casa Brandon',
  tallerista: 'CENTINELA-TALLERISTA Ana Perez',
  web: 'https://CENTINELA-web.example',
  // DEC-1 — el libro presentado es texto libre, así que tiene centinela como
  // cualquier otro campo de contenido: la analítica no puede llevarlo.
  libro: 'CENTINELA-LIBRO Los detectives salvajes',
  autorDelLibro: 'CENTINELA-AUTORLIBRO Roberto Bolano',
} as const;

/** Todos los centinelas, para recorrerlos en las aserciones. */
export const VALORES_CENTINELA = Object.values(CENTINELAS);

export const formularioLleno = (over: Partial<ActividadForm> = {}): ActividadForm => ({
  tipo: 'taller',
  titulo: CENTINELAS.titulo,
  slug: CENTINELAS.slug,
  descripcion: CENTINELAS.descripcion,
  imagenes: [
    {
      id: 'img_centinela',
      url: CENTINELAS.imagen,
      epigrafe: CENTINELAS.epigrafeImagen,
      origen: 'externa',
      portada: true,
    },
  ],
  organizador: {
    nombre: CENTINELAS.organizador,
    instagram: CENTINELAS.handle,
    web: CENTINELAS.web,
  },
  tallerista: {
    nombre: CENTINELAS.tallerista,
    bio: CENTINELAS.bio,
    instagram: CENTINELAS.handle,
  },
  libro: { titulo: CENTINELAS.libro, autor: CENTINELAS.autorDelLibro },
  esCiclo: true,
  sesiones: [
    {
      id: 'ses_1111',
      inicio: '2026-09-03T19:00',
      fin: '2026-09-03T21:00',
      tema: CENTINELAS.tema,
      lectura: CENTINELAS.lectura,
      cancelada: false,
      calendarEventId: 'evt_interno_1',
    },
    {
      id: 'ses_2222',
      inicio: '2026-09-10T19:00',
      fin: '2026-09-10T21:00',
      tema: CENTINELAS.tema,
      lectura: CENTINELAS.lectura,
      cancelada: false,
      calendarEventId: null,
    },
  ],
  modalidad: 'presencial',
  sede: {
    nombre: CENTINELAS.sede,
    direccion: CENTINELAS.direccion,
    barrio: 'villa-crespo',
    ciudad: 'CABA',
    indicaciones: CENTINELAS.indicaciones,
    geo: null,
  },
  online: { plataforma: 'zoom', url: CENTINELAS.linkReunion, urlPublica: false },
  inscripcion: {
    requiere: true,
    via: 'mail',
    destino: CENTINELAS.mailInscripcion,
    cupo: 12,
    cierra: '2026-09-01T12:00',
    // B-97 — en `true` a propósito: es la celda de GA4 del paso 0. Con `false`,
    // mandar el booleano de más (o de menos) no rompería nada, y el centinela del
    // mail de inscripción de al lado no alcanza — el booleano no lleva texto, así
    // que lo que fija su celda es el valor esperado, no un centinela.
    completo: true,
  },
  arancel: { tipo: 'a-la-gorra', notas: CENTINELAS.notasArancel },
  material: {
    tiene: true,
    items: [
      {
        tipo: 'guia',
        titulo: CENTINELAS.tituloMaterial,
        url: CENTINELAS.urlMaterial,
        entrega: 'al-inscribirse',
        publico: false,
      },
    ],
  },
  difusion: { arrobar: [CENTINELAS.handle], notas: CENTINELAS.notasInternas },
  estado: 'borrador',
  tags: ['narrativa'],
  destacado: false,
  ...over,
});
