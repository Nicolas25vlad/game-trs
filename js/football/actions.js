/* TRS26 — MUNDO DE PARTIDA · AÇÕES COM A BOLA: contato e domínio, posse, passe, chute, cabeceio, desarme, carrinho, proteção,
   dribles e ações do goleiro (agarrar, espalmar, repor, plano de defesa).
   Métodos de MD.World.World, separados de world.js por assunto; carregar depois de world.js. */
(function(MD){
'use strict';
const W=MD.World;const {U,D,clamp,lerp,PI,hyp,DT,G,BR,PHYS,n01,angDiff,goTo,emptyCmd}=W._k;
W.extend({
 /* ---------------- contatos: domínio, disputas, cabeceios, defesas ---------------- */
 contacts(){const b=this.ball,now=this.time;if(b.owner||b.frozen)return;if(this.restart)return;
  let best=null,bd=1e9;const all=this.all();
  const k=b.lastKick;const shotLive=k&&k.shot&&now-k.t<2.2&&b.lastTeam===k.team;
  for(const p of all){if(p.off||p.down>now||p.touchCool>now)continue;if(p.gk&&shotLive&&k.team!==p.team&&!(this.save&&this.save.gk===p&&this.save.ok))continue;if(p.lock>now&&!(p.act&&p.act.clip==='slide'))continue;
   const fx=p.x+Math.cos(p.f)*.28,fz=p.z+Math.sin(p.f)*.28;const d=hyp(b.x-fx,b.z-fz);const reach=.62+p.a.agility*.25+(p.gk&&this.inOwnBox(p,b.x,b.z)?.55:0);
   const hmax=p.gk&&this.inOwnBox(p,b.x,b.z)?2.35:(p.pending&&/header|shot|volley|bicycle/.test(p.pending.kind)?2.3:.95);
   if(d<reach&&b.y<hmax&&d<bd){bd=d;best=p;}}
  if(!best)return;this.touch(best);},
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
  this.gain(p,rv>6?'receive':'touch');},
 gain(p,how){const b=this.ball,now=this.time,prevTeam=b.lastTeam,prev=b.last;b.owner=p;b.spin=0;b.topspin=0;this.setLast(p);b.inNet=false;
  if(this.intended){const it=this.intended;if(it.team===p.team&&prev&&prev.team===p.team&&prev!==p){this.stats[p.team].passOk++;prev.st.passOk++;if(it.key)prev.st.keyPasses++;p.lastPassFrom=prev;p.lastPassT=now;}else if(it.team!==p.team){p.st.inter++;}this.intended=null;}
  if(how==='receive'||how==='duel'){p.act={clip:b.y>.6?'chest_control':'receive',t0:now,t1:now+.45,p:{}};}
  if(prevTeam!==p.team&&prevTeam>=0)this.event('turnover',{team:p.team,pid:p.id});
  /* advantage: equipe que sofreu falta manteve a bola */
  if(this.advantage&&p.team!==this.advantage.offTeam&&now-this.advantage.t<2){this.advantage.kept=true;}
  /* humano: troca automática para quem recebe */
  for(const H of this.humans)if(H.ti===p.team&&H.autoSwitch&&!p.human&&!p.gk){const other=this.humans.find(x=>x!==H&&x.ti===H.ti);if(!other||other.player!==p)this.controlled(H,p);break;}},
 setLast(p){const b=this.ball;b.last=p;b.lastTeam=p.team;b.lastTouchT=this.time;},
 nearest(ti,x,z,excl){let bp=null,bd=1e9;for(const p of this.teams[ti].players){if(p.off||p===excl)continue;const d=hyp(p.x-x,p.z-z);if(d<bd){bd=d;bp=p;}}return bp?{p:bp,d:bd}:null;},
 pressureOn(p){const n=this.nearest(this.opp(p.team),p.x,p.z);return n?clamp(1-(n.d-.8)/5,0,1):0;},
 inBox(endSign,x,z){const P=this.P;return endSign*x>P.L-P.boxDepth&&Math.abs(z)<P.boxHalfW&&endSign*x<=P.L+.3;},
 inOwnBox(p,x,z){return this.inBox(-this.teams[p.team].dir,x,z);},
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
  return true;},
 /* escolha do receptor (assistência de passe): companheiro no cone da direção, ponderando distância e marcação */
 passTarget(p,dir,kind,assist,power,wide){const mates=this.onPitch(p.team).filter(q=>q!==p);let best=null,bs=-1e9;const b=this.ball;
  for(const q of mates){const dx=q.x-b.x,dz=q.z-b.z,d=hyp(dx,dz);if(d<3)continue;const a=Math.abs(angDiff(Math.atan2(dz,dx),dir))*(wide?.25:1);if(a>(assist?1.05:.45))continue;
   const want=kind==='through'?24:kind==='cross'||kind==='long'||kind==='lob'?30:power!==undefined?8+power*30:14;
   const free=this.nearest(this.opp(p.team),q.x,q.z);let s=-a*16-Math.abs(d-want)*.35+(free?Math.min(free.d,6):6)*1.1+(q.gk?-14:0);
   if(kind==='cross')s+=this.inBox(this.teams[p.team].dir,q.x,q.z)?14:-8;
   if(s>bs){bs=s;best=q;}}
  if(!best&&assist&&!wide)return this.passTarget(p,dir,kind,assist,power,true);/* nada no cone: melhor companheiro disponível (ex.: saída de bola) */
  if(best&&assist){const lp=kind==='through'?this.leadPoint(p,best,kind):{x:best.x+best.vx*.35,z:best.z+best.vz*.35};return{to:best,x:lp.x,z:lp.z};}
  const dist=kind==='ground'?8+(power??.4)*30:kind==='through'?20+(power??.5)*18:18+(power??.5)*30;return{to:null,x:b.x+Math.cos(dir)*dist,z:b.z+Math.sin(dir)*dist};},
 leadPoint(p,q,kind){const b=this.ball;const d=hyp(q.x-b.x,q.z-b.z);const T=kind==='through'?.55+d/16:.4+d/20;const dirA=this.teams[q.team].dir;
  let lx=q.x+q.vx*T*.9+(kind==='through'?dirA*Math.min(7,2.5+q.a.pace*5)*(this.small?.5:1):0),lz=q.z+q.vz*T*.9;const L=this.P.L,Wd=this.P.W;const lim=L-(this.small?2.5:7.5);if(dirA*lx>lim)lx=dirA*lim;return{x:clamp(lx,-L+1,L-1),z:clamp(lz,-Wd+1.5,Wd-1.5)};},
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
  if(this.ai)this.ai.onShot(p);return true;},
 header(p,o){const b=this.ball,now=this.time;const ti=p.team,gx=this.goalX(ti),sgn=Math.sign(gx);const dGoal=hyp(gx-b.x,b.z);
  const toGoal=dGoal<(this.small?12:20)&&this.rel(ti,b.x)>0;let ang,v,vy;const hq=p.a.heading*.7+p.a.jumping*.3;const ex=this.execMul(p);
  if(toGoal||o.kind==='shot'){const gk=this.gk(this.opp(ti));const side=gk?(gk.z>b.z*.1?-1:1):1;const az=side*(this.P.goalHalfW-.5);ang=Math.atan2(az-b.z,gx-b.x)+this.gauss()*((1-hq)*.12+.04)*ex;v=9+hq*8;const T=dGoal/v;vy=(.6-b.y)/T+G*T/2+this.gauss()*.8;
   this.stats[ti].shots++;p.st.shots++;b.lastKick={by:p.id,team:ti,t:now,kind:'shot',shot:true,header:true,xg:this.xg(p,b.x,b.z)*.7};this.stats[ti].xg+=b.lastKick.xg;this.event('shot',{team:ti,pid:p.id,header:true});}
  else{const pick=o.dirx||o.dirz?this.passTarget(p,Math.atan2(o.dirz,o.dirx),'lob',true):this.passTarget(p,Math.atan2(b.z*-.3,this.teams[ti].dir),'lob',true);
   ang=Math.atan2(pick.z-b.z,pick.x-b.x)+this.gauss()*((1-hq)*.2+.06);v=7+hq*6;vy=2.5;b.lastKick={by:p.id,team:ti,t:now,kind:'header'};this.intended={from:p,to:pick.to,team:ti,t:now,kind:'header'};}
  b.owner=null;b.vx=Math.cos(ang)*v;b.vz=Math.sin(ang)*v;b.vy=vy;b.spin=0;b.topspin=0;this.setLast(p);p.touchCool=now+.4;p.lock=now+.45;
  p.act={clip:b.y>1.9?'jump_header':'header',t0:now-.15,t1:now+.75,p:{}};this.fxAdd('header',{});this.snapOffside(p);},
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
  p.lock=now+.65;p.beaten=now+.8;p.act={clip:'beaten',t0:now,t1:now+.7,p:{}};return true;},
 /* carrinho: desliza ~0,8 s; toca a bola ou o atleta primeiro (falta, cartão) */
 slide(p){const now=this.time;if(p.down>now||p.lock>now||p.tackleCool>now)return false;const sp=Math.max(p.sp,4.5)+1.2;p.vx=Math.cos(p.f)*sp;p.vz=Math.sin(p.f)*sp;
  p.lock=now+.85;p.down=now+1.35;p.tackleCool=now+1.6;p.act={clip:'slide',t0:now,t1:now+1.2,p:{}};p.sliding={t0:now,hit:false};this.stats[p.team].tackles++;p.st.tackles++;return true;},
 slideContacts(){const now=this.time,b=this.ball;for(const p of this.all()){const s=p.sliding;if(!s||s.hit)continue;if(now-s.t0>.7){p.sliding=null;continue;}if(now-s.t0<.08)continue;
   const fx=p.x+Math.cos(p.f)*.7,fz=p.z+Math.sin(p.f)*.7;const db=hyp(b.x-fx,b.z-fz);const c=b.owner&&b.owner.team!==p.team?b.owner:null;
   const victim=c||this.nearestOppWithin(p,1.05);
   if(db<.95&&b.y<.6){s.hit=true;if(victim&&hyp(victim.x-fx,victim.z-fz)<.5&&this.rnd()<.25+p.a.aggression*.2){this.foul(p,victim,{kind:'slide',sev:.5+p.a.aggression*.3});return;}
    this.stats[p.team].tackleOk++;this.kickLoose(p,6+this.rnd()*4,true);if(c){c.lock=now+.5;c.act={clip:'fall_slide',t0:now,t1:now+1.1,p:{}};c.down=now+.9;}return;}
   if(victim&&hyp(victim.x-fx,victim.z-fz)<.55){s.hit=true;const behind=Math.abs(angDiff(Math.atan2(p.z-victim.z,p.x-victim.x),victim.f))>2.2;this.foul(p,victim,{kind:'slide',sev:.7+(behind?.35:0)+p.a.aggression*.25});return;}}},
 nearestOppWithin(p,r){let best=null,bd=r;for(const q of this.teams[this.opp(p.team)].players){if(q.off)continue;const d=hyp(q.x-p.x,q.z-p.z);if(d<bd){bd=d;best=q;}}return best;},
 kickLoose(p,speed,slide){const b=this.ball;b.owner=null;const a=p.f+this.gauss()*.7;b.vx=Math.cos(a)*speed;b.vz=Math.sin(a)*speed;b.vy=slide?.5:.8+this.rnd();b.spin=0;b.topspin=0;this.setLast(p);p.touchCool=this.time+.25;this.intended=null;this.fxAdd('tackle',{});},
 /* proteção de bola e dribles acionáveis */
 shield(p){p.shield=this.time+.35;},
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
  return true;},
 /* goleiro */
 gkCatch(p){const b=this.ball,now=this.time;b.owner=p;b.vx=b.vy=b.vz=0;b.spin=0;b.topspin=0;this.setLast(p);this.gkHolding=p;this.gkHoldT=now;this.intended=null;this.offsideSnap=null;
  const shot=b.lastKick&&b.lastKick.shot&&b.lastKick.team!==p.team&&now-b.lastKick.t<2.2;if(shot){this.stats[p.team].saves++;p.st.saves++;this.stats[this.opp(p.team)].onTarget++;const sh=this.byId(b.lastKick.by);if(sh)sh.st.onT++;this.event('save',{team:p.team,pid:p.id,catch:true});this.fxAdd('save',{});}
  if(!p.act||!/gk_/.test(p.act.clip))p.act={clip:'gk_catch',t0:now,t1:now+.7,p:{}};p.lock=now+.5;
  for(const H of this.humans)if(H.ti===p.team&&H.player!==p){this.controlled(H,p);}},
 parry(p,k){const b=this.ball,now=this.time;const sgn=Math.sign(b.x)||1;const side=Math.sign(b.z-p.z)||(this.rnd()<.5?-1:1);
  const wide=this.rnd()<.55;b.vx=wide?b.vx*(.25+this.rnd()*.2):-b.vx*(.15+this.rnd()*.15);b.vz=side*(wide?6+this.rnd()*7:3+this.rnd()*5);b.vy=Math.abs(b.vy)*.3+1.5+this.rnd()*3;b.owner=null;b.spin=0;b.topspin=0;this.setLast(p);p.touchCool=now+.4;
  const shot=b.lastKick&&b.lastKick.shot&&b.lastKick.team!==p.team&&now-b.lastKick.t<2.2;if(shot){this.stats[p.team].saves++;p.st.saves++;this.stats[this.opp(p.team)].onTarget++;const sh=this.byId(b.lastKick.by);if(sh)sh.st.onT++;this.event('save',{team:p.team,pid:p.id});this.fxAdd('save',{});}this.intended=null;},
 gkDistribute(p,o){const b=this.ball;if(b.owner!==p)return false;this.gkHolding=null;o=o||{};
  if(o.kind==='throw'){b.y=1.6;const ok=this.pass(p,{...o,kind:'ground',throwIn:false,set:'gk'});p.act={clip:'gk_throw',t0:this.time,t1:this.time+.8,p:{}};return ok;}
  b.y=BR;return this.pass(p,{...o,kind:o.kind||'long'});},
 planSave(gk,ok,dt,dz){const k=this.ball.lastKick;gk.ai.plannedFor=k;this.save={gk,ok,t:this.time+dt,dz,k,catch:ok&&this.rnd()<.35};}
});
})(typeof window!=='undefined'?(window.MD=window.MD||{}):(globalThis.MD=globalThis.MD||{}));
