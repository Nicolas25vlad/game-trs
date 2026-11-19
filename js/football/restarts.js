/* TRS26 — MUNDO DE PARTIDA · REINÍCIOS: saída de bola, laterais, escanteios, tiros de meta, faltas com barreira, pênaltis e disputa de pênaltis.
   Métodos de MD.World.World, separados de world.js por assunto; carregar depois de world.js. */
(function(MD){
'use strict';
const W=MD.World;const {U,D,clamp,lerp,PI,hyp,DT,G,BR,PHYS,n01,angDiff,goTo,emptyCmd}=W._k;
W.extend({
 /* ---------------- reinícios ---------------- */
 setupKickoff(ti,teleport){const P=this.P;const kd=this.teams[ti].dir;this.restart={type:'kickoff',team:ti,x:0,z:0,tx:-kd*.35,tz:0,face:kd>0?0:PI,ready:false,t:this.time};this.phase='kickoff';this.goalLock=0;
  const b=this.ball;b.x=0;b.z=0;b.y=BR;b.vx=b.vy=b.vz=0;b.owner=null;b.inNet=false;b.spin=0;b.topspin=0;b.last=null;b.lastTeam=-1;this.intended=null;this.offsideSnap=null;this.gkHolding=null;
  for(const t of this.teams){for(const p of t.players){if(p.off)continue;const s=t.slots[p.slot]||t.slots[0];let x=s.x*.92,z=s.z;if(x>-1.2)x=-1.2-((p.slot*37)%10)*.03;
    const kx=t.dir*x,kz=t.dir*z;p.ai.tx=kx;p.ai.tz=kz;p.ai.want=null;p.lock=0;p.down=0;p.pending=null;p.sliding=null;if(teleport){p.x=p.px=kx;p.z=p.pz=kz;p.vx=p.vz=0;p.f=p.pf=t.dir>0?0:PI;}}}
  /* cobrador e apoio */const t=this.teams[ti];const fw=this.onPitch(ti).filter(p=>!p.gk).sort((a,c)=>Math.abs(a.x)+Math.abs(a.z)-Math.abs(c.x)-Math.abs(c.z));
  const tk=fw[0],sup=fw[1];if(tk){this.restart.taker=tk;tk.ai.tx=-t.dir*.35;tk.ai.tz=0;if(teleport){tk.x=tk.ai.tx;tk.z=0;}}if(sup){sup.ai.tx=-t.dir*1.6;sup.ai.tz=this.small?2:6;if(teleport){sup.x=sup.ai.tx;sup.z=sup.ai.tz;}}
  this.ref.x=this.ref.px=-6;this.ref.z=this.ref.pz=-8;
  for(const H of this.humans)if(H.ti===ti&&tk&&(!tk.human||tk.human===H.id))this.controlled(H,tk);else if(H.ti!==ti)this.pickPlayerFor(H,true);
  this.event('kickoff',{team:ti});},
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
  if(r.type==='penalty'){this.event('penalty',{team:r.team});}},
 assignTaker(r){const t=this.teams[r.team];const on=this.onPitch(r.team);let tk=null;const T=t.takers||{};const byId=id=>on.find(p=>p.id===id);
  if(r.type==='goalkick')tk=this.gk(r.team)||on[0];
  else if(r.type==='penalty')tk=byId(T.penalty)||on.filter(p=>!p.gk).sort((a,c)=>(c.a.finishing+c.a.composure)-(a.a.finishing+a.a.composure))[0];
  else if(r.type==='corner')tk=byId(T.corner)||on.filter(p=>!p.gk).sort((a,c)=>(c.a.passing+c.a.vision)-(a.a.passing+a.a.vision))[0];
  else if(r.type==='freekick'&&r.shootable)tk=byId(T.freekick)||on.filter(p=>!p.gk).sort((a,c)=>(c.a.finishing+c.a.passing)-(a.a.finishing+a.a.passing))[0];
  else{let best=null,bd=1e9;for(const p of on){if(p.gk&&r.type!=='freekick')continue;if(p.gk&&this.rel(r.team,r.x)>-this.P.L*.6)continue;const d=hyp(p.x-r.x,p.z-r.z);if(d<bd){bd=d;best=p;}}tk=best;}
  r.taker=tk;if(tk){tk.ai.tx=r.tx;tk.ai.tz=r.tz;tk.ai.speed='sprint';tk.ai.want=null;}},
 placeBall(r){const b=this.ball;b.frozen=false;b.vx=b.vy=b.vz=0;b.spin=0;b.topspin=0;b.inNet=false;
  if(r.type==='throw'){if(this.kickIn){b.x=r.x;b.z=Math.sign(r.z)*(this.P.W-.05);b.y=BR;}else{b.x=r.x;b.z=Math.sign(r.z)*(this.P.W-.02);b.y=2;}}
  else{b.x=r.x;b.z=r.z;b.y=BR;}if(r.type==='kickoff'){b.x=0;b.z=0;}
  b.frozen=true;},
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
  this.wall=null;return ok;},
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
  this.event('penalty_kick',{team:ti,pid:tk.id});if(this.pens&&this.pens.active)this.pens.kickT=this.time;},
 /* ---------------- disputa de pênaltis ---------------- */
 startShootout(){const kicks=this.mode.shootoutKicks||5;this.pens={active:true,kicks,home:0,away:0,list:[],next:0,decided:false,winner:null,first:this.rng()<.5?0:1,kickT:0};this.phase='shootout';this.event('shootout',{});
  this.teams[0].dir=1;this.teams[1].dir=1;/* ambos chutam no mesmo gol (x=+L) */this.nextPenalty();},
 nextPenalty(){const s=this.pens;const ti=(s.first+s.next)%2;const t=this.teams[ti];const order=this.onPitch(ti).filter(p=>!p.gk).sort((a,c)=>(c.a.finishing+c.a.composure)-(a.a.finishing+a.a.composure));
  const k=Math.floor(s.next/2);const tk=order[k%order.length];this.teams[0].dir=1;this.teams[1].dir=1;/* defensor no gol */
  const gk=this.gk(1-ti);const P=this.P;
  for(const p of this.all()){if(p.off)continue;p.x=p.px=clamp(-4+(p.slot%5)*1.2,-P.L,P.L)*(this.small?.4:1);p.z=p.pz=-2+Math.floor(p.slot/5)*1.5+(p.team?4:0);p.vx=p.vz=0;p.ai.tx=p.x;p.ai.tz=p.z;}
  if(gk){gk.x=gk.px=P.L-.3;gk.z=gk.pz=0;gk.ai.tx=gk.x;gk.ai.tz=0;gk.f=PI;}
  const r={type:'penalty',team:ti,x:P.L-P.penSpot,z:0,tx:P.L-P.penSpot-1.6,tz:0,face:0,ready:false,t:this.time,shootout:true};this.restart=r;r.taker=tk;tk.x=tk.px=r.tx-2;tk.z=tk.pz=0;tk.ai.tx=r.tx;tk.ai.tz=0;
  this.phase='restart';const b=this.ball;b.x=r.x;b.z=0;b.y=BR;b.vx=b.vy=b.vz=0;b.owner=null;b.frozen=true;this.goalLock=0;this.save=null;
  for(const H of this.humans){if(H.ti===ti)this.controlled(H,tk);else if(gk)this.controlled(H,gk);}},
 shootoutStep(){const s=this.pens;if(!s||!s.active||!s.kickT)return;const b=this.ball;const t=this.time-s.kickT;
  const scored=this.score.length&&this.pensGoalFlag;const end=t>3.2||this.pensGoalFlag||(t>.8&&hyp(b.vx,b.vz)<1.5);if(!end)return;
  const ti=(s.first+s.next)%2;const ok=!!this.pensGoalFlag;this.pensGoalFlag=false;s.list.push({team:ti,ok});this.phase='restart';this.restart=null;this.ball.frozen=true;if(ok)s[ti?'away':'home']++;s.next++;s.kickT=0;this.event('shootout_kick',{team:ti,ok});
  const kh=s.list.filter(x=>x.team===0).length,ka=s.list.filter(x=>x.team===1).length;const N=s.kicks;
  const remH=Math.max(0,N-kh),remA=Math.max(0,N-ka);
  if(kh<=N||ka<=N){if(s.home+remH<s.away||s.away+remA<s.home){s.decided=true;}}
  if(!s.decided&&kh>=N&&ka>=N&&kh===ka&&s.home!==s.away)s.decided=true;
  if(s.decided){s.winner=s.home>s.away?'home':'away';s.active=false;this.ball.frozen=false;this.finish('pens');return;}
  this.shootoutWait=this.time+1.4;},
 /* ---------------- após o gol ---------------- */
 kickoffAfterGoal(){if(this.phase!=='goal')return;const lg=this.lastGoal;this.waitReplay=false;
  if(this.mode.endGoals&&Math.max(...this.score)>=this.mode.endGoals){this.finish('goals');return;}
  if(this.period()&&this.period().golden){this.finish('golden');return;}
  if(this.clock>=this.periodEnd()){this.endPeriod();return;}
  this.setupKickoff(lg?this.opp(lg.team):0,false);}
});
})(typeof window!=='undefined'?(window.MD=window.MD||{}):(globalThis.MD=globalThis.MD||{}));
