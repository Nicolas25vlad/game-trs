/* MATCHDAY 0.5 — Modo Copa: gerenciador de torneios (lógica pura, sem interface).
   Formatos: mata-mata simples (qualquer número de equipes ≥ 2, com fase preliminar e folgas organizadas quando o
   número não é potência de dois) e fase de grupos (grupos de 4, turno único, 2 classificados) seguida de mata-mata.
   Desempate no mata-mata: prorrogação e/ou pênaltis (profissional) ou pênaltis / gol de ouro (Germinare) — sempre
   decididos pelo motor, nunca por uma vitória aleatória invisível. Salva, retoma, guarda histórico e troféus. */
(function(MD){
'use strict';
const U=MD.U;
const TR={KEY:'matchday-v05-tournaments',HIST:'matchday-v05-history'};
const ls={get:k=>{try{return JSON.parse(localStorage.getItem(k)||'null');}catch(e){return null;}},set:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true;}catch(e){return false;}}};
TR.list=()=>ls.get(TR.KEY)||[];
TR.saveAll=list=>ls.set(TR.KEY,list);
TR.get=id=>TR.list().find(t=>t.id===id)||null;
TR.save=function(t){const list=TR.list();const i=list.findIndex(x=>x.id===t.id);if(i>=0)list[i]=t;else list.push(t);return TR.saveAll(list);};
TR.remove=id=>TR.saveAll(TR.list().filter(t=>t.id!==id));
TR.history=()=>ls.get(TR.HIST)||[];
TR.roundName=function(teams,prelim){if(prelim)return'Fase preliminar';return{2:'Final',4:'Semifinal',8:'Quartas de final',16:'Oitavas de final',32:'16-avos de final',64:'32-avos de final'}[teams]||(teams+' equipes');};
const pow2=n=>{let p=1;while(p*2<=n)p*=2;return p;};
/* ---------- criação ---------- */
/* o: {name, mode:'pro'|'germinare', format:'knockout'|'groups', teams:[{id,name,short,crest,primary,secondary,ovr,kind:'club'|'squad'}],
       draw:'random'|'seeded', extraTime, shootout, germTiebreak:'penalties'|'golden', germ:{minutes,goalsToWin}, pace, finalStadium, seed} */
TR.create=function(o){const teams=(o.teams||[]).filter(Boolean);const ids=teams.map(t=>t.id);
 if(teams.length<2)throw Error('Escolha pelo menos 2 equipes.');if(new Set(ids).size!==ids.length)throw Error('Há equipes repetidas.');
 if(o.format==='groups'&&(teams.length<8||teams.length%4))throw Error('Fase de grupos precisa de 8, 12, 16… equipes (múltiplo de 4).');
 const seed=o.seed||((Date.now()^U.hashStr(o.name||'copa'))>>>0);
 const t={id:U.uid('cup'),name:String(o.name||'Copa MATCHDAY').slice(0,40),created:new Date().toISOString(),mode:o.mode==='germinare'?'germinare':'pro',format:o.format==='groups'?'groups':'knockout',
  teams:teams.map(x=>({id:x.id,name:x.name,short:x.short,crest:x.crest||null,primary:x.primary,secondary:x.secondary,ovr:x.ovr||0,kind:x.kind||'club',squad:x.squad||null})),
  rules:{extraTime:o.mode==='germinare'?false:o.extraTime!==false,shootout:o.shootout!==false,germTiebreak:o.germTiebreak||'penalties',germ:o.germ||{minutes:5,goalsToWin:2},pace:o.pace||'normal'},
  draw:o.draw||'random',seed,finalStadium:o.finalStadium||'',matches:{},rounds:[],groups:[],stage:'',seq:0,champion:null,runnerUp:null,players:{},log:[]};
 const rng=U.rng(seed);let order=t.teams.map(x=>x.id);
 if(t.draw==='seeded')order.sort((a,b)=>TR.team(t,b).ovr-TR.team(t,a).ovr);else{for(let i=order.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[order[i],order[j]]=[order[j],order[i]];}}
 if(t.format==='groups'){TR.buildGroups(t,order,rng);t.stage='groups';}else{TR.buildKnockout(t,order);t.stage='knockout';}
 TR.save(t);return t;};
