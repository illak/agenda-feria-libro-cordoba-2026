// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Illak Zapata
import { describe, expect, it } from 'vitest';
import { finDe, finEsEstimado, momentos, ordenDeSedes, seSuperponen, simultaneasCon } from '../src/estado/superposicion.js';
import { evento, eventosReales, sedesReales } from './datos.js';

const e = (id, inicio, fin = '', estimada = '', extra = {}) =>
  evento({ id, fecha: inicio.slice(0, 10), hora_inicio: `${inicio}:00-03:00`, hora_fin: fin && `${fin}:00-03:00`, hora_fin_estimada: estimada && `${estimada}:00-03:00`, ...extra });

describe('seSuperponen', () => {
  it('se pisan si los intervalos se cruzan', () => {
    expect(seSuperponen(e('a', '2026-11-01T17:00', '2026-11-01T18:00'), e('b', '2026-11-01T17:30', '2026-11-01T18:30'))).toBe(true);
  });
  it('una que termina justo cuando empieza la otra no se pisa', () => {
    expect(seSuperponen(e('a', '2026-11-01T17:00', '2026-11-01T18:00'), e('b', '2026-11-01T18:00', '2026-11-01T19:00'))).toBe(false);
  });
  it('es simétrica y un evento no se pisa consigo mismo', () => {
    const a = e('a', '2026-11-01T17:00', '2026-11-01T18:00');
    const b = e('b', '2026-11-01T17:59', '2026-11-01T19:00');
    expect(seSuperponen(a, b)).toBe(seSuperponen(b, a));
    expect(seSuperponen(a, a)).toBe(false);
  });
  it('sin hora_fin usa la estimada', () => {
    const a = e('a', '2026-11-01T17:00', '', '2026-11-01T18:00');
    expect(finDe(a)).toBe(a.hora_fin_estimada);
    expect(finEsEstimado(a)).toBe(true);
    expect(seSuperponen(a, e('b', '2026-11-01T17:45', '2026-11-01T18:30'))).toBe(true);
    expect(seSuperponen(a, e('c', '2026-11-01T18:15', '2026-11-01T19:00'))).toBe(false);
  });
  it('la hora de fin real gana sobre la estimada', () => {
    expect(finEsEstimado(e('a', '2026-11-01T17:00', '2026-11-01T19:00', '2026-11-01T18:00'))).toBe(false);
    expect(finDe(e('a', '2026-11-01T17:00', '2026-11-01T19:00', '2026-11-01T18:00'))).toBe('2026-11-01T19:00:00-03:00');
  });
  it('misma hora de inicio se pisa aunque no haya ninguna hora de fin', () => {
    expect(seSuperponen(e('a', '2026-11-01T17:00'), e('b', '2026-11-01T17:00'))).toBe(true);
    expect(seSuperponen(e('a', '2026-11-01T17:00'), e('b', '2026-11-01T17:30'))).toBe(false);
  });
  it('cruza la medianoche', () => {
    const a = e('a', '2026-11-01T23:30', '', '2026-11-02T00:30');
    expect(seSuperponen(a, e('b', '2026-11-02T00:10', '2026-11-02T01:00'))).toBe(true);
  });
  it('una hora de fin anterior al inicio se trata como evento puntual en su hora de inicio', () => {
    const rara = e('a', '2026-11-01T17:00', '2026-11-01T16:00');
    expect(seSuperponen(rara, e('b', '2026-11-01T16:30', '2026-11-01T17:30'))).toBe(true); // 17:00 cae dentro de b
    expect(seSuperponen(rara, e('c', '2026-11-01T15:00', '2026-11-01T16:30'))).toBe(false); // no hay intervalo negativo que lo toque
  });
});

