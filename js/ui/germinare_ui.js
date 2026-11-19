/* MATCHDAY 0.5 — interface do Modo Germinare: seleção livre de 5 jogadores (1 goleiro + 4 de linha) de qualquer
   clube, filtros (nome, país, liga, clube, posição), cards com foto/overall/atributos, prévia 3D, formação dos cinco,
   seleções personalizadas salvas (sem alterar os clubes de origem) e regras da partida. */
(function(MD){
'use strict';
const U=MD.U,D=MD.Data,GM=MD.Germinare,CAT=MD.Catalog,App=MD.App,$=id=>document.getElementById(id),esc=U.escape;
const GU=MD.GermUI={};
const SLOT_NAMES=f=>D.formationSlots(f).map(s=>MD.Modes.POS_LABEL[s.pos]||(s.pos==='GOL'?'GOLEIRO':s.pos));
let G=null;
function init(){if(G)return;const saved=GM.load();
 G={A:GM.blank('Time Branco','school'),B:GM.blank('Time Laranja','bib_orange'),target:{team:'A',slot:0},f:{q:'',country:'',league:'',club:'',pos:'GK',sort:'ovr',page:0},hover:null,yaw:.5,index:null};
 G.A.short='BRA';G.B.short='LAR';if(saved[0])G.A=U.deepClone(saved[0]);if(saved[1])G.B=U.deepClone(saved[1]);}
GU.find=function(clubId,playerId){const c=App.clubs.find(x=>x.id===clubId);if(!c)return null;const p=[...c.players,...c.bench].find(x=>x.id===playerId);return p?{player:p,club:c}:null;};
function index(){if(G.index&&G.index.n===App.clubs.length)return G.index.list;const list=CAT.allPlayers(App.clubs);G.index={n:App.clubs.length,list};return list;}
const taken=()=>new Set([...G.A.picks,...G.B.picks].filter(Boolean).map(p=>p.playerId));
function attrsLine(p){const a=p.attrs;const gk=D.groupOf(p.position)==='GK';const k=gk?[['REF',a.gkReflexes],['POS',a.gkPositioning],['PEN',a.gkPenalties],['PÉS',a.gkKicking]]:[['VEL',Math.round((a.pace+a.accel)/2)],['FIN',a.finishing],['PAS',a.passing],['DRI',a.dribbling],['DEF',Math.round((a.marking+a.tackling)/2)],['FÍS',Math.round((a.strength+a.stamina)/2)]];
 return k.map(x=>`<span><small>${x[0]}</small>${x[1]}</span>`).join('');}
function teamPanel(key){const sq=G[key];const names=SLOT_NAMES(sq.formation);const ovr=GM.overall(sq,GU.find);const errs=GM.validate(sq,G[key==='A'?'B':'A']);
 const kitOpts=GM.KITS.map(k=>`<option value="${k[0]}" ${k[0]===sq.kit?'selected':''}>${k[1]}</option>`).join('');const forms=Object.keys(MD.Modes.FORMATIONS_G).map(f=>`<option ${f===sq.formation?'selected':''}>${f}</option>`).join('');
 const kit=GM.KITS.find(k=>k[0]===sq.kit)||GM.KITS[0];
 return`<div class="gt-head" style="--c1:${kit[2]};--c2:${kit[3]}"><div class="gt-badge">${esc((sq.short||'?').slice(0,3))}</div><div class="gt-names"><input data-gt="${key}" data-f="name" value="${esc(sq.name)}" maxlength="24" aria-label="Nome do time"/><input data-gt="${key}" data-f="short" value="${esc(sq.short||'')}" maxlength="3" placeholder="SIG" aria-label="Sigla"/></div><div class="gt-ovr">${ovr||'–'}<small>OVR</small></div></div>
 <div class="fgrid"><label>Uniforme<select data-gt="${key}" data-f="kit">${kitOpts}</select></label><label>Formação<select data-gt="${key}" data-f="formation">${forms}</select></label></div>
 <canvas class="gt-pitch" width="300" height="190" data-gpitch="${key}"></canvas>
 <div class="gt-slots">${sq.picks.map((pk,i)=>{const r=pk&&GU.find(pk.clubId,pk.playerId);const act=G.target.team===key&&G.target.slot===i;
  return`<div class="gt-slot ${act?'active':''} ${r?'filled':''}" data-gslot="${key}:${i}"><span class="gs-pos">${esc(names[i])}</span>${r?`<span class="gs-av">${App.avatar(r.player)}</span><span class="gs-name"><b>${esc(r.player.name)}</b><small>${esc(r.club.short)} · ${esc(r.player.position)}</small></span><span class="gs-ovr">${r.player.rating}</span><button class="gs-x" data-gremove="${key}:${i}" title="Remover">✕</button>`:`<span class="gs-empty">${act?'escolhendo…':'clique para escolher'}</span>`}</div>`;}).join('')}</div>
 ${errs.length?`<div class="gt-err">${esc(errs[0])}</div>`:'<div class="gt-ok">✓ Pronto para jogar</div>'}
 <div class="btn-row"><button class="btn ghost small" data-gsave="${key}">SALVAR SELEÇÃO</button><button class="btn ghost small" data-gclear="${key}">LIMPAR</button></div>`;}
function drawMini(canvas,sq){if(!canvas)return;const x=canvas.getContext('2d'),w=canvas.width,h=canvas.height;x.fillStyle='#3b6b2b';x.fillRect(0,0,w,h);x.strokeStyle='#cfe8c1aa';x.lineWidth=1.5;x.strokeRect(6,6,w-12,h-12);x.beginPath();x.moveTo(w/2,6);x.lineTo(w/2,h-6);x.stroke();x.beginPath();x.arc(w/2,h/2,18,0,7);x.stroke();
 const kit=GM.KITS.find(k=>k[0]===sq.kit)||GM.KITS[0];D.formationSlots(sq.formation).forEach((s,i)=>{const px=w/2+(s.x/20)*(w/2-14),py=h/2-(s.z/12.5)*(h/2-14);const pk=sq.picks[i];const r=pk&&GU.find(pk.clubId,pk.playerId);
  x.fillStyle=i===0?'#ffb21f':kit[2];x.strokeStyle='#0a1220';x.lineWidth=2;x.beginPath();x.arc(px,py,11,0,7);x.fill();x.stroke();x.fillStyle=i===0?'#1d2733':kit[3];x.font='900 10px Arial';x.textAlign='center';x.textBaseline='middle';x.fillText(r?String(r.player.rating):'?',px,py+1);
  if(r){x.fillStyle='#fff';x.font='700 9px Arial';x.fillText(r.player.name.split(' ').pop().slice(0,10),px,py+18);}});}
GU.render=function(){init();App.attachStudio('gm-preview-slot','germ');const st=App.settings.germinare;
 $('gm-team-a').innerHTML=teamPanel('A');$('gm-team-b').innerHTML=teamPanel('B');document.querySelectorAll('[data-gpitch]').forEach(c=>drawMini(c,G[c.dataset.gpitch]));
 $('gm-minutes').value=String(st.minutes);$('gm-goals').value=String(st.goalsToWin);$('gm-pens').value=st.penalties?'1':'0';$('gm-restart').value=st.restart;$('gm-pace').value=st.pace||'normal';$('gm-cinema').checked=st.cinema!==false;
 $('gm-rule-min').textContent=st.minutes;$('gm-rule-goals').textContent=st.goalsToWin||'∞';
 GU.renderFilters();GU.renderGrid();GU.renderSaved();};
GU.renderFilters=function(){const f=G.f;const used=new Set(App.clubs.map(c=>c.country));
 $('gb-country').innerHTML='<option value="">Todos os países</option>'+CAT.countries.filter(c=>used.has(c.id)).map(c=>`<option value="${esc(c.id)}" ${c.id===f.country?'selected':''}>${c.flag||''} ${esc(c.name)}</option>`).join('');
 $('gb-league').innerHTML='<option value="">Todas as ligas</option>'+CAT.leagues.filter(l=>!f.country||l.country===f.country).filter(l=>App.clubs.some(c=>c.league===l.id)).map(l=>`<option value="${esc(l.id)}" ${l.id===f.league?'selected':''}>${esc(l.name)}</option>`).join('');
 $('gb-club').innerHTML='<option value="">Todos os clubes</option>'+App.clubs.filter(c=>(!f.country||c.country===f.country)&&(!f.league||c.league===f.league)).sort((a,b)=>a.name.localeCompare(b.name)).map(c=>`<option value="${esc(c.id)}" ${c.id===f.club?'selected':''}>${esc(c.name)}</option>`).join('');
 $('gb-pos').value=f.pos;$('gb-sort').value=f.sort;$('gb-search').value=f.q;
 const names=SLOT_NAMES(G[G.target.team].formation);$('gb-target').innerHTML=`Escolhendo: <b>${esc(names[G.target.slot])}</b> do <b>${esc(G[G.target.team].name)}</b>${G.target.slot===0?' · somente goleiros':' · jogadores de linha'}`;};
GU.filtered=function(){const f=G.f;const q=f.q.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');const tk=taken();const wantGK=G.target.slot===0;
 let list=index().filter(x=>(!f.country||x.country===f.country)&&(!f.league||x.league===f.league)&&(!f.club||x.club.id===f.club));
 list=list.filter(x=>{const g=App.posGroup(x.p.position);return wantGK?g==='GK':g!=='GK';});
 if(f.pos&&!wantGK)list=list.filter(x=>App.posGroup(x.p.position)===f.pos);
 if(q)list=list.filter(x=>(x.p.name+' '+x.club.name).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').includes(q));
 list.sort(f.sort==='name'?(a,b)=>a.p.name.localeCompare(b.p.name):(a,b)=>b.p.rating-a.p.rating);return list.map(x=>({...x,taken:tk.has(x.p.id)}));};
GU.renderGrid=function(){const list=GU.filtered();const per=18;const pages=Math.max(1,Math.ceil(list.length/per));G.f.page=Math.min(G.f.page,pages-1);const slice=list.slice(G.f.page*per,(G.f.page+1)*per);
 $('gb-grid').innerHTML=slice.map((x,i)=>{const p=x.p,c=x.club;const g=App.posGroup(p.position);
  return`<button class="pcard ${x.taken?'taken':''} pg-${g}" data-pick="${esc(c.id)}|${esc(p.id)}" ${x.taken?'disabled':''} style="--c1:${c.primary};--c2:${c.secondary};animation-delay:${i*14}ms">
   <div class="pc-top"><div class="pc-ovr">${p.rating}<small>${esc(p.position)}</small></div><img class="pc-crest" src="${App.crest(c)}" alt=""></div>
   <div class="pc-photo">${App.avatar(p)}</div><div class="pc-name">${esc(p.shirtName||p.name)}</div><div class="pc-club">${esc(c.short)} · ${esc(p.nationality||App.countryOf(c).name||'')}</div>
   <div class="pc-attrs">${attrsLine(p)}</div>${x.taken?'<em>ESCOLHIDO</em>':''}${p.unverified?'<i class="pc-warn" title="Atleta não verificado">!</i>':''}</button>`;}).join('')||'<p class="hint">Nenhum jogador encontrado com esses filtros.</p>';
 $('gb-pager').innerHTML=`<button class="btn ghost small" data-gpage="-1" ${G.f.page<=0?'disabled':''}>‹</button><span>${G.f.page+1} / ${pages} · ${list.length} jogadores</span><button class="btn ghost small" data-gpage="1" ${G.f.page>=pages-1?'disabled':''}>›</button>`;};
GU.renderSaved=function(){const list=GM.load();$('gm-saved').innerHTML=list.length?list.map(s=>`<div class="sv-row"><b>${esc(s.name)}</b><small>${GM.overall(s,GU.find)} OVR · ${s.picks.filter(Boolean).length}/5</small><button class="btn ghost small" data-gload="A|${esc(s.id)}">USAR NO A</button><button class="btn ghost small" data-gload="B|${esc(s.id)}">USAR NO B</button><button class="btn ghost small" data-gdel="${esc(s.id)}">✕</button></div>`).join(''):'<p class="hint">Salve uma seleção para reutilizar depois (ela não altera os clubes originais).</p>';};
GU.assign=function(clubId,playerId){const sq=G[G.target.team];const other=G[G.target.team==='A'?'B':'A'];if(taken().has(playerId)){App.toast('Esse jogador já foi escolhido.');return;}
 sq.picks[G.target.slot]={clubId,playerId};const r=GU.find(clubId,playerId);G.hover=r;
 /* avança para a próxima vaga vazia (do mesmo time, depois do outro) */
 let next=sq.picks.findIndex(p=>!p);if(next>=0)G.target.slot=next;else{const n2=other.picks.findIndex(p=>!p);if(n2>=0){G.target={team:G.target.team==='A'?'B':'A',slot:n2};}}
 if(G.target.slot===0)G.f.pos='GK';else if(G.f.pos==='GK')G.f.pos='';GU.render();};
GU.random=function(){const all=index();const used=new Set();const pickFrom=(pred,n)=>{const pool=all.filter(x=>pred(x)&&!used.has(x.p.id)).sort((a,b)=>b.p.rating-a.p.rating).slice(0,60);const out=[];while(out.length<n&&pool.length){const i=Math.floor(Math.random()*pool.length);const x=pool.splice(i,1)[0];used.add(x.p.id);out.push({clubId:x.club.id,playerId:x.p.id});}return out;};
 for(const k of ['A','B']){const gk=pickFrom(x=>App.posGroup(x.p.position)==='GK',1);const f=pickFrom(x=>App.posGroup(x.p.position)!=='GK',4);G[k].picks=[...gk,...f];}G.target={team:'A',slot:0};GU.render();App.toast('Times sorteados!');};
GU.start=function(){for(const k of ['A','B']){const e=GM.validate(G[k],G[k==='A'?'B':'A']);if(e.length){App.toast(`${G[k].name}: ${e[0]}`);return;}}
 if(G.A.kit===G.B.kit){G.B.kit=GM.KITS.find(k=>k[0]!==G.A.kit)[0];App.toast('Uniformes iguais: o segundo time usará '+GM.KITS.find(k=>k[0]===G.B.kit)[1]+'.');}
 const a=GM.toClub(G.A,GU.find,'a'),b=GM.toClub(G.B,GU.find,'b');const st=App.settings.germinare;
 MD.Audio.resume();App.flow={kind:'germinare',mode:'germinare',home:a,away:b,germ:{minutes:st.minutes,goalsToWin:st.goalsToWin,penalties:st.penalties,restart:st.restart},watch:'play',humans:[]};App.go('sides');};
GU.leave=function(){};
/* prévia 3D do jogador (visualizador compartilhado dos editores) */
GU.frame=function(dt){if(!G||!App.studio||App.studioOwner!=='germ')return;const r=G.hover||(()=>{const pk=G[G.target.team].picks.find(Boolean);return pk?GU.find(pk.clubId,pk.playerId):null;})();if(!r)return;
 const sq=G.hover&&G.hoverTeam?G[G.hoverTeam]:G[G.target.team];const kit=D.groupOf(r.player.position)==='GK'?(()=>{const k=D.defaultKit('#ffb21f','#1d2733','#ffffff');k.sleeves='long';return k;})():GM.kit(sq.kit);
 const v=MD.Editors.view||{yaw:.5,pitch:.12,dist:3.4};v.yaw+=dt*.35;try{App.studio.renderStudio(r.player,r.club,kit,{dt,kitKey:'germ-'+sq.kit+'-'+r.player.position,yaw:v.yaw,pitch:v.pitch,dist:v.dist||3.4,keeper:D.groupOf(r.player.position)==='GK'});}catch(e){}
 $('gm-preview-name').textContent=`${r.player.name} · ${r.club.name} · OVR ${r.player.rating}${r.player.est&&r.player.est.rating?' (estimado)':''}`;};
GU.bind=function(){
 const panel=e=>{const sl=e.target.closest('[data-gslot]');const rm=e.target.closest('[data-gremove]');const sv=e.target.closest('[data-gsave]');const cl=e.target.closest('[data-gclear]');
  if(rm){const [k,i]=rm.dataset.gremove.split(':');G[k].picks[+i]=null;G.target={team:k,slot:+i};G.f.pos=+i===0?'GK':'';GU.render();return;}
  if(sv){const k=sv.dataset.gsave;const list=GM.load();const sq=U.deepClone(G[k]);const i=list.findIndex(x=>x.id===sq.id);if(i>=0)list[i]=sq;else list.push(sq);if(GM.save(list))App.toast('Seleção salva!');GU.renderSaved();return;}
  if(cl){const k=cl.dataset.gclear;G[k].picks=[null,null,null,null,null];G.target={team:k,slot:0};G.f.pos='GK';GU.render();return;}
  if(sl){const [k,i]=sl.dataset.gslot.split(':');G.target={team:k,slot:+i};G.f.pos=+i===0?'GK':(G.f.pos==='GK'?'':G.f.pos);G.f.page=0;const pk=G[k].picks[+i];G.hover=pk?GU.find(pk.clubId,pk.playerId):G.hover;G.hoverTeam=k;GU.render();}};
 const change=e=>{const t=e.target.closest('[data-gt]');if(!t)return;const sq=G[t.dataset.gt];const f=t.dataset.f;if(f==='name'){sq.name=t.value;if(!sq.shortTouched){sq.short=U.initials(t.value).slice(0,3);}}else if(f==='short'){sq.short=t.value.toUpperCase();sq.shortTouched=true;}else sq[f]=t.value;
  if(e.type==='change')GU.render();};
 for(const id of ['gm-team-a','gm-team-b']){$(id).addEventListener('click',panel);$(id).addEventListener('change',change);$(id).addEventListener('input',e=>{if(e.target.dataset.f==='name'||e.target.dataset.f==='short')change(e);});}
 $('gb-grid').addEventListener('click',e=>{const b=e.target.closest('[data-pick]');if(!b)return;const [c,p]=b.dataset.pick.split('|');GU.assign(c,p);});
 $('gb-grid').addEventListener('pointerover',e=>{const b=e.target.closest('[data-pick]');if(!b)return;const [c,p]=b.dataset.pick.split('|');G.hover=GU.find(c,p);G.hoverTeam=G.target.team;});
 $('gb-pager').addEventListener('click',e=>{const b=e.target.closest('[data-gpage]');if(!b)return;G.f.page+=+b.dataset.gpage;GU.renderGrid();});
 const fil=(id,key)=>$(id).addEventListener(id==='gb-search'?'input':'change',e=>{G.f[key]=e.target.value;G.f.page=0;if(key==='country'){G.f.league='';G.f.club='';}if(key==='league')G.f.club='';GU.renderFilters();GU.renderGrid();});
 fil('gb-search','q');fil('gb-country','country');fil('gb-league','league');fil('gb-club','club');fil('gb-pos','pos');fil('gb-sort','sort');
 $('gm-saved').addEventListener('click',e=>{const l=e.target.closest('[data-gload]');const d=e.target.closest('[data-gdel]');
  if(l){const [k,id]=l.dataset.gload.split('|');const s=GM.load().find(x=>x.id===id);if(!s)return;const other=G[k==='A'?'B':'A'];const sq=U.deepClone(s);const tk=new Set(other.picks.filter(Boolean).map(p=>p.playerId));sq.picks=sq.picks.map(p=>p&&tk.has(p.playerId)?null:p);if(sq.picks.some(p=>!p))App.toast('Jogadores repetidos com o adversário foram removidos.');G[k]=sq;GU.render();}
  if(d){if(!confirm('Excluir esta seleção salva?'))return;GM.save(GM.load().filter(x=>x.id!==d.dataset.gdel));GU.renderSaved();}});
 const rule=(id,key,conv)=>$(id).addEventListener('change',e=>{App.settings.germinare[key]=conv(e.target);App.applySettings();$('gm-rule-min').textContent=App.settings.germinare.minutes;$('gm-rule-goals').textContent=App.settings.germinare.goalsToWin||'∞';});
 rule('gm-minutes','minutes',t=>+t.value);rule('gm-goals','goalsToWin',t=>+t.value);rule('gm-pens','penalties',t=>t.value==='1');rule('gm-restart','restart',t=>t.value);rule('gm-pace','pace',t=>t.value);rule('gm-cinema','cinema',t=>t.checked);
 $('gm-random').addEventListener('click',()=>GU.random());$('gm-start').addEventListener('click',()=>GU.start());};
})(window.MD=window.MD||{});
