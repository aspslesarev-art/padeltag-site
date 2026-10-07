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
# Ссылки на приложение в магазинах. Пусто — кнопка «Скоро» и не нажимается.
# QR на сайте и упаковке ведёт на /app — он сам открывает нужный магазин, сам код не меняется.
STORE = {'ios': '', 'android': ''}
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
    # Короткое слово через дефис («онлайн-табло», «15-30-40») не рвём на две строки: невидимая склейка после дефиса.
    body = re.sub(r'\b(\w{1,8})-(?=\w{1,8}\b)', '\\1-\u2060', body)
    body = re.sub(r'(\d)–(?=\d)', '\\1–\u2060', body)  # диапазон «$7–14» не рвём
    if code == 'fr':
        body = re.sub(r' ([?!;:»])', NNB + r'\1', body).replace('« ', '«' + NNB)
    return lead + body + trail

PHRASES = {'aud1_t', 'aud2_t', 'aud3_t'}
SKIP_TYPO = {'h1_b', 'meta_title', 'meta_desc', 'og_desc', 'q1', 'q2', 'sep'}

PAGES = ['', 'new', 'pro', 'club']  # главная и три страницы под аудитории: /ru/, /ru/new/, /ru/pro/, /ru/club/
AUD_N = {'new': 1, 'pro': 2, 'club': 3}

def page_path(path, page): return path + (page + '/' if page else '')

def cut(src, page):
    """Оставляет блоки <!--main-->…<!--/main--> только на главной, <!--aud-->…<!--/aud--> — только на страницах аудиторий."""
    keep, drop = ('main', 'aud') if not page else ('aud', 'main')
    src = re.sub(r'<!--%s-->.*?<!--/%s-->' % (drop, drop), '', src, flags=re.S)
    return src.replace('<!--%s-->' % keep, '').replace('<!--/%s-->' % keep, '')

for code, _, path, direction in LANGS:
  for page in PAGES:
    tr = dict(en); tr.update(T.get(code, {}))
    if page:
        b = tr[page + '_badge']; tr['meta_title'] = 'PadelTag - ' + b[0].lower() + b[1:] if code != 'de' else 'PadelTag - ' + b
    tr = {k: (v if k in SKIP_TYPO else typo(v, code)) for k, v in tr.items()}
    names = NAMES[code]
    tr['players'] = names
    for i, n in enumerate(names): tr['pn%d' % i] = n; tr['pi%d' % i] = n[0]
    if not page:
        missing = [k for k in en if code != 'en' and k not in T.get(code, {}) and k not in ('q1', 'q2', 'sep')]
        if missing: print(code, 'missing:', missing)
    pp = page_path(path, page)
    hl = '\n'.join(f'<link rel="alternate" hreflang="{c}" href="{SITE}{page_path(p, page)}">' for c, _, p, _ in LANGS)
    hl += f'\n<link rel="alternate" hreflang="x-default" href="{SITE}{page_path("/", page)}">'
    opts = ''.join(f'<option value="{c}" data-href="{page_path(p, page)}"{" selected" if c == code else ""}>{n}</option>' for c, n, p, _ in LANGS)
    out = cut(tpl, page)
    def fill(m):
        k = m.group(1)
        if k == 'lang': return code
        if k == 'dir': return direction
        if k == 'path': return pp
        if k == 'base': return path
        if k == 'hreflang': return hl
        if k == 'autolang': return autolang if code == 'en' and not page else ''
        if k == 'langopts': return opts
        if k.startswith('X_'):  # подстановки страницы аудитории
            x = k[2:]
            if x.startswith('cur_'): return 'aria-current="page"' if x[4:] == page else ''
            if x == 'mode': return '1' if page == 'new' else '4'
            if x == 'try_p': k = page + '_try_p' if page else 'try_p'
            elif x == 'h': k = 'aud%d_t' % AUD_N[page]
            elif x == 'p': k = 'hero_p_' + page
            else: k = page + '_' + x
        if k in ('ios_url', 'android_url'):
            u = STORE['ios' if 'ios' in k else 'android']; return html.escape(u) if u else '#app'
        if k in ('ios_attrs', 'android_attrs'):
            u = STORE['ios' if 'ios' in k else 'android']
            return 'target="_blank" rel="noopener"' if u else 'aria-disabled="true" tabindex="-1" onclick="return false"'
        if k in ('ios_soon', 'android_soon'):
            return '' if STORE['ios' if 'ios' in k else 'android'] else '<span class="pt-soon">' + html.escape(tr['soon']) + '</span>'
        if k == 'js': return json.dumps({k2: tr[k2] for k2 in JS_KEYS}, ensure_ascii=False).replace('</', '<\\/')
        if k in PHRASES:  # заголовок режется по смыслу: после ? . ! и после тире, кусок целиком переносится на новую строку
            return ' '.join('<span class="pt-ph">' + html.escape(c) + '</span>' for c in re.split(r'(?<=[?!.:-]) ', tr[k]))
        return html.escape(tr[k], quote=True)
    out = re.sub(r'\{\{(\w+)\}\}', fill, out)
    assert '{{' not in out
    out = out.replace('/tag.png"', '/tag.png?v=' + TAG_V + '"')
    out = out.replace('src="/demo.js"', 'src="/demo.js?v=' + DEMO_V + '"')
    dest = root / pp.strip('/') / 'index.html' if pp != '/' else root / 'index.html'
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(out)
    print('built', dest.relative_to(root))

sm = ''.join(f'<url><loc>{SITE}{page_path(p, pg)}</loc>' + ''.join(f'<xhtml:link rel="alternate" hreflang="{c2}" href="{SITE}{page_path(p2, pg)}"/>' for c2, _, p2, _ in LANGS) + '</url>' for pg in PAGES for _, _, p, _ in LANGS)
(root / 'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">' + sm + '</urlset>\n')
(root / 'app').mkdir(exist_ok=True)
(root / 'app' / 'index.html').write_text('''<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>PadelTag app</title><meta name="robots" content="noindex">
<script>(function(){var ua=navigator.userAgent,ios=%s,android=%s;
var isIOS=/iPhone|iPad|iPod/.test(ua)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
location.replace(isIOS&&ios?ios:(/Android/.test(ua)&&android?android:"/#app"));})();</script></head>
<body style="font-family:system-ui;padding:24px"><a href="/#app">PadelTag</a></body></html>
''' % (json.dumps(STORE['ios']), json.dumps(STORE['android'])))
(root / 'robots.txt').write_text(f'User-agent: *\nAllow: /\nSitemap: {SITE}/sitemap.xml\n')
