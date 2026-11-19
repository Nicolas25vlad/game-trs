/* MATCHDAY 0.5 — arquibancada de madeira do Germinare (componente independente).
   Ainda não há fotografia da arquibancada real: este é um modelo provisório, simples e otimizado, coerente com o
   ambiente escolar. Para substituir, basta trocar este arquivo (ou ajustar CONFIG): o cenário só usa
   MD.Bleacher.build(builder, config) e os assentos devolvidos para posicionar os espectadores. */
(function(MD){
'use strict';
const U=MD.U,h=U.hex2rgb;
const BL={};
/* x,z: centro da frente da arquibancada; dirZ: +1 = degraus sobem em direção a +z (de costas para o campo em z<0) */
BL.CONFIG={x:-6,z:15.6,dirZ:1,length:15,rows:5,rise:.42,run:.8,wood:'#a8723f',frame:'#5a3a22',metal:'#8d969c'};
BL.build=function(b,cfg){const c={...BL.CONFIG,...(cfg||{})};const wood=h(c.wood),wood2=h('#8f5f33'),frame=h(c.frame),metal=h(c.metal);const s=c.dirZ;const seats=[];
 const x0=c.x-c.length/2,x1=c.x+c.length/2;
 for(let r=0;r<c.rows;r++){const y=.46+r*c.rise,z=c.z+s*(r*c.run);
  /* assento (2 tábuas) e espelho do degrau */
  b.box(c.x,y,z+s*.12,c.length,.06,.22,wood,12);b.box(c.x,y,z-s*.12,c.length,.06,.2,wood2,12);
  b.box(c.x,y-c.rise*.5,z-s*.24,c.length,c.rise,.04,wood2.map(v=>v*.85),12);
  /* lugares para os espectadores (um a cada ~0,75 m) */
  for(let x=x0+.5;x<=x1-.4;x+=.75)seats.push([x+(Math.sin(x*7.3+r)*.12),y+.02,z+s*.05,r]);}
 /* estrutura: pilares e travessas a cada 2,5 m */
 const top=.46+(c.rows-1)*c.rise,zEnd=c.z+s*((c.rows-1)*c.run);
 for(let x=x0+.15;x<=x1;x+=2.5){for(let r=0;r<c.rows;r++){const y=.46+r*c.rise,z=c.z+s*(r*c.run);b.box(x,y/2,z,.14,y,.14,frame,12);}
  b.tube([x,.05,c.z],[x,top,zEnd],.05,frame,6,12);}
 /* guarda-corpo traseiro e laterais (metálicos) */
 b.tube([x0,top+1.0,zEnd+s*.25],[x1,top+1.0,zEnd+s*.25],.035,metal,6);for(let x=x0;x<=x1+.01;x+=2.5)b.tube([x,top,zEnd+s*.25],[x,top+1.0,zEnd+s*.25],.03,metal,6);
 for(const x of [x0-.1,x1+.1]){b.tube([x,.9,c.z],[x,top+1.0,zEnd+s*.25],.035,metal,6);}
 /* escadinha lateral */
 for(let r=0;r<c.rows;r++){const y=.23+r*c.rise,z=c.z+s*(r*c.run-.2);b.box(x1+.55,y,z,.8,.06,.32,wood,12);b.box(x1+.55,y/2,z,.8,y,.04,frame,12);}
 return{seats,front:c.z,config:c};};
MD.Bleacher=BL;
})(window.MD=window.MD||{});
