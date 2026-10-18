"""Parser por regex del texto exportado del Google Doc."""
import re
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta

from .extraccion import Extraccion, hash_bloque
from .modelos import Evento, Persona, Sede
from .sedes import CARPAS, buscar_carpa, sede_externa, slug

DIAS_SEMANA = ["LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO", "DOMINGO"]
INICIO_FERIA = date(2026, 10, 30)
FIN_FERIA = date(2026, 11, 15)
TZ = "-03:00"

RE_DIA = re.compile(
    r"^\s*\|\s*(LUNES|MARTES|MIÉRCOLES|JUEVES|VIERNES|SÁBADO|DOMINGO)\s+(\d{1,2})\s*$", re.I
)
RE_HORA = re.compile(
    r"^\s*(\d{1,2})[.:](\d{2})(?:\s*(a|A|-|y)\s*(\d{1,2})[.:](\d{2}))?\s*$"
)
RE_DIRECCION = re.compile(r"\d")
RE_LUGAR = re.compile(
    r"^(?:Invita:\s*|Lugar:\s*)?(Carpa|Escenario|Sala|Salón|Teatro|Biblioteca|Centro Cultural|Museo|"
    r"Explanada|Academia|Facultad|Escuela|Supermanzana|Cineclub|Kultur|Plaza|Mediateca|Auditori)",
    re.I,
)

STOPWORDS = {
    "a", "al", "con", "de", "del", "el", "en", "la", "las", "lo", "los", "para",
    "por", "un", "una", "y", "e", "o", "que", "su", "sus", "se",
}

ROLES = {
    "autor": "autor", "autora": "autor", "autores": "autor", "autoras": "autor",
    "presenta": "presenta", "presentan": "presenta", "presentación": "presenta",
    "modera": "modera", "moderan": "modera", "moderador": "modera", "moderadora": "modera",
    "participan": "participa", "participa": "participa", "disertante": "participa",
    "disertantes": "participa", "invitado": "participa", "invitados": "participa",
    "invitada": "participa", "invitadas": "participa", "acompañan": "participa",
    "acompaña": "participa", "tallerista": "a_cargo", "a cargo de": "a_cargo",
    "coordina": "a_cargo", "coordinan": "a_cargo",
    "dirección": "realizador", "realización": "realizador",
}
# etiquetas ambiguas: sirven de respaldo sin LLM, pero no tienen prioridad sobre el LLM
ETIQUETAS_FLEXIBLES = {
    "coordina", "coordinan", "acompaña", "acompañan", "tallerista",
    "invitado", "invitada", "invitados", "invitadas",
}
RE_CAMPO = re.compile(
    r"(?<![\wÀ-ÿ])(a cargo de|autor(?:es|as|a)?|presenta(?:n|ción)?|moderador(?:a)?|"
    r"modera(?:n)?|participa(?:n)?|disertantes?|invitad[oa]s?|acompaña(?:n)?|"
    r"tallerista|coordina(?:n)?|dirección|realización)\s*:\s*",
    re.I,
)
RE_EDITORIAL_CAMPO = re.compile(r"(?<![\wÀ-ÿ])editorial\s*:\s*([^.\n]+)", re.I)
RE_EDITORIAL_PAREN = re.compile(r"\(\s*(?:Ed\.|Editorial|Ediciones)\s+([^)]+)\)", re.I)
RE_ORGANIZACION = re.compile(
    r"^(editorial|ed\.|ediciones|biblioteca|dirección|direccion|secretar|municipalidad|"
    r"instituto|centro|universidad|asociación|asociacion|fundación|fundacion|coro|"
    r"goethe|alianza|archivo|escuela|colegio|facultad|museo|cineclub)|"
    r"\b(s\.?a\.?|s\.?r\.?l\.?)$",
    re.I,
)
RE_LIBRO = re.compile(
    r"^Presentación (?:del libro|del poemario|de la novela|del|de)\s+(?P<libro>.+?)"
    r"(?:,\s+(?:de|escrito por|escrita por)\s+(?P<autor>[^,.(]+?))?\s*(?:\([^)]*\))?\.?\s*$",
    re.I,
)
RE_AUTOR_TITULO = re.compile(r",\s+(?:de|escrit[oa] por)\s+([^,.(]+?)\s*(?:\([^)]*\))?\.?\s*$")

