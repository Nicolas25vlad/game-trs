'use strict';
/* MATCHDAY 0.5 — Modo Germinare: regras 5x5, seleção mista sem repetição, persistência, ritmo da transmissão. */
const assert=require('node:assert/strict');
const FILES=['js/util.js','js/modes.js','js/data.js','data/catalog_br_2026.js','js/catalog.js','js/rules.js','js/engine.js','js/germinare.js','js/choreo.js','js/pacing.js'];
const store={};const MD=require('./load.cjs')(FILES,{window:true,store});
const D=MD.Data,E=MD.Engine,GM=MD.Germinare,CAT=MD.Catalog,C=MD.Choreo,PG=MD.Pacing,R=MD.Rules;
let checks=0;const ok=(c,msg)=>{assert.ok(c,msg);checks++;console.log('  ✓ '+msg);};
const {clubs}=CAT.load();
const find=(cid,pid)=>{const c=clubs.find(x=>x.id===cid);if(!c)return null;const p=[...c.players,...c.bench].find(x=>x.id===pid);return p?{player:p,club:c}:null;};
const all=CAT.allPlayers(clubs);
const gks=all.filter(x=>D.groupOf(x.p.position)==='GK'),outs=all.filter(x=>D.groupOf(x.p.position)!=='GK');
/* seleção mista: cada time com jogadores de clubes diferentes */
function squad(name,gk,list){const s=GM.blank(name,'school');s.picks=[{clubId:gk.club.id,playerId:gk.p.id},...list.map(x=>({clubId:x.club.id,playerId:x.p.id}))];return s;}
const byClub=c=>outs.filter(x=>x.club.id===c);
const A=squad('Time A',gks[0],[byClub('br-flamengo')[0],byClub('br-palmeiras')[0],byClub('br-corinthians')[0],byClub('br-saopaulo')[0]].map((x,i)=>x||outs[i]));
const B=squad('Time B',gks.find(x=>x.club.id!==gks[0].club.id),[outs[40],outs[80],outs[120],outs[160]]);
B.kit='bib_orange';
ok(new Set(A.picks.map(p=>p.clubId)).size>=3,'seleção A mistura jogadores de vários clubes');
ok(GM.validate(A,B).length===0&&GM.validate(B,A).length===0,'seleções válidas (1 goleiro + 4 de linha, sem repetição)');
const dup=JSON.parse(JSON.stringify(B));dup.picks[1]=A.picks[1];ok(GM.validate(dup,A).some(e=>/escolhido|repet|já/i.test(e)),'jogador repetido entre os dois times é recusado');
const noGK=JSON.parse(JSON.stringify(A));noGK.picks[0]={...A.picks[1]};noGK.picks[1]=null;ok(GM.validate(noGK,B).length>0,'sem goleiro na vaga 1 é recusado');
const half=JSON.parse(JSON.stringify(A));half.picks[4]=null;ok(GM.validate(half,B).length>0,'time incompleto (4 jogadores) é recusado');
/* persistência */
ok(GM.save([A,B])&&GM.load().length===2&&GM.load()[0].picks[2].playerId===A.picks[2].playerId,'seleções personalizadas salvas e recarregadas');
const before=JSON.stringify(clubs.find(c=>c.id===A.picks[1].clubId));
const ca=GM.toClub(A,find,'a'),cb=GM.toClub(B,find,'b');
ok(JSON.stringify(clubs.find(c=>c.id===A.picks[1].clubId))===before,'montar o time não altera o clube original do jogador');
ok(ca.players.length===5&&D.groupOf(ca.players[0].position)==='GK','time convertido tem 5 titulares com goleiro');
/* partidas: regras do modo */
const gs={germinare:{minutes:5,goalsToWin:2,penalties:true,restart:'kick'}};
let draws=0,byGoals=0,byTime=0,offs=0,goals=0,maxClock=0,games=0,shown=0,real=0,kick=0;
for(let i=0;i<120;i++){const r=E.simulateFull(ca,cb,{mode:'germinare',seed:'g'+i,...gs});const m=r.m;games++;
 if(i===0){ok(m.mode.id==='germinare'&&m.mode.players===5,'modo Germinare com 5 jogadores por equipe');ok(E.onPitch(m.teams.home).length===5&&E.onPitch(m.teams.away).length===5,'5 em campo de cada lado');ok(m.periodsDef.length===1&&m.periodsDef[0].len===300,'tempo único de 5 minutos');ok(R.PITCH.small&&R.PITCH.L<30,'geometria do campo pequeno ativa');}
 offs+=m.stats.home.offsides+m.stats.away.offsides;goals+=m.score.home+m.score.away;maxClock=Math.max(maxClock,m.clock);
 if(m.score.home===m.score.away)draws++;if(m.endReason==='goals')byGoals++;if(m.endReason==='time')byTime++;
 if(m.ticker.some(t=>t.type==='kick_in'||/lateral com os pés|cobrança de lateral com o pé/i.test(t.text)))kick++;
 ok.quiet=true;
 if(m.endReason==='goals')assert.ok(Math.max(m.score.home,m.score.away)===2,'fim por gols só ao atingir 2');
 assert.ok(m.clock<=300+1,'nunca passa de 5 minutos (sem acréscimos)');}
