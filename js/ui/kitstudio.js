/* MATCHDAY 0.4 — estúdio de uniformes: design, calção/meião, até 5 patrocinadores, pintura sobre a textura
   (pincel, borracha, linha, formas, balde, conta-gotas, desfazer/refazer), importação de moldes e visualizador 3D 360°. */
(function(MD){
'use strict';
const U=MD.U,D=MD.Data,K=MD.Kit,App=MD.App,$=id=>document.getElementById(id),esc=U.escape;
const KS=MD.KitStudio={};
let club=null,kits=null,cur='home',onApply=null,tab='design',dirty=true,lastPaint=0;
const view={yaw:.3,pitch:.08,dist:3.4,focus:'body'};
/* pintura */
const P={tool:'brush',color:'#ffffff',size:14,alpha:1,undo:[],redo:[],layer:null,lctx:null,comp:null,drawing:false,start:null,snap:null,guides:true};
KS.open=function(target,opts){opts=opts||{};club=typeof target==='string'?App.club(target):target;onApply=opts.onApply||null;kits=U.deepClone(club.kits);cur=opts.kit||'home';
 $('ks-title').textContent='Uniformes · '+club.name;document.querySelectorAll('#ks-kitsel .tab').forEach(b=>b.classList.toggle('active',b.dataset.kit===cur));
 P.undo=[];P.redo=[];KS.loadLayer();App.attachStudio('ks-slot','kit');KS.tab('design');dirty=true;KS.refresh();App.openModal('kit-modal');};
KS.kit=()=>kits[cur];
KS.loadLayer=function(){P.layer=P.layer||document.createElement('canvas');P.layer.width=P.layer.height=512;P.lctx=P.layer.getContext('2d');P.lctx.clearRect(0,0,512,512);
 const k=KS.kit();if(k.paint){const url=D.Assets.url(k.paint);if(url){const im=new Image();im.onload=()=>{P.lctx.drawImage(im,0,0);KS.drawPaint();};im.src=url;}}};
KS.refresh=function(force){if(!kits)return;if(force)dirty=true;const k=KS.kit();const fr=$('ks-front'),bk=$('ks-back');if(!KS.tex){KS.tex=document.createElement('canvas');KS.tex.width=KS.tex.height=512;}
 K.paint(KS.tex,k,club.crest);const mascot=club.players[club.players.length>9?9:0];K.drawShirt(fr,k,club.crest,{tex:KS.tex,side:'front'});K.drawShirt(bk,k,club.crest,{tex:KS.tex,side:'back',number:cur==='gk'?1:mascot.number,name:mascot.name.split(' ').pop()});
 if(tab==='paint'||tab==='template')KS.drawPaint();dirty=true;};
KS.studioFrame=function(R,dt){if(!kits)return;const k=KS.kit();const mascot=cur==='gk'?club.players[0]:club.players[club.players.length>9?9:0];
 R.renderStudio(mascot,club,k,{dt,yaw:view.yaw,pitch:view.pitch,dist:view.dist,focus:view.focus,keeper:cur==='gk',kitKey:'ks',dirty});dirty=false;};
const o=(list,v)=>list.map(x=>`<option value="${x[0]}" ${x[0]===v?'selected':''}>${x[1]}</option>`).join('');
const col=(key,label)=>`<label>${label}<input type="color" data-k="${key}" value="${KS.kit()[key]||'#ffffff'}"/></label>`;
const sel=(key,label,list)=>`<label>${label}<select data-k="${key}">${o(list,KS.kit()[key])}</select></label>`;
const chk=(key,label)=>`<label class="switch"><input type="checkbox" data-k="${key}" ${KS.kit()[key]?'checked':''}/><span>${label}</span></label>`;
const rng=(obj,key,label,min,max,step=1)=>`<label class="sl">${label}<output>${obj[key]}</output><input type="range" min="${min}" max="${max}" step="${step}" value="${obj[key]}" data-r="${key}"/></label>`;
KS.tab=function(t){tab=t;document.querySelectorAll('#ks-tabs .tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===t));const k=KS.kit(),b=$('ks-body');
 if(t==='design')b.innerHTML=`<div class="fgrid">${col('primary','Cor principal')}${col('secondary','Cor secundária')}${col('accent','Cor de detalhe')}
  ${sel('pattern','Estampa',D.PATTERNS)}<label class="sl">Tamanho da estampa<output>${k.patternSize}</output><input type="range" min="4" max="40" value="${k.patternSize}" data-k="patternSize"/></label>
  ${sel('collar','Gola',D.COLLARS)}${sel('sleeves','Mangas',[['short','Curtas'],['long','Compridas']])}${sel('sleeveColor','Cor das mangas',[['main','Principal'],['secondary','Secundária'],['accent','Detalhe']])}
  ${sel('sleeveDetail','Detalhe nas mangas',[['none','Nenhum'],['stripe','Listras'],['band','Faixa'],['tip','Ponta colorida']])}${sel('shoulders','Ombros',[['none','Nenhum'],['stripes','Listras'],['panel','Painel'],['yoke','Recorte em V']])}
  ${sel('sides','Laterais',[['none','Nenhuma'],['panel','Painel lateral'],['stripe','Friso lateral']])}${sel('numberFont','Fonte da numeração',[['block','Bloco'],['classic','Clássica'],['round','Arredondada'],['condensed','Condensada']])}
  <label>Cor da numeração<input type="color" data-k="numberColor" value="${k.numberColor||K.numberColor(k)}"/></label><button class="btn ghost small" data-act="autonum">NUMERAÇÃO AUTOMÁTICA</button>
  ${chk('cuffs','Punhos')}${chk('showCrest','Escudo no peito')}${chk('showName','Nome nas costas')}${chk('stitch','Costuras aparentes')}</div>`;
 if(t==='lower')b.innerHTML=`<div class="fgrid"><div class="full hint"><b>CALÇÃO</b></div>${col('shortsColor','Cor')}${col('shortsColor2','Detalhe')}${sel('shortsPattern','Modelo',[['plain','Liso'],['side','Faixa lateral'],['stripe','Listra central'],['hoop','Barra'],['split','Duas cores']])}<span></span>
  <div class="full hint"><b>MEIÃO</b></div>${col('socksColor','Cor')}${col('socksColor2','Detalhe')}${sel('socksPattern','Modelo',[['plain','Liso'],['top','Barra superior'],['hoops','Listrado'],['band','Faixa'],['split','Duas cores']])}</div>`;
 if(t==='sponsors'){const list=k.sponsors.slice().sort((a,b)=>a.z-b.z);b.innerHTML=`<div class="hint" style="margin-bottom:10px">Até 5 patrocinadores por uniforme. Posicione na frente, costas, mangas ou calção. A ordem define as camadas.</div>`+
  list.map((s,i)=>`<div class="sp-item" data-sp="${s.id}"><div class="sp-head"><img src="${D.Assets.url(s.img)||''}" alt=""><b>Patrocínio ${i+1}</b><div class="sp-tools"><button data-spa="up" title="Subir camada">▲</button><button data-spa="down" title="Descer camada">▼</button><button data-spa="del" title="Remover">✕</button></div></div>
   <div class="fgrid"><label>Posição<select data-sk="area">${o([['front','Frente'],['back','Costas'],['lsleeve','Manga esquerda'],['rsleeve','Manga direita'],['shorts','Calção']],s.area)}</select></label>${rng(s,'scale','Tamanho',5,100)}${rng(s,'x','Horizontal',0,100)}${rng(s,'y','Vertical',0,100)}${rng(s,'rot','Rotação',-180,180)}${rng(s,'opacity','Transparência',0,1,.05)}</div></div>`).join('')+
  (k.sponsors.length<5?`<label class="btn primary small">+ ADICIONAR PATROCINADOR (${k.sponsors.length}/5)<input type="file" accept="image/*" id="ks-sp-file" hidden/></label>`:'<div class="hint">Limite de 5 patrocinadores atingido.</div>');}
 if(t==='paint')b.innerHTML=`<div class="paint-wrap"><div class="paint-tools" id="pt-tools">${[['brush','✎ Pincel'],['eraser','⌫ Borracha'],['line','／ Linha'],['rect','▭ Retângulo'],['ellipse','◯ Elipse'],['fill','🪣 Preencher'],['picker','💧 Cor']].map(([k2,l])=>`<button data-tool="${k2}" class="${P.tool===k2?'active':''}">${l}</button>`).join('')}</div>
  <div class="fgrid three"><label>Cor<input type="color" id="pt-color" value="${P.color}"/></label><label class="sl">Tamanho<output id="pt-size-o">${P.size}</output><input type="range" id="pt-size" min="1" max="80" value="${P.size}"/></label><label class="sl">Opacidade<output id="pt-alpha-o">${P.alpha}</output><input type="range" id="pt-alpha" min=".05" max="1" step=".05" value="${P.alpha}"/></label></div>
  <div class="paint-tools"><button data-pa="undo">↶ Desfazer</button><button data-pa="redo">↷ Refazer</button><button data-pa="clear">Limpar camada</button><label class="switch" style="margin-left:auto"><input type="checkbox" id="pt-guides" ${P.guides?'checked':''}/><span>Guias</span></label></div>
  <div class="paint-canvas" id="pt-canvas"><canvas id="pt-view" width="512" height="512"></canvas></div><div class="hint">Mapa da textura: frente e costas da camisa, mangas, calção e meião. O que você pinta aparece no 3D.</div></div>`;
 if(t==='template'){const a=k.art||{mode:'front',zoom:100,x:0,y:0,rot:0,crop:100,opacity:1};b.innerHTML=`<div class="fgrid"><label class="btn primary small full">ENVIAR IMAGEM / MOLDE<input type="file" accept="image/*" id="ks-art-file" hidden/></label>
  <label>Região<select data-art="mode">${o([['front','Somente frente'],['back','Somente costas'],['both','Frente e costas'],['sheet','Molde plano (frente à esquerda, costas à direita)']],a.mode)}</select></label><span></span>
  ${['zoom','x','y','rot','crop','opacity'].map(key=>{const lim={zoom:[20,300,1,'Escala'],x:[-100,100,1,'Posição X'],y:[-100,100,1,'Posição Y'],rot:[-180,180,1,'Rotação'],crop:[30,100,1,'Enquadramento (recorte)'],opacity:[0,1,.05,'Transparência']}[key];return`<label class="sl">${lim[3]}<output>${a[key]}</output><input type="range" min="${lim[0]}" max="${lim[1]}" step="${lim[2]}" value="${a[key]}" data-art="${key}" ${k.art?'':'disabled'}/></label>`;}).join('')}
  <button class="btn ghost small" data-act="noart" ${k.art?'':'disabled'}>REMOVER MOLDE</button></div><div class="paint-canvas" style="margin-top:12px"><canvas id="pt-view" width="512" height="512"></canvas></div>
  <div class="hint">As linhas tracejadas mostram as áreas suportadas pelo modelo. Para moldes planos, use “Molde plano” e ajuste escala e posição até encaixar.</div>`;}
 if(t==='paint'||t==='template')KS.drawPaint();};
/* ---------- pintura ---------- */
KS.drawPaint=function(){const v=$('pt-view');if(!v)return;const x=v.getContext('2d');if(!KS.tex)return;const k=KS.kit();const tmp=KS.tmp||(KS.tmp=Object.assign(document.createElement('canvas'),{width:512,height:512}));
 const kk={...k,paint:null};K.paint(tmp,kk,club.crest);x.clearRect(0,0,512,512);x.drawImage(tmp,0,0);x.drawImage(P.layer,0,0);if(P.preview)P.preview(x);if(P.guides||tab==='template')K.guides(x);};
function pos(e){const r=$('pt-view').getBoundingClientRect();return[(e.clientX-r.left)/r.width*512,(e.clientY-r.top)/r.height*512];}
function pushUndo(){P.undo.push(P.lctx.getImageData(0,0,512,512));if(P.undo.length>25)P.undo.shift();P.redo=[];}
function commitPaint(){const now=performance.now();lastPaint=now;setTimeout(()=>{if(lastPaint!==now)return;const empty=!P.lctx.getImageData(0,0,512,512).data.some((v,i)=>i%4===3&&v>0);KS.kit().paint=empty?null:D.Assets.put(P.layer.toDataURL('image/png'));KS.refresh();},180);}
function stroke(a,b){const c=P.lctx;c.save();c.globalAlpha=P.alpha;c.globalCompositeOperation=P.tool==='eraser'?'destination-out':'source-over';c.strokeStyle=P.color;c.lineWidth=P.size;c.lineCap='round';c.beginPath();c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1]);c.stroke();c.restore();}
function shape(c,a,b,tool){c.save();c.globalAlpha=P.alpha;c.strokeStyle=c.fillStyle=P.color;c.lineWidth=P.size;c.lineCap='round';c.beginPath();
 if(tool==='line'){c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1]);c.stroke();}else if(tool==='rect'){c.fillRect(Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.abs(b[0]-a[0]),Math.abs(b[1]-a[1]));}
 else{c.ellipse((a[0]+b[0])/2,(a[1]+b[1])/2,Math.abs(b[0]-a[0])/2+.5,Math.abs(b[1]-a[1])/2+.5,0,0,Math.PI*2);c.fill();}c.restore();}
