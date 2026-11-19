/* TRS26 — controle virtual no celular (somente entrada; nenhuma imagem da partida é transmitida).
   Multitoque real com Pointer Events + setPointerCapture: segurar o analógico, correr e passar ao mesmo tempo.
   Envio: até 60 pacotes/s enquanto há entrada, sinal de vida a cada 100 ms; sequência crescente (o jogo descarta pacotes velhos);
   ao soltar, ao ocultar a página ou ao perder a conexão, o estado é zerado imediatamente. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const BTN=['pass','shoot','cross','through','sprint','switch','skill','tackle','support','pause'];
const CFG_KEY='trs26-pad-cfg',TOK_KEY='trs26-pad-token';
const DEF={btn:1,stick:1,alpha:.92,dead:.12,sens:1,vib:true,mirror:false,dpad:false};
let cfg={...DEF,...(JSON.parse(localStorage.getItem(CFG_KEY)||'null')||{})};
let ws=null,state='idle',seq=0,lastSend=0,label='',retry=0,paired=null,rtt=0;
const st={x:0,y:0,b:0};let stickPtr=null;const btnPtrs=new Map();/* pointerId → botão */
function applyCfg(){const r=document.documentElement.style;r.setProperty('--btn',cfg.btn);r.setProperty('--stk',cfg.stick);r.setProperty('--alpha',cfg.alpha);$('pad').classList.toggle('mirror',!!cfg.mirror);
 document.querySelectorAll('[data-cfg]').forEach(i=>{const k=i.dataset.cfg;if(i.type==='checkbox')i.checked=!!cfg[k];else i.value=cfg[k];});localStorage.setItem(CFG_KEY,JSON.stringify(cfg));}
function status(t,cls){const el=$('pair').hidden?$('st'):$('pair-status');el.textContent=t;el.className=(el.id==='st'?'st ':'status ')+(cls||'');}
/* ---------- conexão ---------- */
function connect(then){if(ws&&ws.readyState<=1){if(ws.readyState===1)then&&then();else ws.addEventListener('open',()=>then&&then(),{once:true});return;}
 status('CONECTANDO…','warn');ws=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host+'/ws');
 ws.onopen=()=>{retry=0;then&&then();};
 ws.onmessage=e=>{let m;try{m=JSON.parse(e.data);}catch(x){return;}handle(m);};
 ws.onclose=()=>{zero(true);if(paired){status('RECONECTANDO…','warn');retry++;setTimeout(()=>connect(()=>send({t:'resume',sid:paired.sid,cid:paired.cid,token:paired.token})),Math.min(4000,400*retry));}else status('DESCONECTADO','bad');};
 ws.onerror=()=>status('Servidor não encontrado','err');}
const send=o=>{if(ws&&ws.readyState===1)ws.send(JSON.stringify(o));};
function handle(m){switch(m.t){
 case'wait-approval':status('AGUARDANDO AUTORIZAÇÃO NO COMPUTADOR…','warn');break;
 case'paired':paired={sid:m.sid,cid:m.cid,token:m.token};localStorage.setItem(TOK_KEY,JSON.stringify({...paired,at:Date.now()}));label=m.label||'CELULAR';showPad();status('CONECTADO');$('who').textContent=label;buzz(40);break;
 case'hello':if(m.label){label=m.label;$('who').textContent=label;}break;
 case'state':$('who').textContent=(m.label||label)+(m.side?(m.side==='home'?' · MANDANTE':' · VISITANTE'):'')+(m.player?' · '+m.player:'');labels(m.attack!==false,m.hasBall);break;
 case'rumble':buzz(Math.min(400,m.ms|0));break;
 case'pong':rtt=Date.now()-m.ts;$('lat').textContent=rtt+' ms';send({t:'rtt',rtt});break;
 case'host-away':status('COMPUTADOR DESCONECTADO…','warn');zero(true);break;
 case'host-back':status('CONECTADO');break;
 case'denied':paired=null;localStorage.removeItem(TOK_KEY);showPair();status('Conexão recusada pelo computador.','err');break;
 case'kicked':case'session-ended':paired=null;localStorage.removeItem(TOK_KEY);zero(true);showPair();status('Sessão encerrada. Digite um novo PIN.','err');break;
 case'error':if(m.code==='resume'){paired=null;localStorage.removeItem(TOK_KEY);showPair();}status(m.msg||'Erro','err');break;}}
