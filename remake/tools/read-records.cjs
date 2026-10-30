'use strict';
// node read-records.cjs <export.json>。読取りと再現検査だけ。ネットワーク/書込みなし。
const fs=require('node:fs'),R=require('./kiroku.js'),S=require('./sim.js');
try {
  const file=process.argv[2];
  if(!file)throw new Error('Usage: node read-records.cjs <export.json>');
  if(fs.statSync(file).size>R.MAX_CHARS*12)throw new Error('Export exceeds size limit');
  const text=fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'');
  const data=R.validateExport(JSON.parse(text)), n=R.replay(data,S);
  console.log('schema='+data.schemaVersion+' build='+data.build+' base='+data.baseSha+' source='+data.source);
  console.log('再現一致: '+n+'試合 / '+data.runs.length+'周回（過去の切捨て '+data.droppedRuns+'周回）');
  data.runs.forEach(r=>{
    console.log(r.id+' '+(data.dictionary.species[r.species]||r.species)+' seed='+r.seed+' '+(r.resumed?'途中から ':'')+(r.end?r.end.kind:'継続中'));
    r.battles.forEach(b=>console.log('  #'+b.sequence+' stage='+b.stage+' retry='+b.retry+' road='+b.roadIndex+' '+(b.result.win?'勝':'負')+' equip='+JSON.stringify(b.equip)+' growth='+JSON.stringify(b.result.level||{})));
  });
} catch(e){console.error('記録検査に失敗: '+e.message);process.exitCode=1;}
