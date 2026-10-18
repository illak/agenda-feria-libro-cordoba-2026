import { diasDeFeria, franjaDe, FRANJAS } from '../data/tiempo.js';

export const OTRAS_SEDES = 'otras';
export const VISTAS = ['lista', 'simultaneas'];
export const TIPOS = [
  ['presentacion', 'Presentación'],
  ['charla', 'Charla'],
  ['taller', 'Taller'],
  ['proyeccion', 'Proyección'],
  ['espectaculo', 'Espectáculo'],
  ['otro', 'Otro'],
];

// El día es un rango [desde, hasta] (ambos inclusive); un solo día es desde === hasta y '' = todos los días.
export const filtrosVacios = (desde = '', hasta = desde) => ({
  vista: 'lista', // cómo se muestran los resultados; no es un filtro
  desde,
  hasta,
  q: '',
  carpas: [], // ids de carpa y/o OTRAS_SEDES
  franjas: [],
  ciclo: '',
  tema: '',
  tipo: '',
  infancias: false,
});

const lista = (valor) => (valor ? valor.split(',').filter(Boolean) : []);
const unicos = (xs) => [...new Set(xs)];

// Opciones válidas que salen de los datos, para ignorar valores inventados en la URL.
export function opcionesDe(eventos, sedes) {
  const distintos = (campo) => unicos(eventos.flatMap((e) => (Array.isArray(e[campo]) ? e[campo] : [e[campo]])).filter(Boolean));
  return {
    diasFeria: unicos([...diasDeFeria(), ...eventos.map((e) => e.fecha)]).sort(),
    carpas: [...sedes.filter((s) => s.tipo === 'carpa').map((s) => s.id), OTRAS_SEDES],
    ciclos: distintos('ciclo').sort((a, b) => a.localeCompare(b, 'es')),
    temas: distintos('temas').sort((a, b) => a.localeCompare(b, 'es')),
  };
}

const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Lee los filtros de un query string. `dia` admite `2026-10-30`, un rango `2026-10-30..2026-11-02` o `todos`;
 * si falta o es inválido se usa `diaPorDefecto`. Lo que no figure en `opciones` se descarta.
 */
export function desdeURL(search, { diaPorDefecto = '', opciones = null } = {}) {
  const p = new URLSearchParams(search);
  const f = filtrosVacios(diaPorDefecto);

  if (p.has('dia')) {
    const valor = p.get('dia');
    if (valor === 'todos') {
      f.desde = '';
      f.hasta = '';
    } else {
      const [a, b = a] = valor.split('..');
      const valido = (d) => RE_FECHA.test(d) && (!opciones || opciones.diasFeria.includes(d));
      if (valido(a) && valido(b)) [f.desde, f.hasta] = a <= b ? [a, b] : [b, a];
    }
  }
  if (VISTAS.includes(p.get('vista'))) f.vista = p.get('vista');
  f.q = (p.get('q') ?? '').trim();
  f.carpas = lista(p.get('carpa')).filter((c) => !opciones || opciones.carpas.includes(c));
  f.franjas = lista(p.get('franja')).filter((x) => FRANJAS.some((fr) => fr.id === x));
  const unoDe = (clave, validos) => {
    const v = p.get(clave) ?? '';
    return !validos || validos.includes(v) ? v : '';
  };
  f.ciclo = unoDe('ciclo', opciones?.ciclos);
  f.tema = unoDe('tema', opciones?.temas);
  f.tipo = unoDe('tipo', TIPOS.map(([id]) => id));
  f.infancias = p.get('infancias') === '1';
  return f;
}

/** Escribe solo lo que se aparta del estado por defecto, para URLs cortas. */
export function haciaURL(f, { diaPorDefecto = '' } = {}) {
  const p = new URLSearchParams();
  if (f.vista !== 'lista') p.set('vista', f.vista);
  if (f.desde !== diaPorDefecto || f.hasta !== diaPorDefecto) {
    p.set('dia', !f.desde ? 'todos' : f.desde === f.hasta ? f.desde : `${f.desde}..${f.hasta}`);
  }
  if (f.q) p.set('q', f.q);
  if (f.carpas.length) p.set('carpa', f.carpas.join(','));
  if (f.franjas.length) p.set('franja', f.franjas.join(','));
  if (f.ciclo) p.set('ciclo', f.ciclo);
  if (f.tema) p.set('tema', f.tema);
  if (f.tipo) p.set('tipo', f.tipo);
  if (f.infancias) p.set('infancias', '1');
  return p.toString();
}

/** Cantidad de filtros activos sin contar el día (que es navegación). */
export function cantidadActivos(f) {
  return (f.q ? 1 : 0) + f.carpas.length + f.franjas.length + [f.ciclo, f.tema, f.tipo].filter(Boolean).length + (f.infancias ? 1 : 0);
}

/** Limpia todo salvo los días elegidos y la vista. */
export const limpiar = (f) => ({ ...filtrosVacios(f.desde, f.hasta), vista: f.vista });

function coincideCarpa(evento, carpas, sedePorId) {
  if (!carpas.length) return true;
  const sede = sedePorId.get(evento.sede_id);
  if (sede?.tipo === 'carpa') return carpas.includes(sede.id);
  return carpas.includes(OTRAS_SEDES); // sede externa, desconocida o sin sede
}

/**
 * @param idsBusqueda Set de ids que devolvió el buscador, o null si no hay consulta.
 * @param conDia false para contar resultados ignorando los días (ej. "hay N en otros días").
 */
export function aplicar(eventos, f, { sedePorId, idsBusqueda = null, conDia = true }) {
  return eventos.filter(
    (e) =>
      (!conDia || !f.desde || (e.fecha >= f.desde && e.fecha <= f.hasta)) &&
      (!idsBusqueda || idsBusqueda.has(e.id)) &&
      coincideCarpa(e, f.carpas, sedePorId) &&
      (!f.franjas.length || f.franjas.includes(franjaDe(e.hora_inicio))) &&
      (!f.ciclo || e.ciclo === f.ciclo) &&
      (!f.tema || e.temas.includes(f.tema)) &&
      (!f.tipo || e.tipo === f.tipo) &&
      (!f.infancias || e.publico === 'infancias'),
  );
}
