// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Illak Zapata
import Fuse from 'fuse.js';

// Sin acentos ni mayúsculas, tanto en el índice como en la consulta.
export function normalizar(texto) {
  return String(texto ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

function documento(e) {
  return {
    id: e.id,
    titulo: normalizar(e.titulo),
    descripcion: normalizar(e.descripcion),
    personas: normalizar(e.personas.map((p) => p.nombre).join(' ')),
    libros: normalizar(e.libros_presentados.join(' ')),
    editorial: normalizar(e.editorial),
  };
}

// Devuelve { ids, ranking }:
//  - ids(q): Set de ids que coinciden, o null si no hay consulta (= no filtrar)
//  - ranking(q): los eventos que coinciden, del más al menos relevante ([] si no hay consulta)
export function crearBuscador(eventos) {
  const porId = new Map(eventos.map((e) => [e.id, e]));
  const fuse = new Fuse(eventos.map(documento), {
    keys: [
      { name: 'titulo', weight: 3 },
      { name: 'personas', weight: 2 },
      { name: 'libros', weight: 2 },
      { name: 'editorial', weight: 1.5 },
      { name: 'descripcion', weight: 1 },
    ],
    threshold: 0.2, // con 0.3 una búsqueda como "mortero" trae 8 resultados para 1 coincidencia real
    ignoreLocation: true, // las descripciones son largas: la posición del match no importa
    minMatchCharLength: 2,
  });
  const buscar = (q) => {
    const consulta = normalizar(q);
    return consulta.length < 2 ? null : fuse.search(consulta);
  };
  return {
    ids: (q) => {
      const r = buscar(q);
      return r && new Set(r.map((x) => x.item.id));
    },
    ranking: (q) => (buscar(q) ?? []).map((x) => porId.get(x.item.id)),
  };
}
