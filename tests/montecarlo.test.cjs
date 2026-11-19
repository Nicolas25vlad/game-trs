'use strict';
/* Calibração estatística: simula muitas partidas sem interface e confere médias plausíveis,
   consistência placar × eventos e vantagem real (mas não absoluta) do time mais forte. */
const assert=require('node:assert/strict');
const MD=require('./load.cjs')();
const D=MD.Data,E=MD.Engine;
const N=Number(process.argv[2]||600);
const clubs=D.PRESETS.map(D.freshClub);
const strong=clubs[0],weak=MD.U.deepClone(clubs[5]);/* Monte Verde (83) x União Dourada (75) */
weak.players.forEach(p=>{D.fitAttrs(p.attrs,p.position,Math.max(45,p.rating-11));p.rating=D.computeOverall(p.attrs,p.position);});
const agg={goals:0,shots:0,onTarget:0,fouls:0,yellow:0,red:0,corners:0,offsides:0,pens:0,highlights:0,ticker:0,zeroZero:0,subs:0,disallowed:0,owngoals:0,saves:0};
const res={home:0,draw:0,away:0},scorelines={};let strongWins=0,weakWins=0,draws2=0;
for(let i=0;i<N;i++){const h=clubs[i%6],a=clubs[(i*5+1)%6]===h?clubs[(i+2)%6]:clubs[(i*5+1)%6];
 const {m,events}=E.simulateFull(h,a,{seed:String(1000+i)});
 const g=m.score.home+m.score.away;agg.goals+=g;
 for(const s of ['home','away']){const st=m.stats[s];agg.shots+=st.shots;agg.onTarget+=st.onTarget;agg.fouls+=st.fouls;agg.yellow+=st.yellow;agg.red+=st.red;agg.corners+=st.corners;agg.offsides+=st.offsides;agg.subs+=st.subs;agg.saves+=st.saves;
  assert.ok(st.onTarget<=st.shots,'onTarget<=shots');}
 agg.pens+=events.filter(e=>e.beats.some(b=>b.k==='penalty')).length;agg.highlights+=events.length;agg.ticker+=m.ticker.length;
 agg.disallowed+=events.filter(e=>e.kind==='disallowed').length;agg.owngoals+=events.filter(e=>e.kind==='owngoal').length;
 if(!g)agg.zeroZero++;
 /* consistência: placar = soma dos eventos de gol válidos */
 const gh=events.filter(e=>e.goal&&e.goal.side==='home').length,ga=events.filter(e=>e.goal&&e.goal.side==='away').length;
 assert.equal(gh,m.score.home,'gols home = eventos');assert.equal(ga,m.score.away,'gols away = eventos');
 assert.ok(m.clock>=5400+m.added.second-1,'jogo terminou após acréscimos');assert.equal(m.phase,'fulltime');
 for(const e of events){assert.ok(e.beats.length>0);if(e.kind==='disallowed')assert.ok(!e.goal,'gol anulado não conta');
  if(e.goal)assert.ok(e.beats.some(b=>b.k==='celebrate'));
  /* falta na área -> pênalti */
  for(const b of e.beats)if(b.k==='foul'&&!b.advantage&&MD.Rules.inPenaltyArea(b.at[0],b.at[1])&&b.offence!=='dangerous_play')assert.equal(b.restart,'penalty','falta na área deve ser pênalti');}
 for(const t of Object.values(m.teams))assert.ok(E.onPitch(t).length===11-t.sentOff.length,'expulsos fora de campo');
 const res1=m.score.home>m.score.away?'home':m.score.home<m.score.away?'away':'draw';res[res1]++;const k=m.score.home+'-'+m.score.away;scorelines[k]=(scorelines[k]||0)+1;}
let mw=0,md=0,ml=0;for(let i=0;i<N/2;i++){const r=E.simulateFull(clubs[0],clubs[5],{seed:String(99000+i)}).m;if(r.score.home>r.score.away)mw++;else if(r.score.home<r.score.away)ml++;else md++;}
for(let i=0;i<N/2;i++){const {m}=E.simulateFull(strong,weak,{seed:String(77000+i)});if(m.score.home>m.score.away)strongWins++;else if(m.score.home<m.score.away)weakWins++;else draws2++;}
const per=k=>(agg[k]/N).toFixed(2);
console.log(`Partidas: ${N}`);
console.log(`Gols/jogo ${per('goals')} | finalizações ${per('shots')} | no alvo ${per('onTarget')} | defesas ${per('saves')} | faltas ${per('fouls')} | amarelos ${per('yellow')} | vermelhos ${per('red')}`);
console.log(`Escanteios ${per('corners')} | impedimentos ${per('offsides')} | pênaltis ${per('pens')} | gols anulados ${per('disallowed')} | gols contra ${per('owngoals')} | substituições ${per('subs')}`);
console.log(`Lances 3D/jogo ${per('highlights')} | ticker/jogo ${per('ticker')} | 0x0 ${(agg.zeroZero/N*100).toFixed(1)}%`);
console.log(`Resultados: mandante ${(res.home/N*100).toFixed(1)}% empate ${(res.draw/N*100).toFixed(1)}% visitante ${(res.away/N*100).toFixed(1)}%`);
console.log('Placares mais comuns:',Object.entries(scorelines).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([k,v])=>k+' ('+(v/N*100).toFixed(1)+'%)').join(', '));
console.log(`Forte (OVR ${D.teamOverall(strong)}) x fraco (OVR ${D.teamOverall(weak)}): forte ${(strongWins/(N/2)*100).toFixed(1)}%, empate ${(draws2/(N/2)*100).toFixed(1)}%, fraco ${(weakWins/(N/2)*100).toFixed(1)}%`);
console.log(`Monte Verde (83) x Uniao Dourada (75): vitórias ${(mw/(N/2)*100).toFixed(1)}%, empates ${(md/(N/2)*100).toFixed(1)}%, derrotas ${(ml/(N/2)*100).toFixed(1)}%`);
const g=agg.goals/N;assert.ok(ml>0&&mw>ml,'favorito vence mais, mas perde às vezes');assert.ok(g>1.8&&g<3.6,'média de gols plausível');assert.ok(agg.red/N<.4,'expulsões raras');assert.ok(agg.pens/N<.55&&agg.pens/N>.08,'pênaltis plausíveis');
assert.ok(strongWins>weakWins*2.2,'time forte tem vantagem real');assert.ok(weakWins>0,'zebra possível');
console.log('MONTE CARLO PASS');
