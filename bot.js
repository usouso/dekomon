// でこもん 版4 — ボット検証（Node で実行: node bot.js [周回数] [固定の周回数] [表の回数]）
'use strict';
var S = require('./sim.js');
// 調整用：DEKO_CFG='{"stageHp":0.05}' のように数値を上書きできる
if (process.env.DEKO_CFG) { var ov = JSON.parse(process.env.DEKO_CFG); Object.keys(ov).forEach(function (k) { if (typeof ov[k] === 'object' && S.CFG[k]) Object.assign(S.CFG[k], ov[k]); else S.CFG[k] = ov[k]; }); console.log('CFG override: ' + process.env.DEKO_CFG); }
var RUNS = parseInt(process.argv[2] || '2000', 10);
var FIXED_RUNS = parseInt(process.argv[3] || '100', 10);
var TABLE_TRIALS = parseInt(process.argv[4] || '200', 10);
var rng = S.makeRng(20261025);
var NB = S.CFG.runBattles;

function pct(x) { return (x * 100).toFixed(1) + '%'; }
function f1(x) { return x.toFixed(1); }
function f2(x) { return x.toFixed(2); }
function cname(c) { return c.length ? c.map(function (p) { return S.PART_BY_ID[p].name; }).join('＋') : '（なし）'; }

