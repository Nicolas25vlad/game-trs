/* TRS26 — MUNDO DE PARTIDA · FÍSICA: atletas (velocidades, inércia, giro, corpos, fadiga) e bola (subpassos, ar, rolagem, efeito de Magnus,
   quique, traves, travessão, rede, condução). Constantes em MD.World.PHYS.
   Métodos de MD.World.World, separados de world.js por assunto; carregar depois de world.js. */
(function(MD){
'use strict';
const W=MD.World;const {U,D,clamp,lerp,PI,hyp,DT,G,BR,PHYS,n01,angDiff,goTo,emptyCmd}=W._k;
W.extend({
 /* ---------------- movimento dos jogadores (inércia, giro, fadiga) ---------------- */
 speeds(p){const a=p.a,fat=.8+.2*p.stamina;return{walk:1.7,jog:3.9+a.pace*.6,run:(5.6+a.pace*1.6)*fat,sprint:(6.9+a.pace*2.4)*fat,acc:(4.6+a.accel*4.2)*(.85+.15*p.stamina),turn:7+a.agility*5};},
 movePlayer(p){const now=this.time;let dx=p.ai.tx-p.x,dz=p.ai.tz-p.z;const S=this.speeds(p);
  let vx=0,vz=0,wantSp=0,wantDir=null;
  if(p.down>now||p.lock>now){/* no chão ou executando ação travada: desacelera (o carrinho mantém o embalo) */const k=p.act&&p.act.clip==='slide'?1.6:6;vx=p.vx*Math.max(0,1-DT*k);vz=p.vz*Math.max(0,1-DT*k);p.vx=vx;p.vz=vz;}
  else{let want=p.ai.want;/* {vx,vz} velocidade desejada (humano/IA); senão vai ao alvo */
   if(!want){const d=hyp(dx,dz);const urgency=p.ai.speed||'jog';const top=urgency==='sprint'?S.sprint:urgency==='run'?S.run:urgency==='walk'?S.walk:S.jog;
    const sp=d<.35?0:Math.min(top,d*2.2);want={vx:d>0?dx/d*sp:0,vz:d>0?dz/d*sp:0};}
   want={vx:want.vx,vz:want.vz};/* cópia: os limites abaixo não podem alterar a intenção guardada pela IA */
   let wv=hyp(want.vx,want.vz);const owner=this.ball.owner===p;const capF=owner?(.86+.08*p.a.dribbling):1;const cap=S.sprint*capF;if(wv>cap){want.vx*=cap/wv;want.vz*=cap/wv;wv=cap;}
   wantSp=wv;if(wv>.5){wantDir=Math.atan2(want.vz,want.vx);
    /* de lado ou de costas não se corre como de frente: 100% de frente, ~85% de lado, BACK_SPEED de costas */
    const off=Math.abs(angDiff(wantDir,p.f)),dc=S.sprint*(1-(1-PHYS.BACK_SPEED)*U.smooth((off-.5)/(PI-.5)));if(wv>dc){want.vx*=dc/wv;want.vz*=dc/wv;wv=dc;}}
   /* aceleração limitada: inércia; frear é mais rápido que acelerar */
   const ddx=want.vx-p.vx,ddz=want.vz-p.vz,dl=hyp(ddx,ddz);const braking=wv<p.sp-.3;const amax=S.acc*(braking?1.6:1)*DT;
   if(dl>amax){p.vx+=ddx/dl*amax;p.vz+=ddz/dl*amax;}else{p.vx=want.vx;p.vz=want.vz;}}
  p.x+=p.vx*DT;p.z+=p.vz*DT;p.sp=hyp(p.vx,p.vz);p.dist+=p.sp*DT;
  /* limites (fora do campo só até a área técnica) */const L=this.P.L,Wd=this.P.W;p.x=clamp(p.x,-L-4,L+4);p.z=clamp(p.z,-Wd-3,Wd+3);
  /* orientação: corpo segue o movimento; parado, olha para a bola ou para o alvo de ação */
  /* quem precisa correr forte para longe de onde olha vira e corre, em vez de ir de costas */
  const face=p.ai.face!==undefined&&p.ai.face!==null&&!(wantDir!==null&&wantSp>S.run*.8&&Math.abs(angDiff(p.ai.face,wantDir))>1.9);
  let tf=p.f;if(face)tf=p.ai.face;else if(p.sp>.6)tf=Math.atan2(p.vz,p.vx);else tf=Math.atan2(this.ball.z-p.z,this.ball.x-p.x);
  const rate=(p.sp>6.5?S.turn*.55:S.turn)*(this.ball.owner===p?.8:1)*DT;const d=angDiff(tf,p.f);p.f=U.wrapAngle(p.f+clamp(d,-rate,rate));p.turn=clamp(d,-rate,rate)/DT;
  if(p.act&&now>p.act.t1)p.act=null;}
 /* Corpos: dois atletas não ficam a menos de 2·BODY_R. A sobreposição é desfeita pela massa (força, equilíbrio,
    proteção de bola) e a velocidade de aproximação some no choque (inelástico): quem é mais forte cede menos. */,
 bodies(){const now=this.time,R2=PHYS.BODY_R*2,ps=this._bodies||(this._bodies=[]);ps.length=0;
  for(const p of this.all())if(!p.off&&!(p.down>now))ps.push(p);
  for(let i=0;i<ps.length;i++){const a=ps[i];for(let j=i+1;j<ps.length;j++){const c=ps[j];let dx=c.x-a.x,dz=c.z-a.z;
   if(dx>=R2||dx<=-R2||dz>=R2||dz<=-R2)continue;let d=hyp(dx,dz);if(d>=R2)continue;
   let pen=R2-d;if(d<1e-6){dx=Math.cos(a.f);dz=Math.sin(a.f);d=1;pen=R2;}/* mesmo ponto: separa pela frente de a (determinístico) */
   const nx=dx/d,nz=dz/d,ma=this.bodyMass(a),mc=this.bodyMass(c),sa=mc/(ma+mc),sc=ma/(ma+mc);
   a.x-=nx*pen*sa;a.z-=nz*pen*sa;c.x+=nx*pen*sc;c.z+=nz*pen*sc;
   const vn=(c.vx-a.vx)*nx+(c.vz-a.vz)*nz;if(vn<0){const J=-vn/(1/ma+1/mc);a.vx-=J/ma*nx;a.vz-=J/ma*nz;c.vx+=J/mc*nx;c.vz+=J/mc*nz;a.sp=hyp(a.vx,a.vz);c.sp=hyp(c.vx,c.vz);}}}},
 bodyMass(p){return(68+24*p.a.strength+8*p.a.balance)*(p.shield>this.time?1.35:1);},
 fatigue(){const k=1/Math.max(240,this.realLen);for(const p of this.all()){if(p.off)continue;const S=p.sp;const st=.4+.6*(1-p.a.stamina);let d=S>7?3.2:S>5?1.5:S>3?.55:-.35;p.stamina=clamp(p.stamina-d*k*st*DT*.9,0,1);p.view.info.energy=p.stamina;}}
 /* ---------------- física da bola ---------------- */
 /* Subpassos: a bola nunca anda mais que PHYS.SUB_STEP por vez, então um chute forte não atravessa trave nem travessão,
    e o ponto exato em que ela cruza a linha de fundo fica registrado em b.cross (usado para decidir o gol). */,
 ballStep(){const b=this.ball;b.cross=null;if(b.frozen)return;
  if(b.owner){const o=b.owner;this.dribbleBall(o);b.heading=o.f;return;}
  const n=Math.min(PHYS.SUB_MAX,Math.max(1,Math.ceil(hyp(b.vx,b.vy,b.vz)*DT/PHYS.SUB_STEP))),h=DT/n;
  for(let i=0;i<n;i++){const x0=b.x,y0=b.y,z0=b.z;this.ballIntegrate(h);this.lineCross(x0,y0,z0);this.goalFrame();}
  const hs=hyp(b.vx,b.vz);if(hs>.05)b.heading=Math.atan2(b.vz,b.vx);b.roll+=hs*DT/BR;}
 /* Um subpasso de bola livre (Euler semi-implícito).
    Efeito lateral (spin) e vertical (topspin > 0 desce, < 0 sustenta) seguem a força de Magnus, proporcional à velocidade:
    a curva gira a direção a uma taxa fixa (spin/SPIN_REF rad/s), então bola lenta curva menos em metros, como na vida real.
    b: a bola do jogo ou uma cópia {x,y,z,vx,vy,vz,spin,topspin} — a IA prevê trajetórias com esta mesma função. */,
 ballIntegrate(h,b){const real=!b;b=b||this.ball;
  const air=b.y>BR+.005||b.vy>.05;
  if(air){b.vy-=G*h;const sp=hyp(b.vx,b.vy,b.vz);const k=Math.max(0,1-PHYS.AIR_DRAG*sp*h);b.vx*=k;b.vy*=k;b.vz*=k;
   if(b.spin)this.turnBall(b.spin*h/PHYS.SPIN_REF,b),b.spin*=1-h*PHYS.SPIN_DECAY_AIR;
   if(b.topspin){b.vy-=b.topspin*hyp(b.vx,b.vz)/PHYS.SPIN_REF*h;b.topspin*=1-h*PHYS.SPIN_DECAY_AIR;}}
  else{const s=hyp(b.vx,b.vz);if(s>0){const ns=Math.max(0,s-(PHYS.ROLL_DEC+PHYS.ROLL_DEC_V*s)*h);b.vx*=ns/s;b.vz*=ns/s;}b.vy=0;b.y=BR;b.topspin=0;
   if(b.spin)this.turnBall(b.spin*PHYS.GROUND_SPIN*h/PHYS.SPIN_REF,b),b.spin*=1-h*PHYS.SPIN_DECAY_GROUND;}
  b.x+=b.vx*h;b.y+=b.vy*h;b.z+=b.vz*h;
  if(b.y<BR){b.y=BR;if(b.vy<-PHYS.BOUNCE_MIN_VY){b.vy=-b.vy*PHYS.BOUNCE;b.vx*=PHYS.BOUNCE_FRICTION;b.vz*=PHYS.BOUNCE_FRICTION;b.topspin=(b.topspin||0)*.5;if(real)this.fxAdd('bounce',{k:Math.min(1,-b.vy/8)});}else b.vy=0;}},
 /* cópia do estado da bola livre, para prever a trajetória sem mexer no jogo */
 ballCopy(){const b=this.ball;return{x:b.x,y:b.y,z:b.z,vx:b.vx,vy:b.vy,vz:b.vz,spin:b.spin||0,topspin:b.topspin||0};},
 /* gira a velocidade horizontal da bola em a radianos (sem ganhar nem perder energia) */
 turnBall(a,b){b=b||this.ball;const c=Math.cos(a),s=Math.sin(a),vx=b.vx;b.vx=vx*c-b.vz*s;b.vz=vx*s+b.vz*c;},
 /* guarda onde a bola (centro) cruzou a linha de fundo neste passo: a regra olha a bola inteira além da linha */
 lineCross(x0,y0,z0){const b=this.ball,lim=this.P.L+BR;if(b.cross||Math.abs(x0)>lim||Math.abs(b.x)<=lim)return;
  const gx=Math.sign(b.x)*lim,t=(gx-x0)/((b.x-x0)||1e-9);b.cross={x:gx,y:y0+(b.y-y0)*t,z:z0+(b.z-z0)*t};},
 /* condução: assistência de domínio com mola (a bola segue física, mas acompanha o pé), toques longos em velocidade */
 dribbleBall(p){const b=this.ball;const now=this.time;const ahead=.42+Math.min(.55,p.sp*.07);const ax=p.x+Math.cos(p.f)*ahead,az=p.z+Math.sin(p.f)*ahead;
  const ctl=p.a.ballControl*.6+p.a.dribbling*.4;
  /* em sprint, a bola é tocada à frente e fica solta por um instante (pode ser roubada) */
  if(p.sp>6.6&&now>p.touchCool&&!p.gk&&(this.phase==='play')){const push=1.22+(1-ctl)*.35;b.owner=null;b.vx=p.vx*push;b.vz=p.vz*push;b.y=BR;b.vy=0;p.touchCool=now+.42+ctl*.35;b.lastTouchT=now;this.fxAdd('touch',{});return;}
  const k=12+ctl*10;b.vx=p.vx+(ax-b.x)*k;b.vz=p.vz+(az-b.z)*k;b.vy=0;b.y=BR;b.x+=b.vx*DT;b.z+=b.vz*DT;b.roll+=hyp(b.vx,b.vz)*DT/BR;
  if(p.gk&&this.gkHolding===p){b.x=p.x+Math.cos(p.f)*.3;b.z=p.z+Math.sin(p.f)*.3;b.y=1.05;b.vx=b.vz=0;}},
 /* traves, travessão e rede */
 goalFrame(){const b=this.ball,P=this.P,L=P.L,gw=P.goalHalfW,gh=P.goalH,rp=.06+BR;
  for(const s of [-1,1]){const gx=s*L;if(Math.abs(b.x-gx)>2.2)continue;
   for(const pz of [-gw,gw]){const dx=b.x-gx,dz=b.z-pz;const d=hyp(dx,dz);if(d<rp&&b.y<gh+.06){const nx=dx/d,nz=dz/d;const vn=b.vx*nx+b.vz*nz;if(vn<0){const e=1+PHYS.POST_RESTITUTION;b.vx-=e*vn*nx;b.vz-=e*vn*nz;b.x=gx+nx*rp;b.z=pz+nz*rp;this.fxAdd('post',{});this.event('post',{});}}}
   if(Math.abs(b.z)<gw){const dx=b.x-gx,dy=b.y-gh;const d=hyp(dx,dy);if(d<rp){const nx=dx/d,ny=dy/d;const vn=b.vx*nx+b.vy*ny;if(vn<0){const e=1+PHYS.POST_RESTITUTION;b.vx-=e*vn*nx;b.vy-=e*vn*ny;b.x=gx+nx*rp;b.y=gh+ny*rp;this.fxAdd('post',{bar:true});this.event('post',{bar:true});}}}
   /* rede: bola dentro do gol perde energia e fica contida */
   if(s*b.x>L&&Math.abs(b.z)<gw+.2&&b.y<gh+.1&&b.inNet){const nd=P.netDepth||1.8;if(s*b.x>L+nd-BR){b.x=s*(L+nd-BR);b.vx*=-.15;b.vz*=.5;}if(Math.abs(b.z)>gw-BR){b.z=Math.sign(b.z)*(gw-BR);b.vz*=-.2;}if(b.y>gh-BR){b.y=gh-BR;b.vy*=-.1;}}}},
 /* ---------------- voo de passes: o mesmo modelo da bola, para quem passa e quem recebe ----------------
    Rolagem: dv/dt = -(a + k·v), com a = ROLL_DEC e k = ROLL_DEC_V. Distância e tempo entre as velocidades v0 e v1 têm
    forma fechada; a bola real anda em subpassos e fica ~0,3% aquém, o que não se vê em campo.
    As inversas usam Newton (4–6 iterações): a IA chama isto para cada adversário de cada opção de passe. */
 rollDist(v0,v1){const a=PHYS.ROLL_DEC,k=PHYS.ROLL_DEC_V;return(v0-v1)/k-(a/(k*k))*Math.log((a+k*v0)/(a+k*v1));},
 rollTime(v0,v1){const a=PHYS.ROLL_DEC,k=PHYS.ROLL_DEC_V;return Math.log((a+k*v0)/(a+k*v1))/k;},
 /* velocidade de saída para a bola rasteira chegar a d metros ainda com velocidade ve */
 rollSpeedFor(d,ve){const a=PHYS.ROLL_DEC,k=PHYS.ROLL_DEC_V;let v=Math.sqrt(ve*ve+2*(a+k*ve)*d);/* d(dist)/dv0 = v0/(a+k·v0) */
  for(let i=0;i<6;i++){const f=this.rollDist(v,ve)-d;v=Math.max(ve,v-f*(a+k*v)/v);if(Math.abs(f)<1e-4)break;}return v;},
 /* tempo para a bola rasteira lançada a v0 percorrer s metros (Infinity se parar antes) */
 rollTimeTo(v0,s){if(s<=0)return 0;const a=PHYS.ROLL_DEC,k=PHYS.ROLL_DEC_V,c=v0+a/k,tStop=Math.log(c*k/a)/k;
  const x=t=>c*(1-Math.exp(-k*t))/k-a*t/k;if(x(tStop)<=s)return Infinity;
  /* x(t) é côncava e crescente até parar: Newton a partir da esquerda converge sem passar da raiz */
  let t=s/v0;for(let i=0;i<5;i++){const v=c*Math.exp(-k*t)-a/k;t=Math.min(tStop,t+(s-x(t))/Math.max(v,1e-3));}return t;},
 /* passe rasteiro ou em profundidade: velocidade de saída, velocidade de chegada e tempo de voo até d metros.
    A chegada cresce com a distância (passe longo vem mais firme); firm escala a chegada (barra de força do humano). */
 groundPass(kind,d,firm){const ve=Math.max(1.5,(kind==='through'?clamp(2.5+.12*d,2.8,6):clamp(4+.25*d,5.6,11))*(firm||1)),v0=this.rollSpeedFor(d,ve);return{v0,ve,T:this.rollTime(v0,ve)};},
 /* passe alto: tempo de voo escolhido pelo tipo (define a altura); a força sai de loftFor */
 loftTime(kind,d){return clamp((kind==='cross'?.75:.6)+d/(kind==='long'?24:21),.7,2.6);},
 /* tempo até a bola chegar a d metros, para antecipar o receptor e medir o risco de interceptação */
 passTime(kind,d){return kind==='ground'||kind==='through'?this.groundPass(kind,d).T:this.loftTime(kind,d);},
 /* passe alto: direção, velocidade horizontal e vertical para a bola sair de (x0,y0,z0) e quicar pela primeira vez
    em (tx,tz) depois de ~T s. Voo simulado com ballIntegrate (arrasto e efeito incluídos) e corrigido 5 vezes. */
 loftFor(x0,y0,z0,tx,tz,T,spin){const d=Math.max(1,hyp(tx-x0,tz-z0)),want=Math.atan2(tz-z0,tx-x0);let ang=want,vh=d/T,vy=G*T/2-(y0-BR)/T;const h=DT/2;
  for(let it=0;it<5;it++){const s={x:x0,y:y0,z:z0,vx:Math.cos(ang)*vh,vy,vz:Math.sin(ang)*vh,spin:spin||0,topspin:0};let t=0;
   for(let i=0;i<1200;i++){const air=s.y>BR+.005||s.vy>.05;this.ballIntegrate(h,s);t+=h;if(air&&s.y<=BR+1e-9)break;}
   const ld=hyp(s.x-x0,s.z-z0)||1;vh*=d/ld;vy+=G*(T-t)/2;ang+=angDiff(want,Math.atan2(s.z-z0,s.x-x0));}
  return{ang,vh,vy};}
});
})(typeof window!=='undefined'?(window.MD=window.MD||{}):(globalThis.MD=globalThis.MD||{}));
