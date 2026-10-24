// でこもん 版3 — ボット検証（Node で実行: node bot.js [周回数] [固定の周回数] [相手×段階の回数]）
// sim.js だけを使い、画面なしで回す。
'use strict';
var S = require('./sim.js');
var RUNS = parseInt(process.argv[2] || '2000', 10);
var FIXED_RUNS = parseInt(process.argv[3] || '200', 10);
var TABLE_TRIALS = parseInt(process.argv[4] || '200', 10);
var rng = S.makeRng(20261025);

function pct(x) { return (x * 100).toFixed(1) + '%'; }
function f1(x) { return x.toFixed(1); }
function cname(c) { return c.length ? c.map(function (p) { return S.PART_BY_ID[p].name; }).join('＋') : '（なし）'; }

// ---------- 周回を遊ぶ ----------
// chooser: { loadout(owned, enemyIdx, stage, fieldId) -> parts }
function newStats() {
  var st = { runs: 0, clears: 0, sumWins: 0, winsHist: [0, 0, 0, 0, 0, 0], battles: 0, timeouts: 0, hands: [],
    stage: [0, 1, 2, 3, 4].map(function () { return { n: 0, w: 0 }; }), use: {}, syn: {}, count: [0, 0, 0, 0] };
  S.PART_IDS.forEach(function (p) { st.use[p] = 0; });
  S.SYNERGIES.forEach(function (s) { st.syn[s.id] = 0; });
  return st;
}
function playRun(chooser, stats, fixedParts) {
  var run = S.newRun(rng);
  var owned = fixedParts ? S.PART_IDS.slice() : S.startPack(rng);
  var wins = 0;
  var synSeen = {};
  for (var b = 0; b < 5; b++) {
    var stage = b + 1, eIdx = run.enemies[b], fId = run.fields[b];
    var parts = fixedParts ? fixedParts : chooser.loadout(owned, eIdx, stage, fId);
    var res = S.runBattle(parts, eIdx, stage, fId, { rng: rng });
    stats.battles++;
    stats.hands.push(res.nHands);
    stats.count[parts.length]++;
    parts.forEach(function (p) { stats.use[p]++; });
    if (res.timeout) stats.timeouts++;
    res.summary.synergies.forEach(function (s) { if (s.side === 'p') synSeen[s.id] = true; });
    stats.stage[b].n++;
    var won = res.winner === 'p';
    if (won) { stats.stage[b].w++; wins++; } else break;
    if (b < 4 && !fixedParts) owned = owned.concat(S.winPack(owned, rng));
  }
  Object.keys(synSeen).forEach(function (id) { stats.syn[id]++; });
  stats.runs++;
  stats.winsHist[wins]++;
  if (wins === 5) stats.clears++;
  stats.sumWins += wins;
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
  console.log('| 5連勝率 | 平均連勝 | 0勝 | 1勝 | 2勝 | 3勝 | 4勝 | 5勝 |');
  console.log('|---|---|---|---|---|---|---|---|');
  console.log('| ' + pct(st.clears / st.runs) + ' | ' + (st.sumWins / st.runs).toFixed(2) + ' | ' +
    st.winsHist.map(function (x) { return pct(x / st.runs); }).join(' | ') + ' |');
  console.log('');
  console.log('| 段階 | 1 | 2 | 3 | 4 | 5 |');
  console.log('|---|---|---|---|---|---|');
  console.log('| その戦いの勝率 | ' + st.stage.map(function (s) { return s.n ? pct(s.w / s.n) : '-'; }).join(' | ') + ' |');
  console.log('');
  console.log('手数：平均 ' + f1(hs.mean) + '、中央 ' + hs.p50 + '、10%点 ' + hs.p10 + '、90%点 ' + hs.p90 +
    '、8〜14手に収まる割合 ' + pct(hs.within) + '、8手未満 ' + pct(hs.under) + '、16手で判定 ' + pct(st.timeouts / st.battles));
  console.log('つけた個数：0個 ' + pct(st.count[0] / st.battles) + '、1個 ' + pct(st.count[1] / st.battles) + '、2個 ' + pct(st.count[2] / st.battles) + '、3個 ' + pct(st.count[3] / st.battles));
  console.log('');
  return hs;
}

