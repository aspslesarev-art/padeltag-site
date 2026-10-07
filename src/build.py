# Builds padeltag.app in every language: / (English) and /<lang>/index.html.
# Run: python3 src/build.py
import html, json, pathlib, re
from i18n import LANGS, EN_JS, T, NAMES

here = pathlib.Path(__file__).parent
root = here.parent
tpl = (here / 'template.html').read_text()
en = json.loads((here / 'en.json').read_text())
en.update(EN_JS)
JS_KEYS = list(EN_JS) + ['us', 'them', 'said_init', 'players']
SITE = 'https://padeltag.app'
import hashlib
TAG_V = hashlib.md5((root / 'tag.png').read_bytes()).hexdigest()[:8]
DEMO_V = hashlib.md5((root / 'demo.js').read_bytes()).hexdigest()[:8]  # новая версия скрипта — браузер не возьмёт старую из кэша

hreflang = '\n'.join(f'<link rel="alternate" hreflang="{c}" href="{SITE}{p}">' for c, _, p, _ in LANGS)
hreflang += f'\n<link rel="alternate" hreflang="x-default" href="{SITE}/">'
paths = {c: p for c, _, p, _ in LANGS}
# Root only: first visit -> page in the browser language. A choice in the menu wins.
autolang = ('<script>(function(){try{var L=' + json.dumps(paths, ensure_ascii=False) +
            ',s=localStorage.getItem("pt-lang");if(s){if(s!=="en"&&L[s])location.replace(L[s]);return}'
            'var n=navigator.languages||[navigator.language];for(var i=0;i<n.length;i++){var c=(n[i]||"").slice(0,2).toLowerCase();'
            'if(c==="en")return;if(L[c]){location.replace(L[c]+location.hash);return}}}catch(e){}})();</script>\n')

NB, NNB = '\u00a0', '\u202f'  # неразрывный пробел и узкий неразрывный (французская пунктуация)
# Служебные слова из трёх букв, которые не оставляем в конце строки (одно-двухбуквенные — всегда).
GLUE3 = {
    'ru': 'для без при над под про как что или его её мой наш ваш',
    'en': 'the and for but nor our',
    'es': 'los las del con por que sin una sus mis',
    'fr': 'les des une aux par sur que qui pas ton mon',
    'de': 'der die das den dem des ein und mit für auf aus bei von vor zum zur',
    'it': 'gli del dal nel sul con per una che',
    'pt': 'uma das dos com por que sem nas nos',
    'nl': 'het een van met aan bij uit',
    'sv': 'och att för med den det som',
    'da': 'for med den det som til',
    'ar': 'على إلى عن',
}
GLUE = {c: re.compile(r'(?<![\w\u2019\'-])(\w{1,2}|' + '|'.join(w.split()) + r'|\d[\d.,]*) (?=\S)', re.I)
        for c, w in GLUE3.items()}

def typo(t, code):
    """Журнальные переносы: короткое слово или число не остаётся в конце строки,
    тире не начинает строку, во французском знаки ? ! ; : и кавычки « » не отрываются."""
    if not isinstance(t, str) or not t.strip(): return t
    lead, trail = t[:len(t) - len(t.lstrip())], t[len(t.rstrip()):]
    body = t.strip()
    body = GLUE[code].sub(lambda m: m.group(1) + NB, body)
    body = body.replace(' - ', NB + '- ')
    if code == 'fr':
        body = re.sub(r' ([?!;:»])', NNB + r'\1', body).replace('« ', '«' + NNB)
    return lead + body + trail

SKIP_TYPO = {'h1_b', 'meta_title', 'meta_desc', 'og_desc', 'q1', 'q2', 'sep'}

for code, _, path, direction in LANGS:
    tr = dict(en); tr.update(T.get(code, {}))
    tr = {k: (v if k in SKIP_TYPO else typo(v, code)) for k, v in tr.items()}
    names = NAMES[code]
    tr['players'] = names
    for i, n in enumerate(names): tr['pn%d' % i] = n; tr['pi%d' % i] = n[0]
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
    out = out.replace('/tag.png"', '/tag.png?v=' + TAG_V + '"')
    out = out.replace('src="/demo.js"', 'src="/demo.js?v=' + DEMO_V + '"')
    dest = root / path.strip('/') / 'index.html' if path != '/' else root / 'index.html'
    dest.parent.mkdir(exist_ok=True)
    dest.write_text(out)
    print('built', dest.relative_to(root))

sm = ''.join(f'<url><loc>{SITE}{p}</loc>' + ''.join(f'<xhtml:link rel="alternate" hreflang="{c2}" href="{SITE}{p2}"/>' for c2, _, p2, _ in LANGS) + '</url>' for _, _, p, _ in LANGS)
(root / 'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">' + sm + '</urlset>\n')
(root / 'robots.txt').write_text(f'User-agent: *\nAllow: /\nSitemap: {SITE}/sitemap.xml\n')
