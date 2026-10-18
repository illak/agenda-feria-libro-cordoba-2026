# Agenda Feria del Libro Córdoba 2026

Web app open source (no oficial) que convierte la programación de la Feria del Libro Córdoba 2026 en una agenda visual filtrable. La especificación completa está en `docs/requerimientos.md`: leela antes de cualquier tarea nueva.

## Prioridades

1. La agenda es el producto. Los estantes de libros son un complemento opcional: la agenda nunca puede depender de `libros.json`.
2. Fecha límite: publicada el 29/10/2026. Ante la duda, elegí lo simple que llega a tiempo.
3. Mobile first y offline: se usa en el predio, con el celular y señal irregular.

## Estructura del repo

```
pipeline/            Python: descarga, parseo, normalización, enriquecimiento
  src/feria/         paquete
  tests/             pytest
fixtures/            snapshots crudos del Google Doc (no se editan)
data/                JSON generados por el pipeline (no se editan a mano)
curaduria/           correcciones manuales (overrides) que el pipeline aplica al final
web/                 frontend: Vite + JS vanilla + Tailwind 4
  src/
  public/data/       copia de data/ que consume la app
docs/                requerimientos y decisiones
.github/workflows/   solo el deploy a GitHub Pages (los datos se actualizan a mano)
```

## Pipeline (Python)

- Gestión con `uv`, desde `pipeline/`. Actualizar: ver `docs/actualizacion.md`. Build: `uv run python -m feria.build`. Tests: `uv run pytest`.
- Librerías: httpx, Pydantic v2. Nada de pandas salvo que haga falta de verdad.
- Fuente: `https://docs.google.com/document/d/1eTt9sjmE19IPcjuIwICoAJgEjKzm0vXU/export?format=txt`.
- Desarrollo y tests siempre contra `fixtures/programacion_*.txt`, nunca contra la URL en vivo.
- Primero regex; la extracción con LLM (personas con rol, libros presentados, editorial, temas) la hacen subagentes Haiku lanzados desde Claude Code, nunca desde Python. Toda salida del LLM se valida con Pydantic y se cachea por hash del bloque en `pipeline/cache/extraccion/`.
- Los campos con etiqueta explícita en el doc (`Autor:`, `Editorial:`, `Presenta:`, etc.) ganan sobre el LLM; los conflictos se registran en el reporte.
- Modelo: `libros_presentados` es lista; roles `autor`, `presenta`, `modera`, `participa`, `a_cargo`, `realizador`; máximo 2 temas por evento; los bloques con varios horarios (como los de SADE) son un evento por horario.
- Sin GitHub Actions para datos: la actualización es manual y local. Flujo completo en `docs/actualizacion.md`: `feria.actualizar` (snapshot + lotes) -> extracción con Claude Code -> `feria.extraccion importar` -> `feria.build` (falla con `extraccion_pendiente`, salvo `--permitir-pendientes`) -> `feria.publicar` (diff en `data/cambios/`, copia a `web/public/data/` y `meta.json`).
- Cada evento lleva `confianza` (0 a 1). Al final de cada corrida, imprimir un reporte: total de eventos, eventos por día, campos vacíos (calculados sobre los eventos donde el campo aplica, antes y después del LLM), eventos por tema, filas de baja confianza, conflictos.
- Los IDs son slugs estables (`2026-10-30-1900-carpa-roja-poderes-violencias`): no deben cambiar entre corridas si el evento no cambia.
- Horas en ISO con zona `-03:00`. Fechas de la feria: 2026-10-30 a 2026-11-15. El doc dice el día de la semana y el número, no el mes: inferirlo.
- Normalizar sedes contra el catálogo de `docs/requerimientos.md`. Una sede desconocida es un warning, no un error.
- Los errores tipográficos del doc (ej. "Piñero" vs "Piñeiro") se resuelven con `variantes` en `autores.json`, no corrigiendo el texto original.

## Frontend

- JS vanilla con ES modules, sin framework. Vite + Tailwind CSS 4 (plugin `@tailwindcss/vite`), colores de carpa como tokens en `@theme`.
- APIs nativas antes que librerías: `<dialog>`, Popover API, View Transitions, container queries, `URLSearchParams`, `Intl.DateTimeFormat`.
- Única dependencia de runtime prevista: Fuse.js. Consultar antes de sumar otra.
- Filtros en la URL; favoritos en `localStorage` (siempre dentro de try/catch).
- El color de carpa nunca va solo: siempre con el nombre de la carpa. Contraste AA.
- Tests de lógica (filtros, superposición de horarios, generación de .ics) con Vitest.
- Comandos: `npm run dev`, `npm run build`, `npm test` dentro de `web/`.

## Convenciones

- Interfaz, textos y mensajes de commit en español rioplatense. Código, nombres de variables y comentarios en español o inglés, pero consistente dentro de cada archivo.
- Sin logos ni identidad visual oficial de la feria. Footer con aviso de proyecto no oficial y atribución de los datos.
- No inventar datos: si un campo no está en el doc, queda vacío.
- Las preguntas abiertas de `docs/requerimientos.md` tienen estos valores por defecto hasta que se decida otra cosa: estantes solo para rol `autor`; solo obra propia en español; taxonomía de temas tal como está en el documento.
