// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Illak Zapata
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// con ruta y no con new URL(..., import.meta.url): en los tests con entorno DOM, URL no resuelve contra el archivo
const leer = (n) => JSON.parse(readFileSync(join(import.meta.dirname, '..', 'public', 'data', n), 'utf-8'));

export const eventosReales = leer('eventos.json');
export const sedesReales = leer('sedes.json');
export const metaReal = leer('meta.json');

const persona = (nombre, rol = 'autor') => ({ autor_id: nombre.toLowerCase(), nombre, rol });

// Eventos mínimos y controlados para probar reglas sin depender de la programación real
export const sedes = [
  { id: 'roja', nombre: 'Carpa Glauce Baldovin', color: 'roja', tipo: 'carpa', direccion: '' },
  { id: 'azul', nombre: 'Carpa Juan Filloy', color: 'azul', tipo: 'carpa', direccion: '' },
  { id: 'biblio', nombre: 'Biblioteca Córdoba', color: 'gris', tipo: 'externa', direccion: '27 de Abril 375' },
];
export const sedePorId = new Map(sedes.map((s) => [s.id, s]));

export const evento = (extra) => ({
  id: 'x', fecha: '2026-10-30', hora_inicio: '2026-10-30T10:00:00-03:00', hora_fin: '', hora_fin_estimada: '',
  titulo: 'Título', descripcion: '', tipo: 'otro', ciclo: '', temas: [], sede_id: 'roja', personas: [],
  libros_presentados: [], editorial: '', publico: 'general', confianza: 1, ...extra,
});

export const eventos = [
  evento({ id: 'a', hora_inicio: '2026-10-30T10:00:00-03:00', titulo: 'Poesía del sur', temas: ['poesía'], personas: [persona('José Pérez')] }),
  evento({ id: 'b', hora_inicio: '2026-10-30T15:00:00-03:00', sede_id: 'azul', tipo: 'taller', publico: 'infancias', ciclo: 'INFANCIAS', titulo: 'Taller de collage' }),
  evento({ id: 'c', fecha: '2026-10-31', hora_inicio: '2026-10-31T21:00:00-03:00', sede_id: 'biblio', tipo: 'presentacion', titulo: 'Presentación de Mortero', libros_presentados: ['Mortero 2'], editorial: 'Editorial Yammal Contenidos', descripcion: 'El perro héroe de Malvinas' }),
  evento({ id: 'd', fecha: '2026-10-31', hora_inicio: '2026-10-31T13:00:00-03:00', sede_id: '', titulo: 'Sin sede conocida', temas: ['historia', 'narrativa'] }),
];
