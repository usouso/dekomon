// たたみやま 版1 — 全部の並べ方を数える（小さい場面だけ。探索の答え合わせと「答えの数」を見るため）
// 使い方: node tools/exact.js
// 1日目 1山・1日目 2山（山の順は区別する）・2日目 1山 を、順番×たたみ方 の全部で回し、
//   落ちる枚数の期待が 0（かならず とどく）の並べ方の数、最良の期待、ぐらの合計の分布 を出す。
'use strict';
var T = require('../rules.js');
function foldsOf(kind) { return T.foldsOf(kind).map(function (f) { return f.id; }); }
// 同じ種類を区別しない 並べ方を 全部
function eachOrdering(counts, cb) {
  var kinds = Object.keys(counts), n = 0; kinds.forEach(function (k) { n += counts[k]; });
  var cur = [];
  (function rec() {
    if (cur.length === n) { cb(cur); return; }
    for (var i = 0; i < kinds.length; i++) { var k = kinds[i]; if (!counts[k]) continue; counts[k]--; cur.push(k); rec(); cur.pop(); counts[k]++; }
  })();
}
function eachFolds(kinds, cb) {
  var cur = [];
  (function rec(i) {
    if (i === kinds.length) { cb(cur); return; }
    var fs = foldsOf(kinds[i]);
    for (var j = 0; j < fs.length; j++) { cur.push(fs[j]); rec(i + 1); cur.pop(); }
  })(0);
}
var cache = new Map();
function ev(stack) { var key = stack.join(','); var v = cache.get(key); if (v) return v; var e = T.carryExpect(stack), c = T.stackCalc(stack); v = { E: e.expected, total: c.total }; cache.set(key, v); return v; }
function tally(name, run) {
  var t0 = Date.now(), all = 0, safe = 0, bestE = Infinity, bestTotal = Infinity, byTotal = {}, examples = [];
  run(function (stacks) {
    var E = 0, total = 0; stacks.forEach(function (s) { var v = ev(s); E += v.E; total += v.total; });
    all++;
    if (E === 0) { safe++; if (examples.length < 3 && total <= 2) examples.push(stacks.map(function (s) { return s.join('>'); }).join(' | ')); }
    if (E < bestE - 1e-12) bestE = E;
    if (total < bestTotal) bestTotal = total;
    byTotal[total] = (byTotal[total] || 0) + 1;
  });
  var le4 = 0; Object.keys(byTotal).forEach(function (t) { if (parseInt(t, 10) <= 4) le4 += byTotal[t]; });
  console.log('| ' + name + ' | ' + all + ' | ' + safe + '（' + (safe / all * 100).toFixed(1) + '%） | ' + le4 + ' | ' + bestE.toFixed(2) + ' | ' + bestTotal + ' | ' + Math.round((Date.now() - t0) / 1000) + '秒 |');
  if (examples.length) console.error('  例（期待0・ぐら2以下）：' + examples.join('　／　'));
}
console.log('| 場面 | 並べ方の数（順番×たたみ方） | 期待0の数（かならず とどく） | ぐら合計4以下の数 | 最良の期待 | 最小のぐら合計 | 時間 |');
console.log('|---|---|---|---|---|---|---|');
var d1 = T.DAYS[0].basket, d2 = T.DAYS[1].basket;
tally('1日目 1山（6まい）', function (cb) { eachOrdering(Object.assign({}, d1), function (ord) { eachFolds(ord, function (folds) { cb([folds.slice()]); }); }); });
tally('1日目 2山（6まい。山の順は区別・空の山なし）', function (cb) { eachOrdering(Object.assign({}, d1), function (ord) { eachFolds(ord, function (folds) { for (var s = 1; s < folds.length; s++) cb([folds.slice(0, s), folds.slice(s)]); }); }); });
tally('2日目 1山（9まい）', function (cb) { eachOrdering(Object.assign({}, d2), function (ord) { eachFolds(ord, function (folds) { cb([folds.slice()]); }); }); });
