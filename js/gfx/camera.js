/* MATCHDAY 0.5 — diretor de câmera de transmissão.
   Planos: principal de TV, lateral baixa, atrás do gol, pênalti, close no rosto, acompanhando o artilheiro,
   câmera da bandeirinha, aérea e plano aberto do grupo. Suavização exponencial, cortes só em mudanças de plano
   marcadas e limites que impedem a câmera de atravessar arquibancadas ou o gramado. */
(function(MD){
'use strict';
const U=MD.U,clamp=U.clamp,lerp=U.lerp;
const CAM={};
CAM.LABEL={auto:'AUTO',tv:'TV',dynamic:'DINÂMICA',close:'PRÓXIMA',wide:'AMPLA',aerial:'AÉREA',player:'ATRÁS DO JOGADOR',goal:'ATRÁS DO GOL'};
CAM.USER=['auto','tv','dynamic','close','wide','aerial','player','goal'];
class Director{
 constructor(){this.eye=[0,30,60];this.tgt=[0,0,0];this.fov=40;this.init=false;this.lastSeg=null;this.bounds=null;}
 reset(){this.init=false;this.lastSeg=null;}
 /* s: amostra do quadro {ball:[x,y,z], actors:[{x,y,z,f}] , goalSide}; segs: plano de câmera da trilha */
 update(dt,t,s,segs,userMode,replayCam){let seg=null;if(segs)for(const c of segs){if(c.t<=t+1e-6&&(c.until===undefined||t<=c.until))seg=c;}
  let mode=seg?seg.mode:'broadcast';let cut=false;
  const scripted=seg&&(seg.mode==='path'||seg.mode==='orbit'||seg.mode==='kickoff'||seg.lock);
  if(userMode&&userMode!=='auto'&&!scripted){mode={tv:'broadcast',dynamic:'dynamic',close:'side_low',goal:'behind_goal',aerial:'aerial',wide:'wide',player:'behind_player'}[userMode]||'broadcast';seg={mode};}
  if(replayCam){mode=replayCam;seg={mode};}
  if(seg!==this.lastSeg){if(seg&&seg.cut)cut=true;if(this.lastSeg&&seg&&(seg.mode!==this.lastSeg.mode)&&['face','corner_flag','penalty','ref','wide_group','follow_player','behind_goal','corner','freekick'].includes(mode))cut=true;this.lastSeg=seg;}
  if(s.cut)cut=true;
  const b=s.ball,gs=s.goalSide||1;const PT=MD.Rules.PITCH,L=PT.L,W=PT.W,sm=!!PT.small,sx=L/54;let eye,tgt,fov;let free=false;const A=i=>s.actors[i]||null;const a=seg&&seg.a!==undefined?A(seg.a):null;
  switch(mode){
   case'side_low':{const p=a||{x:b[0],z:b[2],f:0};eye=[p.x-gs*7,3.2,p.z+12.5];tgt=[p.x+gs*1.5,1,p.z];fov=38;break;}
   case'behind_goal':eye=[gs*(L+(sm?6:9)),sm?3.2:4.6,clamp(b[2]*.25,-6,6)];tgt=[b[0]-gs*4*sx,1,b[2]*.8];fov=sm?46:40;break;
   case'penalty':eye=[gs*(L-PT.penSpot-12*sx),sm?2.6:4.4,-3.2*sx];tgt=[gs*L,1.1*Math.max(.8,PT.goalH/2.44),0];fov=sm?34:26;break;
   case'face':{const p=a||{x:b[0],z:b[2],f:0,hy:1.7};const hy=(p.hy||1.7);eye=[U.clamp(p.x+Math.cos(p.f)*3.2+Math.cos(p.f+1.57)*.8,-(L-1),L-1),hy+.2,U.clamp(p.z+Math.sin(p.f)*3.2+Math.sin(p.f+1.57)*.8,-(W-.5),W-.5)];tgt=[p.x+Math.cos(p.f)*.6,hy-.1,p.z+Math.sin(p.f)*.6];fov=30;break;}
   case'ref':{const p=a||{x:b[0],z:b[2],f:0};const q=seg.b!==undefined?A(seg.b):null;const cx=q?(p.x+q.x)/2:p.x,cz=q?(p.z+q.z)/2:p.z;eye=[cx+3.5,3.6,cz+8.5];tgt=[cx,1.3,cz];fov=34;break;}
   case'follow_player':{const p=a||{x:b[0],z:b[2],f:0};eye=[p.x-Math.cos(p.f)*7.5+Math.sin(p.f)*4,2.8,p.z-Math.sin(p.f)*7.5-Math.cos(p.f)*4];tgt=[p.x+Math.cos(p.f)*2,1.2,p.z+Math.sin(p.f)*2];fov=42;break;}
   case'corner_flag':{const fl=seg.flag||[gs*L,W];const p=a||{x:b[0],z:b[2]};eye=[fl[0]-Math.sign(fl[0])*1.2,1.35,fl[1]-Math.sign(fl[1])*1.6];tgt=[p.x,(p.hy||1.7)*.62,p.z];fov=42;break;}
   case'wide_group':{const p=a||{x:b[0],z:b[2]};eye=[p.x-gs*11,6.5,p.z+(p.z>0?-10:10)];tgt=[p.x,.9,p.z];fov=44;break;}
   case'corner':{const sd=(seg.side||1)*(gs>0?1:-1);eye=[gs*(L+5.5*sx+(sm?2:0)),sm?5:8.5,sd*(W+2+(sm?2:0))];tgt=[gs*(L-7.5*sx),.8,sd*3*sx];fov=38;break;}
   case'freekick':{const sp=seg.spot||[b[0],b[2]];const dx=gs*L-sp[0],dz=-sp[1],l=Math.hypot(dx,dz)||1;eye=[sp[0]-dx/l*(sm?7:11),sm?3.6:5.2,sp[1]-dz/l*(sm?7:11)];tgt=[gs*L,1.2,0];fov=38;break;}
   case'aerial':eye=[b[0]*.35,sm?42:92,b[2]*.2+.01];tgt=[b[0]*.6,0,b[2]*.4];fov=48;break;
   case'dynamic':{/* câmera dinâmica: atrás e acima da jogada, acompanhando o sentido do ataque */const vx=s.ballVx||0;const fwd=Math.abs(vx)>1?Math.sign(vx):gs;eye=[b[0]-fwd*(sm?9:15),sm?6:9,b[2]*.6+(sm?6:10)];tgt=[b[0]+fwd*(sm?3:6),.6,b[2]*.85];fov=sm?48:44;break;}
   case'wide':{eye=[b[0]*.55,sm?16:31,sm?W+16:W+34];tgt=[b[0]*.75,0,b[2]*.3];fov=sm?46:40;break;}
   case'behind_player':{const p=s.focus||{x:b[0],z:b[2]};const d=s.attackDir||1;eye=[p.x-d*(sm?7:11),sm?4.2:5.6,p.z*.85];tgt=[p.x+d*(sm?5:9),.7,p.z*.95];fov=sm?54:50;free=false;break;}
   case'kickoff':{eye=[-(sm?6:12),sm?7:11,W+(sm?7:13)];tgt=[0,.4,0];fov=sm?46:40;break;}
   case'path':{/* cinemática: trajeto de câmera com suavização */const u0=clamp((t-seg.t)/Math.max(.01,(seg.until??seg.t+4)-seg.t),0,1);const u=u0*u0*(3-2*u0);
    eye=[lerp(seg.e0[0],seg.e1[0],u),lerp(seg.e0[1],seg.e1[1],u),lerp(seg.e0[2],seg.e1[2],u)];tgt=[lerp(seg.g0[0],seg.g1[0],u),lerp(seg.g0[1],seg.g1[1],u),lerp(seg.g0[2],seg.g1[2],u)];
    if(seg.a!==undefined&&a){tgt=[a.x+(seg.off?seg.off[0]:0),(a.hy||1.7)*(seg.hk??.82),a.z+(seg.off?seg.off[2]:0)];}fov=lerp(seg.f0||40,seg.f1||seg.f0||40,u);free=true;break;}
   case'orbit':{/* gira em torno de um ator (ou ponto) */const c=a?[a.x,(a.hy||1.7)*.7,a.z]:(seg.c||[0,1,0]);const ang=(seg.ang0||0)+(t-seg.t)*(seg.w||.25);const r=seg.r||6;eye=[c[0]+Math.cos(ang)*r,c[1]+(seg.h||2),c[2]+Math.sin(ang)*r];tgt=c;fov=seg.f||38;free=!!seg.free;break;}
   default:{/* câmera principal de TV, com leve antecipação e zoom pela situação */const tight=seg&&seg.tight;const near=Math.abs(b[0])>L*.6;
    if(sm){eye=[b[0]*.7,tight?6.5:8.5,tight?W+8:W+11];tgt=[b[0]*.9+(s.ballVx||0)*.2,.4,b[2]*.4-.8];fov=tight?36:(near?40:44);}
    else{eye=[b[0]*.8,tight?13:17.5,tight?40:50];tgt=[b[0]*.93+(s.ballVx||0)*.3,.4,b[2]*.4-2];fov=tight?31:(near?35:38);}}}
  /* limites: nunca dentro das arquibancadas, do gramado ou da cobertura */
  if(!free){const B=this.bounds||{x:70,z:60,sx:59,sz:38.5};eye[0]=clamp(eye[0],-B.x,B.x);eye[2]=clamp(eye[2],-B.z,B.z);eye[1]=Math.max(eye[1],.45);
   if(Math.abs(eye[2])>B.sz)eye[1]=Math.max(eye[1],1.6+(Math.abs(eye[2])-B.sz)*.68);if(Math.abs(eye[0])>B.sx)eye[1]=Math.max(eye[1],1.6+(Math.abs(eye[0])-B.sx)*.66);}
  if(mode==='path'||mode==='orbit'){this.eye=eye.slice();this.tgt=tgt.slice();this.fov=fov;this.init=true;return this;}
  if(!this.init||cut){this.eye=eye.slice();this.tgt=tgt.slice();this.fov=fov;this.init=true;return this;}
  const k=1-Math.exp(-dt*(mode==='broadcast'?2.6:3.6)),kt=1-Math.exp(-dt*(mode==='broadcast'?3.4:5));
  for(let i=0;i<3;i++){this.eye[i]=lerp(this.eye[i],eye[i],k);this.tgt[i]=lerp(this.tgt[i],tgt[i],kt);}this.fov=lerp(this.fov,fov,k);return this;}
 orbit(yaw,pitch,dist,target){const cy=Math.cos(pitch);this.eye=[target[0]+Math.sin(yaw)*cy*dist,target[1]+Math.sin(pitch)*dist,target[2]+Math.cos(yaw)*cy*dist];this.tgt=target.slice();return this;}
}
CAM.Director=Director;
MD.Camera=CAM;
})(window.MD=window.MD||{});
