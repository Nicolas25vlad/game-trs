'use strict';
/* TRS26 / MATCHDAY 0.6 — testes do mundo contínuo jogável (sem navegador).
   Um "humano" envia os mesmos comandos lógicos que o teclado/controle enviariam (MOVE, PASS, SHOOT, SWITCH, TACKLE...). */
const assert=require('node:assert/strict');
const FILES=['js/util.js','js/modes.js','js/data.js','data/catalog_br_2026.js','js/catalog.js','js/rules.js','js/germinare.js','js/tournament.js','js/football/world.js','js/football/physics.js','js/football/actions.js','js/football/referee.js','js/football/restarts.js','js/football/ai.js'];
const MD=require('./load.cjs')(FILES,{window:true});
const {clubs}=MD.Catalog.load();const W=MD.World;const H=clubs.find(c=>c.id==='br-flamengo'),A=clubs.find(c=>c.id==='br-corinthians');
let checks=0;const ok=(c,msg)=>{assert.ok(c,msg);checks++;console.log('  ✓ '+msg);};
const cmd=o=>({...W.emptyCmd(),...o});
const run=(w,secs,fn)=>{const n=Math.round(secs/W.DT);for(let i=0;i<n&&!w.done;i++){if(fn)fn(i);w.step();if(w.phase==='break')w.resume();}};
const tap=(w,id,o,hold)=>{w.setCommand(id,cmd(o));run(w,hold||.08);w.setCommand(id,cmd({}));run(w,.05);};
const newWorld=(o)=>new W.World(H,A,{minutes:10,seed:4242,...o});
console.log('Jogável — movimento e controle:');
{const w=newWorld();const h=w.addHuman({id:'p1',side:'home'});
 ok(h.player&&w.restart&&w.restart.taker===h.player,'humano controla o cobrador da saída de bola');
 run(w,2);ok(w.phase==='kickoff'&&w.restart.ready,'saída pronta e aguardando o comando do humano (sem IA cobrando no lugar)');
 const ai0=w.teams[1].players.map(p=>[p.x,p.z]);tap(w,'p1',{pass:true});
 ok(w.phase==='play','toque de PASSE dá a saída de bola');
 run(w,2.5);ok(w.stats[0].passOk>=1||w.ball.owner&&w.ball.owner.team===0,'a bola realmente chega a um companheiro');
 const p=h.player;ok(p&&p!==w.restart?.taker,'controle passou automaticamente para quem recebeu');
 ok(w.teams[1].players.some((q,i)=>Math.hypot(q.x-ai0[i][0],q.z-ai0[i][1])>.5),'os outros 21 atletas continuam se movendo pela IA');
 h.autoSwitch=false;const P=h.player;
 /* mede o movimento em campo aberto: com corpos, correr para cima de um adversário agora esbarra nele */
 P.x=-25;P.z=10;P.vx=P.vz=0;
 w.setCommand('p1',cmd({mx:1}));run(w,1);const x0=P.x;run(w,.5);const dRun=P.x-x0;
 ok(dRun>2&&P.vx>4,`movimento: para a direita a ${P.vx.toFixed(1)} m/s (${dRun.toFixed(1)} m em 0,5 s)`);
 const x1=P.x,z1=P.z;w.setCommand('p1',cmd({mx:.707,mz:.707}));run(w,1);ok(P.x-x1>2&&P.z-z1>2,'movimento diagonal (duas teclas ao mesmo tempo)');
 w.setCommand('p1',cmd({mx:-1}));run(w,.7);const sp1=P.sp;w.setCommand('p1',cmd({mx:-1,sprint:true}));run(w,1.2);const sp2=P.sp;
 ok(sp2>sp1+.8,`sprint é mais rápido (${sp1.toFixed(1)} → ${sp2.toFixed(1)} m/s)`);
 const vx=P.vx;w.setCommand('p1',cmd({mx:1}));run(w,1/60);ok(Math.sign(P.vx)===Math.sign(vx)||Math.abs(P.vx)<Math.abs(vx),'inércia: a mudança de direção não é instantânea');
 w.setCommand('p1',cmd({}));run(w,1.2);ok(P.sp<1,'sem comando o atleta freia (nada fica preso)');
 h.autoSwitch=true;const before=h.player;tap(w,'p1',{switch:true});ok(h.player&&h.player!==before&&h.player.team===0,'TROCAR seleciona outro atleta do próprio time');
 ok(w.teams[0].players.filter(q=>q.human).length===1,'apenas um atleta sob comando humano (a IA não controla o mesmo atleta)');}
