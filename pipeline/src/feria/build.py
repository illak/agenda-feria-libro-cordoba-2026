# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 Illak Zapata
"""Corre el pipeline: snapshots -> data/eventos.json, data/sedes.json y data/meta.json, más el reporte."""
import argparse
import json
import sys
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path

from .enlaces import extraer as extraer_enlaces
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


def todos_los_snapshots() -> list[Path]:
    """Todos los snapshots de fixtures/, del más viejo al más nuevo (el nombre lleva la fecha)."""
    return sorted((RAIZ / "fixtures").glob("programacion_*.txt"))


def ultimo_snapshot() -> Path:
    return todos_los_snapshots()[-1]


def enlaces_de(snapshot: Path) -> dict | None:
    """Hipervínculos del snapshot, si se guardó su HTML al lado (programacion_AAAA-MM-DD.html)."""
    html = snapshot.with_suffix(".html")
    return extraer_enlaces(html.read_text(encoding="utf-8")) if html.exists() else None


def _fechas_de(res: Resultado) -> set[str]:
    """Los días que un snapshot cubre: con actividades o con un aviso (como el 10/11)."""
    return {e.fecha for e in res.eventos} | set(res.avisos_dias)


def combinar(snapshots: list[Path], extracciones: dict | None) -> tuple[Resultado, dict[str, list[str]]]:
    """Arma el resultado con todos los snapshots: cada día sale del más reciente que lo contiene.

    El doc oficial va quitando los días que ya pasaron; así esos días siguen en la agenda con los datos
    del último snapshot que los tenía, y los días vigentes se actualizan con el doc nuevo.
    Devuelve también, por cada snapshot que no es el más nuevo, los días que aportó.
    """
    total = Resultado()
    cubiertas: set[str] = set()
    aportes: dict[str, list[str]] = {}
    sedes = {}
    for i, ruta in enumerate(sorted(snapshots, reverse=True)):
        res = parsear(ruta.read_text(encoding="utf-8"), extracciones, enlaces_de(ruta))
        fechas = _fechas_de(res) - cubiertas
        if not fechas:
            continue
        cubiertas |= fechas
        if i > 0:
            aportes[ruta.name] = sorted(fechas)
        hashes = {h for h, info in res.bloques_info.items() if info["fecha"] in fechas}
        total.eventos += [e for e in res.eventos if e.fecha in fechas]
        total.avisos_dias |= {d: t for d, t in res.avisos_dias.items() if d in fechas}
        total.bloques |= {h: t for h, t in res.bloques.items() if h in hashes}
        total.bloques_info |= {h: res.bloques_info[h] for h in hashes}
        total.extraccion_pendiente |= {h: t for h, t in res.extraccion_pendiente.items() if h in hashes}
        # advertencias y conflictos llevan la fecha en el texto: en los snapshots viejos solo las de los días que aportan
        de_estos_dias = lambda texto: i == 0 or any(f in texto for f in fechas)  # noqa: E731
        total.advertencias += [a for a in res.advertencias if de_estos_dias(a)]
        total.conflictos += [c for c in res.conflictos if de_estos_dias(c)]
        for sede in res.sedes:
            sedes.setdefault(sede.id, sede)
    total.sedes = list(sedes.values())
    total.eventos.sort(key=lambda e: (e.hora_inicio, e.sede_id, e.id))
    return total, aportes


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
    ap.add_argument("snapshot", nargs="?", type=Path, help="un solo snapshot; por defecto se combinan todos los de fixtures/")
    ap.add_argument(
        "--permitir-pendientes", action="store_true",
        help="construir aunque haya bloques sin extracción (esos eventos quedan solo con regex)",
    )
    args = ap.parse_args(argv)

    snapshots = [args.snapshot] if args.snapshot else todos_los_snapshots()
    fixture = snapshots[-1]
    antes, _ = combinar(snapshots, None)
    res, aportes = combinar(snapshots, cargar_cache())

    if res.extraccion_pendiente and not args.permitir_pendientes:
        print(f"ERROR: {len(res.extraccion_pendiente)} bloques con extraccion_pendiente (snapshots {', '.join(s.name for s in snapshots)}).")
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
        "snapshots_antiguos": aportes,  # días que se conservan de snapshots viejos porque el doc ya no los trae
    }
    (RAIZ / "data" / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Fuente: {fixture.name}")
    for nombre, dias in aportes.items():
        print(f"  + {len(dias)} días de {nombre} (el doc nuevo ya no los trae): {dias[0]} a {dias[-1]}")
    print(reporte(res, antes))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
