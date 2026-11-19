/* MATCHDAY 0.4 — Arena estilizada inspirada na Arena Barueri (azul e amarelo), sem o letreiro "BARUERI".
   Geometria estática construída uma única vez; torcida em sprites instanciados; bandeirões e bandeiras animados na GPU. */
(function(MD){
'use strict';
const U=MD.U,PI=Math.PI;
const S={};
const h=U.hex2rgb;
S.build=function(gl,opts){const b=new MD.GL.StaticBuilder();const blue=h('#215a92'),blue2=h('#2d6aa6'),yellow=h('#f2bd3a'),concrete=h('#9aa6ad'),dark=h('#11232b'),white=[.95,.97,.95],metal=h('#c9d4d8');
 /* entorno e pista */
 b.quad([-110,-.3,-90],[110,-.3,-90],[110,-.3,90],[-110,-.3,90],h('#132a2f'),0);
 b.quad([-61,-.02,-41],[61,-.02,-41],[61,-.02,41],[-61,-.02,41],h('#2a6a42'),0);
 /* gramado procedural */
 const nx=12,nz=8;for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){const x0=-58+i*116/nx,x1=x0+116/nx,z0=-38+j*76/nz,z1=z0+76/nz;b.quad([x0,0,z0],[x0,0,z1],[x1,0,z1],[x1,0,z0],[.2,.5,.27],1);}
 /* linhas */
 const L=(x0,z0,x1,z1,w=.12)=>{const dx=x1-x0,dz=z1-z0,l=Math.hypot(dx,dz)||1,ox=-dz/l*w/2,oz=dx/l*w/2;b.quad([x0+ox,.012,z0+oz],[x1+ox,.012,z1+oz],[x1-ox,.012,z1-oz],[x0-ox,.012,z0-oz],white,0);};
 const arc=(cx,cz,r,a0,a1,n=48)=>{for(let i=0;i<n;i++){const a=a0+(a1-a0)*i/n,c=a0+(a1-a0)*(i+1)/n;L(cx+Math.cos(a)*r,cz+Math.sin(a)*r,cx+Math.cos(c)*r,cz+Math.sin(c)*r);}};
 L(-54,-34,54,-34);L(-54,34,54,34);L(-54,-34,-54,34);L(54,-34,54,34);L(0,-34,0,34);arc(0,0,9.15,0,PI*2,64);arc(0,0,.18,0,PI*2,10);
 for(const s of [-1,1]){const gx=s*54;L(gx,-20.16,gx-s*16.5,-20.16);L(gx-s*16.5,-20.16,gx-s*16.5,20.16);L(gx-s*16.5,20.16,gx,20.16);L(gx,-9.16,gx-s*5.5,-9.16);L(gx-s*5.5,-9.16,gx-s*5.5,9.16);L(gx-s*5.5,9.16,gx,9.16);
  arc(gx-s*11,0,.16,0,PI*2,10);const a=Math.acos(5.5/9.15);arc(gx-s*11,0,9.15,s>0?PI-a:-a,s>0?PI+a:a,24);
  for(const z of [-34,34])arc(gx,z,1,s>0?(z>0?PI:PI/2):(z>0?-PI/2:0),s>0?(z>0?PI*1.5:PI):(z>0?0:PI/2),10);}
 /* gols: traves, rede (material 8 = deforma no vertex shader) */
 for(const s of [-1,1]){const gx=s*54,back=gx+s*2.2;for(const z of [-3.66,3.66]){b.tube([gx,0,z],[gx,2.44,z],.06,white,10,2);b.tube([gx,2.44,z],[back,2.0,z],.025,metal,6);b.tube([back,0,z],[back,2.0,z],.025,metal,6);}
  b.tube([gx,2.44,-3.72],[gx,2.44,3.72],.06,white,10,2);b.tube([back,2.0,-3.66],[back,2.0,3.66],.025,metal,6);
  const net=(p0,p1,p2,nu,nv)=>{for(let i=0;i<=nu;i++){const u=i/nu;const a=[p0[0]+(p1[0]-p0[0])*u,p0[1]+(p1[1]-p0[1])*u,p0[2]+(p1[2]-p0[2])*u];const c=[a[0]+p2[0]-p0[0],a[1]+p2[1]-p0[1],a[2]+p2[2]-p0[2]];b.tube(a,c,.009,white,3,8);}
   for(let j=0;j<=nv;j++){const v=j/nv;const a=[p0[0]+(p2[0]-p0[0])*v,p0[1]+(p2[1]-p0[1])*v,p0[2]+(p2[2]-p0[2])*v];const c=[a[0]+p1[0]-p0[0],a[1]+p1[1]-p0[1],a[2]+p1[2]-p0[2]];b.tube(a,c,.009,white,3,8);}};
  net([back,0,-3.66],[back,0,3.66],[back,2.0,-3.66],26,8);net([gx,2.44,-3.66],[gx,2.44,3.66],[back,2.0,-3.66],26,6);
  for(const z of [-3.66,3.66])net([gx,0,z],[back,0,z],[gx,2.44,z],7,9);}
 /* bandeirinhas de escanteio (mastro) */
 for(const x of [-54,54])for(const z of [-34,34])b.tube([x,0,z],[x,1.55,z],.025,[.95,.95,.9],6,2);
 /* placas de publicidade LED (rolagem pelo atlas) */
 const ad=(x0,z0,x1,z1,u0,u1)=>{b.quad([x0,0,z0],[x1,0,z1],[x1,.95,z1],[x0,.95,z0],[1,1,1],9,[[u0,1],[u1,1],[u1,0],[u0,0]]);};
 ad(-56,-37,56,-37,0,3);ad(56,37,-56,37,0,3);ad(-58,30,-58,-30,0,1.5);ad(58,-30,58,30,0,1.5);
 for(const z of [-37.1,37.1])b.box(0,.47,z+(z>0?.12:-.12),112.5,.95,.15,dark,0);
 /* banco de reservas, área técnica e túnel (lado z negativo) */
 for(const s of [-1,1]){b.box(s*10,.55,-39.4,9,1.1,1.6,h('#1b3647'),0);b.box(s*10,1.18,-39.6,9.4,.12,2.1,h('#9fd0ff'),0);b.box(s*10,.35,-39.1,8.6,.5,.6,h('#c74b3b'),0);
  b.quad([s*4.5,.013,-36],[s*15.5,.013,-36],[s*15.5,.013,-35.9],[s*4.5,.013,-35.9],white,0);}
 b.box(0,1.2,-41.5,6,2.4,4,h('#162a35'),0);b.box(0,2.5,-40.6,6.6,.3,2.4,yellow,0);
 /* arquibancadas: anel inferior em volta, anel superior nas laterais, faixas amarelas */
 const tier=(len,depth,z0,rows,y0,rise,run,side,axis)=>{for(let r=0;r<rows;r++){const y=y0+r*rise,zz=z0+r*run;const col=r%6===5?yellow:(r%2?blue:blue2);
   if(axis==='x'){b.box(0,y,side*zz,len,rise,run,col.map(v=>v*.92),0);b.box(0,y+rise*.5+.02,side*(zz-run*.3),len,.05,run*.22,col.map(v=>Math.min(1,v*1.18)),0);}
   else{b.box(side*zz,y,0,run,rise,len,col.map(v=>v*.92),0);b.box(side*(zz-run*.3),y+rise*.5+.02,0,run*.22,.05,len,col.map(v=>Math.min(1,v*1.18)),0);}}};
 for(const s of [-1,1]){tier(118,0,40.2,14,.9,.62,.95,s,'x');b.box(0,9.7,s*55.2,120,.6,3.2,concrete,0);tier(124,0,57.5,12,11,.72,1.05,s,'x');
  tier(76,0,61.5,13,.9,.62,.95,s,'z');}
 /* corners fechados */
 for(const sx of [-1,1])for(const sz of [-1,1]){for(let r=0;r<10;r++)b.box(sx*(62+r*.6),1+r*.62,sz*(43+r*.6),5.5,.62,5.5,r%5===4?yellow:blue,0);}
 /* coberturas e treliças nas laterais (identidade da arena) */
 for(const s of [-1,1]){b.box(0,22.5,s*65.5,140,.5,13,h('#24527e'),0);b.box(0,22.8,s*65.5,140,.15,13.2,h('#a8c2d2'),0);
  for(let i=0;i<8;i++){const x=-63+i*18;b.tube([x,10,s*71],[x,22.4,s*71.5],.35,metal,8);b.tube([x,22.4,s*59.2],[x,22.4,s*71.5],.22,metal,6);b.tube([x,22.4,s*59.2],[x,25.5,s*65.5],.18,metal,6);b.tube([x,25.5,s*65.5],[x,22.4,s*71.5],.18,metal,6);}
  b.box(0,23.6,s*59.1,140,1.2,.4,yellow,0);}
 /* torres azuis nos cantos */
 for(const x of [-80,80])for(const z of [-60,60]){b.box(x,13,z,6,26,6,blue,0);b.box(x,26.2,z,7.4,.5,7.4,h('#bed8e9'),0);for(let k=0;k<4;k++)b.box(x,6+k*5.5,z+(z>0?-3.05:3.05),5,.4,.15,yellow,0);}
 /* refletores */
 for(const x of [-70,70])for(const z of [-50,50]){b.tube([x,0,z],[x,31,z],.5,metal,8);b.box(x,32,z,7,3,.6,dark,0);for(let i=0;i<3;i++)for(let j=0;j<2;j++)b.box(x-2.2+i*2.2,31.3+j*1.4,z+(z>0?-.35:.35),1.8,1.1,.1,[1,1,.92],10);}
 /* telões e placar nos fundos */
 for(const s of [-1,1]){const x=s*72,y=18;b.box(x,y,0,1.2,9,17,dark,0);b.box(x+s*.4,y-6.5,0,1,4,1.2,metal,0);
  const fx=x-s*.62;b.quad([fx,y-3.6,-s*7.8],[fx,y-3.6,s*7.8],[fx,y+3.6,s*7.8],[fx,y+3.6,-s*7.8],[1,1,1],6,[[0,1],[1,1],[1,0],[0,0]]);
  b.box(x,y+4.9,0,1.4,.6,17.4,yellow,0);}
 const mesh=b.build(gl);return mesh;};
/* Torcida: posição de cada torcedor nos degraus; cores por setor (mosaicos atrás dos gols). */
S.crowd=function(count,home,away,seed){const r=U.rng(seed||7);const hp=h(home?.primary||'#2d6aa6'),hs=h(home?.secondary||'#ffffff'),ap=h(away?.primary||'#ff526a'),as=h(away?.secondary||'#ffffff');
 const neutral=[h('#e8e3d4'),h('#4f7eb5'),h('#2c3e50'),h('#d9b44a'),h('#8aa1b1'),h('#c75b4a')];const out=new Float32Array(count*8);let n=0;
 const put=(x,y,z,c,side)=>{if(n>=count)return;const o=n*8;out[o]=x;out[o+1]=y;out[o+2]=z;out[o+3]=r();out[o+4]=c[0];out[o+5]=c[1];out[o+6]=c[2];out[o+7]=side;n++;};
 const slots=[];
 for(const s of [-1,1]){for(let row=0;row<14;row++)slots.push({axis:'x',s,x0:-58,x1:58,z:s*(40.2+row*.95),y:.9+row*.62+.32,row,tier:0});for(let row=0;row<12;row++)slots.push({axis:'x',s,x0:-61,x1:61,z:s*(57.5+row*1.05),y:11+row*.72+.36,row,tier:1});
  for(let row=0;row<13;row++)slots.push({axis:'z',s,z0:-37,z1:37,x:s*(61.5+row*.95),y:.9+row*.62+.32,row,tier:0});}
 const per=Math.ceil(count/slots.length);
 for(const sl of slots){for(let k=0;k<per;k++){const u=(k+r()*.6)/per;
   if(sl.axis==='x'){const x=sl.x0+(sl.x1-sl.x0)*u,z=sl.z;let c=neutral[Math.floor(r()*neutral.length)],side=0;
     const homeSide=x<0;if(r()<.62){c=homeSide?(r()<.7?hp:hs):(r()<.7?ap:as);side=homeSide?0:1;}put(x,sl.y,z,c,side);}
   else{const z=sl.z0+(sl.z1-sl.z0)*u,x=sl.x;const homeEnd=sl.s<0;/* mosaico listrado atrás do gol */
     const stripe=Math.floor((z+37)/6)%2===0;let c=homeEnd?(stripe?hp:hs):(stripe?ap:as);if(r()<.08)c=neutral[0];put(x,sl.y,z,c,homeEnd?0:1);}}}
 return{data:out,count:n};};
/* Bandeirões, bandeiras de mão e bandeirinhas de escanteio: [origem xyz, yaw | largura, altura, amplitude, velocidade | cor1+seed | cor2+padrão] */
S.flags=function(home,away){const list=[];const hp=h(home.primary),hs=h(home.secondary),ap=h(away.primary),as=h(away.secondary);
 const add=(x,y,z,yaw,w,hh,amp,sp,c1,c2,pat)=>list.push([x,y,z,yaw,w,hh,amp,sp,c1[0],c1[1],c1[2],Math.random(),c2[0],c2[1],c2[2],pat]);
 /* bandeirões pendurados na frente do anel superior */
 for(let i=0;i<4;i++){add(-52+i*13,10.3,-56.2,0,9,4.2,.15,.6,hp,hs,i%2?1:2);add(4+i*13,10.3,-56.2,0,9,4.2,.15,.6,ap,as,i%2?2:1);}
 for(let i=0;i<4;i++){add(-52+i*13,10.3,56.2,PI,9,4.2,.15,.6,hp,hs,i%2?4:3);add(4+i*13,10.3,56.2,PI,9,4.2,.15,.6,ap,as,i%2?3:4);}
 /* bandeiras de mão na torcida */
 const r=U.rng(11);for(let i=0;i<48;i++){const s=r()<.5?-1:1,home2=r()<.5;const x=(home2?-1:1)*(6+r()*48);add(x,2.6+r()*7,s*(42+r()*10),s>0?PI:0,1.3,.85,.35,2+r(),home2?hp:ap,home2?hs:as,r()<.5?2:0);}
 /* bandeirinhas de escanteio */
 for(const x of [-54,54])for(const z of [-34,34])add(x,1.55,z,PI/2,.42,.32,.25,3,h('#ffd23f'),h('#ff3b30'),3);
 return list;};
MD.Stadium=S;
})(window.MD=window.MD||{});
