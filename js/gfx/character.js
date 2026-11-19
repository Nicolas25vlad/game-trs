/* MATCHDAY 0.4 — personagem articulado estilizado.
   Esqueleto (quadril, coluna, pescoço, cabeça, ombros, cotovelos, mãos, quadris, joelhos, tornozelos),
   rosto com olhos/sobrancelhas/boca animáveis, 21 cabelos, 10 barbas, acessórios e 3 níveis de detalhe.
   Proporções totalmente customizáveis (cabeçudo, quadrado, estrela, esponja...). Sem alocação por quadro. */
(function(MD){
'use strict';
const U=MD.U,M=U.M,A=MD.Anim,clamp=U.clamp,PI=Math.PI;
const CH={};
const POOL=Array.from({length:40},()=>new Float32Array(16));let pi=0;const mat=()=>POOL[(pi++)%POOL.length];
const W=new Float32Array(16);
const rgb=h=>U.hex2rgb(h);
const DARK=[.07,.07,.08],WHITE=[.98,.98,.97],MOUTH=[.25,.07,.07],TEETH=[.96,.95,.9],PUPIL=[.04,.04,.06];
/* Proporções a partir da aparência (cache por personagem) */
CH.proportions=function(app){const a=app||{};const H=clamp(+a.height||1,.65,1.6),leg=clamp(+a.legLength||1,.55,1.65),bw=clamp(+a.bodyWidth||1,.55,2),sh=clamp(+a.shoulders||1,.65,1.8),tl=clamp(+a.torso||1,.7,1.45);
 const p={H,bw,shape:a.bodyShape||'normal'};const stub=p.shape==='sponge'?.75:1;
 p.TL=.45*H*leg*stub;p.SL=.43*H*leg*stub;p.FH=.075*H;p.hipY=p.TL+p.SL+p.FH;
 p.torso=.5*H*tl*(p.shape==='round'?.95:1);p.TW=.43*Math.sqrt(sh)*Math.pow(bw,.85)*(p.shape==='strong'?1.08:p.shape==='slim'?.88:p.shape==='sponge'?1.4:p.shape==='star'?1.25:1);
 p.TD=.5*Math.pow(bw,.75)*(p.shape==='round'?1.25:p.shape==='sponge'?.8:1);p.belly=clamp(+a.belly||0,0,1.6);
 p.SW=.2*sh*Math.pow(bw,.45)*(p.shape==='sponge'?1.45:1);p.hipW=.1*Math.pow(bw,.8)*(p.shape==='sponge'?1.6:1);
 p.neck=.085*H;p.R=.118*clamp(+a.headSize||1.1,.65,2.3)*(.55+.45*H);p.hw=clamp(+a.headWidth||1,.7,1.6);
 p.UA=.29*H*clamp(+a.armLength||1,.6,1.65);p.FA=.26*H*clamp(+a.armLength||1,.6,1.65);p.hand=.095*clamp(+a.hands||1,.6,1.9);
 p.rUA=.052*Math.pow(bw,.5)*(p.shape==='strong'?1.2:1);p.rFA=.044*clamp(+a.forearm||1,.6,1.8)*Math.pow(bw,.35);
 const lt=clamp(+a.legThick||1,.6,1.8);p.rT=.082*lt*Math.pow(bw,.45);p.rS=.058*lt;p.foot=.27*clamp(+a.feet||1,.6,1.9);
 p.total=p.hipY+.08+p.torso+p.neck+p.R*2;return p;};
/* Glifos: 0-9 e A-Z em células de 64 px (8 por linha) */
CH.glyph=function(ch){const c=ch.charCodeAt(0);if(c>=48&&c<=57)return c-48;if(c>=65&&c<=90)return 10+c-65;return -1;};
class CharacterRenderer{
 constructor(B,atlas){this.B=B;this.atlas=atlas;this.face=new Float32Array(8);this.pose=new Float32Array(A.N);}
 part(key,parent,ox,oy,oz,rx,ry,rz,sx,sy,sz,col,m,uv){M.translate(W,parent,ox,oy,oz);if(ry)M.rotY(W,W,ry);if(rx)M.rotX(W,W,rx);if(rz)M.rotZ(W,W,rz);M.scale(W,W,sx,sy,sz);this.B[key].push(W,col[0],col[1],col[2],m||0,uv);}
 /* d: {x,z,yaw, p:proporções, app, kit, colors, number, name, role, prop, seed, lod}; pose: Float32Array; face: [8] */
 draw(d,P,F,t){pi=0;const p=d.p,app=d.app||{},c=d.colors,lod=d.lod,k=d.kit;const B=this.B;
  const psi=PI/2-d.yaw;const root=mat();M.identity(root);M.translate(root,root,d.x,p.hipY+P[A.RY]*(.6+.4*p.H),d.z);M.rotY(root,root,psi+P[A.RW]);M.translate(root,root,P[A.RS],0,P[A.RF]);M.rotX(root,root,P[A.RP]);M.rotZ(root,root,P[A.RR]);
  /* calção */
  const shU=k.uvShorts;this.part('shorts',root,0,-.17,0,0,0,0,p.hipW*3.7,.3,p.hipW*2.9,c.shorts,0,shU);
  /* tronco */
  const chest=mat();M.translate(chest,root,0,.08,0);M.rotX(chest,chest,P[A.SB]);M.rotY(chest,chest,P[A.ST]);M.rotZ(chest,chest,P[A.SS]);
  const tk=p.shape==='star'?'torso_star':'torso_'+(['normal','slim','strong','square','round','sponge'].includes(p.shape)?p.shape:'normal');
  this.part(tk,chest,0,0,0,0,0,0,p.TW*(p.shape==='star'?1:1),p.torso,p.TD,c.shirt,0,k.uvShirt);
  if(p.belly>0&&lod<2)this.part('sphere',chest,0,p.torso*.3,p.TD*.12+p.belly*.035,0,0,0,p.TW*.36*(1+p.belly*.25),p.torso*.28,p.TD*.2+p.belly*.07,c.shirt,0);
  if(lod<2)this.part('torus',chest,0,p.torso*.97,-.004,0,0,0,p.TW*.28,.12,p.TD*.36,c.trim,0);
  /* pescoço e cabeça */
  const neck=mat();M.translate(neck,chest,0,p.torso*.96,0);this.part('cyl',neck,0,p.neck+.02,0,0,0,0,.115*p.hw*(.7+.3*p.H),p.neck+.05,.11*(.7+.3*p.H),c.skin,1);
  const head=mat();M.translate(head,neck,0,p.neck,0);M.rotX(head,head,P[A.HP]+F[6]*.45);M.rotY(head,head,P[A.HY]);M.rotZ(head,head,P[A.HR]);M.translate(head,head,0,p.R*.92,.01);
  this.head(head,p,app,c,F,lod,t,d);
  /* braços */
  for(const s of [1,-1]){const L=s>0;const sh=mat();M.translate(sh,chest,s*p.TW*.47,p.torso*.86-F[7]*.03,0);M.rotX(sh,sh,-(L?P[A.LSF]:P[A.RSF]));M.rotZ(sh,sh,s*(L?P[A.LSA]:P[A.RSA])+s*.08);
   const sl=L?k.uvSleeveL:k.uvSleeveR,longS=k.sleeves==='long'||app.thermal;
   if(lod<2)this.part('sphere',sh,0,-.01,0,0,0,0,p.rUA*1.45,p.rUA*1.25,p.rUA*1.35,c.sleeve,0,null);
   if(longS){this.part('limb',sh,0,0,0,0,0,0,p.rUA*2.3,p.UA,p.rUA*2.3,app.thermal?c.thermal:c.sleeve,0,app.thermal?null:sl);}
   else{this.part('limb',sh,0,0,0,0,0,0,p.rUA*2.45,p.UA*.56,p.rUA*2.45,c.sleeve,0,sl);if(lod<2)this.part('limb',sh,0,-p.UA*.3,0,0,0,0,p.rUA*2,p.UA*.72,p.rUA*2,c.skin,1);}
   const el=mat();M.translate(el,sh,0,-p.UA,0);M.rotX(el,el,-(L?P[A.LE]:P[A.RE]));
   this.part('limb',el,0,.02,0,0,0,0,p.rFA*2.2,p.FA+.02,p.rFA*2.2,longS?(app.thermal?c.thermal:c.sleeve):c.skin,longS?0:1,longS&&!app.thermal?sl:null);
   if(app.wristbands&&lod<2)this.part('torus',el,0,-p.FA*.84,0,0,0,0,p.rFA*2.6,.35,p.rFA*2.6,c.wrist,0);
   const hd=mat();M.translate(hd,el,0,-p.FA,0);const gk=d.role==='keeper',hs=p.hand*(gk?1.35:1),hc=gk?c.gloves:c.skin,hm=gk?0:1;
   if(lod===0){this.part('box',hd,0,-hs*.42,0,0,0,0,hs*.5,hs*.78,hs*.25,hc,hm);this.part('box',hd,0,-hs*.92,.015,.45,0,0,hs*.46,hs*.42,hs*.2,hc,hm);this.part('limb',hd,s*hs*.24,-hs*.2,hs*.06,0,0,s*.55,hs*.17,hs*.42,hs*.17,hc,hm);}
   else this.part('box',hd,0,-hs*.55,0,0,0,0,hs*.5,hs*1,hs*.25,hc,hm);
   if(d.prop&&!L){if(d.prop.card)this.part('boxSharp',hd,0,-hs*1.25,.02,0,0,0,.075,.105,.006,d.prop.card==='red'?[.86,.08,.1]:[1,.86,.05],6);
    if(d.prop.flag){this.part('limb',hd,0,-hs*.3,0,0,0,0,.025,.62,.025,[.85,.85,.85],2);this.part('quad',hd,.13,-hs*.3-.48,0,0,PI/2,0,.001,.22,.3,[1,.85,.05],0);this.part('quad',hd,0,-hs*.3-.47,.12,0,0,0,.24,.2,1,[.95,.2,.1],6);}}}
  /* pernas */
  for(const s of [1,-1]){const L=s>0;const hip=mat();M.translate(hip,root,s*p.hipW*.95,-.02,0);M.rotX(hip,hip,-(L?P[A.LHF]:P[A.RHF]));M.rotZ(hip,hip,s*(L?P[A.LHA]:P[A.RHA])+s*.02);
   this.part('limb',hip,0,0,0,0,0,0,p.rT*2.55,p.TL*.5,p.rT*2.55,c.shorts,0,null);
   if(lod<2)this.part('limb',hip,0,-p.TL*.25,0,0,0,0,p.rT*2,p.TL*.8,p.rT*2,c.skin,1);
   const kn=mat();M.translate(kn,hip,0,-p.TL,0);M.rotX(kn,kn,L?P[A.LK]:P[A.RK]);
   if(lod===0)this.part('sphere',kn,0,0,.01,0,0,0,p.rT*.86,p.rT*.95,p.rT*.9,c.skin,1);
   if(lod<2)this.part('limb',kn,0,.02,0,0,0,0,p.rS*2,p.SL*.28,p.rS*2,c.skin,1);
   this.part('limb',kn,0,-p.SL*.15,0,0,0,0,p.rS*2.25,p.SL*.86,p.rS*2.1,c.socks,0,k.uvSocks);
   const an=mat();M.translate(an,kn,0,-p.SL,0);M.rotX(an,an,-(L?P[A.LA]:P[A.RA]));
   const bl=p.foot,bwid=.1*Math.pow(p.foot/.27,.6);this.part('boot',an,0,-p.FH*.45,bl*.27,0,0,0,bwid,p.FH*1.25,bl*.62,c.boot,2);
   if(lod===0){this.part('boxSharp',an,0,-p.FH*.98,bl*.24,0,0,0,bwid*1.02,.018,bl*1.12,c.boot2,0);this.part('boxSharp',an,s*bwid*.5,-p.FH*.35,bl*.2,0,0,0,.006,.025,bl*.45,c.boot2,0);}}
  /* número e nome nas costas */
  if(lod<2&&d.number!==undefined&&k.font!==undefined){const n=String(d.number);const back=-(p.TD*(p.shape==='round'?.42:p.shape==='square'||p.shape==='sponge'?.34:.3))-.012;const gw=.13*Math.min(1.3,p.TW/.43),gh=.17*Math.min(1.3,p.torso/.5);
   for(let i=0;i<n.length;i++){const g=CH.glyph(n[i]);if(g<0)continue;this.part('quad',chest,(n.length/2-i-.5)*gw*.82,p.torso*.5,back,0,PI,0,gw,gh,1,c.number,4,this.glyphUV(k.font,g));}
   if(lod===0&&d.name&&k.showName!==false){const nm=d.name.slice(0,11);const lw=.045*Math.min(1.25,p.TW/.43);for(let i=0;i<nm.length;i++){const g=CH.glyph(nm[i]);if(g<0)continue;this.part('quad',chest,(nm.length/2-i-.5)*lw*.86,p.torso*.76,back+.004,0,PI,0,lw,lw*1.25,1,c.number,4,this.glyphUV(k.font,g));}}}
  /* sombra */
  if(d.shadow!==false){M.identity(W);M.translate(W,W,d.x+.08,.02,d.z+.06);M.scale(W,W,.95*p.bw**.5,1,.85*p.bw**.5);B.shadow.push(W,.34,0,0,5,null);}}
 glyphUV(font,g){const cx=g%8,cy=Math.floor(g/8);return this.atlas.rect(MD.GL.SLOT.GLYPH0+font,cx*64,cy*64,64,64);}
 head(h,p,a,c,F,lod,t,d){const R=p.R,hw=p.hw;const shape=a.headShape||'round';
  this.part('head_'+(['round','oval','square','long','heart','wide'].includes(shape)?shape:'round'),h,0,0,0,0,0,0,R*hw,R,R*.98,c.skin,1);
  if(lod<2)this.part('sphere',h,0,-R*.5,R*.2,0,0,0,R*.6*(+a.jaw||1)*hw,R*.42*(+a.chin||1),R*.62,c.skin,1);
  if(lod===2){this.hair(h,p,a,c,2);return;}
  const flat=shape==='square'?.93:shape==='wide'?.97:1;const fz=(x,y)=>{const nx=x/(R*hw*(shape==='heart'?(.78+.22*(y/R+1)/2):1)),ny=y/(R*(shape==='long'?1.24:shape==='oval'?1.1:1));return R*.97*(shape==='long'?.92:1)*Math.max(flat*.6,Math.sqrt(Math.max(0,1-nx*nx*.85-ny*ny)))*(shape==='square'?1.06:1);};
  const es=+a.eyeSize||1,sp=R*.36;const blink=(Math.sin(t*1.1+(d.seed||0)*7)>.985)?.12:1;const open=clamp(F[2],.08,1.35)*blink;
  for(const s of [1,-1]){const ex=s*sp,ey=R*.12,ez=fz(ex,ey);
   this.part('sphere',h,ex,ey,ez-R*.05,0,0,0,R*.17*es,R*.2*es*open,R*.1,WHITE,7);
   if(lod===0){this.part('sphere',h,ex,ey-R*.01,ez+R*.025,0,0,0,R*.105*es,R*.11*es*Math.min(1,open*1.05),R*.05,c.eye,7);this.part('sphere',h,ex+s*R*.004,ey-R*.01,ez+R*.055,0,0,0,R*.055*es,R*.058*es*Math.min(1,open*1.1),R*.025,PUPIL,7);
    if(open>.3)this.part('sphere',h,ex-R*.03,ey+R*.04,ez+R*.075,0,0,0,R*.025,R*.025,R*.01,WHITE,6);
    /* pálpebra superior: desce conforme a abertura dos olhos (cansaço, dor, alegria) */
    if(open<.95)this.part('sphere',h,ex,ey+R*.2*es*open,ez-R*.03,0,0,0,R*.185*es,R*.13*es*(1.05-open),R*.11,c.skin,1);}
   else this.part('sphere',h,ex,ey,ez+R*.03,0,0,0,R*.08*es,R*.09*es*open,R*.03,PUPIL,7);
   /* sobrancelha: altura e ângulo pela emoção */
   const by=R*.37+F[0]*R*.1,ang=F[1]*.42;this.part('box',h,ex,by,fz(ex,by)+R*.005,-.25,0,-s*ang,R*.27,R*.055*(+a.brows||1),R*.06,c.brow,3);
   /* orelhas */
   this.part('sphere',h,s*R*.97*hw,R*.02,-R*.04,0,0,0,R*.09,R*.2*(+a.ears||1),R*.14*(+a.ears||1),c.skin,1);}
  /* nariz */
  const ns=+a.nose||1;this.part('sphere',h,0,-R*.06,fz(0,-R*.06)+R*.02,.2,0,0,R*.1*ns,R*.15*ns,R*.13*ns,c.skinDark,1);
  /* boca: abertura, sorriso, largura vindos da emoção */
  const mo=clamp(F[3]+(d.mouthAdd||0),0,1.1),sm=F[4],mw=F[5],my=-R*.44,mz=fz(0,my)-R*.035;
  this.part('sphere',h,0,my-mo*R*.04,mz,0,0,0,R*.2*mw,R*(.018+.17*mo),R*.06,MOUTH,0);
  if(lod===0){if(mo>.2&&sm>.3)this.part('boxSharp',h,0,my+R*.05,mz+R*.03,0,0,0,R*.26*mw,R*.06,R*.02,TEETH,2);
   for(const s of [1,-1]){this.part('sphere',h,s*R*.1*mw,my+R*(.022+.07*mo)+sm*R*.035,mz+R*.025,0,0,s*sm*.42,R*.13*mw,R*.024,R*.04,c.lip,1);
    this.part('sphere',h,s*R*.1*mw,my-R*(.025+.11*mo)+sm*R*.02,mz+R*.02,0,0,-s*sm*.2,R*.12*mw,R*.028,R*.04,c.lip,1);}}
  this.hair(h,p,a,c,lod);this.beard(h,p,a,c,lod);
  if(a.headband)this.part('torus',h,0,R*.5,-R*.04,-.15,0,0,R*2.02*hw,R*.9,R*1.96,c.headband,0);}
 hair(h,p,a,c,lod){const R=p.R,hw=p.hw,v=+a.hairVolume||1,s=a.hairStyle||'short',col=c.hair;const P=(m,x,y,z,rx,ry,rz,sx,sy,sz,cc)=>this.part(m,h,x,y,z,rx,ry,rz,sx,sy,sz,cc||col,3);
  const cap=(sc=1.06,y=.1,back=-.04,low=1,tilt=.4)=>P('hemi',0,R*y,R*back,-tilt,0,0,R*sc*hw*(1+.04*(v-1)),R*sc*low*(.92+.12*v),R*sc*(1+.03*(v-1)));
  if(s==='bald')return;
  if(lod===2){if(s==='afro')P('sphereLow',0,R*.62,-R*.42,0,0,0,R*1.3*v,R*1.15*v,R*1.2*v);else cap();return;}
  switch(s){
   case'shaved':P('hemi',0,R*.06,-R*.03,-.42,0,0,R*1.025*hw,R*1.0,R*1.025,c.hairShaved);break;
   case'fade':cap(1.07,.2,-.05,.85,.35);P('hemi',0,R*.04,-R*.03,-.42,0,0,R*1.02*hw,R*1.0,R*1.02,c.hairShaved);break;
   case'short':cap();break;
   case'medium':cap(1.09,.06,-.08);for(const k of [1,-1])P('sphere',k*R*.78*hw,-R*.05,-R*.18,0,0,0,R*.32,R*.5,R*.55);P('sphere',0,-R*.18,-R*.62,0,0,0,R*.8*hw,R*.55,R*.38);break;
   case'long':cap(1.1,.05,-.1);P('box',0,-R*.85,-R*.62,.15,0,0,R*1.7*hw,R*1.9*v,R*.45);for(const k of [1,-1])P('box',k*R*.82*hw,-R*.55,-R*.12,0,0,k*.06,R*.3,R*1.4*v,R*.75);break;
   case'straight':cap(1.08,.08,-.08);P('box',0,R*.55,R*.74,-.5,0,0,R*1.35*hw,R*.28,R*.2);for(const k of [1,-1])P('box',k*R*.86*hw,R*.05,-R*.05,0,0,0,R*.22,R*.9,R*1.3);break;
   case'mohawk':P('hemi',0,R*.06,-R*.03,-.42,0,0,R*1.02*hw,R*1.0,R*1.02,c.hairShaved);for(let i=0;i<6;i++){const z=R*(.75-i*.3);P('box',0,R*(.95+Math.cos(i*.45)*.06),z-R*.05,-.25+i*.12,0,0,R*.22,R*.55*v,R*.32);}break;
   case'spiky':cap(1.05,.15);for(let i=0;i<8;i++){const an=i/8*PI*2;P('cone',Math.cos(an)*R*.45,R*.7,Math.sin(an)*R*.4-R*.05,Math.sin(an)*.5,0,-Math.cos(an)*.5,R*.32,R*.6*v,R*.32);}P('cone',0,R*.85,0,0,0,0,R*.35,R*.7*v,R*.35);break;
   case'curly':cap(1.06,.12);if(lod===0)for(let i=0;i<11;i++){const an=i/11*PI*2;P('sphere',Math.cos(an)*R*.72*hw,R*.62+Math.sin(i*1.7)*R*.06,Math.sin(an)*R*.66-R*.08,0,0,0,R*.26*v,R*.24*v,R*.26*v);}break;
   case'kinky':cap(1.1,.14);if(lod===0)for(let i=0;i<14;i++){const an=i/14*PI*2,r2=i%2?.55:.8;P('sphere',Math.cos(an)*R*r2*hw,R*.72,Math.sin(an)*R*r2-R*.06,0,0,0,R*.2*v,R*.17*v,R*.2*v);}break;
   case'wavy':cap(1.08,.1);for(let i=0;i<3;i++)P('sphere',(i-1)*R*.45*hw,R*.78,R*(.25-i*.05),0,0,(i-1)*.3,R*.42*v,R*.22*v,R*.65);break;
   case'afro':P('sphere',0,R*.62,-R*.42,0,0,0,R*1.32*v*hw,R*1.15*v,R*1.22*v);cap(1.05,.1,-.04,1,.42);break;
   case'braids':cap(1.06,.1,-.06);if(lod===0)for(let i=0;i<8;i++){const an=PI*.15+i/7*PI*.7;P('limb',Math.cos(an)*R*.85*hw,-R*.1,-Math.sin(an)*R*.7,0.15,0,0,R*.12,R*1.4*v,R*.12);}else P('box',0,-R*.6,-R*.6,.1,0,0,R*1.4,R*1.4,R*.3);break;
   case'dreads':cap(1.08,.1,-.06);if(lod===0)for(let i=0;i<10;i++){const an=-PI*.05+i/9*PI*1.1;P('limb',Math.cos(an)*R*.86*hw,R*.05,-Math.sin(an)*R*.75+R*.05,0.1,0,Math.cos(an)*.2,R*.2,R*1.7*v,R*.2);}else P('box',0,-R*.6,-R*.6,.1,0,0,R*1.6,R*1.6,R*.4);break;
   case'bun':cap(1.04,.1);P('sphere',0,R*.9,-R*.55,0,0,0,R*.38*v,R*.36*v,R*.38*v);break;
   case'ponytail':cap(1.05,.1);P('sphere',0,R*.45,-R*.92,0,0,0,R*.16,R*.16,R*.16,c.tie);P('limb',0,R*.42,-R*1.0,.35,0,0,R*.28,R*1.15*v,R*.28);break;
   case'quiff':cap(1.04,.12);P('sphere',0,R*.92,R*.45,-.5,0,0,R*.62*hw,R*.36*v,R*.52);break;
   case'fringe':cap(1.07,.1);P('box',0,R*.55,R*.78,-.25,0,0,R*1.45*hw,R*.42,R*.22);break;
   case'parted':for(const k of [1,-1])P('hemi',k*R*.05,R*.1,-R*.04,-.4,0,-k*.1,R*1.0*hw,R*1.05*(.9+.1*v),R*1.06);break;
   case'cap':P('hemi',0,R*.22,-R*.02,-.2,0,0,R*1.1*hw,R*1.0,R*1.1,c.capColor||col);P('boxSharp',0,R*.4,R*1.0,-.12,0,0,R*1.2,R*.07,R*.75,c.capColor||col);break;
   default:cap();}}
 beard(h,p,a,c,lod){const s=a.beardStyle||'none';if(s==='none')return;const R=p.R,hw=p.hw,col=c.beard;const P=(m,x,y,z,rx,sx,sy,sz,cc)=>this.part(m,h,x,y,z,rx||0,0,0,sx,sy,sz,cc||col,3);
  const jaw=(k,y,cc)=>P('sphere',0,-R*y,R*.18,0,R*.66*hw*(+a.jaw||1)*k,R*.5*(+a.chin||1)*k,R*.68*k,cc);
  const mus=(th)=>P('sphere',0,-R*.31,R*.88,0,R*.24,R*.04*th,R*.07);
  switch(s){case'stubble':jaw(1.03,.42,c.stubble);break;case'short':jaw(1.06,.45);break;case'full':jaw(1.1,.5);mus(1.6);break;
   case'long':jaw(1.1,.5);mus(1.6);P('sphere',0,-R*1.05,R*.42,.3,R*.42,R*.5,R*.3);break;case'goatee':P('sphere',0,-R*.78,R*.62,0,R*.24,R*.2,R*.22);break;
   case'thinMustache':mus(.9);break;case'thickMustache':P('sphere',0,-R*.31,R*.88,0,R*.3,R*.09,R*.1);break;case'mustacheGoatee':mus(1.4);P('sphere',0,-R*.78,R*.62,0,R*.24,R*.2,R*.22);break;
   case'sideburns':for(const k of [1,-1])P('box',k*R*.86*hw,-R*.12,R*.12,0,R*.12,R*.5,R*.25);break;}}
}
CH.CharacterRenderer=CharacterRenderer;
/* Paleta derivada da aparência e do uniforme (calculada uma vez por ator) */
CH.colors=function(app,kitColors){const a=app||{};const skin=rgb(a.skin||'#dcb08c');const hair=rgb(a.hairColor||'#30241e');
 return{skin,skinDark:skin.map(v=>v*.9),hair,hairShaved:hair.map((v,i)=>v*.55+skin[i]*.45),brow:rgb(a.hairColor||'#30241e').map(v=>v*.85),beard:rgb(a.beardColor||a.hairColor||'#30241e'),stubble:rgb(a.beardColor||a.hairColor||'#30241e').map((v,i)=>v*.45+skin[i]*.55),
  eye:rgb(a.eyeColor||'#245486'),lip:rgb(a.mouthColor||'#9a5048').map((v,i)=>v*.5+skin[i]*.5),boot:rgb(a.bootColor||'#14202b'),boot2:rgb(a.bootColor2||'#ffffff'),
  headband:rgb(a.headband||'#ffffff'),wrist:rgb(a.wristbands||'#ffffff'),thermal:rgb(a.thermal||'#222222'),tie:[.9,.2,.3],capColor:rgb(a.hairColor||'#222'),
  shirt:rgb(kitColors.primary),sleeve:rgb(kitColors.sleeve||kitColors.primary),shorts:rgb(kitColors.shorts),socks:rgb(kitColors.socks),trim:rgb(kitColors.accent||kitColors.secondary),number:rgb(kitColors.number||'#ffffff'),gloves:rgb(kitColors.gloves||'#f2f2f2')};};
MD.Character=CH;
})(window.MD=window.MD||{});
