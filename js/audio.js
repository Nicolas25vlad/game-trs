/* MATCHDAY 0.5 — áudio 100% sintetizado (WebAudio), sem arquivos de terceiros.
   Chute, passe, apito (curto/longo/final), gol, torcida ambiente, defesa, trave, cartão. Volumes independentes. */
(function(MD){
'use strict';
const AU={ctx:null,master:null,crowdGain:null,sfx:null,crowdNoise:null,settings:{master:.8,crowd:.7,sfx:.85,music:.6,muted:false},excite:.15,amb:null};
AU.init=function(){if(AU.ctx)return true;const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return false;try{const c=new AC();AU.ctx=c;
 AU.master=c.createGain();AU.master.connect(c.destination);AU.sfx=c.createGain();AU.sfx.connect(AU.master);AU.mus=c.createGain();AU.mus.connect(AU.master);AU.crowdGain=c.createGain();AU.crowdGain.gain.value=0;AU.crowdGain.connect(AU.master);
 const len=c.sampleRate*3,buf=c.createBuffer(2,len,c.sampleRate);for(let ch=0;ch<2;ch++){const d=buf.getChannelData(ch);let b0=0,b1=0;for(let i=0;i<len;i++){const w=Math.random()*2-1;b0=.99*b0+w*.04;b1=.96*b1+w*.08;d[i]=(b0+b1)*.9;}}
 AU.noiseBuf=buf;const src=c.createBufferSource();src.buffer=buf;src.loop=true;const f=c.createBiquadFilter();f.type='bandpass';f.frequency.value=700;f.Q.value=.5;src.connect(f);f.connect(AU.crowdGain);src.start();AU.crowdFilter=f;
 AU.apply();return true;}catch(e){return false;}};
AU.resume=function(){if(!AU.ctx)AU.init();if(AU.ctx&&AU.ctx.state==='suspended')AU.ctx.resume();};
AU.configure=function(s){Object.assign(AU.settings,s);AU.apply();};
AU.apply=function(){if(!AU.ctx)return;const s=AU.settings,t=AU.ctx.currentTime;AU.master.gain.setTargetAtTime(s.muted?0:s.master,t,.05);AU.sfx.gain.setTargetAtTime(s.sfx,t,.05);AU.mus.gain.setTargetAtTime(s.music??.6,t,.05);if(AU.el)AU.el.volume=s.muted?0:Math.min(1,(s.master||0)*(s.music??.6));};
AU.crowd=function(level){AU.excite=level;if(!AU.ctx)return;const t=AU.ctx.currentTime;AU.crowdGain.gain.setTargetAtTime(AU.settings.crowd*(.05+level*.35),t,.4);AU.crowdFilter.frequency.setTargetAtTime(500+level*900,t,.4);};
function env(g,t,a,d,peak){g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(peak,t+a);g.gain.exponentialRampToValueAtTime(.0008,t+a+d);}
function noise(t,dur,freq,q,peak,type){const c=AU.ctx,s=c.createBufferSource();s.buffer=AU.noiseBuf;const f=c.createBiquadFilter();f.type=type||'bandpass';f.frequency.value=freq;f.Q.value=q;const g=c.createGain();s.connect(f);f.connect(g);g.connect(AU.sfx);env(g,t,.005,dur,peak);s.start(t,Math.random()*2);s.stop(t+dur+.1);}
function tone(t,f0,f1,dur,peak,type){const c=AU.ctx,o=c.createOscillator();o.type=type||'sine';o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(Math.max(20,f1),t+dur);const g=c.createGain();o.connect(g);g.connect(AU.sfx);env(g,t,.004,dur,peak);o.start(t);o.stop(t+dur+.05);}
/* 0.6: sons curtos de navegação nos menus (sintetizados) */
AU.ui=function(kind){if(!AU.ctx||AU.settings.muted)return;const t=AU.ctx.currentTime+.005;const now=performance.now();if(kind==='move'&&now-(AU.uiT||0)<45)return;AU.uiT=now;
 if(kind==='move')tone(t,880,980,.05,.07,'triangle');else if(kind==='confirm'){tone(t,660,990,.08,.1,'triangle');tone(t+.06,990,1320,.1,.08,'sine');}else if(kind==='back')tone(t,700,420,.1,.09,'triangle');else if(kind==='error')tone(t,220,180,.16,.1,'square');};
AU.play=function(kind,o){if(!AU.ctx||AU.settings.muted)return;const t=AU.ctx.currentTime+.01;o=o||{};
 switch(kind){
  case'kick':tone(t,140,55,.12,.55*(o.power?Math.min(1.2,o.power/25):1));noise(t,.06,1800,1.2,.25);break;
  case'pass':tone(t,180,80,.08,.25);noise(t,.04,2200,1,.1);break;
  case'header':tone(t,220,120,.08,.3);break;
  case'touch':tone(t,200,120,.05,.15);break;
  case'whistle':{const c=AU.ctx;for(const [st,du] of (o.long?[[0,.9]]:o.final?[[0,.35],[.45,.35],[.9,1]]:[[0,.32]])){const os=c.createOscillator(),lfo=c.createOscillator(),lg=c.createGain(),g=c.createGain();os.type='sine';os.frequency.value=2900;lfo.frequency.value=38;lg.gain.value=110;lfo.connect(lg);lg.connect(os.frequency);os.connect(g);g.connect(AU.sfx);env(g,t+st,.01,du,.22);os.start(t+st);lfo.start(t+st);os.stop(t+st+du+.1);lfo.stop(t+st+du+.1);}break;}
  case'net':noise(t,.35,900,.6,.35,'lowpass');break;
  case'goal':noise(t,2.6,600,.3,.9,'bandpass');noise(t+.2,3,1200,.4,.55);AU.crowd(1);break;
  case'save':tone(t,110,60,.15,.5);noise(t,.12,600,1,.3);noise(t+.05,1.2,800,.4,.35);break;
  case'post':tone(t,1250,1180,.6,.25,'triangle');tone(t,1870,1800,.4,.12,'sine');noise(t+.05,1,700,.5,.4);break;
  case'oh':noise(t,1.2,500,.5,.45);break;
  case'card':tone(t,660,640,.12,.1,'square');break;
  case'tackle':noise(t,.12,400,.8,.35);tone(t,90,50,.12,.3);break;
  case'crowd_up':noise(t,1.5,900,.4,.4);break;}};

/* ---------- 0.5: música original da apresentação, arquivo do usuário, ambiente escolar e premiação ---------- */
const NOTE=n=>440*Math.pow(2,(n-69)/12);
function brass(t,midi,dur,peak){const c=AU.ctx,o=c.createOscillator(),o2=c.createOscillator(),f=c.createBiquadFilter(),g=c.createGain();o.type='sawtooth';o2.type='triangle';o.frequency.value=NOTE(midi);o2.frequency.value=NOTE(midi)*1.003;
 f.type='lowpass';f.frequency.setValueAtTime(600,t);f.frequency.linearRampToValueAtTime(2400,t+.08);f.frequency.exponentialRampToValueAtTime(900,t+dur);o.connect(f);o2.connect(f);f.connect(g);g.connect(AU.mus);
 g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(peak,t+.04);g.gain.setValueAtTime(peak*.8,t+dur*.7);g.gain.exponentialRampToValueAtTime(.0008,t+dur+.12);o.start(t);o2.start(t);o.stop(t+dur+.2);o2.stop(t+dur+.2);}
/* Fanfarra original MATCHDAY (composição própria, sintetizada em tempo real) */
const THEME=[[67,1],[72,1],[76,1],[79,2],[76,1],[77,1],[79,2],[74,1],[76,1],[72,2],[71,1],[72,1],[74,2],[67,2],[72,1],[76,1],[79,1],[84,2],[83,1],[81,1],[79,2],[77,1],[76,1],[74,1],[72,3]];
const BASS=[48,48,53,53,55,55,48,48,52,52,53,53,55,55,48,48];
AU.stopMusic=function(){if(AU.el){try{AU.el.pause();}catch(e){}AU.el=null;}if(AU.musT){clearTimeout(AU.musT);AU.musT=null;}if(AU.ctx&&AU.mus){const t=AU.ctx.currentTime;AU.mus.gain.cancelScheduledValues(t);AU.mus.gain.setTargetAtTime(0,t,.25);setTimeout(()=>AU.apply(),900);}};
AU.anthem=function(settings,seconds){if(!AU.init())return;AU.stopMusic();const s=settings||{};const mode=s.anthem||'synth';if(mode==='off'||AU.settings.muted)return;
 if(mode==='file'&&s.anthemFile){const url=MD.Data.Assets.url(s.anthemFile);if(url){const el=new Audio(url);el.volume=Math.min(1,(AU.settings.master||0)*(AU.settings.music??.6));el.play().catch(()=>{});AU.el=el;if(seconds)AU.musT=setTimeout(()=>AU.stopMusic(),seconds*1000);return;}}
 const c=AU.ctx;AU.apply();const beat=60/92;let t=c.currentTime+.1,i=0;const end=t+(seconds||12);
 while(t<end-.2){const [n,d]=THEME[i%THEME.length];brass(t,n,Math.max(.15,d*beat*.92),.16);if(i%2===0){const b=BASS[Math.floor(i/2)%BASS.length];brass(t,b,beat*1.8,.11);brass(t,b+7,beat*1.8,.05);}t+=d*beat;i++;}};
AU.champion=function(){if(!AU.init()||AU.settings.muted)return;const c=AU.ctx;let t=c.currentTime+.05;for(const [n,d] of [[72,.5],[76,.5],[79,.5],[84,1.4],[79,.4],[84,2]]){brass(t,n,d*.9,.18);brass(t,n-12,d*.9,.09);t+=d*.62;}noise(c.currentTime,4,900,.4,.6);AU.crowd(1);};
/* Ambiente: torcida no estádio, ou pátio da escola (vozes distantes + pássaros) no Germinare */
AU.ambience=function(kind){if(!AU.init())return;AU.amb=kind;if(AU.ambT){clearInterval(AU.ambT);AU.ambT=null;}if(kind!=='school')return;
 AU.ambT=setInterval(()=>{if(!AU.ctx||AU.settings.muted||AU.amb!=='school')return;const t=AU.ctx.currentTime;if(Math.random()<.55){const f=2600+Math.random()*1800;for(let k=0;k<2+Math.floor(Math.random()*3);k++)tone(t+k*.11,f,f*(.8+Math.random()*.4),.07,.035*AU.settings.crowd,'sine');}
  if(Math.random()<.35)noise(t,.6+Math.random()*.6,350+Math.random()*500,1.2,.05*AU.settings.crowd);},900);};
AU.cheer=function(level){if(!AU.ctx||AU.settings.muted)return;const t=AU.ctx.currentTime;noise(t,1.6,AU.amb==='school'?1400:900,.5,(AU.amb==='school'?.35:.5)*(level||1));};
MD.Audio=AU;
})(window.MD=window.MD||{});
