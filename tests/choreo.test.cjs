'use strict';
/* Consistência simulação → coreografia: gols entram no gol, não-gols não entram, chute sincronizado com o pé,
   goleiro reage à trajetória, sem teleportes fora de cortes de cena, sem NaN. */
const assert=require('node:assert/strict');
const MD=require('./load.cjs')(['js/util.js','js/modes.js','js/data.js','js/rules.js','js/engine.js','js/choreo.js']);
const D=MD.Data,E=MD.Engine,C=MD.Choreo;
const clubs=D.PRESETS.map(D.freshClub);let nEv=0,nGoal=0,kinds={},maxJump=0,sumDur=0,bakeMs=0;
for(let i=0;i<60;i++){const m=E.createMatch(clubs[i%6],clubs[(i+3)%6],{seed:String(500+i),highlightRate:'many'});const res=E.resolver(m);let g=0;
 while(m.phase!=='fulltime'&&g++<9999){if(m.phase==='halftime'){E.startSecondHalf(m);continue;}const ev=E.advance(m,99999);if(!ev)continue;
  const t0=Date.now();const tr=C.build(ev,{resolve:res});bakeMs+=Date.now()-t0;nEv++;kinds[ev.kind]=(kinds[ev.kind]||0)+1;sumDur+=tr.duration;
  const n=tr.n;for(let f=0;f<n;f++){assert.ok(Number.isFinite(tr.bx[f])&&Number.isFinite(tr.by[f])&&Number.isFinite(tr.bz[f]),'bola finita');}
  for(const a of tr.actors)for(let f=1;f<n;f++){assert.ok(Number.isFinite(a.x[f])&&Number.isFinite(a.z[f]),'ator finito');
   const cut=tr.cuts.some(c=>Math.abs(c*tr.fps-f)<=1.01);if(!cut){const j=Math.hypot(a.x[f]-a.x[f-1],a.z[f]-a.z[f-1]);if(j>maxJump)maxJump=j;assert.ok(j<.9,`sem teleporte (${j.toFixed(2)}m, ${ev.kind}, ator ${a.kind})`);}}
  const inNet=f=>Math.abs(tr.bx[f])>54.05&&Math.abs(tr.bx[f])<55.9&&Math.abs(tr.bz[f])<3.66&&tr.by[f]<2.44&&Math.sign(tr.bx[f])===tr.goalSide;
  const goalFrames=[...Array(n).keys()].filter(inNet);
  if(ev.goal||ev.kind==='disallowed'){nGoal++;assert.ok(goalFrames.length>5,'bola entra no gol em lance de gol ('+ev.kind+')');
   const fa=Math.round(tr.goalT*tr.fps);assert.ok(Math.abs(Math.abs(tr.bx[fa])-54)<.8,'bola na linha no instante do gol');}
  else assert.equal(goalFrames.length,0,'bola não entra no gol sem gol ('+ev.kind+')');
  if(ev.goal)assert.ok(tr.applyAt>=tr.goalT-1e-6,'placar só muda quando a bola entra');
  /* sincronia do chute: atirador perto da bola no instante do chute */
  const shot=ev.beats.find(b=>b.k==='shot'&&b.outcome!=='blocked'&&b.type!=='header'&&b.type!=='owngoal');
  if(shot){const ai=tr.actors.findIndex(a=>a.id===shot.by.id);const A=tr.actors[ai];const kick=tr.marks.filter(mk=>mk.type==='kick'&&mk.shot&&mk.by===ai);
   const best=Math.min(...kick.map(k=>{const f=Math.round(k.t*tr.fps);return Math.hypot(A.x[f]-tr.bx[f],A.z[f]-tr.bz[f]);}));assert.ok(best<1.3,'pé perto da bola no chute: '+best.toFixed(2));}
  /* goleiro reage: no instante da defesa está perto da bola */
  const save=ev.beats.find(b=>b.k==='shot'&&b.outcome==='save');if(save&&save.keeper){const K=tr.actors.find(a=>a.id===save.keeper.id);const mk=tr.marks.find(x=>x.type==='save');const f=Math.round(mk.t*tr.fps);
   const d=Math.hypot(K.x[f]-tr.bx[f],K.z[f]-tr.bz[f]);assert.ok(d<2.4,'goleiro alcança a bola na defesa: '+d.toFixed(2));}
  if(ev.goal)assert.ok(tr.actors.some(a=>a.acts.some(x=>x.clip==='hug')),'companheiros comemoram juntos');
  if(ev.card)assert.ok(tr.actors[tr.refIndex].acts.some(x=>x.clip==='show_card'),'árbitro mostra o cartão');
  if(ev.beats.some(b=>b.k==='penalty'))assert.ok(tr.cuts.length>=1,'pênalti tem cena própria');
 }}
console.log('Lances coreografados:',nEv,'gols/anulados:',nGoal,'tipos:',JSON.stringify(kinds));
console.log('Duração média do lance:',(sumDur/nEv).toFixed(1)+'s','| maior deslocamento por quadro:',maxJump.toFixed(2)+'m','| bake médio:',(bakeMs/nEv).toFixed(1)+'ms');
console.log('CHOREO TEST PASS');
