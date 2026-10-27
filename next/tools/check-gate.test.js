'use strict';
const assert=require('assert/strict'),fs=require('fs'),vm=require('vm');
const qualityGate=require('./check-gate');
const source=fs.readFileSync(__dirname+'/check.js','utf8');
const block=source.split('// QUALITY_GATE_BEGIN:')[1].split('// QUALITY_GATE_END')[0].replace(/^[^\n]*\n/,'');
const opts={runs:2,sizes:['1920x910'],inner0:['1920x910']};
function row(){return {size:{w:1920,h:910},runs:2,mism:0,autoLines:['[でこもん auto] done'],errs:[],misc:[],a:{auto:{runs:2,mismatches:0,overlaps:0,seeThrough:0,doubleFlash:0,pageScroll:{},innerScroll:{},screens:{battle:1}},overlaps:[],seeThrough:[]}};}
const cases=[
 ['clean',()=>{},false],
 ['calculation mismatch',r=>{r.a.auto.mismatches=1;},true],
 ['console mismatch with zero aggregate',r=>{r.mism=1;},true],
 ['overlap',r=>{r.a.auto.overlaps=1;},true],
 ['overlap detail with zero aggregate',r=>{r.a.overlaps=[{bad:true}];},true],
 ['see-through',r=>{r.a.auto.seeThrough=1;},true],
 ['see-through detail',r=>{r.a.seeThrough=[{bad:true}];},true],
 ['double flash',r=>{r.a.auto.doubleFlash=1;},true],
 ['pageerror',r=>{r.misc=['pageerror: boom'];},true],
 ['console error',r=>{r.misc=['failed to load resource'];},true],
 ['timeout before requested runs',r=>{r.runs=1;},true],
 ['telemetry incomplete',r=>{r.a.auto.runs=1;},true],
 ['missing auto telemetry',r=>{delete r.a.auto;},true],
 ['missing metric',r=>{delete r.a.auto.overlaps;},true],
 ['NaN metric',r=>{r.a.auto.overlaps=NaN;},true],
 ['negative metric',r=>{r.a.auto.overlaps=-1;},true],
 ['no progress logs',r=>{r.autoLines=[];},true],
 ['no sampled screens',r=>{r.a.auto.screens={};},true],
 ['PC page scroll',r=>{r.a.auto.pageScroll={pre:1};},true],
 ['regulated inner scroll',r=>{r.a.auto.innerScroll={pre:1};},true]
];
let checked=0;
for(const [name,mutate,expectedFailure] of cases){
 const r=row();mutate(r);
 const issues=qualityGate([r],opts);
 assert.equal(issues.length>0,expectedFailure,name);
 const proc={exitCode:0};
 vm.runInNewContext(block,{qualityGate,rows:[r],RUNS:opts.runs,SIZES:[r.size],INNER0:opts.inner0,console:{log(){}},process:proc});
 assert.equal(proc.exitCode,expectedFailure?1:0,name+' integrated exit code');
 console.log(JSON.stringify({case:name,expectedFailure,issues:issues.map(i=>i.code),exitCode:proc.exitCode,pass:true}));checked++;
}
function extra(name,rows,options,expectedFailure){
 const issues=qualityGate(rows,options);assert.equal(issues.length>0,expectedFailure,name);
 console.log(JSON.stringify({case:name,expectedFailure,issues:issues.map(i=>i.code),pass:true}));checked++;
}
extra('missing required viewport',[],opts,true);
extra('duplicate viewport',[row(),row()],opts,true);
extra('required inner viewport not requested',[row()],{...opts,inner0:['1366x650']},true);
extra('invalid run count',[row()],{...opts,runs:NaN},true);
extra('invalid viewport',[row()],{...opts,sizes:['0x910']},true);
const mobile=row();mobile.size={w:375,h:812};mobile.a.auto.pageScroll={pre:5};mobile.a.auto.innerScroll={pre:2};
extra('mobile intentional page and unregulated inner scroll',[mobile],{runs:2,sizes:['375x812'],inner0:[]},false);
// Demonstrate the existing loophole using the unmodified old exit block.
const oldBlock=fs.readFileSync(__dirname+'/fixtures/check-exit-original-80386b87.js','utf8');
for(const [name,mutate] of cases.filter(c=>['overlap','calculation mismatch','pageerror','timeout before requested runs'].includes(c[0]))){
 const r=row();mutate(r);const proc={exitCode:0};
 vm.runInNewContext(oldBlock,{rows:[r],INNER0:opts.inner0,console:{log(){}},process:proc,fmtObj:()=>''});
 assert.equal(proc.exitCode,0,'baseline loophole: '+name);
 assert.ok(qualityGate([r],opts).length,'proposal must reject '+name);
 console.log(JSON.stringify({case:'baseline loophole: '+name,originalExitCode:0,proposalRejects:true,syntheticTelemetry:true,pass:true}));checked++;
}
console.log('Synthetic quality-gate and integrated exit checks: '+checked+' cases passed. No browser or game runtime was launched.');
