/* TRS26 / MATCHDAY 0.6 — SISTEMA DE ENTRADA DESACOPLADO.
   Todo dispositivo (teclado, controles da Gamepad API, celulares remotos) vira o MESMO comando lógico:
   {mx,my (analógico na tela, -1..1, y para baixo), sprint, pass, shoot, cross, through, tackle, press, switch, skill, support, shield, gkRush, pause, rs}
   O motor de futebol nunca sabe de onde veio o comando.
   Também cuida da navegação dos menus por teclado/controle (foco espacial, confirmar, voltar, pausar). */
(function(MD){
'use strict';
const IN=MD.Input={};
const KEY='trs26-input-v1';
/* ações configuráveis e mapeamento padrão */
IN.ACTIONS=[
 ['up','Mover para cima'],['down','Mover para baixo'],['left','Mover para a esquerda'],['right','Mover para a direita'],
 ['sprint','Sprint'],['pass','Passe curto / pressão'],['shoot','Chute / carrinho'],['cross','Cruzamento / passe alto / desarme'],['through','Profundidade / goleiro sai'],
 ['switch','Trocar jogador'],['tackle','Desarme / proteger a bola'],['skill','Modificador de habilidade (drible)'],['support','Pedir apoio / tabela'],['pause','Pausar']];
IN.DEFAULT_KEYS={up:['KeyW'],down:['KeyS'],left:['KeyA'],right:['KeyD'],sprint:['ShiftLeft','ShiftRight'],pass:['KeyJ'],shoot:['KeyK'],cross:['KeyL'],through:['KeyI'],switch:['KeyE'],tackle:['Space'],skill:['ControlLeft','ControlRight'],support:['KeyQ'],pause:['Escape','KeyP']};
/* segundo jogador no mesmo teclado (setas + teclado numérico) */
IN.DEFAULT_KEYS2={up:['ArrowUp'],down:['ArrowDown'],left:['ArrowLeft'],right:['ArrowRight'],sprint:['Numpad0'],pass:['Numpad1'],shoot:['Numpad2'],cross:['Numpad3'],through:['Numpad5'],switch:['Numpad4'],tackle:['NumpadDecimal'],skill:['Numpad6'],support:['Numpad8'],pause:['NumpadEnter']};
/* Gamepad API, mapeamento "standard": 0 A/✕ 1 B/○ 2 X/□ 3 Y/△ 4 LB/L1 5 RB/R1 6 LT/L2 7 RT/R2 8 Back 9 Start 10 L3 11 R3 12-15 direcional */
IN.DEFAULT_PAD={pass:[0],shoot:[1],cross:[2],through:[3],switch:[4],support:[5],tackle:[6],sprint:[7],skill:[10],pause:[9],up:[12],down:[13],left:[14],right:[15]};
IN.GLYPH={xbox:['A','B','X','Y','LB','RB','LT','RT','View','Menu','LS','RS','↑','↓','←','→'],ps:['✕','○','□','△','L1','R1','L2','R2','Share','Options','L3','R3','↑','↓','←','→'],generic:['B0','B1','B2','B3','B4','B5','B6','B7','B8','B9','B10','B11','↑','↓','←','→']};
IN.KEYNAME=c=>({Space:'Espaço',ShiftLeft:'Shift',ShiftRight:'Shift dir.',ControlLeft:'Ctrl',ControlRight:'Ctrl dir.',Escape:'Esc',ArrowUp:'↑',ArrowDown:'↓',ArrowLeft:'←',ArrowRight:'→',Enter:'Enter',NumpadEnter:'Enter (num)',Backspace:'Backspace'}[c]||c.replace(/^Key/,'').replace(/^Digit/,'').replace(/^Numpad/,'Num '));
const defaults=()=>({keys:JSON.parse(JSON.stringify(IN.DEFAULT_KEYS)),keys2:JSON.parse(JSON.stringify(IN.DEFAULT_KEYS2)),pad:JSON.parse(JSON.stringify(IN.DEFAULT_PAD)),deadzone:.18,sensitivity:1,invertY:false,vibration:true,glyphs:'auto',passAssist:true,shotAssist:true,autoSwitch:true,defense:'assisted'});
IN.cfg=defaults();
IN.load=function(){try{const s=JSON.parse(localStorage.getItem(KEY)||'null');if(s){const d=defaults();IN.cfg={...d,...s,keys:{...d.keys,...(s.keys||{})},keys2:{...d.keys2,...(s.keys2||{})},pad:{...d.pad,...(s.pad||{})}};}}catch(e){}return IN.cfg;};
IN.save=function(){try{localStorage.setItem(KEY,JSON.stringify(IN.cfg));}catch(e){}};
IN.reset=function(){IN.cfg=defaults();IN.save();};
/* ---------- estado bruto ---------- */
const down=new Set(),tapped=new Set();let blurT=0;/* tapped: teclas pressionadas e soltas entre duas leituras (toque rápido não se perde) */
IN.keyDown=c=>down.has(c);
IN.capture=null;/* remapeamento: função que recebe o próximo código/botão */
IN.listeners=[];IN.on=f=>IN.listeners.push(f);const emit=(type,o)=>{for(const f of IN.listeners)try{f(type,o);}catch(e){console.error(e);}};
/* ---------- dispositivos ---------- */
IN.devices=new Map();/* id → {id, kind:'keyboard'|'gamepad'|'remote', label, short, index, state, connected, style} */
function newState(){return{mx:0,my:0,sprint:false,pass:false,shoot:false,cross:false,through:false,tackle:false,press:false,switch:false,skill:false,support:false,shield:false,gkRush:false,pause:false,rs:null,confirm:false,back:false};}
function addDevice(d){d.state=d.state||newState();d.prev=newState();d.connected=true;IN.devices.set(d.id,d);emit('connect',d);return d;}
addDevice({id:'kb1',kind:'keyboard',label:'TECLADO',short:'TECLADO',icon:'⌨'});
addDevice({id:'kb2',kind:'keyboard',label:'TECLADO 2 (setas)',short:'TECLADO 2',icon:'⌨',secondary:true});
IN.list=()=>[...IN.devices.values()].filter(d=>d.connected);
IN.device=id=>IN.devices.get(id)||null;
function padStyle(id){const s=String(id).toLowerCase();if(/xbox|xinput|045e|microsoft/.test(s))return'xbox';if(/054c|sony|playstation|dualshock|dualsense|^wireless controller/.test(s))return'ps';return'generic';}
IN.styleOf=d=>{if(IN.cfg.glyphs!=='auto')return IN.cfg.glyphs;return d&&d.style||'xbox';};
IN.glyph=(d,action)=>{if(!d)return'';if(d.kind==='keyboard'){const k=(d.secondary?IN.cfg.keys2:IN.cfg.keys)[action];return k&&k[0]?IN.KEYNAME(k[0]):'—';}if(d.kind==='remote')return({pass:'PASSE',shoot:'CHUTE',cross:'CRUZ.',through:'PROF.',sprint:'SPRINT',switch:'TROCA',skill:'HAB.',tackle:'MARCA',pause:'PAUSA'})[action]||action;const b=IN.cfg.pad[action];return b&&b.length?IN.GLYPH[IN.styleOf(d)][b[0]]||('B'+b[0]):'—';};
if(typeof window!=='undefined'){
 window.addEventListener('gamepadconnected',e=>{const g=e.gamepad;const id='gp'+g.index;const old=IN.devices.get(id);if(old&&old.connected)return;const n=[...IN.devices.values()].filter(d=>d.kind==='gamepad').length;
  addDevice({id,kind:'gamepad',index:g.index,label:'CONTROLE '+(g.index+1),short:'CONTROLE '+(g.index+1),icon:'🎮',style:padStyle(g.id),name:g.id,mapping:g.mapping});});
 window.addEventListener('gamepaddisconnected',e=>{const d=IN.devices.get('gp'+e.gamepad.index);if(d){d.connected=false;d.state=newState();emit('disconnect',d);}});
 window.addEventListener('keydown',e=>{if(IN.capture&&IN.capture.kind==='key'){e.preventDefault();const f=IN.capture;IN.capture=null;f.fn(e.code);return;}
  if(e.target&&e.target.matches&&e.target.matches('input[type=text],input[type=search],input:not([type]),textarea,select')&&!IN.gameActive)return;
  down.add(e.code);tapped.add(e.code);if(IN.gameActive&&isGameKey(e.code))e.preventDefault();});
 window.addEventListener('keyup',e=>{down.delete(e.code);});
 /* perda de foco: nenhum comando fica preso */
 window.addEventListener('blur',()=>{down.clear();tapped.clear();blurT=performance.now();for(const d of IN.devices.values())d.state=newState();emit('blur',{});});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){down.clear();for(const d of IN.devices.values())d.state=newState();emit('blur',{});}});
}
function isGameKey(c){const all=[...Object.values(IN.cfg.keys).flat(),...Object.values(IN.cfg.keys2).flat()];return all.includes(c)&&c!=='Escape';}
const dz=(x,y,d)=>{const m=Math.hypot(x,y);if(m<d)return[0,0];const k=Math.min(1,(m-d)/(1-d))/m;return[x*k,y*k];};
/* ---------- leitura por quadro ---------- */
IN.poll=function(){const C=IN.cfg;
 for(const d of IN.devices.values()){if(!d.connected)continue;d.prev=d.state;const s=newState();
  if(d.kind==='keyboard'){const K=d.secondary?C.keys2:C.keys;const on=a=>(K[a]||[]).some(c=>down.has(c)||tapped.has(c)&&!d.prev[a]);let x=(on('right')?1:0)-(on('left')?1:0),y=(on('down')?1:0)-(on('up')?1:0);const m=Math.hypot(x,y);if(m>1){x/=m;y/=m;}s.mx=x;s.my=y;
   for(const a of ['sprint','pass','shoot','cross','through','switch','tackle','skill','support','pause'])s[a]=on(a);
   if(!d.secondary){s.confirm=down.has('Enter')||down.has('NumpadEnter')||tapped.has('Enter');s.back=down.has('Escape')||down.has('Backspace')||tapped.has('Escape');}}
  else if(d.kind==='gamepad'){const pads=navigator.getGamepads?navigator.getGamepads():[];const g=pads[d.index];if(!g){continue;}
   const btn=i=>{const b=g.buttons[i];return!!b&&(b.pressed||b.value>.5);};const P=C.pad;const on=a=>(P[a]||[]).some(btn);
   let [x,y]=dz(g.axes[0]||0,g.axes[1]||0,C.deadzone);x=Math.max(-1,Math.min(1,x*C.sensitivity));y=Math.max(-1,Math.min(1,y*C.sensitivity));if(C.invertY)y=-y;
   if(on('left'))x=-1;if(on('right'))x=1;if(on('up'))y=-1;if(on('down'))y=1;s.mx=x;s.my=y;
   const [rx,ry]=dz(g.axes[2]||0,g.axes[3]||0,Math.max(.25,C.deadzone));s.rs=Math.hypot(rx,ry)>0?{x:rx,y:ry}:null;
   for(const a of ['sprint','pass','shoot','cross','through','switch','tackle','skill','support','pause'])s[a]=on(a);
   s.confirm=btn(0);s.back=btn(1);s.pad=g;}
  else if(d.kind==='remote'){const r=d.remote;if(r&&performance.now()-r.at<800){s.mx=r.x;s.my=r.y;for(const a of ['sprint','pass','shoot','cross','through','switch','tackle','skill','support','pause'])s[a]=!!r[a];s.confirm=!!r.pass;s.back=!!r.through&&false;}
   /* sem pacote recente: comando zerado (o celular não pode "continuar andando" sozinho) */}
  /* comandos contextuais derivados (o motor só vê o formato lógico) */
  s.press=s.pass||s.tackle;s.shield=s.tackle;s.gkRush=s.through;
  d.state=s;}
 tapped.clear();
 /* remapeamento de controle: próximo botão pressionado */
 if(IN.capture&&IN.capture.kind==='pad'){const pads=navigator.getGamepads?navigator.getGamepads():[];for(const g of pads){if(!g)continue;for(let i=0;i<g.buttons.length;i++)if(g.buttons[i].pressed&&!(IN.capture.ignore||new Set()).has(g.index+':'+i)){const f=IN.capture;IN.capture=null;f.fn(i);return;}}}};
