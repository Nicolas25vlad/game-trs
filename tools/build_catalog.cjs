'use strict';
/* MATCHDAY 0.5 — gera o catálogo local (Brasil: Série A e Série B personalizadas do MATCHDAY) a partir de
   data/fontes_elencos_2026.txt (pesquisa registrada, com fonte por clube).
   Saídas: data/catalog_br_2026.json (dados estruturados) e data/catalog_br_2026.js (o mesmo conteúdo para abrir
   offline por file://, onde fetch de JSON é bloqueado).
   IMPORTANTE: overall e atributos são ESTIMATIVAS do MATCHDAY (não são avaliações oficiais de nenhum jogo).
   Posições detalhadas (LD/LE/VOL/MEI/PD/PE) são estimadas a partir do grupo informado pela fonte (GOL/DEF/MEI/ATA). */
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const SRC=path.join(root,'data','fontes_elencos_2026.txt');
const today='2026-11-15';
/* ---- clubes: id|nome|sigla|UF|cidade|liga|estádio|cor1|cor2|cor3|estampa|força|real ---- */
const CLUBS=`corinthians|Corinthians|COR|SP|São Paulo|br-a|Neo Química Arena|#ffffff|#111111|#c9c9c9|plain|75|1
flamengo|Flamengo|FLA|RJ|Rio de Janeiro|br-a|Maracanã|#c8102e|#111111|#ffffff|hoops|80|1
palmeiras|Palmeiras|PAL|SP|São Paulo|br-a|Allianz Parque|#0b6b3a|#ffffff|#e9e9e9|plain|80|1
saopaulo|São Paulo|SAO|SP|São Paulo|br-a|MorumBIS|#ffffff|#d71920|#111111|band|75|1
santos|Santos|SAN|SP|Santos|br-a|Vila Belmiro|#ffffff|#111111|#c9c9c9|plain|74|1
vasco|Vasco|VAS|RJ|Rio de Janeiro|br-a|São Januário|#111111|#ffffff|#c8102e|sash|74|1
fluminense|Fluminense|FLU|RJ|Rio de Janeiro|br-a|Maracanã|#7a1f3d|#0b6b3a|#ffffff|stripes|76|1
botafogo|Botafogo|BOT|RJ|Rio de Janeiro|br-a|Nilton Santos|#111111|#ffffff|#9a9a9a|stripes|77|1
gremio|Grêmio|GRE|RS|Porto Alegre|br-a|Arena do Grêmio|#0d80bf|#111111|#ffffff|stripes|74|1
internacional|Internacional|INT|RS|Porto Alegre|br-a|Beira-Rio|#d2161e|#ffffff|#ffffff|plain|75|1
cruzeiro|Cruzeiro|CRU|MG|Belo Horizonte|br-a|Mineirão|#1a3a8f|#ffffff|#ffffff|plain|77|1
atleticomg|Atlético-MG|CAM|MG|Belo Horizonte|br-a|Arena MRV|#111111|#ffffff|#cfcfcf|stripes|75|1
athleticopr|Athletico-PR|CAP|PR|Curitiba|br-a|Arena da Baixada|#d2161e|#111111|#ffffff|stripes|72|1
nata|Nata|NAT|SC|Florianópolis|br-a|Arena Nata|#f2ead3|#1f2b45|#d4a017|plain|71|0
osfodoes|Os Fodões|FOD|SC|Joinville|br-a|Estádio dos Fodões|#ff5a1f|#111111|#ffffff|stripes|71|0
politica|Política|POL|SC|Blumenau|br-a|Arena Política|#6c3bd1|#ffd21f|#ffffff|sash|71|0
bahia|Bahia|BAH|BA|Salvador|br-a|Arena Fonte Nova|#ffffff|#0b4ea2|#d2161e|band|74|1
bragantino|RB Bragantino|RBB|SP|Bragança Paulista|br-a|Cícero de Souza Marques|#ffffff|#d2161e|#0b1f4a|plain|73|1
mirassol|Mirassol|MIR|SP|Mirassol|br-a|Campos Maia|#ffd21f|#0b7a3b|#111111|plain|72|1
vitoria|Vitória|VIT|BA|Salvador|br-a|Barradão|#d2161e|#111111|#ffffff|hoops|71|1
remo|Remo|REM|PA|Belém|br-b|Baenão|#0b1f4a|#ffffff|#4a8cd6|plain|69|1
coritiba|Coritiba|CFC|PR|Curitiba|br-b|Couto Pereira|#ffffff|#0a6b3a|#111111|band|70|1
santacruz|Santa Cruz|STA|PE|Recife|br-b|Arruda|#ffffff|#111111|#d2161e|hoops|64|1
ceara|Ceará|CEA|CE|Fortaleza|br-b|Castelão|#111111|#ffffff|#9a9a9a|stripes|70|1
paysandu|Paysandu|PAY|PA|Belém|br-b|Curuzu|#4aa3df|#ffffff|#0b1f4a|stripes|66|1
ibis|Íbis|IBI|PE|Paulista|br-b|Ademir Cunha|#d2161e|#111111|#ffffff|stripes|56|1
criciuma|Criciúma|CRI|SC|Criciúma|br-b|Heriberto Hülse|#ffd21f|#111111|#ffffff|stripes|67|1
juventude|Juventude|JUV|RS|Caxias do Sul|br-b|Alfredo Jaconi|#0a6b3a|#ffffff|#ffffff|stripes|69|1
fortaleza|Fortaleza|FOR|CE|Fortaleza|br-b|Castelão|#0b4ea2|#d2161e|#ffffff|band|71|1
arrombados|Arrombados FC|ARR|MT|Cuiabá|br-b|Arena Arrombados|#2fbf71|#0b1f4a|#ffffff|halves|66|0
sport|Sport|SPT|PE|Recife|br-b|Ilha do Retiro|#d2161e|#111111|#ffd21f|hoops|70|1
cuiaba|Cuiabá|CUI|MT|Cuiabá|br-b|Arena Pantanal|#0a6b3a|#ffd21f|#ffffff|plain|68|1
nautico|Náutico|NAU|PE|Recife|br-b|Aflitos|#d2161e|#ffffff|#ffffff|stripes|66|1
pontepreta|Ponte Preta|PON|SP|Campinas|br-b|Moisés Lucarelli|#ffffff|#111111|#9a9a9a|sash|66|1
americamg|América-MG|AME|MG|Belo Horizonte|br-b|Independência|#0a6b3a|#111111|#ffffff|plain|68|1
athletic|Athletic|ATH|MG|São João del-Rei|br-b|Joaquim Portugal|#111111|#ffffff|#ffd21f|plain|65|1
atleticogo|Atlético-GO|ACG|GO|Goiânia|br-b|Antônio Accioly|#d2161e|#111111|#ffffff|stripes|68|1
goias|Goiás|GOI|GO|Goiânia|br-b|Serrinha|#0a6b3a|#ffffff|#ffffff|plain|68|1
baruerifc|Barueri FC|BFC|SP|Barueri|br-b|Arena Barueri FC|#1f56a8|#ffd21f|#ffffff|plain|66|0
prisaofc|Prisão FC|PRI|RS|Porto Alegre|br-b|Estádio da Prisão|#ff8c1a|#2b2b2b|#ffffff|hoops|65|0`.split('\n').map(l=>{const c=l.split('|');return{id:c[0],name:c[1],short:c[2],state:c[3],city:c[4],league:c[5],stadium:c[6],primary:c[7],secondary:c[8],accent:c[9],pattern:c[10],tier:+c[11],real:c[12]==='1'};});
const STATE={SP:'São Paulo',RJ:'Rio de Janeiro',RS:'Rio Grande do Sul',MG:'Minas Gerais',PR:'Paraná',SC:'Santa Catarina',BA:'Bahia',PA:'Pará',PE:'Pernambuco',CE:'Ceará',MT:'Mato Grosso',GO:'Goiás'};
/* possíveis duplicidades entre listas (mesmo nome, idade e país em dois clubes): mantido onde há escalação recente ou onde a pesquisa do usuário aponta */
const REMOVE={ceara:['Bryan Borges'],fortaleza:['Brenno','Vitinho'],bragantino:['Ignacio Laquintana'],americamg:['Yago Santos','Jhonny'],santacruz:['Marquinhos'],remo:['Marlon']};
/* ---- posições detalhadas estimadas (a fonte informa só GOL/DEF/MEI/ATA) ---- */
const LD=new Set('Matheuzinho|Guillermo Varela|Emerson Royal|Puma Rodríguez|Paulo Henrique|Igor Vinícius|Agustín Giay|Khellven|Cédric Soares|Lucas Ramon|Aurélio Buta|Samuel Xavier|Guga|Julián Millán|Mateo Ponte|Vitinho|Marcos Rocha|João Pedro|Fagner|William|Natanael|Angelo Preciado|Agustín Sant\'Anna|Gilberto|Braian Aguirre|Daniel Borges|Igor Formiga|Matheus Alexandre|Marcelinho|Rafael Ramos|Edílson|Maílton|Willean Lepo|Aderlan|Raí Ramos|Nino Paraíba|Arnaldo|Mateusinho|Nathan Mendes|Kauã Moraes|Fabricio Bustos|Natanael|Rodrigo Gelado|Edson Lucas|Diego Porfirio|Djalma Silva'.split('|'));
const LE=new Set('Matheus Bidu|Fabrizio Angileri|Alex Sandro|Ayrton Lucas|Lucas Piton|Cuiabano|Gonzalo Escobar|Joaquín Piquerez|Jefté|Wendell|Enzo Díaz|Guilherme Arana|Renê|Alex Telles|Marçal|Marlon|Caio Paulista|Renan Lodi|Juninho Capixaba|Lucas Esquivel|Alexandro Bernabei|Matheus Bahia|Reinaldo|Victor Luís|Mayk|Felipe Jonatan|Bruno Melo|Marcelo Hermes|Diogo Barbosa|Alan Ruschel|Dalbert|Danilo Barcelos|Jamerson|Luan Cândido|Gabriel Rojas|Matías Viña|Hugo|Igor Fernandes|Luciano Taboca|Gabriel Fuentes|Patryck|Tinga'.split('|'));
const VOL=new Set('Breno Bidon|Raniele|Allan|Charles|Alex Santana|Erick Pulgar|Jorginho|Evertton Araújo|Saúl Ñíguez|Tchê Tchê|Thiago Mendes|Hugo Moura|Santiago Sosa|Cauan Barros|João Schmidt|Willian Arão|Marlon Freitas|Emiliano Martínez|Lucas Evangelista|Pablo Maia|Damián Bobadilla|Marcos Antônio|Martinelli|Hércules|Otávio|Nonato|Danilo|Mathías Villasanti|Dodi|Juan Nardoni|Lucas Romero|Lucas Silva|Fabrizio Peralta|Fred|Alexsander|Kevin Castaño|Alan Franco|Maycon|Luiz Gustavo|Juan Portilla|Caio Alexandre|Nicolás Acevedo|Jean Lucas|Gabriel|Matheus Fernandes|Ignacio Sosa|Rodrigo Villagra|Thiago Maia|Bruno Henrique|Neto Moura|José Aldo|Denilson|Walace|Baralhas|Caíque Gonçalves|Leonel Picco|Zé Welison|Patrick|Lucas Sasha|Pierre|Richard|Sebastián Gómez|Jean Irmer|Lucas Mineiro|Mandaca|Patrick de Paula|Fernando Sobral|Rodrigo Saravia|Rodrigo Souza|Auremir|Wenderson|Leandro Vilela|Filipe Machado|Raul|Barreto|Jaildo'.split('|'));
const MEI=new Set('Rodrigo Garro|Matheus Pereira|Jesse Lingard|Zakaria Labyad|Arrascaeta|Lucas Paquetá|Nicolás de la Cruz|Jorge Carrascal|Alan Lescano|Neymar|Gabriel Bontempo|Thaciano|Miguelito|Andreas Pereira|Mauricio|Luciano Acosta|Ganso|Jefferson Savarino|David Terans|Alisson|Cristian Medina|Gerson|Matheus Henrique|Gustavo Scarpa|Reinier|Igor Gomes|João Cruz|Bruno Zapelli|Everton Ribeiro|Rodrigo Nestor|Eric Ramires|Alan Patrick|Shaylon|Chico Kim|Tomás Pochettino|Emmanuel Martínez|Vitor Bueno|Lucas Mugni|Vina|Rómulo Otero|Gabriel Pires|Lucas Lima|Lourenço|Carlos de Pena|Kervin Andrade|Elvis|Dodô|Fernando Elizari|Alê|Juan Alano|João Miguel|Matheus Araújo|Josué|Caio Mello|Marcinho'.split('|'));
const PD=new Set('André Carrillo|Samuel Lino|Gonzalo Plata|Luiz Araújo|David|Adson|Nuno Moreira|Marino Hinestroza|Álvaro Barreal|Robinho Júnior|Rony|Felipe Anderson|Jhon Arias|Lucas Moura|Ferreirinha|Yeferson Soteldo|Kevin Serna|Agustín Canobbio|Júnior Santos|Matheus Martins|Hakim Ziyech|Álvaro Montoro|Tetê|José Enamorado|Francis Amuzu|Keny Arroyo|Luis Sinisterra|Marquinhos|Gabriel Pec|Bernard|Dudu|Alan Minda|Tomás Cuello|Kerwin Vargas|Erick Pulga|Michel Araújo|Cristian Olivera|Lucas Barbosa|Vinicinho|Henry Mosquera|Alesson|Negueba|Gustavo Silva|Johan Carbonero|Niclas Eliasson|Kayky|Vitinho|Marinho|Jajá|Yago Pikachu|Paulo Baya|Breno Lopes|Brian Ocampo|Lenny Lobato|Jhonata Robert|Clayson|Chrystian Barletta|Esli García|Wellington Rato|Marrony|Juninho|Diego Gonçalves|Luis Phelipe|Victor Andrade|Felipe Saraiva|Dixon Vera|Kaio César|Memphis Depay|Vitor Roque'.split('|'));
function detailPos(g,name,i){if(g==='GOL')return'GOL';if(g==='DEF')return LD.has(name)?'LD':LE.has(name)?'LE':'ZAG';
 if(g==='MEI')return VOL.has(name)?'VOL':MEI.has(name)?'MEI':'MC';if(PD.has(name))return i%2?'PE':'PD';return'ATA';}
