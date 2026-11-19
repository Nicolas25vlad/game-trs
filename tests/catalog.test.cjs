'use strict';
/* MATCHDAY 0.5 — catálogo País → Liga → Clube: 40 clubes, divisões, fontes, estimativas sinalizadas, edições do usuário
   preservadas (inclusive em atualização dos dados padrão) e migração dos clubes da 0.4. */
const assert=require('node:assert/strict');
const FILES=['js/util.js','js/modes.js','js/data.js','data/catalog_br_2026.js','js/catalog.js'];
let checks=0;const ok=(c,msg)=>{assert.ok(c,msg);checks++;console.log('  ✓ '+msg);};
/* usuário vindo da 0.4 com um clube próprio salvo */
const store={};let MD=require('./load.cjs')(['js/util.js','js/modes.js','js/data.js'],{window:true,store});
{const D=MD.Data;const r=D.loadClubs();const mine=D.newClub();mine.name='Meu Time da Rua';mine.id='club-meu';r.clubs.push(mine);D.saveClubs(r.clubs);}
MD=require('./load.cjs')(FILES,{window:true,store});let CAT=MD.Catalog,D=MD.Data;
let {clubs,migrated}=CAT.load();const src=CAT.meta;
const br=clubs.filter(c=>CAT.isDefault(c.id));
ok(migrated&&clubs.some(c=>c.name==='Meu Time da Rua'),'clube personalizado da 0.4 migrado sem perda');
ok(!CAT.leagues.some(l=>l.id==='md-liga')&&JSON.parse(store['trs26-v06-generic-backup']).length===6&&!clubs.some(c=>/^club-[0-5]$/.test(c.id)),'0.6: liga genérica retirada do catálogo; os 6 clubes genéricos não editados foram para um backup (nada apagado)');
ok(CAT.continents.length>=4&&CAT.leagues.filter(l=>l.pending).length>=17&&CAT.continentOf('BR')==='SA','Continente → País → Liga: ligas internacionais cadastradas (elencos pendentes, sinalizados)');
ok(br.length===40,'40 clubes padrão no catálogo');
const A=br.filter(c=>c.league==='br-a'),B=br.filter(c=>c.league==='br-b');ok(A.length===20&&B.length===20,'20 na Série A e 20 na Série B');
const FICT=['Nata','Os Fodões','Política','Arrombados FC','Barueri FC','Prisão FC'];
ok(FICT.every(n=>br.some(c=>c.name===n&&c.fictional&&!c.real)),'6 clubes fictícios marcados como fictícios');
ok(new Set(br.map(c=>c.name.toLowerCase())).size===40&&new Set(br.map(c=>c.short)).size===40,'nomes e siglas únicos');
ok(br.every(c=>c.country==='BR'&&c.stadiumName&&c.city),'todos com país, cidade e estádio');
ok(br.filter(c=>c.real).every(c=>c.state||c.uf),'clubes reais com estado');
ok(br.every(c=>[...c.players,...c.bench].some(p=>D.groupOf(p.position)==='GK')),'todo clube tem ao menos um goleiro');
ok(br.every(c=>c.players.length===11&&c.players.filter(p=>p.position==='GOL').length===1),'11 titulares com exatamente um goleiro');
const reals=br.filter(c=>c.real);ok(reals.every(c=>c.source&&(typeof c.source==='string'?c.source.length>5:c.source.text)),'clubes reais com fonte registrada');
const allP=reals.flatMap(c=>[...c.players,...c.bench]);
ok(allP.every(p=>p.est&&p.est.rating&&p.est.attrs),'overall e atributos dos jogadores reais sinalizados como estimativas');
const ids=new Set();let dupe=0;for(const c of br)for(const p of [...c.players,...c.bench]){if(ids.has(p.id))dupe++;ids.add(p.id);}ok(dupe===0,'nenhum jogador duplicado entre clubes');
const ph=allP.filter(p=>p.placeholder);ok(ph.every(p=>/^A definir/.test(p.name)),`lacunas usam "A definir" (${ph.length}), não nomes falsos`);
ok(src&&src.referenceDate&&src.stats&&src.stats.players>900,`dados de referência ${src&&src.referenceDate}: ${src&&src.stats.players} atletas`);
/* edição do usuário guardada à parte do padrão */
const fla=clubs.find(c=>c.id==='br-flamengo');fla.players[1].name='Lateral Editado';fla.edited=true;ok(CAT.save(clubs,'br-flamengo'),'edição salva');
ok(!Object.keys(store).some(k=>store[k].includes('"br-palmeiras"')&&k!=='matchday-v05-club-overrides'),'dados padrão não são gravados no armazenamento');
ok(!(store['matchday-v05-club-overrides']||'').includes('br-palmeiras'),'somente o clube editado vira override');
/* simula uma atualização dos dados padrão: o override do usuário continua valendo */
MD=require('./load.cjs')(FILES,{window:true,store});CAT=MD.Catalog;D=MD.Data;

({clubs,migrated}=CAT.load());ok(!migrated,'migração não se repete na segunda execução');
ok(clubs.find(c=>c.id==='br-flamengo').players[1].name==='Lateral Editado','edição do usuário preservada após recarregar');
ok(clubs.some(c=>c.name==='Meu Time da Rua'),'clube do usuário preservado após recarregar');
const restored=CAT.restore('br-flamengo');ok(restored&&restored.players[1].name!=='Lateral Editado'&&!CAT.overrides['br-flamengo'],'“restaurar padrão” desfaz só aquele clube');
/* ligas personalizadas e mudança de liga */
const lg=CAT.addLeague('Liga dos Amigos','MD');const mine=clubs.find(c=>c.name==='Meu Time da Rua');mine.league=lg.id;CAT.save(clubs);
MD=require('./load.cjs')(FILES,{window:true,store});CAT=MD.Catalog;({clubs}=CAT.load());
ok(CAT.leagues.some(l=>l.id===lg.id)&&clubs.find(c=>c.name==='Meu Time da Rua').league===lg.id,'liga personalizada criada e clube movido entre ligas');
ok(CAT.allPlayers(clubs).length>1000,'busca global de jogadores cobre todos os clubes');
{const MD2=require('./load.cjs')(FILES,{window:true,store:{}});const C2=MD2.Catalog;const r=C2.load();
 ok(!C2.genericRemoved&&!r.clubs.some(c=>/^club-[0-5]$/.test(c.id))&&r.clubs.length>0,'instalação nova: sem clubes genéricos e sem aviso de migração');}
console.log(`CATALOG TEST PASS (${checks} verificações)`);
