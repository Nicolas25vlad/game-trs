'use strict';
/* MATCHDAY 0.5 — Modo Copa: formatos, fase preliminar com folgas, grupos, desempates em campo, persistência e histórico. */
const assert=require('node:assert/strict');
const FILES=['js/util.js','js/modes.js','js/data.js','data/catalog_br_2026.js','js/catalog.js','js/rules.js','js/engine.js','js/germinare.js','js/tournament.js'];
const store={};let MD=require('./load.cjs')(FILES,{window:true,store});
let checks=0;const ok=(c,msg)=>{assert.ok(c,msg);checks++;console.log('  ✓ '+msg);};
let {clubs}=MD.Catalog.load();const D=MD.Data,TR=MD.Tournament,GM=MD.Germinare;
const real=clubs.filter(c=>c.real||c.fictional).filter(c=>c.id.startsWith('br-'));
const team=c=>({id:c.id,name:c.name,short:c.short,primary:c.primary,secondary:c.secondary,ovr:D.teamOverall(c),kind:'club'});
const clubOf=mode=>id=>{const c=clubs.find(x=>x.id===id);return mode==='germinare'?GM.fromClub(c):c;};
function play(t){let g=0;while(TR.nextMatch(t)&&g++<400)TR.simulateRound(t,clubOf(t.mode),{});return t;}
function check(t,label){const done=Object.values(t.matches).filter(m=>m.status==='done');
 for(const m of done){const R=m.result;if(m.group)continue;assert.ok(m.winnerId,'jogo de mata-mata sem vencedor: '+m.id);
  const tie=R.hs===R.as;if(tie)assert.ok(R.pens&&R.pens.h!==R.pens.a,'empate no mata-mata precisa de pênaltis em campo');
  const w=R.hs>R.as?m.home:R.as>R.hs?m.away:(R.pens.h>R.pens.a?m.home:m.away);assert.equal(m.winnerId,w,'vencedor coerente com o placar ('+label+')');}
 return done.length;}
const sizes=[4,8,16,32,20,40,5];
for(const n of sizes){const t=TR.create({name:'Copa '+n,teams:real.slice(0,n).map(team),seed:1000+n});
 const r1=t.rounds[0];const playIn=r1.matches.length;
 if(n===20)ok(playIn===4&&t.rounds.length===5,'20 equipes: fase preliminar com 8 equipes (4 jogos) + 12 folgas e depois oitavas (5 fases)');
 if(n===40)ok(playIn===8&&t.rounds.length===6,'40 equipes: 16 equipes em 8 jogos preliminares + 24 folgas, chave de 32 (6 fases)');
 if(n===5)ok(playIn===1&&t.rounds.length===3,'5 equipes: 1 jogo preliminar e 3 folgas');
 play(t);const done=check(t,'n='+n);
 ok(t.stage==='done'&&t.champion&&t.runnerUp&&t.champion!==t.runnerUp,`${n} equipes: ${done} jogos até a final e campeão definido`);
 assert.equal(done,n-1,'mata-mata simples tem N-1 jogos');}
/* grupos + mata-mata */
{const t=TR.create({name:'Copa Grupos',format:'groups',teams:real.slice(0,16).map(team),draw:'seeded',seed:77});
 ok(t.groups.length===4&&t.groups.every(g=>g.teams.length===4),'16 equipes em 4 grupos de 4 (cabeças de chave)');
 const top4=t.teams.slice().sort((a,b)=>b.ovr-a.ovr).slice(0,4).map(x=>x.id);ok(new Set(top4.map(id=>t.groups.findIndex(g=>g.teams.includes(id)))).size===4,'os 4 melhores (cabeças de chave) ficam em grupos diferentes');
 play(t);check(t,'grupos');const st=TR.standings(t,t.groups[0]);
 ok(st.length===4&&st[0].pts>=st[1].pts&&st.every(r=>r.p===3),'classificação dos grupos: 3 jogos cada, ordenada por pontos');
 ok(t.rounds[0].matches.length===4&&t.stage==='done','2 classificados por grupo jogam as quartas até o campeão');
 assert.throws(()=>TR.create({format:'groups',teams:real.slice(0,10).map(team)}),'grupos exigem múltiplo de 4');checks++;}
/* desempate em campo (nunca vitória invisível) */
{let pens=0,et=0;for(let s=0;s<6;s++){const t=TR.create({name:'Copa ET',teams:real.slice(0,8).map(team),seed:500+s,extraTime:true});play(t);for(const m of Object.values(t.matches)){if(m.result.pens)pens++;if(m.result.et)et++;}}
 ok(et>0,`prorrogação aparece nos empates (${et} jogos)`);ok(pens>0,`pênaltis decidem quando a prorrogação empata (${pens} jogos)`);}
{const t=TR.create({name:'Copa Direto',teams:real.slice(0,16).map(team),seed:91,extraTime:false});play(t);ok(Object.values(t.matches).every(m=>!m.result.et),'sem prorrogação quando configurado: empate vai direto aos pênaltis');}
/* Germinare */
{const t=TR.create({name:'Copa Germinare',mode:'germinare',teams:real.slice(0,8).map(team),seed:5,germTiebreak:'golden',germ:{minutes:5,goalsToWin:2}});play(t);check(t,'germinare');
 ok(t.stage==='done','Copa no modo Germinare (5x5) até o campeão');ok(Object.values(t.matches).every(m=>m.result.hs<=3&&m.result.as<=3),'placar do Germinare respeita o fim por 2 gols (no máx. 3 com gol de ouro/limite)');}
/* repetidos e mínimos */
assert.throws(()=>TR.create({teams:[team(real[0]),team(real[0])]}),'repetido');checks++;assert.throws(()=>TR.create({teams:[team(real[0])]}),'mínimo 2');checks++;
/* persistência: continuar depois de fechar o navegador */
{const t=TR.create({name:'Copa Salva',teams:real.slice(0,8).map(team),seed:3});TR.simulateRound(t,clubOf('pro'),{});const id=t.id;
 MD=require('./load.cjs')(FILES,{window:true,store});({clubs}=MD.Catalog.load());const TR2=MD.Tournament;const t2=TR2.get(id);
 ok(t2&&Object.values(t2.matches).filter(m=>m.status==='done').length===4,'torneio retomado após recarregar (rodada 1 preservada)');
 let g=0;while(TR2.nextMatch(t2)&&g++<50)TR2.simulateRound(t2,id=>clubs.find(c=>c.id===id),{});ok(t2.stage==='done','torneio retomado vai até o fim');
 const h=TR2.history();ok(h.length>0&&h[0].champion&&h[0].topScorer!==undefined,'histórico de campeões gravado com artilheiro e craque');}
console.log(`TOURNAMENT TEST PASS (${checks} verificações)`);
