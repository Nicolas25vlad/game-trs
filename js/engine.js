/* MATCHDAY 0.4 — motor de simulação.
   O relógio avança em tempo simulado; posses de bola são resolvidas por disputas baseadas em atributos,
   táticas, fadiga, placar e regras. Lances importantes geram um ROTEIRO (beats) que a camada 3D apenas
   encena — o replay nunca inventa um resultado diferente do calculado aqui.
   Quadro de ataque: o time com a bola ataca x=+54 (gol), direita = +z. */
(function(MD){
'use strict';
const U=MD.U,R=MD.Rules,D=MD.Data,clamp=U.clamp,lg=U.logistic;
const E={};
const PHYS=new Set(['pace','accel','stamina','strength','agility','balance','jumping']);
const SIDE_OTHER={home:'away',away:'home'};

/* ---------- Criação ---------- */
E.createMatch=function(homeClub,awayClub,settings){settings={...D.DEFAULT_SETTINGS,...(settings||{})};
 const mode=MD.Modes?MD.Modes.resolve(settings.mode||'pro',settings):null;if(mode)MD.Modes.apply(mode);
 const seedText=String(settings.seed||'').trim();const seed=seedText?(/^\d+$/.test(seedText)?Number(seedText)>>>0:U.hashStr(seedText)):((Date.now()^U.hashStr(homeClub.name+awayClub.name))>>>0);
 const rng=U.rng(seed);
 const m={seed,rng,settings,clock:0,phase:'first',half:'first',added:{first:null,second:null},counts:{},
  nextPoss:8+rng()*14,nextSubCheck:55*60,events:[],ticker:[],eid:0,lastHighlight:-999,
  score:{home:0,away:0},momentum:0,
  tempo:clamp(1+rng.gauss()*.11,.8,1.25),strict:clamp(1+rng.gauss()*.18,.65,1.45),chaos:clamp(1+rng.gauss()*.12,.8,1.3),
  stats:{home:E.blankStats(),away:E.blankStats()},possTime:{home:0,away:0},lastPossSide:'home',
  mode:mode||{id:'pro',players:11,periods:2,periodLen:2700,endGoals:0,restartAfterGoal:[55,85],extraLen:900,goldenLen:0,shootoutKicks:5},knockout:settings.knockout||null,
  period:'first',pens:null,kickoffs:[],snaps:[],endReason:null,endClock:null};
 m.periodsDef=MD.Modes?MD.Modes.periods(m.mode):[{id:'first',half:'first',start:0,len:2700},{id:'second',half:'second',start:2700,len:2700}];
 /* desempate em campo: gol de ouro (Germinare, configurável) OU prorrogação de 2 tempos; fora do mata-mata, nenhum período extra */
 {const ko=m.knockout;m.periodsDef=m.periodsDef.filter(p=>!p.extra||(ko&&(p.golden?!!ko.golden:(!!ko.extraTime&&!ko.golden))));}
 m.periodLen=m.mode.periodLen;m.nextPoss=m.mode.id==='germinare'?3+rng()*4:m.nextPoss;
 m.teams={home:E.makeTeam(m,'home',homeClub),away:E.makeTeam(m,'away',awayClub)};
 m.teams.home.form=rng.gauss()*3.6+(settings.neutral?0:1.4);/* fator casa + fase do dia */m.teams.away.form=rng.gauss()*3.6;
 m.added={};for(const p of m.periodsDef)m.added[p.id]=null;
 m.kickoffs.push({t:0,side:rng()<.5?'home':'away',period:'first'});m.firstKick=m.kickoffs[0].side;
 E.refreshStrength(m);E.snap(m,null);return m;};
/* ---------- Períodos, relógio e fotografias do estado (para a transmissão nunca adiantar o resultado) ---------- */
E.periodOf=(m,id)=>m.periodsDef.find(p=>p.id===(id||m.period))||m.periodsDef[0];
E.periodEnd=(m,id)=>{const p=E.periodOf(m,id);return p.start+p.len+(m.added[p.id]??0);};
E.clockText=function(m,c,pid){const p=E.periodOf(m,pid);const nominal=p.start+p.len;const mm=Math.floor(c/60),ss=String(Math.floor(c%60)).padStart(2,'0');
 if(m.mode.id!=='pro'&&!p.extra)return mm+':'+ss;
 if(c>=nominal&&p.len>=600){const x=Math.floor((c-nominal)/60);return (nominal/60)+'+'+x+':'+ss;}return String(mm).padStart(2,'0')+':'+ss;};
E.minuteAt=function(m,c,pid){const p=E.periodOf(m,pid);const nominal=p.start+p.len;const mm=Math.floor(c/60)+1;
 if(m.mode.id!=='pro')return String(Math.floor(c/60)+':'+String(Math.floor(c%60)).padStart(2,'0'));
 if(mm>nominal/60)return (nominal/60)+'+'+(mm-nominal/60);return String(mm);};
E.lineState=function(m){const o=[];for(const t of Object.values(m.teams))for(const p of [...t.players.filter(Boolean),...t.bench,...t.sentOff])o.push([p.id,p.on?1:0,p.yellow,p.red?1:0,Math.round(p.energy*100),p.slot]);return o;};
E.pIndex=(m,pid)=>{pid=pid||m.period;if(pid==='shootout')return 99;const i=m.periodsDef.findIndex(p=>p.id===pid);return i<0?0:i;};
E.snap=function(m,ev){m.snaps.push({t:m.clock,pi:E.pIndex(m),period:m.period,ev:ev?ev.id:null,score:{...m.score},stats:JSON.stringify(m.stats),lines:E.lineState(m),pens:m.pens?{...m.pens}:null,tick:m.ticker.length});};
E.blankStats=()=>({throwIns:0,goals:0,shots:0,onTarget:0,fouls:0,corners:0,offsides:0,yellow:0,red:0,saves:0,passes:0,passOk:0,tackles:0,xg:0,possession:50,subs:0});
E.makeTeam=function(m,side,club){const slots=D.formationSlots(club.tactics?.formation||'4-3-3');
 const mk=(p,i,bench)=>({id:p.id,data:p,side,slot:bench?-1:i,pos:bench?p.position:slots[i].pos,group:D.groupOf(bench?p.position:slots[i].pos),attrs:{...p.attrs},energy:1,yellow:0,red:false,on:!bench,used:false,minutesIn:bench?null:0,
  st:{goals:0,assists:0,shots:0,onT:0,keyPasses:0,tackles:0,saves:0,fouls:0,dribbles:0,rating:6.0}});
 const t={side,club,tactics:{...D.TACTIC_DEFAULT,...(club.tactics||{})},slots,players:club.players.slice(0,m.mode?.players||11).map((p,i)=>mk(p,i,false)),bench:D.matchdayBench(club.bench).map(p=>mk(p,-1,true)),subsUsed:0,sentOff:[],form:0,str:{}};
 t.players.forEach(p=>p.team=t);t.bench.forEach(p=>p.team=t);return t;};
E.onPitch=t=>t.players.filter(p=>p&&p.on);
E.eff=function(p,k){if(!p)return 35;const a=p.attrs[k]||40,e=p.energy;return a*(PHYS.has(k)?(.74+.26*e):(.9+.1*e))+(p.team?.form||0);};
const avg=(arr,f)=>arr.length?arr.reduce((s,p)=>s+f(p),0)/arr.length:50;
E.refreshStrength=function(m){for(const side of ['home','away']){const t=m.teams[side],on=E.onPitch(t),g=gr=>on.filter(p=>gr.includes(p.group));
  const men=on.length/(m.mode?.players||11);const e=E.eff;
  t.str={mid:avg(g(['DM','CM','AM']),p=>e(p,'passing')*.35+e(p,'vision')*.25+e(p,'ballControl')*.25+e(p,'stamina')*.15)-(1-men)*45,
   att:avg(g(['ST','W','AM']),p=>e(p,'finishing')*.3+e(p,'dribbling')*.25+e(p,'pace')*.2+e(p,'positioning')*.25)-(1-men)*30,
   def:avg(g(['CB','FB','DM']),p=>e(p,'marking')*.3+e(p,'tackling')*.3+e(p,'positioning')*.25+e(p,'strength')*.15)-(1-men)*55,
   gk:(()=>{const k=on.find(p=>p.group==='GK')||on[0];return k?e(k,'gkReflexes')*.5+e(k,'gkPositioning')*.4+e(k,'agility')*.1:30;})(),men};}};
const MENT={park:-2,defensive:-1,balanced:0,attacking:1,allout:2};
E.mentality=function(m,t){let v=MENT[t.tactics.mentality]||0;const diff=m.score[t.side]-m.score[SIDE_OTHER[t.side]],min=m.clock/(m.periodLen*(m.mode?.periods||2))*90;
 if(min>65&&diff<0)v+=diff<-1?1.2:1;if(min>75&&diff>0)v-=.8;if(min>85&&diff===0)v+=.3;return clamp(v,-2,2.4);};

/* ---------- Avanço do relógio ---------- */
/* Avança até `to` segundos. Para no primeiro lance de destaque e o devolve; caso contrário, null. */
E.playing=m=>m.phase==='first'||m.phase==='second'||m.phase==='et1'||m.phase==='et2'||m.phase==='golden';
E.possGap=m=>m.mode.id==='germinare'?(5+m.rng()*8)/m.tempo:(16+m.rng()*24)/m.tempo;
/* Avança até `to` segundos. Para no primeiro lance de destaque e o devolve; caso contrário, null. */
E.advance=function(m,to){
 if(m.phase==='shootout')return E.shootoutKick(m);
 while(m.clock<to&&E.playing(m)){
  const p=E.periodOf(m);const nominal=p.start+p.len;
  if(m.added[p.id]===null&&Math.min(to,m.nextPoss)>=nominal){m.clock=nominal;m.added[p.id]=p.golden?0:R.addedTime(m.counts[p.id]||{},p.id);
   if(m.added[p.id]>0){E.tick(m,'added',null,`+${m.added[p.id]/60} minuto${m.added[p.id]>60?'s':''} de acréscimo`,{minutes:m.added[p.id]/60});E.snap(m,null);}continue;}
  const end=nominal+(m.added[p.id]??1e9);
  const target=Math.min(to,m.nextPoss,end);
  E.fatigue(m,target-m.clock);m.clock=target;
  if(m.clock>=end-1e-6){E.endPeriod(m);E.snap(m,null);return null;}
  if(m.clock>=m.nextPoss-1e-6){
   if(m.clock>=m.nextSubCheck){m.nextSubCheck=m.clock+60;E.autoSubs(m);}
   m._snap=JSON.stringify(m.stats);m._lineup={home:m.teams.home.players.map(p=>p&&p.on?p.id:null),away:m.teams.away.players.map(p=>p&&p.on?p.id:null)};m._scoreBefore={...m.score};
   const ev=m.mode.id==='germinare'&&MD.Germinare?MD.Germinare.possession(m):E.possession(m);m.nextPoss=m.clock+E.possGap(m);
   if(ev&&ev.goal)E.afterGoal(m,ev);
   E.snap(m,ev);
   if(ev)return ev;}}
 return null;};
/* Depois de um gol: reinício pelo meio (toque inicial) ou fim imediato (condição de gols / gol de ouro). */
E.afterGoal=function(m,ev){const p=E.periodOf(m);
 if(p.golden||(m.mode.endGoals>0&&!p.extra&&Math.max(m.score.home,m.score.away)>=m.mode.endGoals)){m.phase='fulltime';m.endReason=p.golden?'golden':'goals';m.breakAt=m.clock;return;}
 const ab=m.mode.restartAfterGoal||[55,85];const d=ab[0]+m.rng()*(ab[1]-ab[0]);const t=m.clock+d;
 if(t<p.start+p.len+(m.added[p.id]??0)-2){m.kickoffs.push({t,side:ev.goal.side==='home'?'away':'home',period:p.id,afterGoal:ev.id});
  m.nextPoss=Math.max(m.nextPoss,t+(m.mode.id==='germinare'?2+m.rng()*3:8+m.rng()*10));}};
/* Fim de um período: intervalo, prorrogação/gol de ouro (mata-mata empatado), pênaltis ou fim de jogo. */
E.endPeriod=function(m){const i=m.periodsDef.findIndex(p=>p.id===m.period);const next=m.periodsDef[i+1];const draw=m.score.home===m.score.away;m.breakAt=m.clock;
 if(next&&(!next.extra||(m.knockout&&draw))){m.phase='halftime';m.nextPeriod=next.id;m.breakKind=next.extra?(E.periodOf(m).extra?'extra_half':'pre_extra'):'half';return;}
 if(m.knockout&&draw&&m.knockout.shootout!==false){m.phase='halftime';m.nextPeriod='shootout';m.breakKind='pre_shootout';return;}
 m.phase='fulltime';m.endReason=m.endReason||'time';};
E.startNextPeriod=function(m){const id=m.nextPeriod||'second';m.nextPeriod=null;
 if(id==='shootout'){m.phase='shootout';E.initShootout(m);return;}
 const p=E.periodOf(m,id);m.phase=id;m.period=id;m.half=p.half;m.clock=p.start;m.nextPoss=p.start+(m.mode.id==='germinare'?3+m.rng()*4:6+m.rng()*12);
 for(const t of Object.values(m.teams))for(const q of E.onPitch(t))q.energy=Math.min(1,q.energy+(id==='second'?.06:.03));
 const firstOf=pid=>m.kickoffs.find(k=>k.period===pid&&!k.afterGoal);
 const ks=id==='second'?(firstOf('first')?.side==='home'?'away':'home'):id==='et2'?(firstOf('et1')?.side==='home'?'away':'home'):(m.rng()<.5?'home':'away');
 m.kickoffs.push({t:p.start,side:ks,period:id});
 if(id==='second')E.autoSubs(m,true);E.refreshStrength(m);E.snap(m,null);};
E.startSecondHalf=E.startNextPeriod;
/* ---------- Disputa de pênaltis (mata-mata) ---------- */
E.initShootout=function(m){const order=side=>{const on=E.onPitch(m.teams[side]);const gk=on.filter(p=>p.group==='GK');
  return [...on.filter(p=>p.group!=='GK').sort((a,b)=>(b.attrs.finishing*.55+b.attrs.composure*.45)-(a.attrs.finishing*.55+a.attrs.composure*.45)),...gk].map(p=>p.id);};
 const first=m.rng()<.5?'home':'away';m.period='shootout';
 m.pens={home:0,away:0,taken:{home:0,away:0},turn:first,first,order:{home:order('home'),away:order('away')},kicks:[],decided:false,winner:null,rounds:m.mode.shootoutKicks||5};E.snap(m,null);};
E.shootoutKick=function(m){const S=m.pens;if(!S||S.decided)return null;const side=S.turn,other=SIDE_OTHER[side];const A=m.teams[side],Dt=m.teams[other];
 const ord=S.order[side];const taker=E.find(m,ord[S.taken[side]%ord.length]);const gk=keeperOf(Dt);const rng=m.rng;
 m._lineup={home:m.teams.home.players.map(p=>p&&p.on?p.id:null),away:m.teams.away.players.map(p=>p&&p.on?p.id:null)};m._scoreBefore={...m.score};m._snap=JSON.stringify(m.stats);
 const P=new Play(m,A,Dt,'shootout');P.flags.shootout=true;const round=S.taken[side]+1;
 const nerves=round>S.rounds?.04:round===S.rounds?.025:0;
 const tq=E.eff(taker,'finishing')*.55+E.eff(taker,'composure')*.45,kq=gk?E.eff(gk,'gkPenalties')*.65+E.eff(gk,'gkReflexes')*.35:20;
 const pg=clamp(.76+(tq-75)/260-(kq-70)/230-nerves,.5,.92);const pMiss=clamp(.08-(tq-75)/600+nerves*.5,.03,.16);const r=rng();
 const s2=rng()<.45?-1:rng()<.85?1:0;const dive=rng()<.42?s2:rng()<.85?(-s2||(rng()<.5?-1:1)):0;
 let outcome=r<pg?'goal':r<pg+pMiss?(rng()<.4?'over':rng()<.6?'wide':'post'):'save';if(outcome==='save'&&dive!==s2)outcome='goal';
 const g=R.PITCH.goalHalfW/3.66,h=R.PITCH.goalH/2.44;
 const target=outcome==='goal'?[s2*(1.8+rng()*1.6)*g,s2===0?(1+rng())*h:(.2+rng()*1.8)*h]:outcome==='save'?[s2*(1.4+rng()*1.5)*g,(.3+rng()*1.2)*h]:outcome==='post'?[(rng()<.5?-1:1)*R.PITCH.goalHalfW,(.5+rng())*h]:outcome==='over'?[s2*rng()*3*g,R.PITCH.goalH+.36+rng()]:[(s2||1)*(R.PITCH.goalHalfW+.34+rng()),.3+rng()];
 P.add({k:'penalty',by:P.ref(taker),keeper:P.ref(gk),target,keeperDive:dive,outcome,power:26,shootout:true});P.people.shooter=taker.id;if(gk)P.people.keeper=gk.id;P.imp=3;P.ended=true;P.outcome=outcome==='goal'?'goal':'penalty_'+outcome;
 const scored=outcome==='goal';S.taken[side]++;if(scored)S[side]++;S.kicks.push({side,id:taker.id,name:taker.data.name,scored});
 if(scored)taker.st.rating+=.15;else{taker.st.rating-=.3;if(gk&&outcome==='save')gk.st.rating+=.4;}
 /* decidido? (matematicamente, durante as cobranças regulamentares; ou na morte súbita, após cada par) */
 const n=S.rounds,th=S.taken.home,ta=S.taken.away;
 if(th<=n&&ta<=n){const remH=n-th,remA=n-ta;if(S.home>S.away+remA||S.away>S.home+remH)S.decided=true;}
 if(!S.decided&&th===ta&&th>=n&&S.home!==S.away)S.decided=true;
 S.turn=other;
 const ev=E.makeEvent(m,P,null,'shootout');ev.shoot={side,scored,outcome,round,home:S.home,away:S.away,decided:S.decided,kicks:S.kicks.length,first:S.first};
 if(S.decided){S.winner=S.home>S.away?'home':'away';m.phase='fulltime';m.endReason='pens';}
 E.snap(m,ev);return ev;};
/* Vencedor (no mata-mata considera os pênaltis). */
E.winner=m=>m.score.home>m.score.away?'home':m.score.away>m.score.home?'away':(m.pens&&m.pens.winner)||null;
E.fatigue=function(m,dt){if(dt<=0)return;const minutes=dt/60;
 for(const t of Object.values(m.teams)){const press=t.tactics.pressing==='high'?1.25:t.tactics.pressing==='low'?.86:1;
  for(const p of E.onPitch(t)){const role=p.group==='GK'?.25:p.group==='FB'||p.group==='W'||p.group==='CM'?1.12:1;
   p.energy=Math.max(.18,p.energy-minutes*.0049*(1.42-p.attrs.stamina/100)*press*role);}}
 if(Math.floor((m.clock+dt)/300)!==Math.floor(m.clock/300))E.refreshStrength(m);};

/* ---------- Registro ---------- */
E.minute=m=>E.minuteAt?E.minuteAt(m,m.clock,m.period):U.minuteLabel(m.clock,m.half);
E.tick=function(m,type,side,text,extra){const t={clock:m.clock,half:m.half,period:m.period,minute:E.minute(m),type,side,text,...(extra||{})};m.ticker.push(t);return t;};
E.count=(m,k,n=1)=>{const c=m.counts[m.period]||(m.counts[m.period]={});c[k]=(c[k]||0)+n;};
function pname(p){return p?p.data.name:'';}

/* ---------- Substituições ---------- */
E.autoSubs=function(m,halftime){if(!m.settings.autoSubs)return;
 for(const t of Object.values(m.teams)){if(!R.canSubstitute(t,m.settings))continue;const min=m.clock/60;if(!halftime&&min<55)continue;
  const tired=E.onPitch(t).filter(p=>p.group!=='GK').sort((a,b)=>a.energy-b.energy);
  for(const p of tired){if(t.subsUsed>=(m.settings.maxSubs??5))break;const need=p.energy<(.7+(min>70?.06:0))||(p.yellow&&['CB','DM','FB'].includes(p.group)&&min>60&&m.rng()<.25);
   if(!need||(halftime&&m.rng()<.6))continue;const sub=E.bestSub(t,p);if(!sub)break;E.substitute(m,t,p,sub,halftime?'Intervalo':'Cansaço');if(m.rng()<.5)break;}}};
E.bestSub=function(t,out){const free=t.bench.filter(b=>!b.used&&b.group!=='GK');if(!free.length)return null;
 const sameLine=g=>['CB','FB'].includes(g)?'D':['DM','CM','AM'].includes(g)?'M':g==='GK'?'G':'A';
 return free.sort((a,b)=>(sameLine(b.group)===sameLine(out.group))-(sameLine(a.group)===sameLine(out.group))||b.data.rating-a.data.rating)[0];};
E.substitute=function(m,t,out,sub,reason){const i=t.players.indexOf(out);if(i<0||!out.on)return false;
 out.on=false;sub.used=true;sub.on=true;sub.slot=i;sub.pos=t.slots[i].pos;sub.group=t.slots[i].group;sub.minutesIn=m.clock;t.players[i]=sub;t.subsUsed++;m.stats[t.side].subs++;E.count(m,'sub');
 E.refreshStrength(m);E.tick(m,'sub',t.side,`Substituição no ${t.club.name}: sai ${pname(out)}, entra ${pname(sub)}`,{outId:out.id,inId:sub.id,outName:pname(out),inName:pname(sub),reason});return true;};
/* Substituição manual (intervalo). */
E.manualSub=function(m,side,outId,inId){const t=m.teams[side];const out=t.players.find(p=>p.id===outId&&p.on),sub=t.bench.find(p=>p.id===inId&&!p.used);
 if(!out||!sub||!R.canSubstitute(t,m.settings))return false;return E.substitute(m,t,out,sub,'Opção do técnico');};

/* ---------- Posse de bola ---------- */
E.possession=function(m){const H=m.teams.home,A=m.teams.away,rng=m.rng;
 const tPoss=t=>(t.tactics.style==='possession'?.18:t.tactics.style==='counter'?-.16:t.tactics.style==='direct'?-.06:0)+(t.tactics.pressing==='high'?.06:0);
 const pHome=clamp(lg((H.str.mid-A.str.mid)/40+.1+tPoss(H)-tPoss(A)+m.momentum*.25),.37,.63);
 const side=rng()<pHome?'home':'away',att=m.teams[side],def=m.teams[SIDE_OTHER[side]];
 const dur=(16+rng()*24)/m.tempo;m.possTime[side]+=dur;
 const tot=m.possTime.home+m.possTime.away;m.stats.home.possession=Math.round(m.possTime.home/tot*100);m.stats.away.possession=100-m.stats.home.possession;
 m.momentum*=.92;
 const ma=E.mentality(m,att),md=E.mentality(m,def);
 /* gestão do placar: quem goleia relaxa, quem perde arrisca */
 const lead=m.score[side]-m.score[SIDE_OTHER[side]];const relax=lead>=3?.62:lead===2?.8:lead<=-2?1.08:1;
 const press=(def.tactics.pressing==='high'?.07:def.tactics.pressing==='low'?-.05:0)+(md>1?.03:0);
 const st=m.stats[side];st.passes+=4+Math.floor(rng()*7);st.passOk+=3+Math.floor(rng()*6);
 /* 1) Saída de bola */
 const s1=clamp(.74+(att.str.mid-def.str.mid)/380-press,.6,.88);
 if(rng()>s1){if(def.tactics.pressing==='high'&&rng()<.06*m.chaos)return E.chance(m,def,att,'counter_press');
  if(rng()<.2)return E.minorFoul(m,def,att,-25+rng()*30);if(rng()<.38){m.stats[side].throwIns++;if(rng()<.12)E.tick(m,'throw',side,'Lateral para o '+att.club.name);}return null;}
 /* 2) Chegada ao terço final */
 const s2=clamp((.4+(att.str.att*.6+att.str.mid*.4-def.str.def)/360+ma*.045-md*.03)*relax,.3,.58);
 if(rng()>s2){const r=rng();if(r<.11)return E.minorFoul(m,def,att,5+rng()*22);
  if(r<.16)return E.chance(m,att,def,'long_shot');
  if(r<.24&&def.tactics.style!=='possession'&&rng()<.4*m.chaos)return E.chance(m,def,att,'counter');
  if(r<.238){m.stats[side].offsides++;E.tick(m,'offside',side,'Impedimento marcado contra o '+att.club.name);}
  return null;}
 /* 3) Criação da chance */
 const s3=clamp((.3+(att.str.att-def.str.def)/320+ma*.04-md*.035)*relax,.19,.38);
 if(rng()>s3){const r=rng();
  if(r<.15)return E.setPieceCorner(m,att,def);
  if(r<.215)return E.dangerFoul(m,att,def);
  if(r<.24){m.stats[side].offsides++;E.count(m,'freeKick');return E.maybeOffsideHighlight(m,att,def);}
  if(r<.31)return E.chance(m,att,def,'long_shot');
  return null;}
 return E.chance(m,att,def,null);};

/* Falta sem perigo (ticker), com possibilidade de cartão. x = posição no quadro de quem sofreu. */
E.minorFoul=function(m,offender,victimTeam,x){const rng=m.rng,def=offender;const on=E.onPitch(def).filter(p=>p.group!=='GK');
 const fouler=pickBy(on,p=>p.attrs.aggression-(p.yellow?30:0),rng,12);const vs=E.onPitch(victimTeam).filter(p=>p.group!=='GK');const victim=vs[Math.floor(rng()*vs.length)];
 if(!fouler||!victim)return null;m.stats[def.side].fouls++;fouler.st.fouls++;E.count(m,'freeKick');
 if(rng()<.07){const cls=R.classifyFoul({x,z:(rng()-.5)*40,offence:'dangerous_play',contact:false});E.tick(m,'foul',def.side,`Jogo perigoso de ${pname(fouler)}: ${cls.restart==='indirect_free_kick'?'tiro livre indireto':'tiro livre direto'}`);return null;}
 const sev=E.severity(m,fouler,false);const decision=R.foulCard({severity:sev,spa:x>10&&rng()<(fouler.yellow?.02:.1),existingYellows:fouler.yellow});
 if(decision.card){/* cartões viram lance 3D quando forem vermelhos, ou parte dos amarelos */
  if(decision.card==='red'||rng()<({few:.25,normal:.45,many:.7}[m.settings.highlightRate]||.45))return E.cardHighlight(m,def,victimTeam,fouler,victim,sev,decision,x);
  E.applyCard(m,fouler,decision,victim);return null;}
 E.tick(m,'foul',def.side,`Falta de ${pname(fouler)} em ${pname(victim)}`);return null;};
E.severity=function(m,p,slide){const r=m.rng(),ag=(p.attrs.aggression-55)/100,tired=(1-p.energy)*.25;const k=m.strict;
 const caution=p.yellow?.18:1;const exc=(.0022+ag*.005+(slide?.004:0))*k*caution,rec=(.08+ag*.13+tired*.5+(slide?.08:0))*k*caution;return r<exc?'excessive':r<exc+rec?'reckless':'careless';};
E.applyCard=function(m,p,decision,victim,silent){const t=p.team,st=m.stats[t.side];E.count(m,'card');
 if(decision.card==='yellow'){p.yellow++;st.yellow++;if(!silent)E.tick(m,'yellow',t.side,`Cartão amarelo para ${pname(p)} (${t.club.name})`,{playerId:p.id,reason:decision.reason});}
 else{if(decision.secondYellow){p.yellow++;st.yellow++;}p.red=true;st.red++;E.count(m,'red');E.sendOff(m,p);if(!silent)E.tick(m,'red',t.side,`Cartão vermelho para ${pname(p)}! ${t.club.name} fica com ${E.onPitch(t).length}`,{playerId:p.id,reason:decision.reason});}
 p.st.rating-=decision.card==='red'?1.5:.35;};
E.sendOff=function(m,p){const t=p.team;if(E.onPitch(t).length<=7)return;p.on=false;t.sentOff.push(p);
 if(p.group==='GK'){/* goleiro expulso: reserva entra no lugar de um jogador de linha, ou um jogador de linha vai ao gol */
  const gkSub=t.bench.find(b=>!b.used&&b.group==='GK');const outfield=E.onPitch(t).filter(x=>x.group!=='GK').sort((a,b)=>a.data.rating-b.data.rating)[0];
  const slot=t.players.indexOf(p);
  if(gkSub&&outfield&&R.canSubstitute(t,m.settings)){outfield.on=false;const oi=t.players.indexOf(outfield);t.players[oi]=null;gkSub.used=true;gkSub.on=true;gkSub.slot=slot;gkSub.pos='GOL';gkSub.group='GK';t.players[slot]=gkSub;t.subsUsed++;
   E.tick(m,'sub',t.side,`Goleiro reserva ${pname(gkSub)} entra no lugar de ${pname(outfield)}`,{outId:outfield.id,inId:gkSub.id,outName:pname(outfield),inName:pname(gkSub),reason:'Expulsão'});}
  else if(outfield){const oi=t.players.indexOf(outfield);t.players[oi]=null;outfield.slot=slot;outfield.pos='GOL';outfield.group='GK';t.players[slot]=outfield;}
  else t.players[slot]=null;}
 else t.players[t.players.indexOf(p)]=null;
 E.refreshStrength(m);};

/* ---------- Seleção de atores ---------- */
function pickBy(list,score,rng,temp=8){if(!list.length)return null;return rng.weighted(list.map(p=>[p,Math.exp(score(p)/temp)]));}
const outfield=t=>E.onPitch(t).filter(p=>p.group!=='GK');
const keeperOf=t=>E.onPitch(t).find(p=>p.group==='GK')||null;
/* Posição base de um jogador no quadro de ataque (defensores espelhados). */
E.basePos=function(p,attacking,shift){const s=p.team.slots[p.slot]||{x:0,z:0};return attacking?[s.x+(shift||0),s.z]:[-s.x-(shift||0),-s.z];};
function nearestDef(t,x,z,exclude){let best=null,bd=1e9;for(const p of outfield(t)){if(exclude&&exclude.includes(p))continue;const b=E.basePos(p,false,8*R.PITCH.L/54);const d=U.dist(b[0],b[1],x,z);if(d<bd){bd=d;best=p;}}return best;}

/* ---------- Construtor de jogadas ---------- */
class Play{
 constructor(m,A,Dt,type){this.m=m;this.A=A;this.D=Dt;this.type=type;this.beats=[];this.ended=false;this.outcome=null;this.rng=m.rng;this.ball=[0,0];this.last='A';this.xg=0;this.imp=0;this.offsideLate=null;this.assist=null;this.lastPasser=null;this.people={};this.flags={};this.beaten=[];}
 ref(p){return p?{s:p.team===this.A?'A':'D',i:p.slot,id:p.id}:null;}
 add(b){this.beats.push(b);return b;}
 start(p,pos,ctx){this.ball=pos.slice();this.add({k:'start',by:this.ref(p),at:pos.slice(),ctx:ctx||'open'});this.holder=p;}
 end(outcome){this.ended=true;this.outcome=this.outcome||outcome;}
 /* Passe com disputa: passe/visão vs posicionamento/marcação do defensor mais próximo do destino. */
 pass(p,to,style,toPos,opt={}){const rng=this.rng,e=E.eff;const defender=nearestDef(this.D,toPos[0],toPos[1]);
  const base={ground:2.1,through:.75,lofted:1.0,long:.25,cross:.38,lowcross:.6,cutback:1.0,switch:.8,chip:.5,header_pass:.6,oneTwo:1.4}[style]??1;
  let q=(e(p,'passing')*.6+e(p,'vision')*.4-(defender?(e(defender,'positioning')*.5+e(defender,'marking')*.5):40))/30+base-(1-p.energy)*.8;
  /* IA: passadores com boa visão evitam o passe claramente interceptável (escolhem um passe mais seguro, menos agudo) */
  let safe=false;if(!opt.force&&!opt.noSafe&&lg(q)<.5&&['through','long','lofted','switch','chip'].includes(style)&&rng()<clamp((e(p,'vision')-58)/45,0,.75)){
   style='ground';toPos=[toPos[0]-3.5,toPos[1]*.85];q+=1.0;safe=true;}
  let ok=rng()<lg(q)||opt.force;const b={k:'pass',by:this.ref(p),to:this.ref(to),from:this.ball.slice(),at:toPos.slice(),style,ok,safe};
  this.m.stats[p.team.side].passes++;
  /* impedimento no momento do passe */
  if(ok&&R.PROFILE.offside&&['through','long','lofted','chip','switch'].includes(style)&&!opt.noOffside){const line=this.D.tactics.pressing==='high'?.09:.045;
   if(toPos[0]>18&&rng()<line*this.m.chaos){b.offside=true;if(rng()<.3)this.offsideLate=to;else{this.add(b);this.add({k:'offside',by:this.ref(to),at:toPos.slice(),flag:true});this.m.stats[p.team.side].offsides++;E.count(this.m,'freeKick');this.flags.offside=true;this.imp+=.15;this.end('offside');return false;}}}
  if(!ok){b.cut={by:this.ref(defender),style:style==='cross'||style==='long'||style==='lofted'?'header_clear':style==='lowcross'||style==='cutback'?'block':'intercept'};
   this.add(b);this.last='D';if(defender)defender.st.tackles++;
   if(b.cut.style==='header_clear'&&toPos[0]>R.PITCH.L-18&&rng()<.42){this.cornerFromClear=true;this.add({k:'out',type:'corner',at:[R.PITCH.L,Math.sign(toPos[1]||1)*R.PITCH.W],by:this.ref(defender)});this.m.stats[this.A.side].corners++;}
   this.end('turnover');return false;}
  this.m.stats[p.team.side].passOk++;this.add(b);this.ball=toPos.slice();this.lastPasser=p;this.holder=to;return true;}
 carry(p,toPos){this.add({k:'carry',by:this.ref(p),from:this.ball.slice(),to:toPos.slice()});this.ball=toPos.slice();}
 /* Duelo de drible: escolhe o movimento conforme habilidade; derrota pode gerar desarme, carrinho ou falta. */
 duel(p,def,pos,opt={}){const rng=this.rng,e=E.eff;if(!def)return'beat';
  const skill=e(p,'dribbling')*.5+e(p,'agility')*.25+e(p,'ballControl')*.25;
  const moves=E.MOVES.filter(mv=>skill>=mv[2]-6||mv[1]<=1);
  const move=rng.weighted(moves.map(mv=>[mv,(mv[1]<=2?3:1.4)*(skill>80&&mv[1]>=3?1.8:1)*(mv[0]==='speed'?e(p,'pace')/70:1)]));
  const dq=(e(def,'tackling')*.55+e(def,'marking')*.25+e(def,'agility')*.2);
  const q=(skill-dq)/26+.35-move[1]*.17+(skill>84?move[1]*.08:0)-(1-p.energy)*.6+(opt.bonus||0);
  const ok=rng()<lg(q);const PP=R.PITCH;const after=[clamp(pos[0]+1.6+rng()*2.2,pos[0],PP.L-2),clamp(pos[1]+(rng()-.5)*5,-(PP.W-4),PP.W-4)];
  this.people.dribbler=p.id;
  if(ok){p.st.dribbles++;this.beaten.push(def);this.add({k:'skill',by:this.ref(p),vs:this.ref(def),move:move[0],ok:true,at:pos.slice(),to:after});this.ball=after.slice();this.imp+=move[1]>=4?.45:move[1]>=3?.2:.05;
   /* falta tática/atrasada depois de ser driblado */
   const boxK=R.inPenaltyArea(after[0],after[1])?.5:1,cardK=def.yellow?.45:1;const pf=(.1+(def.attrs.aggression-50)/260+(pos[0]>30?.05:0)+(1-def.energy)*.08)*(opt.foulMul||1)*boxK*cardK;
   if(rng()<pf)return this.foul(def,p,after,'late');return'beat';}
  /* perdeu o duelo */
  const slide=rng()<.18+(def.attrs.aggression-50)/220+(def.group==='CB'?.08:0);
  const foulP=((slide?.24:.11)+(def.attrs.aggression-50)/200+(1-def.energy)*.12-(e(def,'tackling')-60)/400)*(R.inPenaltyArea(pos[0],pos[1])?.55:1)*(def.yellow?.5:1);
  this.add({k:'skill',by:this.ref(p),vs:this.ref(def),move:move[0],ok:false,at:pos.slice(),to:pos.slice()});
  if(rng()<foulP)return this.foul(def,p,pos,slide?'slide':'stand');
  def.st.tackles++;this.m.stats[def.team.side].tackles++;this.add({k:'tackle',by:this.ref(def),on:this.ref(p),style:slide?'slide':rng()<.3?'shoulder':'stand',at:pos.slice(),ok:true});
  this.last='D';this.end('turnover');return'lost';}
 /* Falta: as regras decidem pênalti / tiro livre, cartão, vantagem. */
 foul(def,victim,pos,kind){const rng=this.rng,m=this.m;const offence=kind==='slide'?'tackle':kind==='late'?(rng()<.5?'trip':'hold'):rng()<.55?'trip':rng()<.5?'push':'hold';
  const severity=E.severity(m,def,kind==='slide');const cls=R.classifyFoul({x:pos[0],z:pos[1],offence});
  const d=R.distToGoal(pos[0],pos[1]);const lastMan=(def.group==='CB'||def.group==='GK')&&rng()<.3;
  const dogso=!R.PITCH.small&&d<22&&Math.abs(pos[1])<14&&kind==='late'&&lastMan&&this.flags.counter!==undefined?rng()<.5:d<20&&Math.abs(pos[1])<12&&kind==='late'&&lastMan&&rng()<.22;const spa=!dogso&&pos[0]>R.PITCH.L/3&&rng()<(def.yellow?.04:.18);
  const decision=R.foulCard({severity,dogso,spa,restart:cls.restart,attemptToPlayBall:offence==='tackle'||offence==='trip'&&rng()<.6,offence,existingYellows:def.yellow});
  const adv=R.advantage({restart:cls.restart,severity,keepsPossession:kind==='late'&&rng()<.35+(victim.attrs.balance-60)/150,promising:pos[0]>8});
  m.stats[def.team.side].fouls++;def.st.fouls++;E.count(m,'freeKick');
  const b=this.add({k:'foul',by:this.ref(def),on:this.ref(victim),at:pos.slice(),offence,severity,restart:cls.restart,advantage:adv,card:decision.card?{color:decision.card,reason:decision.reason,second:decision.secondYellow}:null,fall:kind==='slide'?'slide':offence==='push'?'push':'trip',dangerous:cls.dangerous});
  this.people.fouler=def.id;this.people.victim=victim.id;this.imp+=cls.restart==='penalty'?1.5:cls.dangerous?.55:.25;if(decision.card==='red')this.imp+=1.2;else if(decision.card)this.imp+=.3;
  this.pendingCard=decision.card?{p:def,decision,victim}:null;this.foulBeat=b;
  if(adv){this.ball=pos.slice();return'advantage';}
  this.end(cls.restart==='penalty'?'penalty':'freekick');this.restart=cls;return'foul';}
 /* Finalização: probabilidade de gol contextualizada (distância, ângulo, tipo, pressão, atributos, goleiro). */
 shoot(p,pos,type,opt={}){const m=this.m,rng=this.rng,e=E.eff,gk=keeperOf(this.D);const d=R.distToGoal(pos[0],pos[1]);
  const PP=R.PITCH,GW=PP.goalHalfW,gz=GW/3.66,gh=PP.goalH/2.44;const ang=Math.abs(Math.atan2(GW-pos[1],PP.L-pos[0])-Math.atan2(-GW-pos[1],PP.L-pos[0]));
  const skillKey=type==='header'?'heading':'finishing';const skill=e(p,skillKey)*.75+e(p,'composure')*.25;
  let xg=clamp(1.15*Math.exp(-d/(PP.small?4.6:7.2))*Math.pow(ang/(PP.small?.42:.75),.55),.01,.82);
  xg*={header:.62,volley:.72,bicycle:.38,firstTime:.92,chip:.85,power:.95,placed:1,low:.98,longshot:.9,penalty:1,freekick:.85}[type]||1;
  xg*=1-(opt.pressure??.35)*.4;xg*=(PP.small?(MD.Germinare?MD.Germinare.XG:1.2):1.09)*Math.exp((skill-76)/48);const gkq=gk?(e(gk,'gkReflexes')*.55+e(gk,'gkPositioning')*.45):25;xg*=Math.exp(-(gkq-72)/58);
  xg=clamp(xg*(opt.xgMul||1),.005,.9);
  this.xg+=xg;const st=m.stats[p.team.side];st.shots++;st.xg+=xg;p.st.shots++;
  const b={k:'shot',by:this.ref(p),from:pos.slice(),type,keeper:this.ref(gk),xg};this.people.shooter=p.id;if(gk)this.people.keeper=gk.id;
  /* bloqueio */
  const blockP=type==='header'||type==='bicycle'?.05:clamp(.08+(opt.pressure??.35)*.28+(d>(PP.small?10:20)?.06:0),.05,.3);
  if(!opt.noBlock&&rng()<blockP){const blk=nearestDef(this.D,pos[0]+3,pos[1],this.beaten);b.outcome='blocked';b.blocker=this.ref(blk);b.deflect=rng()<.42?'corner':'loose';b.power=24;
   if(b.deflect==='corner'){st.corners++;}this.add(b);this.last='D';this.imp+=.1+xg;this.end('blocked');return'blocked';}
  let pT=clamp(.36+(skill-60)/110-d/(PP.small?70:140)+(type==='power'?-.05:type==='placed'?.03:0)+(type==='header'?-.06:0),.16,.8);
  if(xg/pT>.88)pT=Math.min(.97,xg/.88);
  const r=rng();let outcome;
  if(r<xg)outcome='goal';else if(r<pT)outcome='save';else{const r2=rng();outcome=r2<.075?'post':r2<.11?'bar':(type==='power'||type==='longshot'||type==='volley'||type==='header'?(rng()<.55?'over':'wide'):(rng()<.35?'over':'wide'));}
  /* frango: goleiro fraco falha em chute defensável */
  if(outcome==='save'&&gk&&rng()<clamp(.012+(68-gkq)/900,.004,.05)){outcome='goal';b.keeperError=true;this.imp+=.5;}
  /* alvo no plano do gol (z lateral, y altura) — define a reação do goleiro */
  b.power=type==='power'||type==='longshot'?29+rng()*5:type==='chip'?15:type==='placed'?21+rng()*3:type==='header'?14+rng()*4:24+rng()*4;if(PP.small)b.power*=.82;
  const corner=e(p,'finishing')>75?.75:.55;let tz,ty;
  if(outcome==='goal'){tz=(rng()<.5?-1:1)*(rng()<corner?2.2+rng()*1.2:rng()*2.2)*gz;ty=(type==='low'||type==='firstTime'&&rng()<.6?.1+rng()*.4:type==='chip'?1.6+rng()*.6:rng()*2.1+.1)*gh;}
  else if(outcome==='save'){tz=(rng()-.5)*5.6*gz;ty=(type==='header'?.6+rng()*1.6:rng()*2.1+.1)*gh;}
  else if(outcome==='post'){tz=(rng()<.5?-1:1)*GW;ty=(.3+rng()*1.9)*gh;}
  else if(outcome==='bar'){tz=(rng()-.5)*6.4*gz;ty=PP.goalH;}
  else if(outcome==='over'){tz=(rng()-.5)*7*gz;ty=PP.goalH+.26+rng()*2.5;}
  else{tz=(rng()<.5?-1:1)*(GW+.29+rng()*3.5*gz);ty=rng()*1.6+.1;}
  b.target=[tz,ty];b.outcome=outcome;
  if(outcome==='goal'){if(gk)b.keeperDive=Math.abs(tz)<1.1?0:Math.sign(tz)*(rng()<.82?1:-1);b.keeperReach=.65;}
  if(outcome==='save'){st.onTarget++;p.st.onT++;if(gk){gk.st.saves++;m.stats[this.D.side].saves++;}
   const great=xg>.22||Math.abs(tz)>2.3*gz&&ty>1.4*gh;
   /* IA do goleiro: encaixa o que dá para segurar; espalma chutes fortes ou longe do corpo — goleiros melhores encaixam mais */
   const hold=clamp(.35+(gkq-70)/60-(b.power>27?.25:0),.1,.85);const near=Math.abs(tz)<.9*gz&&ty<1.5*gh;
   const style=near&&rng()<hold+.25?'catch':ty>1.9*gh&&Math.abs(tz)<2.6*gz?'tip':ty<.5&&d<(PP.small?6:11)?'foot':near?'parry':rng()<.45?'parry':'dive';
   b.save={style,side:Math.abs(tz)<.6?0:Math.sign(tz),high:ty>1.3,great};this.imp+=great?.7:.2;if(gk)gk.st.rating+=great?.45:.15;}
  if(outcome==='goal'){st.onTarget++;p.st.onT++;}
  if(outcome==='post'||outcome==='bar')this.imp+=.6;
  this.add(b);this.last=outcome==='save'?'D':'A';this.imp+=xg*2.2;
  if(outcome==='goal'){this.end('goal');return'goal';}
  if(outcome==='save'){if(b.save.style==='tip'||b.save.style==='parry'&&rng()<.35){st.corners++;b.toCorner=true;}else if(b.save.style==='parry'||b.save.style==='foot'||b.save.style==='dive'&&rng()<.5)b.rebound=true;}
  if(outcome==='post'||outcome==='bar')b.rebound=rng()<.45;
  this.end(outcome);return outcome;}
}
E.Play=Play;
/* Dribles: [id, dificuldade, habilidade mínima sugerida, rótulo] */
E.MOVES=[['short',1,0,'Drible curto'],['direction',1,0,'Mudança de direção'],['speed',1,0,'Drible de velocidade'],['cutIn',1,0,'Corte para dentro'],['bodyFeint',2,60,'Finta de corpo'],['drag',2,62,'Puxada de bola'],['sharpCut',2,64,'Corte seco'],['turn',2,66,'Giro'],['shotFeint',2,66,'Finta de chute'],['stepover',3,72,'Pedalada'],['flick',3,74,'Toque por cima'],['rainbow',4,80,'Lambreta'],['nutmeg',4,78,'Caneta'],['sombrero',4,82,'Chapéu'],['elastico',5,86,'Elástico']];
E.MOVE_LABEL=Object.fromEntries(E.MOVES.map(x=>[x[0],x[3]]));

/* Tipos de jogada ofensiva com pesos dependentes de tática/atributos. */
E.PLAY_TYPES={counter_fast:'CONTRA-ATAQUE RÁPIDO',counter_multi:'CONTRA-ATAQUE TRABALHADO',one_two:'TABELINHA',through:'PASSE EM PROFUNDIDADE',long_ball:'LANÇAMENTO LONGO',cross:'CRUZAMENTO',low_cross:'CRUZAMENTO RASTEIRO',byline:'LINHA DE FUNDO',central:'INFILTRAÇÃO PELO MEIO',solo:'JOGADA INDIVIDUAL',switch:'INVERSÃO DE JOGO',long_shot:'CHUTE DE FORA DA ÁREA',corner:'ESCANTEIO',set_corner:'JOGADA ENSAIADA',free_kick:'COBRANÇA DE FALTA',penalty:'PÊNALTI',card:'DISCIPLINA',offside:'IMPEDIMENTO'};
E.chooseType=function(m,A,Dt){const t=A.tactics,rng=m.rng,on=outfield(A);const best=(k,g)=>Math.max(...on.filter(p=>!g||g.includes(p.group)).map(p=>p.attrs[k]),40);
 const w=[['through',8+(best('vision')-70)/4+(t.style==='direct'?3:0)],['one_two',6+(t.style==='possession'?4:0)],['cross',7+(t.width==='wide'?4:0)+(best('heading',['ST','CB'])-70)/5],['low_cross',5+(t.width==='wide'?2:0)],
  ['byline',4+(best('pace',['W','FB'])-70)/6],['central',6+(t.width==='narrow'?3:0)],['solo',3+(best('dribbling')-72)/3],['switch',4+(t.style==='possession'?2:0)],['long_ball',3+(t.style==='direct'?5:0)],['counter_multi',2+(t.style==='counter'?3:0)]];
 return rng.weighted(w);};

/* ---------- Chance de gol (gera roteiro completo) ---------- */
E.chance=function(m,A,Dt,forced){const type=forced==='counter_press'||forced==='counter'?(m.rng()<.6?'counter_fast':'counter_multi'):forced||E.chooseType(m,A,Dt);
 const P=new Play(m,A,Dt,type);E.BUILD[type](P,m,A,Dt);return E.finish(m,P);};
E.setPieceCorner=function(m,A,Dt){m.stats[A.side].corners++;const P=new Play(m,A,Dt,m.rng()<.2?'set_corner':'corner');E.BUILD[P.type](P,m,A,Dt);return E.finish(m,P,true);};
E.dangerFoul=function(m,A,Dt){const P=new Play(m,A,Dt,'free_kick');const rng=m.rng;
 const victim=pickBy(outfield(A).filter(p=>['ST','W','AM','CM'].includes(p.group)),p=>p.attrs.dribbling,rng);const def=nearestDef(Dt,32,0);if(!victim||!def)return null;
 const inBox=rng()<.22;const pos=inBox?[40+rng()*10,(rng()-.5)*26]:[24+rng()*12,(rng()-.5)*34];
 P.start(victim,[pos[0]-8,pos[1]-(rng()-.5)*6],'open');P.carry(victim,[pos[0]-1.5,pos[1]]);const r=P.duel(victim,def,pos,{foulMul:3,bonus:.2});
 if(r==='beat'){E.continueFromBeat(P,victim);}else if(r==='advantage'){E.continueFromBeat(P,victim);}
 return E.finish(m,P);};
E.maybeOffsideHighlight=function(m,A,Dt){const rng=m.rng;if(rng()>({few:.15,normal:.3,many:.5}[m.settings.highlightRate]||.3)){E.tick(m,'offside',A.side,'Bandeira levantada: impedimento do '+A.club.name);return null;}
 const P=new Play(m,A,Dt,'offside');const passer=pickBy(outfield(A).filter(p=>['CM','AM','DM'].includes(p.group)),p=>p.attrs.vision,rng),runner=pickBy(outfield(A).filter(p=>['ST','W'].includes(p.group)),p=>p.attrs.pace,rng);
 if(!passer||!runner)return null;P.start(passer,[8+rng()*10,(rng()-.5)*14]);
 P.add({k:'pass',by:P.ref(passer),to:P.ref(runner),from:P.ball.slice(),at:[34+rng()*8,(rng()-.5)*20],style:'through',ok:true,offside:true});
 P.add({k:'offside',by:P.ref(runner),at:[34,0],flag:true});P.flags.offside=true;P.imp=.4;P.end('offside');return E.finish(m,P,true);};

/* Continua a jogada após vencer um duelo: finaliza ou cruza. */
E.continueFromBeat=function(P,p){if(P.ended)return;const rng=P.rng,pos=P.ball;
 if(pos[0]>R.PITCH.L-20&&Math.abs(pos[1])<R.PITCH.W*.53){E.decideShot(P,p,pos,rng()<.4?'placed':rng()<.5?'power':'low',{pressure:.3});}
 else if(Math.abs(pos[1])>14){const tgt=E.boxTarget(P,'cross');if(!tgt)return P.end('none');if(P.pass(p,tgt.p,rng()<.5?'lowcross':'cutback',tgt.pos))P.shoot(tgt.p,tgt.pos,'firstTime',{pressure:.45});}
 else{P.carry(p,[pos[0]+6,pos[1]*.7]);P.shoot(p,P.ball,'power',{pressure:.4});}};
/* IA de finalização: o portador decide entre chutar, tocar para um companheiro mais bem colocado ou tentar mais
   um drible — considerando distância, ângulo, pressão, visão, finalização, personalidade e o goleiro adversário. */
E.estXG=function(x,z,pressure){const PP=R.PITCH;const d=Math.hypot(PP.L-x,z);const ang=Math.abs(Math.atan2(PP.goalHalfW-z,PP.L-x)-Math.atan2(-PP.goalHalfW-z,PP.L-x));
 return 1.15*Math.exp(-d/(PP.small?4.6:7.2))*Math.pow(ang/(PP.small?.42:.75),.55)*(1-(pressure??.35)*.4);};
E.decideShot=function(P,p,pos,type,opt){opt=opt||{};if(P.ended)return;const rng=P.rng,e=E.eff,PP=R.PITCH,sm=PP.small;
 const here=E.estXG(pos[0],pos[1],opt.pressure);const vision=e(p,'vision'),fin=e(p,'finishing'),per=p.data.personality;
 const selfish=per==='showman'?.35:per==='humble'||per==='leader'?-.15:0;
 if(!P.decided){P.decided=true;
  const mates=outfield(P.A).filter(x=>x!==p&&['ST','W','AM','CM'].includes(x.group));
  if(mates.length&&rng()<.42){const q=pickBy(mates,x=>x.attrs.positioning*.6+x.attrs.finishing*.4,rng,8);
   const tp=[PP.L-(sm?4:10)-rng()*(sm?2.5:5),(rng()-.5)*(sm?3.5:10)];const okP=lg((e(p,'passing')*.6+vision*.4-68)/30+.6);const val=E.estXG(tp[0],tp[1],.55)*.85*okP;
   if(val>here*(1.45+selfish)&&rng()<clamp((vision-50)/45,.12,.75)){const st=Math.abs(pos[1])>(sm?4:12)||pos[0]>PP.L-(sm?4:7)?'cutback':'ground';
    if(!P.pass(p,q,st,tp,{noSafe:true}))return;P.assist=p;P.flags.unselfish=true;P.shoot(q,tp,'firstTime',{pressure:.6});return;}}
  if(here<.07&&e(p,'dribbling')>74&&rng()<.3){const d=nearestDef(P.D,pos[0]+3,pos[1],P.beaten);const r=P.duel(p,d,[pos[0]+1.5,pos[1]*.9]);if(r==='lost'||r==='foul'||P.ended)return;
   const s=spot(rng,sm?5:9,sm?8:14,sm?3:6,pos[1]*.4);P.carry(p,s);pos=s;}}
 let t=type;const d=Math.hypot(PP.L-pos[0],pos[1]);
 if(!['header','volley','bicycle','chip','firstTime','longshot'].includes(type)){
  if(d<(sm?5:11))t=rng()<.55?'low':'placed';else if(d>(sm?11:21))t=fin>78&&rng()<.5?'placed':'power';else if(Math.abs(pos[1])>(sm?4:10))t='placed';
  const gk=keeperOf(P.D);if(gk&&d>(sm?7:14)&&e(gk,'gkPositioning')<70&&fin>76&&rng()<.16)t='chip';}
 P.shoot(p,pos,t,opt);};
E.boxTarget=function(P,kind){const A=P.A,rng=P.rng;const cand=outfield(A).filter(p=>p!==P.holder&&['ST','W','AM','CM'].includes(p.group));if(!cand.length)return null;
 const p=pickBy(cand,c=>kind==='head'?c.attrs.heading*.6+c.attrs.jumping*.4:c.attrs.finishing*.6+c.attrs.positioning*.4,rng,6);
 const pos=kind==='head'?[46+rng()*4,(rng()-.5)*9]:kind==='cutback'?[40+rng()*4,(rng()-.5)*8]:[45+rng()*5,(rng()-.5)*10];return{p,pos};};

/* Ponto de finalização a d metros do gol, com desvio lateral z. */
function spot(rng,dmin,dmax,zr,zc){const d=dmin+rng()*(dmax-dmin);let z=(zc||0)+(rng()-.5)*2*zr;z=clamp(z,-d*.8,d*.8);return[R.PITCH.L-Math.sqrt(Math.max(1,d*d-z*z)),z];}
E.spot=spot;
E.BUILD={
 counter_fast(P,m,A,D){const rng=P.rng;const win=pickBy(outfield(A).filter(p=>['DM','CM','CB','FB'].includes(p.group)),p=>p.attrs.tackling,rng);const run=pickBy(outfield(A).filter(p=>['ST','W'].includes(p.group)),p=>p.attrs.pace*1.2,rng);if(!win||!run)return P.end('none');
  const st=[-12+rng()*12,(rng()-.5)*20];P.start(win,st,'counter');P.flags.counter=true;
  const lane=run.pos==='PD'||run.pos==='MD'?14:run.pos==='PE'||run.pos==='ME'?-14:(rng()-.5)*10;const dest=[18+rng()*8,lane];
  if(!P.pass(win,run,rng()<.5?'through':'long',dest))return;P.carry(run,[30+rng()*5,lane*.6]);
  const def=nearestDef(D,36,P.ball[1]);if(rng()<.6){const r=P.duel(run,def,[P.ball[0]+3,P.ball[1]],{bonus:.2});if(r==='lost'||r==='foul')return;}
  if(P.ended)return;const s=spot(rng,10,16,7,P.ball[1]*.5);P.carry(run,s);E.decideShot(P,run,s,rng()<.4?'placed':rng()<.5?'low':'chip',{pressure:.3});},
 counter_multi(P,m,A,D){const rng=P.rng;const on=outfield(A);const a=pickBy(on.filter(p=>['DM','CM'].includes(p.group)),p=>p.attrs.passing,rng)||on[0],b=pickBy(on.filter(p=>['W','AM'].includes(p.group)&&p!==a),p=>p.attrs.pace,rng)||on[1],c=pickBy(on.filter(p=>['ST'].includes(p.group)&&p!==b&&p!==a),p=>p.attrs.finishing,rng)||on.find(p=>p!==a&&p!==b);
  if(!a||!b||!c)return P.end('none');P.start(a,[-8+rng()*10,(rng()-.5)*14],'counter');P.flags.counter=true;const side=rng()<.5?1:-1;
  if(!P.pass(a,b,'ground',[10+rng()*6,side*(14+rng()*6)]))return;P.carry(b,[28+rng()*4,side*(15+rng()*5)]);
  const s=spot(rng,9,15,6);if(!P.pass(b,c,rng()<.5?'through':'lowcross',s))return;P.assist=b;P.shoot(c,s,rng()<.6?'firstTime':'placed',{pressure:.4});},
 one_two(P,m,A,D){const rng=P.rng,on=outfield(A);const a=pickBy(on.filter(p=>['AM','CM','W'].includes(p.group)),p=>p.attrs.passing+p.attrs.dribbling,rng),b=pickBy(on.filter(p=>['ST','AM','W'].includes(p.group)&&p!==a),p=>p.attrs.passing,rng);if(!a||!b)return P.end('none');
  const z=(rng()-.5)*16;P.start(a,[18+rng()*6,z]);if(!P.pass(a,b,'ground',[28+rng()*3,z+(rng()-.5)*6]))return;
  const s=spot(rng,12,18,8,z*.5);if(!P.pass(b,a,'oneTwo',s))return;P.assist=b;P.shoot(a,s,rng()<.5?'firstTime':'placed',{pressure:.4});},
 through(P,m,A,D){const rng=P.rng,on=outfield(A);const a=pickBy(on.filter(p=>['AM','CM','DM'].includes(p.group)),p=>p.attrs.vision,rng),b=pickBy(on.filter(p=>['ST','W'].includes(p.group)),p=>p.attrs.pace+p.attrs.positioning,rng);if(!a||!b)return P.end('none');
  P.start(a,[10+rng()*8,(rng()-.5)*16]);const dest=[32+rng()*5,(rng()-.5)*16];if(!P.pass(a,b,'through',dest))return;P.assist=a;
  if(rng()<.45){if(rng()<.3){const s=spot(rng,12,17,6,dest[1]*.5);P.carry(b,s);E.decideShot(P,b,s,'chip',{pressure:.25});return;}const def=nearestDef(D,dest[0]+4,dest[1]);const r=P.duel(b,def,[dest[0]+3,dest[1]],{bonus:.1});if(r==='lost'||r==='foul')return;}
  if(P.ended)return;const s=spot(rng,11,18,8,P.ball[1]*.5);P.carry(b,s);E.decideShot(P,b,s,rng()<.4?'placed':rng()<.5?'low':'power',{pressure:.4});},
 long_ball(P,m,A,D){const rng=P.rng,on=outfield(A);const a=pickBy(on.filter(p=>['CB','DM','FB'].includes(p.group)),p=>p.attrs.passing,rng),b=pickBy(on.filter(p=>['ST'].includes(p.group)),p=>p.attrs.heading+p.attrs.strength,rng)||pickBy(on.filter(p=>p!==a),p=>p.attrs.pace,rng);if(!a||!b)return P.end('none');
  P.start(a,[-24+rng()*10,(rng()-.5)*20]);const dest=[26+rng()*8,(rng()-.5)*14];if(!P.pass(a,b,'long',dest))return;P.assist=a;
  const def=nearestDef(D,dest[0],dest[1]);const won=rng()<lg((E.eff(b,'heading')+E.eff(b,'strength')-E.eff(def,'heading')-E.eff(def,'strength'))/34-.1);
  P.add({k:'duel_air',att:P.ref(b),def:def?P.ref(def):null,at:dest.slice(),won:won?'A':'D'});if(def)P.beaten.push(def);if(!won){P.last='D';return P.end('turnover');}
  const s=spot(rng,13,20,8,dest[1]*.5);P.carry(b,s);E.decideShot(P,b,s,rng()<.5?'power':'placed',{pressure:.5});},
 cross(P,m,A,D){const rng=P.rng,on=outfield(A);const side=rng()<.5?1:-1;const wide=pickBy(on.filter(p=>['W','FB'].includes(p.group)),p=>p.attrs.passing+p.attrs.pace,rng)||on[0];
  const mid=pickBy(on.filter(p=>['CM','DM','AM'].includes(p.group)&&p!==wide),p=>p.attrs.passing,rng)||on.find(p=>p!==wide);if(!wide||!mid)return P.end('none');
  P.start(mid,[14+rng()*8,side*(6+rng()*6)]);if(!P.pass(mid,wide,'ground',[28+rng()*6,side*(22+rng()*6)]))return;P.carry(wide,[38+rng()*6,side*(24+rng()*5)]);
  if(rng()<.35){const fb=nearestDef(D,42,side*26);const r=P.duel(wide,fb,[P.ball[0]+2,P.ball[1]]);if(r==='lost'||r==='foul')return;if(P.ended)return;}
  const tgt=E.boxTarget(P,'head');if(!tgt)return P.end('none');
  {const gk=keeperOf(D);if(gk&&rng()<.06+(E.eff(gk,'gkPositioning')-70)/260+(E.eff(gk,'jumping')-70)/500){P.add({k:'pass',by:P.ref(wide),to:P.ref(tgt.p),from:P.ball.slice(),at:[R.PITCH.L-5,side*2],style:'cross',ok:false,cut:{by:P.ref(gk),style:'keeper_claim'}});P.last='D';P.imp+=.2;return P.end('claimed');}}
  if(rng()<.02){const d=nearestDef(D,tgt.pos[0],tgt.pos[1]);if(d){P.add({k:'pass',by:P.ref(wide),to:P.ref(tgt.p),from:P.ball.slice(),at:tgt.pos.slice(),style:'cross',ok:true});P.ownGoal(d,tgt.pos);return;}}
  if(!P.pass(wide,tgt.p,'cross',tgt.pos))return;P.assist=wide;
  const def=nearestDef(D,tgt.pos[0],tgt.pos[1]);const won=rng()<lg((E.eff(tgt.p,'heading')*.5+E.eff(tgt.p,'jumping')*.3+E.eff(tgt.p,'strength')*.2-(E.eff(def,'heading')*.5+E.eff(def,'jumping')*.3+E.eff(def,'strength')*.2))/22-.1);
  P.add({k:'duel_air',att:P.ref(tgt.p),def:def?P.ref(def):null,at:tgt.pos.slice(),won:won?'A':'D'});if(def)P.beaten.push(def);
  if(!won){P.last='D';if(rng()<.4){P.add({k:'out',type:'corner',at:[54,side*34],by:def?P.ref(def):null});m.stats[A.side].corners++;}return P.end('cleared');}
  const agile=E.eff(tgt.p,'agility');const t=agile>78&&rng()<.07?'bicycle':rng()<.24?'volley':'header';P.shoot(tgt.p,tgt.pos,t,{pressure:.55,noBlock:t!=='volley'});},
 low_cross(P,m,A,D){const rng=P.rng,on=outfield(A);const side=rng()<.5?1:-1;const wide=pickBy(on.filter(p=>['W','FB'].includes(p.group)),p=>p.attrs.pace,rng)||on[0];
  P.start(wide,[26+rng()*6,side*(20+rng()*6)]);P.carry(wide,[43+rng()*4,side*(17+rng()*6)]);const tgt=E.boxTarget(P,'cross');if(!tgt)return P.end('none');
  if(!P.pass(wide,tgt.p,'lowcross',tgt.pos))return;P.assist=wide;P.shoot(tgt.p,tgt.pos,'firstTime',{pressure:.55});},
 byline(P,m,A,D){const rng=P.rng,on=outfield(A);const side=rng()<.5?1:-1;const wide=pickBy(on.filter(p=>['W','FB'].includes(p.group)),p=>p.attrs.pace+p.attrs.dribbling,rng)||on[0];
  P.start(wide,[28+rng()*6,side*(24+rng()*5)]);const fb=nearestDef(D,44,side*24);const r=P.duel(wide,fb,[40,side*24],{bonus:.1});if(r==='lost'||r==='foul')return;if(P.ended)return;
  P.carry(wide,[51+rng()*1.5,side*(10+rng()*6)]);const tgt=E.boxTarget(P,'cutback');if(!tgt)return P.end('none');if(!P.pass(wide,tgt.p,'cutback',tgt.pos))return;P.assist=wide;P.shoot(tgt.p,tgt.pos,rng()<.6?'firstTime':'placed',{pressure:.45});},
 central(P,m,A,D){const rng=P.rng,on=outfield(A);const p=pickBy(on.filter(x=>['AM','ST','CM'].includes(x.group)),x=>x.attrs.dribbling+x.attrs.ballControl,rng)||on[0];const feeder=pickBy(on.filter(x=>x!==p&&['DM','CM'].includes(x.group)),x=>x.attrs.passing,rng);
  const z=(rng()-.5)*10;if(feeder){P.start(feeder,[12+rng()*6,z+(rng()-.5)*10]);if(!P.pass(feeder,p,'ground',[24+rng()*4,z]))return;}else P.start(p,[24,z]);
  const d1=nearestDef(D,31,z);let r=P.duel(p,d1,[30,z]);if(r==='lost'||r==='foul')return;if(r==='advantage'){E.continueFromBeat(P,p);return;}
  if(rng()<.4){const d2=nearestDef(D,38,z,[d1]);r=P.duel(p,d2,[P.ball[0]+2,P.ball[1]]);if(r==='lost'||r==='foul')return;}
  if(P.ended)return;const s=spot(rng,14,21,7,P.ball[1]*.6);P.carry(p,s);E.decideShot(P,p,s,rng()<.4?'placed':rng()<.5?'low':'power',{pressure:.5});},
 solo(P,m,A,D){const rng=P.rng,on=outfield(A);const p=pickBy(on,x=>x.attrs.dribbling*1.5,rng,5);if(!p)return P.end('none');const side=rng()<.5?1:-1;
  P.start(p,[10+rng()*6,side*(8+rng()*12)]);P.carry(p,[20,P.ball[1]*.8]);let used=[];
  for(let k=0;k<2+(rng()<.4?1:0);k++){const d=nearestDef(D,P.ball[0]+6,P.ball[1],used);used.push(d);const r=P.duel(p,d,[P.ball[0]+5,P.ball[1]*.8]);if(r==='lost'||r==='foul')return;if(P.ended)return;}
  const s=spot(rng,12,19,7,P.ball[1]*.5);P.carry(p,s);E.decideShot(P,p,s,rng()<.5?'placed':'power',{pressure:.35});},
 switch(P,m,A,D){const rng=P.rng,on=outfield(A);const side=rng()<.5?1:-1;const a=pickBy(on.filter(x=>['CM','DM','CB'].includes(x.group)),x=>x.attrs.passing+x.attrs.vision,rng),w=pickBy(on.filter(x=>['W','FB'].includes(x.group)&&x!==a),x=>x.attrs.pace,rng);if(!a||!w)return P.end('none');
  P.start(a,[4+rng()*8,-side*(12+rng()*8)]);if(!P.pass(a,w,'switch',[24+rng()*6,side*(26+rng()*4)]))return;P.carry(w,[32,side*24]);
  const fb=nearestDef(D,38,side*24);const r=P.duel(w,fb,[36,side*22]);if(r==='lost'||r==='foul')return;if(P.ended)return;
  if(rng()<.45){const s=spot(rng,15,21,6,side*10);P.carry(w,s);E.decideShot(P,w,s,'placed',{pressure:.45});}else{const tgt=E.boxTarget(P,'head');if(!tgt)return P.end('none');if(!P.pass(w,tgt.p,'cross',tgt.pos))return;P.assist=w;P.shoot(tgt.p,tgt.pos,rng()<.65?'header':'volley',{pressure:.55,noBlock:true});}},
 long_shot(P,m,A,D){const rng=P.rng,on=outfield(A);const p=pickBy(on.filter(x=>['CM','AM','DM','W','ST'].includes(x.group)),x=>x.attrs.finishing*.6+x.attrs.composure*.4,rng);if(!p)return P.end('none');const f=pickBy(on.filter(x=>x!==p),x=>x.attrs.passing,rng);
  const s=spot(rng,21,30,10);if(f){P.start(f,[s[0]-10,s[1]+(rng()-.5)*12]);if(!P.pass(f,p,'ground',[s[0]-2,s[1]]))return;P.assist=f;}else P.start(p,[s[0]-3,s[1]]);
  P.carry(p,s);E.decideShot(P,p,s,'longshot',{pressure:.4});},
 corner(P,m,A,D){const rng=P.rng,on=outfield(A);const side=rng()<.5?1:-1;const taker=pickBy(on,x=>x.attrs.passing+x.attrs.vision,rng,5);if(!taker)return P.end('none');
  P.start(taker,[54,side*34],'corner');P.add({k:'setpiece',type:'corner',by:P.ref(taker),at:[54,side*34]});
  const tgt=E.boxTarget(P,'head');if(!tgt)return P.end('none');const big=pickBy(on.filter(x=>x!==taker),x=>x.attrs.heading+x.attrs.jumping+x.attrs.strength,rng,6);if(big&&rng()<.6)tgt.p=big;
  const gk=keeperOf(D);if(gk&&rng()<.2+(E.eff(gk,'gkPositioning')-70)/200){P.add({k:'pass',by:P.ref(taker),to:P.ref(tgt.p),from:P.ball.slice(),at:[49,side*2],style:'cross',ok:false,cut:{by:P.ref(gk),style:'keeper_claim'}});P.last='D';return P.end('claimed');}
  if(!P.pass(taker,tgt.p,'cross',tgt.pos))return;
  const def=nearestDef(D,tgt.pos[0],tgt.pos[1]);const won=rng()<lg((E.eff(tgt.p,'heading')*.5+E.eff(tgt.p,'jumping')*.3+E.eff(tgt.p,'strength')*.2-(E.eff(def,'heading')*.5+E.eff(def,'jumping')*.3+E.eff(def,'strength')*.2))/22-.45);
  P.add({k:'duel_air',att:P.ref(tgt.p),def:def?P.ref(def):null,at:tgt.pos.slice(),won:won?'A':'D'});if(def)P.beaten.push(def);
  if(!won){P.last='D';if(rng()<.16){const edge=pickBy(on.filter(x=>['CM','AM','DM'].includes(x.group)),x=>x.attrs.finishing,rng);if(edge){const e2=spot(rng,18,24,6);P.add({k:'clear',by:def?P.ref(def):null,at:tgt.pos.slice(),to:e2.slice(),header:true});P.ball=e2;P.shoot(edge,e2,'volley',{pressure:.45});return;}}return P.end('cleared');}
  if(rng()<.06){P.attackFoul=true;}P.assist=taker;P.shoot(tgt.p,tgt.pos,rng()<.8?'header':'volley',{pressure:.6,noBlock:true});},
 set_corner(P,m,A,D){const rng=P.rng,on=outfield(A);const side=rng()<.5?1:-1;const taker=pickBy(on,x=>x.attrs.passing,rng,5),short=pickBy(on.filter(x=>x!==taker),x=>x.attrs.passing,rng),shooter=pickBy(on.filter(x=>x!==taker&&x!==short),x=>x.attrs.finishing,rng);if(!taker||!short||!shooter)return P.end('none');
  P.start(taker,[54,side*34],'corner');P.add({k:'setpiece',type:'corner',by:P.ref(taker),at:[54,side*34],short:true});
  if(!P.pass(taker,short,'ground',[48,side*27]))return;const s=spot(rng,14,19,5,side*4);if(!P.pass(short,shooter,'cutback',s))return;P.assist=short;P.shoot(shooter,s,rng()<.5?'firstTime':'volley',{pressure:.5});},
 free_kick(P,m,A,D){},penalty(P){},card(P){},offside(P){}};

/* gol contra */
Play.prototype.ownGoal=function(d,pos){const m=this.m;this.add({k:'shot',by:this.ref(d),from:pos.slice(),type:'owngoal',outcome:'goal',ownGoal:true,target:[(this.rng()-.5)*4,.4+this.rng()*1.4],power:16,keeper:this.ref(keeperOf(this.D)),keeperDive:this.rng()<.5?-1:1,keeperReach:.4,xg:0});
 this.people.shooter=d.id;this.flags.ownGoal=true;this.imp+=2;this.end('goal');m.stats[this.A.side].shots++;m.stats[this.A.side].onTarget++;};

/* Cobranças após falta: pênalti ou falta perigosa. */
E.penaltyKick=function(P){const m=P.m,rng=P.rng,A=P.A,Dt=P.D;const on=outfield(A);
 const taker=on.slice().sort((a,b)=>(b.attrs.finishing*.6+b.attrs.composure*.4)-(a.attrs.finishing*.6+a.attrs.composure*.4))[0];const gk=keeperOf(Dt);
 const tq=E.eff(taker,'finishing')*.55+E.eff(taker,'composure')*.45,kq=gk?E.eff(gk,'gkPenalties')*.65+E.eff(gk,'gkReflexes')*.35:20;
 let pg=clamp(.77+(tq-75)/260-(kq-70)/230,.55,.92);const r=rng();const pMiss=clamp(.085-(tq-75)/600,.03,.14);
 const side=rng()<.45?-1:rng()<.85?1:0;const dive=rng()<.42?side:rng()<.85?-side||(rng()<.5?-1:1):0;
 let outcome=r<pg?'goal':r<pg+pMiss?(rng()<.4?'over':rng()<.6?'wide':'post'):'save';
 if(outcome==='save'&&dive!==side)outcome='goal';if(outcome==='goal'&&dive===side&&side!==0&&rng()<.25&&kq>72)outcome='save';
 const st=m.stats[A.side];st.shots++;st.xg+=.76;taker.st.shots++;
 const g=R.PITCH.goalHalfW/3.66,h=R.PITCH.goalH/2.44;const target=outcome==='goal'?[side*(1.8+rng()*1.6)*g,(side===0?1+rng():.2+rng()*1.8)*h]:outcome==='save'?[side*(1.4+rng()*1.5)*g,(.3+rng()*1.2)*h]:outcome==='post'?[(rng()<.5?-1:1)*R.PITCH.goalHalfW,(.5+rng())*h]:outcome==='over'?[side*rng()*3*g,R.PITCH.goalH+.36+rng()]:[(side||1)*(R.PITCH.goalHalfW+.34+rng()),.3+rng()];
 if(outcome==='goal'||outcome==='save'){st.onTarget++;taker.st.onT++;}if(outcome==='save'&&gk){gk.st.saves++;gk.st.rating+=.8;m.stats[Dt.side].saves++;}
 const b={k:'penalty',by:P.ref(taker),keeper:P.ref(gk),target,keeperDive:dive,outcome,power:26};P.people.shooter=taker.id;if(gk)P.people.keeper=gk.id;
 /* rebote após defesa */
 if(outcome==='save'&&rng()<.22){const f=pickBy(on.filter(x=>x!==taker),x=>x.attrs.positioning,rng);if(f){b.rebound={by:P.ref(f),outcome:rng()<.4?'goal':'save'};if(b.rebound.outcome==='goal'){P.add(b);P.end('goal');P.scorerOverride=f;P.assist=null;return'goal';}}}
 P.add(b);P.imp+=2;E.count(m,'penalty');P.ended=true;P.outcome=outcome==='goal'?'goal':'penalty_'+outcome;return outcome;};
E.freeKickShot=function(P,spot){const m=P.m,rng=P.rng,A=P.A,Dt=P.D,on=outfield(A);
 const taker=on.slice().sort((a,b)=>(b.attrs.finishing*.5+b.attrs.passing*.3+b.attrs.composure*.2)-(a.attrs.finishing*.5+a.attrs.passing*.3+a.attrs.composure*.2))[0];
 const wall=outfield(Dt).slice(0,Math.min(4,outfield(Dt).length)).map(p=>P.ref(p));
 P.add({k:'setpiece',type:'freekick',by:P.ref(taker),at:spot.slice(),wall});P.ball=spot.slice();P.ended=false;P.outcome=null;
 const dist=R.distToGoal(spot[0],spot[1]);
 if(dist<31&&Math.abs(spot[1])<20){if(rng()<.22){P.add({k:'shot',by:P.ref(taker),from:spot.slice(),type:'freekick',outcome:'blocked',deflect:rng()<.4?'corner':'loose',blocker:wall[0],power:24,keeper:P.ref(keeperOf(Dt)),xg:.03});m.stats[A.side].shots++;P.end('blocked');return;}
  P.shoot(taker,spot,'freekick',{pressure:0,noBlock:true,xgMul:.55});}
 else{P.holder=taker;const tgt=E.boxTarget(P,'head');if(!tgt)return P.end('none');if(!P.pass(taker,tgt.p,'cross',tgt.pos))return;P.assist=taker;P.shoot(tgt.p,tgt.pos,'header',{pressure:.5,noBlock:true});}};

/* ---------- Fechamento do lance: regras de reinício, cartões, gols válidos, destaque ---------- */
E.finish=function(m,P,forceShow){
 /* vantagem: se a jogada terminou sem gol após vantagem, o cartão é aplicado na próxima interrupção */
 if(P.ended&&P.outcome==='penalty'&&!R.PROFILE.penalties){P.outcome='freekick';P.restart={restart:'direct_free_kick',spot:[R.PITCH.L-R.PITCH.boxDepth-.5,P.ball[1]*.5],shootable:true};}
 if(P.ended&&P.outcome==='penalty'){E.cardFromPlay(m,P);P.add({k:'whistle',reason:'penalty'});P.add({k:'point_spot'});E.penaltyKick(P);}
 else if(P.ended&&P.outcome==='freekick'){E.cardFromPlay(m,P);P.add({k:'whistle',reason:'foul'});if(P.restart&&P.restart.shootable)E.freeKickShot(P,P.restart.spot);}
 else if(P.pendingCard){P.add({k:'whistle',reason:'card'});E.cardFromPlay(m,P);}
 /* rebote após defesa / trave */
 let last=P.beats[P.beats.length-1];
 if(last&&last.k==='shot'&&last.rebound&&last.outcome!=='goal'&&m.rng()<.5){const f=pickBy(outfield(P.A).filter(x=>x.id!==last.by.id&&['ST','W','AM'].includes(x.group)),x=>x.attrs.positioning,m.rng);
  if(f){P.ended=false;P.outcome=null;const PP=R.PITCH,sc=PP.small?.45:1;const pos=[PP.L-7*sc+m.rng()*3*sc,(m.rng()-.5)*8*sc];P.add({k:'rebound_run',by:P.ref(f),at:pos});P.ball=pos;P.assist=null;P.shoot(f,pos,'firstTime',{pressure:.55});}}
 last=P.beats[P.beats.length-1];
 if(last&&last.k==='shot'&&last.toCorner)P.add({k:'out',type:'corner',at:[R.PITCH.L,Math.sign(last.target?.[0]||1)*R.PITCH.W]});
 if(last&&last.k==='shot'&&(last.outcome==='wide'||last.outcome==='over'))P.add({k:'out',type:'goal_kick',at:[R.PITCH.L-R.PITCH.sixDepth,0]});
 const goalBeat=P.beats.find(b=>(b.k==='shot'&&b.outcome==='goal')||(b.k==='penalty'&&(b.outcome==='goal'||b.rebound?.outcome==='goal')));
 let goal=null;
 if(goalBeat){const v=R.goalValid({offside:!!P.offsideLate,attackerFoul:!!P.attackFoul});
  if(!v.valid){if(P.offsideLate)P.add({k:'offside',by:P.ref(P.offsideLate),at:P.ball.slice(),flag:true,late:true});P.add({k:'disallow',reason:v.reason});P.flags.disallowed=v.reason;P.imp+=1.2;if(v.reason==='Impedimento'){m.stats[P.A.side].offsides++;}}
  else{const scorerRef=P.flags.ownGoal?goalBeat.by:(P.scorerOverride?P.ref(P.scorerOverride):(goalBeat.rebound?.outcome==='goal'?goalBeat.rebound.by:goalBeat.by));
   const scorer=E.find(m,scorerRef.id);const side=P.A.side;m.score[side]++;m.stats[side].goals++;E.count(m,'goal');m.momentum+=side==='home'?-.35:.35;
   if(scorer&&!P.flags.ownGoal){scorer.st.goals++;scorer.st.rating+=1.1;}
   const assist=P.flags.ownGoal?null:(P.assist&&P.assist.id!==scorerRef.id?P.assist:null);if(assist){assist.st.assists++;assist.st.rating+=.6;}
   const diff=m.score[side]-m.score[SIDE_OTHER[side]],min=m.clock/60;
   const intensity=clamp(.45+(min>80?.3:0)+(diff===0||diff===1?.25:0)-(diff>=3?.35:0)+(P.flags.ownGoal?-.2:0),.15,1);
   const style=E.celebration(m,scorer,intensity);goal={side,scorerId:scorerRef.id,assistId:assist?.id||null,ownGoal:!!P.flags.ownGoal,intensity,style};
   const gk=keeperOf(P.D);if(gk)gk.st.rating-=.35;
   P.add({k:'celebrate',by:scorerRef,style,intensity,ownGoal:!!P.flags.ownGoal});}}
 if(!goal&&!P.flags.disallowed&&P.offsideLate){P.add({k:'offside',by:P.ref(P.offsideLate),at:P.ball.slice(),flag:true,late:true});m.stats[P.A.side].offsides++;P.flags.offside=true;}
 if(P.outcome==='turnover'&&!P.beats.some(b=>b.k==='foul'))P.imp*=.4;
 /* acréscimos e notas */
 const shooter=P.people.shooter?E.find(m,P.people.shooter):null;if(shooter&&!goal&&P.xg>.3)shooter.st.rating-=.25;
 const imp=P.imp+(goal?5:0);const thr=({few:.95,normal:.45,many:.22}[m.settings.highlightRate]||.55)*(m.mode.id==='germinare'?.55:1);
 const show=goal||forceShow&&imp>thr*.6||imp>thr||P.beats.some(b=>b.k==='penalty'||b.k==='disallow'||(b.k==='foul'&&b.card?.color==='red'));
 const kind=E.kindOf(P,goal);
 if(!show||m.clock-m.lastHighlight<(m.mode.id==='germinare'?7:40)&&!goal&&imp<1.4){E.tickFromPlay(m,P,goal,kind);return null;}
 m.lastHighlight=m.clock;return E.makeEvent(m,P,goal,kind);};
E.cardFromPlay=function(m,P){if(!P.pendingCard)return;const {p,decision,victim}=P.pendingCard;P.add({k:'card',on:P.ref(p),color:decision.card,reason:decision.reason,second:decision.secondYellow});E.applyCard(m,p,decision,victim,true);P.cardInfo={playerId:p.id,color:decision.card,reason:decision.reason,second:decision.secondYellow,side:p.team.side};P.pendingCard=null;};
E.find=(m,id)=>{for(const t of Object.values(m.teams))for(const p of [...t.players.filter(Boolean),...t.bench,...t.sentOff])if(p.id===id)return p;return null;};
E.kindOf=function(P,goal){if(goal)return goal.ownGoal?'owngoal':'goal';if(P.flags.disallowed)return'disallowed';const b=P.beats;
 if(b.some(x=>x.k==='penalty'))return'penalty_miss';if(P.cardInfo?.color==='red')return'red';if(b.some(x=>x.k==='offside'))return'offside';
 const s=[...b].reverse().find(x=>x.k==='shot');if(s){if(s.outcome==='save')return'save';if(s.outcome==='post'||s.outcome==='bar')return'post';if(s.outcome==='blocked')return'blocked';return'miss';}
 if(P.cardInfo)return'card';if(b.some(x=>x.k==='foul'))return'foul';return'chance';};
E.TITLES={shootout:'PÊNALTI · DISPUTA',goal:'GOL!',owngoal:'GOL CONTRA!',disallowed:'GOL ANULADO',penalty_miss:'PÊNALTI DESPERDIÇADO',red:'EXPULSÃO',offside:'IMPEDIMENTO',save:'GRANDE DEFESA',post:'NA TRAVE!',blocked:'BLOQUEADO',miss:'PASSOU PERTO',card:'CARTÃO',foul:'FALTA',chance:'CHANCE'};
E.describe=function(m,P,goal,kind){const n=id=>{const p=E.find(m,id);return p?p.data.name:'';};const team=P.A.club.name;
 const shot=[...P.beats].reverse().find(b=>b.k==='shot'||b.k==='penalty');const by=shot?.by?n(shot.by.id):'';const kp=P.people.keeper?n(P.people.keeper):'';
 if(goal){if(goal.ownGoal)return`${n(goal.scorerId)} desvia contra o próprio gol`;const a=goal.assistId?`, assistência de ${n(goal.assistId)}`:'';return`${n(goal.scorerId)} marca para o ${team}${a}`;}
 switch(kind){case'disallowed':return`Gol de ${by} anulado: ${P.flags.disallowed}`;case'penalty_miss':return shot.outcome==='save'?`${kp} defende o pênalti de ${by}!`:`${by} desperdiça o pênalti`;
  case'red':return`${n(P.cardInfo.playerId)} é expulso: ${P.cardInfo.reason}`;case'offside':return`Impedimento de ${n(P.beats.find(b=>b.k==='offside').by.id)}`;
  case'save':return`${kp} defende a finalização de ${by}`;case'post':return`${by} acerta ${shot.outcome==='bar'?'o travessão':'a trave'}!`;case'blocked':return`Chute de ${by} bloqueado pela defesa`;case'miss':return`${by} finaliza ${shot.outcome==='over'?'por cima':'para fora'}`;
  case'card':return`Amarelo para ${n(P.cardInfo.playerId)}: ${P.cardInfo.reason}`;case'foul':return`Falta em ${n(P.people.victim)}`;default:return`Ataque do ${team}`;}};
E.tickFromPlay=function(m,P,goal,kind){const desc=E.describe(m,P,goal,kind);const map={save:'save',post:'post',miss:'miss',blocked:'miss',offside:'offside',card:'yellow',foul:'foul',chance:'chance'};
 if(P.cardInfo)E.tick(m,P.cardInfo.color,P.cardInfo.side,`Cartão ${P.cardInfo.color==='red'?'vermelho':'amarelo'} para ${E.find(m,P.cardInfo.playerId).data.name}`,{playerId:P.cardInfo.playerId,reason:P.cardInfo.reason});
 else if(kind!=='chance'||m.rng()<.3)E.tick(m,map[kind]||'chance',P.A.side,desc);};
E.makeEvent=function(m,P,goal,kind){const ev={id:'ev'+(++m.eid),clock:m.clock,half:m.half,period:m.period,mode:m.mode.id,minute:m.phase==='shootout'?'PÊN':E.minute(m),attack:P.A.side,playType:P.type,playLabel:E.PLAY_TYPES[P.type]||'ATAQUE',kind,title:E.TITLES[kind]||'LANCE',
  desc:E.describe(m,P,goal,kind),beats:P.beats,goal,card:P.cardInfo||null,people:P.people,xg:+P.xg.toFixed(2),importance:+P.imp.toFixed(2),seed:(m.rng()*1e9)>>>0,
  scoreBefore:{...(m._scoreBefore||m.score)},scoreAfter:{...m.score},statsBefore:m._snap?JSON.parse(m._snap):E.blankStats(),statsAfter:JSON.parse(JSON.stringify(m.stats)),
  lineup:m._lineup||{home:m.teams.home.players.map(p=>p?.id||null),away:m.teams.away.players.map(p=>p?.id||null)},flags:P.flags,applied:false};
 m.events.push(ev);return ev;};
E.celebration=function(m,p,intensity){const rng=m.rng,per=p?.data.personality||'humble';
 const pools={showman:['dance','pose','knee_slide','corner_flag','arms_crossed'],passionate:['scream','badge','knee_slide','crowd','punch_air'],humble:['point_sky','hug_team','arms_wide','heart'],cool:['arms_crossed','pose','point_sky','arms_wide'],funny:['funny','dance','jump','corner_flag'],leader:['badge','punch_air','scream','group']};
 const pool=pools[per]||pools.humble;let s=rng.pick(pool);if(intensity>.8&&rng()<.5)s=rng.pick(['knee_slide','corner_flag','scream','crowd']);if(intensity<.3&&rng()<.6)s=rng.pick(['arms_wide','hug_team','point_sky']);return s;};
E.CELEBRATIONS={corner_flag:'Corrida para a bandeirinha',knee_slide:'Deslizada de joelhos',arms_wide:'Braços abertos',punch_air:'Soco no ar',jump:'Pulo de alegria',hug_team:'Abraço nos companheiros',group:'Comemoração coletiva',dance:'Dancinha',crowd:'Festa com a torcida',point_sky:'Aponta para o céu',heart:'Coração com as mãos',badge:'Bate no escudo',arms_crossed:'Braços cruzados',scream:'Grito de alegria',pose:'Pose para a câmera',funny:'Aviãozinho exagerado'};

/* Cartão como lance 3D a partir de falta no meio-campo. */
E.cardHighlight=function(m,Dt,A,fouler,victim,sev,decision,x){const P=new Play(m,A,Dt,'card');const rng=m.rng;const pos=[x,(rng()-.5)*2*(R.PITCH.W-(R.PITCH.small?2:14))];
 P.start(victim,[pos[0]-7,pos[1]+(rng()-.5)*4]);P.carry(victim,[pos[0]-1,pos[1]]);
 const kind=rng()<.4?'slide':'late';const offence=kind==='slide'?'tackle':'trip';const cls=R.classifyFoul({x:pos[0],z:pos[1],offence});
 P.add({k:'skill',by:P.ref(victim),vs:P.ref(fouler),move:'short',ok:true,at:pos.slice(),to:[pos[0]+3,pos[1]]});
 P.add({k:'foul',by:P.ref(fouler),on:P.ref(victim),at:[pos[0]+2,pos[1]],offence,severity:sev,restart:cls.restart,advantage:false,card:{color:decision.card,reason:decision.reason,second:decision.secondYellow},fall:kind==='slide'?'slide':'trip'});
 m.stats[Dt.side].fouls++;fouler.st.fouls++;E.count(m,'freeKick');P.people.fouler=fouler.id;P.people.victim=victim.id;
 P.pendingCard={p:fouler,decision,victim};P.add({k:'whistle',reason:'card'});E.cardFromPlay(m,P);P.imp=decision.card==='red'?2:.8;P.end('freekick');
 m.lastHighlight=m.clock;return E.makeEvent(m,P,null,decision.card==='red'?'red':'card');};

/* ---------- Pós-jogo ---------- */
E.playerRatings=function(m){const out=[];for(const t of Object.values(m.teams)){const res=m.score[t.side]-m.score[SIDE_OTHER[t.side]];
 for(const p of [...t.players.filter(Boolean),...t.sentOff,...t.bench.filter(b=>b.used),...t.players.filter(Boolean)].filter((v,i,a)=>a.indexOf(v)===i)){
  let r=p.st.rating+res*.18+(p.st.tackles*.08)+(p.st.dribbles*.07)+(p.group==='GK'&&m.score[SIDE_OTHER[t.side]]===0?.6:0)+((p.data.rating-70)/40);
  out.push({id:p.id,name:p.data.name,side:t.side,pos:p.pos,rating:+clamp(r,3,10).toFixed(1),goals:p.st.goals,assists:p.st.assists,saves:p.st.saves,energy:p.energy,yellow:p.yellow,red:p.red});}}
 return out.sort((a,b)=>b.rating-a.rating);};

/* Resolve id -> dados de exibição/movimento para a coreografia. */
E.resolver=function(m){const cache=new Map();return function(id){if(cache.has(id))return cache.get(id);const p=E.find(m,id);if(!p)return null;const s=p.team.slots[p.slot]||{x:0,z:0};
 const o={id,name:p.data.name,data:p.data,number:p.data.number,group:p.group,pos:p.pos,attrs:p.attrs,energy:p.energy,foot:p.data.foot,base:[s.x,s.z],side:p.side,rating:p.data.rating};cache.set(id,o);return o;};};
/* Simulação completa sem interface (testes e calibração). */
E.simulateFull=function(home,away,settings){const m=E.createMatch(home,away,settings);let guard=0;const events=[];
 while(m.phase!=='fulltime'&&guard++<20000){if(m.phase==='halftime'){E.startNextPeriod(m);continue;}const ev=E.advance(m,99999);if(ev)events.push(ev);}
 return{m,events};};
MD.Engine=E;
})(typeof window!=='undefined'?(window.MD=window.MD||{}):(globalThis.MD=globalThis.MD||{}));
