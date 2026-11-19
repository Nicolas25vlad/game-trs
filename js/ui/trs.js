/* TRS26 / MATCHDAY 0.6 — TELAS DE VIDEOGAME: capa, menu principal (animação das 5 poses preservada e mais suave),
   fluxo de modos, seleção de lados por dispositivo, confronto estilo PES com dois atletas 3D, controles e celular. */
(function(MD){
'use strict';
const U=MD.U,D=MD.Data,App=MD.App,IN=MD.Input,CAT=MD.Catalog,$=id=>document.getElementById(id),esc=U.escape;
const T=MD.TRS={};
/* ---------- histórico de navegação (voltar com Esc / B) ---------- */
App.navStack=[];
const baseGo=App.go;
App.go=function(name,opts){const prev=App.screen;if(prev&&prev!==name&&!(opts&&opts.noPush)&&prev!=='play'&&prev!=='cover')App.navStack.push(prev);if(App.navStack.length>20)App.navStack.shift();
 if(prev==='versus'&&name!=='versus')T.vsStop();if(prev==='home'&&name!=='home')T.posesStop();
 baseGo(name);document.body.classList.toggle('trs-full',['cover','home','versus','play'].includes(name));
 IN.gameActive=name==='play'&&MD.Play.active()&&!MD.Play.state().menu||name==='sides';
 if(name==='home')T.renderHome();if(name==='sides'){SD.enterT=performance.now();T.renderSides();}if(name==='versus'){$('vs-optpanel').hidden=true;T.renderVersus();}if(name==='controls')T.renderControls();if(name==='remote')T.renderRemote();
 setTimeout(()=>{const sc=document.querySelector('.screen.active');if(!sc)return;const f=sc.querySelector('[data-autofocus]')||sc.querySelector('.menu-option,.vs-btn,.cover-button,button.primary');if(f&&!sc.contains(document.activeElement))f.focus({preventScroll:true});},60);};
App.back=function(){const open=[...document.querySelectorAll('.modal:not([hidden])')].pop();if(open){if(open.id==='tactics-modal')MD.TacticsUI.close();else App.closeModal(open.id);MD.Audio.ui('back');return;}
 if(App.screen==='play'){if(MD.Play.state()&&!MD.Play.state().menu)MD.Play.pause(true);return;}
 if(App.screen==='home'||App.screen==='cover')return;let prev=App.navStack.pop();while(prev==='play'||prev===App.screen)prev=App.navStack.pop();MD.Audio.ui('back');baseGoNoPush(prev||'home');};
function baseGoNoPush(n){App.go(n,{noPush:true});}
/* ---------- capa ---------- */
T.openMenu=function(){const c=$('screen-cover');c.classList.add('leaving');MD.Audio.resume();MD.Audio.ui('confirm');setTimeout(()=>{c.classList.remove('leaving');App.go('home');},420);};
/* ---------- menu principal ---------- */
const MAIN=[['quick','PARTIDA RÁPIDA','Escolha os clubes e jogue'],['multi','MULTIPLAYER LOCAL','Dois jogadores na mesma tela'],['watch','ASSISTIR PARTIDA','A IA controla os dois clubes'],['copa','MODO COPA','Torneios eliminatórios'],['germinare','GERMINARE','Partidas escolares 5x5'],['custom','PERSONALIZAÇÃO','Clubes, jogadores e uniformes']];
const MORE=[['career','MODO CARREIRA','EM BREVE'],['story','MODO HISTÓRIA','EM BREVE'],['remote','CONTROLE VIRTUAL','Celular como controle'],['controls','CONTROLES','Teclado e controles'],['settings','CONFIGURAÇÕES','Imagem e som'],['credits','CRÉDITOS','']];
T.sub=null;
T.renderHome=function(){const nav=$('home-nav');const sub=T.sub;
 if(sub==='custom'){nav.innerHTML=`<div class="menu-sub-title">PERSONALIZAÇÃO</div>`+[['clubs','CLUBES E JOGADORES'],['kits','ESTÚDIO DE UNIFORMES'],['back','← VOLTAR']].map((o,i)=>`<button class="menu-option" data-home="${o[0]}"><span class="option-number">${String(i+1).padStart(2,'0')}</span><span>${o[1]}</span></button>`).join('');}
 else nav.innerHTML=MAIN.map((o,i)=>`<button class="menu-option" data-home="${o[0]}"><span class="option-number">${String(i+1).padStart(2,'0')}</span><span class="mo-t">${o[1]}<small>${o[2]}</small></span></button>`).join('')+
  `<div class="menu-more">${MORE.map(o=>`<button class="menu-mini ${o[2]==='EM BREVE'?'soon':''}" data-home="${o[0]}">${o[1]}${o[2]==='EM BREVE'?'<em>EM BREVE</em>':''}</button>`).join('')}</div>`;
 T.renderDevices();T.posesStart();setTimeout(()=>{const f=nav.querySelector('.menu-option');if(f)f.focus();},40);};
T.renderDevices=function(){const el=$('home-devices');if(!el)return;el.innerHTML=IN.list().filter(d=>!d.secondary).map(d=>`<span class="dev-chip">${d.icon||''} ${esc(d.short)}</span>`).join('');};
T.home=function(k){MD.Audio.ui('confirm');
 if(k==='back'){T.sub=null;T.renderHome();return;}if(k==='custom'){T.sub='custom';T.renderHome();return;}
 if(k==='quick'){App.flow={kind:'quick',watch:'play',mode:'pro'};App.go('sides');return;}
 if(k==='multi'){App.flow={kind:'multi',watch:'play',mode:'pro'};App.go('sides');return;}
 if(k==='watch'){App.flow={kind:'watch',watch:'watch',mode:'pro',humans:[]};App.sel.side='home';App.go('select');return;}
 if(k==='copa'){App.go('copa');return;}if(k==='germinare'){App.go('germinare');return;}
 if(k==='clubs'){App.go('clubs');return;}if(k==='kits'){MD.KitStudio.open(App.homeId);return;}
 if(k==='remote'){App.go('remote');return;}if(k==='controls'){App.go('controls');return;}if(k==='settings'){App.go('settings');return;}
 if(k==='credits'){App.openModal?App.openModal('credits-modal'):($('credits-modal').hidden=false);setTimeout(()=>$('credits-modal').querySelector('button').focus(),40);return;}
 if(k==='career'||k==='story'){App.toast((k==='career'?'Modo Carreira':'Modo História')+': conteúdo futuro — ainda não implementado nesta versão.');MD.Audio.ui('error');}};
/* animação das poses: mesma sequência do site original (entrar → deslizar → sair), com troca cruzada mais suave */
let poseI=0,poseTimer=null,posesOn=false;
T.posesStart=function(){if(posesOn)return;posesOn=true;const poses=[...document.querySelectorAll('#screen-home .pose')];poses.forEach(p=>p.classList.remove('is-entering','is-active','is-leaving'));poseI=0;
 const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;const show=i=>{poses[i].classList.remove('is-leaving','is-active');void poses[i].offsetWidth;poses[i].classList.add('is-entering');};
 show(0);const cycle=()=>{if(!posesOn)return;const cur=poses[poseI];cur.classList.remove('is-entering','is-active');cur.classList.add('is-leaving');poseI=(poseI+1)%poses.length;show(poseI);poseTimer=setTimeout(cycle,reduce?9000:7400);};
 poses.forEach(p=>{p.onanimationend=e=>{if(e.animationName==='poseEnter'&&p.classList.contains('is-entering')){p.classList.replace('is-entering','is-active');}if(e.animationName==='poseExit')p.classList.remove('is-leaving');};});
 poseTimer=setTimeout(cycle,7400);};
T.posesStop=function(){posesOn=false;clearTimeout(poseTimer);};
/* ---------- seleção de lados ---------- */
const SD={pos:new Map(),ready:new Set()};
T.renderSides=function(){const f=App.flow||(App.flow={kind:'quick',watch:'play',mode:'pro'});if(SD.flow!==f){SD.flow=f;SD.pos.clear();SD.ready.clear();}if(App.screen!=='sides'||!SD.enterT||SD.lastScreen!==App.screen){}$('sides-kicker').textContent=f.kind==='multi'?'MULTIPLAYER LOCAL':f.kind==='copa'?'MODO COPA':f.kind==='germinare'?'GERMINARE':'PARTIDA RÁPIDA';
 const devs=IN.list();for(const d of devs)if(!SD.pos.has(d.id))SD.pos.set(d.id,0);
 if(f.kind!=='multi'&&!devs.some(d=>SD.pos.get(d.id)!==0)){const first=devs.find(d=>d.kind==='gamepad')||IN.device('kb1');if(first)SD.pos.set(first.id,f.lockSide==='away'?1:-1);}
 if(f.kind==='multi'&&![...SD.pos.values()].some(v=>v)){const pads=[...devs.filter(d=>d.kind!=='keyboard'),...devs.filter(d=>d.kind==='keyboard')];if(pads[0])SD.pos.set(pads[0].id,-1);if(pads[1])SD.pos.set(pads[1].id,1);}
 const col=v=>v<0?'sides-home':v>0?'sides-away':'sides-none';for(const id of ['sides-home','sides-none','sides-away'])$(id).innerHTML='';
 let n=0;for(const d of devs){const v=SD.pos.get(d.id)||0;const lbl=v?('P'+(++n)):'';const el=document.createElement('div');el.className='dev-card'+(SD.ready.has(d.id)?' ready':'')+(v?' human':'');el.dataset.dev=d.id;
  el.innerHTML=`<button class="dc-arrow" data-move="-1" aria-label="Mover para a esquerda">◀</button><div class="dc-body"><span class="dc-icon">${d.icon||'🎮'}</span><b>${esc(d.label)}</b><small>${v?(v<0?'MANDANTE':'VISITANTE'):'NEUTRO'}${d.kind==='gamepad'?' · '+(d.style==='ps'?'PlayStation':d.style==='xbox'?'Xbox':'genérico'):''}</small>${lbl?`<em>${lbl}</em>`:''}</div><button class="dc-arrow" data-move="1" aria-label="Mover para a direita">▶</button>`;$(col(v)).appendChild(el);}
 const hs=devs.filter(d=>SD.pos.get(d.id)<0).length,as=devs.filter(d=>SD.pos.get(d.id)>0).length;
 $('sides-msg').textContent=`Mandante: ${hs?hs+' humano(s)'+(hs>1?' — cooperativo':''):'IA'} · Visitante: ${as?as+' humano(s)'+(as>1?' — cooperativo':''):'IA'}${f.kind==='multi'&&hs+as<2?' · Multiplayer precisa de 2 dispositivos (conecte um controle ou celular, ou use o TECLADO 2 com as setas).':''}`;};
T.sidesFrame=function(){if(App.screen!=='sides')return;if(performance.now()-(SD.enterT||0)<300)return;/* ignora a tecla que abriu a tela */let dirty=false;
 for(const d of IN.list()){const s=d.state,p=d.prev;let mv=0;
  if(d.kind==='keyboard'){mv=(s.mx>.5&&!(p.mx>.5))?1:(s.mx<-.5&&!(p.mx<-.5))?-1:0;}else{mv=(s.mx>.6&&p.mx<=.6)?1:(s.mx<-.6&&p.mx>=-.6)?-1:0;}
  if(mv){const v=Math.max(-1,Math.min(1,(SD.pos.get(d.id)||0)+mv));SD.pos.set(d.id,v);SD.ready.delete(d.id);dirty=true;MD.Audio.ui('move');}
  if(d.kind==='keyboard'){if(!d.secondary&&IN.pressed(d,'confirm')){T.sidesGo();return;}if(!d.secondary&&IN.pressed(d,'back')){App.back();return;}
   if(IN.pressed(d,'pass')&&SD.pos.get(d.id)){SD.ready.has(d.id)?SD.ready.delete(d.id):SD.ready.add(d.id);dirty=true;MD.Audio.ui('confirm');}continue;}
  if(IN.pressed(d,'pass')&&SD.pos.get(d.id)){SD.ready.has(d.id)?SD.ready.delete(d.id):SD.ready.add(d.id);dirty=true;MD.Audio.ui('confirm');}
  if(IN.pressed(d,'pause')){T.sidesGo();return;}
  if(d.kind==='gamepad'&&IN.pressed(d,'back')){if(SD.ready.has(d.id)){SD.ready.delete(d.id);dirty=true;}else if(!SD.pos.get(d.id)){App.back();return;}else{SD.pos.set(d.id,0);dirty=true;}}}
 if(dirty)T.renderSides();};
T.sidesGo=function(){const f=App.flow||{kind:'quick'};const humans=[];for(const d of IN.list()){const v=SD.pos.get(d.id)||0;if(v)humans.push({device:d.id,side:v<0?'home':'away'});}
 if(f.kind==='multi'&&humans.length<2){App.toast('Multiplayer local: posicione pelo menos dois dispositivos.');MD.Audio.ui('error');return;}
 f.humans=humans;f.watch=humans.length?'play':'watch';MD.Audio.ui('confirm');
 if(f.kind==='copa'||f.kind==='germinare'){T.prepareVersus(f.home,f.away);App.go('versus');return;}
 App.go('select');};
/* ---------- confronto (estilo PES) ---------- */
const VS={};
T.prepareVersus=function(home,away){const st=App.settings;const f=App.flow||{};VS.h=U.deepClone(home);VS.a=U.deepClone(away);D.ensureClub&&(D.ensureClub(VS.h),D.ensureClub(VS.a));
 VS.kits={home:'auto',away:'auto'};VS.opts={minutes:f.mode==='germinare'?(st.germinare&&st.germinare.minutes)||5:st.matchMinutes||10,difficulty:st.difficulty||'pro',watch:f.watch||'play',cinema:st.cinema!==false};
 const pick=c=>{const on=c.players.slice(0,f.mode==='germinare'?5:11);return(on.find(p=>p.id===c.captain)||on.filter(p=>D.groupOf(p.position)!=='GK').sort((x,y)=>y.rating-x.rating)[0]||on[0]);};
 const clips=['arms_crossed','hands_hips','pose','hand_chest','idle_bounce','arm_over'];const sh=U.hashStr(VS.h.id+VS.a.id);VS.feat=[{p:pick(VS.h),clip:clips[sh%clips.length]},{p:pick(VS.a),clip:clips[(sh>>3)%clips.length===sh%clips.length?(sh+1)%clips.length:(sh>>3)%clips.length]}];};
T.renderVersus=function(){if(!VS.h)T.prepareVersus(App.club(App.homeId),App.club(App.awayId));const f=App.flow||{};const h=VS.h,a=VS.a;const g=f.mode==='germinare';
 $('vs-hc').src=App.crest(h);$('vs-ac').src=App.crest(a);$('vs-hn').textContent=h.name;$('vs-an').textContent=a.name;
 const ctl=side=>{const hs=(f.humans||[]).filter(x=>x.side===side);return hs.length?hs.map(x=>{const d=IN.device(x.device);return d?d.short:x.device;}).join(' + '):'IA';};$('vs-hctl').textContent=ctl('home');$('vs-actl').textContent=ctl('away');
 $('vs-comp').textContent=f.tournament?f.tournament.name+(f.tournament.round?' · '+f.tournament.round:''):g?'GERMINARE · 5x5':'PARTIDA AMISTOSA';
 const lu=(c,el,side)=>{const n=g?5:11;const slots=D.formationSlots(c.tactics&&c.tactics.formation||(g?'1-2-1':'4-3-3'));const cap=c.captain||(c.players.find(p=>p.personality==='leader')||{}).id;
  el.innerHTML=`<div class="vl-head"><img src="${App.crest(c)}" alt=""><b>${esc(c.short)}</b><span>${esc((c.tactics&&c.tactics.formation)||'')}</span><span class="vl-ovr">OVR ${D.teamOverall(c)}</span></div>`+c.players.slice(0,n).map((p,i)=>{const pos=i===0?'GOL':(slots[i]||{}).pos||p.position;return`<div class="vl-row"><span class="vl-num">${p.number}</span><span class="vl-name">${esc(p.name)}</span>${p.id===cap?'<i class="vl-c">C</i>':''}${pos==='GOL'?'<i class="vl-gk">GOL</i>':''}<span class="vl-pos pos-${App.posGroup(pos)}">${esc(App.posLabel(pos))}</span></div>`;}).join('');};
 lu(h,$('vs-lu-h'),'home');lu(a,$('vs-lu-a'),'away');
 $('vs-play').textContent=VS.opts.watch==='play'?'JOGAR':VS.opts.watch==='watch'?'ASSISTIR':'MELHORES MOMENTOS';
 const d=IN.list().find(x=>x.kind==='gamepad');$('vs-legend').innerHTML=d?`<span><kbd>${IN.glyph(d,'pass')}</kbd> Confirmar</span><span><kbd>${IN.GLYPH[IN.styleOf(d)][1]}</kbd> Voltar</span>`:'<span><kbd>Enter</kbd> Confirmar</span><span><kbd>Esc</kbd> Voltar</span><span><kbd>↑↓←→</kbd> Navegar</span>';
 T.vsOptions();T.vsStart();};
T.vsOptions=function(){const f=App.flow||{};const g=f.mode==='germinare';const o=VS.opts;const durs=g?[3,5,7,10]:MD.World.DURATIONS;const has=(f.humans||[]).length>0;
 $('vs-optpanel').innerHTML=`<div class="fgrid"><label>Duração (tempo real)<select data-vo="minutes">${durs.map(m=>`<option value="${m}" ${m==o.minutes?'selected':''}>${m} min</option>`).join('')}</select></label>
  <label>Dificuldade da IA<select data-vo="difficulty">${Object.entries(MD.World.DIFFICULTY).map(([k,v])=>`<option value="${k}" ${k===o.difficulty?'selected':''}>${v.label}</option>`).join('')}</select></label>
  <label>Modo<select data-vo="watch">${has?`<option value="play" ${o.watch==='play'?'selected':''}>Jogar (controlar)</option>`:''}<option value="watch" ${o.watch==='watch'?'selected':''}>Assistir partida completa</option><option value="highlights" ${o.watch==='highlights'?'selected':''}>Melhores momentos (acelera trechos sem perigo)</option></select></label>
  <label>Apresentação pré-jogo<select data-vo="cinema"><option value="1" ${o.cinema?'selected':''}>Ligada (pulável)</option><option value="0" ${!o.cinema?'selected':''}>Desligada</option></select></label></div><p class="hint">O relógio representa 90 minutos (Germinare: ${App.settings.germinare.minutes} min) proporcionais à duração escolhida; os atletas se movem em velocidade natural.</p>`;};
T.vsStart=function(){const st=$('vs-stage');if(!App.isWebGL){T.vsOn=false;return;}if(!T.vsCanvas){const c=document.createElement('canvas');c.className='vs-gl';T.vsCanvas=c;st.appendChild(c);try{T.vsR=new MD.Renderer3D(c,{studio:true,alpha:true});T.vsR.setQuality&&T.vsR.setQuality('high');}catch(e){console.warn(e);T.vsR=null;}}
 if(!T.vsR)return;const kits=MD.Kit.pickKitsChoice(VS.h,VS.a,VS.kits.home,VS.kits.away);T.vsR.descCache.clear();T.vsR.setTeams(VS.h,VS.a,kits);T.vsOn=true;};
T.vsFrame=function(dt){if(!T.vsOn||!T.vsR||App.screen!=='versus')return;const list=VS.feat.map((f,i)=>({ref:{id:'vs-'+f.p.id,side:i?'away':'home',kind:'player',info:{data:f.p},emos:[]},clip:f.clip,dur:3.4}));T.vsR.renderVersus(list,{dt});};
T.vsStop=function(){T.vsOn=false;};
T.vsPlay=function(){const f=App.flow||{};const o=VS.opts;MD.Audio.ui('confirm');App.settings.matchMinutes=f.mode==='germinare'?App.settings.matchMinutes:o.minutes;App.settings.difficulty=o.difficulty;App.settings.cinema=o.cinema;App.applySettings&&App.applySettings();
 const tour=f.tournament;MD.Play.start({home:VS.h,away:VS.a,mode:f.mode||'pro',germ:f.germ,watch:(f.humans||[]).length?o.watch:(o.watch==='play'?'watch':o.watch),humans:f.humans||[],minutes:o.minutes,difficulty:o.difficulty,kits:VS.kits,cinema:o.cinema,knockout:f.knockout,tournament:tour,onFinish:f.onFinish});};
T.vsTactics=function(){const f=App.flow||{};const hs=f.humans||[];const ed=hs.length?[hs.some(x=>x.side==='home'),hs.some(x=>x.side==='away')]:[true,true];MD.Audio.ui('confirm');
 MD.TacticsUI.open({clubs:[VS.h,VS.a],side:ed[0]?0:1,editable:ed,kits:VS.kits,mode:f.mode,onKit:()=>T.vsStart(),onClose:()=>{T.renderVersus();}});};
/* ---------- controles ---------- */
T.renderControls=function(){const C=IN.cfg;const pad=IN.list().find(d=>d.kind==='gamepad');const style=pad?IN.styleOf(pad):(C.glyphs==='ps'?'ps':'xbox');
 const rows=IN.ACTIONS.map(a=>{const k1=(C.keys[a[0]]||[]).map(IN.KEYNAME).join(' / ')||'—',k2=(C.keys2[a[0]]||[]).map(IN.KEYNAME).join(' / ')||'—',pb=(C.pad[a[0]]||[]).map(i=>IN.GLYPH[style][i]||('B'+i)).join(' / ')||'—';
  return`<tr><td>${esc(a[1])}</td><td><button class="key-btn" data-remap="keys:${a[0]}">${esc(k1)}</button></td><td><button class="key-btn" data-remap="keys2:${a[0]}">${esc(k2)}</button></td><td><button class="key-btn" data-remap="pad:${a[0]}">${esc(pb)}</button></td></tr>`;}).join('');
 $('ctl-map').innerHTML=`<h3>Mapeamento</h3><table class="ctl-table"><thead><tr><th>Ação</th><th>Teclado (P1)</th><th>Teclado 2 (setas)</th><th>Controle</th></tr></thead><tbody>${rows}</tbody></table><p class="hint">Na defesa: Passe = pressão (segurar) · Desarme/Cruzamento = bote · Chute = carrinho · Profundidade = goleiro sai. Com a bola: Desarme = proteger. Ctrl + Passe/Chute/Cruz./Prof. = caneta, finta de chute, chapéu, lambreta. Toque rápido em Ctrl + direção = corte seco, pedalada, giro, puxada, arrancada. Analógico direito = dribles.</p><p class="hint" id="ctl-capture"></p>`;
 const sl=(k,l,min,max,step)=>`<label>${l} <b id="ctlv-${k}">${C[k]}</b><input type="range" min="${min}" max="${max}" step="${step}" value="${C[k]}" data-ctl="${k}"></label>`;const ck=(k,l)=>`<label class="chk"><input type="checkbox" data-ctl="${k}" ${C[k]?'checked':''}> ${l}</label>`;
 $('ctl-opts').innerHTML=`<h3>Controle físico</h3>${sl('deadzone','Zona morta do analógico',0,.5,.02)}${sl('sensitivity','Sensibilidade',.5,1.6,.05)}${ck('invertY','Inverter eixo vertical')}${ck('vibration','Vibração (quando suportada)')}<label>Ícones dos botões<select data-ctl="glyphs"><option value="auto" ${C.glyphs==='auto'?'selected':''}>Automático pelo controle</option><option value="xbox" ${C.glyphs==='xbox'?'selected':''}>Xbox</option><option value="ps" ${C.glyphs==='ps'?'selected':''}>PlayStation</option></select></label>
  <h3>Assistências</h3>${ck('passAssist','Assistência de passe')}${ck('shotAssist','Assistência de chute')}${ck('autoSwitch','Troca automática de jogador')}
  <h3>Dispositivos conectados</h3><div id="ctl-devs">${IN.list().map(d=>`<div class="dev-row"><span>${d.icon||''} ${esc(d.label)}</span><small class="hint">${d.kind==='gamepad'?esc(d.name||'')+(d.mapping==='standard'?' · mapeamento padrão':' · mapeamento não padrão'):d.kind==='remote'?'celular':'teclado'}</small><i class="dev-live" data-live="${esc(d.id)}"></i></div>`).join('')}</div><p class="hint">Conecte um controle e pressione qualquer botão para o navegador reconhecê-lo.</p>`;};
T.controlsFrame=function(){if(App.screen!=='controls')return;for(const el of document.querySelectorAll('[data-live]')){const d=IN.device(el.dataset.live);if(!d)continue;const s=d.state;const act=['pass','shoot','cross','through','sprint','switch','tackle','skill','support','pause'].filter(a=>s[a]);el.textContent=(Math.abs(s.mx)>.05||Math.abs(s.my)>.05?`↗ ${s.mx.toFixed(2)}, ${s.my.toFixed(2)} `:'')+act.join(' ');}};
/* ---------- celular ---------- */
T.renderRemote=function(){const R=MD.Remote;const el=$('remote-body');const http=location.protocol==='http:'||location.protocol==='https:';
 const steps=`<div class="card remote-help"><h3>Como conectar</h3><ol><li>Ao lado desta pasta, tenha o repo <code>trs-mobile-device-management</code> e rode nele <code>node server/server.js --game ../game-trs</code> (Node.js 18 ou superior; sem dependências).</li><li>O servidor mostra o endereço na rede local, por exemplo <code>http://192.168.0.10:8080</code>. Abra esse endereço <b>no computador</b> (não use o arquivo <code>file://</code>).</li><li>Aqui, clique em <b>CRIAR SESSÃO</b>. Aparecem um QR code e um PIN de 6 dígitos, válidos por 10 minutos.</li><li>No celular (mesma rede Wi-Fi), leia o QR code com a câmera. Sem câmera: abra <code>http://IP-DO-PC:8080/controller/</code> e digite o PIN.</li><li>Autorize o celular aqui. Depois, escolha o lado na tela de seleção de lados.</li></ol><p class="hint">Celular e computador precisam estar na mesma rede (o PIN sozinho não atravessa redes diferentes). Conexão pela internet (WebRTC) não foi implementada nesta versão.</p></div>`;
 if(!R){el.innerHTML=`<div class="card remote-off"><h3>Servidor do controle necessário</h3><p>O cliente do controle (<code>mobile/remote.js</code>) não foi carregado. Ele vem do servidor do repo <code>trs-mobile-device-management</code>.</p></div>${steps}`;return;}
 if(!http){el.innerHTML=`<div class="card remote-off"><h3>Servidor local necessário</h3><p>Esta página foi aberta como arquivo (<code>${esc(location.protocol)}</code>). O controle pelo celular precisa de um endereço acessível na rede.</p></div>${steps}`;return;}
 const s=R.session;const ctrls=[...R.controllers.values()];
 const urls=(s&&s.urls)||[];const ui=Math.min(T.rmUrl|0,Math.max(0,urls.length-1));
 el.innerHTML=`<div class="card remote-session">${s?`<div class="remote-pair"><div class="remote-qr">${R.qrSvg(ui)}</div><div class="remote-pin"><small>LEIA COM A CÂMERA DO CELULAR</small><small class="hint">ou digite o PIN</small><div class="pin">${esc(s.pin.replace(/(\d{3})(\d{3})/,'$1 $2'))}</div><div class="hint">Expira em <b id="pin-exp"></b> · tentativas erradas são bloqueadas</div></div></div><div class="remote-urls">${urls.map((u,i)=>`<button class="url-pick${i===ui?' active':''}" data-rm-url="${i}" title="Usar este endereço no QR code"><code>${esc(u)}</code></button>`).join('')}</div>${urls.length>1?'<p class="hint">O QR code usa o endereço destacado. Se o celular não abrir a página, escolha outro (o da sua rede Wi-Fi).</p>':''}<div class="btn-row"><button class="btn ghost small" id="rm-new">NOVO PIN</button><button class="btn ghost small" id="rm-close">ENCERRAR SESSÃO</button></div>`:`<p>${R.status==='connecting'?'Conectando ao servidor…':R.status==='error'?'Não foi possível falar com o servidor: '+esc(R.error||''):'Nenhuma sessão ativa.'}</p><button class="btn primary" id="rm-create">CRIAR SESSÃO</button>`}</div>
  <div class="card"><h3>Controles virtuais</h3>${ctrls.length?ctrls.map(c=>`<div class="ctrl-row ${c.state}"><span>📱 <b>${esc(c.label||c.name)}</b> <small class="hint">${esc(c.name||'')}</small></span><span class="st">${{pending:'AGUARDANDO AUTORIZAÇÃO',connected:'CONECTADO',reconnecting:'RECONECTANDO…',gone:'DESCONECTADO'}[c.state]||c.state}${c.rtt?` · ${c.rtt} ms`:''}</span>${c.state==='pending'?`<button class="btn primary small" data-rm-ok="${esc(c.cid)}">AUTORIZAR</button><button class="btn ghost small" data-rm-no="${esc(c.cid)}">RECUSAR</button>`:c.state!=='gone'?`<button class="btn ghost small" data-rm-kick="${esc(c.cid)}">DESCONECTAR</button>`:''}</div>`).join(''):'<p class="hint">Nenhum celular ainda.</p>'}</div>${steps}`;
 if(s){const tick=()=>{const e=$('pin-exp');if(!e)return;const ms=s.expires-Date.now();e.textContent=ms>0?Math.floor(ms/60000)+':'+String(Math.floor(ms/1000)%60).padStart(2,'0'):'expirado';if(App.screen==='remote')setTimeout(tick,1000);};tick();}};
/* ---------- ligações ---------- */
T.bind=function(){
 $('btn-cover-play').onclick=()=>T.openMenu();
 $('home-nav').addEventListener('click',e=>{const b=e.target.closest('[data-home]');if(b)T.home(b.dataset.home);});
 $('home-nav').addEventListener('focusin',()=>MD.Audio.ui('move'));
 document.querySelectorAll('[data-back]').forEach(b=>b.onclick=()=>App.back());
 $('sides-go').onclick=()=>T.sidesGo();$('sides-remote').onclick=()=>App.go('remote');
 $('screen-sides').addEventListener('click',e=>{const m=e.target.closest('[data-move]');if(!m)return;const card=m.closest('[data-dev]');const id=card.dataset.dev;SD.pos.set(id,Math.max(-1,Math.min(1,(SD.pos.get(id)||0)+(+m.dataset.move))));T.renderSides();});
 $('vs-play').onclick=()=>T.vsPlay();$('vs-tactics').onclick=()=>T.vsTactics();
 $('vs-optbtn').onclick=()=>{$('vs-optpanel').hidden=!$('vs-optpanel').hidden;};
 $('vs-optpanel').addEventListener('change',e=>{const k=e.target.dataset.vo;if(!k)return;VS.opts[k]=k==='minutes'?+e.target.value:k==='cinema'?e.target.value==='1':e.target.value;T.renderVersus();$('vs-optpanel').hidden=false;});
 $('ctl-reset').onclick=()=>{if(!confirm('Restaurar o mapeamento padrão de teclado e controles?'))return;IN.reset();T.renderControls();App.toast('Mapeamento padrão restaurado.');};
 $('screen-controls').addEventListener('click',e=>{const b=e.target.closest('[data-remap]');if(!b)return;const [grp,act]=b.dataset.remap.split(':');const kind=grp==='pad'?'pad':'key';
  $('ctl-capture').textContent=kind==='pad'?`Pressione um botão do controle para “${act}”…`:`Pressione uma tecla para “${act}” (Esc cancela)…`;b.classList.add('capturing');
  const pads=navigator.getGamepads?[...navigator.getGamepads()].filter(Boolean):[];const ignore=new Set();for(const g of pads)g.buttons.forEach((x,i)=>{if(x.pressed)ignore.add(g.index+':'+i);});
  IN.capture={kind,ignore,fn:v=>{if(kind==='key'&&v==='Escape'){T.renderControls();return;}const map=IN.cfg[grp];for(const k in map){if(k!==act)map[k]=(map[k]||[]).filter(x=>x!==v);}map[act]=[v];IN.save();T.renderControls();App.toast('Comando redefinido.');MD.Audio.ui('confirm');}};});
 $('screen-controls').addEventListener('input',e=>{const k=e.target.dataset.ctl;if(!k)return;const v=e.target.type==='checkbox'?e.target.checked:e.target.type==='range'?+e.target.value:e.target.value;IN.cfg[k]=v;IN.save();const o=$('ctlv-'+k);if(o)o.textContent=v;});
 $('screen-remote').addEventListener('click',e=>{const R=MD.Remote;if(!R)return;const pick=e.target.closest('[data-rm-url]');if(pick){T.rmUrl=+pick.dataset.rmUrl;T.renderRemote();return;}if(e.target.id==='rm-create'||e.target.id==='rm-new'){R.createSession();setTimeout(()=>T.renderRemote(),50);}if(e.target.id==='rm-close'){R.closeSession();T.renderRemote();}
  const ok=e.target.closest('[data-rm-ok]'),no=e.target.closest('[data-rm-no]'),k=e.target.closest('[data-rm-kick]');if(ok)R.approve(ok.dataset.rmOk,true);if(no)R.approve(no.dataset.rmNo,false);if(k)R.kick(k.dataset.rmKick);});
 if(MD.Remote)MD.Remote.onChange=()=>{if(App.screen==='remote')T.renderRemote();if(App.screen==='sides')T.renderSides();if(App.screen==='home')T.renderDevices();};
 IN.on((type,d)=>{if(type==='connect'||type==='disconnect'){App.toast(`${d.label} ${type==='connect'?'conectado':'desconectado'}.`);if(App.screen==='sides')T.renderSides();if(App.screen==='home')T.renderDevices();if(App.screen==='controls')T.renderControls();}
  if(type==='menu-back')App.back();if(type==='menu-start'&&App.screen==='cover')T.openMenu();});
 document.addEventListener('keydown',e=>{if(IN.capture)return;if(App.screen==='cover'&&(e.code==='Enter'||e.code==='Space')){e.preventDefault();T.openMenu();return;}
  if(e.code==='Escape'&&App.screen!=='play'&&App.screen!=='sides'){e.preventDefault();App.back();}});
 document.addEventListener('focusin',e=>{if(e.target.matches&&e.target.matches('button,select,input,[data-nav]')){document.querySelectorAll('.nav-focus').forEach(x=>x!==e.target&&x.classList.remove('nav-focus'));}});};
T.frame=function(dt){IN.navTick();if(App.screen==='cover'){for(const d of IN.list())if(d.kind==='gamepad'&&(IN.pressed(d,'confirm')||IN.pressed(d,'pause')))T.openMenu();}
 T.sidesFrame();T.vsFrame(dt);T.controlsFrame();};
})(window.MD=window.MD||{});
