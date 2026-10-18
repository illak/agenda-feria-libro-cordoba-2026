// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Illak Zapata
import { h } from '../dom.js';
import { guardarTema, leerTema, siguienteTema, temaEfectivo } from '../estado/tema.js';

const sistemaOscuro = () => matchMedia('(prefers-color-scheme: dark)').matches;

export function botonTema() {
  const raiz = document.documentElement;
  const actual = () => temaEfectivo(raiz.dataset.tema ?? leerTema(), sistemaOscuro());

  const icono = h('span', { 'aria-hidden': 'true' });
  const texto = h('span', {});
  const boton = h('button', { class: 'boton inline-flex items-center gap-2 shrink-0', type: 'button' }, icono, texto);

  function pintar() {
    const destino = siguienteTema(actual());
    icono.textContent = destino === 'oscuro' ? '☾' : '☀\uFE0E';
    texto.textContent = destino === 'oscuro' ? 'Oscuro' : 'Claro';
    boton.setAttribute('aria-label', `Cambiar a tema ${destino}`);
  }

  boton.addEventListener('click', () => {
    const nuevo = siguienteTema(actual());
    raiz.dataset.tema = nuevo;
    guardarTema(nuevo);
    pintar();
  });
  // si no hay elección guardada y cambia el tema del sistema, el botón debe reflejarlo
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', pintar);
  pintar();
  return boton;
}
