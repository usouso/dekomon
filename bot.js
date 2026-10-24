// でこもん 版1 — ボット検証（Node で実行: node bot.js [周回数]）
// sim.js だけを使い、画面なしで回す。
'use strict';
var S = require('./sim.js');
var RUNS = parseInt(process.argv[2] || '2000', 10);
var FIXED_TRIALS = parseInt(process.argv[3] || '20', 10);
var rng = S.makeRng(12345);

function pct(x) { return (x * 100).toFixed(1) + '%'; }
function f1(x) { return x.toFixed(1); }

// ---------- 周回を遊ぶ ----------
// chooser: { loadout(owned, enemyIdx, stage, fieldId) -> parts, draft(owned, offered, stage) -> part }
function playRun(chooser, stats) {
  var run = S.newRun(rng);
  var owned = run.owned.slice();
  var wins = 0;
  for (var b = 0; b < 5; b++) {
    var stage = b + 1, eIdx = run.enemies[b], fId = run.fields[b];
    var parts = chooser.loadout(owned, eIdx, stage, fId);
    var res = S.runBattle(parts, eIdx, stage, fId, { rng: rng });
    stats.battles++;
    stats.hands.push(res.nHands);
    if (res.timeout) stats.timeouts++;
    stats.stage[b].n++;
    var won = res.winner === 'p';
    if (won) { stats.stage[b].w++; wins++; } else break;
    if (b < 4) {
      var offer = S.draftOffer(owned, rng);
      if (offer.length) owned.push(chooser.draft(owned, offer, stage + 1));
    }
  }
  stats.runs++;
  stats.winsHist[wins]++;
  if (wins === 5) stats.clears++;
  stats.sumWins += wins;
}
function newStats() {
  return { runs: 0, clears: 0, sumWins: 0, winsHist: [0, 0, 0, 0, 0, 0], battles: 0, timeouts: 0, hands: [],
    stage: [0, 1, 2, 3, 4].map(function () { return { n: 0, w: 0 }; }) };
}
function handsSummary(h) {
  var sorted = h.slice().sort(function (a, b) { return a - b; });
  var n = sorted.length;
  var mean = sorted.reduce(function (a, b) { return a + b; }, 0) / n;
  var within = sorted.filter(function (x) { return x >= 8 && x <= 14; }).length / n;
  var under = sorted.filter(function (x) { return x < 8; }).length / n;
  return { mean: mean, p10: sorted[Math.floor(n * 0.1)], p50: sorted[Math.floor(n * 0.5)], p90: sorted[Math.floor(n * 0.9)], within: within, under: under, max: sorted[n - 1] };
}
function reportBot(name, st) {
  var hs = handsSummary(st.hands);
  console.log('### ' + name + '（周回 ' + st.runs + ' 回）');
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
  console.log('');
  return hs;
}

// ---------- ランダムボット ----------
var randomBot = {
  loadout: function (owned) { return S.randomLoadout(owned, rng); },
  draft: function (owned, offered) { return S.randomDraft(offered, rng); }
};
// ---------- 合わせボット ----------
var matchedBot = {
  loadout: function (owned, eIdx, stage, fId) { return S.bestLoadout(owned, eIdx, stage, fId).parts; },
  draft: function (owned, offered, stage) { return S.matchedDraft(owned, offered, stage); }
};

console.log('# でこもん 版1 ボット結果');
console.log('');
var t0 = Date.now();
var stR = newStats();
for (var i = 0; i < RUNS; i++) playRun(randomBot, stR);
var hsR = reportBot('ランダムボット', stR);
var stM = newStats();
for (var j = 0; j < RUNS; j++) playRun(matchedBot, stM);
var hsM = reportBot('合わせボット', stM);

// 合わせボットが何個つけたか
(function () {
  var cnt = [0, 0, 0, 0], use = {}; S.PART_IDS.forEach(function (p) { use[p] = 0; });
  var n = 0;
  for (var r = 0; r < 300; r++) {
    var run = S.newRun(rng); var owned = run.owned.slice();
    for (var b = 0; b < 5; b++) {
      var parts = S.bestLoadout(owned, run.enemies[b], b + 1, run.fields[b]).parts;
      cnt[parts.length]++; parts.forEach(function (p) { use[p]++; }); n++;
      if (b < 4) { var of = S.draftOffer(owned, rng); if (of.length) owned.push(S.matchedDraft(owned, of, b + 2)); }
    }
  }
  console.log('合わせボットがつけた個数：0個 ' + pct(cnt[0] / n) + '、1個 ' + pct(cnt[1] / n) + '、2個 ' + pct(cnt[2] / n) + '、3個 ' + pct(cnt[3] / n));
  console.log('合わせボットのパーツ使用率：' + S.PART_IDS.map(function (p) { return S.PART_BY_ID[p].name + ' ' + pct(use[p] / n); }).join('、'));
  console.log('');
})();

