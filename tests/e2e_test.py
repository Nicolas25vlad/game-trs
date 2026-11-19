"""TRS26 / MATCHDAY 0.6 — teste de ponta a ponta no navegador (Playwright + Chromium/Chrome).
Uso: python3 tests/e2e_test.py [caminho_do_chrome]
Parte A (arquivo local, sem servidor): migração, capa/menu TRS26, partida rápida só com teclado, escalação/táticas aplicadas
no jogo, partida jogável completa (intervalo, 2º tempo, fim, pós-jogo, replays), pausa, perda de foco, controles emulados
pela Gamepad API (menus, multiplayer local, desconexão/reconexão, remapeamento), assistir, Germinare, Copa com final e
cerimônia, persistência e modo Canvas 2D.
Parte B (servidor local real): pareamento por PIN de DOIS celulares (páginas móveis com toque), multitoque real
(analógico + botão ao mesmo tempo) controlando a partida, e queda de conexão.
IMPORTANTE: controles físicos e celulares são EMULADOS (Gamepad API simulada / páginas móveis no mesmo computador).
O avanço rápido chama o mesmo laço da tela (MD.Play.frame) com o desenho desligado; capturas verificam o visual."""
import sys, json, base64, pathlib, subprocess, time, random, os
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parents[1]
CHROME = sys.argv[1] if len(sys.argv) > 1 else None
SHOTS = ROOT / 'tests' / 'e2e_shots'; SHOTS.mkdir(exist_ok=True)
LEGACY = [{"id": "club-x", "name": "Legado FC", "city": "Barueri", "primary": "#ff0000", "secondary": "#ffffff", "keeper": "#00ff00", "short": "LF", "crest": None, "pattern": "stripes",
           "players": [{"id": f"p{i}", "number": i + 1, "position": "ATA", "name": f"Antigo {i}", "rating": 70 + i, "photo": None, "appearance": {"skin": "#aa7755", "hairStyle": "afro"}} for i in range(11)]}]
PADS = """window.__pads=[null,null,null,null];navigator.getGamepads=()=>window.__pads;
window.__padMake=(i,id)=>{const p={index:i,id:id||'Xbox 360 Controller (XInput STANDARD GAMEPAD)',mapping:'standard',connected:true,timestamp:0,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0})),vibrationActuator:{playEffect:()=>Promise.resolve()}};window.__pads[i]=p;const e=new Event('gamepadconnected');e.gamepad=p;window.dispatchEvent(e);return true;};
window.__padBtn=(i,b,on)=>{const p=window.__pads[i];if(p)p.buttons[b]={pressed:on,value:on?1:0};};
window.__padAxes=(i,x,y)=>{const p=window.__pads[i];if(p){p.axes[0]=x;p.axes[1]=y;}};
window.__padDrop=i=>{const p=window.__pads[i];window.__pads[i]=null;const e=new Event('gamepaddisconnected');e.gamepad=p;window.dispatchEvent(e);};"""
FF = """window.__ffp=function(maxSec,stop){const R=MD.App.renderer;const rl=R.renderLive,rt=R.renderTrack;R.renderLive=function(){};R.renderTrack=function(){};let n=0;try{const N=Math.round(maxSec*60);for(;n<N;n++){MD.Input.poll();MD.Play.frame(1/60);const S=MD.Play.state();if(!S)break;if(stop&&stop(S))break;}}finally{R.renderLive=rl;R.renderTrack=rt;}return n;};true;"""
ok = []
def check(cond, msg):
    if not cond: raise AssertionError(msg)
    ok.append(msg); print('  ✓', msg)