TIPOS = [
    (r"\bpresentaci[oó]n\b|\bpresenta\b", "presentacion"),
    (r"\btaller\b", "taller"),
    (r"\bproyecci[oó]n\b|\bcine\b", "proyeccion"),
    (r"\bespect[aá]culo\b|escenario art[ií]stico|\bconcierto\b|\bmúsica\b|\bnarraci[oó]n\b", "espectaculo"),
    (r"\bcharla\b|\bconversatorio\b|\bpanel\b|\bmesa\b|\bentrevista\b|\bencuentro\b", "charla"),
]
RE_INFANCIAS = re.compile(r"\binfancias?\b|\bni[ñn]os\b|\bni[ñn]as\b|\binfantil", re.I)


DURACION_ESTIMADA = timedelta(minutes=60)


def avisos_dias(texto: str) -> dict[str, str]:
    """Días del doc que no traen ninguna actividad pero sí un texto (ej. el 10/11): fecha ISO -> aviso."""
    avisos: dict[str, list[str]] = {}
    actual = None
    con_actividad: set[str] = set()
    for linea in texto.lstrip("﻿").splitlines():
        if m := RE_DIA.match(linea):
            actual = fecha_de(m.group(1), int(m.group(2))).isoformat()
            avisos[actual] = []
        elif actual and RE_HORA.match(linea):
            con_actividad.add(actual)
        elif actual and linea.strip():
            avisos[actual].append(linea.strip())
    return {d: " ".join(ls) for d, ls in avisos.items() if ls and d not in con_actividad}


@dataclass
class Resultado:
    eventos: list[Evento] = field(default_factory=list)
    sedes: list[Sede] = field(default_factory=list)
    advertencias: list[str] = field(default_factory=list)
    bloques: dict[str, str] = field(default_factory=dict)  # hash -> texto crudo del bloque
    bloques_info: dict[str, dict] = field(default_factory=dict)  # hash -> fecha, hora, sede, titulo
    extraccion_pendiente: dict[str, str] = field(default_factory=dict)  # hash -> texto sin extracción
    conflictos: list[str] = field(default_factory=list)  # etiqueta explícita vs LLM
    avisos_dias: dict[str, str] = field(default_factory=dict)  # fecha ISO -> aviso de un día sin actividades


def fecha_de(dia_nombre: str, numero: int) -> date:
    """El doc trae día de la semana y número, no el mes: se infiere del rango de la feria."""
    mes = 10 if numero >= 30 else 11
    return date(2026, mes, numero)


def corto(sede_id: str, limite: int = 25) -> str:
    """Recorta el id de sede por palabras completas para usarlo dentro del id del evento."""
    palabras: list[str] = []
    for w in sede_id.split("-"):
        if len("-".join([*palabras, w])) > limite:
            break
        palabras.append(w)
    return "-".join(palabras)


def a_iso(d: date, h: int, m: int, dia_extra: int = 0) -> str:
    dt = datetime(d.year, d.month, d.day, h, m) + timedelta(days=dia_extra)
    return dt.strftime("%Y-%m-%dT%H:%M:00") + TZ


def segmentar(texto: str) -> list[tuple[date, list[tuple[re.Match, list[str]]]]]:
    """Corta por día y por hora: devuelve, por día, una lista de (hora, líneas del bloque)."""
    dias = []
    for linea in texto.lstrip("﻿").splitlines():
        if m := RE_DIA.match(linea):
            dias.append((fecha_de(m.group(1), int(m.group(2))), m.group(1).upper(), []))
        elif dias:
            if m := RE_HORA.match(linea):
                dias[-1][2].append((m, []))
            elif dias[-1][2]:
                dias[-1][2][-1][1].append(linea.rstrip())
    return [(d, bloques) for d, _, bloques in dias], [n for _, n, _ in dias]


def separar_sede(lineas: list[str]) -> tuple[str, list[str]]:
    """La sede es la última línea no vacía del bloque, si parece una sede."""
    while lineas and not lineas[-1].strip():
        lineas = lineas[:-1]
    if not lineas:
        return "", []
    ultima = lineas[-1].strip()
    es_sede = (
        buscar_carpa(ultima) is not None
        or ("|" in ultima and len(ultima) < 160)
        or (len(ultima) < 130 and RE_DIRECCION.search(ultima) and (" - " in ultima or "," in ultima))
        or (len(ultima) < 110 and RE_LUGAR.match(ultima))
    )
    return (ultima, lineas[:-1]) if es_sede else ("", lineas)


