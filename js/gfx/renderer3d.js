/* MATCHDAY 0.5 — renderizador 3D principal (WebGL2, sem engine).
   Por quadro: 1 draw do estádio, 1 da torcida, 1 das bandeiras, 1 das partículas e ~1 por primitiva instanciada.
   Personagens: poses calculadas na CPU em arrays pré-alocados; frustum culling e 3 níveis de detalhe. */
(function(MD){
'use strict';
const U=MD.U,M=U.M,G=MD.GL,A=MD.Anim,CH=MD.Character,K=MD.Kit,clamp=U.clamp,PI=Math.PI;
const LOW=new Set(['knee_slide','kneel','gk_down','gk_slap','fall_trip','fall_push','fall_slide','slide','gk_dive']);
const ENV_ARENA={clear:[.05,.09,.13],sun:[-.42,.82,.38],sky:[.78,.86,1],ground:[.36,.42,.36],fog:[.09,.15,.21],exposure:1.04};
const QUALITY={low:{pr:.7,crowd:1800,lod:[9,26],particles:240,flags:true},medium:{pr:1,crowd:3800,lod:[15,42],particles:600,flags:true},high:{pr:1.5,crowd:6500,lod:[24,62],particles:1100,flags:true}};
class Renderer3D{
 constructor(canvas,opts){opts=opts||{};this.canvas=canvas;this.studio=!!opts.studio;
  const gl=canvas.getContext('webgl2',{antialias:true,alpha:!!opts.alpha,premultipliedAlpha:false,powerPreference:'high-performance',preserveDrawingBuffer:!!opts.preserve});if(!gl)throw Error('WebGL2 indisponível');this.gl=gl;
  this.quality='auto';this.q=QUALITY.medium;this.pr=1;this.autoPR=1;this.ema=16;this.goodTime=0;this.badTime=0;
  this.stats={fps:0,ms:0,draws:0,instances:0,tris:0,pr:1,quality:'auto',gpu:''};this.lost=false;
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.lost=true;},false);
  canvas.addEventListener('webglcontextrestored',()=>{this.lost=false;const v=this.venueId;this.init();if(v&&v!=='arena')this.setVenue(v);if(this.teamsArgs)this.setTeams(...this.teamsArgs);},false);
  this.init();}
 init(){const gl=this.gl;
  this.P=G.program(gl,G.PART_VS,G.PART_FS);this.S=G.program(gl,G.STATIC_VS,G.STATIC_FS);this.CR=G.program(gl,G.CROWD_VS,G.CROWD_FS);this.FL=G.program(gl,G.FLAG_VS,G.FLAG_FS);this.FX=G.program(gl,G.PART_FX_VS,G.PART_FX_FS);
  this.meshes=MD.Meshes.build(gl);this.B={};for(const k in this.meshes)this.B[k]=new G.Batch(gl,this.meshes[k],k==='sphere'?512:k==='quad'?256:128);
  this.B.shadow=new G.Batch(gl,this.meshes.disc,64);
  this.atlas=new G.Atlas(gl);this.charR=new CH.CharacterRenderer(this.B,this.atlas);
  ['block','classic','round','condensed'].forEach((f,i)=>this.atlas.upload(G.SLOT.GLYPH0+i,K.glyphCanvas(f)));
  this.atlas.upload(G.SLOT.MISC,K.ballCanvas());this.ballUV=this.atlas.rect(G.SLOT.MISC,0,0,512,256);
  this.screenCanvas=K.screenCanvas(null,{home:'MD',away:'MD',hs:0,as:0,clock:'00:00'});this.atlas.upload(G.SLOT.SCREEN,this.screenCanvas);this.screenKey='';this.screenT=0;
  this.atlas.upload(G.SLOT.ADS,K.adsCanvas());
  this.venues={};this.venueId=null;this.env=ENV_ARENA;this.V=MD.Stadium;
  if(this.studio){const b=new G.StaticBuilder();const n=48;for(let i=0;i<n;i++){const a=i/n*PI*2,c=(i+1)/n*PI*2;b.quad([0,0,0],[Math.cos(c)*2.2,0,Math.sin(c)*2.2],[Math.cos(a)*2.2,0,Math.sin(a)*2.2],[0,0,0],[.16,.36,.33],0);}
   for(let i=0;i<n;i++){const a=i/n*PI*2,c=(i+1)/n*PI*2;b.quad([Math.cos(a)*2.2,.002,Math.sin(a)*2.2],[Math.cos(c)*2.2,.002,Math.sin(c)*2.2],[Math.cos(c)*2.28,.01,Math.sin(c)*2.28],[Math.cos(a)*2.28,.01,Math.sin(a)*2.28],[.55,.72,.22],0);}
   b.quad([-30,-.02,-30],[30,-.02,-30],[30,-.02,30],[-30,-.02,30],[.1,.19,.23],0);this.stadium=b.build(gl);}
  /* torcida, bandeiras e partículas */
  this.quad2=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.quad2);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-.5,0,.5,0,.5,1,-.5,0,.5,1,-.5,1]),gl.STATIC_DRAW);
  this.crowdVAO=gl.createVertexArray();this.crowdBuf=gl.createBuffer();this.crowdN=0;
  gl.bindVertexArray(this.crowdVAO);gl.bindBuffer(gl.ARRAY_BUFFER,this.quad2);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ARRAY_BUFFER,this.crowdBuf);
  gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,4,gl.FLOAT,false,32,0);gl.vertexAttribDivisor(1,1);gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,4,gl.FLOAT,false,32,16);gl.vertexAttribDivisor(2,1);gl.bindVertexArray(null);
  const grid=[];const gu=10,gv=5;for(let j=0;j<gv;j++)for(let i=0;i<gu;i++){const a=[i/gu,j/gv],b=[(i+1)/gu,j/gv],c=[(i+1)/gu,(j+1)/gv],d=[i/gu,(j+1)/gv];grid.push(...a,...b,...c,...a,...c,...d);}
  this.flagGridN=grid.length/2;this.flagGrid=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.flagGrid);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(grid),gl.STATIC_DRAW);
  this.flagVAO=gl.createVertexArray();this.flagBuf=gl.createBuffer();this.flagN=0;gl.bindVertexArray(this.flagVAO);gl.bindBuffer(gl.ARRAY_BUFFER,this.flagGrid);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
  gl.bindBuffer(gl.ARRAY_BUFFER,this.flagBuf);for(let k=0;k<4;k++){gl.enableVertexAttribArray(1+k);gl.vertexAttribPointer(1+k,4,gl.FLOAT,false,64,k*16);gl.vertexAttribDivisor(1+k,1);}gl.bindVertexArray(null);
  this.fxCap=1200;this.fxData=new Float32Array(this.fxCap*12);this.fxHead=0;this.fxVAO=gl.createVertexArray();this.fxBuf=gl.createBuffer();gl.bindVertexArray(this.fxVAO);gl.bindBuffer(gl.ARRAY_BUFFER,this.quad2);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
  gl.bindBuffer(gl.ARRAY_BUFFER,this.fxBuf);gl.bufferData(gl.ARRAY_BUFFER,this.fxData,gl.DYNAMIC_DRAW);for(let k=0;k<3;k++){gl.enableVertexAttribArray(1+k);gl.vertexAttribPointer(1+k,4,gl.FLOAT,false,48,k*16);gl.vertexAttribDivisor(1+k,1);}gl.bindVertexArray(null);
  for(let i=0;i<this.fxCap;i++)this.fxData[i*12+3]=-1e6;
  const dbg=gl.getExtension('WEBGL_debug_renderer_info');this.stats.gpu=dbg?gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL):'WebGL2';
  this.dir=new MD.Camera.Director();this.vp=new Float32Array(16);this.proj=new Float32Array(16);this.view=new Float32Array(16);this.planes=new Float32Array(24);this.pose=new Float32Array(A.N);this.face=new Float32Array(8);
  this.descCache=new Map();this.excite=[.15,.15];this.flash=0;this.net=[[0,0,0,0],[0,0,0,0]];this.lastT=-1;this.lastTrack=null;this.time=0;this.prevNow=0;
  if(!this.studio)this.setVenue('arena');}
 /* Cenário (estádio profissional ou escola Germinare): malha estática construída uma vez e reaproveitada */
 setVenue(id){id=id||'arena';if(this.studio)return;if(this.venueId===id&&this.stadium)return;const gl=this.gl;
  if(!this.venues[id]){const V=id==='germinare'&&MD.GerminareScene?MD.GerminareScene:MD.Stadium;this.venues[id]={mesh:V.build(gl),V};}
  const v=this.venues[id];this.venueId=id;this.stadium=v.mesh;this.V=v.V;this.env=v.V.ENV||ENV_ARENA;this.dir.bounds=v.V.BOUNDS||null;
  if(this.crowdArgs)this.buildCrowd(...this.crowdArgs);if(this.home&&this.away)this.buildFlags(this.home,this.away);}
 setQuality(q){this.quality=q||'auto';this.q=QUALITY[q]||QUALITY.medium;if(this.crowdArgs)this.buildCrowd(...this.crowdArgs);this.stats.quality=this.quality;}
 /* Uniformes no atlas, torcida e bandeiras com as cores dos clubes */
 setTeams(home,away,kits){this.teamsArgs=[home,away,kits];this.home=home;this.away=away;this.kits=kits=kits||K.pickKits(home,away);
  const paint=(slot,kit,crest)=>{const c=document.createElement('canvas');c.width=c.height=512;K.paint(c,kit,crest);this.atlas.upload(slot,c);};
  paint(G.SLOT.HOME,kits.home,home.crest);paint(G.SLOT.AWAY,kits.away,away.crest);paint(G.SLOT.HOME_GK,kits.homeGK,home.crest);paint(G.SLOT.AWAY_GK,kits.awayGK,away.crest);this.refKit=K.refKit(kits.home,kits.away);paint(G.SLOT.REF,this.refKit,null);
  this.atlas.upload(G.SLOT.ADS,K.adsCanvas(home,away));this.descCache.clear();
  if(!this.studio){this.crowdArgs=[home,away];this.buildCrowd(home,away);this.buildFlags(home,away);}}
 repaintKits(){if(this.teamsArgs)this.setTeams(...this.teamsArgs);}
 buildCrowd(home,away){const gl=this.gl;const c=(this.V||MD.Stadium).crowd(this.q.crowd,home,away,9);gl.bindBuffer(gl.ARRAY_BUFFER,this.crowdBuf);gl.bufferData(gl.ARRAY_BUFFER,c.data,gl.STATIC_DRAW);this.crowdN=c.count;}
 buildFlags(home,away){const gl=this.gl;const list=(this.V||MD.Stadium).flags(home,away);const d=new Float32Array(list.length*16);list.forEach((f,i)=>d.set(f,i*16));gl.bindBuffer(gl.ARRAY_BUFFER,this.flagBuf);gl.bufferData(gl.ARRAY_BUFFER,d,gl.STATIC_DRAW);this.flagN=list.length;}
 kitDesc(slot,kit,role,sleeves){const a=this.atlas,R=(x,y,w,h)=>a.rect(slot,x,y,w,h);return{uvShirt:R(0,0,512,320),uvSleeveL:R(0,320,128,96),uvSleeveR:R(128,320,128,96),uvShorts:R(256,320,256,128),uvSocks:R(0,416,256,96),
  sleeves:sleeves||kit.sleeves,font:['block','classic','round','condensed'].indexOf(kit.numberFont||'block'),showName:kit.showName,colors:{primary:kit.primary,secondary:kit.secondary,accent:kit.accent,sleeve:K.sleeveColor(kit),shorts:kit.shortsColor,socks:kit.socksColor,number:K.numberColor(kit),gloves:role==='keeper'?(kit.secondary||'#ffffff'):'#f2f2f2'}};}
 /* Descritor de um ator da trilha (cache): proporções, cores e uniforme */
 desc(a){const key=a.id+'|'+a.side+'|'+a.kind;let d=this.descCache.get(key);if(d)return d;const info=a.info||{};const data=info.data||{};const app=data.appearance||{};
  let kd;if(a.kind==='ref'||a.kind==='ar')kd=this.kitDesc(G.SLOT.REF,this.refKit,'ref');else{const home=a.side==='home';const gk=a.kind==='keeper';const kit=gk?(home?this.kits.homeGK:this.kits.awayGK):(home?this.kits.home:this.kits.away);
   kd=this.kitDesc(gk?(home?G.SLOT.HOME_GK:G.SLOT.AWAY_GK):(home?G.SLOT.HOME:G.SLOT.AWAY),kit,gk?'keeper':'player');}
  const refApp={skin:['#c98c62','#f1c6a4','#7b4a32'][U.hashStr(a.id)%3],hairColor:'#1d1d1d',hairStyle:a.kind==='ref'?'short':'fade',beardStyle:'none',height:1.02,headSize:1.05,bodyWidth:1,bootColor:'#111111'};
  const ap=a.kind==='ref'||a.kind==='ar'?refApp:app;
  const surname=String(data.name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().split(/\s+/).pop()||'';
  d={p:CH.proportions(ap),app:ap,colors:CH.colors(ap,kd.colors),kit:kd,number:a.kind==='ref'||a.kind==='ar'?undefined:data.number,name:surname,role:a.kind,seed:(U.hashStr(a.id)%1000)/97,lod:0,x:0,z:0,yaw:0};
  this.descCache.set(key,d);return d;}
 resize(){const c=this.canvas,dpr=(typeof devicePixelRatio!=='undefined'?devicePixelRatio:1);const base=this.quality==='auto'?Math.min(dpr,1.5)*this.autoPR:Math.min(dpr,this.q.pr);this.pr=clamp(base,.45,2);
  const r=c.getBoundingClientRect();const w=Math.max(2,Math.round(r.width*this.pr)),h=Math.max(2,Math.round(r.height*this.pr));if(c.width!==w||c.height!==h){c.width=w;c.height=h;}this.gl.viewport(0,0,w,h);return[w,h];}
 adapt(ms,dt){if(this.quality!=='auto')return;this.ema=this.ema*.92+ms*.08;const frame=dt*1000;
  if(frame>24){this.badTime+=dt;this.goodTime=0;}else if(frame<15){this.goodTime+=dt;this.badTime=0;}
  if(this.badTime>1){this.autoPR=Math.max(.5,this.autoPR*.88);this.badTime=0;}if(this.goodTime>3){this.autoPR=Math.min(1,this.autoPR*1.06);this.goodTime=0;}}
 camera(w,h,eye,tgt,fov){M.perspective(this.proj,fov*PI/180,w/h,.3,420);M.lookAt(this.view,eye,tgt,[0,1,0]);M.mul(this.vp,this.proj,this.view);M.frustum(this.vp,this.planes);this.eye=eye;
  const r=[this.view[0],this.view[4],this.view[8]],u=[this.view[1],this.view[5],this.view[9]];this.right=r;this.up=u;}
 common(prog){const gl=this.gl,u=prog.u;gl.useProgram(prog.p);gl.uniformMatrix4fv(u.uVP,false,this.vp);if(u.uEye)gl.uniform3fv(u.uEye,this.eye);
  const ev=this.env||ENV_ARENA;if(u.uSun)gl.uniform3fv(u.uSun,ev.sun);if(u.uSky)gl.uniform3fv(u.uSky,ev.sky);if(u.uGround)gl.uniform3fv(u.uGround,ev.ground);if(u.uFog)gl.uniform3fv(u.uFog,ev.fog);
  if(u.uFlash)gl.uniform1f(u.uFlash,this.flash);if(u.uExposure)gl.uniform1f(u.uExposure,ev.exposure);if(u.uTime)gl.uniform1f(u.uTime,this.time);
  if(u.uAtlas){gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.atlas.tex);gl.uniform1i(u.uAtlas,0);}}
 drawStatic(){const gl=this.gl,u=this.S.u;this.common(this.S);gl.uniform4fv(u.uNet0,this.net[0]);gl.uniform4fv(u.uNet1,this.net[1]);
  gl.uniform4fv(u.uScreenRect,this.atlas.rect(G.SLOT.SCREEN,0,0,512,256));gl.uniform4fv(u.uAdsRect,this.atlas.rect(G.SLOT.ADS,0,0,512,512));
  gl.bindVertexArray(this.stadium.vao);gl.drawElements(gl.TRIANGLES,this.stadium.count,this.stadium.type,0);this.stats.draws++;this.stats.tris+=this.stadium.tris;}
 drawCrowdFlags(){const gl=this.gl;if(this.crowdN){this.common(this.CR);gl.uniform3fv(this.CR.u.uRight,this.right);gl.uniform2f(this.CR.u.uExcite,this.excite[0],this.excite[1]);gl.bindVertexArray(this.crowdVAO);gl.drawArraysInstanced(gl.TRIANGLES,0,6,this.crowdN);this.stats.draws++;this.stats.instances+=this.crowdN;}
  if(this.flagN&&this.q.flags){this.common(this.FL);gl.uniform1f(this.FL.u.uWave,Math.max(this.excite[0],this.excite[1])*.8);gl.bindVertexArray(this.flagVAO);gl.drawArraysInstanced(gl.TRIANGLES,0,this.flagGridN,this.flagN);this.stats.draws++;}}
 drawParts(){const gl=this.gl;this.common(this.P);let inst=0;for(const k in this.B){if(k==='shadow')continue;const b=this.B[k];if(!b.n)continue;inst+=b.n;this.stats.tris+=b.mesh.tris*b.n;b.flush();this.stats.draws++;}
  if(this.B.shadow.n){gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);inst+=this.B.shadow.n;this.B.shadow.flush();this.stats.draws++;gl.depthMask(true);gl.disable(gl.BLEND);}this.stats.instances+=inst;}
 drawFX(){const gl=this.gl;this.common(this.FX);gl.uniform3fv(this.FX.u.uRight,this.right);gl.uniform3fv(this.FX.u.uUp,this.up);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);gl.depthMask(false);
  gl.bindVertexArray(this.fxVAO);gl.drawArraysInstanced(gl.TRIANGLES,0,6,this.fxCap);gl.depthMask(true);gl.disable(gl.BLEND);this.stats.draws++;}
 spawnFX(side,intensity,opt){opt=opt||{};const gs=side;const fxv=(this.V&&this.V.FX)||{x:100,z:[48,10],fy:[24,8],cz:[42,14],cy:[3,10],cx:110};const col=U.hex2rgb((side>0?this.home:this.away)?.primary||'#cbff4d');const col2=U.hex2rgb((side>0?this.home:this.away)?.secondary||'#ffffff');const r=Math.random;const n=Math.round(this.q.particles*(.5+intensity*.5)*(opt.mul||1));const d=this.fxData;
  for(let i=0;i<n;i++){const k=(this.fxHead++)%this.fxCap,o=k*12;const fire=i%4===0;const cc=fire?[1,.85+r()*.15,.4+r()*.4]:r()<.5?col:r()<.5?col2:[1,1,1];
   if(opt.center){const x=(opt.center[0]||0)+(r()-.5)*(opt.spread||8),z=(opt.center[2]||0)+(r()-.5)*(opt.spread||8),y=(opt.center[1]||6)+r()*4;d.set([x,y,z,this.time+r()*(opt.span||1.2),(r()-.5)*4,r()*3-1,(r()-.5)*4,4+r()*3,cc[0],cc[1],cc[2],fire?.15:.12],o);continue;}
   if(fire){const bx=(r()-.5)*fxv.x,bz=(r()<.5?-1:1)*(fxv.z[0]+r()*fxv.z[1]),by=fxv.fy[0]+r()*fxv.fy[1];const a=r()*PI*2,b=r()*PI;const sp=6+r()*4;d.set([bx,by,bz,this.time+r()*1.5,Math.cos(a)*Math.sin(b)*sp,Math.cos(b)*sp,Math.sin(a)*Math.sin(b)*sp,1.6+r()*.6,cc[0],cc[1],cc[2],.15],o);}
   else{const x=(r()-.5)*fxv.cx,z=(r()<.5?-1:1)*(fxv.cz[0]+r()*fxv.cz[1]),y=fxv.cy[0]+r()*fxv.cy[1];d.set([x,y,z,this.time+r()*.6,(r()-.5)*3,4+r()*6,(r()-.5)*3,4+r()*3,cc[0],cc[1],cc[2],.12],o);}}
  const gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,this.fxBuf);gl.bufferSubData(gl.ARRAY_BUFFER,0,this.fxData);}
 updateScreen(st){if(!st)return;const key=JSON.stringify({...st,t:st.goal?Math.floor(st.t*4):0});if(key===this.screenKey||this.time-this.screenT<.2&&!st.goal)return;this.screenKey=key;this.screenT=this.time;K.screenCanvas(this.screenCanvas,st);this.atlas.upload(G.SLOT.SCREEN,this.screenCanvas,0,0);}
 /* Amostra a trilha no instante t e desenha. opts: {camMode, replayCam, screen, dt, noFX} */
 renderTrack(tr,t,opts){if(this.lost||!tr)return;opts=opts||{};const t0=performance.now();const gl=this.gl;const [w,h]=this.resize();this.stats.draws=0;this.stats.instances=0;this.stats.tris=0;
  const dt=clamp(opts.dt??1/60,0,.1);this.time+=dt;
  t=clamp(t,0,tr.duration);const ff=t*tr.fps,f0=Math.min(tr.n-1,Math.floor(ff)),f1=Math.min(tr.n-1,f0+1),al=ff-f0;
  /* eventos da trilha (som/efeitos ficam no app; aqui apenas visuais) */
  if(tr!==this.lastTrack||t<this.lastT-.05){this.lastT=t-1e-3;this.lastTrack=tr;this.dir.reset();}
  for(const mk of tr.marks){if(mk.t>this.lastT&&mk.t<=t){if(mk.type==='goal'){this.flash=1;this.excite[mk.side==='home'?0:1]=1;}
   if(mk.type==='net'&&mk.at){const i=mk.at[0]>0?0:1;this.net[i]=[mk.at[0],mk.at[1],mk.at[2],1];}
   if(mk.type==='crowd_oh'||mk.type==='save'||mk.type==='post'){this.excite[0]=Math.max(this.excite[0],.55);this.excite[1]=Math.max(this.excite[1],.55);}
   if(mk.type==='crowd_up'){this.excite[0]=Math.max(this.excite[0],.7);this.excite[1]=Math.max(this.excite[1],.7);}
   if(mk.type==='fx_goal'&&!opts.noFX)this.spawnFX(mk.side==='home'?1:-1,mk.intensity||.6);
   if(mk.type==='fx_burst'&&!opts.noFX)this.spawnFX(mk.side==='away'?-1:1,mk.intensity||1,{center:mk.at,spread:mk.spread,mul:mk.mul||.6,span:mk.span});
   if(mk.type==='crowd_hype'){this.excite[0]=Math.max(this.excite[0],mk.k||.8);this.excite[1]=Math.max(this.excite[1],mk.k||.8);}
   if(mk.type==='flash'){this.flash=Math.max(this.flash,mk.k||.6);}}}
  this.lastT=t;this.flash=Math.max(0,this.flash-dt*1.6);for(let i=0;i<2;i++){this.excite[i]=Math.max(.14,this.excite[i]-dt*.12);this.net[i][3]=Math.max(0,this.net[i][3]-dt*.9);}
  /* bola */
  const bx=U.lerp(tr.bx[f0],tr.bx[f1],al),by=U.lerp(tr.by[f0],tr.by[f1],al),bz=U.lerp(tr.bz[f0],tr.bz[f1],al);
  const sample={ball:[bx,by,bz],actors:[],goalSide:tr.goalSide,ballVx:(tr.bx[f1]-tr.bx[f0])*tr.fps,cut:tr.cuts.some(c=>c>t-dt*1.2&&c<=t+1e-6)};
  for(const a of tr.actors){const x=U.lerp(a.x[f0],a.x[f1],al),z=U.lerp(a.z[f0],a.z[f1],al),f=U.angleLerp(a.f[f0],a.f[f1],al);const d=this.desc(a);let low=1;for(const ac of a.acts){if(ac.t0>t)break;if(t<=ac.t1&&LOW.has(ac.clip))low=.58;}sample.actors.push({x,z,f,hy:(d.p.total-d.p.R*.9)*low});}
  this.dir.update(dt,t,sample,tr.cams,opts.camMode,opts.replayCam);this.camera(w,h,this.dir.eye,this.dir.tgt,this.dir.fov);
  this.updateScreen(opts.screen);this.atlas.mip();
  const cc=(this.env||ENV_ARENA).clear;gl.clearColor(cc[0],cc[1],cc[2],1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);
  this.drawStatic();this.drawCrowdFlags();
  /* atores */
  const P=this.pose,F=this.face;const lod=this.q.lod;
  const noAR=!!MD.Rules.PITCH.small;
  for(let i=0;i<tr.actors.length;i++){const a=tr.actors[i],s=sample.actors[i];if(noAR&&a.kind==='ar')continue;const d=this.desc(a);if(!M.sphereVisible(this.planes,s.x,1,s.z,1.6))continue;
   const dist=Math.hypot(s.x-this.eye[0],1-this.eye[1],s.z-this.eye[2])*(this.dir.fov/38);d.lod=dist<lod[0]?0:dist<lod[1]?1:2;d.x=s.x;d.z=s.z;d.yaw=s.f;
   const sp=U.lerp(a.v[f0],a.v[f1],al),ds=U.lerp(a.d[f0],a.d[f1],al);const turn=U.wrapAngle(a.f[f1]-a.f[f0])*tr.fps;
   A.locomotion(P,sp,ds,t,d.seed,turn);
   for(const act of a.acts){if(act.t0>t)break;if(t<=act.t1)A.applyAction(P,act,t);}
   /* olhar para a bola */
   const look=U.wrapAngle(Math.atan2(bz-s.z,bx-s.x)-s.f);P[A.HY]+=clamp(look,-1.1,1.1)*.6*(1-Math.min(1,Math.abs(P[A.RP])));
   const base=a.kind==='ref'||a.kind==='ar'?'neutral':((a.info&&a.info.energy<.45)?'tired':'concentrated');A.face(F,a.emos,t,base);
   d.mouthAdd=P[A.MO];d.prop=null;for(const act of a.acts){if(t>=act.t0&&t<=act.t1){if(act.clip==='show_card')d.prop={card:act.p.color};}}if(a.kind==='ar')d.prop={flag:true};
   this.charR.draw(d,P,F,this.time);}
  if(tr.props&&tr.props.length)this.drawProps(tr,t,sample);
  /* bola + sombra */
  const bm=this.bm||(this.bm=new Float32Array(16));M.identity(bm);M.translate(bm,bm,bx,by,bz);const hh=U.lerp(tr.bh[f0],tr.bh[f1],al);M.rotY(bm,bm,PI/2-hh);M.rotX(bm,bm,U.lerp(tr.bs[f0],tr.bs[f1],al));M.scale(bm,bm,.11,.11,.11);this.B.sphere.push(bm,1,1,1,2,this.ballUV);
  M.identity(bm);M.translate(bm,bm,bx+by*.25,.021,bz+by*.2);M.scale(bm,bm,.36+by*.08,1,.32+by*.08);this.B.shadow.push(bm,clamp(.4-by*.08,.08,.4),0,0,5,null);
  this.drawParts();this.drawFX();
  const ms=performance.now()-t0;this.stats.ms=this.stats.ms*.9+ms*.1;this.adapt(ms,dt);}
 /* ---------- 0.6: partida contínua (mundo autoritativo). V: {t, ball:[x,y,z], ballH, ballS, ballVx, actors:[{ref,x,z,f,sp,dist,turn,act,off,hl}], fx:[], cams, goalSide, cut} ---------- */
 renderLive(V,opts){if(this.lost||!V)return;opts=opts||{};const t0=performance.now();const gl=this.gl;const [w,h]=this.resize();this.stats.draws=0;this.stats.instances=0;this.stats.tris=0;
  const dt=clamp(opts.dt??1/60,0,.1);this.time+=dt;const t=V.t;
  for(const mk of V.fx||[]){if(mk.type==='goal'){this.flash=1;this.excite[mk.side==='home'?0:1]=1;if(!opts.noFX)this.spawnFX(mk.at&&mk.at[0]>0?1:-1,.8);}
   if(mk.type==='net'&&mk.at){const i=mk.at[0]>0?0:1;this.net[i]=[mk.at[0],mk.at[1],mk.at[2],1];}
   if(mk.type==='save'||mk.type==='post'||mk.type==='miss'){this.excite[0]=Math.max(this.excite[0],.55);this.excite[1]=Math.max(this.excite[1],.55);}
   if(mk.type==='shot'){this.excite[0]=Math.max(this.excite[0],.4);this.excite[1]=Math.max(this.excite[1],.4);}}
  this.flash=Math.max(0,this.flash-dt*1.6);for(let i=0;i<2;i++){this.excite[i]=Math.max(.14,this.excite[i]-dt*.12);this.net[i][3]=Math.max(0,this.net[i][3]-dt*.9);}
  const [bx,by,bz]=V.ball;const sample={ball:V.ball,actors:[],goalSide:V.goalSide||1,ballVx:V.ballVx||0,cut:!!V.cut,focus:V.focus||null,attackDir:V.attackDir||1};
  for(const a of V.actors){const d=this.desc(a.ref);const low=a.act&&LOW.has(a.act.clip)&&t>=a.act.t0&&t<=a.act.t1?.58:1;sample.actors.push({x:a.x,z:a.z,f:a.f,hy:(d.p.total-d.p.R*.9)*low});}
  this.dir.update(dt,t,sample,V.cams||null,opts.camMode,opts.replayCam);const E=this.dir.eye.slice();if(opts.camZoom&&opts.camZoom!==1){const k=opts.camZoom;for(let i=0;i<3;i++)E[i]=this.dir.tgt[i]+(E[i]-this.dir.tgt[i])*k;}if(opts.camHeight&&opts.camHeight!==1)E[1]=Math.max(.6,this.dir.tgt[1]+(E[1]-this.dir.tgt[1])*opts.camHeight);this.camEye=E;
  this.camera(w,h,E,this.dir.tgt,this.dir.fov);this.updateScreen(opts.screen);this.atlas.mip();
  const cc=(this.env||ENV_ARENA).clear;gl.clearColor(cc[0],cc[1],cc[2],1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);
  this.drawStatic();this.drawCrowdFlags();
  const P=this.pose,F=this.face;const lod=this.q.lod;const noAR=!!MD.Rules.PITCH.small;
  for(const a of V.actors){if(a.off)continue;const ref=a.ref;if(noAR&&ref.kind==='ar')continue;const d=this.desc(ref);if(!M.sphereVisible(this.planes,a.x,1,a.z,1.6))continue;
   const dist=Math.hypot(a.x-this.eye[0],1-this.eye[1],a.z-this.eye[2])*(this.dir.fov/38);d.lod=dist<lod[0]?0:dist<lod[1]?1:2;d.x=a.x;d.z=a.z;d.yaw=a.f;
   A.locomotion(P,a.sp,a.dist,t,d.seed,a.turn||0);if(a.act&&t>=a.act.t0&&t<=a.act.t1)A.applyAction(P,a.act,t);
   const look=U.wrapAngle(Math.atan2(bz-a.z,bx-a.x)-a.f);P[A.HY]+=clamp(look,-1.1,1.1)*.6*(1-Math.min(1,Math.abs(P[A.RP])));
   const info=ref.info||{};const base=ref.kind==='ref'||ref.kind==='ar'?'neutral':(info.energy!==undefined&&info.energy<.45?'tired':'concentrated');A.face(F,ref.emos,t,base);
   d.mouthAdd=P[A.MO];d.prop=null;if(a.act&&a.act.clip==='show_card'&&t<=a.act.t1)d.prop={card:(a.act.p&&a.act.p.color)||'yellow'};if(ref.kind==='ar')d.prop={flag:true};
   this.charR.draw(d,P,F,this.time);}
  const bm=this.bm||(this.bm=new Float32Array(16));M.identity(bm);M.translate(bm,bm,bx,by,bz);M.rotY(bm,bm,PI/2-(V.ballH||0));M.rotX(bm,bm,V.ballS||0);M.scale(bm,bm,.11,.11,.11);this.B.sphere.push(bm,1,1,1,2,this.ballUV);
  M.identity(bm);M.translate(bm,bm,bx+by*.25,.021,bz+by*.2);M.scale(bm,bm,.36+by*.08,1,.32+by*.08);this.B.shadow.push(bm,clamp(.4-by*.08,.08,.4),0,0,5,null);
  /* indicadores dos atletas controlados (anel no gramado na cor do jogador humano) */
  for(const a of V.actors){if(!a.hl||a.off)continue;const c=a.hl;for(let k=0;k<10;k++){const an=k/10*PI*2+this.time*1.4;M.identity(bm);M.translate(bm,bm,a.x+Math.cos(an)*.62,.03,a.z+Math.sin(an)*.62);M.scale(bm,bm,.13,.02,.13);this.B.box.push(bm,c[0],c[1],c[2],10,null);}}
  this.drawParts();this.drawFX();
  const ms=performance.now()-t0;this.stats.ms=this.stats.ms*.9+ms*.1;this.adapt(ms,dt);}
 /* projeção de um ponto do mundo para a tela (pixels CSS) — usada pelo HUD */
 project(x,y,z){const m=this.vp;const cx=m[0]*x+m[4]*y+m[8]*z+m[12],cy=m[1]*x+m[5]*y+m[9]*z+m[13],cw=m[3]*x+m[7]*y+m[11]*z+m[15];if(cw<=.01)return null;const r=this.canvas.getBoundingClientRect();return{x:(cx/cw*.5+.5)*r.width,y:(1-(cy/cw*.5+.5))*r.height};}
 /* ---------- 0.6: tela de confronto (dois atletas em destaque, poses variadas, uniformes do estúdio) ---------- */
 renderVersus(list,opts){if(this.lost)return;opts=opts||{};const gl=this.gl;const [w,h]=this.resize();const dt=opts.dt||1/60;this.time+=dt;this.stats.draws=0;this.stats.instances=0;this.stats.tris=0;
  const asp=w/h;const spread=clamp(asp*1.15,1.45,2.75);const eye=[0,1.32,7.4],tgt=[0,1.02,0];this.camera(w,h,eye,tgt,opts.fov||27);this.atlas.mip();
  gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);
  const P=this.pose,F=this.face;const bm=this.bm||(this.bm=new Float32Array(16));
  list.forEach((it,i)=>{const sx=i===0?-spread:spread;const d=this.desc(it.ref);d.lod=0;d.x=sx;d.z=.2;d.yaw=PI/2+(i===0?-.42:.42)+Math.sin(this.time*.4+i)*.04;
   A.locomotion(P,0,0,this.time,d.seed,0);const dur=it.dur||3.2;const tt=this.time%(dur*3);if(it.clip)A.applyAction(P,{clip:it.clip,t0:0,t1:dur*3,p:{side:1,height:1.2}},Math.min(tt,dur*3-.05));
   P[A.HY]+=(i===0?.35:-.35)*(.6+.4*Math.sin(this.time*.3+i*2));/* olha para o adversário de vez em quando */
   A.face(F,[{e:it.emotion||'concentrated',t0:-1,t1:1e9,k:1}],this.time,'concentrated');d.mouthAdd=P[A.MO];d.prop=null;this.charR.draw(d,P,F,this.time);
   M.identity(bm);M.translate(bm,bm,sx,.02,.2);M.scale(bm,bm,.9,1,.6);this.B.shadow.push(bm,.38,0,0,5,null);});
  this.drawParts();}
 /* Adereços das cerimônias: troféu MATCHDAY (original), pedestal e pódio. Seguem um ator quando segurados. */
 drawProps(tr,t,sample){const bm=this.pm||(this.pm=new Float32Array(16));for(const p of tr.props){if(t<(p.t0??0)||t>(p.t1??1e9))continue;
   let x=p.at?p.at[0]:0,y=p.at?p.at[1]:0,z=p.at?p.at[2]:0;
   if(p.actor!==undefined&&p.actor>=0&&sample.actors[p.actor]){const a=sample.actors[p.actor];let lift=0;if(p.lift){for(const q of p.lift)if(t>=q[0]&&t<=q[1]){const u=Math.min(1,(t-q[0])/.7,(q[1]-t)/.4);lift=Math.max(lift,u*u*(3-2*u));}}
    const hold=1.02+lift*(a.hy*1.0-0.55);x=a.x+Math.cos(a.f)*.34*(1-lift);z=a.z+Math.sin(a.f)*.34*(1-lift);y=hold;}
   if(p.type==='trophy')this.trophy(bm,x,y,z,p.scale||1);else if(p.type==='pedestal'){M.identity(bm);M.translate(bm,bm,x,.5,z);M.scale(bm,bm,.8,1,.8);this.B.box.push(bm,.1,.16,.22,2,null);M.identity(bm);M.translate(bm,bm,x,1.01,z);M.scale(bm,bm,.84,.04,.84);this.B.box.push(bm,.78,1,.24,7,null);}
   else if(p.type==='podium'){M.identity(bm);M.translate(bm,bm,x,.22,z);M.scale(bm,bm,p.w||9,.44,p.d||3);this.B.box.push(bm,.08,.13,.2,2,null);M.identity(bm);M.translate(bm,bm,x,.45,z+(p.d||3)/2-.02);M.scale(bm,bm,p.w||9,.03,.06);this.B.box.push(bm,.78,1,.24,10,null);}}}
 trophy(bm,x,y,z,k){const B=this.B,G1=[1,.77,.24],G2=[.95,.66,.16],put=(key,ox,oy,oz,sx,sy,sz,c,m,rx,rz)=>{M.identity(bm);M.translate(bm,bm,x+ox*k,y+oy*k,z+oz*k);if(rx)M.rotX(bm,bm,rx);if(rz)M.rotZ(bm,bm,rz);M.scale(bm,bm,sx*k,sy*k,sz*k);B[key].push(bm,c[0],c[1],c[2],m,null);};
  put('cyl',0,.13,0,.27,.13,.27,[.06,.18,.15],2);put('cyl',0,.155,0,.29,.025,.29,G1,7);put('cyl',0,.17,0,.2,.02,.2,[.78,1,.24],10);put('cyl',0,.36,0,.06,.19,.06,G1,7);put('sphere',0,.37,0,.05,.045,.05,G2,7);
  put('cone',0,.64,0,.38,.26,.38,G1,7,PI);put('torus',0,.64,0,.4,.3,.4,G2,7);
  for(const s of [-1,1])put('torus',s*.205,.55,0,.15,.15,.15,G1,7,0,PI/2);put('sphere',0,.7,0,.055,.055,.055,G2,7);put('cone',0,.74,0,.06,.09,.06,[.78,1,.24],10);}
 /* Prévia do criador de jogador / estúdio de uniformes: personagem no centro com câmera orbital */
 renderStudio(player,club,kit,opts){if(this.lost)return;opts=opts||{};const gl=this.gl;const [w,h]=this.resize();this.stats.draws=0;this.stats.instances=0;this.stats.tris=0;const dt=opts.dt||1/60;this.time+=dt;
  const key=opts.kitKey||'studio';if(this.studioKitKey!==key||opts.dirty){const c=document.createElement('canvas');c.width=c.height=512;K.paint(c,kit,club.crest);this.atlas.upload(G.SLOT.STUDIO,c);this.studioKitKey=key;this.studioTex=c;}
  const app=player.appearance||{};const p=CH.proportions(app);const role=opts.keeper?'keeper':'player';const kd=this.kitDesc(G.SLOT.STUDIO,kit,role);
  const d={p,app,colors:CH.colors(app,kd.colors),kit:kd,number:player.number,name:String(player.name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().split(/\s+/).pop(),role,seed:1,lod:0,x:0,z:0,yaw:PI/2};
  const target=[0,opts.focus==='head'?p.total-p.R:opts.focus==='shorts'?p.hipY*.95:opts.focus==='socks'?p.hipY*.35:p.total*.55,0];
  this.dir.orbit(opts.yaw??.4,opts.pitch??.12,(opts.dist??3.6)*Math.max(.8,p.total/1.85),target);this.camera(w,h,this.dir.eye,this.dir.tgt,opts.fov||30);
  this.atlas.mip();gl.clearColor(.09,.17,.21,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);this.drawStatic();
  const P=this.pose,F=this.face;A.locomotion(P,0,0,this.time,1,0);if(opts.clip){const dur=opts.clipDur||2.2;const tt=this.time%dur;A.applyAction(P,{clip:opts.clip,t0:0,t1:dur,p:{side:1,height:1.2,color:'yellow'}},tt);}
  A.face(F,opts.emotion?[{e:opts.emotion,t0:-1,t1:1e9,k:1}]:null,this.time,'neutral');d.mouthAdd=P[A.MO];this.charR.draw(d,P,F,this.time);this.drawParts();}
}
MD.Renderer3D=Renderer3D;
})(window.MD=window.MD||{});