var randomBot = { loadout: function (owned) { return S.randomLoadout(owned, rng); } };
var matchedBot = { loadout: function (owned, eIdx, stage, fId) { return S.bestLoadout(owned, eIdx, stage, fId).parts; } };

console.log('# でこもん 版3 ボット結果');
console.log('');
var t0 = Date.now();
var stR = newStats();
for (var i = 0; i < RUNS; i++) playRun(randomBot, stR);
var hsR = reportBot('ランダムボット（場所の制約を守って 0〜3個ランダム）', stR);
var stM = newStats();
for (var j = 0; j < RUNS; j++) playRun(matchedBot, stM);
var hsM = reportBot('合わせボット（相手とフィールドに対して 全組み合わせを乱れゼロで試す）', stM);

// 合わせボットのパーツ使用率（戦いごとに付けていた割合）
console.log('### 合わせボットのパーツ使用率（その戦いで付けていた割合）');
console.log('');
console.log('| パーツ | ' + S.PART_IDS.map(function (p) { return S.PART_BY_ID[p].name; }).join(' | ') + ' |');
console.log('|' + new Array(S.PART_IDS.length + 2).join('---|'));
var useRates = S.PART_IDS.map(function (p) { return stM.use[p] / stM.battles; });
console.log('| 使用率 | ' + useRates.map(pct).join(' | ') + ' |');
console.log('');

// 噛み合いの発動率（合わせボットの周回のうち、1回以上発動した割合）
console.log('### 噛み合いの発動率（合わせボットの周回のうち、自分の側で1回以上発動した割合）');
console.log('');
console.log('| 噛み合い | ' + S.SYNERGIES.map(function (s) { return s.id + ' ' + s.name; }).join(' | ') + ' |');
console.log('|' + new Array(S.SYNERGIES.length + 2).join('---|'));
var synRates = S.SYNERGIES.map(function (s) { return stM.syn[s.id] / stM.runs; });
console.log('| 発動率 | ' + synRates.map(pct).join(' | ') + ' |');
console.log('| ランダム | ' + S.SYNERGIES.map(function (s) { return pct(stR.syn[s.id] / stR.runs); }).join(' | ') + ' |');
console.log('');

// ---------- 固定の周回：16パーツ全部を持ち、場所の制約を守る3つ固定（448通り） ----------
var triples = S.loadouts(S.PART_IDS).filter(function (c) { return c.length === 3; });
var fixedRows = [];
triples.forEach(function (combo) {
  var st = newStats();
  for (var r = 0; r < FIXED_RUNS; r++) playRun(null, st, combo);
  fixedRows.push({ combo: combo, clear: st.clears / st.runs, avg: st.sumWins / st.runs, hands: handsSummary(st.hands).mean });
});
fixedRows.sort(function (a, b) { return b.clear - a.clear || b.avg - a.avg; });
console.log('### 固定の周回（' + triples.length + ' 通り × 各 ' + FIXED_RUNS + ' 周回）');
console.log('');
console.log('| 順 | 組み合わせ | 5連勝率 | 平均連勝 | 手数 |');
console.log('|---|---|---|---|---|');
fixedRows.slice(0, 12).forEach(function (r, i) { console.log('| ' + (i + 1) + ' | ' + cname(r.combo) + ' | ' + pct(r.clear) + ' | ' + r.avg.toFixed(2) + ' | ' + f1(r.hands) + ' |'); });
console.log('| … | | | | |');
fixedRows.slice(-5).forEach(function (r, i) { console.log('| ' + (fixedRows.length - 4 + i) + ' | ' + cname(r.combo) + ' | ' + pct(r.clear) + ' | ' + r.avg.toFixed(2) + ' | ' + f1(r.hands) + ' |'); });
console.log('');
var fixedBest = fixedRows[0];
var fixedAvgClear = fixedRows.reduce(function (a, r) { return a + r.clear; }, 0) / fixedRows.length;
console.log('固定の最高 ' + pct(fixedBest.clear) + '（' + cname(fixedBest.combo) + '）、全448通りの平均 ' + pct(fixedAvgClear));
console.log('');