/* balde: preenche a região contígua da imagem composta com a cor escolhida, na camada de pintura */
function flood(p){const comp=document.createElement('canvas');comp.width=comp.height=512;const cx=comp.getContext('2d');cx.drawImage(KS.tmp,0,0);cx.drawImage(P.layer,0,0);
 const src=cx.getImageData(0,0,512,512).data,x0=Math.floor(p[0]),y0=Math.floor(p[1]);const i0=(y0*512+x0)*4;const r0=src[i0],g0=src[i0+1],b0=src[i0+2];const tol=30;
 const out=P.lctx.getImageData(0,0,512,512),d=out.data,seen=new Uint8Array(512*512);const rgb=U.hex2rgb(P.color).map(v=>Math.round(v*255));const st=[[x0,y0]];
 const same=i=>Math.abs(src[i]-r0)+Math.abs(src[i+1]-g0)+Math.abs(src[i+2]-b0)<=tol*3;
 while(st.length){const [x,y]=st.pop();let lx=x;while(lx>0&&!seen[y*512+lx-1]&&same((y*512+lx-1)*4))lx--;let up=false,dn=false;
  for(let xx=lx;xx<512&&!seen[y*512+xx]&&same((y*512+xx)*4);xx++){const k=y*512+xx;seen[k]=1;const i=k*4;d[i]=rgb[0];d[i+1]=rgb[1];d[i+2]=rgb[2];d[i+3]=Math.round(255*P.alpha);
   if(y>0){const u=!seen[k-512]&&same((k-512)*4);if(u&&!up)st.push([xx,y-1]);up=u;}if(y<511){const w=!seen[k+512]&&same((k+512)*4);if(w&&!dn)st.push([xx,y+1]);dn=w;}}}
 P.lctx.putImageData(out,0,0);}
