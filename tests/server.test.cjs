'use strict';
/* TRS26 / MATCHDAY 0.6 — teste REAL do servidor de pareamento (processo Node separado, HTTP e WebSocket de verdade).
   Clientes: o WebSocket nativo do Node faz o papel do computador (anfitrião) e de dois celulares.
   Não substitui um teste com celulares físicos; verifica o protocolo, a segurança e o repasse de comandos. */
const assert=require('node:assert/strict');const {spawn}=require('node:child_process');const path=require('node:path');const http=require('node:http');
const PORT=18000+Math.floor(Math.random()*900);const base=`http://127.0.0.1:${PORT}`;
let checks=0;const ok=(c,msg)=>{assert.ok(c,msg);checks++;console.log('  ✓ '+msg);};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function get(p){return new Promise((res,rej)=>{http.get(base+p,r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res({status:r.statusCode,body:d,type:r.headers['content-type']}));}).on('error',rej);});}
function client(){const ws=new WebSocket(`ws://127.0.0.1:${PORT}/ws`);const q=[];const waiters=[];ws.onmessage=e=>{const m=JSON.parse(e.data);q.push(m);for(const w of waiters.splice(0))w();};
 const c={ws,q,send:o=>ws.send(JSON.stringify(o)),open:()=>new Promise(r=>ws.readyState===1?r():ws.addEventListener('open',r,{once:true})),
  wait:async(pred,ms=3000)=>{const t0=Date.now();for(;;){const i=q.findIndex(pred);if(i>=0)return q.splice(i,1)[0];if(Date.now()-t0>ms)return null;await new Promise(r=>{waiters.push(r);setTimeout(r,50);});}},
  close:()=>ws.close()};return c;}
