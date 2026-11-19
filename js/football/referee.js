/* TRS26 — MUNDO DE PARTIDA · ARBITRAGEM: árbitro e assistentes em campo, impedimento, faltas, cartões, saída de bola pelas linhas e gol.
   Métodos de MD.World.World, separados de world.js por assunto; carregar depois de world.js. */
(function(MD){
'use strict';
const W=MD.World;const {U,D,clamp,lerp,PI,hyp,DT,G,BR,PHYS,n01,angDiff,goTo,emptyCmd}=W._k;
W.extend({
 moveOfficials(){const b=this.ball,L=this.P.L,Wd=this.P.W;const r=this.ref;
  const tx=clamp(b.x-8*Math.sign(b.x||1)*.4,-L+8,L-8),tz=clamp(b.z*.5-10*Math.sign(b.z||1)*.5+ (b.z>0?-6:6),-Wd+4,Wd-4);
  goTo(r,tx,tz,this.phase==='play'?6:4);
  /* assistentes acompanham a linha de impedimento em sua metade */
  for(let i=0;i<2;i++){const a=this.ars[i];const half=i===0?-1:1;let lx=this.offsideLine(half);a.ai_tx=clamp(lx,half<0?-L:0,half<0?0:L);goTo(a,a.ai_tx,a.z,6.5);}
  for(const o of [r,...this.ars]){o.f=o.sp>.5?Math.atan2(o.vz,o.vx):Math.atan2(b.z-o.z,b.x-o.x);if(o.act&&this.time>o.act.t1)o.act=null;}},
 /* linha de impedimento do lado (half=-1 → x<0): penúltimo defensor do time que defende aquele gol */
 offsideLine(half){const ti=this.teams[0].dir===half?1:0;/* time que defende o gol em x=half*L */const xs=this.onPitch(ti).map(p=>p.x*half).sort((a,b)=>b-a);const second=xs.length>1?xs[1]:0;return half*Math.max(second,this.ball.x*half,0);},
 /* ---------------- regras ---------------- */
 snapOffside(p,exempt){if(!this.offsideOn||exempt){this.offsideSnap=null;return;}const ti=p.team,dir=this.teams[ti].dir;const b=this.ball;
  const defs=this.onPitch(this.opp(ti)).map(q=>q.x*dir).sort((a,c)=>c-a);const second=defs.length>1?defs[1]:-1e9;const line=Math.max(second,b.x*dir);
  const ids=new Set();for(const q of this.onPitch(ti)){if(q===p)continue;const xr=q.x*dir;if(xr>0&&xr>line+.15)ids.add(q.id);}
  this.offsideSnap=ids.size?{team:ti,ids,from:p,t:this.time,x:b.x}:null;},
 callOffside(p){const ti=p.team;this.offsideSnap=null;this.stats[ti].offsides++;this.event('offside',{team:ti,pid:p.id});this.fxAdd('whistle',{});
  const ar=this.ars.find(a=>Math.sign(a.x)===Math.sign(p.x))||this.ars[0];ar.act={clip:'flag_up',t0:this.time,t1:this.time+2,p:{}};
  this.stopPlay({type:'freekick',team:this.opp(ti),x:p.x,z:p.z,indirect:true,reason:'Impedimento'});},
 foul(off,vic,o){const now=this.time,ti=off.team;this.stats[ti].fouls++;off.st.fouls++;
  vic.down=now+1.1;vic.lock=now+1.1;vic.act={clip:o.kind==='slide'?'fall_slide':'fall_trip',t0:now,t1:now+1.4,p:{}};vic.emos.push({e:'pain',t0:now,t1:now+1.5,k:1});
  const x=vic.x,z=vic.z;const pen=this.inBox(-this.teams[ti].dir,x,z);
  /* cartão pela gravidade */let card=null;const r=this.rnd();const sev=o.sev||.3;
  const dogso=this.rel(vic.team,x)>this.P.L*.55&&!pen&&this.onPitch(ti).filter(q=>this.rel(vic.team,q.x)>this.rel(vic.team,x)).length<=1;
  if(sev>1.05&&r<.6||dogso&&r<.55)card='red';else if(r<clamp((sev-.4)*.85,0,.85))card='yellow';
  this.event('foul',{team:ti,pid:off.id,vid:vic.id,pen});
  /* vantagem: fora da área, se o time que sofreu a falta mantém a bola em ataque */
  const b=this.ball;const keep=b.owner&&b.owner.team===vic.team&&b.owner!==vic;if(!pen&&keep&&this.rel(vic.team,b.x)>-5&&!card){this.advantage={t:now,offTeam:ti,x,z};this.ref.act={clip:'advantage',t0:now,t1:now+1.4,p:{}};this.event('advantage',{team:vic.team});return;}
  if(card)this.pendingCards.push({p:off,card});
  this.stopPlay(pen?{type:'penalty',team:vic.team,reason:'Pênalti'}:{type:'freekick',team:vic.team,x,z,direct:true,reason:'Falta'});},
 giveCard(p,color){const now=this.time,ti=p.team;let second=false;if(color==='yellow'){p.yellow++;this.stats[ti].yellow++;if(p.yellow>=2){color='red';second=true;}}
  if(color==='red'){p.red=true;this.stats[ti].red++;}
  this.ref.act={clip:'show_card',t0:now,t1:now+1.8,p:{color}};this.fxAdd('card',{color});this.event('card',{team:ti,pid:p.id,color,second});
  if(color==='red'){p.off=true;p.human&&(()=>{const H=this.human(p.human);p.human=null;if(H){H.player=null;this.pickPlayerFor(H,true);}})();p.x=clamp(p.x,-this.P.L,this.P.L);this.teams[ti].sentOff++;if(this.ai)this.ai.reshape(ti);}},
 stopPlay(r){const now=this.time;this.fxAdd('whistle',{});this.ref.act={clip:r.type==='penalty'?'point_spot':'whistle',t0:now,t1:now+1.2,p:{}};
  this.phase='dead';this.stopT=now;this.pendingRestart=r;this.ball.owner=null;this.intended=null;this.offsideSnap=null;this.gkHolding=null;this.advantage=null;
  if(r.type==='corner')this.stats[r.team].corners++;if(r.type==='throw')this.stats[r.team].throwins++;
  if(r.reason)this.event('stop',{type:r.type,team:r.team,reason:r.reason});
  for(const c of this.pendingCards)this.giveCard(c.p,c.card);this.pendingCards=[];},
 /* bola fora / gol */
 checkBall(){const b=this.ball,P=this.P,L=P.L,Wd=P.W;
  if(this.pens&&this.pens.active){if(Math.abs(b.x)>L+BR&&Math.abs((b.cross||b).z)<P.goalHalfW&&(b.cross||b).y<P.goalH&&!this.pensGoalFlag){this.pensGoalFlag=true;b.inNet=true;this.fxAdd('goal',{side:this.teams[(this.pens.first+this.pens.next)%2].side,at:[b.x,b.y,b.z]});this.fxAdd('net',{at:[b.x,b.y,b.z]});}return;}
  if(this.advantage&&this.time-this.advantage.t>3.5)this.advantage=null;
  if(Math.abs(b.z)>Wd+BR&&Math.abs(b.x)<=L+BR){const ti=b.lastTeam<0?0:this.opp(b.lastTeam);this.stopPlay({type:'throw',team:ti,x:clamp(b.x,-L+.5,L-.5),z:Math.sign(b.z)*Wd,reason:this.kickIn?'Lateral (com os pés)':'Lateral'});return;}
  if(Math.abs(b.x)>L+BR){const end=Math.sign(b.x);const defTi=this.teams[0].dir===end?1:0;/* time que defende este gol */
   const c=b.cross||b;/* onde a bola cruzou a linha, não onde ela está agora */
   if(Math.abs(c.z)<P.goalHalfW&&c.y<P.goalH){if(!this.goalLock)this.goal(this.opp(defTi));return;}
   if(b.lastTeam===defTi){this.stopPlay({type:'corner',team:this.opp(defTi),x:end*L,z:Math.sign(b.z)*Wd,reason:'Escanteio'});}
   else this.stopPlay({type:'goalkick',team:defTi,x:end*(L-(P.sixDepth||5.5)),z:Math.sign(b.z||1)*(P.sixHalfW?P.sixHalfW*.6:5),reason:'Tiro de meta'});
   const k=b.lastKick;if(k&&k.shot&&this.time-k.t<3)this.event('miss',{team:k.team,pid:k.by});}},
 goal(ti){const b=this.ball,now=this.time;this.goalLock=1;b.inNet=true;this.score[ti]++;this.stats[ti].goals++;
  const last=b.last;const own=last&&last.team!==ti;const scorer=own?last:last;let assist=null;
  if(!own&&last&&last.lastPassFrom&&last.lastPassFrom.team===ti&&now-last.lastPassT<12)assist=last.lastPassFrom;
  if(scorer&&!own){scorer.st.goals++;scorer.st.onT++;this.stats[ti].onTarget++;}if(assist)assist.st.assists++;
  const ev=this.event('goal',{team:ti,pid:scorer?scorer.id:null,own,assist:assist?assist.id:null,score:this.score.slice()});this.lastGoal={team:ti,scorer,own,assist,t:now,ev,x:b.x};
  this.fxAdd('goal',{side:this.teams[ti].side,at:[b.x,b.y,b.z]});this.fxAdd('net',{at:[b.x,b.y,b.z]});this.fxAdd('whistle',{});
  this.phase='goal';this.stopT=now;this.ball.owner=null;this.intended=null;this.offsideSnap=null;this.advantage=null;this.pendingCards=[];
  this.highlights.push({type:'goal',t:now,ev});
  if(this.ai)this.ai.celebrate(ti,scorer&&!own?scorer:null);
  this.stoppage+=45;}
});
})(typeof window!=='undefined'?(window.MD=window.MD||{}):(globalThis.MD=globalThis.MD||{}));
