/* MATCHDAY 0.4 — geometrias base reutilizáveis (criadas uma única vez e instanciadas).
   Formato: 8 floats por vértice (posição, normal, uv), índices Uint16. */
(function(MD){
'use strict';
const PI=Math.PI;
function out(){return{v:[],i:[]};}
function fin(o){return{v:new Float32Array(o.v),i:new Uint16Array(o.i)};}
function norm(x,y,z){const l=Math.hypot(x,y,z)||1;return[x/l,y/l,z/l];}
/* Grade paramétrica: f(u,v) -> {p,n} ; u em [0,1] ao redor, v em [0,1] de cima para baixo */
function grid(o,nu,nv,f,uvf){const base=o.v.length/8;for(let j=0;j<=nv;j++)for(let k=0;k<=nu;k++){const u=k/nu,v=j/nv;const r=f(u,v);const uv=uvf?uvf(u,v):[u,v];o.v.push(r.p[0],r.p[1],r.p[2],r.n[0],r.n[1],r.n[2],uv[0],uv[1]);}
 for(let j=0;j<nv;j++)for(let k=0;k<nu;k++){const a=base+j*(nu+1)+k,b=a+1,c=a+nu+1,d=c+1;o.i.push(a,c,b,b,c,d);}}
const M={};
/* Superelipsoide genérico: e1 (vertical) e e2 (horizontal) controlam o quanto é "quadrado". */
function sgnpow(x,p){return Math.sign(x)*Math.pow(Math.abs(x),p);}
M.superEllipsoid=function(e1,e2,nu=20,nv=14,shape){const o=out();grid(o,nu,nv,(u,v)=>{const th=u*2*PI,ph=v*PI;const sp=Math.sin(ph),cp=Math.cos(ph);
  let x=sgnpow(sp,e1)*sgnpow(Math.cos(th),e2),y=sgnpow(cp,e1),z=sgnpow(sp,e1)*sgnpow(Math.sin(th),e2);if(shape){const s=shape(x,y,z);x=s[0];y=s[1];z=s[2];}
  const n=norm(sgnpow(sp,2-e1)*sgnpow(Math.cos(th),2-e2),sgnpow(cp,2-e1),sgnpow(sp,2-e1)*sgnpow(Math.sin(th),2-e2));return{p:[x,y,z],n};});return fin(o);};
M.sphere=(nu=20,nv=14)=>M.superEllipsoid(1,1,nu,nv);
/* Caixa arredondada (unitária, -0.5..0.5) */
M.roundBox=function(r=.18,n=3){const o=out();const faces=[[0,1,2,1],[0,1,2,-1],[1,2,0,1],[1,2,0,-1],[2,0,1,1],[2,0,1,-1]];
 for(const [ax,a1,a2,s] of faces){grid(o,n*2,n*2,(u,v)=>{const p=[0,0,0];p[ax]=.5*s;p[a1]=(u-.5)*s;p[a2]=(v-.5);const c=p.map(q=>Math.max(-.5+r,Math.min(.5-r,q)));const d=norm(p[0]-c[0],p[1]-c[1],p[2]-c[2]);
  return{p:[c[0]+d[0]*r,c[1]+d[1]*r,c[2]+d[2]*r],n:d};});}return fin(o);};
/* Membro: cilindro afunilado com pontas arredondadas, do joelho/cotovelo para baixo (0 -> -1) */
M.limb=function(taper=.78,nu=12,nv=8){const o=out();grid(o,nu,nv+4,(u,v)=>{const th=u*2*PI;const k=nv+4;const j=Math.round(v*k);let y,r,ny=0;
  if(j<=2){const a=(j/2)*PI/2;y=-.12*(1-Math.sin(a));r=.5*Math.sin(a)+.001;ny=Math.cos(a);}
  else if(j>=k-2){const a=((k-j)/2)*PI/2;y=-1+.12*(1-Math.sin(a));r=.5*taper*Math.sin(a)+.001;ny=-Math.cos(a);}
  else{const t=(j-2)/(k-4);y=-.12-t*.76;r=.5*(1+(taper-1)*t)*(1+Math.sin(t*PI)*.06);}
  const n=norm(Math.cos(th)*(1-Math.abs(ny)),ny,Math.sin(th)*(1-Math.abs(ny)));return{p:[Math.cos(th)*r,y,Math.sin(th)*r],n};});return fin(o);};
M.cylinder=function(nu=14){const o=out();grid(o,nu,1,(u,v)=>{const th=u*2*PI;return{p:[Math.cos(th)*.5,-v,Math.sin(th)*.5],n:[Math.cos(th),0,Math.sin(th)]};});
 for(const y of [0,-1]){const c=o.v.length/8;o.v.push(0,y,0,0,y?-1:1,0,.5,.5);for(let k=0;k<=nu;k++){const th=k/nu*2*PI;o.v.push(Math.cos(th)*.5,y,Math.sin(th)*.5,0,y?-1:1,0,.5,.5);}for(let k=0;k<nu;k++)y?o.i.push(c,c+1+k,c+2+k):o.i.push(c,c+2+k,c+1+k);}return fin(o);};
M.cone=function(nu=10){const o=out();grid(o,nu,1,(u,v)=>{const th=u*2*PI,r=.5*v;return{p:[Math.cos(th)*r,1-v,Math.sin(th)*r],n:norm(Math.cos(th),.5,Math.sin(th))};});return fin(o);};
M.torus=function(R=.5,r=.12,nu=18,nv=8){const o=out();grid(o,nu,nv,(u,v)=>{const a=u*2*PI,b=v*2*PI;const cx=Math.cos(a),cz=Math.sin(a);return{p:[(R+r*Math.cos(b))*cx,r*Math.sin(b),(R+r*Math.cos(b))*cz],n:[Math.cos(b)*cx,Math.sin(b),Math.cos(b)*cz]};});return fin(o);};
M.hemi=function(nu=18,nv=7,cut=.5){const o=out();grid(o,nu,nv,(u,v)=>{const th=u*2*PI,ph=v*PI*cut;const n=[Math.sin(ph)*Math.cos(th),Math.cos(ph),Math.sin(ph)*Math.sin(th)];return{p:n,n};});return fin(o);};
M.quad=function(){return{v:new Float32Array([-.5,-.5,0,0,0,1,0,1,.5,-.5,0,0,0,1,1,1,.5,.5,0,0,0,1,1,0,-.5,.5,0,0,0,1,0,0]),i:new Uint16Array([0,1,2,0,2,3])};};
M.disc=function(){return{v:new Float32Array([-.5,0,-.5,0,1,0,0,0,.5,0,-.5,0,1,0,1,0,.5,0,.5,0,1,0,1,1,-.5,0,.5,0,1,0,0,1]),i:new Uint16Array([0,2,1,0,3,2])};};
/* Torso: seção superelíptica ao longo da altura (0 = cintura, 1 = ombros). UV frente [0,.5], costas [.5,1]. */
M.torso=function(kind){const P={normal:{w:y=>.4+.1*Math.sin(Math.min(1,y*1.15)*PI/2),d:y=>.26+.03*Math.sin(y*PI),e:.55},slim:{w:y=>.36+.06*y,d:y=>.22+.02*Math.sin(y*PI),e:.6},
  strong:{w:y=>.4+.16*y*y,d:y=>.28+.05*Math.sin(y*PI),e:.5},square:{w:()=>.5,d:()=>.33,e:.18},round:{w:y=>.32+.2*Math.sin((.12+.8*y)*PI),d:y=>.25+.15*Math.sin((.12+.8*y)*PI),e:.95},
  sponge:{w:()=>.52,d:()=>.3,e:.12}}[kind];const o=out();
 for(const half of [0,1])grid(o,12,12,(u,v)=>{const y=1-v;const th=half?-u*PI:PI-u*PI;const c=Math.cos(th),s=Math.sin(th);const top=y>.86?(1-Math.pow((y-.86)/.14,2)*.35):1;
  const w=P.w(y)*top,d=P.d(y)*(y>.9?1-Math.pow((y-.9)/.1,2)*.4:1);return{p:[sgnpow(c,P.e)*w,y,sgnpow(s,P.e)*d],n:norm(sgnpow(c,2-P.e)/w,y>.9?(y-.9)*6:0,sgnpow(s,2-P.e)/d)};},(u,v)=>[half?.5+.5*u:.5*u,v]);
 return fin(o);};
M.torsoStar=function(){const o=out();const pts=[];for(let k=0;k<10;k++){const a=PI/2+k*PI/5,r=k%2?.48:1;pts.push([Math.cos(a)*r*.62,.5+Math.sin(a)*r*.62]);}
 const d=.3;for(const zf of [1,-1]){const c=o.v.length/8;o.v.push(0,.5,d*zf,0,0,zf,zf>0?.25:.75,.5);for(const p of pts)o.v.push(p[0],p[1],d*zf,0,0,zf,zf>0?.25-p[0]*.4:.75+p[0]*.4,1-p[1]);for(let k=0;k<10;k++){const a=c+1+k,b=c+1+(k+1)%10;zf>0?o.i.push(c,a,b):o.i.push(c,b,a);}}
 for(let k=0;k<10;k++){const p=pts[k],q=pts[(k+1)%10];const nn=norm(q[1]-p[1],-(q[0]-p[0]),0);const c=o.v.length/8;
  for(const v of [[p[0],p[1],d],[q[0],q[1],d],[q[0],q[1],-d],[p[0],p[1],-d]])o.v.push(v[0],v[1],v[2],nn[0],nn[1],0,.5,0);o.i.push(c,c+2,c+1,c,c+3,c+2);}return fin(o);};
/* Calção: tronco de cone elíptico com UV frente/costas */
M.shorts=function(){const o=out();for(const half of [0,1])grid(o,10,4,(u,v)=>{const th=half?-u*PI:PI-u*PI;const y=1-v;const w=.5+.04*v,d=.36+.02*v;return{p:[Math.cos(th)*w,y,Math.sin(th)*d],n:norm(Math.cos(th)/w,0,Math.sin(th)/d)};},(u,v)=>[half?.5+.5*u:.5*u,v]);return fin(o);};
/* Cabeças (unitárias, raio ~1). Forma de rosto controlada por deformação. */
M.head=function(kind){const e={round:[1,1],oval:[1,1],square:[.42,.42],long:[1,1],heart:[1,1],wide:[.8,.8]}[kind]||[1,1];
 return M.superEllipsoid(e[0],e[1],22,16,(x,y,z)=>{if(kind==='oval')return[x*.9,y*1.1,z*.94];if(kind==='long')return[x*.84,y*1.24,z*.92];
  if(kind==='heart')return[x*(.78+.22*(y+1)/2),y*1.06,z*.95];if(kind==='wide')return[x*1.13,y*.96,z];if(kind==='square')return[x*.98,y*1.02,z*.92];return[x,y,z];});};
/* Chuteira: bico arredondado + calcanhar */
M.boot=function(){return M.superEllipsoid(.6,.85,16,10,(x,y,z)=>[x*.5,y*.5*(z>0?1-z*.25:1),z*(z>0?1:.62)]);};
M.build=function(gl){const G=MD.GL;const L={};const add=(k,d)=>{L[k]=G.mesh(gl,d);};
 add('sphere',M.sphere(20,14));add('sphereLow',M.sphere(10,7));add('box',M.roundBox(.16,2));add('boxSharp',M.roundBox(.04,1));add('limb',M.limb(.74));add('limbStraight',M.limb(.95));
 add('cyl',M.cylinder(14));add('cone',M.cone(10));add('torus',M.torus(.5,.14));add('hemi',M.hemi());add('quad',M.quad());add('disc',M.disc());add('boot',M.boot());add('shorts',M.shorts());
 for(const k of ['normal','slim','strong','square','round','sponge'])add('torso_'+k,M.torso(k));add('torso_star',M.torsoStar());
 for(const k of ['round','oval','square','long','heart','wide'])add('head_'+k,M.head(k));
 return L;};
MD.Meshes=M;
})(window.MD=window.MD||{});