TR.team=(t,id)=>t.teams.find(x=>x.id===id)||null;
TR.newMatch=function(t,o){const id='m'+(++t.seq);t.matches[id]={id,round:o.round,group:o.group||null,home:o.home||null,away:o.away||null,status:'pending',result:null,next:o.next||null,feeds:o.feeds||null,label:o.label||''};return t.matches[id];};
/* Mata-mata: com N não potência de 2, joga-se uma fase preliminar com 2·(N−P) equipes; as demais (melhor ranqueadas na
   ordem do sorteio/cabeças) avançam direto (folga). Ex.: 20 → 8 jogos preliminares + 12 folgas → 16. */
TR.buildKnockout=function(t,order){const N=order.length,P=pow2(N);const prelimN=N===P?0:N-P;const byes=order.slice(0,P-prelimN);const playIn=order.slice(P-prelimN);
 const firstSlots=[];/* entradas da primeira rodada completa: {team} ou {from:matchId} */
 let prelimRound=null;
 if(prelimN>0){prelimRound={id:'r0',name:TR.roundName(0,true),matches:[]};t.rounds.push(prelimRound);
  for(let i=0;i<prelimN;i++){const m=TR.newMatch(t,{round:'r0',home:playIn[i],away:playIn[playIn.length-1-i],label:'Preliminar '+(i+1)});prelimRound.matches.push(m.id);}}
 /* distribui folgas e vencedores preliminares alternadamente para que nenhum lado do chaveamento fique só com folgas */
 const pm=prelimRound?prelimRound.matches.slice():[];const queue=[];let bi=0,pi=0;
 while(bi<byes.length||pi<pm.length){if(bi<byes.length)queue.push({team:byes[bi++]});if(pi<pm.length)queue.push({from:pm[pi++]});}
 /* emparelha: 1º contra último, 2º contra penúltimo… */
 const pairs=[];for(let i=0;i<P/2;i++)pairs.push([queue[i],queue[P-1-i]]);
 let teamsInRound=P,ri=1,prev=[];const r={id:'r'+ri,name:TR.roundName(teamsInRound),matches:[]};t.rounds.push(r);
 for(const [a,b] of pairs){const m=TR.newMatch(t,{round:r.id,home:a.team||null,away:b.team||null,feeds:[a.from||null,b.from||null]});r.matches.push(m.id);
  if(a.from)t.matches[a.from].next={match:m.id,slot:'home'};if(b.from)t.matches[b.from].next={match:m.id,slot:'away'};}
 prev=r.matches;
 while(prev.length>1){teamsInRound/=2;ri++;const nr={id:'r'+ri,name:TR.roundName(teamsInRound),matches:[]};t.rounds.push(nr);
  for(let i=0;i<prev.length;i+=2){const m=TR.newMatch(t,{round:nr.id,feeds:[prev[i],prev[i+1]]});nr.matches.push(m.id);t.matches[prev[i]].next={match:m.id,slot:'home'};t.matches[prev[i+1]].next={match:m.id,slot:'away'};}
  prev=nr.matches;}
 t.finalId=prev[0];return t;};
