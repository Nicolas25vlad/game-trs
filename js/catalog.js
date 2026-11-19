/* MATCHDAY 0.5 — catálogo hierárquico País → Liga → Clube → Elenco → Jogador.
   Separa claramente:
   - DADOS PADRÃO do jogo (data/catalog_br_2026.js, gerado a partir da pesquisa registrada) — nunca são gravados;
   - DADOS DO USUÁRIO: clubes padrão que ele editou ("overrides", por id), clubes criados/importados e os clubes
     da 0.3/0.4 (migrados sem perda), ligas personalizadas.
   Uma atualização de versão troca só os dados padrão: o que o usuário personalizou continua valendo. */
(function(MD){
'use strict';
const U=MD.U,D=MD.Data;
const CAT={KEY_OVR:'matchday-v05-club-overrides',KEY_USER:'matchday-v05-user-clubs',KEY_LEAGUES:'matchday-v05-leagues',KEY_MIG:'matchday-v05-migrated'};
CAT.countries=[];CAT.leagues=[];CAT.defaults=new Map();CAT.overrides={};CAT.userIds=new Set();CAT.meta=null;
/* 0.6: Continente → País → Liga → Clube → Elenco. A liga genérica das primeiras versões saiu do catálogo padrão;
   clubes genéricos que o usuário editou ficam em "Clubes personalizados" (nada é apagado; os não editados vão para um backup). */
CAT.KEY_MIG6='trs26-v06-generic-migrated';CAT.KEY_GENERIC_BACKUP='trs26-v06-generic-backup';CAT.KEY_FAV='trs26-favorites';
CAT.continents=[{id:'SA',name:'América do Sul'},{id:'EU',name:'Europa'},{id:'NA',name:'América do Norte'},{id:'AS',name:'Ásia'},{id:'XX',name:'Personalizados'}];
const BASE_COUNTRIES=[{id:'MD',name:'Clubes personalizados',flag:'⭐',continent:'XX'},
 {id:'ENG',name:'Inglaterra',flag:'🏴',continent:'EU'},{id:'ESP',name:'Espanha',flag:'🇪🇸',continent:'EU'},{id:'ITA',name:'Itália',flag:'🇮🇹',continent:'EU'},{id:'GER',name:'Alemanha',flag:'🇩🇪',continent:'EU'},{id:'FRA',name:'França',flag:'🇫🇷',continent:'EU'},{id:'POR',name:'Portugal',flag:'🇵🇹',continent:'EU'},{id:'NED',name:'Países Baixos',flag:'🇳🇱',continent:'EU'},
 {id:'ARG',name:'Argentina',flag:'🇦🇷',continent:'SA'},{id:'URU',name:'Uruguai',flag:'🇺🇾',continent:'SA'},{id:'CHI',name:'Chile',flag:'🇨🇱',continent:'SA'},{id:'COL',name:'Colômbia',flag:'🇨🇴',continent:'SA'},
 {id:'USA',name:'Estados Unidos / Canadá',flag:'🇺🇸',continent:'NA'},{id:'MEX',name:'México',flag:'🇲🇽',continent:'NA'},{id:'JPN',name:'Japão',flag:'🇯🇵',continent:'AS'},{id:'KSA',name:'Arábia Saudita',flag:'🇸🇦',continent:'AS'}];
const PEND='Elencos 2026 ainda não cadastrados nesta versão (pesquisa pendente). Você pode criar clubes aqui manualmente.';
const BASE_LEAGUES=[{id:'meus-clubes',country:'MD',name:'Clubes personalizados',tier:1,custom:true},
 {id:'eng-1',country:'ENG',name:'Premier League',tier:1,pending:PEND},{id:'eng-2',country:'ENG',name:'Championship',tier:2,pending:PEND},{id:'esp-1',country:'ESP',name:'La Liga',tier:1,pending:PEND},{id:'esp-2',country:'ESP',name:'Segunda División',tier:2,pending:PEND},
 {id:'ita-1',country:'ITA',name:'Serie A',tier:1,pending:PEND},{id:'ger-1',country:'GER',name:'Bundesliga',tier:1,pending:PEND},{id:'fra-1',country:'FRA',name:'Ligue 1',tier:1,pending:PEND},{id:'por-1',country:'POR',name:'Primeira Liga',tier:1,pending:PEND},{id:'ned-1',country:'NED',name:'Eredivisie',tier:1,pending:PEND},
 {id:'arg-1',country:'ARG',name:'Primera División',tier:1,pending:PEND},{id:'uru-1',country:'URU',name:'Primera División',tier:1,pending:PEND},{id:'chi-1',country:'CHI',name:'Primera División',tier:1,pending:PEND},{id:'col-1',country:'COL',name:'Primera A',tier:1,pending:PEND},
 {id:'mls',country:'USA',name:'MLS',tier:1,pending:PEND},{id:'mex-1',country:'MEX',name:'Liga MX',tier:1,pending:PEND},{id:'jpn-1',country:'JPN',name:'J1 League',tier:1,pending:PEND},{id:'ksa-1',country:'KSA',name:'Saudi Pro League',tier:1,pending:PEND}];
CAT.continentOf=countryId=>{const c=CAT.countries.find(x=>x.id===countryId);return c?(c.continent||(c.id==='BR'?'SA':'XX')):'XX';};
CAT.favorites=()=>new Set(ls.get(CAT.KEY_FAV)||[]);CAT.toggleFav=id=>{const f=CAT.favorites();f.has(id)?f.delete(id):f.add(id);ls.set(CAT.KEY_FAV,[...f]);return f.has(id);};
/* um clube genérico da 0.3/0.4 está intacto se for idêntico ao gerado de novo pelo mesmo modelo */
function genericUntouched(c){try{const m=/^club-([0-5])$/.exec(c.id);if(!m||!D.PRESETS||!D.freshClub)return false;const i=+m[1];const fresh=D.ensureClub(D.freshClub(D.PRESETS[i],i));
 const sig=x=>JSON.stringify({n:x.name,s:x.short,p:x.primary,q:x.secondary,k:x.kits&&x.kits.home&&[x.kits.home.primary,x.kits.home.pattern,(x.kits.home.sponsors||[]).length,x.kits.home.art||null],pl:(x.players||[]).map(p=>[p.name,p.rating,p.number,p.position,p.photo||null,JSON.stringify(p.appearance||{})]),cr:x.crest||null});
 return sig(fresh)===sig(D.ensureClub(U.deepClone(c)));}catch(e){return false;}}
const ls={get:k=>{try{return JSON.parse(localStorage.getItem(k)||'null');}catch(e){return null;}},set:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true;}catch(e){return false;}}};
/* ---------- expansão de um clube padrão para o modelo completo do jogo ---------- */
const SLOTS433=['GOL','LD','ZAG','ZAG','LE','VOL','MC','MEI','PD','ATA','PE'];
const compat={GOL:['GOL'],LD:['LD','ZAG','LE'],LE:['LE','ZAG','LD'],ZAG:['ZAG','LD','LE','VOL'],VOL:['VOL','MC','ZAG'],MC:['MC','VOL','MEI'],MEI:['MEI','MC','PD','PE'],PD:['PD','PE','ATA','MEI'],PE:['PE','PD','ATA','MEI'],ATA:['ATA','PD','PE','MEI']};
function expandPlayer(row,club,i){const seed=U.hashStr(row.id);const attrs=D.generateAttrs(row.rating,row.position,seed);D.fitAttrs(attrs,row.position,row.rating);
 const r=U.rng(seed);const app=D.sanitizeAppearance(D.defaultAppearance(seed%97),i);app.height=Math.round((.94+r()*.14)*100)/100;
 return{id:row.id,number:row.number,position:row.position,name:row.name,shirtName:row.shirt||row.name,rating:D.computeOverall(attrs,row.position),photo:null,appearance:app,attrs,
  personality:D.PERSONALITIES[seed%D.PERSONALITIES.length][0],foot:r()<.22?'L':'R',age:row.age||null,nationality:row.nationality||null,
  est:{rating:true,attrs:true,foot:true,height:true,number:!!row.numberEstimated,position:!!row.positionEstimated},unverified:!!row.unverified,placeholder:!!row.placeholder,clubId:club.id};}