def partir_titulo(linea: str) -> tuple[str, str]:
    """Separa el prefijo de ciclo ('CICLO | título') del título."""
    if m := re.match(r"^([^|]{2,60}?)\s*\|\s*(.+)$", linea):
        return m.group(1).strip(), m.group(2).strip()
    return "", linea.strip()


RE_MARCA_HORA = re.compile(r"\((\d{1,2})[:;.](\d{2})\)")


def dividir_sesiones(descripcion: str) -> list[tuple[int, int, str]]:
    """Bloques con varios horarios en el texto ('Libro, de Autor (15:00), Otro (16:00)')."""
    marcas = list(RE_MARCA_HORA.finditer(descripcion))
    if len(marcas) < 3:
        return []
    sesiones, inicio = [], 0
    for i, mk in enumerate(marcas):
        seg = descripcion[inicio:mk.start()]
        if i == 0:
            seg = re.sub(r"^.*?\blibros\s+", "", seg, count=1)
        else:
            seg = re.sub(r"^[\s,;.]*(?:y\s+)?", "", seg)
        inicio = mk.end()
        sesiones.append((int(mk.group(1)), int(mk.group(2)), seg.strip(" ,;.")))
    return sesiones


def libros_y_autores(segmento: str) -> tuple[list[str], list[str]]:
    """'A, B y C, de X y Y' -> (['A','B','C'], ['X','Y'])."""
    if ", de " not in segmento:
        return [], []
    libros, autores = segmento.rsplit(", de ", 1)
    return (
        [l.strip() for l in re.split(r",\s+|\s+y\s+", libros) if l.strip()],
        [a.strip() for a in re.split(r",\s+|\s+y\s+", autores) if a.strip()],
    )


def extraer_personas(texto: str, firmes: bool = False) -> list[Persona]:
    """Personas con etiqueta explícita. Con firmes=True, solo las etiquetas sin ambigüedad."""
    personas: list[Persona] = []
    vistos: set[tuple[str, str]] = set()
    for m in RE_CAMPO.finditer(texto):
        etiqueta = m.group(1).lower()
        if firmes and etiqueta in ETIQUETAS_FLEXIBLES:
            continue
        rol = ROLES[etiqueta]
        resto = texto[m.end():]
        # el valor llega hasta el fin de la oración o de la línea
        valor = re.split(r"\.(?:\s|$)|\n", resto, maxsplit=1)[0]
        valor = re.sub(r"\([^)]*\)", "", valor)
        for nombre in re.split(r",|\sy\s|\se\s", valor):
            nombre = nombre.strip(" .;")
            nombre = re.sub(r"^(?:el|la|los|las|del|de la)\s+", "", nombre, flags=re.I)
            if (
                not nombre
                or len(nombre) > 60
                or RE_ORGANIZACION.search(nombre)
                or not nombre[0].isupper()
                or any(c.isdigit() for c in nombre)
                or (nombre, rol) in vistos
            ):
                continue
            vistos.add((nombre, rol))
            personas.append(Persona(autor_id=slug(nombre), nombre=nombre, rol=rol))
    return personas


def editorial_etiquetada(texto: str) -> str:
    """Editorial con etiqueta explícita ('Editorial:' o 'A cargo de: Editorial X')."""
    if m := RE_EDITORIAL_CAMPO.search(texto):
        return m.group(1).strip(" .")
    if m := re.search(r"A cargo de:\s*([^.\n]*(?:Editorial|Editora|Ediciones|Ed\.)[^.\n]*)", texto):
        return m.group(1).strip(" .")
    return ""


def extraer_editorial(texto: str) -> str:
    if firme := editorial_etiquetada(texto):
        return firme
    if m := RE_EDITORIAL_PAREN.search(texto):
        return m.group(1).strip()
    return ""


def clasificar(titulo: str, ciclo: str) -> str:
    base = f"{ciclo} {titulo}".lower()
    for patron, tipo in TIPOS:
        if re.search(patron, base):
            return tipo
    return "otro"


