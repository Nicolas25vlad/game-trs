/* MATCHDAY 0.4 — pintura das texturas de uniforme (canvas 2D -> atlas WebGL).
   Layout UV de cada uniforme (512x512): camisa frente (0..256) e costas (256..512) em y 0..320,
   manga esquerda/direita, calção (frente/costas), meião e acabamento. A mesma textura alimenta a prévia 3D,
   a partida e o editor de pintura — o que se desenha aparece no modelo. */
(function(MD){
'use strict';
const U=MD.U,clamp=U.clamp;
const K={};
const imgs=new Map();
K.image=function(ref){const url=MD.Data.Assets.url(ref);if(!url)return null;let st=imgs.get(url);if(st)return st.ready?st.img:null;st={ready:false,img:new Image()};imgs.set(url,st);
 st.img.onload=()=>{st.ready=true;if(typeof window!=='undefined')window.dispatchEvent(new Event('matchday-kit-loaded'));};st.img.onerror=()=>{st.ready=false;};st.img.src=url;return null;};
K.REG={front:[0,0,256,320],back:[256,0,256,320],lsleeve:[0,320,128,96],rsleeve:[128,320,128,96],shorts:[256,320,256,128],shortsFront:[256,320,128,128],shortsBack:[384,320,128,128],socks:[0,416,256,96],trim:[256,448,256,64]};
function clip(ctx,r,fn){ctx.save();ctx.beginPath();ctx.rect(r[0],r[1],r[2],r[3]);ctx.clip();ctx.translate(r[0],r[1]);fn(r[2],r[3]);ctx.restore();}
K.sleeveColor=k=>k.sleeveColor==='secondary'?k.secondary:k.sleeveColor==='accent'?k.accent:k.primary;
/* Estampas da camisa */
function pattern(ctx,k,w,h,mirror){const p=k.pattern,a=k.primary,b=k.secondary,c=k.accent,st=Math.max(4,+k.patternSize||15);ctx.fillStyle=a;ctx.fillRect(0,0,w,h);ctx.fillStyle=b;
 switch(p){case'stripes':for(let x=-st;x<w+st;x+=st*2)ctx.fillRect(x+(mirror?st/2:0),0,st,h);break;
  case'pinstripes':for(let x=0;x<w;x+=st*1.3)ctx.fillRect(x,0,Math.max(1.5,st*.14),h);break;
  case'hoops':for(let y=0;y<h;y+=st*2)ctx.fillRect(0,y+st*.5,w,st);break;
  case'diagonal':ctx.save();ctx.rotate(-.55);for(let x=-h*2;x<w*2;x+=st*2.2)ctx.fillRect(x,-h,st,h*3);ctx.restore();break;
  case'sash':ctx.save();ctx.translate(w*.5,h*.45);ctx.rotate(mirror?.62:-.62);ctx.fillRect(-w*1.2,-st*1.4,w*2.4,st*2.8);ctx.restore();break;
  case'band':ctx.fillRect(0,h*.36,w,st*2.6);ctx.fillStyle=c;ctx.fillRect(0,h*.36-3,w,3);ctx.fillRect(0,h*.36+st*2.6,w,3);break;
  case'gradient':{const g=ctx.createLinearGradient(0,0,0,h);g.addColorStop(0,a);g.addColorStop(1,b);ctx.fillStyle=g;ctx.fillRect(0,0,w,h);break;}
  case'half':if(mirror)ctx.fillRect(0,0,w/2,h);else ctx.fillRect(w/2,0,w/2,h);break;
  case'thirds':ctx.fillRect(w/3,0,w/3,h);ctx.fillStyle=c;ctx.fillRect(mirror?0:w*2/3,0,w/3,h);break;
  case'quarters':ctx.fillRect(mirror?0:w/2,0,w/2,h/2);ctx.fillRect(mirror?w/2:0,h/2,w/2,h/2);break;
  case'checker':{const s=st*1.6;for(let y=0;y<h;y+=s)for(let x=0;x<w;x+=s)if(((x/s|0)+(y/s|0))%2)ctx.fillRect(x,y,s,s);break;}
  case'chevron':ctx.beginPath();ctx.moveTo(-10,h*.15);ctx.lineTo(w/2,h*.42);ctx.lineTo(w+10,h*.15);ctx.lineTo(w+10,h*.15+st*1.8);ctx.lineTo(w/2,h*.42+st*1.8);ctx.lineTo(-10,h*.15+st*1.8);ctx.fill();break;
  case'diamonds':{const s=st*2;for(let y=0;y<h+s;y+=s)for(let x=((y/s|0)%2)*s/2;x<w+s;x+=s){ctx.beginPath();ctx.moveTo(x,y-s*.35);ctx.lineTo(x+s*.3,y);ctx.lineTo(x,y+s*.35);ctx.lineTo(x-s*.3,y);ctx.fill();}break;}
  case'triangles':{const s=st*2;for(let y=0;y<h;y+=s)for(let x=0;x<w;x+=s){ctx.beginPath();ctx.moveTo(x,y+s);ctx.lineTo(x+s/2,y);ctx.lineTo(x+s,y+s);ctx.fill();}break;}
  case'waves':ctx.lineWidth=st*.7;ctx.strokeStyle=b;for(let y=-st;y<h+st;y+=st*2.2){ctx.beginPath();for(let x=0;x<=w;x+=4)ctx.lineTo(x,y+Math.sin(x/w*Math.PI*3)*st*.6);ctx.stroke();}break;}
 /* textura de tecido sutil */
 ctx.globalAlpha=.06;ctx.fillStyle='#fff';for(let y=0;y<h;y+=3)ctx.fillRect(0,y,w,1);ctx.globalAlpha=1;}
function details(ctx,k,w,h,back){const acc=k.accent,sec=k.secondary;
 if(k.sides==='panel'){ctx.fillStyle=sec;ctx.fillRect(0,0,22,h);ctx.fillRect(w-22,0,22,h);}else if(k.sides==='stripe'){ctx.fillStyle=acc;ctx.fillRect(10,40,7,h);ctx.fillRect(w-17,40,7,h);}
 if(k.shoulders==='stripes'){ctx.fillStyle=acc;for(let i=0;i<3;i++){ctx.fillRect(0,8+i*9,w*.28,4);ctx.fillRect(w*.72,8+i*9,w*.28,4);}}
 else if(k.shoulders==='panel'){ctx.fillStyle=sec;ctx.fillRect(0,0,w,34);}
 else if(k.shoulders==='yoke'){ctx.fillStyle=sec;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(w,0);ctx.lineTo(w,26);ctx.lineTo(w/2,52);ctx.lineTo(0,26);ctx.fill();}
 /* gola */
 ctx.fillStyle=acc;ctx.strokeStyle=acc;ctx.lineWidth=7;const cx=w/2;
 if(back){ctx.fillRect(cx-46,0,92,8);return;}
 ctx.beginPath();switch(k.collar){case'v':ctx.moveTo(cx-40,0);ctx.lineTo(cx,44);ctx.lineTo(cx+40,0);ctx.stroke();break;
  case'polo':ctx.fillRect(cx-44,0,88,12);ctx.fillRect(cx-5,10,10,38);ctx.fillStyle='rgba(0,0,0,.35)';for(let i=0;i<2;i++){ctx.beginPath();ctx.arc(cx,20+i*13,2.4,0,7);ctx.fill();}break;
  case'crew':ctx.ellipse(cx,0,52,22,0,0,Math.PI);ctx.lineWidth=10;ctx.stroke();break;
  case'henley':ctx.ellipse(cx,0,42,18,0,0,Math.PI);ctx.stroke();ctx.fillRect(cx-4,16,8,30);ctx.fillStyle='#fff';for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(cx,22+i*9,2,0,7);ctx.fill();}break;
  case'wrap':ctx.moveTo(cx-44,0);ctx.lineTo(cx+8,40);ctx.moveTo(cx+44,0);ctx.lineTo(cx-8,40);ctx.stroke();break;
  default:ctx.ellipse(cx,0,44,20,0,0,Math.PI);ctx.stroke();}}
function stitch(ctx,w,h){ctx.save();ctx.strokeStyle='rgba(0,0,0,.18)';ctx.lineWidth=1;ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(4,0);ctx.lineTo(4,h);ctx.moveTo(w-4,0);ctx.lineTo(w-4,h);ctx.moveTo(0,h-8);ctx.lineTo(w,h-8);ctx.stroke();ctx.restore();}
function placeImage(ctx,img,w,h,s){if(!img)return;const sc=clamp(+s.scale||40,5,100)/100;const maxW=w*sc,ratio=img.height/img.width;const dw=maxW,dh=maxW*ratio;
 ctx.save();ctx.globalAlpha=clamp(s.opacity===undefined||s.opacity===null?1:+s.opacity,0,1);ctx.translate(w*(+s.x||50)/100,h*(+s.y||50)/100);ctx.rotate((+s.rot||0)*Math.PI/180);ctx.drawImage(img,-dw/2,-dh/2,dw,dh);ctx.restore();}
function sponsors(ctx,k,area,w,h){const list=(k.sponsors||[]).filter(s=>s.area===area).sort((a,b)=>(a.z||0)-(b.z||0));for(const s of list)placeImage(ctx,K.image(s.img),w,h,s);}
function art(ctx,k,which,w,h){const a=k.art;if(!a)return;const img=K.image(a.img);if(!img)return;if(a.mode==='front'&&which!=='front')return;if(a.mode==='back'&&which!=='back')return;
 let sx=0,sy=0,sw=img.width,sh=img.height;if(a.mode==='sheet'){sw=img.width/2;sx=which==='back'?img.width/2:0;}
 const crop=clamp(+a.crop||100,30,100)/100;sx+=sw*(1-crop)/2;sy+=sh*(1-crop)/2;sw*=crop;sh*=crop;
 const z=clamp(+a.zoom||100,20,300)/100;const dw=w*z,dh=w*z*(sh/sw);ctx.save();ctx.globalAlpha=clamp(a.opacity===undefined||a.opacity===null?1:+a.opacity,0,1);ctx.translate(w/2+(+a.x||0)/100*w,h/2+(+a.y||0)/100*h);ctx.rotate((+a.rot||0)*Math.PI/180);ctx.drawImage(img,sx,sy,sw,sh,-dw/2,-dh/2,dw,dh);ctx.restore();}
/* Pinta o uniforme completo no canvas 512x512 (layout UV). opts: {crest, guides} */
K.paint=function(canvas,k,crest,opts){opts=opts||{};const ctx=canvas.getContext('2d');ctx.clearRect(0,0,512,512);
 for(const which of ['front','back'])clip(ctx,K.REG[which],(w,h)=>{pattern(ctx,k,w,h,which==='back');details(ctx,k,w,h,which==='back');art(ctx,k,which,w,h);
  if(which==='front'&&k.showCrest&&crest){const ci=K.image(crest);if(ci){const s=46;ctx.drawImage(ci,w*.7-s/2,h*.17-s/2,s,s*ci.height/ci.width);}}
  sponsors(ctx,k,which,w,h);if(k.stitch)stitch(ctx,w,h);ctx.fillStyle=k.accent;ctx.fillRect(0,h-5,w,5);});
 for(const which of ['lsleeve','rsleeve'])clip(ctx,K.REG[which],(w,h)=>{ctx.fillStyle=K.sleeveColor(k);ctx.fillRect(0,0,w,h);if(k.sleeveColor==='main'&&k.pattern!=='plain'){ctx.globalAlpha=.85;pattern(ctx,k,w,h*2.4,false);ctx.globalAlpha=1;}
  ctx.fillStyle=k.accent;if(k.sleeveDetail==='stripe'){ctx.fillRect(0,h*.62,w,6);ctx.fillRect(0,h*.74,w,6);}else if(k.sleeveDetail==='band')ctx.fillRect(0,h*.55,w,h*.18);else if(k.sleeveDetail==='tip'){ctx.fillStyle=k.secondary;ctx.fillRect(0,h*.8,w,h*.2);}
  if(k.cuffs){ctx.fillStyle=k.accent;ctx.fillRect(0,h-9,w,9);}sponsors(ctx,k,which,w,h);});
 clip(ctx,K.REG.shorts,(w,h)=>{const hw=w/2;ctx.fillStyle=k.shortsColor;ctx.fillRect(0,0,w,h);ctx.fillStyle=k.shortsColor2;
  if(k.shortsPattern==='side'){ctx.fillRect(0,0,10,h);ctx.fillRect(hw-10,0,20,h);ctx.fillRect(w-10,0,10,h);}else if(k.shortsPattern==='stripe'){ctx.fillRect(hw/2-6,0,12,h);ctx.fillRect(hw+hw/2-6,0,12,h);}
  else if(k.shortsPattern==='hoop')ctx.fillRect(0,h-22,w,14);else if(k.shortsPattern==='split'){ctx.fillRect(hw/2,0,hw/2,h);ctx.fillRect(hw+hw/2,0,hw/2,h);}
  ctx.fillStyle='rgba(0,0,0,.2)';ctx.fillRect(0,0,w,7);ctx.save();ctx.translate(0,0);sponsors(ctx,k,'shorts',hw,h);ctx.restore();});
 clip(ctx,K.REG.socks,(w,h)=>{ctx.fillStyle=k.socksColor;ctx.fillRect(0,0,w,h);ctx.fillStyle=k.socksColor2;
  if(k.socksPattern==='top')ctx.fillRect(0,0,w,18);else if(k.socksPattern==='hoops')for(let y=0;y<h;y+=20)ctx.fillRect(0,y,w,10);else if(k.socksPattern==='band')ctx.fillRect(0,h*.3,w,16);else if(k.socksPattern==='split')ctx.fillRect(w/2,0,w/2,h);
  ctx.fillStyle='rgba(255,255,255,.1)';for(let y=0;y<h;y+=4)ctx.fillRect(0,y,w,1);});
 clip(ctx,K.REG.trim,(w,h)=>{ctx.fillStyle=k.accent;ctx.fillRect(0,0,w,h);});
 /* camada de pintura livre por cima de tudo */
 if(k.paint){const pimg=K.image(k.paint);if(pimg)ctx.drawImage(pimg,0,0,512,512);}
 if(opts.guides)K.guides(ctx);return canvas;};
K.guides=function(ctx){ctx.save();ctx.strokeStyle='rgba(255,255,255,.75)';ctx.setLineDash([6,4]);ctx.lineWidth=1.5;ctx.font='700 11px Arial';ctx.fillStyle='rgba(255,255,255,.9)';
 const lab={front:'FRENTE',back:'COSTAS',lsleeve:'MANGA E',rsleeve:'MANGA D',shortsFront:'CALÇÃO FRENTE',shortsBack:'CALÇÃO COSTAS',socks:'MEIÃO',trim:'ACABAMENTO'};
 for(const k in lab){const r=K.REG[k];ctx.strokeRect(r[0]+1,r[1]+1,r[2]-2,r[3]-2);ctx.fillText(lab[k],r[0]+6,r[1]+14);}
 ctx.strokeStyle='rgba(255,220,80,.6)';ctx.strokeRect(K.REG.back[0]+70,60,116,120);ctx.fillText('NOME / NÚMERO',K.REG.back[0]+74,74);ctx.restore();};
/* Prévia 2D da camisa (frente ou costas) com número e nome */
K.drawShirt=function(canvas,k,crest,opts){opts=opts||{};const tex=opts.tex||K.paint(Object.assign(document.createElement('canvas'),{width:512,height:512}),k,crest);
 const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);const g=ctx.createRadialGradient(w/2,h*.62,20,w/2,h*.62,w*.7);g.addColorStop(0,'#2a4250');g.addColorStop(1,'#101c26');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
 const cx=w/2,cy=h*.44,s=w*.66,back=opts.side==='back';const shape=new Path2D();
 shape.moveTo(cx-s*.24,cy-s*.5);shape.lineTo(cx-s*.52,cy-s*.36);shape.lineTo(cx-s*.68,cy+s*.02);shape.lineTo(cx-s*.44,cy+s*.14);shape.lineTo(cx-s*.33,cy-s*.04);shape.lineTo(cx-s*.33,cy+s*.68);shape.lineTo(cx+s*.33,cy+s*.68);shape.lineTo(cx+s*.33,cy-s*.04);shape.lineTo(cx+s*.44,cy+s*.14);shape.lineTo(cx+s*.68,cy+s*.02);shape.lineTo(cx+s*.52,cy-s*.36);shape.lineTo(cx+s*.24,cy-s*.5);shape.quadraticCurveTo(cx,cy-(back?s*.44:s*.32),cx-s*.24,cy-s*.5);shape.closePath();
 ctx.save();ctx.clip(shape);const r=back?K.REG.back:K.REG.front;ctx.drawImage(tex,r[0],r[1],r[2],r[3],cx-s*.34,cy-s*.5,s*.68,s*1.18);
 const sl=K.REG.lsleeve;ctx.drawImage(tex,sl[0],sl[1],sl[2],sl[3],cx-s*.72,cy-s*.42,s*.4,s*.6);ctx.drawImage(tex,sl[0],sl[1],sl[2],sl[3],cx+s*.32,cy-s*.42,s*.4,s*.6);
 if(back&&opts.number!==undefined){ctx.fillStyle=k.numberColor||(U.luma(k.primary)>.6?'#111':'#fff');ctx.font=`900 ${s*.36}px ${K.FONTS[k.numberFont]||K.FONTS.block}`;ctx.textAlign='center';ctx.fillText(opts.number,cx,cy+s*.3);
  if(opts.name&&k.showName){ctx.font=`800 ${s*.075}px ${K.FONTS[k.numberFont]||K.FONTS.block}`;ctx.fillText(String(opts.name).toUpperCase(),cx,cy-s*.12);}}
 const sh=ctx.createLinearGradient(cx-s*.7,0,cx+s*.7,0);sh.addColorStop(0,'rgba(0,0,0,.3)');sh.addColorStop(.3,'rgba(255,255,255,.06)');sh.addColorStop(.65,'rgba(255,255,255,.12)');sh.addColorStop(1,'rgba(0,0,0,.32)');ctx.fillStyle=sh;ctx.fillRect(0,0,w,h);ctx.restore();
 ctx.strokeStyle='rgba(235,245,255,.5)';ctx.lineWidth=2;ctx.stroke(shape);};
