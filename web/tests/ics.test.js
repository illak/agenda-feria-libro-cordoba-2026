// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Illak Zapata
import { describe, expect, it } from 'vitest';
import { aUTC, descripcionDe, intervaloUTC } from '../src/estado/datos-calendario.js';
import { escaparTexto, generarICS, plegar } from '../src/estado/ics.js';
import { evento, eventosReales, metaReal, sedePorId, sedes, sedesReales } from './datos.js';

const ctx = { sedePorId, urlApp: 'https://ejemplo.test/agenda/', estampa: '2026-10-17T20:21:00-03:00' };
const desplegar = (ics) => ics.replace(/\r\n /g, '');
const campo = (ics, nombre) => desplegar(ics).split('\r\n').find((l) => l.startsWith(nombre + ':'))?.slice(nombre.length + 1);
const e = (extra) =>
  evento({ id: 'x', hora_inicio: '2026-10-30T19:00:00-03:00', hora_fin: '2026-10-30T21:00:00-03:00', ...extra });

describe('horas', () => {
  it('pasa -03:00 a UTC', () => {
    expect(aUTC('2026-10-30T19:00:00-03:00')).toBe('20261030T220000Z');
  });
  it('cruza el día en UTC', () => {
    expect(aUTC('2026-10-30T22:00:00-03:00')).toBe('20261031T010000Z');
  });
  it('usa la hora de fin del programa y no marca aproximado', () => {
    expect(intervaloUTC(e())).toEqual({ inicio: '20261030T220000Z', fin: '20261031T000000Z', aproximado: false });
  });
  it('sin hora de fin usa la estimada y lo marca', () => {
    const r = intervaloUTC(e({ hora_fin: '', hora_fin_estimada: '2026-10-30T20:00:00-03:00' }));
    expect(r).toMatchObject({ fin: '20261030T230000Z', aproximado: true });
  });
  it('sin ninguna hora de fin asume una hora', () => {
    expect(intervaloUTC(e({ hora_fin: '', hora_fin_estimada: '' }))).toMatchObject({ fin: '20261030T230000Z', aproximado: true });
  });
  it('un fin anterior al inicio no genera un intervalo negativo', () => {
    expect(intervaloUTC(e({ hora_fin: '2026-10-30T18:00:00-03:00' })).fin).toBe('20261030T230000Z');
  });
  it('un evento que cruza la medianoche termina al día siguiente', () => {
    const r = intervaloUTC(e({ hora_inicio: '2026-10-30T23:30:00-03:00', hora_fin: '', hora_fin_estimada: '2026-10-31T00:30:00-03:00' }));
    expect(r).toMatchObject({ inicio: '20261031T023000Z', fin: '20261031T033000Z' });
  });
});