console.log('Jogável — chute, gol e placar:');
{let goals=0,saves=0,miss=0,tries=0;for(let k=0;k<24;k++){const w=newWorld({seed:900+k});const h=w.addHuman({id:'p1',side:'home'});run(w,1.5);tap(w,'p1',{pass:true});run(w,.5);
  /* coloca o atacante controlado com a bola na entrada da área e chuta */const P=h.player||w.onPitch(0)[9];w.controlled(h,P);const gx=w.goalX(0);P.x=gx-w.teams[0].dir*(14+k%6);P.z=(k%5-2)*3;P.vx=P.vz=0;P.f=w.teams[0].dir>0?0:Math.PI;
  for(const q of w.onPitch(1))if(!q.gk&&Math.hypot(q.x-P.x,q.z-P.z)<6)q.x-=w.teams[0].dir*8;w.ball.owner=P;w.ball.x=P.x+.4*w.teams[0].dir;w.ball.z=P.z;w.ball.vx=w.ball.vz=0;w.phase='play';w.restart=null;
  const s0=w.score[0];w.setCommand('p1',cmd({shoot:true,mx:0,mz:k%2?.6:-.6}));run(w,.55);w.setCommand('p1',cmd({}));run(w,3.5);tries++;
  if(w.score[0]>s0)goals++;else if(w.stats[1].saves)saves++;else miss++;}
 ok(goals>0,`chutes do humano podem virar gol (${goals}/${tries})`);ok(goals<tries,`nem todo chute é gol (defesas ${saves}, para fora/bloqueio ${miss})`);
 const w=newWorld({seed:77});w.addHuman({id:'p1',side:'home'});run(w,1.5);tap(w,'p1',{pass:true});
 let scored=null;run(w,600,()=>{if(scored===null&&w.score[0]+w.score[1]>0)scored={phase:w.phase};});
 const ev=w.events.filter(e=>e.type==='goal');ok(ev.length===w.score[0]+w.score[1],'placar = gols registrados pela bola cruzando a linha');}
console.log('Jogável — defesa e posse:');
{const w=newWorld({seed:31});const h=w.addHuman({id:'p1',side:'away'});run(w,1.5);
 let lost=0,tk=0;run(w,120,i=>{const P=h.player;const b=w.ball;if(!P)return;if(b.owner&&b.owner.team===0){const dx=b.x-P.x,dz=b.z-P.z,d=Math.hypot(dx,dz)||1;const c=cmd({mx:dx/d,mz:dz/d,sprint:d>4,press:true,tackle:d<1.5&&i%20===0});w.setCommand('p1',c);if(c.tackle)tk++;}else w.setCommand('p1',cmd({}));});
 const turn=w.events.filter(e=>e.type==='turnover'&&e.team===1).length;ok(turn>0,`o time do humano recupera a bola (${turn} recuperações)`);ok(w.stats[1].tackles>0,`desarmes do humano registrados (${w.stats[1].tackles})`);}
{const w=newWorld({seed:32});const h=w.addHuman({id:'p1',side:'home'});run(w,1.5);tap(w,'p1',{pass:true});run(w,90);
 ok(w.events.some(e=>e.type==='turnover'&&e.team===1),'o adversário (IA) consegue recuperar a posse');}
