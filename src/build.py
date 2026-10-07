# Builds padeltag.app in every language: / (English) and /<lang>/index.html.
# Run: python3 src/build.py
import html, json, pathlib, re
from i18n import LANGS, EN_JS, T

here = pathlib.Path(__file__).parent
root = here.parent
tpl = (here / 'template.html').read_text()
en = json.loads((here / 'en.json').read_text())
en.update(EN_JS)
JS_KEYS = list(EN_JS) + ['us', 'them', 'said_init']
SITE = 'https://padeltag.app'

hreflang = '\n'.join(f'<link rel="alternate" hreflang="{c}" href="{SITE}{p}">' for c, _, p, _ in LANGS)
hreflang += f'\n<link rel="alternate" hreflang="x-default" href="{SITE}/">'
paths = {c: p for c, _, p, _ in LANGS}
# Root only: first visit -> page in the browser language. A choice in the menu wins.
autolang = ('<script>(function(){try{var L=' + json.dumps(paths, ensure_ascii=False) +
            ',s=localStorage.getItem("pt-lang");if(s){if(s!=="en"&&L[s])location.replace(L[s]);return}'
            'var n=navigator.languages||[navigator.language];for(var i=0;i<n.length;i++){var c=(n[i]||"").slice(0,2).toLowerCase();'
            'if(c==="en")return;if(L[c]){location.replace(L[c]+location.hash);return}}}catch(e){}})();</script>\n')

for code, _, path, direction in LANGS:
    tr = dict(en); tr.update(T.get(code, {}))
    missing = [k for k in en if code != 'en' and k not in T.get(code, {}) and k not in ('q1', 'q2', 'sep')]
    if missing: print(code, 'missing:', missing)
    opts = ''.join(f'<option value="{c}" data-href="{p}"{" selected" if c == code else ""}>{n}</option>' for c, n, p, _ in LANGS)
    out = tpl
    def fill(m):
        k = m.group(1)
        if k == 'lang': return code
        if k == 'dir': return direction
        if k == 'path': return path
        if k == 'hreflang': return hreflang
        if k == 'autolang': return autolang if code == 'en' else ''
        if k == 'langopts': return opts
        if k == 'js': return json.dumps({k2: tr[k2] for k2 in JS_KEYS}, ensure_ascii=False).replace('</', '<\\/')
        return html.escape(tr[k], quote=True)
    out = re.sub(r'\{\{(\w+)\}\}', fill, out)
    assert '{{' not in out
    dest = root / path.strip('/') / 'index.html' if path != '/' else root / 'index.html'
    dest.parent.mkdir(exist_ok=True)
    dest.write_text(out)
    print('built', dest.relative_to(root))

sm = ''.join(f'<url><loc>{SITE}{p}</loc>' + ''.join(f'<xhtml:link rel="alternate" hreflang="{c2}" href="{SITE}{p2}"/>' for c2, _, p2, _ in LANGS) + '</url>' for _, _, p, _ in LANGS)
(root / 'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">' + sm + '</urlset>\n')
(root / 'robots.txt').write_text(f'User-agent: *\nAllow: /\nSitemap: {SITE}/sitemap.xml\n')
