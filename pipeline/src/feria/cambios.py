# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 Illak Zapata
"""Diff entre la versión publicada y la nueva de eventos.json."""
from .sedes import slug

CAMPOS = [
    "fecha", "hora_inicio", "hora_fin", "sede_id", "titulo", "descripcion", "tipo", "ciclo",
    "temas", "personas", "libros_presentados", "editorial", "publico",
]
CRITICOS = {"fecha", "hora_inicio", "hora_fin", "sede_id"}


def _valor(campo: str, v) -> str:
    if campo == "personas":
        return ", ".join(f"{p['nombre']} ({p['rol']})" for p in v) or "—"
    if isinstance(v, list):
        return ", ".join(v) or "—"
    if campo.startswith("hora"):
        return v[11:16] or "—"
    texto = str(v)
    return (texto[:80] + "…" if len(texto) > 80 else texto) or "—"


def calcular(viejos: list[dict], nuevos: list[dict]) -> dict:
    """Empareja por id; lo que queda se empareja por (fecha, título) y luego por título,
    así un cambio de hora o sede (que cambia el id) se ve como modificación y no como alta + baja."""
    por_id = {e["id"]: e for e in viejos}
    pares, agregados = [], []
    resto_nuevos = []
    for n in nuevos:
        if n["id"] in por_id:
            pares.append((por_id.pop(n["id"]), n))
        else:
            resto_nuevos.append(n)
    resto_viejos = list(por_id.values())

    for clave in (lambda e: (e["fecha"], slug(e["titulo"])), lambda e: slug(e["titulo"])):
        grupos: dict = {}
        for v in sorted(resto_viejos, key=lambda e: e["hora_inicio"]):
            grupos.setdefault(clave(v), []).append(v)
        sin_par = []
        for n in sorted(resto_nuevos, key=lambda e: e["hora_inicio"]):
            candidatos = grupos.get(clave(n))
            if candidatos:
                pares.append((candidatos.pop(0), n))
            else:
                sin_par.append(n)
        resto_viejos = [v for lista in grupos.values() for v in lista]
        resto_nuevos = sin_par
    agregados = resto_nuevos

    modificados = []
    for v, n in pares:
        dif = [c for c in CAMPOS if v.get(c) != n.get(c)]
        if dif:
            modificados.append({"viejo": v, "nuevo": n, "campos": dif})
    modificados.sort(key=lambda m: (m["nuevo"]["hora_inicio"], m["nuevo"]["id"]))
    return {"agregados": agregados, "eliminados": resto_viejos, "modificados": modificados}


def _linea(e: dict) -> str:
    return f"{e['fecha']} {e['hora_inicio'][11:16]} · {e['sede_id'] or 'sin sede'} · {e['titulo'][:90]}"


def a_markdown(d: dict, encabezado: str) -> str:
    out = [encabezado, ""]
    out.append(
        f"Agregados: {len(d['agregados'])} · Eliminados: {len(d['eliminados'])} · Modificados: {len(d['modificados'])}"
    )
    criticos = [m for m in d["modificados"] if CRITICOS & set(m["campos"])]
    if criticos:
        out += ["", "### Cambios de horario o sede", ""]
        for m in criticos:
            out.append(f"- **{m['nuevo']['titulo'][:90]}**")
            for c in m["campos"]:
                if c in CRITICOS:
                    out.append(f"  - {c}: {_valor(c, m['viejo'][c])} → {_valor(c, m['nuevo'][c])}")
    otros = [m for m in d["modificados"] if m not in criticos]
    if otros:
        out += ["", "### Otras modificaciones", ""]
        for m in otros:
            out.append(f"- **{m['nuevo']['titulo'][:90]}** ({m['nuevo']['fecha']} {m['nuevo']['hora_inicio'][11:16]})")
            for c in m["campos"]:
                out.append(f"  - {c}: {_valor(c, m['viejo'][c])} → {_valor(c, m['nuevo'][c])}")
    if d["agregados"]:
        out += ["", "### Agregados", ""] + [f"- {_linea(e)}" for e in d["agregados"]]
    if d["eliminados"]:
        out += ["", "### Eliminados", ""] + [f"- {_linea(e)}" for e in d["eliminados"]]
    return "\n".join(out) + "\n"