/* ---- estimativa de overall: força do clube + idade + destaque conhecido (estimativa, não oficial) ---- */
const STAR={'Neymar':84,'Memphis Depay':82,'Arrascaeta':84,'Lucas Paquetá':83,'Pedro':81,'Agustín Rossi':80,'Alex Sandro':78,'Danilo':78,'Saúl Ñíguez':80,'Nicolás de la Cruz':80,'Jorge Carrascal':79,'Gonzalo Plata':79,'Samuel Lino':79,'Bruno Henrique':78,'Léo Ortiz':79,'Léo Pereira':78,'Erick Pulgar':78,'Jorginho':79,'Guillermo Varela':76,'Ayrton Lucas':77,'Emerson Royal':77,
 'Hugo Souza':79,'Rodrigo Garro':80,'Yuri Alberto':79,'Breno Bidon':77,'Jesse Lingard':78,'Matheus Bidu':75,'André Carrillo':76,'Gustavo Henrique':75,'Fabrizio Angileri':75,'Gabriel Paulista':75,
 'Carlos Miguel':79,'Gustavo Gómez':80,'Andreas Pereira':80,'Flaco López':80,'Jhon Arias':82,'Vitor Roque':80,'Joaquín Piquerez':79,'Felipe Anderson':78,'Emiliano Martínez':78,'Marlon Freitas':77,'Alexander Barboza':77,'Agustín Giay':76,'Ramón Sosa':78,'Murilo':76,
 'Rafael':76,'Robert Arboleda':77,'Lucas Moura':80,'Luciano':77,'Jonathan Calleri':78,'Pablo Maia':76,'Marcos Antônio':76,'Cédric Soares':74,'Wendell':75,'Rafael Tolói':74,'Ferreirinha':74,
 'Gabriel Brazão':76,'Gabriel Bontempo':74,'Benjamín Rollheiser':77,'Gabriel Barbosa':78,'Willian Arão':74,'Lucas Veríssimo':74,'Rony':75,
 'Léo Jardim':77,'Robert Renan':74,'Alan Lescano':76,'Andrés Gómez':76,'Facundo Colidio':76,'Philippe Coutinho':80,'Thiago Mendes':74,'Lucas Piton':74,'Nuno Moreira':74,
 'Fábio':74,'Thiago Silva':78,'Martinelli':78,'Agustín Canobbio':77,'Germán Cano':75,'Luciano Acosta':79,'Jefferson Savarino':78,'Yeferson Soteldo':78,'Guilherme Arana':78,'Ganso':76,'Hulk':76,'Kevin Serna':75,'John Kennedy':75,'Samuel Xavier':73,
 'Gabriel Batista':74,'Alex Telles':78,'Danilo Santos':75,'Álvaro Montoro':75,'Júnior Santos':76,'Hakim Ziyech':79,'Arthur Cabral':77,'Cristian Medina':76,'Allan':73,
 'Weverton':77,'Walter Kannemann':76,'Mathías Villasanti':76,'Tetê':75,'Carlos Vinícius':76,'Martin Braithwaite':77,'Marcos Rocha':72,'Fabián Balbuena':75,'Miguel Monsalve':74,'Willian':74,
 'Matheus Cunha':74,'Alan Patrick':79,'Félix Torres':75,'Thiago Maia':76,'Johan Carbonero':76,'Rafael Borré':78,'Rodrigo Villagra':75,'Alerrandro':74,'Vitinho':75,'Gabriel Mercado':73,
 'Cássio':76,'Fabrício Bruno':77,'Gerson':81,'Matheus Pereira':80,'Kaio Jorge':79,'Jonathan Jesus':73,'Lucas Romero':75,'Luis Sinisterra':78,'Fagner':72,'Matheus Henrique':76,'Lucas Silva':74,
 'Gabriel Delfim':73,'Everson':75,'Alan Franco':75,'Reinier':76,'Gustavo Scarpa':79,'Angelo Preciado':75,'Renan Lodi':77,'Lyanco':75,'Bernard':76,'Dudu':77,'Fred':76,'Tomás Cuello':76,'Mateo Cassierra':74,'Alan Minda':75,
 'Mycael':71,'Lucas Esquivel':72,'Luiz Gustavo':72,'João Cruz':71,'Kevin Viveros':73,
 'Guido Herrera':75,'Everton Ribeiro':76,'Jean Lucas':75,'Caio Alexandre':75,'Willian José':74,'Erick Pulga':74,'Rodrigo Nestor':74,'Kanu':73,'Michel Araújo':73,
 'Tiago Volpi':73,'Juninho Capixaba':73,'Lucas Barbosa':73,'Eric Ramires':74,'Isidro Pitta':74,'Eduardo Sasha':72,
 'Alex Muralha':70,'Reinaldo':71,'Denilson':72,'Alesson':72,'Gustavo Silva':72,'Shaylon':71,'Walter':70,
 'Lucas Arcanjo':72,'Cacá':72,'Tomás Pochettino':73,'Marinho':72,'Renato Kayzer':73,'Emanuel Brítez':70,
 'Marcelo Rangel':70,'Marllon':70,'Patrick':70,'Leonel Picco':71,'Jajá':72,'Vitor Bueno':70,
 'Pedro Morisco':71,'Jacy':70,'Sebastián Gómez':72,'Breno Lopes':72,'Pedro Rocha':71,'Josué':71,
 'Lucas Mugni':72,'Vina':71,'Renzo López':71,'Matheus Araújo':70,
 'João Ricardo':71,'Lucas Sasha':70,'Paulo Baya':71,'Luiz Fernando':70,
 'Brenno':70,'Patrick de Paula':71,'Kervin Andrade':71,'Fernando Sobral':70,'Perotti':72,
 'Airton':67,'Marcelo Hermes':67,'Rómulo Otero':70,'Jhonata Robert':68,'Nicolas':67,
 'Gabriel Pires':68,'Lucas Mineiro':68,'Mandaca':69,'Alisson Safira':68,'Luis Amarilla':70,
 'Alan Empereur':68,'Gastón Guruceaga':68,'Derek Freitas':67,'Paulo Sérgio':66,'Júnior Todinho':66,
 'Guilherme Viana':66,'Lucas Cunha':66,'Elvis':67,'Brandão':66,'Jonathan Cafu':66,
 'Gonzalo Mastriani':69,'Matías Segovia':68,'Willian Bigode':67,'Alê':67,'Barreto':67,
 'Vladimir':68,'Leandro Vilela':68,'Marrony':69,'Gustavo Coutinho':70,'Tadeu':69,'Lucas Lima':68,'Lourenço':67,'Wellington Rato':68,
 'Caio Mello':65,'Marcinho':66,'Juninho':65,'Thiago Ennes':63,'Everaldo':65,'Eron':64,'João Miguel':65,'Dixon Vera':65};