def combinar_personas(
    todas: list[Persona], firmes: list[Persona], x: Extraccion | None, ctx: str, conflictos: list[str]
) -> list[Persona]:
    """Las personas con etiqueta explícita mandan; el LLM completa y sus desacuerdos se registran."""
    if not x or not x.personas:
        return todas
    roles_firmes: dict[str, set[str]] = {}
    for p in firmes:
        roles_firmes.setdefault(slug(p.nombre), set()).add(p.rol)
    out = list(firmes)
    for p in x.personas:
        k = slug(p.nombre)
        if k in roles_firmes:
            if p.rol not in roles_firmes[k]:
                conflictos.append(
                    f"{ctx}: {p.nombre} figura como {'/'.join(sorted(roles_firmes[k]))} en el doc y el LLM dijo {p.rol}"
                )
            continue
        out.append(Persona(autor_id=k, nombre=p.nombre, rol=p.rol))
    return out


def combinar_editorial(texto: str, x: Extraccion | None, ctx: str, conflictos: list[str]) -> str:
    firme = editorial_etiquetada(texto)
    llm = x.editorial if x else ""
    if firme and llm:
        a, b = slug(firme), slug(llm)
        if a not in b and b not in a:
            conflictos.append(f"{ctx}: editorial {firme!r} en el doc y {llm!r} según el LLM")
    return firme or llm or extraer_editorial(texto)


def sesiones_de(m: re.Match, fecha: date, titulo: str, ciclo: str, cuerpo: list[str], sede_txt: str, res: Resultado) -> list[dict]:
    """Una o más sesiones del bloque: horarios múltiples ('11:00 y 15:00', o '(15:00)' en el texto)."""
    descripcion = " ".join(cuerpo[1:])
    h1, m1, sep, h2, m2 = m.groups()
    fin_bloque = (int(h2), int(m2)) if sep and sep.lower() != "y" else None
    subs = dividir_sesiones(descripcion)
    base = "\n".join([*cuerpo[:1]])
    if subs:
        if (subs[0][0], subs[0][1]) < (int(h1), int(m1)):
            res.advertencias.append(
                f"{fecha} {m.group(0).strip()}: la primera sesión ({subs[0][0]:02d}:{subs[0][1]:02d}) empieza antes que el bloque"
            )
        out = []
        for i, (hi, mi, seg) in enumerate(subs):
            fin = (subs[i + 1][0], subs[i + 1][1]) if i + 1 < len(subs) else fin_bloque
            libros, autores = libros_y_autores(seg)
            out.append(dict(
                hi=hi, mi=mi, fin=fin, titulo=f"{titulo}: {seg}", descripcion="", subsesion=True,
                texto=f"{base}\n{seg}\n{sede_txt}", libros=libros,
                autores=[Persona(autor_id=slug(a), nombre=a, rol="autor") for a in autores],
            ))
        return out
    inicios = [(int(h1), int(m1), fin_bloque)]
    if sep and sep.lower() == "y":
        inicios.append((int(h2), int(m2), None))
    libros, autores = [], []
    if len(titulo) <= 160 and (lb := RE_LIBRO.match(titulo)):
        libros = [lb.group("libro").strip(" .,")]
        if lb.group("autor"):
            nombre = lb.group("autor").strip()
            autores = [Persona(autor_id=slug(nombre), nombre=nombre, rol="autor")]
    return [
        dict(hi=hi, mi=mi, fin=fin, titulo=titulo, descripcion=descripcion, subsesion=False,
             texto=None, libros=libros, autores=autores)
        for hi, mi, fin in inicios
    ]


