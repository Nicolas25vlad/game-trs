/* TRS26 / MATCHDAY 0.6 — MUNDO DE PARTIDA CONTÍNUO (simulação autoritativa).
   Um único estado de jogo para JOGAR, ASSISTIR e MELHORES MOMENTOS:
   - passo fixo de 1/60 s (a física e as decisões não dependem do FPS);
   - bola física (gravidade, quique, atrito de rolagem, efeito/curva, traves, travessão, rede);
   - jogadores com inércia, aceleração, giro, fadiga e atributos;
   - comandos padronizados (MOVE, PASS, SHOOT, CROSS, THROUGH, SPRINT, TACKLE, SLIDE, SWITCH, SKILL, SUPPORT, SHIELD, GK_RUSH)
     vindos de qualquer dispositivo ou da IA — o mundo não sabe de onde vieram;
   - árbitro que decide a partir do que aconteceu fisicamente: gol (bola cruzou a linha por completo), lateral, escanteio,
     tiro de meta, impedimento no momento do passe, faltas de desarmes/carrinhos, vantagem, pênalti, cartões, expulsão;
   - reinícios visíveis e controláveis (saída, lateral, escanteio, tiro de meta, falta com barreira, pênalti, disputa de pênaltis);
   - relógio proporcional à duração escolhida, acréscimos, intervalo, prorrogação;
   - gravação contínua (buffer circular) para replays sem avançar a partida.
   Coordenadas: x ao longo do campo (gols em x=±L), z na largura (laterais em z=±W), y altura. dir=+1 ataca para +x. */
