/* MATCHDAY 0.5 — camada de regras (Leis do Jogo simplificadas), separada da simulação e do visual.
   Convenção: "quadro de ataque" — a equipe atacante ataca o gol em x=+54; a defensora defende esse gol.
   Funções puras: recebem uma situação e devolvem a decisão da arbitragem. Usadas pelo motor e pelos testes. */
(function(MD){
'use strict';
const R={};
/* Geometria do campo da modalidade atual (mutável: R.setMode troca para o campo reduzido do Germinare).
   Todo o código lê R.PITCH no momento da chamada, então motor, coreografia e câmeras se adaptam. */
R.PITCH_PRO={L:54,W:34,boxDepth:16.5,boxHalfW:20.16,sixDepth:5.5,sixHalfW:9.16,penSpot:11,goalHalfW:3.66,goalH:2.44,arcR:9.15,wallDist:9.15,netDepth:1.7,small:false};
R.PITCH={...R.PITCH_PRO};
/* Perfil de regras da modalidade (impedimento, pênaltis, reposição lateral, acréscimos). */
R.PROFILE_PRO={id:'pro',offside:true,penalties:true,restart:'throw',addedTime:true,cards:true,corners:true};
R.PROFILE={...R.PROFILE_PRO};
R.setMode=function(mode){Object.assign(R.PITCH,R.PITCH_PRO,(mode&&mode.pitch)||{});Object.assign(R.PROFILE,R.PROFILE_PRO,(mode&&mode.rules)||{});return R;};
const P=R.PITCH;
/* Área penal da equipe defensora (no gol atacado, x=+54). Linhas fazem parte da área. */
R.inPenaltyArea=(x,z)=>x>=P.L-P.boxDepth&&x<=P.L&&Math.abs(z)<=P.boxHalfW;
R.inGoalArea=(x,z)=>x>=P.L-P.sixDepth&&x<=P.L&&Math.abs(z)<=P.sixHalfW;
R.distToGoal=(x,z)=>Math.hypot(P.L-x,z);
R.DIRECT_OFFENCES=['trip','kick','push','charge','tackle','hold','strike','jump_at','handball','elbow'];
R.INDIRECT_OFFENCES=['dangerous_play','impeding','gk_handling','gk_backpass','obstruct_gk'];

/* Classifica a falta cometida pela equipe defensora contra a atacante.
   Retorna o tiro livre correspondente: pênalti, tiro livre direto ou indireto, e o local da cobrança. */
R.classifyFoul=function(f){const direct=R.DIRECT_OFFENCES.includes(f.offence)||(!R.INDIRECT_OFFENCES.includes(f.offence)&&f.contact!==false);
 const inBox=R.inPenaltyArea(f.x,f.z);
 if(direct&&inBox)return{restart:'penalty',direct:true,inBox:true,spot:[P.L-P.penSpot,0],dangerous:true};
 let x=f.x,z=f.z;
 if(!direct&&R.inGoalArea(x,z)){x=P.L-P.sixDepth;} /* indireto dentro da pequena área: sobre a linha da pequena área */
 const d=R.distToGoal(x,z);
 return{restart:direct?'direct_free_kick':'indirect_free_kick',direct,inBox,spot:[x,z],dangerous:d<30&&Math.abs(z)<26,shootable:direct&&d<32&&Math.abs(z)<22};};

/* Decisão disciplinar (Lei 12). severity: 'careless' | 'reckless' | 'excessive'.
   dogso = impediu oportunidade clara de gol; spa = impediu ataque promissor. */
R.foulCard=function(f){let card=null,reason='';const penalty=f.restart==='penalty';
 if(f.severity==='excessive'){card='red';reason='Jogo brusco grave';}
 else if(f.dogso){
  if(penalty&&f.attemptToPlayBall&&f.offence!=='hold'&&f.offence!=='push'&&f.offence!=='handball'){card='yellow';reason='Impediu chance clara (pênalti com disputa de bola)';}
  else{card='red';reason='Impediu oportunidade clara de gol';}}
 else if(f.severity==='reckless'){card='yellow';reason='Entrada temerária';}
 else if(f.spa){if(penalty&&f.attemptToPlayBall){card=null;reason='';}else{card='yellow';reason='Parou ataque promissor';}}
 else if(f.offence==='handball'&&f.deliberate){card='yellow';reason='Toque de mão deliberado';}
 if(card==='yellow'&&(f.existingYellows||0)>=1)return{card:'red',secondYellow:true,reason:'Segundo amarelo'};
 return{card,secondYellow:false,reason};};

/* Lei da vantagem: o árbitro deixa seguir se a equipe que sofreu a falta mantém um ataque promissor.
   Pênaltis e jogo brusco grave não são "engolidos"; o cartão continua sendo aplicado depois. */
R.advantage=function(f){if(f.restart==='penalty')return false;if(f.severity==='excessive')return false;return !!(f.keepsPossession&&f.promising);};

/* Impedimento (Lei 11) no momento do passe. Defensores defendem x=+54.
   defXs inclui o goleiro. Posição de impedimento: no campo adversário, à frente da bola e do penúltimo defensor. */
R.secondLastDefenderX=function(defXs){const s=[...defXs].sort((a,b)=>b-a);return s.length>1?s[1]:(s[0]??P.L);};
R.offsidePosition=function(o){if(o.receiverX<=0)return false;const line=Math.max(R.secondLastDefenderX(o.defXs),o.ballX);return o.receiverX>line+(o.tolerance||0.0);};
R.isOffside=function(o){if(!R.PROFILE.offside)return false;if(o.restart==='throw_in'||o.restart==='goal_kick'||o.restart==='corner')return false;if(!o.involved)return false;return R.offsidePosition(o);};

/* Bola fora de jogo (Lei 9/15/16/17). lastTouch: 'att' ou 'def'. */
R.ballOut=function(o){const x=o.x,z=o.z;
 if(x>P.L&&Math.abs(z)<P.goalHalfW&&o.y!==undefined&&o.y<P.goalH)return{type:'goal'};
 if(x>P.L)return o.lastTouch==='def'?{type:'corner',team:'att',spot:[P.L,Math.sign(z||1)*P.W]}:{type:'goal_kick',team:'def',spot:[P.L-P.sixDepth,0]};
 if(x<-P.L)return o.lastTouch==='att'?{type:'corner',team:'def',spot:[-P.L,Math.sign(z||1)*P.W]}:{type:'goal_kick',team:'att',spot:[-P.L+P.sixDepth,0]};
 if(Math.abs(z)>P.W)return{type:R.PROFILE.restart==='kick'?'kick_in':'throw_in',team:o.lastTouch==='att'?'def':'att',spot:[Math.max(-P.L,Math.min(P.L,x)),Math.sign(z)*P.W]};
 return{type:'in_play'};};

/* Validação de gol: nenhuma infração da equipe atacante na jogada, bola cruzou totalmente a linha entre as traves. */
R.goalValid=function(g){if(g.offside)return{valid:false,reason:'Impedimento'};if(g.attackerFoul)return{valid:false,reason:'Falta do ataque'};if(g.handball)return{valid:false,reason:'Toque de mão do atacante'};if(g.crossedLine===false)return{valid:false,reason:'A bola não entrou'};return{valid:true,reason:''};};

/* Acréscimos (Lei 7): somatório das interrupções do período. Valor em segundos, arredondado ao minuto. */
R.ADDED_COST={goal:42,sub:25,card:14,injury:45,penalty:50,red:30,var:0,keeperTime:10,freeKick:4};
R.addedTime=function(counts,half){if(!R.PROFILE.addedTime)return 0;if(half==='et1'||half==='et2'){const g=(counts.goal||0)+(counts.sub||0)+(counts.card||0);return g>3?120:60;}let s=half==='first'?30:60;for(const k in counts)s+=(R.ADDED_COST[k]||0)*counts[k];
 const min=Math.round(s/60);return Math.max(half==='first'?1:2,Math.min(half==='first'?5:9,min))*60;};

/* Substituições: limite configurável; janelas não são impostas além do limite total. */
R.canSubstitute=function(team,settings){const max=settings?.maxSubs??5;return team.subsUsed<max&&team.bench.some(p=>!p.used);};

/* Rótulos em português para a transmissão. */
R.LABEL={penalty:'PÊNALTI',direct_free_kick:'FALTA DIRETA',indirect_free_kick:'FALTA INDIRETA',corner:'ESCANTEIO',goal_kick:'TIRO DE META',throw_in:'LATERAL',kick_in:'TIRO LATERAL',offside:'IMPEDIMENTO',yellow:'CARTÃO AMARELO',red:'CARTÃO VERMELHO'};
MD.Rules=R;
})(typeof window!=='undefined'?(window.MD=window.MD||{}):(globalThis.MD=globalThis.MD||{}));