// ---------- 周回を遊ぶ ----------
function newStats() {
  var st = { runs: 0, clears: 0, reach5: 0, sumWins: 0, winsHist: [], battles: 0, timeouts: 0, hands: [],
    stage: [], use: {}, syn: {}, count: [0, 0, 0, 0], sparks: 0, sparkZero: 0, sparkByPart: {}, actByPart: {}, sparkHist: [] };
  for (var i = 0; i <= NB; i++) st.winsHist.push(0);
  for (var j = 0; j < NB; j++) st.stage.push({ n: 0, w: 0 });
  S.PART_IDS.forEach(function (p) { st.use[p] = 0; st.sparkByPart[p] = 0; st.actByPart[p] = 0; });
  S.SYNERGIES.forEach(function (s) { st.syn[s.id] = 0; });
  return st;
}
function playRun(chooser, stats, fixedParts) {
  var run = S.newRun(rng);
  var owned = fixedParts ? S.PART_IDS.slice() : S.startItems(rng);
  var wins = 0, lv2 = [], pity = 0, sparksThisRun = 0;
  var synSeen = {};
  for (var b = 0; b < NB; b++) {
    var stage = b + 1, eIdx = run.enemies[b], fId = run.fields[b];
    var parts = fixedParts ? fixedParts : chooser.loadout(owned, eIdx, stage, fId, wins, lv2);
    var res = S.runBattle(parts, eIdx, stage, fId, { rng: rng, wins: wins, lv2: lv2, spark: { stage: stage, pity: pity } });
    stats.battles++;
    stats.hands.push(res.nHands);
    stats.count[parts.length]++;
    parts.forEach(function (p) { stats.use[p]++; });
    if (res.timeout) stats.timeouts++;
    res.summary.synergies.forEach(function (s) { if (s.side === 'p') synSeen[s.id] = true; });
    Object.keys(res.summary.activations).forEach(function (p) { stats.actByPart[p] += res.summary.activations[p]; });
    if (res.spark) { stats.sparks++; stats.sparkByPart[res.spark]++; sparksThisRun++; pity = 0; if (lv2.indexOf(res.spark) < 0) lv2.push(res.spark); }
    else pity++;
    stats.stage[b].n++;
    var won = res.winner === 'p';
    if (won) { stats.stage[b].w++; wins++; } else break;
    if (!fixedParts && S.pickAfterWin(wins)) { var pk = S.pickPart(owned, rng); if (pk) owned.push(pk); }
  }
  Object.keys(synSeen).forEach(function (id) { stats.syn[id]++; });
  stats.runs++;
  stats.winsHist[wins]++;
  if (wins === NB) stats.clears++;
  if (wins >= 5) stats.reach5++;
  stats.sumWins += wins;
  stats.sparkHist.push(sparksThisRun);
  if (sparksThisRun === 0) stats.sparkZero++;
}
function handsSummary(h) {
  var sorted = h.slice().sort(function (a, b) { return a - b; });
  var n = sorted.length;
  var mean = sorted.reduce(function (a, b) { return a + b; }, 0) / n;
  var within = sorted.filter(function (x) { return x >= 8 && x <= 14; }).length / n;
  var under = sorted.filter(function (x) { return x < 8; }).length / n;
  return { mean: mean, p10: sorted[Math.floor(n * 0.1)], p50: sorted[Math.floor(n * 0.5)], p90: sorted[Math.floor(n * 0.9)], within: within, under: under };
}
function reportBot(name, st) {
  var hs = handsSummary(st.hands);
  console.log('### ' + name + '（周回 ' + st.runs + ' 回）');
  console.log('');
  console.log('| 10連勝率 | 5勝到達 | 平均連勝 | ' + st.winsHist.map(function (_, i) { return i + '勝'; }).join(' | ') + ' |');
  console.log('|' + new Array(st.winsHist.length + 4).join('---|'));
  console.log('| ' + pct(st.clears / st.runs) + ' | ' + pct(st.reach5 / st.runs) + ' | ' + f2(st.sumWins / st.runs) + ' | ' + st.winsHist.map(function (x) { return pct(x / st.runs); }).join(' | ') + ' |');
  console.log('');
  console.log('| 段階 | ' + st.stage.map(function (_, i) { return i + 1; }).join(' | ') + ' |');
  console.log('|' + new Array(st.stage.length + 2).join('---|'));
  console.log('| その戦いの勝率 | ' + st.stage.map(function (s) { return s.n ? pct(s.w / s.n) : '-'; }).join(' | ') + ' |');
  console.log('');
  console.log('手数：平均 ' + f1(hs.mean) + '、中央 ' + hs.p50 + '、10%点 ' + hs.p10 + '、90%点 ' + hs.p90 + '、8〜14手 ' + pct(hs.within) + '、8手未満 ' + pct(hs.under) + '、16手で判定 ' + pct(st.timeouts / st.battles));
  console.log('つけた個数：0個 ' + pct(st.count[0] / st.battles) + '、1個 ' + pct(st.count[1] / st.battles) + '、2個 ' + pct(st.count[2] / st.battles) + '、3個 ' + pct(st.count[3] / st.battles));
  var sh = st.sparkHist.slice().sort(function (a, b) { return a - b; });
  console.log('ひらめき：1周回あたり 平均 ' + f2(st.sparks / st.runs) + ' 回（中央 ' + sh[Math.floor(sh.length / 2)] + '、最大 ' + sh[sh.length - 1] + '）、0回の周回 ' + pct(st.sparkZero / st.runs) + '、1戦あたり ' + pct(st.sparks / st.battles));
  console.log('');
  return hs;
}

var randomBot = { loadout: function (owned) { return S.randomLoadout(owned, rng); } };
var matchedBot = { loadout: function (owned, eIdx, stage, fId, wins, lv2) { return S.bestLoadout(owned, eIdx, stage, fId, wins, lv2).parts; } };

console.log('# でこもん 版4 ボット結果');
console.log('');
var t0 = Date.now();
var stR = newStats();
for (var i = 0; i < RUNS; i++) playRun(randomBot, stR);
var hsR = reportBot('ランダムボット（場所の制約を守って 0〜3個ランダム）', stR);
var stM = newStats();
for (var j = 0; j < RUNS; j++) playRun(matchedBot, stM);
var hsM = reportBot('合わせボット（毎戦その相手に最良の3つ。ひらめき狙いはしない）', stM);

