'use strict';
/* Carrega os módulos de simulação (sem DOM) em um contexto Node para testes. */
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
module.exports=function load(files,opt){opt=opt||{};const store=opt.store||{};
 const sb={console,Math,Date,JSON,Object,Array,Number,String,Set,Map,Float32Array,Uint8Array,Uint16Array,Int32Array,Promise,setTimeout,clearTimeout,
  localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=String(v);},removeItem:k=>{delete store[k];}}};
 sb.globalThis=sb;if(opt.window)sb.window=sb;vm.createContext(sb);
 for(const f of files||['js/util.js','js/modes.js','js/data.js','js/rules.js','js/engine.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),sb,{filename:f});
 sb.MD.__store=store;return sb.MD;};