function pickXI(players){const pool=players.slice();const xi=[];
 const order=[0,2,3,1,4,5,6,7,9,8,10];const chosen=new Array(11);
 for(const si of order){const slot=SLOTS433[si];let best=null,bs=-1;for(const p of pool){const ok=compat[slot].indexOf(p.position);if(ok<0)continue;const s=D.computeOverall(p.attrs,slot)-ok*2-(p.placeholder?20:0);if(s>bs){bs=s;best=p;}}
  if(!best)best=pool[0];pool.splice(pool.indexOf(best),1);chosen[si]=best;}
 return{xi:chosen,rest:pool.sort((a,b)=>b.rating-a.rating)};}
CAT.expand=function(c){const kit=D.defaultKit(c.colors[0],c.colors[1],c.colors[2]);kit.pattern=c.pattern||'plain';kit.shortsColor=c.colors[0]==='#ffffff'?c.colors[1]:c.colors[0];kit.socksColor=c.colors[0];
 let club;
 if(c.fictional){const seed=(U.hashStr(c.id)%900)+40;club={id:c.id,name:c.name,short:c.short,city:c.city,primary:c.colors[0],secondary:c.colors[1],keeper:'#ffb21f',crest:null,players:D.makeRoster(seed,c.strength),pattern:c.pattern};
  club.players.forEach((p,i)=>p.id=c.id+'-p'+i);club.bench=D.makeBench(seed,c.strength,club.players.map(p=>p.number)).map((p,i)=>{p.id=c.id+'-b'+i;return p;});}
 else{const players=c.players.map((r,i)=>expandPlayer(r,c,i));const {xi,rest}=pickXI(players);xi.forEach((p,i)=>{p.position=SLOTS433[i];p.rating=D.computeOverall(p.attrs,p.position);});
  club={id:c.id,name:c.name,short:c.short,city:c.city,primary:c.colors[0],secondary:c.colors[1],keeper:'#ffb21f',crest:null,players:xi,bench:rest};}
 Object.assign(club,{country:c.country,state:c.state,uf:c.uf,league:c.league,stadiumName:c.stadium,real:!!c.real,fictional:!!c.fictional,source:c.source||'',updated:c.updated||null,partial:!!c.partial,builtin:true});
 const home=U.deepClone(kit);club.kits={home,away:null,third:null,gk:null};const away=D.defaultKit(c.colors[1]==='#111111'?'#ffffff':c.colors[1],c.colors[0],c.colors[2]);away.pattern='plain';away.shortsColor=c.colors[1];away.socksColor=c.colors[1];club.kits.away=away;
 club=D.ensureClub(club);club.kits.home.pattern=c.pattern||'plain';return club;};
