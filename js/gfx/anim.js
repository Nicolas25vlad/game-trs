/* MATCHDAY 0.5 — sistema de animação procedural reutilizável.
   Pose = vetor de ângulos articulares; locomoção (parado/caminhada/corrida/arrancada) + clipes de ação
   com fade-in/out, espelhamento para pé esquerdo e camada de expressões faciais por emoção. */
(function(MD){
'use strict';
const U=MD.U,clamp=U.clamp,lerp=U.lerp,PI=Math.PI;
const A={};
const N=27;A.N=N;
const RY=0,RP=1,RR=2,RW=3,SB=4,ST=5,SS=6,HP=7,HY=8,HR=9,LSF=10,LSA=11,LE=12,RSF=13,RSA=14,RE=15,LHF=16,LHA=17,LK=18,LA=19,RHF=20,RHA=21,RK=22,RA=23,RF=24,RS=25,MO=26;
Object.assign(A,{RY,RP,RR,RW,SB,ST,SS,HP,HY,HR,LSF,LSA,LE,RSF,RSA,RE,LHF,LHA,LK,LA,RHF,RHA,RK,RA,RF,RS,MO});
const MIRROR_PAIRS=[[LSF,RSF],[LSA,RSA],[LE,RE],[LHF,RHF],[LHA,RHA],[LK,RK],[LA,RA]];const MIRROR_NEG=[RR,RW,ST,SS,HY,HR,RS];
/* Interpolação suave por chaves [[t,v],...] */
function K(t,keys){if(t<=keys[0][0])return keys[0][1];for(let i=1;i<keys.length;i++){if(t<=keys[i][0]){const a=keys[i-1],b=keys[i];const u=(t-a[0])/((b[0]-a[0])||1);const s=u*u*(3-2*u);return a[1]+(b[1]-a[1])*s;}}return keys[keys.length-1][1];}
A.K=K;
const tmp=new Float32Array(N);
/* ---------- Locomoção ---------- */
A.locomotion=function(P,sp,dist,t,seed,turn){P.fill(0);const leg=1;
 const wWalk=clamp(sp/1.2,0,1),wRun=clamp((sp-2.3)/2.2,0,1),wSpr=clamp((sp-6)/1.6,0,1);
 const stride=sp<2.3?1.35:2.15+wSpr*.35;const ph=dist/stride*2*PI+seed;
 const s=Math.sin(ph),c=Math.cos(ph);
 const hipA=lerp(.34,.78,wRun)+wSpr*.2,kneeA=lerp(.55,1.35,wRun)+wSpr*.25,armA=lerp(.25,.75,wRun)+wSpr*.25,elb=lerp(.3,1.35,wRun);
 const w=wWalk;
 P[LHF]=s*hipA*w;P[RHF]=-s*hipA*w;
 P[LK]=(.08+kneeA*Math.pow(Math.max(0,Math.sin(ph+1.25)),1.2))*w+.06;P[RK]=(.08+kneeA*Math.pow(Math.max(0,Math.sin(ph+PI+1.25)),1.2))*w+.06;
 P[LA]=-.15*s*w;P[RA]=.15*s*w;
 P[LSF]=-s*armA*w;P[RSF]=s*armA*w;P[LE]=.25+elb*w;P[RE]=.25+elb*w;P[LSA]=.1;P[RSA]=.1;
 P[RP]=(.03+.1*wRun+.12*wSpr)*w;P[RY]=-Math.abs(c)*.05*wRun*w-.015*w;P[ST]=-s*.12*wRun;P[HP]=-.05*wRun;
 /* respiração e pequenos movimentos quando parado */
 const idle=1-w;if(idle>0){P[SB]+=Math.sin(t*1.7+seed)*.025*idle;P[LSA]+=.06*idle;P[RSA]+=.06*idle;P[HY]+=Math.sin(t*.4+seed*3)*.18*idle;P[RR]+=Math.sin(t*.6+seed)*.015*idle;P[LE]+=.12*idle;P[RE]+=.12*idle;}
 P[RR]+=clamp(turn*sp*.035,-.32,.32);return P;};
/* ---------- Clipes ---------- */
/* Cada clipe recebe (Q, u 0..1, tp segundos, dur, params, t) e escreve sobre Q (pose base já copiada). */
const kick=(power,lean,wrap)=>(Q,u,tp,d,p)=>{const T=tp;/* contato em 0.32s */
 Q[RHF]=K(T,[[0,0],[.2,-.95*power-.2],[.32,.35],[.5,.95*power+.2],[.85,.1],[1.1,0]]);Q[RK]=K(T,[[0,.2],[.2,1.5],[.32,.25],[.55,.35],[.9,.2]]);Q[RA]=K(T,[[0,0],[.3,-.5],[.6,0]]);
 Q[RHA]=K(T,[[0,0],[.25,.15],[.4,-wrap],[.8,0]]);Q[LK]=K(T,[[0,.25],[.3,.45],[.6,.25]]);Q[LHF]=K(T,[[0,.1],[.3,.25],[.7,0]]);
 Q[LSA]=K(T,[[0,.2],[.25,1.1],[.5,.9],[1,.2]]);Q[LSF]=K(T,[[0,0],[.3,.4],[.8,0]]);Q[RSA]=K(T,[[0,.2],[.3,.6],[.8,.2]]);Q[RSF]=K(T,[[0,0],[.3,-.5],[.8,0]]);
 Q[ST]=K(T,[[0,0],[.2,-.35],[.4,.3],[.8,0]]);Q[RP]=K(T,[[0,.08],[.3,-lean],[.6,-lean*.6],[1,0]]);Q[RY]=K(T,[[0,0],[.3,-.06],[.6,0]]);Q[HP]=K(T,[[0,.2],[.35,.35],[.8,0]]);Q[RR]=K(T,[[0,0],[.3,.12],[.8,0]]);};
const C={};
C.pass=kick(.45,.02,.1);C.pass_first=kick(.4,0,.12);C.pass_long=kick(.8,.18,0);C.cross=kick(.85,.15,.35);C.cross_low=kick(.6,.02,.3);C.chip=kick(.55,.3,0);
C.shot_power=kick(1.05,.22,0);C.shot_placed=kick(.75,.06,.2);C.shot_low=kick(.85,-.12,0);C.shot_first=kick(.85,.05,.1);C.freekick=kick(.85,.15,.35);C.penalty_kick=kick(.95,.12,.05);C.clear=kick(1,.3,0);
C.clear_fail=(Q,u,T)=>{Q[RHF]=K(T,[[0,0],[.3,1.1],[.7,.3]]);Q[RK]=K(T,[[0,.6],[.3,.1],[.7,.4]]);Q[RY]=K(T,[[0,0],[.3,-.25],[.8,-.1]]);Q[RP]=K(T,[[0,0],[.3,-.25]]);Q[LSA]=.9;Q[RSA]=.7;};
C.receive=(Q,u,T)=>{Q[RHF]=K(T,[[0,0],[.15,.45],[.35,.1]]);Q[RK]=K(T,[[0,.2],[.15,.5],[.4,.2]]);Q[HP]=.35;Q[RP]=.08;};
C.chest_control=(Q,u,T)=>{Q[RP]=K(T,[[0,0],[.15,-.25],[.45,0]]);Q[LSA]=.8;Q[RSA]=.8;Q[HP]=-.2;Q[RY]=K(T,[[0,0],[.2,.06],[.4,0]]);};
C.header=(Q,u,T)=>{Q[RY]=K(T,[[0,0],[.15,-.12],[.45,.35],[.8,0]]);Q[HP]=K(T,[[0,0],[.35,-.45],[.47,.5],[.7,0]]);Q[LSF]=K(T,[[0,0],[.35,.8],[.7,0]]);Q[RSF]=Q[LSF];Q[LSA]=.6;Q[RSA]=.6;Q[LK]=K(T,[[0,.2],[.15,1],[.45,.6],[.8,.2]]);Q[RK]=Q[LK];};
C.jump_header=(Q,u,T)=>{Q[RY]=K(T,[[0,0],[.12,-.15],[.45,.55],[.8,.05],[1.1,0]]);Q[HP]=K(T,[[0,0],[.35,-.5],[.47,.45],[.75,0]]);Q[LSA]=K(T,[[0,.2],[.3,1.4],[.7,.6]]);Q[RSA]=K(T,[[0,.2],[.3,1.2],[.7,.6]]);Q[LSF]=.4;Q[RSF]=.3;
 Q[LK]=K(T,[[0,.2],[.12,1.1],[.45,.9],[.8,.3]]);Q[RK]=K(T,[[0,.2],[.12,1.1],[.45,.6],[.8,.3]]);Q[LHF]=K(T,[[0,0],[.45,.5],[.8,0]]);Q[RP]=K(T,[[0,0],[.45,-.15],[.7,.1]]);};
C.bicycle=(Q,u,T)=>{Q[RY]=K(T,[[0,0],[.2,-.2],[.55,.75],[.9,-.2],[1.3,-.75],[1.6,-.75]]);Q[RP]=K(T,[[0,0],[.35,-1.4],[.6,-2.4],[.9,-2.2],[1.2,-1.6],[1.6,-1.5]]);
 Q[RHF]=K(T,[[0,0],[.4,.4],[.55,2.2],[.8,1.4],[1.2,.5]]);Q[RK]=K(T,[[0,.2],[.4,1.3],[.55,.1],[.8,.4]]);Q[LHF]=K(T,[[0,0],[.4,1.5],[.55,.4],[1,.6]]);Q[LSA]=1.5;Q[RSA]=1.5;Q[LSF]=-.5;Q[RSF]=-.5;};
C.volley=(Q,u,T)=>{Q[RR]=K(T,[[0,0],[.3,-.55],[.6,-.4],[1,0]]);Q[RHA]=K(T,[[0,0],[.22,-.9],[.32,-1.2],[.6,-.6],[1,0]]);Q[RHF]=K(T,[[0,0],[.2,-.4],[.32,.8],[.6,.5],[1,0]]);Q[RK]=K(T,[[0,.3],[.2,1.3],[.32,.2],[.7,.3]]);
 Q[LSA]=1.2;Q[RSA]=.6;Q[ST]=K(T,[[0,0],[.2,-.4],[.4,.4],[.8,0]]);Q[LK]=.35;};
C.intercept=(Q,u,T)=>{Q[RHF]=K(T,[[0,0],[.25,.9],[.6,.4],[1,0]]);Q[RHA]=K(T,[[0,0],[.25,-.6],[.7,0]]);Q[RK]=K(T,[[0,.3],[.25,.1],[.7,.3]]);Q[RY]=K(T,[[0,0],[.25,-.2],[.8,0]]);Q[LSA]=.9;Q[RSA]=.6;Q[RR]=K(T,[[0,0],[.25,-.2],[.8,0]]);};
C.block=(Q,u,T)=>{Q[RY]=K(T,[[0,0],[.2,.25],[.5,0]]);Q[LSF]=-.6;Q[RSF]=-.6;Q[LSA]=-.1;Q[RSA]=-.1;Q[LE]=.3;Q[RE]=.3;Q[RW]=K(T,[[0,0],[.25,.6],[.8,.2]]);Q[HP]=-.3;Q[RK]=.4;Q[LK]=.4;};
const slide=(Q,u,T,d)=>{const hold=Math.max(.9,d-.5);Q[RY]=K(T,[[0,0],[.25,-.45],[.4,-.7],[hold,-.7],[d,0]]);Q[RP]=K(T,[[0,0],[.3,-1.05],[hold,-1.0],[d,0]]);
 Q[RHF]=K(T,[[0,0],[.3,1.35],[hold,1.2],[d,0]]);Q[RK]=K(T,[[0,.3],[.3,.05],[hold,.2],[d,.2]]);Q[LHF]=K(T,[[0,0],[.3,.3],[hold,.4],[d,0]]);Q[LK]=K(T,[[0,.3],[.3,1.7],[hold,1.6],[d,.3]]);
 Q[LSA]=K(T,[[0,.2],[.3,1.2],[d,.2]]);Q[RSA]=K(T,[[0,.2],[.3,.9],[d,.2]]);Q[LSF]=K(T,[[0,0],[.3,-.6],[d,0]]);Q[RSF]=Q[LSF];Q[RF]=K(T,[[0,0],[.4,.8],[hold,1.2],[d,1.2]]);Q[HP]=.35;};
C.slide=slide;C.block_slide=slide;
C.tackle=(Q,u,T)=>{Q[RHF]=K(T,[[0,0],[.2,.85],[.45,.6],[.8,0]]);Q[RHA]=K(T,[[0,0],[.2,-.35],[.8,0]]);Q[RK]=K(T,[[0,.4],[.2,.15],[.6,.3]]);Q[LK]=K(T,[[0,.3],[.2,.75],[.7,.3]]);Q[RY]=K(T,[[0,0],[.2,-.2],[.7,0]]);Q[RP]=K(T,[[0,0],[.2,.25],[.7,0]]);Q[LSA]=.8;Q[RSA]=.7;};
C.tackle_trip=(Q,u,T)=>{C.tackle(Q,u,T);Q[RHA]=K(T,[[0,0],[.25,-.55],[.6,-.3],[.9,0]]);};
C.push=(Q,u,T)=>{Q[LSF]=K(T,[[0,0],[.2,1.4],[.5,1.2],[.9,0]]);Q[RSF]=Q[LSF];Q[LE]=K(T,[[0,.6],[.25,.1],[.8,.5]]);Q[RE]=Q[LE];Q[RP]=K(T,[[0,0],[.25,.25],[.8,0]]);};
C.hold_shirt=(Q,u,T)=>{Q[RSF]=K(T,[[0,0],[.2,1.5],[.8,1.3],[1,0]]);Q[RE]=.2;Q[RP]=.15;Q[ST]=-.3;};
C.shoulder=(Q,u,T)=>{Q[RR]=K(T,[[0,0],[.2,.35],[.5,.25],[.8,0]]);Q[LSA]=K(T,[[0,.1],[.2,-.1]]);Q[RSA]=.6;Q[RY]=-.08;};
C.defend_stance=(Q,u,T)=>{Q[RY]=-.14;Q[LK]=.7;Q[RK]=.7;Q[LHF]=.45;Q[RHF]=.45;Q[RP]=.22;Q[LSA]=.45;Q[RSA]=.45;Q[LE]=.8;Q[RE]=.8;Q[RW]=.35;};
C.beaten=(Q,u,T,d,p)=>{const s=p.side||1;Q[RS]=K(T,[[0,0],[.3,s*.6],[.8,s*.4]]);Q[RR]=K(T,[[0,0],[.3,s*.45],[.6,s*.2],[1,0]]);Q[RY]=K(T,[[0,0],[.3,-.25],[.8,-.05]]);Q[LSA]=K(T,[[0,.2],[.3,1.1],[1,.3]]);Q[RSA]=Q[LSA];Q[s>0?LHA:RHA]=K(T,[[0,0],[.3,.5],[.9,.1]]);Q[HY]=K(T,[[0,0],[.5,-1.2*s],[1,-.6*s]]);};
C.beaten_nutmeg=(Q,u,T)=>{Q[LHA]=K(T,[[0,0],[.2,.35],[.8,.1]]);Q[RHA]=Q[LHA];Q[RY]=-.08;Q[HP]=K(T,[[0,.2],[.3,.6],[.6,-.3]]);Q[HY]=K(T,[[0,0],[.5,0],[.8,2.4]]);Q[RW]=K(T,[[0,0],[.6,0],[1,1.2]]);};
const fall=(dirn)=>(Q,u,T,d)=>{const up=Math.max(1.1,d-.75);Q[RP]=K(T,[[0,0],[.3,.5*dirn],[.6,1.45*dirn],[up,1.45*dirn],[d,0]]);Q[RY]=K(T,[[0,0],[.35,-.3],[.6,-.82],[up,-.82],[d-.25,-.5],[d,0]]);
 Q[LSF]=K(T,[[0,0],[.4,dirn>0?1.8:-.4],[up,dirn>0?2.3:.2],[d,0]]);Q[RSF]=Q[LSF];Q[LSA]=K(T,[[0,.2],[.4,.6],[up,.4],[d,.2]]);Q[RSA]=Q[LSA];Q[LK]=K(T,[[0,.2],[.5,.4],[up,.3],[d-.25,1.2],[d,.2]]);Q[RK]=Q[LK];
 Q[HP]=K(T,[[0,0],[.6,-.5*dirn],[up,-.4*dirn],[d,0]]);Q[RR]=K(T,[[0,0],[.7,.15],[up,.25],[d,0]]);};
C.fall_trip=fall(1);C.fall_slide=fall(1);C.fall_push=fall(-1);
C.stumble=(Q,u,T)=>{Q[RP]=K(T,[[0,0],[.2,.4],[.5,.15],[.9,0]]);Q[LSA]=K(T,[[0,.2],[.2,1.3],[.8,.2]]);Q[RSA]=Q[LSA];Q[RY]=K(T,[[0,0],[.25,-.15],[.8,0]]);Q[LK]=.5;};
/* goleiro */
C.gk_ready=(Q,u,T,d,p)=>{const b=p.bounce?Math.abs(Math.sin(T*5))*.04:0;Q[RY]=-.16+b;Q[LK]=.75;Q[RK]=.75;Q[LHF]=.5;Q[RHF]=.5;Q[LHA]=.2;Q[RHA]=.2;Q[RP]=.25;Q[LSA]=.55;Q[RSA]=.55;Q[LSF]=.35;Q[RSF]=.35;Q[LE]=.9;Q[RE]=.9;Q[HP]=-.15;};
C.gk_dive=(Q,u,T,d,p)=>{const s=p.side||1,h=clamp((p.height||1)-.6,-.4,1.4);const land=.75;
 Q[RR]=K(T,[[0,0],[.15,s*.2],[.45,s*1.3],[land,s*1.45],[d-.7,s*1.45],[d,0]]);Q[RY]=K(T,[[0,-.12],[.15,-.2],[.42,-.1+h*.55],[land,-.78],[d-.7,-.78],[d,0]]);
 Q[RS]=K(T,[[0,0],[.42,s*(p.reach||.6)*.6],[d,s*(p.reach||.6)*.6]]);
 const up=2.75;if(s>0){Q[LSA]=K(T,[[0,.5],[.4,up],[d-.7,up-.2],[d,.3]]);Q[RSA]=K(T,[[0,.5],[.4,up-.5],[d-.7,up-.6],[d,.3]]);}else{Q[RSA]=K(T,[[0,.5],[.4,up],[d-.7,up-.2],[d,.3]]);Q[LSA]=K(T,[[0,.5],[.4,up-.5],[d-.7,up-.6],[d,.3]]);}
 Q[LE]=.15;Q[RE]=.15;Q[LK]=K(T,[[0,.7],[.3,.2],[land,.5]]);Q[RK]=Q[LK];Q[s>0?RHA:LHA]=K(T,[[0,0],[.3,.4],[land,.2]]);Q[HP]=-.2;Q[HR]=-s*.3;};
C.gk_low=(Q,u,T,d,p)=>{C.gk_dive(Q,u,T,d,{...p,height:.2});};
C.gk_high=(Q,u,T,d,p)=>{Q[RY]=K(T,[[0,-.1],[.15,-.2],[.45,.45],[.9,0]]);Q[RSF]=K(T,[[0,.3],[.35,2.9],[.9,1]]);Q[LSF]=K(T,[[0,.3],[.35,2.7],[.9,1]]);Q[LE]=.1;Q[RE]=.1;Q[LK]=K(T,[[0,.7],[.15,1],[.45,.3]]);Q[RK]=Q[LK];Q[RR]=(p.side||0)*.2;};
C.gk_tip=(Q,u,T,d,p)=>{const s=p.side||1;C.gk_high(Q,u,T,d,p);Q[RR]=K(T,[[0,0],[.4,s*.6],[1,s*.9],[d,0]]);Q[RY]=K(T,[[0,-.1],[.15,-.2],[.45,.55],[1,-.6],[d-.5,-.7],[d,0]]);Q[s>0?LSA:RSA]=K(T,[[0,.4],[.35,2.6],[1,2]]);};
C.gk_catch=(Q,u,T,d,p)=>{Q[RY]=K(T,[[0,-.12],[.3,-.18],[d,-.05]]);Q[LSF]=K(T,[[0,.3],[.25,1.35],[d,1.1]]);Q[RSF]=Q[LSF];Q[LE]=K(T,[[0,.6],[.3,1.5]]);Q[RE]=Q[LE];Q[LSA]=-.15;Q[RSA]=-.15;Q[RP]=K(T,[[0,.2],[.3,.4],[d,.15]]);Q[HP]=.2;Q[LK]=.6;Q[RK]=.6;};
C.gk_foot=(Q,u,T,d,p)=>{const s=p.side||1;Q[s>0?LHA:RHA]=K(T,[[0,0],[.3,1.1],[.9,.3],[d,0]]);Q[RR]=K(T,[[0,0],[.3,-s*.4],[d,0]]);Q[RY]=K(T,[[0,-.1],[.3,-.35],[d,0]]);Q[LSA]=1;Q[RSA]=1;};
C.gk_claim=(Q,u,T)=>{Q[RY]=K(T,[[0,0],[.15,-.15],[.45,.5],[.9,0]]);Q[LSF]=K(T,[[0,.2],[.35,2.7],[.6,1.4],[1,1.1]]);Q[RSF]=Q[LSF];Q[LE]=K(T,[[0,.4],[.35,.2],[.7,1.4]]);Q[RE]=Q[LE];Q[RHF]=K(T,[[0,0],[.3,1.2],[.7,.2]]);Q[RK]=K(T,[[0,.2],[.3,1.4],[.7,.3]]);};
C.gk_down=(Q,u,T,d)=>{Q[RY]=K(T,[[0,0],[.5,-.62],[d-.5,-.62],[d,0]]);Q[RP]=K(T,[[0,0],[.5,-.55],[d-.5,-.5],[d,0]]);Q[LHF]=K(T,[[0,0],[.5,1.3],[d-.5,1.2],[d,0]]);Q[RHF]=Q[LHF];Q[LK]=K(T,[[0,.2],[.5,1.2]]);Q[RK]=Q[LK];Q[LSF]=-.4;Q[RSF]=-.4;Q[LSA]=.35;Q[RSA]=.35;Q[HP]=.35;};
C.gk_slap=(Q,u,T,d)=>{C.gk_down(Q,u,T,d);Q[RSF]=1+Math.sin(T*9)*.7;Q[RE]=.3;};
/* árbitro e assistentes */
C.whistle=(Q,u,T)=>{Q[RSF]=K(T,[[0,0],[.2,2.1],[.7,2.1],[.9,0]]);Q[RSA]=-.35;Q[RE]=K(T,[[0,.3],[.2,2.3]]);Q[HP]=-.1;};
C.show_card=(Q,u,T,d)=>{Q[RSF]=K(T,[[0,0],[.3,3.05],[d-.3,3.05],[d,0]]);Q[RE]=.05;Q[RSA]=-.1;Q[HP]=-.15;Q[LSA]=.2;};
C.point_spot=(Q,u,T,d)=>{Q[RSF]=K(T,[[0,0],[.3,1.25],[d-.2,1.2],[d,0]]);Q[RE]=.05;Q[ST]=-.25;Q[HY]=-.3;};
C.advantage=(Q,u,T,d)=>{Q[LSF]=K(T,[[0,0],[.25,1.5],[d-.2,1.4],[d,0]]);Q[RSF]=Q[LSF];Q[LE]=.1;Q[RE]=.1;Q[LSA]=-.1;Q[RSA]=-.1;};
C.signal_ifk=(Q,u,T,d)=>{Q[RSF]=K(T,[[0,0],[.3,3],[d-.2,3],[d,0]]);Q[RE]=.05;};
C.flag_up=(Q,u,T,d)=>{Q[RSF]=K(T,[[0,0],[.25,3.05],[d-.3,3],[d,0]]);Q[RE]=.05;};
C.flag_corner=(Q,u,T,d)=>{Q[RSF]=K(T,[[0,0],[.3,1.2],[d,0]]);Q[RSA]=.6;Q[RE]=.05;};C.flag_point=(Q,u,T,d)=>{Q[RSF]=K(T,[[0,0],[.3,1.4],[d,0]]);Q[RE]=.05;};
/* reações e comemorações */
C.arms_up=(Q,u,T,d)=>{const w=Math.sin(T*7)*.15;Q[LSF]=K(T,[[0,0],[.25,2.9],[d-.2,2.8],[d,0]])+w;Q[RSF]=K(T,[[0,0],[.25,2.9],[d-.2,2.8],[d,0]])-w;Q[LSA]=.3;Q[RSA]=.3;Q[LE]=.2;Q[RE]=.2;Q[HP]=-.3;};
C.run_celebrate=(Q,u,T)=>{Q[LSF]=2.6+Math.sin(T*9)*.25;Q[RSF]=2.6-Math.sin(T*9)*.25;Q[LSA]=.5;Q[RSA]=.5;Q[LE]=.3;Q[RE]=.3;Q[HP]=-.25;};
C.run_airplane=(Q,u,T)=>{Q[LSA]=1.55;Q[RSA]=1.55;Q[LSF]=0;Q[RSF]=0;Q[LE]=.05;Q[RE]=.05;Q[RR]=Math.sin(T*2.2)*.35;Q[HP]=-.2;};
C.knee_slide=(Q,u,T,d)=>{Q[RY]=K(T,[[0,0],[.35,-.52],[d-.4,-.52],[d,0]]);Q[RP]=K(T,[[0,0],[.35,-.45],[d-.4,-.4],[d,0]]);Q[LK]=K(T,[[0,.3],[.35,1.75]]);Q[RK]=Q[LK];Q[LHF]=K(T,[[0,0],[.35,-.15]]);Q[RHF]=Q[LHF];
 Q[LSA]=K(T,[[0,.3],[.35,1.6],[d,1.5]]);Q[RSA]=Q[LSA];Q[LSF]=K(T,[[0,0],[.5,.6]]);Q[RSF]=Q[LSF];Q[HP]=-.5;Q[RF]=K(T,[[0,0],[.35,.5],[1,1]]);};
C.corner_pose=(Q,u,T)=>{Q[RSF]=2.9;Q[RE]=.05;Q[LSA]=.45;Q[LE]=1.7;Q[LSF]=.3;Q[HP]=-.3;Q[RY]=Math.abs(Math.sin(T*4))*.08;};
C.arms_wide=(Q,u,T)=>{Q[LSA]=1.5;Q[RSA]=1.5;Q[LSF]=.25;Q[RSF]=.25;Q[LE]=.05;Q[RE]=.05;Q[HP]=-.45;Q[RP]=-.1;};
C.punch_air=(Q,u,T)=>{Q[RSF]=2.5+Math.max(0,Math.sin(T*6))*.5;Q[RE]=.6-Math.max(0,Math.sin(T*6))*.55;Q[LSA]=.4;Q[LE]=1.4;Q[RY]=Math.max(0,Math.sin(T*6))*.12;Q[HP]=-.3;};
C.jump_joy=(Q,u,T)=>{const j=Math.max(0,Math.sin(T*6.5));Q[RY]=j*.4;Q[LK]=.3+(1-j)*.7;Q[RK]=Q[LK];Q[LSF]=2.7;Q[RSF]=2.7;Q[LSA]=.4;Q[RSA]=.4;Q[HP]=-.35;};
C.hug=(Q,u,T)=>{Q[LSF]=1.35;Q[RSF]=1.35;Q[LSA]=.5;Q[RSA]=.5;Q[LE]=1.2;Q[RE]=1.2;Q[RP]=.2;Q[RY]=Math.abs(Math.sin(T*5))*.05;Q[HY]=Math.sin(T*2)*.3;};
C.dance=(Q,u,T)=>{const s=Math.sin(T*6);Q[RR]=s*.18;Q[SS]=s*.15;Q[LSF]=1.2+s*.6;Q[RSF]=1.2-s*.6;Q[LE]=1.4;Q[RE]=1.4;Q[LK]=.4+Math.max(0,s)*.4;Q[RK]=.4+Math.max(0,-s)*.4;Q[HY]=s*.3;Q[RY]=-.05+Math.abs(s)*.05;};
C.crowd_wave=(Q,u,T)=>{Q[LSF]=2.8;Q[RSF]=2.8;Q[LSA]=.6+Math.sin(T*5)*.25;Q[RSA]=.6+Math.sin(T*5+1)*.25;Q[HP]=-.3;};
C.point_sky=(Q,u,T)=>{Q[LSF]=2.95;Q[RSF]=2.95;Q[LE]=.05;Q[RE]=.05;Q[HP]=-.6;Q[RP]=-.1;};
C.heart=(Q,u,T)=>{Q[LSF]=1.5;Q[RSF]=1.5;Q[LSA]=-.35;Q[RSA]=-.35;Q[LE]=1.9;Q[RE]=1.9;Q[HP]=.05;};
C.badge=(Q,u,T,d)=>{Q[RSF]=1.05;Q[RSA]=-.55;Q[RE]=2.2;Q[LSA]=.5;Q[LSF]=K(T,[[0,0],[.6,0],[1,1.5]]);Q[LE]=K(T,[[0,.3],[1,2.1]]);Q[HP]=K(T,[[0,-.3],[1,.35],[1.6,-.2]]);};
C.arms_crossed=(Q,u,T)=>{Q[LSF]=.95;Q[RSF]=.95;Q[LSA]=-.55;Q[RSA]=-.55;Q[LE]=2.3;Q[RE]=2.3;Q[HP]=-.15;Q[RP]=-.08;};
C.scream=(Q,u,T)=>{Q[RP]=.35;Q[SB]=.2;Q[LSF]=-.55;Q[RSF]=-.55;Q[LSA]=.55;Q[RSA]=.55;Q[LE]=1.2;Q[RE]=1.2;Q[MO]=1;Q[LK]=.5;Q[RK]=.5;Q[RY]=-.08;Q[HP]=-.2;};
C.pose=(Q,u,T)=>{Q[RSF]=2.2;Q[RSA]=-.6;Q[RE]=2.4;Q[LSA]=.5;Q[LE]=1.5;Q[LSF]=-.2;Q[HP]=-.2;Q[HY]=.3;};
C.robot=(Q,u,T)=>{const s=Math.floor(T*3)%2;Q[LSF]=s?1.6:0;Q[RSF]=s?0:1.6;Q[LE]=s?1.6:0;Q[RE]=s?0:1.6;Q[HY]=s?.5:-.5;Q[RR]=s?.08:-.08;};
C.hands_head=(Q,u,T,d)=>{Q[LSF]=K(T,[[0,0],[.3,2.45],[d-.3,2.4],[d,0]]);Q[RSF]=Q[LSF];Q[LSA]=K(T,[[0,.1],[.3,.95],[d,.1]]);Q[RSA]=Q[LSA];Q[LE]=K(T,[[0,.2],[.3,2.25],[d,.2]]);Q[RE]=Q[LE];Q[HP]=K(T,[[0,0],[.4,-.3],[d,0]]);};
C.hands_hips=(Q,u,T)=>{Q[LSF]=.15;Q[RSF]=.15;Q[LSA]=.55;Q[RSA]=.55;Q[LE]=1.65;Q[RE]=1.65;Q[HP]=.35;Q[SB]=.08;};
C.kneel=(Q,u,T,d)=>{Q[RY]=K(T,[[0,0],[.4,-.45],[d-.4,-.45],[d,0]]);Q[LK]=K(T,[[0,.2],[.4,1.65]]);Q[LHF]=K(T,[[0,0],[.4,-.15]]);Q[RHF]=K(T,[[0,0],[.4,1.3]]);Q[RK]=K(T,[[0,.2],[.4,1.6]]);Q[HP]=.55;Q[SB]=.2;Q[LSF]=.3;Q[RSF]=.6;Q[RE]=1.5;};
C.protest=(Q,u,T,d)=>{const s=Math.sin(T*4);Q[LSF]=.75+s*.15;Q[RSF]=.75-s*.15;Q[LSA]=.75;Q[RSA]=.75;Q[LE]=.55;Q[RE]=.55;Q[HY]=s*.25;Q[HP]=-.1;};
C.point=(Q,u,T,d)=>{Q[RSF]=K(T,[[0,0],[.25,1.55],[d-.2,1.5],[d,0]]);Q[RE]=.05;Q[RSA]=.1;};
C.frustration=(Q,u,T)=>{Q[LSF]=K(T,[[0,0],[.2,-.3],[.5,.2]]);Q[RSF]=Q[LSF];Q[LSA]=.4;Q[RSA]=.4;Q[RP]=.25;Q[HP]=.5;Q[RHF]=K(T,[[0,0],[.25,.6],[.5,0]]);};
C.wall=(Q,u,T)=>{Q[LSF]=.35;Q[RSF]=.35;Q[LSA]=-.25;Q[RSA]=-.25;Q[LE]=1.7;Q[RE]=1.7;Q[RY]=Math.max(0,Math.sin((T-2.4)*4))*.35*(T>2.4&&T<3.2?1:0);};
C.jostle=(Q,u,T)=>{Q[LSF]=.6+Math.sin(T*5)*.3;Q[RSF]=.6-Math.sin(T*5)*.3;Q[LE]=.9;Q[RE]=.9;Q[RR]=Math.sin(T*3)*.08;};
C.throw_in=(Q,u,T,d)=>{Q[LSF]=K(T,[[0,0],[.3,2.9],[.7,3.1],[.85,2.2],[d,.2]]);Q[RSF]=Q[LSF];Q[LE]=K(T,[[0,.3],[.3,1.9],[.75,1.9],[.9,.3]]);Q[RE]=Q[LE];Q[RP]=K(T,[[0,0],[.6,-.3],[.85,.25],[d,0]]);Q[HP]=K(T,[[0,0],[.6,-.25],[.9,.1]]);Q[LHF]=.25;Q[RHF]=-.2;};
C.call=(Q,u,T,d)=>{Q[RSF]=K(T,[[0,0],[.2,2.6],[d-.15,2.6],[d,0]])+Math.sin(T*9)*.12;Q[RE]=.25;Q[HY]=.2;};
C.gk_throw=(Q,u,T,d)=>{Q[RSF]=K(T,[[0,.8],[.25,-.8],[.42,2.2],[.7,1.4],[d,.3]]);Q[RE]=.15;Q[LSF]=.6;Q[LSA]=.5;Q[RP]=K(T,[[0,0],[.3,-.15],[.5,.3],[d,0]]);Q[LHF]=K(T,[[0,0],[.35,.5],[d,0]]);Q[ST]=K(T,[[0,0],[.3,.5],[.55,-.4],[d,0]]);};
C.gk_rush=(Q,u,T,d)=>{Q[RP]=.35;Q[RY]=-.12;Q[LSA]=.7;Q[RSA]=.7;Q[LE]=.7;Q[RE]=.7;Q[LK]=.6;Q[RK]=.6;};
C.arm_signal=(Q,u,T,d)=>{Q[LSF]=K(T,[[0,0],[.25,2.9],[d-.2,2.9],[d,0]]);Q[LE]=.1;};
/* dribles (pé direito; espelhados para canhotos) */
C.skill_short=(Q,u,T)=>{Q[RHA]=K(T,[[0,0],[.2,-.3],[.4,0]]);Q[RR]=K(T,[[0,0],[.25,.15],[.6,0]]);};
C.skill_direction=(Q,u,T)=>{Q[RR]=K(T,[[0,0],[.3,.35],[.7,0]]);Q[SS]=K(T,[[0,0],[.3,.2],[.7,0]]);Q[RY]=-.06;};
C.skill_speed=(Q,u,T)=>{Q[RP]=.3;Q[RHF]=K(T,[[0,0],[.15,.6],[.35,0]]);};
C.skill_cutIn=(Q,u,T)=>{Q[RR]=K(T,[[0,0],[.3,-.3],[.7,0]]);Q[RHA]=K(T,[[0,0],[.25,-.5],[.6,0]]);Q[RW]=K(T,[[0,0],[.4,-.5],[.8,-.2]]);};
C.skill_bodyFeint=(Q,u,T)=>{Q[RR]=K(T,[[0,0],[.3,.42],[.6,-.4],[.9,0]]);Q[SS]=K(T,[[0,0],[.3,.3],[.6,-.3],[.9,0]]);Q[LSA]=.7;Q[RSA]=.7;Q[RY]=-.08;};
C.skill_drag=(Q,u,T)=>{Q[RHF]=K(T,[[0,0],[.25,.45],[.55,-.25],[.9,0]]);Q[RK]=K(T,[[0,.2],[.3,.8],[.7,.3]]);Q[RP]=-.12;Q[RW]=K(T,[[0,0],[.6,.6],[1,.3]]);};
C.skill_sharpCut=(Q,u,T)=>{Q[RR]=K(T,[[0,0],[.25,.45],[.6,0]]);Q[RY]=K(T,[[0,0],[.25,-.15],[.6,0]]);Q[RHA]=K(T,[[0,0],[.25,-.55],[.5,0]]);};
C.skill_turn=(Q,u,T,d)=>{Q[RW]=K(T,[[0,0],[d*.8,PI*2],[d,PI*2]])%(PI*2);Q[RY]=-.08;Q[LSA]=.6;Q[RSA]=.6;Q[RHF]=K(T,[[0,0],[.2,.3],[.5,-.2],[.8,0]]);};
C.skill_shotFeint=(Q,u,T)=>{Q[RHF]=K(T,[[0,0],[.25,-.85],[.42,.15],[.6,-.1],[.9,0]]);Q[RK]=K(T,[[0,.2],[.25,1.3],[.45,.4]]);Q[LSA]=K(T,[[0,.2],[.25,1],[.7,.3]]);Q[ST]=K(T,[[0,0],[.25,-.3],[.5,.1],[.8,0]]);};
C.skill_stepover=(Q,u,T)=>{const c=T*2*PI/.6;Q[RHA]=Math.sin(c)*.45*(T<.6?1:0);Q[LHA]=-Math.sin(c+PI)*.45*(T>=.6&&T<1.15?1:0);Q[RK]=.5;Q[LK]=.5;Q[RR]=Math.sin(c)*.22;Q[RY]=-.1;};
C.skill_flick=(Q,u,T)=>{Q[RHF]=K(T,[[0,0],[.2,.2],[.32,1],[.6,.2]]);Q[RA]=K(T,[[0,0],[.3,-.6],[.6,0]]);Q[RY]=K(T,[[0,0],[.35,.1],[.6,0]]);};
C.skill_rainbow=(Q,u,T)=>{Q[RK]=K(T,[[0,.2],[.25,1.6],[.38,2.1],[.6,.6]]);Q[RHF]=K(T,[[0,0],[.3,-.5],[.5,.2],[.8,0]]);Q[LHF]=K(T,[[0,0],[.3,.4],[.6,0]]);Q[RY]=K(T,[[0,0],[.35,.25],[.7,0]]);Q[LSA]=.9;Q[RSA]=.9;};
C.skill_nutmeg=(Q,u,T)=>{Q[RHF]=K(T,[[0,0],[.15,-.35],[.28,.45],[.55,0]]);Q[RP]=.2;Q[HP]=.3;};
C.skill_sombrero=(Q,u,T)=>{Q[RHF]=K(T,[[0,0],[.2,.25],[.32,1.05],[.6,.2]]);Q[RA]=K(T,[[0,0],[.28,.7],[.5,0]]);Q[RY]=K(T,[[0,0],[.4,.25],[.8,0]]);Q[HP]=-.3;};
C.skill_elastico=(Q,u,T)=>{Q[RHA]=K(T,[[0,0],[.22,.55],[.38,-.5],[.7,0]]);Q[RK]=.45;Q[RR]=K(T,[[0,0],[.22,.3],[.4,-.35],[.8,0]]);Q[LSA]=.8;Q[RSA]=.6;};
A.CLIPS=C;
/* clipes que mantêm o personagem baixo/deitado e não devem "piscar" ao terminar */
/* 0.5 — cerimônias, entrada em campo, hino, cumprimentos e premiação */
C.idle_bounce=(Q,u,T)=>{const b=Math.abs(Math.sin(T*4.6));Q[LK]=.12+b*.2;Q[RK]=.12+b*.2;Q[LHF]=b*.08;Q[RHF]=b*.08;Q[RY]=-b*.035;Q[LSF]=Math.sin(T*4.6)*.25;Q[RSF]=-Math.sin(T*4.6)*.25;Q[LE]=.5;Q[RE]=.5;};
C.anthem=(Q,u,T)=>{Q[LSF]=-.28;Q[RSF]=-.28;Q[LSA]=.18;Q[RSA]=.18;Q[LE]=.95;Q[RE]=.95;Q[HP]=-.06+Math.sin(T*.9)*.02;Q[SB]=Math.sin(T*1.5)*.03;};
C.arm_over=(Q,u,T)=>{Q[LSA]=1.25;Q[RSA]=1.25;Q[LSF]=.35;Q[RSF]=.35;Q[LE]=1.25;Q[RE]=1.25;Q[HP]=-.05;Q[SB]=Math.sin(T*1.4)*.025;Q[RR]=Math.sin(T*.7)*.03;};
C.hand_chest=(Q,u,T)=>{Q[RSF]=1.05;Q[RSA]=-.35;Q[RE]=2.15;Q[LSF]=-.2;Q[LSA]=.15;Q[LE]=.5;Q[HP]=-.08;};
C.handshake=(Q,u,T,d)=>{Q[RSF]=K(T,[[0,0],[.28,.95],[d-.22,.95],[d,0]])+(T>.3&&T<d-.25?Math.sin(T*15)*.07:0);Q[RE]=.4;Q[RSA]=.05;Q[HP]=.12;Q[HY]=.15;Q[RP]=.06;};
C.applaud=(Q,u,T)=>{const c=Math.abs(Math.sin(T*11));Q[LSF]=.95;Q[RSF]=.95;Q[LE]=1.25;Q[RE]=1.25;Q[LSA]=-.32+c*.3;Q[RSA]=-.32+c*.3;Q[HP]=-.1;};
C.wave=(Q,u,T)=>{Q[RSF]=2.55;Q[RSA]=.45+Math.sin(T*8)*.35;Q[RE]=.35;Q[HY]=.2;Q[HP]=-.25;};
C.look_around=(Q,u,T)=>{Q[HY]=Math.sin(T*.75)*.75;Q[HP]=-.28+Math.sin(T*.5)*.08;};
C.coin_toss=(Q,u,T,d)=>{Q[RSF]=K(T,[[0,.5],[.25,1.1],[.45,2.4],[.9,1.5],[d,.4]]);Q[RE]=K(T,[[0,1.5],[.4,.25],[d,1.1]]);Q[HP]=K(T,[[0,0],[.5,-.6],[1.1,-.3],[d,0]]);};
C.trophy_hold=(Q,u,T)=>{Q[LSF]=1.15;Q[RSF]=1.15;Q[LE]=1.05;Q[RE]=1.05;Q[LSA]=-.12;Q[RSA]=-.12;Q[HP]=.05;};
C.trophy_lift=(Q,u,T,d)=>{const up=K(T,[[0,1.1],[.7,2.95],[d-.3,2.95],[d,1.1]]),b=Math.sin(T*5)*.05;Q[LSF]=up+b;Q[RSF]=up+b;Q[LSA]=.22;Q[RSA]=.22;Q[LE]=K(T,[[0,1.05],[.7,.3]]);Q[RE]=Q[LE];Q[HP]=-.45;Q[RY]=Math.max(0,Math.sin(T*5.5))*.12*clamp((T-.8)/.3,0,1);};
C.stretch=(Q,u,T)=>{const s=Math.sin(T*2.2);Q[RHF]=.6+s*.5;Q[RK]=.2;Q[LSA]=1.2;Q[RSA]=1.2;Q[LE]=.1;Q[RE]=.1;};
C.sad_stand=(Q,u,T)=>{Q[HP]=.5;Q[SB]=.15;Q[LSF]=.05;Q[RSF]=.05;Q[LE]=.2;Q[RE]=.2;Q[LSA]=.05;Q[RSA]=.05;};
C.sit_grass=(Q,u,T,d)=>{Q[RY]=K(T,[[0,0],[.6,-.62],[d-.5,-.62],[d,0]]);Q[LHF]=K(T,[[0,0],[.6,1.5]]);Q[RHF]=Q[LHF];Q[LK]=K(T,[[0,.2],[.6,1.2]]);Q[RK]=Q[LK];Q[SB]=.25;Q[HP]=.35;Q[LSF]=-.5;Q[RSF]=-.5;Q[LE]=.2;Q[RE]=.2;};
const FADE={sit_grass:[.3,.4],trophy_lift:[.2,.3],handshake:[.15,.15],fall_trip:[.1,.3],fall_push:[.1,.3],fall_slide:[.1,.3],gk_dive:[.06,.35],gk_low:[.06,.35],slide:[.08,.3],block_slide:[.08,.3],knee_slide:[.12,.35],bicycle:[.08,.3],gk_down:[.2,.4]};
const KICKS=new Set(['pass','pass_first','pass_long','cross','cross_low','chip','shot_power','shot_placed','shot_low','shot_first','freekick','penalty_kick','clear','volley','receive','intercept','tackle','tackle_trip','bicycle','clear_fail']);
A.applyAction=function(P,act,t){const fn=C[act.clip];if(!fn)return;const d=act.t1-act.t0,tp=t-act.t0;if(tp<0||tp>d)return;const fd=FADE[act.clip]||[.12,.16];
 const w=Math.min(1,tp/fd[0],(d-tp)/fd[1]);if(w<=0)return;tmp.set(P);fn(tmp,tp/d,tp,d,act.p||{},t);
 const left=act.p&&act.p.foot==='L'&&(KICKS.has(act.clip)||act.clip.startsWith('skill_'));
 if(left){for(const [a,b] of MIRROR_PAIRS){const x=tmp[a];tmp[a]=tmp[b];tmp[b]=x;}for(const k of MIRROR_NEG)tmp[k]=-tmp[k];}
 for(let i=0;i<N;i++)P[i]=lerp(P[i],tmp[i],w);};
/* ---------- Expressões ---------- */
/* [altura sobrancelha, ângulo (+ triste/- bravo), abertura dos olhos, boca aberta, sorriso(-1..1), largura boca, cabeça baixa, ombros caídos] */
A.EMO={neutral:[0,0,1,.04,.12,1,0,0],concentrated:[-.18,-.35,.86,0,-.05,.95,.04,0],happy:[.22,.15,.88,.25,.75,1.08,-.05,0],veryhappy:[.4,.2,.78,.55,1,1.12,-.1,0],euphoric:[.62,.1,1.15,1,.75,1.05,-.2,0],
 sad:[.08,.85,.7,.05,-.75,.92,.3,.18],frustrated:[-.22,-.6,.8,.32,-.6,1.05,.2,.1],angry:[-.38,-1,1.05,.55,-.5,1.12,0,0],surprised:[.85,.25,1.32,.75,0,.72,-.05,0],
 worried:[.3,.75,1.05,.15,-.32,.94,.08,.05],tired:[-.1,.2,.55,.48,-.12,1,.15,.12],pain:[-.08,.65,.32,.62,-.65,1.15,.12,.05],shame:[.1,.6,.6,.05,-.45,.9,.4,.2]};
A.EMO_LABEL={neutral:'Neutro',concentrated:'Concentrado',happy:'Feliz',veryhappy:'Muito feliz',euphoric:'Eufórico',sad:'Triste',frustrated:'Frustrado',angry:'Raivoso',surprised:'Surpreso',worried:'Preocupado',tired:'Cansado',pain:'Dor',shame:'Vergonha'};
/* Mistura as emoções ativas no instante t, com transições suaves (0.35 s). */
A.face=function(out,emos,t,base){const b=A.EMO[base]||A.EMO.neutral;for(let i=0;i<8;i++)out[i]=b[i];
 if(emos)for(const e of emos){if(t<e.t0-.01||t>e.t1+.5)continue;const w=Math.min(1,(t-e.t0)/.35,(e.t1+.5-t)/.5)*(e.k??1);if(w<=0)continue;const v=A.EMO[e.e];if(!v)continue;for(let i=0;i<8;i++)out[i]=lerp(out[i],v[i],clamp(w,0,1));}
 return out;};
MD.Anim=A;
})(window.MD=window.MD||{});
