# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 Illak Zapata
"""Paso 1 de la actualización manual: snapshot nuevo, regex con caché y lotes de extracción."""
import argparse
import shutil
import sys
from pathlib import Path

import httpx

from . import extraccion
from .build import RAIZ, ahora, ultimo_snapshot
from .parser import parsear

URL_BASE = "https://docs.google.com/document/d/1eTt9sjmE19IPcjuIwICoAJgEjKzm0vXU/export"
URL = f"{URL_BASE}?format=txt"
URL_HTML = f"{URL_BASE}?format=html"  # conserva los hipervínculos que el texto pierde
FIXTURES = RAIZ / "fixtures"


def descargar() -> str:
    r = httpx.get(URL, follow_redirects=True, timeout=30)
    r.raise_for_status()
    return r.content.decode("utf-8")


def descargar_html() -> str:
    r = httpx.get(URL_HTML, follow_redirects=True, timeout=60)
    r.raise_for_status()
    return r.content.decode("utf-8")


def parece_programacion(texto: str) -> bool:
    return "|VIERNES 30" in texto.replace("| ", "|") or "FERIA DEL LIBRO" in texto.upper()


def guardar_snapshot(texto: str) -> Path:
    """Guarda programacion_AAAA-MM-DD.txt; si ya hay uno del día con otro contenido, suma la hora."""
    t = ahora()
    destino = FIXTURES / f"programacion_{t:%Y-%m-%d}.txt"
    if destino.exists():
        # en bytes: read_text() normaliza \r\n a \n y el doc trae \r\n, así que nunca coincidía y duplicaba el snapshot
        if destino.read_bytes().decode("utf-8") == texto:
            return destino
        destino = FIXTURES / f"programacion_{t:%Y-%m-%d}_{t:%H%M}.txt"
    FIXTURES.mkdir(exist_ok=True)
    destino.write_text(texto, encoding="utf-8")
    return destino


def guardar_html(snapshot: Path) -> None:
    """Guarda el HTML del doc junto al snapshot (mismo nombre, .html). Si falla, sigue sin enlaces nuevos."""
    destino = snapshot.with_suffix(".html")
    try:
        destino.write_text(descargar_html(), encoding="utf-8")
    except (httpx.HTTPError, UnicodeDecodeError) as e:
        print(f"Aviso: no se pudo bajar el HTML con los enlaces ({e}); esta actualización queda sin enlaces nuevos.")
        return
    print(f"Enlaces: {destino.relative_to(RAIZ)}")


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(prog="feria.actualizar")
    ap.add_argument("archivo", nargs="?", type=Path, help="doc descargado a mano (.txt), si la descarga falla")
    args = ap.parse_args(argv)

    anterior = ultimo_snapshot() if list(FIXTURES.glob("programacion_*.txt")) else None
    if args.archivo:
        texto = args.archivo.read_text(encoding="utf-8")
    else:
        try:
            texto = descargar()
        except (httpx.HTTPError, UnicodeDecodeError) as e:
            print(f"No se pudo descargar el doc ({e}).")
            print("Bajalo a mano (Archivo > Descargar > Texto sin formato) y corré:")
            print("  uv run python -m feria.actualizar ruta/al/archivo.txt")
            return 1
    if not parece_programacion(texto):
        print("ERROR: el archivo no se parece a la programación (no encuentro los encabezados de día).")
        return 1

    snapshot = guardar_snapshot(texto)
    print(f"Snapshot: {snapshot.relative_to(RAIZ)}")
    if not args.archivo:  # con un archivo a mano no hay HTML: los enlaces quedan sin actualizar
        guardar_html(snapshot)

    res = parsear(texto, extraccion.cargar_cache())
    previos = {}
    if anterior and anterior != snapshot:
        previos = parsear(anterior.read_text(encoding="utf-8")).bloques_info
    claves_previas = {(i["fecha"], i["hora"], i["sede"]): h for h, i in previos.items()}

    print(f"Eventos: {len(res.eventos)} · bloques: {len(res.bloques)} · en caché: {len(res.bloques) - len(res.extraccion_pendiente)}")
    if not res.extraccion_pendiente:
        print("\nNo hay bloques nuevos ni modificados. Siguiente paso:")
        print("  uv run python -m feria.build && uv run python -m feria.publicar")
        return 0

    print(f"\nBloques que necesitan extracción ({len(res.extraccion_pendiente)}):")
    for h in res.extraccion_pendiente:
        i = res.bloques_info[h]
        previo = claves_previas.get((i["fecha"], i["hora"], i["sede"]))
        estado = "modificado" if previo and previo != h else "nuevo"
        print(f"  [{estado:<10}] {i['fecha']} {i['hora']}  {i['titulo'][:70]}")

    rutas = extraccion.preparar(res.bloques)
    print(f"\nLotes preparados: {len(rutas)} en {extraccion.LOTES.relative_to(RAIZ)}/")
    print("Siguiente paso (con Claude Code): pedile que extraiga cada lote con subagentes Haiku")
    print("siguiendo pipeline/prompts/extraccion.md, y después:")
    print("  uv run python -m feria.extraccion importar")
    print("  uv run python -m feria.build")
    print("  uv run python -m feria.publicar")
    print("Detalle en docs/actualizacion.md")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