/* ---------- carga ---------- */
CAT.load=function(){const src=(typeof window!=='undefined'&&window.MD_CATALOG_2026)||null;CAT.meta=src?{generated:src.generated,referenceDate:src.referenceDate,notice:src.notice,stats:src.stats}:null;
 CAT.countries=[...(src?src.countries:[]).filter(c=>c.id!=='MD').map(c=>({...c,continent:c.continent||(c.id==='BR'?'SA':'XX')})),...BASE_COUNTRIES];
 const customLeagues=ls.get(CAT.KEY_LEAGUES)||[];CAT.leagues=[...(src?src.leagues:[]),...BASE_LEAGUES,...customLeagues.filter(l=>l&&l.id&&l.name)];
 for(const l of customLeagues)if(l.country&&!CAT.countries.some(c=>c.id===l.country))CAT.countries.push({id:l.country,name:l.countryName||l.country,flag:'🏳️'});
 CAT.defaults=new Map();if(src)for(const c of src.clubs)CAT.defaults.set('br-'+c.id.replace(/^br-/,''),c);
 CAT.overrides=ls.get(CAT.KEY_OVR)||{};
 let user=ls.get(CAT.KEY_USER);let migrated=false;
 if(!Array.isArray(user)){/* primeira execução da 0.5: preserva os clubes da 0.4 (ou 0.3) como clubes do usuário */
  const old=D.loadClubs();/* instalação nova (sem dados antigos): não cria os clubes genéricos */user=old.fresh?[]:old.clubs.map(c=>{c.league=c.league||'meus-clubes';c.country=c.country||'MD';return D.externalize(c);});migrated=true;ls.set(CAT.KEY_USER,user);ls.set(CAT.KEY_MIG,{at:new Date().toISOString(),from:old.fresh?'nova':old.migrated?'0.3':'0.4',count:user.length});}
 /* 0.6: retira a liga genérica do catálogo padrão sem apagar nada do usuário */
 let removedGeneric=0;if(Array.isArray(user)&&!ls.get(CAT.KEY_MIG6)){const keep=[],backup=ls.get(CAT.KEY_GENERIC_BACKUP)||[];
  for(const c of user){if(c.league==='md-liga'||/^club-[0-5]$/.test(c.id)){if(genericUntouched(D.internalize?D.internalize(U.deepClone(c)):c)){backup.push(c);removedGeneric++;continue;}c.league='meus-clubes';c.country='MD';}keep.push(c);}
  user=keep;ls.set(CAT.KEY_USER,user);ls.set(CAT.KEY_GENERIC_BACKUP,backup);ls.set(CAT.KEY_MIG6,{at:new Date().toISOString(),removed:removedGeneric,kept:keep.length});}
 for(const c of user||[])if(c.league==='md-liga')c.league='meus-clubes';
 CAT.genericRemoved=removedGeneric;
 const out=[];
 for(const [id,c] of CAT.defaults){let club;if(CAT.overrides[id]){club=D.internalize(D.ensureClub(U.deepClone(CAT.overrides[id])));club.builtin=true;club.edited=true;}else club=CAT.expand(c);out.push(club);}
 CAT.userIds=new Set();for(const c of user||[]){const club=D.internalize(D.ensureClub(c));club.league=club.league||'meus-clubes';club.country=club.country||(CAT.leagues.find(l=>l.id===club.league)||{}).country||'MD';CAT.userIds.add(club.id);out.push(club);}
 return{clubs:out,migrated};};