IN.pressed=(d,a)=>!!d&&d.state[a]&&!d.prev[a];
/* remoto: o módulo de rede chama isto com o último pacote validado */
IN.remoteUpdate=function(id,label,pkt){let d=IN.devices.get(id);if(!d||!d.connected){d=addDevice({id,kind:'remote',label,short:label,icon:'📱'});}d.remote={...pkt,at:performance.now()};};
IN.remoteGone=function(id){const d=IN.devices.get(id);if(d){d.connected=false;d.remote=null;d.state=newState();emit('disconnect',d);}};
IN.rumble=function(dev,ms,k){if(!IN.cfg.vibration||!dev)return;try{if(dev.kind==='gamepad'){const g=(navigator.getGamepads()||[])[dev.index];const v=g&&g.vibrationActuator;if(v&&v.playEffect)v.playEffect('dual-rumble',{duration:ms||120,strongMagnitude:k||.6,weakMagnitude:(k||.6)*.6});}else if(dev.kind==='remote'&&dev.sendRumble)dev.sendRumble(ms||80);}catch(e){}};
/* comando para o motor: converte o analógico da tela para o mundo usando a orientação da câmera */
IN.toWorld=function(s,basis){const r=basis||{rx:1,rz:0,fx:0,fz:-1};const x=s.mx,y=-s.my;return{mx:r.rx*x+r.fx*y,mz:r.rz*x+r.fz*y};};
IN.command=function(d,basis){const s=d.state;const w=IN.toWorld(s,basis);const c={...s,mx:w.mx,mz:w.mz};if(s.rs){const rw=IN.toWorld({mx:s.rs.x,my:s.rs.y},basis);c.rs={x:rw.mx,z:rw.mz};}return c;};
/* ---------- navegação de menus por teclado/controle ---------- */
IN.gameActive=false;
const navRepeat={t:0,dir:null};
IN.navTick=function(){if(IN.gameActive)return;const now=performance.now();let dir=null,confirm=false,back=false;
 for(const d of IN.list()){if(d.secondary)continue;const s=d.state,p=d.prev;
  if(d.kind==='keyboard'){const k=c=>down.has(c);if(k('ArrowUp'))dir='up';else if(k('ArrowDown'))dir='down';else if(k('ArrowLeft'))dir='left';else if(k('ArrowRight'))dir='right';}
  else{if(s.my<-.6)dir='up';else if(s.my>.6)dir='down';else if(s.mx<-.6)dir='left';else if(s.mx>.6)dir='right';
   if(s.confirm&&!p.confirm)confirm=true;if(s.back&&!p.back)back=true;if(s.pause&&!p.pause)emit('menu-start',d);}}
 if(dir){if(dir!==navRepeat.dir||now-navRepeat.t>(navRepeat.fast?110:340)){navRepeat.fast=dir===navRepeat.dir;navRepeat.dir=dir;navRepeat.t=now;if(!document.activeElement||!document.activeElement.matches('input[type=range]')||dir==='up'||dir==='down')IN.moveFocus(dir);}}
 else{navRepeat.dir=null;navRepeat.fast=false;}
 if(confirm){const el=document.activeElement;if(el&&el!==document.body){el.click();MD.Audio&&MD.Audio.ui&&MD.Audio.ui('confirm');}}
 if(back){emit('menu-back',{});}};
