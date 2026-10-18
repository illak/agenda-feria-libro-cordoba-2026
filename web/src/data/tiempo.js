// Las horas del JSON ya vienen en hora local de Córdoba (-03:00): se leen del string, sin depender
// de la zona del dispositivo. Intl se usa solo para nombres de día/mes y para "hoy".
const ZONA = 'America/Argentina/Cordoba';
export const INICIO_FERIA = '2026-10-30';
export const FIN_FERIA = '2026-11-15';

export const FRANJAS = [
  { id: 'manana', nombre: 'Mañana', desde: 0, hasta: 13 },
  { id: 'tarde', nombre: 'Tarde', desde: 13, hasta: 20 },
  { id: 'noche', nombre: 'Noche', desde: 20, hasta: 24 },
];

export function horaLocal(iso) {
  return iso ? iso.slice(11, 16) : '';
}

export function franjaDe(iso) {
  const hora = Number(iso.slice(11, 13));
  return FRANJAS.find((f) => hora >= f.desde && hora < f.hasta).id;
}

export function diasDeFeria() {
  const dias = [];
  const fin = Date.parse(`${FIN_FERIA}T00:00:00Z`);
  for (let t = Date.parse(`${INICIO_FERIA}T00:00:00Z`); t <= fin; t += 86_400_000) {
    dias.push(new Date(t).toISOString().slice(0, 10));
  }
  return dias;
}

const fmt = (opciones) => new Intl.DateTimeFormat('es-AR', { timeZone: ZONA, ...opciones });
const mediodia = (fecha) => new Date(`${fecha}T12:00:00-03:00`);

export function etiquetaDia(fecha) {
  const d = mediodia(fecha);
  return {
    semanaCorta: fmt({ weekday: 'short' }).format(d).replace('.', ''),
    numero: Number(fecha.slice(8, 10)),
    largo: fmt({ weekday: 'long', day: 'numeric', month: 'long' }).format(d),
    semana: fmt({ weekday: 'long' }).format(d),
    mes: fmt({ month: 'long' }).format(d),
  };
}

export function hoyISO(ahora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(ahora);
}

export function fechaHoraLegible(iso) {
  return fmt({ dateStyle: 'long', timeStyle: 'short' }).format(new Date(iso));
}

/** Los días entre dos fechas ISO, ambas inclusive. */
export function diasEntre(desde, hasta) {
  return diasDeFeria().filter((d) => d >= desde && d <= hasta);
}

export function etiquetaRango(desde, hasta) {
  if (!desde) return 'todos los días';
  if (desde === hasta) return etiquetaDia(desde).largo;
  const corto = (f) => fmt({ day: 'numeric', month: 'short' }).format(mediodia(f)).replace('.', '');
  return `${corto(desde)} al ${corto(hasta)}`;
}
