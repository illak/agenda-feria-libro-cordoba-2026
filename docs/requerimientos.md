# Agenda Feria del Libro Córdoba 2026 — Requerimientos

17 de octubre de 2026 · Illak Zapata

## Objetivo y alcance

Una web app open source que convierte la programación oficial de la Feria del Libro Córdoba 2026 (30/10 al 15/11, más de 360 actividades) en una agenda visual, filtrable y buscable desde el celular.

- **Producto principal:** agenda visual con filtros por carpa (color), día, franja horaria, ciclo, tema, tipo de actividad y nombre de persona.
- **Complemento ("chiche"):** estantes con los libros publicados por cada autor invitado, vinculados a la carpa y la hora de su charla.
- **Regla de diseño:** el complemento es opcional. Si faltan datos de libros, la agenda funciona igual.
- **Fuera de alcance en v1:** recomendaciones a partir de libros del usuario y visualización de la feria como dataset (quedan para la etapa 2).

## Fuente de datos y pipeline

La programación vive en un [Google Doc público](https://docs.google.com/document/d/1eTt9sjmE19IPcjuIwICoAJgEjKzm0vXU/export?format=pdf) enlazado desde [la página de Programación](https://feriadellibro.cordoba.gob.ar/programacion/). El sitio expone la API REST de The Events Calendar, pero para 2026 devuelve 0 eventos, así que el doc es la fuente de verdad.

El formato es semiestructurado: un encabezado por día (`|VIERNES 30`), y por actividad una hora, un título (a veces con prefijo de ciclo antes de `|`), una descripción, campos opcionales (`Autor:`, `Editorial:`, `A cargo de:`, `Presenta:`, `Modera:`, `Participan:`) y la sede (`Carpa Glauce Baldovin | Roja`). Hay inconsistencias reales, por ejemplo "Claudia Piñero" en el título y "Piñeiro" en la descripción.

1. **Descarga:** exportar el doc como texto (`export?format=txt`) y guardar una copia cruda versionada.
2. **Segmentación:** con regex, cortar por día y por hora para obtener un bloque de texto por actividad.
3. **Extracción:** subagentes Haiku lanzados desde Claude Code (no desde el pipeline) con salida JSON y un esquema fijo para personas con rol, libros presentados, editorial y temas; tipo, ciclo y sede salen de la regex. Se valida con Pydantic y se cachea por hash del bloque. Los campos con etiqueta explícita en el doc ganan sobre el LLM.
4. **Normalización:** sedes contra un catálogo cerrado, nombres de personas deduplicados y horas en formato ISO.
5. **Curaduría:** volcar a una Google Sheet de revisión las filas con baja confianza o campos vacíos. Las correcciones manuales tienen prioridad en cada corrida.
6. **Enriquecimiento (opcional):** buscar libros por autor (ver módulo secundario).
7. **Publicación:** generar `eventos.json`, `sedes.json`, `autores.json` y `libros.json`, más un `meta.json` con la fecha y hora de la actualización y el snapshot usado.
8. **Actualización manual:** sin GitHub Actions para los datos. Un comando local descarga el doc, prepara los bloques nuevos o modificados, y después de extraer, importar y construir, la publicación compara contra la versión publicada, guarda el diff en `data/cambios/` y copia los datos a `web/public/data/` (procedimiento en `docs/actualizacion.md`).

## Modelo de datos

Cuatro archivos JSON normalizados, unidos por IDs estables (slugs). Separar los libros permite que la agenda cargue sin depender del enriquecimiento.

| Archivo | Campos principales | Notas |
| --- | --- | --- |
| `sedes.json` | id, nombre, color, tipo (carpa o externa), dirección | Carpas: Lilia Lardone (naranja), Glauce Baldovin (roja), Juan Filloy (azul), Malicha Leguizamón (magenta), Escenario Leonor Marzano (turquesa). Externas en gris. |
| `eventos.json` | id, fecha, hora_inicio, hora_fin, título, descripción, tipo, ciclo, temas[] (máximo 2), sede_id, personas[{autor_id, rol}], libros_presentados[], editorial, público, confianza | `rol`: autor, presenta, modera, participa, a_cargo, realizador (dirección, guion o realización audiovisual). `público`: general o infancias. Un bloque con varios horarios es un evento por horario. |
| `autores.json` | id, nombre, variantes[], ids externos (Google Books, Open Library, Wikidata), estado_verificación | Las variantes absorben errores de tipeo del doc. |
| `libros.json` | id, autor_ids[], título, año, editorial, ISBN, tapa_url, sinopsis, fuente, confianza, presentado_en_feria | Ediciones del mismo título agrupadas en un solo registro. |

Taxonomía cerrada de temas (máximo 12, a validar; cada evento lleva hasta 2): memoria y dictadura, historia, narrativa, poesía, ensayo y pensamiento, infancias y juventudes, no ficción y periodismo, música y artes escénicas, cine y audiovisual, tecnología e IA, países invitados, oficio editorial.

## Requerimientos funcionales (v1)

La v1 tiene cuatro vistas sobre los mismos datos y un sistema único de filtros compartido entre ellas.

**Vistas**

- **Lista por día** (vista por defecto, mobile first): tarjetas ordenadas por hora, con una franja del color de la carpa y su nombre, el título, las personas y una etiqueta de ciclo.
- **Grilla carpa × hora:** columnas por carpa con su color y filas por franja de 30 minutos. Las sedes externas van en una columna "Otras sedes". En el celular se desplaza horizontalmente, con la columna de horas fija.
- **Ahora y próximas:** lo que está en curso y lo que empieza en los próximos 60 minutos, según la hora local.
- **Mi agenda:** los favoritos del usuario, ordenados por día.
- **Detalle de actividad:** descripción completa, personas con su rol, sede con dirección y enlace a mapa, y botón para agregar al calendario.

**Filtros y búsqueda**

- Chips de carpa con color y nombre, día, franja horaria (mañana, tarde, noche), ciclo, tema, tipo de actividad y un atajo "para infancias".
- Búsqueda difusa sobre título, descripción, personas y editoriales, que ignora acentos y mayúsculas y tolera errores de tipeo.
- Los filtros activos se reflejan en la URL, para compartir una vista filtrada con un enlace.
- Contador de resultados y botón para limpiar filtros.

**Mi agenda**

- Marcar y desmarcar favoritos, guardados en el navegador.
- Aviso visual cuando dos favoritos se superponen en horario.
- Exportar uno o todos los favoritos como archivo .ics.

**Transparencia**

- Fecha y hora de la última actualización visible.
- Enlace permanente al PDF oficial y aviso de que la grilla está sujeta a cambios.

## Módulo secundario: estantes de libros

Cada autor invitado tiene un estante con sus libros ordenados por año. Ese estante se ubica en la carpa donde da su charla, y el libro que presenta en la feria aparece destacado.

**Alcance**

- Solo personas con rol `autor` en presentaciones de libros y conversaciones con autores. Presentadores y moderadores, a definir.
- Acceso desde el detalle de una actividad ("Conocé su obra") y desde una pestaña "Estantes" con un estante por carpa, filtrable por día.

**Búsqueda de libros (Google Books primero, Open Library como respaldo)**

1. Buscar el libro ancla con `intitle:` + `inauthor:`. Si aparece, se confirma la identidad del autor.
2. Traer el resto con `inauthor:` y `langRestrict=es`, y agrupar las ediciones de un mismo título.
3. Descartar o marcar como dudosos los resultados con editoriales o fechas incompatibles. Los nombres muy comunes requieren revisión manual.
4. Asignar `confianza` y `fuente` a cada libro. Lo dudoso pasa por la planilla de curaduría antes de publicarse.
5. Cachear las respuestas crudas de la API para no repetir consultas y para que el proceso sea reproducible.

**Visualización**

- Color del estante = color de la carpa. Lomos ordenados por año, con el libro presentado al final, más alto y marcado.
- Al tocar un lomo se ven la tapa, la sinopsis y el año. Al tocar un autor, su charla (día, hora y carpa).
- Un autor sin resultados en las APIs aparece igual, con su libro presentado. Esa ausencia es un dato en sí misma.

## Requerimientos no funcionales

- **Mobile first:** se usa en el predio, con una mano y señal irregular. Lo prioritario es que la lista cargue rápido.
- **Offline:** un service worker cachea la app y los JSON, para que la agenda se pueda consultar sin conexión.
- **Accesibilidad:** el color nunca va solo, siempre acompañado del nombre de la carpa, porque roja, naranja y magenta pueden confundirse. Contraste AA, navegación por teclado y lector de pantalla en filtros y tarjetas.
- **Rendimiento:** sitio estático, sin backend. El peso de `eventos.json` se estima en menos de 500 KB. Las tapas se cargan de forma diferida.
- **Open source:** repositorio público con licencia MIT para el código. Los datos se atribuyen a la Feria del Libro Córdoba (Municipalidad de Córdoba), con un aviso de que es un proyecto no oficial.
- **Identidad:** sin logos ni marca oficial de la feria, para que no se confunda con el sitio institucional.
- **Privacidad:** sin cuentas ni tracking invasivo. Los favoritos quedan solo en el dispositivo.

## Stack tecnológico

El frontend usa JavaScript vanilla con ES modules, empaquetado con Vite y estilado con Tailwind CSS 4. Todo lo demás se resuelve con APIs nativas del navegador, sin framework.

| Capa | Herramienta | Por qué |
| --- | --- | --- |
| Build y servidor de desarrollo | Vite | Recarga instantánea y build estático listo para GitHub Pages. |
| Estilos | Tailwind CSS 4 (plugin de Vite) | Sin archivo de configuración. Los colores de carpa se definen como tokens con `@theme`. |
| Búsqueda | Fuse.js | Búsqueda difusa liviana, del lado del cliente. |
| Modales y menús | `<dialog>` y Popover API | Detalle de actividad y filtros sin librerías, con accesibilidad incluida. |
| Transiciones | View Transitions API | Cambio suave entre lista y grilla, con mejora progresiva. |
| Layout adaptable | Container queries | Las tarjetas se adaptan a su columna en la grilla. |
| Estado | `URLSearchParams` y `localStorage` | Filtros en la URL, favoritos en el dispositivo. |
| Fechas | `Intl.DateTimeFormat` con zona `America/Argentina/Cordoba` | Horas correctas sin depender de la zona del dispositivo. |
| Offline | vite-plugin-pwa | Service worker y manifest generados en el build. |
| Pipeline | Python con uv, httpx y Pydantic | Descarga, parseo, validación de esquema y llamadas a APIs. |
| Extracción | LLM vía API con salida JSON estructurada | Resuelve las inconsistencias del doc mejor que las regex solas. |
| Tests | pytest (parser) y Vitest (filtros y superposiciones) | Cubren la lógica más propensa a romperse. |
| Deploy | GitHub Pages y GitHub Actions | Gratis y público. Solo despliega: los datos se actualizan a mano. |

## Plan por etapas

La agenda tiene que estar publicada el 29/10, un día antes de la apertura. Los estantes de libros se suman durante la primera semana de la feria, sin bloquear el lanzamiento.

| Etapa | Desde | Hasta |
| --- | --- | --- |
| Parser y datos | 18/10 | 21/10 |
| Agenda: lista y filtros | 20/10 | 25/10 |
| Grilla carpa × hora, mi agenda, .ics | 24/10 | 27/10 |
| Offline, tests, deploy | 27/10 | 29/10 |
| **Lanzamiento** | **29/10** | **29/10** |
| Estantes de libros | 28/10 | 03/11 |
| Feria + actualización manual de datos | 30/10 | 15/11 |

Etapa 2, después de la feria: recomendaciones a partir de libros del usuario y la feria como dataset visual.

## Riesgos y preguntas abiertas

El riesgo principal es el tiempo: la feria empieza el 30/10, a 13 días de este documento.

| Riesgo | Mitigación |
| --- | --- |
| El formato del doc cambia o se reemplaza por otro archivo | Parser tolerante, el diff de cada publicación (`data/cambios/`) muestra si cae la cantidad de eventos, última versión publicada como respaldo |
| Errores de extracción del LLM | Validación de esquema, campo de confianza y planilla de curaduría |
| Homónimos y baja cobertura de autores locales en Google Books | Libro ancla, revisión manual, Open Library como segunda fuente y estantes que funcionan aunque estén incompletos |
| Cuota de la API de Google Books | Caché de respuestas y corridas solo sobre autores nuevos |
| Confusión con el sitio oficial | Aviso de proyecto no oficial y sin identidad visual de la feria |

**Preguntas abiertas**

- [ ] ¿Presentadores y moderadores tienen estante propio?
- [ ] ¿Cuentan las traducciones y antologías, o solo la obra propia en español?
- [ ] ¿Se valida la taxonomía de temas antes de etiquetar?
- [ ] ¿Conviene avisar a la organización de la feria para ofrecerles la app?
