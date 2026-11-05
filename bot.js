// たたみやま 版1 — ボット：node bot.js [--runs 1000] [--seed 1] [--quick]
// 指示書 6. のとおり。でたらめ・ふつう・コツ2つ・かしこい を 各 runs 回、3日の中身で回して せいこう率を出す。
// さらに 日ごとの表（山の数ごとの 最良の「落ちる枚数の期待」）と、にせの選択の検査を出す。
'use strict';
var T = require('./rules.js');
function arg(name, def) { var i = process.argv.indexOf('--' + name); if (i < 0) return def; var v = process.argv[i + 1]; return (v === undefined || v.indexOf('--') === 0) ? true : v; }
var RUNS = parseInt(arg('runs', '1000'), 10);
var SEED = parseInt(arg('seed', '1'), 10);
var QUICK = arg('quick', false) === true;
var VARIANT = arg('variant', null); if (VARIANT && VARIANT !== true) { if (!T.applyVariant(VARIANT)) { console.error('知らない切り替え: ' + VARIANT); process.exit(1); } }

var FOLDS_OF = {}; T.KINDS.forEach(function (k) { FOLDS_OF[k.id] = T.foldsOf(k.id).map(function (f) { return f.id; }); });
var PLAIN = { tshirt: ['tshirt_square'], socks: ['socks_line'], towel: ['towel_quad'], jeans: ['jeans_half'], slick: ['slick_fold'], sheet: ['sheet_fold'] };

function shuffle(a, rng) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
function pick(a, rng) { return a[Math.floor(rng() * a.length)]; }
function deal(kinds, k, rng) { var s = []; for (var i = 0; i < k; i++) s.push([]); shuffle(kinds.slice(), rng).forEach(function (x, i) { s[i % k].push(x); }); return s; }

// ---------- 山の評価（キャッシュつき） ----------
var evalCache = new Map();
function evalStack(stack) {
  var key = stack.join(',');
  var v = evalCache.get(key);
  if (v) return v;
  var e = T.carryExpect(stack), c = T.stackCalc(stack);
  v = { E: e.expected, total: c.total, pSafe: e.pSafe };
  evalCache.set(key, v);
  return v;
}
function evalStacks(stacks) { var E = 0, tot = 0; stacks.forEach(function (s) { var v = evalStack(s); E += v.E; tot += v.total; }); return { E: E, total: tot }; }

// ---------- ボット ----------
// でたらめ・ふつう：往復を全部使い、均等に配り、順番はランダム。たたみ方は allowed から ランダム。
function planRandom(allowed) {
  return function (dayIndex, kinds, rng) {
    var k = Math.min(T.DAYS[dayIndex].trips, kinds.length);
    return deal(kinds, k, rng).map(function (s) { return s.map(function (kind) { return pick(allowed[kind], rng); }); });
  };
}
// コツ2つ：山ごとに ジーンズ1本を ふたつおりで いちばん下、くつした1足を まるめて いちばん上。
// ほかは しかく・ならべる・タオルくるくる・残りのジーンズは みつおり（つるつる・シーツは たたみ方が1つ）。
function planKotsu(dayIndex, kinds, rng) {
  var k = Math.min(T.DAYS[dayIndex].trips, kinds.length);
  var pool = shuffle(kinds.slice(), rng);
  var stacks = []; for (var i = 0; i < k; i++) stacks.push({ bottom: null, mid: [], top: null });
  // 先に 山ごとに ジーンズ1本・くつした1足を 取り分ける
  stacks.forEach(function (s) { var j = pool.indexOf('jeans'); if (j >= 0) { s.bottom = 'jeans_half'; pool.splice(j, 1); } });
  stacks.forEach(function (s) { var j = pool.indexOf('socks'); if (j >= 0) { s.top = 'socks_ball'; pool.splice(j, 1); } });
  // 残りを 均等に
  pool.forEach(function (kind, i) {
    var f = { tshirt: 'tshirt_square', socks: 'socks_line', towel: 'towel_roll', jeans: 'jeans_third', slick: 'slick_fold', sheet: 'sheet_fold' }[kind];
    stacks[i % k].mid.push(f);
  });
  return stacks.map(function (s) { var out = []; if (s.bottom) out.push(s.bottom); out = out.concat(shuffle(s.mid, rng)); if (s.top) out.push(s.top); return out; }).filter(function (s) { return s.length; });
}

