"""Gera TRS26_v0.6_OFFLINE.html: um único arquivo com CSS, todos os scripts e as imagens do TRS26 embutidos
(data: URI). Abre direto com duplo clique, sem servidor e sem internet.
Limitação por desenho: o controle virtual no celular precisa do servidor do repo trs-mobile-device-management e de um
endereço http://; no arquivo único os scripts de mobile/ ficam de fora e a tela mostra a instrução para iniciar o servidor.
Uso: python3 tools/build_standalone.py [saida.html]"""
import base64, re, sys, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[1]
out = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT.parent / 'TRS26_v0.6_OFFLINE.html'
MIME = {'.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml'}
_cache = {}
def data_uri(rel):
    if rel not in _cache:
        f = ROOT / rel
        _cache[rel] = f'data:{MIME[f.suffix.lower()]};base64,' + base64.b64encode(f.read_bytes()).decode()
    return _cache[rel]
ASSET = re.compile(r'(?:\.\./)?(assets/branding/[A-Za-z0-9_.-]+\.(?:webp|png|jpg|svg))')
def embed_assets(text): return ASSET.sub(lambda m: data_uri(m.group(1)), text)
html = (ROOT / 'index.html').read_text(encoding='utf-8')
for href in ('styles.css', 'css/trs26.css'):
    css = (ROOT / href).read_text(encoding='utf-8')
    tag = f'<link href="{href}" rel="stylesheet"/>'
    assert tag in html, f'link de {href} não encontrado'
    html = html.replace(tag, f'<style>/* {href} */\n{embed_assets(css)}\n</style>')
def inline(m):
    src = m.group(1)
    js = embed_assets((ROOT / src).read_text(encoding='utf-8'))
    js = re.sub(r'</(script)', r'<\\/\1', js, flags=re.I)
    return f'<script>/* {src} */\n{js}\n</script>'
html = re.sub(r'<script src="mobile/[^"]+"></script>\n?', '', html)  # servidos pelo trs-mobile-device-management
html = re.sub(r'<script src="([^"]+)"></script>', inline, html)
html = embed_assets(html)
assert 'src="js/' not in html and 'src="data/' not in html, 'algum script não foi embutido'
assert 'stylesheet"' not in html, 'CSS não embutido'
left = re.findall(r'assets/branding/[A-Za-z0-9_.-]+', html)
assert not left, f'imagens não embutidas: {sorted(set(left))[:5]}'
out.write_text(html, encoding='utf-8')
print(f'OK: {out} ({out.stat().st_size/1024:.0f} KB, {len(_cache)} imagens embutidas)')
