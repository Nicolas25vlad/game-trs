/* TRS26 / MATCHDAY 0.6 — INTELIGÊNCIA ARTIFICIAL CONTÍNUA (utility AI + papéis táticos).
   Camada tática (5 Hz): bloco, altura da linha, largura, quem pressiona, quem cobre, quem marca, quem disputa a bola solta.
   Camada individual (10 Hz, escalonada): alvo de posicionamento, apoio, desmarques/infiltrações, marcação, interceptação.
   Portador da bola: avalia passe curto, profundidade, lançamento, cruzamento, chute, condução, drible e proteção,
   com risco de interceptação calculado pela posição real dos adversários. Erra de forma plausível (ruído por dificuldade).
   Goleiros: posicionamento no ângulo, reação ao chute com tempo de reação e alcance físico reais, saída em cruzamentos,
   saída nos pés, reposição. Nunca controla o atleta comandado por um humano. */
(function(MD){
'use strict';
const U=MD.U,clamp=U.clamp,hyp=Math.hypot,PI=Math.PI;
const angDiff=(a,b)=>U.wrapAngle(a-b);
class AI{
 constructor(w){this.w=w;this.tick=0;this.team=[{},{}];this.tacT=0;this.pred=[];this.predT=-1;this.sc=w.P.L/54;}
 diff(ti){return this.w.diff[this.w.teams[ti].side];}
 update(dt){const w=this.w;this.tick++;
  if(w.time-this.tacT>=.2||this.tick===1){this.tacT=w.time;this.tactics(0);this.tactics(1);}
  const all=w.all();const n=all.length;
  for(let i=0;i<n;i++){const p=all[i];if(p.off)continue;if((this.tick+i)%6===0||!p.ai.thought)this.think(p);}
  for(const ti of [0,1]){const gk=w.gk(ti);if(gk&&!gk.human)this.keeper(gk);else if(gk)this.keeperReact(gk);}
  this.carrierStep();this.saveStep();
  if(w.phase==='goal')this.celebrationStep();
  if(w.pens&&w.phase==='play')w.shootoutStep();
  if(w.pens&&w.phase==='restart'&&w.shootoutWait&&w.time>w.shootoutWait){w.shootoutWait=0;w.nextPenalty();}}
 /* ---------- previsão da bola (para interceptar e disputar) ---------- */
 predict(){const w=this.w;if(this.predT===w.time)return this.pred;this.predT=w.time;const b=w.ball;const out=[];let x=b.x,y=b.y,z=b.z,vx=b.vx,vy=b.vy,vz=b.vz;
  if(b.owner){const o=b.owner;for(let k=0;k<=20;k++)out.push({t:k*.15,x:o.x+o.vx*k*.15,y:.11,z:o.z+o.vz*k*.15});this.pred=out;return out;}
  const dt=.05;for(let k=0;k<=70;k++){if(k%3===0)out.push({t:k*dt,x,y,z});if(y>.12||vy>0){vy-=9.81*dt;x+=vx*dt;y+=vy*dt;z+=vz*dt;if(y<.11){y=.11;vy=vy<-1.4?-vy*.5:0;vx*=.86;vz*=.86;}}else{const s=hyp(vx,vz);if(s>0){const ns=Math.max(0,s-(2.35+.035*s)*dt);vx*=ns/s;vz*=ns/s;}x+=vx*dt;z+=vz*dt;}}
  this.pred=out;return out;}
 /* tempo para um atleta alcançar a bola e o ponto */
 intercept(p,maxH){const w=this.w,pr=this.predict();const S=w.speeds(p);const react=p.human?0:this.diff(p.team).react*.6;
  for(const q of pr){if(q.y>(maxH||1.2))continue;const d=hyp(q.x-p.x,q.z-p.z)-.6;const tt=Math.max(0,d)/(S.sprint*.92)+react+(p.down>w.time?p.down-w.time:0);if(tt<=q.t+.05)return{t:q.t,x:q.x,z:q.z};}
  const last=pr[pr.length-1];return{t:9+hyp(last.x-p.x,last.z-p.z)/7,x:last.x,z:last.z};}
 /* ---------- camada tática ---------- */
 tactics(ti){const w=this.w,T=this.team[ti],t=w.teams[ti],b=w.ball,L=w.P.L,sc=this.sc;const dir=t.dir;const tac=t.tactics;
  const owner=b.owner;const inPoss=owner?owner.team===ti:(b.lastTeam===ti&&w.time-(b.lastTouchT||0)<1.2);T.inPoss=inPoss;T.ballRel=dir*b.x;T.ballZ=b.z;
  const ment={park:-9,defensive:-5,balanced:0,attacking:5,allout:9}[tac.mentality]||0;const pressH={low:-8,mid:0,high:8}[tac.pressing]||0;
  /* placar e tempo restante mudam a postura */const diffScore=w.score[ti]-w.score[1-ti];const late=w.clock>(w.periods[w.periods.length-1].start+w.periods[w.periods.length-1].len)*.8;
  const urgency=late?(diffScore<0?6:diffScore>0?-5:0):0;
  T.ment=ment+urgency;T.press=pressH;
  if(inPoss){T.line=clamp(T.ballRel-26*sc+T.ment*sc,-40*sc,10*sc);T.depthK=.88;T.widthK=tac.width==='wide'?1.2:tac.width==='narrow'?.9:1.08;}
  else{T.line=clamp(T.ballRel-17*sc+T.press*sc*.8+T.ment*.5*sc,-45*sc,-2*sc);T.depthK=.66;T.widthK=tac.width==='wide'?.88:.78;}
  /* papéis defensivos */
  T.presser=null;T.cover=null;T.marks=new Map();T.chaser=null;T.interceptor=null;
  const on=w.onPitch(ti).filter(p=>!p.gk);const opp=w.onPitch(1-ti);
  if(!owner||!inPoss){/* bola solta ou do adversário */
   if(!owner){let best=null,bt=1e9;for(const p of on){if(p.human)continue;const ic=this.intercept(p);if(ic.t<bt){bt=ic.t;best=p;}}T.chaser=best;T.chaseT=bt;}
   else{const c=owner;const press=this.diff(ti).press;let list=on.filter(p=>!p.human&&p.beaten<w.time).map(p=>({p,d:hyp(p.x-c.x,p.z-c.z)})).sort((a,c2)=>a.d-c2.d);
    const zoneOk=dir*c.x>-L+((T.press>0?60:T.press<0?32:44)*sc);/* pressão alta só se a tática permitir */
    if(list[0]&&(list[0].d<14*sc*press||!zoneOk||dir*c.x<-L*.25))T.presser=list[0].p;if(list[1])T.cover=list[1].p;
    if(T.call&&T.call.until>w.time&&list[1])T.presser2=list[1].p;else T.presser2=null;
    /* marcação: atacantes próximos do nosso gol recebem marcadores (individual ou por zona) */
    const danger=opp.filter(q=>!q.gk&&q!==c&&-dir*q.x>L-(tac.marking==='man'?60:34)*sc).sort((a,c2)=>(-dir*c2.x)-(-dir*a.x));
    const free=on.filter(p=>p!==T.presser&&p!==T.cover&&p!==T.presser2&&!p.human&&(p.group==='CB'||p.group==='FB'||p.group==='DM'||tac.marking==='man'||p.group==='CM'));
    for(const q of danger){let best=null,bd=1e9;for(const p of free){if([...T.marks.values()].includes(p))continue;const d=hyp(p.x-q.x,p.z-q.z);if(d<bd){bd=d;best=p;}}if(best&&bd<(tac.marking==='man'?30:16)*sc)T.marks.set(q,best);}}
   /* passe adversário no ar: alguém tenta interceptar */
   const it=w.intended;if(it&&it.team!==ti&&!owner){let best=null,bt=1e9;for(const p of on){if(p.human)continue;const ic=this.intercept(p,2);if(ic.t<bt){bt=ic.t;best=p;}}if(best&&bt<1.8)T.interceptor=best;}}
  /* atacando: corridas em profundidade */
  if(inPoss&&owner){T.supporters=on.filter(p=>p!==owner&&!p.human).map(p=>({p,d:hyp(p.x-owner.x,p.z-owner.z)})).sort((a,c)=>a.d-c.d).slice(0,3).map(o=>o.p);}else T.supporters=[];}
 /* alvo de posicionamento pela formação */
 shape(p){const w=this.w,ti=p.team,t=w.teams[ti],T=this.team[ti],dir=t.dir,L=w.P.L,Wd=w.P.W,sc=this.sc;const s=t.slots[p.slot]||t.slots[0];
  const cbX=-38*sc;const shift=(T.line??cbX)-cbX*(T.depthK||.8);let x=s.x*(T.depthK||.8)+shift;
  if(T.inPoss){if(p.group==='FB'&&t.tactics.style!=='counter')x+=6*sc;if(p.group==='ST'||p.group==='W'){x=Math.max(x,(T.ballRel||0)-2*sc);}}
  if(p.instr==='attack')x+=(T.inPoss?7:3)*sc;else if(p.instr==='defend')x-=(T.inPoss?7:2)*sc;
  let z=s.z*(T.widthK||1)+(T.ballZ||0)*dir*(T.inPoss?.18:.38);
  x=clamp(x,-L+3*sc,L-3*sc);z=clamp(z,-Wd+1.2,Wd-1.2);
  if(T.inPoss&&w.offsideOn){const off=this.offsideRel(ti);if(x>off-.8&&!(p.ai.run>w.time))x=off-.8;}
  return{x:dir*x,z:dir*z};}
 offsideRel(ti){const w=this.w;const dir=w.teams[ti].dir;const xs=w.onPitch(1-ti).map(q=>dir*q.x).sort((a,b)=>b-a);return Math.max(xs.length>1?xs[1]:0,dir*w.ball.x,0);}
 /* ---------- decisão individual ---------- */
 think(p){const w=this.w;p.ai.thought=true;if(p.human)return;if(p.gk&&!p.ai.setTarget)return;const b=w.ball,ti=p.team,T=this.team[ti],t=w.teams[ti];const now=w.time;
  p.ai.want=null;p.ai.face=null;p.ai.speed='jog';
  if(w.phase==='goal'||w.phase==='fulltime'||w.phase==='break')return;
  if(w.phase==='restart'||w.phase==='kickoff'||w.phase==='dead'){if(w.restart&&w.restart.taker===p){p.ai.speed='run';return;}
   const st=p.ai.setTarget;if(st&&w.restart){p.ai.tx=st.x;p.ai.tz=st.z;p.ai.speed=hyp(st.x-p.x,st.z-p.z)>8?'run':'jog';return;}
   const sh=this.shape(p);p.ai.tx=sh.x;p.ai.tz=sh.z;p.ai.speed='jog';return;}
  if(b.owner===p)return;/* o portador é tratado em carrierStep */
  const sh=this.shape(p);let tx=sh.x,tz=sh.z,speed='jog';
  if(p.beaten>now){/* foi driblado: recupera a posição correndo */speed='sprint';}
  if(T.chaser===p&&!b.owner){const ic=this.intercept(p);tx=ic.x;tz=ic.z;speed='sprint';}
  else if(T.interceptor===p){const ic=this.intercept(p,2);tx=ic.x;tz=ic.z;speed='sprint';}
  else if(w.intended&&w.intended.to===p&&!b.owner){/* receptor vai ao encontro da bola */const ic=this.intercept(p,2.2);tx=ic.x;tz=ic.z;speed=hyp(tx-p.x,tz-p.z)>3?'sprint':'run';p.ai.face=Math.atan2(b.z-p.z,b.x-p.x);}
  else if(T.inPoss&&b.owner){const o=b.owner;
   if(p.ai.oneTwo&&now-p.ai.oneTwo.t<3&&o===p.ai.oneTwo.back){}/* tabela: devolve ao receber (tratado no portador) */
   if(p.ai.run>now&&p.ai.runTo){tx=p.ai.runTo.x;tz=p.ai.runTo.z;speed='sprint';}
   else{/* novas infiltrações */const rel=t.dir*o.x;const pace=p.a.pace;const goGroup=p.group==='ST'||p.group==='W'||p.group==='AM'||(p.group==='FB'&&rel>w.P.L*.3)||(p.group==='CM'&&rel>w.P.L*.35);
    const off=this.offsideRel(ti);const mine=t.dir*p.x;
    if(goGroup&&rel>-w.P.L*.25&&Math.abs(mine-off)<6*this.sc&&w.rnd()<(.05+.07*pace+(p.ai.called>now?.6:0))*(1-this.diff(ti).noise*.5)){p.ai.run=now+2.2+pace;const tz2=clamp(p.z+(w.rnd()-.5)*10*this.sc,-w.P.W+3,w.P.W-3);p.ai.runTo={x:t.dir*Math.min(w.P.L-3,off+(10+pace*8)*this.sc),z:tz2};tx=p.ai.runTo.x;tz=p.ai.runTo.z;speed='sprint';}
    else if(T.supporters.includes(p)){const sp=this.supportSpot(p,o);tx=sp.x;tz=sp.z;speed=hyp(tx-p.x,tz-p.z)>6?'run':'jog';}}}
  else if(!T.inPoss&&b.owner){const c=b.owner;
   if(T.presser===p||T.presser2===p){const gx=w.ownGoalX(ti);const a=Math.atan2(-c.z,gx-c.x);const dd=1.15;tx=c.x+Math.cos(a)*dd+c.vx*.25;tz=c.z+Math.sin(a)*dd+c.vz*.25;speed=hyp(tx-p.x,tz-p.z)>4?'sprint':'run';p.ai.face=Math.atan2(c.z-p.z,c.x-p.x);
    const d=hyp(c.x-p.x,c.z-p.z);const D=this.diff(ti);if(d<1.7&&now>p.tackleCool&&w.rnd()<(.05+p.a.tackling*.09)*D.press*(c.touchCool>now?3:1)*(c.beaten>now?0:1)*(1-D.react*.6))w.tackle(p);
    else if(d<2.6&&d>1.5&&c.sp>5&&w.rnd()<.012*p.a.aggression*D.press&&!w.inOwnBox(p,c.x,c.z))w.slide(p);}
   else if(T.cover===p){const gx=w.ownGoalX(ti);const a=Math.atan2(-c.z,gx-c.x);tx=c.x+Math.cos(a)*6*this.sc;tz=c.z+Math.sin(a)*6*this.sc;speed='run';}
   else{for(const [q,m] of T.marks)if(m===p){const gx=w.ownGoalX(ti);const a=Math.atan2(-q.z,gx-q.x);const dd=1.6;tx=q.x+Math.cos(a)*dd+(c.x-q.x)*.08;tz=q.z+Math.sin(a)*dd+(c.z-q.z)*.08;speed=hyp(tx-p.x,tz-p.z)>3?'run':'jog';p.ai.face=Math.atan2(c.z-p.z,c.x-p.x);break;}
    /* fecha a linha de passe mais perigosa da sua zona */}}
  /* erro de posicionamento por dificuldade */const pe=1-this.diff(ti).pos;if(pe>0){tx+=Math.sin(p.slot*7.1+now*.3)*pe*4;tz+=Math.cos(p.slot*3.3+now*.27)*pe*4;}
  p.ai.tx=tx;p.ai.tz=tz;p.ai.speed=speed;}
 supportSpot(p,o){const w=this.w,ti=p.team,dir=w.teams[ti].dir,sc=this.sc;let best=null,bs=-1e9;const opp=w.onPitch(1-ti);
  for(const ang of [-1.9,-1.1,-.5,0,.5,1.1,1.9])for(const r of [9,14]){const a=(dir>0?0:PI)+ang+(p.z>o.z?.25:-.25);const x=o.x+Math.cos(a)*r*sc,z=o.z+Math.sin(a)*r*sc;if(Math.abs(z)>w.P.W-1.5||Math.abs(x)>w.P.L-2)continue;
   let open=9;for(const q of opp){const d=distToSeg(q.x,q.z,o.x,o.z,x,z);open=Math.min(open,d);}let near=9;for(const q of opp)near=Math.min(near,hyp(q.x-x,q.z-z));
   const s=open*1.2+near*.6+dir*(x-o.x)*.25-hyp(x-p.x,z-p.z)*.25;if(s>bs){bs=s;best={x,z};}}
  return best||{x:p.x,z:p.z};}
 /* ---------- portador da bola (IA) ---------- */
 carrierStep(){const w=this.w,b=w.ball,p=b.owner,now=w.time;if(!p||p.human||w.phase!=='play')return;
  if(p.gk&&w.gkHolding===p){if(now-w.gkHoldT>1.4+((p.slot*37)%10)/10)this.gkDistribute(p);p.ai.want={vx:0,vz:0};return;}
  /* tabela: devolve de primeira para quem pediu */
  if(p.ai.oneTwo&&now-p.ai.oneTwo.t<2.5){const back=p.ai.oneTwo.back;p.ai.oneTwo=null;if(back&&!back.off){w.pass(p,{kind:'through',to:back,x:undefined});return;}}
  if(!p.ai.decideAt||now>=p.ai.decideAt||(w.pressureOn(p)>.75&&now-(p.ai.lastDecide||0)>.18)){p.ai.lastDecide=now;const delay=p.ai.gotT&&now-p.ai.gotT<.25?.25:.3+w.rnd()*.35;p.ai.decideAt=now+delay;this.decide(p);}
  const d=p.ai.drib;if(d){const S=w.speeds(p);const sp=d.speed==='sprint'?S.sprint:d.speed==='walk'?S.walk:S.run;let dx=d.dx,dz=d.dz;
   /* evita a lateral e a linha de fundo */const Wd=w.P.W,L=w.P.L;if(Math.abs(p.z)>Wd-2.5&&Math.sign(dz)===Math.sign(p.z))dz*=-.3;if(Math.abs(p.x)>L-2&&Math.sign(dx)===Math.sign(p.x))dx*=-.3;const l=hyp(dx,dz)||1;p.ai.want={vx:dx/l*sp,vz:dz/l*sp};}
  else p.ai.want={vx:0,vz:0};}
 decide(p){const w=this.w,b=w.ball,ti=p.team,t=w.teams[ti],dir=t.dir,L=w.P.L,Wd=w.P.W,sc=this.sc;const D=this.diff(ti);const st=t.tactics.style;
  const opp=w.onPitch(1-ti),mates=w.onPitch(ti).filter(q=>q!==p);const pressure=w.pressureOn(p);const rel=dir*p.x;const noise=()=>w.gauss()*D.noise*.16;
  const V=(x,z)=>{const r=dir*x;const u=clamp((r+L)/(2*L),0,1);let v=u*u;if(w.inBox(dir,x,z))v+=.22;if(r>L*.4)v+=(1-Math.abs(z)/Wd)*.12;return v;};
  const v0=V(p.x,p.z);const opts=[];
  /* chute */const xg=w.xg(p,p.x,p.z);const dGoal=hyp(w.goalX(ti)-p.x,p.z);
  if(dGoal<(this.small?16:32)&&rel>0){let block=0;for(const q of opp){if(q.gk)continue;if(distToSeg(q.x,q.z,p.x,p.z,w.goalX(ti),0)<1)block++;}
   const longF=dGoal>20*sc?(p.a.finishing>.75?.6:.25):1;opts.push({k:'shoot',u:xg*2.3*longF-block*.06+(p.a.finishing-.5)*.08+noise()});}
  /* passes */
  for(const q of mates){if(q.gk&&(rel>-L*.2||pressure<.6))continue;const kinds=[];const d=hyp(q.x-p.x,q.z-p.z);if(d<4*sc||d>58*sc)continue;
   kinds.push(d<34*sc?'ground':'long');if((q.ai.run>w.time||(dir*q.x>this.offsideRel(ti)-3&&q.group!=='CB'))&&dir*q.x>dir*p.x)kinds.push('through');
   if(Math.abs(p.z)>Wd*.42&&rel>L*.45&&w.inBox(dir,q.x,q.z))kinds.push('cross');
   for(const k of kinds){const tgt=k==='through'?w.leadPoint(p,q,'through'):{x:q.x+q.vx*.3,z:q.z+q.vz*.3};if(w.offsideOn&&k!=='cross'&&q.ai.run<=w.time&&dir*tgt.x>this.offsideRel(ti)+.2)continue;
    const risk=this.laneRisk(p,tgt.x,tgt.z,k,ti);let gain=V(tgt.x,tgt.z)-v0;let u=gain*1.15+.07-risk*(.55+(rel<0?.35:0))+noise();
    if(k==='long'&&st!=='direct')u-=.06;if(k==='through'&&!(q.ai.run>w.time))u-=.05;if(st==='possession'&&k==='ground')u+=.04;if(st==='direct'&&(k==='long'||k==='through'))u+=.05;if(st==='counter'&&k==='through')u+=.06;
    if(k==='cross')u+=.12+.04*mates.filter(m=>w.inBox(dir,m.x,m.z)).length;
    if(p.data.personality==='showman'&&k==='through')u+=.02;
    opts.push({k:'pass',kind:k,to:q,x:tgt.x,z:tgt.z,u});}}
  /* condução / drible */
  const fwd=dir>0?0:PI;let bestA=fwd,bestSpace=0;for(const da of [-.9,-.45,0,.45,.9]){const a=fwd+da;let sp=12;for(const q of opp){const dx=q.x-p.x,dz=q.z-p.z,d=hyp(dx,dz);if(d>14)continue;const off=Math.abs(angDiff(Math.atan2(dz,dx),a));if(off<.7)sp=Math.min(sp,d);}const sc2=sp-Math.abs(da)*2;if(sc2>bestSpace){bestSpace=sc2;bestA=a;}}
  const nearO=w.nearest(1-ti,p.x,p.z);
  if(!p.gk)opts.push({k:'dribble',a:bestA,u:.06+(bestSpace>6?.1:bestSpace>3?.03:-.06)+p.a.dribbling*.07-pressure*.08+(st==='counter'&&bestSpace>8?.05:0)+noise(),space:bestSpace});
  if(!p.gk&&nearO&&nearO.d<2.6&&p.a.dribbling>.62&&w.rnd()<.12+p.a.dribbling*.25+(p.data.personality==='showman'?.15:0))opts.push({k:'skill',u:.1+p.a.dribbling*.12-(rel<0?.15:0)+noise()});
  if(pressure>.55&&w.inOwnBox(p,p.x,p.z))opts.push({k:'clear',u:.32+noise()});
  if(pressure>.7)opts.push({k:'shield',u:.02+p.a.strength*.06+noise()});
  opts.sort((a,c)=>c.u-a.u);const o=opts[0];if(!o)return;
  if(o.k==='shoot'){const kind=dGoal<11*sc&&p.a.finishing>.6&&w.rnd()<.45?'placed':(w.rnd()<.12&&w.gk(1-ti)&&hyp(w.gk(1-ti).x-w.goalX(ti),0)>5*sc?'chip':'shot');w.shoot(p,{kind,power:kind==='placed'?.55:.62+w.rnd()*.3});p.ai.drib=null;return;}
  if(o.k==='pass'){w.pass(p,{kind:o.kind,to:o.to,x:o.x,z:o.z});p.ai.drib=null;return;}
  if(o.k==='clear'){const a=fwd+(p.z>0?-.5:.5)*w.rnd();w.pass(p,{kind:'long',x:p.x+Math.cos(a)*40*sc,z:clamp(p.z+Math.sin(a)*40*sc,-Wd+3,Wd-3)});p.ai.drib=null;return;}
  if(o.k==='skill'){const names=['stepover','cut','bodyfeint','elastico','nutmeg','drag','turn','sombrero'];const pick=names[Math.floor(w.rnd()*(p.a.dribbling>.82?names.length:4))];w.skill(p,pick,Math.cos(bestA+(w.rnd()-.5)*1.6),Math.sin(bestA+(w.rnd()-.5)*1.6));p.ai.drib={dx:Math.cos(bestA),dz:Math.sin(bestA),speed:'run'};return;}
  if(o.k==='shield'){p.shield=w.time+.6;const a=nearO?Math.atan2(p.z-nearO.p.z,p.x-nearO.p.x):fwd;p.ai.drib={dx:Math.cos(a),dz:Math.sin(a),speed:'walk'};return;}
  p.ai.drib={dx:Math.cos(o.a),dz:Math.sin(o.a),speed:o.space>9&&p.stamina>.35?'sprint':'run'};}
 laneRisk(p,tx,tz,kind,ti){const w=this.w;const d=hyp(tx-p.x,tz-p.z);const v=kind==='ground'||kind==='through'?Math.max(10,Math.min(24,Math.sqrt(36+5.8*d))):d/(.7+d/21);let risk=0;
  for(const q of w.onPitch(1-ti)){const proj=projSeg(q.x,q.z,p.x,p.z,tx,tz);if(kind!=='ground'&&kind!=='through'&&proj.u<.82)continue;const tb=d*proj.u/v*1.15;const reach=q.gk?1.6:.9;const to=Math.max(0,proj.d-reach)/6.8+(q.gk?.15:.25);
   const r=clamp((tb-to)*2.2+.25,0,1)*(q.beaten>w.time?.3:1);if(r>risk)risk=r;}
  const nr=w.nearest(1-ti,tx,tz);if(nr&&nr.d<2.5)risk=Math.min(1,risk+.18);return risk;}
 headerDecision(p){const w=this.w,ti=p.team,dir=w.teams[ti].dir;if(w.inBox(dir,p.x,p.z)||hyp(w.goalX(ti)-p.x,p.z)<16*this.sc){w.header(p,{kind:'shot'});return;}
  if(w.inOwnBox(p,p.x,p.z)){const a=(dir>0?0:PI)+(p.z>0?.6:-.6);w.header(p,{kind:'clear',dirx:Math.cos(a),dirz:Math.sin(a)});return;}w.header(p,{kind:'pass'});}
 onShot(p){/* goleiro adversário prepara a reação (o plano de defesa é calculado em keeperReact) */const gk=this.w.gk(1-p.team);if(gk){gk.ai.shotT=this.w.time;gk.ai.planned=false;}}
 /* ---------- goleiros ---------- */
 keeper(g){const w=this.w,b=w.ball,ti=g.team,dir=w.teams[ti].dir,L=w.P.L,gx=w.ownGoalX(ti),now=w.time,sc=this.sc;
  if(w.pens){/* disputa de pênaltis: todos chutam no gol de x=+L */if(g.lock<=now&&w.restart&&w.restart.type==='penalty'&&w.restart.team!==ti){g.ai.tx=L-.3;g.ai.tz=0;g.ai.face=Math.PI;g.ai.want=null;g.ai.speed='run';}else if(g.lock<=now&&!(w.restart&&w.restart.team!==ti)){g.ai.tx=L*.6;g.ai.tz=-6+ti*12;g.ai.want=null;}return;}
  if(w.phase==='restart'||w.phase==='kickoff'||w.phase==='dead'){if(g.ai.setTarget){g.ai.tx=g.ai.setTarget.x;g.ai.tz=g.ai.setTarget.z;}else{g.ai.tx=gx+dir*1;g.ai.tz=0;}g.ai.want=null;g.ai.speed='jog';return;}
  if(w.phase!=='play'){g.ai.want=null;return;}
  if(b.owner===g)return;
  this.keeperReact(g);if(g.lock>now)return;
  const bd=hyp(b.x-gx,b.z);const c=b.owner;
  /* saída nos pés: atacante dentro da área perto do gol, ou pedido do humano */
  if((c&&c.team!==ti&&w.inOwnBox(g,c.x,c.z)&&bd<12*sc&&hyp(c.x-g.x,c.z-g.z)<9*sc)||g.ai.rushUntil>now){const tgt=c||b;g.ai.want=null;g.ai.tx=tgt.x;g.ai.tz=tgt.z;g.ai.speed='sprint';
   if(c&&hyp(c.x-g.x,c.z-g.z)<1.7&&now>g.tackleCool){g.tackleCool=now+1.4;g.act={clip:'gk_foot',t0:now,t1:now+.9,p:{}};g.lock=now+.7;g.down=now+.9;const pr=.3+g.a.gkReflexes*.35+g.a.gkPositioning*.15-c.a.dribbling*.25;if(w.rnd()<pr){w.gkCatch(g);}else if(w.rnd()<.25){w.foul(g,c,{kind:'tackle',sev:.5});}}return;}
  /* bola alta cruzada na área: sai para agarrar */
  if(!b.owner&&b.y>1&&b.vy<3){const ic=this.intercept(g,2.4);if(w.inOwnBox(g,ic.x,ic.z)&&ic.t<1.6&&hyp(ic.x-gx,ic.z)<(this.small?6:14)){g.ai.tx=ic.x;g.ai.tz=ic.z;g.ai.speed='sprint';g.ai.want=null;return;}}
  /* bola solta perto: pega */
  if(!b.owner&&w.inOwnBox(g,b.x,b.z)&&hyp(b.vx,b.vz)<9&&b.lastTeam!==ti){const ic=this.intercept(g,2.2);g.ai.tx=ic.x;g.ai.tz=ic.z;g.ai.speed='sprint';return;}
  /* posicionamento no ângulo */
  const depth=clamp(bd*(this.small?.09:.1),.5,this.small?2.2:4.5)+(dir*b.x>L*.1?(this.small?1:5):0)*(1-this.diff(ti).noise);const a=Math.atan2(b.z,b.x-gx);
  g.ai.tx=gx+Math.cos(a)*depth;g.ai.tz=clamp(Math.sin(a)*depth,-w.P.goalHalfW,w.P.goalHalfW);g.ai.speed=bd<25?'run':'jog';g.ai.want=null;g.ai.face=Math.atan2(b.z-g.z,b.x-g.x);}
 /* reação ao chute: tempo de reação + alcance físico; decide antes do contato e aplica no instante certo */
 keeperReact(g){const w=this.w,b=w.ball,now=w.time,ti=g.team;const k=b.lastKick;if(!k||!k.shot||k.team===ti||b.owner||w.save&&w.save.gk===g&&!w.save.done)return;if(g.ai.plannedFor===k)return;
  const D=this.diff(ti);const react=(.09+(1-g.a.gkReflexes)*.16)*(g.human?1:(2-D.gk));if(now-k.t<react)return;g.ai.plannedFor=k;
  const gx=w.ownGoalX(ti);if(Math.sign(b.vx)!==Math.sign(gx)&&Math.abs(b.vx)>.5)return;
  /* ponto em que a bola cruza o plano do goleiro */const px=g.x;let t=0,x=b.x,y=b.y,z=b.z,vx=b.vx,vy=b.vy,vz=b.vz;const dt=1/120;let hit=null;
  for(let i=0;i<360;i++){x+=vx*dt;y+=vy*dt;z+=vz*dt;if(y>.11||vy>0)vy-=9.81*dt;if(y<.11){y=.11;vy=-vy*.5;}t+=dt;if((x-px)*Math.sign(gx)>=0){hit={t,y,z};break;}}
  if(!hit)return;const P=w.P;const onTarget=Math.abs(hit.z)<P.goalHalfW+.25&&hit.y<P.goalH+.15;if(!onTarget&&Math.abs(hit.z-g.z)>1.2)return;
  const dz=hit.z-g.z;const tAvail=Math.max(0,hit.t-.06);const reach=Math.min(3,.85+Math.max(0,tAvail-.1)*(5.2+g.a.agility*1.6));const hreach=2+g.a.jumping*.5;
  const sp=hyp(b.vx,b.vy,b.vz);let ok=false;
  if(Math.abs(dz)<reach&&hit.y<hreach+.3){const hard=(Math.abs(dz)/reach)**2;const p=clamp((.32+g.a.gkReflexes*.42+g.a.gkPositioning*.22)-hard*.62-Math.max(0,sp-22)*.012-(hit.y>1.9?.12:0),.04,.97)*(g.human?1:D.gk);ok=w.rnd()<p;}
  if(!onTarget)ok=false;
  const side=Math.sign(dz)||1;const fac=Math.sign(gx)<0?1:-1;/* lado do mergulho relativo ao corpo */
  if(Math.abs(dz)>.85){g.act={clip:'gk_dive',t0:now,t1:now+1.4,p:{side:side*fac*-1,height:hit.y}};g.lock=now+1.2;g.down=now+1.25;const v=Math.min(6.5,Math.abs(dz)/Math.max(.2,tAvail));g.vz=side*v;g.vx=0;}
  else{g.act={clip:hit.y<.5?'gk_low':hit.y>1.6?'gk_high':'gk_catch',t0:now,t1:now+.8,p:{}};g.lock=now+.5;g.vz=dz/Math.max(.15,tAvail)*.8;}
  if(MD.__gklog)MD.__gklog.push({dz:+dz.toFixed(2),reach:+reach.toFixed(2),tA:+tAvail.toFixed(2),y:+hit.y.toFixed(2),sp:+sp.toFixed(1),onTarget,ok,d:+Math.hypot(b.x-gx,b.z).toFixed(1)});
  const catchIt=ok&&sp<21&&Math.abs(dz)<1.3&&hit.y<1.9&&w.rnd()<.35+g.a.gkPositioning*.5;w.save={gk:g,ok,t:now+tAvail,catch:catchIt,k};}
 saveStep(){const w=this.w,s=w.save;if(!s||s.done)return;if(w.time<s.t)return;s.done=true;const b=w.ball;if(b.owner||b.lastKick!==s.k)return;const g=s.gk;
  if(!s.ok){w.event('beat_gk',{});return;}const d=hyp(b.x-g.x,b.z-g.z);if(d>4||Math.abs(b.x)>w.P.L+.2)return;
  if(s.catch)w.gkCatch(g);else w.parry(g,1);}
 gkDistribute(g,force){const w=this.w,ti=g.team,dir=w.teams[ti].dir,sc=this.sc;const mates=w.onPitch(ti).filter(q=>!q.gk);
  const free=mates.map(q=>({q,f:(w.nearest(1-ti,q.x,q.z)||{d:9}).d,d:hyp(q.x-g.x,q.z-g.z)})).filter(o=>o.d<35*sc&&o.f>6*this.sc).sort((a,c)=>a.d-c.d);
  const style=w.teams[ti].tactics.style;if(free.length&&(style!=='direct'||w.rnd()<.4)){w.gkDistribute(g,{kind:'throw',to:free[0].q,x:free[0].q.x,z:free[0].q.z});return;}
  const fw=mates.filter(q=>q.group==='ST'||q.group==='W').sort((a,c)=>dir*c.x-dir*a.x)[0]||mates[0];if(fw)w.gkDistribute(g,{kind:'long',to:fw,x:fw.x,z:fw.z});}
 /* ---------- bolas paradas ---------- */
 setPiece(r){const w=this.w,P=w.P,L=P.L,Wd=P.W,sc=this.sc;for(const p of w.all())p.ai.setTarget=null;
  const att=r.team,def=1-att,dirA=w.teams[att].dir;const gxA=dirA*L;/* gol atacado */
  const atk=w.onPitch(att).filter(p=>p!==r.taker&&!p.gk),dfs=w.onPitch(def).filter(p=>!p.gk);
  const gkA=w.gk(att),gkD=w.gk(def);if(gkD)gkD.ai.setTarget={x:-w.teams[def].dir*(L-.4),z:0};if(gkA&&gkA!==r.taker)gkA.ai.setTarget={x:-dirA*(L-(r.type==='goalkick'?6:12)*sc),z:0};
  if(r.type==='corner'||(r.type==='freekick'&&dirA*r.x>L*.45)){const spots=[[-6,-3],[-6,3],[-11,0],[-8,-6],[-9,6],[-16,0],[-14,-9]].map(s=>({x:gxA+dirA*s[0]*sc,z:s[1]*sc*(Math.sign(r.z)||1)}));
   atk.sort((a,c)=>(c.a.heading+c.a.jumping)-(a.a.heading+a.a.jumping));atk.forEach((p,i)=>{p.ai.setTarget=i<spots.length&&i<5?spots[i]:{x:dirA*(L*.2),z:(i%2?-1:1)*8*sc};});
   const marks=[...atk.slice(0,5)];dfs.forEach((p,i)=>{const m=marks[i];p.ai.setTarget=m?{x:m.ai.setTarget.x+dirA*.9,z:m.ai.setTarget.z+(i%2?.5:-.5)}:i<8?{x:gxA-dirA*(5+i%3*3)*sc,z:((i%3)-1)*4*sc}:{x:dirA*L*.1,z:0};});
   if(r.type==='freekick'&&r.shootable){this.wall(r,dfs);}}
  else if(r.type==='freekick'&&r.shootable){this.wall(r,dfs);}
  else if(r.type==='penalty'){const spotX=gxA-dirA*P.penSpot;const ring=[...atk,...dfs];ring.forEach((p,i)=>{const k=i-ring.length/2;p.ai.setTarget={x:gxA-dirA*(P.boxDepth+1.5+(i%2)*1.2),z:k*1.6*sc};});}
  else if(r.type==='goalkick'){dfs.forEach(p=>{const sh=this.shape(p);p.ai.setTarget={x:clamp(sh.x,-L,L),z:sh.z};if(w.inBox(-w.teams[def].dir*-1,sh.x,sh.z)){}});atk.forEach(p=>{const sh=this.shape(p);p.ai.setTarget=sh;});}
  for(const p of w.all()){if(!p.ai.setTarget&&p!==r.taker&&!p.gk){const sh=this.shape(p);p.ai.setTarget=sh;}}
  /* distância regulamentar nos reinícios */const md=r.type==='throw'?2:P.wallDist||9.15;for(const p of dfs){const st=p.ai.setTarget;if(!st||p.inWall)continue;const d=hyp(st.x-r.x,st.z-r.z);if(d<md){const a=Math.atan2(st.z-r.z,st.x-r.x);st.x=r.x+Math.cos(a)*md;st.z=r.z+Math.sin(a)*md;}}
  for(const p of w.all())p.inWall=false;}
 wall(r,dfs){const w=this.w,P=w.P,dirD=-w.teams[r.team].dir;const gx=-dirD*P.L;const a=Math.atan2(-r.z,gx-r.x);const d=P.wallDist||9.15;const n=clamp(Math.round(5-hyp(gx-r.x,r.z)/8),2,this.small?2:5);
  const cx=r.x+Math.cos(a)*d,cz=r.z+Math.sin(a)*d;const px=-Math.sin(a),pz=Math.cos(a);const near=Math.sign(r.z)||1;
  dfs.sort((p,q)=>hyp(p.x-cx,p.z-cz)-hyp(q.x-cx,q.z-cz)).slice(0,n).forEach((p,i)=>{const o=(i-(n-1)/2)*.62+near*.35;p.ai.setTarget={x:cx+px*o,z:cz+pz*o};p.inWall=true;p.ai.wallUntil=w.time+6;});
  w.wall={x:cx,z:cz,n};}
 takeRestart(tk,r){const w=this.w,ti=tk.team,dir=w.teams[ti].dir,P=w.P,sc=this.sc;const mates=w.onPitch(ti).filter(q=>q!==tk);
  const nearestFree=(maxD)=>mates.filter(q=>!q.gk).map(q=>({q,d:hyp(q.x-tk.x,q.z-tk.z),f:(w.nearest(1-ti,q.x,q.z)||{d:9}).d})).filter(o=>o.d<maxD&&o.d>3).sort((a,c)=>(c.f*1.5-c.d*.3)-(a.f*1.5-a.d*.3))[0];
  if(r.type==='penalty'){w.takeRestart({kind:'shot',dirz:(w.rnd()<.5?-1:1)*(w.rnd()<.85?1:.2),power:.55+w.rnd()*.35});return;}
  if(r.type==='kickoff'){const s=mates.filter(q=>!q.gk).sort((a,c)=>hyp(a.x,a.z)-hyp(c.x,c.z))[0];w.takeRestart({kind:'ground',to:s,x:s?s.x:-dir*5,z:s?s.z:0});return;}
  if(r.type==='corner'){if(w.rnd()<.18){const o=nearestFree(14*sc);if(o){w.takeRestart({kind:'ground',to:o.q,x:o.q.x,z:o.q.z});return;}}
   const box=mates.filter(q=>w.inBox(dir,q.x,q.z)).sort((a,c)=>(c.a.heading+c.a.jumping)-(a.a.heading+a.a.jumping));const q=box[Math.floor(w.rnd()*Math.min(3,box.length))]||box[0];
   w.takeRestart({kind:'cross',to:q,x:q?q.x:dir*(P.L-8*sc),z:q?q.z:0});return;}
  if(r.type==='freekick'&&r.shootable&&tk.a.finishing+tk.a.passing>1.15&&w.rnd()<.7){w.takeRestart({kind:'shot',placed:true,dirz:w.rnd()<.5?-1:1,power:.6});return;}
  if(r.type==='goalkick'){const o=nearestFree(30*sc);if(o&&w.teams[ti].tactics.style!=='direct'&&w.rnd()<.6){w.takeRestart({kind:'ground',to:o.q,x:o.q.x,z:o.q.z});return;}const fw=mates.filter(q=>q.group==='ST'||q.group==='W')[0]||mates[0];w.takeRestart({kind:'long',to:fw,x:fw.x,z:fw.z});return;}
  const o=nearestFree(r.type==='throw'?22*sc:32*sc);if(o){w.takeRestart({kind:o.d>26*sc?'long':'ground',to:o.q,x:o.q.x+o.q.vx*.3,z:o.q.z+o.q.vz*.3,long:o.d>18*sc});return;}
  const fwd=mates.sort((a,c)=>dir*c.x-dir*a.x)[0];w.takeRestart({kind:'long',to:fwd,x:fwd.x,z:fwd.z,long:true});}
 callSupport(P,hasBall){const w=this.w,ti=P.team,T=this.team[ti];if(hasBall){const runners=w.onPitch(ti).filter(q=>q!==P&&!q.gk&&!q.human).sort((a,c)=>hyp(a.x-P.x,a.z-P.z)-hyp(c.x-P.x,c.z-P.z));
   if(runners[0])runners[0].ai.called=w.time+2.5;const fw=runners.filter(q=>q.group==='ST'||q.group==='W'||q.group==='AM')[0];if(fw){fw.ai.called=w.time+2.5;fw.ai.run=0;}}else{T.call={until:w.time+3};}}
 reshape(ti){/* expulsão: a formação perde um homem; os demais cobrem por proximidade (sem jogador "fantasma") */this.tactics(ti);}
 /* ---------- comemorações (preserva as da 0.5, com variedade pela personalidade) ---------- */
 celebrate(ti,scorer){const w=this.w,now=w.time;const CEL={showman:['run_airplane','knee_slide','dance','robot'],passionate:['scream','knee_slide','badge','punch_air'],humble:['point_sky','arms_wide','applaud'],cool:['arms_crossed','pose','point'],funny:['dance','robot','run_airplane'],leader:['badge','punch_air','arms_wide']};
  this.cel={ti,scorer,t:now};const corner={x:Math.sign(w.ball.x||1)*(w.P.L-1),z:Math.sign(w.ball.z||1)*(w.P.W-1)};this.cel.corner=corner;
  if(scorer){const list=CEL[scorer.data.personality]||['arms_up','run_celebrate','jump_joy'];const clip=list[Math.floor(w.rnd()*list.length)];scorer.ai.celClip=clip;scorer.emos.push({e:'euphoric',t0:now,t1:now+6,k:1});}
  for(const p of w.onPitch(ti))if(p!==scorer)p.emos.push({e:'veryhappy',t0:now+.3,t1:now+5,k:1});
  for(const p of w.onPitch(1-ti))p.emos.push({e:'sad',t0:now+.3,t1:now+5,k:.9});}
 celebrationStep(){const w=this.w,c=this.cel;if(!c)return;const now=w.time,u=now-c.t;
  for(const p of w.all()){if(p.off)continue;p.ai.want=null;
   if(p.team===c.ti){if(p===c.scorer){p.ai.tx=c.corner.x;p.ai.tz=c.corner.z;p.ai.speed='sprint';if(hyp(p.x-c.corner.x,p.z-c.corner.z)<4&&!p.ai.celDone){p.ai.celDone=true;p.act={clip:p.ai.celClip||'arms_up',t0:now,t1:now+2.4,p:{}};}}
    else if(c.scorer&&!p.gk){p.ai.tx=c.scorer.x-1.2+((p.slot*13)%5)*.5;p.ai.tz=c.scorer.z-1+((p.slot*7)%4)*.6;p.ai.speed=u<1?'run':'sprint';if(u>2.6&&hyp(p.x-c.scorer.x,p.z-c.scorer.z)<2.4&&!p.ai.hugged){p.ai.hugged=true;p.act={clip:'hug',t0:now,t1:now+1.6,p:{}};}}}
   else{if(u>.4&&!p.ai.sadDone){p.ai.sadDone=true;const r=w.rnd();p.act={clip:r<.3?'hands_head':r<.55?'frustration':'sad_stand',t0:now,t1:now+2.2,p:{}};}p.ai.tx=p.x*.98;p.ai.tz=p.z;p.ai.speed='walk';}}
  if(u>(w.opts.goalPause??7)-.2)for(const p of w.all()){p.ai.celDone=false;p.ai.hugged=false;p.ai.sadDone=false;}}
 fulltime(){const w=this.w,now=w.time;const win=w.winner();for(const p of w.all()){if(p.off)continue;p.ai.want={vx:0,vz:0};const won=win&&w.teams[p.team].side===win;p.act={clip:won?(w.rnd()<.5?'arms_up':'jump_joy'):win?(w.rnd()<.5?'sad_stand':'hands_head'):'applaud',t0:now,t1:now+3,p:{}};p.emos.push({e:won?'veryhappy':win?'sad':'neutral',t0:now,t1:now+8,k:1});}}
}
function projSeg(px,pz,ax,az,bx,bz){const dx=bx-ax,dz=bz-az,l2=dx*dx+dz*dz||1;let u=((px-ax)*dx+(pz-az)*dz)/l2;u=clamp(u,0,1);const cx=ax+dx*u,cz=az+dz*u;return{u,d:hyp(px-cx,pz-cz)};}
function distToSeg(px,pz,ax,az,bx,bz){return projSeg(px,pz,ax,az,bx,bz).d;}
MD.FootballAI=AI;
})(typeof window!=='undefined'?(window.MD=window.MD||{}):(globalThis.MD=globalThis.MD||{}));