ok(offs===0,'sem impedimento no Germinare');
ok(byGoals>0&&byTime>0,`termina por 2 gols (${byGoals}) ou pelo tempo (${byTime})`);
ok(draws>0,`empate permitido ao fim do tempo (${draws} empates em ${games})`);
ok(goals/games>1&&goals/games<4.5,`média de gols plausível no 5x5: ${(goals/games).toFixed(2)}`);
/* mata-mata do Germinare: desempate em campo */
let shoot=0,golden=0;for(let i=0;i<60;i++){const r=E.simulateFull(ca,cb,{mode:'germinare',seed:'k'+i,knockout:i%2?{extraTime:true,golden:true,shootout:true}:{shootout:true},...gs});const m=r.m;
 assert.ok(E.winner(m),'mata-mata sempre tem vencedor');if(m.pens&&m.pens.decided)shoot++;if(m.endReason==='golden')golden++;}
ok(shoot>0,`empates do mata-mata decididos nos pênaltis (${shoot})`);ok(golden>0,`gol de ouro configurável decide jogos (${golden})`);
/* transmissão do Germinare com o agendador real */
{const m=E.createMatch(ca,cb,{mode:'germinare',seed:'live1',...gs});const res=E.resolver(m);
 const lu=()=>({home:m.teams.home.players.map(p=>p&&p.id),away:m.teams.away.players.map(p=>p&&p.id)});
 const L=new PG.Live(m,{pace:'normal',build:ev=>C.build(ev,{resolve:res}),kickoff:k=>C.kickoff(lu(),k.side,'first',res,k.t|0,{mode:'germinare'}),replays:true});
 const starts=[];L.o.onStart=it=>starts.push({kind:it.kind,clock:L.clock,real:L.real});L.begin();let g=0;while(L.state!=='done'&&g++<30*60*30){L.update(1/30);if(L.state==='break')L.resume();}
 ok(L.state==='done','transmissão do Germinare chega ao apito final');ok(starts[0]&&starts[0].kind==='kickoff'&&starts[0].clock===0,'começa com o toque inicial em 0:00');
 const goalsN=m.score.home+m.score.away;ok(starts.filter(s=>s.kind==='kickoff').length===1+goalsN,'toque inicial após cada gol');
 ok(L.real>60&&L.real<12*60,`duração real da transmissão: ${(L.real/60).toFixed(1)} min`);}
R.setMode('pro');ok(!R.PITCH.small&&R.PITCH.L===54,'volta à geometria profissional depois');
console.log(`GERMINARE TEST PASS (${checks} verificações)`);
