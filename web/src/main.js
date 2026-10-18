import './styles/app.css';
import { h } from './dom.js';
import { cargarDatos } from './data/cargar.js';
import { FIN_FERIA, INICIO_FERIA, etiquetaRango, hoyISO } from './data/tiempo.js';
import { crearBuscador } from './estado/busqueda.js';
import { aplicar, cantidadActivos, desdeURL, haciaURL, limpiar, opcionesDe } from './estado/filtros.js';
import { crearControles } from './componentes/filtros-ui.js';
import { crearDetalle } from './componentes/detalle.js';
import { pie } from './componentes/pie.js';
import { crearCampoBusqueda } from './componentes/campo-busqueda.js';
import { botonTema } from './componentes/boton-tema.js';
import { sedeDe } from './data/cargar.js';
import { renderLista } from './vistas/lista.js';
import { renderSimultaneas } from './vistas/simultaneas.js';
import { crearSelectorVista } from './componentes/selector-vista.js';
import { ordenDeSedes } from './estado/superposicion.js';

const app = document.getElementById('app');

function error(e) {
  console.error(e);
  app.replaceChildren(
    h(
      'main',
      { class: 'mx-auto max-w-3xl p-4 grid gap-3' },
      h('h1', { class: 'font-serif text-2xl font-bold' }, 'No pudimos cargar la agenda'),
      h('p', {}, 'Revisá tu conexión y probá de nuevo.'),
      h('button', { class: 'boton justify-self-start', type: 'button', onClick: () => location.reload() }, 'Reintentar'),
    ),
  );
}

async function iniciar() {
  const { eventos, sedes, sedePorId, meta } = await cargarDatos();
  const opciones = opcionesDe(eventos, sedes);
  const hoy = hoyISO();
  const diaPorDefecto = hoy >= INICIO_FERIA && hoy <= FIN_FERIA ? hoy : INICIO_FERIA;
  const cantidades = new Map();
  for (const e of eventos) cantidades.set(e.fecha, (cantidades.get(e.fecha) ?? 0) + 1);
  const buscador = crearBuscador(eventos);

  let filtros = desdeURL(location.search, { diaPorDefecto, opciones });

  const controles = crearControles(
    {
      dias: opciones.diasFeria,
      cantidades,
      hoy: diaPorDefecto === hoy ? hoy : '',
      carpas: sedes.filter((s) => s.tipo === 'carpa'),
      ciclos: opciones.ciclos.map((c) => [c, c]),
      temas: opciones.temas,
    },
    (parche) => {
      const resuelto = Object.fromEntries(Object.entries(parche).map(([k, v]) => [k, typeof v === 'function' ? v(filtros) : v]));
      filtros = { ...filtros, ...resuelto };
      render();
    },
  );
  const orden = ordenDeSedes(sedes);
  const abrirDetalle = crearDetalle(sedePorId, eventos, orden);
  const selectorVista = crearSelectorVista((parche) => { filtros = { ...filtros, ...parche }; render(); });

  const MAX_SUGERENCIAS = 6;
  const campoBusqueda = crearCampoBusqueda({
    // las sugerencias cruzan todos los días, pero respetan carpa, horario, ciclo, tema, tipo e infancias
    sugerir: (q) => {
      const permitidos = new Set(aplicar(eventos, filtros, { sedePorId, idsBusqueda: buscador.ids(q), conDia: false }).map((e) => e.id));
      const orden = buscador.ranking(q).filter((e) => permitidos.has(e.id));
      return { total: orden.length, items: orden.slice(0, MAX_SUGERENCIAS).map((evento) => ({ evento, sede: sedeDe(evento, sedePorId) })) };
    },
    alEscribir: (q) => { filtros = { ...filtros, q: q.trim() }; render(); },
    alElegir: abrirDetalle,
  });

  const contador = h('p', { class: 'font-semibold', 'aria-live': 'polite' });
  const botonLimpiar = h('button', { class: 'boton', type: 'button', onClick: () => { filtros = limpiar(filtros); render(); } }, 'Limpiar filtros');
  const otrosDias = h('button', { class: 'underline text-left', type: 'button' });
  const lista = h('div', { id: 'lista' });

  app.replaceChildren(
    h(
      'div',
      { class: 'mx-auto max-w-3xl px-4' },
      h(
        'header',
        { class: 'pt-4 pb-2 grid gap-3' },
        h(
          'div',
          { class: 'flex items-start justify-between gap-3' },
          h('h1', { class: 'font-serif text-2xl font-bold leading-tight' }, 'Agenda Feria del Libro Córdoba 2026'),
          botonTema(),
        ),
        campoBusqueda.el,
      ),
      h('main', { class: 'grid gap-3' }, controles.calendario, controles.chipsCarpa, controles.chipsFranja, controles.mas,
        selectorVista.el,
        h('div', { class: 'flex items-center justify-between gap-3 flex-wrap' }, contador, botonLimpiar),
        otrosDias,
        lista,
      ),
      pie(meta),
    ),
  );

  function render() {
    const ids = buscador.ids(filtros.q);
    const resultados = aplicar(eventos, filtros, { sedePorId, idsBusqueda: ids });
    const activos = cantidadActivos(filtros);

    controles.sync(filtros);
    selectorVista.sync(filtros);
    campoBusqueda.sync(filtros.q);
    const dias = etiquetaRango(filtros.desde, filtros.hasta);
    contador.textContent = `${resultados.length} ${resultados.length === 1 ? 'actividad' : 'actividades'} · ${dias}`;
    botonLimpiar.hidden = activos === 0;

    // resultados que existen en otros días, para no dejar una búsqueda sin salida
    const total = filtros.desde && activos ? aplicar(eventos, filtros, { sedePorId, idsBusqueda: ids, conDia: false }).length : 0;
    const enOtros = total - resultados.length;
    otrosDias.hidden = enOtros <= 0;
    otrosDias.textContent = `Ver también ${enOtros} en otros días`;
    otrosDias.onclick = () => { filtros = { ...filtros, desde: '', hasta: '' }; render(); };

    const vista = filtros.vista === 'simultaneas' ? renderSimultaneas : renderLista;
    vista(lista, {
      orden,
      eventos: resultados,
      filtros,
      sedePorId,
      avisos: meta.avisos_dias ?? {},
      diasSinActividades: new Set(opciones.diasFeria.filter((d) => !cantidades.has(d))),
      hayFiltros: activos > 0,
      alAbrir: abrirDetalle,
      alLimpiar: () => { filtros = limpiar(filtros); render(); },
    });

    const qs = haciaURL(filtros, { diaPorDefecto });
    history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
  }

  addEventListener('popstate', () => {
    filtros = desdeURL(location.search, { diaPorDefecto, opciones });
    render();
  });
  render();
}

iniciar().catch(error);
