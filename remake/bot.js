// でこもん 作り直しの版 — ボット（周回を たくさん 回して 目標と 比べる）
// 使い方：node bot.js [周回の数=40] [種類=all]
//   合わせボット（greedy）：道ごとに もちものの 組を ためして（ヒントと 同じ 計算）、てごわいの 見こみ（12戦）が ふつうより HARD_GAP しか 下がらなければ てごわい（もらえる もの 2つ）
//   ふつうボット（futsu）／てごわいボット（katai）：同じ もちもの 選びで、いつも ふつう／いつも てごわい の 道（くらべる 物差し）
//   原則 5 の「合わせ」は greedy。「てごわいを 選んだ」は 分かれ道ごと（負けて やり直した 戦いは 数えない）。random・start は 道を 選んで いないので「—」
//   でたらめボット：道も パーツも でたらめ（子どもが 何も 考えずに 遊んだ とき）
//   はじめボット（start）：はじめの 3つの まま・いつも 左の 道＝何も 考えない 物差し（原則 5：合わせの 75% 以下）
'use strict';
var S = require('./sim.js');
var N = parseInt(process.argv[2] || '40', 10);
var ONLY = process.argv[3] || 'all';
var t0 = Date.now();
var HARD_GAP = 0.1; // 前は 4戦の 見こみ（0・0.25…1 の 5つの 値）＋0.15。どちらも 4/4 の 同点が ほとんどで てごわいに なって いた（10-29 9時の回）
if (process.env.DEKO_CFG) { var o = JSON.parse(process.env.DEKO_CFG); Object.keys(o).forEach(function (k) { S.CFG[k] = o[k]; }); }

function playRun(seed, species, policy) {
  var run = S.newRun(seed, species), rng = S.rngFrom(S.mix(seed, 31337)), log = { losses: 0, reasons: {}, minHearts: 3, hardPick: 0, forks: 0 };
  var guard = 0;
  while (!run.over && guard++ < 60) {
    var roads = run.fork.roads, ri = 0, eq = run.equip; // start：はじめの 3つの まま・いつも 左の 道（何も 考えない＝正解の道の 物差し）
    if (policy === 'greedy' || policy === 'futsu' || policy === 'katai') {
      var hi = -1, ni = 0; roads.forEach(function (r, i) { if (r.hard) hi = i; else ni = i; });
      ri = ni;
      if (hi >= 0) {
        if (policy === 'katai') ri = hi;
        else if (policy === 'greedy') { var bh = S.bestEquip(run, hi, 12), bn = S.bestEquip(run, ni, 12); if (bh.rate >= bn.rate - HARD_GAP) ri = hi; }
      }
      eq = S.bestEquip(run, ri, 4).equip;
    } else if (policy === 'random') {
      ri = Math.floor(rng() * roads.length);
      eq = {}; S.ROLES.forEach(function (r) { var c = run.owned.filter(function (p) { return S.PART_BY_ID[p].role === r.id; }); eq[r.id] = c.length ? c[Math.floor(rng() * c.length)] : null; });
    } else if (policy.indexOf('fixed:') === 0) {
      var want = policy.slice(6).split(','); ri = Math.floor(rng() * roads.length);
      eq = {}; want.forEach(function (p) { if (run.owned.indexOf(p) >= 0) eq[S.PART_BY_ID[p].role] = p; });
      S.ROLES.forEach(function (r) { if (!eq[r.id]) { var c = run.owned.filter(function (p) { return S.PART_BY_ID[p].role === r.id; }); eq[r.id] = c[0] || null; } });
    }
    if (roads.length > 1 && run.tries === 0) { log.forks++; if (roads[ri].hard) log.hardPick++; }
    var out = S.fight(run, ri, eq);
    if (!out.win) { log.losses++; log.reasons[out.reason.id] = (log.reasons[out.reason.id] || 0) + 1; }
  }
  return { hardPick: log.hardPick, forks: log.forks, wins: run.wins, clear: run.clear, hearts: run.hearts, losses: log.losses, reasons: log.reasons, history: run.history };
}

var species = ONLY === 'all' ? S.SPECIES.map(function (s) { return s.id; }) : [ONLY];
var rows = [], byEnemy = {}, byStage = {};
['greedy', 'futsu', 'katai', 'random', 'start'].forEach(function (pol) {
  species.forEach(function (sp) {
    var clear = 0, wins = 0, losses = 0, reasons = {}, battles = 0, hp = 0, fk = 0;
    for (var i = 0; i < N; i++) {
      var r = playRun(1000 + i, sp, pol);
      if (r.clear) clear++; wins += r.wins; losses += r.losses; hp += r.hardPick; fk += r.forks;
      Object.keys(r.reasons).forEach(function (k) { reasons[k] = (reasons[k] || 0) + r.reasons[k]; });
      battles += r.history.length;
      if (pol === 'greedy') r.history.forEach(function (h) {
        var k = h.e + (h.hard ? '(てごわい)' : ''); byEnemy[k] = byEnemy[k] || [0, 0]; byEnemy[k][0] += h.win ? 1 : 0; byEnemy[k][1]++;
        byStage[h.s] = byStage[h.s] || [0, 0]; byStage[h.s][0] += h.win ? 1 : 0; byStage[h.s][1]++;
      });
    }
    rows.push('| ' + pol + ' | ' + sp + ' | ' + (100 * clear / N).toFixed(0) + '% | ' + (wins / N).toFixed(1) + ' | ' + (losses / N).toFixed(2) + ' | ' + (battles / N).toFixed(1) + ' | ' + (pol === 'random' || pol === 'start' ? '—' : (fk ? (100 * hp / fk).toFixed(0) : 0) + '%') + ' | ' + JSON.stringify(reasons) + ' |');
  });
});
console.log('## ボット（' + N + ' 周回ずつ）\n');
console.log('| ボット | 種類 | クリア | 平均の 勝ち数 | 負け（ハート） | 戦った 数 | てごわいを 選んだ | 負けの 理由 |');
console.log('|---|---|---|---|---|---|---|---|');
rows.forEach(function (r) { console.log(r); });
console.log('\n## 合わせボット（greedy）の 相手ごとの 勝率（greedy が 選んだ 道だけ）');
Object.keys(byEnemy).sort().forEach(function (k) { console.log('- ' + k + '：' + (100 * byEnemy[k][0] / byEnemy[k][1]).toFixed(0) + '%（' + byEnemy[k][1] + '戦）'); });
console.log('\n## 合わせボット（greedy）の 段階ごとの 勝率');
Object.keys(byStage).sort(function (a, b) { return a - b; }).forEach(function (k) { console.log('- ' + k + '戦目：' + (100 * byStage[k][0] / byStage[k][1]).toFixed(0) + '%（' + byStage[k][1] + '戦）'); });
console.log('\n（' + ((Date.now() - t0) / 1000).toFixed(1) + '秒）');