def parsear(texto: str, extracciones: dict[str, Extraccion] | None = None) -> Resultado:
    res = Resultado()
    usa_llm = extracciones is not None
    extracciones = extracciones or {}
    dias, nombres = segmentar(texto)
    sedes: dict[str, Sede] = {s.id: s for s in CARPAS}
    externas_avisadas: set[str] = set()
    ids_usados: dict[str, int] = {}

    for (fecha, bloques), nombre_dia in zip(dias, nombres):
        if not (INICIO_FERIA <= fecha <= FIN_FERIA):
            res.advertencias.append(f"fecha fuera de la feria: {fecha}")
        if DIAS_SEMANA[fecha.weekday()] != nombre_dia.upper():
            res.advertencias.append(f"{fecha}: el doc dice {nombre_dia}, el calendario dice {DIAS_SEMANA[fecha.weekday()]}")

        for m, lineas in bloques:
            sede_txt, cuerpo = separar_sede(lineas)
            cuerpo = [l.strip() for l in cuerpo if l.strip()]
            if not cuerpo:
                res.advertencias.append(f"{fecha} {m.group(0).strip()}: bloque sin contenido")
                continue

            sede_id = ""
            if sede_txt:
                sede_id = buscar_carpa(sede_txt) or ""
                if not sede_id:
                    ext = sede_externa(sede_txt)
                    sede_id = ext.id
                    if sede_id not in sedes:
                        sedes[sede_id] = ext
                    if sede_id not in externas_avisadas:
                        externas_avisadas.add(sede_id)
                        res.advertencias.append(f"sede fuera del catálogo: {sede_txt!r}")
            else:
                res.advertencias.append(f"{fecha} {m.group(0).strip()}: sin sede ({cuerpo[0][:50]!r})")

            texto_bloque = "\n".join(l.strip() for l in lineas if l.strip())
            ciclo, titulo = partir_titulo(cuerpo[0])

            for ses in sesiones_de(m, fecha, titulo, ciclo, cuerpo, sede_txt, res):
                hi, mi, fin = ses["hi"], ses["mi"], ses["fin"]
                titulo_ev, descripcion = ses["titulo"], ses["descripcion"]
                # cada sub-sesión se extrae por separado; el resto comparte el bloque
                texto_hash = ses["texto"] or texto_bloque
                h = hash_bloque(texto_hash)
                res.bloques[h] = texto_hash
                res.bloques_info[h] = dict(
                    fecha=fecha.isoformat(), hora=f"{hi:02d}:{mi:02d}", sede=sede_id, titulo=titulo_ev
                )
                x = extracciones.get(h)
                if usa_llm and not x:
                    res.extraccion_pendiente[h] = texto_hash

                texto_completo = texto_hash if ses["subsesion"] else "\n".join(cuerpo)
                ctx = f"{fecha} {hi:02d}:{mi:02d} {titulo_ev[:50]}"
                firmes = extraer_personas(texto_completo, firmes=True)
                personas = extraer_personas(texto_completo)
                if ses["autores"] and not any(p.rol == "autor" for p in personas):
                    personas = [*ses["autores"], *personas]
                personas = combinar_personas(personas, firmes, x, ctx, res.conflictos)
                editorial = combinar_editorial(texto_completo, x, ctx, res.conflictos)
                libros = (x.libros_presentados if x else []) or ses["libros"]
                temas = x.temas if x else []

                hora_fin = ""
                if fin:
                    extra = 1 if fin < (hi, mi) else 0
                    hora_fin = a_iso(fecha, fin[0], fin[1], extra)
                hora_fin_estimada = ""
                if not hora_fin:
                    t = datetime(fecha.year, fecha.month, fecha.day, hi, mi) + DURACION_ESTIMADA
                    hora_fin_estimada = t.strftime("%Y-%m-%dT%H:%M:00") + TZ

                confianza = 1.0
                if not sede_txt:
                    confianza -= 0.3
                elif sede_id not in {s.id for s in CARPAS}:
                    confianza -= 0.1
                if not descripcion and not ses["subsesion"]:
                    confianza -= 0.2
                if len(titulo_ev) > 160:
                    confianza -= 0.3

                palabras = [w for w in slug(titulo_ev).split("-") if w and w not in STOPWORDS][:5]
                base_id = "-".join(
                    p for p in [fecha.isoformat(), f"{hi:02d}{mi:02d}", corto(sede_id) or "sin-sede", *palabras] if p
                )
                ids_usados[base_id] = ids_usados.get(base_id, 0) + 1
                id_final = base_id if ids_usados[base_id] == 1 else f"{base_id}-{ids_usados[base_id]}"

                res.eventos.append(
                    Evento(
                        id=id_final,
                        fecha=fecha.isoformat(),
                        hora_inicio=a_iso(fecha, hi, mi),
                        hora_fin=hora_fin,
                        hora_fin_estimada=hora_fin_estimada,
                        titulo=titulo_ev,
                        descripcion=descripcion,
                        tipo=clasificar(titulo_ev, ciclo),
                        ciclo=ciclo,
                        temas=temas,
                        sede_id=sede_id,
                        personas=personas,
                        libros_presentados=libros,
                        editorial=editorial,
                        publico="infancias" if RE_INFANCIAS.search(f"{ciclo} {titulo_ev}") else "general",
                        confianza=round(max(confianza, 0.0), 2),
                    )
                )

    res.avisos_dias = avisos_dias(texto)
    res.eventos.sort(key=lambda e: (e.hora_inicio, e.sede_id, e.id))
    res.sedes = list(sedes.values())
    return res
