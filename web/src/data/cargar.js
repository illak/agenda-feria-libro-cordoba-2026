// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Illak Zapata
const pedir = async (nombre) => {
  const r = await fetch(`data/${nombre}`);
  if (!r.ok) throw new Error(`${nombre}: ${r.status}`);
  return r.json();
};

// La agenda depende solo de estos tres archivos; libros.json nunca se carga acá.
export async function cargarDatos() {
  const [eventos, sedes, meta] = await Promise.all([pedir('eventos.json'), pedir('sedes.json'), pedir('meta.json')]);
  const sedePorId = new Map(sedes.map((s) => [s.id, s]));
  return { eventos, sedes, sedePorId, meta };
}

export const SIN_SEDE = { id: '', nombre: 'Sin sede confirmada', color: 'gris', tipo: 'externa', direccion: '' };

// Un sede_id vacío o ausente de sedes.json no debe romper la tarjeta.
export function sedeDe(evento, sedePorId) {
  return sedePorId.get(evento.sede_id) ?? SIN_SEDE;
}
