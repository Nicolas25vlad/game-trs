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
   Coordenadas: x ao longo do campo (gols em x=±L), z na largura (laterais em z=±W), y altura. dir=+1 ataca para +x.
   Arquivos: world.js (núcleo: partida, passo, relógio, humanos, replay e resumo) e, carregados depois dele,
   physics.js (atletas e bola), actions.js (ações com a bola e goleiro), referee.js (arbitragem) e restarts.js (bola parada). */
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
  
  /* campo e regras são da partida: cópias próprias, para outra partida (ou o SIMULAR da Copa) não mudar este jogo no meio.
     MO.apply acima continua atualizando o modo global, que o desenho e as câmeras leem. */
  const R=MD.Rules;this.P={...R.PITCH_PRO,...(this.mode.pitch||{})};this.small=!!this.P.small;this.prof={...R.PROFILE_PRO,...(this.mode.rules||{})};
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
/* auxiliares compartilhados com physics.js, actions.js, referee.js e restarts.js, que acrescentam métodos à classe */
W._k={U,D,clamp,lerp,PI,hyp,DT,G,BR,PHYS,n01,angDiff,goTo,emptyCmd};
W.extend=methods=>{const d=Object.getOwnPropertyDescriptors(methods);for(const k in d)d[k].enumerable=false;Object.defineProperties(World.prototype,d);};
})(typeof window!=='undefined'?(window.MD=window.MD||{}):(globalThis.MD=globalThis.MD||{}));
