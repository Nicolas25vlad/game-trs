'use strict';
/* MATCHDAY 0.5 — ritmo da transmissão (relógio contextual + agendador de lances), sem navegador.
   Simula a tela a 30 quadros/s com o motor e a coreografia reais. */
const assert=require('node:assert/strict');
const MD=require('./load.cjs')(['js/util.js','js/modes.js','js/data.js','js/rules.js','js/engine.js','js/choreo.js','js/pacing.js']);
const D=MD.Data,E=MD.Engine,C=MD.Choreo,PG=MD.Pacing;
let checks=0;const ok=(c,msg)=>{assert.ok(c,msg);checks++;};
const clubs=D.PRESETS.map(D.freshClub);
function run(home,away,settings,opts){opts=opts||{};const m=E.createMatch(home,away,settings);const res=E.resolver(m);
 const lineupNow=L=>{const s=L.shown();const on=new Set(s.lines.filter(x=>x[1]).map(x=>x[0]));const lu={};for(const side of ['home','away'])lu[side]=m.teams[side].players.map((p,i)=>{const cand=[...m.teams[side].players.filter(Boolean),...m.teams[side].bench,...m.teams[side].sentOff].find(q=>on.has(q.id)&&q.slot===i);return cand?cand.id:null;});return lu;};
 const L=new PG.Live(m,{pace:opts.pace||'normal',build:ev=>C.build(ev,{resolve:res}),kickoff:(k,LL)=>C.kickoff(lineupNow(LL),k.side,E.periodOf(m,k.period).half,res,k.t|0,{mode:m.mode.id}),replays:true,slowmo:true});
 const out={m,L,trace:[],starts:[],presentRates:[],maxIdleJump:0,neg:0,shownBeforeApply:0,breaks:0,ends:[]};
 L.o.onStart=it=>out.starts.push({kind:it.kind,critical:it.critical,real:L.real,clock:L.clock,id:it.ev?it.ev.id:'ko',start:it.start,key:it.key,shoot:it.shoot});
 L.o.onEnd=it=>out.ends.push({real:L.real,kind:it.kind,critical:it.critical});
 L.begin();const dt=1/30;let guard=0,prevClock=0,prevPI=0,prevState=L.state;
 while(L.state!=='done'&&guard++<30*60*60){L.update(dt);
  if(L.state==='break'){out.breaks++;L.resume();prevClock=L.clock;prevPI=E.pIndex(m);continue;}
  const pi=E.pIndex(m);const dc=L.clock-prevClock;
  if(pi===prevPI&&dc<-1e-6)out.neg++;
  if(L.state==='present'&&prevState==='present'&&!L.cur.shoot)out.presentRates.push(dc/dt);
  if(L.state==='idle')out.maxIdleJump=Math.max(out.maxIdleJump,dc);
  /* nenhum resultado aparece antes de o lance acontecer na tela */
  const s=L.shown();const shownGoals=s.score.home+s.score.away;const appliedGoals=m.events.filter(e=>e.goal&&L.applied.has(e.id)).length;if(shownGoals!==appliedGoals&&m.phase!=='shootout')out.shownBeforeApply++;
  prevClock=L.clock;prevPI=pi;prevState=L.state;}
 out.realTime=L.real;return out;}