describe('momentos', () => {
  const sedes = [
    { id: 'roja', nombre: 'Carpa Glauce', tipo: 'carpa' },
    { id: 'azul', nombre: 'Carpa Filloy', tipo: 'carpa' },
    { id: 'z', nombre: 'Zeta', tipo: 'externa' },
    { id: 'b', nombre: 'Biblioteca', tipo: 'externa' },
  ];
  const orden = ordenDeSedes(sedes);
  const lista = [
    e('largo', '2026-11-01T16:00', '', '2026-11-01T17:30', { sede_id: 'z' }),
    e('corto', '2026-11-01T16:00', '', '2026-11-01T16:45', { sede_id: 'azul' }),
    e('x', '2026-11-01T17:00', '', '2026-11-01T18:00', { sede_id: 'b', titulo: 'B' }),
    e('y', '2026-11-01T17:00', '', '2026-11-01T18:00', { sede_id: 'roja', titulo: 'C' }),
    e('w', '2026-11-01T17:00', '', '2026-11-01T18:00', { sede_id: 'azul', titulo: 'A' }),
    e('sola', '2026-11-01T20:00', '', '2026-11-01T21:00', { sede_id: '' }),
  ];
  const ms = momentos(lista, orden);

  it('un momento por hora de inicio, en orden', () => {
    expect(ms.map((m) => m.inicio.slice(11, 16))).toEqual(['16:00', '17:00', '20:00']);
  });
  it('las que empiezan van siempre en el mismo orden de sede: carpas, después externas', () => {
    expect(ms[1].empiezan.map((x) => x.id)).toEqual(['y', 'w', 'x']); // roja, azul, externa
    expect(ms[0].empiezan.map((x) => x.id)).toEqual(['corto', 'largo']);
  });
  it('siguen en curso solo las que empezaron antes y no terminaron', () => {
    expect(ms[1].siguen.map((x) => x.id)).toEqual(['largo']); // "corto" terminó a las 16:45
    expect(ms[0].siguen).toEqual([]);
    expect(ms[2].siguen).toEqual([]);
  });
  it('sin sede va último', () => {
    const m = momentos([e('s', '2026-11-01T10:00', '', '2026-11-01T11:00', { sede_id: '' }), e('r', '2026-11-01T10:00', '', '2026-11-01T11:00', { sede_id: 'roja' })], orden);
    expect(m[0].empiezan.map((x) => x.id)).toEqual(['r', 's']);
  });
});

describe('simultaneasCon', () => {
  it('devuelve las que se pisan, sin incluir a la misma', () => {
    const a = e('a', '2026-11-01T17:00', '', '2026-11-01T18:00');
    const lista = [a, e('b', '2026-11-01T17:30', '', '2026-11-01T18:30'), e('c', '2026-11-01T19:00', '', '2026-11-01T20:00')];
    expect(simultaneasCon(a, lista, new Map()).map((x) => x.id)).toEqual(['b']);
  });
});

describe('sobre la programación real', () => {
  const orden = ordenDeSedes(sedesReales);
  const dia = (f) => eventosReales.filter((x) => x.fecha === f);

  it('todo evento tiene alguna hora de fin (real o estimada)', () => {
    expect(eventosReales.every((x) => x.hora_fin || x.hora_fin_estimada)).toBe(true);
  });
  it('los momentos cubren cada evento exactamente una vez', () => {
    for (const f of ['2026-10-30', '2026-11-07']) {
      const ms = momentos(dia(f), orden);
      expect(ms.flatMap((m) => m.empiezan.map((x) => x.id)).sort()).toEqual(dia(f).map((x) => x.id).sort());
    }
  });
  it('el sábado 7/11 hay momentos con varias actividades a la vez', () => {
    const ms = momentos(dia('2026-11-07'), orden);
    expect(Math.max(...ms.map((m) => m.empiezan.length))).toBeGreaterThanOrEqual(3);
  });
  it('si A se pisa con B, B se pisa con A (todos los pares de un día)', () => {
    const es = dia('2026-11-03');
    for (const a of es) for (const b of es) expect(seSuperponen(a, b)).toBe(seSuperponen(b, a));
  });
});