function labels(attack,hasBall){const L=attack?{pass:'PASSE',shoot:'CHUTE',cross:'CRUZ.',through:'PROF.',tackle:hasBall?'PROTEGER':'MARCA'}:{pass:'PRESSÃO',shoot:'CARRINHO',cross:'DESARME',through:'GOLEIRO',tackle:'DESARME'};
 for(const k in L){const el=document.querySelector(`[data-lbl="${k}"]`);if(el)el.textContent=L[k];}$('pad').classList.toggle('def',!attack);}
function showPad(){$('pair').hidden=true;$('pad').hidden=false;try{if(document.documentElement.requestFullscreen&&!document.fullscreenElement)document.documentElement.requestFullscreen().then(()=>screen.orientation&&screen.orientation.lock&&screen.orientation.lock('landscape').catch(()=>{})).catch(()=>{});}catch(e){}}
function showPair(){$('pad').hidden=true;$('pair').hidden=false;}
function buzz(ms){if(cfg.vib&&navigator.vibrate)try{navigator.vibrate(ms);}catch(e){}}
/* ---------- envio ---------- */
function packet(){return{t:'in',s:++seq,ts:Date.now(),x:+st.x.toFixed(3),y:+st.y.toFixed(3),b:st.b};}
function zero(silent){st.x=0;st.y=0;st.b=0;stickPtr=null;btnPtrs.clear();$('knob').style.transform='';$('stick').classList.remove('active');document.querySelectorAll('.b.on').forEach(b=>b.classList.remove('on'));if(!silent)send(packet());}
let last={x:0,y:0,b:0};
function loop(){requestAnimationFrame(loop);if(!paired||$('pad').hidden)return;const now=performance.now();const changed=st.x!==last.x||st.y!==last.y||st.b!==last.b;
 if((changed&&now-lastSend>15)||now-lastSend>100){send(packet());lastSend=now;last={...st};}}
requestAnimationFrame(loop);
/* envio imediato no próprio evento de toque (não depende do requestAnimationFrame, que o navegador pode desacelerar) */
function pump(){if(!paired||$('pad').hidden)return;const now=performance.now();if(now-lastSend>15){send(packet());lastSend=now;last={...st};}else if(!pump.t)pump.t=setTimeout(()=>{pump.t=0;pump();},16);}
setInterval(()=>{if(paired&&!$('pad').hidden&&performance.now()-lastSend>100){send(packet());lastSend=performance.now();last={...st};}},100);
setInterval(()=>{if(paired)send({t:'ping',ts:Date.now()});},1500);
/* ---------- analógico (captura do ponteiro: não é cancelado por outros toques) ---------- */
const stick=$('stick');
function stickMove(e){const r=stick.getBoundingClientRect();const cx=r.left+r.width/2,cy=r.top+r.height/2,R=r.width/2;let dx=(e.clientX-cx)/R,dy=(e.clientY-cy)/R;const m=Math.hypot(dx,dy);if(m>1){dx/=m;dy/=m;}
 $('knob').style.transform=`translate(${dx*R*.62}px,${dy*R*.62}px)`;let mag=Math.min(1,m);if(mag<cfg.dead){st.x=0;st.y=0;pump();return;}const k=Math.min(1,(mag-cfg.dead)/(1-cfg.dead)*cfg.sens)/Math.max(mag,1e-6);let x=dx*k,y=dy*k;
 if(cfg.dpad){const a=Math.round(Math.atan2(y,x)/(Math.PI/4))*(Math.PI/4);x=+Math.cos(a).toFixed(3);y=+Math.sin(a).toFixed(3);}st.x=Math.max(-1,Math.min(1,x));st.y=Math.max(-1,Math.min(1,y));pump();}
