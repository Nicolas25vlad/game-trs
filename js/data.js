/* MATCHDAY 0.5 — modelo de dados: clubes, jogadores, atributos, uniformes, migração e persistência.
   Compatível com os dados salvos da 0.3 (chave localStorage 'matchday-clubs-v1', mantida intacta como backup). */
(function(MD){
'use strict';
const U=MD.U,clamp=U.clamp;
const num=(v,d)=>(v===null||v===undefined||v===''||!Number.isFinite(Number(v)))?d:Number(v);
const D={};
D.VERSION='0.5';
D.LEGACY_KEY='matchday-clubs-v1';
D.KEY='matchday-v04-clubs';
D.SETTINGS_KEY='matchday-v04-settings';

/* ---------- Atributos ---------- */
D.ATTRS=[
 ['pace','Velocidade','fis'],['accel','Aceleração','fis'],['stamina','Resistência','fis'],['strength','Força','fis'],['agility','Agilidade','fis'],['balance','Equilíbrio','fis'],['jumping','Impulsão','fis'],
 ['finishing','Finalização','ata'],['heading','Cabeceio','ata'],['composure','Frieza','men'],
 ['passing','Passe','tec'],['vision','Visão de jogo','tec'],['dribbling','Drible','tec'],['ballControl','Controle de bola','tec'],
 ['marking','Marcação','def'],['tackling','Desarme','def'],['positioning','Posicionamento','def'],['aggression','Agressividade','men'],
 ['gkReflexes','Reflexos (GOL)','gol'],['gkPositioning','Posicionamento (GOL)','gol'],['gkPenalties','Defesa de pênaltis','gol'],['gkKicking','Jogo com os pés (GOL)','gol']];
D.ATTR_KEYS=D.ATTRS.map(a=>a[0]);
D.GROUP_OF={FIX:'CB',ALD:'W',ALE:'W',PIV:'ST',GOL:'GK',ZAG:'CB',LD:'FB',LE:'FB','ALA-D':'FB','ALA-E':'FB',VOL:'DM',MC:'CM',MEI:'AM',PD:'W',PE:'W',MD:'W',ME:'W',ATA:'ST',SA:'ST'};
D.WEIGHTS={
 GK:{gkReflexes:.26,gkPositioning:.24,gkPenalties:.08,gkKicking:.10,jumping:.08,agility:.10,composure:.08,balance:.06},
 CB:{marking:.18,tackling:.18,positioning:.14,heading:.14,strength:.12,jumping:.06,pace:.06,passing:.06,composure:.06},
 FB:{pace:.14,accel:.08,tackling:.14,marking:.12,stamina:.10,passing:.12,positioning:.10,dribbling:.08,agility:.06,ballControl:.06},
 DM:{tackling:.14,marking:.12,positioning:.12,passing:.16,vision:.08,stamina:.10,strength:.10,ballControl:.10,composure:.08},
 CM:{passing:.20,vision:.14,ballControl:.14,stamina:.10,dribbling:.08,positioning:.08,tackling:.08,composure:.08,finishing:.05,agility:.05},
 AM:{vision:.18,passing:.16,dribbling:.16,ballControl:.14,finishing:.10,agility:.08,composure:.08,accel:.05,positioning:.05},
 W:{pace:.16,accel:.12,dribbling:.18,ballControl:.12,passing:.10,finishing:.10,agility:.10,balance:.06,vision:.06},
 ST:{finishing:.24,positioning:.14,heading:.10,ballControl:.10,composure:.10,pace:.08,accel:.06,strength:.08,dribbling:.06,jumping:.04}};
/* Perfil: deslocamento típico de cada atributo em relação ao overall por função. */
D.PROFILE={
 GK:{pace:-28,accel:-22,finishing:-55,heading:-40,dribbling:-45,marking:-45,tackling:-48,vision:-25,passing:-20,ballControl:-22,positioning:-30,aggression:-20},
 CB:{finishing:-30,dribbling:-18,vision:-14,agility:-8,gkReflexes:-60,gkPositioning:-60,gkPenalties:-60,gkKicking:-55,accel:-6},
 FB:{finishing:-24,heading:-10,gkReflexes:-60,gkPositioning:-60,gkPenalties:-60,gkKicking:-55,strength:-6},
 DM:{finishing:-16,pace:-6,dribbling:-8,gkReflexes:-60,gkPositioning:-60,gkPenalties:-60,gkKicking:-55},
 CM:{heading:-10,marking:-8,gkReflexes:-60,gkPositioning:-60,gkPenalties:-60,gkKicking:-55,strength:-4},
 AM:{marking:-24,tackling:-24,heading:-14,strength:-10,gkReflexes:-60,gkPositioning:-60,gkPenalties:-60,gkKicking:-55},
 W:{marking:-26,tackling:-26,heading:-12,strength:-10,gkReflexes:-60,gkPositioning:-60,gkPenalties:-60,gkKicking:-55},
 ST:{marking:-30,tackling:-30,passing:-6,vision:-8,gkReflexes:-60,gkPositioning:-60,gkPenalties:-60,gkKicking:-55}};
D.groupOf=pos=>D.GROUP_OF[pos]||'CM';
D.computeOverall=function(attrs,pos){const w=D.WEIGHTS[D.groupOf(pos)];let s=0,t=0;for(const k in w){s+=(Number(attrs[k])||50)*w[k];t+=w[k];}return clamp(Math.round(s/t),1,99);};
D.generateAttrs=function(target,pos,seed){const rng=U.rng(seed),g=D.groupOf(pos),prof=D.PROFILE[g]||{},attrs={};
 for(const k of D.ATTR_KEYS)attrs[k]=clamp(Math.round(target+(prof[k]||0)+rng.gauss()*5.5),15,99);
 attrs.aggression=clamp(Math.round(55+rng.gauss()*14+(g==='CB'||g==='DM'?8:0)),20,95);
 D.fitAttrs(attrs,pos,target);return attrs;};
/* Ajusta atributos relevantes para que o overall calculado bata com o alvo (edição rápida do overall). */
D.fitAttrs=function(attrs,pos,target){const w=D.WEIGHTS[D.groupOf(pos)];
 for(let it=0;it<6;it++){const cur=D.computeOverall(attrs,pos),d=target-cur;if(!d)break;for(const k in w)attrs[k]=clamp(Math.round((attrs[k]||50)+d),15,99);}
 return attrs;};

/* ---------- Formações (coordenadas no "quadro de ataque": gol próprio em x=-54, ataque para +x; direita = +z) ---------- */
D.FORMATIONS={
 '4-3-3':[['GOL',-50,0],['LD',-32,21],['ZAG',-38,7],['ZAG',-38,-7],['LE',-32,-21],['VOL',-25,0],['MC',-15,11],['MEI',-11,-10],['PD',1,23],['ATA',5,0],['PE',1,-23]],
 '4-4-2':[['GOL',-50,0],['LD',-32,21],['ZAG',-38,7],['ZAG',-38,-7],['LE',-32,-21],['VOL',-21,6],['MC',-21,-6],['SA',2,-6],['MD',-13,22],['ATA',3,6],['ME',-13,-22]],
 '4-2-3-1':[['GOL',-50,0],['LD',-32,21],['ZAG',-38,7],['ZAG',-38,-7],['LE',-32,-21],['VOL',-23,6],['VOL',-23,-6],['MEI',-7,0],['PD',-3,21],['ATA',7,0],['PE',-3,-21]],
 '3-5-2':[['GOL',-50,0],['ZAG',-36,13],['ZAG',-39,0],['ZAG',-36,-13],['ALA-E',-17,-26],['VOL',-25,0],['MC',-14,11],['MEI',-12,-9],['ALA-D',-17,26],['ATA',4,5],['SA',3,-6]],
 '5-3-2':[['GOL',-50,0],['ALA-D',-29,25],['ZAG',-38,10],['ZAG',-40,0],['ZAG',-38,-10],['VOL',-23,0],['MC',-17,12],['MC',-17,-12],['ALA-E',-29,-25],['ATA',2,5],['SA',1,-6]]};
D.formationSlots=f=>(D.FORMATIONS[f]||(MD.Modes&&MD.Modes.FORMATIONS_G[f])||D.FORMATIONS['4-3-3']).map(s=>({pos:s[0],x:s[1],z:s[2],group:D.groupOf(s[0])}));
D.LEGACY_POSITIONS=['GOL','LD','ZAG','ZAG','LE','VOL','MC','MEI','PD','ATA','PE'];
D.LEGACY_NUMBERS=[1,2,3,4,6,5,8,10,7,9,11];
D.TACTIC_DEFAULT={formation:'4-3-3',mentality:'balanced',pressing:'mid',marking:'zonal',width:'normal',tempo:'normal',style:'balanced'};

/* ---------- Aparência ---------- */
D.HAIR=[['short','Curto'],['medium','Médio'],['long','Comprido'],['shaved','Raspado'],['bald','Careca'],['mohawk','Moicano'],['curly','Cacheado'],['kinky','Crespo'],['wavy','Ondulado'],['straight','Liso'],['afro','Black power'],['braids','Tranças'],['dreads','Dreads'],['bun','Coque'],['ponytail','Rabo de cavalo'],['quiff','Topete'],['fringe','Franja'],['spiky','Espetado'],['parted','Dividido'],['fade','Degradê'],['cap','Boné (0.3)']];
D.BEARD=[['none','Sem barba'],['short','Barba curta'],['full','Barba cheia'],['long','Barba longa'],['goatee','Cavanhaque'],['thinMustache','Bigode fino'],['thickMustache','Bigode grosso'],['mustacheGoatee','Bigode + cavanhaque'],['sideburns','Costeletas'],['stubble','Barba por fazer']];
D.HEADS=[['round','Redonda'],['oval','Oval'],['square','Quadrada'],['long','Alongada'],['heart','Coração'],['wide','Larga']];
D.BODIES=[['normal','Atlético'],['slim','Magro'],['strong','Forte'],['square','Quadrado'],['round','Redondinho'],['star','Estrela'],['sponge','Esponja']];
D.PERSONALITIES=[['showman','Showman'],['passionate','Emotivo'],['humble','Humilde'],['cool','Frio'],['funny','Brincalhão'],['leader','Líder']];
D.APPEARANCE_NUM={height:[.65,1.6],headSize:[.65,2.3],headWidth:[.7,1.6],jaw:[.6,1.5],chin:[.5,1.6],nose:[.5,1.9],ears:[.5,1.9],eyeSize:[.6,1.7],brows:[.4,1.9],hairVolume:[.6,1.7],bodyWidth:[.55,2],shoulders:[.65,1.8],torso:[.7,1.45],belly:[0,1.6],armLength:[.6,1.65],forearm:[.6,1.8],hands:[.6,1.9],legLength:[.55,1.65],legThick:[.6,1.8],feet:[.6,1.9]};
D.SKINS=['#f4c8a8','#dba47a','#8b5239','#f1d0ac','#be855e','#5e3726','#e8b48d','#a8714c'];
D.defaultAppearance=function(i=0){return{skin:D.SKINS[i%5],hairColor:['#27211d','#482b23','#171d26','#80562d'][i%4],beardColor:['#27211d','#482b23','#171d26','#80562d'][i%4],eyeColor:'#245486',mouthColor:'#9a5048',
 hairStyle:['short','spiky','curly','afro','mohawk','long','fade','bald'][i%8],beardStyle:['none','stubble','none','short','none','goatee'][i%6],headShape:'round',bodyShape:'normal',expression:'auto',
 height:1,headSize:1.12,headWidth:1,jaw:1,chin:1,nose:1,ears:1,eyeSize:1,brows:1,hairVolume:1,bodyWidth:1,shoulders:1,torso:1,belly:0,armLength:1,forearm:1,hands:1,legLength:1,legThick:1,feet:1,
 headband:'',wristbands:'',thermal:'',bootColor:['#14202b','#f4f4f4','#ff5a36','#22c3ff','#ffd23f'][i%5],bootColor2:'#ffffff',bootSize:40+(i%6)};};
D.sanitizeAppearance=function(app,i){const base=D.defaultAppearance(i),out={...base};app=app||{};
 for(const k in D.APPEARANCE_NUM){const r=D.APPEARANCE_NUM[k],v=Number(app[k]);out[k]=Number.isFinite(v)?clamp(v,r[0],r[1]):base[k];}
 for(const k of ['skin','hairColor','beardColor','eyeColor','mouthColor','bootColor','bootColor2'])out[k]=U.isHex(app[k])?app[k]:(k==='beardColor'&&U.isHex(app.hairColor)?app.hairColor:base[k]);
 for(const k of ['headband','wristbands','thermal'])out[k]=U.isHex(app[k])?app[k]:'';
 const legacyHair={afro:'afro'};let hs=legacyHair[app.hairStyle]||app.hairStyle;
 out.hairStyle=D.HAIR.some(h=>h[0]===hs)?hs:base.hairStyle;
 out.beardStyle=D.BEARD.some(h=>h[0]===app.beardStyle)?app.beardStyle:(app.beardStyle===undefined?base.beardStyle:'none');
 out.headShape=D.HEADS.some(h=>h[0]===app.headShape)?app.headShape:'round';
 out.bodyShape=D.BODIES.some(h=>h[0]===app.bodyShape)?app.bodyShape:'normal';
 out.bootSize=clamp(Math.round(Number(app.bootSize)||base.bootSize),30,52);
 out.expression='auto';return out;};

/* ---------- Uniformes ---------- */
D.PATTERNS=[['plain','Liso'],['stripes','Listras verticais'],['pinstripes','Listras finas'],['hoops','Listras horizontais'],['diagonal','Listras diagonais'],['sash','Faixa diagonal'],['band','Faixa horizontal'],['gradient','Gradiente'],['half','Duas cores (metades)'],['thirds','Três cores'],['quarters','Quartos'],['checker','Quadriculado'],['chevron','Chevron'],['diamonds','Losangos'],['triangles','Triângulos'],['waves','Ondas']];
D.COLLARS=[['round','Redonda'],['v','Gola V'],['polo','Polo'],['crew','Careca larga'],['henley','Botões'],['wrap','Transpassada']];
D.defaultKit=function(primary,secondary,accent){return{primary:primary||'#c9ff52',secondary:secondary||'#ffffff',accent:accent||'#ffe8a0',pattern:'plain',patternSize:15,collar:'round',sleeves:'short',sleeveColor:'main',cuffs:true,shoulders:'none',sides:'none',sleeveDetail:'none',
 numberColor:'',numberFont:'block',showName:true,showCrest:true,stitch:true,shortsColor:secondary||'#ffffff',shortsColor2:primary||'#c9ff52',shortsPattern:'side',socksColor:primary||'#c9ff52',socksColor2:secondary||'#ffffff',socksPattern:'top',
 sponsors:[],art:null,paint:null};};
D.sanitizeKit=function(k,fallback){const d=D.defaultKit(fallback?.primary,fallback?.secondary,fallback?.accent),o={...d};k=k||{};
 for(const key of ['primary','secondary','accent','shortsColor','shortsColor2','socksColor','socksColor2'])o[key]=U.isHex(k[key])?k[key]:d[key];
 o.numberColor=U.isHex(k.numberColor)?k.numberColor:'';
 const pick=(v,list,def)=>list.some(x=>(x[0]||x)===v)?v:def;
 o.pattern=pick(k.pattern,D.PATTERNS,'plain');o.collar=pick(k.collar,D.COLLARS,'round');
 o.sleeves=k.sleeves==='long'?'long':'short';o.sleeveColor=['main','secondary','accent'].includes(k.sleeveColor)?k.sleeveColor:'main';
 o.shoulders=['none','stripes','panel','yoke'].includes(k.shoulders)?k.shoulders:'none';o.sides=['none','panel','stripe'].includes(k.sides)?k.sides:'none';
 o.sleeveDetail=['none','stripe','band','tip'].includes(k.sleeveDetail)?k.sleeveDetail:'none';o.numberFont=['block','classic','round','condensed'].includes(k.numberFont)?k.numberFont:'block';
 o.shortsPattern=['plain','side','stripe','hoop','split'].includes(k.shortsPattern)?k.shortsPattern:'side';o.socksPattern=['plain','top','hoops','band','split'].includes(k.socksPattern)?k.socksPattern:'top';
 o.patternSize=clamp(Number(k.patternSize)||15,4,40);
 for(const key of ['cuffs','showName','showCrest','stitch'])o[key]=k[key]===undefined?d[key]:!!k[key];
 o.sponsors=(Array.isArray(k.sponsors)?k.sponsors:[]).slice(0,5).filter(s=>s&&s.img).map((s,i)=>({id:s.id||U.uid('sp'),img:s.img,area:['front','back','lsleeve','rsleeve','shorts'].includes(s.area)?s.area:'front',x:clamp(num(s.x,50),0,100),y:clamp(num(s.y,45),0,100),scale:clamp(num(s.scale,40),5,100),rot:clamp(num(s.rot,0),-180,180),opacity:clamp(num(s.opacity,1),0,1),z:Number.isFinite(Number(s.z))?Number(s.z):i}));
 if(k.art&&k.art.img)o.art={img:k.art.img,mode:['front','back','both','sheet'].includes(k.art.mode)?k.art.mode:'front',zoom:clamp(Number(k.art.zoom)||100,20,300),x:clamp(Number(k.art.x)||0,-100,100),y:clamp(Number(k.art.y)||0,-100,100),rot:clamp(Number(k.art.rot)||0,-180,180),crop:clamp(Number(k.art.crop)||100,30,100),opacity:clamp(num(k.art.opacity,1),0,1)};else o.art=null;
 o.paint=k.paint||null;return o;};
/* Converte os campos de uniforme da 0.3 (planos no clube) para o novo modelo de kits. */
D.legacyKit=function(c){const k=D.defaultKit(c.primary,c.secondary,c.kitAccent);
 k.pattern=c.pattern||'plain';k.collar=c.kitCollar||'round';k.sleeveColor=c.kitSleeves||'main';k.shortsColor=c.kitShorts||c.secondary||'#ffffff';k.socksColor=c.kitSocks||c.primary||'#ffffff';k.patternSize=Number(c.kitStripeSize)||15;
 if(c.kitSponsor)k.sponsors=[{id:U.uid('sp'),img:c.kitSponsor,area:'front',x:Number(c.kitSponsorX)||50,y:Number(c.kitSponsorY)||43,scale:Number(c.kitSponsorSize)||48,rot:0,opacity:1,z:0}];
 if(c.kitArt)k.art={img:c.kitArt,mode:c.kitTemplateType==='sheet'?'sheet':'front',zoom:Number(c.kitTemplateZoom)||100,x:Number(c.kitTemplateX)||0,y:Number(c.kitTemplateY)||0,rot:0,crop:100,opacity:1};
 return k;};

/* ---------- Clubes e jogadores ---------- */
const GIVEN=['Gabriel','Rafael','Lucas','Guilherme','Pedro','Matheus','Joao','Enzo','Thiago','Andre','Vinicius','Caio','Bruno','Igor','Daniel','Felipe','Gustavo','Davi','Renan','Leo','Carlos','Nicolas','Eduardo','Samuel','Vitor','Alan','Diego','Miguel','Yuri','Arthur','Tomas','Henrique','Bernardo','Wesley','Roberto','Marcos','Antonio','Emanuel','Alex','Cesar','Luis'];
const SURN=['Costa','Martins','Almeida','Carvalho','Oliveira','Mendes','Rocha','Barbosa','Silva','Ribeiro','Santos','Azevedo','Vieira','Moreira','Cunha','Freitas','Nogueira','Ferreira','Lima','Pereira','Cardoso','Castro','Campos','Tavares','Monteiro','Teixeira','Neves','Vargas','Lopes','Batista','Sales'];
D.PRESETS=[['Monte Verde FC','Sao Paulo, BR','#c9ff52','#123e31','#ffbd4b',83,'MV'],['Aurora Athletic','Porto Alegre, BR','#8b78fe','#e7f2ff','#efb64e',79,'AA'],['Estrela Azul','Rio de Janeiro, BR','#32b7f9','#e3f5ff','#f7a44b',80,'EA'],['Vila Carmim','Curitiba, BR','#ff526a','#ffffff','#c8d642',77,'VC'],['Real Atlantico','Recife, BR','#187aa5','#f5d39a','#f7794c',82,'RA'],['Uniao Dourada','Belo Horizonte, BR','#f5b33e','#252a42','#42d2ca',75,'UD']];
const BENCH_POS=['GOL','ZAG','LD','VOL','MC','PD','ATA'];
D.makePlayer=function(seed,i,pos,number,rating,name){const s=U.hashStr(seed+':'+i);const r=U.rng(s);
 const attrs=D.generateAttrs(rating,pos,s);
 return{id:'p-'+seed+'-'+i,number,position:pos,name,rating:D.computeOverall(attrs,pos),photo:null,appearance:D.sanitizeAppearance(D.defaultAppearance(i+(s%7)),i),attrs,personality:r.pick(D.PERSONALITIES)[0],foot:r()<.22?'L':'R'};};
D.makeRoster=function(seed,rating){/* mesma fórmula de nomes/notas da 0.3 para manter os clubes padrão idênticos */
 return Array.from({length:11},(_,i)=>{const name=GIVEN[(seed*8+i*7)%GIVEN.length]+' '+SURN[(seed*4+i*9)%SURN.length],r=clamp(rating+((i*7+seed*3)%13)-6,55,97);
  const p=D.makePlayer('c'+seed,i,D.LEGACY_POSITIONS[i],D.LEGACY_NUMBERS[i],r,name);p.appearance=D.sanitizeAppearance(D.defaultAppearance(i+seed),i);return p;});};
D.makeBench=function(seed,rating,usedNumbers){const used=new Set(usedNumbers||[]);let n=12;
 return BENCH_POS.map((pos,i)=>{while(used.has(n))n++;used.add(n);const name=GIVEN[(seed*5+i*11+3)%GIVEN.length]+' '+SURN[(seed*7+i*5+2)%SURN.length];
  return D.makePlayer('b'+seed,i,pos,pos==='GOL'?(used.has(12)?n:12):n,clamp(rating-4+((i*5+seed)%7)-3,50,95),name);});};
D.freshClub=function(row,i){const c={id:'club-'+i,name:row[0],city:row[1],primary:row[2],secondary:row[3],keeper:row[4],short:row[6],crest:null,players:D.makeRoster(i+1,row[5]),pattern:'plain'};
 return D.ensureClub(c,i+1);};
D.newClub=function(){const seed=Math.floor(Math.random()*1e5)+50;return D.ensureClub({id:U.uid('club'),name:'Novo Clube FC',city:'Minha cidade',primary:'#c9ff52',secondary:'#ffffff',keeper:'#ffb951',short:'NC',crest:null,players:D.makeRoster(22,72)},seed);};
/* Garante todos os campos da 0.4 com valores padrão. Não remove campos antigos (compatibilidade). */
D.ensureClub=function(c,seed){c=c||{};seed=seed||U.hashStr(c.id||c.name||'x')%997;
 c.id=c.id||U.uid('club');c.name=String(c.name||'Clube').slice(0,30);c.city=String(c.city||'').slice(0,45);
 for(const k of ['primary','secondary','keeper'])if(!U.isHex(c[k]))c[k]=k==='primary'?'#c9ff52':k==='secondary'?'#ffffff':'#ffbd4b';
 c.short=(c.short||U.initials(c.name)).slice(0,3).toUpperCase();
 if(!c.kits||typeof c.kits!=='object'){const home=D.legacyKit(c);const away=D.defaultKit(c.secondary,c.primary,c.keeper);away.pattern='plain';away.shortsColor=c.secondary;away.socksColor=c.secondary;
  const third=D.defaultKit('#1b2333',c.primary,c.secondary);third.pattern='sash';const gk=D.defaultKit(c.keeper,'#1d2733','#ffffff');gk.pattern='plain';gk.sleeves='long';gk.shortsColor='#1d2733';gk.socksColor=c.keeper;
  c.kits={home,away,third,gk};}
 for(const k of ['home','away','third','gk'])c.kits[k]=D.sanitizeKit(c.kits[k],k==='gk'?{primary:c.keeper,secondary:'#1d2733'}:{primary:c.primary,secondary:c.secondary,accent:c.keeper});
 c.tactics={...D.TACTIC_DEFAULT,...(c.tactics||{})};if(!D.FORMATIONS[c.tactics.formation])c.tactics.formation='4-3-3';
 if(!Array.isArray(c.players))c.players=[];
 while(c.players.length<11){const i=c.players.length;c.players.push(D.makePlayer('fill'+seed,i,D.LEGACY_POSITIONS[i],D.LEGACY_NUMBERS[i],70,'Jogador '+(i+1)));}
 const slots=D.formationSlots(c.tactics.formation);
 c.players=c.players.slice(0,11).map((p,i)=>D.ensurePlayer(p,i,slots[i].pos,seed));
 if(!Array.isArray(c.bench)||!c.bench.length)c.bench=D.makeBench(seed,D.teamOverall(c),c.players.map(p=>p.number));
 c.bench=c.bench.slice(0,45).map((p,i)=>D.ensurePlayer(p,20+i,p.position||BENCH_POS[i%BENCH_POS.length],seed));
 c.stadiumName=c.stadiumName||'Arena MATCHDAY';c.schemaVersion=5;return c;};
/* Banco do dia de jogo: os 12 reservas mais fortes, sempre com um goleiro. */
D.matchdayBench=function(bench){const b=(bench||[]).filter(p=>!p.placeholder).slice().sort((x,y)=>y.rating-x.rating);const gk=b.find(p=>D.groupOf(p.position)==='GK');const out=b.filter(p=>p!==gk).slice(0,gk?11:12);if(gk)out.unshift(gk);return out;};
D.ensurePlayer=function(p,i,pos,seed){p=p||{};p.id=p.id||U.uid('p');p.name=String(p.name||'Jogador').slice(0,38);p.number=clamp(Math.round(Number(p.number)||i+1),1,99);p.position=pos||p.position||'MC';
 const legacyRating=clamp(Math.round(Number(p.rating)||70),1,99);
 if(!p.attrs||typeof p.attrs!=='object'){p.attrs=D.generateAttrs(legacyRating,p.position,U.hashStr(p.id+':'+seed));}
 else for(const k of D.ATTR_KEYS)p.attrs[k]=clamp(Math.round(Number(p.attrs[k])||50),1,99);
 p.rating=D.computeOverall(p.attrs,p.position);
 p.appearance=D.sanitizeAppearance(p.appearance,i);
 if(!D.PERSONALITIES.some(x=>x[0]===p.personality))p.personality=D.PERSONALITIES[U.hashStr(p.id)%D.PERSONALITIES.length][0];
 p.foot=p.foot==='L'?'L':'R';p.photo=p.photo||null;return p;};
/* Overall do time = média simples das notas dos 11 titulares (regra mantida da 0.3). */
D.teamOverall=c=>{const l=(c.players||[]).slice(0,11);return l.length?Math.round(l.reduce((n,p)=>n+Number(p.rating||50),0)/l.length):0;};
D.setFormation=function(c,f){if(!D.FORMATIONS[f])return;c.tactics.formation=f;const slots=D.formationSlots(f);c.players.forEach((p,i)=>{p.position=slots[i].pos;p.rating=D.computeOverall(p.attrs,p.position);});};
D.sectorRatings=function(c){const g={GK:[],DEF:[],MID:[],ATT:[]};c.players.slice(0,11).forEach(p=>{const gr=D.groupOf(p.position);(gr==='GK'?g.GK:gr==='CB'||gr==='FB'?g.DEF:gr==='DM'||gr==='CM'||gr==='AM'?g.MID:g.ATT).push(p.rating);});
 const avg=a=>a.length?Math.round(a.reduce((x,y)=>x+y,0)/a.length):0;return{GK:avg(g.GK),DEF:avg(g.DEF),MID:avg(g.MID),ATT:avg(g.ATT)};};

/* ---------- Ativos (imagens) — IndexedDB com fallback ---------- */
const Assets={mem:new Map(),db:null,ok:false};
Assets.isRef=v=>typeof v==='string'&&v.startsWith('asset:');
Assets.url=v=>Assets.isRef(v)?(Assets.mem.get(v)||null):(v||null);
Assets.put=function(dataUrl){if(!dataUrl)return null;if(Assets.isRef(dataUrl))return dataUrl;
 const id='asset:'+U.hashStr(dataUrl).toString(36)+'-'+dataUrl.length.toString(36);
 if(!Assets.mem.has(id)){Assets.mem.set(id,dataUrl);if(Assets.db){try{const tx=Assets.db.transaction('assets','readwrite');tx.objectStore('assets').put({id,data:dataUrl});}catch(e){}}}
 return id;};
Assets.open=function(){return new Promise(res=>{try{if(typeof indexedDB==='undefined')return res(false);const rq=indexedDB.open('matchday-v04',1);
 rq.onupgradeneeded=()=>{rq.result.createObjectStore('assets',{keyPath:'id'});};
 rq.onsuccess=()=>{Assets.db=rq.result;Assets.ok=true;const tx=Assets.db.transaction('assets','readonly'),all=tx.objectStore('assets').getAll();all.onsuccess=()=>{for(const r of all.result||[])Assets.mem.set(r.id,r.data);res(true);};all.onerror=()=>res(true);};
 rq.onerror=()=>res(false);setTimeout(()=>res(Assets.ok),2500);}catch(e){res(false);}});};
Assets.gc=function(used){if(!Assets.db)return;try{const tx=Assets.db.transaction('assets','readwrite'),st=tx.objectStore('assets');for(const id of Assets.mem.keys())if(!used.has(id)){st.delete(id);Assets.mem.delete(id);}}catch(e){}};
D.Assets=Assets;
/* Percorre todos os campos de imagem de um clube. fn(valor) devolve o novo valor. */
D.mapImages=function(c,fn){c.crest=fn(c.crest);for(const p of [...(c.players||[]),...(c.bench||[])])p.photo=fn(p.photo);
 for(const k of Object.values(c.kits||{})){if(!k)continue;for(const s of k.sponsors||[])s.img=fn(s.img);if(k.art)k.art.img=fn(k.art.img);k.paint=fn(k.paint);}return c;};
D.internalize=c=>D.mapImages(c,v=>typeof v==='string'&&v.startsWith('data:image/')?Assets.put(v):v);
D.externalize=c=>D.mapImages(U.deepClone(c),v=>Assets.url(v));

/* 0.5: um único clube salvo também é preservado (o catálogo garante adversários); antes exigia 2 */
D.loadClubs=function(){let raw=null,legacy=false;try{raw=JSON.parse(localStorage.getItem(D.KEY)||'null');}catch(e){}
 if(!(Array.isArray(raw)&&raw.length>=1)){try{raw=JSON.parse(localStorage.getItem(D.LEGACY_KEY)||'null');legacy=true;}catch(e){raw=null;}}
 let clubs,fresh=false;if(Array.isArray(raw)&&raw.length>=1&&raw.every(c=>c&&Array.isArray(c.players)))clubs=raw.map((c,i)=>D.internalize(D.ensureClub(c,i+1)));
 else{clubs=D.PRESETS.map(D.freshClub);legacy=false;fresh=true;}
 return{clubs,migrated:legacy&&Array.isArray(raw),fresh};};
D.saveClubs=function(clubs){const used=new Set();const out=clubs.map(c=>D.mapImages(U.deepClone(c),v=>{if(Assets.isRef(v)){used.add(v);return Assets.db?v:Assets.url(v);}return v;}));
 try{localStorage.setItem(D.KEY,JSON.stringify(out));if(Assets.db)Assets.gc(used);return true;}catch(e){return false;}};

/* ---------- Importação / exportação ---------- */
D.cleanImage=v=>typeof v==='string'&&/^data:image\/(png|jpeg|webp|gif);base64,[a-zA-Z0-9+/=]+$/.test(v)&&v.length<3500000?v:null;
D.exportClub=c=>JSON.stringify({format:'matchday-club-v04',version:D.VERSION,club:D.externalize(c)},null,1);
D.importClub=function(text){const data=JSON.parse(text),src=data.club||data;
 if(!src||typeof src.name!=='string'||!Array.isArray(src.players)||src.players.length<11)throw Error('Formato de clube inválido.');
 const c=U.deepClone(src);c.id=U.uid('club-import');
 D.mapImages(c,v=>typeof v==='string'?D.cleanImage(v):null);
 for(const k of ['kitSponsor','kitArt'])c[k]=D.cleanImage(c[k]);
 c.players=c.players.slice(0,11);c.players.forEach((p,i)=>{p.id=U.uid('p-imp');if(p.attrs&&typeof p.attrs!=='object')delete p.attrs;});
 if(Array.isArray(c.bench))c.bench.forEach(p=>p.id=U.uid('p-imp'));
 return D.internalize(D.ensureClub(c,U.hashStr(c.name)%997));};

/* ---------- Configurações ---------- */
D.DEFAULT_SETTINGS={quality:'auto',diagnostics:false,master:.8,crowd:.7,sfx:.85,music:.6,muted:false,highlightRate:'normal',clockSpeed:36,seed:'',maxSubs:5,autoSubs:true,replays:true,celebrations:true,slowmo:true,difficultyVariance:'normal',
 pace:'normal',cinema:true,cam:'auto',anthem:'synth',anthemFile:null,anthemName:'',germinare:{minutes:5,goalsToWin:2,penalties:true,restart:'kick',pace:'normal',cinema:true}};
D.loadSettings=()=>{try{const s={...D.DEFAULT_SETTINGS,...JSON.parse(localStorage.getItem(D.SETTINGS_KEY)||'{}')};s.germinare={...D.DEFAULT_SETTINGS.germinare,...(s.germinare||{})};return s;}catch(e){return{...D.DEFAULT_SETTINGS};}};
D.saveSettings=s=>{try{localStorage.setItem(D.SETTINGS_KEY,JSON.stringify(s));}catch(e){}};
MD.Data=D;
})(typeof window!=='undefined'?(window.MD=window.MD||{}):(globalThis.MD=globalThis.MD||{}));