console.log('### 合わせボットのパーツ使用率（その戦いで付けていた割合）とひらめき');
console.log('');
console.log('| パーツ | ' + S.PART_IDS.map(function (p) { return S.PART_BY_ID[p].name; }).join(' | ') + ' |');
console.log('|' + new Array(S.PART_IDS.length + 2).join('---|'));
var useRates = S.PART_IDS.map(function (p) { return stM.use[p] / stM.battles; });
console.log('| 使用率 | ' + useRates.map(pct).join(' | ') + ' |');
var sparkShare = S.PART_IDS.map(function (p) { return stM.sparks ? stM.sparkByPart[p] / stM.sparks : 0; });
console.log('| 全ひらめきに占める割合 | ' + sparkShare.map(pct).join(' | ') + ' |');
var sparkPerAct = S.PART_IDS.map(function (p) { return stM.actByPart[p] ? stM.sparkByPart[p] / stM.actByPart[p] : 0; });
console.log('| 発動1回あたりのひらめき率 | ' + sparkPerAct.map(pct).join(' | ') + ' |');
console.log('| 発動の回数（周回あたり） | ' + S.PART_IDS.map(function (p) { return f1(stM.actByPart[p] / stM.runs); }).join(' | ') + ' |');
console.log('');

console.log('### 噛み合いの発動率（合わせボットの周回のうち、自分の側で1回以上発動した割合）');
console.log('');
console.log('| 噛み合い | ' + S.SYNERGIES.map(function (s) { return s.id + ' ' + s.name; }).join(' | ') + ' |');
console.log('|' + new Array(S.SYNERGIES.length + 2).join('---|'));
var synRates = S.SYNERGIES.map(function (s) { return stM.syn[s.id] / stM.runs; });
console.log('| 発動率 | ' + synRates.map(pct).join(' | ') + ' |');
console.log('| ランダム | ' + S.SYNERGIES.map(function (s) { return pct(stR.syn[s.id] / stR.runs); }).join(' | ') + ' |');
console.log('');

// ---------- Lv2 の効き：同じ相手に Lv1 と Lv2 で戦ったときの勝率の差 ----------
console.log('### Lv2 の効き（そのパーツを含む固定3つ 84通り × 相手10 × フィールド4、段階5、育ちなし、乱れあり各 4 回。Lv1 と Lv2 の勝率の差）');
console.log('');
console.log('| パーツ | Lv1 勝率 | Lv2 勝率 | 差 |');
console.log('|---|---|---|---|');
var triples = S.loadouts(S.PART_IDS).filter(function (c) { return c.length === 3; });
var lv2Delta = {};
S.PART_IDS.forEach(function (p) {
  var w1 = 0, w2 = 0, n = 0;
  triples.filter(function (c) { return c.indexOf(p) >= 0; }).forEach(function (combo) {
    S.ENEMIES.forEach(function (e) {
      S.FIELDS.forEach(function (f) {
        for (var t = 0; t < 4; t++) {
          if (S.runBattle(combo, e.index, 5, f.id, { rng: rng }).winner === 'p') w1++;
          if (S.runBattle(combo, e.index, 5, f.id, { rng: rng, lv2: [p] }).winner === 'p') w2++;
          n++;
        }
      });
    });
  });
  lv2Delta[p] = (w2 - w1) / n;
  console.log('| ' + S.PART_BY_ID[p].name + ' | ' + pct(w1 / n) + ' | ' + pct(w2 / n) + ' | ' + ((w2 - w1) / n * 100 >= 0 ? '+' : '') + ((w2 - w1) / n * 100).toFixed(1) + ' |');
});
console.log('');