K.FONTS={block:'Impact, "Arial Black", sans-serif',classic:'Georgia, "Times New Roman", serif',round:'"Trebuchet MS", "Segoe UI", sans-serif',condensed:'"Arial Narrow", "Roboto Condensed", Arial, sans-serif'};
/* Glifos 0-9 A-Z em branco (tingidos no shader) */
K.glyphCanvas=function(font){const c=document.createElement('canvas');c.width=c.height=512;const x=c.getContext('2d');x.fillStyle='#fff';x.textAlign='center';x.textBaseline='middle';
 const chars='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';for(let i=0;i<chars.length;i++){const cx=(i%8)*64+32,cy=Math.floor(i/8)*64+34;const f=K.FONTS[font]||K.FONTS.block;x.font=`900 ${i<10?56:44}px ${f}`;
  x.save();if(font==='condensed'){x.translate(cx,cy);x.scale(.78,1.05);x.fillText(chars[i],0,0);}else x.fillText(chars[i],cx,cy);x.restore();}return c;};
/* Placas de publicidade fictícias (marcas originais) */
K.adsCanvas=function(home,away){const c=document.createElement('canvas');c.width=c.height=512;const x=c.getContext('2d');
 const ads=[['MATCHDAY','#0b1220','#cbff4d'],['NOVA BEBIDAS','#e8432e','#fff'],['AURORA TECH','#1e3a8a','#9be7ff'],['VILA SEGUROS','#f5b53e','#14202b'],[(home?.name||'CASA').toUpperCase(),home?.primary||'#2d6aa6',home?.secondary||'#fff'],[(away?.name||'VISITANTE').toUpperCase(),away?.primary||'#ff526a',away?.secondary||'#fff'],['ESPORTE PURO','#0f766e','#ecfeff'],['TRANSMISSÃO MD','#111827','#facc15']];
 ads.forEach((a,i)=>{const y=i*64;x.fillStyle=a[1];x.fillRect(0,y,512,64);x.fillStyle=a[2];x.font='900 34px Arial Black, Impact, sans-serif';x.textBaseline='middle';x.textAlign='center';x.fillText(a[0].slice(0,18),256,y+33);
  x.fillStyle='rgba(255,255,255,.12)';x.fillRect(0,y,512,4);});return c;};