/* Grupos de 4 por potes (por overall), turno único: 6 jogos por grupo em 3 rodadas. */
TR.buildGroups=function(t,order,rng){const sorted=order.slice().sort((a,b)=>TR.team(t,b).ovr-TR.team(t,a).ovr);const G=sorted.length/4;const pots=[0,1,2,3].map(k=>sorted.slice(k*G,(k+1)*G));
 for(const p of pots)for(let i=p.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[p[i],p[j]]=[p[j],p[i]];}
 const L='ABCDEFGHIJKLMNOP';for(let g=0;g<G;g++){const ids=pots.map(p=>p[g]);const grp={name:L[g],teams:ids,matches:[]};
  const sched=[[0,1],[2,3],[0,2],[3,1],[3,0],[1,2]];sched.forEach((s,k)=>{const m=TR.newMatch(t,{round:'g'+(Math.floor(k/2)+1),group:grp.name,home:ids[s[0]],away:ids[s[1]],label:'Grupo '+grp.name+' · '+(Math.floor(k/2)+1)+'ª rodada'});grp.matches.push(m.id);});
  t.groups.push(grp);}
 return t;};
TR.standings=function(t,g){const rows=g.teams.map(id=>({id,p:0,w:0,d:0,l:0,gf:0,ga:0,pts:0}));const by=id=>rows.find(r=>r.id===id);
 for(const mid of g.matches){const m=t.matches[mid];if(m.status!=='done')continue;const h=by(m.home),a=by(m.away),R=m.result;h.p++;a.p++;h.gf+=R.hs;h.ga+=R.as;a.gf+=R.as;a.ga+=R.hs;
  if(R.hs>R.as){h.w++;h.pts+=3;a.l++;}else if(R.hs<R.as){a.w++;a.pts+=3;h.l++;}else{h.d++;a.d++;h.pts++;a.pts++;}}
 const h2h=(x,y)=>{let p=0;for(const mid of g.matches){const m=t.matches[mid];if(m.status!=='done')continue;if(m.home===x&&m.away===y)p+=m.result.hs>m.result.as?3:m.result.hs===m.result.as?1:0;if(m.away===x&&m.home===y)p+=m.result.as>m.result.hs?3:m.result.hs===m.result.as?1:0;}return p;};
 const lot=U.rng(t.seed^U.hashStr(g.name));const tie=new Map(rows.map(r=>[r.id,lot()]));
 rows.sort((a,b)=>b.pts-a.pts||(b.gf-b.ga)-(a.gf-a.ga)||b.gf-a.gf||h2h(b.id,a.id)-h2h(a.id,b.id)||tie.get(b.id)-tie.get(a.id));
 rows.forEach((r,i)=>{r.pos=i+1;r.gd=r.gf-r.ga;});return rows;};
TR.groupsDone=t=>t.groups.length&&t.groups.every(g=>g.matches.every(id=>t.matches[id].status==='done'));
TR.startKnockoutFromGroups=function(t){const st=t.groups.map(g=>TR.standings(t,g));const firsts=st.map(s=>s[0].id),seconds=st.map(s=>s[1].id);
 /* cruzamento: 1º do grupo A × 2º do grupo B, 1º B × 2º A… — primeiros colocados ficam com as folgas se houver preliminar */
 const order=[];for(let i=0;i<firsts.length;i++)order.push(firsts[i]);for(let i=0;i<seconds.length;i++)order.push(seconds[(i+1)%seconds.length]);
 const P=pow2(order.length);if(P===order.length){/* pareia 1A×2B no mesmo lado do chaveamento */const pairs=[];for(let i=0;i<firsts.length;i++)pairs.push(firsts[i],seconds[(i+1)%seconds.length]);
  const q=[];for(let i=0;i<pairs.length/2;i++)q[i]=pairs[i*2],q[pairs.length-1-i]=pairs[i*2+1];TR.buildKnockout(t,q);}
 else TR.buildKnockout(t,order);
 t.stage='knockout';t.log.push({at:new Date().toISOString(),text:'Classificados: '+[...firsts,...seconds].map(id=>TR.team(t,id).short).join(', ')});};