function estimate(club,g,name,age,i){if(STAR[name]&&club.real)return STAR[name];let r=club.tier-4;const a=+age;
 if(a){if(a<=19)r-=5;else if(a<=21)r-=3;else if(a<=23)r-=1;else if(a>=36)r-=g==='GOL'?1:4;else if(a>=33)r-=g==='GOL'?0:1;}
 r+=((i*7+name.length*3)%7)-3;return Math.max(45,Math.min(86,Math.round(r)));}
/* ---- leitura das fontes ---- */
const clubsRaw={};let cur=null;
for(const line of fs.readFileSync(SRC,'utf8').split('\n')){const l=line.trim();if(!l||l.startsWith('#'))continue;
 if(l.startsWith('@CLUB')){const p=l.slice(6).split('|');cur={id:p[0],label:p[1],source:p.slice(2).join('|'),rows:[]};clubsRaw[cur.id]=cur;continue;}
 const p=l.split('|');cur.rows.push({g:p[0],n:p[1],age:p[2]==='-'?null:+p[2],nat:p[3]==='-'?null:p[3],num:p[4]==='-'?null:+p[4]});}
/* Íbis: fontes muito limitadas */
clubsRaw.ibis={id:'ibis',label:'Íbis',source:'Diario de Pernambuco, 10/11/2026 (reportagem sobre o elenco: cita o volante Jaildo e o jovem "Yamal", 19 anos). Nomes citados na pesquisa do usuário (Mário Neto, Rafael Cruz, José Murilo Silva da Costa, Jean Conca) NÃO puderam ser confirmados e foram marcados como não verificados. Demais vagas: atletas a definir (edite no editor de clubes).',partial:true,
 rows:[{g:'MEI',n:'Jaildo',age:null,nat:'Brasil',num:null,verified:true},{g:'ATA',n:'Yamal',age:19,nat:'Brasil',num:null,verified:true,posEst:true},
  {g:'MEI',n:'Mário Neto',unverified:true},{g:'DEF',n:'Rafael Cruz',unverified:true},{g:'DEF',n:'José Murilo Silva da Costa',unverified:true},{g:'MEI',n:'Jean Conca',unverified:true}]};
