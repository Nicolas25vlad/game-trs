'use strict';
/* Física do mundo contínuo, isolada: bola (queda, rolagem, efeito, trave, travessão, linha do gol) e corpos dos atletas.
   Cada caso monta a situação à mão e chama só o pedaço da física envolvido, sem IA nem árbitro no meio. */
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

console.log('Bola:');
{const w=newWorld();const b=put(w,{x:0,y:2,z:0});let t=0;while(b.y>BR+1e-3&&t<3){w.ballStep();t+=DT;}
 const ideal=Math.sqrt(2*(2-BR)/9.81);
 ok(Math.abs(t-ideal)<.03,`queda livre de 2 m chega ao chão em ${t.toFixed(3)} s (sem ar: ${ideal.toFixed(3)} s)`);}
{const w=newWorld();const b=put(w,{x:-40,y:BR,z:0,vx:10});const n=fly(w,12,b=>b.vx<=0);
 /* referência: integra dv/dt = -(ROLL_DEC + ROLL_DEC_V·v) analiticamente */
 const a=PHYS.ROLL_DEC,k=PHYS.ROLL_DEC_V,ref=(10/k)-(a/(k*k))*Math.log(1+k*10/a);
 ok(Math.abs((b.x+40)-ref)<.25,`passe rasteiro a 10 m/s rola ${(b.x+40).toFixed(2)} m e para (modelo: ${ref.toFixed(2)} m)`);
 ok(n*DT<6,`e para em ${(n*DT).toFixed(1)} s`);}
{/* efeito lateral: a direção gira a uma taxa que não depende da velocidade (Magnus ∝ v) */
 const turn=v=>{const w=newWorld();const b=put(w,{x:-30,y:1.5,z:0,vx:v,vy:4,spin:3});fly(w,.4);return Math.atan2(b.vz,b.vx);};
 const t12=turn(12),t24=turn(24);
 ok(t12>.03&&t24>.03,`efeito positivo curva a bola para +z (${(t12*57.3).toFixed(1)}° e ${(t24*57.3).toFixed(1)}° em 0,4 s)`);
 ok(Math.abs(t12-t24)<.012,'o giro da direção é igual a 12 e a 24 m/s (bola lenta curva menos em metros)');
 const w=newWorld();const b=put(w,{x:-30,y:1.5,z:0,vx:20,vy:3,spin:-3});fly(w,.4);ok(b.vz<-.2,'efeito negativo curva para -z');
 const sp0=20;const w2=newWorld();const b2=put(w2,{x:-30,y:30,z:0,vx:sp0,spin:6});w2.ballStep();
 const drag=1-PHYS.AIR_DRAG*sp0*DT;ok(Math.abs(Math.hypot(b2.vx,b2.vz)-sp0*drag)<.02,'o efeito só muda a direção, não cria velocidade');}
{/* topspin derruba, backspin sustenta */
 const apex=top=>{const w=newWorld();const b=put(w,{x:-30,y:BR,z:0,vx:22,vy:7,topspin:top});let m=0;fly(w,1.6,b=>{m=Math.max(m,b.y);return b.vy<0&&b.y<1;});return m;};
 const flat=apex(0),top=apex(3),back=apex(-2);
 ok(top<flat-.15&&back>flat+.1,`altura máxima: topspin ${top.toFixed(2)} m < sem efeito ${flat.toFixed(2)} m < backspin ${back.toFixed(2)} m`);}

console.log('Traves e linha do gol:');
{const w=newWorld();const P=w.P;
 for(const v of [10,15,20,25,30,35]){let hit=0;const N=40;
  for(let i=0;i<N;i++){const off=i/N*DT*v;const b=put(w,{x:P.L-6-off,y:.6,z:P.goalHalfW,vx:v});
   fly(w,1,b=>b.vx<0||b.x>P.L+1);if(b.vx<0)hit++;}
  ok(hit===N,`chute a ${v} m/s no meio da trave rebate nas ${N} fases de chegada`);}
 /* sai de 1,5 m já compensando a queda até a linha, para chegar na altura do centro do travessão */
 let hit=0;for(let i=0;i<40;i++){const v=30,off=i/40*DT*v,t=(1.5+off)/v;const b=put(w,{x:P.L-1.5-off,y:P.goalH+4.905*t*t,z:0,vx:v,vy:0});
  fly(w,.6,b=>b.vx<0||b.x>P.L+1);if(b.vx<0)hit++;}
 ok(hit===40,'chute a 30 m/s na altura do travessão rebate nas 40 fases');}
{/* o gol é decidido onde a bola cruza a linha: bola rápida e em diagonal que cruza dentro do gol e termina fora dele */
 const w=newWorld(3);w.phase='play';w.restart=null;const P=w.P,s0=w.score.slice();
 const vz=30,vx=30;const zc=P.goalHalfW-.2;/* cruza a 0,2 m da trave */
 const b=put(w,{x:P.L+BR-vx*DT*.1,y:1,z:zc-vz*DT*.1,vx,vz,vy:0});b.lastTeam=0;b.last=null;
 w.ballStep();w.checkBall();
 ok(b.cross&&Math.abs(b.cross.z-zc)<.02,`cruzamento da linha registrado em z=${b.cross&&b.cross.z.toFixed(2)} (fim do passo em z=${b.z.toFixed(2)})`);
 ok(w.score[0]+w.score[1]===s0[0]+s0[1]+1,'bola que cruzou entre as traves é gol, mesmo terminando o passo fora da largura do gol');}

