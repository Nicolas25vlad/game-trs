/* MATCHDAY 0.5 — Modo GERMINARE (futebol da escola, 5 x 5: 1 goleiro + 4 de linha).
   Reaproveita o motor (classe Play: passe, drible, falta, finalização, regras) com uma IA própria do campo reduzido:
   passes curtos, pressão individual, recuperação rápida, mais finalizações, goleiro participando da saída de bola,
   tabelas e dribles curtos. Também guarda as "seleções personalizadas" (times mistos de 5 jogadores). */
(function(MD){
'use strict';
const U=MD.U,clamp=U.clamp,lg=U.logistic,R=MD.Rules,D=MD.Data;
const GM={XG:1.32};
const OTHER={home:'away',away:'home'};
const E=()=>MD.Engine;
const onp=t=>E().onPitch(t),outf=t=>onp(t).filter(p=>p.group!=='GK'),keeper=t=>onp(t).find(p=>p.group==='GK')||null;
function pick(list,score,rng,temp=7){if(!list.length)return null;return rng.weighted(list.map(p=>[p,Math.exp(score(p)/temp)]));}
function nearDef(t,x,z,ex){let best=null,bd=1e9;for(const p of outf(t)){if(ex&&ex.includes(p))continue;const b=E().basePos(p,false,3);const d=Math.hypot(b[0]-x,b[1]-z);if(d<bd){bd=d;best=p;}}return best;}
const S=(rng,a,b,zr,zc)=>E().spot(rng,a,b,zr,zc);
/* Posse de bola no futebol reduzido */
GM.possession=function(m){const Eg=E(),H=m.teams.home,A=m.teams.away,rng=m.rng;
 const pHome=clamp(lg((H.str.mid-A.str.mid)/36+.08+m.momentum*.25),.38,.62);
 const side=rng()<pHome?'home':'away',att=m.teams[side],def=m.teams[OTHER[side]];
 const dur=(5+rng()*8)/m.tempo;m.possTime[side]+=dur;const tot=m.possTime.home+m.possTime.away;m.stats.home.possession=Math.round(m.possTime.home/tot*100);m.stats.away.possession=100-m.stats.home.possession;
 m.momentum*=.9;const ma=Eg.mentality(m,att),md=Eg.mentality(m,def);
 const st=m.stats[side];st.passes+=2+Math.floor(rng()*4);st.passOk+=2+Math.floor(rng()*3);
 /* pressão individual alta: saída de bola */
 const s1=clamp(.7+(att.str.mid-def.str.mid)/300-(md>0?.03:0),.55,.86);
 if(rng()>s1){const r=rng();if(r<.28)return GM.chance(m,def,att,'g_counter');if(r<.4)return Eg.minorFoul(m,def,att,-6+rng()*12);
  if(r<.6){m.stats[side].throwIns++;if(rng()<.25)Eg.tick(m,'throw',side,(R.PROFILE.restart==='kick'?'Tiro lateral':'Lateral')+' para o '+att.club.name);}return null;}
 const s2=clamp(.52+(att.str.att*.6+att.str.mid*.4-def.str.def)/260+ma*.04-md*.03,.36,.68);
 if(rng()>s2){const r=rng();if(r<.3)return GM.chance(m,att,def,'g_longshot');if(r<.4)return Eg.minorFoul(m,def,att,4+rng()*8);if(r<.48)return GM.corner(m,att,def);return null;}
 return GM.chance(m,att,def,null);};
GM.TYPES={g_onetwo:'TABELINHA',g_dribble:'DRIBLE NO MANO A MANO',g_pivot:'JOGADA DE PIVÔ',g_wing:'JOGADA PELA ALA',g_counter:'CONTRA-ATAQUE',g_longshot:'CHUTE DE FORA',g_corner:'ESCANTEIO',g_gk:'SAÍDA DO GOLEIRO'};
GM.choose=function(m,A){const on=outf(A),rng=m.rng;const best=(k)=>Math.max(...on.map(p=>p.attrs[k]),40);
 return rng.weighted([['g_onetwo',9+(best('passing')-70)/5],['g_dribble',6+(best('dribbling')-70)/4],['g_pivot',6+(best('strength')-70)/6],['g_wing',8+(best('pace')-70)/6],['g_gk',3+(keeper(A)?(keeper(A).attrs.gkKicking-60)/10:0)],['g_longshot',4+(best('finishing')-70)/8]]);};
GM.chance=function(m,A,Dt,forced){const Eg=E();const type=forced||GM.choose(m,A);const P=new Eg.Play(m,A,Dt,type);GM.BUILD[type](P,m,A,Dt);return Eg.finish(m,P);};
GM.corner=function(m,A,Dt){const Eg=E();m.stats[A.side].corners++;const P=new Eg.Play(m,A,Dt,'g_corner');GM.BUILD.g_corner(P,m,A,Dt);return Eg.finish(m,P,true);};
GM.BUILD={
 g_onetwo(P,m,A,D){const rng=P.rng,on=outf(A);const a=pick(on,p=>p.attrs.passing+p.attrs.dribbling*.5,rng),b=pick(on.filter(p=>p!==a),p=>p.attrs.passing+(p.group==='ST'?12:0),rng);if(!a||!b)return P.end('none');
  const z=(rng()-.5)*8;P.start(a,[-3+rng()*4,z]);if(!P.pass(a,b,'ground',[8+rng()*2.5,z*.4+(rng()-.5)*3]))return;
  const s=S(rng,4.5,8.5,4,z*.3);if(!P.pass(b,a,'oneTwo',s))return;P.assist=b;P.shoot(a,s,rng()<.6?'firstTime':'placed',{pressure:.45});},
 g_dribble(P,m,A,D){const rng=P.rng,on=outf(A);const p=pick(on,x=>x.attrs.dribbling*1.4+x.attrs.agility*.4,rng,5);if(!p)return P.end('none');const z=(rng()-.5)*9;
  P.start(p,[1+rng()*3,z]);P.carry(p,[6,z*.8]);const d1=nearDef(D,9,z*.7);const r=P.duel(p,d1,[8.5,z*.7],{bonus:.15});if(r==='lost'||r==='foul'||P.ended)return;
  if(rng()<.3){const d2=nearDef(D,12,z*.5,[d1]);const r2=P.duel(p,d2,[P.ball[0]+1.5,P.ball[1]*.8]);if(r2==='lost'||r2==='foul'||P.ended)return;}
  const s=S(rng,4,8,3.5,P.ball[1]*.4);P.carry(p,s);MD.Engine.decideShot(P,p,s,rng()<.5?'placed':'low',{pressure:.4});},
 g_pivot(P,m,A,D){const rng=P.rng,on=outf(A);const piv=on.find(p=>p.pos==='PIV')||pick(on,p=>p.attrs.strength+p.attrs.ballControl,rng);const f=pick(on.filter(p=>p!==piv),p=>p.attrs.passing,rng);if(!piv||!f)return P.end('none');
  P.start(f,[-6+rng()*3,(rng()-.5)*6]);if(!P.pass(f,piv,'ground',[11.5+rng()*2,(rng()-.5)*3]))return;
  if(rng()<.5){const d=nearDef(D,13,0);const r=P.duel(piv,d,[13,P.ball[1]],{bonus:.05});if(r==='lost'||r==='foul'||P.ended)return;const s=S(rng,4.5,7.5,3,P.ball[1]);P.carry(piv,s);P.shoot(piv,s,'low',{pressure:.5});return;}
  const s=S(rng,6,9,4,(rng()-.5)*4);if(!P.pass(piv,f,'ground',s))return;P.assist=piv;P.shoot(f,s,'firstTime',{pressure:.4});},
 g_wing(P,m,A,D){const rng=P.rng,on=outf(A);const sd=rng()<.5?1:-1;const w=on.find(p=>p.pos===(sd>0?'ALD':'ALE'))||pick(on,p=>p.attrs.pace,rng);if(!w)return P.end('none');
  P.start(w,[1+rng()*3,sd*(7+rng()*2)]);P.carry(w,[8+rng()*2,sd*(8.5+rng())]);
  if(rng()<.4){const fb=nearDef(D,10,sd*8);const r=P.duel(w,fb,[10,sd*8],{bonus:.1});if(r==='lost'||r==='foul'||P.ended)return;}
  if(rng()<.5){const s=[R.PITCH.L-5-rng()*3,sd*(4+rng()*2.5)];P.carry(w,s);P.shoot(w,s,'placed',{pressure:.45});return;}
  const t=pick(on.filter(p=>p!==w),p=>p.attrs.positioning+p.attrs.finishing,rng);if(!t)return P.end('none');const s=[R.PITCH.L-3.5-rng()*2,-sd*(.5+rng()*2)];
  if(!P.pass(w,t,'lowcross',s))return;P.assist=w;P.shoot(t,s,'firstTime',{pressure:.55});},
 g_counter(P,m,A,D){const rng=P.rng,on=outf(A);const gk=keeper(A);const run=pick(on,p=>p.attrs.pace*1.3,rng);if(!run)return P.end('none');P.flags.counter=true;
  const from=gk&&rng()<.55?gk:pick(on.filter(p=>p!==run),p=>p.attrs.tackling,rng)||run;const st=from===gk?[-R.PITCH.L+2,0]:[-6+rng()*5,(rng()-.5)*6];P.start(from,st,'counter');
  if(from!==run){if(!P.pass(from,run,from===gk?'lofted':'through',[2+rng()*3,(rng()-.5)*8]))return;}
  P.carry(run,[9+rng()*2,P.ball[1]*.6]);const s=S(rng,4.5,8,3.5,P.ball[1]*.5);P.carry(run,s);MD.Engine.decideShot(P,run,s,rng()<.5?'low':'placed',{pressure:.25});},
 g_gk(P,m,A,D){/* goleiro inicia a jogada com as mãos/pés e vira o "quinto jogador de linha" */const rng=P.rng,on=outf(A);const gk=keeper(A);if(!gk)return GM.BUILD.g_onetwo(P,m,A,D);
  const a=pick(on,p=>p.attrs.ballControl,rng),b=pick(on.filter(p=>p!==a),p=>p.attrs.finishing+p.attrs.positioning,rng);if(!a||!b)return P.end('none');
  P.start(gk,[-R.PITCH.L+3,(rng()-.5)*3]);if(!P.pass(gk,a,rng()<.5?'ground':'lofted',[-4+rng()*4,(rng()<.5?-1:1)*(4+rng()*3)]))return;P.carry(a,[4+rng()*2,P.ball[1]*.7]);
  const s=S(rng,5,8.5,4,-P.ball[1]*.3);if(!P.pass(a,b,'through',s))return;P.assist=a;P.shoot(b,s,rng()<.5?'firstTime':'placed',{pressure:.45});},
 g_longshot(P,m,A,D){const rng=P.rng,on=outf(A);const p=pick(on,x=>x.attrs.finishing*.6+x.attrs.composure*.4+(x.group==='CB'?6:0),rng);if(!p)return P.end('none');const f=pick(on.filter(x=>x!==p),x=>x.attrs.passing,rng);
  const s=S(rng,10,14,5);if(f){P.start(f,[s[0]-6,s[1]+(rng()-.5)*5]);if(!P.pass(f,p,'ground',[s[0]-1.2,s[1]]))return;P.assist=f;}else P.start(p,[s[0]-2,s[1]]);P.carry(p,s);P.shoot(p,s,'longshot',{pressure:.35});},
 g_corner(P,m,A,D){const rng=P.rng,on=outf(A);const sd=rng()<.5?1:-1;const tk=pick(on,x=>x.attrs.passing,rng,5);if(!tk)return P.end('none');const L=R.PITCH.L,W=R.PITCH.W;
  P.start(tk,[L,sd*W],'corner');P.add({k:'setpiece',type:'corner',by:P.ref(tk),at:[L,sd*W]});
  const t=pick(on.filter(x=>x!==tk),x=>x.attrs.finishing+x.attrs.positioning,rng);if(!t)return P.end('none');
  if(rng()<.55){const s=[L-6-rng()*2,sd*(1+rng()*2)];if(!P.pass(tk,t,'ground',s))return;P.assist=tk;P.shoot(t,s,rng()<.5?'firstTime':'volley',{pressure:.5});}
  else{const s=[L-2.6-rng()*1.5,-sd*(rng()*1.5)];if(!P.pass(tk,t,'cross',s))return;P.assist=tk;P.shoot(t,s,rng()<.6?'header':'volley',{pressure:.6,noBlock:true});}}};
/* ---------- Kits escolares ---------- */
GM.KITS=[['school','Camiseta Germinare (branca)','#f4f5f2','#1f2b45','#2b5bb5'],['bib_orange','Colete laranja','#ff7a1a','#ffffff','#1d1d1d'],['bib_green','Colete verde','#3fc35a','#ffffff','#1d1d1d'],
 ['bib_blue','Colete azul','#2c6ee8','#ffffff','#1d1d1d'],['bib_yellow','Colete amarelo','#ffd21f','#1d1d1d','#1d1d1d'],['dark','Moletom escuro','#23272e','#f2f2f2','#c9ff52']];
GM.kit=function(id){const k=GM.KITS.find(x=>x[0]===id)||GM.KITS[0];const kit=D.defaultKit(k[2],k[3],k[4]);kit.pattern='plain';kit.collar=id==='school'?'polo':'v';kit.shortsColor=id==='school'?'#1f2b45':'#1d1d1d';kit.socksColor=id==='school'?'#f4f5f2':'#ffffff';kit.numberColor=k[3];kit.showName=false;return kit;};
/* ---------- Seleções personalizadas (times mistos) ---------- */
GM.KEY='matchday-v05-squads';
GM.load=()=>{try{const a=JSON.parse(localStorage.getItem(GM.KEY)||'[]');return Array.isArray(a)?a.filter(s=>s&&Array.isArray(s.picks)):[];}catch(e){return[];}};
GM.save=list=>{try{localStorage.setItem(GM.KEY,JSON.stringify(list));return true;}catch(e){return false;}};
GM.blank=(name,kit)=>({id:U.uid('sq'),name:name||'Meu time',short:'',kit:kit||'school',formation:'1-2-1',picks:[null,null,null,null,null],tactics:{mentality:'balanced',pressing:'high'}});
/* Valida a montagem: 5 jogadores, 1 goleiro, nenhum registro repetido (inclusive contra o adversário). */
GM.validate=function(sq,other){const errs=[];const ids=sq.picks.filter(Boolean).map(p=>p.playerId);
 if(ids.length!==5)errs.push('Escolha 5 jogadores (1 goleiro + 4 de linha).');
 if(new Set(ids).size!==ids.length)errs.push('O mesmo jogador foi escolhido duas vezes.');
 if(other){const o=new Set(other.picks.filter(Boolean).map(p=>p.playerId));if(ids.some(i=>o.has(i)))errs.push('Um jogador já está no time adversário.');}
 return errs;};
/* Monta um "clube" de 5 a partir das escolhas (sem alterar os clubes de origem). */
GM.toClub=function(sq,findPlayer,side){const slots=D.formationSlots(sq.formation||'1-2-1');const players=sq.picks.map((pk,i)=>{const src=pk&&findPlayer(pk.clubId,pk.playerId);if(!src)return null;
  const p=U.deepClone(src.player);p.origin={clubId:pk.clubId,clubName:src.club.name,clubShort:src.club.short,position:p.position,rating:p.rating};p.position=slots[i].pos;p.rating=D.computeOverall(p.attrs,p.position);return p;}).filter(Boolean);
 const kit=GM.kit(sq.kit),gk=D.defaultKit('#ffb21f','#1d2733','#ffffff');gk.sleeves='long';gk.pattern='plain';
 const k=GM.KITS.find(x=>x[0]===sq.kit)||GM.KITS[0];
 return{id:'sq-'+sq.id+'-'+(side||'x'),name:sq.name||'Time',short:(sq.short||U.initials(sq.name||'TM')).slice(0,3).toUpperCase(),city:'Germinare',primary:k[2],secondary:k[3],keeper:'#ffb21f',crest:sq.crest||null,
  kits:{home:kit,away:kit,third:kit,gk},tactics:{...D.TACTIC_DEFAULT,formation:sq.formation||'1-2-1',...(sq.tactics||{})},players,bench:[],stadiumName:'Quadra do Germinare',squad:true};};
GM.overall=function(sq,findPlayer){const r=sq.picks.map(pk=>pk&&findPlayer(pk.clubId,pk.playerId)).filter(Boolean).map(x=>x.player.rating);return r.length?Math.round(r.reduce((a,b)=>a+b,0)/r.length):0;};
/* Um clube completo vira um time de 5: melhor goleiro + 4 melhores de linha (usado no Modo Copa Germinare). */
GM.fromClub=function(club){const all=[...club.players,...(club.bench||[])];const gk=all.filter(p=>D.groupOf(p.position)==='GK').sort((a,b)=>b.rating-a.rating)[0]||all[0];
 const rest=all.filter(p=>p!==gk).sort((a,b)=>b.rating-a.rating).slice(0,4);const sq=GM.blank(club.name,null);sq.short=club.short;sq.crest=club.crest;sq.picks=[gk,...rest].map(p=>({clubId:club.id,playerId:p.id}));
 const c=GM.toClub(sq,(cid,pid)=>{const p=all.find(x=>x.id===pid);return p?{player:p,club}:null;});c.id=club.id;c.kits={...club.kits};c.primary=club.primary;c.secondary=club.secondary;return c;};
MD.Germinare=GM;
if(MD.Engine)Object.assign(MD.Engine.PLAY_TYPES,GM.TYPES);
})(typeof window!=='undefined'?(window.MD=window.MD||{}):(globalThis.MD=globalThis.MD||{}));