// ---------- 固定の周回：16パーツ全部を持ち、3つ固定（448通り） ----------
var fixedRows = [];
triples.forEach(function (combo) {
  var st = newStats();
  for (var r = 0; r < FIXED_RUNS; r++) playRun(null, st, combo);
  fixedRows.push({ combo: combo, clear: st.clears / st.runs, reach5: st.reach5 / st.runs, avg: st.sumWins / st.runs, sparks: st.sparks / st.runs });
});
fixedRows.sort(function (a, b) { return b.clear - a.clear || b.avg - a.avg; });
console.log('### 固定の周回（' + triples.length + ' 通り × 各 ' + FIXED_RUNS + ' 周回。同じ3つを使い続けるので ひらめきが集まる）');
console.log('');
console.log('| 順 | 組み合わせ | 10連勝率 | 5勝到達 | 平均連勝 | ひらめき/周回 |');
console.log('|---|---|---|---|---|---|');
fixedRows.slice(0, 10).forEach(function (r, i) { console.log('| ' + (i + 1) + ' | ' + cname(r.combo) + ' | ' + pct(r.clear) + ' | ' + pct(r.reach5) + ' | ' + f2(r.avg) + ' | ' + f2(r.sparks) + ' |'); });
console.log('| … | | | | | |');
fixedRows.slice(-5).forEach(function (r, i) { console.log('| ' + (fixedRows.length - 4 + i) + ' | ' + cname(r.combo) + ' | ' + pct(r.clear) + ' | ' + pct(r.reach5) + ' | ' + f2(r.avg) + ' | ' + f2(r.sparks) + ' |'); });
console.log('');
var fixedBest = fixedRows[0];
console.log('固定の最高 ' + pct(fixedBest.clear) + '（' + cname(fixedBest.combo) + '）、全448通りの平均 ' + pct(fixedRows.reduce(function (a, r) { return a + r.clear; }, 0) / fixedRows.length));
console.log('');

// ---------- 相手×段階（1・5・10。育ちなし・Lv2なし） ----------
console.log('### 相手×段階（16パーツ全部から その相手・フィールドに最良の3つ、乱れありで各 ' + TABLE_TRIALS + ' 回。フィールド4つの平均。育ちなし・Lv2なし）');
console.log('');
console.log('| 相手 | 段1 | 段5 | 段10 | 段10で選ばれた組み合わせ（ふつう） |');
console.log('|---|---|---|---|---|');
var tableMin10 = 1, tableMinName = '';
S.ENEMIES.forEach(function (e) {
  var cells = [], best10 = null;
  [1, 5, 10].forEach(function (s) {
    var sum = 0;
    S.FIELDS.forEach(function (f) {
      var best = S.bestLoadout(S.PART_IDS, e.index, s, f.id, 0, []);
      if (s === 10 && f.id === 'plain') best10 = best;
      var w = 0;
      for (var t = 0; t < TABLE_TRIALS; t++) { if (S.runBattle(best.parts, e.index, s, f.id, { rng: rng }).winner === 'p') w++; }
      sum += w / TABLE_TRIALS;
    });
    var rate = sum / S.FIELDS.length;
    cells.push(rate);
    if (s === 10 && rate < tableMin10) { tableMin10 = rate; tableMinName = e.name; }
  });
  console.log('| ' + e.name + ' | ' + cells.map(function (x) { return pct(x) + (x < 0.6 ? ' ⚠' : ''); }).join(' | ') + ' | ' + cname(best10.parts) + ' |');
});
console.log('');