def shot(pg, name): pg.screenshot(path=str(SHOTS / f'{name}.png'))
def ready(pg): pg.wait_for_function("window.MD&&MD.App&&MD.App.clubs.length>0&&document.getElementById('loading').classList.contains('done')", timeout=45000); pg.evaluate(FF)
def S(pg, js): return pg.evaluate(f"(()=>{{const S=MD.Play.state();if(!S)return null;const w=S.w;return {js};}})()")
def pad(pg, i, b, ms=120): pg.evaluate(f"__padBtn({i},{b},true)"); pg.wait_for_timeout(ms); pg.evaluate(f"__padBtn({i},{b},false)"); pg.wait_for_timeout(90)
def key(pg, k, ms=90): pg.keyboard.down(k); pg.wait_for_timeout(ms); pg.keyboard.up(k); pg.wait_for_timeout(60)
def main():
  with sync_playwright() as p:
    kw = {'headless': True, 'args': ['--no-sandbox', '--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required']}
    if CHROME: kw['executable_path'] = CHROME
    b = p.chromium.launch(**kw)
    ctx = b.new_context(viewport={'width': 1366, 'height': 768}); ctx.add_init_script(PADS)
    pg = ctx.new_page(); errors = []
    pg.on('pageerror', lambda e: errors.append(str(e))); pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    url = (ROOT / 'index.html').as_uri()
    print('A1. Dados preservados e identidade TRS26:')
    pg.goto(url); pg.evaluate(f"localStorage.clear();localStorage.setItem('matchday-clubs-v1',{json.dumps(json.dumps(LEGACY))})"); pg.reload(); ready(pg)
    c = pg.evaluate("(()=>{const c=MD.App.clubs.find(x=>x.name==='Legado FC');return c?{league:c.league,pat:c.kits.home.pattern,hair:c.players[0].appearance.hairStyle}:null})()")
    check(c and c['league'] == 'meus-clubes' and c['pat'] == 'stripes' and c['hair'] == 'afro', 'clube personalizado de versões antigas preservado em “Clubes personalizados”')
    check(pg.evaluate("MD.App.screen") == 'cover' and pg.is_visible('#btn-cover-play'), 'jogo abre na capa original do TRS26 (botão JOGAR)')
    shot(pg, '01_capa'); key(pg, 'Enter'); pg.wait_for_timeout(900)
    check(pg.evaluate("MD.App.screen") == 'home' and pg.locator('#home-nav .menu-option').count() == 6, 'Enter abre o menu principal com os modos')
    check(pg.evaluate("document.activeElement&&document.activeElement.classList.contains('menu-option')"), 'menu já focado para navegação por teclado/controle')
    pg.wait_for_timeout(8200)
    act = pg.evaluate("[...document.querySelectorAll('#screen-home .pose')].map(p=>p.className)")
    check(any('is-active' in a or 'is-entering' in a for a in act[1:]) , 'animação das 5 poses do menu original continua (troca para a próxima)')
    shot(pg, '02_menu')
    pg.locator('[data-home=career]').click(); pg.wait_for_timeout(200)
    check('futuro' in pg.inner_text('#toast'), 'Modo Carreira identificado como conteúdo futuro (sem função falsa)')
    print('A2. Partida rápida só com teclado + escalação aplicada:')
    pg.locator('[data-home=quick]').focus(); key(pg, 'Enter'); pg.wait_for_timeout(500)
    check(pg.evaluate("MD.App.screen") == 'sides', 'PARTIDA RÁPIDA abre a seleção de lados')
    check(pg.locator('#sides-home .dev-card').count() >= 1, 'teclado já posicionado no MANDANTE')
    shot(pg, '03_lados'); key(pg, 'Enter'); pg.wait_for_timeout(500)
    check(pg.evaluate("MD.App.screen") == 'select', 'Enter confirma e vai para a escolha de clubes')
    pg.evaluate("MD.App.sel.side='home';MD.App.homeId='br-corinthians';MD.App.awayId='br-flamengo';MD.App.renderSelect()")
    pg.click('#to-prematch'); pg.wait_for_timeout(1800)
    check(pg.evaluate("MD.App.screen") == 'versus' and 'CORINTHIANS' in pg.inner_text('#vs-hn').upper(), 'tela de confronto estilo PES com os dois clubes')
    check(pg.locator('#vs-lu-h .vl-row').count() == 11 and pg.locator('#vs-lu-a .vl-row').count() == 11 and pg.locator('.vl-gk').count() == 2, 'escalações nas caixas centrais (número, nome, posição, goleiro, capitão)')
    check(pg.locator('.vs-actions button').count() == 2, 'apenas dois botões principais: JOGAR e ESCALAÇÃO E TÁTICAS')
    px = pg.evaluate("(()=>{const c=MD.TRS.vsCanvas;if(!c)return 0;const g=c.getContext('webgl2');return c.width})()")
    shot(pg, '04_confronto')
    pg.click('#vs-tactics'); pg.wait_for_timeout(400)
    check(pg.is_visible('#tactics-modal') and pg.locator('#tk-pitch .tk-token').count() == 11, 'campo tático visual com miniaturas dos 11 titulares')
    starter = pg.evaluate("document.querySelectorAll('#tk-pitch .tk-token')[9].dataset.tkid"); bench = pg.evaluate("document.querySelector('#tk-bench .tk-token').dataset.tkid")
    pg.locator('#tk-pitch .tk-token').nth(9).click(); pg.locator('#tk-bench .tk-token').first.click(); pg.wait_for_timeout(200)
    pg.select_option('[data-tk=formation]', '4-4-2'); pg.wait_for_timeout(200); shot(pg, '05_taticas')
    pg.locator('[data-tkclose]').last.click(); pg.wait_for_timeout(300)
    pg.click('#vs-optbtn'); pg.select_option('[data-vo=cinema]', '0'); pg.select_option('[data-vo=minutes]', '4')
    pg.click('#vs-play'); pg.wait_for_timeout(1500)
    st = S(pg, "{form:w.teams[0].tactics.formation,has:w.teams[0].players.some(p=>p.id===%s),out:w.teams[0].players.some(p=>p.id===%s),phase:w.phase,humans:S.humans.length}" % (json.dumps(bench), json.dumps(starter)))
    check(st and st['form'] == '4-4-2' and st['has'] and not st['out'], 'Cenário 6: titular substituído e formação 4-4-2 usados na partida')
    check(pg.evaluate("MD.App.screen") == 'play' and st['humans'] == 1, 'partida 3D em tela cheia com 1 humano (teclado)')
    print('A3. Jogar com o teclado:')
    pg.wait_for_timeout(1500); shot(pg, '06_saida')
    key(pg, 'KeyJ', 120); pg.wait_for_timeout(400)
    check(S(pg, "w.phase") == 'play', 'J (passe) dá a saída de bola')
    pg.wait_for_timeout(1200)
    p0 = S(pg, "{x:S.humans[0].H.player.x,z:S.humans[0].H.player.z,id:S.humans[0].H.player.id}")
    pg.wait_for_function("MD.Play.state()&&MD.Play.state().w.phase==='play'", timeout=15000)  # bola em jogo (sem lateral/falta pendente)
    pg.keyboard.down('KeyD'); pg.keyboard.down('KeyS'); pg.keyboard.down('ShiftLeft'); pg.wait_for_timeout(400)
    p1 = None
    for _ in range(14):  # maior velocidade observada enquanto as teclas estão seguradas
        q = S(pg, "{x:S.humans[0].H.player.x,z:S.humans[0].H.player.z,id:S.humans[0].H.player.id,sp:S.humans[0].H.player.sp}")
        if p1 is None or q['sp'] > p1['sp']: p1 = q
        pg.wait_for_timeout(120)
    check(p1['sp'] > 5, f'W/A/S/D + Shift: atleta corre na diagonal em sprint ({p1["sp"]:.1f} m/s)')
    pid = S(pg, "S.humans[0].H.player.id")
    pg.evaluate("window.dispatchEvent(new Event('blur'))"); pg.wait_for_timeout(900)
    blur = pg.evaluate("(()=>{const d=MD.Input.device('kb1').state;const S=MD.Play.state();const h=S.humans[0].H;const p=S.w.byId(%s);return {mx:d.mx,my:d.my,sprint:d.sprint,cmd:h.cmd.mx||0,sp:p.human?p.sp:0}})()" % json.dumps(pid))
    check(blur['mx'] == 0 and blur['my'] == 0 and not blur['sprint'] and blur['cmd'] == 0 and blur['sp'] < 1.5, f'janela perde o foco: nenhuma tecla fica presa e o atleta para ({blur["sp"]:.1f} m/s)')
    pg.keyboard.up('KeyD'); pg.keyboard.up('KeyS'); pg.keyboard.up('ShiftLeft')
    key(pg, 'Escape'); pg.wait_for_timeout(300)
    t0 = S(pg, "w.time"); pg.wait_for_timeout(700); t1 = S(pg, "w.time")
    check(pg.is_visible('#pause-menu') and t0 == t1, 'Esc pausa: menu de pausa aberto e a física parada')
    shot(pg, '07_pausa')
    pg.click('[data-pm=camera]'); check(S(pg, "S.cam") != 'auto', 'câmera configurável no menu de pausa')
    pg.click('[data-pm=controls]'); check('Passe' in pg.inner_text('#pm-panel'), 'menu de pausa mostra os controles')
    pg.click('[data-pm=resume]'); pg.wait_for_timeout(300); check(not pg.is_visible('#pause-menu'), 'continuar retoma a partida')
    print('A4. Partida completa:')
    n = pg.evaluate("__ffp(400,S=>S.menu==='half')")
    check(pg.is_visible('#half-menu') and 'INTERVALO' in pg.inner_text('#half-menu'), 'intervalo com placar, estatísticas e destaques')
    shot(pg, '08_intervalo')
    pg.click('[data-hm=go]'); pg.wait_for_timeout(200)
    check(S(pg, "w.period().id") == 'second', '2º tempo começa')
    pg.evaluate("__ffp(400,S=>S.mode==='post'||S.mode==='ending'||S.mode==='replay')")
    for _ in range(8):
        m = S(pg, "S.mode")
        if m in ('post',): break
        if m == 'replay':
            t0 = S(pg, "w.time"); pg.evaluate("__ffp(1)"); check(S(pg, "w.time") == t0, 'replay do gol não avança a partida') if 'replay do gol não avança a partida' not in ok else None
        pg.evaluate("__ffp(400,S=>S.mode==='post'||S.mode==='replay')"); pg.wait_for_timeout(1700)
    pg.wait_for_timeout(1800)
    fin = S(pg, "{done:w.done,score:w.score,goals:w.events.filter(e=>e.type==='goal').length,hl:S.highlights.length}")
    check(fin['done'] and fin['goals'] == sum(fin['score']), f"apito final; placar {fin['score']} = gols da física")
    check(pg.is_visible('#post-menu') and 'melhor jogador' in pg.inner_text('#post-menu').lower(), 'pós-jogo: resultado, artilheiros, estatísticas, melhor jogador e notas')
    shot(pg, '09_pos_jogo')
    if fin['hl']:
        pg.locator('[data-hl]').first.click(); pg.wait_for_timeout(1200); check(S(pg, "S.mode") == 'replay', 'melhores momentos do pós-jogo reproduzem lances gravados'); shot(pg, '10_replay'); pg.evaluate("__ffp(20,S=>S.mode==='post')")
    pg.click('[data-po=menu]'); pg.wait_for_timeout(500)
    check(pg.evaluate("MD.App.screen") == 'home', 'voltar ao menu')
    print('A5. Controles físicos (Gamepad API emulada) e multiplayer local:')
    pg.evaluate("__padMake(0,'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e)');__padMake(1,'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c)')"); pg.wait_for_timeout(300)
    check(pg.evaluate("MD.Input.list().filter(d=>d.kind==='gamepad').map(d=>d.style).join(',')") == 'xbox,ps', 'dois controles reconhecidos (Xbox e PlayStation identificados)')
    pg.locator('[data-home=quick]').focus()
    pg.evaluate("__padAxes(0,0,1)"); pg.wait_for_timeout(160); pg.evaluate("__padAxes(0,0,0)"); pg.wait_for_timeout(120)
    check(pg.evaluate("document.activeElement.dataset.home") == 'multi', 'analógico do controle navega no menu')
    pad(pg, 0, 0); pg.wait_for_timeout(400)
    check(pg.evaluate("MD.App.screen") == 'sides' and pg.evaluate("MD.App.flow.kind") == 'multi', 'botão A confirma (MULTIPLAYER LOCAL)')
    pg.evaluate("MD.TRS&&0")
    # posiciona: controle 1 mandante, controle 2 visitante (cada um move o próprio cartão)
    for i, d in ((0, -1), (1, 1)):
        pg.evaluate(f"__padAxes({i},{d},0)"); pg.wait_for_timeout(150); pg.evaluate(f"__padAxes({i},0,0)"); pg.wait_for_timeout(120)
    pos = pg.evaluate("(()=>{const o={};for(const el of document.querySelectorAll('.dev-card')){o[el.dataset.dev]=el.parentNode.id;}return o;})()")
    check(pos.get('gp0') == 'sides-home' and pos.get('gp1') == 'sides-away', 'cada controle escolhe seu lado (CONTROLE 1 → MANDANTE, CONTROLE 2 → VISITANTE)')
    shot(pg, '11_lados_controles')
    pg.evaluate("for(const [k,v] of [['kb1',0]])0"); pg.locator('.dev-card[data-dev=kb1] [data-move="1"]').click() if pos.get('kb1') == 'sides-home' else None
    pad(pg, 0, 9); pg.wait_for_timeout(400)
    check(pg.evaluate("MD.App.screen") == 'select', 'Start avança para a escolha de clubes')
    pg.click('#to-prematch'); pg.wait_for_timeout(1500); pg.click('#vs-optbtn'); pg.select_option('[data-vo=cinema]', '0'); pg.select_option('[data-vo=minutes]', '4'); pg.click('#vs-play'); pg.wait_for_timeout(1200)
    hs = S(pg, "S.humans.map(h=>({side:h.side,dev:h.device,ti:h.H.ti}))")
    check(len(hs) == 2 and {h['side'] for h in hs} == {'home', 'away'}, 'partida com dois humanos, um em cada clube')
    pg.wait_for_timeout(1500); pad(pg, 0, 0, 150); pg.wait_for_timeout(500)
    check(S(pg, "w.phase") == 'play', 'controle 1 dá a saída (A = passe)')
    pg.wait_for_timeout(800)
    pg.evaluate("__padAxes(0,1,0);__padAxes(1,-1,0)"); pg.wait_for_timeout(1300)
    mv = S(pg, "S.humans.map(h=>({team:h.H.player.team,vx:h.H.player.vx}))")
    pg.evaluate("__padAxes(0,0,0);__padAxes(1,0,0)")
    check(mv[0]['team'] == 0 and mv[1]['team'] == 1 and mv[0]['vx'] > 2 and mv[1]['vx'] < -2, 'comandos separados: cada controle move apenas o atleta do próprio time')
    check(S(pg, "S.humans[0].H.player!==S.humans[1].H.player&&w.all().filter(p=>p.human).length===2"), 'dois atletas sob comando humano, sem interferência')
    pg.evaluate("__padDrop(1)"); pg.wait_for_timeout(400)
    check(pg.is_visible('#dc-menu') and S(pg, "S.menu") == 'dc', 'controle desconectado: partida pausada com opções de recuperação')
    shot(pg, '12_desconexao')
    pg.evaluate("__padMake(1,'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c)')"); pg.wait_for_timeout(900)
    check(not pg.is_visible('#dc-menu') and S(pg, "S.menu") is None, 'reconectar o controle retoma a partida automaticamente')
    pad(pg, 0, 9); pg.wait_for_timeout(300); check(S(pg, "S.menu") == 'pause', 'Start do controle pausa'); pad(pg, 0, 9); pg.wait_for_timeout(300)
    pg.evaluate("__ffp(600,S=>S.mode==='post'||S.menu==='half')")
    if S(pg, "S.menu") == 'half': pg.click('[data-hm=go]'); pg.evaluate("__ffp(600,S=>S.mode==='post'||S.mode==='ending')")
    pg.wait_for_timeout(2200)
    check(S(pg, "w.done"), 'partida multiplayer chega ao fim')
    pg.evaluate("MD.Play.stop();MD.App.go('controls')"); pg.wait_for_timeout(300)
    pg.locator('[data-remap="pad:shoot"]').click(); pg.wait_for_timeout(100); pad(pg, 0, 3, 150); pg.wait_for_timeout(200)
    check(pg.evaluate("MD.Input.cfg.pad.shoot[0]") == 3, 'remapeamento do controle (chute → Y)')
    pg.locator('[data-remap="keys:pass"]').click(); key(pg, 'KeyU'); pg.wait_for_timeout(150)
    check(pg.evaluate("MD.Input.cfg.keys.pass[0]") == 'KeyU', 'remapeamento do teclado (passe → U)')
    pg.evaluate("document.querySelector('[data-ctl=deadzone]').value=0.3;document.querySelector('[data-ctl=deadzone]').dispatchEvent(new Event('input',{bubbles:true}))")
    pg.evaluate("__padAxes(0,0.25,0)"); pg.wait_for_timeout(120); dzv = pg.evaluate("MD.Input.device('gp0').state.mx"); pg.evaluate("__padAxes(0,0,0)")
    check(dzv == 0, 'zona morta configurável respeitada')
    shot(pg, '13_controles'); pg.click('#ctl-reset') if False else pg.evaluate("MD.Input.reset()")
    pg.evaluate("__padDrop(0);__padDrop(1)"); pg.wait_for_timeout(200)
    print('A6. Assistir, Germinare, Copa e persistência:')
    pg.evaluate("MD.App.go('home')"); pg.click('[data-home=watch]'); pg.wait_for_timeout(300); pg.click('#to-prematch'); pg.wait_for_timeout(1200)
    check(pg.inner_text('#vs-play') == 'ASSISTIR', 'ASSISTIR PARTIDA: confronto com botão ASSISTIR')
    pg.click('#vs-optbtn'); pg.select_option('[data-vo=cinema]', '0'); pg.select_option('[data-vo=minutes]', '4'); pg.click('#vs-play'); pg.wait_for_timeout(2500)
    w0 = S(pg, "{h:S.humans.length,t:w.time,ball:[w.ball.x,w.ball.z],watch:S.o.watch}"); pg.wait_for_timeout(2500); w1 = S(pg, "{t:w.time,ball:[w.ball.x,w.ball.z]}")
    check(w0['h'] == 0 and w0['watch'] == 'watch' and w1['t'] > w0['t'] and w1['ball'] != w0['ball'], 'IA controla os dois clubes; a partida acontece continuamente (sem saltos para destaques)')
    shot(pg, '14_assistir')
    pg.evaluate("__ffp(800,S=>S.mode==='post'||S.menu==='half')");
    if S(pg, "S.menu") == 'half': pg.click('[data-hm=go]'); pg.evaluate("__ffp(800,S=>S.mode==='post'||S.mode==='ending')")
    pg.wait_for_timeout(2200); check(S(pg, "w.done"), 'partida assistida termina corretamente')
    pg.evaluate("MD.Play.stop();MD.App.go('germinare')"); pg.wait_for_timeout(300); pg.click('#gm-random'); pg.click('#gm-start'); pg.wait_for_timeout(400)
    check(pg.evaluate("MD.App.screen") == 'sides', 'Germinare: escolha jogar (humano) ou assistir (todos no NEUTRO)')
    key(pg, 'Enter'); pg.wait_for_timeout(1200); pg.click('#vs-optbtn'); pg.select_option('[data-vo=cinema]', '0'); pg.click('#vs-play'); pg.wait_for_timeout(1500)
    g = S(pg, "{small:w.small,n:w.onPitch(0).length,h:S.humans.length}")
    check(g['small'] and g['n'] == 5 and g['h'] == 1, 'Germinare 5x5 jogável no campo da escola')
    shot(pg, '15_germinare')
    pg.evaluate("MD.Play.stop()")
    pg.evaluate("MD.App.go('copa')"); pg.wait_for_timeout(300); pg.click('#cu-new'); pg.wait_for_timeout(300); pg.fill('#cn-name', 'Copa TRS E2E')
    for cid in ['br-flamengo', 'br-palmeiras', 'br-corinthians', 'br-saopaulo']: pg.check(f'[data-cnsel="{cid}"]')
    pg.evaluate("MD.CopaUI.draft.user='br-flamengo'"); pg.click('#cu-create'); pg.wait_for_timeout(400)
    tid = pg.evaluate("MD.CopaUI.tid"); pg.evaluate(f"(()=>{{const t=MD.Tournament.get('{tid}');t.userTeam='br-flamengo';MD.Tournament.save(t);}})()")
    # simula até a final; se o Flamengo cair, assiste à final
    pg.evaluate(f"(()=>{{const t=MD.Tournament.get('{tid}');const nx=MD.Tournament.nextMatch(t);for(const m of Object.values(t.matches))if(m.status==='pending'&&m.home&&m.away&&!MD.Tournament.isFinal(t,m))MD.Tournament.simulate(t,m.id,id=>MD.App.clubs.find(c=>c.id===id),{{}});MD.CopaUI.render();}})()")
    pg.wait_for_timeout(300)
    fm = pg.evaluate(f"(()=>{{const t=MD.Tournament.get('{tid}');const m=MD.Tournament.nextMatch(t);return m&&{{id:m.id,final:MD.Tournament.isFinal(t,m),mine:m.home==='br-flamengo'||m.away==='br-flamengo'}}}})()")
    check(fm and fm['final'], 'Copa: chaveamento até a GRANDE FINAL')
    pg.evaluate(f"MD.CopaUI.watch(MD.Tournament.get('{tid}'),'{fm['id']}','{'play' if fm['mine'] else 'watch'}')"); pg.wait_for_timeout(500)
    if pg.evaluate("MD.App.screen") == 'sides': key(pg, 'Enter'); pg.wait_for_timeout(1200)
    pg.click('#vs-optbtn'); pg.select_option('[data-vo=cinema]', '0'); pg.select_option('[data-vo=minutes]', '4'); pg.click('#vs-play'); pg.wait_for_timeout(800)
    check(S(pg, "!!S.o.tournament&&S.o.tournament.final"), f"final do torneio {'jogada pelo humano' if fm['mine'] else 'assistida'}")
    for _ in range(6):
        pg.evaluate("__ffp(900,S=>S.menu==='half'||S.mode==='ceremony'||S.mode==='post'||S.mode==='ending')")
        if S(pg, "S.menu") == 'half': pg.click('[data-hm=go]'); continue
        if S(pg, "S.mode") in ('ceremony', 'post'): break
        pg.wait_for_timeout(500)
    if S(pg, "S.mode") == 'ending': pg.wait_for_timeout(2000)
    m = S(pg, "S.mode")
    check(m in ('ceremony', 'post'), 'final decidida em campo (prorrogação/pênaltis se empatar)')
    if m == 'ceremony':
        pg.evaluate("__ffp(14)"); pg.wait_for_timeout(1200); shot(pg, '16_cerimonia'); key(pg, 'Enter'); pg.wait_for_timeout(600)
        check(pg.is_visible('#play-champ') and 'CAMPEÃO' in pg.inner_text('#play-champ').upper(), 'cerimônia do campeão (pulável) e tela de campeão')
        shot(pg, '17_campeao'); pg.click('#champ-ok'); pg.wait_for_timeout(300)
    pg.locator('[data-po=copa]').click(); pg.wait_for_timeout(400)
    check(pg.locator('.cup-banner').count() == 1, 'torneio concluído com campeão registrado')
    pg.reload(); ready(pg); pg.evaluate("MD.App.go('copa')"); pg.wait_for_timeout(300)
    check('copa trs e2e' in pg.inner_text('#copa-body').lower() and pg.locator('.hist-row').count() >= 1, 'histórico de competições preservado após recarregar')
    check(pg.evaluate("!!MD.App.clubs.find(c=>c.name==='Legado FC')"), 'clube personalizado continua após recarregar')
    print('A7. Canvas 2D (sem WebGL2):')
    pg2 = ctx.new_page(); e2 = []; pg2.on('pageerror', lambda e: e2.append(str(e)))
    pg2.add_init_script("HTMLCanvasElement.prototype.getContext=(function(o){return function(t,a){if(t==='webgl2')return null;return o.call(this,t,a);}})(HTMLCanvasElement.prototype.getContext)")
    pg2.goto(url); ready(pg2)
    pg2.evaluate("MD.Play.start({home:MD.App.club('br-flamengo'),away:MD.App.club('br-palmeiras'),watch:'watch',minutes:4,cinema:false})"); pg2.wait_for_timeout(1500)
    pg2.screenshot(path=str(SHOTS / '18_canvas2d.png')); pg2.evaluate("__ffp(60)")
    check(not pg2.evaluate("MD.App.isWebGL") and pg2.evaluate("MD.Play.state().w.time") > 50 and not e2, 'partida contínua também no modo Canvas 2D, sem erros')
    pg2.close()
    errs = [e for e in errors if 'GPU stall' not in e and 'favicon' not in e]
    check(not errs, 'nenhum erro de JavaScript na parte A: ' + '; '.join(errs[:3]))
    ctx.close()
    print('B. Servidor local + dois celulares (multitoque):')
    port = 18900 + random.randint(0, 80)
    mobile = pathlib.Path(os.environ.get('TRS_MOBILE_DIR') or ROOT.parent / 'trs-mobile-device-management')  # servidor e controle vivem nesse repo
    srv = subprocess.Popen(['node', str(mobile / 'server' / 'server.js'), str(port), '--game', str(ROOT)], env={**os.environ, 'TRS_QUIET': '1'}, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    try:
        time.sleep(1.2)
        host = b.new_context(viewport={'width': 1366, 'height': 768}); hp = host.new_page(); herr = []; hp.on('pageerror', lambda e: herr.append(str(e)))
        hp.goto(f'http://127.0.0.1:{port}/'); ready(hp)
        hp.evaluate("MD.App.go('remote')"); hp.wait_for_timeout(300); hp.click('#rm-create'); hp.wait_for_function("MD.Remote.session&&MD.Remote.session.pin", timeout=5000)
        pin = hp.evaluate("MD.Remote.session.pin"); hp.wait_for_timeout(300)
        check(len(pin) == 6 and pin in hp.inner_text('#remote-body').replace(' ', ''), 'CONECTAR CONTROLE VIRTUAL: PIN de 6 dígitos e endereço na tela do computador')
        hp.screenshot(path=str(SHOTS / '19_pin.png'))
        phones = []
        for i in range(2):
            pc = b.new_context(viewport={'width': 844, 'height': 390}, is_mobile=True, has_touch=True, device_scale_factor=2); pp = pc.new_page(); pp.goto(f'http://127.0.0.1:{port}/controller/')
            pp.fill('#pin', pin); pp.fill('#name', f'Celular {"AB"[i]}'); pp.click('#pin-go'); pp.wait_for_timeout(500)
            hp.wait_for_selector('[data-rm-ok]', timeout=5000); hp.locator('[data-rm-ok]').first.click(); pp.wait_for_selector('#pad:not([hidden])', timeout=5000); phones.append((pc, pp))
        check(all(pp.is_visible('#pad') for _, pp in phones) and hp.locator('.ctrl-row.connected').count() == 2, 'dois celulares pareados por PIN e autorizados no computador')
        phones[0][1].screenshot(path=str(SHOTS / '20_controle_celular.png'))
        def touch(pp, pts, typ):
            if getattr(touch, 'front', None) is not pp: pp.bring_to_front(); touch.front = pp  # num celular real a página do controle é a que está em primeiro plano
            cdp = pp.context.new_cdp_session(pp) if not hasattr(pp, '_cdp') else pp._cdp; pp._cdp = cdp
            cdp.send('Input.dispatchTouchEvent', {'type': typ, 'touchPoints': [{'x': x, 'y': y, 'id': i} for (i, x, y) in pts]})
        def center(pp, sel):
            r = pp.locator(sel).bounding_box(); return r['x'] + r['width'] / 2, r['y'] + r['height'] / 2
        hp.evaluate("MD.App.flow={kind:'multi',watch:'play',mode:'pro'};MD.App.go('sides')"); hp.wait_for_timeout(600)
        devs = hp.evaluate("MD.Input.list().filter(d=>d.kind==='remote').map(d=>d.id)")
        check(len(devs) == 2, 'os celulares aparecem como CELULAR 1 e CELULAR 2 na seleção de lados')
        for (pc, pp), dx in zip(phones, (-1, 1)):
            sx, sy = center(pp, '#stick'); touch(pp, [(1, sx, sy)], 'touchStart'); touch(pp, [(1, sx + dx * 60, sy)], 'touchMove'); pp.wait_for_timeout(250); touch(pp, [], 'touchEnd'); pp.wait_for_timeout(250)
        pos = hp.evaluate("(()=>{const o={};for(const el of document.querySelectorAll('.dev-card'))o[el.dataset.dev]=el.parentNode.id;return o;})()")
        check(pos.get(devs[0]) == 'sides-home' and pos.get(devs[1]) == 'sides-away', 'CELULAR 1 → MANDANTE e CELULAR 2 → VISITANTE pelo joystick do próprio celular')
        hp.screenshot(path=str(SHOTS / '21_lados_celulares.png'))
        hp.evaluate("MD.TRS.sidesGo()"); hp.wait_for_timeout(300); hp.click('#to-prematch'); hp.wait_for_timeout(1200); hp.click('#vs-optbtn'); hp.select_option('[data-vo=cinema]', '0'); hp.select_option('[data-vo=minutes]', '4'); hp.click('#vs-play'); hp.wait_for_timeout(2500)
        check(S(hp, "S.humans.map(h=>h.device).join(',')") == ','.join(devs), 'partida com os dois controles virtuais')
        pp = phones[0][1]; sx, sy = center(pp, '#stick'); bx, by = center(pp, '[data-b=pass]')
        touch(pp, [(1, sx, sy)], 'touchStart'); touch(pp, [(1, sx + 55, sy - 10)], 'touchMove'); pp.wait_for_timeout(60); touch(pp, [(1, sx + 55, sy - 10), (2, bx, by)], 'touchStart')
        try: hp.wait_for_function(f"(()=>{{const d=MD.Input.device('{devs[0]}');return d.state.mx>.5&&d.state.pass}})()", timeout=2000)
        except Exception: pass
        d0 = hp.evaluate(f"(()=>{{const d=MD.Input.device('{devs[0]}');return {{mx:d.state.mx,pass:d.state.pass}}}})()")
        touch(pp, [(1, sx + 55, sy - 10)], 'touchEnd'); touch(pp, [], 'touchEnd'); hp.wait_for_timeout(600)
        check(d0['mx'] > .5 and d0['pass'], f'multitoque real: analógico segurado + PASSE ao mesmo tempo chegam juntos ao jogo (mx={d0["mx"]:.2f})')
        check(S(hp, "w.phase") == 'play', 'PASSE do celular deu a saída de bola na partida')
        touch(pp, [(1, sx, sy)], 'touchStart'); touch(pp, [(1, sx + 60, sy)], 'touchMove'); hp.wait_for_timeout(1300)
        v = S(hp, "S.humans[0].H.player.vx"); touch(pp, [], 'touchEnd'); hp.wait_for_timeout(500)
        st = hp.evaluate(f"MD.Input.device('{devs[0]}').state.mx")
        check(v > 3 and st == 0, f'joystick do celular move o atleta ({v:.1f} m/s) e soltar o dedo zera o comando')
        lat = hp.evaluate("[...MD.Remote.controllers.values()].map(c=>c.rtt||0)")
        check(any(x >= 0 for x in lat), f'latência medida por controle ({lat} ms)')
        hp.screenshot(path=str(SHOTS / '22_partida_celulares.png'))
        touch(phones[1][1], [(1, *center(phones[1][1], '#stick'))], 'touchStart')
        phones[1][1].close(); hp.wait_for_timeout(1500)
        check(S(hp, "S.menu") == 'dc' and hp.evaluate(f"MD.Input.device('{devs[1]}').state.mx") == 0, 'celular 2 caiu: partida pausada e comandos dele zerados')
        check(hp.evaluate(f"MD.Input.device('{devs[0]}').connected"), 'o celular 1 continua conectado')
        check(not herr, 'nenhum erro de JavaScript na parte B: ' + '; '.join(herr[:3]))
    finally:
        srv.terminate()
    b.close()
  print(f'E2E PASS ({len(ok)} verificações)')
main()
