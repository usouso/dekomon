// でこもん 作り直しの版 — ボット（周回を たくさん 回して 目標と 比べる）
// 使い方：node bot.js [周回の数=40] [種類=all] [たまご=none|chain|<技の id>]
//   たまご chain：同じ 種類で 前の 周回の 覚えた 技（いちばん 先に 覚えた もの）を 次の 周回へ 継ぐ。<技の id>：いつも その 技を 継いで 始まる
//   合わせボット：道ごとに もちものの 組を ためして 勝ちやすい 方へ（ヒントと 同じ 計算）
//   でたらめボット：道も パーツも でたらめ（子どもが 何も 考えずに 遊んだ とき）
//   はじめボット（start）：はじめの 3つの まま・いつも 左の 道＝何も 考えない 物差し（原則 5：合わせの 75% 以下）
'use strict';
var S = require('./sim.js');
var N = parseInt(process.argv[2] || '40', 10);
var ONLY = process.argv[3] || 'all';
var EGG = process.argv[4] || 'none';
var t0 = Date.now();
if (process.env.DEKO_CFG) { var o = JSON.parse(process.env.DEKO_CFG); Object.keys(o).forEach(function (k) { S.CFG[k] = o[k]; }); }

var lastEgg = {};
function playRun(seed, species, policy) {
  var egg = EGG === 'chain' ? lastEgg[policy + species] : (EGG !== 'none' ? { waza: EGG, parent: 'bot', sp: species } : null);
  var run = S.newRun(seed, species, egg), rng = S.rngFrom(S.mix(seed, 31337)), log = { losses: 0, reasons: {}, minHearts: 3, hira: 0 };
  var guard = 0;
  while (!run.over && guard++ < 60) {
    var roads = run.fork.roads, ri = 0, eq = run.equip; // start：はじめの 3つの まま・いつも 左の 道（何も 考えない＝正解の道の 物差し）
    if (policy === 'greedy') {
      var best = -1;
      roads.forEach(function (r, i) { var b = S.bestEquip(run, i, 4); var score = b.rate + (r.hard ? 0.15 : 0); if (score > best) { best = score; ri = i; eq = b.equip; } });
    } else if (policy === 'random') {
      ri = Math.floor(rng() * roads.length);
      eq = {}; S.ROLES.forEach(function (r) { var c = run.owned.filter(function (p) { return S.PART_BY_ID[p].role === r.id; }); eq[r.id] = c.length ? c[Math.floor(rng() * c.length)] : null; });
    } else if (policy.indexOf('fixed:') === 0) {
      var want = policy.slice(6).split(','); ri = Math.floor(rng() * roads.length);
      eq = {}; want.forEach(function (p) { if (run.owned.indexOf(p) >= 0) eq[S.PART_BY_ID[p].role] = p; });
      S.ROLES.forEach(function (r) { if (!eq[r.id]) { var c = run.owned.filter(function (p) { return S.PART_BY_ID[p].role === r.id; }); eq[r.id] = c[0] || null; } });
    }
    var out = S.fight(run, ri, eq);
    if (out.hira) log.hira++;
    if (!out.win) { log.losses++; log.reasons[out.reason.id] = (log.reasons[out.reason.id] || 0) + 1; }
  }
  var ch = S.eggChoices(run); lastEgg[policy + species] = ch.length ? S.makeEgg(run, ch[0]) : null;
  return { hira: log.hira, learned: run.learned.length, wins: run.wins, clear: run.clear, hearts: run.hearts, losses: log.losses, reasons: log.reasons, history: run.history };
}

var species = ONLY === 'all' ? S.SPECIES.map(function (s) { return s.id; }) : [ONLY];
var rows = [], byEnemy = {}, byStage = {};
['greedy', 'random', 'start'].forEach(function (pol) {
  species.forEach(function (sp) {
    var clear = 0, wins = 0, losses = 0, reasons = {}, battles = 0, hira = 0;
    for (var i = 0; i < N; i++) {
      var r = playRun(1000 + i, sp, pol);
      if (r.clear) clear++; hira += r.hira; wins += r.wins; losses += r.losses;
      Object.keys(r.reasons).forEach(function (k) { reasons[k] = (reasons[k] || 0) + r.reasons[k]; });
      battles += r.history.length;
      if (pol === 'greedy') r.history.forEach(function (h) {
        var k = h.e + (h.hard ? '(てごわい)' : ''); byEnemy[k] = byEnemy[k] || [0, 0]; byEnemy[k][0] += h.win ? 1 : 0; byEnemy[k][1]++;
        byStage[h.s] = byStage[h.s] || [0, 0]; byStage[h.s][0] += h.win ? 1 : 0; byStage[h.s][1]++;
      });
    }
    rows.push('| ' + pol + ' | ' + sp + ' | ' + (100 * clear / N).toFixed(0) + '% | ' + (wins / N).toFixed(1) + ' | ' + (losses / N).toFixed(2) + ' | ' + (battles / N).toFixed(1) + ' | ' + (hira / N).toFixed(1) + ' | ' + JSON.stringify(reasons) + ' |');
  });
});
console.log('## ボット（' + N + ' 周回ずつ・たまご ' + EGG + '）\n');
console.log('| ボット | 種類 | クリア | 平均の 勝ち数 | 負け（ハート） | 戦った 数 | ひらめき | 負けの 理由 |');
console.log('|---|---|---|---|---|---|---|---|');
rows.forEach(function (r) { console.log(r); });
console.log('\n## 合わせボットの 相手ごとの 勝率');
Object.keys(byEnemy).sort().forEach(function (k) { console.log('- ' + k + '：' + (100 * byEnemy[k][0] / byEnemy[k][1]).toFixed(0) + '%（' + byEnemy[k][1] + '戦）'); });
console.log('\n## 合わせボットの 段階ごとの 勝率');
Object.keys(byStage).sort(function (a, b) { return a - b; }).forEach(function (k) { console.log('- ' + k + '戦目：' + (100 * byStage[k][0] / byStage[k][1]).toFixed(0) + '%（' + byStage[k][1] + '戦）'); });
console.log('\n（' + ((Date.now() - t0) / 1000).toFixed(1) + '秒）');
