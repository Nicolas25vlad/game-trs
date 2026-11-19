'use strict';
/* TRS26 — testes do sistema de entrada para o celular (dispositivo 'remote'), sem navegador.
   Os pacotes do celular chegam pela rede em qualquer momento; o jogo lê a entrada uma vez por quadro (IN.poll). */
const assert=require('node:assert/strict');const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const file=process.argv[2]||path.join(__dirname,'..','js','input','input.js');
let now=1000;const sb={console,Math,Date,JSON,Object,Array,Number,String,Set,Map,performance:{now:()=>now},
 localStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}}};sb.globalThis=sb;vm.createContext(sb);
vm.runInContext(fs.readFileSync(file,'utf8'),sb,{filename:'input.js'});const IN=sb.MD.Input;
let checks=0;const ok=(c,msg)=>{assert.ok(c,msg);checks++;console.log('  ✓ '+msg);};
const pkt=o=>({x:0,y:0,...o});const dev=()=>IN.device('rc-a');
console.log('Celular como controle:');
IN.remoteUpdate('rc-a','CELULAR 1',pkt({x:.5,y:-.5}));IN.poll();
ok(dev()&&dev().kind==='remote'&&dev().state.mx===.5&&dev().state.my===-.5,'primeiro pacote cria o dispositivo e move o analógico');
/* toque curto: apertou e soltou entre dois quadros (o Wi-Fi costuma entregar pacotes agrupados) */
now+=5;IN.remoteUpdate('rc-a','CELULAR 1',pkt({pass:true}));now+=5;IN.remoteUpdate('rc-a','CELULAR 1',pkt({}));IN.poll();
ok(dev().state.pass&&IN.pressed(dev(),'pass'),'toque curto entre dois quadros não se perde (o jogo vê o PASSE)');
now+=16;IN.poll();ok(!dev().state.pass,'no quadro seguinte o botão já está solto');
/* segurar e soltar continua normal */
IN.remoteUpdate('rc-a','CELULAR 1',pkt({shoot:true}));IN.poll();ok(dev().state.shoot,'segurar o CHUTE: botão apertado');
IN.poll();ok(dev().state.shoot&&!IN.pressed(dev(),'shoot'),'segurando: continua apertado, sem novo toque');
IN.remoteUpdate('rc-a','CELULAR 1',pkt({}));IN.poll();ok(!dev().state.shoot,'soltar o CHUTE: solta no quadro seguinte');
/* dois botões diferentes tocados no mesmo intervalo */
IN.remoteUpdate('rc-a','CELULAR 1',pkt({cross:true}));IN.remoteUpdate('rc-a','CELULAR 1',pkt({switch:true}));IN.remoteUpdate('rc-a','CELULAR 1',pkt({}));IN.poll();
ok(dev().state.cross&&dev().state.switch,'dois toques curtos no mesmo quadro: os dois chegam');
IN.poll();ok(!dev().state.cross&&!dev().state.switch,'e soltam no quadro seguinte');
/* sem pacote recente: zera (o celular não pode continuar andando sozinho), inclusive toques pendentes */
IN.remoteUpdate('rc-a','CELULAR 1',pkt({x:1,through:true}));IN.remoteUpdate('rc-a','CELULAR 1',pkt({x:1}));now+=900;IN.poll();
ok(dev().state.mx===0&&!dev().state.through,'sem pacote há 800 ms o comando é zerado (inclusive toque pendente)');
const g=a=>IN.glyph(dev(),a);ok(g('through')==='ENFIADA'&&g('cross')==='CRUZAR'&&g('shoot')==='CHUTAR'&&g('skill')==='DRIBLE'&&g('sprint')==='CORRER','nomes dos botões do celular iguais aos do controle (sem abreviações como PROF.)');
ok(g('up')==='ANALÓGICO'&&g('support')==='CHAMAR','direções e apoio também têm nome');
IN.remoteGone('rc-a');ok(!dev().connected,'celular desconectado sai da lista');
console.log(`INPUT TEST PASS (${checks} verificações)`);