describe('texto', () => {
  it('escapa barra, punto y coma, coma y saltos de línea', () => {
    expect(escaparTexto('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne');
  });
  it('no deja líneas de más de 75 octetos, ni siquiera con acentos y emojis', () => {
    const larga = 'SUMMARY:' + 'áéíóú ñ 📚 '.repeat(30);
    const lineas = plegar(larga).split('\r\n');
    expect(lineas.length).toBeGreaterThan(1);
    for (const l of lineas) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
    expect(lineas.slice(1).every((l) => l.startsWith(' '))).toBe(true);
  });
  it('plegar y desplegar devuelven el texto original', () => {
    const larga = 'DESCRIPTION:' + 'Presentación ñandú 📚, '.repeat(20);
    expect(plegar(larga).replace(/\r\n /g, '')).toBe(larga);
  });
  it('una línea corta no se toca', () => {
    expect(plegar('SUMMARY:Hola')).toBe('SUMMARY:Hola');
  });
});

describe('descripcion', () => {
  const lib = e({
    personas: [
      { autor_id: 'a', nombre: 'Carlos Gonzáles', rol: 'autor' },
      { autor_id: 'b', nombre: 'Ana', rol: 'modera' },
      { autor_id: 'c', nombre: 'Luis', rol: 'autor' },
    ],
    libros_presentados: ['Mortero 2'],
    editorial: 'Editorial Yammal',
    ciclo: 'CICLO X',
    descripcion: 'Texto del programa.',
  });
  it('agrupa personas por rol e incluye libro, ciclo, texto y enlace', () => {
    const d = descripcionDe(lib, { urlApp: ctx.urlApp });
    expect(d).toContain('Autoría: Carlos Gonzáles, Luis');
    expect(d).toContain('Modera: Ana');
    expect(d).toContain('Libro presentado: Mortero 2 (Editorial Yammal)');
    expect(d).toContain('Ciclo: CICLO X');
    expect(d).toContain('Texto del programa.');
    expect(d).toContain('https://ejemplo.test/agenda/?evento=x');
  });
  it('avisa cuando la hora de fin es aproximada, y solo entonces', () => {
    expect(descripcionDe(lib, { urlApp: ctx.urlApp })).not.toContain('aproximada');
    expect(descripcionDe({ ...lib, hora_fin: '', hora_fin_estimada: '2026-10-30T20:00:00-03:00' }, { urlApp: ctx.urlApp })).toContain('La hora de fin es aproximada');
  });
  it('recorta el texto del programa si se pide', () => {
    const d = descripcionDe(e({ descripcion: 'x'.repeat(1000) }), { urlApp: ctx.urlApp, maxPrograma: 50 });
    expect(d).toContain('x'.repeat(50) + '…');
    expect(d).not.toContain('x'.repeat(51));
  });
  it('un título muy largo va entero en la descripción', () => {
    const titulo = 'T'.repeat(300);
    expect(descripcionDe(e({ titulo }), { urlApp: ctx.urlApp })).toContain(titulo);
  });
});

describe('generarICS', () => {
  const unico = e({ id: '2026-10-30-1900-roja-apertura', titulo: 'Apertura, con coma; y punto y coma', sede_id: 'roja' });
  const ics = generarICS([unico], ctx);

  it('tiene la estructura de un calendario', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
  });
  it('usa solo CRLF', () => {
    expect(ics.replace(/\r\n/g, '').includes('\n')).toBe(false);
  });
  it('el UID es estable y sale del id del evento', () => {
    expect(campo(ics, 'UID')).toBe('2026-10-30-1900-roja-apertura@agenda-feria-libro-cordoba-2026');
    expect(campo(generarICS([unico], ctx), 'UID')).toBe(campo(ics, 'UID'));
  });
  it('es reproducible: mismas entradas, mismo archivo', () => {
    expect(generarICS([unico], ctx)).toBe(ics);
  });
  it('DTSTAMP sale de la fecha de actualización de los datos', () => {
    expect(campo(ics, 'DTSTAMP')).toBe('20261017T232100Z');
  });
  it('fechas, título, lugar y enlace', () => {
    expect(campo(ics, 'DTSTART')).toBe('20261030T220000Z');
    expect(campo(ics, 'DTEND')).toBe('20261031T000000Z');
    expect(campo(ics, 'SUMMARY')).toBe('Apertura\\, con coma\\; y punto y coma');
    expect(campo(ics, 'LOCATION')).toBe('Carpa Glauce Baldovin');
    expect(campo(ics, 'URL')).toBe('https://ejemplo.test/agenda/?evento=2026-10-30-1900-roja-apertura');
  });
  it('la ubicación suma la dirección si la hay, y una sede desconocida no rompe', () => {
    expect(campo(generarICS([e({ sede_id: 'biblio' })], ctx), 'LOCATION')).toBe('Biblioteca Córdoba\\, 27 de Abril 375');
    expect(campo(generarICS([e({ sede_id: 'no-existe' })], ctx), 'LOCATION')).toBe('Sin sede confirmada');
  });
  it('un título largo se recorta en SUMMARY', () => {
    expect(campo(generarICS([e({ titulo: 'T'.repeat(300) })], ctx), 'SUMMARY').length).toBeLessThan(130);
  });
  it('varios eventos en un solo archivo', () => {
    expect(generarICS([e({ id: 'a' }), e({ id: 'b' })], ctx).match(/BEGIN:VEVENT/g)).toHaveLength(2);
  });
});

describe('sobre la programación real', () => {
  const real = generarICS(eventosReales, {
    sedePorId: new Map(sedesReales.map((s) => [s.id, s])),
    urlApp: 'https://ejemplo.test/',
    estampa: metaReal.actualizado ?? metaReal.generado,
  });

  it('genera un VEVENT por actividad, con UID único', () => {
    expect(real.match(/BEGIN:VEVENT/g)).toHaveLength(eventosReales.length);
    const uids = [...desplegar(real).matchAll(/\r\nUID:(.+)/g)].map((m) => m[1]);
    expect(new Set(uids).size).toBe(eventosReales.length);
  });
  it('ninguna línea pasa de 75 octetos', () => {
    for (const l of real.split('\r\n')) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
  });
  it('DTEND es posterior a DTSTART en todas', () => {
    const t = (s) => Date.parse(s.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/, '$1-$2-$3T$4:$5:$6Z'));
    const inicios = [...desplegar(real).matchAll(/\r\nDTSTART:(\S+)/g)].map((m) => t(m[1]));
    const fines = [...desplegar(real).matchAll(/\r\nDTEND:(\S+)/g)].map((m) => t(m[1]));
    expect(inicios).toHaveLength(eventosReales.length);
    inicios.forEach((i, n) => expect(fines[n]).toBeGreaterThan(i));
  });
});