console.log('Regras no mundo 3D:');
{const w=newWorld({seed:5});run(w,1.5);w.takeRestart({kind:'ground'});run(w,.3);const b=w.ball;b.owner=null;b.x=10;b.z=w.P.W-1;b.vx=0;b.vz=8;b.y=.11;b.lastTeam=0;b.last=w.teams[0].players[5];
 run(w,.5);ok(w.phase==='dead'&&w.pendingRestart.type==='throw'&&w.pendingRestart.team===1,'bola pela lateral → lateral para o adversário');run(w,8);ok(w.stats[1].throwins===1&&w.phase!=='dead','lateral é cobrado e o jogo segue');}
{const w=newWorld({seed:6});run(w,1.5);w.takeRestart({kind:'ground'});run(w,.3);const b=w.ball;const end=w.teams[0].dir;b.owner=null;b.x=end*(w.P.L-1);b.z=12;b.vx=end*8;b.vz=0;b.y=.11;b.lastTeam=1;b.last=w.teams[1].players[3];
 run(w,.6);ok(w.pendingRestart&&w.pendingRestart.type==='corner'&&w.pendingRestart.team===0,'defensor tocou por último na linha de fundo → escanteio');}
{const w=newWorld({seed:7});run(w,1.5);w.takeRestart({kind:'ground'});run(w,.3);const b=w.ball;const end=w.teams[0].dir;b.owner=null;b.x=end*(w.P.L-1);b.z=12;b.vx=end*8;b.vz=0;b.y=.11;b.lastTeam=0;b.last=w.teams[0].players[9];
 run(w,.6);ok(w.pendingRestart&&w.pendingRestart.type==='goalkick'&&w.pendingRestart.team===1,'atacante tocou por último → tiro de meta');}
{const w=newWorld({seed:8});run(w,1.5);w.takeRestart({kind:'ground'});run(w,.3);const b=w.ball;const end=w.teams[0].dir;b.owner=null;b.x=end*(w.P.L-.5);b.z=0;b.y=.5;b.vx=end*10;b.vz=0;b.vy=0;b.lastTeam=0;b.last=w.teams[0].players[9];w.goalLock=0;
 for(const q of w.all())if(q.gk)q.z=20;run(w,.6);ok(w.score[0]===1&&w.phase==='goal','bola cruzou totalmente a linha entre as traves → gol');}
{const w=newWorld({seed:9});run(w,1.5);w.takeRestart({kind:'ground'});run(w,.3);const dir=w.teams[0].dir;const pas=w.teams[0].players[6],fw=w.teams[0].players[9];
 w.teams[1].players.forEach((q,i)=>{if(!q.gk){q.x=dir*5;q.z=(i%2?1:-1)*(14+i);}});pas.x=dir*3;pas.z=0;fw.x=dir*25;fw.z=2;fw.vx=fw.vz=0;const b=w.ball;b.owner=pas;b.x=pas.x;b.z=0;w.offsideSnap=null;
 w.pass(pas,{kind:'ground',to:fw,x:fw.x,z:fw.z});run(w,3);ok(w.events.some(e=>e.type==='offside'&&e.pid===fw.id),'atacante adiantado no momento do passe → impedimento');}
{const w=newWorld({seed:10});run(w,1.5);w.takeRestart({kind:'ground'});run(w,.3);const dir=w.teams[0].dir;const fw=w.teams[0].players[9],df=w.teams[1].players[2];
 fw.x=dir*(w.P.L-8);fw.z=0;w.ball.owner=fw;w.ball.x=fw.x;w.ball.z=0;df.x=fw.x-dir*.8;df.z=0;df.f=dir>0?0:Math.PI;w.foul(df,fw,{kind:'tackle',sev:.4});run(w,2);
 ok(w.restart&&w.restart.type==='penalty'&&w.restart.team===0,'infração do defensor dentro da própria área → pênalti');}
{const w=newWorld({seed:11});run(w,1.5);w.takeRestart({kind:'ground'});run(w,.3);const a=w.teams[0].players[5],v=w.teams[1].players[8];a.yellow=1;w.giveCard(a,'yellow');
 ok(a.red&&a.off&&w.onPitch(0).length===10,'segundo amarelo → vermelho e o atleta sai de campo');}
