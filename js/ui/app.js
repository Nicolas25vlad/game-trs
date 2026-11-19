/* MATCHDAY 0.5 — interface: estado global, navegação, menu, seleção por país/liga, pré-jogo, navegador de clubes
   (País → Liga → Clube), comparação, ligas personalizadas e configurações. */
(function(MD){
'use strict';
const U=MD.U,D=MD.Data,K=MD.Kit,CAT=MD.Catalog,$=id=>document.getElementById(id),esc=U.escape;
const App=MD.App={clubs:[],settings:null,homeId:null,awayId:null,screen:'menu',renderer:null,isWebGL:false,studio:null,
 sel:{side:'home',country:'BR',league:'br-a',q:''},cb:{country:'BR',league:'br-a',q:'',compare:false}};
App.$=$;
/* ---------- utilidades ---------- */
let toastT=null;App.toast=function(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('show'),3200);};
App.club=id=>App.clubs.find(c=>c.id===id)||App.clubs[0];
App.save=function(changedId){if(changedId){const c=App.clubs.find(x=>x.id===changedId);if(c&&CAT.isDefault(c.id))c.edited=true;}const ok=CAT.save(App.clubs,changedId);if(!ok)App.toast('Sem espaço para salvar tudo. Exporte seus clubes e reduza imagens.');return ok;};
App.crest=function(club){if(!club)return'';if(club.crest){const u=D.Assets.url(club.crest);if(u)return u;}const t=esc((club.short||U.initials(club.name||'?')).slice(0,3));const p=club.primary||'#3a5',s=club.secondary||'#fff';
 const dark=U.luma?U.luma(p)>.6:false;
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 116 137"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="${p}"/><stop offset="1" stop-color="${s}"/></linearGradient></defs><path d="M58 3L108 20V77C108 102 83 123 58 134C33 123 8 102 8 77V20Z" fill="url(#g)" stroke="#0b1622" stroke-width="5"/><path d="M58 14L98 27V76C98 96 79 113 58 122C37 113 18 96 18 76V27Z" fill="none" stroke="${dark?'#0b1622':'#ffffff'}" stroke-opacity=".45" stroke-width="2.5"/><text x="58" y="82" text-anchor="middle" font-family="Arial Black,Arial" font-weight="900" font-size="${t.length>2?30:36}" fill="${dark?'#0b1622':'#ffffff'}" stroke="${dark?'#ffffff':'#0b1622'}" stroke-opacity=".35" stroke-width="1.5">${t}</text></svg>`;
 return'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);};
App.photo=p=>p&&p.photo?D.Assets.url(p.photo):null;
App.avatar=p=>{const u=App.photo(p);return u?`<img src="${u}" alt="">`:esc(U.initials(p.name));};
App.posGroup=pos=>{const g=D.groupOf(pos);return g==='GK'?'GK':g==='CB'||g==='FB'?'DEF':g==='W'||g==='ST'?'ATT':'MID';};
App.posLabel=pos=>(MD.Modes.POS_LABEL[pos]||pos);
App.kitThumb=function(canvas,kit,club,side){if(!canvas||!kit)return;if(!canvas._tex)canvas._tex=document.createElement('canvas'),canvas._tex.width=canvas._tex.height=512;K.paint(canvas._tex,kit,club.crest);K.drawShirt(canvas,kit,club.crest,{tex:canvas._tex,side:side||'front'});};
App.leagueName=id=>{const l=CAT.league(id);return l?l.name:'—';};
App.countryOf=c=>CAT.country(c.country)||{name:c.country||'—',flag:''};
App.trophySVG=function(size){return`<svg viewBox="0 0 120 160" width="${size||120}" height="${(size||120)*4/3}" aria-hidden="true"><defs><linearGradient id="tg" x1="0" x2="1"><stop stop-color="#ffd76a"/><stop offset=".5" stop-color="#fff2b8"/><stop offset="1" stop-color="#e2a92c"/></linearGradient></defs>
 <path d="M30 18h60v18c0 26-12 42-30 46-18-4-30-20-30-46z" fill="url(#tg)" stroke="#9c6b10" stroke-width="2"/><path d="M30 26H14c0 18 8 28 20 30M90 26h16c0 18-8 28-20 30" fill="none" stroke="url(#tg)" stroke-width="7" stroke-linecap="round"/>
 <rect x="54" y="82" width="12" height="26" fill="url(#tg)"/><circle cx="60" cy="86" r="8" fill="url(#tg)"/><rect x="34" y="108" width="52" height="10" rx="3" fill="#c8ff3d"/><rect x="28" y="118" width="64" height="26" rx="4" fill="#123a2c"/><rect x="28" y="140" width="64" height="6" rx="2" fill="url(#tg)"/>
 <path d="M60 2l4 8 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1z" fill="#c8ff3d"/><text x="60" y="135" text-anchor="middle" font-family="Arial Black,Arial" font-size="11" fill="#c8ff3d">MATCHDAY</text></svg>`;};
App.processImage=async function(file,kind){if(!file)throw Error('Nenhum arquivo.');if(!/^image\/(png|jpeg|webp|gif|svg\+xml)$/.test(file.type))throw Error('Formato não suportado. Use PNG, JPG, WEBP ou GIF.');if(file.size>8*1024*1024)throw Error('Imagem muito grande (máx. 8 MB).');
 const url=await new Promise((res,rej)=>{const r=new FileReader();r.onerror=()=>rej(Error('Falha ao ler a imagem.'));r.onload=()=>res(r.result);r.readAsDataURL(file);});
 const img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(Error('Imagem inválida.'));i.src=url;});
 const max={crest:256,player:180,sponsor:320,template:1024,paint:512}[kind]||512;const r=Math.min(1,max/Math.max(img.width,img.height));const c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.width*r));c.height=Math.max(1,Math.round(img.height*r));
 c.getContext('2d').drawImage(img,0,0,c.width,c.height);return c.toDataURL(kind==='player'||kind==='template'&&!/png|gif|webp/.test(file.type)?'image/jpeg':'image/png',.86);};
