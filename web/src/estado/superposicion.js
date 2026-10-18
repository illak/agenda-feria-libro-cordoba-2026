// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Illak Zapata
// Superposición de horarios. La hora de fin es la del doc o, si falta, la estimada (ver finEsEstimado):
// lo que depende de una hora estimada es aproximado y la interfaz tiene que decirlo.
export const finDe = (e) => e.hora_fin || e.hora_fin_estimada || e.hora_inicio;
export const finEsEstimado = (e) => !e.hora_fin && Boolean(e.hora_fin_estimada);

function intervalo(e) {
  const inicio = Date.parse(e.hora_inicio);
  return [inicio, Math.max(inicio, Date.parse(finDe(e)))];
}

/** Dos actividades se superponen si sus intervalos se pisan; que una termine justo cuando empieza la otra no cuenta. */
export function seSuperponen(a, b) {
  if (a.id === b.id) return false;
  const [ai, af] = intervalo(a);
  const [bi, bf] = intervalo(b);
  return ai === bi || (ai < bf && bi < af); // misma hora de inicio siempre cuenta, aun sin hora de fin
}

/** Posición de cada sede para ordenar siempre igual: carpas en el orden de sedes.json, después externas, después sin sede. */
export function ordenDeSedes(sedes) {
  const orden = new Map();
  sedes.filter((s) => s.tipo === 'carpa').forEach((s, i) => orden.set(s.id, i));
  sedes
    .filter((s) => s.tipo !== 'carpa')
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    .forEach((s, i) => orden.set(s.id, 100 + i));
  return orden;
}

const rangoDe = (orden, e) => orden.get(e.sede_id) ?? 1000;

export function ordenarPorSede(eventos, orden) {
  return [...eventos].sort(
    (a, b) =>
      Date.parse(a.hora_inicio) - Date.parse(b.hora_inicio) ||
      rangoDe(orden, a) - rangoDe(orden, b) ||
      a.titulo.localeCompare(b.titulo, 'es'),
  );
}

/**
 * Agrupa por hora de inicio. Cada momento trae lo que `empiezan` y lo que `siguen` en curso
 * (empezó antes y, según su hora de fin, no terminó).
 */
export function momentos(eventos, orden) {
  const porInicio = new Map();
  for (const e of eventos) {
    if (!porInicio.has(e.hora_inicio)) porInicio.set(e.hora_inicio, []);
    porInicio.get(e.hora_inicio).push(e);
  }
  return [...porInicio.keys()]
    .sort((a, b) => Date.parse(a) - Date.parse(b))
    .map((inicio) => {
      const t = Date.parse(inicio);
      const siguen = eventos.filter((e) => {
        const [i, f] = intervalo(e);
        return i < t && f > t;
      });
      return { inicio, empiezan: ordenarPorSede(porInicio.get(inicio), orden), siguen: ordenarPorSede(siguen, orden) };
    });
}

/** Las demás actividades de `eventos` que se pisan con `evento`, en orden de inicio y sede. */
export function simultaneasCon(evento, eventos, orden) {
  return ordenarPorSede(eventos.filter((e) => seSuperponen(evento, e)), orden);
}
