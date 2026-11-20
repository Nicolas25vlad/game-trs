'use strict';
/* Engine da partida: isolamento entre partidas, reação ao passe, saída de bola dentro da regra e recepção assistida.
   Cada caso monta a situação à mão; os de fluxo rodam o mundo inteiro (IA e árbitro) por poucos segundos. */
const assert=require('node:assert/strict');
const FILES=['js/util.js','js/modes.js','js/data.js','data/catalog_br_2026.js','js/catalog.js','js/rules.js','js/germinare.js','js/tournament.js','js/football/world.js','js/football/physics.js','js/football/actions.js','js/football/referee.js','js/football/restarts.js','js/football/ai.js'];
const MD=require('./load.cjs')(FILES,{window:true});
const {clubs}=MD.Catalog.load();const W=MD.World,PHYS=W.PHYS,DT=W.DT,BR=W.BALL_R;
const H=clubs.find(c=>c.id==='br-flamengo'),A=clubs.find(c=>c.id==='br-corinthians');
let checks=0;const ok=(c,msg)=>{assert.ok(c,msg);checks++;console.log('  ✓ '+msg);};
const newWorld=seed=>new W.World(H,A,{minutes:10,seed:seed||1});
/* bola livre, sem dono, em (x,y,z) com velocidade (vx,vy,vz) */
const put=(w,o)=>{const b=w.ball;Object.assign(b,{owner:null,frozen:false,inNet:false,spin:0,topspin:0,cross:null,vx:0,vy:0,vz:0},o);return b;};
const fly=(w,secs,stop)=>{const n=Math.round(secs/DT);for(let i=0;i<n;i++){w.ballStep();if(stop&&stop(w.ball))return i+1;}return n;};

console.log('Partida isolada:');
{/* campo e regras são de cada partida: abrir um jogo do Germinare não muda o campo de um jogo profissional em andamento */
 const pro=newWorld(10);const L0=pro.P.L;const g=new W.World(H,A,{minutes:4,seed:11,mode:'germinare',germ:{minutes:4,goalsToWin:2}});
 ok(pro.P.L===L0&&pro.P.L>50&&g.P.L<25,`campo do jogo profissional continua com ${pro.P.L} m de meio-comprimento; o do Germinare tem ${g.P.L} m`);
 ok(pro.offsideOn===true&&g.offsideOn===false,'impedimento continua valendo no profissional e desligado no Germinare');}

console.log('Reação ao passe:');
{const setup=dist=>{const w=newWorld(12);w.phase='play';w.restart=null;const p=w.teams[0].players[6],q=w.teams[1].players[6];
  for(const r of w.all())if(r!==p&&r!==q){r.x=-50;r.z=r.team?30:-30;}
  /* passador com o bloqueio de toque que pass() aplica; adversário a 1,3 m à frente, onde a bola chega em ~0,06 s */
  Object.assign(p,{x:-10,z:0,vx:0,vz:0,f:0,down:0,lock:0,touchCool:1e9});Object.assign(q,{x:-8.7,z:dist,vx:0,vz:0,f:Math.PI,down:0,lock:0,touchCool:0,a:{...q.a,agility:.5}});
  const b=put(w,{x:-10.3,y:BR,z:0,vx:16});b.lastKick={by:p.id,team:0,t:w.time,kind:'ground'};w.intended=null;b.lastTeam=0;
  let got=null;const g0=w.gain.bind(w);w.gain=(pl,how)=>{got=got||pl;return g0(pl,how);};for(let i=0;i<14;i++){w.time+=DT;w.ballStep();w.contacts();if(b.owner||got||b.vx<15)break;}return{got,q,w};};
 const near=setup(.75);ok(!near.got&&near.w.ball.vx>15,`adversário a 0,75 m da linha, logo depois do passe, não alcança a bola (reage em ${near.w.reactTime(near.q).toFixed(2)} s)`);
 const body=setup(.2);ok(body.got===body.q||body.w.ball.vx<15,'mas com o corpo no caminho, a bola bate nele');}

console.log('Saída de bola:');
{for(const [mode,o] of [['pro',{}],['germinare',{mode:'germinare',germ:{minutes:4,goalsToWin:2}}]]){
  const w=new W.World(H,A,{minutes:4,seed:21,...o}),R=(w.P.arcR||9.15);let bad=[];
  const check=lbl=>{for(const t of [0,1])for(const p of w.onPitch(t)){const own=w.teams[t].dir*p.x<=.01,out=t===w.restart.team||Math.hypot(p.x,p.z)>=R-.05;if(!own||!out)bad.push(`${lbl} ${p.id} (${p.x.toFixed(1)},${p.z.toFixed(1)})`);}};
  check('início');for(let i=0;i<90;i++){w.step();if(w.phase!=='kickoff')break;check(`t=${w.time.toFixed(2)}`);}
  ok(bad.length===0,`${mode}: na saída todos ficam no próprio campo e quem não dá a saída fica fora do círculo de ${R} m`+(bad.length?` — ${bad.slice(0,3).join('; ')}`:''));}}

console.log('Recepção assistida:');
{/* humano que vai receber o passe e não mexe no direcional corre de encontro à bola (antes ficava parado) */
 const cmd=o=>({...W.emptyCmd(),...o});const run=(w,secs)=>{const n=Math.round(secs/DT);for(let i=0;i<n&&!w.done;i++){w.step();if(w.phase==='break')w.resume();}};
 let okN=0;const N=12;for(let s=0;s<N;s++){const w=new W.World(H,A,{minutes:10,seed:4230+s});w.addHuman({id:'p1',side:'home'});run(w,2);
  w.setCommand('p1',cmd({pass:true}));run(w,.08);w.setCommand('p1',cmd({}));run(w,2.5);if(w.stats[0].passOk>=1)okN++;}
 ok(okN===N,`passe de saída do humano, sem tocar no direcional depois, chega ao companheiro em ${okN}/${N} sementes`);}

console.log(`
ENGINE TEST PASS (${checks} verificações)`);
