/* MATCHDAY 0.5 — inicialização: IndexedDB, migração dos dados da 0.3, renderizadores (WebGL2 com
   fallback Canvas 2D), visualizador 3D compartilhado dos editores e laço principal com delta time. */
(function(MD){
'use strict';
const App=MD.App,D=MD.Data,$=id=>document.getElementById(id);
const B=MD.Boot={fps:60,frameMs:16.7};
/* ativos usados fora dos clubes (áudio do hino, escudos de seleções do Germinare) não podem ser apagados pela limpeza */
function CAT_assets(){MD.Catalog.extraAssets=()=>{const out=[];const s=App.settings;if(s&&s.anthemFile)out.push(s.anthemFile);for(const q of MD.Germinare.load())if(q.crest)out.push(q.crest);return out;};}
const progress=p=>{const b=$('loading-bar');if(b)b.style.width=Math.round(p*100)+'%';};
/* Visualizador 3D único reaproveitado entre o criador de jogador e o estúdio de uniformes */
App.attachStudio=function(slotId,owner){const slot=$(slotId);if(!App.studioCanvas){const c=document.createElement('canvas');c.setAttribute('aria-label','Visualizador 3D 360°');App.studioCanvas=c;
  try{App.studio=new MD.Renderer3D(c,{studio:true});App.studio.setQuality(App.settings.quality==='low'?'low':'high');}catch(e){console.warn('Prévia 3D indisponível',e);App.studio=new MD.Renderer2D(c);}
  let drag=null;c.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY};c.setPointerCapture(e.pointerId);});
  c.addEventListener('pointermove',e=>{if(!drag)return;const v=App.studioOwner==='kit'?MD.KitStudio.view:MD.Editors.view;v.yaw-=(e.clientX-drag.x)*.012;v.pitch=MD.U.clamp(v.pitch+(e.clientY-drag.y)*.006,-.35,.9);drag={x:e.clientX,y:e.clientY};});
  c.addEventListener('pointerup',()=>drag=null);c.addEventListener('pointercancel',()=>drag=null);
  c.addEventListener('wheel',e=>{e.preventDefault();const v=App.studioOwner==='kit'?MD.KitStudio.view:MD.Editors.view;v.dist=MD.U.clamp(v.dist*(e.deltaY>0?1.08:.92),1.3,8);const z=$(App.studioOwner==='kit'?'ks-zoom':'pe-zoom');if(z)z.value=v.dist;},{passive:false});}
 slot.appendChild(App.studioCanvas);App.studioOwner=owner;if(App.studio.studioKitKey!==undefined)App.studio.studioKitKey=null;};
B.loop=function(){let last=performance.now();const tick=now=>{requestAnimationFrame(tick);const dt=Math.min(.1,(now-last)/1000);last=now;if(dt<=0)return;
  B.fps=B.fps*.92+(1/dt)*.08;B.frameMs=B.frameMs*.92+dt*1000*.08;
  try{MD.Input.poll();if(MD.TRS)MD.TRS.frame(dt);if(App.screen==='play')MD.Play.frame(dt);if(App.screen==='match')MD.Match.update(dt);if(App.screen==='germinare'&&MD.GermUI)MD.GermUI.frame(dt);
   if(App.studioOwner==='player'&&!$('player-modal').hidden)MD.Editors.studioFrame(App.studio,dt);else if(App.studioOwner==='kit'&&!$('kit-modal').hidden)MD.KitStudio.studioFrame(App.studio,dt);}
  catch(err){console.error(err);if(!B.errShown){B.errShown=true;App.toast('Erro inesperado: '+err.message);}}};requestAnimationFrame(tick);};
B.start=async function(){progress(.1);await D.Assets.open();progress(.35);
 App.settings=D.loadSettings();const res=MD.Catalog.load();App.clubs=res.clubs;const f=App.clubs.find(c=>c.id==='br-flamengo')||App.clubs[0],g=App.clubs.find(c=>c.id==='br-palmeiras')||App.clubs[1];App.homeId=f.id;App.awayId=g.id;progress(.55);
 if(res.migrated)setTimeout(()=>App.toast('Seus clubes de versões anteriores foram preservados em “Clubes personalizados”.'),900);
 CAT_assets();
 try{App.renderer=new MD.Renderer3D($('gl-canvas'));App.isWebGL=true;}catch(e){console.warn('WebGL2 indisponível, usando Canvas 2D.',e);$('gl-canvas').hidden=true;$('c2d-canvas').hidden=false;App.renderer=new MD.Renderer2D($('c2d-canvas'));App.isWebGL=false;}
 progress(.85);App.bindCore();MD.Match.bind();MD.TacticsUI.bind();MD.Play.bind();MD.TRS.bind();if(MD.Remote)MD.Remote.init();MD.Editors.bind();MD.KitStudio.bind();if(MD.GermUI)MD.GermUI.bind();if(MD.CopaUI)MD.CopaUI.bind();App.applySettings();
 window.addEventListener('matchday-kit-loaded',()=>{if(App.studio)App.studio.studioKitKey=null;if(MD.Match.state()&&App.renderer.repaintKits){clearTimeout(B.kt);B.kt=setTimeout(()=>App.renderer.repaintKits(),150);}});
 document.addEventListener('pointerdown',()=>MD.Audio.resume(),{once:true});
 App.go('cover');progress(1);if(MD.Catalog.genericRemoved)setTimeout(()=>App.toast(`TRS26 0.6: a liga genérica antiga saiu do catálogo. ${MD.Catalog.genericRemoved} clube(s) não editado(s) foram guardados em backup; clubes editados estão em “Clubes personalizados”.`),1400);setTimeout(()=>$('loading').classList.add('done'),200);B.loop();};
B.start().catch(err=>{console.error(err);const t=document.querySelector('.loading-text');if(t)t.textContent='Falha ao iniciar: '+err.message;});
})(window.MD=window.MD||{});
