/* MATCHDAY 0.4 — modo alternativo em Canvas 2D (quando WebGL2 não está disponível).
   Usa as mesmas trilhas pré-calculadas e o mesmo diretor de câmera: o lance é idêntico ao do 3D. */
(function(MD){
'use strict';
const U=MD.U,clamp=U.clamp,PI=Math.PI;
class Renderer2D{
 constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.dir=new MD.Camera.Director();this.stats={fps:0,ms:0,draws:0,instances:0,tris:0,pr:1,quality:'2d',gpu:'Canvas 2D'};this.lastTrack=null;this.lastT=0;
  let s=23165;const r=()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};this.crowd=[];for(let i=0;i<900;i++){const side=r()<.5?-1:1;this.crowd.push({x:-78+r()*156,z:side*(42+r()*14),y:1+r()*14,c:r()});}}
 setTeams(home,away,kits){this.home=home;this.away=away;this.kits=kits||MD.Kit.pickKits(home,away);}
 setQuality(){}
 resize(){const c=this.canvas,r=c.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,1.5);const w=Math.max(2,Math.round(r.width*dpr)),h=Math.max(2,Math.round(r.height*dpr));if(c.width!==w||c.height!==h){c.width=w;c.height=h;}this.w=w;this.h=h;this.pr=dpr;}
 basis(){const e=this.dir.eye,t=this.dir.tgt;let f=[t[0]-e[0],t[1]-e[1],t[2]-e[2]];const l=Math.hypot(...f);f=f.map(v=>v/l);let r=[f[1]*0-f[2]*1,f[2]*0-f[0]*0,f[0]*1-f[1]*0];const rl=Math.hypot(...r)||1;r=r.map(v=>v/rl);const u=[r[1]*f[2]-r[2]*f[1],r[2]*f[0]-r[0]*f[2],r[0]*f[1]-r[1]*f[0]];
  this.F=f;this.Rv=r;this.Uv=u;this.focal=this.h/2/Math.tan(this.dir.fov*PI/360);}
 proj(x,y,z){const e=this.dir.eye,a=[x-e[0],y-e[1],z-e[2]];const d=a[0]*this.F[0]+a[1]*this.F[1]+a[2]*this.F[2];if(d<.3)return null;const k=this.focal/d;return{x:this.w/2+(a[0]*this.Rv[0]+a[1]*this.Rv[1]+a[2]*this.Rv[2])*k,y:this.h/2-(a[0]*this.Uv[0]+a[1]*this.Uv[1]+a[2]*this.Uv[2])*k,k,d};}
 poly(pts,fill){const p=pts.map(q=>this.proj(...q));if(p.some(q=>!q))return;const c=this.ctx;c.beginPath();c.moveTo(p[0].x,p[0].y);for(const q of p)c.lineTo(q.x,q.y);c.closePath();c.fillStyle=fill;c.fill();}
 line(a,b,col,w){const p=this.proj(...a),q=this.proj(...b);if(!p||!q)return;const c=this.ctx;c.beginPath();c.moveTo(p.x,p.y);c.lineTo(q.x,q.y);c.strokeStyle=col;c.lineWidth=w;c.stroke();}
 scene(){const c=this.ctx;const g=c.createLinearGradient(0,0,0,this.h);g.addColorStop(0,'#0c1a26');g.addColorStop(1,'#13262f');c.fillStyle=g;c.fillRect(0,0,this.w,this.h);
  if(MD.Rules.PITCH.small){for(let i=0;i<5;i++){const z=-16-i*.9,y=.4+i*.45;this.poly([[-8,y,z],[6,y,z],[6,y+.45,z-.9],[-8,y+.45,z-.9]],i%2?'#8a5a32':'#9b6a3e');}this.poly([[-30,0,-24],[30,0,-24],[30,9,-24],[-30,9,-24]],'#e9e9e4');}
  else for(let i=0;i<10;i++){const z=-44-i*1.8,y=1+i*1.3;this.poly([[-70,y,z],[70,y,z],[70,y+1.3,z-1.8],[-70,y+1.3,z-1.8]],i%5===4?'#c99b36':i%2?'#1d4f80':'#245c90');}
  if(!MD.Rules.PITCH.small)for(const s of this.crowd){if(s.z>0)continue;const p=this.proj(s.x,s.y+1,s.z);if(!p||p.x<0||p.x>this.w)continue;c.fillStyle=['#4a96c1','#f0bc4c','#d9b2a0','#315e91','#86baa6','#eed27a'][Math.floor(s.c*6)];c.globalAlpha=.75;c.fillRect(p.x,p.y,Math.max(1,p.k*.25),Math.max(1,p.k*.35));}c.globalAlpha=1;
  const P=MD.Rules.PITCH,L=P.L,Wd=P.W,small=!!P.small,n=small?8:16,st=2*L/n;if(small){this.poly([[-L-6,0,-Wd-5],[L+6,0,-Wd-5],[L+6,0,Wd+5],[-L-6,0,Wd+5]],'#8b8b86');}
  for(let i=0;i<n;i++){const x=-L+i*st;this.poly([[x,0,-Wd],[x+st,0,-Wd],[x+st,0,Wd],[x,0,Wd]],small?(i%2?'#3f7d34':'#468a3a'):(i%2?'#2e7a4c':'#348853'));}
  const W=small?'#e8f0e0aa':'#eef7ee',lw=Math.max(1,this.h/400);this.line([-L,0,-Wd],[L,0,-Wd],W,lw);this.line([-L,0,Wd],[L,0,Wd],W,lw);this.line([-L,0,-Wd],[-L,0,Wd],W,lw);this.line([L,0,-Wd],[L,0,Wd],W,lw);this.line([0,0,-Wd],[0,0,Wd],W,lw);
  const R=P.arcR;for(let i=0;i<40;i++){const a=i/40*PI*2,b=(i+1)/40*PI*2;this.line([Math.cos(a)*R,0,Math.sin(a)*R],[Math.cos(b)*R,0,Math.sin(b)*R],W,lw);}
  const gw=P.goalHalfW,gh=P.goalH,nd=P.netDepth||2;
  for(const s of [-1,1]){const x=s*L;for(const [d,w] of [[P.boxDepth,P.boxHalfW],[P.sixDepth,P.sixHalfW]]){this.line([x,0,-w],[x-s*d,0,-w],W,lw);this.line([x-s*d,0,-w],[x-s*d,0,w],W,lw);this.line([x-s*d,0,w],[x,0,w],W,lw);}
   this.line([x,0,-gw],[x,gh,-gw],'#fff',lw*2);this.line([x,0,gw],[x,gh,gw],'#fff',lw*2);this.line([x,gh,-gw],[x,gh,gw],'#fff',lw*2);for(let k=0;k<=8;k++){const z=-gw+k*2*gw/8;this.line([x,gh,z],[x+s*nd,0,z],'#dfefeb66',1);}}}
 setVenue(v){this.venue=v;this.dir.bounds=v==='germinare'&&MD.GerminareScene?MD.GerminareScene.BOUNDS:null;}
 figure(x,z,f,kit,sp,dist,acts,t,number,fall){const p=this.proj(x,0,z),hd=this.proj(x,1.85,z);if(!p||!hd)return;const c=this.ctx,k=p.k;const sw=Math.sin(dist*2.9)*Math.min(1,sp/4)*k*.25;
  c.fillStyle='#0a1a1659';c.beginPath();c.ellipse(p.x,p.y,k*.45,k*.14,0,0,7);c.fill();
  if(fall){c.fillStyle=kit.primary;c.fillRect(p.x-k*.6,p.y-k*.35,k*1.2,k*.3);return;}
  const hip=this.proj(x,1,z);c.strokeStyle=kit.socks||kit.primary;c.lineWidth=Math.max(1.5,k*.16);c.lineCap='round';c.beginPath();c.moveTo(hip.x-k*.1,hip.y);c.lineTo(p.x-k*.12+sw,p.y);c.moveTo(hip.x+k*.1,hip.y);c.lineTo(p.x+k*.12-sw,p.y);c.stroke();
  c.fillStyle=kit.shorts||kit.secondary;c.fillRect(hip.x-k*.24,hip.y-k*.18,k*.48,k*.24);c.fillStyle=kit.primary;c.fillRect(hip.x-k*.27,hd.y+k*.18,k*.54,hip.y-hd.y-k*.3);
  c.fillStyle='#d9a37c';c.beginPath();c.arc(hd.x,hd.y,Math.max(1.5,k*.2),0,7);c.fill();
  if(k>14&&number!==undefined){c.fillStyle=MD.Kit.numberColor(kit);c.font=`900 ${clamp(k*.3,8,22)}px Arial`;c.textAlign='center';c.fillText(number,hip.x,hip.y-k*.3);}}
 renderTrack(tr,t,opts){opts=opts||{};this.resize();if(tr!==this.lastTrack||t<this.lastT-.05){this.dir.reset();this.lastTrack=tr;}this.lastT=t;const dt=opts.dt||1/60;
  t=clamp(t,0,tr.duration);const ff=t*tr.fps,f0=Math.min(tr.n-1,Math.floor(ff)),f1=Math.min(tr.n-1,f0+1),al=ff-f0;
  const bx=U.lerp(tr.bx[f0],tr.bx[f1],al),by=U.lerp(tr.by[f0],tr.by[f1],al),bz=U.lerp(tr.bz[f0],tr.bz[f1],al);
  const actors=tr.actors.map(a=>({x:U.lerp(a.x[f0],a.x[f1],al),z:U.lerp(a.z[f0],a.z[f1],al),f:U.angleLerp(a.f[f0],a.f[f1],al),hy:1.7}));
  this.dir.update(dt,t,{ball:[bx,by,bz],actors,goalSide:tr.goalSide,cut:tr.cuts.some(c=>c>t-dt*1.2&&c<=t)},tr.cams,opts.camMode,opts.replayCam);this.basis();this.scene();
  const order=tr.actors.map((a,i)=>i).sort((i,j)=>{const p=this.proj(actors[i].x,0,actors[i].z),q=this.proj(actors[j].x,0,actors[j].z);return(q?q.d:0)-(p?p.d:0);});
  for(const i of order){const a=tr.actors[i],s=actors[i];let kit;if(a.kind==='ref'||a.kind==='ar')kit={primary:'#151515',shorts:'#111',socks:'#111',secondary:'#f5d000'};else{const home=a.side==='home';kit=a.kind==='keeper'?(home?this.kits.homeGK:this.kits.away?this.kits.awayGK:{}):(home?this.kits.home:this.kits.away);kit={primary:kit.primary,shorts:kit.shortsColor,socks:kit.socksColor,secondary:kit.secondary,numberColor:kit.numberColor};}
   const fall=a.acts.some(x=>t>=x.t0+.5&&t<=x.t1-.6&&/^fall|gk_dive|slide|gk_down/.test(x.clip));this.figure(s.x,s.z,s.f,kit,U.lerp(a.v[f0],a.v[f1],al),U.lerp(a.d[f0],a.d[f1],al),a.acts,t,a.info?.data?.number,fall);}
  const sh=this.proj(bx,0,bz),bp=this.proj(bx,by,bz);if(sh&&bp){const c=this.ctx;c.fillStyle='#0a1a1660';c.beginPath();c.ellipse(sh.x,sh.y,sh.k*.2,sh.k*.07,0,0,7);c.fill();c.fillStyle='#fafaf2';c.beginPath();c.arc(bp.x,bp.y,clamp(bp.k*.13,2,20),0,7);c.fill();c.strokeStyle='#33424c';c.lineWidth=1;c.stroke();}}
 /* 0.6: partida contínua no modo Canvas 2D (mesmo mundo, desenho simplificado) */
 renderLive(V,opts){opts=opts||{};this.resize();const dt=opts.dt||1/60;const t=V.t;const [bx,by,bz]=V.ball;
  const actors=V.actors.map(a=>({x:a.x,z:a.z,f:a.f,hy:1.7}));this.dir.update(dt,t,{ball:V.ball,actors,goalSide:V.goalSide||1,cut:!!V.cut,focus:V.focus,attackDir:V.attackDir,ballVx:V.ballVx},V.cams||null,opts.camMode,null);this.basis();this.scene();
  const idx=V.actors.map((a,i)=>i).filter(i=>!V.actors[i].off).sort((i,j)=>{const p=this.proj(V.actors[i].x,0,V.actors[i].z),q=this.proj(V.actors[j].x,0,V.actors[j].z);return(q?q.d:0)-(p?p.d:0);});
  for(const i of idx){const a=V.actors[i],r=a.ref;let kit;if(r.kind==='ref'||r.kind==='ar')kit={primary:'#151515',shorts:'#111',socks:'#111',secondary:'#f5d000'};else{const home=r.side==='home';const k=r.kind==='keeper'?(home?this.kits.homeGK:this.kits.awayGK):(home?this.kits.home:this.kits.away);kit={primary:k.primary,shorts:k.shortsColor,socks:k.socksColor,secondary:k.secondary,numberColor:k.numberColor};}
   const acts=a.act?[a.act]:[];const fall=a.act&&t>=a.act.t0+.2&&t<=a.act.t1&&/^fall|gk_dive|slide|gk_down/.test(a.act.clip);this.figure(a.x,a.z,a.f,kit,a.sp,a.dist,acts,t,r.info&&r.info.data?r.info.data.number:'',fall);
   if(a.hl){const q=this.proj(a.x,0,a.z);if(q){const c=this.ctx;c.strokeStyle=`rgb(${a.hl.map(v=>v*255|0).join(',')})`;c.lineWidth=2.5;c.beginPath();c.ellipse(q.x,q.y,q.k*.6,q.k*.22,0,0,7);c.stroke();}}}
  const sh=this.proj(bx,0,bz),bp=this.proj(bx,by,bz);if(sh&&bp){const c=this.ctx;c.fillStyle='#0a1a1660';c.beginPath();c.ellipse(sh.x,sh.y,sh.k*.2,sh.k*.07,0,0,7);c.fill();c.fillStyle='#fafaf2';c.beginPath();c.arc(bp.x,bp.y,clamp(bp.k*.13,2,20),0,7);c.fill();c.strokeStyle='#33424c';c.lineWidth=1;c.stroke();}}
 project(x,y,z){const p=this.proj(x,y,z);return p?{x:p.x/(this.pr||1),y:p.y/(this.pr||1)}:null;}
 renderVersus(){const c=this.ctx;this.resize();c.clearRect(0,0,this.w,this.h);}
 renderStudio(){const c=this.ctx;this.resize();c.fillStyle='#10202a';c.fillRect(0,0,this.w,this.h);c.fillStyle='#cfe';c.font='700 14px Arial';c.textAlign='center';c.fillText('Prévia 3D indisponível (sem WebGL2)',this.w/2,this.h/2);}
}
MD.Renderer2D=Renderer2D;
})(window.MD=window.MD||{});