console.log('Partida completa (intervalo, 2º tempo, fim):');
{const w=new W.World(H,A,{minutes:4,seed:12});const h=w.addHuman({id:'p1',side:'home'});let half=false,second=false;let n=0;
 while(!w.done&&n<60*60*9){if(w.restart&&w.restart.taker&&w.restart.taker.human&&w.restart.ready)w.takeRestart({kind:'ground'});w.step();n++;if(w.phase==='break'){half=true;w.resume();if(w.period().id==='second')second=true;}}
 ok(half&&second,'a partida chega ao intervalo e o 2º tempo começa');ok(w.done&&w.phase==='fulltime'&&w.clock>=5400,`apito final após 90 min de jogo (${(n/60/60).toFixed(1)} min reais para 4 escolhidos)`);
 const R=MD.Tournament.resultFromWorld(w);ok(R.hs===w.score[0]&&R.as===w.score[1]&&Array.isArray(R.ratings),'resultado preservado (formato usado pelo Modo Copa e pelo pós-jogo)');}
console.log('Arquitetura (passo fixo, replay, determinismo):');
{const a=newWorld({seed:99}),b=newWorld({seed:99});run(a,30);run(b,30);ok(a.ball.x===b.ball.x&&a.teams[1].players[7].x===b.teams[1].players[7].x,'mesma semente → mesma partida (passo fixo de 1/60 s, independente do FPS)');
 const t0=a.time;const tr=a.replayTrack(8);ok(tr&&tr.n>100&&tr.actors.length>=22&&a.time===t0,'replay montado do buffer gravado sem avançar a partida');}
console.log('Germinare 5x5 e disputa de pênaltis:');
{const g=MD.Germinare;const w=new W.World(g.fromClub(H),g.fromClub(A),{mode:'germinare',germ:{minutes:5,goalsToWin:2},minutes:5,seed:13});const h=w.addHuman({id:'p1',side:'home'});
 ok(w.onPitch(0).length===5&&w.small,'Germinare: 5 atletas por lado no campo pequeno');run(w,1.5);tap(w,'p1',{pass:true});ok(w.phase==='play','Germinare jogável pelo humano');
 run(w,400);ok(w.done&&(Math.max(...w.score)>=2||w.clock>=300),`termina por 2 gols ou 5 minutos (${w.score.join('-')}, ${w.endReason})`);ok(w.stats[0].offsides+w.stats[1].offsides===0,'sem impedimento no Germinare');}
{const w=new W.World(H,A,{minutes:4,seed:14,knockout:{extraTime:false,shootout:true}});w.addHuman({id:'p1',side:'home'});w.score=[1,1];w.clock=5390;w.pi=1;w.added.second=0;w.phase='play';w.restart=null;
 let n=0;let humanDove=0;while(!w.done&&n<60*60*3){if(w.phase==='break')w.resume();const r=w.restart;if(r&&r.taker&&r.taker.human&&r.ready){w.setCommand('p1',cmd({mz:.8}));w.takeRestart({kind:'shot',dirz:.8,power:.6});}
  else if(r&&r.type==='penalty'&&r.ready){const gk=w.gk(1-r.team);if(gk&&gk.human){w.setCommand('p1',cmd({mz:-1}));humanDove++;}}w.step();n++;}
 ok(w.pens&&w.pens.decided&&w.winner(),`empate no mata-mata decidido nos pênaltis em campo (${w.pens&&w.pens.home}x${w.pens&&w.pens.away})`);ok(humanDove>0,'o humano escolhe o lado do mergulho quando é o goleiro');}
console.log('Dificuldade:');
{const goalsBy={};for(const d of ['beginner','legend']){let gf=0;for(let k=0;k<4;k++){const w=new W.World(H,A,{minutes:6,seed:60+k,difficultyHome:'pro',difficultyAway:d});let n=0;while(!w.done&&n<60*60*12){w.step();n++;if(w.phase==='break')w.resume();}gf+=w.score[0]-w.score[1];}goalsBy[d]=gf;}
 ok(goalsBy.beginner>=goalsBy.legend,`IA Iniciante sofre mais que a Lendária (saldo do adversário: ${goalsBy.beginner} vs ${goalsBy.legend})`);}
console.log(`WORLD TEST PASS (${checks} verificações)`);