// コツ3つ：「よつおりの すぐ上に みつおり」を 先に組む（タオルと ジーンズが 両方あれば 1組ずつ 山へ）。残りのジーンズは ふたつおりで いちばん下、くつした1足は まるめて いちばん上（コツ2つ）
function planKotsu3(dayIndex, kinds, rng) {
  var k = Math.min(T.DAYS[dayIndex].trips, kinds.length);
  var pool = shuffle(kinds.slice(), rng);
  var stacks = []; for (var i = 0; i < k; i++) stacks.push({ bottom: null, mid: [], top: null, pair: false });
  stacks.forEach(function (s) { var j = pool.indexOf('jeans'), t = pool.indexOf('towel'); if (j >= 0 && t >= 0) { s.pair = true; pool.splice(Math.max(j, t), 1); pool.splice(Math.min(j, t), 1); } });
  stacks.forEach(function (s) { var j = pool.indexOf('jeans'); if (j >= 0) { s.bottom = 'jeans_half'; pool.splice(j, 1); } });
  stacks.forEach(function (s) { var j = pool.indexOf('socks'); if (j >= 0) { s.top = 'socks_ball'; pool.splice(j, 1); } });
  pool.forEach(function (kind, i) {
    var f = { tshirt: 'tshirt_square', socks: 'socks_line', towel: 'towel_roll', jeans: 'jeans_third', slick: 'slick_fold', sheet: 'sheet_fold' }[kind];
    stacks[i % k].mid.push(f);
  });
  return stacks.map(function (s) { var out = []; if (s.bottom) out.push(s.bottom); var mid = shuffle(s.mid, rng); if (s.pair) { var pos = Math.floor(rng() * (mid.length + 1)); mid.splice(pos, 0, 'towel_quad', 'jeans_third'); } out = out.concat(mid); if (s.top) out.push(s.top); return out; }).filter(function (s) { return s.length; });
}

// （参考）文を読む人：札の文から素直に読める置き方だけ使う。
//   シーツは いちばん下（上ぜんぶ −1）、その すぐ上に みつおり（シーツを 0に）。シーツのない山は ジーンズを ふたつおりで下。
//   くつした1足は まるめて上、残りは ならべる。タオルは みつおりの すぐ下なら よつおり（お互い 0）、そうでなければ くるくる。
//   Tシャツは しかく。つるつるは まるめる の すぐ下（+1 を 受けるのは 上の1まいだけ）。往復は全部使い、均等に配る。
function planReader(dayIndex, kinds, rng, kOverride) {
  var k = Math.min(kOverride || T.DAYS[dayIndex].trips, kinds.length);
  var pool = shuffle(kinds.slice(), rng);
  var stacks = []; for (var i = 0; i < k; i++) stacks.push({ bottom: [], mid: [], top: [] });
  var take = function (kind) { var j = pool.indexOf(kind); if (j < 0) return false; pool.splice(j, 1); return true; };
  // シーツ → 山1の下。すぐ上に みつおり（あれば）
  if (take('sheet')) { stacks[0].bottom.push('sheet_fold'); if (take('jeans')) stacks[0].bottom.push('jeans_third'); }
  // 残りの山に ジーンズを ふたつおりで下
  stacks.forEach(function (s) { if (!s.bottom.length && take('jeans')) s.bottom.push('jeans_half'); });
  // くつした1足を まるめて上
  stacks.forEach(function (s) { if (take('socks')) s.top.push('socks_ball'); });
  // 残りのジーンズは みつおり、その すぐ下に タオルを よつおり（組）
  stacks.forEach(function (s, i) { if (pool.indexOf('jeans') >= 0 && pool.indexOf('towel') >= 0) { take('towel'); take('jeans'); s.mid.push(['towel_quad', 'jeans_third']); } });
  // つるつるは まるめる の すぐ下
  stacks.forEach(function (s) { if (s.top.length && take('slick')) s.top.unshift('slick_fold'); });
  // 残りは いちばん枚数の少ない山へ（人が「均等に」配るのに近い）
  var count = function (s) { var n = s.bottom.length + s.top.length; s.mid.forEach(function (m) { n += Array.isArray(m) ? m.length : 1; }); return n; };
  pool.forEach(function (kind) {
    var f = { tshirt: 'tshirt_square', socks: 'socks_line', towel: 'towel_roll', jeans: 'jeans_third', slick: 'slick_fold', sheet: 'sheet_fold' }[kind];
    var best = 0; for (var q = 1; q < k; q++) if (count(stacks[q]) < count(stacks[best])) best = q;
    stacks[best].mid.push(f);
  });
  return stacks.map(function (s) { var mid = shuffle(s.mid, rng); var flat = []; mid.forEach(function (m) { if (Array.isArray(m)) flat = flat.concat(m); else flat.push(m); }); return s.bottom.concat(flat, s.top); }).filter(function (s) { return s.length; });
}