// ---------- 目標との比較 ----------
var ok = function (b) { return b ? '届いた' : '届かない'; };
var minUse = Math.min.apply(null, useRates), minUseName = S.PART_BY_ID[S.PART_IDS[useRates.indexOf(minUse)]].name;
var minSyn = Math.min.apply(null, synRates), minSynName = S.SYNERGIES[synRates.indexOf(minSyn)].name;
var minShare = Math.min.apply(null, sparkShare), maxShare = Math.max.apply(null, sparkShare);
var minShareName = S.PART_BY_ID[S.PART_IDS[sparkShare.indexOf(minShare)]].name, maxShareName = S.PART_BY_ID[S.PART_IDS[sparkShare.indexOf(maxShare)]].name;
var deltas = S.PART_IDS.map(function (p) { return lv2Delta[p]; });
var minDelta = Math.min.apply(null, deltas), maxDelta = Math.max.apply(null, deltas);
var minDeltaName = S.PART_BY_ID[S.PART_IDS[deltas.indexOf(minDelta)]].name, maxDeltaName = S.PART_BY_ID[S.PART_IDS[deltas.indexOf(maxDelta)]].name;
var handsOk = function (hs) { return hs.mean >= 8 && hs.mean <= 14 && hs.p50 >= 8 && hs.p50 <= 14 && hs.within >= 0.5; };
var mClear = stM.clears / stM.runs, sparksPerRun = stM.sparks / stM.runs;
console.log('### 目標との比較');
console.log('');
console.log('| 目標 | 結果 | 判定 |');
console.log('|---|---|---|');
console.log('| 合わせの10連勝率 50〜70% | ' + pct(mClear) + ' | ' + ok(mClear >= 0.5 && mClear <= 0.7) + ' |');
console.log('| 合わせの5勝到達 85% 以上 | ' + pct(stM.reach5 / stM.runs) + ' | ' + ok(stM.reach5 / stM.runs >= 0.85) + ' |');
console.log('| ランダムの10連勝率 5% 以下 | ' + pct(stR.clears / stR.runs) + ' | ' + ok(stR.clears / stR.runs <= 0.05) + ' |');
console.log('| 固定の最高が 合わせの 20〜50% | 固定の最高 ' + pct(fixedBest.clear) + ' ／ 合わせ ' + pct(mClear) + ' → ' + (mClear ? (fixedBest.clear / mClear * 100).toFixed(0) : '-') + '% | ' + ok(mClear > 0 && fixedBest.clear >= mClear * 0.2 && fixedBest.clear <= mClear * 0.5) + ' |');
console.log('| 相手×段階：どの相手も段階10で 60% 以上 | 最低 ' + pct(tableMin10) + '（' + tableMinName + '） | ' + ok(tableMin10 >= 0.6) + ' |');
console.log('| パーツ使用率が 16種すべて 8% 以上 | 最低 ' + pct(minUse) + '（' + minUseName + '） | ' + ok(minUse >= 0.08) + ' |');
console.log('| 噛み合い8つが それぞれ 12% 以上 | 最低 ' + pct(minSyn) + '（' + minSynName + '） | ' + ok(minSyn >= 0.12) + ' |');
console.log('| ひらめき 1周回あたり 2〜4回 | ' + f2(sparksPerRun) + ' 回 | ' + ok(sparksPerRun >= 2 && sparksPerRun <= 4) + ' |');
console.log('| ひらめき 0回の周回 10% 以下 | ' + pct(stM.sparkZero / stM.runs) + ' | ' + ok(stM.sparkZero / stM.runs <= 0.10) + ' |');
console.log('| 16種それぞれが 全ひらめきの 2〜15% | 最低 ' + pct(minShare) + '（' + minShareName + '）、最高 ' + pct(maxShare) + '（' + maxShareName + '） | ' + ok(minShare >= 0.02 && maxShare <= 0.15) + ' |');
console.log('| Lv2 の効き：16種すべて +3 以上、+30 以下 | 最低 ' + (minDelta * 100).toFixed(1) + '（' + minDeltaName + '）、最高 ' + (maxDelta * 100).toFixed(1) + '（' + maxDeltaName + '） | ' + ok(minDelta >= 0.03 && maxDelta <= 0.30) + ' |');
console.log('| 手数は 8〜14 が中心 | 合わせ：平均 ' + f1(hsM.mean) + '・中央 ' + hsM.p50 + '・範囲内 ' + pct(hsM.within) + ' ／ ランダム：平均 ' + f1(hsR.mean) + '・中央 ' + hsR.p50 + '・範囲内 ' + pct(hsR.within) + ' | ' + ok(handsOk(hsM) && handsOk(hsR)) + ' |');
console.log('');
console.log('（計算時間 ' + ((Date.now() - t0) / 1000).toFixed(1) + ' 秒）');
