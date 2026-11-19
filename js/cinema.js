/* MATCHDAY 0.5 — sequências cinematográficas (sem engine): abertura da transmissão, entrada pelo túnel, hino,
   cumprimentos, sorteio, posicionamento; versão curta do Germinare; final de torneio; cerimônia do campeão.
   Tudo vira uma trilha da coreografia (mesmo formato dos lances): o renderizador, as câmeras com trajeto e as
   animações são os mesmos. Coordenadas no mundo (dir=1). Overlays 'cine' são desenhados pela interface. */
(function(MD){
'use strict';
const U=MD.U,clamp=U.clamp,PI=Math.PI;
const CI={};
const C=()=>MD.Choreo;
function newScript(ctx,seed){const ev={attack:'home',half:'first',dir:1,seed:seed||1,lineup:ctx.lineup,beats:[],mode:ctx.mode||'pro'};C().useMode(ev.mode);const S=new (C().Script)(ev,{resolve:ctx.resolve});S.props=[];S.ball0=[0,0];S.noAI=true;return S;}
const team=(S,s)=>S.actors.filter(a=>a.side===s&&a.kind!=='ref'&&a.kind!=='ar');
function personalityAct(a){const per=a.info&&a.info.data&&a.info.data.personality;return per==='leader'?'hand_chest':per==='passionate'?'arm_over':'anthem';}
/* posiciona tudo instantaneamente (corte de cena) */
function place(S,t,fn){C().scene(S,t,a=>fn(a));S.cams.pop();}
function walk(S,a,t0,pts,speed){let t=t0;let prev=null;for(const p of pts){if(prev){t+=Math.hypot(p[0]-prev[0],p[1]-prev[1])/(speed||1.45);}S.wp(a,t,p[0],p[1],{face:p[2],walk:true});prev=p;}return t;}
/* ---------- Pré-jogo (estádio profissional) ---------- */
CI.prematch=function(ctx){if(ctx.mode==='germinare')return CI.germinareIntro(ctx);
 const S=newScript(ctx,ctx.seed);const r=S.rng;const H=team(S,'home'),A=team(S,'away');const REF=S.REF,AR1=S.AR1,AR2=S.AR2;const fin=!!ctx.final;
 const homeX=i=>-2.3-i*.95,awayX=i=>2.3+i*.95,rowZ=-1.6;const tunnelZ=-40.2;
 /* 0) todos dentro/atrás do túnel, fora de vista */
 place(S,0,a=>{if(a.i===REF)return[0,tunnelZ+.8,PI/2];if(a.i===AR1)return[-.9,tunnelZ+.2,PI/2];if(a.i===AR2)return[.9,tunnelZ+.2,PI/2];
  const H1=H.indexOf(a),A1=A.indexOf(a);if(H1>=0)return[-.9,tunnelZ-1-H1*1.1,PI/2];if(A1>=0)return[.9,tunnelZ-1-A1*1.1,PI/2];return[0,tunnelZ-20,PI/2];});
 S.seg({type:'dead',t0:0,p:[0,0]});S.holder=-1;S.cur=[0,0];
 /* 1) abertura: vista aérea, varredura da torcida e telão */
 S.cam(0,'path',{e0:[-118,62,-96],e1:[-62,44,-118],g0:[0,0,0],g1:[8,0,0],f0:46,f1:40,until:5.5,cut:true});
 S.cam(5.5,'path',{e0:[-42,3.2,30],e1:[40,3.6,30],g0:[-42,9,57],g1:[40,10,57],f0:52,f1:52,until:9.6,cut:true});
 S.cam(9.6,'path',{e0:[44,13,-10],e1:[50,15,8],g0:[72,17,0],g1:[72,18,0],f0:30,f1:26,until:12,cut:true});
 S.mark(.2,'crowd_hype',{k:.9});S.mark(5.6,'crowd_hype',{k:1});
 S.overlays.push({t0:.6,t1:5.3,kind:'cine',layout:'title',title:ctx.competition||'MATCHDAY',sub:ctx.stadium||'Arena MATCHDAY',tag:fin?'GRANDE FINAL':'TRANSMISSÃO AO VIVO'});
 S.overlays.push({t0:5.8,t1:11.8,kind:'cine',layout:'versus',title:ctx.names?ctx.names.home:'',sub:ctx.names?ctx.names.away:'',tag:fin?'A GRANDE DECISÃO':'HOJE'});
 if(fin){S.props.push({type:'pedestal',at:[3.2,0,-31],t0:0,t1:40});S.props.push({type:'trophy',at:[3.2,1.04,-31],t0:0,t1:40,scale:1.1});S.mark(14.6,'fx_burst',{at:[0,7,-34],spread:22,mul:.9,intensity:1,side:'home'});S.mark(16,'fx_burst',{at:[0,8,-34],spread:26,mul:.9,intensity:1,side:'away'});}
 /* 2) entrada em campo em duas filas, árbitro e assistentes à frente */
  const T0=12;S.mark(T0,'crowd_hype',{k:1});S.mark(T0+.3,'crowd_up');
 /* parte A: saída do túnel (6,5 s); corte de câmera; parte B: as filas já no gramado seguem até o meio-campo */
 const vA=1.8,TA0=T0+6.5,dz=vA*6.5;
 const lineA=(a,x,z0)=>walk(S,a,T0,[[x,z0,PI/2],[x,z0+dz,PI/2]],vA);
 lineA(REF,0,tunnelZ+.8);lineA(AR1,-.9,tunnelZ+.2);lineA(AR2,.9,tunnelZ+.2);H.forEach((a,i)=>lineA(a.i,-.9,tunnelZ-1-i*1.1));A.forEach((a,i)=>lineA(a.i,.9,tunnelZ-1-i*1.1));
 const zB=-12;C().scene(S,TA0,a=>{if(a.i===REF)return[0,zB+1.6,PI/2];if(a.i===AR1)return[-.9,zB+1.1,PI/2];if(a.i===AR2)return[.9,zB+1.1,PI/2];const H1=H.indexOf(a),A1=A.indexOf(a);
  if(H1>=0)return[-.9,zB-H1*1.0,PI/2];if(A1>=0)return[.9,zB-A1*1.0,PI/2];return null;});S.cams.pop();
 let lineEnd=walk(S,REF,TA0,[[0,zB+1.6,PI/2],[0,rowZ,PI/2]],vA);walk(S,AR1,TA0,[[-.9,zB+1.1,PI/2],[-.85,rowZ,PI/2]],vA);walk(S,AR2,TA0,[[.9,zB+1.1,PI/2],[.85,rowZ,PI/2]],vA);
 H.forEach((a,i)=>{const t=walk(S,a.i,TA0,[[-.9,zB-i,PI/2],[-.9,rowZ-1.2-i*.25,PI/2],[homeX(i),rowZ-.5,PI/2],[homeX(i),rowZ,PI/2]],vA);lineEnd=Math.max(lineEnd,t);if(r()<.45)S.act(a.i,'look_around',T0+1.5+i*.2,2.2,{});S.emo(a.i,'concentrated',T0,40,1);});
 A.forEach((a,i)=>{const t=walk(S,a.i,TA0,[[.9,zB-i,PI/2],[.9,rowZ-1.2-i*.25,PI/2],[awayX(i),rowZ-.5,PI/2],[awayX(i),rowZ,PI/2]],vA);lineEnd=Math.max(lineEnd,t);if(r()<.45)S.act(a.i,'look_around',T0+1.8+i*.2,2.2,{});S.emo(a.i,'concentrated',T0,40,1);});
 S.cam(T0,'path',{e0:[0,1.75,-29],e1:[0,1.9,-22],g0:[0,1.3,-40],g1:[0,1.4,-32],f0:40,f1:44,until:TA0,cut:true});
 S.cam(TA0,'path',{e0:[8,2.3,zB+4],e1:[8.5,2.5,rowZ+3],g0:[0,1.3,zB-2],g1:[-1,1.3,rowZ-3],f0:42,f1:46,until:TA0+10,cut:true});
 S.overlays.push({t0:T0+1,t1:T0+6,kind:'cine',layout:'text',title:'OS TIMES ENTRAM EM CAMPO',sub:(ctx.names?ctx.names.home+'  ×  '+ctx.names.away:'')});
 /* 3) hino: fila lado a lado, câmera percorrendo os rostos */
 const TA=Math.max(lineEnd+.6,T0+12);const anthemDur=ctx.anthemDur||12;
 for(const a of [...H,...A]){S.act(a.i,personalityAct(a),TA,anthemDur,{});S.emo(a.i,'concentrated',TA,anthemDur,1);S.wp(a.i,TA,S.lastWp(a.i).x,rowZ,{face:PI/2});}
 for(const k of [REF,AR1,AR2])S.act(k,'anthem',TA,anthemDur,{});
 S.mark(TA,'anthem',{dur:anthemDur});
 const half=anthemDur/2;
 S.cam(TA,'path',{e0:[homeX(0)+.6,1.75,rowZ+3.2],e1:[homeX(Math.max(0,H.length-1))-.4,1.7,rowZ+3.2],g0:[homeX(0),1.62,rowZ],g1:[homeX(Math.max(0,H.length-1)),1.6,rowZ],f0:34,f1:34,until:TA+half,cut:true});
 S.cam(TA+half,'path',{e0:[awayX(Math.max(0,A.length-1))+.4,1.7,rowZ+3.2],e1:[awayX(0)-.6,1.75,rowZ+3.2],g0:[awayX(Math.max(0,A.length-1)),1.6,rowZ],g1:[awayX(0),1.62,rowZ],f0:34,f1:34,until:TA+anthemDur-2,cut:true});
 S.cam(TA+anthemDur-2,'path',{e0:[0,6,26],e1:[0,4.5,16],g0:[0,1.4,rowZ],g1:[0,1.5,rowZ],f0:38,f1:44,until:TA+anthemDur+.2,cut:true});
 S.overlays.push({t0:TA+.3,t1:TA+half-.3,kind:'cine',layout:'crest',side:'home',title:ctx.names?ctx.names.home:'',sub:'HINO · ESCALAÇÃO'});
 S.overlays.push({t0:TA+half+.3,t1:TA+anthemDur-2.3,kind:'cine',layout:'crest',side:'away',title:ctx.names?ctx.names.away:'',sub:'HINO · ESCALAÇÃO'});
 /* 4) cumprimentos: visitantes passam pela fila da casa; capitães e sorteio com o árbitro */
 const TH=TA+anthemDur+.2;const passZ=rowZ+1.05;let hsEnd=TH;
 A.forEach((a,i)=>{const t0=TH+i*.55;const x0=awayX(i);const pts=[[x0,passZ,PI],[homeX(H.length-1)-1.6,passZ,PI],[homeX(H.length-1)-2.5,passZ+2.5,PI/2]];const tt=walk(S,a.i,t0,pts,1.25);hsEnd=Math.max(hsEnd,tt);S.act(a.i,'handshake',t0+.8,Math.max(1,(Math.abs(x0-homeX(H.length-1))+2)/1.25-.6),{});});
 H.forEach((a,i)=>{const tFirst=TH+(awayX(0)-homeX(i))/1.25;S.act(a.i,'handshake',tFirst-.2,Math.min(9,A.length*.55+1.2),{});S.emo(a.i,'happy',tFirst,4,.4);});
 S.cam(TH,'path',{e0:[-4,2.1,rowZ+6.5],e1:[-9,2.2,rowZ+6.2],g0:[0,1.3,rowZ+.4],g1:[-7,1.3,rowZ+.4],f0:40,f1:40,until:TH+5.5,cut:true});
 S.overlays.push({t0:TH+.4,t1:TH+4.5,kind:'cine',layout:'text',title:'FAIR PLAY',sub:'Cumprimento entre as equipes'});
 const TC=TH+5.5;const capH=H.find(a=>a.id===ctx.captains?.home)||H[0],capA=A.find(a=>a.id===ctx.captains?.away)||A[0];
 if(capH&&capA){S.wp(capH.i,TC+2.2,-.75,.2,{face:0});S.wp(capA.i,TC+2.2,.75,.2,{face:PI});S.wp(REF,TC+2.2,0,-.75,{face:PI/2});
  S.act(REF,'coin_toss',TC+2.4,1.8,{});S.act(capH.i,'handshake',TC+4.2,1.3,{});S.act(capA.i,'handshake',TC+4.2,1.3,{});
  S.cam(TC+1.6,'path',{e0:[3.2,1.6,3.2],e1:[2.4,1.7,2.4],g0:[0,1.4,-.2],g1:[0,1.35,-.2],f0:38,f1:34,until:TC+5.6,cut:true});
  S.overlays.push({t0:TC+2,t1:TC+5.4,kind:'cine',layout:'text',title:'SORTEIO DE CAMPO',sub:'Capitães e arbitragem'});}
 /* 5) posicionamento: jogadores correm para as posições; goleiros vão para as metas */
 const TP=TC+5.8;for(const a of [...H,...A]){const home=a.side==='home';const b=a.base||[0,0];const x=home?Math.min(-1,b[0]*.55-2):Math.max(1,-b[0]*.55+2),z=home?b[1]*.9:-b[1]*.9;
  const gk=a.kind==='keeper';S.wp(a.i,TP+(gk?6.5:3.6),gk?(home?-51:51):x,gk?0:z,{soft:true});if(!gk&&r()<.4)S.act(a.i,'idle_bounce',TP+3.8,1.6,{});}
 S.wp(REF,TP+3,2,-5,{soft:true});S.wp(AR1,TP+4,-20,-35.6,{soft:true});S.wp(AR2,TP+4,20,35.6,{soft:true});
 S.cam(TP,'path',{e0:[-30,26,58],e1:[-12,19,52],g0:[0,0,0],g1:[0,0,0],f0:44,f1:40,until:TP+5,cut:true});
 S.overlays.push({t0:TP+.4,t1:TP+4.6,kind:'cine',layout:'versus',title:ctx.names?ctx.names.home:'',sub:ctx.names?ctx.names.away:'',tag:'VAI COMEÇAR'});
 S.t=TP+5;S.duration=S.t;S.chapters=[{t:0,name:'Estádio'},{t:T0,name:'Entrada'},{t:TA,name:'Hino'},{t:TH,name:'Cumprimentos'},{t:TC,name:'Sorteio'},{t:TP,name:'Posicionamento'}];
 const tr=C().bake(S);tr.cinema=true;tr.startT=0;tr.chapters=S.chapters;tr.anthemAt=TA;tr.anthemDur=anthemDur;return tr;};
/* ---------- Germinare: apresentação curta da escola ---------- */
CI.germinareIntro=function(ctx){const S=newScript(ctx,ctx.seed);const r=S.rng;const H=team(S,'home'),A=team(S,'away');const PT=MD.Rules.PITCH;
 /* times saem do lado do prédio (faixa de terra), em duas filas curtas */
 place(S,0,a=>{if(a.kind==='ref')return[0,-16.6,PI/2];if(a.kind==='ar')return[-60,-60,0];const H1=H.indexOf(a),A1=A.indexOf(a);
  if(H1>=0)return[-1.2-H1*1.0,-17.2,PI/2];if(A1>=0)return[1.2+A1*1.0,-17.2,PI/2];return[0,-30,0];});
 S.seg({type:'dead',t0:0,p:[0,0]});S.holder=-1;S.cur=[0,0];
 S.cam(0,'path',{e0:[-30,17,26],e1:[16,12,30],g0:[-4,1,-16],g1:[4,1,-12],f0:50,f1:46,until:5.2,cut:true});
 S.overlays.push({t0:.5,t1:5,kind:'cine',layout:'title',title:'GERMINARE',sub:ctx.stadium||'Instituto J&F · campo da escola',tag:ctx.final?'GRANDE FINAL':'FUTEBOL DA ESCOLA'});
 S.mark(.3,'crowd_hype',{k:.8});
 const T0=4.6;const rowZ=-1.2;
 walk(S,S.REF,T0,[[0,-16.6,PI/2],[0,rowZ,PI/2]],1.6);
 H.forEach((a,i)=>{walk(S,a.i,T0+.3+i*.3,[[-1.2-i,-17.2,PI/2],[-1.6-i*1.05,rowZ-.3,PI/2],[-1.6-i*1.05,rowZ,PI/2]],1.7);S.emo(a.i,'happy',T0,6,.5);});
 A.forEach((a,i)=>{walk(S,a.i,T0+.3+i*.3,[[1.2+i,-17.2,PI/2],[1.6+i*1.05,rowZ-.3,PI/2],[1.6+i*1.05,rowZ,PI/2]],1.7);S.emo(a.i,'happy',T0,6,.5);});
 S.cam(T0,'path',{e0:[7,2.4,-6],e1:[5,2.2,4],g0:[0,1.2,-15],g1:[0,1.3,-3],f0:44,f1:42,until:T0+9,cut:true});
 S.overlays.push({t0:T0+.6,t1:T0+8.4,kind:'cine',layout:'versus',title:ctx.names?ctx.names.home:'',sub:ctx.names?ctx.names.away:'',tag:'5 MINUTOS · QUEM FIZER 2 GOLS VENCE'});
 const TH=T0+9.2;for(const a of [...H,...A]){S.act(a.i,'wave',TH,1.4,{});}S.mark(TH,'crowd_hype',{k:1});
 H.forEach(a=>S.act(a.i,'handshake',TH+1.6,1.6,{}));A.forEach(a=>S.act(a.i,'handshake',TH+1.6,1.6,{}));
 S.cam(TH,'path',{e0:[0,2.6,8],e1:[-3,2.2,6.5],g0:[0,1.4,rowZ],g1:[-1,1.4,rowZ],f0:46,f1:40,until:TH+3.6,cut:true});
 const TP=TH+3.6;for(const a of [...H,...A]){const home=a.side==='home';const b=a.base||[0,0];const gk=a.kind==='keeper';const x=gk?(home?-(PT.L-1.2):PT.L-1.2):(home?Math.min(-1,b[0]*.5-1):Math.max(1,-b[0]*.5+1));S.wp(a.i,TP+3,x,gk?0:(home?b[1]*.85:-b[1]*.85),{soft:true});}
 S.cam(TP,'path',{e0:[-14,9,22],e1:[-6,8.5,23],g0:[0,0,0],g1:[0,0,0],f0:46,f1:44,until:TP+3.2,cut:true});S.t=TP+3.2;S.duration=S.t;
 const tr=C().bake(S);tr.cinema=true;tr.startT=0;tr.chapters=[{t:0,name:'Escola'},{t:T0,name:'Entrada'},{t:TH,name:'Cumprimentos'}];return tr;};
/* ---------- Cerimônia do campeão ---------- */
CI.ceremony=function(ctx){const S=newScript(ctx,ctx.seed);const r=S.rng;const win=ctx.winner||'home',lose=win==='home'?'away':'home';const W=team(S,win),Lz=team(S,lose);const PT=MD.Rules.PITCH,sm=!!PT.small;
 const sc=sm?.45:1;
 place(S,0,a=>{if(a.kind==='ref')return[6*sc,-4*sc,PI];if(a.kind==='ar')return sm?[-60,-60,0]:[a.i===S.AR1?-22:22,a.i===S.AR1?-35.6:35.6,0];
  return[(r()-.5)*40*sc,(r()-.5)*36*sc,r()*PI*2];});
 S.seg({type:'dead',t0:0,p:[8*sc,6*sc]});S.holder=-1;S.cur=[8*sc,6*sc];
 S.mark(0,'whistle_long');S.mark(.1,'crowd_hype',{k:1});S.mark(.3,'final_whistle');S.act(S.REF,'whistle',0,.9,{});
 /* 1) campeões comemoram; derrotados reagem */
 const hub=[0,4*sc];W.forEach((a,i)=>{const ang=i/W.length*PI*2;S.wp(a.i,2.6+r()*.8,hub[0]+Math.cos(ang)*1.4,hub[1]+Math.sin(ang)*1.2,{soft:true});S.act(a.i,i%3===0?'jump_joy':i%3===1?'arms_up':'run_celebrate',.3,2.4,{});S.act(a.i,'hug',3.2,2.4,{});S.emo(a.i,'euphoric',0,60,1);});
 Lz.forEach((a,i)=>{const k=r();S.act(a.i,k<.35?'kneel':k<.6?'sit_grass':'hands_head',.5+r(),4.5,{});S.emo(a.i,k<.5?'sad':'frustrated',0,60,1);});
 S.cam(0,'orbit',{c:[hub[0],1.2,hub[1]],r:sm?7:10,h:2.4,ang0:.6,w:.18,f:44,until:5.8,cut:true,free:true});
 S.overlays.push({t0:.5,t1:5.5,kind:'cine',layout:'text',title:'É CAMPEÃO!',sub:ctx.names?ctx.names[win]:'',tone:'gold'});
 /* 2) torcida */
 if(!sm)S.cam(5.8,'path',{e0:[-30,4,30],e1:[30,4.5,30],g0:[-30,11,58],g1:[30,12,58],f0:50,f1:50,until:9,cut:true});
 else S.cam(5.8,'path',{e0:[-12,2.2,9],e1:[-2,2.2,9],g0:[-10,1.4,18],g1:[-2,1.4,18],f0:50,f1:50,until:9,cut:true});
 S.mark(5.9,'crowd_hype',{k:1});S.mark(6,'crowd_goal',{side:win,intensity:1});
 /* 3) pódio, troféu original MATCHDAY e capitão */
 const TP=9;const podZ=-1.2*sc-1,pedZ=podZ+2.6;S.props.push({type:'podium',at:[0,0,podZ],w:sm?7:10.5,d:2.6,t0:TP-.2,t1:99});S.props.push({type:'pedestal',at:[0,0,pedZ],t0:TP-.2,t1:99});
 const cap=W.find(a=>a.id===ctx.captain)||W.find(a=>a.info&&a.info.data&&a.info.data.personality==='leader')||W[0];
 const others=W.filter(a=>a!==cap);others.forEach((a,i)=>{const x=(i-(others.length-1)/2)*(sm?1.2:.92);const z=podZ+(i%2?-.55:.35);S.wp(a.i,TP+2.6+r()*.6,x,z,{face:PI/2});});
 S.wp(cap.i,TP+2.8,0,podZ+1,{face:PI/2});Lz.forEach((a,i)=>{S.wp(a.i,TP+4+r(),(i-(Lz.length-1)/2)*1.1,podZ-6,{face:PI/2,soft:true});S.act(a.i,'applaud',TP+6,8,{});});
 S.wp(S.REF,TP+3,4.5,pedZ+.6,{soft:true});
 const trophy={type:'trophy',at:[0,1.04,pedZ],t0:TP-.2,t1:TP+6.4,scale:1};S.props.push(trophy);
 const tPick=TP+6.4;S.wp(cap.i,tPick-1.2,0,pedZ-.45,{face:PI/2});S.act(cap.i,'trophy_hold',tPick-.2,2.4,{});
 S.wp(cap.i,tPick+2.4,0,podZ+.6,{face:PI/2});const tLift=tPick+2.6;const liftDur=7;S.act(cap.i,'trophy_lift',tLift,liftDur,{});
 S.props.push({type:'trophy',actor:cap.i,t0:tPick-.1,t1:99,lift:[[tLift,tLift+liftDur]]});
 others.forEach((a,i)=>{S.act(a.i,i%2?'jump_joy':'arms_up',tLift+.3,liftDur-.5,{});});
 for(let k=0;k<6;k++)S.mark(tLift+.4+k*1.05,'fx_burst',{at:[0,sm?5:8,podZ],spread:sm?9:16,mul:.7,intensity:1,side:win});
 S.mark(tLift+.3,'flash',{k:.7});S.mark(tLift+.3,'crowd_hype',{k:1});S.mark(tLift+.35,'trophy');
 S.cam(TP,'path',{e0:[0,sm?3:4,podZ+(sm?12:16)],e1:[0,2.2,podZ+(sm?7:9)],g0:[0,1.3,podZ],g1:[0,1.5,podZ],f0:40,f1:40,until:tPick-.8,cut:true});
 S.cam(tPick-.8,'path',{e0:[1.8,1.5,pedZ+2.6],e1:[1.2,1.45,pedZ+2],g0:[0,1.1,pedZ],g1:[0,1.2,pedZ-.3],f0:36,f1:32,until:tLift,cut:true});
 S.cam(tLift,'path',{e0:[0,.8,podZ+4.2],e1:[.6,.9,podZ+3.6],g0:[0,2.6,podZ+.6],g1:[0,2.9,podZ+.6],f0:44,f1:40,until:tLift+3,cut:true});
 S.cam(tLift+3,'orbit',{c:[0,2,podZ],r:sm?6:8,h:2,ang0:PI/2,w:.35,f:46,until:tLift+6.2,cut:true,free:true});
 S.cam(tLift+6.2,'path',{e0:[-3,4,podZ+9],e1:[3,sm?8:15,podZ+(sm?13:24)],g0:[0,1.6,podZ],g1:[0,1.2,podZ],f0:44,f1:46,until:tLift+11,cut:true});
 S.overlays.push({t0:tLift+.6,t1:tLift+5.5,kind:'cine',layout:'text',title:'O CAPITÃO LEVANTA A TAÇA',sub:ctx.names?ctx.names[win]:'',tone:'gold'});
 S.t=tLift+11;S.duration=S.t;const tr=C().bake(S);tr.cinema=true;tr.startT=0;tr.ceremony=true;tr.liftAt=tLift;return tr;};
MD.Cinema=CI;
})(typeof window!=='undefined'?(window.MD=window.MD||{}):(globalThis.MD=globalThis.MD||{}));
