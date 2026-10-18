// Tema claro/oscuro: sigue al sistema hasta que la persona elige uno; la elección queda en localStorage.
const CLAVE = 'tema';
export const TEMAS = ['claro', 'oscuro'];

export const siguienteTema = (actual) => (actual === 'oscuro' ? 'claro' : 'oscuro');

export function temaEfectivo(elegido, sistemaOscuro) {
  if (TEMAS.includes(elegido)) return elegido;
  return sistemaOscuro ? 'oscuro' : 'claro';
}

export function leerTema(storage = globalThis.localStorage) {
  try {
    const t = storage.getItem(CLAVE);
    return TEMAS.includes(t) ? t : null;
  } catch {
    return null;
  }
}

export function guardarTema(tema, storage = globalThis.localStorage) {
  try {
    storage.setItem(CLAVE, tema);
    return true;
  } catch {
    return false; // modo privado o sin permiso: el tema vale para esta sesión
  }
}
