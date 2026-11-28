"""Helpers that build task-bank templates (content/drafts JSON) for the KNJ LAB task engine."""
import json, os

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'drafts', 'bank')

def I(n, a, b): return {"name": n, "kind": "int", "min": a, "max": b}
def D(n, a, b, step): return {"name": n, "kind": "decimal", "min": a, "max": b, "step": step}
def C(n, vals): return {"name": n, "kind": "choice", "values": vals}

def _spec(t, params, cons, derived, fig, **kw):
    s = {"type": t, "params": params or [], "constraints": cons or []}
    if derived: s["derived"] = [{"name": k, "expr": v} for k, v in derived]
    if fig: s["figure"] = fig
    s.update(kw)
    return s

def _texts(stmt, sol, hints=None, **kw):
    t = {"statement": stmt, "hints": hints or [], "solution": sol}
    t.update({k: v for k, v in kw.items() if v is not None})
    return {"ru": t}

def num(level, stmt, answer, unit, sol, params=None, decimals=None, hints=None, cons=None, derived=None, fig=None, tol=None):
    kw = {"answer": answer, "tolerance": tol or {}}
    if decimals is not None: kw["decimals"] = decimals
    if unit: kw["unit"] = unit
    return {"type": "number", "difficulty": level, "spec": _spec("number", params, cons, derived, fig, **kw), "texts": _texts(stmt, sol, hints)}

def ch(level, stmt, options, correct, sol, params=None, hints=None, cons=None, derived=None, fig=None):
    return {"type": "single_choice", "difficulty": level, "spec": _spec("single_choice", params, cons, derived, fig, correct=correct), "texts": _texts(stmt, sol, hints, options=options)}

def multi(level, stmt, options, correct, sol, params=None, hints=None, cons=None, derived=None, fig=None):
    return {"type": "multi_choice", "difficulty": level, "spec": _spec("multi_choice", params, cons, derived, fig, correct=correct), "texts": _texts(stmt, sol, hints, options=options)}

def match(level, stmt, left, right, sol, hints=None):
    return {"type": "matching", "difficulty": level, "spec": _spec("matching", [], [], None, None), "texts": _texts(stmt, sol, hints, options=left, matches=right)}

def order(level, stmt, items, sol, hints=None):
    return {"type": "ordering", "difficulty": level, "spec": _spec("ordering", [], [], None, None), "texts": _texts(stmt, sol, hints, options=items)}

def cloze(level, stmt, accepted, sol, hints=None):
    return {"type": "cloze_word", "difficulty": level, "spec": _spec("cloze_word", [], [], None, None), "texts": _texts(stmt, sol, hints, accepted=accepted)}

def formula(level, stmt, answer, variables, sol, rng=(1, 10), params=None, hints=None):
    return {"type": "formula", "difficulty": level, "spec": _spec("formula", params, [], None, None, answer=answer, variables=variables, range=list(rng)), "texts": _texts(stmt, sol, hints)}

import re as _re
_OK = _re.compile(r'^[a-z][a-z0-9_]{0,15}$')

def _rename(t):
    # Param names must be lowercase (task engine rule): F -> f, L0 -> l0; on a clash prefix with q.
    sp = t["spec"]
    names = [p["name"] for p in sp.get("params", [])] + [d["name"] for d in sp.get("derived", [])]
    taken = set(names); ren = {}
    for n in names:
        if _OK.match(n): continue
        new = n.lower()
        while new in taken or not _OK.match(new): new = 'q' + new
        taken.add(new); ren[n] = new
    if not ren: return t
    def fx(x):
        if isinstance(x, str):
            for a, b in ren.items(): x = _re.sub(r'(?<![A-Za-z0-9_])' + a + r'(?![A-Za-z0-9_])', b, x)
            return x
        if isinstance(x, list): return [fx(i) for i in x]
        if isinstance(x, dict): return {k: fx(v) for k, v in x.items()}
        return x
    for p in sp.get("params", []): p["name"] = ren.get(p["name"], p["name"])
    for d in sp.get("derived", []): d["name"] = ren.get(d["name"], d["name"]); d["expr"] = fx(d["expr"])
    for k in ("answer", "constraints", "figure"):
        if k in sp: sp[k] = fx(sp[k])
    def ft(x):
        if isinstance(x, str):
            for a, b in ren.items(): x = x.replace('{{' + a + '}}', '{{' + b + '}}')
            return x
        if isinstance(x, list): return [ft(i) for i in x]
        if isinstance(x, dict): return {k: ft(v) for k, v in x.items()}
        return x
    t["texts"] = ft(t["texts"])
    return t

def write(subject, folder, templates, topic=None, bank_topic=None):
    templates = [_rename(t) for t in templates]
    d = os.path.join(ROOT, subject, folder)
    os.makedirs(d, exist_ok=True)
    levels = {}
    for t in templates: levels[t["difficulty"]] = levels.get(t["difficulty"], 0) + 1
    for l in ("easy", "medium", "sufficient", "hard"):
        assert levels.get(l, 0) == 15, f"{folder}: {l} has {levels.get(l, 0)}"
    with open(os.path.join(d, "templates.json"), "w") as f: json.dump(templates, f, ensure_ascii=False, indent=2); f.write("\n")
    if topic:
        with open(os.path.join(d, "topic.json"), "w") as f: json.dump(topic, f, ensure_ascii=False, indent=2); f.write("\n")
    if bank_topic:
        with open(os.path.join(d, "bank.json"), "w") as f: json.dump({"topic": bank_topic}, f, ensure_ascii=False, indent=2); f.write("\n")
    print(folder, len(templates), levels)

def plot_line(points, x, y, ax='t, с', ay='s, м', label=None):
    f = {"kind": "plot", "x": x, "y": y, "lines": [{"points": points}], "axes": {"x": ax, "y": ay}}
    if label: f["lines"][0]["label"] = label
    return f