KS.bindPaint=function(){const body=$('ks-body');
 body.addEventListener('pointerdown',e=>{if(e.target.id!=='pt-view'||tab!=='paint')return;e.preventDefault();e.target.setPointerCapture(e.pointerId);const p=pos(e);
  if(P.tool==='picker'){const c=$('pt-view').getContext('2d').getImageData(p[0]|0,p[1]|0,1,1).data;P.color=U.rgb2hex([c[0]/255,c[1]/255,c[2]/255]);$('pt-color').value=P.color;return;}
  pushUndo();if(P.tool==='fill'){flood(p);KS.drawPaint();commitPaint();return;}P.drawing=true;P.start=p;P.last=p;if(P.tool==='brush'||P.tool==='eraser'){stroke(p,[p[0]+.01,p[1]]);KS.drawPaint();}});
 body.addEventListener('pointermove',e=>{if(!P.drawing)return;const p=pos(e);if(P.tool==='brush'||P.tool==='eraser'){stroke(P.last,p);P.last=p;KS.drawPaint();}else{P.preview=c=>shape(c,P.start,p,P.tool);KS.drawPaint();}});
 const end=e=>{if(!P.drawing)return;P.drawing=false;const p=pos(e);if(['line','rect','ellipse'].includes(P.tool))shape(P.lctx,P.start,p,P.tool);P.preview=null;KS.drawPaint();commitPaint();};
 body.addEventListener('pointerup',end);body.addEventListener('pointercancel',end);};