(async()=>{
 const srv=spawn(process.execPath,[path.join(__dirname,'..','server','server.js'),String(PORT)],{env:{...process.env,TRS_QUIET:'1',TRS_PIN_TTL:'8000',TRS_BLOCK:'1500',TRS_RESUME_TTL:'4000',TRS_SWEEP:'300'},stdio:['ignore','pipe','pipe']});
 let out='';srv.stdout.on('data',d=>out+=d);srv.stderr.on('data',d=>out+=d);
 try{for(let i=0;i<50&&!out.includes('servidor local');i++)await sleep(100);
  console.log('HTTP:');
  const idx=await get('/');ok(idx.status===200&&idx.body.includes('TRS26'),'serve o jogo na rede local');
  const ctl=await get('/controller/');ok(ctl.status===200&&ctl.body.includes('CONTROLE VIRTUAL'),'serve a página do controle virtual');
  ok((await get('/server/server.js')).status===403,'não expõe o código do servidor');ok([403,404].includes((await get('/..%2f..%2fetc/passwd')).status),'bloqueia travessia de diretório');
  const info=JSON.parse((await get('/api/info')).body);ok(Array.isArray(info.controller)&&info.controller[0].includes('/controller/'),'informa os endereços da rede local');
  console.log('Sessão e PIN:');
  const host=client();await host.open();host.send({t:'host-create'});const ses=await host.wait(m=>m.t==='session');ok(ses&&/^\d{6}$/.test(ses.pin)&&ses.hostToken&&ses.expires>Date.now(),'anfitrião cria sessão com PIN de 6 dígitos que expira');
  const bad=client();await bad.open();for(let i=0;i<5;i++){bad.send({t:'join',pin:String((+ses.pin+1+i)%1e6).padStart(6,'0'),name:'Intruso'});await bad.wait(m=>m.t==='error');}
  bad.send({t:'join',pin:ses.pin,name:'Intruso'});const blk=await bad.wait(m=>m.t==='error');ok(blk&&blk.code==='blocked','5 PINs errados bloqueiam o IP (mesmo com o PIN certo depois)');bad.close();
  await sleep(1700);
  const p1=client();await p1.open();p1.send({t:'join',pin:ses.pin,name:'Celular A'});ok(await p1.wait(m=>m.t==='wait-approval'),'PIN correto: celular aguarda autorização');
  const req=await host.wait(m=>m.t==='pair-request');ok(req&&req.name==='Celular A','anfitrião recebe o pedido de pareamento');
  p1.send({t:'in',s:1,ts:Date.now(),x:1,y:0,b:1});ok(!(await host.wait(m=>m.t==='ctrl-in',400)),'sem autorização do anfitrião nenhum comando chega ao jogo');
  host.send({t:'approve',cid:req.cid});const pr=await p1.wait(m=>m.t==='paired');ok(pr&&pr.token&&pr.label==='CELULAR 1','anfitrião autoriza: o celular recebe token e identificação');
  ok(await host.wait(m=>m.t==='ctrl-state'&&m.state==='connected'),'jogo sabe que o CELULAR 1 está conectado');
  console.log('Comandos:');
  p1.send({t:'in',s:10,ts:Date.now(),x:.5,y:-.25,b:0b11});const in1=await host.wait(m=>m.t==='ctrl-in');ok(in1&&in1.x===.5&&in1.y===-.25&&in1.b===3,'joystick e botões simultâneos chegam ao jogo');
  p1.send({t:'in',s:9,ts:Date.now(),x:-1,y:0,b:0});p1.send({t:'in',s:11,ts:Date.now(),x:5,y:0,b:0});p1.send({t:'in',s:12,ts:Date.now(),x:0,y:0,b:99999});p1.send({t:'in',s:13,ts:Date.now(),x:0,y:0,b:0});
  const after=await host.wait(m=>m.t==='ctrl-in');ok(after&&after.s===13,'pacotes antigos, fora de ordem ou inválidos são descartados');
  host.q.length=0;for(let i=0;i<400;i++)p1.send({t:'in',s:100+i,ts:Date.now(),x:0,y:0,b:0});await sleep(600);const got=host.q.filter(m=>m.t==='ctrl-in').length;ok(got<180&&got>20,`limite de frequência: 400 pacotes enviados de uma vez, ${got} repassados`);
  const t0=Date.now();p1.send({t:'ping',ts:t0});const pong=await p1.wait(m=>m.t==='pong');ok(pong&&Date.now()-t0<200,`latência local medida (${Date.now()-t0} ms)`);
  host.send({t:'to-ctrl',cid:req.cid,msg:{t:'state',label:'P1',side:'home',hasBall:true}});ok(await p1.wait(m=>m.t==='state'&&m.side==='home'),'jogo envia o contexto (lado, posse) ao celular');
  host.send({t:'to-ctrl',cid:req.cid,msg:{t:'eval',code:'x'}});ok(!(await p1.wait(m=>m.t==='eval',300)),'mensagens não permitidas do anfitrião não são repassadas');
  console.log('Dois celulares, desconexão e reconexão:');
  const p2=client();await p2.open();p2.send({t:'join',pin:ses.pin,name:'Celular B'});const req2=await host.wait(m=>m.t==='pair-request');host.send({t:'approve',cid:req2.cid});const pr2=await p2.wait(m=>m.t==='paired');ok(pr2&&pr2.label==='CELULAR 2'&&pr2.cid!==pr.cid,'segundo celular conectado como controle independente');
  p1.close();ok(await host.wait(m=>m.t==='ctrl-state'&&m.cid===req.cid&&m.state==='reconnecting'),'queda do CELULAR 1 é informada ao jogo');
  p2.send({t:'in',s:1,ts:Date.now(),x:-1,y:0,b:0});const in2=await host.wait(m=>m.t==='ctrl-in'&&m.cid===req2.cid);ok(in2&&in2.x===-1,'o CELULAR 2 continua funcionando quando o 1 cai');
  const evil=client();await evil.open();evil.send({t:'resume',sid:pr.sid,cid:pr.cid,token:'errado'});ok((await evil.wait(m=>m.t==='error'))?.code==='resume','reconexão com token falso é recusada');evil.close();
  await sleep(1600);/* desbloqueia o IP após a tentativa falsa */
  const p1b=client();await p1b.open();p1b.send({t:'resume',sid:pr.sid,cid:pr.cid,token:pr.token});const rs=await p1b.wait(m=>m.t==='paired');ok(rs&&rs.resumed&&rs.label==='CELULAR 1','reconexão segura com o token do aparelho (sem novo PIN)');
  ok(await host.wait(m=>m.t==='ctrl-state'&&m.cid===req.cid&&m.state==='connected'),'jogo vê o CELULAR 1 conectado de novo');
  console.log('Expiração e encerramento:');
  await sleep(Math.max(0,ses.expires-Date.now()+400));const late=client();await late.open();late.send({t:'join',pin:ses.pin,name:'Atrasado'});const ex=await late.wait(m=>m.t==='error');ok(ex&&ex.code==='pin','PIN expirado não aceita novos celulares');late.close();
  p1b.send({t:'in',s:1,ts:Date.now(),x:.3,y:0,b:0});ok(await host.wait(m=>m.t==='ctrl-in'&&m.cid===req.cid),'celulares já autorizados continuam após o PIN expirar');
  host.send({t:'host-close'});ok(await p2.wait(m=>m.t==='session-ended')&&await p1b.wait(m=>m.t==='session-ended'),'encerrar a sessão desconecta os celulares');
  console.log(`SERVER TEST PASS (${checks} verificações)`);
 }catch(e){console.error(e);console.error(out);process.exitCode=1;}finally{srv.kill();setTimeout(()=>process.exit(),200);}
})();
