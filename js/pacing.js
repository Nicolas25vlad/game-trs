/* MATCHDAY 0.5 — ritmo da transmissão: relógio contextual e agendador de melhores momentos.
   Separa o tempo da simulação (motor, que roda à frente com uma janela de antecedência) do tempo mostrado:
   - entre os lances o relógio corre acelerado (ritmo lento/normal/rápido);
   - ao se aproximar de um lance desacelera suavemente (chega ao início do lance a 1x, sem saltos);
   - durante o lance corre em velocidade natural, sincronizado com a trilha 3D (o instante decisivo do lance
     coincide com o minuto calculado pelo motor — nada é contado duas vezes);
   - depois do lance (e do replay) volta gradualmente à aceleração.
   O agendador usa fila, classificação de importância, filtro de lances repetidos e intervalo mínimo entre
   destaques. Lances não exibidos têm o efeito aplicado silenciosamente quando o relógio passa por eles.
   Nada aqui depende do DOM: os testes em Node usam a mesma classe. */
(function(MD){
'use strict';
const PG={};
const E=()=>MD.Engine;
PG.PACES=[['slow','Lento'],['normal','Normal'],['fast','Rápido']];
PG.params=function(mode,pace,mul){const p=(mode&&mode.pace&&mode.pace[pace||'normal'])||{accel:24,gap:11,k:1.15};return{accel:Math.max(1.5,p.accel*(mul||1)),gap:p.gap/Math.max(.75,Math.sqrt(mul||1)),k:p.k||1.1};};
/* Tempo real estimado para percorrer d segundos simulados com o perfil acelerar→desacelerar (rate = min(accel, 1+d/k)). */
PG.estReal=function(d,accel,k){if(d<=0)return 0;const knee=k*(accel-1);if(d<=knee)return k*Math.log(1+d/k);return (d-knee)/accel+k*Math.log(accel);};
const CRITICAL=new Set(['goal','owngoal','disallowed','red','penalty_miss','shootout']);
PG.isCritical=ev=>CRITICAL.has(ev.kind)||!!ev.goal||(ev.beats||[]).some(b=>b.k==='penalty');
/* Um lance comum merece ser exibido? (lances sem finalização precisam de algo realmente interessante) */
PG.worth=function(ev){const b=ev.beats||[];const shot=b.filter(x=>x.k==='shot').pop();const imp=ev.importance||0;
 const special=shot&&['bicycle','volley','chip','freekick'].includes(shot.type);const skill=b.some(x=>x.k==='skill'&&x.ok&&['nutmeg','sombrero','rainbow','elastico','flick','stepover'].includes(x.move));
 switch(ev.kind){
  case'save':return true;case'post':return true;
  case'miss':return (ev.xg||0)>=.1||special||skill||imp>=1.05;
  case'blocked':return (ev.xg||0)>=.13||skill||imp>=1.1;
  case'card':return imp>=.8&&(b.some(x=>x.k==='foul'&&(x.dangerous||x.card&&x.card.second))||imp>=1.2||ev._cardSlot);
  case'offside':return imp>=.9;
  case'foul':return imp>=.55;case'chance':return imp>=.8;
  default:return imp>=.6;}};
class Live{
 /* o: {build(ev)→trilha, kickoff(k)→trilha, pace, mul, replays, slowmo} */
 constructor(m,o){this.m=m;this.o=o||{};this.mode=m.mode;this.clock=0;this.real=0;this.rate=1;this.state='pre';this.items=[];this.koSeen=0;this.cur=null;this.t=0;
  this.lastEnd=-1e9;this.lastShown=null;this.lastCardAt=-1e9;this.applied=new Set();this.look=this.mode.id==='germinare'?45:240;this.events=[];this.log=[];this.maxRateIn={present:0};
  this.setPace(this.o.pace||'normal',this.o.mul||1);}
 setPace(p,mul){this.pace=p;this.mul=mul||1;this.P=PG.params(this.mode,p,this.mul);}
 begin(){if(this.state==='pre'){this.state='idle';this.pump();}}
 /* motor à frente do relógio mostrado (janela de antecedência) */
 pump(){const m=this.m,Eg=E();let guard=0;
  if(m.phase==='shootout'){let ev;while((ev=Eg.advance(m,0))&&guard++<60)this.ingest(ev);}
  while(Eg.playing(m)&&m.clock<this.clock+this.look&&guard++<400){const ev=Eg.advance(m,this.clock+this.look);if(ev)this.ingest(ev);else break;}
  while(this.koSeen<m.kickoffs.length){const k=m.kickoffs[this.koSeen++];
   this.items.push({kind:'kickoff',k,tr:null,key:k.t,start:k.t-1.4,startT:0,critical:true,present:!!this.o.kickoff,done:false});}
  this.items.sort((a,b)=>a.start-b.start||(a.kind==='kickoff'?-1:1));}
 ingest(ev){this.events.push(ev);let tr=null;try{tr=this.o.build?this.o.build(ev):null;}catch(e){tr=null;}
  const startT=tr?(tr.startT||0):0,ap=tr&&tr.applyAt!=null?tr.applyAt:startT;const shoot=ev.kind==='shootout';
  this.items.push({kind:'event',ev,tr,key:ev.clock,start:shoot?ev.clock:ev.clock-(ap-startT),startT,critical:PG.isCritical(ev),present:tr?undefined:false,done:false,shoot});}
 next(){for(const it of this.items)if(!it.done)return it;return null;}
 decide(it){if(it.present!==undefined)return it.present;const ev=it.ev;
  if(it.critical){it.present=true;return true;}
  let ok=!!PG.worth(ev);
  if(ok&&ev.kind==='card'&&ev.clock-this.lastCardAt<900)ok=false;
  const L=this.lastShown;if(ok&&L&&L.kind==='event'&&!L.critical&&L.ev.kind===ev.kind&&L.ev.attack===ev.attack&&L.ev.playType===ev.playType&&ev.clock-L.ev.clock<480)ok=false;
  if(ok){const busy=this.state==='present'||this.state==='replay'?Math.max(0,(this.cur&&this.cur.tr?this.cur.tr.duration-this.t:0)):0;
   const arrive=this.real+busy+PG.estReal(it.start-this.clock,this.P.accel,this.P.k);if(arrive-this.lastEnd<this.P.gap)ok=false;}
  it.present=ok;if(!ok)it.demoted=true;return ok;}
 apply(ev){if(!ev||this.applied.has(ev.id))return;this.applied.add(ev.id);ev.applied=true;if(this.o.onApply)this.o.onApply(ev);}
 breakAt(){const m=this.m;return m.phase==='halftime'||m.phase==='fulltime'?(m.breakAt??m.clock):null;}
 update(dt){this.real+=dt;const m=this.m;
  if(this.state==='pre'||this.state==='break'||this.state==='done'||this.state==='hold')return;
  if(this.state==='present'){const it=this.cur;this.t+=dt;
   if(!it.shoot){const want=it.start+(this.t-it.t0);this.clock=Math.max(this.clock,want);}
   if(it.kind==='event'&&!this.applied.has(it.ev.id)&&it.tr&&this.t>=(it.tr.applyAt??0))this.apply(it.ev);
   if(this.t>=it.tr.duration)this.finish();return;}
  if(this.state==='replay'){const it=this.cur;this.t+=dt*(this.o.slowmo===false?1:.42);const nx=this.nextPresent();
   if(!it.shoot){const lim=nx?nx.start:(this.breakAt()??1e9);this.clock=Math.min(this.clock+dt,Math.max(this.clock,lim));}
   if(this.t>=it.tr.replay.t1||(nx&&!it.shoot&&this.clock>=nx.start-1e-6)){this.state='idle';this.lastEnd=this.real;this.cur=null;}return;}
  /* idle: relógio contextual */
  this.pump();let nx=null;
  for(const it of this.items){if(it.done)continue;if(it.present===undefined&&!this.decide(it)){continue;}if(it.present){nx=it;break;}}
  /* aplica (sem exibir) os lances descartados que o relógio já alcançou */
  for(const it of this.items)if(!it.done&&it.present===false&&it.key<=this.clock+1e-6){it.done=true;if(it.kind==='event')this.apply(it.ev);}
  if(m.phase==='shootout'||(nx&&nx.shoot)){if(nx){if(this.real-this.lastEnd>=(this.mode.id==='germinare'?1.4:2.2))this.startItem(nx);}else if(m.phase==='fulltime')this.state='done';return;}
  const ba=this.breakAt();
  let want=this.P.accel;if(nx)want=Math.min(want,1+Math.max(0,nx.start-this.clock)/this.P.k);
  if(ba!==null&&(!nx||nx.start>ba))want=Math.min(want,1+Math.max(0,ba-this.clock)/(this.P.k*1.6));
  this.rate=this.rate<want?this.rate+(want-this.rate)*(1-Math.exp(-dt/.9)):want;
  let lim=1e12;if(nx)lim=Math.min(lim,Math.max(this.clock,nx.start));if(ba!==null)lim=Math.min(lim,Math.max(this.clock,ba));
  this.clock=Math.min(this.clock+this.rate*dt,lim);
  if(nx&&this.clock>=nx.start-1e-6){this.startItem(nx);return;}
  if(ba!==null&&this.clock>=ba-1e-6&&!this.items.some(it=>!it.done&&it.key<=ba+1e-6)){this.state=m.phase==='fulltime'?'done':'break';this.rate=1;}}
 nextPresent(){for(const it of this.items)if(!it.done&&it!==this.cur&&it.present)return it;return null;}
 startItem(it){if(it.kind==='kickoff'&&!it.tr){it.tr=this.o.kickoff(it.k,this);if(!it.tr){it.done=true;return;}}
  this.cur=it;it.done=true;this.state='present';if(it.kind!=='kickoff')this.lastShown=it;
  let t0=it.startT||0;const lag=this.clock-it.start;
  if(!it.shoot&&lag>0&&it.tr){const ap=it.tr.applyAt??t0;const nt=Math.min(t0+lag,Math.max(t0,ap-3));it.start+=nt-t0;t0=nt;}
  it.t0=t0;this.t=t0;if(it.kind==='event'&&it.ev.kind==='card')this.lastCardAt=it.ev.clock;this.log.push({kind:it.kind,id:it.ev?it.ev.id:'ko',start:it.start,clock:this.clock,real:this.real});
  if(this.o.onStart)this.o.onStart(it);}
 finish(){const it=this.cur;if(it.kind==='event'&&!this.applied.has(it.ev.id))this.apply(it.ev);
  const ev=it.ev;const worth=it.kind==='event'&&this.o.replays!==false&&it.tr&&it.tr.replay&&!it.shoot&&(ev.goal||ev.kind==='save'&&ev.importance>1||ev.kind==='post'||ev.kind==='penalty_miss'||ev.kind==='disallowed');
  if(this.o.onEnd)this.o.onEnd(it,worth);
  if(worth){this.state='replay';this.t=it.tr.replay.t0;return;}
  this.state='idle';this.lastEnd=this.real;this.cur=null;}
 /* pular o lance atual (aplica o efeito; o relógio alcança o instante do lance, sem voltar) */
 skip(){if(this.state==='present'){const it=this.cur;if(it.kind==='event'){this.apply(it.ev);if(!it.shoot)this.clock=Math.max(this.clock,it.key);}this.t=it.tr.duration;this.state='idle';this.lastEnd=this.real;this.cur=null;if(this.o.onEnd)this.o.onEnd(it,false);}
  else if(this.state==='replay'){this.state='idle';this.lastEnd=this.real;this.cur=null;}}
 /* intervalo concluído: começa o próximo período (ou a disputa de pênaltis) */
 resume(){if(this.state!=='break')return;E().startNextPeriod(this.m);if(this.m.phase!=='shootout')this.clock=this.m.clock;this.rate=1;this.state='idle';this.lastEnd=this.real-99;this.pump();}
 /* estado mostrado: última fotografia do motor até o relógio, sem passar por lances ainda não aplicados */
 shown(){const sn=this.m.snaps,Eg=E();const cur=Eg.pIndex(this.m)*1e5+this.clock;let best=sn[0];for(const s of sn){if(s.pi*1e5+s.t>cur+1e-6)break;if(s.ev&&!this.applied.has(s.ev))break;best=s;}return best;}
 periodShown(){const s=this.shown();return s?s.period:'first';}}
PG.Live=Live;
MD.Pacing=PG;
})(typeof window!=='undefined'?(window.MD=window.MD||{}):(globalThis.MD=globalThis.MD||{}));