for(const k of Object.keys(REMOVE))if(clubsRaw[k])clubsRaw[k].rows=clubsRaw[k].rows.filter(r=>!REMOVE[k].includes(r.n));
for(const r of clubsRaw.ceara.rows.filter(r=>r.n==='Luiz Otávio').slice(1))clubsRaw.ceara.rows.splice(clubsRaw.ceara.rows.indexOf(r),1);
/* ---- montagem ---- */
const out={format:'matchday-catalog-v05',version:'0.5',generated:today,referenceDate:'2026-11-15',
 notice:'Elencos pesquisados para a temporada 2026 (referência: 15/11/2026). Overall e atributos são ESTIMATIVAS do MATCHDAY, não avaliações oficiais. Divisões personalizadas do MATCHDAY (não correspondem à tabela oficial da CBF).',
 countries:[{id:'BR',name:'Brasil',flag:'🇧🇷'},{id:'MD',name:'Mundo MATCHDAY (fictício)',flag:'⚽'}],
 leagues:[{id:'br-a',country:'BR',name:'Série A',tier:1,custom:true,note:'Divisão personalizada do MATCHDAY'},{id:'br-b',country:'BR',name:'Série B',tier:2,custom:true,note:'Divisão personalizada do MATCHDAY'}],clubs:[]};