// ---------- 探索（かしこい・にせの選択の検査） ----------
// 焼きなまし（少しずつ入れ替えて、良くなれば取り、悪くなっても たまに取る）＋ やり直し。
// 目標：obj = wE × 落ちる枚数の期待の合計 ＋ 山のぐらの合計（wE=1000 なら 期待を最優先、10 なら 指示書の ものさし）
function search(kinds, k, opts) {
  var wE = opts.wE, allowed = opts.allowed || FOLDS_OF, rng = opts.rng;
  var restarts = opts.restarts, iters = opts.iters;
  var n = kinds.length;
  if (k > n) return null;
  function objOf(stacks) { var v = evalStacks(stacks); return { obj: wE * v.E + v.total, E: v.E, total: v.total }; }
  var best = null, bestE = null;
  for (var r = 0; r < restarts; r++) {
    var st = deal(kinds, k, rng).map(function (s) { return s.map(function (kind) { return pick(allowed[kind], rng); }); });
    var cur = objOf(st);
    var T0 = wE * 0.03 + 1.5, T1 = 0.02;
    for (var it = 0; it < iters; it++) {
      var temp = T0 * Math.pow(T1 / T0, it / iters);
      var ns = st.map(function (s) { return s.slice(); });
      var mv = rng();
      var a = Math.floor(rng() * k), b = Math.floor(rng() * k);
      var ia = Math.floor(rng() * ns[a].length), ib = Math.floor(rng() * ns[b].length);
      if (mv < 0.35) { // たたみ方を変える
        var kind = T.FOLD_BY_ID[ns[a][ia]].kind; var fs = allowed[kind]; if (fs.length < 2) continue; ns[a][ia] = fs[(fs.indexOf(ns[a][ia]) + 1) % fs.length];
      } else if (mv < 0.7) { // 2枚を入れ替える
        if (a === b && ia === ib) continue; var t = ns[a][ia]; ns[a][ia] = ns[b][ib]; ns[b][ib] = t;
      } else if (mv < 0.9) { // 1枚を 別の位置へ
        if (ns[a].length <= 1 && a !== b) continue;
        var x = ns[a].splice(ia, 1)[0]; var pos = Math.floor(rng() * (ns[b].length + 1)); ns[b].splice(pos, 0, x);
      } else { // 1つの山を 部分的に ひっくり返す
        if (ns[a].length < 2) continue; var lo = Math.min(ia, Math.floor(rng() * ns[a].length)), hi = Math.max(ia, Math.floor(rng() * ns[a].length)); var seg = ns[a].slice(lo, hi + 1).reverse(); for (var q = lo; q <= hi; q++) ns[a][q] = seg[q - lo];
      }
      var no = objOf(ns);
      var d = no.obj - cur.obj;
      if (d <= 0 || rng() < Math.exp(-d / temp)) { st = ns; cur = no; }
      if (!best || cur.obj < best.obj - 1e-9) best = { obj: cur.obj, E: cur.E, total: cur.total, stacks: st.map(function (s) { return s.slice(); }) };
      if (!bestE || cur.E < bestE.E - 1e-9 || (Math.abs(cur.E - bestE.E) < 1e-9 && cur.total < bestE.total)) bestE = { obj: cur.obj, E: cur.E, total: cur.total, stacks: st.map(function (s) { return s.slice(); }) };
    }
  }
  if (best) best.bestE = bestE;
  return best;
}
// 期待を最優先で さがす：ものさし 10 と 1000 の両方で探索して、期待が小さい方（同じなら ぐらが小さい方）
function searchE(kinds, k, opts) {
  var a = search(kinds, k, Object.assign({}, opts, { wE: 10 })), b = search(kinds, k, Object.assign({}, opts, { wE: 1000, rng: T.makeRng(opts.rng.seed + 1) }));
  if (!a) return null;
  var cands = [a.bestE, b.bestE];
  cands.sort(function (x, y) { return (x.E - y.E) || (x.total - y.total); });
  return cands[0];
}
var searchCache = new Map();
function searchCached(kinds, k, opts) {
  var key = kinds.slice().sort().join(',') + '|' + k + '|' + opts.wE + '|' + (opts.tag || '');
  var v = searchCache.get(key);
  if (v) return v;
  v = opts.wE === 'E' ? searchE(kinds, k, opts) : search(kinds, k, opts);
  searchCache.set(key, v);
  return v;
}
// かしこい：山の数は少ない方から試し、期待が 0.05以下になる 最少の数を使う（どれも超えるなら いちばん期待が小さい数）
function planSmart(dayIndex, kinds, rng) {
  var trips = T.DAYS[dayIndex].trips;
  var bestAny = null;
  for (var k = 1; k <= Math.min(trips, kinds.length); k++) {
    var r = searchCached(kinds, k, { wE: 'E', rng: T.makeRng(1000 + k), restarts: QUICK ? 6 : 16, iters: QUICK ? 1500 : 4000, tag: 'smart' });
    if (!r) continue;
    if (r.E <= 0.05) return r.stacks;
    if (!bestAny || r.E < bestAny.E) bestAny = r;
  }
  return bestAny.stacks;
}