/* Telão: placar e animação de gol */
K.screenCanvas=function(c,st){c=c||Object.assign(document.createElement('canvas'),{width:512,height:256});const x=c.getContext('2d');const g=x.createLinearGradient(0,0,0,256);g.addColorStop(0,'#071220');g.addColorStop(1,'#0e2238');x.fillStyle=g;x.fillRect(0,0,512,256);
 x.textAlign='center';x.textBaseline='middle';
 if(st.goal){x.fillStyle=st.goalColor||'#cbff4d';x.font='900 96px Impact, Arial Black, sans-serif';x.fillText('GOL!',256,100+Math.sin(st.t*10)*4);x.fillStyle='#fff';x.font='800 30px Arial';x.fillText((st.scorer||'').toUpperCase().slice(0,22),256,190);}
 else{x.fillStyle='#fff';x.font='900 46px Arial Black, Impact, sans-serif';x.fillText(st.home||'CASA',110,96);x.fillText(st.away||'VIS',402,96);x.fillStyle='#cbff4d';x.font='900 84px Impact, Arial Black, sans-serif';x.fillText(`${st.hs} - ${st.as}`,256,98);
  x.fillStyle='#9fb3c8';x.font='700 30px Arial';x.fillText(st.clock||'00:00',256,190);}
 x.fillStyle='rgba(255,255,255,.05)';for(let y=0;y<256;y+=3)x.fillRect(0,y,512,1);return c;};