(function(MD){
'use strict';
const U=MD.U,D=MD.Data,clamp=U.clamp,lerp=U.lerp,PI=Math.PI,hyp=Math.hypot;
const W={};MD.World=W;
const DT=W.DT=1/60,G=9.81,BR=W.BALL_R=.11,REC_SECONDS=14;
/* Física (SI: m, s, kg). PHYS fica exposto para os testes e para calibração. */
const PHYS=W.PHYS={
 SUB_STEP:.08,      /* m: a bola anda no máximo isto por subpasso (a zona de colisão da trave tem .17 m antes do centro) */
 SUB_MAX:12,        /* subpassos por passo de 1/60 s (cobre até ~57 m/s) */
 AIR_DRAG:.0075,    /* 1/m: desaceleração do ar = AIR_DRAG·v² */
 ROLL_DEC:2.35,     /* m/s²: atrito de rolagem na grama */
 ROLL_DEC_V:.035,   /* 1/s: parcela do atrito que cresce com a velocidade */
 SPIN_REF:20,       /* m/s: velocidade em que o efeito lateral (spin) vale spin m/s² */
 SPIN_DECAY_AIR:.6, SPIN_DECAY_GROUND:2, GROUND_SPIN:.25,
 BOUNCE:.52, BOUNCE_MIN_VY:1.4, BOUNCE_FRICTION:.86,
 POST_RESTITUTION:.6,
 BODY_R:.3,         /* m: raio do corpo; dois atletas não ficam a menos de 2·BODY_R */
 BACK_SPEED:.58     /* fração da velocidade máxima andando de costas (de lado fica ~.85) */
};
W.ACTIONS=['MOVE','SPRINT','PASS','SHOOT','CROSS','THROUGH','TACKLE','SLIDE','SWITCH','SKILL','SUPPORT','SHIELD','GK_RUSH','PAUSE'];
/* Dificuldade: qualidade de decisão, reação, posicionamento e execução — não velocidade impossível. */
W.DIFFICULTY={
 beginner:{label:'Iniciante',noise:.55,react:.42,pos:.55,exec:1.45,press:.55,gk:.82,tackleSkill:.7},
 amateur:{label:'Amador',noise:.38,react:.32,pos:.75,exec:1.2,press:.75,gk:.9,tackleSkill:.85},
 pro:{label:'Profissional',noise:.24,react:.24,pos:.9,exec:1,press:.95,gk:1,tackleSkill:1},
 star:{label:'Craque',noise:.14,react:.18,pos:1,exec:.88,press:1.08,gk:1.06,tackleSkill:1.1},
 legend:{label:'Lendário',noise:.07,react:.13,pos:1.06,exec:.78,press:1.18,gk:1.12,tackleSkill:1.2}};
W.DURATIONS=[4,6,10,15,20,45,90];
const n01=v=>clamp((Number(v)||50)/100,.05,.99);
const angDiff=(a,b)=>U.wrapAngle(a-b);

class World{
 /* opts: {home, away (clubes), mode:'pro'|'germinare', germ, minutes (duração real), difficulty, knockout, seed, neutral, kits} */
 constructor(home,away,opts){opts=opts||{};this.opts=opts;this.seed=(opts.seed>>>0)||((Math.random()*1e9)>>>0);this.rng=U.rng(this.seed);
  const MO=MD.Modes;this.mode=MO.resolve?MO.resolve(opts.mode||'pro',{germinare:opts.germ||{}}):(opts.mode==='germinare'?MO.GERMINARE:MO.PRO);MO.apply(this.mode);
  this.P=MD.Rules.PITCH;this.small=!!this.P.small;this.prof=MD.Rules.PROFILE||MD.Rules.PROFILE_PRO||{};
  this.offsideOn=this.mode.rules?this.mode.rules.offside!==false:true;this.kickIn=this.mode.rules&&this.mode.rules.restart==='kick';
  this.diff={home:W.DIFFICULTY[opts.difficultyHome||opts.difficulty||'pro']||W.DIFFICULTY.pro,away:W.DIFFICULTY[opts.difficultyAway||opts.difficulty||'pro']||W.DIFFICULTY.pro};
  this.time=0;this.steps=0;this.clock=0;
  const per=MO.periods(this.mode);const ko=opts.knockout;
  this.periods=per.filter(p=>!p.extra||(ko&&(p.golden?!!ko.golden:(!!ko.extraTime&&!ko.golden))));
  this.pi=0;this.added={};this.stoppage=0;
  const regular=this.mode.periodLen*this.mode.periods;
  const realMin=opts.minutes||(this.small?5:10);this.minutes=realMin;
  this.clockRate=regular/(realMin*60);/* segundos de jogo por segundo real */
  this.realLen=realMin*60;
  this.teams=[this.makeTeam(home,'home',0),this.makeTeam(away,'away',1)];
  this.teams[0].dir=1;this.teams[1].dir=-1;
  this.ball={x:0,y:BR,z:0,vx:0,vy:0,vz:0,spin:0,owner:null,last:null,lastTeam:-1,lastKick:null,heading:0,roll:0,px:0,py:BR,pz:0,inNet:false,frozen:false};
  this.score=[0,0];this.pens=null;this.events=[];this.fx=[];this.feed=[];
  this.stats=[0,1].map(()=>({poss:0,shots:0,onTarget:0,xg:0,passes:0,passOk:0,tackles:0,tackleOk:0,fouls:0,yellow:0,red:0,corners:0,offsides:0,saves:0,subs:0,goals:0,throwins:0}));
  this.humans=[];this.phase='pre';this.restart=null;this.stopT=0;this.offsideSnap=null;this.advantage=null;this.pendingCards=[];
  this.ref=this.makeOfficial('ref',0,8);this.ars=[this.makeOfficial('ar1',-this.P.L*.5,-(this.P.W+1.2)),this.makeOfficial('ar2',this.P.L*.5,this.P.W+1.2)];
  this.intended=null;/* passe em andamento: {from, to, t} */
  this.goalLock=0;this.lastGoal=null;this.endReason=null;this.done=false;this.highlights=[];
  this.recInit();
  this.ai=MD.FootballAI?new MD.FootballAI(this):null;
  this.setupKickoff(0,true);}
 /* ---------------- equipes e jogadores ---------------- */
 makeTeam(club,side,idx){const tac={...D.TACTIC_DEFAULT,...(club.tactics||{})};const n=this.mode.players||11;
  const formation=(this.small&&MD.Modes.FORMATIONS_G[tac.formation])?tac.formation:(!this.small&&D.FORMATIONS[tac.formation]?tac.formation:(this.small?'1-2-1':'4-3-3'));
  const slots=D.formationSlots(formation);
  const t={idx,side,club,tactics:{...tac,formation},slots,players:[],bench:[],subsUsed:0,dir:1,human:[],captain:null,takers:club.takers||{},instructions:club.instructions||{},sentOff:0};
  club.players.slice(0,n).forEach((p,i)=>t.players.push(this.makePlayer(p,t,i)));
  t.bench=(D.matchdayBench?D.matchdayBench(club.bench||[]):(club.bench||[]).slice(0,12)).map(p=>({data:p,used:false}));
  const cap=club.captain&&t.players.find(p=>p.id===club.captain);t.captain=cap?cap.id:(t.players.find(p=>p.data.personality==='leader'&&p.group!=='GK')||t.players.slice(1).sort((a,b)=>b.data.rating-a.data.rating)[0]||t.players[0]).id;
  return t;}
 makePlayer(data,t,slot){const s=t.slots[slot]||t.slots[t.slots.length-1];const a={};for(const k of D.ATTR_KEYS)a[k]=n01(data.attrs&&data.attrs[k]);
  const pos=slot===0?'GOL':s.pos;const gk=slot===0;
  const P={id:data.id,data,team:t.idx,side:t.side,slot,pos,group:D.groupOf(pos),gk,a,num:data.number,name:data.name,ovr:data.rating,
   x:0,z:0,px:0,pz:0,vx:0,vz:0,f:0,pf:0,sp:0,dist:0,turn:0,stamina:1,
   act:null,acts:[],emos:[],lock:0,down:0,beaten:0,cool:0,tackleCool:0,touchCool:0,
   yellow:0,red:false,off:false,human:null,cmd:null,pending:null,
   ai:{tx:0,tz:0,role:'shape',next:0,want:null,run:0,mark:null},
   st:{goals:0,assists:0,shots:0,onT:0,passes:0,passOk:0,keyPasses:0,tackles:0,saves:0,fouls:0,dribbles:0,inter:0,rating:6},
   view:null};
  P.instr=(t.instructions||{})[data.id]||'';
  P.view={id:P.id,side:t.side,kind:gk?'keeper':'player',info:{data,energy:1},emos:P.emos,slot};
  return P;}
 makeOfficial(id,x,z){const o={id,x,z,px:x,pz:z,vx:0,vz:0,f:0,pf:0,sp:0,dist:0,act:null,emos:[],off:false,official:true};o.view={id,side:'ref',kind:id==='ref'?'ref':'ar',info:{},emos:o.emos};return o;}
 all(){return this.teams[0].players.concat(this.teams[1].players);}
 onPitch(ti){return this.teams[ti].players.filter(p=>!p.off);}
 opp(ti){return 1-ti;}
 goalX(ti){return this.teams[ti].dir*this.P.L;}/* gol que o time ataca */
 ownGoalX(ti){return -this.teams[ti].dir*this.P.L;}
 rel(ti,x){return this.teams[ti].dir*x;}/* posição no referencial de ataque do time */
 gk(ti){return this.teams[ti].players.find(p=>p.gk&&!p.off)||null;}
 /* ---------------- entradas humanas ---------------- */
 addHuman(h){/* h: {id, side, name, coop?} — cada humano comanda apenas a sua equipe */const ti=h.side==='home'?0:1;const H={id:h.id,ti,name:h.name||h.id,player:null,cmd:emptyCmd(),prev:emptyCmd(),hold:{},power:0,charging:null,device:h.device||h.id,autoSwitch:h.autoSwitch!==false,passAssist:h.passAssist!==false,shotAssist:h.shotAssist!==false};
  this.humans.push(H);this.teams[ti].human.push(H.id);this.pickPlayerFor(H,true);return H;}
 removeHuman(id){const i=this.humans.findIndex(h=>h.id===id);if(i<0)return;const H=this.humans[i];if(H.player)H.player.human=null;this.humans.splice(i,1);const t=this.teams[H.ti];t.human=t.human.filter(x=>x!==id);}
 human(id){return this.humans.find(h=>h.id===id)||null;}
 setCommand(id,cmd){const H=this.human(id);if(!H)return;H.cmd=cmd;}
 clearCommands(id){const H=this.human(id);if(H){H.cmd=emptyCmd();H.charging=null;}}
 controlled(H,P){if(H.player===P)return;if(P&&P.human&&P.human!==H.id){return;}if(H.player)H.player.human=null;H.player=P;if(P){P.human=H.id;P.ai.want=null;}}
 /* escolhe o melhor atleta para o humano: portador, receptor do passe ou o mais próximo da bola (sem roubar o do parceiro de equipe) */
 pickPlayerFor(H,force,dirx,dirz){const ti=H.ti;const b=this.ball;const cands=this.onPitch(ti).filter(p=>!p.human||p.human===H.id);
  if(!cands.length)return;const own=b.owner&&b.owner.team===ti?b.owner:null;
  if(own&&(!own.human||own.human===H.id)&&!own.gk){this.controlled(H,own);return;}
  let best=null,bs=1e9;const field=cands.filter(p=>!p.gk);const list=field.length?field:cands;
  for(const p of list){if(p===H.player&&!force)continue;let s=hyp(p.x-b.x,p.z-b.z);
   if(this.intended&&this.intended.to===p&&this.intended.team===ti)s-=30;
   if(dirx!==undefined&&(dirx||dirz)){const dx=p.x-b.x,dz=p.z-b.z,l=hyp(dx,dz)||1;s-=((dx*dirx+dz*dirz)/l)*6;}
   if(p.down>this.time)s+=8;if(s<bs){bs=s;best=p;}}
  if(best)this.controlled(H,best);}
 /* ---------------- passo de simulação ---------------- */
 step(){if(this.done)return;const t=this.time;this.steps++;this.time+=DT;
  for(const p of this.all()){p.px=p.x;p.pz=p.z;p.pf=p.f;}const b=this.ball;b.px=b.x;b.py=b.y;b.pz=b.z;
  for(const o of [this.ref,...this.ars]){o.px=o.x;o.pz=o.z;o.pf=o.f;}
  /* comandos humanos → intenções padronizadas */
  for(const H of this.humans)this.applyHuman(H);
  /* IA (frequências próprias, escalonadas) */
  if(this.ai)this.ai.update(DT);
  /* fases */
  this.phaseStep();
  /* movimento e física */
  for(const p of this.all())if(!p.off)this.movePlayer(p);
  if(this.phase==='play')this.bodies();
  this.moveOfficials();
  this.ballStep();
  if(this.phase==='play'){this.contacts();this.slideContacts();this.checkBall();if(!(this.pens&&this.pens.active)){this.updateClock();this.possession();}}
  else if((this.phase==='restart'||this.phase==='kickoff'||this.phase==='dead'||this.phase==='goal')&&!this.pens)this.updateClock(true);
  this.fatigue();
  for(const H of this.humans)H.prev=H.cmd;
  this.recFrame();}
 /* ---------------- movimento dos jogadores (inércia, giro, fadiga) ---------------- */
 speeds(p){const a=p.a,fat=.8+.2*p.stamina;return{walk:1.7,jog:3.9+a.pace*.6,run:(5.6+a.pace*1.6)*fat,sprint:(6.9+a.pace*2.4)*fat,acc:(4.6+a.accel*4.2)*(.85+.15*p.stamina),turn:7+a.agility*5};}
 movePlayer(p){const now=this.time;let dx=p.ai.tx-p.x,dz=p.ai.tz-p.z;const S=this.speeds(p);
  let vx=0,vz=0,wantSp=0,wantDir=null;
  if(p.down>now||p.lock>now){/* no chão ou executando ação travada: desacelera (o carrinho mantém o embalo) */const k=p.act&&p.act.clip==='slide'?1.6:6;vx=p.vx*Math.max(0,1-DT*k);vz=p.vz*Math.max(0,1-DT*k);p.vx=vx;p.vz=vz;}
  else{let want=p.ai.want;/* {vx,vz} velocidade desejada (humano/IA); senão vai ao alvo */
   if(!want){const d=hyp(dx,dz);const urgency=p.ai.speed||'jog';const top=urgency==='sprint'?S.sprint:urgency==='run'?S.run:urgency==='walk'?S.walk:S.jog;
    const sp=d<.35?0:Math.min(top,d*2.2);want={vx:d>0?dx/d*sp:0,vz:d>0?dz/d*sp:0};}
   want={vx:want.vx,vz:want.vz};/* cópia: os limites abaixo não podem alterar a intenção guardada pela IA */
   let wv=hyp(want.vx,want.vz);const owner=this.ball.owner===p;const capF=owner?(.86+.08*p.a.dribbling):1;const cap=S.sprint*capF;if(wv>cap){want.vx*=cap/wv;want.vz*=cap/wv;wv=cap;}
   wantSp=wv;if(wv>.5){wantDir=Math.atan2(want.vz,want.vx);
    /* de lado ou de costas não se corre como de frente: 100% de frente, ~85% de lado, BACK_SPEED de costas */
    const off=Math.abs(angDiff(wantDir,p.f)),dc=S.sprint*(1-(1-PHYS.BACK_SPEED)*U.smooth((off-.5)/(PI-.5)));if(wv>dc){want.vx*=dc/wv;want.vz*=dc/wv;wv=dc;}}
   /* aceleração limitada: inércia; frear é mais rápido que acelerar */
   const ddx=want.vx-p.vx,ddz=want.vz-p.vz,dl=hyp(ddx,ddz);const braking=wv<p.sp-.3;const amax=S.acc*(braking?1.6:1)*DT;
   if(dl>amax){p.vx+=ddx/dl*amax;p.vz+=ddz/dl*amax;}else{p.vx=want.vx;p.vz=want.vz;}}
  p.x+=p.vx*DT;p.z+=p.vz*DT;p.sp=hyp(p.vx,p.vz);p.dist+=p.sp*DT;
  /* limites (fora do campo só até a área técnica) */const L=this.P.L,Wd=this.P.W;p.x=clamp(p.x,-L-4,L+4);p.z=clamp(p.z,-Wd-3,Wd+3);
  /* orientação: corpo segue o movimento; parado, olha para a bola ou para o alvo de ação */
  /* quem precisa correr forte para longe de onde olha vira e corre, em vez de ir de costas */
  const face=p.ai.face!==undefined&&p.ai.face!==null&&!(wantDir!==null&&wantSp>S.run*.8&&Math.abs(angDiff(p.ai.face,wantDir))>1.9);
  let tf=p.f;if(face)tf=p.ai.face;else if(p.sp>.6)tf=Math.atan2(p.vz,p.vx);else tf=Math.atan2(this.ball.z-p.z,this.ball.x-p.x);
  const rate=(p.sp>6.5?S.turn*.55:S.turn)*(this.ball.owner===p?.8:1)*DT;const d=angDiff(tf,p.f);p.f=U.wrapAngle(p.f+clamp(d,-rate,rate));p.turn=clamp(d,-rate,rate)/DT;
  if(p.act&&now>p.act.t1)p.act=null;}
 /* Corpos: dois atletas não ficam a menos de 2·BODY_R. A sobreposição é desfeita pela massa (força, equilíbrio,
    proteção de bola) e a velocidade de aproximação some no choque (inelástico): quem é mais forte cede menos. */
 bodies(){const now=this.time,R2=PHYS.BODY_R*2,ps=this._bodies||(this._bodies=[]);ps.length=0;
  for(const p of this.all())if(!p.off&&!(p.down>now))ps.push(p);
  for(let i=0;i<ps.length;i++){const a=ps[i];for(let j=i+1;j<ps.length;j++){const c=ps[j];let dx=c.x-a.x,dz=c.z-a.z;
   if(dx>=R2||dx<=-R2||dz>=R2||dz<=-R2)continue;let d=hyp(dx,dz);if(d>=R2)continue;
   let pen=R2-d;if(d<1e-6){dx=Math.cos(a.f);dz=Math.sin(a.f);d=1;pen=R2;}/* mesmo ponto: separa pela frente de a (determinístico) */
   const nx=dx/d,nz=dz/d,ma=this.bodyMass(a),mc=this.bodyMass(c),sa=mc/(ma+mc),sc=ma/(ma+mc);
   a.x-=nx*pen*sa;a.z-=nz*pen*sa;c.x+=nx*pen*sc;c.z+=nz*pen*sc;
   const vn=(c.vx-a.vx)*nx+(c.vz-a.vz)*nz;if(vn<0){const J=-vn/(1/ma+1/mc);a.vx-=J/ma*nx;a.vz-=J/ma*nz;c.vx+=J/mc*nx;c.vz+=J/mc*nz;a.sp=hyp(a.vx,a.vz);c.sp=hyp(c.vx,c.vz);}}}}
 bodyMass(p){return(68+24*p.a.strength+8*p.a.balance)*(p.shield>this.time?1.35:1);}
 moveOfficials(){const b=this.ball,L=this.P.L,Wd=this.P.W;const r=this.ref;
  const tx=clamp(b.x-8*Math.sign(b.x||1)*.4,-L+8,L-8),tz=clamp(b.z*.5-10*Math.sign(b.z||1)*.5+ (b.z>0?-6:6),-Wd+4,Wd-4);
  goTo(r,tx,tz,this.phase==='play'?6:4);
  /* assistentes acompanham a linha de impedimento em sua metade */
  for(let i=0;i<2;i++){const a=this.ars[i];const half=i===0?-1:1;let lx=this.offsideLine(half);a.ai_tx=clamp(lx,half<0?-L:0,half<0?0:L);goTo(a,a.ai_tx,a.z,6.5);}
  for(const o of [r,...this.ars]){o.f=o.sp>.5?Math.atan2(o.vz,o.vx):Math.atan2(b.z-o.z,b.x-o.x);if(o.act&&this.time>o.act.t1)o.act=null;}}
 /* linha de impedimento do lado (half=-1 → x<0): penúltimo defensor do time que defende aquele gol */
 offsideLine(half){const ti=this.teams[0].dir===half?1:0;/* time que defende o gol em x=half*L */const xs=this.onPitch(ti).map(p=>p.x*half).sort((a,b)=>b-a);const second=xs.length>1?xs[1]:0;return half*Math.max(second,this.ball.x*half,0);}
 fatigue(){const k=1/Math.max(240,this.realLen);for(const p of this.all()){if(p.off)continue;const S=p.sp;const st=.4+.6*(1-p.a.stamina);let d=S>7?3.2:S>5?1.5:S>3?.55:-.35;p.stamina=clamp(p.stamina-d*k*st*DT*.9,0,1);p.view.info.energy=p.stamina;}}
 /* ---------------- física da bola ---------------- */
 /* Subpassos: a bola nunca anda mais que PHYS.SUB_STEP por vez, então um chute forte não atravessa trave nem travessão,
    e o ponto exato em que ela cruza a linha de fundo fica registrado em b.cross (usado para decidir o gol). */
 ballStep(){const b=this.ball;b.cross=null;if(b.frozen)return;
  if(b.owner){const o=b.owner;this.dribbleBall(o);b.heading=o.f;return;}
  const n=Math.min(PHYS.SUB_MAX,Math.max(1,Math.ceil(hyp(b.vx,b.vy,b.vz)*DT/PHYS.SUB_STEP))),h=DT/n;
  for(let i=0;i<n;i++){const x0=b.x,y0=b.y,z0=b.z;this.ballIntegrate(h);this.lineCross(x0,y0,z0);this.goalFrame();}
  const hs=hyp(b.vx,b.vz);if(hs>.05)b.heading=Math.atan2(b.vz,b.vx);b.roll+=hs*DT/BR;}
 /* Um subpasso de bola livre (Euler semi-implícito).
    Efeito lateral (spin) e vertical (topspin > 0 desce, < 0 sustenta) seguem a força de Magnus, proporcional à velocidade:
    a curva gira a direção a uma taxa fixa (spin/SPIN_REF rad/s), então bola lenta curva menos em metros, como na vida real.
    b: a bola do jogo ou uma cópia {x,y,z,vx,vy,vz,spin,topspin} — a IA prevê trajetórias com esta mesma função. */
 ballIntegrate(h,b){const real=!b;b=b||this.ball;
  const air=b.y>BR+.005||b.vy>.05;
  if(air){b.vy-=G*h;const sp=hyp(b.vx,b.vy,b.vz);const k=Math.max(0,1-PHYS.AIR_DRAG*sp*h);b.vx*=k;b.vy*=k;b.vz*=k;
   if(b.spin)this.turnBall(b.spin*h/PHYS.SPIN_REF,b),b.spin*=1-h*PHYS.SPIN_DECAY_AIR;
   if(b.topspin){b.vy-=b.topspin*hyp(b.vx,b.vz)/PHYS.SPIN_REF*h;b.topspin*=1-h*PHYS.SPIN_DECAY_AIR;}}
  else{const s=hyp(b.vx,b.vz);if(s>0){const ns=Math.max(0,s-(PHYS.ROLL_DEC+PHYS.ROLL_DEC_V*s)*h);b.vx*=ns/s;b.vz*=ns/s;}b.vy=0;b.y=BR;b.topspin=0;
   if(b.spin)this.turnBall(b.spin*PHYS.GROUND_SPIN*h/PHYS.SPIN_REF,b),b.spin*=1-h*PHYS.SPIN_DECAY_GROUND;}
  b.x+=b.vx*h;b.y+=b.vy*h;b.z+=b.vz*h;
  if(b.y<BR){b.y=BR;if(b.vy<-PHYS.BOUNCE_MIN_VY){b.vy=-b.vy*PHYS.BOUNCE;b.vx*=PHYS.BOUNCE_FRICTION;b.vz*=PHYS.BOUNCE_FRICTION;b.topspin=(b.topspin||0)*.5;if(real)this.fxAdd('bounce',{k:Math.min(1,-b.vy/8)});}else b.vy=0;}}
 /* cópia do estado da bola livre, para prever a trajetória sem mexer no jogo */
 ballCopy(){const b=this.ball;return{x:b.x,y:b.y,z:b.z,vx:b.vx,vy:b.vy,vz:b.vz,spin:b.spin||0,topspin:b.topspin||0};}
 /* gira a velocidade horizontal da bola em a radianos (sem ganhar nem perder energia) */
 turnBall(a,b){b=b||this.ball;const c=Math.cos(a),s=Math.sin(a),vx=b.vx;b.vx=vx*c-b.vz*s;b.vz=vx*s+b.vz*c;}
 /* guarda onde a bola (centro) cruzou a linha de fundo neste passo: a regra olha a bola inteira além da linha */
 lineCross(x0,y0,z0){const b=this.ball,lim=this.P.L+BR;if(b.cross||Math.abs(x0)>lim||Math.abs(b.x)<=lim)return;
  const gx=Math.sign(b.x)*lim,t=(gx-x0)/((b.x-x0)||1e-9);b.cross={x:gx,y:y0+(b.y-y0)*t,z:z0+(b.z-z0)*t};}
 /* condução: assistência de domínio com mola (a bola segue física, mas acompanha o pé), toques longos em velocidade */
 dribbleBall(p){const b=this.ball;const now=this.time;const ahead=.42+Math.min(.55,p.sp*.07);const ax=p.x+Math.cos(p.f)*ahead,az=p.z+Math.sin(p.f)*ahead;
  const ctl=p.a.ballControl*.6+p.a.dribbling*.4;
  /* em sprint, a bola é tocada à frente e fica solta por um instante (pode ser roubada) */
  if(p.sp>6.6&&now>p.touchCool&&!p.gk&&(this.phase==='play')){const push=1.22+(1-ctl)*.35;b.owner=null;b.vx=p.vx*push;b.vz=p.vz*push;b.y=BR;b.vy=0;p.touchCool=now+.42+ctl*.35;b.lastTouchT=now;this.fxAdd('touch',{});return;}
  const k=12+ctl*10;b.vx=p.vx+(ax-b.x)*k;b.vz=p.vz+(az-b.z)*k;b.vy=0;b.y=BR;b.x+=b.vx*DT;b.z+=b.vz*DT;b.roll+=hyp(b.vx,b.vz)*DT/BR;
  if(p.gk&&this.gkHolding===p){b.x=p.x+Math.cos(p.f)*.3;b.z=p.z+Math.sin(p.f)*.3;b.y=1.05;b.vx=b.vz=0;}}
 /* traves, travessão e rede */
 goalFrame(){const b=this.ball,P=this.P,L=P.L,gw=P.goalHalfW,gh=P.goalH,rp=.06+BR;
  for(const s of [-1,1]){const gx=s*L;if(Math.abs(b.x-gx)>2.2)continue;
   for(const pz of [-gw,gw]){const dx=b.x-gx,dz=b.z-pz;const d=hyp(dx,dz);if(d<rp&&b.y<gh+.06){const nx=dx/d,nz=dz/d;const vn=b.vx*nx+b.vz*nz;if(vn<0){const e=1+PHYS.POST_RESTITUTION;b.vx-=e*vn*nx;b.vz-=e*vn*nz;b.x=gx+nx*rp;b.z=pz+nz*rp;this.fxAdd('post',{});this.event('post',{});}}}
   if(Math.abs(b.z)<gw){const dx=b.x-gx,dy=b.y-gh;const d=hyp(dx,dy);if(d<rp){const nx=dx/d,ny=dy/d;const vn=b.vx*nx+b.vy*ny;if(vn<0){const e=1+PHYS.POST_RESTITUTION;b.vx-=e*vn*nx;b.vy-=e*vn*ny;b.x=gx+nx*rp;b.y=gh+ny*rp;this.fxAdd('post',{bar:true});this.event('post',{bar:true});}}}
   /* rede: bola dentro do gol perde energia e fica contida */
   if(s*b.x>L&&Math.abs(b.z)<gw+.2&&b.y<gh+.1&&b.inNet){const nd=P.netDepth||1.8;if(s*b.x>L+nd-BR){b.x=s*(L+nd-BR);b.vx*=-.15;b.vz*=.5;}if(Math.abs(b.z)>gw-BR){b.z=Math.sign(b.z)*(gw-BR);b.vz*=-.2;}if(b.y>gh-BR){b.y=gh-BR;b.vy*=-.1;}}}}
 /* ---------------- contatos: domínio, disputas, cabeceios, defesas ---------------- */
 contacts(){const b=this.ball,now=this.time;if(b.owner||b.frozen)return;if(this.restart)return;
  let best=null,bd=1e9;const all=this.all();
  const k=b.lastKick;const shotLive=k&&k.shot&&now-k.t<2.2&&b.lastTeam===k.team;
  for(const p of all){if(p.off||p.down>now||p.touchCool>now)continue;if(p.gk&&shotLive&&k.team!==p.team&&!(this.save&&this.save.gk===p&&this.save.ok))continue;if(p.lock>now&&!(p.act&&p.act.clip==='slide'))continue;
   const fx=p.x+Math.cos(p.f)*.28,fz=p.z+Math.sin(p.f)*.28;const d=hyp(b.x-fx,b.z-fz);const reach=.62+p.a.agility*.25+(p.gk&&this.inOwnBox(p,b.x,b.z)?.55:0);
   const hmax=p.gk&&this.inOwnBox(p,b.x,b.z)?2.35:(p.pending&&/header|shot|volley|bicycle/.test(p.pending.kind)?2.3:.95);
   if(d<reach&&b.y<hmax&&d<bd){bd=d;best=p;}}
  if(!best)return;this.touch(best);}
 touch(p){const b=this.ball,now=this.time;const rv=hyp(b.vx-p.vx,b.vz-p.vz,b.vy);
  /* impedimento: o próximo toque de um atleta marcado na hora do passe */
  if(this.offsideSnap&&this.offsideOn){const s=this.offsideSnap;if(p.team===s.team&&s.ids.has(p.id)&&p!==s.from){this.callOffside(p);return;}if(p.team!==s.team||p===s.from)this.offsideSnap=null;else this.offsideSnap=null;}
  /* ação de primeira (passe/chute/cabeceio) armada pelo humano ou IA */
  if(p.pending&&now-p.pending.t<1.1){const pd=p.pending;p.pending=null;
   if(pd.kind==='header'||(b.y>1.1&&/shot|pass|cross/.test(pd.kind))){this.header(p,pd);return;}
   if(/shot/.test(pd.kind)){this.shoot(p,{...pd,first:true});return;}
   if(/pass|through|cross|lob/.test(pd.kind)){this.pass(p,{...pd,first:true});return;}}
  /* goleiro: agarra com as mãos dentro da área (não em recuo de companheiro) */
  if(p.gk&&this.inOwnBox(p,b.x,b.z)&&b.lastTeam!==p.team){const hard=rv>17+p.a.gkReflexes*9;if(!hard||this.rnd()<.35+.4*p.a.gkReflexes){this.gkCatch(p);return;}
   this.parry(p,1);return;}
  /* bola alta: cabeceio/peito */
  if(b.y>1.15&&!p.gk){if(this.ai&&!p.human){this.ai.headerDecision(p);return;}this.header(p,{kind:'header',power:.6,dirx:0,dirz:0});return;}
  /* domínio: bola forte demais escapa (primeiro toque ruim) */
  const lim=8+p.a.ballControl*12;
  if(rv>lim&&this.rnd()<clamp((rv-lim)/10,0,.85)){const k=.35+this.rnd()*.3;b.vx=b.vx*-.25+p.vx*.6+(this.rnd()-.5)*4;b.vz=b.vz*-.25+p.vz*.6+(this.rnd()-.5)*4;b.vy=Math.max(0,b.vy*-.2)+this.rnd()*1.2;b.vx*=k+.5;b.vz*=k+.5;
   this.setLast(p);p.touchCool=now+.3;this.fxAdd('touch',{});return;}
  /* disputa com adversário próximo: força e equilíbrio */
  const rival=this.nearest(this.opp(p.team),b.x,b.z);if(rival&&rival.p.down<=now&&rival.d<.9&&rival.p.lock<=now&&!p.gk){const sp=p.a.strength*.5+p.a.balance*.3+p.a.ballControl*.2,sr=rival.p.a.strength*.5+rival.p.a.balance*.3+rival.p.a.tackling*.2;
   if(this.rnd()<.5+(sr-sp)*.8-.1){this.gain(rival.p,'duel');return;}}
  this.gain(p,rv>6?'receive':'touch');}
 gain(p,how){const b=this.ball,now=this.time,prevTeam=b.lastTeam,prev=b.last;b.owner=p;b.spin=0;b.topspin=0;this.setLast(p);b.inNet=false;
  if(this.intended){const it=this.intended;if(it.team===p.team&&prev&&prev.team===p.team&&prev!==p){this.stats[p.team].passOk++;prev.st.passOk++;if(it.key)prev.st.keyPasses++;p.lastPassFrom=prev;p.lastPassT=now;}else if(it.team!==p.team){p.st.inter++;}this.intended=null;}
  if(how==='receive'||how==='duel'){p.act={clip:b.y>.6?'chest_control':'receive',t0:now,t1:now+.45,p:{}};}
  if(prevTeam!==p.team&&prevTeam>=0)this.event('turnover',{team:p.team,pid:p.id});
  /* advantage: equipe que sofreu falta manteve a bola */
  if(this.advantage&&p.team!==this.advantage.offTeam&&now-this.advantage.t<2){this.advantage.kept=true;}
  /* humano: troca automática para quem recebe */
  for(const H of this.humans)if(H.ti===p.team&&H.autoSwitch&&!p.human&&!p.gk){const other=this.humans.find(x=>x!==H&&x.ti===H.ti);if(!other||other.player!==p)this.controlled(H,p);break;}}
 setLast(p){const b=this.ball;b.last=p;b.lastTeam=p.team;b.lastTouchT=this.time;}
 nearest(ti,x,z,excl){let bp=null,bd=1e9;for(const p of this.teams[ti].players){if(p.off||p===excl)continue;const d=hyp(p.x-x,p.z-z);if(d<bd){bd=d;bp=p;}}return bp?{p:bp,d:bd}:null;}
 pressureOn(p){const n=this.nearest(this.opp(p.team),p.x,p.z);return n?clamp(1-(n.d-.8)/5,0,1):0;}
 inBox(endSign,x,z){const P=this.P;return endSign*x>P.L-P.boxDepth&&Math.abs(z)<P.boxHalfW&&endSign*x<=P.L+.3;}
 inOwnBox(p,x,z){return this.inBox(-this.teams[p.team].dir,x,z);}
 /* ---------------- ações (todas validadas aqui; vêm do humano ou da IA) ---------------- */
 /* passe: kind ground|through|lob|cross|long; alvo (to|x,z) ou direção; power 0..1 */
 pass(p,o){const b=this.ball,now=this.time;let y0Hands=false;if(b.owner!==p&&!o.first&&!o.throwIn&&!o.set)return false;
  let tx=o.x,tz=o.z,to=o.to||null;const kind=o.kind||'ground';
  if(tx===undefined){const dir=o.dirx||o.dirz?Math.atan2(o.dirz,o.dirx):p.f;const pick=this.passTarget(p,dir,kind,o.assist!==false,o.power);to=pick.to;tx=pick.x;tz=pick.z;}
  else if(to&&kind==='through'){const lead=this.leadPoint(p,to,kind);tx=lead.x;tz=lead.z;}
  if(this.gkHolding===p){this.gkHolding=null;y0Hands=true;}
  const d=Math.max(1,hyp(tx-b.x,tz-b.z));const pressure=this.pressureOn(p);const ex=this.execMul(p);
  const body=Math.abs(angDiff(Math.atan2(tz-b.z,tx-b.x),p.f));
  const skill=kind==='cross'?(p.a.passing*.6+p.a.vision*.1+.3*p.a.dribbling):p.a.passing*.75+p.a.vision*.25;
  let err=((1-skill)*.085+pressure*.05+clamp(body-.6,0,2)*.03+(o.first?.035:0)+(d>35?.02:0))*ex;if(o.throwIn)err*=.5;
  const ang=Math.atan2(tz-b.z,tx-b.x)+this.gauss()*err;const lenErr=1+this.gauss()*err*.9;
  let vh,vy=0,y0=o.throwIn?2.0:y0Hands&&o.kind==='ground'?1.2:BR;
  if(kind==='ground'||kind==='through'){const ve=kind==='through'?2.8:5.6;vh=Math.sqrt(ve*ve+2*2.9*d*lenErr);if(o.power!==undefined&&!o.assistPower)vh*=lerp(.75,1.25,o.power);vh=Math.min(vh,28);}
  else{const T=clamp((kind==='cross'?.75:.6)+d/(kind==='long'?24:21),.7,2.6);vh=d*lenErr/T*(1+.0065*d);vy=G*T/2-(y0-BR)/T;if(kind==='cross'&&o.low){vy*=.45;vh*=1.12;}}
  if(o.throwIn){vh=Math.min(vh,o.long?17:13);}
  b.owner=null;b.x=o.throwIn?b.x:b.x;b.y=y0;b.vx=Math.cos(ang)*vh;b.vz=Math.sin(ang)*vh;b.vy=vy;b.spin=(kind==='cross'?(this.gauss()*1.2+(o.curl||0)):0);b.topspin=0;this.setLast(p);b.lastKick={by:p.id,team:p.team,t:now,kind};
  p.touchCool=now+.28;p.lock=now+(o.throwIn?.6:.22);p.act={clip:o.throwIn?'throw_in':o.first?'pass_first':kind==='cross'?'cross':kind==='long'||kind==='lob'?'pass_long':'pass',t0:now,t1:now+(o.throwIn?.9:.55),p:{}};
  this.stats[p.team].passes++;p.st.passes++;this.intended={from:p,to,team:p.team,t:now,kind,x:tx,z:tz,key:to&&this.rel(p.team,tz)>0&&this.rel(p.team,tx)>this.P.L*.55};
  if(to){to.ai.recvT=now;to.ai.recvX=tx;to.ai.recvZ=tz;}
  this.snapOffside(p,o.throwIn||o.set==='corner'||o.set==='goalkick');this.fxAdd('kick',{power:vh/28});
  /* humano: troca para o receptor (como nos jogos de futebol) */
  for(const H of this.humans)if(H.player===p&&to&&!to.human){this.controlled(H,to);}
  if(o.oneTwo&&to){to.ai.oneTwo={back:p,t:now};}
  return true;}
 /* escolha do receptor (assistência de passe): companheiro no cone da direção, ponderando distância e marcação */
 passTarget(p,dir,kind,assist,power,wide){const mates=this.onPitch(p.team).filter(q=>q!==p);let best=null,bs=-1e9;const b=this.ball;
  for(const q of mates){const dx=q.x-b.x,dz=q.z-b.z,d=hyp(dx,dz);if(d<3)continue;const a=Math.abs(angDiff(Math.atan2(dz,dx),dir))*(wide?.25:1);if(a>(assist?1.05:.45))continue;
   const want=kind==='through'?24:kind==='cross'||kind==='long'||kind==='lob'?30:power!==undefined?8+power*30:14;
   const free=this.nearest(this.opp(p.team),q.x,q.z);let s=-a*16-Math.abs(d-want)*.35+(free?Math.min(free.d,6):6)*1.1+(q.gk?-14:0);
   if(kind==='cross')s+=this.inBox(this.teams[p.team].dir,q.x,q.z)?14:-8;
   if(s>bs){bs=s;best=q;}}
  if(!best&&assist&&!wide)return this.passTarget(p,dir,kind,assist,power,true);/* nada no cone: melhor companheiro disponível (ex.: saída de bola) */
  if(best&&assist){const lp=kind==='through'?this.leadPoint(p,best,kind):{x:best.x+best.vx*.35,z:best.z+best.vz*.35};return{to:best,x:lp.x,z:lp.z};}
  const dist=kind==='ground'?8+(power??.4)*30:kind==='through'?20+(power??.5)*18:18+(power??.5)*30;return{to:null,x:b.x+Math.cos(dir)*dist,z:b.z+Math.sin(dir)*dist};}
 leadPoint(p,q,kind){const b=this.ball;const d=hyp(q.x-b.x,q.z-b.z);const T=kind==='through'?.55+d/16:.4+d/20;const dirA=this.teams[q.team].dir;
  let lx=q.x+q.vx*T*.9+(kind==='through'?dirA*Math.min(7,2.5+q.a.pace*5)*(this.small?.5:1):0),lz=q.z+q.vz*T*.9;const L=this.P.L,Wd=this.P.W;const lim=L-(this.small?2.5:7.5);if(dirA*lx>lim)lx=dirA*lim;return{x:clamp(lx,-L+1,L-1),z:clamp(lz,-Wd+1.5,Wd-1.5)};}
 /* chute: aim {dirx,dirz} (ajuste lateral/altura), power 0..1, kind: shot|placed|low|chip|first */
 shoot(p,o){const b=this.ball,now=this.time;if(b.owner!==p&&!o.first&&!o.set)return false;const P=this.P;const ti=p.team,gx=this.goalX(ti),sgn=Math.sign(gx);
  let aimZ,aimY;const kind=o.kind==='shot'?'shot':o.kind||'shot';const power=clamp(o.power??.7,0,1);
  /* alvo: com assistência, canto mais distante do goleiro; a direção ajusta o lado */
  const gk=this.gk(this.opp(ti));let side;if(o.dirz||o.dirx){const lat=o.dirz*(sgn>0?1:1);side=Math.abs(o.dirz)>.25?Math.sign(o.dirz):(gk?-Math.sign(gk.z-b.z*.2||1):1);}else side=gk?(gk.z>b.z*.15?-1:1):(b.z>0?-1:1);
  aimZ=side*(P.goalHalfW*(.5+.32*(p.a.finishing*.6+p.a.composure*.4)));aimY=kind==='low'?.25:kind==='chip'?P.goalH*.75:kind==='placed'?P.goalH*.55:P.goalH*(.25+power*.42);
  if(this.prof&&!o.assist&&o.manualAim){aimZ=clamp(o.manualAim.z,-P.goalHalfW-1,P.goalHalfW+1);}
  const tx=gx+sgn*.3,d=hyp(tx-b.x,aimZ-b.z);const ex=this.execMul(p);const pressure=this.pressureOn(p);
  const fin=p.a.finishing*.7+p.a.composure*.3;const body=Math.abs(angDiff(Math.atan2(aimZ-b.z,tx-b.x),p.f));
  let v=kind==='chip'?clamp(9+d*.35,10,19):kind==='placed'?14+power*8:kind==='low'?15+power*10:15+power*14*(.8+.2*p.a.strength);
  let err=((1-fin)*.13+.038+pressure*.07+clamp(body-.7,0,2)*.05+(o.first?.035:0)+(b.y>.5?.05:0)+d*.0016+(kind==='placed'?-.01:0))*ex;
  let errY=err*1.05+Math.max(0,power-.8)*.38*(1.2-fin);/* força demais: bola por cima */
  const ang=Math.atan2(aimZ-b.z,tx-b.x)+this.gauss()*err;
  let T;if(kind==='chip'){T=clamp(.9+d/30,1,1.6);v=d/T;}else T=d/v;
  const ty=aimY+this.gauss()*errY*d*.9;
  /* efeito vertical: chute forte com topspin (cai), cavadinha com backspin (flutua); a mira já conta com ele */
  const top=kind==='chip'?-2:kind==='low'?0:kind==='placed'?.8:2.6*power;const gEff=G+top*v/PHYS.SPIN_REF*(1-.3*Math.min(T,1.5));
  let vy=(ty-b.y)/T+gEff*T/2;if(kind==='low')vy=Math.min(vy,1.5);
  b.owner=null;b.vx=Math.cos(ang)*v;b.vz=Math.sin(ang)*v;b.vy=vy;b.spin=kind==='placed'?-side*sgn*(2.4+p.a.dribbling*1.5)*(this.rnd()<.5?1:.6):this.gauss()*.6;b.topspin=top;
  this.setLast(p);b.lastKick={by:p.id,team:ti,t:now,kind:'shot',shot:true,xg:this.xg(p,b.x,b.z)};
  p.touchCool=now+.35;p.lock=now+.32;p.act={clip:o.first?(b.y>.45?'volley':'shot_first'):kind==='chip'?'chip':kind==='placed'?'shot_placed':kind==='low'?'shot_low':'shot_power',t0:now,t1:now+.75,p:{}};
  this.stats[ti].shots++;p.st.shots++;this.stats[ti].xg+=b.lastKick.xg;this.intended=null;this.snapOffside(p);
  this.fxAdd('kick',{power:Math.min(1,v/30),shot:true});this.event('shot',{team:ti,pid:p.id,xg:b.lastKick.xg});
  if(this.ai)this.ai.onShot(p);return true;}
 header(p,o){const b=this.ball,now=this.time;const ti=p.team,gx=this.goalX(ti),sgn=Math.sign(gx);const dGoal=hyp(gx-b.x,b.z);
  const toGoal=dGoal<(this.small?12:20)&&this.rel(ti,b.x)>0;let ang,v,vy;const hq=p.a.heading*.7+p.a.jumping*.3;const ex=this.execMul(p);
  if(toGoal||o.kind==='shot'){const gk=this.gk(this.opp(ti));const side=gk?(gk.z>b.z*.1?-1:1):1;const az=side*(this.P.goalHalfW-.5);ang=Math.atan2(az-b.z,gx-b.x)+this.gauss()*((1-hq)*.12+.04)*ex;v=9+hq*8;const T=dGoal/v;vy=(.6-b.y)/T+G*T/2+this.gauss()*.8;
   this.stats[ti].shots++;p.st.shots++;b.lastKick={by:p.id,team:ti,t:now,kind:'shot',shot:true,header:true,xg:this.xg(p,b.x,b.z)*.7};this.stats[ti].xg+=b.lastKick.xg;this.event('shot',{team:ti,pid:p.id,header:true});}
  else{const pick=o.dirx||o.dirz?this.passTarget(p,Math.atan2(o.dirz,o.dirx),'lob',true):this.passTarget(p,Math.atan2(b.z*-.3,this.teams[ti].dir),'lob',true);
   ang=Math.atan2(pick.z-b.z,pick.x-b.x)+this.gauss()*((1-hq)*.2+.06);v=7+hq*6;vy=2.5;b.lastKick={by:p.id,team:ti,t:now,kind:'header'};this.intended={from:p,to:pick.to,team:ti,t:now,kind:'header'};}
  b.owner=null;b.vx=Math.cos(ang)*v;b.vz=Math.sin(ang)*v;b.vy=vy;b.spin=0;b.topspin=0;this.setLast(p);p.touchCool=now+.4;p.lock=now+.45;
  p.act={clip:b.y>1.9?'jump_header':'header',t0:now-.15,t1:now+.75,p:{}};this.fxAdd('header',{});this.snapOffside(p);}
 /* desarme em pé: chance pelo atributo, ângulo e timing; pode virar falta */
 tackle(p){const now=this.time;if(p.tackleCool>now||p.down>now||p.lock>now)return false;const b=this.ball;const c=b.owner;p.tackleCool=now+.55;
  const d=hyp(b.x-p.x,b.z-p.z);p.act={clip:'tackle',t0:now,t1:now+.55,p:{}};p.lock=now+.32;this.stats[p.team].tackles++;p.st.tackles++;
  if(d>2){/* longe demais: errou o bote */p.lock=now+.55;return true;}
  if(!c||c.team===p.team){/* bola solta perto: desvia */if(d<1.2){this.kickLoose(p,4);}return true;}
  const fromBehind=Math.abs(angDiff(Math.atan2(p.z-c.z,p.x-c.x),c.f))>2.2;const diff=this.diff[this.teams[p.team].side];
  let pr=.5+(p.a.tackling*.65+p.a.marking*.15-c.a.dribbling*.45-c.a.ballControl*.3)*.9-(c.shield>now?.22:0)-(c.sp>5.5?.06:0)+(d<1?.1:0);pr=clamp(pr*(p.human?1:diff.tackleSkill),.08,.88);
  const r=this.rnd();if(fromBehind&&r<.22+p.a.aggression*.15){this.foul(p,c,{kind:'tackle',sev:.45+p.a.aggression*.3});return true;}
  if(r<pr){c.beaten=0;this.stats[p.team].tackleOk++;if(this.rnd()<.55){this.gain(p,'tackle');}else this.kickLoose(p,4.5);c.lock=now+.35;c.act={clip:'stumble',t0:now,t1:now+.6,p:{}};return true;}
  if(r<pr+.05+p.a.aggression*.05){this.foul(p,c,{kind:'tackle',sev:.25+p.a.aggression*.25});return true;}
  p.lock=now+.65;p.beaten=now+.8;p.act={clip:'beaten',t0:now,t1:now+.7,p:{}};return true;}
 /* carrinho: desliza ~0,8 s; toca a bola ou o atleta primeiro (falta, cartão) */
 slide(p){const now=this.time;if(p.down>now||p.lock>now||p.tackleCool>now)return false;const sp=Math.max(p.sp,4.5)+1.2;p.vx=Math.cos(p.f)*sp;p.vz=Math.sin(p.f)*sp;
  p.lock=now+.85;p.down=now+1.35;p.tackleCool=now+1.6;p.act={clip:'slide',t0:now,t1:now+1.2,p:{}};p.sliding={t0:now,hit:false};this.stats[p.team].tackles++;p.st.tackles++;return true;}
 slideContacts(){const now=this.time,b=this.ball;for(const p of this.all()){const s=p.sliding;if(!s||s.hit)continue;if(now-s.t0>.7){p.sliding=null;continue;}if(now-s.t0<.08)continue;
   const fx=p.x+Math.cos(p.f)*.7,fz=p.z+Math.sin(p.f)*.7;const db=hyp(b.x-fx,b.z-fz);const c=b.owner&&b.owner.team!==p.team?b.owner:null;
   const victim=c||this.nearestOppWithin(p,1.05);
   if(db<.95&&b.y<.6){s.hit=true;if(victim&&hyp(victim.x-fx,victim.z-fz)<.5&&this.rnd()<.25+p.a.aggression*.2){this.foul(p,victim,{kind:'slide',sev:.5+p.a.aggression*.3});return;}
    this.stats[p.team].tackleOk++;this.kickLoose(p,6+this.rnd()*4,true);if(c){c.lock=now+.5;c.act={clip:'fall_slide',t0:now,t1:now+1.1,p:{}};c.down=now+.9;}return;}
   if(victim&&hyp(victim.x-fx,victim.z-fz)<.55){s.hit=true;const behind=Math.abs(angDiff(Math.atan2(p.z-victim.z,p.x-victim.x),victim.f))>2.2;this.foul(p,victim,{kind:'slide',sev:.7+(behind?.35:0)+p.a.aggression*.25});return;}}}
 nearestOppWithin(p,r){let best=null,bd=r;for(const q of this.teams[this.opp(p.team)].players){if(q.off)continue;const d=hyp(q.x-p.x,q.z-p.z);if(d<bd){bd=d;best=q;}}return best;}
 kickLoose(p,speed,slide){const b=this.ball;b.owner=null;const a=p.f+this.gauss()*.7;b.vx=Math.cos(a)*speed;b.vz=Math.sin(a)*speed;b.vy=slide?.5:.8+this.rnd();b.spin=0;b.topspin=0;this.setLast(p);p.touchCool=this.time+.25;this.intended=null;this.fxAdd('tackle',{});}
 /* proteção de bola e dribles acionáveis */
 shield(p){p.shield=this.time+.35;}
 skill(p,name,dirx,dirz){const now=this.time,b=this.ball;if(b.owner!==p||p.lock>now||p.skillCool>now)return false;const a=p.a;const sk=a.dribbling*.6+a.ballControl*.25+a.agility*.15;
  const D2={cut:['skill_direction',.45,.15],stepover:['skill_stepover',1.1,.35],bodyfeint:['skill_short',.55,.2],turn:['skill_turn',.75,.3],elastico:['skill_elastico',.6,.55],nutmeg:['skill_nutmeg',.6,.5],
   sombrero:['skill_sombrero',.8,.6],rainbow:['skill_rainbow',.9,.65],drag:['skill_drag',.5,.15],burst:['skill_speed',.45,.25],short:['skill_short',.45,.1],fakeshot:['skill_flick',.6,.3]};
  const def=D2[name]||D2.short;const diff=def[2];p.act={clip:def[0],t0:now,t1:now+def[1],p:{}};p.skillCool=now+def[1]+.15;
  const opp=this.nearest(this.opp(p.team),p.x,p.z);const close=opp&&opp.d<3.2;const success=this.rnd()<clamp(.55+sk*.55-diff*.6-(opp&&close?opp.p.a.marking*.25:0)+(close?0:.25),.08,.95);
  let ang=dirx||dirz?Math.atan2(dirz,dirx):p.f;
  switch(name){case'cut':case'drag':case'turn':case'burst':case'short':{const a2=name==='drag'?p.f+PI:name==='turn'?p.f+PI*.85*(Math.sign(angDiff(ang,p.f))||1):ang;p.f=a2;const v=name==='burst'?Math.max(p.sp,5)+1.6:Math.max(2.2,p.sp*.6);p.vx=Math.cos(a2)*v;p.vz=Math.sin(a2)*v;break;}
   case'nutmeg':case'sombrero':case'rainbow':{if(!close){success&&1;}const v=name==='nutmeg'?7:6;b.owner=null;b.vx=Math.cos(p.f)*v;b.vz=Math.sin(p.f)*v;b.vy=name==='nutmeg'?0:name==='rainbow'?4.6:4.1;this.setLast(p);p.touchCool=now+.25;
    if(success&&opp&&close){opp.p.beaten=now+1.1;opp.p.lock=now+.55;opp.p.act={clip:name==='nutmeg'?'beaten_nutmeg':'beaten',t0:now,t1:now+.8,p:{}};p.st.dribbles++;this.event('skill',{team:p.team,pid:p.id,name});}
    else if(opp&&close&&!success){/* defensor lê o drible */b.vx*=.2;b.vz*=.2;b.vy*=.3;}
    return true;}
   default:/* fintas: o defensor erra o passo se cair na finta */break;}
  if(opp&&close){if(success){opp.p.beaten=now+(name==='stepover'||name==='elastico'||name==='bodyfeint'?.8:.55);opp.p.lock=Math.max(opp.p.lock,now+.35);opp.p.vx+=Math.cos(p.f+PI/2)*2;opp.p.vz+=Math.sin(p.f+PI/2)*2;p.st.dribbles++;this.event('skill',{team:p.team,pid:p.id,name});}
   else if(this.rnd()<.35+opp.p.a.tackling*.3){/* perdeu a bola na tentativa */this.kickLoose(p,3.2);}}
  if(name==='fakeshot'&&opp&&success){opp.p.lock=now+.6;opp.p.act={clip:'block',t0:now,t1:now+.6,p:{}};}
  return true;}
 /* goleiro */
 gkCatch(p){const b=this.ball,now=this.time;b.owner=p;b.vx=b.vy=b.vz=0;b.spin=0;b.topspin=0;this.setLast(p);this.gkHolding=p;this.gkHoldT=now;this.intended=null;this.offsideSnap=null;
  const shot=b.lastKick&&b.lastKick.shot&&b.lastKick.team!==p.team&&now-b.lastKick.t<2.2;if(shot){this.stats[p.team].saves++;p.st.saves++;this.stats[this.opp(p.team)].onTarget++;const sh=this.byId(b.lastKick.by);if(sh)sh.st.onT++;this.event('save',{team:p.team,pid:p.id,catch:true});this.fxAdd('save',{});}
  if(!p.act||!/gk_/.test(p.act.clip))p.act={clip:'gk_catch',t0:now,t1:now+.7,p:{}};p.lock=now+.5;
  for(const H of this.humans)if(H.ti===p.team&&H.player!==p){this.controlled(H,p);}}
 parry(p,k){const b=this.ball,now=this.time;const sgn=Math.sign(b.x)||1;const side=Math.sign(b.z-p.z)||(this.rnd()<.5?-1:1);
  const wide=this.rnd()<.55;b.vx=wide?b.vx*(.25+this.rnd()*.2):-b.vx*(.15+this.rnd()*.15);b.vz=side*(wide?6+this.rnd()*7:3+this.rnd()*5);b.vy=Math.abs(b.vy)*.3+1.5+this.rnd()*3;b.owner=null;b.spin=0;b.topspin=0;this.setLast(p);p.touchCool=now+.4;
  const shot=b.lastKick&&b.lastKick.shot&&b.lastKick.team!==p.team&&now-b.lastKick.t<2.2;if(shot){this.stats[p.team].saves++;p.st.saves++;this.stats[this.opp(p.team)].onTarget++;const sh=this.byId(b.lastKick.by);if(sh)sh.st.onT++;this.event('save',{team:p.team,pid:p.id});this.fxAdd('save',{});}this.intended=null;}
 gkDistribute(p,o){const b=this.ball;if(b.owner!==p)return false;this.gkHolding=null;o=o||{};
  if(o.kind==='throw'){b.y=1.6;const ok=this.pass(p,{...o,kind:'ground',throwIn:false,set:'gk'});p.act={clip:'gk_throw',t0:this.time,t1:this.time+.8,p:{}};return ok;}
  b.y=BR;return this.pass(p,{...o,kind:o.kind||'long'});}
 /* ---------------- regras ---------------- */
 snapOffside(p,exempt){if(!this.offsideOn||exempt){this.offsideSnap=null;return;}const ti=p.team,dir=this.teams[ti].dir;const b=this.ball;
  const defs=this.onPitch(this.opp(ti)).map(q=>q.x*dir).sort((a,c)=>c-a);const second=defs.length>1?defs[1]:-1e9;const line=Math.max(second,b.x*dir);
  const ids=new Set();for(const q of this.onPitch(ti)){if(q===p)continue;const xr=q.x*dir;if(xr>0&&xr>line+.15)ids.add(q.id);}
  this.offsideSnap=ids.size?{team:ti,ids,from:p,t:this.time,x:b.x}:null;}
 callOffside(p){const ti=p.team;this.offsideSnap=null;this.stats[ti].offsides++;this.event('offside',{team:ti,pid:p.id});this.fxAdd('whistle',{});
  const ar=this.ars.find(a=>Math.sign(a.x)===Math.sign(p.x))||this.ars[0];ar.act={clip:'flag_up',t0:this.time,t1:this.time+2,p:{}};
  this.stopPlay({type:'freekick',team:this.opp(ti),x:p.x,z:p.z,indirect:true,reason:'Impedimento'});}
 foul(off,vic,o){const now=this.time,ti=off.team;this.stats[ti].fouls++;off.st.fouls++;
  vic.down=now+1.1;vic.lock=now+1.1;vic.act={clip:o.kind==='slide'?'fall_slide':'fall_trip',t0:now,t1:now+1.4,p:{}};vic.emos.push({e:'pain',t0:now,t1:now+1.5,k:1});
  const x=vic.x,z=vic.z;const pen=this.inBox(-this.teams[ti].dir,x,z);
  /* cartão pela gravidade */let card=null;const r=this.rnd();const sev=o.sev||.3;
  const dogso=this.rel(vic.team,x)>this.P.L*.55&&!pen&&this.onPitch(ti).filter(q=>this.rel(vic.team,q.x)>this.rel(vic.team,x)).length<=1;
  if(sev>1.05&&r<.6||dogso&&r<.55)card='red';else if(r<clamp((sev-.4)*.85,0,.85))card='yellow';
  this.event('foul',{team:ti,pid:off.id,vid:vic.id,pen});
  /* vantagem: fora da área, se o time que sofreu a falta mantém a bola em ataque */
  const b=this.ball;const keep=b.owner&&b.owner.team===vic.team&&b.owner!==vic;if(!pen&&keep&&this.rel(vic.team,b.x)>-5&&!card){this.advantage={t:now,offTeam:ti,x,z};this.ref.act={clip:'advantage',t0:now,t1:now+1.4,p:{}};this.event('advantage',{team:vic.team});return;}
  if(card)this.pendingCards.push({p:off,card});
  this.stopPlay(pen?{type:'penalty',team:vic.team,reason:'Pênalti'}:{type:'freekick',team:vic.team,x,z,direct:true,reason:'Falta'});}
 giveCard(p,color){const now=this.time,ti=p.team;let second=false;if(color==='yellow'){p.yellow++;this.stats[ti].yellow++;if(p.yellow>=2){color='red';second=true;}}
  if(color==='red'){p.red=true;this.stats[ti].red++;}
  this.ref.act={clip:'show_card',t0:now,t1:now+1.8,p:{color}};this.fxAdd('card',{color});this.event('card',{team:ti,pid:p.id,color,second});
  if(color==='red'){p.off=true;p.human&&(()=>{const H=this.human(p.human);p.human=null;if(H){H.player=null;this.pickPlayerFor(H,true);}})();p.x=clamp(p.x,-this.P.L,this.P.L);this.teams[ti].sentOff++;if(this.ai)this.ai.reshape(ti);}}
 stopPlay(r){const now=this.time;this.fxAdd('whistle',{});this.ref.act={clip:r.type==='penalty'?'point_spot':'whistle',t0:now,t1:now+1.2,p:{}};
  this.phase='dead';this.stopT=now;this.pendingRestart=r;this.ball.owner=null;this.intended=null;this.offsideSnap=null;this.gkHolding=null;this.advantage=null;
  if(r.type==='corner')this.stats[r.team].corners++;if(r.type==='throw')this.stats[r.team].throwins++;
  if(r.reason)this.event('stop',{type:r.type,team:r.team,reason:r.reason});
  for(const c of this.pendingCards)this.giveCard(c.p,c.card);this.pendingCards=[];}
 /* bola fora / gol */
 checkBall(){const b=this.ball,P=this.P,L=P.L,Wd=P.W;
  if(this.pens&&this.pens.active){if(Math.abs(b.x)>L+BR&&Math.abs((b.cross||b).z)<P.goalHalfW&&(b.cross||b).y<P.goalH&&!this.pensGoalFlag){this.pensGoalFlag=true;b.inNet=true;this.fxAdd('goal',{side:this.teams[(this.pens.first+this.pens.next)%2].side,at:[b.x,b.y,b.z]});this.fxAdd('net',{at:[b.x,b.y,b.z]});}return;}
  if(this.advantage&&this.time-this.advantage.t>3.5)this.advantage=null;
  if(Math.abs(b.z)>Wd+BR&&Math.abs(b.x)<=L+BR){const ti=b.lastTeam<0?0:this.opp(b.lastTeam);this.stopPlay({type:'throw',team:ti,x:clamp(b.x,-L+.5,L-.5),z:Math.sign(b.z)*Wd,reason:this.kickIn?'Lateral (com os pés)':'Lateral'});return;}
  if(Math.abs(b.x)>L+BR){const end=Math.sign(b.x);const defTi=this.teams[0].dir===end?1:0;/* time que defende este gol */
   const c=b.cross||b;/* onde a bola cruzou a linha, não onde ela está agora */
   if(Math.abs(c.z)<P.goalHalfW&&c.y<P.goalH){if(!this.goalLock)this.goal(this.opp(defTi));return;}
   if(b.lastTeam===defTi){this.stopPlay({type:'corner',team:this.opp(defTi),x:end*L,z:Math.sign(b.z)*Wd,reason:'Escanteio'});}
   else this.stopPlay({type:'goalkick',team:defTi,x:end*(L-(P.sixDepth||5.5)),z:Math.sign(b.z||1)*(P.sixHalfW?P.sixHalfW*.6:5),reason:'Tiro de meta'});
   const k=b.lastKick;if(k&&k.shot&&this.time-k.t<3)this.event('miss',{team:k.team,pid:k.by});}}
 goal(ti){const b=this.ball,now=this.time;this.goalLock=1;b.inNet=true;this.score[ti]++;this.stats[ti].goals++;
  const last=b.last;const own=last&&last.team!==ti;const scorer=own?last:last;let assist=null;
  if(!own&&last&&last.lastPassFrom&&last.lastPassFrom.team===ti&&now-last.lastPassT<12)assist=last.lastPassFrom;
  if(scorer&&!own){scorer.st.goals++;scorer.st.onT++;this.stats[ti].onTarget++;}if(assist)assist.st.assists++;
  const ev=this.event('goal',{team:ti,pid:scorer?scorer.id:null,own,assist:assist?assist.id:null,score:this.score.slice()});this.lastGoal={team:ti,scorer,own,assist,t:now,ev,x:b.x};
  this.fxAdd('goal',{side:this.teams[ti].side,at:[b.x,b.y,b.z]});this.fxAdd('net',{at:[b.x,b.y,b.z]});this.fxAdd('whistle',{});
  this.phase='goal';this.stopT=now;this.ball.owner=null;this.intended=null;this.offsideSnap=null;this.advantage=null;this.pendingCards=[];
  this.highlights.push({type:'goal',t:now,ev});
  if(this.ai)this.ai.celebrate(ti,scorer&&!own?scorer:null);
  this.stoppage+=45;}
 /* posse */
 possession(){const b=this.ball;const ti=b.owner?b.owner.team:b.lastTeam;if(ti>=0)this.stats[ti].poss+=DT;
  /* GK com a bola: se a IA/humano demora muito, distribui */
  if(this.gkHolding&&b.owner===this.gkHolding&&this.time-this.gkHoldT>6){const p=this.gkHolding;if(this.ai)this.ai.gkDistribute(p,true);}
}
 /* ---------------- relógio e períodos ---------------- */
 period(){return this.periods[this.pi];}
 periodEnd(){const p=this.period();return p.start+p.len+(this.added[p.id]||0);}
 updateClock(stopped){const p=this.period();if(!p)return;const rate=this.clockRate;this.clock+=DT*rate;
  if(!this.added[p.id]&&this.clock>p.start+p.len-60&&!p.golden&&this.mode.rules?.addedTime!==false){const base=this.small?0:60+this.stoppage*.7+this.rng()*90;this.added[p.id]=Math.round(clamp(base,60,360)/60)*60;this.stoppage=0;this.event('added',{min:this.added[p.id]/60});}
  if(this.clock>=this.periodEnd()){const b=this.ball;const danger=this.phase==='play'&&b.owner&&this.rel(b.owner.team,b.x)>this.P.L*.55;if(danger&&this.clock<this.periodEnd()+ (this.small?6:40)*rate/1)return;
   if(this.phase==='goal')return;this.endPeriod();}}
 endPeriod(){const p=this.period();this.fxAdd('whistle',{long:true});this.event('period_end',{id:p.id});this.ball.owner=null;this.gkHolding=null;this.restart=null;
  const regEnd=this.pi>=this.mode.periods-1;const level=this.score[0]===this.score[1];const ko=this.opts.knockout;
  if(p.golden||p.id==='et2'||(regEnd&&!p.extra)){if(level&&ko&&this.pi<this.periods.length-1){this.pi++;this.phase='break';this.breakKind='pre_extra';return;}
   if(level&&ko&&ko.shootout!==false){this.phase='break';this.breakKind='pre_shootout';return;}
   this.finish('time');return;}
  this.pi++;this.phase='break';this.breakKind=p.id==='et1'?'extra_half':'half';}
 /* retoma após intervalo (UI chama). Times trocam de lado. */
 resume(){if(this.phase!=='break')return;const k=this.breakKind;this.breakKind=null;
  if(k==='pre_shootout'){this.startShootout();return;}
  const per=this.period();if(per.half==='second'||per.id==='et2'){this.teams[0].dir*=-1;this.teams[1].dir*=-1;}
  const first=per.id==='second'?1:per.id==='et1'?0:per.id==='et2'?1:0;this.clock=per.start;this.setupKickoff(first,true);}
 finish(reason){this.phase='fulltime';this.endReason=reason;this.done=true;this.fxAdd('whistle',{final:true});this.event('fulltime',{score:this.score.slice()});if(this.ai)this.ai.fulltime();}
 winner(){if(this.score[0]!==this.score[1])return this.score[0]>this.score[1]?'home':'away';if(this.pens&&this.pens.decided)return this.pens.winner;return null;}
 /* ---------------- reinícios ---------------- */
 setupKickoff(ti,teleport){const P=this.P;const kd=this.teams[ti].dir;this.restart={type:'kickoff',team:ti,x:0,z:0,tx:-kd*.35,tz:0,face:kd>0?0:PI,ready:false,t:this.time};this.phase='kickoff';this.goalLock=0;
  const b=this.ball;b.x=0;b.z=0;b.y=BR;b.vx=b.vy=b.vz=0;b.owner=null;b.inNet=false;b.spin=0;b.topspin=0;b.last=null;b.lastTeam=-1;this.intended=null;this.offsideSnap=null;this.gkHolding=null;
  for(const t of this.teams){for(const p of t.players){if(p.off)continue;const s=t.slots[p.slot]||t.slots[0];let x=s.x*.92,z=s.z;if(x>-1.2)x=-1.2-((p.slot*37)%10)*.03;
    const kx=t.dir*x,kz=t.dir*z;p.ai.tx=kx;p.ai.tz=kz;p.ai.want=null;p.lock=0;p.down=0;p.pending=null;p.sliding=null;if(teleport){p.x=p.px=kx;p.z=p.pz=kz;p.vx=p.vz=0;p.f=p.pf=t.dir>0?0:PI;}}}
  /* cobrador e apoio */const t=this.teams[ti];const fw=this.onPitch(ti).filter(p=>!p.gk).sort((a,c)=>Math.abs(a.x)+Math.abs(a.z)-Math.abs(c.x)-Math.abs(c.z));
  const tk=fw[0],sup=fw[1];if(tk){this.restart.taker=tk;tk.ai.tx=-t.dir*.35;tk.ai.tz=0;if(teleport){tk.x=tk.ai.tx;tk.z=0;}}if(sup){sup.ai.tx=-t.dir*1.6;sup.ai.tz=this.small?2:6;if(teleport){sup.x=sup.ai.tx;sup.z=sup.ai.tz;}}
  this.ref.x=this.ref.px=-6;this.ref.z=this.ref.pz=-8;
  for(const H of this.humans)if(H.ti===ti&&tk&&(!tk.human||tk.human===H.id))this.controlled(H,tk);else if(H.ti!==ti)this.pickPlayerFor(H,true);
  this.event('kickoff',{team:ti});}
 /* executa as fases de bola parada (posicionamento, cobrador pronto, tempo da IA) */
 phaseStep(){const now=this.time;
  if(this.phase==='dead'){/* breve pausa após o apito */if(now-this.stopT>(this.pendingRestart.type==='penalty'?1.6:.7)){this.beginRestart(this.pendingRestart);this.pendingRestart=null;}return;}
  if(this.phase==='goal'){/* comemoração; a UI pode exibir replay (sim parada) e então chama kickoffAfterGoal() */if(now-this.stopT>(this.opts.goalPause??7)&&!this.waitReplay)this.kickoffAfterGoal();return;}
  if(this.phase==='restart'||this.phase==='kickoff'){const r=this.restart;if(!r)return;const tk=r.taker;
   if(!tk||tk.off){this.assignTaker(r);return;}
   const d=hyp(tk.x-r.tx,tk.z-r.tz);
   if(!r.ready){/* cobrador vai até a bola; após 4,5 s, a posição é ajustada para não travar a partida */if(d<.5||now-r.t>4.5){tk.x=r.tx;tk.z=r.tz;tk.vx=tk.vz=0;r.ready=true;r.readyT=now;tk.f=r.face??tk.f;this.placeBall(r);}}
   else{tk.ai.tx=r.tx;tk.ai.tz=r.tz;tk.ai.face=r.face;tk.f=r.face;
    /* humano: espera comando. IA: cobra após um tempo natural */
    if(!tk.human&&this.ai&&now-r.readyT>(r.type==='penalty'?2:r.type==='kickoff'?.9:.55+this.rng()*.5))this.ai.takeRestart(tk,r);
    else if(tk.human&&now-r.readyT>25&&this.ai)this.ai.takeRestart(tk,r);}}}
 beginRestart(r){const P=this.P,L=P.L,Wd=P.W;const t=this.teams[r.team],dir=t.dir;this.phase='restart';
  r.t=this.time;r.ready=false;
  if(r.type==='throw'){r.tx=r.x;r.tz=Math.sign(r.z)*(Wd+.35);r.face=Math.atan2(-Math.sign(r.z),dir*.35);}
  else if(r.type==='corner'){r.tx=r.x+Math.sign(r.x)*.3;r.tz=r.z+Math.sign(r.z)*.3;r.face=Math.atan2(-r.z,-r.x*.6);}
  else if(r.type==='goalkick'){r.tx=r.x-dir*.4;r.tz=r.z;r.face=dir>0?0:PI;}
  else if(r.type==='freekick'){const ox=clamp(r.x,-L+1,L-1),oz=clamp(r.z,-Wd+1,Wd-1);r.x=ox;r.z=oz;const gx=dir*L;const a=Math.atan2(-oz,gx-ox);r.tx=ox-Math.cos(a)*.55;r.tz=oz-Math.sin(a)*.55;r.face=a;
   const dg=hyp(gx-ox,oz);r.shootable=!r.indirect&&dg<(this.small?14:32)&&Math.abs(oz)<(this.small?9:24);}
  else if(r.type==='penalty'){const gx=dir*L;r.x=gx-dir*P.penSpot;r.z=0;r.tx=r.x-dir*1.6;r.tz=0;r.face=dir>0?0:PI;}
  this.restart=r;this.assignTaker(r);this.ball.owner=null;this.ball.vx=this.ball.vy=this.ball.vz=0;this.ball.frozen=true;
  /* goleiro de reinício e posições dos demais (a IA move todos de forma natural) */
  if(this.ai)this.ai.setPiece(r);
  for(const H of this.humans){if(H.ti===r.team&&r.taker&&(!r.taker.human||r.taker.human===H.id))this.controlled(H,r.taker);}
  if(r.type==='penalty'){this.event('penalty',{team:r.team});}}
 assignTaker(r){const t=this.teams[r.team];const on=this.onPitch(r.team);let tk=null;const T=t.takers||{};const byId=id=>on.find(p=>p.id===id);
  if(r.type==='goalkick')tk=this.gk(r.team)||on[0];
  else if(r.type==='penalty')tk=byId(T.penalty)||on.filter(p=>!p.gk).sort((a,c)=>(c.a.finishing+c.a.composure)-(a.a.finishing+a.a.composure))[0];
  else if(r.type==='corner')tk=byId(T.corner)||on.filter(p=>!p.gk).sort((a,c)=>(c.a.passing+c.a.vision)-(a.a.passing+a.a.vision))[0];
  else if(r.type==='freekick'&&r.shootable)tk=byId(T.freekick)||on.filter(p=>!p.gk).sort((a,c)=>(c.a.finishing+c.a.passing)-(a.a.finishing+a.a.passing))[0];
  else{let best=null,bd=1e9;for(const p of on){if(p.gk&&r.type!=='freekick')continue;if(p.gk&&this.rel(r.team,r.x)>-this.P.L*.6)continue;const d=hyp(p.x-r.x,p.z-r.z);if(d<bd){bd=d;best=p;}}tk=best;}
  r.taker=tk;if(tk){tk.ai.tx=r.tx;tk.ai.tz=r.tz;tk.ai.speed='sprint';tk.ai.want=null;}}
 placeBall(r){const b=this.ball;b.frozen=false;b.vx=b.vy=b.vz=0;b.spin=0;b.topspin=0;b.inNet=false;
  if(r.type==='throw'){if(this.kickIn){b.x=r.x;b.z=Math.sign(r.z)*(this.P.W-.05);b.y=BR;}else{b.x=r.x;b.z=Math.sign(r.z)*(this.P.W-.02);b.y=2;}}
  else{b.x=r.x;b.z=r.z;b.y=BR;}if(r.type==='kickoff'){b.x=0;b.z=0;}
  b.frozen=true;}
 /* cobrança: chamada pelo humano (comando) ou pela IA. o: {kind, dirx, dirz, power, to} */
 takeRestart(o){const r=this.restart;if(!r||!r.ready)return false;const tk=r.taker,b=this.ball;b.frozen=false;this.phase='play';this.restart=null;for(const p of this.all()){p.ai.setTarget=null;p.ai.face=null;}
  if(r.type==='penalty'){b.x=r.x;b.z=0;b.y=BR;this.penaltyKick(tk,o);return true;}
  let ok;
  if(r.type==='throw'&&!this.kickIn){b.x=r.x;b.z=Math.sign(r.z)*(this.P.W-.02);b.y=2;ok=this.pass(tk,{...o,kind:o.long?'lob':'ground',throwIn:true,long:o.long,set:'throw'});}
  else{b.owner=null;const set=r.type==='corner'?'corner':r.type==='goalkick'?'goalkick':r.type;
   if(o.kind==='shot'&&(r.type==='freekick')){b.owner=tk;ok=this.shoot(tk,{...o,set:true,kind:o.placed?'placed':'shot'});if(ok)tk.act={clip:'freekick',t0:this.time,t1:this.time+.9,p:{}};}
   else if(o.kind==='dribble'){b.owner=tk;ok=true;}
   else{b.owner=tk;ok=this.pass(tk,{...o,set});}}
  if(r.type==='kickoff'&&this.clock<=this.period().start+.1)this.fxAdd('whistle',{});
  if(r.type==='freekick'&&r.indirect)tk.ifkTouch=true;
  this.wall=null;return ok;}
 /* pênalti: cobrador escolhe canto e força; goleiro humano escolhe o lado do mergulho */
 penaltyKick(tk,o){const b=this.ball;const P=this.P;const ti=tk.team,gx=this.goalX(ti),sgn=Math.sign(gx);b.owner=tk;
  const side=o.dirz?Math.sign(o.dirz)*(Math.abs(o.dirz)>.3?1:.4):(this.rnd()<.5?-1:1)*(this.rnd()<.2?.2:1);const power=clamp(o.power??.65,0,1);const height=clamp(.3+(o.dirz===0&&o.dirx?.6:0)+power*.5,.15,1.4);
  const fin=tk.a.finishing*.5+tk.a.composure*.5;const err=(1-fin)*.075+.012+(power>.85?(power-.85)*.45:0);const az=side*(P.goalHalfW-.55)+this.gauss()*err*11,ay=height+this.gauss()*err*6+Math.max(0,power-.9)*2.2;
  const d=hyp(gx-b.x,az-b.z),v=17+power*10,T=d/v;b.owner=null;b.vx=(gx-b.x)/T;b.vz=(az-b.z)/T;b.vy=(ay-b.y)/T+G*T/2;this.setLast(tk);
  b.lastKick={by:tk.id,team:ti,t:this.time,kind:'shot',shot:true,penalty:true,xg:.76};this.stats[ti].shots++;tk.st.shots++;this.stats[ti].xg+=.76;
  tk.act={clip:'penalty_kick',t0:this.time,t1:this.time+.8,p:{}};tk.touchCool=this.time+.5;this.fxAdd('kick',{power:.9,shot:true});
  /* goleiro: humano escolhe; IA adivinha com o atributo */
  const gk=this.gk(this.opp(ti));if(gk){let dive;const H=gk.human&&this.human(gk.human);if(H){const c=H.cmd;dive=Math.abs(c.mz||0)>.3?Math.sign(c.mz||0):(Math.abs(c.mx||0)>.3?Math.sign(c.mx)*-sgn:0);}else{const guess=this.rnd()<.42+gk.a.gkPenalties*.28?Math.sign(az)||0:(this.rnd()<.5?-1:1)*(this.rnd()<.18?0:1);dive=guess;}
   const reach=dive===0?.9:2.6;const hit=dive===0?Math.abs(az)<.95&&ay<1.9:Math.sign(az)===dive&&Math.abs(az)<reach+.35&&ay<2.2;const saveP=hit?clamp(.5+gk.a.gkPenalties*.35+gk.a.gkReflexes*.15-power*.25-(Math.abs(az)>P.goalHalfW-.6?.22:0),.05,.88):0;
   gk.act={clip:dive===0?'gk_ready':'gk_dive',t0:this.time+.08,t1:this.time+1.3,p:{side:dive*-sgn,height:ay}};gk.lock=this.time+1;if(dive){gk.ai.penDive={side:dive,t:this.time};gk.vz=dive*Math.min(6,2.4/Math.max(.25,T));gk.vx=0;}
   this.planSave(gk,this.rnd()<saveP,T*.92,dive*(reach*.8));}
  this.event('penalty_kick',{team:ti,pid:tk.id});if(this.pens&&this.pens.active)this.pens.kickT=this.time;}
 planSave(gk,ok,dt,dz){const k=this.ball.lastKick;gk.ai.plannedFor=k;this.save={gk,ok,t:this.time+dt,dz,k,catch:ok&&this.rnd()<.35};}
 /* ---------------- disputa de pênaltis ---------------- */
 startShootout(){const kicks=this.mode.shootoutKicks||5;this.pens={active:true,kicks,home:0,away:0,list:[],next:0,decided:false,winner:null,first:this.rng()<.5?0:1,kickT:0};this.phase='shootout';this.event('shootout',{});
  this.teams[0].dir=1;this.teams[1].dir=1;/* ambos chutam no mesmo gol (x=+L) */this.nextPenalty();}
 nextPenalty(){const s=this.pens;const ti=(s.first+s.next)%2;const t=this.teams[ti];const order=this.onPitch(ti).filter(p=>!p.gk).sort((a,c)=>(c.a.finishing+c.a.composure)-(a.a.finishing+a.a.composure));
  const k=Math.floor(s.next/2);const tk=order[k%order.length];this.teams[0].dir=1;this.teams[1].dir=1;/* defensor no gol */
  const gk=this.gk(1-ti);const P=this.P;
  for(const p of this.all()){if(p.off)continue;p.x=p.px=clamp(-4+(p.slot%5)*1.2,-P.L,P.L)*(this.small?.4:1);p.z=p.pz=-2+Math.floor(p.slot/5)*1.5+(p.team?4:0);p.vx=p.vz=0;p.ai.tx=p.x;p.ai.tz=p.z;}
  if(gk){gk.x=gk.px=P.L-.3;gk.z=gk.pz=0;gk.ai.tx=gk.x;gk.ai.tz=0;gk.f=PI;}
  const r={type:'penalty',team:ti,x:P.L-P.penSpot,z:0,tx:P.L-P.penSpot-1.6,tz:0,face:0,ready:false,t:this.time,shootout:true};this.restart=r;r.taker=tk;tk.x=tk.px=r.tx-2;tk.z=tk.pz=0;tk.ai.tx=r.tx;tk.ai.tz=0;
  this.phase='restart';const b=this.ball;b.x=r.x;b.z=0;b.y=BR;b.vx=b.vy=b.vz=0;b.owner=null;b.frozen=true;this.goalLock=0;this.save=null;
  for(const H of this.humans){if(H.ti===ti)this.controlled(H,tk);else if(gk)this.controlled(H,gk);}}
 shootoutStep(){const s=this.pens;if(!s||!s.active||!s.kickT)return;const b=this.ball;const t=this.time-s.kickT;
  const scored=this.score.length&&this.pensGoalFlag;const end=t>3.2||this.pensGoalFlag||(t>.8&&hyp(b.vx,b.vz)<1.5);if(!end)return;
  const ti=(s.first+s.next)%2;const ok=!!this.pensGoalFlag;this.pensGoalFlag=false;s.list.push({team:ti,ok});this.phase='restart';this.restart=null;this.ball.frozen=true;if(ok)s[ti?'away':'home']++;s.next++;s.kickT=0;this.event('shootout_kick',{team:ti,ok});
  const kh=s.list.filter(x=>x.team===0).length,ka=s.list.filter(x=>x.team===1).length;const N=s.kicks;
  const remH=Math.max(0,N-kh),remA=Math.max(0,N-ka);
  if(kh<=N||ka<=N){if(s.home+remH<s.away||s.away+remA<s.home){s.decided=true;}}
  if(!s.decided&&kh>=N&&ka>=N&&kh===ka&&s.home!==s.away)s.decided=true;
  if(s.decided){s.winner=s.home>s.away?'home':'away';s.active=false;this.ball.frozen=false;this.finish('pens');return;}
  this.shootoutWait=this.time+1.4;}
 /* ---------------- após o gol ---------------- */
 kickoffAfterGoal(){if(this.phase!=='goal')return;const lg=this.lastGoal;this.waitReplay=false;
  if(this.mode.endGoals&&Math.max(...this.score)>=this.mode.endGoals){this.finish('goals');return;}
  if(this.period()&&this.period().golden){this.finish('golden');return;}
  if(this.clock>=this.periodEnd()){this.endPeriod();return;}
  this.setupKickoff(lg?this.opp(lg.team):0,false);}
 /* ---------------- humanos: entrada → intenções ---------------- */
 applyHuman(H){const P=H.player;const c=H.cmd||emptyCmd(),pv=H.prev||emptyCmd();const now=this.time;const press=k=>c[k]&&!pv[k],rel=k=>!c[k]&&pv[k];
  if(this.phase==='goal'||this.phase==='break'||this.phase==='fulltime'||this.phase==='dead'){if(P)P.ai.want=null;return;}
  if(!P||P.off){this.pickPlayerFor(H,true);return;}
  /* direção na referência da câmera (já convertida pela UI em mundo: mx,mz) */
  const mx=c.mx||0,mz=c.mz||0,mag=Math.min(1,hyp(mx,mz));
  const b=this.ball;const hasBall=b.owner===P;const S=this.speeds(P);
  /* troca de jogador (somente da própria equipe, nunca o do parceiro) */
  if(press('switch')&&!hasBall){this.pickPlayerFor(H,false,mag>.3?mx:undefined,mag>.3?mz:undefined);return;}
  /* reinícios */
  if((this.phase==='restart'||this.phase==='kickoff')&&this.restart&&this.restart.taker===P){const r=this.restart;P.ai.want={vx:0,vz:0};if(!r.ready)return;
   const go=(kind,extra)=>{const pw=H.charging?clamp((now-H.charging.t0)/1.0,0,1):.5;H.charging=null;this.takeRestart({kind,dirx:mag>.2?mx:0,dirz:mag>.2?mz:0,power:pw,assist:H.passAssist,...extra});};
   for(const k of ['pass','shoot','cross','through'])if(press(k))H.charging={k,t0:now};
   if(H.charging&&rel(H.charging.k)){const k=H.charging.k;if(r.type==='penalty'){go('shot');return;}
    if(k==='pass')go('ground');else if(k==='shoot')go(r.type==='freekick'?'shot':'long',{placed:c.skill});else if(k==='cross')go(r.type==='corner'?'cross':'long',{long:true,low:c.skill});else go('through');}
   if(r.type==='penalty'||r.type==='freekick')this.aimHint={x:mx,z:mz};return;}
  if(this.phase!=='play'){const S2=this.speeds(P);P.ai.want={vx:mag>.08?mx/mag*S2.run*mag:0,vz:mag>.08?mz/mag*S2.run*mag:0};return;}
  /* movimento */
  let sp=mag<.08?0:(c.sprint?S.sprint:S.run*clamp(mag*1.1,.35,1));if(c.shield&&hasBall)sp=Math.min(sp,2.2);
  let want={vx:mag>.08?mx/mag*sp:0,vz:mag>.08?mz/mag*sp:0};
  /* pressão contextual (segurar): aproxima do portador mantendo distância de bote */
  if(!hasBall&&c.press&&b.owner&&b.owner.team!==P.team){const o=b.owner;const gx=this.ownGoalX(P.team);const a=Math.atan2(-o.z,gx-o.x);const tx=o.x+Math.cos(a)*1.25,tz=o.z+Math.sin(a)*1.25;const dx=tx-P.x,dz=tz-P.z,d=hyp(dx,dz);const v=Math.min(c.sprint?S.sprint:S.run,d*3);want={vx:dx/(d||1)*v,vz:dz/(d||1)*v};P.ai.face=Math.atan2(o.z-P.z,o.x-P.x);}else P.ai.face=null;
  P.ai.want=want;
  if(c.shield&&hasBall)this.shield(P);
  /* goleiro sai (comando contextual na defesa) */
  if((press('gkRush')||press('through'))&&!hasBall&&!(b.owner&&b.owner.team===P.team)){const gk=this.gk(P.team);if(gk&&!gk.human)gk.ai.rushUntil=now+1.6;}
  if(press('support')&&this.ai)this.ai.callSupport(P,hasBall);
  /* ações com bola: carregar força ao segurar, executar ao soltar (barra de força) */
  const keys=['pass','shoot','cross','through'];
  if(hasBall||this.ballIncoming(P)){
   for(const k of keys)if(press(k)){if(c.skill&&hasBall){const sk=k==='pass'?'nutmeg':k==='shoot'?'fakeshot':k==='cross'?'sombrero':'rainbow';this.skill(P,sk,mx,mz);H.skillUsed=now;H.charging=null;return;}H.charging={k,t0:now};}
   if(hasBall&&press('skill')){H.skillPress=now;}
   if(hasBall&&rel('skill')&&now-(H.skillUsed||0)>.3&&now-(H.skillPress||now)<.35){/* toque rápido: drible pela direção relativa ao corpo */let name=P.sp>2.5?'stepover':'bodyfeint';/* sem direção: pedalada em movimento, finta de corpo parado */if(mag>.3){const rd=angDiff(Math.atan2(mz,mx),P.f);if(Math.abs(rd)<.5)name='burst';else if(Math.abs(rd)>2.4)name='drag';else if(Math.abs(rd)>1.6)name='turn';else name=P.a.dribbling>.75&&P.sp>3?'elastico':'cut';}this.skill(P,name,mx,mz);}
   if(c.rs&&hasBall){/* analógico direito: dribles */const rs=c.rs;if(hyp(rs.x,rs.z)>.75&&(!H.rsPrev||hyp(H.rsPrev.x,H.rsPrev.z)<.4)){const rd=angDiff(Math.atan2(rs.z,rs.x),P.f);this.skill(P,Math.abs(rd)<.6?'burst':Math.abs(rd)>2.5?'drag':P.a.dribbling>.7?'stepover':'cut',rs.x,rs.z);}}H.rsPrev=c.rs;
   if(H.charging&&rel(H.charging.k)){const k=H.charging.k,pw=clamp((now-H.charging.t0)/(k==='shoot'?.95:.8),0,1);H.charging=null;const d={dirx:mag>.2?mx:0,dirz:mag>.2?mz:0,power:pw,assist:H.passAssist};
    if(!hasBall){P.pending={kind:k==='shoot'?'shot':k==='pass'?'pass':k==='cross'?'cross':'through',t:now,...d};return;}
    if(k==='pass')this.pass(P,{kind:'ground',...d,oneTwo:c.support});else if(k==='through')this.pass(P,{kind:'through',...d});
    else if(k==='cross'){const wide=Math.abs(P.z)>this.P.W*.45&&this.rel(P.team,P.x)>this.P.L*.35;this.pass(P,{kind:wide?'cross':'lob',...d,low:c.skill});}
    else this.shoot(P,{kind:c.skill?'placed':(c.shield?'chip':'shot'),...d,assist:H.shotAssist});}
   this.chargeUI=H.charging?{k:H.charging.k,v:clamp((now-H.charging.t0)/(H.charging.k==='shoot'?.95:.8),0,1),side:H.ti}:null;}
  else{H.charging=null;
   /* defesa: desarme (toque), carrinho (botão de chute), bloqueio */
   if(press('tackle')||press('cross'))this.tackle(P);if(press('shoot'))this.slide(P);
   if(press('pass')&&P.team===b.lastTeam&&!b.owner){P.pending={kind:'pass',t:now,dirx:mx,dirz:mz,power:.5,assist:true};}}}
 ballIncoming(P){const it=this.intended;return it&&it.to===P&&!this.ball.owner;}
 /* ---------------- utilidades ---------------- */
 execMul(p){return p.human?1:this.diff[this.teams[p.team].side].exec;}
 xg(p,x,z){const ti=p.team,gx=this.goalX(ti);const d=hyp(gx-x,z);const gw=this.P.goalHalfW;const a1=Math.atan2(gw-z,Math.abs(gx-x)),a2=Math.atan2(-gw-z,Math.abs(gx-x));const ang=Math.abs(a1-a2);const sc=this.small?2.2:1;
  return clamp(1/(1+Math.exp(-(-1.35-.095*d*sc+2.2*ang))),.01,.85);}
 byId(id){for(const p of this.all())if(p.id===id)return p;for(const t of this.teams)for(const b of t.bench)if(b.p&&b.p.id===id)return b.p;return null;}
 rnd(){return this.rng();}gauss(){return this.rng.gauss();}
 event(type,o){const ev={type,t:this.time,clock:this.clock,period:this.period()?this.period().id:'',minute:this.minuteText(),...o};this.events.push(ev);if(this.events.length>600)this.events.shift();return ev;}
 fxAdd(type,o){this.fx.push({type,t:this.time,...o});if(this.fx.length>80)this.fx.shift();}
 minuteText(){const p=this.period();if(!p)return'';const end=p.start+p.len;if(this.clock>end){return Math.floor(end/60)+'+'+Math.max(1,Math.ceil((this.clock-end)/60));}return String(Math.max(1,Math.ceil(this.clock/60)));}
 clockText(){const p=this.period();if(this.phase==='shootout'||(this.pens&&this.pens.active))return'PÊNALTIS';if(!p)return'00:00';const end=p.start+p.len;const c=Math.min(this.clock,end);const m=Math.floor(c/60),s=Math.floor(c%60);return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');}
 /* substituição (intervalo, pausa ou IA) */
 substitute(ti,outId,benchIdx){const t=this.teams[ti];const max=this.small?99:(this.opts.maxSubs||5);if(t.subsUsed>=max)return false;const i=t.players.findIndex(p=>p.id===outId&&!p.off);const bb=t.bench[benchIdx];if(i<0||!bb||bb.used)return false;
  const old=t.players[i];const np=this.makePlayer(bb.data,t,old.slot);np.x=np.px=old.x;np.z=np.pz=t.dir*-1*0+old.z;np.x=old.x;np.f=old.f;bb.used=true;bb.p=np;old.subbedOff=true;
  if(old.human){const H=this.human(old.human);old.human=null;if(H){H.player=null;this.controlled(H,np);}}
  t.players[i]=np;t.subsUsed++;this.stats[ti].subs++;this.event('sub',{team:ti,out:old.id,in:np.id,outName:old.name,inName:np.name});t.subbed=(t.subbed||[]).concat(old);this.stoppage+=30;return true;}
 setTactic(ti,k,v){const t=this.teams[ti];t.tactics[k]=v;if(k==='formation'){const sl=D.formationSlots(v);t.slots=sl;t.tactics.formation=v;t.players.forEach((p,i)=>{if(!p.off&&sl[p.slot]){p.pos=p.slot===0?'GOL':sl[p.slot].pos;p.group=D.groupOf(p.pos);}});}if(this.ai)this.ai.reshape(ti);}
 /* ---------------- gravação para replay (buffer circular) ---------------- */
 recInit(){const N=Math.round(REC_SECONDS/DT);this.rec={N,i:0,count:0,actors:[],ball:new Float32Array(N*6),pos:null,acts:new Array(N),time:new Float64Array(N)};}
 recActors(){if(!this.rec.list||this.rec.listKey!==this.actorKey()){this.rec.list=this.actorList();this.rec.listKey=this.actorKey();this.rec.pos=new Float32Array(this.rec.N*this.rec.list.length*5);this.rec.count=0;}return this.rec.list;}
 actorKey(){return this.teams.map(t=>t.players.map(p=>p.id).join(',')).join('|');}
 actorList(){return [...this.teams[0].players,...this.teams[1].players,this.ref,...this.ars];}
 recFrame(){const R=this.rec,list=this.recActors();const i=R.i,n=list.length;const pos=R.pos;const acts=[];
  for(let k=0;k<n;k++){const a=list[k],o=(i*n+k)*5;pos[o]=a.x;pos[o+1]=a.z;pos[o+2]=a.f;pos[o+3]=a.off?-1:a.sp;pos[o+4]=a.dist;acts.push(a.act);}
  const b=this.ball,ob=i*6;R.ball[ob]=b.x;R.ball[ob+1]=b.y;R.ball[ob+2]=b.z;R.ball[ob+3]=b.heading;R.ball[ob+4]=b.roll;R.ball[ob+5]=0;R.acts[i]=acts;R.time[i]=this.time;
  R.i=(i+1)%R.N;R.count=Math.min(R.N,R.count+1);}
 /* converte os últimos `secs` segundos em uma trilha compatível com o renderizador (replays) */
 replayTrack(secs,endPad){const R=this.rec,list=this.rec.list;if(!list||!R.count)return null;const fps=30,step=Math.round(1/DT/fps);const need=Math.min(R.count,Math.round(secs/DT));
  const start=(R.i-need+R.N)%R.N;const frames=[];for(let k=0;k<need;k+=step)frames.push((start+k)%R.N);
  const n=frames.length;if(n<4)return null;const t0=R.time[frames[0]];const nA=list.length;
  const tr={n,fps,duration:(n-1)/fps,dir:1,actors:[],bx:new Float32Array(n),by:new Float32Array(n),bz:new Float32Array(n),bh:new Float32Array(n),bs:new Float32Array(n),marks:[],cams:[],cuts:[],overlays:[],goalSide:this.lastGoal?Math.sign(this.lastGoal.x)||1:1,props:[]};
  for(let k=0;k<nA;k++){const a=list[k];const A={id:a.view.id,side:a.view.side,kind:a.view.kind,info:a.view.info,slot:a.view.slot,x:new Float32Array(n),z:new Float32Array(n),f:new Float32Array(n),v:new Float32Array(n),d:new Float32Array(n),acts:[],emos:[]};
   let lastAct=null;for(let j=0;j<n;j++){const fi=frames[j],o=(fi*nA+k)*5;A.x[j]=R.pos[o];A.z[j]=R.pos[o+1];A.f[j]=R.pos[o+2];A.v[j]=Math.max(0,R.pos[o+3]);A.d[j]=R.pos[o+4];if(R.pos[o+3]<0){A.x[j]=99;}
    const ac=R.acts[fi]&&R.acts[fi][k];if(ac&&ac!==lastAct){A.acts.push({clip:ac.clip,t0:ac.t0-t0,t1:ac.t1-t0,p:ac.p||{}});lastAct=ac;}}
   tr.actors.push(A);}
  for(let j=0;j<n;j++){const ob=frames[j]*6;tr.bx[j]=R.ball[ob];tr.by[j]=R.ball[ob+1];tr.bz[j]=R.ball[ob+2];tr.bh[j]=R.ball[ob+3];tr.bs[j]=R.ball[ob+4];}
  for(const f of this.fx){const tt=f.t-t0;if(tt<0||tt>tr.duration)continue;if(f.type==='goal')tr.marks.push({t:tt,type:'goal',side:f.side});if(f.type==='net')tr.marks.push({t:tt,type:'net',at:f.at});if(f.type==='kick')tr.marks.push({t:tt,type:'kick',power:(f.power||.5)*30});if(f.type==='post')tr.marks.push({t:tt,type:'post'});if(f.type==='save')tr.marks.push({t:tt,type:'save'});}
  tr.startT=0;return tr;}
 /* ---------------- resumo compatível com o pós-jogo / Modo Copa ---------------- */
 ratings(){const out=[];for(const t of this.teams){for(const p of [...t.players,...(t.subbed||[])]){const s=p.st;let r=6+s.goals*1.1+s.assists*.7+s.keyPasses*.15+s.saves*.35+s.tackles*.05+(s.passes?(s.passOk/s.passes-.7)*1.5:0)+s.dribbles*.1-s.fouls*.1-(p.red?1.5:0)-p.yellow*.2;
   if(p.gk){const conc=this.score[1-t.idx];r+=conc===0?.8:-conc*.35;}out.push({id:p.id,name:p.name,side:t.side,pos:p.pos,rating:clamp(r,3,10),goals:s.goals,assists:s.assists,saves:s.saves,p});}}
  return out.sort((a,b)=>b.rating-a.rating);}
 summary(){const goals=this.events.filter(e=>e.type==='goal');const R=this.ratings();
  return{score:{home:this.score[0],away:this.score[1]},pens:this.pens&&this.pens.decided?{home:this.pens.home,away:this.pens.away,decided:true,winner:this.pens.winner}:null,winner:this.winner(),
   et:this.periods.slice(0,this.pi+1).some(p=>p.extra&&!p.golden),endReason:this.endReason,
   goals:goals.map(g=>({side:this.teams[g.team].side,scorerId:g.pid,assistId:g.assist,own:g.own,minute:g.minute})),
   motm:R[0]?{id:R[0].id,name:R[0].name,side:R[0].side,rating:R[0].rating}:null,ratings:R.map(r=>({id:r.id,name:r.name,side:r.side,rating:r.rating,goals:r.goals})),stats:this.stats};}
}
function goTo(o,tx,tz,vmax){const dx=tx-o.x,dz=tz-o.z,d=hyp(dx,dz);const v=d<.4?0:Math.min(vmax,d*1.5);const wx=d?dx/d*v:0,wz=d?dz/d*v:0;const k=Math.min(1,DT*3);o.vx+=(wx-o.vx)*k;o.vz+=(wz-o.vz)*k;o.x+=o.vx*DT;o.z+=o.vz*DT;o.sp=hyp(o.vx,o.vz);o.dist+=o.sp*DT;}
function emptyCmd(){return{mx:0,mz:0,sprint:false,pass:false,shoot:false,cross:false,through:false,tackle:false,press:false,switch:false,skill:false,support:false,shield:false,gkRush:false,pause:false,rs:null};}
W.emptyCmd=emptyCmd;
W.World=World;
})(typeof window!=='undefined'?(window.MD=window.MD||{}):(globalThis.MD=globalThis.MD||{}));
