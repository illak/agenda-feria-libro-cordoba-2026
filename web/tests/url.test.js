// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Illak Zapata
import { describe, expect, it } from 'vitest';
import { OTRAS_SEDES, desdeURL, filtrosVacios, haciaURL } from '../src/estado/filtros.js';
import { eventos, sedes } from './datos.js';
import { opcionesDe } from '../src/estado/filtros.js';

const defecto = '2026-10-30';
const opciones = opcionesDe(eventos, sedes);
const leer = (qs) => desdeURL(qs, { diaPorDefecto: defecto, opciones });

describe('lectura de la URL', () => {
  it('sin parámetros: día por defecto y nada más', () => {
    expect(leer('')).toEqual(filtrosVacios(defecto));
  });
  it('lee todos los filtros', () => {
    const f = leer('?dia=2026-10-31&q=mortero&carpa=roja,azul&franja=tarde,noche&ciclo=INFANCIAS&tema=historia&tipo=taller&infancias=1');
    expect(f).toEqual({
      vista: 'lista', desde: '2026-10-31', hasta: '2026-10-31', q: 'mortero', carpas: ['roja', 'azul'], franjas: ['tarde', 'noche'],
      ciclo: 'INFANCIAS', tema: 'historia', tipo: 'taller', infancias: true,
    });
  });
  it('dia=todos significa todos los días', () => {
    expect(leer('?dia=todos')).toMatchObject({ desde: '', hasta: '' });
  });
  it('lee un rango de días', () => {
    expect(leer('?dia=2026-10-31..2026-11-03')).toMatchObject({ desde: '2026-10-31', hasta: '2026-11-03' });
  });
  it('un rango al revés se ordena', () => {
    expect(leer('?dia=2026-11-03..2026-10-31')).toMatchObject({ desde: '2026-10-31', hasta: '2026-11-03' });
  });
  it('un día fuera de la feria vuelve al día por defecto', () => {
    expect(leer('?dia=2026-12-25')).toMatchObject({ desde: defecto, hasta: defecto });
    expect(leer('?dia=basura')).toMatchObject({ desde: defecto, hasta: defecto });
  });
  it('un rango con un extremo inválido vuelve al día por defecto', () => {
    expect(leer('?dia=2026-10-31..2026-12-25')).toMatchObject({ desde: defecto, hasta: defecto });
    expect(leer('?dia=2026-10-31..')).toMatchObject({ desde: defecto, hasta: defecto });
  });
  it('descarta valores que no existen en los datos', () => {
    const f = leer('?carpa=roja,fantasma&franja=madrugada,tarde&ciclo=NOEXISTE&tema=magia&tipo=ritual');
    expect(f.carpas).toEqual(['roja']);
    expect(f.franjas).toEqual(['tarde']);
    expect(f.ciclo).toBe('');
    expect(f.tema).toBe('');
    expect(f.tipo).toBe('');
  });
  it('acepta "otras sedes" y el texto con acentos y espacios codificados', () => {
    expect(leer('?carpa=otras').carpas).toEqual([OTRAS_SEDES]);
    expect(leer('?q=poes%C3%ADa%20del%20sur').q).toBe('poesía del sur');
  });
  it('infancias solo vale con 1', () => {
    expect(leer('?infancias=0').infancias).toBe(false);
    expect(leer('?infancias=true').infancias).toBe(false);
  });
});

describe('vista', () => {
  it('por defecto es la lista', () => {
    expect(leer('').vista).toBe('lista');
  });
  it('lee vista=simultaneas', () => {
    expect(leer('?vista=simultaneas').vista).toBe('simultaneas');
  });
  it('una vista desconocida vuelve a la lista', () => {
    expect(leer('?vista=grilla').vista).toBe('lista');
  });
  it('solo se escribe si no es la lista, y convive con los demás filtros', () => {
    expect(haciaURL(filtrosVacios(defecto), { diaPorDefecto: defecto })).toBe('');
    expect(haciaURL({ ...filtrosVacios(defecto), vista: 'simultaneas', infancias: true }, { diaPorDefecto: defecto })).toBe('vista=simultaneas&infancias=1');
  });
});

describe('escritura de la URL', () => {
  it('el estado por defecto no escribe nada', () => {
    expect(haciaURL(filtrosVacios(defecto), { diaPorDefecto: defecto })).toBe('');
  });
  it('todos los días se escribe como dia=todos', () => {
    expect(haciaURL(filtrosVacios(''), { diaPorDefecto: defecto })).toBe('dia=todos');
  });
  it('un rango se escribe desde..hasta', () => {
    expect(haciaURL(filtrosVacios('2026-10-31', '2026-11-03'), { diaPorDefecto: defecto })).toBe('dia=2026-10-31..2026-11-03');
  });
  it('un rango que empieza en el día por defecto igual se escribe', () => {
    expect(haciaURL(filtrosVacios(defecto, '2026-11-01'), { diaPorDefecto: defecto })).toBe('dia=2026-10-30..2026-11-01');
  });
  it('ida y vuelta conserva los filtros', () => {
    const f = {
      vista: 'simultaneas', desde: '2026-10-31', hasta: '2026-11-04', q: 'poesía del sur', carpas: ['roja', OTRAS_SEDES], franjas: ['noche'],
      ciclo: 'INFANCIAS', tema: 'poesía', tipo: 'presentacion', infancias: true,
    };
    const qs = haciaURL(f, { diaPorDefecto: defecto });
    expect(leer(`?${qs}`)).toEqual(f);
  });
});