for(const meta of CLUBS){const raw=clubsRaw[meta.id];const club={id:'br-'+meta.id,name:meta.name,short:meta.short,country:'BR',state:STATE[meta.state],uf:meta.state,city:meta.city,league:meta.league,stadium:meta.stadium,
  colors:[meta.primary,meta.secondary,meta.accent],pattern:meta.pattern,real:meta.real,strength:meta.tier,players:[]};
 if(!meta.real){club.source='Clube personalizado/fictício do MATCHDAY: elenco fictício gerado e editável (sem histórico oficial inventado).';club.fictional=true;out.clubs.push(club);continue;}
 club.source=raw?raw.source:'sem fonte';club.updated=today;if(raw&&(raw.partial||/parcial/i.test(raw.source)))club.partial=true;
 const used=new Set((raw?raw.rows:[]).map(r=>r.num).filter(Boolean));let next=1;const freeNum=()=>{while(used.has(next))next++;used.add(next);return next;};
 (raw?raw.rows:[]).forEach((r,i)=>{const pos=detailPos(r.g,r.n,i);const p={id:'br-'+meta.id+'-'+(i+1),name:r.n,shirt:r.n.split(' ').length>1&&r.n.length>14?r.n.split(' ').pop():r.n,group:r.g,position:pos,
   number:r.num||freeNum(),age:r.age||null,nationality:r.nat||null,rating:estimate(meta,r.g,r.n,r.age,i)};
  if(!r.num)p.numberEstimated=true;if(pos!==r.g)p.positionEstimated=true;if(r.unverified)p.unverified=true;if(r.posEst)p.positionEstimated=true;out.clubs.push||0;club.players.push(p);});
 /* elenco jogável: completa com vagas "a definir" (identificadas, não apresentadas como jogadores reais) */
 const need={GOL:2,DEF:6,MEI:5,ATA:3};for(const g of Object.keys(need)){let have=club.players.filter(p=>p.group===g).length;while(have<need[g]){have++;const k=club.players.length+1;club.players.push({id:'br-'+meta.id+'-'+k,name:'A definir '+k,shirt:'?',group:g,position:detailPos(g,'',k),number:freeNum(),rating:Math.max(45,meta.tier-8),placeholder:true,numberEstimated:true});club.partial=true;}}
 out.clubs.push(club);}
out.stats={clubs:out.clubs.length,real:out.clubs.filter(c=>c.real).length,fictional:out.clubs.filter(c=>!c.real).length,players:out.clubs.reduce((n,c)=>n+c.players.length,0),placeholders:out.clubs.reduce((n,c)=>n+c.players.filter(p=>p.placeholder).length,0),unverified:out.clubs.reduce((n,c)=>n+c.players.filter(p=>p.unverified).length,0)};
fs.writeFileSync(path.join(root,'data','catalog_br_2026.json'),JSON.stringify(out,null,1));
fs.writeFileSync(path.join(root,'data','catalog_br_2026.js'),'/* Gerado por tools/build_catalog.cjs a partir de data/fontes_elencos_2026.txt — não editar à mão. */\nwindow.MD_CATALOG_2026='+JSON.stringify(out)+';\n');
console.log(JSON.stringify(out.stats));
