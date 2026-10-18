// @vitest-environment happy-dom
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Illak Zapata
import { describe, expect, it, vi } from 'vitest';
import { crearControles } from '../src/componentes/filtros-ui.js';
import { opcionesDe, paresDeOpciones } from '../src/estado/filtros.js';
import { eventosReales, sedesReales } from './datos.js';

const opciones = opcionesDe(eventosReales, sedesReales);
// los selectores reciben pares [valor, etiqueta] ya armados, igual que en main.js
const pares = paresDeOpciones(opciones);

function montar() {
  const cambiar = vi.fn();
  const controles = crearControles(
    {
      dias: opciones.diasFeria,
      cantidades: new Map(),
      hoy: '',
      carpas: sedesReales.filter((s) => s.tipo === 'carpa'),
      ...pares,
    },
    cambiar,
  );
  document.body.replaceChildren(controles.mas);
  return { cambiar, controles };
}

const valores = (id) => [...document.querySelectorAll(`#${id} option`)].map((o) => o.value);

describe('selector de ciclo', () => {
  it('ofrece exactamente los ciclos de los datos, como texto', () => {
    montar();
    expect(valores('f-ciclo')).toEqual(['', ...opciones.ciclos]);
  });
  it('al elegir un ciclo avisa con ese texto', () => {
    const { cambiar } = montar();
    const select = document.getElementById('f-ciclo');
    select.value = 'INFANCIAS';
    select.dispatchEvent(new Event('change'));
    expect(cambiar).toHaveBeenCalledWith({ ciclo: 'INFANCIAS' });
  });
  it('cada opción es un ciclo que existe en alguna actividad', () => {
    montar();
    const existentes = new Set(eventosReales.map((e) => e.ciclo));
    for (const v of valores('f-ciclo').slice(1)) expect(existentes.has(v)).toBe(true);
  });
});

describe('selector de tema', () => {
  it('ofrece los temas de los datos', () => {
    montar();
    expect(valores('f-tema')).toEqual(['', ...opciones.temas]);
  });
});

describe('selector de público', () => {
  it('entrega un booleano', () => {
    const { cambiar } = montar();
    const select = document.getElementById('f-publico');
    select.value = 'infancias';
    select.dispatchEvent(new Event('change'));
    expect(cambiar).toHaveBeenCalledWith({ infancias: true });
  });
});