App.download=function(name,text){const blob=new Blob([text],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);};
App.slug=s=>String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'clube';
/* ---------- navegação ---------- */
App.go=function(name){if(App.screen==='match'&&name!=='match'&&MD.Match.active())MD.Match.pause(true);
 document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('active',s.id==='screen-'+name));
 const navOf={prematch:'select',match:'select',post:'select'};document.querySelectorAll('.nav-link,#bottom-nav button').forEach(b=>b.classList.toggle('active',b.dataset.go===(navOf[name]||name)));
 const prev=App.screen;App.screen=name;document.body.dataset.screen=name;
 if(name==='menu')App.renderMenu();if(name==='select')App.renderSelect();if(name==='prematch')App.renderPrematch();if(name==='clubs')App.renderClubs();if(name==='settings')App.renderSettings();
 if(name==='germinare'&&MD.GermUI)MD.GermUI.render();if(name==='copa'&&MD.CopaUI)MD.CopaUI.render();if(prev==='germinare'&&name!=='germinare'&&MD.GermUI)MD.GermUI.leave();
 window.scrollTo({top:0,behavior:'smooth'});};
/* ---------- menu ---------- */
App.renderMenu=function(){const h=App.club(App.homeId),a=App.club(App.awayId);$('menu-last').textContent=h&&a?`Último confronto: ${h.name} × ${a.name}`:'';
 $('menu-trophy').innerHTML=App.trophySVG(110);const active=MD.Tournament.list().filter(t=>t.stage!=='done');$('mt-copa-badge').hidden=!active.length;
 const feats=[['Modo Germinare','5 contra 5 no campo da escola · 5 minutos ou 2 gols','MONTAR MEU TIME ➜','germinare'],['Modo Copa','Chaveamento, prorrogação, pênaltis e cerimônia do campeão','CRIAR TORNEIO ➜','copa'],['Elencos 2026','40 clubes nas Séries A e B personalizadas, com fontes registradas','VER CLUBES ➜','clubs']];
 if(active.length)feats.unshift(['Torneio em andamento',active[0].name+' · continue de onde parou','CONTINUAR ➜','copa']);
 const f=feats[Math.floor(Date.now()/9000)%feats.length];$('mf-title').textContent=f[0];$('mf-sub').textContent=f[1];$('mf-go').textContent=f[2];$('mf-go').dataset.target=f[3];};