stick.addEventListener('pointerdown',e=>{e.preventDefault();if(stickPtr!==null)return;stickPtr=e.pointerId;stick.setPointerCapture(e.pointerId);stick.classList.add('active');stickMove(e);});
stick.addEventListener('pointermove',e=>{if(e.pointerId!==stickPtr)return;e.preventDefault();stickMove(e);});
const stickEnd=e=>{if(e.pointerId!==stickPtr)return;stickPtr=null;st.x=0;st.y=0;$('knob').style.transform='';stick.classList.remove('active');send(packet());lastSend=performance.now();};
stick.addEventListener('pointerup',stickEnd);stick.addEventListener('pointercancel',stickEnd);stick.addEventListener('lostpointercapture',stickEnd);
/* ---------- botões ---------- */
document.querySelectorAll('[data-b]').forEach(el=>{const k=el.dataset.b,bit=1<<BTN.indexOf(k);
 el.addEventListener('pointerdown',e=>{e.preventDefault();el.setPointerCapture(e.pointerId);btnPtrs.set(e.pointerId,k);st.b|=bit;el.classList.add('on');buzz(12);pump();});
 const up=e=>{if(!btnPtrs.has(e.pointerId))return;btnPtrs.delete(e.pointerId);if(![...btnPtrs.values()].includes(k)){st.b&=~bit;el.classList.remove('on');}send(packet());lastSend=performance.now();};
 el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);el.addEventListener('lostpointercapture',up);});
/* sem rolagem, zoom ou seleção durante o jogo */
['touchmove','gesturestart','contextmenu','dblclick'].forEach(t=>document.addEventListener(t,e=>{if(!$('pad').hidden)e.preventDefault();},{passive:false}));
document.addEventListener('visibilitychange',()=>{if(document.hidden)zero(false);});/* 'blur' não zera: com o dedo na tela, interrupções reais do sistema já chegam como pointercancel/visibilitychange */window.addEventListener('pagehide',()=>zero(false));
/* ---------- pareamento ---------- */
$('pin').addEventListener('input',e=>{const v=e.target.value.replace(/\D/g,'').slice(0,6);e.target.value=v.length>3?v.slice(0,3)+' '+v.slice(3):v;});
$('pin-form').addEventListener('submit',e=>{e.preventDefault();const pin=$('pin').value.replace(/\D/g,'');if(pin.length!==6){status('O PIN tem 6 dígitos.','err');return;}const name=$('name').value.trim()||'Celular';localStorage.setItem('trs26-pad-name',name);
 connect(()=>send({t:'join',pin,name}));});
$('name').value=localStorage.getItem('trs26-pad-name')||'';
/* reconexão automática com o token deste aparelho */
try{const t=JSON.parse(localStorage.getItem(TOK_KEY)||'null');if(t&&Date.now()-t.at<3600e3){paired={sid:t.sid,cid:t.cid,token:t.token};status('RECONECTANDO…','warn');connect(()=>send({t:'resume',...paired}));}}catch(e){}
/* ---------- configurações ---------- */
$('gear').onclick=()=>{$('cfg').hidden=false;zero(false);};$('cfg-close').onclick=()=>{$('cfg').hidden=true;};$('cfg-reset').onclick=()=>{cfg={...DEF};applyCfg();};
$('cfg-leave').onclick=()=>{paired=null;localStorage.removeItem(TOK_KEY);zero(false);try{ws&&ws.close();}catch(e){}$('cfg').hidden=true;showPair();status('Desconectado.');};
document.querySelectorAll('[data-cfg]').forEach(i=>i.addEventListener('input',()=>{const k=i.dataset.cfg;cfg[k]=i.type==='checkbox'?i.checked:+i.value;applyCfg();}));
applyCfg();
window.TRSPad={state:()=>({...st,seq,paired:!!paired}),zero};/* usado pelos testes automatizados */
})();
