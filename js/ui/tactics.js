/* TRS26 / MATCHDAY 0.6 — ESCALAÇÃO E TÁTICAS (campo tático visual).
   Funciona antes da partida (cópias do clube usadas no jogo) e durante a partida (pausa/intervalo, aplicando no mundo).
   Trocar titulares/reservas e posições: selecione um atleta e depois outro (no campo ou no banco).
   Formação, capitão, cobradores, mentalidade, pressão, estilo, largura, marcação, instruções individuais e uniforme. */
(function(MD){
'use strict';
const U=MD.U,D=MD.Data,App=MD.App,$=id=>document.getElementById(id),esc=U.escape;
const TU=MD.TacticsUI={};
const INSTR=[['','Padrão'],['attack','Apoiar o ataque'],['defend','Ficar na defesa'],['free','Função livre']];
let S=null;
/* ctx: {clubs:[clubA, clubB], side:0|1, world?, editable:[bool,bool], onClose, kits:{home:'auto',away:'auto'}} */
TU.open=function(ctx){S={...ctx,side:ctx.side||0,sel:null};$('tactics-modal').hidden=false;TU.render();setTimeout(()=>{const b=$('tactics-modal').querySelector('.tk-token');if(b)b.focus();},60);};
TU.close=function(){$('tactics-modal').hidden=true;const f=S&&S.onClose;S=null;if(f)f();};
const club=()=>S.clubs[S.side];
const live=()=>S.world?S.world.teams[S.side]:null;
function formations(){const w=S.world;const small=w?w.small:(S.mode==='germinare');return small?Object.keys(MD.Modes.FORMATIONS_G):Object.keys(D.FORMATIONS);}
TU.render=function(){const c=club();const t=live();const editable=S.editable?S.editable[S.side]!==false:true;const tac={...D.TACTIC_DEFAULT,...(c.tactics||{})};if(t)Object.assign(tac,t.tactics);
 const slots=D.formationSlots(tac.formation);const small=!!(S.world?S.world.small:S.mode==='germinare');const Lx=small?20:54,Wz=small?12.5:34;
 const starters=t?t.players:c.players.slice(0,slots.length);const bench=t?t.bench.filter(b=>!b.used).map(b=>b.data):c.bench.slice(0,small?6:12);
 const cap=t?t.captain:(c.captain||null);
 $('tk-tabs').innerHTML=S.clubs.map((cl,i)=>`<button class="tab ${i===S.side?'active':''}" data-tkside="${i}"><img src="${App.crest(cl)}" alt="">${esc(cl.short||cl.name)}${S.editable&&S.editable[i]===false?' 🔒':''}</button>`).join('');
 const tok=(p,i,bench)=>{const d=t&&!bench?p.data:p;const data=d||p;const s=slots[i]||{x:0,z:0,pos:data.position};const pos=bench?data.position:(i===0?'GOL':s.pos);const off=t&&!bench&&p.off;
  const x=bench?0:50+(s.x/Lx)*46,y=bench?0:50-(s.z/Wz)*44;const id=data.id;const sel=S.sel&&S.sel.id===id;const en=t&&!bench?Math.round(p.stamina*100):100;
  return`<button class="tk-token ${bench?'bench':''} ${sel?'sel':''} ${off?'off':''}" ${bench?'':`style="left:${x}%;top:${y}%"`} data-tkid="${esc(id)}" data-bench="${bench?1:0}" data-idx="${i}" ${off||!editable?'disabled':''}>
   <span class="tk-num">${data.number}</span><span class="tk-name">${esc(String(data.name).split(' ').pop())}</span><span class="tk-pos pos-${App.posGroup(pos)}">${esc(App.posLabel(pos))}</span>${id===cap?'<i class="tk-cap">C</i>':''}${pos==='GOL'?'<i class="tk-gk">GOL</i>':''}${t&&!bench?`<i class="tk-en"><b style="width:${en}%"></b></i>`:''}<span class="tk-ovr">${data.rating}</span></button>`;};
 $('tk-pitch').innerHTML=`<div class="tk-lines"></div>`+starters.map((p,i)=>tok(p,i,false)).join('');
 $('tk-bench').innerHTML=bench.map((p,i)=>tok(p,i,true)).join('')||'<p class="hint">Sem reservas.</p>';
 const sel=(k,list,v)=>`<label>${{formation:'Formação',mentality:'Mentalidade',pressing:'Pressão',style:'Estilo de jogo',width:'Largura',marking:'Marcação'}[k]}<select data-tk="${k}" ${editable?'':'disabled'}>${list.map(o=>`<option value="${esc(o[0])}" ${o[0]===v?'selected':''}>${esc(o[1])}</option>`).join('')}</select></label>`;
 const names=starters.map(p=>t?p.data:p).filter(Boolean);const opt=(cur)=>`<option value="">Automático</option>`+names.map(p=>`<option value="${esc(p.id)}" ${p.id===cur?'selected':''}>${esc(p.name)}</option>`).join('');
 const takers=(t?t.takers:c.takers)||{};
 const selP=S.sel&&!S.sel.bench?names.find(p=>p.id===S.sel.id):null;const instr=(t?(t.instructions||{}):(c.instructions||{}));
 const kitKey=S.kits?S.kits[S.side?'away':'home']:'auto';
 $('tk-side').innerHTML=`<div class="fgrid">${sel('formation',formations().map(f=>[f,f]),tac.formation)}${sel('mentality',App.TAC.mentality,tac.mentality)}${sel('pressing',App.TAC.pressing,tac.pressing)}${sel('style',App.TAC.style,tac.style)}${sel('width',App.TAC.width,tac.width||'normal')}${sel('marking',App.TAC.marking,tac.marking)}</div>
  <div class="fgrid"><label>Capitão<select data-tkx="captain" ${editable?'':'disabled'}>${opt(cap)}</select></label><label>Pênaltis<select data-tkx="penalty" ${editable?'':'disabled'}>${opt(takers.penalty)}</select></label><label>Faltas<select data-tkx="freekick" ${editable?'':'disabled'}>${opt(takers.freekick)}</select></label><label>Escanteios<select data-tkx="corner" ${editable?'':'disabled'}>${opt(takers.corner)}</select></label>
  ${S.world?'':`<label>Uniforme<select data-tkkit ${editable?'':'disabled'}><option value="auto">Automático (sem cores parecidas)</option><option value="home" ${kitKey==='home'?'selected':''}>Principal</option><option value="away" ${kitKey==='away'?'selected':''}>Reserva</option><option value="third" ${kitKey==='third'?'selected':''}>Terceiro</option></select></label>`}</div>
  ${selP?`<div class="card tk-instr"><b>${esc(selP.name)}</b><label>Instrução individual<select data-tkinstr="${esc(selP.id)}" ${editable?'':'disabled'}>${INSTR.map(o=>`<option value="${o[0]}" ${(instr[selP.id]||'')===o[0]?'selected':''}>${o[1]}</option>`).join('')}</select></label><small class="hint">Escolha outro atleta para trocar de posição, ou um reserva para substituir.</small></div>`:`<p class="hint">Selecione um atleta no campo e depois outro (ou um reserva) para trocar. ${t?`Substituições: ${t.subsUsed}/${S.world.small?'∞':(S.world.opts.maxSubs||5)}.`:''}</p>`}
  ${S.world?'':`<button class="btn ghost small" id="tk-savedef" ${editable?'':'disabled'}>SALVAR COMO PADRÃO DO CLUBE</button>`}`;};
function swap(a,b){const c=club();const t=live();
 if(t){/* em jogo */const w=S.world;
  if(a.bench!==b.bench){const out=a.bench?b:a,inn=a.bench?a:b;const bi=t.bench.findIndex(x=>!x.used&&x.data.id===inn.id);if(w.substitute(S.side,out.id,bi)){App.toast('Substituição realizada.');MD.Audio&&MD.Audio.ui&&MD.Audio.ui('confirm');}else App.toast('Substituição não permitida.');return;}
  if(!a.bench&&!b.bench){const i=t.players.findIndex(p=>p.id===a.id),j=t.players.findIndex(p=>p.id===b.id);if(i<0||j<0)return;if(i===0||j===0){App.toast('O goleiro só troca com outro goleiro pelo banco.');return;}
   const pi=t.players[i],pj=t.players[j];t.players[i]=pj;t.players[j]=pi;const si=pi.slot;pi.slot=pj.slot;pj.slot=si;for(const p of [pi,pj]){const s=t.slots[p.slot];if(s){p.pos=s.pos;p.group=D.groupOf(s.pos);}p.view.slot=p.slot;}if(w.ai)w.ai.reshape(S.side);}return;}
 /* antes do jogo: mexe na cópia da partida */
 const arr=c.players,ben=c.bench;const ia=a.bench?-1:arr.findIndex(p=>p.id===a.id),ib=b.bench?-1:arr.findIndex(p=>p.id===b.id);
 if(!a.bench&&!b.bench){[arr[ia],arr[ib]]=[arr[ib],arr[ia]];return;}
 if(a.bench&&b.bench)return;const si=a.bench?ib:ia,bid=a.bench?a.id:b.id;const bj=ben.findIndex(p=>p.id===bid);if(si<0||bj<0)return;[arr[si],ben[bj]]=[ben[bj],arr[si]];}
TU.bind=function(){const m=$('tactics-modal');
 m.addEventListener('click',e=>{if(!S)return;const tab=e.target.closest('[data-tkside]');if(tab){S.side=+tab.dataset.tkside;S.sel=null;TU.render();return;}
  const tk=e.target.closest('.tk-token');if(tk){const cur={id:tk.dataset.tkid,bench:tk.dataset.bench==='1'};if(!S.sel){S.sel=cur;}else if(S.sel.id===cur.id){S.sel=null;}else{swap(S.sel,cur);S.sel=null;}TU.render();const again=m.querySelector(`[data-tkid="${CSS.escape(cur.id)}"]`);if(again)again.focus();return;}
  if(e.target.id==='tk-savedef'){const c=club();const base=App.club(c.id);if(base){base.tactics={...c.tactics};base.players=c.players.slice();base.bench=c.bench.slice();base.captain=c.captain;base.takers={...(c.takers||{})};base.instructions={...(c.instructions||{})};App.save(base.id);App.toast('Escalação salva no clube.');}return;}
  if(e.target.closest('[data-tkclose]'))TU.close();});
 m.addEventListener('change',e=>{if(!S)return;const c=club(),t=live();const el=e.target;
  if(el.dataset.tk){const k=el.dataset.tk;c.tactics={...D.TACTIC_DEFAULT,...(c.tactics||{}),[k]:el.value};if(t)S.world.setTactic(S.side,k,el.value);TU.render();return;}
  if(el.dataset.tkx){const k=el.dataset.tkx;if(k==='captain'){c.captain=el.value||null;if(t)t.captain=el.value||t.captain;}else{c.takers={...(c.takers||{}),[k]:el.value||null};if(t)t.takers={...(t.takers||{}),[k]:el.value||null};}TU.render();return;}
  if(el.dataset.tkinstr!==undefined){const id=el.dataset.tkinstr;c.instructions={...(c.instructions||{}),[id]:el.value};if(t){t.instructions={...(t.instructions||{}),[id]:el.value};const p=t.players.find(q=>q.id===id);if(p)p.instr=el.value;}return;}
  if(el.dataset.tkkit!==undefined&&S.kits){S.kits[S.side?'away':'home']=el.value;if(S.onKit)S.onKit();}});};
})(window.MD=window.MD||{});