// ---------- 固定ボット：3つの組み合わせ 56通り × 全相手 × 全フィールド × 段階1〜5 ----------
var combos = S.subsets(S.PART_IDS, 3).filter(function (c) { return c.length === 3; });
var rows = [];
combos.forEach(function (combo) {
  var byE = S.ENEMIES.map(function () { return { w: 0, n: 0 }; });
  var byF = S.FIELDS.map(function () { return { w: 0, n: 0 }; });
  var byS = [0, 1, 2, 3, 4].map(function () { return { w: 0, n: 0 }; });
  var w = 0, n = 0, hands = 0;
  S.ENEMIES.forEach(function (e) {
    S.FIELDS.forEach(function (f) {
      for (var s = 1; s <= 5; s++) {
        for (var t = 0; t < FIXED_TRIALS; t++) {
          var res = S.runBattle(combo, e.index, s, f.id, { rng: rng });
          var won = res.winner === 'p' ? 1 : 0;
          w += won; n++; hands += res.nHands;
          byE[e.index].w += won; byE[e.index].n++;
          byF[f.index].w += won; byF[f.index].n++;
          byS[s - 1].w += won; byS[s - 1].n++;
        }
      }
    });
  });
  rows.push({ combo: combo, rate: w / n, byE: byE, byF: byF, byS: byS, hands: hands / n });
});
rows.sort(function (a, b) { return b.rate - a.rate; });
function cname(c) { return c.map(function (p) { return S.PART_BY_ID[p].name; }).join('＋'); }
console.log('### 固定ボット（8パーツ全部から3つ、56通り。各 相手8×フィールド4×段階5×' + FIXED_TRIALS + '回）');
console.log('');
console.log('| 順 | 組み合わせ | 平均勝率 | ' + S.ENEMIES.map(function (e) { return e.name; }).join(' | ') + ' | ' + S.FIELDS.map(function (f) { return f.name; }).join(' | ') + ' | 段1 | 段3 | 段5 | 手数 |');
console.log('|' + new Array(4 + S.ENEMIES.length + S.FIELDS.length + 4 + 1).join('---|'));
rows.forEach(function (r, i) {
  console.log('| ' + (i + 1) + ' | ' + cname(r.combo) + ' | ' + pct(r.rate) + (r.rate > 0.65 ? ' ⚠' : '') + ' | ' +
    r.byE.map(function (x) { return pct(x.w / x.n); }).join(' | ') + ' | ' +
    r.byF.map(function (x) { return pct(x.w / x.n); }).join(' | ') + ' | ' +
    pct(r.byS[0].w / r.byS[0].n) + ' | ' + pct(r.byS[2].w / r.byS[2].n) + ' | ' + pct(r.byS[4].w / r.byS[4].n) + ' | ' + f1(r.hands) + ' |');
});
console.log('');
var over = rows.filter(function (r) { return r.rate > 0.65; });
console.log('平均勝率 65% 超えの組み合わせ：' + (over.length ? over.map(function (r) { return cname(r.combo) + '（' + pct(r.rate) + '）'; }).join('、') : 'なし'));
console.log('最高 ' + pct(rows[0].rate) + '（' + cname(rows[0].combo) + '）、最低 ' + pct(rows[rows.length - 1].rate) + '（' + cname(rows[rows.length - 1].combo) + '）、全組み合わせの平均 ' + pct(rows.reduce(function (a, r) { return a + r.rate; }, 0) / rows.length));
console.log('');

// パーツごとの「相手別の得意・苦手」が本当に出ているか：そのパーツを含む組み合わせの平均勝率（相手別・フィールド別）
console.log('### パーツ別（そのパーツを含む固定の組み合わせの平均勝率）');
console.log('');
console.log('| パーツ | 平均 | ' + S.ENEMIES.map(function (e) { return e.name; }).join(' | ') + ' | ' + S.FIELDS.map(function (f) { return f.name; }).join(' | ') + ' |');
console.log('|' + new Array(3 + S.ENEMIES.length + S.FIELDS.length).join('---|'));
S.PART_IDS.forEach(function (p) {
  var rs = rows.filter(function (r) { return r.combo.indexOf(p) >= 0; });
  var avg = function (get) { var w = 0, n = 0; rs.forEach(function (r) { var x = get(r); w += x.w; n += x.n; }); return pct(w / n); };
  console.log('| ' + S.PART_BY_ID[p].name + ' | ' + pct(rs.reduce(function (a, r) { return a + r.rate; }, 0) / rs.length) + ' | ' +
    S.ENEMIES.map(function (e) { return avg(function (r) { return r.byE[e.index]; }); }).join(' | ') + ' | ' +
    S.FIELDS.map(function (f) { return avg(function (r) { return r.byF[f.index]; }); }).join(' | ') + ' |');
});
console.log('');

// 目標チェック
console.log('### 目標との比較');
console.log('');
console.log('| 目標 | 結果 | 判定 |');
console.log('|---|---|---|');
var ok = function (b) { return b ? '届いた' : '届かない'; };
console.log('| ランダムの5連勝率 5% 以下 | ' + pct(stR.clears / stR.runs) + ' | ' + ok(stR.clears / stR.runs <= 0.05) + ' |');
console.log('| 合わせの5連勝率 40〜60% | ' + pct(stM.clears / stM.runs) + ' | ' + ok(stM.clears / stM.runs >= 0.4 && stM.clears / stM.runs <= 0.6) + ' |');
console.log('| 固定のどの組み合わせも平均勝率 65% 以下 | 最高 ' + pct(rows[0].rate) + ' | ' + ok(rows[0].rate <= 0.65) + ' |');
console.log('| 1戦の手数が だいたい 8〜14手 | 合わせ：平均 ' + f1(hsM.mean) + '手、8〜14手 ' + pct(hsM.within) + ' ／ ランダム：平均 ' + f1(hsR.mean) + '手、8〜14手 ' + pct(hsR.within) + ' | ' + ok(hsM.within >= 0.6 && hsR.within >= 0.6) + ' |');
console.log('');
console.log('（計算時間 ' + ((Date.now() - t0) / 1000).toFixed(1) + ' 秒）');
