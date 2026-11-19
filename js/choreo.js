/* MATCHDAY 0.5 — coreografia: converte o roteiro (beats) do motor em trilhas pré-calculadas (30 fps)
   para 22 jogadores, árbitro, bandeirinhas e bola. Replays, câmera lenta e ângulos diferentes reproduzem
   exatamente a mesma trilha — o visual nunca altera o desfecho calculado pelo motor.
   Posições de trabalho no quadro de ataque; convertidas para o mundo apenas no fim. */
(function(MD){
'use strict';
const U=MD.U,clamp=U.clamp,lerp=U.lerp;
const C={FPS:30};
/* Geometria do campo da modalidade ativa (pro: 108 x 68; Germinare: campo reduzido). Escalas relativas ao campo pro. */
const PT=MD.Rules.PITCH;const SX=()=>PT.L/54,SZ=()=>PT.W/34;
const BALL_R=.11;
const MOVE_DUR={short:.75,direction:.85,speed:.9,cutIn:.85,bodyFeint:1,drag:1,sharpCut:.9,turn:1.1,shotFeint:1.05,stepover:1.2,flick:1.1,rainbow:1.25,nutmeg:1.05,sombrero:1.3,elastico:1.15};
const PASS={ground:[15,0,.11],through:[16,0,.11],lofted:[17,2.4,.3],long:[21,5,.5],cross:[19,3.3,2.1],lowcross:[18,0,.11],cutback:[14,0,.11],switch:[22,4.6,.4],chip:[13,3,.4],header_pass:[12,1,.4],oneTwo:[16,0,.11]};
const PASS_CLIP={ground:'pass',through:'pass',lofted:'pass_long',long:'pass_long',cross:'cross',lowcross:'cross_low',cutback:'pass',switch:'pass_long',chip:'chip',header_pass:'header',oneTwo:'pass_first'};
const SHOT_CLIP={power:'shot_power',placed:'shot_placed',low:'shot_low',firstTime:'shot_first',chip:'chip',volley:'volley',bicycle:'bicycle',header:'header',longshot:'shot_power',freekick:'freekick',owngoal:'clear_fail',penalty:'penalty_kick'};

class Script{
 constructor(ev,ctx){this.ev=ev;this.ctx=ctx;this.rng=U.rng(ev.seed||1);this.t=0;this.actors=[];this.byId=new Map();this.wps=[];this.acts=[];this.emos=[];this.marks=[];this.cams=[];this.overlays=[];
  this.segs=[];this.dead=[];this.cuts=[];this.poss=[{t:0,s:'A'}];this.cur=[0,0];this.holder=-1;this.applyAt=null;this.replay=null;this.whistled=false;this.mainShot=null;
  this.dir=ev.dir||(ev.attack==='home'?1:-1)*(ev.half==='second'?-1:1);this.setupActors();}
 setupActors(){const ev=this.ev,ctx=this.ctx;const sides={A:ev.attack,D:ev.attack==='home'?'away':'home'};
  for(const s of ['A','D']){const side=sides[s];const ids=(ev.lineup&&ev.lineup[side])||[];ids.forEach((id,slot)=>{if(!id)return;const info=ctx.resolve(id);if(!info)return;
    const a={i:this.actors.length,id,s,side,slot,kind:info.group==='GK'?'keeper':'player',info,base:info.base||[0,0],speed:6.2+(info.attrs?.pace||70)/38,accel:6+(info.attrs?.accel||70)/22,energy:info.energy??1,wps:[]};
    a.speed*=.86+.14*a.energy;this.actors.push(a);this.byId.set(id,a.i);});}
  for(const k of ['ref','ar1','ar2']){const a={i:this.actors.length,id:k,s:'R',side:'ref',slot:-1,kind:k==='ref'?'ref':'ar',info:{name:k==='ref'?'Árbitro':'Assistente',group:'REF'},base:[0,0],speed:7.2,accel:7,energy:1,wps:[]};this.actors.push(a);}
  this.REF=this.actors.length-3;this.AR1=this.actors.length-2;this.AR2=this.actors.length-1;}
 A(ref){if(!ref)return -1;const i=this.byId.get(ref.id);return i===undefined?-1:i;}
 wp(a,t,x,z,o){if(a<0)return;this.actors[a].wps.push({t,x,z,face:o?.face,tele:o?.tele,soft:o?.soft,walk:o?.walk});}
 act(a,clip,t0,dur,p){if(a<0)return;this.acts.push({a,clip,t0,t1:t0+dur,p:p||{}});}
 emo(a,e,t0,dur,k){if(a<0)return;this.emos.push({a,e,t0,t1:t0+dur,k:k??1});}
 mark(t,type,d){this.marks.push({t,type,...(d||{})});}
 cam(t,mode,o){this.cams.push({t,mode,...(o||{})});}
 seg(s){this.segs.push(s);return s;}
 hold(a,t0,o){this.seg({type:'hold',a,t0,...(o||{})});this.holder=a;}
 deadFrom(t){this.dead.push(t);}
 team(s){return this.actors.filter(a=>a.s===s);}
 keeper(s){return this.actors.find(a=>a.s===s&&a.kind==='keeper');}
 lastWp(a){const w=this.actors[a].wps;return w.length?w[w.length-1]:null;}
 face(from,to){return Math.atan2(to[1]-from[1],to[0]-from[0]);}
 near(s,x,z,excl){let best=-1,bd=1e9;for(const a of this.actors){if(a.s!==s||a.kind==='keeper'||(excl&&excl.includes(a.i)))continue;const p=this.estPos(a.i,this.t);const d=Math.hypot(p[0]-x,p[1]-z);if(d<bd){bd=d;best=a.i;}}return best;}
 /* posição estimada (antes da simulação) — último waypoint ou posição base deslocada */
 estPos(a,t){const w=this.actors[a].wps.filter(q=>q.t<=t+.01);if(w.length)return[w[w.length-1].x,w[w.length-1].z];const ac=this.actors[a];return ac.s==='A'?[ac.base[0]+18*SX(),ac.base[1]]:ac.s==='D'?[-ac.base[0]-8*SX(),-ac.base[1]]:[this.cur[0]-8*SX(),this.cur[1]-10*SZ()];}
}

/* ---------- Construção do roteiro a partir dos beats ---------- */
C.build=function(ev,ctx){C.useMode(ev.mode);const S=new Script(ev,ctx);const beats=ev.beats||[];const r=S.rng;
 S.cam(0,'broadcast');
 for(let bi=0;bi<beats.length;bi++){const b=beats[bi],next=beats[bi+1];S.future=new Set();for(const x of beats.slice(bi+1))for(const k of ['by','to','on','vs','att','def','blocker','keeper'])if(x[k]&&x[k].id)S.future.add(x[k].id);const h=C.H[b.k];if(h)h(S,b,next,bi,beats);}
 if(S.applyAt===null)S.applyAt=Math.max(S.t-1,.5);
 S.duration=Math.max(S.t+.8,3);
 const tr=C.bake(S);tr.startT=ctx&&ctx.noTrim?0:C.trim(tr);return tr;};
/* Ajusta a geometria ao campo da modalidade do lance (replays de partidas de outra modalidade continuam corretos). */
C.useMode=function(id){if(!id||!MD.Modes)return;const small=id==='germinare';if(!!PT.small!==small)MD.Modes.apply(MD.Modes.LIST[id]);};
/* Lances objetivos: a apresentação começa no momento relevante da construção (a bola chegando ao campo de ataque),
   sem longas introduções no meio-campo — mas com contexto suficiente (passes essenciais) antes do desfecho. */
C.trim=function(tr){const ap=tr.applyAt;if(ap===null||ap===undefined||tr.ambient)return 0;const L=PT.L;let first=-1;
 for(let f=0;f<tr.n;f++){if(tr.bx[f]*tr.dir>L*.18){first=f/tr.fps;break;}}
 let st=first<0?0:first-1.6;st=Math.max(st,ap-(PT.small?7:9.5));st=Math.min(st,ap-(PT.small?3.5:4.5));st=Math.max(0,st);
 /* não começa no meio de uma cena montada (pênalti/escanteio/falta): recua para o corte */
 for(const c of tr.cuts)if(c>st&&c<st+1.2)st=c;return+st.toFixed(2);};

C.H={
 start(S,b){const a=S.A(b.by);if(a<0)return;S.cur=b.at.slice();S.ball0=b.at.slice();if(b.ctx==='corner'){C.setupCorner(S,b);return;}
  if(b.ctx==='throwin'){const sz=Math.sign(b.at[1]);S.wp(a,0,b.at[0],sz*(PT.W+.4),{face:-sz*Math.PI/2});S.hold(a,0,{hands:true});S.throwIn=a;S.t=1.1;S.act(a,'throw_in',.3,1.3,{face:-sz*Math.PI/2});S.overlays.push({t0:0,t1:2.2,kind:'label',text:'LATERAL'});return;}
  S.wp(a,0,b.at[0]-.45,b.at[1],{face:0});S.hold(a,0);S.t=.7;
  if(b.ctx==='counter')S.overlays.push({t0:.2,t1:2.6,kind:'label',text:'CONTRA-ATAQUE'});
  S.overlays.push({t0:.5,t1:3.6,kind:'player',id:S.actors[a].id});},
 pass(S,b,next){const p=S.A(b.by),rc=S.A(b.to);if(p<0)return;const from=S.cur.slice(),to=b.at.slice();const st=PASS[b.style]||PASS.ground;
  const firstTime=S.firstTime===p;S.firstTime=-1;let tk=S.t+(firstTime?0:.42);const fdir=S.face(from,to);
  const st0=PASS[b.style]||PASS.ground;const T0=clamp(Math.hypot(to[0]-from[0],to[1]-from[1])/st0[0]+(st0[1]?.2:0),.35,3.4);
  if(rc>=0&&b.ok){const rp=S.estPos(rc,S.t);const need=Math.hypot(to[0]-rp[0],to[1]-rp[1])/(S.actors[rc].speed*.88);if(S.t+need>tk+T0){tk=S.t+need-T0;if(firstTime){S.hold(p,S.t);}}}
  if(!firstTime)S.wp(p,tk,from[0]-Math.cos(fdir)*.42,from[1]-Math.sin(fdir)*.42,{face:fdir});
  const thr=S.throwIn===p;S.throwIn=-1;if(!thr)S.act(p,PASS_CLIP[b.style]||'pass',tk-.3,.8,{face:fdir,foot:S.actors[p].info.foot});S.mark(tk,thr?'touch':'kick',{power:st[0],by:p});
  if(rc>=0&&b.ok&&!firstTime&&S.rng()<.55)S.act(rc,'call',Math.max(0,tk-1.1),.9,{});
  const d=Math.hypot(to[0]-from[0],to[1]-from[1]);let T=clamp(d/st[0]+(st[1]?.2:0),.35,3.4);
  let y1=st[2];if(b.style==='cross'&&next&&next.k!=='duel_air')y1=next?.k==='shot'&&next.type==='volley'?1.0:1.4;
  if(!b.ok&&b.cut){const c=S.A(b.cut.by);const f=b.cut.style==='intercept'?.72:b.cut.style==='block'?.55:1;const ip=[lerp(from[0],to[0],f),lerp(from[1],to[1],f)];const ti=tk+T*f;
   const yI=b.cut.style==='keeper_claim'?2.3:b.cut.style==='header_clear'?2.1:.11;
   S.seg(st[1]?{type:'air',t0:tk,t1:ti,p0:from,p1:ip,y0:.11,y1:yI,h:st[1]*f}:{type:'roll',t0:tk,t1:ti,p0:from,p1:ip});
   if(rc>=0)S.wp(rc,ti+.1,to[0]-.6,to[1]);
   if(c>=0){const cf=S.face(ip,from);S.wp(c,ti,ip[0]+Math.cos(cf)*.45,ip[1]+Math.sin(cf)*.45,{face:cf});
    const clip={intercept:'intercept',header_clear:'jump_header',block:'block_slide',keeper_claim:'gk_claim'}[b.cut.style]||'intercept';S.act(c,clip,ti-(clip==='jump_header'||clip==='gk_claim'?.45:.25),1.1,{face:cf});
    S.mark(ti,clip==='gk_claim'?'catch':'touch');S.poss.push({t:ti,s:'D'});
    if(clip==='gk_claim'){S.hold(c,ti,{hands:true});S.wp(c,ti+1.6,ip[0]-1.5,ip[1]*.6);S.emo(c,'concentrated',ti,2);S.t=ti+1.8;}
    else if(clip==='jump_header'||clip==='block_slide'){const away=[ip[0]-(18+S.rng()*10)*SX(),clamp(ip[1]+(S.rng()-.5)*30*SZ(),-(PT.W-4*SZ()),PT.W-4*SZ())];S.seg({type:'air',t0:ti,t1:ti+1.4,p0:ip,p1:away,y0:yI,y1:.11,h:4});S.cur=away;S.holder=-1;S.t=ti+1.2;}
    else{S.hold(c,ti);const out=[ip[0]-7*SX(),ip[1]*.8];S.wp(c,ti+1.4,out[0],out[1]);S.cur=out;S.t=ti+1.5;}
    if(rc>=0)S.emo(rc,'frustrated',ti+.2,1.6,.6);}
   else S.t=tk+T;return;}
  S.seg(thr?{type:'air',t0:tk,t1:tk+T,p0:from,p1:to,y0:2.1,y1:.4,h:.6}:st[1]?{type:'air',t0:tk,t1:tk+T,p0:from,p1:to,y0:.11,y1:y1,h:st[1]}:{type:'roll',t0:tk,t1:tk+T,p0:from,p1:to});
  const ta=tk+T;if(rc>=0){const rf=next&&(next.k==='shot'||next.k==='duel_air')?S.face(to,[PT.L,0]):S.face(from,to);S.wp(rc,ta,to[0]-Math.cos(rf)*.4,to[1]-Math.sin(rf)*.4,{face:rf});
   const quick=next&&(next.k==='shot'&&next.by&&next.by.id===b.to.id||next.k==='pass'&&next.by&&next.by.id===b.to.id&&(next.style==='oneTwo'||next.style==='cutback'));
   if(next&&next.k==='duel_air'){S.cur=to;S.t=ta;S.airArrive=ta;S.holder=-1;return;}
   if(quick){S.firstTime=rc;S.cur=to;S.t=ta;S.holder=-1;return;}
   S.act(rc,y1>.8?'chest_control':'receive',ta-.15,.55,{face:rf});S.hold(rc,ta);}
  S.cur=to;S.t=ta+.25;
  if(b.offside&&next&&next.k==='offside'){S.offsideAt=ta;}},
 carry(S,b){const a=S.A(b.by);if(a<0)return;const d=Math.hypot(b.to[0]-S.cur[0],b.to[1]-S.cur[1]);const sp=5.4+(S.actors[a].info.attrs?.pace||70)/42;const T=Math.max(.5,d/sp);const f=S.face(S.cur,b.to);
  S.wp(a,S.t+T,b.to[0]-Math.cos(f)*.42,b.to[1]-Math.sin(f)*.42,{face:f});if(S.holder!==a)S.hold(a,S.t);S.cur=b.to.slice();S.t+=T;},
 skill(S,b,next){const a=S.A(b.by),v=S.A(b.vs);if(a<0)return;const d=Math.hypot(b.at[0]-S.cur[0],b.at[1]-S.cur[1]);const ts=S.t+Math.max(.35,d/6.2);const f=S.face(S.cur,b.at);
  S.wp(a,ts,b.at[0]-Math.cos(f)*.42,b.at[1]-Math.sin(f)*.42,{face:f});if(S.holder!==a)S.hold(a,S.t);
  if(v>=0){S.wp(v,ts-.25,b.at[0]+1.7,b.at[1]+(S.rng()-.5)*.6,{face:Math.PI});S.act(v,'defend_stance',ts-.9,1,{face:Math.PI});}
  const md=MOVE_DUR[b.move]||.9;S.act(a,'skill_'+b.move,ts,md,{face:f,ok:b.ok,foot:S.actors[a].info.foot});
  if(b.move!=='short'&&b.move!=='speed'&&b.move!=='direction'&&b.ok)S.overlays.push({t0:ts,t1:ts+2.2,kind:'skill',text:MD.Engine.MOVE_LABEL[b.move]||'DRIBLE',id:S.actors[a].id});
  if(MD.Engine.MOVES.find(m=>m[0]===b.move)?.[1]>=3&&b.ok)S.cam(ts-.4,'side_low',{a,until:ts+md+.3});
  if(b.ok){const to=b.to;const tEnd=ts+md;
   if(b.move==='nutmeg'&&v>=0){S.seg({type:'roll',t0:ts+.25,t1:tEnd-.1,p0:b.at,p1:to});S.hold(a,tEnd-.1);}
   else if(b.move==='sombrero'||b.move==='flick'||b.move==='rainbow'){S.seg({type:'air',t0:ts+.3,t1:tEnd-.05,p0:b.at,p1:to,y0:.11,y1:.2,h:b.move==='rainbow'?2.1:1.6});S.hold(a,tEnd-.05);}
   else if(b.move==='speed'){S.seg({type:'roll',t0:ts+.15,t1:tEnd,p0:b.at,p1:to});S.hold(a,tEnd);}
   else S.hold(a,ts,{skill:b.move,t1:tEnd});
   S.wp(a,tEnd,to[0]-.4,to[1],{face:S.face(b.at,to)});
   if(v>=0){S.act(v,b.move==='nutmeg'?'beaten_nutmeg':'beaten',ts+.2,1.1,{side:S.rng()<.5?1:-1});S.emo(v,'surprised',ts+.3,1.6,.8);S.wp(v,tEnd+.4,b.at[0]+.8,b.at[1]+(S.rng()-.5)*2.5,{soft:true});}
   S.emo(a,'happy',tEnd,1.4,.5);S.cur=to.slice();S.t=tEnd;}
  else{S.cur=b.at.slice();S.t=ts+md*.5;}},
 tackle(S,b){const d=S.A(b.by),v=S.A(b.on);if(d<0)return;const t=S.t;const clip=b.style==='slide'?'slide':b.style==='shoulder'?'shoulder':'tackle';
  S.wp(d,t,b.at[0]+.75,b.at[1]+(b.style==='slide'?.9:.3),{face:Math.PI});S.act(d,clip,t-(clip==='slide'?.35:.2),clip==='slide'?1.3:.8,{face:Math.PI});S.mark(t,'tackle');
  const loose=[b.at[0]-4-S.rng()*4,b.at[1]+(S.rng()-.5)*6];S.seg({type:'roll',t0:t,t1:t+.8,p0:S.cur.slice(),p1:loose});S.holder=-1;
  if(v>=0){S.act(v,b.style==='slide'&&S.rng()<.5?'fall_trip':'stumble',t+.05,b.style==='slide'?2.2:1.0,{});S.emo(v,'frustrated',t+.3,2.2,.8);}
  S.poss.push({t,s:'D'});const col=S.near('D',loose[0],loose[1],[]);const g=col>=0?col:d;S.wp(g,t+.9,loose[0]-.4,loose[1]);S.hold(g,t+.9);const out=[loose[0]-9*SX(),loose[1]*.7];S.wp(g,t+2.4,out[0],out[1]);S.cur=out;S.t=t+2.4;S.emo(d,'happy',t+.4,1.5,.5);S.cam(t-.6,'side_low',{a:d,until:t+1.6});},
 foul(S,b,next){const d=S.A(b.by),v=S.A(b.on);if(d<0||v<0)return;const tf=S.t+.18;const vp=b.at;
  const fromSide=b.fall==='slide'?[vp[0]+.6,vp[1]+1.1]:[vp[0]-.55,vp[1]+.35];
  S.wp(d,tf,fromSide[0],fromSide[1],{face:S.face(fromSide,vp)});S.wp(v,tf,vp[0],vp[1],{face:0});
  const clip=b.fall==='slide'?'slide':b.fall==='push'?'push':b.offence==='hold'?'hold_shirt':'tackle_trip';S.act(d,clip,tf-(clip==='slide'?.35:.25),clip==='slide'?1.4:1,{face:S.face(fromSide,vp)});
  S.mark(tf,'foul_contact');S.cam(tf-1.1,'side_low',{a:v,until:tf+1.8});
  if(b.advantage){S.act(v,'stumble',tf,.9,{});S.act(S.REF,'advantage',tf+.35,1.2,{});S.overlays.push({t0:tf+.3,t1:tf+2.6,kind:'label',text:'LEI DA VANTAGEM'});S.t=tf+.35;S.advantage={d,card:b.card};return;}
  const loose=[vp[0]+3+S.rng()*2.5,vp[1]+(S.rng()-.5)*3];S.seg({type:'roll',t0:tf,t1:tf+.9,p0:S.cur.slice(),p1:loose});S.holder=-1;S.cur=loose;
  const fallClip=b.fall==='push'?'fall_push':b.fall==='slide'?'fall_slide':'fall_trip';S.act(v,fallClip,tf,3.4,{});S.emo(v,'pain',tf+.2,3.4,1);
  S.mark(tf+.55,'whistle');S.act(S.REF,'whistle',tf+.45,.9,{});S.deadFrom(tf+.6);S.whistled=true;
  S.wp(S.REF,tf+2.6,vp[0]-3.5,vp[1]-2.5,{face:0,soft:true});S.act(d,'protest',tf+1.2,1.8,{});S.emo(d,b.card?'worried':'angry',tf+1,2.5,.7);
  const mate=S.near('A',vp[0],vp[1],[v]);if(mate>=0){S.act(mate,'point',tf+1.3,1.4,{});S.emo(mate,'angry',tf+1.2,2,.6);}
  const label=b.restart==='penalty'?'PÊNALTI!':b.restart==='indirect_free_kick'?'FALTA INDIRETA':b.dangerous?'FALTA PERIGOSA':'FALTA';
  S.overlays.push({t0:tf+.7,t1:tf+3.4,kind:'label',text:label,tone:b.restart==='penalty'?'hot':''});
  S.foulSpot=vp;S.foulers={d,v};S.t=tf+(b.card?1.3:2.4);
  if(S.applyAt===null&&!b.card&&b.restart!=='penalty')S.applyAt=tf+.6;},
 whistle(S,b){if(S.whistled){S.whistled=false;return;}const t=S.t+.1;S.mark(t,'whistle');S.act(S.REF,'whistle',t-.1,.9,{});S.deadFrom(t+.1);S.t=t+.6;
  if(S.advantage&&S.advantage.card){S.foulers={d:S.advantage.d,v:-1};}},
 card(S,b){const p=S.A(b.on);if(p<0)return;const t=S.t;const pp=S.estPos(p,t);S.wp(p,t+1.2,pp[0]+.6,pp[1]+.3,{soft:true});
  S.wp(S.REF,t+1.6,pp[0]-1.3,pp[1]-.3,{face:S.face([pp[0]-1.3,pp[1]-.3],pp),soft:true});S.act(S.REF,'show_card',t+1.7,1.8,{color:b.color});S.mark(t+1.95,'card',{color:b.color});
  S.cam(t+1.2,'ref',{a:S.REF,b:p,until:t+3.6});S.act(p,b.color==='red'?'hands_head':'protest',t+2,1.6,{});S.emo(p,b.color==='red'?'angry':'worried',t+1.9,3,1);
  S.overlays.push({t0:t+2,t1:t+5.5,kind:'card',color:b.color,id:S.actors[p].id,second:b.second,reason:b.reason});
  if(S.applyAt===null)S.applyAt=t+1.95;
  if(b.color==='red'){S.wp(p,t+4,pp[0],pp[1]-5,{soft:true});S.wp(p,t+9,pp[0]*.3,-(PT.W+1.5),{soft:true});S.redOff=p;}S.t=t+3.8;},
 point_spot(S){const t=S.t;S.wp(S.REF,t+1.5,PT.L-15*SX(),-3*SZ(),{face:0,soft:true});S.act(S.REF,'point_spot',t+1.5,1.8,{});S.mark(t+1.4,'whistle_long');S.mark(t+1.6,'crowd_up');
  S.cam(t+.4,'ref',{a:S.REF,until:t+3.2});for(const a of S.team('D').slice(0,4))if(a.kind!=='keeper'){S.act(a.i,'protest',t+1.6,1.6,{});S.emo(a.i,'angry',t+1.6,2.4,.8);}
  for(const a of S.team('A').filter(x=>x.kind!=='keeper').slice(0,3)){S.act(a.i,'arms_up',t+1.6,1.4,{});S.emo(a.i,'happy',t+1.6,2,.7);}
  S.t=t+3.4;},
 penalty(S,b){const t0=S.t+.1;const tk=S.A(b.by),gk=S.A(b.keeper);C.setupPenalty(S,t0,tk,gk);
  const kickT=t0+3.3;S.mark(t0+1.9,'whistle');S.act(S.REF,'whistle',t0+1.8,.8,{});
  S.wp(tk,t0+2.2,PT.L-PT.penSpot-2.6,-1.3,{face:.1});S.wp(tk,kickT,PT.L-PT.penSpot-.45,-.28,{face:0});S.act(tk,'penalty_kick',kickT-.32,.9,{face:0,foot:S.actors[tk].info.foot});S.emo(tk,'concentrated',t0,kickT-t0+.4,1);
  if(gk>=0){S.act(gk,'gk_ready',t0+.4,kickT-t0-.3,{bounce:1});S.emo(gk,'concentrated',t0,kickT-t0+.3,1);}
  S.overlays.push({t0:t0+.4,t1:t0+3,kind:'player',id:S.actors[tk].id,sub:'COBRADOR'});
  S.cam(t0,'penalty',{a:tk});S.mark(kickT,'kick',{power:26});
  C.shotFlight(S,{tk:kickT,from:[PT.L-PT.penSpot,0],y0:BALL_R,target:b.target,outcome:b.outcome,power:b.power||26,keeper:gk,shooter:tk,dive:b.keeperDive,save:b.outcome==='save'?{style:'dive',side:b.keeperDive,high:b.target[1]>1.2,great:true}:null,penalty:true,rebound:b.rebound});
  S.replay={t0:kickT-1.4,t1:kickT+1.4,cam:'behind_goal'};
  if(b.rebound){const rb=S.A(b.rebound.by);const rp=S.reboundSpot||[PT.L-PT.penSpot*.55,0];S.wp(rb,S.t+.9,rp[0]-.4,rp[1]);S.cur=rp;S.t+=.9;S.firstTime=rb;
   C.H.shot(S,{by:b.rebound.by,from:rp,type:'firstTime',outcome:b.rebound.outcome,target:b.rebound.outcome==='goal'?[(S.rng()-.5)*5,.6]:[(S.rng()-.5)*2,.8],power:24,keeper:b.keeper,save:b.rebound.outcome==='save'?{style:'parry',side:1,high:false}:null});}},
 setpiece(S,b){if(b.type==='corner'){if(!S.cornerSet)C.setupCorner(S,b);return;}if(b.type==='freekick')C.setupFreeKick(S,b);},
 duel_air(S,b,next){const at=S.A(b.att),df=S.A(b.def);const ta=S.airArrive??S.t;S.airArrive=null;
  if(at>=0){S.wp(at,ta,b.at[0]-.35,b.at[1],{face:S.face(b.at,[PT.L,0])});S.act(at,'jump_header',ta-.45,1.1,{face:S.face(b.at,[PT.L,0])});}
  if(df>=0){S.wp(df,ta,b.at[0]+.45,b.at[1]+.35,{face:Math.PI});S.act(df,'jump_header',ta-.45,1.1,{face:Math.PI});}
  S.mark(ta,'header');
  if(b.won==='A'){S.firstTime=at;S.headerAt=ta;S.t=ta;S.cur=b.at.slice();return;}
  const away=[b.at[0]-(20+S.rng()*8)*SX(),clamp(b.at[1]+(S.rng()-.5)*34*SZ(),-(PT.W-4*SZ()),PT.W-4*SZ())];S.seg({type:'air',t0:ta,t1:ta+1.5,p0:b.at,p1:away,y0:2.2,y1:BALL_R,h:4});S.poss.push({t:ta,s:'D'});
  if(at>=0)S.emo(at,'frustrated',ta+.6,1.5,.6);S.cur=away;S.holder=-1;S.t=ta+1.3;},
 shot(S,b,next,bi,beats){const s=S.A(b.by);if(s<0)return;const first=S.firstTime===s;S.firstTime=-1;
  const tk=first?S.t:S.t+.45;const from=first&&S.reboundSpot&&S.cur===S.reboundSpot?S.cur.slice():b.from.slice();const tgtDir=S.face(from,[PT.L,b.target?b.target[0]:0]);
  if(!first&&b.type!=='owngoal')S.wp(s,tk,from[0]-Math.cos(tgtDir)*.42,from[1]-Math.sin(tgtDir)*.42,{face:tgtDir});
  const y0=b.type==='header'?2.05:b.type==='bicycle'?1.5:b.type==='volley'?.85:BALL_R;
  const clip=SHOT_CLIP[b.type]||'shot_power';S.act(s,clip,tk-(clip==='header'?.45:clip==='bicycle'?.55:.32),clip==='bicycle'?1.6:1,{face:tgtDir,foot:S.actors[s].info.foot});
  S.mark(tk,b.type==='header'?'header':'kick',{power:b.power||24,by:s,shot:true});
  if(S.overlays.every(o=>o.kind!=='player'||o.id!==S.actors[s].id))S.overlays.push({t0:Math.max(0,tk-2.5),t1:tk+.4,kind:'player',id:S.actors[s].id});
  const kp=S.A(b.keeper);const goalNext=(beats||[]).slice((bi??0)+1).some(x=>x.k==='disallow');
  if(!S.mainShot)S.replay={t0:Math.max(0,tk-3),t1:tk+1.6,cam:b.type==='header'||b.type==='volley'||b.type==='bicycle'?'side_low':'behind_goal'};
  S.mainShot=S.mainShot||{tk};
  if(b.outcome==='blocked'){const bl=S.A(b.blocker);const bp=[from[0]+2.2*Math.cos(tgtDir),from[1]+2.2*Math.sin(tgtDir)];const tb=tk+.12;
   if(bl>=0){S.wp(bl,tb,bp[0]+.3,bp[1],{face:Math.PI});S.act(bl,S.rng()<.5?'block':'block_slide',tb-.3,1.1,{face:Math.PI});}
   S.seg({type:'air',t0:tk,t1:tb,p0:from,p1:bp,y0,y1:.6,h:.1});S.mark(tb,'block');
   const out=b.deflect==='corner'?[PT.L+1.5,Math.sign(bp[1]||1)*(PT.goalHalfW+(4.3+S.rng()*10)*SZ())]:[bp[0]-6*SX(),bp[1]+(S.rng()-.5)*8*SZ()];S.seg({type:'air',t0:tb,t1:tb+1,p0:bp,p1:out,y0:.6,y1:BALL_R,h:b.deflect==='corner'?2:.8});
   S.emo(s,'frustrated',tb+.3,1.8,.7);S.act(s,'frustration',tb+.4,1.2,{});S.cur=out;S.holder=-1;S.t=tb+1.4;if(S.applyAt===null)S.applyAt=tb;return;}
  C.shotFlight(S,{tk,from,y0,target:b.target,outcome:b.outcome,power:b.power||24,keeper:kp,shooter:s,dive:b.keeperDive,save:b.save,keeperError:b.keeperError,curve:b.type==='placed'||b.type==='freekick'?(S.rng()-.5)*1.6:0,type:b.type,brief:goalNext,ownGoal:b.ownGoal,reboundAt:next&&next.k==='rebound_run'?next.at:null});},
 rebound_run(S,b){const r=S.A(b.by);const sp=S.reboundSpot||b.at;const ta=S.reboundT??(S.t+.8);if(r>=0){S.wp(r,ta,sp[0]-.4,sp[1],{face:S.face(sp,[PT.L,0])});}S.cur=sp.slice();S.t=ta;S.firstTime=r;S.mainShot=null;},
 clear(S,b){const c=S.A(b.by);const t=S.t;if(c>=0){S.wp(c,t,b.at[0]+.4,b.at[1]);S.act(c,b.header?'jump_header':'clear',t-.4,1,{face:Math.PI});}
  S.seg({type:'air',t0:t,t1:t+1.1,p0:b.at,p1:b.to,y0:b.header?2.1:BALL_R,y1:BALL_R,h:3});S.mark(t,'header');S.cur=b.to.slice();S.holder=-1;S.t=t+1.1;},
 out(S,b){const t=S.t;S.mark(t,'out',{type:b.type});S.overlays.push({t0:t,t1:t+2.4,kind:'label',text:b.type==='corner'?'ESCANTEIO':b.type==='goal_kick'?'TIRO DE META':'LATERAL'});
  const ar=b.at[0]>0?S.AR1:S.AR2;S.act(ar,b.type==='corner'?'flag_corner':'flag_point',t+.2,1.6,{});S.deadFrom(t);
  if(b.type==='goal_kick'){const k=S.keeper('D');if(k)S.wp(k.i,t+2.2,PT.L-PT.sixDepth+1.5,0,{soft:true});}S.t=t+1.4;},
 offside(S,b){const t=b.late?S.t+.2:(S.offsideAt??S.t);const r=S.A(b.by);const ar=S.AR1;
  S.act(ar,'flag_up',t,2.6,{});S.mark(t+.05,'flag');S.mark(t+.6,'whistle');S.act(S.REF,'signal_ifk',t+.7,1.6,{});S.deadFrom(t+.6);
  if(r>=0){S.act(r,'protest',t+1,1.8,{});S.emo(r,'frustrated',t+.8,2.4,.8);}
  S.overlays.push({t0:t+.6,t1:t+3.6,kind:'label',text:'IMPEDIMENTO',tone:'flag'});S.cam(t-.2,'side_low',{a:ar,until:t+1.6});
  if(S.applyAt===null)S.applyAt=t+.6;S.t=Math.max(S.t,t)+2.4;},
 disallow(S,b){const t=S.t;S.mark(t,'whistle');S.act(S.REF,'signal_ifk',t+.2,2,{});S.mark(t+.3,'disallow');S.applyAt=t+.3;
  S.overlays.push({t0:t+.3,t1:t+4.5,kind:'label',text:'GOL ANULADO · '+String(b.reason||'').toUpperCase(),tone:'flag'});
  for(const a of S.team('A'))if(a.kind!=='keeper'&&S.rng()<.5){S.act(a.i,'protest',t+.6,1.8,{});S.emo(a.i,'frustrated',t+.4,3,.8);}
  const gk=S.keeper('D');if(gk){S.act(gk.i,'arms_up',t+.5,1.4,{});S.emo(gk.i,'happy',t+.4,2.4,.8);}S.cam(t,'ref',{a:S.REF,until:t+2.6});S.t=t+3.2;},
 celebrate(S,b){C.celebration(S,b);},
 whistle_end(){}
};

/* Voo de uma finalização (gol, defesa, fora, trave). Sincroniza o goleiro com a trajetória real. */
C.shotFlight=function(S,o){const r=S.rng,dir=o.from;const tgt=o.target||[0,1];const P0=[o.from[0],o.y0,o.from[1]];
 let end=[PT.L,tgt[1],tgt[0]];const dist=Math.hypot(end[0]-P0[0],end[1]-P0[1],end[2]-P0[2]);const T=clamp(dist/o.power,.28,2.2);const tl=o.tk+T;const kp=o.keeper;
 const goalCam=S.ev.goal?'goal':null;
 if(kp>=0&&kp!==undefined){const rush=o.type==='chip';const kpos=rush?[clamp(o.from[0]+5.5*SX(),PT.L-8*SX(),PT.L-3*SX()),o.from[1]*.6]:[PT.L-.9,clamp(o.from[1]*.18,-PT.goalHalfW*.66,PT.goalHalfW*.66)];S.wp(kp,o.tk-.2,kpos[0],kpos[1],{face:Math.PI});if(!o.penalty)S.act(kp,rush?'gk_rush':'gk_ready',o.tk-1.4,1.25,{});}
 const dive=(side,height,reachZ,succ)=>{if(kp<0||kp===undefined)return;const rt=o.tk+.12;const lat=side*Math.min(Math.abs(reachZ),1.15);
  S.wp(kp,tl+.05,PT.L-.75,reachZ-lat,{face:Math.PI});
  const style=Math.abs(reachZ)<.7?(height>1.5?'gk_high':height<.5?'gk_low':'gk_catch'):'gk_dive';
  const clip=succ?.style==='tip'?'gk_tip':succ?.style==='catch'?'gk_catch':succ?.style==='foot'?'gk_foot':style;S.act(kp,clip,rt,succ?.style==='catch'?1.6:2.6,{side:side||1,height,reach:Math.abs(lat),hands:succ?.style==='parry'||succ?.style==='dive'?1:2});};
 if(o.outcome==='goal'){S.seg({type:'shot',t0:o.tk,t1:tl,p0:P0,p1:end,curve:o.curve||0});
  const back=[PT.L+PT.netDepth,Math.max(.25,tgt[1]*.6),tgt[0]*.96];S.seg({type:'net',t0:tl,t1:tl+1.4,p0:end,p1:back});S.mark(tl,'goal',{side:S.ev.attack});S.mark(tl+.05,'net',{at:end});
  const kd=o.dive??(Math.abs(tgt[0])<1?0:Math.sign(tgt[0]));const reachZ=kd===Math.sign(tgt[0])?tgt[0]-Math.sign(tgt[0])*.9:kd*1.4;dive(kd||0,tgt[1],o.keeperError?tgt[0]:reachZ,null);
  if(o.keeperError&&kp>=0){S.overlays.push({t0:tl+.2,t1:tl+3,kind:'label',text:'FALHA DO GOLEIRO',tone:'hot'});}
  if(!o.brief){S.applyAt=tl;}S.deadFrom(tl);S.goalT=tl;S.cur=[back[0],back[2]];S.holder=-1;
  if(kp>=0){S.emo(kp,o.keeperError?'shame':'frustrated',tl+.4,6,1);S.act(kp,'gk_down',tl+.8,2.4,{});}
  if(o.brief){/* gol que será anulado: comemoração interrompida */const sc=o.shooter;S.act(sc,'arms_up',tl+.3,1.4,{});S.emo(sc,'euphoric',tl+.2,1.6,1);S.t=tl+1.9;}
  else S.t=tl+.35;
  S.cam(tl-.05,'broadcast',{tight:true});return;}
 if(o.outcome==='save'){const sv=o.save||{style:'dive',side:Math.sign(tgt[0])};const sp=[PT.L-.8,tgt[1],tgt[0]];const ts=o.tk+T*.97;
  S.seg({type:'shot',t0:o.tk,t1:ts,p0:P0,p1:sp,curve:o.curve||0});S.mark(ts,'save',{great:sv.great});dive(Math.sign(tgt[0]),tgt[1],tgt[0],sv);
  if(kp>=0){S.emo(kp,sv.great?'happy':'concentrated',ts+.3,2.6,sv.great?1:.6);if(sv.great)S.overlays.push({t0:ts+.4,t1:ts+3.4,kind:'player',id:S.actors[kp].id,sub:'GRANDE DEFESA'});}
  S.emo(o.shooter,'surprised',ts+.15,.9,1);S.emo(o.shooter,'frustrated',ts+1,2.2,.8);S.act(o.shooter,'hands_head',ts+.5,1.8,{});S.mark(ts+.2,'crowd_oh');
  if(S.applyAt===null)S.applyAt=ts;
  if(sv.style==='catch'||sv.style==='claim'){S.hold(kp,ts,{hands:true});if(kp>=0){S.wp(kp,ts+1.6,PT.L-2.2,tgt[0]*.6,{face:Math.PI});
   /* reposição: goleiros com bom jogo de pés lançam longe; os demais saem jogando com as mãos */
   const longK=(S.actors[kp].info.attrs?.gkKicking||60)>=74&&r()<.5;
   if(longK){const to=[PT.L-(44+r()*14)*SX(),clamp((r()-.5)*40*SZ(),-PT.W*.7,PT.W*.7)];S.act(kp,'pass_long',ts+1.6,1,{face:Math.PI});S.seg({type:'air',t0:ts+1.95,t1:ts+3.6,p0:[PT.L-2.6,tgt[0]*.6],p1:to,y0:BALL_R,y1:BALL_R,h:9*SX()+2});S.mark(ts+1.95,'kick',{power:24});S.poss.push({t:ts+1.9,s:'D'});S.cur=to;S.holder=-1;S.t=ts+3.6;S.deadFrom(ts+.6);S.cam(ts+.6,'face',{a:kp,until:ts+1.9});return;}
   S.act(kp,'gk_throw',ts+1.6,1,{face:Math.PI});const to=[PT.L-(16+r()*6)*SX(),clamp(tgt[0]*3+(r()-.5)*24*SZ(),-PT.W*.7,PT.W*.7)];S.seg({type:'air',t0:ts+1.92,t1:ts+3,p0:[PT.L-2.7,tgt[0]*.6],p1:to,y0:1.9,y1:BALL_R,h:1.2});S.mark(ts+1.92,'touch');S.poss.push({t:ts+1.9,s:'D'});S.cur=to;}S.holder=-1;S.t=ts+3;S.deadFrom(ts+.6);S.cam(ts+.6,'face',{a:kp,until:ts+1.9});return;}
  if(sv.style==='tip'){const out=[PT.L+PT.netDepth+2.8,tgt[0]+(r()-.5)*2];S.seg({type:'air',t0:ts,t1:ts+1.1,p0:[sp[0],sp[2]],p1:out,y0:tgt[1],y1:BALL_R,h:2.3});S.cur=out;S.holder=-1;S.t=ts+1.6;S.deadFrom(ts+.9);S.cam(ts+.4,'face',{a:kp,until:ts+2});return;}
  const reb=o.reboundAt?o.reboundAt.slice():[PT.L-(6-r()*3.5)*SX(),clamp(tgt[0]+Math.sign(tgt[0]||1)*(3+r()*4)*SZ(),-PT.boxHalfW*.7,PT.boxHalfW*.7)];const tr=ts+.75;S.seg({type:'air',t0:ts,t1:tr,p0:[sp[0],sp[2]],p1:reb,y0:tgt[1],y1:BALL_R,h:.6});
  S.reboundSpot=reb;S.reboundT=tr;S.cur=reb;S.holder=-1;S.t=tr;if(o.penalty&&!o.rebound){S.t=tr+1.8;S.deadFrom(tr);}
  if(!o.rebound){S.cam(ts+.5,'face',{a:kp,until:ts+2.2});}
  return;}
 if(o.outcome==='post'||o.outcome==='bar'){const hit=[PT.L,o.outcome==='bar'?PT.goalH:tgt[1],o.outcome==='post'?Math.sign(tgt[0])*PT.goalHalfW:tgt[0]];S.seg({type:'shot',t0:o.tk,t1:tl,p0:P0,p1:hit,curve:o.curve||0});S.mark(tl,'post');
  const reb=o.reboundAt?o.reboundAt.slice():[PT.L-(7-r()*4)*SX(),clamp(hit[2]*1.6+(r()-.5)*6*SZ(),-PT.boxHalfW*.8,PT.boxHalfW*.8)];S.seg({type:'air',t0:tl,t1:tl+.8,p0:[hit[0],hit[2]],p1:reb,y0:hit[1],y1:BALL_R,h:.9});S.reboundSpot=reb;S.reboundT=tl+.8;
  dive(Math.sign(tgt[0]),tgt[1],tgt[0]*.7,null);S.act(o.shooter,'hands_head',tl+.3,2,{});S.emo(o.shooter,'frustrated',tl+.2,2.6,1);S.mark(tl+.1,'crowd_oh');
  if(S.applyAt===null)S.applyAt=tl;S.cur=reb;S.holder=-1;S.t=tl+.8;if(o.penalty)S.t+=1.6;S.cam(tl+.5,'face',{a:o.shooter,until:tl+2.4});return;}
 /* fora / por cima */
 const past=[PT.L+3.6,tgt[1]+(o.outcome==='over'?1.2:0),tgt[0]*1.12];S.seg({type:'shot',t0:o.tk,t1:tl,p0:P0,p1:end,curve:o.curve||0});S.seg({type:'air',t0:tl,t1:tl+.4,p0:[end[0],end[2]],p1:[past[0],past[2]],y0:end[1],y1:Math.max(BALL_R,past[1]),h:0});
 S.seg({type:'drop',t0:tl+.4,t1:tl+1.2,p0:[past[0],past[2]],y0:Math.max(BALL_R,past[1])});
 dive(Math.sign(tgt[0]),Math.min(tgt[1],2),clamp(tgt[0],-(PT.goalHalfW-.36),PT.goalHalfW-.36),null);S.mark(tl,'crowd_oh');
 S.act(o.shooter,'hands_head',tl+.2,2.2,{});S.emo(o.shooter,'frustrated',tl+.1,2.8,1);if(S.applyAt===null)S.applyAt=tl;S.deadFrom(tl+.3);
 S.cur=[past[0],past[2]];S.holder=-1;S.t=tl+1.6;S.cam(tl+.35,'face',{a:o.shooter,until:tl+2.2});};

/* Comemoração cinematográfica */
C.celebration=function(S,b){const sc=S.A(b.by);if(sc<0)return;const t=(S.goalT||S.t)+.25;S.throwIn=-1;const r=S.rng;const og=b.ownGoal;
 const scP=S.estPos(sc,t);const sideZ=Math.sign(scP[1]||(r()<.5?1:-1));const style=og?'hug_team':b.style;const I=b.intensity||.6;
 let dest;if(style==='corner_flag')dest=[PT.L-1.6,sideZ*(PT.W-1.7)];else if(style==='knee_slide'||style==='crowd')dest=[PT.L-(10-r()*6)*SX(),sideZ*(PT.W-2.5)];else dest=[clamp(scP[0]-(4+r()*5)*SX(),PT.L-24*SX(),PT.L-6*SX()),clamp(scP[1]+sideZ*(7+r()*6)*SZ(),-(PT.W-4*SZ()),PT.W-4*SZ())];
 const runT=clamp(Math.hypot(dest[0]-scP[0],dest[1]-scP[1])/7.2,1.4,4.6);const ta=t+runT;
 const scorerA=S.actors[sc];const celebrator=og?-1:sc;
 if(celebrator>=0){S.wp(sc,ta,dest[0],dest[1],{face:S.face(scP,dest)});
  S.act(sc,style==='arms_wide'||style==='funny'?'run_airplane':'run_celebrate',t,runT,{});
  const fin={knee_slide:'knee_slide',corner_flag:'corner_pose',arms_wide:'arms_wide',punch_air:'punch_air',jump:'jump_joy',hug_team:'arms_wide',group:'arms_up',dance:'dance',crowd:'crowd_wave',point_sky:'point_sky',heart:'heart',badge:'badge',arms_crossed:'arms_crossed',scream:'scream',pose:'pose',funny:'robot'}[style]||'arms_up';
  S.act(sc,fin,ta-(fin==='knee_slide'?.7:0),2.8,{face:Math.atan2(-sideZ,-1)});S.emo(sc,I>.75?'euphoric':'veryhappy',t-.2,9,1);
  S.act(sc,'hug',ta+2.9,2.4,{});S.wp(sc,ta+5.5,dest[0]-1,dest[1]-sideZ*1,{soft:true});
  S.overlays.push({t0:t+.6,t1:t+5.2,kind:'goal',id:scorerA.id});}
 /* companheiros chegam em sequência e abraçam */
 const mates=S.team('A').filter(a=>a.i!==sc);let k=0;const hub=celebrator>=0?dest:[PT.L-9*SX(),sideZ*PT.W*.6];
 for(const m of mates){const p=S.estPos(m.i,t);const d=Math.hypot(hub[0]-p[0],hub[1]-p[1]);if(m.kind==='keeper'){S.act(m.i,'arms_up',t+.4,2,{});S.emo(m.i,'veryhappy',t,5,1);continue;}
  const arrive=ta+.4+Math.min(4.2,d/7)+k*.12;const ang=(k/Math.max(1,mates.length))*Math.PI*2;const rad=1+(k%3)*.45;k++;
  S.wp(m.i,arrive,hub[0]+Math.cos(ang)*rad-1.2,hub[1]+Math.sin(ang)*rad*.8,{face:S.face(p,hub),soft:true});S.act(m.i,d>25?'run_celebrate':'arms_up',t+.3,Math.min(2.5,arrive-t),{});S.act(m.i,'hug',arrive,2.6,{});S.emo(m.i,'veryhappy',t+.2,8,.9);}
 /* adversários */
 for(const a of S.team('D')){const p=S.estPos(a.i,t);const home=[clamp(-a.base[0]*.6+30*SX(),20*SX(),PT.L-4*SX()),-a.base[1]*.7];
  if(a.kind==='keeper'){S.act(a.i,r()<.5?'gk_slap':'hands_hips',t+.6,3,{});S.emo(a.i,og?'shame':'frustrated',t,7,1);continue;}
  S.wp(a.i,t+4+r()*2,lerp(p[0],home[0],.5),lerp(p[1],home[1],.5),{soft:true});S.act(a.i,r()<.45?'hands_head':r()<.5?'hands_hips':'kneel',t+.7+r()*1.2,2.6,{});S.emo(a.i,og&&a.i===sc?'shame':r()<.5?'sad':'frustrated',t,7,.9);}
 if(og&&sc>=0){S.act(sc,'kneel',t+.3,3,{});S.emo(sc,'shame',t,7,1);}
 S.wp(S.REF,t+5,30*SX(),-6*SZ(),{soft:true});S.wp(S.AR1,t+3.5,22*SX(),-(PT.W+1.6),{soft:true});S.wp(S.AR2,t+3.5,-22*SX(),PT.W+1.6,{soft:true});S.mark(t,'crowd_goal',{side:S.ev.attack,intensity:I});S.mark(t+.2,'fx_goal',{side:S.ev.attack,intensity:I});
 /* plano de câmera televisivo */
 const focus=celebrator>=0?sc:mates[0]?.i;
 S.cam(t+.15,'follow_player',{a:focus,cut:true});
 if(style==='corner_flag'||style==='knee_slide'||style==='crowd')S.cam(ta-1.1,'corner_flag',{a:focus,cut:true,flag:[PT.L-1.6,sideZ*(PT.W-.4)]});
 S.cam(ta+.6,'face',{a:focus,cut:true});S.cam(ta+2.4,'wide_group',{a:focus,cut:true});
 S.t=ta+5.4;};

/* Montagem de cenas (corte de câmera): pênalti, escanteio e falta */
C.scene=function(S,t,place){S.cuts.push(t);for(const a of S.actors)a.wps=a.wps.filter(w=>w.t<t-1e-6);for(const ac of S.acts)if(ac.t0<t&&ac.t1>t)ac.t1=t;const fut=S.future||new Set();const order=S.actors.slice().sort((p,q)=>(fut.has(q.id)?1:0)-(fut.has(p.id)?1:0));for(const a of order){const p=place(a);if(p)S.wp(a.i,t,p[0],p[1],{tele:true,face:p[2]});}S.cam(t,'broadcast',{cut:true});};
C.setupPenalty=function(S,t0,tk,gk){let ia=0,id=0;const r=S.rng;const spot=PT.L-PT.penSpot,edge=PT.L-PT.boxDepth;
 const nA=S.actors.filter(a=>a.s==='A'&&a.kind!=='keeper'&&a.i!==tk).length,nD=S.actors.filter(a=>a.s==='D'&&a.kind!=='keeper').length;const shoot=S.ev&&S.ev.beats&&S.ev.beats.some(b=>b.shootout);
 C.scene(S,t0,a=>{if(a.i===tk)return[spot-2.8,-1.6,0];if(a.i===gk)return[PT.L-.2,0,Math.PI];if(a.i===S.REF)return[edge+1.5,-9*SZ(),0.4];if(a.i===S.AR1)return[PT.L+.2,-(PT.W+1.5),Math.PI/2];if(a.i===S.AR2)return[0,PT.W+1.5,-Math.PI/2];
  if(a.kind==='keeper')return shoot?[-1,-PT.W*.35,0]:[-PT.L+8*SX(),0,0];
  /* disputa de pênaltis: os demais ficam no círculo central */
  if(shoot){const k=a.s==='A'?ia++:id++;return[a.s==='A'?-1.4:1.4,(k-4.5)*1.2*Math.max(.6,SZ()),a.s==='A'?0:Math.PI];}
  if(a.s==='A'){const k=ia++;return[edge-2.3*SX()+(k%3)*.6+r()*.4,(k-(nA-1)/2)*2.8*Math.max(.8,SZ())+(r()-.5),0];}const k=id++;return[edge-1.5*SX()+(k%2)*.5+r()*.4,(k-(nD-1)/2)*3*Math.max(.8,SZ())+1.2,Math.PI];});
 S.seg({type:'dead',t0:t0,p:[spot,0]});S.holder=-1;S.cur=[spot,0];S.deadFrom(t0);S.liveFrom=t0+3.25;};
C.setupCorner=function(S,b){if(S.cornerSet)return;S.cornerSet=true;const side=Math.sign(b.at[1]);const t0=0;const taker=S.A(b.by);const r=S.rng;let ia=0,id=0;const X=SX(),Z=SZ(),L=PT.L,W=PT.W;
 C.scene(S,t0,a=>{if(a.i===taker)return[L-1.2,side*(W-.8),Math.atan2(-side,-.4)];if(a.kind==='keeper')return a.s==='D'?[L-.7,side*PT.goalHalfW*.38,Math.PI]:[-L+10*X,0,0];
  if(a.i===S.REF)return[L-14*X,-side*12*Z,0];if(a.i===S.AR1)return[L+.4,side*(W+1),Math.PI];if(a.i===S.AR2)return[0,-(W+1.5),0];
  if(a.s==='A'){const k=ia++;if(k<6)return[L-(10-(k%3)*2.3-r())*X,(k-2.5)*2.4*Z+(r()-.5)*Z,0];if(k<8)return[L-(21-r()*3)*X,(k-6.5)*10*Z,0];return[(8+r()*6)*X,(k-8.5)*12*Z,0];}
  const k=id++;if(k<7)return[L-(8-(k%3)*2.2-r()*.5)*X,((k-3)*2.4+.6)*Z,Math.PI];if(k===7)return[L-.6,side*PT.goalHalfW*.9,Math.PI];return[L-(24-r()*4)*X,(k-8.5)*9*Z,Math.PI];});
 S.seg({type:'dead',t0:0,p:[L-.3,side*(W-.3)]});S.cur=[L-.3,side*(W-.3)];S.holder=-1;
 for(const a of S.actors)if(a.s!=='R'&&a.kind!=='keeper')S.act(a.i,'jostle',.3,1.6,{});
 if(taker>=0){S.act(taker,'arm_signal',.2,1,{});S.wp(taker,1.4,PT.L-2.4,side*(PT.W-1.6));}S.t=1.7;S.cam(0,'corner',{side});
 S.overlays.push({t0:.2,t1:2.4,kind:'label',text:b.short?'ESCANTEIO · JOGADA ENSAIADA':'ESCANTEIO'});};
C.setupFreeKick=function(S,b){const t0=S.t+.1;const spot=b.at;const taker=S.A(b.by);const wall=(b.wall||[]).map(w=>S.A(w)).filter(x=>x>=0);const r=S.rng;
 const toGoal=Math.atan2(-spot[1],PT.L-spot[0]);const wc=[spot[0]+Math.cos(toGoal)*PT.wallDist,spot[1]+Math.sin(toGoal)*PT.wallDist];let ia=0,id=0;const X=SX(),Z=SZ();
 C.scene(S,t0,a=>{if(a.i===taker)return[spot[0]-2.6*Math.cos(toGoal)-.8,spot[1]-2.6*Math.sin(toGoal)-.6,toGoal];
  const wi=wall.indexOf(a.i);if(wi>=0)return[wc[0],wc[1]+(wi-(wall.length-1)/2)*.62*(Math.cos(toGoal)>0?1:-1),toGoal+Math.PI];
  if(a.kind==='keeper')return a.s==='D'?[PT.L-.6,clamp(-wc[1]*.25+Math.sign(spot[1]||1)*.9*Z,-PT.goalHalfW*.68,PT.goalHalfW*.68),Math.PI]:[-PT.L+10*X,0,0];
  if(a.i===S.REF)return[wc[0]-1,wc[1]-3*Z,Math.PI/2];if(a.i===S.AR1)return[Math.max(PT.L-18*X,spot[0]+8*X),-(PT.W+1.5),Math.PI/2];if(a.i===S.AR2)return[-10*X,PT.W+1.5,-Math.PI/2];
  if(a.s==='A'){const k=ia++;return k<5?[PT.L-(12-r()*6)*X,((k-2)*4+(r()-.5)*2)*Z,0]:[spot[0]-(8+r()*12)*X,(k-6)*9*Z,0];}const k=id++;return k<5?[PT.L-(11-r()*7)*X,((k-2)*4+1)*Z,Math.PI]:[spot[0]-(6+r()*10)*X,(k-6)*10*Z,Math.PI];});
 S.seg({type:'dead',t0:t0,p:spot});S.cur=spot.slice();S.holder=-1;S.deadFrom(t0);
 for(const w of wall)S.act(w,'wall',t0+.5,3.6,{});S.mark(t0+1.6,'whistle');S.act(S.REF,'whistle',t0+1.5,.8,{});
 if(taker>=0){S.wp(taker,t0+2.1,spot[0]-2.6*Math.cos(toGoal),spot[1]-2.6*Math.sin(toGoal),{face:toGoal});S.emo(taker,'concentrated',t0,3.5,1);
  S.overlays.push({t0:t0+.4,t1:t0+2.8,kind:'player',id:S.actors[taker].id,sub:'COBRANÇA DE FALTA'});}
 S.cam(t0,'freekick',{spot});S.t=t0+2.2;S.liveFrom=t0+2.6;};

/* ---------- IA de posicionamento (jogadores sem roteiro naquele instante) ----------
   Quadro de ataque: o time 'A' ataca +L. Comportamentos: bloco que acompanha a bola, linha defensiva, pressão do
   marcador mais próximo, cobertura do segundo homem, marcação (zona/individual) do atacante mais próximo,
   desmarcações dos atacantes, pontas abertos, apoio ao portador e goleiro-líbero. No campo reduzido (Germinare)
   o bloco é mais compacto, a pressão é individual e o goleiro participa da saída de bola. */
function aiTarget(S,a,t,ball,possA,dead,lineD,lineA,px,pz,ctx){const ac=S.actors[a];const bx=ball[0],bz=ball[1];const L=PT.L,W=PT.W,sx=L/54,sz=W/34,sm=!!PT.small;
 if(ac.s==='R'){if(ac.kind==='ref')return[clamp(bx-7*sx,-(L-10*sx),L-10*sx),clamp(bz-10*sz*Math.sign(bz||1)+(bz>0?0:6*sz),-(W-6*sz),W-6*sz),5.5];
  const sideZ=a===S.AR1?-(W+1.6):W+1.6;const lx=a===S.AR1?Math.max(bx,lineD,0):Math.min(bx,lineA,0);return[clamp(lx,-(L-1),L-1),sideZ,6];}
 const base=ac.base;const attacking=(ac.s==='A')===possA;let x,z,sp=1;
 if(ac.kind==='keeper'){
  if(ac.s==='D'){const d=Math.hypot(L-bx,bz);x=L-clamp(.8+d*.05,.8,sm?3:5.5);z=clamp(bz*.22,-PT.goalHalfW*.76,PT.goalHalfW*.76);}
  else{/* goleiro do time com a bola: adianta-se (líbero); no reduzido, vira opção de passe na saída */
   x=-L+clamp((sm?2:4)+(bx+L)*(sm?.16:.08),sm?2:4,sm?8:16);z=clamp(bz*(sm?.25:.1),-4*sz,4*sz);}
  return[x,z,dead?.4:1];}
 const tac=ctx&&ctx.tac?ctx.tac[ac.side]:null;const man=tac==='man'||sm;
 if(ac.s==='A'){/* time da bola: ataca +x */
  const shift=clamp(bx*.6+16*sx,-6*sx,36*sx);x=base[0]+shift;z=base[1]*.85+bz*.22;
  if(attacking){
   if(base[0]>-8*sx){x=Math.min(x+(3+Math.sin(t*.9+a)*3)*sx,lineD-.6+(Math.sin(t*.6+a*1.7)>.7?2*sx:0));z+=Math.sin(t*.7+a*2.1)*3*sz;}
   if(Math.abs(base[1])>15*sz)z=base[1]*1.05;/* pontas exploram a lateral */
   if(ctx&&a===ctx.supA&&!dead){/* apoio: oferece linha de passe em diagonal para a tabela */
    const sd=Math.sign(base[1]-bz||(a%2?1:-1));x=bx-(sm?3.5:6)+Math.sin(t*1.3+a)*1.2;z=bz+sd*(sm?4:8);sp=1.1;}}
  else{x=base[0]+clamp(bx*.5+4*sx,-14*sx,22*sx);z=base[1]*.75+bz*.28;}}
 else{/* time defensor: defende x=+L */
  const dx=-base[0],dz=-base[1];const lineX=clamp(bx+11*sx,14*sx,L-5.5*sx);x=lineX-(38*sx-dx)*.72;z=dz*.8+bz*.3;
  if(sm){x=lerp(x,(bx+L)/2+1,.35);z=lerp(z,bz,.3);}
  if(!attacking){x=Math.min(x,L-2*sx);
   if(ctx&&!dead&&a===ctx.nearD){/* pressão no portador, pelo lado do gol */x=bx+(sm?1.2:1.8);z=bz+Math.sign(-bz||1)*.4;sp=sm?1.2:1.1;}
   else if(ctx&&!dead&&a===ctx.near2D){/* cobertura: entre a bola e o gol, atrás do primeiro marcador */x=Math.min(L-2,bx+(sm?4:7)*Math.max(.8,sx));z=bz*.55;}
   else if(px){/* marcação: acompanha o atacante mais próximo da sua zona (mais forte na marcação individual) */
    let best=-1,bd=sm?9:14*sx;for(let j=0;j<S.actors.length;j++){const o=S.actors[j];if(o.s!=='A'||o.kind!=='player')continue;const d=Math.hypot(px[j]-x,pz[j]-z);if(d<bd){bd=d;best=j;}}
    if(best>=0){const w=man?.65:.35;const gx=px[best]+(sm?1.1:1.6),gz=pz[best]+(bz-pz[best])*.12;x=lerp(x,Math.min(gx,L-2),w);z=lerp(z,gz,w);}
    /* volantes fecham a linha de passe central */
    if(ac.info&&ac.info.group==='DM')z=lerp(z,bz*.5,.3);}}
  else{x=dx-clamp(-bx*.5+8*sx,-8*sx,22*sx);}}
 x=clamp(x,-(L-1),L-1);z=clamp(z,-(W-1),W-1);
 return[x,z,dead?.35:sp];}

/* ---------- Bake: simula 30 fps, resolve IA, bola e emoções ---------- */
C.bake=function(S){const FPS=C.FPS,n=Math.ceil(S.duration*FPS)+1,dt=1/FPS;const A=S.actors,na=A.length;
 for(const a of A)a.wps.sort((p,q)=>p.t-q.t);S.actsBy=A.map(()=>[]);for(const ac of S.acts)S.actsBy[ac.a].push(ac);S.segs.sort((p,q)=>p.t0-q.t0);S.cuts.sort((a,b)=>a-b);S.dead.sort((a,b)=>a-b);
 const tr={n,fps:FPS,duration:S.duration,dir:S.dir,actors:A.map(a=>({id:a.id,s:a.s,side:a.side,slot:a.slot,kind:a.kind,info:a.info,x:new Float32Array(n),z:new Float32Array(n),f:new Float32Array(n),v:new Float32Array(n),d:new Float32Array(n),acts:[],emos:[]})),
  bx:new Float32Array(n),by:new Float32Array(n),bz:new Float32Array(n),bs:new Float32Array(n),bh:new Float32Array(n)};
 const px=new Float32Array(na),pz=new Float32Array(na),vx=new Float32Array(na),vz=new Float32Array(na),fc=new Float32Array(na),dist=new Float32Array(na);
 const deadAt=S.dead.length?S.dead[0]:1e9,liveFrom=S.liveFrom||-1;
 /* posição inicial */
 const ball0=S.ball0||[0,0];const possAt=t=>{let s='A';for(const p of S.poss)if(p.t<=t)s=p.s;return s==='A';};
 const ctx={nearA:-1,supA:-1,nearD:-1,near2D:-1,tac:S.ev.tac||null};
 for(let i=0;i<na;i++){const a=A[i];const ai=aiTarget(S,i,0,ball0,true,false,PT.L*.7,-PT.L*.7,null,null,ctx);let p=[ai[0],ai[1]];
  if(a.wps.length&&!a.wps[0].tele){const w=a.wps[0];const dx=w.x-p[0],dz=w.z-p[1],d=Math.hypot(dx,dz);const reach=a.speed*.82*w.t;if(d>reach){const k=(d-reach)/d;p=[p[0]+dx*k,p[1]+dz*k];}}
  else if(a.wps.length&&a.wps[0].tele&&a.wps[0].t<=.01)p=[a.wps[0].x,a.wps[0].z];
  px[i]=p[0];pz[i]=p[1];fc[i]=a.s==='D'?Math.PI:0;}
 const wpi=new Int32Array(na),scr=new Uint8Array(na),wasScr=new Uint8Array(na),anc=new Array(na).fill(null).map(()=>({t:1e9}));let cutIdx=0;const ball=[ball0[0],ball0[1]];
 const prevBall=[ball0[0],ball0[1]];
 for(let f=0;f<n;f++){const t=f*dt;
  /* cortes de cena: teleporte */
  while(cutIdx<S.cuts.length&&t>=S.cuts[cutIdx]-1e-6){const ct=S.cuts[cutIdx++];for(let i=0;i<na;i++){const w=A[i].wps.find(q=>q.tele&&Math.abs(q.t-ct)<1e-4);if(w){px[i]=w.x;pz[i]=w.z;vx[i]=vz[i]=0;if(w.face!==undefined)fc[i]=w.face;wpi[i]=A[i].wps.indexOf(w)+1;}}}
  const dead=t>=deadAt&&!(liveFrom>0&&t>=liveFrom&&t<liveFrom+3&&S.dead.filter(d=>d>liveFrom).every(d=>d>t));
  const possA=possAt(t);
  /* papéis do quadro: quem apoia o portador, quem pressiona e quem faz a cobertura */
  {let a1=-1,a2=-1,d1=-1,d2=-1,ad1=1e9,ad2=1e9,dd1=1e9,dd2=1e9;for(let i=0;i<na;i++){const a=A[i];if(a.kind!=='player')continue;const d=Math.hypot(px[i]-ball[0],pz[i]-ball[1]);
    if(a.s==='A'){if(d<ad1){ad2=ad1;a2=a1;ad1=d;a1=i;}else if(d<ad2){ad2=d;a2=i;}}else if(a.s==='D'){if(d<dd1){dd2=dd1;d2=d1;dd1=d;d1=i;}else if(d<dd2){dd2=d;d2=i;}}}
   ctx.nearA=a1;ctx.supA=a2;ctx.nearD=d1;ctx.near2D=d2;ctx.possA=possA;}
  /* linhas de impedimento (penúltimo defensor) */
  let d1=-99,d2=-99,a1=99,a2=99;for(let i=0;i<na;i++){const a=A[i];if(a.s==='D'){const x=px[i];if(x>d1){d2=d1;d1=x;}else if(x>d2)d2=x;}else if(a.s==='A'){const x=px[i];if(x<a1){a2=a1;a1=x;}else if(x<a2)a2=x;}}
  for(let i=0;i<na;i++){const a=A[i];const w=a.wps;while(wpi[i]<w.length&&w[wpi[i]].t<t-1e-6)wpi[i]++;
   let dvx=0,dvz=0,maxSp=a.speed;const nw=w[wpi[i]];const pw=wpi[i]>0?w[wpi[i]-1]:null;
   const scripted=nw&&!nw.tele&&!nw.soft&&(nw.walk&&pw||(nw.t-t)<Math.max(1.2,Math.hypot(nw.x-px[i],nw.z-pz[i])/(a.speed*.72)));scr[i]=scripted?1:0;
   if(scripted){/* trajetória Hermite: passa exatamente pelos waypoints, com velocidade contínua */
    if(!wasScr[i]||anc[i].t>t){anc[i]={t,x:px[i],z:pz[i],vx:vx[i],vz:vz[i]};}
    const usePw=pw&&!pw.tele&&pw.t>=anc[i].t-1e-6;const s0=usePw?{t:pw.t,x:pw.x,z:pz[i]*0+pw.z}:anc[i];
    let m0x,m0z;if(usePw){const pp=wpi[i]>1?w[wpi[i]-2]:null;const ref=pp&&!pp.tele&&pp.t>=anc[i].t-1e-6?pp:anc[i];const d1=Math.max(.05,s0.t-ref.t),d2=Math.max(.05,nw.t-s0.t);m0x=((s0.x-ref.x)/d1+(nw.x-s0.x)/d2)*.5;m0z=((s0.z-ref.z)/d1+(nw.z-s0.z)/d2)*.5;}else{m0x=anc[i].vx;m0z=anc[i].vz;}
    const nn=w[wpi[i]+1];const T=Math.max(.05,nw.t-s0.t);let m1x,m1z;if(nn&&!nn.tele&&nn.t-nw.t<3){const d2=Math.max(.05,nn.t-nw.t);m1x=((nw.x-s0.x)/T+(nn.x-nw.x)/d2)*.5;m1z=((nw.z-s0.z)/T+(nn.z-nw.z)/d2)*.5;}else{m1x=(nw.x-s0.x)/T*.35;m1z=(nw.z-s0.z)/T*.35;}
    const lim=Math.max(a.speed*1.3,9);const mm0=Math.hypot(m0x,m0z);if(mm0>lim){m0x*=lim/mm0;m0z*=lim/mm0;}const mm1=Math.hypot(m1x,m1z);if(mm1>lim){m1x*=lim/mm1;m1z*=lim/mm1;}
    const u=clamp((t+dt-s0.t)/T,0,1),u2=u*u,u3=u2*u;const h00=2*u3-3*u2+1,h10=u3-2*u2+u,h01=-2*u3+3*u2,h11=u3-u2;
    const nx=h00*s0.x+h10*T*m0x+h01*nw.x+h11*T*m1x,nz=h00*s0.z+h10*T*m0z+h01*nw.z+h11*T*m1z;
    vx[i]=(nx-px[i])/dt;vz[i]=(nz-pz[i])/dt;const vm=Math.hypot(vx[i],vz[i]),cap=10.6;if(vm>cap){vx[i]*=cap/vm;vz[i]*=cap/vm;}continue;}
   if(nw&&nw.soft&&nw.t-t<7){const dx=nw.x-px[i],dz=nw.z-pz[i],d=Math.hypot(dx,dz);const need=d/Math.max(.3,nw.t-t);const want=Math.min(a.speed*.95,Math.max(need,Math.min(2.2,d*1.5)),d*2);if(d>.05){dvx=dx/d*want;dvz=dz/d*want;}}
   else if(pw&&!pw.tele&&!pw.soft&&t-pw.t<.6){const dx=pw.x-px[i],dz=pw.z-pz[i];dvx=dx*2+vx[i]*.4;dvz=dz*2+vz[i]*.4;}
   else if(pw&&pw.tele&&t-pw.t<(S.liveFrom&&S.liveFrom>pw.t?S.liveFrom-pw.t:2)){dvx=(pw.x-px[i])*2;dvz=(pw.z-pz[i])*2;}
   else if(pinned(S,i,t)||S.noAI){dvx=0;dvz=0;maxSp=.3;}
   else{const g=aiTarget(S,i,t,ball,possA,dead,Math.max(d2,0),Math.min(a2,0),px,pz,ctx);const dx=g[0]-px[i],dz=g[1]-pz[i],d=Math.hypot(dx,dz);const want=Math.min(a.speed*.72*g[2],d*1.4);if(d>.05){dvx=dx/d*want;dvz=dz/d*want;}if(dead)maxSp=Math.min(maxSp,1.7);}
   const sp=Math.hypot(dvx,dvz);if(sp>maxSp){dvx*=maxSp/sp;dvz*=maxSp/sp;}
   const ax=(dvx-vx[i]),az=(dvz-vz[i]),am=Math.hypot(ax,az),lim=a.accel*dt;
   if(am>lim){vx[i]+=ax/am*lim;vz[i]+=az/am*lim;}else{vx[i]=dvx;vz[i]=dvz;}
  }
  wasScr.set(scr);
  /* separação entre jogadores (evita atravessar) */
  for(let i=0;i<na;i++)for(let j=i+1;j<na;j++){const dx=px[j]-px[i],dz=pz[j]-pz[i],dd=dx*dx+dz*dz;if(dd<.7&&dd>1e-6){const d=Math.sqrt(dd),push=Math.min(.06,(.84-d)*.5);const ux=dx/d,uz=dz/d;const si=scr[i]?0:scr[j]?2:1,sj=scr[j]?0:scr[i]?2:1;px[i]-=ux*push*si;pz[i]-=uz*push*si;px[j]+=ux*push*sj;pz[j]+=uz*push*sj;}}
  for(let i=0;i<na;i++){const a=A[i];px[i]+=vx[i]*dt;pz[i]+=vz[i]*dt;const sp=Math.hypot(vx[i],vz[i]);dist[i]+=sp*dt;
   const w=a.wps[wpi[i]],pw=wpi[i]>0?a.wps[wpi[i]-1]:null;let wantF=null;
   const act=activeAct(S,i,t);if(act&&act.p&&act.p.face!==undefined)wantF=act.p.face;
   else if(w&&!w.tele&&w.face!==undefined&&w.t-t<.45)wantF=w.face;else if(pw&&pw.face!==undefined&&t-pw.t<.3)wantF=pw.face;
   else if(sp>1.4)wantF=Math.atan2(vz[i],vx[i]);else if(S.noAI&&pw&&pw.face!==undefined)wantF=pw.face;else wantF=Math.atan2(ball[1]-pz[i],ball[0]-px[i]);
   fc[i]=U.angleLerp(fc[i],wantF,clamp(dt*(sp>4?7:5),0,1));
   const T=tr.actors[i];T.x[f]=px[i];T.z[f]=pz[i];T.f[f]=fc[i];T.v[f]=sp;T.d[f]=dist[i];}
  /* bola */
  const b=evalBall(S,t,tr,f);tr.bx[f]=b[0];tr.by[f]=b[1];tr.bz[f]=b[2];
  const bd=Math.hypot(b[0]-prevBall[0],b[2]-prevBall[1]);tr.bs[f]=(f?tr.bs[f-1]:0)+bd/BALL_R;tr.bh[f]=bd>1e-4?Math.atan2(b[2]-prevBall[1],b[0]-prevBall[0]):(f?tr.bh[f-1]:0);
  prevBall[0]=b[0];prevBall[1]=b[2];ball[0]=b[0];ball[1]=b[2];}
 /* converte para o mundo */
 const dir=S.dir;for(const T of tr.actors){for(let f=0;f<n;f++){T.x[f]*=dir;T.z[f]*=dir;if(dir<0)T.f[f]+=Math.PI;}}
 for(let f=0;f<n;f++){tr.bx[f]*=dir;tr.bz[f]*=dir;if(dir<0)tr.bh[f]+=Math.PI;}
 for(const a of S.acts){const c={...a,p:{...a.p}};if(c.p.face!==undefined&&dir<0)c.p.face+=Math.PI;tr.actors[a.a].acts.push(c);}
 for(const T of tr.actors)T.acts.sort((p,q)=>p.t0-q.t0);
 for(const e of S.emos)tr.actors[e.a].emos.push(e);
 tr.marks=S.marks.sort((a,b)=>a.t-b.t).map(m=>{const o={...m};if(o.at)o.at=[o.at[0]*dir,o.at[1],o.at[2]*dir];if(o.flag)o.flag=[o.flag[0]*dir,o.flag[1]*dir];return o;});
 const mv=v=>v?[v[0]*dir,v[1],v[2]*dir]:v;tr.cams=S.cams.sort((a,b)=>a.t-b.t).map(c=>{const o={...c};if(o.flag)o.flag=[o.flag[0]*dir,o.flag[1]*dir];if(o.spot)o.spot=[o.spot[0]*dir,o.spot[1]*dir];if(o.e0){o.e0=mv(o.e0);o.e1=mv(o.e1);o.g0=mv(o.g0);o.g1=mv(o.g1);}if(o.off&&dir<0)o.off=[-o.off[0],o.off[1],-o.off[2]];return o;});
 tr.overlays=S.overlays;tr.applyAt=S.applyAt;tr.props=(S.props||[]).map(p=>({...p,at:p.at?[p.at[0]*dir,p.at[1],p.at[2]*dir]:null}));tr.keyT=S.keyT??null;tr.cuts=S.cuts;tr.replay=S.replay;tr.refIndex=S.REF;tr.goalT=S.goalT??null;
 tr.goalSide=dir>0?1:-1;/* lado do gol atacado no mundo */
 return tr;};
const PIN=new Set(['anthem','arm_over','hand_chest','handshake','applaud','trophy_hold','trophy_lift','sad_stand','sit_grass','coin_toss','look_around','fall_trip','fall_push','fall_slide','gk_down','gk_dive','gk_low','gk_high','gk_catch','gk_tip','gk_foot','kneel','wall','show_card','point_spot','corner_pose','dance','robot','pose','arms_crossed','heart','badge','scream','point_sky','gk_slap','hug','knee_slide','crowd_wave','punch_air','jump_joy','arms_wide','hands_hips','flag_up','signal_ifk','whistle','penalty_kick','gk_ready']);
function pinned(S,i,t){for(const a of S.actsBy[i])if(t>=a.t0&&t<=a.t1&&PIN.has(a.clip))return true;return false;}
function activeAct(S,i,t){let r=null;for(const a of S.actsBy[i])if(t>=a.t0&&t<=a.t1)r=a;return r;}
function segBall(S,s,t,tr,f){const u=s.t1!==undefined?clamp((t-s.t0)/Math.max(1e-3,s.t1-s.t0),0,1):0;
 switch(s.type){
  case'roll':{const k=.55,e=(u*(2-k*u))/(2-k);return[lerp(s.p0[0],s.p1[0],e),BALL_R,lerp(s.p0[1],s.p1[1],e)];}
  case'air':{const e=u+.18*u*(1-u);const y=lerp(s.y0,s.y1,u)+4*s.h*u*(1-u);return[lerp(s.p0[0],s.p1[0],e),Math.max(BALL_R,y),lerp(s.p0[1],s.p1[1],e)];}
  case'shot':{const y=lerp(s.p0[1],s.p1[1],u)+(s.p0[1]<.3&&s.p1[1]>.5?Math.sin(u*Math.PI)*.15:0);const c=Math.sin(u*Math.PI)*(s.curve||0);return[lerp(s.p0[0],s.p1[0],u),Math.max(BALL_R,y),lerp(s.p0[2],s.p1[2],u)+c];}
  case'net':{const a=clamp(u/.16,0,1),e=1-(1-a)*(1-a);let x=lerp(s.p0[0],s.p1[0],e),z=lerp(s.p0[2],s.p1[2],e);const fall=clamp((u-.16)/.3,0,1);let y=lerp(s.p0[1],s.p1[1],e);y=lerp(y,BALL_R,fall*fall);if(fall>=1){const bounce=Math.abs(Math.sin((u-.46)*14))*Math.max(0,.35-(u-.46)*.8);y=BALL_R+bounce;}return[x,y,z];}
  case'drop':{const y=Math.max(BALL_R,s.y0*(1-u*u)+Math.abs(Math.sin(u*9))*.4*(1-u));return[s.p0[0],y,s.p0[1]];}
  case'dead':return[s.p[0],BALL_R,s.p[1]];
  default:return null;}}
function evalBall(S,t,tr,f){let seg=null;for(const s of S.segs){if(s.t0<=t+1e-6)seg=s;else break;}
 if(!seg)return[S.cur[0],BALL_R,S.cur[1]];
 if(seg.type==='hold'){const T=tr.actors[seg.a];if(!T)return[S.cur[0],BALL_R,S.cur[1]];const x=T.x[f],z=T.z[f],fa=T.f[f],sp=T.v[f];
  if(seg.hands)return[x+Math.cos(fa)*.32,1.05,z+Math.sin(fa)*.32];
  const ph=T.d[f]*1.55;let reach=.42+(sp>2?.28*Math.max(0,Math.sin(ph)):.0);let lat=0;
  if(seg.skill&&t<seg.t1){const u=(t-seg.t0)/(seg.t1-seg.t0);const k={elastico:1,drag:-1,sharpCut:1,turn:1,cutIn:1,direction:1,stepover:.6,bodyFeint:.7,shotFeint:.3}[seg.skill]||.5;lat=Math.sin(u*Math.PI*(seg.skill==='elastico'?2:1))*.38*k;reach+=seg.skill==='drag'?-Math.sin(u*Math.PI)*.3:0;}
  return[x+Math.cos(fa)*reach-Math.sin(fa)*lat,BALL_R+(sp>2?Math.max(0,Math.sin(ph))*.05:0),z+Math.sin(fa)*reach+Math.cos(fa)*lat];}
 if(seg.t1!==undefined&&t>seg.t1+1e-6){/* depois do fim do segmento: bola parada (ou rolando devagar) no ponto final */
  const e=segBall(S,seg,seg.t1);if(seg.type==='roll'||seg.type==='air'){const k=clamp((t-seg.t1)*1.2,0,1);const dx=seg.p1[0]-seg.p0[0],dz=seg.p1[1]-seg.p0[1],d=Math.hypot(dx,dz)||1;const slide=Math.min(2.5,d*.12)*(1-(1-k)*(1-k));return[e[0]+dx/d*slide,BALL_R,e[2]+dz/d*slide];}return e;}
 return segBall(S,seg,t);}

/* Toque inicial no círculo central — início de cada período e depois de cada gol. Jogadores posicionados nos
   seus campos (adversários fora do círculo), árbitro autoriza, apito, toque curto, companheiro recebe e a primeira
   posse começa. keyT = instante do apito (o relógio da partida passa a correr a partir dele). */
C.kickoff=function(lineup,side,half,resolve,seed,o){o=o||{};C.useMode(o.mode);
 const ev={attack:side,half,seed,lineup,beats:[],kickoff:true,mode:o.mode,tac:o.tac||null};const S=new Script(ev,{resolve});const r=S.rng;const X=SX(),Z=SZ(),L=PT.L,W=PT.W,R0=PT.arcR;
 const A=S.team('A').filter(a=>a.kind==='player'),D=S.team('D').filter(a=>a.kind==='player');if(!A.length)return C.build({...ev,beats:[]},{resolve,noTrim:true});
 const kick=A.slice().sort((p,q)=>q.base[0]-p.base[0])[0];const rest=A.filter(a=>a!==kick);
 const rec=rest.slice().sort((p,q)=>(Math.abs(p.base[0]+10*X)+Math.abs(p.base[1])*.4)-(Math.abs(q.base[0]+10*X)+Math.abs(q.base[1])*.4))[0]||kick;
 const third=rest.filter(a=>a!==rec).sort((p,q)=>p.base[0]-q.base[0])[0]||rec;
 const recPos=[-(PT.small?3:5.5),(r()<.5?-1:1)*(PT.small?1.6:3)],kickPos=[-.3,0];
 const outside=(x,z)=>{const d=Math.hypot(x,z);if(d<R0+.5){const k=(R0+.5)/Math.max(.1,d);return[x*k,z*k];}return[x,z];};
 C.scene(S,0,a=>{if(a===kick)return[kickPos[0],kickPos[1],Math.PI*.95];if(a===rec)return[recPos[0]-1.2,recPos[1]*.6,0];
  if(a.kind==='keeper')return a.s==='A'?[-L+(PT.small?1.2:2.5),0,0]:[L-(PT.small?1.2:2.5),0,Math.PI];
  if(a.i===S.REF)return[2.5*X+1,-(R0+3*Z),Math.PI*.6];if(a.i===S.AR1)return[L*.5,-(W+1.6),Math.PI/2];if(a.i===S.AR2)return[-L*.5,W+1.6,-Math.PI/2];
  if(a.s==='A'){const p=[Math.min(-.8,a.base[0]*.5-2*X),a.base[1]*.92];const q=outside(p[0],p[1]);return[Math.min(-.6,q[0]),q[1],0];}
  const p=[Math.max(.8,-a.base[0]*.5+2*X),-a.base[1]*.92];const q=outside(p[0],p[1]);return[Math.max(.6,q[0]),q[1],Math.PI];});
 S.seg({type:'dead',t0:0,p:[0,0]});S.cur=[0,0];S.ball0=[0,0];S.holder=-1;S.deadFrom(0);S.liveFrom=1.8;
 for(const a of [...A,...D])if(a!==kick&&a!==rec)S.act(a.i,'idle_bounce',0,1.6,{});
 S.act(S.REF,'arm_signal',.5,.8,{});S.act(S.REF,'whistle',1.25,.9,{});S.mark(1.4,o.long===false?'whistle':'whistle_long');S.keyT=1.4;S.applyAt=1.4;
 S.emo(kick.i,'concentrated',0,3,1);S.overlays.push({t0:.2,t1:2.6,kind:'label',text:o.label||'TOQUE INICIAL'});
 S.cam(0,'kickoff',{cut:true});S.cam(1.95,'broadcast',{});
 S.t=1.7;C.H.pass(S,{by:{id:kick.id},to:{id:rec.id},from:[0,0],at:recPos,style:'ground',ok:true},{k:'pass',by:{id:rec.id}});
 const tp=[-(PT.small?9:17)*1,(r()-.5)*(PT.small?8:18)];C.H.pass(S,{by:{id:rec.id},to:{id:third.id},from:recPos,at:tp,style:'ground',ok:true},null);
 S.duration=Math.max(S.t+.6,4.5);const tr=C.bake(S);tr.startT=0;tr.kickoff=true;tr.keyT=1.4;tr.applyAt=1.4;return tr;};
/* Trilha ambiente (entre lances): troca de passes no meio-campo, sem finalizações. */
C.ambient=function(lineup,side,half,resolve,seed){const r=U.rng(seed);const other=side==='home'?'away':'home';const ev={attack:side,half,seed,lineup:{[side]:lineup[side],[other]:lineup[other]},beats:[]};
 const ids=(lineup[side]||[]).map((id,i)=>({id,i})).filter(x=>x.id&&x.i>0);if(ids.length<4)return C.build({...ev,beats:[]},{resolve});
 let cur=ids[Math.floor(r()*ids.length)];const thr=r()<.28;const X=SX(),Z=SZ();let pos=thr?[(-20+r()*30)*X,(r()<.5?-1:1)*(PT.W-.1)]:[(-12+r()*14)*X,(r()-.5)*24*Z];ev.beats.push({k:'start',by:{s:'A',i:cur.i,id:cur.id},at:pos,ctx:thr?'throwin':'ambient'});
 if(thr){const nx=ids.filter(x=>x.id!==cur.id)[Math.floor(r()*(ids.length-1))];const to=[pos[0]+(4+r()*5)*X,pos[1]*.78];ev.beats.push({k:'pass',by:{s:'A',i:cur.i,id:cur.id},to:{s:'A',i:nx.i,id:nx.id},from:pos,at:to,style:'header_pass',ok:true});cur=nx;pos=to;}
 for(let k=0;k<6;k++){const nx=ids.filter(x=>x.id!==cur.id)[Math.floor(r()*(ids.length-1))];const to=[clamp(pos[0]+(r()-.35)*18*X,-34*X,22*X),clamp(pos[1]+(r()-.5)*26*Z,-28*Z,28*Z)];
  if(r()<.35){const c=[clamp(pos[0]+(4+r()*5)*X,-34*X,24*X),clamp(pos[1]+(r()-.5)*6*Z,-28*Z,28*Z)];ev.beats.push({k:'carry',by:{s:'A',i:cur.i,id:cur.id},to:c});pos=c;}
  ev.beats.push({k:'pass',by:{s:'A',i:cur.i,id:cur.id},to:{s:'A',i:nx.i,id:nx.id},from:pos,at:to,style:'ground',ok:true});cur=nx;pos=to;}
 const tr=C.build(ev,{resolve});tr.overlays=tr.overlays.filter(o=>o.kind==='label');tr.ambient=true;return tr;};
C.Script=Script;C.aiTarget=aiTarget;
MD.Choreo=C;
})(typeof window!=='undefined'?(window.MD=window.MD||{}):(globalThis.MD=globalThis.MD||{}));
