// でこもん 作り直しの版 — 負けの 理由が 当たって いるかの ボット（決定 28-2「当たらない 理由は 出さない」）
// 使い方：node tools/riyuu.js [周回の数=30] [1つの 場面を ためす 回数=24]
// やりかた：
//   1. 合わせボット・でたらめボットで 周回を 回し、負けた 場面（その時の 周回・道・つけた パーツ）を あつめる。
//   2. 場面ごとに、同じ 種（seed の ならび）で 何回も 戦わせて 勝率を くらべる：
//      もと＝負けた ときの パーツ／なおし＝理由が すすめる 向きに 1つの 枠だけ かえた いちばん 良い 組／
//      くらべ＝理由と 関係ない パーツに 1つの 枠だけ かえた ときの 平均（「なんでも 1つ かえれば 勝てる」との 差を 見る）。
//   3. なおしが もとより 15 ポイント 以上 勝ちやすく、くらべの 平均より 10 ポイント 以上 上なら「当たり」。
//   どの パーツを 持って いるかは 見ない（理由は「さがそう」と 向きを 言う だけ なので、16種 全部から）。
'use strict';
var path = require('path');
var S = require(path.join(__dirname, '..', 'sim.js'));
var N = parseInt(process.argv[2] || '30', 10);
var K = parseInt(process.argv[3] || '24', 10);
var t0 = Date.now();

function clone(o) { return JSON.parse(JSON.stringify(o)); }
function partsOfRole(role) { return S.PARTS.filter(function (p) { return p.role === role; }).map(function (p) { return p.id; }); }
function hasKw(pid, kws) { var p = S.PART_BY_ID[pid]; return p.kw.some(function (k) { return kws.indexOf(k) >= 0; }); }

// 理由ごとの「なおす 向き」は sim.js の REASONS[].fix を そのまま 使う（hope の 文と そろえて ある）。
// ここでは sim.js と ちがう 種で 戦わせるので、sim.js の 中の 確かめとは 別の 目に なる。
function remedyOf(reason) {
  if (reason.id === 'power' || reason.id === 'close') return reason.id;
  var R = S.REASONS.filter(function (x) { return x.id === reason.id; })[0];
  if (!R || !R.fix) return null;
  // fix(c) は c.res.taken を 見る：理由の src から 同じ 向きを 作る
  var fake = { res: { taken: { hit: 0, charge: 0, poison: 0, counter: 0 } } }; if (reason.src) fake.res.taken[reason.src] = 1;
  return R.fix(fake);
}

function rate(run, road, stage, equip) {
  var w = 0, pSrc = S.playerSrc(run, equip), eSrc = S.enemySrc(road.idx, stage, road.hard), waza = S.SPECIES_BY_ID[run.species].waza;
  for (var i = 0; i < K; i++) if (S.battle(pSrc, eSrc, S.mix(90210 + i, stage * 13 + (road.hard ? 1 : 0)), { waza: waza }).win) w++;
  return w / K;
}
function swap(eq, role, p) { var e = clone(eq); e[role] = p; return e; }

function judge(sit) {
  var run = sit.run, road = run.fork.roads[sit.ri], stage = run.fork.stage, eq = sit.equip;
  var base = rate(run, road, stage, eq);
  var rem = remedyOf(sit.reason);
  if (!rem) return null;
  var fixBest = 0, ctrl = [], remSet = {};
  if (rem === 'close') return { base: base, fix: base, ctrl: base, hit: base >= S.CFG.closeRate - 0.1 };
  if (rem === 'power') {
    // 「もう片方の 道や、ほかの パーツ」：持って いる パーツの いちばん 良い 組・もう片方の 道
    var b = S.bestEquip(run, sit.ri, K); fixBest = b.rate;
    if (run.fork.roads.length > 1) { var b2 = S.bestEquip(run, 1 - sit.ri, K); fixBest = Math.max(fixBest, b2.rate); }
    return { base: base, fix: fixBest, ctrl: base, hit: fixBest - base >= 0.15 };
  }
  rem.forEach(function (r) { partsOfRole(r.role).forEach(function (p) { if (r.ok(p) && p !== eq[r.role]) { remSet[r.role + ':' + p] = true; fixBest = Math.max(fixBest, rate(run, road, stage, swap(eq, r.role, p))); } }); });
  ['atk', 'def', 'mov'].forEach(function (role) { partsOfRole(role).forEach(function (p) { if (p !== eq[role] && !remSet[role + ':' + p]) ctrl.push(rate(run, road, stage, swap(eq, role, p))); }); });
  var c = ctrl.length ? ctrl.reduce(function (a, b) { return a + b; }, 0) / ctrl.length : base;
  return { base: base, fix: fixBest, ctrl: c, hit: fixBest - base >= 0.15 && fixBest - c >= 0.10 };
}

