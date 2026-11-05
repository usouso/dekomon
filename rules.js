// たたみやま 版1 — ルール（画面なしで動く計算だけ。ブラウザと Node で同じファイル）
// 山の計算（stackCalc）、運ぶ計算（carry）、1日の中身（DAYS）、乱数（makeRng）。
// 画面側（ui.js）は、ここが返す値と ログを表示・再生するだけで、条件を書き直さない。
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Tatami = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var CFG = {
    capacity: 10,        // かかえる力
    heightFrom: 5,       // 高さのぶんは 5まいめから +1（枚数−4）
    calmChance: 0.30,    // 出来事ごとに 30% で ゆれなし
    events: [
      { id: 'shikii', name: 'しきい', shake: 1, calm: 'うまく またいだ' },
      { id: 'neko', name: 'ねこ', shake: 2, calm: 'ねこは ねていた' },
      { id: 'kaidan', name: 'かいだん', shake: 3, calm: 'そっと のぼった' }
    ],
    safeLine: 4          // ぐらの合計が これ以下なら かならず とどく
  };

  // 洗濯物（6種）
  var KINDS = [
    { id: 'tshirt', name: 'Tシャツ' },
    { id: 'socks', name: 'くつした' },
    { id: 'towel', name: 'タオル' },
    { id: 'jeans', name: 'ジーンズ' },
    { id: 'slick', name: 'つるつるシャツ' },
    { id: 'sheet', name: 'シーツ' }
  ];
  var KIND_BY_ID = {}; KINDS.forEach(function (k) { KIND_BY_ID[k.id] = k; });

  // たたみ方（10通り）。id・名前・ぐら・効果の文・効果の計算を 1組に。
  // effect の形：
  //   { type:'add', target:'up1'|'down1'|'above', amount:n }  … 足し引き（手順2）
  //   { type:'zero', target:'up1'|'down1' }                    … 0になる（手順3）
  //   { type:'cond', where:'top'|'bottom', base:0 }           … いちばん上／下なら ぐら0（手順1）
  //   null … 効果なし
  // dir：絵に小さく出す向き（↑ すぐ上、↓ すぐ下、↑↑ 上ぜんぶ）
  var FOLDS = [
    { id: 'tshirt_square', kind: 'tshirt', name: 'しかく', gura: 1, text: '', effect: null, dir: '', shape: 'flat' },
    { id: 'tshirt_roll', kind: 'tshirt', name: 'くるくる', gura: 0, text: 'すぐ上の1まい ぐら+2', effect: { type: 'add', target: 'up1', amount: 2 }, dir: '↑', shape: 'tube' },
    { id: 'socks_line', kind: 'socks', name: 'ならべる', gura: 1, text: '', effect: null, dir: '', shape: 'pair' },
    { id: 'socks_ball', kind: 'socks', name: 'まるめる', gura: 3, text: 'いちばん上なら ぐら0', effect: { type: 'cond', where: 'top', base: 0 }, dir: '', shape: 'ball' },
    { id: 'towel_quad', kind: 'towel', name: 'よつおり', gura: 2, text: 'すぐ上の1まいの ぐらが 0になる', effect: { type: 'zero', target: 'up1' }, dir: '↑', shape: 'thick' },
    { id: 'towel_roll', kind: 'towel', name: 'くるくる', gura: 1, text: 'すぐ下の1まい ぐら−1', effect: { type: 'add', target: 'down1', amount: -1 }, dir: '↓', shape: 'tube' },
    { id: 'jeans_half', kind: 'jeans', name: 'ふたつおり', gura: 3, text: 'いちばん下なら ぐら0', effect: { type: 'cond', where: 'bottom', base: 0 }, dir: '', shape: 'long' },
    { id: 'jeans_third', kind: 'jeans', name: 'みつおり', gura: 4, text: 'すぐ下の1まいの ぐらが 0になる', effect: { type: 'zero', target: 'down1' }, dir: '↓', shape: 'short' },
    { id: 'slick_fold', kind: 'slick', name: 'たたむ', gura: 0, text: 'これより上ぜんぶ ぐら+1', effect: { type: 'add', target: 'above', amount: 1 }, dir: '↑↑', shape: 'shiny' },
    { id: 'sheet_fold', kind: 'sheet', name: 'たたむ', gura: 5, text: 'これより上ぜんぶ ぐら−1', effect: { type: 'add', target: 'above', amount: -1 }, dir: '↑↑', shape: 'wide' }
  ];
  var FOLD_BY_ID = {}; FOLDS.forEach(function (f) { FOLD_BY_ID[f.id] = f; });
  function foldsOf(kind) { return FOLDS.filter(function (f) { return f.kind === kind; }); }

  // 3日の中身（かご）と 往復の回数
  var DAYS = [
    { day: 1, trips: 2, basket: { tshirt: 2, socks: 2, towel: 1, jeans: 1 } },
    { day: 2, trips: 2, basket: { tshirt: 3, socks: 2, towel: 2, jeans: 1, slick: 1 } },
    { day: 3, trips: 4, basket: { tshirt: 3, socks: 4, towel: 2, jeans: 2, slick: 2, sheet: 1 } }
  ];
  function basketOf(dayIndex, carried) {
    var out = [];
    var b = DAYS[dayIndex].basket;
    KINDS.forEach(function (k) { for (var i = 0; i < (b[k.id] || 0); i++) out.push(k.id); });
    (carried || []).forEach(function (k) { out.push(k); });
    return out;
  }

  // ---------- 乱数（seed で固定） ----------
  function makeRng(seed) {
    var s = (seed >>> 0) || 1;
    var rng = function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
    rng.seed = seed;
    return rng;
  }

  // ---------- 山の計算 ----------
  // items: 下から上へ [{ fold:'tshirt_square' }, ...]（fold id の配列でもよい）
  // 返す: { items:[{fold, base, after, gura, changes:[{from, by, delta}]...}], sum, height, total, n }
  //   base  … 手順1（もとの ぐら。「いちばん上なら／下なら」はここで決まる）
  //   after … 手順2（足し引きの合計。0より小さくはならない）
  //   gura  … 手順3（「0になる」を当てたあと）＝ その1枚の 今の ぐら
  //   changes … だれの効果で いくつ変わったか（from: 効果を出した段の番号、by: fold id、delta: 数 または 'zero'）
  function stackCalc(items) {
    var n = items.length;
    var rows = items.map(function (it, i) {
      var f = FOLD_BY_ID[typeof it === 'string' ? it : it.fold];
      var base = f.gura;
      var e = f.effect;
      var condHit = false;
      if (e && e.type === 'cond') {
        var isTop = (i === n - 1), isBottom = (i === 0);
        if ((e.where === 'top' && isTop) || (e.where === 'bottom' && isBottom)) { base = e.base; condHit = true; }
      }
      return { i: i, fold: f.id, base: base, condHit: condHit, delta: 0, after: base, zeroBy: -1, gura: base, changes: [] };
    });
    // 手順2：足し引き
    rows.forEach(function (r, i) {
      var e = FOLD_BY_ID[r.fold].effect;
      if (!e || e.type !== 'add') return;
      var targets = [];
      if (e.target === 'up1' && i + 1 < n) targets.push(i + 1);
      if (e.target === 'down1' && i - 1 >= 0) targets.push(i - 1);
      if (e.target === 'above') for (var j = i + 1; j < n; j++) targets.push(j);
      targets.forEach(function (t) { rows[t].delta += e.amount; rows[t].changes.push({ from: i, by: r.fold, delta: e.amount }); });
    });
    rows.forEach(function (r) { r.after = Math.max(0, r.base + r.delta); r.gura = r.after; });
    // 手順3：0になる
    rows.forEach(function (r, i) {
      var e = FOLD_BY_ID[r.fold].effect;
      if (!e || e.type !== 'zero') return;
      var t = e.target === 'up1' ? i + 1 : i - 1;
      if (t < 0 || t >= n) return;
      rows[t].gura = 0; rows[t].zeroBy = i; rows[t].changes.push({ from: i, by: r.fold, delta: 'zero' });
    });
    var sum = 0; rows.forEach(function (r) { sum += r.gura; });
    var height = Math.max(0, n - (CFG.heightFrom - 1));
    return { items: rows, sum: sum, height: height, total: sum + height, n: n };
  }

  // 積んだとき、ほかの段の数字が どう変わったか（画面の「3→0」用）：前の計算と 後の計算を比べる
  function diffCalc(before, after) {
    var out = [];
    var m = Math.min(before ? before.items.length : 0, after.items.length);
    for (var i = 0; i < m; i++) if (before.items[i].gura !== after.items[i].gura) out.push({ i: i, from: before.items[i].gura, to: after.items[i].gura });
    return out;
  }

  // ---------- 運ぶ ----------
  // 落ちる1枚を決める：ぐらが いちばん大きい1枚（同じ数なら 上の方）。全部 0 なら いちばん上。
  function fallIndex(calc) {
    var best = -1, bestG = -1;
    calc.items.forEach(function (r, i) { if (r.gura >= bestG) { bestG = r.gura; best = i; } });
    if (bestG <= 0) return calc.n - 1;
    return best;
  }
  // stack: fold id の配列（下から上）。calmFlags: [bool×3]（true なら ゆれなし）。
  // 返す: { log:[{event, shake, calm, acc, total, calc, fell:bool, drops:[{at, stack(落ちる前の山), fromIndex, items:[fold...]}] }], delivered:[fold...], fallen:[fold...] }
  function carryWith(stack, calmFlags) {
    var cur = stack.slice();
    var acc = 0, fallen = [], log = [];
    CFG.events.forEach(function (ev, k) {
      var calm = !!calmFlags[k];
      var shake = calm ? 0 : ev.shake;
      acc += shake;
      var entry = { event: ev.id, name: ev.name, shake: shake, calm: calm, acc: acc, drops: [], fell: false };
      var calc = stackCalc(cur);
      entry.totalBefore = calc.total;
      entry.calcBefore = calc;
      while (cur.length && calc.total + acc > CFG.capacity) {
        var fi = fallIndex(calc);
        var dropped = cur.slice(fi);
        entry.drops.push({ fromIndex: fi, fromFold: cur[fi], stack: cur.slice(), calc: calc, items: dropped, total: calc.total, acc: acc });
        fallen = fallen.concat(dropped);
        cur = cur.slice(0, fi);
        calc = stackCalc(cur);
        entry.fell = true;
      }
      entry.total = calc.total;
      entry.calc = calc;
      entry.remain = cur.slice();
      log.push(entry);
    });
    return { log: log, delivered: cur.slice(), fallen: fallen, stack: stack.slice() };
  }
  function carry(stack, rng) {
    var flags = CFG.events.map(function () { return rng() < CFG.calmChance; });
    var r = carryWith(stack, flags);
    r.calmFlags = flags;
    return r;
  }
  // 8通りの運を全部まわして、落ちる枚数の期待と、運ごとの結果を返す（ボット・にせの選択の検査用）
  function carryExpect(stack) {
    var p = CFG.calmChance, q = 1 - p;
    var exp = 0, pSafe = 0, cases = [];
    for (var m = 0; m < 8; m++) {
      var flags = [!!(m & 1), !!(m & 2), !!(m & 4)];
      var prob = 1; flags.forEach(function (c) { prob *= c ? p : q; });
      var r = carryWith(stack, flags);
      exp += prob * r.fallen.length;
      if (!r.fallen.length) pSafe += prob;
      cases.push({ flags: flags, prob: prob, fallen: r.fallen.length });
    }
    exp = Math.round(exp * 1e9) / 1e9; pSafe = Math.round(pSafe * 1e9) / 1e9;
    return { expected: exp, pSafe: pSafe, cases: cases };
  }

  // ---------- 1日・1周（ボットと ?auto=1 の答え合わせ用） ----------
  // stacks: [[fold...], ...]（山ごと、下から上）。rng は 山の順に 出来事×3 ずつ引く（画面も同じ順で引く）。
  function runDay(dayIndex, stacks, rng) {
    var trips = DAYS[dayIndex].trips;
    var results = stacks.map(function (s) { return carry(s, rng); });
    var delivered = [], fallen = [];
    results.forEach(function (r) { delivered = delivered.concat(r.delivered); fallen = fallen.concat(r.fallen); });
    var stars = Math.max(0, trips - stacks.length);
    return { day: dayIndex + 1, results: results, delivered: delivered, fallen: fallen, stars: stars };
  }
  // kinds の配列（かごの中身）が、fold の配列（山）と 枚数・種類で 合っているか
  function sameItems(kinds, stacks) {
    var a = kinds.slice().sort();
    var b = []; stacks.forEach(function (s) { s.forEach(function (f) { b.push(FOLD_BY_ID[f].kind); }); });
    b.sort();
    return a.join(',') === b.join(',');
  }

  return {
    CFG: CFG, KINDS: KINDS, KIND_BY_ID: KIND_BY_ID, FOLDS: FOLDS, FOLD_BY_ID: FOLD_BY_ID, foldsOf: foldsOf,
    DAYS: DAYS, basketOf: basketOf, makeRng: makeRng,
    stackCalc: stackCalc, diffCalc: diffCalc, fallIndex: fallIndex, carry: carry, carryWith: carryWith, carryExpect: carryExpect,
    runDay: runDay, sameItems: sameItems
  };
});