K.ballCanvas=function(){const c=document.createElement('canvas');c.width=512;c.height=256;const x=c.getContext('2d');x.fillStyle='#f6f7f2';x.fillRect(0,0,512,256);x.fillStyle='#1d2b36';
 const pts=[[64,64],[192,64],[320,64],[448,64],[0,192],[128,192],[256,192],[384,192],[512,192],[128,128],[384,128]];for(const [px,py] of pts){x.beginPath();for(let k=0;k<5;k++){const a=-Math.PI/2+k*Math.PI*2/5;x.lineTo(px+Math.cos(a)*30,py+Math.sin(a)*24);}x.fill();}
 x.strokeStyle='rgba(30,40,50,.35)';x.lineWidth=2;for(let i=0;i<9;i++){x.beginPath();x.moveTo(i*64,0);x.lineTo(i*64+32,256);x.stroke();}return c;};
/* Escolha automática de uniformes sem conflito de cores */
K.pickKits=function(home,away){const hk=home.kits.home;let ak=away.kits.away,akKey='away';const clash=(a,b)=>U.colorDistance(a.primary,b.primary)<.32||U.colorDistance(a.shortsColor,b.shortsColor)<.12&&U.colorDistance(a.primary,b.primary)<.45;
 if(clash(hk,ak)){if(!clash(hk,away.kits.third)){ak=away.kits.third;akKey='third';}else if(!clash(hk,away.kits.home)){ak=away.kits.home;akKey='home';}}
 return{home:hk,away:ak,awayKey:akKey,homeGK:home.kits.gk,awayGK:away.kits.gk};};
