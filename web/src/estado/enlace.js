// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Illak Zapata
// Enlace profundo a una actividad: ?evento=<id>
export function idEventoDeURL(search) {
  return new URLSearchParams(search).get('evento') || '';
}

/** La actividad a abrir, o undefined si el id no existe (por ejemplo, si el programa cambió). */
export function eventoDeURL(search, eventos) {
  const id = idEventoDeURL(search);
  return id ? eventos.find((e) => e.id === id) : undefined;
}
