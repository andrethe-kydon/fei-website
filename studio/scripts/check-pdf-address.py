"""Check a PDF's text LAYER for a contact address, not its render.

    python3 studio/scripts/check-pdf-address.py static/assets/brochures/*.pdf

Exits non zero if any file still carries the old address or is missing the new
one. Validate it against a known bad copy before trusting a pass:

    git show HEAD~1:static/assets/brochures/aop101.pdf > /tmp/old.pdf
    python3 studio/scripts/check-pdf-address.py /tmp/old.pdf   # must FAIL


A painted-over string is still in the text layer and still comes out of copy and
paste, so this decodes the content streams and reads the show-text operators.
Three things it has to survive:

  * ASCII85 then Flate, which is what ReportLab emits by default and which
    `strings` cannot see through at all.
  * CID fonts, where the bytes in the stream are glyph indices and the mapping
    back to characters lives in a ToUnicode CMap.
  * A string split across several show-text operators by kerning, so the search
    runs against text with all whitespace removed.
"""
import re, zlib, base64, sys

def _decode(blob):
    for fn in (lambda b: zlib.decompress(base64.a85decode(b.strip().rstrip(b'>').rstrip(b'~'), adobe=False)),
               lambda b: zlib.decompress(base64.a85decode(b.strip(), adobe=True)),
               lambda b: zlib.decompress(b),
               lambda b: base64.a85decode(b.strip(), adobe=True),
               lambda b: b):
        try:
            out = fn(blob)
            if out: return out
        except Exception:
            pass
    return None

def _streams(raw):
    for m in re.finditer(rb"stream", raw):
        s = m.end()
        while s < len(raw) and raw[s] in (13, 10, 32): s += 1
        e = raw.find(b"endstream", s)
        if e < 0: continue
        d = _decode(raw[s:e])
        if d: yield d

def _tounicode(streams):
    """Merged code -> char map from every ToUnicode CMap in the file."""
    m = {}
    for d in streams:
        if b"beginbfchar" not in d and b"beginbfrange" not in d: continue
        s = d.decode("latin-1")
        for seg in re.findall(r"beginbfchar(.*?)endbfchar", s, re.S):
            for a, b in re.findall(r"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>", seg):
                m[int(a, 16)] = chr(int(b[:4], 16))
        for seg in re.findall(r"beginbfrange(.*?)endbfrange", s, re.S):
            for a, b, c in re.findall(r"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>", seg):
                for i in range(int(a, 16), int(b, 16) + 1):
                    m[i] = chr(int(c, 16) + i - int(a, 16))
    return m

def text(path):
    raw = open(path, "rb").read()
    streams = list(_streams(raw))
    cmap = _tounicode(streams)
    out = []
    for d in streams:
        if b"BT" not in d: continue
        s = d.decode("latin-1")
        for tok in re.finditer(r"<([0-9A-Fa-f\s]+)>\s*Tj|\((?:\\.|[^()\\])*\)\s*Tj|\[((?:[^\[\]\\]|\\.)*)\]\s*TJ", s):
            t = tok.group(0)
            if t.startswith("<"):
                hx = re.sub(r"\s", "", tok.group(1))
                out.append("".join(cmap.get(int(hx[i:i+4], 16), "�") for i in range(0, len(hx) - 3, 4)))
            else:
                for lit in re.findall(r"\((?:\\.|[^()\\])*\)", t):
                    lit = lit[1:-1]
                    for a, b in [("\\(", "("), ("\\)", ")"), ("\\\\", "\\")]:
                        lit = lit.replace(a, b)
                    if cmap and re.fullmatch(r"[\x00-\xff]*", lit) and any(ord(c) < 32 for c in lit):
                        out.append("".join(cmap.get(ord(c), c) for c in lit))
                    else:
                        out.append(lit)
    # Also the raw decoded bytes, so a string sitting in a stream this parser did
    # not classify as text is still found rather than silently missed.
    joined = "".join(out)
    rawtext = b"\n".join(streams).decode("latin-1", "replace")
    return joined, rawtext

def flat(s):
    return re.sub(r"\s+", "", s)

if __name__ == "__main__":
    OLD, NEW = "sales@kydongrp.com", "enquiry@futureedgeinstitute.com"
    bad = 0
    print(f"{'file':30} {'OLD':>4} {'NEW':>4}   verdict")
    for p in sys.argv[1:]:
        layer, rawtext = text(p)
        f_layer, f_raw = flat(layer), flat(rawtext)
        old = max(f_layer.count(flat(OLD)), f_raw.count(flat(OLD)))
        new = max(f_layer.count(flat(NEW)), f_raw.count(flat(NEW)))
        ok = old == 0 and new > 0
        if not ok: bad += 1
        print(f"{p.split('/')[-1]:30} {old:>4} {new:>4}   {'ok' if ok else 'FAIL'}")
    print()
    print("ALL CLEAN" if bad == 0 else f"{bad} FILE(S) STILL CARRY THE OLD ADDRESS")
    sys.exit(1 if bad else 0)
