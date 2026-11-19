/* MATCHDAY 0.5 — modalidades de jogo.
   Cada modalidade define a geometria do campo, o perfil de regras, a quantidade de jogadores, a estrutura de
   períodos, a condição de término e o ritmo da transmissão. Motor, coreografia, câmeras e cenário leem a
   modalidade ativa — não existe um "motor do Germinare" duplicado. */
(function(MD){
'use strict';
const MO={};
/* Ritmo: accel = velocidade do relógio entre os lances (x tempo real); gap = segundos reais mínimos entre
   destaques comuns; k = suavidade da desaceleração ao se aproximar de um lance. */
MO.PRO={id:'pro',name:'Futebol de campo',short:'11 x 11',pitch:null,rules:{},players:11,periods:2,periodLen:2700,endGoals:0,venue:'arena',
 restartAfterGoal:[55,85],pace:{slow:{accel:15,gap:15,k:1.3},normal:{accel:24,gap:11,k:1.15},fast:{accel:38,gap:8,k:1}},
 extraLen:900,goldenLen:0,shootoutKicks:5};
MO.GERMINARE={id:'germinare',name:'Germinare',short:'5 x 5',
 pitch:{L:20,W:12.5,boxDepth:6,boxHalfW:7.5,sixDepth:2,sixHalfW:3.5,penSpot:6,goalHalfW:1.5,goalH:2,arcR:3,wallDist:5,netDepth:1,small:true},
 rules:{id:'germinare',offside:false,penalties:true,restart:'kick',addedTime:false,cards:true,corners:true},
 players:5,periods:1,periodLen:300,endGoals:2,venue:'germinare',restartAfterGoal:[12,20],
 pace:{slow:{accel:2.6,gap:6,k:1.1},normal:{accel:3.6,gap:4.5,k:1},fast:{accel:5.5,gap:3,k:.9}},
 extraLen:0,goldenLen:120,shootoutKicks:3};
MO.LIST={pro:MO.PRO,germinare:MO.GERMINARE};
/* Formações do futebol reduzido (quadro de ataque: gol próprio em x=-20, ataque para +x, direita = +z). */
MO.FORMATIONS_G={
 '1-2-1':[['GOL',-18.3,0],['FIX',-11,0],['ALD',-4.5,6.4],['ALE',-4.5,-6.4],['PIV',4.5,0]],
 '2-2':[['GOL',-18.3,0],['FIX',-11.5,4],['FIX',-11.5,-4],['ALD',.5,5.2],['PIV',1.5,-4.2]],
 '3-1':[['GOL',-18.3,0],['FIX',-12,0],['ALD',-8,7.5],['ALE',-8,-7.5],['PIV',3,0]],
 '1-1-2':[['GOL',-18.3,0],['FIX',-12,0],['MEI',-4.5,0],['ALD',3.5,5.5],['PIV',4.5,-4.5]]};
MO.POS_LABEL={FIX:'FIXO',ALD:'ALA D',ALE:'ALA E',PIV:'PIVÔ',MEI:'MEIA'};
MO.TIEBREAKS=[['none','Empate permitido'],['penalties','Disputa de pênaltis'],['golden','Gol de ouro (2 min) + pênaltis']];
/* Resolve a modalidade com as configurações do usuário (duração, gols para vencer, pênaltis, reposição, desempate). */
MO.resolve=function(id,o){const base=MO.LIST[id]||MO.PRO;const m=JSON.parse(JSON.stringify(base));o=o||{};
 if(m.id==='germinare'){const g=o.germinare||{};
  if(g.minutes)m.periodLen=Math.round(Math.min(20,Math.max(2,Number(g.minutes)))*60);
  if(g.goalsToWin!==undefined)m.endGoals=Math.max(0,Math.min(9,Math.round(Number(g.goalsToWin)||0)));
  if(g.penalties!==undefined)m.rules.penalties=!!g.penalties;
  if(g.restart)m.rules.restart=g.restart==='throw'?'throw':'kick';
  /* ritmo proporcional à duração mais curta */
  const f=m.periodLen/300;for(const k in m.pace)m.pace[k].accel*=Math.max(.6,Math.min(3,f));}
 return m;};
/* Estrutura de períodos de uma partida (tempo regulamentar + prorrogação/gol de ouro quando houver). */
MO.periods=function(mode){const L=mode.periodLen;const out=[{id:'first',half:'first',start:0,len:L,label:mode.periods===1?'TEMPO ÚNICO':'1º TEMPO'}];
 if(mode.periods>=2)out.push({id:'second',half:'second',start:L,len:L,label:'2º TEMPO'});
 const reg=L*mode.periods;
 if(mode.extraLen){out.push({id:'et1',half:'first',start:reg,len:mode.extraLen,label:'1º T PRORR.',extra:true});out.push({id:'et2',half:'second',start:reg+mode.extraLen,len:mode.extraLen,label:'2º T PRORR.',extra:true});}
 if(mode.goldenLen)out.push({id:'golden',half:'first',start:reg,len:mode.goldenLen,label:'GOL DE OURO',extra:true,golden:true});
 return out;};
MO.apply=function(mode){MD.Rules.setMode(mode);return mode;};
MD.Modes=MO;
})(typeof window!=='undefined'?(window.MD=window.MD||{}):(globalThis.MD=globalThis.MD||{}));
