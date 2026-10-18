# Actualización de los datos (manual)

Los datos no se actualizan con GitHub Actions: lo hace una persona, a mano, desde la máquina local. El Action de GitHub Pages solo despliega lo que ya está en `web/public/data/`.

Todos los comandos se corren desde `pipeline/`.

## Procedimiento

1. **Actualizar.** `uv run python -m feria.actualizar`
   - Descarga el doc como texto y lo guarda como snapshot fechado: `fixtures/programacion_AAAA-MM-DD.txt` (si ya hay uno del día con otro contenido, suma la hora: `..._HHMM.txt`). Los snapshots no se editan.
   - Si la descarga falla, bajá el doc a mano (Archivo > Descargar > Texto sin formato) y pasale la ruta: `uv run python -m feria.actualizar ruta/al/archivo.txt`.
   - Corre la regex con el caché de extracciones, lista los bloques **nuevos** o **modificados** que necesitan extracción, prepara sus lotes en `pipeline/cache/lotes/` y se detiene. Si no hay bloques pendientes, salta directo al paso 4.
2. **Extraer** (con Claude Code). Pedile que lance un subagente Haiku por cada `lote_NN.json`, con el prompt de `pipeline/prompts/extraccion.md`. Cada uno escribe `resultado_NN.json` en la misma carpeta.
3. **Importar.** `uv run python -m feria.extraccion importar`
   - Valida con Pydantic cada resultado y lo guarda en `pipeline/cache/extraccion/<hash>.json`. Rechaza temas fuera de la taxonomía, más de 2 temas, roles inválidos y hashes que no estaban en el lote. Si hay errores, reextraé esos bloques (`actualizar` los vuelve a listar).
4. **Build.** `uv run python -m feria.build`
   - Genera `data/eventos.json`, `data/sedes.json` y `data/meta.json`, e imprime el reporte (campos vacíos antes/después del LLM sobre los eventos donde aplican, eventos por tema, baja confianza, conflictos, advertencias).
   - Termina con error si quedan bloques con `extraccion_pendiente`, salvo que pases `--permitir-pendientes` (esos eventos quedan solo con lo que sacó la regex).
5. **Revisar el diff.** `uv run python -m feria.publicar --solo-cambios` muestra y guarda lo que cambia respecto de la versión publicada, sin copiar nada.
6. **Publicar.** `uv run python -m feria.publicar`
   - Compara contra `web/public/data/eventos.json`: eventos agregados, eliminados y modificados (con los campos que cambiaron; los cambios de horario o sede van arriba). Lo guarda en `data/cambios/AAAA-MM-DD.md` (varias publicaciones el mismo día suman una sección cada una).
   - Copia `data/` a `web/public/data/` y escribe `meta.json` con la fecha y hora de la actualización (`actualizado`, zona -03:00) y el snapshot usado.
   - Se niega a publicar un build hecho con bloques pendientes.
7. Commit de `fixtures/`, `pipeline/cache/extraccion/`, `data/` y `web/public/data/`, y push para que se despliegue.

## Decisiones del modelo de datos

- **Caché por hash del bloque** (texto crudo, sin normalizar): si el doc no cambia un bloque, no se vuelve a extraer. Si cambia una letra, el bloque se considera modificado.
- **Bloques con varios horarios** se separan en un evento por horario: `11:00 y 15:00` genera dos eventos, y los bloques con `(15:00)`, `(16:00)`... dentro del texto (SADE) generan un evento por libro, cada uno con su propia extracción.
- **`libros_presentados`** es una lista: una presentación puede traer varios libros.
- **Roles de persona**: `autor`, `presenta`, `modera`, `participa`, `a_cargo`, `realizador` (dirección, guion o realización de una película o documental).
- **Temas**: máximo 2 por evento, solo de la taxonomía cerrada de `docs/requerimientos.md`.
- **Prioridad al combinar**: los campos con etiqueta explícita en el doc (`Autor:`, `Presenta:`, `Modera:`, `Participan:`, `A cargo de:`, `Dirección:`, `Editorial:`) ganan sobre el LLM. Cuando el LLM discrepa, el reporte lo lista como conflicto. Las etiquetas ambiguas (`Coordina:`, `Acompañan:`) no tienen prioridad.
- **`hora_fin_estimada`**: si el doc no trae hora de fin, el evento lleva `hora_fin_estimada` = inicio + 60 minutos (`DURACION_ESTIMADA` en `parser.py`). Es una aproximación y la web la marca como "aprox."; `hora_fin` sigue vacía.
- **`avisos_dias`** (en `meta.json`): fecha ISO -> texto, para los días del doc que no traen ninguna actividad pero sí un aviso (hoy, el 10/11 por la visita del Papa). La web los muestra en lugar de un día vacío.
- Lo que el doc no dice queda vacío; no se inventa.

## Cambios de modelo y re-extracción

Si cambia el esquema o el prompt, el caché viejo deja de validar o se borra a mano solo para lo afectado (borrá `pipeline/cache/extraccion/<hash>.json` de esos bloques): `actualizar` los detecta como pendientes y solo esos se vuelven a extraer.
