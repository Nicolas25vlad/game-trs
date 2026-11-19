'use strict';
/* Roda todos os tests/*.test.cjs em sequência, cada um no próprio processo, e resume no fim.
   Uso: node tests/run.cjs [--rapido] [filtro...]
   --rapido pula os conjuntos lentos (coreografia, mundo e Monte Carlo), que levam ~1,5 min juntos. */
const {spawnSync}=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
const LENTOS=['choreo','world','montecarlo'];
const args=process.argv.slice(2),rapido=args.includes('--rapido'),filtros=args.filter(a=>!a.startsWith('--'));
const todos=fs.readdirSync(__dirname).filter(f=>f.endsWith('.test.cjs')).sort();
const lista=todos.filter(f=>(!rapido||!LENTOS.some(l=>f.startsWith(l)))&&(!filtros.length||filtros.some(x=>f.includes(x))));
if(!lista.length){console.error('Nenhum teste encontrado para',filtros.join(' '));process.exit(1);}
const falhas=[],t0=Date.now();
for(const f of lista){
 const t=Date.now();console.log(`\n▶ ${f}`);
 const r=spawnSync(process.execPath,[path.join(__dirname,f)],{stdio:'inherit'});
 const s=((Date.now()-t)/1000).toFixed(1);
 if(r.status!==0){falhas.push(f);console.log(`✗ ${f} falhou (${s} s)`);}else console.log(`✓ ${f} (${s} s)`);
}
console.log(`\n${lista.length-falhas.length}/${lista.length} conjuntos passaram em ${((Date.now()-t0)/1000).toFixed(1)} s`+(rapido?' (modo rápido)':''));
if(falhas.length){console.log('Falharam:',falhas.join(', '));process.exit(1);}