/* ---------- próximos jogos ---------- */
TR.playable=t=>Object.values(t.matches).filter(m=>m.status==='pending'&&m.home&&m.away);
TR.nextMatch=function(t){const pl=TR.playable(t);if(!pl.length)return null;const ro=id=>{const g=/^g(\d+)/.exec(id);if(g)return +g[1];return 100+(+id.slice(1));};return pl.sort((a,b)=>ro(a.round)-ro(b.round)||(+a.id.slice(1))-(+b.id.slice(1)))[0];};
TR.isKnockout=(t,m)=>!m.group;
TR.isFinal=(t,m)=>m.id===t.finalId;
TR.roundOf=(t,m)=>t.rounds.find(r=>r.id===m.round)||null;
/* configurações da partida para o motor */
TR.matchSettings=function(t,m,base){const s={...(base||{}),neutral:true,mode:t.mode};
 if(t.mode==='germinare'){s.germinare={...(base&&base.germinare||{}),minutes:t.rules.germ.minutes,goalsToWin:t.rules.germ.goalsToWin};}
 if(TR.isKnockout(t,m)){s.knockout=t.mode==='germinare'?{extraTime:t.rules.germTiebreak==='golden',golden:t.rules.germTiebreak==='golden',shootout:true}:{extraTime:t.rules.extraTime,shootout:true};}
 return s;};
/* ---------- resultado de uma partida (assistida ou simulada) ---------- */
TR.resultFromMatch=function(m){const E=MD.Engine;const goals=m.events.filter(e=>e.goal);const scorers=goals.map(e=>{const p=E.find(m,e.goal.scorerId);return{id:e.goal.scorerId,name:p?p.data.name:'',side:e.goal.side,own:!!e.goal.ownGoal,min:e.minute};});
 const ratings=E.playerRatings(m);const st=m.stats;
 return{hs:m.score.home,as:m.score.away,pens:m.pens&&m.pens.decided?{h:m.pens.home,a:m.pens.away}:null,et:m.periodsDef.some(p=>p.extra&&m.added[p.id]!==null),golden:m.endReason==='golden',
  winner:E.winner(m),endReason:m.endReason,scorers,motm:ratings[0]?{id:ratings[0].id,name:ratings[0].name,side:ratings[0].side,rating:ratings[0].rating}:null,
  ratings:ratings.map(r=>({id:r.id,name:r.name,side:r.side,rating:r.rating,goals:r.goals,assists:r.assists})),
  stats:{shots:[st.home.shots,st.away.shots],poss:[st.home.possession,st.away.possession],xg:[+st.home.xg.toFixed(2),+st.away.xg.toFixed(2)]},seed:m.seed};};
/* 0.6: resultado vindo do mundo contínuo (partidas jogadas ou assistidas) */
TR.resultFromWorld=function(w){const goals=w.events.filter(e=>e.type==='goal');const byId=id=>w.byId(id);
 const scorers=goals.map(e=>{const p=byId(e.pid);return{id:e.pid,name:p?p.name:'',side:w.teams[e.team].side,own:!!e.own,min:e.minute};});
 const R=w.ratings();const st={home:w.stats[0],away:w.stats[1]};
 return{hs:w.score[0],as:w.score[1],pens:w.pens&&w.pens.decided?{h:w.pens.home,a:w.pens.away}:null,et:w.periods.slice(0,w.pi+1).some(p=>p.extra&&!p.golden),golden:w.endReason==='golden',winner:w.winner(),endReason:w.endReason,scorers,
  motm:R[0]?{id:R[0].id,name:R[0].name,side:R[0].side,rating:R[0].rating}:null,ratings:R.map(r=>({id:r.id,name:r.name,side:r.side,rating:r.rating,goals:r.goals,assists:r.assists})),
  stats:{shots:[st.home.shots,st.away.shots],poss:[Math.round(st.home.poss/Math.max(1,st.home.poss+st.away.poss)*100),Math.round(st.away.poss/Math.max(1,st.home.poss+st.away.poss)*100)],xg:[+st.home.xg.toFixed(2),+st.away.xg.toFixed(2)]},seed:w.seed,played:true};};