/* 1) partida profissional completa */
const r=run(clubs[0],clubs[4],{seed:20260515});
ok(r.L.state==='done','partida chega ao fim');
ok(r.starts[0].kind==='kickoff'&&r.starts[0].clock===0,'primeira cena é o toque inicial, com o relógio em 0:00');
ok(r.neg===0,'o relógio nunca volta dentro do mesmo período');
ok(r.presentRates.every(v=>v<=1.0001),'durante o lance o relógio corre no máximo em velocidade natural (1x): máx '+Math.max(...r.presentRates).toFixed(3));
ok(r.maxIdleJump<=r.L.P.accel/30+1e-6,'sem saltos no relógio entre os lances (maior avanço por quadro '+r.maxIdleJump.toFixed(2)+'s)');
ok(r.shownBeforeApply===0,'placar mostrado nunca adianta um gol que ainda não aconteceu na tela');
const s=r.L.shown();ok(s.score.home===r.m.score.home&&s.score.away===r.m.score.away,'placar final mostrado = gols válidos do motor');
ok(r.breaks===1,'intervalo acontece uma vez');
const kos=r.starts.filter(x=>x.kind==='kickoff');const goals=r.m.events.filter(e=>e.goal).length;
ok(kos.length>=2,'toque inicial no 1º e no 2º tempo');
const afterGoal=r.m.kickoffs.filter(k=>k.afterGoal).length;ok(kos.length===2+afterGoal&&afterGoal>=Math.max(0,goals-2),'toque inicial depois de cada gol (exceto gol no fim do período): '+afterGoal+' de '+goals);
const ev3=r.starts.filter(x=>x.kind==='event');
let tooClose=0;for(let i=1;i<ev3.length;i++){const prevEnd=r.ends.filter(e=>e.real<=ev3[i].real).pop();if(!ev3[i].critical&&prevEnd&&ev3[i].real-prevEnd.real<r.L.P.gap-0.2)tooClose++;}
ok(tooClose===0,'lances comuns respeitam o intervalo mínimo após o anterior');
let dup=0;for(let i=1;i<ev3.length;i++){const a=r.m.events.find(e=>e.id===ev3[i-1].id),b=r.m.events.find(e=>e.id===ev3[i].id);if(a&&b&&!ev3[i].critical&&!ev3[i-1].critical&&a.kind===b.kind&&a.attack===b.attack&&a.playType===b.playType&&b.clock-a.clock<480)dup++;}
ok(dup===0,'sem dois ataques praticamente idênticos em sequência');
ok(r.m.events.every(e=>e.applied),'todos os lances (exibidos ou não) foram aplicados até o fim');
ok(r.m.events.filter(e=>e.goal).every(e=>r.starts.some(x=>x.id===e.id)),'todo gol é exibido');
const minutes=r.realTime/60;ok(minutes>4&&minutes<16,'duração real da transmissão plausível: '+minutes.toFixed(1)+' min');
const keyDiff=ev3.map(x=>{const ev=r.m.events.find(e=>e.id===x.id);return ev;});ok(keyDiff.length>=4,'há melhores momentos suficientes ('+keyDiff.length+')');
console.log(`  pro: ${ev3.length} lances exibidos de ${r.m.events.length} candidatos · ${kos.length} toques iniciais · ${minutes.toFixed(1)} min reais · placar ${r.m.score.home}-${r.m.score.away}`);
/* 2) ritmos: rápido < normal < lento em tempo real */
const fast=run(clubs[1],clubs[2],{seed:99},{pace:'fast'}),slow=run(clubs[1],clubs[2],{seed:99},{pace:'slow'}),norm=run(clubs[1],clubs[2],{seed:99},{pace:'normal'});
ok(fast.realTime<norm.realTime&&norm.realTime<slow.realTime,`ritmo previsível: rápido ${(fast.realTime/60).toFixed(1)} < normal ${(norm.realTime/60).toFixed(1)} < lento ${(slow.realTime/60).toFixed(1)} min`);
ok(fast.presentRates.every(v=>v<=1.0001),'ritmo rápido não acelera as animações dos lances');
/* 3) mata-mata com prorrogação e pênaltis */
let pens=null;for(let sd=1;sd<400&&!pens;sd++){const t=run(clubs[2],clubs[3],{seed:sd,knockout:{extraTime:true,shootout:true}});if(t.m.pens&&t.m.pens.decided)pens=t;}
ok(!!pens,'mata-mata empatado vai para prorrogação e pênaltis');
ok(pens.breaks>=3,'intervalos: 2º tempo, prorrogação, 2º tempo da prorrogação e pênaltis ('+pens.breaks+')');
const kicks=pens.starts.filter(x=>x.shoot).length;ok(kicks===pens.m.pens.kicks.length,'todas as cobranças da disputa são exibidas ('+kicks+')');
ok(E.winner(pens.m)===pens.m.pens.winner,'vencedor decidido nos pênaltis, sem sorteio invisível');
console.log('PACING TEST PASS ('+checks+' verificações)');