// ---------- 1周 ----------
function playRun(plan, rng, botRng) {
  var carried = [], stars = 0, days = [];
  for (var d = 0; d < 3; d++) {
    var kinds = T.basketOf(d, carried);
    var stacks = plan(d, kinds, botRng);
    if (!T.sameItems(kinds, stacks)) throw new Error('かごと山がずれた day' + (d + 1));
    var res = T.runDay(d, stacks, rng);
    carried = res.fallen.map(function (f) { return T.FOLD_BY_ID[f].kind; });
    stars += res.stars;
    days.push({ stacks: stacks.length, fallen: res.fallen.length, delivered: res.delivered.length });
  }
  return { remaining: carried.length, success: carried.length === 0, stars: stars, days: days };
}
function runBot(name, plan, runs, target) {
  var ok = 0, rem = 0, stars = 0, t0 = Date.now();
  var fallDay = [0, 0, 0], stacksDay = [0, 0, 0];
  for (var i = 0; i < runs; i++) {
    var r = playRun(plan, T.makeRng(SEED * 100000 + i + 1), T.makeRng(SEED * 7919 + i * 13 + 5));
    if (r.success) ok++; rem += r.remaining; stars += r.stars;
    r.days.forEach(function (d, j) { fallDay[j] += d.fallen; stacksDay[j] += d.stacks; });
  }
  var pct = ok / runs * 100;
  return { name: name, runs: runs, pct: pct, rem: rem / runs, stars: stars / runs, fallDay: fallDay.map(function (x) { return x / runs; }), stacksDay: stacksDay.map(function (x) { return x / runs; }), target: target, hit: pct >= target[0] && pct <= target[1], sec: (Date.now() - t0) / 1000 };
}

function f1(x) { return (Math.round(x * 10) / 10).toFixed(1); }
function f2(x) { return (Math.round(x * 100) / 100).toFixed(2); }

