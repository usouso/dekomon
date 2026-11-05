// たたみやま 版1 — 大きい場面の「答えの数」を 無作為に数える（全部は多すぎるので 抽出）
// 使い方: node tools/sample.js [--n 200000] [--variant c]
// 場面ごとに、順番・山の分け方・たたみ方を でたらめに n 回つくり、「かならず とどく（期待0）」と「期待 0.5以下」の割合を出す。
'use strict';
var T = require('../rules.js');
function arg(name, def) { var i = process.argv.indexOf('--' + name); if (i < 0) return def; var v = process.argv[i + 1]; return (v === undefined || v.indexOf('--') === 0) ? true : v; }
var N = parseInt(arg('n', '200000'), 10);
var V = arg('variant', null); if (V && V !== true) { if (!T.applyVariant(V)) { console.error('知らない切り替え'); process.exit(1); } }
var rng = T.makeRng(12345);
function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
var FO = {}; T.KINDS.forEach(function (k) { FO[k.id] = T.foldsOf(k.id).map(function (f) { return f.id; }); });
var cache = new Map();
function E(stack) { var key = stack.join(','); var v = cache.get(key); if (v === undefined) { v = T.carryExpect(stack).expected; cache.set(key, v); } return v; }
var scenes = [{ d: 0, k: 1 }, { d: 0, k: 2 }, { d: 1, k: 1 }, { d: 1, k: 2 }, { d: 2, k: 2 }, { d: 2, k: 3 }, { d: 2, k: 4 }];
console.log('# 無作為抽出（n ' + N + (T.variant() ? '、切り替え ' + T.variant().name : '') + '）\n');
console.log('| 場面 | 期待0（かならず とどく） | 期待 0.5以下 | 期待 1以下 | 期待の平均 |');
console.log('|---|---|---|---|---|');
scenes.forEach(function (sc) {
  var kinds = T.basketOf(sc.d), n = kinds.length, safe = 0, le5 = 0, le1 = 0, sum = 0;
  for (var t = 0; t < N; t++) {
    var ord = shuffle(kinds.slice());
    // k 個の 空でない山に 分ける：切れ目を k-1 個 選ぶ
    var cuts = []; while (cuts.length < sc.k - 1) { var c = 1 + Math.floor(rng() * (n - 1)); if (cuts.indexOf(c) < 0) cuts.push(c); } cuts.sort(function (a, b) { return a - b; });
    var e = 0, prev = 0; cuts.concat([n]).forEach(function (c) { var st = ord.slice(prev, c).map(function (kd) { var fs = FO[kd]; return fs[Math.floor(rng() * fs.length)]; }); e += E(st); prev = c; });
    sum += e; if (e === 0) safe++; if (e <= 0.5) le5++; if (e <= 1) le1++;
  }
  console.log('| ' + (sc.d + 1) + '日目 ' + sc.k + '山（' + n + 'まい） | ' + (safe / N * 100).toFixed(2) + '% | ' + (le5 / N * 100).toFixed(2) + '% | ' + (le1 / N * 100).toFixed(2) + '% | ' + (sum / N).toFixed(2) + ' |');
});