/* 0.6: escolha explícita do uniforme (home/away/third) na tela de táticas; 'auto' mantém a regra contra cores parecidas */
K.pickKitsChoice=function(home,away,hKey,aKey){const base=K.pickKits(home,away);const hk=hKey&&hKey!=='auto'&&home.kits[hKey]?home.kits[hKey]:base.home;const ak=aKey&&aKey!=='auto'&&away.kits[aKey]?away.kits[aKey]:base.away;return{...base,home:hk,away:ak,awayKey:aKey&&aKey!=='auto'?aKey:base.awayKey};};
K.refKit=function(home,away){const dark=U.luma(home.primary)<.25||U.luma(away.primary)<.25;const base=dark?'#f5d000':'#141414';const k=MD.Data.defaultKit(base,dark?'#141414':'#f5d000',dark?'#141414':'#f5d000');k.shortsColor='#141414';k.socksColor='#141414';k.socksColor2=dark?'#f5d000':'#3a3a3a';k.collar='polo';k.showName=false;return k;};
K.numberColor=k=>k.numberColor||(U.luma(k.primary)>.62?'#111111':'#ffffff');
/* compatibilidade com o nome usado na 0.3 */
K.invalidate=()=>{};
MD.Kit=K;window.MatchdayKit=K;
})(window.MD=window.MD||{});