console.log('Corpos dos atletas:');
const duel=(sa,sb,seed)=>{const w=newWorld(seed);w.phase='play';const p=w.teams[0].players[5],q=w.teams[1].players[5];
 for(const r of w.all())if(r!==p&&r!==q){r.x=0;r.z=60;r.off=true;}
 Object.assign(p,{x:-3,z:0,vx:0,vz:0,f:0,down:0,lock:0});Object.assign(q,{x:3,z:0,vx:0,vz:0,f:Math.PI,down:0,lock:0});
 if(sa!=null)p.a={...p.a,strength:sa,balance:sa};if(sb!=null)q.a={...q.a,strength:sb,balance:sb};
 let minD=99;for(let k=0;k<120;k++){p.ai.want={vx:6,vz:0};q.ai.want={vx:-6,vz:0};p.ai.face=q.ai.face=null;w.movePlayer(p);w.movePlayer(q);w.bodies();minD=Math.min(minD,Math.hypot(p.x-q.x,p.z-q.z));}
 return{p,q,minD,mid:(p.x+q.x)/2};};
{const {p,q,minD}=duel();
 ok(minD>=2*PHYS.BODY_R-.01,`dois atletas correndo de frente não se atravessam (distância mínima ${minD.toFixed(2)} m)`);
 ok(p.x<q.x,'e cada um continua do seu lado');}
{const {mid}=duel(.95,.2);ok(mid>.3,`o mais forte empurra o mais fraco (ponto de contato andou ${mid.toFixed(2)} m)`);}
{const minDist=ps=>{let m=99;for(let i=0;i<ps.length;i++)for(let j=i+1;j<ps.length;j++)m=Math.min(m,Math.hypot(ps[i].x-ps[j].x,ps[i].z-ps[j].z));return m;};
 const w=newWorld(4);w.phase='play';const ps=w.onPitch(0).concat(w.onPitch(1));const r=MD.U.rng(9);
 for(const p of ps){const a=r()*6.283,d=Math.sqrt(r())*2;p.x=Math.cos(a)*d;p.z=Math.sin(a)*d;p.vx=p.vz=0;}
 for(let k=0;k<60;k++)w.bodies();/* 1 s de jogo */
 const m=minDist(ps);ok(m>2*PHYS.BODY_R*.95,`aglomerado de 22 atletas num círculo de 2 m se acomoda em 1 s (menor distância ${m.toFixed(2)} m)`);
 for(const p of ps){p.x=0;p.z=0;}w.bodies();
 ok(ps.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.z))&&minDist(ps)>0,'atletas exatamente no mesmo ponto são separados sem gerar NaN');}

console.log('Movimento:');
{/* marcador andando de costas abaixo do limite de "virar e correr": fica de frente e preso ao teto de costas */
 const run=face=>{const w=newWorld(5);const p=w.teams[0].players[6];const S=w.speeds(p);Object.assign(p,{x:0,z:0,vx:0,vz:0,f:0,down:0,lock:0});
  for(let k=0;k<150;k++){p.ai.want={vx:-S.run*.79,vz:0};p.ai.face=face;w.movePlayer(p);}return{sp:p.sp,f:p.f,cap:PHYS.BACK_SPEED*S.sprint,want:S.run*.79};};
 const back=run(0),free=run(null);
 ok(Math.abs(back.f)<.05&&back.sp<=back.cap+.05,`de costas e olhando o lance: ${back.sp.toFixed(2)} m/s, no teto de ${back.cap.toFixed(2)} m/s, sem virar`);
 ok(free.sp>back.sp+.1&&Math.abs(free.sp-free.want)<.05,`sem precisar olhar o lance, vira e chega aos ${free.sp.toFixed(2)} m/s pedidos`);}
{const w=newWorld(6);const p=w.teams[0].players[6];const S=w.speeds(p);Object.assign(p,{x:0,z:0,vx:0,vz:0,f:0,down:0,lock:0});
 for(let k=0;k<200;k++){p.ai.want={vx:-S.sprint,vz:0};p.ai.face=0;w.movePlayer(p);}
 ok(Math.abs(Math.abs(p.f)-Math.PI)<.3&&p.sp>S.sprint*.9,'pedido de sprint para trás: o atleta vira e corre, mesmo marcando de frente');}
{const w=newWorld(7);const p=w.teams[0].players[6];const want={vx:-12,vz:0};Object.assign(p,{x:0,z:0,vx:0,vz:0,f:0,down:0,lock:0});
 p.ai.want=want;p.ai.face=0;w.movePlayer(p);ok(want.vx===-12,'os limites de velocidade não alteram a intenção guardada pela IA');}

console.log('Determinismo:');
{const sim=()=>{const w=newWorld(42);for(let i=0;i<60*60;i++){w.step();if(w.phase==='break')w.resume();}return JSON.stringify([w.score,w.ball.x.toFixed(6),w.ball.z.toFixed(6),w.stats[0].passes]);};
 ok(sim()===sim(),'mesma semente, mesmo minuto de jogo bit a bit');}

console.log(`\nPHYSICS TEST PASS (${checks} verificações)`);