// ---------- 相手×段階の表：16パーツ全部から最良の3つを選んだときの勝率（フィールド平均、乱れあり） ----------
console.log('### 相手×段階（16パーツ全部から その相手・フィールドに最良の組み合わせを選び、乱れありで各 ' + TABLE_TRIALS + ' 回。フィールド4つの平均）');
console.log('');
console.log('| 相手 | 段1 | 段2 | 段3 | 段4 | 段5 | 段5で選ばれた組み合わせ（ふつう） |');
console.log('|---|---|---|---|---|---|---|');
var tableMin5 = 1, tableMinName = '';
S.ENEMIES.forEach(function (e) {
  var cells = [];
  var best5plain = null;
  for (var s = 1; s <= 5; s++) {
    var sum = 0;
    S.FIELDS.forEach(function (f) {
      var best = S.bestLoadout(S.PART_IDS, e.index, s, f.id);
      if (s === 5 && f.id === 'plain') best5plain = best;
      var w = 0;
      for (var t = 0; t < TABLE_TRIALS; t++) { if (S.runBattle(best.parts, e.index, s, f.id, { rng: rng }).winner === 'p') w++; }
      sum += w / TABLE_TRIALS;
    });
    var rate = sum / S.FIELDS.length;
    cells.push(rate);
    if (s === 5 && rate < tableMin5) { tableMin5 = rate; tableMinName = e.name; }
  }
  console.log('| ' + e.name + ' | ' + cells.map(function (x) { return pct(x) + (x < 0.7 ? ' ⚠' : ''); }).join(' | ') + ' | ' + cname(best5plain.parts) + ' |');
});
console.log('');

// ---------- 目標との比較 ----------
var ok = function (b) { return b ? '届いた' : '届かない'; };
var minUse = Math.min.apply(null, useRates), minUseName = S.PART_BY_ID[S.PART_IDS[useRates.indexOf(minUse)]].name;
var minSyn = Math.min.apply(null, synRates), minSynName = S.SYNERGIES[synRates.indexOf(minSyn)].name;
var handsOk = function (hs) { return hs.mean >= 8 && hs.mean <= 14 && hs.p50 >= 8 && hs.p50 <= 14 && hs.within >= 0.5; };
console.log('### 目標との比較');
console.log('');
console.log('| 目標 | 結果 | 判定 |');
console.log('|---|---|---|');
console.log('| 合わせボットの5連勝率 60〜80% | ' + pct(stM.clears / stM.runs) + ' | ' + ok(stM.clears / stM.runs >= 0.6 && stM.clears / stM.runs <= 0.8) + ' |');
console.log('| ランダムボットの5連勝率 10% 以下 | ' + pct(stR.clears / stR.runs) + ' | ' + ok(stR.clears / stR.runs <= 0.10) + ' |');
console.log('| 固定の最高が 合わせの半分以下 | 固定の最高 ' + pct(fixedBest.clear) + ' ／ 合わせの半分 ' + pct(stM.clears / stM.runs / 2) + ' | ' + ok(fixedBest.clear <= stM.clears / stM.runs / 2) + ' |');
console.log('| 相手×段階：どの相手も段階5で 70% 以上 | 最低 ' + pct(tableMin5) + '（' + tableMinName + '） | ' + ok(tableMin5 >= 0.7) + ' |');
console.log('| パーツ使用率が 16種すべて 8% 以上 | 最低 ' + pct(minUse) + '（' + minUseName + '） | ' + ok(minUse >= 0.08) + ' |');
console.log('| 8つの噛み合いが それぞれ 10% 以上の周回で発動 | 最低 ' + pct(minSyn) + '（' + minSynName + '） | ' + ok(minSyn >= 0.10) + ' |');
console.log('| 手数は 8〜14手が中心（平均と中央値が範囲内、半分以上が範囲内） | 合わせ：平均 ' + f1(hsM.mean) + '・中央 ' + hsM.p50 + '・範囲内 ' + pct(hsM.within) + ' ／ ランダム：平均 ' + f1(hsR.mean) + '・中央 ' + hsR.p50 + '・範囲内 ' + pct(hsR.within) + ' | ' + ok(handsOk(hsM) && handsOk(hsR)) + ' |');
console.log('');
console.log('（計算時間 ' + ((Date.now() - t0) / 1000).toFixed(1) + ' 秒）');
