/* MATCHDAY 0.5 — partida ao vivo: apresentação pré-jogo, relógio contextual + agendador de lances (Pacing.Live),
   toque inicial, lances 3D sincronizados, replays sem revelar o futuro, intervalo/prorrogação/pênaltis, final e
   cerimônia do campeão (Modo Copa), tela final do Germinare e pós-jogo. */
(function(MD){
'use strict';
const U=MD.U,E=MD.Engine,C=MD.Choreo,K=MD.Kit,AU=MD.Audio,App=MD.App,PG=MD.Pacing,CI=MD.Cinema,$=id=>document.getElementById(id),esc=U.escape;
const MT=MD.Match={};
let S=null;
const ICON={throw:'↷',goal:'⚽',owngoal:'⚽',save:'🧤',post:'◎',miss:'↗',blocked:'⛔',offside:'🚩',card:'▮',red:'▮',yellow:'▮',foul:'✋',disallowed:'✖',penalty_miss:'✖',chance:'⚡',sub:'⇄',added:'⏱',injury:'✚',shootout:'◉'};
const PACES=['slow','normal','fast'],PACE_LABEL={slow:'LENTO',normal:'NORMAL',fast:'RÁPIDO'};
MT.active=()=>!!S&&S.mode!=='done';
MT.state=()=>S;
/* ---------- início ---------- */
MT.start=function(home,away,opts){opts=opts||{};const st=App.settings;const modeId=opts.mode||'pro';
 const settings={...st,mode:modeId,germinare:{...st.germinare,...(opts.germ||{})},knockout:opts.knockout||null,neutral:!!opts.neutral,seed:opts.seed??st.seed};
 const h=U.deepClone(home),a=U.deepClone(away);const m=E.createMatch(h,a,settings);const res=E.resolver(m);
 const pace=opts.pace||(modeId==='germinare'?settings.germinare.pace:st.pace)||'normal';
 S={m,h,a,res,opts,mode:'live',paused:false,mul:1,cam:st.cam||'auto',tr:null,t:0,ambient:null,amT:0,feedDirty:true,replay:null,shown:{label:null,lt:null},breakT:0,lastUI:0,kits:K.pickKits(h,a),
  snapKey:null,statsCache:null,breakShown:false,finished:false,cine:null,cer:null,pace,lastEv:null};
 S.L=new PG.Live(m,{pace,mul:1,replays:st.replays!==false,slowmo:st.slowmo!==false,build:ev=>{const tr=C.build(ev,{resolve:res});ev._track=tr;return tr;},
  kickoff:(k,L)=>{const lu=MT.lineupNow();const per=E.periodOf(m,k.period);return C.kickoff(lu,k.side,per.half,res,(k.t*7+3)>>>0,{mode:m.mode.id,long:!k.afterGoal,tac:{home:m.teams.home.tactics.marking,away:m.teams.away.tactics.marking},label:k.afterGoal?'BOLA AO CENTRO':k.period==='first'?'TOQUE INICIAL':k.period==='second'?'COMEÇA O 2º TEMPO':'PRORROGAÇÃO'});},
  onApply:ev=>MT.applyEvent(ev),onStart:it=>MT.onStart(it),onEnd:(it,worth)=>MT.onEnd(it,worth)});
 const R=App.renderer;if(R.setVenue)R.setVenue(m.mode.venue||'arena');R.setTeams(h,a,S.kits);R.setQuality&&R.setQuality(st.quality);if(R.dir)R.dir.reset();
 $('tvs-home').textContent=h.short;$('tvs-away').textContent=a.short;$('tvs-hcrest').src=App.crest(h);$('tvs-acrest').src=App.crest(a);
 for(const id of ['half-overlay','goal-flash','lower-third','tv-label','replay-badge','c-live','ticker-pop','cine-overlay','cine-skip','champion-overlay','cine-chapters','tvs-pens'])$(id).hidden=true;
 document.body.classList.toggle('mode-germinare',m.mode.id==='germinare');document.body.classList.toggle('mode-final',!!(opts.tournament&&opts.tournament.final));
 $('tvs-tag').textContent=opts.tournament?(opts.tournament.final?'FINAL':String(opts.tournament.round||'COPA').toUpperCase()):m.mode.id==='germinare'?'GERMINARE':'AO VIVO';
 $('c-pace').textContent=PACE_LABEL[pace];$('c-speed').textContent='1X';$('c-cam').textContent=MD.Camera.LABEL[S.cam]||'AUTO';
 App.go('match');MT.newAmbient();MT.syncControls();MT.renderFeed();MT.renderStats();MT.renderLineups();
 AU.resume();AU.ambience(m.mode.id==='germinare'?'school':'stadium');AU.crowd(m.mode.id==='germinare'?.12:.25);
 const wantCine=opts.cinema!==undefined?opts.cinema:(modeId==='germinare'?settings.germinare.cinema!==false:st.cinema!==false);
 if(wantCine&&App.isWebGL)MT.startCinema();else{S.L.begin();}
 if(!opts.tournament)App.toast(`Seed da partida: ${m.seed} (use para reproduzir)`);};
MT.lineupNow=function(){const m=S.m;const s=S.L?S.L.shown():null;if(!s)return{home:m.teams.home.players.map(p=>p&&p.on?p.id:null),away:m.teams.away.players.map(p=>p&&p.on?p.id:null)};
 const on=new Map();for(const x of s.lines)if(x[1])on.set(x[0],x[5]);const lu={};for(const side of ['home','away']){const t=m.teams[side];const all=[...t.players.filter(Boolean),...t.bench,...t.sentOff];
  lu[side]=t.slots.map((sl,i)=>{const p=all.find(q=>on.has(q.id)&&on.get(q.id)===i);return p?p.id:null;});}return lu;};
MT.newAmbient=function(){const m=S.m;const lu=MT.lineupNow();const ss=S.L&&S.L.shown();const st=ss?JSON.parse(ss.stats):m.stats;const side=st.home.possession>=50?(Math.random()<.6?'home':'away'):(Math.random()<.6?'away':'home');
 S.ambient=C.ambient(lu,side,m.half==='second'?'second':'first',S.res,(Math.random()*1e9)>>>0);S.amT=0;};
MT.pause=function(p){if(!S)return;S.paused=p===undefined?!S.paused:p;MT.syncControls();};
/* ---------- apresentação pré-jogo ---------- */
MT.ctxNames=()=>({home:S.h.name,away:S.a.name});
MT.captain=side=>{const t=S.m.teams[side];const on=E.onPitch(t);const l=on.find(p=>p.data.personality==='leader'&&p.group!=='GK')||on.filter(p=>p.group!=='GK').sort((a,b)=>b.data.rating-a.data.rating)[0];return l?l.id:null;};
MT.startCinema=function(){const m=S.m,o=S.opts;const T=o.tournament;
 const tr=CI.prematch({lineup:MT.lineupNow(),resolve:S.res,mode:m.mode.id,final:!!(T&&T.final),names:MT.ctxNames(),captains:{home:MT.captain('home'),away:MT.captain('away')},
  stadium:T&&T.stadium?T.stadium:m.mode.id==='germinare'?'Instituto J&F · Germinare':(S.h.stadiumName||'Arena MATCHDAY'),competition:T?T.name:m.mode.id==='germinare'?'GERMINARE':'MATCHDAY',seed:m.seed});
 S.cine={tr,t:0,anthemDone:false,ov:null};S.mode='cinema';$('cine-skip').hidden=false;$('cine-skip').textContent='PULAR APRESENTAÇÃO ⏭';$('idle-hud').hidden=true;$('tv-score').classList.add('dim');
 $('cine-chapters').hidden=false;$('cine-chapters').innerHTML=(tr.chapters||[]).map(c=>`<span data-t="${c.t}">${esc(c.name)}</span>`).join('');
 AU.crowd(.5);if(!tr.anthemAt)AU.anthem(App.settings,8);};
MT.endCinema=function(){if(!S||S.mode!=='cinema')return;AU.stopMusic();S.cine=null;S.mode='live';for(const id of ['cine-overlay','cine-skip','cine-chapters'])$(id).hidden=true;$('tv-score').classList.remove('dim');$('idle-hud').hidden=false;
 if(App.renderer.dir)App.renderer.dir.reset();AU.crowd(S.m.mode.id==='germinare'?.12:.25);S.L.begin();};
MT.cineOverlay=function(tr,t){let o=null;for(const x of tr.overlays)if(x.kind==='cine'&&t>=x.t0&&t<=x.t1)o=x;const el=$('cine-overlay');
 if(o===(S.cineOv||null))return;S.cineOv=o;if(!o){el.hidden=true;return;}const crest=side=>App.crest(side==='away'?S.a:S.h);
 let html='';if(o.layout==='title')html=`<div class="co-title"><small>${esc(o.tag||'')}</small><b>${esc(o.title)}</b><span>${esc(o.sub||'')}</span></div>`;
 else if(o.layout==='versus')html=`<div class="co-versus"><div><img src="${App.crest(S.h)}" alt=""><b>${esc(o.title)}</b><small>OVR ${MD.Data.teamOverall(S.h)}</small></div><em>VS</em><div><img src="${App.crest(S.a)}" alt=""><b>${esc(o.sub)}</b><small>OVR ${MD.Data.teamOverall(S.a)}</small></div><span class="co-tag">${esc(o.tag||'')}</span></div>`;
 else if(o.layout==='crest'){const club=o.side==='away'?S.a:S.h;const t=S.m.teams[o.side];html=`<div class="co-crest"><img src="${crest(o.side)}" alt=""><div><b>${esc(o.title)}</b><small>${esc(o.sub||'')}</small><ol>${E.onPitch(t).map(p=>`<li><i>${p.data.number}</i>${esc(p.data.name)}</li>`).join('')}</ol></div></div>`;}
 else html=`<div class="co-text ${o.tone||''}"><b>${esc(o.title)}</b><span>${esc(o.sub||'')}</span></div>`;
 el.innerHTML=html;el.hidden=false;el.style.animation='none';void el.offsetWidth;el.style.animation='';};
/* ---------- placar/estatísticas mostrados (fotografia do motor até o relógio da tela) ---------- */
function snap(){return S.L.shown();}
function shownScore(){const s=snap();return s?s.score:{home:0,away:0};}
function shownStats(){const s=snap();if(!s)return S.m.stats;if(S.snapKey!==s){S.snapKey=s;S.statsCache=JSON.parse(s.stats);}return S.statsCache;}
function shownPens(){const s=snap();return s&&s.pens?s.pens:null;}
function clockLabel(){const m=S.m;if(m.phase==='shootout'||(m.pens&&S.L.state!=='idle'&&S.L.cur&&S.L.cur.shoot))return'PÊNALTIS';return E.clockText(m,S.L.clock,m.period);}
/* ---------- laço ---------- */
MT.update=function(dt){if(!S)return;const R=App.renderer;const m=S.m;const L=S.L;const rdt=S.paused?0:dt;
 if(!S.paused){
  if(S.mode==='cinema'){const c=S.cine;const prev=c.t;c.t+=dt;MT.processMarks(c.tr,prev,c.t,false);if(!c.anthemDone&&c.tr.anthemAt&&c.t>=c.tr.anthemAt){c.anthemDone=true;AU.anthem(App.settings,c.tr.anthemDur||12);}
   for(const s of $('cine-chapters').children)s.classList.toggle('on',c.t>=+s.dataset.t);if(c.t>=c.tr.duration)MT.endCinema();}
  else if(S.mode==='ceremony'){const c=S.cer;const prev=c.t;c.t+=dt;MT.processMarks(c.tr,prev,c.t,false);if(!c.fanfare&&c.t>=c.tr.liftAt){c.fanfare=true;AU.champion();}if(c.t>=c.tr.duration)MT.endCeremony();}
  else if(S.mode==='replay'){const prev=S.t;S.t+=dt*(S.replaySpeed||1);MT.processMarks(S.tr,prev,S.t,false);if(S.t>=S.tr.duration)MT.endUserReplay();}
  else if(S.mode==='live'){const prevState=L.state,prevT=L.t;L.update(dt);
   if(L.state==='present'&&L.cur&&L.cur.tr){if(prevState==='present'&&S.tr===L.cur.tr)MT.processMarks(S.tr,prevT,L.t,true);}
   else if(L.state==='replay'&&L.cur){MT.processMarks(L.cur.tr,prevT,L.t,false);}
   else if(L.state==='idle'){if(prevState==='replay')MT.backToIdle();S.amT+=dt;if(S.ambient&&S.amT>S.ambient.duration-.2)MT.newAmbient();}
   else if(L.state==='break')MT.breakTick(dt);
   else if(L.state==='done'&&!S.finished)MT.fulltime();
   if(S.feedDirty)MT.pumpFeed();}
  else if(S.mode==='post'){/* parado no apito final */}}
 /* render */
 const sc=shownScore();const scr={home:S.h.short,away:S.a.short,hs:sc.home,as:sc.away,clock:S.mode==='cinema'?'00:00':clockLabel(),goal:S.goalScreen>0,scorer:S.goalScorer,t:performance.now()/1000,goalColor:S.goalColor};
 if(S.goalScreen>0)S.goalScreen-=dt;
 if(S.mode==='cinema'){R.renderTrack(S.cine.tr,S.cine.t,{dt:rdt,camMode:'auto',screen:scr});MT.cineOverlay(S.cine.tr,S.cine.t);}
 else if(S.mode==='ceremony'){R.renderTrack(S.cer.tr,S.cer.t,{dt:rdt,camMode:'auto',screen:scr});MT.cineOverlay(S.cer.tr,S.cer.t);}
 else if(S.mode==='replay')R.renderTrack(S.tr,S.t,{dt:rdt,camMode:S.cam,screen:scr,noFX:true});
 else if((L.state==='present'||L.state==='replay')&&L.cur&&L.cur.tr)R.renderTrack(L.cur.tr,L.t,{dt:rdt,camMode:S.cam,replayCam:L.state==='replay'&&L.cur.tr.replay?L.cur.tr.replay.cam:null,screen:scr,noFX:L.state!=='present'});
 else if(S.ambient)R.renderTrack(S.ambient,Math.min(S.amT,S.ambient.duration),{dt:rdt,camMode:S.cam,screen:scr,noFX:true});
 const now=performance.now();if(now-S.lastUI>110){S.lastUI=now;MT.updateUI();}};
/* ---------- eventos do agendador ---------- */
MT.onStart=function(it){S.tr=it.tr;S.ev=it.ev||null;S.ovKey='';S.shown={};$('idle-hud').hidden=true;$('replay-badge').hidden=true;if(App.renderer.dir)App.renderer.dir.reset();
 if(it.kind==='event'){AU.crowd(S.m.mode.id==='germinare'?.3:.45);S.feedDirty=true;}else{AU.crowd(.35);}MT.syncControls();};
MT.onEnd=function(it,worth){if(worth){$('replay-badge').hidden=false;$('replay-text').textContent='REPLAY · CÂMERA LENTA';if(App.renderer.dir)App.renderer.dir.reset();return;}MT.backToIdle();};
MT.backToIdle=function(){S.tr=null;S.ev=null;$('lower-third').hidden=true;$('tv-label').hidden=true;$('replay-badge').hidden=true;$('idle-hud').hidden=false;S.shown={};AU.crowd(S.m.mode.id==='germinare'?.12:.25);MT.newAmbient();MT.syncControls();S.feedDirty=true;};
MT.applyEvent=function(ev){S.feedDirty=true;S.lastEv=ev;
 if(ev.goal){$('tvs-score').classList.remove('bump');void $('tvs-score').offsetWidth;$('tvs-score').classList.add('bump');const sc=S.res(ev.goal.scorerId);S.goalScreen=4.5;S.goalScorer=sc?sc.name:'';S.goalColor=(ev.goal.side==='home'?S.kits.home:S.kits.away).primary;AU.cheer(1);}
 if(ev.kind==='shootout')$('tvs-score').classList.add('bump');};
MT.processMarks=function(tr,t0,t1,live){if(!tr||!tr.marks)return;for(const mk of tr.marks){if(mk.t<=t0||mk.t>t1)continue;
  switch(mk.type){case'kick':AU.play(mk.power>20?'kick':'pass',{power:mk.power});break;case'header':AU.play('header');break;case'touch':case'catch':AU.play('touch');break;
   case'whistle':AU.play('whistle');break;case'whistle_long':AU.play('whistle',{long:true});break;case'final_whistle':AU.play('whistle',{final:true});break;case'goal':AU.play('goal');if(live)MT.goalFlash();break;case'net':AU.play('net');break;
   case'save':AU.play('save');break;case'post':AU.play('post');break;case'crowd_oh':AU.play('oh');break;case'crowd_up':AU.play('crowd_up');break;case'crowd_hype':AU.cheer(mk.k||.8);break;case'card':AU.play('card');break;case'tackle':case'foul_contact':AU.play('tackle');break;case'flag':AU.play('touch');break;}}};
MT.goalFlash=function(){const ev=S.ev;if(!ev||!ev.goal)return;const sc=S.res(ev.goal.scorerId);$('gf-sub').textContent=(ev.goal.ownGoal?'GOL CONTRA · ':'')+(sc?sc.name:'')+' · '+(ev.goal.side==='home'?S.h.name:S.a.name);
 const g=$('goal-flash');g.hidden=false;const w=g.querySelector('.gf-word');w.style.animation='none';void w.offsetWidth;w.style.animation='';clearTimeout(S.gfT);S.gfT=setTimeout(()=>{g.hidden=true;},2300);};
MT.skip=function(){if(!S)return;if(S.mode==='cinema'){MT.endCinema();return;}if(S.mode==='ceremony'){MT.endCeremony();return;}if(S.mode==='replay'){MT.endUserReplay();return;}
 if(S.mode==='live'&&(S.L.state==='present'||S.L.state==='replay')){const was=S.L.state;S.L.skip();if(was==='replay'||S.L.state==='idle')MT.backToIdle();}};
/* ---------- replay escolhido pelo usuário (apenas lances já concluídos) ---------- */
MT.replayEvent=function(ev){if(!S||!ev||!ev.applied)return;if(S.mode==='live'&&(S.L.state==='present'||S.L.state==='replay')){App.toast('Aguarde o lance atual terminar.');return;}if(S.mode==='cinema'||S.mode==='ceremony')return;
 S.replay={prevMode:S.mode};S.mode='replay';S.replaySpeed=1;S.ev=ev;S.tr=ev._track||(ev._track=C.build(ev,{resolve:S.res}));S.t=S.tr.startT||0;S.paused=false;
 $('half-overlay').hidden=true;$('replay-badge').hidden=false;$('replay-text').textContent=`REPLAY · ${ev.minute}${/^\d+$/.test(ev.minute)?"'":''}`;$('c-live').hidden=false;$('idle-hud').hidden=true;if(App.renderer.dir)App.renderer.dir.reset();
 if(App.screen!=='match')App.go('match');MT.syncControls();MT.renderFeed();};
MT.endUserReplay=function(){if(!S||S.mode!=='replay')return;const prev=S.replay.prevMode;S.replay=null;S.ev=null;S.tr=null;for(const id of ['replay-badge','c-live','lower-third','tv-label'])$(id).hidden=true;
 $('c-speed').textContent=S.mul+'X';S.mode=prev;if(prev==='post'){App.go('post');}else if(S.L.state==='break'){$('half-overlay').hidden=false;}else $('idle-hud').hidden=false;MT.newAmbient();MT.syncControls();MT.renderFeed();};
MT.navEvent=function(dir){if(!S)return;const done=S.m.events.filter(e=>e.applied&&e._shown);if(!done.length){App.toast('Ainda não houve lances para rever.');return;}
 let i=S.mode==='replay'?done.indexOf(S.ev):done.length;i+=dir;if(i<0)i=0;if(i>=done.length){if(S.mode==='replay')MT.endUserReplay();else App.toast('Os próximos lances ainda não aconteceram!');return;}
 if(S.mode==='replay'){S.mode=S.replay.prevMode;}MT.replayEvent(done[i]);};
/* ---------- intervalo, prorrogação, pênaltis e fim ---------- */
const BREAK={half:['INTERVALO','Fim do primeiro tempo',30],pre_extra:['PRORROGAÇÃO','Empate no tempo normal: 2 tempos de 15 minutos',15],extra_half:['INTERVALO DA PRORROGAÇÃO','Fim do 1º tempo da prorrogação',10],pre_shootout:['DISPUTA DE PÊNALTIS','Empate: a vaga será decidida nos pênaltis',8]};
MT.breakTick=function(dt){if(!S.breakShown){S.breakShown=true;S.breakT=0;AU.play('whistle',{final:true});AU.crowd(.2);const b=BREAK[S.m.breakKind]||BREAK.half;MT.renderBreak(b[0],b[1],S.m.breakKind!=='pre_shootout');S.breakDur=b[2];}
 S.breakT+=dt;const left=Math.max(0,Math.ceil(S.breakDur-S.breakT));const cd=$('ho-count');if(cd)cd.textContent=left;if(S.breakT>=S.breakDur)MT.resume();};
MT.resume=function(){if(!S||S.L.state!=='break')return;S.breakShown=false;$('half-overlay').hidden=true;S.L.resume();AU.play('whistle',{long:true});MT.newAmbient();MT.syncControls();
 if(S.m.phase==='shootout'){$('tvs-pens').hidden=false;App.toast('Disputa de pênaltis!');}};
MT.fulltime=function(){if(S.finished)return;S.finished=true;const m=S.m;AU.play('whistle',{final:true});AU.crowd(.6);
 const T=S.opts.tournament;let result=null;if(S.opts.onFinish){try{result=S.opts.onFinish(m);}catch(e){console.error(e);App.toast('Falha ao registrar o resultado: '+e.message);}}
 const win=E.winner(m);
 if(T&&T.final&&win&&App.isWebGL){MT.startCeremony(win);return;}
 if(m.mode.id==='germinare'){MT.germinareEnd();return;}
 MT.renderBreak('APITO FINAL',resultText(),false);MT.syncControls();MT.renderPost();};
function resultText(){const m=S.m,s=m.score;const w=E.winner(m);const p=m.pens&&m.pens.decided?` (${m.pens.home} x ${m.pens.away} nos pênaltis)`:'';
 if(!w)return'Empate!';return`${w==='home'?S.h.name:S.a.name} vence${p}!`;}
MT.clearFlash=function(){clearTimeout(S.gfT);$('idle-hud').hidden=true;$('goal-flash').hidden=true;S.goalScreen=0;$('lower-third').hidden=true;$('tv-label').hidden=true;};
MT.germinareEnd=function(){MT.clearFlash();const m=S.m;const w=E.winner(m);const el=$('champion-overlay');const club=w==='home'?S.h:w==='away'?S.a:null;
 const why=m.endReason==='goals'?`Fez ${m.mode.endGoals} gols primeiro`:m.endReason==='golden'?'Gol de ouro':m.endReason==='pens'?'Nos pênaltis':`Fim dos ${Math.round(m.mode.periodLen/60)} minutos`;
 el.innerHTML=`<div class="champ-box germ"><small>GERMINARE · FIM DE JOGO</small>${club?`<img src="${App.crest(club)}" alt=""><b>VITÓRIA DO ${esc(club.name)}</b>`:`<b>EMPATE!</b>`}<div class="champ-score">${m.score.home} – ${m.score.away}</div><span>${esc(why)}</span>
  <div class="btn-row"><button class="btn primary" id="ch-post">VER PÓS-JOGO ➜</button><button class="btn ghost" id="ch-rematch">REVANCHE ↻</button></div></div>`;el.hidden=false;
 $('ch-post').onclick=()=>{el.hidden=true;App.go('post');};$('ch-rematch').onclick=()=>{el.hidden=true;MT.rematch();};
 if(w)AU.cheer(1);MT.renderPost();MT.syncControls();};
/* ---------- cerimônia do campeão ---------- */
MT.startCeremony=function(win){MT.clearFlash();const m=S.m;const T=S.opts.tournament;const lu=MT.lineupNow();
 const tr=CI.ceremony({lineup:lu,resolve:S.res,mode:m.mode.id,names:MT.ctxNames(),winner:win,captain:MT.captain(win),seed:m.seed});
 S.cer={tr,t:0,win};S.mode='ceremony';$('cine-skip').hidden=false;$('cine-skip').textContent='PULAR CERIMÔNIA ⏭';$('idle-hud').hidden=true;$('half-overlay').hidden=true;MT.renderPost();};
MT.endCeremony=function(){if(!S||!S.cer)return;const win=S.cer.win;S.cer=null;S.mode='post';$('cine-skip').hidden=true;$('cine-overlay').hidden=true;AU.stopMusic();
 const club=win==='home'?S.h:S.a;const T=S.opts.tournament;const el=$('champion-overlay');
 el.innerHTML=`<div class="champ-box"><small>${esc(T?T.name:'MATCHDAY')}</small><div class="champ-trophy">${App.trophySVG(84)}</div><img class="champ-crest" src="${App.crest(club)}" alt=""><b>CAMPEÃO DO TORNEIO</b><div class="champ-name">${esc(club.name)}</div>
  <div class="champ-score">${S.m.score.home} – ${S.m.score.away}${S.m.pens&&S.m.pens.decided?` <small>(${S.m.pens.home} x ${S.m.pens.away} pên.)</small>`:''}</div>
  <div class="btn-row"><button class="btn primary" id="ch-copa">VOLTAR AO TORNEIO ➜</button><button class="btn ghost" id="ch-post">PÓS-JOGO</button></div></div>`;el.hidden=false;
 $('ch-copa').onclick=()=>{el.hidden=true;App.go('copa');};$('ch-post').onclick=()=>{el.hidden=true;App.go('post');};MT.syncControls();};
MT.rematch=function(){if(!S)return;const o={...S.opts};delete o.onFinish;delete o.tournament;MT.start(App.club(S.h.id)||S.h,App.club(S.a.id)||S.a,o.mode==='germinare'?{...o,cinema:false}:{...o,cinema:false});};
function goalsList(side){const m=S.m;return m.events.filter(e=>e.goal&&e.goal.side===side&&e.applied).map(e=>{const p=S.res(e.goal.scorerId);return`${esc(p?p.name.split(' ').pop():'')} ${e.minute}${/^\d+$/.test(e.minute)?"'":''}${e.goal.ownGoal?' (GC)':e.beats.some(b=>b.k==='penalty')?' (P)':''}`;}).join(', ')||'—';}
MT.renderBreak=function(title,sub,half){const m=S.m,st=shownStats(),sc=shownScore();const box=$('half-overlay');
 const line=(l,a,b)=>`<div class="stat-line"><div class="sl-top"><b>${a}</b><span>${l}</span><b>${b}</b></div><div class="sl-bar"><div><i style="width:${a+b?a/(a+b)*100:0}%"></i></div><div><i style="width:${a+b?b/(a+b)*100:0}%"></i></div></div></div>`;
 const subsUI=side=>{const t=m.teams[side];if(!half||!MD.Rules.canSubstitute(t,m.settings))return`<small class="hint">${t.subsUsed}/${m.settings.maxSubs} substituições usadas</small>`;
  return`<div class="fgrid"><label>Sai<select id="sub-out-${side}">${E.onPitch(t).map(p=>`<option value="${p.id}">${esc(p.data.name)} (${Math.round(p.energy*100)}%)</option>`).join('')}</select></label><label>Entra<select id="sub-in-${side}">${t.bench.filter(b=>!b.used).map(p=>`<option value="${p.id}">${esc(p.data.name)} · ${esc(p.pos)} ${p.data.rating}</option>`).join('')}</select></label></div><button class="btn ghost small" data-sub="${side}">SUBSTITUIR</button> <small class="hint">${t.subsUsed}/${m.settings.maxSubs}</small>`;};
 const tacUI=side=>{const t=m.teams[side].tactics;const o=(k,list)=>`<label>${k==='mentality'?'Mentalidade':k==='pressing'?'Pressão':'Estilo'}<select data-htac="${k}" data-side="${side}">${list.map(x=>`<option value="${x[0]}" ${x[0]===t[k]?'selected':''}>${x[1]}</option>`).join('')}</select></label>`;return`<div class="fgrid three">${o('mentality',App.TAC.mentality)}${o('pressing',App.TAC.pressing)}${o('style',App.TAC.style)}</div>`;};
 box.innerHTML=`<div class="ho-box"><div class="ho-title"><small>${title}</small><div class="ho-score"><img src="${App.crest(S.h)}" alt="">${sc.home} – ${sc.away}<img src="${App.crest(S.a)}" alt=""></div><div class="hint">${esc(sub)}</div>
  <div class="hint" style="margin-top:6px">${esc(S.h.short)}: ${goalsList('home')} &nbsp;·&nbsp; ${esc(S.a.short)}: ${goalsList('away')}</div></div>
  <div class="card" style="padding:12px">${line('POSSE %',st.home.possession,st.away.possession)}${line('FINALIZAÇÕES',st.home.shots,st.away.shots)}${line('NO ALVO',st.home.onTarget,st.away.onTarget)}${line('FALTAS',st.home.fouls,st.away.fouls)}${line('ESCANTEIOS',st.home.corners,st.away.corners)}${line('CARTÕES',st.home.yellow+st.home.red,st.away.yellow+st.away.red)}</div>
  ${half&&m.mode.id!=='germinare'?`<div class="ho-cols"><div class="card"><b>${esc(S.h.name)}</b>${subsUI('home')}${tacUI('home')}</div><div class="card"><b>${esc(S.a.name)}</b>${subsUI('away')}${tacUI('away')}</div></div>`:half?'':`<div class="card" style="padding:12px"><b>Jogador da partida</b><div class="hint" id="ho-motm"></div></div>`}
  <div class="ho-actions">${half?`<button class="btn primary big" id="ho-go">CONTINUAR ▶ <small id="ho-count">30</small></button>`:`<button class="btn primary big" id="ho-post">VER PÓS-JOGO ➜</button>`}</div></div>`;
 box.hidden=false;if(!half){const r=E.playerRatings(m)[0];const mm=$('ho-motm');if(mm&&r)mm.textContent=`${r.name} · nota ${r.rating.toFixed(1)}`;}
 const go=$('ho-go');if(go)go.onclick=()=>MT.resume();const post=$('ho-post');if(post)post.onclick=()=>App.go('post');
 box.querySelectorAll('[data-sub]').forEach(b=>b.onclick=()=>{const side=b.dataset.sub;const ok=E.manualSub(m,side,$('sub-out-'+side).value,$('sub-in-'+side).value);if(ok){App.toast('Substituição realizada.');E.snap(m,null);MT.renderBreak(title,sub,half);S.feedDirty=true;}else App.toast('Substituição não permitida.');});
 box.querySelectorAll('[data-htac]').forEach(s=>s.onchange=()=>{m.teams[s.dataset.side].tactics[s.dataset.htac]=s.value;E.refreshStrength(m);S.breakT=Math.min(S.breakT,S.breakDur-10);});};
/* ---------- pós-jogo ---------- */
MT.renderPost=function(){const m=S.m;const st=m.stats;const ratings=E.playerRatings(m);const motm=ratings[0];const T=S.opts.tournament;
 $('post-hero').innerHTML=`<div class="ph-team"><img src="${App.crest(S.h)}" alt=""><b>${esc(S.h.name)}</b><div class="ph-scorers">⚽ ${goalsList('home')}</div></div>
  <div class="ph-score"><small>${T?esc(T.name)+' · '+esc(T.round||''):m.mode.id==='germinare'?'GERMINARE':'RESULTADO FINAL'}</small>${m.score.home} – ${m.score.away}${m.pens&&m.pens.decided?`<em>pênaltis ${m.pens.home} x ${m.pens.away}</em>`:''}<div class="hint">${esc(resultText())} · seed ${m.seed}</div></div>
  <div class="ph-team"><img src="${App.crest(S.a)}" alt=""><b>${esc(S.a.name)}</b><div class="ph-scorers">⚽ ${goalsList('away')}</div></div>`;
 const line=(l,a,b,fmt)=>`<div class="stat-line"><div class="sl-top"><b>${fmt?fmt(a):a}</b><span>${l}</span><b>${fmt?fmt(b):b}</b></div><div class="sl-bar"><div><i style="width:${a+b?a/(a+b)*100:0}%"></i></div><div><i style="width:${a+b?b/(a+b)*100:0}%"></i></div></div></div>`;
 const eff=s=>s.shots?Math.round(s.goals/s.shots*100):0;const pr=s=>s.passes?Math.round(s.passOk/s.passes*100):0;
 $('post-stats').innerHTML=`<h3>Estatísticas</h3>${line('POSSE %',st.home.possession,st.away.possession)}${line('FINALIZAÇÕES',st.home.shots,st.away.shots)}${line('NO ALVO',st.home.onTarget,st.away.onTarget)}${line('xG',+st.home.xg.toFixed(1),+st.away.xg.toFixed(1))}${line('EFICIÊNCIA % (gols/chutes)',eff(st.home),eff(st.away))}${line('PASSES',st.home.passes,st.away.passes)}${line('PASSES CERTOS %',pr(st.home),pr(st.away))}${line('DEFESAS',st.home.saves,st.away.saves)}${line('FALTAS',st.home.fouls,st.away.fouls)}${line('AMARELOS',st.home.yellow,st.away.yellow)}${line('VERMELHOS',st.home.red,st.away.red)}${line('ESCANTEIOS',st.home.corners,st.away.corners)}${m.mode.id==='germinare'?'':line('IMPEDIMENTOS',st.home.offsides,st.away.offsides)}${line('SUBSTITUIÇÕES',st.home.subs,st.away.subs)}`;
 const mp=E.find(m,motm.id);const club=motm.side==='home'?S.h:S.a;
 $('post-motm').innerHTML=`<h3>Jogador da partida</h3><div class="motm-card2" style="--c1:${club.primary}"><div class="mc-ovr">${mp?mp.data.rating:''}<small>${esc(mp?mp.pos:'')}</small></div><div class="mc-photo">${mp?App.avatar(mp.data):''}</div><div class="mc-body"><b>${esc(motm.name)}</b><span>${esc(club.name)}</span><div class="mc-grade">NOTA ${motm.rating.toFixed(1)}</div><div class="hint">${motm.goals?motm.goals+' gol(s) · ':''}${motm.assists?motm.assists+' assistência(s) · ':''}${motm.saves?motm.saves+' defesa(s)':''}${mp&&mp.st.dribbles?' · '+mp.st.dribbles+' drible(s)':''}${mp&&mp.st.tackles?' · '+mp.st.tackles+' desarme(s)':''}</div></div></div>
  <h3 style="margin-top:16px">Notas dos jogadores</h3>${ratings.slice(1,9).map(r=>`<div class="star-row"><span>${esc(r.name)}</span><small class="hint">${esc(r.side==='home'?S.h.short:S.a.short)} · ${esc(r.pos)}</small><b>${r.rating.toFixed(1)}</b></div>`).join('')}`;
 $('post-highlights').innerHTML=`<h3>Melhores momentos</h3><div class="feed">${m.events.filter(e=>e.applied&&MT.replayable(e)).map(e=>feedItem(e)).join('')||'<div class="feed-empty">Nenhum lance em destaque.</div>'}</div>`;
 $('post-copa').hidden=!T;$('post-copa').onclick=()=>App.go('copa');$('post-rematch').hidden=!!T;$('post-rematch').onclick=()=>MT.rematch();$('post-new').onclick=()=>App.go(m.mode.id==='germinare'?'germinare':T?'copa':'select');};
/* ---------- feed, estatísticas, escalações ---------- */
MT.replayable=e=>e._shown||e.goal||['save','post','penalty_miss','disallowed','red','shootout'].includes(e.kind)||(e.xg||0)>=.15;
function feedItem(e){const side=e.attack==='away'?'side-away':'';const cur=S.ev===e&&(S.mode==='replay'||S.L.state==='present');const pending=!e.applied;
 const ico=e.kind==='card'?'yellow':e.kind==='red'?'red':e.goal?'goal':'';const team=e.attack==='home'?S.h.short:S.a.short;const min=e.minute+(/^\d+(\+\d+)?$/.test(e.minute)?"'":'');
 if(!pending&&!MT.replayable(e))return`<div class="fi ${side}"><span class="fi-min">${esc(min)}</span><span class="fi-ico ${ico}">${ICON[e.kind]||'•'}</span><span class="fi-txt"><b>${esc(team)}</b><small>${esc(e.desc)}</small></span><span></span></div>`;
 return`<button class="fi hl ${side} ${cur?'active':''} ${pending?'pending':''}" data-ev="${e.id}" ${pending?'disabled':''}><span class="fi-min">${esc(min)}</span><span class="fi-ico ${ico}">${ICON[e.kind]||'▶'}</span><span class="fi-txt"><b>${pending?'LANCE EM ANDAMENTO':esc(e.title)} · ${esc(team)}</b><small>${pending?esc(e.playLabel)+'…':esc(e.desc)}</small></span><span class="fi-play">▶</span></button>`;}
MT.pumpFeed=function(){S.feedDirty=false;MT.renderFeed();MT.renderStats();MT.renderLineups();};
MT.renderFeed=function(){if(!S)return;const m=S.m;const s=snap();const nTick=s?s.tick:0;const L=S.L;
 if(L&&L.cur&&L.state==='present'&&L.cur.ev)L.cur.ev._shown=true;
 const items=[...m.ticker.slice(0,nTick).map(t=>({k:E.pIndex(m,t.period)*1e5+t.clock,t})),...m.events.filter(e=>e.applied||(L&&L.cur&&L.cur.ev===e&&L.state==='present')).map(e=>({k:E.pIndex(m,e.period)*1e5+e.clock+.1,e}))].sort((a,b)=>b.k-a.k);
 $('feed').innerHTML=items.length?items.map(it=>{if(it.e)return feedItem(it.e);const t=it.t;const team=t.side?(t.side==='home'?S.h.short:S.a.short):'';const ico=t.type==='yellow'?'yellow':t.type==='red'?'red':'';
  return`<div class="fi ${t.side==='away'?'side-away':''}"><span class="fi-min">${esc(t.minute)}${/^\d+(\+\d+)?$/.test(t.minute)?"'":''}</span><span class="fi-ico ${ico}">${ICON[t.type]||'•'}</span><span class="fi-txt"><b>${esc(team)}</b><small>${esc(t.text)}</small></span><span></span></div>`;}).join(''):
  '<div class="feed-empty"><b>A partida vai começar!</b>Os lances aparecem aqui conforme acontecem. Nenhum lance futuro é revelado.</div>';
 const total=(E.periodEnd(m,'second')||m.periodLen*2);const marks=m.events.filter(e=>e.applied&&e._shown).map(e=>`<span class="${e.goal?'g':''}" style="left:${Math.min(100,e.clock/Math.max(1,total)*100)}%"></span>`).join('');$('seek-marks').innerHTML=marks;};
MT.renderStats=function(){if(!S)return;const st=shownStats(),sc=shownScore();const q=(l,a,b)=>`<div class="qs"><span>${l}</span><b>${a}<i>/</i>${b}</b></div>`;
 $('quick-stats').innerHTML=q('POSSE',st.home.possession+'%',st.away.possession+'%')+q('FINALIZAÇÕES',st.home.shots,st.away.shots)+q('NO ALVO',st.home.onTarget,st.away.onTarget)+q('ESCANTEIOS',st.home.corners,st.away.corners)+q('FALTAS',st.home.fouls,st.away.fouls)+q('CARTÕES',st.home.yellow+st.home.red,st.away.yellow+st.away.red);
 const line=(l,a,b)=>`<div class="stat-line"><div class="sl-top"><b>${a}</b><span>${l}</span><b>${b}</b></div><div class="sl-bar"><div><i style="width:${(+a)+(+b)?a/((+a)+(+b))*100:0}%"></i></div><div><i style="width:${(+a)+(+b)?b/((+a)+(+b))*100:0}%"></i></div></div></div>`;
 $('stats-full').innerHTML=`<div class="stat-line"><div class="sl-top"><b>${esc(S.h.short)}</b><span>PLACAR ${sc.home}–${sc.away}</span><b>${esc(S.a.short)}</b></div></div>`+line('POSSE %',st.home.possession,st.away.possession)+line('FINALIZAÇÕES',st.home.shots,st.away.shots)+line('NO ALVO',st.home.onTarget,st.away.onTarget)+line('xG',+st.home.xg.toFixed(1),+st.away.xg.toFixed(1))+line('DEFESAS',st.home.saves,st.away.saves)+line('PASSES',st.home.passes,st.away.passes)+line('ESCANTEIOS',st.home.corners,st.away.corners)+line('FALTAS',st.home.fouls,st.away.fouls)+(S.m.mode.id==='germinare'?'':line('IMPEDIMENTOS',st.home.offsides,st.away.offsides))+line('AMARELOS',st.home.yellow,st.away.yellow)+line('VERMELHOS',st.home.red,st.away.red);};
MT.renderLineups=function(){if(!S)return;const m=S.m;const s=snap();const info=new Map();if(s)for(const x of s.lines)info.set(x[0],x);const goalsOf=id=>m.events.filter(e=>e.applied&&e.goal&&e.goal.scorerId===id&&!e.goal.ownGoal).length;
 const team=side=>{const t=m.teams[side];const club=side==='home'?S.h:S.a;const all=[...t.players.filter(Boolean),...t.sentOff,...t.bench].filter((v,i,a)=>a.indexOf(v)===i);
  const rows=all.filter(p=>{const x=info.get(p.id);return x&&(x[1]||x[3]||(t.bench.includes(p)?false:true));});
  return`<div class="lu-team"><h4><img src="${App.crest(club)}" alt="">${esc(club.name)} <small class="hint">${esc(t.tactics.formation)}</small></h4>${rows.map(p=>{const x=info.get(p.id)||[p.id,1,0,0,100];return`<div class="lu-row ${x[1]?'':'off'}"><span class="pl-num">${p.data.number}</span><span class="pos-chip pos-${App.posGroup(p.pos)}">${esc(App.posLabel(p.pos))}</span><span>${esc(p.data.name)}${'⚽'.repeat(goalsOf(p.id))}${x[2]?'<i class="mini-card" style="background:#ffd21f"></i>':''}${x[3]?'<i class="mini-card" style="background:#e8202e"></i>':''}</span><span class="hint">${p.data.rating}</span><div class="energy" title="Energia"><i style="width:${x[4]}%"></i></div></div>`;}).join('')}</div>`;};
 $('lineups-live').innerHTML=team('home')+team('away');};
/* ---------- sobreposições de transmissão ---------- */
MT.updateUI=function(){const m=S.m;const L=S.L;const sc=shownScore();$('tvs-score').textContent=`${sc.home} – ${sc.away}`;$('tvs-clock').textContent=S.mode==='cinema'?'00:00':clockLabel();
 const per=E.periodOf(m);$('tvs-half').textContent=m.phase==='shootout'?'PÊN':(m.mode.id==='germinare'?(per.golden?'OURO':'/'+Math.round(m.periodLen/60)+':00'):({first:'1º T',second:'2º T',et1:'1º PR',et2:'2º PR'}[per.id]||''));
 const add=m.added[per.id];const showAdd=add>0&&L.clock>=per.start+per.len;$('tvs-added').hidden=!showAdd;if(showAdd)$('tvs-added').textContent='+'+Math.round(add/60);
 const pens=shownPens();$('tvs-pens').hidden=!pens;if(pens)$('tvs-pens').innerHTML=`PÊN <b>${pens.home}</b> – <b>${pens.away}</b>`;
 const total=E.periodEnd(m,m.periodsDef[Math.min(1,m.periodsDef.length-1)].id)||1;
 const tr=S.mode==='replay'?S.tr:(L.state==='present'||L.state==='replay')&&L.cur?L.cur.tr:null;const tt=S.mode==='replay'?S.t:L.t;
 if(tr&&S.mode!=='cinema'){$('seek-fill').style.width=(tt/tr.duration*100).toFixed(1)+'%';$('seek-label').textContent=`${tt.toFixed(0)}s / ${tr.duration.toFixed(0)}s`;MT.overlays(tr,tt);}
 else{$('seek-fill').style.width=Math.min(100,L.clock/total*100).toFixed(1)+'%';$('seek-label').textContent=S.mode==='cinema'?'APRESENTAÇÃO':clockLabel();
  const tips=m.mode.id==='germinare'?['Toque curto e movimentação','Pressão alta no portador da bola','Os alunos acompanham da arquibancada','Goleiro sai jogando']:['Troca de passes no meio-campo','Os times estudam os espaços','A torcida empurra o time','Bola girando de um lado para o outro','Marcação forte no meio'];
  $('idle-text').textContent=(S.paused?'PAUSADO · ':'')+(L.rate>3&&L.state==='idle'?'⏩ ':'')+tips[Math.floor(L.clock/(m.mode.id==='germinare'?40:240))%tips.length];}
 if(S.feedDirty&&S.mode!=='live')MT.pumpFeed();
 if(App.settings.diagnostics){const r=App.renderer.stats;$('diag').textContent=`FPS ${MD.Boot.fps.toFixed(0)}  quadro ${MD.Boot.frameMs.toFixed(1)} ms\nrender CPU ${r.ms.toFixed(2)} ms  draws ${r.draws}\ninstâncias ${r.instances}  triângulos ${(r.tris/1000).toFixed(0)}k\npixel ratio ${(App.renderer.pr||1).toFixed(2)}  qualidade ${App.settings.quality}\nrelógio x${L.rate.toFixed(1)}  estado ${L.state}\n${(r.gpu||'').slice(0,46)}`;}};
MT.overlays=function(tr,t){let lt=null,label=null;for(const o of tr.overlays){if(t<o.t0||t>o.t1)continue;if(o.kind==='label'||o.kind==='skill')label=o;else if(o.kind!=='cine')lt=o;}
 if(label!==S.shown.label){S.shown.label=label;const el=$('tv-label');if(label){el.textContent=label.text;el.className='tv-label'+(label.tone?' '+label.tone:'');el.hidden=false;}else el.hidden=true;}
 if(lt!==S.shown.lt){S.shown.lt=lt;const el=$('lower-third');if(!lt){el.hidden=true;return;}const p=S.res(lt.id);if(!p){el.hidden=true;return;}const club=p.side==='home'?S.h:S.a;const photo=App.photo(p.data);
  let sub=`${esc(App.posLabel(p.pos))} · ${esc(club.name)}`;let extra='';const ev=S.mode==='replay'?S.ev:S.L.cur&&S.L.cur.ev;
  if(lt.kind==='goal'&&ev&&ev.goal){const as=ev.goal.assistId?S.res(ev.goal.assistId):null;sub=`GOL · ${esc(ev.minute||'')} · ${esc(club.name)}${as?' · assistência: '+esc(as.name):''}`;}
  if(lt.kind==='card'){sub=`${lt.color==='red'?'CARTÃO VERMELHO':'CARTÃO AMARELO'}${lt.second?' (2º AMARELO)':''} · ${esc(lt.reason||'')}`;extra=`<i class="lt-card ${lt.color}"></i>`;}
  if(lt.sub)sub=esc(lt.sub)+' · '+sub;
  el.innerHTML=`<div class="lt-num">${p.number}</div><div class="lt-photo">${photo?`<img src="${photo}" alt="">`:esc(U.initials(p.name))}</div><div class="lt-body"><b>${esc(p.name)}</b><small>${sub}</small></div><div class="lt-ovr">${p.rating}</div>${extra}`;el.hidden=false;el.style.animation='none';void el.offsetWidth;el.style.animation='';}};
MT.syncControls=function(){if(!S)return;$('c-play').innerHTML=S.paused?'▶':'❚❚';const anyDone=S.m.events.some(e=>e.applied&&e._shown);$('c-prev').disabled=!anyDone;$('c-next').disabled=!anyDone;
 $('c-skip').disabled=!(S.mode==='replay'||S.mode==='cinema'||S.mode==='ceremony'||S.L.state==='present'||S.L.state==='replay');$('c-live').hidden=S.mode!=='replay';};
MT.setPace=function(p){if(!S)return;S.pace=p;S.L.setPace(p,S.mul);$('c-pace').textContent=PACE_LABEL[p];App.toast('Ritmo: '+PACE_LABEL[p].toLowerCase()+' (só muda a aceleração entre os lances)');};
MT.bind=function(){$('c-play').onclick=()=>{if(!S)return;if(S.mode==='post'&&S.m.events.length){const l=S.m.events.filter(e=>e.applied&&MT.replayable(e)).pop();if(l)MT.replayEvent(l);return;}MT.pause();};
 $('c-prev').onclick=()=>MT.navEvent(-1);$('c-next').onclick=()=>MT.navEvent(1);$('c-skip').onclick=()=>MT.skip();$('c-live').onclick=()=>MT.endUserReplay();$('cine-skip').onclick=()=>MT.skip();
 $('c-pace').onclick=()=>{if(!S)return;MT.setPace(PACES[(PACES.indexOf(S.pace)+1)%PACES.length]);};
 $('c-speed').onclick=()=>{if(!S)return;if(S.mode==='replay'){S.replaySpeed=S.replaySpeed===1||!S.replaySpeed?.5:S.replaySpeed===.5?.25:1;$('c-speed').textContent=S.replaySpeed===1?'1X':S.replaySpeed+'X';App.toast('Replay em '+(S.replaySpeed===1?'velocidade normal':'câmera lenta '+S.replaySpeed+'x'));return;}
  S.mul=S.mul===1?2:S.mul===2?3:1;S.L.setPace(S.pace,S.mul);$('c-speed').textContent=S.mul+'X';App.toast('Aceleração entre os lances: '+S.mul+'x (os lances continuam em velocidade natural)');};
 $('c-cam').onclick=()=>{if(!S)return;const cams=MD.Camera.USER;S.cam=cams[(cams.indexOf(S.cam)+1)%cams.length];$('c-cam').textContent=MD.Camera.LABEL[S.cam];if(App.renderer.dir)App.renderer.dir.reset();};
 $('seek-bar').onclick=e=>{if(!S)return;if(S.mode!=='replay'){App.toast('Para rever, escolha um lance que já aconteceu.');return;}const r=e.currentTarget.getBoundingClientRect();S.t=U.clamp((e.clientX-r.left)/r.width,0,1)*S.tr.duration;if(App.renderer.dir)App.renderer.dir.reset();};
 const onFeed=e=>{const b=e.target.closest('[data-ev]');if(!b||!S)return;const ev=S.m.events.find(x=>x.id===b.dataset.ev);if(ev)MT.replayEvent(ev);};$('feed').onclick=onFeed;$('post-highlights').onclick=onFeed;
 $('side-tabs').onclick=e=>{const b=e.target.closest('[data-tab]');if(!b)return;document.querySelectorAll('#side-tabs .tab').forEach(x=>x.classList.toggle('active',x===b));for(const k of ['feed','stats','lineups'])$('tab-'+k).hidden=k!==b.dataset.tab;};
 document.addEventListener('keydown',e=>{if(App.screen!=='match'||e.target.matches('input,select,textarea'))return;if(e.code==='Space'){e.preventDefault();$('c-play').click();}if(e.code==='ArrowRight')MT.navEvent(1);if(e.code==='ArrowLeft')MT.navEvent(-1);
  if(e.code==='KeyC')$('c-cam').click();if(e.code==='KeyS')MT.skip();if(e.code==='KeyP')$('c-pace').click();if((e.code==='Enter'||e.code==='NumpadEnter')&&S&&(S.mode==='cinema'||S.mode==='ceremony')){e.preventDefault();MT.skip();}});};
})(window.MD=window.MD||{});
