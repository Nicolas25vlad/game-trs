/* MATCHDAY 0.5 — editor de clube (identidade com país/liga/UF/fonte; adicionar e remover atletas) (identidade, elenco, táticas, uniformes) e criador de jogador 3D
   (rosto, 21 cabelos, 10 barbas, corpo, acessórios, atributos com overall calculado, prévia de expressões e animações). */
(function(MD){
'use strict';
const U=MD.U,D=MD.Data,A=MD.Anim,App=MD.App,$=id=>document.getElementById(id),esc=U.escape;
const ED=MD.Editors={};
let draft=null,editingId=null;
/* ================= EDITOR DE CLUBE ================= */
ED.openClub=function(id,opts){editingId=id;draft=id?U.deepClone(App.club(id)):D.newClub();D.ensureClub(draft);
 if(!id){const o=opts||{};draft.country=o.country||draft.country||'MD';draft.league=o.league||(MD.Catalog.leaguesOf(draft.country)[0]||{}).id||'meus-clubes';draft.real=false;draft.fictional=true;}
 $('ce-title').textContent=id?'Editar clube':'Criar clube';ED.fillIdent();ED.tab('ident');App.openModal('club-modal');};
ED.tab=function(t){document.querySelectorAll('#ce-tabs .tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===t));for(const k of ['ident','squad','tactics','kits'])$('ce-'+k).hidden=k!==t;
 if(t==='squad')ED.renderSquad();if(t==='tactics')ED.renderTactics();if(t==='kits')ED.renderKitCards();};
ED.fillIdent=function(){$('ce-name').value=draft.name;$('ce-short').value=draft.short;$('ce-city').value=draft.city;$('ce-stadium').value=draft.stadiumName||'';ED.fillGeo();$('ce-uf').value=draft.state||'';$('ce-real').checked=!!draft.real;
 const src=draft.source;$('ce-source').innerHTML=draft.real?`Fonte do elenco: ${esc(src&&src.text||'—')}${src&&src.date?' · consultado em '+esc(src.date):''}${draft.partial?' · <b>elenco parcial</b>':''}. Atributos e overall são <b>estimativas do MATCHDAY</b>, não avaliações oficiais de nenhum jogo.${MD.Catalog.isDefault(draft.id)?' Suas edições ficam salvas à parte e podem ser desfeitas em “Restaurar padrão”.':''}`:'Clube criado/fictício: todos os dados são editáveis.';for(const k of ['primary','secondary','keeper'])$('ce-'+k).value=draft[k];ED.refreshIdent();};
ED.fillGeo=function(){const CAT=MD.Catalog;$('ce-country').innerHTML=CAT.countries.map(c=>`<option value="${esc(c.id)}" ${c.id===draft.country?'selected':''}>${c.flag||''} ${esc(c.name)}</option>`).join('');
 const ls=CAT.leaguesOf(draft.country);if(!ls.some(l=>l.id===draft.league))draft.league=(ls[0]||{}).id||'meus-clubes';
 $('ce-league').innerHTML=(ls.length?ls:[{id:'meus-clubes',name:'Meus clubes'}]).map(l=>`<option value="${esc(l.id)}" ${l.id===draft.league?'selected':''}>${esc(l.name)}</option>`).join('');};
ED.refreshIdent=function(){$('ce-crest').innerHTML=`<img src="${App.crest(draft)}" alt="Escudo">`;$('ce-ovr').textContent=D.teamOverall(draft);};
ED.renderSquad=function(){const row=(p,i,bench)=>`<div class="sq-row" data-i="${i}" data-b="${bench?1:0}"><input type="number" min="1" max="99" value="${p.number}" data-f="number" aria-label="Número"/>
  <label class="sq-photo" title="Enviar foto">${App.avatar(p)}<input type="file" accept="image/*" data-f="photo"/></label><input value="${esc(p.name)}" maxlength="38" data-f="name" aria-label="Nome"/>
  ${bench?`<select data-f="position" class="sq-pos">${['GOL','LD','ZAG','LE','VOL','MC','MEI','PD','PE','ATA'].map(x=>`<option ${x===p.position?'selected':''}>${x}</option>`).join('')}</select>`:`<span class="pos-chip pos-${App.posGroup(p.position)} sq-pos">${esc(p.position)}</span>`}
  <input class="sq-ovr" type="number" min="30" max="99" value="${p.rating}" data-f="rating" title="Overall ${p.est&&p.est.rating?'estimado pelo MATCHDAY':''} (ajusta os atributos)"/>
  <div style="display:flex;gap:4px"><button class="btn ghost small" data-f="edit">EDITAR</button>${bench?`<button class="btn ghost small" data-f="del" title="Remover atleta">✕</button>`:''}${p.unverified?'<span class="tag warn" title="Atleta não verificado em fonte pública">?</span>':''}${bench?`<select data-f="swap" title="Trocar com titular"><option value="">⇅</option>${draft.players.map((s,j)=>`<option value="${j}">${s.number} ${esc(s.name.split(' ').pop())}</option>`).join('')}</select>`:''}</div></div>`;
 $('ce-starters').innerHTML=draft.players.map((p,i)=>row(p,i,false)).join('');$('ce-bench').innerHTML=draft.bench.map((p,i)=>row(p,i,true)).join('')+`<div class="btn-row" style="margin-top:8px"><button class="btn ghost small" id="ce-add-player" ${draft.bench.length>=45?'disabled':''}>+ ADICIONAR ATLETA</button><small class="hint">${draft.players.length+draft.bench.length} atletas · máx. 56</small></div>`;$('ce-ovr').textContent=D.teamOverall(draft);};
ED.renderTactics=function(){$('ce-tactic-form').innerHTML=App.tacticSelects(draft,'draft');App.drawFormation($('ce-tactic-canvas'),[draft]);};
ED.renderKitCards=function(){const names={home:'1º UNIFORME',away:'2º UNIFORME',third:'3º UNIFORME',gk:'GOLEIRO'};
 $('ce-kit-cards').innerHTML=Object.keys(names).map(k=>`<div class="kit-card"><canvas width="220" height="250" data-kc="${k}"></canvas><b>${names[k]}</b><button class="btn ghost small" data-kopen="${k}">ABRIR ESTÚDIO</button></div>`).join('');
 document.querySelectorAll('[data-kc]').forEach(cv=>App.kitThumb(cv,draft.kits[cv.dataset.kc],draft));};
ED.player=(i,bench)=>bench?draft.bench[i]:draft.players[i];
ED.saveClub=function(){const name=$('ce-name').value.trim();if(name.length<2){App.toast('Digite um nome para o clube.');ED.tab('ident');return;}
 draft.name=name.slice(0,30);draft.short=($('ce-short').value.trim()||U.initials(name)).slice(0,3).toUpperCase();draft.city=$('ce-city').value.trim()||'Cidade';draft.stadiumName=$('ce-stadium').value.trim()||'Arena MATCHDAY';draft.country=$('ce-country').value||draft.country;draft.league=$('ce-league').value||draft.league;draft.state=$('ce-uf').value.trim();draft.real=$('ce-real').checked;draft.fictional=!draft.real;
 const nums=new Set();for(const p of [...draft.players,...draft.bench]){if(nums.has(p.number)){App.toast(`Número ${p.number} repetido no elenco.`);ED.tab('squad');return;}nums.add(p.number);}
 D.ensureClub(draft);if(editingId){const i=App.clubs.findIndex(c=>c.id===editingId);if(i>=0)App.clubs[i]=draft;}else App.clubs.push(draft);App.save(draft.id);App.closeModal('club-modal');App.renderClubs();App.toast('Clube salvo!');};
ED.bindClub=function(){$('ce-tabs').onclick=e=>{const b=e.target.closest('[data-tab]');if(b)ED.tab(b.dataset.tab);};
 $('ce-name').oninput=e=>{draft.name=e.target.value;if(!$('ce-short').value||$('ce-short').dataset.auto!=='0'){draft.short=U.initials(draft.name).slice(0,3);$('ce-short').value=draft.short;}ED.refreshIdent();};
 $('ce-country').onchange=e=>{draft.country=e.target.value;ED.fillGeo();};$('ce-league').onchange=e=>{draft.league=e.target.value;};
 $('ce-short').oninput=e=>{e.target.dataset.auto='0';draft.short=e.target.value.toUpperCase();ED.refreshIdent();};
 for(const k of ['primary','secondary','keeper'])$('ce-'+k).oninput=e=>{draft[k]=e.target.value;ED.refreshIdent();};
 $('ce-crest-file').onchange=async e=>{try{draft.crest=D.Assets.put(await App.processImage(e.target.files[0],'crest'));ED.refreshIdent();App.toast('Escudo carregado!');}catch(err){App.toast(err.message);}e.target.value='';};
 $('ce-crest-remove').onclick=()=>{draft.crest=null;ED.refreshIdent();};
 const sq=e=>{const r=e.target.closest('.sq-row');if(!r)return null;return{r,p:ED.player(+r.dataset.i,r.dataset.b==='1'),i:+r.dataset.i,bench:r.dataset.b==='1',f:e.target.dataset.f};};
 $('ce-squad').addEventListener('input',e=>{const s=sq(e);if(!s)return;if(s.f==='name')s.p.name=e.target.value;if(s.f==='number')s.p.number=U.clamp(Math.round(+e.target.value||1),1,99);});
 $('ce-squad').addEventListener('change',async e=>{const s=sq(e);if(!s)return;
  if(s.f==='rating'){D.fitAttrs(s.p.attrs,s.p.position,U.clamp(Math.round(+e.target.value||60),30,99));s.p.rating=D.computeOverall(s.p.attrs,s.p.position);ED.renderSquad();}
  if(s.f==='position'){s.p.position=e.target.value;s.p.rating=D.computeOverall(s.p.attrs,s.p.position);ED.renderSquad();}
  if(s.f==='photo'){try{s.p.photo=D.Assets.put(await App.processImage(e.target.files[0],'player'));ED.renderSquad();App.toast('Foto atualizada!');}catch(err){App.toast(err.message);}}
  if(s.f==='swap'&&e.target.value!==''){const j=+e.target.value;const st=draft.players[j],bn=draft.bench[s.i];const sp=st.position;draft.players[j]=bn;draft.bench[s.i]=st;bn.position=sp;st.position=D.LEGACY_POSITIONS.includes(st.position)?st.position:st.position;
   bn.rating=D.computeOverall(bn.attrs,bn.position);st.rating=D.computeOverall(st.attrs,st.position);ED.renderSquad();App.toast('Jogadores trocados.');}});
 $('ce-squad').addEventListener('click',e=>{if(e.target.id==='ce-add-player'){const used=new Set([...draft.players,...draft.bench].map(p=>p.number));let n=1;while(used.has(n)&&n<99)n++;
   const p=D.makePlayer(draft.id+':'+Date.now(),draft.bench.length+30,'MC',n,60,'Novo Atleta');p.id=U.uid('p');draft.bench.push(p);ED.renderSquad();App.toast('Atleta adicionado às reservas. Edite nome e posição.');return;}
  const s=sq(e);if(s&&s.f==='del'){if(!confirm(`Remover ${s.p.name} do elenco?`))return;draft.bench.splice(s.i,1);ED.renderSquad();return;}
  if(!s||s.f!=='edit')return;ED.openPlayer(s.p,draft,()=>{ED.renderSquad();});});
 $('ce-tactics').addEventListener('change',e=>{const s=e.target.closest('[data-tac]');if(!s)return;if(s.dataset.tac==='formation')D.setFormation(draft,s.value);else draft.tactics[s.dataset.tac]=s.value;ED.renderTactics();});
 $('ce-kits').addEventListener('click',e=>{const b=e.target.closest('[data-kopen]');if(b)MD.KitStudio.open(draft,{kit:b.dataset.kopen,onApply:()=>ED.renderKitCards()});});
 $('ce-save').onclick=ED.saveClub;};
/* ================= CRIADOR DE JOGADOR ================= */
let pd=null,pTarget=null,pClub=null,pDone=null,pTab='perfil';
const view={yaw:.35,pitch:.1,dist:3.6,focus:'body',emotion:null,clip:null};ED.view=view;
const SWATCH=['#f6d2b8','#f1c6a4','#e3b991','#d29b72','#be855e','#a8714c','#8b5239','#6e3f2b','#5e3726','#3f2418'];
const HAIRSW=['#0f0f10','#27211d','#482b23','#6b4226','#80562d','#b3803e','#d9b35b','#e6d28c','#c2c2c2','#f2f2f2','#a8322a','#2b5fd9','#d8389b','#3ecf6e'];
const PRESETS={normal:['Futebolista',{headSize:1.08,bodyWidth:1,legLength:1,height:1,bodyShape:'normal',headShape:'round',belly:0}],chibi:['Cabeçudo',{headSize:1.95,bodyWidth:1.05,legLength:.72,height:.9,bodyShape:'round',headShape:'round'}],
 square:['Quadradão',{headSize:1.6,headWidth:1.25,bodyWidth:1.6,legLength:.9,bodyShape:'square',headShape:'square'}],star:['Estrela',{headSize:1.2,bodyWidth:1.5,legLength:.66,bodyShape:'star',headShape:'round'}],
 sponge:['Esponja',{headSize:.9,headWidth:1.2,bodyWidth:1.7,legLength:.62,torso:1.25,bodyShape:'sponge',headShape:'square'}],giant:['Gigante',{height:1.55,headSize:.95,bodyWidth:1.15,legLength:1.15,bodyShape:'strong'}],
 short:['Baixinho',{height:.74,headSize:1.25,legLength:.85,bodyShape:'normal'}],wide:['Largo',{bodyWidth:1.75,belly:1.2,shoulders:1.3,bodyShape:'round',forearm:1.3}],slim:['Magrelo',{bodyWidth:.65,shoulders:.85,height:1.12,legThick:.75,bodyShape:'slim'}]};
ED.openPlayer=function(player,club,done){pTarget=player;pClub=club;pDone=done;pd=U.deepClone(player);pd.appearance=D.sanitizeAppearance(pd.appearance,0);
 $('pe-title').textContent=pd.name;view.emotion=null;view.clip=null;view.focus='body';view.yaw=.35;view.dist=3;$('pe-zoom').value=3;
 $('pe-presets').innerHTML=Object.entries(PRESETS).map(([k,v])=>`<button data-preset="${k}">${v[0]}</button>`).join('');
 $('pe-emotes').innerHTML=Object.entries(A.EMO_LABEL).map(([k,v])=>`<button data-emo="${k}">${v}</button>`).join('');
 $('pe-anims').innerHTML=[['','Parado'],['arms_up','Braços para cima'],['knee_slide','Joelhada'],['dance','Dança'],['punch_air','Soco no ar'],['heart','Coração'],['robot','Robô'],['shot_power','Chute'],['skill_stepover','Pedalada'],['skill_elastico','Elástico'],['header','Cabeceio'],['gk_dive','Mergulho'],['fall_trip','Queda'],['protest','Reclamação']].map(([k,v])=>`<button data-anim="${k}" class="${k===''?'active':''}">${v}</button>`).join('');
 App.attachStudio('pe-slot','player');ED.peTab('perfil');App.openModal('player-modal');};
const slider=(key,label,min,max,step=.05)=>{const v=pd.appearance[key];return`<label class="sl">${label}<output>${Number(v).toFixed(2)}x</output><input type="range" min="${min}" max="${max}" step="${step}" value="${v}" data-app="${key}"/></label>`;};
const chips=(key,list)=>`<div class="chips full">${list.map(([k,l])=>`<button data-chip="${key}" data-v="${k}" class="${pd.appearance[key]===k?'active':''}">${l}</button>`).join('')}</div>`;
const color=(key,label,sw)=>`<label>${label}<input type="color" value="${pd.appearance[key]||'#ffffff'}" data-app="${key}"/></label>${sw?`<div class="chips full">${sw.map(c=>`<button data-sw="${key}" data-v="${c}" style="background:${c};width:28px;height:24px;padding:0" aria-label="${c}"></button>`).join('')}</div>`:''}`;
ED.peTab=function(t){pTab=t;document.querySelectorAll('#pe-tabs .tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===t));const a=pd.appearance,b=$('pe-body');
 const R=D.APPEARANCE_NUM;const s=(k,l)=>slider(k,l,R[k][0],R[k][1]);
 if(t==='perfil')b.innerHTML=`<div class="fgrid"><label class="full">Nome<input value="${esc(pd.name)}" data-p="name" maxlength="38"/></label><label>Número<input type="number" min="1" max="99" value="${pd.number}" data-p="number"/></label><label>Posição<input value="${esc(pd.position)}" disabled/></label>
  <label>Personalidade (comemorações)<select data-p="personality">${D.PERSONALITIES.map(([k,l])=>`<option value="${k}" ${pd.personality===k?'selected':''}>${l}</option>`).join('')}</select></label><label>Pé preferido<select data-p="foot"><option value="R" ${pd.foot==='R'?'selected':''}>Direito</option><option value="L" ${pd.foot==='L'?'selected':''}>Esquerdo</option></select></label>
  <label>Número da chuteira<input type="number" min="30" max="52" value="${a.bootSize}" data-app="bootSize"/></label><label>Foto do jogador<input type="file" accept="image/*" data-p="photo"/></label></div><p class="hint" style="margin-top:12px">A personalidade define o estilo das comemorações; a importância do gol define a intensidade.</p>`;
 if(t==='rosto')b.innerHTML=`<div class="fgrid"><div class="full"><b class="hint">FORMATO DO ROSTO</b></div>${chips('headShape',D.HEADS)}${color('skin','Cor da pele',SWATCH)}${color('eyeColor','Cor dos olhos')}${color('mouthColor','Cor dos lábios')}
  ${s('headSize','Tamanho da cabeça')}${s('headWidth','Largura da cabeça')}${s('jaw','Mandíbula')}${s('chin','Queixo')}${s('nose','Nariz')}${s('ears','Orelhas')}${s('eyeSize','Olhos')}${s('brows','Sobrancelhas')}</div>`;
 if(t==='cabelo')b.innerHTML=`<div class="fgrid">${chips('hairStyle',D.HAIR)}${color('hairColor','Cor do cabelo',HAIRSW)}${s('hairVolume','Volume / tamanho')}</div>`;
 if(t==='barba')b.innerHTML=`<div class="fgrid">${chips('beardStyle',D.BEARD)}${color('beardColor','Cor da barba (separada)',HAIRSW)}</div>`;
 if(t==='corpo')b.innerHTML=`<div class="fgrid"><div class="full"><b class="hint">ESTILO DE CORPO</b></div>${chips('bodyShape',D.BODIES)}${s('height','Altura')}${s('shoulders','Ombros')}${s('bodyWidth','Largura do tronco')}${s('torso','Comprimento do tronco')}${s('belly','Barriga')}${s('armLength','Braços')}${s('forearm','Antebraços')}${s('hands','Mãos')}${s('legLength','Pernas')}${s('legThick','Espessura das pernas')}${s('feet','Pés')}</div>`;
 if(t==='extras')b.innerHTML=`<div class="fgrid">${['headband','wristbands','thermal'].map(k=>`<label class="switch"><input type="checkbox" data-toggle="${k}" ${a[k]?'checked':''}/><span>${{headband:'Faixa de cabelo',wristbands:'Munhequeiras',thermal:'Mangas térmicas'}[k]}</span></label><label>Cor<input type="color" value="${a[k]||'#ffffff'}" data-app="${k}" ${a[k]?'':'disabled'}/></label>`).join('')}
  ${color('bootColor','Chuteira (cor principal)')}${color('bootColor2','Chuteira (sola e detalhes)')}</div>`;
 if(t==='atributos'){const groups={fis:'Físico',ata:'Ataque',men:'Mental',tec:'Técnica',def:'Defesa',gol:'Goleiro'};const ovr=D.computeOverall(pd.attrs,pd.position);
  b.innerHTML=`<div class="ovr-live"><b id="pe-ovr">${ovr}</b><div><div class="hint">OVERALL calculado pelos atributos e pela posição <b>${esc(pd.position)}</b></div><div style="display:flex;gap:6px;margin-top:6px"><input type="number" id="pe-fit" min="30" max="99" value="${ovr}" style="width:80px"/><button class="btn ghost small" id="pe-fit-btn">AJUSTAR ATRIBUTOS PARA ESSE OVR</button></div></div></div>`+
  Object.entries(groups).map(([g,l])=>`<div class="attr-group"><h4>${l}</h4>${D.ATTRS.filter(x=>x[2]===g).map(([k,lab])=>`<div class="attr"><span>${lab}</span><input type="range" min="1" max="99" value="${pd.attrs[k]}" data-attr="${k}"/><b>${pd.attrs[k]}</b></div>`).join('')}</div>`).join('');}};
ED.bindPlayer=function(){$('pe-tabs').onclick=e=>{const b=e.target.closest('[data-tab]');if(b)ED.peTab(b.dataset.tab);};
 const body=$('pe-body');
 body.addEventListener('input',e=>{const t=e.target;if(t.dataset.app){const k=t.dataset.app;pd.appearance[k]=t.type==='range'||t.type==='number'?+t.value:t.value;const o=t.parentElement.querySelector('output');if(o)o.textContent=(+t.value).toFixed(2)+'x';}
  if(t.dataset.p==='name'){pd.name=t.value;$('pe-title').textContent=t.value;}if(t.dataset.p==='number')pd.number=U.clamp(Math.round(+t.value||1),1,99);
  if(t.dataset.attr){pd.attrs[t.dataset.attr]=+t.value;t.nextElementSibling.textContent=t.value;const o=D.computeOverall(pd.attrs,pd.position);$('pe-ovr').textContent=o;}});
 body.addEventListener('change',async e=>{const t=e.target;if(t.dataset.p==='personality'||t.dataset.p==='foot')pd[t.dataset.p]=t.value;
  if(t.dataset.p==='photo'){try{pd.photo=D.Assets.put(await App.processImage(t.files[0],'player'));App.toast('Foto carregada!');}catch(err){App.toast(err.message);}}
  if(t.dataset.toggle){const k=t.dataset.toggle;pd.appearance[k]=t.checked?(pd.appearance[k]||(k==='thermal'?'#1d2733':'#ffffff')):'';ED.peTab('extras');}});
 body.addEventListener('click',e=>{const c=e.target.closest('[data-chip]');if(c){pd.appearance[c.dataset.chip]=c.dataset.v;c.parentElement.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===c));}
  const sw=e.target.closest('[data-sw]');if(sw){pd.appearance[sw.dataset.sw]=sw.dataset.v;ED.peTab(pTab);}
  if(e.target.id==='pe-fit-btn'){D.fitAttrs(pd.attrs,pd.position,U.clamp(+$('pe-fit').value||60,30,99));ED.peTab('atributos');}});
 $('pe-presets').onclick=e=>{const b=e.target.closest('[data-preset]');if(!b)return;const base=D.defaultAppearance(0);const keep={skin:pd.appearance.skin,hairColor:pd.appearance.hairColor,hairStyle:pd.appearance.hairStyle,beardStyle:pd.appearance.beardStyle,beardColor:pd.appearance.beardColor,eyeColor:pd.appearance.eyeColor,bootColor:pd.appearance.bootColor};
  pd.appearance=D.sanitizeAppearance({...base,...keep,...PRESETS[b.dataset.preset][1]},0);ED.peTab(pTab);};
 $('pe-emotes').onclick=e=>{const b=e.target.closest('[data-emo]');if(!b)return;view.emotion=view.emotion===b.dataset.emo?null:b.dataset.emo;$('pe-emotes').querySelectorAll('button').forEach(x=>x.classList.toggle('active',x.dataset.emo===view.emotion));if(view.emotion){view.focus='head';view.dist=1.3;view.yaw=.15;view.pitch=.05;}};
 $('pe-anims').onclick=e=>{const b=e.target.closest('[data-anim]');if(!b)return;view.clip=b.dataset.anim||null;$('pe-anims').querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));view.focus='body';view.dist=Math.max(view.dist,3.6);};
 document.querySelector('#pe-viewer .viewer-tools').onclick=e=>{const b=e.target.closest('[data-view]');if(!b)return;const v=b.dataset.view;view.focus=v==='face'?'head':'body';view.yaw={front:0,back:Math.PI,left:Math.PI/2,right:-Math.PI/2,face:.2}[v];view.dist=v==='face'?1.25:3;view.pitch=v==='face'?.05:.1;$('pe-zoom').value=view.dist;};
 $('pe-zoom').oninput=e=>{view.dist=+e.target.value;};
 $('pe-apply').onclick=()=>{pd.rating=D.computeOverall(pd.attrs,pd.position);Object.assign(pTarget,U.deepClone(pd));App.closeModal('player-modal');if(pDone)pDone();App.toast('Jogador atualizado! Salve o clube para guardar.');};};
ED.studioFrame=function(R,dt){if(!pd)return;const kit=pd.position==='GOL'?pClub.kits.gk:pClub.kits.home;R.renderStudio(pd,pClub,kit,{dt,yaw:view.yaw,pitch:view.pitch,dist:view.dist,focus:view.focus,emotion:view.emotion,clip:view.clip,clipDur:view.clip&&/gk_dive|fall/.test(view.clip)?3:2.2,keeper:pd.position==='GOL',kitKey:'pe-'+(pd.position==='GOL'?'gk':'home')+JSON.stringify(kit).length});};
ED.bind=function(){ED.bindClub();ED.bindPlayer();};
})(window.MD=window.MD||{});