TR.record=function(t,matchId,R){const m=t.matches[matchId];if(!m||m.status==='done')return t;m.status='done';m.result=R;
 const sideTeam={home:m.home,away:m.away};
 for(const r of R.ratings||[]){const k=r.id;const p=t.players[k]||(t.players[k]={name:r.name,team:sideTeam[r.side],goals:0,assists:0,sum:0,n:0});p.goals+=r.goals||0;p.assists+=r.assists||0;p.sum+=r.rating;p.n++;}
 for(const s of R.scorers||[])if(s.own){/* gol contra não conta para artilharia */}
 if(TR.isKnockout(t,m)){const win=R.winner==='home'?m.home:R.winner==='away'?m.away:null;if(!win)throw Error('Partida eliminatória sem vencedor.');m.winnerId=win;
  if(m.next){const n=t.matches[m.next.match];n[m.next.slot]=win;}
  if(TR.isFinal(t,m)){t.champion=win;t.runnerUp=win===m.home?m.away:m.home;t.stage='done';t.finishedAt=new Date().toISOString();TR.archive(t);}}
 else if(t.stage==='groups'&&TR.groupsDone(t))TR.startKnockoutFromGroups(t);
 TR.save(t);return t;};
TR.topScorers=function(t,n){return Object.entries(t.players).map(([id,p])=>({id,...p})).filter(p=>p.goals>0).sort((a,b)=>b.goals-a.goals||a.n-b.n).slice(0,n||10);};
TR.bestPlayer=function(t){const list=Object.entries(t.players).map(([id,p])=>({id,...p,avg:p.n?p.sum/p.n:0})).filter(p=>p.n>=Math.max(1,Math.min(3,Math.floor(Object.values(t.matches).filter(m=>m.status==='done').length/Math.max(1,t.teams.length/2)))));
 return list.sort((a,b)=>b.avg+b.goals*.15-(a.avg+a.goals*.15))[0]||null;};
TR.archive=function(t){const h=TR.history();if(h.some(x=>x.id===t.id))return;const champ=TR.team(t,t.champion),vice=TR.team(t,t.runnerUp);const top=TR.topScorers(t,1)[0],best=TR.bestPlayer(t);
 const done=Object.values(t.matches).filter(m=>m.status==='done');const goals=done.reduce((n,m)=>n+m.result.hs+m.result.as,0);
 h.unshift({id:t.id,name:t.name,mode:t.mode,format:t.format,size:t.teams.length,date:t.finishedAt,champion:champ,runnerUp:vice,topScorer:top?{name:top.name,goals:top.goals,team:(TR.team(t,top.team)||{}).short}:null,
  bestPlayer:best?{name:best.name,avg:+best.avg.toFixed(2),team:(TR.team(t,best.team)||{}).short}:null,stats:{matches:done.length,goals,avg:+(goals/Math.max(1,done.length)).toFixed(2)},participants:t.teams.map(x=>x.short)});
 ls.set(TR.HIST,h.slice(0,100));};
/* ---------- simulação rápida (sem transmissão) ---------- */
TR.simulate=function(t,matchId,clubOf,base){const m=t.matches[matchId];const E=MD.Engine;const home=clubOf(m.home),away=clubOf(m.away);if(!home||!away)throw Error('Equipe não encontrada.');
 const s=TR.matchSettings(t,m,{...(base||{}),seed:String((t.seed^U.hashStr(matchId))>>>0)});const r=E.simulateFull(home,away,s);return TR.record(t,matchId,TR.resultFromMatch(r.m));};
TR.simulateRound=function(t,clubOf,base){const nx=TR.nextMatch(t);if(!nx)return t;const round=nx.round;for(const m of TR.playable(t).filter(x=>x.round===round))TR.simulate(t,m.id,clubOf,base);return t;};
MD.Tournament=TR;
})(typeof window!=='undefined'?(window.MD=window.MD||{}):(globalThis.MD=globalThis.MD||{}));
