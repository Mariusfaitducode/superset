"""Fills the given msgids in every non-English catalog. Usage: fill.py <translations.json>"""
import json, os, sys
LOCS = ["cs","de","es","fr","id","it","ja","ko","nl","pl","pt-BR","ru","tr","vi","zh-CN","zh-TW"]
T = json.load(open(sys.argv[1]))
root = os.path.join(os.path.dirname(__file__), "..", "..", "packages", "i18n", "locales")
esc = lambda v: v.replace("\\", "\\\\").replace('"', '\\"')
for i, loc in enumerate(LOCS):
    p = os.path.join(root, loc, "messages.po"); s = open(p).read(); n = 0
    for mid, trs in T.items():
        pat = 'msgid "%s"\nmsgstr ""\n' % esc(mid)
        if pat in s:
            s = s.replace(pat, 'msgid "%s"\nmsgstr "%s"\n' % (esc(mid), esc(trs[i])), 1); n += 1
    open(p, "w").write(s); print(loc, n, end="  ")
print()
