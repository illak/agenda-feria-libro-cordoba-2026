# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 Illak Zapata
"""Corre el pipeline: snapshot -> data/eventos.json, data/sedes.json y data/meta.json, más el reporte."""
import argparse
import json
import sys
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path

from .extraccion import TEMAS, cargar_cache
from .parser import Resultado, parsear

RAIZ = Path(__file__).resolve().parents[3]
UMBRAL_BAJA_CONFIANZA = 0.7
MAX_CONFLICTOS_EN_REPORTE = 40
ZONA = timezone(timedelta(hours=-3))

# Campo -> predicado que dice en qué eventos aplica (el resto no cuenta en el porcentaje)
APLICA = {
    "titulo": lambda e: True,
    "descripcion": lambda e: True,
    "hora_fin": lambda e: True,
    "sede_id": lambda e: True,
    "ciclo": lambda e: True,
    "personas": lambda e: e.tipo != "proyeccion",
    "temas": lambda e: True,
    "libros_presentados": lambda e: e.tipo == "presentacion",
    "editorial": lambda e: e.tipo == "presentacion",
}


def ahora() -> datetime:
    return datetime.now(ZONA)


def ultimo_snapshot() -> Path:
    return sorted((RAIZ / "fixtures").glob("programacion_*.txt"))[-1]


def escribir_json(ruta: Path, items: list) -> None:
    ruta.parent.mkdir(parents=True, exist_ok=True)
    datos = [i.model_dump() for i in items]
    ruta.write_text(json.dumps(datos, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def vacios(eventos: list, campo: str) -> tuple[int, int]:
    """(vacíos, aplican) para un campo, sobre los eventos donde aplica."""
    aplican = [e for e in eventos if APLICA[campo](e)]
    return sum(1 for e in aplican if not getattr(e, campo)), len(aplican)


def reporte(res: Resultado, antes: Resultado | None = None) -> str:
    total = len(res.eventos)
    out = [f"Total de eventos: {total}", "", "Eventos por día:"]
    por_dia = Counter(e.fecha for e in res.eventos)
    out += [f"  {dia}: {n}" for dia, n in sorted(por_dia.items())]

    out += ["", "Campos vacíos (sobre los eventos donde el campo aplica):"]
    if antes:
        out.append(f"  {'campo':<18} {'aplican':>7}   {'antes (regex)':>16}   {'después (+LLM)':>16}")
    for campo in APLICA:
        v, n = vacios(res.eventos, campo)
        if antes:
            va, _ = vacios(antes.eventos, campo)
            out.append(f"  {campo:<18} {n:>7}   {va:>6} ({va / n:>4.0%})   {v:>6} ({v / n:>4.0%})")
        else:
            out.append(f"  {campo:<18} {n:>7}   {v:>6} ({v / n:>4.0%})")

    por_tema = Counter(t for e in res.eventos for t in e.temas)
    sin_tema = sum(1 for e in res.eventos if not e.temas)
    out += ["", "Eventos por tema (un evento puede tener hasta 2):"]
    out += [f"  {t:<26} {por_tema.get(t, 0):>4}" for t in sorted(TEMAS, key=lambda t: -por_tema.get(t, 0))]
    out.append(f"  {'(sin tema)':<26} {sin_tema:>4}")

    bajas = [e for e in res.eventos if e.confianza < UMBRAL_BAJA_CONFIANZA]
    out += ["", f"Filas de baja confianza (< {UMBRAL_BAJA_CONFIANZA}): {len(bajas)}"]
    out += [f"  {e.confianza:.2f}  {e.id}" for e in bajas]

    out += ["", f"Conflictos etiqueta del doc vs LLM (gana la etiqueta): {len(res.conflictos)}"]
    out += [f"  - {c}" for c in res.conflictos[:MAX_CONFLICTOS_EN_REPORTE]]
    if len(res.conflictos) > MAX_CONFLICTOS_EN_REPORTE:
        out.append(f"  ... y {len(res.conflictos) - MAX_CONFLICTOS_EN_REPORTE} más")

    if antes:
        out += ["", f"Bloques sin extracción (extraccion_pendiente): {len(res.extraccion_pendiente)} de {len(res.bloques)}"]
    out += ["", f"Advertencias: {len(res.advertencias)}"]
    out += [f"  - {a}" for a in res.advertencias]
    return "\n".join(out)


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(prog="feria.build")
    ap.add_argument("snapshot", nargs="?", type=Path, help="por defecto, el último de fixtures/")
    ap.add_argument(
        "--permitir-pendientes", action="store_true",
        help="construir aunque haya bloques sin extracción (esos eventos quedan solo con regex)",
    )
    args = ap.parse_args(argv)

    fixture = args.snapshot or ultimo_snapshot()
    texto = fixture.read_text(encoding="utf-8")
    antes = parsear(texto)
    res = parsear(texto, cargar_cache())

    if res.extraccion_pendiente and not args.permitir_pendientes:
        print(f"ERROR: {len(res.extraccion_pendiente)} bloques con extraccion_pendiente (snapshot {fixture.name}).")
        for h, t in res.extraccion_pendiente.items():
            print(f"  {h}  {res.bloques_info[h]['fecha']} {res.bloques_info[h]['hora']}  {t.splitlines()[0][:70]}")
        print("Corré `uv run python -m feria.actualizar` para preparar los lotes, extraé, importá y volvé a correr el build.")
        print("O usá --permitir-pendientes para construir igual (esos eventos quedan solo con regex).")
        return 1

    escribir_json(RAIZ / "data" / "eventos.json", res.eventos)
    escribir_json(RAIZ / "data" / "sedes.json", res.sedes)
    meta = {
        "snapshot": fixture.name,
        "generado": ahora().isoformat(timespec="seconds"),
        "eventos": len(res.eventos),
        "extraccion_pendiente": len(res.extraccion_pendiente),
        "avisos_dias": res.avisos_dias,
    }
    (RAIZ / "data" / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Fuente: {fixture.name}")
    print(reporte(res, antes))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