IN.focusables=function(root){root=root||document;return[...root.querySelectorAll('button:not([disabled]),[data-nav],a[href],select,input:not([type=hidden]),[tabindex]:not([tabindex="-1"])')].filter(el=>{if(el.closest('[hidden]'))return false;const r=el.getBoundingClientRect();return r.width>2&&r.height>2&&getComputedStyle(el).visibility!=='hidden';});};
IN.scope=()=>{const modal=[...document.querySelectorAll('.modal:not([hidden]),.overlay-menu:not([hidden]),.trs-modal.active')].pop();if(modal)return modal;return document.querySelector('.screen.active')||document;};
IN.moveFocus=function(dir){const scope=IN.scope();const list=IN.focusables(scope);if(!list.length)return;let cur=document.activeElement;if(!cur||!list.includes(cur)){list[0].focus();list[0].classList.add('nav-focus');return;}
 const rc=cur.getBoundingClientRect(),cx=rc.left+rc.width/2,cy=rc.top+rc.height/2;let best=null,bs=1e9;
 for(const el of list){if(el===cur)continue;const r=el.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;const dx=x-cx,dy=y-cy;
  const ok=dir==='up'?dy<-4:dir==='down'?dy>4:dir==='left'?dx<-4:dx>4;if(!ok)continue;const main=dir==='up'||dir==='down'?Math.abs(dy):Math.abs(dx),cross=dir==='up'||dir==='down'?Math.abs(dx):Math.abs(dy);const sc=main+cross*2.2;if(sc<bs){bs=sc;best=el;}}
 if(best){document.querySelectorAll('.nav-focus').forEach(e=>e.classList.remove('nav-focus'));best.focus({preventScroll:false});best.classList.add('nav-focus');best.scrollIntoView&&best.scrollIntoView({block:'nearest',inline:'nearest'});MD.Audio&&MD.Audio.ui&&MD.Audio.ui('move');}};
IN.load();
})(typeof window!=='undefined'?(window.MD=window.MD||{}):(globalThis.MD=globalThis.MD||{}));