/* ---------- gravação: padrão nunca é gravado; apenas o que o usuário mudou ---------- */
CAT.save=function(clubs,changedId){const used=new Set();const ext=c=>D.mapImages(U.deepClone(c),v=>{if(D.Assets.isRef(v)){used.add(v);return D.Assets.db?v:D.Assets.url(v);}return v;});
 const user=[];const ovr={...CAT.overrides};
 for(const c of clubs){if(CAT.defaults.has(c.id)){if(c.edited||c.id===changedId){c.edited=true;ovr[c.id]=ext(c);}}else user.push(ext(c));}
 for(const id of Object.keys(ovr))if(!clubs.some(c=>c.id===id))delete ovr[id];
 CAT.overrides=ovr;const ok=ls.set(CAT.KEY_OVR,ovr)&&ls.set(CAT.KEY_USER,user);if(ok&&D.Assets.db)D.Assets.gc(new Set([...used,...(CAT.extraAssets?CAT.extraAssets():[])]));return ok;};
CAT.restore=function(id){const c=CAT.defaults.get(id);if(!c)return null;delete CAT.overrides[id];ls.set(CAT.KEY_OVR,CAT.overrides);return CAT.expand(c);};
CAT.isDefault=id=>CAT.defaults.has(id);
CAT.addLeague=function(name,countryId,countryName){const id='lg-'+App_slug(name)+'-'+Date.now().toString(36);const l={id,country:countryId||'MD',name:String(name).slice(0,40),tier:9,custom:true,user:true,countryName};
 const list=(ls.get(CAT.KEY_LEAGUES)||[]);list.push(l);ls.set(CAT.KEY_LEAGUES,list);CAT.leagues.push(l);if(!CAT.countries.some(c=>c.id===l.country))CAT.countries.push({id:l.country,name:countryName||l.country,flag:'🏳️'});return l;};
CAT.removeLeague=function(id){const list=(ls.get(CAT.KEY_LEAGUES)||[]).filter(l=>l.id!==id);ls.set(CAT.KEY_LEAGUES,list);CAT.leagues=CAT.leagues.filter(l=>l.id!==id||!l.user);};
function App_slug(s){return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'liga';}
CAT.league=id=>CAT.leagues.find(l=>l.id===id)||null;
CAT.country=id=>CAT.countries.find(c=>c.id===id)||null;
CAT.leaguesOf=country=>CAT.leagues.filter(l=>l.country===country);
/* ---------- índice de jogadores (para a seleção livre do Germinare) ---------- */
CAT.allPlayers=function(clubs){const out=[];for(const c of clubs){for(const p of [...c.players,...(c.bench||[])]){if(p.placeholder)continue;out.push({p,club:c,league:c.league,country:c.country});}}return out;};
MD.Catalog=CAT;
})(typeof window!=='undefined'?(window.MD=window.MD||{}):(globalThis.MD=globalThis.MD||{}));