(function main() {
  var t0 = Date.now();
  console.log('# ボットの結果（runs ' + RUNS + '、seed ' + SEED + (QUICK ? '、quick' : '') + (T.variant() ? '、切り替え ' + T.variant().name + '：' + T.variant().note : '') + '）\n');
  console.log('前提：指示書 3. の数字のまま（かかえる力 10、高さ 5まいめから、ゆれ 1/2/3、ゆれなし 30%、往復 2/2/4）。でたらめ・ふつう・コツ2つは 往復を全部使い、均等に配り、順番はランダム。\n');
  var rows = [
    runBot('でたらめ（たたみ方もランダム）', planRandom(FOLDS_OF), RUNS, [0, 10]),
    runBot('ふつう（しかく・ならべる・よつおり・ふたつおり だけ）', planRandom(PLAIN), RUNS, [5, 25]),
    runBot('コツ2つ（ふたつおり いちばん下・まるめる いちばん上）', planKotsu, RUNS, [35, 65]),
    runBot('（参考）コツ3つ（よつおりの上に みつおり を先に組む＋コツ2つ）', planKotsu3, RUNS, [0, 100]),
    runBot('（参考）文を読む人（シーツは下＋みつおり、ふたつおり下、まるめる上、よつおり＞みつおり、つるつるは まるめるの下。残りは枚数が少ない山へ）', planReader, RUNS, [0, 100]),
    runBot('（参考）文を読む人が ☆を取りに 1日目1山・3日目3山（1・2・3）', function (d, kinds, rng) { return planReader(d, kinds, rng, d === 0 ? 1 : (d === 2 ? 3 : 2)); }, RUNS, [0, 100]),
    runBot('かしこい（探索。期待 0.05以下の 最少の山）', planSmart, RUNS, [95, 100])
  ];
  console.log('| ボット | せいこう | のこりの平均 | ☆の平均 | 落ちた枚数の平均（1日目／2日目／3日目） | 山の数の平均 | 目標 | 届いたか |');
  console.log('|---|---|---|---|---|---|---|---|');
  rows.forEach(function (r) {
    console.log('| ' + r.name + ' | ' + f1(r.pct) + '% | ' + f2(r.rem) + ' | ' + f2(r.stars) + ' | ' + r.fallDay.map(f2).join('／') + ' | ' + r.stacksDay.map(f1).join('／') + ' | ' + r.target[0] + '〜' + r.target[1] + '% | ' + (r.hit ? '○' : '**×**') + ' |');
  });
  console.log('\n参考（チャット側の計算）：でたらめ 2%、ふつう 11%、コツ2つ 51%、かしこい 100%。のこりの平均 7.5、3.7、1.2、0。かしこいの☆ 1.8。\n');

  // 日ごとの表：山の数ごとの 最良の 落ちる枚数の期待（きのう落ちた分なし）
  console.log('## 日ごとの表（山の数ごとの 最良の「落ちる枚数の期待」。きのう落ちた分は なし）\n');
  console.log('| 日 | 山1つ | 山2つ | 山3つ | 山4つ |');
  console.log('|---|---|---|---|---|');
  var dayBest = [];
  for (var d = 0; d < 3; d++) {
    var kinds = T.basketOf(d), cells = [], detail = [];
    for (var k = 1; k <= 4; k++) {
      if (k > T.DAYS[d].trips) { cells.push('-'); continue; }
      var r = searchCached(kinds, k, { wE: 'E', rng: T.makeRng(1000 + k), restarts: QUICK ? 6 : 24, iters: QUICK ? 1500 : 10000, tag: 'table' });
      cells.push(f2(r.E) + '（ぐら ' + r.total + '）');
      detail.push({ k: k, r: r });
    }
    dayBest.push(detail);
    console.log('| ' + (d + 1) + '日目（' + kinds.length + 'まい・往復' + T.DAYS[d].trips + '） | ' + cells.join(' | ') + ' |');
  }
  console.log('\n参考（チャット側）：1日目 1山 0.00。2日目 1山 2.18、2山 0.00。3日目 1山 6.34、2山 0.98、3山 0.00。\n');
  console.log('最良の積み方の例（下 > 上）：\n');
  dayBest.forEach(function (detail, d) {
    detail.forEach(function (x) {
      console.log('- ' + (d + 1) + '日目 山' + x.k + 'つ（期待 ' + f2(x.r.E) + '）：' + x.r.stacks.map(function (s) { var c = T.stackCalc(s); return '[' + s.map(function (f) { var F = T.FOLD_BY_ID[f]; return T.KIND_BY_ID[F.kind].name + F.name; }).join(' > ') + '］=' + c.total; }).join('　'));
    });
  });

  // にせの選択がないか
  console.log('\n## にせの選択の検査（たたみ方が2つある4種を 片方だけに固定。ものさし＝10×落ちる枚数の期待＋山のぐらの合計 の最小）\n');
  var scenes = [{ name: '1日目 1山', d: 0, k: 1 }, { name: '1日目 2山', d: 0, k: 2 }, { name: '2日目 2山', d: 1, k: 2 }, { name: '3日目 3山', d: 2, k: 3 }, { name: '（参考）2日目 1山', d: 1, k: 1, extra: true }, { name: '（参考）3日目 2山', d: 2, k: 2, extra: true }];
  var sOpts = { restarts: QUICK ? 8 : 32, iters: QUICK ? 1500 : 6000 };
  var fixes = [];
  ['tshirt', 'socks', 'towel', 'jeans'].forEach(function (kind) { FOLDS_OF[kind].forEach(function (f) { fixes.push({ kind: kind, fold: f }); }); });
  var free = scenes.map(function (sc) { return search(T.basketOf(sc.d), sc.k, { wE: 10, rng: T.makeRng(555 + sc.k), restarts: sOpts.restarts, iters: sOpts.iters }); });
  var table = fixes.map(function (fx) {
    return scenes.map(function (sc, si) {
      var allowed = {}; Object.keys(FOLDS_OF).forEach(function (kk) { allowed[kk] = FOLDS_OF[kk].slice(); }); allowed[fx.kind] = [fx.fold];
      var r = search(T.basketOf(sc.d), sc.k, { wE: 10, rng: T.makeRng(777 + si), restarts: sOpts.restarts, iters: sOpts.iters, allowed: allowed });
      if (r.obj < free[si].obj - 1e-9) free[si] = r; // 固定は 自由の一部なので、自由の方が それより良いはず（探索の取りこぼしを埋める）
      return r;
    });
  });
  console.log('指示書の4場面で判定。（参考）の2場面は 判定に入れず、数だけ出す。\n');
  console.log('| 固定 | ' + scenes.map(function (s) { return s.name; }).join(' | ') + ' | 4場面の どこかで悪くなる | 参考も入れると |');
  console.log('|---|' + scenes.map(function () { return '---|'; }).join('') + '---|---|');
  console.log('| （自由） | ' + free.map(function (r) { return f2(r.obj); }).join(' | ') + ' | - | - |');
  var allBad = true;
  table.forEach(function (row, i) {
    var fx = fixes[i], F = T.FOLD_BY_ID[fx.fold];
    var worse = row.some(function (r, si) { return !scenes[si].extra && r.obj > free[si].obj + 1e-9; });
    var worseAny = row.some(function (r, si) { return r.obj > free[si].obj + 1e-9; });
    if (!worse) allBad = false;
    console.log('| ' + T.KIND_BY_ID[fx.kind].name + 'を ' + F.name + ' だけ | ' + row.map(function (r, si) { return f2(r.obj) + (r.obj > free[si].obj + 1e-9 ? '（+' + f2(r.obj - free[si].obj) + '）' : ''); }).join(' | ') + ' | ' + (worse ? '○' : '**×（にせの選択？）**') + ' | ' + (worseAny ? '○' : '×') + ' |');
  });
  console.log('\n8通りとも どこかで悪くなる：' + (allBad ? '○' : '**×**'));
  console.log('\n（' + Math.round((Date.now() - t0) / 1000) + '秒）');
})();
