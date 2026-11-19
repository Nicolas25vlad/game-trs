/* TRS26 / MATCHDAY 0.6 — PARTIDA 3D EM TELA CHEIA (JOGAR · ASSISTIR · MELHORES MOMENTOS).
   Um único mundo (MD.World) para os três modos. Laço com passo fixo e interpolação visual; o FPS não muda a física.
   - JOGAR: cada humano comanda só a própria equipe (teclado, controles, celulares); a IA move todo o resto.
   - ASSISTIR: IA nos dois lados, câmera acompanha a bola do apito inicial ao final, sem cortes para destaques.
   - MELHORES MOMENTOS: o MESMO mundo, acelerado quando o lance é pouco relevante e em velocidade natural perto do gol.
   Replays de gol vêm do buffer gravado; durante o replay a simulação fica parada e continua do ponto certo. */
(function(MD){
'use strict';
const U=MD.U,App=MD.App,AU=MD.Audio,IN=MD.Input,CI=MD.Cinema,K=MD.Kit,$=id=>document.getElementById(id),esc=U.escape,clamp=U.clamp,lerp=U.lerp;
const PL=MD.Play={};
const DT=MD.World.DT;
const COLORS=[[.22,.6,1],[1,.3,.32],[1,.84,.18],[.3,1,.5]],CSS_COL=['#3a9bff','#ff4d52','#ffd52e','#4dff80'];
let S=null;
PL.active=()=>!!S&&S.mode!=='done';PL.state=()=>S;
/* ---------- montagem do palco: o mesmo canvas WebGL é movido para a tela cheia ---------- */
App.mountCanvas=function(container){const c=App.isWebGL?$('gl-canvas'):$('c2d-canvas');if(c&&container&&c.parentNode!==container)container.appendChild(c);};
/* ---------- início ---------- */
PL.start=function(o){const st=App.settings;o={watch:'play',mode:'pro',humans:[],minutes:st.matchMinutes||(o&&o.mode==='germinare'?5:10),difficulty:st.difficulty||'pro',...o};
 if(S)PL.stop(true);
 const h=U.deepClone(o.home),a=U.deepClone(o.away);
 const humans=o.watch==='play'?o.humans:[];
 const w=new MD.World.World(h,a,{mode:o.mode,germ:o.germ,minutes:o.minutes,difficulty:o.difficulty,difficultyHome:o.difficultyHome,difficultyAway:o.difficultyAway,knockout:o.knockout,seed:o.seed,goalPause:4.6,maxSubs:5});
 const kits=K.pickKitsChoice?K.pickKitsChoice(h,a,o.kits&&o.kits.home,o.kits&&o.kits.away):K.pickKits(h,a);
 S={o,w,h,a,kits,mode:'live',acc:0,ts:1,cam:st.cam&&MD.Camera.USER.includes(st.cam)?st.cam:'auto',zoom:st.camZoom||1,height:st.camHeight||1,fxT:-1,evI:0,humans:[],paused:false,menu:null,highlights:[],replayed:new Set(),lastUI:0,banners:[],finished:false,camKey:'',camSeg:null,watchSpeed:1,actorsCache:[],tags:new Map(),pendingCap:null};
 humans.forEach((hu,i)=>{const H=w.addHuman({id:'h'+i,side:hu.side,device:hu.device,autoSwitch:IN.cfg.autoSwitch,passAssist:IN.cfg.passAssist,shotAssist:IN.cfg.shotAssist});const dev=IN.device(hu.device);S.humans.push({H,device:hu.device,side:hu.side,color:COLORS[i%4],css:CSS_COL[i%4],label:'P'+(i+1),devLabel:dev?dev.short:hu.device});});
 const R=App.renderer;App.mountCanvas($('play-stage'));if(R.setVenue)R.setVenue(w.mode.venue||'arena');R.setTeams(h,a,kits);if(R.setQuality)R.setQuality(st.quality);if(R.dir)R.dir.reset();
 document.body.classList.toggle('mode-germinare',w.small);
 $('hs-hc').src=App.crest(h);$('hs-ac').src=App.crest(a);$('hs-h').textContent=h.short;$('hs-a').textContent=a.short;
 $('hud-mode').textContent=(o.watch==='play'?(S.humans.length>1?'MULTIPLAYER LOCAL':'JOGAR'):o.watch==='watch'?'ASSISTINDO':'MELHORES MOMENTOS')+' · '+(w.small?'GERMINARE 5x5':(o.tournament?o.tournament.name.toUpperCase():'PROFISSIONAL'))+' · '+(MD.World.DIFFICULTY[o.difficulty]||{}).label;
 for(const id of ['pause-menu','half-menu','post-menu','dc-menu','play-cine','play-skip','hud-banner','hud-replay','hud-ff','play-champ'])$(id).hidden=true;
 App.go('play');IN.gameActive=true;AU.resume();AU.ambience(w.small?'school':'stadium');AU.crowd(w.small?.12:.25);
 const wantCine=o.cinema!==undefined?o.cinema:(st.cinema!==false);if(wantCine&&App.isWebGL&&CI)PL.startIntro();else S.mode='live';
 PL.renderHints();};
PL.resolver=function(){const w=S.w;return id=>{const p=w.byId(id);if(!p)return null;const t=w.teams[p.team];const s=t.slots[p.slot]||{x:0,z:0};return{id,name:p.name,data:p.data,number:p.num,group:p.group,pos:p.pos,attrs:p.data.attrs,energy:p.stamina,foot:p.data.foot,base:[s.x,s.z],side:p.side,rating:p.ovr};};};
PL.lineup=function(){const w=S.w;return{home:w.teams[0].players.map(p=>p.id),away:w.teams[1].players.map(p=>p.id)};};
/* ---------- apresentação (cinemática da 0.5, pulável) ---------- */
PL.startIntro=function(){const w=S.w,o=S.o;const T=o.tournament;
 const tr=CI.prematch({lineup:PL.lineup(),resolve:PL.resolver(),mode:w.mode.id,final:!!(T&&T.final),names:{home:S.h.name,away:S.a.name},captains:{home:w.teams[0].captain,away:w.teams[1].captain},
  stadium:T&&T.stadium?T.stadium:w.small?'Instituto J&F · Germinare':(S.h.stadiumName||'Arena TRS26'),competition:T?T.name:w.small?'GERMINARE':'TRS26 · MATCHDAY',seed:w.seed});
 S.mode='intro';S.intro={tr,t:0,anthem:false};$('play-skip').hidden=false;$('play-skip').textContent='PULAR APRESENTAÇÃO ⏭';$('hud').classList.add('dim');
 /* a apresentação usa a geometria do modo; o mundo é recriado na mesma configuração ao fim */};
PL.endIntro=function(){if(!S||S.mode!=='intro')return;AU.stopMusic&&AU.stopMusic();S.intro=null;S.mode='live';$('play-skip').hidden=true;$('play-cine').hidden=true;$('hud').classList.remove('dim');MD.Modes.apply(S.w.mode);if(App.renderer.dir)App.renderer.dir.reset();};
PL.cineOverlay=function(tr,t){let o=null;for(const x of tr.overlays)if(x.kind==='cine'&&t>=x.t0&&t<=x.t1)o=x;const el=$('play-cine');if(o===(S.cineOv||null))return;S.cineOv=o;if(!o){el.hidden=true;return;}
 let html='';if(o.layout==='versus')html=`<div class="co-versus"><div><img src="${App.crest(S.h)}" alt=""><b>${esc(o.title)}</b></div><em>VS</em><div><img src="${App.crest(S.a)}" alt=""><b>${esc(o.sub)}</b></div><span class="co-tag">${esc(o.tag||'')}</span></div>`;
 else html=`<div class="co-title"><small>${esc(o.tag||'')}</small><b>${esc(o.title)}</b><span>${esc(o.sub||'')}</span></div>`;el.innerHTML=html;el.hidden=false;};
/* ---------- laço ---------- */
PL.frame=function(dt){if(!S)return;const w=S.w,R=App.renderer;
 /* pausa: Start/Esc de qualquer dispositivo humano (ou teclado no modo assistir) */
 const pauseDevs=S.humans.length?S.humans.map(h=>IN.device(h.device)).filter(Boolean):IN.list();
 if(S.mode==='live'&&!S.menu){for(const d of pauseDevs)if(IN.pressed(d,'pause')){PL.pause(true);break;}}
 else if(S.menu==='pause'){for(const d of pauseDevs)if(IN.pressed(d,'pause')||IN.pressed(d,'back')&&d.kind!=='keyboard'){PL.pause(false);break;}}
 /* desconexão de um dispositivo em uso */
 if(S.mode==='live'&&!S.menu){for(const h of S.humans){const d=IN.device(h.device);if(!d||!d.connected){PL.disconnected(h);break;}}}
 if(S.mode==='intro'){const it=S.intro;it.t+=dt;if(!it.anthem&&it.tr.anthemAt&&it.t>=it.tr.anthemAt){it.anthem=true;AU.anthem&&AU.anthem(App.settings,it.tr.anthemDur||12);}
  for(const d of IN.list())if(IN.pressed(d,'confirm')||IN.pressed(d,'pass')){PL.endIntro();break;}
  R.renderTrack(it.tr,it.t,{dt,camMode:'auto',screen:PL.screenInfo()});PL.cineOverlay(it.tr,it.t);if(it.t>=it.tr.duration)PL.endIntro();return;}
 if(S.mode==='ceremony'){const c=S.cer;c.t+=dt;if(!c.music&&c.t>=c.tr.liftAt){c.music=true;AU.champion&&AU.champion();}for(const d of IN.list())if(IN.pressed(d,'confirm')){c.t=c.tr.duration;}
  R.renderTrack(c.tr,c.t,{dt,camMode:'auto',screen:PL.screenInfo()});PL.cineOverlay(c.tr,c.t);if(c.t>=c.tr.duration)PL.endCeremony();return;}
 if(S.mode==='replay'){const r=S.rep;r.t+=dt*r.speed;for(const d of IN.list())if(IN.pressed(d,'confirm')||IN.pressed(d,'pass')||IN.pressed(d,'shoot')){r.t=r.tr.duration;}
  R.renderTrack(r.tr,Math.min(r.t,r.tr.duration),{dt,camMode:'auto',replayCam:r.cam,screen:PL.screenInfo(),noFX:true});if(r.t>=r.tr.duration)PL.endReplay();PL.hudTick(dt,true);return;}
 if(S.mode==='live'&&!S.menu){
  /* comandos → mundo (direção relativa à câmera) */const basis=PL.basis();for(const h of S.humans){const d=IN.device(h.device);if(d)w.setCommand(h.H.id,IN.command(d,basis));}
  /* tempo: assistir em 1x/2x/4x; melhores momentos acelera trechos pouco relevantes */
  let target=S.o.watch==='watch'?S.watchSpeed:1;if(S.o.watch==='highlights')target=PL.relevance()?1:5;S.ts+=(target-S.ts)*Math.min(1,dt*(target>S.ts?1.2:4));
  S.acc+=dt*S.ts;let n=0;const maxN=Math.ceil(6*Math.max(1,S.ts));while(S.acc>=DT&&n<maxN){w.step();S.acc-=DT;n++;if(PL.watchPhase())break;}if(n>=maxN)S.acc=0;
  PL.audio();PL.events();}
 /* desenho com interpolação entre os dois últimos passos */
 const alpha=S.menu||S.mode!=='live'?1:clamp(S.acc/DT,0,1);const V=PL.view(alpha);
 R.renderLive(V,{dt:S.menu?0:dt,camMode:S.cam,camZoom:S.zoom,camHeight:S.height,screen:PL.screenInfo()});
 PL.hudTick(dt,false);};
/* transições de fase observadas após cada passo */
PL.watchPhase=function(){const w=S.w;
 if(w.phase==='goal'&&w.lastGoal&&!S.replayed.has(w.lastGoal.ev)&&w.time-w.stopT>2.3){S.replayed.add(w.lastGoal.ev);PL.startReplay('goal');return true;}
 if(w.phase==='break'&&S.menu!=='half'){PL.halftime();return true;}
 if(w.phase==='fulltime'&&!S.finished){PL.fulltime();return true;}
 if(S.pendingCap&&w.time>=S.pendingCap.t){const pc=S.pendingCap;S.pendingCap=null;const tr=w.replayTrack(6);if(tr&&S.highlights.length<12)S.highlights.push({tr,title:pc.title,minute:pc.minute,side:pc.side});}
 return false;};
PL.relevance=function(){const w=S.w,b=w.ball,L=w.P.L;if(w.phase==='goal')return true;if(w.restart&&['penalty','corner'].includes(w.restart.type))return true;if(w.restart&&w.restart.type==='freekick'&&w.restart.shootable)return true;
 const k=b.lastKick;if(k&&k.shot&&w.time-k.t<2.5)return true;if(Math.abs(b.x)>L*.52)return true;if(w.pens)return true;return false;};
/* base da câmera no gramado: "para cima" no analógico = para longe da câmera */
PL.basis=function(){const R=App.renderer;const e=R.dir.eye,t=R.dir.tgt;let fx=t[0]-e[0],fz=t[2]-e[2];const l=Math.hypot(fx,fz)||1;fx/=l;fz/=l;return{fx,fz,rx:-fz,rz:fx};};
PL.view=function(alpha){const w=S.w;const list=w.actorList();const out=S.actorsCache;out.length=list.length;const hl=new Map();for(const h of S.humans)if(h.H.player)hl.set(h.H.player,h.color);
 for(let i=0;i<list.length;i++){const o=list[i];const v=out[i]||(out[i]={});v.ref=o.view;v.x=lerp(o.px,o.x,alpha);v.z=lerp(o.pz,o.z,alpha);v.f=U.angleLerp(o.pf,o.f,alpha);v.sp=o.sp;v.dist=o.dist;v.turn=o.turn||0;v.act=o.act;v.off=!!o.off;v.hl=hl.get(o)||null;}
 const b=w.ball;const fx=[];for(const f of w.fx)if(f.t>S.fxT)fx.push(f);if(w.fx.length)S.fxT=w.fx[w.fx.length-1].t;
 /* planos de câmera de bola parada (modo automático) — mesmo objeto enquanto a situação não muda, para não cortar a cada quadro */
 let key='',seg=null;const r=w.restart;
 if(w.phase==='goal'&&w.lastGoal&&w.lastGoal.scorer){const idx=list.indexOf(w.lastGoal.scorer);key='cel'+idx;seg={t:0,mode:'follow_player',a:idx};}
 else if(r&&r.ready&&r.type==='penalty'){key='pen'+r.team;seg={t:0,mode:'penalty'};}
 else if(r&&r.ready&&r.type==='corner'){key='cor'+r.x+r.z;seg={t:0,mode:'corner',side:Math.sign(r.z)*Math.sign(r.x)};}
 else if(r&&r.ready&&r.type==='freekick'&&r.shootable){key='fk'+r.x;seg={t:0,mode:'freekick',spot:[r.x,r.z]};}
 if(key!==S.camKey){S.camKey=key;S.camSeg=seg?[seg]:null;}
 const own=b.owner?b.owner.team:b.lastTeam;const ht=S.humans[0]?S.humans[0].H.ti:(own>=0?own:0);
 let goalSide=w.teams[own>=0?own:0].dir;if(r&&(r.type==='penalty'||r.type==='corner'||r.type==='freekick'))goalSide=w.teams[r.team].dir;if(w.phase==='goal'&&w.lastGoal)goalSide=Math.sign(w.lastGoal.x)||1;
 const fp=S.humans[0]&&S.humans[0].H.player||b.owner;
 return{t:w.time-(1-alpha)*DT,ball:[lerp(b.px,b.x,alpha),lerp(b.py,b.y,alpha),lerp(b.pz,b.z,alpha)],ballH:b.heading,ballS:b.roll,ballVx:b.vx,actors:out,fx,cams:S.camSeg,goalSide,focus:fp?{x:fp.x,z:fp.z,f:fp.f}:null,attackDir:w.teams[ht].dir,cut:false};};
PL.screenInfo=function(){const w=S.w;return{home:S.h.short,away:S.a.short,hs:w.score[0],as:w.score[1],clock:w.clockText(),goal:w.phase==='goal',scorer:w.lastGoal&&w.lastGoal.scorer?w.lastGoal.scorer.name:'',t:performance.now()/1000,goalColor:w.lastGoal?(w.lastGoal.team?S.kits.away:S.kits.home).primary:'#fff'};};
/* ---------- áudio a partir dos efeitos do mundo ---------- */
PL.audio=function(){const w=S.w;for(const f of w.fx){if(f.t<=S.audT)continue;switch(f.type){
  case'kick':AU.play(f.shot||f.power>.7?'kick':'pass',{power:(f.power||.5)*30});break;case'header':AU.play('header');break;case'touch':AU.play('touch');break;case'tackle':AU.play('tackle');break;
  case'whistle':AU.play('whistle',{long:!!f.long,final:!!f.final});break;case'goal':AU.play('goal');AU.cheer&&AU.cheer(1);PL.rumbleAll(380,.9);break;case'net':AU.play('net');break;case'post':AU.play('post');AU.play('oh');break;case'save':AU.play('save');break;case'card':AU.play('card');break;}}
 if(w.fx.length)S.audT=w.fx[w.fx.length-1].t;
 const b=w.ball;const near=clamp((Math.abs(b.x)-w.P.L*.4)/(w.P.L*.6),0,1);const lvl=(w.small?.1:.2)+near*.35;if(Math.abs(lvl-(S.crowd||0))>.05){S.crowd=lvl;AU.crowd(lvl);}};
PL.rumbleAll=function(ms,k){for(const h of S.humans){const d=IN.device(h.device);IN.rumble(d,ms,k);}};
/* ---------- eventos → tarjas, destaques e efeitos ---------- */
PL.events=function(){const w=S.w;while(S.evI<w.events.length){const e=w.events[S.evI++];const team=e.team!==undefined?(e.team?S.a:S.h):null;const p=e.pid?w.byId(e.pid):null;
 switch(e.type){case'goal':PL.banner(`<b class="bn-goal">GOOOL!</b><span>${esc(p?p.name:'')}${e.own?' (contra)':''} · ${esc(team?team.name:'')} ${e.minute}'</span>`,'goal',3.2);break;
  case'card':PL.banner(`<i class="bn-card ${e.color}"></i><span>${e.second?'2º AMARELO → ':''}${e.color==='red'?'CARTÃO VERMELHO':'CARTÃO AMARELO'} · ${esc(p?p.name:'')} (${esc(team.short)})</span>`,'card',3);if(p&&S.humans.some(h=>h.H.ti===p.team)){for(const h of S.humans)if(h.H.ti===p.team)IN.rumble(IN.device(h.device),200,.5);}break;
  case'sub':PL.banner(`<span class="bn-sub">⇄ SUBSTITUIÇÃO · ${esc(team.short)}</span><span>Sai ${esc(e.outName)} · Entra ${esc(e.inName)}</span>`,'sub',3.2);break;
  case'offside':PL.banner(`<span>🚩 IMPEDIMENTO · ${esc(p?p.name:'')}</span>`,'info',2.2);break;
  case'penalty':PL.banner('<b>PÊNALTI!</b>','info',2.4);break;
  case'advantage':PL.banner('<span>VANTAGEM</span>','info',1.6);break;
  case'added':PL.banner(`<span>ACRÉSCIMOS: +${e.min} MIN</span>`,'info',2.4);break;
  case'post':S.pendingCap={t:w.time+1.2,title:'Na trave',minute:e.minute,side:null};break;
  case'save':if(!S.pendingCap)S.pendingCap={t:w.time+1,title:'Grande defesa',minute:e.minute,side:team?team.short:''};break;
  case'shootout_kick':PL.banner(`<span>${esc(team.short)} ${e.ok?'CONVERTE ✓':'PERDE ✕'}</span>`,'info',1.6);break;}}};
PL.banner=function(html,kind,secs){const el=$('hud-banner');el.className='hud-banner '+kind;el.innerHTML=html;el.hidden=false;el.style.animation='none';void el.offsetWidth;el.style.animation='';clearTimeout(S.bnT);S.bnT=setTimeout(()=>{el.hidden=true;},secs*1000);};
/* ---------- replay (simulação parada) ---------- */
PL.startReplay=function(kind){const w=S.w;const tr=w.replayTrack(9);if(!tr)return;const lg=w.lastGoal;const cams=['behind_goal','dynamic','side_low'];const cam=cams[(S.highlights.length)%cams.length];
 S.highlights.push({tr,title:'Gol de '+(lg&&lg.scorer?lg.scorer.name:''),minute:lg?lg.ev.minute:'',side:lg?(lg.team?S.a.short:S.h.short):''});
 S.rep={tr,t:Math.max(0,tr.duration-6.4),speed:.55,cam,back:'live'};S.mode='replay';$('hud-replay').hidden=false;if(App.renderer.dir)App.renderer.dir.reset();};
PL.playHighlight=function(i){const hl=S.highlights[i];if(!hl)return;S.rep={tr:hl.tr,t:Math.max(0,hl.tr.duration-6.4),speed:.6,cam:'dynamic',back:S.mode==='post'?'post':'live'};S.prevMenu=S.menu;$('post-menu').hidden=true;S.mode='replay';$('hud-replay').hidden=false;};
PL.endReplay=function(){const back=S.rep.back;S.rep=null;$('hud-replay').hidden=true;if(App.renderer.dir)App.renderer.dir.reset();if(back==='post'){S.mode='post';$('post-menu').hidden=false;}else S.mode='live';};
/* ---------- pausa, intervalo, desconexão ---------- */
PL.pause=function(on){if(!S)return;if(on){if(S.menu)return;S.menu='pause';PL.renderPause();$('pause-menu').hidden=false;IN.gameActive=false;setTimeout(()=>{const b=$('pause-menu').querySelector('button');b&&b.focus();},30);AU.crowd(.08);}
 else{if(S.menu!=='pause')return;S.menu=null;$('pause-menu').hidden=true;IN.gameActive=true;for(const h of S.humans)S.w.clearCommands(h.H.id);}};
PL.renderPause=function(){const w=S.w;const st=w.stats;const pct=i=>Math.round(st[i].poss/Math.max(1,st[0].poss+st[1].poss)*100);
 $('pause-menu').innerHTML=`<div class="om-box"><div class="om-head"><small>PARTIDA PAUSADA · ${esc(w.clockText())}</small><h2><img src="${App.crest(S.h)}" alt="">${w.score[0]} – ${w.score[1]}<img src="${App.crest(S.a)}" alt=""></h2></div>
  <div class="om-grid"><div class="om-list"><button class="om-btn" data-pm="resume">CONTINUAR</button><button class="om-btn" data-pm="tactics">ESCALAÇÃO E TÁTICAS</button><button class="om-btn" data-pm="stats">ESTATÍSTICAS</button><button class="om-btn" data-pm="camera">CÂMERA: ${esc(MD.Camera.LABEL[S.cam])}</button>${S.o.watch==='watch'?`<button class="om-btn" data-pm="speed">VELOCIDADE: ${S.watchSpeed}x</button>`:''}<button class="om-btn" data-pm="controls">CONTROLES</button><button class="om-btn danger" data-pm="quit">SAIR DA PARTIDA</button></div>
  <div class="om-panel" id="pm-panel">${PL.statsHTML()}</div></div></div>`;};
PL.statsHTML=function(){const w=S.w,s=w.stats;const tot=Math.max(1,s[0].poss+s[1].poss);const line=(l,a,b)=>`<div class="stat-line"><div class="sl-top"><b>${a}</b><span>${l}</span><b>${b}</b></div><div class="sl-bar"><div><i style="width:${(+a)+(+b)?a/((+a)+(+b))*100:0}%"></i></div><div><i style="width:${(+a)+(+b)?b/((+a)+(+b))*100:0}%"></i></div></div></div>`;
 return line('POSSE %',Math.round(s[0].poss/tot*100),Math.round(s[1].poss/tot*100))+line('FINALIZAÇÕES',s[0].shots,s[1].shots)+line('NO ALVO',s[0].onTarget,s[1].onTarget)+line('xG',+s[0].xg.toFixed(1),+s[1].xg.toFixed(1))+line('PASSES',s[0].passes,s[1].passes)+line('PASSES CERTOS',s[0].passOk,s[1].passOk)+line('DESARMES',s[0].tackleOk,s[1].tackleOk)+line('FALTAS',s[0].fouls,s[1].fouls)+line('ESCANTEIOS',s[0].corners,s[1].corners)+(w.offsideOn?line('IMPEDIMENTOS',s[0].offsides,s[1].offsides):'')+line('AMARELOS',s[0].yellow,s[1].yellow)+line('VERMELHOS',s[0].red,s[1].red)+line('DEFESAS',s[0].saves,s[1].saves);};
PL.controlsHTML=function(){const rows=MD.Input.ACTIONS.filter(a=>!['up','down','left','right'].includes(a[0]));return`<table class="ctl-table"><thead><tr><th>Ação</th>${S.humans.map(h=>`<th style="color:${h.css}">${h.label} · ${esc(h.devLabel)}</th>`).join('')||'<th>Teclado</th>'}</tr></thead><tbody>${rows.map(a=>`<tr><td>${esc(a[1])}</td>${(S.humans.length?S.humans:[{device:'kb1'}]).map(h=>`<td><kbd>${esc(IN.glyph(IN.device(h.device),a[0]))}</kbd></td>`).join('')}</tr>`).join('')}</tbody></table><p class="hint">Mover: WASD / analógico esquerdo / joystick do celular. Ctrl + botão de ação = dribles especiais. Toque rápido em Ctrl (ou analógico direito) = finta na direção. Remapeie em Configurações → Controles.</p>`;};
PL.halftime=function(){const w=S.w;S.menu='half';IN.gameActive=false;const k=w.breakKind;const title={half:'INTERVALO',pre_extra:'PRORROGAÇÃO',extra_half:'INTERVALO DA PRORROGAÇÃO',pre_shootout:'DISPUTA DE PÊNALTIS'}[k]||'INTERVALO';
 const best=w.ratings().slice(0,3);
 $('half-menu').innerHTML=`<div class="om-box"><div class="om-head"><small>${title}</small><h2><img src="${App.crest(S.h)}" alt="">${w.score[0]} – ${w.score[1]}<img src="${App.crest(S.a)}" alt=""></h2><span class="hint">${esc(PL.scorersText())}</span></div>
  <div class="om-grid"><div class="om-list"><button class="om-btn primary" data-hm="go">${k==='pre_shootout'?'IR PARA OS PÊNALTIS':k==='pre_extra'?'INICIAR PRORROGAÇÃO':'INICIAR 2º TEMPO'} ▶</button><button class="om-btn" data-hm="tactics">SUBSTITUIÇÕES E TÁTICAS</button><div class="om-best"><small>DESTAQUES</small>${best.map(r=>`<div class="star-row"><span>${esc(r.name)}</span><small class="hint">${esc(r.side==='home'?S.h.short:S.a.short)}</small><b>${r.rating.toFixed(1)}</b></div>`).join('')}</div></div>
  <div class="om-panel">${PL.statsHTML()}</div></div></div>`;$('half-menu').hidden=false;AU.play('whistle',{final:true});setTimeout(()=>{const b=$('half-menu').querySelector('button');b&&b.focus();},30);};
PL.resumeHalf=function(){$('half-menu').hidden=true;S.menu=null;IN.gameActive=true;S.camKey='x';S.w.resume();if(App.renderer.dir)App.renderer.dir.reset();for(const h of S.humans)S.w.clearCommands(h.H.id);};
PL.disconnected=function(h){S.menu='dc';IN.gameActive=false;S.dcH=h;const free=IN.list().filter(d=>!S.humans.some(x=>x.device===d.id));
 $('dc-menu').innerHTML=`<div class="om-box small"><div class="om-head"><small>DISPOSITIVO DESCONECTADO</small><h2 style="color:${h.css}">${h.label} · ${esc(h.devLabel)}</h2><p class="hint">A partida está pausada. Reconecte o dispositivo para continuar automaticamente, ou escolha outra opção.</p></div>
  <div class="om-list">${free.map(d=>`<button class="om-btn" data-dc="${esc(d.id)}">USAR ${esc(d.short)}</button>`).join('')}<button class="om-btn" data-dc="ai">DEIXAR A IA CONTROLAR</button></div></div>`;$('dc-menu').hidden=false;
 const wait=()=>{if(!S||S.menu!=='dc')return;const d=IN.device(h.device);if(d&&d.connected){PL.closeDc();App.toast(h.label+' reconectado.');return;}setTimeout(wait,300);};setTimeout(wait,300);};
PL.closeDc=function(){$('dc-menu').hidden=true;S.menu=null;IN.gameActive=true;};
/* ---------- fim de jogo ---------- */
PL.scorersText=function(){const w=S.w;const g=w.events.filter(e=>e.type==='goal');return g.map(e=>{const p=w.byId(e.pid);return`${e.team?S.a.short:S.h.short} ${p?p.name.split(' ').pop():''} ${e.minute}'${e.own?' (GC)':''}`;}).join(' · ')||'Sem gols';};
PL.fulltime=function(){const w=S.w;S.finished=true;IN.gameActive=false;let res=null;
 if(S.o.onFinish&&!S.reported){S.reported=true;try{res=S.o.onFinish(w);}catch(e){console.error(e);App.toast('Falha ao registrar o resultado: '+e.message);}}
 const win=w.winner();const T=S.o.tournament;
 if(T&&T.final&&win&&App.isWebGL&&CI){const tr=CI.ceremony({lineup:PL.lineup(),resolve:PL.resolver(),mode:w.mode.id,names:{home:S.h.name,away:S.a.name},winner:win,captain:w.teams[win==='home'?0:1].captain,seed:w.seed});S.cer={tr,t:0,win};S.mode='ceremony';$('play-skip').hidden=false;$('play-skip').textContent='PULAR CERIMÔNIA ⏭';$('hud').classList.add('dim');return;}
 setTimeout(()=>PL.showPost(),1600);S.mode='ending';};
PL.endCeremony=function(){const win=S.cer.win;S.cer=null;$('play-skip').hidden=true;$('play-cine').hidden=true;$('hud').classList.remove('dim');AU.stopMusic&&AU.stopMusic();
 const club=win==='home'?S.h:S.a;const T=S.o.tournament;const el=$('play-champ');el.innerHTML=`<div class="champ-box"><small>${esc(T?T.name:'TRS26')}</small><div class="champ-trophy"><img src="assets/branding/TACA_DA_COPA.webp" alt="" onerror="this.replaceWith(document.createRange().createContextualFragment(MD.App.trophySVG(90)))"></div><img class="champ-crest" src="${App.crest(club)}" alt=""><b>CAMPEÃO DO TORNEIO</b><div class="champ-name">${esc(club.name)}</div><div class="btn-row"><button class="btn primary" id="champ-ok">CONTINUAR ➜</button></div></div>`;el.hidden=false;
 $('champ-ok').onclick=()=>{el.hidden=true;PL.showPost();};setTimeout(()=>$('champ-ok')&&$('champ-ok').focus(),50);S.mode='champ';};
PL.showPost=function(){const w=S.w;S.mode='post';S.menu='post';IN.gameActive=false;const T=S.o.tournament;const R=w.ratings();const motm=R[0];const st=w.stats;
 const win=w.winner();const resTxt=!win?'Empate':`${win==='home'?S.h.name:S.a.name} vence${w.pens&&w.pens.decided?` nos pênaltis (${w.pens.home} x ${w.pens.away})`:''}`;
 const goals=side=>w.events.filter(e=>e.type==='goal'&&e.team===side).map(e=>{const p=w.byId(e.pid),a=e.assist?w.byId(e.assist):null;return`<li>⚽ ${esc(p?p.name:'')} ${e.minute}'${e.own?' (GC)':''}${a?` <small>assist. ${esc(a.name)}</small>`:''}</li>`;}).join('')||'<li class="hint">—</li>';
 const mp=motm&&motm.p;const club=motm&&motm.side==='home'?S.h:S.a;
 $('post-menu').innerHTML=`<div class="om-box wide"><div class="post-head"><div class="ph-t"><img src="${App.crest(S.h)}" alt=""><b>${esc(S.h.name)}</b><ul>${goals(0)}</ul></div><div class="ph-mid"><small>${esc(T?T.name+' · '+(T.round||''):'RESULTADO FINAL')}</small><div class="ph-sc">${w.score[0]} – ${w.score[1]}</div>${w.pens&&w.pens.decided?`<em>pênaltis ${w.pens.home} x ${w.pens.away}</em>`:''}<span class="hint">${esc(resTxt)}</span></div><div class="ph-t"><img src="${App.crest(S.a)}" alt=""><b>${esc(S.a.name)}</b><ul>${goals(1)}</ul></div></div>
  <div class="post-grid"><div class="card">${PL.statsHTML()}</div>
   <div class="card"><h3>Melhor jogador</h3>${mp?`<div class="motm-card2" style="--c1:${club.primary}"><div class="mc-ovr">${mp.ovr}<small>${esc(mp.pos)}</small></div><div class="mc-photo">${App.avatar(mp.data)}</div><div class="mc-body"><b>${esc(mp.name)}</b><span>${esc(club.name)}</span><div class="mc-grade">NOTA ${motm.rating.toFixed(1)}</div><div class="hint">${mp.st.goals?mp.st.goals+' gol(s) · ':''}${mp.st.assists?mp.st.assists+' assist. · ':''}${mp.st.passOk} passes certos${mp.st.saves?' · '+mp.st.saves+' defesas':''}</div></div></div>`:''}
    <h3 style="margin-top:12px">Notas</h3>${R.slice(1,9).map(r=>`<div class="star-row"><span>${esc(r.name)}</span><small class="hint">${esc(r.side==='home'?S.h.short:S.a.short)} · ${esc(r.pos)}</small><b>${r.rating.toFixed(1)}</b></div>`).join('')}</div>
   <div class="card"><h3>Melhores momentos</h3><div class="hl-list">${S.highlights.map((h,i)=>`<button class="hl-item" data-hl="${i}">▶ <b>${esc(h.minute)}'</b> ${esc(h.title)}</button>`).join('')||'<p class="hint">Sem lances gravados.</p>'}</div></div></div>
  <div class="om-actions">${T?'<button class="om-btn primary" data-po="copa">VOLTAR AO TORNEIO</button>':'<button class="om-btn primary" data-po="again">JOGAR NOVAMENTE</button>'}<button class="om-btn" data-po="menu">VOLTAR AO MENU</button></div></div>`;
 $('post-menu').hidden=false;setTimeout(()=>{const b=$('post-menu').querySelector('.om-actions button');b&&b.focus();},50);AU.crowd(.15);};
PL.stop=function(silent){if(!S)return;IN.gameActive=false;for(const id of ['pause-menu','half-menu','post-menu','dc-menu','play-cine','play-skip','play-champ'])$(id).hidden=true;S=null;document.body.classList.remove('mode-germinare');AU.crowd(0);};
PL.again=function(){const o=S.o;PL.stop(true);PL.start({...o,cinema:false,seed:undefined});};
/* ---------- HUD ---------- */
PL.hudTick=function(dt,replay){const w=S.w;const now=performance.now();
 /* etiquetas dos atletas controlados (posição projetada) */const R=App.renderer;const used=new Set();
 if(!replay&&S.mode==='live'){for(const h of S.humans){const p=h.H.player;if(!p||p.off)continue;const pt=R.project(p.x,2.35,p.z);if(!pt)continue;let el=S.tags.get(h);if(!el){el=document.createElement('div');el.className='hud-tag';$('hud-tags').appendChild(el);S.tags.set(h,el);}used.add(el);
   const ch=h.H.charging;const pw=ch?clamp((w.time-ch.t0)/(ch.k==='shoot'?.95:.8),0,1):0;const key=h.label+p.id+(ch?ch.k:'')+(pw*20|0)+(p.stamina*20|0);
   if(el.dataset.k!==key){el.dataset.k=key;el.innerHTML=`<span class="tg-l" style="background:${h.css}">${h.label}</span><span class="tg-n">${esc(String(p.name).split(' ').pop())}</span>${ch?`<i class="tg-pw ${ch.k}"><b style="width:${pw*100}%"></b></i>`:''}<i class="tg-st"><b style="width:${p.stamina*100}%"></b></i>`;}
   el.style.transform=`translate(${pt.x}px,${pt.y}px)`;el.hidden=false;}}
 for(const el of S.tags.values())if(!used.has(el))el.hidden=true;
 PL.minimap();
 if(now-S.lastUI<100)return;S.lastUI=now;
 $('hs-score').textContent=`${w.score[0]} – ${w.score[1]}`;$('hs-clock').textContent=w.clockText();const per=w.period();$('hs-period').textContent=w.pens?'PÊN':per?({first:w.small?'TU':'1T',second:'2T',et1:'1PR',et2:'2PR',golden:'OURO'}[per.id]||''):'';
 const add=per&&w.added[per.id];$('hs-add').hidden=!(add&&w.clock>=per.start+per.len);if(add)$('hs-add').textContent='+'+Math.round(add/60);
 $('hs-pens').hidden=!w.pens;if(w.pens)$('hs-pens').textContent=`PÊN ${w.pens.home}–${w.pens.away}`;
 $('hud-ff').hidden=!(S.ts>1.6);$('hud-ff').textContent=S.o.watch==='watch'?`⏩ ${S.watchSpeed}x`:'⏩ ACELERANDO';
 /* cartões dos humanos */
 $('hud-players').innerHTML=S.humans.map(h=>{const p=h.H.player;return`<div class="hp" style="--c:${h.css}"><span class="hp-l">${h.label}</span><div><b>${p?esc(p.name):'—'}</b><small>${p?esc(App.posLabel(p.pos))+' · '+p.ovr:''} · ${esc(h.devLabel)}</small><i class="hp-st"><b style="width:${p?p.stamina*100:0}%"></b></i></div></div>`;}).join('');
 /* contexto de bola parada */
 const r=w.restart;let ctx='';
 if(r&&r.taker&&r.taker.human){const h=S.humans.find(x=>x.H.id===r.taker.human);const d=h&&IN.device(h.device);const g=a=>`<kbd>${esc(IN.glyph(d,a))}</kbd>`;
  ctx={kickoff:`SAÍDA DE BOLA · ${g('pass')} passe`,throw:`${w.kickIn?'LATERAL COM OS PÉS':'LATERAL'} · direção + ${g('pass')} curto · ${g('cross')} longo`,corner:`ESCANTEIO · direção + ${g('cross')} cruzamento (segure para força) · ${g('pass')} curto`,goalkick:`TIRO DE META · ${g('pass')} curto · ${g('shoot')} longo`,freekick:r.shootable?`FALTA · ${g('shoot')} chute (segure a força, ${g('skill')} colocado) · ${g('pass')} passe · ${g('cross')} cruzamento`:`FALTA · ${g('pass')} passe · ${g('cross')} lançamento`,penalty:`PÊNALTI · escolha o canto com a direção e segure ${g('shoot')} para a força`}[r.type]||'';}
 else if(r&&r.type==='penalty'){const gk=w.gk(1-r.team);if(gk&&gk.human)ctx='PÊNALTI CONTRA · segure a direção para escolher o lado do mergulho';}
 $('hud-context').innerHTML=ctx;$('hud-context').hidden=!ctx;
 if(App.settings.diagnostics){const st=R.stats||{};$('hud-diag').hidden=false;$('hud-diag').textContent=`FPS ${MD.Boot.fps.toFixed(0)} · quadro ${MD.Boot.frameMs.toFixed(1)} ms · render ${(st.ms||0).toFixed(1)} ms · draws ${st.draws||0}\nfísica ${(1/DT)|0} Hz fixa · escala ${S.ts.toFixed(2)}x · fase ${w.phase}`;}else $('hud-diag').hidden=true;};
PL.minimap=function(){const c=$('hud-mini');if(!c||!S)return;const x=c.getContext('2d'),W=c.width,H=c.height,w=S.w,L=w.P.L,Wd=w.P.W;const sx=v=>W/2+v/L*(W/2-6),sz=v=>H/2+v/Wd*(H/2-6);
 x.clearRect(0,0,W,H);x.fillStyle='rgba(8,14,10,.62)';x.fillRect(0,0,W,H);x.strokeStyle='rgba(255,255,255,.35)';x.lineWidth=1;x.strokeRect(6,6,W-12,H-12);x.beginPath();x.moveTo(W/2,6);x.lineTo(W/2,H-6);x.stroke();
 const cols=[S.kits.home.primary,S.kits.away.primary];const hl=new Map();for(const h of S.humans)if(h.H.player)hl.set(h.H.player,h.css);
 for(const t of w.teams)for(const p of t.players){if(p.off)continue;x.fillStyle=cols[t.idx];x.beginPath();x.arc(sx(p.x),sz(p.z),p.gk?3.2:2.8,0,7);x.fill();const c2=hl.get(p);if(c2){x.strokeStyle=c2;x.lineWidth=2;x.beginPath();x.arc(sx(p.x),sz(p.z),5,0,7);x.stroke();}}
 x.fillStyle='#fff';x.beginPath();x.arc(sx(w.ball.x),sz(w.ball.z),2.4,0,7);x.fill();};
PL.renderHints=function(){const el=$('hud-hints');if(!S||!S.humans.length){el.innerHTML='<span><kbd>Esc</kbd> pausa · <kbd>C</kbd> câmera</span>';return;}const h=S.humans[0];const d=IN.device(h.device);const g=a=>`<kbd>${esc(IN.glyph(d,a))}</kbd>`;
 el.innerHTML=`<span>${g('pass')} passe</span><span>${g('shoot')} chute</span><span>${g('cross')} cruz.</span><span>${g('through')} prof.</span><span>${g('sprint')} sprint</span><span>${g('switch')} troca</span><span>${g('pause')} pausa</span>`;};
/* ---------- ligações de interface ---------- */
PL.bind=function(){
 $('play-skip').onclick=()=>{if(!S)return;if(S.mode==='intro')PL.endIntro();else if(S.mode==='ceremony')S.cer.t=S.cer.tr.duration;};
 $('pause-menu').addEventListener('click',e=>{const b=e.target.closest('[data-pm]');if(!b||!S)return;const k=b.dataset.pm;
  if(k==='resume')PL.pause(false);
  if(k==='tactics'){const ed=S.o.watch==='play'?[S.humans.some(h=>h.side==='home'),S.humans.some(h=>h.side==='away')]:[true,true];MD.TacticsUI.open({clubs:[S.h,S.a],side:ed[0]?0:1,world:S.w,editable:ed,onClose:()=>{PL.renderPause();}});}
  if(k==='stats')$('pm-panel').innerHTML=PL.statsHTML();
  if(k==='controls')$('pm-panel').innerHTML=PL.controlsHTML();
  if(k==='camera'){const L=MD.Camera.USER;S.cam=L[(L.indexOf(S.cam)+1)%L.length];App.settings.cam=S.cam;App.applySettings();b.textContent='CÂMERA: '+MD.Camera.LABEL[S.cam];$('pm-panel').innerHTML=`<div class="fgrid"><label>Zoom / distância<input type="range" min="0.6" max="1.6" step="0.05" value="${S.zoom}" data-camk="zoom"></label><label>Altura<input type="range" min="0.6" max="1.8" step="0.05" value="${S.height}" data-camk="height"></label></div><p class="hint">Câmeras: ${MD.Camera.USER.map(c=>MD.Camera.LABEL[c]).join(' · ')}. Tecla C durante o jogo alterna.</p>`;}
  if(k==='speed'){S.watchSpeed=S.watchSpeed===1?2:S.watchSpeed===2?4:1;b.textContent='VELOCIDADE: '+S.watchSpeed+'x';}
  if(k==='quit'){if(!confirm('Sair da partida? O resultado não será salvo.'))return;const T=S.o.tournament;PL.stop();App.go(T?'copa':'home');}});
 $('pause-menu').addEventListener('input',e=>{const k=e.target.dataset.camk;if(!k||!S)return;S[k]=+e.target.value;App.settings['cam'+(k==='zoom'?'Zoom':'Height')]=S[k];App.applySettings();});
 $('half-menu').addEventListener('click',e=>{const b=e.target.closest('[data-hm]');if(!b||!S)return;if(b.dataset.hm==='go')PL.resumeHalf();else{const ed=S.o.watch==='play'?[S.humans.some(h=>h.side==='home'),S.humans.some(h=>h.side==='away')]:[true,true];MD.TacticsUI.open({clubs:[S.h,S.a],side:ed[0]?0:1,world:S.w,editable:ed});}});
 $('dc-menu').addEventListener('click',e=>{const b=e.target.closest('[data-dc]');if(!b||!S)return;const h=S.dcH;const v=b.dataset.dc;if(v==='ai'){S.w.removeHuman(h.H.id);S.humans=S.humans.filter(x=>x!==h);}else{h.device=v;h.devLabel=(IN.device(v)||{}).short||v;h.H.device=v;}PL.closeDc();PL.renderHints();});
 $('post-menu').addEventListener('click',e=>{const hl=e.target.closest('[data-hl]');if(hl&&S){PL.playHighlight(+hl.dataset.hl);return;}const b=e.target.closest('[data-po]');if(!b||!S)return;const k=b.dataset.po;if(k==='again')PL.again();else if(k==='copa'){PL.stop();App.go('copa');}else{PL.stop();App.go('home');}});
 document.addEventListener('keydown',e=>{if(App.screen!=='play'||!S)return;if(e.code==='KeyC'&&!S.menu&&!(S.humans.some(h=>h.device==='kb1')&&false)){const L=MD.Camera.USER;S.cam=L[(L.indexOf(S.cam)+1)%L.length];PL.banner(`<span>CÂMERA: ${MD.Camera.LABEL[S.cam]}</span>`,'info',1.2);}
  if((e.code==='Enter'||e.code==='Space')&&(S.mode==='intro'||S.mode==='ceremony')){e.preventDefault();$('play-skip').click();}});};
})(window.MD=window.MD||{});