KS.bind=function(){$('ks-kitsel').onclick=e=>{const b=e.target.closest('[data-kit]');if(!b)return;cur=b.dataset.kit;document.querySelectorAll('#ks-kitsel .tab').forEach(x=>x.classList.toggle('active',x===b));P.undo=[];P.redo=[];KS.loadLayer();KS.tab(tab);KS.refresh();};
 $('ks-tabs').onclick=e=>{const b=e.target.closest('[data-tab]');if(b)KS.tab(b.dataset.tab);};
 const body=$('ks-body');
 body.addEventListener('input',e=>{const t=e.target,k=KS.kit();
  if(t.dataset.k){const key=t.dataset.k;k[key]=t.type==='checkbox'?t.checked:t.type==='range'?+t.value:t.value;const out=t.parentElement.querySelector('output');if(out)out.textContent=t.value;KS.refresh();}
  const sp=t.closest('[data-sp]');if(sp&&(t.dataset.r||t.dataset.sk)){const s=k.sponsors.find(x=>x.id===sp.dataset.sp);if(t.dataset.r){s[t.dataset.r]=+t.value;t.parentElement.querySelector('output').textContent=t.value;}else s.area=t.value;KS.refresh();}
  if(t.dataset.art&&k.art){k.art[t.dataset.art]=t.type==='range'?+t.value:t.value;const out=t.parentElement.querySelector('output');if(out)out.textContent=t.value;KS.refresh();}
  if(t.id==='pt-color')P.color=t.value;if(t.id==='pt-size'){P.size=+t.value;$('pt-size-o').textContent=t.value;}if(t.id==='pt-alpha'){P.alpha=+t.value;$('pt-alpha-o').textContent=t.value;}if(t.id==='pt-guides'){P.guides=t.checked;KS.drawPaint();}});
 body.addEventListener('change',async e=>{const t=e.target,k=KS.kit();
  if(t.id==='ks-sp-file'){try{if(k.sponsors.length>=5)throw Error('Máximo de 5 patrocinadores.');const img=D.Assets.put(await App.processImage(t.files[0],'sponsor'));k.sponsors.push({id:U.uid('sp'),img,area:'front',x:50,y:45,scale:44,rot:0,opacity:1,z:k.sponsors.length?Math.max(...k.sponsors.map(s=>s.z))+1:0});KS.tab('sponsors');KS.refresh();App.toast('Patrocinador adicionado!');}catch(err){App.toast(err.message);}}
  if(t.id==='ks-art-file'){try{const img=D.Assets.put(await App.processImage(t.files[0],'template'));k.art={img,mode:k.art?.mode||'front',zoom:100,x:0,y:0,rot:0,crop:100,opacity:1};KS.tab('template');KS.refresh();App.toast('Molde aplicado! Ajuste escala e posição.');}catch(err){App.toast(err.message);}}
  if(t.dataset.sk==='area'){const sp=t.closest('[data-sp]');k.sponsors.find(x=>x.id===sp.dataset.sp).area=t.value;KS.refresh();}});
 body.addEventListener('click',e=>{const k=KS.kit();const tl=e.target.closest('[data-tool]');if(tl){P.tool=tl.dataset.tool;document.querySelectorAll('#pt-tools button').forEach(b=>b.classList.toggle('active',b===tl));}
  const pa=e.target.closest('[data-pa]');if(pa){const a=pa.dataset.pa;if(a==='undo'&&P.undo.length){P.redo.push(P.lctx.getImageData(0,0,512,512));P.lctx.putImageData(P.undo.pop(),0,0);}
   if(a==='redo'&&P.redo.length){P.undo.push(P.lctx.getImageData(0,0,512,512));P.lctx.putImageData(P.redo.pop(),0,0);}if(a==='clear'){pushUndo();P.lctx.clearRect(0,0,512,512);}KS.drawPaint();commitPaint();}
  const sa=e.target.closest('[data-spa]');if(sa){const id=sa.closest('[data-sp]').dataset.sp;const list=k.sponsors.slice().sort((a,b)=>a.z-b.z);const i=list.findIndex(s=>s.id===id);
   if(sa.dataset.spa==='del')k.sponsors=k.sponsors.filter(s=>s.id!==id);else{const j=sa.dataset.spa==='up'?i+1:i-1;if(j>=0&&j<list.length){const z=list[i].z;list[i].z=list[j].z;list[j].z=z;if(list[i].z===list[j].z)list[i].z+=sa.dataset.spa==='up'?1:-1;}}KS.tab('sponsors');KS.refresh();}
  const act=e.target.closest('[data-act]');if(act){if(act.dataset.act==='autonum'){k.numberColor='';KS.tab('design');KS.refresh();}if(act.dataset.act==='noart'){k.art=null;KS.tab('template');KS.refresh();}}});
 KS.bindPaint();
 document.querySelector('#ks-viewer .viewer-tools').onclick=e=>{const b=e.target.closest('[data-kview]');if(!b)return;const v=b.dataset.kview;view.yaw={front:0,back:Math.PI,left:Math.PI/2,right:-Math.PI/2,detail:.5}[v];view.dist=v==='detail'?1.7:3.4;view.pitch=v==='detail'?.15:.08;$('ks-zoom').value=view.dist;};
 document.querySelector('#ks-viewer .viewer-emotes').onclick=e=>{const b=e.target.closest('[data-focus]');if(!b)return;view.focus={shirt:'body',shorts:'shorts',socks:'socks'}[b.dataset.focus];view.dist=b.dataset.focus==='shirt'?3.4:2.4;document.querySelectorAll('[data-focus]').forEach(x=>x.classList.toggle('active',x===b));};
 $('ks-zoom').oninput=e=>{view.dist=+e.target.value;};
 $('ks-apply').onclick=()=>{for(const key of Object.keys(kits))kits[key]=D.sanitizeKit(kits[key],key==='gk'?{primary:club.keeper,secondary:'#1d2733'}:{primary:club.primary,secondary:club.secondary,accent:club.keeper});club.kits=kits;
  const inApp=App.clubs.includes(club);if(inApp)App.save();App.closeModal('kit-modal');if(onApply)onApply();if(inApp&&App.screen==='clubs')App.renderClubs();App.toast(inApp?'Uniformes salvos!':'Uniformes aplicados. Salve o clube para guardar.');kits=null;};};
KS.view=view;
MD.KitStudio=KS;
})(window.MD=window.MD||{});
