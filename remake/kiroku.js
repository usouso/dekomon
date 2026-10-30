// 試遊記録。ルール・ゲーム保存・乱数には触れず、端末内だけに保存する。
// 2026-10-30：dot の recording2（基準 PR48）を 最新（ひらめき・じゆう・たまご・savefix2）に 合わせた。
//   schema 3・鍵 v3（PR48 の v2 記録は 読まない・消さない）・たまご（inherit）を 記録と 再現に・容量不足の 記録削除（releaseForGameSave）は 入れない。
(function(root,factory){
  var api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.DekoRemakeRecord=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  var SCHEMA=3, BASE='8e99c33a56fbad36158079dbf5c51c44285f76a6', BUILD='remake-recording-3-egg';
  var MAX_RUNS=50, MAX_CHARS=1000000, MAX_BATTLES=12;
  var KEY='remake.playtest.records.v3', TEST_KEY='remake.playtest.test-records.v3';
  function jsonSafe(x){
    var count=0,ancestors=new Set();
    function visit(v,depth){
      if(++count>250000||depth>30)throw new Error('Record complexity limit');
      if(v===null||typeof v==='boolean')return;
      if(typeof v==='number'){if(!Number.isFinite(v)||Math.abs(v)>1e12)throw new Error('Invalid number');return;}
      if(typeof v==='string'){if(v.length>5000)throw new Error('String limit');return;}
      if(typeof v!=='object'||ancestors.has(v))throw new Error('Non JSON value');
      ancestors.add(v);
      if(Array.isArray(v)){if(v.length>5000)throw new Error('Array limit');for(var i=0;i<v.length;i++)visit(v[i],depth+1);}
      else Object.keys(v).forEach(function(k){if(['__proto__','prototype','constructor'].includes(k))throw new Error('Unsafe key');visit(v[k],depth+1);});
      ancestors.delete(v);
    }
    visit(x,0);return x;
  }
  function clone(x){return JSON.parse(JSON.stringify(jsonSafe(x)));}
  function equal(a,b){
    if(a===b)return true;
    if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
    var ak=Object.keys(a).sort(),bk=Object.keys(b).sort();
    return ak.length===bk.length&&ak.every(function(k,i){return k===bk[i]&&equal(a[k],b[k]);});
  }
  function empty(){return {schemaVersion:SCHEMA,baseSha:BASE,build:BUILD,nextId:1,active:null,runs:[],droppedRuns:0};}
  function snapshot(run){
    var out={};
    ['v','seed','species','stats','hearts','wins','owned','equip','tries','lossStreak','levels','nare','learned','inherit','history','over','clear','fork'].forEach(function(k){if(run[k]!==undefined)out[k]=clone(run[k]);});
    return out;
  }
  function saneRun(r){return r&&typeof r==='object'&&typeof r.id==='string'&&Array.isArray(r.battles)&&r.battles.length<=MAX_BATTLES;}
  function validStore(x){return x&&x.schemaVersion===SCHEMA&&x.baseSha===BASE&&x.build===BUILD&&Number.isSafeInteger(x.nextId)&&x.nextId>0&&Array.isArray(x.runs)&&x.runs.length<=MAX_RUNS&&x.runs.every(saneRun);}
  function create(storage,S,options){
    options=options||{};
    var enabled=options.enabled!==false&&!options.auto;
    var source=options.test?'test':'player', key=options.test?TEST_KEY:KEY;
    var store=empty(), currentId=null, warning='', unavailable=false;
    function load(){
      try{
        var raw=storage.getItem(key);
        if(raw&&raw.length>MAX_CHARS)throw new Error('too large');
        var next=raw?JSON.parse(raw):empty();
        if(!validStore(next))throw new Error('invalid record');
        validateExport({schemaVersion:SCHEMA,baseSha:BASE,build:BUILD,source:source,runs:next.runs});
        store=next;
      }catch(e){store=empty();unavailable=true;warning='前の記録を読めません。今回はメモリ内に記録します';}
    }
    load();currentId=store.active;
    function find(id){return store.runs.find(function(r){return r.id===id;});}
    function persist(){
      while(store.runs.length>MAX_RUNS){store.runs.shift();store.droppedRuns++;}
      var raw=JSON.stringify(store);
      while(raw.length>MAX_CHARS&&store.runs.length>1){store.runs.shift();store.droppedRuns++;raw=JSON.stringify(store);}
      if(raw.length>MAX_CHARS){warning='記録が大きすぎます。書き出して保存してください';return false;}
      if(unavailable)return false; // 壊れた既存記録は上書きせず、今回分はメモリ内で保持。
      try{storage.setItem(key,raw);warning='';return true;}
      catch(e){warning='端末に記録できません。画面を閉じる前に書き出してください';return false;}
    }
    function make(run,resumed){
      var r={id:'r'+store.nextId++,source:source,species:run.species,seed:run.seed,
        resumed:!!resumed,fromSequence:run.history.length+1,egg:run.inherit?{waza:run.inherit.waza,parent:run.inherit.parent,sp:run.inherit.sp}:null,battles:[],end:null};
      store.runs.push(r);store.active=r.id;currentId=r.id;return r;
    }
    function begin(run){
      if(options.auto)return null; // 自動検査は本人記録の関連付けも変更しない。
      try{
        var prior=find(currentId);
        if(prior&&!prior.end)prior.end={kind:'abandoned',lastRecordedSequence:prior.battles.length?prior.battles[prior.battles.length-1].sequence:null};
        // OFFで新しく始めた同seedの周回を、以前の記録へ結び付けない。
        // ゲーム保存には触らず、既にある記録の関連付けだけを外す。
        if(!enabled){store.active=null;currentId=null;if(store.runs.length)persist();return null;}
        var r=make(snapshot(run),false);persist();return r.id;
      }catch(e){warning='記録できませんでした。ゲームは続けられます';return null;}
    }
    function ensure(before){
      var r=find(currentId);
      if(!r||r.seed!==before.seed||r.species!==before.species)r=make(before,true);
      return r;
    }
    function record(before,roadIndex,equip,out,after){
      if(!enabled)return false;
      try{
        before=snapshot(before);after=snapshot(after);
        var r=ensure(before), sequence=before.history.length+1;
        if(r.battles.some(function(b){return b.sequence===sequence;}))return false;
        if(r.battles.length>=MAX_BATTLES){warning='この周回の記録は上限に達しました';return false;}
        var road=before.fork.roads[roadIndex];
        var battleSeed=S.mix(S.mix(before.seed,2000+before.wins),before.tries*31+(road.hard?7:3)+(road.idx==='boss'?99:road.idx));
        var b={id:r.id+':'+sequence,sequence:sequence,stage:before.fork.stage,retry:before.tries,
          offered:clone(before.fork.roads),roadIndex:roadIndex,selected:clone(road),
          before:before,equip:clone(equip),playerStats:clone(out.res.pSt),
          enemyStats:clone(out.res.eSt),
          battleSeed:battleSeed,result:clone(out),after:after,
          playerWaza:clone(S.wazaFor(before,S.cleanEquip(before,equip))),afterWaza:clone(S.wazaFor(after,after.equip)),
          freeBefore:S.freeOpen(before),freeAfter:S.freeOpen(after),slotsBefore:S.slotCount(before),slotsAfter:S.slotCount(after)};
        r.battles.push(b);
        if(after.over)r.end={kind:after.clear?'clear':'defeat',wins:after.wins,hearts:after.hearts};
        persist();return true;
      }catch(e){warning='記録できませんでした。ゲームは続けられます';return false;}
    }
    function recover(run,last){
      if(!enabled||!run||!last||!last.before||!last.out)return false;
      // 実保存済みの最後の試合だけ。古い周回/再生から新しい試合を作らない。
      if(last.key!==run.seed+':'+run.history.length||last.before.history.length+1!==run.history.length)return false;
      return record(last.before,last.road,last.equip,last.out,run);
    }
    function dictionary(){
      var d={parts:{},species:{},enemies:{},waza:{}};
      S.PARTS.forEach(function(p){d.parts[p.id]=p.name;});
      S.SPECIES.forEach(function(p){d.species[p.id]=p.name;});
      Object.keys(S.ENEMY_BY_ID).forEach(function(k){d.enemies[k]=S.ENEMY_BY_ID[k].name;});
      S.WAZA.forEach(function(p){d.waza[p.id]=p.name;});
      return d;
    }
    function exportData(){return {schemaVersion:SCHEMA,baseSha:BASE,build:BUILD,source:source,engineConfig:clone(S.CFG),
      explanation:{about:'でこもん作り直し版の端末内試遊記録。外部へ自動送信しません。',
        sequence:'実際に戦った通番。同じstageの再戦も別試合。retryは0から。',
        replay:'before / roadIndex / equipを実simのfightに渡しresult / afterと比較します。',
        limits:'最大50周回。記録の大きさの上限をこえたら古い周回を削除（ゲームの保存は消しません）。resumedは途中から記録、過去の操作は復元しません。',
        before:'戦前の能力・装備・所持品・覚えた技・なれ・たまご(inherit)・履歴・提示ルート。afterは報酬/成長反映後。個人名は含めません。'},
      dictionary:dictionary(),droppedRuns:store.droppedRuns,runs:clone(store.runs),warning:warning};}
    function status(){return {enabled:enabled,source:source,warning:warning,runs:store.runs.length,battles:store.runs.reduce(function(n,r){return n+r.battles.length;},0),key:key};}
    return {begin:begin,record:record,recover:recover,exportData:exportData,status:status};
  }
  function validateExport(data){
    jsonSafe(data);
    if(!data||data.schemaVersion!==SCHEMA||data.baseSha!==BASE||data.build!==BUILD||!['player','test'].includes(data.source)||!Array.isArray(data.runs)||data.runs.length>MAX_RUNS)throw new Error('Unsupported recording schema/build');
    data.runs.forEach(function(r){
      if(!saneRun(r)||r.source!==data.source)throw new Error('Invalid run/source');
      var seen={},previous=0;
      r.battles.forEach(function(b){
        if(!b||!Number.isInteger(b.sequence)||b.sequence<1||seen[b.sequence]||!b.before||!b.after||!b.result||!b.equip||!Number.isInteger(b.roadIndex)||!b.before.fork||!b.before.fork.roads[b.roadIndex])throw new Error('Invalid battle');
        seen[b.sequence]=true;
        if(b.sequence<=previous||b.sequence>12||b.sequence!==b.before.history.length+1||b.after.history.length!==b.sequence||b.stage!==b.before.fork.stage||b.retry!==b.before.tries)throw new Error('Invalid battle sequence');
        previous=b.sequence;
        if(r.seed!==b.before.seed||r.species!==b.before.species||b.id!==r.id+':'+b.sequence||!equal(b.offered,b.before.fork.roads)||!equal(b.selected,b.offered[b.roadIndex]))throw new Error('Inconsistent battle metadata');
        [b.before,b.after].forEach(function(s){
          if(!Number.isInteger(s.seed)||s.seed<0||s.seed>4294967295||!Number.isInteger(s.wins)||s.wins<0||s.wins>10||!Number.isInteger(s.tries)||s.tries<0||s.tries>3||!Array.isArray(s.history)||s.history.length>12||!Array.isArray(s.owned)||s.owned.length>32||!Array.isArray(s.levels)||s.levels.length>10||!s.stats||!s.equip||!s.fork||!Array.isArray(s.fork.roads)||s.fork.roads.length<1||s.fork.roads.length>2)throw new Error('Invalid state');
          if(s.learned!==undefined&&(!Array.isArray(s.learned)||s.learned.length>32))throw new Error('Invalid learned state');
          if(s.nare!==undefined&&(!s.nare||typeof s.nare!=='object'||Array.isArray(s.nare)))throw new Error('Invalid nare state');
          if(s.inherit!==undefined&&(!s.inherit||typeof s.inherit!=='object'||Array.isArray(s.inherit)||typeof s.inherit.waza!=='string'||typeof s.inherit.fit!=='boolean'))throw new Error('Invalid inherit state');
        });
      });
    });return data;
  }
  function replay(data,S){
    validateExport(data);if(!equal(data.engineConfig,S.CFG))throw new Error('Simulator config mismatch');var count=0;
    data.runs.forEach(function(r){r.battles.forEach(function(b){
      var after=clone(b.before), result=S.fight(after,b.roadIndex,clone(b.equip));
      if(!equal(b.playerStats,result.res.pSt)||!equal(b.enemyStats,result.res.eSt))throw new Error('Battle stats mismatch');
      var road=b.before.fork.roads[b.roadIndex], seed=S.mix(S.mix(b.before.seed,2000+b.before.wins),b.before.tries*31+(road.hard?7:3)+(road.idx==='boss'?99:road.idx));
      if(seed!==b.battleSeed||!equal(result,b.result)||!equal(snapshot(after),b.after)||!equal(S.wazaFor(b.before,S.cleanEquip(b.before,b.equip)),b.playerWaza)||!equal(S.wazaFor(after,after.equip),b.afterWaza)||b.freeBefore!==S.freeOpen(b.before)||b.freeAfter!==S.freeOpen(after)||b.slotsBefore!==S.slotCount(b.before)||b.slotsAfter!==S.slotCount(after))throw new Error('Replay mismatch '+r.id+'/'+b.sequence);
      count++;
    });});return count;
  }
  function fileName(now){return 'dekomon-remake-records-'+BUILD+'-'+(now||new Date()).toISOString().replace(/[:.]/g,'-')+'.json';}
  return {SCHEMA:SCHEMA,BASE:BASE,BUILD:BUILD,KEY:KEY,TEST_KEY:TEST_KEY,MAX_RUNS:MAX_RUNS,MAX_CHARS:MAX_CHARS,MAX_BATTLES:MAX_BATTLES,
    create:create,snapshot:snapshot,validateExport:validateExport,replay:replay,fileName:fileName};
});
