/* MATCHDAY 0.5 — cenário GERMINARE (campo da escola), a partir da fotografia enviada pelo usuário.
   Reproduz, em 3D estilizado, o que é visível na foto: gramado sintético verde sem marcações fortes, faixa de terra
   avermelhada entre o campo e a praça, piso de placas de concreto, o prédio escolar térreo branco (janelas escuras,
   portas com placas azuis, platibanda escura), árvores altas e esguias, floreiras de concreto com plantas,
   mesa com cadeiras, bancos, quadra com tabela de basquete, muro alto cinza, ônibus/veículos azuis, galpões
   ao fundo (um com faixa vermelha), postes de luz e de energia, e a mureta de pedra onde os alunos assistem.
   Medidas são APROXIMADAS (a foto não permite medir) e ficam todas em LAYOUT, para ajuste futuro.
   A arquibancada de madeira é um componente separado (bleacher.js). Espectadores são genéricos (sem rostos reais). */
(function(MD){
'use strict';
const U=MD.U,PI=Math.PI,h=U.hex2rgb;
const GS={};
GS.LAYOUT={
 field:{L:20,W:12.5,margin:1.4},
 strip:{depth:3.2,color:'#8a5f45'},            /* faixa de terra/pedrisco em frente ao prédio */
 plaza:{x0:-46,x1:46,z0:-24,z1:24},
 building:{x0:-38,x1:22,z:-21.5,depth:7,height:3.7,modules:['w','d','w','w','d','w','w','w','d','w','w','d','w','w','w','d','w','w','w','w']},
 trees:[[-31,-18.6,10.5],[-21,-19.2,12],[-9,-18.8,11],[2.5,-18.6,11.5],[12,-19,10],[18,-17.6,9]],
 planters:[[-27,-19.6],[-15.5,-19.7],[-4,-19.6],[7,-19.7],[15,-19.5]],
 table:[-12,-17.6],benches:[[-26,-16.8],[5,-16.9],[24,-16]],
 court:{x0:24,x1:42,z0:-17,z1:6,hoop:[37.5,-6]},
 wall:{x0:18,x1:52,z:-31,height:6.5},
 lights:[[-17,-19.9],[1,-19.9],[21,-18.5],[30,-14]],
 ledge:{x0:-1,x1:22,z:14.7}};
GS.ENV={clear:[.79,.81,.83],sun:[-.3,.86,.42],sky:[.93,.95,1],ground:[.56,.57,.51],fog:[.8,.82,.85],exposure:1.08};
GS.BOUNDS={x:36,z:31,sx:1e9,sz:1e9};
GS.FX={x:40,z:[15,5],fy:[7,4],cz:[13,5],cy:[2,4],cx:44};
function blob(b,cx,cy,cz,rx,ry,rz,col,seg){seg=seg||7;const rows=Math.max(3,Math.round(seg/2));const P=(i,j)=>{const th=i/seg*PI*2,ph=j/rows*PI;return[cx+Math.cos(th)*Math.sin(ph)*rx,cy+Math.cos(ph)*ry,cz+Math.sin(th)*Math.sin(ph)*rz];};
 for(let j=0;j<rows;j++)for(let i=0;i<seg;i++){const shade=.88+((i*7+j*3)%5)*.03;b.quad(P(i,j),P(i+1,j),P(i+1,j+1),P(i,j+1),col.map(v=>v*shade),0);}}
GS.build=function(gl){const b=new MD.GL.StaticBuilder();const Lo=GS.LAYOUT,F=Lo.field,L=F.L,W=F.W;
 const white=h('#f1f2ef'),offwhite=h('#e2e4e0'),dark=h('#2a3036'),glass=h('#1d252c'),blueSign=h('#1f56a8'),concrete=h('#b9b6ae'),concrete2=h('#a19d95'),metal=h('#9aa3a8'),green=h('#4a7a3a'),green2=h('#5d8d43'),trunk=h('#6f6559');
 /* chão: entorno, praça de placas, faixa de terra */
 b.quad([-140,-.08,-140],[140,-.08,-140],[140,-.08,140],[-140,-.08,140],h('#7d7f78'),0);
 const P=Lo.plaza;b.quad([P.x0,-.02,P.z0],[P.x1,-.02,P.z0],[P.x1,-.02,P.z1],[P.x0,-.02,P.z1],concrete,14);
 const M=F.margin,S=Lo.strip;b.quad([-L-M-2,.002,-W-M-S.depth],[L+M+2,.002,-W-M-S.depth],[L+M+2,.002,-W-M],[-L-M-2,.002,-W-M],h(S.color),0);
 for(let i=0;i<26;i++){const x=-L-M+i*(2*(L+M))/25,z=-W-M-.6-((i*37)%10)/10*S.depth*.7;b.quad([x,.004,z],[x+1.1,.004,z],[x+1.1,.004,z+.5],[x,.004,z+.5],h('#76503a'),0);}
 /* gramado sintético + borda de contenção */
 b.quad([-L-M,.01,-W-M],[-L-M,.01,W+M],[L+M,.01,W+M],[L+M,.01,-W-M],[.3,.5,.22],11);
 b.box(0,.06,-W-M-.06,2*(L+M)+.2,.12,.12,concrete2,0);b.box(0,.06,W+M+.06,2*(L+M)+.2,.12,.12,concrete2,0);b.box(-L-M-.06,.06,0,.12,.12,2*(W+M),concrete2,0);b.box(L+M+.06,.06,0,.12,.12,2*(W+M),concrete2,0);
 /* marcações discretas (na foto quase não aparecem) */
 const lc=[.4,.52,.35];const ln=(x0,z0,x1,z1,w=.08)=>{const dx=x1-x0,dz=z1-z0,l=Math.hypot(dx,dz)||1,ox=-dz/l*w/2,oz=dx/l*w/2;b.quad([x0+ox,.016,z0+oz],[x1+ox,.016,z1+oz],[x1-ox,.016,z1-oz],[x0-ox,.016,z0-oz],lc,0);};
 ln(-L,-W,L,-W);ln(-L,W,L,W);ln(-L,-W,-L,W);ln(L,-W,L,W);ln(0,-W,0,W);for(let i=0;i<40;i++){const a=i/40*PI*2,c=(i+1)/40*PI*2;ln(Math.cos(a)*3,Math.sin(a)*3,Math.cos(c)*3,Math.sin(c)*3);}
 for(const s of [-1,1]){const gx=s*L;ln(gx,-7.5,gx-s*6,-7.5);ln(gx-s*6,-7.5,gx-s*6,7.5);ln(gx-s*6,7.5,gx,7.5);}
 /* gols pequenos (3 x 2 m) com rede deformável (material 8) */
 for(const s of [-1,1]){const gx=s*L,back=gx+s*1.0,gw=1.5,gh=2;for(const z of [-gw,gw]){b.tube([gx,0,z],[gx,gh,z],.05,white,8,2);b.tube([gx,gh,z],[back,1.6,z],.022,metal,6);b.tube([back,0,z],[back,1.6,z],.022,metal,6);b.tube([gx,.02,z],[back,.02,z],.022,metal,6);}
  b.tube([gx,gh,-gw-.05],[gx,gh,gw+.05],.05,white,8,2);b.tube([back,1.6,-gw],[back,1.6,gw],.022,metal,6);
  const net=(p0,p1,p2,nu,nv)=>{for(let i=0;i<=nu;i++){const u=i/nu;const a=[p0[0]+(p1[0]-p0[0])*u,p0[1]+(p1[1]-p0[1])*u,p0[2]+(p1[2]-p0[2])*u];const c=[a[0]+p2[0]-p0[0],a[1]+p2[1]-p0[1],a[2]+p2[2]-p0[2]];b.tube(a,c,.008,white,3,8);}
   for(let j=0;j<=nv;j++){const v=j/nv;const a=[p0[0]+(p2[0]-p0[0])*v,p0[1]+(p2[1]-p0[1])*v,p0[2]+(p2[2]-p0[2])*v];const c=[a[0]+p1[0]-p0[0],a[1]+p1[1]-p0[1],a[2]+p1[2]-p0[2]];b.tube(a,c,.008,white,3,8);}};
  net([back,0,-gw],[back,0,gw],[back,1.6,-gw],12,6);net([gx,gh,-gw],[gx,gh,gw],[back,1.6,-gw],12,4);for(const z of [-gw,gw])net([gx,0,z],[back,0,z],[gx,gh,z],4,7);}
 /* prédio escolar térreo (módulos: janela larga escura / porta com placa azul) */
 const B=Lo.building;const bz=B.z,bd=B.depth,bh=B.height,mods=B.modules,mw=(B.x1-B.x0)/mods.length;
 b.box((B.x0+B.x1)/2,bh/2,bz-bd/2,B.x1-B.x0,bh,bd,offwhite,0);b.box((B.x0+B.x1)/2,bh+.18,bz-bd/2,B.x1-B.x0+.4,.36,bd+.4,dark,0);b.box((B.x0+B.x1)/2,.12,bz+.15,B.x1-B.x0+.2,.24,.4,concrete2,0);
 mods.forEach((k,i)=>{const x=B.x0+mw*(i+.5),fz=bz+.03;b.box(B.x0+mw*i,bh/2,fz+.04,.16,bh,.1,white,0);
  if(k==='w'){b.quad([x-mw*.42,.85,fz+.06],[x+mw*.42,.85,fz+.06],[x+mw*.42,2.65,fz+.06],[x-mw*.42,2.65,fz+.06],glass,13);b.box(x,1.75,fz+.08,.06,1.8,.04,dark,0);b.box(x,.82,fz+.1,mw*.88,.06,.12,dark,0);}
  else{b.quad([x-.5,.02,fz+.06],[x+.5,.02,fz+.06],[x+.5,2.25,fz+.06],[x-.5,2.25,fz+.06],h('#3a434b'),0);b.box(x-.85,2.05,fz+.07,.32,.32,.04,blueSign,10);b.box(x-.85,2.05,fz+.09,.18,.06,.02,white,10);
   b.quad([x+.62,1.0,fz+.06],[x+mw*.45,1.0,fz+.06],[x+mw*.45,2.6,fz+.06],[x+.62,2.6,fz+.06],glass,13);}});
 b.box(B.x1+.3,bh/2,bz-bd/2,.6,bh,bd,white,0);
 /* árvores esguias, galhos finos e copa rala */
 for(const [x,z,ht] of Lo.trees){b.tube([x,0,z],[x+.2,ht*.62,z],.16,trunk,7);
  for(let k=0;k<6;k++){const a=k/6*PI*2+x,len=ht*(.26+((k*3+Math.round(x))%4)*.05),y0=ht*(.42+(k%3)*.08);b.tube([x+.1,y0,z],[x+Math.cos(a)*len*.55,y0+len*.75,z+Math.sin(a)*len*.55],.05,trunk,5);}
  for(let k=0;k<4;k++){const a=k/4*PI*2+z;blob(b,x+Math.cos(a)*ht*.2,ht*(.78+(k%2)*.14),z+Math.sin(a)*ht*.2,.8+(k%2)*.3,.55,.8,k%2?green:green2,5);}
  b.box(x,.09,z,1.3,.18,1.3,concrete2,0);}
 /* árvores densas atrás do prédio (copa visível por cima do telhado) */
 for(let i=0;i<9;i++){const x=-40+i*7.5,z=-33-(i%3)*3;b.tube([x,0,z],[x,6,z],.3,trunk,6);blob(b,x,8.5+(i%2),z,4.2,3.4,4,i%2?green:h('#3f6d33'),8);}
 /* floreiras de concreto com plantas */
 for(const [x,z] of Lo.planters){b.box(x,.45,z,2.6,.9,1.1,h('#c8c4bb'),0);for(let k=0;k<4;k++)blob(b,x-.9+k*.6,1.15+(k%2)*.15,z,.45,.5,.42,k%2?green:h('#6e9a4a'),6);}
 /* mesa com cadeiras e guarda-sol fechado; bancos */
 {const [x,z]=Lo.table;b.box(x,.75,z,1.8,.08,1.1,h('#8d9399'),0);b.tube([x,0,z],[x,.72,z],.06,metal,6);for(let k=0;k<4;k++){const a=k/4*PI*2+.4;b.box(x+Math.cos(a)*1.25,.45,z+Math.sin(a)*.95,.45,.06,.45,h('#5e656c'),0);b.box(x+Math.cos(a)*1.25,.22,z+Math.sin(a)*.95,.06,.44,.06,metal,0);}
  b.tube([x,.8,z],[x,2.6,z],.04,metal,6);b.tube([x,2.6,z],[x,1.5,z+.01],.22,h('#5c5f63'),8);}
 for(const [x,z] of Lo.benches){b.box(x,.46,z,2.2,.07,.45,h('#a8723f'),12);b.box(x-.9,.23,z,.08,.46,.4,dark,0);b.box(x+.9,.23,z,.08,.46,.4,dark,0);}
 /* quadra com tabela de basquete */
 const Ct=Lo.court;b.quad([Ct.x0,.004,Ct.z0],[Ct.x1,.004,Ct.z0],[Ct.x1,.004,Ct.z1],[Ct.x0,.004,Ct.z1],h('#a9a7a1'),14);
 {const [hx,hz]=Ct.hoop;b.tube([hx+1.2,0,hz],[hx+1.2,3.2,hz],.08,h('#e7e7e3'),8);b.tube([hx+1.2,3.2,hz],[hx+.25,3.2,hz],.06,h('#e7e7e3'),6);b.box(hx+.2,3.4,hz,.06,1.05,1.8,white,0);b.box(hx+.17,3.25,hz,.03,.45,.6,h('#c94b37'),0);
  b.tube([hx-.05,3.05,hz-.23],[hx-.05,3.05,hz+.23],.02,h('#d9502e'),5);}
 /* muro alto, veículos azuis e galpões ao fundo */
 const Wl=Lo.wall;b.box((Wl.x0+Wl.x1)/2,Wl.height/2,Wl.z,Wl.x1-Wl.x0,Wl.height,.5,h('#8e9294'),0);
 for(let i=0;i<4;i++)b.box(Wl.x0+3+i*6.2,1.5,Wl.z+3.2,5.6,2.6,2.3,h(i%2?'#2c5fb8':'#3a6fca'),0);
 b.box(26,7,-50,26,14,12,h('#d8dadb'),0);b.box(20,11.5,-43.9,9,4.5,.2,h('#b2363a'),0);b.box(34,8,-43.9,8,1.2,.2,h('#4b5560'),0);
 b.box(54,6,-44,20,12,14,h('#c9cdd0'),0);b.box(-30,6,-58,24,12,12,h('#a35246'),0);b.box(-6,5,-62,16,10,10,h('#b9bdc0'),0);
 /* postes de luz e de energia (com fios) */
 for(const [x,z] of Lo.lights){b.tube([x,0,z],[x,8.5,z],.09,h('#3a4045'),6);b.box(x+.25,8.6,z,1.1,.22,.42,h('#3a4045'),0);b.box(x+.25,8.47,z+.18,.9,.05,.08,[1,1,.95],10);}
 b.tube([30,0,-36],[30,13,-36],.16,h('#6f6a62'),6);b.box(30,12.4,-36,3.4,.18,.18,h('#6f6a62'),0);b.tube([-20,0,-38],[-20,12,-38],.16,h('#6f6a62'),6);
 for(const dz of [-.9,0,.9])b.tube([-20,11.8,-38+dz*.2],[30,12.2,-36+dz*.2],.015,h('#2b2b2b'),3);
 /* mureta/degraus de pedra do lado de cá (onde os alunos assistem) */
 const Ld=Lo.ledge;for(let x=Ld.x0;x<Ld.x1;x+=1.2){const k=Math.round(x)%2===0;b.box(x+.58,.22,Ld.z,1.16,.44,.75,h(k?'#9b9a95':'#8a8984'),0);b.box(x+.58,.03,Ld.z+1.1,1.16,.06,1.2,h(k?'#7d7c78':'#959490'),0);}
 b.quad([-L-M-2,.003,W+M],[L+M+2,.003,W+M],[L+M+2,.003,W+M+.9],[-L-M-2,.003,W+M+.9],h('#8a6b4f'),0);
 /* arquibancada de madeira (componente independente) */
 GS.bleacher=MD.Bleacher?MD.Bleacher.build(b,{}):{seats:[]};
 return b.build(gl);};
/* Espectadores (alunos genéricos, sprites leves): arquibancada, mureta, perto do prédio e na quadra. */
GS.crowd=function(count,home,away,seed){const r=U.rng(seed||5);const out=new Float32Array(Math.max(1,count)*8);let n=0;const max=Math.min(count,520);
 const hc=h(home?.primary||'#f4f5f2'),ac=h(away?.primary||'#ff7a1a');const uniform=[h('#f2f3f1'),h('#f2f3f1'),h('#1d2027'),h('#2a2f38'),h('#e9eaec'),h('#5b6470')];
 const put=(x,y,z,side)=>{if(n>=max)return;const o=n*8;const c=r()<.24?(side?ac:hc):uniform[Math.floor(r()*uniform.length)];out[o]=x;out[o+1]=y;out[o+2]=z;out[o+3]=r();out[o+4]=c[0];out[o+5]=c[1];out[o+6]=c[2];out[o+7]=side;n++;};
 const seats=(GS.bleacher&&GS.bleacher.seats)||[];for(const s of seats)if(r()<.78)put(s[0],s[1]-.12,s[2],s[0]>-6?1:0);
 const Ld=GS.LAYOUT.ledge;for(let x=Ld.x0+.3;x<Ld.x1;x+=.62)if(r()<.7)put(x+(r()-.5)*.2,.3,Ld.z+.1,x>10?1:0);
 for(let i=0;i<34;i++){const x=-34+r()*52,z=-16.2-r()*2.6;put(x,0,z,x>-8?1:0);}
 for(let i=0;i<16;i++){put(26+r()*12,0,-14+r()*16,1);}
 return{data:out,count:n};};
GS.flags=function(home,away){const hp=h(home.primary),hs=h(home.secondary),ap=h(away.primary),as=h(away.secondary);const list=[];
 const add=(x,y,z,yaw,w,hh,amp,sp,c1,c2,pat)=>list.push([x,y,z,yaw,w,hh,amp,sp,c1[0],c1[1],c1[2],Math.random(),c2[0],c2[1],c2[2],pat]);
 add(-12,3.4,17.3,PI,2.6,1.1,.18,1.2,hp,hs,2);add(-1,3.4,17.3,PI,2.6,1.1,.18,1.2,ap,as,2);
 for(let i=0;i<6;i++){const x=-12+i*2.2;add(x,1.8+(i%2)*.35,16.4+i%2*.6,PI,.9,.6,.4,2.2,i%2?ap:hp,i%2?as:hs,i%3?0:3);}
 add(-28,2.9,-20.1,0,1.8,.9,.1,1,h('#1f56a8'),h('#ffffff'),2);return list;};
MD.GerminareScene=GS;
})(window.MD=window.MD||{});