// 負けた 場面を あつめる（bot.js と 同じ 2つの ボット）
function collect(seed, species, policy, out) {
  var run = S.newRun(seed, species), rng = S.rngFrom(S.mix(seed, 31337)), guard = 0;
  while (!run.over && guard++ < 60) {
    var roads = run.fork.roads, ri = 0, eq = run.equip;
    if (policy === 'greedy') {
      var best = -1;
      roads.forEach(function (r, i) { var b = S.bestEquip(run, i, 4); var score = b.rate + (r.hard ? 0.15 : 0); if (score > best) { best = score; ri = i; eq = b.equip; } });
    } else {
      ri = Math.floor(rng() * roads.length);
      eq = {}; S.ROLES.forEach(function (r) { var c = run.owned.filter(function (p) { return S.PART_BY_ID[p].role === r.id; }); eq[r.id] = c.length ? c[Math.floor(rng() * c.length)] : null; });
    }
    var snap = clone(run);
    var o = S.fight(run, ri, eq);
    if (!o.win) out.push({ run: snap, ri: ri, equip: { atk: eq.atk || null, def: eq.def || null, mov: eq.mov || null }, reason: o.reason, policy: policy, species: species, seed: seed });
  }
}

var sits = [];
['greedy', 'random'].forEach(function (pol) { S.SPECIES.forEach(function (sp) { for (var i = 0; i < N; i++) collect(3000 + i, sp.id, pol, sits); }); });
var by = {};
sits.forEach(function (s) {
  var key = s.reason.id + (s.reason.src ? '/' + s.reason.src : '');
  var j = judge(s); if (!j) return;
  var b = by[key] = by[key] || { n: 0, hit: 0, base: 0, fix: 0, ctrl: 0, ex: null, text: s.reason.text.replace(/^[^に]+に /, '…に ') };
  b.n++; b.hit += j.hit ? 1 : 0; b.base += j.base; b.fix += j.fix; b.ctrl += j.ctrl;
  if (!j.hit && !b.ex) b.ex = 'seed ' + s.seed + ' ' + s.species + ' ' + s.policy + ' ' + s.run.fork.stage + '戦目';
});
console.log('## 負けの 理由の 当たり（' + N + ' 周回 × 種類 4 × ボット 2、1場面 ' + K + ' 回）\n');
console.log('| 理由 | 出た 数 | 当たり | もとの 勝率 | なおしの 勝率 | くらべ（関係ない 1つ）| 外れの 例 |');
console.log('|---|---|---|---|---|---|---|');
Object.keys(by).sort(function (a, b) { return by[b].n - by[a].n; }).forEach(function (k) {
  var b = by[k];
  console.log('| ' + k + ' | ' + b.n + ' | ' + (100 * b.hit / b.n).toFixed(0) + '% | ' + (100 * b.base / b.n).toFixed(0) + '% | ' + (100 * b.fix / b.n).toFixed(0) + '% | ' + (100 * b.ctrl / b.n).toFixed(0) + '% | ' + (b.ex || '') + ' |');
});
console.log('\n（' + ((Date.now() - t0) / 1000).toFixed(1) + '秒）');