/* ---------- seleção (partida rápida) ---------- */
App.filterClubs=function(f){const q=String(f.q||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
 const fav=f.fav?CAT.favorites():null;return App.clubs.filter(c=>(!fav||fav.has(c.id))&&(!f.continent||CAT.continentOf(c.country)===f.continent)&&(!f.country||c.country===f.country)&&(!f.league||c.league===f.league)&&(!q||(c.name+' '+c.short+' '+(c.city||'')).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').includes(q)));};
App.countryChips=function(el,cur,key){const used=new Set(App.clubs.map(c=>c.country));const cont=key==='scountry'?App.sel.continent:'';el.innerHTML=(key==='scountry'?`<span class="chip-group">${['',...CAT.continents.map(c=>c.id)].map(id=>`<button class="chip cont ${(App.sel.continent||'')===id?'active':''}" data-scont="${id}">${id?esc(CAT.continents.find(c=>c.id===id).name):'Todos'}</button>`).join('')}<button class="chip fav ${App.sel.fav?'active':''}" data-sfav="1">★ Favoritos</button></span>`:'')+CAT.countries.filter(c=>!cont||(c.continent||'XX')===cont).filter(c=>used.has(c.id)||CAT.leaguesOf(c.id).length).map(c=>`<button class="chip ${c.id===cur?'active':''}" data-${key}="${esc(c.id)}">${c.flag||''} ${esc(c.name)}</button>`).join('');};
App.leagueTabs=function(el,country,cur,key){const ls=CAT.leaguesOf(country);el.innerHTML=`<button class="ltab ${!cur?'active':''}" data-${key}="">Todas</button>`+ls.map(l=>`<button class="ltab ${l.id===cur?'active':''} ${l.pending?'pending':''}" data-${key}="${esc(l.id)}" title="${esc(l.pending||'')}">${esc(l.name)} <small>${App.clubs.filter(c=>c.league===l.id).length}${l.pending?' · pendente':''}</small></button>`).join('');const pl=ls.find(l=>l.id===cur&&l.pending);if(pl)el.insertAdjacentHTML('beforeend',`<span class="hint pend-note">${esc(pl.pending)}</span>`);};
App.pickCard=function(el,side){const c=App.club(side==='home'?App.homeId:App.awayId);if(!c){el.innerHTML='';return;}const s=D.sectorRatings(c);const ovr=D.teamOverall(c);
 const stars=[...c.players,...c.bench].slice().sort((x,y)=>y.rating-x.rating).slice(0,3);el.style.setProperty('--c1',c.primary);el.style.setProperty('--c2',c.secondary);
 el.classList.toggle('picking',App.sel.side===side);
 el.innerHTML=`<div class="cp-band"></div><div class="cp-top"><span>${side==='home'?'<b>●</b> MANDANTE':'VISITANTE <b>●</b>'}</span><span>${esc(App.leagueName(c.league))}</span></div>
 <div class="cp-main"><div class="cp-nav"><div class="cp-crest"><img src="${App.crest(c)}" alt="Escudo ${esc(c.name)}"></div></div>
 <div class="cp-name">${esc(c.name)}</div><div class="cp-city">${esc(App.countryOf(c).flag||'')} ${esc(c.city||'')}${c.uf?' · '+esc(c.uf):''}</div>
 <div class="cp-row"><div class="cp-ovr">${ovr}<small>OVERALL</small></div><div class="cp-kits"><canvas width="124" height="140" data-k="home"></canvas><canvas width="124" height="140" data-k="away"></canvas><canvas width="124" height="140" data-k="gk"></canvas></div></div>
 <div class="sector"><div><span>GOL</span><b>${s.GK}</b></div><div><span>DEF</span><b>${s.DEF}</b></div><div><span>MEI</span><b>${s.MID}</b></div><div><span>ATA</span><b>${s.ATT}</b></div></div>
 <div class="cp-stars">${stars.map(p=>`<div class="star-row"><span class="pos-chip pos-${App.posGroup(p.position)}" style="width:40px">${esc(p.position)}</span>${esc(p.name)}<b>${p.rating}</b></div>`).join('')}</div>
 <div class="cp-foot">${c.players.length+c.bench.length} atletas · ${c.real?'dados 2026 pesquisados':'clube fictício/personalizado'}${c.partial?' · elenco parcial':''}</div></div>`;
 el.querySelectorAll('canvas[data-k]').forEach(cv=>App.kitThumb(cv,c.kits[cv.dataset.k],c));};
App.renderSelect=function(){const S=App.sel;if(App.homeId===App.awayId){const o=App.clubs.find(c=>c.id!==App.homeId);if(o)App.awayId=o.id;}
 App.pickCard($('pick-home'),'home');App.pickCard($('pick-away'),'away');document.querySelectorAll('#side-toggle button').forEach(b=>b.classList.toggle('active',b.dataset.side===S.side));
 const h=App.club(App.homeId),a=App.club(App.awayId),sh=D.sectorRatings(h),sa=D.sectorRatings(a);
 const row=(l,x,y)=>{const t=x+y||1;return`<div class="cmp-row"><div class="lbl"><span>${x}</span><span>${l}</span><span>${y}</span></div><div class="cmp-bar"><i style="width:${x/t*100}%"></i><i style="width:${y/t*100}%"></i></div></div>`;};
 $('compare').innerHTML=row('OVERALL',D.teamOverall(h),D.teamOverall(a))+row('ATAQUE',sh.ATT,sa.ATT)+row('MEIO',sh.MID,sa.MID)+row('DEFESA',sh.DEF,sa.DEF)+row('GOLEIRO',sh.GK,sa.GK);
 App.countryChips($('sel-countries'),S.country,'scountry');App.leagueTabs($('sel-leagues'),S.country,S.league,'sleague');
 const favs=CAT.favorites();const list=App.filterClubs(S).sort((x,y)=>D.teamOverall(y)-D.teamOverall(x));
 $('select-strip').innerHTML=list.map((c,i)=>`<button class="club-tile ${c.id===App.homeId?'h':c.id===App.awayId?'a':''}" data-strip="${esc(c.id)}" style="--c1:${c.primary};--c2:${c.secondary};animation-delay:${Math.min(i,20)*18}ms"><img src="${App.crest(c)}" alt=""><b>${esc(c.name)}</b><small>${esc(c.short)} · OVR ${D.teamOverall(c)}</small><span class="fav-star ${favs.has(c.id)?'on':''}" data-fav="${esc(c.id)}" role="button" aria-label="Favorito">★</span>${c.id===App.homeId?'<em>MANDANTE</em>':c.id===App.awayId?'<em>VISITANTE</em>':''}</button>`).join('')||'<p class="hint">Nenhum clube encontrado.</p>';};
/* ---------- pré-jogo ---------- */
const TAC={mentality:[['park','Retranca'],['defensive','Defensiva'],['balanced','Equilibrada'],['attacking','Ofensiva'],['allout','Tudo ao ataque']],pressing:[['low','Baixa'],['mid','Média'],['high','Alta']],style:[['balanced','Equilibrado'],['possession','Posse de bola'],['counter','Contra-ataque'],['direct','Jogo direto']],marking:[['zonal','Por zona'],['man','Individual']],width:[['narrow','Fechado'],['normal','Normal'],['wide','Aberto']]};
App.TAC=TAC;
App.tacticSelects=function(c,prefix,formations){const opt=(list,v)=>list.map(o=>`<option value="${o[0]}" ${o[0]===v?'selected':''}>${o[1]}</option>`).join('');const forms=formations||Object.keys(D.FORMATIONS);
 return`<label>Formação<select data-tac="formation" data-p="${prefix}">${forms.map(f=>`<option ${f===c.tactics.formation?'selected':''}>${f}</option>`).join('')}</select></label>
 <label>Mentalidade<select data-tac="mentality" data-p="${prefix}">${opt(TAC.mentality,c.tactics.mentality)}</select></label><label>Pressão<select data-tac="pressing" data-p="${prefix}">${opt(TAC.pressing,c.tactics.pressing)}</select></label>
 <label>Estilo<select data-tac="style" data-p="${prefix}">${opt(TAC.style,c.tactics.style)}</select></label><label>Marcação<select data-tac="marking" data-p="${prefix}">${opt(TAC.marking,c.tactics.marking)}</select></label><label>Amplitude<select data-tac="width" data-p="${prefix}">${opt(TAC.width,c.tactics.width)}</select></label>`;};
App.drawFormation=function(canvas,teams){const x=canvas.getContext('2d'),w=canvas.width,h=canvas.height;x.clearRect(0,0,w,h);for(let i=0;i<10;i++){x.fillStyle=i%2?'#1f6e44':'#237a4b';x.fillRect(0,i*h/10,w,h/10);}
 x.strokeStyle='#eaffefcc';x.lineWidth=2;x.strokeRect(14,14,w-28,h-28);x.beginPath();x.moveTo(14,h/2);x.lineTo(w-14,h/2);x.stroke();x.beginPath();x.arc(w/2,h/2,48,0,7);x.stroke();
 x.strokeRect(w/2-90,14,180,70);x.strokeRect(w/2-90,h-84,180,70);x.strokeRect(w/2-40,14,80,24);x.strokeRect(w/2-40,h-38,80,24);
 teams.forEach((c,ti)=>{const slots=D.formationSlots(c.tactics.formation);const small=!!MD.Modes.FORMATIONS_G[c.tactics.formation];const L=small?20:54,W=small?12.5:34;const kit=ti?K.pickKits(teams[0],c).away:c.kits.home;
  slots.forEach((s,i)=>{const p=c.players[i];if(!p)return;const half=teams.length>1;const fx=(s.x+L)/L;const yy=half?(ti?h*.05+fx*h*.36:h*.95-fx*h*.36):h*.95-fx*h*.8;const xx=w/2+(ti?-1:1)*s.z/W*(w/2-30);
   x.fillStyle=i===0?(ti?teams[1].kits.gk.primary:c.kits.gk.primary):kit.primary;x.strokeStyle='#0a1220';x.lineWidth=2;x.beginPath();x.arc(xx,yy,15,0,7);x.fill();x.stroke();
   x.fillStyle=K.numberColor(i===0?c.kits.gk:kit);x.font='900 13px Arial';x.textAlign='center';x.textBaseline='middle';x.fillText(p.number,xx,yy+1);
   x.fillStyle='#fff';x.font='700 11px Arial';x.fillText(String(p.name).split(' ').pop().slice(0,12),xx,yy+25);});});};
App.renderPrematch=function(){const h=App.club(App.homeId),a=App.club(App.awayId);$('pm-title').textContent=`${h.name} × ${a.name}`;$('pm-stadium').textContent=h.stadiumName||'Arena MATCHDAY';$('pm-stadium-sub').textContent='Arena MATCHDAY (3D) · 90 min + acréscimos';
 $('pm-rate').value=App.settings.highlightRate;$('pm-seed').value=App.settings.seed||'';$('pm-pace').value=App.settings.pace||'normal';$('pm-cinema').checked=App.settings.cinema!==false;
 for(const [side,c] of [['home',h],['away',a]]){const el=$('pm-'+side);el.innerHTML=`<div class="card pm-head"><img src="${App.crest(c)}" alt=""><div><h3>${esc(c.name)}</h3><small>${side==='home'?'Mandante':'Visitante'} · ${esc(c.tactics.formation)}</small></div><div class="pm-ovr">${D.teamOverall(c)}</div></div>
  <div class="card pm-tac">${App.tacticSelects(c,side)}</div>
  <div class="card pm-list">${c.players.map(p=>`<div class="pl-row"><span class="pl-num">${p.number}</span><span class="pos-chip pos-${App.posGroup(p.position)}">${esc(p.position)}</span><span class="pl-av">${App.avatar(p)}</span><span>${esc(p.name)}</span><span class="pl-ovr">${p.rating}</span></div>`).join('')}
  <div class="pl-row" style="color:var(--sub);font-size:11px"><span></span><span></span><span></span><span>BANCO DO DIA: ${D.matchdayBench(c.bench).map(b=>esc(b.name.split(' ').pop())+' ('+b.rating+')').join(', ')}</span><span></span></div></div>`;}
 App.drawFormation($('pm-canvas'),[h,a]);
 const key=(c)=>{const p=c.players.slice().sort((x,y)=>y.rating-x.rating)[0];return`<div class="key-card" style="--c1:${c.primary}"><div class="kc-ovr">${p.rating}</div><div><small>DESTAQUE · ${esc(c.short)}</small><b>${esc(p.name)}</b><small>${esc(p.position)} · ${({showman:'Showman',passionate:'Emotivo',humble:'Humilde',cool:'Frio',funny:'Brincalhão',leader:'Líder'})[p.personality]||''}</small></div></div>`;};
 $('pm-keys').innerHTML=key(h)+key(a);};
/* ---------- clubes: navegador País → Liga → Clube ---------- */
App.renderClubs=function(){const F=App.cb;const tree=CAT.countries.map(co=>{const leagues=CAT.leaguesOf(co.id);if(!leagues.length&&!App.clubs.some(c=>c.country===co.id))return'';
  return`<div class="tree-country"><button class="tc-head ${F.country===co.id&&!F.league?'active':''}" data-cbc="${esc(co.id)}">${co.flag||''} ${esc(co.name)} <small>${App.clubs.filter(c=>c.country===co.id).length}</small></button>
   ${leagues.map(l=>`<button class="tc-league ${F.league===l.id?'active':''}" data-cbl="${esc(l.id)}" data-cbc="${esc(co.id)}">${esc(l.name)} <small>${App.clubs.filter(c=>c.league===l.id).length}</small>${l.user?` <i data-cbdel="${esc(l.id)}" title="Excluir liga">✕</i>`:''}</button>`).join('')}</div>`;}).join('');
 $('cb-tree').innerHTML=tree;$('cb-league-country').innerHTML=CAT.countries.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')+'<option value="__new">+ Novo país…</option>';
 $('cb-data-note').textContent=CAT.meta?`Elencos reais: referência ${CAT.meta.referenceDate.split('-').reverse().join('/')} · ${CAT.meta.stats.players} atletas · overall e atributos são estimativas do MATCHDAY.`:'';
 const list=App.filterClubs(F).sort((x,y)=>(x.league||'').localeCompare(y.league||'')||D.teamOverall(y)-D.teamOverall(x));$('cb-count').textContent=`${list.length} clube(s)`;
 const leagueOpts=c=>CAT.leagues.map(l=>`<option value="${esc(l.id)}" ${l.id===c.league?'selected':''}>${esc((CAT.country(l.country)||{}).flag||'')} ${esc(l.name)}</option>`).join('');
 $('club-grid').innerHTML=list.map(c=>`<article class="club-card" style="--c1:${c.primary}"><div class="cc-top"><img src="${App.crest(c)}" alt=""><div class="cc-ovr">${D.teamOverall(c)}<small>OVERALL</small></div></div>
 <h3>${esc(c.name)}</h3><p>${esc(c.city||'')}${c.uf?' · '+esc(c.uf):''} · ${esc(c.tactics.formation)} · ${c.players.length+c.bench.length} atletas</p>
 <div class="cc-tags">${c.real?'<span class="tag real">REAL 2026</span>':'<span class="tag fict">FICTÍCIO</span>'}${c.partial?'<span class="tag warn">ELENCO PARCIAL</span>':''}${c.edited?'<span class="tag edit">EDITADO</span>':''}</div>
 <div class="cc-kits"><canvas width="92" height="104" data-ck="${esc(c.id)}" data-k="home"></canvas><canvas width="92" height="104" data-ck="${esc(c.id)}" data-k="away"></canvas><canvas width="92" height="104" data-ck="${esc(c.id)}" data-k="gk"></canvas></div>
 <label class="cc-league">Liga<select data-move="${esc(c.id)}">${leagueOpts(c)}</select></label>
 <div class="cc-actions"><button data-edit="${esc(c.id)}">EDITAR</button><button data-kits="${esc(c.id)}">KITS</button><button data-copy="${esc(c.id)}">COPIAR</button><button data-export="${esc(c.id)}">JSON</button>${c.edited&&CAT.isDefault(c.id)?`<button data-restore="${esc(c.id)}" style="grid-column:1/-1">RESTAURAR PADRÃO</button>`:''}${CAT.isDefault(c.id)?'':`<button class="del" data-del="${esc(c.id)}" style="grid-column:1/-1">EXCLUIR</button>`}</div></article>`).join('')||'<p class="hint">Nenhum clube nesta liga ainda. Crie um clube ou mova clubes para cá.</p>';
 document.querySelectorAll('canvas[data-ck]').forEach(cv=>{const c=App.club(cv.dataset.ck);App.kitThumb(cv,c.kits[cv.dataset.k],c);});
 App.renderCompare();};
App.renderCompare=function(){const el=$('cb-compare');el.hidden=!App.cb.compare;if(!App.cb.compare)return;const opts=sel=>App.clubs.map(c=>`<option value="${esc(c.id)}" ${c.id===sel?'selected':''}>${esc(c.name)}</option>`).join('');
 const A=App.club(App.cb.ca||App.homeId),B=App.club(App.cb.cb||App.awayId);const sa=D.sectorRatings(A),sb=D.sectorRatings(B);const avg=(c,k)=>{const l=c.players;return Math.round(l.reduce((n,p)=>n+(p.attrs[k]||0),0)/l.length);};
 const row=(l,x,y)=>{const t=x+y||1;return`<div class="cmp-row"><div class="lbl"><span>${x}</span><span>${l}</span><span>${y}</span></div><div class="cmp-bar"><i style="width:${x/t*100}%"></i><i style="width:${y/t*100}%"></i></div></div>`;};
 el.innerHTML=`<h3>Comparação</h3><div class="fgrid"><label>Clube A<select id="cmp-a">${opts(A.id)}</select></label><label>Clube B<select id="cmp-b">${opts(B.id)}</select></label></div>
  <div class="cmp-heads"><img src="${App.crest(A)}" alt=""><b>${esc(A.short)}</b><span>×</span><b>${esc(B.short)}</b><img src="${App.crest(B)}" alt=""></div>
  ${row('OVERALL',D.teamOverall(A),D.teamOverall(B))}${row('GOLEIRO',sa.GK,sb.GK)}${row('DEFESA',sa.DEF,sb.DEF)}${row('MEIO',sa.MID,sb.MID)}${row('ATAQUE',sa.ATT,sb.ATT)}${row('VELOCIDADE (média)',avg(A,'pace'),avg(B,'pace'))}${row('PASSE (média)',avg(A,'passing'),avg(B,'passing'))}${row('FINALIZAÇÃO (média)',avg(A,'finishing'),avg(B,'finishing'))}${row('ELENCO',A.players.length+A.bench.length,B.players.length+B.bench.length)}`;
 $('cmp-a').onchange=e=>{App.cb.ca=e.target.value;App.renderCompare();};$('cmp-b').onchange=e=>{App.cb.cb=e.target.value;App.renderCompare();};};
App.cloneClub=function(id){const c=U.deepClone(App.club(id));c.id=U.uid('club');c.name=(c.name+' B').slice(0,30);c.short=U.initials(c.name).slice(0,3);c.builtin=false;c.edited=false;c.real=false;c.players.forEach(p=>p.id=U.uid('p'));c.bench.forEach(p=>p.id=U.uid('p'));App.clubs.push(D.ensureClub(c));App.save();App.renderClubs();App.toast('Clube duplicado!');};
App.deleteClub=function(id){if(CAT.isDefault(id)){App.toast('Clubes padrão não são excluídos; você pode editá-los ou movê-los de liga.');return;}const c=App.club(id);if(!confirm(`Excluir o clube ${c.name}?`))return;App.clubs=App.clubs.filter(x=>x.id!==id);
 if(App.homeId===id)App.homeId=App.clubs[0].id;if(App.awayId===id||App.awayId===App.homeId)App.awayId=App.clubs.find(x=>x.id!==App.homeId).id;App.save();App.renderClubs();App.toast('Clube excluído.');};
App.restoreClub=function(id){if(!confirm('Desfazer suas edições e voltar aos dados padrão deste clube?'))return;const fresh=CAT.restore(id);if(!fresh)return;const i=App.clubs.findIndex(c=>c.id===id);App.clubs[i]=fresh;App.save();App.renderClubs();App.toast('Dados padrão restaurados.');};
App.exportClub=function(id){const c=App.club(id);App.download(App.slug(c.name)+'.json',D.exportClub(c));App.toast('JSON exportado.');};
App.importFile=async function(file){if(!file)return;if(file.size>12*1024*1024)throw Error('Arquivo muito grande (máx. 12 MB).');const text=await file.text();let data;try{data=JSON.parse(text);}catch(e){throw Error('JSON inválido.');}
 const list=Array.isArray(data.clubs)?data.clubs:[data];let n=0;for(const item of list){const c=D.importClub(JSON.stringify(item.club?item:{club:item}));c.league=item.club&&item.club.league&&CAT.league(item.club.league)?item.club.league:'meus-clubes';c.country=(CAT.league(c.league)||{}).country||'MD';c.builtin=false;App.clubs.push(c);n++;}
 App.save();App.renderClubs();App.toast(n>1?`${n} clubes importados!`:'Clube importado!');};
/* ---------- configurações ---------- */
App.applySettings=function(){const s=App.settings;D.saveSettings(s);MD.Audio.configure({master:s.master,crowd:s.crowd,sfx:s.sfx,music:s.music,muted:s.muted});$('mute-btn').textContent=s.muted?'🔇':'🔊';
 if(App.renderer&&App.renderer.setQuality)App.renderer.setQuality(s.quality);if(App.studio&&App.studio.setQuality)App.studio.setQuality(s.quality==='low'?'low':'high');$('diag').hidden=!s.diagnostics;};
App.renderSettings=function(){const s=App.settings;$('set-quality').value=s.quality;$('set-diag').checked=!!s.diagnostics;$('set-master').value=s.master;$('set-crowd').value=s.crowd;$('set-sfx').value=s.sfx;$('set-music').value=s.music??.6;$('set-muted').checked=!!s.muted;
 $('set-rate').value=s.highlightRate;$('set-pace').value=s.pace||'normal';$('set-cinema').checked=s.cinema!==false;$('set-cam').value=s.cam||'auto';$('set-subs').value=String(s.maxSubs);$('set-autosubs').checked=!!s.autoSubs;$('set-replays').checked=!!s.replays;$('set-celebrations').checked=!!s.celebrations;
 $('set-anthem').value=s.anthem||'synth';$('anthem-info').textContent=s.anthemFile?`Arquivo: ${s.anthemName||'áudio enviado'}`:'Nenhum arquivo enviado.';
 $('gpu-info').textContent=App.isWebGL?`Renderizador: ${App.renderer.stats.gpu}`:'WebGL2 indisponível: usando o modo alternativo em Canvas 2D.';
 let size=0;try{for(const k of [CAT.KEY_OVR,CAT.KEY_USER,MD.Tournament.KEY,MD.Germinare.KEY])size+=(localStorage.getItem(k)||'').length;}catch(e){}
 $('storage-info').textContent=`Seus dados: ${(size/1024).toFixed(0)} KB · clubes padrão editados: ${Object.keys(CAT.overrides).length} · imagens/áudio no IndexedDB: ${D.Assets.ok?D.Assets.mem.size+' arquivos':'indisponível (usando localStorage)'}`;};
App.bindCore=function(){
 document.addEventListener('click',e=>{const g=e.target.closest('[data-go]');if(g){e.preventDefault();App.go(g.dataset.go);}const cl=e.target.closest('[data-close]');if(cl)App.closeModal(cl.dataset.close);});
 $('menu-play').addEventListener('click',()=>App.go('select'));$('mt-quick').addEventListener('click',()=>App.go('select'));
 $('mf-go').addEventListener('click',e=>App.go(e.target.dataset.target||'germinare'));
 $('menu-kits').addEventListener('click',()=>{App.go('clubs');App.toast('Escolha um clube e clique em KITS.');});
 /* seleção */
 $('side-toggle').addEventListener('click',e=>{const b=e.target.closest('[data-side]');if(!b)return;App.sel.side=b.dataset.side;App.renderSelect();});
 for(const s of ['home','away'])$('pick-'+s).addEventListener('click',()=>{App.sel.side=s;App.renderSelect();});
 $('sel-countries').addEventListener('click',e=>{const ct=e.target.closest('[data-scont]');if(ct){App.sel.continent=ct.dataset.scont;App.sel.country='';App.sel.league='';App.renderSelect();return;}const fv=e.target.closest('[data-sfav]');if(fv){App.sel.fav=!App.sel.fav;App.renderSelect();return;}const b=e.target.closest('[data-scountry]');if(!b)return;App.sel.country=b.dataset.scountry;App.sel.league=(CAT.leaguesOf(App.sel.country)[0]||{}).id||'';App.renderSelect();});
 $('sel-leagues').addEventListener('click',e=>{const b=e.target.closest('[data-sleague]');if(!b)return;App.sel.league=b.dataset.sleague;App.renderSelect();});
 $('sel-search').addEventListener('input',e=>{App.sel.q=e.target.value;App.renderSelect();});
 $('select-strip').addEventListener('click',e=>{const fs=e.target.closest('[data-fav]');if(fs){e.stopPropagation();const on=CAT.toggleFav(fs.dataset.fav);fs.classList.toggle('on',on);App.toast(on?'Adicionado aos favoritos.':'Removido dos favoritos.');return;}const b=e.target.closest('[data-strip]');if(!b)return;const id=b.dataset.strip;const side=App.sel.side;
  if(side==='home'){if(id===App.awayId)App.awayId=App.homeId;App.homeId=id;App.sel.side='away';}else{if(id===App.homeId)App.homeId=App.awayId;App.awayId=id;}App.renderSelect();});
 $('swap-teams').addEventListener('click',()=>{[App.homeId,App.awayId]=[App.awayId,App.homeId];App.renderSelect();});$('to-prematch').addEventListener('click',()=>{const h=App.club(App.homeId),a=App.club(App.awayId);if(!App.flow)App.flow={kind:'quick',watch:'play',mode:'pro',humans:[{device:'kb1',side:'home'}]};App.flow.mode=App.flow.mode||'pro';MD.TRS.prepareVersus(h,a);App.go('versus');});
 document.querySelector('.prematch-grid').addEventListener('change',e=>{const s=e.target.closest('[data-tac]');if(!s)return;const c=App.club(s.dataset.p==='home'?App.homeId:App.awayId);if(s.dataset.tac==='formation')D.setFormation(c,s.value);else c.tactics[s.dataset.tac]=s.value;App.save(c.id);App.renderPrematch();});
 $('pm-rate').addEventListener('change',e=>{App.settings.highlightRate=e.target.value;App.applySettings();});$('pm-seed').addEventListener('change',e=>{App.settings.seed=e.target.value.trim();App.applySettings();});
 $('pm-pace').addEventListener('change',e=>{App.settings.pace=e.target.value;App.applySettings();});$('pm-cinema').addEventListener('change',e=>{App.settings.cinema=e.target.checked;App.applySettings();});
 $('kickoff').addEventListener('click',()=>{MD.Audio.resume();MD.Match.start(App.club(App.homeId),App.club(App.awayId),{});});
 /* clubes */
 $('cb-tree').addEventListener('click',e=>{const del=e.target.closest('[data-cbdel]');if(del){e.stopPropagation();const id=del.dataset.cbdel;if(App.clubs.some(c=>c.league===id)){App.toast('Mova os clubes desta liga antes de excluí-la.');return;}CAT.removeLeague(id);App.cb.league='';App.renderClubs();return;}
  const b=e.target.closest('[data-cbc]');if(!b)return;App.cb.country=b.dataset.cbc;App.cb.league=b.dataset.cbl||'';App.renderClubs();});
 $('cb-search').addEventListener('input',e=>{App.cb.q=e.target.value;App.renderClubs();});
 $('cb-compare-btn').addEventListener('click',()=>{App.cb.compare=!App.cb.compare;App.renderCompare();});
 $('cb-league-add').addEventListener('click',()=>{const name=$('cb-league-name').value.trim();if(name.length<2){App.toast('Digite o nome da liga.');return;}let co=$('cb-league-country').value,coName='';
  if(co==='__new'){coName=(prompt('Nome do país:')||'').trim();if(!coName)return;co=App.slug(coName).toUpperCase().slice(0,12);}const l=CAT.addLeague(name,co,coName);App.cb.country=l.country;App.cb.league=l.id;$('cb-league-name').value='';App.renderClubs();App.toast('Liga criada! Mova clubes para ela pelo seletor “Liga” de cada card.');});
 $('club-grid').addEventListener('change',e=>{const s=e.target.closest('[data-move]');if(!s)return;const c=App.club(s.dataset.move);c.league=s.value;c.country=(CAT.league(s.value)||{}).country||c.country;App.save(c.id);App.renderClubs();App.toast(`${c.name} movido para ${App.leagueName(c.league)}.`);});
 $('club-grid').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const d=b.dataset;if(d.edit)MD.Editors.openClub(d.edit);else if(d.kits)MD.KitStudio.open(d.kits);else if(d.copy)App.cloneClub(d.copy);else if(d.export)App.exportClub(d.export);else if(d.del)App.deleteClub(d.del);else if(d.restore)App.restoreClub(d.restore);});
 $('add-club').addEventListener('click',()=>MD.Editors.openClub(null));
 $('import-file').addEventListener('change',async e=>{try{await App.importFile(e.target.files[0]);}catch(err){App.toast('Não foi possível importar: '+err.message);}e.target.value='';});
 const exportAll=()=>{App.download('matchday-clubes-backup.json',JSON.stringify({format:'matchday-clubs-v05',clubs:App.clubs.map(c=>({club:D.externalize(c)}))}));App.toast('Backup exportado.');};
 $('export-all').addEventListener('click',exportAll);$('set-export').addEventListener('click',exportAll);
 $('set-reset').addEventListener('click',()=>{if(!confirm('Desfazer TODAS as edições feitas nos clubes padrão? Seus clubes criados/importados e os clubes da 0.4 são mantidos.'))return;for(const id of Object.keys(CAT.overrides)){const f=CAT.restore(id);const i=App.clubs.findIndex(c=>c.id===id);if(f&&i>=0)App.clubs[i]=f;}App.save();App.toast('Clubes padrão restaurados.');App.renderSettings();});
 /* ajustes */
 const S=App.settings;const bindSet=(id,key,conv)=>$(id).addEventListener('input',e=>{S[key]=conv(e.target);App.applySettings();});
 bindSet('set-quality','quality',t=>t.value);bindSet('set-diag','diagnostics',t=>t.checked);bindSet('set-master','master',t=>+t.value);bindSet('set-crowd','crowd',t=>+t.value);bindSet('set-sfx','sfx',t=>+t.value);bindSet('set-music','music',t=>+t.value);bindSet('set-muted','muted',t=>t.checked);
 bindSet('set-rate','highlightRate',t=>t.value);bindSet('set-pace','pace',t=>t.value);bindSet('set-cinema','cinema',t=>t.checked);bindSet('set-cam','cam',t=>t.value);bindSet('set-subs','maxSubs',t=>+t.value);bindSet('set-autosubs','autoSubs',t=>t.checked);bindSet('set-replays','replays',t=>t.checked);bindSet('set-celebrations','celebrations',t=>t.checked);bindSet('set-anthem','anthem',t=>t.value);
 $('set-anthem-file').addEventListener('change',async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;if(!/^audio\//.test(f.type)){App.toast('Envie um arquivo de áudio (MP3, OGG, WAV).');return;}if(f.size>8*1024*1024){App.toast('Áudio muito grande (máx. 8 MB).');return;}
  const url=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej();r.readAsDataURL(f);});S.anthemFile=D.Assets.put(url);S.anthemName=f.name.slice(0,60);S.anthem='file';App.applySettings();App.renderSettings();App.toast('Áudio salvo para as apresentações.');});
 $('set-anthem-test').addEventListener('click',()=>{MD.Audio.resume();MD.Audio.anthem(S,6);});
 $('test-sound').addEventListener('click',()=>{MD.Audio.resume();MD.Audio.play('whistle',{final:true});});
 $('mute-btn').addEventListener('click',()=>{MD.Audio.resume();S.muted=!S.muted;App.applySettings();});
 window.addEventListener('matchday-kit-loaded',()=>{clearTimeout(App._kitT);App._kitT=setTimeout(()=>{if(App.screen==='select')App.renderSelect();if(App.screen==='clubs')App.renderClubs();MD.KitStudio&&MD.KitStudio.refresh&&MD.KitStudio.refresh(true);},120);});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){for(const id of ['player-modal','kit-modal','club-modal'])if(!$(id).hidden){App.closeModal(id);break;}}
  if(e.target.matches('input,select,textarea'))return;if(e.key==='m'||e.key==='M'){S.muted=!S.muted;App.applySettings();}});};
/* ---------- modais ---------- */
App.openModal=id=>{$(id).hidden=false;document.body.style.overflow='hidden';};
App.closeModal=id=>{$(id).hidden=true;if(['club-modal','player-modal','kit-modal'].every(m=>$(m).hidden))document.body.style.overflow='';if(id==='player-modal'||id==='kit-modal')App.studioOwner=null;};
})(window.MD=window.MD||{});
